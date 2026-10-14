import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createCarePush, pushCapability, decodePushKey, carePushAccountIdentity, careLogoutNotice } from '../care-push.mjs';

const scopeUrl = 'https://synk.im/care/';
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture() {
  const log = [], notifications = [], state = { browserSub: null, serverEnabled: false, serverOwner: 'A', owner: 'A', hour: 9, minute: 0, removeOK: true, serverFailure: null, delayedSubscribe: null, delayedRequest: null, unsubscribed: 0 };
  const makeSubscription = () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/sample-endpoint', toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: publicKey, auth: 'example-auth-key' } }; }, async unsubscribe() { state.unsubscribed++; log.push('local-unsubscribe'); if (!state.removeOK) return false; if (state.browserSub === this) state.browserSub = null; return true; } });
  const registration = { scope: scopeUrl, active: {}, pushManager: {
    async getSubscription() { return state.browserSub; },
    subscribe(options) { log.push('subscribe-gesture'); assert.equal(options.userVisibleOnly, true); assert.equal(options.applicationServerKey.length, 65); if (state.delayedSubscribe) return state.delayedSubscribe.promise.then(() => state.browserSub ||= makeSubscription()); env.Notification.permission = 'granted'; return Promise.resolve(state.browserSub ||= makeSubscription()); },
  }, async getNotifications() { return notifications; } };
  const env = { isSecureContext: true, atob, PushManager: function () {}, Notification: { permission: 'default' }, navigator: { userAgent: 'Browser', serviceWorker: { async register() { log.push('register'); return registration; }, async getRegistration() { return registration; } } }, matchMedia: () => ({ matches: false }) };
  const request = async (action, body) => {
    log.push({ action, body });
    if (state.serverFailure === action) throw new Error('network');
    if (action === 'status') return { ok: true, publicKey, timeZone: 'Asia/Seoul', enabled: state.serverEnabled && state.serverOwner === state.owner, hour: state.hour, minute: state.minute };
    if (action === 'subscribe') { state.serverEnabled = true; state.serverOwner = state.owner; state.hour = body.hour; state.minute = body.minute; }
    if (action === 'update') { state.hour = body.hour; state.minute = body.minute; }
    if (action === 'unsubscribe') state.serverEnabled = false;
    if (state.delayedRequest) await state.delayedRequest.promise;
    return { ok: true, enabled: state.serverEnabled, hour: state.hour, minute: state.minute, timeZone: 'Asia/Seoul' };
  };
  const controller = createCarePush({ request, env, scopeUrl, workerUrl: scopeUrl + 'care-sw.js' });
  return { controller, state, env, log, request, registration, notifications, makeSubscription };
}

test('logout reports unknown notification cleanup when registration lookup fails', async () => {
  const f = fixture(); f.state.browserSub = f.makeSubscription();
  f.env.navigator.serviceWorker.getRegistration = async () => { throw new Error('storage unavailable'); };
  const result = await f.controller.logout({ localOnly: true });
  assert.equal(result.ok, false); assert.equal(result.deviceRemoved, false);
  assert.ok(f.state.browserSub);
  assert.match(careLogoutNotice({ ok: true, serverRevoked: true }, result), /기기 알림 해제를 확인하지 못했/);
});

test('logout accepts verified absence of a service worker registration', async () => {
  const f = fixture(); f.env.navigator.serviceWorker.getRegistration = async () => undefined;
  const result = await f.controller.logout({ localOnly: true });
  assert.equal(result.ok, true); assert.equal(result.deviceRemoved, true);
});

test('preparation registers the worker and fetches public key without prompting or creating a subscription', async () => {
  const f = fixture(); await f.controller.setAccount('A');
  assert.equal(f.controller.snapshot().phase, 'ready'); assert.equal(f.env.Notification.permission, 'default');
  assert.deepEqual(f.log.map(row => typeof row === 'string' ? row : row.action), ['register', 'status']);
});
test('enable invokes browser subscription directly in click task and strips unrelated subscription JSON fields', async () => {
  const f = fixture(); await f.controller.setAccount('A');
  const promise = f.controller.enable(8, 35);
  assert.equal(f.log.at(-1), 'subscribe-gesture'); assert.equal(f.controller.snapshot().busy, true);
  await promise;
  const call = f.log.find(row => row.action === 'subscribe');
  assert.deepEqual(Object.keys(call.body.subscription).sort(), ['endpoint', 'keys']);
  assert.equal(f.controller.snapshot().enabled, true); assert.equal(f.controller.snapshot().hour, 8); assert.equal(f.controller.snapshot().minute, 35);
  assert.equal(f.controller.snapshot().suppressOpenReminders, true);
});
test('startup transitional signed-out status does not unsubscribe a persisted account notification', async () => {
  const f = fixture(); f.state.browserSub = f.makeSubscription(); f.state.serverEnabled = true; f.env.Notification.permission = 'granted';
  for (const status of [{ status: 'signed-out', signedIn: false }, { status: 'restoring', signedIn: false }]) {
    const id = carePushAccountIdentity(status, true); assert.equal(id, undefined); if (id !== undefined) await f.controller.setAccount(id);
  }
  const signed = { status: 'signed-in', signedIn: true, accountId: 'A' };
  await f.controller.setAccount(carePushAccountIdentity(signed, true));
  assert.equal(f.state.unsubscribed, 0); assert.equal(f.controller.snapshot().enabled, true);
  await f.controller.setAccount(carePushAccountIdentity({ status: 'signed-out', signedIn: false }, false));
  assert.equal(f.state.unsubscribed, 1); assert.equal(f.controller.snapshot().enabled, false);
});
test('same account token refresh keeps device subscription without prompting', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(); const count = f.log.length;
  assert.equal(carePushAccountIdentity({ status: 'restoring', signedIn: false }, false), undefined);
  await f.controller.setAccount('A'); assert.equal(f.log.length, count); assert.equal(f.state.unsubscribed, 0);
});
test('new signed-out, failed or unconfigured tab preserves browser subscription until same-account login verifies it', async () => {
  for (const status of ['signed-out', 'error', 'unconfigured']) {
    const f = fixture(); f.state.browserSub = f.makeSubscription(); const existing = f.state.browserSub; f.state.serverEnabled = true; f.env.Notification.permission = 'granted';
    await f.controller.setAccount(carePushAccountIdentity({ status, signedIn: false }, false));
    await f.controller.setAccount(null); await f.controller.prepare();
    assert.equal(f.state.browserSub, existing, status); assert.equal(f.state.unsubscribed, 0, status); assert.deepEqual(f.log, [], status);
    await f.controller.setAccount('A'); assert.equal(f.controller.snapshot().enabled, true, status); assert.equal(f.state.browserSub, existing, status); assert.equal(f.state.unsubscribed, 0, status);
  }
});
test('account switch removes old local subscription and never automatically enables the new account', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(); f.state.owner = 'B'; await f.controller.setAccount('B');
  assert.equal(f.state.unsubscribed, 1); assert.equal(f.controller.snapshot().enabled, false); assert.equal(f.controller.snapshot().phase, 'ready');
  assert.equal(f.log.filter(row => row === 'subscribe-gesture').length, 1);
});
test('old account subscription found on fresh login is discarded rather than assigned to current account', async () => {
  const f = fixture(); f.state.browserSub = f.makeSubscription(); f.state.serverEnabled = true; f.state.serverOwner = 'A'; f.state.owner = 'B'; f.env.Notification.permission = 'granted';
  await f.controller.setAccount('B'); assert.equal(f.state.browserSub, null); assert.equal(f.controller.snapshot().enabled, false);
  assert.equal(f.log.filter(row => row.action === 'subscribe').length, 0);
});
test('failed cleanup of unknown ownership blocks enable and retry actually removes old endpoint', async () => {
  const f = fixture(); f.state.browserSub = f.makeSubscription(); f.state.serverEnabled = true; f.state.serverOwner = 'A'; f.state.owner = 'B'; f.env.Notification.permission = 'granted'; f.state.removeOK = false;
  await f.controller.setAccount('B'); assert.equal(f.controller.snapshot().phase, 'unavailable'); assert.equal(f.controller.snapshot().enabled, false);
  await f.controller.enable(); assert.equal(f.log.filter(row => row === 'subscribe-gesture').length, 0); assert.ok(f.state.browserSub);
  f.state.removeOK = true; await f.controller.prepare(); assert.equal(f.controller.snapshot().phase, 'ready'); assert.equal(f.state.browserSub, null);
});
test('after notebook deletion removes server subscriptions, a status refresh clears enabled label and device subscription', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(); f.state.serverEnabled = false;
  await f.controller.prepare(); assert.equal(f.controller.snapshot().enabled, false); assert.equal(f.state.browserSub, null); assert.equal(f.controller.snapshot().phase, 'ready');
});
test('account switch while permission prompt is pending discards the late subscription before preparing new account', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.delayedSubscribe = deferred();
  const enable = f.controller.enable(); f.state.owner = 'B'; const switched = f.controller.setAccount('B');
  f.state.delayedSubscribe.resolve(); await enable; await switched;
  assert.equal(f.state.unsubscribed, 1); assert.equal(f.state.browserSub, null); assert.equal(f.controller.snapshot().phase, 'ready');
  assert.equal(f.log.filter(row => row.action === 'subscribe').length, 0);
});
test('signout does not wait for unanswered permission and the late result cannot register on server', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.delayedSubscribe = deferred();
  const enable = f.controller.enable(); const result = await f.controller.logout(); assert.equal(result.ok, true);
  const signedOut = f.controller.setAccount(null); f.state.delayedSubscribe.resolve(); await enable; await signedOut;
  assert.equal(f.state.browserSub, null); assert.equal(f.controller.snapshot().phase, 'signed-out');
  assert.equal(f.log.filter(row => row.action === 'subscribe').length, 0);
});
test('signout during subscribe HTTP request cleans late successful registration locally', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.delayedRequest = deferred();
  const enable = f.controller.enable(); await Promise.resolve(); await Promise.resolve();
  const logout = f.controller.logout(); f.state.delayedRequest.resolve(); await enable; await logout; await f.controller.setAccount(null);
  assert.equal(f.state.browserSub, null); assert.equal(f.controller.snapshot().enabled, false); assert.equal(f.controller.snapshot().signedIn, false);
});
test('failed subscription HTTP request removes browser subscription, including uncertain server outcome', async () => {
  const f = fixture(); await f.controller.setAccount('A'); f.state.serverFailure = 'subscribe'; await f.controller.enable();
  assert.equal(f.state.browserSub, null); assert.equal(f.controller.snapshot().enabled, false); assert.equal(f.controller.snapshot().phase, 'error');
});
test('disable stops delivery through browser even when server is offline', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(); f.state.serverFailure = 'unsubscribe'; await f.controller.disable();
  assert.equal(f.state.browserSub, null); assert.equal(f.controller.snapshot().enabled, false); assert.match(f.controller.snapshot().message, /껐어요/);
});
test('double disable failure preserves reference and allows an actual second attempt', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(); f.state.serverFailure = 'unsubscribe'; f.state.removeOK = false;
  await f.controller.disable(); assert.equal(f.controller.snapshot().enabled, true); assert.equal(f.state.unsubscribed, 1);
  f.state.serverFailure = null; f.state.removeOK = true; await f.controller.disable();
  assert.equal(f.state.unsubscribed, 2); assert.equal(f.controller.snapshot().enabled, false); assert.equal(f.state.browserSub, null);
});
test('unsubscribe false after another tab already removed endpoint counts as successful local cleanup', async () => {
  const f = fixture(); await f.controller.setAccount('A'); await f.controller.enable(); f.state.serverFailure = 'unsubscribe'; f.state.removeOK = false; f.state.browserSub = null;
  await f.controller.disable(); assert.equal(f.controller.snapshot().enabled, false); assert.equal(f.controller.snapshot().phase, 'ready'); assert.match(f.controller.snapshot().message, /껐어요/);
});
test('lost update response shows unknown result, then status rereads actual committed time', async () => {
  const f = fixture(); const controller = createCarePush({ env: f.env, scopeUrl, request: async (action, body) => { const result = await f.request(action, body); if (action === 'update') throw new Error('lost ACK'); return result; } });
  await controller.setAccount('A'); await controller.enable(); await controller.update(14, 20);
  assert.equal(controller.snapshot().enabled, true); assert.equal(controller.snapshot().scheduleKnown, false);
  assert.doesNotMatch(controller.snapshot().message, /이전.*유지/); assert.equal(controller.snapshot().suppressOpenReminders, true);
  await controller.prepare(); assert.equal(controller.snapshot().hour, 14); assert.equal(controller.snapshot().minute, 20); assert.equal(controller.snapshot().scheduleKnown, true);
});
test('missing key or unavailable server never offers a working notification opt-in', async () => {
  const f = fixture(); f.state.serverFailure = 'status'; await f.controller.setAccount('A');
  assert.equal(f.controller.snapshot().phase, 'unavailable'); await f.controller.enable();
  assert.equal(f.log.includes('subscribe-gesture'), false);
  assert.throws(() => decodePushKey(null)); assert.throws(() => decodePushKey('A'.repeat(87))); assert.equal(decodePushKey(publicKey).length, 65);
});
test('permission denial does not prompt on prepare or claim enable succeeded', async () => {
  const f = fixture(); f.env.Notification.permission = 'denied'; await f.controller.setAccount('A');
  assert.equal(f.controller.snapshot().phase, 'denied'); await f.controller.enable(); assert.equal(f.log.includes('subscribe-gesture'), false);
});
test('browser prompt dismissal remains off and offers a retry', async () => {
  const f = fixture(); f.registration.pushManager.subscribe = () => Promise.reject(Object.assign(new Error('dismissed'), { name: 'NotAllowedError' }));
  await f.controller.setAccount('A'); await f.controller.enable(); assert.equal(f.controller.snapshot().enabled, false); assert.equal(f.controller.snapshot().phase, 'error'); assert.match(f.controller.snapshot().message, /권한/);
});
test('browser installation guidance distinguishes iOS browser, standalone, desktop bridge and unsupported browser', () => {
  const f = fixture(); f.env.navigator.userAgent = 'iPhone'; assert.equal(pushCapability(f.env).phase, 'needs-install');
  f.env.navigator.standalone = true; assert.equal(pushCapability(f.env).supported, true);
  f.env.synkProduct = { authStatus() {} }; assert.equal(pushCapability(f.env).phase, 'unsupported'); delete f.env.synkProduct;
  f.env.isSecureContext = false; assert.equal(pushCapability(f.env).phase, 'unsupported');
});
test('invalid time never touches browser permission or server', async () => {
  const f = fixture(); await f.controller.setAccount('A'); const before = f.log.length;
  assert.throws(() => f.controller.enable(24, 0)); assert.throws(() => f.controller.enable(9, NaN)); assert.equal(f.log.length, before);
});
test('first-data, device quota and invalid endpoint errors give actionable explanations', async () => {
  for (const [code, pattern] of [['CARE_DATA_REQUIRED', /수첩을 먼저 저장/], ['PUSH_DEVICE_LIMIT', /10개/], ['PUSH_DAILY_LIMIT', /내일/], ['INVALID_SUBSCRIPTION', /브라우저/]]) {
    const f = fixture(); const controller = createCarePush({ env: f.env, scopeUrl, request: (action, body) => action === 'subscribe' ? Promise.reject(Object.assign(new Error(code), { code })) : f.request(action, body) });
    await controller.setAccount('A'); await controller.enable(); assert.match(controller.snapshot().message, pattern); assert.equal(f.state.browserSub, null);
  }
});
test('cleanup never unregisters or unsubscribes an unrelated ancestor worker', async () => {
  const f = fixture(); f.registration.scope = 'https://synk.im/'; f.state.browserSub = f.makeSubscription();
  let lookups = 0; f.env.navigator.serviceWorker.getRegistration = async () => { lookups++; return f.registration; };
  await f.controller.logout(); assert.equal(lookups, 1); assert.equal(f.state.unsubscribed, 0); assert.ok(f.state.browserSub);
});
test('logout removes existing generic notification from the device display', async () => {
  const f = fixture(); let closed = false; f.notifications.push({ close() { closed = true; } });
  await f.controller.setAccount('A'); await f.controller.enable(); await f.controller.logout(); assert.equal(closed, true); assert.equal(f.state.browserSub, null);
});
test('logout notice preserves both server revocation and device notification failure warnings', () => {
  assert.equal(careLogoutNotice({ serverRevoked: true }, { ok: true }), '');
  const combined = careLogoutNotice({ serverRevoked: false }, { ok: false }); assert.match(combined, /서버의 세션 종료/); assert.match(combined, /기기 알림 해제/); assert.match(combined, /사이트 설정/);
  assert.doesNotMatch(careLogoutNotice({ serverRevoked: true }, { ok: false }), /서버의 세션 종료/);
});

test('local-only logout does not need live account credentials and still removes the device subscription', async () => {
  const f=fixture();await f.controller.setAccount('A');await f.controller.enable();
  const start=f.log.length;
  const result=await f.controller.logout({localOnly:true});
  assert.equal(result.deviceRemoved,true);assert.equal(f.state.browserSub,null);
  assert.equal(f.log.slice(start).some(row=>typeof row==='object'),false);
});
test('a new account cannot prepare notifications ahead of an old logout cleanup', async () => {
  const f=fixture(),wait=deferred();await f.controller.setAccount('A');await f.controller.enable();
  const old=f.state.browserSub,unsubscribe=old.unsubscribe.bind(old);old.unsubscribe=async()=>{await wait.promise;return unsubscribe();};
  const cleanup=f.controller.logout({localOnly:true}),out=f.controller.setAccount(null);
  f.state.owner='B';const next=f.controller.setAccount('B');
  await new Promise(setImmediate);
  assert.equal(f.controller.snapshot().phase,'preparing');
  await f.controller.enable();assert.equal(f.state.browserSub,old);
  wait.resolve();await Promise.all([cleanup,out,next]);
  await f.controller.enable();const current=f.state.browserSub;
  assert.ok(current);assert.notEqual(current,old);assert.equal(f.controller.snapshot().enabled,true);
});
test('failed credential cleanup cannot be described as completed local logout', () => {
  const message=careLogoutNotice({ok:false,serverRevoked:true},{ok:true});
  assert.match(message,/로그인 정보 삭제를 확인하지 못/);assert.doesNotMatch(message,/이 기기의 로그인은 종료했어요/);
});

async function workerFixture(workerScope = scopeUrl) {
  const handlers = {}, shown = [], opened = [], focused = [], clients = [];
  const self = { location: { origin: new URL(workerScope).origin }, registration: { scope: workerScope, async showNotification(title, options) { shown.push({ title, ...options }); } }, addEventListener(name, fn) { handlers[name] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {}, matchAll: async () => clients, openWindow: async url => opened.push(url) } };
  vm.runInNewContext(await readFile(new URL('../care-sw.js', import.meta.url), 'utf8'), { self, URL });
  const dispatch = async (name, value) => { let pending; handlers[name]({ ...value, waitUntil(promise) { pending = promise; } }); await pending; };
  return { dispatch, shown, opened, focused, clients };
}
test('worker only displays generic fixed text, ignoring names, story and malicious payload URL', async () => {
  const w = await workerFixture(); await w.dispatch('push', { data: { json: () => ({ type: 'synk-care-digest', title: 'PRIVATE NAME', body: 'PRIVATE STORY', url: 'https://evil.example' }) } });
  assert.equal(w.shown.length, 1); assert.equal(w.shown[0].title, 'SYNK 플레저'); assert.equal(w.shown[0].body, '오늘 챙길 일이 있어요. 수첩에서 확인해 주세요.'); assert.equal(w.shown[0].tag, 'synk-care-daily');
  assert.doesNotMatch(JSON.stringify(w.shown), /PRIVATE|evil|url/);
  await w.dispatch('push', { data: { json: () => ({ type: 'other' }) } }); await w.dispatch('push', { data: { json() { throw new Error('bad JSON'); } } }); assert.equal(w.shown.length, 1);
});
test('notification click opens only fixed same-origin Care, or focuses an already open exact Care path', async () => {
  const w = await workerFixture(); let closed = 0; const notification = { close() { closed++; }, data: { url: 'https://evil.example' } };
  w.clients.push({ url: 'https://evil.example/care/', focus() { throw new Error('wrong origin'); } }, { url: 'https://synk.im/id/', focus() { throw new Error('wrong app'); } });
  await w.dispatch('notificationclick', { notification }); assert.deepEqual(w.opened, [scopeUrl]);
  w.clients.push({ url: scopeUrl + '?view=home', focus() { w.focused.push('care'); } });
  await w.dispatch('notificationclick', { notification }); assert.equal(w.opened.length, 1); assert.deepEqual(w.focused, ['care']); assert.equal(closed, 2);
});
test('notification click uses the trusted registration scope on local and alternate builds, never a payload URL', async () => {
  for (const localScope of ['http://127.0.0.1:4296/', 'http://localhost:4300/review-care/']) {
    const w = await workerFixture(localScope); const notification = { close() {}, data: { url: 'https://evil.example' } };
    await w.dispatch('notificationclick', { notification }); assert.deepEqual(w.opened, [localScope]);
    w.clients.push({ url: localScope + '?from=notification', focus() { w.focused.push('local'); } });
    await w.dispatch('notificationclick', { notification }); assert.equal(w.opened.length, 1); assert.deepEqual(w.focused, ['local']);
  }
});
