import { REAL_PLACES, REAL_META, REAL_CONDITION_CALENDAR } from './real-places.mjs?v=20261007-halfday1';
import { createRealCourseUI } from './real-course-ui.mjs?v=20261007-halfday1';
import { normalizeRealQuery, evaluateRealConditions } from './real-conditions.mjs?v=20261007-halfday1';
import {
  CATEGORIES, REAL_STORAGE_KEY, VISIT_REASONS, normalizeRealState, rankRealPlaces,
  readRealState, serializeRealState, mapLink, exportRealMemo, formatRealQuery,
  setRealReaction, setRealVisit, setRealCategoryPreference, clearRealFeedback,
} from './real-guide.mjs?v=20261007-halfday1';

const $ = selector => document.querySelector(selector);
const byId = new Map(REAL_PLACES.map(item => [item.id, item]));
const categoryLabel = id => CATEGORIES.find(item => item.id === id).label;
let state = normalizeRealState();
const course = createRealCourseUI({ getSelected: () => [...state.selected], getState: () => state });
// This trip's comparison is deliberately separate from saved personal opinions.
let query = normalizeRealQuery();
let editingId = null;
let feedbackOrigin = 'card';
const consent = $('#real-consent'), feedbackConsent = $('#real-feedback-consent');
const status = $('#real-storage-status'), dialog = $('#real-feedback-dialog');
function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}
function button(text, action, className = 'felt-choice') {
  const value = node('button', className, text); value.type = 'button'; value.addEventListener('click', action); return value;
}
function external(text, url) {
  const value = node('a', '', text); value.href = url; value.target = '_blank'; value.rel = 'noopener noreferrer'; return value;
}
function save() {
  state.feedbackConsent = consent.checked && feedbackConsent.checked;
  if (!consent.checked) return;
  try {
    localStorage.setItem(REAL_STORAGE_KEY, serializeRealState(state));
    status.textContent = state.feedbackConsent ? '선택과 취향·방문 기록을 이 브라우저에 저장했어요.' : '관심 분야와 방문 목록만 저장했어요. 취향·방문 기록은 현재 화면에서만 반영됩니다.';
  } catch { status.textContent = '브라우저가 저장을 허용하지 않았어요. 현재 화면에서는 계속 사용할 수 있어요.'; }
}
function announce(text) { $('#real-status').textContent = text; }
// 을/를 from the last Hangul syllable: the Hangul part of experiences/play-common/kit/josa.mjs, inlined because the travel bundle ships a fixed file list.
function objectParticle(word) { const last = [...String(word)].reverse().find(char => char >= '가' && char <= '힣'); return last && (last.charCodeAt(0) - 0xac00) % 28 ? '을' : '를'; }
function focusCard(id, kind = 'feedback') { $(`[data-place="${id}"] .real-${kind}`)?.focus({ preventScroll: true }); }
function feedbackCount() { return Object.keys(state.reactions).length + Object.keys(state.visits).length + Object.keys(state.categoryPreferences).length; }
function recordDate(at) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(at)); }
function describePlace(id) {
  const words = [], reaction = state.reactions[id], visit = state.visits[id];
  if (reaction) words.push(reaction.value === 'interested' ? '관심 있어요' : '덜 보고 싶어요');
  if (visit) {
    const reasons = visit.reasons.map(id => VISIT_REASONS.find(item => item.id === id)?.label).filter(Boolean);
    words.push(`${visit.value === 'liked' ? '다녀왔고, 좋았어요' : '다녀왔고, 아쉬웠어요'}${reasons.length ? ' · ' + reasons.join(', ') : ''}`);
  }
  return words.join(' / ');
}
function openFeedback(id, origin = 'card') {
  editingId = id;
  feedbackOrigin = origin;
  const place = byId.get(id);
  $('#real-feedback-title').textContent = place.name;
  $('#real-reaction').value = state.reactions[id]?.value || '';
  $('#real-visit').value = state.visits[id]?.value || '';
  $('#real-reason-options').replaceChildren(...VISIT_REASONS.map(item => {
    const label = node('label', 'real-reason-option'), input = node('input'); input.type = 'checkbox'; input.value = item.id;
    input.checked = state.visits[id]?.reasons.includes(item.id) || false; label.append(input, node('span', '', item.label)); return label;
  }));
  $('#real-visit-reasons').hidden = !$('#real-visit').value;
  $('#real-category-preference').value = state.categoryPreferences[place.category]?.value || '';
  $('#real-category-label').textContent = `‘${categoryLabel(place.category)}’ 분야는 다음에도`;
  $('#real-category-help').textContent = '이 선택은 같은 분야의 다른 장소에도 적용됩니다. 이 장소의 방문 평가와는 별도로 바꾸거나 지울 수 있어요.';
  $('#real-feedback-remove').disabled = !state.reactions[id] && !state.visits[id];
  $('#real-feedback-save-note').textContent = state.feedbackConsent ? '취향 기록 저장에 동의한 브라우저입니다. 다음 방문에도 이어집니다.' : '지금은 이 화면에서만 반영해요. 아래 방문 목록의 저장 설정에서 별도로 동의하면 다음에도 이어집니다.';
  dialog.showModal();
}
function renderHistory() {
  const count = feedbackCount();
  $('#real-history-title').textContent = `내 취향과 방문 기록 · ${count}개`;
  $('#real-feedback-clear').disabled = count === 0;
  $('#real-feedback-clear').textContent = consent.checked ? '취향·방문 기록 모두 지우기' : '이 화면의 취향·방문 기록 지우기';
  const rows = REAL_PLACES.filter(place => state.reactions[place.id] || state.visits[place.id]).map(place => {
    const row = node('div', 'real-history-row'), copy = node('div');
    copy.append(node('strong', '', place.name), node('p', '', describePlace(place.id)));
    copy.append(node('p', 'real-record-date', [state.reactions[place.id] && `관심 기록 ${recordDate(state.reactions[place.id].at)}`, state.visits[place.id] && `방문 평가 ${recordDate(state.visits[place.id].at)}`].filter(Boolean).join(' · ') + ' (한국 시간)'));
    const edit = button('기록 수정', () => openFeedback(place.id, 'history')); edit.dataset.history = place.id; edit.setAttribute('aria-label', `기록 수정: ${place.name}`);
    row.append(copy, edit); return row;
  });
  for (const item of CATEGORIES) {
    const preference = state.categoryPreferences[item.id];
    if (!preference) continue;
    const row = node('div', 'real-history-row'), copy = node('div');
    copy.append(node('strong', '', `${item.label} 분야`), node('p', '', preference.value === 'more' ? '다음에도 더 보여주세요' : '다음에는 덜 보여주세요'));
    copy.append(node('p', 'real-record-date', `설정 ${recordDate(preference.at)} (한국 시간)`));
    const remove = button('분야 선호 지우기', () => {
      state = setRealCategoryPreference(state, { category: item.id, value: null }); save(); render();
      $('#real-history-title').focus({ preventScroll: true }); announce(`${item.label} 분야 선호를 지웠어요. 장소별 반응은 유지됩니다.`);
    }); remove.setAttribute('aria-label', `분야 선호 지우기: ${item.label}`); row.append(copy, remove); rows.push(row);
  }
  $('#real-history-items').replaceChildren(...(rows.length ? rows : [node('p', 'real-history-empty', '아직 직접 남긴 반응이 없어요. 장소의 ‘취향·방문 기록’에서 시작해 보세요.')]));
}
function render() {
  course.updateSelection();
  feedbackConsent.disabled = !consent.checked;
  feedbackConsent.checked = state.feedbackConsent && consent.checked;
  for (const item of CATEGORIES) $('#real-interest-' + item.id).setAttribute('aria-pressed', String(state.interests.includes(item.id)));
  const original = $('#real-sort').value === 'original';
  const ranked = rankRealPlaces(state, { query, order: original ? 'original' : 'personalized' });
  const hasQuery = Boolean(query.date || query.time || query.budget !== null);
  const conditionCounts = Object.fromEntries(['matched', 'unknown', 'unmatched'].map(key => [key, ranked.filter(row => row.condition.status === key).length]));
  $('#real-conditions-summary').textContent = hasQuery ? `${formatRealQuery(query)}. 안내상 조건 맞음 ${conditionCounts.matched}곳 · 확인 필요 ${conditionCounts.unknown}곳 · 조건과 다름 ${conditionCounts.unmatched}곳.` : '날짜·시간·예산이 정해지면 아는 조건만 골라 비교해 보세요.';
  const count = feedbackCount();
  $('#real-feedback-note').textContent = original ? '기본 순서로 보고 있어요. 남긴 반응은 그대로 유지됩니다.' : count ? `직접 남긴 반응 ${count}개를 참고한 순서예요. 장소마다 반영한 이유를 보여드려요.` : '아직 남긴 반응이 없어 기본 순서로 보여드려요.';
  if (hasQuery) $('#real-feedback-note').textContent = `조건이 맞는 곳, 확인이 필요한 곳, 조건이 다른 곳 순서예요. 같은 상태 안에서는 ${original ? '기본 순서' : '내 취향 순서'}로 보여드려요.`;
  $('#real-count').textContent = state.interests.length ? `고른 관심 분야의 장소 ${ranked.length}곳` : `공식 안내를 확인한 장소 ${ranked.length}곳`;
  $('#real-cards').replaceChildren(...ranked.map(({ place, reasons, condition }) => {
    const article = node('article', 'real-card'); article.dataset.place = place.id;
    article.dataset.condition = condition.status;
    const top = node('div', 'real-card-heading'); top.append(node('p', 'eyebrow', categoryLabel(place.category)), node('h3', '', place.name));
    const basis = node('p', 'real-recommendation', reasons.length ? reasons.map(reason => reason.label).join(' · ') : '아직 이 장소에 반영할 반응이 없어요.');
    const details = node('details', 'real-visit-details'), summary = node('summary', '', '방문 정보 · 운영시간과 오시는 길');
    const facts = node('dl', 'real-facts');
    for (const [label, value] of [['운영', place.openingNote || '공식 안내에서 방문일 운영을 확인해 주세요.'], ['이동', place.accessNote || '공식 안내의 오시는 길을 확인해 주세요.'], ['비용', place.costNote], ['방문 전', place.visitNote]]) facts.append(node('dt', '', label), node('dd', '', value));
    const visitLinks = node('div', 'real-links');
    const visitSource = condition.checks.schedule.sourceUrl || place.visitSourceUrl;
    if (visitSource) visitLinks.append(external('운영 안내 원문 ↗', visitSource));
    if (place.visitNoticeSourceUrl && place.visitNoticeSourceUrl !== visitSource) visitLinks.append(external('기간별 운영 공지 ↗', place.visitNoticeSourceUrl));
    if (place.accessSourceUrl) visitLinks.append(external('오시는 길 원문 ↗', place.accessSourceUrl));
    const priceSource = condition.checks.budget.sourceUrl || place.conditions?.price?.sourceUrl;
    if (priceSource) visitLinks.append(external('가격 안내 원문 ↗', priceSource));
    details.append(summary, facts, visitLinks, node('p', 'real-source', `방문 정보 확인 ${place.verifiedAt || place.checkedAt} · 당일 변동은 공식 안내에서 확인해 주세요.`));
    const links = node('div', 'real-links'); links.append(external(place.category === 'stay' ? '객실·예약 안내 ↗' : '공식 안내 ↗', place.sourceUrl), external('지도 검색 ↗', mapLink(place)));
    const selected = state.selected.includes(place.id), chooseText = selected ? '내 목록에서 빼기' : '내 방문 목록에 담기';
    const choose = button(chooseText, () => {
      state.selected = selected ? state.selected.filter(id => id !== place.id) : [...state.selected, place.id];
      save(); render(); announce(`${place.name}${objectParticle(place.name)} ${selected ? '목록에서 뺐어요.' : '목록에 담았어요.'}`); focusCard(place.id, 'choose');
    });
    choose.classList.add('real-choose'); choose.dataset.selected = String(selected); choose.setAttribute('aria-label', `${chooseText}: ${place.name}`);
    const feedback = button('취향·방문 기록', () => openFeedback(place.id)); feedback.classList.add('real-feedback'); feedback.setAttribute('aria-label', `취향·방문 기록: ${place.name}`);
    const actions = node('div', 'real-card-actions'); actions.append(choose, feedback);
    const comparison = node('div', 'real-condition'); comparison.hidden = !hasQuery;
    const comparedReasons = node('ul', 'real-condition-reasons'); comparedReasons.append(...condition.reasons.map(reason => node('li', '', reason)));
    comparison.append(node('p', 'real-condition-status', condition.label), comparedReasons);
    article.append(top, node('p', 'real-description', place.description), node('p', 'real-address', place.address), comparison, basis, details, node('p', 'real-source', `${place.sourceLabel} · 공식 안내 확인 ${place.checkedAt}`), links, actions);
    return article;
  }));
  $('#real-picked').replaceChildren(...state.selected.map((id, index) => {
    const place = byId.get(id), row = node('li', 'real-picked-item'), copy = node('div', 'real-picked-copy');
    copy.append(node('span', '', `${index + 1}. ${place.name}`));
    if (hasQuery) { const check = evaluateRealConditions(place, query, { calendar: REAL_CONDITION_CALENDAR }); copy.append(node('p', 'real-picked-condition', `${check.label} · ${check.reasons.join(' ')}`)); }
    row.append(copy);
    const actions = node('div', 'real-picked-actions');
    for (const [offset, label] of [[-1, '앞으로'], [1, '뒤로']]) {
      const move = button(label, () => {
        const next = index + offset; [state.selected[index], state.selected[next]] = [state.selected[next], state.selected[index]];
        save(); render(); announce(`${place.name} 순서를 바꿨어요.`);
        const row = $(`[data-picked="${id}"]`); (row?.querySelector(`[data-move="${offset}"]:not(:disabled)`) ?? row?.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
      });
      move.dataset.move = String(offset); move.disabled = index + offset < 0 || index + offset >= state.selected.length; move.setAttribute('aria-label', `${label}: ${place.name}`); actions.append(move);
    }
    const remove = button('빼기', () => {
      state.selected = state.selected.filter(value => value !== id); save(); render(); announce(`${place.name}${objectParticle(place.name)} 목록에서 뺐어요.`); $('#real-list-title').focus({ preventScroll: true });
    }); remove.setAttribute('aria-label', `빼기: ${place.name}`); actions.append(remove); row.dataset.picked = id; row.append(actions); return row;
  }));
  $('#real-empty').hidden = state.selected.length > 0; $('#real-export').disabled = state.selected.length === 0; $('#real-list-count').textContent = `${state.selected.length}곳 담음`;
  renderHistory();
}
const conditionFields = { date: $('#real-visit-date'), time: $('#real-visit-time'), budget: $('#real-budget') };
function clearConditionError() {
  for (const input of Object.values(conditionFields)) input.removeAttribute('aria-invalid');
  $('#real-conditions-error').hidden = true; $('#real-conditions-error').textContent = '';
}
function resetConditions() {
  query = normalizeRealQuery(); $('#real-conditions-form').reset(); clearConditionError(); $('#real-conditions-draft').textContent = '';
}
$('#real-conditions-form').addEventListener('input', () => { clearConditionError(); $('#real-conditions-draft').textContent = '수정한 조건은 ‘조건 비교하기’를 누르면 반영됩니다.'; });
$('#real-conditions-form').addEventListener('submit', event => {
  event.preventDefault(); clearConditionError();
  try {
    for (const [field, input] of Object.entries(conditionFields)) if (!input.validity.valid) {
      const error = new TypeError(field === 'budget' ? '예산은 0~1,000,000원 사이의 정수로 입력해 주세요.' : field === 'date' ? '방문 날짜를 확인해 주세요.' : '도착 시간을 시와 분으로 입력해 주세요.'); error.field = field; throw error;
    }
    query = normalizeRealQuery({ date: conditionFields.date.value, time: conditionFields.time.value, budget: conditionFields.budget.value === '' ? null : Number(conditionFields.budget.value) });
    $('#real-conditions-draft').textContent = ''; $('#real-memo-content').value = ''; render();
    announce('입력한 조건으로 비교했어요. 담아 둔 방문 목록은 그대로입니다.');
  } catch (error) {
    $('#real-conditions-error').hidden = false; $('#real-conditions-error').textContent = error.message;
    const field = conditionFields[error.field] || conditionFields.date; field.setAttribute('aria-invalid', 'true'); field.focus();
  }
});
$('#real-conditions-clear').addEventListener('click', () => { resetConditions(); $('#real-memo-content').value = ''; render(); announce('이번 비교 조건을 지웠어요. 취향 기록과 방문 목록은 그대로예요.'); });
for (const item of CATEGORIES) {
  const choice = button(item.label, () => {
    state.interests = state.interests.includes(item.id) ? state.interests.filter(id => id !== item.id) : [...state.interests, item.id]; save(); render(); announce($('#real-count').textContent);
  }); choice.id = 'real-interest-' + item.id; choice.setAttribute('aria-pressed', 'false'); $('#real-interests').append(choice);
}
$('#real-show-all').addEventListener('click', () => { state.interests = []; save(); render(); announce('모든 관심 분야를 다시 보여드려요. 담은 목록과 취향은 그대로예요.'); });
$('#real-sort').addEventListener('change', () => { render(); announce($('#real-feedback-note').textContent); });
$('#real-visit').addEventListener('change', () => { $('#real-visit-reasons').hidden = !$('#real-visit').value; });
$('#real-feedback-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  const id = editingId; editingId = null;
  if (!id) return;
  const history = $(`[data-history="${id}"]`), card = $(`[data-place="${id}"] .real-feedback`);
  (feedbackOrigin === 'history' ? history ?? $('#real-history-title') : card ?? history ?? $('#real-history-title')).focus({ preventScroll: true });
});
$('#real-feedback-apply').addEventListener('click', () => {
  const place = byId.get(editingId); if (!place) return;
  const reaction = $('#real-reaction').value || null, visit = $('#real-visit').value || null, preference = $('#real-category-preference').value || null;
  const reasons = visit ? [...$('#real-reason-options').querySelectorAll('input:checked')].map(input => input.value) : [];
  if ((state.reactions[place.id]?.value || null) !== reaction) state = setRealReaction(state, { placeId: place.id, value: reaction });
  if ((state.visits[place.id]?.value || null) !== visit || JSON.stringify(state.visits[place.id]?.reasons || []) !== JSON.stringify(reasons)) state = setRealVisit(state, { placeId: place.id, value: visit, reasons });
  if ((state.categoryPreferences[place.category]?.value || null) !== preference) state = setRealCategoryPreference(state, { category: place.category, value: preference });
  save(); render(); dialog.close(); announce(`${place.name}에 직접 남긴 반응을 반영했어요. 방문 목록의 순서는 그대로입니다.`);
});
$('#real-feedback-remove').addEventListener('click', () => {
  if (!editingId) return;
  const id = editingId; state = setRealReaction(state, { placeId: id, value: null }); state = setRealVisit(state, { placeId: id, value: null });
  save(); render(); dialog.close(); announce('이 장소의 반응을 지웠어요. 별도로 정한 분야 선호와 방문 목록은 유지됩니다.');
});
$('#real-feedback-clear').addEventListener('click', () => {
  const saved = consent.checked;
  state = clearRealFeedback(state); feedbackConsent.checked = false; save(); render(); $('#real-history-title').focus({ preventScroll: true });
  announce(saved ? '취향·방문 기록과 분야 선호를 화면과 저장소에서 지웠어요. 관심 분야와 방문 목록은 그대로예요.' : '현재 화면의 취향·방문 기록과 분야 선호만 지웠어요. 브라우저의 저장 기록까지 지우려면 실제 장소 선택과 기록 모두 초기화를 눌러 주세요.');
});
try {
  const restored = readRealState(localStorage.getItem(REAL_STORAGE_KEY));
  if (restored) { state = restored; consent.checked = true; feedbackConsent.checked = state.feedbackConsent; status.textContent = state.feedbackConsent ? '이 브라우저의 선택과 취향·방문 기록을 불러왔어요.' : '저장한 관심 분야와 장소를 불러왔어요. 취향·방문 기록의 저장은 별도로 동의해 주세요.'; }
} catch { status.textContent = '브라우저 저장소를 읽을 수 없어요. 현재 화면에서만 사용합니다.'; }
consent.addEventListener('change', () => {
  if (consent.checked) save();
  else {
    state.feedbackConsent = false; feedbackConsent.checked = false;
    try { localStorage.removeItem(REAL_STORAGE_KEY); status.textContent = '저장 기록을 지웠어요. 현재 화면의 선택과 반응은 유지됩니다.'; }
    catch { status.textContent = '저장 기록을 지우지 못했어요. 브라우저의 사이트 데이터에서 삭제해 주세요.'; }
  }
  render();
});
feedbackConsent.addEventListener('change', () => { save(); render(); });
$('#real-reset').addEventListener('click', () => {
  state = normalizeRealState(); consent.checked = false; feedbackConsent.checked = false;
  resetConditions();
  course.reset();
  try { localStorage.removeItem(REAL_STORAGE_KEY); status.textContent = '실제 장소의 선택과 모든 취향·방문 기록을 지웠어요.'; }
  catch { status.textContent = '화면은 초기화했지만 저장 기록은 지우지 못했어요. 브라우저 사이트 데이터를 확인해 주세요.'; }
  $('#real-memo-content').value = ''; render(); announce('실제 장소 선택과 기록을 모두 초기화했어요.');
});
window.addEventListener('storage', event => {
  if ((event.key === REAL_STORAGE_KEY || event.key === null) && event.newValue === null) {
    consent.checked = false; state.feedbackConsent = false; feedbackConsent.checked = false; render(); status.textContent = '다른 탭에서 저장 기록을 지웠어요. 현재 선택과 반응은 유지하며 다시 저장하지 않습니다.';
  } else if (event.key === REAL_STORAGE_KEY && event.newValue !== null) {
    const other = readRealState(event.newValue);
    const previous = readRealState(event.oldValue);
    const changed = other && previous && ['reactions', 'visits', 'categoryPreferences'].some(key => JSON.stringify(previous[key]) !== JSON.stringify(other[key]));
    if (other && (changed || (!other.feedbackConsent && state.feedbackConsent))) {
      consent.checked = false; state.feedbackConsent = false; feedbackConsent.checked = false; render(); status.textContent = '다른 탭에서 취향 기록이나 저장 동의를 바꿨어요. 현재 화면은 유지하고 자동 저장을 중단했습니다. 새로고침하면 최신 기록을 불러옵니다.';
    }
  }
});
$('#real-export').addEventListener('click', () => { $('#real-memo-content').value = exportRealMemo(state, { query }); $('#real-memo-dialog').showModal(); });
$('#real-memo-close').addEventListener('click', () => $('#real-memo-dialog').close());
$('#real-memo-select').addEventListener('click', () => { $('#real-memo-content').focus(); $('#real-memo-content').select(); });
$('#real-memo-save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([$('#real-memo-content').value], { type: 'text/plain;charset=utf-8' }));
  const link = node('a'); link.href = url; link.download = 'synk-jongno-places.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  $('#real-memo-status').textContent = '메모 파일 저장을 요청했어요. 브라우저의 다운로드를 확인해 주세요.';
});
function showMode(mode) {
  const real = mode === 'real'; $('#real-guide').hidden = !real; $('#prototype-note').hidden = real; $('#planner').hidden = real; $('#simulation-storage').hidden = real;
  for (const value of ['real', 'simulation']) $('#mode-' + value).setAttribute('aria-pressed', String(mode === value));
  $('#mode-description').textContent = real ? '직접 남긴 취향으로 종로의 실제 장소를 둘러보고, 나만의 방문 목록으로 가져가세요.' : '가상 장소와 가격으로 예산·숙소·음식 등 26가지 조건의 차이를 비교해 보세요.';
}
$('#mode-real').addEventListener('click', () => showMode('real')); $('#mode-simulation').addEventListener('click', () => showMode('simulation'));
$('#real-checked').textContent = `공식 안내 확인 ${REAL_META.checkedAt} · 장소 ${REAL_PLACES.length}곳`;
showMode('real'); render();
