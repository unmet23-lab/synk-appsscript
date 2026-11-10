import { GOALS, OPPORTUNITIES, OFFICIAL_LINKS, EXISTING_TOOLS } from './content.mjs';
import { createPathSession } from './account.mjs';
import { renderAccountPanel, renderAccountNotice, getAccountErrorMessage } from './account-ui.mjs';
import { createJobsFeed, renderJobs, jobOpportunity } from './jobs-ui.mjs';
import { SCHEMA_VERSION, STORAGE_KEY, createInitialState, normalizeState, updateProfile, upsertTask, confirmTask, getNextTask } from './state.mjs';

void SCHEMA_VERSION; void STORAGE_KEY;
const root = document.getElementById('app');
const announcer = document.getElementById('announcer');

const DICT = {
  preview: ['베타', 'Beta'], langLabel: ['언어', 'Language'], navLabel: ['주요 메뉴', 'Main menu'],
  today: ['오늘', 'Today'], explore: ['탐색', 'Explore'], prepare: ['준비', 'Prepare'], help: ['도움', 'Help'], profile: ['내 정보', 'Profile'],
  step1: ['1 / 2 단계', 'Step 1 of 2'], step2: ['2 / 2 단계 · 선택', 'Step 2 of 2 · Optional'],
  q1: ['지금, 어떤 준비를 하고 있나요?', 'What are you preparing for right now?'],
  q1lead: ['하나를 고르면 맞는 첫 화면을 보여 드려요. 나중에 바꿀 수 있어요.', 'Pick one and we will tailor your first screen. You can change it later.'],
  next: ['다음', 'Next'], skip: ['건너뛰기', 'Skip'], back: ['이전', 'Back'], cancel: ['취소', 'Cancel'], start: ['시작하기', 'Start'], save: ['저장', 'Save'],
  q2: ['조금 더 알려 주세요', 'Tell us a little more'], q2lead: ['모두 선택 사항이에요. 비워 두어도 괜찮아요.', 'Everything here is optional.'],
  interests: ['관심 있는 것', 'Interests'], secondary: ['함께 보고 싶은 목표', 'Other goals to follow'], location: ['지금 있는 곳', 'Where you are now'],
  locHint: ['목표에 맞춰 미리 골라 두었어요. 바꿀 수 있어요.', 'Pre-selected from your goal. You can change it.'],
  abroad: ['해외', 'Abroad'], korea: ['한국', 'Korea'], unknown: ['정하지 않음', 'Not decided'],
  todayEyebrow: ['오늘 할 일', 'Today'], todayTitle: ['다음 한 걸음', 'Your next step'], neutralTitle: ['어디서부터 시작할까요?', 'Where would you like to start?'],
  resume: ['이어서 작성하기', 'Continue writing'], resumeNote: ['아직 확인하지 않은 준비가 있어요', 'You have an unconfirmed draft'],
  demoNote: ['미리보기용 예시예요. 실제 기관이나 공고가 아니니, 실제 정보는 공식 안내에서 확인하세요.', 'Preview examples only, not real institutions or postings. Check official sources for real details.'],
  tools: ['기존 SYNK 도구', 'Existing SYNK tools'], official: ['공식 링크', 'Official links'], officialBadge: ['공식', 'Official'], demo: ['예시', 'Example'],
  checked: ['확인일', 'Checked'], openNew: ['새 창에서 열기', 'opens in new tab'],
  exploreTitle: ['기회 둘러보기', 'Explore opportunities'], all: ['전체', 'All'], filter: ['목표로 거르기', 'Filter by goal'],
  details: ['자세히', 'Details'], compareAdd: ['비교에 담기', 'Add to compare'], compareOn: ['비교 중', 'Comparing'], compareTitle: ['비교', 'Comparison'],
  compareMax: ['최대 3개까지 비교할 수 있어요.', 'You can compare up to 3.'], clearCompare: ['비교 비우기', 'Clear comparison'],
  requirements: ['준비할 내용', 'What to prepare'], prepareThis: ['이 목표 준비하기', 'Prepare for this'], backList: ['목록으로', 'Back to list'],
  prepareTitle: ['내 준비', 'My preparation'], noTasks: ['아직 시작한 준비가 없어요. 탐색에서 하나를 골라 보세요.', 'No preparation yet. Pick one in Explore.'],
  open: ['열기', 'Open'], draft: ['작성 중', 'Drafting'], done: ['준비 완료 · 미제출', 'Ready · Not submitted'],
  source: ['출처', 'Source'], prompt: ['작성 안내', 'Prompt'], body: ['내 답변', 'Your answer'], maxlen: ['최대 6000자 · 저장 상태는 계정 안내에서 확인하세요', 'Up to 6000 characters · check save status in the account notice'],
  confirmCheck: ['내용을 직접 확인했고 실제 제출은 공식 경로로 한다는 것을 이해했어요', 'I reviewed this myself and understand real submission happens through official channels'],
  confirm: ['준비 완료로 표시', 'Mark as ready'], needBody: ['내용을 먼저 적어 주세요.', 'Please write something first.'], needCheck: ['확인 항목에 체크해 주세요.', 'Please tick the confirmation box.'],
  confirmed: ['준비 완료로 표시했어요. 아무 곳에도 제출되지 않았어요.', 'Marked as ready. Nothing was submitted anywhere.'],
  nextAction: ['다음 준비로', 'Go to next task'], exploreMore: ['다른 기회 보기', 'See other opportunities'], editInvalid: ['내용이 바뀌어 다시 확인이 필요해요.', 'Content changed; please confirm again.'],
  result: ['정리된 내용', 'Your summary'], missing: ['찾을 수 없는 항목이에요.', 'Item not found.'],
  helpTitle: ['도움 받기', 'Get help'], helpLead: ['공식 기관에 물어볼 질문을 정리해요. 답을 대신 판단하지 않아요.', 'Draft a question for official sources. PATH does not judge answers.'],
  topic: ['주제', 'Topic'], general: ['일반 체류 안내', 'General stay info'], template: ['질문 템플릿', 'Question template'], copy: ['복사하기', 'Copy'],
  copied: ['복사했어요.', 'Copied.'], copyFail: ['복사하지 못했어요. 아래 글을 직접 선택해 복사하세요.', 'Copy failed. Select the text below and copy it manually.'],
  profileTitle: ['내 정보', 'Profile'], goal: ['목표', 'Goal'], none: ['선택 안 함', 'Not selected'], lang: ['언어', 'Language'],
  changeGoal: ['목표 바꾸기', 'Change goal'], storage: ['저장 방식', 'Storage'],
  storageText: ['로그인하지 않으면 작성 내용은 이 탭에만 저장돼요. 로그인하면 이 탭의 자료를 계정으로 가져올지, 계정에 저장된 자료를 쓸지 고를 수 있어요. 공용 기기라면 사용 후 데이터를 지워 주세요.', 'Without signing in, drafts are saved only in this tab. When you sign in, you can choose to import this tab\u2019s data into your account or use the data saved in your account. On a shared device, clear the data when you are done.'],
  deleteFail: ['저장된 데이터를 지우지 못했어요. 지금 상태는 그대로 두었어요.', 'Could not delete saved data. Your current state was kept as is.'],
  clear: ['이 탭의 PATH 데이터 지우기', 'Clear PATH data in this tab'], clearAsk: ['이 탭에 저장된 PATH 데이터를 지울까요?', 'Clear PATH data saved in this tab?'], cleared: ['지웠어요.', 'Cleared.'],
  blocked: ['저장된 데이터를 읽을 수 없어 저장을 멈췄어요. 원본은 그대로 두었고 지금 화면은 메모리로만 동작해요.', 'Saved data could not be read, so saving is paused. The original is untouched; this screen runs in memory only.'],
  reset: ['저장 데이터 초기화', 'Reset saved data'], resetAsk: ['읽을 수 없는 저장 데이터를 지우고 새로 시작할까요?', 'Delete unreadable saved data and start fresh?'],
  storeFail: ['이 탭에 저장하지 못했어요. 작성 내용은 화면에 남아 있어요.', 'Could not save in this tab. Your text stays on screen.'],
  pageAnn: ['페이지', 'page'],
  artKicker: ['PATH · 한국 여정', 'PATH · Korea journey'], artTitle: ['한국에서의 다음 장.', 'Your next chapter in Korea.'],
  artPrep: ['준비', 'Prepare'], artPrepD: ['목표를 정하고 서류와 질문 정리', 'Set a goal, gather documents and questions'],
  artArrive: ['도착', 'Arrive'], artArriveD: ['학교와 생활에 자리 잡기', 'Settle into school and daily life'],
  artOpp: ['기회', 'Opportunities'], artOppD: ['공고를 비교하고 지원 준비', 'Compare postings and get ready to apply'],
  journeyTitle: ['준비의 세 걸음', 'Three steps forward'],
  j1: ['기회 찾기', 'Find opportunities'], j1d: ['실제 채용 공고와 연습용 예시를 구분해서 둘러보고 비교해요.', 'Browse real job postings and practice examples, clearly labeled, and compare them.'], j1go: ['둘러보기', 'Explore'],
  j2: ['자료 준비', 'Prepare materials'], j2d: ['내 말로 답변 초안을 적어 두어요.', 'Draft your answers in your own words.'], j2go: ['내 준비 보기', 'View my preparation'],
  j3: ['직접 확인', 'Check it yourself'], j3d: ['내용을 직접 확인하고, 실제 제출은 공식 경로로 해요.', 'Review it yourself, then submit through official channels.'], j3go: ['확인하러 가기', 'Go review'],
  homeOpps: ['이 목표의 예시 기회', 'Example opportunities for this goal'], seeAll: ['모두 보기', 'See all'],
  neutralLead: ['목표 하나를 고르면 맞는 예시와 준비 흐름을 보여 드려요.', 'Pick a goal to see matching examples and a preparation flow.'],
  toolsLead: ['공식 안내와 별개인 SYNK 페이지예요. 새 창에서 열리고 PATH 저장 내용과 분리돼요.', 'Separate SYNK pages, not official sources. They open in a new tab, apart from PATH data.']
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

const S = { page: state.onboarded ? 'today' : 'onboard', step: 1, draft: null, filter: state.primaryGoal || 'all', compare: [], oppId: null, taskId: null, help: state.primaryGoal || 'study', flash: null, copyMsg: null, error: null };
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

const TABS = ['today', 'explore', 'prepare', 'help', 'profile'];
function shell(main) {
  const nav = state.onboarded && S.page !== 'onboard';
  const acctSt = session.status();
  const acct = acctSt.signedIn
    ? `<button type="button" class="secondary account-btn" data-action="nav" data-page="profile"${S.page === 'profile' ? ' aria-current="page"' : ''}>${state.lang === 'en' ? 'My account' : '내 계정'}</button>`
    : `<button type="button" class="secondary account-btn" data-action="accountSignIn">${state.lang === 'en' ? 'Sign in' : '가입·로그인'}</button>`;
  const btns = TABS.map((p) => `<button type="button" data-action="nav" data-page="${p}"${navActive(p) ? ' aria-current="page" class="active"' : ''}>${t(p)}</button>`).join('');
  return `<div class="app-shell${nav ? ' has-nav' : ''}"><header class="topbar">
<button type="button" class="brand" data-action="${nav ? 'nav' : 'noop'}" data-page="today" aria-label="PATH">PATH</button><span class="preview-label">${t('preview')}</span>
${nav ? `<nav class="main-nav" aria-label="${t('navLabel')}">${btns}</nav>` : ''}
${acct}<label class="sr-only" for="lang">${t('langLabel')}</label><select id="lang" class="lang-select" data-action="lang"><option value="ko"${state.lang === 'ko' ? ' selected' : ''}>한국어</option><option value="en"${state.lang === 'en' ? ' selected' : ''}>English</option></select></header>
${main}${nav ? `<nav class="mobile-nav" aria-label="${t('navLabel')}">${btns}</nav>` : ''}</div>`;
}
function navActive(p) { return S.page === p || (p === 'explore' && S.page === 'detail') || (p === 'prepare' && S.page === 'editor'); }

function notices() {
  const accSt = session.status();
  blocked = !!accSt.guestBlocked;
  storageError = accSt.error?.code === 'LOCAL_STORAGE_UNAVAILABLE';
  const guestStore = storageError && !accSt.signedIn;
  let h = guestStore ? '' : (renderAccountNotice(accSt, state.lang) || '');
  if (blocked) h += `<div class="notice error" role="alert"><p>${t('blocked')}</p><div class="actions"><button type="button" class="secondary" data-action="reset">${t('reset')}</button></div></div>`;
  h += `<div id="store-note" class="notice error" role="status"${storageError ? '' : ' hidden'}><span>${t('storeFail')}</span>${guestStore ? ` <button type="button" class="text-button" data-action="accountRetry">${accL('다시 시도', 'Retry')}</button>` : ''}</div>`;
  if (S.flash) h += `<div id="flash" class="notice" role="status">${S.flash}</div>`;
  return h;
}
const head = (title, eyebrow, lead) => `<header class="page-header">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1 class="page-title" tabindex="-1">${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</header>`;
const ext = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="sr-only"> (${t('openNew')})</span></a>`;
function demoBadge(o) {
  if (o?.source === 'live') return `<span class="badge">${state.lang === 'en' ? 'Official job posting' : '공식 채용 공고'}</span>`;
  return `<span class="badge">${t('demo')}</span>`;
}
const liveLink = (o) => o?.source === 'live' && o.url ? `<p><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${state.lang === 'en' ? 'View original posting (opens in new tab)' : '원문 공고 보기 (새 탭)'}</a></p>` : '';
const findJobEntry = (id) => (jobsFeed.snapshot().jobs || []).find((j) => j.id === id) || (session.document()?.savedJobs || []).find((j) => j.id === id);

function onboard() {
  const d = S.draft;
  if (S.step === 1) {
    const items = GOALS.map((g, gi) => `<li role="none"><button type="button" class="goal-choice" role="radio" aria-checked="${d.primaryGoal === g.id}" tabindex="${d.primaryGoal === g.id || (!d.primaryGoal && g === GOALS[0]) ? 0 : -1}" data-action="pickGoal" data-id="${g.id}"><span class="choice-icon" aria-hidden="true">${goalIcon(g.id)}</span><span class="choice-copy"><span class="choice-num" aria-hidden="true">0${gi + 1}</span><span class="choice-title">${esc(pick(g.label))}</span><span class="choice-desc">${esc(pick(g.description))}</span></span><span class="choice-mark" aria-hidden="true"></span></button></li>`).join('');
    return `<p class="step-label">${t('step1')}</p><h1 class="page-title" id="q1" tabindex="-1">${t('q1')}</h1><p class="lead">${t('q1lead')}</p>
<ul class="choice-list" role="radiogroup" aria-labelledby="q1">${items}</ul>
<div class="actions"><button type="button" class="primary" data-action="step2"${d.primaryGoal ? '' : ' disabled'}>${t('next')}</button><button type="button" class="text-button" data-action="skip">${t('skip')}</button>${state.onboarded ? `<button type="button" class="text-button" data-action="cancelOnboard">${t('cancel')}</button>` : ''}</div>`;
  }
  const g = goalById(d.primaryGoal);
  const chips = (list, key) => list.map((x) => `<button type="button" class="chip" aria-pressed="${d[key].includes(x.id)}" data-action="toggle" data-key="${key}" data-id="${x.id}">${esc(pick(x.label))}</button>`).join('');
  const locs = ['abroad', 'korea', 'unknown'].map((l) => `<option value="${l}"${d.location === l ? ' selected' : ''}>${t(l)}</option>`).join('');
  return `<p class="step-label">${t('step2')}</p><h1 class="page-title" tabindex="-1">${t('q2')}</h1><p class="lead">${t('q2lead')}</p>
<fieldset class="field"><legend>${t('interests')}</legend><div class="chips">${chips(g.interests, 'interests')}</div></fieldset>
<fieldset class="field"><legend>${t('secondary')}</legend><div class="chips">${chips(GOALS.filter((x) => x.id !== g.id), 'secondaryGoals')}</div></fieldset>
<div class="field"><label for="loc">${t('location')}</label><span class="hint" id="loc-hint">${t('locHint')}</span><select id="loc" class="lang-select" aria-describedby="loc-hint" data-action="loc">${locs}</select></div>
<div class="actions"><button type="button" class="primary" data-action="finish">${t('start')}</button><button type="button" class="secondary" data-action="step1">${t('back')}</button><button type="button" class="text-button" data-action="cancelOnboard">${t('cancel')}</button></div>`;
}

const svgIcon = (p) => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${p}</svg>`;
const ICONS = {
  study: svgIcon('<path d="M4 26h24"/><path d="M7 20.5 25 11a2.6 2.6 0 0 1 2.3 4.6L10 24l-4.5-2.2 2-1.3"/><path d="m14 15.5-3.5-6 3-1 7.5 4"/>'),
  student: svgIcon('<path d="M16 9.5V26"/><path d="M16 9.5C12.8 7.6 8.8 7 5 7.4v16c3.8-.4 7.8.2 11 2.1 3.2-1.9 7.2-2.5 11-2.1v-16c-3.8-.4-7.8.2-11 2.1z"/>'),
  job: svgIcon('<rect x="5" y="10" width="22" height="15" rx="2.5"/><path d="M12 10V7.5A1.5 1.5 0 0 1 13.5 6h5A1.5 1.5 0 0 1 20 7.5V10"/><path d="M5 16.5h22"/><path d="M14.5 15v3h3v-3"/>'),
  arrive: svgIcon('<path d="M16 27s-8-7.2-8-13a8 8 0 0 1 16 0c0 5.8-8 13-8 13z"/><circle cx="16" cy="14" r="3"/>'),
  open: svgIcon('<path d="M16 4v6M16 22v6M4 16h6M22 16h6"/><circle cx="16" cy="16" r="5"/>')
};
const goalIcon = (id) => ICONS[id] || '';
function onboardArt() {
  const order = state.lang === 'en' ? [1, 0] : [0, 1];
  const ms = [['artPrep', 'artPrepD', 'study'], ['artArrive', 'artArriveD', 'arrive'], ['artOpp', 'artOppD', 'open']];
  return `<div class="onboard-art" aria-hidden="true"><div><p class="art-kicker">${t('artKicker')}</p><p class="art-title">${DICT.artTitle[order[0]]}</p><p class="art-sub">${DICT.artTitle[order[1]]}</p></div><ol class="art-journey">${ms.map(([a, b, ic], i) => `<li><span class="art-node">${ICONS[ic]}</span><span class="art-text"><span class="art-num">0${i + 1}</span><strong>${t(a)}</strong><span>${t(b)}</span></span></li>`).join('')}</ol></div>`;
}
const heroArt = () => `<div class="hero-art" aria-hidden="true"><svg viewBox="0 0 320 200" fill="none" focusable="false"><path d="M20 176C86 176 82 104 150 104S220 32 298 28"/><circle cx="20" cy="176" r="7"/><circle cx="150" cy="104" r="7"/><circle class="end" cx="298" cy="28" r="10"/></svg><ol class="hero-marks"><li>${t('artPrep')}</li><li>${t('artArrive')}</li><li>${t('artOpp')}</li></ol></div>`;
function journey(exploreId, task) {
  const link = (attrs, label) => `<button type="button" class="step-link" ${attrs}>${label}<span aria-hidden="true">&nbsp;→</span></button>`;
  const step = (n, a, b, btn) => `<li class="journey-step"><span class="journey-num" aria-hidden="true">0${n}</span><h3>${t(a)}</h3><p>${t(b)}</p>${btn}</li>`;
  return `<section class="home-section"><h2 class="home-h2">${t('journeyTitle')}</h2><ol class="journey">${step(1, 'j1', 'j1d', link(`data-action="exploreGoal" data-id="${exploreId}"`, t('j1go')))}${step(2, 'j2', 'j2d', task ? link(`data-action="openTask" data-id="${esc(task.id)}"`, t('resume')) : link('data-action="nav" data-page="prepare"', t('j2go')))}${step(3, 'j3', 'j3d', link('data-action="nav" data-page="prepare"', t('j3go')))}</ol></section>`;
}
function today() {
  const g = goalById(state.primaryGoal);
  if (!g) {
    return `<section class="home-hero"><div class="hero-copy"><p class="eyebrow">${t('todayEyebrow')}</p><h1 class="page-title" tabindex="-1">${t('neutralTitle')}</h1><p class="hero-title">${t('neutralLead')}</p></div>${heroArt()}</section><ul class="goal-entrances">${GOALS.map((x, i) => `<li><span class="choice-icon" aria-hidden="true">${goalIcon(x.id)}</span><span class="journey-num" aria-hidden="true">0${i + 1}</span><h2>${esc(pick(x.label))}</h2><p>${esc(pick(x.homeTitle))}</p><button type="button" class="secondary" data-action="exploreGoal" data-id="${x.id}">${esc(pick(x.homeAction))}</button></li>`).join('')}</ul>${journey('all', null)}`;
  }
  const nt = getNextTask(state);
  const task = nt && nt.goal === g.id && !nt.confirmedAt ? nt : null;
  const opps = OPPORTUNITIES.filter((o) => o.goal === g.id).slice(0, 2);
  const cta = task
    ? `<button type="button" class="primary" data-action="openTask" data-id="${esc(task.id)}">${t('resume')}</button>`
    : `<button type="button" class="primary" data-action="exploreGoal" data-id="${g.id}">${esc(pick(g.homeAction))}</button>`;
  let h = `<section class="home-hero"><div class="hero-copy"><p class="eyebrow">${t('todayEyebrow')} · ${esc(pick(g.description))}</p><h1 class="page-title" tabindex="-1">${t('todayTitle')}</h1><p class="hero-goal"><span class="goal-pill"><span aria-hidden="true">${goalIcon(g.id)}</span><span>${esc(pick(g.label))}</span></span></p><p class="hero-title">${esc(pick(g.homeTitle))}</p>${task ? `<p class="hero-note">${t('resumeNote')} · ${esc(pick(oppById(task.sourceId).title))}</p>` : ''}<div class="actions">${cta}</div></div>${heroArt()}</section>`;
  h += journey(g.id, task);
  h += `<section class="home-section"><div class="home-h2-row"><h2 class="home-h2">${t('homeOpps')}</h2><button type="button" class="step-link" data-action="exploreGoal" data-id="${g.id}">${t('seeAll')}<span aria-hidden="true">&nbsp;→</span></button></div><p class="proto-note">${t('demoNote')}</p><ul class="home-opps">${opps.map((o) => `<li><div>${demoBadge()}<h3>${esc(pick(o.title))}</h3><p>${esc(pick(o.summary))}</p></div><button type="button" class="secondary" data-action="detail" data-id="${o.id}">${t('details')}</button></li>`).join('')}</ul></section>`;
  return h;
}
// Previous home renderer, kept unreferenced for reference only.
function todayLegacy() {
  const g = goalById(state.primaryGoal);
  let h = head(g ? t('todayTitle') : t('neutralTitle'), t('todayEyebrow'));
  if (g) {
    const nt = getNextTask(state);
    const task = nt && nt.goal === g.id && !nt.confirmedAt ? nt : null;
    h += `<section class="home-feature"><div class="feature-copy"><h2>${esc(pick(g.homeTitle))}</h2><p>${task ? `${t('resumeNote')} · ${esc(pick(oppById(task.sourceId).title))}` : esc(pick(g.description))}</p></div>
${task ? `<button type="button" class="primary" data-action="openTask" data-id="${esc(task.id)}">${t('resume')}</button>` : `<button type="button" class="primary" data-action="exploreGoal" data-id="${g.id}">${esc(pick(g.homeAction))}</button>`}
<p class="feature-note">${t('demoNote')}</p></section>`;
  } else {
    h += `<ul class="opportunity-list">${GOALS.map((x) => `<li class="opportunity"><div><h3>${esc(pick(x.label))}</h3><p>${esc(pick(x.homeTitle))}</p></div><button type="button" class="secondary" data-action="exploreGoal" data-id="${x.id}">${esc(pick(x.homeAction))}</button></li>`).join('')}</ul><p class="bottom-note">${t('demoNote')}</p>`;
  }
  h += `<div class="section-heading"><h2>${t('tools')}</h2></div><ul class="link-list">${EXISTING_TOOLS.map((x) => `<li><div>${ext(x.url, pick(x.title))}<p>${esc(pick(x.summary))}</p></div></li>`).join('')}</ul>`;
  return h;
}

function officialList(goal) {
  const list = OFFICIAL_LINKS.filter((l) => goal === 'all' || l.goal === goal || l.goal === null);
  return `<ul class="link-list">${list.map((l) => `<li><div><span class="badge official">${t('officialBadge')}</span>${ext(l.url, pick(l.title))}<p>${esc(pick(l.summary))}</p><p class="meta">${t('checked')} ${esc(l.checkedAt)}</p></div></li>`).join('')}</ul>`;
}

function explore() {
  const f = S.filter;
  const filt = ['all', ...GOALS.map((g) => g.id)].map((id) => `<button type="button" class="chip" aria-pressed="${f === id}" data-action="filter" data-id="${id}">${id === 'all' ? t('all') : esc(pick(goalById(id).description))}</button>`).join('');
  const list = OPPORTUNITIES.filter((o) => f === 'all' || o.goal === f);
  const full = S.compare.length >= 3;
  let h = head(t('exploreTitle'), t('explore'));
  h += `<div role="group" aria-label="${t('filter')}" class="chips">${filt}</div>`;
  if (['all', 'job', 'student'].includes(f)) h += renderJobs({ feed: jobsFeed.snapshot(), lang: state.lang, savedJobs: session.document()?.savedJobs || [], query: S.jobQueryText ?? S.jobQuery ?? '', board: S.jobBoard || 'all', onlySaved: !!S.onlySaved, page: S.jobPage || 0, canEdit: session.status().canEdit });
  h += `<details class="practice"><summary>${state.lang === 'en' ? 'Practice examples' : '연습용 예시'}</summary><p class="meta">${t('demoNote')}</p>`;
  h += `<div class="section-heading"><h2>${t('demo')}</h2></div><ul class="opportunity-list">${list.map((o) => {
    const on = S.compare.includes(o.id);
    return `<li class="opportunity"><div>${demoBadge(o)}<h3>${esc(pick(o.title))}</h3><p>${esc(pick(o.summary))}</p></div><div class="actions"><button type="button" class="secondary" data-action="detail" data-id="${o.id}">${t('details')}</button><button type="button" class="chip" aria-pressed="${on}" data-action="compare" data-id="${o.id}"${full && !on ? ' disabled' : ''}>${on ? t('compareOn') : t('compareAdd')}</button></div></li>`;
  }).join('')}</ul>`;
  if (full) h += `<p class="meta">${t('compareMax')}</p>`;
  if (S.compare.length) {
    h += `<div class="section-heading"><h2>${t('compareTitle')} (${S.compare.length}/3)</h2><button type="button" class="text-button" data-action="clearCompare">${t('clearCompare')}</button></div><div class="compare-grid">${S.compare.map(oppById).map((o) => `<div class="compare-item">${demoBadge(o)}<h3>${esc(pick(o.title))}</h3><ul>${o.requirements.map((r) => `<li>${esc(pick(r))}</li>`).join('')}</ul></div>`).join('')}</div>`;
  }
  h += '</details>';
  h += `<div class="section-heading"><h2>${t('official')}</h2></div>${officialList(f)}`;
  return h;
}

function detail() {
  const o = oppById(S.oppId);
  if (!o) return head(t('missing')) + `<button type="button" class="secondary" data-action="nav" data-page="explore">${t('backList')}</button>`;
  return `<article class="detail">${demoBadge(o)}<h1 class="page-title" tabindex="-1">${esc(pick(o.title))}</h1><p class="meta">${esc(pick(goalById(o.goal).label))}</p><p>${esc(pick(o.summary))}</p>${liveLink(o)}
<h2 class="section-heading">${t('requirements')}</h2><ol class="requirements">${o.requirements.map((r) => `<li>${esc(pick(r))}</li>`).join('')}</ol>
<div class="actions"><button type="button" class="primary" data-action="${o.source === 'live' ? 'prepareJob' : 'prepareThis'}" data-id="${esc(o.id)}">${t('prepareThis')}</button><button type="button" class="secondary" data-action="nav" data-page="explore">${t('backList')}</button></div></article>
<div class="section-heading"><h2>${t('official')}</h2></div>${officialList(o.goal)}`;
}

const statusHtml = (task) => `<span class="status" data-state="${task.confirmedAt ? 'done' : 'draft'}">${task.confirmedAt ? t('done') : t('draft')}</span>`;
function prepare() {
  let h = head(t('prepareTitle'), t('prepare'));
  if (!state.tasks.length) return h + `<p class="empty">${t('noTasks')}</p><div class="actions"><button type="button" class="primary" data-action="nav" data-page="explore">${t('explore')}</button></div>`;
  for (const g of GOALS) {
    const ts = state.tasks.filter((x) => x.goal === g.id);
    if (!ts.length) continue;
    h += `<div class="section-heading"><h2>${esc(pick(g.label))}</h2></div><ul class="task-list">${ts.map((x) => { const so = oppById(x.sourceId); return `<li class="task-row"><div>${demoBadge(so)}<h3>${so ? esc(pick(so.title)) : t('missing')}</h3><p>${statusHtml(x)}</p></div><button type="button" class="secondary" data-action="openTask" data-id="${esc(x.id)}">${t('open')}</button></li>`; }).join('')}</ul>`;
  }
  return h;
}

function editor() {
  const task = state.tasks.find((x) => x.id === S.taskId);
  const o = task && oppById(task.sourceId);
  if (!o) return head(t('missing')) + `<button type="button" class="secondary" data-action="nav" data-page="prepare">${t('prepare')}</button>`;
  let h = `<article class="detail">${demoBadge(o)}<h1 class="page-title" tabindex="-1">${esc(pick(o.title))}</h1>
<p class="meta"><span>${t('source')}: ${demoBadge(o)}<button type="button" class="text-button" data-action="detail" data-id="${esc(o.id)}">${esc(pick(o.title))}</button></span></p>${liveLink(o)}
<p><strong>${t('prompt')}:</strong> ${esc(pick(o.prompt))}</p>
<section class="editor"><div class="field"><label for="body">${t('body')}</label><span class="hint" id="body-hint">${t('maxlen')}</span>
<textarea id="body" maxlength="6000" aria-describedby="body-hint edit-err" data-action="body"${S.error === 'needBody' ? ' aria-invalid="true"' : ''}>${esc(task.body)}</textarea></div>
<p id="task-status">${statusHtml(task)}</p>
<label class="check-row"><input type="checkbox" id="ack"${task.confirmedAt ? ' checked' : ''}> <span>${t('confirmCheck')}</span></label>
<p id="edit-err" class="meta" role="alert">${S.error ? t(S.error) : ''}</p>
<div class="actions"><button type="button" class="primary" data-action="confirm">${t('confirm')}</button><button type="button" class="secondary" data-action="nav" data-page="prepare">${t('prepare')}</button></div></section>`;
  if (task.confirmedAt) {
    const nx = getNextTask(state);
    h += `<div id="confirmed-result"><div class="section-heading"><h2>${demoBadge(o)}${t('result')}</h2></div><div class="result-body">${esc(task.body)}</div>
<div class="actions">${nx && nx.id !== task.id && !nx.confirmedAt ? `<button type="button" class="primary" data-action="openTask" data-id="${esc(nx.id)}">${t('nextAction')}</button>` : ''}<button type="button" class="secondary" data-action="exploreGoal" data-id="${task.goal}">${t('exploreMore')}</button></div></div>`;
  }
  return h + '</article>';
}

function helpTemplate(topic) {
  const g = goalById(topic);
  const subj = g ? pick(g.label) : t('general');
  return state.lang === 'en'
    ? `Hello,\nI am contacting you about: ${subj}.\nMy current location: ${t(state.location || 'unknown')}.\n\n1. What official requirements apply to my situation?\n2. Which documents should I prepare, and where can I find the official list?\n3. Is there an official page or contact I should check first?\n\nThank you.`
    : `안녕하세요.\n다음 주제로 문의드립니다: ${subj}\n현재 있는 곳: ${t(state.location || 'unknown')}\n\n1. 제 상황에 적용되는 공식 요건은 무엇인가요?\n2. 준비해야 할 서류와 공식 목록은 어디에서 확인할 수 있나요?\n3. 먼저 확인해야 할 공식 페이지나 문의처가 있을까요?\n\n감사합니다.`;
}
function help() {
  const opts = [...GOALS.map((g) => [g.id, pick(g.label)]), ['general', t('general')]].map(([id, l]) => `<option value="${id}"${S.help === id ? ' selected' : ''}>${esc(l)}</option>`).join('');
  return head(t('helpTitle'), t('help'), t('helpLead')) + `<div class="field"><label for="topic">${t('topic')}</label><select id="topic" class="lang-select" data-action="topic">${opts}</select></div>
<div class="section-heading"><h2>${t('template')}</h2><button type="button" class="secondary" data-action="copy">${t('copy')}</button></div>
${S.copyMsg ? `<p class="notice${S.copyMsg === 'copyFail' ? ' error' : ''}" role="status">${t(S.copyMsg)}</p>` : ''}<pre class="result-body" id="tpl">${esc(helpTemplate(S.help))}</pre>
<div class="section-heading"><h2>${t('official')}</h2></div>${officialList(S.help === 'general' ? 'none' : S.help)}
<div class="section-heading"><h2>${t('tools')}</h2></div><p class="proto-note">${t('toolsLead')}</p><ul class="link-list tools">${EXISTING_TOOLS.map((x) => `<li><div>${ext(x.url, pick(x.title))}<p>${esc(pick(x.summary))}</p></div></li>`).join('')}</ul>`;
}

function profile() {
  const g = goalById(state.primaryGoal);
  const accSt = session.status();
  return head(t('profileTitle'), t('profile')) + renderAccountPanel(accSt, state.lang, { pendingBackup: !!pendingBackup && !!accSt.canConfirmBackup && pendingBackup.owner === ownerKey(), useRemote: !!pendingBackup?.useRemote }) + `<section class="settings-group"><h2>${t('goal')}</h2><p>${g ? esc(pick(g.label)) : t('none')}</p><button type="button" class="secondary" data-action="changeGoal">${t('changeGoal')}</button></section>
<section class="settings-group"><h2>${t('location')}</h2><p>${t(state.location || 'unknown')}</p></section>
<section class="settings-group"><h2>${t('lang')}</h2><p>${state.lang === 'en' ? 'English' : '한국어'}</p></section>
<section class="settings-group"><h2>${t('storage')}</h2>${accSt.signedIn ? `<p>${state.lang === 'en' ? 'Syncs to your account. Please check the save status above.' : '계정에 동기화합니다. 위의 저장 상태를 확인해 주세요.'}</p>` : `<p>${t('storageText')}</p><button type="button" class="secondary" data-action="clear">${t('clear')}</button>`}</section>`;
}

const PAGES = { today, explore, detail, prepare, editor, help, profile };
const LOCKED_ACTIONS = ['pickGoal', 'step2', 'toggle', 'finish', 'skip', 'prepareThis', 'confirm', 'body', 'loc', 'lang', 'changeGoal', 'prepareJob', 'saveJob', 'removeJob'];
function render(focus = true) {
  if (composingEl && root.contains(composingEl) && document.activeElement === composingEl) { deferredRender = true; deferredFocus = deferredFocus || focus; return; }
  composingEl = null;
  const accSt = session.status();
  const ae = document.activeElement;
  const keepId = !focus && ae && root.contains(ae) ? ae.id : '';
  let selS = null, selE = null;
  if (keepId) { try { selS = ae.selectionStart; selE = ae.selectionEnd; } catch { selS = selE = null; } }
  if (accSt.signedIn && !session.document()?.state) { S.page = 'profile'; S.draft = null; }
  if (!S.draft) S.draft = newDraft();
  document.documentElement.lang = state.lang;
  const main = S.page === 'onboard'
    ? `<main class="onboard-layout">${onboardArt()}<div class="onboard-main">${notices()}${onboard()}</div></main>`
    : `<main class="content">${notices()}${PAGES[S.page]()}</main>`;
  root.innerHTML = shell(main);
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
  document.title = `${h1 ? h1.textContent : ''} · PATH`;
  if (focus && h1) { h1.focus(); say(h1.textContent); }
}
function go(page) { S.page = page; S.flash = null; S.error = null; S.copyMsg = null; render(); }

function ensureTask(oppId) {
  const o = oppById(oppId);
  if (!o || !session.status().canEdit) return null;
  const id = o.goal + '-' + o.id;
  if (!state.tasks.some((x) => x.id === id) && !commit(upsertTask(state, { id, goal: o.goal, sourceId: o.id, body: '' }))) return null;
  return id;
}

const jobsFeed = createJobsFeed({ configUrl: './config.json', onChange: () => render(false) });

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
  nav: (el) => go(el.dataset.page),
  pickGoal(el) {
    if (!session.status().canEdit) return;
    const g = goalById(el.dataset.id);
    S.draft.primaryGoal = g.id; S.draft.location = g.defaultLocation;
    S.draft.interests = S.draft.interests.filter((i) => g.interests.some((x) => x.id === i));
    S.draft.secondaryGoals = S.draft.secondaryGoals.filter((x) => x !== g.id);
    render(false); root.querySelector(`[data-id="${g.id}"]`)?.focus(); say(pick(g.label));
  },
  step2() { if (S.draft.primaryGoal) { S.step = 2; render(); } },
  step1() { S.step = 1; render(); },
  skip() { if (!session.status().canEdit) return; if (!commit(updateProfile(state, { onboarded: true, primaryGoal: null }))) { render(false); return; } S.filter = 'all'; go('today'); },
  cancelOnboard() { S.draft = newDraft(); if (state.onboarded) go('profile'); else { S.step = 1; render(); } },
  toggle(el) {
    if (!session.status().canEdit) return;
    const arr = S.draft[el.dataset.key], id = el.dataset.id, i = arr.indexOf(id);
    if (i < 0) arr.push(id); else arr.splice(i, 1);
    el.setAttribute('aria-pressed', String(i < 0));
  },
  finish() {
    if (!session.status().canEdit) return;
    if (!commit(updateProfile(state, { ...S.draft, onboarded: true }))) { render(false); return; }
    S.filter = state.primaryGoal || 'all'; S.help = state.primaryGoal || 'study'; go('today');
  },
  exploreGoal(el) { S.filter = el.dataset.id; go('explore'); },
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
  accountSignIn: async () => { await session.signIn(); },
  accountSignOut: async () => {
    const r = await session.signOut();
    if (!accOk(r)) { render(false); return; }
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
    if (accOk(r)) { S.flash = accL('이 탭의 게스트 자료를 지웠습니다.', 'Cleared guest data in this tab.'); say(S.flash); }
    render(false);
  },
});
root.addEventListener('click', (e) => {
  const el = e.target.closest('button[data-action]');
  if (!el || el.disabled || !ACT[el.dataset.action]) return;
  const fail = (err) => { const m = getAccountErrorMessage(err, state.lang); S.flash = esc(m); render(false); say(m); };
  try { Promise.resolve(ACT[el.dataset.action](el)).catch(fail); } catch (err) { fail(err); }
});
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
  if (e.target.dataset.action === 'body') {
    const v = e.target.value, ss = e.target.selectionStart, se = e.target.selectionEnd;
    if (!saveBody(v)) {
      render(false);
      const b = root.querySelector('#body');
      if (b && b.value !== v) { b.value = v; if (document.activeElement === b) { try { b.setSelectionRange(ss, se); } catch { /* ignore */ } } }
      return;
    }
    if (S.error === 'needBody' && e.target.value.trim()) { S.error = null; e.target.removeAttribute('aria-invalid'); const err = root.querySelector('#edit-err'); if (err) err.textContent = ''; }
  }
});
root.addEventListener('change', (e) => {
  const a = e.target.dataset.action;
  if (a === 'lang') { if (!session.status().canEdit) { render(false); return; } const ok = commit(updateProfile(state, { lang: e.target.value === 'en' ? 'en' : 'ko' })); if (ok) S.flash = null; render(false); root.querySelector('#lang')?.focus(); if (ok) say(t('langLabel')); }
  else if (a === 'loc') { if (session.status().canEdit) S.draft.location = e.target.value; }
  else if (a === 'jobBoard') { S.jobBoard = e.target.value || 'all'; S.jobPage = 0; render(false); root.querySelector('[data-action="jobBoard"]')?.focus(); }
  else if (a === 'savedJobs') { S.onlySaved = !!e.target.checked; S.jobPage = 0; render(false); root.querySelector('[data-action="savedJobs"]')?.focus(); }
  else if (a === 'topic') { S.help = e.target.value; S.copyMsg = null; render(false); root.querySelector('#topic')?.focus(); }
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
void session.init().catch((err) => { const m = getAccountErrorMessage(err, state.lang); S.flash = esc(m); render(false); say(m); });
void jobsFeed.load();
