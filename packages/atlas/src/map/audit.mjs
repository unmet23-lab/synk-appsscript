// 빌드 검사(설계 §4 「빌드가 잡는 것」): 조립한 색인과 단위 목록을 보고 알림을 낸다. 멈춤(빌드 실패)은 조립(compose.mjs)이
// 던지고, 여기서는 지도가 학습자에게 어떻게 돌지를 알리는 숫자만 센다. 순수 함수다 — tools/map-build.mjs가 결과를
// map/audit.json으로 쓰고 시험이 같은 값을 다시 계산해 맞댄다.
//   onlyItem      문항 하나뿐인 단위 — 다른 문제로 다시 낼 수 없다(설계 §3-5 「다시」). 종류별 수(onlyItemByKind)를 함께 낸다 —
//                 레이싱 낱말 판은 낱말마다 문항 하나라 낱말이 목록의 대부분이다
//   (계열 줄은 판마다 다른 열쇠의 문항을 내므로 문항 둘 이상으로 센다 — 같은 계열의 다른 판 문항으로 다시 낼 수 있다)
//   oneFamily     문항은 둘 이상이지만 모두 한 계열 — 다시 내도 같은 답이라 답의 겉을 외운다
//   noItem        문항 없는 단위(종류별 수 · 목록)
//   untagged      태그 없는 문항(계열이 곧 단위) — 은행별 · 전체 비율
//   oneDifficulty 난도가 한 값뿐인 능력 — 작업 난도가 오를 자리가 없다
//   manyUnits     단위가 넷 넘는 문항 — units에는 꼭 떠올려야 하는 것만(설계 §3-1)
export const MANY_UNITS = 4;

const ratio = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 1000 : 0);
const sorted = list => [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// 단위마다 그 단위를 묻는 문항 · 계열(계열 줄은 한 계열이 문항 여럿을 낸다 — 문항 둘 이상으로 센다).
function holders(rows) {
  const byUnit = new Map();
  for (const row of rows) {
    for (const unit of row.units) {
      if (!byUnit.has(unit)) byUnit.set(unit, { items: 0, families: new Set() });
      const entry = byUnit.get(unit);
      entry.items += row.template ? 2 : 1;
      entry.families.add(row.familyKey);
    }
  }
  return byUnit;
}

function untaggedOf(rows) {
  const banks = new Map();
  for (const row of rows) {
    if (!banks.has(row.bank)) banks.set(row.bank, { total: 0, untagged: 0 });
    const entry = banks.get(row.bank);
    entry.total += 1;
    if (!row.units.length) entry.untagged += 1;
  }
  const byBank = Object.fromEntries(
    sorted(banks.keys()).map(bank => {
      const { total, untagged } = banks.get(bank);
      return [bank, { total, untagged, ratio: ratio(untagged, total) }];
    }),
  );
  const total = rows.length;
  const untagged = rows.filter(row => !row.units.length).length;
  return { total, untagged, ratio: ratio(untagged, total), byBank };
}

// 계열 줄은 난도를 판마다 제품이 정하므로(난도 null) 세지 않는다.
function difficultiesOf(rows) {
  const bySkill = new Map();
  for (const row of rows) {
    if (row.difficulty === null || row.difficulty === undefined) continue;
    if (!bySkill.has(row.skillId)) bySkill.set(row.skillId, new Set());
    bySkill.get(row.skillId).add(row.difficulty);
  }
  return sorted(bySkill.keys())
    .filter(skill => bySkill.get(skill).size === 1)
    .map(skill => ({ skillId: skill, difficulty: [...bySkill.get(skill)][0] }));
}

// rows: 살아 있는 문항 줄과 계열 줄({ itemKey?, familyKey, skillId, difficulty, units, bank, template? }).
// units: 지도의 단위 [{ id, kind }].
export function auditMap(rows, units) {
  const byUnit = holders(rows);
  const onlyItem = [];
  const oneFamily = [];
  for (const [unit, entry] of byUnit) {
    if (unit.startsWith('family:')) continue;
    if (entry.items === 1) onlyItem.push(unit);
    else if (entry.families.size === 1) oneFamily.push(unit);
  }
  const noItem = {};
  for (const { id, kind } of units) {
    if (byUnit.has(id)) continue;
    noItem[kind] ??= [];
    noItem[kind].push(id);
  }
  const manyUnits = rows
    .filter(row => row.units.length > MANY_UNITS)
    .map(row => ({ key: row.itemKey ?? row.familyKey, units: row.units.length }));
  const kindOf = new Map(units.map(({ id, kind }) => [id, kind]));
  const onlyItemByKind = {};
  for (const unit of onlyItem) {
    const kind = kindOf.get(unit) ?? 'other';
    onlyItemByKind[kind] = (onlyItemByKind[kind] ?? 0) + 1;
  }
  return {
    onlyItemByKind,
    onlyItem: sorted(onlyItem),
    oneFamily: sorted(oneFamily),
    noItem: Object.fromEntries(
      sorted(Object.keys(noItem)).map(kind => [
        kind,
        { count: noItem[kind].length, units: sorted(noItem[kind]) },
      ]),
    ),
    untagged: untaggedOf(rows),
    oneDifficulty: difficultiesOf(rows),
    manyUnits,
  };
}
