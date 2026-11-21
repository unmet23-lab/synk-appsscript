// 얼굴을 바꿔 끼우는 약속의 시험(PC 클라이언트 1단계, 1단계_구현설계.md 4 · 7 · 14 · 15절).
// 실제 mountDesktopPortalHost를 아주 작은 가짜 뿌리와 합성 다리로 돌린다. 얼굴은 기록용 가짜이거나, 가짜 화면을 단 새 컨트롤러다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountDesktopPortalHost } from '../renderer/portal-host.mjs';
import { createOrbFaceController } from '../renderer/orb-face.mjs';

const GENERATION = '10000000-0000-4000-8000-000000000001';
const ACCOUNT = '20000000-0000-4000-8000-000000000002';
const OTHER = '60000000-0000-4000-8000-000000000006';
const tick = () => new Promise(resolve => setImmediate(resolve));
const pause = () => new Promise(resolve => setTimeout(resolve, 2));
async function settle(n = 18) { for (let i = 0; i < n; i++) { await tick(); if (i % 3 === 2) await pause(); } }

function fakeRoot() {
  const input = { value: '' };
  const win = { addEventListener() {}, removeEventListener() {}, crypto: globalThis.crypto };
  const doc = { defaultView: win, querySelector: () => null, documentElement: { dataset: {} } };
  const root = {
    id: 'portal-entry', dataset: {}, hidden: false, ownerDocument: doc, parentElement: null,
    addEventListener() {}, removeEventListener() {},
    querySelector: sel => (sel === '#portal-invite-input' ? input : null),
    querySelectorAll: () => [],
    contains: () => false,
  };
  return { root, input };
}

function signedInAuth({ purpose = 'none', accountKey = ACCOUNT, sessionGeneration = 1, generation = GENERATION } = {}) {
  return { configured: true, status: 'signed-in', signedIn: true, accountGeneration: generation, sessionGeneration, account: { synk_user_id: accountKey }, onboarding: { purpose } };
}

function companyBridge(auth, { destinations = [], writes = [], opens = [], lookups = { n: 0 }, failWrite = false } = {}) {
  return {
    authStatus: async () => auth.current,
    resolveCompanyEntryDestinations: async request => {
      lookups.n += 1;
      return { ok: true, requestId: request.requestId, accountGeneration: request.accountGeneration, result: { status: 'resolved', destinations: typeof destinations === 'function' ? destinations() : destinations, unavailable: [] } };
    },
    openAssignedCompanyDestination: async request => {
      opens.push(request.destination);
      return { ok: true, requestId: request.requestId, accountGeneration: request.accountGeneration, destination: request.destination };
    },
    cancelCompanyEntry: async () => null,
    accountRequest: async (operation, params) => {
      writes.push({ operation, ...params });
      if (failWrite) throw new Error('offline');
      return { ok: true };
    },
  };
}

function orbFaceFactory() {
  const made = {};
  const mountFace = (root, options) => {
    const view = {
      scenes: [], log: [],
      render(scene) { view.scenes.push(scene); root.dataset.portalState = scene.phase; },
      intro: () => Promise.resolve(), hurryIntro() {},
      move(pose) { view.log.push(['move', pose]); return Promise.resolve(); },
      dive(space) { view.log.push(['dive', space]); return Promise.resolve(); },
      arrive(space, sig) { view.log.push(['arrive', space, sig]); return Promise.resolve(); },
      getInviteValue: () => '', setInviteValue() {}, isHidden: () => false, prefersReducedMotion: () => true, emitState() {}, dispose() {},
    };
    const env = { setTimeout: (fn) => setTimeout(fn, 0), clearTimeout, setInterval: () => 0, clearInterval() {}, storage: null };
    made.view = view;
    made.face = createOrbFaceController({ view, options, env });
    return made.face;
  };
  return { mountFace, made };
}

test('the host keeps the current face as its default and spreads PC options before its own callbacks', () => {
  const src = fs.readFileSync(new URL('../renderer/portal-host.mjs', import.meta.url), 'utf8');
  assert.match(src, /mountFace = mountPortalEntry,/);
  assert.match(src, /portal = mountFace\(root, \{\r?\n\s+\.\.\.\(faceOptions && typeof faceOptions === 'object' \? faceOptions : \{\}\),\r?\n\s+hostElements,/);
});

test('a face gets the new callbacks, PC options pass through and cannot replace host callbacks', async t => {
  const { root } = fakeRoot();
  let seen = null;
  const state = { phase: 'welcome', active: true, authStatus: 'restoring' };
  const face = { getState: () => state, setState: () => state, isActive: () => true, shouldBlockShortcuts: () => true, openPurposePicker: () => false, closePurposePicker: () => Promise.resolve(false), dispose() {}, clientMode: () => 'app', isClientShown: () => true };
  const legacy = () => {};
  // 방이 쓰는 다리(2단계 둘째 조각 설계 1.3절 「자료 어댑터」)도 같은 길로 그대로 닿는다
  const rooms = { account: { request() {}, identity() {} }, confirmLeave() {}, bind() {} };
  const host = mountDesktopPortalHost({
    root, getAuth: () => null, bridge: null,
    mountFace: (r, options) => { seen = options; return face; },
    faceOptions: { onSignIn: 'not mine', onEnter: 'not mine', onOpenLegacy: legacy, rooms, look: { places: false } },
  });
  t.after(() => host.dispose());
  assert.equal(typeof seen.onSignIn, 'function');
  assert.equal(typeof seen.onEnter, 'function');
  assert.equal(seen.onOpenLegacy, legacy);
  assert.equal(seen.rooms, rooms);
  assert.deepEqual(seen.look, { places: false });
  assert.equal(typeof seen.onEnterDefault, 'function');
  assert.equal(typeof seen.onOpenSpace, 'function');
  assert.equal(host.clientMode(), 'app');
  assert.equal(host.isClientShown(), true);

  const plain = mountDesktopPortalHost({ root: fakeRoot().root, getAuth: () => null, mountFace: () => ({ ...face, clientMode: undefined, isClientShown: undefined }) });
  t.after(() => plain.dispose());
  assert.equal(plain.clientMode(), 'off');
  assert.equal(plain.isClientShown(), false);
  const none = mountDesktopPortalHost({ root: null });
  assert.equal(none.clientMode(), 'off');
});

for (const purpose of ['pending', 'none']) {
  test(`an unassigned account goes straight to Solio and writes not-asked only when onboarding is pending: ${purpose}`, async t => {
    const { root } = fakeRoot();
    const auth = { current: signedInAuth({ purpose }) };
    const writes = [], opened = [];
    const { mountFace, made } = orbFaceFactory();
    const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { writes }), mountFace, onOpenPurposeTarget: async id => { opened.push(id); return { ok: true }; } });
    t.after(() => host.dispose());
    await settle();
    assert.equal(host.getState().phase, 'entered');
    assert.deepEqual(opened, ['solio']);
    assert.deepEqual(writes.map(w => w.outcome), purpose === 'pending' ? ['not-asked'] : []);
    assert.ok(!made.view.scenes.some(s => s.layer === 'ask' || s.layer === 'switch'), 'no ask or chooser scene for an unassigned account');
    assert.deepEqual(made.view.log.find(e => e[0] === 'dive'), ['dive', 'solio']);
  });
}

test('a failing onboarding write does not block entry', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth({ purpose: 'pending' }) };
  const { mountFace } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { failWrite: true }), mountFace, onOpenPurposeTarget: async () => ({ ok: true }) });
  t.after(() => host.dispose());
  await settle();
  assert.equal(host.getState().phase, 'entered');
});

test('onEnterDefault refuses when the account changed', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  let options = null;
  const state = { phase: 'welcome', active: true, authStatus: 'restoring' };
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth), mountFace: (r, o) => { options = o; return { getState: () => state, setState: () => state, isActive: () => true, shouldBlockShortcuts: () => true, openPurposePicker: () => false, closePurposePicker: () => Promise.resolve(false), dispose() {} }; } });
  t.after(() => host.dispose());
  auth.current = signedInAuth({ accountKey: OTHER });
  const result = await options.onEnterDefault({ origin: 'entering', purposeMode: 'onboarding', accountKey: ACCOUNT, generation: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACCOUNT_CHANGED');
});

// 로그인 뒤에는 고르기 화면 없이 늘 솔리오로 간다. 배정된 공간은 열지 않고 구 곁 펼침에만 세운다(유호님 11-21)
test('one assignment opens nothing on sign-in: Solio first, and the switch lists the space', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const opens = [], opened = [];
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { destinations: ['/pulse-app/'], opens }), mountFace, onOpenPurposeTarget: async id => { opened.push(id); return { ok: true }; } });
  t.after(() => host.dispose());
  await settle();
  assert.deepEqual(opens, []);
  assert.deepEqual(opened, ['solio']);
  assert.equal(host.getState().phase, 'entered');
  assert.deepEqual(made.view.log.find(e => e[0] === 'dive'), ['dive', 'solio']);
  assert.ok(!made.view.scenes.some(s => s.layer === 'switch' || s.phase === 'workspace'), 'no chooser after sign-in');
  made.face.handle('open-switch');
  await settle();
  assert.deepEqual(made.view.scenes.at(-1).fan.names.map(n => n.space), ['solio', 'pulse']);
});

test('two assignments show no chooser on sign-in, and the switch opens only the chosen space', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth({ purpose: 'pending' }) };
  const opens = [], opened = [], writes = [], lookups = { n: 0 };
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { destinations: ['/', '/pulse-app/'], opens, writes, lookups }), mountFace, onOpenPurposeTarget: async id => { opened.push(id); return { ok: true }; } });
  t.after(() => host.dispose());
  await settle();
  assert.equal(host.getState().phase, 'entered');
  assert.deepEqual(opens, []);
  assert.deepEqual(opened, ['solio']);
  assert.deepEqual(writes.map(w => w.outcome), ['not-asked']);
  assert.ok(!made.view.scenes.some(s => s.layer === 'switch' || s.phase === 'workspace'), 'no chooser after sign-in');
  made.face.handle('open-switch');
  await settle();
  assert.deepEqual(made.view.scenes.at(-1).fan.names.map(n => n.space), ['solio', 'workspace', 'pulse']);
  made.face.handle('go', 'pulse');
  await settle();
  assert.deepEqual(opens, ['/pulse-app/']);
  // 펼침에서 한 공간을 열며 살아난 확인 기록이 있으면, 다른 공간을 열 때 다시 조회하지 않는다(Fable 최종 F3)
  const before = lookups.n;
  made.face.handle('open-switch');
  await settle();
  made.face.handle('go', 'workspace');
  await settle();
  assert.deepEqual(opens, ['/pulse-app/', '/']);
  assert.equal(lookups.n, before, 'a live record needs no second lookup');
});

test('a company space the lookup cannot confirm does not hold sign-in: Solio still opens', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const opens = [], opened = [];
  let answer = { status: 'login_required', destinations: [], unavailable: ['workspace', 'pulse'] }, hashRoutes = 0;
  const bridge = { ...companyBridge(auth, { opens }), resolveCompanyEntryDestinations: async request => ({ ok: true, requestId: request.requestId, accountGeneration: request.accountGeneration, result: answer }) };
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge, mountFace, onApplyHashRoute: () => { hashRoutes++; }, onOpenPurposeTarget: async id => { opened.push(id); return { ok: true }; } });
  t.after(() => host.dispose());
  await settle();
  assert.equal(host.getState().phase, 'entered');
  assert.deepEqual(opened, ['solio']);
  assert.deepEqual(opens, []);
  assert.ok(!made.view.scenes.some(s => s.layer === 'switch' || s.phase === 'workspace'), 'no chooser or retry screen after sign-in');
  made.face.handle('open-switch');
  await settle();
  let fan = made.view.scenes.at(-1).fan;
  assert.deepEqual(fan.names.map(n => n.space), ['solio']);
  // 펼침이 까닭과 「다시 확인」을 둔다(PC 검수 F1, 유호님 11-21 「다 고쳐야지」)
  assert.equal(fan.lead, '회사 공간 배정을 확인하지 못했어요.');
  assert.deepEqual(fan.foot.map(f => f.action), ['recheck-spaces', 'account', 'settings', 'logout']);
  // 다시 확인이 또 실패하면 까닭이 남고, 확인되면 공간이 서고 까닭이 사라진다. 회사 공간은 열지 않고 첫 화면 경로도 건드리지 않는다
  answer = { status: 'partial', destinations: ['/'], unavailable: ['pulse'] };
  made.face.handle('foot', 'recheck-spaces');
  await settle();
  fan = made.view.scenes.at(-1).fan;
  assert.deepEqual(fan.names.map(n => n.space), ['solio', 'workspace']);
  assert.equal(fan.lead, '회사 공간 가운데 일부를 확인하지 못했어요.');
  answer = { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] };
  made.face.handle('foot', 'recheck-spaces');
  await settle();
  fan = made.view.scenes.at(-1).fan;
  assert.deepEqual(fan.names.map(n => n.space), ['solio', 'workspace', 'pulse']);
  assert.equal(fan.lead, '');
  assert.deepEqual(fan.foot.map(f => f.action), ['account', 'settings', 'logout']);
  assert.deepEqual(opens, []);
  assert.equal(host.getState().phase, 'entered');
  assert.deepEqual(opened, ['solio']);
  assert.equal(hashRoutes, 0);
});

test('a recheck that finds no assignment clears the reason and leaves the first screen alone', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth({ purpose: 'pending' }) };
  let answer = { status: 'unavailable', destinations: [], unavailable: ['workspace', 'pulse'] }, hashRoutes = 0;
  // not-asked 기록이 실패한 계정이다. 들어오면 이 세션에서는 온보딩을 마친 것으로 치므로 첫 화면 경로가 돌 일이 없고,
  // 호스트의 quiet는 그 밖의 경로를 막는 덧막이다. 여기서는 다시 확인이 화면을 옮기지 않고 까닭만 지우는지 본다
  const bridge = { ...companyBridge(auth, { failWrite: true }), resolveCompanyEntryDestinations: async request => ({ ok: true, requestId: request.requestId, accountGeneration: request.accountGeneration, result: answer }) };
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge, mountFace, onApplyHashRoute: () => { hashRoutes++; }, onOpenPurposeTarget: async () => ({ ok: true }) });
  t.after(() => host.dispose());
  await settle();
  const routesAfterEntry = hashRoutes;
  made.face.handle('open-switch');
  await settle();
  answer = { status: 'resolved', destinations: [], unavailable: [] };
  made.face.handle('foot', 'recheck-spaces');
  await settle();
  const fan = made.view.scenes.at(-1).fan;
  assert.deepEqual(fan.names.map(n => n.space), ['solio']);
  assert.equal(fan.lead, '');
  assert.equal(hashRoutes, routesAfterEntry, 'a recheck never applies the onboarding route');
});

test('a confirmed sign-in lookup leaves the switch without a reason or recheck', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { destinations: ['/'] }), mountFace, onOpenPurposeTarget: async () => ({ ok: true }) });
  t.after(() => host.dispose());
  await settle();
  made.face.handle('open-switch');
  await settle();
  const fan = made.view.scenes.at(-1).fan;
  assert.equal(fan.lead, '');
  assert.ok(!fan.foot.some(f => f.action === 'recheck-spaces'));
});

test('onOpenSpace looks the assignment up once when the record expired, and never opens what is not assigned', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const opens = [], lookups = { n: 0 };
  let list = ['/', '/pulse-app/'];
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { destinations: () => list, opens, lookups }), mountFace, onOpenPurposeTarget: async () => ({ ok: true }) });
  t.after(() => host.dispose());
  await settle();
  // 로그인 뒤 솔리오로 들어가면 확인 기록이 비워진다
  assert.equal(host.getState().phase, 'entered');
  made.face.handle('open-switch');
  await settle();
  const before = lookups.n;
  made.face.handle('go', 'pulse');
  await settle();
  assert.equal(lookups.n, before + 1, 'one lookup for the expired record');
  assert.deepEqual(opens, ['/pulse-app/']);
});

test('a space dropped from the assignment is not opened even though the switch still lists it', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const opens = [];
  let list = ['/', '/pulse-app/'];
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { destinations: () => list, opens }), mountFace, onOpenPurposeTarget: async () => ({ ok: true }) });
  t.after(() => host.dispose());
  await settle();
  assert.equal(host.getState().phase, 'entered');
  list = ['/'];
  made.face.handle('open-switch');
  await settle();
  assert.deepEqual(made.view.scenes.at(-1).fan.names.map(n => n.space), ['solio', 'workspace', 'pulse']);
  made.face.handle('go', 'pulse');
  await settle();
  assert.deepEqual(opens, [], 'the fresh lookup no longer lists PULSE');
  assert.match(made.view.scenes.at(-1).fan.error, /확인된 공간이 아닙니다/);
  assert.equal(made.view.scenes.at(-1).space, 'solio');
});

test('onOpenSpace does not open after the account changed', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const opens = [];
  let options = null;
  const state = { phase: 'entered', active: false, authStatus: 'signed-in' };
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { destinations: ['/'], opens }), mountFace: (r, o) => { options = o; return { getState: () => state, setState: () => state, isActive: () => false, shouldBlockShortcuts: () => false, openPurposePicker: () => false, closePurposePicker: () => Promise.resolve(false), dispose() {} }; } });
  t.after(() => host.dispose());
  auth.current = signedInAuth({ accountKey: OTHER });
  const result = await options.onOpenSpace('/', { accountKey: ACCOUNT, generation: 1 });
  assert.equal(result.ok, false);
  assert.deepEqual(opens, []);
});

test('a browser sign-in failure stays on the ask scene after the next render (Fable final)', async t => {
  // 호스트는 브라우저 로그인이 실패하면 까닭을 알린다. 새 얼굴은 그 글을 장면 값으로 받아, 창으로 돌아와 다시 그려도 지우지 않는다
  const { root } = fakeRoot();
  const { mountFace, made } = orbFaceFactory();
  const guest = { configured: true, status: 'signed-out', signedIn: false, sessionGeneration: 1, accountGeneration: GENERATION };
  const auth = { current: guest };
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth), mountFace, onStartSignIn: () => new Promise(() => {}) });
  t.after(() => host.dispose());
  await settle(30);
  assert.equal(made.face.getState().phase, 'auth');
  made.face.handle('signin');
  await settle();
  host.syncAuth({ ...guest, status: 'signing-in', sessionGeneration: 2 });
  await settle();
  host.syncAuth({ ...guest, sessionGeneration: 3, error: { code: 'AUTH_FAILED', message: '로그인을 마치지 못했어요. 다시 해 주세요.' } });
  await settle();
  assert.equal(made.face.getState().phase, 'auth');
  assert.equal(made.view.scenes.at(-1).ask.authFeedback, '로그인을 마치지 못했습니다. 다시 해 주세요.');
  made.face.handle('visible');
  await settle();
  assert.equal(made.view.scenes.at(-1).ask.authFeedback, '로그인을 마치지 못했습니다. 다시 해 주세요.');
});

test('onOpenSpace says why the fresh lookup could not confirm the space instead of 「not assigned」 (0.4.95 carbon B7)', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const opens = [];
  let n = 0, failCode = 'LOGIN_REQUIRED';
  const base = companyBridge(auth, { destinations: ['/', '/pulse-app/'], opens });
  const bridge = { ...base, resolveCompanyEntryDestinations: async request => (++n === 1 ? base.resolveCompanyEntryDestinations(request) : { ok: false, code: failCode, requestId: request.requestId }) };
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge, mountFace, onOpenPurposeTarget: async () => ({ ok: true }) });
  t.after(() => host.dispose());
  await settle();
  made.face.handle('continue-personal');
  await settle();
  for (const [code, said] of [['LOGIN_REQUIRED', /추가 로그인이 필요합니다/], ['ACCOUNT_MISMATCH', /다른 계정으로 로그인되어 있습니다/], ['BUSY', /배정된 공간을 다 확인하지 못했습니다/]]) {
    failCode = code;
    made.face.handle('open-switch');
    await settle();
    made.face.handle('go', 'pulse');
    await settle();
    const error = made.view.scenes.at(-1).fan.error;
    assert.match(error, said, code + ': ' + error);
    assert.doesNotMatch(error, /확인된 공간이 아닙니다|작업 공간 다시 확인|아래 단추/, code + ': ' + error);
    made.face.handle('close-switch');
    await settle();
  }
  assert.deepEqual(opens, []);
});

test('a space that fails to open is said in switch words, never pointing at the entry screen buttons (0.4.95 Fable F3)', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  let openCode = 'HANDOFF_TIMEOUT';
  const base = companyBridge(auth, { destinations: ['/', '/pulse-app/'] });
  const bridge = { ...base, openAssignedCompanyDestination: async request => ({ ok: false, code: openCode, requestId: request.requestId }) };
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge, mountFace, onOpenPurposeTarget: async () => ({ ok: true }) });
  t.after(() => host.dispose());
  await settle();
  made.face.handle('continue-personal');
  await settle();
  for (const [code, said] of [['HANDOFF_TIMEOUT', /^그 공간을 열지 못했습니다\. 잠시 뒤 다시 시도해 주세요\.$/], ['HANDOFF_UNAVAILABLE', /^그 공간을 열지 못했습니다/], ['ACCOUNT_MISMATCH', /다른 계정으로 로그인되어 있습니다/], ['PULSE_APP_BUSY', /다른 작업을 처리하고 있습니다/]]) {
    openCode = code;
    made.face.handle('open-switch');
    await settle();
    made.face.handle('go', 'pulse');
    await settle();
    const error = made.view.scenes.at(-1).fan.error;
    assert.match(error, said, code + ': ' + error);
    assert.doesNotMatch(error, /다시 확인을 누른|아래 단추|개인 화면으로 계속|[아어]요\./, code + ': ' + error);
    made.face.handle('close-switch');
    await settle();
  }
});

test('a failed fresh lookup for an expired record is said in switch words too (0.4.95 re-review FA1)', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  let n = 0;
  const base = companyBridge(auth, { destinations: ['/', '/pulse-app/'] });
  const bridge = { ...base, resolveCompanyEntryDestinations: async request => (++n === 1 ? base.resolveCompanyEntryDestinations(request) : { ok: false, code: 'ACCOUNT_CHANGED', requestId: request.requestId }) };
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge, mountFace, onOpenPurposeTarget: async () => ({ ok: true }) });
  t.after(() => host.dispose());
  await settle();
  made.face.handle('continue-personal');
  await settle();
  made.face.handle('open-switch');
  await settle();
  made.face.handle('go', 'pulse');
  await settle();
  assert.equal(made.view.scenes.at(-1).fan.error, '계정 연결이 바뀌었습니다. 잠시 뒤 다시 시도해 주세요.');
});

test('the launcher hands the face its room bridge: account requests that drop a reply after an account change, the shared sign-out check, and a handle for the account lifecycle', () => {
  const src = fs.readFileSync(new URL('../renderer/launcher.mjs', import.meta.url), 'utf8');
  assert.match(src, /rooms:orbRoomOptions\(\)/);
  assert.match(src, /function orbAccountCall\(run\)\{const epoch=accountLifecycle\.epoch\(\);[^}]*epoch===accountLifecycle\.epoch\(\)\?result:\{ok:false,code:'changed'\}/);
  assert.match(src, /confirmLeave:\(\)=>confirmDraftExit\(SIGN_OUT_DRAFT\)/);
  assert.match(src, /if\(!await confirmDraftExit\(SIGN_OUT_DRAFT\)/, 'the fan sign-out asks the same question');
  assert.match(src, /accountLifecycle\.register\('orb-rooms',\{onAccountChange:\(\)=>orbRooms\?\.accountChanged\?\.\(\)\}\)/);
  assert.match(src, /accountPage\.securityVisitedRecently\(\)\|\|orbSecurityRecent\(\)/, 'a 「로그인과 보안」 opened from the room also adds the password hint');
});
