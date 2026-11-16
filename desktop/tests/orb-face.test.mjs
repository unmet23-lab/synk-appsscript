// 검정 구 얼굴의 컨트롤러 시험(PC 클라이언트 1단계, 1단계_구현설계.md 15절).
// 컨트롤러를 기록용 가짜 화면으로 돌린다. 화면이 받은 장면과 움직임을 차례로 적어 두고,
// 옮기기 설계 「이어받는 로그인 동작」의 뜻(복원하는 동안 글 0, 묻는 화면을 거치지 않음, 배정 하나는 바로, 둘은 고르기 한 번, 구 지키기와 풀기)을 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbFaceController, faceSentence, ORB_RETURNING_KEY, sanitizeInviteFeedback, unconfiguredReason, workspaceLead } from '../renderer/orb-face.mjs';

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
  assert.deepEqual(h.view.last().switch.foot.map(f => f.action), ['account', 'settings', 'logout']);
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
  assert.deepEqual(h.view.last().switch.foot.map(f => f.action), ['settings']);
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

test('rows open the old subscriptions screen as a band, and Esc comes back', async t => {
  const h = harness(t);
  await settle();
  h.face.setState(signedIn());
  await settle();
  h.face.handle('row', 'claude');
  await settle();
  assert.deepEqual(h.calls.find(c => c[0] === 'openLegacy').slice(0, 2), ['openLegacy', 'subscriptions']);
  assert.equal(h.face.clientMode(), 'legacy');
  assert.equal(h.face.isClientShown(), true);
  assert.ok(h.face.handle('escape'));
  assert.equal(h.face.clientMode(), 'app');
  h.face.handle('connect');
  assert.deepEqual(h.calls.filter(c => c[0] === 'openLegacy').at(-1), ['openLegacy', 'subscriptions', { view: 'manage' }]);
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
  const sw = h.view.last().switch;
  assert.equal(h.view.last().layer, 'switch');
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
  assert.deepEqual(h.view.last().switch.names.map(n => n.space), ['solio', 'workspace']);
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
  assert.deepEqual(h.view.last().switch ? h.view.last().switch.foot.map(f => f.action) : ['account', 'settings', 'logout'], ['account', 'settings', 'logout']);
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
  assert.deepEqual(w.view.last().switch.foot.map(f => f.action), ['account', 'settings', 'logout']);
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
  assert.deepEqual(h.view.last().switch.foot.map(f => f.action), ['settings']);
});
