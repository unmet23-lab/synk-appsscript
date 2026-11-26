'use strict';
// 엔진 화면 파일 내주기(src/workbackup-ui.cjs)의 목록 세대 시험. 늦게 끝난 앞 읽기가 지금 목록을 덮지 않는다(GPT workbackup-solio-one-be-20261127 A7).
// 가짜 설치 폴더는 임시 폴더다. 실제 엔진은 쓰지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const U = require('../src/workbackup-ui.cjs');

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function install(version, body) {
  const loc = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-ui-gen-')), ui = path.join(loc, 'resources', 'ui');
  fs.mkdirSync(ui, { recursive: true });
  fs.writeFileSync(path.join(ui, 'index.html'), body);
  fs.writeFileSync(path.join(loc, 'resources', 'manifest.json'), JSON.stringify({ version: 1, appVersion: version, files: { 'ui/index.html': { size: Buffer.byteLength(body), sha256: sha(Buffer.from(body)) } } }));
  return loc;
}

test('a load that ends after a later load or an unload changes nothing; the later list stays', async () => {
  const older = install('0.8.0', '<p>0.8.0</p>'), newer = install('0.8.1', '<p>0.8.1</p>');
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const fsImpl = { ...fs.promises, readFile: async (file, ...rest) => { if (String(file).startsWith(older) && String(file).endsWith('manifest.json')) await held; return fs.promises.readFile(file, ...rest); } };
  const s = U.createWorkbackupUi({ fsImpl });
  const first = s.load(older, '0.8.0');
  s.unload();
  assert.equal(await s.load(newer, '0.8.1'), 'ok');
  release();
  assert.equal(await first, 'stale');
  assert.equal(s.version(), '0.8.1');
  const page = await s.respond('workbackup-ui://app/index.html');
  assert.equal(page.status, 200);
  assert.equal(String(page.body), '<p>0.8.1</p>');
  // unload 뒤에 끝난 읽기도 목록을 싣지 않는다
  let again;
  const held2 = new Promise(resolve => { again = resolve; });
  const fsImpl2 = { ...fs.promises, readFile: async (file, ...rest) => { if (String(file).endsWith('manifest.json')) await held2; return fs.promises.readFile(file, ...rest); } };
  const t = U.createWorkbackupUi({ fsImpl: fsImpl2 });
  const late = t.load(newer, '0.8.1');
  t.unload();
  again();
  assert.equal(await late, 'stale');
  assert.equal(t.version(), null);
  assert.equal((await t.respond('workbackup-ui://app/index.html')).status, 503);
});
