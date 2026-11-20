// Atlas 새 길의 「내 위치」(재설계 단계 4-4a — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-2 ~ 21-4). 셸은 이 파일을 부르지
// 않는다 — 입구(world-atlas-next.mjs)가 정적으로 받아 홈 플래너로 넘기고, 셸은 입구를 기능이 켜졌을 때만 동적 import로 부른다(world-today.mjs와
// 같다). 화면 없이 자료의 꼴(계약)만 짓는다. 새 코치가 낸 것(summary · due · itemUnits)만 읽고, 옛 요약과 옛 Trail 사건은 읽지 않는다(§6).
// 옛 꼴(칸의 여섯 상태 · evidenceComplete)을 새 칸으로 어림해 만들지 않는다(§3-4) — 칸의 글과 화면은 리디자인에서 그린다(유호님 11-15).
// 「늘었다」는 말은 처음 본 계열에 혼자 낸 첫 답으로만 한다(정본 §5-2) — 칸은 코치 summary()의 칸 요약(혼자 낸 첫 답 수 · 맞힌 수 · 도움받은
// 수 · 마지막 때)이다.

export const POSITION_NEXT_POLICY = Object.freeze({
  version: 'world-position-next-1',
  // 난도 칸 하나가 혼자 해냄이 되는 문턱 — 옛 판의 수 그대로다(혼자 낸 첫 답 4개 이상, 그 가운데 맞힌 것 80% 이상 — 4/5로 정수 셈).
  sample: 4,
  ratio: Object.freeze([4, 5]),
  // 능력의 칸을 푸는 이어 맞힘 수(§21-3 다 — 설계 주인 11-15).
  streak: 4,
  // 먼저 볼 항목 · 돌아올 단위 카드의 최대 수(옛 판과 같다).
  attention: 3,
  cards: 12,
});
export const NEXT_CELLS = Object.freeze(['independent', 'practicing', 'notyet']);
const LEVELS = Object.freeze([1, 2, 3]);
const EXAMS = Object.freeze({
  topik1: /^ko\.(listening|reading)\.[a-z]+$/,
  topik2: /^ko2\.(listening|reading)\.[a-z]+$/,
});
export const positionExamNext = value => (value === 'topik2' ? 'topik2' : 'topik1');

const quiet = fn => {
  try {
    return fn();
  } catch {
    return null;
  }
};
const count = value => (Number.isSafeInteger(value) && value > 0 ? value : 0);
// 칸의 마지막 때 — 코치 요약은 밀리초 수, 옮겨 온 장부는 ISO 글이다. 둘 다 밀리초로(없으면 null).
const timeOf = value => {
  const at = typeof value === 'string' ? Date.parse(value) : value;
  return Number.isFinite(at) ? at : null;
};
const later = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b));

// 시험의 능력 목록(Strata — TOPIK I 16 · TOPIK II 12). 지도의 마디(worldLearning.SKILLS)에서 그 시험의 듣기 · 읽기 능력만 차례대로.
export function examSkills(nodes, exam = 'topik1') {
  const pattern = EXAMS[positionExamNext(exam)];
  const out = [];
  const seen = new Set();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const id = node?.id;
    if (typeof id !== 'string' || !pattern.test(id) || seen.has(id)) continue;
    if (!['listening', 'reading'].includes(node.domain)) continue;
    seen.add(id);
    out.push(Object.freeze({ id, domain: node.domain }));
  }
  return Object.freeze(out);
}

// 난도 칸 하나(§21-3) — 혼자 해냄: 혼자 낸 첫 답 4개 이상 · 맞힌 비율 0.8 이상. 연습 중: 혼자 낸 첫 답이나 도움받은 첫 만남이 하나라도.
export function difficultyCell(cell, policy = POSITION_NEXT_POLICY) {
  const independent = count(cell?.independent);
  const correct = Math.min(count(cell?.correct), independent);
  const [num, den] = policy.ratio;
  if (independent >= policy.sample && correct * den >= independent * num) return 'independent';
  if (independent > 0 || count(cell?.helped) > 0) return 'practicing';
  return 'notyet';
}

// 능력 하나의 난도 칸들(1 · 2 · 3) — 요약에 없는 난도는 빈 칸(아직)이다. 놓친 수는 independent − correct.
function levelsOf(cells, policy) {
  const byLevel = new Map();
  for (const cell of Array.isArray(cells) ? cells : []) {
    if (!LEVELS.includes(cell?.difficulty)) continue;
    const row = byLevel.get(cell.difficulty) ?? { independent: 0, correct: 0, helped: 0, lastAt: null };
    row.independent += count(cell.independent);
    row.correct += Math.min(count(cell.correct), count(cell.independent));
    row.helped += count(cell.helped);
    row.lastAt = later(row.lastAt, timeOf(cell.lastAt));
    byLevel.set(cell.difficulty, row);
  }
  return LEVELS.map(difficulty => {
    const row = byLevel.get(difficulty) ?? { independent: 0, correct: 0, helped: 0, lastAt: null };
    return Object.freeze({
      difficulty,
      cell: difficultyCell(row, policy),
      independent: row.independent,
      correct: row.correct,
      missed: row.independent - row.correct,
      helped: row.helped,
      lastAt: row.lastAt,
    });
  });
}

// 난도 칸 하나가 처음 보는 계열 fresh개를 모두 혼자 맞히면 혼자 해냄에 닿는가(§21-3 「지금 규칙」 — 비율은 맞힐수록 오르므로 다 맞힌 경우만 본다).
function reachable(level, fresh, policy) {
  const independent = level.independent + fresh;
  const correct = level.correct + fresh;
  const [num, den] = policy.ratio;
  return independent >= policy.sample && correct * den >= independent * num;
}

// 닿을 수 있는가의 F(§21-3 「지금 규칙」 — 설계 주인 11-16 새벽): 칸(능력 | 난도)마다 새 길이 낼 수 있는 처음 보는 계열 수. pools: [{ items, exposures }]
// (같은 차례의 묶음 만남 — 진단 풀과 짧은 연습 풀), skip(item): 새 길이 지금 낼 수 없는 문항(진단의 뺀 레이싱 문항). 제품 문항의 능력과 난도로 칸을
// 가르고 같은 계열은 한 번만 센다. 측정용 만남을 모르는 문항(met null · 묶음 만남이 모자람)은 처음 볼 수도 있는 것으로 센다 — 모를 때는 닿을 수
// 있는 칸이 되어 다의 길이 열리지 않는다.
export function unseenFamilies(pools = [], skip = () => false) {
  const families = new Map();
  for (const pool of Array.isArray(pools) ? pools : []) {
    const items = Array.isArray(pool?.items) ? pool.items : [];
    const exposures = Array.isArray(pool?.exposures) ? pool.exposures : [];
    items.forEach((item, i) => {
      if (typeof item?.skillId !== 'string' || !LEVELS.includes(item.difficulty)) return;
      if (exposures[i]?.met === true || quiet(() => skip(item)) === true) return;
      const key = `${item.skillId}|${item.difficulty}`;
      if (!families.has(key)) families.set(key, new Set());
      families.get(key).add(item.familyKey || item.itemKey);
    });
  }
  return (skillId, difficulty) => families.get(`${skillId}|${difficulty}`)?.size ?? 0;
}

// 능력의 칸(§21-3) — 본 난도가 없으면 아직, 본 난도가 모두 혼자 해냄이면 혼자 해냄. 아니면 다의 길(설계 주인 11-16 새벽 — A1과 4c의 안을
// 합침): 아직 혼자 해냄이 아닌 본 난도가 모두 닿을 수 없는 칸이고(처음 보는 계열을 다 맞혀도 문턱에 못 닿는다), streak이 4 이상이고, peak(지금
// streak 안의 측정 답 가운데 가장 높은 난도)이 그 칸들 가운데 가장 높은 난도 이상이면 혼자 해냄. 닿을 수 있는 칸이 하나라도 있으면 실제 문항으로
// 확인하면 되므로 풀지 않는다. unseen이 없거나 F를 모르면 닿을 수 있는 것으로, peak이 없는 옛 요약은 풀지 않는 것으로 본다. 나머지는 연습 중.
// 칸이 따라오는 중이면(behind — 그 능력에 아직 칸에 들지 않은 측정 답이 있으면) 다의 길을 열지 않는다. 처음 보는 계열 수(unseen)와 streak · peak은
// 보기에서 바로 오르고 칸은 바탕 요약에서만 와서, 접히기 전에는 닿을 수 있는 칸이 닿을 수 없는 칸으로 보이기 때문이다(끝 판 C1). 접히면 다시 잰다.
function skillCellOf(id, levels, line, policy, unseen, behind = 0) {
  const seen = levels.filter(level => level.cell !== 'notyet');
  if (!seen.length) return 'notyet';
  const open = seen.filter(level => level.cell !== 'independent');
  if (!open.length) return 'independent';
  if (behind > 0) return 'practicing';
  const fresh = difficulty => {
    const value = typeof unseen === 'function' ? quiet(() => unseen(id, difficulty)) : null;
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const stuck = open.every(level => {
    const left = fresh(level.difficulty);
    return left !== null && !reachable(level, left, policy);
  });
  if (!stuck) return 'practicing';
  const top = Math.max(...open.map(level => level.difficulty));
  const streak = count(line?.streak);
  const peak = line?.peak;
  if (streak >= policy.streak && Number.isFinite(peak) && peak >= top) return 'independent';
  return 'practicing';
}

// 방금 답한 능력(§21-3 — 검토 A2 · 설계 주인의 고침 · A4): 능력 줄의 n은 보기에서 바로 오르고 칸은 바탕 요약에서만 온다. n이 칸의
// 혼자 낸 첫 답 합보다 크면 「칸이 따라오는 중」이다. 칸 판정이 아직이면 연습 중으로 끌어올린다. 혼자 해냄이면 접히지 않은 첫 답이 모두
// 이어서 혼자 맞힌 것일 때(streak이 그 차 이상)만 그대로 두고, 그 사이 놓치거나 도움을 받았으면 연습 중으로 내린다. 연습 중은 그대로다.
function catchUp(cell, line, answered) {
  const behind = count(line?.n) - answered;
  if (behind <= 0) return { cell, catching: false };
  if (cell === 'notyet') return { cell: 'practicing', catching: true };
  if (cell === 'independent' && count(line?.streak) < behind)
    return { cell: 'practicing', catching: true };
  return { cell, catching: true };
}

// 기록이 다 왔는가(§21-3 A3 · A12) — 기기에만 두는 기록부(storage.guest — 손님 · 동의를 끈 계정)는 바탕 요약이 있고 보기가 기다리지
// 않으면 다 왔다. 서버 길 계정은 그에 더해 이 문서에서 받기가 됐고 올리기가 멈추지 않았을 때만(stopped · writesOff · switchOff). 받기가 됐는가는
// 첫 받기의 된 답(synced().ok)이나 storage.sync.pulled로 본다 — 첫 받기가 실패로 끝나면 엔진은 synced()에 그 실패를 그 문서 동안 돌려주고, 뒤의
// 받기가 되면 pulled만 참이 된다(끝 판 F1 · 설계 주인 11-16).
export function recordsComplete(storage, synced = null) {
  if (!storage || storage.base !== true || storage.waiting === true) return false;
  if (storage.guest === true) return true;
  const sync = storage.sync ?? {};
  return (synced?.ok === true || sync.pulled === true) && !sync.stopped && !sync.writesOff && !sync.switchOff;
}

// 먼저 볼 항목(§21-3 — 최대 셋): 연습 중인 능력 가운데 아직 혼자 해냄이 아닌 난도 칸에 놓친 수나 도움받은 수가 있는 것(A5). 그 합이 큰
// 차례 → 지금 낼 새 문항이 있는 차례(prefer) → 마지막 때가 늦은 차례 → id 차례. 이번 주 계획의 숙제 묶음도 이 차례를 쓴다(21-6).
export function attentionOf(skills, prefer = null, policy = POSITION_NEXT_POLICY) {
  const ready = id => (quiet(() => typeof prefer === 'function' && prefer(id)) ? 1 : 0);
  return skills
    .filter(skill => skill.cell === 'practicing' && skill.missed + skill.helped > 0)
    .map(skill => ({ skill, ready: ready(skill.id) }))
    .sort(
      (a, b) =>
        b.skill.missed + b.skill.helped - (a.skill.missed + a.skill.helped) ||
        b.ready - a.ready ||
        (b.skill.lastAt ?? -1) - (a.skill.lastAt ?? -1) ||
        (a.skill.id < b.skill.id ? -1 : a.skill.id > b.skill.id ? 1 : 0),
    )
    .slice(0, policy.attention)
    .map(row => row.skill.id);
}

// 영역별 진행(지금과 같은 꼴) — 영역마다 항목 수, 칸이 정해진 항목 수(아직이 아님), 칸마다 수.
export function domainsOf(skills) {
  const out = {};
  for (const skill of skills) {
    const row = out[skill.domain] ?? (out[skill.domain] = { total: 0, checked: 0, independent: 0, practicing: 0, notyet: 0 });
    row.total += 1;
    row[skill.cell] += 1;
    if (skill.cell !== 'notyet') row.checked += 1;
  }
  return out;
}

// 옮겨 오기 전 기록(§21-3 A4 · 정본 §5-6) — 코치 summary().carried(처음 옮긴 장부의 칸 요약)를 그 시험의 능력만 같은 칸 꼴로. 측정 칸(skills)에
// 더하지 않는다. 코치가 내지 않으면(서버 길 계정 · 옮긴 장부 없음 — §21-10 덧붙인 물음 3) null.
function carriedOf(carried, skills, policy) {
  if (!carried || !Array.isArray(carried.skills)) return null;
  const known = new Map(skills.map(skill => [skill.id, skill.domain]));
  const rows = carried.skills
    .filter(row => known.has(row?.id))
    .map(row => {
      const levels = levelsOf(row.cells, policy);
      return Object.freeze({
        id: row.id,
        domain: known.get(row.id),
        levels: Object.freeze(levels),
        answered: levels.reduce((n, level) => n + level.independent, 0),
        correct: levels.reduce((n, level) => n + level.correct, 0),
        helped: levels.reduce((n, level) => n + level.helped, 0),
      });
    });
  return Object.freeze({ at: timeOf(carried.at), skills: Object.freeze(rows) });
}

// 「내 위치」 판 하나(§21-3) — skills: 시험의 능력 목록(examSkills), summary: 홈 코치의 summary(), prefer(skillId): 그 능력에 지금 낼 새 문항이
// 있나, synced: 이 문서에서 받은 코치 synced()의 답(서버 길 계정만 읽는다), unseen(skillId, difficulty): 그 칸의 처음 보는 계열 수(unseenFamilies —
// 없으면 다의 길이 열리지 않는다).
export function buildPositionNext({
  exam = 'topik1',
  skills = [],
  summary,
  prefer = null,
  synced = null,
  unseen = null,
  policy = POSITION_NEXT_POLICY,
} = {}) {
  if (!summary || !Array.isArray(summary.skills) || !summary.storage)
    throw TypeError('WORLD position next: the coach summary is required');
  const lines = new Map(summary.skills.map(line => [line.id, line]));
  const counts = { independent: 0, practicing: 0, notyet: 0 };
  const rows = skills.map(({ id, domain }) => {
    const line = lines.get(id) ?? null;
    const levels = levelsOf(line?.cells, policy);
    const answered = levels.reduce((n, level) => n + level.independent, 0);
    const behind = count(line?.n) - answered;
    const { cell, catching } = catchUp(skillCellOf(id, levels, line, policy, unseen, behind), line, answered);
    counts[cell] += 1;
    // 놓친 수 · 도움받은 수는 아직 혼자 해냄이 아닌 난도 칸에서만(A5) — 먼저 볼 항목 · 약한가 · 숙제 상태가 같은 수를 쓴다.
    const open = levels.filter(level => level.cell !== 'independent');
    return Object.freeze({
      id,
      domain,
      cell,
      catching,
      levels: Object.freeze(levels),
      answered,
      correct: levels.reduce((n, level) => n + level.correct, 0),
      missed: open.reduce((n, level) => n + level.missed, 0),
      helped: open.reduce((n, level) => n + level.helped, 0),
      lastAt: levels.reduce((at, level) => later(at, level.lastAt), null),
      streak: count(line?.streak),
      level: Number.isFinite(line?.level) ? line.level : null,
      peak: Number.isFinite(line?.peak) ? line.peak : null,
    });
  });
  const storage = summary.storage;
  return Object.freeze({
    policy: policy.version,
    exam: positionExamNext(exam),
    total: rows.length,
    counts: Object.freeze(counts),
    skills: Object.freeze(rows),
    domains: domainsOf(rows),
    attention: Object.freeze(attentionOf(rows, prefer, policy)),
    // 표지 셋(§21-3) — 기록이 다 왔는가(아니면 「기록 일부」 줄 · 짧은 진단을 닫는다), 아직 칸에 들지 않은 답(storage.unfolded), 칸이 따라오는 중(능력마다).
    complete: recordsComplete(storage, synced),
    unfolded: count(storage.unfolded) > 0,
    catching: rows.some(row => row.catching),
    carried: carriedOf(summary.carried ?? null, skills, policy),
    learningEffectClaim: false,
    abilityClaim: false,
    grade: null,
  });
}

// ── 돌아올 단위 목록(§21-4 — 옛 「시간을 두고 다시 확인」) ──

// 단위 → 카드를 여는 길. 문항(짧은 연습 · 진단 · 생활)마다 코치의 itemUnits()를 읽어, 이름이 서는 단위만 남긴다(검토 C1 — 문항을 못 찾은
// 단위 · 이름이 null · family: 단위는 싣지 않는다, N3). 생활 단위(kind life — 생활 판정이 복습으로 다시 내는 단위)는 생활 복습으로, 그 밖은 그 단위가
// 든 짧은 연습 문항으로 연다. 생활 문항에 든 낱말 · 문형 단위도 짧은 연습 길이다 — 생활 판정은 생활 단위만 복습으로 내므로(world-life-next.mjs
// lifeUnitsOf), 생활 길로 두면 짧은 연습에 그 낱말이 있어도 「낼 문항 없음」이 된다(생활 문항에 든 이름 있는 낱말 단위 53개 가운데 35개가 짧은
// 연습에도 있다 — 11-16 4c 실측). 소리가 드는 문항뿐이면 listening이다. 진단 문항은 이름만 빌린다(짧은 연습으로 열 문항은 짧은 연습 풀에서만).
export function unitRoutes({ itemUnits, practice = [], diagnostic = [], life = [] } = {}) {
  if (typeof itemUnits !== 'function') throw TypeError('WORLD position next: itemUnits is required');
  const routes = new Map();
  const visit = (items, source) => {
    for (const item of Array.isArray(items) ? items : []) {
      const units = quiet(() => itemUnits(item)) ?? [];
      for (const row of Array.isArray(units) ? units : []) {
        if (!row?.unit || row.kind === 'family' || typeof row.label !== 'string' || !row.label) continue;
        const route = routes.get(row.unit) ?? { unit: row.unit, label: row.label, life: false, items: [], silent: false };
        if (source === 'life' && row.kind === 'life') route.life = true;
        if (source === 'practice' && item?.itemKey && !route.items.includes(item.itemKey)) {
          route.items.push(item.itemKey);
          if (!(item.audioRequired ?? item.modality === 'listening')) route.silent = true;
        }
        routes.set(row.unit, route);
      }
    }
  };
  visit(life, 'life');
  visit(practice, 'practice');
  visit(diagnostic, 'diagnostic');
  return routes;
}

// 카드 목록(최대 열둘) — 지금 돌아온 것(due()의 차례 — 떠올릴 확률이 낮은 것부터) 다음에 앞으로 돌아올 것(dueAt이 이른 것부터).
// 카드마다 「지금 열 수 있는가」와 그 까닭(§21-4 C2 · A6): 아직 돌아올 때가 아님(not-due, dueAt) · 하루 상한(capped) · 소리를 끈 날(audio) ·
// 낼 문항 없음(no-item). 돌아올 때가 정해지지 않은 단위(dueAt이 유한한 수가 아님)는 앞으로 돌아올 목록에서 뺀다.
// 하루 상한은 엔진 전체의 값이라(4-3 GB1) 생활 카드도 상한 날에는 열지 않는다 — 생활 판정(lifeDue)은 상한을 보지 않아 lifeOpen만으로는 열림이
// 된다. 까닭의 차례는 늘 그런 것(낼 문항 없음)이 오늘만 그런 것(상한 · 소리)보다 앞이다. 소리는 짧은 연습 카드만 본다(생활 카드는 전과 같다).
// lifeOpen(unit): 생활 복습이 지금 그 단위를 낼 수 있나(셸의 lifeDue — 모르면 null). capped: 홈 계획의 하루 상한(today.capped — 20-14).
export function recheckCards({
  due = [],
  units = [],
  routes,
  capped = false,
  audioAvailable = true,
  lifeOpen = () => null,
  policy = POSITION_NEXT_POLICY,
} = {}) {
  if (!(routes instanceof Map)) throw TypeError('WORLD position next: unit routes are required');
  const lines = new Map((Array.isArray(units) ? units : []).map(line => [line.unit, line]));
  const now = new Set();
  const cards = [];
  const card = (unit, { dueNow, dueAt, lapses, sittings }) => {
    const route = routes.get(unit);
    if (!route) return;
    let why = null;
    if (!dueNow) why = 'not-due';
    else if (route.life ? quiet(() => lifeOpen(unit)) === false : !route.items.length) why = 'no-item';
    else if (capped) why = 'capped';
    else if (!route.life && !audioAvailable && !route.silent) why = 'audio';
    cards.push(
      Object.freeze({
        unit,
        label: route.label,
        source: route.life ? 'life' : 'practice',
        dueNow,
        dueAt: Number.isFinite(dueAt) ? dueAt : null,
        lapses: count(lapses),
        sittings: count(sittings),
        open: why === null,
        why,
        items: Object.freeze(route.life ? [] : [...route.items]),
      }),
    );
  };
  for (const row of Array.isArray(due) ? due : []) {
    if (!row?.unit || now.has(row.unit)) continue;
    now.add(row.unit);
    const line = lines.get(row.unit);
    card(row.unit, { dueNow: true, dueAt: line?.dueAt, lapses: row.lapses, sittings: row.sittings });
  }
  const ahead = [...lines.values()]
    .filter(line => !now.has(line.unit) && line.due !== true && Number.isFinite(line.dueAt))
    .sort((a, b) => a.dueAt - b.dueAt || (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0));
  for (const line of ahead)
    card(line.unit, { dueNow: false, dueAt: line.dueAt, lapses: line.lapses, sittings: line.sittings });
  return Object.freeze(cards.slice(0, policy.cards));
}

// 예상 급수 칸의 새 길 값(4-4d — 단계4_계획 §21-23의 2). 엔진이 낸 능력 id마다의 근거 수(coach.firstAnswers · 서버 길 계정의 근거 상자)를 시험
// (능력 id 앞머리 — ko. TOPIK I · ko2. TOPIK II)과 영역(둘째 마디 — listening · reading)으로 묶고, 지금 판의 문턱(policy — 셸이 넘기는
// world-position.mjs ESTIMATE_POLICY: 전체 30 · 영역별 10)으로 센다. 꼴은 지금 판 estimateGate와 같다(판 그림이 같은 칸을 그린다). 'world-mock'
// 판은 늘 PBT 줄인 판이고 시간 제한이 있어 그 셋은 따로 보지 않는다. 근거 수를 모르면(bySkill null — 첫 그리기 · 오프라인 · 판 직후 · 읽기가 없는
// 옛 계정 · 완결되지 않은 답) status 'checking'이다 — 수를 그리지 않고, 빈 근거로 문턱을 세지 않는다. 근거를 읽지 못했으면(unread — 서버 길
// 계정의 근거 상자가 그 자리에서 묻기를 그만두었다: 실패 · 완결되지 않은 답 뒤의 상한) status 'unread'다 — 「확인 중」을 두지 않고 수 없이
// 그린다(설계 주인 11-17 저녁 답 4 나). 급수는 내지 않는다(문턱을 넘어도
// 'no-estimator'). IBT로 본다고 한 학생은 지금 판처럼 'mode-unsupported'다.
const ESTIMATE_PREFIX = Object.freeze({ 'topik-i': 'ko', 'topik-ii': 'ko2' });
const ESTIMATE_DOMAINS = Object.freeze(['listening', 'reading']);
export function estimateNext({ bySkill = null, unread = false, form = 'topik-i', mode = null, policy = null } = {}) {
  if (!Number.isSafeInteger(policy?.minEvidence) || !Number.isSafeInteger(policy?.minPerDomain))
    throw TypeError('WORLD estimate next needs the estimate policy');
  const which = form === 'topik-ii' ? 'topik-ii' : 'topik-i';
  const ibt = mode === 'ibt';
  const perDomain = { listening: 0, reading: 0 };
  const base = {
    policy: policy.version ?? null,
    form: which,
    mode: ibt ? 'ibt' : 'pbt',
    visible: false,
    needed: policy.minEvidence,
    neededPerDomain: policy.minPerDomain,
    updatedAt: null,
    range: null,
    grade: null,
    passClaim: false,
  };
  const known = bySkill !== null && typeof bySkill === 'object' && !Array.isArray(bySkill);
  if (!known) return { ...base, status: ibt ? 'mode-unsupported' : unread === true ? 'unread' : 'checking', evidence: 0, perDomain };
  for (const [skill, n] of Object.entries(bySkill)) {
    const [head, domain] = skill.split('.');
    if (head !== ESTIMATE_PREFIX[which] || !ESTIMATE_DOMAINS.includes(domain) || !Number.isSafeInteger(n) || n < 0) continue;
    perDomain[domain] += n;
  }
  const evidence = perDomain.listening + perDomain.reading;
  const enough = evidence >= policy.minEvidence && perDomain.listening >= policy.minPerDomain && perDomain.reading >= policy.minPerDomain;
  return { ...base, status: ibt ? 'mode-unsupported' : enough ? 'no-estimator' : 'too-early', evidence, perDomain };
}
