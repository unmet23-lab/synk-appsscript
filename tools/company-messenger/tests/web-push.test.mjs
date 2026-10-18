import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ECDH, createECDH, createHash, createPublicKey, verify } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createWebPushService, createPayloadlessPushSender, createVapidAuthorization, generateVapidKeys, isPublicPushAddress, validatePushEndpoint } from '../web-push-service.mjs';
import { createCollaborationService } from '../collaboration-service.mjs';

const endpoint = number => `https://fcm.googleapis.com/fcm/send/offline-test-${number}`;
const status = expected => error => error.status === expected;
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-web-push-'));
  const keys = generateVapidKeys(), sessions = new Set(['u1:s1', 'u1:s2', 'u2:s3']);
  let stamp = '2026-10-08T01:00:00.000Z', db, service;
  const sources = new Map([['u1', []], ['u2', []]]), sent = [];
  const open = () => {
    db = new DatabaseSync(join(directory, 'fixture.sqlite')); db.exec('PRAGMA foreign_keys=ON');
    service = createWebPushService({ db, enabled: true, ...keys, subject: 'mailto:workspace@example.test', now: () => stamp,
      notificationsForUser: async id => options.notifications ? options.notifications(id, sources) : sources.get(id) || [],
      currentSession: async (id, hash) => sessions.has(`${id}:${hash}`),
      send: async request => { assert.equal(db.isTransaction, false); sent.push(request); return options.send ? options.send(request, sent) : { statusCode: 201 }; }, ...options.service,
    });
  };
  open();
  t.after(async () => { await service.stop(); db.close(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.split(sep).at(-1).startsWith('synk-web-push-')); await rm(directory, { recursive: true, force: true }); });
  return {
    get service() { return service; }, get db() { return db; }, get time() { return stamp; }, sources, sessions, sent, keys,
    setTime: value => { stamp = value; }, advance: milliseconds => { stamp = new Date(Date.parse(stamp) + milliseconds).toISOString(); },
    add(id, userId = 'u1', extra = {}) { const row = { id, kind: 'mention', createdAt: stamp, readAt: null, ...extra }; sources.get(userId).push(row); return row; },
    register: (number = 1, userId = 'u1', sessionHash = 's1') => service.register(userId, sessionHash, { subscription: { endpoint: endpoint(number) }, label: '시험 기기' }),
    async restart() { await service.stop(); db.close(); open(); },
  };
}

test('VAPID uses a valid ES256 P1363 signature, correct audience and a bounded expiry', () => {
  const keys = generateVapidKeys(), at = '2026-10-08T01:00:00.000Z';
  const value = createVapidAuthorization({ endpoint: endpoint(1), ...keys, subject: 'mailto:workspace@example.test', now: at });
  const token = /^vapid t=([^,]+), k=(.+)$/.exec(value);
  assert.equal(token[2], keys.publicKey);
  const [header, claims, signature] = token[1].split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { typ: 'JWT', alg: 'ES256' });
  const payload = JSON.parse(Buffer.from(claims, 'base64url'));
  assert.equal(payload.aud, 'https://fcm.googleapis.com');
  assert.equal(payload.sub, 'mailto:workspace@example.test');
  assert.equal(payload.exp - Date.parse(at) / 1000, 43200);
  const point = Buffer.from(keys.publicKey, 'base64url');
  const publicObject = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') } });
  assert.equal(Buffer.from(signature, 'base64url').length, 64);
  assert.ok(verify('sha256', Buffer.from(`${header}.${claims}`), { key: publicObject, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
  const other = createECDH('prime256v1'); other.generateKeys();
  assert.throws(() => createVapidAuthorization({ endpoint: endpoint(1), ...keys, privateKey: other.getPrivateKey().toString('base64url'), subject: 'mailto:workspace@example.test', now: at }), status(503));
});

test('short-lived call sources bound queue/provider TTL and cancellation during dispatch fails authorization', async t => {
  const f = await fixture(t, { send: async request => {
    assert.ok(request.ttl <= 45);
    f.sources.set('u1', []); // Cancelled after discovery, before the HTTP send.
    assert.equal(await request.authorize(), false);
    return { statusCode: 0 };
  } });
  await f.register(); f.advance(1);
  const expiresAt = new Date(Date.parse(f.time) + 45000).toISOString();
  f.add('voice:fixture', 'u1', { kind: 'voice_invitation', expiresAt });
  await f.service.tick(); assert.equal(f.sent.length, 1);
  assert.equal(f.db.prepare('SELECT expires_at FROM web_push_queue WHERE notification_id=?').get('voice:fixture').expires_at, expiresAt);
  await f.service.tick();
  assert.equal(f.db.prepare('SELECT state FROM web_push_queue WHERE notification_id=?').get('voice:fixture').state, 'skipped');
  f.add('voice:expired', 'u1', { kind: 'voice_invitation', expiresAt }); f.advance(45001); await f.service.tick();
  assert.equal(f.sent.length, 1);
});

test('generated VAPID private scalars retain their required 32-byte width when leading zeros are omitted by crypto', t => {
  t.mock.method(ECDH.prototype, 'generateKeys', function() { this.setPrivateKey(Buffer.from([1])); return this.getPublicKey(); });
  const keys = generateVapidKeys();
  assert.equal(Buffer.from(keys.privateKey, 'base64url').length, 32);
  assert.equal(keys.privateKey.length, 43);
  assert.doesNotThrow(() => createVapidAuthorization({ endpoint: endpoint(1), ...keys, subject: 'mailto:workspace@example.test', now: '2026-10-08T01:00:00.000Z' }));
});

test('endpoint allowlist rejects SSRF destinations and misleading vendor names', () => {
  for (const url of [endpoint(1), 'https://web.push.apple.com/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://wns2-by3p.notify.windows.com/w/?token=abc']) assert.equal(validatePushEndpoint(url), url);
  for (const url of ['http://fcm.googleapis.com/a', 'https://127.0.0.1/a', 'https://fcm.googleapis.com.evil.test/a', 'https://evilpush.apple.com/a', 'https://web.push.apple.com.evil.test/a', 'https://user@fcm.googleapis.com/a', 'https://fcm.googleapis.com:8443/a', 'https://fcm.googleapis.com/a#secret', 'https://fcm.googleapis.com\\@127.0.0.1/a']) assert.throws(() => validatePushEndpoint(url), status(400));
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.1.2', '192.168.1.2', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fc00::1', '2001:db8::1', '2002:7f00:1::1']) assert.equal(isPublicPushAddress(address), false, address);
  for (const address of ['142.250.1.1', '17.1.2.3', '2607:f8b0:4005:805::200e']) assert.equal(isPublicPushAddress(address), true, address);
});

test('Chromium staging compatibility accepts only its exact Google host and nonempty FCM send route', () => {
  for (const url of ['https://jmt17.google.com/fcm/send/offline-test', 'https://jmt17.google.com/fcm/send/opaque-token?version=1']) assert.equal(validatePushEndpoint(url), url);
  for (const url of [
    'https://jmt17.google.com/', 'https://jmt17.google.com/fcm/send/', 'https://jmt17.google.com/fcm/send',
    'https://jmt17.google.com/other/token', 'https://jmt17.google.com/fcm/send/token/extra',
    'https://jmt17.google.com/fcm/send/../token', 'https://jmt17.google.com/fcm/send/%2e%2e/token',
    'https://jmt17.google.com.evil.test/fcm/send/token', 'https://sub.jmt17.google.com/fcm/send/token',
    'https://jmt18.google.com/fcm/send/token', 'https://google.com/fcm/send/token',
    'http://jmt17.google.com/fcm/send/token', 'https://user@jmt17.google.com/fcm/send/token',
    'https://jmt17.google.com:8443/fcm/send/token', 'https://jmt17.google.com/fcm/send/token#fragment',
  ]) assert.throws(() => validatePushEndpoint(url), status(400), url);
});

test('sender pins public DNS, sends no payload, does not follow redirects and checks permission after DNS', async () => {
  const keys = generateVapidKeys(), calls = [];
  const sender = createPayloadlessPushSender({ lookup: async () => [{ address: '142.250.1.1', family: 4 }], request(url, options, callback) {
    calls.push({ url, options }); const req = new EventEmitter();
    req.end = (...args) => { assert.deepEqual(args, []); callback({ statusCode: 302, headers: { location: 'https://127.0.0.1/secret' }, destroy() {} }); };
    return req;
  } });
  const result = await sender({ endpoint: endpoint(1), ...keys, subject: 'mailto:workspace@example.test', ttl: 3600, now: '2026-10-08T01:00:00Z' });
  assert.equal(result.statusCode, 302); assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers['Content-Length'], '0');
  assert.equal(calls[0].options.headers['Content-Encoding'], undefined);
  assert.equal(calls[0].options.headers.TTL, '3600');
  calls[0].options.lookup('ignored', { all: true }, (error, addresses) => { assert.equal(error, null); assert.deepEqual(addresses, [{ address: '142.250.1.1', family: 4 }]); });
  await assert.rejects(() => sender({ endpoint: endpoint(1), ...keys, subject: 'mailto:workspace@example.test', ttl: 100, authorize: () => false }), status(401));
  assert.equal(calls.length, 1);
  await assert.rejects(() => sender({ endpoint: endpoint(1), ...keys, subject: 'mailto:workspace@example.test', ttl: 100, authorize: () => { throw Object.assign(new Error('synthetic verification unavailable'), { status: 503, code: 'PUSH_IDENTITY_UNAVAILABLE' }); } }), error => error.status === 503 && error.code === 'PUSH_IDENTITY_UNAVAILABLE');
  assert.equal(calls.length, 1, 'identity uncertainty after DNS must never begin a provider HTTP request');
  const privateDns = createPayloadlessPushSender({ lookup: async () => [{ address: '127.0.0.1', family: 4 }], request() { assert.fail('private destination contacted'); } });
  await assert.rejects(() => privateDns({ endpoint: endpoint(1), ...keys, subject: 'mailto:workspace@example.test', ttl: 100 }), status(400));
});

test('Chromium staging sender keeps public DNS pinning, zero payload and redirect rejection', async () => {
  const endpoint = 'https://jmt17.google.com/fcm/send/offline-test', keys = generateVapidKeys(), calls = [];
  const sender = createPayloadlessPushSender({ lookup: async host => {
    assert.equal(host, 'jmt17.google.com'); return [{ address: '142.250.1.1', family: 4 }];
  }, request(url, options, callback) {
    calls.push({ url, options }); const req = new EventEmitter();
    req.end = (...args) => { assert.deepEqual(args, []); callback({ statusCode: 302, headers: { location: 'https://127.0.0.1/secret' }, destroy() {} }); };
    return req;
  } });
  const result = await sender({ endpoint, ...keys, subject: 'mailto:workspace@example.test', ttl: 100 });
  assert.equal(result.statusCode, 302); assert.equal(calls.length, 1);
  assert.equal(calls[0].url.href, endpoint); assert.equal(calls[0].options.headers['Content-Length'], '0');
  const token = /^vapid t=([^,]+)/.exec(calls[0].options.headers.Authorization)[1];
  assert.equal(JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).aud, 'https://jmt17.google.com');
  calls[0].options.lookup('jmt17.google.com', { all: true }, (error, addresses) => { assert.equal(error, null); assert.deepEqual(addresses, [{ address: '142.250.1.1', family: 4 }]); });
  const privateDns = createPayloadlessPushSender({ lookup: async () => [{ address: '127.0.0.1', family: 4 }], request() { assert.fail('private staging destination contacted'); } });
  await assert.rejects(() => privateDns({ endpoint, ...keys, subject: 'mailto:workspace@example.test', ttl: 100 }), status(400));
});

test('device notifications default off, opt-in establishes an exact baseline and combines new sources', async t => {
  const disabled = await fixture(t, { service: { enabled: false } });
  assert.deepEqual(await disabled.service.state('u1', 's1'), { configured: false, publicKey: null, subscriptions: [], defaultEnabled: false });
  await assert.rejects(() => disabled.register(), status(503)); await disabled.service.tick(); assert.equal(disabled.sent.length, 0);
  const f = await fixture(t); f.add('old-same-millisecond');
  const registration = await f.register();
  const meta = registration.subscription;
  assert.equal(meta.endpointHash, createHash('sha256').update(endpoint(1)).digest('hex'));
  assert.equal(meta.enabled, true); assert.equal(meta.currentSession, true);
  assert.equal(JSON.stringify(meta).includes('https://'), false);
  assert.equal(JSON.stringify(meta).includes('privateKey'), false);
  f.add('new-same-millisecond'); f.add('due:day', 'u1', { kind: 'due_digest' }); f.add('client:work', 'u1', { kind: 'client_workflow' });
  await f.service.tick(); await f.service.tick();
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].ttl, 3600);
  assert.equal(f.sent[0].body, undefined); assert.equal(f.sent[0].payload, undefined);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM web_push_queue WHERE state='accepted'").get().n, 3);
  assert.equal(f.db.prepare("SELECT state FROM web_push_queue WHERE notification_id='old-same-millisecond'").get().state, 'baseline');
  assert.equal((await f.service.state('u1', 's1')).subscriptions[0].lastAcceptedAt, f.time);
  assert.deepEqual((await f.service.state('u2', 's3')).subscriptions, []);
});

test('restart preserves successful dedupe and retry backoff; HTTP 410 clears only that subscription', async t => {
  let code = 429;
  const f = await fixture(t, { send: async () => ({ statusCode: code, retryAfter: '120' }) });
  await f.register(); f.advance(1); f.add('one'); await f.service.tick();
  assert.equal(f.sent.length, 1); await f.restart(); await f.service.tick(); assert.equal(f.sent.length, 1);
  f.advance(119999); await f.service.tick(); assert.equal(f.sent.length, 1);
  f.advance(1); code = 201; await f.service.tick(); assert.equal(f.sent.length, 2);
  await f.restart(); await f.service.tick(); assert.equal(f.sent.length, 2);
  f.advance(1); f.add('two'); code = 410; await f.service.tick();
  assert.equal((await f.service.state('u1', 's1')).subscriptions[0].enabled, false);
  assert.equal(f.db.prepare('SELECT endpoint FROM web_push_subscriptions').get().endpoint, null);
  f.add('three'); await f.service.tick(); assert.equal(f.sent.length, 3);
});

test('current unread and access checks cancel queued sources; TTL never replays stale unread', async t => {
  let code = 503;
  const f = await fixture(t, { send: async request => { assert.equal(await request.authorize(), true); return { statusCode: code }; } });
  await f.register(); f.advance(1); const source = f.add('private-source'); await f.service.tick();
  source.readAt = f.time; f.advance(15000); await f.service.tick(); assert.equal(f.sent.length, 1);
  assert.equal(f.db.prepare("SELECT state FROM web_push_queue WHERE notification_id='private-source'").get().state, 'skipped');
  f.add('removed-source'); await f.service.tick(); assert.equal(f.sent.length, 2);
  f.sources.set('u1', []); f.advance(15000); await f.service.tick(); assert.equal(f.sent.length, 2);
  const stale = f.add('expired-source'); stale.createdAt = new Date(Date.parse(f.time) - 3600001).toISOString();
  code = 201; await f.service.tick(); assert.equal(f.sent.length, 2);
  f.add('retry-expires'); code = 503; await f.service.tick(); assert.equal(f.sent.length, 3);
  f.advance(3600001); await f.service.tick(); assert.equal(f.sent.length, 3);
});

test('logout, inactive sessions and explicit deletion prevent sends and ownership stays private', async t => {
  const f = await fixture(t); const { subscription: a } = await f.register(1); const { subscription: b } = await f.register(2, 'u1', 's2');
  await assert.rejects(() => f.service.remove('u2', a.id), status(404));
  f.sessions.delete('u1:s1'); f.add('after-logout'); await f.service.tick();
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].endpoint, endpoint(2));
  assert.equal((await f.service.state('u1', 's2')).subscriptions.find(row => row.id === a.id).enabled, false);
  await f.service.revokeSession('s2'); f.advance(1); f.add('revoked'); await f.service.tick(); assert.equal(f.sent.length, 1);
  await f.service.remove('u1', b.id); assert.equal(f.db.prepare('SELECT count(*) AS n FROM web_push_queue WHERE subscription_id=?').get(b.id).n, 0);
  await assert.rejects(() => f.register(3, 'u1', 's1'), status(401));
});

for (const unavailable of ['null', 'throw']) test(`identity ${unavailable} preserves consent and queues, rejects ambiguous state and registration, and resumes the same subscription`, async t => {
  let mode = 'valid';
  const f = await fixture(t, { service: { currentSession: async () => {
    if (mode === 'throw') throw Object.assign(new Error('synthetic identity outage'), { retryable: true, status: 503 });
    return mode === 'null' ? null : true;
  } } });
  f.add('existing-baseline'); const registered = await f.register(); f.advance(1); f.add('new-after-consent');
  const before = f.db.prepare('SELECT * FROM web_push_subscriptions').get(), queueBefore = f.db.prepare('SELECT * FROM web_push_queue').all();
  mode = unavailable; await f.service.tick();
  assert.deepEqual(f.db.prepare('SELECT * FROM web_push_subscriptions').get(), before);
  assert.deepEqual(f.db.prepare('SELECT * FROM web_push_queue').all(), queueBefore);
  assert.equal(f.sent.length, 0);
  await assert.rejects(() => f.service.state('u1', 's1'), status(503));
  await assert.rejects(() => f.register(2), status(503));
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM web_push_subscriptions').get().n, 1);
  mode = 'valid'; await f.service.tick();
  assert.equal(f.sent.length, 1);
  assert.equal((await f.service.state('u1', 's1')).subscriptions[0].id, registered.subscription.id);
  assert.equal(f.db.prepare("SELECT state FROM web_push_queue WHERE notification_id='existing-baseline'").get().state, 'baseline');
  assert.equal(f.db.prepare("SELECT state FROM web_push_queue WHERE notification_id='new-after-consent'").get().state, 'accepted');
});

for (const stage of [1, 2, 3]) test(`identity outage at delivery check ${stage} never sends or loses the source and recovery uses the original subscription`, async t => {
  let calls = 0, failAt = 0; const delivered = [];
  const f = await fixture(t, { service: { currentSession: async () => {
    if (++calls === failAt) throw Object.assign(new Error('synthetic verification failure'), { retryable: true, status: 503 });
    return true;
  } }, send: async request => { if (!await request.authorize()) return { statusCode: 401 }; delivered.push(request.endpoint); return { statusCode: 201 }; } });
  const registered = await f.register(); f.advance(1); f.add('pending-work'); calls = 0; failAt = stage;
  await f.service.tick();
  const subscription = f.db.prepare('SELECT * FROM web_push_subscriptions').get();
  assert.equal(subscription.id, registered.subscription.id); assert.equal(subscription.enabled, 1); assert.equal(subscription.endpoint, endpoint(1));
  assert.equal(delivered.length, 0);
  const queue = f.db.prepare('SELECT * FROM web_push_queue').get();
  if (queue) assert.equal(queue.state, 'pending');
  failAt = 0; f.advance(15000); await f.service.tick();
  assert.equal(delivered.length, 1); assert.equal(f.db.prepare('SELECT state FROM web_push_queue').get().state, 'accepted');
});

for (const stage of [1, 2]) test(`registration identity check ${stage} becoming unknown cannot replace existing consent`, async t => {
  let calls = 0, unknownAt = 0;
  const f = await fixture(t, { service: { currentSession: async () => ++calls === unknownAt ? null : true } });
  f.add('baseline'); await f.register();
  const before = f.db.prepare('SELECT * FROM web_push_subscriptions').all(), queue = f.db.prepare('SELECT * FROM web_push_queue').all();
  calls = 0; unknownAt = stage;
  await assert.rejects(() => f.register(1, 'u1', 's2'), status(503));
  assert.deepEqual(f.db.prepare('SELECT * FROM web_push_subscriptions').all(), before);
  assert.deepEqual(f.db.prepare('SELECT * FROM web_push_queue').all(), queue);
});

test('repeated pre-send identity outages preserve the provider retry budget and original expiry', async t => {
  let calls = 0, unavailable = false; const delivered = [];
  const f = await fixture(t, { service: { currentSession: async () => ++calls % 3 === 0 && unavailable ? null : true }, send: async request => {
    if (!await request.authorize()) return { statusCode: 401 }; delivered.push(request.endpoint); return { statusCode: 201 };
  } });
  await f.register(); f.advance(1); f.add('retry-identity'); const expires = new Date(Date.parse(f.time) + 3600000).toISOString();
  unavailable = true;
  for (let i = 0; i < 8; i++) {
    calls = 0; await f.service.tick();
    const queued = f.db.prepare('SELECT * FROM web_push_queue').get();
    assert.equal(queued.state, 'pending'); assert.equal(queued.attempts, 0); assert.equal(queued.expires_at, expires);
    assert.equal(delivered.length, 0); f.advance(15000);
  }
  unavailable = false; calls = 0; await f.service.tick(); assert.equal(delivered.length, 1);
  assert.equal(f.db.prepare('SELECT attempts FROM web_push_queue').get().attempts, 1);
});

for (const stage of [1, 2, 3]) test(`explicit invalid identity at delivery check ${stage} still disables the subscription`, async t => {
  let calls = 0, invalidAt = 0; const delivered = [];
  const f = await fixture(t, { service: { currentSession: async () => ++calls !== invalidAt }, send: async request => {
    if (!await request.authorize()) return { statusCode: 401 }; delivered.push(request.endpoint); return { statusCode: 201 };
  } });
  await f.register(); f.add('revoked-source'); calls = 0; invalidAt = stage; await f.service.tick();
  assert.equal(delivered.length, 0);
  const row = f.db.prepare('SELECT * FROM web_push_subscriptions').get(); assert.equal(row.enabled, 0); assert.equal(row.endpoint, null);
});

for (const stage of [1, 2, 3]) for (const result of [true, false]) test(`stopping while identity check ${stage} is awaiting ${result} preserves subscription data`, async t => {
  let calls = 0, pauseAt = 0, release, entered, delivered = 0;
  const waiting = new Promise(resolve => { release = resolve; }), began = new Promise(resolve => { entered = resolve; });
  const f = await fixture(t, { service: { currentSession: async () => { if (++calls === pauseAt) { entered(); return waiting; } return true; } }, send: async request => {
    if (!await request.authorize()) return { statusCode: 401 }; delivered++; return { statusCode: 201 };
  } });
  await f.register(); f.add('shutdown-work'); const before = f.db.prepare('SELECT * FROM web_push_subscriptions').get();
  calls = 0; pauseAt = stage; const tick = f.service.tick(); await began;
  const stopping = f.service.stop(); release(result); await Promise.all([tick, stopping]);
  assert.deepEqual(f.db.prepare('SELECT * FROM web_push_subscriptions').get(), before); assert.equal(delivered, 0);
  await assert.rejects(() => f.service.state('u1', 's1'), status(503));
});

test('same-device registration is idempotent and an explicit account switch replaces the old delivery owner', async t => {
  const f = await fixture(t); const first = await f.register();
  assert.equal((await f.register()).subscription.id, first.subscription.id);
  f.add('u1-new'); const switched = await f.register(1, 'u2', 's3'); assert.notEqual(switched.subscription.id, first.subscription.id);
  assert.equal((await f.service.state('u1', 's1')).subscriptions.length, 0);
  f.add('u2-new', 'u2'); await f.service.tick(); assert.equal(f.sent.length, 1);
  assert.equal(f.db.prepare('SELECT notification_id FROM web_push_queue WHERE state=\'accepted\'').get().notification_id, 'u2-new');
});

test('permissions changing during send preparation cancel the request; concurrent ticks do not duplicate it', async t => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { send: async request => { await pending; return { statusCode: await request.authorize() ? 201 : 401 }; } });
  await f.register(); f.add('protected');
  const first = f.service.tick(), second = f.service.tick(); assert.equal(first, second);
  while (!f.sent.length) await new Promise(resolve => setImmediate(resolve));
  f.sources.set('u1', []); release(); await first;
  assert.equal(f.sent.length, 1);
  assert.equal(f.db.prepare('SELECT state FROM web_push_queue').get().state, 'failed');
  assert.equal((await f.service.state('u1', 's1')).subscriptions[0].lastAcceptedAt, null);
});

test('permanent responses are not retried, transient errors have a fixed ceiling and expired leases recover', async t => {
  for (const code of [400, 401, 403, 404, 413]) {
    const f = await fixture(t, { send: async () => ({ statusCode: code }) });
    await f.register(); f.add(`http-${code}`); await f.service.tick(); f.advance(20000); await f.service.tick();
    assert.equal(f.sent.length, 1, String(code));
    assert.equal((await f.service.state('u1', 's1')).subscriptions[0].enabled, code !== 404);
  }
  const f = await fixture(t, { send: async () => { throw new Error('synthetic transport fault'); } });
  await f.register(); f.add('retry');
  for (let attempt = 0; attempt < 6; attempt++) { await f.service.tick(); f.advance(15000 * 2 ** attempt); }
  await f.service.tick(); assert.equal(f.sent.length, 6);
  assert.equal(f.db.prepare('SELECT state FROM web_push_queue').get().state, 'failed');
  const g = await fixture(t); const { subscription } = await g.register(); g.add('crash-before-response');
  g.db.prepare("INSERT INTO web_push_queue(subscription_id,notification_id,source_created_at,expires_at,state,next_attempt_at,lease_until,attempts) VALUES(?,?,?,?,'sending',?,?,1)").run(subscription.id, 'crash-before-response', g.time, new Date(Date.parse(g.time) + 3600000).toISOString(), g.time, new Date(Date.parse(g.time) + 30000).toISOString());
  await g.restart(); await g.service.tick(); assert.equal(g.sent.length, 0);
  g.advance(30000); await g.service.tick(); assert.equal(g.sent.length, 1);
});

test('push projection is read-only and removes internal fields, muted rooms, departed users and archived sources', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,role TEXT,active INTEGER DEFAULT 1);
      CREATE TABLE channels(id TEXT PRIMARY KEY,system_key TEXT,deleted_at TEXT,kind TEXT);
      CREATE TABLE memberships(channel_id TEXT,user_id TEXT);
      CREATE TABLE messages(id INTEGER PRIMARY KEY,channel_id TEXT,user_id TEXT,body TEXT,created_at TEXT,reply_to_id INTEGER,edited_at TEXT);
      INSERT INTO users VALUES('sender','sender','member',1),('recipient','recipient','member',1);
      INSERT INTO channels VALUES('room',NULL,NULL,'dm'); INSERT INTO memberships VALUES('room','sender'),('room','recipient');
      INSERT INTO messages VALUES(1,'room','sender','본문은 발송대기에 복사하지 않음','2026-10-08T01:00:00.000Z',NULL,NULL);`);
    const check = (value, status) => { if (!value) throw Object.assign(new Error('denied'), { status }); };
    const members = () => db.prepare('SELECT * FROM users WHERE active=1').all();
    const requireChannel = (userId, channelId) => { const row = db.prepare('SELECT c.* FROM channels c JOIN memberships m ON m.channel_id=c.id JOIN users u ON u.id=m.user_id WHERE c.id=? AND m.user_id=? AND u.active=1 AND c.deleted_at IS NULL').get(channelId, userId); check(row, 404); return row; };
    const requireMessage = (id, userId) => { const row = db.prepare('SELECT * FROM messages WHERE id=?').get(id); check(row, 404); requireChannel(userId, row.channel_id); return row; };
    const service = createCollaborationService({ db, assert: check, textField: value => value, now: () => '2026-10-08T01:00:00.000Z', members, requireChannel, requireMessage, requirePosting: requireChannel, publish() {}, backgroundJobsEnabled: false, transaction: fn => { db.exec('BEGIN'); try { const out = fn(); db.exec('COMMIT'); return out; } catch (error) { db.exec('ROLLBACK'); throw error; } }, messageShape: row => ({ id: String(row.id), channelId: row.channel_id, body: row.body }) });
    service.notifyMessage(db.prepare('SELECT * FROM messages').get());
    const before = db.prepare('SELECT total_changes() AS n').get().n;
    const projected = service.notificationsForPush('recipient');
    assert.equal(projected.length, 1); assert.equal('_source' in projected[0], false);
    assert.equal(db.prepare('SELECT total_changes() AS n').get().n, before);
    db.prepare('INSERT INTO channel_notifications VALUES(?,?,?)').run('room', 'recipient', 'mute');
    assert.deepEqual(service.notificationsForPush('recipient'), []);
    db.exec('DELETE FROM channel_notifications'); db.exec("DELETE FROM memberships WHERE user_id='recipient'");
    assert.deepEqual(service.notificationsForPush('recipient'), []);
    db.exec("INSERT INTO memberships VALUES('room','recipient'); UPDATE channels SET deleted_at='2026-10-08T02:00:00Z'");
    assert.deepEqual(service.notificationsForPush('recipient'), []);
    db.exec("UPDATE channels SET deleted_at=NULL; UPDATE users SET active=0 WHERE id='recipient'");
    assert.deepEqual(service.notificationsForPush('recipient'), []);
  } finally { db.close(); }
});

test('stopping aborts a sender still resolving DNS and never starts the HTTP request', async () => {
  const controller = new AbortController();
  const sender = createPayloadlessPushSender({ lookup: () => new Promise(() => {}), request() { assert.fail('HTTP started after cancellation'); } });
  const sending = sender({ endpoint: endpoint(1), ...generateVapidKeys(), subject: 'mailto:workspace@example.test', ttl: 100, signal: controller.signal });
  controller.abort();
  await assert.rejects(sending);
});
