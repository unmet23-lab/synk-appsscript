// Isolated offline delivery proof. All account settings and identities are
// synthetic; no real account provider, install, upload or deployment is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDatingPackage, verifyDatingPackage, DATING_PACKAGE_FILES, DATING_PACKAGE_CONTENTS, DATING_PACKAGE_ROOT } from '../tools/atlas-dating-package.mjs';
import { DATING_PUBLIC_FILES } from '../experiences/atlas-lab/dating-public.mjs';

const run = promisify(execFile), entry = 'experiences/atlas-lab/dating-server.mjs';
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
// This test deliberately replaces the process on the same port; do not reuse a
// keepalive socket belonging to the previous server instance.
const request = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, Connection: 'close' } });
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-package-'));
  t.after(async () => { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('synk-dating-package-')); await fs.rm(dir, { recursive: true, force: true }); });
  return dir;
}
async function port() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value; }
async function exists(filename) { try { await fs.lstat(filename); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function copySource(target) {
  await fs.mkdir(target);
  for (const name of DATING_PACKAGE_FILES) { const to = path.join(target, name); await fs.mkdir(path.dirname(to), { recursive: true }); await fs.copyFile(path.join(DATING_PACKAGE_ROOT, name), to); }
}
const accountConfig = address => ({ version: 1, supabaseUrl: 'http://127.0.0.1:1', accountApiUrl: 'http://127.0.0.1:1',
  supabasePublishableKey: 'sb_publishable_synthetic_package', portalUrl: 'http://127.0.0.1:1/id/',
  clients: { platform: { clientId: 'synthetic-package-client', redirectUri: address + '/atlas-lab/dating.html' } } });

test('the explicit package list covers the actual static and delayed CJS dependency graph plus every browser file', async () => {
  const seen = new Set();
  async function visit(filename) {
    if (seen.has(filename)) return; seen.add(filename);
    const source = await fs.readFile(filename, 'utf8');
    const references = /(?:\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    for (const match of source.matchAll(references)) {
      const specifier = match[1] || match[2];
      if (!specifier.startsWith('.')) { assert.ok(specifier.startsWith('node:'), `Unexpected package dependency: ${specifier}`); continue; }
      const base = path.resolve(path.dirname(filename), specifier); let resolved;
      for (const candidate of [base, base + '.js', base + '.mjs', path.join(base, 'index.js')]) if (await exists(candidate)) { resolved = candidate; break; }
      assert.ok(resolved, specifier); await visit(resolved);
    }
  }
  await visit(path.join(DATING_PACKAGE_ROOT, entry)); assert.equal(seen.size, 32);
  const runtime = new Set([...seen].map(filename => path.relative(DATING_PACKAGE_ROOT, filename).replaceAll('\\', '/')));
  for (const name of DATING_PUBLIC_FILES) runtime.add('experiences' + name);
  assert.equal(runtime.size, 51);
  const templates = ['Caddyfile', 'synk-dating.service', 'runtime.env.example', 'account.public.example.json'].map(name => 'experiences/atlas-lab/deploy/' + name);
  assert.deepEqual([...runtime, ...templates, 'tools/atlas-dating-backup.mjs', 'experiences/atlas-lab/dating-reconcile.mjs'].sort(), [...DATING_PACKAGE_FILES]);
  assert.equal(DATING_PACKAGE_FILES.length, 57); assert.equal(DATING_PACKAGE_CONTENTS.length, 58);
  await visit(path.join(DATING_PACKAGE_ROOT, 'tools/atlas-dating-backup.mjs'));
  for (const filename of seen) assert.ok(DATING_PACKAGE_FILES.includes(path.relative(DATING_PACKAGE_ROOT, filename).replaceAll('\\', '/')), 'Offline backup dependency must be packaged');
});

test('isolated package starts from another cwd under a module parent and serves only the reviewed surface', { timeout: 30000 }, async t => {
  // Register process cleanup before fixture directory cleanup (test hooks are FIFO).
  let child, server;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
  const dir = await fixture(t), bundle = path.join(dir, 'bundle'), cwd = path.join(dir, 'unrelated-cwd');
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}'); await fs.mkdir(cwd);
  const built = await buildDatingPackage(bundle); assert.equal(built.verified, true); assert.equal(built.files, 58);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(bundle, 'package.json'), 'utf8')), { private: true, type: 'commonjs' });
  assert.equal(await exists(path.join(bundle, 'node_modules')), false);
  // The packaged operation tool must resolve the copied shared restore module.
  await assert.rejects(run(process.execPath, [path.join(bundle, 'tools/atlas-dating-backup.mjs')],
    { cwd, windowsHide: true, timeout: 10000 }), error => {
    assert.equal(JSON.parse(error.stderr.trim().split('\n').at(-1)).error.code, 'backup-arguments'); return true;
  });
  await assert.rejects(run(process.execPath, [path.join(bundle, 'tools/atlas-dating-backup.mjs'), 'create',
    path.join(DATING_PACKAGE_ROOT, 'experiences/atlas-lab/deploy/account.public.example.json')],
    { cwd, windowsHide: true, timeout: 10000 }), error => {
    assert.equal(JSON.parse(error.stderr.trim().split('\n').at(-1)).error.code, 'backup-repository-path-forbidden'); return true;
  });
  const listeningPort = await port(), origin = `http://127.0.0.1:${listeningPort}`, configPath = path.join(dir, 'outside-account.json'), db = path.join(dir, 'outside-data.sqlite');
  await fs.writeFile(configPath, JSON.stringify(accountConfig(origin)));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SYNK_DATING_')));
  Object.assign(env, { SYNK_DATING_MODE: 'account', SYNK_DATING_PORT: String(listeningPort), SYNK_DATING_DB: db, SYNK_DATING_ACCOUNT_CONFIG: configPath });
  const checked = await run(process.execPath, [path.join(bundle, entry), '--check-config'], { cwd, env, windowsHide: true, timeout: 10000 });
  const status = JSON.parse(checked.stdout); assert.equal(status.databaseOpened, false); assert.equal(status.listening, false); assert.equal(status.providerTested, false);
  assert.equal(await exists(db), false);
  // A successful same-port bind proves check-config did not leave a listener.
  const probe = net.createServer(); await new Promise(resolve => probe.listen(listeningPort, '127.0.0.1', resolve)); await new Promise(resolve => probe.close(resolve));
  let stdout = '', stderr = '';
  child = spawn(process.execPath, [path.join(bundle, entry)], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  for (let i = 0; i < 150 && !stdout.includes('/atlas-lab/dating.html') && child.exitCode === null; i++) await tick(20);
  assert.match(stdout, /SYNK 나다운 만남 \(account\)/, stderr);
  const configResponse = await request(origin + '/api/atlas-dating/config'), config = await configResponse.json();
  assert.equal(configResponse.status, 200); assert.equal(config.mode, 'account'); assert.equal(config.demoEnabled, false); assert.equal(config.labAvailable, false);
  for (const route of DATING_PUBLIC_FILES) { const response = await request(origin + route); assert.equal(response.status, 200, route); await response.arrayBuffer(); }
  for (const route of ['/atlas-lab/dating-server.mjs', '/atlas-lab/account.config.json', '/atlas-lab/deploy/account.public.example.json', '/dating-package.json', '/package.json', '/api/atlas-journey/state']) {
    const response = await request(origin + route); assert.equal(response.status, 404, route); await response.arrayBuffer();
  }
  const unauthorized = await request(origin + '/api/atlas-dating/state'); assert.equal(unauthorized.status, 401); await unauthorized.arrayBuffer();
  const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended; child = null;
  // Only the copied modules are imported; CJS engines resolve within the bundle.
  const packaged = await import(pathToFileURL(path.join(bundle, entry)).href);
  const start = async () => { server = packaged.createDatingServer({ mode: 'account', databasePath: db, verify: async () => ({ accountId: 'synk:package' }) });
    await new Promise(resolve => server.listen(listeningPort, '127.0.0.1', resolve)); };
  await start();
  const headers = { Origin: origin, Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' };
  const initial = await (await request(origin + '/api/atlas-dating/state', { headers })).json();
  const saved = await request(origin + '/api/atlas-dating/action', { method: 'POST', headers, body: JSON.stringify({ requestId: randomUUID(), expectedRevision: initial.view.revision,
    action: { kind: 'profile', profile: { nickname: '독립 묶음 합성 계정', region: '', intro: '' } } }) });
  assert.equal(saved.status, 200); const savedState = await saved.json();
  await server.shutdownDating(); server = null; await start();
  const restored = await (await request(origin + '/api/atlas-dating/state', { headers })).json();
  assert.equal(restored.view.profile.nickname, '독립 묶음 합성 계정'); assert.equal(restored.view.revision, savedState.view.revision);
  assert.equal((await verifyDatingPackage(bundle, built.manifestSha256)).verified, true);
});

test('canary operational files stay outside the allowlist and existing or in-checkout targets remain untouched', async t => {
  const dir = await fixture(t), source = path.join(dir, 'synthetic-source'), output = path.join(dir, 'package'); await copySource(source);
  const canaries = ['.env', 'account.sqlite', 'account.sqlite-wal', 'latest.json', 'experiences/atlas-lab/account.config.json', 'experiences/atlas-lab/qa/private.json', 'node_modules/private/index.js'];
  for (const name of canaries) { const filename = path.join(source, name); await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, 'synthetic-private-canary'); }
  const built = await buildDatingPackage(output, { sourceRoot: source });
  for (const name of canaries) assert.equal(await exists(path.join(output, name)), false, name);
  const manifest = await fs.readFile(path.join(output, 'dating-package.json'), 'utf8'); assert.ok(!manifest.includes('synthetic-private-canary'));
  await assert.rejects(buildDatingPackage(output, { sourceRoot: source }), { code: 'package-target-exists' });
  assert.equal(await fs.readFile(path.join(output, 'dating-package.json'), 'utf8'), manifest);
  assert.equal((await verifyDatingPackage(output, built.manifestSha256)).verified, true);
  const inside = path.join(source, 'must-not-exist');
  await assert.rejects(buildDatingPackage(inside, { sourceRoot: source }), { code: 'package-outside-checkout-required' }); assert.equal(await exists(inside), false);
});

test('independent manifest hash, payload integrity and exact file inventory reject tampering', async t => {
  const dir = await fixture(t), output = path.join(dir, 'package'), built = await buildDatingPackage(output);
  await assert.rejects(verifyDatingPackage(output), { code: 'package-trusted-hash-required' });
  const manifestPath = path.join(output, 'dating-package.json'), originalManifest = await fs.readFile(manifestPath);
  await fs.appendFile(manifestPath, ' '); await assert.rejects(verifyDatingPackage(output, built.manifestSha256), { code: 'package-manifest-changed' }); await fs.writeFile(manifestPath, originalManifest);
  const payload = path.join(output, 'atlas/domain.js'), originalPayload = await fs.readFile(payload);
  await fs.appendFile(payload, '\n// synthetic alteration'); await assert.rejects(verifyDatingPackage(output, built.manifestSha256), { code: 'package-file-changed' }); await fs.writeFile(payload, originalPayload);
  const extra = path.join(output, '.env'); await fs.writeFile(extra, 'synthetic-canary');
  await assert.rejects(verifyDatingPackage(output, built.manifestSha256), { code: 'package-unexpected-files' }); await fs.unlink(extra);
  assert.equal((await verifyDatingPackage(output, built.manifestSha256)).verified, true);
});

test('linked source roots, source ancestors and output directories are refused', async t => {
  const dir = await fixture(t), source = path.join(dir, 'source'), sourceAlias = path.join(dir, 'source-alias'); await copySource(source);
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'; await fs.symlink(source, sourceAlias, linkType);
  await assert.rejects(buildDatingPackage(path.join(dir, 'blocked-source'), { sourceRoot: sourceAlias }), { code: 'package-linked-directory' });
  const realAtlas = path.join(dir, 'real-atlas'); await fs.rename(path.join(source, 'atlas'), realAtlas); await fs.symlink(realAtlas, path.join(source, 'atlas'), linkType);
  await assert.rejects(buildDatingPackage(path.join(dir, 'blocked-ancestor'), { sourceRoot: source }), { code: 'package-linked-file' });
  assert.equal(await exists(path.join(dir, 'blocked-ancestor')), false);
  const output = path.join(dir, 'package'), built = await buildDatingPackage(output), alias = path.join(dir, 'package-alias'); await fs.symlink(output, alias, linkType);
  await assert.rejects(verifyDatingPackage(alias, built.manifestSha256), { code: 'package-linked-directory' });
  await assert.rejects(buildDatingPackage(path.join(sourceAlias, 'nested'), { sourceRoot: DATING_PACKAGE_ROOT }), { code: 'package-linked-directory' });
  await fs.symlink(realAtlas, path.join(output, 'linked-extra'), linkType);
  await assert.rejects(verifyDatingPackage(output, built.manifestSha256), { code: 'package-linked-file' });
});
