import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createMessenger } from '../server.mjs';
import { VOICE_PROTOCOL, callParticipants, createVoice, e2eeProof, pendingIncoming, publishAllowed, roomCallSummary, voiceSupportProblem } from '../public/voice.js';

const ME = '11111111-1111-4111-8111-111111111111', PEER = '22222222-2222-4222-8222-222222222222', CHANNEL = 'c1';

// ── pure rules ─────────────────────────────────────────────────
test('ACK proof is base64url HMAC-SHA256 of the context keyed by the exact key string', async () => {
  const key = createHmac('sha256', 'seed').update('k').digest('base64url'), context = `${VOICE_PROTOCOL}|call|epoch|admission|challenge`;
  assert.equal(await e2eeProof(key, context), createHmac('sha256', key).update(context).digest('base64url'));
  assert.match(await e2eeProof(key, context), /^[A-Za-z0-9_-]{43}$/);
});

test('support check refuses insecure contexts and browsers without insertable streams or script transforms', () => {
  const sender = function () {}; sender.prototype.createEncodedStreams = () => {};
  const ok = { isSecureContext: true, navigator: { mediaDevices: { getUserMedia() {} } }, RTCPeerConnection: function () {}, RTCRtpSender: sender, Worker: function () {}, crypto: { subtle: {} } };
  assert.equal(voiceSupportProblem(ok), '');
  assert.match(voiceSupportProblem({ ...ok, isSecureContext: false }), /HTTPS/);
  assert.match(voiceSupportProblem({ ...ok, RTCRtpSender: function () {} }), /암호화 통화를 지원하지/);
  assert.equal(voiceSupportProblem({ ...ok, RTCRtpSender: function () {}, RTCRtpScriptTransform: function () {} }), '');
  assert.match(voiceSupportProblem({ ...ok, navigator: {} }), /통화를 지원하지/);
});

test('room labels never turn a stale or failed provider lookup into an empty room', () => {
  assert.deepEqual(roomCallSummary({ call: null }), { state: 'none', label: '통화', count: 0 });
  const seats = [{ userId: ME, mediaState: 'connecting' }, { userId: PEER, mediaState: 'connected' }];
  for (const status of ['pending', 'unavailable']) {
    const summary = roomCallSummary({ call: { sync: { status }, reservations: seats, participants: [] } });
    assert.equal(summary.state, 'unknown'); assert.match(summary.label, /확인 중/); assert.doesNotMatch(summary.label, /0명|없음/);
  }
  assert.equal(roomCallSummary({ call: { sync: { status: 'current' }, reservations: seats, participants: [{ userId: PEER, state: 'connected' }] } }).label, '통화 중 1명');
  assert.equal(roomCallSummary({ call: { sync: { status: 'current' }, reservations: seats, participants: [] } }).label, '통화 연결 중 2명');
});

test('a seat or accepted invitation is not shown as a media connection until the provider observes it', () => {
  const members = [{ id: ME, name: '나' }, { id: PEER, name: '동료' }];
  const base = { reservations: [{ userId: ME, mediaState: 'connecting' }, { userId: PEER, mediaState: 'securing' }], participants: [] };
  const fresh = callParticipants({ ...base, sync: { status: 'current' } }, members, ME, 'securing');
  assert.deepEqual(fresh.map(row => [row.name, row.status]), [['나', 'securing'], ['동료', 'securing']]);
  const stale = callParticipants({ ...base, sync: { status: 'unavailable' }, participants: [{ userId: PEER, state: 'connected', microphone: { published: true, muted: false } }] }, members, ME, null);
  assert.deepEqual(stale.map(row => row.status), ['unknown', 'unknown']);
  const live = callParticipants({ ...base, sync: { status: 'current' }, participants: [{ userId: PEER, state: 'connected', microphone: { published: true, muted: true }, share: { state: 'sharing', admissionId: 'opaque' } }] }, members, ME, null);
  assert.deepEqual(live[1], { userId: PEER, self: false, name: '동료', status: 'connected', muted: true, sharing: true, shareAdmissionId: 'opaque' });
});

test('only current pending invitations to me ring; expired, answered and outgoing ones do not', () => {
  const now = Date.parse('2026-10-17T00:00:00Z'), later = '2026-10-17T00:00:30Z', past = '2026-10-16T23:59:59Z';
  const items = [
    { id: 'a', toUserId: ME, state: 'pending', alert: { id: 'a' }, expiresAt: later, createdAt: past },
    { id: 'b', toUserId: ME, state: 'pending', alert: { id: 'b' }, expiresAt: past, createdAt: past },
    { id: 'c', toUserId: ME, state: 'accepted', expiresAt: later, createdAt: past },
    { id: 'd', toUserId: PEER, fromUserId: ME, state: 'pending', expiresAt: later, createdAt: past },
  ];
  assert.deepEqual(pendingIncoming(items, ME, now).map(item => item.id), ['a']);
});

test('screen publishing waits for the server-granted source in proto or string form', () => {
  assert.equal(publishAllowed({ canPublish: true, canPublishSources: [2] }, 3), false);
  assert.equal(publishAllowed({ canPublish: true, canPublishSources: [2, 3] }, 3), true);
  assert.equal(publishAllowed({ canPublish: true, canPublishSources: ['screen_share'] }, 3), true);
  assert.equal(publishAllowed({ canPublish: false, canPublishSources: [3] }, 3), false);
});

// ── delivery and browser policy ────────────────────────────────
async function messengerFixture(t, voice) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-voice-client-'));
  let app;
  const server = createServer((req, res) => app.handler(req, res));
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const integration = { origin, listUsers: () => [{ id: 'alice', name: 'alice', active: true, role: 'member' }], authenticate: () => null };
  app = createMessenger({ dataDir: directory, port: 0, basePath: '/messenger', integration, driveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) }, backgroundJobsEnabled: false, workNotificationsEnabled: false, voice });
  await app.startMounted();
  t.after(async () => { await app.close(); await new Promise(done => server.close(done)); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true, force: true }); });
  return { get: path => fetch(origin + '/messenger' + path, { signal: AbortSignal.timeout(5000) }) };
}
const provider = { serverUrl: 'wss://fixture.livekit.cloud', async createRoom() {}, issueToken: () => ({ token: 't', expiresAt: null }), async updatePermissions() {}, async removeParticipant() {}, async listParticipants() { return []; }, verifyWebhook() { throw new Error('unused'); } };

test('microphone, screen capture and LiveKit signalling are allowed only while calls are enabled; camera stays blocked', async t => {
  const off = await messengerFixture(t, { enabled: false });
  const closed = await off.get('/');
  assert.equal(closed.headers.get('permissions-policy'), 'camera=(), microphone=(), display-capture=(), geolocation=()');
  assert.match(closed.headers.get('content-security-policy'), /connect-src 'self';/);
  const on = await messengerFixture(t, { enabled: true, e2eeRequired: true, provider, automaticSweep: false });
  const open = await on.get('/');
  assert.equal(open.headers.get('permissions-policy'), 'camera=(), microphone=(self), display-capture=(self), geolocation=()');
  const policy = open.headers.get('content-security-policy');
  assert.match(policy, /connect-src 'self' wss:\/\/\*\.livekit\.cloud https:\/\/\*\.livekit\.cloud;/);
  assert.match(policy, /worker-src 'self'/); assert.match(policy, /script-src 'self';/); assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
  assert.match(policy, /frame-ancestors 'self'/);
});

test('the call module, styles, pinned SDK and E2EE worker are served as same-origin static files', async t => {
  const f = await messengerFixture(t, { enabled: false });
  const html = await (await f.get('/')).text();
  assert.ok(html.indexOf('src="voice.js"') > 0 && html.indexOf('src="voice.js"') < html.indexOf('src="app.js"'));
  assert.match(html, /href="voice.css"/);
  for (const [path, type] of [['/voice.js', 'text/javascript'], ['/voice.css', 'text/css'], ['/vendor/livekit-client/livekit-client.esm.js', 'text/javascript'], ['/vendor/livekit-client/livekit-client.e2ee.worker.js', 'text/javascript']]) {
    const response = await f.get(path); assert.equal(response.status, 200, path); assert.match(response.headers.get('content-type'), new RegExp(type)); await response.arrayBuffer();
  }
  const readme = await readFile(new URL('../public/vendor/livekit-client/README.md', import.meta.url), 'utf8');
  for (const file of ['livekit-client.esm.js', 'livekit-client.e2ee.worker.js']) {
    const digest = createHash('sha256').update(await readFile(new URL(`../public/vendor/livekit-client/${file}`, import.meta.url))).digest('hex');
    assert.ok(readme.includes(digest), `${file} hash recorded`);
  }
});

// ── controller flows with a scripted SDK ───────────────────────
class FakeElement {
  constructor(tag, registry) { Object.assign(this, { tagName: tag, registry, children: [], dataset: {}, style: {}, attributes: {}, listeners: {}, stubs: new Map(), hidden: false, disabled: false, innerHTML: '', textContent: '', parentElement: null, _id: '' }); }
  get id() { return this._id; }
  set id(value) { this._id = value; this.registry.set(value, this); }
  append(child) { child.parentElement = this; this.children.push(child); }
  prepend(child) { child.parentElement = this; this.children.unshift(child); }
  insertAdjacentElement(_, child) { child.parentElement = this; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); if (this._id && this.registry.get(this._id) === this) this.registry.delete(this._id); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  removeEventListener(type, listener) { this.listeners[type] = (this.listeners[type] || []).filter(item => item !== listener); }
  querySelector(selector) { if (!this.stubs.has(selector)) this.stubs.set(selector, new FakeElement('div', new Map())); return this.stubs.get(selector); }
  contains() { return false; }
  focus() {}
  click(action) { for (const listener of this.listeners.click || []) listener({ target: { closest: () => ({ dataset: { voiceAction: action } }) } }); }
}

function environment() {
  const log = [], registry = new Map(), storage = new Map();
  const document = { body: null, activeElement: null, fullscreenElement: null, getElementById: id => registry.get(id) || null, createElement: tag => new FakeElement(tag, registry), querySelector: selector => selector === '.header-actions' ? header : selector === '.main-header' ? mainHeader : null };
  document.body = new FakeElement('body', registry);
  const header = new FakeElement('div', registry), mainHeader = new FakeElement('header', registry);
  const sender = function () {}; sender.prototype.createEncodedStreams = () => {};
  class FakeWorker extends EventEmitter {
    constructor(url) { super(); this.url = String(url); log.push(['worker', this.url.split('/').at(-1)]); }
    addEventListener(type, listener) { this.on(type, listener); }
    removeEventListener(type, listener) { this.off(type, listener); }
    postMessage(message) { if (message.kind === 'init') setTimeout(() => this.emit('message', { data: { kind: 'initAck', data: { enabled: false } } }), 0); }
    terminate() { log.push(['terminate', this.url.split('/').at(-1)]); }
  }
  const saved = {};
  const globals = { document, window: { addEventListener() {} }, isSecureContext: true, Worker: FakeWorker, RTCPeerConnection: function () {}, RTCRtpSender: sender, BroadcastChannel: undefined,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), key: index => [...storage.keys()][index] ?? null, get length() { return storage.size; } },
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }), enumerateDevices: async () => [] } } };
  for (const [key, value] of Object.entries(globals)) { saved[key] = Object.getOwnPropertyDescriptor(globalThis, key); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const restore = () => { for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
  return { log, registry, header, document, restore };
}

function fakeSdk(log, control) {
  const RoomEvent = { ConnectionStateChanged: 'csc', Disconnected: 'disconnected', TrackSubscribed: 'ts', TrackUnsubscribed: 'tu', AudioPlaybackStatusChanged: 'aps', EncryptionError: 'ee', MediaDevicesError: 'mde', LocalTrackUnpublished: 'ltu', ActiveSpeakersChanged: 'asc', ParticipantConnected: 'pc', ParticipantDisconnected: 'pd', TrackMuted: 'tm', TrackUnmuted: 'tun' };
  const ParticipantEvent = { ParticipantPermissionsChanged: 'ppc' };
  const Track = { Source: { Microphone: 'microphone', ScreenShare: 'screen_share', ScreenShareAudio: 'screen_share_audio' } };
  const track = (source, kind = 'audio') => { const media = new EventEmitter(); media.addEventListener = (type, listener) => media.on(type, listener); return { source, kind, mediaStreamTrack: media, stopped: false, stop() { this.stopped = true; log.push(['stop', source]); }, mute: async () => log.push(['mute']), unmute: async () => log.push(['unmute']) }; };
  class LocalParticipant extends EventEmitter {
    constructor() { super(); this.permissions = { canPublish: true, canPublishSources: [2] }; this.identity = ''; }
    async publishTrack(item, options) { log.push(['publish', options.source]); }
    async unpublishTrack(item) { log.push(['unpublish', item.source]); }
    async createScreenTracks(options) { log.push(['pick', Boolean(options.audio)]); if (control.pickError) throw control.pickError; control.screen = [track('screen_share', 'video')]; return control.screen; }
  }
  class Room extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.state = 'disconnected'; this.canPlaybackAudio = true; this.localParticipant = new LocalParticipant(); control.rooms.push(this);
      log.push(['room', Boolean(options.encryption?.keyProvider && options.encryption?.worker)]);
      options.encryption.worker.postMessage({ kind: 'init' });
    }
    async setE2EEEnabled(enabled) { log.push(['e2ee', enabled]); }
    async connect(url, token) { log.push(['connect', token]); if (control.failConnect) { this.emit('disconnected', 0); throw Object.assign(new Error('could not establish signal connection'), { name: 'ConnectionError' }); } this.state = 'connected'; }
    async disconnect() { log.push(['disconnect']); this.state = 'disconnected'; }
    async startAudio() {}
    async switchActiveDevice() {}
  }
  class ExternalE2EEKeyProvider { async setKey(key) { log.push(['setKey', key]); } }
  return { Room, RoomEvent, ParticipantEvent, Track, ExternalE2EEKeyProvider, DisconnectReason: { DUPLICATE_IDENTITY: 2 }, AudioPresets: { speech: {} }, ScreenSharePresets: { h720fps15: { resolution: {}, encoding: {} } },
    version: 'fake', isBrowserSupported: () => true, isE2EESupported: () => true, createLocalAudioTrack: async () => { log.push(['mic']); if (control.micDelay) await new Promise(done => setTimeout(done, control.micDelay)); const created = track('microphone'); control.mics = [...(control.mics || []), created]; return created; } };
}

function controller(t, routes) {
  const env = environment(), control = { rooms: [], screen: null }, posted = [], toasts = [];
  const sdk = fakeSdk(env.log, control);
  const api = async (path, options = {}) => {
    const method = options.method || 'GET', key = `${method} ${path}`;
    env.log.push(['api', key, options.body]);
    const handler = routes[key] || routes[`${method} ${path.replace(/\/[0-9a-f-]{36}(?=\/|$)/g, '/:id')}`];
    if (!handler) throw Object.assign(new Error(`unexpected ${key}`), { status: 599 });
    const result = await handler(options.body, control);
    if (result instanceof Error) throw result;
    return structuredClone(result);
  };
  const voice = createVoice({ api, toast: (message, error) => toasts.push([message, Boolean(error)]), esc: value => String(value ?? ''), openModal() {}, modal: new FakeElement('dialog', new Map()), embedded: true, parentMessage: (type, payload) => posted.push([type, payload]),
    members: () => [{ id: ME, name: '나' }, { id: PEER, name: '동료' }], channels: () => [{ id: CHANNEL, kind: 'channel', name: '프로젝트', memberIds: [ME, PEER] }], selectedChannelId: () => CHANNEL, openChannel() {}, loadSdk: async () => sdk });
  // Dispose first and let queued renders finish before the fake browser globals go away.
  t.after(async () => { voice.dispose(); await new Promise(done => setTimeout(done, 30)); env.restore(); });
  return { ...env, control, voice, posted, toasts, api, sdk };
}
const until = async (check, label, timeout = 2000) => { const start = Date.now(); while (!check()) { if (Date.now() - start > timeout) throw new Error(`timed out: ${label}`); await new Promise(done => setTimeout(done, 5)); } };
const indexOf = (log, predicate) => log.findIndex(predicate);
const pending = Object.assign(new Error('rotating'), { status: 409, code: 'VOICE_E2EE_PENDING' });

function callState({ status = 'awaiting_acks', epoch = 'epoch-1', reserved = [ME, PEER] } = {}) {
  return { enabled: true, invitations: true, maxConcurrentParticipants: 4, policy: { revision: 0 }, permissions: { canJoin: true, canSpeak: true, canShare: true, canShareAudio: false, canModerate: false },
    call: { id: 'call', channelId: CHANNEL, encryption: { required: true, status, epoch, ready: status === 'ready' }, sync: { status: 'current' }, reservations: reserved.map(userId => ({ userId, mediaState: 'securing' })), participants: [] } };
}
function admission(token = null, { status = 'awaiting_acks', epoch = 'epoch-1' } = {}) {
  return { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', channelId: CHANNEL, state: 'active', serverUrl: 'wss://fixture.livekit.cloud', canSpeak: true, token, encryption: { required: true, status, epoch, ready: status === 'ready' } };
}

async function joinedController(t, extra = {}) {
  let room = callState(), joined = false;
  const routes = {
    'GET /api/voice/preferences': () => ({ preferences: { revision: 0, callNotifications: true, callSounds: true, doNotDisturb: false } }),
    'GET /api/voice/invitations': () => ({ items: [] }),
    // Like the server: after joining, current returns the same active admission and its key round.
    'GET /api/voice/current': () => ({ admission: joined && room.call ? { ...admission(), encryption: room.call.encryption } : null }),
    [`GET /api/channels/${CHANNEL}/voice`]: () => room,
    [`POST /api/channels/${CHANNEL}/voice/join`]: () => { joined = true; return { ...callState(), admission: admission() }; },
    'POST /api/voice/:id/encryption/key': () => ({ epoch: 'epoch-1', key: 'key-one', challenge: 'c', proofContext: 'context-one', status: 'awaiting_acks' }),
    'POST /api/voice/:id/encryption/ack': async body => { assert.equal(body.proof, await e2eeProof('key-one', 'context-one')); return { ...callState(), admission: admission() }; },
    'POST /api/voice/:id/resume': () => ({ ...callState({ status: 'ready' }), admission: admission('media-token-1', { status: 'ready' }) }),
    'POST /api/voice/:id/heartbeat': () => ({ mediaState: 'connected' }),
    ...extra,
  };
  const f = controller(t, routes);
  f.setRoom = value => { room = value; };
  await f.voice.init({ voice: { enabled: true, invitations: true, maxConcurrentParticipants: 4, maxSessionSeconds: 7200 }, user: { id: ME } });
  f.voice.syncChannel(CHANNEL);
  await until(() => f.registry.get('voice-room-button'), 'room button');
  f.registry.get('voice-room-button');
  return f;
}

test('join sends the E2EE client contract, prepares a fresh worker and Room with the exact key, ACKs, then resumes the same admission', async t => {
  const f = await joinedController(t);
  await startJoin(f);
  await until(() => f.log.some(row => row[0] === 'api' && row[1].endsWith('/encryption/ack')), 'ack');
  const joinCall = f.log.find(row => row[0] === 'api' && row[1].endsWith('/voice/join'));
  assert.deepEqual(Object.keys(joinCall[2]).sort(), ['client', 'requestId']);
  assert.deepEqual(joinCall[2].client, { protocol: VOICE_PROTOCOL, supported: true });
  // Others are still preparing: no token yet, so no connection and no repeated join.
  assert.equal(f.log.filter(row => row[0] === 'connect').length, 0);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'publish' && row[1] === 'microphone'), 'microphone published');
  const at = predicate => indexOf(f.log, predicate);
  const order = [at(row => row[1]?.endsWith?.('/voice/join')), at(row => row[1]?.endsWith?.('/encryption/key')), at(row => row[0] === 'worker'), at(row => row[0] === 'room'), at(row => row[0] === 'setKey' && row[1] === 'key-one'), at(row => row[0] === 'e2ee' && row[1] === true), at(row => row[1]?.endsWith?.('/encryption/ack')), at(row => row[1]?.endsWith?.('/resume')), at(row => row[0] === 'connect' && row[1] === 'media-token-1'), at(row => row[0] === 'publish')];
  assert.ok(order.every(index => index >= 0), JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'contract order');
  assert.equal(f.log.filter(row => row[1]?.endsWith?.('/voice/join')).length, 1);
  assert.ok(f.log.filter(row => row[0] === 'room').every(row => row[1] === true), 'every Room is encrypted');
  const ack = f.log.find(row => row[1]?.endsWith?.('/encryption/ack'))[2];
  assert.deepEqual(Object.keys(ack).sort(), ['epoch', 'proof', 'sdkEnabled', 'workerReset']);
  assert.equal(ack.sdkEnabled, true); assert.equal(ack.workerReset, true);
  await until(() => f.posted.at(-1)?.[1].voice.call?.phase === 'connected', 'parent summary shows the SDK connection');
});

async function startJoin(f) {
  // Mirrors the pre-join "마이크 켜고 참가" button without the browser dialog.
  const button = f.registry.get('voice-room-button');
  assert.ok(button, 'room button rendered');
  await f.voice.join(CHANNEL);
}

test('a new epoch pauses local publishing, keeps signalling until the key arrives, then replaces Room, worker and tracks', async t => {
  let keyCalls = 0;
  const f = await joinedController(t, {
    'POST /api/voice/:id/encryption/key': () => { keyCalls += 1; if (keyCalls === 1) return { epoch: 'epoch-1', key: 'key-one', challenge: 'c', proofContext: 'context-one', status: 'awaiting_acks' }; if (keyCalls === 2) return pending; return { epoch: 'epoch-2', key: 'key-two', challenge: 'c2', proofContext: 'context-two', status: 'awaiting_acks' }; },
    'POST /api/voice/:id/encryption/ack': async body => body.epoch === 'epoch-1'
      ? { ...callState(), admission: admission() }
      : (assert.equal(body.proof, await e2eeProof('key-two', 'context-two')), { ...callState({ status: 'ready', epoch: 'epoch-2' }), admission: admission('media-token-2', { status: 'ready', epoch: 'epoch-2' }) }),
  });
  await startJoin(f);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'publish'), 'connected');
  const mark = f.log.length;
  f.setRoom(callState({ status: 'pausing', epoch: 'epoch-2', reserved: [ME, PEER, '33333333-3333-4333-8333-333333333333'] }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'connect' && row[1] === 'media-token-2'), 'reconnected with new epoch', 5000);
  const after = f.log.slice(mark), at = predicate => indexOf(after, predicate);
  assert.ok(at(row => row[0] === 'unpublish' && row[1] === 'microphone') < at(row => row[0] === 'setKey' && row[1] === 'key-two'), 'publishing stops before the new key');
  assert.ok(at(row => row[0] === 'disconnect') > at(row => row[1]?.endsWith?.('/encryption/key')), 'old signalling kept until a key was requested');
  assert.ok(at(row => row[0] === 'terminate') >= 0 && at(row => row[0] === 'terminate') < at(row => row[0] === 'setKey' && row[1] === 'key-two'), 'old worker discarded before the new key is set');
  assert.equal(after.filter(row => row[0] === 'worker').length, 1); assert.equal(f.control.rooms.length, 2);
  assert.ok(at(row => row[0] === 'connect' && row[1] === 'media-token-2') > at(row => row[1]?.endsWith?.('/encryption/ack')));
  assert.equal(after.filter(row => row[0] === 'api' && row[1].endsWith('/voice/join')).length, 0, 'no new join during rotation');
});

test('screen sharing picks locally, asks the server, waits for the granted source, then publishes; the browser stop calls share/stop', async t => {
  let start;
  const f = await joinedController(t, {
    'POST /api/voice/:id/share/start': (body, control) => { start = body; setTimeout(() => { const participant = control.rooms.at(-1).localParticipant; participant.permissions = { canPublish: true, canPublishSources: [2, 3] }; participant.emit('ppc'); }, 10); return { ...callState({ status: 'ready' }), share: { state: 'starting' }, admission: admission(null, { status: 'ready' }) }; },
    'POST /api/voice/:id/share/stop': () => ({ share: null, cleanupPending: false }),
  });
  await startJoin(f);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'publish' && row[1] === 'microphone'), 'connected');
  await until(() => f.registry.get('voice-dock'), 'dock');
  f.registry.get('voice-dock').click('share');
  await until(() => f.log.some(row => row[0] === 'publish' && row[1] === 'screen_share'), 'screen published');
  const at = predicate => indexOf(f.log, predicate);
  assert.ok(at(row => row[0] === 'pick') < at(row => row[1]?.endsWith?.('/share/start')));
  assert.ok(at(row => row[1]?.endsWith?.('/share/start')) < at(row => row[0] === 'publish' && row[1] === 'screen_share'));
  assert.deepEqual(Object.keys(start).sort(), ['requestId', 'withAudio']); assert.equal(start.withAudio, false);
  f.control.screen[0].mediaStreamTrack.emit('ended');
  await until(() => f.log.some(row => row[1]?.endsWith?.('/share/stop')), 'share/stop');
  assert.ok(f.control.screen[0].stopped);
  assert.ok(f.log.some(row => row[0] === 'unpublish' && row[1] === 'screen_share'));
});

test('cancelling the screen picker never sends a start request and the call keeps going', async t => {
  const f = await joinedController(t, { 'POST /api/voice/:id/share/start': () => assert.fail('start must not be sent') });
  await startJoin(f);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'publish'), 'connected');
  f.control.pickError = Object.assign(new Error('cancelled'), { name: 'NotAllowedError' });
  await until(() => f.registry.get('voice-dock'), 'dock');
  f.registry.get('voice-dock').click('share');
  await until(() => f.log.some(row => row[0] === 'pick'), 'picker opened');
  await new Promise(done => setTimeout(done, 30));
  assert.equal(f.log.filter(row => row[1]?.endsWith?.('/share/start')).length, 0);
  assert.equal(f.toasts.filter(([, error]) => error).length, 0);
  await until(() => f.posted.at(-1)?.[1].voice.call?.phase === 'connected', 'call continues');
});

test('leaving stops capture, the SDK and the worker before telling the server', async t => {
  const f = await joinedController(t, { 'POST /api/voice/:id/leave': () => ({ ok: true, cleanupPending: true }) });
  await startJoin(f);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'publish'), 'connected');
  const mark = f.log.length;
  f.voice.parentAction({ action: 'leave' });
  await until(() => f.log.some(row => row[1]?.endsWith?.('/leave')), 'leave sent');
  const after = f.log.slice(mark), at = predicate => indexOf(after, predicate);
  assert.ok(at(row => row[0] === 'stop' && row[1] === 'microphone') < at(row => row[1]?.endsWith?.('/leave')));
  assert.ok(at(row => row[0] === 'disconnect') < at(row => row[1]?.endsWith?.('/leave')));
  assert.ok(at(row => row[0] === 'terminate') < at(row => row[1]?.endsWith?.('/leave')));
  await until(() => f.toasts.some(([message]) => /정리/.test(message)), 'cleanup pending note');
});

test('a server-side end found by current stops local media without sending leave, and E2EE readiness is never labelled verified', async t => {
  let current = { admission: null };
  const f = await joinedController(t, { 'GET /api/voice/current': () => current, 'POST /api/voice/:id/leave': () => assert.fail('no leave after a server-side end') });
  await startJoin(f);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'publish'), 'connected');
  assert.doesNotMatch(JSON.stringify(f.posted), /검증 완료|verified/i);
  current = { admission: { ...admission(), state: 'revoking', reason: 'permission_revoked' } };
  f.setRoom({ ...callState({ status: 'ready' }), call: null });
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.toasts.some(([message]) => /권한/.test(message)), 'permission notice');
  assert.ok(f.log.some(row => row[0] === 'stop' && row[1] === 'microphone'));
  assert.ok(f.log.some(row => row[0] === 'terminate'));
});

test('opening an invitation notification reads the current invitation and never accepts or opens the microphone', async t => {
  const invitation = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', channelId: CHANNEL, fromUserId: PEER, toUserId: ME, state: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30000).toISOString(), alert: { id: 'alert-1', soundEnabled: false } };
  const f = await joinedController(t, { 'GET /api/voice/invitations/:id': () => ({ invitation }), 'POST /api/voice/invitations/:id/accept': () => assert.fail('reading is not accepting') });
  await f.voice.openInvitation(invitation.id);
  await until(() => f.posted.some(([, payload]) => payload.voice?.incoming?.id === invitation.id), 'incoming card posted');
  assert.equal(f.log.filter(row => row[0] === 'mic' || row[0] === 'room').length, 0);
});

test('a failing media connection retries through current/resume with backoff, never a tight loop or a new join', async t => {
  const f = await joinedController(t);
  f.control.failConnect = true;
  await startJoin(f);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'connect'), 'first connect attempt');
  await new Promise(done => setTimeout(done, 1200));
  const resumes = () => f.log.filter(row => row[1]?.endsWith?.('/resume')).length;
  assert.equal(resumes(), 1, 'no immediate retry after the failed connect');
  await until(() => resumes() === 2, 'one retry after the backoff', 4000);
  assert.equal(f.log.filter(row => row[1]?.endsWith?.('/voice/join')).length, 1);
  await until(() => f.posted.at(-1)?.[1].voice.call?.phase === 'connecting', 'still connecting');
});

// ── review regressions (Fable 10-17) ──────────────────────────
async function connectedController(t, extra = {}) {
  const f = await joinedController(t, extra);
  await startJoin(f);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'publish' && row[1] === 'microphone'), 'connected');
  return f;
}

test('a failed ACK is resent with the same proof instead of waiting for the key deadline', async t => {
  let acks = 0;
  const f = await joinedController(t, { 'POST /api/voice/:id/encryption/ack': async body => {
    acks += 1; assert.equal(body.proof, await e2eeProof('key-one', 'context-one'));
    if (acks === 1) return Object.assign(new Error('offline'), { status: undefined });
    return { ...callState({ status: 'ready' }), admission: admission('media-token-1', { status: 'ready' }) };
  } });
  await startJoin(f);
  await until(() => f.log.some(row => row[0] === 'connect' && row[1] === 'media-token-1'), 'connected after the resent ACK', 6000);
  assert.equal(acks, 2); assert.equal(f.log.filter(row => row[1]?.endsWith?.('/encryption/key')).length, 1, 'no new key needed for a resent ACK');
});

test('after an SDK-side disconnect the stopped microphone is replaced, not republished', async t => {
  const f = await connectedController(t);
  const room = f.control.rooms.at(-1), firstMic = f.control.mics[0];
  room.state = 'disconnected'; room.emit('disconnected', 1);
  await until(() => f.log.filter(row => row[0] === 'publish' && row[1] === 'microphone').length === 2, 'microphone published again', 5000);
  assert.equal(f.control.mics.length, 2); assert.ok(firstMic.stopped);
  assert.ok(f.log.some(row => row[1]?.endsWith?.('/resume')), 'recovery used resume');
  assert.equal(f.log.filter(row => row[1]?.endsWith?.('/voice/join')).length, 1);
});

test('mute pressed while the microphone permission is pending wins over the late track', async t => {
  const f = await joinedController(t);
  f.control.micDelay = 300;
  await startJoin(f);
  f.setRoom(callState({ status: 'ready' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[0] === 'mic'), 'microphone requested');
  f.voice.parentAction({ action: 'mute' });
  await new Promise(done => setTimeout(done, 450));
  assert.equal(f.log.filter(row => row[0] === 'publish' && row[1] === 'microphone').length, 0);
  assert.ok(f.control.mics[0].stopped);
  await until(() => f.posted.at(-1)?.[1].voice.call?.muted === true, 'muted summary');
});

test('the share/start token is never used for a later connection', async t => {
  let keyCalls = 0;
  const f = await connectedController(t, {
    'POST /api/voice/:id/share/start': (body, control) => { setTimeout(() => { const participant = control.rooms.at(-1).localParticipant; participant.permissions = { canPublish: true, canPublishSources: [2, 3] }; participant.emit('ppc'); }, 10); return { ...callState({ status: 'ready' }), share: { state: 'starting' }, admission: admission('share-token', { status: 'ready' }) }; },
    'POST /api/voice/:id/share/stop': () => ({ share: null, cleanupPending: false }),
    'POST /api/voice/:id/encryption/key': () => { keyCalls += 1; return keyCalls === 1 ? { epoch: 'epoch-1', key: 'key-one', challenge: 'c', proofContext: 'context-one' } : { epoch: 'epoch-2', key: 'key-two', challenge: 'c2', proofContext: 'context-two' }; },
    'POST /api/voice/:id/encryption/ack': body => body.epoch === 'epoch-1' ? { ...callState(), admission: admission() } : { ...callState({ status: 'awaiting_acks', epoch: 'epoch-2' }), admission: admission(null, { epoch: 'epoch-2' }) },
  });
  await until(() => f.registry.get('voice-dock'), 'dock');
  f.registry.get('voice-dock').click('share');
  await until(() => f.log.some(row => row[0] === 'publish' && row[1] === 'screen_share'), 'sharing');
  f.setRoom(callState({ status: 'pausing', epoch: 'epoch-2' }));
  f.voice.handleUpdate({ type: 'voice', channelId: CHANNEL });
  await until(() => f.log.some(row => row[1]?.endsWith?.('/encryption/ack') && row[2]?.epoch === 'epoch-2'), 'new epoch acknowledged', 5000);
  await new Promise(done => setTimeout(done, 300));
  assert.equal(f.log.filter(row => row[0] === 'connect' && row[1] === 'share-token').length, 0);
  await until(() => f.posted.at(-1)?.[1].voice.call?.phase === 'pausing', 'waits for the others instead of connecting');
});

test('a call left by a refresh keeps its recovery card when an invitation or another join arrives', async t => {
  const f = await joinedController(t, { 'GET /api/voice/current': () => ({ admission: { ...admission(), encryption: { required: true, status: 'ready', epoch: 'epoch-1' } } }) });
  await f.voice.init({ voice: { enabled: true, invitations: true, maxConcurrentParticipants: 4 }, user: { id: ME } });
  await until(() => f.posted.at(-1)?.[1].voice.call?.phase === 'recoverable', 'recovery card');
  await f.voice.join(CHANNEL);
  assert.equal(f.log.filter(row => row[1]?.endsWith?.('/voice/join')).length, 0);
  assert.ok(f.toasts.some(([message]) => /끊긴 통화/.test(message)));
  await until(() => f.posted.at(-1)?.[1].voice.call?.phase === 'recoverable', 'card kept');
});
