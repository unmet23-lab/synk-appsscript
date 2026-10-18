import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createMessenger } from '../server.mjs';
import { createVoiceService } from '../voice-service.mjs';
import { createLiveKitVoiceProvider, voiceOptionsFromEnv, verifyLiveKitWebhook } from '../voice-livekit.mjs';

function check(condition, status, message) { if (!condition) throw Object.assign(new Error(message), { status }); }
function uuid(value) { check(typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value), 400, 'UUID'); return value; }
function fakeProvider() {
  return { serverUrl: 'wss://fixture.livekit.cloud', creates: [], removals: [], issued: [], updates: [], rooms: new Map(), autoConnect: true, lists: [], failList: false, failRemove: false, failCreate: false, gate: null,
    async createRoom(room, capacity) { this.creates.push({ room, capacity }); if (this.gate) await this.gate; if (this.failCreate) throw Object.assign(new Error('offline'), { status: 503 }); },
    issueToken(room, identity, capacity, permissions) { this.issued.push({ room, identity, capacity, permissions }); if (this.autoConnect) this.rooms.set(room, [...(this.rooms.get(room) || []).filter(p => p.identity !== identity), { identity, sid: 'PA_' + identity, state: 'ACTIVE', tracks: permissions?.canSpeak === false ? [] : [{ source: 'MICROPHONE', type: 'AUDIO', muted: false, ...(this.encrypted ? { encryption: 'GCM' } : {}) }] }]); return { token: 'synthetic-admission-' + identity, expiresAt: new Date(1800000000000).toISOString() }; },
    async updatePermissions(room, identity, permissions) {
      this.updates.push({ room, identity, permissions }); if (this.updateGate) await this.updateGate;
      if (this.failUpdate) throw Object.assign(new Error('offline'), { status: 503 });
      const participant = (this.rooms.get(room) || []).find(p => p.identity === identity);
      if (!participant) throw Object.assign(new Error('not connected'), { status: 503 });
      if (!this.keepTracks) participant.tracks = participant.tracks.filter(track => !permissions.paused && (track.source === 'MICROPHONE' && permissions.canSpeak || track.source === 'SCREEN_SHARE' && permissions.canShare || track.source === 'SCREEN_SHARE_AUDIO' && permissions.canShare && permissions.shareAudio));
    },
    verifyWebhook(raw, authorization) { return verifyLiveKitWebhook(raw, authorization, { apiKey: 'APItest123', apiSecret: 'synthetic-secret-for-tests-only-123456', now: this.now || Date.now }); },
    async listParticipants(room) { this.lists.push(room); if (this.listGate) await this.listGate; if (this.failList) throw new Error('offline'); return this.rooms.get(room) || []; },
    async removeParticipant(room, identity) { this.removals.push({ room, identity }); if (this.failRemove) throw new Error('offline'); this.rooms.set(room, (this.rooms.get(room) || []).filter(p => p.identity !== identity)); },
  };
}

function signEvent(event, stamp = Date.now(), overrides = {}, headerOverrides = {}) {
  const raw = Buffer.from(JSON.stringify(event));
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', ...headerOverrides })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ iss: 'APItest123', nbf: Math.floor(stamp / 1000), exp: Math.floor(stamp / 1000) + 300, sha256: createHash('sha256').update(raw).digest('base64'), ...overrides })).toString('base64url');
  const authorization = header + '.' + body + '.' + createHmac('sha256', 'synthetic-secret-for-tests-only-123456').update(header + '.' + body).digest('base64url');
  return { raw, authorization };
}

function mediaEvent(result, stamp, event = 'participant_joined', id = randomUUID()) {
  return { id, createdAt: String(Math.floor(stamp / 1000)), event, room: { name: result.admission.room, sid: 'RM_fixture' }, participant: { identity: result.admission.id, sid: 'PA_old' } };
}

function serviceFixture(t, extra = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE channels(id TEXT PRIMARY KEY); CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO channels VALUES('room-a'),('room-b'); INSERT INTO users VALUES('alice'),('bob'),('carol'),('dan'),('eve');");
  const provider = fakeProvider(), events = []; let stamp = 1792200000000, allowed = true;
  provider.now = () => stamp;
  const options = { db, assert: check, validateRequestId: uuid, publish: (...event) => events.push(event), enabled: true, e2eeRequired: false, provider, automaticSweep: false, now: () => stamp, invitationVisible: () => true, ...extra };
  let service = createVoiceService(options);
  t.after(async () => { await service.close(); db.close(); });
  const fixture = { db, provider, events, get service() { return service; }, get stamp() { return stamp; }, advance(ms) { stamp += ms; }, deny() { allowed = false; }, restart(overrides = {}) { service = createVoiceService({ ...options, ...overrides }); },
    admission(userId = 'alice', channelId = 'room-a', extra = {}) { return { userId, channelId, token: userId + '-session', requestId: randomUUID(), check: () => { check(allowed, 403, 'revoked'); return true; }, ...extra }; },
  };
  return fixture;
}

const callPermission = () => ({ canRemain: true, canJoin: true, canSpeak: true });
async function callingFixture(t, extra = {}) {
  const f = serviceFixture(t, extra), sender = f.admission('alice', 'room-a', { check: callPermission });
  const call = await f.service.join(sender);
  return Object.assign(f, { sender, call,
    invite(recipientId = 'bob', overrides = {}) { return f.service.invite({ ...sender, requestId: randomUUID(), recipientId, recipientCheck: callPermission, ...overrides }); },
    accept(invitation, overrides = {}) { return f.service.acceptInvitation({ id: invitation.id, userId: 'bob', token: 'bob-session', requestId: randomUUID(), check: callPermission, ...overrides }); },
  });
}

const secureClient = { protocol: 'synk-livekit-e2ee-v1', supported: true };
const sharePermission = () => ({ ...callPermission(), canShare: true, canShareAudio: true });
const keyAck = key => ({ epoch: key.epoch, sdkEnabled: true, workerReset: true, proof: createHmac('sha256', key.key).update(key.proofContext).digest('base64url') });
function secureFixture(t, extra = {}) {
  const f = serviceFixture(t, { e2eeRequired: true, ...extra }); f.provider.encrypted = true;
  return Object.assign(f, {
    input(userId = 'alice', channelId = 'room-a', overrides = {}) { return f.admission(userId, channelId, { check: sharePermission, client: secureClient, ...overrides }); },
    owner(result, userId = 'alice') { return { id: result.admission.id, userId, token: userId + '-session' }; },
    async key(result, userId = 'alice') { return f.service.encryptionKey(this.owner(result, userId)); },
    async ack(result, userId = 'alice', key) { key ||= await this.key(result, userId); return f.service.acknowledgeEncryption({ ...this.owner(result, userId), input: keyAck(key) }); },
    async connect(userId = 'alice', channelId = 'room-a', overrides = {}) { const joined = await f.service.join(this.input(userId, channelId, overrides)); return this.ack(joined, userId); },
  });
}

test('E2EE requires SDK support and key confirmation before any media JWT; keys never enter stored rows or events', async t => {
  const f = secureFixture(t);
  await assert.rejects(f.service.join(f.admission()), error => error.code === 'VOICE_E2EE_REQUIRED');
  assert.equal(f.provider.creates.length, 0);
  const joined = await f.service.join(f.input()); assert.equal(joined.admission.token, null); assert.equal(f.provider.issued.length, 0);
  assert.equal(joined.admission.mediaState, 'securing');
  const key = await f.key(joined); assert.equal(Buffer.from(key.key, 'base64url').length, 32);
  assert.equal((await f.service.resume(f.owner(joined))).admission.token, null);
  await assert.rejects(f.service.encryptionKey({ ...f.owner(joined), token: 'other-login' }), error => error.status === 404);
  await assert.rejects(f.service.encryptionKey(f.owner(joined, 'bob')), error => error.status === 404);
  await assert.rejects(f.service.acknowledgeEncryption({ ...f.owner(joined), input: { ...keyAck(key), proof: 'A'.repeat(43) } }), error => error.code === 'VOICE_E2EE_ACK_INVALID');
  const ready = await f.ack(joined, 'alice', key); assert.ok(ready.admission.token); assert.equal(ready.admission.encryption.ready, true);
  const rows = f.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().flatMap(row => f.db.prepare('SELECT * FROM ' + row.name).all());
  for (const value of [JSON.stringify(rows), JSON.stringify(f.events), JSON.stringify(f.service.channelState('room-a'))]) assert.equal(value.includes(key.key), false);
});

test('join rotates keys, pauses current publish/subscribe and waits for every participant to acknowledge the new epoch', async t => {
  const f = secureFixture(t), alice = await f.connect(), oldKey = await f.key(alice);
  const bob = await f.service.join(f.input('bob')), bobKey = await f.key(bob, 'bob'), aliceKey = await f.key(alice);
  assert.notEqual(bobKey.key, oldKey.key); assert.equal(bobKey.key, aliceKey.key); assert.notEqual(bobKey.epoch, oldKey.epoch);
  assert.ok(f.provider.updates.some(row => row.identity === alice.admission.id && row.permissions.paused));
  assert.equal((await f.ack(bob, 'bob', bobKey)).admission.token, null);
  await assert.rejects(f.service.acknowledgeEncryption({ ...f.owner(alice), input: keyAck(oldKey) }), error => error.code === 'VOICE_E2EE_ACK_INVALID');
  const resumed = await f.ack(alice, 'alice', aliceKey); assert.ok(resumed.admission.token);
  assert.ok((await f.service.resume(f.owner(bob, 'bob'))).admission.token);
  assert.equal(f.service.channelState('room-a').call.encryption.status, 'ready');
});

test('departed participants lose key access and a fresh key is withheld until remote revocation succeeds', async t => {
  const f = secureFixture(t), alice = await f.connect(), bob = await f.service.join(f.input('bob'));
  await f.ack(bob, 'bob'); await f.ack(alice); await f.service.resume(f.owner(bob, 'bob'));
  const oldKey = await f.key(alice); f.provider.failRemove = true;
  assert.equal((await f.service.leave(f.owner(bob, 'bob'))).cleanupPending, true);
  await assert.rejects(f.key(alice), error => error.code === 'VOICE_CLEANUP_PENDING');
  await assert.rejects(f.key(bob, 'bob'), error => error.status === 410);
  f.provider.failRemove = false; f.advance(15000); await f.service.sweep();
  const newKey = await f.key(alice); assert.notEqual(newKey.key, oldKey.key);
  assert.equal(f.provider.issued.length, 3); // first Alice, rekeyed Alice, resumed Bob
});

test('encryption acknowledgement timeout and a process restart never downgrade or restore old keys', async t => {
  const f = secureFixture(t), joined = await f.service.join(f.input()); await f.key(joined);
  f.advance(30001); await f.service.sweep(); assert.equal(f.provider.issued.length, 0);
  await assert.rejects(f.key(joined), error => error.status === 410);
  const fresh = await f.service.join(f.input()); const key = await f.key(fresh); f.restart(); await f.service.sweep();
  await assert.rejects(f.key(fresh), error => error.status === 410);
  const next = await f.service.join(f.input()); assert.notEqual((await f.key(next)).key, key.key);
});

test('unencrypted or unverified media in a required room is revoked instead of silently downgrading', async t => {
  const f = secureFixture(t), alice = await f.connect();
  f.provider.rooms.get(alice.admission.room)[0].tracks[0].encryption = 'NONE';
  f.advance(5000); await f.service.sweep();
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'ended');
  assert.ok(f.provider.removals.some(row => row.identity === alice.admission.id));
});

test('failed permission pause with unfinished revocation withholds replacement keys and all new tokens', async t => {
  const f = secureFixture(t); await f.connect(); f.provider.failUpdate = true; f.provider.failRemove = true;
  const bob = await f.service.join(f.input('bob'));
  assert.equal(bob.admission.token, null); assert.equal(f.provider.issued.length, 1);
  await assert.rejects(f.key(bob, 'bob'), error => error.code === 'VOICE_CLEANUP_PENDING');
});

test('old media still flowing after pause prevents key distribution and eventually ends the incomplete round', async t => {
  const f = secureFixture(t); await f.connect(); f.provider.keepTracks = true;
  const bob = await f.service.join(f.input('bob'));
  await assert.rejects(f.key(bob, 'bob'), error => error.code === 'VOICE_E2EE_PENDING');
  f.advance(30001); await f.service.sweep(); assert.equal(f.provider.issued.length, 1);
  assert.equal(f.service.current('bob', 'bob-session').admission.state, 'ended');
});

test('shutdown during an awaited key request cannot return replacement key material', async t => {
  const f = secureFixture(t), joined = await f.service.join(f.input()); f.advance(5000);
  let release; const before = f.provider.lists.length;
  f.provider.listGate = new Promise(resolve => { release = resolve; });
  const pending = f.key(joined);
  while (f.provider.lists.length === before) await new Promise(resolve => setImmediate(resolve));
  const closing = f.service.close(); release();
  await assert.rejects(pending, error => error.code === 'VOICE_STOPPING'); await closing;
  assert.equal(f.provider.issued.length, 0);
});

test('encrypted screen tracks without a reserved share are revoked', async t => {
  const f = secureFixture(t), alice = await f.connect();
  f.provider.rooms.get(alice.admission.room)[0].tracks.push({ source: 'SCREEN_SHARE', type: 'VIDEO', muted: false, encryption: 'GCM' });
  f.advance(5000); await f.service.sweep();
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'ended');
});

test('screen sharing has one workspace slot, separate audio permission, no camera grant and idempotent requests', async t => {
  const f = secureFixture(t), alice = await f.connect(); f.advance(5000); await f.service.sweep();
  await assert.rejects(f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: true } }), error => error.code === 'VOICE_SHARE_FORBIDDEN');
  const input = { requestId: randomUUID(), withAudio: false }, first = await f.service.startShare({ ...f.owner(alice), input });
  assert.equal(first.share.state, 'starting'); assert.equal((await f.service.startShare({ ...f.owner(alice), input })).share.id, first.share.id);
  assert.ok(f.provider.updates.at(-1).permissions.canShare); assert.equal(f.provider.updates.at(-1).permissions.shareAudio, false);
  const bob = await f.connect('bob', 'room-b'); f.advance(5000); await f.service.sweep();
  await assert.rejects(f.service.startShare({ ...f.owner(bob, 'bob'), input: { requestId: randomUUID(), withAudio: false } }), error => error.code === 'VOICE_SHARE_CAPACITY');
  const result = await f.service.stopShare(f.owner(alice)); assert.equal(result.cleanupPending, false);
  assert.equal(f.provider.updates.at(-1).permissions.canShare, false);
  await assert.rejects(f.service.startShare({ ...f.owner(alice), input }), error => error.code === 'VOICE_SHARE_REQUEST_ENDED');
});

test('observed encrypted screen sources are counted and browser-ended capture releases the slot without ending audio', async t => {
  const f = secureFixture(t), alice = await f.connect(); f.advance(5000); await f.service.sweep();
  await f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } });
  const room = alice.admission.room, participant = f.provider.rooms.get(room)[0];
  participant.tracks.push({ source: 'SCREEN_SHARE', type: 'VIDEO', muted: false, encryption: 'GCM' });
  f.advance(5000); await f.service.sweep(); assert.equal(f.service.channelState('room-a').call.participants[0].share.state, 'sharing');
  participant.tracks = participant.tracks.filter(track => track.source !== 'SCREEN_SHARE'); f.advance(5000); await f.service.sweep();
  assert.equal(f.service.channelState('room-a').call.participants[0].share, null); assert.equal(f.service.current('alice', 'alice-session').admission.state, 'active');
});

test('a stopped capture cannot release its slot while provider tracks or broader permissions remain', async t => {
  const f = secureFixture(t), alice = await f.connect(); f.advance(5000); await f.service.sweep();
  await f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } });
  f.provider.rooms.get(alice.admission.room)[0].tracks.push({ source: 'SCREEN_SHARE', type: 'VIDEO', muted: false, encryption: 'GCM' });
  f.provider.keepTracks = true; f.provider.failRemove = true;
  const stopped = await f.service.stopShare(f.owner(alice)); assert.equal(stopped.cleanupPending, true);
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'revoking');
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM voice_shares WHERE state<>'ended'").get().n, 1);
});

test('screen permission loss and cancellation during an awaited upgrade return no broader JWT', async t => {
  const f = secureFixture(t); let shareAllowed = true;
  const alice = await f.connect('alice', 'room-a', { check: () => ({ ...sharePermission(), canShare: shareAllowed }) }); f.advance(5000); await f.service.sweep();
  let release; f.provider.updateGate = new Promise(resolve => { release = resolve; }); const issued = f.provider.issued.length;
  const pending = f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } });
  while (!f.provider.updates.length) await new Promise(resolve => setImmediate(resolve));
  shareAllowed = false; const stopped = f.service.stopShare(f.owner(alice)); release();
  await assert.rejects(pending, error => error.code === 'VOICE_SHARE_CANCELLED'); await stopped;
  assert.equal(f.provider.issued.length, issued); assert.equal(f.provider.updates.at(-1).permissions.canShare, false);
});

test('screen video reservations increase the existing monthly downstream estimate without increasing its limit', async t => {
  const f = secureFixture(t), alice = await f.connect(), bob = await f.service.join(f.input('bob'));
  await f.ack(bob, 'bob'); await f.ack(alice); await f.service.resume(f.owner(bob, 'bob')); f.advance(5000); await f.service.sweep();
  const before = (await f.service.usage()).totals.estimatedDownstreamBytes;
  await f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } }); f.advance(1000);
  const totals = (await f.service.usage()).totals;
  assert.equal(totals.estimatedDownstreamBytes - before, 16000 + 187500); assert.equal(totals.limits.monthlyDownstreamBytes, 1000000000);
});

test('stopping a previously authorized screen while a media poll is due preserves the audio admission', async t => {
  const f = secureFixture(t), alice = await f.connect(); f.advance(5000); await f.service.sweep();
  await f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } });
  f.provider.rooms.get(alice.admission.room)[0].tracks.push({ source: 'SCREEN_SHARE', type: 'VIDEO', muted: false, encryption: 'GCM' });
  f.advance(5000); await f.service.sweep(); f.advance(5000);
  const stopped = await f.service.stopShare(f.owner(alice));
  assert.equal(stopped.cleanupPending, false);
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'active');
  assert.equal(f.provider.removals.length, 0);
  assert.equal(f.provider.rooms.get(alice.admission.room)[0].tracks.some(track => track.source === 'SCREEN_SHARE'), false);
});

test('screen policy revocation removes observed screen tracks without revoking permitted microphone audio', async t => {
  const f = secureFixture(t), alice = await f.connect(); f.advance(5000); await f.service.sweep();
  await f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } });
  f.provider.rooms.get(alice.admission.room)[0].tracks.push({ source: 'SCREEN_SHARE', type: 'VIDEO', muted: false, encryption: 'GCM' });
  f.advance(5000); await f.service.sweep(); f.advance(5000);
  await f.service.updatePolicy({ channelId: 'room-a', actorId: 'alice', input: { revision: 0, screenShareEnabled: false }, check: () => ({ canModerate: true }) });
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'active');
  assert.equal(f.provider.removals.length, 0);
  assert.equal(f.provider.rooms.get(alice.admission.room)[0].tracks.some(track => track.source === 'SCREEN_SHARE'), false);
});

test('an awaited screen upgrade cannot issue a media JWT after the lease, session duration or monthly budget expires', async t => {
  for (const scenario of [
    { name: 'lease', advance: 76000, reason: 'lease_expired', limits: {} },
    { name: 'session', advance: 56000, reason: 'session_limit', limits: { maxSessionSeconds: 60 } },
    { name: 'budget', advance: 56000, reason: 'usage_limit', limits: { monthlyParticipantMinutes: 1 } },
  ]) await t.test(scenario.name, async t => {
    const f = secureFixture(t, { limits: scenario.limits }), alice = await f.connect(); f.advance(5000); await f.service.sweep();
    let release; f.provider.updateGate = new Promise(resolve => { release = resolve; });
    const issued = f.provider.issued.length, updates = f.provider.updates.length;
    const pending = f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } });
    while (f.provider.updates.length === updates) await new Promise(resolve => setImmediate(resolve));
    f.advance(scenario.advance); release();
    await assert.rejects(pending, error => error.status === 409 || error.status === 410);
    assert.equal(f.provider.issued.length, issued);
    assert.equal(f.service.current('alice', 'alice-session').admission.reason, scenario.reason);
    assert.equal(f.service.current('alice', 'alice-session').admission.state, 'ended');
  });
});

test('leaving during an awaited screen permission upgrade fences the admission before another JWT can be returned', async t => {
  const f = secureFixture(t), alice = await f.connect(); f.advance(5000); await f.service.sweep();
  let release; f.provider.updateGate = new Promise(resolve => { release = resolve; });
  const issued = f.provider.issued.length, updates = f.provider.updates.length;
  const pending = f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } });
  while (f.provider.updates.length === updates) await new Promise(resolve => setImmediate(resolve));
  const leaving = f.service.leave(f.owner(alice)); release();
  await assert.rejects(pending, error => ['VOICE_PERMISSION_DENIED', 'VOICE_SHARE_CANCELLED', 'VOICE_ENDED'].includes(error.code));
  await leaving;
  assert.equal(f.provider.issued.length, issued);
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'ended');
});

test('provider observations of a paused connection keep the admission securing until the new key round is ready', async t => {
  const f = secureFixture(t), alice = await f.connect();
  await f.service.join(f.input('bob')); f.advance(5000); await f.service.sweep();
  assert.equal(f.service.channelState('room-a').call.encryption.ready, false);
  assert.equal(f.service.current('alice', 'alice-session').admission.mediaState, 'securing');
  assert.equal(f.service.current('bob', 'bob-session').admission.mediaState, 'securing');
  assert.equal(f.service.channelState('room-a').call.participants.length, 0);
});

test('a capture cancelled during the preflight media lookup cannot later reserve a slot or issue a screen JWT', async t => {
  const f = secureFixture(t), alice = await f.connect(); f.advance(5000); await f.service.sweep(); f.advance(5000);
  let release; f.provider.listGate = new Promise(resolve => { release = resolve; });
  const issued = f.provider.issued.length, lists = f.provider.lists.length;
  const pending = f.service.startShare({ ...f.owner(alice), input: { requestId: randomUUID(), withAudio: false } });
  while (f.provider.lists.length === lists) await new Promise(resolve => setImmediate(resolve));
  const stopped = f.service.stopShare(f.owner(alice)); release();
  await assert.rejects(pending, error => error.code === 'VOICE_SHARE_CANCELLED'); await stopped;
  assert.equal(f.provider.issued.length, issued);
  assert.equal(f.provider.updates.length, 0);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM voice_shares WHERE state<>'ended'").get().n, 0);
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'active');
});

test('retrying a cancelled preflight screen request cannot revive its capture consent', async t => {
  const f = secureFixture(t), alice = await f.connect(); f.advance(5000); await f.service.sweep(); f.advance(5000);
  let release; f.provider.listGate = new Promise(resolve => { release = resolve; });
  const input = { requestId: randomUUID(), withAudio: false }, lists = f.provider.lists.length, issued = f.provider.issued.length;
  const pending = f.service.startShare({ ...f.owner(alice), input });
  while (f.provider.lists.length === lists) await new Promise(resolve => setImmediate(resolve));
  const stopping = f.service.stopShare(f.owner(alice)); release();
  await assert.rejects(pending, error => error.code === 'VOICE_SHARE_CANCELLED'); await stopping;
  await assert.rejects(f.service.startShare({ ...f.owner(alice), input }), error => error.code === 'VOICE_SHARE_REQUEST_ENDED');
  assert.equal(f.provider.issued.length, issued);
  assert.equal(f.provider.updates.length, 0);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM voice_shares WHERE state<>'ended'").get().n, 0);
  const fresh = await f.service.startShare({ ...f.owner(alice), input: { ...input, requestId: randomUUID() } });
  assert.equal(fresh.share.state, 'starting');
});

test('repeated background reconciliation requests cannot starve heartbeats behind slow room lookups', async t => {
  const f = serviceFixture(t);
  f.db.exec("INSERT INTO channels VALUES('room-c'),('room-d')");
  const alice = await f.service.join(f.admission()), bob = await f.service.join(f.admission('bob', 'room-b'));
  await f.service.join(f.admission('carol', 'room-c')); await f.service.join(f.admission('dan', 'room-d'));
  const list = f.provider.listParticipants;
  f.provider.listParticipants = async function(room) { const result = await list.call(this, room); f.advance(3000); return result; };
  let release; f.provider.listGate = new Promise(resolve => { release = resolve; });
  f.advance(5000); const lists = f.provider.lists.length, first = f.service.sweep();
  while (f.provider.lists.length === lists) await new Promise(resolve => setImmediate(resolve));
  const repeated = Array.from({ length: 10 }, () => f.service.sweep());
  const heartbeat = f.service.heartbeat({ id: alice.admission.id, userId: 'alice', token: 'alice-session' });
  release(); await Promise.all([first, ...repeated, heartbeat]);
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'active');
  assert.equal(f.service.current('bob', 'bob-session').admission.id, bob.admission.id);
});

test('voice defaults off and never creates a provider from leftover credentials', () => {
  assert.deepEqual(voiceOptionsFromEnv({ SYNK_VOICE_LIVEKIT_URL: 'bad' }), { enabled: false });
  assert.throws(() => voiceOptionsFromEnv({ SYNK_WORKSPACE_VOICE_ENABLED: 'true' }), /0 또는 1/);
  assert.throws(() => voiceOptionsFromEnv({ SYNK_WORKSPACE_VOICE_ENABLED: '1' }), /주소/);
});

test('invitation delivery never joins a recipient and deduplicates a repeated request', async t => {
  const f = await callingFixture(t), requestId = randomUUID();
  const first = await f.invite('bob', { requestId }), retry = await f.invite('bob', { requestId });
  assert.equal(first.created, true); assert.equal(retry.created, false); assert.equal(first.invitation.id, retry.invitation.id);
  assert.equal(first.invitation.state, 'pending'); assert.equal(f.provider.issued.length, 1);
  assert.equal(first.invitation.alert, undefined); assert.equal(f.service.invitation(first.invitation.id, 'bob').alert.soundEnabled, true);
  assert.equal(f.service.invitationNotifications('bob').length, 1); assert.equal(f.service.invitationNotifications('alice').length, 0);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM voice_admissions WHERE user_id='bob'").get().n, 0);
  assert.equal(JSON.stringify(first).includes('session'), false); assert.equal(JSON.stringify(first).includes('token'), false);
  assert.throws(() => f.service.invitation(first.invitation.id, 'carol'), error => error.status === 404);
  await assert.rejects(f.invite('carol', { requestId }), error => error.code === 'VOICE_INVITATION_CONFLICT');
});

test('only one device accepts; the winning request retries the same admission without another reservation', async t => {
  const f = await callingFixture(t), { invitation } = await f.invite(), requestId = randomUUID();
  const results = await Promise.allSettled([f.accept(invitation, { requestId }), f.accept(invitation, { token: 'bob-other-session' })]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].reason.code, 'VOICE_INVITATION_CLAIMED');
  const first = results[0].value, retry = await f.accept(invitation, { requestId });
  assert.equal(first.invitation.state, 'accepted'); assert.equal(retry.admission.id, first.admission.id);
  assert.equal(retry.admission.leaseExpiresAt, first.admission.leaseExpiresAt); assert.equal(f.service.invitationNotifications('bob').length, 0);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM voice_admissions WHERE user_id='bob'").get().n, 1);
  await f.service.leave({ id: first.admission.id, userId: 'bob', token: 'bob-session' });
  await assert.rejects(f.accept(invitation, { requestId }), error => error.code === 'VOICE_ENDED');
});

test('acceptance cancelled while provider setup is waiting returns no recipient token', async t => {
  const f = await callingFixture(t), { invitation } = await f.invite(); let release;
  f.provider.gate = new Promise(resolve => { release = resolve; });
  const accepting = f.accept(invitation);
  while (f.provider.creates.length < 2) await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.service.respondInvitation({ id: invitation.id, userId: 'alice', action: 'cancel' }).invitation.state, 'cancelled');
  release(); await assert.rejects(accepting, error => error.code === 'VOICE_INVITATION_ENDED');
  assert.equal(f.provider.issued.length, 1); assert.equal(f.service.channelState('room-a').call.reservations.length, 1);
  assert.equal(f.service.invitationNotifications('bob').length, 0);
});

test('caller leaving during acceptance fences consent before the queued media cleanup completes', async t => {
  const f = await callingFixture(t), { invitation } = await f.invite(); let release;
  f.provider.gate = new Promise(resolve => { release = resolve; }); const accepting = f.accept(invitation);
  while (f.provider.creates.length < 2) await new Promise(resolve => setImmediate(resolve));
  const leaving = f.service.leave({ id: f.call.admission.id, userId: 'alice', token: f.sender.token });
  assert.equal(f.service.invitation(invitation.id, 'bob').state, 'cancelled');
  release(); await assert.rejects(accepting, error => error.code === 'VOICE_INVITATION_ENDED'); await leaving;
  assert.equal(f.provider.issued.length, 1); assert.equal(f.service.channelState('room-a').call, null);
});

test('DND fences an in-flight acceptance and never disconnects an already accepted call', async t => {
  const f = await callingFixture(t), { invitation } = await f.invite(); let release;
  f.provider.gate = new Promise(resolve => { release = resolve; });
  const accepting = f.accept(invitation);
  while (f.provider.creates.length < 2) await new Promise(resolve => setImmediate(resolve));
  f.service.updatePreferences('bob', { revision: 0, doNotDisturb: true }); release();
  await assert.rejects(accepting, error => error.code === 'VOICE_INVITATION_ENDED');
  assert.equal(f.provider.issued.length, 1); assert.equal(f.service.invitation(invitation.id, 'alice').state, 'unavailable');
  f.service.updatePreferences('bob', { revision: 1, doNotDisturb: false }); f.advance(60000);
  await f.service.heartbeat({ id: f.call.admission.id, userId: 'alice', token: f.sender.token });
  const next = await f.invite(); const joined = await f.accept(next.invitation);
  f.service.updatePreferences('bob', { revision: 2, doNotDisturb: true }); await f.service.sweep();
  assert.equal(f.service.current('bob', 'bob-session').admission.state, 'active');
  assert.ok(!f.provider.removals.some(row => row.identity === joined.admission.id));
});

test('silent, disabled and temporary DND preferences stay private and do not resurrect suppressed invitations', async t => {
  const f = await callingFixture(t);
  f.service.updatePreferences('bob', { revision: 0, callSounds: false });
  let result = await f.invite(); assert.equal(result.invitation.state, 'pending');
  assert.equal(f.service.invitationNotifications('bob')[0].pushEligible, false);
  assert.equal(f.service.invitation(result.invitation.id, 'bob').alert.soundEnabled, false);
  f.service.updatePreferences('bob', { revision: 1, doNotDisturb: true, doNotDisturbUntil: new Date(f.stamp + 10000).toISOString() });
  assert.equal(f.service.invitationNotifications('bob').length, 0); f.advance(10001);
  assert.equal(f.service.preferences('bob').doNotDisturb, false);
  assert.equal(f.service.invitation(result.invitation.id, 'bob').state, 'unavailable');
  assert.deepEqual(Object.keys(result.invitation).filter(key => /dnd|sound|preference/i.test(key)), []);
  assert.throws(() => f.service.updatePreferences('bob', { revision: 0, callNotifications: false }), error => error.code === 'VOICE_PREFERENCES_CONFLICT');
  assert.throws(() => f.service.updatePreferences('bob', { revision: 2, doNotDisturb: true, doNotDisturbUntil: new Date(f.stamp + 8 * 86400000).toISOString() }), error => error.status === 400);
  assert.throws(() => f.service.updatePreferences('bob', { revision: 2, callSounds: 'false' }), error => error.status === 400);
  f.service.updatePreferences('bob', { revision: 2, callNotifications: false });
  f.advance(50000); await f.service.heartbeat({ id: f.call.admission.id, userId: 'alice', token: f.sender.token });
  result = await f.invite(); assert.equal(result.invitation.state, 'unavailable');
});

test('reject, cancel and expiry are terminal, idempotent and remove current alerts', async t => {
  const f = await callingFixture(t), first = (await f.invite()).invitation;
  assert.throws(() => f.service.respondInvitation({ id: first.id, userId: 'bob', action: 'cancel' }), error => error.status === 404);
  const reject = () => f.service.respondInvitation({ id: first.id, userId: 'bob', action: 'reject' });
  assert.equal(reject().invitation.state, 'rejected'); assert.equal(reject().invitation.state, 'rejected');
  await assert.rejects(f.accept(first), error => error.code === 'VOICE_INVITATION_ENDED');
  const second = (await f.invite('carol')).invitation; f.advance(45000);
  assert.equal(f.service.invitation(second.id, 'carol').state, 'expired'); assert.equal(f.service.invitationNotifications('carol').length, 0);
  await assert.rejects(f.accept(second, { userId: 'carol', token: 'carol-session' }), error => error.code === 'VOICE_INVITATION_ENDED');
});

test('caller leave, restart, disable, and recipient access loss invalidate outstanding invitations', async t => {
  const f = await callingFixture(t), first = (await f.invite()).invitation;
  await f.service.leave({ id: f.call.admission.id, userId: 'alice', token: f.sender.token });
  assert.equal(f.service.invitation(first.id, 'bob').state, 'cancelled');
  f.call = await f.service.join({ ...f.sender, requestId: randomUUID() });
  const next = (await f.invite('carol')).invitation; f.restart();
  assert.equal(f.service.invitation(next.id, 'carol').state, 'cancelled');
  await f.service.sweep(); f.call = await f.service.join({ ...f.sender, requestId: randomUUID() });
  const disabled = (await f.invite('dan')).invitation; f.restart({ enabled: false });
  assert.equal(f.db.prepare('SELECT state FROM voice_invitations WHERE id=?').get(disabled.id).state, 'cancelled');
});

test('invitation acceptance preserves the global quota and listen-only permission', async t => {
  const f = await callingFixture(t, { limits: { maxConcurrentParticipants: 2 } });
  const listener = () => ({ canRemain: true, canJoin: true, canSpeak: false });
  const first = (await f.invite('bob', { recipientCheck: listener })).invitation;
  const joined = await f.accept(first, { check: listener }); assert.equal(joined.admission.canSpeak, false);
  const second = (await f.invite('carol')).invitation;
  await assert.rejects(f.accept(second, { userId: 'carol', token: 'carol-session' }), error => error.code === 'VOICE_CAPACITY');
  assert.equal(f.service.invitation(second.id, 'carol').state, 'failed'); assert.equal(f.provider.issued.length, 2);
});

test('busy recipients and a second pending caller receive no extra alert', async t => {
  const f = await callingFixture(t), first = (await f.invite()).invitation;
  const carol = f.admission('carol', 'room-a', { check: callPermission }); await f.service.join(carol);
  const extra = await f.service.invite({ ...carol, recipientId: 'bob', requestId: randomUUID(), recipientCheck: callPermission });
  assert.equal(extra.invitation.state, 'unavailable'); assert.equal(f.service.invitationNotifications('bob').length, 1);
  await f.service.join(f.admission('bob', 'room-b'));
  assert.equal(f.service.invitation(first.id, 'bob').state, 'unavailable');
  assert.equal(f.service.invitationNotifications('bob').length, 0);
});

test('pair throttles persist after restart, count suppressed requests and do not count idempotent retries', async t => {
  const f = await callingFixture(t), requestId = randomUUID(); f.service.updatePreferences('bob', { revision: 0, doNotDisturb: true });
  assert.equal((await f.invite('bob', { requestId })).invitation.state, 'unavailable');
  await f.invite('bob', { requestId });
  await assert.rejects(f.invite(), error => error.code === 'VOICE_INVITATION_RATE_LIMIT');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_invitations').get().n, 1);
  f.restart(); await f.service.sweep(); await f.service.join({ ...f.sender, requestId: randomUUID() });
  await assert.rejects(f.invite(), error => error.code === 'VOICE_INVITATION_RATE_LIMIT');
});

test('retention releases invitation references before pruning ended admissions and calls', async t => {
  const f = await callingFixture(t), { invitation } = await f.invite(); await f.accept(invitation);
  await f.service.close(); f.advance(31 * 86400000); f.restart(); await f.service.sweep();
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_invitations').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_admissions').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_calls').get().n, 0);
});

test('sender rate limits also cover different recipients and reject the sixth new request in a minute', async t => {
  const f = await callingFixture(t);
  for (let index = 0; index < 6; index++) f.db.prepare('INSERT INTO users VALUES(?)').run('target-' + index);
  for (let index = 0; index < 5; index++) assert.equal((await f.invite('target-' + index)).invitation.state, 'pending');
  await assert.rejects(f.invite('target-5'), error => error.code === 'VOICE_INVITATION_RATE_LIMIT');
});

test('accept cannot bypass a monthly usage limit reached since the invitation was sent', async t => {
  const f = await callingFixture(t, { limits: { monthlyParticipantMinutes: 1 } }), { invitation } = await f.invite();
  f.db.prepare('INSERT INTO voice_usage_months(month,reserved_ms) VALUES(?,60000) ON CONFLICT(month) DO UPDATE SET reserved_ms=60000').run(new Date(f.stamp).toISOString().slice(0, 7));
  assert.ok(Date.parse(invitation.expiresAt) > f.stamp);
  await assert.rejects(f.accept(invitation), error => ['VOICE_INVITATION_ENDED', 'VOICE_USAGE_LIMIT'].includes(error.code));
  assert.equal(f.provider.issued.length, 1);
});

test('provider validates Cloud endpoint and signs an opaque, audio-only, short-lived admission', async () => {
  const secret = 'synthetic-secret-for-tests-only-123456', apiKey = 'APItest123';
  const calls = [], at = 1792200000123;
  const options = { url: 'wss://fixture.livekit.cloud', apiKey, apiSecret: secret, now: () => at, fetch: async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 200 }); } };
  for (const url of ['ws://fixture.livekit.cloud', 'wss://fixture.livekit.cloud.evil.test', 'wss://user@fixture.livekit.cloud', 'wss://fixture.livekit.cloud/path', 'wss://fixture.livekit.cloud/?token=x', 'wss://127.0.0.1']) assert.throws(() => createLiveKitVoiceProvider({ ...options, url }));
  const provider = createLiveKitVoiceProvider(options), room = 'synk-work-' + randomUUID(), identity = randomUUID();
  const credential = provider.issueToken(room, identity, 4), [header, body, signature] = credential.token.split('.'), claims = JSON.parse(Buffer.from(body, 'base64url'));
  assert.equal(signature, createHmac('sha256', secret).update(header + '.' + body).digest('base64url'));
  assert.equal(claims.sub, identity); assert.equal(claims.iss, apiKey); assert.equal(claims.exp - claims.nbf, 60);
  assert.deepEqual(claims.video, { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false, canPublishSources: ['microphone'] });
  assert.equal(claims.roomConfig.maxParticipants, 4); assert.equal(claims.name, undefined); assert.equal(claims.metadata, undefined);
  await provider.createRoom(room, 4); await provider.removeParticipant(room, identity);
  assert.equal(calls.length, 2); assert.match(calls[0].url, /^https:\/\/fixture.livekit.cloud\/twirp\/livekit.RoomService\/CreateRoom$/);
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: room, max_participants: 4, empty_timeout: 60, departure_timeout: 20 });
  assert.deepEqual(JSON.parse(calls[1].init.body), { room, identity, revoke_token_ts: Math.floor(at / 1000) + 1 });
  for (const call of calls) { assert.equal(call.init.redirect, 'error'); assert.ok(call.init.signal); }
  const admin = JSON.parse(Buffer.from(calls[1].init.headers.Authorization.split('.')[1], 'base64url'));
  assert.deepEqual(admin.video, { roomAdmin: true, room });
});

test('provider fails closed for missing, redirected, or failed control endpoints without disclosing response data', async () => {
  for (const status of [302, 401, 404, 500]) {
    const provider = createLiveKitVoiceProvider({ url: 'wss://fixture.livekit.cloud', apiKey: 'APItest123', apiSecret: 'synthetic-secret-for-tests-only-123456', fetch: async () => new Response('do-not-disclose', { status }) });
    await assert.rejects(provider.removeParticipant('room', 'identity'), error => error.status === 503 && !error.message.includes('do-not-disclose'));
  }
});

test('same request is idempotent, identities are opaque and duplicate devices cannot join other calls', async t => {
  const f = serviceFixture(t), input = f.admission(), first = await f.service.join(input), retry = await f.service.join(input);
  assert.equal(first.admission.id, retry.admission.id); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_admissions').get().n, 1);
  assert.equal(first.admission.identity, first.admission.id); assert.ok(!first.admission.room.includes('alice')); assert.equal(first.call.reservations[0].userId, 'alice');
  assert.equal(JSON.stringify(first.call).includes(first.admission.token), false);
  await assert.rejects(f.service.join(f.admission('alice', 'room-b')), error => error.status === 409);
  await assert.rejects(f.service.join({ ...input, channelId: 'room-b' }), error => error.status === 409);
  await assert.rejects(f.service.leave({ id: first.admission.id, userId: 'bob', token: 'bob-session' }), error => error.status === 404);
  assert.deepEqual(await f.service.leave({ id: first.admission.id, userId: 'alice', token: input.token }), { ok: true, cleanupPending: false });
  assert.equal(f.service.channelState('room-a').call, null);
  await assert.rejects(f.service.join(input), error => error.status === 409);
});

test('global four-person capacity is serialized across concurrent rooms', async t => {
  const f = serviceFixture(t);
  const outcomes = await Promise.allSettled(['alice', 'bob', 'carol', 'dan', 'eve'].map((user, i) => f.service.join(f.admission(user, i % 2 ? 'room-b' : 'room-a'))));
  assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 4);
  assert.equal(outcomes.find(row => row.status === 'rejected').reason.status, 409);
  assert.equal(f.provider.issued.length, 4);
});

test('revocation during room creation returns no token and cleans the reserved admission', async t => {
  const f = serviceFixture(t); let release;
  f.provider.gate = new Promise(resolve => { release = resolve; });
  const pending = f.service.join(f.admission());
  while (!f.provider.creates.length) await new Promise(resolve => setImmediate(resolve));
  f.deny(); release();
  await assert.rejects(pending, error => error.status === 403);
  assert.equal(f.provider.issued.length, 0); assert.equal(f.service.channelState('room-a').call, null);
});

test('lease expiry, session revocation, maximum duration, and restart remove media participants', async t => {
  const f = serviceFixture(t), input = f.admission();
  const result = await f.service.join(input);
  f.advance(30000); const heartbeat = await f.service.heartbeat({ id: result.admission.id, userId: 'alice', token: input.token });
  assert.equal(Date.parse(heartbeat.leaseExpiresAt) - Date.parse(result.admission.leaseExpiresAt), 30000);
  f.advance(75000); await f.service.sweep();
  assert.ok(f.provider.removals.some(row => row.identity === result.admission.id));
  await assert.rejects(f.service.heartbeat({ id: result.admission.id, userId: 'alice', token: input.token }), error => error.status === 410);
  const second = await f.service.join(f.admission()); f.restart(); await f.service.sweep();
  assert.ok(f.provider.removals.some(row => row.identity === second.admission.id));
  const third = await f.service.join(f.admission()); f.deny(); await f.service.sweep();
  assert.ok(f.provider.removals.some(row => row.identity === third.admission.id));
  const last = await f.service.join(f.admission('bob', 'room-a', { check: () => true }));
  f.db.prepare('UPDATE voice_admissions SET lease_until=joined_at+99999999 WHERE id=?').run(last.admission.id);
  f.advance(2 * 3600000); await f.service.sweep();
  assert.ok(f.provider.removals.some(row => row.identity === last.admission.id));
});

test('failed revocation remains durable, blocks fresh admissions, and retries after restart', async t => {
  const f = serviceFixture(t), input = f.admission(), result = await f.service.join(input);
  f.provider.failRemove = true;
  assert.equal((await f.service.leave({ id: result.admission.id, userId: 'alice', token: input.token })).cleanupPending, true);
  await assert.rejects(f.service.join(f.admission('bob')), error => error.status === 503);
  assert.equal(f.db.prepare('SELECT state FROM voice_admissions WHERE id=?').get(result.admission.id).state, 'revoking');
  f.restart(); f.provider.failRemove = false; f.advance(15000); await f.service.sweep();
  assert.equal(f.service.channelState('room-a').call, null);
  await f.service.join(f.admission('bob'));
});

test('metadata expiry only removes completed admissions and retains unresolved media revocation', async t => {
  const f = serviceFixture(t), first = await f.service.join(f.admission());
  await f.service.leave({ id: first.admission.id, userId: 'alice', token: 'alice-session' });
  const pending = await f.service.join(f.admission('bob')); f.provider.failRemove = true;
  await f.service.leave({ id: pending.admission.id, userId: 'bob', token: 'bob-session' });
  f.advance(31 * 86400000); await f.service.sweep();
  assert.equal(f.db.prepare('SELECT id FROM voice_admissions WHERE id=?').get(first.admission.id), undefined);
  assert.equal(f.db.prepare('SELECT state FROM voice_admissions WHERE id=?').get(pending.admission.id).state, 'revoking');
});

test('disabling the feature after a crash still drains persisted admissions using a lazy cleanup provider', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission()); let resolved = 0;
  f.restart({ enabled: false, provider: undefined, cleanupProvider: () => { resolved++; return f.provider; } });
  assert.equal(resolved, 1); assert.equal(f.service.capabilities().cleanupPending, true);
  await assert.rejects(f.service.join(f.admission('bob')), error => error.status === 503);
  await f.service.sweep();
  assert.ok(f.provider.removals.some(row => row.identity === result.admission.id));
  assert.equal(f.service.capabilities().cleanupPending, false); assert.equal(f.service.channelState('room-a').call, null);
});

test('disabled startup without previous credentials reports pending cleanup without pretending media has disconnected', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission());
  const warning = t.mock.method(console, 'error', () => {});
  f.restart({ enabled: false, provider: undefined });
  assert.equal(f.service.capabilities().cleanupPending, true);
  assert.equal(f.db.prepare('SELECT state FROM voice_admissions WHERE id=?').get(result.admission.id).state, 'revoking');
  assert.equal(f.provider.removals.length, 0); assert.equal(warning.mock.calls.length, 1);
});

async function httpFixture(t, enabled = true, voiceOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-voice-api-'));
  const provider = fakeProvider(); let app;
  const users = ['alice', 'bob', 'outsider', 'reader', 'admin'].map((id, i) => ({ id, name: id, active: true, role: i === 3 ? 'viewer' : i === 4 ? 'admin' : 'member' }));
  const sessions = new Map(users.map(row => [row.id + '-session', row.id]));
  const server = createServer((req, res) => app.handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const integration = { origin, listUsers: () => users, authenticate(req) {
    const token = req.headers.cookie?.split('=').at(-1), user = users.find(row => row.id === sessions.get(token) && row.active);
    return user ? { companyUserId: user.id, token, role: user.role, csrfToken: 'synthetic-csrf', canWrite: user.canWrite ?? user.role !== 'viewer', canManage: user.role === 'admin', parentOrigin: origin } : null;
  } };
  app = createMessenger({ dataDir: directory, port: 0, basePath: '/messenger', integration, driveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) }, backgroundJobsEnabled: false, workNotificationsEnabled: false, voice: enabled ? { enabled: true, e2eeRequired: false, provider, automaticSweep: false, ...voiceOptions } : { enabled: false } });
  await app.startMounted();
  t.after(async () => { await app.close(); await new Promise(resolve => server.close(resolve)); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.split(sep).at(-1).startsWith('synk-voice-api-')); await rm(directory, { recursive: true, force: true }); });
  async function api(user, path, method = 'GET', body, status = 200, headers = {}) {
    const response = await fetch(origin + '/messenger' + path, { method, headers: { Cookie: 'session=' + user + '-session', Origin: origin, 'x-csrf-token': 'synthetic-csrf', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    const result = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`); return { response, result };
  }
  const alice = (await api('alice', '/api/bootstrap')).result, bob = (await api('bob', '/api/bootstrap')).result;
  const room = (await api('alice', '/api/channels', 'POST', { name: '음성 확인', category: 'project', memberIds: [bob.user.id] }, 201)).result.channel;
  return { app, provider, users, sessions, api, alice, bob, room, origin, integration };
}

async function secureHttpFixture(t) {
  let stamp = Date.now(); const f = await httpFixture(t, true, { e2eeRequired: true, now: () => stamp }); f.provider.encrypted = true;
  return { ...f,
    advance(ms) { stamp += ms; },
    async join(user = 'alice', channelId = f.room.id) { return (await f.api(user, `/api/channels/${channelId}/voice/join`, 'POST', { requestId: randomUUID(), client: secureClient })).result; },
    async key(joined, user = 'alice') { return (await f.api(user, `/api/voice/${joined.admission.id}/encryption/key`, 'POST', {})).result; },
    async ack(joined, user = 'alice', key) { key ||= await this.key(joined, user); return (await f.api(user, `/api/voice/${joined.admission.id}/encryption/ack`, 'POST', keyAck(key))).result; },
    async connected(user = 'alice', channelId = f.room.id) { const result = await this.ack(await this.join(user, channelId), user); stamp += 5000; await f.api(user, `/api/channels/${channelId}/voice`); return result; },
  };
}

test('HTTP required encryption checks client support, original session, CSRF and hides keys from all read surfaces', async t => {
  const f = await secureHttpFixture(t), base = `/api/channels/${f.room.id}/voice`;
  await f.api('alice', base + '/join', 'POST', { requestId: randomUUID() }, 426);
  const joined = await f.join(), path = `/api/voice/${joined.admission.id}/encryption`;
  assert.equal(joined.admission.token, null);
  await f.api('alice', path + '/key', 'POST', {}, 403, { 'x-csrf-token': '' });
  for (const actor of ['bob', 'outsider', 'admin']) await f.api(actor, path + '/key', 'POST', {}, 404);
  const response = await f.api('alice', path + '/key', 'POST', {}), key = response.result;
  assert.equal(response.response.headers.get('cache-control'), 'no-store');
  for (const endpoint of ['/api/bootstrap', '/api/voice/current', base, '/api/notifications']) assert.equal(JSON.stringify((await f.api('alice', endpoint)).result).includes(key.key), false);
  await f.api('alice', path + '/ack', 'POST', { ...keyAck(key), sdkEnabled: false }, 409);
  const ready = await f.ack(joined, 'alice', key); assert.ok(ready.admission.token); assert.equal(ready.admission.encryption.applicationServerTrusted, true);
});

test('HTTP screen stop and policy withdrawal preserve audio after a due provider poll and reject unauthorized stops', async t => {
  const f = await secureHttpFixture(t), alice = await f.connected(), base = `/api/channels/${f.room.id}/voice`, share = `/api/voice/${alice.admission.id}/share`;
  await f.api('alice', share + '/start', 'POST', { requestId: randomUUID(), withAudio: false });
  const screen = { source: 'SCREEN_SHARE', type: 'VIDEO', muted: false, encryption: 'GCM' };
  f.provider.rooms.get(alice.admission.room)[0].tracks.push(screen);
  f.advance(5000); await f.api('alice', base); f.advance(5000);
  await f.api('alice', share + '/stop', 'POST', {}, 403, { 'x-csrf-token': '' });
  await f.api('bob', share + '/stop', 'POST', {}, 404);
  assert.equal((await f.api('alice', share + '/stop', 'POST', {})).result.cleanupPending, false);
  assert.equal((await f.api('alice', '/api/voice/current')).result.admission.state, 'active');
  await f.api('alice', share + '/start', 'POST', { requestId: randomUUID(), withAudio: false });
  f.provider.rooms.get(alice.admission.room)[0].tracks.push(screen);
  f.advance(5000); await f.api('alice', base); f.advance(5000);
  await f.api('alice', base + '/policy', 'PATCH', { revision: 0, screenShareEnabled: false });
  assert.equal((await f.api('alice', '/api/voice/current')).result.admission.state, 'active');
  assert.equal(f.provider.removals.length, 0);
  assert.deepEqual(f.provider.rooms.get(alice.admission.room)[0].tracks.map(track => track.source), ['MICROPHONE']);
});

test('key delivery refuses a non-HTTPS public workspace even with a valid session and CSRF', async t => {
  const f = await secureHttpFixture(t), joined = await f.join(); f.integration.origin = 'http://workspace.example.test';
  await f.api('alice', `/api/voice/${joined.admission.id}/encryption/key`, 'POST', {}, 403, { Origin: f.integration.origin });
  assert.equal(f.provider.issued.length, 0);
});

test('HTTP call invitations accept consent without bypassing the all-participant encryption barrier', async t => {
  const f = await secureHttpFixture(t), alice = await f.connected();
  const invitation = (await f.api('alice', `/api/channels/${f.room.id}/voice/invitations`, 'POST', { requestId: randomUUID(), recipientId: f.bob.user.id }, 201)).result.invitation;
  const requestId = randomUUID();
  await f.api('bob', `/api/voice/invitations/${invitation.id}/accept`, 'POST', { requestId }, 426);
  assert.equal((await f.api('bob', `/api/voice/invitations/${invitation.id}`)).result.invitation.state, 'pending');
  const bob = (await f.api('bob', `/api/voice/invitations/${invitation.id}/accept`, 'POST', { requestId, client: secureClient })).result;
  assert.equal(bob.invitation.state, 'accepted'); assert.equal(bob.admission.token, null);
  assert.equal((await f.ack(bob, 'bob')).admission.token, null);
  assert.ok((await f.ack(alice)).admission.token);
  assert.ok((await f.api('bob', `/api/voice/${bob.admission.id}/resume`, 'POST', {})).result.admission.token);
});

test('HTTP screen policy separates camera, screen video and tab audio; revoked sharing preserves audio when cleanup is confirmed', async t => {
  const f = await secureHttpFixture(t), alice = await f.connected(), path = `/api/voice/${alice.admission.id}/share`;
  await f.api('alice', path + '/start', 'POST', { requestId: randomUUID(), withAudio: false }, 403, { 'x-csrf-token': '' });
  await f.api('bob', path + '/start', 'POST', { requestId: randomUUID(), withAudio: false }, 404);
  await f.api('alice', path + '/start', 'POST', { requestId: randomUUID(), withAudio: true }, 403);
  await f.api('alice', `/api/channels/${f.room.id}/voice/policy`, 'PATCH', { revision: 0, screenAudioAllowed: true });
  const started = (await f.api('alice', path + '/start', 'POST', { requestId: randomUUID(), withAudio: true })).result;
  assert.equal(started.share.withAudio, true); assert.equal(f.provider.updates.at(-1).permissions.shareAudio, true);
  const actor = f.provider.rooms.get(alice.admission.room)[0]; actor.tracks.push({ source: 'SCREEN_SHARE', type: 'VIDEO', encryption: 'GCM' }, { source: 'SCREEN_SHARE_AUDIO', type: 'AUDIO', encryption: 'GCM' });
  f.advance(5000); await f.api('alice', `/api/channels/${f.room.id}/voice`);
  await f.api('alice', `/api/channels/${f.room.id}/voice/policy`, 'PATCH', { revision: 1, screenShareEnabled: false });
  const state = (await f.api('alice', '/api/voice/current')).result.admission;
  assert.equal(state.state, 'active'); assert.equal(state.share, null); assert.equal(f.provider.updates.at(-1).permissions.canShare, false);
});

test('HTTP viewers can prepare encrypted listening when allowed but cannot share; deactivation revokes keys', async t => {
  const f = await secureHttpFixture(t), channel = (await f.api('alice', '/api/channels', 'POST', { name: '암호화 청취', category: 'generic' }, 201)).result.channel;
  await f.api('alice', `/api/channels/${channel.id}/voice/policy`, 'PATCH', { revision: 0, viewerCanJoin: true });
  const reader = await f.connected('reader', channel.id); assert.equal(reader.admission.canSpeak, false);
  await f.api('reader', `/api/voice/${reader.admission.id}/share/start`, 'POST', { requestId: randomUUID(), withAudio: false }, 403);
  f.users.find(row => row.id === 'reader').active = false; f.app.disconnectRevoked();
  await f.api('reader', `/api/voice/${reader.admission.id}/encryption/key`, 'POST', {}, 401);
  await f.api('alice', `/api/channels/${channel.id}/voice`);
  assert.ok(f.provider.removals.some(row => row.identity === reader.admission.id));
});

test('provider screen grants never include camera/data, and permission downgrade uses Cloud UpdateParticipant', async () => {
  const calls = [], provider = createLiveKitVoiceProvider({ url: 'wss://fixture.livekit.cloud', apiKey: 'APItest123', apiSecret: 'synthetic-secret-for-tests-only-123456', fetch: async (url, init) => { calls.push({ url, init }); return new Response('{}'); } });
  const decode = permissions => JSON.parse(Buffer.from(provider.issueToken('room', 'identity', 4, permissions).token.split('.')[1], 'base64url')).video;
  assert.deepEqual(decode({ canSpeak: true, canShare: true, shareAudio: false }).canPublishSources, ['microphone', 'screen_share']);
  assert.deepEqual(decode({ canSpeak: false, canShare: true, shareAudio: true }).canPublishSources, ['screen_share', 'screen_share_audio']);
  assert.deepEqual(decode({ paused: true }).canPublishSources, []); assert.equal(decode({ paused: true }).canSubscribe, false);
  assert.equal(decode({ canShare: true }).canPublishData, false);
  assert.deepEqual(decode({ canSpeak: false, canShare: false, shareAudio: true }).canPublishSources, []);
  await provider.updatePermissions('room', 'identity', { canSpeak: true, canShare: false });
  assert.ok(calls[0].url.endsWith('/UpdateParticipant'));
  assert.deepEqual(JSON.parse(calls[0].init.body).permission, { can_subscribe: true, can_publish: true, can_publish_data: false, can_publish_sources: ['MICROPHONE'], can_update_metadata: false });
});

test('provider normalizes encryption metadata and keeps content/names out of screen observations', async () => {
  const provider = createLiveKitVoiceProvider({ url: 'wss://fixture.livekit.cloud', apiKey: 'APItest123', apiSecret: 'synthetic-secret-for-tests-only-123456', fetch: async () => new Response(JSON.stringify({ participants: [{ identity: 'opaque-id', sid: 'PA_id', state: 2, name: 'private name', tracks: [{ source: 3, type: 1, encryption: 1, width: 1280, height: 720, name: 'private window title' }] }] })) });
  const result = await provider.listParticipants('opaque-room');
  assert.equal(result[0].tracks[0].encryption, 'GCM'); assert.equal(result[0].tracks[0].source, 'SCREEN_SHARE');
  assert.equal(JSON.stringify(result).includes('private'), false);
});

async function httpInvitation(t) {
  const f = await httpFixture(t), path = `/api/channels/${f.room.id}/voice`;
  const joined = (await f.api('alice', path + '/join', 'POST', { requestId: randomUUID() })).result;
  const invite = async (overrides = {}, status = 201) => (await f.api('alice', path + '/invitations', 'POST', { requestId: randomUUID(), recipientId: f.bob.user.id, ...overrides }, status)).result;
  return { ...f, path, joined, invite };
}

test('HTTP invitation contract reuses the personal inbox without exposing media tokens or automatically joining', async t => {
  const f = await httpInvitation(t), requestId = randomUUID(), first = await f.invite({ requestId });
  assert.equal((await f.invite({ requestId }, 200)).invitation.id, first.invitation.id);
  const id = first.invitation.id, inbox = (await f.api('bob', '/api/notifications')).result;
  const notice = inbox.items.find(row => row.kind === 'voice_invitation'); assert.ok(notice); assert.equal(notice.id, 'voice:' + id);
  assert.equal(notice.voiceInvitation.alert.soundEnabled, true); assert.equal(f.provider.issued.length, 1);
  assert.equal(JSON.stringify(inbox).includes('synthetic-admission'), false);
  assert.equal(f.app.notificationsForCompanyUser('bob').find(row => row.id === notice.id).expiresAt, first.invitation.expiresAt);
  await f.api('bob', `/api/notifications/${encodeURIComponent(notice.id)}/read`, 'POST', {});
  assert.equal((await f.api('bob', `/api/voice/invitations/${id}`)).result.invitation.state, 'pending');
  assert.equal(f.app.notificationsForCompanyUser('bob').find(row => row.id === notice.id).readAt !== null, true);
  const accepted = (await f.api('bob', `/api/voice/invitations/${id}/accept`, 'POST', { requestId: randomUUID() })).result;
  assert.ok(accepted.admission.token); assert.equal(accepted.invitation.state, 'accepted');
  assert.equal((await f.api('bob', '/api/notifications')).result.items.some(row => row.id === notice.id), false);
  assert.equal(f.app.notificationsForCompanyUser('bob').some(row => row.id === notice.id), false);
  const caller = (await f.api('alice', `/api/voice/invitations/${id}`)).result;
  assert.equal(caller.admission, undefined); assert.equal(JSON.stringify(caller).includes(accepted.admission.token), false);
});

test('HTTP preferences require CSRF and stay personal; viewer preferences do not grant invite permission', async t => {
  const f = await httpInvitation(t);
  await f.api('bob', '/api/voice/preferences', 'PATCH', { revision: 0, doNotDisturb: true }, 403, { 'x-csrf-token': '' });
  await f.api('bob', '/api/voice/preferences', 'PATCH', { revision: 0, doNotDisturb: true }, 403, { Origin: 'https://other.invalid' });
  await f.api('bob', '/api/voice/preferences', 'PATCH', { revision: 0, userId: f.alice.user.id, doNotDisturb: true }, 400);
  await f.api('reader', '/api/voice/preferences', 'PATCH', { revision: 0, callSounds: false });
  await f.api('bob', '/api/voice/preferences', 'PATCH', { revision: 0, doNotDisturb: true });
  assert.equal((await f.api('alice', '/api/voice/preferences')).result.preferences.doNotDisturb, false);
  assert.equal((await f.invite()).invitation.state, 'unavailable');
  assert.equal(f.app.notificationsForCompanyUser('bob').some(row => row.kind === 'voice_invitation'), false);
  await f.api('reader', f.path + '/invitations', 'POST', { requestId: randomUUID(), recipientId: f.alice.user.id }, 403);
  await f.api('bob', '/api/voice/preferences', 'PATCH', { revision: 0, callSounds: false }, 409);
});

test('HTTP outsiders and admins cannot read private invitations, accept for another person or invite across rooms', async t => {
  const f = await httpInvitation(t), first = await f.invite(), id = first.invitation.id;
  for (const actor of ['outsider', 'admin']) {
    await f.api(actor, `/api/voice/invitations/${id}`, 'GET', undefined, 404);
    await f.api(actor, `/api/voice/invitations/${id}/accept`, 'POST', { requestId: randomUUID() }, 404);
    assert.equal((await f.api(actor, '/api/voice/invitations')).result.items.length, 0);
  }
  await f.api('alice', `/api/voice/invitations/${id}/accept`, 'POST', { requestId: randomUUID() }, 404);
  const outsider = (await f.api('outsider', '/api/bootstrap')).result;
  await f.invite({ recipientId: outsider.user.id }, 404);
  await f.api('bob', `/api/voice/invitations/${id}/accept`, 'POST', { requestId: randomUUID() }, 403, { 'x-csrf-token': '' });
});

test('channel mute and personal silent mode suppress invitation delivery using current preferences', async t => {
  const f = await httpInvitation(t);
  await f.api('bob', `/api/channels/${f.room.id}/notifications`, 'PATCH', { mode: 'mute' });
  assert.equal((await f.invite()).invitation.state, 'unavailable');
  // A different call pair exercises silent mode without bypassing pair cooldown.
  const carol = (await f.api('outsider', '/api/bootstrap')).result;
  await f.api('alice', `/api/channels/${f.room.id}/members`, 'POST', { memberIds: [carol.user.id] });
  await f.api('outsider', '/api/voice/preferences', 'PATCH', { revision: 0, callSounds: false });
  const silent = await f.invite({ recipientId: carol.user.id }); assert.equal(silent.invitation.state, 'pending');
  assert.equal(f.app.notificationsForCompanyUser('outsider').some(row => row.kind === 'voice_invitation'), false);
  assert.equal((await f.api('outsider', '/api/notifications')).result.items.some(row => row.kind === 'voice_invitation'), true);
  await f.api('outsider', `/api/channels/${f.room.id}/notifications`, 'PATCH', { mode: 'mute' });
  assert.equal((await f.api('alice', `/api/voice/invitations/${silent.invitation.id}`)).result.invitation.state, 'unavailable');
});

test('HTTP cancel and DND do not wait behind an accepting provider request', async t => {
  const f = await httpInvitation(t), { invitation } = await f.invite(); let release;
  f.provider.gate = new Promise(resolve => { release = resolve; });
  const pending = f.api('bob', `/api/voice/invitations/${invitation.id}/accept`, 'POST', { requestId: randomUUID() }, 409);
  while (f.provider.creates.length < 2) await new Promise(resolve => setImmediate(resolve));
  await f.api('bob', '/api/voice/preferences', 'PATCH', { revision: 0, doNotDisturb: true });
  release(); await pending; assert.equal(f.provider.issued.length, 1);
});

test('HTTP recipient leave and re-invitation fence the old call invitation instead of reviving its alert', async t => {
  const f = await httpInvitation(t), { invitation } = await f.invite();
  await f.api('bob', `/api/channels/${f.room.id}/leave`, 'POST', {});
  await f.api('alice', `/api/channels/${f.room.id}/members`, 'POST', { memberIds: [f.bob.user.id] });
  const state = (await f.api('bob', `/api/voice/invitations/${invitation.id}`)).result.invitation.state;
  assert.notEqual(state, 'pending');
  await f.api('bob', `/api/voice/invitations/${invitation.id}/accept`, 'POST', { requestId: randomUUID() }, 409);
  assert.equal(f.app.notificationsForCompanyUser('bob').some(row => row.kind === 'voice_invitation'), false);
});

test('HTTP caller logout removes outstanding alerts before push discovery', async t => {
  const f = await httpInvitation(t), { invitation } = await f.invite();
  f.sessions.delete('alice-session'); f.app.disconnectRevoked();
  assert.equal(f.app.notificationsForCompanyUser('bob').some(row => row.kind === 'voice_invitation'), false);
  assert.notEqual((await f.api('bob', `/api/voice/invitations/${invitation.id}`)).result.invitation.state, 'pending');
  await f.api('bob', `/api/voice/invitations/${invitation.id}/accept`, 'POST', { requestId: randomUUID() }, 409);
});

test('HTTP room lock invalidates pending invitations while the existing caller remains connected', async t => {
  const f = await httpInvitation(t), { invitation } = await f.invite();
  await f.api('alice', f.path + '/policy', 'PATCH', { revision: 0, locked: true });
  assert.equal((await f.api('bob', `/api/voice/invitations/${invitation.id}`)).result.invitation.state, 'unavailable');
  await f.api('bob', `/api/voice/invitations/${invitation.id}/accept`, 'POST', { requestId: randomUUID() }, 409);
  assert.equal((await f.api('alice', '/api/voice/current')).result.admission.state, 'active');
});

test('reading all notifications preserves consent and a roster rename during accept does not revoke access', async t => {
  const f = await httpInvitation(t), { invitation } = await f.invite();
  await f.api('bob', '/api/notifications/read-all', 'POST', {});
  assert.equal((await f.api('bob', `/api/voice/invitations/${invitation.id}`)).result.invitation.state, 'pending');
  let release; f.provider.gate = new Promise(resolve => { release = resolve; });
  const pending = f.api('bob', `/api/voice/invitations/${invitation.id}/accept`, 'POST', { requestId: randomUUID() });
  while (f.provider.creates.length < 2) await new Promise(resolve => setImmediate(resolve));
  f.users.find(row => row.id === 'outsider').name = '바뀐 표시 이름'; release();
  const accepted = (await pending).result; assert.equal(accepted.invitation.state, 'accepted');
  await f.api('bob', `/api/voice/${accepted.admission.id}/heartbeat`, 'POST', {});
});

test('disabled invitation and preference routes fail closed without creating voice tables', async t => {
  const f = await httpFixture(t, false);
  await f.api('alice', '/api/voice/preferences', 'PATCH', { revision: 0, doNotDisturb: true }, 503);
  assert.equal((await f.api('alice', '/api/voice/invitations')).result.items.length, 0);
  await f.api('alice', `/api/voice/invitations/${randomUUID()}/cancel`, 'POST', {}, 503);
  assert.equal(f.app.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'voice_%'").get().n, 0);
});

test('integrated HTTP routes reuse company CSRF and selected-room permissions and never expose tokens in state', async t => {
  const f = await httpFixture(t);
  assert.equal(f.alice.voice.enabled, true);
  await f.api('outsider', `/api/channels/${f.room.id}/voice`, 'GET', undefined, 404);
  await f.api('reader', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() }, 404);
  await f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() }, 403, { 'x-csrf-token': 'wrong' });
  await f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID(), room: 'forged' }, 400);
  await f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: 'invalid' }, 400);
  const self = f.alice.channels.find(row => row.kind === 'self');
  await f.api('alice', `/api/channels/${self.id}/voice/join`, 'POST', { requestId: randomUUID() }, 400);
  const { response, result } = await f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const state = (await f.api('bob', `/api/channels/${f.room.id}/voice`)).result;
  assert.equal(state.call.reservations.length, 1); assert.equal(state.admission, undefined); assert.equal(JSON.stringify(state).includes(result.admission.token), false);
  await f.api('bob', `/api/voice/${result.admission.id}/leave`, 'POST', {}, 404);
  await f.api('alice', `/api/voice/${result.admission.id}/heartbeat`, 'POST', {});
  f.sessions.delete('alice-session'); f.app.disconnectRevoked();
  await f.api('bob', `/api/channels/${f.room.id}/voice`);
  assert.ok(f.provider.removals.some(row => row.identity === result.admission.id));
});

test('room departure, company role downgrade, and permissions lost while awaiting media setup revoke admission', async t => {
  const f = await httpFixture(t), first = (await f.api('bob', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() })).result;
  await f.api('bob', `/api/channels/${f.room.id}/leave`, 'POST', {});
  await f.api('alice', `/api/channels/${f.room.id}/voice`);
  assert.ok(f.provider.removals.some(row => row.identity === first.admission.id));
  const second = (await f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() })).result;
  f.users.find(row => row.id === 'alice').role = 'viewer'; f.app.disconnectRevoked();
  await f.api('alice', `/api/channels/${f.room.id}/voice`);
  assert.ok(f.provider.removals.some(row => row.identity === second.admission.id));
  f.users.find(row => row.id === 'alice').role = 'member';
  let release; f.provider.gate = new Promise(resolve => { release = resolve; });
  const before = f.provider.creates.length, pending = f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() }, 401);
  while (f.provider.creates.length === before) await new Promise(resolve => setImmediate(resolve));
  f.sessions.delete('alice-session'); release(); await pending;
  assert.equal(f.provider.issued.length, 2);
});

test('disabled HTTP feature has no voice tables, provider calls, or admission credentials', async t => {
  const f = await httpFixture(t, false);
  assert.equal(f.alice.voice.enabled, false);
  assert.equal(f.app.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'voice_%'").get().n, 0);
  assert.equal((await f.api('alice', `/api/channels/${f.room.id}/voice`)).result.call, null);
  await f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() }, 503);
  assert.equal(f.provider.creates.length, 0);
});

test('independent company write-permission revocation also removes an existing media admission', async t => {
  const f = await httpFixture(t), first = (await f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() })).result;
  f.users.find(row => row.id === 'alice').canWrite = false;
  await f.api('bob', `/api/channels/${f.room.id}/voice`);
  assert.ok(f.provider.removals.some(row => row.identity === first.admission.id));
});

test('webhook verification requires HS256 issuer, expiration, nbf and the original bytes, with no unsigned fallback', () => {
  const at = 1792200000123, options = { apiKey: 'APItest123', apiSecret: 'synthetic-secret-for-tests-only-123456', now: () => at };
  const event = { id: randomUUID(), event: 'participant_joined', createdAt: 1792200000 }, valid = signEvent(event, at);
  assert.deepEqual(verifyLiveKitWebhook(valid.raw, valid.authorization, options), event);
  assert.deepEqual(verifyLiveKitWebhook(valid.raw, 'Bearer ' + valid.authorization, options), event);
  const invalid = [
    { ...valid, raw: Buffer.concat([valid.raw, Buffer.from(' ')]) }, { ...valid, authorization: undefined },
    { ...valid, authorization: valid.authorization + 'x' }, signEvent(event, at, { exp: undefined }),
    signEvent(event, at, { exp: at / 1000 - 10 }), signEvent(event, at, { nbf: at / 1000 + 60 }),
    signEvent(event, at, { iss: 'another-key' }), signEvent(event, at, { sha256: 'wrong' }),
    signEvent(event, at, {}, { alg: 'none' }), signEvent(event, at, {}, { alg: 'HS512' }),
  ];
  for (const value of invalid) assert.throws(() => verifyLiveKitWebhook(value.raw, value.authorization, options), error => error.status === 401 && error.code === 'VOICE_WEBHOOK_INVALID');
});

test('usage configuration is strict and leaves conservative defaults unchanged unless explicitly configured', () => {
  const credentials = { SYNK_WORKSPACE_VOICE_ENABLED: '1', SYNK_VOICE_LIVEKIT_URL: 'wss://fixture.livekit.cloud', SYNK_VOICE_LIVEKIT_API_KEY: 'APItest123', SYNK_VOICE_LIVEKIT_API_SECRET: 'synthetic-secret-for-tests-only-123456' };
  const value = voiceOptionsFromEnv(credentials);
  assert.equal(value.limits.maxConcurrentParticipants, 4); assert.equal(value.limits.maxSessionSeconds, 7200);
  assert.equal(value.limits.monthlyParticipantMinutes, 1000); assert.equal(value.limits.monthlyDownstreamBytes, 1000000000);
  for (const bad of ['0', '1.5', 'NaN', '-1', '17']) assert.throws(() => voiceOptionsFromEnv({ ...credentials, SYNK_VOICE_MAX_PARTICIPANTS: bad }));
  assert.throws(() => voiceOptionsFromEnv({ ...credentials, SYNK_VOICE_MONTHLY_PARTICIPANT_MINUTES: '' }));
});

test('provider normalizes media states, drops metadata and separates listen-only grants', async () => {
  let response = { participants: [{ identity: 'opaque', sid: 'PA_test', state: 2, name: 'must-not-return', metadata: 'private', tracks: [{ source: 2, type: 0, muted: true }] }] };
  const provider = createLiveKitVoiceProvider({ url: 'wss://fixture.livekit.cloud', apiKey: 'APItest123', apiSecret: 'synthetic-secret-for-tests-only-123456', fetch: async () => Response.json(response) });
  assert.deepEqual(await provider.listParticipants('room'), [{ identity: 'opaque', sid: 'PA_test', state: 'ACTIVE', tracks: [{ source: 'MICROPHONE', type: 'AUDIO', muted: true }] }]);
  const token = provider.issueToken('room', 'opaque', 2, { canSpeak: false }).token;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
  assert.equal(claims.video.canPublish, false); assert.equal(claims.video.canSubscribe, true); assert.deepEqual(claims.video.canPublishSources, []);
  response = { participants: [{ identity: 'opaque', sid: 'PA_test', state: 'MYSTERY' }] };
  await assert.rejects(provider.listParticipants('room'), error => error.code === 'VOICE_PROVIDER_UNAVAILABLE');
});

test('only an authenticated not_found room lookup becomes an empty snapshot', async () => {
  for (const [status, value, expected] of [[404, { code: 'not_found' }, true], [404, {}, false], [500, { code: 'not_found' }, false], [302, {}, false]]) {
    const provider = createLiveKitVoiceProvider({ url: 'wss://fixture.livekit.cloud', apiKey: 'APItest123', apiSecret: 'synthetic-secret-for-tests-only-123456', fetch: async () => Response.json(value, { status }) });
    if (expected) assert.deepEqual(await provider.listParticipants('room'), []);
    else await assert.rejects(provider.listParticipants('room'), error => error.status === 503);
  }
});

test('reservation and signal connection never masquerade as active media; missing webhooks recover by polling', async t => {
  const f = serviceFixture(t); f.provider.autoConnect = false;
  const result = await f.service.join(f.admission()), room = result.admission.room;
  assert.equal(result.call.reservations.length, 1); assert.deepEqual(result.call.participants, []);
  f.provider.rooms.set(room, [{ identity: result.admission.id, sid: 'PA_signal', state: 'JOINED', tracks: [] }]);
  await f.service.sweep(); assert.deepEqual(f.service.channelState('room-a').call.participants, []);
  f.advance(5000); f.provider.rooms.set(room, [{ identity: result.admission.id, sid: 'PA_media', state: 'ACTIVE', tracks: [{ source: 'MICROPHONE', type: 'AUDIO', muted: true }] }]);
  await f.service.sweep(); const state = f.service.channelState('room-a');
  assert.equal(state.call.participants.length, 1); assert.equal(state.call.participants[0].microphone.muted, true);
  assert.equal(state.call.sync.status, 'current'); assert.equal(state.call.reservations[0].mediaState, 'connected');
  assert.equal(JSON.stringify(state).includes('PA_media'), false); assert.equal(JSON.stringify(state).includes('session'), false);
});

test('LiveKit prefixed event IDs and protobuf numeric timestamps are accepted without normalizing provider IDs', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission());
  const event = { ...mediaEvent(result, f.stamp), id: 'EV_AbCdEf123456', createdAt: String(Math.floor(f.stamp / 1000)) };
  const signed = signEvent(event, f.stamp);
  assert.deepEqual(await f.service.webhook(signed.raw, signed.authorization), { accepted: true });
  assert.equal(f.db.prepare('SELECT id FROM voice_webhook_events').get().id, event.id);
  const lists = f.provider.lists.length;
  await f.service.webhook(signed.raw, signed.authorization);
  assert.equal(f.provider.lists.length, lists);
  const changed = signEvent({ ...event, event: 'participant_left' }, f.stamp);
  await assert.rejects(f.service.webhook(changed.raw, changed.authorization), error => error.code === 'VOICE_WEBHOOK_CONFLICT');
  for (const id of ['', 'EV_bad/id', 'x'.repeat(129), null, {}]) {
    const invalid = signEvent({ ...event, id }, f.stamp);
    await assert.rejects(f.service.webhook(invalid.raw, invalid.authorization), error => error.status === 400 && error.code === 'VOICE_WEBHOOK_EVENT_INVALID');
  }
  await assert.rejects(f.service.webhook(signed.raw, 'forged'), error => error.status === 401);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_webhook_events').get().n, 1);
});

test('delayed join/leave webhooks are idempotent hints and cannot resurrect or disconnect current media', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission());
  const oldLeave = signEvent(mediaEvent(result, f.stamp, 'participant_left'), f.stamp);
  await f.service.webhook(oldLeave.raw, oldLeave.authorization);
  assert.equal(f.service.channelState('room-a').call.participants.length, 1);
  const lists = f.provider.lists.length;
  await f.service.webhook(oldLeave.raw, oldLeave.authorization); assert.equal(f.provider.lists.length, lists);
  const changed = signEvent({ ...JSON.parse(oldLeave.raw), event: 'participant_joined' }, f.stamp);
  await assert.rejects(f.service.webhook(changed.raw, changed.authorization), error => error.code === 'VOICE_WEBHOOK_CONFLICT');
  await f.service.leave({ id: result.admission.id, userId: 'alice', token: 'alice-session' });
  const newCall = await f.service.join(f.admission());
  const lateJoin = signEvent(mediaEvent(result, f.stamp, 'participant_joined'), f.stamp);
  await f.service.webhook(lateJoin.raw, lateJoin.authorization);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM voice_admissions WHERE state='active'").get().n, 1);
  assert.equal(f.service.current('alice', 'alice-session').admission.id, newCall.admission.id);
});

test('unknown rooms, mismatched room generations and invalid signatures do not modify media state', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission());
  f.db.prepare('UPDATE voice_calls SET provider_room_sid=? WHERE id=?').run('RM_expected', result.call.id);
  const signed = signEvent(mediaEvent(result, f.stamp), f.stamp), count = f.provider.lists.length;
  assert.deepEqual(await f.service.webhook(signed.raw, signed.authorization), { accepted: true });
  assert.equal(f.provider.lists.length, count); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_webhook_events').get().n, 0);
  await assert.rejects(f.service.webhook(signed.raw, 'forged'), error => error.status === 401);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_webhook_events').get().n, 0);
});

test('network recovery reuses the admission without extending its grace or maximum session', async t => {
  const f = serviceFixture(t), input = f.admission(), result = await f.service.join(input);
  await f.service.sweep(); f.provider.autoConnect = false; f.provider.rooms.set(result.admission.room, []);
  f.advance(5000); await f.service.sweep();
  const deadline = f.db.prepare('SELECT deadline_at FROM voice_admissions WHERE id=?').get(result.admission.id).deadline_at;
  assert.equal(f.service.current('alice', input.token).admission.mediaState, 'reconnecting');
  const recovered = await f.service.resume({ id: result.admission.id, userId: 'alice', token: input.token });
  assert.equal(recovered.admission.id, result.admission.id); assert.equal(recovered.admission.sessionEndsAt, result.admission.sessionEndsAt);
  assert.equal(f.db.prepare('SELECT deadline_at FROM voice_admissions WHERE id=?').get(result.admission.id).deadline_at, deadline);
  await assert.rejects(f.service.resume({ id: result.admission.id, userId: 'bob', token: 'bob-session' }), error => error.status === 404);
  f.advance(5000); f.provider.rooms.set(result.admission.room, [{ identity: result.admission.id, sid: 'PA_new_transport', state: 'ACTIVE', tracks: [] }]);
  await f.service.sweep(); assert.equal(f.service.current('alice', input.token).admission.mediaState, 'connected');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_admissions').get().n, 1);
});

test('heartbeats cannot keep unconnected or missing media alive past a fixed deadline', async t => {
  const f = serviceFixture(t, { limits: { maxSessionSeconds: 60 } }); f.provider.autoConnect = false;
  const result = await f.service.join(f.admission()), own = { id: result.admission.id, userId: 'alice', token: 'alice-session' };
  assert.equal(result.admission.leaseExpiresAt, result.admission.sessionEndsAt);
  f.advance(20000); await f.service.heartbeat(own);
  f.advance(25000); await f.service.sweep();
  assert.equal(f.service.current('alice', own.token).admission.reason, 'connect_timeout');
  await assert.rejects(f.service.resume(own), error => error.status === 410);
  f.provider.autoConnect = true; const second = await f.service.join(f.admission()); await f.service.sweep();
  f.provider.rooms.set(second.admission.room, []); f.advance(5000); await f.service.sweep();
  f.advance(30000); await f.service.sweep();
  assert.equal(f.service.current('alice', own.token).admission.reason, 'reconnect_timeout');
});

test('a final provider snapshot sees media recovered between ticks at the reconnect deadline', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission()); await f.service.sweep();
  const original = f.provider.rooms.get(result.admission.room);
  f.provider.rooms.set(result.admission.room, []); f.advance(5000); await f.service.sweep();
  f.advance(30000); f.provider.rooms.set(result.admission.room, original); await f.service.sweep();
  assert.equal(f.service.current('alice', 'alice-session').admission.mediaState, 'connected');
  assert.equal(f.provider.removals.length, 0);
});

test('provider outages expose uncertainty and recover before the grace instead of claiming an empty call', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission()); await f.service.sweep();
  f.provider.failList = true; f.advance(5000); await f.service.sweep();
  const down = f.service.channelState('room-a'); assert.equal(down.call.sync.status, 'unavailable'); assert.deepEqual(down.call.participants, []);
  f.advance(10000); f.provider.failList = false; await f.service.sweep();
  assert.equal(f.service.channelState('room-a').call.participants.length, 1);
  assert.equal(f.provider.removals.length, 0); assert.equal(f.service.current('alice', 'alice-session').admission.id, result.admission.id);
});

test('prolonged state outage ends the admission and preserves a failed remote revocation', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission()); await f.service.sweep();
  f.provider.failList = true; f.provider.failRemove = true; f.advance(5000); await f.service.sweep();
  f.advance(30000); await f.service.sweep();
  const state = f.service.current('alice', 'alice-session').admission;
  assert.equal(state.state, 'revoking'); assert.equal(state.reason, 'reconnect_timeout');
  await assert.rejects(f.service.resume({ id: result.admission.id, userId: 'alice', token: 'alice-session' }), error => error.status === 410);
  await assert.rejects(f.service.join(f.admission('bob')), error => error.code === 'VOICE_CLEANUP_PENDING');
  assert.equal(f.service.channelState('room-a').call.cleanupPending, true);
});

test('revocation while provider state lookup awaits cannot re-authorize an old session', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission()); let release;
  f.provider.listGate = new Promise(resolve => { release = resolve; });
  const pending = f.service.sweep(); while (!f.provider.lists.length) await new Promise(resolve => setImmediate(resolve));
  f.deny(); release(); await pending;
  assert.equal(f.service.current('alice', 'alice-session').admission.state, 'ended');
  assert.ok(f.provider.removals.some(row => row.identity === result.admission.id));
});

test('unadmitted participants are durably revoked and block fresh grants while cleanup is uncertain', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission()), rogue = randomUUID();
  f.provider.rooms.get(result.admission.room).push({ identity: rogue, sid: 'PA_rogue', state: 'ACTIVE', tracks: [] });
  f.provider.failRemove = true; await f.service.sweep();
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_orphans').get().n, 1);
  await assert.rejects(f.service.join(f.admission('bob')), error => error.code === 'VOICE_CLEANUP_PENDING');
  f.restart(); f.provider.failRemove = false; f.advance(15000); await f.service.sweep();
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM voice_orphans').get().n, 0);
  assert.ok(f.provider.removals.some(row => row.identity === rogue));
});

test('listen-only admissions and microphone source grants cannot be bypassed by published media', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission('alice', 'room-a', { check: () => ({ canJoin: true, canRemain: true, canSpeak: false }) }));
  assert.equal(f.provider.issued[0].permissions.canSpeak, false);
  f.provider.rooms.get(result.admission.room)[0].tracks = [{ source: 'MICROPHONE', type: 'AUDIO', muted: false }];
  await f.service.sweep(); assert.equal(f.service.current('alice', 'alice-session').admission.reason, 'media_permission_violation');
  const second = await f.service.join(f.admission('bob'));
  f.provider.rooms.get(second.admission.room)[0].tracks = [{ source: 'SCREEN_SHARE', type: 'VIDEO', muted: false }];
  await f.service.sweep(); assert.equal(f.service.current('bob', 'bob-session').admission.reason, 'media_permission_violation');
});

test('usage separates observed and unverified time, persists through restart, and retains aggregate estimates', async t => {
  const f = serviceFixture(t), result = await f.service.join(f.admission()); await f.service.sweep();
  f.advance(10000); await f.service.sweep();
  f.provider.failRemove = true; await f.service.leave({ id: result.admission.id, userId: 'alice', token: 'alice-session' });
  f.advance(10000); const before = (await f.service.usage()).totals;
  assert.equal(before.participantMinutes, 20000 / 60000); assert.equal(before.observedParticipantMinutes, 10000 / 60000); assert.equal(before.unverifiedParticipantMinutes, 10000 / 60000);
  assert.equal(before.providerBillingVerified, false); assert.equal(before.source, 'application-estimate');
  f.restart(); f.advance(10000); const after = (await f.service.usage()).totals;
  assert.equal(after.participantMinutes, 0.5); assert.equal(after.unverifiedParticipantMinutes, 20000 / 60000);
  assert.equal(JSON.stringify(after).includes('alice'), false); assert.equal(JSON.stringify(after).includes(result.admission.id), false);
});

test('the original admission schema migrates without trusting a persisted session or losing outstanding time', async t => {
  const db = new DatabaseSync(':memory:'), stamp = 1792200000000, id = randomUUID(), callId = randomUUID(), token = 'old-session';
  db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE channels(id TEXT PRIMARY KEY); CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO channels VALUES('room'); INSERT INTO users VALUES('alice');
    CREATE TABLE voice_calls(id TEXT PRIMARY KEY,channel_id TEXT NOT NULL REFERENCES channels(id),room_name TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,ended_at INTEGER);
    CREATE TABLE voice_admissions(id TEXT PRIMARY KEY,call_id TEXT NOT NULL REFERENCES voice_calls(id),user_id TEXT NOT NULL REFERENCES users(id),session_key TEXT NOT NULL,request_id TEXT NOT NULL,joined_at INTEGER NOT NULL,lease_until INTEGER NOT NULL,state TEXT NOT NULL,token_issued INTEGER NOT NULL DEFAULT 0,ended_at INTEGER,next_attempt_at INTEGER NOT NULL DEFAULT 0);`);
  db.prepare('INSERT INTO voice_calls VALUES(?,?,?,?,NULL)').run(callId, 'room', 'synk-work-' + callId, stamp - 30000);
  db.prepare("INSERT INTO voice_admissions VALUES(?,?,?,?,?,?,?,'active',1,NULL,0)").run(id, callId, 'alice', createHash('sha256').update(token).digest('hex'), randomUUID(), stamp - 30000, stamp + 45000);
  const provider = fakeProvider(); provider.now = () => stamp;
  const service = createVoiceService({ db, assert: check, validateRequestId: uuid, publish() {}, enabled: true, e2eeRequired: false, provider, automaticSweep: false, now: () => stamp });
  t.after(async () => { await service.close(); db.close(); });
  assert.equal(service.current('alice', token).admission.reason, 'server_restarted');
  await service.sweep(); assert.ok(provider.removals.some(row => row.identity === id));
  const totals = (await service.usage()).totals;
  assert.equal(totals.participantMinutes, 0.5); assert.equal(totals.observedParticipantMinutes, 0); assert.equal(totals.unverifiedParticipantMinutes, 0.5);
  await assert.rejects(service.resume({ id, userId: 'alice', token }), error => error.status === 410);
});

test('UTC month boundaries split seat time and a fresh month does not erase historical usage', async t => {
  const f = serviceFixture(t);
  f.advance(Date.parse('2026-11-01T00:00:00Z') - f.stamp - 10000);
  await f.service.join(f.admission()); await f.service.sweep(); f.advance(20000); await f.service.sweep();
  const rows = f.db.prepare('SELECT * FROM voice_usage_months ORDER BY month').all();
  assert.deepEqual(rows.map(row => [row.month, row.reserved_ms]), [['2026-10', 10000], ['2026-11', 10000]]);
  assert.equal((await f.service.usage()).totals.timezone, 'UTC');
});

test('monthly seat-time budget revokes active tokens and blocks a new admission', async t => {
  const f = serviceFixture(t, { limits: { monthlyParticipantMinutes: 1 } }), result = await f.service.join(f.admission()); await f.service.sweep();
  f.advance(30000); await f.service.heartbeat({ id: result.admission.id, userId: 'alice', token: 'alice-session' });
  f.advance(30000); await f.service.sweep();
  assert.equal(f.service.current('alice', 'alice-session').admission.reason, 'usage_limit');
  await assert.rejects(f.service.join(f.admission('bob')), error => error.code === 'VOICE_USAGE_LIMIT');
  assert.equal((await f.service.usage()).totals.exhausted, true);
});

test('usage reports deduplicate, reject counter rollback, and never authenticate media presence', async t => {
  const f = serviceFixture(t); f.provider.autoConnect = false;
  const result = await f.service.join(f.admission()), own = { id: result.admission.id, userId: 'alice', token: 'alice-session' };
  const input = { connectionId: randomUUID(), sequence: 1, bytesSent: 4000, bytesReceived: 8000 };
  await f.service.reportUsage({ ...own, input }); await f.service.reportUsage({ ...own, input });
  assert.equal((await f.service.usage()).totals.clientReportedReceivedBytes, 8000);
  assert.deepEqual(f.service.channelState('room-a').call.participants, []);
  await assert.rejects(f.service.reportUsage({ ...own, input: { ...input, bytesReceived: 0 } }), error => error.code === 'VOICE_USAGE_CONFLICT');
  await assert.rejects(f.service.reportUsage({ ...own, input: { ...input, sequence: 2, bytesReceived: 0 } }), error => error.code === 'VOICE_USAGE_COUNTER_RESET');
  await assert.rejects(f.service.reportUsage({ ...own, input: { ...input, sequence: 2, connected: true } }), error => error.status === 400);
  await assert.rejects(f.service.reportUsage({ ...own, userId: 'bob', token: 'bob-session', input }), error => error.status === 404);
  await f.service.leave(own); f.restart(); assert.equal((await f.service.usage()).totals.clientReportedReceivedBytes, 8000);
});

test('downstream budget uses the larger of reservation estimate and client reports, not a sum', async t => {
  const f = serviceFixture(t, { limits: { monthlyDownstreamBytes: 100000 } });
  const result = await f.service.join(f.admission()); await f.service.join(f.admission('bob')); await f.service.sweep();
  f.advance(5000); await f.service.sweep();
  const usage = (await f.service.usage()).totals;
  assert.equal(usage.estimatedDownstreamBytes, 80000); assert.equal(usage.exhausted, false);
  await f.service.reportUsage({ id: result.admission.id, userId: 'alice', token: 'alice-session', input: { connectionId: randomUUID(), sequence: 1, bytesSent: 0, bytesReceived: 110000 } });
  assert.equal((await f.service.usage()).totals.exhausted, true);
  assert.equal(f.service.current('alice', 'alice-session').admission.reason, 'usage_limit');
});

test('room policy has revision checks and no administrator bypass into a private room', async t => {
  const f = await httpFixture(t), path = `/api/channels/${f.room.id}/voice`;
  assert.equal((await f.api('alice', path)).result.permissions.canModerate, true);
  await f.api('admin', path, 'GET', undefined, 404);
  await f.api('bob', path + '/policy', 'PATCH', { revision: 0, locked: true }, 403);
  await f.api('alice', path + '/policy', 'PATCH', { revision: 0, locked: true }, 403, { 'x-csrf-token': 'wrong' });
  const bob = (await f.api('bob', path + '/join', 'POST', { requestId: randomUUID() })).result;
  await f.api('alice', path + '/policy', 'PATCH', { revision: 0, locked: true });
  await f.api('alice', path + '/join', 'POST', { requestId: randomUUID() }, 403);
  await f.api('bob', `/api/voice/${bob.admission.id}/heartbeat`, 'POST', {});
  await f.api('alice', path + '/policy', 'PATCH', { revision: 0, locked: false }, 409);
  await f.api('alice', path + '/policy', 'PATCH', { revision: 1, locked: false, memberCanSpeak: false });
  assert.ok(f.provider.removals.some(row => row.identity === bob.admission.id));
  const listener = (await f.api('bob', path + '/join', 'POST', { requestId: randomUUID() })).result;
  assert.equal(listener.admission.canSpeak, false); assert.equal(listener.permissions.canSpeak, false);
  const audit = (await f.api('alice', path + '/audit')).result.items;
  assert.ok(audit.some(row => row.action === 'policy_changed')); await f.api('bob', path + '/audit', 'GET', undefined, 403);
});

test('viewers can only listen after explicit room opt-in and lose access on deactivation', async t => {
  const f = await httpFixture(t), room = (await f.api('alice', '/api/channels', 'POST', { name: '청취 시험', category: 'generic' }, 201)).result.channel;
  const path = `/api/channels/${room.id}/voice`;
  await f.api('reader', path + '/join', 'POST', { requestId: randomUUID() }, 403);
  await f.api('alice', path + '/policy', 'PATCH', { revision: 0, viewerCanJoin: true });
  const result = (await f.api('reader', path + '/join', 'POST', { requestId: randomUUID() })).result;
  assert.equal(result.admission.canSpeak, false); assert.equal(f.provider.issued.at(-1).permissions.canSpeak, false);
  await f.api('reader', `/api/voice/${result.admission.id}/heartbeat`, 'POST', {});
  await f.api('reader', path + '/policy', 'PATCH', { revision: 1, memberCanSpeak: true }, 403);
  f.users.find(user => user.id === 'reader').active = false; f.app.disconnectRevoked(); await f.api('alice', path);
  assert.ok(f.provider.removals.some(row => row.identity === result.admission.id));
});

test('per-room capacity is separate from global capacity and active seats prevent unsafe shrinking', async t => {
  const f = await httpFixture(t), path = `/api/channels/${f.room.id}/voice`;
  await f.api('alice', path + '/policy', 'PATCH', { revision: 0, maxParticipants: 1 });
  const first = (await f.api('alice', path + '/join', 'POST', { requestId: randomUUID() })).result;
  await f.api('bob', path + '/join', 'POST', { requestId: randomUUID() }, 409);
  await f.api('alice', path + '/policy', 'PATCH', { revision: 1, maxParticipants: 2 });
  await f.api('bob', path + '/join', 'POST', { requestId: randomUUID() });
  await f.api('alice', path + '/policy', 'PATCH', { revision: 2, maxParticipants: 1 }, 409);
  await f.api('alice', path + '/policy', 'PATCH', { revision: 2, enabled: false });
  assert.ok(f.provider.removals.some(row => row.identity === first.admission.id));
  await f.api('alice', path + '/join', 'POST', { requestId: randomUUID() }, 403);
});

test('provider HTTP callback is isolated from cookie APIs and never leaks tokens through state or usage', async t => {
  const f = await httpFixture(t), result = (await f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() })).result;
  const signed = signEvent(mediaEvent(result, Date.now()));
  const sendHook = authorization => fetch(f.origin + '/messenger/api/voice/webhook', { method: 'POST', headers: { 'Content-Type': 'application/webhook+json', ...(authorization ? { Authorization: authorization } : {}) }, body: signed.raw });
  assert.equal((await sendHook()).status, 401);
  const response = await sendHook(signed.authorization); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { accepted: true });
  const state = (await f.api('bob', `/api/channels/${f.room.id}/voice`)).result;
  assert.equal(state.call.participants.length, 1); assert.equal(JSON.stringify(state).includes(result.admission.token), false);
  await f.api('alice', '/api/voice/usage', 'GET', undefined, 403);
  const usage = (await f.api('admin', '/api/voice/usage')).result;
  assert.equal(usage.totals.providerBillingVerified, false); assert.equal(JSON.stringify(usage).includes(result.admission.id), false);
  const noCookie = await fetch(f.origin + `/messenger/api/channels/${f.room.id}/voice/join`, { method: 'POST', headers: { Authorization: signed.authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID() }) });
  assert.equal(noCookie.status, 401);
  const current = (await f.api('alice', '/api/voice/current')).result;
  assert.equal(current.admission.id, result.admission.id); assert.equal(JSON.stringify(current).includes(result.admission.token), false);
  await f.api('bob', `/api/voice/${result.admission.id}/resume`, 'POST', {}, 404);
  await f.api('alice', `/api/voice/${result.admission.id}/resume`, 'POST', {}, 403, { 'x-csrf-token': 'wrong' });
  await f.api('alice', `/api/voice/${result.admission.id}/usage`, 'POST', { connectionId: randomUUID(), sequence: 1, bytesSent: 0, bytesReceived: 0 });
});

test('a roster refresh during provider lookup commits independently without revoking an unchanged participant', async t => {
  const f = await httpFixture(t), path = `/api/channels/${f.room.id}/voice`;
  const result = (await f.api('alice', path + '/join', 'POST', { requestId: randomUUID() })).result;
  let release; f.provider.listGate = new Promise(resolve => { release = resolve; });
  const before = f.provider.lists.length, waiting = f.api('bob', path);
  while (f.provider.lists.length === before) await new Promise(resolve => setImmediate(resolve));
  f.users.find(user => user.id === 'outsider').name = '이름만 변경'; release();
  const state = (await waiting).result;
  assert.equal(state.call.participants.length, 1);
  assert.equal(state.call.participants[0].userId, f.alice.user.id);
  assert.equal(f.provider.removals.some(row => row.identity === result.admission.id), false);
});

test('delete-and-restore lifecycle changes while room creation waits cannot return a usable admission', async t => {
  const f = await httpFixture(t); let release;
  f.provider.gate = new Promise(resolve => { release = resolve; });
  const pending = f.api('alice', `/api/channels/${f.room.id}/voice/join`, 'POST', { requestId: randomUUID() }, 409);
  while (!f.provider.creates.length) await new Promise(resolve => setImmediate(resolve));
  f.app.db.prepare('UPDATE channels SET lifecycle_version=lifecycle_version+2 WHERE id=?').run(f.room.id);
  release(); await pending;
  assert.equal(f.provider.issued.length, 0);
});
