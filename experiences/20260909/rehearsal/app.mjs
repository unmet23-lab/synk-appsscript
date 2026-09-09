import { STORAGE_KEY, FIELD_LABELS, FIELD_LIMIT, STEP_FIELDS, STEP_LABELS, CLIENT,
  createState, validateStep, updateField, advance, goToStep, parseState, makeExport, textExport } from './state.mjs';

const $ = selector => document.querySelector(selector);
const scene = $('#scene');
let state = createState();
let storage;
let savingPaused = false;
let protectedRaw = null;
let pendingConfirm = null;
let lastSaved = null;
let lastStatus = '';
let unsaved = false;

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(label, action, className = '') {
  const el = node('button', className, label);
  el.type = 'button'; el.addEventListener('click', action); return el;
}
function announce(text) { $('#announcer').textContent = text; }
function setStatus(text, warning = false) {
  const el = $('#save-status');
  // Keep the live region quiet while typing; announce a state change, not every keystroke.
  if (lastStatus !== text) { el.textContent = text; lastStatus = text; }
  el.classList.toggle('save-warning', warning);
}
function showRecovery(message, actionLabel, action) {
  const box = $('#recovery'); box.hidden = false;
  box.replaceChildren(node('p', '', message));
  if (action) box.append(button(actionLabel, action));
}
try {
  storage = window.localStorage;
  const saved = storage.getItem(STORAGE_KEY);
  if (saved) {
    try { state = parseState(saved); lastSaved = saved; }
    catch {
      savingPaused = true; protectedRaw = saved;
      showRecovery('저장된 기록을 읽지 못했습니다. 원본은 그대로 두었습니다. 파일로 보관한 뒤 기록 관리에서 새 연습을 시작할 수 있어요.', '기존 원본 내려받기', () => download(protectedRaw, 'txt', 'synk-rehearsal-recovery'));
    }
  }
} catch {
  savingPaused = true;
  showRecovery('이 브라우저에서는 자동 저장을 사용할 수 없습니다. 연습은 계속할 수 있고, 닫기 전에 기록 파일을 내려받아 보관할 수 있어요.');
}

function persist() {
  if (savingPaused || !storage) { unsaved = true; setStatus('자동 저장 불가 · 파일로 보관해 주세요', true); return false; }
  try {
    const json = JSON.stringify(state);
    storage.setItem(STORAGE_KEY, json); lastSaved = json;
    unsaved = false; setStatus('이 브라우저에 저장됨'); return true;
  } catch {
    unsaved = true;
    setStatus('저장 공간이 부족합니다 · 파일로 보관해 주세요', true);
    return false;
  }
}

function heading(kicker, title, description) {
  scene.append(node('span', 'scene-eyebrow', kicker));
  const h1 = node('h1'); h1.id = 'scene-title';
  title.split('\n').forEach(line => h1.append(node('span', 'intro-line', line)));
  scene.append(h1, node('p', 'scene-intro', description));
}
function clientNote(label, message, compact = false) {
  const el = node('section', `client-note${compact ? ' compact' : ''}`);
  el.setAttribute('aria-label', label);
  el.append(node('p', 'client-label', label), node('p', 'client-message', message));
  return el;
}
function details(label, content, open = false) {
  const el = node('details', 'context-details'); el.open = open;
  el.append(node('summary', '', label), content); return el;
}
function replyBlock() {
  const el = node('div');
  el.append(node('p', 'small-note', '선택한 질문의 정답을 평가하는 답장이 아닙니다. 이 가상 고객에게 정해 둔 상황을 읽고 제안에 반영하세요.'));
  CLIENT.replies.forEach(([title, text]) => {
    const item = node('div', 'reply'); item.append(node('h3', '', title), node('p', '', text)); el.append(item);
  });
  return el;
}
function field(key, label, hint, long = false) {
  const wrap = node('div', 'form-field');
  const labelNode = node('label', '', label); labelNode.htmlFor = `field-${key}`;
  const help = node('p', 'hint', hint); help.id = `hint-${key}`;
  const input = node('textarea', long ? 'long' : '');
  input.id = `field-${key}`; input.name = key; input.value = state.fields[key]; input.maxLength = FIELD_LIMIT;
  input.rows = long ? 7 : 3;
  input.setAttribute('aria-describedby', `hint-${key} error-${key}`);
  const required = STEP_FIELDS.slice(1, 5).flat().includes(key);
  input.required = required;
  const error = node('p', 'field-error'); error.id = `error-${key}`; error.hidden = true;
  input.addEventListener('input', () => {
    state = updateField(state, key, input.value); persist();
    if (input.value.trim()) { error.hidden = true; input.removeAttribute('aria-invalid'); }
  });
  input.addEventListener('blur', () => {
    if (required && !input.value.trim()) showFieldError(key);
  });
  wrap.append(labelNode, help, input, error); return wrap;
}
function showFieldError(key) {
  const input = $(`#field-${key}`); const error = $(`#error-${key}`);
  if (!input || !error) return;
  input.setAttribute('aria-invalid', 'true');
  error.textContent = '이 항목을 한 문장 이상 적어 주세요. 완벽한 문장일 필요는 없어요.';
  error.hidden = false;
}
function validateCurrent() {
  const missing = validateStep(state);
  missing.forEach(showFieldError);
  if (missing.length) {
    $(`#field-${missing[0]}`)?.focus();
    announce(`${missing.length}개 항목이 비어 있습니다. 첫 빈 항목으로 이동했어요.`);
    return false;
  }
  return true;
}
function next() {
  if (!validateCurrent()) return;
  const result = advance(state); state = result.state;
  persist(); render(true);
}
function visit(step) {
  if (step > state.step && !validateCurrent()) return;
  if (step > state.step && state.step > 0 && state.step < 5) state = advance(state).state;
  const updated = goToStep(state, step);
  if (updated.step !== step) { announce('아직 비어 있는 앞 단계의 답을 먼저 적어 주세요.'); return; }
  state = updated; persist(); render(true);
}
function actions(nextLabel) {
  const row = node('div', 'scene-actions');
  if (state.step > 0) row.append(button('이전 장면', () => visit(state.step - 1), 'quiet-button'));
  if (nextLabel) row.append(button(nextLabel, next, 'primary'));
  scene.append(row);
}
function answerGroup(keys) {
  const group = node('div');
  keys.forEach(key => {
    const item = node('section', 'review-item');
    item.append(node('h3', '', FIELD_LABELS[key]), node('p', 'answer-text', state.fields[key] || '아직 작성하지 않았어요.'));
    group.append(item);
  });
  return group;
}
function renderNav() {
  const nav = $('#step-nav'); nav.replaceChildren();
  for (let step = 1; step <= 5; step++) {
    const el = button('', () => visit(step), 'step-button');
    el.setAttribute('aria-label', `${step}단계 ${STEP_LABELS[step]}`);
    el.append(node('span', '', String(step).padStart(2, '0')), node('span', 'step-name', STEP_LABELS[step]));
    el.disabled = step > state.furthestStep;
    if (step === state.step) el.setAttribute('aria-current', 'step');
    nav.append(el); if (step < 5) nav.append(node('span', 'step-separator'));
  }
  nav.hidden = state.step === 0;
}
function renderIntro() {
  heading('SYNK SHIFT / PRACTICE 01', '제안하기 전에,\n한 번 더 묻는 연습.', '가상 고객의 의뢰를 받고, 조건이 바뀌어도 설명할 수 있는 제안을 만들어 봅니다. 끝에는 내 질문과 두 번의 제안이 남아요.');
  const brief = clientNote('첫 번째 고객 · 공방 여백', CLIENT.request);
  const facts = node('dl', 'brief-facts');
  CLIENT.facts.forEach(([label, value]) => { const item = node('div'); item.append(node('dt', '', label), node('dd', '', value)); facts.append(item); });
  brief.append(facts); scene.append(brief);
  const row = node('div', 'scene-actions intro-actions');
  row.append(button(state.furthestStep > 0 ? '첫 질문 이어 쓰기' : '고객 의뢰 열기', next, 'primary'));
  row.append(node('span', 'hint', '이름이나 실제 고객 정보는 필요 없어요.\n적은 내용은 이 브라우저에만 저장됩니다.'));
  scene.append(row);
}
function renderQuestions() {
  heading('01 / 먼저 묻기', '바로 만들기 전에,\n무엇을 확인할까요?', '고객에게 보낼 질문을 직접 적어 보세요. 다음 장면에서 고객의 예시 답장을 읽고 첫 제안을 만듭니다.');
  scene.append(clientNote('공방 여백의 의뢰', CLIENT.request, true));
  scene.append(field('askGoal', '어떤 변화를 원하는지', '누구에게 어떤 행동을 기대하는지 물어보세요.'));
  scene.append(field('askScope', '무엇을 먼저 만들어야 하는지', '게시물 네 장과 예약 페이지가 모두 필요한 이유를 확인해 보세요.'));
  scene.append(field('askTiming', '어디까지 약속할 수 있는지', '7일 · 예산 20만 원 · 로고와 사진 8장. 일정, 확인할 사람, 준비된 자료를 함께 생각해 보세요.'));
  actions('질문 남기고 답장 읽기');
}
function renderProposal() {
  heading('02 / 첫 제안', '고객의 말을,\n내 제안으로 바꿔 보세요.', '무엇을 만들지, 왜 그것부터인지, 언제 무엇을 받으면 되는지 고객이 알 수 있게 적어 봅니다.');
  scene.append(details('고객의 예시 답장 읽기', replyBlock(), true));
  scene.append(details('내가 남긴 질문', answerGroup(STEP_FIELDS[1])));
  scene.append(field('initialProposal', '고객에게 보낼 첫 제안', '우선 목적 · 제공할 것과 제외할 것 · 일정과 확인 방식 · 예산 안에서의 선택을 담아 보세요. (모든 금액은 연습용입니다.)', true));
  actions('첫 제안 남기기');
}
function renderChange() {
  heading('03 / 조건이 바뀌면', '그대로 약속할까요?\n다시 제안할까요?', '처음 제안은 보존됩니다. 고객의 바뀐 조건을 읽고, 선택을 설명할 수 있는 두 번째 제안을 적어 보세요.');
  scene.append(clientNote('공방 여백에게 새로 온 메시지', CLIENT.change));
  scene.append(details('내 첫 제안 다시 보기', answerGroup(['initialProposal'])));
  scene.append(field('revisedProposal', '다시 보낼 제안', '할 수 있는 일, 조정할 일, 고객이 선택할 수 있는 대안을 분명하게 적어 보세요.', true));
  scene.append(field('changeReason', '무엇을 바꾸고, 왜 그렇게 정했나요?', '처음 제안의 어느 부분을 유지하거나 바꿨는지, 고객의 목적과 연결해 설명해 보세요.'));
  actions('수정한 제안 남기기');
}
function renderTransfer() {
  heading('04 / 다른 고객에게', '이번에는,\n책방에서 연락이 왔어요.', '앞에서 쓴 문장을 그대로 가져오기보다, 같은 판단 방법이 다른 의뢰에도 통하는지 써 봅니다.');
  scene.append(clientNote('두 번째 고객 · 책방 모서리', CLIENT.second));
  scene.append(details('앞에서 세운 내 기준', answerGroup(['changeReason'])));
  scene.append(field('transferQuestion', '이 고객에게 먼저 할 질문', '공방 때와 달리 아직 정해지지 않은 것이 무엇인지 찾아보세요.'));
  scene.append(field('transferProposal', '지금 단계에 맞는 첫 제안', '아직 모르는 부분은 가정으로 표시하고, 고객의 답에 따라 달라질 다음 행동을 적어 보세요.', true));
  scene.append(field('takeaway', '다음 의뢰에도 가져갈 기준 하나', '오늘 나눈 질문과 제안에서 다시 사용할 방법을 내 말로 남겨 보세요.'));
  actions('내 리허설 모아 보기');
}
function exportButtons() {
  const row = node('div', 'review-export');
  row.append(button('검토용 JSON 저장', () => exportRecord('json'), 'primary'), button('읽기 쉬운 텍스트 저장', () => exportRecord('txt')));
  return row;
}
function renderReview() {
  heading('05 / 함께 검토', '처음의 질문부터,\n달라진 제안까지.', '정답표 대신 내가 실제로 쓴 답을 펼쳐 봅니다. 파일로 저장해 강사와 나누거나, 이 화면에서 함께 검토할 수 있어요.');
  const lead = node('section', 'review-lead');
  lead.append(node('p', '', state.completed ? '질문 · 첫 제안 · 수정 이유 · 다른 고객에게의 적용을 모았습니다.' : '수정 중인 기록입니다. 바꾼 단계에서 다음 버튼을 눌러 제출 원본도 남겨 주세요.'));
  lead.append(exportButtons(), node('p', 'small-note', '자동 전송은 없습니다. 강사는 이 페이지의 ‘기록 관리 → 저장 파일 열기’에서 JSON을 열 수 있어요.'));
  scene.append(lead);
  [['내 질문', STEP_FIELDS[1]], ['두 번의 제안', [...STEP_FIELDS[2], ...STEP_FIELDS[3]]], ['다른 고객에게 가져간 방법', STEP_FIELDS[4]]].forEach(([label, keys]) => {
    const section = node('section', 'review-section'); section.append(node('h2', '', label), answerGroup(keys)); scene.append(section);
  });
  const mentor = node('section', 'review-section');
  mentor.append(node('h2', '', '강사와 함께 남길 메모'), node('p', 'review-note', '선택 항목입니다. 질문이 고객의 목적을 열었는지, 변경한 범위를 설명했는지, 다른 상황에 기준을 옮겼는지 실제 답에서 확인해 주세요. 자동 점수나 인증을 발급하지 않습니다.'));
  mentor.append(field('mentorEvidence', '실제 답에서 확인한 근거', '어느 질문이나 제안에서 무엇을 확인했는지 적어 주세요.'));
  mentor.append(field('mentorNext', '다음에 연습할 한 가지', '더 물어볼 질문이나 다시 써 볼 부분을 구체적으로 남겨 주세요.'));
  mentor.append(exportButtons()); scene.append(mentor);
  const history = node('div');
  history.append(node('p', 'small-note', '다음 버튼으로 남긴 단계별 원문입니다. 현재 입력을 다시 고쳐도 이전 제출은 이곳에 남습니다. 강사 메모는 현재 기록에 함께 저장됩니다.'));
  state.history.forEach((item, index) => {
    const section = node('section', 'history-item'); section.append(node('h3', '', `${index + 1}. ${STEP_LABELS[item.step]} · ${new Date(item.recordedAt).toLocaleString('ko-KR')}`));
    Object.entries(item.fields).forEach(([key, value]) => section.append(node('h4', '', FIELD_LABELS[key]), node('p', 'answer-text', value)));
    history.append(section);
  });
  scene.append(details(`단계별 제출 원본 ${state.history.length}건`, history));
  actions();
}
function render(focus = false) {
  renderNav(); scene.replaceChildren();
  [renderIntro, renderQuestions, renderProposal, renderChange, renderTransfer, renderReview][state.step]();
  document.title = `${STEP_LABELS[state.step]} · 첫 제안의 리허설 · SYNK SHIFT`;
  if (focus) { scene.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
}

function download(content, extension, prefix = 'synk-shift-rehearsal') {
  const blob = new Blob([content], { type: extension === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = node('a');
  link.href = url; link.download = `${prefix}-${new Date().toISOString().slice(0,10)}.${extension}`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  announce('기록 파일을 내려받았습니다. 전달은 직접 해 주세요.');
}
function exportRecord(format) { download(format === 'json' ? JSON.stringify(makeExport(state), null, 2) : textExport(state), format); }
function confirmAction(title, text, yesLabel, action) {
  $('#confirm-title').textContent = title; $('#confirm-copy').textContent = text; $('#confirm-yes').textContent = yesLabel;
  pendingConfirm = action; $('#confirm-dialog').showModal();
}
$('#confirm-cancel').addEventListener('click', () => { pendingConfirm = null; $('#confirm-dialog').close(); });
$('#confirm-dialog').addEventListener('cancel', () => { pendingConfirm = null; });
$('#confirm-yes').addEventListener('click', () => { const action = pendingConfirm; pendingConfirm = null; $('#confirm-dialog').close(); action?.(); });
$('#open-tools').addEventListener('click', () => {
  const target = $('#storage-tools'); target.hidden = !target.hidden; $('#open-tools').setAttribute('aria-expanded', String(!target.hidden));
});
document.querySelectorAll('[data-export]').forEach(el => el.addEventListener('click', () => exportRecord(el.dataset.export)));
$('#reset-open').addEventListener('click', () => confirmAction('새 연습을 시작할까요?', '현재 브라우저에 있는 질문, 제안, 강사 메모가 모두 바뀝니다. 보관하려면 먼저 파일로 저장해 주세요.', '기록 비우고 시작', () => {
  state = createState(); protectedRaw = null;
  // A blocked/private storage may still fail; persist reports that without claiming success.
  savingPaused = !storage; $('#recovery').hidden = true;
  persist(); $('#storage-tools').hidden = true; $('#open-tools').setAttribute('aria-expanded', 'false'); render(true);
}));
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 4 * 1024 * 1024) throw new Error('4MB 이하의 리허설 JSON 파일을 열어 주세요.');
    const imported = parseState(await file.text());
    confirmAction('이 파일의 기록을 열까요?', '현재 브라우저 기록을 선택한 파일의 기록으로 바꿉니다. 현재 답을 남기려면 먼저 파일로 저장해 주세요.', '선택한 기록 열기', () => {
      state = imported; savingPaused = !storage; protectedRaw = null; $('#recovery').hidden = true;
      persist(); $('#storage-tools').hidden = true; $('#open-tools').setAttribute('aria-expanded', 'false'); render(true); announce('선택한 기록을 열었습니다.');
    });
  } catch (error) {
    showRecovery(`${error.message} 현재 기록은 바꾸지 않았습니다.`);
  }
});
window.addEventListener('storage', event => {
  if ((event.key !== STORAGE_KEY && event.key !== null) || event.newValue === lastSaved) return;
  savingPaused = true; setStatus('다른 탭에서 변경됨 · 이 답은 파일로 보관해 주세요', true);
  showRecovery('다른 탭에서 기록이 바뀌어 자동 저장을 멈췄습니다. 이 탭의 답을 파일로 보관한 뒤 새로고침하면 다른 탭의 기록을 열 수 있어요.', '이 탭의 답 저장', () => exportRecord('json'));
});
window.addEventListener('beforeunload', event => {
  if ((savingPaused || unsaved) && Object.values(state.fields).some(value => value.trim())) { event.preventDefault(); event.returnValue = ''; }
});
render();
if (savingPaused) setStatus('자동 저장 불가 · 파일로 보관해 주세요', true);
else setStatus(lastSaved ? '저장된 연습을 이어서 열었어요' : '이 브라우저에 자동 저장');
