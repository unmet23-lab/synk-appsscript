// 검정 구 얼굴의 컨트롤러(PC 클라이언트 1단계). 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/1단계_구현설계.md 4~14절.
// 이 파일은 DOM을 건드리지 않는다. 단계 기계를 부르고 호스트의 콜백을 부른 뒤, 지금 보일 장면 하나를 화면(view)에 넘긴다.
// 화면은 orb-face-view.mjs가 그리고, Node 시험(desktop/tests/orb-face.test.mjs)은 기록용 가짜 화면으로 이 컨트롤러를 돌린다.
// 실행 번호, 계정 결속 확인, 초대 원문 다루기는 지금 얼굴(portal-entry.mjs)의 규칙을 그대로 옮겨 적었다.
// 그 파일은 웹과 같이 써서 고칠 수 없으므로 일부러 다시 적은 것이다(웹 화면을 다시 지을 때 함께 쓰는 컨트롤러로 뽑아낸다).
import {
  createPortalStateMachine,
  isAuthPendingStatus,
  normalizeAuthStatus,
  normalizePortalWorkspaceDestination,
  normalizePortalWorkspaceState,
  validatePortalInviteInput,
} from './portal-entry-state.mjs';
import { solioToday, solioTodayNeedsReread } from './solio-today.mjs';
import { siteVisitsView, SITE_VISITS_NAME } from './site-visits-model.mjs';
import { createOrbFaceView } from './orb-face-view.mjs';
import { createOrbRooms, ASIDE_ROOMS } from './orb-rooms.mjs';

/* 구 위의 자리(places)와 점 로고(signature)를 켜고 끄는 값. 하나를 false로 바꾸면 그 모양이 빠진다(설계 12절) */
/* eyes: 구의 점 눈(유호님 11-17 「점눈으로 하자」, 결정 표 11-16 「구에 눈을 넣는다」). 끄면 셰이더가 눈을 그리지 않는다 */
export const ORB_LOOK = Object.freeze({ places: true, signature: true, eyes: true });

/* 솔리오 안의 프로그램. 구 옆에 작은 오브제로 놓인다(시안 .rail, 결정 표 11-16). 오브제 줄은 방문자 분석을 볼 계정에게만 있다.
 * 그 밖의 계정에게는 줄이 없고 솔리오 화면이 그대로다. 백업은 방이 생길 때 구독 다음 자리에 넣는다(맡긴 세션 11-18, 결정 표 11-16 「첫 화면에는 백업 줄을 두지 않는다」) */
export const SOLIO_PROGRAMS = Object.freeze([
  Object.freeze({ key: 'subs', label: '구독' }),
  Object.freeze({ key: 'visits', label: SITE_VISITS_NAME }),
]);

/* 움직임의 길이(ms). 시안 검정구.html의 값이다 */
export const ORB_TIMING = Object.freeze({
  introDelay: Object.freeze({ first: 520, back: 300 }),
  intro: Object.freeze({ first: 2400, back: 1150 }),
  /* 드러남이 시작된 때부터 잰 눈의 때. 빛이 자리를 잡을 즈음 잠든 눈이 떠오르고, 곧 눈을 뜬다(시안 boot). 시작 창(startup-update.mjs의 ORB_BOOT)과 같아야 한다 */
  eyesAsleep: Object.freeze({ first: 2220, back: 900 }),
  eyesWake: Object.freeze({ first: 3300, back: 1200 }),
  askWait: 1350,
  zoom: 1750,
  toAsk: 1200,
  dive: 1250,
  diveQuick: 1050,
  sw: 760,
  swClose: 620,
  /* 구 곁의 펼침(2단계 첫 조각, 시안 openFan · closeFan) */
  fan: 440,
  fanClose: 380,
  busyRetry: 1000,
  authRecheck: 30000,
  authRecheckTimes: 4,
  clock: 60000,
});

/* 이 PC에서 한 번이라도 로그인해 들어온 적이 있으면 다시 켤 때의 짧은 길을 쓴다. 움직임의 길이만 정하고 로그인 판단에는 쓰지 않는다 */
export const ORB_RETURNING_KEY = 'synk.orb.returning';

const SPACE_OF_DEST = Object.freeze({ '/': 'workspace', '/pulse-app/': 'pulse' });
const DEST_OF_SPACE = Object.freeze({ workspace: '/', pulse: '/pulse-app/' });
const SPACE_LABEL = Object.freeze({ solio: 'SOLIO', workspace: 'WORKSPACE', pulse: 'PULSE' });
const SPACE_DESC = Object.freeze({ solio: '혼자 하는 사업의 도구', workspace: '팀이 함께 일하는 곳', pulse: '고객과 함께 만드는 곳' });
const SPACE_ROOM = Object.freeze({
  workspace: Object.freeze({ say: 'Workspace를 열었습니다.', then: '따로 열린 Workspace 창에서 이어 가 주세요.' }),
  pulse: Object.freeze({ say: 'PULSE를 열었습니다.', then: '따로 열린 PULSE 창에서 이어 가 주세요.' }),
});
const SIX_HOURS = 6 * 3600e3;

const trimmed = value => (typeof value === 'string' && value.trim() ? value.trim() : '');

/* 호스트와 본체가 보내는 까닭 글은 옛 얼굴의 「-어요」 말씨다. 새 얼굴의 「-습니다」 문장에 맞춰 끝만 바꾼다.
 * 받침이 ㅆ(했 · 었 · 났 · 있), ㅄ(없), ㄶ(않), ㅀ(싫)인 글자 뒤의 「-어요 · -아요」, 「-예요 · -이에요」, 「돼요」, 「해요」만 바꾸고,
 * 「주세요」 같은 부탁과 모르는 꼴은 그대로 둔다 */
export function faceSentence(value) {
  const text = trimmed(value);
  if (!text) return '';
  return text
    .replace(/([가-힣])[어아]요(?=$|[\s.!?,)」])/g, (whole, syllable) => {
      const jong = (syllable.charCodeAt(0) - 0xAC00) % 28;
      return jong === 20 || jong === 18 || jong === 6 || jong === 15 ? `${syllable}습니다` : whole;
    })
    .replace(/([가-힣])(?:이에요|예요)(?=$|[\s.!?,)」])/g, '$1입니다')
    .replace(/아니에요(?=$|[\s.!?,)」])/g, '아닙니다')
    .replace(/돼요(?=$|[\s.!?,)」])/g, '됩니다')
    .replace(/달라요(?=$|[\s.!?,)」])/g, '다릅니다')
    // 「해요」는 앞 글자와 상관없이 「합니다」다(필요해요, 확인해요, 못해요). 「-어요」 화면이 섞이지 않게 한다(0.4.95 원천 후보 검수 F3)
    .replace(/(^|\s|[가-힣])해요(?=$|[\s.!?,)」])/g, '$1합니다');
}
/* 로그인 설정이 없는 판의 까닭 한 줄. 화면이 「로그인 설정을 찾지 못했습니다.」를 먼저 쓰므로 같은 뜻의 첫 문장은 뺀다 */
export function unconfiguredReason(value) {
  const rest = faceSentence(value).replace(/^로그인 설정을 찾지 못[^.!?]*[.!?]\s*/, '').trim();
  return rest || 'synk.im에서 PC 앱을 다시 받아 설치해 주세요.';
}

/* 초대 오류 글에 넣었던 원문이 들어 있으면 그 글을 쓰지 않는다(지금 얼굴의 sanitizeInviteFeedback과 같다) */
export function sanitizeInviteFeedback(message, rawValue, normalizedValue) {
  const text = trimmed(message);
  if (!text) return '';
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (raw && text.includes(raw)) return '';
  if (typeof normalizedValue === 'string' && normalizedValue && text.includes(normalizedValue)) return '';
  const hashIdx = typeof normalizedValue === 'string' ? normalizedValue.indexOf('#invite=') : -1;
  if (hashIdx !== -1) {
    const tokenPart = normalizedValue.slice(hashIdx + '#invite='.length);
    if (tokenPart && text.includes(tokenPart)) return '';
  }
  return faceSentence(text);
}

/* 공간 고르기(진입) 위의 안내 한 줄. 지금 얼굴의 resolveWorkspaceCopy 뜻을 평범한 문장으로 다시 썼다 */
export function workspaceLead(workspace) {
  const ws = workspace || normalizePortalWorkspaceState({});
  if (ws.status === 'resolved') return ws.destinations.length > 1 ? '' : '들어갈 공간을 골라 주세요.';
  if (ws.status === 'partial') {
    const pulseMissing = ws.unavailable.includes('pulse') && !ws.unavailable.includes('workspace');
    const workspaceMissing = ws.unavailable.includes('workspace') && !ws.unavailable.includes('pulse');
    if (pulseMissing && ws.destinations.includes('/')) return 'PULSE 연결은 아직 확인하지 못했습니다. 확인된 Workspace로 먼저 들어가거나 다시 확인할 수 있습니다.';
    if (workspaceMissing && ws.destinations.includes('/pulse-app/')) return 'Workspace 연결은 아직 확인하지 못했습니다. 확인된 PULSE로 먼저 들어가거나 다시 확인할 수 있습니다.';
    return '일부 공간의 연결을 아직 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.';
  }
  if (ws.status === 'login_required') return '열린 창에서 회사 공간 로그인을 마쳐 주세요. 로그인을 마치면 이 화면이 저절로 바뀝니다.';
  if (ws.status === 'account_mismatch') return '열린 작업 공간의 계정이 지금 로그인한 계정과 다릅니다. 같은 계정으로 맞춘 뒤 다시 확인해 주세요.';
  if (ws.status === 'popup_blocked') return '새 창 열기가 막혀 연결된 공간을 아직 확인하지 못했습니다. 아래 단추로 확인 창을 열어 주세요.';
  return faceSentence(ws.message) || '지금은 공간 연결을 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.';
}

function readStorage(storage, key) { try { return storage?.getItem?.(key) ?? null; } catch { return null; } }
function writeStorage(storage, key, value) { try { if (value === null) storage?.removeItem?.(key); else storage?.setItem?.(key, value); } catch { /* 저장소가 막혀도 흐름은 그대로다 */ } }

/**
 * 새 얼굴의 컨트롤러. view는 아래를 갖춘 화면이다(orb-face-view.mjs, 시험에서는 기록용 가짜).
 *   render(scene) · intro(kind, {delay, ms}) · hurryIntro() · move(pose, {ms, ease, face}) · dive(space, ms) · arrive(space, sigKind)
 *   getInviteValue() · setInviteValue(value, {select}) · isHidden() · prefersReducedMotion() · dispose()
 * options는 지금 얼굴이 받는 것(호스트의 콜백)과 새 콜백(onEnterDefault, onOpenSpace), PC 쪽 옵션(onOpenLegacy, onCloseLegacy, onSignOut, subscriptions, rooms, allowGuestEntry, look)이다.
 */
export function createOrbFaceController({ view, options = {}, env = {} } = {}) {
  if (!view) throw new Error('검정 구 얼굴에는 화면이 필요합니다.');
  const setTimer = env.setTimeout || globalThis.setTimeout;
  const clearTimer = env.clearTimeout || globalThis.clearTimeout;
  const setTick = env.setInterval || globalThis.setInterval;
  const clearTick = env.clearInterval || globalThis.clearInterval;
  const now = env.now || (() => Date.now());
  const storage = env.storage ?? null;
  const look = { ...ORB_LOOK, ...(options.look && typeof options.look === 'object' ? options.look : {}) };
  const subs = options.subscriptions && typeof options.subscriptions.snapshot === 'function' ? options.subscriptions : null;
  const visitsApi = options.siteVisits && typeof options.siteVisits.snapshot === 'function' ? options.siteVisits : null;

  const machine = createPortalStateMachine({
    status: options.initialState?.status ?? 'restoring',
    generation: options.initialState?.generation,
    accountKey: options.initialState?.accountKey,
    errorMessage: options.initialState?.errorMessage,
    retryable: options.initialState?.retryable,
    // 웹 얼굴의 bypass(바로 들어온 채 시작)는 PC 호스트가 보내지 않는다. 받아도 늘 구에서 시작해 계정 확인을 거친다(검수 A2)
  });

  let disposed = false;
  let busyAction = null;
  let asyncSeq = 0;
  let navigationHoldActive = false;
  let workspaceNeedsRetry = false;
  let hostReducedMotion = options.initialState?.reducedMotion === true;

  // 화면에 보일 글. 장면을 만들 때 읽는다
  const feedback = { auth: '', note: '', inviteError: '', inviteStatus: '', workspace: '', switch: '' };

  // 들어온 뒤의 상태
  let space = 'solio';
  let prog = 'subs'; // 솔리오 안에서 지금 연 프로그램(SOLIO_PROGRAMS의 key)
  /* 들어온 뒤 「공간 고르기」는 구 곁의 펼침이다(2단계 첫 조각 설계 1.3절). switchOpen이 펼침이 열린 것이고, fanPin은 눌러서(자판 포함) 연 것이다.
   * 다가가서 연 펼침은 손이 떠나면 닫히고, 눌러서 연 것은 다시 누르거나 바깥을 누르거나 Esc로 닫힌다 */
  let switchOpen = false, fanPin = false;
  let legacyKind = null;
  // 들어온 순간에 계정으로 들어왔는지('signed-in') 손님으로 들어왔는지('guest'). 토큰 갱신이나 잠깐의 오류 중에 들어와도
  // 계정이 있으면 회원으로 적는다. 들어온 뒤 로그아웃과 다른 계정을 알아보는 데 쓴다(최종 검수)
  let enteredAs = null;
  const enteredKind = snap => (snap.accountKey ? 'signed-in' : 'guest');
  let assigned = []; // 이 계정에 확인된 배정 공간('workspace', 'pulse')
  let assignedAccount = null;
  let freshSignIn = false; // 이번에 묻는 화면을 거쳐 들어왔는지(점 로고의 길이를 정한다)

  // 구의 움직임은 한 줄로 차례를 지킨다. 계정이 바뀌거나 묻는 화면으로 돌아가면 orbGen을 올려 남은 움직임을 버린다
  let chain = Promise.resolve();
  let orbGen = 0;
  let orbAt = 'void';
  let orbTarget = 'void';
  let introDone = false;
  let hurried = false;
  let autoZoomTimer = null;
  const returning = readStorage(storage, ORB_RETURNING_KEY) === '1';

  // 화면에 넘긴 장면의 차례와 초점
  let focusKey = null;
  let focusSeq = 0;
  let lastPhase = null;
  let lastAnnounced = null;

  // 솔리오 첫 화면의 자료
  const sol = { account: undefined, snapshot: null, error: null, checking: false, rereadFailed: false, autoDone: false, busyRetried: false, authRetried: false, loading: false, rereadAfterAuth: false, authChecking: false, authChecks: 0, authTimer: null, seq: 0, run: 0, timer: null, unsubscribe: null };
  let clockTimer = null;
  // 솔리오 「방문자 분석」의 자료. 계정마다 따로 읽고, 계정이 바뀌면 앞 계정이 받은 답을 버린다(사이트방문 설계 6절).
  // 요약은 하루 한 번 바뀌므로 바뀜 알림 없이 솔리오에 들어올 때와 방문자 분석을 열 때 읽는다
  const vis = { account: undefined, result: null, seq: 0, loading: false, done: false, retried: false, timer: null };
  /* 펼침이나 구독 방에서 여는 방(2단계 둘째 조각 설계 1.3절). aside는 그 방의 이름이고, 방마다의 상태와 동작은 orb-rooms.mjs가 가진다.
   * 방은 어느 공간에서든 열리고 닫으면 있던 방으로 돌아간다. 옛 화면이 열린 동안에도 aside를 지켜 옛 화면에서 돌아오면 그 방이다 */
  let aside = null;
  /* 방이 쓰는 런처 쪽 다리(설계 1.3절 「자료 어댑터」). account는 내 계정의 요청 · 신원 · 로그인과 보안, confirmLeave는 쓰던 글 확인이다.
   * bind로 런처에 손잡이를 넘겨, 계정 생명주기가 바뀔 때 내 계정 자료를 버리게 한다. 런처가 넘기지 않으면 「계정」은 옛 화면을 연다 */
  const roomOptions = options.rooms && typeof options.rooms === 'object' ? options.rooms : {};
  const accountAdapter = roomOptions.account && typeof roomOptions.account.request === 'function' && typeof roomOptions.account.identity === 'function' ? roomOptions.account : null;
  const rooms = createOrbRooms({
    subs,
    account: accountAdapter,
    now,
    setTimer,
    clearTimer,
    setTick,
    clearTick,
    snapshot: () => sol.snapshot,
    accept: snap => { if (disposed || !snap || snap.ok === false) return; acceptSnapshot(snap); sol.error = null; render(); },
    reread: () => { void reread(); },
    copyText: text => view.copyText?.(text),
    changed: () => render(),
    sentence: faceSentence,
    confirmLeave: typeof roomOptions.confirmLeave === 'function' ? () => roomOptions.confirmLeave() : null,
    signOut: () => { if (!disposed) void options.onSignOut?.(); },
    openOld: () => openLegacy('account'),
  });
  try { roomOptions.bind?.({ accountChanged: () => { if (!disposed) rooms.accountChanged(); } }); } catch { /* 런처의 일이다 */ }

  function prefersReducedMotion() {
    if (hostReducedMotion) return true;
    try { if (typeof options.getReducedMotion === 'function' && options.getReducedMotion() === true) return true; } catch { /* 무시 */ }
    try { return view.prefersReducedMotion?.() === true; } catch { return false; }
  }
  function isHidden() { try { return view.isHidden?.() === true; } catch { return false; } }
  function isImmediateEntry() { return prefersReducedMotion() || isHidden(); }

  function clientMode() {
    if (disposed) return 'off';
    const snap = machine.read();
    if (snap.active || navigationHoldActive) return 'portal';
    if (legacyKind) return 'legacy';
    return 'app';
  }

  function focus(key) { focusKey = key; focusSeq += 1; }

  /* ── 장면 ── */
  function askScene(state) {
    const { phase, authStatus, errorMessage } = state;
    const unconfigured = authStatus === 'unconfigured';
    const scene = {
      unconfigured,
      unconfiguredText: unconfigured ? unconfiguredReason(errorMessage) : '',
      showSignIn: !unconfigured && typeof options.onSignIn === 'function',
      showSignUp: !unconfigured && typeof options.onSignUp === 'function',
      showInvite: typeof options.onInvite === 'function',
      note: feedback.note,
      authFeedback: feedback.auth,
      wait: null,
      status: '',
      inviteError: '',
      actions: [],
    };
    if (phase === 'signing-in') {
      scene.wait = 'wait';
      scene.status = '브라우저에서 로그인을 마치면 이 창으로 돌아옵니다.';
      if (typeof options.onCancelSignIn === 'function') scene.actions.push({ action: 'cancel-signin', label: '취소', key: 'cancel' });
    } else if (phase === 'invite') {
      if (busyAction === 'invite') {
        scene.wait = 'wait';
        scene.status = '초대를 확인하고 있습니다.';
        scene.actions.push({ action: 'close-invite', label: '취소', key: 'cancel' });
      } else if (feedback.inviteError) {
        scene.wait = 'error';
        scene.inviteError = feedback.inviteError;
        scene.actions.push({ action: 'close-invite', label: '다시 시도', key: 'retry' });
      } else if (feedback.inviteStatus) {
        scene.wait = 'done';
        scene.status = feedback.inviteStatus;
        scene.actions.push({ action: 'close-invite', label: '돌아가기', key: 'back' });
      } else {
        scene.wait = 'wait';
        scene.status = '초대를 확인하고 있습니다.';
      }
    } else if (phase === 'error') {
      scene.wait = 'error';
      scene.status = faceSentence(errorMessage) || '계정 연결을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
      if (typeof options.onRetry === 'function') scene.actions.push({ action: 'retry-auth', label: '다시 시도', key: 'retry' });
      if (typeof options.onSignIn === 'function' || typeof options.onInvite === 'function') scene.actions.push({ action: 'go-auth', label: '새로 로그인', key: 'go-auth' });
    } else if (phase === 'enter-error') {
      scene.wait = 'error';
      scene.status = faceSentence(errorMessage) || '들어갈 공간을 불러오지 못했습니다. 다시 시도해 주세요.';
      scene.actions.push({ action: 'retry-enter', label: '다시 시도', key: 'retry' });
      if (typeof options.onSwitchAccount === 'function') scene.actions.push({ action: 'switch-account', label: '새로 로그인', key: 'switch-account' });
    }
    return scene;
  }

  function entrySwitchScene(state) {
    const ws = state.workspace || normalizePortalWorkspaceState({});
    const names = ws.destinations.map(dest => SPACE_OF_DEST[dest]).filter(Boolean)
      .map(name => ({ space: name, label: SPACE_LABEL[name], desc: SPACE_DESC[name], current: false }));
    const showRetry = ws.status !== 'resolved' || ws.destinations.length === 0 || workspaceNeedsRetry;
    const actions = [];
    if (ws.canContinuePersonal !== false) actions.push({ action: 'continue-personal', label: '솔리오로' });
    if (ws.canSwitchAccount && typeof options.onSwitchAccount === 'function') actions.push({ action: 'workspace-switch-account', label: '다른 계정으로' });
    if (showRetry) actions.push({ action: 'retry-workspace', label: ws.status === 'popup_blocked' ? '확인 창 열기' : '다시 확인' });
    return { kind: 'entry', names, lead: workspaceLead(ws), error: feedback.workspace, actions, foot: [], showClose: false, status: ws.status };
  }

  function appSwitchScene(state) {
    const names = ['solio', ...assignedFor(state)].map(name => ({ space: name, label: SPACE_LABEL[name], desc: SPACE_DESC[name], current: name === space }));
    const signedIn = memberShown(state);
    const foot = signedIn
      ? [{ action: 'account', label: '계정' }, { action: 'settings', label: '설정' }, { action: 'logout', label: '로그아웃' }]
      : [{ action: 'settings', label: '설정' }];
    return { kind: 'app', names, lead: '', error: feedback.switch, actions: [], foot, showClose: true };
  }

  /* 「누구로 보이나」의 기준이다. 들어온 회원이 토큰을 갱신하거나 재시도할 수 있는 연결 오류를 겪는 동안에도,
   * 같은 계정이 남아 있으면 회원으로 본다. 그렇지 않으면 솔리오 첫 화면이 손님 문장으로 바뀌고 줄이 사라진다(최종 검수).
   * 「지금 구독을 읽을 수 있나」는 따로 본다(solioReadable). 본체가 signed-in일 때만 읽어 주기 때문이다(다시 검수 -c) */
  function memberShown(state) {
    if (state.authStatus === 'signed-in') return true;
    if (enteredAs !== 'signed-in' || !state.accountKey) return false;
    return isAuthPendingStatus(state.authStatus) || (state.authStatus === 'error' && state.retryable !== false);
  }
  /* 본체(main.cjs subscriptionCall)는 계정 상태가 signed-in이 아니면 구독 호출을 모두 SIGN_IN_REQUIRED로 거절한다. 그 관문을 그대로 따른다 */
  function solioReadable(state) {
    return state.authStatus === 'signed-in';
  }

  function assignedFor(state) {
    return state.accountKey && assignedAccount === state.accountKey ? assigned : [];
  }

  function solioScene(state) {
    const signedIn = memberShown(state);
    // 회원으로 보이지만 아직 읽을 수 없으면 기다린다. 갱신 중에는 조용히, 오류 중에는 그렇다고 말한다(다시 검수 -c).
    // 다시 확인하는 동안(갱신 상태로 잠깐 바뀌어도) 오류 문장을 지킨다(설계 검토 3차 P2-1). 지난 확인 횟수로는 정하지 않는다.
    // 지난 횟수가 남으면 다음 평범한 갱신에도 오류 문장이 떴다(다시 검수 -e · -f)
    const waiting = signedIn && !sol.snapshot && !solioReadable(state)
      ? (state.authStatus === 'error' || sol.authChecking ? 'error' : 'pending')
      : null;
    const today = solioToday({
      native: Boolean(subs),
      signedIn,
      waiting,
      authChecking: sol.authChecking,
      snapshot: sol.snapshot,
      error: sol.error,
      checking: sol.checking,
      rereadFailed: sol.rereadFailed,
    }, now());
    // 구독 줄 아래에 종류가 다른 줄을 붙인다(2단계 둘째 조각 설계 2절 · 3절). 요금 줄은 구독 줄이 하나라도 있을 때만 서고,
    // 모델별 토큰 줄은 볼 계정이면 구독이 없어도 선다(이 PC의 기록으로 센다, 설계 3.4)
    const extra = signedIn && sol.snapshot ? [today.rows?.length ? rooms.costRow() : null, rooms.tokRow()].filter(Boolean) : [];
    return { ...today, extra, rereading: sol.checking || Boolean(sol.snapshot?.checking) };
  }

  /* 이 계정이 볼 수 있는 방문자 분석. 그 계정이 받은 답만 쓴다. 다른 계정의 답이나 회원이 아닐 때는 보이지 않는다 */
  function visitsScene(state) {
    if (!visitsApi || !memberShown(state) || !state.accountKey || vis.account !== state.accountKey) return { visible: false };
    return siteVisitsView(vis.result, now());
  }
  /* 오브제 줄. 방문자 분석을 볼 계정에게만 있다. 볼 계정인지는 솔리오가 열릴 때 한 번 읽어 정하고, 답이 오기 전에는 줄을 두지 않는다 */
  function programsFor(state, visits) {
    if (!memberShown(state) || !visits.visible) return [];
    return SOLIO_PROGRAMS.map(p => ({ ...p }));
  }

  function roomScene(state) {
    if (space === 'solio') {
      const visits = visitsScene(state);
      const programs = programsFor(state, visits);
      const at = programs.some(p => p.key === prog) ? prog : 'subs';
      return { space, solio: solioScene(state), prog: at, programs, visits };
    }
    const copy = SPACE_ROOM[space];
    return { space, say: copy.say, then: copy.then, action: typeof options.onOpenSpace === 'function' ? { action: 'reopen-space', label: '다시 열기' } : null, error: feedback.switch };
  }

  function placesFor(state, mode) {
    if (!look.places) return [];
    if (mode === 'portal') {
      // 개인 공간으로 이어 갈 수 없으면 솔리오 고리를 새기지 않는다(0.4.95 원천 후보 검수 B3)
      if (state.phase === 'workspace' && state.workspace) return [...(state.workspace.canContinuePersonal !== false ? ['solio'] : []), ...state.workspace.destinations.map(d => SPACE_OF_DEST[d]).filter(Boolean)];
      return [];
    }
    return ['solio', ...assignedFor(state)];
  }

  function wantedPose(state, mode) {
    if (mode === 'portal') {
      const { phase } = state;
      if (phase === 'auth' || phase === 'signing-in' || phase === 'invite' || phase === 'error' || phase === 'enter-error') return 'ask';
      if (phase === 'workspace') return 'sw';
      return null; // welcome · zooming · checking · entering · purpose는 구를 그 자리에 둔다
    }
    if (orbTarget === 'inside') return null; // 들어가는 길이 끝나기를 기다린다
    return switchOpen ? 'fan' : 'home';
  }

  function layerFor(state, mode) {
    if (mode === 'portal') {
      const want = wantedPose(state, mode);
      if (want === 'ask') return orbAt === 'ask' && orbTarget === 'ask' ? 'ask' : 'none';
      if (want === 'sw') return orbAt === 'sw' && orbTarget === 'sw' ? 'switch' : 'none';
      return 'none';
    }
    // 펼치는 동안에도 방은 그 자리에 있다(흐려질 뿐이다)
    return orbAt === 'home' || orbAt === 'fan' ? 'app' : 'none';
  }

  /* 내 계정 방 맨 위 문장의 이름이 아직 없을 때 쓰는 로그인 정보의 이름 */
  function roomName() { try { return trimmed(accountAdapter?.name?.()); } catch { return ''; } }

  function buildScene() {
    const state = machine.read();
    const mode = clientMode();
    const holding = state.phase === 'entered' && navigationHoldActive;
    const layer = layerFor(state, mode);
    const scene = {
      mode,
      phase: state.phase,
      authStatus: state.authStatus,
      active: state.active || holding,
      blockShortcuts: state.blockShortcuts || holding,
      workspaceStatus: state.phase === 'workspace' && state.workspace ? state.workspace.status : null,
      boot: state.phase === 'welcome',
      orbBusy: state.phase === 'checking' || state.phase === 'entering' || state.phase === 'purpose' || holding || (state.phase === 'zooming' && state.authStatus === 'signed-in'),
      busy: busyAction !== null,
      busyAction,
      layer,
      places: placesFor(state, mode),
      space,
      spaceLabel: SPACE_LABEL[space],
      ask: askScene(state),
      switch: mode === 'portal' && state.phase === 'workspace' ? entrySwitchScene(state) : null,
      fan: mode === 'portal' ? null : { ...appSwitchScene(state), open: switchOpen, pin: fanPin },
      room: mode === 'portal' ? null : roomScene(state),
      aside: mode === 'portal' ? null : aside,
      rooms: mode === 'portal' || !aside ? null : rooms.scene({ aside, checking: sol.checking, name: roomName(), accountKey: state.accountKey || '' }),
      legacy: legacyKind,
      focus: focusKey,
      focusSeq,
    };
    return scene;
  }

  function render() {
    if (disposed) return;
    const state = machine.read();
    if (state.phase !== 'entered' && navigationHoldActive) navigationHoldActive = false;
    if (state.phase !== lastPhase) {
      if (state.phase === 'auth' || state.phase === 'signing-in') freshSignIn = true;
      onPhaseChange(state, lastPhase);
      lastPhase = state.phase;
    }
    ensureOrb(state);
    const scene = buildScene();
    view.render(scene);
    const announced = `${scene.active}|${scene.phase}|${scene.mode}`;
    if (announced !== lastAnnounced) {
      lastAnnounced = announced;
      const detail = { active: scene.active, blockShortcuts: scene.blockShortcuts, phase: scene.phase, authStatus: scene.authStatus, mode: scene.mode };
      try { options.onActiveChange?.(scene.active, detail); } catch { /* 호스트의 일이다 */ }
      view.emitState?.(detail);
    }
    syncClock(scene);
    syncAuthRecheck(scene);
    // 모델별 토큰의 실시간은 구독 방이 보이고 그 줄이 열려 있는 동안만 부탁한다(설계 검토 D8)
    rooms.syncLive(scene.mode === 'app' && scene.layer === 'app' && space === 'solio' && scene.room?.prog === 'subs' && !aside && !isHidden());
  }

  function onPhaseChange(state, prev) {
    const { phase } = state;
    if (phase === 'welcome') focus('wake');
    else if (phase === 'auth') focus(prev === 'invite' ? 'code' : (state.authStatus === 'unconfigured' ? 'code' : 'signin'));
    else if (phase === 'signing-in') focus('cancel');
    else if (phase === 'workspace') focus('first-name');
    else if (phase === 'error' || phase === 'enter-error') focus('retry');
    else if (phase === 'checking' || phase === 'entering' || phase === 'purpose' || phase === 'entered') focus('root');
    else if (phase === 'invite') focus('cancel');
  }

  /* ── 구의 움직임 ── */
  function queue(job) {
    const gen = orbGen;
    const run = chain.then(() => (disposed || gen !== orbGen ? null : job(gen))).catch(() => null);
    chain = run;
    return run;
  }
  function resetOrbQueue() { orbGen += 1; }
  const current = gen => !disposed && gen === orbGen;

  function moveTo(pose, ms, ease) {
    orbTarget = pose;
    return queue(async gen => {
      await view.move(pose, { ms, ease, face: pose === 'sw' ? switchFace() : null });
      if (!current(gen)) return;
      orbAt = pose;
      render();
    });
  }
  function switchFace() {
    const state = machine.read();
    if (clientMode() === 'portal' && state.phase === 'workspace') {
      const first = state.workspace?.destinations?.map(d => SPACE_OF_DEST[d]).find(Boolean);
      return first || 'solio';
    }
    return space;
  }
  function moveDuration(from, to) {
    if (to === 'ask') return from === 'rest' || from === 'void' ? [ORB_TIMING.zoom, 'ioq'] : [ORB_TIMING.toAsk, 'io'];
    if (to === 'sw') return [ORB_TIMING.sw, 'io'];
    if (to === 'fan') return [ORB_TIMING.fan, 'out'];
    if (to === 'home' && from === 'fan') return [ORB_TIMING.fanClose, 'io'];
    if (to === 'home') return [ORB_TIMING.swClose, 'io'];
    return [ORB_TIMING.swClose, 'io'];
  }
  function ensureOrb(state) {
    const mode = clientMode();
    const want = wantedPose(state, mode);
    if (!want || want === orbTarget) return;
    // 첫 구가 드러나는 중이면 queue가 그 뒤에 움직인다
    const [ms, ease] = moveDuration(orbTarget, want);
    void moveTo(want, ms, ease);
  }

  /* 본체(PC 앱)가 드러남을 정했으면(시작 창이 먼저 그리던 드러남) 그 시각과 종류를 따른다. 없으면 이 화면이 정한다 */
  async function bootInfo() {
    try { const info = await options.orbBoot?.(); return info && Number.isFinite(info.startedAt) ? info : null; } catch { return null; }
  }
  function startIntro() {
    orbTarget = 'rest';
    void queue(async gen => {
      const info = await bootInfo();
      if (!current(gen)) return;
      const kind = info?.kind === 'first' || info?.kind === 'back' ? info.kind : (returning ? 'back' : 'first');
      await view.intro(kind, { delay: ORB_TIMING.introDelay[kind], ms: ORB_TIMING.intro[kind], asleepAt: ORB_TIMING.eyesAsleep[kind], wakeAt: ORB_TIMING.eyesWake[kind], startedAt: info?.startedAt ?? null });
      if (!current(gen)) return;
      introDone = true;
      orbAt = 'rest';
      render();
      scheduleAutoZoom();
    });
  }

  function restoreSettled(state) {
    return !isAuthPendingStatus(state.authStatus) && state.authStatus !== 'signing-in';
  }
  /* 손님에게만 구가 스스로 커진다. 복원 결과가 signed-out · unconfigured · error로 나온 뒤에만 센다 */
  function scheduleAutoZoom() {
    if (disposed || !introDone || autoZoomTimer !== null) return;
    const state = machine.read();
    if (state.phase !== 'welcome' || !restoreSettled(state) || state.authStatus === 'signed-in') return;
    // 움직임 줄이기에서는 기다림도 0.12초로 줄인다(설계 13절, 시안 그대로)
    const wait = hurried ? 0 : prefersReducedMotion() ? Math.min(ORB_TIMING.askWait, 120) : ORB_TIMING.askWait;
    autoZoomTimer = setTimer(() => { autoZoomTimer = null; activateOrb(); }, wait);
  }
  function cancelAutoZoom() { if (autoZoomTimer !== null) { clearTimer(autoZoomTimer); autoZoomTimer = null; } }

  function activateOrb() {
    if (disposed) return;
    cancelAutoZoom();
    const state = machine.read();
    if (state.phase !== 'welcome') return;
    // 복원 결과가 나오기 전에 누르면 커지지 않고 확인 단계(글 없음)에 머문다
    const immediate = isImmediateEntry() || !restoreSettled(state);
    const result = machine.activateOrb({ immediate });
    if (!result.changed) return;
    if (result.shouldStartZoom) { startZoom(); return; }
    render();
    if (result.shouldTriggerEnter) void triggerEnter();
  }

  function startZoom() {
    orbTarget = 'ask';
    render();
    void queue(async gen => {
      await view.move('ask', { ms: ORB_TIMING.zoom, ease: 'ioq' });
      if (!current(gen)) return;
      orbAt = 'ask';
      const result = machine.completeZoom();
      render();
      if (result.shouldTriggerEnter) void triggerEnter();
    });
  }

  function wake() {
    if (disposed) return;
    const state = machine.read();
    if (state.phase !== 'welcome') return;
    hurried = true;
    view.hurryIntro?.();
    if (!restoreSettled(state)) { activateOrb(); return; }
    if (autoZoomTimer !== null) { cancelAutoZoom(); activateOrb(); return; }
    if (introDone) activateOrb();
  }

  /* 구가 그 공간의 자리로 들어가고, 점 로고가 맞춰진 뒤 왼쪽 위의 작은 구가 된다 */
  function enterSpace(target, { fromSwitch = false } = {}) {
    space = SPACE_LABEL[target] ? target : 'solio';
    switchOpen = false;
    legacyKind = null;
    if (aside) { aside = null; rooms.close(); }
    feedback.switch = '';
    const kind = fromSwitch || !freshSignIn ? 'quick' : 'full';
    orbTarget = 'inside';
    render();
    if (space === 'solio') syncVisits();
    void queue(async gen => {
      await view.dive(space, kind === 'quick' ? ORB_TIMING.diveQuick : ORB_TIMING.dive);
      if (!current(gen)) return;
      orbAt = 'inside';
      if (navigationHoldActive) { render(); return; } // 목적지가 열릴 때까지 구를 붙잡아 둔다
      await arrive(gen, kind);
    });
  }
  async function arrive(gen, kind) {
    await view.arrive(space, look.signature ? kind : null, { smile: kind === 'full' });
    if (!current(gen)) return;
    orbAt = 'home';
    orbTarget = 'home';
    freshSignIn = false;
    // 계정으로 들어온 회원이면(토큰 갱신 중에 들어와도) 다음에 켤 때 빠른 길을 탄다. 회원 판정과 같은 기준이다
    if (enteredAs === 'signed-in') writeStorage(storage, ORB_RETURNING_KEY, '1');
    focus('here');
    render();
    if (space === 'solio') startSolio({ arriving: true });
  }

  /* ── 실행 번호와 계정 결속(지금 얼굴과 같다) ── */
  function isRunValid(runId, startGen) {
    if (disposed || runId !== asyncSeq) return false;
    const currentGen = machine.read().generation;
    if (startGen !== null && currentGen !== null && currentGen !== startGen) return false;
    return true;
  }
  function isEnterRunValid(runId, startGen, startAccountKey) {
    if (disposed || runId !== asyncSeq) return false;
    const cur = machine.read();
    if (cur.phase !== 'entering') return false;
    if (startAccountKey !== null) return cur.accountKey === startAccountKey;
    if (startGen !== null && cur.generation !== null && cur.generation !== startGen) return false;
    return true;
  }
  function buildPurposeContext(snap) {
    const origin = snap.purposeOrigin || (snap.enteredOnce ? 'manual' : 'browse');
    return {
      origin,
      purposeMode: origin === 'entering' ? (snap.purposeMode || 'onboarding') : null,
      returnPhase: snap.purposeReturnPhase || null,
      generation: snap.generation,
      accountKey: origin === 'entering' ? snap.purposeAccountKey : snap.accountKey,
    };
  }
  function isPurposeRunValid(runId, context) {
    if (disposed || runId !== asyncSeq) return false;
    const cur = machine.read();
    if (cur.phase !== 'purpose' || cur.purposeOrigin !== context.origin) return false;
    if (context.origin === 'entering') {
      if (!context.accountKey) return false;
      if ((cur.purposeMode || 'onboarding') !== (context.purposeMode || 'onboarding')) return false;
      return cur.purposeAccountKey === context.accountKey && cur.accountKey === context.accountKey;
    }
    if (context.accountKey !== null && cur.accountKey !== context.accountKey) return false;
    return true;
  }
  function buildWorkspaceContext(snap) {
    return { generation: snap.generation, accountKey: snap.workspaceAccountKey || snap.accountKey, workspace: snap.workspace, state: snap };
  }
  function isWorkspaceRunValid(runId, context) {
    if (disposed || runId !== asyncSeq) return false;
    const cur = machine.read();
    if (cur.phase !== 'workspace' || !context.accountKey) return false;
    return cur.workspaceAccountKey === context.accountKey && cur.accountKey === context.accountKey;
  }
  function clearFeedback() { feedback.auth = ''; feedback.note = ''; feedback.inviteError = ''; feedback.inviteStatus = ''; feedback.workspace = ''; }

  function rememberAssigned(destinations, accountKey) {
    const list = (Array.isArray(destinations) ? destinations : []).map(d => SPACE_OF_DEST[normalizePortalWorkspaceDestination(d)]).filter(Boolean);
    assigned = [...new Set(list)];
    assignedAccount = accountKey || null;
  }

  /* 들어간 공간을 이 계정의 배정 기억에 더한다. 「다시 확인」, 호스트의 진입 마침, 로그인한 채 받은 초대로 들어가도
   * 공간 고르기와 「다시 열기」가 그 공간을 안다(검수 A1). 순서는 늘 Workspace, PULSE다 */
  function mergeAssigned(destinations, accountKey) {
    if (!accountKey) return;
    const add = (Array.isArray(destinations) ? destinations : []).map(d => SPACE_OF_DEST[normalizePortalWorkspaceDestination(d)]).filter(Boolean);
    if (!add.length) return;
    const have = new Set([...(assignedAccount === accountKey ? assigned : []), ...add]);
    assigned = ['workspace', 'pulse'].filter(name => have.has(name));
    assignedAccount = accountKey;
  }

  /* 목적지 결과를 받은 뒤 들어간다. 호스트가 열겠다고만 답하면(navigationRequested) 들어간 채로 구를 붙잡아 둔다 */
  function completeEntryWith(result, { fromSwitch = false } = {}) {
    navigationHoldActive = result?.navigationRequested === true;
    const target = SPACE_OF_DEST[normalizePortalWorkspaceDestination(result?.destination)] || 'solio';
    const snap = machine.read();
    mergeAssigned([...(Array.isArray(result?.destinations) ? result.destinations : []), result?.destination], snap.accountKey);
    view.setInviteValue?.('');
    machine.completeEnter();
    enteredAs = enteredKind(snap);
    enterSpace(target, { fromSwitch });
  }

  async function triggerEnter() {
    if (disposed || busyAction !== null) return;
    if (typeof options.onEnter !== 'function') {
      machine.failEnter('들어갈 공간을 여는 동작이 설정되지 않았습니다.');
      render();
      return;
    }
    const snapshotAtStart = machine.read();
    const runId = ++asyncSeq;
    const startGen = snapshotAtStart.generation;
    const startAccountKey = snapshotAtStart.accountKey;
    busyAction = 'enter';
    render();
    let after = null;
    try {
      const result = await options.onEnter({ generation: startGen, accountKey: startAccountKey, state: snapshotAtStart });
      if (!isEnterRunValid(runId, startGen, startAccountKey)) return;
      if (result && result.ok === false) {
        machine.failEnter(trimmed(result.message) || '배정된 공간을 열지 못했습니다. 다시 시도해 주세요.');
      } else if (result && (result.action === 'workspace' || (result.workspace && typeof result.workspace === 'object'))) {
        workspaceNeedsRetry = false;
        clearFeedback();
        const moved = machine.enterToWorkspace(result.workspace || {});
        if (!moved.ok) machine.failEnter('공간 정보를 보이지 못했습니다. 다시 시도해 주세요.');
        else rememberAssigned(moved.state.workspace?.destinations, startAccountKey);
      } else if (result && result.action === 'purpose') {
        workspaceNeedsRetry = false;
        clearFeedback();
        rememberAssigned([], startAccountKey);
        const mode = result.purposeMode === 'existing' ? 'existing' : 'onboarding';
        const moved = machine.enterToPurpose({ mode });
        if (!moved.ok) {
          if (mode === 'existing') machine.failEnter('계정 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.');
          else after = () => completeEntryWith({});
        } else {
          after = () => runEnterDefault();
        }
      } else {
        workspaceNeedsRetry = false;
        rememberAssigned(result?.destinations || (result?.destination ? [result.destination] : []), startAccountKey);
        after = () => completeEntryWith(result);
      }
    } catch (err) {
      if (!isEnterRunValid(runId, startGen, startAccountKey)) return;
      machine.failEnter(trimmed(err?.userMessage) || '배정된 공간을 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      if (runId === asyncSeq) busyAction = null;
    }
    if (disposed) return;
    if (after) after();
    else render();
  }

  /* 고르기 화면 없이 솔리오로 간다. 온보딩이 남은 계정이면 호스트가 not-asked를 남긴다(설계 7절) */
  async function runEnterDefault() {
    if (disposed || busyAction !== null) return;
    const snap = machine.read();
    if (snap.phase !== 'purpose' || snap.purposeOrigin !== 'entering') return;
    const context = buildPurposeContext(snap);
    if (!context.accountKey || context.generation === null || snap.accountKey !== context.accountKey) {
      machine.failEnter('계정 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.');
      render();
      return;
    }
    const handler = typeof options.onEnterDefault === 'function'
      ? options.onEnterDefault
      : (typeof options.onSelectPurpose === 'function' ? ctx => options.onSelectPurpose('solio', ctx) : null);
    if (!handler) { completeEntryWith({}); return; }
    const runId = ++asyncSeq;
    busyAction = 'purpose';
    render();
    let result;
    try {
      result = await handler(context);
    } catch {
      result = { ok: false, message: '솔리오를 열지 못했습니다. 다시 시도해 주세요.' };
    } finally {
      if (runId === asyncSeq) busyAction = null;
    }
    if (!isPurposeRunValid(runId, context)) { if (!disposed) render(); return; }
    if (result && result.ok === false) {
      machine.failEnter(trimmed(result.message) || '솔리오를 열지 못했습니다. 다시 시도해 주세요.');
      render();
      return;
    }
    completeEntryWith({});
  }

  async function runSelectWorkspace(destination) {
    const dest = normalizePortalWorkspaceDestination(destination);
    if (disposed || busyAction !== null || !dest) return false;
    const snap = machine.read();
    if (snap.phase !== 'workspace' || !snap.workspace?.destinations?.includes(dest)) return false;
    if (!snap.accountKey || snap.generation === null || snap.workspaceAccountKey !== snap.accountKey) {
      feedback.workspace = '계정 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
      render();
      return false;
    }
    if (typeof options.onSelectWorkspace !== 'function') { completeEntryWith({ destination: dest }); return true; }
    clearFeedback();
    const context = buildWorkspaceContext(snap);
    const runId = ++asyncSeq;
    busyAction = 'select-workspace';
    render();
    let after = null;
    try {
      const result = await options.onSelectWorkspace(dest, context);
      if (!isWorkspaceRunValid(runId, context)) return false;
      if (result && result.ok === false) {
        workspaceNeedsRetry = true;
        if (result.workspace && typeof result.workspace === 'object') machine.updateWorkspace(result.workspace, { accountKey: context.accountKey });
        feedback.workspace = faceSentence(result.message) || '고른 공간을 열지 못했습니다. 다시 확인한 뒤 시도해 주세요.';
        return false;
      }
      workspaceNeedsRetry = false;
      after = () => completeEntryWith({ ...result, destination: result?.destination || dest });
      return true;
    } catch {
      if (!isWorkspaceRunValid(runId, context)) return false;
      workspaceNeedsRetry = true;
      feedback.workspace = '고른 공간을 열지 못했습니다. 다시 확인한 뒤 시도해 주세요.';
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) { if (after) after(); else render(); }
    }
  }

  async function runRetryWorkspace() {
    if (disposed || busyAction !== null) return false;
    const snap = machine.read();
    if (snap.phase !== 'workspace') return false;
    const handler = typeof options.onRetryWorkspace === 'function' ? options.onRetryWorkspace : options.onEnter;
    if (typeof handler !== 'function') return false;
    if (!snap.accountKey || snap.generation === null || snap.workspaceAccountKey !== snap.accountKey) {
      feedback.workspace = '계정 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
      render();
      return false;
    }
    clearFeedback();
    const context = buildWorkspaceContext(snap);
    const runId = ++asyncSeq;
    busyAction = 'retry-workspace';
    render();
    let after = null;
    try {
      const result = await handler(context);
      if (!isWorkspaceRunValid(runId, context)) return false;
      if (result && result.ok === false) {
        if (result.workspace && typeof result.workspace === 'object') machine.enterToWorkspace(result.workspace);
        feedback.workspace = faceSentence(result.message) || '공간을 다시 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
        return false;
      }
      if (result && (result.action === 'workspace' || (result.workspace && typeof result.workspace === 'object'))) {
        workspaceNeedsRetry = false;
        const moved = machine.enterToWorkspace(result.workspace || {});
        if (moved.ok) { rememberAssigned(moved.state.workspace?.destinations, context.accountKey); focus('first-name'); }
        return true;
      }
      if (result && result.action === 'purpose') {
        workspaceNeedsRetry = false;
        // 배정 공간이 없다고 확인됐으니 앞에서 기억한 공간을 비운다(첫 진입과 같다, 0.4.95 원천 후보 검수 B5)
        rememberAssigned([], context.accountKey);
        const mode = result.purposeMode === 'existing' ? 'existing' : 'onboarding';
        const moved = machine.workspaceToPurpose({ mode, returnToWorkspace: false });
        if (!moved.ok) {
          if (mode === 'existing') { feedback.workspace = '계정 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.'; return false; }
          after = () => completeEntryWith({});
        } else {
          after = () => runEnterDefault();
        }
        return true;
      }
      workspaceNeedsRetry = false;
      after = () => completeEntryWith(result);
      return true;
    } catch {
      if (!isWorkspaceRunValid(runId, context)) return false;
      feedback.workspace = '공간을 다시 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) { if (after) after(); else render(); }
    }
  }

  async function runContinuePersonal() {
    if (disposed || busyAction !== null) return false;
    const snap = machine.read();
    if (snap.phase !== 'workspace' || snap.workspace?.canContinuePersonal === false) return false;
    if (!snap.accountKey || snap.generation === null || snap.workspaceAccountKey !== snap.accountKey) {
      feedback.workspace = '계정 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
      render();
      return false;
    }
    clearFeedback();
    if (typeof options.onContinuePersonal !== 'function') { completeEntryWith({}); return true; }
    const context = buildWorkspaceContext(snap);
    const runId = ++asyncSeq;
    busyAction = 'continue-personal';
    render();
    let after = null;
    try {
      const result = await options.onContinuePersonal(context);
      if (!isWorkspaceRunValid(runId, context)) return false;
      if (result && result.ok === false) {
        feedback.workspace = faceSentence(result.message) || '솔리오를 열지 못했습니다. 다시 시도해 주세요.';
        return false;
      }
      workspaceNeedsRetry = false;
      if (result && result.action === 'purpose') {
        const mode = result.purposeMode === 'existing' ? 'existing' : 'onboarding';
        const moved = machine.workspaceToPurpose({ mode, returnToWorkspace: false });
        if (!moved.ok) {
          if (mode === 'existing') { feedback.workspace = '계정 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.'; return false; }
          after = () => completeEntryWith({});
        } else {
          after = () => runEnterDefault();
        }
        return true;
      }
      after = () => completeEntryWith({});
      return true;
    } catch {
      if (!isWorkspaceRunValid(runId, context)) return false;
      feedback.workspace = '솔리오를 열지 못했습니다. 다시 시도해 주세요.';
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) { if (after) after(); else render(); }
    }
  }

  async function runSignIn() {
    if (disposed || busyAction !== null || typeof options.onSignIn !== 'function') return;
    clearFeedback();
    const runId = ++asyncSeq;
    const startGen = machine.read().generation;
    busyAction = 'signin';
    machine.beginSignIn();
    render();
    try {
      // PC 단일 로그인 계약에서는 없는 공급자 인자를 넘기지 않는다
      const result = await options.onSignIn();
      if (!isRunValid(runId, startGen)) return;
      if (result && result.ok === false) {
        machine.receiveAuth({ status: 'signed-out', generation: startGen });
        machine.showAuthPanel();
        if (result.code !== 'AUTH_CANCELLED') feedback.auth = faceSentence(result.message) || '로그인을 시작하지 못했습니다. 다시 시도해 주세요.';
      }
    } catch {
      if (!isRunValid(runId, startGen)) return;
      machine.receiveAuth({ status: 'error', generation: startGen, errorMessage: '로그인 화면을 열지 못했습니다. 잠시 뒤 다시 시도해 주세요.', retryable: false });
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  /* PC는 가입이 로그인이 아니다. 묻는 화면에 머물고 단추 아래에 한 줄을 둔다(설계 17절 3) */
  async function runSignUp() {
    if (disposed || busyAction !== null || typeof options.onSignUp !== 'function') return;
    clearFeedback();
    const runId = ++asyncSeq;
    const startGen = machine.read().generation;
    busyAction = 'signup';
    render();
    try {
      const result = await options.onSignUp();
      if (!isRunValid(runId, startGen)) return;
      if (result && result.ok === false) feedback.auth = faceSentence(result.message) || '가입 화면을 열지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
      else feedback.note = '브라우저에서 가입한 뒤 「로그인」을 눌러 주세요.';
    } catch {
      if (!isRunValid(runId, startGen)) return;
      feedback.auth = '가입 화면을 열지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  /* 검사 실행 길(설계 11절): 본체가 열어 준 때만 로그인 없이 솔리오까지 간다. 보이는 단추는 없다 */
  async function runQaGuest() {
    if (disposed || busyAction !== null) return false;
    let allowed = false;
    try { allowed = options.allowGuestEntry?.() === true; } catch { allowed = false; }
    if (!allowed || typeof options.onBrowse !== 'function') return false;
    const snap = machine.read();
    if (snap.phase !== 'auth' && snap.phase !== 'error') return false;
    clearFeedback();
    const runId = ++asyncSeq;
    const startGen = snap.generation;
    busyAction = 'browse';
    render();
    let entered = false;
    try {
      const result = await options.onBrowse();
      if (!isRunValid(runId, startGen)) return false;
      if (result && result.ok === false) { feedback.auth = faceSentence(result.message) || '화면을 열지 못했습니다. 다시 눌러 주세요.'; return false; }
      if (result && result.action === 'purpose' && typeof options.onSelectPurpose === 'function') {
        machine.openPurpose({ origin: 'browse' });
        const context = buildPurposeContext(machine.read());
        const chosen = await options.onSelectPurpose('solio', context);
        if (!isPurposeRunValid(runId, context)) return false;
        if (chosen && chosen.ok === false) { machine.closePurpose(); feedback.auth = faceSentence(chosen.message) || '화면을 열지 못했습니다. 다시 눌러 주세요.'; return false; }
      }
      machine.completeBrowse();
      enteredAs = enteredKind(machine.read());
      entered = true;
      return true;
    } catch {
      if (!isRunValid(runId, startGen)) return false;
      if (machine.read().phase === 'purpose') machine.closePurpose();
      feedback.auth = '화면을 열지 못했습니다. 다시 눌러 주세요.';
      return false;
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) { if (entered) enterSpace('solio'); else render(); }
    }
  }

  function isInviteRunValid(runId, startGen, startAccountKey) {
    if (!isRunValid(runId, startGen)) return false;
    const cur = machine.read();
    return cur.phase === 'invite' && cur.accountKey === startAccountKey;
  }

  /* 묻는 화면의 코드 칸에서 낸다. invite 단계로 들어가 그린 뒤에 onInvite를 부른다(설계 6절) */
  async function runInviteSubmit() {
    if (disposed || busyAction !== null || typeof options.onInvite !== 'function') return;
    const snap0 = machine.read();
    if (snap0.phase !== 'auth' && snap0.phase !== 'invite') return;
    feedback.inviteError = '';
    feedback.inviteStatus = '';
    feedback.note = '';
    const rawValue = String(view.getInviteValue?.() ?? '');
    if (!rawValue.trim()) { render(); return; }
    const validated = validatePortalInviteInput(rawValue);
    if (!validated.ok) {
      feedback.note = faceSentence(validated.message);
      focus('code');
      render();
      return;
    }
    if (snap0.phase !== 'invite') machine.openInvite();
    const snapAtStart = machine.read();
    if (snapAtStart.phase !== 'invite') { render(); return; }
    const runId = ++asyncSeq;
    const startGen = snapAtStart.generation;
    const startAccountKey = snapAtStart.accountKey;
    busyAction = 'invite';
    render();
    let after = null;
    try {
      const result = await options.onInvite(validated.value, { kind: validated.kind, pathname: validated.pathname });
      if (!isInviteRunValid(runId, startGen, startAccountKey)) return;
      if (result && result.ok === false) {
        if (view.getInviteValue?.() !== rawValue) view.setInviteValue?.(rawValue);
        feedback.inviteError = sanitizeInviteFeedback(result.message, rawValue, validated.value) || '이 초대코드를 확인하지 못했습니다. 받은 코드를 다시 붙여 넣어 주세요.';
        focus('retry');
        return;
      }
      view.setInviteValue?.('');
      const target = SPACE_OF_DEST[normalizePortalWorkspaceDestination(result?.destination)] || null;
      if (result?.keepOpen !== true && machine.read().authStatus === 'signed-in' && target) {
        after = () => completeEntryWith({ destination: result.destination });
        return;
      }
      // 손님의 초대가 받아지면 구 안으로 들어가지 않고 한 줄로 남는다(설계 17절 2)
      feedback.inviteStatus = '초대받은 공간을 열었습니다. 열린 창에서 이어 가 주세요.';
      focus('back');
    } catch {
      if (!isInviteRunValid(runId, startGen, startAccountKey)) return;
      if (view.getInviteValue?.() !== rawValue) view.setInviteValue?.(rawValue);
      feedback.inviteError = '초대코드를 확인하지 못했습니다. 잠시 뒤 다시 넣어 주세요.';
      focus('retry');
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) { if (after) after(); else render(); }
    }
  }

  /* 「취소」, 「다시 시도」, 「돌아가기」. 「다시 시도」는 넣었던 코드를 골라 둔 채 남긴다(설계 17절 4) */
  function closeInvite() {
    if (disposed || machine.read().phase !== 'invite') return;
    const hadBusyInvite = busyAction === 'invite';
    const wasError = Boolean(feedback.inviteError);
    const wasDone = Boolean(feedback.inviteStatus);
    if (hadBusyInvite) { asyncSeq += 1; busyAction = null; }
    feedback.inviteError = '';
    feedback.inviteStatus = '';
    if (wasDone) view.setInviteValue?.('');
    machine.closeInvite();
    if (hadBusyInvite) options.onCancelInvite?.();
    render();
    // 단계가 바뀌며 정한 초점(code) 뒤에 덮어쓴다. 오류 뒤에는 넣었던 코드를 골라 둔다
    focus(wasError ? 'code-select' : 'code');
    render();
  }

  async function runRetryAuth() {
    if (disposed || busyAction !== null || typeof options.onRetry !== 'function') return;
    const runId = ++asyncSeq;
    const startGen = machine.read().generation;
    busyAction = 'retry';
    machine.beginRetryCheck();
    render();
    try {
      const result = await options.onRetry();
      if (!isRunValid(runId, startGen)) return;
      if (result && result.ok === false) {
        machine.receiveAuth({ status: 'error', generation: machine.read().generation, errorMessage: trimmed(result.message) || '저장된 로그인을 다시 확인하지 못했습니다.', retryable: true, immediate: isImmediateEntry() });
      }
    } catch {
      if (!isRunValid(runId, startGen)) return;
      machine.receiveAuth({ status: 'error', generation: machine.read().generation, errorMessage: '네트워크 연결을 확인한 뒤 다시 눌러 주세요.', retryable: true, immediate: isImmediateEntry() });
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runCancelSignIn() {
    if (disposed || typeof options.onCancelSignIn !== 'function') return;
    const runId = ++asyncSeq;
    busyAction = 'cancel';
    render();
    try {
      await options.onCancelSignIn();
      if (disposed || runId !== asyncSeq) return;
      machine.receiveAuth({ status: 'signed-out', generation: machine.read().generation });
      machine.showAuthPanel();
    } catch {
      // 취소에 실패하면 호스트의 다음 상태 알림을 기다린다
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  async function runSwitchAccount() {
    if (disposed || busyAction !== null || typeof options.onSwitchAccount !== 'function') return;
    const runId = ++asyncSeq;
    busyAction = 'switch';
    render();
    try {
      await options.onSwitchAccount();
      if (disposed || runId !== asyncSeq) return;
      workspaceNeedsRetry = false;
      leaveToAsk({ status: 'signed-out' });
    } catch {
      // 바꾸지 못하면 지금 화면을 지킨다
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
  }

  /* ── 들어온 뒤 ── */
  /* 구 곁의 펼침을 연다. pin이면 눌러서(자판 포함) 연 것이다. 옛 화면이 열려 있으면 조용히 닫고 방으로 돌아와 고정해 연다(설계 검토 1차 2) */
  function openSwitch({ pin = true } = {}) {
    if (disposed || clientMode() === 'portal' || busyAction !== null) return;
    if (legacyKind) { closeLegacy({ silent: true }); pin = true; }
    if (switchOpen) { if (pin && !fanPin) { fanPin = true; render(); } return; }
    switchOpen = true;
    fanPin = pin;
    feedback.switch = '';
    render();
  }
  /* 누르면: 닫혀 있으면 고정해 열고, 다가가서 열린 것이면 고정하고, 고정해 둔 것이면 닫는다(시안 toggleFan) */
  function toggleSwitch() {
    if (switchOpen && fanPin && !legacyKind) closeSwitch();
    else openSwitch({ pin: true });
  }
  /* focusHere: Esc로 닫을 때만 초점을 구 단추에 둔다(설계 검토 1차 1). 손이 떠나 닫힐 때는 초점을 옮기지 않는다 */
  function closeSwitch({ focusHere = false, unpinnedOnly = false } = {}) {
    // 다른 공간을 여는 동안에는 닫지 않는다. 닫으면 그 공간의 실패 글이 지금 방에 떴다(0.4.95 원천 후보 검수 D2)
    if (!switchOpen || busyAction === 'open-space') return;
    if (unpinnedOnly && fanPin) return;
    switchOpen = false;
    fanPin = false;
    feedback.switch = '';
    if (focusHere) focus('here');
    render();
  }

  async function runOpenSpace(target, { reopen = false } = {}) {
    if (disposed || busyAction !== null) return;
    const dest = DEST_OF_SPACE[target];
    if (!dest || typeof options.onOpenSpace !== 'function') return;
    const snap = machine.read();
    if (!assignedFor(snap).includes(target)) return; // 배정에 없는 곳은 열지 않는다
    const context = { generation: snap.generation, accountKey: snap.accountKey, state: snap };
    const runId = ++asyncSeq;
    busyAction = 'open-space';
    feedback.switch = '';
    render();
    let result;
    try {
      result = await options.onOpenSpace(dest, context);
    } catch {
      result = { ok: false };
    } finally {
      if (runId === asyncSeq) busyAction = null;
    }
    if (disposed || runId !== asyncSeq) return;
    if (machine.read().accountKey !== context.accountKey) { render(); return; }
    if (result && result.ok === false) {
      feedback.switch = faceSentence(result.message) || '그 공간을 열지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
      render();
      return;
    }
    if (reopen && space === target) { render(); return; }
    enterSpace(target, { fromSwitch: true });
  }

  function go(target) {
    if (disposed || busyAction !== null) return;
    if (clientMode() === 'portal') {
      // 진입 공간 고르기의 솔리오는 「솔리오로」(개인 공간으로 이어 가기)와 같다. 배정 공간만 runSelectWorkspace로 연다(0.4.95 원천 후보 검수 B3)
      if (target === 'solio') { if (machine.read().workspace?.canContinuePersonal !== false) void runContinuePersonal(); return; }
      if (DEST_OF_SPACE[target]) void runSelectWorkspace(DEST_OF_SPACE[target]);
      return;
    }
    // 펼침에서 공간을 고르면 열려 있던 방을 닫는다. 지금 공간을 고르면 그 공간의 첫 화면으로 돌아온다
    if (aside) { aside = null; rooms.close(); if (target === space) focus('here'); }
    if (target === space) { if (switchOpen) closeSwitch(); else render(); return; }
    if (target === 'solio') { enterSpace('solio', { fromSwitch: true }); return; }
    void runOpenSpace(target);
  }

  function openLegacy(kind, extra) {
    if (disposed || typeof options.onOpenLegacy !== 'function' || clientMode() === 'portal') return;
    // 먼저 옛 화면 모습(legacy)으로 바꿔 옛 런처의 잠금을 푼 뒤 연다. 그래야 옛 런처가 그 보기 제목으로 초점을 옮긴다(검수 A4)
    const wasSwitch = switchOpen;
    switchOpen = false;
    fanPin = false;
    legacyKind = kind;
    focus('legacy');
    render();
    try { options.onOpenLegacy(kind, extra); } catch { legacyKind = null; switchOpen = wasSwitch; render(); }
  }
  function closeLegacy({ silent = false } = {}) {
    if (!legacyKind) return;
    const kind = legacyKind;
    legacyKind = null;
    try { options.onCloseLegacy?.(kind); } catch { /* 옛 런처의 일이다 */ }
    // 방에서 연 옛 화면(마을 기록)이면 그 방으로 돌아오고, 초점은 옛 화면을 연 단추로 간다(설계 9.1)
    if (!silent) { focus(aside ? 'legacy-return' : 'here'); render(); }
  }

  /* 방을 연다(설계 9.3). 펼침이 열려 있으면 닫고, 옛 화면이 열려 있으면 조용히 닫는다. 초점은 방 맨 위 문장에 둔다 */
  function openAside(name, { svc = null } = {}) {
    if (disposed || clientMode() === 'portal' || busyAction !== null || !ASIDE_ROOMS.includes(name)) return;
    // 내 계정 방은 회원에게만 있다(손님의 펼침에는 「계정」이 없다)
    if (name === 'account' && (!rooms.hasAccount() || !memberShown(machine.read()))) return;
    switchOpen = false;
    fanPin = false;
    feedback.switch = '';
    if (legacyKind) closeLegacy({ silent: true });
    aside = name;
    rooms.open(name, { svc });
    focus('aside');
    render();
  }
  /* 방을 닫으면 있던 방으로 돌아가고, 초점은 방을 연 자리로 간다. 그 자리가 보이지 않으면 구 단추다 */
  function closeAside({ focusBack = true } = {}) {
    if (!aside) return false;
    aside = null;
    rooms.close();
    if (focusBack) focus('aside-return');
    render();
    return true;
  }

  function foot(action) {
    if (disposed || busyAction !== null) return;
    // 「계정」은 내 계정 방을 연다(2단계 둘째 조각 설계 9.3). 「설정」은 설정 방을 지을 때까지 옛 화면이다
    if (action === 'account') { if (rooms.hasAccount()) openAside('account'); else openLegacy('account'); return; }
    if (action === 'settings') { openLegacy(action); return; }
    if (action === 'logout') {
      closeSwitch();
      try { void options.onSignOut?.(); } catch { /* 옛 런처가 알림으로 알린다 */ }
    }
  }

  /* 들어온 뒤에 로그아웃되거나 계정을 바꾸면 묻는 화면으로 돌아간다(설계 10절) */
  function leaveToAsk(patch) {
    // 넣다 만 초대 원문은 다음에 앉는 사람에게 보이지 않게 비운다(최종 검수)
    view.setInviteValue?.('');
    resetOrbQueue();
    cancelAutoZoom();
    navigationHoldActive = false;
    workspaceNeedsRetry = false;
    switchOpen = false;
    fanPin = false;
    if (legacyKind) closeLegacy({ silent: true });
    aside = null;
    enteredAs = null;
    assigned = [];
    assignedAccount = null;
    stopSolio();
    stopVisits();
    prog = 'subs';
    clearFeedback();
    feedback.switch = '';
    writeStorage(storage, ORB_RETURNING_KEY, null);
    // 구는 지금 자리에서 ask로 커진다. 이어지는 render()가 움직임을 줄에 넣는다
    if (orbTarget === 'inside' || orbAt === 'void') orbAt = orbTarget = 'home';
    else orbTarget = orbAt;
    introDone = true;
    return machine.reopenAuth(patch);
  }

  function applyAuthUpdate(patch = {}) {
    if (disposed) return machine.read();
    if (typeof patch.reducedMotion === 'boolean') hostReducedMotion = patch.reducedMotion;
    const before = machine.read();
    const status = patch.status === undefined ? before.authStatus : normalizeAuthStatus(patch.status);

    // 지금 세대보다 낮은 세대의 알림은 들어온 뒤 판정보다 먼저 버린다(최종 검수)
    if (Number.isFinite(patch.generation) && Number.isFinite(before.generation) && patch.generation < before.generation) return before;
    // 들어온 뒤의 로그아웃과 계정 바뀜은 단계 기계가 받지 않으므로(406행) 얼굴이 묻는 화면으로 되돌린다
    if (before.phase === 'entered' && enteredAs !== null) {
      const signedOut = status === 'signed-out' || status === 'unconfigured';
      const incomingKey = Object.hasOwn(patch, 'accountKey') ? patch.accountKey : undefined;
      const otherAccount = status === 'signed-in' && (
        enteredAs !== 'signed-in'
        || (incomingKey !== undefined && incomingKey !== null && before.accountKey !== null && incomingKey !== before.accountKey)
      );
      if ((enteredAs === 'signed-in' && signedOut) || otherAccount) {
        if (busyAction !== null) { asyncSeq += 1; busyAction = null; }
        leaveToAsk({ status: signedOut ? status : 'signed-out', generation: patch.generation });
        if (otherAccount) return applyAuthUpdate(patch);
        render();
        return machine.read();
      }
    }

    const authPatch = {
      status: patch.status,
      generation: patch.generation,
      errorMessage: patch.errorMessage,
      retryable: patch.retryable,
      // 복원된 로그인은 구가 커지지 않고 곧장 들어간다(설계 5절 zooming 줄)
      immediate: isImmediateEntry() || (before.phase === 'welcome' && status === 'signed-in'),
    };
    if (Object.hasOwn(patch, 'accountKey')) authPatch.accountKey = patch.accountKey;
    const result = machine.receiveAuth(authPatch);
    if (!result.accepted) return result.state;
    if (navigationHoldActive && (result.state.phase !== 'entered' || result.accountChanged || result.bindingInvalidated || result.state.authStatus === 'signing-in')) {
      // 들어온 채로 놓으면 붙잡아 둔 구를 도착시킨다. 그냥 끄면 구가 안쪽에 남았다(0.4.95 원천 후보 검수 B6)
      if (result.state.phase === 'entered') releaseNavigationHold();
      navigationHoldActive = false;
    }
    if (result.accountChanged || result.bindingInvalidated || (busyAction === 'invite' && result.state.phase !== 'invite')) {
      const hadBusyInvite = busyAction === 'invite';
      if (result.accountChanged || result.bindingInvalidated) view.setInviteValue?.('');
      workspaceNeedsRetry = false;
      if (busyAction !== null) { asyncSeq += 1; busyAction = null; }
      if (hadBusyInvite) { feedback.inviteError = ''; feedback.inviteStatus = ''; options.onCancelInvite?.(); }
    }
    if (result.shouldStartZoom) { startZoom(); return machine.read(); }
    render();
    scheduleAutoZoom();
    if (result.shouldTriggerEnter && busyAction === null) void triggerEnter();
    // 솔리오에 있는 동안 계정이 돌아왔는데 자료가 그 계정 것이 아니거나, 읽을 수 있게 되었는데 아직 읽지 않았으면 읽는다(다시 검수 -b · -c, 설계 검토 3차)
    const after = machine.read();
    // 조용한 다시 확인은 계정 장애 한 번에 네 번까지다. 새 장애는 signed-in이던 계정이 우리 확인 밖에서 signed-in을 벗어날 때 시작한다.
    // signed-in 알림으로는 되돌리지 않는다. 알림마다 되돌리면 두 번 거절한 기다림에서 네 번 상한이 풀렸다(다시 검수 -e · -f).
    // 그 밖에 되돌리는 곳은 본체가 읽기를 받아 준 답, 구독 알림, 계정 정리뿐이다
    if (before.authStatus === 'signed-in' && after.authStatus !== 'signed-in' && !sol.authChecking) sol.authChecks = 0;
    if (after.phase === 'entered' && space === 'solio' && memberShown(after)) {
      if (sol.account !== after.accountKey || solioNeedsRead(after)) startSolio();
      else if (solioReadable(after) && sol.rereadAfterAuth && !sol.checking) { sol.rereadAfterAuth = false; void reread(); }
      // 들어올 때 읽을 수 없었던(갱신 중) 방문자 분석은 읽을 수 있게 되면 한 번 읽는다
      syncVisits();
    } else if (vis.account !== undefined && vis.account !== (memberShown(after) ? after.accountKey : null)) {
      // 솔리오 밖에서 계정이 바뀌거나 회원이 아니게 되어도 앞 계정의 답을 남기지 않는다
      stopVisits();
    }
    return machine.read();
  }

  /* ── 솔리오 첫 화면의 자료(설계 8절) ── */
  function startSolio({ arriving = false } = {}) {
    const state = machine.read();
    // 누구의 자료인지는 회원 판정과 같은 기준이다(다시 검수). 읽는 때는 본체의 관문을 따른다(아래)
    const account = memberShown(state) ? state.accountKey : null;
    if (sol.account !== account) { stopSolio(); sol.account = account; }
    syncVisits();
    if (!subs || !account) { render(); return; }
    if (!sol.unsubscribe && typeof subs.onChanged === 'function') {
      try {
        const off = subs.onChanged(snap => {
          if (disposed || sol.account !== machine.read().accountKey || !snap || snap.ok === false) return;
          acceptSnapshot(snap);
          // 옛 구독 판이나 뒤의 확인으로 새 값이 들어오면 앞의 실패 표시와 기다림을 지운다(검수 A7)
          sol.error = null;
          sol.authChecks = 0;
          if (sol.rereadFailed) {
            const at = sol.snapshot?.check?.at;
            if (at && now() - at <= SIX_HOURS) sol.rereadFailed = false;
          }
          // 앞에서 모델별 토큰을 읽지 못했으면(로그인 갱신 중 거절) 이때 읽는다
          rooms.tokLoad();
          render();
        });
        sol.unsubscribe = typeof off === 'function' ? off : null;
      } catch { sol.unsubscribe = null; }
    }
    // 모델별 토큰의 바뀜 알림을 듣는다(설계 3.4). 읽기는 구독 자료를 읽을 수 있을 때 한 번 한다
    rooms.tokStart();
    // 토큰 갱신이나 오류 중에는 읽지 않고 기다린다. 읽으면 본체가 SIGN_IN_REQUIRED로 거절하고, 그 값이 손님 문장이 됐다(다시 검수 -c).
    // 솔리오에 새로 도착했으면 앞의 읽기 실패가 있어도 한 번 더 읽는다(전과 같다)
    // 갱신 중에 다시 도착해 읽기를 미루면 앞의 읽기 실패를 지운다. 남겨 두면 signed-in이 돌아와도 다시 읽지 않는다(다시 검수 -d)
    if (arriving && !solioReadable(state) && !sol.snapshot && sol.error && sol.error !== 'SIGN_IN_REQUIRED') sol.error = null;
    // 읽지 않을 때도 한 장 그린다. 기다림 문장과 조용한 다시 확인(syncAuthRecheck)이 그리기에서 정해진다
    if (!solioNeedsRead(state, { arriving })) { render(); return; }
    if (sol.error) sol.error = null;
    void loadSolio();
  }
  /* 솔리오 자료를 지금 읽어야 하는가. 들어와 있고, 솔리오에 있고, 회원으로 보이고, 본체가 읽어 줄 때(signed-in)이고, 그 계정의 자료를 맡았고,
   * 자료가 없고, 읽는 중도 예약된 다시 읽기도 없고, 남은 오류가 없거나 본체의 거절뿐일 때다. 깃발을 켜고 끄지 않고 이 물음 하나를
   * 인증 알림 끝과 솔리오 도착에서 계산한다(설계 검토 3차 권고 · P3-1) */
  function solioNeedsRead(state, { arriving = false } = {}) {
    if (state.phase !== 'entered' || space !== 'solio' || !memberShown(state) || !solioReadable(state)) return false;
    if (!subs || sol.account !== state.accountKey || sol.snapshot || sol.loading || sol.timer !== null) return false;
    return arriving || !sol.error || sol.error === 'SIGN_IN_REQUIRED';
  }
  function stopSolio() {
    // 계정이 바뀌거나 로그아웃하면 방의 상태(두 번 누르기, 열린 묶음, 남긴 글)도 모두 지운다
    rooms.reset();
    sol.seq += 1;
    // 솔리오 회차. 읽기마다 오르는 seq와 달리 로그아웃 · 계정 바뀜으로 솔리오를 닫을 때만 오른다(0.4.95 원천 후보 검수 D3)
    sol.run += 1;
    if (sol.timer !== null) { clearTimer(sol.timer); sol.timer = null; }
    if (sol.authTimer !== null) { clearTimer(sol.authTimer); sol.authTimer = null; }
    try { sol.unsubscribe?.(); } catch { /* 무시 */ }
    Object.assign(sol, { account: undefined, snapshot: null, error: null, checking: false, rereadFailed: false, autoDone: false, busyRetried: false, authRetried: false, loading: false, rereadAfterAuth: false, authChecking: false, authChecks: 0, unsubscribe: null });
  }
  /* ── 솔리오 「방문자 분석」의 자료(사이트방문 설계 6절) ── */
  function stopVisits() {
    vis.seq += 1;
    if (vis.timer !== null) clearTimer(vis.timer);
    Object.assign(vis, { account: undefined, result: null, loading: false, done: false, retried: false, timer: null });
    if (prog === 'visits') prog = 'subs';
  }
  /* 지금 회원의 요약을 읽는다. 솔리오를 열 때 한 번 읽고(그 계정이 대기 목록에 남는 때도 이때다), again이면 방문자 분석을 열 때 다시 읽는다.
   * 본체는 로그인한 회원에게만 답하고, 볼 계정이 아니면 available:false로 답한다(그때 대기 목록에 이 계정을 남긴다, site-visits.cjs) */
  function syncVisits({ again = false } = {}) {
    const state = machine.read();
    const account = memberShown(state) && state.accountKey ? state.accountKey : null;
    if (vis.account !== account) { stopVisits(); vis.account = account; }
    if (!visitsApi || !account || state.phase !== 'entered' || space !== 'solio' || !solioReadable(state) || vis.loading) return;
    if (vis.done && !again) return;
    const my = ++vis.seq;
    vis.loading = true;
    let pending;
    try { pending = Promise.resolve(visitsApi.snapshot()); } catch { pending = Promise.resolve(null); }
    pending.catch(() => null).then(res => {
      if (my === vis.seq) vis.loading = false;
      // 늦게 온 답은 그 계정이 지금도 같은 회차일 때만 받는다. 로그아웃 뒤 같은 계정으로 다시 들어와도 앞 회차의 답은 버린다
      if (disposed || my !== vis.seq || vis.account !== account || machine.read().accountKey !== account) return;
      vis.done = true;
      // 갱신 중이라 본체가 거절한 답은 「볼 수 없음」이 아니다. 앞에 받은 답을 그대로 두고, 받은 답이 없으면 읽을 수 있게 된 뒤 한 번 더 읽는다.
      // 기다리는 동안 이미 읽을 수 있게 되었으면(그때 온 알림은 읽는 중이라 막혔다) 1초쯤 뒤 한 번 더 읽는다(0.4.97 검수 A2)
      if (res && res.ok === false && res.code === 'SIGN_IN_REQUIRED') {
        if (!vis.result) {
          vis.done = false;
          if (!vis.retried && vis.timer === null && solioReadable(machine.read())) { vis.retried = true; vis.timer = setTimer(() => { vis.timer = null; syncVisits(); }, ORB_TIMING.busyRetry); }
        }
        render();
        return;
      }
      // 읽기가 예외로 끝났으면(답 없음) 앞에 받은 답을 지우지 않는다. 줄이 떴다 사라지지 않게 한다(0.4.97 검수 A1).
      // 받은 답이 없으면 읽은 것으로 치지 않는다. 다음 알림이나 솔리오에 다시 올 때 읽고, 1초쯤 뒤 한 번은 스스로 다시 읽는다(0.4.97 최종 검수 F3)
      if (!res || typeof res !== 'object') {
        if (!vis.result) {
          vis.done = false;
          if (!vis.retried && vis.timer === null && solioReadable(machine.read())) { vis.retried = true; vis.timer = setTimer(() => { vis.timer = null; syncVisits(); }, ORB_TIMING.busyRetry); }
        }
        render();
        return;
      }
      vis.retried = false;
      vis.result = res;
      render();
    });
  }
  /* 오브제를 눌렀거나 그 위에 머물렀을 때. 솔리오의 첫 화면에서 회원에게 있는 프로그램만 연다 */
  function showProgram(name) {
    if (space !== 'solio' || clientMode() !== 'app' || switchOpen) return false;
    const state = machine.read();
    const programs = programsFor(state, visitsScene(state));
    if (!programs.some(p => p.key === name)) return false;
    // 오브제를 누르면 열려 있던 방을 닫는다(시안 1343~1345행)
    const hadAside = aside !== null;
    if (hadAside) { aside = null; rooms.close(); }
    if (prog !== name || hadAside) { prog = name; render(); }
    if (name === 'visits') syncVisits({ again: true });
    return true;
  }

  function acceptSnapshot(snap) {
    if (sol.snapshot && typeof snap.seq === 'number' && typeof sol.snapshot.seq === 'number' && snap.seq < sol.snapshot.seq) return;
    sol.snapshot = snap;
    // 로그인 단계가 끝나면 계정 관리 방이 알린다(설계 4.5)
    rooms.observe(snap);
  }
  async function loadSolio() {
    if (!subs) return;
    const my = ++sol.seq;
    const account = sol.account;
    sol.loading = true;
    let res;
    try { res = await subs.snapshot(); } catch { res = { ok: false, code: 'READ_FAILED' }; }
    if (my === sol.seq) sol.loading = false;
    if (disposed || my !== sol.seq || account !== sol.account) return;
    // 본체가 읽기를 받아 주었으면(거절이 아닌 답) 다음 계정 오류 때 다시 네 번 확인할 수 있다
    if (res?.code !== 'SIGN_IN_REQUIRED') sol.authChecks = 0;
    if (res?.code === 'SIGN_IN_REQUIRED') {
      // 본체의 거절은 손님 판정이 아니다(손님 문장은 회원 판정만 정한다). 아직 못 읽은 것으로 남기고, 읽을 수 있게 되면 다시 읽는다(다시 검수 -c).
      // 화면은 signed-in인데 본체가 아직 아니면(알림이 엇갈린 때) 1초쯤 뒤 한 번 더 읽는다. 그래도 거절되면 기다림 문장을 보인다
      const st = machine.read();
      if (solioReadable(st) && memberShown(st) && !sol.authRetried) {
        sol.authRetried = true;
        sol.timer = setTimer(() => { sol.timer = null; void loadSolio(); }, ORB_TIMING.busyRetry);
        return;
      }
      sol.error = 'SIGN_IN_REQUIRED';
      render();
      return;
    }
    if (!res || res.ok === false) {
      // 판 파일을 잠깐 못 읽었으면 1초쯤 뒤에 한 번 스스로 다시 읽는다(설계 검토 2차 2)
      if (res?.code === 'BOARD_BUSY' && !sol.busyRetried) {
        sol.busyRetried = true;
        sol.timer = setTimer(() => { sol.timer = null; void loadSolio(); }, ORB_TIMING.busyRetry);
        return;
      }
      sol.error = res?.code || 'READ_FAILED';
      render();
      return;
    }
    sol.error = null;
    sol.authRetried = false;
    acceptSnapshot(res);
    // 솔리오에 들어와 구독 자료를 읽었으면 모델별 토큰도 한 번 읽는다(설계 3.4)
    rooms.tokLoad();
    if (!sol.autoDone && solioTodayNeedsReread(sol.snapshot, now())) {
      sol.autoDone = true;
      void reread();
      return;
    }
    render();
  }
  async function reread() {
    if (!subs || sol.checking) return;
    if (sol.error && sol.error !== 'SIGN_IN_REQUIRED' && !sol.snapshot) { sol.error = null; sol.busyRetried = false; render(); void loadSolio(); return; }
    if (typeof subs.check !== 'function') return;
    const account = sol.account, my = sol.run;
    sol.checking = true;
    sol.rereadFailed = false;
    render();
    let res;
    try { res = await subs.check(); } catch { res = null; }
    // 로그아웃 뒤 같은 계정으로 다시 들어온 새 회차에는 앞 회차의 늦은 답을 넣지 않는다(0.4.95 원천 후보 검수 D3)
    if (disposed || account !== sol.account || my !== sol.run) return;
    sol.checking = false;
    if (res && res.ok !== false) {
      sol.error = null;
      acceptSnapshot(res);
      const at = sol.snapshot?.check?.at;
      sol.rereadFailed = !at || now() - at > SIX_HOURS;
    } else {
      sol.rereadFailed = true;
      // 갱신 중이라 본체가 확인을 거절했으면, 읽을 수 있게 된 뒤 한 번 더 확인한다(설계 검토 3차 시험 길 5)
      if (res?.code === 'SIGN_IN_REQUIRED') sol.rereadAfterAuth = true;
      if (!sol.snapshot) sol.error = res?.code || 'READ_FAILED';
    }
    render();
  }

  /* 회원 판정은 참인데 계정 연결 오류로 아직 읽을 수 없을 때: 30초마다 네 번까지 조용히 다시 확인한다. 단계와 바쁨 표시는 바꾸지 않는다.
   * 「다시 확인」 단추도 같은 확인을 부른다. 호스트가 결과를 알림으로 보내면 인증 알림 끝에서 읽는다(설계 검토 3차 P2-1) */
  function authWaitingError(state) {
    if (state.phase !== 'entered' || space !== 'solio' || !memberShown(state) || sol.snapshot) return false;
    // 계정 연결 오류이거나, 화면은 signed-in인데 본체가 두 번 거절해 기다리는 때(다시 검수 -d P3)
    return state.authStatus === 'error' || (solioReadable(state) && sol.error === 'SIGN_IN_REQUIRED' && sol.timer === null && !sol.loading);
  }
  async function recheckAuth() {
    if (disposed || sol.authChecking || typeof options.onRetry !== 'function') return;
    const account = sol.account, my = sol.run;
    sol.authChecking = true;
    sol.authChecks += 1;
    render();
    try { await options.onRetry(); } catch { /* 결과는 호스트의 알림으로 온다 */ }
    if (disposed || account !== sol.account || my !== sol.run) return;
    sol.authChecking = false;
    render();
  }
  function syncAuthRecheck(scene) {
    const state = machine.read();
    const want = !disposed && scene.mode === 'app' && scene.layer === 'app' && authWaitingError(state) && !sol.authChecking
      && sol.authChecks < ORB_TIMING.authRecheckTimes && typeof options.onRetry === 'function' && !isHidden();
    if (want && sol.authTimer === null) sol.authTimer = setTimer(() => { sol.authTimer = null; if (authWaitingError(machine.read())) void recheckAuth(); }, ORB_TIMING.authRecheck);
    else if (!want && sol.authTimer !== null) { clearTimer(sol.authTimer); sol.authTimer = null; }
  }

  /* 시각 글은 1분마다 다시 쓴다. 창이 가려진 동안은 쓰지 않는다 */
  function syncClock(scene) {
    // 계정 관리 방의 「HH:MM에 읽음」도 고쳐 쓴다(설계 1.3절)
    const want = !disposed && scene.mode === 'app' && scene.layer === 'app' && (space === 'solio' || aside !== null) && !isHidden();
    if (want && clockTimer === null && typeof setTick === 'function') clockTimer = setTick(() => { if (!isHidden()) render(); }, ORB_TIMING.clock);
    else if (!want && clockTimer !== null) { clearTick(clockTimer); clockTimer = null; }
  }

  /* ── 화면이 알리는 것 ── */
  function handle(action, payload) {
    if (disposed) return false;
    const state = machine.read();
    switch (action) {
      case 'wake': wake(); return true;
      case 'signin': if (state.phase === 'auth') void runSignIn(); return true;
      case 'signup': if (state.phase === 'auth') void runSignUp(); return true;
      case 'invite-submit': void runInviteSubmit(); return true;
      case 'invite-input': if (feedback.note && state.phase === 'auth') { feedback.note = ''; render(); } return true;
      case 'close-invite': if (busyAction === null || busyAction === 'invite') closeInvite(); return true;
      case 'cancel-signin': void runCancelSignIn(); return true;
      case 'retry-auth': void runRetryAuth(); return true;
      case 'go-auth':
        if (busyAction !== null) return true;
        clearFeedback(); machine.showAuthPanel(); render(); return true;
      case 'retry-enter': {
        // 계정 전환처럼 다른 동작이 도는 동안에는 받지 않는다. 받으면 단계만 entering으로 넘어가고 진입은 시작되지 않았다(0.4.95 원천 후보 검수 B4)
        if (busyAction !== null) return true;
        const retry = machine.retryEnter();
        render();
        if (retry.shouldTriggerEnter) void triggerEnter();
        return true;
      }
      case 'switch-account':
      case 'workspace-switch-account': void runSwitchAccount(); return true;
      case 'retry-workspace': void runRetryWorkspace(); return true;
      case 'continue-personal': void runContinuePersonal(); return true;
      case 'go': go(payload); return true;
      case 'open-switch': toggleSwitch(); return true;
      /* 다가가서 머물면 열리고, 펼침 구역을 벗어나 머물면 닫힌다(고정한 것은 닫지 않는다) */
      case 'fan-near': openSwitch({ pin: false }); return true;
      case 'fan-leave': closeSwitch({ unpinnedOnly: true }); return true;
      case 'close-switch': closeSwitch(); return true;
      case 'foot': foot(payload); return true;
      /* 줄을 누르면 안쪽이 고정된다(화면만의 일). 줄 안쪽의 「계정 관리」와 방 맨 아래의 「계정 관리」 · 「구독 연결하기」는 계정 관리 방을 연다.
       * 이름은 그대로 두고 하는 일만 바꿨다(2단계 둘째 조각 설계 9.3, 설계 검토 D14). 인자는 그 구독 줄의 열쇠다 */
      case 'subs-manage': openAside('manage'); return true;
      case 'connect': openAside('manage', { svc: typeof payload === 'string' && payload ? payload : null }); return true;
      case 'aside-back': closeAside(); return true;
      /* 방 안쪽의 단추. 줄을 열고 접는 일은 화면 안에서 끝나고, 동작만 여기로 온다 */
      case 'room':
        if (clientMode() !== 'app' || !payload || typeof payload !== 'object') return false;
        if (!aside && payload.room !== 'solio') return false;
        void rooms.handle(payload);
        return true;
      case 'reread': void reread(); return true;
      case 'prog': return showProgram(payload);
      case 'recheck-auth': void recheckAuth(); return true;
      case 'reopen-space': void runOpenSpace(space, { reopen: true }); return true;
      case 'legacy-back': closeLegacy(); return true;
      case 'qa-guest': void runQaGuest(); return true;
      case 'pageshow': if (payload === true) releaseNavigationHold(); return true;
      case 'visible': if (!isHidden()) render(); return true;
      // 창이 가려지면 모델별 토큰의 실시간 부탁을 거둔다(설계 3.4)
      case 'hidden': rooms.syncLive(false); return true;
      case 'escape': return escape();
      default: return false;
    }
  }

  function escape() {
    const state = machine.read();
    const mode = clientMode();
    if (mode === 'portal') {
      if (state.phase === 'invite' && (busyAction === null || busyAction === 'invite')) { closeInvite(); return true; }
      if (busyAction !== null && busyAction !== 'signin') return false;
      if (state.phase === 'signing-in') { void runCancelSignIn(); return true; }
      if (state.phase === 'workspace' && state.workspace?.canContinuePersonal !== false) { void runContinuePersonal(); return true; }
      return false;
    }
    if (switchOpen) { closeSwitch({ focusHere: true }); return true; }
    if (legacyKind) { closeLegacy(); return true; }
    if (aside) { closeAside(); return true; }
    return false;
  }

  function releaseNavigationHold() {
    if (disposed || !navigationHoldActive) return false;
    navigationHoldActive = false;
    if (orbAt === 'inside') {
      const kind = freshSignIn ? 'full' : 'quick';
      render();
      void queue(gen => arrive(gen, kind));
    } else {
      render();
    }
    return true;
  }

  function start() {
    startIntro();
    applyAuthUpdate(options.initialState || { status: 'restoring' });
  }

  const api = {
    setState(patch = {}) { return applyAuthUpdate(patch); },
    getState() { return machine.read(); },
    isActive() { return !disposed && (machine.read().active || navigationHoldActive); },
    shouldBlockShortcuts() { return !disposed && (machine.read().blockShortcuts || navigationHoldActive); },
    releaseNavigationHold,
    setWorkspaceState(workspacePatch = {}, guard = {}) {
      if (disposed) return { ok: false, changed: false, state: machine.read() };
      const updated = machine.updateWorkspace(workspacePatch, guard);
      if (!updated.ok) return updated;
      workspaceNeedsRetry = false;
      feedback.workspace = '';
      rememberAssigned(updated.state.workspace?.destinations, updated.state.accountKey);
      render();
      return updated;
    },
    // 호스트가 브라우저 로그인 실패 까닭을 알릴 때 쓴다. 묻는 화면에 있을 때만 받는다
    showAuthFeedback(message) {
      if (disposed) return false;
      const text = faceSentence(message);
      if (!text || machine.read().phase !== 'auth') return false;
      feedback.auth = text;
      render();
      return true;
    },
    completeWorkspaceEntry({ action = 'entered', purposeMode, accountKey, navigationRequested = false, destination } = {}) {
      if (disposed) return { ok: false, state: machine.read() };
      const snap = machine.read();
      if (snap.phase !== 'workspace' && snap.phase !== 'entering') return { ok: false, state: snap };
      if (accountKey !== undefined && snap.accountKey !== accountKey) return { ok: false, state: snap };
      if (snap.phase === 'workspace' && snap.workspaceAccountKey !== snap.accountKey) return { ok: false, state: snap };
      if (busyAction !== null) { asyncSeq += 1; busyAction = null; }
      workspaceNeedsRetry = false;
      clearFeedback();
      if (action === 'purpose') {
        rememberAssigned([], snap.accountKey);
        const mode = purposeMode === 'existing' ? 'existing' : 'onboarding';
        const moved = snap.phase === 'workspace'
          ? machine.workspaceToPurpose({ mode, returnToWorkspace: false })
          : machine.enterToPurpose({ mode });
        if (!moved.ok) {
          if (mode === 'existing') { render(); return { ok: false, state: machine.read() }; }
          completeEntryWith({});
        } else {
          void runEnterDefault();
        }
      } else {
        completeEntryWith({ navigationRequested, destination });
      }
      return { ok: true, state: machine.read() };
    },
    openPurposePicker() { return false; },
    closePurposePicker() { return Promise.resolve(false); },
    reopenAuth(patch = {}) {
      if (disposed) return machine.read();
      const hadBusyInvite = busyAction === 'invite';
      asyncSeq += 1;
      busyAction = null;
      view.setInviteValue?.('');
      if (hadBusyInvite) options.onCancelInvite?.();
      const next = leaveToAsk(patch);
      render();
      return next;
    },
    clientMode,
    isClientShown() { const mode = clientMode(); return mode === 'app' || mode === 'legacy' || mode === 'portal'; },
    handle,
    scene: buildScene,
    dispose() {
      if (disposed) return;
      const hadBusyInvite = busyAction === 'invite';
      disposed = true;
      navigationHoldActive = false;
      asyncSeq += 1;
      busyAction = null;
      orbGen += 1;
      cancelAutoZoom();
      stopSolio();
      stopVisits();
      aside = null;
      if (clockTimer !== null) { clearTick(clockTimer); clockTimer = null; }
      if (hadBusyInvite) options.onCancelInvite?.();
      view.dispose?.();
    },
  };

  start();
  return api;
}

/* 새 얼굴을 #portal-entry 뿌리에 붙인다. 지금 얼굴(mountPortalEntry)과 같은 약속을 지킨다(설계 4절) */
export function mountOrbFace(root, options = {}) {
  if (!root) throw new Error('검정 구 얼굴을 붙일 뿌리 요소가 필요합니다.');
  let controller = null;
  const view = createOrbFaceView(root, {
    options,
    look: { ...ORB_LOOK, ...(options.look && typeof options.look === 'object' ? options.look : {}) },
    onAction: (action, payload) => controller?.handle(action, payload) ?? false,
    getMode: () => controller?.clientMode() ?? 'portal',
    getReducedMotion: () => { try { return options.getReducedMotion?.() === true; } catch { return false; } },
  });
  let storage = null;
  try { storage = root.ownerDocument?.defaultView?.localStorage ?? null; } catch { storage = null; }
  controller = createOrbFaceController({ view, options, env: { storage } });
  return controller;
}
