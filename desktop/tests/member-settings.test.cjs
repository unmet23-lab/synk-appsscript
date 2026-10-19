'use strict';
// 「내 성향」 settings (desktop/renderer/member-settings.mjs): the help style and explanation length
// are saved into the account's learning memory (synk-learning ?view=memory), the entry WORLD and the
// games read. One time per choice, never over a newer value, and never without the account's consent.
const test = require('node:test');
const assert = require('node:assert/strict');
const loaded = import('../renderer/member-settings.mjs');
const { requestSpec } = require('../src/account-requests.cjs');
const { createAuthService } = require('../src/auth-service.cjs');
const SERVER = '2026-10-19T03:00:00.000Z', DAY = 86400000;
const later = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();
const context = { revision: 7, enabled: true, shared: 'practice-and-settings' };

// The account server as SYNK-talk lib/synk-server.js answers today: GET and POST reply
// { ok, revision, entries } with no clock of their own; a POST keeps the newer entry, leaves out an
// entry dated more than a day ahead of its clock (lib/atlas-memory-rules.js) and replies with what it
// now holds for the keys it kept. `serverTime` is sent only when a test gives one.
function memory({ entries = [], serverTime = null, serverNow = SERVER, revision = 7, failGet = null, failPost = null, newerOnPost = null } = {}) {
  const held = new Map(entries.map(entry => [`${entry.kind}:${entry.key}`, structuredClone(entry)])), calls = [];
  const clock = serverTime ? { serverTime } : {};
  let identity = { status: 'signed-in', signedIn: true, accountId: 'synthetic-owner', sessionGeneration: 1, learningSync: true };
  const request = async (operation, params) => {
    calls.push({ operation, params: structuredClone(params) });
    if (operation === 'memoryGet') {
      if (failGet) return { ok: false, error: { code: failGet } };
      return { ok: true, revision, entries: [...held.values()].map(entry => structuredClone(entry)), ...clock };
    }
    assert.equal(operation, 'memoryPost');
    if (failPost) return { ok: false, error: { code: failPost } };
    // Another device saved a newer value between the read and this write.
    if (newerOnPost) held.set('presentation:chosen', structuredClone(newerOnPost));
    const kept = params.entries.filter(entry => Date.parse(entry.at) <= Date.parse(serverNow) + DAY);
    for (const entry of kept) {
      const key = `${entry.kind}:${entry.key}`, old = held.get(key);
      if (!old || Date.parse(entry.at) > Date.parse(old.at)) held.set(key, structuredClone(entry));
    }
    return { ok: true, revision, entries: kept.map(entry => structuredClone(held.get(`${entry.kind}:${entry.key}`))), ...clock };
  };
  return { calls, held, request, getIdentity: () => identity, setIdentity(patch) { identity = { ...identity, ...patch }; } };
}
const device = (iso = SERVER) => () => Date.parse(iso);

test('nothing opens or saves without a signed-in account whose policy allows learning memory', async () => {
  const { createMemberSettings } = await loaded;
  for (const patch of [{ learningSync: false }, { status: 'signed-out', signedIn: false }, { learningSync: undefined }]) {
    const f = memory(); f.setIdentity(patch);
    const settings = createMemberSettings({ getIdentity: f.getIdentity, request: f.request, now: device() });
    assert.equal(settings.read().writable, false);assert.equal(settings.begin({ field: 'support' }), false);
    await settings.save(context);assert.equal(f.calls.length, 0);
  }
  const f = memory(), settings = createMemberSettings({ getIdentity: f.getIdentity, request: f.request, now: device() });
  assert.equal(settings.begin({ field: 'textSize' }), false, 'only the help style and explanation length change here');
  assert.equal(settings.begin({ field: 'support', value: 'telepathy' }), false);
});

test('a save keeps the other stored choices and takes one time after both this device\'s clock and the stored value', async () => {
  const { createMemberSettings } = await loaded;
  const stored = { kind: 'presentation', key: 'chosen', value: { support: 'choose', textSize: 'large', motion: 'reduced', bogus: 'x' }, at: later(SERVER, -60000) };
  const f = memory({ entries: [stored, { kind: 'declined', key: 'offer-1', value: null, at: SERVER }] });
  const settings = createMemberSettings({ getIdentity: f.getIdentity, request: f.request, now: device() });
  assert.equal(settings.begin({ field: 'support', value: 'choose' }), true);assert.equal(settings.choose('step'), true);
  const result = await settings.save(context);
  assert.equal(result.error, null);assert.equal(result.editor, null);assert.match(result.message, /저장했어요. WORLD 연습도 이 방식을 써요/);
  assert.deepEqual(f.calls.map(call => call.operation), ['memoryGet', 'memoryPost']);
  assert.deepEqual(f.calls[1].params, { revision: 7, entries: [{ kind: 'presentation', key: 'chosen', value: { support: 'step', textSize: 'large', motion: 'reduced' }, at: SERVER }] },
    'only the server vocabulary is sent; the time is this device\'s clock because the stored value is older');
  assert.equal(f.held.get('declined:offer-1').at, SERVER, 'other memory entries are untouched');
  assert.deepEqual(f.held.get('presentation:chosen').value, { support: 'step', textSize: 'large', motion: 'reduced' });
  // A stored value dated after this clock (another device a little ahead) still loses to this choice.
  const ahead = memory({ entries: [{ ...stored, at: later(SERVER, 3600000) }] });
  const second = createMemberSettings({ getIdentity: ahead.getIdentity, request: ahead.request, now: device() });
  second.begin({ field: 'explanation', value: 'brief' });assert.equal((await second.save(context)).error, null);
  assert.equal(ahead.calls[1].params.entries[0].at, later(SERVER, 3600001));
});

test('the server\'s clock is used when its reply gives one, and a device clock it leaves out is reported', async () => {
  const { createMemberSettings } = await loaded;
  // This device is two days fast. The server leaves its entry out and replies with nothing kept.
  const fast = memory({ entries: [{ kind: 'presentation', key: 'chosen', value: { support: 'choose' }, at: later(SERVER, -60000) }] });
  const settings = createMemberSettings({ getIdentity: fast.getIdentity, request: fast.request, now: device(later(SERVER, 2 * DAY)) });
  settings.begin({ field: 'support', value: 'step' });
  const result = await settings.save(context);
  assert.equal(result.error, 'DEVICE_CLOCK');assert.match(result.message, /이 기기의 시각이 맞지 않아 저장하지 못했어요/);
  assert.ok(result.editor, 'the choice stays for a retry');
  assert.deepEqual(fast.held.get('presentation:chosen').value, { support: 'choose' }, 'nothing was written');
  // A reply that names the server clock wins over the same fast device clock.
  const told = memory({ serverTime: SERVER, entries: [{ kind: 'presentation', key: 'chosen', value: { support: 'choose' }, at: later(SERVER, -60000) }] });
  const second = createMemberSettings({ getIdentity: told.getIdentity, request: told.request, now: device(later(SERVER, 2 * DAY)) });
  second.begin({ field: 'support', value: 'step' });
  assert.equal((await second.save(context)).error, null);
  assert.equal(told.calls[1].params.entries[0].at, SERVER);assert.deepEqual(told.held.get('presentation:chosen').value, { support: 'step' });
});

test('the same value is not written again, and a value far ahead of the clock is never overwritten blindly', async () => {
  const { createMemberSettings } = await loaded;
  const same = memory({ entries: [{ kind: 'presentation', key: 'chosen', value: { support: 'step' }, at: SERVER }] });
  const settings = createMemberSettings({ getIdentity: same.getIdentity, request: same.request, now: device() });
  settings.begin({ field: 'support', value: 'step' });
  assert.match((await settings.save(context)).message, /이미 이 방식으로 저장돼 있어요/);
  assert.deepEqual(same.calls.map(call => call.operation), ['memoryGet']);
  const far = memory({ entries: [{ kind: 'presentation', key: 'chosen', value: { support: 'choose' }, at: later(SERVER, 2 * DAY) }] });
  const blocked = createMemberSettings({ getIdentity: far.getIdentity, request: far.request, now: device() });
  blocked.begin({ field: 'support', value: 'step' });
  const result = await blocked.save(context);
  assert.equal(result.error, 'MEMORY_CLOCK_AHEAD');assert.ok(result.editor, 'the choice stays for a retry');
  assert.deepEqual(far.calls.map(call => call.operation), ['memoryGet']);
});

test('a newer choice from another device wins and is reported, not overwritten', async () => {
  const { createMemberSettings } = await loaded;
  const f = memory({ entries: [{ kind: 'presentation', key: 'chosen', value: { support: 'choose' }, at: SERVER }],
    newerOnPost: { kind: 'presentation', key: 'chosen', value: { support: 'independent' }, at: later(SERVER, 5000) } });
  const settings = createMemberSettings({ getIdentity: f.getIdentity, request: f.request, now: device() });
  settings.begin({ field: 'support', value: 'step' });
  const result = await settings.save(context);
  assert.equal(result.error, 'MEMORY_CONFLICT');assert.match(result.message, /다른 곳에서 방금 바꿨어요/);
  assert.deepEqual(f.held.get('presentation:chosen').value, { support: 'independent' });
});

test('a refused policy closes editing for the session, and a summary without learning storage never sends', async () => {
  const { createMemberSettings } = await loaded;
  const f = memory({ failPost: 'FEATURE_DISABLED' }), settings = createMemberSettings({ getIdentity: f.getIdentity, request: f.request, now: device() });
  settings.begin({ field: 'support', value: 'step' });
  const result = await settings.save(context);
  assert.equal(result.error, 'FEATURE_DISABLED');assert.equal(result.writable, false);assert.match(result.message, /WORLD 학습 목표에서 바꿔 주세요/);
  assert.equal(settings.begin({ field: 'support', value: 'step' }), false);
  for (const bad of [{ ...context, enabled: false }, { ...context, shared: 'declared-only' }, { ...context, revision: 0 }, {}]) {
    const g = memory(), other = createMemberSettings({ getIdentity: g.getIdentity, request: g.request, now: device() });
    other.begin({ field: 'support', value: 'step' });
    assert.equal((await other.save(bad)).error, 'LEARNING_DISABLED');assert.equal(g.calls.length, 0);
  }
  const revision = memory({ failGet: 'REVISION_CONFLICT' }), moved = createMemberSettings({ getIdentity: revision.getIdentity, request: revision.request, now: device() });
  moved.begin({ field: 'explanation', value: 'detailed' });
  assert.match((await moved.save(context)).message, /새로 불러온 뒤 다시 골라 주세요/);
});

test('an account change during a save drops its result and the editor', async () => {
  const { createMemberSettings } = await loaded;
  const f = memory();let release;
  const gate = new Promise(resolve => { release = resolve; });
  const settings = createMemberSettings({ getIdentity: f.getIdentity, now: device(), request: async (operation, params) => { if (operation === 'memoryGet') await gate; return f.request(operation, params); } });
  settings.begin({ field: 'support', value: 'step' });
  const saving = settings.save(context);
  f.setIdentity({ accountId: 'another-owner', sessionGeneration: 2 });release();
  await saving;
  const after = settings.read();
  assert.equal(after.editor, null);assert.equal(after.message, '');assert.equal(after.pending, false);
  assert.equal(f.calls.some(call => call.operation === 'memoryPost'), false, 'nothing is written for the old account');
});

test('the desktop exposes the account policy as learningSync and routes memory through the learning fence', async t => {
  for (const policy of [true, false, undefined]) {
    const reply = value => new Response(JSON.stringify(value), { status: 200 }), seen = [];
    const service = createAuthService({ config: { product: 'platform', clientKey: 'platform', clientId: 'synthetic-client', supabaseUrl: 'https://synthetic.invalid', accountApiUrl: 'https://synthetic.invalid', publishableKey: 'synthetic-key' },
      now: () => 1000, openExternal: async () => assert.fail('No UI or login'),
      store: { available: () => true, load: async () => ({ refreshToken: 'synthetic-refresh', subject: 'synthetic-subject' }), save: async () => {}, clear: async () => {} },
      fetcher: async (url, options = {}) => {
        let body = null;try { body = options.body ? JSON.parse(options.body) : null; } catch { body = String(options.body); }
        seen.push({ url, body });
        if (url.endsWith('/auth/v1/oauth/token')) return reply({ token_type: 'bearer', access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600 });
        if (url.endsWith('/auth/v1/user')) return reply({ id: 'synthetic-subject' });
        if (url.endsWith('/functions/v1/synk-account')) return reply({ ok: true, account: { synk_user_id: 'synthetic-owner', status: 'active', profile: {} }, sessions: [], ...(policy === undefined ? {} : { capabilities: { learningSync: policy } }) });
        return reply({ ok: true, revision: 7, entries: [] });
      } });
    t.after(() => service.dispose());
    await service.initialize();
    assert.equal(service.status().learningSync, policy === true);
    if (policy) {
      await service.accountRequest('memoryGet', { revision: 7 });
      await service.accountRequest('memoryPost', { revision: 7, entries: [{ kind: 'presentation', key: 'chosen', value: { support: 'step' }, at: SERVER }] });
      assert.match(seen.at(-2).url, /\/functions\/v1\/synk-learning\?view=memory&revision=7$/);
      assert.deepEqual(seen.at(-1).body, { revision: 7, memory: [{ kind: 'presentation', key: 'chosen', value: { support: 'step' }, at: SERVER }] });
    }
  }
  assert.throws(() => requestSpec('memoryGet', { revision: 'x' }, '1', 'platform', 'platform'), { code: 'INVALID_REQUEST' });
});
