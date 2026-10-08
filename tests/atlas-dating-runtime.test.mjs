import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readDatingRuntimeConfig, inspectDatingRuntimeConfig, loadDatingAdultAdapter, datingRuntimeError, readDatingRuntimeArguments, assertDatingRestoreCommand } from '../experiences/atlas-lab/dating-runtime.mjs';
import { createDatingAdultVerifier } from '../experiences/atlas-lab/dating-adult.mjs';
import { createDatingLifecycleVerifier } from '../experiences/atlas-lab/dating-lifecycle.mjs';

const execute = promisify(execFile), cli = fileURLToPath(new URL('../experiences/atlas-lab/dating-server.mjs', import.meta.url));
const SECRET = 'synthetic-server-only-lifecycle-token-0001';
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SYNK_DATING_')));
const publicConfig = (port = 4300, identity = 'http://127.0.0.1:4301') => ({ version: 1, supabaseUrl: identity,
  supabasePublishableKey: 'sb_publishable_synthetic_runtime', portalUrl: identity + '/id/', accountApiUrl: identity,
  clients: { platform: { clientId: 'synthetic-dating-runtime', redirectUri: `http://127.0.0.1:${port}/atlas-lab/dating.html` } } });
async function fixture(t, config = publicConfig()) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-runtime-')), filename = path.join(dir, 'public.json');
  await fs.writeFile(filename, JSON.stringify(config));
  t.after(async () => { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-dating-runtime-'));
    await fs.rm(dir, { recursive: true, force: true }); });
  return { dir, filename, env: { SYNK_DATING_MODE: 'account', SYNK_DATING_ACCOUNT_CONFIG: filename, SYNK_DATING_DB: path.join(dir, 'account.sqlite') } };
}
async function reservePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }

test('an account host derives its fixed port from the registered callback and rejects mismatched or ephemeral ports', async t => {
  const f = await fixture(t), config = await readDatingRuntimeConfig(f.env);
  assert.equal(config.port, 4300); assert.equal(config.host, '127.0.0.1'); assert.equal(config.mode, 'account');
  assert.equal((await readDatingRuntimeConfig({ ...f.env, SYNK_DATING_PORT: '4300' })).port, 4300);
  for (const value of ['0', '-1', '65536', '4e3', ' 4300', '4300.0', ''])
    await assert.rejects(readDatingRuntimeConfig({ ...f.env, SYNK_DATING_PORT: value }), { code: 'dating-runtime-port' });
  await assert.rejects(readDatingRuntimeConfig({ ...f.env, SYNK_DATING_PORT: '4302' }), { code: 'dating-runtime-port-mismatch' });
  assert.equal((await readDatingRuntimeConfig({})).port, 0);
});

test('restore mode requires paired paths, an explicit account database and an explicit check or resume command', async t => {
  const f = await fixture(t), env = { ...f.env, SYNK_DATING_RESTORE_EVIDENCE: path.join(f.dir, 'paired.json'), SYNK_DATING_RESTORE_LATEST: path.join(f.dir, 'latest.json') };
  const settings = await readDatingRuntimeConfig(env), checked = inspectDatingRuntimeConfig(settings);
  assert.equal(checked.restoreConfigured, true); assert.equal(checked.restoreChecked, false); assert.equal(checked.databaseOpened, false);
  assert.equal(JSON.stringify(checked).includes(f.dir), false);
  for (const flag of ['--check-restore', '--resume-after-restore', '--check-config']) assert.doesNotThrow(() => assertDatingRestoreCommand(settings, readDatingRuntimeArguments([flag])));
  assert.throws(() => assertDatingRestoreCommand(settings, readDatingRuntimeArguments([])), { code: 'dating-runtime-restore-command' });
  const normal = await readDatingRuntimeConfig(f.env);
  for (const flag of ['--check-restore', '--resume-after-restore']) assert.throws(() => assertDatingRestoreCommand(normal, readDatingRuntimeArguments([flag])), { code: 'dating-runtime-restore-command' });
  for (const key of ['SYNK_DATING_RESTORE_EVIDENCE', 'SYNK_DATING_RESTORE_LATEST', 'SYNK_DATING_DB']) {
    const missing = { ...env }; delete missing[key];
    await assert.rejects(readDatingRuntimeConfig(missing), { code: 'dating-runtime-restore-config' });
  }
  await assert.rejects(readDatingRuntimeConfig({ ...env, SYNK_DATING_MODE: 'demo' }), { code: 'dating-runtime-restore-config' });
  await assert.rejects(readDatingRuntimeConfig({ ...env, SYNK_DATING_RESTORE_LATEST: env.SYNK_DATING_RESTORE_EVIDENCE }), { code: 'dating-runtime-restore-config' });
  await assert.rejects(fs.stat(f.env.SYNK_DATING_DB), { code: 'ENOENT' });
});

test('the local CLI refuses callbacks it cannot serve and account files do not fall back to demo', async t => {
  const f = await fixture(t);
  for (const callback of ['https://example.test/atlas-lab/dating.html', 'http://127.0.0.1:4300/other',
    'http://127.0.0.1:4300/atlas-lab/dating.html?product=platform', 'http://localhost:4300/atlas-lab/dating.html']) {
    const config = publicConfig(); config.clients.platform.redirectUri = callback; await fs.writeFile(f.filename, JSON.stringify(config));
    await assert.rejects(readDatingRuntimeConfig(f.env), { code: 'dating-runtime-callback' });
  }
  await assert.rejects(readDatingRuntimeConfig({ SYNK_DATING_MODE: 'account' }), { code: 'dating-runtime-account-file' });
  await assert.rejects(readDatingRuntimeConfig({ SYNK_DATING_MODE: 'acount' }), { code: 'dating-runtime-mode' });
  await fs.writeFile(f.filename, JSON.stringify({ ...publicConfig(), supabasePublishableKey: 'sb_secret_synthetic_never_print' }));
  await assert.rejects(readDatingRuntimeConfig(f.env), { code: 'dating-runtime-account-config' });
  await fs.writeFile(f.filename, JSON.stringify({ ...publicConfig(), accountApiUrl: 'http://127.0.0.1:4301/?token=synthetic-private-token' }));
  await assert.rejects(readDatingRuntimeConfig(f.env), { code: 'dating-runtime-account-config' });
});

test('HTTPS proxy configuration pins the public callback separately from its private listening port', async t => {
  const config = publicConfig(); config.clients.platform.redirectUri = 'https://dating.example.test/atlas-lab/dating.html';
  const f = await fixture(t, config), env = { ...f.env, SYNK_DATING_PORT: '4302',
    SYNK_DATING_PUBLIC_ORIGIN: 'https://dating.example.test', SYNK_DATING_TRUSTED_PROXIES: '127.0.0.1,::1' };
  const settings = await readDatingRuntimeConfig(env), checked = inspectDatingRuntimeConfig(settings);
  assert.equal(settings.host, '127.0.0.1'); assert.equal(settings.port, 4302);
  assert.deepEqual(settings.transport, { publicOrigin: 'https://dating.example.test', trustedProxyIPs: ['127.0.0.1', '::1'] });
  assert.equal(checked.transportMode, 'https-reverse-proxy'); assert.equal(checked.callbackOriginMatched, true);
  assert.equal(checked.callbackPortMatched, null); assert.equal(checked.providerTested, false);
  const { stdout } = await execute(process.execPath, [cli, '--check-config'], { env: { ...cleanEnv(), ...env } });
  assert.deepEqual(JSON.parse(stdout), checked); await assert.rejects(fs.stat(env.SYNK_DATING_DB), { code: 'ENOENT' });
  for (const key of ['SYNK_DATING_PORT', 'SYNK_DATING_DB']) {
    const missing = { ...env }; delete missing[key];
    await assert.rejects(readDatingRuntimeConfig(missing), { code: 'dating-runtime-public-storage' });
  }
});

test('public transport settings cannot silently enable demo or accept ambiguous trust declarations', async t => {
  const config = publicConfig(); config.clients.platform.redirectUri = 'https://dating.example.test/atlas-lab/dating.html';
  const f = await fixture(t, config), env = { ...f.env, SYNK_DATING_PORT: '4302',
    SYNK_DATING_PUBLIC_ORIGIN: 'https://dating.example.test', SYNK_DATING_TRUSTED_PROXIES: '127.0.0.1' };
  for (const patch of [{ SYNK_DATING_MODE: 'demo' }, { SYNK_DATING_PUBLIC_ORIGIN: '' },
    { SYNK_DATING_PUBLIC_ORIGIN: 'http://dating.example.test' }, { SYNK_DATING_TRUSTED_PROXIES: '' },
    { SYNK_DATING_TRUSTED_PROXIES: '*' }, { SYNK_DATING_TRUSTED_PROXIES: '127.0.0.1,' },
    { SYNK_DATING_TRUSTED_PROXIES: '127.0.0.1,::ffff:127.0.0.1' }])
    await assert.rejects(readDatingRuntimeConfig({ ...env, ...patch }), { code: 'dating-runtime-transport' });
  for (const key of ['SYNK_DATING_PUBLIC_ORIGIN', 'SYNK_DATING_TRUSTED_PROXIES']) {
    const missing = { ...env }; delete missing[key];
    await assert.rejects(readDatingRuntimeConfig(missing), { code: 'dating-runtime-transport' });
  }
});

test('a public host rejects a callback for another origin or page before opening storage', async t => {
  const f = await fixture(t), env = { ...f.env, SYNK_DATING_PORT: '4302',
    SYNK_DATING_PUBLIC_ORIGIN: 'https://dating.example.test', SYNK_DATING_TRUSTED_PROXIES: '127.0.0.1' };
  for (const callback of ['https://other.example.test/atlas-lab/dating.html', 'https://dating.example.test:8443/atlas-lab/dating.html',
    'https://dating.example.test/other', 'https://dating.example.test/atlas-lab/dating.html?product=platform',
    'http://127.0.0.1:4300/atlas-lab/dating.html']) {
    const config = publicConfig(); config.clients.platform.redirectUri = callback; await fs.writeFile(f.filename, JSON.stringify(config));
    await assert.rejects(readDatingRuntimeConfig(env), { code: 'dating-runtime-public-callback' });
  }
  await assert.rejects(fs.stat(env.SYNK_DATING_DB), { code: 'ENOENT' });
});

test('the actual public factory guards configuration, static files and APIs before authentication', async t => {
  const { createDatingServer } = await import('../experiences/atlas-lab/dating-server.mjs');
  let server;
  t.after(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } });
  const publicOrigin = 'https://dating.example.test', accountConfig = publicConfig();
  accountConfig.clients.platform.redirectUri = publicOrigin + '/atlas-lab/dating.html';
  const f = await fixture(t, accountConfig); let verified = 0;
  server = createDatingServer({ mode: 'account', databasePath: f.env.SYNK_DATING_DB, accountConfig,
    transport: { publicOrigin, trustedProxyIPs: ['127.0.0.1'] },
    verify: async () => { verified++; return { accountId: '10000000-0000-4000-8000-000000000099' }; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const backend = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'dating.example.test' };
  for (const route of ['/', '/atlas-lab/dating.html', '/api/atlas-dating/config', '/api/atlas-dating/state']) {
    assert.equal((await fetch(backend + route)).status, 403, route);
    assert.equal((await fetch(backend + route, { headers: { ...headers, 'X-Forwarded-Host': 'evil.example.test' } })).status, 403, route);
  }
  assert.equal(verified, 0);
  const callback = await fetch(backend + '/atlas-lab/dating.html?code=synthetic&state=synthetic', { headers: { ...headers, 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(callback.status, 200); assert.ok((await callback.text()).includes('id="lab-link"'));
  const settings = await fetch(backend + '/api/atlas-dating/config', { headers }).then(res => res.json());
  assert.equal(settings.labAvailable, false); assert.equal(settings.demoEnabled, false);
  assert.equal(settings.accountConfig.clients.platform.redirectUri, accountConfig.clients.platform.redirectUri);
  assert.equal(JSON.stringify(settings).includes('trustedProxyIPs'), false);
  assert.equal((await fetch(backend + '/api/atlas-dating/state', { headers: { ...headers, 'Sec-Fetch-Site': 'cross-site', Authorization: 'Bearer synthetic' } })).status, 403);
  assert.equal(verified, 0);
  assert.equal((await fetch(backend + '/api/atlas-dating/state', { headers: { ...headers, Authorization: 'Bearer synthetic' } })).status, 200);
  assert.equal(verified, 1);
  for (const route of ['/atlas-lab/dating-runtime.mjs', '/atlas-lab/dating-transport.mjs', '/atlas-lab/', '/api/atlas-journey/state'])
    assert.equal((await fetch(backend + route, { headers })).status, 404, route);
});

test('configuration inspection is redacted and never evaluates an adult module, opens SQLite or starts a server', async t => {
  const f = await fixture(t), module = path.join(f.dir, 'adapter.mjs'), marker = path.join(f.dir, 'imported.txt');
  await fs.writeFile(module, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)},'must not run'); throw Error('synthetic-private-adapter-error');`);
  const env = { ...f.env, SYNK_DATING_ADULT_ADAPTER: module, SYNK_DATING_LIFECYCLE_TOKEN: SECRET };
  const config = await readDatingRuntimeConfig(env), report = inspectDatingRuntimeConfig(config);
  assert.equal(report.adultAdapterPresent, true); assert.equal(report.adultAdapterContractChecked, false); assert.equal(report.lifecycleConfigured, true);
  assert.equal(report.providerTested, false); assert.equal(report.databaseOpened, false); assert.equal(report.listening, false);
  const { stdout } = await execute(process.execPath, [cli, '--check-config'], { env: { ...cleanEnv(), ...env } });
  assert.deepEqual(JSON.parse(stdout), report); assert.equal(stdout.includes(SECRET), false); assert.equal(stdout.includes(f.dir), false);
  await assert.rejects(fs.stat(marker), { code: 'ENOENT' }); await assert.rejects(fs.stat(env.SYNK_DATING_DB), { code: 'ENOENT' });
});

test('only an explicit account server loads a trusted adult adapter and loading never invokes verify', async t => {
  const f = await fixture(t), module = path.join(f.dir, 'adapter.mjs'), marker = path.join(f.dir, 'called.txt');
  await fs.writeFile(module, `import fs from 'node:fs/promises'; export default { required:true, issuer:'synthetic-runtime-adult', timeoutMs:30, admission:{maxActive:2,maxQueued:3,waitMs:40},
    async verify({subjectId,at,signal}) { await fs.writeFile(${JSON.stringify(marker)}, subjectId); return {version:1,subjectId,issuer:'synthetic-runtime-adult',status:'pending',sequence:1,issuedAt:at,validUntil:null}; } };`);
  await assert.rejects(readDatingRuntimeConfig({ SYNK_DATING_ADULT_ADAPTER: module }), { code: 'dating-runtime-account-only' });
  const settings = await readDatingRuntimeConfig({ ...f.env, SYNK_DATING_ADULT_ADAPTER: module });
  const adapter = await loadDatingAdultAdapter(settings.adultAdapterPath);
  assert.deepEqual(adapter.admission, { maxActive: 2, maxQueued: 3, waitMs: 40 });
  await assert.rejects(fs.stat(marker), { code: 'ENOENT' });
  assert.equal((await createDatingAdultVerifier(adapter).check('synk:synthetic-runtime', '2026-10-08T00:00:00.000Z')).claim.status, 'pending');
  assert.equal(await fs.readFile(marker, 'utf8'), 'synk:synthetic-runtime');
  assert.equal(await loadDatingAdultAdapter(undefined), undefined);
});

test('invalid adult adapters and private provider errors produce only fixed configuration errors', async t => {
  const f = await fixture(t);
  const sources = ['export default {required:false, issuer:"synthetic",verify(){}}', 'export default {required:true,issuer:"synthetic"}',
    'export default {required:true,issuer:"synthetic",verify(){},token:"synthetic-private-token"}', 'throw Error("synthetic-private-provider-detail")',
    'export default {required:true,issuer:"synthetic",verify(){},admission:{maxActive:0}}',
    'export default {required:true,issuer:"synthetic",verify(){},admission:{maxQueued:257}}',
    'export default {required:true,issuer:"synthetic",verify(){},admission:{waitMs:5001}}',
    'export default {required:true,issuer:"synthetic",verify(){},admission:{unbounded:true}}'];
  for (let index = 0; index < sources.length; index++) {
    const module = path.join(f.dir, `invalid-${index}.mjs`); await fs.writeFile(module, sources[index]);
    await assert.rejects(loadDatingAdultAdapter(module), { code: 'dating-runtime-adult-contract' });
  }
  await assert.rejects(readDatingRuntimeConfig({ ...f.env, SYNK_DATING_ADULT_ADAPTER: 'https://example.test/provider.mjs' }), { code: 'dating-runtime-adult-file' });
  assert.deepEqual(datingRuntimeError(new Error('synthetic-private-token')), {
    code: 'dating-runtime-start', message: 'The local dating server could not start. Review its configuration and listening port.' });
});

test('the lifecycle receiver and CLI accept only the same 32 to 256 character contract as the central sender', async t => {
  const f = await fixture(t);
  for (const length of [32, 256]) {
    const token = 'x'.repeat(length), settings = await readDatingRuntimeConfig({ ...f.env, SYNK_DATING_LIFECYCLE_TOKEN: token });
    assert.doesNotThrow(() => createDatingLifecycleVerifier(settings.lifecycle));
  }
  for (const token of ['short', 'x'.repeat(257), 'x'.repeat(32) + '\n']) {
    await assert.rejects(readDatingRuntimeConfig({ ...f.env, SYNK_DATING_LIFECYCLE_TOKEN: token }), { code: 'dating-runtime-lifecycle' });
    assert.throws(() => createDatingLifecycleVerifier({ token, issuer: 'synk-account', audience: 'atlas-dating' }));
  }
  await assert.rejects(readDatingRuntimeConfig({ SYNK_DATING_LIFECYCLE_TOKEN: SECRET }), { code: 'dating-runtime-account-only' });
});

test('CLI malformed files and unknown arguments exit without printing private JSON or creating a database', async t => {
  const f = await fixture(t); await fs.writeFile(f.filename, '{"secret":"synthetic-private-canary" bad-json');
  for (const args of [[], ['--check-config'], ['--unknown']]) {
    try { await execute(process.execPath, [cli, ...args], { env: { ...cleanEnv(), ...f.env } }); assert.fail('must reject'); }
    catch (error) { assert.equal(error.code, 1); assert.equal(error.stdout, ''); assert.equal(error.stderr.includes('synthetic-private-canary'), false);
      assert.equal(error.stderr.includes(f.dir), false); const last = error.stderr.trim().split('\n').at(-1); assert.equal(JSON.parse(last).ok, false); }
  }
  await assert.rejects(fs.stat(f.env.SYNK_DATING_DB), { code: 'ENOENT' });
});

test('an occupied fixed callback port stops the CLI instead of moving the account host to an unregistered port', async t => {
  const occupied = net.createServer(); await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => occupied.close(resolve)); });
  const f = await fixture(t, publicConfig(occupied.address().port));
  try { await execute(process.execPath, [cli], { env: { ...cleanEnv(), ...f.env }, timeout: 10000 }); assert.fail('must reject'); }
  catch (error) { assert.equal(error.code, 1); assert.equal(error.stdout, '');
    assert.equal(JSON.parse(error.stderr.trim().split('\n').at(-1)).error.code, 'dating-runtime-start'); }
  // A failed listen releases its SQLite store, including on Windows.
  await fs.rename(f.env.SYNK_DATING_DB, path.join(f.dir, 'closed.sqlite'));
});

test('the actual CLI wires the adult and lifecycle adapters while public configuration contains neither', async t => {
  // Synthetic loopback account endpoint only; no OAuth provider or identity proof.
  let child, closed;
  t.after(async () => { if (child) { if (child.exitCode === null) child.kill(); await closed; } });
  const subjectId = randomUUID(), identity = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, account: { status: 'active', synk_user_id: subjectId } })); });
  await new Promise(resolve => identity.listen(0, '127.0.0.1', resolve));
  t.after(async () => { identity.closeAllConnections(); await new Promise(resolve => identity.close(resolve)); });
  const port = await reservePort(), f = await fixture(t, publicConfig(port, `http://127.0.0.1:${identity.address().port}`));
  const module = path.join(f.dir, 'cli-adapter.mjs');
  await fs.writeFile(module, `export default {required:true,issuer:'synthetic-cli-adult',async verify({subjectId,at}) {
    return {version:1,subjectId,issuer:'synthetic-cli-adult',status:'verified',sequence:1,issuedAt:'2026-10-01T00:00:00.000Z',validUntil:'2099-01-01T00:00:00.000Z'}; }};`);
  child = spawn(process.execPath, [cli], { env: { ...cleanEnv(), ...f.env, SYNK_DATING_ADULT_ADAPTER: module, SYNK_DATING_LIFECYCLE_TOKEN: SECRET }, windowsHide: true });
  let stdout = '', stderr = ''; child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
  closed = new Promise(resolve => child.once('exit', resolve));
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('CLI startup timed out')), 10000);
    child.stdout.on('data', () => { if (stdout.includes(`:${port}/atlas-lab/dating.html`)) { clearTimeout(timer); resolve(); } });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('CLI exited before startup')); }); });
  const origin = `http://127.0.0.1:${port}`, configResponse = await fetch(origin + '/api/atlas-dating/config').then(response => response.text());
  assert.equal(configResponse.includes(SECRET), false); assert.equal(configResponse.includes('synthetic-cli-adult'), false); assert.equal(configResponse.includes(module), false);
  const response = await fetch(origin + '/api/atlas-dating/state', { headers: { Origin: origin, Authorization: 'Bearer synthetic-runtime-account-token' } });
  assert.equal(response.status, 200); const { view } = await response.json(); assert.equal(view.adult.verification.required, true); assert.equal(view.adult.verified, true);
  const event = { version: 1, type: 'account.deleted', eventId: randomUUID(), subjectId, occurredAt: new Date().toISOString(), issuer: 'synk-account', audience: 'atlas-dating' };
  const deletion = await fetch(origin + '/api/atlas-dating/lifecycle', { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
  assert.equal(deletion.status, 200); assert.equal((await deletion.json()).status, 'deleted');
  assert.equal((stdout + stderr).includes(SECRET), false); assert.equal((stdout + stderr).includes('synthetic-runtime-account-token'), false);
});
