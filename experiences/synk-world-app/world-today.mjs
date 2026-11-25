// Atlas 새 길의 WORLD 홈(재설계 단계 4-3 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §20). 셸은 이 파일을 부르지 않는다 —
// 입구(world-atlas-next.mjs)가 정적으로 받아 홈 플래너로 넘기고, 셸은 입구를 기능이 켜졌을 때만 동적 import로 부른다. 그래서 꺼진 판의
// 첫 화면 · 계정 묶음 · 생활 단독 묶음에는 실리지 않는다(설계 주인 11-15 · 설계 검토 H19).
// 홈의 추천은 드라마 「오늘」 한 장과 같은 세 줄(복습 again · 오늘 공부 new · 점검 check)이다. 엔진의 plan()이 낸 차례를 바꾸지 않고
// 활동마다 칸 하나를 정해, 칸마다 맨 앞 활동 하나만 줄로 세운다(§20-2). 줄의 글은 그 활동의 기록에서만 나온다(설계 주인 판단 3).
// 4-3에서 넘기는 활동은 다섯이다 — 하던 것 · 생활 복습 하나 · 다음 생활 레슨 하나 · 한글 먼저 · 짧은 연습(돌아온 단위가 든 문항만). 4-4b에서
// 시험을 고른 학생의 이번 주 계획(world-plan-next.mjs — 새 칸으로 지음)이 들어온다 — 숙제 연습(오늘 공부 칸)과 짧은 진단(점검 칸)이 활동이
// 되고, 계획은 examPlan에 실린다(§21-6 · §20-7). 4-6e-1에서 게임 셋(바람길 · 리듬 · 환승 — world-home-games.mjs)이 복습 칸에만 다시
// 들어온다(§25-1) — 생활 복습과 짧은 연습이 싣지 않은 돌아온 단위마다 문항 하나다. 오늘 공부 칸에는 자유 게임 줄을 세우지 않는다.
import { LESSONS, PACKS } from './life-content.mjs';
import {
  answersOf,
  buildWorldLearningCandidates,
  lifeLessonCandidate,
  lifeReviewCandidate,
  resumeCandidates,
  withAnswers,
  worldLearningSettings,
} from './world-account.bundle.mjs';
import { homeGames } from './world-home-games.mjs';
// ↑ world-learning-plan.mjs의 것을 셸과 같은 주소의 계정 묶음에서 받는다 — 그 원천은 묶음 안에만 있고 따로 나가지 않는다(서버 · 공개 빌드).
//   묶음은 tools/build-world-account.mjs가 짓고 CI가 낡은 묶음을 잡는다.

export const TODAY_KINDS = Object.freeze(['again', 'new', 'check']);
export const LIFE_REVIEW_ID = 'world.review.life';
const HANGUL_ID = 'world.play.hangul';
const PRACTICE_SUPPORTS = Object.freeze(['choose', 'step', 'independent']);
const DAY_START_HOUR = 4; // 엔진과 같은 하루(기기 현지 새벽 4시 경계)
// 조건에 걸려 줄이 하나도 없을 때의 이유 — 지금 판(Core · atlas/vellum.js activity.none)과 같은 문장이다. 화면이 tMessage로 화면 언어로 바꾼다.
const NO_FIT = '지금 조건에 맞는 활동이 없어요. 시간이나 소리 설정을 바꿔 볼 수 있어요.';

const quiet = fn => {
  try {
    return fn();
  } catch {
    return null;
  }
};

// 학습일 열쇠 — 차례 표시(§20-8)를 비우는 때. 기기 현지 새벽 4시가 경계다. 다시 그리는 때(nextDayStart)와 같은 달력 현지 시각으로 센다 —
// 4시간을 빼서 세면 서머타임이 바뀌는 날 열쇠가 현지 5시(봄)나 3시(가을)에 바뀌어 다시 그리는 때와 어긋난다(엔진급 끝 판 B5).
export function todayKey(now = Date.now()) {
  const at = new Date(now);
  if (at.getHours() < DAY_START_HOUR) at.setDate(at.getDate() - 1);
  return `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
}
// 다음 학습일이 시작되는 때(다시 그리는 때, 설계 검토 H22).
export function nextDayStart(now = Date.now()) {
  const at = new Date(now);
  at.setHours(DAY_START_HOUR, 0, 0, 0);
  if (at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.getTime();
}

// Core recommendActivities의 거름과 같다(atlas/learning.js — 열 수 없음 · 정한 시간보다 김 · 소리를 끈 날 소리가 듦 · 도움 방식이 맞지 않음).
// 걸린 활동은 사실 locked로 넘긴다(§20-6 사실 표 · 설계 검토 H15).
function blockedBy(candidate, settings) {
  if (candidate.available === false) return 'activity.unavailable';
  if (settings.minutes != null && candidate.minutes > settings.minutes) return 'time.limit';
  if (settings.audioAvailable === false && candidate.audioRequired) return 'audio.unavailable';
  if (
    settings.support &&
    settings.support !== 'choose' &&
    Array.isArray(candidate.supports) &&
    !candidate.supports.includes(settings.support)
  )
    return 'support.mismatch';
  return null;
}

// 제품의 목표 이름 → 두뇌의 목표({ kind } · 「더 배우고 싶어요」는 { kind: 'interest', topic }). 설정 목표와 겹치는 것만 센다.
const goalsOf = (candidate, settings) =>
  (candidate.goals ?? []).flatMap(goal =>
    goal.startsWith('interest.')
      ? [{ kind: 'interest', topic: goal.slice('interest.'.length) }]
      : settings.goals.includes(goal)
        ? [{ kind: goal }]
        : [],
  );

const itemsOf = targets =>
  (targets ?? [])
    .filter(target => typeof target?.itemKey === 'string')
    .map(target => ({ itemKey: target.itemKey }));

function activity(kind, open, facts, candidates, settings, role = null) {
  const blocked = blockedBy(open, settings);
  return {
    kind,
    open,
    blocked,
    plan: blocked
      ? { id: open.id, candidates: [], facts: { locked: true } }
      : { id: open.id, candidates, facts },
    // 이번 주 계획이 넘긴 활동(4-4b) — homework(숙제 연습) · check(점검 칸의 짧은 진단). 잠근 숙제 연습은 풀었을 때의 몫을 함께 든다(A10).
    ...(role ? { role } : {}),
    ...(role === 'homework' && blocked ? { unlocked: { id: open.id, candidates, facts } } : {}),
  };
}

// 생활 판정(lifeDue) → 생활 복습 사실(§20-6의 5). ①(soon)이 있으면 missed, 없고 ②(first)가 있으면 bridge. 단위는 lifeDue 차례에서
// 이름이 될 단위가 있는 첫 ①(없으면 첫 ②)이고, 생활 단위가 없는 ①뿐이면 단위 없이 넘긴다(이름 없는 문장 — 설계 주인 11-15 조건 2).
export function reviewFact(items = []) {
  const missed = items.filter(item => item?.why === 'soon');
  if (missed.length) {
    const named = missed.find(item => typeof item.unit === 'string');
    return { kind: 'missed', ...(named ? { unit: named.unit } : {}) };
  }
  const bridge = items.find(item => item?.why === 'first');
  if (!bridge) return null;
  return { kind: 'bridge', ...(typeof bridge.unit === 'string' ? { unit: bridge.unit } : {}) };
}

// 짧은 연습 — 항목(skillId)마다 하나. 그 항목에서 돌아온 단위마다 문항 하나만 후보다(§20-2). 두뇌는 할 것의 수를 문항으로 세고 새 문항까지
// 세므로, 문항을 모두 넘기면 돌아온 단위가 하나뿐인 큰 짧은 연습이 돌아온 표현이 여럿인 생활 복습을 앞지른다(설계 검토 H14 넷째 장면). TOPIK
// 문항은 단위를 여럿이 나눠 가져 돌아온 단위가 든 문항만 추려도 수가 커진다 — 그래서 단위마다 하나다. 그러면 할 것의 수가 돌아온 단위의 수가
// 되어 생활 복습(lifeDue ③ — 단위마다 복습 하나)과 같은 셈이다. 연습 화면이 실제로 내는 문항은 연습 코치가 고른다. 소리를 끈 날 듣기 짧은 연습은
// 빼지 않고 잠근다(activity → blockedBy의 소리 거름 — 사실 locked). 빼면 듣기 연습에만 돌아온 단위가 있는 날이 조건에 걸린 날(blocked)이 아니라
// 다 한 날로 보인다(엔진급 끝 판 B1).
function practiceActivities({ pool, dueUnits, itemUnits, settings, labels, length }) {
  if (!Array.isArray(pool) || !dueUnits?.size || typeof itemUnits !== 'function') return [];
  const bySkill = new Map();
  const covered = new Map(); // 항목 → 이미 문항을 고른 돌아온 단위
  for (const item of pool) {
    if (typeof item?.itemKey !== 'string' || typeof item.skillId !== 'string') continue;
    const units = (quiet(() => itemUnits(item.itemKey)) ?? []).map(row => row?.unit);
    const seen = covered.get(item.skillId) ?? new Set();
    const fresh = units.filter(unit => dueUnits.has(unit) && !seen.has(unit));
    if (!fresh.length) continue;
    for (const unit of fresh) seen.add(unit);
    covered.set(item.skillId, seen);
    if (!bySkill.has(item.skillId)) bySkill.set(item.skillId, []);
    bySkill.get(item.skillId).push(item);
  }
  return [...bySkill]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([skillId, items]) => {
      const listening = skillId.split('.')[1] === 'listening';
      const name = quiet(() => labels?.(skillId)) || skillId;
      const open = {
        id: `world.practice.${skillId}`,
        label: `${listening ? '듣기' : '읽기'} 짧은 연습 · ${name}`,
        route: 'practice',
        skillId,
        minutes: Math.max(2, Math.ceil(length * (listening ? 0.8 : 0.5))),
        minutesEstimated: true,
        supports: [...PRACTICE_SUPPORTS],
        audioRequired: listening,
        modality: listening ? 'listening' : 'reading',
        targets: [],
      };
      return activity('again', open, {}, items.map(item => ({ itemKey: item.itemKey })), settings);
    });
}

// 게임(4-6e-1 — §25-1). 복습 칸에만 선다 — 게임마다 활동 하나(kind again)이고, 후보는 돌아온 단위마다 그 게임의 문항 하나다(짧은 연습과
// 같은 줄이기). 돌아온 단위 하나는 한 활동만 센다 — 맡는 차례는 생활 복습 · 짧은 연습 · 게임이다. 그래서 그날 생활 복습 후보 문항의 단위
// (taken.life — lifeReviewCandidate의 targets, 생활 은행 전체가 아니다)와 그 학생의 짧은 연습 풀에 든 단위(taken.practice)는 게임 후보에 넣지
// 않는다. 같은 단위를 두 활동이 함께 세면 그 단위의 복습을 두 줄이 다툰다. 목표는 넘기지 않는다 — 게임 후보는 exam · listening · travel 같은
// 목표를 실어, 넘기면 맞춘 목표 수가 할 것의 수보다 먼저 갈라 목표가 없는 생활 복습을 앞지른다. 맡을 단위가 없는 게임은 활동을 넘기지 않는다.
// 소리를 끈 날은 짧은 연습처럼 잠근다(blockedBy의 소리 거름). 게임 사이에서도 돌아온 단위 하나는 한 활동만 맡는다 — 목록 차례(바람길 · 리듬 ·
// 환승)로 앞 게임이 맡는다. 두뇌는 문항의 모든 단위로 이유를 지으므로, 다른 활동(생활 복습 · 짧은 연습 · 앞 게임)이 맡은 돌아온 단위를 함께 실은
// 문항보다 그런 단위가 없는 문항을 먼저 고른다(두 번 훑기). 같은 게임이 이 앞에서 맡은 단위는 다른 활동 몫이 아니다 — 짧은 연습처럼 그 단위를
// 함께 실은 문항도 첫 훑기에서 고른다. 그런 문항이 없는 단위만 다른 활동 몫을 함께 실은 문항으로 맡는다 — 그 문항도 그 단위를 실제로 낸다.
// 활동은 맡은 단위(assigned — 맡은 차례대로 { unit, label }, label은 코치 itemUnits의 이름)를 함께 든다. 줄의 이유는 이것으로 짓는다(gameWhy).
function gameActivities({ games, dueUnits, itemUnits, settings, taken }) {
  if (!Array.isArray(games) || !dueUnits?.size || typeof itemUnits !== 'function') return [];
  const out = [];
  const covered = new Set(); // 게임들이 맡은 돌아온 단위(모든 게임이 함께 본다)
  const owned = unit => taken.life.has(unit) || taken.practice.has(unit);
  for (const game of games) {
    if (!game?.open || !Array.isArray(game.items)) continue;
    const rows = game.items
      .filter(item => typeof item?.itemKey === 'string')
      .map(item => {
        const units = (quiet(() => itemUnits(item.itemKey)) ?? []).filter(row => dueUnits.has(row?.unit));
        return { itemKey: item.itemKey, due: units.map(row => row.unit), labels: new Map(units.map(row => [row.unit, row.label ?? null])) };
      });
    const picked = new Set();
    const items = [];
    const assigned = [];
    const earlier = new Set(covered); // 앞 게임들이 맡은 단위
    for (const pure of [true, false])
      for (const row of rows) {
        if (picked.has(row.itemKey)) continue;
        if (pure && row.due.some(unit => owned(unit) || earlier.has(unit))) continue;
        const fresh = row.due.filter(unit => !covered.has(unit) && !owned(unit));
        if (!fresh.length) continue;
        for (const unit of fresh) {
          covered.add(unit);
          assigned.push(Object.freeze({ unit, label: row.labels.get(unit) }));
        }
        picked.add(row.itemKey);
        items.push({ itemKey: row.itemKey });
      }
    if (items.length) out.push({ ...activity('again', game.open, {}, items, settings), assigned: Object.freeze(assigned) });
  }
  return out;
}
// 문항들의 단위(Set).
const unitsOfItems = (items, itemUnits) =>
  new Set(
    typeof itemUnits === 'function'
      ? (items ?? []).flatMap(item =>
          typeof item?.itemKey === 'string' ? (quiet(() => itemUnits(item.itemKey)) ?? []).map(row => row?.unit) : [],
        )
      : [],
  );

// 숙제 연습(§21-6 · 검토 D3) — 이번 주 계획의 숙제 항목마다 하나(오늘 공부 칸). 후보는 그 항목의 처음 보는 짧은 연습 문항 가운데 돌아온 단위가
// 든 문항을 뺀 것이다 — 그 단위는 복습 칸의 짧은 연습이 맡는다(다음 레슨과 같은 거름, 20-13). 목표는 숙제 하나 { kind: homework, skill, status? }다 —
// 상태(missed)가 있을 때만 두뇌가 숙제 문장을 짓고, 도움받은 첫 만남만 있는 능력은 목표 수에만 센다. 쓰기 숙제는 짧은 연습이 없어 넘기지 않는다.
// 소리를 끈 날 듣기 숙제는 빼지 않고 잠근다(짧은 연습과 같은 거름 — blockedBy). fresh(item): 그 문항을 처음 보는가(묶음 만남의 seen === false).
export const HOMEWORK_PREFIX = 'world.homework.';
function homeworkActivities({ homework, pool, fresh, dueUnits, itemUnits, settings, labels, length }) {
  if (!Array.isArray(homework) || !Array.isArray(pool) || typeof fresh !== 'function') return [];
  const returned = key =>
    Boolean(dueUnits?.size) &&
    typeof itemUnits === 'function' &&
    (quiet(() => itemUnits(key)) ?? []).some(row => dueUnits.has(row?.unit));
  const out = [];
  for (const row of homework) {
    const skillId = row?.skillId;
    if (typeof skillId !== 'string' || !['listening', 'reading'].includes(row.domain)) continue;
    const listening = row.domain === 'listening';
    const items = pool.filter(
      item =>
        item?.skillId === skillId &&
        typeof item.itemKey === 'string' &&
        quiet(() => fresh(item)) === true &&
        !returned(item.itemKey),
    );
    const name = quiet(() => labels?.(skillId)) || skillId;
    const open = {
      id: `${HOMEWORK_PREFIX}${skillId}`,
      label: `${listening ? '듣기' : '읽기'} 짧은 연습 · ${name}`,
      route: 'practice',
      skillId,
      minutes: Math.max(2, Math.ceil(length * (listening ? 0.8 : 0.5))),
      minutesEstimated: true,
      supports: [...PRACTICE_SUPPORTS],
      audioRequired: listening,
      modality: listening ? 'listening' : 'reading',
      targets: [],
    };
    const goal = { kind: 'homework', skill: skillId, ...(typeof row.status === 'string' ? { status: row.status } : {}) };
    out.push(
      activity('new', open, { goals: [goal] }, items.map(item => ({ itemKey: item.itemKey })), settings, 'homework'),
    );
  }
  return out;
}

// 점검 칸의 짧은 진단(§21-6 · 20-2) — 이번 주 계획에 아직 하지 않은 다시 확인(시작점 포함)이 있고 진단이 낼 문항이 있을 때만이다. 진단은 문항
// 차례를 제품이 정하므로(§21-5) 후보 없이 넘기고, 이유는 두뇌의 설명 사실(host.start · host.recheck)이다. 여는 길은 내 위치의 짧은 진단이다.
const CHECK_OPEN = Object.freeze({
  id: 'world.position.check',
  label: '짧은 진단',
  route: 'position',
  minutes: 5,
  minutesEstimated: true,
  targets: Object.freeze([]),
  goals: Object.freeze(['exam', 'prepare']),
  audioRequired: false,
  modality: 'reading',
});
function checkActivity(week, settings) {
  const plan = week?.examPlan;
  const area = Array.isArray(plan?.areas) ? plan.areas.find(row => row?.area === 'recheck') : null;
  if (!area || !(area.remaining > 0) || week.diagnostic?.ready !== true) return null;
  const start = Array.isArray(plan.notes) && plan.notes.includes('start');
  return activity(
    'check',
    { ...CHECK_OPEN, targets: [], goals: [...CHECK_OPEN.goals] },
    { describe: start ? 'start' : 'recheck', goals: areaGoal(week, 'recheck') },
    [],
    settings,
    'check',
  );
}

// 점검 칸의 시험 형식 · 쓰기 · 말하기(4-4d — §21-23의 3, 설계 주인 11-17 답 3 · 4). 짧은 진단과 같이 후보 없이 넘기고, 이유는 두뇌의 설명
// 사실이다(시험 형식 host.form · 쓰기 host.writing · host.writing.start · 말하기 host.speaking · host.speaking.again). 칸이 있는 설명은
// { key, slots }로 넘기고, 칸의 꼴은 엔진의 칸 표 한 곳이 검사한다(제품은 표를 따로 들지 않는다 — 칸이 틀리면 그 줄의 이유가 비어 줄이 서지
// 않는다). 다음 영역의 목표({ kind: 'plan.area.<영역>' })와 한 가지 고치기의 목표({ kind: 'practiceNeed', id })는 이 넷에만 싣는다 — 오늘 공부 ·
// 복습 칸의 줄은 계획 목표가 있을 때와 없을 때 같다. 시험 형식 줄은 이번 주에 시험 형식 판을 하지 않았을 때만 선다(week.mock.done — 이 기기의
// 판 기록). 시험 형식에는 영역 목표가 없다(지금 판 planTokens와 같다 — 시험 형식은 이번 주 계획의 영역이 아니다).
const areaGoal = (week, area) =>
  week?.examPlan?.next?.area === area ? [{ kind: `plan.area.${area}` }] : [];
// 이번 주 계획에 그 영역의 몫이 남았나(설계 주인 11-17 다시 여쭘의 답 1 — 이레 측정에서 쓰기가 계획을 넘어 매일 서고 말하기 줄이 0번이었다).
// 쓰기 · 말하기 줄은 이 몫이 남았을 때만 넘긴다. 짧은 진단 · 시험 형식과 같은 「이번 주 몫」 규칙이다 — 점검 칸은 이번 주 계획에서 남은 몫을
// 보이는 자리라, 계획을 채운 영역이 날마다 서면 계획이 한 주의 양을 정한다는 원칙이 깨진다. 영역이 계획에 없으면 몫도 없다.
const areaLeft = (week, area) => {
  const row = Array.isArray(week?.examPlan?.areas) ? week.examPlan.areas.find(item => item?.area === area) : null;
  return Boolean(row) && row.remaining > 0;
};
// 보탬을 막는 몫(끝 판 검수 GE1 — 설계 주인 11-17 오후 답). 보탬은 넘길 점검 칸 활동(잠긴 것 포함)이 하나도 없고, 계획이 낸 넷(다시 확인 ·
// 시험 형식 · 쓰기 · 말하기)의 이번 주 남은 몫이 모두 0일 때만 선다. 넷을 고르게 본다. 몫이 남았는데 줄을 지을 수 없는 주(진단이 낼 문항이 없음 ·
// 시험 형식 판의 분을 읽지 못함 · 말하기 항목의 유형을 읽지 못함)에도 보탬은 서지 않는다. 시험 형식은 계획의 영역이 아니라서, 셸이 넘긴 판(week.mock
// — 고르기가 ready일 때만)이 있고 이번 주에 판을 하지 않았으면 몫이 남은 것으로 본다. 쓰기 항은 지금은 결과를 바꾸지 않는다(보탬도 쓰기 값이 있어야
// 서고, 그 값이 있으면 쓰기 몫이 남은 날 쓰기 줄이 넘어간다). 넷을 고르게 보려고 둔다.
// 소리를 끈 주에는 지금 판 계획이 소리가 필요한 영역(말하기 · 듣기)을 그 주의 몫으로 묻지 않는다(world-exam-plan.mjs — notes speaking-audio-off ·
// audio-off, 이미 정한 제품 동작이다). 그래서 소리 때문에 계획에서 빠진 말하기는 남은 몫이 아니고, 그날은 소리 없이 할 수 있는 쓰기 고치기가
// 보탬으로 선다. 「조건에 걸린 날 안내가 가려진다」(해석 1의 근거)는 계획에 몫이 남았는데 플래너가 조건으로 잠근 줄에만 맞는다. 잠긴 줄도 넘긴
// 줄이라 보탬을 막는다. 계획에서 빠진 말하기를 잠긴 줄로 되살리면 계획 화면과 홈이 서로 다른 말을 한다(설계 주인이 되돌리게 한 안 1).
const mockLeft = week => Boolean(week?.mock) && week.mock.done !== true;
const checkLeft = week =>
  areaLeft(week, 'recheck') || mockLeft(week) || areaLeft(week, 'writing') || areaLeft(week, 'speaking');
const MOCK_OPEN = Object.freeze({
  id: 'world.mock',
  label: '시험 형식 연습',
  route: 'mock',
  minutesEstimated: false,
  targets: Object.freeze([]),
  goals: Object.freeze(['exam', 'prepare']),
  modality: 'reading',
});
function mockActivity(week, settings) {
  const mock = week?.mock;
  if (!mock || mock.done === true || !Number.isFinite(mock.minutes)) return null;
  return activity(
    'check',
    {
      ...MOCK_OPEN,
      targets: [],
      goals: [...MOCK_OPEN.goals],
      minutes: mock.minutes,
      audioRequired: mock.audioRequired === true,
    },
    { describe: 'form' },
    [],
    settings,
    'check',
  );
}
function writingActivity(week, settings) {
  const writing = week?.writing;
  if (!writing || typeof writing.routeId !== 'string' || !areaLeft(week, 'writing')) return null;
  return writingLine(week, writing, settings);
}
// 보탬(설계 주인 11-17 다시 여쭘의 답 2) — 점검 칸 넷의 이번 주 몫이 모두 차 넘길 점검 칸 활동이 하나도 없는 날에만 부른다(아래 todayActivities).
// 넘길 줄이 조건에 걸려 잠긴 날과, 계획이 낸 넷의 몫이 남았는데 줄을 지을 수 없는 날에도 부르지 않는다(checkLeft). 이번 주 쓰기에서 열린 한 가지 고치기(그
// 고치기의 마지막 사건 needAt이 이번 주 계획의 주 안)가 아직 열려 있으면 그것을 한 줄로 세운다. 고쳐 쓰기의 효과는 첫 글을 쓴 바로 뒤에 가장
// 크고, 다음 주 계획까지 미루면 한 주쯤 식는다. 계획이 찬 뒤에는 첫 글(host.writing.start)이 서지 않으므로 고치기가 닫히면 더 열리지 않는다.
// 도움을 받아 고친 판(assisted)은 고치기가 아직 열린 것이라 「이번에는 혼자」 줄로 한 번 더 설 수 있다. 거듭 설 수 있는 상한은 계획 주의 끝이다
// (도움을 받아 다시 고치면 needAt이 옮겨 그 주 안에서는 다시 서고, 다음 계획 주에는 needAt이 지난주라 서지 않는다). 고친 판은 앱이 지금 세는
// 대로 쓰기 한 수에 든다(셈의 꼴은 그대로다).
function writingFixActivity(week, settings) {
  const writing = week?.writing;
  const bounds = week?.examPlan?.week;
  if (!writing?.need || typeof writing.routeId !== 'string' || !bounds) return null;
  const at = Date.parse(writing.needAt);
  if (!(at >= bounds.start && at < bounds.end)) return null;
  return writingLine(week, writing, settings);
}
function writingLine(week, writing, settings) {
  const facts = writing.need
    ? {
        describe: { key: 'writing', slots: { focus: writing.focus, need: writing.need } },
        goals: [...areaGoal(week, 'writing'), { kind: 'practiceNeed', id: writing.focus }],
      }
    : { describe: 'writing.start', goals: areaGoal(week, 'writing') };
  const open = {
    id: 'topik2-writing-53',
    label: writing.label,
    route: 'writing',
    routeId: writing.routeId,
    minutes: writing.minutes,
    minutesEstimated: true,
    targets: [],
    goals: ['exam', 'prepare', 'writing'],
    audioRequired: false,
    modality: 'writing',
  };
  return activity('check', open, facts, [], settings, 'check');
}
function speakingActivity(week, settings) {
  const speaking = week?.speaking;
  if (!speaking || typeof speaking.routeId !== 'string' || !areaLeft(week, 'speaking')) return null;
  const facts =
    speaking.untried > 0
      ? { describe: { key: 'speaking', slots: { type: speaking.type, untried: speaking.untried } }, goals: areaGoal(week, 'speaking') }
      : { describe: 'speaking.again', goals: areaGoal(week, 'speaking') };
  const open = {
    id: 'world.speaking.check',
    label: speaking.label,
    route: 'speaking',
    routeId: speaking.routeId,
    minutes: speaking.minutes,
    minutesEstimated: true,
    targets: [],
    goals: ['exam', 'prepare', 'speaking'],
    audioRequired: true,
    modality: 'speaking',
  };
  return activity('check', open, facts, [], settings, 'check');
}
// 같은 자리일 때의 제품 차례(설계 주인 11-17 답 3) — 짧은 진단은 이번 주 계획에 다시 확인이 남았을 때만 서므로 늘 앞을 차지하지 않는다.
export const CHECK_ORDER = Object.freeze(['world.position.check', 'world.mock', 'topik2-writing-53', 'world.speaking.check']);

// 홈 계획에 넘길 활동(§20-2 표). engine: 엔진 판정이 선 때만 엔진에 기대는 활동(생활 복습 · 짧은 연습)을 넘긴다 — 확인 중에는 제품 사실로
// 말할 수 있는 활동(하던 것 · 한글 먼저 · 다음 레슨)만이다(설계 검토 H8 · H12).
//   snapshot — 생활 진도 exportSnapshot() · life — 진도 요약(summary(PACKS, LESSONS) — nextLesson) · judged — 생활 판정(lifeDue)
//   dueUnits — 홈 코치 due()의 단위들(Set) · itemUnits(itemKey) — 홈 코치 itemUnits
export function todayActivities({
  snapshot = {},
  life = null,
  judged = null,
  settings = {},
  now = Date.now(),
  answers = null,
  openGames = null,
  pool = [],
  practiceLength = 5,
  labels = null,
  dueUnits = null,
  itemUnits = null,
  engine = false,
  // 이번 주 계획(4-4b) — { examPlan(world-plan-next buildPlanNext), fresh(item), diagnostic: { ready } }. 시험을 고르지 않았거나 확인 중이면 null.
  week = null,
  // 홈의 게임 목록(4-6e-1 — world-home-games.mjs homeGames의 값). 없으면 게임 줄이 없다.
  games = null,
} = {}) {
  const values = settings ?? {};
  const normalized = worldLearningSettings(values);
  const told = answersOf(answers);
  const out = [];
  // 하던 레슨 · 하던 복습 — 후보 없이 사실로(설계 검토 H4)
  const resumes = resumeCandidates(snapshot, values, now);
  for (const open of resumes)
    out.push(
      activity(open.route === 'review' ? 'again' : 'new', open, { resume: true }, [], normalized),
    );
  const resumingReview = resumes.some(open => open.route === 'review');
  const resumedLesson = resumes.find(open => open.route === 'lesson')?.lessonId ?? null;
  // 생활 복습 — lifeDue가 낸 복습 모두를 한 활동으로(차례 그대로, M8 · 설계 검토 H21). 엔진 판정이 선 때만.
  const items = engine && judged?.state === 'engine' && Array.isArray(judged.items) ? judged.items : [];
  // 그날 생활 복습 후보 — 그 문항의 단위는 게임이 맡지 않는다(아래 gameActivities). 하던 복습이 있어 생활 복습 줄을 넘기지 않는 날도 그 복습이 맡는다.
  const lifeOpen = items.length
    ? lifeReviewCandidate(
        items.map(item => item.id),
        snapshot,
        values,
        now,
      )
    : null;
  if (items.length && !resumingReview) {
    const open = lifeOpen;
    const fact = reviewFact(items);
    if (open)
      out.push(
        activity('again', open, fact ? { review: fact } : {}, itemsOf(open.targets), normalized),
      );
  }
  // 다음 생활 레슨 하나 — 허브 「지금 할 일」과 같은 레슨(진도 요약의 nextLesson, 설계 주인 11-15 · 검토 H14의 (나)). 돌아온 단위가 든
  // 문항은 후보에서 뺀다 — 그 단위는 복습 줄이 맡고(설계 검토 H21), 그 문항 때문에 레슨이 돌아온 층(1)이 되어 할 것의 수로 생활 복습을
  // 앞지르지 않게 한다(지금 판이 복습이 기다리는 동안 레슨에 겨눌 문항을 싣지 않는 것 — life-plan.mjs reviewWaiting — 과 같은 뜻).
  const nextId = life?.nextLesson?.id ?? null;
  if (nextId && nextId !== resumedLesson) {
    const base = lifeLessonCandidate(nextId, values);
    if (base) {
      const open = withAnswers(base, told);
      const returned = key =>
        Boolean(dueUnits?.size) &&
        typeof itemUnits === 'function' &&
        (quiet(() => itemUnits(key)) ?? []).some(row => dueUnits.has(row?.unit));
      out.push(
        activity(
          'new',
          open,
          { describe: 'next', goals: goalsOf(open, normalized) },
          itemsOf(open.targets).filter(item => !returned(item.itemKey)),
          normalized,
        ),
      );
    }
  }
  // 한글 먼저 — 「아직 못 읽어요」를 고른 학생, 한글 만나기를 열 수 있을 때만(소리를 끈 날 · 손님에게 닫힌 때는 잠김, 설계 검토 H15)
  if (snapshot?.hangul?.answer === 'new') {
    const open = buildWorldLearningCandidates({
      progress: snapshot,
      settings: values,
      now,
      openGames,
    }).find(candidate => candidate.id === HANGUL_ID);
    if (open) out.push(activity('new', open, { prerequisite: true }, [], normalized));
  }
  // 짧은 연습 — 복습으로만 줄이 된다(§20-2)
  if (engine)
    out.push(
      ...practiceActivities({
        pool,
        dueUnits,
        itemUnits,
        settings: normalized,
        labels,
        length: Number.isInteger(practiceLength) && practiceLength > 0 ? practiceLength : 5,
      }),
    );
  // 게임 — 복습 칸에만, 생활 복습과 짧은 연습이 싣지 않은 돌아온 단위로(§25-1).
  if (engine)
    out.push(
      ...gameActivities({
        games,
        dueUnits,
        itemUnits,
        settings: normalized,
        taken: { life: unitsOfItems(itemsOf(lifeOpen?.targets), itemUnits), practice: unitsOfItems(pool, itemUnits) },
      }),
    );
  // 이번 주 계획(4-4b): 숙제 연습(오늘 공부)과 점검 칸의 짧은 진단 — 엔진 판정이 선 때만(계획은 새 칸으로 짓는다).
  if (engine && week?.examPlan) {
    out.push(
      ...homeworkActivities({
        homework: week.examPlan.homework,
        pool,
        fresh: week.fresh,
        dueUnits,
        itemUnits,
        settings: normalized,
        labels,
        length: Number.isInteger(practiceLength) && practiceLength > 0 ? practiceLength : 5,
      }),
    );
    const checks = [
      checkActivity(week, normalized),
      mockActivity(week, normalized),
      writingActivity(week, normalized),
      speakingActivity(week, normalized),
    ].filter(Boolean);
    // 보탬 — 넘길 점검 칸 활동이 하나도 없고 계획이 낸 넷의 몫도 모두 찬 날에만(설계 주인 11-17 다시 여쭘의 답 2 · 위 writingFixActivity · checkLeft).
    // 다른 줄이 하나라도 넘어가는 날(잠긴 줄 포함), 몫이 남았는데 넘길 줄이 없는 날에는 서지 않는다(끝 판 검수 GE1).
    if (checks.length === 0 && !checkLeft(week)) checks.push(writingFixActivity(week, normalized));
    for (const check of checks) if (check) out.push(check);
  }
  return out;
}

// 확인 중의 차례 — 엔진 없이 제품 사실로만: 하던 것 → 한글 먼저 → 다음 레슨(두뇌 PLAN_FACTS의 차례와 같다).
const CHECKING_CODES = Object.freeze({
  resume: 'host.resume',
  prerequisite: 'host.prerequisite',
  next: 'host.next',
});
// 계획이 넘긴 활동(act.role — 숙제 연습 · 점검 칸)은 엔진 판의 두뇌만 줄로 세운다. 확인 중 판에 내려오면 그 활동의 설명(describe)을 「다음
// 레슨」 문장으로 잘못 읽으니 뺀다(끝 판 F10 — plan()이 던지는 가정한 장애에서 점검 칸 활동이 host.next 줄로 섰다).
function checkingEntries(activities, say) {
  const rank = act =>
    act.plan.facts.resume ? 0 : act.plan.facts.prerequisite ? 1 : act.plan.facts.describe ? 2 : 3;
  return activities
    .filter(act => !act.role && rank(act) < 3)
    .sort((a, b) => rank(a) - rank(b))
    .map(act => {
      const fact = act.plan.facts.resume
        ? 'resume'
        : act.plan.facts.prerequisite
          ? 'prerequisite'
          : 'next';
      const code = CHECKING_CODES[fact];
      const why = { code, slots: {}, evidence: fact === 'next' ? { fact: 'describe', describe: 'next' } : { fact } };
      return {
        id: act.plan.id,
        locked: Boolean(act.blocked),
        fact: fact === 'next' ? -1 : 0,
        tier: 9,
        offered: 0,
        idle: false,
        none: true,
        capped: false,
        why: { ...why, line: quiet(() => say(why)) },
      };
    });
}

const NEXT_WHY = Object.freeze({
  code: 'host.next',
  slots: Object.freeze({}),
  evidence: Object.freeze({ fact: 'describe', describe: 'next' }),
});

// 게임 줄의 이유(4-6e-1 — 설계 주인 11-23 GB2 결정). 두뇌는 후보 문항의 모든 단위로 이유를 지으므로, 다른 활동 몫(짧은 연습 · 생활 복습 · 앞
// 게임)의 단위를 함께 실은 문항이면 그 단위의 이름을 말한다. 줄의 말은 그 줄이 맡은 단위(act.assigned)로만 짓는다 — 두뇌의 이유가 맡은 단위를
// 가리키면 그대로 쓰고, 아니면 맡은 단위 가운데 이름이 있는 첫 단위로 두뇌 dueReason과 같은 꼴(놓친 적이 있으면 unit.shaky, 없으면 unit.due)을
// 코치 due()의 값으로 다시 짓는다. 이름은 코치 itemUnits의 이름을 say의 둘째 인자(단위 → 이름)로 넘긴다. 이름 있는 맡은 단위가 없거나 문장을 짓지
// 못하면 단위 이름 없는 게임 줄이다 — 다른 활동 몫의 이름을 빌리지 않는다. 두뇌와 문항 고르기는 그대로다.
const GAME_NAMELESS = Object.freeze({
  ko: '게임에서 만난 말이 돌아왔어요. 잊기 전에 한 번 더 만나요.',
  en: 'Something you met in a game is back. Let’s review it once more before it fades.',
  mn: 'Тоглоомд үзсэн үг хэллэг эргэн ирлээ. Мартахаасаа өмнө дахин нэг давтъя.',
});
const dueWhy = row => {
  const evidence = { sittings: row.sittings ?? 0, lapses: row.lapses ?? 0 };
  return row.lapses > 0
    ? { code: 'unit.shaky', slots: { unit: row.unit, misses: row.lapses, reviews: row.sittings, days: row.days }, evidence }
    : { code: 'unit.due', slots: { unit: row.unit, days: row.days }, evidence };
};
function gameWhy(entry, act, { say, due, lang }) {
  // 손으로 지은 활동(맡은 단위를 들지 않음 — todayRows만 부르는 시험)은 두뇌의 이유 그대로다. 홈의 게임 활동은 늘 맡은 단위를 든다.
  if (!Array.isArray(act.assigned)) return entry.why;
  if (entry.why?.line && act.assigned.some(row => row.unit === entry.why.slots?.unit)) return entry.why;
  const rows = due instanceof Map ? due : new Map();
  const mine = act.assigned.filter(row => rows.has(row.unit));
  if (!mine.length) return null;
  const named = mine.find(row => typeof row.label === 'string' && row.label.trim());
  const why = dueWhy(rows.get((named ?? mine[0]).unit));
  const line = named ? quiet(() => say(why, id => (id === named.unit ? named.label : null))) : null;
  return { ...why, line: line || (Object.hasOwn(GAME_NAMELESS, lang) ? GAME_NAMELESS[lang] : GAME_NAMELESS.ko) };
}

// 한 줄 — 그 활동이 줄이 되는가, 되면 그 이유(§20-2 · §20-3). 이유 문장이 없으면 줄이 아니다.
function rowWhy(entry, act, { capped, say, due, lang }) {
  const open = act.open;
  if (entry.locked) return null;
  if (open.resume || open.id === HANGUL_ID) return entry.why;
  // 점검 칸의 짧은 진단은 제품이 차례를 정한다 — 후보 없이 넘겨 none이어도 줄이다(다음 레슨과 같다). 이유는 설명 사실의 문장이다.
  if (act.role === 'check') return entry.why;
  // 숙제 연습은 낼 후보가 있을 때만 줄이다(none도 locked도 아님 — 층이나 숙제 문장으로 가르지 않는다, 설계 검토 A9). 상한 날에도 줄이다 —
  // 상한은 복습만 미룬다(20-3). 맨 앞 층이 9인데 두뇌가 숙제 문장을 내는 날(진단 직후 새 단위 한도 — 21-5)은 줄이 서지 않는다.
  if (act.role === 'homework') return entry.none ? null : entry.why;
  if (open.route === 'lesson') {
    // 다음 레슨은 채우기여도 줄이다. 맨 앞 줄이 새것일 때만 엔진의 문장이고, 그 밖에는 기록을 말하지 않는 다음 레슨 문장이다 —
    // 돌아온 단위는 복습 줄이 맡는다(설계 검토 H21).
    if (entry.why?.code === 'unit.new' && entry.why.line) return entry.why;
    return { ...NEXT_WHY, line: quiet(() => say(NEXT_WHY)) };
  }
  // 상한 날 홈은 복습을 권하지 않는다(①과 ②도 — 설계 주인 11-15 조건 3). 낼 것이 없는 복습은 줄이 아니다(새 단위 한도로 막힌 다리 포함).
  if (capped || entry.none) return null;
  if (open.id === LIFE_REVIEW_ID) return entry.fact >= 0 || entry.tier <= 2 ? entry.why : null;
  if (open.route === 'practice') return entry.tier === 1 ? entry.why : null;
  // 숙제가 아닌 게임은 짧은 연습과 같다 — 맨 앞 층이 1일 때만 줄이고, 이유는 맡은 단위의 문장(unit.due 등 — gameWhy)이라 자리를 말하지 않는다(§25-1).
  if (open.route === 'game') return entry.tier === 1 ? gameWhy(entry, act, { say, due, lang }) : null;
  return null;
}

// 세 줄 — plan()의 차례 그대로, 칸마다 한 줄. opened: 이번 학습일에 이 문서에서 연 칸.
// 점검 칸 넷이 두뇌에서 같은 자리(잠김 · 앞지른 사실 · 층 · 맞춘 목표 수 · 할 것)이면 제품 차례(CHECK_ORDER)로 다시 가른다(설계 주인 11-17 답 3).
// 두뇌의 차례는 그대로 두고, 점검 칸 항목들이 앉은 자리 안에서만 그 차례를 바꾼다 — 다른 칸의 줄은 움직이지 않는다.
const brainKey = entry => [
  Number(Boolean(entry.locked)),
  entry.fact < 0 ? Number.POSITIVE_INFINITY : entry.fact,
  entry.tier,
  -(entry.goals ?? 0),
  -(entry.todo ?? 0),
];
const checkRank = entry => {
  const at = CHECK_ORDER.indexOf(entry.id);
  return at < 0 ? CHECK_ORDER.length : at;
};
// 점검 칸의 차례 돌리기(설계 주인 11-17 저녁 — 끝 판 F16의 답 1). 늘어놓은 줄 가운데 잠기지 않은 줄 n개에서 오늘의 줄은 shift mod n번째다
// (shift는 아래 checkShift). 잠긴 줄은 돌리지 않고 뒤에 둔다 — 조건에 걸린 날의 규칙은 그대로다.
function checkOrdered(entries, byId, shift = 0) {
  const isCheck = entry => byId.get(entry?.id)?.role === 'check';
  const checks = entries.filter(isCheck);
  if (checks.length < 2) return entries;
  const sorted = [...checks].sort((a, b) => {
    const x = brainKey(a);
    const y = brainKey(b);
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
    return checkRank(a) - checkRank(b);
  });
  const open = sorted.filter(entry => !entry.locked);
  const turn = open.length > 1 ? shift % open.length : 0;
  const turned = [...open.slice(turn), ...open.slice(0, turn), ...sorted.filter(entry => entry.locked)];
  let next = 0;
  return entries.map(entry => (isCheck(entry) ? turned[next++] : entry));
}
// 밀린 날 수(설계 주인 11-17 저녁 답 1). 상태를 새로 저장하지 않고, 계획과 셸이 이미 가진 값으로만 센다. k = 「오늘이 이번 계획 주의 몇째
// 학습일인가 − 1」 − 「이번 주 점검 칸 넷에서 한 수의 합」(0 밑은 0). 한 수는 다시 확인을 끝낸 수(계획의 recheck done), 시험 형식 판의 수(셸이 넘기는
// week.mockDone — 이 기기의 판 기록이라 그만둔 판도 센다), 쓰기 · 말하기 수(계획의 writing · speaking done — 배우기 허브에서 한 것도 기기 기록이라
// 센다)다. 계획 주는 한국 시각 월요일 0시부터 이레이고(world-exam-plan.mjs examWeek) 학습일은 기기 현지 새벽 4시가 경계라(todayKey), 계획 주의
// 월요일을 1째 날로 센다. 주의 시작이나 한 수 값을 하나라도 읽지 못하면 0이다(지금 차례 그대로). 줄을 따르는 학생은 날마다 한 수씩 늘어 늘 0이다.
const KST_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
function checkShift(week, now) {
  const plan = week?.examPlan;
  const start = plan?.week?.start;
  const mock = week?.mockDone;
  if (!Number.isFinite(start) || !Array.isArray(plan?.areas) || !Number.isSafeInteger(mock) || mock < 0) return 0;
  let done = mock;
  for (const area of ['recheck', 'writing', 'speaking']) {
    const row = plan.areas.find(item => item?.area === area);
    const value = row ? row.done : 0;
    if (!Number.isSafeInteger(value) || value < 0) return 0;
    done += value;
  }
  const monday = new Date(start + KST_MS);
  const first = Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
  const at = new Date(now);
  if (at.getHours() < DAY_START_HOUR) at.setDate(at.getDate() - 1);
  const day = Math.round((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - first) / DAY_MS) + 1;
  return Math.max(0, day - 1 - done);
}

// 복습 칸의 게임 뒤로 보내기(4-6e-1 — §25-1). 두뇌는 잠김 · 사실 · 층 · 목표 수 · 할 것의 수가 같으면 활동 id의 사전 순으로 가르는데,
// world.play.*가 world.practice.* · world.review.life보다 앞이라 그 차례에는 뜻이 없다. 할 것의 수도 겨룸이 되지 못한다 — 두뇌는 문항을 세고,
// 짧은 연습은 항목마다 활동이 나뉘지만 게임은 활동 하나에 맡은 단위를 모두 싣는다. 그래서 복습 칸 항목 가운데 잠김 · 사실 · 층이 같은 것 안에서
// 게임 항목을 생활 복습과 짧은 연습 뒤로 보낸다(목표 수와 할 것의 수는 보지 않는다). checkOrdered와 같은 짜임으로, 그 항목들이 앉은 자리
// 안에서만 차례를 바꾼다 — 생활 복습과 짧은 연습 사이의 차례는 두뇌 차례 그대로다(4-3의 장면 값).
function gamesBehind(entries, byId) {
  const isGame = entry => byId.get(entry?.id)?.open?.route === 'game';
  const groups = new Map();
  entries.forEach((entry, at) => {
    if (byId.get(entry?.id)?.kind !== 'again') return;
    const [locked, fact, tier] = brainKey(entry);
    const key = `${locked}|${fact}|${tier}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(at);
  });
  const out = [...entries];
  for (const places of groups.values()) {
    const members = places.map(at => entries[at]);
    if (!members.some(isGame)) continue;
    const ordered = [...members.filter(entry => !isGame(entry)), ...members.filter(isGame)];
    places.forEach((at, i) => {
      out[at] = ordered[i];
    });
  }
  return out;
}

// due: 코치 due()의 줄(단위 → 줄, Map) · lang: 화면 언어 — 게임 줄의 이유를 맡은 단위로 지을 때 쓴다(gameWhy).
export function todayRows({ entries = [], activities = [], opened = new Set(), say = () => null, dayCapped, shift = 0, due = null, lang = 'ko' } = {}) {
  const byId = new Map(activities.map(act => [act.plan.id, act]));
  entries = gamesBehind(checkOrdered(Array.isArray(entries) ? entries : [], byId, shift), byId);
  // 하루 복습 상한(§20-3): plan 쪽 칸(dayCapped — plan 머리에서 한 번 센 엔진 전체의 값)을 먼저 읽는다(설계 주인 11-15, §20-14). 그 칸이 없는
  // 옛 엔진이면 어느 항목의 capped로든 읽는다. 생활 복습 항목만 보면 생활 복습 없이 짧은 연습이나 다음 레슨만 있는 상한 날을 「다 만났어요」로
  // 잘못 말한다(끝 판 GB1).
  const capped = typeof dayCapped === 'boolean' ? dayCapped : entries.some(entry => Boolean(entry?.capped));
  const rows = [];
  const taken = new Set();
  for (const entry of entries) {
    const act = byId.get(entry.id);
    if (!act || taken.has(act.kind)) continue;
    const why = rowWhy(entry, act, { capped, say, due, lang });
    if (!why?.line) continue;
    taken.add(act.kind);
    rows.push({
      kind: act.kind,
      activityId: act.plan.id,
      route: act.open.route,
      title: act.open.label,
      why: { code: why.code, slots: why.slots ?? {}, evidence: why.evidence ?? {}, text: why.line },
      minutes: act.open.minutes,
      open: act.open,
      opened: opened.has(act.kind),
    });
  }
  return { rows, capped };
}

// 단추가 지금 열 줄(§20-8) — 하던 것 줄은 건너뛰지 않고, 그 밖에는 이번 학습일에 아직 열지 않은 칸의 첫 줄, 다 열었으면 다시 첫 줄부터다.
export function pickRow(rows, opened = new Set()) {
  return (
    rows.find(row => row.open.resume) ?? rows.find(row => !opened.has(row.kind)) ?? rows[0] ?? null
  );
}

// 홈 계획 한 번 — 지금 판의 꼴(selected · reason · resume · status · candidates · examPlan)에 today를 더한다(§20-1 · §20-9).
//   coach — 자리를 잡은 홈 코치(엔진) 또는 null(확인 중) · progress — 생활 진도 · say(why, label?) — 화면 언어의 Vellum 문장(label은 단위 → 이름 —
//   셸 이름표보다 먼저 쓴다, 게임 줄의 이유가 맡은 단위의 이름을 넘긴다)
export function createWorldTodayPlan({
  coach = null,
  progress = null,
  judged = null,
  settings = {},
  now = Date.now(),
  answers = null,
  openGames = null,
  pool = [],
  practiceLength = 5,
  labels = null,
  opened = new Set(),
  lang = 'ko',
  say = () => null,
  week = null,
  // 홈의 게임 목록(4-6e-1). 주지 않으면 지금 값으로 짓는다(homeGames — gameStorage는 저장한 환승 난도를 읽을 저장소로, 시험이 넘긴다).
  games,
  gameStorage,
} = {}) {
  // 생활 판정이 아직 확인 중이면 홈도 확인 중이다 — 홈 코치가 섰어도 엔진에 기대는 줄을 그리지 않는다(설계 검토 H12).
  const engine = Boolean(coach) && typeof coach.plan === 'function' && judged?.state === 'engine';
  const snapshot = quiet(() => progress?.exportSnapshot?.()) ?? {};
  const life = quiet(() => progress?.summary?.(PACKS, LESSONS)) ?? null;
  const due = engine ? quiet(() => coach.due()) : null;
  const dueUnits = Array.isArray(due) ? new Set(due.map(row => row?.unit).filter(Boolean)) : null;
  const activities = todayActivities({
    snapshot,
    life,
    judged,
    settings,
    now,
    answers,
    openGames,
    pool,
    practiceLength,
    labels,
    dueUnits,
    itemUnits: engine ? key => coach.itemUnits(key) : null,
    engine,
    week: engine ? week : null,
    games: engine
      ? (games ??
        quiet(() =>
          homeGames({ progress: snapshot, settings, now, openGames, ...(gameStorage !== undefined ? { storage: gameStorage } : {}) }),
        ))
      : null,
  });
  // 엔진 판에서 plan()이 실패하면(가정한 장애) 확인 중 판으로 내려 제품 사실 줄만 그린다 — 빈 목록으로 읽으면 다음 레슨이 남았는데 다 한 날이
  // 된다(엔진급 끝 판 F3).
  const planned = engine ? quiet(() => coach.plan(activities.map(act => act.plan), { lang })) : null;
  const live = engine && Array.isArray(planned);
  const entries = live ? planned : checkingEntries(activities, say);
  const shift = live && week ? checkShift(week, now) : 0;
  const dueRows = Array.isArray(due) ? new Map(due.filter(row => typeof row?.unit === 'string').map(row => [row.unit, row])) : null;
  const { rows, capped } = todayRows({ entries, activities, opened, say, dayCapped: live ? planned.capped : undefined, shift, due: dueRows, lang });
  const selected = pickRow(rows, opened);
  const checking = !live;
  const cappedText = capped ? quiet(() => say({ code: 'day.capped', slots: {} })) : null;
  // 조건에 걸린 날(blocked)은 걸린 활동이 풀리면 줄이 되는 때다. 상한 날의 복습 칸 활동(하던 것 밖)은 풀려도 줄이 아니라 그날의 까닭은 상한이다.
  // 판(status) · 이유 · 빈 날 코드는 한 차례(확인 중 → 조건 → 상한 → 다 한 날)로 정한다(엔진급 끝 판 F5).
  // 조건에 걸린 숙제 연습(설계 검토 A10 · 4-4b 끝 판 F2): 두뇌는 잠근 활동에 층을 셈하지 않으므로, 조건에 걸린 날로 세기 전에 그
  // 활동만 풀어 한 번 더 셈한다(plan은 보기만 읽는다). 조건을 풀어도 낼 것이 없으면(처음 보는 문항이 없음 · 새 단위 한도에 막힘) 조건에 걸린 날이
  // 아니라 낼 것이 없는 날이다. 소리만이 아니라 시간 · 도움 방식 조건도 같다 — 소리만 보던 판은 3 · 5분 설정에서 낼 문항이 없는 숙제를 「시간이나
  // 소리 설정을 바꿔 볼 수 있어요」로 셌는데, 시간을 바꿔도 줄은 서지 않았다.
  const dry = new Set();
  if (live)
    for (const act of activities) {
      if (act.role !== 'homework' || !act.blocked || !act.unlocked) continue;
      const again = quiet(() => coach.plan([act.unlocked], { lang }));
      if (Array.isArray(again) && again[0]?.none) dry.add(act.plan.id);
    }
  const blocked = activities.some(
    act => act.blocked && !dry.has(act.plan.id) && !(capped && act.kind === 'again' && !act.open.resume),
  );
  const firstDay =
    !Object.values(snapshot.lessons ?? {}).some(run => Number.isFinite(run?.completedAt)) &&
    !Object.keys(snapshot.reviews ?? {}).length;
  const status = rows.length ? 'ready' : checking ? 'checking' : blocked ? 'unavailable' : 'empty';
  // 다시 그리는 때(설계 검토 H22): 생활 판정이 아는 앞으로 열릴 때(times — ①이 열림 · 다리 · 돌아올 단위) 가운데 가장 이른 것과 다음 학습일.
  // nextAt만 보면 열린 복습이 있는 동안 비어 있어(「지금 열 것이 없을 때」의 값) 그 사이 ①이 열리는 때를 놓친다.
  const upcoming = (Array.isArray(judged?.times) ? judged.times : [judged?.nextAt]).filter(
    at => Number.isFinite(at) && at > now,
  );
  // 이번 주 계획의 주가 바뀌는 때(한국 시각 월요일 0시 — examWeek)에도 다시 그린다. 학습일(기기 현지 새벽 4시)만 보면 시간대가 다른 기기에서
  // 새 주의 점검 칸이 다음 학습일까지 지난주 완료로 남는다(5-3 전 고침 GI1 — 로스앤젤레스는 일요일 07:00에 주가 바뀐다).
  const weekEnd = live ? week?.examPlan?.week?.end : null;
  const redraw = [...upcoming, nextDayStart(now), weekEnd].filter(at => Number.isFinite(at) && at > now);
  return {
    status,
    selected: selected?.open ?? null,
    selectedKind: selected?.kind ?? null,
    reason: selected ? selected.why.text : status === 'unavailable' ? NO_FIT : '',
    resume: selected?.open?.resume ? selected.open : null,
    candidates: activities.map(act => act.open),
    // 이번 주 계획(4-4b) — 엔진 판이고 시험을 고른 학생만. 확인 중이면 싣지 않는다(새 칸이 자리를 잡기 전이다).
    examPlan: live ? (week?.examPlan ?? null) : null,
    today: {
      items: rows,
      minutes: rows.reduce((sum, row) => sum + (Number.isFinite(row.minutes) ? row.minutes : 0), 0),
      line: null,
      empty: rows.length
        ? null
        : {
            // 조건에 걸린 날(blocked)은 다 한 날이 아니다 — 홈 단추는 지금 판처럼 학습 조건으로 간다(§20-8). 조건이 상한보다 앞이다 — 걸린 활동은
            // 조건을 바꾸면 줄이 되고, 상한은 복습만 미룬다(위 blocked · 엔진급 끝 판 F5).
            code: checking ? 'checking' : blocked ? 'blocked' : capped ? 'day.capped' : 'done',
            text: !checking && !blocked && capped ? cappedText : null,
          },
      capped,
      cappedText,
      firstDay,
      state: checking ? 'checking' : 'engine',
      redrawAt: redraw.length ? Math.min(...redraw) : null,
    },
    learningEffectClaim: false,
    abilityClaim: false,
    grade: null,
  };
}

// ── 판 셋(§20-4) ──
// 홈은 생활 판정(watchLifeDue)의 판을 따른다 — 생활이 지금 판이면 지금 판, 생활이 확인 중이면 확인 중(설계 검토 H12). 생활이 엔진이면 홈 코치를
// 열고, 그 요약이 이 기기에서 자리를 잡으면 엔진이다. 홈 코치만 못 받으면 지금 판으로 내려가지 않고 확인 중에 머물며, 간격을 늘려 다시 연다
// (한 문서에서 홈은 옛 Core, 생활은 엔진이 되는 일을 막는다 — 설계 검토 H11). 홈 코치가 닫히면(retired) 확인 중으로 돌아가 다시 연다.
// 다시 묻기는 생활 판정이 한다(입구의 reopened · 화면이 코치를 청할 때 — refresh마다 묻지 않는다, 설계 검토 H10).
export function watchHomePlan({
  open,
  retired = () => () => {},
  lifeState = () => 'checking',
  onChange = () => {},
  every = 3000,
  most = 60_000,
  timers = globalThis,
} = {}) {
  let coach = null;
  let opening = null;
  let generation = 0;
  let disposed = false;
  let unwatch = () => {};
  let settleTimer = null;
  let offSettle = null; // 자리를 잡기를 기다리는 동안 건 받기 알림의 되돌림(D7)
  let retryTimer = null;
  let redrawTimer = null;
  let settleWait = every;
  let retryWait = every;
  const settled = summary => summary?.storage?.base === true && summary.storage.waiting !== true;
  const changed = () => {
    if (!disposed) quiet(onChange);
  };
  const clear = timer => {
    if (timer) quiet(() => timers.clearTimeout(timer));
    return null;
  };

  function drop() {
    generation += 1;
    quiet(unwatch);
    unwatch = () => {};
    coach = null;
    opening = null;
    stopSettle();
  }
  function stopSettle() {
    settleTimer = clear(settleTimer);
    if (typeof offSettle === 'function') quiet(offSettle);
    offSettle = null;
  }
  function attach() {
    if (disposed || coach || opening || retryTimer) return;
    const at = ++generation;
    opening = Promise.resolve()
      .then(() => open())
      .catch(() => null)
      .then(made => {
        if (disposed || at !== generation) return;
        opening = null;
        if (!made || typeof made.plan !== 'function') {
          retryTimer = timers.setTimeout(() => {
            retryTimer = null;
            changed();
          }, retryWait);
          retryWait = Math.min(most, retryWait * 2);
          return;
        }
        retryWait = every;
        coach = made;
        unwatch =
          quiet(() =>
            retired(made, () => {
              if (disposed || at !== generation) return;
              drop();
              changed();
            }),
          ) ?? (() => {});
        changed();
      });
  }
  function settle() {
    if (settleTimer || offSettle || disposed || !coach) return;
    // 받기 알림 — 요약이 자리를 잡기를 받기 알림으로 기다린다. 첫 받기 · 받기 사다리의 늦은 칸에서 자리를 잡으면 곧 다시 그린다(받기 알림 설계 검토
    // D7 — 단계 4 계획 §21-20). 알림을 걸면 타이머를 두지 않는다 — 타이머를 남기면 길이 다시 둘이 된다(설계 주인 11-16 저녁 조건 4). 자리를 잡으면
    // 듣기를 그치고, 그 뒤의 알림은 셸이 듣는다(hearHome). 받기 알림이 없는 코치만 타이머로 기다린다(3초부터 두 배씩, 60초까지).
    // 다시 그리기는 알림을 받은 자리가 아니라 다음 차례(마이크로태스크)로 미룬다 — 셸의 받기 알림과 같은 규칙이다(§21-20 조건 3 · 4-4b 다시 검수 -d P3).
    const made = coach;
    const at = generation;
    offSettle = quiet(() =>
      typeof made.watch === 'function'
        ? made.watch(() => {
            if (disposed || at !== generation || coach !== made) return;
            if (!settled(quiet(() => made.summary()))) return;
            stopSettle();
            settleWait = every;
            queueMicrotask(() => {
              if (!disposed && at === generation && coach === made) changed();
            });
          })
        : null,
    );
    if (typeof offSettle === 'function') return;
    offSettle = null;
    settleTimer = timers.setTimeout(() => {
      settleTimer = null;
      if (disposed || !coach) return;
      if (settled(quiet(() => coach.summary()))) {
        stopSettle();
        settleWait = every;
        changed();
      } else {
        settleWait = Math.min(most, settleWait * 2);
        settle();
      }
    }, settleWait);
  }
  function phase() {
    if (disposed) return 'old';
    const life = quiet(lifeState);
    if (life === 'old' || life === 'disposed') return 'old';
    if (life !== 'engine') return 'checking';
    if (!coach) {
      attach();
      return 'checking';
    }
    if (!settled(quiet(() => coach.summary()))) {
      settle();
      return 'checking';
    }
    return 'engine';
  }
  return Object.freeze({
    phase,
    coach: () => (phase() === 'engine' ? coach : null),
    // 다음에 다시 그릴 때(①이 열리는 때 · 새벽 4시 — 설계 검토 H22). 걸어 둔 것은 하나뿐이다.
    redrawAt(at) {
      redrawTimer = clear(redrawTimer);
      if (disposed || !Number.isFinite(at)) return;
      const delay = Math.min(Math.max(1000, at - Date.now()), 2_147_000_000);
      redrawTimer = timers.setTimeout(() => {
        redrawTimer = null;
        changed();
      }, delay);
    },
    // 코치를 내려놓고 다음 물음에서 다시 연다 — 은행이 늦게 와 은행 없이 연 코치를 바꿀 때(엔진급 끝 판 F2). 기다리던 다시 열기도 지운다.
    reopen() {
      if (disposed) return;
      retryTimer = clear(retryTimer);
      retryWait = every;
      drop();
      changed();
    },
    dispose() {
      disposed = true;
      drop();
      retryTimer = clear(retryTimer);
      redrawTimer = clear(redrawTimer);
    },
  });
}
