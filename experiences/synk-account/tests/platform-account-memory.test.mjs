// The web platform's account bridge (src/platform-account.mjs) for 「내 성향」 settings: the account's
// learning-memory policy (capabilities.learningSync) and the two memory routes the SDK already has.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformAccount } from '../src/platform-account.mjs';

function setup({ capabilities } = {}) {
  const storage = new Map([['synk.oauth.session.platform', JSON.stringify({ access_token: 'synthetic-access' })]]), calls = [];
  const client = {
    load: async () => ({ ok: true, account: { synk_user_id: 'synthetic-owner', profile: { display_name: '합성 회원' } }, ...(capabilities ? { capabilities } : {}) }),
    atlasSummary: async () => ({ ok: true }),
    learningPost: async () => assert.fail('the learning log is not a platform route'),
    memory: Object.freeze({
      get: async params => { calls.push(['get', params]); return { ok: true, revision: params.revision, entries: [] }; },
      post: async params => { calls.push(['post', params]); return { ok: true, revision: params.revision, entries: params.entries }; },
    }),
  };
  const account = createPlatformAccount({
    config: { configured: true, clients: { platform: { clientId: 'synthetic-client', redirectUri: 'https://synthetic.invalid/platform' } }, accountApiUrl: 'https://synthetic.invalid', supabasePublishableKey: 'synthetic-key' },
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    accountFactory: () => client, requestToken: async () => assert.fail('no token refresh'), fetcher: async () => assert.fail('no network') });
  return { account, calls };
}

test('learningSync follows the account policy and is never true before sign-in or after stopping', async () => {
  for (const [capabilities, expected] of [[{ learningSync: true }, true], [{ learningSync: false }, false], [undefined, false], [{ learningSync: 'yes' }, false]]) {
    const { account } = setup({ capabilities });
    assert.equal(account.identity().learningSync, false);
    await account.refresh();
    assert.equal(account.identity().signedIn, true);assert.equal(account.identity().learningSync, expected);
    account.stop();assert.equal(account.identity().learningSync, false);
  }
});

test('memory reads and writes use the SDK memory routes with the learning revision, and malformed requests never leave', async () => {
  const { account, calls } = setup({ capabilities: { learningSync: true } });
  await account.refresh();
  const read = await account.request('memoryGet', { revision: 7 });
  assert.equal(read.revision, 7);assert.deepEqual(calls.at(-1), ['get', { revision: 7 }]);
  const entries = [{ kind: 'presentation', key: 'chosen', value: { support: 'step' }, at: '2026-10-19T03:00:00.000Z' }];
  await account.request('memoryPost', { revision: 7, entries, extra: 'ignored' });
  assert.deepEqual(calls.at(-1), ['post', { revision: 7, entries }], 'only the revision and entries are passed on');
  const before = calls.length;
  for (const [operation, params] of [['memoryGet', {}], ['memoryGet', { revision: '7' }], ['memoryPost', { revision: 7 }], ['memoryPost', { revision: 7, entries: [] }], ['memoryPost', { revision: 7, entries: Array(101).fill(entries[0]) }]])
    await assert.rejects(account.request(operation, params), { code: 'INVALID_REQUEST' });
  await assert.rejects(account.request('learningPost', { revision: 7, events: [] }), { code: 'ACCOUNT_CHANGED' });
  assert.equal(calls.length, before);
});
