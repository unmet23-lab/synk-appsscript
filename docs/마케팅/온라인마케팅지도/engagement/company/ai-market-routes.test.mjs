import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiMarketRoutes } from './ai-market-routes.mjs';

const origin = 'https://market.example.test', prefix = '/api/customer/ai-market';
const userId = '11111111-1111-4111-8111-111111111111';

test('logout queued after the body helper returns cannot commit a market write', async () => {
  const auth = { user: { synkUserId: userId }, csrfToken: 'fixture' };
  let current = true, checks = 0, writes = 0, response;
  const identity = {
    authenticate: async () => current ? auth : null,
    isCurrent: value => current && value === auth,
    requireCsrf() {
      if (!current) throw Object.assign(new Error('revoked'), { status: 401 });
      if (++checks === 2) queueMicrotask(() => { current = false; });
    },
  };
  const routes = createAiMarketRoutes({ identity, origin, clientAddress: () => 'fixture',
    market: { saveProfile() { writes++; return {}; } },
    body: async () => ({ revision: 0, displayName: '작성자', bio: '' }),
    send: (res, status, data) => { response = { status, data }; },
  });
  await routes({ method: 'PUT', headers: { origin } }, { setHeader() {} }, new URL(origin + prefix + '/profile'));
  assert.equal(response.status, 401); assert.equal(writes, 0);
});

for (const suffix of ['/posts?saved=true', '/posts/22222222-2222-4222-8222-222222222222/bookmark']) {
  test('private market reads recheck after async authentication: ' + suffix, async () => {
    const auth = { user: { synkUserId: userId } };
    let current = true, reads = 0, checks = 0, response;
    const identity = { authenticate: async () => auth, isCurrent(value) {
      if (++checks === 1) queueMicrotask(() => { current = false; });
      return current && value === auth;
    } };
    const routes = createAiMarketRoutes({ identity, origin, clientAddress: () => 'fixture', body: async () => ({}),
      market: { listPosts() { reads++; return { items: [] }; }, getPost() { reads++; return {}; }, isBookmarked() { reads++; return true; } },
      send: (res, status, data) => { response = { status, data }; },
    });
    await routes({ method: 'GET', headers: {} }, { setHeader() {} }, new URL(origin + prefix + suffix));
    assert.equal(response.status, 401); assert.equal(reads, 0);
  });
}

test('bounded public requests are rejected without changing unrelated customer route admission', async () => {
  let reads = 0, response, stamp = 0;
  const routes = createAiMarketRoutes({ identity: {}, market: { listPosts() { reads++; return { items: [] }; } },
    origin, clientAddress: () => 'fixture', now: () => stamp, body: async () => ({}), send: (res, status) => { response = status; },
  });
  const req = { method: 'GET', headers: {} }, res = { setHeader() {} };
  for (let i = 0; i < 600; i++) assert.equal(await routes(req, res, new URL(origin + prefix + '/posts')), true);
  await routes(req, res, new URL(origin + prefix + '/posts')); assert.equal(response, 429); assert.equal(reads, 600);
  assert.equal(await routes(req, res, new URL(origin + '/api/customer/logout')), false);
  stamp = 60001; await routes(req, res, new URL(origin + prefix + '/posts')); assert.equal(response, 200);
});
