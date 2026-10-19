import test from 'node:test';
import assert from 'node:assert/strict';
import { createTravelMemory } from '../experiences/path-travel/planner-storage.mjs';
import { createTravelAccount, travelAccountDocument, travelDeviceState, TRAVEL_ACCOUNT_CONTRACT } from '../experiences/path-travel/planner-account.mjs';
import { PERSONAL_LIMITS, validatePersonalState, parsePersonalState, personalWriteRequest, personalDeleteRequest, pathAccountState, validatePersonalResponse } from '../experiences/synk-account/src/personal-data.mjs';
import { initialState } from '../experiences/path-vr/model.mjs';
import { readConfig } from '../experiences/synk-account/src/core.mjs';
import { sharedAccountServer } from '../experiences/synk-account/server-shared.mjs';

const at = '2026-10-08T00:00:00.000Z';
const document = () => travelAccountDocument(createTravelMemory({}, { now: at }), { now: at });
const reply = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const config = { version: 1, supabaseUrl: 'https://auth.example.test', accountApiUrl: 'https://api.example.test',
  supabasePublishableKey: 'sb_publishable_fixture', portalUrl: 'https://portal.example.test',
  clients: { path: { clientId: 'fixture-path-vr', redirectUri: 'http://127.0.0.1:4292/' },
    'path-travel': { clientId: 'fixture-travel', redirectUri: 'http://127.0.0.1:4303/' } } };
const envelope = (state = null, revision = 0) => ({ ok: true, scope: 'synk-personal', resource: 'path-travel', accountId: 'fixture-owner', revision, updatedAt: state ? at : null, state });

test('travel and PATH VR documents have separate validators, byte limits and CAS deletion commands', () => {
  const trip = document(), vr = pathAccountState(initialState());
  assert.deepEqual(validatePersonalState('path-travel', trip), trip);
  assert.throws(() => validatePersonalState('path-travel', vr), { code: 'PERSONAL_DATA_INVALID' });
  assert.throws(() => validatePersonalState('path', trip), { code: 'PERSONAL_DATA_INVALID' });
  assert.equal(PERSONAL_LIMITS['path-travel'], 512 * 1024);
  assert.equal(PERSONAL_LIMITS.path, 64 * 1024);
  assert.throws(() => parsePersonalState('path-travel', ' '.repeat(512 * 1024 + 1)), { code: 'PERSONAL_DATA_TOO_LARGE' });
  assert.equal(personalWriteRequest('path-travel', 3, trip).resource, 'path-travel');
  assert.deepEqual(personalDeleteRequest('path-travel', 3), { action: 'delete', resource: 'path-travel', expected_revision: 3 });
  assert.equal(validatePersonalResponse(envelope(null, 4), { resource: 'path-travel', accountId: 'fixture-owner' }).state, null);
  assert.throws(() => validatePersonalResponse({ ...envelope(), resource: 'path' }, { resource: 'path-travel', accountId: 'fixture-owner' }));
  assert.throws(() => validatePersonalResponse(envelope(), { resource: 'path-travel', accountId: 'another-owner' }), { code: 'ACCOUNT_CHANGED' });
});

test('account documents cannot grant device storage permission or accept device consent as server authority', () => {
  const trip = document();
  assert.equal(travelDeviceState(trip).consent, false);
  for (const consent of [true, false, 'yes']) assert.throws(() => validatePersonalState('path-travel', { ...trip, consent }));
  assert.throws(() => validatePersonalState('path-travel', { ...trip, accountId: 'other-account' }));
  assert.equal(TRAVEL_ACCOUNT_CONTRACT.productionRegistered, true);
});

test('the official product client uses a travel-only session and fixed travel resource for load/save/delete', async () => {
  const values = new Map([['synk.oauth.session.path', 'untouched-vr-session'], ['synk.oauth.session.path-travel', JSON.stringify({
    access_token: 'synthetic-access', refresh_token: null, expires_at: Date.now() + 3600000,
    configKey: [config.supabaseUrl, config.accountApiUrl, 'fixture-travel', 'http://127.0.0.1:4303/'].join('|') })]]);
  const calls = [];
  const client = await createTravelAccount({ clientKey: 'path', resource: 'path', getUrl: () => 'http://127.0.0.1:4303/',
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    fetcher: async (input, init = {}) => {
      const url = new URL(input);
      if (url.pathname === '/api/account-config') return reply(config);
      calls.push({ url, init });
      assert.equal(url.pathname, '/functions/v1/synk-personal');
      if (init.method === 'GET') assert.equal(url.search, '?resource=path-travel');
      else assert.equal(JSON.parse(init.body).resource, 'path-travel');
      return reply(envelope());
    } });
  assert.equal(calls.length, 0, 'constructing an adapter does not start account access');
  assert.equal((await client.start()).signedIn, true);
  await client.request('personalSave', { expected_revision: 0, state: document() });
  await client.request('personalDelete', { expected_revision: 0 });
  assert.equal(calls.length, 3);
  assert.equal(values.get('synk.oauth.session.path'), 'untouched-vr-session');
  client.dispose();
});

test('an existing PATH VR registration never enables travel synchronization', async () => {
  const onlyVr = { ...config, clients: { path: config.clients.path } };
  const client = await createTravelAccount({ getUrl: () => 'http://127.0.0.1:4303/', fetcher: async () => reply(onlyVr) });
  assert.equal((await client.start()).configured, false);
  await assert.rejects(client.signIn(), { code: 'AUTH_CONFIG' });
  client.dispose();
  assert.equal(readConfig(config, 'http://127.0.0.1:4303/').clients['path-travel'].clientId, 'fixture-travel');
});

test('shared servers expose the exact travel validator dependency graph without config secrets or arbitrary files', async () => {
  const shared = sharedAccountServer({ config });
  await shared.ready;
  assert.equal(shared.configured('path-travel'), true);
  for (const name of ['planner-account', 'planner-storage', 'planner-feedback', 'planner', 'places-v2', 'real-guide', 'real-places', 'real-conditions']) {
    assert.ok(await shared.read(`/path-travel/${name}.mjs`), name);
  }
  for (const name of ['domain', 'travel', 'ask', 'trail-life', 'temper-outcomes']) assert.ok(await shared.read(`/atlas/${name}.js`), name);
  assert.equal(await shared.read('/path-travel/server.mjs'), null);
  assert.equal(await shared.read('/synk-account/config.json'), null);
});
