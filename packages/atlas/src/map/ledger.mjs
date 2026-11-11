// 번호 장부(설계 §4): 문항 · 계열 번호는 1부터 덧붙이기만 하는 정수다. 은행에서 빠진 열쇠도 줄이 남는다 — 만난 표가 번호로
// 주고받으므로, 번호를 다시 쓰면 옛 기록이 다른 문항을 가리킨다. 장부의 줄은 바뀌지 않는다. 열쇠 이름이 바뀌면
// renames(옛 → 새)가 옛 줄의 번호를 잇는다. 순수 함수다 — 파일은 tools/map-build.mjs가 읽고 쓴다.
export const LEDGER_KINDS = Object.freeze(['items', 'families']);

const fail = message => {
  throw new Error(`Atlas map ledger: ${message}`);
};

// 새 열쇠 → 옛 열쇠를 따라가 장부에 있는 열쇠를 찾는다(a → b → c 사슬도). 고리가 있으면 멈춘다.
function rootOf(key, back) {
  const seen = new Set();
  let at = key;
  while (back.has(at)) {
    if (seen.has(at)) fail(`이름 표에 고리가 있다(${key})`);
    seen.add(at);
    at = back.get(at);
  }
  return at;
}

function backOf(renames = {}) {
  const back = new Map();
  for (const [from, to] of Object.entries(renames)) {
    if (back.has(to)) fail(`두 옛 이름이 한 새 이름으로 간다(${to})`);
    back.set(to, from);
  }
  return back;
}

// 장부 줄 [[n, key]] 하나의 모양을 본다: 1..N 연속 · 열쇠 중복 없음.
export function checkRows(rows, kind = 'items') {
  const problems = [];
  const keys = new Set();
  rows.forEach((row, at) => {
    const [n, key] = Array.isArray(row) ? row : [];
    if (n !== at + 1) problems.push(`${kind}: ${at + 1}번째 줄의 번호가 ${n}이다(1부터 빈틈없이)`);
    if (typeof key !== 'string' || !key) problems.push(`${kind}: ${n}번 열쇠가 비었다`);
    else if (keys.has(key)) problems.push(`${kind}: 열쇠 ${key}가 두 번 있다`);
    keys.add(key);
  });
  return problems;
}

// 옛 이름 → 지금 이름(이름 표를 앞으로 끝까지). 장부 줄은 옛 이름 그대로 두고, 색인 · 읽기는 지금 이름을 쓴다(아르곤 A1).
export function currentName(key, renames = {}) {
  const seen = new Set();
  let at = key;
  while (Object.hasOwn(renames, at)) {
    if (seen.has(at)) fail(`이름 표에 고리가 있다(${key})`);
    seen.add(at);
    at = renames[at];
  }
  return at;
}
export const currentRows = (rows, renames = {}) =>
  rows.map(([n, key]) => [n, currentName(key, renames)]);

// 열쇠 → 번호. 이름이 바뀐 새 열쇠는 옛 줄의 번호를 받는다.
export function numberer(rows, renames = {}) {
  const byKey = new Map(rows.map(([n, key]) => [key, n]));
  const back = backOf(renames);
  return key => byKey.get(key) ?? byKey.get(rootOf(key, back)) ?? null;
}

// 이름 표가 장부와 맞나(Fable 설계 검토 P2-3): 옛 이름은 장부(또는 사슬)에 있어야 하고 — 없으면 오타가 새 문항이 된다 —,
// 새 이름이 이미 장부에 다른 번호로 있으면 안 된다(옛 이름의 기억이 고아가 된다).
export function checkRenames(rows, renames = {}) {
  const byKey = new Map(rows.map(([n, key]) => [key, n]));
  const back = backOf(renames);
  const problems = [];
  for (const [from, to] of Object.entries(renames)) {
    const root = rootOf(from, back);
    if (!byKey.has(root)) problems.push(`이름 표의 옛 이름 ${from}가 장부에 없다`);
    else if (byKey.has(to) && byKey.get(to) !== byKey.get(root))
      problems.push(
        `새 이름 ${to}가 이미 ${byKey.get(to)}번이다(옛 이름 ${from}는 ${byKey.get(root)}번)`,
      );
  }
  return problems;
}

// 지금 열쇠들(차례대로)에 번호를 준다. 장부에 없는 열쇠만 끝에 덧붙인다. 옛 이름과 새 이름이 함께 살아 있으면 멈춘다
// (같은 번호를 두 문항이 나눠 가질 수 없다).
export function extendRows(rows, keys, renames = {}) {
  const problems = [...checkRows(rows), ...checkRenames(rows, renames)];
  if (problems.length) fail(problems.join(' · '));
  const live = new Set(keys);
  const back = backOf(renames);
  // 한 사슬(같은 장부 줄)에서 나온 이름은 하나만 살아 있어야 한다 — 옛 이름과 새 이름뿐 아니라 사슬 중간 이름과 끝 이름(a → a2 →
  // a3에서 a2 · a3)도(GPT 보충 검수 GA1: 둘 다 a의 번호를 받았다).
  const byRoot = new Map();
  for (const key of live) {
    const root = rootOf(key, back);
    if (root !== key && live.has(root)) fail(`옛 이름 ${root}와 새 이름 ${key}가 함께 있다`);
    if (byRoot.has(root))
      fail(`이름 사슬 ${root}의 두 이름 ${byRoot.get(root)} · ${key}가 함께 있다`);
    byRoot.set(root, key);
  }
  const number = numberer(rows, renames);
  const next = rows.map(row => [...row]);
  const added = [];
  for (const key of live) {
    if (number(key) !== null) continue;
    const n = next.length + 1;
    next.push([n, key]);
    added.push(n);
  }
  return { rows: next, added };
}

// 덧붙이기만인가: 앞 장부의 줄이 새 장부에 같은 번호 · 같은 열쇠로 모두 남았나.
export function appendOnly(before, after) {
  const problems = [];
  for (const kind of LEDGER_KINDS) {
    const later = after?.[kind] ?? [];
    for (const [n, key] of before?.[kind] ?? []) {
      const row = later[n - 1];
      if (!row || row[0] !== n || row[1] !== key)
        problems.push(`${kind}: ${n}번(${key})이 바뀌거나 빠졌다`);
    }
  }
  return problems;
}
