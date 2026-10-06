import test from 'node:test';
import assert from 'node:assert/strict';
import { createFortuneAccount } from '../account.mjs';
import { emptyState, birthProfile, saveReading } from '../account-state.mjs';
import { getFortune } from '../core.mjs';

// Every identity, token, response and transport in this file is synthetic; no network or real PII.
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const sessionKey = 'synk.oauth.session.fortune';
const clone = value => structuredClone(value);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject;const promise = new Promise((res, rej) => { resolve = res;reject = rej; });return { promise, resolve, reject }; };
const auth = (id = A, generation = 1) => ({ configured: true, signedIn: true, status: 'signed-in', sessionGeneration: generation, account: { synk_user_id: id, display_name: '합성 시험 계정' } });
const reply = (id = A, revision = 0, state = emptyState()) => ({ ok: true, account: { synk_user_id: id }, revision, state: clone(state) });
const failure = (code, status = 409) => ({ ok: false, error: { code, status } });
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial)), calls = [];
  return { calls, getItem(key) { calls.push(['get', key]);return values.get(key) ?? null; }, setItem(key, value) { calls.push(['set', key]);values.set(key, value); }, removeItem(key) { calls.push(['remove', key]);values.delete(key); } };
}
function nativeFixture() {
  let current = auth(), stored = emptyState(), revision = 0;
  const listeners = new Set(), calls = [], events = [], resets = [];
  let responder;
  const native = {
    async authStatus() { return clone(current); },
    onAuthChanged(fn) { listeners.add(fn);return () => listeners.delete(fn); },
    async authSignIn() { return clone(current); },
    async authSignOut() { emit({ ...auth(), signedIn: false, status: 'signed-out', account: null, sessionGeneration: current.sessionGeneration + 1 }); },
    async request(operation, params) {
      calls.push({ operation, params: clone(params) });
      if (responder) { const special = responder(operation, params);if (special !== undefined) return special; }
      if (operation === 'load') return { ok: true, account: { synk_user_id: current.account?.synk_user_id || A, profile: { display_name: '합성 시험 계정' } } };
      if (operation === 'fortuneGet') return reply(current.account?.synk_user_id || A, revision, stored);
      if (params.expected_revision !== revision) return failure('REVISION_CONFLICT');
      if (operation === 'fortunePut') stored = clone(params.state);
      if (operation === 'fortuneDelete') stored = emptyState();
      revision++;return reply(current.account?.synk_user_id || A, revision, stored);
    },
  };
  function emit(value) { current = value;for (const listener of listeners) listener(clone(value)); }
  const create = () => createFortuneAccount({ native, storage: memoryStorage(), onState: state => events.push(clone(state)), onReset: () => resets.push(true) });
  return { native, calls, events, resets, create, emit, setResponder(value) { responder = value; }, stored: () => clone(stored) };
}
function savedState() {
  return { ...saveReading(emptyState(), getFortune('aries', '2026-10-06', 'western'), {
    id: '33333333-3333-4333-8333-333333333333', now: '2026-10-06T10:00:00.000Z', note: '합성 회고', completed: true,
  }), profile: birthProfile('2000-02-29', '08:30'), preferences: { mode: 'western', signId: 'aries' } };
}

test('native 계정에 프로필·기록을 저장한 뒤 새 클라이언트에서 다시 읽고 전체 삭제한다', async () => {
  const fixture = nativeFixture(), first = fixture.create();
  await first.start();const desired = savedState();
  const saved = await first.save(desired);
  assert.deepEqual(saved.state, desired);assert.equal(saved.revision, 1);
  first.dispose();
  const reopened = fixture.create();
  assert.deepEqual((await reopened.start()).state, desired);
  const removed = await reopened.remove();
  assert.deepEqual(removed.state, emptyState());assert.equal(removed.revision, 2);
  reopened.dispose();
});

test('revision 충돌은 실패로 남고 기존 문서나 서버 문서를 덮어쓰지 않는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();
  fixture.setResponder(operation => operation === 'fortunePut' ? failure('REVISION_CONFLICT') : undefined);
  const before = client.snapshot(), eventCount = fixture.events.length;
  await assert.rejects(client.save(savedState()), error => error.code === 'REVISION_CONFLICT');
  assert.deepEqual(client.snapshot(), before);
  assert.deepEqual(fixture.stored(), emptyState());
  assert.equal(fixture.events.slice(eventCount).some(state => /불러왔어요|저장했어요/.test(state.message)), false);
  client.dispose();
});

test('타 계정 응답은 저장 성공으로 받아들이지 않는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();
  await client.save(savedState());
  fixture.setResponder(operation => operation === 'fortunePut' ? reply(B, 2, savedState()) : undefined);
  await assert.rejects(client.save(savedState()), error => error.code === 'ACCOUNT_CHANGED');
  assert.equal(client.snapshot().account, null);
  assert.equal(client.snapshot().ready, false);
  assert.deepEqual(client.snapshot().state, emptyState());
  client.dispose();
});

test('AUTH_REQUIRED·SESSION_REVOKED를 받으면 이미 읽은 프로필과 기록도 즉시 비운다', async () => {
  for (const code of ['AUTH_REQUIRED', 'SESSION_REVOKED']) {
    const fixture = nativeFixture(), client = fixture.create();await client.start();await client.save(savedState());
    fixture.setResponder(operation => operation === 'fortunePut' ? failure(code, 401) : undefined);
    await assert.rejects(client.save(savedState()), error => error.code === code);
    assert.equal(client.snapshot().account, null, code);
    assert.equal(client.snapshot().ready, false, code);
    assert.deepEqual(client.snapshot().state, emptyState(), code);
    assert.equal(fixture.events.at(-1).ready, false, code);
    client.dispose();
  }
});

test('로그아웃 뒤 도착한 저장 응답은 계정과 기록을 다시 채우지 않는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();
  const delayed = deferred();fixture.setResponder(operation => operation === 'fortunePut' ? delayed.promise : undefined);
  const pending = client.save(savedState());const rejected = assert.rejects(pending, error => error.code === 'ACCOUNT_CHANGED');
  await client.signOut();delayed.resolve(reply(A, 1, savedState()));await rejected;
  assert.equal(client.snapshot().account, null);
  assert.equal(client.snapshot().ready, false);
  assert.deepEqual(client.snapshot().state, emptyState());
  client.dispose();
});

test('계정 전환 뒤 이전 계정의 지연 저장 응답을 폐기한다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();
  const delayed = deferred();fixture.setResponder(operation => operation === 'fortunePut' ? delayed.promise : undefined);
  const pending = client.save(savedState());const rejected = assert.rejects(pending, error => error.code === 'ACCOUNT_CHANGED');
  fixture.emit(auth(B, 2));await tick();
  assert.equal(client.snapshot().account.synk_user_id, B);
  delayed.resolve(reply(A, 1, savedState()));await rejected;
  assert.equal(client.snapshot().account.synk_user_id, B);
  assert.deepEqual(client.snapshot().state, emptyState());
  client.dispose();
});

test('계정 저장 서비스 실패나 잘못된 저장 문서는 성공 상태로 반영하지 않는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();
  for (const bad of [failure('SERVICE_UNAVAILABLE', 503), { ...reply(A, 1), state: { ...emptyState(), credential: 'forbidden' } }]) {
    fixture.setResponder(operation => operation === 'fortunePut' ? bad : undefined);
    await assert.rejects(client.save(savedState()));
    assert.deepEqual(client.snapshot().state, emptyState());assert.equal(client.snapshot().revision, 0);
  }
  client.dispose();
});

test('계정 상태로 저장이 거절되면 상태 확인을 안내하고 다시 읽기 전의 추가 쓰기를 막는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();await client.save(savedState());
  fixture.setResponder(operation => operation === 'fortunePut' ? failure('ACCOUNT_UNAVAILABLE', 403) : undefined);
  await assert.rejects(client.save(savedState()), error => error.code === 'ACCOUNT_UNAVAILABLE' && /계정 상태/.test(error.message) && /다시 불러/.test(error.message));
  assert.equal(client.snapshot().ready, false);assert.equal(client.snapshot().revision, null);
  assert.equal(client.snapshot().account.synk_user_id, A);assert.deepEqual(client.snapshot().state, savedState());
  assert.equal(fixture.events.at(-1).ready, false);assert.match(fixture.events.at(-1).message, /삭제 요청/);
  const previousCalls = fixture.calls.length;
  await assert.rejects(client.save(savedState()), /먼저 불러/);await assert.rejects(client.remove(), /먼저 불러/);
  assert.equal(fixture.calls.length, previousCalls);
  fixture.setResponder(undefined);await client.load();assert.equal(client.snapshot().ready, true);
  assert.equal((await client.save(savedState())).revision, 2);client.dispose();
});

test('일시적인 ACCOUNT_UNAVAILABLE 서버 오류는 계정 상태 거절로 표시하거나 저장 버전을 버리지 않는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();
  fixture.setResponder(operation => operation === 'fortunePut' ? failure('ACCOUNT_UNAVAILABLE', 503) : undefined);
  await assert.rejects(client.save(savedState()), error => error.code === 'ACCOUNT_UNAVAILABLE' && !/삭제 요청/.test(error.message));
  assert.equal(client.snapshot().ready, true);assert.equal(client.snapshot().revision, 0);client.dispose();
});

test('load가 같은 native auth 상태를 알리더라도 중복 load 루프를 만들지 않는다', async () => {
  const fixture = nativeFixture();let emitted = false;
  fixture.setResponder(operation => {
    if (operation === 'load' && !emitted) { emitted = true;fixture.emit(auth()); }
  });
  const client = fixture.create();await client.start();await tick();
  const loadCalls = fixture.calls.filter(item => item.operation === 'load').length;
  client.dispose();
  assert.equal(loadCalls, 1, '동일 auth 이벤트는 진행 중인 읽기 하나에 합쳐져야 한다');
});

test('native 로그아웃 상태에서는 broker에 남은 응답만으로 계정 읽기를 다시 시작하지 않는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();await client.signOut();
  const callCount = fixture.calls.length;
  await assert.rejects(client.load());
  assert.equal(fixture.calls.length, callCount);
  assert.equal(client.snapshot().account, null);
  client.dispose();
});

test('로그아웃보다 늦게 도착한 초기 native authStatus는 로그인 상태를 되살리지 않는다', async () => {
  const fixture = nativeFixture(), delayed = deferred();
  fixture.native.authStatus = () => delayed.promise;
  const client = fixture.create();
  const pending = client.start();const rejected = assert.rejects(pending, error => error.code === 'ACCOUNT_CHANGED');
  await client.signOut();delayed.resolve(auth());await rejected;
  assert.equal(client.snapshot().account, null);
  assert.equal(fixture.calls.length, 0);
  client.dispose();
});

const browserConfig = {
  version: 1, supabaseUrl: 'https://auth.fortune-test.invalid', accountApiUrl: 'https://account.fortune-test.invalid',
  portalUrl: 'https://portal.fortune-test.invalid', supabasePublishableKey: 'sb_publishable_synthetic_fortune_test',
  clients: { platform: { clientId: 'synthetic-client', redirectUri: 'http://127.0.0.1:4299/' } },
};
const location = () => ({ href: 'http://127.0.0.1:4299/', assign() { throw new Error('OAuth navigation was not requested in this test'); } });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('공개 계정 설정이 없으면 sessionStorage를 읽거나 게스트 기록을 저장하지 않는다', async () => {
  const storage = memoryStorage(), calls = [], events = [];
  const client = createFortuneAccount({ storage, location: location(), fetcher: async (...args) => { calls.push(args);return json({ version: 1 }); }, onState: value => events.push(value) });
  const snapshot = await client.start();
  assert.equal(snapshot.ready, false);
  assert.equal(calls.length, 1);assert.equal(calls[0][0], './account-config.json');
  assert.deepEqual(storage.calls, []);
  await assert.rejects(client.save(savedState()));
  assert.deepEqual(storage.calls, []);
  assert.equal(events.at(-1).status, 'unconfigured');
  client.dispose();
});

test('sessionStorage 접근 자체가 금지된 환경도 공개 설정 전에는 게스트로 열린다', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('synthetic blocked sessionStorage'); } });
  let client;
  try {
    client = createFortuneAccount({ location: location(), fetcher: async () => json({ version: 1 }) });
    assert.equal((await client.start()).ready, false);
  } finally {
    client?.dispose();
    if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous);else delete globalThis.sessionStorage;
  }
});

test('브라우저 연결은 계정별 GET/POST와 revision을 사용하고 운세 본문은 세션 저장소에 쓰지 않는다', async () => {
  const storage = memoryStorage({ [sessionKey]: JSON.stringify({ access_token: 'synthetic-access', expires_at: Date.now() + 3_600_000 }) });
  const calls = [];let stored = emptyState(), revision = 0;
  const fetcher = async (input, options) => {
    if (String(input) === './account-config.json') return json(browserConfig);
    const url = new URL(input);calls.push({ pathname: url.pathname, ...options });
    assert.equal(options.credentials, 'omit');assert.equal(options.redirect, 'error');assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-access');assert.equal(options.headers['X-SYNK-Product'], 'platform');
    if (url.pathname === '/functions/v1/synk-account') return json({ ok: true, account: { synk_user_id: A } });
    assert.equal(url.pathname, '/functions/v1/synk-fortune');
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);assert.equal(body.expected_revision, revision);assert.equal(body.action, 'save');
      stored = clone(body.state);revision++;
    }
    return json(reply(A, revision, stored));
  };
  const first = createFortuneAccount({ storage, location: location(), fetcher });
  await first.start();await first.save(savedState());first.dispose();
  const reopened = createFortuneAccount({ storage, location: location(), fetcher });
  assert.deepEqual((await reopened.start()).state, savedState());
  assert.equal(calls.filter(item => item.method === 'POST').length, 1);
  assert.equal(storage.calls.some(([method]) => method === 'set'), false);
  assert.ok(storage.calls.every(([, key]) => key === sessionKey));
  reopened.dispose();
});

test('로그아웃 후 도착한 OAuth 코드 교환 응답은 세션을 저장하거나 계정을 열지 않는다', async () => {
  const storage = memoryStorage({ 'synk.oauth.pending.platform': JSON.stringify({
    product: 'platform', clientId: 'synthetic-client', redirectUri: 'http://127.0.0.1:4299/',
    state: 'synthetic-state', verifier: 'synthetic-verifier', createdAt: Date.now(),
  }) });
  const delayed = deferred(), calls = [], replacements = [];
  const fetcher = async (input, options) => {
    if (String(input) === './account-config.json') return json(browserConfig);
    const pathname = new URL(input).pathname;calls.push(pathname);
    if (pathname === '/auth/v1/oauth/token') return delayed.promise;
    if (pathname === '/functions/v1/synk-account') return json({ ok: true, account: { synk_user_id: A } });
    return json(reply(A));
  };
  const client = createFortuneAccount({ storage, fetcher,
    location: { ...location(), href: 'http://127.0.0.1:4299/?code=synthetic-code&state=synthetic-state' },
    replaceURL: value => replacements.push(value) });
  const pending = client.start();const rejected = assert.rejects(pending, error => error.code === 'ACCOUNT_CHANGED');
  await tick();assert.deepEqual(calls, ['/auth/v1/oauth/token']);
  await client.signOut();delayed.resolve(json({ access_token: 'synthetic-late-access', refresh_token: 'synthetic-late-refresh', expires_in: 3600 }));
  await rejected;
  assert.equal(client.snapshot().account, null);
  assert.equal(storage.calls.some(([method]) => method === 'set'), false);
  assert.deepEqual(calls, ['/auth/v1/oauth/token']);
  assert.deepEqual(replacements, ['http://127.0.0.1:4299/']);
  client.dispose();
});
