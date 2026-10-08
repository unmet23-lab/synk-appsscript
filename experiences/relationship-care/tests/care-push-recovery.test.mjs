import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createCarePush } from '../care-push.mjs';

const scopeUrl = 'https://synk.im/care/';
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

// Provider permission and server acknowledgement are independently controlled.
// No browser permission, push endpoint or network request is used by this suite.
function fixture() {
  const calls = [], states = [];
  const state = { owner: 'A', browserSub: null, serverEnabled: false, serverOwner: 'A', hour: 9, minute: 0, removeOK: true, permission: null, response: null, failBefore: null, loseResponse: null, unsubscribed: 0, subscribeCount: 0 };
  const makeSubscription = () => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/synthetic-${state.subscribeCount}`,
    toJSON() { return { endpoint: this.endpoint, keys: { p256dh: publicKey, auth: 'synthetic-auth' } }; },
    async unsubscribe() {
      state.unsubscribed++;
      if (!state.removeOK) return false;
      if (state.browserSub === this) state.browserSub = null;
      return true;
    },
  });
  const registration = { scope: scopeUrl, active: {}, pushManager: {
    async getSubscription() { return state.browserSub; },
    subscribe() {
      state.subscribeCount++;
      const finish = () => { env.Notification.permission = 'granted'; return state.browserSub ||= makeSubscription(); };
      return state.permission ? state.permission.promise.then(finish) : Promise.resolve(finish());
    },
  }, async getNotifications() { return []; } };
  const env = { isSecureContext: true, atob, PushManager: function () {}, Notification: { permission: 'default' }, navigator: { userAgent: 'Synthetic test browser', serviceWorker: { async register() { return registration; }, async getRegistration() { return registration; } } }, matchMedia: () => ({ matches: false }) };
  const request = async (action, body) => {
    calls.push({ action, body, owner: state.owner });
    if (state.failBefore === action) throw Error('synthetic network failure');
    if (action === 'subscribe') { state.serverEnabled = true; state.serverOwner = state.owner; state.hour = body.hour; state.minute = body.minute; }
    if (action === 'update') { state.hour = body.hour; state.minute = body.minute; }
    if (action === 'unsubscribe') state.serverEnabled = false;
    if (state.response?.action === action) await state.response.promise;
    if (state.loseResponse === action) throw Error('synthetic lost acknowledgement');
    return { ok: true, publicKey, enabled: state.serverEnabled && state.owner === state.serverOwner, hour: state.hour, minute: state.minute, timeZone: 'Asia/Seoul' };
  };
  const controller = createCarePush({ request, env, scopeUrl, onState: snapshot => states.push(snapshot) });
  return { controller, state, env, calls, states };
}
const time = snapshot => [snapshot.hour, snapshot.minute];
const inputTime = snapshot => [snapshot.inputHour, snapshot.inputMinute];
const registrations = f => f.calls.filter(row => row.action === 'subscribe');

test('manual cancel restores usable UI immediately while serializing the unresolved native permission', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  const pending = f.controller.enable(14, 25);
  assert.equal(f.state.subscribeCount, 1, 'subscribe must still occur in the original click task');
  assert.equal(f.controller.snapshot().canCancelEnable, true);
  const cancelled = f.controller.cancelEnable();
  assert.equal(typeof cancelled?.then, 'undefined', 'cancel itself must not wait for the native dialog');
  assert.equal(f.controller.snapshot().phase, 'permission-pending');
  assert.equal(f.controller.snapshot().busy, false);
  assert.equal(f.controller.snapshot().canCancelEnable, false);
  assert.deepEqual(inputTime(f.controller.snapshot()), [14, 25]);
  await f.controller.prepare(); await f.controller.enable(17, 40);
  assert.equal(f.state.subscribeCount, 1, 'retry cannot start a competing provider subscription');
  assert.deepEqual(registrations(f), []);
  f.state.permission.resolve(); await pending;
  assert.equal(f.state.unsubscribed, 1); assert.equal(f.state.browserSub, null);
  assert.deepEqual(registrations(f), []); assert.equal(f.controller.snapshot().phase, 'ready');
  assert.deepEqual(inputTime(f.controller.snapshot()), [14, 25]);
});

test('a new opt-in is possible after the cancelled provider result was removed', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  const pending = f.controller.enable(14, 25); f.controller.cancelEnable(); f.state.permission.resolve(); await pending;
  f.state.permission = null; await f.controller.enable(16, 45);
  assert.equal(f.state.subscribeCount, 2); assert.equal(f.state.unsubscribed, 1);
  assert.equal(registrations(f).length, 1); assert.deepEqual(time(f.controller.snapshot()), [16, 45]);
  assert.equal(f.controller.snapshot().enabled, true); assert.ok(f.state.browserSub);
});

test('cancelled prompt rejection returns to retry without an error about the server', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  const pending = f.controller.enable(12, 15); f.controller.cancelEnable();
  f.state.permission.reject(Object.assign(Error('dismissed'), { name: 'NotAllowedError' })); await pending;
  assert.equal(f.controller.snapshot().phase, 'ready'); assert.equal(f.controller.snapshot().busy, false);
  assert.deepEqual(registrations(f), []); assert.equal(f.state.unsubscribed, 0);
  assert.deepEqual(inputTime(f.controller.snapshot()), [12, 15]);
});

test('cancelled prompt denial reflects the browser block instead of offering another prompt', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  const pending = f.controller.enable(); f.controller.cancelEnable(); f.env.Notification.permission = 'denied';
  f.state.permission.reject(Object.assign(Error('blocked'), { name: 'NotAllowedError' })); await pending;
  assert.equal(f.controller.snapshot().phase, 'denied'); assert.equal(f.controller.snapshot().canCancelEnable, false);
  await f.controller.enable(); assert.equal(f.state.subscribeCount, 1); assert.deepEqual(registrations(f), []);
});

test('unanswered permission stops busy indication after 30 seconds and safely rejects any late opt-in', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  const pending = f.controller.enable(7, 5);
  t.mock.timers.tick(29999); await flush(); assert.equal(f.controller.snapshot().busy, true);
  t.mock.timers.tick(1); await flush();
  assert.equal(f.controller.snapshot().phase, 'permission-pending'); assert.equal(f.controller.snapshot().busy, false);
  assert.equal(f.controller.snapshot().canCancelEnable, false); assert.deepEqual(inputTime(f.controller.snapshot()), [7, 5]);
  await f.controller.prepare(); assert.equal(f.state.subscribeCount, 1);
  f.state.permission.resolve(); await pending;
  assert.equal(f.state.browserSub, null); assert.equal(f.state.unsubscribed, 1); assert.deepEqual(registrations(f), []);
});

test('cancellation is unavailable after permission resolves and cannot discard a server registration in progress', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  f.state.response = { action: 'subscribe', ...deferred() };
  const pending = f.controller.enable(13, 45); f.state.permission.resolve(); await flush();
  assert.equal(registrations(f).length, 1); assert.equal(f.controller.snapshot().canCancelEnable, false);
  f.controller.cancelEnable(); t.mock.timers.tick(30000); await flush();
  assert.equal(f.controller.snapshot().busy, true); assert.notEqual(f.controller.snapshot().phase, 'permission-pending');
  f.state.response.resolve(); await pending;
  assert.equal(f.controller.snapshot().enabled, true); assert.equal(f.state.unsubscribed, 0);
});

test('late subscription cleanup failure blocks fresh prompts until a real cleanup retry succeeds', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred(); f.state.removeOK = false;
  const pending = f.controller.enable(); f.controller.cancelEnable(); f.state.permission.resolve(); await pending;
  assert.equal(f.controller.snapshot().phase, 'unavailable'); assert.equal(f.controller.snapshot().enabled, false);
  assert.ok(f.state.browserSub); await f.controller.enable(); assert.equal(f.state.subscribeCount, 1);
  f.state.removeOK = true; f.state.permission = null; await f.controller.prepare();
  assert.equal(f.state.browserSub, null); assert.equal(f.controller.snapshot().phase, 'ready');
  await f.controller.enable(); assert.equal(f.state.subscribeCount, 2); assert.equal(registrations(f).length, 1);
});

test('account switching while provider waits is non-busy and cannot attach the late subscription to the new account', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  const pending = f.controller.enable(14, 25); f.state.owner = 'B'; const switched = f.controller.setAccount('B');
  assert.equal(f.controller.snapshot().phase, 'permission-pending'); assert.equal(f.controller.snapshot().busy, false);
  assert.equal(f.controller.snapshot().canCancelEnable, false); assert.deepEqual(inputTime(f.controller.snapshot()), [9, 0]);
  await f.controller.prepare(); assert.equal(f.state.subscribeCount, 1);
  f.state.permission.resolve(); await pending; await switched;
  assert.equal(f.state.browserSub, null); assert.deepEqual(registrations(f), []);
  assert.equal(f.controller.snapshot().phase, 'ready'); assert.deepEqual(inputTime(f.controller.snapshot()), [9, 0]);
  f.state.permission = null; await f.controller.enable(10, 0);
  assert.equal(registrations(f).length, 1); assert.equal(registrations(f)[0].owner, 'B');
});

test('logout completes without answering permission and a late fulfilled prompt remains signed out', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  const pending = f.controller.enable(15, 20); f.controller.cancelEnable();
  assert.equal((await f.controller.logout()).ok, true);
  const signedOut = f.controller.setAccount(null);
  assert.equal(f.controller.snapshot().signedIn, false); assert.deepEqual(inputTime(f.controller.snapshot()), [9, 0]);
  f.state.permission.resolve(); await pending; await signedOut;
  assert.equal(f.controller.snapshot().phase, 'signed-out'); assert.equal(f.state.browserSub, null);
  assert.deepEqual(registrations(f), []); assert.equal(f.controller.snapshot().canCancelEnable, false);
});

test('enable shows selected time through permission and acknowledgement while confirmed time stays unchanged', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.permission = deferred();
  f.state.response = { action: 'subscribe', ...deferred() }; const pending = f.controller.enable(18, 35);
  assert.deepEqual(inputTime(f.controller.snapshot()), [18, 35]); assert.deepEqual(time(f.controller.snapshot()), [9, 0]);
  f.state.permission.resolve(); await flush();
  assert.deepEqual(inputTime(f.controller.snapshot()), [18, 35]); assert.deepEqual(time(f.controller.snapshot()), [9, 0]);
  f.state.response.resolve(); await pending;
  assert.deepEqual(time(f.controller.snapshot()), [18, 35]); assert.deepEqual(inputTime(f.controller.snapshot()), [18, 35]);
  f.state.hour = 11; f.state.minute = 10; await f.controller.prepare();
  assert.deepEqual(inputTime(f.controller.snapshot()), [11, 10], 'acknowledged draft no longer hides a subsequent confirmed server value');
});

test('failed enable preserves chosen time across status refresh without pretending the device is enabled', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.loseResponse = 'subscribe';
  await f.controller.enable(17, 50);
  assert.equal(f.state.serverEnabled, true, 'simulate committed server write with lost response');
  assert.equal(f.controller.snapshot().enabled, false); assert.equal(f.state.browserSub, null);
  assert.deepEqual(time(f.controller.snapshot()), [9, 0]); assert.deepEqual(inputTime(f.controller.snapshot()), [17, 50]);
  f.state.hour = 9; f.state.minute = 0; await f.controller.prepare();
  assert.equal(f.controller.snapshot().enabled, false); assert.deepEqual(inputTime(f.controller.snapshot()), [17, 50]);
});

test('saving retains selected time until acknowledgement and success clears the draft', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(9, 0);
  f.state.response = { action: 'update', ...deferred() }; const pending = f.controller.update(6, 40);
  assert.equal(f.controller.snapshot().phase, 'saving'); assert.deepEqual(time(f.controller.snapshot()), [9, 0]);
  assert.deepEqual(inputTime(f.controller.snapshot()), [6, 40]);
  f.state.response.resolve(); await pending;
  assert.deepEqual(time(f.controller.snapshot()), [6, 40]); assert.deepEqual(inputTime(f.controller.snapshot()), [6, 40]);
  f.state.hour = 10; f.state.minute = 5; await f.controller.prepare();
  assert.deepEqual(inputTime(f.controller.snapshot()), [10, 5]);
});

test('failed update keeps editable choice while status refresh reports a different confirmed server time', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(9, 0); f.state.failBefore = 'update';
  await f.controller.update(14, 20);
  assert.equal(f.controller.snapshot().scheduleKnown, false); assert.equal(f.controller.snapshot().enabled, true);
  assert.deepEqual(time(f.controller.snapshot()), [9, 0]); assert.deepEqual(inputTime(f.controller.snapshot()), [14, 20]);
  f.state.failBefore = null; await f.controller.prepare();
  assert.equal(f.controller.snapshot().scheduleKnown, true); assert.deepEqual(time(f.controller.snapshot()), [9, 0]);
  assert.deepEqual(inputTime(f.controller.snapshot()), [14, 20]);
  await f.controller.update(14, 20); assert.deepEqual(time(f.controller.snapshot()), [14, 20]);
});

test('lost update acknowledgement is reconciled against actual server time without discarding the chosen value', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(); f.state.loseResponse = 'update';
  await f.controller.update(15, 10);
  assert.equal(f.controller.snapshot().scheduleKnown, false); assert.deepEqual(time(f.controller.snapshot()), [9, 0]);
  assert.deepEqual(inputTime(f.controller.snapshot()), [15, 10]);
  await f.controller.prepare();
  assert.equal(f.controller.snapshot().scheduleKnown, true); assert.deepEqual(time(f.controller.snapshot()), [15, 10]);
  assert.deepEqual(inputTime(f.controller.snapshot()), [15, 10]);
});

const source = readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
const renderSource = source.slice(source.indexOf('function renderPushSettings()'), source.indexOf('function pushTime()'));
function renderHarness(snapshot) {
  const elements = new Map(), handlers = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { id, value: '', textContent: '', hidden: false, disabled: false, dataset: {}, attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    carePush: { snapshot: () => snapshot, cancelEnable() { snapshot.cancelled = true; } }, $: element,
    document: { activeElement: null }, accountStarting: false, accountStatus: { configured: true },
    window: { Notification: {} }, Notification: { permission: 'granted' }, notificationStatus() {},
    on: (id, event, handler) => handlers.set(`${id}:${event}`, handler),
  });
  vm.runInContext(renderSource, context);
  return { context, element, handlers, render: () => context.renderPushSettings() };
}
const uiState = extra => ({ phase: 'ready', message: '시험', busy: false, signedIn: true, enabled: false, scheduleKnown: true, hour: 9, minute: 0, inputHour: 9, inputMinute: 0, canCancelEnable: false, ...extra });

test('shipped settings renderer retains the chosen input while enabling and saving after focus leaves the input', () => {
  for (const phase of ['enabling', 'saving']) {
    const h = renderHarness(uiState({ phase, busy: true, enabled: phase === 'saving', inputHour: 14, inputMinute: 25, canCancelEnable: phase === 'enabling' }));
    h.element('push-time').value = '14:25'; h.context.document.activeElement = h.element(phase === 'saving' ? 'push-save' : 'push-enable'); h.render();
    assert.equal(h.element('push-time').value, '14:25', phase); assert.equal(h.element('push-time').disabled, true, phase);
    assert.equal(h.element('push-settings').attrs['aria-busy'], 'true', phase);
  }
});

test('shipped renderer exposes cancel only during cancellable permission wait and pending recovery is non-busy', () => {
  const snapshot = uiState({ phase: 'enabling', busy: true, canCancelEnable: true }); const h = renderHarness(snapshot); h.render();
  assert.equal(h.element('push-cancel').hidden, false); assert.equal(h.element('push-cancel').disabled, false);
  snapshot.canCancelEnable = false; h.render(); assert.equal(h.element('push-cancel').hidden, true);
  snapshot.phase = 'permission-pending'; snapshot.busy = false; h.render();
  assert.equal(h.element('push-settings').attrs['aria-busy'], 'false'); assert.equal(h.element('push-retry').hidden, false);
  assert.ok(h.element('push-enable').hidden || h.element('push-enable').disabled, 'an unresolved provider cannot expose a usable new opt-in');
});

test('shipped time hint distinguishes the retained draft from the confirmed saved time after a failed update', () => {
  const snapshot = uiState({ phase: 'enabled', enabled: true, inputHour: 14, inputMinute: 25 });
  const h = renderHarness(snapshot); h.render();
  assert.equal(h.element('push-time').value, '14:25'); assert.equal(h.element('push-time-hint').hidden, false);
  assert.match(h.element('push-time-hint').textContent, /09:00/); assert.match(h.element('push-time-hint').textContent, /저장/);
  snapshot.scheduleKnown = false; h.render();
  assert.equal(h.element('push-time-hint').hidden, true, 'unknown outcomes must not claim the previous time is still saved');
  snapshot.scheduleKnown = true; snapshot.hour = 14; snapshot.minute = 25; h.render();
  assert.equal(h.element('push-time-hint').hidden, true, 'a matching server time does not require a redundant save');
});

test('shipped renderer blocks a second permission path while native permission or cleanup remains pending', () => {
  const snapshot = uiState({ phase: 'permission-pending', permissionPending: true });
  const h = renderHarness(snapshot); h.render();
  assert.equal(h.element('push-open-only').disabled, true);
  snapshot.permissionPending = false; snapshot.phase = 'ready'; h.render();
  assert.equal(h.element('push-open-only').disabled, false);
});

test('shipped cancel control calls the controller cancellation method', () => {
  const snapshot = uiState(); const h = renderHarness(snapshot);
  const handler = source.match(/^on\('push-cancel',.*$/m)?.[0]; assert.ok(handler, 'cancel must be wired in the shipped app');
  vm.runInContext(handler, h.context); h.handlers.get('push-cancel:click')(); assert.equal(snapshot.cancelled, true);
});
