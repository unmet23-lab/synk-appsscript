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
  const client = async (name, claims, opts = {}) => { const c = new ProvisionClient({ dir: path.join(dir, name), secretStore, auth: auth(claims), call, now, mono: now, ...opts }); await c.open(); return c; };
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

// Stop points of a sign-up (Fable 설계 관문 11-16). `lose(url)` makes the server do the work
// and the answer vanish, as a dropped connection does.
const losing = (pc, match) => { const real = pc.call; let n = 0; pc.call = async (url, o) => { const r = await real(url, o); if (match(url) && n++ === 0) throw Object.assign(new Error('NETWORK'), { code: 'NETWORK' }); return r; }; return real; };

test('stop: the provision answer is lost — signing up again on the same PC replaces the unfinished device and takes the seat', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc');
  losing(pc, (u) => u.endsWith('/provision'));
  await assert.rejects(pc.provision({ name: 'PC' }), { code: 'NETWORK' });
  assert.equal(pc.device, null);
  const r = await pc.provision({ name: 'PC' });
  assert.equal(r.role, 'write', 'the ghost device from the lost answer does not hold the seat');
  assert.ok(r.readKey);
  assert.equal(h.store.all("select count(*) n from devices where state = 'abandoned'")[0].n, 1);
  assert.equal(h.store.liveKeys(r.customerId, 'write').length, 1);
});

test('stop: after the device file, before the acknowledgement — the next open finishes it; past ten minutes it starts over', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc');
  losing(pc, (u) => u.endsWith('keys/ack'));
  await assert.rejects(pc.provision({ name: 'PC' }), { code: 'NETWORK' });
  // Within ten minutes: a reopened app settles the keys and hands back the sign-up result.
  const again = new ProvisionClient({ dir: path.join(h.dir, 'pc'), secretStore, auth: pc.auth, call: pc.call, now: () => h.clock.t });
  await again.open();
  assert.ok(again.device.write.acked && again.device.read.acked);
  const r = await again.provision({ name: 'PC' });
  assert.equal(r.role, 'write'); assert.ok(r.readKey);
  await assert.rejects(again.provision({ name: 'PC' }), { code: 'ALREADY' });

  // Past ten minutes on another PC: the server dropped the device; this PC starts over.
  const pc2 = await h.client('pc2', { sub: '1000009', email: 'second@example.com' });
  h.store.addInvite('second@example.com');
  const net = () => Object.assign(new Error('NETWORK'), { code: 'NETWORK' });
  const real2 = pc2.call; pc2.call = async (u, o) => { if (u.endsWith('keys/ack')) throw net(); return real2(u, o); };
  await assert.rejects(pc2.provision({ name: 'PC' }), { code: 'NETWORK' });
  h.clock.advance(11 * 60000); await h.jobs.expireKeys();
  pc2.call = real2;
  const late = new ProvisionClient({ dir: path.join(h.dir, 'pc2'), secretStore, auth: pc2.auth, call: real2, now: () => h.clock.t });
  assert.equal((await late.open()).connected, false, 'the dropped device is forgotten here');
  assert.equal((await late.provision({ name: 'PC' })).role, 'write');
});

test('stop: a key the server no longer takes is dropped and named; the rest of the sign-up stands', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc');
  const real = pc.call;
  pc.call = async (u, o) => { if (u.endsWith('keys/ack')) return real(u, { ...o, body: { keyIds: o.body.keyIds.slice(0, 1) } }); return real(u, o); };
  const r = await pc.provision({ name: 'PC' });
  assert.equal(r.readKey, null);
  assert.deepEqual(pc.state().needs, ['read-key']);
  assert.ok(await pc.writeCredentials());
});

test('stop: a seat-move answer that never came is known on the next open', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const oldPc = await h.client('old'); await oldPc.provision({ name: '옛 PC' });
  const newPc = await h.client('new'); await newPc.provision({ name: '새 PC' });
  losing(newPc, (u) => u.endsWith('take-write-seat'));
  await assert.rejects(newPc.takeWriteSeat(), { code: 'NETWORK' });
  assert.deepEqual(newPc.state().needs, ['write-key']);
  const again = new ProvisionClient({ dir: path.join(h.dir, 'new'), secretStore, auth: newPc.auth, call: newPc.call });
  assert.deepEqual((await again.open()).needs, ['write-key']);
  await again.takeWriteSeat();
  assert.deepEqual(again.state().needs, []);
  assert.ok(await again.writeCredentials());
  // An answer lost after the request was written down but before it went out (the app died).
  await again.update({ inflight: { op: 'read-key-rotate', at: 1 } });
  const third = new ProvisionClient({ dir: path.join(h.dir, 'new'), secretStore, auth: newPc.auth, call: newPc.call });
  assert.deepEqual((await third.open()).needs, ['read-key']);
  // A half-written device file from an atomic() stop is cleaned away.
  fsSync.writeFileSync(path.join(h.dir, 'new', 'device.bin.dead.tmp'), 'x');
  await third.open();
  assert.equal(fsSync.existsSync(path.join(h.dir, 'new', 'device.bin.dead.tmp')), false);
});

test('GPT GB6: a write key that replaced another waits out the grace before the engine gets it', async (t) => {
  const h = await harness(t, { grace: 60000 });
  h.store.addInvite('pilot@example.com');
  const oldPc = await h.client('old'); await oldPc.provision({ name: '옛 PC' });
  const waits = [];
  const newPc = await h.client('new', {}, { sleep: async (ms) => { waits.push(ms); h.clock.advance(ms); } });
  await newPc.provision({ name: '새 PC' });
  await newPc.takeWriteSeat();
  assert.ok(await newPc.writeCredentials());
  assert.deepEqual(waits, [60000]);
  // The first device's key is usable at once.
  const w0 = []; const fresh = await h.client('fresh', { sub: '1000002', email: 'other@example.com' }, { sleep: async (ms) => { w0.push(ms); h.clock.advance(ms); } });
  h.store.addInvite('other@example.com');
  await fresh.provision({ name: 'PC' });
  assert.ok(await fresh.writeCredentials()); assert.deepEqual(w0, []);
});

test('GPT r4: files of the first version are imported — keys acknowledged again, the wait kept; an unfinished sign-up without its keys starts over', async (t) => {
  const h = await harness(t, { grace: 60000 });
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc'); await pc.provision({ name: 'PC' });
  const dir = path.join(h.dir, 'pc'), d = pc.device;
  const enc = async (name, v) => fs.writeFile(path.join(dir, name), await secretStore.encrypt(JSON.stringify(v)));
  // The first version's files: a finished device and a write key stored but never acknowledged.
  const fresh = await h.api.makeKey('write', h.store.customerById(d.customerId), d.deviceId, 'seat');
  const { v, write, read, signup, inflight, needs, jobId, ...old } = d;
  await enc('device.bin', { ...old, done: true });
  await enc('write-key.bin', { keyId: fresh.keyId, applicationKey: fresh.applicationKey, customerId: d.customerId, deviceId: d.deviceId, usableAt: h.clock.t + 30000 });
  const waits = [];
  const again = new ProvisionClient({ dir, secretStore, auth: pc.auth, call: pc.call, now: () => h.clock.t, mono: () => h.clock.t, sleep: async (ms) => { waits.push(ms); h.clock.advance(ms); } });
  await again.open();
  assert.equal(again.device.v, 2);
  assert.equal(h.store.key(fresh.name).state, 'active', 'the imported key was acknowledged');
  assert.equal((await again.writeCredentials()).keyId, fresh.keyId);
  assert.deepEqual(waits, [60000], 'a key of the first version waits the whole grace once (its usableAt is a wall-clock time)');
  assert.equal(fsSync.existsSync(path.join(dir, 'write-key.bin')), false);
  // An unfinished sign-up of that version with its keys missing is forgotten.
  await enc('device.bin', { ...old, done: false, expect: { write: true, read: true } });
  const third = new ProvisionClient({ dir, secretStore, auth: pc.auth, call: pc.call, now: () => h.clock.t });
  assert.equal((await third.open()).connected, false);
});

test('카본 A1 · A2 · A3 · A4: transport failures are NETWORK; a cut device is forgotten on any call; no device file from nothing; a lost report clears the local read key', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  // A3: a key request on a PC with no device writes nothing.
  const none = await h.client('none');
  await assert.rejects(none.takeWriteSeat(), { code: 'DEVICE_STATE' });
  assert.equal(fsSync.existsSync(path.join(h.dir, 'none', 'device.bin')), false);
  // A1: offline with unacknowledged keys — open() still opens; the keys settle later.
  const pc = await h.client('pc');
  const real = pc.call;
  pc.call = async (u, o) => { if (u.endsWith('keys/ack')) { const e = new Error('offline'); e.code = 'NETWORK'; throw e; } return real(u, o); };
  await assert.rejects(pc.provision({ name: 'PC' }), { code: 'NETWORK' });
  const offline = new ProvisionClient({ dir: path.join(h.dir, 'pc'), secretStore, auth: pc.auth, call: async () => { throw Object.assign(new Error('x'), { code: 'INVALID' }); } });
  assert.equal((await offline.open()).connected, true);
  const back = new ProvisionClient({ dir: path.join(h.dir, 'pc'), secretStore, auth: pc.auth, call: real });
  await back.open();
  assert.equal((await back.provision({ name: 'PC' })).role, 'write');
  // A1: an answer that is not our server's (a captive portal, a cut body) leaves "ask again".
  const b = await h.client('b'); await b.provision({ name: 'PC-B' });
  const breal = b.call;
  b.call = async (u, o) => { if (u.endsWith('take-write-seat')) { await breal(u, o); throw Object.assign(new Error('x'), { code: 'INVALID' }); } return breal(u, o); };
  await assert.rejects(b.takeWriteSeat(), { code: 'NETWORK' });
  assert.deepEqual(b.state().needs, ['write-key']);
  b.call = breal;
  // A4: the lost report of another device from this one clears this device's unconfirmed read key.
  await b.lost(back.device.deviceId);
  assert.equal(await b.pendingReadKey(), null);
  // A2: a device that was acknowledged and then cut is forgotten on its next ordinary call.
  await assert.rejects(back.status(), { code: 'DEVICE_GONE' });
  assert.equal(fsSync.existsSync(path.join(h.dir, 'pc', 'device.bin')), false);
  assert.equal((await back.provision({ name: 'PC' })).connected, true, 'and signs up again');
});

test('카본 A5: a key replaced during the wait is not handed out', async (t) => {
  const h = await harness(t, { grace: 60000 });
  h.store.addInvite('pilot@example.com');
  const oldPc = await h.client('old'); await oldPc.provision({ name: '옛 PC' });
  let swap = null;
  const waits = [];
  const newPc = await h.client('new', {}, { sleep: async (ms) => { waits.push(ms); h.clock.advance(ms); if (swap) { const f = swap; swap = null; await f(); } } });
  await newPc.provision({ name: '새 PC' });
  await newPc.takeWriteSeat();
  const first = newPc.device.write.keyId;
  // During the wait the seat is taken again (a second take-write-seat from this PC).
  swap = async () => { await newPc.takeWriteSeat(); };
  const got = await newPc.writeCredentials();
  assert.ok(got); assert.notEqual(got.keyId, first, 'the key handed out is the current one');
  assert.equal(got.keyId, newPc.device.write.keyId);
  assert.deepEqual(waits, [60000, 60000], 'the replacing key waited its own grace too (카본 r6 B7)');
});

test('조율 세션 부탁: a full account frees a seat with the sign-in only; state() keeps the Google step and the writer; a re-signed PC learns its earlier device', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const a = await h.client('a'); await a.provision({ name: 'PC-A' });
  const b = await h.client('b'); await b.provision({ name: 'PC-B' });
  const c = await h.client('c'); await c.provision({ name: 'PC-C' });
  // state() after reopening carries what the sign-up said.
  const reopened = new ProvisionClient({ dir: path.join(h.dir, 'b'), secretStore, auth: b.auth, call: b.call });
  const st = await reopened.open();
  assert.equal(st.writer.id, a.device.deviceId); assert.equal(st.googleStepRequired, false); assert.deepEqual(st.sameInstall, []);
  // A fourth PC is refused and lists the devices; it cuts a reading one with the sign-in only.
  const d = await h.client('d');
  const full = await d.provision({ name: 'PC-D' }).catch((e) => e);
  assert.equal(full.code, 'LIMIT_DEVICES');
  assert.equal(full.extra.devices.length, 3);
  await assert.rejects(d.revoke(a.device.deviceId), { code: 'DEVICE_STATE' }, 'not the active writer');
  const cOld = c.device.deviceId;
  assert.equal((await d.revoke(cOld)).ok, true);
  assert.equal((await d.provision({ name: 'PC-D' })).role, 'read');
  // The cut PC is forgotten on its next call; signing up again names its earlier device.
  await assert.rejects(c.status(), { code: 'DEVICE_GONE' });
  const old = c.installId;
  h.clock.advance(1000);
  await assert.rejects(c.provision({ name: 'PC-C' }), { code: 'LIMIT_DEVICES' });
  await d.revoke(b.device.deviceId);
  const again = await c.provision({ name: 'PC-C' });
  assert.equal(c.installId, old);
  assert.deepEqual(again.sameInstall, [cOld], 'the revoked device of this PC');
  assert.deepEqual(c.state().sameInstall, [cOld]);
  // After a loss the Google step shows in state() until the new read key is confirmed.
  await d.lost(a.device.deviceId);
  assert.equal(d.state().googleStepRequired, true);
  const rot = await d.rotateReadKey();
  assert.equal(d.state().googleStepRequired, true);
  await d.confirmReadKey(rot.readKey.keyId);
  assert.equal(d.state().googleStepRequired, false);
});

test('GPT 끝판 GA3: setting the PC clock forward does not shorten the wait; a restart waits again until it is marked done', async (t) => {
  const h = await harness(t, { grace: 60000 });
  h.store.addInvite('pilot@example.com');
  const oldPc = await h.client('old'); await oldPc.provision({ name: '옛 PC' });
  let skew = 0; const waits = [];
  const opts = { now: () => h.clock.t + skew, mono: () => h.clock.t, sleep: async (ms) => { waits.push(ms); h.clock.advance(ms); } };
  const pc = await h.client('new', {}, opts);
  await pc.provision({ name: '새 PC' });
  await pc.takeWriteSeat();
  skew = 120000; // the PC's clock is set two minutes ahead
  assert.ok(await pc.writeCredentials());
  assert.deepEqual(waits, [60000]);
  assert.equal(pc.device.write.waited, true);
  // Taken again, then the app restarts before using it: the new process waits the whole grace.
  await pc.takeWriteSeat();
  const restarted = new ProvisionClient({ dir: path.join(h.dir, 'new'), secretStore, auth: pc.auth, call: pc.call, ...opts });
  await restarted.open();
  h.clock.advance(30000);
  waits.length = 0;
  assert.ok(await restarted.writeCredentials());
  assert.deepEqual(waits, [60000]);
  // Marked waited, a further restart hands it out at once.
  const third = new ProvisionClient({ dir: path.join(h.dir, 'new'), secretStore, auth: pc.auth, call: pc.call, ...opts });
  await third.open(); waits.length = 0;
  assert.ok(await third.writeCredentials()); assert.deepEqual(waits, []);
});

test('조율 세션 덧붙임 2 · 11 · 13: state() says a read key waits for the envelope; a waiting Google sign-in can be stopped', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc');
  await pc.provision({ name: 'PC' });
  assert.equal(pc.state().readKeyPending, true);
  await pc.confirmReadKey(pc.device.read.keyId);
  assert.equal(pc.state().readKeyPending, false);
  let cancelled = 0;
  pc.auth.cancel = () => { cancelled++; };
  pc.cancelSignIn();
  assert.equal(cancelled, 1);
});

test('카본 r6 A1 · A4: a writer moved off its seat drops its unconfirmed read key and what it was to ask again; the new writer names itself', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const a = await h.client('a'); await a.provision({ name: 'PC-A' });
  assert.equal(a.state().readKeyPending, true);
  const unconfirmed = a.device.read.keyId;
  const b = await h.client('b'); await b.provision({ name: 'PC-B' });
  assert.equal(b.state().writer.id, a.device.deviceId);
  await b.takeWriteSeat();
  assert.deepEqual(b.state().writer, { id: b.device.deviceId, name: 'PC-B' });
  await assert.rejects(a.confirmReadKey(unconfirmed), { code: 'DEVICE_STATE' });
  const st = a.state();
  assert.equal(st.role, 'read'); assert.equal(st.readKeyPending, false); assert.deepEqual(st.needs, []); assert.equal(st.writer, null);
  assert.equal(await a.pendingReadKey(), null);
  assert.equal(await a.writeCredentials(), null);
});

test('카본 r6 A2 · A3: cutting this very device forgets it here; a moved device cuts others with the sign-in only; a lost answer of a loss report clears the local read key', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const a = await h.client('a'); await a.provision({ name: 'PC-A' });
  const b = await h.client('b'); await b.provision({ name: 'PC-B' });
  const c = await h.client('c'); await c.provision({ name: 'PC-C' });
  await b.takeWriteSeat(); // a is moved now
  await assert.rejects(a.confirmReadKey(a.device.read.keyId), { code: 'DEVICE_STATE' });
  assert.equal((await a.revoke(c.device.deviceId)).ok, true, 'a moved device cuts a reading one with the sign-in only');
  assert.equal(h.store.device(c.device.deviceId).state, 'revoked');
  // b cuts itself: its device is forgotten here at once.
  await b.revoke(b.device.deviceId);
  assert.equal(b.state().connected, false);
  assert.equal(await b.writeCredentials(), null);
  // A loss report whose answer is lost: this device acts as if it happened.
  const d = await h.client('d'); await d.provision({ name: 'PC-D' });
  const real = d.call;
  d.call = async (u, o) => { const r = await real(u, o); if (u.endsWith('/lost')) throw Object.assign(new Error('cut'), { code: 'ETIMEDOUT' }); return r; };
  await assert.rejects(d.lost(a.device.deviceId), { code: 'NETWORK' });
  assert.equal(d.state().googleStepRequired, true);
  assert.ok(d.state().needs.includes('read-key'));
  assert.equal(d.device.read, null);
});

test('카본 r6 A6: an empty or malformed server nonce stops before the browser opens', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc');
  const real = pc.call;
  pc.call = async (u, o) => (u.endsWith('/nonce') ? { status: 200, data: { ok: true, nonce: '' } } : real(u, o));
  await assert.rejects(pc.provision({ name: 'PC' }), { code: 'SERVER' });
  assert.equal(pc.auth.calls.length, 0);
});

test('조율 세션 부탁 2: readKeyAlive() tells a read key another PC\'s rotation replaced, before it goes into the envelope', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const a = await h.client('a'); await a.provision({ name: 'PC-A' });
  await a.confirmReadKey(a.device.read.keyId);
  const b = await h.client('b'); await b.provision({ name: 'PC-B' });
  await b.rotateReadKey();
  assert.equal(await b.readKeyAlive(), true);
  await a.rotateReadKey(); // b's unconfirmed key is deleted on the server
  assert.equal(await b.readKeyAlive(), false);
  assert.equal(await b.pendingReadKey(), null);
  assert.ok(b.state().needs.includes('read-key'));
  assert.equal(await a.readKeyAlive(), true);
});

test('GPT r7 GA1 · GA2: a seat request whose answer was lost hands out no deleted key; a loss report of this device whose answer was lost forgets it', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const a = await h.client('a'); await a.provision({ name: 'PC-A' });
  assert.ok(await a.writeCredentials());
  const real = a.call;
  a.call = async (u, o) => { const r = await real(u, o); if (u.endsWith('take-write-seat')) throw Object.assign(new Error('cut'), { code: 'ETIMEDOUT' }); return r; };
  await assert.rejects(a.takeWriteSeat(), { code: 'NETWORK' });
  a.call = real;
  assert.equal(await a.writeCredentials(), null, 'the old key was deleted on the server');
  assert.ok(a.state().needs.includes('write-key'));
  const reopened = new ProvisionClient({ dir: path.join(h.dir, 'a'), secretStore, auth: a.auth, call: real, now: () => h.clock.t, mono: () => h.clock.t });
  await reopened.open();
  assert.equal(await reopened.writeCredentials(), null);
  await reopened.takeWriteSeat();
  assert.ok(await reopened.writeCredentials());
  // This device reported lost, the answer lost on the way: forgotten here.
  reopened.call = async (u, o) => { const r = await real(u, o); if (u.endsWith('/lost')) throw Object.assign(new Error('cut'), { code: 'ETIMEDOUT' }); return r; };
  await assert.rejects(reopened.lost(reopened.device.deviceId), { code: 'NETWORK' });
  assert.equal(reopened.state().connected, false);
  assert.equal(await reopened.writeCredentials(), null);
});

test('설계 관문 셋째 라 · 8: every request × outcome hands out no key the server deleted, names what to ask again, and forgets this device when it may be cut', async (t) => {
  const ops = {
    'take-write-seat': { route: 'devices/take-write-seat', run: (c) => c.takeWriteSeat() },
    'restore-run': { route: 'restore/run', run: (c, h) => c.restoreRun(h.clock.t - 30000) },
    'read-key-rotate': { route: 'read-key/rotate', run: (c) => c.rotateReadKey() },
    'revoke-self': { route: 'devices/revoke', self: true, run: (c) => c.revoke(c.device.deviceId) },
    'lost-self': { route: '/lost', self: true, run: (c) => c.lost(c.device.deviceId) },
  };
  for (const [op, { route, run, self }] of Object.entries(ops)) for (const outcome of ['ok', 'lost-answer', 'gone', 'moved']) {
    const label = `${op} × ${outcome}`;
    const h = await harness(t);
    h.store.addInvite('pilot@example.com');
    const a = await h.client('a'); const p = await a.provision({ name: 'PC-A' });
    await a.confirmReadKey(p.readKey.keyId);
    await a.rotateReadKey(); // an unconfirmed read key held too: the one the server replaces first
    const b = await h.client('b'); await b.provision({ name: 'PC-B' }); await b.status();
    const base = p.repository.prefix + '/';
    h.b2.upload(base + 'config', 'c'); h.b2.upload(base + 'snapshots/s1', 's1'); h.clock.advance(60000);
    if (outcome === 'gone') await b.revoke(a.device.deviceId);
    if (outcome === 'moved') await b.takeWriteSeat();
    if (outcome === 'lost-answer') { const real = a.call; a.call = async (u, o) => { const r = await real(u, o); if (u.endsWith(route)) throw Object.assign(new Error('cut'), { code: 'ETIMEDOUT' }); return r; }; }
    const before = { w: a.device.write?.keyId, r: a.device.read?.keyId };
    if (outcome === 'ok') await run(a, h); else await run(a, h).catch(() => {});
    if (outcome === 'ok' && (op === 'take-write-seat' || op === 'restore-run')) assert.notEqual(a.device.write.keyId, before.w, `${label}: a new write key`);
    if (outcome === 'ok' && op === 'read-key-rotate') assert.notEqual(a.device.read.keyId, before.r, `${label}: a new read key`);
    const live = (id, states) => h.b2.keys.has(id) && states.includes(h.store.keyById(id)?.state);
    const w = await a.writeCredentials().catch(() => null);
    if (w) assert.ok(live(w.keyId, ['active']), `${label}: the write key handed out is live on the server and B2`);
    if (a.device?.read?.acked) assert.ok(live(a.device.read.keyId, ['active', 'acked', 'pending']), `${label}: the read key held is live`);
    const pending = await a.pendingReadKey().catch(() => null);
    if (pending) assert.ok(live(pending.keyId, ['acked', 'pending']), `${label}: the unconfirmed read key is live`);
    if (self && outcome !== 'moved') assert.equal(a.state().connected, false, `${label}: this device is forgotten`);
    if (outcome === 'lost-answer' && !self) assert.ok(a.state().needs.length > 0, `${label}: what to ask again is named`);
  }
});

// ── r8a 검수(11-16 밤)
const stopsAfter = (c, route) => { const real = c.call; c.call = async (u, o) => { const r = await real(u, o); if (u.endsWith(route)) return new Promise(() => {}); return r; }; return real; };

test('GPT r8a GA1: a cut or loss report the server took, the app stopped before storing its answer: the next open forgets this device, or the read key for another', async (t) => {
  for (const [label, run, route] of [['revoke self', (c) => c.revoke(c.device.deviceId), 'devices/revoke'], ['lost self', (c) => c.lost(c.device.deviceId), '/lost']]) {
    const h = await harness(t);
    h.store.addInvite('pilot@example.com');
    const a = await h.client('a'); const p = await a.provision({ name: 'PC-A' }); await a.confirmReadKey(p.readKey.keyId);
    const real = stopsAfter(a, route);
    void run(a); await new Promise((ok) => setTimeout(ok, 300)); // the process is gone before the answer is stored
    assert.ok(h.store.device(a.device.deviceId).state !== 'active', `${label}: the server did it`);
    const again = new ProvisionClient({ dir: path.join(h.dir, 'a'), secretStore, auth: a.auth, call: real, now: () => h.clock.t, mono: () => h.clock.t });
    await again.open();
    assert.equal(again.state().connected, false, `${label}: forgotten on the next open`);
    assert.equal(await again.writeCredentials(), null);
  }
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const a = await h.client('a'); const p = await a.provision({ name: 'PC-A' }); await a.confirmReadKey(p.readKey.keyId);
  const b = await h.client('b'); await b.provision({ name: 'PC-B' });
  const real = stopsAfter(a, '/lost');
  void a.lost(b.device.deviceId); await new Promise((ok) => setTimeout(ok, 300));
  const again = new ProvisionClient({ dir: path.join(h.dir, 'a'), secretStore, auth: a.auth, call: real, now: () => h.clock.t, mono: () => h.clock.t });
  await again.open();
  assert.equal(again.device.read, null, 'the account read keys were deleted by the report');
  assert.ok(again.state().needs.includes('read-key'));
  assert.equal(again.state().googleStepRequired, true);
});

test('카본 r8a A1 · A3: status tells a device whose seat was taken — it hands out no deleted key and cuts with one sign-in', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const a = await h.client('a'); const p = await a.provision({ name: 'PC-A' }); await a.confirmReadKey(p.readKey.keyId);
  const b = await h.client('b'); await b.provision({ name: 'PC-B' }); await b.status();
  await b.takeWriteSeat();
  const st = await a.status();
  assert.equal(st.device.state, 'moved');
  assert.equal(await a.writeCredentials(), null, 'the deleted write key is not handed out');
  assert.equal(a.state().role, 'read');
  const signIns = a.auth.calls.length;
  await a.revoke(a.device.deviceId);
  assert.equal(a.auth.calls.length - signIns, 1, 'one Google sign-in, not a refused one first');
  assert.equal(a.state().connected, false);
  // A loss report from another PC deletes the confirmed read key: status tells this PC too.
  const h2 = await harness(t);
  h2.store.addInvite('pilot@example.com');
  const c = await h2.client('c'); const pc2 = await c.provision({ name: 'PC-C' }); await c.confirmReadKey(pc2.readKey.keyId);
  const d = await h2.client('d'); await d.provision({ name: 'PC-D' }); await d.status();
  const x = await h2.client('x'); await x.provision({ name: 'PC-X' });
  await d.lost(x.device.deviceId);
  await c.status();
  assert.equal(c.device.read, null, 'the deleted confirmed read key is dropped here');
  assert.ok(c.state().needs.includes('read-key'));
});

test('카본 r8a A2: a restore whose answer was lost names the keys it needs, and its choice clears the restore', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const pc = await h.client('pc'); const p = await pc.provision({ name: 'PC' }); await pc.confirmReadKey(p.readKey.keyId);
  const base = p.repository.prefix + '/';
  h.b2.upload(base + 'config', 'c'); h.b2.upload(base + 'snapshots/s1', 's1');
  h.clock.advance(3600000); const at = h.clock.t - 1;
  h.b2.hide(base + 'snapshots/s1'); h.clock.advance(60000);
  const real = pc.call;
  pc.call = async (u, o) => { const r = await real(u, o); if (u.endsWith('restore/run')) throw Object.assign(new Error('cut'), { code: 'ETIMEDOUT' }); return r; };
  await assert.rejects(pc.restoreRun(at), { code: 'NETWORK' });
  pc.call = real;
  assert.deepEqual([...pc.state().needs].sort(), ['read-key', 'restore', 'write-key']);
  const job = h.store.lastJob(h.store.device(pc.device.deviceId).customer_id);
  await h.api.runJob(h.store.job(job.id));
  await pc.restoreChoose(job.id, 'continue');
  assert.deepEqual([...pc.state().needs].sort(), ['read-key', 'write-key'], 'the restore is settled; the keys are still to get');
  await pc.takeWriteSeat();
  assert.ok(await pc.writeCredentials());
  assert.ok(!pc.state().needs.includes('write-key'));
});

test('카본 r9 A2 · A3: a moved device that took its seat back with the answer lost is not "moved" any more; a revoke without a device stays a refusal', async (t) => {
  const h = await harness(t);
  h.store.addInvite('pilot@example.com');
  const a = await h.client('a'); const p = await a.provision({ name: 'PC-A' }); await a.confirmReadKey(p.readKey.keyId);
  const b = await h.client('b'); await b.provision({ name: 'PC-B' }); await b.status();
  await b.takeWriteSeat();
  await a.status();
  assert.equal(a.state().role, 'read');
  const real = a.call;
  a.call = async (u, o) => { const r = await real(u, o); if (u.endsWith('take-write-seat')) throw Object.assign(new Error('cut'), { code: 'ETIMEDOUT' }); return r; };
  await assert.rejects(a.takeWriteSeat(), { code: 'NETWORK' });
  a.call = real;
  await a.status();
  assert.equal(a.state().role, 'write', 'as the server has it');
  // The writer cuts itself with its token: one sign-in, and it goes through.
  const signIns = a.auth.calls.length;
  await a.revoke(a.device.deviceId);
  assert.equal(a.auth.calls.length - signIns, 1);
  assert.equal(h.store.device(p.deviceId).state, 'revoked');
  // No device here and no id: the server's refusal, not a TypeError.
  const c = await h.client('c');
  await assert.rejects(c.revoke(undefined), (e) => e.code === 'BAD_INPUT' || e.code === 'NOT_FOUND');
});
