// 이름 붙인 조각(tools/map-ship.mjs — 단계 4 계획 §25-4): 은행 하나에서 목록의 문항만 싣고, 그 문항의 계열 · 낱말 줄만 들며, 색인의 판
// 표지를 그대로 싣는다. 작은 색인으로 본다 — 진짜 지도의 진단 조각은 test/build/map-build.test.mjs가 본다. 변형 실행기가 고친 사본
// (ATLAS_SUBJECT_ROOT)의 map-ship.mjs를 시험한다. 사본에는 map/slices.json이 없으므로 표는 늘 손으로 넘긴다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subjectTool } from '../../support/subject.mjs';

const { mapFileNames, namedSlices, SLICE_FIELDS, SLICES_FORMAT, sliceOf } =
  await subjectTool('map-ship.mjs');

const FIELDS = ['n', 'itemKey', 'f', 'skillId', 'difficulty', 'responseFormat', 'units', 'order'];
const row = (n, bank) => [
  n,
  `${bank}:w${n}:v1`,
  n,
  'ko.listening.word',
  1,
  'single-choice',
  [`ko.word.w${n}`],
  n,
  bank,
  5,
];
// 레이싱 은행 넷 · 다른 은행 하나 · 레이싱 틀 줄 하나의 색인.
const INDEX = {
  format: 'atlas-map-index/1',
  edition: 7,
  skillsEdition: 1,
  hash: 'h7',
  fields: [...FIELDS, 'bank', 'flags'],
  items: [...[1, 2, 3, 4].map(n => row(n, 'korean-racing')), row(5, 'talk-rally')],
  templateFields: ['f', 'skillId', 'units', 'order', 'bank', 'flags'],
  templates: [[90, 'ko.listening.word', [], 0, 'korean-racing', 0]],
  families: [1, 2, 3, 4, 5, 90].map(n => [n, `fam${n}`]),
  shared: [],
  retired: { items: [], families: [] },
  renames: { units: {}, items: {}, families: {} },
};
const WORDS = {
  prefix: 'ko.word.',
  fields: ['id', 'label', 'pos', 'band', 'sense'],
  units: [1, 2, 3, 4, 5].map(n => [`w${n}`, `낱말${n}`, 'n', 1, null]),
};
const tableOf = rows => ({ format: SLICES_FORMAT, fields: [...SLICE_FIELDS], items: rows });
const DIAG = namedSlices(
  tableOf([
    ['korean-racing-diagnostic', 'korean-racing', 'korean-racing:w3:v1'],
    ['korean-racing-diagnostic', 'korean-racing', 'korean-racing:w1:v1'],
  ]),
);

test('이름 붙인 조각은 목록의 문항과 그 계열 · 낱말 줄만 싣는다 — 같은 은행의 다른 문항 · 틀 줄은 없다', () => {
  const slice = sliceOf(INDEX, 'korean-racing-diagnostic', WORDS, DIAG);
  assert.deepEqual(
    slice.items.map(r => r[1]),
    ['korean-racing:w1:v1', 'korean-racing:w3:v1'],
  );
  assert.deepEqual(slice.templates, []);
  assert.deepEqual(slice.families, [
    [1, 'fam1'],
    [3, 'fam3'],
  ]);
  assert.deepEqual(
    slice.words.units.map(([id]) => id),
    ['w1', 'w3'],
  );
  assert.equal(slice.bank, 'korean-racing-diagnostic');
  // 판 표지는 색인 그대로 — 조각 때문에 지도 판 · 제시 사건의 editions가 바뀌지 않는다.
  assert.deepEqual(
    [slice.format, slice.edition, slice.skillsEdition, slice.hash],
    [INDEX.format, INDEX.edition, INDEX.skillsEdition, INDEX.hash],
  );
  // 은행 조각은 그대로다 — 표를 넘겨도 은행 이름으로 물으면 은행 전체.
  assert.equal(sliceOf(INDEX, 'korean-racing', WORDS, DIAG).items.length, 4);
  assert.equal(sliceOf(INDEX, 'korean-racing', WORDS, DIAG).templates.length, 1);
});

test('목록의 문항이 색인의 그 은행에 없으면 조각을 조용히 줄이지 않고 던진다', () => {
  const stale = namedSlices(tableOf([['diag', 'korean-racing', 'korean-racing:w9:v1']]));
  assert.throws(() => sliceOf(INDEX, 'diag', null, stale), /korean-racing:w9:v1/);
  const other = namedSlices(tableOf([['diag', 'korean-racing', 'talk-rally:w5:v1']]));
  assert.throws(() => sliceOf(INDEX, 'diag', null, other), /talk-rally:w5:v1/);
});

test('파일 이름 규칙은 그 은행이 색인에 있는 이름 붙인 조각을 싣고, 은행 이름과 겹치는 조각 이름은 던진다', () => {
  assert.ok(mapFileNames(INDEX, DIAG).includes('items/korean-racing-diagnostic.json'));
  assert.ok(mapFileNames(INDEX, DIAG).includes('items/korean-racing.json'));
  const elsewhere = { ...INDEX, items: [row(5, 'talk-rally')], templates: [] };
  assert.deepEqual(mapFileNames(elsewhere, DIAG), [
    'index.json',
    'units.json',
    'words.json',
    'items/talk-rally.json',
  ]);
  const clash = namedSlices(tableOf([['talk-rally', 'korean-racing', 'korean-racing:w1:v1']]));
  assert.throws(() => mapFileNames(INDEX, clash), /은행 이름과 같다/);
});

test('이름 붙인 조각 표 — 꼴 · 이름 규칙 · 은행 둘에 걸침 · 겹친 문항을 던지고, 없는 표는 빈 표다', () => {
  assert.equal(namedSlices(null).size, 0);
  assert.throws(() => namedSlices({ ...tableOf([]), format: 'x' }), /꼴이 아니다/);
  assert.throws(() => namedSlices({ ...tableOf([]), fields: ['bank'] }), /꼴이 아니다/);
  assert.throws(() => namedSlices(tableOf([['Diag', 'korean-racing', 'k']])), /줄이 틀렸다/);
  assert.throws(() => namedSlices(tableOf([[undefined, 'korean-racing', 'k']])), /줄이 틀렸다/);
  assert.throws(() => namedSlices(tableOf([['diag', 'korean-racing', '']])), /줄이 틀렸다/);
  assert.throws(
    () =>
      namedSlices(
        tableOf([
          ['diag', 'korean-racing', 'a'],
          ['diag', 'talk-rally', 'b'],
        ]),
      ),
    /은행 둘/,
  );
  assert.throws(
    () =>
      namedSlices(
        tableOf([
          ['diag', 'korean-racing', 'a'],
          ['diag', 'korean-racing', 'a'],
        ]),
      ),
    /두 번/,
  );
  assert.deepEqual(DIAG.get('korean-racing-diagnostic'), {
    bank: 'korean-racing',
    keys: ['korean-racing:w3:v1', 'korean-racing:w1:v1'],
  });
});

// 함께 싣는 계열 줄(4-7 — 단계 4 계획 §26-6): WORLD 홈이 늘 받는 조각(world-life)에 한글 단계의 계열 줄을 싣는다. 손님 기기는 판 묶음
// (RECORD_EDITION)이 바뀐 요약을 읽을 때 한 번 다시 접는데, 그때 묶은 색인에 한글 계열 줄이 있어야 옛 한글 답이 글자 단위로 접힌다.
// 문항 줄 · 다른 은행 조각 · 판 표지는 그대로다.
test('world-life 조각은 한글 단계의 계열 줄을 함께 싣고, 다른 조각 · 판 표지는 그대로다(4-7 §26-6)', () => {
  const index = {
    ...INDEX,
    items: [...INDEX.items, row(6, 'world-life')],
    templates: [
      ...INDEX.templates,
      [91, 'ko.hangul.sound', ['ko.hangul.v-a'], 0, 'hangul-stage', 17],
      [92, 'ko.speaking.explain', [], 0, 'drama-pilot', 0],
    ],
    families: [...INDEX.families, [6, 'fam6'], [91, 'hangul-stage.listen_pick.v-a'], [92, 'fam92']],
  };
  const tAt = field => index.templateFields.indexOf(field);
  const home = sliceOf(index, 'world-life', null, new Map());
  assert.deepEqual(
    home.templates.map(t => t[tAt('bank')]),
    ['hangul-stage'],
    '홈 조각에 한글 계열 줄 — 드라마 시범 · 레이싱 틀 줄은 아니다',
  );
  assert.deepEqual(
    home.items.map(item => item[0]),
    [6],
    '문항 줄은 그 은행 것만',
  );
  assert.ok(
    home.families.some(([n]) => n === 91),
    '함께 실은 계열 줄의 계열 번호도 든다',
  );
  assert.deepEqual([home.edition, home.hash], [index.edition, index.hash], '판 표지는 색인 그대로');
  const own = sliceOf(index, 'hangul-stage', null, new Map());
  assert.deepEqual(own.templates, home.templates, '한글 단계 조각의 계열 줄과 같다');
  assert.deepEqual(
    sliceOf(index, 'talk-rally', null, new Map()).templates,
    [],
    '다른 은행 조각에는 싣지 않는다',
  );
});
