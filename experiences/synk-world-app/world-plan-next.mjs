// Atlas 새 길의 이번 주 계획 입력(재설계 단계 4-4b — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-6). 셸은 이 파일을 부르지 않는다 —
// 입구(world-atlas-next.mjs)가 정적으로 받아 홈 플래너로 넘기고, 셸은 입구를 기능이 켜졌을 때만 동적 import로 부른다(world-today.mjs와 같다).
// 화면 없이 자료의 꼴만 짓는다. 새 코치가 낸 것(내 위치 칸 계약 · 묶음 만남)과 이 기기의 판 기록만 읽고, 옛 요약과 옛 Trail 사건은 읽지
// 않는다(§6). 셈(횟수 나누기 · 다시 확인 일정 · 반 과제 · 쓰기 · 말하기 줄)은 지금 판의 buildExamPlan을 그대로 쓴다 — 같은 셈을 두 벌 두지
// 않는다(§21-6). 이 파일은 능력 읽개 · 시작점 · 기기의 판 기록만 짓는다.
import { buildPositionNext, examSkills } from './world-position-next.mjs';

// 기록이 다 왔는가(§21-3 — 내 위치와 같은 판정). 셸이 묶음 만남을 다시 물을 때를 가리는 열쇠에 쓴다(첫 받기가 오면 시작점을 다시 센다 — A8).
export { recordsComplete } from './world-position-next.mjs';

export const PLAN_NEXT_POLICY = Object.freeze({
  version: 'world-plan-next-2',
  // 기기 판 기록을 거두는 기간(단계4_계획 §25-3 「거두기」) — 쓸 때 이보다 오래된 줄을 버리되 마지막 다시 확인 한 줄은 남긴다(다음 확인의 간격을
  // 잰다). 수로 자르지 않는다 — 게임 판이 많은 주에 시험 형식 줄과 주초의 듣기 · 읽기 줄이 밀려나지 않게. 이번 주 계획이 세는 기간은 이레 안이다.
  keepMs: 7 * 86_400_000,
});
export const PLAN_LOG_PREFIX = 'synk.world.plan-log.v1:';
// mock — 시험 형식 판(4-4d — §21-23의 3). 점검 칸의 시험 형식 줄이 이번 주에 한 판을 보고 서지 않는다. 이번 주 계획의 영역 셈(weekActivity)에는
// 영역이 아니라 들지 않는다.
export const PLAN_LOG_AREAS = Object.freeze(['recheck', 'listening', 'reading', 'mock']);
// 경험마다 묶어 세는 영역(§25-3 「셈」) — 판 기록 줄의 경험 이름(게임 이름 · 짧은 연습)마다 같은 간격으로 묶어 센 수를 넘긴다.
const PLAN_COUNTED = Object.freeze(['listening', 'reading']);
// 짧은 연습의 경험 이름. 경험 이름이 없는 옛 듣기 · 읽기 줄은 모두 짧은 연습 판 끝(planOnce)에서 왔으므로 이것으로 읽는다.
export const PRACTICE_EXPERIENCE = 'world-practice';
const PLAN_DOMAINS = Object.freeze(['listening', 'reading', 'writing']);
const PLAN_SKILL = /^ko2?\.(listening|reading|writing)\.[a-z]+$/;

const quiet = fn => {
  try {
    return fn();
  } catch {
    return null;
  }
};

// 이번 주 계획이 읽는 내 위치 계약 — TOPIK II 학생도 TOPIK II 문항이 아직 없는 영역은 TOPIK I 능력을 읽으므로(buildExamPlan의 MAPS) 두 시험의
// 듣기 · 읽기 능력으로 짓는다. 그 밖의 재료(prefer · synced · unseen)는 내 위치 판과 같다.
export function planBoard({ nodes = [], summary, prefer = null, synced = null, unseen = null } = {}) {
  return buildPositionNext({
    exam: 'topik1',
    skills: [...examSkills(nodes, 'topik1'), ...examSkills(nodes, 'topik2')],
    summary,
    prefer,
    synced,
    unseen,
  });
}

// 능력 읽개(§21-6 표 · 검토 D1) — buildExamPlan이 옛 요약을 읽는 여덟 자리를 새 칸으로 덮는다. 능력 목록과 영역은 열린 지도(Strata)의 것이다 —
// 새 요약은 만난 능력만 내므로 「TOPIK II 능력이 있는가」를 요약으로 읽지 않는다(설계 검토 A2). 듣기 · 읽기 칸은 planBoard에서, 쓰기
// (ko2.writing.*)는 자동 판정이 없어 늘 아직이다.
//   board — planBoard, nodes — 열린 지도의 능력 목록(engine.SKILLS), start(ids) — 시작점 판정(planStart를 감싼 것)
export function planReader({ board, nodes = [], start = null } = {}) {
  const rows = new Map((Array.isArray(board?.skills) ? board.skills : []).map(row => [row.id, row]));
  const skills = [];
  const seen = new Set();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const id = node?.id;
    if (typeof id !== 'string' || !PLAN_SKILL.test(id) || seen.has(id)) continue;
    if (!PLAN_DOMAINS.includes(node.domain)) continue;
    seen.add(id);
    const row = rows.get(id);
    skills.push(
      Object.freeze({
        id,
        domain: node.domain,
        cell: row?.cell ?? 'notyet',
        missed: row?.missed ?? 0,
        helped: row?.helped ?? 0,
        answered: row?.answered ?? 0,
        lastAt: row?.lastAt ?? null,
      }),
    );
  }
  return Object.freeze({
    complete: board?.complete === true,
    topik2: skills.some(skill => skill.id.startsWith('ko2.')),
    skills: Object.freeze(skills),
    start: typeof start === 'function' ? start : () => null,
  });
}

// 시작점(§21-6 · 검토 D4): 그 학생의 시험이 읽는 능력(ids)의 문항 가운데 생활 은행 밖(진단 풀 · 짧은 연습 풀)에서 그 계열을 만난 것이 하나도
// 없으면 참이다. 하나라도 만났으면 거짓(찾으면 멈춘다), 측정용 만남을 모르는 문항(met null)이 있으면 모름(null) — 시작점으로 단정하지 않는다.
// TOPIK II를 고른 학생이 TOPIK I 문항만 풀었으면 TOPIK II 능력은 시작점이다. pools: [{ items, exposures }](묶음 만남과 같은 차례),
// skip(item): 새 길이 지금 낼 수 없는 문항(진단의 뺀 레이싱 문항 — 홈 은행 밖이라 만남을 늘 모른다).
export function planStart({ ids = [], pools = [], skip = () => false } = {}) {
  const wanted = new Set(ids);
  let unknown = false;
  for (const pool of Array.isArray(pools) ? pools : []) {
    const items = Array.isArray(pool?.items) ? pool.items : [];
    const exposures = Array.isArray(pool?.exposures) ? pool.exposures : [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!wanted.has(item?.skillId) || quiet(() => skip(item)) === true) continue;
      const met = exposures[i]?.met;
      if (met === true) return false;
      if (met !== false) unknown = true;
    }
  }
  return unknown ? null : true;
}

// 기기 쪽 곁 기록의 열쇠(§25-3 불변식 가) — 앞마디 + 저장소 이름, 기록부 세대가 1 이상이면 「@세대」를 붙인다. 엔진 순간 맞춤 내용 기억의 열쇠
// (packages/atlas/src/coach/flow-memory.mjs keyOf)와 같은 짜임이다 — 엔진 묶음 안의 함수라 제품이 부를 수 없어, 시험이 세대 0 · 1 · 2에서
// 이 함수와 엔진이 실제로 쓴 열쇠를 견준다. 판 기록과 입구의 세대 쓸기(내용 기억 · 판 기록 두 앞마디)가 함께 쓴다.
export const sideKey = (prefix, store, gen = 0) =>
  typeof store === 'string' && store ? `${prefix}${store}${Number.isSafeInteger(gen) && gen > 0 ? `@${gen}` : ''}` : null;

// 이 기기의 판 기록(§21-6 가 · 검토 D5 · §25-3) — 새 길의 판(짧은 진단 · 짧은 연습 · 시험 형식 · 게임)이 끝날 때 영역 · 시각 · 경험 이름을 적는다.
// 열쇠는 그 코치의 저장소 이름(주인 · 동의 판)과 기록부 세대다(planLogKey). 계정은 「연습 기록 비우기」로 동의 판이 올라 저장소 이름이 바뀌고,
// 손님은 세대가 올라 열쇠가 바뀐다 — 어느 쪽이든 앞 기록은 읽히지 않고 입구의 쓸기가 지운다. 손님에서 계정으로 옮길 때 함께 옮기지 않는다 —
// 그 주에 진단을 한 번 더 권할 수 있을 뿐이다(4c의 안, 설계 주인께 알림 11-16). 다른 기기에서 한 판은 세지 못하므로 계획은 「이 기기에서 센 수」
// 표지(doneScope 'device')를 싣는다.
export const planLogKey = (store, gen = 0) => sideKey(PLAN_LOG_PREFIX, store, gen);
const rowOk = row => PLAN_LOG_AREAS.includes(row?.area) && Number.isFinite(row?.at);
// 같은 줄(영역 · 때 · 경험)은 하나로 — 옛 꼴을 이어받을 때 쓴다.
const merged = rows => {
  const seen = new Set();
  return rows.filter(row => {
    const id = `${row.area}|${row.at}|${row.experience ?? ''}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};
// gen: 그 코치를 열 때 읽은 기록부 세대(summary().storage.generation). 값에 gen을 싣고, 값의 gen이 다르면 빈 기록으로 읽는다. 세대 칸이 없는
// 엔진 판이면 null — 세대 0 열쇠를 쓰되 값에 gen을 싣지 않고 값의 gen을 보지 않는다(§25-3 · v8 검토 FA1).
// cleared(): 그 저장소의 마지막으로 비운 세대(입구가 내용 기억의 비운 세대 표지 #cleared에서 읽는다). 그 세대가 gen보다 크거나 다음 세대의 판
// 기록이 섰으면 이 탭은 비운 것을 아직 모르는 탭이라 쓰지 않는다 — 다른 탭이 비운 뒤 늦게 끝난 판이 방금 지운 열쇠에 줄을 되살리지 않게
// (4-6e-2 검수 GC1, 내용 기억과 같은 막이). opened: 그 코치를 열기 전에 본 값 { mark(비운 세대), last(판 기록 열쇠의 가장 뒤 세대) } — 연 뒤에
// 새로 오른 것만 다른 탭의 비우기다. 브라우저가 IndexedDB만 비우면 기록부 세대는 0에서 다시 서고 localStorage의 표지와 열쇠는 남는다. 열 때 이미
// 있던 것까지 비우기로 보면 그 기기의 판 기록이 계속 멈춘다. 유실 뒤 첫 비우기는 같은 세대 번호를 다시 써서 이 막이에 비치지 않는다 — 엔진이 세대를
// 되돌리지 않게 고친 뒤 이 막이를 걷는다(단계4_계획 §6 GA1 — 손님 스위치 전 조건).
export function createPlanLog({ storage, store, gen = null, cleared = null, opened = null, policy = PLAN_NEXT_POLICY } = {}) {
  const known = Number.isSafeInteger(gen) && gen >= 0;
  const key = planLogKey(store, known ? gen : 0);
  const stale = () => {
    if (!known) return false;
    const mark = quiet(() => cleared?.());
    if (Number.isSafeInteger(mark) && mark > Math.max(gen, opened?.mark ?? 0)) return true;
    const next = gen + 1 > (opened?.last ?? 0) ? planLogKey(store, gen + 1) : null;
    return Boolean(next) && quiet(() => storage?.getItem?.(next)) != null;
  };
  const stored = () => {
    if (!key) return null;
    const value = quiet(() => JSON.parse(storage?.getItem?.(key) ?? 'null'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  };
  const rowsIn = value => (Array.isArray(value?.rows) ? value.rows.filter(rowOk) : []);
  // 세대 0의 옛 꼴(gen 없는 값)이 이어받을 줄(같은 줄은 하나로). 세대 0이 아니거나 옛 꼴이 아니면 null.
  const inherited = value => (known && gen === 0 && value && !Number.isSafeInteger(value.gen) ? merged(rowsIn(value)) : null);
  // 세대 0의 옛 꼴은 이어받기(adopt)를 적지 못했어도(저장소가 가득 참) 이 세대의 줄로 읽는다(4-6e-2 검수 GC3).
  const read = () => {
    const value = stored();
    return !known || value?.gen === gen ? rowsIn(value) : (inherited(value) ?? []);
  };
  const save = rows =>
    !stale() &&
    quiet(() => {
      storage.setItem(key, JSON.stringify({ v: 1, ...(known ? { gen } : {}), rows }));
      return true;
    }) === true;
  return Object.freeze({
    key,
    // 판 하나 — area: recheck(짧은 진단) · listening · reading(짧은 연습 · 게임의 형식) · mock(시험 형식 — 문항을 처음 낸 때), at: 끝난 때(ms),
    // experience: 경험 이름(게임 이름 · 짧은 연습 world-practice — 이번 주 계획이 경험마다 묶어 센다). 못 적으면 false다(계획이 그 판을 세지
    // 못할 뿐이다). 쓸 때 기간이 지난 줄을 거둔다 — 마지막 다시 확인 한 줄은 남긴다.
    record(area, at = Date.now(), experience = null) {
      if (!key || !PLAN_LOG_AREAS.includes(area) || !Number.isFinite(at)) return false;
      const value = stored();
      const rows = [...(inherited(value) ?? read()), { area, at, ...(typeof experience === 'string' && experience ? { experience } : {}) }].sort(
        (a, b) => a.at - b.at,
      );
      const check = rows.filter(row => row.area === 'recheck').at(-1);
      return save(rows.filter(row => row.at >= at - policy.keepMs || row === check));
    },
    // 세대 0의 옛 꼴을 이어받는다 — 줄은 그대로(같은 줄은 하나로) 두고 gen 0을 실어 그 자리에 적는다. 이어받은 값은 gen이 들어 다시 부르면
    // 아무것도 하지 않는다(두 번 열어도 한 번만 센다). 입구가 그 저장소 · 세대의 코치를 문서에서 처음 열 때 부른다. 적었으면 참.
    adopt() {
      const rows = inherited(stored());
      return rows ? save(rows) : false;
    },
    // 영역 · 경험의 줄 — 경험 이름이 없는 옛 듣기 · 읽기 줄은 짧은 연습(world-practice)으로 읽는다.
    rows: () =>
      read().map(row => ({
        area: row.area,
        at: row.at,
        experience: typeof row.experience === 'string' && row.experience ? row.experience : PLAN_COUNTED.includes(row.area) ? PRACTICE_EXPERIENCE : null,
      })),
    // 영역의 끝난 때 목록 — weekActivity의 extra times로 넘긴다(같은 간격으로 묶어 센다).
    times: area => read().filter(row => row.area === area).map(row => row.at),
    // before 앞의 가장 늦은 다시 확인(지금 판 lastRecheck와 같은 뜻 — 다음 확인을 그 단계의 주기보다 가깝게 잡지 않는다). 없으면 null.
    lastCheck(before = Number.POSITIVE_INFINITY) {
      const at = read()
        .filter(row => row.area === 'recheck' && row.at < before)
        .map(row => row.at);
      return at.length ? Math.max(...at) : null;
    },
  });
}

// 이번 주 듣기 · 읽기의 수(§25-3 「셈」) — 이번 주(week) 판 기록 줄만 골라 영역 · 경험마다 같은 간격(gap — 지금 판 sessionGapMs)으로 묶어 센다.
// 옛 길도 경험마다 따로 묶었다(world-exam-plan.mjs weekActivity) — 바람길 판 뒤 10분의 리듬 판은 한 수를 더 올린다. 수가 있는 영역만
// [{ area, count }]로 낸다.
function weekCounts(rows, week, gap) {
  if (!Number.isFinite(gap)) return [];
  const runs = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!PLAN_COUNTED.includes(row?.area) || !Number.isFinite(row.at) || row.at < week.start || row.at >= week.end) continue;
    const key = `${row.area}|${row.experience}`;
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(row.at);
  }
  const count = Object.fromEntries(PLAN_COUNTED.map(area => [area, 0]));
  for (const [key, times] of runs) {
    let last = Number.NEGATIVE_INFINITY;
    for (const at of times.sort((a, b) => a - b)) {
      if (at - last > gap) count[key.split('|')[0]] += 1;
      last = at;
    }
  }
  return PLAN_COUNTED.filter(area => count[area] > 0).map(area => ({ area, count: count[area] }));
}

// 새 길의 이번 주 계획(§21-6) — 지금 판의 buildExamPlan에 능력 읽개와 이 기기의 판 기록을 넘긴다.
//   examPlan — 지금 판의 시험 계획 모듈(셸의 position.exam — 계정 묶음 안의 world-exam-plan.mjs), info — examInfo(values),
//   reader — planReader, log — createPlanLog(없으면 이번 주에 한 판을 세지 못한다), progress — 생활 진도 exportSnapshot()(생활 칸),
//   available — 지금 열 수 있는 연습(buildExamPlan의 available), writingTimes — 쓰기 연습의 기기 시각, speaking — 말하기를 고른 학생의
//   { list, times, untried }(이 기기 기록만 — 계정의 Trail 시도는 옛 판의 기록이라 읽지 않는다, §21-6 「말하기」)
export function buildPlanNext({
  examPlan,
  info,
  reader,
  log = null,
  progress = null,
  now = Date.now(),
  classwork = [],
  audioAvailable = true,
  available = {},
  writingTimes = [],
  speaking = null,
} = {}) {
  if (!info || typeof examPlan?.buildExamPlan !== 'function' || !reader) return null;
  const week = examPlan.examWeek(now);
  // 다시 확인 · 시험 형식은 끝난 때 목록(times)으로 넘긴다. 듣기 · 읽기는 이번 주 줄만 골라 경험마다 같은 간격으로 묶어 센 수(count)로만
  // 넘긴다(§25-3 「셈」) — weekActivity는 count를 주 경계로 거르지 않고 더하고, 같은 영역을 times로도 넘기면 한 번 더 센다.
  const device = PLAN_LOG_AREAS.filter(area => !PLAN_COUNTED.includes(area)).map(area => ({ area, times: quiet(() => log?.times(area)) ?? [] }));
  const counted = weekCounts(quiet(() => log?.rows?.()) ?? [], week, examPlan.EXAM_PLAN_POLICY?.sessionGapMs);
  const extra = [
    ...[
      ...device,
      { area: 'writing', times: Array.isArray(writingTimes) ? writingTimes : [] },
      { area: 'speaking', times: Array.isArray(speaking?.times) ? speaking.times : [] },
    ].filter(row => row.times.length),
    ...counted,
  ];
  const done = examPlan.weekActivity({ events: [], progress, week, extra });
  return examPlan.buildExamPlan({
    exam: speaking ? { ...info, speaking: true } : info,
    now,
    audioAvailable,
    classwork,
    lastCheckAt: quiet(() => log?.lastCheck(week.start)) ?? null,
    ...(speaking ? { speakingNeeds: speaking.untried } : {}),
    done,
    available,
    reader,
    doneScope: 'device',
  });
}
