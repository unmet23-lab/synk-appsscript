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
  return { native, calls, events, resets, create, emit, emitStale:value=>{for(const listener of listeners)listener(clone(value));}, setResponder(value) { responder = value; }, stored: () => clone(stored) };
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

for (const [name, operation, call] of [['저장', 'fortunePut', client => client.save(savedState())], ['조회', 'fortuneGet', client => client.load()], ['삭제', 'fortuneDelete', client => client.remove()]]) {
  test(`계정 전환 뒤 이전 ${name}의 늦은 통신 실패는 ACCOUNT_CHANGED로 폐기한다`, async () => {
    const fixture = nativeFixture(), client = fixture.create();await client.start();
    const gate = deferred();let hold = true;
    fixture.setResponder(next => next === operation && hold ? gate.promise : undefined);
    const pending = call(client), rejected = assert.rejects(pending, error => error.code === 'ACCOUNT_CHANGED');await tick();hold = false;
    fixture.emit(auth(B, 2));await tick();
    const events = fixture.events.length, current = client.snapshot();
    gate.reject(new Error('이전 A 계정의 합성 통신 실패'));await rejected;
    assert.deepEqual(client.snapshot(), current);assert.equal(fixture.events.length, events);client.dispose();
  });

  test(`로그아웃 뒤 이전 ${name}의 늦은 실패는 비회원 안내를 덮지 않는다`, async () => {
    const fixture = nativeFixture(), client = fixture.create();await client.start();
    const gate = deferred();fixture.setResponder(next => next === operation ? gate.promise : undefined);
    const pending = call(client), rejected = assert.rejects(pending, error => error.code === 'ACCOUNT_CHANGED');await tick();
    await client.signOut();const events = fixture.events.length;
    gate.reject(new Error('로그아웃 이전 요청의 합성 통신 실패'));await rejected;
    assert.equal(fixture.events.length, events);assert.equal(client.snapshot().account, null);assert.equal(client.snapshot().ready, false);client.dispose();
  });
}

test('이전 native 재인증 조회의 늦은 실패는 현재 계정 안내를 덮지 않는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();
  const gate = deferred();let hold = true;
  fixture.setResponder(operation => operation === 'fortuneGet' && hold ? gate.promise : undefined);
  fixture.emit(auth(A, 2));await tick();hold = false;
  fixture.emit(auth(B, 3));await tick();
  const events = fixture.events.length, current = client.snapshot();
  gate.reject(new Error('이전 재인증의 합성 통신 실패'));await tick();
  assert.equal(fixture.events.length, events);assert.deepEqual(client.snapshot(), current);client.dispose();
});

test('같은 계정의 토큰 갱신은 작성 화면을 초기화하지 않고 이전 세션 응답만 폐기한다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();await client.save(savedState());
  const resets = fixture.resets.length, delayed = deferred();
  fixture.setResponder(operation => operation === 'fortunePut' ? delayed.promise : undefined);
  const pending = client.save(savedState());const rejected = assert.rejects(pending, error => error.code === 'ACCOUNT_CHANGED');
  fixture.emit(auth(A, 2));await tick();
  assert.equal(fixture.resets.length, resets, '같은 계정의 새 토큰은 app.onReset의 clearScreen으로 작성 메모를 지우면 안 된다');
  assert.equal(client.snapshot().ready, true);assert.deepEqual(client.snapshot().state, savedState());
  delayed.resolve(reply(A, 2, emptyState()));await rejected;
  assert.deepEqual(client.snapshot().state, savedState());
  fixture.emit(auth(B, 3));await tick();
  assert.equal(fixture.resets.length, resets + 1, '다른 계정으로 바뀌면 작성 화면을 반드시 비운다');
  client.dispose();
});

test('새 native 세션보다 늦게 도착한 이전 세션 알림은 현재 계정과 작성 화면을 건드리지 않는다', async () => {
  const fixture = nativeFixture(), client = fixture.create();await client.start();
  fixture.emit(auth(B, 3));await tick();
  const resets = fixture.resets.length, events = fixture.events.length, calls = fixture.calls.length;
  fixture.emitStale(auth(A, 1));await tick();
  fixture.emitStale({ ...auth(A, 2), signedIn: false, status: 'signed-out', account: null });await tick();
  assert.equal(fixture.resets.length, resets, '이전 세션 알림으로 현재 계정의 미저장 화면을 비우면 안 된다');
  assert.equal(fixture.events.length, events);assert.equal(fixture.calls.length, calls);
  assert.equal(client.snapshot().account.synk_user_id, B);assert.equal(client.snapshot().ready, true);client.dispose();
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

test('공개 하위 경로는 같은 디렉터리의 등록 콜백으로만 계정을 연결한다', async () => {
  for (const callback of ['https://fortune-test.invalid/fortune/', 'https://fortune-test.invalid/fortune/index.html']) {
    const events = [];
    const client = createFortuneAccount({ storage: memoryStorage(), onState: state => events.push(state), location: { ...location(), href: 'https://fortune-test.invalid/fortune/' },
      fetcher: async () => json({ ...browserConfig, clients: { platform: { ...browserConfig.clients.platform, redirectUri: callback } } }) });
    await client.start();assert.equal(events.at(-1).status, 'signed-out');client.dispose();
  }
  for (const callback of ['https://fortune-test.invalid/', 'https://fortune-test.invalid/care/', 'https://other-test.invalid/fortune/', 'https://fortune-test.invalid/fortune/?code=x']) {
    const storage = memoryStorage();
    const client = createFortuneAccount({ storage, location: { ...location(), href: 'https://fortune-test.invalid/fortune/' },
      fetcher: async () => json({ ...browserConfig, clients: { platform: { ...browserConfig.clients.platform, redirectUri: callback } } }) });
    await assert.rejects(client.start());assert.deepEqual(storage.calls, []);client.dispose();
  }
});

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
  assert.ok(storage.calls.every(([method, key]) => key === sessionKey || method === 'get' && key === 'synk.platform.entry.fortune'));
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

test('설정 연결의 일시 실패는 미설정으로 숨지 않고 같은 로그인 버튼에서 저장 세션으로 복구한다', async () => {
  const storage = memoryStorage({ [sessionKey]: JSON.stringify({ access_token: 'synthetic-access', expires_at: Date.now() + 3600000 }) });
  const events = [];let offline = true, configCalls = 0;
  const client = createFortuneAccount({ storage, location: location(), onState:value=>events.push(value), fetcher:async input=>{
    if (String(input) === './account-config.json') { configCalls++;if (offline) throw new TypeError('synthetic offline');return json(browserConfig); }
    if (new URL(input).pathname.endsWith('/synk-account')) return json({ ok: true, account: { synk_user_id: A } });
    return json(reply(A));
  } });
  await assert.rejects(client.start(), error => error.retryable === true);
  assert.equal(events.at(-1).retryable, true);assert.notEqual(events.at(-1).status, 'unconfigured');
  offline = false;await client.signIn();assert.equal(configCalls, 2);assert.equal(client.snapshot().ready, true);
  assert.equal(events.at(-1).retryable, false);client.dispose();
});

test('콜백 교환의 일시 실패 뒤에는 검증한 같은 PKCE 요청을 다시 보내고 새 로그인으로 이동하지 않는다', async () => {
  const storage = memoryStorage({ 'synk.oauth.pending.platform': JSON.stringify({ product: 'platform', clientId: 'synthetic-client', redirectUri: 'http://127.0.0.1:4299/', state: 'synthetic-state', verifier: 'synthetic-verifier', createdAt: Date.now() }) });
  const here = { ...location(), href: 'http://127.0.0.1:4299/?code=synthetic-code&state=synthetic-state' }, exchanges = [], events = [];
  const client = createFortuneAccount({ storage, location: here, replaceURL:value=>{here.href=value;}, onState:value=>events.push(value), fetcher:async(input, options)=>{
    if (String(input) === './account-config.json') return json(browserConfig);
    if (new URL(input).pathname.endsWith('/oauth/token')) { exchanges.push(options.body.toString());if (exchanges.length === 1) throw new TypeError('synthetic token network failure');return json({ access_token: 'synthetic-access', expires_in: 3600 }); }
    if (new URL(input).pathname.endsWith('/synk-account')) return json({ ok: true, account: { synk_user_id: A } });
    return json(reply(A));
  } });
  await assert.rejects(client.start(), error => error.retryable === true);
  assert.equal(here.href, 'http://127.0.0.1:4299/');assert.equal(storage.getItem('synk.oauth.pending.platform'), null);
  await client.signIn();assert.equal(exchanges.length, 2);assert.equal(exchanges[1], exchanges[0]);assert.equal(client.snapshot().ready, true);
  assert.equal(JSON.stringify(events).includes('synthetic-verifier'), false);assert.equal(JSON.stringify(events).includes('synthetic-code'), false);client.dispose();
});

for (const boundary of ['terminal', 'logout', 'dispose', 'config-change']) test(`콜백 재시도 원본은 ${boundary} 경계 뒤 다시 전송되지 않는다`, async () => {
  const storage = memoryStorage({ 'synk.oauth.pending.platform': JSON.stringify({ product: 'platform', clientId: 'synthetic-client', redirectUri: 'http://127.0.0.1:4299/', state: 'synthetic-state', verifier: 'synthetic-verifier', createdAt: Date.now() }) });
  const here = { ...location(), href: 'http://127.0.0.1:4299/?code=synthetic-code&state=synthetic-state' };
  let config = browserConfig, exchanges = 0;
  const client = createFortuneAccount({ storage, location: here, replaceURL:value=>{here.href=value;}, fetcher:async input=>{
    if (String(input) === './account-config.json') return json(config);
    assert.ok(new URL(input).pathname.endsWith('/oauth/token'));exchanges++;
    return json({ error: 'synthetic-token-failure' }, boundary === 'terminal' ? 400 : 503);
  } });
  await assert.rejects(client.start());assert.equal(exchanges, 1);
  if (boundary === 'logout') await client.signOut();
  if (boundary === 'dispose') { client.dispose();await assert.rejects(client.start(), error=>error.code==='ACCOUNT_CHANGED'); }
  else {
    if (boundary === 'config-change') {
      config = { ...browserConfig, clients: { platform: { ...browserConfig.clients.platform, clientId: 'synthetic-other-client' } } };
      await assert.rejects(client.start(), error=>error.code==='AUTH_REQUIRED');
    }
    assert.equal((await client.start()).ready, false);client.dispose();
  }
  assert.equal(exchanges, 1);assert.equal(storage.getItem(sessionKey), null);
});

test('초기 토큰 갱신 일시 실패는 저장 세션을 지우지 않고 재시도하며 중복 시작은 한 요청으로 합친다', async () => {
  const original = JSON.stringify({ access_token: 'synthetic-old-access', refresh_token: 'synthetic-refresh', expires_at: 0 });
  const storage = memoryStorage({ [sessionKey]: original }), gate = deferred();let configCalls = 0, exchanges = 0;
  const client = createFortuneAccount({ storage, location: location(), fetcher:async(input, options)=>{
    if (String(input) === './account-config.json') { configCalls++;await gate.promise;return json(browserConfig); }
    if (new URL(input).pathname.endsWith('/oauth/token')) {
      assert.equal(options.body.get('grant_type'), 'refresh_token');exchanges++;
      if (exchanges === 1) throw new TypeError('synthetic offline refresh');
      return json({ access_token: 'synthetic-new-access', refresh_token: 'synthetic-new-refresh', expires_in: 3600 });
    }
    if (new URL(input).pathname.endsWith('/synk-account')) return json({ ok: true, account: { synk_user_id: A } });
    return json(reply(A));
  } });
  const first = client.start(), duplicate = client.start();assert.equal(first, duplicate);gate.resolve();
  await assert.rejects(first, error=>error.retryable===true);assert.equal(configCalls, 1);assert.equal(storage.getItem(sessionKey), original);
  await client.signIn();assert.equal(client.snapshot().ready, true);assert.equal(exchanges, 2);client.dispose();
});
