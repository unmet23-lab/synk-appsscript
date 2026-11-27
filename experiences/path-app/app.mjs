import { GOALS, OPPORTUNITIES, OFFICIAL_LINKS, EXISTING_TOOLS } from './content.mjs';
import { createPathSession } from './account.mjs';
import { renderAccountPanel, renderAccountNotice, getAccountErrorMessage } from './account-ui.mjs';
import { createJobsFeed, renderJobs, jobOpportunity } from './jobs-ui.mjs';
import { SCHEMA_VERSION, STORAGE_KEY, createInitialState, normalizeState, updateProfile, upsertTask, confirmTask, getNextTask } from './state.mjs';
import { PROGRAMS, RULES, rulesAt, programsFor } from './study-data.mjs';
import { createProfileStore, createProfile, setField, toggleCompare, parseWhole, GUEST_OWNER, MAX_DATES, addDate, removeDate, confirmDate, keepDates, toggleChannel, setTarget, toggleDoc } from './study-profile.mjs';
import { normalizeProfile as normalizeStudyProfile } from './study-profile.mjs';
import { createStudyAccount } from './study-account.mjs';
import { renderStudyConsent, renderStudyNotices, renderStudyAccountSettings } from './consent-ui.mjs';
import { POSTS, allPosts, findDate, endDay, dateStatus } from './channel-data.mjs';
import { renderChannels, renderPost, renderUpcoming, renderNews, icsText } from './channel-ui.mjs';
import { renderPath, renderPathCard, renderPathPick, pathTarget, stageCounts } from './path-ui.mjs';
import { docsFor, translateKindOf, translateKindChoice } from './docs-data.mjs';
import { renderTranslate, draftText, countText as trCountText, ERROR_TEXT } from './translate-ui.mjs';
import { splitPasted, maskLines, validateTranslateRequest, validateTranslateReply, validateCheckReply, draftRows, TRANSLATE_CONSENT_VERSION } from './translate-shape.mjs';
import { docCheckItems, docCheckRows, validateDocCheckRequest, validateDocCheckReply, DOC_CHECK_CONSENT_VERSION } from './doc-check.mjs';
import { renderDocCheck, dcCanSend, dcMarkKey, DC_ERROR_TEXT } from './doc-check-ui.mjs';
import { INTERVIEW_PROGRAMS } from './interview-shape.mjs';
import { createAskController } from './ask-app.mjs';
import { renderUniv, renderUnivDetail, renderUnivCompare, renderCond, renderCondResult, renderStudyEntry, studyCountSay, condHint, STUDY_FILTERS, GRADE_MAX, FUNDS_MAX_MAN } from './study-ui.mjs';

void SCHEMA_VERSION; void STORAGE_KEY;
const root = document.getElementById('app');
const announcer = document.getElementById('announcer');

// 화면 결: 「패스」 — 줄에 매단 카드 한 장(내 목표)과 한 걸음마다 찍히는 도장. 2026-11-13 리디자인(시안 C).
const DICT = {
  langLabel: ['언어', 'Language'], navLabel: ['주요 메뉴', 'Main menu'],
  today: ['오늘', 'Today'], channels: ['채널', 'News'], univ: ['대학', 'Schools'], explore: ['찾기', 'Explore'], prepare: ['준비', 'Prepare'], help: ['도움', 'Help'], profile: ['나', 'Me'],
  signIn: ['가입 · 로그인', 'Sign in'], myAccount: ['내 계정', 'My account'], ask: ['물어보기', 'Ask'],
  q1: ['지금, 어떤 준비를 하고 있나요?', 'What are you preparing for right now?'],
  obT1: ['한국에서 쓸', 'Pick the first card'], obT2: ['첫 카드를 고르세요.', 'you’ll carry in Korea.'],
  obLead: ['지금, 어떤 준비를 하고 있나요? 맞는 카드를 고르면 첫 화면이 그 준비에 맞춰져요.', 'What are you preparing for right now? Pick a card and your first screen will match it.'],
  startCard: ['이 카드로 시작', 'Start with this card'], browse: ['둘러보기만 할게요', 'Just browse for now'],
  obFine: ['고른 카드는 나중에 바꿀 수 있어요.', 'You can change your card later.'], fineTune: ['조금 더 맞추기', 'Fine-tune'],
  obHint: ['카드를 누르면 앞으로 나와요.', 'Tap a card to bring it forward.'], picked: ['고른 카드', 'Your card'],
  step2: ['선택 · 조금 더 맞추기', 'Optional · Fine-tune'],
  next: ['다음', 'Next'], skip: ['건너뛰기', 'Skip'], back: ['이전', 'Back'], cancel: ['취소', 'Cancel'], start: ['이 카드로 시작', 'Start with this card'], save: ['저장', 'Save'],
  q2: ['조금 더 알려 주세요.', 'Tell us a little more.'], q2lead: ['모두 선택 사항이에요.', 'Everything here is optional.'],
  interests: ['관심 있는 것', 'Interests'], secondary: ['함께 보고 싶은 목표', 'Other goals to follow'], location: ['지금 있는 곳', 'Where you are now'],
  locHint: ['카드에 맞춰 미리 골라 두었어요. 바꿀 수 있어요.', 'Pre-selected from your card. You can change it.'],
  abroad: ['해외', 'Abroad'], korea: ['한국', 'Korea'], unknown: ['정하지 않음', 'Not decided'],
  myCard: ['내 카드', 'Your card'], changeCard: ['카드 바꾸기', 'Change card'], pickCard: ['카드 고르기', 'Pick a card'], nextStep: ['다음 한 걸음', 'Next step'],
  hNone1: ['오늘은 여기부터예요.', 'Start here today.'], hNone2: ['기회를 둘러보고 하나를 골라요.', 'Browse and pick one to prepare.'],
  hDraft1: ['첫 도장을 받았어요.', 'You got your first stamp.'], hDraft2: ['이제 자료를 준비할 차례예요.', 'Now it’s time to prepare your materials.'],
  hDone1: ['도장 세 개를 모두 받았어요.', 'All three stamps collected.'], hDone2: ['이제 공식 창구에 낼 차례예요.', 'Now it’s time to submit through the official channel.'],
  doneNext: ['다른 기회도 하나 더 준비해 볼까요?', 'Prepare for one more opportunity?'],
  nT1: ['어디서부터 시작할까요?', 'Where would you like to start?'], nT2: ['하나를 고르면 맞는 예시가 열려요.', 'Pick one to open matching examples.'],
  stampsLabel: ['준비의 세 칸', 'Three steps'], sDone: ['마침', 'Done'], sNow: ['지금', 'Now'], sNext: ['다음', 'Next'],
  j1: ['기회 찾기', 'Find opportunities'], j2: ['자료 준비', 'Prepare materials'], j3: ['직접 확인', 'Check it yourself'],
  n1: ['실제 정보와 연습용 예시를 구분해 둘러봐요.', 'Browse real information and practice examples, clearly labeled.'],
  n2: ['내 말로 답변 초안을 적어 두어요.', 'Draft your answers in your own words.'],
  n3: ['내가 확인하고, 실제 제출은 공식 경로로 해요.', 'Review it yourself; submit only through official channels.'],
  resume: ['이어서 쓰기', 'Continue writing'], resumeS: ['작성 중 · 아직 확인하지 않았어요', 'Drafting · not reviewed yet'], viewPrep: ['내 준비 보기', 'View my preparation'],
  homeOpps: ['연습 예시', 'Practice examples'], demoSub: ['실제 기관이나 공고가 아니에요', 'Not real institutions or postings'],
  offSub: ['새 탭에서 열려요', 'Opens in a new tab'],
  jobsOff: ['채용 공고 연결을 준비하고 있어요. 지금 공고는 공식 사이트에서 확인해 주세요.', 'We are preparing to connect job listings. For current openings, please check the official sites.'],
  demoNote: ['연습용 예시예요. 실제 기관이나 공고가 아니니, 실제 정보는 공식 안내에서 확인하세요.', 'Practice examples only, not real institutions or postings. Check official sources for real details.'],
  tools: ['SYNK의 다른 체험', 'Other SYNK experiences'], official: ['공식 안내', 'Official links'], officialBadge: ['공식', 'Official'], demo: ['예시', 'Example'],
  checked: ['확인일', 'Checked'], openNew: ['새 탭에서 열기', 'opens in new tab'],
  exploreTitle: ['기회 둘러보기', 'Explore opportunities'], exploreT2: ['공고와 연습 예시를 구분해서 봐요.', 'Real postings and practice examples, kept apart.'],
  all: ['전체', 'All'], filter: ['목표로 거르기', 'Filter by goal'], practice: ['연습 예시', 'Practice examples'],
  details: ['자세히', 'Details'], compareAdd: ['비교에 담기', 'Add to compare'], compareOn: ['비교 중', 'Comparing'], compareTitle: ['비교', 'Comparison'],
  compareMax: ['최대 3개까지 비교할 수 있어요.', 'You can compare up to 3.'], clearCompare: ['비교 비우기', 'Clear comparison'],
  requirements: ['준비할 내용', 'What to prepare'], prepareThis: ['이것 준비하기', 'Prepare for this'], backList: ['목록으로', 'Back to list'],
  prepareTitle: ['내 준비', 'My preparation'], prepareT2: ['쓰던 준비를 이어서 해요.', 'Pick up where you left off.'],
  noTasks: ['아직 시작한 준비가 없어요. 찾기에서 하나를 골라 보세요.', 'No preparation yet. Pick one in Explore.'],
  open: ['열기', 'Open'], draft: ['작성 중', 'Drafting'], done: ['준비 완료 · 미제출', 'Ready · Not submitted'],
  source: ['출처', 'Source'], srcK: ['지금 쓰는 준비', 'Now writing'], srcNote: ['연습용 예시예요. 실제 기관이나 공고가 아니에요.', 'A practice example, not a real institution or posting.'],
  liveNote: ['공식 채용 공고에서 가져왔어요. 조건은 원문에서 확인하세요.', 'From an official job posting. Check the original for conditions.'], reopen: ['다시 보기', 'View again'],
  edEyebrow: ['자료 준비', 'Prepare'], backPrep: ['내 준비', 'My preparation'],
  body: ['내 답변', 'Your answer'], savedGuest: ['이 탭에만 저장돼요', 'Stored only in this tab'], savedAccount: ['계정과 동기화돼요', 'Syncs with your account'],
  sealSlot: ['확인', 'Check'], confirmNote: ['준비 완료는 제출이 아니에요. 아무 곳에도 보내지 않아요.', 'Ready is not a submission. Nothing is sent anywhere.'],
  confirmCheck: ['내용을 직접 확인했고 실제 제출은 공식 경로로 한다는 것을 이해했어요', 'I reviewed this myself and understand real submission happens through official channels'],
  confirm: ['준비 완료로 표시', 'Mark as ready'], needBody: ['내용을 먼저 적어 주세요.', 'Please write something first.'], needCheck: ['확인 칸에 표시해 주세요.', 'Please tick the confirmation box.'],
  confirmed: ['준비 완료로 표시했어요. 아무 곳에도 제출되지 않았어요.', 'Marked as ready. Nothing was submitted anywhere.'],
  nextAction: ['다음 준비로', 'Go to next task'], exploreMore: ['다른 기회 보기', 'See other opportunities'], editInvalid: ['내용이 바뀌어 다시 확인이 필요해요.', 'Content changed; please confirm again.'],
  result: ['정리된 내용', 'Your summary'], missing: ['찾을 수 없는 항목이에요.', 'Item not found.'],
  helpTitle: ['도움 받기', 'Get help'], helpT2: ['물어볼 것을 정리해요.', 'Draft what to ask.'],
  helpLead: ['공식 기관에 물어볼 질문을 정리해요. 답을 대신 판단하지 않아요.', 'Draft a question for official sources. PATH does not judge answers.'],
  topic: ['주제', 'Topic'], general: ['일반 체류 안내', 'General stay info'], template: ['질문 틀', 'Question template'], copy: ['복사하기', 'Copy'],
  copied: ['복사했어요.', 'Copied.'], copyFail: ['복사하지 못했어요. 아래 글을 직접 선택해 복사하세요.', 'Copy failed. Select the text below and copy it manually.'],
  profileTitle: ['내 정보', 'Profile'], profileT2: ['계정 · 카드 · 언어 · 저장', 'Account, card, language and storage'], goal: ['내 카드', 'Your card'], none: ['고르지 않음', 'Not selected'], lang: ['언어', 'Language'],
  changeGoal: ['카드 바꾸기', 'Change card'], storage: ['저장 방식', 'Storage'],
  storageText: ['로그인하지 않으면 작성 내용은 이 탭에만 저장돼요. 로그인하면 이 탭의 자료를 계정으로 가져올지, 계정에 저장된 자료를 쓸지 고를 수 있어요. 공용 기기라면 사용 후 데이터를 지워 주세요.', 'Without signing in, drafts are saved only in this tab. When you sign in, you can choose to import this tab’s data into your account or use the data saved in your account. On a shared device, clear the data when you are done.'],
  deleteFail: ['저장된 데이터를 지우지 못했어요. 지금 상태는 그대로 두었어요.', 'Could not delete saved data. Your current state was kept as is.'],
  clear: ['이 탭의 PATH 데이터 지우기', 'Clear PATH data in this tab'], clearAsk: ['이 탭에 저장된 PATH 데이터를 지울까요?', 'Clear PATH data saved in this tab?'], cleared: ['지웠어요.', 'Cleared.'],
  blocked: ['저장된 데이터를 읽을 수 없어 저장을 멈췄어요. 원본은 그대로 두었고 지금 화면은 메모리로만 동작해요.', 'Saved data could not be read, so saving is paused. The original is untouched; this screen runs in memory only.'],
  reset: ['저장 데이터 초기화', 'Reset saved data'], resetAsk: ['읽을 수 없는 저장 데이터를 지우고 새로 시작할까요?', 'Delete unreadable saved data and start fresh?'],
  storeFail: ['이 탭에 저장하지 못했어요. 작성 내용은 화면에 남아 있어요.', 'Could not save in this tab. Your text stays on screen.'],
  pageAnn: ['페이지', 'page'],
  datesStore: ['「다가오는 날」은 계정에 저장되지 않고 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라져요.', '“Coming up” dates are not saved to your account; they stay in this tab only and disappear when you close the tab or sign out.'],
  studyStore: ['「내 조건」(한국어 · 성적 · 준비한 돈)과 「다가오는 날」은 계정에 저장되지 않고 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라져요.', '“My conditions” (Korean level, grades, funds) and “Coming up” dates are not saved to your account; they stay in this tab only and disappear when you close the tab or sign out.'],
  toolsLead: ['공식 안내와 별개인 SYNK 페이지예요. 새 탭에서 열리고 PATH 저장 내용과 분리돼요.', 'Separate SYNK pages, not official sources. They open in a new tab, apart from PATH data.']
};
const t = (k) => (DICT[k] || [k, k])[state.lang === 'en' ? 1 : 0];
const pick = (o) => (o ? o[state.lang] ?? o.ko : '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const goalById = (id) => GOALS.find((g) => g.id === id);
const oppById = (id) => {
  const demo = OPPORTUNITIES.find((o) => o.id === id);
  if (demo) return demo;
  const saved = (session.document()?.savedJobs || []).find((j) => j.id === id);
  return saved ? jobOpportunity(saved) : undefined;
};
const say = (m) => { announcer.textContent = ''; setTimeout(() => { announcer.textContent = m; }, 30); };

// 움직임: 매단 카드가 가만히 흔들리고, 고르면 튕긴다. 움직임 줄이기 설정 · 시험 환경(requestAnimationFrame 없음)에서는 멈춰 둔다.
const RM = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const MOTION = typeof requestAnimationFrame === 'function' && !(RM && RM.matches);
const bodies = new Map();
let raf = 0, lastTs = 0;
function sway() {
  if (!MOTION) return;
  for (const el of [...bodies.keys()]) if (!root.contains(el)) bodies.delete(el);
  root.querySelectorAll('.hang').forEach((el) => { if (!bodies.has(el)) bodies.set(el, { a: (Math.random() - 0.5) * 4, v: 0, amp: 0.8, ph: Math.random() * 6.283 }); });
  if (bodies.size && !raf) { lastTs = 0; raf = requestAnimationFrame(tick); }
}
function tick(ts) {
  const dt = Math.min(0.034, lastTs ? (ts - lastTs) / 1000 : 0.016); lastTs = ts;
  for (const [el, b] of bodies) {
    const target = b.amp * Math.sin(ts / 1000 * 1.3 + b.ph);
    b.v += (-36 * (b.a - target) - 2.4 * b.v) * dt; b.a += b.v * dt;
    el.style.setProperty('--a', `${b.a.toFixed(3)}deg`);
    el.style.setProperty('--shx', `${(12 + b.a * 1.8).toFixed(1)}px`);
  }
  raf = bodies.size ? requestAnimationFrame(tick) : 0;
}
const kick = (goal, v) => { if (MOTION) for (const [el, b] of bodies) if (el.dataset.goal === goal) b.v += v; };

let state, blocked = false, storageError = false, localMutation = false, hadDoc = false, activeOwner = null, wasOnboarded = false;
let composingEl = null, composingOwner = null, deferredRender = false, deferredFocus = false, compTimer = null, pendingBackup = null;
function cancelComposition() { composingEl = null; composingOwner = null; deferredRender = false; deferredFocus = false; if (compTimer) { clearTimeout(compTimer); compTimer = null; } }
const ownerKey = () => { const st = session.status(); return `${st.mode ?? ''}:${st.accountId ?? ''}`; };
function resetForDoc(doc) {
  cancelComposition(); pendingBackup = null;
  S.taskId = null; S.oppId = null; S.compare = []; S.step = 1; S.error = null; S.draft = newDraft();
  S.filter = state.primaryGoal || 'all'; S.help = state.primaryGoal || 'study';
  if (!doc?.state) S.page = 'profile';
  else if (!state.onboarded) S.page = session.status().canImportGuest ? 'profile' : 'onboard';
  else S.page = 'today';
}
// 「내 조건 · 대학」. 공개판(공개 묶음이 넣는 표시가 있는 화면)에는 예시 과정을 싣지 않는다. 실을 과정이 없으면 탭과 입구를 감춘다.
const PUBLIC_WEB = (() => { try { return document.querySelector?.('meta[name="synk-path-runtime"]')?.getAttribute('content') === 'public-web'; } catch { return false; } })();
const STUDY_PROGRAMS = programsFor(PROGRAMS, PUBLIC_WEB);
const STUDY_ON = STUDY_PROGRAMS.length > 0;
const STUDY_IDS = STUDY_PROGRAMS.map((p) => p.id);
// 채널: 손으로 쓴 글이 하나라도 있을 때만 탭을 연다. 「대학 소식」 글은 실을 과정에서 만든다(공개판에는 예시 과정이 없다).
const CHANNEL_POSTS = allPosts(STUDY_PROGRAMS);
const CHANNEL_ON = POSTS.length > 0;
// 조건은 계정 문서와 섞지 않고 이 탭에만 둔다. 저장값에 주인(손님 또는 계정 ID)을 함께 적는다.
// 손님이 넣은 조건은 로그인한 계정이 이어받는다. 주인이 다른 계정이거나 로그아웃 · 세션 만료로 손님이 되면 지운다(공용 기기).
// 시작할 때는 계정 상태가 정해지기 전이라 주인이 다르면 감추기만 하고, 정해진 뒤(studySettled)에 지운다.
const study = createProfileStore((() => { try { return sessionStorage; } catch { return null; } })());
let studySettled = false;
const studyOwnerNow = () => session.status().accountId || GUEST_OWNER;
function syncStudyOwner() {
  const now = studyOwnerNow(), saved = study.owner();
  if (saved === now) return false;
  if (saved === GUEST_OWNER) { study.setOwner(now); return false; }
  if (now === GUEST_OWNER && !studySettled) return false;
  study.clear(); if (now !== GUEST_OWNER) study.setOwner(now);
  S.studyText = {}; S.studyErrors = {}; S.univId = null; S.univFilter = 'all';
  return true;
}
// 계정의 유학 준비 문서(3-1b). 동의한 학생의 조건은 계정 문서에, 동의 전 · 거부 · 손님은 탭 저장(study)에 둔다.
// 이 탭에서 이 계정의 동의를 확인했으면(CONSENT_SEEN_KEY) 계정을 못 쓸 때 탭으로 몰래 돌아가지 않고 고침을 막는다.
const CONSENT_SEEN_KEY = 'synk-path-study-consent-seen';
const tabStorage = () => { try { return sessionStorage; } catch { return null; } };
const seenGet = () => { try { return tabStorage()?.getItem(CONSENT_SEEN_KEY) || null; } catch { return null; } };
const seenSet = (id) => { try { if (id) tabStorage()?.setItem(CONSENT_SEEN_KEY, id); else tabStorage()?.removeItem(CONSENT_SEEN_KEY); } catch {} };
const CONSENT_REFUSED_KEY = 'synk-path-study-consent-refused';
const refusedGet = () => { try { return tabStorage()?.getItem(CONSENT_REFUSED_KEY) || null; } catch { return null; } };
const refusedSet = (id) => { try { if (id) tabStorage()?.setItem(CONSENT_REFUSED_KEY, id); else tabStorage()?.removeItem(CONSENT_REFUSED_KEY); } catch {} };
let studyAcctId = null;
let studyCompared = null;
let studyGone = false;
const studyAcct = createStudyAccount({ request: (op, v) => session.studyRequest(op, v), storage: tabStorage(), onChange: (sn) => {
  if (!studyAcctId) return;
  // 다른 곳에서 지워진 것을 처음 알았을 때: 앞의 「계정에 저장했어요」 같은 알림을 지우고, 계정에 닿지 못한 이 탭의 고침만 탭에 남긴다.
  // 동의를 거둔 뒤이므로 다시 묻지 않는다(「나」의 「계정에 저장하기」로는 다시 저장할 수 있다).
  if (sn?.deletedElsewhere && !studyGone) {
    S.flash = null; S.consentAsk = false; S.consentRefused = true; refusedSet(studyAcctId);
    const op = studyAcct.takeOrphan();
    // 그 고침은 studyAcctId 계정의 것이다. 세션 계정이 그새 바뀌었으면(조합 중이라 계정 맞춤이 늦을 때) 버린다.
    if (op && session.status().accountId === studyAcctId) { const base = tabStudyProfile(); if (study.owner() !== studyAcctId) { study.clear(); study.setOwner(studyAcctId); } try { study.set(op(base)); } catch {} }
  }
  studyGone = !!sn?.deletedElsewhere;
  if (sn?.phase === 'none') { if (seenGet() === studyAcctId) seenSet(null); studyCompared = null; S.studyChoice = false; }
  if (sn?.phase === 'choose') seenSet(studyAcctId);
  // 동의하는 중(서버 확인 전)에는 견주지 않는다: 실패하면 탭의 조건이 그대로 남아야 한다.
  if (sn?.phase === 'consented' && studyCompared !== studyAcctId && !S.consentBusy) settleStudy(sn);
  render(false);
} });
// 이 계정의 동의 문서를 처음 받았을 때 한 번: 이 탭의 「동의 확인」을 남기고, 탭에도 넣은 것이 있으면 같으면 비우고 다르면 고르게 한다(고르기 전에는 지우지 않는다).
function settleStudy(sn) {
  studyCompared = studyAcctId; seenSet(studyAcctId);
  const tabP = tabStudyProfile();
  if (hasStudyData(tabP)) { if (sameStudy(tabP, sn.profile)) { study.clear(); study.setOwner(studyAcctId); } else S.studyChoice = true; }
}
// 연결이 돌아오면 올라가지 않은 변경을 다시 보낸다.
try { globalThis.addEventListener?.('online', () => { if (studyAcctId && studyAcct.snapshot().pending) void studyAcct.retry(); }); } catch {}
const STUDY_SCALARS = ['topik', 'gradePct', 'fundsWon', 'education', 'target'];
const STUDY_LISTS = { compare: (x) => x, channelsOff: (x) => x, dates: (x) => x.id, docs: (x) => x.id };
const hasStudyData = (p) => STUDY_SCALARS.some((k) => p[k] !== null && p[k] !== undefined) || Object.keys(STUDY_LISTS).some((k) => (p[k] || []).length > 0);
const sameStudy = (a, b) => JSON.stringify(normalizeStudyProfile({ ...a, v: 1 })) === JSON.stringify(normalizeStudyProfile({ ...b, v: 1 }));
// 판 충돌 때 계정 것 위에 다시 적용할 동작: 바뀐 칸만, 목록은 더하고 뺀 것만 옮긴다.
function studyDiff(before, after) {
  return (base) => {
    const out = { ...base };
    for (const k of STUDY_SCALARS) if (before[k] !== after[k]) out[k] = after[k];
    for (const [k, id] of Object.entries(STUDY_LISTS)) {
      const b = new Map((before[k] || []).map((x) => [id(x), x])), a = new Map((after[k] || []).map((x) => [id(x), x]));
      let list = (base[k] || []).filter((x) => !(b.has(id(x)) && !a.has(id(x))));
      for (const [key, v] of a) if (!b.has(key) || JSON.stringify(b.get(key)) !== JSON.stringify(v)) { const i = list.findIndex((y) => id(y) === key); if (i >= 0) list[i] = v; else list.push(v); }
      out[k] = list;
    }
    return normalizeStudyProfile({ ...out, v: 1 });
  };
}
function tabStudyProfile() {
  const o = study.owner();
  return o === GUEST_OWNER || o === studyOwnerNow() ? study.get() : createProfile();
}
/** 지금 조건을 어디에 두는지: 'account'(동의함) · 'blocked'(남은 초안 고르기, 또는 이 탭에서 동의를 확인했는데 지금 계정을 못 씀) · 'wait'(동의를 확인한 탭에서 불러오는 중) · 'tab'. */
function studyStore() {
  if (!studyAcctId) return 'tab';
  const phase = studyAcct.snapshot().phase;
  if (phase === 'consented') return 'account';
  if (phase === 'choose') return 'blocked';
  if (seenGet() === studyAcctId && phase === 'loading') return 'wait';
  if (seenGet() === studyAcctId && ['paused', 'error'].includes(phase)) return 'blocked';
  return 'tab';
}
const studyLocked = () => ['blocked', 'wait'].includes(studyStore());
// 조건 · 날 · 과정 · 표시 · 비교 · 채널을 바꾸는 동작. 막힌 동안에는 받지 않는다(바꾼 것처럼 알리지 않게).
const STUDY_WRITE_ACTS = new Set(['channelShow', 'dateToggle', 'dateConfirm', 'datesClean', 'studySet', 'studyClear', 'pathPick', 'docToggle', 'studyCompare']);
function studyStoreNote() {
  const where = studyStore();
  if (where === 'wait') return accL('계정에 저장한 조건을 불러오는 중이에요.', 'Loading the conditions saved to your account.');
  if (where === 'blocked') return studyAcct.snapshot().phase === 'choose'
    ? accL('계정에 올라가지 않은 변경이 남아 있어요. 위에서 어느 쪽을 쓸지 고르면 조건을 고칠 수 있어요.', 'Some changes never reached your account. Choose which to use above, then you can change conditions.')
    : accL('계정에 저장한 조건을 지금 불러오지 못해 고칠 수 없어요. 위의 「다시 시도」를 눌러 주세요.', 'Your saved conditions could not be loaded, so they cannot be changed right now. Press Retry above.');
  return '';
}
function syncStudyAccount() {
  const id = session.status().accountId || null;
  if (id === studyAcctId) return;
  studyAcctId = id; studyCompared = null; S.consentAsk = false; S.studyChoice = false;
  if (refusedGet() && refusedGet() !== id) refusedSet(null);
  S.consentRefused = !!id && refusedGet() === id;
  if (!id) { studyAcct.close(); seenSet(null); refusedSet(null); return; }
  void studyAcct.open(id).then(() => { if (studyAcctId === id) render(false); });
}
// 감춰 둔 남의 조건 위에 쓰지 않는다: 주인이 다르면 비우고 지금 주인 것으로 새로 쓴다.
function studyWrite(next) {
  const where = studyStore();
  if (where === 'blocked' || where === 'wait') return studyProfile();
  if (where === 'account') {
    // 계정과 탭이 다르다고 묻는 중에 계정 쪽 조건을 고치면 계정 것을 고른 것으로 본다(옛 탭 값으로 나중에 덮지 않게).
    if (S.studyChoice) { study.clear(); study.setOwner(studyAcctId); S.studyChoice = false; }
    const before = studyProfile(), after = normalizeStudyProfile({ ...next, v: 1 });
    try { studyAcct.write(after, studyDiff(before, after)); } catch { /* 고르기 · 불러오기 중: 알림이 막힌 까닭을 보인다 */ }
    return after;
  }
  if (study.owner() !== studyOwnerNow()) { study.clear(); study.setOwner(studyOwnerNow()); }
  const out = study.set(next);
  // 로그인했고 계정에 동의 문서가 없으면 한 번 묻는다. 누른 동작은 이미 탭에 반영됐다.
  if (studyAcctId && studyAcct.snapshot().phase === 'none' && !S.consentRefused && hasStudyData(out)) S.consentAsk = true;
  return out;
}
function studyProfile() {
  const where = studyStore();
  if (where === 'blocked' || where === 'wait') return createProfile();
  const p = where === 'account' ? normalizeStudyProfile({ ...studyAcct.snapshot().profile, v: 1 }) : study.owner() !== studyOwnerNow() ? null : study.get();
  if (!p) return createProfile();
  return { ...p, compare: p.compare.filter((id) => STUDY_IDS.includes(id)) };
}
const STUDY_PAGES = ['today', 'path', 'univ', 'univDetail', 'univCompare', 'cond', 'channels', 'post'];
function studyNoticesHtml() {
  if (!STUDY_ON || !studyAcctId || !STUDY_PAGES.includes(S.page)) return '';
  const sn = studyAcct.snapshot();
  return renderStudyNotices({ lang: state.lang, ask: S.consentAsk && sn.phase === 'none', choice: S.studyChoice && sn.phase === 'consented', drafts: sn.phase === 'choose', deleted: sn.deletedElsewhere, blocked: studyStore() === 'blocked' && sn.phase !== 'choose', pending: sn.phase === 'consented' && sn.sendFailed });
}
const session = createPathSession({
  configUrl: './config.json',
  onDocument(doc) {
    state = doc?.state || createInitialState(state?.lang || 'ko');
    const owner = ownerKey(), ready = !!doc?.state, onb = !!state.onboarded;
    const changed = activeOwner !== null && (owner !== activeOwner || (ready && !hadDoc) || (wasOnboarded && !onb));
    activeOwner = owner; hadDoc = ready; wasOnboarded = onb;
    if (changed) resetForDoc(doc);
    if (!localMutation) render(false);
  },
  onStatus() { if (!localMutation) render(false); }
});
state = session.document()?.state || createInitialState('ko');
hadDoc = !!session.document()?.state;

const S = { consentAsk: false, consentRefused: false, consentMinor: null, consentGuardian: false, consentBusy: false, consentError: '', consentReturn: null, studyChoice: false, page: state.onboarded ? 'today' : 'onboard', step: 1, draft: null, filter: state.primaryGoal || 'all', compare: [], oppId: null, taskId: null, help: state.primaryGoal || 'study', flash: null, copyMsg: null, error: null, drop: MOTION, practiceOpen: false, univId: null, univFilter: 'all', studyText: {}, studyErrors: {}, channelId: null, postId: null, dateNote: null, docFull: false };
activeOwner = ownerKey(); wasOnboarded = !!state.onboarded;

function persist() { return commit(state); }
function commit(next) {
  if (!next) return false;
  if (!session.status().canEdit) {
    const err = session.status().error;
    const m = err ? getAccountErrorMessage(err, state.lang)
      : state.lang === 'en' ? 'You can\'t change data right now. Please check the save status in Profile.' : '현재는 자료를 바꿀 수 없어요. 내 정보에서 저장 상태를 확인해 주세요.';
    S.flash = esc(m); say(m); return false;
  }
  localMutation = true;
  try {
    session.updateState(next);
    state = session.document().state;
    return true;
  } catch (e) {
    state = session.document()?.state || state;
    const m = getAccountErrorMessage(e, state.lang);
    S.flash = esc(m); say(m);
    return false;
  } finally {
    localMutation = false;
  }
}
function newDraft() {
  return { primaryGoal: state.primaryGoal, interests: [...(state.interests || [])], secondaryGoals: [...(state.secondaryGoals || [])], location: state.location || 'unknown' };
}

/* ── 그림 조각 ── */
const svg = (box, sw, p) => `<svg viewBox="0 0 ${box} ${box}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const ICON = {
  arrow: svg(20, 1.7, '<path d="M4 10h11.5M11 5.5 15.5 10 11 14.5"/>'),
  back: svg(20, 1.7, '<path d="M16 10H4.5M9 5.5 4.5 10 9 14.5"/>'),
  out: svg(20, 1.7, '<path d="M6 14 14 6M7.5 6H14v6.5"/>'),
  check: svg(20, 2.4, '<path d="m5 10.4 3.2 3.1L15 6.6"/>')
};
const TAB_ICON = {
  today: svg(24, 1.6, '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10.2h16M8.5 3.5v4M15.5 3.5v4"/><path d="M11.9 14.9h.2" stroke-width="2.6"/>'),
  explore: svg(24, 1.6, '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>'),
  prepare: svg(24, 1.6, '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  channels: svg(24, 1.6, '<rect x="4" y="5" width="13" height="14.5" rx="2"/><path d="M17 9h3v8.5a2 2 0 0 1-2 2H6"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/>'),
  univ: svg(24, 1.6, '<path d="M3.5 9.6 12 4.6l8.5 5"/><path d="M6 11v7.5M10 11v7.5M14 11v7.5M18 11v7.5M3.5 19.5h17"/>'),
  help: svg(24, 1.6, '<path d="M4.5 5.5h15v10h-8l-4 3.5v-3.5h-3z"/><path d="M10.4 8.9a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.7.6-.7 1.1M12 13.4v.1"/>'),
  profile: svg(24, 1.6, '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4"/>')
};
const SYMBOL = {
  study: svg(48, 1.6, '<rect x="11" y="3.5" width="26" height="41" rx="13"/><rect x="15.5" y="8" width="17" height="32" rx="8.5"/><path d="M15.6 16.8h16.8"/><path d="M24 16.8v2.6"/><path d="M16 32.4c4.6-3 11.2-4.6 16.2-2.9"/><circle cx="27.6" cy="24.2" r="1.7"/>'),
  student: svg(48, 1.6, '<path d="M24 14.2c-4.7-3.3-11.1-4-17.2-2.7v24.4c6.1-1.3 12.5-.6 17.2 2.7 4.7-3.3 11.1-4 17.2-2.7V11.5c-6.1-1.3-12.5-.6-17.2 2.7z"/><path d="M24 14.2v24.4"/><path d="M11.2 18.6c3-.4 6.1 0 8.6 1M11.2 23.6c3-.4 6.1 0 8.6 1M28.2 19.6c2.5-1 5.6-1.4 8.6-1"/>'),
  job: svg(48, 1.6, '<rect x="6.5" y="15.5" width="35" height="25" rx="3.6"/><path d="M18 15.5v-3.4a2.6 2.6 0 0 1 2.6-2.6h6.8a2.6 2.6 0 0 1 2.6 2.6v3.4"/><path d="M6.5 26.5h13.5M28 26.5h13.5"/><rect x="20" y="23.6" width="8" height="6" rx="1.4"/>')
};
const CARD_NO = { study: '01', student: '02', job: '03' };
const CLIP = '<svg class="clip" viewBox="0 0 22 38" aria-hidden="true" focusable="false"><path d="M5.5 0h11v6.6a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" fill="url(#metal)"/><path d="M7.4 2.2h7.2" stroke="rgba(0,0,0,.18)" stroke-width=".8"/><circle cx="11" cy="12.6" r="3.8" fill="none" stroke="url(#metal)" stroke-width="2"/><rect x="9" y="16.1" width="4" height="4.6" rx="1.2" fill="url(#metal)"/><path d="M11 20.6v6.1a4.6 4.6 0 1 0 4.6-4.6" fill="none" stroke="url(#metal)" stroke-width="2.2" stroke-linecap="round"/></svg>';
function seal(n = 0) {
  const txt = state.lang === 'en'
    ? '<text x="60" y="69" text-anchor="middle" font-family="Inter Tight, SUIT Variable, sans-serif" font-weight="800" font-size="25" letter-spacing="1" fill="#c43a2b">DONE</text>'
    : '<text x="60" y="56" text-anchor="middle" font-family="SUIT Variable, sans-serif" font-weight="800" font-size="27" fill="#c43a2b">완</text><text x="60" y="86" text-anchor="middle" font-family="SUIT Variable, sans-serif" font-weight="800" font-size="27" fill="#c43a2b">료</text>';
  return `<svg class="seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g filter="url(#ink${n % 3 ? n % 3 + 1 : ''})"><circle cx="60" cy="60" r="52.5" fill="none" stroke="#c43a2b" stroke-width="5.6"/><circle cx="60" cy="60" r="45" fill="none" stroke="#c43a2b" stroke-width="1.4"/>${txt}</g></svg>`;
}
// 매단 카드 한 장. radio = 첫 실행의 고르기 단추, action = 누르면 그 일을 하는 카드, 둘 다 없으면 보기만 하는 카드
function hang(goal, { i = 0, slot = 'mid', radio = false, on = false, action = '', kicker = '', name = '', desc = null, mode = 'goal' } = {}) {
  const g = goalById(goal);
  const nm = name || pick(g.label), ds = desc ?? pick(g.description);
  const bottom = `${kicker ? `<span class="pass-kicker">${esc(kicker)}</span>` : ''}<span class="pass-name">${esc(nm)}</span>${ds ? `<span class="pass-desc">${esc(ds)}</span>` : ''}`;
  const face = `<span class="pass-band" aria-hidden="true"></span><span class="pass-face" aria-hidden="true"><span class="pass-top"><span class="pass-brand">PATH</span><span class="pass-no">No.${CARD_NO[goal]}</span></span><span class="pass-symbol">${SYMBOL[goal]}</span><span class="pass-bottom">${bottom}</span></span><span class="pick-mark" aria-hidden="true">${ICON.check}</span>`;
  const card = radio
    ? `<button type="button" class="pass goal-choice" role="radio" aria-checked="${on}" tabindex="${on || (!S.draft?.primaryGoal && i === 0) ? 0 : -1}" data-action="pickGoal" data-id="${goal}" data-mode="${mode}" aria-label="${esc(`${pick(g.label)} — ${pick(g.description)}`)}">${face}</button>`
    : action ? `<button type="button" class="pass" data-action="${action}" data-id="${goal}" data-mode="${mode}" aria-label="${esc(ds ? `${nm} — ${ds}` : nm)}">${face}</button>`
      : `<div class="pass" data-mode="${mode}" role="img" aria-label="${esc(ds ? `${nm} — ${ds}` : nm)}">${face}</div>`;
  return `<div class="hang${S.drop ? ' is-drop' : ''}${on ? ' is-on' : ''}" data-goal="${goal}" data-i="${i}" data-slot="${slot}"><div class="strap" aria-hidden="true"><span class="strap-print">PATH PATH PATH PATH PATH PATH PATH PATH</span></div>${CLIP}<div class="card-wrap"><span class="card-shadow" aria-hidden="true"></span>${card}</div></div>`;
}
const sec = (title, sub, body, cls = '') => `<section class="sec${cls ? ` ${cls}` : ''}"><div class="sec-h"><h2>${title}</h2>${sub ? `<span>${sub}</span>` : ''}</div>${body}</section>`;
const head = (title, eyebrow, lead, title2) => `<header class="page-head">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1 class="title page-title" tabindex="-1"><span>${title}</span>${title2 ? ` <span class="title-2">${title2}</span>` : ''}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</header>`;
const ext = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="sr-only"> (${t('openNew')})</span></a>`;
function demoBadge(o) {
  if (o?.source === 'live') return `<span class="badge">${state.lang === 'en' ? 'Official job posting' : '공식 채용 공고'}</span>`;
  return `<span class="badge">${t('demo')}</span>`;
}
const liveLink = (o) => o?.source === 'live' && o.url ? `<p><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${state.lang === 'en' ? 'View original posting (opens in new tab)' : '원문 공고 보기 (새 탭)'}</a></p>` : '';
const findJobEntry = (id) => (jobsFeed.snapshot().jobs || []).find((j) => j.id === id) || (session.document()?.savedJobs || []).find((j) => j.id === id);
const oppRow = (o) => `<li><button type="button" class="row" data-action="detail" data-id="${esc(o.id)}"><span><b>${demoBadge(o)}${esc(pick(o.title))}</b><small>${esc(pick(o.summary))}</small></span><span class="row-go" aria-hidden="true">${ICON.arrow}</span></button></li>`;

/* ── 틀: 머리 막대 · 넓은 화면 탭 · 휴대폰 아래 탭 ── */
const TABS = ['today', 'channels', 'univ', 'explore', 'prepare', 'help', 'profile'].filter((p) => (p !== 'univ' || STUDY_ON) && (p !== 'channels' || CHANNEL_ON));
const UNIV_PAGES = ['cond', 'univDetail', 'univCompare'];
function shell(main) {
  const nav = state.onboarded && S.page !== 'onboard';
  const acctSt = session.status();
  const acct = acctSt.signedIn
    ? `<button type="button" class="account" data-action="nav" data-page="profile"${S.page === 'profile' ? ' aria-current="page"' : ''}>${t('myAccount')}</button>`
    : `<button type="button" class="account" data-action="accountSignIn">${t('signIn')}</button>`;
  const cur = (p) => (navActive(p) ? ' aria-current="page"' : '');
  const tabs = TABS.map((p) => `<button type="button" data-action="nav" data-page="${p}"${cur(p)}>${t(p)}</button>`).join('');
  const bar = TABS.map((p) => `<button type="button" data-action="nav" data-page="${p}"${cur(p)}>${TAB_ICON[p]}<span>${t(p)}</span></button>`).join('');
  const lang = `<div class="lang" role="group" aria-label="${t('langLabel')}"><button type="button" data-action="setLang" data-id="ko" aria-pressed="${state.lang !== 'en'}" lang="ko">한국어</button><span class="lang-sep" aria-hidden="true"></span><button type="button" data-action="setLang" data-id="en" aria-pressed="${state.lang === 'en'}" lang="en">English</button></div>`;
  return `<div class="app-shell${nav ? ' has-nav' : ''}" data-page="${S.page}"><header class="bar">
<button type="button" class="logo" data-action="${nav || S.page !== 'onboard' ? 'nav' : 'noop'}" data-page="${nav ? 'today' : 'onboard'}" aria-label="PATH"><span class="logo-mark" aria-hidden="true"></span>PATH</button>
${nav ? `<nav class="tabs" aria-label="${t('navLabel')}">${tabs}</nav>` : ''}<div class="bar-right"><button type="button" class="ask-open" data-action="askOpen"${S.page === 'ask' || S.page === 'askBrief' ? ' aria-current="page"' : ''}>${t('ask')}</button>${lang}${acct}</div></header>
${main}${nav ? `<nav class="tabbar" aria-label="${t('navLabel')}">${bar}</nav>` : ''}</div>`;
}
function navActive(p) { return S.page === p || (p === 'explore' && S.page === 'detail') || (p === 'prepare' && S.page === 'editor') || (p === 'univ' && UNIV_PAGES.includes(S.page)) || (p === 'channels' && S.page === 'post') || (p === 'today' && S.page === 'path'); }

// quiet = 첫 실행에서는 「로그인하지 않은 상태」 안내를 빼고(첫 화면을 카드에 양보), 오류 · 저장 실패 · 막힘만 보인다
function notices(quiet = false, noFlash = false) {
  const accSt = session.status();
  blocked = !!accSt.guestBlocked;
  storageError = accSt.error?.code === 'LOCAL_STORAGE_UNAVAILABLE';
  const guestStore = storageError && !accSt.signedIn;
  const plainGuest = !accSt.signedIn && !accSt.error;
  let h = guestStore || (quiet && plainGuest) ? '' : (renderAccountNotice(accSt, state.lang) || '');
  // 동의 화면에서는 준비 글의 「계정 저장됨」을 숨긴다(아래 「내 조건을 계정에 저장할까요?」와 엇갈려 읽힌다). 오류 알림은 그대로 둔다.
  if (S.page === 'studyConsent' && h.includes('data-state="saved"')) h = '';
  if (blocked) h += `<div class="notice error" role="alert"><p>${t('blocked')}</p><div class="actions"><button type="button" class="secondary" data-action="reset">${t('reset')}</button></div></div>`;
  h += `<div id="store-note" class="notice error" role="status"${storageError ? '' : ' hidden'}><span>${t('storeFail')}</span>${guestStore ? ` <button type="button" class="text-button" data-action="accountRetry">${accL('다시 시도', 'Retry')}</button>` : ''}</div>`;
  h += studyNoticesHtml();
  if (S.flash && !noFlash) h += `<div id="flash" class="notice" role="status">${S.flash}</div>`;
  return `<div class="notices">${h}</div>`;
}

/* ── 첫 실행: 카드 고르기 ── */
function onboard() {
  const d = S.draft;
  if (S.step === 1) {
    const cards = GOALS.map((g, i) => hang(g.id, { i, slot: ['left', 'mid', 'right'][i], radio: true, on: d.primaryGoal === g.id })).join('');
    const g = goalById(d.primaryGoal);
    return `<main class="ob" id="main"><div class="ob-title">${notices(true)}<h1 class="title page-title" id="q1" tabindex="-1"><span>${t('obT1')}</span> <span class="title-2">${t('obT2')}</span></h1></div>
<div class="ob-lead"><p class="lead" id="ob-lead" aria-live="polite">${g ? `<b class="lead-pick">${esc(pick(g.label))}</b>${esc(pick(g.note))}` : t('obLead')}</p></div>
<div class="stage ob-stage${d.primaryGoal ? ' has-pick' : ''}" role="radiogroup" aria-label="${t('q1')}"><div class="rod" aria-hidden="true"></div>${cards}</div>
<div class="ob-actions"><button type="button" class="btn" data-action="finish"${d.primaryGoal ? '' : ' disabled'}>${t('startCard')} ${ICON.arrow}</button><button type="button" class="link" data-action="skip">${t('browse')}</button>${state.onboarded ? `<button type="button" class="link" data-action="cancelOnboard">${t('cancel')}</button>` : ''}</div>
<p class="fine ob-fine">${t('obFine')}${d.primaryGoal ? ` <button type="button" class="link link-sm" data-action="step2">${t('fineTune')}</button>` : ''}</p></main>`;
  }
  const g = goalById(d.primaryGoal);
  const chips = (list, key) => list.map((x) => `<button type="button" class="chip" aria-pressed="${d[key].includes(x.id)}" data-action="toggle" data-key="${key}" data-id="${x.id}">${esc(pick(x.label))}</button>`).join('');
  const locs = ['abroad', 'korea', 'unknown'].map((l) => `<option value="${l}"${d.location === l ? ' selected' : ''}>${t(l)}</option>`).join('');
  return `<main class="ob2" id="main"><div class="ob2-card">${hang(g.id, { slot: 'mid' })}</div><div class="ob2-main">${notices(true)}<p class="eyebrow">${t('step2')}</p><h1 class="title page-title" tabindex="-1"><span>${t('q2')}</span> <span class="title-2">${t('q2lead')}</span></h1>
<fieldset class="field"><legend>${t('interests')}</legend><div class="chips">${chips(g.interests, 'interests')}</div></fieldset>
<fieldset class="field"><legend>${t('secondary')}</legend><div class="chips">${chips(GOALS.filter((x) => x.id !== g.id), 'secondaryGoals')}</div></fieldset>
<div class="field"><label for="loc">${t('location')}</label><span class="hint" id="loc-hint">${t('locHint')}</span><select id="loc" class="select" aria-describedby="loc-hint" data-action="loc">${locs}</select></div>
<div class="actions"><button type="button" class="btn" data-action="finish">${t('start')} ${ICON.arrow}</button><button type="button" class="link" data-action="step1">${t('back')}</button>${state.onboarded ? `<button type="button" class="link" data-action="cancelOnboard">${t('cancel')}</button>` : ''}</div></div></main>`;
}

/* ── 오늘: 매단 내 카드 + 도장 세 칸 ── */
function stamps(states, descs) {
  const names = ['j1', 'j2', 'j3'];
  return `<ol class="stamps" aria-label="${t('stampsLabel')}">${states.map((s, i) => `<li class="stamp is-${s}"${s === 'now' ? ' aria-current="step"' : ''}><span class="slot" aria-hidden="true">${s === 'done' ? seal(i) : s === 'now' ? t('sNow') : `<span class="slot-num">${i + 1}</span>`}</span><h3>${t(names[i])} <span class="stamp-state">${t(s === 'done' ? 'sDone' : s === 'now' ? 'sNow' : 'sNext')}</span></h3><p>${esc(descs[i])}</p></li>`).join('')}</ol>`;
}
function today() {
  const g = goalById(state.primaryGoal);
  if (!g) {
    const cards = GOALS.map((x, i) => hang(x.id, { i, slot: ['left', 'mid', 'right'][i], action: 'exploreGoal' })).join('');
    return `<main class="home" id="main"><aside class="stage home-stage is-three" aria-label="${t('pickCard')}"><div class="rod" aria-hidden="true"></div>${cards}<div class="home-cap"><span></span><button type="button" class="link" data-action="changeGoal">${t('pickCard')}</button></div></aside>
<div class="home-main">${notices()}<p class="eyebrow">${t('today')}</p><h1 class="title page-title" tabindex="-1"><span>${t('nT1')}</span> <span class="title-2">${t('nT2')}</span></h1>
<ul class="goal-list">${GOALS.map((x) => `<li><button type="button" class="goal-row" data-action="exploreGoal" data-id="${x.id}"><span class="goal-sym" data-goal="${x.id}">${SYMBOL[x.id]}</span><span class="goal-txt"><b>${esc(pick(x.label))}</b><small>${esc(pick(x.description))}</small></span><span class="row-go" aria-hidden="true">${ICON.arrow}</span></button></li>`).join('')}</ul>
${pathHtml()}${askCtl.casesHtml()}${upcomingHtml()}${newsHtml()}<div class="home-grid">${sec(t('official'), t('offSub'), officialList('all'))}${sec(t('tools'), '', toolRows())}</div></div></main>`;
  }
  const mine = state.tasks.filter((x) => x.goal === g.id);
  const nt = getNextTask(state);
  const task = nt && nt.goal === g.id && !nt.confirmedAt ? nt : null;
  const allDone = !task && mine.length > 0 && mine.every((x) => x.confirmedAt);
  const st = task ? ['done', 'now', 'next'] : allDone ? ['done', 'done', 'done'] : ['now', 'next', 'next'];
  const [h1a, h1b] = task ? [t('hDraft1'), t('hDraft2')] : allDone ? [t('hDone1'), t('hDone2')] : [t('hNone1'), t('hNone2')];
  let card;
  if (task) {
    const so = oppById(task.sourceId);
    card = `<section class="resume" aria-label="${t('resume')}"><div><span class="resume-k">${t('resume')}</span><span class="resume-t">${so ? `${demoBadge(so)}${esc(pick(so.title))}` : t('missing')}</span><span class="resume-s"><i aria-hidden="true"></i>${t('resumeS')}</span></div><button type="button" class="btn" data-action="openTask" data-id="${esc(task.id)}">${t('resume')} ${ICON.arrow}</button></section>`;
  } else if (allDone) {
    card = `<section class="resume is-done"><div><span class="resume-k">${t('nextStep')}</span><span class="resume-t">${t('doneNext')}</span></div><div class="resume-acts"><button type="button" class="btn" data-action="exploreGoal" data-id="${g.id}">${t('exploreMore')} ${ICON.arrow}</button><button type="button" class="link" data-action="nav" data-page="prepare">${t('viewPrep')}</button></div></section>`;
  } else {
    card = `<section class="resume is-start"><div><span class="resume-k">${t('nextStep')}</span><span class="resume-t">${esc(pick(g.homeTitle))}</span><span class="resume-s">${esc(pick(g.steps[0]))}</span></div><button type="button" class="btn" data-action="exploreGoal" data-id="${g.id}">${esc(pick(g.homeAction))} ${ICON.arrow}</button></section>`;
  }
  const opps = OPPORTUNITIES.filter((o) => o.goal === g.id).slice(0, 2);
  const off = g.id === 'job' && jobsFeed.snapshot().status === 'disabled' ? `<p class="off"><i aria-hidden="true"></i>${t('jobsOff')}</p>` : '';
  return `<main class="home" id="main"><aside class="stage home-stage" aria-label="${t('myCard')}"><div class="rod" aria-hidden="true"></div>${hang(g.id, { kicker: t('myCard'), mode: 'next' })}<div class="home-cap"><span></span><button type="button" class="link" data-action="changeGoal">${t('changeCard')}</button></div></aside>
<div class="home-main">${notices()}<p class="eyebrow">${t('today')}</p><h1 class="title page-title" tabindex="-1"><span>${h1a}</span> <span class="title-2">${h1b}</span></h1>
${stamps(st, g.steps.map(pick))}${card}${g.id === 'study' && STUDY_ON ? renderStudyEntry(studyView()) : ''}${pathHtml()}${askCtl.casesHtml()}${upcomingHtml()}${newsHtml()}
<div class="home-grid">${sec(t('homeOpps'), t('demoSub'), `<ul class="rows">${opps.map(oppRow).join('')}</ul>`)}${sec(t('official'), t('offSub'), officialList(g.id) + off)}</div></div></main>`;
}

function officialList(goal) {
  const list = OFFICIAL_LINKS.filter((l) => goal === 'all' || l.goal === goal || l.goal === null);
  return `<ul class="rows">${list.map((l) => `<li><a class="row" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span><b><span class="badge official">${t('officialBadge')}</span>${esc(pick(l.title))}</b><small>${esc(pick(l.summary))} · ${t('checked')} ${esc(l.checkedAt)}</small></span><span class="row-go" aria-hidden="true">${ICON.out}</span><span class="sr-only"> (${t('openNew')})</span></a></li>`).join('')}</ul>`;
}
const toolRows = () => `<ul class="rows">${EXISTING_TOOLS.map((x) => `<li><a class="row" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><span><b>${esc(pick(x.title))}</b><small>${esc(pick(x.summary))}</small></span><span class="row-go" aria-hidden="true">${ICON.out}</span><span class="sr-only"> (${t('openNew')})</span></a></li>`).join('')}</ul>`;

/* ── 찾기 · 자세히 ── */
function explore() {
  const f = S.filter;
  const filt = ['all', ...GOALS.map((g) => g.id)].map((id) => `<button type="button" class="chip" aria-pressed="${f === id}" data-action="filter" data-id="${id}">${id === 'all' ? t('all') : esc(pick(goalById(id).description))}</button>`).join('');
  const list = OPPORTUNITIES.filter((o) => f === 'all' || o.goal === f);
  const full = S.compare.length >= 3;
  let h = head(t('exploreTitle'), t('explore'), '', t('exploreT2'));
  h += `<div role="group" aria-label="${t('filter')}" class="chips filters">${filt}</div>`;
  if (['all', 'job', 'student'].includes(f)) h += renderJobs({ feed: jobsFeed.snapshot(), lang: state.lang, savedJobs: session.document()?.savedJobs || [], query: S.jobQueryText ?? S.jobQuery ?? '', board: S.jobBoard || 'all', onlySaved: !!S.onlySaved, page: S.jobPage || 0, canEdit: session.status().canEdit });
  h += `<details class="practice"${S.practiceOpen ? ' open' : ''}><summary><span>${t('practice')}</span><small>${t('demoSub')}</small></summary><p class="meta">${t('demoNote')}</p>`;
  h += `<ul class="rows opp-rows">${list.map((o) => {
    const on = S.compare.includes(o.id);
    return `<li class="opp"><div class="opp-text"><b>${demoBadge(o)}${esc(pick(o.title))}</b><small>${esc(pick(o.summary))}</small></div><div class="opp-acts"><button type="button" class="btn-line" data-action="detail" data-id="${o.id}">${t('details')}</button><button type="button" class="chip" aria-pressed="${on}" data-action="compare" data-id="${o.id}"${full && !on ? ' disabled' : ''}>${on ? t('compareOn') : t('compareAdd')}</button></div></li>`;
  }).join('')}</ul>`;
  if (full) h += `<p class="meta">${t('compareMax')}</p>`;
  if (S.compare.length) {
    h += `<div class="sec-h compare-h"><h2>${t('compareTitle')} (${S.compare.length}/3)</h2><button type="button" class="text-button" data-action="clearCompare">${t('clearCompare')}</button></div><div class="compare-grid">${S.compare.map(oppById).map((o) => `<div class="compare-item">${demoBadge(o)}<h3>${esc(pick(o.title))}</h3><ol class="reqs">${o.requirements.map((r, i) => `<li><b>${i + 1}</b>${esc(pick(r))}</li>`).join('')}</ol></div>`).join('')}</div>`;
  }
  h += '</details>';
  h += sec(t('official'), t('offSub'), officialList(f));
  return h;
}

function detail() {
  const o = oppById(S.oppId);
  if (!o) return head(t('missing')) + `<button type="button" class="btn-line" data-action="nav" data-page="explore">${t('backList')}</button>`;
  return `<article class="detail"><button type="button" class="back" data-action="nav" data-page="explore">${ICON.back}${t('backList')}</button><p class="eyebrow">${demoBadge(o)} ${esc(pick(goalById(o.goal)?.label))}</p><h1 class="title page-title" tabindex="-1"><span>${esc(pick(o.title))}</span></h1><p class="lead">${esc(pick(o.summary))}</p>${liveLink(o)}
<h2 class="h2">${t('requirements')}</h2><ol class="reqs">${o.requirements.map((r, i) => `<li><b>${i + 1}</b>${esc(pick(r))}</li>`).join('')}</ol>
<div class="actions"><button type="button" class="btn" data-action="${o.source === 'live' ? 'prepareJob' : 'prepareThis'}" data-id="${esc(o.id)}">${t('prepareThis')} ${ICON.arrow}</button></div></article>
${sec(t('official'), t('offSub'), officialList(o.goal))}`;
}

/* ── 내 준비 · 쓰기 ── */
const statusHtml = (task) => `<span class="status" data-state="${task.confirmedAt ? 'done' : 'draft'}">${task.confirmedAt ? t('done') : t('draft')}</span>`;
function prepare() {
  let h = head(t('prepareTitle'), t('prepare'), '', t('prepareT2'));
  if (!state.tasks.length) return h + `<p class="empty">${t('noTasks')}</p><div class="actions"><button type="button" class="btn" data-action="nav" data-page="explore">${t('exploreTitle')} ${ICON.arrow}</button></div>`;
  for (const g of GOALS) {
    const ts = state.tasks.filter((x) => x.goal === g.id);
    if (!ts.length) continue;
    h += sec(esc(pick(g.label)), '', `<ul class="rows">${ts.map((x) => { const so = oppById(x.sourceId); return `<li><button type="button" class="row" data-action="openTask" data-id="${esc(x.id)}"><span><b>${demoBadge(so)}${so ? esc(pick(so.title)) : t('missing')}</b><small>${statusHtml(x)}</small></span><span class="row-go" aria-hidden="true">${ICON.arrow}</span></button></li>`; }).join('')}</ul>`);
  }
  return h;
}

const countText = (v) => `${String(v || '').length.toLocaleString(state.lang === 'en' ? 'en-US' : 'ko-KR')} / 6,000${state.lang === 'en' ? '' : '자'}`;
function editor() {
  const task = state.tasks.find((x) => x.id === S.taskId);
  const o = task && oppById(task.sourceId);
  if (!o) return `<main class="content" id="main">${notices()}${head(t('missing'))}<button type="button" class="btn-line" data-action="nav" data-page="prepare">${t('prepare')}</button></main>`;
  const goal = goalById(task.goal) ? task.goal : 'job';
  const st = session.status(), signed = st.signedIn;
  const savedOk = st.canEdit && !st.error;
  let h = `<main class="ed" id="main"><aside class="stage ed-stage" aria-label="${t('source')}"><div class="rod" aria-hidden="true"></div>${hang(goal, { kicker: t('srcK'), name: pick(o.title), desc: '', mode: 'source' })}
<div class="ed-src"><b>${t('source')}</b><p>${demoBadge(o)}<span>${esc(pick(o.title))}</span></p><small>${o.source === 'live' ? t('liveNote') : t('srcNote')}</small>${liveLink(o)}<button type="button" class="link" data-action="detail" data-id="${esc(o.id)}">${t('reopen')}</button></div></aside>
<div class="ed-main">${notices(false, true)}<button type="button" class="back" data-action="nav" data-page="prepare">${ICON.back}${t('backPrep')}</button>
<p class="eyebrow">${t('edEyebrow')}</p><h1 class="title page-title" tabindex="-1"><span>${esc(pick(o.prompt))}</span></h1>
<ol class="reqs" aria-label="${t('requirements')}">${o.requirements.map((r, i) => `<li><b>${i + 1}</b>${esc(pick(r))}</li>`).join('')}</ol>
<section class="editor"><div class="field"><label for="body" class="field-label">${t('body')}</label>
<textarea id="body" maxlength="6000" aria-describedby="body-hint edit-err" data-action="body"${S.error === 'needBody' ? ' aria-invalid="true"' : ''}>${esc(task.body)}</textarea>
<div class="field-meta" id="body-hint"><span class="count" id="count">${countText(task.body)}</span>${savedOk ? `<span class="saved">${ICON.check}${signed ? t('savedAccount') : t('savedGuest')}</span>` : ''}</div></div>
<p id="task-status" class="task-status">${statusHtml(task)}</p>
<label class="check"><input type="checkbox" id="ack"${task.confirmedAt ? ' checked' : ''}><span class="box" aria-hidden="true">${ICON.check}</span><span>${t('confirmCheck')}</span></label>
<p id="edit-err" class="err" role="alert">${S.error ? t(S.error) : ''}</p>
<div class="confirm-row"><button type="button" class="btn" data-action="confirm">${t('confirm')}</button><span class="slot slot-sm${task.confirmedAt ? ' is-sealed' : ''}" id="seal-slot" aria-hidden="true">${task.confirmedAt ? seal() : t('sealSlot')}</span></div>
${S.flash ? `<div id="flash" class="notice flash-inline" role="status">${S.flash}</div>` : ''}<p class="fine">${t('confirmNote')}</p></section>`;
  if (task.confirmedAt) {
    const nx = getNextTask(state);
    h += `<div id="confirmed-result" class="result"><div class="sec-h"><h2>${t('result')}</h2>${demoBadge(o)}</div><div class="result-body">${esc(task.body)}</div>
<div class="actions">${nx && nx.id !== task.id && !nx.confirmedAt ? `<button type="button" class="btn" data-action="openTask" data-id="${esc(nx.id)}">${t('nextAction')} ${ICON.arrow}</button>` : ''}<button type="button" class="btn-line" data-action="exploreGoal" data-id="${task.goal}">${t('exploreMore')}</button></div></div>`;
  }
  return h + '</div></main>';
}

/* ── 도움 · 내 정보 ── */
function helpTemplate(topic) {
  const g = goalById(topic);
  const subj = g ? pick(g.label) : t('general');
  return state.lang === 'en'
    ? `Hello,\nI am contacting you about: ${subj}.\nMy current location: ${t(state.location || 'unknown')}.\n\n1. What official requirements apply to my situation?\n2. Which documents should I prepare, and where can I find the official list?\n3. Is there an official page or contact I should check first?\n\nThank you.`
    : `안녕하세요.\n다음 주제로 문의드립니다: ${subj}\n현재 있는 곳: ${t(state.location || 'unknown')}\n\n1. 제 상황에 적용되는 공식 요건은 무엇인가요?\n2. 준비해야 할 서류와 공식 목록은 어디에서 확인할 수 있나요?\n3. 먼저 확인해야 할 공식 페이지나 문의처가 있을까요?\n\n감사합니다.`;
}
function help() {
  const opts = [...GOALS.map((g) => [g.id, pick(g.label)]), ['general', t('general')]].map(([id, l]) => `<option value="${id}"${S.help === id ? ' selected' : ''}>${esc(l)}</option>`).join('');
  return head(t('helpTitle'), t('help'), t('helpLead'), t('helpT2')) + `<div class="field field-inline"><label for="topic" class="field-label">${t('topic')}</label><select id="topic" class="select" data-action="topic">${opts}</select></div>
<section class="sec"><div class="sec-h"><h2>${t('template')}</h2><button type="button" class="btn-line" data-action="copy">${t('copy')}</button></div>
${S.copyMsg ? `<p class="notice${S.copyMsg === 'copyFail' ? ' error' : ''}" role="status">${t(S.copyMsg)}</p>` : ''}<pre class="result-body" id="tpl">${esc(helpTemplate(S.help))}</pre></section>
${sec(t('official'), t('offSub'), officialList(S.help === 'general' ? 'none' : S.help))}
${sec(t('tools'), t('offSub'), `<p class="meta">${t('toolsLead')}</p>${toolRows()}`)}`;
}

function profile() {
  const g = goalById(state.primaryGoal);
  const accSt = session.status();
  return head(t('profileTitle'), t('profile'), '', t('profileT2')) + renderAccountPanel(accSt, state.lang, { pendingBackup: !!pendingBackup && !!accSt.canConfirmBackup && pendingBackup.owner === ownerKey(), useRemote: !!pendingBackup?.useRemote }) + `<div class="settings">
<section class="settings-group"><h2>${t('goal')}</h2><p>${g ? esc(pick(g.label)) : t('none')}</p><button type="button" class="btn-line" data-action="changeGoal">${t('changeGoal')}</button></section>
<section class="settings-group"><h2>${t('location')}</h2><p>${t(state.location || 'unknown')}</p></section>
<section class="settings-group"><h2>${t('lang')}</h2><p>${state.lang === 'en' ? 'English' : '한국어'}</p></section>
<section class="settings-group"><h2>${t('storage')}</h2>${accSt.signedIn ? `<p>${state.lang === 'en' ? 'Syncs to your account. Please check the save status above.' : '계정에 동기화합니다. 위의 저장 상태를 확인해 주세요.'}</p>` : `<p>${t('storageText')}</p><button type="button" class="btn-line danger" data-action="clear">${t('clear')}</button>`}${STUDY_ON ? (studyStore() === 'tab' ? `<p>${t('studyStore')}</p>` : '') : CHANNEL_ON ? `<p>${t('datesStore')}</p>` : ''}</section>${STUDY_ON && accSt.signedIn ? renderStudyAccountSettings({ lang: state.lang, phase: studyAcct.snapshot().phase, consent: studyAcct.snapshot().consent, store: studyStore(), errorCode: studyAcct.snapshot().error?.code || null }) : ''}</div>`;
}

const studyView = () => ({ lang: state.lang, profile: studyProfile(), programs: STUDY_PROGRAMS, rules: rulesAt(RULES, new Date()), now: new Date(), store: studyStore(), storeNote: studyStoreNote() });
const condView = () => ({ ...studyView(), persisted: study.persisted(), text: S.studyText, errors: S.studyErrors });
// 날짜 목록 위 경고는 종류만 기억하고 그릴 때 지금 언어로 고른다(언어를 바꿔도 앞 언어로 남지 않게).
const DATE_NOTES = {
  full: ['다가오는 날이 서른 개라 더 넣을 수 없어요. 다가오는 날에서 하나를 뺀 뒤 넣어 주세요.', 'Coming up already has 30 dates. Remove one first.'],
  ics: ['이 브라우저에서는 달력 파일을 만들 수 없어요. 날짜를 직접 적어 두세요.', 'This browser cannot create the calendar file. Please note the date yourself.']
};
const dateNoteText = () => (DATE_NOTES[S.dateNote] ? accL(...DATE_NOTES[S.dateNote]) : '');
const channelView = () => ({ ...studyView(), posts: CHANNEL_POSTS, condOn: STUDY_ON, persisted: study.persisted(), note: dateNoteText() });
const channels = () => renderChannels({ ...channelView(), channelId: S.channelId });
const post = () => renderPost({ ...channelView(), postId: S.postId });
// 다가오는 날은 넣은 날이 하나라도 있으면 카드와 상관없이 오늘 화면에 둔다.
const upcomingHtml = () => (CHANNEL_ON ? renderUpcoming(channelView()) : '');
// 새 소식도 카드와 상관없이 둔다. 채널 탭은 모두에게 열리고, 채널의 「오늘 화면에 보이기」가 이 자리를 가리킨다.
const newsHtml = () => (CHANNEL_ON ? renderNews(channelView()) : '');
const univ = () => renderUniv({ ...studyView(), filter: S.univFilter });
// 「이 과정으로 준비하기」 상자는 path-ui가 짓고 대학 자세히에 끼운다(study-ui ↔ path-ui가 서로 부르지 않게).
const univDetail = () => { const v = { ...channelView(), programId: S.univId }; return renderUnivDetail({ ...v, pathPick: renderPathPick(v, STUDY_PROGRAMS.find((p) => p.id === S.univId)) }); };
const path = () => renderPath({ ...channelView(), docFull: S.docFull }) + askCtl.markerHtml();
const pathHtml = () => (STUDY_ON ? renderPathCard(channelView()) : '');
const univCompare = () => renderUnivCompare(studyView());
const cond = () => renderCond(condView());
const studyConsent = () => renderStudyConsent({ lang: state.lang, minor: S.consentMinor, guardian: S.consentGuardian, busy: S.consentBusy, error: S.consentError });
// 서류 번역 초안(번역초안_설계.md). 원문과 초안은 이 메모리(S.tr)에만 둔다. 탭 저장 · 계정 문서 · 서버 어디에도 남기지 않는다.
// 다른 쪽으로 가면(초안이 있으면 확인받고) 지우고, 계정이 바뀌거나 로그아웃하면 지우며 그동안 온 응답은 버린다.
const trDoc = () => {
  const t = S.tr && pathTarget(channelView());
  const d = t ? t.set.all.find((x) => x.id === S.tr.docId) : null;
  return d ? { doc: d, rules: d.stage === 'visa' ? (t.set.visa.rules || []) : [...(t.set.program.rules || []), ...(t.set.program.unclear || [])] } : null;
};
const translate = () => {
  const found = trDoc();
  return renderTranslate({ lang: state.lang, signedIn: session.status().signedIn === true, docName: found?.doc.name, rules: found?.rules || [], kindChoice: Boolean(S.tr && translateKindChoice(S.tr.docId)), tr: S.tr || {} });
};
const trMsg = (key) => (ERROR_TEXT[key] || ERROR_TEXT.unavailable)[state.lang === 'en' ? 1 : 0];
const trHidden = () => (state.lang === 'en' ? '[hidden number]' : '[가린 번호]');
const newTr = (docId) => ({ owner: ownerKey(), docId, kind: translateKindOf(docId) || 'grad', text: '', age: null, guardian: false, agree: false, phase: 'edit', error: null, notice: null,
  remaining: null, rows: null, drafts: null, sent: null, check: 'idle', compared: false, onlyFlagged: false, seq: 0 });
const trConsent = (tr) => ({ v: TRANSLATE_CONSENT_VERSION, age: tr.age, guardian: tr.age === 'teen', lang: state.lang === 'en' ? 'en' : 'ko' });
const trCanSend = (tr) => tr.phase !== 'sending' && (tr.age === 'adult' || (tr.age === 'teen' && tr.guardian)) && tr.agree === true && String(tr.text || '').trim().length > 0;
/** 실패를 화면 문장 열쇠로. 연결이 끊기거나 시간이 지나면 한 장이 쓰였을 수 있다(lost). */
function trFailKey(err) {
  const code = err?.code || '';
  if (code === 'NETWORK' || code === 'INVALID_TRANSLATE_REPLY' || code === 'INVALID_RESPONSE') return 'lost';
  if (code === 'NOT_MONGOLIAN') return 'language';
  return 'unavailable';
}
const trStale = (tr, seq) => S.tr !== tr || tr.seq !== seq || tr.owner !== ownerKey();
async function trSend() {
  const tr = S.tr;
  if (!tr || !trCanSend(tr)) return;
  const split = splitPasted(tr.text);
  if (split.error) { tr.error = split.error; render(false); root.querySelector('#tr-text')?.focus(); say(trMsg(split.error)); return; }
  const { lines, slots } = maskLines(split.lines);
  let body;
  try { body = validateTranslateRequest({ action: 'translate', request_id: crypto.randomUUID(), kind: tr.kind, lines, consent: trConsent(tr) }); }
  catch (err) {
    if (err?.code === 'NOT_MONGOLIAN') { tr.error = 'language'; render(false); root.querySelector('#tr-text')?.focus(); say(trMsg(tr.error)); return; }
    tr.notice = 'unavailable'; render(false); say(trMsg(tr.notice)); return;
  }
  const seq = ++tr.seq;
  Object.assign(tr, { phase: 'sending', error: null, notice: null });
  render(false); say(accL('한국어로 옮기는 중이에요. 1분쯤 걸려요. 이 화면을 열어 두세요.', 'Translating into Korean. This takes about a minute. Keep this screen open.'));
  let reply = null, failed = null;
  try { reply = validateTranslateReply(await session.translate(body), lines.length); } catch (err) { failed = err; }
  if (trStale(tr, seq)) return;
  if (reply && reply.remaining !== null) tr.remaining = reply.remaining;
  if (failed || reply.status !== 'done') {
    tr.phase = 'edit'; tr.notice = failed ? trFailKey(failed) : reply.status;
    render(false); root.querySelector('[data-action="trSend"]')?.focus(); say(trMsg(tr.notice)); return;
  }
  Object.assign(tr, { phase: 'draft', sent: { lines, slots, kind: body.kind }, drafts: reply.lines, rows: draftRows(lines, reply.lines, null, slots, trHidden()), check: 'idle', compared: false, copied: null });
  render(false); root.querySelector('.page-title')?.focus();
  say(accL('번역 초안이 나왔어요. 번역본이 아니에요. 이어서 다시 몽골어로 옮겨 견줘요.', 'The translation draft is ready. It is not a translation for submission. Next, it is translated back into Mongolian for a check.'));
  void trRunCheck(tr);
}
// 서류 점검(서류점검_모의면접_설계.md 1절). 붙여 넣은 글 · 찾은 줄 · 누른 표시는 이 메모리(S.dc)에만 둔다. 지우는 때는 번역 초안과 같다.
const dcDoc = () => {
  const t = S.dc && pathTarget(channelView());
  const doc = t ? t.set.all.find((x) => x.id === S.dc.docId && x.stage !== 'visa') : null;
  return doc ? { doc, src: t.set.program, program: t.program } : null;
};
const doccheck = () => {
  const found = dcDoc();
  return found ? renderDocCheck({ lang: state.lang, signedIn: session.status().signedIn === true, now: new Date(), doc: found.doc, src: found.src, programName: found.program.name, dc: S.dc }) : '';
};
const dcMsg = (key) => (DC_ERROR_TEXT[key] || DC_ERROR_TEXT.unavailable)[state.lang === 'en' ? 1 : 0];
const newDc = (docId) => ({ owner: ownerKey(), docId, text: '', age: null, guardian: false, agree: false, phase: 'edit', error: null, notice: null, remaining: null, rows: null, marks: new Set(), seq: 0 });
async function dcSend() {
  const dc = S.dc;
  if (!dc || !docCheckItems(dc.docId) || !dcCanSend(dc)) return;
  // 글의 언어는 가리지 않는다(답이 줄 번호뿐이다). 나머지 한도와 가리기는 번역 초안과 같다.
  const split = splitPasted(dc.text);
  if (split.error && split.error !== 'language') { dc.error = split.error; render(false); root.querySelector('#dc-text')?.focus(); say(dcMsg(split.error)); return; }
  let body;
  try {
    body = validateDocCheckRequest({ action: 'doc_check', request_id: crypto.randomUUID(), doc: dc.docId, lines: maskLines(split.lines).lines,
      consent: { v: DOC_CHECK_CONSENT_VERSION, age: dc.age, guardian: dc.age === 'teen', lang: state.lang === 'en' ? 'en' : 'ko' } });
  } catch { dc.notice = 'unavailable'; render(false); root.querySelector('[data-action="dcSend"]')?.focus(); say(dcMsg(dc.notice)); return; }
  const seq = ++dc.seq;
  Object.assign(dc, { phase: 'sending', error: null, notice: null });
  // 보내는 동안 단추가 막혀 초점이 사라지므로 기다림 안내로 옮긴다.
  render(false); root.querySelector('#dc-wait')?.focus(); say(accL('글에서 찾는 중이에요. 이 화면을 열어 두세요.', 'Looking through the text. Keep this screen open.'));
  let reply = null, failed = null;
  try { reply = validateDocCheckReply(await session.translate(body), dc.docId, body.lines.length); } catch (err) { failed = err; }
  if (S.dc !== dc || dc.seq !== seq || dc.owner !== ownerKey()) return;
  if (reply && reply.remaining !== null) dc.remaining = reply.remaining;
  if (failed || reply.status !== 'done') {
    dc.phase = 'edit'; dc.notice = failed ? (['NETWORK', 'INVALID_DOC_CHECK_REPLY', 'INVALID_RESPONSE'].includes(failed.code) ? 'lost' : 'unavailable') : reply.status;
    render(false); root.querySelector('[data-action="dcSend"]')?.focus(); say(dcMsg(dc.notice)); return;
  }
  // 화면에는 학생이 붙여 넣은 줄 그대로를 보인다(가린 번호는 보낼 때만 가린다).
  Object.assign(dc, { phase: 'done', rows: docCheckRows(dc.docId, reply.items, split.lines) });
  render(false); root.querySelector('#dc-result')?.focus();
  say(accL('글에서 찾은 줄이 나왔어요. 대학의 확인이 아니에요. 종이 서류와 맞춰 보세요.', 'The lines found in the text are ready. This is not a check by the university. Compare with the paper document.'));
}
// 대조가 끝나 쪽을 다시 그리면 id 없는 단추의 초점이 사라진다. 누르던 단추를 다시 찾아 돌려준다.
// data-action만으로는 탭 · 언어처럼 같은 동작의 다른 단추가 걸리므로 data-page · data-id까지 견주고, 같은 단추가 위아래에 둘이면 몇 번째였는지로 가른다.
function trFocusTarget(el) {
  if (!el || !root.contains(el) || el.id || !el.getAttribute('data-action')) return null;
  const parts = ['data-action', 'data-page', 'data-id'].filter((a) => el.getAttribute(a) !== null).map((a) => [a, el.getAttribute(a)]);
  if (!parts.every(([, v]) => /^[\w-]+$/.test(v))) return null;
  const sel = parts.map(([a, v]) => `[${a}="${v}"]`).join('');
  const at = [...root.querySelectorAll(sel)].indexOf(el);
  return at < 0 ? null : { sel, at };
}
function trRender() {
  const target = trFocusTarget(document.activeElement);
  render(false);
  if (target) [...root.querySelectorAll(target.sel)][target.at]?.focus();
}
// 손님이 번역 쪽이나 서류 점검 쪽에서 로그인하면 웹 로그인이 쪽을 새로 연다. 돌아온 뒤 같은 서류의 그 쪽을 다시 연다.
// 이 탭에 두는 것은 서류 줄 id와 누른 때뿐이다(글 · 초안 · 동의는 없다). 10분이 지나거나 다른 쪽으로 가거나 손님으로 돌아오면 지운다.
const TR_RETURN_KEY = 'synk-path-translate-return', TR_RETURN_MS = 10 * 60 * 1000;
const trReturnSet = (id, to) => { try { tabStorage()?.setItem(TR_RETURN_KEY, JSON.stringify(to ? { id, at: Date.now(), to } : { id, at: Date.now() })); } catch { /* 저장이 막힌 탭: 돌아오기만 없다 */ } };
const trReturnClear = () => { try { tabStorage()?.removeItem(TR_RETURN_KEY); } catch { /* 위와 같음 */ } };
// 로그인한 뒤 번역 쪽이 열리기 전에 저절로 거치는 쪽. 학생이 다른 쪽으로 가면 돌아올 값을 지운다(go · nav).
const TR_WAIT_PAGES = ['today', 'onboard', 'profile', 'studyConsent', 'translate', 'doccheck'];
function trReturnGet() {
  let raw = null;
  try { raw = tabStorage()?.getItem(TR_RETURN_KEY) ?? null; } catch { return null; }
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw), age = Date.now() - v.at;
    const known = typeof v.id === 'string' && (v.to === 'doccheck' ? docCheckItems(v.id) : v.to === undefined && translateKindOf(v.id));
    if (known && Number.isFinite(age) && age >= 0 && age <= TR_RETURN_MS) return { id: v.id, to: v.to === 'doccheck' ? 'doccheck' : 'translate' };
  } catch { /* 깨진 값은 지운다 */ }
  trReturnClear();
  return null;
}
/** 돌아올 서류가 있고 계정과 조건이 준비됐으면 그 쪽을 연다(빈 쪽). 열었으면 true. 계정의 과정이 달라 그 서류가 없으면 열지 않는다. */
function trResume() {
  if (S.page === 'translate' || S.page === 'doccheck') { if (session.status().signedIn) trReturnClear(); return false; }
  if (S.tr || S.dc || S.page !== 'today' || !session.status().signedIn || !session.document()?.state || !state.onboarded) return false;
  const back = trReturnGet();
  // 계정의 조건을 아직 못 읽었거나 고르기를 기다리는 동안에는 열지 않고 기다린다.
  if (!back || studyLocked() || studyAcct.snapshot().phase === 'loading') return false;
  trReturnClear();
  if (back.to === 'doccheck') {
    S.dc = newDc(back.id);
    if (!dcDoc()) { S.dc = null; return false; }
  } else {
    S.tr = newTr(back.id);
    if (!trDoc()) { S.tr = null; return false; }
  }
  S.page = back.to;
  return true;
}
async function trRunCheck(tr) {
  if (!tr?.sent || !tr.drafts) return;
  const seq = ++tr.seq;
  tr.check = 'checking'; render(false);
  let reply = null, failed = null;
  try {
    const body = validateTranslateRequest({ action: 'check', request_id: crypto.randomUUID(), kind: tr.sent.kind, lines: tr.sent.lines, drafts: tr.drafts.map((d) => d.ko), consent: trConsent(tr) });
    reply = validateCheckReply(await session.translate(body), tr.sent.lines.length);
  } catch (err) { failed = err; }
  if (trStale(tr, seq)) return;
  // 대조는 원장의 다른 연산(path.translate.check)이라 남은 장(초안 연산)을 바꾸지 않는다.
  if (failed || reply.status !== 'done') { tr.check = 'failed'; trRender(); say(accL('다시 옮겨 견주지 못했어요. 초안은 이 화면에 남아 있으니 원문과 직접 견줘 보세요.', 'The back-translation check did not finish. The draft stays on this screen; compare it with the original yourself.')); return; }
  Object.assign(tr, { check: 'done', compared: reply.compared, rows: draftRows(tr.sent.lines, tr.drafts, reply.lines, tr.sent.slots, trHidden()) });
  trRender();
  const n = tr.rows.filter((r) => r.verdict === 'differs' || r.verdict === 'unsure').length;
  say(reply.compared ? accL(`견주기를 마쳤어요. 뜻이 달라 보이는 줄 ${n}곳.`, `Check finished. ${n} line(s) may differ in meaning.`) : accL('자동 대조를 하지 못했어요. 원문과 다시 옮긴 몽골어를 직접 견줘 보세요.', 'The automatic check did not run. Compare the original and the back-translation yourself.'));
}
const PAGES = { today, path, channels, post, univ, univDetail, univCompare, cond, explore, detail, prepare, editor, help, profile, studyConsent, translate, doccheck, ask: () => askCtl.page(), askBrief: () => askCtl.briefPage() };
const LOCKED_ACTIONS = ['pickGoal', 'step2', 'toggle', 'finish', 'skip', 'prepareThis', 'confirm', 'body', 'loc', 'setLang', 'changeGoal', 'prepareJob', 'saveJob', 'removeJob'];
function render(focus = true) {
  if (composingEl && root.contains(composingEl) && document.activeElement === composingEl) { deferredRender = true; deferredFocus = deferredFocus || focus; return; }
  composingEl = null;
  syncStudyOwner();
  syncStudyAccount();
  askCtl.sync();
  if (!STUDY_ON && (S.page === 'univ' || UNIV_PAGES.includes(S.page))) S.page = 'today';
  if (!CHANNEL_ON && (S.page === 'channels' || S.page === 'post')) S.page = 'today';
  // 번역 초안: 계정이 바뀌었거나 로그아웃했으면 메모리의 원문과 초안을 지운다. 고른 서류가 없으면 내 길로.
  // 글도 초안도 없는 빈 쪽이면(손님이 이 쪽에서 로그인한 경우) 지우지 않고 새 계정의 빈 쪽으로 남긴다. 고른 나이 · 동의는 넘기지 않는다.
  if (S.tr && S.tr.owner !== ownerKey()) {
    const had = S.tr.phase !== 'edit' || S.tr.text;
    if (had) { S.tr = null; if (S.page === 'translate') S.flash = esc(trMsg('account')); } else S.tr = newTr(S.tr.docId);
  }
  if (S.page === 'translate' && (!S.tr || !trDoc())) { S.tr = null; S.page = STUDY_ON ? 'path' : 'today'; }
  // 서류 점검도 같다: 계정이 바뀌면 붙여 넣은 글과 찾은 줄을 지운다. 글이 없으면 새 계정의 빈 쪽으로 남긴다.
  if (S.dc && S.dc.owner !== ownerKey()) {
    const had = S.dc.phase !== 'edit' || S.dc.text;
    if (had) { S.dc = null; if (S.page === 'doccheck') S.flash = esc(dcMsg('account')); } else S.dc = newDc(S.dc.docId);
  }
  if (S.page === 'doccheck' && (!S.dc || !dcDoc())) { S.dc = null; S.page = STUDY_ON ? 'path' : 'today'; }
  if (trResume()) focus = true;
  const accSt = session.status();
  const ae = document.activeElement;
  const keepId = !focus && ae && root.contains(ae) ? ae.id : '';
  let selS = null, selE = null;
  if (keepId) { try { selS = ae.selectionStart; selE = ae.selectionEnd; } catch { selS = selE = null; } }
  if (accSt.signedIn && !session.document()?.state) { S.page = 'profile'; S.draft = null; }
  if (!S.draft) S.draft = newDraft();
  document.documentElement.lang = state.lang;
  const main = S.page === 'onboard' ? onboard() : S.page === 'today' ? today() : S.page === 'editor' ? editor()
    : `<main class="content" id="main">${notices(S.page === 'profile')}${PAGES[S.page]()}</main>`;
  const openFolds = focus ? [] : [...root.querySelectorAll('[data-fold]')].filter((d) => d.open).map((d) => d.getAttribute('data-fold'));
  root.innerHTML = shell(main);
  for (const f of openFolds) { const d = root.querySelector(`[data-fold="${f}"]`); if (d) d.open = true; }
  S.drop = false;
  if (!accSt.canEdit) {
    root.querySelectorAll('[data-action]').forEach((c) => { if (LOCKED_ACTIONS.includes(c.dataset.action) && 'disabled' in c) c.disabled = true; });
    const ackLock = root.querySelector('#ack'); if (ackLock) ackLock.disabled = true;
  }
  if (keepId) {
    const n = document.getElementById(keepId);
    if (n && !n.disabled) {
      n.focus();
      if (selS != null && typeof n.setSelectionRange === 'function') { try { n.setSelectionRange(selS, selE ?? selS); } catch { /* not selectable */ } }
    }
  }
  const h1 = root.querySelector('h1');
  const h1Text = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
  document.title = `${h1Text} · PATH`;
  if (focus && h1) { h1.focus(); say(h1Text); }
  sway();
}
// 화면을 옮기면 맨 위에서 시작한다(앞 화면에서 내려 둔 자리에 머물러 뒤로 · 출처 줄이 머리 막대 밑에 숨지 않게).
const toTop = () => { try { if (typeof scrollTo === 'function') scrollTo(0, 0); } catch { /* 시험 환경 */ } };
function go(page) {
  if (S.page === 'translate' && page !== 'translate') {
    if (S.tr?.phase === 'draft' && !confirm(state.lang === 'en' ? 'Leaving this page deletes the draft. It is not stored anywhere. Leave?' : '이 화면을 떠나면 초안이 지워져요. 어디에도 저장하지 않아요. 떠날까요?')) return;
    if (S.tr?.phase === 'sending' && !confirm(state.lang === 'en' ? 'The draft is still being made. If you leave, it is discarded and one of today’s 10 may still be used. Leave?' : '초안을 만드는 중이에요. 지금 떠나면 초안은 버려지고 오늘 한 장이 쓰일 수 있어요. 떠날까요?')) return;
    S.tr = null; trReturnClear();
  } else if (S.page === 'doccheck' && page !== 'doccheck') {
    if (S.dc?.phase === 'done' && !confirm(accL('이 화면을 떠나면 찾은 줄과 붙여 넣은 글이 지워져요. 어디에도 저장하지 않아요. 떠날까요?', 'Leaving this page deletes the result and the pasted text. They are not stored anywhere. Leave?'))) return;
    if (S.dc?.phase === 'sending' && !confirm(accL('글에서 찾는 중이에요. 지금 떠나면 결과는 버려지고 오늘 한 번이 쓰일 수 있어요. 떠날까요?', 'The search is still running. If you leave, the result is discarded and one of today’s 10 may still be used. Leave?'))) return;
    S.dc = null; trReturnClear();
  } else if (!TR_WAIT_PAGES.includes(page)) trReturnClear();
  S.drop = MOTION && page !== S.page && (page === 'onboard' || page === 'today'); S.page = page; S.flash = null; S.dateNote = null; S.docFull = false; S.error = null; S.copyMsg = null; S.studyText = {}; S.studyErrors = {}; render(); toTop(); }

function ensureTask(oppId) {
  const o = oppById(oppId);
  if (!o || !session.status().canEdit) return null;
  const id = o.goal + '-' + o.id;
  if (!state.tasks.some((x) => x.id === id) && !commit(upsertTask(state, { id, goal: o.goal, sourceId: o.id, body: '' }))) return null;
  return id;
}

const jobsFeed = createJobsFeed({ configUrl: './config.json', onChange: () => render(false) });
// 물어보기(AI 상담) · 사람 연결 · 내 상담(AI상담_설계.md). 대화는 이 탭에 가린 글로만 두고, 상태와 그리기는 ask-app.mjs가 맡는다.
const askCtl = createAskController({
  S, root, session, render, go, say, page: () => S.page, lang: () => state.lang, confirm: (m) => confirm(m), uuid: () => crypto.randomUUID(), now: () => Date.now(),
  storage: tabStorage(), rAF: typeof requestAnimationFrame === 'function' ? (f) => requestAnimationFrame(f) : null,
  studyProfile: () => studyProfile(), programs: STUDY_PROGRAMS, posts: CHANNEL_POSTS, studyOn: STUDY_ON, channelOn: CHANNEL_ON,
  pathPick: (id) => ACT.pathPick({ dataset: { id } }), officialHtml: () => sec(t('official'), t('offSub'), officialList(state.primaryGoal || 'all'))
});

const ACT = {
  noop() {},
  async refreshJobs() { await jobsFeed.load(); },
  searchJobs() {
    const v = root.querySelector('#job-query')?.value ?? S.jobQueryText ?? '';
    S.jobQueryText = v; S.jobQuery = v; S.jobPage = 0;
    render(false); root.querySelector('#job-query')?.focus();
  },
  jobPage(el) {
    const n = Number(el.dataset.value ?? el.dataset.page);
    if (!Number.isInteger(n) || n < 0) return;
    S.jobPage = n; render(false);
  },
  saveJob(el) {
    const entry = findJobEntry(el.dataset.id);
    if (!entry || !session.status().canEdit) return;
    localMutation = true;
    try { session.saveJob(entry); state = session.document().state; } finally { localMutation = false; }
    render(false);
  },
  removeJob(el) {
    if (!session.status().canEdit) return;
    localMutation = true;
    try { session.removeJob(el.dataset.id); state = session.document().state; } finally { localMutation = false; }
    render(false);
  },
  prepareJob(el) {
    const entry = findJobEntry(el.dataset.id);
    if (!entry || !session.status().canEdit) return;
    localMutation = true;
    try { session.saveJob(entry); state = session.document().state; } finally { localMutation = false; }
    const id = ensureTask(entry.id);
    if (id == null) { render(false); return; }
    S.taskId = id; go('editor');
  },
  nav: (el) => { if (el.dataset.page === 'channels') S.channelId = null; if (el.dataset.page !== 'today' && S.page !== 'translate' && S.page !== 'doccheck') trReturnClear(); go(el.dataset.page); },
  univOpen(el) { S.univId = el.dataset.id; go('univDetail'); },
  channelOpen(el) { S.channelId = el.dataset.id || null; go('channels'); },
  postOpen(el) { S.postId = el.dataset.id; go('post'); },
  channelShow(el) {
    const id = el.dataset.id, next = studyWrite(toggleChannel(studyProfile(), id));
    render(false); root.querySelector(`[data-action="channelShow"][data-id="${id}"]`)?.focus();
    say(next.channelsOff.includes(id) ? accL('오늘 화면의 새 소식에서 뺐어요.', 'Removed from Latest news on Today.') : accL('오늘 화면의 새 소식에 보여요.', 'Shown in Latest news on Today.'));
  },
  dateToggle(el) {
    const id = el.dataset.id, hit = findDate(CHANNEL_POSTS, id);
    if (!hit) return;
    const cur = studyProfile(), now = new Date();
    let msg;
    if (cur.dates.some((x) => x.id === id)) {
      studyWrite(removeDate(cur, id)); S.dateNote = null;
      msg = accL('다가오는 날에서 뺐어요.', 'Removed from Coming up.');
    } else {
      const st = dateStatus(hit.date, now).state;
      if (st === 'past' || st === 'cancelled') return;
      let base = cur;
      // 서른 개면 지난 날과 글에서 사라진 날부터 정리한다.
      if (base.dates.length >= MAX_DATES) base = keepDates(base, base.dates.filter((x) => { const h = findDate(CHANNEL_POSTS, x.id); const s2 = h && dateStatus(h.date, now).state; return h && s2 !== 'past' && s2 !== 'cancelled'; }).map((x) => x.id));
      const r = addDate(base, { id, start: hit.date.start, end: endDay(hit.date) });
      // 실패 안내는 화면 읽기 알림만이 아니라 날짜 목록 위에도 보인다.
      if (r.full) { S.dateNote = 'full'; msg = dateNoteText(); }
      else {
        S.dateNote = null;
        studyWrite(r.profile);
        msg = studyStore() === 'account' ? accL('다가오는 날에 넣었어요. 계정에 저장돼요.', 'Added to Coming up. Saved to your account.') : study.persisted() ? accL('이 탭의 다가오는 날에 넣었어요.', 'Added to Coming up in this tab.') : accL('이 브라우저에서는 저장할 수 없어 지금 화면에서만 기억해요.', 'This browser cannot store it, so it is kept on this screen only.');
      }
    }
    render(false); (root.querySelector(`[data-action="dateToggle"][data-id="${id}"]`) || root.querySelector('#sx-dates-h') || root.querySelector('.page-title'))?.focus(); say(msg);
  },
  dateConfirm(el) {
    const hit = findDate(CHANNEL_POSTS, el.dataset.id);
    if (!hit) return;
    studyWrite(confirmDate(studyProfile(), { id: hit.date.id, start: hit.date.start, end: endDay(hit.date) }));
    render(false);
    const row = root.querySelector(`.sx-dayrow-btn[data-date="${hit.date.id}"]`), fold = row && row.closest('details');
    if (fold) fold.open = true;
    (row || root.querySelector('#sx-up-h'))?.focus();
    say(accL('바뀐 날짜를 확인했어요.', 'Changed date confirmed.'));
  },
  datesClean() {
    const cur = studyProfile();
    studyWrite(keepDates(cur, cur.dates.filter((x) => findDate(CHANNEL_POSTS, x.id)).map((x) => x.id)));
    render(false); (root.querySelector('#sx-up-h') || root.querySelector('.page-title'))?.focus();
    say(accL('글에서 빠진 날을 목록에서 지웠어요.', 'Removed dates that are no longer in the posts.'));
  },
  dateIcs(el) {
    const hit = findDate(CHANNEL_POSTS, el.dataset.id);
    if (!hit) return;
    try {
      const url = URL.createObjectURL(new Blob([icsText(hit.post, hit.date, state.lang)], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${hit.date.id}.ics`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      if (S.dateNote) { S.dateNote = null; render(false); root.querySelector(`[data-action="dateIcs"][data-id="${hit.date.id}"]`)?.focus(); }
      say(accL('달력 파일을 내려받았어요. 파일을 열어 달력에 넣으세요.', 'Calendar file downloaded. Open it to add the date to your calendar.'));
    } catch {
      S.dateNote = 'ics';
      render(false); root.querySelector(`[data-action="dateIcs"][data-id="${hit.date.id}"]`)?.focus();
      say(dateNoteText());
    }
  },
  studyFilter(el) {
    S.univFilter = STUDY_FILTERS.includes(el.dataset.id) ? el.dataset.id : 'all';
    render(false); root.querySelector(`[data-action="studyFilter"][data-id="${S.univFilter}"]`)?.focus();
  },
  studySet(el) {
    const key = el.dataset.key, id = el.dataset.id;
    const value = key === 'topik' ? Number(id) : id;
    const cur = studyProfile();
    studyWrite(setField(cur, key, cur[key] === value ? null : value));
    render(false); root.querySelector(`[data-action="studySet"][data-key="${key}"][data-id="${id}"]`)?.focus();
    sayStudyCount();
  },
  studyClear() {
    // 조건만 지운다. 비교에 담은 과정, 다가오는 날, 채널 설정, 고른 과정과 서류 표시는 남긴다.
    const cur = studyProfile();
    studyWrite({ ...createProfile(), compare: cur.compare, dates: cur.dates, channelsOff: cur.channelsOff, target: cur.target, docs: cur.docs }); S.studyText = {}; S.studyErrors = {};
    render(false); root.querySelector('[data-action="studySet"]')?.focus();
    say(accL('조건을 모두 지웠어요.', 'All conditions cleared.'));
  },
  pathPick(el) {
    const id = el.dataset.id, program = STUDY_PROGRAMS.find((p) => p.id === id), cur = studyProfile();
    if (!program) return;
    let msg;
    if (cur.target === id) {
      studyWrite(setTarget(cur, null).profile);
      msg = accL('이 과정 준비를 그만했어요. 서류 표시는 남겨 둬요.', 'Stopped preparing for this program. Your marks are kept.');
    } else {
      const set = docsFor(program, cur), keep = set ? set.all.map((d) => d.id) : [];
      const drop = cur.docs.filter((d) => !keep.includes(d.id)).length;
      // 다른 과정으로 바꾸면 그 과정에 없는 표시를 지운다. 지우기 전에 묻는다.
      if (drop && !confirm(accL(`앞 과정에서 표시한 서류 ${drop}개를 지우고 이 과정으로 바꿀까요?`, `Remove ${drop} mark${drop === 1 ? '' : 's'} from the previous program and switch to this one?`))) return;
      studyWrite(setTarget(cur, id, keep).profile);
      msg = drop ? accL(`이 과정으로 준비해요. 앞 과정의 표시 ${drop}개를 지웠어요.`, `Now preparing for this program. Removed ${drop} earlier mark${drop === 1 ? '' : 's'}.`)
        : accL('이 과정으로 준비해요. 오늘 화면의 「내 길」에서 서류를 챙길 수 있어요.', 'Now preparing for this program. Track the documents in “My path” on Today.');
    }
    render(false); (root.querySelector(`[data-action="pathPick"][data-id="${id}"]`) || root.querySelector('.page-title'))?.focus(); say(msg);
  },
  trOpen(el) {
    const id = el.dataset.id;
    if (!translateKindOf(id)) return;
    S.tr = newTr(id); go('translate');
  },
  dcOpen(el) {
    S.dc = newDc(el.dataset.id);
    if (!dcDoc()) { S.dc = null; return; }
    go('doccheck');
  },
  dcLeave() { go(STUDY_ON ? 'path' : 'today'); },
  dcSend: () => dcSend(),
  dcEdit() {
    if (S.dc?.phase !== 'done') return;
    Object.assign(S.dc, { phase: 'edit', rows: null, notice: null, seq: S.dc.seq + 1 });
    render(false); root.querySelector('#dc-text')?.focus();
  },
  dcFresh() {
    if (S.dc?.phase !== 'done') return;
    Object.assign(S.dc, { phase: 'edit', rows: null, notice: null, text: '', agree: false, guardian: false, seq: S.dc.seq + 1 });
    render(false); root.querySelector('#dc-text')?.focus();
  },
  // 면접 연습은 다른 쪽이다. 같은 탭에서 옮겨야 로그인이 이어진다. 넘기는 것은 고른 과정과 TOPIK 급수뿐이다.
  interviewOpen(el) {
    const program = el.dataset.id;
    if (!Object.hasOwn(INTERVIEW_PROGRAMS, program)) return;
    const topik = studyProfile().topik;
    try { tabStorage()?.setItem('synk-path-interview', JSON.stringify({ program, topik: Number.isInteger(topik) ? topik : 0 })); } catch { /* 저장이 막힌 탭: 연습 쪽에서 다시 고른다 */ }
    location.assign('../interview/study/');
  },
  trLeave() { go(STUDY_ON ? 'path' : 'today'); },
  trSend: () => trSend(),
  // 「다시 견주기」 단추는 다시 그리면 사라지므로 초점을 쪽 제목에 먼저 둔다(제목은 id가 있어 다시 그려도 남는다).
  trRecheck: () => { if (S.tr?.phase !== 'draft') return; root.querySelector('#tr-title')?.focus(); say(accL('다시 몽골어로 옮겨 원문과 견주는 중이에요.', 'Translating back into Mongolian to compare again.')); return trRunCheck(S.tr); },
  trFlagged() {
    if (!S.tr) return;
    S.tr.onlyFlagged = !S.tr.onlyFlagged; render(false); root.querySelector('[data-action="trFlagged"]')?.focus();
  },
  async trCopy() {
    const found = trDoc();
    if (!S.tr?.rows || !found) return;
    // 결과 글은 단추 줄 바로 아래에 그린다(쪽 맨 위 알림 줄은 이 자리에서 보이지 않는다).
    const tr = S.tr;
    try { await navigator.clipboard.writeText(draftText(tr.rows, found.doc.name)); tr.copied = 'copied'; }
    catch { tr.copied = 'copyFail'; }
    if (S.tr !== tr) return;
    render(false); root.querySelector('[data-action="trCopy"]')?.focus();
    say(tr.copied === 'copied' ? accL('초안을 복사했어요. 맨 위와 맨 아래에 「번역 초안」 표시가 함께 들어가요.', 'Copied the draft. The “translation draft” label is included at the top and bottom.') : accL('복사하지 못했어요. 「초안 내려받기」를 써 주세요.', 'Could not copy. Use “Download draft”.'));
  },
  trDownload() {
    const found = trDoc();
    if (!S.tr?.rows || !found) return;
    const kind = S.tr.sent?.kind === 'transcript' ? '성적증명서' : '졸업증명서';
    const url = URL.createObjectURL(new Blob([draftText(S.tr.rows, found.doc.name)], { type: 'text/plain;charset=utf-8' }));
    let a = null;
    try { a = document.createElement('a'); a.href = url; a.download = `번역초안_${kind}_${accStamp()}.txt`; a.rel = 'noopener'; document.body.appendChild(a); a.click(); }
    finally { a?.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  },
  trEdit() {
    if (!S.tr) return;
    if (S.tr.phase === 'draft' && !confirm(accL('초안이 지워져요. 붙여 넣은 글은 남겨요. 글을 고칠까요?', 'The draft will be deleted. The pasted text stays. Edit the text?'))) return;
    Object.assign(S.tr, { phase: 'edit', rows: null, drafts: null, sent: null, check: 'idle', compared: false, onlyFlagged: false, notice: null, copied: null, seq: S.tr.seq + 1 });
    render(false); root.querySelector('#tr-text')?.focus();
  },
  trFresh() {
    if (!S.tr) return;
    if ((S.tr.phase === 'draft' || S.tr.text) && !confirm(accL('붙여 넣은 글과 초안을 모두 지울까요?', 'Delete the pasted text and the draft?'))) return;
    const id = S.tr.docId, keep = { age: S.tr.age, remaining: S.tr.remaining };
    S.tr = { ...newTr(id), remaining: keep.remaining, age: keep.age };
    render(false); root.querySelector('#tr-text')?.focus();
  },
  docToggle(el) {
    const id = el.dataset.id, cur = studyProfile(), r = toggleDoc(cur, id, new Date());
    if (r.full) { S.docFull = true; render(false); root.querySelector(`[data-action="docToggle"][data-id="${id}"]`)?.focus(); say(accL('표시가 예순 개라 더 넣을 수 없어요. 다른 과정의 표시를 뺀 뒤 넣어 주세요.', 'You already have 60 marks. Remove some from another program first.')); return; }
    S.docFull = false;
    const next = studyWrite(r.profile), t = pathTarget({ ...channelView(), profile: next });
    render(false);
    const btn = root.querySelector(`[data-action="docToggle"][data-id="${id}"]`), fold = btn && btn.closest('details');
    if (fold) fold.open = true;
    btn?.focus();
    const doc = t && t.set.mine.find((d) => d.id === id), c = doc ? stageCounts(t.set, next)[doc.stage] : null;
    const count = c ? accL(` 이 묶음 ${c.n}/${c.total}.`, ` ${c.n} of ${c.total} in this group.`) : '';
    say((r.on ? accL('준비했어요로 표시했어요.', 'Marked as ready.') : accL('표시를 뺐어요.', 'Mark removed.')) + count);
  },
  studyCompare(el) {
    const id = el.dataset.id, cur = studyProfile(), before = cur.compare.length;
    const next = studyWrite(toggleCompare(cur, id, STUDY_IDS));
    render(false);
    (root.querySelector(`[data-action="studyCompare"][data-id="${id}"]`) || root.querySelector('h1'))?.focus();
    const n = next.compare.length;
    say(n === before ? accL('세 곳까지 담을 수 있어요.', 'You can compare up to 3.')
      : n < before ? accL(`비교에서 뺐어요. 지금 ${n}곳을 담았어요.`, `Removed from compare. ${n} in compare now.`)
        : accL(`비교에 담았어요. 지금 ${n}곳을 담았어요.`, `Added to compare. ${n} in compare now.`));
  },
  setLang(el) {
    const id = el.dataset.id === 'en' ? 'en' : 'ko';
    const back = () => {
      const same = root.querySelector(`[data-action="setLang"][data-id="${id}"]`);
      (same && same.offsetParent !== null ? same : root.querySelector('[data-action="setLang"][aria-pressed="false"]') || same)?.focus();
    };
    if (!session.status().canEdit) { render(false); back(); return; }
    const ok = commit(updateProfile(state, { lang: id }));
    if (ok) S.flash = null;
    render(false); back(); if (ok) say(t('langLabel'));
  },
  pickGoal(el) {
    if (!session.status().canEdit) return;
    const g = goalById(el.dataset.id);
    S.draft.primaryGoal = g.id; S.draft.location = g.defaultLocation;
    S.draft.interests = S.draft.interests.filter((i) => g.interests.some((x) => x.id === i));
    S.draft.secondaryGoals = S.draft.secondaryGoals.filter((x) => x !== g.id);
    render(false); root.querySelector(`[data-action="pickGoal"][data-id="${g.id}"]`)?.focus(); say(pick(g.label));
    kick(g.id, 70);
  },
  step2() { if (S.draft.primaryGoal) { S.step = 2; render(); toTop(); } },
  step1() { S.step = 1; render(); toTop(); },
  skip() { if (!session.status().canEdit) return; if (!commit(updateProfile(state, { onboarded: true, primaryGoal: null }))) { render(false); return; } S.filter = 'all'; go('today'); },
  cancelOnboard() { S.draft = newDraft(); if (state.onboarded) go('profile'); else { S.step = 1; render(); } },
  toggle(el) {
    if (!session.status().canEdit) return;
    const arr = S.draft[el.dataset.key], id = el.dataset.id, i = arr.indexOf(id);
    if (i < 0) arr.push(id); else arr.splice(i, 1);
    el.setAttribute('aria-pressed', String(i < 0));
  },
  finish() {
    if (!session.status().canEdit || !S.draft.primaryGoal) return;
    if (!commit(updateProfile(state, { ...S.draft, onboarded: true }))) { render(false); return; }
    S.step = 1; S.filter = state.primaryGoal || 'all'; S.help = state.primaryGoal || 'study'; go('today');
  },
  exploreGoal(el) { S.filter = el.dataset.id; S.practiceOpen = true; go('explore'); },
  filter(el) { S.filter = el.dataset.id; render(false); root.querySelector(`[data-action="filter"][data-id="${el.dataset.id}"]`)?.focus(); },
  compare(el) {
    const id = el.dataset.id, i = S.compare.indexOf(id);
    if (i >= 0) S.compare.splice(i, 1); else if (S.compare.length < 3) S.compare.push(id); else return say(t('compareMax'));
    render(false); root.querySelector(`[data-action="compare"][data-id="${id}"]`)?.focus(); say(`${t('compareTitle')} ${S.compare.length}/3`);
  },
  clearCompare() { S.compare = []; render(false); say(t('clearCompare')); },
  detail(el) { S.oppId = el.dataset.id; go('detail'); },
  prepareThis(el) { const id = ensureTask(el.dataset.id); if (id == null) { render(false); return; } S.taskId = id; go('editor'); },
  openTask(el) { S.taskId = el.dataset.id; go('editor'); },
  confirm() {
    const body = root.querySelector('#body').value, ack = root.querySelector('#ack').checked;
    const err = !body.trim() ? 'needBody' : !ack ? 'needCheck' : null;
    if (err) { S.error = err; render(false); root.querySelector(err === 'needBody' ? '#body' : '#ack').focus(); return; }
    if (!session.status().canEdit) return;
    if (!saveBody(body)) { render(false); return; }
    const next = confirmTask(state, S.taskId);
    if (!next) return;
    if (!commit(next)) { render(false); return; }
    S.error = null; S.flash = t('confirmed'); render(); say(t('confirmed'));
    kick(state.tasks.find((x) => x.id === S.taskId)?.goal, 90);
  },
  copy() {
    const txt = helpTemplate(S.help);
    const done = (m) => { S.copyMsg = m; render(false); say(t(m)); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => done('copied'), () => done('copyFail'));
    else done('copyFail');
  },
  changeGoal() { if (!session.status().canEdit) return; S.draft = newDraft(); S.step = 1; go('onboard'); },
  clear() { return ACT.clearGuest(); },
  reset() { return ACT.clearGuest(); }
};
for (const [k, f] of Object.entries(askCtl.actions)) { if (Object.hasOwn(ACT, k)) throw new Error('ask action name clash: ' + k); ACT[k] = f; }

function sayStudyCount() {
  say(studyCountSay(studyView()));
}
// 숫자 칸: 읽을 수 있는 값이면 바로 조건에 넣고, 아니면 조건은 그대로 두고 칸 아래에 알린다.
// 치는 동안 칸은 다시 그리지 않는다(커서와 휴대폰 자판을 지킨다). 칸 아래 글과 결과 자리만 바꾼다.
let studySayTimer = null;
function studyInput(el) {
  const key = el.dataset.key;
  if (key !== 'gradePct' && key !== 'fundsWon') return;
  const v = parseWhole(el.value, 0, key === 'gradePct' ? GRADE_MAX : FUNDS_MAX_MAN);
  S.studyText = { ...S.studyText, [key]: el.value };
  if (v === undefined) S.studyErrors = { ...S.studyErrors, [key]: true };
  else {
    const { [key]: _gone, ...rest } = S.studyErrors; S.studyErrors = rest;
    if (!studyLocked()) studyWrite(setField(studyProfile(), key, v === null ? null : key === 'fundsWon' ? v * 10000 : v));
  }
  const bad = !!S.studyErrors[key];
  if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  const hint = root.querySelector(`#${el.id}-hint`);
  if (hint) { hint.textContent = condHint(state.lang, key, bad); hint.setAttribute('class', bad ? 'sx-hint is-error' : 'sx-hint'); }
  const result = root.querySelector('#sx-cond-result');
  if (result) result.innerHTML = renderCondResult(condView());
  const note = root.querySelector('.sx-store');
  if (note && !study.persisted() && !/is-warn/.test(note.getAttribute('class') || '')) { render(false); return; }
  if (studySayTimer) clearTimeout(studySayTimer);
  studySayTimer = setTimeout(() => {
    studySayTimer = null;
    if (S.page !== 'cond') return;
    if (S.studyErrors[key]) say(condHint(state.lang, key, true)); else sayStudyCount();
  }, 900);
}

function saveBody(body) {
  const task = state.tasks.find((x) => x.id === S.taskId);
  if (!task) return false;
  if (task.body === body) return true;
  if (!session.status().canEdit) return false;
  let next = upsertTask(state, { id: task.id, goal: task.goal, sourceId: task.sourceId, body });
  if (!next) return false;
  if (task.confirmedAt) next = { ...next, tasks: next.tasks.map((x) => (x.id === task.id ? { ...x, confirmedAt: null } : x)) };
  if (!commit(next)) return false;
  const ackEl = root.querySelector('#ack');
  if (ackEl) ackEl.checked = false;
  if (task.confirmedAt) {
    const st = root.querySelector('#task-status');
    if (st) st.innerHTML = statusHtml({ confirmedAt: null });
    S.flash = null;
    root.querySelector('#flash')?.remove();
    root.querySelector('#confirmed-result')?.remove();
    const sl = root.querySelector('#seal-slot'); if (sl) { sl.textContent = t('sealSlot'); sl.classList?.remove('is-sealed'); }
    say(t('editInvalid'));
  }
  return true;
}

function downloadPath(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  let a = null;
  try {
    a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
  } finally { a?.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
function requestCurrentBackup(useRemote, name) {
  pendingBackup = null;
  const snap = session.exportCurrent();
  downloadPath(snap, name);
  if (snap && snap.backupToken) pendingBackup = { snap, useRemote, owner: ownerKey() };
  return !!pendingBackup;
}
const accL = (ko, en) => (state.lang === 'en' ? en : ko);
const accOk = (r) => r !== false && r?.ok !== false;
const accStamp = () => new Date().toISOString().slice(0, 10);
Object.assign(ACT, {
  studyConsentOpen() { S.consentReturn = S.page === 'studyConsent' ? S.consentReturn : S.page; S.consentMinor = null; S.consentGuardian = false; S.consentError = ''; go('studyConsent'); },
  consentAge(el) { if (S.consentBusy) return; S.consentMinor = el.dataset.id === 'minor'; if (!S.consentMinor) S.consentGuardian = false; S.consentError = ''; render(false); root.querySelector(`[data-action="consentAge"][data-id="${el.dataset.id}"]`)?.focus(); },
  consentGuardian() { if (S.consentBusy) return; S.consentGuardian = !S.consentGuardian; render(false); root.querySelector('[data-action="consentGuardian"]')?.focus(); },
  async consentSave() {
    if (S.consentBusy || S.consentMinor === null || (S.consentMinor && !S.consentGuardian)) return;
    S.consentBusy = true; S.consentError = ''; render(false);
    const id = studyAcctId, ok = await studyAcct.give({ profile: tabStudyProfile(), minor: S.consentMinor, lang: state.lang === 'en' ? 'en' : 'ko' });
    S.consentBusy = false;
    if (ok === 'exists' && id === studyAcctId) {
      S.consentAsk = false; studyCompared = null; settleStudy(studyAcct.snapshot());
      go(STUDY_PAGES.includes(S.consentReturn) || S.consentReturn === 'profile' ? S.consentReturn : 'today');
      S.flash = accL('이 계정에는 이미 계정에 저장한 조건이 있어요. 그 조건을 이어서 써요.', 'This account already has saved conditions. Continuing with them.'); render(false); say(S.flash); return;
    }
    if (ok !== true || id !== studyAcctId) { S.consentError = accL('계정에 저장하지 못했어요. 조건은 이 탭에 그대로 있어요. 잠시 뒤 다시 시도해 주세요.', 'Could not save to your account. Your conditions are still in this tab. Please try again later.'); render(false); say(S.consentError); return; }
    // 서버가 받은 뒤에만 탭을 비운다.
    seenSet(id); refusedSet(null); S.consentRefused = false; studyCompared = id; study.clear(); study.setOwner(id); S.consentAsk = false; S.studyChoice = false;
    const back = STUDY_PAGES.includes(S.consentReturn) || S.consentReturn === 'profile' ? S.consentReturn : 'today';
    go(back); S.flash = accL('계정에 저장했어요. 다른 기기에서도 이어서 볼 수 있어요.', 'Saved to your account. You can continue on other devices.'); render(false); say(S.flash);
  },
  consentRefuse() {
    if (S.consentBusy) return;
    S.consentRefused = true; refusedSet(studyAcctId); S.consentAsk = false;
    if (S.page === 'studyConsent') go(STUDY_PAGES.includes(S.consentReturn) || S.consentReturn === 'profile' ? S.consentReturn : 'today');
    S.flash = accL('이 탭에만 둘게요. 내 정보에서 언제든 계정에 저장할 수 있어요.', 'Kept in this tab only. You can save to your account any time on the Profile page.'); render(false); say(S.flash);
  },
  async studyAccountDelete() {
    if (!confirm(accL('계정에 저장한 「내 조건」 · 「다가오는 날」 · 고른 과정 · 서류 표시를 지우고 동의를 거둬요. 지울까요?', 'Delete the conditions, upcoming dates, program and marks saved to your account and withdraw your consent?'))) return;
    const ok = await studyAcct.remove();
    // 이 탭에서 지웠으니 지우는 사이 알게 된 「다른 곳에서 지워졌어요」는 끈다(같은 일을 두 번 알리지 않게).
    if (ok) { seenSet(null); S.consentRefused = true; refusedSet(studyAcctId); S.studyChoice = false; studyCompared = null; studyAcct.clearNotice(); }
    S.flash = ok ? accL('계정의 유학 준비 자료를 지웠어요. 이제 넣는 조건은 이 탭에만 남아요.', 'Deleted your study data from the account. Conditions you add now stay in this tab only.') : accL('지우지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'Could not delete. Please try again later.');
    render(false); say(S.flash);
  },
  async studyAccountRetry() { await studyAcct.retry(); render(false); },
  studyUseAccount() { study.clear(); if (studyAcctId) study.setOwner(studyAcctId); S.studyChoice = false; S.flash = accL('계정에 저장된 조건을 써요.', 'Using the conditions saved to your account.'); render(false); say(S.flash); },
  studyUseTab() {
    const tabP = tabStudyProfile();
    if (!hasStudyData(tabP)) { ACT.studyUseAccount(); return; }
    const next = normalizeStudyProfile({ ...tabP, v: 1 });
    try { studyAcct.write(next, () => next); } catch { return; }
    study.clear(); if (studyAcctId) study.setOwner(studyAcctId); S.studyChoice = false;
    S.flash = accL('이 탭의 조건으로 계정을 바꿨어요.', 'Replaced your account conditions with this tab.'); render(false); say(S.flash);
  },
  studyNoticeClose() { studyAcct.clearNotice(); render(false); },
  async studyDraftAccount() { await studyAcct.useAccount(); S.flash = accL('계정에 저장된 조건을 써요.', 'Using the conditions saved to your account.'); render(false); say(S.flash); },
  async studyDraftPick() {
    const d = studyAcct.snapshot().localDrafts[0];
    if (!d) return;
    const ok = await studyAcct.pickDraft(d.id);
    S.flash = ok ? accL('남은 변경을 계정에 올려요.', 'Sending the unsent changes to your account.') : accL('남은 변경을 찾지 못했어요. 계정 것을 써요.', 'Could not find the unsent changes. Using the account.');
    render(false); say(S.flash);
  },
  accountSignIn: async () => {
    if (S.page === 'translate' && S.tr) trReturnSet(S.tr.docId);
    else if (S.page === 'doccheck' && S.dc && docCheckItems(S.dc.docId)) trReturnSet(S.dc.docId, 'doccheck');
    try { if (!(await session.signIn())) trReturnClear(); } catch (err) { trReturnClear(); throw err; }
  },
  accountSignOut: async () => {
    // 계정에 올라가지 않은 조건 변경이 있으면 한 번 더 보내 보고, 그래도 남으면 확인받고 지운다(공용 기기).
    if (studyAcct.snapshot().pending) {
      await studyAcct.retry();
      if (studyAcct.snapshot().pending) {
        if (!confirm(accL('계정에 아직 올라가지 않은 조건 변경이 있어요. 로그아웃하면 이 변경은 지워져요. 로그아웃할까요?', 'Some condition changes are not in your account yet. Signing out deletes them. Sign out?'))) return;
      }
    }
    const studyId = studyAcctId;
    trReturnClear(); // 로그아웃하는 동안 손님 화면을 다시 그리며 번역 쪽이 열리거나, 다음 사람에게 남지 않게 먼저 지운다.
    const r = await session.signOut();
    // 준비 글 쪽 사정으로 로그아웃이 거절되면 조건 초안도 그대로 둔다. 로그아웃한 뒤에만 이 계정의 초안 · 복구 기록을 지운다.
    if (!accOk(r)) { render(false); return; }
    studyAcct.discardLocal(studyId);
    S.flash = accL('로그아웃했습니다.', 'Signed out.'); render(false); say(S.flash);
  },
  accountRetry: async () => { await session.retry(); render(false); },
  accountImport: async () => {
    const r = await session.importGuest();
    if (accOk(r)) { S.flash = accL('이 탭의 경로를 계정으로 가져왔습니다.', 'Imported this tab\'s path into your account.'); say(S.flash); }
    render(false);
  },
  accountUseRemote: async () => {
    const st0 = session.status();
    if (st0.signedIn && !st0.loaded && st0.syncStatus === 'local-conflict') {
      pendingBackup = null;
      const owner0 = ownerKey();
      const acct0 = st0.accountId;
      const draft0 = S.draft;
      const ok = confirm(accL('이 기기에 보존된 로컬 복구 자료는 지우지 않고 그대로 남아 있어요. 계정에 저장된 자료를 불러올까요?', 'The preserved local recovery data on this device is kept and stays available. Load the version saved in your account?'));
      if (!ok) { render(false); return; }
      const st1 = session.status();
      if (S.draft !== draft0 || ownerKey() !== owner0 || st1.accountId !== acct0 || !(st1.signedIn && !st1.loaded && st1.syncStatus === 'local-conflict')) {
        S.flash = accL('계정 상태가 바뀌었어요. 내 정보에서 계정 상태를 확인한 뒤 다시 시도해 주세요.', 'Your account status changed. Check your account status in Profile and try again.');
        say(S.flash); render(false); return;
      }
      let r;
      try { r = await session.useRemote(); } catch (e) { r = false; }
      if (ownerKey() !== owner0 || session.status().accountId !== acct0) {
        S.flash = accL('계정이 바뀌어 작업을 마치지 않았어요. 계정 상태를 확인한 뒤 다시 시도해 주세요.', 'The account changed, so the action was not completed. Check your account status and try again.');
      } else if (accOk(r) && session.status().loaded) {
        S.flash = accL('계정 자료를 불러왔어요. 로컬 복구 자료는 이 기기에 그대로 남아 있어요.', 'Loaded the account version. The local recovery data is still kept on this device.');
      } else {
        S.flash = accL('계정 자료를 불러오지 못했어요. 연결과 계정 상태를 확인한 뒤 다시 시도해 주세요.', 'Could not load the account version. Check your connection and account status, then try again.');
      }
      say(S.flash); render(false); return;
    }
    if (requestCurrentBackup(true, `path-backup-${accStamp()}.json`)) { S.flash = accL('백업 파일 저장을 요청했어요. 파일이 저장된 것을 직접 확인한 뒤 내 정보의 확인 버튼을 누르면 계정 자료를 불러와요.', 'A backup file download was requested. After you check the file is saved, use the confirmation button in Profile to load the account version.'); say(S.flash); }
    else { S.flash = accL('아직 계정 자료를 불러올 준비가 되지 않았어요. 잠시 후 다시 시도하거나 계정 상태를 확인해 주세요.', 'Not ready to load the account version yet. Try again shortly or check your account status.'); say(S.flash); }
    render(false);
  },
  accountConfirmBackup: async () => {
    const p = pendingBackup;
    if (!p || p.owner !== ownerKey() || !session.status().canConfirmBackup) { pendingBackup = null; render(false); return; }
    if (p.useRemote && !confirm(accL('백업 파일이 저장된 것을 확인했다고 표시하고, 계정에 저장된 경로를 불러올까요? 현재 화면의 자료는 바뀝니다.', 'Mark that you checked the backup file is saved, and load the path saved in your account? The current view will be replaced.'))) { render(false); return; }
    if (!session.confirmBackup(p.snap)) { pendingBackup = null; S.flash = accL('자료가 바뀌어 이 백업 확인은 더 이상 유효하지 않아요. 다시 내보내 주세요.', 'Your data changed, so this backup confirmation is no longer valid. Please export again.'); render(false); say(S.flash); return; }
    pendingBackup = null;
    if (p.useRemote) {
      const r = await session.useRemote();
      if (accOk(r)) { S.flash = accL('계정에 저장된 경로를 불러왔습니다.', 'Loaded the path saved in your account.'); say(S.flash); }
    } else { S.flash = accL('백업 파일을 확인했다고 표시했어요.', 'Marked that you checked the backup file.'); say(S.flash); }
    render(false);
  },
  accountRecover: async (el) => {
    const r = await session.chooseRecovery(el.dataset.id);
    if (accOk(r)) { S.flash = accL('선택한 경로로 복구했습니다.', 'Restored the selected path.'); say(S.flash); }
    render(false);
  },
  accountExport: () => {
    if (requestCurrentBackup(false, `path-${accStamp()}.json`)) { S.flash = accL('백업 파일 저장을 요청했어요. 파일이 저장된 것을 직접 확인했다면 내 정보에서 확인 버튼을 눌러 주세요.', 'A backup file download was requested. If you checked the file is saved, use the confirmation button in Profile.'); say(S.flash); }
    render(false);
  },
  accountExportGuest: () => { downloadPath(session.exportGuest(), `path-device-${accStamp()}.json`); render(false); },
  accountExportRemote: async () => { downloadPath(await session.exportRemote(), `path-account-${accStamp()}.json`); render(false); },
  accountExportRecovery: () => { downloadPath(session.exportRecovery(), `path-recovery-${accStamp()}.json`); render(false); },
  clearGuest: () => {
    if (!confirm(accL('이 탭에 저장된 게스트 자료를 지울까요? 계정에 저장된 자료에는 영향이 없습니다.', 'Clear the guest data saved in this tab? Data saved in your account is not affected.'))) return;
    const r = session.clearGuest();
    if (accOk(r)) { study.clear(); S.studyText = {}; S.studyErrors = {}; S.flash = accL('이 탭의 게스트 자료를 지웠습니다.', 'Cleared guest data in this tab.'); say(S.flash); }
    render(false);
  },
});
root.addEventListener('click', (e) => {
  const el = e.target.closest('button[data-action]');
  if (!el || el.disabled || !ACT[el.dataset.action]) return;
  if (STUDY_WRITE_ACTS.has(el.dataset.action) && studyLocked()) { const m = studyStoreNote(); S.flash = esc(m); render(false); say(m); return; }
  const fail = (err) => { const m = getAccountErrorMessage(err, state.lang); S.flash = esc(m); render(false); say(m); };
  try { Promise.resolve(ACT[el.dataset.action](el)).catch(fail); } catch (err) { fail(err); }
});
root.addEventListener('toggle', (e) => { if (e.target?.classList?.contains('practice')) S.practiceOpen = !!e.target.open; }, true);
root.addEventListener('compositionstart', (e) => {
  if (!root.contains(e.target)) return;
  if (compTimer) { clearTimeout(compTimer); compTimer = null; }
  composingEl = e.target; composingOwner = ownerKey();
});
root.addEventListener('compositionend', (e) => {
  const el = e.target;
  if (el !== composingEl) return;
  if (compTimer) clearTimeout(compTimer);
  compTimer = setTimeout(() => {
    compTimer = null;
    if (composingEl !== el) return;
    composingEl = null; composingOwner = null;
    if (deferredRender) { const f = deferredFocus; deferredRender = false; deferredFocus = false; render(f); }
  }, 0);
});
root.addEventListener('input', (e) => {
  if (!root.contains(e.target)) return;
  if (e.isComposing) { if (composingEl !== e.target) { composingEl = e.target; composingOwner = ownerKey(); } }
  if (composingEl === e.target && composingOwner !== ownerKey()) return;
  if (e.target.dataset.action === 'jobQuery') { S.jobQueryText = e.target.value; return; }
  if (askCtl.input(e.target)) return;
  if (e.target.dataset.action === 'trText') {
    // 다시 그리지 않고 글자 수와 단추만 고친다(한글 · 키릴 입력 중에 칸을 덮지 않게).
    if (!S.tr || S.tr.phase === 'sending') return;
    S.tr.text = e.target.value;
    const cnt = root.querySelector('#tr-count'); if (cnt) cnt.textContent = trCountText(S.tr.text, state.lang === 'en');
    const btn = root.querySelector('[data-action="trSend"]'); if (btn) btn.disabled = !trCanSend(S.tr);
    if (S.tr.error) { S.tr.error = null; e.target.removeAttribute('aria-invalid'); e.target.setAttribute('aria-describedby', 'tr-count'); root.querySelector('#tr-err')?.remove(); }
    return;
  }
  if (e.target.dataset.action === 'dcText') {
    if (!S.dc || S.dc.phase === 'sending') return;
    S.dc.text = e.target.value;
    const cnt = root.querySelector('#dc-count'); if (cnt) cnt.textContent = trCountText(S.dc.text, state.lang === 'en');
    const btn = root.querySelector('[data-action="dcSend"]'); if (btn) btn.disabled = !dcCanSend(S.dc);
    if (S.dc.error) { S.dc.error = null; e.target.removeAttribute('aria-invalid'); e.target.setAttribute('aria-describedby', 'dc-count'); root.querySelector('#dc-err')?.remove(); }
    return;
  }
  if (e.target.dataset.action === 'studyInput') {
    try { studyInput(e.target); } catch (err) { const m = getAccountErrorMessage(err, state.lang); S.flash = esc(m); render(false); say(m); }
    return;
  }
  if (e.target.dataset.action === 'body') {
    const v = e.target.value, ss = e.target.selectionStart, se = e.target.selectionEnd;
    if (!saveBody(v)) {
      render(false);
      const b = root.querySelector('#body');
      if (b && b.value !== v) { b.value = v; if (document.activeElement === b) { try { b.setSelectionRange(ss, se); } catch { /* ignore */ } } }
      return;
    }
    const cnt = root.querySelector('#count'); if (cnt) cnt.textContent = countText(v);
    if (S.error === 'needBody' && e.target.value.trim()) { S.error = null; e.target.removeAttribute('aria-invalid'); const err = root.querySelector('#edit-err'); if (err) err.textContent = ''; }
  }
});
root.addEventListener('change', (e) => {
  const a = e.target.dataset.action;
  if (askCtl.change(e.target)) return;
  if (a === 'loc') { if (session.status().canEdit) S.draft.location = e.target.value; }
  else if (a === 'jobBoard') { S.jobBoard = e.target.value || 'all'; S.jobPage = 0; render(false); root.querySelector('[data-action="jobBoard"]')?.focus(); }
  else if (a === 'savedJobs') { S.onlySaved = !!e.target.checked; S.jobPage = 0; render(false); root.querySelector('[data-action="savedJobs"]')?.focus(); }
  else if (a === 'topic') { S.help = e.target.value; S.copyMsg = null; render(false); root.querySelector('#topic')?.focus(); }
  // 점검 줄의 표시는 다시 그리지 않는다(칸이 스스로 보인다). 번호만 이 메모리에 둔다.
  else if (S.dc && a === 'dcMark') {
    const i = Number(e.target.dataset.value);
    if (Number.isInteger(i) && i >= 0) { const key = dcMarkKey(state.lang, i); if (e.target.checked) S.dc.marks.add(key); else S.dc.marks.delete(key); }
  }
  else if (S.dc && S.dc.phase !== 'sending' && ['dcAge', 'dcGuardian', 'dcAgree'].includes(a)) {
    if (a === 'dcAge' && ['adult', 'teen', 'under14'].includes(e.target.value)) { S.dc.age = e.target.value; if (S.dc.age !== 'teen') S.dc.guardian = false; if (S.dc.age === 'under14') S.dc.agree = false; }
    else if (a === 'dcGuardian') S.dc.guardian = !!e.target.checked;
    else if (a === 'dcAgree') S.dc.agree = !!e.target.checked;
    const id = e.target.id;
    render(false); if (id) root.querySelector('#' + id)?.focus();
  }
  else if (S.tr && S.tr.phase !== 'sending' && ['trKind', 'trAge', 'trGuardian', 'trAgree'].includes(a)) {
    if (a === 'trKind' && translateKindChoice(S.tr.docId) && ['grad', 'transcript'].includes(e.target.value)) S.tr.kind = e.target.value;
    else if (a === 'trAge' && ['adult', 'teen', 'under14'].includes(e.target.value)) { S.tr.age = e.target.value; if (S.tr.age !== 'teen') S.tr.guardian = false; if (S.tr.age === 'under14') S.tr.agree = false; }
    else if (a === 'trGuardian') S.tr.guardian = !!e.target.checked;
    else if (a === 'trAgree') S.tr.agree = !!e.target.checked;
    const id = e.target.id;
    render(false); if (id) root.querySelector('#' + id)?.focus();
  }
});
// 마우스가 카드를 스치면 살짝 흔들린다(움직임을 켠 화면에서만)
root.addEventListener('pointerover', (e) => {
  if (!MOTION || e.pointerType !== 'mouse') return;
  const h = e.target.closest?.('.hang'), b = h && bodies.get(h);
  if (b && !b.hot) { b.v += (e.movementX >= 0 ? -1 : 1) * 22; b.hot = true; setTimeout(() => { b.hot = false; }, 600); }
});
root.addEventListener('submit', (e) => {
  if (!e.target.classList?.contains('jobs-filters')) return;
  e.preventDefault();
  ACT.searchJobs();
});
root.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'job-query') { e.preventDefault(); ACT.searchJobs(); return; }
  const el = e.target.closest?.('.goal-choice');
  if (!el || !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
  e.preventDefault();
  const all = [...root.querySelectorAll('.goal-choice')], i = all.indexOf(el);
  const n = all[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
  ACT.pickGoal(n);
});

S.draft = newDraft();
render(false);
void session.init().catch((err) => { const m = getAccountErrorMessage(err, state.lang); S.flash = esc(m); render(false); say(m); })
  .finally(() => {
    studySettled = true;
    // 로그인을 그만두고 손님으로 돌아온 것이 확실할 때만 지운다(일시 연결 오류나 로그인 이동 중에는 남긴다).
    if (['signed-out', 'unconfigured'].includes(session.status().accountStatus)) trReturnClear();
    if (syncStudyOwner()) render(false);
  });
void jobsFeed.load();
