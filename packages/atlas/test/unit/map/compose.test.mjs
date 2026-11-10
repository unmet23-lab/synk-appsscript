// 조립(src/map/compose.mjs) · 빌드 검사(audit.mjs) · 읽기(index.mjs openMap): 작은 가짜 은행으로 계약을 하나씩 본다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../../support/subject.mjs';

const { changesBetween, composeIndex, ITEM_FIELDS, TEMPLATE_FIELDS, unitName } =
  await subject('map/compose.mjs');
const { auditMap } = await subject('map/audit.mjs');
const { openMap, MAP_FORMAT } = await subject('map/index.mjs');

const skills = new Set(['ko.reading.vocabulary', 'ko.listening.detail', 'ko.hangul.sound']);
const unitIds = new Set(['ko.word.w0001', 'ko.word.w0002', 'ko.grammar.G201', 'ko.hangul.v-a']);
const meta = (itemKey, extra = {}) => ({
  itemKey,
  familyKey: `${itemKey}.f`,
  skillId: 'ko.reading.vocabulary',
  difficulty: 1,
  responseFormat: 'single-choice',
  ...extra,
});
const compose = (banks, extra = {}) =>
  composeIndex({ banks, unitIds, skills, ledger: { items: [], families: [] }, ...extra });

test('맨 문형 코드는 ko.grammar.로 읽고, 나머지는 그대로', () => {
  assert.equal(unitName('G201'), 'ko.grammar.G201');
  assert.equal(unitName('S301'), 'ko.grammar.S301');
  assert.equal(unitName('ko.word.w0001'), 'ko.word.w0001');
});

test('원천의 앞뒤 — 태그 자료 > 규칙 > 제품 conceptIds > 없음(빈 units)', () => {
  const tags = new Map([['b', { units: ['ko.word.w0002'] }]]);
  const out = compose(
    [
      {
        bank: 'g',
        items: [
          meta('a', { conceptIds: ['G201'] }),
          meta('b', { conceptIds: ['G201'] }),
          meta('c'),
        ],
      },
    ],
    { tags },
  );
  const byKey = Object.fromEntries(out.items.map(row => [row.itemKey, row]));
  assert.deepEqual(byKey.a.units, ['ko.grammar.G201']);
  assert.equal(byKey.a.basis, 'product');
  assert.deepEqual(byKey.b.units, ['ko.word.w0002']);
  assert.equal(byKey.b.basis, 'tags');
  assert.deepEqual(byKey.c.units, []);
  assert.equal(byKey.c.basis, 'none');
});

test('멈춤 — 지도에 없는 단위 · 능력 id인 단위 · 모르는 능력 · 난도 밖 · 같은 열쇠의 다른 칸', () => {
  const one = item => () => compose([{ bank: 'g', items: [item] }]);
  assert.throws(one(meta('a', { conceptIds: ['ko.word.w9999'] })), /지도에 없는 단위/);
  assert.throws(one(meta('a', { conceptIds: ['ko.hangul.sound'] })), /능력 id/);
  assert.throws(one(meta('a', { skillId: 'ko.nope' })), /모르는 능력/);
  assert.throws(one(meta('a', { difficulty: 4 })), /난도/);
  assert.throws(
    () =>
      compose([
        { bank: 'g', items: [meta('a')] },
        { bank: 'h', items: [meta('a', { difficulty: 2 })] },
      ]),
    /칸이 다르다/,
  );
});

test('같은 열쇠 · 같은 칸이면 한 줄로 합치고 뒤 은행을 남긴다', () => {
  const out = compose([
    { bank: 'g', items: [meta('a')] },
    { bank: 'h', items: [meta('a')] },
  ]);
  assert.equal(out.items.length, 1);
  assert.deepEqual(out.shared.get('a'), ['h']);
});

test('번호 — 앞 장부를 잇고, 빠진 문항은 retired, order는 은행 차례', () => {
  const first = compose([{ bank: 'g', items: [meta('a'), meta('b')] }]);
  const second = compose([{ bank: 'g', items: [meta('c'), meta('a')] }], {
    ledger: first.ledger,
  });
  const byKey = Object.fromEntries(second.items.map(row => [row.itemKey, row]));
  assert.equal(byKey.a.n, 1);
  assert.equal(byKey.c.n, 3);
  assert.deepEqual(second.retired.items, [[2, 'b']]);
  assert.equal(byKey.c.order, 0);
  assert.equal(byKey.a.order, 1);
});

test('바뀐 문항 — 단위가 바뀌면 changed에 그 칸 이름, order만 바뀌면 아니다', () => {
  const before = compose([{ bank: 'g', items: [meta('a'), meta('b')] }]);
  const after = compose(
    [
      {
        bank: 'g',
        items: [meta('b'), meta('a', { conceptIds: ['G201'] }), meta('c')],
      },
    ],
    { ledger: before.ledger },
  );
  const change = changesBetween(before.items, after.items).items;
  assert.deepEqual(change.changed, [
    {
      n: 1,
      from: {
        f: 1,
        skillId: 'ko.reading.vocabulary',
        difficulty: 1,
        responseFormat: 'single-choice',
        units: [],
        unknownOption: false,
      },
      to: {
        f: 1,
        skillId: 'ko.reading.vocabulary',
        difficulty: 1,
        responseFormat: 'single-choice',
        units: ['ko.grammar.G201'],
        unknownOption: false,
      },
    },
  ]);
  assert.deepEqual(change.added, [3]);
  assert.deepEqual(change.retired, []);
});

test('고아 태그 — 어느 은행에도 없는 열쇠의 태그는 알린다(문항 판이 바뀐 뒤 조용히 버려지지 않게)', () => {
  const tags = new Map([['a.v1', { units: ['ko.word.w0001'] }]]);
  const out = compose([{ bank: 'g', items: [meta('a.v2')] }], { tags });
  assert.deepEqual(out.orphanTags, ['a.v1']);
});

test('같은 은행 안 같은 열쇠 — 칸이 같으면 하나로, 다르면 멈춘다', () => {
  assert.equal(compose([{ bank: 'g', items: [meta('a'), meta('a')] }]).items.length, 1);
  assert.throws(
    () => compose([{ bank: 'g', items: [meta('a'), meta('a', { difficulty: 2 })] }]),
    /칸이 다르다/,
  );
});

const indexOf = out => ({
  format: MAP_FORMAT,
  edition: 1,
  revision: 2,
  fields: ITEM_FIELDS,
  items: out.items.map(row => ITEM_FIELDS.map(field => row[field])),
  templateFields: TEMPLATE_FIELDS,
  templates: out.templates.map(row => TEMPLATE_FIELDS.map(field => row[field])),
  families: out.ledger.families,
  retired: out.retired,
  renames: { units: { 'ko.word.old': 'ko.word.w0001' }, items: {}, families: {} },
});

test('읽기 — 두뇌 꼴 · 태그 없으면 family: · 은퇴는 null · 계열 줄은 제품 값을 얹는다', () => {
  const first = compose([{ bank: 'g', items: [meta('a'), meta('gone')] }]);
  const out = compose(
    [
      { bank: 'g', items: [meta('a', { conceptIds: ['ko.word.w0001'], audioRequired: true })] },
      {
        bank: 'h',
        template: true,
        items: [
          {
            familyKey: 'h.listen.v-a',
            skillId: 'ko.hangul.sound',
            ruleUnits: ['ko.hangul.v-a'],
            audioRequired: true,
          },
        ],
      },
    ],
    { ledger: first.ledger },
  );
  const map = openMap({
    index: indexOf(out),
    units: { units: [['ko.hangul.v-a', 'hangul', 'ㅏ', null]] },
    words: { prefix: 'ko.word.', units: [['w0001', '사과', '명', 'A']] },
  });
  assert.deepEqual(map.editions, { map: 'map-1', index: 'index-2' });
  assert.deepEqual(map.item('a'), {
    itemKey: 'a',
    familyKey: 'a.f',
    skillId: 'ko.reading.vocabulary',
    difficulty: 1,
    responseFormat: 'single-choice',
    units: ['ko.word.w0001'],
    order: 0,
    audioRequired: true,
  });
  assert.ok(Object.isFrozen(map.item('a').units));
  assert.equal(map.item('gone'), null);
  assert.equal(map.itemKeyOf(2), 'gone');
  assert.equal(map.item('nope'), null);
  assert.deepEqual(map.familySkills.get('h.listen.v-a'), ['ko.hangul.sound']);
  const loose = map.item({
    itemKey: 'new.v1',
    familyKey: 'new',
    skillId: 'ko.reading.vocabulary',
    difficulty: 1,
    responseFormat: 'single-choice',
  });
  assert.deepEqual(loose.units, ['family:new']);
  assert.equal(map.itemNumber('new.v1'), null);
  const made = map.item({
    itemKey: 'h.listen.v-a.x',
    familyKey: 'h.listen.v-a',
    difficulty: 2,
    responseFormat: 'binary-choice',
  });
  assert.deepEqual(made.units, ['ko.hangul.v-a']);
  assert.equal(made.difficulty, 2);
  assert.equal(
    map.item({ itemKey: 'h.x', familyKey: 'h.listen.v-a', difficulty: 9, responseFormat: 'x' }),
    null,
  );
  assert.equal(map.unit('ko.word.old').label, '사과');
  assert.equal(map.unit('ko.word.w9999'), null);
  assert.equal(map.unit('family:a.f').kind, 'family');
});

test('태그 없는 문항은 읽을 때 계열이 곧 단위다', () => {
  const out = compose([{ bank: 'g', items: [meta('a')] }]);
  const map = openMap({ index: indexOf(out) });
  assert.deepEqual(map.item('a').units, ['family:a.f']);
});

test('빌드 검사 — 하나뿐 · 한 계열뿐 · 없음 · 태그 없음 · 난도 한 값 · 넷 넘음', () => {
  const rows = [
    { itemKey: 'a', familyKey: 'f1', skillId: 's1', difficulty: 1, units: ['u1'], bank: 'g' },
    { itemKey: 'b', familyKey: 'f2', skillId: 's1', difficulty: 1, units: ['u2'], bank: 'g' },
    { itemKey: 'c', familyKey: 'f2', skillId: 's2', difficulty: 1, units: ['u2'], bank: 'g' },
    { itemKey: 'd', familyKey: 'f3', skillId: 's2', difficulty: 2, units: [], bank: 'h' },
    {
      itemKey: 'e',
      familyKey: 'f4',
      skillId: 's2',
      difficulty: 3,
      units: ['u3', 'u4', 'u5', 'u6', 'u7'],
      bank: 'h',
    },
  ];
  const units = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'].map(id => ({ id, kind: 'word' }));
  const audit = auditMap(rows, units);
  assert.deepEqual(audit.onlyItem, ['u1', 'u3', 'u4', 'u5', 'u6', 'u7']);
  assert.deepEqual(audit.oneFamily, ['u2']);
  assert.deepEqual(audit.noItem, { word: { count: 1, units: ['u8'] } });
  assert.deepEqual(audit.untagged.byBank.h, { total: 2, untagged: 1, ratio: 0.5 });
  assert.equal(audit.untagged.untagged, 1);
  assert.deepEqual(audit.oneDifficulty, [{ skillId: 's1', difficulty: 1 }]);
  assert.deepEqual(audit.manyUnits, [{ key: 'e', units: 5 }]);
});

test('이름 표는 끝까지 따라간다 — 단위 · 문항 · 계열 · family: 단위', () => {
  const first = compose([{ bank: 'g', items: [meta('a')] }]);
  const out = compose([{ bank: 'g', items: [meta('a3', { familyKey: 'f3' })] }], {
    ledger: first.ledger,
    renames: { items: { a: 'a2', a2: 'a3' }, families: { 'a.f': 'f2', f2: 'f3' } },
  });
  const index = {
    ...indexOf(out),
    renames: {
      units: { 'ko.word.x': 'ko.word.y', 'ko.word.y': 'ko.word.w0001' },
      items: { a: 'a2', a2: 'a3' },
      families: { 'a.f': 'f2', f2: 'f3' },
    },
  };
  const map = openMap({ index, words: { units: [['w0001', '사과', '명', 'A']] } });
  assert.equal(map.unit('ko.word.x').label, '사과');
  assert.equal(map.itemNumber('a'), 1);
  assert.equal(map.item('a').itemKey, 'a3');
  assert.equal(map.familyNumber('a.f'), map.familyNumber('f3'));
  assert.equal(map.unit('family:a.f').id, 'family:f3');
});
