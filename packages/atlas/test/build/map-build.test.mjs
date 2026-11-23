// 지도를 엔진과 따로 내는 길(tools/map-ship.mjs · build.mjs)과 지도 원천 대조(tools/map-build.mjs).
//   · 빌드 나무의 atlas/<판>/map/ — 전체 색인 · 단위 · 낱말 · 은행 조각, manifest의 map 칸, 같은 커밋이면 같은 바이트
//   · 제품 은행에서 다시 뽑은 색인이 커밋된 것과 같은가 — 단계 4 전까지는 알림(t.diagnostic)이다(계획 §7): 지금은 어느 제품도
//     새 지도를 읽지 않으므로 게임 문항을 고친 다른 세션의 push를 막지 않는다
//   · 한글 계열 줄의 꼴 목록이 제품 원문(core.mjs TYPES)과 같은가
//   · 진단의 레이싱 조각(단계 4 계획 §25-4) — 목록이 진단 풀 표와 같고(어긋나면 알림이 아니라 실패), 조각에 그 문항 · 계열 · 낱말 줄만
//     있고, 크기 도구가 이름으로 짚은 상한으로 재며, 조각을 더해도 index.json 바이트 · 지도 판 표지 · 제시 사건의 editions가 그대로다
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createCoach } from '../../src/coach/index.mjs';
import { PARAMS } from '../../src/params.mjs';
import { memoryPort } from '../../src/record/port.mjs';
import { checkBudget } from '../../tools/budget.mjs';
import { build, PACKAGE_ROOT } from '../../tools/build.mjs';
import {
  buildMap,
  driftOf,
  familyRenameCandidates,
  foldHash,
  loadTags,
  nextEdition,
} from '../../tools/map-build.mjs';
import { agreementOf, argonGroup, lineFor, packetDrift } from '../../tools/map-tags.mjs';
import { openMap } from '../../src/map/index.mjs';
import {
  banksOf,
  MAP_DIR,
  mapFiles,
  readSlices,
  SLICE_WORDS_MAX,
  sliceOf,
} from '../../tools/map-ship.mjs';
import { HANGUL_TYPES, REPO_ROOT, readSliceSources } from '../../tools/map-sources.mjs';
import { tempDir } from '../support/temp.mjs';

const STATE = { commit: 'b'.repeat(40), dirty: false };
const first = await build({ out: tempDir('atlas-map-a-'), state: STATE });
const second = await build({ out: tempDir('atlas-map-b-'), state: STATE });
const mapDir = result => path.join(result.out, 'atlas', result.edition, 'map');
const index = JSON.parse(fs.readFileSync(path.join(MAP_DIR, 'index.json'), 'utf8'));
// 원천에서 다시 만든 지도 — 어긋남 대조 둘이 함께 쓴다(한 번만 짓는다).
let rebuilt = null;
const rebuild = () => {
  rebuilt ??= buildMap();
  return rebuilt;
};

test('판 폴더의 map/ — 전체 색인 · 단위 · 낱말 · 은행마다 조각 · 이름 붙인 조각, manifest가 바이트 · sha256을 든다', () => {
  const expected = [
    'index.json',
    'units.json',
    'words.json',
    ...banksOf(index).map(bank => `items/${bank}.json`),
    ...[...readSlices(MAP_DIR).keys()].map(name => `items/${name}.json`),
  ].sort();
  assert.deepEqual(Object.keys(first.manifest.map.files).sort(), expected);
  for (const name of expected) {
    const bytes = fs.readFileSync(path.join(mapDir(first), name));
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(first.manifest.map.files[name].sha256, sha, name);
    assert.deepEqual(bytes, fs.readFileSync(path.join(mapDir(second), name)), name);
  }
  assert.equal(first.manifest.map.edition, index.edition);
  assert.equal(first.manifest.map.skillsEdition, index.skillsEdition);
  assert.equal(first.manifest.map.hash, index.hash);
});

test('은행 조각은 그 은행 줄과 그 줄의 계열만 — 조각을 모두 합치면 살아 있는 문항이 빠짐없다', () => {
  const at = index.fields.indexOf('n');
  const seen = new Set();
  for (const bank of banksOf(index)) {
    const slice = sliceOf(index, bank);
    const families = new Set(slice.families.map(([n]) => n));
    for (const row of slice.items) {
      seen.add(row[at]);
      assert.ok(families.has(row[index.fields.indexOf('f')]), `${bank} ${row[at]}`);
    }
  }
  assert.equal(seen.size, index.items.length);
});

test('은행 조각의 낱말 줄은 그 조각이 쓰는 낱말 전부 — 낱말 표와 같은 줄, 상한을 넘는 은행(레이싱)은 싣지 않는다', () => {
  const words = JSON.parse(fs.readFileSync(path.join(MAP_DIR, 'words.json'), 'utf8'));
  const rows = new Map(words.units.map(row => [`${words.prefix}${row[0]}`, row]));
  const [uAt, tAt] = [index.fields.indexOf('units'), index.templateFields.indexOf('units')];
  for (const bank of banksOf(index)) {
    const slice = sliceOf(index, bank, words);
    const used = new Set(
      [...slice.items.flatMap(row => row[uAt]), ...slice.templates.flatMap(row => row[tAt])].filter(
        unit => unit.startsWith(words.prefix),
      ),
    );
    if (!used.size || used.size > SLICE_WORDS_MAX) {
      assert.equal(slice.words, undefined, bank);
      continue;
    }
    assert.deepEqual(
      slice.words.units,
      words.units.filter(([suffix]) => used.has(`${words.prefix}${suffix}`)),
      bank,
    );
    const map = openMap({ index: [slice] });
    for (const unit of used)
      assert.equal(map.unit(unit)?.label, rows.get(unit)[1], `${bank} ${unit}`);
  }
  assert.equal(sliceOf(index, 'korean-racing', words).words, undefined);
});

test('한글 계열 줄의 꼴은 제품 원문(core.mjs TYPES)과 같다', () => {
  const core = fs.readFileSync(path.join(REPO_ROOT, 'experiences/hangul-stage/core.mjs'), 'utf8');
  const types = /const TYPES = Object\.freeze\(\[([^\]]+)\]\)/.exec(core)?.[1];
  assert.deepEqual(
    [...types.matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort(),
    [...HANGUL_TYPES].sort(),
  );
});

test('제품 은행에서 다시 만든 지도 = 커밋된 지도(어긋나면 단계 4 전까지 알림)', async t => {
  const { files } = await rebuild();
  const drift = driftOf(files);
  if (drift.length)
    t.diagnostic(
      `지도 생성물이 제품 은행과 어긋난다 — ${drift.join(' · ')} (node packages/atlas/tools/map-build.mjs --write)`,
    );
  assert.ok(Array.isArray(drift));
});

test('계열 이름 후보 — 이름 표에 적힌 짝은 후보가 아니다(Fable 최종 P2-2)', () => {
  const previous = {
    fields: [
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
    ],
    items: [
      [1, 'x', 1, 's', 1, 'single-choice', [], 0, 'g', 0],
      [2, 'y', 1, 's', 1, 'single-choice', [], 1, 'g', 0],
    ],
    templateFields: [],
    templates: [],
    families: [[1, 'A']],
  };
  const rows = [
    { n: 1, itemKey: 'x', familyKey: 'B' },
    { n: 2, itemKey: 'y', familyKey: 'B' },
  ];
  assert.deepEqual(familyRenameCandidates(previous, rows), [['A', 'B']]);
  assert.deepEqual(familyRenameCandidates(previous, rows, { A: 'B' }), []);
});

test('태그 판정 — 둘이 일치해도 지도 밖 단위면 판정으로 돌린다(Fable 최종 P2-3)', () => {
  const known = new Set(['ko.word.w0001']);
  const both = units => ({
    draft: units,
    first: { verdict: 'pass', units },
    second: { verdict: 'pass', units },
  });
  assert.deepEqual(agreementOf(both(['ko.word.w0001']), known).units, ['ko.word.w0001']);
  assert.equal(agreementOf(both(['낱말:없는말']), known), null);
  const fixed = {
    draft: [],
    first: { verdict: 'fix', units: ['ko.word.w0001'] },
    second: { verdict: 'fix', units: ['ko.word.w0001'] },
  };
  assert.equal(agreementOf(fixed, known).verdict, 'fixed');
  assert.equal(agreementOf({ ...fixed, second: { verdict: 'pass', units: [] } }, known), null);
});

test('태그 검수 관문 — 끝 표식 없는 답은 저장하지 않고, 1차 · 2차 없이 판정만으로 줄을 쓰지 않고, 준비 뒤 바뀐 기준 글 · 단위 목록은 멈춘다(GPT 보충 검수 GB1~GB3)', async () => {
  const outFile = path.join(tempDir('atlas-map-tags-'), 'argon.json');
  const group = [{ key: 'a', bank: 'g', skillId: 's', show: '', hints: [] }];
  const context = verdicts => ({
    call: async () => ({ text: JSON.stringify({ verdicts, end: false }) }),
    rubric: '',
    drafts: { a: [] },
    grammar: '',
    labels: new Map(),
    state: { model: 'x', calls: [], results: {} },
    outFile,
  });
  const ctx = context([{ key: 'a', verdict: 'pass', units: [], why: '' }]);
  await argonGroup(group, ctx);
  assert.deepEqual(ctx.state.results, {});
  assert.match(ctx.state.calls[0].error, /끝 표식/);
  // 끝 표식이 있어도 묶음의 문항 가운데 판정이 빠졌으면 묶음을 통째로 저장하지 않는다(다시 검수).
  const two = [...group, { ...group[0], key: 'b' }];
  const partial = {
    ...context([]),
    drafts: { a: [], b: [] },
    call: async () => ({
      text: JSON.stringify({
        verdicts: [{ key: 'a', verdict: 'pass', units: [], why: '' }],
        end: true,
      }),
    }),
  };
  await argonGroup(two, partial);
  assert.deepEqual(partial.state.results, {});
  assert.match(partial.state.calls[0].error, /빠진 문항 1/);

  const v = {
    row: { key: 'a', bank: 'g', draft: { units: [] } },
    draft: [],
    first: null,
    second: null,
  };
  const judge = { a: { units: [], why: '빈 목록' } };
  const opts = { name: 'p', at: '2026-11-11', rubric: 'atlas-tags-r2' };
  assert.throws(() => lineFor(v, judge, new Set(), opts), /1차 · 2차/);
  const reviewed = { ...v, first: { verdict: 'fix', units: [] }, second: { verdict: 'pass' } };
  assert.equal(lineFor(reviewed, judge, new Set(), opts).review.rubric, 'atlas-tags-r2');

  assert.throws(() => packetDrift({ rubric: { id: 'atlas-tags-r2', sha: '0' } }), /기준 글/);
  const rubric = fs
    .readFileSync(path.join(MAP_DIR, 'tags', 'rubric-r2.md'), 'utf8')
    .replace(/\r\n/g, '\n');
  const ok = {
    id: 'atlas-tags-r2',
    sha: crypto.createHash('sha256').update(rubric).digest('hex').slice(0, 16),
  };
  assert.doesNotThrow(() => packetDrift({ rubric: ok }));
  assert.throws(() => packetDrift({ rubric: ok, catalog: { sha: '0' } }, '목록'), /단위 목록/);
});

test('빌드는 1차 · 2차 검수가 다 있지 않은 태그 줄에서 멈춘다(GPT 보충 검수 GB2)', () => {
  const dir = tempDir('atlas-map-tagdir-');
  fs.mkdirSync(path.join(dir, 'tags'));
  const line = review => ({ a: { units: [], by: 'draft:opus', review } });
  const write = review =>
    fs.writeFileSync(path.join(dir, 'tags', 'g.json'), JSON.stringify({ tags: line(review) }));
  write({ verdict: 'fixed', first: 'fix', second: 'pass' });
  assert.equal(loadTags(dir).size, 1);
  write({ verdict: 'fixed', first: null, second: null });
  assert.throws(() => loadTags(dir), /1차 · 2차/);
});

test('색인 판(edition)은 태그 판 — 단위가 바뀌면 오르고, 접기 칸이 같으면 그대로다(단계 3 판 묶음)', () => {
  const row = units => ({
    n: 1,
    f: 1,
    skillId: 's',
    difficulty: 1,
    responseFormat: 'x',
    units,
    flags: 0,
  });
  const before = foldHash([row(['ko.word.w0001'])]);
  const previous = {
    edition: 2,
    hash: before,
    fields: [
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
    ],
    items: [[1, 'a', 1, 's', 1, 'x', ['ko.word.w0001'], 0, 'g', 0]],
    templateFields: [],
    templates: [],
    families: [[1, 'a.f']],
  };
  assert.equal(nextEdition(previous, {}, before, [], [row(['ko.word.w0001'])]).edition, 2);
  const after = foldHash([row(['ko.word.w0002'])]);
  const next = nextEdition(previous, {}, after, [], [row(['ko.word.w0002'])]);
  assert.equal(next.edition, 3);
  assert.deepEqual(next.revisions.at(-1).items.changed[0].to.units, ['ko.word.w0002']);
});

// ── 진단의 레이싱 조각(단계 4 계획 §25-4) ────────────────────────────────────────────────────────
const DIAG = 'korean-racing-diagnostic';
const DIAG_FILE = `items/${DIAG}.json`;
const { DIAG_RACING_WORDS } = await import(
  pathToFileURL(path.join(REPO_ROOT, 'experiences/synk-world-app/world-diagnostic-racing.mjs')).href
);
const diagSlice = () => JSON.parse(fs.readFileSync(path.join(mapDir(first), DIAG_FILE), 'utf8'));
const field = name => index.fields.indexOf(name);

test('진단의 레이싱 조각 목록은 진단 풀 표와 같다 — 같은 차례, 문항마다 그 낱말 하나', async () => {
  const diag = readSlices(MAP_DIR).get(DIAG);
  assert.equal(diag.bank, 'korean-racing');
  const rows = new Map(index.items.map(row => [row[field('itemKey')], row]));
  assert.deepEqual(
    diag.keys.map(key => rows.get(key)?.[field('units')]),
    DIAG_RACING_WORDS.map(([id]) => [`ko.word.${id}`]),
  );
  assert.deepEqual(await readSliceSources(), [{ name: DIAG, ...diag }]);
});

test('이름 붙인 조각 표(slices.json) = 원천에서 다시 지은 것 — 진단 풀 표가 바뀌면 이 대조가 걸린다(알림이 아니다)', async () => {
  const { files } = await rebuild();
  assert.equal(
    fs.readFileSync(path.join(MAP_DIR, 'slices.json'), 'utf8'),
    files['slices.json'],
    'slices.json이 원천과 다르다 — node packages/atlas/tools/map-build.mjs --write',
  );
});

test('진단의 레이싱 조각은 13문항과 그 계열 · 낱말 줄만 싣는다 — 다른 레이싱 문항 · 틀 줄은 없다', () => {
  const slice = diagSlice();
  const keys = new Set(readSlices(MAP_DIR).get(DIAG).keys);
  assert.equal(slice.items.length, DIAG_RACING_WORDS.length);
  assert.deepEqual(
    slice.items,
    index.items.filter(row => keys.has(row[field('itemKey')])),
  );
  assert.ok(slice.items.every(row => row[field('bank')] === 'korean-racing'));
  assert.ok(
    index.items.filter(row => row[field('bank')] === 'korean-racing').length > keys.size,
    '레이싱 은행에는 진단 밖 문항이 있다(그 문항이 조각에 없음을 보려면)',
  );
  assert.deepEqual(slice.templates, []);
  const used = new Set(slice.items.map(row => row[field('f')]));
  assert.deepEqual(
    slice.families,
    index.families.filter(([n]) => used.has(n)),
  );
  const words = JSON.parse(fs.readFileSync(path.join(MAP_DIR, 'words.json'), 'utf8'));
  const ids = new Set(DIAG_RACING_WORDS.map(([id]) => id));
  assert.deepEqual(
    slice.words.units,
    words.units.filter(([id]) => ids.has(id)),
  );
  assert.equal(slice.words.units.length, DIAG_RACING_WORDS.length);
});

test('크기 도구는 진단 조각을 이름으로 짚은 상한으로 재고 조각은 그 안이다 — 가장 큰 조각 겨룸에서 빠진다', () => {
  const budget = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'budget.json'), 'utf8'));
  const { ok, report } = checkBudget(first.manifest, budget);
  assert.equal(ok, true);
  const row = report.find(r => r.file === `map/${DIAG_FILE}`);
  assert.equal(row.limit, budget.map.slices[DIAG_FILE]);
  assert.equal(row.gzipBytes, first.manifest.map.files[DIAG_FILE].gzipBytes);
  assert.ok(row.headroom >= 0, `진단 조각 gzip ${row.gzipBytes}B / 상한 ${row.limit}B`);
  const biggest = report.filter(r => r.limit === budget.map.slice);
  assert.equal(biggest.length, 1);
  assert.notEqual(biggest[0].file, `map/${DIAG_FILE}`);
  // 이름 붙인 조각은 모두 제 상한이 있다 — 표에 조각을 더하고 상한을 적지 않으면 은행 조각 겨룸에 들어 문항 거름을 잃어도 지나간다(Fable F3).
  for (const name of readSlices(MAP_DIR).keys())
    assert.ok(
      Object.hasOwn(budget.map.slices ?? {}, `items/${name}.json`),
      `budget.json map.slices에 items/${name}.json`,
    );
});

test('조각을 더해도 index.json 바이트 · 지도 판 표지 · 다른 지도 파일은 더하기 전과 같다 — 더하기 전은 조각 표 없는 같은 지도', () => {
  const before = tempDir('atlas-map-noslices-');
  for (const name of ['index.json', 'units.json', 'words.json'])
    fs.copyFileSync(path.join(MAP_DIR, name), path.join(before, name));
  const without = mapFiles(before);
  const withSlices = mapFiles(MAP_DIR);
  assert.deepEqual(
    Object.keys(withSlices.files).filter(name => !Object.hasOwn(without.files, name)),
    [DIAG_FILE],
  );
  for (const [name, bytes] of Object.entries(without.files))
    assert.ok(withSlices.files[name].equals(bytes), name);
  const mark = map => [map.edition, map.skillsEdition, map.hash];
  assert.deepEqual(mark(withSlices), mark(without));
  // 더하기 전 값은 커밋된 색인이다 — 빌드 나무의 index.json은 그 파일을 공백 없이 낸 바이트, 판 표지도 그 파일의 것이다.
  assert.ok(
    fs
      .readFileSync(path.join(mapDir(first), 'index.json'))
      .equals(Buffer.from(JSON.stringify(index))),
  );
  assert.deepEqual(mark(first.manifest.map), mark(index));
  assert.deepEqual(mark(diagSlice()), mark(index));
});

test('진단 조각으로 연 코치의 제시 사건 editions는 전체 색인으로 연 코치와 같다', async () => {
  const read = name => JSON.parse(fs.readFileSync(path.join(MAP_DIR, name), 'utf8'));
  const [key] = readSlices(MAP_DIR).get(DIAG).keys;
  const editionsOf = async (mapData, label) => {
    const port = memoryPort();
    const coach = createCoach({
      gameId: 'map-slice',
      mapData,
      seed: 'map-slice',
      dayOffset: 0,
      host: {
        guest: true,
        port,
        key: `synk-atlas:map-slice-${process.pid}-${label}`,
        now: () => Date.UTC(2026, 10, 22, 1),
      },
    });
    await coach.ready;
    const pid = coach.present({ itemKey: key });
    const rows = await port.read();
    coach.dispose();
    return rows.map(row => row.value.event).find(event => event?.id === pid).editions;
  };
  const units = read('units.json');
  const whole = await editionsOf({ index, units }, 'whole');
  const sliced = await editionsOf({ index: [diagSlice()], units }, 'slice');
  assert.deepEqual(sliced, whole);
  assert.deepEqual(sliced, { ...PARAMS.editions, index: `index-${index.edition}` });
});
