import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createFortuneAccount } from '../account.mjs';
import { emptyState, birthProfile, saveReading } from '../account-state.mjs';
import { getSaju } from '../saju-core.mjs';
import { getFortune } from '../core.mjs';

// Optional cross-repository contract check. PostgreSQL/auth-provider proofs live in SYNK-talk.
const serverURL = new URL('../../../../SYNK-talk/lib/fortune-server.js', import.meta.url);
test('실제 운세 서버 계약과 브라우저 클라이언트로 두 계정·두 기기의 저장과 복원을 왕복한다', { skip: !existsSync(serverURL) }, async () => {
  const { createFortuneService } = createRequire(import.meta.url)(fileURLToPath(serverURL));
  const records = new Map(), requests = [];
  const store = { async withAccount(identity, product, callback) {
    assert.equal(product, 'platform');
    const id = identity.id;
    const read = () => structuredClone(records.get(id) || { revision: 0, state: emptyState() });
    return callback({ account: { synk_user_id: id, status: 'active' }, ready: async () => true, read,
      async write(expected, state) {
        const current = read();
        if (expected !== current.revision) throw Object.assign(new Error('conflict'), { status: 409, code: 'REVISION_CONFLICT', revision: current.revision });
        const next = { revision: current.revision + 1, state: state || emptyState() };records.set(id, structuredClone(next));return next;
      } });
  } };
  const ids = { 'synthetic-a': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'synthetic-b': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
  const service = createFortuneService({ store, verify: async request => {
    const id = ids[request.headers.get('authorization')?.replace('Bearer ', '')];
    if (!id) throw Object.assign(new Error('auth'), { status: 401, code: 'AUTH_REQUIRED' });
    return { id, product: 'platform' };
  } });
  const config = { version: 1, supabaseUrl: 'https://fortune-contract.invalid', accountApiUrl: 'https://fortune-contract.invalid',
    portalUrl: 'https://portal-contract.invalid/', supabasePublishableKey: 'sb_publishable_synthetic_test', clients: { platform: { clientId: 'synthetic-client', redirectUri: 'http://127.0.0.1:4299/' } } };
  const fetcher = async (value, options = {}) => {
    if (value === './account-config.json') return Response.json(config);
    const request = new Request(value, options);requests.push(request.url);
    if (request.url.endsWith('/synk-account')) return Response.json({ ok: true, account: { synk_user_id: ids[request.headers.get('authorization').replace('Bearer ', '')], profile: { display_name: '합성 계정' } } });
    assert.ok(request.url.endsWith('/synk-fortune'));return service(request);
  };
  const client = async token => {
    const saved = new Map([['synk.oauth.session.fortune', JSON.stringify({ access_token: token, expires_at: Date.now() + 3600000 })]]);
    const connection = createFortuneAccount({ fetcher, storage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }, location: { href: 'http://127.0.0.1:4299/' } });
    await connection.start();return connection;
  };
  const a = await client('synthetic-a'), b = await client('synthetic-b');
  let state = saveReading(emptyState(), getSaju({ birthDate: '1996-02-29', birthTime: '07:35' }), { note: '내 첫 메모 🐈', completed: true });
  state.profile = birthProfile('1996-02-29', '07:35');state.preferences = { mode: 'korean', signId: 'pisces' };
  await a.save(state);
  const a2 = await client('synthetic-a');assert.deepEqual(a2.snapshot().state, state);assert.deepEqual(b.snapshot().state, emptyState());
  state = saveReading(state, getFortune('pisces', undefined, 'western'), { note: '별자리도 보관' });
  await a.save(state);
  await assert.rejects(a2.save(a2.snapshot().state), error => error.code === 'REVISION_CONFLICT');
  await a2.load();assert.equal(a2.snapshot().state.entries.length, 2);
  const revision = a2.snapshot().revision;await a2.remove();assert.equal(a2.snapshot().revision, revision + 1);
  await assert.rejects(a.save(state), error => error.code === 'REVISION_CONFLICT');
  const a3 = await client('synthetic-a');assert.deepEqual(a3.snapshot().state, emptyState());assert.equal(a3.snapshot().revision, revision + 1);
  assert.ok(requests.every(url => !url.includes('birthDate') && !url.includes('synthetic-a')));
  for (const connection of [a, a2, a3, b]) connection.dispose();
});
