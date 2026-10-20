import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const recoverySource = source.slice(source.indexOf('function companySessionRecovery('), source.indexOf('async function api('));
const apiSource = source.slice(source.indexOf('async function api('), source.indexOf('function draftKey('));
const refreshSource = source.slice(source.indexOf('async function refreshStorageProvider('), source.indexOf('function storageNote('));

function fixture({ nativeRecovery = null } = {}) {
  const requests = [];
  const state = {
    user: { id: 'messenger-user-1' },
    integrated: { companyUserId: 'company-user-1', csrfToken: 'session-token-1', canWrite: true },
    workNotificationSession: 0,
    workNotificationRevision: 0,
    scheduledNotifications: { enabled: true },
  };
  const originalIntegrated = state.integrated;
  const parent = { location: { origin: 'http://local' }, ensureNativeSynkCompanySession: () => nativeRecovery?.() };
  const context = vm.createContext({
    state, moduleBase: '/messenger', window: { parent }, location: { origin: 'http://local' },
    moduleUrl: path => path,
    fetch: path => new Promise(resolve => requests.push({ path, resolve })),
    setTimeout, clearTimeout,
    transferContext: () => ({ userId: state.user?.id }),
    transferContextCurrent: snapshot => snapshot.userId === state.user?.id,
    canWriteMessages: () => state.integrated?.canWrite !== false,
    setWorkNotificationStatus: enabled => { state.scheduledNotifications = { enabled }; },
    updateStorageProvider() {}, applyIntegratedUI() {}, syncComposerAccess() {}, renderMessages() {},
    refreshDetailViews: async () => {}, connectEvents() {},
  });
  vm.runInContext(recoverySource + apiSource + refreshSource, context);
  const run = code => vm.runInContext(code, context);
  const respond = (path, data) => {
    const request = requests.find(item => item.path === path && !item.responded);
    assert.ok(request, `Expected pending request for ${path}`);
    request.responded = true;
    request.resolve({ ok: true, json: async () => data });
  };
  const bootstrap = integrated => ({
    user: { id: 'messenger-user-1' },
    integrated: { companyUserId: 'company-user-1', csrfToken: 'session-token-1', canWrite: true, ...integrated },
    scheduledNotifications: { enabled: true },
  });
  return { state, originalIntegrated, requests, run, respond, bootstrap };
}

test('an SSE bootstrap refresh keeps concurrent assigned-task reads valid for the same login', async () => {
  const f = fixture();
  const tasks = f.run("api('/api/tasks?scope=mine')");
  const refresh = f.run('refreshStorageProvider()');
  f.respond('/api/bootstrap', f.bootstrap({ canManage: true, canWrite: false }));
  await refresh;
  assert.equal(f.state.integrated, f.originalIntegrated);
  assert.equal(f.state.integrated.canManage, true);
  assert.equal(f.state.integrated.canWrite, false);
  f.respond('/api/tasks?scope=mine', { tasks: [{ id: 'assigned-task-1' }] });
  assert.equal((await tasks).tasks[0].id, 'assigned-task-1');
});

test('a same-login bootstrap refresh keeps an already-pending native session recovery valid', async () => {
  let finishRecovery, recoveries = 0;
  const session = { companyUserId: 'company-user-1', csrfToken: 'session-token-1' };
  const pendingRecovery = new Promise(resolve => { finishRecovery = resolve; });
  const f = fixture({ nativeRecovery: () => ++recoveries === 1 ? pendingRecovery : session });
  const recovery = f.run('companySessionRecovery()');
  const refresh = f.run('refreshStorageProvider()');
  await new Promise(resolve => setImmediate(resolve));
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
    const tasks = f.run("api('/api/tasks?scope=mine')");
    const rejected = assert.rejects(tasks, /로그인이 바뀌어 하던 요청을 멈췄어요/);
    const refresh = f.run('refreshStorageProvider()');
    f.respond('/api/bootstrap', f.bootstrap(change));
    await refresh;
    assert.notEqual(f.state.integrated, f.originalIntegrated);
    f.respond('/api/tasks?scope=mine', { tasks: [] });
    await rejected;
  });
}

test('an actual messenger-user change still rejects an in-flight request', async () => {
  const f = fixture();
  const tasks = f.run("api('/api/tasks?scope=mine')");
  const rejected = assert.rejects(tasks, /로그인이 바뀌어 하던 요청을 멈췄어요/);
  f.state.user = { id: 'messenger-user-2' };
  f.respond('/api/tasks?scope=mine', { tasks: [] });
  await rejected;
});
