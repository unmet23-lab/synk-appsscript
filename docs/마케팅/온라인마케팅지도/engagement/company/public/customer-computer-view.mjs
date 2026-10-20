// Customer consultation screen words and pure display helpers (Signal layout, 2026-10-20).
// Every visible sentence of /consultation/ lives here so tests can read it without a browser.
// No storage, network or DOM. Interpretation and recommendation stay in the Core/computer modules.

export const COPY = Object.freeze({
  title: '내 일에 맞는 컴퓨터 상담 · SYNK',
  skip: '상담으로 바로 가기',
  noscript: '상담을 하려면 브라우저에서 자바스크립트를 켜 주세요.',
  failedToStart: '상담 화면을 불러오지 못했어요. 새로고침해 주세요.',
  // 머리
  eyebrow: 'SYNK · COMPUTER CONSULT',
  heading: ['내 일에 맞는 컴퓨터,', '하는 일부터 같이 찾아요'],
  lead: '하는 일을 고르면 꼭 필요한 것만 하나씩 물어볼게요. 답할 때마다 필요한 사양이 바로 계산돼요.',
  meta: ['약 3분', '필요한 질문만', '이 기기에서 계산', 'SYNK ID로 저장'],
  posterLabel: 'SYNK / CONSULT',
  posterChip: '로그인 없이 시작',
  posterWord: '상담',
  // 계정
  login: 'SYNK ID로 로그인',
  logout: '로그아웃',
  checkingLogin: '로그인 상태를 확인하고 있어요.',
  loginFailed: 'SYNK ID 로그인을 마치지 못했어요. 다시 로그인해 주세요.',
  signedIn: name => `${name} 님으로 로그인했어요.`,
  loginPreparing: 'SYNK ID 로그인을 준비하고 있어요. 상담은 지금 바로 할 수 있어요.',
  // 01 하는 일
  usesTitle: '컴퓨터로 하는 일',
  usesSub: '하는 일을 모두 골라 주세요.',
  startHere: '여기부터 골라요',
  // 02 글로 쓰기
  textTitle: '내 상황 글로 쓰기',
  optional: '선택',
  textSub: '쓰는 프로그램, 지금 컴퓨터, 예산처럼 떠오르는 대로 써 주세요. 이 기기에서 찾기는 글을 밖으로 보내지 않고, 찾은 조건은 직접 확인한 것만 반영해요.',
  textLabel: '내 상황',
  textPlaceholder: '예: 프리미어로 4K 영상을 편집해요. 지금 컴퓨터는 램 16GB예요.',
  findLocal: '이 기기에서 찾기',
  findAI: 'AI로 찾기',
  findAIRetry: 'AI 답 다시 받기',
  cancelAI: '그만두기',
  aiConsent: 'AI로 찾기를 누르면 쓴 글을 외부 AI 서비스에 보내 조건을 찾고, 받은 답은 암호화해 최대 24시간 보관해요.',
  aiNeedsLogin: 'AI로 찾기는 SYNK ID로 로그인하면 쓸 수 있어요.',
  aiUnavailable: '지금은 AI로 찾기를 쓸 수 없어요. 이 기기에서 찾거나 직접 골라 주세요.',
  aiWorking: 'AI가 글을 읽고 있어요. 고른 조건은 그대로 둬요.',
  foundIdle: '찾기를 누르면 근거가 된 문장과 함께 조건을 보여 드려요.',
  foundHead: count => `찾은 조건 ${count}개`,
  foundNote: '「맞아요」를 누른 것만 반영해요.',
  proposalPending: '확인해 주세요',
  proposalActive: '반영했어요',
  proposalManual: '직접 고른 답이 먼저예요',
  proposalExcluded: '뺐어요',
  confirm: '맞아요',
  correct: '고치기',
  exclude: '빼기',
  correctTo: '이 값으로 바꾸기',
  correctLabel: label => `${label} 고칠 값`,
  heldHead: count => `확인이 더 필요한 문장 ${count}개`,
  heldNote: '지금 내 조건인지 확실하지 않아서 바로 반영하지 않았어요. 해당하면 아래 질문에서 직접 골라 주세요.',
  // 03 질문
  askTitle: '필요한 질문',
  askEmpty: '하는 일을 고르면 여기서 질문이 시작돼요.',
  required: '꼭 필요한 조건',
  progressLabel: '확인한 조건',
  multiConfirm: '다 골랐어요',
  multiHint: '여러 개 골라도 돼요.',
  tip: '알아 두면 좋은 팁',
  doneReady: '필요한 조건을 모두 확인했어요',
  doneReadySub: '요약을 확인하고, 구매 상담에 쓸 글을 복사해 가세요.',
  doneProvisional: '모르는 항목은 임시로 두고 계산했어요',
  doneProvisionalSub: '알게 되면 「확인한 조건 다시 고르기」에서 바꿔 주세요.',
  editAnswers: '확인한 조건 다시 고르기',
  // 요약
  summaryLabel: 'MY CONSULT',
  summaryTitle: '내 상담 요약',
  waiting: '하는 일을 고르면 여기에 필요한 사양이 바로 나와요.',
  chipReady: '필요한 확인 끝',
  chipProvisional: '임시 조건 포함',
  ram: '램',
  storage: '저장공간',
  gpu: '그래픽',
  copy: '구매 상담 글 복사',
  copyProvisional: '임시 조건으로 글 복사',
  copyPeek: '복사할 글 보기',
  copyText: '복사할 구매 상담 글',
  copied: '복사했어요. AI 검색이나 판매처 상담에 붙여 넣어 쓰세요.',
  copyBlocked: '자동 복사가 막혔어요. 펼쳐 둔 글을 직접 복사해 주세요.',
  disclaimer: '특정 상품이 아니라 사양을 안내하는 상담이니, 살 때는 가격·재고와 프로그램 지원 조건을 판매처에서 확인해 주세요.',
  dockOpen: '요약 보기',
  // 04 저장
  saveTitle: '내 상담 저장',
  saveLoggedOut: 'SYNK ID로 로그인하면 이 상담을 내 계정에 저장해 두고, 다른 기기에서도 이어 볼 수 있어요.',
  saveHasDraft: '저장한 상담이 있어요',
  saveNoDraft: '아직 저장한 상담이 없어요',
  saveUnknown: '저장한 상담을 확인하지 못했어요',
  saveNote: '쓴 글과 고른 조건을 내 계정에 저장해 둬요. 저장은 상담 하나만 되고, 저장하지 않은 내용은 이 화면을 닫으면 사라져요.',
  resumeHas: when => `${when ? when + '에 ' : ''}저장한 상담이 있어요.`,
  save: '내 계정에 저장',
  load: '저장한 상담 불러오기',
  remove: '저장한 상담 지우기',
  resumeLoad: '불러오기',
  privacyTitle: 'AI 답 보관과 지우기',
  privacyNote: '저장한 상담과 AI 답은 따로 보관돼서, 상담을 지워도 AI 답은 남을 수 있어요.',
  privacyLoggedOut: '로그인하면 보관 상태를 볼 수 있어요.',
  privacyUnknown: '지금은 AI 답 보관 상태를 확인하지 못했어요. 새로고침한 뒤 다시 열어 주세요.',
  removeAI: '보관된 AI 답 지우기',
  reset: '이 화면 비우기',
  foot: 'SYNK · 컴퓨터 상담',
  // 알림
  accountChanged: '다른 계정으로 바뀌어서 화면의 상담을 비웠어요.',
  draftCheckFailed: '저장한 상담을 확인하지 못했어요. 쓰던 내용은 그대로예요.',
  sessionCheckFailed: '로그인 상태를 확인하지 못했어요. 쓰던 내용은 그대로 두었어요. 연결이 돌아오면 이 창을 다시 눌러 주세요.',
  reviewFailed: '찾은 조건을 반영하지 못했어요. 다시 찾거나 직접 골라 주세요.',
  sessionChanged: '로그인 상태가 바뀌었어요. 확인한 뒤 다시 해 주세요.',
  conflictHead: '다른 곳에서 먼저 저장된 상담이 있어요',
  conflictLine: '「저장한 상담 불러오기」로 최신 내용을 본 뒤 다시 고쳐 주세요.',
  conflict: '다른 기기나 창에서 상담이 먼저 저장됐어요. 쓰던 내용은 그대로예요.',
  requestFailed: '처리하지 못했어요. 쓰던 내용은 그대로 두었으니 다시 해 주세요.',
  foundLocal: '찾은 조건을 근거 문장과 함께 보여 드려요. 맞는 것만 골라 주세요.',
  foundLocalNone: '글에서 조건을 찾지 못했어요. 직접 골라 주세요.',
  foundLocalAfterStop: 'AI로 찾기를 멈추고 이 기기에서 찾았어요. 맞는 것만 골라 주세요.',
  foundLocalNoneAfterStop: 'AI로 찾기를 멈추고 이 기기에서 찾아봤지만 조건을 찾지 못했어요. 직접 골라 주세요.',
  findFailed: '조건을 찾지 못했어요. 직접 골라 주세요.',
  aiCancelled: 'AI로 찾기를 그만뒀어요. 이미 보낸 요청은 오늘 횟수에 들어갈 수 있고, 받은 답은 「AI 답 보관과 지우기」에서 지울 수 있어요.',
  aiPrepareFailed: 'AI로 찾을 글을 준비하지 못했어요. 다시 해 주세요.',
  aiFound: 'AI가 찾은 조건이에요. 맞는 것만 골라 주세요.',
  aiSessionRequired: '로그인이 풀렸어요. 다시 로그인해 주세요.',
  aiFailed: 'AI 답을 받지 못했어요. 「AI 답 다시 받기」를 누르거나 직접 골라 주세요.',
  aiLimitReached: '오늘 쓸 수 있는 AI로 찾기 횟수를 다 썼어요. 이 기기에서 찾거나 직접 골라 주세요.',
  aiStoppedByEdit: '내용을 바꿔서 AI로 찾기를 멈췄어요. 다 고친 뒤 다시 눌러 주세요.',
  confirmLogin: '로그인 화면으로 가면 저장하지 않은 내용이 사라져요. 계속할까요?',
  confirmLogout: '저장하지 않은 내용을 비우고 로그아웃할까요?',
  loggedOut: '로그아웃했어요. 화면의 상담도 비웠어요.',
  saved: '내 계정에 저장했어요.',
  confirmLoad: '지금 화면 대신 저장한 상담을 불러올까요?',
  loadNone: '저장한 상담이 없어요. 쓰던 내용은 그대로 두었어요.',
  loaded: '저장한 상담을 불러왔어요.',
  confirmRemove: '저장한 상담과 지금 화면의 내용을 지울까요? AI 답은 따로 지울 수 있어요.',
  removed: '저장한 상담과 화면의 내용을 지웠어요.',
  confirmRemoveAI: '보관된 내 AI 답을 지울까요? 저장한 상담은 그대로 둬요.',
  removedAI: '보관된 AI 답을 지웠어요.',
  confirmReset: '지금 화면의 내용을 비울까요? 저장한 상담은 그대로 둬요.',
  resetDone: '화면을 비웠어요.',
});

// 그룹 질문(한 화면에 칸이 여럿인 원래 질문)은 상담에서 칸마다 따로 묻는다. 칸마다 묻는 말.
export const FIELD_QUESTIONS = Object.freeze({
  'video.app': '영상은 어떤 프로그램으로 편집하나요?',
  'video.res': '편집하는 영상은 어떤 크기인가요?',
  'video.load': '영상 길이와 효과는 어느 정도인가요?',
  'current.kind': '지금 컴퓨터는 노트북인가요, 데스크톱인가요?',
  'current.ram': '지금 컴퓨터의 램은 얼마인가요?',
  'current.os': '지금 컴퓨터의 운영체제는 무엇인가요?',
  'current.feel': '하려는 일을 지금 컴퓨터로 해 보니 어땠나요?',
});
// 고른 조건·찾은 조건·아직 모르는 조건에 붙는 짧은 이름(질문 문장 기준). 원래 짧은 이름(「지금 컴퓨터 유무」)은 쓰지 않는다.
export const FIELD_LABELS = Object.freeze({
  uses: '하는 일', owned: '지금 쓰는 컴퓨터', 'video.app': '편집 프로그램', 'video.res': '영상 크기', 'video.load': '영상 길이와 효과',
  photo: '사진·디자인 작업', code: '개발 종류', localai: '설치할 AI', multitask: '켜 두는 개수',
  'current.kind': '지금 컴퓨터 종류', 'current.ram': '지금 컴퓨터 램', 'current.os': '지금 컴퓨터 운영체제', 'current.feel': '지금 컴퓨터로 해 보니',
  place: '들고 다니는 정도', os: '편한 운영체제', budget: '예산',
});
export const fieldLabel = (id, fallback = '') => FIELD_LABELS[id] || FIELD_LABELS[String(id).split('.')[0]] || fallback || String(id);
// 계산에 넣은 가정(상담 모듈의 assumption id) — 화면 문장.
export const ASSUMPTIONS = Object.freeze({ multitask: '탭 10~20개와 메신저 정도를 동시에 켜 둔다고 가정했어요.' });
export const assumptionText = item => ASSUMPTIONS[item?.id] || item?.text || '';
// 받침에 맞춘 「은/는」.
export function topic(word) {
  const code = String(word).trim().slice(-1).charCodeAt(0) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 !== 0 ? '은' : '는');
}
export function unresolvedText(ids) {
  const names = [...new Set((ids || []).map(id => fieldLabel(id)))];
  return names.length ? `${topic(names.join(', '))} 아직 묻지 않았어요.` : '';
}
// 찾은 조건 한 줄: 이름표와 값. 「하는 일」 같은 여러 개 고르기 칸은 값이 그 일 이름이다.
export function proposalDisplay(field, value) {
  if (!field) return { label: '', value: String(value) };
  if (field.kind === 'boolean') {
    const member = String(field.label).split(' · ').slice(1).join(' · ') || String(field.member);
    return { label: fieldLabel(field.about, field.label), value: value === false ? `${member} 안 함` : member };
  }
  const option = (field.options || []).find(item => item.id === value);
  return { label: fieldLabel(field.id, field.label), value: option ? option.label : String(value) };
}
// 같은 문장에서 찾은 조건은 한 묶음(인용은 한 번만).
export function groupByQuote(proposals) {
  const groups = [], index = new Map();
  for (const proposal of proposals || []) {
    const quote = proposal.evidence?.[0]?.quote ?? '';
    if (!index.has(quote)) { index.set(quote, groups.length); groups.push({ quote, items: [] }); }
    groups[index.get(quote)].items.push(proposal);
  }
  return groups;
}
// 고른 조건 한 줄의 값 이름(여러 개 고르기는 쉼표로).
export function answerValue(question, value) {
  const options = question.displayOptions || question.options || [];
  const one = id => options.find(option => option.id === id || option.value === id)?.label || String(id);
  return Array.isArray(value) ? value.map(one).join(', ') : one(value);
}

// 질문마다 그 내용을 설명하는 펠트 물건(synk.im 컴퓨터 추천과 같은 그림).
export const QUESTION_ART = Object.freeze({
  owned: [315, 284], uses: [350, 274], video: [390, 440], photo: [352, 336], code: [374, 239], localai: [337, 309],
  multitask: [376, 273], current: [440, 197], place: [440, 321], os: [440, 250], budget: [375, 440],
});
// 그래픽 칸: 외장·「윈도우면 외장」은 그래픽 메모리 GB, 내장·맥 통합 메모리는 짧은 낱말로(칸이 좁다).
function gpuCell(gpu) {
  if (!gpu) return { value: '—', sub: '' };
  if (gpu.kind === 'unified') return { value: '통합', sub: '맥 통합 메모리' };
  if (gpu.kind === 'integrated') return { value: '내장', sub: '내장 그래픽으로 충분' };
  if (Number.isFinite(gpu.vram) && gpu.vram > 0) return { value: `${gpu.vram}GB`, sub: gpu.kind === 'either' ? '윈도우 기준' : '외장 그래픽' };
  return { value: gpu.short || '—', sub: '' };
}

const stepOf = (content, about) => content.steps.find(step => step.id === String(about).split('.')[0]) || null;
export function questionText(content, question) {
  const step = stepOf(content, question.about);
  if (FIELD_QUESTIONS[question.about]) return FIELD_QUESTIONS[question.about];
  return step?.title || question.title;
}
export function questionLead(content, question) {
  return stepOf(content, question.about)?.sub || '';
}
export function questionTip(content, question) {
  const tip = stepOf(content, question.about)?.tip;
  return tip && tip.title && Array.isArray(tip.body) ? { title: tip.title, body: tip.body } : null;
}
export function questionArt(question) {
  const id = String(question.about).split('.')[0];
  const size = QUESTION_ART[id];
  return size ? { src: `/consultation/assets/computer-art-${id}.webp`, width: size[0], height: size[1] } : null;
}

// 「10월 20일 오후 9:31」, 올해가 아니면 연도를 붙인다.
export function dateText(value, now = Date.now()) {
  const stamp = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(stamp)) return '';
  const sameYear = new Date(stamp).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat('ko-KR', { ...(sameYear ? {} : { year: 'numeric' }), month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(stamp);
}

export function draftStatus({ authenticated, revision, status, updatedAt, dirty, checking = false }, now) {
  if (!authenticated) return { head: null, line: checking ? COPY.checkingLogin : COPY.saveLoggedOut, state: 'off' };
  if (revision === null) return { head: COPY.saveUnknown, line: '새로고침한 뒤 다시 해 주세요.', state: 'check' };
  if (status === 'active') {
    const when = dateText(updatedAt, now);
    return { head: COPY.saveHasDraft, line: `${when ? when + '에 ' : ''}저장했어요.${dirty ? ' 바꾼 내용은 아직 저장하지 않았어요.' : ''}`, state: dirty ? 'check' : 'ok' };
  }
  return { head: COPY.saveNoDraft, line: dirty ? '지금 쓴 내용은 저장 전이에요.' : COPY.saveNote, state: dirty ? 'check' : 'off' };
}

// 진행: 꼭 필요한 조건 가운데 확인한 수.
export function progressCount(completion) {
  const required = (completion?.fields || []).filter(field => field.required);
  return { known: required.filter(field => field.state === 'known').length, total: required.length };
}
export const textCount = length => `${length} / 4000`;

// 오늘 남은 AI로 찾기 횟수가 없다(서버가 알려 준 값으로만 판단).
export const aiExhausted = usage => !!usage && Number.isSafeInteger(usage.requestsRemaining) && usage.requestsRemaining <= 0;
export function usageText(usage, now) {
  const counts = usage && Number.isSafeInteger(usage.requestsUsed) && Number.isSafeInteger(usage.requestLimit) && Number.isSafeInteger(usage.requestsRemaining);
  if (!counts) return '';
  const when = dateText(usage.resetsAt, now);
  const again = when ? ` ${when}에 다시 채워져요.` : '';
  return usage.requestsRemaining > 0 ? `오늘 ${usage.requestsRemaining}번 더 쓸 수 있어요.${again}` : `오늘 쓸 수 있는 횟수를 다 썼어요.${again}`;
}

// 로그인이 풀린 경우만 「로그인하면…」, 로그인했는데 보관 상태를 못 받은 경우(AI 연결 안 됨·확인 실패)는 다시 열어 보라고.
export function privacyText(privacy) {
  if (!privacy?.canDelete) return privacy?.reason === 'session-required' ? COPY.privacyLoggedOut : COPY.privacyUnknown;
  const pending = privacy.pendingResponses > 0 ? ` · 처리 중 ${privacy.pendingResponses}개` : '';
  return `보관 중인 AI 답 ${privacy.storedResponses}개${pending} · 최대 ${privacy.retentionHours}시간 보관해요.`;
}

export const privacyCount = privacy => (privacy?.canDelete && privacy.storedResponses > 0 ? `${privacy.storedResponses}개 보관 중` : '');

// 찾은 조건 한 줄의 상태 이름.
export function proposalStatus({ manual, active, action }) {
  if (manual) return { text: COPY.proposalManual, state: 'info' };
  if (active) return { text: COPY.proposalActive, state: 'ok' };
  if (['reject', 'withdraw'].includes(action)) return { text: COPY.proposalExcluded, state: 'off' };
  return { text: COPY.proposalPending, state: 'check' };
}

// 결과 큰 제목: 마디(「 · 」로 나뉜 것)마다 한 줄. 끝의 괄호 설명(「데스크톱(윈도우 PC·맥 미니)」)은 작은 글로 뗀다.
export const headlineParts = title => String(title || '').split(' · ').map(part => part.trim()).filter(Boolean).map(part => {
  const match = /^(.+?)\s*\(([^()]+)\)$/u.exec(part);
  return match ? { main: match[1], aside: match[2] } : { main: part, aside: '' };
});

// 요약 판의 「알아 둘 것」: consultation.summary()와 같은 항목(지금 컴퓨터에 할 일 · 운영체제 충돌 · 예산)을
// 항목 단위로 돌려준다. 한 줄 설명(headline.sub)과 14자 넘게 겹치는 항목은 같은 말이라 뺀다.
const overlaps = (text, lead, size = 14) => {
  for (let i = 0; i + size <= lead.length; i++) if (text.includes(lead.slice(i, i + size))) return true;
  return false;
};
export function summaryItems(result) {
  if (!result) return [];
  const lead = String(result.headline?.sub || '');
  const items = [
    ...(result.current?.actions || []).filter(action => action.code !== 'monitor-memory-usage').map(action => action.t),
    ...(result.os?.conflicts || []).map(conflict => conflict.t),
    result.budget?.warn ? result.budget.alternatives?.[0]?.t : result.budget?.tips?.[0]?.t,
  ];
  return items.filter((text, index, all) => text && all.indexOf(text) === index && text !== lead && !overlaps(text, lead));
}

export function readout(result) {
  if (!result) return [{ label: COPY.ram, value: '—', sub: '' }, { label: COPY.storage, value: '—', sub: '' }, { label: COPY.gpu, value: '—', sub: '' }];
  const gpu = gpuCell(result.gpu);
  return [
    { label: COPY.ram, value: `${result.ram.value}GB`, sub: Number.isFinite(result.ram.roomy) && result.ram.roomy > result.ram.value ? `여유 ${result.ram.roomy}GB` : '' },
    { label: COPY.storage, value: result.storage.valueText, sub: 'SSD' },
    { label: COPY.gpu, value: gpu.value, sub: gpu.sub },
  ];
}

// 휴대폰 아래 막대의 한 줄(요약 큰 제목과 같은 순서).
export const dockLine = result => (result ? headlineParts(result.headline.title).map(part => part.main).join(' · ') : '');
