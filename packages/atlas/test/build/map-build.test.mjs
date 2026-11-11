// 지도를 엔진과 따로 내는 길(tools/map-ship.mjs · build.mjs)과 지도 원천 대조(tools/map-build.mjs).
//   · 빌드 나무의 atlas/<판>/map/ — 전체 색인 · 단위 · 낱말 · 은행 조각, manifest의 map 칸, 같은 커밋이면 같은 바이트
//   · 제품 은행에서 다시 뽑은 색인이 커밋된 것과 같은가 — 단계 4 전까지는 알림(t.diagnostic)이다(계획 §7): 지금은 어느 제품도
//     새 지도를 읽지 않으므로 게임 문항을 고친 다른 세션의 push를 막지 않는다
//   · 한글 계열 줄의 꼴 목록이 제품 원문(core.mjs TYPES)과 같은가
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { build } from '../../tools/build.mjs';
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
import { banksOf, MAP_DIR, SLICE_WORDS_MAX, sliceOf } from '../../tools/map-ship.mjs';
import { HANGUL_TYPES, REPO_ROOT } from '../../tools/map-sources.mjs';
import { tempDir } from '../support/temp.mjs';

const STATE = { commit: 'b'.repeat(40), dirty: false };
const first = await build({ out: tempDir('atlas-map-a-'), state: STATE });
const second = await build({ out: tempDir('atlas-map-b-'), state: STATE });
const mapDir = result => path.join(result.out, 'atlas', result.edition, 'map');
const index = JSON.parse(fs.readFileSync(path.join(MAP_DIR, 'index.json'), 'utf8'));

test('판 폴더의 map/ — 전체 색인 · 단위 · 낱말 · 은행마다 조각, manifest가 바이트 · sha256을 든다', () => {
  const expected = [
    'index.json',
    'units.json',
    'words.json',
    ...banksOf(index).map(bank => `items/${bank}.json`),
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
  const { files } = await buildMap();
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
