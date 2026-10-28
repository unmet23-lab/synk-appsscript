import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { REUSED_KEYS } from '../experiences/korean-study/build.mjs';

test('Study output and cache tokens survive LF/CRLF source and checkout changes', t => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const parent = fs.realpathSync.native(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'synk-study-portable-'));
  const modules = path.join(root, 'node_modules');
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync.native(root)), parent);
    assert.ok(path.basename(root).startsWith('synk-study-portable-'));
    if (fs.existsSync(modules)) fs.unlinkSync(modules); // Remove the junction before its parent.
    fs.rmSync(root, { recursive: true });
  });
  fs.symlinkSync(path.join(repo, 'node_modules'), modules, process.platform === 'win32' ? 'junction' : 'dir');
  const write = (name, content) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content);
  };
  const product = 'experiences/korean-study';
  write(`${product}/build.mjs`, fs.readFileSync(path.join(repo, product, 'build.mjs')));
  write(`${product}/src/app.mjs`, 'export const example = 1;\n');
  write(`${product}/src/study.css`, 'body { color: red; }\n');
  write(`${product}/src/index.html`, '<link href="study.css">\n<script type="module" src="app.js"></script>\n');
  write(`${product}/content/ending-53.json`, JSON.stringify({ topic: 'fixture', items: [] }));
  write('experiences/synk-world-app/world-writing-items.json', JSON.stringify({ contentHash: 'fixture', items: [] }));
  write('experiences/brand-opening/world-strings.mjs', `export default ${JSON.stringify(Object.fromEntries(REUSED_KEYS.map(k => [k, { ko: '가', en: 'a', mn: 'а' }])))};\n`);
  write('docs/브랜드_폰트/SUIT/SUIT-Variable.woff2', Buffer.from([0, 1, 2, 3]));
  const run = (...args) => {
    const result = spawnSync(process.execPath, [path.join(root, product, 'build.mjs'), ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr);
  };
  const output = path.join(root, product, 'dist/study');
  const names = ['app.js', 'index.html', 'study.css', 'items.json', 'study.json', 'assets/SUIT-Variable.woff2'];
  const snapshot = () => names.map(n => [n, fs.readFileSync(path.join(output, n))]);
  run();
  const before = snapshot();
  const cssHash = createHash('sha256').update(fs.readFileSync(path.join(output, 'study.css'))).digest('hex').slice(0, 12);
  assert.ok(fs.readFileSync(path.join(output, 'index.html'), 'utf8').includes(`study.css?v=${cssHash}`));
  const crlf = file => fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
  for (const name of ['study.css', 'index.html', 'copy-reused.mjs']) crlf(path.join(root, product, 'src', name));
  for (const name of names.filter(n => !n.endsWith('.woff2'))) crlf(path.join(output, name));
  const checkout = snapshot();
  run('--check');
  assert.deepEqual(snapshot(), checkout, 'check must not rewrite a checkout');
  run();
  assert.deepEqual(snapshot(), before, 'source line endings must not change output or tokens');
});
