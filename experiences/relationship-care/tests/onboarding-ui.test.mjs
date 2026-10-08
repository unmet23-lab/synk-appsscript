import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { emptyState, makePerson, makeEvent, upcomingEvents, defaultDraftApproach, draftMessage, generateCheckinDraft } from '../model.mjs';

const source = readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
const NOW = '2026-10-08T03:00:00.000Z';
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (start < 0) throw Error(`Missing shipped function: ${name}`);
  const next = source.slice(start + 1).search(/^(?:async )?function /m);
  if (next < 0) throw Error(`Missing shipped function boundary: ${name}`);
  return source.slice(start, start + next + 1);
}
function handlerSource(id) {
  const start = source.indexOf(`on('${id}',`);
  if (start < 0) throw Error(`Missing shipped handler: ${id}`);
  const rest = source.slice(start), next = rest.search(/\r?\n(?=on\()/u);
  if (next < 0) throw Error(`Missing shipped handler boundary: ${id}`);
  return rest.slice(0, next);
}
const person = (extra = {}) => makePerson({ id: 'p', name: '기존 친구', ...extra });

// Execute the shipped creation, navigation and composition path. Minimal DOM
// elements implement select-value semantics and invalid-event listeners; only
// unrelated media, timeline and visual rendering are replaced.
function harness(people = [], events = []) {
  const elements = new Map(), handlers = new Map(), notices = [], writes = [], calls = [], invalidListeners = [];
  const defaults = { 'person-edit-id': '', 'new-person-name': '', 'new-person-relationship': '', 'new-person-group': 'other', 'new-person-notes': '', 'new-person-checkin': '30', 'new-person-checkin-days': '30', 'quick-event-date': '', 'quick-event-type': 'birthday' };
  const descendants = { 'person-details': ['new-person-relationship', 'new-person-group', 'new-person-checkin', 'new-person-checkin-days', 'new-person-notes'], 'quick-event-fields': ['quick-event-type', 'quick-event-date'] };
  const element = id => {
    if (!elements.has(id)) {
      const node = { id, value: defaults[id] ?? (id === 'draft-intent' ? 'everyday' : ''), hidden: false, open: false, required: false, disabled: false, textContent: '', checked: false, dataset: {},
        showModal() { this.open = true; }, close() { this.open = false; },
        reset() { if (id === 'person-form') for (const [field, value] of Object.entries(defaults)) element(field).value = value; },
        contains(target) { return descendants[id]?.includes(target.id) ?? false; },
        addEventListener(type, callback, capture) { if (id === 'person-form' && type === 'invalid') invalidListeners.push({ callback, capture }); },
        replaceChildren() {}, focus() {}, scrollIntoView() {},
      };
      if (id === 'draft-event') {
        let options = [], value = '';
        Object.defineProperties(node, {
          innerHTML: { set(html) {
            options = [...html.matchAll(/<option value="([^"]*)"(?: data-occurrence-id="([^"]*)")?/gu)].map(match => ({ value: match[1], dataset: { occurrenceId: match[2] } }));
            value = options[0]?.value ?? '';
          } },
          value: { get() { return value; }, set(next) { value = options.some(option => option.value === next) ? next : ''; } },
          selectedOptions: { get() { return options.filter(option => option.value === value); } },
        });
      }
      elements.set(id, node);
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    state: { ...emptyState(), people, events }, selectedId: people[0]?.id ?? null, personDialogContext: null, authEpoch: 0,
    currentDraft: null, memoryChoice: null, followupContext: null, checkinMode: false, logOccurrence: null,
    activeView: 'person', activeTab: 'events', preparationKey: '', persist: false, accountId: null, sampleMode: false, saveFailed: false,
    sessionDrafts: new Map(), notified: new Set(), STORAGE_KEY: 'onboarding-test', storageFails: false, failWriteAt: 0, writeAttempts: 0, locked: false,
    $: element, makePerson, makeEvent, emptyState, defaultDraftApproach, draftMessage, generateCheckinDraft,
    notebookView: () => ({ locked: context.locked }),
    hasPersonalizationInput: () => !!context.memoryChoice || !!element('personal-memory').value || (context.currentDraft?.eventType === 'checkin' && !!element('draft-text').value.trim()),
    on: (id, type, handler) => handlers.set(`${id}:${type}`, handler), notify: text => notices.push(text), confirmDelete: async () => true,
    escapeHTML: text => String(text), matchMedia: () => ({ matches: true }),
    updateStorageLabel() {}, renderPeople() {}, renderHome() {}, renderHistory() {}, renderCapturePeople() {}, renderBrief() {}, renderEvents() {}, restoreConversation() {},
    renderSavedDraft() {}, renderDraftNotice() {}, renderMemoryApplication() {}, updateMood() {}, updateView() {},
    invalidateMessageReview() {}, resetMemoryCard() {}, stashConversation() {}, resetEventForm() {}, clearAudio() {}, clearConversationFields() {},
    resetPersonalMemory() { context.memoryChoice = null; element('personal-memory').value = ''; }, selectedMemory: () => null,
    localStorage: { setItem(key, value) { context.writeAttempts++; if (context.storageFails || context.writeAttempts === context.failWriteAt) throw Error('Storage full'); writes.push({ key, value }); } },
  });
  context.person = () => context.state.people.find(item => item.id === context.selectedId);
  context.currentRows = () => upcomingEvents(context.state, NOW).filter(row => row.person.id === context.selectedId);
  context.render = restore => context.renderWorkspace(restore);
  context.switchTab = name => { context.activeTab = name; if (name === 'message') context.renderMessageOptions(); };
  vm.runInContext([
    'save', 'openPersonDialog', 'updatePersonSubmit', 'revealPersonInvalidField', 'checkinSummary', 'updateCheckinInput', 'checkinInput',
    'choosePerson', 'stashDraft', 'restoreDraft', 'resetDraft', 'renderWorkspace', 'renderMessageOptions', 'generateDraft', 'prepareEvent', 'beginCheckin',
  ].map(functionSource).join('\n'), context);
  for (const name of ['choosePerson', 'beginCheckin', 'prepareEvent', 'generateDraft']) {
    const original = context[name];
    context[name] = (...args) => { calls.push({ name, args }); return original(...args); };
  }
  // quick-event-date's shipped registration includes the form invalid listener.
  vm.runInContext(['new-person-checkin', 'quick-event-date', 'close-person-dialog', 'person-form'].map(handlerSource).join('\n'), context);
  const submit = () => handlers.get('person-form:submit')({ preventDefault() {} });
  const start = (name = '새 친구', type = '', date = '') => {
    context.openPersonDialog(); element('new-person-name').value = name;
    if (type) element('quick-event-type').value = type;
    element('quick-event-date').value = date;
    handlers.get('quick-event-date:input')();
  };
  return { context, element, handlers, notices, writes, calls, invalidListeners, submit, start };
}

test('신규 등록은 상세와 선택 날짜가 접히고 첫 안부 힌트가 보이며 수정에서는 상세만 펼쳐진다', () => {
  const { context, element, start } = harness([person({ checkinIntervalDays: 45 })]);
  context.openPersonDialog(true);
  assert.equal(element('person-details').open, true);
  assert.equal(element('person-start-hint').hidden, true);
  assert.equal(element('quick-event-fields').hidden, true);
  assert.equal(element('person-submit').textContent, '수정 내용 저장');
  start();
  assert.equal(element('person-details').open, false);
  assert.equal(element('quick-event-fields').open, false);
  assert.equal(element('quick-event-fields').hidden, false);
  assert.equal(element('person-start-hint').hidden, false);
  assert.equal(element('person-submit').textContent, '기억하고 첫 안부 준비');
  start('새 친구', 'birthday', '2026-10-10');
  assert.equal(element('person-submit').textContent, '기억하고 마음 준비');
});

test('이름만 등록하면 해당 사람의 첫 일상 안부를 바로 열고 행사·복사·완료 기록은 만들지 않는다', async () => {
  const { context, element, calls, notices, submit, start } = harness();
  start('수민'); await submit();
  const added = context.state.people[0];
  assert.equal(added.name, '수민');
  assert.equal(Object.hasOwn(added, 'checkinIntervalDays'), false);
  assert.equal(context.selectedId, added.id);
  assert.equal(context.activeTab, 'message');
  assert.equal(context.currentDraft.personId, added.id);
  assert.equal(context.currentDraft.eventId, '');
  assert.equal(context.currentDraft.eventType, 'checkin');
  assert.match(element('draft-text').value, /수민님.*안부/u);
  assert.equal(element('draft-confirm').checked, false);
  assert.equal(calls.filter(item => item.name === 'beginCheckin').length, 1);
  assert.equal(calls.filter(item => item.name === 'prepareEvent').length, 0);
  assert.equal(context.state.events.length + context.state.drafts.length + context.state.completions.length + context.state.activities.length, 0);
  assert.match(notices.at(-1), /첫 문구를 준비했어요/u);
});

test('선택 날짜를 함께 등록하면 다른 사람의 일정 대신 새 사람의 해당 행사 초안을 연다', async () => {
  const old = person(), oldEvent = makeEvent({ id: 'old_event', personId: old.id, type: 'birthday', date: '2026-10-09' });
  const { context, element, calls, submit, start } = harness([old], [oldEvent]);
  start('지민', 'wedding', '2026-10-10'); await submit();
  const added = context.state.people.find(item => item.id !== old.id), event = context.state.events.find(item => item.personId === added.id);
  assert.equal(context.selectedId, added.id);
  assert.equal(context.currentDraft.personId, added.id);
  assert.equal(context.currentDraft.eventId, event.id);
  assert.equal(context.currentDraft.eventType, 'wedding');
  assert.equal(context.currentDraft.occurrenceId, `${event.id}:2026-10-10`);
  assert.equal(element('draft-event').value, event.id);
  assert.match(element('draft-text').value, /결혼/u);
  assert.equal(calls.filter(item => item.name === 'beginCheckin').length, 0);
  assert.equal(calls.filter(item => item.name === 'prepareEvent').length, 1);
});

test('지난 일회성 결혼·부고는 저장만 하고 다른 상황의 첫 초안을 만들거나 준비 완료라고 알리지 않는다', async () => {
  for (const type of ['wedding', 'condolence']) {
    const { context, element, calls, notices, submit, start } = harness();
    start('지민', type, '2026-10-07'); await submit();
    assert.equal(context.state.people.length, 1);
    assert.equal(context.state.events[0].type, type);
    assert.equal(context.currentDraft, null);
    assert.equal(element('draft-text').value, '');
    assert.equal(calls.filter(item => item.name === 'generateDraft').length, 0);
    assert.match(notices.at(-1), /지난 일정/u);
    assert.ok(notices.every(text => !/첫 문구를 준비했어요/u.test(text)));
    assert.equal(await context.prepareEvent(context.state.events[0].id), false);
  }
});

test('기존 사람 정보 수정은 사람 전환과 초안 생성 없이 작성 중인 글·선택 기억을 보존한다', async () => {
  const { context, element, calls, submit } = harness([person({ checkinIntervalDays: 45 })]);
  context.checkinMode = true; context.renderMessageOptions();
  context.generateDraft({ silent: true });
  const draft = context.currentDraft, memory = { personId: 'p', memoryId: 'selected_memory', use: 'shared-memory', epoch: 0 };
  context.memoryChoice = memory;
  draft.memory = { text: '함께한 산책' };
  element('draft-text').value = '직접 다듬던 문구와 함께한 산책';
  element('draft-confirm').checked = true;
  calls.length = 0;
  context.openPersonDialog(true); element('new-person-name').value = '수정한 친구 이름';
  await submit();
  assert.equal(context.state.people[0].name, '수정한 친구 이름');
  assert.equal(context.state.people[0].checkinIntervalDays, 45);
  assert.equal(context.currentDraft, draft);
  assert.equal(context.memoryChoice, memory);
  assert.equal(element('draft-text').value, '직접 다듬던 문구와 함께한 산책');
  assert.equal(element('draft-confirm').checked, true);
  assert.deepEqual(calls, []);
});

test('새 사람 저장 뒤 전환을 취소하면 기존 글을 유지하고 첫 준비가 끝났다고 알리지 않는다', async () => {
  const { context, element, calls, notices, submit, start } = harness([person()]);
  context.checkinMode = true; context.renderMessageOptions(); context.generateDraft({ silent: true });
  const draft = context.currentDraft;
  element('draft-text').value = '지금 작성 중인 글';
  context.confirmDelete = async () => false; calls.length = 0;
  start('추가한 친구'); await submit();
  assert.equal(context.state.people.length, 2);
  assert.equal(context.selectedId, 'p');
  assert.equal(context.currentDraft, draft);
  assert.equal(element('draft-text').value, '지금 작성 중인 글');
  assert.equal(calls.filter(item => ['beginCheckin', 'prepareEvent', 'generateDraft'].includes(item.name)).length, 0);
  assert.match(notices.at(-1), /사람 목록에서 새 수첩/u);
  assert.ok(notices.every(text => !/첫 문구를 준비했어요/u.test(text)));
});

test('저장 뒤 사람 전환을 기다리다가 계정이 바뀌면 첫 준비와 성공 안내를 중단한다', async () => {
  const { context, element, calls, notices, submit, start } = harness([person()]);
  context.checkinMode = true; context.renderMessageOptions(); context.generateDraft({ silent: true });
  element('draft-text').value = '이전 계정 글';
  context.confirmDelete = async () => { context.authEpoch++; return true; };
  calls.length = 0;
  start('새 친구'); await submit();
  assert.equal(calls.filter(item => ['beginCheckin', 'prepareEvent', 'generateDraft'].includes(item.name)).length, 0);
  assert.equal(notices.length, 0);
});

test('첫 저장 또는 사람 전환 때 저장이 실패하면 메모리에 남기고 첫 준비·성공 안내를 중단한다', async () => {
  for (const failWriteAt of [1, 2]) {
    const { context, element, calls, notices, submit, start } = harness();
    context.persist = true; context.failWriteAt = failWriteAt;
    start('새 친구'); await submit();
    assert.equal(context.state.people.length, 1);
    assert.equal(context.saveFailed, true);
    assert.equal(context.currentDraft, null);
    assert.equal(element('person-dialog').open, false);
    assert.equal(context.personDialogContext, null);
    assert.equal(calls.filter(item => ['beginCheckin', 'prepareEvent', 'generateDraft'].includes(item.name)).length, 0);
    assert.ok(notices.some(text => /저장하지 못했어요/u.test(text)));
    assert.ok(notices.every(text => !/첫 문구를 준비했어요|수첩에 기억했어요/u.test(text)));
  }
});

test('접힌 상세나 날짜의 잘못된 입력은 실제 invalid 등록을 통해 해당 영역만 펼친다', () => {
  const { element, invalidListeners, start } = harness();
  start();
  assert.equal(invalidListeners.length, 1);
  assert.equal(invalidListeners[0].capture, true);
  invalidListeners[0].callback({ target: element('new-person-checkin-days') });
  assert.equal(element('person-details').open, true);
  assert.equal(element('quick-event-fields').open, false);
  element('person-details').open = false;
  invalidListeners[0].callback({ target: element('quick-event-date') });
  assert.equal(element('person-details').open, false);
  assert.equal(element('quick-event-fields').open, true);
});

test('간소화한 신규 등록에서도 주기 기본값 부재·추천 끄기·직접 간격을 정확하게 저장한다', async () => {
  for (const [selection, raw, expected] of [['30', '', undefined], ['0', '', 0], ['custom', '45', 45]]) {
    const { context, element, handlers, submit, start } = harness();
    start();
    element('new-person-checkin').value = selection;
    if (raw) element('new-person-checkin-days').value = raw;
    handlers.get('new-person-checkin:change')();
    await submit();
    assert.equal(context.state.people[0].checkinIntervalDays, expected);
    assert.equal(Object.hasOwn(context.state.people[0], 'checkinIntervalDays'), expected !== undefined);
    assert.equal(context.currentDraft.eventType, 'checkin', '추천 끄기는 직접 요청한 첫 안부 준비를 막지 않는다');
  }
});

test('접힌 상세의 잘못된 직접 간격이나 잘못된 날짜는 사람·일정을 부분 저장하지 않는다', async () => {
  for (const field of ['interval', 'date']) {
    const { context, element, handlers, calls, submit, start } = harness();
    start();
    if (field === 'interval') {
      element('new-person-checkin').value = 'custom'; element('new-person-checkin-days').value = '1e2';
      handlers.get('new-person-checkin:change')();
    } else element('quick-event-date').value = '2026-02-30';
    await assert.rejects(submit());
    assert.equal(context.state.people.length + context.state.events.length, 0);
    assert.equal(calls.length, 0);
    assert.equal(element('person-dialog').open, true);
  }
});
