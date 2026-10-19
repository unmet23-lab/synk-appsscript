import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Store } from './store.mjs';
import { createCompanyApp } from './server.mjs';

test('real company routing revokes media admission on logout, employee deactivation, and server shutdown', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'synk-company-voice-'));
  const store = new Store(join(directory, 'company')), password = 'synthetic-voice-test-password';
  const alice = store.createUser({ name: '담당자', email: 'alice@example.test', password, role: 'member' });
  const bob = store.createUser({ name: '동료', email: 'bob@example.test', password, role: 'member' });
  const removals = [], media = new Map();
  const provider = { serverUrl: 'wss://fixture.livekit.cloud', async createRoom() {}, issueToken(room, identity) { media.set(room, [...(media.get(room) || []), { identity, sid: 'PA_' + identity, state: 'ACTIVE', tracks: [] }]); return { token: 'synthetic-' + identity, expiresAt: new Date(Date.now() + 60000).toISOString() }; }, async listParticipants(room) { return media.get(room) || []; }, verifyWebhook() { throw Object.assign(new Error('invalid'), { status: 401, publicMessage: 'invalid' }); }, async removeParticipant(room, identity) { removals.push(identity); media.set(room, (media.get(room) || []).filter(p => p.identity !== identity)); } };
  provider.updatePermissions = async (room, identity) => { const participant = (media.get(room) || []).find(row => row.identity === identity); if (participant) participant.tracks = []; };
  const app = createCompanyApp({ store, dataDir: join(directory, 'company'), messengerDataDir: join(directory, 'messenger'), port: 0, allowTestHost: true, schedule: false, messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) }, messengerVoice: { enabled: true, provider, automaticSweep: false } });
  const address = await app.start(), url = `http://127.0.0.1:${address.port}`;
  let stopped = false;
  t.after(async () => { if (!stopped) await app.stop(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.split(sep).at(-1).startsWith('synk-company-voice-')); await rm(directory, { recursive: true, force: true }); });
  const unsignedWebhook = await fetch(url + '/messenger/api/voice/webhook', { method: 'POST', headers: { 'Content-Type': 'application/webhook+json' }, body: '{}' });
  assert.equal(unsignedWebhook.status, 401);
  async function login(user) {
    let cookie = '', csrf = '';
    const request = async (path, body) => {
      const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, Origin: app.origin, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(6000) });
      const setCookie = response.headers.getSetCookie().find(value => value.startsWith('synk_company_session=')); if (setCookie) cookie = setCookie.split(';')[0];
      const value = await response.json(); assert.equal(response.ok, true, `${response.status}: ${JSON.stringify(value)}`); if (value.csrfToken) csrf = value.csrfToken; return value;
    };
    await request('/api/login', { email: user.email, password });
    return request;
  }
  const a = await login(alice), b = await login(bob);
  const bobBoot = await b('/messenger/api/bootstrap');
  const room = (await a('/messenger/api/channels', { name: '공동 작업', category: 'project', memberIds: [bobBoot.user.id] })).channel;
  async function encryptedJoin(request) {
    const joined = await request(`/messenger/api/channels/${room.id}/voice/join`, { requestId: randomUUID(), client: { protocol: 'synk-livekit-e2ee-v1', supported: true } });
    assert.equal(joined.admission.token, null);
    const key = await request(`/messenger/api/voice/${joined.admission.id}/encryption/key`, {});
    const ready = await request(`/messenger/api/voice/${joined.admission.id}/encryption/ack`, { epoch: key.epoch, sdkEnabled: true, workerReset: true, proof: createHmac('sha256', key.key).update(key.proofContext).digest('base64url') });
    assert.ok(ready.admission.token); assert.equal(ready.admission.encryption.ready, true); return ready;
  }
  const first = await encryptedJoin(a);
  await a('/api/logout', {});
  await b(`/messenger/api/channels/${room.id}/voice`);
  assert.ok(removals.includes(first.admission.id));
  const a2 = await login(alice), second = await encryptedJoin(a2);
  store.put('users', alice.id, { ...store.get('users', alice.id), active: false }); app.messenger.disconnectRevoked();
  await b(`/messenger/api/channels/${room.id}/voice`);
  assert.ok(removals.includes(second.admission.id));
  const last = await encryptedJoin(b);
  await app.stop(); stopped = true;
  assert.ok(removals.includes(last.admission.id));
});
