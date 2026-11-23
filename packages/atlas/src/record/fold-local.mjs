// 손님 접기 — 바뀐 묶음만(기기 답 저장 빠르게 하기 설계 ③ · 검토 D1 · D2, 11-23). 서버 foldPending의 rebuildGroups → collect → refold를
// 메모리에서 동기로 한다. 들고 있는 것(folding): 지난 접기의 판(stamp — 판 묶음 · 지도 revision · 색인 세대), 묶음마다 쓴 근거 줄, 그때 잘라 지은
// 묶음(cut), 단위 · 계열 · 문항마다 묶음별 근거 줄, 능력마다 그 능력의 만남이 있는 계열, 다섯 갈래 줄 값. 접힌 요약(state.local)과는 따로 든 사건
// 에서 짓는다 — 다른 탭이 쓴 요약을 받아도 이 캐시는 내 것이다.
// 다시 짓는 묶음 = 색인이 그 뒤에 근거 줄을 버린 묶음(사건이 붙었다 — drainTouched) ∪ 지난 접기에서 잘라 지은 묶음(hot > until — 머리가 until
// 뒤라 비었던 묶음도). 처음부터 접은 뒤에도 같은 규칙이라, 그때 until 뒤였던 내 덧붙이기가 다음 접기에 든다(검토 D2). 판이 바뀌었거나 until이
// 줄면 처음부터 짓는다.
// 닿은 단위 · 계열 · 문항 · 능력만 잎 함수로 다시 접는다. 닿은 계열의 근거 줄에 든 능력은 모두 닿는다(첫 만남이 옮겨 가면 그 능력들의 lead가
// 바뀐다 — 서버 refold와 같다). 맵은 처음부터 접은 것(linesOfRows)과 같은 열쇠 차례로 새로 짓는다: 근거 줄을 묶음 차례로 한 번 훑어 단위 ·
// 계열 · 문항 · 능력이 처음 나온 차례를 세우고, 칸은 능력 차례 안에서 계열이 처음 나온 차례로 cellLines를 돌린 차례다(packSummary 바이트가 같다).
import {
  cellLines,
  emptyLines,
  familyLine,
  itemLine,
  skillLine,
  skillRowsFor,
  unitLine,
} from './rows.mjs';

const LANES = ['unit', 'family', 'item'];
const mapOf = (map, key) => {
  if (!map.has(key)) map.set(key, new Map());
  return map.get(key);
};

// 근거 줄 하나가 드는 자리들 — linesOfRows의 byUnit · byFamily · byItem과 같은 거르기.
function lanesOf(row) {
  const out = [
    row.kind === 'unit' || row.kind === 'say' ? ['unit', row.unit] : ['family', row.family],
  ];
  if (row.kind === 'meet' && row.item) out.push(['item', row.item]);
  return out;
}

function bucket(rows) {
  const out = { unit: new Map(), family: new Map(), item: new Map() };
  for (const row of rows)
    for (const [lane, key] of lanesOf(row)) {
      if (!out[lane].has(key)) out[lane].set(key, []);
      out[lane].get(key).push(row);
    }
  return out;
}

const blank = stamp => ({
  stamp,
  until: -1,
  rows: new Map(), // 머리 번호 → 지난 접기에 쓴 근거 줄(빈 묶음은 없다)
  cut: new Set(),
  parts: { unit: new Map(), family: new Map(), item: new Map() }, // 열쇠 → (머리 번호 → 근거 줄)
  skillFamilies: new Map(), // 능력 → (계열 → 그 능력의 만남 수)
  values: {
    unit: new Map(),
    family: new Map(),
    item: new Map(),
    skill: new Map(),
    cells: new Map(),
  },
});

function countSkills(f, rows, step, touched) {
  for (const row of rows) {
    if (row.kind !== 'meet') continue;
    touched.skill.add(row.skill);
    const families = mapOf(f.skillFamilies, row.skill);
    const n = (families.get(row.family) ?? 0) + step;
    if (n > 0) families.set(row.family, n);
    else families.delete(row.family);
    if (!families.size) f.skillFamilies.delete(row.skill);
  }
}

// 묶음 하나의 몫을 앞 근거 줄에서 새 근거 줄로 갈아 끼우고, 두 쪽이 닿는 열쇠를 모은다(서버 collect).
function swap(f, id, after, touched) {
  const before = f.rows.get(id) ?? [];
  for (const [lane, keys] of Object.entries(bucket(before)))
    for (const key of keys.keys()) {
      touched[lane].add(key);
      const parts = f.parts[lane].get(key);
      parts.delete(id);
      if (!parts.size) f.parts[lane].delete(key);
    }
  for (const [lane, keys] of Object.entries(bucket(after)))
    for (const [key, list] of keys) {
      touched[lane].add(key);
      mapOf(f.parts[lane], key).set(id, list);
    }
  countSkills(f, before, -1, touched);
  countSkills(f, after, 1, touched);
  if (after.length) f.rows.set(id, after);
  else f.rows.delete(id);
}

// 그 열쇠의 근거 줄 — 묶음 차례(처음부터 접을 때의 차례)로 잇는다.
const gather = (f, lane, key, seq) =>
  [...(f.parts[lane].get(key) ?? [])]
    .sort(([a], [b]) => seq(a) - seq(b))
    .flatMap(([, rows]) => rows);

const setValue = (map, key, value) => {
  if (value != null) map.set(key, value);
  else map.delete(key);
};

// 처음 나온 차례 — 근거 줄을 묶음 차례로 한 번 훑는다.
function ordersOf(f, ids) {
  const seen = { unit: new Set(), family: new Set(), item: new Set(), skill: new Set() };
  for (const id of ids)
    for (const row of f.rows.get(id) ?? []) {
      for (const [lane, key] of lanesOf(row)) seen[lane].add(key);
      if (row.kind === 'meet') seen.skill.add(row.skill);
    }
  return seen;
}

function refoldSkills(f, touched, seen, seq, params) {
  const position = new Map([...seen.family].map((family, i) => [family, i]));
  for (const skill of touched.skill) {
    const families = [...(f.skillFamilies.get(skill)?.keys() ?? [])]
      .sort((a, b) => position.get(a) - position.get(b))
      .map(family => gather(f, 'family', family, seq));
    const rows = skillRowsFor(skill, families);
    setValue(f.values.skill, skill, skillLine(rows, params));
    const cells = cellLines(skill, rows);
    setValue(f.values.cells, skill, cells.size ? cells : null);
  }
}

function refold(f, touched, seen, seq, { memory, params }) {
  for (const family of touched.family)
    for (const rows of f.parts.family.get(family)?.values() ?? [])
      for (const row of rows) if (row.skill) touched.skill.add(row.skill);
  for (const unit of touched.unit)
    setValue(f.values.unit, unit, unitLine(gather(f, 'unit', unit, seq), memory));
  for (const family of touched.family)
    setValue(f.values.family, family, familyLine(gather(f, 'family', family, seq)));
  for (const item of touched.item)
    setValue(f.values.item, item, itemLine(gather(f, 'item', item, seq)));
  refoldSkills(f, touched, seen, seq, params);
}

function linesOf(f, seen) {
  const lines = emptyLines();
  for (const lane of LANES)
    for (const key of seen[lane]) {
      const value = f.values[lane].get(key);
      if (value != null) lines[lane].set(key, value);
    }
  for (const skill of seen.skill) {
    const value = f.values.skill.get(skill);
    if (value != null) lines.skill.set(skill, value);
    for (const [key, cell] of f.values.cells.get(skill) ?? []) lines.cell.set(key, cell);
  }
  return lines;
}

// prev = 지난 접기(없으면 null), book = 기록부의 묶음 색인(groups.mjs), until = 이번에 접는 포트 열쇠까지. { folding, lines }를 돌려준다 —
// lines는 새 Map이라 요약이 들어도 다음 접기가 고치지 않는다.
export function foldLines(prev, book, until, context) {
  const stamp = book.stamp();
  const touched = book.drainTouched();
  const fresh = !prev || prev.stamp !== stamp || until < prev.until;
  const f = fresh ? blank(stamp) : prev;
  const changed = fresh ? book.all().keys() : new Set([...touched, ...prev.cut]);
  const keys = { unit: new Set(), family: new Set(), item: new Set(), skill: new Set() };
  const cut = new Set();
  for (const id of changed) {
    const at = book.rowsAt(id, until);
    if (at.cut) cut.add(id);
    swap(f, id, at.rows, keys);
  }
  f.cut = cut;
  f.until = until;
  const seen = ordersOf(f, book.all().keys());
  refold(f, keys, seen, book.seq, context);
  return { folding: f, lines: linesOf(f, seen) };
}
