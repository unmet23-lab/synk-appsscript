// 공개 전 확인(tools/publish.mjs): 공개 판만, 나무가 manifest와 같을 때만, 공개본의 같은 판 폴더를 덮지 않을 때만 올릴 명령을 준다.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { subjectTool } from '../support/subject.mjs';
import { tempDir } from '../support/temp.mjs';

// 변형 실행기가 고친 사본(ATLAS_SUBJECT_ROOT)의 공개 전 확인을 시험한다 — 기본은 이 패키지의 것.
const { checkPublish } = await subjectTool('publish.mjs');
const { sliceOf } = await subjectTool('map-ship.mjs');

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// 빌드(tools/map-ship.mjs)와 같은 꼴의 색인 — 문항 줄 · 틀 줄 · 계열 · 함께 쓰는 은행(shared: [문항 번호, 은행들]). 조각은 sliceOf로 짓는다
// (공개 전 확인이 나무의 색인 · 낱말 표로 다시 세워 견준다). 기대 파일 목록은 여기서 손으로 적는다 — 검사의 규칙(mapFileNames)을 시험이
// 빌려 쓰면 그 규칙을 깬 변형을 시험도 함께 따라가 잡지 못한다.
const WORDS = { prefix: 'ko.word.', fields: ['s'], units: [] };
const indexOf = ({ items = ['talk-rally'], templates = [], shared = [] } = {}) => ({
  format: 'atlas-map-index/1',
  edition: 1,
  skillsEdition: 1,
  hash: 'h',
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
  ],
  items: items.map((bank, i) => [
    i + 1,
    `${bank}.i${i}.v1`,
    i + 1,
    'ko.reading.detail',
    1,
    'single-choice',
    [],
    i,
    bank,
  ]),
  templateFields: ['f', 'skillId', 'units', 'order', 'bank'],
  templates: templates.map((bank, i) => [100 + i, 'ko.reading.detail', [], i, bank]),
  families: [
    ...items.map((_, i) => [i + 1, `fam${i}`]),
    ...templates.map((_, i) => [100 + i, `tfam${i}`]),
  ],
  shared,
  retired: [],
  renames: [],
});
// 지도 파일(map/ 뒤 경로 → 내용): 늘 내는 셋과 banks의 조각.
function mapOf(index, banks) {
  const files = {
    'index.json': JSON.stringify(index),
    'units.json': '[]',
    'words.json': JSON.stringify(WORDS),
  };
  for (const bank of banks)
    files[`items/${bank}.json`] = JSON.stringify(sliceOf(index, bank, WORDS));
  return files;
}
const MAP = mapOf(indexOf(), ['talk-rally']);
const without = (map, name) =>
  Object.fromEntries(Object.entries(map).filter(([key]) => key !== name));
const REASON = {
  'index.json':
    '빌드가 늘 내는 전체 색인이다 — 서버 접기 · 도구가 읽고, 이 검사가 은행 목록을 여기서 읽는다',
  'units.json': '코치가 늘 받는다 — 없으면 MAP_FAILED',
  'words.json':
    '낱말 줄을 싣지 않은 조각을 낱말과 함께 여는 게임이 받는다 — 없으면 그 게임이 MAP_FAILED',
  item: '그 은행을 여는 게임이 받는다 — 없으면 그 게임이 MAP_FAILED',
};
const missingLine = name => `manifest에 지도 ${name}이 없다(${REASON[name] ?? REASON.item})`;

// tools/build.mjs가 내는 나무와 같은 꼴을 손으로 만든다(이 묶음은 esbuild 없이 돈다).
// map: 지도 파일(map/ 뒤 경로 → 내용) — 판 폴더의 map/ 아래에 쓰고 manifest의 map 칸에 적는다(tools/build.mjs와 같은 꼴).
// 공개 판은 지도와 함께 내므로 기본은 MAP이다. null이면 map 칸이 없고, {}이면 파일 없는 map 칸이다.
function tree(edition, { release = true, loaderEdition = edition, map = MAP } = {}) {
  const out = tempDir('atlas-publish-');
  const dir = path.join(out, 'atlas', edition);
  fs.mkdirSync(dir, { recursive: true });
  const code = Buffer.from('export const EDITION="x";');
  const loader = Buffer.from(`(() => {\n  const EDITION = '${loaderEdition}';\n})();\n`);
  const wrapper = Buffer.from("import './loader.js';\n");
  fs.writeFileSync(path.join(dir, 'atlas.mjs'), code);
  fs.writeFileSync(path.join(out, 'atlas', 'loader.js'), loader);
  fs.writeFileSync(path.join(out, 'atlas', 'loader.mjs'), wrapper);
  const manifest = {
    edition,
    release,
    files: { 'atlas.mjs': { sha256: sha256(code) } },
    entry: { 'loader.js': { sha256: sha256(loader) }, 'loader.mjs': { sha256: sha256(wrapper) } },
  };
  if (map) {
    manifest.map = { edition: 1, files: {} };
    for (const [name, text] of Object.entries(map)) {
      const bytes = Buffer.from(text);
      const file = path.join(dir, 'map', name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
      manifest.map.files[name] = { sha256: sha256(bytes) };
    }
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'manifest.json'), manifestBytes);
  return { out, manifestBytes };
}

const answer =
  (status, body = '') =>
  async () => ({
    status,
    ok: status >= 200 && status < 300,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  });

// 공개본 흉내: 판 폴더 안 경로를 out 나무의 바이트로 준다. bodies[판 폴더 뒤 경로]가 글이면 그 바이트, 수면 그 상태(404 · 503)로 덮는다.
const site =
  (out, edition, bodies = {}) =>
  async url => {
    const name = decodeURIComponent(new URL(url).pathname).replace(`/atlas/${edition}/`, '');
    const forced = bodies[name];
    if (typeof forced === 'number')
      return { status: forced, ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
    const file = path.join(out, 'atlas', edition, name);
    const bytes =
      forced !== undefined
        ? Buffer.from(forced)
        : fs.existsSync(file)
          ? fs.readFileSync(file)
          : null;
    if (!bytes) return { status: 404, ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
    return { status: 200, ok: true, arrayBuffer: async () => new Uint8Array(bytes).buffer };
  };

test('새 판이면(공개본에 없음) 올릴 명령을 준다 — 판 폴더 파일 · manifest · 입구 둘', async () => {
  const { out } = tree('1.0.0');
  const result = await checkPublish({ out, fetcher: answer(404) });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  for (const item of [
    'atlas/1.0.0/atlas.mjs',
    'atlas/1.0.0/manifest.json',
    'atlas/loader.js',
    'atlas/loader.mjs',
  ]) {
    assert.ok(result.command.includes(` ${item}`), item);
  }
  assert.ok(result.command.startsWith('node tools/공개.js 올리기 --원본 '));
});

test('지도 파일(map/ — 아래 폴더 포함)이 모두 올리기 목록에 든다 — 빠지면 켜진 길의 코치가 MAP_FAILED(설계 주인 11-20)', async () => {
  const { out } = tree('1.0.0', { map: MAP });
  const result = await checkPublish({ out, fetcher: answer(404) });
  assert.equal(result.ok, true, result.problems.join());
  for (const name of Object.keys(MAP))
    assert.ok(result.command.includes(` atlas/1.0.0/map/${name}`), name);
});

test('지도 파일 하나의 해시가 다르거나, 빠지거나, 적히지 않은 지도 파일이 있으면 막는다', async () => {
  const fetcher = answer(404);
  const changed = tree('1.0.0', { map: MAP });
  fs.writeFileSync(
    path.join(changed.out, 'atlas', '1.0.0', 'map', 'items', 'talk-rally.json'),
    '[2]',
  );
  const result = await checkPublish({ out: changed.out, fetcher });
  assert.equal(result.ok, false);
  assert.equal(result.command, null);
  assert.deepEqual(result.problems, [
    'map/items/talk-rally.json이 map/index.json · words.json에서 나온 조각과 다르다',
    'map/items/talk-rally.json이 manifest와 다르다',
  ]);

  const missing = tree('1.0.0', { map: MAP });
  fs.rmSync(path.join(missing.out, 'atlas', '1.0.0', 'map', 'units.json'));
  assert.match(
    (await checkPublish({ out: missing.out, fetcher })).problems.join(),
    /map\/units\.json이 나무에 없다/,
  );

  const extra = tree('1.0.0', { map: MAP });
  fs.writeFileSync(path.join(extra.out, 'atlas', '1.0.0', 'map', 'items', 'debug.json'), '{}');
  assert.match(
    (await checkPublish({ out: extra.out, fetcher })).problems.join(),
    /map\/items\/debug\.json이 manifest에 없다/,
  );
});

test('공개본에 같은 판이 같은 바이트로 있으면 지나가고, 다른 바이트면 덮지 않는다', async () => {
  const { out } = tree('1.0.0');
  assert.equal((await checkPublish({ out, fetcher: site(out, '1.0.0') })).ok, true);
  const other = await checkPublish({ out, fetcher: answer(200, '{"edition":"1.0.0"}') });
  assert.equal(other.ok, false);
  assert.equal(other.command, null);
  assert.match(other.problems[0], /덮지 않는다/);
});

test('같은 판이 이미 공개돼 있으면 판 폴더 파일을 하나씩 본다 — 없는 지도는 더하고, 다르거나 확인하지 못하면 멈춘다(GPT GA1)', async () => {
  const { out } = tree('1.0.0');
  // 선택 공개 1단계처럼 manifest · 엔진 묶음만 공개된 판에 지도를 더한다(지도는 공개본에 없다)
  const mapless = Object.fromEntries(Object.keys(MAP).map(name => [`map/${name}`, 404]));
  const add = await checkPublish({ out, fetcher: site(out, '1.0.0', mapless) });
  assert.equal(add.ok, true, add.problems.join());
  assert.ok(add.command.includes(' atlas/1.0.0/map/items/talk-rally.json'));

  const differs = await checkPublish({
    out,
    fetcher: site(out, '1.0.0', { 'map/items/talk-rally.json': '[9]' }),
  });
  assert.equal(differs.ok, false);
  assert.equal(differs.command, null);
  assert.deepEqual(differs.problems, [
    '공개본의 map/items/talk-rally.json이 manifest와 다르다 — 판 폴더는 덮지 않는다(판을 올린다)',
  ]);
  const engine = await checkPublish({ out, fetcher: site(out, '1.0.0', { 'atlas.mjs': 'other' }) });
  assert.match(engine.problems.join(), /공개본의 atlas\.mjs이 manifest와 다르다/);
  const unknown = await checkPublish({
    out,
    fetcher: site(out, '1.0.0', { 'map/units.json': 503 }),
  });
  assert.match(unknown.problems.join(), /공개본의 map\/units\.json을 확인하지 못했다\(503\)/);
});

test('공개 판은 지도와 함께 낸다 — manifest에 지도 칸이 없거나 지도 파일이 없으면 막는다(GPT GA2)', async () => {
  for (const map of [null, {}]) {
    const { out } = tree('1.0.0', { map });
    const result = await checkPublish({ out, fetcher: answer(404) });
    assert.equal(result.ok, false, JSON.stringify(map));
    assert.equal(result.command, null);
    assert.match(result.problems.join(), /manifest에 지도 파일이 없다/);
  }
});

test('지도 파일 이름은 빌드 규칙과 꼭 같아야 한다 — 늘 내는 셋 · 은행 조각이 빠지거나 규칙 밖 파일이 더 실리면 막는다(GPT GA2 · GA3 · Fable 설계 검토 3)', async () => {
  const fetcher = answer(404);
  // manifest의 파일표와 나무에서 함께 빼도(올리기 목록에서도 빠진다) 막는다 — 파일마다 그 까닭을 글자 그대로 본다
  for (const name of Object.keys(MAP)) {
    const { out } = tree('1.0.0', { map: without(MAP, name) });
    const result = await checkPublish({ out, fetcher });
    assert.equal(result.ok, false, name);
    assert.equal(result.command, null, name);
    assert.ok(result.problems.includes(missingLine(name)), `${name}: ${result.problems.join()}`);
  }
  assert.ok(
    !missingLine('index.json').includes('MAP_FAILED'),
    'index.json 안내가 MAP_FAILED를 지어냈다',
  );
  // 틀 줄에만 · 문항 줄에만 · 함께 쓰는 은행(shared)으로만 든 은행도 조각을 받는다
  const index = indexOf({
    items: ['talk-rally', 'order-rush'],
    templates: ['hangul-stage'],
    shared: [[1, ['story-classroom']]],
  });
  const banks = ['talk-rally', 'order-rush', 'hangul-stage', 'story-classroom'];
  const full = mapOf(index, banks);
  const whole = await checkPublish({ out: tree('1.0.0', { map: full }).out, fetcher });
  assert.deepEqual(whole.problems, []);
  for (const bank of banks) {
    const name = `items/${bank}.json`;
    const result = await checkPublish({
      out: tree('1.0.0', { map: without(full, name) }).out,
      fetcher,
    });
    assert.deepEqual(result.problems, [missingLine(name)], bank);
  }
  // 규칙 밖 파일이 manifest와 나무에 함께 있으면 막는다(낡은 은행 조각 · 뿌리의 다른 파일)
  for (const name of ['items/old.json', 'extra.json']) {
    const result = await checkPublish({
      out: tree('1.0.0', { map: { ...MAP, [name]: '{}' } }).out,
      fetcher,
    });
    assert.deepEqual(
      result.problems,
      [
        `manifest에 빌드 규칙 밖의 지도 파일 ${name}이 있다(낡은 조각이나 잘못 든 파일 — 올리지 않는다)`,
      ],
      name,
    );
  }
});

test('은행 조각은 나무의 index.json · words.json으로 다시 세운 바이트와 같아야 한다 — manifest 해시까지 맞춘 빈 조각 · 다른 은행 · 줄이 빠진 조각도 막는다(Fable 설계 검토 2)', async () => {
  const fetcher = answer(404);
  const index = indexOf({ items: ['talk-rally', 'talk-rally', 'order-rush'] });
  const full = mapOf(index, ['talk-rally', 'order-rush']);
  const dropped = JSON.parse(full['items/talk-rally.json']);
  dropped.items = dropped.items.slice(1);
  for (const [label, text] of [
    ['빈 조각', '{}'],
    ['다른 은행', full['items/order-rush.json']],
    ['줄 빠짐', JSON.stringify(dropped)],
  ]) {
    const result = await checkPublish({
      out: tree('1.0.0', { map: { ...full, 'items/talk-rally.json': text } }).out,
      fetcher,
    });
    assert.deepEqual(
      result.problems,
      ['map/items/talk-rally.json이 map/index.json · words.json에서 나온 조각과 다르다'],
      label,
    );
  }
  const words = await checkPublish({
    out: tree('1.0.0', { map: { ...MAP, 'words.json': 'not json' } }).out,
    fetcher,
  });
  assert.equal(words.ok, false);
  assert.match(words.problems.join(), /map\/words\.json을 읽지 못했다/);
});

test('색인 꼴이 틀리거나 은행 이름이 규칙에 맞지 않으면 던지지 않고 문제 한 줄로 막는다 — null · 거짓 값도 없는 파일로 넘기지 않는다(Fable 설계 검토 5 · 6 · GPT -d GA1)', async () => {
  const fetcher = answer(404);
  const base = indexOf();
  const cases = [
    ['JSON이 아님', 'not json'],
    ...['null', 'false', '0', '""', '[]'].map(text => [`색인 값 ${text}`, text]),
    ['templateFields 없음', JSON.stringify({ ...base, templateFields: undefined })],
    ['templates 없음', JSON.stringify({ ...base, templates: undefined })],
    [
      '틀 줄에 bank 칸 없음',
      JSON.stringify({ ...base, templateFields: ['f', 'skillId', 'units', 'order'] }),
    ],
    ...[7, '', 'a/b', 'a#b', 'Talk-Rally'].map(bank => [
      `은행 이름 ${JSON.stringify(bank)}`,
      JSON.stringify(indexOf({ items: [bank] })),
    ]),
  ];
  for (const [label, text] of cases) {
    const result = await checkPublish({
      out: tree('1.0.0', { map: { ...MAP, 'index.json': text } }).out,
      fetcher,
    });
    assert.equal(result.ok, false, label);
    assert.match(result.problems.join('\n'), /map\/index\.json을 읽지 못했다/, label);
  }
});

test('공개본의 판 폴더 파일을 받다가 끊기거나 본문을 못 읽어도 던지지 않는다 — 앞서 찾은 문제와 함께 그 파일을 알린다(GPT GA1)', async () => {
  const { out } = tree('1.0.0');
  const base = site(out, '1.0.0', { 'map/index.json': '{"other":1}' });
  const ends = (url, tail) => new URL(url).pathname.endsWith(tail);
  const cut = async (url, init) => {
    if (ends(url, '/map/units.json')) throw new Error('network down');
    if (ends(url, '/map/words.json'))
      return {
        status: 200,
        ok: true,
        arrayBuffer: async () => {
          throw new Error('reset');
        },
      };
    return base(url, init);
  };
  const result = await checkPublish({ out, fetcher: cut });
  assert.equal(result.ok, false);
  assert.equal(result.command, null);
  assert.deepEqual(result.problems, [
    '공개본의 map/index.json이 manifest와 다르다 — 판 폴더는 덮지 않는다(판을 올린다)',
    '공개본의 map/units.json을 확인하지 못했다(network down) — 확인하기 전에는 올리지 않는다',
    '공개본의 map/words.json을 확인하지 못했다(reset) — 확인하기 전에는 올리지 않는다',
  ]);
  const offline = await checkPublish({
    out,
    fetcher: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(offline.ok, false);
  assert.deepEqual(offline.problems, [
    '공개본을 확인하지 못했다(offline) — 확인하기 전에는 올리지 않는다',
  ]);
  // 빈 이유(throw '' 등)도 이유 글이 남고, 앞서 찾은 해시 불일치도 함께 남는다(GPT GA1 다시 · Fable 설계 검토 9)
  for (const [thrown, reason] of [
    ['', '이유 없음'],
    [undefined, 'undefined'],
    [{ message: '' }, '[object Object]'],
  ]) {
    const blank = async (url, init) => {
      if (ends(url, '/map/units.json')) throw thrown;
      if (ends(url, '/map/words.json'))
        return {
          status: 200,
          ok: true,
          arrayBuffer: async () => {
            throw thrown;
          },
        };
      return base(url, init);
    };
    const files = await checkPublish({ out, fetcher: blank });
    assert.deepEqual(
      files.problems,
      [
        '공개본의 map/index.json이 manifest와 다르다 — 판 폴더는 덮지 않는다(판을 올린다)',
        `공개본의 map/units.json을 확인하지 못했다(${reason}) — 확인하기 전에는 올리지 않는다`,
        `공개본의 map/words.json을 확인하지 못했다(${reason}) — 확인하기 전에는 올리지 않는다`,
      ],
      reason,
    );
    const head = await checkPublish({
      out,
      fetcher: async () => {
        throw thrown;
      },
    });
    assert.deepEqual(head.problems, [
      `공개본을 확인하지 못했다(${reason}) — 확인하기 전에는 올리지 않는다`,
    ]);
  }
});

test('지도 자리가 폴더가 아니거나 적힌 지도 파일 자리가 폴더여도 던지지 않고 문제로 알린다(GPT GA3)', async () => {
  const fetcher = answer(404);
  const flat = tree('1.0.0');
  const mapDir = path.join(flat.out, 'atlas', '1.0.0', 'map');
  fs.rmSync(mapDir, { recursive: true });
  fs.writeFileSync(mapDir, 'x');
  const notFolder = await checkPublish({ out: flat.out, fetcher });
  assert.equal(notFolder.ok, false);
  assert.match(notFolder.problems.join(), /map이 폴더가 아니다/);

  const swapped = tree('1.0.0');
  const item = path.join(swapped.out, 'atlas', '1.0.0', 'map', 'items', 'talk-rally.json');
  fs.rmSync(item);
  fs.mkdirSync(item);
  const folder = await checkPublish({ out: swapped.out, fetcher });
  assert.equal(folder.ok, false);
  assert.match(folder.problems.join(), /map\/items\/talk-rally\.json이 나무에 없다/);
});

test('공개본을 확인하지 못하면 올리지 않는다', async () => {
  const { out } = tree('1.0.0');
  const result = await checkPublish({ out, fetcher: answer(503) });
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /확인하지 못했다/);
});

test('엔진 묶음 · 입구가 빠지거나 적히지 않은 파일이 든 나무는 멈춘다(엔진 없이 입구만 올라가지 않게)', async () => {
  const fetcher = answer(404);
  const noEngine = tree('1.0.0');
  const manifestFile = path.join(noEngine.out, 'atlas', '1.0.0', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, files: {} }));
  fs.rmSync(path.join(noEngine.out, 'atlas', '1.0.0', 'atlas.mjs'));
  assert.match(
    (await checkPublish({ out: noEngine.out, fetcher })).problems.join(),
    /manifest에 atlas\.mjs이 없다/,
  );

  const noWrapper = tree('1.0.0');
  const wrapperManifest = path.join(noWrapper.out, 'atlas', '1.0.0', 'manifest.json');
  const parsed = JSON.parse(fs.readFileSync(wrapperManifest, 'utf8'));
  delete parsed.entry['loader.mjs'];
  fs.writeFileSync(wrapperManifest, JSON.stringify(parsed));
  const missing = await checkPublish({ out: noWrapper.out, fetcher });
  assert.match(missing.problems.join(), /manifest에 loader\.mjs이 없다/);
  assert.match(missing.problems.join(), /loader\.mjs이 manifest에 없다/);

  const extra = tree('1.0.0');
  fs.writeFileSync(path.join(extra.out, 'atlas', '1.0.0', 'debug.js'), 'x');
  const result = await checkPublish({ out: extra.out, fetcher });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(), /debug\.js이 manifest에 없다/);
});

test('개발 판 · 입구가 다른 판을 말하는 나무 · manifest와 다른 파일은 멈춘다(공개본을 묻기 전에)', async () => {
  let asked = 0;
  const fetcher = async () => {
    asked += 1;
    return { status: 404, ok: false };
  };
  const dev = tree('1.0.0-dev.abcdef1', { release: false });
  assert.match((await checkPublish({ out: dev.out, fetcher })).problems.join(), /공개 판이 아니다/);
  const mismatch = tree('1.0.0', { loaderEdition: '0.9.0' });
  assert.match(
    (await checkPublish({ out: mismatch.out, fetcher })).problems.join(),
    /입구의 판 이름/,
  );
  const changed = tree('1.0.0');
  fs.writeFileSync(path.join(changed.out, 'atlas', '1.0.0', 'atlas.mjs'), 'changed');
  assert.match(
    (await checkPublish({ out: changed.out, fetcher })).problems.join(),
    /atlas\.mjs이 manifest와 다르다/,
  );
  assert.equal(asked, 0);
});
