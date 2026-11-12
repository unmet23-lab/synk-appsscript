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
  row.correct += answers.filter(answer => Array.isArray(answer) && answer[2] === 'correct').length;
  row.helped += helped.length;
  const times = [
    ...answers.map(answer => (Array.isArray(answer) ? answer[1] : null)),
    ...helped.map(helpTime),
  ].filter(time => Number.isFinite(time) && Math.abs(time) <= MAX_TIME);
  row.last = Math.max(row.last, ...times);
}

const isPlain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const MAX_TIME = 8.64e15;

// 브라우저 저장소에서 읽은 옛 장부 — 망가진 칸만 건너뛴다(아르곤 끝 판 B7).
export function cellsOf(ledgerCells = {}) {
  const out = new Map();
  if (!isPlain(ledgerCells)) return [];
  for (const [key, cell] of Object.entries(ledgerCells)) {
    if (!isPlain(cell) || !Array.isArray(cell.ind ?? []) || !Array.isArray(cell.helped ?? []))
      continue;
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

// 이미 옮긴 장부들(기록부가 든 record.carried 사건 — 거둔 장부는 없던 것) → 옮긴 계열 · 문항, 마지막으로 옮긴 때.
// 다시 옮기는 장부의 after는 앞 장부를 옮긴 때까지만이다 — 새 판에서 낸 마지막 사건의 때로 늦추지 않는다. 옛 판 게임은 다른 탭에서
// 새 판과 같이 돌 수 있어(4-6까지) 장부에 든 만남이 새 판의 어느 답보다 앞인지 모른다 — 모르는 구간의 답은 첫 만남으로 치지 않는다
// (덜 세는 쪽으로만 틀린다, GPT 끝 판 GD1 · 설계 주인 11-13 — 아르곤 끝 판 B3의 lastOwn을 거둠. 차례대로 다녀온 드문 경우의 첫 답이
// 근거에서 빠지는 것은 받아들인다 — 줄이는 다듬기는 일부만 옮긴 뒤 근거를 부풀리는 길이 된다).
const later = (a, b) => (!a ? (b ?? null) : !b ? a : a > b ? a : b);

export function carriedSoFar(events) {
  const withdrawn = new Set(
    events.filter(event => event.type === EVENT_TYPES.excluded).map(event => event.targetId),
  );
  const ledgers = events.filter(
    event => event.type === EVENT_TYPES.carried && !withdrawn.has(event.id),
  );
  return {
    families: new Set(ledgers.flatMap(event => Object.keys(event.families))),
    items: new Set(ledgers.flatMap(event => Object.keys(event.items))),
    last: ledgers.reduce((at, event) => later(at, event.at), null),
  };
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
    after: soFar.last ?? null,
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
