// Explicit opt-in to an existing Caddy binary. Local TLS and injected identity
// only: no ACME, operating-system trust changes, real provider or deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { DATING_PUBLIC_FILES } from '../experiences/atlas-lab/dating-public.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), run = promisify(execFile);
const deploy = path.join(root, 'experiences/atlas-lab/deploy'), binary = process.env.SYNK_QA_CADDY;
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
const listen = (server, port = 0) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
async function freePort() { const server = net.createServer(); await listen(server); const port = server.address().port;
  await new Promise(resolve => server.close(resolve)); return port; }
async function temporary() { return fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-caddy-')); }
async function removeOwn(dir) { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(dir).startsWith('synk-dating-caddy-')); await fs.rm(dir, { recursive: true, force: true }); }

test('unfilled deployment account example fails configuration-only startup without creating product data', async t => {
  const dir = await temporary(); t.after(() => removeOwn(dir));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SYNK_DATING_')));
  const text = await fs.readFile(path.join(deploy, 'runtime.env.example'), 'utf8');
  for (const line of text.split(/\r?\n/)) if (/^[A-Z_]+=/.test(line)) { const equals = line.indexOf('='); env[line.slice(0, equals)] = line.slice(equals + 1); }
  env.SYNK_DATING_ACCOUNT_CONFIG = path.join(deploy, 'account.public.example.json');
  env.SYNK_DATING_DB = path.join(dir, 'never-created.sqlite');
  await assert.rejects(run(process.execPath, [path.join(root, 'experiences/atlas-lab/dating-server.mjs'), '--check-config'],
    { cwd: root, env, windowsHide: true, timeout: 10000 }), error => {
    assert.equal(error.code, 1); assert.equal(error.stdout, '');
    assert.equal(JSON.parse(error.stderr).error.code, 'dating-runtime-account-config'); return true;
  });
  assert.deepEqual(await fs.readdir(dir), []);
});

test('actual Caddy template validates and enforces the standalone TLS, persistence and redacted failure contracts', {
  skip: binary ? false : 'Set SYNK_QA_CADDY to an explicitly installed Caddy binary; no download is performed.', timeout: 90000
}, async t => {
  assert.ok(path.isAbsolute(binary), 'SYNK_QA_CADDY must be an absolute binary path');
  const dir = await temporary(); let child, server, logs = '', stdout = '', verifyCalls = 0, firstForwarded;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const ended = new Promise(resolve => child.once('exit', resolve)); child.kill();
      await Promise.race([ended, tick(5000)]);
      assert.ok(child.exitCode !== null || child.signalCode !== null, 'The test Caddy process must exit before cleanup');
    }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await removeOwn(dir);
  });
  const version = (await run(binary, ['version'], { windowsHide: true, timeout: 5000 })).stdout.trim();
  assert.match(version, /^v2\./);
  const openssl = process.env.SYNK_QA_OPENSSL || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
  const key = path.join(dir, 'fixture-key.pem'), cert = path.join(dir, 'fixture-cert.pem');
  await run(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-keyout', key, '-out', cert, '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { windowsHide: true, timeout: 15000 });
  const ca = await fs.readFile(cert), port = await freePort(), backendPort = await freePort(), origin = `https://127.0.0.1:${port}`;
  const template = await fs.readFile(path.join(deploy, 'Caddyfile'), 'utf8');
  const quoted = filename => JSON.stringify(filename.replaceAll('\\', '/'));
  const configuration = template.replaceAll('dating.example.invalid', `127.0.0.1:${port}`).replaceAll('127.0.0.1:4302', `127.0.0.1:${backendPort}`)
    .replace(/\{\r?\n/, `{\n\tadmin off\n\tauto_https off\n\tpersist_config off\n\tstorage file_system {\n\t\troot ${quoted(path.join(dir, 'caddy-data'))}\n\t}\n`)
    .replace(`${origin} {`, `${origin} {\n\tbind 127.0.0.1\n\ttls ${quoted(cert)} ${quoted(key)}`);
  const configPath = path.join(dir, 'Caddyfile'); await fs.writeFile(configPath, configuration);
  const processEnv = { ...process.env, XDG_DATA_HOME: path.join(dir, 'xdg-data'), XDG_CONFIG_HOME: path.join(dir, 'xdg-config') };
  const adapted = await run(binary, ['adapt', '--adapter', 'caddyfile', '--config', configPath, '--pretty'], { env: processEnv, windowsHide: true, timeout: 10000 });
  const json = JSON.parse(adapted.stdout); assert.equal(json.admin.disabled, true);
  const listeners = Object.values(json.apps.http.servers).flatMap(value => value.listen);
  assert.deepEqual(listeners, [`127.0.0.1:${port}`]);
  await run(binary, ['validate', '--adapter', 'caddyfile', '--config', configPath], { env: processEnv, windowsHide: true, timeout: 15000 });
  const databasePath = path.join(dir, 'account.sqlite'), token = 'synthetic-caddy-access', subject = 'synk:caddy-account';
  const startBackend = async () => {
    server = createDatingServer({ mode: 'account', databasePath, transport: { publicOrigin: origin, trustedProxyIPs: ['127.0.0.1'] },
      accountConfig: { version: 1, supabaseUrl: 'https://identity.example.invalid', accountApiUrl: 'https://identity.example.invalid',
        supabasePublishableKey: 'sb_publishable_synthetic_caddy', portalUrl: 'https://identity.example.invalid/id/',
        clients: { platform: { clientId: 'synthetic-caddy-client', redirectUri: origin + '/atlas-lab/dating.html' } } },
      verify: async input => { verifyCalls++; return input === token ? { accountId: subject } : null; } });
    server.prependListener('request', req => { firstForwarded ||= { host: req.headers.host, proto: req.headers['x-forwarded-proto'],
      publicHost: req.headers['x-forwarded-host'], forwarded: req.headers.forwarded, peer: req.socket.remoteAddress, local: req.socket.localAddress }; });
    await listen(server, backendPort);
  };
  await startBackend();
  child = spawn(binary, ['run', '--adapter', 'caddyfile', '--config', configPath], { env: processEnv, cwd: dir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
  const request = (route, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = https.request(origin + route, { method, ca, agent: false, timeout: 5000, headers: { ...headers,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('local Caddy request timeout')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  let ready;
  for (let attempt = 0; attempt < 80; attempt++) { try { ready = await request('/api/atlas-dating/config'); if (ready.status === 200) break; } catch {} await tick(50); }
  if (ready?.status !== 200) t.diagnostic(JSON.stringify({ firstForwarded, expectedBackendPort: backendPort, expectedPublicPort: port }));
  assert.equal(ready?.status, 200, 'Caddy must expose the configured local backend'); assert.equal(verifyCalls, 0);
  const config = JSON.parse(ready.text); assert.equal(config.mode, 'account'); assert.equal(config.labAvailable, false);
  for (const route of DATING_PUBLIC_FILES) assert.equal((await request(route)).status, 200, route);
  for (const route of ['/atlas-lab/dating-server.mjs', '/atlas-lab/dating-adult.mjs', '/atlas-lab/dating-store.mjs',
    '/atlas-lab/account.config.json', '/atlas-lab/deploy/runtime.env.example', '/atlas-lab/qa/dating-https/result.json', '/api/atlas-journey/state'])
    assert.equal((await request(route)).status, 404, route);
  const spoofed = await request('/api/atlas-dating/config', { headers: { Forwarded: 'proto=http;host=evil.invalid',
    'X-Forwarded-Host': 'evil.invalid,duplicate.invalid', 'X-Forwarded-Proto': 'http,http' } });
  assert.equal(spoofed.status, 200, 'Caddy must replace attacker forwarding metadata');
  assert.equal((await request('/atlas-lab/dating.html?code=synthetic-callback', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 200);
  assert.equal((await request('/api/atlas-dating/state', { headers: { Origin: 'https://evil.invalid' } })).status, 403);
  assert.equal((await request('/api/atlas-dating/state', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await request('/api/atlas-dating/state')).status, 401); assert.equal(verifyCalls, 0);
  const headers = { Origin: origin, Authorization: `Bearer ${token}` };
  const initial = await request('/api/atlas-dating/state', { headers }); assert.equal(initial.status, 200);
  const input = { requestId: randomUUID(), expectedRevision: JSON.parse(initial.text).view.revision,
    action: { kind: 'profile', profile: { nickname: '합성 프록시 복원', region: '', intro: '' } } };
  const save = await request('/api/atlas-dating/action', { method: 'POST', headers, body: input }); assert.equal(save.status, 200, save.text);
  const revision = JSON.parse(save.text).view.revision;
  await server.shutdownDating(); server = null;
  const code = 'synthetic-code-must-not-log', secret = 'synthetic-bearer-must-not-log', beforeFailure = logs.length;
  const failed = await request(`/atlas-lab/dating.html?code=${code}&state=synthetic-state-must-not-log`, { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(failed.status, 502);
  let errors = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    errors = logs.slice(beforeFailure).split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }).filter(value => value.level === 'error');
    if (errors.length) break; await tick(25);
  }
  assert.ok(errors.length > 0, 'A real upstream failure must emit an error log for the redaction test');
  assert.ok(errors.some(value => value.status === 502 || /dial tcp|connect|refused/i.test(value.msg || '')));
  assert.ok(errors.every(value => !Object.hasOwn(value, 'request')));
  for (const sentinel of [code, secret, 'synthetic-state-must-not-log']) assert.ok(!(logs + stdout).includes(sentinel), `Caddy logs must omit ${sentinel}`);
  await startBackend();
  const restored = await request('/api/atlas-dating/state', { headers }); assert.equal(restored.status, 200);
  assert.equal(JSON.parse(restored.text).view.profile.nickname, '합성 프록시 복원'); assert.equal(JSON.parse(restored.text).view.revision, revision);
  t.diagnostic(JSON.stringify({ caddy: version.split(' ')[0], publicFiles: DATING_PUBLIC_FILES.length, privateRoutesRejected: 7,
    upstreamFailureStatus: failed.status, observedErrorLogs: errors.length, requestFieldRedacted: true, profileRestored: true,
    tlsTrust: 'fixture CA supplied to these HTTPS requests only', externalProviderCalls: 0, acmeEnabled: false, adminEnabled: false }));
});
