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
import { solioBrief } from './solio-brief.mjs';
import { siteVisitsView, SITE_VISITS_NAME } from './site-visits-model.mjs';
import { snsHealthView, SNS_HEALTH_NAME } from './sns-health-model.mjs';
import { solioBackupView, backupActionNotice, SOLIO_BACKUP_NAME } from './solio-backup-model.mjs';
import { createOfficeRoom, OFFICE_NAME, OFFICE_TIMING } from './office-room.mjs';
import { createOrbFaceView } from './orb-face-view.mjs';
import { createOrbRooms, ASIDE_ROOMS } from './orb-rooms.mjs';

/* 구 위의 자리(places)와 점 로고(signature)를 켜고 끄는 값. 하나를 false로 바꾸면 그 모양이 빠진다(설계 12절) */
/* eyes: 구의 점 눈(유호님 11-17 「점눈으로 하자」, 결정 표 11-16 「구에 눈을 넣는다」). 끄면 셰이더가 눈을 그리지 않는다 */
export const ORB_LOOK = Object.freeze({ places: true, signature: true, eyes: true });

/* 솔리오 안의 프로그램. 구 옆에 작은 오브제로 놓인다(시안 .rail, 결정 표 11-16). 오브제 줄은 방문자 분석이나 계정 건강을 볼 계정에게만 있다.
 * 그 밖의 계정에게는 줄이 없고 솔리오 화면이 그대로다. 백업은 구독 다음 자리다(11-20 백업·복구 탭 세션). 실제 입구는 유호님 계정에만 있고,
 * 본체가 다른 계정에는 available:false로 답해 오브제도 서지 않는다(src/solio-backup.cjs). 첫 화면(구독 방)에는 백업 줄을 두지 않는다(결정 표 11-16).
 * 계정 건강은 방문자 분석 다음이다(계정건강 PC앱_구현설계 10절). 두 프로그램은 요약 파일이 따로라 한쪽만 보일 수 있다 */
export const SOLIO_PROGRAMS = Object.freeze([
  Object.freeze({ key: 'subs', label: '구독' }),
  Object.freeze({ key: 'backup', label: SOLIO_BACKUP_NAME }),
  Object.freeze({ key: 'visits', label: SITE_VISITS_NAME }),
  Object.freeze({ key: 'health', label: SNS_HEALTH_NAME }),
  // 사무실은 계정 건강 다음이다(사무실 구현설계 11.1). 본체가 볼 계정에만 available:true로 답한다
  Object.freeze({ key: 'office', label: OFFICE_NAME }),
]);
/* 이 PC의 요약 한 장을 읽어 보이는 프로그램(읽기 프로그램). 오브제 줄은 이 가운데 하나라도 보이면 선다 */
const READ_PROGRAMS = Object.freeze(['visits', 'health', 'backup', 'office']);
const READ_VIEW = Object.freeze({ visits: siteVisitsView, health: snsHealthView, backup: solioBackupView });
/* 백업 방이 보이는 동안 다시 읽는 간격(ms). 설치가 도는 동안은 짧게, 아니면 엔진이 상태를 쓰는 주기에 맞춘다 */
const BACKUP_POLL = Object.freeze({ busy: 2000, idle: 15000 });

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
/* 띠의 닫기 글에 쓰는 공간 이름(「PULSE 닫기」, 「Workspace 닫기」) */
const SPACE_NAME = Object.freeze({ workspace: 'Workspace', pulse: 'PULSE' });
const SPACE_ROOM = Object.freeze({
  // Workspace도 창 안에서 열린다(4단계). 열린 동안 방은 비고 뷰가 덮는다. 이 글은 Workspace가 닫혔을 때의 방이다
  workspace: Object.freeze({ say: 'Workspace가 닫혔습니다.', then: '저장하지 않은 내용은 남지 않았을 수 있습니다. 다시 열면 첫 화면부터 엽니다.' }),
  // PULSE는 창 안에서 열린다(3단계). 열린 동안 방은 비고 뷰가 덮는다. 이 글은 PULSE가 닫혔을 때(뷰 프로세스가 사라지는 따위)의 방이다
  pulse: Object.freeze({ say: 'PULSE가 닫혔습니다.', then: '저장하지 않은 내용은 남지 않았을 수 있습니다. 다시 열면 첫 화면부터 엽니다.' }),
});
/* 본체가 그 공간의 뷰 자리를 주지 않은 실행(뷰 다리가 없는 화면)에서는 공간이 따로 열린 창이다. 그때의 방 글이다 */
const SPACE_ROOM_OUTSIDE = Object.freeze({
  workspace: Object.freeze({ say: 'Workspace를 열었습니다.', then: '따로 열린 Workspace 창에서 이어 가 주세요.' }),
  // 0.5.2 사무실 화면 검수 FA3: 뷰 다리 없이 PULSE를 바깥 창으로 연 직후 「PULSE가 닫혔습니다」라고 말하지 않는다
  pulse: Object.freeze({ say: 'PULSE를 열었습니다.', then: '따로 열린 PULSE 창에서 이어 가 주세요.' }),
});
const SIX_HOURS = 6 * 3600e3;
/* 창 안의 공간(PULSE, Workspace)이 열린 동안 맨 위 띠의 높이(CSS px). orb-face.css의 data-orb-band 규칙과 같은 값이다(3단계 구현 설계 4.1) */
export const PULSE_BAND = 56;

const trimmed = value => (typeof value === 'string' && value.trim() ? value.trim() : '');

/* 호스트와 본체가 보내는 까닭 글은 옛 얼굴의 「-어요」 말씨다. 새 얼굴의 「-습니다」 문장에 맞춰 끝만 바꾼다.
 * 받침이 ㅆ(했 · 었 · 났 · 있), ㅄ(없), ㄶ(않), ㅀ(싫)인 글자 뒤의 「-어요 · -아요」, 「-예요 · -이에요」, 「돼요」, 「해요」만 바꾸고,
 * 「주세요」 같은 부탁과 모르는 꼴은 그대로 둔다 */
// 펼침에 두는 배정 조회 까닭 한 줄(PC 검수 F1). 호스트의 옛 고르기 화면 글은 「아래 단추」 같은 옛 화면을 가리키므로 쓰지 않는다.
// 새 얼굴의 말씨(「-습니다」)를 따른다 — 같은 펼침의 오류 줄과 한 화면에 선다(사무실 검수 FA1이 짚음)
export function assignmentCheckLead(check) {
  if (check?.status === 'partial') return '회사 공간 가운데 일부를 확인하지 못했습니다.';
  if (check?.status === 'account_mismatch') return '회사 공간이 다른 계정으로 로그인되어 있어 확인하지 못했습니다.';
  return '회사 공간 배정을 확인하지 못했습니다.';
}

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
  const bridgeOf = v => (v && typeof v.snapshot === 'function' ? v : null);
  const readApi = { visits: bridgeOf(options.siteVisits), health: bridgeOf(options.snsHealth), backup: bridgeOf(options.solioBackup), office: bridgeOf(options.office) };
  let backupPoll = null, backupPollMs = 0, backupNotice = null;
  /* 솔리오 「사무실」(사무실 구현설계 11절). 판은 읽기 프로그램처럼 읽고(reads.office), 방의 동작과 화면 상태는 office-room.mjs가 가진다.
   * 방이 보이는 동안 기록 살피기를 켜고(watch), 분 글은 15초마다 다시 쓴다. 솔리오가 보이는 동안은 1분마다와 바뀜 알림 때 다시 읽어 오브제의 느낌표를 맞춘다 */
  const office = createOfficeRoom({ api: readApi.office, snapshot: () => reads.office.result, reread: () => syncRead('office', { again: true }), changed: () => render() });
  let officeWatching = false, officeClock = null, officePoll = null, officeChange = null, officeOff = null;

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
  // 로그인 때 배정 조회가 끝내 다 확인되지 않았으면 그 까닭({ status })이다. 펼침이 까닭과 「다시 확인」을 둔다(PC 검수 F1)
  let assignedCheck = null;
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
  const sol = { account: undefined, snapshot: null, error: null, checking: false, rereadFailed: false, autoDone: false, busyRetried: false, authRetried: false, loading: false, rereadAfterAuth: false, authChecking: false, authChecks: 0, authTimer: null, seq: 0, run: 0, timer: null, unsubscribe: null, diagMemo: null, briefCache: null };
  let clockTimer = null;
  // 솔리오 「방문자 분석」과 「계정 건강」의 자료. 프로그램마다 따로 두고, 계정마다 따로 읽고, 계정이 바뀌면 앞 계정이 받은 답을 버린다
  // (사이트방문 설계 6절, 계정건강 PC앱_구현설계 10절). 요약은 바뀜 알림이 없어 솔리오에 들어올 때와 그 프로그램을 열 때 읽는다
  const reads = Object.fromEntries(READ_PROGRAMS.map(key => [key, { account: undefined, result: null, seq: 0, loading: false, done: false, retried: false, timer: null }]));
  /* 펼침이나 구독 방에서 여는 방(2단계 둘째 조각 설계 1.3절). aside는 그 방의 이름이고, 방마다의 상태와 동작은 orb-rooms.mjs가 가진다.
   * 방은 어느 공간에서든 열리고 닫으면 있던 방으로 돌아간다. 옛 화면이 열린 동안에도 aside를 지켜 옛 화면에서 돌아오면 그 방이다 */
  let aside = null;
  /* 방이 쓰는 런처 쪽 다리(설계 1.3절 「자료 어댑터」). account는 내 계정의 요청 · 신원 · 로그인과 보안, confirmLeave는 쓰던 글 확인이다.
   * bind로 런처에 손잡이를 넘겨, 계정 생명주기가 바뀔 때 내 계정 자료를 버리게 한다. 런처가 넘기지 않으면 「계정」은 옛 화면을 연다 */
  /* 창 안의 공간 뷰(PULSE는 3단계 구현 설계 4절, Workspace는 4단계 6절). 본체가 공간마다 뷰를 만들고, 보일지는 이 컨트롤러가 정해 place로 알린다.
   * 공간마다 {embed(본체 다리), open(뷰가 살아 있음), closing(띠의 닫기를 묻는 중), sent(마지막으로 보낸 자리)}를 둔다. 보이는 뷰는 언제나 지금 공간의 것 하나다 */
  const embeds = {};
  for (const [name, given] of [['pulse', options.embed], ['workspace', options.workspaceEmbed]]) if (given && typeof given.place === 'function') embeds[name] = { embed: given, open: false, closing: false, sent: '' };
  const slotOf = name => (Object.hasOwn(embeds, name) ? embeds[name] : null);
  const embed = embeds.pulse?.embed || null;
  // guestPulse: 로그아웃한 손님이 PULSE 초대로 들어온 때다. 손님에게는 PULSE만 배정된 것으로 본다(설계 검토 R1)
  // share: Workspace가 청한 화면 공유 고르기 {id, items}(4단계 4.2). pendingReveal: 구가 다른 공간으로 들어가는 동안 온 「돌아가서 저장」(3단계 화면 Fable F1)
  // pendingMainOpen: 본체가 공간을 열라고 했는데(트레이의 Workspace 줄) 아직 들어오기 전이면 들어온 뒤에 연다
  let embedFocusNext = false, guestPulse = false, signingOut = false, share = null, pendingReveal = null, pendingMainOpen = null;
  const embedOff = [];
  // 본체의 단축 동작. 지금은 트레이 줄이 보내는 {type:'open-space', space:'workspace'} 하나만 받는다(4단계 구현 설계 3.5)
  if (typeof options.onDesktopAction === 'function') {
    try { const off = options.onDesktopAction(action => { if (action && typeof action === 'object' && action.type === 'open-space' && slotOf(action.space)) openFromMain(action.space); }); if (typeof off === 'function') embedOff.push(off); } catch { /* 본체 알림 없이도 연다 */ }
  }
  for (const [name, slot] of Object.entries(embeds)) {
    const bridge = slot.embed;
    try { const off = bridge.onChanged?.(value => onEmbedChange(name, value)); if (typeof off === 'function') embedOff.push(off); } catch { /* 본체 알림 없이도 연다 */ }
    try { const off = bridge.onEvent?.(value => onEmbedEvent(name, value)); if (typeof off === 'function') embedOff.push(off); } catch { /* 같다 */ }
    if (name === 'workspace') { try { const off = bridge.onShareAsk?.(value => onShareAsk(value)); if (typeof off === 'function') embedOff.push(off); } catch { /* 같다 */ } }
    try { void Promise.resolve(bridge.state?.()).then(value => { if (value && typeof value === 'object') onEmbedChange(name, value); }).catch(() => {}); } catch { /* 같다 */ }
  }
  const roomOptions = options.rooms && typeof options.rooms === 'object' ? options.rooms : {};
  const accountAdapter = roomOptions.account && typeof roomOptions.account.request === 'function' && typeof roomOptions.account.identity === 'function' ? roomOptions.account : null;
  /* 설정 방의 PC 쪽 다리(설계 1.3절 표). 없는 칸은 그 줄을 세우지 않는다. 옛 설정 화면으로 가는 길은 이제 없다(설계 9.2) */
  const roomPart = (name, keys) => { const v = roomOptions[name]; return v && typeof v === 'object' && keys.every(k => typeof v[k] === 'function') ? v : null; };
  const rooms = createOrbRooms({
    subs,
    account: accountAdapter,
    pc: {
      desktop: roomPart('desktop', ['get', 'update']),
      drafts: roomPart('drafts', ['status', 'set']),
      notices: roomPart('notices', ['get', 'set']),
      // 플레저 PC 알림 켜고 끄기(PC 0.5.0 설계 4.5 R7). 옛 설정 화면에만 있던 칸이다
      care: roomPart('care', ['status', 'configure']),
      updates: roomPart('updates', ['status', 'check', 'download', 'install']),
      environment: typeof roomOptions.environment === 'function' ? () => roomOptions.environment() : null,
      copyDiagnostics: typeof roomOptions.copyDiagnostics === 'function' ? () => roomOptions.copyDiagnostics() : null,
    },
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
    // PULSE 초대로 들어온 손님에게는 솔리오가 없다. 펼침에는 PULSE와 「로그인」만 둔다(설계 검토 R1, 옮기기 설계 「정한 것」 4)
    const guestOnPulse = guestPulse && !state.accountKey;
    const names = [...(guestOnPulse ? [] : ['solio']), ...assignedFor(state)].map(name => ({ space: name, label: SPACE_LABEL[name], desc: SPACE_DESC[name], current: name === space }));
    const signedIn = memberShown(state);
    const check = signedIn && assignedCheck && assignedAccount === state.accountKey ? assignedCheck : null;
    const recheck = check && typeof options.onRecheckSpaces === 'function' ? [{ action: 'recheck-spaces', label: '다시 확인' }] : [];
    const foot = signedIn
      ? [...recheck, { action: 'account', label: '계정' }, { action: 'settings', label: '설정' }, { action: 'logout', label: '로그아웃' }]
      : guestOnPulse ? [{ action: 'signin', label: '로그인' }] : [{ action: 'settings', label: '설정' }];
    return { kind: 'app', names, lead: check ? assignmentCheckLead(check) : '', error: feedback.switch, actions: [], foot, showClose: true };
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
    // 로그아웃한 손님은 PULSE 초대로 들어온 동안 PULSE 하나만 갈 수 있다(설계 검토 R1)
    if (!state.accountKey) return guestPulse && embed && state.authStatus !== 'signed-in' ? ['pulse'] : [];
    return assignedAccount === state.accountKey ? assigned : [];
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
    // 팁은 그 구독 줄 안쪽에 작은 글 한 줄과 반응 단추 둘로 선다(설계 검토 D7). 고르는 일은 모델(pickUsageTips)이 한다
    const tips = signedIn && sol.snapshot && today.rows?.length ? rooms.subTips() : null;
    // 비서 판(11-20 솔리오 구독 비서 설계 3절): 맨 위 한 가지, 다가오는 일, 지금 출력, 오늘 진단. 줄은 상세내역 안으로 접는다.
    // 스냅숏에서 나오는 판은 스냅숏이나 분이 바뀔 때만 다시 센다(설계 검토 D7). 진단은 하루 한 번 기억한다(D10)
    const brief = signedIn && sol.snapshot ? briefOf(today) : null;
    const says = brief?.says || {};
    const rows = today.rows.map(r => {
      const tip = tips?.get?.(r.key), say = says[r.key];
      return tip || say ? { ...r, more: { ...r.more, ...(say ? { say } : {}), ...(tip ? { tip } : {}) } } : r;
    });
    const head = brief?.head ? { say: brief.head.say, then: brief.head.then } : {};
    // 확인할 구독(check)은 줄이 곧 할 일이라 접지 않고, 지금 출력만 위에 둔다(설계 검토 D9)
    const showLive = Boolean(brief) || (signedIn && sol.snapshot && today.state === 'check' && today.rows?.length > 0);
    const live = showLive ? rooms.tokLive() : null;
    const box = brief ? { fold: true, soon: brief.soon, diag: brief.diag, dial: brief.dial || null, live } : showLive ? { fold: false, soon: null, diag: null, dial: null, live } : null;
    return { ...today, ...head, rows, extra, rereading: sol.checking || Boolean(sol.snapshot?.checking), brief: box };
  }
  function briefOf(today) {
    const t = now(), minute = Math.floor(t / 60e3), c = sol.briefCache;
    if (c && c.snapshot === sol.snapshot && c.minute === minute && c.state === today.state) return c.brief;
    const brief = solioBrief({ today, snapshot: sol.snapshot, memo: sol.diagMemo }, t);
    if (brief?.memo) sol.diagMemo = brief.memo;
    sol.briefCache = { snapshot: sol.snapshot, minute, state: today.state, brief };
    return brief;
  }

  /* 이 계정이 볼 수 있는 읽기 프로그램(방문자 분석, 계정 건강). 그 계정이 받은 답만 쓴다. 다른 계정의 답이나 회원이 아닐 때는 보이지 않는다 */
  function readScene(key, state) {
    const r = reads[key];
    if (!readApi[key] || !memberShown(state) || !state.accountKey || r.account !== state.accountKey) return { visible: false };
    // 사무실의 장면은 방의 화면 상태(열어 둔 묶음, 알림 줄)와 구독 방의 남은 양까지 쓴다
    const scene = key === 'office' ? office.scene(r.result, now(), sol.snapshot) : READ_VIEW[key](r.result, now());
    // 백업 방에서 누른 단추가 거절되거나 열지 못했으면 그 한 줄을 둘째 문장 앞에 10초 둔다(Fable 최종 검수 F3)
    if (key === 'backup' && scene.visible && backupNotice && now() - backupNotice.at < 10000) return { ...scene, then: `${backupNotice.text} ${scene.then || ''}`.trim() };
    return scene;
  }
  function readScenes(state) { return Object.fromEntries(READ_PROGRAMS.map(key => [key, readScene(key, state)])); }
  /* 오브제 줄. 읽기 프로그램을 하나라도 볼 계정에게만 있고, 프로그램마다 자기가 보일 때만 선다(계정건강 PC앱_구현설계 10절 「새로 정한 것」).
   * 볼 계정인지는 솔리오가 열릴 때 한 번 읽어 정하고, 답이 오기 전에는 줄을 두지 않는다 */
  function programsFor(state, scenes) {
    if (!memberShown(state) || !READ_PROGRAMS.some(key => scenes[key]?.visible)) return [];
    return SOLIO_PROGRAMS.filter(p => p.key === 'subs' || scenes[p.key]?.visible).map(p => (p.key === 'backup' && scenes.backup?.note ? { ...p, note: scenes.backup.note } : p.key === 'office' && scenes.office?.alert ? { ...p, alert: true } : { ...p }));
  }

  function roomScene(state) {
    if (space === 'solio') {
      const scenes = readScenes(state);
      const programs = programsFor(state, scenes);
      const at = programs.some(p => p.key === prog) ? prog : 'subs';
      return { space, solio: solioScene(state), prog: at, programs, ...scenes };
    }
    // 창 안의 PULSE가 열려 있으면 방은 비운다. 뷰가 띠 아래를 덮고, 펼침을 여는 동안에는 검정으로 남는다
    const slot = slotOf(space);
    if (slot && (slot.open || slot.closing)) return { space, say: '', then: '', action: null, error: feedback.switch, embedded: true };
    const copy = !slot && SPACE_ROOM_OUTSIDE[space] ? SPACE_ROOM_OUTSIDE[space] : SPACE_ROOM[space];
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
      rooms: mode === 'portal' || !aside ? null : rooms.scene({ aside, checking: sol.checking, name: roomName(), accountKey: state.accountKey || '', member: memberShown(state) }),
      legacy: legacyKind,
      band: bandOn() ? space : null,
      bandClose: bandOn() && !!slotOf(space)?.open && !slotOf(space).closing && !switchOpen && !aside && !share && typeof slotOf(space).embed.close === 'function',
      bandCloseLabel: bandOn() ? `${SPACE_NAME[space]} 닫기` : '',
      share: share && mode === 'app' && space === 'workspace' ? { id: share.id, items: share.items } : null,
      focus: focusKey,
      focusSeq,
    };
    return scene;
  }

  /* 띠 모양은 들어온 뒤 뷰 자리가 있는 공간(PULSE, Workspace)에 있는 동안이다. 구가 그 공간으로 들어가는 길에서도 미리 서서, 도착한 구가 다시 옮겨 가지 않는다.
   * 뷰가 닫혀 「다시 열기」를 보이는 동안에도 띠 자리를 지킨다. 사람이 하지 않은 일로 작은 구가 옮겨 가지 않게 한다(3단계 설계 검토 R12) */
  function bandOn() { return !!slotOf(space) && clientMode() === 'app'; }
  /* 뷰가 보이는 때: 그 공간이 지금 공간이고, 뷰가 열렸고, 구가 띠 자리에 멈췄고, 펼침과 곁방과 옛 화면과 화면 공유 고르기가 닫혔고,
   * 이 화면이 다른 일(로그아웃 확인 따위)을 하고 있지 않을 때. 그 밖에는 숨기고 구를 이 화면에서 움직인다(3단계 4.2, 설계 검토 R11) */
  function embedVisible(name = space) { const slot = slotOf(name); return name === space && bandOn() && !!slot?.open && !slot.closing && orbAt === 'home' && orbTarget === 'home' && !switchOpen && !aside && !legacyKind && !share && busyAction === null && !signingOut && !isHidden(); }
  function syncEmbed() {
    // 숨길 뷰를 먼저 보내고 보일 뷰를 나중에 보낸다. 공간을 오갈 때 두 뷰가 한꺼번에 서지 않는다
    const order = Object.keys(embeds).sort((a, b) => Number(a === space) - Number(b === space));
    for (const name of order) {
      const slot = embeds[name];
      const next = { visible: embedVisible(name), top: PULSE_BAND };
      const key = JSON.stringify(next);
      if (key === slot.sent) continue;
      slot.sent = key;
      const focusNow = next.visible && embedFocusNext;
      if (next.visible) embedFocusNext = false;
      // 초점은 본체가 옮기지 않는다. 도착한 뒤와 Esc가 아닌 닫기 뒤에만 이 화면이 뷰로 보낸다(3단계 설계 검토 R3)
      try { void Promise.resolve(slot.embed.place(next)).then(() => { if (focusNow && !disposed && embedVisible(name)) return slot.embed.focus?.(); return null; }).catch(() => { slot.sent = ''; }); } catch { slot.sent = ''; }
    }
  }
  /* 본체의 알림. 「돌아가서 저장」을 고르면 그 공간으로 데려가 쓰던 글을 보인다(3단계 3절). 사람이 하지 않은 일이라 구를 들여보내지 않고 그 자리에서 바꾼다(3단계 설계 검토 R12).
   * 펼침을 연 채 받으면 펼침을 닫고 바꾼다. 구가 다른 공간으로 들어가는 중이면 도착한 뒤에 바꾼다(3단계 화면 Fable F1) */
  function revealSpace(name) {
    if (disposed || !slotOf(name)?.open) return;
    // 옛 화면이 열려 있으면 clientMode()가 'legacy'라 먼저 닫는다(카본 A1)
    if (legacyKind && clientMode() === 'legacy') closeLegacy({ silent: true });
    if (clientMode() !== 'app') return;
    if (switchOpen) { switchOpen = false; fanPin = false; }
    if (aside) { aside = null; rooms.close(); }
    if (space !== name) {
      if (!assignedFor(machine.read()).includes(name)) { render(); return; }
      if (orbTarget === 'inside') { pendingReveal = name; render(); return; }
      space = name;
      feedback.switch = '';
      view.settle?.(name);
    }
    embedFocusNext = true;
    render();
  }
  /* 본체가 Workspace를 열라고 한다(트레이의 Workspace 줄, 4단계 3.5). 배정에 없으면 까닭을 한 줄 말한다(설계 검토 R17) */
  function openFromMain(name) {
    if (disposed) return;
    if (clientMode() !== 'app' || orbTarget === 'inside') { pendingMainOpen = name; return; }
    pendingMainOpen = null;
    // 까닭은 펼침에서 말한다. 펼침이 닫혀 있으면 열어서 보인다
    if (!assignedFor(machine.read()).includes(name)) { sayInSwitch(`이 계정에는 ${SPACE_NAME[name] || name} 배정이 없습니다.`); return; }
    if (space === name && slotOf(name)?.open) { revealSpace(name); return; }
    if (switchOpen) { switchOpen = false; fanPin = false; }
    if (aside) { aside = null; rooms.close(); }
    // 열지 못하면 그 까닭도 펼침에서 말한다(펼침에서 고른 때와 같다, 0.4.95 카본 D2)
    void runOpenSpace(name).then(() => { if (!disposed && feedback.switch && space !== name && clientMode() === 'app' && !switchOpen) sayInSwitch(feedback.switch); });
  }
  function sayInSwitch(line) {
    if (disposed || clientMode() !== 'app') return;
    if (!switchOpen) openSwitch({ pin: true });
    feedback.switch = line;
    render();
  }
  function onEmbedEvent(name, value) {
    if (disposed || !value || typeof value !== 'object') return;
    if (value.type === 'focus-band' && bandOn() && space === name) { focus('here'); render(); }
    else if (value.type === 'reveal') revealSpace(name);
    else if (value.type === 'open') openFromMain(name);
    // 본체가 스스로 숨겼다(화면 문서를 새로 싣기 시작했다가 그만둔 따위). 보낸 값을 잊고 지금 값을 다시 보낸다(3단계 설계 검토 R13)
    else if (value.type === 'hidden') { const slot = slotOf(name); if (slot) slot.sent = ''; render(); }
  }
  function onEmbedChange(name, value) {
    if (disposed) return;
    const slot = slotOf(name);
    if (!slot) return;
    const open = value?.open === true;
    if (open === slot.open) return;
    slot.open = open;
    // 뷰가 사라지면 다음 열림에서 자리를 다시 보낸다. Workspace가 닫히면 묻던 화면 공유 고르기도 거둔다
    if (!open) { slot.sent = ''; if (name === 'workspace' && share) answerShare(null); }
    render();
  }
  /* 화면 공유 고르기(4단계 4.2). 본체가 보낸 목록을 방 자리에 세우고 뷰를 숨긴다. 빈 목록은 본체가 물음을 거둔 것이다 */
  function onShareAsk(value) {
    if (disposed || !value || typeof value !== 'object' || !Number.isInteger(value.id)) return;
    const items = Array.isArray(value.items) ? value.items.slice(0, 24).map(item => ({ name: trimmed(item?.name) || '이름 없는 창', kind: item?.kind === 'screen' ? 'screen' : 'window', thumb: typeof item?.thumb === 'string' && item.thumb.startsWith('data:image/') ? item.thumb : '' })) : [];
    if (!items.length) { if (share && share.id === value.id) { share = null; embedFocusNext = true; render(); } return; }
    // 지금 Workspace에 있지 않으면 고를 수 없다. 바로 거절한다
    if (clientMode() !== 'app' || space !== 'workspace' || !slotOf('workspace')?.open) { void Promise.resolve(slotOf('workspace')?.embed.answerShare?.({ id: value.id, pick: null })).catch(() => {}); return; }
    share = { id: value.id, items };
    focus('share');
    render();
  }
  function answerShare(pick) {
    const asked = share;
    if (!asked) return;
    share = null;
    embedFocusNext = true;
    try { void Promise.resolve(slotOf('workspace')?.embed.answerShare?.({ id: asked.id, pick: Number.isInteger(pick) && pick >= 0 && pick < asked.items.length ? pick : null })).catch(() => {}); } catch { /* 본체가 시간으로 거절한다 */ }
    render();
  }
  /* 띠의 닫기 글(「PULSE 닫기」, 「Workspace 닫기」, 3단계 설계 검토 R6). 쓰던 글이 있으면 본체가 묻는다. 닫히면 회원은 솔리오로, 손님은 묻는 화면으로 간다 */
  async function closeSpace(name = space) {
    const slot = slotOf(name);
    if (disposed || !bandOn() || space !== name || !slot?.open || slot.closing || busyAction !== null || typeof slot.embed.close !== 'function') return;
    slot.closing = true;
    // 손님의 「로그인」은 펼침에서 온다. 묻는 동안 펼침을 닫아 두어야 남기면 그 공간이 곧 다시 보인다
    if (switchOpen) { switchOpen = false; fanPin = false; feedback.switch = ''; }
    if (share) answerShare(null);
    render();
    let outcome = 'kept';
    try { outcome = (await slot.embed.close())?.outcome || 'kept'; } catch { outcome = 'kept'; }
    slot.closing = false;
    if (disposed) return;
    if (outcome === 'kept' || clientMode() !== 'app' || space !== name) { if (outcome === 'kept') embedFocusNext = true; render(); return; }
    if (name === 'pulse' && guestPulse && machine.read().authStatus !== 'signed-in' && !machine.read().accountKey) { guestPulse = false; leaveToAsk({ status: 'signed-out' }); render(); return; }
    enterSpace('solio', { fromSwitch: true });
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
    syncEmbed();
    syncClock(scene);
    syncAuthRecheck(scene);
    // 모델별 토큰의 실시간은 구독 방이 보이는 동안 부탁한다(11-20부터 맨 위 「지금 출력」이 늘 보인다, 솔리오 구독 비서 설계 3.3)
    rooms.syncLive(scene.mode === 'app' && scene.layer === 'app' && space === 'solio' && scene.room?.prog === 'subs' && !aside && !isHidden(), Boolean(scene.room?.solio?.brief?.live));
    syncBackupPoll(scene.mode === 'app' && scene.layer === 'app' && space === 'solio' && scene.room?.prog === 'backup' && !aside && !isHidden(), Boolean(scene.room?.backup?.busy));
    syncOffice(scene);
  }
  /* 사무실(구현설계 3.4의 8, 7절). 방이 보이는 동안만 본체의 기록 살피기를 켜고 15초마다 다시 그린다(분 글). 방을 떠나면 끄고 방의 화면 상태를 지운다.
   * 솔리오가 보이고 이 계정이 사무실을 볼 수 있으면 1분마다 판을 다시 읽는다. 다른 프로그램을 보고 있어도 오브제의 느낌표가 맞는다.
   * scene이 null이면(창이 가려짐, 끝냄) 모두 끈다 */
  function syncOffice(scene) {
    const api = readApi.office;
    const app = !!scene && !disposed && scene.mode === 'app' && space === 'solio' && !isHidden();
    const shown = app && scene.layer === 'app' && scene.room?.prog === 'office' && !aside;
    if (api && typeof api.onChanged === 'function' && officeOff === null && !disposed) {
      try {
        const off = api.onChanged(() => {
          // 바뀜 알림이 몰려 와도 한 번만 다시 읽는다
          if (disposed || officeChange !== null) return;
          // 처음 권한을 받은 회원도 열린 솔리오에서 본체의 새 판을 읽는다.
          officeChange = setTimer(() => {
            officeChange = null;
            if (!disposed && clientMode() === 'app' && space === 'solio' && !isHidden() && solioReadable(machine.read())) syncRead('office', { again: true });
          }, OFFICE_TIMING.changed);
        });
        officeOff = typeof off === 'function' ? off : () => {};
      } catch { officeOff = () => {}; }
    }
    if (shown !== officeWatching) {
      officeWatching = shown;
      if (!shown) office.close();
      let pending;
      try { pending = typeof api?.watch === 'function' ? Promise.resolve(api.watch(shown)) : null; } catch { pending = null; }
      // 켠 뒤에는 살핀 결과를 한 번 더 읽는다(첫 살피기가 끝난 판)
      if (shown && pending) pending.catch(() => null).then(() => { if (!disposed && officeWatching) syncRead('office', { again: true }); });
    }
    if (shown && officeClock === null && typeof setTick === 'function') officeClock = setTick(() => { if (!isHidden()) render(); }, OFFICE_TIMING.clock);
    else if (!shown && officeClock !== null) { clearTick(officeClock); officeClock = null; }
    const poll = app && reads.office.result?.available === true;
    if (poll && officePoll === null && typeof setTick === 'function') officePoll = setTick(() => { if (!isHidden()) syncRead('office', { again: true }); }, OFFICE_TIMING.poll);
    else if (!poll && officePoll !== null) { clearTick(officePoll); officePoll = null; }
  }
  /* 백업 방이 보이는 동안만 본체에 다시 묻는다. 설치 단계와 엔진의 상태 파일이 바뀌는 것을 보여 주려는 것이다 */
  function syncBackupPoll(on, busy) {
    const ms = on && !disposed ? (busy ? BACKUP_POLL.busy : BACKUP_POLL.idle) : 0;
    if (ms === backupPollMs) return;
    if (backupPoll !== null) { clearTick(backupPoll); backupPoll = null; }
    backupPollMs = ms;
    if (ms) backupPoll = setTick(() => syncRead('backup', { again: true }), ms);
  }
  /* 백업 방의 단추. 본체가 계정과 낱말을 다시 확인한다. 누른 뒤 곧바로 다시 읽어 단계를 보인다 */
  function backupAction(name, arg) {
    const api = readApi.backup;
    if (!api || space !== 'solio' || prog !== 'backup' || clientMode() !== 'app') return false;
    const call = name === 'backup-start' ? api.start?.(arg) : name === 'backup-open' ? api.open?.(arg) : api.dismiss?.();
    backupNotice = null;
    Promise.resolve(call).catch(() => ({ ok: false })).then(result => {
      if (disposed) return;
      const text = backupActionNotice(result);
      backupNotice = text ? { text, at: now() } : null;
      syncRead('backup', { again: true });
      if (text) render();
    });
    return true;
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
    if (space === 'solio') syncReads();
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
    // 뷰가 있는 공간에 도착하면 뷰가 보일 때 자판 초점을 뷰로 보낸다(3단계 설계 검토 R3)
    if (slotOf(space)) embedFocusNext = true;
    render();
    if (space === 'solio') startSolio({ arriving: true });
    // 들어가는 동안 온 「돌아가서 저장」을 이제 잇는다(3단계 화면 Fable F1)
    if (pendingReveal) { const name = pendingReveal; pendingReveal = null; revealSpace(name); }
    else if (pendingMainOpen && space !== pendingMainOpen) { const name = pendingMainOpen; pendingMainOpen = null; openFromMain(name); }
    else pendingMainOpen = null;
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

  function rememberAssigned(destinations, accountKey, check = null) {
    const list = (Array.isArray(destinations) ? destinations : []).map(d => SPACE_OF_DEST[normalizePortalWorkspaceDestination(d)]).filter(Boolean);
    assigned = [...new Set(list)];
    assignedAccount = accountKey || null;
    assignedCheck = accountKey && check && typeof check.status === 'string' ? { status: check.status } : null;
  }

  /* 펼침의 「다시 확인」: 들어온 채로 배정만 다시 읽어 펼침 목록과 까닭을 새로 쓴다. 회사 공간을 열지 않는다(PC 검수 F1) */
  async function recheckSpaces() {
    if (disposed || busyAction !== null || typeof options.onRecheckSpaces !== 'function') return;
    const snap = machine.read();
    if (!snap.accountKey || assignedAccount !== snap.accountKey) return;
    const runId = ++asyncSeq;
    busyAction = 'recheck-spaces';
    feedback.switch = '';
    render();
    const stillSame = () => !disposed && runId === asyncSeq && machine.read().accountKey === snap.accountKey && machine.read().generation === snap.generation;
    try {
      const result = await options.onRecheckSpaces({ accountKey: snap.accountKey, generation: snap.generation });
      if (!stillSame()) return;
      if (result && result.ok !== false) {
        if (result.assignmentCheck && typeof result.assignmentCheck.status === 'string') {
          // 다 확인되지 않은 답(일부 · 추가 로그인 · 확인 불가)은 이미 아는 공간을 지우지 않는다. 새로 확인된 공간만 더하고 까닭을 바꾼다(카본 A2)
          mergeAssigned(result.destinations, snap.accountKey);
          assignedCheck = { status: result.assignmentCheck.status };
        } else rememberAssigned(result.destinations, snap.accountKey, null);
      }
      else feedback.switch = faceSentence(result?.message) || '회사 공간을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    } catch {
      if (stillSame()) feedback.switch = '회사 공간을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    } finally {
      if (runId === asyncSeq) busyAction = null;
      if (!disposed) render();
    }
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
        // 호스트는 고르기 화면 없이 솔리오로 보내며 배정된 공간 목록만 넘긴다. 펼침이 그 공간을 안다(유호님 11-21).
        // 조회가 다 확인되지 않았으면 그 까닭도 넘긴다. 펼침이 「다시 확인」을 둔다(PC 검수 F1)
        rememberAssigned(result.destinations || [], startAccountKey, result.assignmentCheck);
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
      // 직원 문서가 초대를 받은 뒤 답을 잃었다(HANDOFF_UNCONFIRMED). 그 문서는 Workspace 뷰에 남아 있으니 회원은 Workspace로 데려가 이어 가게 한다(4단계 설계 3.4, 검토 R5)
      if (result && result.ok === false && result.code === 'HANDOFF_UNCONFIRMED' && slotOf('workspace')?.open && (machine.read().authStatus === 'signed-in' || machine.read().accountKey)) {
        view.setInviteValue?.('');
        after = () => completeEntryWith({ destination: '/' });
        return;
      }
      if (result && result.ok === false) {
        if (view.getInviteValue?.() !== rawValue) view.setInviteValue?.(rawValue);
        feedback.inviteError = sanitizeInviteFeedback(result.message, rawValue, validated.value) || '이 초대코드를 확인하지 못했습니다. 받은 코드를 다시 붙여 넣어 주세요.';
        focus('retry');
        return;
      }
      view.setInviteValue?.('');
      const target = SPACE_OF_DEST[normalizePortalWorkspaceDestination(result?.destination)] || null;
      // 토큰을 갱신하는 회원(accountKey는 남고 authStatus만 잠깐 바뀜)도 회원 길로 간다. 손님으로 보면 「PULSE 닫기」가 묻는 화면으로 데려갔다(0.5.2 공개 후보 카본 B1)
      if (result?.keepOpen !== true && (machine.read().authStatus === 'signed-in' || machine.read().accountKey) && target) {
        after = () => completeEntryWith({ destination: result.destination });
        return;
      }
      // 손님의 PULSE 초대는 창 안의 PULSE로 들어간다. 바깥 창이 없으니 들어가지 않으면 PULSE가 보이지 않는다(설계 검토 R1)
      if (result?.keepOpen !== true && target === 'pulse' && embed) {
        after = () => { guestPulse = true; completeEntryWith({ destination: result.destination }); };
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
    // Esc가 아닌 닫기(바깥 누름, 다시 누름, 지금 공간 고르기)는 다시 보이는 PULSE로 초점을 보낸다. Esc는 작은 구에 남는다(2단계 규칙, 설계 검토 R3)
    else if (bandOn()) embedFocusNext = true;
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
    // 창 안의 PULSE가 살아 있거나 손님의 PULSE면 배정을 망으로 다시 묻지 않고 본체의 PULSE 열기(있던 뷰를 다시 씀)로 간다.
    // 겉은 이 계정의 것이다. 계정이 바뀌면 본체가 닫는다(설계 검토 R7)
    const slot = slotOf(target);
    const direct = !!slot && typeof slot.embed.open === 'function' && (slot.open || (target === 'pulse' && guestPulse));
    let result;
    try {
      result = direct ? await slot.embed.open() : await options.onOpenSpace(dest, context);
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
    // 방에서 연 옛 화면(마을 기록)이면 그 방으로 돌아오고, 초점은 옛 화면을 연 단추로 간다(설계 9.1).
    // 옛 내 계정 화면에서 이름 · 로그인한 곳 · 삭제 요청을 바꿨을 수 있어, 내 계정 방으로 돌아오면 조용히 다시 읽는다(검수)
    if (aside === 'account') rooms.reloadAccount?.();
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
    // 「계정」은 내 계정 방을, 「설정」은 설정 방을 연다(2단계 둘째 조각 설계 9.3). 설정 방은 손님에게도 있다
    if (action === 'account') { if (rooms.hasAccount()) openAside('account'); else openLegacy('account'); return; }
    if (action === 'settings') { openAside('settings'); return; }
    if (action === 'recheck-spaces') { void recheckSpaces(); return; }
    // 손님의 「로그인」은 묻는 화면으로 돌아간다. 살아 있는 손님 PULSE는 「PULSE 닫기」와 같은 문으로 먼저 닫는다.
    // 쓰던 글을 남기면 PULSE에 머문다. 숨은 PULSE를 묻는 화면 뒤에 남기면 「돌아가서 저장」이 돌아올 곳이 없다(카본 A1)
    if (action === 'signin') {
      if (!guestPulse || machine.read().accountKey) return;
      if (embeds.pulse?.open && typeof embed?.close === 'function') { void closeSpace('pulse'); return; }
      guestPulse = false; leaveToAsk({ status: 'signed-out' }); render(); return;
    }
    if (action === 'logout') {
      // 로그아웃 확인(쓰던 글 물음)이 뜨는 동안에는 PULSE 뷰가 그 대화상자를 가리지 않게 숨겨 둔다(설계 검토 R11)
      signingOut = true;
      closeSwitch();
      const done = () => { signingOut = false; if (!disposed) render(); };
      try { void Promise.resolve(options.onSignOut?.()).then(done, done); } catch { done(); /* 옛 런처가 알림으로 알린다 */ }
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
    assignedCheck = null;
    guestPulse = false;
    stopSolio();
    stopReads();
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
      // 들어올 때 읽을 수 없었던(갱신 중) 방문자 분석과 계정 건강은 읽을 수 있게 되면 한 번 읽는다
      syncReads();
    } else {
      // 솔리오 밖에서 계정이 바뀌거나 회원이 아니게 되어도 앞 계정의 답을 남기지 않는다
      const who = memberShown(after) ? after.accountKey : null;
      for (const key of READ_PROGRAMS) if (reads[key].account !== undefined && reads[key].account !== who) stopRead(key);
    }
    return machine.read();
  }

  /* ── 솔리오 첫 화면의 자료(설계 8절) ── */
  function startSolio({ arriving = false } = {}) {
    const state = machine.read();
    // 누구의 자료인지는 회원 판정과 같은 기준이다(다시 검수). 읽는 때는 본체의 관문을 따른다(아래)
    const account = memberShown(state) ? state.accountKey : null;
    if (sol.account !== account) { stopSolio(); sol.account = account; }
    syncReads();
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
    // 방이 열린 채 계정이 정해지면(솔리오에서 방을 연 뒤 계정 열쇠가 늦게 오는 때) 그 방을 새로 열어 다시 읽는다. 빈 방으로 남기지 않는다(검수)
    if (aside && !disposed) rooms.open(aside);
    sol.seq += 1;
    // 솔리오 회차. 읽기마다 오르는 seq와 달리 로그아웃 · 계정 바뀜으로 솔리오를 닫을 때만 오른다(0.4.95 원천 후보 검수 D3)
    sol.run += 1;
    if (sol.timer !== null) { clearTimer(sol.timer); sol.timer = null; }
    if (sol.authTimer !== null) { clearTimer(sol.authTimer); sol.authTimer = null; }
    try { sol.unsubscribe?.(); } catch { /* 무시 */ }
    Object.assign(sol, { account: undefined, snapshot: null, error: null, checking: false, rereadFailed: false, autoDone: false, busyRetried: false, authRetried: false, loading: false, rereadAfterAuth: false, authChecking: false, authChecks: 0, unsubscribe: null, diagMemo: null, briefCache: null });
  }
  /* ── 솔리오 「방문자 분석」과 「계정 건강」의 자료(사이트방문 설계 6절, 계정건강 PC앱_구현설계 10절) ── */
  function stopRead(key) {
    const r = reads[key];
    r.seq += 1;
    if (r.timer !== null) clearTimer(r.timer);
    Object.assign(r, { account: undefined, result: null, loading: false, done: false, retried: false, timer: null, again: false });
    if (prog === key) prog = 'subs';
    // 사무실 방의 화면 상태(쓰던 이름, 열어 둔 묶음, 늦게 올 답)도 앞 계정의 것을 남기지 않는다
    if (key === 'office') office.reset();
  }
  function stopReads() { for (const key of READ_PROGRAMS) stopRead(key); }
  function syncReads(opts) { for (const key of READ_PROGRAMS) syncRead(key, opts); }
  /* 지금 회원의 요약을 읽는다. 솔리오를 열 때 한 번 읽고, again이면 그 프로그램을 열 때 다시 읽는다.
   * 본체는 로그인한 회원에게만 답하고, 볼 계정이 아니면 available:false로 답한다. 방문자 분석은 그때 이 계정을 대기 목록에 남기고(site-visits.cjs),
   * 계정 건강도 그 목록으로 볼 계정을 정한다. 그래서 솔리오를 열 때 방문자 분석을 묻는 호출은 계정 건강과 상관없이 그대로 둔다(계정건강 설계 7절의 전제) */
  function syncRead(key, { again = false } = {}) {
    const r = reads[key], api = readApi[key];
    const state = machine.read();
    const account = memberShown(state) && state.accountKey ? state.accountKey : null;
    if (r.account !== account) { stopRead(key); r.account = account; }
    // 읽는 중에 다시 읽기 부탁이 오면 표시만 남기고, 그 읽기가 끝난 뒤 한 번 더 읽는다(백업 방에서 누른 직후의 다시 읽기가 주기 읽기에 묻히지 않게, Fable 최종 검수 F5)
    if (r.loading && again) { r.again = true; return; }
    if (!api || !account || state.phase !== 'entered' || space !== 'solio' || !solioReadable(state) || r.loading) return;
    if (r.done && !again) return;
    const my = ++r.seq;
    r.loading = true;
    let pending;
    try { pending = Promise.resolve(api.snapshot()); } catch { pending = Promise.resolve(null); }
    pending.catch(() => null).then(res => {
      if (my === r.seq) { r.loading = false; if (r.again) { r.again = false; setTimer(() => { if (!disposed) syncRead(key, { again: true }); }, 0); } }
      // 늦게 온 답은 그 계정이 지금도 같은 회차일 때만 받는다. 로그아웃 뒤 같은 계정으로 다시 들어와도 앞 회차의 답은 버린다
      if (disposed || my !== r.seq || r.account !== account || machine.read().accountKey !== account) return;
      r.done = true;
      // 갱신 중이라 본체가 거절한 답은 「볼 수 없음」이 아니다. 앞에 받은 답을 그대로 두고, 받은 답이 없으면 읽을 수 있게 된 뒤 한 번 더 읽는다.
      // 기다리는 동안 이미 읽을 수 있게 되었으면(그때 온 알림은 읽는 중이라 막혔다) 1초쯤 뒤 한 번 더 읽는다(0.4.97 검수 A2).
      // 읽기가 예외로 끝났으면(답 없음) 앞에 받은 답을 지우지 않는다. 줄이 떴다 사라지지 않게 한다(0.4.97 검수 A1).
      // 받은 답이 없으면 읽은 것으로 치지 않는다. 다음 알림이나 솔리오에 다시 올 때 읽고, 1초쯤 뒤 한 번은 스스로 다시 읽는다(0.4.97 최종 검수 F3)
      if (!res || typeof res !== 'object' || (res.ok === false && res.code === 'SIGN_IN_REQUIRED')) {
        if (!r.result) {
          r.done = false;
          if (!r.retried && r.timer === null && solioReadable(machine.read())) { r.retried = true; r.timer = setTimer(() => { r.timer = null; syncRead(key); }, ORB_TIMING.busyRetry); }
        }
        render();
        return;
      }
      r.retried = false;
      r.result = res;
      render();
    });
  }
  /* 오브제를 눌렀거나 그 위에 머물렀을 때. 솔리오의 첫 화면에서 회원에게 있는 프로그램만 연다 */
  function showProgram(name) {
    if (space !== 'solio' || clientMode() !== 'app' || switchOpen) return false;
    const state = machine.read();
    const programs = programsFor(state, readScenes(state));
    if (!programs.some(p => p.key === name)) return false;
    // 오브제를 누르면 열려 있던 방을 닫는다(시안 1343~1345행)
    const hadAside = aside !== null;
    if (hadAside) { aside = null; rooms.close(); }
    if (prog !== name || hadAside) { prog = name; render(); }
    if (READ_PROGRAMS.includes(name)) syncRead(name, { again: true });
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
      // 화면 공유 고르기의 답(4단계 4.2). 인자는 목록의 번호다
      case 'share-pick': answerShare(Number.parseInt(String(payload ?? ''), 10)); return true;
      case 'share-cancel': answerShare(null); return true;
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
        // 사무실 방의 줄 동작은 office-room.mjs가 받는다. 방을 떠나며 접힌 줄의 알림(row-fold)은 방을 떠난 뒤에 와도 받는다(끝냄을 본 것으로)
        if (payload.room === 'solio-office') {
          if (!['row-open', 'row-fold', 'disarm'].includes(payload.act) && (aside || space !== 'solio' || prog !== 'office')) return false;
          void office.handle(payload);
          return true;
        }
        if (!aside && payload.room !== 'solio') return false;
        void rooms.handle(payload);
        return true;
      case 'reread': void reread(); return true;
      // 구독 방 맨 위 「지금 출력」의 「켜기」. 모델별 토큰 줄의 켜기와 같은 일이다(솔리오 구독 비서 설계 3.3)
      case 'tok-on':
        if (clientMode() !== 'app') return false;
        void rooms.handle({ room: 'solio', key: 'tok', act: 'tok-on', arg: '', fields: {} });
        return true;
      case 'prog': return showProgram(payload);
      case 'backup-start': case 'backup-open': case 'backup-dismiss': return backupAction(action, typeof payload === 'string' ? payload : '');
      case 'recheck-auth': void recheckAuth(); return true;
      case 'reopen-space': void runOpenSpace(space, { reopen: true }); return true;
      case 'band-f6': if (!embedVisible()) return false; void Promise.resolve(slotOf(space)?.embed.focus?.()).catch(() => {}); return true;
      case 'pulse-close': case 'band-close': void closeSpace(space); return true;
      case 'legacy-back': closeLegacy(); return true;
      case 'qa-guest': void runQaGuest(); return true;
      case 'pageshow': if (payload === true) releaseNavigationHold(); return true;
      case 'visible': if (!isHidden()) render(); return true;
      // 창이 가려지면 모델별 토큰의 실시간 부탁을 거둔다(설계 3.4)
      case 'hidden': rooms.syncLive(false); syncOffice(null); return true;
      case 'escape': return escape();
      default: return false;
    }
  }

  function escape() {
    const state = machine.read();
    const mode = clientMode();
    // 화면 공유 고르기가 서 있으면 Esc는 고르지 않음이다(4단계 6.4)
    if (share && mode === 'app') { answerShare(null); return true; }
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
      stopReads();
      aside = null;
      if (clockTimer !== null) { clearTick(clockTimer); clockTimer = null; }
      if (backupPoll !== null) { clearTick(backupPoll); backupPoll = null; backupPollMs = 0; }
      if (officeWatching) { officeWatching = false; try { void Promise.resolve(readApi.office?.watch?.(false)).catch(() => {}); } catch { /* 본체의 일이다 */ } }
      if (officeClock !== null) { clearTick(officeClock); officeClock = null; }
      if (officePoll !== null) { clearTick(officePoll); officePoll = null; }
      if (officeChange !== null) { clearTimer(officeChange); officeChange = null; }
      try { officeOff?.(); } catch { /* 무시 */ }
      officeOff = null;
      if (hadBusyInvite) options.onCancelInvite?.();
      // 얼굴이 없어지면 PULSE 뷰를 숨긴다(본체도 화면 문서가 바뀌면 숨긴다). 뷰와 쓰던 글은 본체에 그대로 산다
      for (const slot of Object.values(embeds)) { try { void Promise.resolve(slot.embed.place({ visible: false, top: PULSE_BAND })).catch(() => {}); } catch { /* 본체의 일이다 */ } }
      if (share) { const asked = share; share = null; try { void Promise.resolve(slotOf('workspace')?.embed.answerShare?.({ id: asked.id, pick: null })).catch(() => {}); } catch { /* 본체가 시간으로 거절한다 */ } }
      for (const off of embedOff.splice(0)) { try { off(); } catch { /* 무시 */ } }
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
