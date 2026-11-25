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
  families: out.families,
  format: MAP_FORMAT,
  skillsEdition: 1,
  edition: 2,
  fields: ITEM_FIELDS,
  items: out.items.map(row => ITEM_FIELDS.map(field => row[field])),
  templateFields: TEMPLATE_FIELDS,
  templates: out.templates.map(row => TEMPLATE_FIELDS.map(field => row[field])),
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

test('은행 조각에 실린 낱말 줄로 낱말 표 없이 이름이 선다 — 받은 낱말 표와 함께 쓴다(11-11 단계 4 요청)', () => {
  const out = compose([{ bank: 'g', items: [meta('a', { conceptIds: ['ko.word.w0002'] })] }]);
  const slice = {
    ...indexOf(out),
    words: { prefix: 'ko.word.', units: [['w0002', '개', '명', 'A', '동물 개']] },
  };
  const alone = openMap({ index: [slice] });
  assert.deepEqual(
    [alone.unit('ko.word.w0002').label, alone.unit('ko.word.w0002').sense],
    ['개', '동물 개'],
  );
  assert.equal(alone.unit('ko.word.w0001'), null);
  const both = openMap({ index: [slice], words: { units: [['w0001', '사과', '명', 'A']] } });
  assert.equal(both.unit('ko.word.w0001').label, '사과');
  assert.equal(both.unit('ko.word.w0002').label, '개');
});

test('빈 태그 줄은 제품 conceptIds를 덮는다 — 검수가 「꼭 필요한 단위 없음」으로 정한 문항은 계열 단위로 돈다', () => {
  const tags = new Map([['a', { units: [] }]]);
  const out = compose(
    [{ bank: 'g', items: [meta('a', { conceptIds: ['G201', 'ko.word.w0001'] })] }],
    {
      tags,
    },
  );
  assert.deepEqual(out.items[0].units, []);
  assert.equal(out.items[0].basis, 'tags');
});

test('계열 이름을 바꾸면 색인의 계열 표 · 은퇴 목록은 지금 이름이고, 문항의 계열도 지금 이름이다(아르곤 A1)', () => {
  const first = compose([{ bank: 'g', items: [meta('a'), meta('b')] }]);
  const renames = { items: { b: 'b2' }, families: { 'a.f': 'a.g' } };
  const out = compose([{ bank: 'g', items: [meta('a', { familyKey: 'a.g' })] }], {
    ledger: first.ledger,
    renames,
  });
  assert.deepEqual(out.families[0], [1, 'a.g']);
  assert.deepEqual(out.ledger.families[0], [1, 'a.f'], '장부는 옛 이름 그대로');
  assert.deepEqual(out.retired.items, [[2, 'b2']]);
  const map = openMap({ index: { ...indexOf(out), families: out.families, renames } });
  assert.equal(map.item('a').familyKey, 'a.g');
  assert.equal(map.familyNumber('a.g'), 1);
  assert.equal(map.familyNumber('a.f'), 1);
  assert.equal(map.itemNumber('b'), 2);
});

test('앞 색인에서 되살린 계열 줄(난도 · 꼴 칸 없음)은 같은 계열 줄과 「바뀜」이 아니다(아르곤 A2)', () => {
  const now = {
    f: 9,
    skillId: 's',
    difficulty: null,
    responseFormat: null,
    units: ['u'],
    flags: 0,
  };
  const decoded = { f: 9, skillId: 's', units: ['u'], flags: 0 };
  assert.deepEqual(changesBetween([decoded], [now]).templates.changed, []);
});

test('공유 문항이 든 조각 둘을 합치면 그 문항은 한 번이고, 두 은행 모두에서 보인다(아르곤 A4)', () => {
  const out = compose([
    { bank: 'g', items: [meta('a')] },
    { bank: 'h', items: [meta('a'), meta('b')] },
  ]);
  const whole = indexOf(out);
  const at = whole.fields.indexOf('n');
  const shared = [[1, ['h']]];
  const slice = rows => ({ ...whole, items: rows, shared });
  const map = openMap({
    index: [slice(whole.items.filter(r => r[at] === 1)), slice(whole.items)],
  });
  assert.equal(map.items().length, 2);
  assert.deepEqual(
    map.items('h').map(item => item.itemKey),
    ['a', 'b'],
  );
});

test('이름이 바뀐 문항의 검수 태그가 따라온다 — 옛 열쇠의 태그가 고아가 되지 않는다(Fable 최종 P2-1)', () => {
  const first = compose([{ bank: 'g', items: [meta('a', { conceptIds: ['ko.word.w0001'] })] }]);
  const out = compose([{ bank: 'g', items: [meta('a2', { conceptIds: ['ko.word.w0001'] })] }], {
    ledger: first.ledger,
    tags: new Map([['a', { units: ['ko.word.w0002'] }]]),
    renames: { items: { a: 'a2' } },
  });
  assert.deepEqual(out.items[0].units, ['ko.word.w0002']);
  assert.deepEqual(out.orphanTags, []);
  assert.throws(
    () =>
      compose([{ bank: 'g', items: [meta('a2')] }], {
        ledger: first.ledger,
        tags: new Map([
          ['a', { units: ['ko.word.w0002'] }],
          ['a2', { units: ['ko.word.w0001'] }],
        ]),
        renames: { items: { a: 'a2' } },
      }),
    /둘 다/,
  );
});

test('은퇴 문항은 메타를 든 객체로 물어도 null이고, 은퇴 줄에는 옛 값이 실린다(Fable 최종 P3-1 · P3-2)', () => {
  const first = compose([
    { bank: 'g', items: [meta('a'), meta('gone', { conceptIds: ['G201'] })] },
  ]);
  const out = compose([{ bank: 'g', items: [meta('a')] }], { ledger: first.ledger });
  const map = openMap({ index: indexOf(out) });
  assert.equal(
    map.item({
      itemKey: 'gone',
      familyKey: 'gone.f',
      skillId: 'ko.reading.vocabulary',
      difficulty: 1,
      responseFormat: 'single-choice',
    }),
    null,
  );
  const change = changesBetween(first.items, out.items).items;
  assert.deepEqual(change.retired, [
    {
      n: 2,
      from: {
        f: 2,
        skillId: 'ko.reading.vocabulary',
        difficulty: 1,
        responseFormat: 'single-choice',
        units: ['ko.grammar.G201'],
        unknownOption: false,
      },
    },
  ]);
});

test('단계 3 접기 어댑터가 받는 색인 꼴 — foldIndex { edition, lookup }', () => {
  const out = compose([{ bank: 'g', items: [meta('a', { conceptIds: ['G201'] })] }]);
  const map = openMap({ index: indexOf(out) });
  assert.equal(map.foldIndex.edition, 'index-2');
  assert.equal(
    map.foldIndex.familySkills,
    map.familySkills,
    '기기 얹기가 받는 계열 → 능력도 같은 색인에서',
  );
  assert.deepEqual(map.foldIndex.lookup('a').units, ['ko.grammar.G201']);
  assert.equal(map.foldIndex.lookup('nope'), null);
});

// 4-7 계열 줄 levels(단계 4 계획 §26-4): 계열 줄은 그 계열이 실제로 내는 문항 난도의 집합을 싣는다. levels 밖 난도는 null이고 계열 단위
// 문항으로 새지 않는다(4-7 설계 검토 1회차 P1-2). levels가 없는 계열 줄(드라마 시범 · 서버가 든 옛 색인)은 1~3을 받는다. 옛 꼴 사건의
// 다시 찾기(familyRow · foldIndex.family — §26-6)는 levels를 보지 않는다.
const hangulRow = (familyKey, extra = {}) => ({
  familyKey,
  skillId: 'ko.hangul.sound',
  ruleUnits: ['ko.hangul.v-a'],
  audioRequired: true,
  ...extra,
});
const ask = (map, familyKey, difficulty) =>
  map.item({
    itemKey: `${familyKey}.x${difficulty}`,
    familyKey,
    skillId: 'ko.hangul.sound',
    difficulty,
    responseFormat: 'single-choice',
  });

test('계열 줄 levels — 밖의 난도는 null이고 계열 단위로 새지 않으며, levels 없는 줄은 1~3을 받는다(4-7 §26-4)', () => {
  const out = compose([
    {
      bank: 'h',
      template: true,
      items: [hangulRow('h.match.v-a', { levels: [1, 2] }), hangulRow('h.old')],
    },
  ]);
  assert.deepEqual(
    out.templates.map(row => row.levels),
    [[1, 2], null],
  );
  assert.equal(TEMPLATE_FIELDS.at(-1), 'levels', '칸 끝에 더한다 — 앞 칸 자리는 그대로');
  const map = openMap({ index: indexOf(out) });
  assert.deepEqual(ask(map, 'h.match.v-a', 2).units, ['ko.hangul.v-a']);
  assert.equal(ask(map, 'h.match.v-a', 3), null, 'levels 밖 — family: 단위로 새지 않는다');
  assert.equal(ask(map, 'h.match.v-a', 9), null);
  assert.deepEqual(ask(map, 'h.old', 3).units, ['ko.hangul.v-a'], 'levels 없는 계열 줄은 1~3');
  assert.deepEqual(
    ask(map, 'h.loose', 3).units,
    ['family:h.loose'],
    '계열 줄이 없는 계열(낱말 읽기)은 계열 단위 그대로',
  );
});

test('옛 꼴 다시 찾기 — 계열 → 계열 줄의 지금 이름과 단위, 능력 · levels는 보지 않고 옛 이름도 따라간다(4-7 §26-6)', () => {
  const out = compose([
    { bank: 'h', template: true, items: [hangulRow('h.match.v-a', { levels: [1, 2] })] },
  ]);
  const index = indexOf(out);
  const map = openMap({
    index: { ...index, renames: { ...index.renames, families: { 'h.pair.old': 'h.match.v-a' } } },
  });
  const row = { familyKey: 'h.match.v-a', units: ['ko.hangul.v-a'] };
  assert.deepEqual(map.familyRow('h.match.v-a'), row);
  assert.deepEqual(map.familyRow('h.pair.old'), row, '옛 이름으로 물어도 지금 이름의 줄');
  assert.deepEqual(map.foldIndex.family('h.match.v-a'), row, '서버 접기가 받는 색인에도 든다');
  assert.equal(map.familyRow('h.loose'), null);
  assert.ok(Object.isFrozen(map.familyRow('h.match.v-a').units));
});

test('계열 줄 levels 검사 — 1 · 2 · 3 오름차순만, 빈 배열 · 겹침 · 밖의 값은 멈춘다', () => {
  // 빈 자리만 있는 배열(hole)도 멈춘다 — every는 빈 자리를 건너뛴다(4-7 엔진 검수 GA3).
  const holey = [];
  holey.length = 1;
  for (const levels of [[], [0, 1], [2, 1], [1, 1], [1, 4], '1,2', [1.5], holey])
    assert.throws(
      () => compose([{ bank: 'h', template: true, items: [hangulRow('h.x', { levels })] }]),
      /levels/,
      JSON.stringify(levels),
    );
  // 같은 계열 줄을 은행 둘이 levels만 달리 들면 멈춘다(두뇌가 받는 문항이 달라진다).
  assert.throws(
    () =>
      compose([
        { bank: 'h', template: true, items: [hangulRow('h.x', { levels: [1, 2] })] },
        { bank: 'k', template: true, items: [hangulRow('h.x', { levels: [1, 2, 3] })] },
      ]),
    /칸이 다르다/,
  );
});

test('빌드 검사는 계열 줄의 levels도 센다 — levels 없는 계열 줄은 세지 않는다(4-7 §26-4)', () => {
  const rows = [
    { familyKey: 't1', skillId: 's1', units: ['u1'], bank: 'h', template: true, levels: [1] },
    { familyKey: 't2', skillId: 's2', units: ['u1'], bank: 'h', template: true, levels: [1, 2, 3] },
    { familyKey: 't3', skillId: 's3', units: ['u1'], bank: 'h', template: true, levels: null },
  ];
  const audit = auditMap(rows, [{ id: 'u1', kind: 'hangul' }]);
  assert.deepEqual(audit.oneDifficulty, [{ skillId: 's1', difficulty: 1 }]);
});
