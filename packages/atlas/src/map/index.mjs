// 지도 — Strata의 단위 마디와 문항 색인을 읽는다(설계 §3-1 · §4). 엔진 묶음에 드는 것은 이 파일뿐이다 — 장부 · 조립 · 검사
// (ledger · compose · audit)는 빌드 도구가 쓰고 src/index.mjs가 부르지 않는다. 지도 자료는 엔진 묶음과 따로 판 폴더의
// map/ 아래 index.json · units.json · words.json으로 나간다(설계 §9) — 이 함수는 그 JSON을 받아 조회만 한다.
//
// 두뇌가 읽는 문항(단계 1 ↔ 2 계약): { itemKey, familyKey, skillId, difficulty, responseFormat, units, order,
// unknownOption?, audioRequired? }. units 첫째가 주 단위이고, 태그가 없는 문항은 그 계열이 곧 단위다(['family:<계열>']).
// 은행에서 빠진 문항(retired)은 번호로만 찾고 두뇌 꼴로 내주지 않는다. 판마다 열쇠가 생기는 은행(한글 단계)은 계열 줄
// (templates — 능력 · 단위만)로 적혀 있어 item({ itemKey, familyKey, difficulty, responseFormat })가 계열 줄에 제품이 넘긴
// 난도 · 꼴을 얹어 문항을 만든다(같은 계열 안에서도 판마다 난도 · 보기 수가 바뀐다).
export const STAGE = 1;
export const MAP_FORMAT = 'atlas-map-index/1';
export const UNITS_FORMAT = 'atlas-map-units/1';
export const WORDS_FORMAT = 'atlas-map-words/1';
export const FAMILY_UNIT = 'family:';
export const FLAGS = Object.freeze({ audio: 1, unknown: 2, product: 4, tags: 8, rule: 16 });
export const UNIT_KINDS = Object.freeze(['word', 'grammar', 'life', 'hangul']);

const fail = message => {
  throw new Error(`Atlas map: ${message}`);
};

const rowsOf = (table, fields) =>
  (table ?? []).map(row => Object.fromEntries(fields.map((field, at) => [field, row[at]])));

function brainItem(row, itemKey = row.itemKey) {
  const item = {
    itemKey,
    familyKey: row.familyKey,
    skillId: row.skillId,
    difficulty: row.difficulty,
    responseFormat: row.responseFormat,
    units: Object.freeze(row.units.length ? [...row.units] : [`${FAMILY_UNIT}${row.familyKey}`]),
    order: row.order,
  };
  if (row.flags & FLAGS.unknown) item.unknownOption = true;
  if (row.flags & FLAGS.audio) item.audioRequired = true;
  return Object.freeze(item);
}

function unitTable(units, words) {
  const table = new Map();
  for (const [id, kind, label, level] of units?.units ?? [])
    table.set(id, Object.freeze({ id, kind, label, level: level ?? null }));
  const prefix = words?.prefix ?? 'ko.word.';
  for (const [suffix, label, pos, band] of words?.units ?? []) {
    const id = `${prefix}${suffix}`;
    table.set(id, Object.freeze({ id, kind: 'word', label, level: null, pos, band }));
  }
  return table;
}

function lookups(index) {
  const fields = index.fields;
  const families = new Map((index.families ?? []).map(([n, key]) => [key, n]));
  const familyKeys = new Map((index.families ?? []).map(([n, key]) => [n, key]));
  const withFamily = row => ({ ...row, familyKey: familyKeys.get(row.f) });
  const items = rowsOf(index.items, fields).map(withFamily);
  const templates = rowsOf(index.templates, index.templateFields ?? []).map(withFamily);
  return { families, items, templates };
}

// 계열 줄 + 제품이 넘긴 문항 → 두뇌 꼴. 난도 · 꼴이 없거나 틀리면 만들지 않는다(지어내지 않는다).
function fromTemplate(template, ref) {
  if (!template || typeof ref?.itemKey !== 'string' || !ref.itemKey) return null;
  if (![1, 2, 3].includes(ref.difficulty) || typeof ref.responseFormat !== 'string') return null;
  const flags = template.flags | (ref.unknownOption ? FLAGS.unknown : 0);
  const row = {
    ...template,
    difficulty: ref.difficulty,
    responseFormat: ref.responseFormat,
    flags,
  };
  return brainItem(row, ref.itemKey);
}

// 은행 조각 여럿(한 제품이 받는 것 — map/items/<은행>.json)을 하나로 합친다. 판 · 색인 판이 다르면 섞지 않는다.
function joinSlices(slices) {
  if (!slices.length) fail('색인이 없다');
  const [first] = slices;
  for (const slice of slices) {
    if (slice?.format !== MAP_FORMAT) fail(`색인 꼴이 아니다(${slice?.format})`);
    if (slice.edition !== first.edition || slice.skillsEdition !== first.skillsEdition)
      fail(`색인 판이 섞였다(${first.edition} · ${slice.edition})`);
  }
  if (slices.length === 1) return first;
  const families = new Map(slices.flatMap(slice => slice.families ?? []));
  // 두 은행이 함께 쓰는 문항은 조각마다 들어 있다 — 번호로 한 번만 둔다(아르곤 A4).
  const at = first.fields.indexOf('n');
  const items = new Map(slices.flatMap(slice => (slice.items ?? []).map(row => [row[at], row])));
  const shared = new Map(slices.flatMap(slice => slice.shared ?? []));
  return {
    ...first,
    items: [...items.values()],
    shared: [...shared],
    templates: slices.flatMap(slice => slice.templates ?? []),
    families: [...families],
    retired: {
      items: slices.flatMap(slice => slice.retired?.items ?? []),
      families: slices.flatMap(slice => slice.retired?.families ?? []),
    },
  };
}

// 이름 표를 끝까지 따라간다(a → b → c). 고리면 멈춘다(Fable 설계 검토 P2-4 — 한 홉만 따르면 사슬의 옛 이름이 null).
function follower(renames = {}) {
  return key => {
    const seen = new Set();
    let at = key;
    while (typeof at === 'string' && Object.hasOwn(renames, at)) {
      if (seen.has(at)) fail(`이름 표에 고리가 있다(${key})`);
      seen.add(at);
      at = renames[at];
    }
    return at;
  };
}

// 색인에 줄이 없는 살아 있는 문항(아직 색인을 다시 만들기 전의 새 문항 · 한글 낱말 읽기처럼 규칙 밖의 계열): 제품이 넘긴 능력 ·
// 난도 · 꼴이 온전하면 태그 없는 문항으로 만든다 — 그 계열이 곧 단위이고 번호는 없다(Fable 설계 검토 P2-7). 진도 차례는 맨 뒤.
function unindexed(ref) {
  if (typeof ref?.itemKey !== 'string' || typeof ref.familyKey !== 'string') return null;
  if (typeof ref.skillId !== 'string' || ![1, 2, 3].includes(ref.difficulty)) return null;
  if (typeof ref.responseFormat !== 'string') return null;
  const flags = (ref.unknownOption ? FLAGS.unknown : 0) | (ref.audioRequired ? FLAGS.audio : 0);
  const row = { ...ref, units: [], order: ref.order ?? Number.MAX_SAFE_INTEGER, flags };
  return brainItem(row, ref.itemKey);
}

// 계열 → 그 계열의 문항이 속한 능력들(단계 2의 기기 얹기가 꼭 받는다 — 경계 노트 index.familySkills).
function familySkillsOf(rows) {
  const out = new Map();
  for (const row of rows) {
    if (!out.has(row.familyKey)) out.set(row.familyKey, []);
    if (!out.get(row.familyKey).includes(row.skillId)) out.get(row.familyKey).push(row.skillId);
  }
  return out;
}

function unitLookup(table, renames) {
  const unitName = follower(renames.units);
  const familyName = follower(renames.families);
  return id => {
    const current = unitName(id);
    if (typeof current === 'string' && current.startsWith(FAMILY_UNIT)) {
      const family = familyName(current.slice(FAMILY_UNIT.length));
      return Object.freeze({
        id: `${FAMILY_UNIT}${family}`,
        kind: 'family',
        label: null,
        level: null,
      });
    }
    return table.get(current) ?? null;
  };
}

// 지도를 연다. index는 전체 색인 하나 또는 은행 조각의 배열이고, units · words는 그 제품이 받은 것만 준다
// (없는 단위는 unit()이 null). 옛 이름(renames)으로 물어도 지금 이름의 줄 · 번호를 준다.
export function openMap({ index: given, units = null, words = null } = {}) {
  const index = joinSlices(Array.isArray(given) ? given : [given]);
  const { families, items, templates } = lookups(index);
  const renames = { units: {}, items: {}, families: {}, ...index.renames };
  const itemName = follower(renames.items);
  const familyName = follower(renames.families);
  const retiredKeys = new Map(index.retired?.items ?? []);
  const retiredNumbers = new Map([...retiredKeys].map(([n, key]) => [key, n]));
  const byKey = new Map(items.map(row => [row.itemKey, row]));
  const byNumber = new Map(items.map(row => [row.n, row]));
  const byFamily = new Map(templates.map(row => [row.familyKey, row]));
  const live = row => (row && !retiredKeys.has(row.n) ? row : null);
  const sharedBanks = new Map(index.shared ?? []);
  const inBank = (row, bank) =>
    bank === null || row.bank === bank || (sharedBanks.get(row.n) ?? []).includes(bank);

  const map = {
    // 판 둘: 색인 판(edition — 태그 · 능력 · 난도 · 꼴 · 계열 등 접기 칸이 바뀔 때마다 빌드가 올린다, 단계 3 서버가 이 번호가
    // 바뀌면 다시 접는다)과 능력 분류 판(skillsEdition — 사람이 올린다, 설계 §4 「판 이름」).
    editions: Object.freeze({ map: `map-${index.skillsEdition}`, index: `index-${index.edition}` }),
    familySkills: familySkillsOf([...items, ...templates]),
    item(ref) {
      const row = live(byKey.get(itemName(typeof ref === 'string' ? ref : ref?.itemKey)));
      if (row) return brainItem(row);
      // 은퇴 문항은 메타를 든 객체로 물어도 내지 않는다 — 낡은 제품이 보여도 그 답이 계열 단위에 쌓이지 않게(Fable 최종 P3-1).
      if (typeof ref === 'string' || retiredNumbers.has(itemName(ref?.itemKey))) return null;
      const familyKey = familyName(ref?.familyKey);
      const template = fromTemplate(byFamily.get(familyKey), ref);
      return template ?? unindexed({ ...ref, familyKey });
    },
    items(bank = null) {
      return items.filter(row => live(row) && inBank(row, bank)).map(row => brainItem(row));
    },
    itemNumber: itemKey =>
      byKey.get(itemName(itemKey))?.n ?? retiredNumbers.get(itemName(itemKey)) ?? null,
    itemKeyOf: n => byNumber.get(n)?.itemKey ?? retiredKeys.get(n) ?? null,
    familyNumber: familyKey => families.get(familyName(familyKey)) ?? null,
    unit: unitLookup(unitTable(units, words), renames),
    renamedUnit: follower(renames.units),
  };
  // 단계 3 접기 어댑터(src/record/adapt.mjs)가 받는 색인 꼴 — { edition, lookup(itemKey) }. 계열 줄 문항은 열쇠만으로 못 찾아
  // null이고, 어댑터는 그때 사건에 적힌 값을 쓴다.
  map.foldIndex = Object.freeze({
    edition: map.editions.index,
    lookup: itemKey => map.item(itemKey),
  });
  return Object.freeze(map);
}
