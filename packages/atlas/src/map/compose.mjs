// 조립(설계 §4): 은행에서 뽑은 문항 메타 + 태그 자료 + 번호 장부 → 색인. 순수 함수다 — 원천을 읽는 일은
// tools/map-sources.mjs, 파일 쓰기는 tools/map-build.mjs가 한다. 지도가 틀리면 학습자 기억이 엉뚱한 단위에 쌓이므로,
// 아래 「멈춤」은 고쳐질 때까지 색인을 내지 않는다(알림은 audit.mjs).
//   멈춤: 지도에 없는 단위 · 능력 id와 같은 단위 · 모르는 능력 · 난도가 1 · 2 · 3 밖 · 꼴 · 열쇠가 빈 문항 ·
//         같은 열쇠에 두뇌가 읽는 칸이 다른 두 줄 · 장부 위반
import { currentName, currentRows, extendRows, numberer } from './ledger.mjs';

export const ITEM_FIELDS = Object.freeze([
  'n',
  'itemKey',
  'f',
  'skillId',
  'difficulty',
  'responseFormat',
  'units',
  'order',
  'bank',
  'flags',
]);
// 계열 줄(판마다 열쇠가 생기는 은행): 난도 · 꼴은 판마다 달라 제품이 넘긴 값을 쓴다(계획 §2).
export const TEMPLATE_FIELDS = Object.freeze(['f', 'skillId', 'units', 'order', 'bank', 'flags']);
// 접기가 읽는 칸 — 이것이 바뀌면 색인 판이 오르고 단계 3 서버가 그 문항을 다시 접는다(Fable 설계 검토 P1-1 · P2-5). 번호(n · f)로
// 견주므로 열쇠 이름만 바뀐 것(renames)은 판을 올리지 않는다. order · bank · 소리 칸은 고르기만 바꿔 넣지 않는다.
export const FOLD_FIELDS = Object.freeze([
  'f',
  'skillId',
  'difficulty',
  'responseFormat',
  'units',
  'unknownOption',
]);
const FLAG = { audio: 1, unknown: 2, product: 4, tags: 8, rule: 16 };

// 제품의 conceptIds를 지도 단위 이름으로 읽는다: 맨 문형 코드(G201 · S301)는 ko.grammar.를 붙인다.
export function unitName(concept) {
  return /^[GS]\d{3}$/.test(concept) ? `ko.grammar.${concept}` : concept;
}

const unique = list => [...new Set(list)];

// 원천의 앞뒤: 패키지 태그 자료 > 규칙 단위(계열 이름에서 정해지는 것 — 한글 글자) > 제품의 conceptIds > 없음(계열 단위).
function unitsFor(meta, tag) {
  if (tag) return { units: unique(tag.units), basis: 'tags' };
  if (meta.ruleUnits?.length) return { units: unique(meta.ruleUnits), basis: 'rule' };
  const product = unique((meta.conceptIds ?? []).map(unitName));
  return product.length ? { units: product, basis: 'product' } : { units: [], basis: 'none' };
}

function flagsOf(meta, basis) {
  let flags = 0;
  if (meta.audioRequired) flags |= FLAG.audio;
  if (meta.unknownOption) flags |= FLAG.unknown;
  if (basis === 'product') flags |= FLAG.product;
  if (basis === 'tags') flags |= FLAG.tags;
  if (basis === 'rule') flags |= FLAG.rule;
  return flags;
}

function metaProblems(meta, where, skills, template) {
  const problems = [];
  if (typeof meta.familyKey !== 'string' || !meta.familyKey) problems.push(`${where}: 계열이 없다`);
  if (!skills.has(meta.skillId)) problems.push(`${where}: 모르는 능력 ${meta.skillId}`);
  if (template) return problems;
  if (![1, 2, 3].includes(meta.difficulty))
    problems.push(`${where}: 난도 ${meta.difficulty}(1 · 2 · 3만)`);
  if (typeof meta.responseFormat !== 'string' || !meta.responseFormat)
    problems.push(`${where}: 응답 꼴이 없다`);
  return problems;
}

function unitProblems(units, where, unitIds, skills) {
  const problems = [];
  for (const unit of units) {
    if (skills.has(unit)) problems.push(`${where}: 단위 ${unit}가 능력 id다`);
    else if (!unitIds.has(unit)) problems.push(`${where}: 지도에 없는 단위 ${unit}`);
  }
  return problems;
}

// 접기 칸만 뽑은 값. f는 계열 번호(조립 뒤에만 있다 — 합치기 견줌에서는 familyKey로 대신한다).
export function foldViewOf(row) {
  return {
    f: row.f,
    skillId: row.skillId,
    difficulty: row.difficulty ?? null,
    responseFormat: row.responseFormat ?? null,
    units: row.units,
    unknownOption: !!(row.flags & FLAG.unknown),
  };
}
const sameFold = (a, b) =>
  a.familyKey === b.familyKey &&
  a.flags === b.flags &&
  JSON.stringify(foldViewOf(a)) === JSON.stringify(foldViewOf(b));

// 은행 하나의 줄을 만든다. template 은행은 계열 줄(열쇠가 판마다 생긴다)이다.
function bankRows({ bank, template = false, items }, ctx) {
  return items.map((meta, order) => {
    const key = template ? meta.familyKey : meta.itemKey;
    const where = `${bank} ${key}`;
    if (!template && (typeof meta.itemKey !== 'string' || !meta.itemKey))
      ctx.problems.push(`${bank} ${order}번째: 문항 열쇠가 없다`);
    ctx.problems.push(...metaProblems(meta, where, ctx.skills, template));
    const { units, basis } = unitsFor(meta, ctx.tags.get(key));
    ctx.problems.push(...unitProblems(units, where, ctx.unitIds, ctx.skills));
    return {
      template,
      itemKey: template ? null : meta.itemKey,
      familyKey: meta.familyKey,
      skillId: meta.skillId,
      difficulty: template ? null : meta.difficulty,
      responseFormat: template ? null : meta.responseFormat,
      units,
      basis,
      order,
      bank,
      flags: flagsOf(meta, basis),
    };
  });
}

// 같은 열쇠가 은행 둘 이상에 있으면 두뇌가 읽는 칸이 모두 같을 때만 한 줄로 합친다(뒤 은행은 shared에 남긴다).
function mergeShared(rows, problems) {
  const byKey = new Map();
  const shared = new Map();
  for (const row of rows) {
    const key = row.template ? `family:${row.familyKey}` : row.itemKey;
    const first = byKey.get(key);
    if (!first) {
      byKey.set(key, row);
      continue;
    }
    if (!sameFold(first, row)) problems.push(`${key}: ${first.bank}와 ${row.bank}의 칸이 다르다`);
    else if (first.bank !== row.bank) shared.set(key, [...(shared.get(key) ?? []), row.bank]);
  }
  return { rows: [...byKey.values()], shared };
}

// banks: [{ bank, template?, items: [meta] }] — meta는 { itemKey, familyKey, skillId, difficulty, responseFormat,
// conceptIds?, audioRequired?, unknownOption? }. tags: Map(열쇠 → { units }) — 검수를 통과한 줄만 준다.
// unitIds · skills: Set. ledger: { items, families } 장부 줄. renames: { units, items, families }.
// 태그 열쇠를 지금 이름으로 옮긴다 — 문항 · 계열 이름을 바꿔도 검수된 태그가 따라온다(Fable 최종 P2-1).
// 옛 이름과 새 이름 둘 다에 태그 줄이 있으면 어느 쪽이 검수본인지 모르므로 멈춘다.
function tagsNow(tags, renames, problems) {
  const out = new Map();
  for (const [key, line] of tags) {
    const now = currentName(currentName(key, renames.items), renames.families);
    if (out.has(now)) problems.push(`태그 줄이 옛 이름과 새 이름에 둘 다 있다(${now})`);
    out.set(now, line);
  }
  return out;
}

export function composeIndex({ banks, tags = new Map(), unitIds, skills, ledger, renames = {} }) {
  const problems = [];
  const ctx = { tags: tagsNow(tags, renames, problems), unitIds, skills, problems };
  const merged = mergeShared(
    banks.flatMap(bank => bankRows(bank, ctx)),
    ctx.problems,
  );
  for (const [unit] of Object.entries(renames.units ?? {}))
    if (merged.rows.some(row => row.units.includes(unit)))
      ctx.problems.push(`옛 단위 이름 ${unit}가 아직 쓰인다(이름 표를 따라 새 이름으로)`);
  if (ctx.problems.length) throw new Error(`Atlas map: ${ctx.problems.join('\n')}`);
  const keys = new Set(merged.rows.map(row => (row.template ? row.familyKey : row.itemKey)));
  const orphanTags = [...ctx.tags.keys()].filter(key => !keys.has(key)).sort();
  const items = merged.rows.filter(row => !row.template);
  const templates = merged.rows.filter(row => row.template);
  const itemLedger = extendRows(
    ledger?.items ?? [],
    unique(items.map(row => row.itemKey)),
    renames.items,
  );
  const familyLedger = extendRows(
    ledger?.families ?? [],
    unique(merged.rows.map(row => row.familyKey)),
    renames.families,
  );
  const itemNumber = numberer(itemLedger.rows, renames.items);
  const familyNumber = numberer(familyLedger.rows, renames.families);
  for (const row of merged.rows) {
    row.n = row.template ? null : itemNumber(row.itemKey);
    row.f = familyNumber(row.familyKey);
  }
  const liveItems = new Set(items.map(row => row.n));
  const liveFamilies = new Set(merged.rows.map(row => row.f));
  return {
    items: items.sort((a, b) => a.n - b.n),
    templates: templates.sort((a, b) => a.f - b.f),
    shared: merged.shared,
    orphanTags,
    ledger: { items: itemLedger.rows, families: familyLedger.rows },
    // 색인에 싣는 계열 표 · 은퇴 목록은 지금 이름이다 — 장부는 옛 이름 그대로 둔다(아르곤 A1).
    families: currentRows(familyLedger.rows, renames.families),
    // 은퇴 = 장부에 있지만 지금 은행에 없는 것. 만난 표가 번호로 오므로 번호 → 열쇠를 색인이 든다.
    retired: {
      items: currentRows(itemLedger.rows, renames.items).filter(([n]) => !liveItems.has(n)),
      families: currentRows(familyLedger.rows, renames.families).filter(
        ([n]) => !liveFamilies.has(n),
      ),
    },
  };
}

// 앞 색인 줄과 견줘 바뀐 것(Fable 설계 검토 P1-1): 문항은 번호(n), 계열 줄은 계열 번호(f)로 견주고, 바뀐 줄마다 옛 값 · 새 값의
// 접기 칸을 함께 낸다 — 서버는 옛 판 색인을 들고 있지 않아도 from.units(옛 단위) · to.units(새 단위)와 from.f · to.f(만남)를
// 다시 접을 수 있다. 능력 · 난도 · 꼴이 바뀌면 능력 줄도 다시 접어야 하므로 모두 싣는다.
function diffBy(before, after, id) {
  const old = new Map(before.map(row => [row[id], row]));
  const now = new Map(after.map(row => [row[id], row]));
  const changed = [];
  const added = [];
  for (const [key, row] of now) {
    const prev = old.get(key);
    if (!prev) added.push(key);
    else if (JSON.stringify(foldViewOf(prev)) !== JSON.stringify(foldViewOf(row)))
      changed.push({ [id]: key, from: foldViewOf(prev), to: foldViewOf(row) });
  }
  // 은퇴 줄에도 옛 값을 싣는다 — 서버가 옛 판 색인 없이 그 문항의 답이 적혀 있던 단위를 거둔다(Fable 최종 P3-2).
  const retired = [...old.keys()]
    .filter(key => !now.has(key))
    .map(key => ({ [id]: key, from: foldViewOf(old.get(key)) }));
  return { changed, added, retired };
}

export function changesBetween(before, after) {
  const items = rows => rows.filter(row => row.n !== null && row.n !== undefined);
  const templates = rows => rows.filter(row => row.n === null || row.n === undefined);
  return {
    items: diffBy(items(before), items(after), 'n'),
    templates: diffBy(templates(before), templates(after), 'f'),
  };
}
