// 커밋된 지도 생성물(packages/atlas/map/*.json)이 계약을 지키나 — 제품 코드 없이 파일만 읽는다. 다시 만든 값과의 대조(drift)는
// test/build/map-build.test.mjs가 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT, subject } from '../../support/subject.mjs';

const { openMap, UNIT_KINDS } = await subject('map/index.mjs');
const { auditMap } = await subject('map/audit.mjs');
const { checkRows, currentName } = await subject('map/ledger.mjs');

// 지도 자료는 시험 대상(src)이 아니라 패키지의 생성물이다 — 변형 사본이 아니라 패키지의 것을 읽는다.
const read = name => JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'map', name), 'utf8'));
const index = read('index.json');
const units = read('units.json');
const words = read('words.json');
const numbers = read('numbers.json');
const audit = read('audit.json');
const { revisions } = read('revisions.json');
const map = openMap({ index, units, words });
const rowsOf = (table, fields) =>
  table.map(row => Object.fromEntries(fields.map((field, at) => [field, row[at]])));
const familyKey = new Map(index.families);
// 계열 줄에는 template 표시를 붙인다 — 빌드 검사가 계열 줄을 문항 둘 이상으로 센다(아르곤 A5).
const rows = [
  ...rowsOf(index.items, index.fields),
  ...rowsOf(index.templates, index.templateFields).map(row => ({ ...row, template: true })),
].map(row => ({ ...row, familyKey: familyKey.get(row.f) }));

test('장부는 1부터 빈틈없고, 색인의 번호 · 은퇴는 장부와 맞는다', () => {
  assert.deepEqual(checkRows(numbers.items, 'items'), []);
  assert.deepEqual(checkRows(numbers.families, 'families'), []);
  const ledger = new Map(numbers.items);
  // 장부는 옛 이름 그대로, 색인의 살아 있는 · 은퇴 문항은 이름 표를 따라간 지금 이름이다(GPT 보충 검수 GA2).
  const now = n => currentName(ledger.get(n), index.renames.items);
  for (const row of rowsOf(index.items, index.fields)) assert.equal(now(row.n), row.itemKey);
  for (const [n, key] of index.retired.items) assert.equal(now(n), key);
  // 색인의 계열 표는 장부의 번호 그대로, 이름은 이름 표를 따라간 지금 이름이다(아르곤 A1).
  assert.deepEqual(
    index.families.map(([n]) => n),
    numbers.families.map(([n]) => n),
  );
  for (const [n, key] of index.families)
    assert.equal(currentName(numbers.families[n - 1][1], index.renames.families), key);
});

test('모든 단위가 지도 안에 있고, 단위 종류는 넷이며 능력 id와 겹치지 않는다', () => {
  const kinds = new Set(units.units.map(([, kind]) => kind));
  for (const kind of kinds) assert.ok(UNIT_KINDS.includes(kind), kind);
  const skills = new Set(rows.map(row => row.skillId));
  for (const row of rows)
    for (const unit of row.units) {
      assert.ok(map.unit(unit), `${row.itemKey ?? row.familyKey} ${unit}`);
      assert.equal(skills.has(unit), false, unit);
    }
});

test('살아 있는 문항은 모두 두뇌 꼴로 읽힌다(계약 칸 · 난도 1~3 · 단위 하나 이상)', () => {
  for (const row of rowsOf(index.items, index.fields)) {
    const item = map.item(row.itemKey);
    assert.ok(item, row.itemKey);
    assert.ok([1, 2, 3].includes(item.difficulty), row.itemKey);
    assert.ok(item.units.length >= 1, row.itemKey);
    assert.equal(typeof item.order, 'number');
  }
});

test('판 목록의 마지막이 색인 판이다 — 해시도 같다', () => {
  const last = revisions.at(-1);
  assert.equal(last.edition, index.edition);
  assert.equal(last.hash, index.hash);
  assert.deepEqual(map.editions, {
    map: `map-${index.skillsEdition}`,
    index: `index-${index.edition}`,
  });
});

test('빌드 검사 보고는 지금 색인으로 다시 센 값과 같다', () => {
  const catalog = [
    ...units.units.map(([id, kind]) => ({ id, kind })),
    ...words.units.map(([id]) => ({ id: `${words.prefix}${id}`, kind: 'word' })),
  ];
  const again = auditMap(rows, catalog);
  for (const [key, value] of Object.entries(again)) assert.deepEqual(audit[key], value, key);
});
