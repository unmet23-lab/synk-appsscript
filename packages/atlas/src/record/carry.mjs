// 옛 기기 기록 옮기기(설계 §5-6) — 기기에만 있는 기록(손님 · 동의 꺼진 계정)의 옛 로그와 접힌 장부(atlas/learning-ledger.js)를 새 판으로.
//   ① 옛 로그: 실행할 때마다 아직 옮기지 않은 옛 꼴 사건을 옮긴다(옮긴 것은 기록부가 든 번호로 안다 — 손님 기록부는 치우지 않는다).
//   ② 접힌 장부 → record.carried 사건. 처음 옮기는 장부는 만난 표 전부 · 칸 요약(보여 주기만)과 after 없음(어떤 만남보다 먼저).
//      옛 판에 다녀온 뒤 다시 옮기는 장부는 그 사이 새로 든 계열 · 문항만, after = 앞 장부를 옮긴 때(그 사건의 at) —
//      앞서 사건으로 옮긴 답은 그보다 이르므로 첫 만남 자격을 잃지 않고, 다녀온 사이 처음 만난 계열은 그 뒤 답이 첫 만남이 되지 않는다.
//      같은 장부가 두 번 와도 새로 든 것이 없으면 사건을 만들지 않는다(합치는 것은 「있다」를 더하는 일).
// 계정 기기는 옮기지 않는다 — 옛 판의 계정 장부는 서버가 이미 받은 사건만 접었다(learning-ledger.js 머리 주석).
import { EVENT_TYPES } from './events.mjs';

const prefixed = (keys, prefix) =>
  Object.fromEntries(
    Object.entries(keys ?? {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, bits]) => [key.slice(prefix.length), bits])
      .filter(
        ([key]) =>
          /^[a-zA-Z0-9_.:-]{1,120}$/.test(key) &&
          !['__proto__', 'constructor', 'prototype'].includes(key),
      ),
  );

// 장부 칸(「능력|난도|꼴」 → 최근 혼자 낸 첫 답 12개 · 도움받은 답) → 「능력 · 난도」마다 수. 옮겨 오기 전 기록으로 보여 주기만 한다.
const VALID = /^[a-zA-Z0-9_.:-]{1,120}$/;
const helpTime = help => (Array.isArray(help) ? help[1] : help);

function addCell(row, cell) {
  const answers = cell.ind ?? [];
  const helped = cell.helped ?? [];
  row.independent += answers.length;
  row.correct += answers.filter(answer => answer[2] === 'correct').length;
  row.helped += helped.length;
  const times = [...answers.map(answer => answer[1]), ...helped.map(helpTime)].filter(
    Number.isFinite,
  );
  row.last = Math.max(row.last, ...times);
}

export function cellsOf(ledgerCells = {}) {
  const out = new Map();
  for (const [key, cell] of Object.entries(ledgerCells)) {
    const [skillId, difficulty] = key.split('|');
    const level = Number(difficulty);
    if (![1, 2, 3].includes(level) || !VALID.test(skillId)) continue;
    const name = `${skillId}|${level}`;
    if (!out.has(name))
      out.set(name, { skillId, difficulty: level, independent: 0, correct: 0, helped: 0, last: 0 });
    addCell(out.get(name), cell);
  }
  return [...out.values()]
    .map(({ last, ...row }) => ({ ...row, lastAt: last > 0 ? new Date(last).toISOString() : null }))
    .sort((a, b) =>
      a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : a.difficulty - b.difficulty,
    );
}

// 이미 옮긴 장부들(기록부가 든 record.carried 사건) → 옮긴 계열 · 문항, 마지막으로 옮긴 때.
export function carriedSoFar(events) {
  const families = new Set();
  const items = new Set();
  let last = null;
  for (const event of events) {
    if (event.type !== EVENT_TYPES.carried) continue;
    for (const key of Object.keys(event.families)) families.add(key);
    for (const key of Object.keys(event.items)) items.add(key);
    if (!last || event.at > last) last = event.at;
  }
  return { families, items, last };
}

// 장부 하나 → record.carried의 칸(새로 든 것이 없으면 null).
export function carriedFields(
  ledger,
  soFar = { families: new Set(), items: new Set(), last: null },
) {
  if (!ledger || typeof ledger !== 'object') return null;
  const families = prefixed(ledger.keys, 'family:');
  const items = prefixed(ledger.keys, 'item:');
  const fresh = table => Object.fromEntries(Object.entries(table));
  const newFamilies = soFar.last ? omit(families, soFar.families) : fresh(families);
  const newItems = soFar.last ? omit(items, soFar.items) : fresh(items);
  if (!Object.keys(newFamilies).length && !Object.keys(newItems).length) return null;
  return {
    families: newFamilies,
    items: newItems,
    after: soFar.last,
    ...(soFar.last ? {} : { cells: cellsOf(ledger.cells) }),
  };
}

const omit = (table, known) =>
  Object.fromEntries(Object.entries(table).filter(([key]) => !known.has(key)));

// 옛 로그 가운데 아직 옮기지 않은 옛 꼴 사건(로그 순서 그대로 — 기기 차례 열쇠 l.<적힌 시각>.<순번>이 이 순서를 지킨다).
export const legacyToImport = (oldLog, has) =>
  (Array.isArray(oldLog) ? oldLog : []).filter(
    event => event && event.schema === 1 && typeof event.id === 'string' && !has(event.id),
  );
