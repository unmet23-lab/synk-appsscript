// Atlas 새 길의 WORLD 홈(재설계 단계 4-3 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §20). 셸은 이 파일을 부르지 않는다 —
// 입구(world-atlas-next.mjs)가 정적으로 받아 홈 플래너로 넘기고, 셸은 입구를 기능이 켜졌을 때만 동적 import로 부른다. 그래서 꺼진 판의
// 첫 화면 · 계정 묶음 · 생활 단독 묶음에는 실리지 않는다(설계 주인 11-15 · 설계 검토 H19).
// 홈의 추천은 드라마 「오늘」 한 장과 같은 세 줄(복습 again · 오늘 공부 new · 점검 check)이다. 엔진의 plan()이 낸 차례를 바꾸지 않고
// 활동마다 칸 하나를 정해, 칸마다 맨 앞 활동 하나만 줄로 세운다(§20-2). 줄의 글은 그 활동의 기록에서만 나온다(설계 주인 판단 3).
// 4-3에서 넘기는 활동은 다섯이다 — 하던 것 · 생활 복습 하나 · 다음 생활 레슨 하나 · 한글 먼저 · 짧은 연습(돌아온 단위가 든 문항만). 게임과
// 시험 형식 연습은 엔진에 옮기기 전이라 후보가 아니고(점검 칸이 빈다), 이번 주 계획은 4-4에서 새 요약으로 다시 짓는다(§20-7).
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
// 4시간을 빼서 세면 서머타임이 바뀌는 날 열쇠가 현지 5시(봄)나 3시(가을)에 바뀌어 다시 그리는 때와 어긋난다(카본 엔진급 끝 판 B5).
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

function activity(kind, open, facts, candidates, settings) {
  const blocked = blockedBy(open, settings);
  return {
    kind,
    open,
    blocked,
    plan: blocked
      ? { id: open.id, candidates: [], facts: { locked: true } }
      : { id: open.id, candidates, facts },
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
// 다 한 날로 보인다(카본 엔진급 끝 판 B1).
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
  if (items.length && !resumingReview) {
    const open = lifeReviewCandidate(
      items.map(item => item.id),
      snapshot,
      values,
      now,
    );
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
  return out;
}

// 확인 중의 차례 — 엔진 없이 제품 사실로만: 하던 것 → 한글 먼저 → 다음 레슨(두뇌 PLAN_FACTS의 차례와 같다).
const CHECKING_CODES = Object.freeze({
  resume: 'host.resume',
  prerequisite: 'host.prerequisite',
  next: 'host.next',
});
function checkingEntries(activities, say) {
  const rank = act =>
    act.plan.facts.resume ? 0 : act.plan.facts.prerequisite ? 1 : act.plan.facts.describe ? 2 : 3;
  return activities
    .filter(act => rank(act) < 3)
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

// 한 줄 — 그 활동이 줄이 되는가, 되면 그 이유(§20-2 · §20-3). 이유 문장이 없으면 줄이 아니다.
function rowWhy(entry, act, { capped, say }) {
  const open = act.open;
  if (entry.locked) return null;
  if (open.resume || open.id === HANGUL_ID) return entry.why;
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
  return null;
}

// 세 줄 — plan()의 차례 그대로, 칸마다 한 줄. opened: 이번 학습일에 이 문서에서 연 칸.
export function todayRows({ entries = [], activities = [], opened = new Set(), say = () => null } = {}) {
  const byId = new Map(activities.map(act => [act.plan.id, act]));
  // 하루 복습 상한(§20-3): 상한은 엔진 전체의 값이다(오늘 복습 수가 하루 상한에 닿았고 미룬 것이 있다 — 후보를 넘긴 활동이면 어느 항목이든
  // 같은 값). 생활 복습 항목만 보면 생활 복습 없이 짧은 연습이나 다음 레슨만 있는 상한 날을 「다 만났어요」로 잘못 말한다(GPT 끝 판 GB1).
  const capped = entries.some(entry => Boolean(entry?.capped));
  const rows = [];
  const taken = new Set();
  for (const entry of entries) {
    const act = byId.get(entry.id);
    if (!act || taken.has(act.kind)) continue;
    const why = rowWhy(entry, act, { capped, say });
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
//   coach — 자리를 잡은 홈 코치(엔진) 또는 null(확인 중) · progress — 생활 진도 · say(why) — 화면 언어의 Vellum 문장
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
  });
  // 엔진 판에서 plan()이 실패하면(가정한 장애) 확인 중 판으로 내려 제품 사실 줄만 그린다 — 빈 목록으로 읽으면 다음 레슨이 남았는데 다 한 날이
  // 된다(Fable 엔진급 끝 판 F3).
  const planned = engine ? quiet(() => coach.plan(activities.map(act => act.plan), { lang })) : null;
  const live = engine && Array.isArray(planned);
  const entries = live ? planned : checkingEntries(activities, say);
  const { rows, capped } = todayRows({ entries, activities, opened, say });
  const selected = pickRow(rows, opened);
  const checking = !live;
  const cappedText = capped ? quiet(() => say({ code: 'day.capped', slots: {} })) : null;
  // 조건에 걸린 날(blocked)은 걸린 활동이 풀리면 줄이 되는 때다. 상한 날의 복습 칸 활동(하던 것 밖)은 풀려도 줄이 아니라 그날의 까닭은 상한이다.
  // 판(status) · 이유 · 빈 날 코드는 한 차례(확인 중 → 조건 → 상한 → 다 한 날)로 정한다(Fable 엔진급 끝 판 F5).
  const blocked = activities.some(act => act.blocked && !(capped && act.kind === 'again' && !act.open.resume));
  const firstDay =
    !Object.values(snapshot.lessons ?? {}).some(run => Number.isFinite(run?.completedAt)) &&
    !Object.keys(snapshot.reviews ?? {}).length;
  const status = rows.length ? 'ready' : checking ? 'checking' : blocked ? 'unavailable' : 'empty';
  // 다시 그리는 때(설계 검토 H22): 생활 판정이 아는 앞으로 열릴 때(times — ①이 열림 · 다리 · 돌아올 단위) 가운데 가장 이른 것과 다음 학습일.
  // nextAt만 보면 열린 복습이 있는 동안 비어 있어(「지금 열 것이 없을 때」의 값) 그 사이 ①이 열리는 때를 놓친다.
  const upcoming = (Array.isArray(judged?.times) ? judged.times : [judged?.nextAt]).filter(
    at => Number.isFinite(at) && at > now,
  );
  const redraw = [...upcoming, nextDayStart(now)].filter(at => Number.isFinite(at) && at > now);
  return {
    status,
    selected: selected?.open ?? null,
    selectedKind: selected?.kind ?? null,
    reason: selected ? selected.why.text : status === 'unavailable' ? NO_FIT : '',
    resume: selected?.open?.resume ? selected.open : null,
    candidates: activities.map(act => act.open),
    examPlan: null,
    today: {
      items: rows,
      minutes: rows.reduce((sum, row) => sum + (Number.isFinite(row.minutes) ? row.minutes : 0), 0),
      line: null,
      empty: rows.length
        ? null
        : {
            // 조건에 걸린 날(blocked)은 다 한 날이 아니다 — 홈 단추는 지금 판처럼 학습 조건으로 간다(§20-8). 조건이 상한보다 앞이다 — 걸린 활동은
            // 조건을 바꾸면 줄이 되고, 상한은 복습만 미룬다(위 blocked · Fable 엔진급 끝 판 F5).
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
    settleTimer = clear(settleTimer);
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
    if (settleTimer || disposed || !coach) return;
    settleTimer = timers.setTimeout(() => {
      settleTimer = null;
      if (disposed || !coach) return;
      if (settled(quiet(() => coach.summary()))) {
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
    // 코치를 내려놓고 다음 물음에서 다시 연다 — 은행이 늦게 와 은행 없이 연 코치를 바꿀 때(Fable 엔진급 끝 판 F2). 기다리던 다시 열기도 지운다.
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
