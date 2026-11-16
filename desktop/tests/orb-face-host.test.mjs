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
  const host = mountDesktopPortalHost({
    root, getAuth: () => null, bridge: null,
    mountFace: (r, options) => { seen = options; return face; },
    faceOptions: { onSignIn: 'not mine', onEnter: 'not mine', onOpenLegacy: legacy, look: { places: false } },
  });
  t.after(() => host.dispose());
  assert.equal(typeof seen.onSignIn, 'function');
  assert.equal(typeof seen.onEnter, 'function');
  assert.equal(seen.onOpenLegacy, legacy);
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

test('one assignment opens once and the entry result names the destination', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const opens = [];
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { destinations: ['/pulse-app/'], opens }), mountFace });
  t.after(() => host.dispose());
  await settle();
  assert.deepEqual(opens, ['/pulse-app/']);
  assert.equal(host.getState().phase, 'entered');
  assert.deepEqual(made.view.log.find(e => e[0] === 'dive'), ['dive', 'pulse']);
  assert.ok(!made.view.scenes.some(s => s.layer === 'switch'));
});

test('two assignments show one chooser and open only the chosen one, then reopen another space after entry', async t => {
  const { root } = fakeRoot();
  const auth = { current: signedInAuth() };
  const opens = [], lookups = { n: 0 };
  const { mountFace, made } = orbFaceFactory();
  const host = mountDesktopPortalHost({ root, getAuth: () => auth.current, bridge: companyBridge(auth, { destinations: ['/', '/pulse-app/'], opens, lookups }), mountFace });
  t.after(() => host.dispose());
  await settle();
  assert.equal(host.getState().phase, 'workspace');
  assert.deepEqual(opens, []);
  made.face.handle('go', 'workspace');
  await settle();
  assert.deepEqual(opens, ['/']);
  assert.equal(host.getState().phase, 'entered');
  // 들어온 뒤 공간 고르기에서 PULSE를 연다. 살아 있는 기록이 있으면 다시 조회하지 않는다
  const before = lookups.n;
  made.face.handle('open-switch');
  await settle();
  made.face.handle('go', 'pulse');
  await settle();
  assert.deepEqual(opens, ['/', '/pulse-app/']);
  assert.equal(lookups.n, before, 'a live record needs no second lookup');
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
  // 「솔리오로」를 거쳐 들어가면 확인 기록이 비워진다
  made.face.handle('continue-personal');
  await settle();
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
  made.face.handle('continue-personal');
  await settle();
  list = ['/'];
  made.face.handle('open-switch');
  await settle();
  assert.deepEqual(made.view.scenes.at(-1).switch.names.map(n => n.space), ['solio', 'workspace', 'pulse']);
  made.face.handle('go', 'pulse');
  await settle();
  assert.deepEqual(opens, [], 'the fresh lookup no longer lists PULSE');
  assert.match(made.view.scenes.at(-1).switch.error, /확인된 공간이 아닙니다/);
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
    const error = made.view.scenes.at(-1).switch.error;
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
    const error = made.view.scenes.at(-1).switch.error;
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
  assert.equal(made.view.scenes.at(-1).switch.error, '계정 연결이 바뀌었습니다. 잠시 뒤 다시 시도해 주세요.');
});
