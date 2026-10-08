import { EVENT_TYPES, emptyState, makePerson, analyzeTone, makeEvent, upcomingEvents, nextOccurrence, draftMessage, generateCheckinDraft, defaultDraftApproach, completeEvent, recordDraft, rememberDraft, revokeCareMemory, personTimeline, exportBackup, importBackup, toICS, toFollowupICS, captureSource, recordCareAction, addFollowup, updateFollowup, saveCarePlan, recordPreparation, updatePreparation } from './model.mjs';
import { PEOPLE_GROUPS, filterPeople, monthCalendar, shiftMonth, pastUnfinishedEvents, captureCandidates } from './care-features.mjs';
import { createCareSync } from './care-sync.mjs';
import { createCareAccount } from './account.mjs';
import { compareDraftEdits, applyPreferenceCandidate, reviewMessage, extractFollowupCandidates, followupRows, planFollowupAction } from './care-support.mjs';
import { preparationSummary } from './care-outcomes.mjs';
import { createMemoryCard } from './memory-card.mjs';
import { prepareCare } from './care-planner.mjs';
import { careAccountView, resumeCareLoginNavigation } from './care-account-view.mjs';
import { recommendCareFocus } from './care-focus.mjs';
import { buildCareContext } from './care-context.mjs';
import { createCarePush, carePushAccountIdentity, careLogoutNotice } from './care-push.mjs';
import { CHECKIN_INTENTS, listSavedMessages, toggleMessageFavorite, removeSavedMessage } from './model.mjs';

const $ = id => document.getElementById(id);
const PUBLIC_WEB = document.querySelector('meta[name="synk-care-runtime"]')?.content === 'public-web';
const STORAGE_KEY = 'synk.care.local.v1';
const MAX_AUDIO = 20 * 1024 * 1024;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let state = emptyState(), selectedId = null, persist = false, saveFailed = false, sampleMode = false, activeTab = 'events', activeView = 'home';
let audioFile = null, audioURL = null, transcribing = false, capabilities = null, currentDraft = null, toastTimer;
let calendarMonth = '', calendarDay = '', captureReview = null, logOccurrence = null;
let accountStatus = { configured: false, signedIn: false, status: 'loading' }, accountStarting = true, syncStatus = { status: 'idle' }, accountId = null, guestSnapshot = null, authEpoch = 0;
let personDialogContext = null;
let sync = null, account = null;
const carePush = createCarePush({ request: (action, body) => account.requestPush(action, body), onState: () => renderPushSettings() });
let preparationKey = '', preparationInputs = { attendance: 'undecided', timeMinutes: null, budgetWon: null }, preparationResult = null, preparationLogId = null, preparationLogError = '';
let expressionReview = null, preferenceCandidates = [], preferenceContext = null, cardURL = null, cardFilename = '', cardGeneration = 0, cardItemsKey = '';
let memoryChoice = null, followupCalendar = null, checkinMode = false;
let followupContext = null;
let focusKey = '', focusEpoch = 0, focusOperation = null;
const ACTIONS = { contact: '연락', attend: '참석', gift: '선물', money: '경조금', remember: '조용히 기억' };
const won = value => value === null || value === undefined ? '' : `${value.toLocaleString('ko-KR')}원`;
const conversations = new Map(), sessionDrafts = new Map(), notified = new Set();
const person = () => state.people.find(item => item.id === selectedId);
const rows = () => upcomingEvents(state);
const currentRows = () => rows().filter(item => item.person.id === selectedId);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const hasUnsubmittedAccountInput = () => ['draft-text', 'capture-source', 'followup-title', 'memory-card-title', 'memory-card-message', 'personal-memory'].some(id => $(id)?.value.trim()) || !!$('memory-card-photo')?.files.length || !!document.querySelector('[data-card-selected]:checked');
const hasPersonalizationInput = () => !!memoryChoice || !!$('personal-memory').value || (currentDraft?.eventType === 'checkin' && !!$('draft-text').value.trim());
const notebookView = () => careAccountView({ starting: accountStarting, account: accountStatus, sync: syncStatus, connected: !!accountId, currentAccountId: accountId });

function memoryFingerprint(id) {
  const memory = state.memories.find(item => item.id === id && item.personId === selectedId), source = memory && state.sources.find(item => item.id === memory.sourceId && item.personId === selectedId);
  return memory && source ? JSON.stringify([memory, source]) : '';
}
function resetPersonalMemory(notice = '') {
  memoryChoice = null; $('personal-memory').value = ''; $('personal-memory-use').value = 'shared-memory'; $('personal-memory-evidence').hidden = true; $('personal-memory-evidence').replaceChildren(); $('clear-personal-memory').hidden = true; $('personal-memory-status').textContent = notice; preparationKey = '';
}
function selectedMemory() {
  if (!memoryChoice) return null;
  if (memoryChoice.personId !== selectedId || memoryChoice.epoch !== authEpoch || memoryChoice.fingerprint !== memoryFingerprint(memoryChoice.memoryId)) {
    resetPersonalMemory('선택한 사람이나 기억이 바뀌었어요. 이번에 담을 기억을 다시 골라 주세요.'); resetDraft(); sessionDrafts.delete(selectedId); return null;
  }
  return {memoryId:memoryChoice.memoryId,use:memoryChoice.use,confirmed:true};
}
function renderMemoryPicker() {
  selectedMemory(); const previous = $('personal-memory').value, items = state.memories.filter(item => item.personId === selectedId);
  $('personal-memory').innerHTML = '<option value="">'+(items.length ? '기억을 골라 주세요' : '아직 보관한 기억이 없어요')+'</option>'+items.map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.text.length > 80 ? item.text.slice(0,80)+'…' : item.text)}</option>`).join('');
  if (items.some(item=>item.id===previous)) $('personal-memory').value=previous;
  $('apply-personal-memory').disabled=!items.length;
  renderMemoryEvidence();
}
function renderMemoryEvidence() {
  const memory=state.memories.find(item=>item.id===$('personal-memory').value&&item.personId===selectedId), source=memory&&state.sources.find(item=>item.id===memory.sourceId&&item.personId===selectedId);
  $('personal-memory-evidence').hidden=!memory||!source;
  $('personal-memory-evidence').innerHTML=memory&&source?`<strong>${escapeHTML(memory.text)}</strong><p class="helper">근거 · ${escapeHTML(source.title)}</p><blockquote>${escapeHTML(memory.sourceQuote)}</blockquote>`:'';
  $('clear-personal-memory').hidden=!memoryChoice;
}
function renderMemoryApplication(result) {
  if (!memoryChoice) return;
  const info=result?.memory, blocked=info?.blockedReasons||[];
  $('personal-memory-status').textContent=blocked.length ? `고른 기억을 자동으로 넣지 않았어요. ${blocked.join(' ')}` : memoryChoice.use==='gift-preference' ? '직접 고른 취향을 준비에 참고해요. 메시지에 선물을 약속하지 않아요.' : '직접 고른 기억을 이번 준비와 문구에 인용해요. 보내기 전에 문맥을 확인해 주세요.';
}

function notify(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4400);
}
function on(id, event, fn) {
  $(id).addEventListener(event, async e => { try {
    if (notebookView().locked && e.target.closest('.main-grid, #person-dialog, #followup-calendar-dialog')) { e.preventDefault();notify(notebookView().detail);return; }
    await fn(e);
  } catch (error) { notify(error.message || '처리하지 못했어요. 다시 확인해 주세요.'); } });
}
function save() {
  if (accountId) { sync.change(state); updateStorageLabel(); return true; }
  if (!persist) return true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, selectedPersonId: selectedId, sampleMode, reminderKeys: [...notified].slice(-2000) }));
    saveFailed = false; updateStorageLabel(); return true;
  } catch {
    saveFailed = true; updateStorageLabel();
    notify('브라우저에 저장하지 못했어요. 현재 자료는 JSON으로 내보내 주세요.');
    return false;
  }
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    if (raw.length > 4 * 1024 * 1024) throw Error('저장 자료가 너무 커요.');
    const data = JSON.parse(raw);
    const restored = importBackup(data);
    state = restored;
    selectedId = state.people.some(item => item.id === data.selectedPersonId) ? data.selectedPersonId : state.people[0]?.id ?? null;
    for (const key of Array.isArray(data.reminderKeys) ? data.reminderKeys.slice(-2000) : []) if (typeof key === 'string' && key.length < 180) notified.add(key);
    persist = true; sampleMode = data.sampleMode === true;
  } catch { notify('저장된 자료를 읽지 못했어요. 새 자료는 이번 사용 중에만 보관해요.'); }
}
function updateStorageLabel() {
  $('persist-toggle').checked = persist;
  $('persist-toggle').disabled = !!accountId;
  $('storage-description').textContent = accountId ? '이 수첩은 내 SYNK 계정에 연결돼요. 보내지 못한 변경만 이 기기에 임시 보관하고, 저장이 끝나면 기기 사본을 지워요. 녹음 파일은 제외해요.' : saveFailed ? '최근 변경을 저장하지 못했어요. 새로고침하면 이전 저장본이 나타날 수 있어요. 현재 자료를 JSON으로 내보내 주세요.' : persist ? '사람·일정·기록과 보관을 선택한 대화 원문을 이 브라우저에 저장해요. 녹음 파일은 제외해요.' : '기본은 이번 사용 중에만 보관해요. 새로고침하거나 닫으면 사라져요.';
  $('storage-description').classList.toggle('danger', saveFailed);
}
function stashConversation() {
  if (!selectedId || $('person-workspace').hidden) return;
  conversations.set(selectedId, { text: $('conversation-text').value, selfText: $('self-text').value, otherText: $('other-text').value, verified: $('speaker-confirm').checked });
}
function clearConversationFields() {
  for (const id of ['conversation-text', 'self-text', 'other-text', 'preference-note']) $(id).value = '';
  $('speaker-confirm').checked = false; $('tone-result').textContent = ''; $('tone-result').hidden = true;
}
function stashDraft() {
  if (!selectedId) return;
  if (memoryChoice || currentDraft?.memory) { sessionDrafts.delete(selectedId); return; }
  sessionDrafts.set(selectedId, { draft: currentDraft, text: $('draft-text').value, confirmed: $('draft-confirm').checked, eventId: $('draft-event').value, approach: $('draft-style').value, checkinIntent: $('draft-intent').value, remember: $('remember-draft').checked });
}
function restoreDraft() {
  const stored = sessionDrafts.get(selectedId);
  const row = stored && currentRows().find(item => item.event.id === stored.eventId);
  if (!stored || (stored.eventId && (!row || (stored.draft && stored.draft.occurrenceId !== row.occurrence.occurrenceId)))) return;
  $('draft-event').value = stored.eventId; currentDraft = stored.draft;
  checkinMode=!stored.eventId;
  $('draft-text').value = stored.text; $('draft-confirm').checked = stored.confirmed;
  $('draft-style').value = stored.approach || defaultDraftApproach(person(), currentDraft?.eventType || 'checkin'); $('draft-intent').value = stored.checkinIntent || 'everyday'; $('remember-draft').checked = stored.remember === true;
  if (currentDraft) $('draft-basis').textContent = [...currentDraft.basis, ...currentDraft.cautions, person().recipientPreference.note ? `기억할 점: ${person().recipientPreference.note}` : ''].filter(Boolean).join(' ');
  renderDraftNotice();
}
function restoreConversation() {
  const value = conversations.get(selectedId) ?? {};
  $('conversation-text').value = value.text ?? ''; $('self-text').value = value.selfText ?? ''; $('other-text').value = value.otherText ?? ''; $('speaker-confirm').checked = value.verified === true;
  const pref = person().recipientPreference;
  $('preference-formality').value = pref.formality; $('preference-length').value = pref.length;
  $('preference-emoji').checked = pref.allowEmoji; $('preference-promises').checked = pref.avoidPromises;
  $('preference-note').value = pref.note; $('preference-confirm').checked = pref.confirmed;
  $('preference-salutation').value = pref.salutation || '';
  $('preference-avoid').value = (pref.avoidPhrases || []).join(', ');
  $('preference-no-reply').checked = pref.noReplyPressure === true;
  $('preference-closing').value = pref.closingLine || '';
  renderTone();
}
function renderTone() {
  const result = person()?.selfTone;
  $('tone-result').hidden = !result;
  if (result) $('tone-result').innerHTML = `<strong>${escapeHTML(result.label)}</strong><ul>${result.observations.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul><p class="helper">관찰에 쓴 대화 원문은 새로고침 후 보관하지 않아요.</p>`;
}
function renderSummary() {
  const concealed = notebookView().concealNotebook;
  $('person-count').textContent = concealed ? '—' : state.people.length;
  $('upcoming-count').textContent = concealed ? '—' : rows().filter(item => item.occurrence.daysUntil <= 30).length;
  $('complete-count').textContent = concealed ? '—' : state.completions.length + (state.activities ?? []).length + (state.followups ?? []).filter(item=>item.status==='done').length;
}
function renderPeople() {
  renderSummary();
  const filtered = filterPeople(state.people.map(item => ({ ...item, memories: (state.memories ?? []).filter(memory => memory.personId === item.id) })), { query: $('people-search').value, group: $('people-group-filter').value });
  $('people-result-status').textContent = state.people.length ? `${state.people.length}명 중 ${filtered.length}명` : '';
  $('people-list').innerHTML = filtered.length ? filtered.map(item => `<button type="button" class="person-card${item.id === selectedId ? ' active' : ''}" data-person="${escapeHTML(item.id)}" aria-pressed="${item.id === selectedId}"><span class="person-avatar" aria-hidden="true">${escapeHTML([...item.name][0])}</span><span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.relationship || PEOPLE_GROUPS[item.group] || '소중한 사람')}</small></span></button>`).join('') : `<p class="people-empty">${state.people.length ? '찾는 사람이 없어요. 검색어나 분류를 바꿔 보세요.' : '아직 등록한 사람이 없어요.<br>이름 하나로 시작해 보세요.'}</p>`;
  $('sample-banner').hidden = !sampleMode;
  $('sample-button').hidden = state.people.length > 0;
}
function renderWorkspace(restore = false) {
  const selected = person();
  $('empty-state').hidden = !!selected; $('person-workspace').hidden = !selected;
  if (!selected) {
    clearConversationFields(); $('person-name').textContent = ''; $('person-relationship').textContent = ''; $('person-checkin-summary').textContent = '';
    $('event-list').textContent = ''; $('draft-event').textContent = ''; $('preference-form').reset();
    return;
  }
  $('person-name').textContent = selected.name; $('person-relationship').textContent = selected.relationship || '소중한 사람';
  $('person-checkin-summary').textContent = checkinSummary(selected);
  if (restore) restoreConversation();
  renderEvents(); renderMessageOptions();
}
function render(restore = false) { renderPeople(); renderWorkspace(restore); renderHome(); renderHistory(); renderCapturePeople(); renderBrief(); updateView(); updateStorageLabel(); renderAccount(); }
function updateView() {
  document.body.dataset.view = activeView;
  $('home-view').hidden = activeView !== 'home'; $('workspace').hidden = activeView !== 'person';
  $('show-home').setAttribute('aria-pressed', String(activeView === 'home'));
  if (activeView === 'home') $('show-home').setAttribute('aria-current', 'page'); else $('show-home').removeAttribute('aria-current');
  updateMood();
}
function updateMood() {
  const event = state.events.find(item => item.id === $('draft-event').value);
  $('draft-intent-wrap').hidden = !!event;
  const quiet = activeView === 'person' && activeTab === 'message' && ['condolence', 'memorial'].includes(event?.type);
  document.body.dataset.mood = quiet ? 'quiet' : 'celebrate';
  $('remember-event').hidden = !quiet;
  $('complete-event').textContent = !event ? currentFollowupContext() ? '직접 챙겼어요 · 이 챙김 완료' : '직접 안부 전했어요' : quiet ? '마음을 전했어요' : '챙김 완료';
  $('remember-draft').nextElementSibling.textContent=event?'복사할 때, 이 행사에 다시 쓸 내 문구로 기억':'복사할 때, 안부에 다시 쓸 내 문구로 기억';
}
function showHome() { stashConversation(); stashDraft(); activeView = 'home'; render(); }
function eventDistance(row) { return row.occurrence.daysUntil === 0 ? '오늘' : row.occurrence.daysUntil === 1 ? '내일' : `${row.occurrence.daysUntil}일 뒤`; }
function renderHome() {
  renderCareFocus();
  const checkinPerson=$('checkin-person').value;
  $('checkin-person').innerHTML=state.people.length?'<option value="">사람을 골라 주세요</option>'+state.people.map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`).join(''):'<option value="">먼저 사람을 기억해 주세요</option>';
  if(state.people.some(item=>item.id===checkinPerson))$('checkin-person').value=checkinPerson;
  $('checkin-person').disabled=!state.people.length; $('start-checkin').textContent=state.people.length?'오늘 안부 준비':'사람 한 명부터 추가';
  const upcoming = rows();
  const soon = upcoming.filter(row => row.occurrence.daysUntil <= 7);
  const later = upcoming.filter(row => row.occurrence.daysUntil > 7).slice(0, 6);
  const card = row => {
    const { event, person: who, occurrence } = row;
    const quiet = ['condolence', 'memorial'].includes(event.type);
    const [, month, day] = occurrence.date.split('-');
    const pref = who.recipientPreference;
    const memory = pref.confirmed && pref.noReplyPressure ? '답장을 재촉하지 않기로 했어요.' : pref.confirmed && pref.salutation ? `평소 부르는 호칭 · ${pref.salutation}` : who.notes || (quiet ? '연락하지 않고 조용히 기억해도 괜찮아요.' : '올해의 인사를 내 말로 준비해요.');
    const title = event.title.startsWith(who.name) ? event.title : `${who.name} · ${event.title}`;
    return `<article class="home-card" data-mood="${quiet ? 'quiet' : 'celebrate'}"><div class="home-date"><small>${Number(month)}월</small><strong>${Number(day)}</strong></div><div class="home-card-copy"><span class="home-badge">${eventDistance(row)}</span><h3>${escapeHTML(title)}</h3><p class="home-card-meta">${escapeHTML(who.relationship || '소중한 사람')}${event.calendar === 'lunar' ? ' · 음력 기준' : ''}${event.time ? ` · ${escapeHTML(event.time)}` : ''}</p><p class="home-memory">${escapeHTML(memory)}</p></div><div class="home-card-actions"><button class="soft-button" type="button" data-home-draft="${escapeHTML(event.id)}">${quiet ? '마음 준비하기' : '인사 준비하기'}</button><button class="text-button" type="button" data-home-person="${escapeHTML(who.id)}">우리의 기록</button><button class="text-button" type="button" data-ics="${escapeHTML(event.id)}" data-occurrence-date="${escapeHTML(occurrence.date)}">달력에 저장</button></div></article>`;
  };
  $('home-upcoming').innerHTML = soon.length ? soon.map(card).join('') : '<p class="home-empty-week">이번 주에는 예정된 날이 없어요. 다음에 챙길 날을 미리 살펴보세요.</p>';
  $('home-later').innerHTML = later.map(card).join('');
  $('home-empty').hidden = upcoming.length > 0;
  $('home-empty').querySelector('h3').textContent = state.people.length ? '다음에 챙길 날을 남겨요.' : '떠오르는 한 사람부터.';
  $('home-empty-add').textContent = state.people.length ? '기억할 날 추가' : '첫 번째 사람 기억하기';
  $('home-add-person').hidden = state.people.length === 0;
  const footnote = document.querySelector('.home-footnote'); if (footnote) footnote.hidden = upcoming.length === 0;
  $('home-upcoming-section').hidden = upcoming.length === 0;
  $('home-later-section').hidden = later.length === 0;
  renderSchedule(); renderFollowups(); renderPreparationSummary();
}
function careFocusOptions(result = recommendCareFocus({ state })) {
  return [result.recommendation, ...result.alternatives].filter(Boolean);
}
function renderCareFocus() {
  const panel = $('care-focus');
  if (notebookView().concealNotebook) { panel.hidden = true;panel.removeAttribute('data-key');return; }
  if (focusEpoch !== authEpoch) { focusEpoch = authEpoch;focusKey = ''; }
  const result = recommendCareFocus({ state }), options = careFocusOptions(result);
  panel.hidden = result.status === 'empty';
  const selected = options.find(item => item.key === focusKey) || result.recommendation;
  focusKey = selected?.key || '';panel.dataset.key = focusKey;panel.dataset.epoch = String(authEpoch);
  panel.dataset.mood = selected?.quiet ? 'quiet' : 'celebrate';
  $('care-focus-person').textContent = selected?.personName || '오늘은 내 속도로 챙겨요.';
  $('care-focus-subtitle').textContent = selected?.title || '';
  $('care-focus-reason').textContent = selected?.reason || '지금 먼저 제안할 사람이 없어요.';
  $('care-focus-detail').textContent = selected?.detail || '가까운 일정과 내가 정한 후속 챙김을 살폈어요. 원하면 아래에서 직접 안부를 준비해요.';
  $('care-focus-basis').textContent = result.basisPolicy;
  $('care-focus-action').hidden = $('care-focus-history').hidden = !selected;
  $('care-focus-action').textContent = selected?.actionLabel || '마음 준비하기';
  $('care-focus-next').hidden = options.length < 2;
  $('care-focus-next').textContent = '다른 사람 보기';
}
async function openCareFocus(action) {
  if (notebookView().locked || focusOperation) return;
  const epoch = authEpoch, key = $('care-focus').dataset.key;
  const options = careFocusOptions(), selected = options.find(item => item.key === key);
  if (Number($('care-focus').dataset.epoch) !== epoch || !selected) { renderCareFocus();notify('수첩이나 날짜가 바뀌었어요. 새로 표시한 사람을 확인해 주세요.');return; }
  if (action === 'next') { focusKey = options[(options.findIndex(item => item.key === key) + 1) % options.length].key;renderCareFocus();return; }
  const operation = {};focusOperation = operation;
  try {
    if (selected.kind === 'followup' && action !== 'history') { await beginFollowup(selected.followupId);return; }
    if (action === 'history') {
      if (!await choosePerson(selected.personId, 'history') || epoch !== authEpoch) return;
      $('workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (selected.kind !== 'event') { await beginCheckin(selected.personId);return; }
    const targetEvent = selected.kind === 'event' ? selected.eventId : '';
    if (selected.personId === selectedId && $('draft-text').value.trim() && ($('draft-event').value !== targetEvent || memoryChoice)) {
      if (!await confirmDelete('지금 다듬고 있는 문구가 있어요. 오늘 추천으로 새 문구를 준비하려면 필요한 내용을 먼저 복사해 주세요.', '새 마음 준비하기', '추천으로 준비')) return;
    }
    if (epoch !== authEpoch || notebookView().locked || !careFocusOptions().some(item => item.key === key)) { renderCareFocus();return; }
    if (memoryChoice && selected.personId === selectedId) resetPersonalMemory();
    await prepareEvent(selected.eventId);
  } finally { if (focusOperation === operation) focusOperation = null; }
}
function renderHistory() {
  const selected = person(); if (!selected) { $('person-history').textContent = ''; return; }
  const completedFollowups=followupRows(state,{today:today(),personId:selected.id}).completed.map(item=>({id:item.id,kind:'followup-completed',eventTitle:item.title,createdAt:item.updatedAt}));
  const timeline = [...personTimeline(state, selected.id),...completedFollowups].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
  const pref = selected.recipientPreference;
  const saved = [...new Set(listSavedMessages(selected).map(libraryLabel))];
  const memory = [selected.notes, pref.confirmed && pref.salutation ? `부르는 호칭: ${pref.salutation}` : '', pref.confirmed && pref.avoidPhrases?.length ? `피할 표현: ${pref.avoidPhrases.join(', ')}` : '', pref.confirmed && pref.noReplyPressure ? '답장을 재촉하지 않기' : '', saved.length ? `다시 쓸 내 문구: ${saved.join(' · ')}` : ''].filter(Boolean);
  const top = memory.length ? `<aside class="person-memory"><h4>직접 남긴 기억</h4>${memory.map(line => `<p>${escapeHTML(line)}</p>`).join('')}</aside>` : '';
  const confirmed = (state.memories ?? []).filter(item => item.personId === selectedId);
  const sources = (state.sources ?? []).filter(item => item.personId === selectedId);
  const remembered = confirmed.map(item => `<article class="person-memory"><h4>${item.kind === 'preference' ? '확인한 취향과 표현' : '함께한 기억'}</h4><p>${escapeHTML(item.text)}</p><details><summary>기억의 근거</summary><blockquote>${escapeHTML(item.sourceQuote)}</blockquote></details><button type="button" class="text-button danger" data-delete-memory="${escapeHTML(item.id)}">이 기억 삭제</button></article>`).join('');
  const originals = sources.length ? `<details class="person-memory"><summary>보관한 대화·안내문 ${sources.length}개</summary>${sources.map(item => `<article><h4>${escapeHTML(item.title)}</h4><p class="history-text">${escapeHTML(item.text)}</p><button type="button" class="text-button danger" data-delete-source="${escapeHTML(item.id)}">원문과 연결된 기억 삭제</button></article>`).join('')}</details>` : '';
  $('person-history').innerHTML = top + remembered + originals + (timeline.length ? timeline.map(entry => {
    const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(entry.createdAt));
    if (entry.kind === 'activity') return `<article class="history-entry" data-kind="activity"><div><h4>${escapeHTML(ACTIONS[entry.activityKind])} · ${entry.direction === 'received' ? '받은 마음' : '전한 마음'} ${won(entry.amountWon)}</h4><time>${escapeHTML(entry.occurredOn)}</time></div><p>${escapeHTML(entry.eventTitle)}</p><p class="history-text">${escapeHTML(entry.note)}</p><button type="button" class="text-button danger" data-delete-activity="${escapeHTML(entry.id)}">이 기록 삭제</button></article>`;
    const label = entry.kind === 'copied' ? '복사한 문구' : entry.kind === 'followup-completed' ? '후속 챙김 완료' : entry.action === 'remembered' ? '조용히 기억한 날' : '챙김 완료';
    return `<article class="history-entry" data-kind="${entry.kind}"><div><h4>${label} · ${escapeHTML(entry.eventTitle || EVENT_TYPES[entry.eventType] || '기억할 날')}</h4><time datetime="${escapeHTML(entry.createdAt)}">${escapeHTML(date)}</time></div>${entry.kind === 'copied' ? `<p class="history-text">${escapeHTML(entry.text)}</p><p class="helper">복사 기록이에요. 실제 전달 여부는 챙김 완료 기록으로 구분해요.</p>` : `<p>${entry.action === 'remembered' ? '연락 대신 기억하는 마음을 남겼어요.' : '직접 챙겼다고 표시한 기록이에요.'}</p>`}</article>`;
  }).join('') : '<div class="history-empty"><img src="assets/sticker-envelope.webp" alt=""><p>처음 전할 마음부터<br>여기에 차곡차곡 남겨요.</p><p class="helper">복사한 문구와 실제로 챙긴 날을 구분해서 기억해요.</p></div>');
  const chosen = $('care-log-event').value;
  $('care-log-event').innerHTML = '<option value="">일정과 관계없는 기록</option>' + state.events.filter(item => item.personId === selectedId).map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)}</option>`).join('');
  if ([...$('care-log-event').options].some(item => item.value === chosen)) $('care-log-event').value = chosen;
  renderMemoryCardItems(); renderFollowups();
  $('care-log-date').max = today(); if (!$('care-log-date').value) $('care-log-date').value = today();
}
function renderPreparation(force = false) {
  const event = state.events.find(item => item.id === $('draft-event').value), who = person();
  if (!who) return;
  const memorySelection=selectedMemory(), { carePlan: _plan, ...eventFacts } = event||{};
  const key = JSON.stringify([authEpoch, who.id, who.name, eventFacts, today(),memorySelection]);
  if (key !== preparationKey) { preparationKey = key; preparationInputs = { attendance: 'undecided', timeMinutes: null, budgetWon: event?.carePlan?.amountWon ?? null }; preparationLogId = null; preparationLogError = ''; $('preparation-log-status').textContent = ''; force = true; }
  if (!force) { recordVisiblePreparation(); return; }
  const result = prepareCare({ state, personId: who.id, eventId: event?.id||'', ...preparationInputs, memorySelection, now: new Date() });
  preparationResult = result;
  renderMemoryApplication(result);
  const questions = result.question ? [result.question] : result.questions || [];
  $('preparation-questions').innerHTML = questions.map(question => `<label>${escapeHTML(question.label)}<select data-preparation-field="${escapeHTML(question.field)}"><option value="">선택해 주세요</option>${question.options.map((item,index) => `<option value="${index}">${escapeHTML(item.label)}</option>`).join('')}</select>${question.field === 'budgetWon' ? '<input id="preparation-budget" type="number" min="0" max="1000000000" step="1" inputmode="numeric" placeholder="또는 내 예산 직접 입력 · 원">' : ''}</label>`).join('');
  $('prepare-form').hidden = questions.length === 0;
  const cards = [result.recommendation, ...(result.alternatives || [])].filter(Boolean);
  const card = (item, index) => `<article class="preparation-card"><span class="mini-label">${index ? '다른 방법' : '지금 할 수 있는 준비'}</span><h4>${escapeHTML(item.title)}</h4><p class="helper">준비에 쓸 시간 ${item.timeMinutes}분${item.amountWon != null ? ` · 직접 정한 예산 ${won(item.amountWon)}` : ''}</p><ol>${item.steps.map(line=>`<li>${escapeHTML(line)}</li>`).join('')}</ol><button type="button" class="soft-button" data-use-preparation="${index}">이 준비로 기억</button><details class="preparation-reasons"><summary>왜 이 준비인가요?</summary><ul>${item.reason.map(line=>`<li>${escapeHTML(line)}</li>`).join('')}</ul></details></article>`;
  $('preparation-result').innerHTML = result.status === 'needs-input' ? '<p class="helper">준비에 필요한 한 가지만 먼저 확인할게요.</p>' : card(cards[0], 0) + (cards.length > 1 ? `<details class="preparation-alternatives"><summary>다른 준비 방법 ${cards.length - 1}가지</summary>${cards.slice(1).map((item, index) => card(item, index + 1)).join('')}</details>` : '') + '<p class="helper">내가 입력한 상황을 바탕으로 준비해요. 실제 이동 시간이나 참석 가능 여부를 대신 판단하지 않아요.</p>';
  if (preparationInputs.timeMinutes !== null) $('preparation-result').insertAdjacentHTML('beforeend', '<button type="button" class="text-button" data-reset-preparation>조건 다시 정하기</button>');
  recordVisiblePreparation();
}
function renderPreparationSummary() {
  const summary=preparationSummary(state); $('preparation-summary').hidden=!summary.shown && !summary.excludedFuture; $('preparation-summary').textContent=`최근 준비 ${state.preparations.length}건 중 직접 고른 준비 ${summary.selected}개${summary.rated ? ` · 내 평가 ${Number(summary.averageSatisfaction.toFixed(1))}/5 (${summary.rated}번 응답)` : ' · 아직 남긴 평가는 없어요'}${summary.excludedFuture ? ` · 시간 확인이 필요한 기록 ${summary.excludedFuture}개` : ''} · 최근 500건까지 보관`;
}
function recordVisiblePreparation() {
  if (activeView !== 'person' || activeTab !== 'message' || $('panel-message').hidden || preparationResult?.status !== 'ready' || !preparationResult.recommendation || preparationLogId || preparationLogError) return;
  try { state = recordPreparation(state, {personId:selectedId,eventId:$('draft-event').value,recommendedAction:preparationResult.recommendation.action}); preparationLogId = state.preparations.at(-1).id; save(); renderPreparationSummary(); }
  catch (error) { preparationLogError = state.preparations.length >= 500 ? '준비 통계 보관 한도 500개에 도달했어요. 이번 계획은 그대로 사용할 수 있어요.' : '준비 통계를 남기지 못했어요. 이번 계획은 그대로 사용할 수 있어요.'; $('preparation-log-status').textContent = preparationLogError; }
}
function followupCard(item) {
  const who = state.people.find(row => row.id === item.personId), date = item.dueOn;
  return `<article class="followup-card" data-followup="${escapeHTML(item.id)}"><div><span class="mini-label">${date < today() ? '지난 챙김' : date === today() ? '오늘' : escapeHTML(date)}</span><h4>${escapeHTML(who?.name || '')} · ${escapeHTML(item.title)}</h4>${item.sourceQuote ? `<details><summary>기억한 근거</summary><p class="helper">${escapeHTML(item.sourceQuote)}</p></details>` : ''}</div><div class="action-row"><button class="soft-button" type="button" data-followup-now="${escapeHTML(item.id)}">지금 챙기기</button><button class="text-button" type="button" data-followup-later="${escapeHTML(item.id)}">다음에</button>${date>=today()?`<button class="text-button" type="button" data-followup-calendar="${escapeHTML(item.id)}">내 달력에 저장</button>`:''}<button class="text-button" type="button" data-followup-done="${escapeHTML(item.id)}">직접 챙겼어요</button><button class="text-button" type="button" data-followup-stop="${escapeHTML(item.id)}">이제 그만</button></div><form class="followup-delay" data-followup-delay="${escapeHTML(item.id)}" hidden><label>다시 챙길 날<input type="date" min="${today()}" required></label><button type="submit" class="soft-button">이날로 기억</button></form></article>`;
}
function renderFollowups() {
  const pending = followupRows(state, {today:today()}).pending;
  const due = pending.filter(item => item.dueOn <= today());
  $('followup-home').hidden = due.length === 0; $('followup-list').innerHTML = due.map(followupCard).join('');
  const personal = pending.filter(item => item.personId === selectedId);
  $('person-followups').innerHTML = personal.length ? personal.map(followupCard).join('') : '<p class="helper">다음에 전할 안부가 떠오르면, 내가 편한 날로 남겨 보세요.</p>';
  $('followup-date').min = today();
}
async function followupAction(event) {
  const button = event.target.closest('button'); if (!button) return;
  const field = ['followupNow','followupLater','followupDone','followupStop','followupCalendar'].find(key=>button.dataset[key]); if (!field) return;
  const id = button.dataset[field], item = state.followups.find(row=>row.id===id), epoch=authEpoch; if (!item) return;
  if (field === 'followupLater') { button.closest('.followup-card').querySelector('form').hidden = false; return; }
  if (field === 'followupCalendar') { followupCalendar={id,epoch,fingerprint:JSON.stringify(item)}; $('followup-calendar-form').reset(); $('followup-calendar-alarm').disabled=true; $('followup-calendar-title').textContent=`${item.dueOn} · ${state.people.find(row=>row.id===item.personId)?.name||''} · ${item.title}`; $('followup-calendar-dialog').showModal(); return; }
  if (field === 'followupNow') { await beginFollowup(id);return; }
  if (field === 'followupStop' && !await confirmDelete('이 후속 챙김을 더 이상 표시하지 않을까요? 남겨 둔 일정과 기억은 유지해요.','후속 챙김 멈추기','이제 그만')) return;
  if (epoch !== authEpoch) return;
  const decision=planFollowupAction(item,{action:field==='followupDone'?'done':'dismiss',today:today()}); state=updateFollowup(state,id,decision.patch); save();renderSummary();renderFollowups();renderHistory();renderBrief();renderCareFocus(); notify(field==='followupDone'?'직접 챙긴 마음을 표시했어요.':'이 후속 챙김은 이제 보여드리지 않아요.');
}
function invalidateMessageReview() {
  expressionReview = null; preferenceCandidates = []; preferenceContext = null;
  $('message-review').textContent = '문구가 바뀌었어요. 보내기 전에 다시 점검해 주세요.';
  $('draft-preference-review').hidden = true; $('draft-preference-review').replaceChildren();
}
function checkMessage() {
  const who = person(), event = state.events.find(item => item.id === $('draft-event').value), text = $('draft-text').value.trim();
  if (!who || !text) throw Error('먼저 전할 문구를 적어 주세요.');
  const result = reviewMessage({ text, person: who, event, people: state.people, today: today() });
  expressionReview = { result, text, personId: who.id, epoch: authEpoch };
  $('message-review').innerHTML = `<p>${escapeHTML(result.summary)}</p>${result.issues.map(item => `<article class="message-issue"><h5>${escapeHTML(item.label)}</h5><p>${escapeHTML(item.message)}</p>${item.evidence?.quote ? `<blockquote>“${escapeHTML(item.evidence.quote)}”</blockquote>` : ''}${item.alternative ? `<p class="helper">다르게 전하려면 · ${escapeHTML(item.alternative)}</p>` : ''}</article>`).join('')}<details><summary>어디까지 확인했나요?</summary>${result.limits.map(line => `<p class="helper">${escapeHTML(line)}</p>`).join('')}</details>`;
  preferenceCandidates = currentDraft ? compareDraftEdits({ before: currentDraft.originalText, after: text }) : [];
  preferenceContext = { text, personId: who.id, epoch: authEpoch };
  $('draft-preference-review').hidden = preferenceCandidates.length === 0;
  $('draft-preference-review').innerHTML = `<h4>내가 고친 표현, 다음에도 기억할까요?</h4><p class="helper">이번 수정만으로 취향을 단정하지 않아요. 이 사람의 표현 설정으로 확인해 적용할 때만 기억해요.</p>${preferenceCandidates.map((item, index) => `<article><strong>${escapeHTML(item.label)}</strong><p class="helper">${escapeHTML(item.reason)}</p><button type="button" class="soft-button" data-remember-preference="${index}">확인한 표현으로 기억</button></article>`).join('')}`;
  return result;
}
function releaseMemoryCard() {
  cardGeneration++; if (cardURL) URL.revokeObjectURL(cardURL); cardURL = null; cardFilename = '';
  $('memory-card-preview').removeAttribute('src'); if ($('memory-card-dialog').open) $('memory-card-dialog').close();
}
function resetMemoryCard() {
  releaseMemoryCard(); cardItemsKey = ''; $('memory-card-title').value = ''; $('memory-card-message').value = ''; $('memory-card-photo').value = ''; $('memory-card-status').textContent = ''; $('memory-card-builder').open = false; $('preview-memory-card').disabled = false;
}
function renderMemoryCardItems() {
  const items = [...(state.memories || []).filter(item => item.personId === selectedId).map(item => ({ ...item, cardKind: 'memory', label: '기억', excerpt: item.text })), ...(state.activities || []).filter(item => item.personId === selectedId && item.note?.trim()).map(item => ({ ...item, cardKind: 'activity', label: `${item.occurredOn} · ${ACTIONS[item.kind]}`, excerpt: item.note || ACTIONS[item.kind] }))];
  const key = JSON.stringify([selectedId, items]); if (key === cardItemsKey) return;
  if (cardItemsKey) { releaseMemoryCard(); $('preview-memory-card').disabled = false; $('memory-card-status').textContent = '기록이 바뀌었어요. 카드에 담을 내용을 다시 골라 주세요.'; }
  cardItemsKey = key;
  $('memory-card-items').innerHTML = items.length ? items.map(item => `<div class="memory-card-option" data-card-id="${escapeHTML(item.id)}" data-card-kind="${item.cardKind}"><label class="check-label"><input type="checkbox" data-card-selected><span>${escapeHTML(item.label)}</span></label><textarea data-card-excerpt maxlength="240" rows="2" aria-label="카드에 담을 발췌문">${escapeHTML(item.excerpt.slice(0, 240))}</textarea>${item.excerpt.length > 240 ? '<p class="helper">긴 기록의 앞부분이에요. 카드에 담을 240자 이내 발췌문을 직접 확인해 주세요.</p>' : ''}</div>`).join('') : '<p class="helper">함께한 기억이나 직접 챙긴 기록을 먼저 남겨 주세요. 기록을 하나 남긴 뒤 카드로 담아 보세요.</p>';
}
async function previewMemoryCard() {
  const who = person(); if (!who) throw Error('먼저 사람을 골라 주세요.');
  const chosen = [...document.querySelectorAll('[data-card-selected]:checked')].map(input => input.closest('[data-card-id]'));
  if (chosen.length > 3) throw Error('카드에는 기억과 챙김 기록을 합해 3개까지 담을 수 있어요.');
  const memories = [], activities = [];
  for (const item of chosen) {
    const value = (item.dataset.cardKind === 'memory' ? state.memories : state.activities).find(row => row.id === item.dataset.cardId && row.personId === who.id);
    if (!value) throw Error('선택한 기록이 바뀌었어요. 다시 골라 주세요.');
    const excerpt = item.querySelector('[data-card-excerpt]').value.trim();
    if (!excerpt) throw Error('카드에 담을 발췌문을 적어 주세요.');
    if (item.dataset.cardKind === 'memory') memories.push({ ...value, text: excerpt }); else activities.push({ ...value, note: excerpt });
  }
  const file = $('memory-card-photo').files[0]; if (file && file.size > 10 * 1024 * 1024) throw Error('카드 사진은 10MiB 이내로 골라 주세요.');
  const epoch = authEpoch, owner = who.id, version = ++cardGeneration;
  $('preview-memory-card').disabled = true; $('memory-card-status').textContent = '선택한 기억으로 한 장을 만들고 있어요.';
  try {
    const result = await createMemoryCard({ person: who, memories, activities, title: $('memory-card-title').value, message: $('memory-card-message').value, photoFile: file });
    if (epoch !== authEpoch || owner !== selectedId || version !== cardGeneration) return;
    if (cardURL) URL.revokeObjectURL(cardURL); cardURL = URL.createObjectURL(result.blob); cardFilename = result.filename;
    $('memory-card-preview').src = cardURL; $('memory-card-dialog').showModal(); $('memory-card-status').textContent = '선택한 내용만 담았어요. 카드에서 이름과 문구를 확인해 주세요.';
  } catch (error) { if (epoch === authEpoch && owner === selectedId && version === cardGeneration) { $('memory-card-status').textContent = error.message; throw error; } }
  finally { if (epoch === authEpoch && owner === selectedId && version === cardGeneration) $('preview-memory-card').disabled = false; }
}
function renderBrief() {
  renderMemoryPicker();
  renderPreparation();
  const who = person(), event = state.events.find(item => item.id === $('draft-event').value);
  if (!who || notebookView().concealNotebook) { $('care-brief').hidden = true;$('care-brief').replaceChildren();return; }
  const chosen=currentFollowupContext(), context=buildCareContext(state,{personId:who.id,today:today(),eventType:event?.type||'checkin',followupId:chosen?.id||''});
  const {lastCare,memories,exchanges,previousDraft:previous}=context, plan=event?.carePlan;
  const excerpt=text=>text.length>160?`<p>${escapeHTML(text.slice(0,160))}…</p><details><summary>이야기 전체 보기</summary><p class="context-text">${escapeHTML(text)}</p></details>`:`<p class="context-text">${escapeHTML(text)}</p>`;
  const evidence=item=>item.sourceQuote?`<details><summary>남겨 둔 근거 보기</summary><p class="context-meta">${escapeHTML(item.sourceTitle)}</p><blockquote>${escapeHTML(item.sourceQuote)}</blockquote></details>`:'';
  const last=lastCare?`<div class="context-last"><span class="context-label">최근 챙김 기록</span><p class="context-meta">${lastCare.sourceKind==='completion'?'완료로 표시한 날 · ':''}${escapeHTML(lastCare.date)} · ${escapeHTML(lastCare.label)}</p>${excerpt(lastCare.note||lastCare.title||lastCare.eventTitle||'이날 나눈 마음을 기록했어요.')}</div>`:'<p class="helper">아직 실제로 챙긴 기록이 없어요. 안부를 전한 뒤 첫 기록을 남겨 보세요.</p>';
  const selected=chosen?`<section class="context-selected" aria-label="지금 챙길 내용"><span class="context-label">지금 챙길 내용</span><h4>${escapeHTML(chosen.title)}</h4><p class="context-meta">내가 정한 날 · ${escapeHTML(chosen.dueOn)}${chosen.phase==='overdue'?' · 날짜가 지난 챙김':''}</p>${evidence(chosen)}<p class="helper">이 내용을 보며 아래 문구를 다듬어 주세요. 복사해도 완료되지 않아요. 실제로 챙긴 뒤 ‘이 챙김 완료’를 눌러 주세요.</p><button type="button" class="text-button" data-context-clear>이 챙김과 연결 해제</button></section>`:'';
  const pending=context.followups.filter(item=>item.id!==chosen?.id);
  const pendingHTML=pending.length?`<details class="context-more"><summary>다음에 챙기기로 한 일 · ${pending.length}</summary>${pending.map(item=>`<article class="context-item"><p class="context-meta">${escapeHTML(item.dueOn)} · ${item.phase==='today'?'오늘':item.phase==='overdue'?'날짜가 지난 챙김':'다가오는 챙김'}</p><p>${escapeHTML(item.title)}</p>${evidence(item)}<button class="soft-button" type="button" data-context-followup="${escapeHTML(item.id)}">이 일로 안부 준비</button></article>`).join('')}</details>`:'';
  const memoryHTML=memories.length?`<details class="context-more"><summary>함께 기억할 이야기 · ${memories.length}</summary>${memories.map(item=>`<article class="context-item"><p class="context-meta">${escapeHTML(item.date)}에 남긴 ${escapeHTML(item.label)}</p>${excerpt(item.text)}${evidence(item)}<button type="button" class="soft-button" data-context-memory="${escapeHTML(item.id)}">이 기억을 문구에 담기</button></article>`).join('')}</details>`:'';
  const exchangeHTML=exchanges.length?`<details class="context-more"><summary>지난 선물과 경조금</summary>${exchanges.map(item=>`<article class="context-item"><p class="context-meta">${escapeHTML(item.date)} · ${escapeHTML(item.label)}${item.amountWon!=null?` · ${escapeHTML(won(item.amountWon))}`:''}</p>${item.note?excerpt(item.note):''}</article>`).join('')}</details>`:'';
  $('care-brief').hidden = false;
  $('care-brief').innerHTML = `<h3>연락 전에, 우리 이야기</h3>${selected}${last}${pendingHTML}${memoryHTML}${exchangeHTML}${plan?`<details class="context-more"><summary>이번에 세운 계획</summary><p>${escapeHTML(ACTIONS[plan.action]||'연락')}${plan.amountWon!=null?` · 준비 예산 ${escapeHTML(won(plan.amountWon))}`:''}</p>${plan.note?excerpt(plan.note):''}</details>`:''}${previous?`<details class="context-more"><summary>지난번 복사한 문구</summary><p class="context-text">${escapeHTML(previous.text)}</p><p class="helper">${escapeHTML(previous.date)}에 복사했어요. 실제로 전한 기록과는 구분해요.</p></details>`:''}<button type="button" class="text-button" data-brief-history>우리의 기록 모두 보기</button>`;
  updateMood();
}
function scheduleCard(row) {
  const { event, person: who, occurrence, status } = row;
  return `<article class="home-card"><div class="home-card-copy"><span class="home-badge">${status === 'completed' ? '챙김 기록 있음' : status === 'overdue' ? '기록할 마음' : eventDistance(row)}</span><h3>${escapeHTML(who.name)} · ${escapeHTML(event.title)}</h3><p>${escapeHTML(occurrence.date)} ${escapeHTML(event.time)}${event.calendar === 'lunar' ? ' · 음력에서 변환' : ''}</p>${event.location ? `<p>${escapeHTML(event.location)}</p>` : ''}</div><div class="home-card-actions">${status === 'upcoming' ? `<button type="button" class="soft-button" data-home-draft="${escapeHTML(event.id)}">인사 준비하기</button>` : ''}<button type="button" class="text-button" data-log-event="${escapeHTML(event.id)}" data-log-date="${escapeHTML(occurrence.date)}">${status === 'completed' ? '기록 보기' : '챙긴 마음 남기기'}</button></div></article>`;
}
function renderSchedule() {
  const mode = $('schedule-view').value;
  for (const item of ['upcoming', 'calendar', 'overdue']) $(`schedule-${item}`).hidden = item !== mode;
  if (mode === 'calendar') {
    calendarMonth ||= today().slice(0, 7); calendarDay ||= today();
    const calendar = monthCalendar(state, calendarMonth);
    $('calendar-label').textContent = calendar.label;
    $('calendar-grid').innerHTML = calendar.days.map(day => `<button type="button" class="calendar-day${day.inMonth ? '' : ' outside'}${day.today ? ' is-today' : ''}" data-calendar-date="${day.date}" aria-pressed="${day.date === calendarDay}" aria-label="${day.date}, 일정 ${day.rows.length}개"><span class="calendar-day-number">${day.day}</span>${day.rows.length ? `<span class="calendar-count">${day.rows.length}</span>` : ''}</button>`).join('');
    $('calendar-selected-title').textContent = `${calendarDay}의 마음`;
    const chosen = calendar.rows.filter(item => item.occurrence.date === calendarDay);
    $('calendar-day-events').innerHTML = chosen.length ? chosen.map(scheduleCard).join('') : '<p class="helper">이날 등록된 일정이 없어요.</p>';
  }
  if (mode === 'overdue') {
    const past = pastUnfinishedEvents(state);
    $('overdue-list').innerHTML = past.length ? past.map(scheduleCard).join('') : '<p class="helper">지난 1년에 기록을 기다리는 일정이 없어요.</p>';
  }
}
async function openCareLog(eventId, date) {
  const event = state.events.find(item => item.id === eventId); if (!event) return;
  if(!await choosePerson(event.personId, 'history'))return; $('care-log-event').value = eventId;
  $('care-log-date').value = date <= today() ? date : today();
  logOccurrence = date <= today() ? `${eventId}:${date}` : null;
  $('care-log-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderCapturePeople() {
  const previous = $('capture-person').value;
  $('capture-person').innerHTML = '<option value="">사람을 골라 주세요</option>' + state.people.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`).join('');
  if (state.people.some(item => item.id === previous)) $('capture-person').value = previous;
  else if (state.people.length === 1) $('capture-person').value = state.people[0].id;
}
function invalidateCapture() { captureReview = null; $('capture-results').textContent = ''; $('capture-save').hidden = true; }
function extractCapture() {
  const who = state.people.find(item => item.id === $('capture-person').value);
  if (!who) throw Error('먼저 사람을 등록하고 누구의 이야기인지 골라 주세요.');
  const text = $('capture-source').value.trim(); if (!text || text.length > 50000) throw Error('보관할 글을 50,000자 이내로 넣어 주세요.');
  const result = captureCandidates(text, { person: who }); result.followups = extractFollowupCandidates(text, { today: today() });
  captureReview = { ...result, text, personId: who.id, epoch: authEpoch };
  $('capture-results').innerHTML = `<p class="helper">일정 ${result.events.length}개 · 기억 ${result.memories.length}개를 찾았어요. 원문을 확인하고 필요한 항목만 선택해 주세요.</p>${result.warnings.map(item => `<p class="capture-caution">${escapeHTML(item)}</p>`).join('')}` + result.events.map((item, i) => `<article class="capture-candidate" data-capture-event="${i}"><label class="check-label"><input type="checkbox" data-capture-selected><strong>일정으로 기억하기</strong></label><div class="form-grid"><label>종류<select data-capture-field="type">${Object.entries(EVENT_TYPES).map(([key, label]) => `<option value="${key}"${key === item.type ? ' selected' : ''}>${label}</option>`).join('')}</select></label><label>날짜<input data-capture-field="date" value="${item.date}" maxlength="10"></label><label>달력<select data-capture-field="calendar"><option value="solar"${item.calendar === 'solar' ? ' selected' : ''}>양력</option><option value="lunar"${item.calendar === 'lunar' ? ' selected' : ''}>음력 평달</option></select></label><label class="check-label"><input type="checkbox" data-capture-leap${item.lunarLeapMonth ? ' checked' : ''}>음력 윤달</label><label>시간<input type="time" data-capture-field="time" value="${escapeHTML(item.time)}"></label><label>일정 이름<input data-capture-field="title" maxlength="120" value="${escapeHTML(item.title)}"></label><label>장소<input data-capture-field="location" maxlength="300" value="${escapeHTML(item.location)}"></label></div><blockquote class="capture-source-quote">${escapeHTML(item.sourceQuote)}</blockquote>${item.cautions.map(line => `<p class="capture-caution">${escapeHTML(line)}</p>`).join('')}</article>`).join('') + result.memories.map((item, i) => `<article class="capture-candidate" data-capture-memory="${i}"><label class="check-label"><input type="checkbox" data-capture-selected><strong>다음에 기억하기</strong></label><textarea aria-label="기억할 내용" maxlength="2000" data-capture-memory-text>${escapeHTML(item.text)}</textarea><blockquote class="capture-source-quote">${escapeHTML(item.sourceQuote)}</blockquote></article>`).join('') + '<label>직접 남길 기억 <span class="optional">선택 · 이 원문에서 기억할 내용</span><textarea id="capture-manual-memory" rows="2" maxlength="2000" placeholder="예: 다음 선물은 좋아하는 차로 준비하기"></textarea></label><p class="helper">항목을 선택하지 않아도 이 원문을 수첩에 보관할 수 있어요.</p>';
  $('capture-results').insertAdjacentHTML('beforeend', result.followups.map((item,index)=>`<article class="capture-candidate" data-capture-followup="${index}"><label class="check-label"><input type="checkbox" data-capture-selected><strong>다음에 다시 챙기기</strong></label><label>챙길 내용<input data-followup-title maxlength="120" value="${escapeHTML(item.title)}"></label><label>직접 확인한 날짜<input type="date" data-followup-date value="${escapeHTML(item.dueOn || '')}" min="${today()}"></label><blockquote>${escapeHTML(item.sourceQuote)}</blockquote><p class="helper">${item.cautions.map(escapeHTML).join(' ') || '날짜와 해야 할 일을 직접 확인하고 선택해 주세요.'}</p></article>`).join(''));
  $('capture-save').hidden = false;
}
async function saveCapture() {
  const review = captureReview;
  if (!review || review.epoch !== authEpoch || review.personId !== $('capture-person').value || review.text !== $('capture-source').value.trim()) throw Error('원문이 바뀌었어요. 다시 정리해 주세요.');
  const events = [...document.querySelectorAll('[data-capture-event]')].filter(el => el.querySelector('[data-capture-selected]').checked).map(el => ({ ...Object.fromEntries([...el.querySelectorAll('[data-capture-field]')].map(input => [input.dataset.captureField, input.value])), lunarLeapMonth: el.querySelector('[data-capture-leap]').checked }));
  const memories = [...document.querySelectorAll('[data-capture-memory]')].filter(el => el.querySelector('[data-capture-selected]').checked).map(el => ({ ...review.memories[Number(el.dataset.captureMemory)], text: el.querySelector('[data-capture-memory-text]').value }));
  const manual = $('capture-manual-memory')?.value.trim();
  if (manual) memories.push({ text: manual, kind: 'memory', sourceQuote: review.text.slice(0, 5000) });
  let nextState = captureSource(state, { personId: review.personId, title: $('capture-title').value.trim() || `${state.people.find(item => item.id === review.personId).name}의 이야기`, kind: $('capture-source-kind').value, text: review.text, events, memories });
  const sourceId = nextState.sources.at(-1).id;
  for (const el of document.querySelectorAll('[data-capture-followup]')) if (el.querySelector('[data-capture-selected]').checked) { const candidate = review.followups[Number(el.dataset.captureFollowup)]; nextState = addFollowup(nextState, {personId:review.personId,title:el.querySelector('[data-followup-title]').value,dueOn:el.querySelector('[data-followup-date]').value,sourceId,sourceQuote:candidate.sourceQuote}); }
  state = nextState;
  save(); $('capture-source').value = ''; $('capture-title').value = ''; invalidateCapture(); render();
  await choosePerson(review.personId, events.length ? 'events' : 'history');
  notify(`일정 ${events.length}개와 기억 ${memories.length}개, 원문을 함께 보관했어요. 다음 마음을 준비할 때 다시 꺼내 볼 수 있어요.`);
}
function replaceState(next) {
  personDialogContext = null; $('person-dialog').close(); $('person-form').reset();
  followupContext = null;
  focusKey = ''; focusEpoch = authEpoch;focusOperation = null;
  resetPersonalMemory(); checkinMode=false; followupCalendar=null; $('followup-calendar-dialog').close();
  resetMemoryCard(); $('followup-form').reset(); preparationKey = '';
  state = importBackup(next || emptyState()); selectedId = null; activeView = 'home'; sampleMode = false;
  conversations.clear(); sessionDrafts.clear(); notified.clear(); logOccurrence = null; invalidateCapture();
  $('capture-source').value = ''; $('capture-title').value = ''; $('care-log-form').reset();
  clearAudio(); clearConversationFields(); resetDraft(); resetEventForm(); render();
}
function renderAccount() {
  const connected = !!accountId;
  const presentation = notebookView(), main = document.querySelector('.main-grid');
  const local = syncStatus.localRecords || { count: 0, pending: 0, corrupt: 0 };
  $('account-signin').hidden = connected; $('account-signin').disabled = presentation.signInDisabled;
  $('account-signin').textContent = presentation.signInLabel;
  $('account-signout').hidden = !connected && !accountStatus.signedIn;
  $('account-refresh').hidden = !connected;
  $('account-refresh').disabled = !presentation.canRetryNotebook;
  $('account-refresh').textContent = presentation.concealNotebook && !presentation.loading ? '계정 자료 다시 불러오기' : '계정 자료 새로고침';
  $('account-import-device').hidden = !connected || !guestSnapshot?.state.people.length;
  $('account-import-device').disabled = !presentation.canImportDevice;
  $('account-conflict').hidden = !connected || !['conflict','local-conflict'].includes(syncStatus.status);
  $('account-conflict-retry').hidden = syncStatus.status === 'local-conflict';
  main.inert = presentation.locked; main.hidden = presentation.concealNotebook;
  $('main-content').setAttribute('aria-busy', String(presentation.loading));
  $('account-panel').dataset.kind = presentation.kind;
  $('notebook-loading').hidden = !presentation.concealNotebook;
  $('notebook-loading-title').textContent = presentation.title;
  $('notebook-loading-detail').textContent = presentation.detail;
  const labels = { loading: '내 수첩을 불러오고 있어요', synced: 'SYNK 계정에 저장했어요', saving: '계정에 저장하고 있어요', offline: '연결을 기다리는 변경이 있어요', conflict: '다른 기기의 변경과 확인이 필요해요', 'local-conflict': '이 기기의 미저장 수첩을 골라 주세요', 'storage-error': '이 기기에 변경을 보관하지 못했어요', error: '계정 수첩 연결을 확인해 주세요' };
  $('account-status').textContent = presentation.locked ? presentation.title : connected ? labels[syncStatus.status] || '내 SYNK 계정에 연결됨' : presentation.title;
  $('account-detail').textContent = presentation.locked ? presentation.detail : connected ? syncStatus.error?.message || (typeof syncStatus.error === 'string' ? syncStatus.error : '') || (syncStatus.pending ? '현재 변경은 이 기기에 대기 중이에요. 다시 연결되면 저장해요.' : '보관한 원문·사람·일정·주고받은 기록을 같은 계정에서 꺼내 볼 수 있어요.') : presentation.detail;
  if (!connected && syncStatus.error && !presentation.concealNotebook) $('account-detail').textContent = syncStatus.error.message;
  const localNoticeCode = syncStatus.warning?.code || (local.corrupt ? 'INVALID_LOCAL_CACHE' : null);
  $('account-local-note').hidden = !local.count && !local.unknown && !syncStatus.warning || !local.unknown && !!localNoticeCode && syncStatus.error?.code === localNoticeCode;
  $('account-local-note').textContent = (syncStatus.warning?.message || (local.corrupt ? '읽지 못한 이 계정의 임시기록 원본을 보존했어요. 복구 파일로 내보낸 뒤 직접 지울 수 있어요.' : connected ? '계정에 보내지 못한 변경만 이 기기에 임시 보관해요. 저장이 끝나면 기기 사본을 지워요.' : `미저장 계정 임시기록 ${local.count}개가 이 기기에 남아 있어요. 기록을 남긴 계정으로 로그인하면 이어 사용할 수첩을 고르거나 복구 파일로 내보내고 지울 수 있어요.`)) + (local.unknown ? ' 계정을 확인할 수 없는 손상 원본은 그대로 보존하며 이 화면에서 내보내거나 지우지 않아요.' : '');
  $('account-export-local').hidden = !connected || !local.exportable;
  $('account-clear-local').hidden = !connected || !local.exportable;
  $('account-clear-local').disabled = syncStatus.pending || ['loading','saving'].includes(syncStatus.status);
  const choices = $('account-local-drafts'); choices.hidden = !connected || !(syncStatus.localDrafts?.length > 0 || syncStatus.status === 'local-conflict'); choices.replaceChildren();
  if (!choices.hidden) {
    const note = document.createElement('p'); note.className = 'helper'; note.textContent = '여러 탭이나 이전 사용의 미저장 수첩이 있어요. 열 기록을 골라 주세요. 선택하지 않은 기록은 보존돼요.'; choices.append(note);
    for (const [index, draft] of (syncStatus.localDrafts || []).entries()) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'soft-button'; button.dataset.localDraft = draft.id;
      const created = draft.createdAt && !Number.isNaN(Date.parse(draft.createdAt)) ? new Date(draft.createdAt).toLocaleString('ko-KR') : '작성 시각을 모르는 이전 기록';
      button.textContent = `기록 ${index + 1} · ${created} 열기`; button.disabled = syncStatus.status === 'loading'; choices.append(button);
    }
  }
  renderSummary(); renderCareFocus();
}
async function handleAccountStatus(status) {
  accountStatus = status;
  // A token refresh is still the same account. Do not put its data into the guest notebook.
  if (accountId && status.status === 'restoring') { renderAccount(); return; }
  const nextId = status.signedIn ? status.accountId || status.account?.synk_user_id : null;
  const pushAccountId = carePushAccountIdentity(status, accountStarting);
  if (pushAccountId !== undefined) void carePush.setAccount(pushAccountId);
  if (nextId === accountId) { renderAccount(); return; }
  const hadAccount = !!accountId;
  const epoch = ++authEpoch;
  if (hadAccount) { accountId = null; sync.close(); }
  if (nextId) {
    if (!hadAccount) guestSnapshot = { state: importBackup(state), persist, selectedId, sampleMode };
    accountId = nextId; persist = false; replaceState(emptyState()); renderAccount();
    try { await sync.open(nextId); } catch (error) { if (epoch === authEpoch) notify(error.message || '계정 수첩을 불러오지 못했어요.'); }
  } else if (hadAccount) {
    const guest = guestSnapshot; guestSnapshot = null;
    replaceState(guest?.state || emptyState()); persist = guest?.persist === true; sampleMode = guest?.sampleMode === true; render();
  }
  renderAccount();
}
async function startAccount() {
  sync = createCareSync({ transport: (action, body) => account.request(action, body), storage: localStorage,
    onState: next => replaceState(next), onStatus: status => { syncStatus = status; renderAccount(); updateStorageLabel(); } });
  syncStatus.localRecords = sync.localRecords();
  if (syncStatus.localRecords.error) syncStatus.error = syncStatus.localRecords.error;
  account = createCareAccount({ ...(PUBLIC_WEB ? { configUrl: './config.json' } : {}), onStatus: status => { handleAccountStatus(status).catch(error => notify(error.message)); } });
  try { const status = await account.start(); if (status) await handleAccountStatus(status); }
  catch (error) { accountStatus = { ...accountStatus, status: 'error', error };notify(error.message || '로그인 연결을 확인하지 못했어요.'); }
  finally { accountStarting = false; renderAccount(); const pushAccountId = carePushAccountIdentity(accountStatus, false); if (pushAccountId !== undefined) void carePush.setAccount(pushAccountId); }
}
function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('[data-tab]').forEach(tab => { const selected = tab.dataset.tab === name; tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
  for (const tab of ['conversation', 'events', 'message', 'history']) $(`panel-${tab}`).hidden = tab !== name;
  if (name === 'message') { renderMessageOptions(); recordVisiblePreparation(); }
  if (name === 'history') renderHistory();
  updateMood();
}
function renderDraftNotice() {
  const draft = currentDraft;
  $('draft-notice').textContent = !draft ? '초안을 준비한 뒤 내 말로 다듬어 주세요.' : draft.needsComposition ? '피할 표현을 제외해 빈 초안이에요. 직접 작성해 주세요.' : draft.removedPhrases?.length ? '피할 표현이 들어간 문장을 뺐어요. 남은 문맥을 확인해 주세요.' : draft.method === 'saved' ? '직접 기억해 둔 내 문구예요. 지금 상황에 맞게 확인해 주세요.' : '문장 틀에 확인한 표현을 반영했어요. 내 말로 다듬어 주세요.';
  renderSavedDraft();
}
function renderSavedDraft() {
  const owner = person(), type = libraryType(), all = owner ? listSavedMessages(owner, { type }) : [];
  const items = libraryItems(), scoped = libraryContextItems(), filters = libraryFilterState(), select = $('saved-message-select');
  const scopeKey = JSON.stringify([authEpoch, selectedId, type, $('draft-intent').value, $('library-scope').value]);
  const previous = select.dataset.scopeKey === scopeKey ? select.value : currentDraft?.savedMessageId;
  select.dataset.scopeKey = scopeKey;
  select.innerHTML = '<option value="">보관한 문구를 골라 주세요</option>' + items.map(item => '<option value="' + escapeHTML(item.id) + '">' + escapeHTML((item.favorite ? '★ ' : '') + libraryLabel(item) + ' · ' + item.text.slice(0, 32) + (item.text.length > 32 ? '…' : '')) + '</option>').join('');
  select.value = items.some(item => item.id === previous) ? previous : items[0]?.id || '';
  select.disabled = !items.length;
  $('saved-draft-preview').hidden = !owner;
  $('library-scope-wrap').hidden = type !== 'checkin';
  $('library-title').textContent = '내 문구 보관함 · ' + all.length + '개';
  $('library-result-count').textContent = '이 범위의 ' + scoped.length + '개 중 ' + items.length + '개';
  $('library-reset').disabled = !$('library-search').value && !filters.favoritesOnly;
  $('library-empty').hidden = !!items.length;
  $('library-empty').textContent = !all.length ? '다듬은 문구를 기억하면 이곳에 쌓여요. 이전 문구도 다시 꺼낼 수 있어요.' : !scoped.length ? '이 목적에 보관한 문구가 없어요. 안부 전체에서 이전 문구도 찾아볼 수 있어요.' : filters.query && filters.favoritesOnly ? '즐겨찾기한 문구 중 검색어와 맞는 문구가 없어요. 검색어를 바꾸거나 필터를 초기화해 보세요.' : filters.query ? '검색어와 맞는 문구가 없어요. 다른 단어로 찾아보세요.' : '이 범위에 즐겨찾기한 문구가 없어요. 필터를 초기화하면 다른 문구도 볼 수 있어요.';
  const remembered = all.some(item => item.text === $('draft-text').value.trim() && (type !== 'checkin' || item.checkinIntent === $('draft-intent').value));
  $('draft-save-status').textContent = saveFailed ? '기기 저장에 실패해 이번 화면의 변경만 남아 있어요. 새로고침 전에 백업을 내보내 주세요.' : remembered ? '지금 문구를 보관하고 있어요. 복사나 연락 완료 기록은 별도예요.' : '';
  renderLibrarySelection();
}
function libraryType() { return state.events.find(item => item.id === $('draft-event').value)?.type || 'checkin'; }
function librarySearchText(value) { return String(value || '').normalize('NFC').trim().toLowerCase(); }
function libraryFilterState() {
  const search = $('library-search'), favorites = $('library-favorites-only');
  const contextKey = JSON.stringify([authEpoch, selectedId, libraryType(), $('draft-intent').value]);
  if (search.dataset.contextKey !== contextKey) {
    search.dataset.contextKey = contextKey;
    search.value = ''; favorites.checked = false;
  }
  return { query: librarySearchText(search.value.slice(0, 100)), favoritesOnly: favorites.checked };
}
function libraryContextItems() {
  if (!person()) return [];
  const type = libraryType();
  return listSavedMessages(person(), { type, ...(type === 'checkin' && $('library-scope').value !== 'type' ? { checkinIntent: $('draft-intent').value || 'everyday' } : {}) });
}
function libraryItems() {
  const { query, favoritesOnly } = libraryFilterState();
  return libraryContextItems().filter(item => (!favoritesOnly || item.favorite) && (!query || librarySearchText(item.text).includes(query)));
}
function libraryLabel(item) { return item.type === 'checkin' ? CHECKIN_INTENTS[item.checkinIntent] : EVENT_TYPES[item.type]; }
function renderLibrarySelection() {
  const item = libraryItems().find(row => row.id === $('saved-message-select').value);
  $('saved-draft-text').textContent = item?.text || '';
  $('library-meta').textContent = item ? libraryLabel(item) + ' · ' + new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.savedAt)) : '';
  $('library-actions').hidden = !item;
  $('favorite-saved-message').textContent = item?.favorite ? '즐겨찾기 해제' : '즐겨찾기';
  $('favorite-saved-message').setAttribute('aria-pressed', String(!!item?.favorite));
}
async function loadSavedMessage() {
  const item = libraryItems().find(row => row.id === $('saved-message-select').value);
  if (!item) throw Error('다시 꺼낼 문구를 골라 주세요.');
  const epoch = authEpoch, owner = selectedId, eventId = $('draft-event').value, draft = currentDraft, text = $('draft-text').value, fingerprint = JSON.stringify(item);
  if (text.trim() && text !== (draft?.originalText || '') && text.trim() !== item.text && !await confirmDelete('직접 다듬은 문구를 보관함의 문구로 바꿀까요? 남겨 두려면 취소한 뒤 먼저 문구를 기억해 주세요.', '이전 문구 불러오기', '이 문구로 준비')) return;
  if (epoch !== authEpoch || owner !== selectedId || eventId !== $('draft-event').value || draft !== currentDraft || text !== $('draft-text').value || notebookView().locked) return;
  if (JSON.stringify(libraryItems().find(row => row.id === item.id)) !== fingerprint) throw Error('보관한 문구가 바뀌었어요. 다시 골라 주세요.');
  if (item.type === 'checkin' && item.checkinIntent !== 'unspecified') $('draft-intent').value = item.checkinIntent;
  resetPersonalMemory(); $('draft-style').value = 'saved';
  generateDraft({ silent: true, savedMessageId: item.id }); stashDraft();
  notify('이전 문구로 다시 준비했어요. 피할 표현을 확인했고, 복사하거나 보내지는 않았어요.');
}
async function deleteSavedMessage() {
  const item = libraryItems().find(row => row.id === $('saved-message-select').value);
  if (!item) throw Error('삭제할 문구를 골라 주세요.');
  const epoch = authEpoch, owner = selectedId, fingerprint = JSON.stringify(item);
  if (!await confirmDelete('이 문구 한 개를 보관함에서 지울까요? 다른 문구와 작성 중인 초안은 남아요. 삭제한 문구는 되돌릴 수 없어요.', '보관한 문구 삭제', '문구 삭제')) return;
  if (epoch !== authEpoch || owner !== selectedId || notebookView().locked) return;
  if (JSON.stringify(listSavedMessages(person()).find(row => row.id === item.id)) !== fingerprint) throw Error('문구가 바뀌었어요. 다시 확인해 주세요.');
  state = removeSavedMessage(state, { personId: owner, messageId: item.id });
  const saved = save(); renderSavedDraft(); renderHistory(); if (saved) notify('선택한 문구만 보관함에서 지웠어요. 작성 중인 초안은 그대로예요.');
}
function resetDraft({ preserveIntent = false } = {}) { invalidateMessageReview(); currentDraft = null; $('draft-text').value = ''; if (!preserveIntent) $('draft-intent').value = 'everyday'; $('draft-confirm').checked = false; $('remember-draft').checked = false; $('draft-basis').textContent = '직접 확인한 표현과 상황별 문장 틀로 준비해요.'; renderDraftNotice(); }
function clearAudio() {
  if (audioURL) URL.revokeObjectURL(audioURL);
  audioURL = null; audioFile = null; $('audio-file').value = ''; $('audio-player').removeAttribute('src'); $('audio-player').load(); $('audio-detail').hidden = true; $('transcript-wrap').hidden = true; $('transcript-text').value = ''; $('audio-consent').checked = false;
}
async function choosePerson(id, tab = 'events') {
  const epoch = authEpoch;
  if (notebookView().locked) return false;
  if (id !== selectedId && hasPersonalizationInput() && !await confirmDelete('지금 고른 기억과 아직 보관하지 않은 안부 초안이 있어요. 다른 사람을 열면 이 선택을 해제해요. 필요한 문구를 먼저 복사해 주세요.', '다른 사람의 수첩', '다른 사람 열기')) return false;
  if (epoch !== authEpoch || notebookView().locked || id && !state.people.some(item => item.id === id)) return false;
  if (id !== selectedId) { followupContext=null;resetPersonalMemory(); checkinMode=false; resetMemoryCard(); $('followup-form').reset(); $('care-log-form').reset(); logOccurrence = null; }
  stashConversation(); stashDraft(); selectedId = id; activeView = id ? 'person' : 'home'; resetDraft(); resetEventForm(); clearAudio(); $('text-file').value = ''; render(true); restoreDraft(); switchTab(tab); save();
  return true;
}
function openPersonDialog(edit = false) {
  const target = edit ? person() : null;
  personDialogContext = { epoch: authEpoch, id: target?.id ?? '', fingerprint: target ? JSON.stringify(target) : null };
  $('person-form').reset(); $('person-edit-id').value = target?.id ?? '';
  $('person-dialog-title').textContent = edit ? '챙길 사람 수정' : '챙길 사람 추가';
  $('new-person-name').value = target?.name ?? ''; $('new-person-relationship').value = target?.relationship ?? ''; $('new-person-notes').value = target?.notes ?? '';
  $('new-person-group').value = target?.group || 'other';
  $('person-details').open = !!target;
  $('person-start-hint').hidden = !!target;
  $('quick-event-fields').open = false;
  const interval = target?.checkinIntervalDays ?? 30;
  $('new-person-checkin').value = [0, 7, 14, 30, 60, 90].includes(interval) ? String(interval) : 'custom';
  $('new-person-checkin-days').value = String(interval || 30);
  updateCheckinInput();
  $('quick-event-fields').hidden = !!target;
  updatePersonSubmit();
  $('delete-person').hidden = !target; $('person-dialog').showModal();
}
function updatePersonSubmit() {
  $('person-submit').textContent = $('person-edit-id').value ? '수정 내용 저장' : $('quick-event-date').value ? '기억하고 마음 준비' : '기억하고 첫 안부 준비';
}
function revealPersonInvalidField(event) {
  for (const id of ['person-details', 'quick-event-fields']) if ($(id).contains(event.target)) $(id).open = true;
}
function checkinSummary(target) {
  const days = target.checkinIntervalDays ?? 30;
  return days === 0 ? '일반 안부 추천 꺼짐' : `안부 추천 기준 · 마지막 챙김 후 ${days}일`;
}
function updateCheckinInput() {
  const custom = $('new-person-checkin').value === 'custom';
  $('new-person-checkin-custom').hidden = !custom;
  $('new-person-checkin-days').disabled = !custom;
  $('new-person-checkin-days').required = custom;
}
function checkinInput(old) {
  const selected = $('new-person-checkin').value;
  const raw = selected === 'custom' ? $('new-person-checkin-days').value.trim() : selected;
  if (!/^\d+$/.test(raw) || !Number.isInteger(Number(raw)) || Number(raw) > 365 || Number(raw) < (selected === 'custom' ? 1 : 0)) throw Error('안부 간격은 1일부터 365일까지 정수로 입력해 주세요.');
  const days = Number(raw);
  return days === 30 && !Object.hasOwn(old ?? {}, 'checkinIntervalDays') ? {} : { checkinIntervalDays: days };
}
async function confirmDelete(message, title = '자료 삭제', button = '삭제') {
  const epoch = authEpoch;
  $('confirm-title').textContent = title;
  $('confirm-dialog').querySelector('[value="confirm"]').textContent = button;
  $('confirm-message').textContent = message; $('confirm-dialog').returnValue = 'cancel'; $('confirm-dialog').showModal();
  return new Promise(resolve => $('confirm-dialog').addEventListener('close', () => resolve(epoch === authEpoch && $('confirm-dialog').returnValue === 'confirm'), { once: true }));
}
function renderEvents() {
  const events = state.events.filter(item => item.personId === selectedId);
  const upcoming = currentRows();
  $('event-list').innerHTML = events.length ? events.map(event => {
    const row = upcoming.find(item => item.event.id === event.id), occurrence = row?.occurrence;
    const date = occurrence?.date ?? event.date; const [, month, day] = date.split('-');
    const done = state.completions.some(item => item.eventId === event.id);
    const status = occurrence ? occurrence.daysUntil === 0 ? '오늘' : `${occurrence.daysUntil}일 뒤` : done ? '챙김 완료' : '지난 일정';
    const lunarLabel = event.calendar === 'lunar' ? `<br>음력 ${escapeHTML(event.date)}${event.lunarLeapMonth ? ' · 윤달' : ''}${occurrence ? ' → 위 날짜는 양력' : ''}` : '';
    const unavailable = !occurrence && event.calendar === 'lunar' && event.repeat === 'yearly' && !done ? '지원 범위 안에 다음 회차가 없어요' : status;
    return `<article class="event-card" data-mood="${['condolence', 'memorial'].includes(event.type) ? 'quiet' : 'celebrate'}"><div class="event-date-block"><small>${Number(month)}월</small><strong>${Number(day)}</strong></div><div><h4>${escapeHTML(event.title)}<span class="event-status">${escapeHTML(unavailable)}</span></h4><p class="event-meta">${escapeHTML(date)}${event.time ? ` · ${escapeHTML(event.time)}` : ''} · ${event.repeat === 'yearly' ? '매년' : '이번 한 번'}${lunarLabel}${event.location ? `<br>${escapeHTML(event.location)}` : ''}${event.notes ? `<br>${escapeHTML(event.notes)}` : ''}</p><div class="event-actions">${occurrence ? `<button class="text-button" type="button" data-draft-event="${escapeHTML(event.id)}">메시지 준비</button><button class="text-button" type="button" data-ics="${escapeHTML(event.id)}" data-occurrence-date="${escapeHTML(occurrence.date)}">다음 일정 달력 저장</button>` : ''}<button class="text-button" type="button" data-edit-event="${escapeHTML(event.id)}">수정</button><button class="text-button danger" type="button" data-delete-event="${escapeHTML(event.id)}">삭제</button></div></div></article>`;
  }).join('') : '<div class="inline-empty"><p>아직 기억할 날이 없어요.<br>생일이나 기념일을 하나 추가해 보세요.</p></div>';
}
function resetEventForm() { $('event-form').reset(); $('event-edit-id').value = ''; $('event-form-title').textContent = '일정 추가'; $('cancel-event-edit').hidden = true; updateEventType(); }
function updateEventType() {
  const oneTime = ['wedding', 'condolence'].includes($('event-type').value);
  if (oneTime) $('event-repeat').value = 'none';
  $('event-repeat').disabled = oneTime;
  const lunar = $('event-calendar').value === 'lunar';
  const input = $('event-date'), value = input.value;
  input.type = lunar ? 'text' : 'date';
  input.placeholder = lunar ? '예: 1960-02-30' : '';
  if (lunar) { input.pattern = '[0-9]{4}-[0-9]{2}-[0-9]{2}'; input.maxLength = 10; input.value = value; }
  else { input.removeAttribute('pattern'); input.removeAttribute('maxlength'); }
  $('lunar-options').hidden = !lunar;
  $('leap-policy-wrap').hidden = lunar || !input.value.endsWith('-02-29') || $('event-repeat').value !== 'yearly';
}
function editEvent(id) {
  const event = state.events.find(item => item.id === id); if (!event) return;
  $('event-edit-id').value = id; $('event-form-title').textContent = '일정 수정'; $('cancel-event-edit').hidden = false;
  $('event-calendar').value = event.calendar;
  updateEventType();
  for (const field of ['type', 'date', 'time', 'repeat', 'title', 'location', 'notes']) $(`event-${field}`).value = event[field];
  $('leap-policy').value = event.leapDayPolicy;
  $('event-leap-month').checked = event.lunarLeapMonth === true;
  $('event-lunar-leap-policy').value = event.lunarLeapPolicy || 'regular';
  $('event-lunar-short-policy').value = event.lunarShortMonthPolicy || 'last-day';
  $('event-care-action').value = event.carePlan?.action || 'contact'; $('event-care-amount').value = event.carePlan?.amountWon ?? ''; $('event-care-note').value = event.carePlan?.note || '';
  document.querySelectorAll('[name=reminder]').forEach(input => { input.checked = event.reminderDays.includes(Number(input.value)); });
  updateEventType(); $('event-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderMessageOptions() {
  const available = currentRows(); const previous = $('draft-event').value;
  $('message-empty').hidden = !!person(); $('message-editor').hidden = !person();
  $('draft-event').innerHTML = '<option value="">오늘 그냥 안부 · 일정 없이</option>'+available.map(row => `<option value="${escapeHTML(row.event.id)}" data-occurrence-id="${escapeHTML(row.occurrence.occurrenceId)}">${escapeHTML(row.event.title)} · ${escapeHTML(row.occurrence.date)}</option>`).join('');
  if (available.some(row => row.event.id === previous)) $('draft-event').value = previous;
  else if(!checkinMode&&available.length)$('draft-event').value=available[0].event.id;
  if (currentDraft && (currentDraft.eventId !== $('draft-event').value || currentDraft.occurrenceId !== $('draft-event').selectedOptions[0]?.dataset.occurrenceId)) resetDraft();
  if (!currentDraft && person()) $('draft-style').value = defaultDraftApproach(person(), state.events.find(item => item.id === $('draft-event').value)?.type || 'checkin', { checkinIntent: $('draft-intent').value });
  renderSavedDraft();
  updateMood();
  renderBrief();
}
function generateDraft({ silent = false, savedMessageId } = {}) {
  if(!person())throw Error('먼저 안부를 전할 사람을 골라 주세요.');
  const event = state.events.find(item => item.id === $('draft-event').value), options={approach:$('draft-style').value,checkinIntent:$('draft-intent').value,state,memorySelection:selectedMemory(), ...(savedMessageId ? {savedMessageId} : {})};
  const draft = event ? draftMessage(person(), event, options) : generateCheckinDraft(person(),options), row = event&&currentRows().find(item => item.event.id === event.id);
  if (event && row?.occurrence.occurrenceId !== $('draft-event').selectedOptions[0]?.dataset.occurrenceId) { renderMessageOptions(); throw Error('날짜가 바뀌었어요. 새로 표시한 일정을 확인해 주세요.'); }
  currentDraft = { ...draft, personId: selectedId, eventId: event?.id||'', eventType:event?.type||'checkin', occurrenceId: row?.occurrence.occurrenceId, originalText: draft.text };
  $('saved-message-select').dataset.scopeKey = '';
  $('draft-text').value = draft.text; $('draft-confirm').checked = false; invalidateMessageReview();
  $('draft-basis').textContent = [...draft.basis, ...draft.cautions, person().recipientPreference.note ? `기억할 점: ${person().recipientPreference.note}` : ''].filter(Boolean).join(' ');
  renderDraftNotice();
  renderMemoryApplication(draft);
  updateMood();
  if (!silent) notify(draft.needsComposition ? '피할 표현을 뺐어요. 전하고 싶은 말을 직접 적어 주세요.' : '초안을 준비했어요. 보내기 전에 내 말처럼 다듬어 주세요.');
}
async function changeDraft({ intentChanged = false } = {}) {
  const epoch = authEpoch, owner = selectedId, draft = currentDraft, text = $('draft-text').value;
  const approach = $('draft-style').value, intent = $('draft-intent').value;
  if (text.trim() && text !== (draft?.originalText || '')) {
    const confirmed = await confirmDelete('직접 다듬은 문구를 새 초안으로 바꿀까요? 남겨 두려면 취소한 뒤 문구를 먼저 기억하거나 복사해 주세요.', '새 초안으로 바꾸기', '새 초안 준비');
    if (epoch !== authEpoch || owner !== selectedId || currentDraft !== draft || $('draft-text').value !== text || notebookView().locked) return;
    if (!confirmed) { $('draft-style').value = draft?.approach || defaultDraftApproach(person(), draft?.eventType || 'checkin'); $('draft-intent').value = draft?.checkinIntent || 'everyday'; return; }
  }
  if (epoch !== authEpoch || owner !== selectedId || notebookView().locked) return;
  $('draft-intent').value = intent;
  $('draft-style').value = intentChanged && approach === 'saved' ? defaultDraftApproach(person(), 'checkin', { checkinIntent: intent }) : approach;
  generateDraft({ silent: true });
}
function checkedDraftInput({ rememberOnly = false } = {}) {
  selectedMemory();
  if (!currentDraft || currentDraft.personId !== selectedId || currentDraft.eventId !== $('draft-event').value) throw Error('먼저 현재 사람과 상황에 맞는 초안을 준비해 주세요.');
  if (!$('draft-confirm').checked) throw Error('문구를 확인한 뒤 체크해 주세요.');
  const text = $('draft-text').value.trim(); if (!text) throw Error('전할 메시지를 입력해 주세요.');
  if (!expressionReview || expressionReview.text !== text || expressionReview.personId !== selectedId || expressionReview.epoch !== authEpoch) {
    if (checkMessage().issues.length) { notify('점검할 표현을 확인해 주세요. 확인한 뒤 다시 눌러 진행할 수 있어요.'); return null; }
  }
  const event = state.events.find(item => item.id === currentDraft.eventId && item.personId === selectedId);
  if (currentDraft.eventId && event?.type !== currentDraft.eventType) throw Error('일정이 바뀌었어요. 작성한 문구를 남겨 뒀으니 현재 일정을 확인해 주세요.');
  const row = currentRows().find(item => item.event.id === currentDraft.eventId);
  if (!rememberOnly && currentDraft.eventId && row?.occurrence.occurrenceId !== currentDraft.occurrenceId) throw Error('날짜가 바뀌었어요. 작성한 문구를 남겨 뒀으니 문구를 기억한 뒤 현재 일정을 확인해 주세요.');
  return { personId: selectedId, eventId: currentDraft.eventId, eventType: currentDraft.eventType, checkinIntent: currentDraft.checkinIntent, occurrenceId: currentDraft.occurrenceId, originalText: currentDraft.originalText, text, preferenceNote: person().recipientPreference.note, memorySelection: selectedMemory() };
}
async function prepareEvent(eventId) {
  const epoch = authEpoch;let event = state.events.find(item => item.id === eventId); if (!event) throw Error('일정을 다시 확인해 주세요.');
  if ((selectedId !== event.personId || activeView !== 'person') && !await choosePerson(event.personId, 'events')) return;
  if (epoch !== authEpoch || notebookView().locked) return;
  event = state.events.find(item => item.id === eventId && item.personId === selectedId);if (!event) return;
  const occurrence = currentRows().find(row => row.event.id === eventId)?.occurrence;
  if (!occurrence) return false;
  followupContext=null;checkinMode=false;
  $('draft-event').value = eventId;
  renderBrief();
  switchTab('message');
  if (currentDraft?.eventId !== eventId || currentDraft?.occurrenceId !== occurrence?.occurrenceId) {
    $('draft-style').value = defaultDraftApproach(person(), event.type);
    generateDraft({ silent: true });
  }
  updateMood();
  $('workspace').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  return true;
}
async function beginCheckin(id, { followupId = '', fingerprint = '' } = {}) {
  const epoch = authEpoch;
  if (!state.people.length) { openPersonDialog();return; }
  if (!id) throw Error('안부를 전할 사람을 골라 주세요.');
  if (epoch !== authEpoch || notebookView().locked) return false;
  if (id !== selectedId) { if (!await choosePerson(id, 'message')) return false; }
  else { activeView='person';updateView(); }
  if (epoch !== authEpoch || notebookView().locked) return false;
  // Check after restoring this person's stashed draft as well as direct entry.
  if ($('draft-event').value && $('draft-text').value.trim()) {
    if (!await confirmDelete('다듬고 있는 일정 문구가 있어요. 새 안부를 준비하려면 필요한 내용을 먼저 복사해 주세요.', '새 안부 준비하기', '안부 준비')) return false;
  }
  if (epoch !== authEpoch || selectedId!==id || notebookView().locked) return false;
  followupContext=null;
  if (followupId) {
    const fresh=buildCareContext(state,{personId:id,today:today(),followupId}).selectedFollowup;
    if (!fresh||fingerprint!==followupFingerprint(followupId)) throw Error('이 챙김이 바뀌었어요. 현재 기록에서 다시 선택해 주세요.');
    followupContext={id:followupId,personId:id,epoch,fingerprint:followupFingerprint(followupId)};
  }
  checkinMode = true;$('draft-event').value = '';renderBrief();switchTab('message');
  if (currentDraft?.eventType !== 'checkin' || !$('draft-text').value.trim()) {
    $('draft-style').value = defaultDraftApproach(person(), 'checkin');generateDraft({ silent: true });
  }
  $('workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
function followupFingerprint(id) {
  const item=state.followups.find(row=>row.id===id),source=item?.sourceId?state.sources.find(row=>row.id===item.sourceId&&row.personId===item.personId):null;
  return item?JSON.stringify([item,source]):'';
}
function currentFollowupContext() {
  if (!followupContext) return null;
  const current=followupContext;
  if (current.epoch!==authEpoch||current.personId!==selectedId||$('draft-event').value||current.fingerprint!==followupFingerprint(current.id)) {
    followupContext=null;return null;
  }
  const item=buildCareContext(state,{personId:selectedId,today:today(),followupId:current.id}).selectedFollowup;
  if (!item) followupContext=null;
  return item;
}
async function beginFollowup(id) {
  const item=state.followups.find(row=>row.id===id&&row.status==='pending');
  if (!item||notebookView().locked) throw Error('현재 남아 있는 챙김에서 다시 선택해 주세요.');
  planFollowupAction(item,{action:'now',today:today()});
  if (await beginCheckin(item.personId,{followupId:id,fingerprint:followupFingerprint(id)})) notify('챙길 내용을 보며 안부를 다듬어 주세요. 문구 복사와 챙김 완료는 따로 기록해요.');
}
function exportEvent(button) {
  const row = rows().find(item => item.event.id === button.dataset.ics);
  if (!row || row.occurrence.date !== button.dataset.occurrenceDate) { render(); throw Error('다음 일정이 바뀌었어요. 다시 확인해 주세요.'); }
  download(toICS(row.event, row.person, new Date(), button.dataset.occurrenceDate), 'synk-care.ics', 'text/calendar');
  notify('양력으로 변환한 다음 1회 일정을 내보냈어요. 달력 앱에서 가져와 알림을 확인해 주세요.');
}
function finishEvent(action) {
  if (activeView!=='person'||activeTab!=='message') return;
  if(!$('draft-event').value) {
    if (followupContext) {
      const item=currentFollowupContext();
      if (!item) { renderBrief();throw Error('챙길 내용이 바뀌었어요. 현재 기록을 다시 확인해 주세요.'); }
      state=updateFollowup(state,item.id,planFollowupAction(state.followups.find(row=>row.id===item.id),{action:'done',today:today()}).patch);
      followupContext=null;resetDraft();sessionDrafts.delete(selectedId);save();render();switchTab('history');notify('이 챙김을 직접 마친 기록으로 남겼어요.');return;
    }
    state=recordCareAction(state,{personId:selectedId,kind:'contact',occurredOn:today(),note:'오늘 안부를 직접 전했어요.'}); resetDraft(); sessionDrafts.delete(selectedId);save();render();switchTab('history');notify('직접 안부를 전한 날로 기록했어요.');return;
  }
  const row = currentRows().find(item => item.event.id === $('draft-event').value), displayedId = $('draft-event').selectedOptions[0]?.dataset.occurrenceId;
  if (!row) { renderMessageOptions(); throw Error('챙길 일정을 다시 선택해 주세요.'); }
  if (row.occurrence.occurrenceId !== displayedId) { renderMessageOptions(); throw Error('날짜가 바뀌었어요. 새로 표시한 일정을 확인해 주세요.'); }
  state = completeEvent(state, row.event.id, new Date(), displayedId, { action });
  resetDraft(); sessionDrafts.delete(selectedId); save(); render(); switchTab('history');
  notify(action === 'remembered' ? '조용히 기억한 날로 남겼어요.' : '직접 챙긴 날로 기록했어요.');
}
function download(text, filename, type) {
  const blob = new Blob([text], { type }); if (blob.size > 4 * 1024 * 1024) throw Error('내보낼 자료가 4 MB를 넘어요.');
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
async function copyText(text) {
  if (!navigator.clipboard?.writeText) throw Error('복사를 지원하지 않는 환경이에요. 문구를 선택해 직접 복사해 주세요.');
  try { await navigator.clipboard.writeText(text); } catch { throw Error('복사 권한을 받지 못했어요. 문구를 선택해 직접 복사해 주세요.'); }
}
function splitConversation() {
  const text = $('conversation-text').value;
  if (!text.trim()) throw Error('먼저 대화를 붙여넣어 주세요.');
  if (text.length > 50_000) throw Error('대화는 50,000자 이내로 가져와 주세요.');
  const own = [], other = [], unknown = [];
  const otherName = person().name;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^\s*(?:\[([^\]]+)\]|([^:：]{1,80}))\s*[:：]?\s*(.*)$/);
    const sender = match?.[1] ?? (line.includes(':') || line.includes('：') ? match?.[2]?.trim() : null);
    if (sender && /^(나|본인|내|me|self)$/i.test(sender)) own.push(match[3]);
    else if (sender && (['상대', '상대방', 'other'].includes(sender.toLowerCase()) || sender === otherName)) other.push(match[3]);
    else unknown.push(line);
  }
  $('self-text').value = own.join('\n'); $('other-text').value = other.join('\n'); $('speaker-confirm').checked = false;
  stashConversation(); $('speaker-details').open = true;
  notify(unknown.length ? `${unknown.length}줄의 화자를 확인하지 못했어요. 원문을 보며 직접 옮겨 주세요.` : '발화를 나눴어요. 두 칸을 직접 확인해 주세요.');
}
async function checkCapabilities() {
  if (PUBLIC_WEB) {
    capabilities = { transcription: { available: false, reason: 'public-web' } };
    $('transcribe-button').disabled = true;
    $('audio-consent').disabled = true;
    $('audio-consent').closest('label').hidden = true;
    $('transcription-status').textContent = '공개 웹에서는 녹음 받아쓰기를 제공하지 않아요. 녹음을 들으며 텍스트를 붙여넣거나 PC 로컬 앱의 받아쓰기를 이용해 주세요.';
    $('audio-processing-note').textContent = '선택한 녹음은 이 브라우저에서만 재생하며 서버로 보내지 않아요. 직접 확인한 텍스트만 수첩에 보관할 수 있어요.';
    return;
  }
  try { const response = await fetch('/api/capabilities', { signal: AbortSignal.timeout(8000) }); if (!response.ok) throw Error('연결 실패'); capabilities = await response.json(); }
  catch { capabilities = { transcription: { available: false, reason: 'connection_failed' } }; }
  const available = capabilities?.transcription?.available === true;
  $('transcribe-button').disabled = !available;
  $('transcription-status').textContent = available ? '로컬 음성 인식을 사용할 수 있어요. 파일 길이에 따라 시간이 걸릴 수 있어요.' : '이 환경에서 로컬 음성 인식을 사용할 수 없어요. 직접 녹취한 텍스트를 붙여넣어 주세요.';
}
async function transcribe() {
  if (!audioFile) throw Error('먼저 녹음 파일을 선택해 주세요.');
  if (!$('audio-consent').checked) throw Error('녹음 처리 권한과 로컬 전사 동의를 확인해 주세요.');
  if (!capabilities?.transcription?.available) throw Error('이 환경에서는 텍스트 입력을 이용해 주세요.');
  if (transcribing) return;
  const file = audioFile, ownerId = selectedId, epoch = authEpoch; transcribing = true; $('transcribe-button').disabled = true; $('transcribe-button').textContent = '텍스트로 바꾸고 있어요…';
  $('transcription-status').textContent = '로컬에서 전사하고 있어요. 긴 녹음은 시간이 걸릴 수 있어요.';
  try {
    const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': file.type.startsWith('audio/') ? file.type : 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name), 'X-SYNK-Care': '1' }, body: file });
    const result = await response.json(); if (!response.ok) throw Error(result.error || '전사하지 못했어요. 녹취 텍스트를 직접 입력해 주세요.');
    if (epoch !== authEpoch || ownerId !== selectedId || file !== audioFile) { notify('전사는 끝났지만 선택한 자료가 바뀌어 결과를 넣지 않았어요.'); return; }
    $('transcript-text').value = result.text || ''; $('transcript-wrap').hidden = false;
    $('transcription-status').textContent = '전사가 끝났어요. 녹음을 들으며 문장을 고친 다음 본인 발화를 직접 구분해 주세요.';
  } catch (error) { $('transcription-status').textContent = error.message || '전사에 실패했어요. 녹취 텍스트를 직접 입력해 주세요.'; }
  finally { transcribing = false; $('transcribe-button').disabled = !capabilities?.transcription?.available; $('transcribe-button').textContent = '녹음을 텍스트로 바꾸기'; }
}
function notificationStatus() {
  const push = carePush.snapshot();
  if (push.enabled) { $('notification-status').textContent = push.scheduleKnown ? `기기 알림 켜짐 · ${String(push.hour).padStart(2, '0')}:${String(push.minute).padStart(2, '0')} 한국 시간` : '기기 알림 · 저장된 시간 다시 확인 필요'; return; }
  if (!push.signedIn && (PUBLIC_WEB || accountStatus.configured) && !window.synkProduct?.authStatus) { $('notification-status').textContent = '기기 알림 설정은 로그인 후 확인'; return; }
  if (!('Notification' in window)) { $('notification-status').textContent = '이 환경은 웹 알림을 지원하지 않아요 · 달력 저장을 이용해 주세요'; return; }
  const permission = Notification.permission;
  $('notification-status').textContent = permission === 'granted' ? '알림 켜짐 · 앱이 열려 있을 때만' : permission === 'denied' ? '알림 권한이 꺼져 있어요 · 달력 저장을 이용해 주세요' : '앱이 열려 있을 때 알림 · 권한 설정 필요';
}
function checkReminders() {
  if (notebookView().locked || carePush.snapshot().suppressOpenReminders) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  for (const row of rows().filter(item => item.reminderDue)) {
    const key = `${row.occurrence.occurrenceId}:${today()}`; if (notified.has(key)) continue;
    try { new Notification('SYNK 플레저', { body: '오늘 챙길 일이 있어요. 수첩에서 확인해 주세요.', tag: key, icon: 'assets/sticker-envelope.webp' }); notified.add(key); save(); }
    catch { $('notification-status').textContent = '이 환경에서 알림을 표시하지 못했어요 · 달력 저장을 이용해 주세요'; break; }
  }
}

function renderPushSettings() {
  const push = carePush.snapshot(), time = `${String(push.inputHour).padStart(2, '0')}:${String(push.inputMinute).padStart(2, '0')}`;
  $('push-status').textContent = push.message;
  $('push-status').dataset.kind = ['error', 'unavailable', 'denied'].includes(push.phase) ? 'error' : push.enabled ? 'success' : 'info';
  $('push-settings').setAttribute('aria-busy', String(push.busy));
  $('push-time').disabled = push.busy || !push.signedIn || !['ready', 'enabled', 'error'].includes(push.phase);
  if (document.activeElement !== $('push-time')) $('push-time').value = time;
  const timeChanged = push.inputHour !== push.hour || push.inputMinute !== push.minute;
  $('push-time-hint').hidden = !push.enabled || !push.scheduleKnown || !timeChanged || push.busy;
  $('push-time-hint').textContent = `현재 알림 시간은 ${String(push.hour).padStart(2, '0')}:${String(push.minute).padStart(2, '0')}로 저장돼 있어요. 위의 변경 시간을 적용하려면 ‘알림 시간 저장’을 눌러 주세요.`;
  $('push-enable').hidden = push.enabled || !push.signedIn || !['ready', 'error', 'enabling'].includes(push.phase);
  $('push-enable').disabled = push.busy;
  $('push-enable').textContent = push.phase === 'enabling' ? '알림을 연결하고 있어요…' : '이 기기에 알림 켜기';
  $('push-cancel').hidden = !push.canCancelEnable;
  $('push-save').hidden = !push.enabled || !push.scheduleKnown; $('push-save').disabled = push.busy;
  $('push-disable').hidden = !push.enabled; $('push-disable').disabled = push.busy;
  $('push-retry').hidden = !push.signedIn || !['unavailable', 'denied', 'unsupported', 'needs-install', 'permission-pending'].includes(push.phase);
  $('push-signin').hidden = push.signedIn;
  $('push-signin').disabled = push.busy || accountStarting || !accountStatus.configured;
  $('push-open-only').hidden = push.enabled;
  $('push-open-only').disabled = push.permissionPending || !('Notification' in window) || Notification.permission === 'denied';
  notificationStatus();
}
function pushTime() { const [hour, minute] = $('push-time').value.split(':').map(Number); return [hour, minute]; }

const accountLocalNote = document.createElement('p'); accountLocalNote.id = 'account-local-note'; accountLocalNote.className = 'helper'; accountLocalNote.setAttribute('role', 'status'); accountLocalNote.hidden = true; $('account-panel').append(accountLocalNote);
const accountLocalDrafts = document.createElement('div'); accountLocalDrafts.id = 'account-local-drafts'; accountLocalDrafts.hidden = true; $('account-panel').append(accountLocalDrafts);
accountLocalDrafts.addEventListener('click', async event => { const target = event.target.closest('[data-local-draft]'); if (!target) return; if ((syncStatus.pending || hasUnsubmittedAccountInput()) && !await confirmDelete('현재 화면 대신 선택한 미저장 수첩을 열까요? 기기에 보관한 다른 미저장 기록은 그대로 남아요. 보관하지 못한 입력은 먼저 내보내 주세요.', '미저장 수첩 열기', '선택한 수첩 열기')) return; try { await sync.selectLocalDraft(target.dataset.localDraft); } catch (error) { notify(error.message); } });
for (const [id, label] of [['account-export-local', '계정 임시기록 복구 파일 내보내기'], ['account-clear-local', '이 기기의 계정 임시기록 지우기']]) { const button = document.createElement('button'); button.id = id; button.className = 'soft-button'; button.type = 'button'; button.textContent = label; button.hidden = true; $('account-panel').append(button); }
on('account-export-local', 'click', () => { const file = new Blob([JSON.stringify(sync.exportLocalRecords(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = 'synk-care-local-recovery.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
on('account-clear-local', 'click', async () => { const expected=authEpoch; if (!accountId || syncStatus.pending || !await confirmDelete('로그인한 이 계정이 플레저에 남긴 임시기록을 지울까요? 미저장 변경과 읽지 못한 원본은 복구할 수 없어요. 다른 계정의 임시기록, 계정 서버의 수첩, 로그인 전 기기 수첩은 그대로예요. 필요한 복구 파일을 실제로 저장했는지 먼저 확인해 주세요.', '이 계정의 임시기록 삭제', '기기 임시기록 지우기') || expected!==authEpoch) return; if (sync.clearLocalRecords()) notify('이 계정의 기기 임시기록을 지웠어요. 계정 서버의 수첩은 그대로예요.'); });
on('people-search', 'input', renderPeople); on('people-group-filter', 'change', renderPeople);
on('account-signin', 'click', async () => {
  try { await account.signIn(); }
  catch (error) { accountStatus = resumeCareLoginNavigation(accountStatus, true);renderAccount();throw error; }
});
on('account-signout', 'click', async () => {
  const pendingNotice = syncStatus.pendingStored === false ? '현재 변경을 계정에 저장하지 못했고 기기 임시보관도 확인하지 못했어요. 현재 수첩을 내보내지 않고 로그아웃할까요?' : '아직 계정에 반영되지 않은 변경이 있어요. 이 기기에 저장한 대기본은 같은 계정으로 다시 로그인한 뒤 직접 골라 이어 저장할 수 있어요. 지금 로그아웃할까요?';
  const notice = hasUnsubmittedAccountInput() ? '아직 수첩에 보관하지 않은 메시지·대화·후속 챙김·카드 입력이 있어요. 입력을 복사해 두지 않고 로그아웃하면 사라져요. 로그아웃할까요?' : pendingNotice;
  if ((syncStatus.pending || hasUnsubmittedAccountInput()) && !await confirmDelete(notice, '로그아웃', '로그아웃')) return;
  const pushResult = await carePush.logout();
  const result = await account.signOut(), logoutNotice = careLogoutNotice(result, pushResult);
  if (logoutNotice) notify(logoutNotice);
});
on('account-refresh', 'click', async () => {
  if (hasUnsubmittedAccountInput() && !await confirmDelete('아직 보관하지 않은 입력이 있어요. 계정 자료가 바뀌었다면 현재 입력 화면이 초기화될 수 있어요.', '계정 새로고침', '새로고침')) return;
  await sync.refresh();
});
on('account-conflict-load', 'click', async () => {
  if (!await confirmDelete('현재 편집 중인 내용을 계정의 최신 수첩으로 바꿔요. 보관할 변경이 있다면 먼저 백업을 내보내 주세요.', '계정 자료 불러오기', '계정 자료 선택')) return;
  await sync.resolveRemote();
});
on('account-conflict-retry', 'click', async () => {
  if (!await confirmDelete('계정의 최신 내용을 현재 화면의 수첩으로 바꿉니다. 현재 수첩에 없는 이전 문구·즐겨찾기·다른 기기의 기록은 사라질 수 있어요. 필요한 내용은 먼저 백업해 주세요.', '내 변경 저장', '현재 수첩으로 저장')) return;
  await sync.resolveLocal();
});
on('account-import-device', 'click', async () => {
  if (!guestSnapshot || !accountId) return;
  if (!notebookView().canImportDevice) { notify(notebookView().detail);return; }
  const source = importBackup(guestSnapshot.state), targetId = accountId, epoch = authEpoch;
  if (!await confirmDelete(`이 기기에 있던 사람 ${source.people.length}명의 수첩을 계정에 추가해요. 이미 같은 식별자의 사람이 있으면 계정 자료를 유지하고 건너뛰어요.`, '기기의 수첩 가져오기', '계정 수첩에 추가')) return;
  if (accountId !== targetId || authEpoch !== epoch || !notebookView().canImportDevice) return;
  const added = new Set(source.people.filter(item => !state.people.some(old => old.id === item.id)).map(item => item.id));
  const events = source.events.filter(item => added.has(item.personId)), eventIds = new Set(events.map(item => item.id));
  state = importBackup({ ...state, people: [...state.people, ...source.people.filter(item => added.has(item.id))], events: [...state.events, ...events], drafts: [...state.drafts, ...source.drafts.filter(item => added.has(item.personId))].slice(-200), completions: [...state.completions, ...source.completions.filter(item => eventIds.has(item.eventId))], sources: [...state.sources, ...source.sources.filter(item => added.has(item.personId))], memories: [...state.memories, ...source.memories.filter(item => added.has(item.personId))], activities: [...state.activities, ...source.activities.filter(item => added.has(item.personId))], followups: [...(state.followups || []), ...(source.followups || []).filter(item=>added.has(item.personId))], preparations: [...(state.preparations || []), ...(source.preparations || []).filter(item=>added.has(item.personId))].slice(-500) });
  save(); render(); notify(`${added.size}명의 수첩을 계정에 추가했어요.`);
});
on('schedule-view', 'change', renderSchedule);
on('calendar-prev', 'click', () => { calendarMonth = shiftMonth(calendarMonth, -1); calendarDay = `${calendarMonth}-01`; renderSchedule(); });
on('calendar-next', 'click', () => { calendarMonth = shiftMonth(calendarMonth, 1); calendarDay = `${calendarMonth}-01`; renderSchedule(); });
on('calendar-today', 'click', () => { calendarMonth = today().slice(0, 7); calendarDay = today(); renderSchedule(); });
on('calendar-grid', 'click', e => { const button = e.target.closest('[data-calendar-date]'); if (!button) return; calendarDay = button.dataset.calendarDate; calendarMonth = calendarDay.slice(0, 7); renderSchedule(); });
for (const id of ['capture-source', 'capture-person', 'capture-source-kind']) on(id, 'input', invalidateCapture);
on('capture-extract', 'click', extractCapture); on('capture-save', 'click', saveCapture);
on('care-brief', 'click', async e => {
  if (e.target.closest('[data-brief-history]')) { switchTab('history');return; }
  const followup=e.target.closest('[data-context-followup]');
  if (followup) { await beginFollowup(followup.dataset.contextFollowup);return; }
  if (e.target.closest('[data-context-clear]')) { followupContext=null;renderBrief();updateMood();return; }
  const memory=e.target.closest('[data-context-memory]');
  if (memory) {
    const fresh=buildCareContext(state,{personId:selectedId,today:today()}).memories.find(item=>item.id===memory.dataset.contextMemory);
    if (!fresh) { renderBrief();throw Error('기억이 바뀌었어요. 현재 기록에서 다시 골라 주세요.'); }
    $('personal-memory').value=fresh.id;renderMemoryEvidence();$('memory-personalization').open=true;
    $('personal-memory-status').textContent='원문과 용도를 확인한 뒤 “이 기억으로 준비”를 눌러 주세요. 아직 문구를 바꾸지 않았어요.';
    $('personal-memory-use').focus({preventScroll:true});
    $('memory-personalization').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  }
});
on('care-log-event', 'change', () => { logOccurrence = null; });
on('care-log-form', 'submit', e => {
  e.preventDefault();
  const kind = $('care-log-kind').value, direction = $('care-log-direction').value, eventId = $('care-log-event').value;
  const recordedAt=new Date();
  let next = recordCareAction(state, { personId: selectedId, eventId, kind, direction, occurredOn: $('care-log-date').value, amountWon: $('care-log-amount').value === '' ? null : Number($('care-log-amount').value), note: $('care-log-note').value },recordedAt);
  if (logOccurrence?.startsWith(`${eventId}:`) && direction === 'sent') next = completeEvent(next, eventId, recordedAt, logOccurrence, { allowPast: true, action: kind === 'remember' ? 'remembered' : 'contacted' });
  state = next; logOccurrence = null; $('care-log-form').reset(); save(); render(); notify('실제로 나눈 마음을 남겼어요. 다음에 준비할 때 함께 꺼내 보여드려요.');
});
on('person-history', 'click', async e => {
  const button = e.target.closest('button'); if (!button) return;
  const owner = selectedId, epoch = authEpoch;
  const countMessages = value => value.people.reduce((count, item) => count + listSavedMessages(item).length, 0);
  const removalNotice = next => `다시 쓸 문구·복사 기록(문구 ${countMessages(state) - countMessages(next)}개, 복사 ${state.drafts.length - next.drafts.length}개)`;
  if (button.dataset.deleteMemory) {
    const before = state, next = revokeCareMemory(state, { memoryId: button.dataset.deleteMemory });
    if (!await confirmDelete(`이 기억과 그 내용이 들어간 ${removalNotice(next)}을 함께 삭제할까요? 같은 글자가 들어간 문구도 포함돼요.`)) return;
    if (owner !== selectedId || epoch !== authEpoch) return;
    if (state !== before) throw Error('확인하는 동안 수첩이 바뀌었어요. 삭제할 항목 수를 다시 확인해 주세요.');
    state = next;
  }
  else if (button.dataset.deleteActivity) { state.activities = state.activities.filter(item => item.id !== button.dataset.deleteActivity); }
  else if (button.dataset.deleteSource) {
    const before = state, next = revokeCareMemory(state, { sourceId: button.dataset.deleteSource });
    if (!await confirmDelete(`이 원문과 여기서 확인한 기억·후속 챙김, 그 내용이 들어간 ${removalNotice(next)}을 함께 삭제할까요? 같은 글자가 들어간 문구도 포함돼요. 따로 저장한 일정은 유지해요.`)) return;
    if (owner !== selectedId || epoch !== authEpoch) return;
    if (state !== before) throw Error('확인하는 동안 수첩이 바뀌었어요. 삭제할 항목 수를 다시 확인해 주세요.');
    state = next;
  } else return;
  if (button.dataset.deleteMemory || button.dataset.deleteSource) { sessionDrafts.delete(owner); resetPersonalMemory(); resetDraft(); }
  save(); render(); notify('선택한 기록을 삭제했어요.');
});
on('add-person', 'click', () => openPersonDialog()); on('empty-add', 'click', () => openPersonDialog()); on('edit-person', 'click', () => openPersonDialog(true));
on('home-add-person', 'click', () => openPersonDialog()); on('home-empty-add', 'click', async () => { if (state.people.length) { if(!await choosePerson(selectedId || state.people[0].id, 'events'))return; $('event-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); } else openPersonDialog(); }); on('show-home', 'click', showHome);
on('home-view', 'click', async e => { const button = e.target.closest('button'); if (!button) return; if (button.dataset.homeDraft) await prepareEvent(button.dataset.homeDraft); if (button.dataset.homePerson) await choosePerson(button.dataset.homePerson, 'history'); if (button.dataset.ics) exportEvent(button); if (button.dataset.logEvent) await openCareLog(button.dataset.logEvent, button.dataset.logDate); });
on('start-checkin','click',()=>beginCheckin($('checkin-person').value));
on('care-focus-action','click',()=>openCareFocus('prepare'));on('care-focus-history','click',()=>openCareFocus('history'));on('care-focus-next','click',()=>openCareFocus('next'));
on('personal-memory','change',()=>{renderMemoryEvidence();$('personal-memory-status').textContent='원문과 용도를 확인한 뒤 “이 기억으로 준비”를 눌러 주세요.';});
on('personal-memory-use','change',()=>{$('personal-memory-status').textContent='바꾼 용도를 확인한 뒤 “이 기억으로 준비”를 눌러 주세요.';});
on('apply-personal-memory','click',async()=>{
  const id=$('personal-memory').value,fingerprint=memoryFingerprint(id),epoch=authEpoch,owner=selectedId,use=$('personal-memory-use').value;
  if(!fingerprint)throw Error('먼저 이번에 꺼낼 기억을 골라 주세요.');
  if(currentDraft&&$('draft-text').value!==currentDraft.originalText&&!await confirmDelete('직접 다듬은 문구를 고른 기억이 담긴 새 초안으로 바꿀까요? 필요한 문구를 먼저 복사해 주세요.','기억으로 새 초안','새 초안 준비'))return;
  if(epoch!==authEpoch||owner!==selectedId||fingerprint!==memoryFingerprint(id))throw Error('선택한 기억이 바뀌었어요. 다시 확인해 주세요.');
  memoryChoice={memoryId:id,use,personId:owner,epoch,fingerprint};preparationKey='';resetDraft({preserveIntent:!$('draft-event').value});renderBrief();generateDraft({silent:true});
  const blocked=currentDraft?.memory?.blockedReasons?.length;
  $('memory-personalization').open=!!blocked;
  const destination=blocked?$('personal-memory-status'):use==='gift-preference'?$('care-preparation'):document.querySelector('.draft-window');
  if(!blocked&&use==='shared-memory')$('draft-text').focus({preventScroll:true});
  else if(!blocked){$('care-preparation').tabIndex=-1;$('care-preparation').focus({preventScroll:true});}
  destination.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
});
on('clear-personal-memory','click',async()=>{const epoch=authEpoch,owner=selectedId;if(currentDraft&&$('draft-text').value!==currentDraft.originalText&&!await confirmDelete('고른 기억을 해제하고 기본 초안으로 바꿀까요? 직접 다듬은 문구는 먼저 복사해 주세요.','기억 선택 해제','기본 초안 준비'))return;if(epoch!==authEpoch||owner!==selectedId)return;resetPersonalMemory();resetDraft({preserveIntent:!$('draft-event').value});renderBrief();generateDraft({silent:true});});
on('close-followup-calendar','click',()=>{$('followup-calendar-dialog').close();followupCalendar=null;});
on('followup-calendar-time','input',()=>{const empty=!$('followup-calendar-time').value;$('followup-calendar-alarm').disabled=empty;if(empty)$('followup-calendar-alarm').checked=false;});
on('followup-calendar-form','submit',e=>{e.preventDefault();const item=followupCalendar&&state.followups.find(row=>row.id===followupCalendar.id);if(!item||followupCalendar.epoch!==authEpoch||followupCalendar.fingerprint!==JSON.stringify(item))throw Error('챙길 날짜나 계정이 바뀌었어요. 달력 저장을 다시 열어 주세요.');download(toFollowupICS(state,item.id,{time:$('followup-calendar-time').value,reminderMinutes:$('followup-calendar-alarm').checked?[0]:[]}), 'synk-care.ics','text/calendar');$('followup-calendar-dialog').close();followupCalendar=null;notify('달력 파일을 저장했어요. 달력 앱에 추가한 뒤 알림을 확인해 주세요.');});
on('new-person-checkin', 'change', updateCheckinInput);
on('quick-event-date', 'input', updatePersonSubmit);
$('person-form').addEventListener('invalid', revealPersonInvalidField, true);
on('close-person-dialog', 'click', () => { $('person-dialog').close(); personDialogContext = null; });
on('person-form', 'submit', async e => {
  e.preventDefault(); const old = state.people.find(item => item.id === $('person-edit-id').value);
  const context = personDialogContext;
  if (!context || context.epoch !== authEpoch || context.id !== $('person-edit-id').value || context.fingerprint !== (old ? JSON.stringify(old) : null)) throw Error('계정이나 사람 정보가 바뀌었어요. 정보 수정을 다시 열어 주세요.');
  const value = makePerson({ ...old, ...checkinInput(old), name: $('new-person-name').value, relationship: $('new-person-relationship').value, group: $('new-person-group').value, notes: $('new-person-notes').value });
  const event = !old && $('quick-event-date').value ? makeEvent({ personId: value.id, type: $('quick-event-type').value, date: $('quick-event-date').value }) : null;
  if (old) state.people = state.people.map(item => item.id === old.id ? value : item); else state.people.push(value);
  if (event) state.events.push(event);
  const saved = save(); renderPeople(); renderHome();
  $('person-dialog').close(); personDialogContext = null;
  if (old) {
    renderWorkspace(); renderHistory(); renderCapturePeople(); renderBrief();
    if (saved && !saveFailed) notify('사람 정보를 수정했어요. 작성 중인 문구는 그대로예요.');
    return;
  }
  if (!saved || saveFailed || context.epoch !== authEpoch) return;
  const selected = await choosePerson(value.id);
  if (context.epoch !== authEpoch || notebookView().locked || saveFailed) return;
  if (!selected || selectedId !== value.id) { notify('수첩에 기억했어요. 사람 목록에서 새 수첩을 열 수 있어요.'); return; }
  const prepared = event ? await prepareEvent(event.id) : await beginCheckin(value.id);
  if (context.epoch !== authEpoch || selectedId !== value.id || notebookView().locked || saveFailed) return;
  notify(prepared ? '첫 문구를 준비했어요. 내 말로 다듬어 전해 보세요.' : event ? '이름과 날짜를 기억했어요. 지난 일정은 ‘기억할 날’에서 확인할 수 있어요.' : '수첩에 기억했어요. 마음 전하기에서 안부를 준비할 수 있어요.');
});
on('people-list', 'click', async e => { const button = e.target.closest('[data-person]'); if (button) await choosePerson(button.dataset.person); });
on('delete-person', 'click', async () => {
  const id = selectedId, epoch = authEpoch; $('person-dialog').close();
  if (!await confirmDelete('이 사람의 일정, 말투 관찰, 선호, 초안과 챙김 기록을 함께 삭제할까요?')) return;
  if (epoch !== authEpoch) return;
  const removed = new Set(state.events.filter(item => item.personId === id).map(item => item.id));
  for (const key of ['sources', 'memories', 'activities', 'followups', 'preparations']) state[key] = (state[key] ?? []).filter(item => item.personId !== id);
  state.people = state.people.filter(item => item.id !== id); state.events = state.events.filter(item => item.personId !== id); state.drafts = state.drafts.filter(item => item.personId !== id); state.completions = state.completions.filter(item => !removed.has(item.eventId)); conversations.delete(id); sessionDrafts.delete(id);
  $('person-form').reset(); resetPersonalMemory(); resetDraft(); selectedId = null; await choosePerson(state.people[0]?.id ?? null); notify('이 사람과 연결된 자료를 삭제했어요.');
});
document.querySelectorAll('[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  tab.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const tabs = [...document.querySelectorAll('[data-tab]')]; let index = tabs.indexOf(tab); index = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[index].focus(); switchTab(tabs[index].dataset.tab); });
});
for (const mode of ['text', 'audio']) on(`input-${mode}-tab`, 'click', () => { for (const item of ['text', 'audio']) { $(`${item}-import`).hidden = item !== mode; $(`input-${item}-tab`).classList.toggle('active', item === mode); $(`input-${item}-tab`).setAttribute('aria-pressed', String(item === mode)); } });
on('split-conversation', 'click', splitConversation);
on('capture-conversation', 'click', () => {
  const text = $('conversation-text').value.trim(); if (!text) throw Error('먼저 대화를 넣어 주세요.');
  showHome(); $('capture-person').value = selectedId; $('capture-source').value = text;
  $('capture-source-kind').value = $('transcript-text').value.trim() === text ? 'transcript' : 'text';
  extractCapture(); $('capture-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
on('text-file', 'change', async () => { const file = $('text-file').files[0], ownerId = selectedId; if (!file) return; if (file.size > 512 * 1024) throw Error('텍스트 파일은 512 KB 이내로 가져와 주세요.'); const text = await file.text(); if (ownerId !== selectedId || !person() || file !== $('text-file').files[0]) { notify('선택한 사람이 바뀌어 대화를 넣지 않았어요.'); return; } if (text.length > 50_000) throw Error('텍스트는 50,000자 이내로 가져와 주세요.'); $('conversation-text').value = text; $('self-text').value = ''; $('other-text').value = ''; $('speaker-confirm').checked = false; stashConversation(); notify('대화를 가져왔어요. 발화를 나눠 확인해 주세요.'); });
for (const field of ['conversation-text', 'self-text', 'other-text']) on(field, 'input', () => { $('speaker-confirm').checked = false; stashConversation(); });
on('speaker-confirm', 'change', stashConversation);
on('analyze-tone', 'click', () => { if (!$('speaker-confirm').checked) throw Error('내 발화와 상대 발화를 확인한 뒤 체크해 주세요.'); const result = analyzeTone($('self-text').value); state.people = state.people.map(item => item.id === selectedId ? makePerson({ ...item, selfTone: result }) : item); renderTone(); save(); notify('내 발화의 표현 특징을 살펴봤어요.'); });
on('preference-form', 'submit', e => {
  e.preventDefault();
  const preference = { confirmed: $('preference-confirm').checked, formality: $('preference-formality').value, length: $('preference-length').value, allowEmoji: $('preference-emoji').checked, avoidPromises: $('preference-promises').checked, note: $('preference-note').value, salutation: $('preference-salutation').value, avoidPhrases: $('preference-avoid').value.split(/[,\n]/).map(value => value.trim()).filter(Boolean), noReplyPressure: $('preference-no-reply').checked, closingLine: $('preference-closing').value };
  state.people = state.people.map(item => item.id === selectedId ? makePerson({ ...item, recipientPreference: preference }) : item);
  const keepCheckin = !$('draft-event').value && (checkinMode || currentDraft?.eventType === 'checkin');
  resetDraft({ preserveIntent: keepCheckin }); sessionDrafts.delete(selectedId); save(); renderHistory(); switchTab(keepCheckin || currentRows().length ? 'message' : 'events');
  if (keepCheckin || currentRows().length) generateDraft({ silent: true });
  notify(preference.confirmed ? '직접 확인한 표현을 초안에 반영했어요.' : '설정을 저장했어요. 직접 확인하지 않은 선호는 초안에 적용하지 않아요.');
});
on('audio-file', 'change', () => { const file = $('audio-file').files[0]; if (!file) return; clearAudio(); if (file.size > MAX_AUDIO) throw Error('음성 파일은 20 MB 이내로 가져와 주세요.'); if (!file.size) throw Error('빈 음성 파일은 재생할 수 없어요.'); audioFile = file; audioURL = URL.createObjectURL(file); $('audio-player').src = audioURL; $('audio-filename').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`; $('audio-detail').hidden = false; });
on('transcribe-button', 'click', transcribe);
on('use-transcript', 'click', () => { const text = $('transcript-text').value.trim(); if (!text) throw Error('추출한 대화를 확인해 주세요.'); if (text.length > 50_000) throw Error('대화는 50,000자 이내로 줄여 주세요.'); $('conversation-text').value = text; $('self-text').value = ''; $('other-text').value = ''; $('speaker-confirm').checked = false; stashConversation(); $('input-text-tab').click(); notify('대화를 가져왔어요. 내 발화와 상대 발화를 직접 나눠 주세요.'); });
on('event-type', 'change', () => { const type = $('event-type').value; $('event-repeat').value = ['wedding', 'condolence'].includes(type) ? 'none' : 'yearly'; updateEventType(); });
on('event-date', 'change', updateEventType); on('event-repeat', 'change', updateEventType); on('event-calendar', 'change', updateEventType); on('cancel-event-edit', 'click', resetEventForm);
on('event-form', 'submit', e => {
  e.preventDefault(); const values = {};
  for (const field of ['type', 'date', 'time', 'repeat', 'title', 'location', 'notes', 'calendar']) values[field] = $(`event-${field}`).value;
  const id = $('event-edit-id').value;
  const event = makeEvent({ ...values, id: id || undefined, personId: selectedId, reminderDays: [...document.querySelectorAll('[name=reminder]:checked')].map(input => Number(input.value)), leapDayPolicy: $('leap-policy').value, lunarLeapMonth: $('event-leap-month').checked, lunarLeapPolicy: $('event-lunar-leap-policy').value, lunarShortMonthPolicy: $('event-lunar-short-policy').value, carePlan: { action: $('event-care-action').value, amountWon: $('event-care-amount').value === '' ? null : Number($('event-care-amount').value), note: $('event-care-note').value } });
  if (id) state.events = state.events.map(item => item.id === id ? event : item); else state.events.push(event);
  preparationKey = ''; resetEventForm(); resetDraft(); sessionDrafts.delete(selectedId); save(); render(); checkReminders(); notify(id ? '일정을 수정했어요.' : '기억할 날을 저장했어요. 메시지도 준비해 보세요.');
});
on('event-list', 'click', async e => {
  const button = e.target.closest('button'); if (!button) return;
  if (button.dataset.editEvent) editEvent(button.dataset.editEvent);
  if (button.dataset.deleteEvent) { if (!await confirmDelete('이 일정과 연결된 초안·챙김 기록도 함께 삭제할까요?')) return; const id = button.dataset.deleteEvent; state.events = state.events.filter(item => item.id !== id); state.preparations = (state.preparations || []).filter(item=>item.eventId!==id); preparationKey=''; state.activities = (state.activities ?? []).map(item => item.eventId === id ? { ...item, eventId: '' } : item); state.drafts = state.drafts.filter(item => item.eventId !== id); state.completions = state.completions.filter(item => item.eventId !== id); resetDraft(); resetEventForm(); save(); render(); notify('일정을 삭제했어요.'); }
  if (button.dataset.ics) exportEvent(button);
  if (button.dataset.draftEvent) await prepareEvent(button.dataset.draftEvent);
});
on('prepare-form', 'submit', e => {
  e.preventDefault(); const questions = preparationResult?.question ? [preparationResult.question] : preparationResult?.questions || [];
  for (const select of document.querySelectorAll('[data-preparation-field]')) {
    const question = questions.find(item => item.field === select.dataset.preparationField), answer = question?.options[Number(select.value)];
    const custom = question?.field === 'budgetWon' ? $('preparation-budget')?.value : '';
    if (custom) preparationInputs.budgetWon = Number(custom); else { if (select.value === '' || !answer) throw Error('이번 준비에 맞는 답을 골라 주세요.'); preparationInputs[question.field] = answer.value; }
  }
  preparationLogId = null; renderPreparation(true);
});
on('preparation-result','click',e=>{
  const button=e.target.closest('[data-use-preparation]'); if(!button)return;
  const choice=[preparationResult.recommendation,...preparationResult.alternatives][Number(button.dataset.usePreparation)]; if(!choice)return;
  recordVisiblePreparation(); if($('draft-event').value)state=saveCarePlan(state,$('draft-event').value,{action:choice.action,amountWon:choice.amountWon,note:choice.steps.join(' · ').slice(0,1000)});
  if(preparationLogId) {
    const at = new Date(), shown = state.preparations.find(item => item.id === preparationLogId)?.shownAt, seconds = Math.floor((at.getTime() - Date.parse(shown)) / 1000);
    try { state = updatePreparation(state, preparationLogId, { chosenAction: choice.action, elapsedSeconds: seconds >= 0 && seconds <= 86400 ? seconds : null }, at); }
    catch { preparationLogId = null; preparationLogError = '이번 계획은 기억했지만 준비 통계의 시간을 확인하지 못했어요.'; $('preparation-log-status').textContent = preparationLogError; }
  }
  save(); renderPreparationSummary(); renderBrief(); renderEvents();
  $('preparation-result').innerHTML=`<p class="preparation-selected"><img src="assets/sticker-check.webp" alt="">${escapeHTML(choice.title)} · 이번 계획으로 기억했어요.</p>${preparationLogId ? `<p class="helper">이 준비가 마음에 맞았나요? <span class="optional">선택</span></p><div class="action-row">${[1,2,3,4,5].map(value=>`<button type="button" class="soft-button" data-preparation-rating="${value}">${value}점</button>`).join('')}</div>` : ''}<div class="action-row"><button type="button" class="text-button" data-prepare-again>다른 준비 살펴보기</button><button type="button" class="text-button" data-reset-preparation>조건 다시 정하기</button></div>`;
});
on('preparation-result','click',e=>{const rating=e.target.closest('[data-preparation-rating]'); if(rating&&preparationLogId){state=updatePreparation(state,preparationLogId,{satisfaction:Number(rating.dataset.preparationRating)});save();renderPreparationSummary();rating.parentElement.innerHTML='<p class="helper">직접 답해 준 만족도를 기록했어요.</p>';}if(e.target.closest('[data-prepare-again]')){preparationLogId=null;renderPreparation(true);}});
on('preparation-result','click',e=>{if (!e.target.closest('[data-reset-preparation]')) return; preparationInputs = {attendance:'undecided',timeMinutes:null,budgetWon:null}; preparationLogId = null; renderPreparation(true);});
on('review-message','click',checkMessage);
on('draft-preference-review','click',e=>{
  const button=e.target.closest('[data-remember-preference]');if(!button)return;
  if(!preferenceContext||preferenceContext.epoch!==authEpoch||preferenceContext.personId!==selectedId||preferenceContext.text!==$('draft-text').value.trim())throw Error('문구나 사람이 바뀌었어요. 다시 점검해 주세요.');
  const candidate=preferenceCandidates[Number(button.dataset.rememberPreference)];if(!candidate)return;
  state.people=state.people.map(item=>item.id===selectedId?applyPreferenceCandidate(item,candidate,{confirmed:true}):item);save();renderHistory();restoreConversation();button.disabled=true;button.textContent='확인한 표현으로 기억했어요';
});
for(const id of ['followup-list','person-followups']) {
  on(id,'click',followupAction);
  on(id,'submit',e=>{const form=e.target.closest('[data-followup-delay]');if(!form)return;e.preventDefault();const item=state.followups.find(row=>row.id===form.dataset.followupDelay);const decision=planFollowupAction(item,{action:'later',today:today(),dueOn:form.querySelector('input').value});state=updateFollowup(state,item.id,decision.patch);save();renderFollowups();renderCareFocus();notify('내가 고른 날 다시 보여드릴게요.');});
}
on('followup-form','submit',e=>{e.preventDefault();state=addFollowup(state,{personId:selectedId,title:$('followup-title').value,dueOn:$('followup-date').value});$('followup-form').reset();save();renderFollowups();renderCareFocus();notify('다음에 다시 챙길 마음을 기억했어요.');});
on('preview-memory-card','click',previewMemoryCard);
for (const type of ['input', 'change']) on('memory-card-builder', type, () => { releaseMemoryCard(); $('preview-memory-card').disabled = false; $('memory-card-status').textContent = '선택한 내용으로 미리보기를 다시 만들 수 있어요.'; });
on('close-memory-card','click',()=>{$('memory-card-dialog').close();});
on('download-memory-card','click',()=>{if(!cardURL)throw Error('카드 미리보기를 다시 만들어 주세요.');const link=document.createElement('a');link.href=cardURL;link.download=cardFilename;link.click();});
on('go-events', 'click', () => switchTab('events')); on('generate-draft', 'click', () => changeDraft()); on('draft-event', 'change', () => { followupContext=null;checkinMode=!$('draft-event').value;resetDraft(); $('draft-style').value = defaultDraftApproach(person(),state.events.find(item=>item.id===$('draft-event').value)?.type||'checkin'); updateMood(); renderBrief(); }); on('draft-style', 'change', () => changeDraft()); on('draft-intent', 'change', () => changeDraft({ intentChanged: true })); on('draft-text', 'input', () => { $('draft-confirm').checked = false; invalidateMessageReview(); renderSavedDraft(); });
on('save-draft-only', 'click', () => {
  const input = checkedDraftInput({ rememberOnly: true }); if (!input) return;
  state = rememberDraft(state, input); const saved = save(); renderHistory(); renderSavedDraft(); stashDraft();
  if (!saved) return;
  notify('보관함에 기억했어요. 이전 문구도 남아 있어요. 복사나 연락 완료는 별도예요.');
});
on('library-scope', 'change', () => renderSavedDraft());
on('library-search', 'input', () => renderSavedDraft());
on('library-favorites-only', 'change', () => renderSavedDraft());
on('library-reset', 'click', () => {
  $('library-search').value = ''; $('library-favorites-only').checked = false;
  renderSavedDraft(); $('library-search').focus();
});
on('saved-message-select', 'change', () => renderLibrarySelection());
on('load-saved-message', 'click', () => loadSavedMessage());
on('favorite-saved-message', 'click', () => {
  const item = libraryItems().find(row => row.id === $('saved-message-select').value); if (!item) throw Error('보관한 문구를 골라 주세요.');
  state = toggleMessageFavorite(state, { personId: selectedId, messageId: item.id });
  const saved = save(); renderSavedDraft(); renderHistory(); if (saved) notify(item.favorite ? '즐겨찾기를 해제했어요.' : '즐겨찾기에 넣었어요. 다음에 먼저 찾아볼 수 있어요.');
});
on('delete-saved-message', 'click', () => deleteSavedMessage());
on('copy-draft', 'click', async () => {
  const input = checkedDraftInput(); if (!input) return;
  const text = input.text;
  const draft = currentDraft, ownerId = selectedId, epoch = authEpoch, remember = $('remember-draft').checked;
  recordDraft(state, input); if (remember) rememberDraft(state, input);
  await copyText(text);
  selectedMemory();
  if (epoch !== authEpoch || currentDraft !== draft || selectedId !== ownerId || (draft.eventId&&!state.events.some(item => item.id === draft.eventId)) || !person()) { notify('메시지는 복사했지만 자료가 바뀌어 기록을 추가하지 않았어요.'); return; }
  state = recordDraft(state, input); if (remember) state = rememberDraft(state, input);
  const saved = save(); renderHistory(); renderSavedDraft(); stashDraft();
  if (!saved) { notify('메시지는 복사했지만 기기에 기록을 저장하지 못했어요. 새로고침 전에 백업을 내보내 주세요.'); return; }
  notify(remember ? draft.eventId ? '문구를 복사하고, 이 행사에 다시 쓸 내 문구로 기억했어요.' : '문구를 복사하고, 다음 안부에 다시 쓸 내 문구로 기억했어요.' : '문구를 복사했어요. 직접 전한 뒤 완료를 표시해 주세요.');
});
on('complete-event', 'click', () => finishEvent('contacted')); on('remember-event', 'click', () => finishEvent('remembered'));
on('persist-toggle', 'change', () => { persist = $('persist-toggle').checked; if (persist) { if (!save()) return; } else { try { localStorage.removeItem(STORAGE_KEY); saveFailed = false; } catch { persist = true; updateStorageLabel(); notify('저장 자료를 지우지 못했어요. 브라우저의 사이트 데이터도 확인해 주세요.'); return; } } updateStorageLabel(); notify(persist ? '이 브라우저에 저장해요. 보관을 선택한 원문도 포함하며 녹음은 제외해요.' : '브라우저 저장을 껐어요. 현재 화면의 자료는 이번 사용 중에만 남아요.'); });
on('export-data', 'click', () => { download(JSON.stringify(exportBackup(state), null, 2), 'synk-care.json', 'application/json'); notify('복원할 수 있는 백업을 내보냈어요. 보관한 대화 원문을 포함하고 녹음은 제외해요.'); });
on('import-data', 'change', async () => {
  const file = $('import-data').files[0]; if (!file) return;
  const baseline = JSON.stringify(state), baselineEpoch = authEpoch;
  try {
    if (file.size > 4 * 1024 * 1024) throw Error('백업 파일은 4 MB 이내로 가져와 주세요.');
    const restored = importBackup(await file.text());
    if (authEpoch !== baselineEpoch || JSON.stringify(state) !== baseline) throw Error('파일을 읽는 동안 자료가 바뀌었어요. 다시 가져와 주세요.');
    const accepted = await confirmDelete(`사람 ${restored.people.length}명, 일정 ${restored.events.length}개, 문구 ${restored.drafts.length}개를 복원해요. 현재 화면의 자료를 이 백업으로 바꿉니다. 필요한 현재 자료는 먼저 내보내 주세요.`, '백업 복원', '이 백업으로 복원');
    if (!accepted) return;
    if (authEpoch !== baselineEpoch || JSON.stringify(state) !== baseline) throw Error('확인하는 동안 자료가 바뀌었어요. 다시 가져와 주세요.');
    if (persist && !accountId) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(restored)); }
      catch { throw Error('기기에 복원본을 저장하지 못해 현재 자료를 유지했어요. 저장 공간을 확인해 주세요.'); }
    }
    state = restored; selectedId = null; activeView = 'home'; sampleMode = false; saveFailed = false;
    conversations.clear(); sessionDrafts.clear(); notified.clear(); clearAudio(); clearConversationFields(); resetDraft(); resetEventForm(); $('text-file').value = '';
    render(); save(); notify('백업을 복원했어요. 내 자료 보관 상태를 확인해 주세요.');
  } finally { $('import-data').value = ''; }
});
async function deleteAll(message) {
  const epoch = authEpoch;
  if (!await confirmDelete(message) || epoch !== authEpoch) return;
  if (accountId) { if (!await sync.remove()) throw Error('계정 자료를 삭제하지 못했어요. 연결 상태와 충돌 안내를 확인해 주세요.'); await carePush.prepare(); notify('계정의 플레저 수첩을 삭제했어요. 다른 기기도 다음 연결 때 반영돼요.'); return; }
  state = emptyState(); selectedId = null; activeView = 'home'; sampleMode = false; persist = false; saveFailed = false; conversations.clear(); sessionDrafts.clear(); notified.clear(); resetDraft(); resetEventForm(); clearAudio(); clearConversationFields(); $('text-file').value = ''; $('person-form').reset(); invalidateCapture(); $('capture-source').value = ''; $('capture-title').value = ''; $('care-log-form').reset();
  try { localStorage.removeItem(STORAGE_KEY); } catch { persist = true; saveFailed = true; notify('화면 자료를 지웠지만 브라우저 저장은 지우지 못했어요. 사이트 데이터에서 삭제해 주세요.'); render(); return; }
  render(); notify('이 앱의 자료를 삭제했어요. 이미 내보낸 파일은 별도로 삭제해 주세요.');
}
on('delete-data', 'click', () => deleteAll('사람, 말투 관찰, 일정, 초안과 챙김 기록을 모두 삭제할까요? 이미 내보낸 파일은 별도로 삭제해야 해요.'));
on('clear-sample', 'click', () => deleteAll('예시를 포함해 지금 앱에 있는 자료를 모두 지울까요?'));
on('sample-button', 'click', () => {
  const sample = makePerson({ name: '지민', relationship: '친구 · 예시 인물', selfTone: analyzeTone('생일 축하해! 오늘 좋아하는 거 먹어. 좋은 하루 보내 😊'), recipientPreference: { confirmed: true, formality: 'casual', salutation: '지민아', length: 'balanced', allowEmoji: true, avoidPromises: true, avoidPhrases: ['나이'], note: '예시: 나이 이야기는 빼기' } });
  const date = new Date(Date.now() + 3 * 86400000); const dateString = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  state.people.push(sample); state.events.push(makeEvent({ personId: sample.id, type: 'birthday', date: dateString, title: '지민 생일', repeat: 'yearly' }));
  const quiet = makePerson({ name: '서연', relationship: '친구 · 예시 인물', notes: '예시: 답장을 기다리지 않고 안부만 전하기', recipientPreference: { confirmed: true, formality: 'polite', noReplyPressure: true } });
  state.people.push(quiet); state.events.push(makeEvent({ personId: quiet.id, type: 'memorial', date: today(), title: '아버님 기일', repeat: 'yearly' }));
  conversations.set(sample.id, { text: '나: 생일 축하해! 오늘 좋아하는 거 먹어 😊\n상대: 고마워! 기억해 줘서 좋다.', selfText: '생일 축하해! 오늘 좋아하는 거 먹어 😊', otherText: '고마워! 기억해 줘서 좋다.', verified: true }); sampleMode = true; showHome(); save(); notify('가상의 두 사람과 예시 일정이에요. 실제 자료를 넣기 전에는 예시를 지워 주세요.');
});
on('notification-button', 'click', () => { renderPushSettings(); $('notification-dialog').showModal(); void carePush.prepare(); });
on('close-notification-dialog', 'click', () => $('notification-dialog').close());
on('push-signin', 'click', async () => { $('notification-dialog').close(); try { await account.signIn(); } catch (error) { accountStatus = resumeCareLoginNavigation(accountStatus, true); renderAccount(); throw error; } });
on('push-retry', 'click', () => carePush.prepare());
on('push-enable', 'click', () => carePush.enable(...pushTime()));
on('push-cancel', 'click', () => carePush.cancelEnable());
on('push-save', 'click', () => carePush.update(...pushTime()));
on('push-disable', 'click', () => carePush.disable());
on('push-open-only', 'click', async () => {
  if (!('Notification' in window)) { notificationStatus(); throw Error('이 환경은 웹 알림을 지원하지 않아요. 달력 저장을 이용해 주세요.'); }
  const permission = await Notification.requestPermission(); notificationStatus();
  if (permission === 'granted') { checkReminders(); notify('앱을 열어 둔 동안 알림을 표시해요. 앱을 닫아도 받으려면 이 기기에 알림 켜기를 선택해 주세요.'); }
  else notify('알림 권한을 받지 못했어요. 다음 일정을 달력에 저장하면 달력 앱에서 알림을 설정할 수 있어요.');
});
if (window.synkProduct?.openInBrowser) { $('open-browser').hidden = false; on('open-browser', 'click', async () => { const result = await window.synkProduct.openInBrowser(); if (result?.ok === false) throw Error('브라우저를 열지 못했어요. http://127.0.0.1:4296/ 로 접속해 주세요.'); }); }

load(); render(true); switchTab('events'); updateEventType(); notificationStatus(); checkCapabilities(); checkReminders(); startAccount();
setInterval(() => { try { renderPeople(); renderHome(); renderEvents(); checkReminders(); } catch { /* 잘못된 상태는 다음 사용자 행동에서 확인한다. */ } }, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { notificationStatus(); renderHome(); if (accountId) void carePush.prepare(); checkReminders(); } });
window.addEventListener('beforeunload', event => { if (accountId && (syncStatus.pending || hasUnsubmittedAccountInput())) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => { releaseMemoryCard(); if (audioURL) URL.revokeObjectURL(audioURL); });
window.addEventListener('pageshow', event => { const restored = resumeCareLoginNavigation(accountStatus, event.persisted); if (restored !== accountStatus && !accountId) { accountStatus = restored;renderAccount(); } });
window.addEventListener('online', () => { if (accountId && syncStatus.pending) void sync.flush(); });
document.documentElement.dataset.ready = 'true';
