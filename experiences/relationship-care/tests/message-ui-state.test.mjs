import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { emptyState, makePerson, makeEvent, defaultDraftApproach, rememberDraft, recordDraft, draftMessage, generateCheckinDraft, captureSource, CHECKIN_INTENTS, EVENT_TYPES, listSavedMessages, toggleMessageFavorite, removeSavedMessage } from '../model.mjs';

const source = readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');

// Execute the shipped event/functions with a small DOM boundary. These tests
// assert visible/state outcomes, not whether implementation strings exist.
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (start < 0) throw Error(`App function not found: ${name}`);
  const rest = source.slice(start + 1), next = rest.search(/^(?:async )?function /m);
  if (next < 0) throw Error(`App function boundary not found: ${name}`);
  return source.slice(start, start + 1 + next);
}

function handlerSource(id) {
  const start = source.indexOf(`on('${id}',`);
  if (start < 0) throw Error(`App handler not found: ${id}`);
  const rest = source.slice(start), next = rest.search(/\r?\n(?=on\()/u);
  if (next < 0) throw Error(`App handler boundary not found: ${id}`);
  return rest.slice(0, next);
}

function harness(people, events = []) {
  const elements = new Map(), notices = [], handlers = new Map(), clipboard = [];
  const element = id => {
    if (!elements.has(id)) {
      const attributes = new Map();
      const node = { value: id === 'draft-intent' ? 'everyday' : id === 'library-scope' ? 'context' : '', hidden: false, textContent: '', checked: false, dataset: {}, reset() {}, replaceChildren() {}, focus() {}, scrollIntoView() {}, setAttribute(name, value) { attributes.set(name, String(value)); }, getAttribute(name) { return attributes.get(name) ?? null; } };
      if (id === 'draft-event' || id === 'saved-message-select') {
        let options = [];
        Object.defineProperties(node, {
          innerHTML: { set(html) {
            options = [...html.matchAll(/<option value="([^"]*)"(?: data-occurrence-id="([^"]*)")?/gu)]
              .map(match => ({ value: match[1], dataset: { occurrenceId: match[2] } }));
            this.value = options[0]?.value || '';
          } },
          selectedOptions: { get() { return options.filter(option => option.value === this.value); } },
        });
      }
      elements.set(id, node);
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    state: { ...emptyState(), people, events }, selectedId: people[0]?.id || null,
    currentDraft: null, memoryChoice: null, checkinMode: false, followupContext: null,
    authEpoch: 0, activeView: 'person', logOccurrence: null, expressionReview: null,
    persist: false, accountId: null, saveFailed: false, sampleMode: false, preparationKey: '',
    sessionDrafts: new Map(), notified: new Set(), STORAGE_KEY: 'test-care',
    $: element, defaultDraftApproach, rememberDraft, recordDraft, makePerson, draftMessage, generateCheckinDraft,
    CHECKIN_INTENTS, EVENT_TYPES, listSavedMessages, toggleMessageFavorite, removeSavedMessage,
    escapeHTML: value => String(value),
    notebookView: () => ({ locked: false }), hasPersonalizationInput: () => false,
    invalidateMessageReview() {}, updateMood() {}, renderBrief() {}, resetPersonalMemory() {},
    resetMemoryCard() {}, stashConversation() {}, resetEventForm() {}, clearAudio() {},
    restoreDraft() {}, updateStorageLabel() {}, renderHistory() {},
    selectedMemory: () => null, checkMessage: () => ({ issues: [] }),
    confirmDelete: async () => false, notify: message => notices.push(message),
    on: (id, event, handler) => handlers.set(`${id}:${event}`, handler),
    document: { querySelector: () => element('draft-window') },
    matchMedia: () => ({ matches: true }), copyText: async text => { clipboard.push(text); },
    localStorage: { setItem() {} },
  });
  context.person = () => context.state.people.find(person => person.id === context.selectedId);
  context.currentRows = () => context.state.events.filter(event => event.personId === context.selectedId)
    .map(event => ({ event, occurrence: { date: event.date, occurrenceId: `${event.id}:${event.date}` } }));
  context.render = () => context.renderMessageOptions();
  context.switchTab = () => context.renderMessageOptions();
  vm.runInContext([
    'save', 'stashDraft', 'renderDraftNotice', 'renderSavedDraft', 'resetDraft',
    'libraryType', 'librarySearchText', 'libraryFilterState', 'libraryContextItems', 'libraryItems', 'libraryLabel', 'renderLibrarySelection', 'loadSavedMessage', 'deleteSavedMessage',
    'renderMessageOptions', 'choosePerson', 'checkedDraftInput', 'changeDraft',
    'memoryFingerprint', 'resetPersonalMemory', 'selectedMemory', 'renderMemoryApplication', 'generateDraft',
  ].map(functionSource).join('\n'), context);
  vm.runInContext(['save-draft-only', 'copy-draft', 'apply-personal-memory', 'clear-personal-memory', 'preference-form', 'library-scope', 'saved-message-select', 'load-saved-message', 'favorite-saved-message', 'delete-saved-message'].map(handlerSource).join('\n'), context);
  return { context, element, notices, handlers, clipboard };
}

const person = (id, extra = {}) => makePerson({ id, name: `사람 ${id}`, ...extra });
const birthday = makeEvent({ id: 'birthday-a', personId: 'a', type: 'birthday', date: '2030-10-10' });
const saved = text => ({ text, savedAt: '2026-10-08T00:00:00.000Z' });

test('switching people refreshes saved wording for the newly selected message context', async () => {
  const { context, element } = harness([
    person('a'),
    person('b', { savedMessages: { birthday: saved('B의 생일 인사'), checkin: saved('B의 안부 인사') } }),
  ], [birthday]);
  element('draft-event').value = birthday.id;
  element('draft-style').value = 'short';

  assert.equal(await context.choosePerson('b', 'message'), true);

  assert.equal(element('draft-event').value, '');
  assert.equal(element('saved-draft-preview').hidden, false);
  assert.equal(element('saved-draft-text').textContent, 'B의 안부 인사');
  assert.equal(element('draft-style').value, 'warm', 'legacy checkins have no confirmed intent and must not become the automatic first draft');
});

test('a new person starts with their own confirmed length instead of the prior person selection', async () => {
  for (const [length, priorApproach, expected] of [['balanced', 'short', 'warm'], ['short', 'warm', 'short']]) {
    const { context, element } = harness([
      person('a'), person('b', { recipientPreference: { confirmed: true, length } }),
    ], [birthday]);
    element('draft-event').value = birthday.id;
    element('draft-style').value = priorApproach;

    await context.choosePerson('b', 'message');

    assert.equal(element('draft-event').value, '');
    assert.equal(element('draft-style').value, expected);
    assert.equal(element('saved-draft-preview').hidden, false, 'a new person has a visible empty library with guidance');
    assert.equal(element('saved-message-select').disabled, true);
    assert.equal(element('library-actions').hidden, true);
    assert.equal(element('saved-draft-text').textContent, '');
  }
});

test('save-only retains the draft and failure notice when persistent storage rejects the write', () => {
  const { context, element, notices, handlers } = harness([person('a')]);
  const oldStored = JSON.stringify(context.state);
  let stored = oldStored, writes = 0;
  context.persist = true;
  context.localStorage = { setItem() {
    writes++;
    const error = new Error('Storage quota exceeded'); error.name = 'QuotaExceededError'; throw error;
  }, getItem: () => stored };
  context.currentDraft = { personId: 'a', eventId: '', eventType: 'checkin', originalText: '원래 초안' };
  element('draft-text').value = '직접 다듬어 기억하려던 안부';
  element('draft-confirm').checked = true;

  handlers.get('save-draft-only:click')();

  assert.equal(writes, 1);
  assert.equal(context.saveFailed, true);
  assert.equal(stored, oldStored, 'the durable version has not changed');
  assert.equal(element('draft-text').value, '직접 다듬어 기억하려던 안부');
  assert.equal(context.state.people[0].savedMessages.checkin.text, '직접 다듬어 기억하려던 안부');
  assert.equal(context.state.drafts.length, 0, 'saving alone is not a copy record');
  assert.equal(context.state.activities.length, 0, 'saving alone is not a contact record');
  assert.equal(notices.length, 1);
  assert.match(notices.at(-1), /저장하지 못했어요/u);
});

test('canceling a new draft keeps edited text and restores its intent and style', async () => {
  for (const intentChanged of [false, true]) {
    const { context, element } = harness([person('a')]);
    const draft = { personId: 'a', eventId: '', eventType: 'checkin', originalText: '원래 초안', approach: 'short', checkinIntent: 'thanks' };
    context.currentDraft = draft;
    element('draft-text').value = '직접 다듬은 감사 인사';
    element('draft-style').value = 'warm';
    element('draft-intent').value = 'reconnect';
    let confirmations = 0, generated = 0;
    context.confirmDelete = async () => { confirmations++; return false; };
    context.generateDraft = () => { generated++; };

    await context.changeDraft({ intentChanged });

    assert.equal(confirmations, 1);
    assert.equal(generated, 0);
    assert.equal(context.currentDraft, draft);
    assert.equal(element('draft-text').value, '직접 다듬은 감사 인사');
    assert.equal(element('draft-style').value, 'short');
    assert.equal(element('draft-intent').value, 'thanks');
  }
});

test('a confirmation from the old account cannot replace the newly opened account draft', async () => {
  const { context, element } = harness([person('a'), person('b')]);
  context.currentDraft = { personId: 'a', eventId: '', eventType: 'checkin', originalText: '원래 초안', approach: 'short', checkinIntent: 'thanks' };
  element('draft-text').value = '첫 계정에서 다듬은 인사';
  let finishConfirmation, generated = 0;
  context.confirmDelete = () => new Promise(resolve => { finishConfirmation = resolve; });
  context.generateDraft = () => { generated++; };
  const changing = context.changeDraft({ intentChanged: true });
  context.authEpoch++;
  context.selectedId = 'b';
  const nextDraft = { personId: 'b', eventId: '', eventType: 'checkin', originalText: '새 계정의 문구', approach: 'warm', checkinIntent: 'everyday' };
  context.currentDraft = nextDraft;
  element('draft-text').value = nextDraft.originalText;
  element('draft-style').value = 'warm';
  element('draft-intent').value = 'everyday';
  finishConfirmation(true);
  await changing;

  assert.equal(generated, 0);
  assert.equal(context.currentDraft, nextDraft);
  assert.equal(element('draft-text').value, nextDraft.originalText);
  assert.equal(element('draft-style').value, 'warm');
  assert.equal(element('draft-intent').value, 'everyday');
});

test('applying or clearing a memory and submitting preferences retain the chosen thanks intent', async () => {
  const { context, element, handlers } = harness([person('a')]);
  const memoryText = '지난봄 함께 걸었던 강변';
  context.state = captureSource(context.state, { personId: 'a', title: '직접 확인한 기억', text: memoryText,
    memories: [{ kind: 'memory', text: memoryText, sourceQuote: memoryText }] });
  context.checkinMode = true;
  element('draft-style').value = 'warm';
  element('draft-intent').value = 'thanks';
  element('personal-memory').value = context.state.memories[0].id;
  element('personal-memory-use').value = 'shared-memory';

  await handlers.get('apply-personal-memory:click')();
  assert.equal(element('draft-intent').value, 'thanks');
  assert.equal(context.currentDraft.checkinIntent, 'thanks');
  assert.match(element('draft-text').value, /감사합니다/u);
  assert.ok(element('draft-text').value.includes(memoryText));

  await handlers.get('clear-personal-memory:click')();
  assert.equal(context.memoryChoice, null);
  assert.equal(context.currentDraft.checkinIntent, 'thanks');
  assert.match(element('draft-text').value, /감사합니다/u);
  assert.ok(!element('draft-text').value.includes(memoryText));

  element('preference-confirm').checked = true;
  element('preference-formality').value = 'polite';
  element('preference-length').value = 'short';
  element('preference-promises').checked = true;
  let prevented = false;
  handlers.get('preference-form:submit')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(element('draft-intent').value, 'thanks');
  assert.equal(context.currentDraft.checkinIntent, 'thanks');
  assert.equal(context.currentDraft.approach, 'short');
  assert.match(element('draft-text').value, /감사합니다/u);
});

test('changing intent preserves short or warm and falls back from saved wording only', async () => {
  for (const [length, approach, expected] of [
    ['balanced', 'short', 'short'], ['short', 'warm', 'warm'],
    ['balanced', 'saved', 'warm'], ['short', 'saved', 'short'],
  ]) {
    const { context, element } = harness([person('a', {
      recipientPreference: { confirmed: true, length }, savedMessages: { checkin: saved('예전에 기억한 문구') },
    })]);
    element('draft-style').value = approach;
    element('draft-intent').value = 'thanks';
    await context.changeDraft({ intentChanged: true });
    assert.equal(element('draft-style').value, expected);
    assert.equal(context.currentDraft.approach, expected);
    assert.equal(context.currentDraft.checkinIntent, 'thanks');
    assert.match(element('draft-text').value, /감사합니다/u);
    assert.doesNotMatch(element('draft-text').value, /예전에 기억한 문구/u);
  }
});

test('a changed occurrence blocks copying without erasing text but allows remembering its unchanged event type', async () => {
  const { context, element, handlers, clipboard } = harness([person('a')], [birthday]);
  const text = '직접 다듬어 둔 생일 인사';
  const draft = { personId: 'a', eventId: birthday.id, eventType: 'birthday', occurrenceId: `${birthday.id}:2030-10-10`, originalText: '원래 인사' };
  context.currentDraft = draft;
  element('draft-event').value = birthday.id;
  element('draft-text').value = text;
  element('draft-confirm').checked = true;
  context.currentRows = () => [{ event: birthday, occurrence: { date: '2031-10-10', occurrenceId: `${birthday.id}:2031-10-10` } }];

  await assert.rejects(handlers.get('copy-draft:click')(), /날짜가 바뀌었어요/u);
  assert.equal(context.currentDraft, draft);
  assert.equal(element('draft-text').value, text);
  assert.equal(clipboard.length, 0);
  assert.equal(context.state.drafts.length, 0);

  handlers.get('save-draft-only:click')();
  assert.equal(context.state.people[0].savedMessages.birthday.text, text);
  assert.equal(element('draft-text').value, text);
  assert.equal(context.state.drafts.length, 0);
  assert.equal(clipboard.length, 0);
});

test('a successful clipboard write followed by storage failure remains a storage failure notice', async () => {
  const { context, element, handlers, notices, clipboard } = harness([person('a')]);
  context.persist = true;
  let writes = 0;
  context.localStorage = { setItem() { writes++; throw Object.assign(new Error('Storage quota exceeded'), { name: 'QuotaExceededError' }); } };
  context.currentDraft = { personId: 'a', eventId: '', eventType: 'checkin', originalText: '원래 인사' };
  element('draft-text').value = '복사해서 직접 전할 인사';
  element('draft-confirm').checked = true;

  await handlers.get('copy-draft:click')();

  assert.deepEqual(clipboard, ['복사해서 직접 전할 인사']);
  assert.equal(writes, 1);
  assert.equal(context.saveFailed, true);
  assert.equal(context.state.drafts.length, 1, 'the unsaved copy record stays available for backup');
  assert.equal(context.state.activities.length, 0);
  assert.equal(element('draft-text').value, '복사해서 직접 전할 인사');
  assert.match(notices.at(-1), /복사했지만.*저장하지 못했어요/u);
  assert.doesNotMatch(notices.at(-1), /기억했어요|완료를 표시/u);
});


test('an ad hoc checkin opened from a person with no events retains its intent through preference save', () => {
  const { context, element, handlers } = harness([person('a')]);
  assert.equal(context.checkinMode, false);
  assert.equal(context.state.events.length, 0);
  element('draft-style').value = 'warm';
  element('draft-intent').value = 'thanks';
  context.generateDraft({ silent: true });
  element('preference-confirm').checked = true;
  element('preference-formality').value = 'polite';
  element('preference-length').value = 'balanced';
  element('preference-promises').checked = true;
  handlers.get('preference-form:submit')({ preventDefault() {} });
  assert.equal(element('draft-intent').value, 'thanks');
  assert.equal(context.currentDraft.checkinIntent, 'thanks');
  assert.match(element('draft-text').value, /감사합니다/u);
});

function libraryPerson(id = 'a') {
  return person(id, { messageLibrary: [
    { id: `${id}-old`, type: 'checkin', checkinIntent: 'everyday', text: '전에 다듬어 둔 평소 안부', savedAt: '2026-10-01T00:00:00.000Z', favorite: false },
    { id: `${id}-new`, type: 'checkin', checkinIntent: 'everyday', text: '최근 다듬어 둔 평소 안부', savedAt: '2026-10-08T00:00:00.000Z', favorite: false },
    { id: `${id}-thanks`, type: 'checkin', checkinIntent: 'thanks', text: '도와줘서 고마웠어. 마음에 오래 남았어.', savedAt: '2026-10-07T00:00:00.000Z', favorite: false },
  ] });
}

function beginEditedCheckin(context, element) {
  element('draft-style').value = 'warm';
  context.generateDraft({ silent: true });
  element('draft-text').value = '아직 보관하지 않은 나만의 안부';
  element('draft-confirm').checked = true;
  return context.currentDraft;
}

test('choosing an older version previews it without changing the editor, then loads that exact version', async () => {
  const { context, element, handlers, clipboard } = harness([libraryPerson()]);
  element('draft-style').value = 'warm'; context.generateDraft({ silent: true });
  const original = element('draft-text').value;
  element('saved-message-select').value = 'a-old';
  handlers.get('saved-message-select:change')();
  assert.equal(element('saved-draft-text').textContent, '전에 다듬어 둔 평소 안부');
  assert.equal(element('draft-text').value, original, 'preview selection is not a replacement');

  await handlers.get('load-saved-message:click')();

  assert.equal(element('draft-text').value, '전에 다듬어 둔 평소 안부');
  assert.equal(context.currentDraft.savedMessageId, 'a-old');
  assert.equal(element('saved-message-select').value, 'a-old');
  assert.equal(context.currentDraft.method, 'saved');
  assert.equal(element('draft-confirm').checked, false);
  assert.equal(clipboard.length, 0);
  assert.equal(context.state.drafts.length, 0);
  assert.equal(context.state.activities.length, 0);
});

test('loading from all checkins switches to the saved purpose only after edited text replacement is accepted', async () => {
  const { context, element, handlers } = harness([libraryPerson()]);
  beginEditedCheckin(context, element);
  element('library-scope').value = 'type'; handlers.get('library-scope:change')();
  element('saved-message-select').value = 'a-thanks';
  let confirmations = 0;
  context.confirmDelete = async () => { confirmations++; return true; };

  await handlers.get('load-saved-message:click')();

  assert.equal(confirmations, 1);
  assert.equal(element('draft-intent').value, 'thanks');
  assert.equal(context.currentDraft.checkinIntent, 'thanks');
  assert.equal(context.currentDraft.savedMessageId, 'a-thanks');
  assert.equal(element('draft-text').value, '도와줘서 고마웠어. 마음에 오래 남았어.');
  assert.equal(context.sessionDrafts.get('a').checkinIntent, 'thanks');
});

test('canceling a cross-purpose library load keeps the edited draft, purpose, style and confirmation', async () => {
  const { context, element, handlers } = harness([libraryPerson()]);
  const draft = beginEditedCheckin(context, element), stateBefore = JSON.stringify(context.state);
  element('library-scope').value = 'type'; handlers.get('library-scope:change')();
  element('saved-message-select').value = 'a-thanks';
  context.confirmDelete = async () => false;

  await handlers.get('load-saved-message:click')();

  assert.equal(context.currentDraft, draft);
  assert.equal(element('draft-text').value, '아직 보관하지 않은 나만의 안부');
  assert.equal(element('draft-intent').value, 'everyday');
  assert.equal(element('draft-style').value, 'warm');
  assert.equal(element('draft-confirm').checked, true);
  assert.equal(JSON.stringify(context.state), stateBefore);
});

test('an old account confirmation cannot load or delete a message in the newly opened account', async () => {
  for (const action of ['load-saved-message', 'delete-saved-message']) {
    const { context, element, handlers, notices } = harness([libraryPerson()]);
    beginEditedCheckin(context, element); element('saved-message-select').value = 'a-old';
    let finish;
    context.confirmDelete = () => new Promise(resolve => { finish = resolve; });
    const pending = handlers.get(`${action}:click`)();
    context.authEpoch++;
    context.state = { ...emptyState(), people: [libraryPerson()] };
    const nextDraft = { personId: 'a', eventId: '', eventType: 'checkin', checkinIntent: 'thanks', originalText: '다른 계정에서 준비한 감사' };
    context.currentDraft = nextDraft;
    element('draft-text').value = nextDraft.originalText;
    element('draft-intent').value = 'thanks';
    element('draft-style').value = 'short';
    const nextState = JSON.stringify(context.state);
    finish(true); await pending;

    assert.equal(context.currentDraft, nextDraft, action);
    assert.equal(element('draft-text').value, nextDraft.originalText, action);
    assert.equal(element('draft-intent').value, 'thanks', action);
    assert.equal(element('draft-style').value, 'short', action);
    assert.equal(JSON.stringify(context.state), nextState, action);
    assert.equal(notices.length, 0, action);
  }
});

test('a message changed while load or delete confirmation is open must be chosen again', async () => {
  for (const action of ['load-saved-message', 'delete-saved-message']) {
    const { context, element, handlers } = harness([libraryPerson()]);
    const draft = beginEditedCheckin(context, element); element('saved-message-select').value = 'a-old';
    let finish;
    context.confirmDelete = () => new Promise(resolve => { finish = resolve; });
    const pending = handlers.get(`${action}:click`)();
    context.state = toggleMessageFavorite(context.state, { personId: 'a', messageId: 'a-old' });
    const changedState = JSON.stringify(context.state);
    finish(true);

    await assert.rejects(pending, /문구가 바뀌었어요/u);
    assert.equal(context.currentDraft, draft, action);
    assert.equal(element('draft-text').value, '아직 보관하지 않은 나만의 안부', action);
    assert.equal(JSON.stringify(context.state), changedState, action);
  }
});

test('favorite reorders the library while preserving editor and creating no copy or contact record', () => {
  const { context, element, handlers, clipboard } = harness([libraryPerson()]);
  const draft = beginEditedCheckin(context, element);
  const before = listSavedMessages(context.person()).find(item => item.id === 'a-old');
  element('saved-message-select').value = 'a-old';

  handlers.get('favorite-saved-message:click')();

  const favorite = listSavedMessages(context.person())[0];
  assert.equal(favorite.id, 'a-old');
  assert.equal(favorite.favorite, true);
  assert.equal(favorite.text, before.text);
  assert.equal(favorite.savedAt, before.savedAt);
  assert.equal(element('favorite-saved-message').getAttribute('aria-pressed'), 'true');
  assert.equal(element('saved-message-select').value, 'a-old');
  assert.equal(context.currentDraft, draft);
  assert.equal(element('draft-text').value, '아직 보관하지 않은 나만의 안부');
  assert.equal(element('draft-confirm').checked, true);
  assert.equal(context.state.drafts.length, 0);
  assert.equal(context.state.activities.length, 0);
  assert.equal(clipboard.length, 0);

  handlers.get('favorite-saved-message:click')();
  assert.equal(listSavedMessages(context.person()).find(item => item.id === 'a-old').favorite, false);
  assert.equal(element('favorite-saved-message').getAttribute('aria-pressed'), 'false');
  assert.equal(context.currentDraft, draft);
});

test('deleting a selected version removes only that row and leaves the current editor intact', async () => {
  const { context, element, handlers, clipboard } = harness([libraryPerson(), libraryPerson('b')]);
  const draft = beginEditedCheckin(context, element);
  const other = JSON.stringify(context.state.people[1]);
  element('saved-message-select').value = 'a-old'; context.confirmDelete = async () => true;

  await handlers.get('delete-saved-message:click')();

  assert.deepEqual(listSavedMessages(context.person()).map(item => item.id).sort(), ['a-new', 'a-thanks']);
  assert.equal(JSON.stringify(context.state.people[1]), other);
  assert.equal(element('saved-message-select').value, 'a-new');
  assert.equal(context.currentDraft, draft);
  assert.equal(element('draft-text').value, '아직 보관하지 않은 나만의 안부');
  assert.equal(element('draft-confirm').checked, true);
  assert.equal(context.state.drafts.length, 0);
  assert.equal(context.state.activities.length, 0);
  assert.equal(clipboard.length, 0);
});

test('canceling a version deletion preserves every row and the selected preview', async () => {
  const { context, element, handlers, notices } = harness([libraryPerson()]);
  const draft = beginEditedCheckin(context, element), before = JSON.stringify(context.state);
  element('saved-message-select').value = 'a-old'; handlers.get('saved-message-select:change')();
  context.confirmDelete = async () => false;

  await handlers.get('delete-saved-message:click')();

  assert.equal(JSON.stringify(context.state), before);
  assert.equal(context.currentDraft, draft);
  assert.equal(element('saved-message-select').value, 'a-old');
  assert.equal(element('saved-draft-text').textContent, '전에 다듬어 둔 평소 안부');
  assert.equal(notices.length, 0);
});

test('save-only carries the selected checkin intent into its library entry and preserves previous versions', () => {
  for (const intent of ['everyday', 'reconnect', 'thanks']) {
    const { context, element, handlers, clipboard } = harness([libraryPerson()]);
    element('draft-style').value = 'warm'; element('draft-intent').value = intent;
    context.generateDraft({ silent: true });
    const draft = context.currentDraft;
    element('draft-text').value = `이번에 직접 다듬은 ${intent} 인사`;
    element('draft-confirm').checked = true;

    handlers.get('save-draft-only:click')();

    const library = listSavedMessages(context.person());
    assert.equal(library.length, 4);
    const added = library.find(item => item.text === element('draft-text').value);
    assert.equal(added.checkinIntent, intent);
    assert.equal(context.currentDraft, draft);
    assert.equal(context.state.drafts.length, 0);
    assert.equal(context.state.activities.length, 0);
    assert.equal(clipboard.length, 0);
  }
});

test('changing purpose reuses the saved version matching that purpose instead of the prior purpose', async () => {
  const { context, element } = harness([libraryPerson()]);
  element('draft-style').value = 'saved'; context.generateDraft({ silent: true });
  assert.equal(context.currentDraft.savedMessageId, 'a-new');
  element('draft-intent').value = 'thanks';

  await context.changeDraft({ intentChanged: true });

  assert.equal(context.currentDraft.savedMessageId, 'a-thanks');
  assert.equal(context.currentDraft.checkinIntent, 'thanks');
  assert.equal(element('draft-text').value, '도와줘서 고마웠어. 마음에 오래 남았어.');
});
