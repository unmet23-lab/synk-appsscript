'use strict';
// The app's provisioning client against the real provisioning server code (server/*.mjs)
// over local HTTP, with the server's B2 and Google doubles (STAGE1_DESIGN.md 「개통 서버 구현
// 설계」). The client's fixed https address is mapped to the local server only by the
// injected `call`; the production serverCall refuses any other host (tested below).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { ProvisionClient, SERVER } = require('../src/provision-client.cjs');
const { serverCall } = require('../src/recovery-http.cjs');

const server = (f) => import(require('node:url').pathToFileURL(path.join(__dirname, '../../server', f)).href);
const encryptionKey = crypto.randomBytes(32);
const secretStore = { encrypt(text) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv); return Buffer.concat([iv, c.update(text), c.final(), c.getAuthTag()]); }, decrypt(bytes) { const d = crypto.createDecipheriv('aes-256-gcm', encryptionKey, bytes.subarray(0, 12)); d.setAuthTag(bytes.subarray(-16)); return Buffer.concat([d.update(bytes.subarray(12, -16)), d.final()]).toString(); } };

async function harness(t, { grace = 0 } = {}) {
  const [{ FakeB2, fakeGoogle, clockAt, sessionOf }, { Store }, { createVerifier }, { keyHandlers, WRITE_CAPS }, { fileHandlers }, { createApi }, { createJobs }, { createMailer }] =
    await Promise.all(['tests/fakes.mjs', 'store.mjs', 'google-token.mjs', 'keys-worker.mjs', 'files-worker.mjs', 'server.mjs', 'jobs.mjs', 'mail.mjs'].map(server));
  const clock = clockAt(Date.now()), now = () => clock.t;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-provision-'));
  const b2 = new FakeB2({ clock });
  const keysFn = keyHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now });
  const filesFn = fileHandlers({ withSession: sessionOf(b2), bucketId: b2.bucketId, stateDir: dir, now });
  const direct = (handlers) => async (method, params) => { try { return await handlers[method](params); } catch (e) { throw Object.assign(new Error(e.code || 'WORKER_FAILED'), { code: e.code || 'WORKER_FAILED' }); } };
  const store = new Store(path.join(dir, 'wb.sqlite'), { now });
  const g = fakeGoogle({ clock });
  const api = createApi({ store, keys: direct(keysFn), files: direct(filesFn), mailer: createMailer({ store }), now, verifyGoogle: createVerifier({ audiences: [g.aud], fetchImpl: g.fetchImpl, now }),
    config: { endpoint: 'https://s3.us-east-005.backblazeb2.com', bucket: 'synk-wb-test-bucket', restoreGraceMs: grace } });
  const srv = api.server(); await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  t.after(async () => { srv.close(); store.close(); await fs.rm(dir, { recursive: true, force: true }); });
  const port = srv.address().port;
  const jobs = createJobs({ store, api, keys: direct(keysFn), files: direct(filesFn), now, config: { bucketId: b2.bucketId } });
  // The app's call, mapped from the fixed address to the local server.
  const call = async (url, { method, body, token }) => {
    assert.ok(url.startsWith(SERVER));
    const res = await fetch(`http://127.0.0.1:${port}/backup-api/v1/${url.slice(SERVER.length)}`, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  const auth = (claims = {}) => ({ calls: [], async signIn({ nonce, expectedSub }) { this.calls.push({ nonce, expectedSub }); const sub = claims.sub || '1000001'; if (expectedSub && expectedSub !== sub) throw Object.assign(new Error('ACCOUNT'), { code: 'ACCOUNT' }); return { idToken: g.token({ nonce, ...claims }), nonce, sub, email: claims.email || 'pilot@example.com' }; } });
  const client = async (name, claims, opts = {}) => { const c = new ProvisionClient({ dir: path.join(dir, name), secretStore, auth: auth(claims), call, now, ...opts }); await c.open(); return c; };
  return { b2, store, api, jobs, client, clock, dir, WRITE_CAPS };
}

test('provision: invited Google account → device token and write key kept encrypted, keys acknowledged', async (t) => {
  const h = await harness(t);
  const pc = await h.client('pc1');
  await assert.rejects(pc.provision({ name: 'PC-1', appVersion: '0.7.0' }), { code: 'NOT_INVITED' });
  h.store.addInvite('pilot@example.com');
  const r = await pc.provision({ name: 'PC-1', appVersion: '0.7.0' });
  assert.equal(r.role, 'write');
  assert.match(r.repository.prefix, /^c\/[a-z0-9]{16}\/r$/);
  assert.ok(r.readKey, 'the first device gets the customer read key for the envelope');
  assert.equal(pc.auth.calls[0].nonce.length, 43, 'the sign-in carried the server nonce');
  const write = await pc.writeCredentials();
  assert.deepEqual(h.b2.keys.get(write.keyId).capabilities, h.WRITE_CAPS);
  for (const k of h.store.all('select state, kind from keys')) assert.equal(k.state, k.kind === 'write' ? 'active' : 'acked');
  // Nothing secret in plain files on disk.
  for (const f of await fs.readdir(path.join(h.dir, 'pc1'))) {
    const bytes = await fs.readFile(path.join(h.dir, 'pc1', f));
    assert.equal(bytes.includes(Buffer.from(pc.device.token)), false);
    assert.equal(bytes.includes(Buffer.from(write.applicationKey)), false);
  }
  // A reopened client reads its device back; the account stays bound to the first subject.
  const again = new ProvisionClient({ dir: path.join(h.dir, 'pc1'), secretStore, auth: pc.auth, call: pc.call });
  assert.equal((await again.open()).deviceId, r.deviceId);
  assert.equal((await again.status()).device.state, 'active');
  await assert.rejects(again.provision({ name: 'x' }), { code: 'ALREADY' });
});

test('move: the new PC reads, takes the seat after the migration, the old PC is told it moved', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const oldPc = await h.client('old'); await oldPc.provision({ name: '옛 PC' });
  const oldKey = await oldPc.writeCredentials();
  const newPc = await h.client('new');
  const r = await newPc.provision({ name: '새 PC' });
  assert.equal(r.role, 'read'); assert.equal(r.readKey, null); assert.equal(r.writer.name, '옛 PC');
  assert.equal(await newPc.writeCredentials(), null);
  const seat = await newPc.takeWriteSeat();
  assert.equal(seat.previous.name, '옛 PC');
  assert.equal(h.b2.keys.has(oldKey.keyId), false, 'the old PC write key is gone');
  assert.ok(await newPc.writeCredentials());
  const s = await oldPc.status();
  assert.equal(s.device.state, 'moved'); assert.equal(s.device.movedTo.name, '새 PC');
  // An unacknowledged key is reported, not silently kept.
  newPc.call = async (url, o) => { if (url.endsWith('keys/ack')) return { status: 200, data: { ok: true, acked: [] } }; return pcCall(url, o); };
  const pcCall = oldPc.call;
  await assert.rejects(newPc.takeWriteSeat(), { code: 'KEY_GONE' });
});

test('restore: run through the client — keys rotate, the job completes, continue clears the wait', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc'); const p = await pc.provision({ name: 'PC' });
  await pc.confirmReadKey(p.readKey.keyId);
  const base = p.repository.prefix + '/';
  h.b2.upload(base + 'config', 'c'); h.b2.upload(base + 'snapshots/s1', 's1');
  h.clock.advance(3600000); const at = h.clock.t - 1;
  h.b2.hide(base + 'snapshots/s1'); h.clock.advance(60000);
  const plan = await pc.restorePlan(at);
  assert.deepEqual(plan.plan.counts, { copy: 1, hide: 0, unchanged: 1 });
  const before = await pc.writeCredentials();
  const run = await pc.restoreRun(at);
  assert.notEqual((await pc.writeCredentials()).keyId, before.keyId);
  assert.ok(run.readKey.keyId);
  await h.api.runJob(h.store.job(run.jobId));
  const job = await pc.restoreJob(run.jobId);
  assert.equal(job.state, 'done');
  assert.equal((await pc.restoreChoose(run.jobId, 'continue')).state, 'continued');
  assert.equal((await pc.status()).restore, null);
});

test('serverCall: only the fixed https host and path, device token shape, no redirects, server codes kept', async (t) => {
  await assert.rejects(serverCall('https://evil.invalid/backup-api/v1/status'), { code: 'INVALID' });
  await assert.rejects(serverCall('http://workspace.synk.im/backup-api/v1/status'), { code: 'INVALID' });
  await assert.rejects(serverCall('https://workspace.synk.im/other'), { code: 'INVALID' });
  await assert.rejects(serverCall('https://workspace.synk.im:444/backup-api/v1/status'), { code: 'INVALID' });
  await assert.rejects(serverCall(`${SERVER}status`, { token: 'not a token' }), { code: 'INVALID' });
  let response = { code: 409, body: JSON.stringify({ ok: false, code: 'BUSY' }) }, seen = null;
  t.mock.method(https, 'request', (url, options, cb) => {
    seen = { url: String(url), options };
    const req = new EventEmitter(); req.destroy = () => {};
    req.end = () => queueMicrotask(() => { const res = new EventEmitter(); res.statusCode = response.code; res.headers = {}; res.destroy = () => {}; cb(res); res.emit('data', Buffer.from(response.body)); res.emit('end'); });
    return req;
  });
  const token = 'wbd_' + 'A'.repeat(43);
  assert.deepEqual(await serverCall(`${SERVER}status`, { token }), { status: 409, data: { ok: false, code: 'BUSY' } });
  assert.equal(seen.options.headers.authorization, `Bearer ${token}`);
  assert.equal(seen.options.agent, false, 'no shared agent or ambient proxy');
  response = { code: 302, body: JSON.stringify({ ok: true }) };
  await assert.rejects(serverCall(`${SERVER}status`), { code: 'INVALID' });
  response = { code: 200, body: 'x'.repeat(300000) };
  await assert.rejects(serverCall(`${SERVER}status`), { code: 'INVALID' });
  response = { code: 502, body: '<html>bad gateway</html>' };
  await assert.rejects(serverCall(`${SERVER}status`), { code: 'NETWORK' });
});

test('GPT GA3: an acknowledgement whose answer was lost loses no key — provision again finishes the same sign-up', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc');
  const real = pc.call; let dropped = false;
  pc.call = async (url, o) => { const r = await real(url, o); if (url.endsWith('keys/ack') && !dropped) { dropped = true; throw Object.assign(new Error('NETWORK'), { code: 'NETWORK' }); } return r; };
  await assert.rejects(pc.provision({ name: 'PC' }), { code: 'NETWORK' });
  const pending = await pc.pendingReadKey();
  assert.ok(pending, 'the read key was stored before the acknowledgement');
  // A reopened app finishes the same sign-up: same device, same keys, nothing new made.
  const again = new ProvisionClient({ dir: path.join(h.dir, 'pc'), secretStore, auth: pc.auth, call: real });
  await again.open();
  const r = await again.provision({ name: 'PC' });
  assert.equal(r.deviceId, pc.device.deviceId); assert.equal(r.readKey.keyId, pending.keyId);
  assert.equal(h.store.all("select count(*) n from keys where kind = 'read'")[0].n, 1);
  await assert.rejects(again.provision({ name: 'PC' }), { code: 'ALREADY' });
  await again.confirmReadKey(pending.keyId);
  assert.equal(await again.pendingReadKey(), null);
});

test('GPT r2 GA3: a sign-up stopped before its keys were stored is KEY_GONE, not a finished device', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc');
  await pc.provision({ name: 'PC' });
  // As if the app stopped right after the device file: the key files are gone.
  for (const f of ['write-key.bin', 'read-key.bin']) await fs.rm(path.join(h.dir, 'pc', f), { force: true });
  const again = new ProvisionClient({ dir: path.join(h.dir, 'pc'), secretStore, auth: pc.auth, call: pc.call });
  await again.open();
  again.device = { ...again.device, done: false }; await again.save('device.bin', again.device);
  await assert.rejects(again.provision({ name: 'PC' }), { code: 'KEY_GONE' });
  // GPT r3 GA1: an unfinished device file that does not say what it expects is not finished either.
  const { expect, ...noExpect } = again.device; again.device = noExpect; await again.save('device.bin', again.device);
  await again.open();
  await assert.rejects(again.provision({ name: 'PC' }), { code: 'KEY_GONE' });
  await again.forget();
  assert.equal((await again.provision({ name: 'PC' })).role, 'read', 'a new device of the same customer');
});

test('GPT GB6: a write key that replaced another waits out the grace before the engine gets it', async (t) => {
  const h = await harness(t, { grace: 60000 });
  h.store.addInvite('pilot@example.com');
  const oldPc = await h.client('old'); await oldPc.provision({ name: '옛 PC' });
  const waits = [];
  const newPc = await h.client('new', {}, { sleep: async (ms) => { waits.push(ms); } });
  await newPc.provision({ name: '새 PC' });
  await newPc.takeWriteSeat();
  assert.ok(await newPc.writeCredentials());
  assert.deepEqual(waits, [60000]);
  // The first device's key is usable at once.
  const w0 = []; const fresh = await h.client('fresh', { sub: '1000002', email: 'other@example.com' }, { sleep: async (ms) => { w0.push(ms); } });
  h.store.addInvite('other@example.com');
  await fresh.provision({ name: 'PC' });
  assert.ok(await fresh.writeCredentials()); assert.deepEqual(w0, []);
});
