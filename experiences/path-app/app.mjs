import { GOALS, OPPORTUNITIES, OFFICIAL_LINKS, EXISTING_TOOLS } from './content.mjs';
import { createPathSession } from './account.mjs';
import { renderAccountPanel, renderAccountNotice, getAccountErrorMessage } from './account-ui.mjs';
import { createJobsFeed, renderJobs, jobOpportunity } from './jobs-ui.mjs';
import { SCHEMA_VERSION, STORAGE_KEY, createInitialState, normalizeState, updateProfile, upsertTask, confirmTask, getNextTask } from './state.mjs';

void SCHEMA_VERSION; void STORAGE_KEY;
const root = document.getElementById('app');
const announcer = document.getElementById('announcer');

// 화면 결: 「패스」 — 줄에 매단 카드 한 장(내 목표)과 한 걸음마다 찍히는 도장. 2026-11-13 리디자인(시안 C).
const DICT = {
  langLabel: ['언어', 'Language'], navLabel: ['주요 메뉴', 'Main menu'],
  today: ['오늘', 'Today'], explore: ['찾기', 'Explore'], prepare: ['준비', 'Prepare'], help: ['도움', 'Help'], profile: ['나', 'Me'],
  signIn: ['가입 · 로그인', 'Sign in'], myAccount: ['내 계정', 'My account'],
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

const S = { page: state.onboarded ? 'today' : 'onboard', step: 1, draft: null, filter: state.primaryGoal || 'all', compare: [], oppId: null, taskId: null, help: state.primaryGoal || 'study', flash: null, copyMsg: null, error: null, drop: MOTION, practiceOpen: false };
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
const TABS = ['today', 'explore', 'prepare', 'help', 'profile'];
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
<button type="button" class="logo" data-action="${nav ? 'nav' : 'noop'}" data-page="today" aria-label="PATH"><span class="logo-mark" aria-hidden="true"></span>PATH</button>
${nav ? `<nav class="tabs" aria-label="${t('navLabel')}">${tabs}</nav>` : ''}<div class="bar-right">${lang}${acct}</div></header>
${main}${nav ? `<nav class="tabbar" aria-label="${t('navLabel')}">${bar}</nav>` : ''}</div>`;
}
function navActive(p) { return S.page === p || (p === 'explore' && S.page === 'detail') || (p === 'prepare' && S.page === 'editor'); }

// quiet = 첫 실행에서는 「로그인하지 않은 상태」 안내를 빼고(첫 화면을 카드에 양보), 오류 · 저장 실패 · 막힘만 보인다
function notices(quiet = false, noFlash = false) {
  const accSt = session.status();
  blocked = !!accSt.guestBlocked;
  storageError = accSt.error?.code === 'LOCAL_STORAGE_UNAVAILABLE';
  const guestStore = storageError && !accSt.signedIn;
  const plainGuest = !accSt.signedIn && !accSt.error;
  let h = guestStore || (quiet && plainGuest) ? '' : (renderAccountNotice(accSt, state.lang) || '');
  if (blocked) h += `<div class="notice error" role="alert"><p>${t('blocked')}</p><div class="actions"><button type="button" class="secondary" data-action="reset">${t('reset')}</button></div></div>`;
  h += `<div id="store-note" class="notice error" role="status"${storageError ? '' : ' hidden'}><span>${t('storeFail')}</span>${guestStore ? ` <button type="button" class="text-button" data-action="accountRetry">${accL('다시 시도', 'Retry')}</button>` : ''}</div>`;
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
<div class="home-grid">${sec(t('official'), t('offSub'), officialList('all'))}${sec(t('tools'), '', toolRows())}</div></div></main>`;
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
${stamps(st, g.steps.map(pick))}${card}
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
<section class="settings-group"><h2>${t('storage')}</h2>${accSt.signedIn ? `<p>${state.lang === 'en' ? 'Syncs to your account. Please check the save status above.' : '계정에 동기화합니다. 위의 저장 상태를 확인해 주세요.'}</p>` : `<p>${t('storageText')}</p><button type="button" class="btn-line danger" data-action="clear">${t('clear')}</button>`}</section></div>`;
}

const PAGES = { today, explore, detail, prepare, editor, help, profile };
const LOCKED_ACTIONS = ['pickGoal', 'step2', 'toggle', 'finish', 'skip', 'prepareThis', 'confirm', 'body', 'loc', 'setLang', 'changeGoal', 'prepareJob', 'saveJob', 'removeJob'];
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
  const main = S.page === 'onboard' ? onboard() : S.page === 'today' ? today() : S.page === 'editor' ? editor()
    : `<main class="content" id="main">${notices(S.page === 'profile')}${PAGES[S.page]()}</main>`;
  root.innerHTML = shell(main);
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
function go(page) { S.drop = MOTION && page !== S.page && (page === 'onboard' || page === 'today'); S.page = page; S.flash = null; S.error = null; S.copyMsg = null; render(); toTop(); }

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
  if (a === 'loc') { if (session.status().canEdit) S.draft.location = e.target.value; }
  else if (a === 'jobBoard') { S.jobBoard = e.target.value || 'all'; S.jobPage = 0; render(false); root.querySelector('[data-action="jobBoard"]')?.focus(); }
  else if (a === 'savedJobs') { S.onlySaved = !!e.target.checked; S.jobPage = 0; render(false); root.querySelector('[data-action="savedJobs"]')?.focus(); }
  else if (a === 'topic') { S.help = e.target.value; S.copyMsg = null; render(false); root.querySelector('#topic')?.focus(); }
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
void session.init().catch((err) => { const m = getAccountErrorMessage(err, state.lang); S.flash = esc(m); render(false); say(m); });
void jobsFeed.load();
