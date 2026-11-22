// 검정 구 얼굴의 컨트롤러 시험(PC 클라이언트 1단계, 1단계_구현설계.md 15절).
// 컨트롤러를 기록용 가짜 화면으로 돌린다. 화면이 받은 장면과 움직임을 차례로 적어 두고,
// 옮기기 설계 「이어받는 로그인 동작」의 뜻(복원하는 동안 글 0, 묻는 화면을 거치지 않음, 배정 하나는 바로, 둘은 고르기 한 번, 구 지키기와 풀기)을 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createOrbFaceController, faceSentence, ORB_RETURNING_KEY, sanitizeInviteFeedback, unconfiguredReason, workspaceLead } from '../renderer/orb-face.mjs';
import { ROOM_TIMING } from '../renderer/orb-rooms.mjs';
import { officeState, officeReduce } from '../renderer/office-model.mjs';

const ACCOUNT = '20000000-0000-4000-8000-000000000002';
const OTHER = '60000000-0000-4000-8000-000000000006';
const tick = () => new Promise(resolve => setImmediate(resolve));
const pause = () => new Promise(resolve => setTimeout(resolve, 2));
// 컨트롤러의 타이머는 시험에서 0ms로 돈다. setImmediate만으로는 1ms 타이머 차례가 오지 않아 실제 타이머를 섞는다
async function settle(n = 12) { for (let i = 0; i < n; i++) { await tick(); if (i % 3 === 2) await pause(); } }

function fakeView() {
  const root = { dataset: {} };
  let invite = '';
  const view = {
    root,
    log: [],
    scenes: [],
    render(scene) { view.scenes.push(scene); root.dataset.portalState = scene.phase; },
    intro(kind) { view.log.push(['intro', kind]); return Promise.resolve(); },
    hurryIntro() { view.log.push(['hurry']); },
    move(pose) { view.log.push(['move', pose]); return Promise.resolve(); },
    dive(space) { view.log.push(['dive', space]); return Promise.resolve(); },
    arrive(space, sig) { view.log.push(['arrive', space, sig]); return Promise.resolve(); },
    getInviteValue: () => invite,
    setInviteValue(value) { invite = value; },
    type(value) { invite = value; },
    isHidden: () => false,
    prefersReducedMotion: () => false,
    emitState() {},
    dispose() {},
    last: () => view.scenes.at(-1),
    layers: () => view.scenes.map(s => s.layer),
    moves: () => view.log.filter(e => e[0] === 'move').map(e => e[1]),
  };
  return view;
}

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map };
}

function harness(t, { options = {}, storage = memoryStorage(), initial = { status: 'restoring' } } = {}) {
  const view = fakeView();
  const timers = [];
  const calls = [];
  const record = (name, fn) => (...args) => { calls.push([name, ...args]); return fn ? fn(...args) : { ok: true }; };
  const opts = {
    initialState: initial,
    onSignIn: record('signIn'),
    onSignUp: record('signUp'),
    onCancelSignIn: record('cancelSignIn'),
    onRetry: record('retry'),
    onSwitchAccount: record('switchAccount'),
    onEnter: record('enter', () => ({ ok: true, action: 'purpose', purposeMode: 'existing' })),
    onEnterDefault: record('enterDefault'),
    onSelectWorkspace: record('selectWorkspace'),
    onRetryWorkspace: record('retryWorkspace'),
    onContinuePersonal: record('continuePersonal', () => ({ ok: true, action: 'purpose', purposeMode: 'existing' })),
    onInvite: record('invite'),
    onCancelInvite: record('cancelInvite'),
    onOpenSpace: record('openSpace', dest => ({ ok: true, destination: dest })),
    onOpenLegacy: record('openLegacy'),
    onSignOut: record('signOut'),
    ...options,
  };
  const env = {
    storage,
    setTimeout: (fn, ms) => { timers.push(ms); return setTimeout(fn, 0); },
    clearTimeout: id => clearTimeout(id),
    setInterval: () => 0,
    clearInterval: () => {},
  };
  const face = createOrbFaceController({ view, options: opts, env });
  t.after(() => face.dispose());
  return { face, view, calls, timers, storage, names: () => calls.map(c => c[0]) };
}

const signedIn = (accountKey = ACCOUNT, generation = 1) => ({ status: 'signed-in', accountKey, generation });

test('an existing account goes from the first orb to Solio with no text and no ask scene', async t => {
  const h = harness(t, { storage: memoryStorage({ [ORB_RETURNING_KEY]: '1' }) });
  await settle();
  assert.equal(h.face.getState().phase, 'welcome');
  h.face.setState(signedIn());
  await settle();
  assert.deepEqual(h.view.log.find(e => e[0] === 'intro'), ['intro', 'back'], 'returning PCs use the short opening');
  assert.equal(h.face.getState().phase, 'entered');
  assert.ok(!h.view.layers().includes('ask'), 'no ask scene for a restored account');
  assert.ok(!h.view.layers().includes('switch'));
  assert.ok(!h.view.moves().includes('ask'));
  assert.deepEqual(h.names().filter(n => n === 'enter' || n === 'enterDefault'), ['enter', 'enterDefault']);
  assert.deepEqual(h.view.log.find(e => e[0] === 'arrive'), ['arrive', 'solio', 'quick']);
  assert.equal(h.view.last().layer, 'app');
  assert.equal(h.face.clientMode(), 'app');
  assert.equal(h.face.isActive(), false);
  assert.equal(h.face.shouldBlockShortcuts(), false, 'zoom must work on the daily Solio screen');
  assert.equal(h.storage.map.get(ORB_RETURNING_KEY), '1');
});

test('a slow restore never shows the ask scene or text, even when the orb is pressed meanwhile', async t => {
  const h = harness(t);
  await settle();
  h.face.handle('wake');
  await settle();
  assert.equal(h.face.getState().phase, 'checking', 'pressing before the result goes to the quiet check');
  assert.equal(h.view.last().orbBusy, true);
  // 복원 결과가 3초 늦게 온다고 치고, 그동안 장면을 여러 번 그린다
  for (let i = 0; i < 5; i++) { h.face.setState({ status: 'restoring' }); await settle(2); }
  assert.ok(!h.view.scenes.some(s => s.phase === 'auth'), 'portalState never passes auth');
  assert.ok(!h.view.layers().includes('ask'));
  assert.ok(!h.view.moves().includes('ask'), 'the orb does not grow before the result');
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.getState().phase, 'entered');
  assert.ok(!h.view.layers().includes('ask'));
});

test('a guest orb grows by itself only after the result says signed out', async t => {
  const h = harness(t);
  await settle();
  assert.ok(!h.timers.includes(1350), 'no auto zoom while restoring');
  assert.ok(!h.view.moves().includes('ask'));
  h.face.setState({ status: 'signed-out', generation: 1 });
  await settle();
  assert.ok(h.timers.includes(1350), 'the 1.35 s wait starts after the result');
  assert.ok(h.view.moves().includes('ask'));
  assert.equal(h.face.getState().phase, 'auth');
  assert.equal(h.view.last().layer, 'ask');
  assert.equal(h.view.last().focus, 'signin');
});

test('unconfigured hides sign-in and sign-up but keeps the code field', async t => {
  const h = harness(t, { initial: { status: 'unconfigured', errorMessage: '설정 파일이 없어요.' } });
  await settle();
  const ask = h.view.last().ask;
  assert.equal(h.face.getState().phase, 'auth');
  assert.deepEqual([ask.unconfigured, ask.showSignIn, ask.showSignUp, ask.showInvite], [true, false, false, true]);
  // 호스트의 글은 새 얼굴의 「-습니다」 말씨로 끝만 바뀐다
  assert.equal(ask.unconfiguredText, '설정 파일이 없습니다.');
});

test('a fresh sign-in shows the browser line and lands with the full signature', async t => {
  const h = harness(t, { initial: { status: 'signed-out' } });
  await settle();
  h.face.handle('signin');
  await settle();
  assert.equal(h.face.getState().phase, 'signing-in');
  assert.equal(h.view.last().ask.status, '브라우저에서 로그인을 마치면 이 창으로 돌아옵니다.');
  assert.ok(h.face.handle('escape'));
  await settle();
  assert.ok(h.names().includes('cancelSignIn'), 'Esc cancels a sign-in');
  assert.equal(h.face.getState().phase, 'auth');
  h.face.handle('signin');
  await settle();
  h.face.setState({ status: 'signing-in', generation: 2 });
  h.face.setState(signedIn(ACCOUNT, 3));
  await settle();
  assert.equal(h.face.getState().phase, 'entered');
  assert.deepEqual(h.view.log.find(e => e[0] === 'arrive'), ['arrive', 'solio', 'full']);
});

test('sign-up stays on the ask scene and says to sign in after joining in the browser', async t => {
  const h = harness(t, { initial: { status: 'signed-out' } });
  await settle();
  h.face.handle('signup');
  await settle();
  assert.equal(h.face.getState().phase, 'auth');
  assert.equal(h.view.last().ask.note, '브라우저에서 가입한 뒤 「로그인」을 눌러 주세요.');
});

test('one assignment goes straight into that space with no chooser', async t => {
  const h = harness(t, { options: { onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.ok(!h.view.layers().includes('switch'));
  assert.deepEqual(h.view.log.find(e => e[0] === 'dive'), ['dive', 'workspace']);
  assert.equal(h.view.last().room.say, 'Workspace를 열었습니다.');
  assert.equal(h.view.last().room.then, '따로 열린 Workspace 창에서 이어 가 주세요.');
  h.face.handle('reopen-space');
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'openSpace').map(c => c[1]), ['/']);
});

test('two assignments show the chooser once and open only the chosen space', async t => {
  const workspace = { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [], canContinuePersonal: true, canSwitchAccount: true };
  const h = harness(t, { options: { onEnter: () => ({ ok: true, action: 'workspace', workspace }) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.getState().phase, 'workspace');
  const chooser = h.view.last().switch;
  assert.deepEqual(chooser.names.map(n => n.space), ['workspace', 'pulse']);
  assert.deepEqual(chooser.actions.map(a => a.action), ['continue-personal', 'workspace-switch-account']);
  assert.deepEqual(h.view.last().places, ['solio', 'workspace', 'pulse']);
  h.face.handle('go', 'pulse');
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'selectWorkspace').map(c => c[1]), ['/pulse-app/']);
  assert.deepEqual(h.view.log.find(e => e[0] === 'dive'), ['dive', 'pulse']);
  assert.equal(h.view.scenes.filter((s, i, all) => s.layer === 'switch' && all[i - 1]?.layer !== 'switch').length, 1, 'the chooser appears once');
});

test('Esc on the entry chooser goes to Solio through the default entry', async t => {
  const workspace = { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] };
  const h = harness(t, { options: { onEnter: () => ({ ok: true, action: 'workspace', workspace }) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.ok(h.face.handle('escape'));
  await settle();
  assert.ok(h.names().includes('continuePersonal'));
  assert.ok(h.names().includes('enterDefault'));
  assert.equal(h.face.getState().phase, 'entered');
  assert.equal(h.view.last().space, 'solio');
});

test('a host that only asks to navigate keeps the orb held until it is released', async t => {
  const h = harness(t, { options: { onEnter: () => ({ ok: true, destination: '/', navigationRequested: true }) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.getState().phase, 'entered');
  assert.equal(h.face.isActive(), true);
  assert.equal(h.face.shouldBlockShortcuts(), true);
  assert.ok(h.view.log.some(e => e[0] === 'dive'));
  assert.ok(!h.view.log.some(e => e[0] === 'arrive'), 'the orb stays inside');
  assert.equal(h.face.releaseNavigationHold(), true);
  await settle();
  assert.equal(h.face.isActive(), false);
  assert.ok(h.view.log.some(e => e[0] === 'arrive'));

  const p = harness(t, { options: { onEnter: () => ({ ok: true, destination: '/pulse-app/', navigationRequested: true }) } });
  await settle();
  p.face.setState(signedIn());
  await settle();
  assert.equal(p.face.isActive(), true);
  p.face.handle('pageshow', true);
  await settle();
  assert.equal(p.face.isActive(), false, 'a restored page releases the hold');
});

test('signing out after entering goes back to the ask scene and clears the returning flag', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.storage.map.get(ORB_RETURNING_KEY), '1');
  h.face.handle('open-switch');
  await settle();
  assert.deepEqual(h.view.last().fan.foot.map(f => f.action), ['account', 'settings', 'logout']);
  h.face.handle('foot', 'logout');
  await settle();
  assert.ok(h.names().includes('signOut'));
  h.face.setState({ status: 'signed-out', generation: 2 });
  await settle();
  assert.equal(h.face.getState().phase, 'auth');
  assert.equal(h.face.clientMode(), 'portal');
  assert.equal(h.view.last().layer, 'ask');
  assert.equal(h.storage.map.has(ORB_RETURNING_KEY), false);
});

test('another account arriving after entry passes the ask scene and enters as that account', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  const entersBefore = h.names().filter(n => n === 'enter').length;
  h.face.setState(signedIn(OTHER, 2));
  await settle();
  assert.equal(h.face.getState().accountKey, OTHER);
  assert.equal(h.face.getState().phase, 'entered');
  assert.equal(h.names().filter(n => n === 'enter').length, entersBefore + 1);
  assert.ok(h.view.scenes.some(s => s.phase === 'auth' || s.phase === 'entering'));
});

test('a late assignment answer for the previous account is dropped', async t => {
  let release;
  const first = new Promise(resolve => { release = resolve; });
  let n = 0;
  const h = harness(t, { options: { onEnter: () => (++n === 1 ? first : { ok: true, action: 'purpose', purposeMode: 'existing' }) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.getState().phase, 'entering');
  h.face.setState({ status: 'signed-out', generation: 2 });
  await settle();
  release({ ok: true, destination: '/', destinations: ['/'] });
  await settle();
  assert.notEqual(h.face.getState().phase, 'entered');
  assert.ok(!h.view.log.some(e => e[0] === 'dive'), 'no dive for the stale answer');
});

test('the invite goes into the invite phase before onInvite and keeps the code after an error', async t => {
  const raw = 'https://workspace.synk.im/pulse-app/#invite=SyntheticInvite_1234567890';
  let seen = null;
  const h = harness(t, {
    initial: { status: 'signed-out' },
    options: { onInvite: (value, meta) => { seen = { value, meta, portalState: h.view.root.dataset.portalState, phase: h.face.getState().phase }; return { ok: false, message: `초대 ${raw}를 열지 못했어요.` }; } },
  });
  await settle();
  h.view.type(raw);
  h.face.handle('invite-submit');
  await settle();
  assert.deepEqual([seen.portalState, seen.phase], ['invite', 'invite']);
  assert.equal(seen.meta.kind, 'link');
  const ask = h.view.last().ask;
  assert.equal(ask.wait, 'error');
  assert.ok(!ask.inviteError.includes('SyntheticInvite'), 'the error line never carries the code');
  assert.equal(ask.inviteError, '이 초대코드를 확인하지 못했습니다. 받은 코드를 다시 붙여 넣어 주세요.');
  h.face.handle('close-invite');
  await settle();
  assert.equal(h.face.getState().phase, 'auth');
  assert.equal(h.view.getInviteValue(), raw, 'retry keeps the code');
  assert.equal(h.view.last().focus, 'code-select');
});

test('a guest invite that is received stays on the ask scene with one line', async t => {
  const h = harness(t, { initial: { status: 'signed-out' }, options: { onInvite: () => ({ ok: true, state: 'received', destination: '/', keepOpen: true }) } });
  await settle();
  h.view.type('SyntheticInvite_1234567890');
  h.face.handle('invite-submit');
  await settle();
  assert.equal(h.face.getState().phase, 'invite');
  assert.equal(h.view.last().ask.status, '초대받은 공간을 열었습니다. 열린 창에서 이어 가 주세요.');
  assert.deepEqual(h.view.last().ask.actions.map(a => a.label), ['돌아가기']);
  assert.ok(!h.view.log.some(e => e[0] === 'dive'));
  h.face.handle('close-invite');
  await settle();
  assert.equal(h.face.getState().phase, 'auth');
  assert.equal(h.view.getInviteValue(), '');
});

test('cancelling an invite in flight tells the host and drops the late answer', async t => {
  let release;
  const h = harness(t, { initial: { status: 'signed-out' }, options: { onInvite: () => new Promise(resolve => { release = resolve; }) } });
  await settle();
  h.view.type('SyntheticInvite_1234567890');
  h.face.handle('invite-submit');
  await settle();
  assert.equal(h.view.last().ask.status, '초대를 확인하고 있습니다.');
  assert.ok(h.face.handle('escape'));
  await settle();
  assert.ok(h.names().includes('cancelInvite'));
  release({ ok: true, state: 'received', keepOpen: true });
  await settle();
  assert.equal(h.face.getState().phase, 'auth');
  assert.equal(h.view.last().ask.status, '');
});

test('error and enter-error offer retry and a new sign-in, and the retry check shows no text', async t => {
  const h = harness(t, { initial: { status: 'error', errorMessage: '계정 연결 상태를 확인하지 못했어요.' }, options: { onRetry: () => new Promise(() => {}) } });
  await settle();
  assert.equal(h.face.getState().phase, 'error');
  assert.deepEqual(h.view.last().ask.actions.map(a => a.action), ['retry-auth', 'go-auth']);
  h.face.handle('retry-auth');
  await settle();
  assert.equal(h.face.getState().phase, 'checking');
  assert.equal(h.view.last().layer, 'none', 'no text while checking again');

  const e = harness(t, { options: { onEnter: () => ({ ok: false, message: '배정을 불러오지 못했어요.' }) } });
  await settle();
  e.face.setState(signedIn());
  await settle();
  assert.equal(e.face.getState().phase, 'enter-error');
  assert.deepEqual(e.view.last().ask.actions.map(a => a.action), ['retry-enter', 'switch-account']);
  assert.equal(e.view.last().ask.status, '배정을 불러오지 못했습니다.');
});

test('the QA guest path opens only when the main process allows it', async t => {
  let allow = false;
  const h = harness(t, {
    initial: { status: 'signed-out' },
    options: { allowGuestEntry: () => allow, onBrowse: () => ({ ok: true, action: 'purpose' }), onSelectPurpose: () => ({ ok: true }) },
  });
  await settle();
  h.face.handle('qa-guest');
  await settle();
  assert.equal(h.face.getState().phase, 'auth', 'the event is ignored without the main process value');
  allow = true;
  h.face.handle('qa-guest');
  await settle();
  assert.equal(h.face.getState().phase, 'entered');
  assert.equal(h.view.last().room.solio.say, '구독 자료는 PC 앱에서 읽습니다.');
  h.face.handle('open-switch');
  await settle();
  assert.deepEqual(h.view.last().fan.foot.map(f => f.action), ['settings']);
  // 손님으로 들어온 뒤의 같은 손님 상태는 묻는 화면으로 되돌리지 않는다
  h.face.setState({ status: 'signed-out', generation: 5 });
  await settle();
  assert.equal(h.face.getState().phase, 'entered');
});

test('a busy subscriptions board is read again once, then said plainly', async t => {
  const now = Date.now();
  const okSnap = { ok: true, seq: 2, rows: [], check: { at: now - 60e3 }, usage: { accounts: {} } };
  let reads = 0;
  const subscriptions = { snapshot: async () => (++reads === 1 ? { ok: false, code: 'BOARD_BUSY' } : okSnap), check: async () => okSnap, onChanged: () => () => {} };
  const h = harness(t, { options: { subscriptions } });
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  assert.equal(reads, 2);
  assert.equal(h.view.last().room.solio.say, '아직 연결한 AI 구독이 없습니다.');

  let busyReads = 0;
  const busy = { snapshot: async () => { busyReads++; return { ok: false, code: 'BOARD_BUSY' }; }, check: async () => ({ ok: false, code: 'BOARD_BUSY' }) };
  const b = harness(t, { options: { subscriptions: busy } });
  await settle();
  b.face.setState(signedIn());
  await settle(30);
  assert.equal(busyReads, 2, 'only one automatic retry');
  assert.equal(b.view.last().room.solio.say, '구독 자료를 읽지 못했습니다.');
});

test('values an hour old are read again once on entry', async t => {
  const now = Date.now();
  const row = { id: 'r1', service: 'claude', source: 'auto', label: 'Claude', kind: 'weekly', state: 'ok', live: { readAt: now - 2 * 3600e3, weekly: { usedPercent: 20, resetsAt: now + 3 * 864e5 } } };
  const old = { ok: true, seq: 1, rows: [row], check: { at: now - 2 * 3600e3 }, usage: { accounts: {} } };
  const fresh = { ...old, seq: 2, check: { at: now } };
  let checks = 0;
  const subscriptions = { snapshot: async () => old, check: async () => { checks++; return fresh; }, onChanged: () => () => {} };
  const h = harness(t, { options: { subscriptions } });
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  assert.equal(checks, 1);
  assert.equal(h.view.last().room.solio.read, '방금 읽은 값입니다.');
  h.face.handle('reread');
  await settle(10);
  assert.equal(checks, 2, 'the person can still read again');
});

test('「계정 관리」 opens the account management room in the face, not the old board, and Esc comes back (2단계 둘째 조각 설계 9절)', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.handle('row', 'claude'), false, 'a row press only pins its inside now (2단계 첫 조각 설계 2.4절)'); h.face.handle('subs-manage');
  await settle();
  assert.ok(!h.calls.some(c => c[0] === 'openLegacy'), 'the old subscriptions board is not opened any more');
  assert.equal(h.face.clientMode(), 'app');
  assert.deepEqual([h.view.last().aside, h.view.last().focus], ['manage', 'aside']);
  assert.ok(h.face.handle('escape'));
  assert.deepEqual([h.view.last().aside, h.view.last().focus], [null, 'aside-return']);
  h.face.handle('connect');
  assert.equal(h.view.last().aside, 'manage');
  assert.ok(!h.calls.some(c => c[0] === 'openLegacy'));
});

test('the space switch lists Solio and the account assignments and reopens a space through onOpenSpace', async t => {
  const workspace = { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] };
  const h = harness(t, { options: { onEnter: () => ({ ok: true, action: 'workspace', workspace }) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('continue-personal');
  await settle();
  h.face.handle('open-switch');
  await settle();
  const sw = h.view.last().fan;
  assert.equal(h.view.last().layer, 'app'); assert.equal(sw.open, true, 'the fan opens beside the orb (2단계 첫 조각)');
  assert.deepEqual(sw.names.map(n => [n.space, n.current]), [['solio', true], ['workspace', false], ['pulse', false]]);
  h.face.handle('go', 'workspace');
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'openSpace').map(c => c[1]), ['/']);
  assert.equal(h.view.last().space, 'workspace');
  assert.deepEqual(h.view.log.filter(e => e[0] === 'arrive').at(-1), ['arrive', 'workspace', 'quick']);
  h.face.handle('open-switch');
  await settle();
  h.face.handle('go', 'solio');
  await settle();
  assert.equal(h.view.last().space, 'solio');
  assert.equal(h.calls.filter(c => c[0] === 'openSpace').length, 1, 'going back to Solio opens nothing');
});

test('a space outside the account assignments is never opened', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('go', 'pulse');
  await settle();
  assert.equal(h.calls.filter(c => c[0] === 'openSpace').length, 0);
});

test('the signature can be switched off', async t => {
  const h = harness(t, { options: { look: { signature: false } } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.deepEqual(h.view.log.find(e => e[0] === 'arrive'), ['arrive', 'solio', null]);
});

test('invite feedback and workspace lines in plain sentences', () => {
  assert.equal(sanitizeInviteFeedback('코드 ABCDEF를 확인했어요', 'ABCDEF', 'ABCDEF'), '');
  assert.equal(sanitizeInviteFeedback('만료된 초대예요.', 'ABCDEF', 'ABCDEF'), '만료된 초대입니다.');
  assert.equal(workspaceLead({ status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] }), '');
  assert.equal(workspaceLead({ status: 'partial', destinations: ['/'], unavailable: ['pulse'] }), 'PULSE 연결은 아직 확인하지 못했습니다. 확인된 Workspace로 먼저 들어가거나 다시 확인할 수 있습니다.');
  assert.match(workspaceLead({ status: 'login_required', destinations: [], unavailable: [] }), /회사 공간 로그인/);
});

test('host reasons keep their meaning and take the 「-습니다」 voice of the new face', () => {
  // 본체(auth-service.cjs MESSAGES)와 호스트(portal-host.mjs)가 실제로 보내는 글
  assert.equal(faceSentence('서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'), '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
  assert.equal(faceSentence('로그인 시간이 지났어요. 다시 시작해 주세요.'), '로그인 시간이 지났습니다. 다시 시작해 주세요.');
  assert.equal(faceSentence('이 PC의 암호화 저장소를 쓸 수 없어 로그인을 저장하지 못했어요.'), '이 PC의 암호화 저장소를 쓸 수 없어 로그인을 저장하지 못했습니다.');
  assert.equal(faceSentence('브라우저 미리보기에서는 로그인 연결을 확인하지 않아요.'), '브라우저 미리보기에서는 로그인 연결을 확인하지 않습니다.');
  assert.equal(faceSentence('만료된 초대예요. 새 코드를 받아 주세요.'), '만료된 초대입니다. 새 코드를 받아 주세요.');
  // 부탁, 이미 「-습니다」인 글, 모르는 꼴은 그대로 둔다
  assert.equal(faceSentence('다시 해 주세요.'), '다시 해 주세요.');
  assert.equal(faceSentence('계정 연결을 확인하지 못했습니다.'), '계정 연결을 확인하지 못했습니다.');
  assert.equal(faceSentence('알아요'), '알아요');
  assert.equal(faceSentence('  '), '');
  // 로그인 설정이 없는 판: 화면이 먼저 쓰는 「로그인 설정을 찾지 못했습니다.」와 겹치는 첫 문장은 뺀다
  assert.equal(unconfiguredReason('로그인 설정을 찾지 못해 로그인할 수 없어요. synk.im에서 PC 앱을 다시 받아 설치해 주세요.'), 'synk.im에서 PC 앱을 다시 받아 설치해 주세요.');
  assert.equal(unconfiguredReason('로그인 설정을 찾지 못했어요.'), 'synk.im에서 PC 앱을 다시 받아 설치해 주세요.');
  assert.equal(unconfiguredReason(''), 'synk.im에서 PC 앱을 다시 받아 설치해 주세요.');
  assert.equal(unconfiguredReason('브라우저 미리보기에서는 로그인 연결을 확인하지 않아요.'), '브라우저 미리보기에서는 로그인 연결을 확인하지 않습니다.');
});

test('a space entered through 「다시 확인」 joins the switch list and can be reopened (carbon A1)', async t => {
  // 처음 공간 확인은 새 창이 막혀 빈 목록이었고, 「다시 확인」에서 Workspace 하나로 바로 들어간다
  const blocked = { status: 'popup_blocked', destinations: [], unavailable: ['workspace'] };
  const h = harness(t, { options: {
    onEnter: () => ({ ok: true, action: 'workspace', workspace: blocked }),
    onRetryWorkspace: () => ({ ok: true, destination: '/', destinations: ['/'] }),
  } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.getState().phase, 'workspace');
  h.face.handle('retry-workspace');
  await settle();
  assert.equal(h.view.last().space, 'workspace');
  h.face.handle('open-switch');
  await settle();
  assert.deepEqual(h.view.last().fan.names.map(n => n.space), ['solio', 'workspace']);
  h.face.handle('close-switch');
  await settle();
  h.face.handle('reopen-space');
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'openSpace').map(c => c[1]), ['/']);
});

test('a fresh snapshot from the old board clears an earlier read failure on the Solio screen (carbon A7)', async t => {
  let push = null;
  const fresh = { ok: true, seq: 2, rows: [], check: { at: Date.now() - 60e3 }, checking: false, usage: { accounts: {} } };
  const subscriptions = { snapshot: async () => ({ ok: false, code: 'READ_FAILED' }), check: async () => null, onChanged: fn => { push = fn; return () => {}; } };
  const h = harness(t, { options: { subscriptions } });
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  assert.equal(h.view.last().mode, 'app');
  const failed = h.view.last().room.solio;
  assert.ok(push, 'the face listens for board changes');
  push(fresh);
  await settle();
  const after = h.view.last().room.solio;
  assert.notDeepEqual(after, failed);
  assert.equal(JSON.stringify(after).includes('READ_FAILED'), false);
});

test('a member who is refreshing the session or briefly offline keeps the member Solio screen (Fable final)', async t => {
  const snap = { ok: true, seq: 1, rows: [], check: { at: Date.now() - 60e3 }, checking: false, usage: { accounts: {} } };
  const m = mainSubscriptions(snap);
  const h = harness(t, { storage: memoryStorage({ [ORB_RETURNING_KEY]: '1' }), options: { subscriptions: m.subscriptions } });
  await settle();
  both(h, m, signedIn());
  await settle(30);
  assert.equal(h.view.last().mode, 'app');
  const member = h.view.last().room.solio.say;
  assert.equal(member, '아직 연결한 AI 구독이 없습니다.');
  // 같은 계정의 토큰 갱신(restoring)과 잠깐의 연결 오류(error)는 손님 문장으로 바꾸지 않는다
  both(h, m, { status: 'restoring', generation: 1 });
  await settle();
  assert.equal(h.view.last().room.solio.say, member);
  both(h, m, { status: 'error', generation: 1, errorMessage: '서버에 연결하지 못했어요.', retryable: true });
  await settle();
  assert.equal(h.view.last().room.solio.say, member);
  // 오류 중에 「다시 읽기」를 눌러 본체가 거절해도 손님 문장이 되지 않는다(Fable 다시 검수 -c)
  h.face.handle('reread');
  await settle(30);
  assert.equal(m.refused, 1);
  assert.equal(h.view.last().room.solio.say, member);
  assert.deepEqual(h.view.last().fan ? h.view.last().fan.foot.map(f => f.action) : ['account', 'settings', 'logout'], ['account', 'settings', 'logout']);
  // 로그아웃은 묻는 화면으로 돌아간다
  h.face.setState({ status: 'signed-out', generation: 2, accountKey: null });
  await settle();
  assert.notEqual(h.view.last().mode, 'app');
});

test('entering during a token refresh still counts as a member, and stale-generation updates are dropped (Fable final)', async t => {
  const h = harness(t, { storage: memoryStorage({ [ORB_RETURNING_KEY]: '1' }) });
  await settle();
  h.face.setState(signedIn(ACCOUNT, 5));
  await settle(30);
  assert.equal(h.view.last().mode, 'app');
  const enters = h.names().filter(n => n === 'enterDefault' || n === 'enter').length;
  // 같은 계정의 갱신 뒤 signed-in이 다시 와도 묻는 화면으로 나갔다 다시 들어가지 않는다
  h.face.setState({ status: 'restoring', generation: 5 });
  await settle();
  h.face.setState(signedIn(ACCOUNT, 6));
  await settle(30);
  assert.equal(h.view.last().mode, 'app');
  assert.equal(h.names().filter(n => n === 'enterDefault' || n === 'enter').length, enters);
  // 옛 세대의 로그아웃은 버린다
  h.face.setState({ status: 'signed-out', generation: 4, accountKey: null });
  await settle();
  assert.equal(h.view.last().mode, 'app');
});

test('a half-typed invite does not survive entering and signing out (Fable final)', async t => {
  const h = harness(t);
  await settle();
  h.face.setState({ status: 'signed-out', generation: 1 });
  await settle(30);
  h.view.type('https://synk.im/join#invite=abcdef');
  h.face.setState(signedIn(ACCOUNT, 2));
  await settle(30);
  assert.equal(h.view.getInviteValue(), '');
  h.view.type('leftover');
  h.face.setState({ status: 'signed-out', generation: 3, accountKey: null });
  await settle(30);
  assert.equal(h.view.getInviteValue(), '');
});

/* 본체(main.cjs subscriptionCall)를 흉내 내는 가짜 구독(Fable 다시 검수 -c, 설계 검토 3차 P2-2).
 * 본체의 로그인 상태(signedIn)를 얼굴과 따로 갖고, 부른 그때의 상태로 답을 정한다. hold를 켜면 답을 붙잡아 두었다가 flush()로 푼다.
 * 앞 회차의 시험은 늘 자료를 돌려주거나 얼굴의 상태로 거절을 정해, 본체와 얼굴이 엇갈리는 길을 보지 못했다 */
function mainSubscriptions(snap, { checkSnap = null } = {}) {
  const m = { signedIn: false, hold: false, held: [], reads: 0, checks: 0, refused: 0, onRefuse: null, failNext: 0 };
  const decide = kind => {
    if (kind === 'check') m.checks++; else m.reads++;
    if (!m.signedIn) { m.refused++; m.onRefuse?.(m); return { ok: false, code: 'SIGN_IN_REQUIRED' }; }
    if (m.failNext > 0) { m.failNext--; return { ok: false, code: 'READ_FAILED' }; }
    return kind === 'check' && checkSnap ? checkSnap : snap;
  };
  const call = kind => { const value = decide(kind); if (!m.hold) return Promise.resolve(value); return new Promise(resolve => m.held.push(() => resolve(value))); };
  m.flush = () => { for (const fn of m.held.splice(0)) fn(); };
  m.subscriptions = { snapshot: () => call('snapshot'), check: () => call('check'), onChanged: () => () => {} };
  return m;
}
// 호스트처럼 본체 상태와 얼굴 알림을 함께 바꾼다
function both(h, m, update) { m.signedIn = update.status === 'signed-in'; h.face.setState(update); }
const EMPTY_SNAP = () => ({ ok: true, seq: 1, rows: [], check: { at: Date.now() - 60e3 }, checking: false, usage: { accounts: {} } });
const NONE_SAY = '아직 연결한 AI 구독이 없습니다.';

test('arriving at Solio during a token refresh or an error waits as a member and reads once signed in again (Fable re-review -c)', async t => {
  // 1) 들어오는 중(배정을 기다리는 동안)에 같은 계정의 갱신이 오고, 그 뒤에 들어간다
  const m = mainSubscriptions(EMPTY_SNAP());
  let finishEnter;
  const h = harness(t, { options: { subscriptions: m.subscriptions, onEnter: () => new Promise(resolve => { finishEnter = resolve; }) } });
  await settle();
  both(h, m, signedIn(ACCOUNT, 1));
  await settle(30);
  both(h, m, { status: 'restoring', generation: 1 });
  await settle();
  finishEnter({ ok: true, action: 'purpose', purposeMode: 'existing' });
  await settle(40);
  assert.equal(h.view.last().mode, 'app');
  assert.notEqual(h.view.last().room.solio.state, 'guest', 'a member refreshing the session is never shown the guest sentence');
  assert.equal(h.view.last().room.solio.say, '');
  assert.equal(m.refused, 0, 'nothing is read while the backend would refuse it');
  both(h, m, signedIn(ACCOUNT, 1));
  await settle(40);
  assert.equal(h.view.last().room.solio.say, NONE_SAY);
  assert.equal(m.reads, 1);

  // 2) Workspace 방에 있던 회원이 연결 오류 중에 공간 고르기에서 솔리오로 온다. 오류 기다림은 조용히 네 번까지 다시 확인한다
  const m2 = mainSubscriptions(EMPTY_SNAP());
  const w = harness(t, { options: { subscriptions: m2.subscriptions, onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  both(w, m2, signedIn(ACCOUNT, 1));
  await settle(40);
  assert.equal(w.view.last().space, 'workspace');
  both(w, m2, { status: 'error', generation: 1, errorMessage: '서버에 연결하지 못했어요.', retryable: true });
  await settle();
  w.face.handle('open-switch');
  await settle();
  assert.deepEqual(w.view.last().fan.foot.map(f => f.action), ['account', 'settings', 'logout']);
  w.face.handle('go', 'solio');
  await settle(60);
  assert.equal(w.view.last().space, 'solio');
  const waiting = w.view.last().room.solio;
  assert.deepEqual([waiting.state, waiting.say, waiting.then, waiting.action], ['waiting', '계정 연결을 확인하지 못했습니다.', '연결되면 구독별 남은 양을 읽습니다.', 'recheck-auth']);
  assert.equal(m2.refused, 0);
  assert.ok(w.timers.includes(30000), 'the quiet re-check waits thirty seconds');
  const quiet = w.names().filter(n => n === 'retry').length;
  assert.ok(quiet >= 1 && quiet <= 4, 'at most four quiet re-checks: ' + quiet);
  assert.equal(w.view.last().busy, false, 'a quiet re-check does not mark the face busy');
  // 「다시 확인」 단추도 같은 확인을 부른다(확인하는 동안의 단추는 아래 다시 검수 -d 시험이 본다)
  w.face.handle('recheck-auth');
  await settle();
  assert.equal(w.names().filter(n => n === 'retry').length, quiet + 1);
  both(w, m2, signedIn(ACCOUNT, 1));
  await settle(40);
  assert.equal(w.view.last().room.solio.say, NONE_SAY);
});

test('the error wait ends by itself when the quiet re-check brings the account back (Fable design review 3 P2-1)', async t => {
  const m = mainSubscriptions(EMPTY_SNAP());
  let w = null;
  const onRetry = async () => { both(w, m, signedIn(ACCOUNT, 1)); return { ok: true }; };
  w = harness(t, { options: { subscriptions: m.subscriptions, onRetry, onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  both(w, m, signedIn(ACCOUNT, 1));
  await settle(40);
  both(w, m, { status: 'error', generation: 1, errorMessage: '서버에 연결하지 못했어요.', retryable: true });
  await settle();
  w.face.handle('open-switch');
  await settle();
  w.face.handle('go', 'solio');
  await settle(60);
  assert.equal(w.view.last().room.solio.say, NONE_SAY);
  assert.equal(m.refused, 0);
  assert.equal(m.reads, 1);
});

test('answers that cross the refresh notices never leave a member on the guest sentence (Fable design review 3 P2-2)', async t => {
  // (1) 본체가 먼저 갱신에 들어가 읽기를 거절했고, 그 답이 얼굴의 restoring 뒤에 온다
  const m = mainSubscriptions(EMPTY_SNAP());
  const h = harness(t, { options: { subscriptions: m.subscriptions } });
  await settle();
  m.hold = true;
  h.face.setState(signedIn(ACCOUNT, 1));
  await settle(30);
  assert.equal(m.refused, 1);
  both(h, m, { status: 'restoring', generation: 1 });
  await settle();
  m.flush();
  await settle(30);
  assert.deepEqual([h.view.last().room.solio.state, h.view.last().room.solio.say], ['loading', '']);
  m.hold = false;
  both(h, m, signedIn(ACCOUNT, 1));
  await settle(40);
  assert.equal(h.view.last().room.solio.say, NONE_SAY);

  // (2) 거절이 떠 있는 동안 restoring과 signed-in이 모두 지나가고, 거절이 signed-in 뒤에 온다 → 1초쯤 뒤 한 번 더 읽는다
  const m2 = mainSubscriptions(EMPTY_SNAP());
  const b = harness(t, { options: { subscriptions: m2.subscriptions } });
  await settle();
  m2.hold = true;
  b.face.setState(signedIn(ACCOUNT, 1));
  await settle(30);
  both(b, m2, { status: 'restoring', generation: 1 });
  await settle();
  both(b, m2, signedIn(ACCOUNT, 1));
  await settle();
  m2.hold = false;
  m2.flush();
  await settle(40);
  assert.equal(b.view.last().room.solio.say, NONE_SAY);
  assert.deepEqual([m2.refused, m2.reads], [1, 2]);
  assert.ok(b.timers.includes(1000));
});

test('a member look that drops and comes back for the same account reads again (Fable design review 3 P3-1)', async t => {
  const m = mainSubscriptions(EMPTY_SNAP());
  const h = harness(t, { options: { subscriptions: m.subscriptions } });
  await settle();
  m.hold = true;
  h.face.setState(signedIn(ACCOUNT, 1));
  await settle(30);
  // 읽는 중에 재시도할 수 없는 오류가 와 회원 판정이 거짓이 되고, 그 뒤에 거절 답이 온다
  both(h, m, { status: 'error', generation: 1, errorMessage: '계정을 확인하지 못했어요.', retryable: false });
  await settle();
  m.flush();
  await settle(30);
  assert.equal(h.view.last().room.solio.state, 'guest');
  m.hold = false;
  both(h, m, signedIn(ACCOUNT, 1));
  await settle(40);
  assert.equal(h.view.last().room.solio.say, NONE_SAY);
  assert.equal(m.reads, 2);
});

test('a reread refused during a refresh is checked again once signed in (Fable design review 3 path 5)', async t => {
  const fresh = { ...EMPTY_SNAP(), seq: 2, check: { at: Date.now() } };
  const m = mainSubscriptions(EMPTY_SNAP(), { checkSnap: fresh });
  const h = harness(t, { options: { subscriptions: m.subscriptions } });
  await settle();
  both(h, m, signedIn(ACCOUNT, 1));
  await settle(30);
  assert.equal(h.view.last().room.solio.say, NONE_SAY);
  both(h, m, { status: 'restoring', generation: 1 });
  await settle();
  h.face.handle('reread');
  await settle(30);
  assert.deepEqual([m.checks, m.refused], [1, 1]);
  assert.equal(h.view.last().room.solio.say, NONE_SAY, 'the data stays while the check waits');
  both(h, m, signedIn(ACCOUNT, 1));
  await settle(30);
  assert.deepEqual([m.checks, m.refused], [2, 1]);
});

test('a refusal that crosses a signed-in notice is read again once, then said as waiting, never as a guest (Fable re-review -c)', async t => {
  // 본체가 1초 안에 따라오면 두 번째 읽기로 자료가 뜬다
  const m = mainSubscriptions(EMPTY_SNAP());
  m.onRefuse = x => { x.signedIn = true; };
  const h = harness(t, { options: { subscriptions: m.subscriptions } });
  await settle();
  h.face.setState(signedIn(ACCOUNT, 1));
  await settle(60);
  assert.equal(h.view.last().room.solio.say, NONE_SAY);
  assert.deepEqual([m.refused, m.reads], [1, 2]);
  assert.ok(h.timers.includes(1000), 'the second read waits about a second');

  // 따라오지 않으면 기다림 문장을 보이고, 다음 signed-in 알림에서 다시 읽는다
  const m2 = mainSubscriptions(EMPTY_SNAP());
  const b = harness(t, { options: { subscriptions: m2.subscriptions } });
  await settle();
  b.face.setState(signedIn(ACCOUNT, 1));
  await settle(60);
  assert.deepEqual([b.view.last().room.solio.state, b.view.last().room.solio.action], ['waiting', 'recheck-auth']);
  assert.equal(m2.reads, 2);
  // 이 기다림도 조용한 다시 확인이 맡는다(다시 검수 -d P3). 네 번에서 멈춘다
  const quietB = b.names().filter(n => n === 'retry').length;
  assert.ok(quietB >= 1 && quietB <= 4, 'quiet re-checks after a double refusal: ' + quietB);
  both(b, m2, signedIn(ACCOUNT, 2));
  await settle(40);
  assert.equal(b.view.last().room.solio.say, NONE_SAY);
});

test('the 「다시 확인」 button stays while the check runs, only marked as checking (re-review -d)', async t => {
  const m = mainSubscriptions(EMPTY_SNAP());
  let release;
  const onRetry = () => new Promise(resolve => { release = resolve; });
  const w = harness(t, { options: { subscriptions: m.subscriptions, onRetry, onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  both(w, m, signedIn(ACCOUNT, 1));
  await settle(40);
  both(w, m, { status: 'error', generation: 1, errorMessage: '서버에 연결하지 못했어요.', retryable: true });
  await settle();
  w.face.handle('open-switch');
  await settle();
  w.face.handle('go', 'solio');
  await settle(60);
  // 조용한 다시 확인이 붙잡혀 있는 동안
  const checking = w.view.last().room.solio;
  assert.deepEqual([checking.say, checking.action, checking.checking], ['계정 연결을 다시 확인하고 있습니다.', 'recheck-auth', true]);
  release?.({ ok: false });
  await settle(30);
  assert.equal(w.view.last().room.solio.action, 'recheck-auth');
});

test('an old read failure does not block the read after arriving again during a refresh (re-review -d)', async t => {
  const m = mainSubscriptions(EMPTY_SNAP());
  m.failNext = 1;
  const w = harness(t, { options: { subscriptions: m.subscriptions, onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  both(w, m, signedIn(ACCOUNT, 1));
  await settle(40);
  // 솔리오에서 한 번 읽기에 실패한 채 Workspace로 갔다가
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'solio'); await settle(60);
  assert.equal(w.view.last().room.solio.say, '구독 자료를 읽지 못했습니다.');
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'workspace'); await settle(60);
  // 갱신 중에 솔리오로 다시 오고, signed-in이 돌아오면 읽는다
  both(w, m, { status: 'restoring', generation: 1 });
  await settle();
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'solio'); await settle(60);
  assert.deepEqual([w.view.last().room.solio.state, w.view.last().room.solio.say], ['loading', '']);
  both(w, m, signedIn(ACCOUNT, 1));
  await settle(40);
  assert.equal(w.view.last().room.solio.say, NONE_SAY);
});

test('a recovery outside Solio resets the quiet re-checks, so a later refresh waits quietly (re-review -e)', async t => {
  const m = mainSubscriptions(EMPTY_SNAP());
  const w = harness(t, { options: { subscriptions: m.subscriptions, onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  both(w, m, signedIn(ACCOUNT, 1));
  await settle(40);
  both(w, m, { status: 'error', generation: 1, errorMessage: '서버에 연결하지 못했어요.', retryable: true });
  await settle();
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'solio'); await settle(60);
  assert.equal(w.view.last().room.solio.state, 'waiting');
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'workspace'); await settle(60);
  // 솔리오 밖에서 계정이 돌아오고, 그 뒤 평범한 토큰 갱신 중에 솔리오로 온다
  both(w, m, signedIn(ACCOUNT, 1));
  await settle();
  both(w, m, { status: 'restoring', generation: 1 });
  await settle();
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'solio'); await settle(60);
  assert.deepEqual([w.view.last().room.solio.state, w.view.last().room.solio.say], ['loading', '']);
});

test('the quiet re-checks stop at four per outage, even when signed-in notices cross slow refusals (re-review -f)', async t => {
  // 본체는 계속 거절한다. 호스트처럼 다시 확인 안에서 signed-in 알림을 보내고, 읽기 답이 늦는 동안 알림이 한 번 더 온다
  const m = mainSubscriptions(EMPTY_SNAP());
  let h = null, checks = 0;
  const onRetry = async () => {
    checks++;
    if (checks > 12) return { ok: true };
    m.hold = true;
    h.face.setState(signedIn(ACCOUNT, 1));
    setTimeout(() => { h.face.setState(signedIn(ACCOUNT, 1)); m.hold = false; m.flush(); }, 0);
    return { ok: true };
  };
  h = harness(t, { options: { subscriptions: m.subscriptions, onRetry } });
  await settle();
  h.face.setState(signedIn(ACCOUNT, 1));
  await settle(300);
  assert.equal(checks, 4);
  assert.equal(h.view.last().room.solio.state, 'waiting');
});

test('a double refusal left behind does not turn a later refresh into the error wait (re-review -f)', async t => {
  const m = mainSubscriptions(EMPTY_SNAP());
  const w = harness(t, { options: { subscriptions: m.subscriptions, onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  w.face.setState(signedIn(ACCOUNT, 1));
  await settle(40);
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'solio'); await settle(200);
  assert.equal(w.view.last().room.solio.state, 'waiting');
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'workspace'); await settle(60);
  both(w, m, signedIn(ACCOUNT, 1));
  await settle();
  both(w, m, { status: 'restoring', generation: 1 });
  await settle();
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'solio'); await settle(60);
  assert.deepEqual([w.view.last().room.solio.state, w.view.last().room.solio.say], ['loading', '']);
  both(w, m, signedIn(ACCOUNT, 1));
  await settle(40);
  assert.equal(w.view.last().room.solio.say, NONE_SAY);
});

test('a new outage after the account came back gets its four quiet re-checks again (re-review -e · -f)', async t => {
  const m = mainSubscriptions(EMPTY_SNAP());
  const w = harness(t, { options: { subscriptions: m.subscriptions, onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  both(w, m, signedIn(ACCOUNT, 1));
  await settle(40);
  const outage = () => both(w, m, { status: 'error', generation: 1, errorMessage: '서버에 연결하지 못했어요.', retryable: true });
  outage();
  await settle();
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'solio'); await settle(200);
  assert.equal(w.names().filter(n => n === 'retry').length, 4);
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'workspace'); await settle(60);
  // 솔리오 밖에서 계정이 돌아오고(읽기 없음), 뒤에 새 장애가 온다
  both(w, m, signedIn(ACCOUNT, 1));
  await settle();
  outage();
  await settle();
  w.face.handle('open-switch'); await settle();
  w.face.handle('go', 'solio'); await settle(200);
  assert.equal(w.names().filter(n => n === 'retry').length, 8);
});

test('an error that cannot be retried does not keep the member look (Fable re-review -c P3)', async t => {
  const h = harness(t, { options: { onEnter: () => ({ ok: true, destination: '/', destinations: ['/'] }) } });
  await settle();
  h.face.setState(signedIn(ACCOUNT, 1));
  await settle(40);
  h.face.setState({ status: 'error', generation: 1, errorMessage: '계정을 확인하지 못했어요.', retryable: false });
  await settle();
  h.face.handle('open-switch');
  await settle();
  assert.deepEqual(h.view.last().fan.foot.map(f => f.action), ['settings']);
});

test('the entry chooser marks Solio only when personal is allowed, and choosing Solio continues personal (0.4.95 carbon B3)', async t => {
  const closed = { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [], canContinuePersonal: false, canSwitchAccount: true };
  const h = harness(t, { options: { onEnter: () => ({ ok: true, action: 'workspace', workspace: closed }) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.deepEqual(h.view.last().places, ['workspace', 'pulse']);
  h.face.handle('go', 'solio');
  await settle();
  assert.ok(!h.names().includes('selectWorkspace') && !h.names().includes('continuePersonal'), 'Solio is not opened through the workspace path');

  const open = { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [], canContinuePersonal: true, canSwitchAccount: true };
  const p = harness(t, { options: { onEnter: () => ({ ok: true, action: 'workspace', workspace: open }) } });
  await settle();
  p.face.setState(signedIn());
  await settle();
  assert.deepEqual(p.view.last().places, ['solio', 'workspace', 'pulse']);
  p.face.handle('go', 'solio');
  await settle();
  assert.ok(p.names().includes('continuePersonal'));
  assert.ok(!p.names().includes('selectWorkspace'));
  assert.equal(p.face.getState().phase, 'entered');
  assert.equal(p.view.last().space, 'solio');
});

test('「다시 시도」 is not taken while another action runs (0.4.95 carbon B4)', async t => {
  const h = harness(t, { options: { onEnter: () => ({ ok: false, message: '배정을 불러오지 못했어요.' }), onSwitchAccount: () => new Promise(() => {}) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.getState().phase, 'enter-error');
  const enters = h.names().filter(n => n === 'enter').length;
  h.face.handle('switch-account');
  await settle();
  h.face.handle('retry-enter');
  await settle();
  assert.equal(h.face.getState().phase, 'enter-error', 'the phase does not move to entering with no entry started');
  assert.equal(h.names().filter(n => n === 'enter').length, enters);
});

test('「다시 확인」 that lands in the personal space forgets the spaces remembered before (0.4.95 carbon B5)', async t => {
  // 처음 확인은 일부만 됐다. Workspace는 확인됐고 PULSE는 확인하지 못해 공간 고르기에 「다시 확인」이 있다. 이때 Workspace를 기억한다
  const partial = { status: 'partial', destinations: ['/'], unavailable: ['pulse'], canContinuePersonal: true };
  const h = harness(t, { options: {
    onEnter: () => ({ ok: true, action: 'workspace', workspace: partial }),
    onRetryWorkspace: () => ({ ok: true, action: 'purpose', purposeMode: 'existing' }),
  } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.getState().phase, 'workspace');
  assert.ok(h.view.last().switch.actions.some(a => a.action === 'retry-workspace'));
  // 「다시 확인」은 이제 배정이 없다고 한다. 개인 공간으로 들어가고, 앞에서 기억한 Workspace는 공간 고르기에 남지 않는다
  h.face.handle('retry-workspace');
  await settle();
  assert.equal(h.view.last().space, 'solio');
  h.face.handle('open-switch');
  await settle();
  assert.deepEqual(h.view.last().fan.names.map(n => n.space), ['solio'], 'the old Workspace is not listed');
});

test('a held navigation released by a sign-in notice still lands the orb (0.4.95 carbon B6)', async t => {
  const h = harness(t, { options: { onEnter: () => ({ ok: true, destination: '/', navigationRequested: true }) } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.face.isActive(), true);
  assert.ok(!h.view.log.some(e => e[0] === 'arrive'));
  h.face.setState({ status: 'signing-in', accountKey: ACCOUNT, generation: 2 });
  await settle();
  assert.equal(h.face.isActive(), false);
  assert.ok(h.view.log.some(e => e[0] === 'arrive'), 'the orb comes out instead of staying inside');
});

test('the space switch stays open while a space opens, so its failure is said there (0.4.95 carbon D2)', async t => {
  const workspace = { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] };
  let release;
  const h = harness(t, { options: {
    onEnter: () => ({ ok: true, action: 'workspace', workspace }),
    onOpenSpace: () => new Promise(resolve => { release = resolve; }),
  } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('continue-personal');
  await settle();
  h.face.handle('open-switch');
  await settle();
  h.face.handle('go', 'pulse');
  await settle();
  h.face.handle('close-switch');
  await settle();
  assert.equal(h.view.last().fan.open, true, 'closing waits for the open to finish');
  release({ ok: false, message: '그 공간을 열지 못했어요.' });
  await settle();
  assert.equal(h.view.last().fan.open, true);
  assert.equal(h.view.last().fan.error, '그 공간을 열지 못했습니다.');
  assert.equal(h.view.last().space, 'solio');
});

test('a late reread answer from before signing out is not put on the new visit (0.4.95 carbon D3)', async t => {
  const oldSnap = { ...EMPTY_SNAP(), seq: 9, rows: [{ id: 'late', service: 'claude', source: 'auto', label: 'Claude', kind: 'weekly', state: 'ok', live: { readAt: Date.now(), weekly: { usedPercent: 5, resetsAt: Date.now() + 864e5 } } }], check: { at: Date.now() } };
  let releaseCheck;
  const m = mainSubscriptions(EMPTY_SNAP());
  const check = m.subscriptions.check;
  m.subscriptions.check = () => new Promise(resolve => { releaseCheck = () => resolve(oldSnap); });
  const h = harness(t, { options: { subscriptions: m.subscriptions } });
  await settle();
  both(h, m, signedIn(ACCOUNT, 1));
  await settle(30);
  h.face.handle('reread');
  await settle();
  both(h, m, { status: 'signed-out', generation: 2 });
  await settle();
  m.subscriptions.check = check;
  both(h, m, signedIn(ACCOUNT, 3));
  await settle(30);
  assert.equal(h.view.last().room.solio.say, NONE_SAY);
  releaseCheck();
  await settle(30);
  assert.equal(h.view.last().room.solio.say, NONE_SAY, 'the answer of the visit before is dropped');
  assert.ok(!h.view.last().room.solio.rows?.some?.(r => r.name === 'Claude'), 'no row from the late answer');
});

test('host sentences ending in 「해요」 or 「달라요」 also take the 「-습니다」 voice (0.4.95 Fable F3)', () => {
  assert.equal(faceSentence('회사 작업 공간에 들어가려면 추가 로그인이 필요해요.'), '회사 작업 공간에 들어가려면 추가 로그인이 필요합니다.');
  assert.equal(faceSentence('열린 작업 공간의 계정과 현재 로그인한 계정이 달라요. 계정을 맞춘 뒤 다시 확인해 주세요.'), '열린 작업 공간의 계정과 현재 로그인한 계정이 다릅니다. 계정을 맞춘 뒤 다시 확인해 주세요.');
  assert.equal(faceSentence('지금은 확인 못해요.'), '지금은 확인 못합니다.');
  assert.equal(faceSentence('다시 시도해 주세요.'), '다시 시도해 주세요.');
});

/* ── 솔리오 「방문자 분석」 오브제와 방(사이트방문 설계 6절, 맡긴 세션 11-18) ── */
const VISIT_SUMMARY = () => ({
  판: 1, 만든때: new Date(Date.now() - 3600e3).toISOString(), 기간날수: 7, 세는쪽: ['/', '/lab/'], 안세는쪽: ['/a/'],
  방문: { 상태: '측정 전', 까닭: '아직 공개 전입니다.' }, 쪽: { 상태: '측정 전', 까닭: '아직 공개 전입니다.' }, 행동: { 상태: '측정 전', 까닭: '아직 공개 전입니다.' },
  검색: { 구글: { 상태: '권한 기다림', 까닭: '읽을 권한을 기다리고 있습니다.' }, 네이버: { 상태: '등록 전', 까닭: '아직 등록하지 않았습니다.' } },
  AI: { 상태: '측정 전', 까닭: '아직 묻지 않았습니다.' },
});
const visible = () => ({ ok: true, available: true, summary: VISIT_SUMMARY() });
function visitsFake(answer, onAsk = () => {}) {
  const asked = [];
  return { asked, api: { snapshot: async () => { asked.push(1); onAsk(); return typeof answer === 'function' ? answer(asked.length) : answer; } } };
}
const programKeys = h => (h.view.last().room?.programs || []).map(p => p.key);

test('a viewer account gets two objects beside the orb, 구독 and 방문자 분석, read once on the way into Solio and never flickering', async t => {
  let h = null, askedAt = -1;
  const viewer = visitsFake(visible(), () => { if (askedAt < 0) askedAt = h.view.log.length; });
  h = harness(t, { options: { siteVisits: viewer.api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(viewer.asked.length, 1, 'read once when Solio opens (the main process notes a waiting account at this read)');
  const arriveAt = h.view.log.findIndex(e => e[0] === 'arrive');
  assert.ok(askedAt >= 0 && askedAt <= arriveAt, 'asked on the way in, before the small orb lands, so the objects are there when the room shows');
  assert.deepEqual(programKeys(h), ['subs', 'visits']);
  assert.deepEqual(h.view.last().room.programs.map(p => p.label), ['구독', '방문자 분석']);
  assert.equal(h.view.last().room.prog, 'subs');
  assert.equal(h.view.last().room.visits.visible, true);
  assert.equal(h.view.last().room.visits.rows.length, 5);
  const counts = h.view.scenes.map(s => s.room?.programs?.length ?? 0);
  assert.ok(counts.every((n, i) => i === 0 || n >= counts[i - 1]), 'the objects appear once and do not come and go: ' + counts.join(','));
});

test('an account that is not a viewer, an app without the reader, and a guest keep Solio as it was, with no objects', async t => {
  const other = visitsFake({ ok: true, available: false });
  const o = harness(t, { options: { siteVisits: other.api } });
  await settle();
  o.face.setState(signedIn());
  await settle(20);
  assert.equal(other.asked.length, 1, 'a non-viewer still asks once, so the main process can note who opened Solio');
  assert.deepEqual(programKeys(o), []);
  assert.equal(o.view.last().room.prog, 'subs');
  assert.equal(o.face.handle('prog', 'visits'), false, 'a program that is not there never opens');
  assert.equal(o.face.handle('prog', 'subs'), false);

  const none = harness(t);
  await settle();
  none.face.setState(signedIn());
  await settle(20);
  assert.deepEqual(programKeys(none), [], 'an app without the reader has no objects');

  const viewer = visitsFake(visible());
  const g = harness(t, {
    initial: { status: 'signed-out' },
    options: { siteVisits: viewer.api, allowGuestEntry: () => true, onBrowse: () => ({ ok: true, action: 'purpose' }), onSelectPurpose: () => ({ ok: true }) },
  });
  await settle();
  g.face.handle('qa-guest');
  await settle(20);
  assert.equal(g.face.getState().phase, 'entered');
  assert.equal(g.view.last().room.space, 'solio');
  assert.deepEqual(programKeys(g), []);
  assert.equal(g.view.last().room.visits.visible, false);
  assert.equal(viewer.asked.length, 0, 'a guest never asks');
});

test('opening 방문자 분석 reads again, 구독 brings the subscriptions back, and signing out starts the next visit on 구독', async t => {
  const viewer = visitsFake(visible());
  const h = harness(t, { options: { siteVisits: viewer.api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(viewer.asked.length, 1);
  assert.equal(h.face.handle('prog', 'visits'), true);
  await settle(10);
  assert.equal(h.view.last().room.prog, 'visits');
  assert.equal(viewer.asked.length, 2, 'the summary is read again when the room opens (it changes once a day, there is no change notice)');
  assert.equal(h.face.handle('prog', 'subs'), true);
  assert.equal(h.view.last().room.prog, 'subs');
  h.face.handle('prog', 'visits');
  await settle(10);
  h.face.setState({ status: 'signed-out', accountKey: null, generation: 2 });
  await settle(30);
  assert.equal(h.face.handle('prog', 'visits'), false, 'nothing opens from the ask scene');
  h.face.setState(signedIn(ACCOUNT, 3));
  await settle(30);
  assert.equal(h.view.last().room.prog, 'subs', 'a new visit starts on 구독');
});

test('when the account changes with 방문자 분석 open, the objects go, the room is 구독 again, and a late answer is dropped', async t => {
  let release = null;
  const answers = new Map([[ACCOUNT, visible()], [OTHER, { ok: true, available: false }]]);
  let current = ACCOUNT;
  const asked = [];
  const api = { snapshot: () => { const who = current; asked.push(who); if (who === ACCOUNT && asked.length > 1) return new Promise(r => { release = () => r(answers.get(ACCOUNT)); }); return Promise.resolve(answers.get(who)); } };
  const h = harness(t, { options: { siteVisits: api } });
  await settle();
  h.face.setState(signedIn(ACCOUNT, 1));
  await settle(20);
  assert.equal(h.view.last().room.visits.visible, true);
  // 방문자 분석을 연 채 다시 읽는 동안 다른 계정이 들어온다. 늦게 온 앞 계정의 답은 버린다
  assert.equal(h.face.handle('prog', 'visits'), true);
  await settle(4);
  assert.equal(h.view.last().room.prog, 'visits');
  current = OTHER;
  const before = h.view.scenes.length;
  h.face.setState(signedIn(OTHER, 2));
  await settle(40);
  release?.();
  await settle(20);
  const room = h.view.last().room;
  assert.ok(room, 'the other account entered Solio');
  assert.equal(h.face.getState().accountKey, OTHER);
  assert.equal(room.visits.visible, false, 'the previous account answer is dropped');
  assert.deepEqual(programKeys(h), []);
  assert.equal(room.prog, 'subs');
  assert.ok(asked.includes(OTHER), 'the new account asks for itself');
  assert.ok(!h.view.scenes.slice(before).some(s => s.room?.visits?.visible), 'no scene after the change shows the previous answer');
});

test('a refusal during a token refresh keeps the answer the same account already has', async t => {
  let n = 0;
  const api = { snapshot: async () => (++n === 1 ? visible() : { ok: false, code: 'SIGN_IN_REQUIRED' }) };
  const h = harness(t, { options: { siteVisits: api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  h.face.handle('prog', 'visits');
  await settle(10);
  assert.equal(n, 2);
  assert.equal(h.view.last().room.visits.visible, true);
  assert.deepEqual(programKeys(h), ['subs', 'visits']);
  assert.equal(h.view.last().room.prog, 'visits');
});

test('the view writes summary words only as text and waits for the object names before opening a program', async () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  const start = src.indexOf('/* ── 방문자 분석의 방');
  const end = src.indexOf('function setUnavailable(');
  assert.ok(start > 0 && end > start, 'the visits room code is where this test reads it');
  const room = src.slice(start, end);
  assert.doesNotMatch(room, /innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser/, 'summary words never become markup');
  assert.match(room, /n\.textContent = String\(text\)/);
  assert.equal(src.split('innerHTML').length - 1, 2, 'only the fixed markup and dispose touch innerHTML');
  // 백업 오브제는 그 방과 함께 선다(11-20 백업·복구 탭 세션). 방의 할 일 단추도 글자로만 만든다
  assert.match(src, /data-orb-prog="backup"/, 'the backup object stands after subscriptions');
  assert.match(src, /data-room="solio-backup"/, 'with its room');
  assert.match(src, /const b = button\(a\.primary \? 'reread lead' : 'reread', a\.label,/, 'backup buttons are built with textContent');
  const { railSettleMs } = await import('../renderer/orb-face-view.mjs');
  assert.equal(railSettleMs(3), 620, 'three names: the sketch value');
  assert.equal(railSettleMs(2), 550, 'two names: 0.46 s plus one 70 ms step, with the same margin');
  assert.match(src, /Math\.max\(NEAR\.prog, railSince \+ settle - clock\(\)\)/);
  assert.match(src, /if \(!o \|\| event\.pointerType !== 'mouse'/, 'resting opens a program only for a mouse');
  const css = fs.readFileSync(new URL('../renderer/orb-face.css', import.meta.url), 'utf8');
  assert.match(css, /#portal-entry \.room-top\{[^}]*padding-bottom:34px;[^}]*mask-image:linear-gradient\(#000 calc\(100% - 30px\),transparent\)/, 'the last row stays above the bottom fade');
  assert.match(src, /<div class="room room-top" data-room="solio">/);
  assert.match(src, /<div class="room room-top" data-room="solio-visits" hidden>/);
  assert.match(css, /#portal-entry \.room\{position:absolute;[^}]*top:52%;transform:translateY\(-50%\)/, 'a Workspace or PULSE room keeps its centred place');
  // 2단계 첫 조각부터는 오브제 줄이 없는 계정의 솔리오 방도 위에서부터 놓는다. 줄을 펼쳐도 손 밑의 줄이 위로 밀리지 않는다(설계 검토 1차 ④)
  assert.doesNotMatch(css, /data-rail="1"\] \.room/, 'every account gets the Solio room placed from the top');
  assert.match(css, /#portal-entry \.more-in \.row,#portal-entry \.more-in \.row:last-child\{border:0;padding:8px 0;min-height:0\}/, 'opened inner lines drop the old launcher minimum height (.rows .row min-height:60px), so they sit 36 to 40 px apart as in the sketch');
  assert.match(css, /\.room-top\.scrolled\{-webkit-mask-image:linear-gradient\(transparent,#000 30px,#000 calc\(100% - 30px\),transparent\)/, 'a scrolled room fades its top edge too');
  assert.match(src, /r\.classList\.toggle\('scrolled', r\.scrollTop > 0\)/);
  assert.match(src, /if \(r\.classList\.contains\('scrolled'\) && !\(r\.scrollTop > 0\)\) r\.classList\.remove\('scrolled'\)/, 'a room shown again after being hidden drops a stale top fade (0.4.97 carbon A3)');
});

test('a first read refused during a refresh is read again once the account is signed in, and the objects appear then', async t => {
  let n = 0, refusing = true;
  const api = { snapshot: async () => (++n, refusing ? { ok: false, code: 'SIGN_IN_REQUIRED' } : visible()) };
  const h = harness(t, { options: { siteVisits: api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  const refused = n;
  assert.ok(refused >= 1 && refused <= 3, 'asked on the way in and, refused, once more on landing (and once by itself): ' + refused);
  refusing = false;
  assert.deepEqual(programKeys(h), [], 'no objects while the main process refuses');
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(n, refused + 1, 'the next signed-in notice reads once more');
  assert.deepEqual(programKeys(h), ['subs', 'visits']);
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(n, refused + 1, 'a read that was answered is not repeated on every notice');
});

test('a reread that ends in an exception keeps the answer already shown, so the objects do not go away (0.4.97 carbon A1)', async t => {
  let n = 0;
  const api = { snapshot: async () => { if (++n === 1) return visible(); throw new Error('ipc closed'); } };
  const h = harness(t, { options: { siteVisits: api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(h.face.handle('prog', 'visits'), true);
  await settle(10);
  assert.equal(n, 2);
  assert.deepEqual(programKeys(h), ['subs', 'visits']);
  assert.equal(h.view.last().room.visits.visible, true);
  assert.equal(h.view.last().room.prog, 'visits');
});

test('a first read that ends in an exception is not counted as read: it is tried once more by itself and again on the next notice (0.4.97 Fable F3)', async t => {
  let n = 0, failing = true;
  const api = { snapshot: async () => { n += 1; if (failing) throw new Error('ipc closed'); return visible(); } };
  const h = harness(t, { options: { siteVisits: api } });
  await settle();
  h.face.setState(signedIn());
  await settle(40);
  const tried = n;
  assert.ok(tried >= 2, 'read once more by itself after the exception: ' + tried);
  assert.deepEqual(programKeys(h), [], 'no objects while every read fails');
  await settle(40);
  assert.equal(n, tried, 'the read by itself happens once, not in a loop');
  failing = false;
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(n, tried + 1, 'the next signed-in notice reads again');
  assert.deepEqual(programKeys(h), ['subs', 'visits']);
});

test('a first read refused while the main process was still refreshing is read once more by itself when no later notice comes (0.4.97 carbon A2)', async t => {
  // 첫 읽기의 답이 오기 전에 솔리오에 내려앉는다(그때의 읽기 요청은 읽는 중이라 막힌다). 그 뒤 첫 읽기가 거절로 돌아오고, 더 오는 알림은 없다
  let n = 0, release = null;
  const api = { snapshot: () => { n += 1; if (n === 1) return new Promise(r => { release = () => r({ ok: false, code: 'SIGN_IN_REQUIRED' }); }); return Promise.resolve(visible()); } };
  const h = harness(t, { options: { siteVisits: api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(n, 1, 'the landing read was held back by the read in flight');
  release();
  await settle(40);
  assert.ok(n >= 2, 'read again after the refusal: ' + n);
  assert.deepEqual(programKeys(h), ['subs', 'visits']);
  const shown = h.view.scenes.map(s => s.room?.programs?.length ?? 0);
  assert.ok(shown.every((c, i) => i === 0 || c >= shown[i - 1]), 'the objects appear once: ' + shown.join(','));
});

/* ── 솔리오 「계정 건강」 오브제와 방(계정건강 PC앱_구현설계 10절 · 11절) ── */
const HEALTH_SUMMARY = () => ({
  판: 1, 만든때: new Date(Date.now() - 3600e3).toISOString(), 숫자: { 게시: new Date(Date.now() - 2 * 3600e3).toISOString(), 팔로워: '2026-11-19' },
  방: {
    say: '진단한 계정 둘 가운데 하나가 건강합니다.', then: '하나는 건강하지 않습니다.', scope: '진단 2 · 아직 이른 계정 1',
    rows: [
      { key: 'a-instagram', nm: '인스타그램 @a', mid: '보고 지나가는 계정', val: '건강하지 않음', when: '팔로워 0 · 한 편 133번', now: 1, unread: 0, more: [
        ['say', '한 편의 조회는 133번쯤입니다.'], ['good', '잘하고 있는 것', '꾸준히 올립니다.'], ['head', '조회 1,000번이 가는 길'],
        ['flow', [{ 이름: '첫 장면', 명: 348.5, 큰: null, 글: '349명이 3초 넘게 봅니다', 판정: '보통', 샘: false }, { 이름: '반응', 명: 1.46, 큰: null, 글: '1.5명이 반응합니다', 판정: '나쁨', 샘: true }], '반응에서 가장 많이 샙니다.'],
        ['text', '잘된 편은 첫 장면에서 다릅니다.'], ['row', '본 사람이 반응하는가', '평균의 23%입니다.', '나쁨', '평균의 23%', 1], ['row', '꾸준히 올리는가', '지난 14일 동안 9편입니다.', '좋음', '2주에 9편', 0],
        ['do', '할 일 1', '보낼 까닭을 넣습니다.'], ['do', '할 일 2', '끝 장면에서 다음 편을 예고합니다.'], ['goal', '다음 목표', '조회 1,000번마다 공유 2.4번입니다.'], ['note', '재지 못한 것은 없습니다.'],
      ] },
      { key: 'b-tiktok', nm: '틱톡 @b', mid: '고른 계정', val: '건강함', when: '팔로워 177 · 한 편 917번', now: 0, unread: 0, more: [['say', '고르게 붙잡습니다.']] },
    ],
  },
});
const healthy = () => ({ ok: true, available: true, summary: HEALTH_SUMMARY() });
const unseen = () => ({ ok: true, available: false });
const readFake = answer => {
  const asked = [];
  return { asked, api: { snapshot: async () => { asked.push(1); return typeof answer === 'function' ? answer(asked.length) : answer; } } };
};

test('계정 건강 stands after 방문자 분석, and each read program stands only when it is visible (both, one of two, none)', async t => {
  const cases = [
    [visible(), healthy(), ['subs', 'visits', 'health'], ['구독', '방문자 분석', '계정 건강']],
    [visible(), unseen(), ['subs', 'visits'], ['구독', '방문자 분석']],
    [unseen(), healthy(), ['subs', 'health'], ['구독', '계정 건강']],
    [unseen(), unseen(), [], []],
  ];
  for (const [v, hv, keys, labels] of cases) {
    const visits = readFake(v), health = readFake(hv);
    const h = harness(t, { options: { siteVisits: visits.api, snsHealth: health.api } });
    await settle();
    h.face.setState(signedIn());
    await settle(20);
    assert.deepEqual(programKeys(h), keys);
    assert.deepEqual((h.view.last().room.programs || []).map(p => p.label), labels);
    assert.equal(h.view.last().room.prog, 'subs');
    assert.equal(h.view.last().room.health.visible, hv.available === true);
    // 방문자 분석을 묻는 호출은 계정 건강이 보이든 말든 솔리오를 열 때 한 번이다(계정건강 설계 7절의 전제: 그때 볼 계정 대기 줄이 남는다)
    assert.equal(visits.asked.length, 1, 'the 방문자 분석 read stays on the way into Solio');
    assert.equal(health.asked.length, 1, 'the 계정 건강 summary is read once on the way into Solio');
    assert.equal(h.face.handle('prog', 'health'), keys.includes('health'), 'only a program that is there opens');
  }
});

test('opening 계정 건강 reads it again and only it, shows its lines, and 구독 brings the subscriptions back', async t => {
  const visits = readFake(visible()), health = readFake(healthy());
  const h = harness(t, { options: { siteVisits: visits.api, snsHealth: health.api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(h.face.handle('prog', 'health'), true);
  await settle(10);
  const room = h.view.last().room;
  assert.equal(room.prog, 'health');
  assert.equal(health.asked.length, 2, 'the summary is read again when the room opens');
  assert.equal(visits.asked.length, 1, 'opening 계정 건강 does not read 방문자 분석');
  assert.equal(room.health.say, '진단한 계정 둘 가운데 하나가 건강합니다.');
  assert.equal(room.health.scope, '진단 2 · 아직 이른 계정 1');
  assert.match(room.health.when, /^게시 숫자는 .+, 팔로워는 11월 19일에 잰 값입니다\./);
  assert.deepEqual(room.health.rows.map(r => r.key), ['a-instagram', 'b-tiktok']);
  const more = room.health.rows[0].more;
  assert.deepEqual(more.map(m => m[0]), ['say', 'good', 'head', 'flow', 'text', 'row', 'row', 'do', 'do', 'goal', 'note']);
  assert.deepEqual(more[3][1].map(s => [s.name, s.big, s.leak]), [['조회', '1,000', false], ['첫 장면', '349', false], ['반응', '1.5', true]]);
  assert.deepEqual(more.filter(m => m[0] === 'row').map(m => m[5]), [1, 0], 'the summary marks the bad signal');
  assert.equal(h.face.handle('prog', 'subs'), true);
  assert.equal(h.view.last().room.prog, 'subs');
  assert.equal(h.face.handle('prog', 'visits'), true);
  await settle(10);
  assert.equal(health.asked.length, 2, 'opening 방문자 분석 does not read 계정 건강');
});

test('when the account changes with 계정 건강 open, its object goes, the room is 구독 again, and a late answer is dropped', async t => {
  let release = null, current = ACCOUNT;
  const asked = [];
  const api = { snapshot: () => { const who = current; asked.push(who); if (who === ACCOUNT && asked.length > 1) return new Promise(r => { release = () => r(healthy()); }); return Promise.resolve(who === ACCOUNT ? healthy() : unseen()); } };
  const h = harness(t, { options: { snsHealth: api } });
  await settle();
  h.face.setState(signedIn(ACCOUNT, 1));
  await settle(20);
  assert.deepEqual(programKeys(h), ['subs', 'health'], 'an app whose 방문자 분석 is not shown still gets 계정 건강');
  assert.equal(h.face.handle('prog', 'health'), true);
  await settle(4);
  assert.equal(h.view.last().room.prog, 'health');
  current = OTHER;
  const before = h.view.scenes.length;
  h.face.setState(signedIn(OTHER, 2));
  await settle(40);
  release?.();
  await settle(20);
  const room = h.view.last().room;
  assert.equal(h.face.getState().accountKey, OTHER);
  assert.equal(room.health.visible, false, 'the previous account answer is dropped');
  assert.deepEqual(programKeys(h), []);
  assert.equal(room.prog, 'subs');
  assert.ok(asked.includes(OTHER), 'the new account asks for itself');
  assert.ok(!h.view.scenes.slice(before).some(s => s.room?.health?.visible), 'no scene after the change shows the previous answer');
});

test('a refusal during a refresh or a read that throws keeps the 계정 건강 answer already shown', async t => {
  let n = 0;
  const api = { snapshot: async () => { n += 1; if (n === 1) return healthy(); if (n === 2) return { ok: false, code: 'SIGN_IN_REQUIRED' }; throw new Error('ipc closed'); } };
  const h = harness(t, { options: { snsHealth: api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  h.face.handle('prog', 'health');
  await settle(10);
  h.face.handle('prog', 'subs');
  h.face.handle('prog', 'health');
  await settle(10);
  assert.equal(n, 3);
  assert.deepEqual(programKeys(h), ['subs', 'health']);
  assert.equal(h.view.last().room.health.visible, true);
  assert.equal(h.view.last().room.prog, 'health');
});

test('a first 계정 건강 read refused during a refresh is read again once the account is signed in', async t => {
  let n = 0, refusing = true;
  const api = { snapshot: async () => (++n, refusing ? { ok: false, code: 'SIGN_IN_REQUIRED' } : healthy()) };
  const h = harness(t, { options: { snsHealth: api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  const refused = n;
  assert.ok(refused >= 1 && refused <= 3, 'asked on the way in and, refused, once more by itself: ' + refused);
  assert.deepEqual(programKeys(h), []);
  refusing = false;
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(n, refused + 1, 'the next signed-in notice reads once more');
  assert.deepEqual(programKeys(h), ['subs', 'health']);
});

test('when 계정 건강 stops being shown while it is open, Solio goes back to 구독 and 방문자 분석 stays', async t => {
  const health = readFake(k => (k <= 2 ? healthy() : unseen()));
  const visits = readFake(visible());
  const h = harness(t, { options: { siteVisits: visits.api, snsHealth: health.api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(h.face.handle('prog', 'health'), true);
  await settle(10);
  assert.equal(h.view.last().room.prog, 'health');
  h.face.handle('prog', 'subs');
  assert.equal(h.face.handle('prog', 'health'), true);
  await settle(10);
  assert.equal(health.asked.length, 3);
  assert.deepEqual(programKeys(h), ['subs', 'visits']);
  assert.equal(h.view.last().room.prog, 'subs');
  assert.equal(h.view.last().room.health.visible, false);
});

test('a summary that could not be read still opens 계정 건강 and says why, and a guest never gets or asks for it', async t => {
  // 손님으로 들어온 솔리오에는 계정 건강이 없고, 본체에 묻지도 않는다(카본 A)
  const guestHealth = readFake(healthy());
  const g = harness(t, {
    initial: { status: 'signed-out' },
    options: { snsHealth: guestHealth.api, allowGuestEntry: () => true, onBrowse: () => ({ ok: true, action: 'purpose' }), onSelectPurpose: () => ({ ok: true }) },
  });
  await settle();
  g.face.handle('qa-guest');
  await settle(20);
  assert.equal(g.face.getState().phase, 'entered');
  assert.equal(g.view.last().room.space, 'solio');
  assert.deepEqual(programKeys(g), []);
  assert.equal(g.view.last().room.health.visible, false);
  assert.equal(g.face.handle('prog', 'health'), false);
  assert.equal(guestHealth.asked.length, 0, 'a guest never asks');

  const health = readFake({ ok: false, available: true, code: 'VERSION', version: 2, supported: 1 });
  const h = harness(t, { options: { snsHealth: health.api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.deepEqual(programKeys(h), ['subs', 'health']);
  h.face.handle('prog', 'health');
  await settle(10);
  const room = h.view.last().room.health;
  assert.equal(room.say, '진단을 읽지 못했습니다.');
  assert.equal(room.then, '진단 도구가 새 꼴로 썼습니다. 앱을 업데이트하면 보입니다.');
  assert.deepEqual(room.rows, []);
});

test('the 계정 건강 room is drawn as text only, with its own row box, the six new line kinds, and the object names timed by how many are shown', async () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(src, /<div class="room room-top" data-room="solio-health" hidden>/);
  assert.match(src, /<div class="rows vis hea rise" style="--i:3" role="group" aria-label="SNS 계정 건강" data-hea-rows><\/div>/);
  assert.match(src, /data-orb-prog="health"/);
  const start = src.indexOf('/* ── 방문자 분석의 방');
  const end = src.indexOf('function setUnavailable(');
  const room = src.slice(start, end);
  for (const kind of ['head', 'text', 'flow']) assert.match(room, new RegExp(`kind === '${kind}'`), kind);
  assert.match(room, /kind === 'good' \|\| kind === 'goal' \|\| kind === 'do'/);
  assert.match(room, /el\('div', mark \? 'row sub now' : 'row sub'\)/, 'a marked signal line is bright');
  assert.match(room, /kind === 'do' && firstDo \? ' first' : ''/, 'the first to-do has a line above it');
  assert.match(room, /cell\.setAttribute\('role', 'listitem'\)/);
  assert.doesNotMatch(room, /innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser/, 'summary words never become markup');
  assert.match(src, /for \(const box of readBoxes\) \{\s+box\.addEventListener\('pointerover', onVisOver\);/, 'the 계정 건강 rows open and close like the 방문자 분석 rows');
  assert.match(src, /const onVisLeave = event => \{ const box = event\?\.currentTarget \|\| app\.visRows;/, 'leaving a box folds that box only');
  assert.match(src, /for \(const c of box \? \[box\] : \[\.\.\.readBoxes, app\.rows, \.\.\.asideBoxes\]\)/);
  // 오브제가 넷이면 690ms. 펼치는 늦춤(--k)은 보이는 차례라 가운데 오브제가 빠져도 railSettleMs와 맞는다
  const { railSettleMs } = await import('../renderer/orb-face-view.mjs');
  assert.equal(railSettleMs(4), 690);
  assert.match(src, /const at = String\(k\+\+\);\s+if \(o\.style\.getPropertyValue\('--k'\) !== at\) o\.style\.setProperty\('--k', at\);/);
  const css = fs.readFileSync(new URL('../renderer/orb-face.css', import.meta.url), 'utf8');
  assert.match(css, /#portal-entry \.rows\.hea\{grid-template-columns:minmax\(150px,240px\) minmax\(0,1fr\) max-content minmax\(150px,max-content\)\}/, 'the status column keeps its words on one line');
  for (const sel of ['.more-head', '.more-text', '.flow', '.step', '.step.leak', '.more-in .row.do.first']) assert.ok(css.includes('#portal-entry ' + sel + '{') || css.includes('#portal-entry ' + sel + ','), sel);
  const narrow = css.slice(css.indexOf('@media (max-width:640px){'));
  assert.match(narrow, /#portal-entry \.row\.good \.mid,#portal-entry \.row\.goal \.mid,#portal-entry \.row\.do \.mid\{grid-column:1 \/ -1;grid-row:2\}/, 'a narrow window puts the words under the name');
  // 641~1000px에서는 펼친 줄의 풀어 쓴 글이 이름 아래 온 폭으로 내려온다(Fable F1)
  assert.match(css, /@media \(min-width:641px\) and \(max-width:1000px\)\{\s+#portal-entry \.rows\.hea \.more-in \.row\.sub\{row-gap:4px\}/);
  assert.match(css, /#portal-entry \.rows\.hea \.more-in \.row\.sub > \.mid\{grid-column:1 \/ -1;grid-row:2;max-width:52em\}/);
  // 길의 단계를 둘씩 놓는 규칙은 900px 아래 전체이고, 무게가 같은 단계 규칙 뒤에 있어야 이긴다(카본 A1)
  const twoByTwo = css.search(/@media \(max-width:900px\)\{\s+#portal-entry \.step\{flex-basis:50%;/);
  assert.ok(twoByTwo > css.indexOf('#portal-entry .step + .step{') && twoByTwo > css.indexOf('#portal-entry .step{flex:1 1 0;'), 'the two-by-two step rule comes after the base step rules');
});

/* ── 2단계 첫 조각 · 구 곁의 펼침(2단계_첫조각_구현설계.md 1.3절) ── */
test('after entering, the orb opens a fan beside it instead of the centred chooser; pressing pins it and pressing again closes it', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  assert.equal(h.view.last().fan.open, false);
  assert.equal(h.view.last().switch, null, 'the centred chooser is only for the entry step');
  h.face.handle('open-switch');
  await settle();
  const s = h.view.last();
  assert.deepEqual([s.layer, s.fan.open, s.fan.pin], ['app', true, true], 'the room stays, only dimmed');
  assert.ok(h.view.log.some(e => e[0] === 'move' && e[1] === 'fan'), 'the orb grows into the fan pose');
  h.face.handle('open-switch');
  await settle();
  assert.equal(h.view.last().fan.open, false);
  assert.ok(h.view.log.filter(e => e[0] === 'move').at(-1)[1] === 'home');
});

test('resting near the orb opens an unpinned fan that leaving closes; a pinned fan ignores leaving', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('fan-near');
  await settle();
  assert.deepEqual([h.view.last().fan.open, h.view.last().fan.pin], [true, false]);
  h.face.handle('fan-leave');
  await settle();
  assert.equal(h.view.last().fan.open, false);
  h.face.handle('fan-near');
  await settle();
  h.face.handle('open-switch');
  await settle();
  assert.deepEqual([h.view.last().fan.open, h.view.last().fan.pin], [true, true], 'pressing a fan opened by resting pins it');
  h.face.handle('fan-leave');
  await settle();
  assert.equal(h.view.last().fan.open, true, 'a pinned fan stays when the hand leaves');
});

test('Esc closes the fan and leaves focus on the orb; resting and closing do not move focus', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('fan-near');
  await settle();
  const before = h.view.last().focusSeq;
  h.face.handle('fan-leave');
  await settle();
  assert.equal(h.view.last().focusSeq, before, 'closing by leaving keeps focus where it is');
  h.face.handle('open-switch');
  await settle();
  assert.ok(h.face.handle('escape'));
  await settle();
  assert.deepEqual([h.view.last().fan.open, h.view.last().focus], [false, 'here']);
});

test('with an old screen open, the orb closes it quietly and opens the fan pinned', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  // 계정 어댑터가 없는 호스트의 「계정」은 옛 내 계정 화면을 연다(남은 옛 화면 하나)
  h.face.handle('foot', 'account');
  await settle();
  assert.equal(h.face.clientMode(), 'legacy');
  h.face.handle('open-switch');
  await settle();
  assert.equal(h.face.clientMode(), 'app');
  assert.deepEqual([h.view.last().fan.open, h.view.last().fan.pin], [true, true]);
});

test('「설정」 opens the settings room and never the old screen, 「계정」 falls back to it only without the account bridge, and the launcher keeps only the account branch (설계 9.2)', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('foot', 'account');
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'openLegacy').at(-1).slice(0, 2), ['openLegacy', 'account'], 'a host without faceOptions.rooms keeps the old screen');
  assert.ok(h.face.handle('escape'));
  const before = h.calls.filter(c => c[0] === 'openLegacy').length;
  h.face.handle('foot', 'settings');
  assert.deepEqual([h.view.last().aside, h.view.last().focus, h.face.clientMode()], ['settings', 'aside', 'app'], 'even a host without the settings bridge opens the room');
  assert.equal(h.calls.filter(c => c[0] === 'openLegacy').length, before, 'the old settings screen is not opened');
  assert.equal(h.view.last().rooms.settings.say, '여기서는 새 판을 받을 수 없습니다.');
  const launcher = fs.readFileSync(new URL('../renderer/launcher.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(launcher, /data-subs="manage"|orbManageTimer/, 'the old 25-try click loop is gone');
  assert.doesNotMatch(launcher, /kind==='subscriptions'|kind==='settings'/);
  assert.match(launcher, /function openOrbLegacy\(kind\)\{if\(kind==='account'\)showView\('account'\);\}/, 'the village record still uses the old account screen, and nothing else does');
  // PC 0.5.0: 옛 보기는 내 계정 하나만 남았다. 다른 이름은 내 계정을 닫을 뿐이다(PC 0.5.0 설계 4.2-2)
  assert.match(launcher, /function showView\(next\)\{\r?\n  if\(next!=='account'\)\{hideAccount\(\);return;\}/, 'the old account screen cannot lead to any other old view');
});

test('the view opens the fan only on Enter, Space or the down arrow, never on focus alone (설계 검토 1차 1)', () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(!scene\.fan\?\.open && onOrb && event\.key === 'ArrowDown'\) \{ event\.preventDefault\(\); onAction\('open-switch'\); return; \}/);
  assert.doesNotMatch(src, /here-orb[^\n]*focusin|orbBtn\.addEventListener\('focus/, 'no focus listener on the orb opens the fan');
  assert.match(src, /root\.addEventListener\('pointermove', onRootMove/, 'resting is measured on the root that also covers the drag band (1차 3가)');
  assert.match(src, /const ox = hp\.x - HOME_R, oy = hp\.y - HOME_R/, 'the fan is placed from the real small orb, not the sketch 16 (1차 ①)');
  assert.match(src, /clearTimeout\(progTimer\); clearTimeout\(subTimer\); clearTimeout\(visTimer\);/, 'opening clears the resting timers (1차 4)');
  assert.match(src, /restoringVis = true; try \{ again\.focus/, 'a redraw that restores focus does not reopen a row');
});

test('while the fan is open the hidden name, the object row and the dimmed rooms leave the Tab order; hidden rooms do not take Esc (카본 A1 · A6)', () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(src, /const back = \[app\.nameBtn, app\.rail, app\.solio, app\.backup, app\.visits, app\.health, app\.office, app\.space, \.\.\.Object\.values\(app\.asides\)\.map\(a => a\.room\)\]\.filter\(Boolean\);/, 'the rooms opened from the fan leave the Tab order too, the office room among them (공간 지도 검수 c FA1)');
  assert.match(src, /if \(open\) \{ const a = doc\.activeElement; if \(a && back\.some\(x => x\.contains\(a\)\)\) \{ fanReturn = f\.pin \? null : a; app\.orbBtn\.focus/, 'focus inside them moves to the visible orb before they turn inert');
  assert.match(src, /for \(const x of back\) if \(x\.inert !== open\) x\.inert = open;/);
  assert.match(src, /\[\.\.\.root\.querySelectorAll\('\.more\.open'\)\]\.some\(m => !m\.closest\('\[hidden\]'\)\)/, 'a pinned row left in a hidden room does not swallow Esc');
});

test('공간 지도 검수 c FA2: with reduced motion, opening a department row redraws the floor — the watcher sees the row buttons, not only the list', () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(src, /offObserver\?\.observe\(app\.offRows, \{ attributes: true, attributeFilter: \['class'\], subtree: true \}\);/);
  assert.match(src, /records\.some\(r => r\.target\?\.parentElement === app\.offRows && r\.target\.matches\?\.\('button\.row'\)\)\) officeFloor\.redraw\(\);/, 'only a row button changing its class redraws');
});

test('a redraw keeps focus on 「계정 관리」 inside an open row instead of dropping it to the page (카본 A4)', () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(src, /keepAct = fa && inner\.contains\(fa\) \? fa\.dataset\?\.orbAct \|\| '' : null, keepRoom = /);
  assert.match(src, /if \(keepAct !== null\) refocusIn\(b, keepAct, keepRoom\);/);
  assert.match(src, /if \(home\) refocusIn\(home, innerAt\.act, innerAt\);/);
  // 팁 반응 단추(방 동작)도 같은 단추로 되살린다(2단계 둘째 조각 화면 검수 A)
  assert.match(src, /roomAct: fa\.dataset\?\.roomAct, roomArg: fa\.dataset\?\.roomArg/);
  assert.match(src, /x\.dataset\.roomAct === at\.roomAct && \(x\.dataset\.roomArg \|\| ''\) === \(at\.roomArg \|\| ''\)/);
});

test('keeping the pressed button in view follows the open inside and the focus at measuring time (2단계 둘째 조각 화면 검수 A)', () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(src, /endAt = more\?\.classList\?\.contains\('more'\) \? more\.offsetTop \+ more\.offsetHeight/);
  assert.match(src, /const cur = doc\.activeElement, a = cur && inner\.contains\(cur\) \? cur : a0;/);
  assert.match(src, /whole = a\.closest\?\.\('\.confirm'\) \|\| a/);
});

test('a fan opened by resting returns focus when it closes, and a pause resets the approach speed (대체 검수 F5 · F6)', () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(src, /fanReturn = f\.pin \? null : a; app\.orbBtn\.focus/, 'only an unpinned (resting) fan remembers where focus was');
  assert.match(src, /if \(back0 && back0\.isConnected && doc\.activeElement === app\.orbBtn && !back0\.closest\?\.\('\[inert\],\[hidden\]'\)\)/);
  assert.match(src, /ptrPx\.v = ptrPx\.t && dt > 0 && dt < 200 \? Math\.hypot\(event\.clientX - ptrPx\.x, event\.clientY - ptrPx\.y\) \/ dt : 0;/);
});

/* ── 2단계 둘째 조각 첫 묶음: 계정 관리 방과 요금 줄(2단계_둘째조각_구현설계.md 1.3절 · 9절 · 12.1절) ── */
const roomRow = (id, service, extra = {}) => ({ id, service, source: 'auto', label: service, kind: 'weekly', state: 'ok', plan: 'pro', email: id + '@example.com', folder: true, live: { readAt: Date.now() - 60e3, weekly: { usedPercent: 20, resetsAt: Date.now() + 3 * 864e5 } }, ...extra });
function roomHarness(t, rows = [roomRow('c', 'claude', { price: 290000, currency: 'KRW', billDay: 9 }), roomRow('g', 'gpt')]) {
  let snap = { ok: true, seq: 1, rows, check: { at: Date.now() - 60e3 }, usage: { accounts: {} }, settings: {}, tools: {}, login: null };
  const saved = [];
  let push = null;
  const subscriptions = {
    snapshot: async () => snap,
    check: async () => ({ ...snap, seq: snap.seq + 1 }),
    onChanged: fn => { push = fn; return () => {}; },
    save: async patch => {
      saved.push(patch);
      snap = { ...snap, seq: snap.seq + 1, rows: patch.remove ? snap.rows.filter(r => r.id !== patch.remove) : snap.rows, settings: { ...snap.settings, ...(patch.settings || {}) } };
      return snap;
    },
  };
  const h = harness(t, { options: { subscriptions } });
  return { ...h, saved, push: value => { snap = value; push?.(value); }, snap: () => snap };
}
const removeLabel = (scene, key) => scene.rooms.manage.rows.find(r => r.key === key).more.filter(x => x[0] === 'acts').flatMap(x => x[1]).find(a => a[1] === 'remove')[0];

test('the cost line stands under the subscription rows once a subscription row exists', async t => {
  const h = roomHarness(t);
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  const solio = h.view.last().room.solio;
  assert.deepEqual(solio.extra.map(r => r.key), ['cost']);
  assert.match(solio.extra[0].mid, /^한 달 290,000원/);
  const none = roomHarness(t, []);
  await settle();
  none.face.setState(signedIn());
  await settle(30);
  assert.deepEqual(none.view.last().room.solio.extra, []);
});

test('「계정 관리」 inside a subscription row opens the room on that subscription’s first account', async t => {
  const h = roomHarness(t);
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  h.face.handle('connect', 'gpt');
  const s = h.view.last();
  assert.deepEqual([s.aside, s.focus, s.rooms.manage.opening?.key], ['manage', 'aside', 'a:g']);
  assert.equal(s.rooms.manage.say, '연결한 계정은 둘입니다.');
  assert.ok(!h.calls.some(c => c[0] === 'openLegacy'));
  h.face.handle('aside-back');
  assert.deepEqual([h.view.last().aside, h.view.last().rooms, h.view.last().focus], [null, null, 'aside-return']);
});

test('Esc closes the fan first, then the old screen, then the room (설계 9.1)', async t => {
  const h = roomHarness(t);
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  h.face.handle('subs-manage');
  h.face.handle('open-switch');
  assert.deepEqual([h.view.last().fan.open, h.view.last().aside], [true, 'manage'], 'the fan opens over the room');
  assert.ok(h.face.handle('escape'));
  assert.deepEqual([h.view.last().fan.open, h.view.last().aside], [false, 'manage'], 'Esc closes the fan and keeps the room');
  // 계정 어댑터가 없는 호스트의 「계정」은 옛 내 계정 화면을 연다. 방은 그 밑에 남는다
  h.face.handle('foot', 'account');
  assert.equal(h.face.clientMode(), 'legacy');
  assert.equal(h.view.last().aside, 'manage', 'the room is kept under the old screen');
  assert.ok(h.face.handle('escape'));
  assert.deepEqual([h.face.clientMode(), h.view.last().aside, h.view.last().focus], ['app', 'manage', 'legacy-return'], 'back in the room, focus goes where the old screen was opened');
  assert.ok(h.face.handle('escape'));
  assert.equal(h.view.last().aside, null);
  assert.equal(h.face.handle('escape'), false, 'nothing left to close');
});

test('the twice press of 「지우기」 survives a fresh scene, ignores a second press within 0.6 s, and removes on a later one', async t => {
  const h = roomHarness(t);
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  h.face.handle('subs-manage');
  h.face.handle('room', { room: 'manage', key: 'a:g', act: 'remove' });
  await settle();
  assert.equal(removeLabel(h.view.last(), 'a:g'), '한 번 더 누르면 지웁니다');
  h.push({ ...h.snap(), seq: h.snap().seq + 1 });
  await settle();
  assert.equal(removeLabel(h.view.last(), 'a:g'), '한 번 더 누르면 지웁니다', 'a fresh snapshot keeps the question');
  h.face.handle('room', { room: 'manage', key: 'a:g', act: 'remove' });
  await settle();
  assert.deepEqual(h.saved, [], 'a press inside 0.6 s is not taken');
  await new Promise(resolve => setTimeout(resolve, ROOM_TIMING.armGuard + 20));
  h.face.handle('room', { room: 'manage', key: 'a:g', act: 'remove' });
  await settle();
  assert.deepEqual(h.saved, [{ remove: 'g' }]);
  assert.ok(!h.view.last().rooms.manage.rows.some(r => r.key === 'a:g'));
  assert.equal(h.view.last().rooms.manage.foot, 'Codex g 계정 줄을 지웠습니다.');
});

test('room actions are refused while no room is open, except the cost line of the subscriptions room', async t => {
  const h = roomHarness(t);
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  assert.equal(h.face.handle('room', { room: 'manage', key: 'a:g', act: 'remove' }), false);
  assert.equal(h.face.handle('room', { room: 'solio', key: 'cost', act: 'rate-save', fields: { usdKrw: '1500' } }), true);
  await settle();
  assert.deepEqual(h.saved, [{ settings: { usdKrw: 1500 } }]);
});

test('another space, a sign-out and another account close the room and clear its state', async t => {
  const h = roomHarness(t);
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  h.face.handle('subs-manage');
  h.face.handle('go', 'solio');
  assert.deepEqual([h.view.last().aside, h.view.last().focus], [null, 'here'], 'choosing the current space in the fan comes back to its first room');
  h.face.handle('subs-manage');
  h.face.handle('room', { room: 'manage', key: 'a:g', act: 'remove' });
  await settle();
  assert.equal(removeLabel(h.view.last(), 'a:g'), '한 번 더 누르면 지웁니다');
  h.face.setState({ status: 'signed-out', generation: 2 });
  await settle();
  assert.equal(h.view.last().aside ?? null, null);
  h.face.setState(signedIn(ACCOUNT, 3));
  await settle(30);
  h.face.handle('subs-manage');
  assert.equal(removeLabel(h.view.last(), 'a:g'), '지우기', 'the question from before the sign-out is gone');
  h.face.setState(signedIn(OTHER, 4));
  await settle(30);
  assert.equal(h.view.last().aside ?? null, null, 'another account closes the room');
});

/* ── 2단계 둘째 조각 둘째 묶음: 모델별 토큰 줄과 내 계정 방(2단계_둘째조각_구현설계.md 3절 · 5절 · 8.3절 · 9절, 설계 검토 D1 · D4 · D8) ── */
const FACE_AID = ACCOUNT;
const faceView = (extra = {}) => ({ ok: true, account: { synk_user_id: FACE_AID, status: 'active', profile: { display_name: '합성 회원', locale: 'ko', time_zone: 'Asia/Seoul' }, profile_revision: 3 },
  memberships: [], learning: { enabled: false, revision: 1 }, capabilities: { learningSync: true },
  sessions: [{ id: 's-now', product: 'platform', current: true, last_seen: new Date().toISOString() }, { id: 's-phone', product: 'world', label: '휴대폰', last_seen: new Date(Date.now() - 864e5).toISOString() }], dataRequests: [], ...extra });
function accountFaceHarness(t, { rows = [roomRow('c', 'claude', { price: 290000, currency: 'KRW', billDay: 9 })], tokens = { ok: true, enabled: true, epoch: 1, seq: 1, scannedAt: Date.now() - 60e3, cells: [] }, answers = {}, leave = true, rooms: withRooms = true } = {}) {
  const snap = { ok: true, seq: 1, rows, check: { at: Date.now() - 60e3 }, usage: { accounts: {} }, settings: {}, tools: {}, login: null };
  const acalls = [];
  let bound = null, tokListen = null, tok = tokens;
  const reply = (op, params) => { acalls.push([op, params]); const a = answers[op]; return Promise.resolve(typeof a === 'function' ? a(params) : a ?? (op === 'accountView' ? faceView() : op === 'identity' ? { ok: true, email: 'member@example.com', identities: [{ provider: 'email' }] } : { ok: true })); };
  const subscriptions = {
    snapshot: async () => snap,
    check: async () => ({ ...snap, seq: snap.seq + 1 }),
    onChanged: () => () => {},
    save: async () => snap,
    tokens: async () => { acalls.push(['tokens']); return tok; },
    tokensScan: async options => { acalls.push(['tokensScan', options]); return tok; },
    tokensEnable: async on => { acalls.push(['tokensEnable', on]); tok = { ...tok, seq: tok.seq + 1, enabled: on }; return tok; },
    tokensLive: async on => { acalls.push(['tokensLive', on]); return tok; },
    onTokens: fn => { tokListen = fn; return () => { tokListen = null; }; },
  };
  const rooms = withRooms ? {
    account: { request: reply, identity: () => reply('identity'), security: section => reply('security', section), securityOpened: () => acalls.push(['securityOpened']), changed: () => acalls.push(['changed']), name: () => '로그인 이름' },
    confirmLeave: () => { acalls.push(['confirmLeave']); return Promise.resolve(leave); },
    bind: api => { bound = api; },
  } : undefined;
  const h = harness(t, { options: { subscriptions, ...(rooms ? { rooms } : {}) } });
  return { ...h, acalls, ops: () => acalls.map(c => c[0]), bound: () => bound, pushTokens: v => tokListen?.(v), room: () => h.view.last().rooms?.account };
}
async function enterAs(h) { await settle(); h.face.setState(signedIn()); await settle(30); }

test('the token line stands under the cost line, and also alone when there is no subscription (설계 3.4)', async t => {
  const h = accountFaceHarness(t);
  await enterAs(h);
  assert.deepEqual(h.view.last().room.solio.extra.map(r => r.key), ['cost', 'tok']);
  assert.equal(h.ops().filter(o => o === 'tokens').length, 1, 'read once on the way into Solio');
  const none = accountFaceHarness(t, { rows: [] });
  await enterAs(none);
  assert.deepEqual(none.view.last().room.solio.extra.map(r => r.key), ['tok'], 'no subscription still shows the token line');
  assert.equal(none.view.last().room.solio.rows.length, 0);
});

// 11-20부터 구독 방 맨 위의 「지금 출력」이 늘 보이므로, 실시간은 줄이 열렸는지와 상관없이 구독 방이 보이는 동안 부탁한다(솔리오 구독 비서 설계 3.3)
test('live counting is asked while the subscriptions room is shown, and stops under another room or a hidden window (솔리오 구독 비서 3.3)', async t => {
  const h = accountFaceHarness(t);
  await enterAs(h);
  await settle();
  assert.deepEqual(h.acalls.filter(c => c[0] === 'tokensScan' || c[0] === 'tokensLive').map(c => [c[0], c[1]]), [['tokensScan', { force: false }], ['tokensLive', true]], 'the room shown asks at once');
  const live = h.view.last().room.solio.brief?.live;
  assert.equal(live?.state, 'on', 'the 「지금 출력」 line is in the scene');
  h.face.handle('subs-manage');
  await settle();
  assert.deepEqual(h.acalls.at(-1).slice(0, 2), ['tokensLive', false], 'another room over it stops the live count');
  h.face.handle('aside-back');
  await settle();
  assert.deepEqual(h.acalls.filter(c => c[0] === 'tokensLive').at(-1).slice(0, 2), ['tokensLive', true], 'coming back asks again');
  h.view.isHidden = () => true;
  h.face.handle('hidden');
  await settle();
  assert.deepEqual(h.acalls.filter(c => c[0] === 'tokensLive').at(-1).slice(0, 2), ['tokensLive', false], 'a hidden window stops it');
  h.view.isHidden = () => false;
  h.face.handle('visible');
  await settle();
  assert.deepEqual(h.acalls.filter(c => c[0] === 'tokensLive').at(-1).slice(0, 2), ['tokensLive', true], 'a shown window asks again');
});

test('「계정」 opens 내 계정 in the face: focus on its first sentence, the account read through the bridge, the old screen untouched (설계 9.3)', async t => {
  const h = accountFaceHarness(t);
  await enterAs(h);
  h.face.handle('open-switch');
  h.face.handle('foot', 'account');
  await settle();
  const s = h.view.last();
  assert.deepEqual([s.aside, s.fan.open, s.focus], ['account', false, 'aside']);
  assert.ok(!h.calls.some(c => c[0] === 'openLegacy'));
  assert.deepEqual(h.ops().filter(o => o === 'accountView' || o === 'identity').sort(), ['accountView', 'identity']);
  assert.equal(h.room().say, '합성 회원 님으로 로그인했습니다.');
  assert.equal(h.room().foot, '문의할 때 쓰는 계정 번호 ' + FACE_AID);
  assert.ok(h.face.handle('escape'));
  assert.deepEqual([h.view.last().aside, h.view.last().focus], [null, 'aside-return']);
});

test('the town record opens the old account screen and coming back returns to 내 계정 with focus on that button (설계 검토 D4)', async t => {
  const h = accountFaceHarness(t);
  await enterAs(h);
  h.face.handle('foot', 'account');
  await settle();
  h.face.handle('room', { room: 'account', key: 'data', act: 'town' });
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'openLegacy').at(-1).slice(0, 2), ['openLegacy', 'account']);
  assert.deepEqual([h.face.clientMode(), h.view.last().aside], ['legacy', 'account']);
  h.face.handle('legacy-back');
  assert.deepEqual([h.face.clientMode(), h.view.last().aside, h.view.last().focus], ['app', 'account', 'legacy-return']);
  h.face.handle('room', { room: 'account', key: 'data', act: 'export' });
  assert.equal(h.calls.filter(c => c[0] === 'openLegacy' && c[1] === 'account').length, 2, 'the practice record download opens the same screen');
});

test('signing out everywhere asks twice in the face, then the launcher’s unsaved-writing check, then sends revokeAll (설계 검토 D1)', async t => {
  const h = accountFaceHarness(t);
  await enterAs(h);
  h.face.handle('foot', 'account');
  await settle();
  h.face.handle('room', { room: 'account', key: 'places', act: 'revoke-all' });
  await settle();
  assert.ok(!h.ops().includes('confirmLeave'));
  h.face.handle('room', { room: 'account', key: 'places', act: 'revoke-all' });
  await settle();
  assert.ok(!h.ops().includes('confirmLeave'), 'a second press within 0.6 s is not taken');
  await new Promise(resolve => setTimeout(resolve, ROOM_TIMING.armGuard + 20));
  h.face.handle('room', { room: 'account', key: 'places', act: 'revoke-all' });
  await settle();
  assert.deepEqual(h.ops().filter(o => o === 'confirmLeave' || o === 'revokeAll'), ['confirmLeave', 'revokeAll']);
  const kept = accountFaceHarness(t, { leave: false });
  await enterAs(kept);
  kept.face.handle('foot', 'account');
  await settle();
  kept.face.handle('room', { room: 'account', key: 'places', act: 'revoke-all' });
  await new Promise(resolve => setTimeout(resolve, ROOM_TIMING.armGuard + 20));
  kept.face.handle('room', { room: 'account', key: 'places', act: 'revoke-all' });
  await settle();
  assert.ok(!kept.ops().includes('revokeAll'), 'going back to save sends nothing');
});

test('the deletion request is a confirm group and its send button is not the button that opened it (설계 8.3)', async t => {
  const h = accountFaceHarness(t);
  await enterAs(h);
  h.face.handle('foot', 'account');
  await settle();
  h.face.handle('room', { room: 'account', key: 'del', act: 'delete-ask' });
  h.face.handle('room', { room: 'account', key: 'del', act: 'delete-ask' });
  h.face.handle('room', { room: 'account', key: 'del', act: 'delete-send' });
  await settle();
  assert.ok(!h.ops().includes('requestDeletion'), 'pressing 「지우기 요청」 twice or sending at once does not request');
  assert.deepEqual([h.room().focus.key, h.room().focus.ask], ['del', true]);
  await new Promise(resolve => setTimeout(resolve, ROOM_TIMING.armGuard + 20));
  h.face.handle('room', { room: 'account', key: 'del', act: 'delete-send' });
  await settle();
  assert.equal(h.ops().filter(o => o === 'requestDeletion').length, 1);
});

test('the launcher’s account change drops the shown account and a late answer; signing out closes the room and clears it', async t => {
  let release = null;
  const h = accountFaceHarness(t, { answers: { accountView: () => (release ? faceView() : new Promise(r => { release = r; })) } });
  await enterAs(h);
  assert.equal(typeof h.bound()?.accountChanged, 'function', 'the face hands the launcher its handle');
  h.face.handle('foot', 'account');
  await settle();
  const first = release;
  h.bound().accountChanged();
  await settle();
  first(faceView({ account: { ...faceView().account, profile: { display_name: '옛 계정 이름' } } }));
  await settle();
  assert.equal(h.room().say, '합성 회원 님으로 로그인했습니다.', 'the room read the account again and dropped the old answer');
  h.face.setState({ status: 'signed-out', generation: 2 });
  await settle();
  assert.equal(h.view.last().aside ?? null, null);
  h.face.setState(signedIn(ACCOUNT, 3));
  await settle(30);
  h.face.handle('foot', 'account');
  assert.equal(h.room().say, '계정 정보를 불러오고 있습니다.', 'nothing from before the sign-out is shown');
});

test('a guest cannot open 내 계정', async t => {
  const h = accountFaceHarness(t);
  await settle();
  h.face.setState({ status: 'signed-out', generation: 1 });
  await settle(30);
  h.face.handle('foot', 'account');
  assert.equal(h.view.last().aside ?? null, null);
});

/* ── 셋째 묶음: 설정 방(설계 6절)과 구독 줄의 팁(설계 검토 D7) ── */
function settingsFaceHarness(t, { rows = [roomRow('c', 'claude', { passCount: 1, passUntil: Date.now() + 2 * 864e5 })], options = {} } = {}) {
  let snap = { ok: true, seq: 1, rows, check: { at: Date.now() - 60e3 }, usage: { accounts: {} }, settings: {}, tools: {}, login: null };
  const saved = [], pcalls = [];
  const subscriptions = {
    snapshot: async () => snap,
    check: async () => ({ ...snap, seq: snap.seq + 1 }),
    onChanged: () => () => {},
    save: async patch => { saved.push(patch); snap = { ...snap, seq: snap.seq + 1, settings: { ...snap.settings, ...(patch.settings || {}) } }; return snap; },
  };
  const note = (name, value) => (...args) => { pcalls.push([name, ...args]); return Promise.resolve(typeof value === 'function' ? value(...args) : value); };
  let notices = { banners: true, mutedUntil: 0, schedule: false, start: '22:00', end: '08:00', weekdays: false };
  const rooms = {
    desktop: { get: note('desktop.get', { ok: true, preferences: { closeToTray: true, launchAtLogin: false, startHidden: false, globalShortcut: '', zoomFactor: 1 }, capabilities: { launchAtLogin: true, globalShortcut: true, tray: true } }), update: note('desktop.update', { ok: true }), onChange: () => () => pcalls.push(['desktop.off']) },
    drafts: { status: note('drafts.status', { ok: true, available: true, enabled: false }), set: note('drafts.set', { ok: true, available: true, enabled: true }), onChange: () => () => pcalls.push(['drafts.off']) },
    notices: { get: () => ({ ...notices }), set: patch => { pcalls.push(['notices.set', patch]); notices = { ...notices, ...patch }; return { ...notices }; } },
    updates: { status: note('updates.status', { state: 'current', currentVersion: '0.4.97' }), check: note('updates.check', { state: 'checking' }), download: note('updates.download', {}), install: note('updates.install', {}), confirmInstall: note('confirmInstall', true), onChange: () => () => pcalls.push(['updates.off']) },
    environment: () => ({ platform: 'win32', version: '0.4.97', mode: 'development' }),
    copyDiagnostics: note('copyDiagnostics', true),
  };
  const h = harness(t, { options: { subscriptions, rooms, ...options } });
  return { ...h, saved, pcalls, pnames: () => pcalls.map(c => c[0]), room: () => h.view.last().rooms?.settings, solio: () => h.view.last().room?.solio };
}
const togOf = (row, act) => row.more.find(x => x[0] === 'tog' && x[4] === act);

test('a guest opens the settings room from the fan: the bridges are read, the draft switch is locked, there is no tip switch, and Esc closes it (설계 6절)', async t => {
  // 손님은 시험용 손님 길로 솔리오에 들어온다. 펼침에는 「설정」 하나만 있다
  const h = settingsFaceHarness(t, { options: { initialState: { status: 'signed-out' }, allowGuestEntry: () => true, onBrowse: () => ({ ok: true, action: 'purpose' }), onSelectPurpose: () => ({ ok: true }) } });
  await settle();
  h.face.handle('qa-guest');
  await settle(30);
  h.face.handle('open-switch');
  assert.deepEqual(h.view.last().fan.foot.map(f => f.action), ['settings']);
  h.face.handle('foot', 'settings');
  await settle();
  assert.deepEqual([h.view.last().aside, h.view.last().focus], ['settings', 'aside']);
  assert.deepEqual(h.pnames().sort(), ['desktop.get', 'drafts.status', 'updates.status']);
  const room = h.room();
  assert.equal(room.say, '이 PC의 SYNK는 최신 판입니다.');
  assert.deepEqual(room.rows.map(r => r.key), ['update', 'start', 'key', 'view', 'notice', 'draft']);
  const draft = room.rows.find(r => r.key === 'draft');
  assert.equal(togOf(draft, 'draft')[5], 'off', 'a guest cannot switch draft recovery on');
  assert.equal(togOf(room.rows.find(r => r.key === 'notice'), 'tips'), undefined, 'a guest has no tip switch');
  h.face.handle('room', { room: 'settings', key: 'draft', act: 'draft' });
  await settle();
  assert.ok(!h.pnames().includes('drafts.set'));
  assert.ok(h.face.handle('escape'));
  assert.deepEqual([h.view.last().aside, h.view.last().focus], [null, 'aside-return']);
  assert.deepEqual(h.pnames().filter(n => n.endsWith('.off')).sort(), ['desktop.off', 'drafts.off', 'updates.off'], 'closing stops listening');
});

test('a member’s subscription row carries its tip with two reactions; a reaction saves, and 「구독 팁」 off in the settings room hides it (설계 검토 D7)', async t => {
  const h = settingsFaceHarness(t);
  await settle();
  h.face.setState(signedIn());
  await settle(30);
  const row = h.solio().rows.find(r => r.key === 'claude');
  assert.equal(row.more.tip.key, 'pass:claude');
  assert.match(row.more.tip.text, /니다\.$/);
  h.face.handle('room', { room: 'solio', key: 'svc:claude', act: 'tip', arg: 'pass:claude|helpful' });
  await settle();
  assert.deepEqual(h.saved.at(-1), { tip: { key: 'pass:claude', action: 'helpful' } });
  const after = h.solio().rows.find(r => r.key === 'claude').more.tip;
  assert.deepEqual([after.done, after.live], [true, '도움이 됐다고 남겼습니다. 같은 팁은 7일 동안 쉽니다.']);
  h.face.handle('foot', 'settings');
  await settle();
  assert.equal(togOf(h.room().rows.find(r => r.key === 'notice'), 'tips')[3], true, 'a member sees 「구독 팁」 on');
  h.face.handle('room', { room: 'settings', key: 'notice', act: 'tips' });
  await settle();
  assert.deepEqual(h.saved.at(-1), { settings: { tipsOff: true } });
  assert.equal(togOf(h.room().rows.find(r => r.key === 'notice'), 'tips')[3], false);
  assert.equal(h.solio().rows.find(r => r.key === 'claude').more.tip, undefined, 'the tip goes from the row');
});

test('the launcher hands the settings room its bridges: preferences, no drafts, notices through convenience, the PLEASURE switch, updates with the install question, and the problem report', () => {
  const launcher = fs.readFileSync(new URL('../renderer/launcher.mjs', import.meta.url), 'utf8');
  assert.match(launcher, /confirmInstall:\(\)=>confirmUpdateInstall\(\)/, 'the install asks about unsaved writing first, as the old screen did');
  assert.match(launcher, /convenience\?\.notifications/, 'notices go through convenience, never straight to storage');
  // 쓰던 글 되살리기는 지킬 편집기가 없어 다리를 두지 않는다(PC 0.5.0 설계 4.2-4). 플레저 PC 알림은 설정 방이 켜고 끈다(4.5 R7)
  assert.match(launcher, /desktop,drafts:null,notices,care,chatgpt:bridge\?\.chatgptConnection\|\|null,updates,environment:\(\)=>environment,copyDiagnostics\}/);
  assert.match(launcher, /safeDiagnostics\(\{environment,auth,clients,view:'settings',online:navigator\.onLine\}\)/);
});

test('a room left open over an account reset opens again, the old account screen sends 내 계정 back to read, and the old board stays off under the face (2단계 둘째 조각 최종 검수)', () => {
  const ctl = fs.readFileSync(new URL('../renderer/orb-face.mjs', import.meta.url), 'utf8');
  assert.match(ctl, /rooms\.reset\(\);\s*\/\/[^\n]*\n\s*if \(aside && !disposed\) rooms\.open\(aside\);/);
  assert.match(ctl, /if \(aside === 'account'\) rooms\.reloadAccount\?\.\(\);/);
  const launcher = fs.readFileSync(new URL('../renderer/launcher.mjs', import.meta.url), 'utf8');
  // 옛 구독 판은 PC 0.5.0에서 거뒀다. 얼굴 밑에서 다시 설 자리가 없다
  assert.doesNotMatch(launcher, /subscriptionsBoard|subscriptions\.mjs/);
});

/* 별 지도와 효과음(2026-11-20, Fable 최종 검수 F1 · F3) */
test('pointing at a place name taps once: moving between the texts inside one name neither clears nor repeats it, and no sound plays while the window is behind', () => {
  const view = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(view, /if \(name && on\) \{ if \(!name\.classList\.contains\('hot'\)\) sound\.key\(\);/);
  assert.match(view, /else if \(!on && \(!name \|\| !name\.contains\(event\.relatedTarget\)\)\) \{ stage\.setHot\(null\);/);
  assert.match(view, /if \(b && on\) \{ if \(!b\.classList\.contains\('hot'\)\) sound\.key\(\);/);
  assert.match(view, /else if \(!on && \(!b \|\| !b\.contains\(event\.relatedTarget\)\)\)/);
  assert.match(view, /const soundPref = followSoundPreference\(options\.rooms\?\.desktop\);/);
  assert.match(view, /createOrbSound\(\{ win, enabled: \(\) => look\.sound !== false && soundPref\.on\(\) && doc\?\.hasFocus\?\.\(\) !== false \}\)/);
  assert.match(view, /sound\.dispose\(\); soundPref\.dispose\(\);/);
  assert.doesNotMatch(view, /sweepIn|sweepDone/);
});

/* ── 솔리오 「사무실」 오브제와 방(사무실 구현설계 11.1 · 7절 · 3.4의 8) ── */
const OFFICE_SHOP = 'C:\\work\\shop';
const officeBoard = ({ asked = true } = {}) => {
  const state = asked ? officeReduce(officeState(), { kind: 'hook', event: 'Notification', notificationType: 'permission_prompt', sessionId: 'sess-ask-0001', cwd: OFFICE_SHOP, at: Date.now() - 20e3 }) : officeState();
  return { ok: true, available: true, state, departments: [{ id: 'ddev', name: '개발부', folder: OFFICE_SHOP }], assignments: {}, settings: { view: 'tilted', manualCap: null },
    roots: { claude: [], codex: [], added: [] }, pc: { cores: 8, totalMemGb: 15.7, freeMemGb: 6, cpuPercent: 20 }, hooks: { on: false, available: false }, readAt: Date.now() };
};
function officeFake(answer) {
  const calls = [], listeners = new Set();
  let current = answer;
  return {
    calls, set: next => { current = next; }, emit: () => { for (const fn of listeners) fn(); },
    reads: () => calls.filter(c => c === 'snapshot').length,
    api: {
      snapshot: async () => { calls.push('snapshot'); return typeof current === 'function' ? current() : current; },
      watch: async on => { calls.push('watch:' + on); return { ok: true }; },
      seen: async id => { calls.push('seen:' + id); return { ok: true }; },
      onChanged: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    },
  };
}

test('사무실 stands last, only when the main process answers available:true, and an app without the bridge has no object', async t => {
  const cases = [
    [{ office: officeFake(officeBoard()) }, ['subs', 'office'], ['구독', '사무실']],
    [{ office: officeFake(officeBoard()), visits: readFake(visible()), health: readFake(healthy()) }, ['subs', 'visits', 'health', 'office'], ['구독', '방문자 분석', '계정 건강', '사무실']],
    [{ office: officeFake({ ok: true, available: false }), visits: readFake(visible()) }, ['subs', 'visits'], ['구독', '방문자 분석']],
    [{ office: officeFake({ ok: true, available: false }) }, [], []],
    [{}, [], []],
  ];
  for (const [fakes, keys, labels] of cases) {
    const h = harness(t, { options: { office: fakes.office?.api, siteVisits: fakes.visits?.api, snsHealth: fakes.health?.api } });
    await settle();
    h.face.setState(signedIn());
    await settle(20);
    assert.deepEqual(programKeys(h), keys);
    assert.deepEqual((h.view.last().room.programs || []).map(p => p.label), labels);
    assert.equal(h.view.last().room.office.visible, keys.includes('office'), 'the room scene follows available');
    if (fakes.office) assert.equal(fakes.office.reads(), 1, 'asked once on the way into Solio');
    assert.equal(h.face.handle('prog', 'office'), keys.includes('office'), 'only an office that is there opens');
  }
});

test('an office change can reveal the first confirmed membership in an open Solio window', async t => {
  const office = officeFake({ ok: true, available: false });
  const h = harness(t, { options: { office: office.api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.ok(!programKeys(h).includes('office'));

  const before = office.reads();
  office.emit();
  await settle(20);
  assert.equal(office.reads(), before + 1);
  assert.ok(!programKeys(h).includes('office'), 'a notification alone cannot grant access');

  office.set({ ...officeBoard({ asked: false }), tasking: { tasks: [] } });
  office.emit(); office.emit();
  await settle(20);
  assert.equal(office.reads(), before + 2);
  assert.ok(programKeys(h).includes('office'));
  assert.ok(h.view.last().room.office.tasking);

  h.face.setState({ status: 'signed-out', accountKey: null, generation: 2 });
  await settle(20);
  const afterLogout = office.reads();
  office.emit();
  await settle(20);
  assert.equal(office.reads(), afterLogout);
});

test('the 사무실 object carries the alert mark while another program is open, and loses it after a change notice', async t => {
  const office = officeFake(officeBoard());
  const h = harness(t, { options: { office: office.api, siteVisits: readFake(visible()).api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  const mark = () => h.view.last().room.programs.find(p => p.key === 'office')?.alert === true;
  assert.equal(h.view.last().room.prog, 'subs');
  assert.equal(mark(), true, 'a question waits: the object shows ! on the 구독 room');
  assert.equal(h.face.handle('prog', 'visits'), true);
  await settle(10);
  assert.equal(mark(), true, 'still there while 방문자 분석 is open');
  assert.ok(!h.view.last().room.programs.some(p => p.key !== 'office' && p.alert), 'only 사무실 carries it');
  // 본체의 바뀜 알림이 오면 다시 읽고, 알림이 풀린 판이면 느낌표가 빠진다
  office.set(officeBoard({ asked: false }));
  const before = office.reads();
  office.emit(); office.emit(); office.emit();
  await settle(20);
  assert.equal(office.reads(), before + 1, 'several notices close together read once');
  assert.equal(mark(), false);
  assert.ok(!office.calls.includes('watch:true'), 'records are watched only while the office room is open');
});

test('opening 사무실 watches the records, the headline comes from the board, a folded department is marked seen, and leaving stops watching', async t => {
  const office = officeFake(officeBoard());
  const h = harness(t, { options: { office: office.api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  assert.equal(h.face.handle('prog', 'office'), true);
  await settle(20);
  const room = h.view.last().room;
  assert.equal(room.prog, 'office');
  assert.ok(office.calls.includes('watch:true'));
  assert.ok(office.reads() >= 2, 'read again when the room opens: ' + office.reads());
  assert.equal(room.office.say, '개발부가 방금 승인을 물었습니다.');
  assert.deepEqual(room.office.rows.map(r => r.key), ['d:ddev', 'cap', 'cfg', 'add']);
  assert.equal(room.office.rows.find(r => r.key === 'cap').val, '넷까지', '8 cores and 15.7 GB (16) give four');
  assert.equal(h.face.handle('room', { room: 'solio-office', key: 'd:ddev', act: 'row-open' }), true);
  assert.equal(h.face.handle('room', { room: 'solio-office', key: 'd:ddev', act: 'row-fold' }), true);
  await settle(10);
  assert.ok(office.calls.includes('seen:ddev'));
  assert.equal(h.face.handle('prog', 'subs'), true);
  await settle(10);
  assert.equal(office.calls.filter(c => c.startsWith('watch:')).at(-1), 'watch:false');
  // 방을 떠나며 접힌 줄의 알림은 떠난 뒤에 와도 받는다. 방 안의 단추는 받지 않는다
  assert.equal(h.face.handle('room', { room: 'solio-office', key: 'lobby', act: 'row-fold' }), true);
  await settle(10);
  assert.ok(office.calls.includes('seen:null'));
  assert.equal(h.face.handle('room', { room: 'solio-office', key: 'add', act: 'dept-add', fields: { name: '법무부' } }), false);
});

test('a hidden window stops watching the records and the room watches again when it shows', async t => {
  const office = officeFake(officeBoard());
  const h = harness(t, { options: { office: office.api } });
  await settle();
  h.face.setState(signedIn());
  await settle(20);
  h.face.handle('prog', 'office');
  await settle(10);
  h.face.handle('hidden');
  await settle(4);
  assert.equal(office.calls.filter(c => c.startsWith('watch:')).at(-1), 'watch:false');
  h.face.handle('visible');
  await settle(10);
  assert.equal(office.calls.filter(c => c.startsWith('watch:')).at(-1), 'watch:true');
});

test('the view draws the office room with the house row rules and the floor keeps its motion small', async () => {
  const src = fs.readFileSync(new URL('../renderer/orb-face-view.mjs', import.meta.url), 'utf8');
  assert.match(src, /data-orb-prog="office" aria-current="false" style="--k:4"/, 'the object stands after 계정 건강');
  assert.match(src, /<div class="room room-top" data-room="solio-office" hidden>/);
  assert.match(src, /const asideBoxes = \[\.\.\.Object\.values\(app\.asides\)\.map\(a => a\.rows\), app\.offRows\];/, 'office rows open, pin and fold like the room rows');
  assert.match(src, /o\.classList\.toggle\('news', !!p\?\.alert\)/);
  const { railSettleMs } = await import('../renderer/orb-face-view.mjs');
  assert.equal(railSettleMs(5), 760, 'five names take 0.76 s before resting opens one');
  const floor = fs.readFileSync(new URL('../renderer/office-floor.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(floor, /setLineDash/, 'no dotted or dashed rings');
  assert.doesNotMatch(floor, /\bsmx\b|\bsmy\b|\bbob\b/, 'no pointer-following camera and no bobbing body');
  assert.match(floor, /Math\.min\(2, Number\(win\.devicePixelRatio\) \|\| 1\)/);
});

/* ── 창 안의 PULSE(3단계 구현 설계 4절) ── */
function pulseEmbed() {
  const sent = [], focused = [];
  let changed = null, evented = null, open = false;
  const embed = {
    place(value) { sent.push({ ...value }); return Promise.resolve({ ok: true, open }); },
    state: () => Promise.resolve({ open }),
    focus() { focused.push(1); return Promise.resolve({ ok: true }); },
    open() { api.direct.push(1); if (!open) api.setOpen(true); return Promise.resolve({ ok: true, id: 'pulse', reused: true }); },
    close() { const outcome = api.closeAnswer; if (outcome === 'closed') api.setOpen(false); return Promise.resolve({ ok: true, outcome }); },
    onChanged(fn) { changed = fn; return () => { changed = null; }; },
    onEvent(fn) { evented = fn; return () => { evented = null; }; },
  };
  const api = { embed, sent, focused, opens: [], direct: [], closeAnswer: 'closed', setOpen(v) { open = v; changed?.({ open: v }); }, event(v) { evented?.(v); }, last: () => sent.at(-1) };
  return api;
}
async function enteredWithPulse(t, extra = {}) {
  const e = pulseEmbed();
  const workspace = { status: 'resolved', destinations: ['/pulse-app/'], unavailable: [] };
  // 본체는 PULSE를 열면서 뷰를 만들고 열림을 알린다(pulse-view.cjs onChange). 그 뒤에 열기의 답이 온다
  const h = harness(t, { options: { embed: e.embed, onEnter: () => ({ ok: true, action: 'workspace', workspace }), onOpenSpace: dest => { e.opens.push(dest); if (dest === '/pulse-app/') e.setOpen(true); return { ok: true, destination: dest }; }, ...extra } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('continue-personal');
  await settle();
  return { h, e };
}

test('PULSE opens inside the window: the band shows once the orb has arrived, never while it moves', async t => {
  const { h, e } = await enteredWithPulse(t);
  assert.equal(h.view.last().band, null, 'Solio has no band');
  assert.ok(e.sent.every(v => v.visible === false), 'nothing is shown in Solio');
  h.face.handle('open-switch');
  await settle();
  h.face.handle('go', 'pulse');
  await settle();
  const last = h.view.last();
  assert.equal(last.space, 'pulse');
  assert.equal(last.band, 'pulse');
  assert.deepEqual(last.room, { space: 'pulse', say: '', then: '', action: null, error: '', embedded: true });
  assert.deepEqual(e.last(), { visible: true, top: 56 });
  // 구가 PULSE 별로 들어가는 동안(dive)에는 숨긴 채였다
  const diveAt = h.view.log.findIndex(x => x[0] === 'dive' && x[1] === 'pulse');
  assert.ok(diveAt >= 0);
  assert.ok(h.view.scenes.some(s => s.band === 'pulse') && e.sent.filter(v => v.visible).length === 1, 'shown once, after arriving');
});

test('opening the fan in the band hides PULSE; closing it or choosing PULSE again shows it; Solio keeps it hidden and alive', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  h.face.handle('open-switch'); await settle();
  assert.equal(h.view.last().fan.open, true);
  assert.equal(h.view.last().band, 'pulse', 'the band stays so the orb does not move when the fan opens');
  assert.deepEqual(e.last(), { visible: false, top: 56 });
  h.face.handle('escape'); await settle();
  assert.deepEqual(e.last(), { visible: true, top: 56 });
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.deepEqual(e.last(), { visible: true, top: 56 }, 'choosing the current space closes the fan and shows PULSE');
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'solio'); await settle();
  assert.equal(h.view.last().space, 'solio');
  assert.equal(h.view.last().band, null);
  assert.deepEqual(e.last(), { visible: false, top: 56 });
  const opens = e.opens.length;
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.equal(e.opens.length, opens, 'a live PULSE is not looked up again (설계 검토 R7)');
  assert.equal(e.direct.length, 1, 'going back asks main to open PULSE, which reuses the view');
  assert.deepEqual(e.last(), { visible: true, top: 56 });
});

test('a closed PULSE view leaves the room with a way to reopen it and keeps the band place', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  e.setOpen(false); await settle();
  const last = h.view.last();
  assert.equal(last.band, 'pulse', 'the small orb keeps its band place, nobody moved it (설계 검토 R12)');
  assert.equal(last.bandClose, false);
  assert.deepEqual(e.last(), { visible: false, top: 56 });
  assert.equal(last.room.say, 'PULSE가 닫혔습니다.');
  assert.equal(last.room.then, '저장하지 않은 내용은 남지 않았을 수 있습니다. 다시 열면 첫 화면부터 엽니다.');
  assert.deepEqual(last.room.action, { action: 'reopen-space', label: '다시 열기' });
  h.face.handle('reopen-space'); await settle();
  assert.equal(h.view.last().band, 'pulse');
  assert.deepEqual(e.last(), { visible: true, top: 56 });
});

test('main can bring the face back into PULSE (「돌아가서 저장」) and send F6 focus to the small orb; F6 in the band goes back to PULSE', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'solio'); await settle();
  assert.equal(h.view.last().space, 'solio');
  e.event({ type: 'reveal' }); await settle();
  assert.equal(h.view.last().space, 'pulse');
  assert.deepEqual(e.last(), { visible: true, top: 56 });
  e.event({ type: 'focus-band' }); await settle();
  assert.equal(h.view.last().focus, 'here');
  const before = e.focused.length;
  assert.equal(h.face.handle('band-f6'), true);
  await settle();
  assert.equal(e.focused.length, before + 1);
  // 펼침이 열린 동안의 F6은 뷰가 숨어 있어 아무것도 하지 않는다
  h.face.handle('open-switch'); await settle();
  assert.equal(h.face.handle('band-f6'), false);
  // 뷰가 없으면 reveal도 아무것도 열지 않는다
  h.face.handle('escape'); await settle(); e.setOpen(false); await settle();
  e.event({ type: 'reveal' }); await settle();
  assert.deepEqual(e.last(), { visible: false, top: 56 }, 'nothing to reveal without a view');
});

test('without an embed bridge the face behaves as before and sends nothing', async t => {
  const workspace = { status: 'resolved', destinations: ['/pulse-app/'], unavailable: [] };
  const h = harness(t, { options: { onEnter: () => ({ ok: true, action: 'workspace', workspace }) } });
  await settle(); h.face.setState(signedIn()); await settle(); h.face.handle('continue-personal'); await settle();
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.equal(h.view.last().band, null);
  assert.equal(h.view.last().room.say, 'PULSE를 열었습니다.', 'the separate PULSE window is open, not closed (0.5.2 FA3)');
});

test('reveal brings the face into PULSE without a dive, and the view takes the keyboard focus (설계 검토 R12 · R3)', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'solio'); await settle();
  const dives = h.view.log.filter(x => x[0] === 'dive').length, focused = e.focused.length;
  e.event({ type: 'reveal' }); await settle();
  assert.equal(h.view.last().space, 'pulse');
  assert.equal(h.view.log.filter(x => x[0] === 'dive').length, dives, 'no dive for something the person did not do');
  assert.equal(e.focused.length, focused + 1);
});

test('the keyboard focus goes to PULSE on arrival and after a mouse close of the fan, but stays on the orb after Esc (설계 검토 R3)', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.equal(e.focused.length, 1, 'arrival sends the focus into PULSE');
  h.face.handle('open-switch'); await settle(); h.face.handle('escape'); await settle();
  assert.equal(e.focused.length, 1, 'Esc leaves the focus on the small orb');
  assert.equal(h.view.last().focus, 'here');
  h.face.handle('open-switch'); await settle(); h.face.handle('close-switch'); await settle();
  assert.equal(e.focused.length, 2, 'a press outside closes the fan and the focus goes back to PULSE');
});

test('while the sign-out question is open PULSE stays hidden, and comes back if the person stays (설계 검토 R11)', async t => {
  let answer;
  const { h, e } = await enteredWithPulse(t, { onSignOut: () => new Promise(resolve => { answer = resolve; }) });
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  h.face.handle('open-switch'); await settle(); h.face.handle('foot', 'logout'); await settle();
  assert.equal(h.view.last().fan.open, false);
  assert.deepEqual(e.last(), { visible: false, top: 56 });
  answer({ ok: false }); await settle();
  assert.deepEqual(e.last(), { visible: true, top: 56 });
});

test('「PULSE 닫기」 in the band closes PULSE and goes to Solio; keeping a draft stays in PULSE (설계 검토 R6)', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.equal(h.view.last().bandClose, true);
  e.closeAnswer = 'kept';
  h.face.handle('pulse-close'); await settle();
  assert.equal(h.view.last().space, 'pulse');
  assert.deepEqual(e.last(), { visible: true, top: 56 });
  e.closeAnswer = 'closed';
  h.face.handle('pulse-close'); await settle();
  assert.equal(h.view.last().space, 'solio');
  assert.ok(!h.view.scenes.some(s => s.room?.say === 'PULSE가 닫혔습니다.'), 'no closed-room line flashes on the way out');
  assert.deepEqual(h.view.log.filter(x => x[0] === 'arrive').at(-1), ['arrive', 'solio', 'quick']);
});

test('a hidden view that main hid by itself is placed again (설계 검토 R13)', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  const n = e.sent.length;
  e.event({ type: 'hidden' }); await settle();
  assert.equal(e.sent.length, n + 1);
  assert.deepEqual(e.last(), { visible: true, top: 56 });
});

test('a signed-out guest whose PULSE invite is received goes into PULSE in the window; the fan has only PULSE and 「로그인」 (설계 검토 R1)', async t => {
  const e = pulseEmbed();
  const h = harness(t, { initial: { status: 'signed-out' }, options: { embed: e.embed, onInvite: () => { e.setOpen(true); return { ok: true, state: 'received', destination: '/pulse-app/' }; } } });
  await settle();
  h.view.type('https://workspace.synk.im/pulse-app/#invite=SyntheticInvite_1234567890');
  h.face.handle('invite-submit');
  await settle();
  assert.equal(h.face.getState().phase, 'entered');
  assert.equal(h.face.clientMode(), 'app');
  assert.equal(h.view.last().space, 'pulse');
  assert.equal(h.view.last().band, 'pulse');
  assert.deepEqual(e.last(), { visible: true, top: 56 });
  h.face.handle('open-switch'); await settle();
  const fan = h.view.last().fan;
  assert.deepEqual(fan.names.map(n => n.space), ['pulse']);
  assert.deepEqual(fan.foot.map(f => f.action), ['signin']);
  h.face.handle('foot', 'signin'); await settle();
  assert.equal(h.face.getState().phase, 'auth');
  assert.deepEqual(e.last(), { visible: false, top: 56 });
});

test('「로그인」 from a guest closes the live PULSE through the same door: keeping a draft stays in PULSE, closing goes to the ask scene (카본 A1)', async t => {
  const e = pulseEmbed();
  const h = harness(t, { initial: { status: 'signed-out' }, options: { embed: e.embed, onInvite: () => { e.setOpen(true); return { ok: true, state: 'received', destination: '/pulse-app/' }; } } });
  await settle();
  h.view.type('https://workspace.synk.im/pulse-app/#invite=SyntheticInvite_1234567890');
  h.face.handle('invite-submit');
  await settle();
  e.closeAnswer = 'kept';
  h.face.handle('open-switch'); await settle();
  const focused = e.focused.length;
  h.face.handle('foot', 'signin'); await settle();
  assert.deepEqual([h.face.getState().phase, h.face.clientMode(), h.view.last().space, h.view.last().fan.open], ['entered', 'app', 'pulse', false], 'the draft was kept, so the guest stays in PULSE');
  assert.deepEqual(e.last(), { visible: true, top: 56 });
  assert.equal(e.focused.length, focused + 1, 'the focus goes back to the draft');
  e.closeAnswer = 'closed';
  h.face.handle('open-switch'); await settle();
  h.face.handle('foot', 'signin'); await settle();
  assert.equal(h.face.getState().phase, 'auth');
  assert.deepEqual(e.last(), { visible: false, top: 56 });
  e.event({ type: 'reveal' }); await settle();
  assert.equal(h.face.getState().phase, 'auth', 'nothing is left alive behind the ask scene to reveal');
});

test('reveal closes an old screen first and shows PULSE; the band hides 「PULSE 닫기」 while a room is open (카본 A1 · A2)', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  h.face.handle('open-switch'); await settle(); h.face.handle('foot', 'settings'); await settle();
  assert.equal(h.view.last().aside, 'settings');
  assert.deepEqual([h.view.last().band, h.view.last().bandClose], ['pulse', false], 'the band keeps the orb in place but offers no close over the room');
  assert.deepEqual(e.last(), { visible: false, top: 56 });
  h.face.handle('open-switch'); await settle(); h.face.handle('foot', 'account'); await settle();
  assert.equal(h.face.clientMode(), 'legacy');
  assert.deepEqual(e.last(), { visible: false, top: 56 });
  e.event({ type: 'reveal' }); await settle();
  assert.deepEqual([h.face.clientMode(), h.view.last().space, h.view.last().aside, h.view.last().bandClose], ['app', 'pulse', null, true]);
  assert.equal(h.view.last().legacy, null, 'the old screen was closed');
  assert.deepEqual(e.last(), { visible: true, top: 56 });
});

test('a guest Workspace invite still stays on the ask scene with its line (the company window is outside)', async t => {
  const e = pulseEmbed();
  const h = harness(t, { initial: { status: 'signed-out' }, options: { embed: e.embed, onInvite: () => ({ ok: true, state: 'received', destination: '/' }) } });
  await settle();
  h.view.type('SyntheticInvite_1234567890');
  h.face.handle('invite-submit');
  await settle();
  assert.equal(h.face.getState().phase, 'invite');
  assert.equal(h.view.last().ask.status, '초대받은 공간을 열었습니다. 열린 창에서 이어 가 주세요.');
});

test('disposing the face hides the PULSE view and drops its listeners', async t => {
  const { h, e } = await enteredWithPulse(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  h.face.dispose();
  assert.deepEqual(e.last(), { visible: false, top: 56 });
  const n = e.sent.length; e.setOpen(false); e.event({ type: 'reveal' }); await settle();
  assert.equal(e.sent.length, n);
});

/* ── 창 안의 Workspace(4단계 구현 설계 6절) ── */
function spaceEmbed(name, order) {
  const sent = [], focused = [], shareAnswers = [];
  let changed = null, evented = null, asked = null, open = false;
  const embed = {
    place(value) { sent.push({ ...value }); order.push([name, value.visible]); return Promise.resolve({ ok: true, open }); },
    state: () => Promise.resolve({ open }),
    focus() { focused.push(1); return Promise.resolve({ ok: true }); },
    open() { api.direct.push(1); if (!open) api.setOpen(true); return Promise.resolve({ ok: true, id: name, reused: true }); },
    close() { const outcome = api.closeAnswer; if (outcome === 'closed') api.setOpen(false); return Promise.resolve({ ok: true, outcome }); },
    onChanged(fn) { changed = fn; return () => { changed = null; }; },
    onEvent(fn) { evented = fn; return () => { evented = null; }; },
    ...(name === 'workspace' ? { onShareAsk(fn) { asked = fn; return () => { asked = null; }; }, answerShare(value) { shareAnswers.push(value); return Promise.resolve({ ok: true }); } } : {}),
  };
  const api = { embed, sent, focused, shareAnswers, direct: [], closeAnswer: 'closed', setOpen(v) { open = v; changed?.({ open: v }); }, event(v) { evented?.(v); }, ask(v) { asked?.(v); }, last: () => sent.at(-1) };
  return api;
}
const SHARE_ITEMS = [{ name: '화면 1', kind: 'screen', thumb: 'data:image/png;base64,AAAA' }, { name: '메모장', kind: 'window', thumb: '' }];
async function enteredWithBoth(t, extra = {}) {
  const order = [], desktopActions = [];
  const p = spaceEmbed('pulse', order), w = spaceEmbed('workspace', order);
  const workspace = { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] };
  const opens = [];
  const h = harness(t, { options: {
    embed: p.embed, workspaceEmbed: w.embed,
    onDesktopAction: fn => { desktopActions.push(fn); return () => {}; },
    onEnter: () => ({ ok: true, action: 'workspace', workspace }),
    onOpenSpace: dest => { opens.push(dest); if (dest === '/') w.setOpen(true); if (dest === '/pulse-app/') p.setOpen(true); return { ok: true, destination: dest }; },
    ...extra,
  } });
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('continue-personal');
  await settle();
  return { h, p, w, order, opens, tray: action => desktopActions.forEach(fn => fn(action)) };
}

test('Workspace opens inside the window under the band with its own close label, and PULSE stays hidden', async t => {
  const { h, p, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  const last = h.view.last();
  assert.deepEqual([last.space, last.band, last.bandClose, last.bandCloseLabel], ['workspace', 'workspace', true, 'Workspace 닫기']);
  assert.deepEqual(last.room, { space: 'workspace', say: '', then: '', action: null, error: '', embedded: true });
  assert.deepEqual(w.last(), { visible: true, top: 56 });
  assert.ok(p.sent.every(v => v.visible === false), 'PULSE is never shown in Workspace');
  assert.equal(w.focused.length, 1, 'arrival sends the focus into Workspace');
});

test('moving between Workspace and PULSE hides the one before showing the other, so two views never stand together', async t => {
  const { h, p, w, order } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.deepEqual(p.last(), { visible: true, top: 56 });
  assert.deepEqual(w.last(), { visible: false, top: 56 });
  assert.equal(h.view.last().bandCloseLabel, 'PULSE 닫기');
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  assert.deepEqual(w.last(), { visible: true, top: 56 });
  assert.deepEqual(p.last(), { visible: false, top: 56 });
  const shown = new Set();
  for (const [name, visible] of order) {
    if (visible) shown.add(name); else shown.delete(name);
    assert.ok(shown.size <= 1, 'two views shown at once: ' + [...shown].join(','));
  }
  assert.equal(w.direct.length, 1, 'going back to a live Workspace reuses the view');
});

test('a closed Workspace view leaves a room that says so and can be reopened', async t => {
  const { h, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  w.setOpen(false); await settle();
  const last = h.view.last();
  assert.equal(last.band, 'workspace');
  assert.equal(last.room.say, 'Workspace가 닫혔습니다.');
  assert.deepEqual(last.room.action, { action: 'reopen-space', label: '다시 열기' });
  h.face.handle('reopen-space'); await settle();
  assert.deepEqual(w.last(), { visible: true, top: 56 });
});

test('「Workspace 닫기」 closes Workspace and goes to Solio; keeping a draft stays', async t => {
  const { h, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  w.closeAnswer = 'kept';
  h.face.handle('band-close'); await settle();
  assert.equal(h.view.last().space, 'workspace');
  assert.deepEqual(w.last(), { visible: true, top: 56 });
  w.closeAnswer = 'closed';
  h.face.handle('band-close'); await settle();
  assert.equal(h.view.last().space, 'solio');
  assert.deepEqual(w.last(), { visible: false, top: 56 });
});

test('the tray line opens Workspace for an assigned account, and says why for an account without it (설계 검토 R17)', async t => {
  const { h, w, tray } = await enteredWithBoth(t);
  tray({ type: 'open-space', space: 'workspace' }); await settle();
  assert.equal(h.view.last().space, 'workspace');
  assert.deepEqual(w.last(), { visible: true, top: 56 });
  tray({ type: 'something-else', space: 'workspace' }); tray(null); await settle();
  assert.equal(h.view.last().space, 'workspace');

  const order = [], other = spaceEmbed('workspace', order), actions = [];
  const onlyPulse = { status: 'resolved', destinations: ['/pulse-app/'], unavailable: [] };
  const g = harness(t, { options: { workspaceEmbed: other.embed, onDesktopAction: fn => { actions.push(fn); return () => {}; }, onEnter: () => ({ ok: true, action: 'workspace', workspace: onlyPulse }) } });
  await settle(); g.face.setState(signedIn()); await settle(); g.face.handle('continue-personal'); await settle();
  actions.forEach(fn => fn({ type: 'open-space', space: 'workspace' })); await settle();
  assert.equal(g.view.last().space, 'solio');
  assert.equal(g.view.last().fan.open, true, 'the fan opens to say why');
  assert.equal(g.view.last().fan.error, '이 계정에는 Workspace 배정이 없습니다.');
  assert.ok(other.sent.every(v => v.visible === false));
});

test('a tray open or a reveal that comes while the orb is going into another space waits for the arrival (3단계 화면 Fable F1)', async t => {
  const { h, w, tray } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'solio'); await settle();
  let release = null;
  h.view.dive = space => { h.view.log.push(['dive', space]); return new Promise(resolve => { release = resolve; }); };
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.ok(release, 'the orb is on its way into PULSE');
  const shownBefore = w.sent.filter(v => v.visible).length;
  w.event({ type: 'reveal' }); await settle();
  assert.notEqual(h.view.last().space, 'workspace', 'nothing changes while the orb moves');
  assert.equal(w.sent.filter(v => v.visible).length, shownBefore, 'Workspace is not shown on the way');
  release(); await settle();
  assert.equal(h.view.last().space, 'workspace', 'the reveal is carried out after arriving');
  assert.deepEqual(w.last(), { visible: true, top: 56 });

  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'solio'); await settle();
  release(); await settle();
  assert.equal(h.view.last().space, 'solio');
  release = null;
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.ok(release, 'the orb is on its way into PULSE again');
  tray({ type: 'open-space', space: 'workspace' }); await settle();
  assert.notEqual(h.view.last().space, 'workspace');
  release(); await settle();
  assert.equal(h.view.last().space, 'workspace', 'the tray open is carried out after arriving');
});

test('a screen-share ask hides Workspace and shows the picker; a pick is answered once and Workspace comes back', async t => {
  const { h, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  w.ask({ id: 7, items: SHARE_ITEMS }); await settle();
  const last = h.view.last();
  assert.deepEqual(last.share, { id: 7, items: SHARE_ITEMS });
  assert.equal(last.focus, 'share');
  assert.equal(last.bandClose, false, 'no close while the picker is open');
  assert.deepEqual(w.last(), { visible: false, top: 56 });
  h.face.handle('share-pick', '1'); await settle();
  assert.deepEqual(w.shareAnswers, [{ id: 7, pick: 1 }]);
  assert.equal(h.view.last().share, null);
  assert.deepEqual(w.last(), { visible: true, top: 56 });
  h.face.handle('share-pick', '0'); await settle();
  assert.equal(w.shareAnswers.length, 1, 'nothing is answered twice');
});

test('Esc or 「취소」 on the picker answers with no choice; an out-of-range pick is no choice', async t => {
  const { h, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  w.ask({ id: 8, items: SHARE_ITEMS }); await settle();
  assert.equal(h.face.handle('escape'), true);
  await settle();
  w.ask({ id: 9, items: SHARE_ITEMS }); await settle();
  h.face.handle('share-cancel'); await settle();
  w.ask({ id: 10, items: SHARE_ITEMS }); await settle();
  h.face.handle('share-pick', '5'); await settle();
  assert.deepEqual(w.shareAnswers, [{ id: 8, pick: null }, { id: 9, pick: null }, { id: 10, pick: null }]);
  assert.deepEqual(w.last(), { visible: true, top: 56 });
});

test('a share ask outside Workspace is refused at once, an empty list withdraws the picker, and closing Workspace drops it', async t => {
  const { h, w } = await enteredWithBoth(t);
  w.setOpen(true); await settle();
  w.ask({ id: 11, items: SHARE_ITEMS }); await settle();
  assert.deepEqual(w.shareAnswers, [{ id: 11, pick: null }], 'Solio is showing, so nobody can choose');
  assert.equal(h.view.last().share, null);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  w.ask({ id: 12, items: SHARE_ITEMS }); await settle();
  w.ask({ id: 12, items: [] }); await settle();
  assert.equal(h.view.last().share, null, 'main took the question back (timeout)');
  assert.deepEqual(w.last(), { visible: true, top: 56 });
  w.ask({ id: 13, items: SHARE_ITEMS }); await settle();
  w.setOpen(false); await settle();
  assert.equal(h.view.last().share, null);
  assert.deepEqual(w.shareAnswers.at(-1), { id: 13, pick: null });
});

test('share items are cleaned: names are trimmed, kinds are screen or window, thumbnails are data images only', async t => {
  const { h, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  w.ask({ id: 14, items: [{ name: '  ', kind: 'tab', thumb: 'https://example.invalid/x.png' }, { name: ' 화면 ', kind: 'screen', thumb: 'data:image/png;base64,AA' }] }); await settle();
  assert.deepEqual(h.view.last().share.items, [{ name: '이름 없는 창', kind: 'window', thumb: '' }, { name: '화면', kind: 'screen', thumb: 'data:image/png;base64,AA' }]);
});

/* 4단계 화면 카본 지적(pc-orb-step4-screen-20261122) */
test('leaving the picker by the fan answers no choice at once, and Esc then closes the fan (카본 A1)', async t => {
  const { h, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  w.ask({ id: 21, items: SHARE_ITEMS }); await settle();
  assert.ok(h.view.last().share);
  h.face.handle('open-switch'); await settle();
  assert.deepEqual(w.shareAnswers, [{ id: 21, pick: null }]);
  assert.equal(h.view.last().share, null);
  assert.equal(h.view.last().fan.open, true);
  assert.equal(h.face.handle('escape'), true); await settle();
  assert.equal(h.view.last().fan.open, false, 'Esc closes the fan, not an old picker');
  assert.deepEqual(w.shareAnswers.length, 1);
  assert.deepEqual(w.last(), { visible: true, top: 56 });
});

test('a share ask while the fan or a room is open is refused, and a new ask replaces an old one (카본 A1)', async t => {
  const { h, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  h.face.handle('open-switch'); await settle();
  w.ask({ id: 22, items: SHARE_ITEMS }); await settle();
  assert.deepEqual(w.shareAnswers, [{ id: 22, pick: null }]);
  assert.equal(h.view.last().share, null);
  h.face.handle('escape'); await settle();
  w.ask({ id: 23, items: SHARE_ITEMS }); await settle();
  w.ask({ id: 24, items: SHARE_ITEMS }); await settle();
  assert.deepEqual(w.shareAnswers.at(-1), { id: 23, pick: null });
  assert.equal(h.view.last().share.id, 24);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'solio'); await settle();
  assert.deepEqual(w.shareAnswers.at(-1), { id: 24, pick: null }, 'going to another space answers too');
});

test('a tray open while an old screen is shown closes it and opens Workspace (카본 A2)', async t => {
  const { h, w, tray } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('foot', 'account'); await settle();
  assert.equal(h.face.clientMode(), 'legacy');
  tray({ type: 'open-space', space: 'workspace' }); await settle();
  assert.equal(h.face.clientMode(), 'app');
  assert.equal(h.view.last().space, 'workspace');
  assert.deepEqual(w.last(), { visible: true, top: 56 });
});

test('a tray open that came before a guest PULSE invite is not carried out over the guest PULSE (카본 A2)', async t => {
  const order = [], p = spaceEmbed('pulse', order), w = spaceEmbed('workspace', order), actions = [];
  const h = harness(t, { initial: { status: 'signed-out' }, options: { embed: p.embed, workspaceEmbed: w.embed, onDesktopAction: fn => { actions.push(fn); return () => {}; }, onInvite: () => { p.setOpen(true); return { ok: true, state: 'received', destination: '/pulse-app/' }; } } });
  await settle();
  actions.forEach(fn => fn({ type: 'open-space', space: 'workspace' })); await settle();
  h.view.type('https://workspace.synk.im/pulse-app/#invite=SyntheticInvite_1234567890');
  h.face.handle('invite-submit'); await settle();
  assert.equal(h.view.last().space, 'pulse');
  assert.equal(h.view.last().fan.open, false, 'no assignment line pops over the guest PULSE');
  assert.deepEqual(p.last(), { visible: true, top: 56 });
});

test('a reveal or tray open for a view already shown sends the keyboard focus into it (카본 A3)', async t => {
  const { h, w, tray } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  const focused = w.focused.length;
  w.event({ type: 'reveal' }); await settle();
  assert.equal(w.focused.length, focused + 1);
  tray({ type: 'open-space', space: 'workspace' }); await settle();
  assert.equal(w.focused.length, focused + 2);
  h.face.handle('open-switch'); await settle(); h.face.handle('escape'); await settle();
  assert.equal(w.focused.length, focused + 2, 'Esc on the fan still leaves the focus on the orb');
});

test('a screen without a name is called a screen (카본 A4)', async t => {
  const { h, w } = await enteredWithBoth(t);
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'workspace'); await settle();
  w.ask({ id: 25, items: [{ name: ' ', kind: 'screen', thumb: '' }] }); await settle();
  assert.deepEqual(h.view.last().share.items, [{ name: '이름 없는 화면', kind: 'screen', thumb: '' }]);
});

// 4단계 PC 화면 Fable 최종(pc-orb-step4-screen-20261122)
test('a tray open held while the orb moves is dropped on sign-out, so the next sign-in does not open Workspace by itself (F1)', async t => {
  const { h, w, tray } = await enteredWithBoth(t);
  const dive = h.view.dive;
  let release = null;
  h.view.dive = space => { h.view.log.push(['dive', space]); return new Promise(resolve => { release = resolve; }); };
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.ok(release, 'the orb is on its way into PULSE');
  tray({ type: 'open-space', space: 'workspace' }); await settle();
  h.face.setState({ status: 'signed-out', generation: 2 }); await settle();
  release(); await settle();
  h.view.dive = dive;
  const shownBefore = w.sent.filter(v => v.visible).length;
  h.face.setState(signedIn(ACCOUNT, 3)); await settle();
  h.face.handle('continue-personal'); await settle();
  assert.notEqual(h.view.last().space, 'workspace');
  assert.equal(w.sent.filter(v => v.visible).length, shownBefore, 'Workspace is not shown after the new sign-in');
});

test('a tray open on an account whose company check is incomplete opens the fan with that reason, not 「no assignment」 (F2)', async t => {
  const order = [], other = spaceEmbed('workspace', order), actions = [];
  const h = harness(t, { storage: memoryStorage({ [ORB_RETURNING_KEY]: '1' }), options: {
    workspaceEmbed: other.embed,
    onDesktopAction: fn => { actions.push(fn); return () => {}; },
    onEnter: () => ({ ok: true, action: 'purpose', purposeMode: 'existing', destinations: ['/pulse-app/'], assignmentCheck: { status: 'unavailable' } }),
  } });
  await settle(); h.face.setState(signedIn()); await settle();
  assert.equal(h.face.getState().phase, 'entered');
  actions.forEach(fn => fn({ type: 'open-space', space: 'workspace' })); await settle();
  const fan = h.view.last().fan;
  assert.equal(fan.open, true);
  assert.equal(fan.lead, '회사 공간 배정을 확인하지 못했습니다.');
  assert.equal(fan.error, '', 'no line that says there is no assignment');
  assert.ok(other.sent.every(v => v.visible === false));
});

test('a tray open that comes while another space is opening waits for it, then opens Workspace (F3)', async t => {
  let finish = null;
  const { h, w, opens, tray } = await enteredWithBoth(t, { onOpenSpace: dest => {
    opens.push(dest);
    if (dest === '/pulse-app/') return new Promise(resolve => { finish = resolve; });
    if (dest === '/') w.setOpen(true);
    return { ok: true, destination: dest };
  } });
  h.face.handle('open-switch'); await settle(); h.face.handle('go', 'pulse'); await settle();
  assert.ok(finish, 'PULSE is opening');
  tray({ type: 'open-space', space: 'workspace' }); await settle();
  assert.deepEqual(opens, ['/pulse-app/'], 'nothing else opens while PULSE is opening');
  finish({ ok: false, message: 'PULSE를 열지 못했어요.' }); await settle(); await settle();
  assert.equal(h.view.last().space, 'workspace', 'the tray request is carried out after the other open ends');
  assert.deepEqual(w.last(), { visible: true, top: 56 });
});
