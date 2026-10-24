import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersonalPanelOwner, createSessionOwner } from '../public/messenger-state.js';
import { createApiClient, createBootstrapRefresh, createCompanySessionRecovery } from '../public/messenger-session.js';

// The real session owner, transport and bootstrap refresh, wired the way app.js wires them,
// with the network and the desktop workspace page replaced.
function fixture({ nativeRecovery = null, embedded = true } = {}) {
  const requests = [], calls = [];
  const state = {
    user: { id: 'messenger-user-1' },
    integrated: { companyUserId: 'company-user-1', csrfToken: 'session-token-1', canWrite: true },
    transferSession: 0, queues: new Map(), sendAttempts: new Map(), events: null,
    workNotificationSession: 0, workNotificationRevision: 0, scheduledNotifications: { enabled: true }, personalSeq: 0,
  };
  const originalIntegrated = state.integrated;
  const host = { location: { origin: 'http://local' }, ensureNativeSynkCompanySession: () => nativeRecovery?.() };
  const session = createSessionOwner(state);
  const personal = createPersonalPanelOwner(state, {
    cancelRefresh() {}, setNotificationStatus: (enabled, options) => personal.applyNotificationStatus(enabled, options),
    showReminderStatus() {}, setTimer: () => 0, clearTimer() {},
  });
  const companySessionRecovery = createCompanySessionRecovery({
    state, session, embedded: () => embedded, parent: () => host, origin: () => 'http://local', reconnectEvents: () => calls.push('reconnect'),
  });
  const api = createApiClient({
    state, session, moduleUrl: path => path, sessionRecovery: () => companySessionRecovery(), companyHosted: () => embedded,
    fetch: (path, options) => new Promise(resolve => requests.push({ path, options, resolve })),
    abortController: () => new AbortController(), setTimer: setTimeout, clearTimer: clearTimeout,
    onCompanyLoginExpired: () => calls.push('company-login'), onLoginExpired: () => { session.expire(); calls.push('login'); },
  });
  const refreshBootstrap = createBootstrapRefresh({
    state, session, personal, api, canWrite: () => state.integrated?.canWrite !== false,
    setNotificationStatus: enabled => { state.scheduledNotifications = { enabled }; },
    updateStorage: provider => calls.push(['storage', provider]), applyPermissions: () => calls.push('permissions'), refreshDetails: async () => calls.push('details'),
  });
  const respond = (path, data, { ok = true, status = 200 } = {}) => {
    const request = requests.find(item => item.path === path && !item.responded);
    assert.ok(request, `Expected pending request for ${path}`);
    request.responded = true;
    request.resolve({ ok, status, json: async () => data });
  };
  const bootstrap = integrated => ({
    user: { id: 'messenger-user-1' },
    integrated: { companyUserId: 'company-user-1', csrfToken: 'session-token-1', canWrite: true, ...integrated },
    scheduledNotifications: { enabled: true },
  });
  return { state, originalIntegrated, requests, calls, session, api, refreshBootstrap, companySessionRecovery, respond, bootstrap };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('an SSE bootstrap refresh keeps concurrent assigned-task reads valid for the same login', async () => {
  const f = fixture();
  const tasks = f.api('/api/tasks?scope=mine');
  const refresh = f.refreshBootstrap();
  await settle();
  f.respond('/api/bootstrap', f.bootstrap({ canManage: true, canWrite: false }));
  await refresh;
  assert.equal(f.state.integrated, f.originalIntegrated);
  assert.equal(f.state.integrated.canManage, true);
  assert.equal(f.state.integrated.canWrite, false);
  assert.deepEqual(f.calls, ['permissions', 'details'], 'losing write permission redraws the composer and detail views');
  await settle();
  f.respond('/api/tasks?scope=mine', { tasks: [{ id: 'assigned-task-1' }] });
  assert.equal((await tasks).tasks[0].id, 'assigned-task-1');
});

test('a same-login bootstrap refresh keeps an already-pending native session recovery valid', async () => {
  let finishRecovery, recoveries = 0;
  const session = { companyUserId: 'company-user-1', csrfToken: 'session-token-1' };
  const pendingRecovery = new Promise(resolve => { finishRecovery = resolve; });
  const f = fixture({ nativeRecovery: () => ++recoveries === 1 ? pendingRecovery : session });
  const recovery = f.companySessionRecovery();
  const refresh = f.refreshBootstrap();
  await settle();
  f.respond('/api/bootstrap', f.bootstrap({ canManage: true }));
  await refresh;
  finishRecovery(session);
  await recovery;
  assert.equal(f.state.integrated, f.originalIntegrated);
});

for (const [label, change] of [
  ['company account', { companyUserId: 'company-user-2' }],
  ['CSRF token', { csrfToken: 'session-token-2' }],
]) {
  test(`an actual ${label} change still rejects an in-flight request`, async () => {
    const f = fixture();
    const tasks = f.api('/api/tasks?scope=mine');
    const rejected = assert.rejects(tasks, /로그인이 바뀌어 하던 요청을 멈췄어요/);
    const refresh = f.refreshBootstrap();
    await settle();
    f.respond('/api/bootstrap', f.bootstrap(change));
    await refresh;
    assert.notEqual(f.state.integrated, f.originalIntegrated);
    f.respond('/api/tasks?scope=mine', { tasks: [] });
    await rejected;
  });
}

test('an actual messenger-user change still rejects an in-flight request', async () => {
  const f = fixture();
  const tasks = f.api('/api/tasks?scope=mine');
  const rejected = assert.rejects(tasks, /로그인이 바뀌어 하던 요청을 멈췄어요/);
  await settle();
  f.state.user = { id: 'messenger-user-2' };
  f.respond('/api/tasks?scope=mine', { tasks: [] });
  await rejected;
});

test('a bootstrap reply for another messenger user or an older panel session is ignored', async () => {
  const f = fixture();
  let refresh = f.refreshBootstrap();
  await settle();
  f.respond('/api/bootstrap', { ...f.bootstrap({ canWrite: false }), user: { id: 'messenger-user-2' } });
  await refresh;
  assert.equal(f.state.integrated.canWrite, true);
  assert.equal(f.state.user.id, 'messenger-user-1');
  refresh = f.refreshBootstrap();
  await settle();
  f.state.workNotificationSession++;
  f.respond('/api/bootstrap', f.bootstrap({ canWrite: false }));
  await refresh;
  assert.equal(f.state.integrated.canWrite, true);
  assert.deepEqual(f.calls, []);
});

test('a native recovery for another company account or transfer session is refused, a new CSRF reconnects live updates', async () => {
  let next = { companyUserId: 'company-user-2', csrfToken: 'session-token-1' };
  const f = fixture({ nativeRecovery: () => next });
  await assert.rejects(f.companySessionRecovery(), /로그인이 바뀌어/);
  next = { companyUserId: 'company-user-1', csrfToken: 'session-token-1' };
  const pending = f.companySessionRecovery();
  f.session.resetTransfers();
  await assert.rejects(pending, /로그인이 바뀌어/);
  f.state.events = { close() {} };
  next = { companyUserId: 'company-user-1', csrfToken: 'session-token-2' };
  await f.companySessionRecovery();
  assert.equal(f.state.integrated.csrfToken, 'session-token-2');
  assert.deepEqual(f.calls, ['reconnect']);
  assert.equal(fixture({ embedded: false, nativeRecovery: () => next }).companySessionRecovery(), null, 'a standalone page never asks the desktop workspace');
});

test('writes carry JSON and the company CSRF token; expired logins hand off to the right login screen', async () => {
  const f = fixture();
  const write = f.api('/api/messages', { method: 'POST', body: { body: '안녕' } });
  await settle();
  assert.equal(f.requests[0].options.headers['X-CSRF-Token'], 'session-token-1');
  assert.equal(f.requests[0].options.headers['Content-Type'], 'application/json');
  assert.equal(f.requests[0].options.body, '{"body":"안녕"}');
  assert.equal(f.requests[0].options.credentials, 'same-origin');
  f.respond('/api/messages', { error: '만료' }, { ok: false, status: 401 });
  await assert.rejects(write, /회사 계정으로 다시 로그인해 주세요/);
  assert.deepEqual(f.calls, ['company-login']);
  const standalone = fixture({ embedded: false });
  standalone.state.queues.set('c1', [{ xhr: { abort() { standalone.calls.push('abort'); } } }]);
  const read = standalone.api('/api/channels');
  await settle();
  standalone.respond('/api/channels', { error: '다시 로그인해 주세요.', code: 'AUTH' }, { ok: false, status: 401 });
  await assert.rejects(read, error => error.status === 401 && error.code === 'AUTH' && /다시 로그인/.test(error.message));
  assert.deepEqual(standalone.calls, ['abort', 'login']);
  assert.equal(standalone.state.user, null);
  assert.equal(standalone.state.queues.size, 0);
});
