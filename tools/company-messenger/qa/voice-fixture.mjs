// Disposable company host for voice QA. Never imports/copies production data.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, lstat, readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCompanyApp } from '../../../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs';
import { createLiveKitVoiceProvider } from '../voice-livekit.mjs';
import { createVoiceService } from '../voice-service.mjs';
import { voiceScenarios, emptyVoiceResults } from './voice-scenarios.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PREFIX = 'synk-voice-qa-', KIND = 'synk-voice-qa-v1';
const client = { protocol: 'synk-livekit-e2ee-v1', supported: true };
export const voiceFixtureProfiles = Object.freeze({
  standard: { maxConcurrentParticipants: 4, maxSessionSeconds: 600, monthlyParticipantMinutes: 100, monthlyDownstreamBytes: 100000000 },
  short: { maxConcurrentParticipants: 4, maxSessionSeconds: 60, monthlyParticipantMinutes: 100, monthlyDownstreamBytes: 100000000 },
  budget: { maxConcurrentParticipants: 4, maxSessionSeconds: 600, monthlyParticipantMinutes: 1, monthlyDownstreamBytes: 1000000 },
});
const people = [
  ['host', '검증 진행자', 'member', 'voice-team'], ['peer', '검증 동료', 'member', 'voice-team'],
  ['third', '검증 참가자3', 'member', 'voice-team'], ['listener', '검증 청취자', 'viewer', 'voice-team'],
  ['outsider', '검증 외부팀', 'member', 'other-team'], ['admin', '검증 관리자', 'admin', 'other-team'],
];
const jsonFile = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
const check = (condition, status, message) => { if (!condition) throw Object.assign(new Error(message), { status }); };
const requestId = value => { check(typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value), 400, 'Invalid QA request id'); return value; };

// Deliberately no automatic media connection when a token is issued. observe()
// is only an in-process synthetic observation; no QA HTTP backdoor is mounted.
function syntheticProvider() {
  const rooms = new Map(), counts = { create: 0, issue: 0, update: 0, list: 0, remove: 0 };
  return {
    serverUrl: 'wss://voice-fixture.invalid', counts, failRemove: false,
    async createRoom(room) { counts.create++; if (!rooms.has(room)) rooms.set(room, []); },
    issueToken() { counts.issue++; return { token: 'synthetic-only-' + randomUUID(), expiresAt: new Date(Date.now() + 60000).toISOString() }; },
    async listParticipants(room) { counts.list++; return structuredClone(rooms.get(room) || []); },
    async updatePermissions(room, identity, grants) {
      counts.update++; const participant = (rooms.get(room) || []).find(row => row.identity === identity);
      if (!participant) throw new Error('Synthetic participant is not observed');
      participant.tracks = participant.tracks.filter(track => !grants.paused && (
        track.source === 'MICROPHONE' && grants.canSpeak || track.source === 'SCREEN_SHARE' && grants.canShare || track.source === 'SCREEN_SHARE_AUDIO' && grants.canShare && grants.shareAudio));
    },
    async removeParticipant(room, identity) {
      counts.remove++; if (this.failRemove) throw new Error('Synthetic revocation failure');
      rooms.set(room, (rooms.get(room) || []).filter(row => row.identity !== identity));
    },
    verifyWebhook() { throw Object.assign(new Error('Synthetic webhook is disabled'), { status: 401 }); },
    observe(admission, sources = ['MICROPHONE']) {
      const old = (rooms.get(admission.room) || []).filter(row => row.identity !== admission.id);
      rooms.set(admission.room, [...old, { identity: admission.id, sid: 'PA_' + randomUUID(), state: 'ACTIVE', tracks: sources.map(source => ({
        source, type: source === 'SCREEN_SHARE' ? 'VIDEO' : 'AUDIO', muted: false, encryption: 'GCM',
      })) }]);
    },
  };
}

function liveProvider(env, fetcher) {
  // Test-specific names: production SYNK_VOICE_LIVEKIT_* are never a fallback.
  return createLiveKitVoiceProvider({ url: env.SYNK_VOICE_TEST_LIVEKIT_URL,
    apiKey: env.SYNK_VOICE_TEST_LIVEKIT_API_KEY, apiSecret: env.SYNK_VOICE_TEST_LIVEKIT_API_SECRET,
    ...(fetcher ? { fetch: fetcher } : {}) });
}

async function unusedPort() {
  const probe = createServer(); await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done); });
  const port = probe.address().port; await new Promise(done => probe.close(done)); return port;
}

async function fixtureRoot(directory) {
  const temp = await realpath(tmpdir()), target = resolve(directory);
  if (dirname(target) !== temp || !basename(target).startsWith(PREFIX) || (await lstat(target)).isSymbolicLink() || await realpath(target) !== target) throw new Error('Refusing a non-fixture directory');
  const marker = JSON.parse(await readFile(join(target, 'fixture.json'), 'utf8'));
  if (marker.kind !== KIND || marker.runId !== basename(target) || !['synthetic', 'livekit'].includes(marker.mode)) throw new Error('Invalid voice fixture marker');
  return { target, marker };
}

async function removeFixture(directory) {
  const { target } = await fixtureRoot(directory);
  async function noLinks(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Refusing fixture cleanup with linked files');
      if (entry.isDirectory()) await noLinks(join(path, entry.name));
    }
  }
  await noLinks(target); await rm(target, { recursive: true, force: true });
}

function pendingRows(db) {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='voice_admissions'").get();
  return !!exists && (db.prepare("SELECT COUNT(*) n FROM voice_admissions WHERE state<>'ended'").get().n > 0 ||
    db.prepare('SELECT COUNT(*) n FROM voice_orphans').get().n > 0);
}

export async function createVoiceFixture({ mode = 'synthetic', profile = 'standard', port = 0, origin, env = process.env, livekitFetch } = {}) {
  if (!['synthetic', 'livekit'].includes(mode) || !Object.hasOwn(voiceFixtureProfiles, profile)) throw new Error('Unknown voice QA mode/profile');
  if (!Number.isInteger(port) || port < 0 || port > 65535 || [4191, 4197].includes(port)) throw new Error('Use an unused QA port, not a company port');
  if (origin) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password || ['synk.im', 'www.synk.im', 'workspace.synk.im'].includes(url.hostname)) throw new Error('Use a dedicated test HTTPS origin; existing SYNK public hosts are excluded');
  }
  if (mode === 'synthetic' && origin) throw new Error('Synthetic mode is loopback only');
  const provider = mode === 'synthetic' ? syntheticProvider() : liveProvider(env, livekitFetch);
  port ||= await unusedPort();
  const base = `http://127.0.0.1:${port}`, publicOrigin = origin || `http://localhost:${port}`;
  const directory = await mkdtemp(join(await realpath(tmpdir()), PREFIX)), runId = basename(directory);
  const marker = { kind: KIND, runId, mode, providerUrl: provider.serverUrl, createdAt: new Date().toISOString() };
  await jsonFile(join(directory, 'fixture.json'), marker);
  await jsonFile(join(directory, 'run.json'), { ...marker, running: true, pid: process.pid, dataDirectory: directory, setupComplete: false });
  let app, stopping, offset = 0;
  const blocked = async () => { throw new Error('Voice QA blocks non-voice providers'); };
  const sandboxEnv = { SYNK_COMPANY_BACKGROUND_JOBS_ENABLED: '0', SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED: '0', SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED: '0', NODE_ENV: 'test' };
  const previous = Object.fromEntries(Object.keys(sandboxEnv).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, sandboxEnv);
    try {
      app = createCompanyApp({ dataDir: join(directory, 'company'), messengerDataDir: join(directory, 'messenger'), clientIntakeDir: join(directory, 'intake'),
        host: '127.0.0.1', port, origin: publicOrigin, allowTestHost: true, trustedProxyIps: '', requireExistingData: false,
        schedule: false, workNotificationsEnabled: false, webPushEnabled: false, publicationInboxEnabled: false,
        synkIdentityConfig: null, teachingConfig: null, synkCustomerIdentityConfig: null, computerAIEnv: () => ({}),
        contentFetch: blocked, creativeResearchFetch: blocked, creativeResearchDriveFetch: blocked, dailyTrendsFetch: blocked,
        computerAIFetch: blocked, synkIdentityFetch: blocked, teachingFetch: blocked, synkCustomerIdentityFetch: blocked,
        oauthFetch: blocked, metaConnectionFetch: blocked, collector: blocked, socialProviderOptions: { fetchImpl: blocked },
        messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) },
        messengerVoice: { enabled: true, e2eeRequired: true, provider, limits: voiceFixtureProfiles[profile], automaticSweep: true, now: () => Date.now() + offset },
      });
    } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
    const credentials = {}, users = {}, boots = {};
    app.store.put('settings', 'company', { companyName: 'SYNK 통화 검증용', enabled: false, hourKst: 9 });
    for (const [id, name] of [['voice-team', '통화 검증팀'], ['other-team', '다른 검증팀']]) app.store.put('teams', id, { id, name, active: true });
    for (const [alias, name, role, teamId] of people) {
      const email = `${alias}@voice-qa.example.test`, password = randomBytes(24).toString('base64url');
      credentials[alias] = { email, password }; users[alias] = app.store.createUser({ email, password, name, role, teamId });
    }
    await jsonFile(join(directory, 'accounts.private.json'), credentials);
    await app.start();
    async function login(alias) {
      if (!Object.hasOwn(credentials, alias)) throw new Error('Unknown fixture account');
      let cookie = '', csrf = '';
      async function request(path, { method = 'GET', body, status = 200, headers = {} } = {}) {
        if (!path.startsWith('/') || path.startsWith('//')) throw new Error('QA request must be local');
        const response = await fetch(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { Origin: publicOrigin, Cookie: cookie, 'X-CSRF-Token': csrf, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const next = response.headers.getSetCookie().find(value => value.startsWith('synk_company_session=')); if (next) cookie = next.split(';')[0];
        const result = await response.json();
        assert.equal(response.status, status, `${method} ${path}: unexpected status ${response.status}`);
        if (result.csrfToken) csrf = result.csrfToken;
        return result;
      }
      await request('/api/login', { method: 'POST', body: credentials[alias] }); return request;
    }
    const clients = {};
    for (const [alias] of people) { clients[alias] = await login(alias); boots[alias] = await clients[alias]('/messenger/api/bootstrap'); }
    const selected = ['peer', 'third', 'listener'].map(alias => boots[alias].user.id), rooms = {};
    for (const [key, name, policy] of [
      ['main', '통화 검증 · 기본', null], ['audio', '통화 검증 · 화면 소리 허용', { screenAudioAllowed: true }],
      ['listening', '통화 검증 · 청취 허용', { viewerCanJoin: true }], ['locked', '통화 검증 · 잠긴 방', { locked: true }],
      ['public', '통화 검증 · 전체 공개', null],
    ]) {
      const room = (await clients.host('/messenger/api/channels', { method: 'POST', status: 201, body: key === 'public' ? { name, category: 'generic' } : { name, category: 'project', memberIds: selected } })).channel;
      if (policy) await clients.host(`/messenger/api/channels/${room.id}/voice/policy`, { method: 'PATCH', body: { revision: 0, ...policy } });
      rooms[key] = { id: room.id, name: room.name, scope: room.scope };
    }
    const manifest = { ...marker, running: true, setupComplete: true, profile, url: publicOrigin, localBind: base, pid: process.pid, dataDirectory: directory,
      credentialsFile: join(directory, 'accounts.private.json'), limits: voiceFixtureProfiles[profile], rooms,
      accounts: people.map(([alias, name, role]) => ({ alias, name, role, companyUserId: users[alias].id, messengerUserId: boots[alias].user.id })),
      mediaVerified: false, simulation: mode === 'synthetic', nonVoiceServicesEnabled: false,
      frontendSdkStatus: 'not_checked', cloudSetupStatus: mode === 'livekit' ? 'credentials_configured_not_media_verified' : 'not_configured',
    };
    await writeFile(join(directory, 'run.json'), JSON.stringify(manifest, null, 2)); await jsonFile(join(directory, 'scenarios.json'), voiceScenarios);
    await jsonFile(join(directory, 'results.json'), emptyVoiceResults({ runId, mode, profile }));
    await copyFile(join(here, 'voice-screen-pattern.html'), join(directory, 'screen-pattern.html'));
    async function stop() {
      if (stopping) return stopping;
      stopping = (async () => {
        await app.stop(); manifest.running = false;
        const db = new DatabaseSync(join(directory, 'messenger', 'messenger.sqlite'), { readOnly: true });
        let cleanupPending; try { cleanupPending = pendingRows(db); } finally { db.close(); }
        if (cleanupPending) { await writeFile(join(directory, 'run.json'), JSON.stringify({ ...manifest, cleanupPending }, null, 2)); return { cleanupPending, retainedDirectory: directory }; }
        await removeFixture(directory); return { cleanupPending: false, retainedDirectory: null };
      })(); return stopping;
    }
    return { app, provider, directory, manifest, rooms, clients, login, stop,
      advance(ms) { if (mode !== 'synthetic' || !Number.isSafeInteger(ms) || ms < 0) throw new Error('Only synthetic time may advance'); offset += ms; },
      async exportReports(target) {
        await mkdir(target, { recursive: false });
        for (const file of ['run.json', 'scenarios.json', 'results.json', 'screen-pattern.html']) await copyFile(join(directory, file), join(target, file));
        return target;
      },
    };
  } catch (error) {
    if (app) {
      try {
        await app.stop();
        const db = new DatabaseSync(join(directory, 'messenger', 'messenger.sqlite'), { readOnly: true });
        let pending; try { pending = pendingRows(db); } finally { db.close(); }
        const failedRun = JSON.parse(await readFile(join(directory, 'run.json'), 'utf8'));
        await writeFile(join(directory, 'run.json'), JSON.stringify({ ...failedRun, running: false, cleanupPending: pending }, null, 2));
        if (pending) throw new Error('Voice QA setup left revocation pending; fixture data retained');
      } catch { throw new Error('Voice QA setup/cleanup failed; fixture data retained at ' + directory); }
    }
    await removeFixture(directory); throw error;
  }
}

export async function runVoicePreflight(fixture) {
  if (fixture.manifest.mode !== 'synthetic') throw new Error('Preflight is synthetic only; it never starts real media');
  const { clients: c, rooms, provider } = fixture, checks = [];
  const post = (request, path, body, status = 200) => request('/messenger' + path, { method: 'POST', body, status });
  const passed = id => checks.push({ id, status: 'pass', evidenceKind: 'synthetic-http' });
  for (const alias of ['outsider', 'admin']) await c[alias](`/messenger/api/channels/${rooms.main.id}/voice`, { status: 404 });
  await post(c.listener, `/api/channels/${rooms.main.id}/voice/join`, { requestId: randomUUID(), client }, 403); passed('private-room-and-role');
  const a = await post(c.host, `/api/channels/${rooms.main.id}/voice/join`, { requestId: randomUUID(), client });
  assert.equal(a.admission.token, null); assert.equal(a.admission.mediaState, 'securing');
  const key = (request, admission) => post(request, `/api/voice/${admission.id}/encryption/key`, {});
  const ack = (request, admission, value) => post(request, `/api/voice/${admission.id}/encryption/ack`, {
    epoch: value.epoch, sdkEnabled: true, workerReset: true, proof: createHmac('sha256', value.key).update(value.proofContext).digest('base64url'),
  });
  await c.host(`/messenger/api/voice/${a.admission.id}/encryption/key`, { method: 'POST', body: {}, status: 403, headers: { 'X-CSRF-Token': '' } });
  const aKey = await key(c.host, a.admission); const readyA = await ack(c.host, a.admission, aKey); assert.ok(readyA.admission.token);
  provider.observe(readyA.admission); passed('key-barrier-and-csrf');
  const b = await post(c.peer, `/api/channels/${rooms.main.id}/voice/join`, { requestId: randomUUID(), client });
  const newA = await key(c.host, a.admission), newB = await key(c.peer, b.admission);
  assert.notEqual(newA.epoch, aKey.epoch); assert.equal(newA.key, newB.key);
  assert.equal((await ack(c.peer, b.admission, newB)).admission.token, null);
  const resumedA = await ack(c.host, a.admission, newA), resumedB = await post(c.peer, `/api/voice/${b.admission.id}/resume`, {});
  provider.observe(resumedA.admission); provider.observe(resumedB.admission); fixture.advance(5000);
  assert.equal((await c.host(`/messenger/api/channels/${rooms.main.id}/voice`)).call.participants.length, 2); passed('membership-rekey-control');
  const shareInput = { requestId: randomUUID(), withAudio: false };
  await post(c.host, `/api/voice/${a.admission.id}/share/start`, { ...shareInput, withAudio: true }, 403);
  await post(c.host, `/api/voice/${a.admission.id}/share/start`, shareInput);
  provider.observe(resumedA.admission, ['MICROPHONE', 'SCREEN_SHARE']); fixture.advance(5000);
  const shared = await c.host(`/messenger/api/channels/${rooms.main.id}/voice`);
  assert.equal(shared.call.participants.find(row => row.userId === fixture.manifest.accounts.find(person => person.alias === 'host').messengerUserId).share.state, 'sharing');
  fixture.advance(5000); assert.equal((await post(c.host, `/api/voice/${a.admission.id}/share/stop`, {})).cleanupPending, false);
  await post(c.host, `/api/voice/${a.admission.id}/share/start`, shareInput, 409);
  assert.equal((await c.host('/messenger/api/voice/current')).admission.state, 'active'); passed('screen-stop-and-request-replay');
  const invite = await post(c.host, `/api/channels/${rooms.main.id}/voice/invitations`, { requestId: randomUUID(), recipientId: fixture.manifest.accounts.find(person => person.alias === 'third').messengerUserId }, 201);
  assert.equal((await c.third('/messenger/api/voice/current')).admission, null);
  await post(c.third, `/api/voice/invitations/${invite.invitation.id}/reject`, {}); passed('invitation-consent');
  await c.peer('/api/logout', { method: 'POST', body: {} }); await c.host(`/messenger/api/channels/${rooms.main.id}/voice`);
  await post(c.peer, `/api/voice/${b.admission.id}/encryption/key`, {}, 401); passed('logout-revocation');
  await post(c.host, `/api/voice/${a.admission.id}/leave`, {});
  const report = { runId: fixture.manifest.runId, at: new Date().toISOString(), mode: 'synthetic', checks,
    externalVoiceCalls: 0, actualMediaVerified: false, browserOrSdkTested: false, providerCounts: { ...provider.counts } };
  await jsonFile(join(fixture.directory, 'preflight.json'), report); return report;
}

export async function cleanupVoiceFixture(directory, { env = process.env, livekitFetch } = {}) {
  const { target, marker } = await fixtureRoot(directory);
  const run = JSON.parse(await readFile(join(target, 'run.json'), 'utf8'));
  if (run.running && Number.isSafeInteger(run.pid)) {
    let alive = true; try { process.kill(run.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
    if (alive) throw new Error('Stop the running voice fixture before cleanup');
  }
  const provider = marker.mode === 'livekit' ? liveProvider(env, livekitFetch) : syntheticProvider();
  if (marker.providerUrl !== provider.serverUrl) throw new Error('Cleanup requires the original test LiveKit project');
  const db = new DatabaseSync(join(target, 'messenger', 'messenger.sqlite'));
  let pending;
  try {
    const service = createVoiceService({ db, enabled: false, provider, assert: check, validateRequestId: requestId, publish: () => {}, automaticSweep: false });
    await service.sweep(); await service.close(); pending = pendingRows(db);
  } finally { db.close(); }
  if (!pending) await removeFixture(target);
  return { cleanupPending: pending, retainedDirectory: pending ? target : null };
}

export function parseVoiceFixtureArgs(args) {
  const options = {};
  for (const arg of args) {
    if (arg === '--check') options.check = true;
    else if (arg === '--help') options.help = true;
    else if (/^--(mode|profile|origin|port|out|cleanup)=/.test(arg)) { const at = arg.indexOf('='); options[arg.slice(2, at)] = arg.slice(at + 1); }
    else throw new Error('Unknown argument; use --help');
  }
  if (options.port !== undefined) { if (!/^\d+$/.test(options.port)) throw new Error('Invalid port'); options.port = Number(options.port); }
  if (options.check && options.mode && options.mode !== 'synthetic') throw new Error('--check only supports synthetic mode');
  if (options.cleanup && Object.keys(options).length !== 1) throw new Error('--cleanup must be used alone');
  return options;
}

async function main() {
  const args = parseVoiceFixtureArgs(process.argv.slice(2));
  if (args.help) { console.log('node tools/company-messenger/qa/voice-fixture.mjs [--check] [--mode=synthetic|livekit] [--profile=standard|short|budget] [--port=0] [--origin=https://test-host] [--out=NEW_DIRECTORY]\nCleanup: --cleanup=RETAINED_TEMP_DIRECTORY\nLiveKit uses only SYNK_VOICE_TEST_LIVEKIT_URL/API_KEY/API_SECRET from the current environment.'); return; }
  if (args.cleanup) { console.log(JSON.stringify(await cleanupVoiceFixture(args.cleanup))); return; }
  const fixture = await createVoiceFixture(args);
  if (args.check) {
    let exported;
    try {
      const report = await runVoicePreflight(fixture);
      const parent = resolve(here, '../../../.tmp'); await mkdir(parent, { recursive: true });
      exported = resolve(args.out || join(parent, 'voice-preflight-' + randomUUID()));
      await fixture.exportReports(exported); await copyFile(join(fixture.directory, 'preflight.json'), join(exported, 'preflight.json'));
      console.log(JSON.stringify({ mode: 'synthetic', checksPassed: report.checks.length, mediaVerified: false, evidenceDirectory: exported }));
    } finally {
      const cleanup = await fixture.stop();
      if (exported) await writeFile(join(exported, 'run.json'), JSON.stringify({ ...fixture.manifest, running: false, ...cleanup }, null, 2));
      if (cleanup.cleanupPending) console.log(JSON.stringify(cleanup));
    }
    return;
  }
  const parent = resolve(here, '../../../.tmp'); await mkdir(parent, { recursive: true });
  const exported = resolve(args.out || join(parent, 'voice-session-' + randomUUID()));
  try { await fixture.exportReports(exported); } catch (error) { await fixture.stop(); throw error; }
  console.log(JSON.stringify({ mode: fixture.manifest.mode, url: fixture.manifest.url, pid: process.pid, fixtureDirectory: fixture.directory,
    credentialsFile: fixture.manifest.credentialsFile, evidenceDirectory: exported, scenarios: voiceScenarios.length, mediaVerified: false }));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    void fixture.stop().then(async result => {
      // Preserve manual results/captures in the exported folder after deleting
      // disposable accounts/SQLite. Only update this runner's lifecycle file.
      await writeFile(join(exported, 'run.json'), JSON.stringify({ ...fixture.manifest, running: false, ...result }, null, 2));
      console.log(JSON.stringify(result)); process.exitCode = result.cleanupPending ? 2 : 0;
    }).catch(() => { console.error('Voice QA cleanup incomplete; retain the fixture directory'); process.exitCode = 2; });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  // Never print provider responses, credentials, key material or request bodies.
  console.error('Voice QA preparation failed: ' + String(error?.code || error?.name || 'Error').replace(/[^A-Za-z0-9_]/g, ''));
  process.exitCode = 1;
});
