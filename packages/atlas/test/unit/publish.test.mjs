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

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const MAP = { 'index.json': '{"edition":1}', 'units.json': '[]', 'items/talk-rally.json': '[1]' };

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
  assert.deepEqual(result.problems, ['map/items/talk-rally.json이 manifest와 다르다']);

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
