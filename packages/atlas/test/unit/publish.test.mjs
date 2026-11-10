// 공개 전 확인(tools/publish.mjs): 공개 판만, 나무가 manifest와 같을 때만, 공개본의 같은 판 폴더를 덮지 않을 때만 올릴 명령을 준다.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkPublish } from '../../tools/publish.mjs';
import { tempDir } from '../support/temp.mjs';

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// tools/build.mjs가 내는 나무와 같은 꼴을 손으로 만든다(이 묶음은 esbuild 없이 돈다).
function tree(edition, { release = true, loaderEdition = edition } = {}) {
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

test('공개본에 같은 판이 같은 바이트로 있으면 지나가고, 다른 바이트면 덮지 않는다', async () => {
  const { out, manifestBytes } = tree('1.0.0');
  assert.equal(
    (await checkPublish({ out, fetcher: answer(200, manifestBytes.toString()) })).ok,
    true,
  );
  const other = await checkPublish({ out, fetcher: answer(200, '{"edition":"1.0.0"}') });
  assert.equal(other.ok, false);
  assert.equal(other.command, null);
  assert.match(other.problems[0], /덮지 않는다/);
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
