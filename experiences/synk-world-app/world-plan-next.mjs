// Atlas 새 길의 이번 주 계획 입력(재설계 단계 4-4b — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-6). 셸은 이 파일을 부르지 않는다 —
// 입구(world-atlas-next.mjs)가 정적으로 받아 홈 플래너로 넘기고, 셸은 입구를 기능이 켜졌을 때만 동적 import로 부른다(world-today.mjs와 같다).
// 화면 없이 자료의 꼴만 짓는다. 새 코치가 낸 것(내 위치 칸 계약 · 묶음 만남)과 이 기기의 판 기록만 읽고, 옛 요약과 옛 Trail 사건은 읽지
// 않는다(§6). 셈(횟수 나누기 · 다시 확인 일정 · 반 과제 · 쓰기 · 말하기 줄)은 지금 판의 buildExamPlan을 그대로 쓴다 — 같은 셈을 두 벌 두지
// 않는다(§21-6). 이 파일은 능력 읽개 · 시작점 · 기기의 판 기록만 짓는다.
import { buildPositionNext, examSkills } from './world-position-next.mjs';

// 기록이 다 왔는가(§21-3 — 내 위치와 같은 판정). 셸이 묶음 만남을 다시 물을 때를 가리는 열쇠에 쓴다(첫 받기가 오면 시작점을 다시 센다 — A8).
export { recordsComplete } from './world-position-next.mjs';

export const PLAN_NEXT_POLICY = Object.freeze({
  version: 'world-plan-next-1',
  // 기기 판 기록의 줄 수 상한 — 넘치면 오래된 줄부터 버리되 마지막 다시 확인은 남긴다(다음 확인의 간격을 잰다).
  log: 240,
});
export const PLAN_LOG_PREFIX = 'synk.world.plan-log.v1:';
// mock — 시험 형식 판(4-4d — §21-23의 3). 점검 칸의 시험 형식 줄이 이번 주에 한 판을 보고 서지 않는다. 이번 주 계획의 영역 셈(weekActivity)에는
// 영역이 아니라 들지 않는다.
export const PLAN_LOG_AREAS = Object.freeze(['recheck', 'listening', 'reading', 'mock']);
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

// 이 기기의 판 기록(§21-6 가 · 검토 D5) — 새 길의 판(짧은 진단 · 짧은 연습)이 끝날 때 영역과 시각을 적는다. 열쇠는 그 코치의 저장소 이름(주인 ·
// 동의 판)이다. 그래서 「연습 기록 비우기」로 동의 판이 오르면 앞 판의 기록은 읽히지 않는다(4-5가 기기 기록도 지운다). 손님에서 계정으로 옮길 때
// 함께 옮기지 않는다 — 그 주에 진단을 한 번 더 권할 수 있을 뿐이다(4c의 안, 설계 주인께 알림 11-16). 다른 기기에서 한 판은 세지 못하므로 계획은
// 「이 기기에서 센 수」 표지(doneScope 'device')를 싣는다.
export const planLogKey = store => (typeof store === 'string' && store ? PLAN_LOG_PREFIX + store : null);
export function createPlanLog({ storage, store, policy = PLAN_NEXT_POLICY } = {}) {
  const key = planLogKey(store);
  const read = () => {
    if (!key) return [];
    const value = quiet(() => JSON.parse(storage?.getItem?.(key) ?? 'null'));
    const rows = Array.isArray(value?.rows) ? value.rows : [];
    return rows.filter(row => PLAN_LOG_AREAS.includes(row?.area) && Number.isFinite(row?.at));
  };
  return Object.freeze({
    key,
    // 판 하나 — area: recheck(짧은 진단) · listening · reading(짧은 연습의 영역) · mock(시험 형식 — 문항을 처음 낸 때), at: 끝난 때(ms). 못 적으면
    // false다(계획이 그 판을 세지 못할 뿐이다).
    record(area, at = Date.now()) {
      if (!key || !PLAN_LOG_AREAS.includes(area) || !Number.isFinite(at)) return false;
      const rows = [...read(), { area, at }].sort((a, b) => a.at - b.at);
      let kept = rows.slice(-policy.log);
      const check = rows.filter(row => row.area === 'recheck').at(-1);
      if (check && !kept.includes(check)) kept = [check, ...kept.slice(1)];
      return (
        quiet(() => {
          storage.setItem(key, JSON.stringify({ v: 1, rows: kept }));
          return true;
        }) === true
      );
    },
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
  const device = PLAN_LOG_AREAS.map(area => ({ area, times: quiet(() => log?.times(area)) ?? [] }));
  const extra = [
    ...device,
    { area: 'writing', times: Array.isArray(writingTimes) ? writingTimes : [] },
    { area: 'speaking', times: Array.isArray(speaking?.times) ? speaking.times : [] },
  ].filter(row => row.times.length);
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
