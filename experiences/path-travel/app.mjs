import { DEFAULT_PROFILE, PRESETS, normalizeProfile, buildRecommendations, formatMoney, VERSION } from './model.mjs';
import { loadSavedTrip, saveTrip, clearSavedTrip, exportPlan, STORAGE_KEY } from './storage.mjs';
import { DETAIL_FIELDS, EXECUTION_FIELDS, createPersonalization, setPreference, removePreference, startNewTrip, summarizePersonalization, validatePersonalization } from './profile.mjs';
import { prepareConversation, reviewConversation } from './conversation.mjs';

const $ = selector => document.querySelector(selector);
const form = $('#preferences-form');
const output = $('#result-output');
const status = $('#storage-status');
const consent = $('#save-consent');
let profile = { ...DEFAULT_PROFILE };
let personalization = createPersonalization();
let lockedHotelId = null;
let recommendations = null;
let activePlan = null;
let busy = false;
let toastTimer;
const changedBaseFields = new Set();
let previewLabel = '기본 조건';
const skippedQuestions = new Set();
let conversationDraft = null;
let conversationRevision = 0;
let conversationBusy = false;
const conversationEdits = new Map();
const conversationExamples = {
  quiet: '평소 숙소는 아주 조용해야 해요. 이번 여행 총예산은 30만 원이에요. 하루 걷기는 45분까지요.',
  food: '음식에 돈을 더 쓰고 싶어요. 매운 음식은 못 먹어요. 식당 대기는 20분 이내여야 해요.',
};

const BASE_FIELDS = Object.keys(DEFAULT_PROFILE).map(id => {
  const input = form.elements.namedItem(id);
  const label = input.closest('label').querySelector('span')?.textContent ?? id;
  const parse = value => typeof DEFAULT_PROFILE[id] === 'boolean' ? value === 'yes' : typeof DEFAULT_PROFILE[id] === 'number' ? Number(value) : value;
  return { id, label, group: '일정의 기본 조건', help: '직접 고른 조건만 기록합니다. 평소 취향과 이번 여행의 조건을 구분할 수 있어요.', kind: input.tagName === 'SELECT' ? 'enum' : 'number',
    options: input.tagName === 'SELECT' ? [...input.options].map(option => ({ value: parse(option.value), label: option.textContent })) : [],
    min: input.min ? Number(input.min) : undefined, max: input.max ? Number(input.max) : undefined, step: 1 };
});
const ALL_FIELDS = [...DETAIL_FIELDS, ...BASE_FIELDS.filter(base => !DETAIL_FIELDS.some(field => field.id === base.id))];
const modeLabel = mode => ({ prefer: '선호', require: '필수', ignore: '상관없음' })[mode] ?? mode;
const durationLabel = duration => duration === 'ongoing' ? '평소' : '이번 여행';
const summary = () => summarizePersonalization(personalization);
function valueLabel(fieldId, value) {
  const field = ALL_FIELDS.find(item => item.id === fieldId);
  const choice = field?.options?.find(option => option.value === value);
  if (choice) return choice.label;
  if (typeof value === 'boolean') return value ? '예' : '아니요';
  if (value === null || value === undefined) return '아직 확인되지 않음';
  if (Array.isArray(value)) return value.map(item => valueLabel(fieldId, item)).join(', ');
  if (typeof value === 'object') return '상세 근거 확인 필요';
  return String(value);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function append(parent, ...children) { children.filter(Boolean).forEach(child => parent.append(child)); return parent; }
function button(label, className, action) {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function notify(message) {
  const toast = $('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}
function errorMessage(message) {
  $('#form-error').textContent = message;
  $('#form-error').hidden = !message;
}
function populateForm(values) {
  Object.entries(values).forEach(([key, value]) => {
    const input = form.elements.namedItem(key);
    if (input) input.value = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
  });
  updatePresetState(values);
}
function readForm() {
  const input = Object.fromEntries(new FormData(form));
  return normalizeProfile({ ...input, budget: Number(input.budget), dayStart: Number(input.dayStart), rain: input.rain === 'yes', alcohol: input.alcohol === 'yes' });
}
function updatePresetState(values) {
  document.querySelectorAll('[data-preset]').forEach(node => {
    const preset = PRESETS.find(item => item.id === node.dataset.preset);
    const matches = preset && Object.keys(DEFAULT_PROFILE).every(key => preset.profile[key] === values[key]);
    node.setAttribute('aria-pressed', String(Boolean(matches)));
  });
}
function saveIfAllowed() {
  if (!consent.checked) return false;
  try {
    saveTrip({ profile, lockedHotelId, personalization });
    status.textContent = '직접 알려준 취향·여행 조건·숙소 잠금과 확인한 문장의 원문 근거를 이 브라우저에 저장했어요. 다른 기기와 동기화하지 않습니다.';
    return true;
  } catch {
    status.textContent = '브라우저가 저장을 허용하지 않아 보관하지 못했어요. 현재 화면에서는 계속 사용할 수 있어요.';
    return false;
  }
}
function list(items, className = 'reason-list') {
  const node = element('ul', className);
  for (const item of items) node.append(element('li', '', item));
  return node;
}
function subheading(title, side) {
  return append(element('div', 'result-subheading'), element('h3', '', title), side ? element('span', '', side) : null);
}
const kindLabels = { lunch: '점심', activity: '오후', dinner: '저녁', night: '밤', rest: '여유', transfer: '이동', hotel: '숙박' };

function recordChanges(values, fields = changedBaseFields, current = personalization) {
  let state = current;
  for (const field of fields) {
    state = setPreference(state, { field, value: values[field], mode: EXECUTION_FIELDS.includes(field) ? 'require' : 'prefer', importance: 3, duration: 'once' });
  }
  return state;
}
function renderPreferenceLibrary() {
  const current = summary();
  const groups = new Map();
  DETAIL_FIELDS.forEach(field => {
    const group = field.group || '세부 취향';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(field);
  });
  const cards = [];
  for (const [name, fields] of groups) {
    const count = fields.filter(field => current.entries.some(entry => entry.field === field.id)).length;
    const card = button('', 'felt-choice preference-group', () => openPreference(fields[0].id));
    append(card, element('strong', '', name), element('span', '', count ? `${count}개 알려줌 · ${fields.length}개 조건` : `${fields.length}개 조건 · 필요할 때만`));
    cards.push(card);
  }
  $('#preference-groups').replaceChildren(...cards);
  const direct = current.entries.length;
  $('#preference-count').textContent = direct ? `직접 알려준 조건 ${direct}개 · 평소 ${current.baseline.length}개 · 이번 여행 ${current.trip.length}개` : '아직 직접 알려준 조건은 없어요. 기본값과 성향 예시는 취향 기록으로 저장하지 않습니다.';
}
function preferenceRow(entry, { inactive = false } = {}) {
  const row = element('li', `profile-entry${inactive ? ' inactive-preference' : ''}`);
  const text = element('div', 'profile-entry-copy');
  append(text, element('strong', '', entry.label), element('span', '', entry.value === 'any' ? '아직 모름' : entry.mode === 'ignore' ? '상관없음' : entry.labelValue ?? valueLabel(entry.field, entry.value)),
    element('small', '', `${durationLabel(entry.duration)} · ${entry.value === 'any' ? '다시 알아보기' : modeLabel(entry.mode)}${entry.mode === 'prefer' && entry.value !== 'any' ? ` · 중요도 ${entry.importance}/5` : ''} · ${entry.origin === 'conversation' ? '문장 확인' : '직접 선택'}${entry.status === 'expired' ? ' · 기한이 지나 재확인 필요' : inactive ? ' · 이번 조건에 가려짐' : ''}`));
  if (entry.sourceQuotes?.length) {
    const source = element('details', 'profile-source');
    source.append(element('summary', '', '확인한 원문 보기'));
    [...new Set(entry.sourceQuotes.map(item => item.quote).filter(Boolean))].forEach(quote => source.append(element('blockquote', '', quote)));
    text.append(source);
  }
  const edit = button('수정', 'felt-choice compact-edit', () => openPreference(entry.field, entry.duration));
  edit.setAttribute('aria-label', `${entry.label} ${durationLabel(entry.duration)} 조건 수정`);
  return append(row, text, edit);
}
function renderProfileSummary() {
  const current = recommendations?.personalization ?? summary();
  const entries = current.entries ?? [];
  const root = element('section', 'profile-summary');
  append(root, subheading('내가 알려준 여행 기준', `${entries.length}개 직접 확인`));
  if (!entries.length) {
    root.append(element('p', 'profile-default-note', `${previewLabel}을 기준으로 먼저 비교하고 있어요. 아직 직접 알려준 취향은 없습니다. 마음에 드는 기준을 추가하면 선택 이유도 더 구체적으로 보여 드려요.`));
    return root;
  }
  root.append(element('p', 'profile-default-note', '직접 알려준 조건만 아래에 표시합니다. 말하지 않은 성향은 추측하지 않아요.'));
  const visible = element('ul', 'profile-entry-list');
  entries.slice(0, 4).forEach(entry => visible.append(preferenceRow(entry)));
  root.append(visible);
  if (entries.length > 4) {
    const all = element('details', 'profile-more');
    all.append(element('summary', '', `나머지 ${entries.length - 4}개 조건 보기`));
    const rows = element('ul', 'profile-entry-list');
    entries.slice(4).forEach(entry => rows.append(preferenceRow(entry)));
    append(root, append(all, rows));
  }
  const overridden = (current.baseline ?? []).filter(entry => (current.trip ?? []).some(trip => trip.field === entry.field));
  if (overridden.length) {
    const baseline = element('details', 'profile-more');
    append(baseline, element('summary', '', `이번 여행에서만 달라진 평소 취향 ${overridden.length}개`), element('p', 'profile-default-note', '이번 여행 조건이 우선합니다. 이번 조건을 지우거나 새 여행을 시작하면 평소 취향으로 돌아갑니다.'));
    const rows = element('ul', 'profile-entry-list');
    overridden.forEach(entry => rows.append(preferenceRow(entry, { inactive: true })));
    append(root, append(baseline, rows));
  }
  return root;
}
function renderFitDetails(plan) {
  const details = plan.fitDetails ?? [];
  if (!details.length) return null;
  const currentEntries = recommendations?.personalization?.entries ?? summary().entries;
  const root = element('section', 'fit-report');
  root.append(subheading('내 조건은 얼마나 반영됐나요?', '가상 자료에서 비교'));
  const groups = [
    ['met', '맞춘 조건', '선택한 조건과 후보의 자료가 맞습니다.'],
    ['tradeoff', '함께 비교하며 타협한 조건', '전체 예산과 다른 취향을 함께 비교한 결과입니다.'],
    ['unknown', '아직 확인이 필요한 조건', '후보 자료가 부족한 부분은 맞는다고 단정하지 않습니다.'],
  ];
  for (const [fit, label, help] of groups) {
    const items = details.filter(item => item.fit === fit);
    if (!items.length) continue;
    const section = element('details', `fit-group fit-${fit}`);
    if (fit !== 'met') section.open = true;
    append(section, element('summary', '', `${label} · ${items.length}개`), element('p', 'fit-help', help));
    const rows = element('ul', 'fit-list');
    items.forEach(item => {
      const row = element('li', 'fit-item');
      const content = element('div');
      append(content, element('strong', '', item.label), element('p', '', `원하는 것: ${valueLabel(item.field, item.wanted)} · 후보 자료: ${valueLabel(item.field, item.actual)}`),
        element('small', '', `${durationLabel(item.duration)} · ${modeLabel(item.mode)}${item.mode === 'prefer' ? ` · 중요도 ${item.importance}/5` : ''}${item.evidence?.length ? ` · 입력 근거 ${item.evidence.length}개` : ' · 연결된 입력 근거 없음'}`));
      if (item.evidence?.length || item.sourceQuotes?.length) {
        const evidence = element('details', 'fit-evidence');
        evidence.append(element('summary', '', '어떤 답변을 반영했나요?'));
        const names = (item.evidence ?? []).map(id => {
          const entry = currentEntries.find(record => record.eventId === id);
          return entry ? `${entry.label}: ${entry.labelValue} (${durationLabel(entry.duration)})` : `${item.label}: ${item.wanted} (${durationLabel(item.duration)})`;
        });
        if (names.length) evidence.append(element('p', '', `직접 알려준 내용: ${[...new Set(names)].join(' · ')}`));
        [...new Set((item.sourceQuotes ?? []).map(source => source.quote).filter(Boolean))].forEach(quote => evidence.append(element('blockquote', 'confirmed-source', quote)));
        content.append(evidence);
      }
      append(row, content, button('수정', 'felt-choice compact-edit', () => openPreference(item.field, item.duration)));
      rows.append(row);
    });
    append(root, append(section, rows));
  }
  return root;
}
function renderBlockers() {
  const blockers = recommendations?.diagnostics?.blockers ?? [];
  if (!blockers.length) return null;
  const section = element('section', 'blocker-list');
  section.append(element('h4', '', '이 조건부터 확인해 보세요'));
  blockers.slice(0, 5).forEach(item => {
    const row = element('div', 'blocker-row');
    append(row, append(element('div'), element('strong', '', item.label), element('p', '', item.reason)),
      ALL_FIELDS.some(field => field.id === item.field) ? button('조건 수정', 'felt-choice', () => openPreference(item.field)) : null);
    section.append(row);
  });
  return section;
}

function editorEntry(field, duration) {
  const current = summary();
  return (duration === 'ongoing' ? current.baseline : current.trip).find(entry => entry.field === field);
}
function updateEditorMode() {
  const modeInput = $('#preference-mode');
  const field = ALL_FIELDS.find(item => item.id === $('#preference-field').value);
  const valueInput = $('#preference-value');
  if (EXECUTION_FIELDS.includes(field.id)) {
    modeInput.value = 'require';
    modeInput.disabled = true;
    valueInput.disabled = false;
    if ($('#preference-value-custom')) $('#preference-value-custom').disabled = false;
    $('#preference-importance').value = '3';
    $('#preference-importance-field').hidden = true;
    return;
  }
  const isUnknown = field?.options?.[Number(valueInput.value)]?.value === 'any';
  let unknown = modeInput.querySelector('[value="unknown"]');
  if (isUnknown) {
    if (!unknown) { unknown = element('option', '', '아직 모름 · 판단을 미뤄요'); unknown.value = 'unknown'; modeInput.append(unknown); }
    modeInput.value = 'unknown';
    modeInput.disabled = true;
    valueInput.disabled = false;
    if ($('#preference-value-custom')) $('#preference-value-custom').disabled = false;
    $('#preference-importance-field').hidden = true;
    return;
  }
  modeInput.disabled = false;
  if (modeInput.value === 'unknown') modeInput.value = 'prefer';
  unknown?.remove();
  const mode = modeInput.value;
  $('#preference-importance-field').hidden = mode !== 'prefer';
  valueInput.disabled = mode === 'ignore';
  if ($('#preference-value-custom')) $('#preference-value-custom').disabled = mode === 'ignore';
}
function updateEditorExisting() {
  const id = $('#preference-field').value;
  const duration = $('#preference-duration').value;
  const entry = editorEntry(id, duration);
  const baseline = editorEntry(id, 'ongoing');
  const trip = editorEntry(id, 'once');
  $('#preference-remove').hidden = !entry;
  $('#preference-remove').textContent = duration === 'once' && baseline ? '이번 조건 지우고 평소로' : '이 조건 지우기';
  $('#preference-existing').textContent = duration === 'once' && baseline
    ? `평소에는 '${baseline.labelValue ?? valueLabel(id, baseline.value)}'로 알려주셨어요. 이번 조건을 지우면 평소 취향으로 돌아갑니다.`
    : duration === 'ongoing' && trip
      ? `이번 여행에는 '${trip.labelValue ?? valueLabel(id, trip.value)}' 조건이 적용 중이에요. 평소 기준을 바꾸면 이번 여행에도 새 기준이 적용됩니다.`
      : entry ? '직접 알려준 조건입니다. 언제든 수정하거나 지울 수 있어요.' : '저장하지 않은 조건은 아직 모르는 상태로 남겨 둡니다.';
}
function fillPreferenceEditor(id, selectedDuration) {
  const field = ALL_FIELDS.find(item => item.id === id);
  if (!field) return;
  const active = summary().entries.find(entry => entry.field === id);
  const duration = selectedDuration ?? active?.duration ?? 'once';
  const entry = editorEntry(id, duration);
  $('#preference-duration').value = duration;
  $('#preference-mode').value = entry?.mode ?? 'prefer';
  $('#preference-importance').value = String(entry?.importance ?? 3);
  $('#preference-field-help').textContent = EXECUTION_FIELDS.includes(id)
    ? '일정의 실행 조건으로 적용합니다. 바꾸면 일정 전체를 다시 계산합니다.'
    : field.help || '내게 중요한 기준만 알려 주세요.';
  const label = element('label', 'field');
  label.htmlFor = 'preference-value';
  label.append(element('span', '', field.label));
  const options = field.options ?? [];
  const currentValue = entry?.value ?? (Object.hasOwn(DEFAULT_PROFILE, id) ? profile[id] : undefined);
  let input;
  let custom;
  if (options.length) {
    input = element('select');
    options.forEach((option, index) => {
      const node = element('option', '', option.label);
      node.value = String(index);
      input.append(node);
    });
    const index = options.findIndex(option => option.value === currentValue);
    if (field.kind === 'number') {
      const customOption = element('option', '', '직접 입력'); customOption.value = 'custom'; input.append(customOption);
      custom = numericInput(field, currentValue ?? options[0].value, 'preference-value-custom');
      custom.hidden = index >= 0 || currentValue === undefined;
      custom.setAttribute('aria-label', `${field.label} 직접 입력`);
      input.addEventListener('change', () => { custom.hidden = input.value !== 'custom'; });
    }
    input.value = index < 0 && currentValue !== undefined && custom ? 'custom' : String(index < 0 ? 0 : index);
  } else {
    input = element('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    input.step = String(field.step ?? 1);
    input.value = String(entry?.value ?? profile[id] ?? field.min ?? 0);
  }
  input.id = 'preference-value';
  input.addEventListener('change', updateEditorMode);
  append(label, input, custom);
  $('#preference-value-field').replaceChildren(label);
  $('#preference-error').hidden = true;
  updateEditorMode();
  updateEditorExisting();
}
function openPreference(id, duration) {
  if (busy) return;
  if (!ALL_FIELDS.some(field => field.id === id)) { notify('이 조건은 기본 설정에서 바꿀 수 있어요.'); return; }
  $('#preference-field').value = id;
  fillPreferenceEditor(id, duration);
  $('#preference-dialog').showModal();
  $('#preference-field').focus({ preventScroll: true });
}

function numericInput(field, value, id) {
  const input = element('input');
  input.id = id;
  if (field.id === 'returnBy') {
    input.type = 'text';
    input.inputMode = 'text';
    input.value = `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
    input.placeholder = '21:00';
    input.maxLength = 5;
    input.setAttribute('aria-label', '숙소 귀가 시각. 자정을 넘으면 25:00처럼 입력');
  } else {
    input.type = 'number';
    input.inputMode = 'decimal';
    input.value = String(value);
    input.step = String(field.step ?? 'any');
    const min = field.min ?? field.range?.[0];
    const max = field.max ?? field.range?.[1];
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
  }
  return input;
}
function readNumericInput(field, input) {
  if (field.id === 'returnBy') {
    const match = input.value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
    if (!match) throw new TypeError('귀가 시각은 21:00처럼 입력해 주세요. 다음 날 1시는 25:00입니다.');
    const value = Number(match[1]) * 60 + Number(match[2]);
    if (value < field.range[0] || value > field.range[1]) throw new TypeError('귀가 시각은 낮 12:00부터 다음 날 06:00(30:00) 사이로 입력해 주세요.');
    return value;
  }
  const value = Number(input.value);
  if (!input.value.trim() || !Number.isFinite(value) || !input.checkValidity()) throw new TypeError(`${field.label} 값을 허용 범위에 맞게 입력해 주세요.`);
  return value;
}
function proposalValueControl(field, value, id) {
  const wrapper = element('label', 'field proposal-value-field');
  wrapper.htmlFor = id;
  wrapper.append(element('span', '', field.label));
  const options = field.options ?? [];
  let input, custom;
  if (options.length) {
    input = element('select');
    options.forEach((option, index) => { const node = element('option', '', option.label); node.value = String(index); input.append(node); });
    const match = options.findIndex(option => option.value === value);
    if (field.kind === 'number') {
      const option = element('option', '', '직접 입력'); option.value = 'custom'; input.append(option);
      custom = numericInput(field, value, `${id}-custom`);
      custom.setAttribute('aria-label', `${field.label} 직접 입력`);
      custom.hidden = match >= 0;
      input.addEventListener('change', () => { custom.hidden = input.value !== 'custom'; });
    } else if (match < 0) {
      const original = element('option', '', `읽은 값: ${String(value)}`); original.value = 'original'; input.append(original);
    }
    input.value = match >= 0 ? String(match) : custom ? 'custom' : 'original';
  } else input = numericInput(field, value, id);
  input.id = id;
  append(wrapper, input, custom);
  if (field.id === 'returnBy') wrapper.append(element('small', '', '직접 입력은 21:00 형식입니다. 다음 날 1시는 25:00으로 적어 주세요.'));
  const getValue = () => {
    if (!options.length) return readNumericInput(field, input);
    if (input.value === 'custom') return readNumericInput(field, custom);
    if (input.value === 'original') return value;
    return options[Number(input.value)].value;
  };
  return { wrapper, input, getValue, disable: disabled => { input.disabled = disabled; if (custom) custom.disabled = disabled; } };
}
function proposalSelect(label, options, value, id) {
  const wrapper = element('label', 'field'); wrapper.htmlFor = id;
  const input = element('select'); input.id = id;
  options.forEach(([optionValue, text]) => { const option = element('option', '', text); option.value = String(optionValue); input.append(option); });
  input.value = String(value);
  append(wrapper, element('span', '', label), input);
  return { wrapper, input };
}
function clearConversation({ clearText = false, message = '' } = {}) {
  conversationDraft = null;
  conversationEdits.clear();
  conversationRevision += 1;
  $('#conversation-reopen').hidden = true;
  $('#conversation-proposals').replaceChildren();
  $('#conversation-unhandled').replaceChildren();
  $('#conversation-unhandled').hidden = true;
  $('#conversation-error').hidden = true;
  if ($('#conversation-dialog').open) $('#conversation-dialog').close();
  if (clearText) $('#conversation-text').value = '';
  $('#conversation-count').textContent = `${new Intl.NumberFormat('ko-KR').format($('#conversation-text').value.length)} / 4,000`;
  if (message) $('#conversation-status').textContent = message;
}
function renderConversation() {
  if (!conversationDraft) return;
  const fragment = document.createDocumentFragment();
  const proposals = conversationDraft.proposals ?? [];
  const reviewed = proposals.filter(item => item.review).length;
  const pending = proposals.filter(item => item.status === 'pending' && !item.review).length;
  $('#conversation-review-status').textContent = proposals.length ? `조건 제안 ${proposals.length}개 · 확인 대기 ${pending}개 · 처리 ${reviewed}개` : '분명하게 읽을 수 있는 조건을 찾지 못했어요. 문장을 고치거나 직접 고를 수 있어요.';
  $('#conversation-status').textContent = proposals.length ? `조건 제안 ${proposals.length}개를 읽었어요. 직접 확인한 것만 추천에 반영합니다.` : '분명하게 읽을 수 있는 조건이 없어요. 읽지 못한 내용을 확인해 주세요.';
  $('#conversation-reopen').hidden = false;
  proposals.forEach((proposal, index) => {
    const card = element('article', `conversation-proposal proposal-${proposal.status}`);
    card.dataset.proposalId = proposal.id;
    const field = ALL_FIELDS.find(item => item.id === proposal.field);
    const reviewAction = proposal.review?.action;
    const closed = Boolean(reviewAction);
    const blocked = proposal.status !== 'pending' || !field;
    const stateLabel = reviewAction === 'reject' ? '제외했어요' : reviewAction === 'correct' ? '고쳐서 반영했어요' : closed ? '확인해서 반영했어요' : proposal.status === 'conflict' ? '서로 다른 조건 확인 필요' : blocked ? '자동으로 확정할 수 없어요' : '아직 반영하지 않았어요';
    append(card, append(element('div', 'proposal-heading'), element('h3', '', proposal.label), element('span', '', stateLabel)));
    const quotes = [...new Set((proposal.evidence ?? []).map(item => item.quote).filter(Boolean))];
    const source = element('div', 'proposal-source');
    source.append(element('span', 'proposal-source-label', '입력한 원문'));
    quotes.forEach(quote => source.append(element('blockquote', '', quote)));
    if (!quotes.length) source.append(element('p', '', '연결된 원문을 확인할 수 없어요. 직접 설정에서 조건을 골라 주세요.'));
    append(card, source, element('p', 'proposal-reading', `${reviewAction === 'correct' ? '직접 고친 조건' : '읽은 조건'}: ${proposal.labelValue ?? valueLabel(proposal.field, proposal.value)}`));
    if (closed) {
      if (reviewAction !== 'reject') card.append(element('p', 'proposal-completed', '확인한 원문과 조건을 여행 기준에 남겼어요. 추천 결과에서 다시 수정할 수 있어요.'));
      fragment.append(card);
      return;
    }
    const error = element('p', 'form-error'); error.setAttribute('role', 'alert'); error.hidden = true;
    const actions = element('div', 'proposal-actions');
    let controls;
    if (!blocked && quotes.length) {
      const value = proposalValueControl(field, proposal.value, `conversation-value-${index}`);
      const mode = proposalSelect('조건의 강도', [['prefer', '선호 · 더 잘 맞는 쪽으로'], ['require', '필수 · 맞지 않으면 제외'], ['ignore', '상관없음 · 비교에서 빼기']], proposal.mode, `conversation-mode-${index}`);
      const importance = proposalSelect('다른 취향과 비교한 중요도', [[1, '1 · 조금 중요'], [2, '2 · 어느 정도 중요'], [3, '3 · 중요'], [4, '4 · 많이 중요'], [5, '5 · 가장 중요']], proposal.importance, `conversation-importance-${index}`);
      const duration = proposalSelect('적용할 기간', [['once', '이번 여행에서만'], ['ongoing', '평소에도 이런 편이에요']], proposal.duration, `conversation-duration-${index}`);
      const savedEdits = conversationEdits.get(proposal.id);
      [value.wrapper, mode.wrapper, importance.wrapper, duration.wrapper].forEach(wrapper => wrapper.querySelectorAll('input,select').forEach(input => {
        if (savedEdits?.[input.id] !== undefined) input.value = savedEdits[input.id];
      }));
      const custom = value.wrapper.querySelector('input[id$="-custom"]');
      if (custom) custom.hidden = value.input.value !== 'custom';
      const sync = () => {
        const execution = EXECUTION_FIELDS.includes(proposal.field);
        if (execution) { mode.input.value = 'require'; mode.input.disabled = true; importance.input.value = '3'; }
        importance.wrapper.hidden = execution || mode.input.value !== 'prefer';
        value.disable(mode.input.value === 'ignore');
      };
      mode.input.addEventListener('change', sync); sync();
      const remember = () => {
        const values = {};
        [value.wrapper, mode.wrapper, importance.wrapper, duration.wrapper].forEach(wrapper => wrapper.querySelectorAll('input,select').forEach(input => { values[input.id] = input.value; }));
        conversationEdits.set(proposal.id, values);
      };
      [value.wrapper, mode.wrapper, importance.wrapper, duration.wrapper].forEach(wrapper => {
        wrapper.addEventListener('input', remember); wrapper.addEventListener('change', remember);
      });
      append(card, value.wrapper, append(element('div', 'proposal-controls'), mode.wrapper, importance.wrapper, duration.wrapper));
      if (EXECUTION_FIELDS.includes(proposal.field)) card.append(element('p', 'proposal-execution-note', '일정의 실행 조건입니다. 확인하면 일정 전체를 다시 계산합니다.'));
      controls = { value, mode, importance, duration };
      actions.append(button('확인하고 반영', 'felt-button', () => reviewProposal(proposal, controls, error)));
    } else {
      card.append(element('p', 'proposal-blocked-note', proposal.status === 'conflict' ? '서로 다른 조건이 함께 읽혔어요. 원문을 한 가지 기준으로 고치거나 직접 입력해 주세요.' : '이 문장을 내 조건으로 확정할 수 없어요. 원문을 분명하게 고치거나 직접 입력해 주세요.'));
      const reasonLabels = {'other-subject':'다른 사람의 조건으로 읽혔어요.','past':'과거의 조건으로 읽혔어요.','hypothetical':'가정한 상황의 조건으로 읽혔어요.','uncertain':'아직 확실하지 않은 조건으로 읽혔어요.','conflicting-proposals':'같은 항목에서 서로 다른 값이 읽혔어요.','source-expired':'입력한 문장의 확인 기한이 지났어요.','source-excluded':'이 문장은 사용하지 않기로 했어요.','future-source':'입력 시각을 다시 확인해야 해요.'};
      const reasons = [...new Set((proposal.reasons ?? []).map(reason => reasonLabels[reason]).filter(Boolean))];
      if (reasons.length) card.append(list(reasons, 'proposal-reasons'));
      if (field) actions.append(button('직접 입력으로 정하기', 'felt-choice', () => { $('#conversation-dialog').close(); openPreference(proposal.field); }));
    }
    actions.append(button('이 제안 제외', 'felt-choice', () => reviewProposal(proposal, null, error, 'reject')));
    append(card, error, actions);
    fragment.append(card);
  });
  $('#conversation-proposals').replaceChildren(fragment);
  const unhandled = conversationDraft.unhandled ?? [];
  const unknown = $('#conversation-unhandled'); unknown.replaceChildren(); unknown.hidden = !unhandled.length;
  if (unhandled.length) {
    unknown.append(element('h3', '', '아직 조건으로 읽지 않은 내용'));
    unhandled.forEach(item => append(unknown, append(element('div', 'unhandled-item'), element('blockquote', '', item.text), element('p', '', item.reason))));
  }
}
async function reviewProposal(proposal, controls, error, overrideAction) {
  if (busy || conversationBusy || !conversationDraft) return;
  const revision = conversationRevision;
  const originalDraft = conversationDraft;
  let disabledControls = [];
  try {
    error.hidden = true;
    const value = controls?.value.getValue();
    const action = overrideAction ?? (Object.is(value, proposal.value) ? 'confirm' : 'correct');
    const review = { proposalId: proposal.id, action };
    if (controls) Object.assign(review, { value, mode: controls.mode.input.value, importance: Number(controls.importance.input.value), duration: controls.duration.input.value });
    const next = reviewConversation(personalization, originalDraft, review);
    if (action === 'reject') {
      if (conversationRevision === revision) { conversationEdits.delete(proposal.id); conversationDraft = next.draft; renderConversation(); $('#conversation-review-status').textContent = '이 제안을 제외했어요. 취향 기록과 추천에는 반영하지 않았습니다.'; }
      return;
    }
    conversationBusy = true;
    disabledControls = [...$('#conversation-dialog').querySelectorAll('input,select,.proposal-actions button')].map(node => [node,node.disabled]);
    disabledControls.forEach(([node]) => { node.disabled = true; });
    const success = await calculate({ nextProfile: profile, nextPersonalization: next.personalization });
    if (success && conversationRevision === revision) {
      conversationEdits.delete(proposal.id);
      conversationDraft = next.draft;
      renderConversation();
      $('#conversation-review-status').textContent = action === 'correct' ? '고친 조건과 확인한 원문을 반영해 여행안을 다시 계산했어요.' : '확인한 조건과 원문을 반영해 여행안을 다시 계산했어요.';
    } else if (!success && conversationRevision === revision) {
      error.textContent = $('#form-error').textContent || '일정을 다시 계산하지 못해 제안을 반영하지 않았어요.';
      error.hidden = false;
    }
  } catch (issue) {
    error.textContent = issue instanceof Error ? issue.message : '제안을 확인하지 못했어요. 원문을 다시 읽어 주세요.';
    error.hidden = false;
  } finally {
    conversationBusy = false;
    disabledControls.forEach(([node,disabled]) => { if (node.isConnected) node.disabled = disabled; });
  }
}

function hero(plan) {
  const root = element('section', 'plan-hero');
  append(root, append(element('div', 'plan-topline'), element('span', 'plan-kicker', 'A DAY, PERSONALIZED'), element('span', 'tag', '가상 여행안')),
    element('h3', '', plan.title), element('p', '', plan.summary));
  const price = element('div', 'total-price', new Intl.NumberFormat('ko-KR').format(plan.totalCost));
  price.append(element('span', '', '원'));
  const budget = element('div', 'plan-budget');
  const remaining = plan.budgetLimit - plan.totalCost;
  append(budget, element('strong', remaining < 0 ? 'over-budget' : '', remaining >= 0 ? `${formatMoney(remaining)} 여유` : `${formatMoney(-remaining)} 초과`),
    element('span', '', `총예산 ${formatMoney(plan.budgetLimit)}`));
  append(root, append(element('div', 'plan-totals'), append(element('div'), price, element('div', 'price-label', '성인 1명 · 하루 + 1박 가상 합계')), budget));
  return root;
}
function renderTimeline(plan) {
  const timeline = element('ol', 'itinerary');
  for (const stop of plan.stops.filter(item => item.kind !== 'hotel')) {
    const row = element('li', `stop${stop.kind === 'transfer' ? ' transit-stop' : stop.kind === 'rest' ? ' rest-stop' : ''}`);
    const time = element('div', 'stop-time', stop.time);
    time.append(element('span', '', kindLabels[stop.kind] ?? stop.kind));
    const body = element('div', 'stop-body');
    append(body, append(element('div', 'stop-title-row'), element('h4', '', stop.name), element('span', 'stop-cost', stop.cost ? formatMoney(stop.cost) : '추가 비용 없음')),
      element('p', 'stop-meta', `${stop.area} · ${stop.duration}분`));
    if (!['transfer', 'rest'].includes(stop.kind)) body.append(element('p', 'stop-reason', stop.reason));
    else if (stop.kind === 'rest') body.append(element('p', 'stop-reason', '일정을 비워 둔 시간이에요. 추가 소비는 합계에서 제외했어요.'));
    append(row, time, body);
    timeline.append(row);
  }
  return timeline;
}
function renderHotel(plan) {
  const hotel = plan.hotel;
  const block = element('section', 'hotel-block');
  const hotelStop = plan.stops.find(stop => stop.kind === 'hotel');
  const index = element('div', 'hotel-index', hotelStop?.time ?? '1 NIGHT');
  index.append(element('span', 'hotel-label', '체크인'));
  const content = element('div', 'hotel-main');
  append(content, append(element('div', 'hotel-row'), element('h4', '', hotel.name), element('span', 'hotel-price', formatMoney(hotel.cost))),
    element('p', '', `${hotel.area} · 객실 1개 · 1박`), element('p', '', hotel.reason));
  const lock = button(lockedHotelId === hotel.id ? '숙소 잠금 해제' : '이 숙소로 고정하기', 'felt-choice hotel-lock', async () => {
    if (busy) return;
    const nextLock = lockedHotelId === hotel.id ? null : hotel.id;
    await calculate({ nextProfile: profile, nextLock, message: nextLock ? '이 숙소를 고정하고 다른 일정을 비교할게요.' : '숙소 잠금을 풀었어요.' });
  });
  lock.setAttribute('aria-pressed', String(lockedHotelId === hotel.id));
  content.append(lock);
  return append(block, index, content);
}
function renderRoute(plan) {
  const strip = element('div', 'route-strip');
  strip.append(element('p', 'route-strip-label', '동네 연결 도식 · 실제 지도·길안내가 아닙니다'));
  const nodes = element('div', 'route-nodes');
  const areas = ['서울역'];
  plan.stops.filter(stop => !['rest', 'transfer'].includes(stop.kind)).forEach(stop => { if (areas.at(-1) !== stop.area) areas.push(stop.area); });
  for (const area of areas) nodes.append(element('span', 'route-node', area));
  strip.append(nodes);
  return strip;
}
function renderCosts(plan) {
  const details = element('details', 'cost-details');
  details.append(element('summary', '', '금액별 상세 내역 보기'));
  const table = element('table', 'cost-table');
  table.append(element('caption', 'visually-hidden', '가상 여행안의 항목별 비용'));
  const body = element('tbody');
  plan.stops.filter(stop => stop.kind !== 'rest').forEach(stop => {
    const label = element('th', '', stop.name);
    label.scope = 'row';
    body.append(append(element('tr'), label, element('td', '', formatMoney(stop.cost))));
  });
  const total = element('th', '', '가상 합계'); total.scope = 'row';
  append(table, body, append(element('tfoot'), append(element('tr'), total, element('td', '', formatMoney(plan.totalCost)))));
  return append(details, table, element('p', 'cost-note', '세금·필수 수수료 포함을 가정한 시험용 가격입니다. 항공·서울 도착/출발 교통·다음 날 식사·자유시간 추가 소비는 제외합니다.'));
}
function renderComparison(plan) {
  const otherPlans = [recommendations.primary, ...recommendations.alternatives].filter(item => item && item.id !== plan.id).slice(0, 2);
  const fragment = document.createDocumentFragment();
  if (!otherPlans.length) {
    fragment.append(element('p', 'cost-note', '지금 조건을 만족하는 다른 여행안은 없어요. 예산이나 취향을 바꿔 비교할 수 있어요.'));
    return fragment;
  }
  fragment.append(subheading('무엇을 바꾸면 달라질까요?', '같은 조건 안에서 비교'));
  const grid = element('div', 'comparison-grid');
  otherPlans.forEach((alternative, index) => {
    const card = element('article', 'alternative');
    const difference = alternative.totalCost - plan.totalCost;
    append(card, element('span', 'alternative-label', `OPTION 0${index + 2}`), element('h4', '', alternative.title), element('p', '', alternative.summary));
    const price = element('div', 'alternative-price', formatMoney(alternative.totalCost));
    price.append(element('span', 'alternative-delta', difference === 0 ? '현재 안과 같은 금액' : `현재 안보다 ${formatMoney(Math.abs(difference))} ${difference > 0 ? '추가' : '절약'}`));
    append(card, price, element('p', '', alternative.hotel.id === plan.hotel.id ? '같은 숙소 · 식사와 활동을 달리한 안' : `숙소: ${alternative.hotel.name}`),
      button('이 안 자세히 보기', 'felt-choice', () => { activePlan = alternative; render(); $('#result-heading').scrollIntoView({ block: 'start' }); notify('선택한 여행안의 상세 일정을 보여 드려요.'); }));
    grid.append(card);
  });
  fragment.append(grid);
  return fragment;
}
function renderQuestion(question) {
  if (!question || skippedQuestions.has(question.id)) return null;
  const root = element('section', 'next-question');
  append(root, element('p', 'eyebrow', 'ONE MORE THING'), element('h3', '', question.prompt), element('p', '', question.why));
  const scope = element('label', 'question-duration');
  const duration = element('select');
  duration.setAttribute('aria-label', '추가 답변의 적용 기간');
  for (const [value, label] of [['once', '이번 여행에서만'], ['ongoing', '평소에도 그래요']]) {
    const option = element('option', '', label); option.value = value; duration.append(option);
  }
  append(scope, element('span', '', '이 답변은'), duration);
  root.append(scope);
  const options = element('div', 'question-options');
  question.options.forEach(option => {
    const answer = button(option.label, 'felt-choice', () => {
    if (busy) return;
    const field = option.field ?? question.about;
    try {
      const nextPersonalization = setPreference(personalization, { field, value: option.value, mode: 'prefer', importance: 3, duration: duration.value });
      const nextProfile = Object.hasOwn(DEFAULT_PROFILE, field) ? { ...profile, [field]: option.value } : profile;
      calculate({ nextProfile, nextPersonalization, message: '직접 알려준 답변을 반영해 다시 비교했어요.' });
    } catch (error) { notify(error.message); }
    });
    const choice = append(element('div', 'question-option'), answer);
    if (option.preview) choice.append(element('p', 'question-preview', `가상 미리보기 · ${option.preview}`));
    options.append(choice);
  });
  append(root, options, button('지금은 건너뛰기', 'text-button', () => { skippedQuestions.add(question.id); root.remove(); notify('답하지 않은 조건은 아직 모르는 상태로 남겨 둘게요.'); }));
  return root;
}
function render() {
  const fragment = document.createDocumentFragment();
  const plan = activePlan;
  if (!plan) {
    const empty = element('section', 'empty-state');
    append(empty, element('h3', '', '이 조건에 꼭 맞는 안은 아직 없어요.'), element('p', '', '무리한 추천을 넣는 대신, 바꾸면 다시 비교할 수 있는 조건을 알려 드려요.'), list(recommendations?.diagnostics.issues ?? ['조건을 확인하고 다시 시도해 주세요.']), renderBlockers());
    if (lockedHotelId) empty.append(button('숙소 잠금 풀고 다시 비교', 'felt-choice', () => calculate({ nextProfile: profile, nextLock: null, message: '숙소 잠금을 풀고 다시 비교했어요.' })));
    append(fragment, empty, renderProfileSummary(), renderQuestion(recommendations?.question));
    $('#result-context').textContent = '현재 조건을 만족하는 여행안이 없어요. 예산·이동수단·활동량을 조정해 보세요.';
  } else {
    $('#result-context').textContent = `성인 1명 · 서울역 출발 · ${profile.dayStart}시 시작 · 가상 걷기 ${plan.walkingMinutes}분${lockedHotelId ? ' · 숙소 고정 중' : ''}`;
    append(fragment, hero(plan), renderProfileSummary(), subheading('이렇게 고른 이유'), list(plan.reasons), renderFitDetails(plan));
    if (plan.changes.length) append(fragment, append(element('section', 'change-box'), element('h4', '', '전에 비해 달라진 점'), list(plan.changes, '')));
    const actions = element('div', 'plan-tools');
    const lessWalk = button('덜 걷기 · 택시로', 'felt-choice', () => {
      const nextProfile = { ...profile, pace: 'easy', transport: 'taxi' };
      calculate({ nextProfile, nextPersonalization: recordChanges(nextProfile, ['pace', 'transport']), message: '이번 여행에서 택시 이동과 여유 있는 일정을 선호한다고 반영했어요.' });
    });
    lessWalk.setAttribute('aria-pressed', String(profile.pace === 'easy' && profile.transport === 'taxi'));
    const rain = button(profile.rain ? '비 조건 해제하기' : '비 오는 날로 바꾸기', 'felt-choice', () => {
      const nextProfile = { ...profile, rain: !profile.rain };
      calculate({ nextProfile, nextPersonalization: recordChanges(nextProfile, ['rain']), message: profile.rain ? '이번 여행의 비 조건을 해제했어요.' : '이번 여행의 비 조건을 반영해 실내 활동을 골랐어요.' });
    });
    rain.setAttribute('aria-pressed', String(profile.rain));
    append(actions, lessWalk, rain);
    append(fragment, actions, subheading('하루의 흐름', '모든 시간·장소는 가상'), renderTimeline(plan), renderHotel(plan), renderRoute(plan), renderCosts(plan));
    const tradeoffs = append(element('div', 'tradeoff-box'), element('strong', '', '함께 알아둘 점'), list(plan.tradeoffs, ''));
    append(fragment, tradeoffs, renderComparison(plan), renderQuestion(recommendations.question));
  }
  output.replaceChildren(fragment);
  output.setAttribute('aria-busy', 'false');
  $('#export-json').disabled = !plan;
  $('#export-text').disabled = !plan;
}
async function calculate({ nextProfile, nextLock = lockedHotelId, nextPersonalization = personalization, nextPreviewLabel = previewLabel, message, initial = false, preserveDraft = true } = {}) {
  if (busy) return false;
  let validated;
  try { validated = normalizeProfile(nextProfile ?? readForm()); validatePersonalization(nextPersonalization); }
  catch (error) { errorMessage(error.message); return false; }
  errorMessage('');
  const draft = preserveDraft ? [...changedBaseFields].map(field => [field, form.elements.namedItem(field)?.value]) : [];
  busy = true;
  output.setAttribute('aria-busy', 'true');
  const submit = $('.generate-button');
  submit.disabled = true;
  submit.firstElementChild.textContent = '여행 조건 비교 중…';
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    const result = buildRecommendations(validated, { personalization: nextPersonalization, lockedHotelId: nextLock, previousPlan: initial ? null : activePlan, deniedQuestions: [...skippedQuestions] });
    profile = result.profile;
    personalization = nextPersonalization;
    previewLabel = nextPreviewLabel;
    lockedHotelId = nextLock;
    recommendations = result;
    activePlan = result.primary;
    populateForm(profile);
    changedBaseFields.clear();
    for (const [field, value] of draft) {
      const input = form.elements.namedItem(field);
      if (input) { input.value = value; changedBaseFields.add(field); }
    }
    if (draft.length) { try { updatePresetState(readForm()); } catch { updatePresetState({}); } }
    renderPreferenceLibrary();
    render();
    saveIfAllowed();
    $('#form-hint').textContent = changedBaseFields.size ? '아직 반영하지 않은 기본 조건이 있어요. 일정 만들기를 누르면 반영됩니다.' : '화면의 모든 금액·동선은 현재 적용된 조건으로 계산했어요.';
    if (message) notify(message);
    return true;
  } catch (error) {
    errorMessage(error instanceof Error ? error.message : '일정을 계산하지 못했어요. 조건을 다시 확인해 주세요.');
    if (!recommendations) output.replaceChildren(element('p', 'empty-state', '일정을 불러오지 못했어요. 조건을 확인하고 다시 만들어 주세요.'));
    output.setAttribute('aria-busy', 'false');
    return false;
  } finally {
    busy = false;
    submit.disabled = false;
    submit.firstElementChild.textContent = '내 서울 일정 만들기';
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  let nextProfile, nextPersonalization;
  try { nextProfile = readForm(); nextPersonalization = recordChanges(nextProfile); }
  catch (error) { errorMessage(error.message); return; }
  if (await calculate({ nextProfile, nextPersonalization, preserveDraft: false, message: '직접 바꾼 조건을 이번 여행에 반영했어요.' })) {
    $('#result-heading').focus({ preventScroll: true });
    if (matchMedia('(max-width:700px)').matches) $('#result-heading').scrollIntoView({ block: 'start' });
  }
});
function markBaseChange(event) {
  if (Object.hasOwn(DEFAULT_PROFILE, event.target.name)) changedBaseFields.add(event.target.name);
  $('#form-hint').textContent = '조건이 바뀌었어요. 일정 만들기를 누르면 결과에 반영됩니다.';
  try { updatePresetState(readForm()); } catch { updatePresetState({}); }
}
form.addEventListener('input', markBaseChange);
form.addEventListener('change', markBaseChange);
$('#presets').replaceChildren(...PRESETS.map(preset => {
  const node = button(preset.label, 'felt-choice', () => {
    if (busy || conversationBusy) return;
    clearConversation({ clearText: true, message: '예시 설정으로 바꾸어 문장 제안을 닫았어요.' });
    skippedQuestions.clear();
    calculate({ nextProfile: preset.profile, nextLock: null, nextPersonalization: createPersonalization(), nextPreviewLabel: `'${preset.label}' 예시 설정`, preserveDraft: false, message: `${preset.description} 취향 기록은 초기화하고 예시로만 비교합니다.` });
  });
  node.dataset.preset = preset.id;
  node.setAttribute('aria-pressed', 'false');
  return node;
}));
consent.addEventListener('change', () => {
  if (consent.checked) {
    const saved = saveIfAllowed();
    notify(saved ? '현재 여행 조건을 이 브라우저에만 저장했어요.' : '브라우저가 저장을 허용하지 않아 보관하지 못했어요.');
  } else {
    try { clearSavedTrip(); status.textContent = '저장된 조건을 지웠어요. 현재 화면의 선택만 유지됩니다.'; notify('이 브라우저의 저장 기록을 지웠어요.'); }
    catch { status.textContent = '브라우저 저장 기록을 지우지 못했어요. 브라우저의 사이트 데이터에서 삭제할 수 있어요.'; }
  }
});
$('#reset').addEventListener('click', async () => {
  if (busy) return;
  clearConversation({ clearText: true, message: '문장 입력과 제안을 초기화했어요.' });
  let cleared = true;
  try { clearSavedTrip(); } catch { cleared = false; }
  consent.checked = false;
  skippedQuestions.clear();
  status.textContent = cleared ? '저장된 조건을 지웠어요. 동의 전에는 조건을 저장하지 않습니다.' : '화면은 초기화했지만 저장 기록은 지우지 못했어요. 브라우저 사이트 데이터를 확인해 주세요.';
  await calculate({ nextProfile: { ...DEFAULT_PROFILE }, nextPersonalization: createPersonalization(), nextPreviewLabel: '기본 조건', nextLock: null, initial: true, preserveDraft: false, message: '처음 조건으로 돌아왔어요.' });
});
const fieldSelect = $('#preference-field');
const fieldGroups = new Map();
for (const field of ALL_FIELDS) {
  const groupName = field.group || '세부 취향';
  if (!fieldGroups.has(groupName)) {
    const group = element('optgroup'); group.label = groupName; fieldGroups.set(groupName, group); fieldSelect.append(group);
  }
  const option = element('option', '', field.label); option.value = field.id; fieldGroups.get(groupName).append(option);
}
fieldSelect.addEventListener('change', () => fillPreferenceEditor(fieldSelect.value));
$('#preference-close').addEventListener('click', () => $('#preference-dialog').close());
$('#preference-mode').addEventListener('change', updateEditorMode);
$('#preference-duration').addEventListener('change', updateEditorExisting);
$('#preference-apply').addEventListener('click', async () => {
  if (busy) return;
  const id = fieldSelect.value;
  const field = ALL_FIELDS.find(item => item.id === id);
  const input = $('#preference-value');
  try {
    const value = field.options?.length
      ? input.value === 'custom' ? readNumericInput(field, $('#preference-value-custom')) : field.options[Number(input.value)].value
      : readNumericInput(field, input);
    const nextPersonalization = setPreference(personalization, { field: id, value, mode: value === 'any' ? 'prefer' : $('#preference-mode').value, importance: Number($('#preference-importance').value), duration: $('#preference-duration').value });
    const nextProfile = Object.hasOwn(DEFAULT_PROFILE, id) ? { ...profile, [id]: value } : profile;
    const success = await calculate({ nextProfile, nextPersonalization, message: '알려준 취향의 기간과 중요도를 반영해 다시 비교했어요.' });
    if (success) $('#preference-dialog').close();
    else { $('#preference-error').textContent = $('#form-error').textContent; $('#preference-error').hidden = false; }
  } catch (error) { $('#preference-error').textContent = error.message; $('#preference-error').hidden = false; }
});
$('#preference-remove').addEventListener('click', async () => {
  if (busy) return;
  const field = fieldSelect.value;
  const duration = $('#preference-duration').value;
  try {
    const hadBaseline = Boolean(editorEntry(field, 'ongoing'));
    const nextPersonalization = removePreference(personalization, { field, duration });
    const effective = summarizePersonalization(nextPersonalization).entries.find(entry => entry.field === field);
    const nextProfile = Object.hasOwn(DEFAULT_PROFILE, field) ? { ...profile, [field]: effective && effective.status !== 'expired' ? effective.value : DEFAULT_PROFILE[field] } : profile;
    const success = await calculate({ nextProfile, nextPersonalization, message: duration === 'once' && hadBaseline ? '이번 조건을 지우고 평소 취향으로 돌아왔어요.' : '직접 알려준 조건을 지웠어요.' });
    if (success) $('#preference-dialog').close();
    else { $('#preference-error').textContent = $('#form-error').textContent; $('#preference-error').hidden = false; }
  } catch (error) { $('#preference-error').textContent = error.message; $('#preference-error').hidden = false; }
});
$('#new-trip').addEventListener('click', async () => {
  if (busy) return;
  try {
    const nextPersonalization = startNewTrip(personalization);
    const nextProfile = { ...DEFAULT_PROFILE };
    for (const entry of summarizePersonalization(nextPersonalization).baseline) {
      if (Object.hasOwn(nextProfile, entry.field) && entry.status !== 'expired') nextProfile[entry.field] = entry.value;
    }
    skippedQuestions.clear();
    const success = await calculate({ nextProfile, nextPersonalization, nextLock: null, nextPreviewLabel: '새 여행의 기본 조건', initial: true, preserveDraft: false, message: '이번 여행 조건을 종료했어요. 평소 취향은 새 여행에도 남겨 둡니다.' });
    if (success) clearConversation({ clearText: true, message: '새 여행에서 원하는 조건을 다시 알려 주세요.' });
  } catch (error) { errorMessage(error.message); }
});
$('#conversation-text').addEventListener('input', () => {
  clearConversation({ message: '문장이 바뀌었어요. 다시 읽은 제안을 확인해 주세요.' });
});
document.querySelectorAll('[data-conversation-example]').forEach(node => node.addEventListener('click', () => {
  if (busy || conversationBusy) return;
  clearConversation({ clearText: true });
  $('#conversation-text').value = conversationExamples[node.dataset.conversationExample];
  $('#conversation-count').textContent = `${$('#conversation-text').value.length} / 4,000`;
  $('#conversation-status').textContent = '예시 문장을 입력했어요. 읽어보기 후 내게 맞는 조건만 확인해 주세요.';
  $('#conversation-text').focus({ preventScroll: true });
}));
$('#conversation-read').addEventListener('click', () => {
  if (busy || conversationBusy) return;
  try {
    const prepared = prepareConversation($('#conversation-text').value, { encounterId: personalization.encounterId });
    conversationEdits.clear();
    conversationDraft = prepared;
    conversationRevision += 1;
    $('#conversation-error').hidden = true;
    renderConversation();
    $('#conversation-dialog').showModal();
    $('#conversation-close').focus({ preventScroll: true });
  } catch (error) {
    $('#conversation-error').textContent = error.message;
    $('#conversation-error').hidden = false;
  }
});
$('#conversation-reopen').addEventListener('click', () => {
  if (!conversationDraft || busy || conversationBusy) return;
  renderConversation();
  $('#conversation-dialog').showModal();
});
$('#conversation-close').addEventListener('click', () => {
  if (!conversationBusy) $('#conversation-dialog').close();
});
$('#conversation-dialog').addEventListener('cancel', event => { if (conversationBusy) event.preventDefault(); });
$('#conversation-edit-source').addEventListener('click', () => {
  if (busy || conversationBusy) return;
  clearConversation({ message: '이미 확인한 조건은 유지됩니다. 원문을 고친 뒤 다시 읽어 주세요.' });
  $('#conversation-text').focus();
});
window.addEventListener('storage', event => {
  if ((event.key === STORAGE_KEY || event.key === null) && event.newValue === null) {
    consent.checked = false;
    status.textContent = '다른 탭에서 저장 기록을 지웠어요. 현재 화면은 유지하지만 다시 동의하기 전에는 저장하지 않습니다.';
  }
});
function download(contents, filename, mimeType) {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('#export-json').addEventListener('click', () => {
  if (!activePlan) return;
  download(JSON.stringify({ version: VERSION, isFixture: true, notice: recommendations.notice, scope: '성인 1명 / 서울 하루 일정 + 숙소 1박', profile, personalization, lockedHotelId, plan: activePlan,
    selection: { displayedPlanId: activePlan.id, recommendedPlanId: recommendations.primary?.id ?? null, showingAlternative: activePlan.id !== recommendations.primary?.id }, engineAudit: recommendations.engineAudit }, null, 2), 'synk-path-seoul-demo.json', 'application/json');
  notify('JSON 파일 저장을 요청했어요. 브라우저의 다운로드를 확인해 주세요.');
});
$('#export-text').addEventListener('click', () => {
  if (!activePlan) return;
  $('#memo-content').value = exportPlan(activePlan, profile, personalization);
  $('#memo-status').textContent = '파일 저장은 브라우저의 다운로드 설정에 따라 열리거나 저장됩니다.';
  $('#memo-dialog').showModal();
  $('#memo-content').focus({ preventScroll: true });
});
$('#memo-close').addEventListener('click', () => $('#memo-dialog').close());
$('#memo-select').addEventListener('click', () => {
  $('#memo-content').focus({ preventScroll: true });
  $('#memo-content').select();
});
$('#memo-save').addEventListener('click', () => {
  download($('#memo-content').value, 'synk-path-seoul-demo.txt', 'text/plain');
  $('#memo-status').textContent = '메모 파일 저장을 요청했어요. 브라우저의 다운로드를 확인해 주세요.';
});
try {
  const saved = loadSavedTrip();
  if (saved) {
    profile = saved.profile;
    personalization = saved.personalization ? validatePersonalization(saved.personalization) : createPersonalization();
    previewLabel = '저장된 비교 조건';
    lockedHotelId = saved.lockedHotelId;
    consent.checked = true;
    status.textContent = '이 브라우저에 동의하고 저장한 조건을 불러왔어요.';
  }
} catch {
  status.textContent = '이 브라우저의 저장 기록을 읽지 못해 기본 조건으로 시작했어요. 아래 초기화로 기존 기록을 지울 수 있어요.';
}
populateForm(profile);
renderPreferenceLibrary();
calculate({ nextProfile: profile, initial: true });
