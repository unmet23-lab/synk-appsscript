import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { emptyState, makePerson, makeEvent, importBackup } from '../model.mjs';

const source = readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (start < 0) throw Error(`App function not found: ${name}`);
  const next = source.slice(start + 1).search(/^(?:async )?function /m);
  if (next < 0) throw Error(`App function boundary not found: ${name}`);
  return source.slice(start, start + next + 1);
}
function handlerSource(id) {
  const start = source.indexOf(`on('${id}',`);
  if (start < 0) throw Error(`App handler not found: ${id}`);
  const rest = source.slice(start), next = rest.search(/\r?\n(?=on\()/u);
  if (next < 0) throw Error(`App handler boundary not found: ${id}`);
  return rest.slice(0, next);
}
const person = (extra = {}) => makePerson({ id: 'p', name: '친구', ...extra });

// Run the shipped functions and submit handler. Only the DOM/storage boundary
// and unrelated rendering/media operations are replaced by small test doubles.
function harness(people = []) {
  const elements = new Map(), handlers = new Map(), notices = [], writes = [];
  const defaults = { 'person-edit-id': '', 'new-person-name': '', 'new-person-relationship': '', 'new-person-group': 'other', 'new-person-notes': '', 'new-person-checkin': '30', 'new-person-checkin-days': '30', 'quick-event-date': '', 'quick-event-type': 'birthday' };
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: defaults[id] ?? '', hidden: false, disabled: id === 'new-person-checkin-days', required: false, open: false, textContent: '',
      showModal() { this.open = true; }, close() { this.open = false; },
      reset() { if (id === 'person-form') for (const [field, value] of Object.entries(defaults)) element(field).value = value; },
      replaceChildren() {}, scrollIntoView() {},
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    state: { ...emptyState(), people }, selectedId: people[0]?.id ?? null,
    personDialogContext: null, authEpoch: 0, persist: false, accountId: null, saveFailed: false, sampleMode: false,
    followupContext: null, checkinMode: false, logOccurrence: null, activeView: 'person', preparationKey: '',
    focusKey: '', focusEpoch: 0, focusOperation: null, followupCalendar: null,
    conversations: new Map(), sessionDrafts: new Map(), notified: new Set(), STORAGE_KEY: 'checkin-interval-ui',
    storageFails: false, $: element, makePerson, makeEvent, emptyState, importBackup,
    on: (id, event, handler) => handlers.set(`${id}:${event}`, handler), notify: message => notices.push(message),
    notebookView: () => ({ locked: false }), hasPersonalizationInput: () => false,
    updateStorageLabel() {}, renderPeople() {}, renderHome() {}, render() {}, renderWorkspace() {}, renderHistory() {}, renderCapturePeople() {}, renderBrief() {},
    resetPersonalMemory() {}, resetMemoryCard() {}, stashConversation() {}, stashDraft() {}, resetDraft() {},
    resetEventForm() {}, clearAudio() {}, clearConversationFields() {}, restoreDraft() {}, switchTab() {},
    invalidateCapture() {}, prepareEvent: async () => {}, beginCheckin: async () => false,
    localStorage: { setItem(key, value) { if (context.storageFails) throw Error('Storage is full'); writes.push({ key, value }); } },
  });
  context.person = () => context.state.people.find(item => item.id === context.selectedId);
  vm.runInContext(['save', 'choosePerson', 'openPersonDialog', 'updatePersonSubmit', 'checkinSummary', 'updateCheckinInput', 'checkinInput', 'replaceState'].map(functionSource).join('\n'), context);
  vm.runInContext(['new-person-checkin', 'close-person-dialog', 'person-form'].map(handlerSource).join('\n'), context);
  const submit = () => handlers.get('person-form:submit')({ preventDefault() {} });
  const change = (selection, custom) => {
    element('new-person-checkin').value = selection;
    if (custom !== undefined) element('new-person-checkin-days').value = custom;
    handlers.get('new-person-checkin:change')();
  };
  return { context, element, handlers, notices, writes, submit, change };
}

test('새 사람의 기본 30일 선택은 명시 필드를 만들지 않고 실제 저장과 요약에 반영된다', async () => {
  const { context, element, submit, notices, writes } = harness();
  context.persist = true;
  context.openPersonDialog();
  assert.equal(element('person-dialog').open, true);
  assert.equal(element('new-person-checkin').value, '30');
  assert.equal(element('new-person-checkin-days').disabled, true);
  assert.equal(element('new-person-checkin-days').required, false);
  element('new-person-name').value = '새 친구';
  await submit();
  assert.equal(context.state.people.length, 1);
  assert.equal(Object.hasOwn(context.state.people[0], 'checkinIntervalDays'), false);
  assert.equal(context.checkinSummary(context.state.people[0]), '안부 추천 기준 · 마지막 챙김 후 30일');
  assert.equal(JSON.parse(writes.at(-1).value).people[0].name, '새 친구');
  assert.equal(Object.hasOwn(JSON.parse(writes.at(-1).value).people[0], 'checkinIntervalDays'), false);
  assert.equal(element('person-dialog').open, false);
  assert.equal(context.personDialogContext, null);
  assert.match(notices.at(-1), /수첩에 기억했어요/u);
});

test('기존 사람의 기본값 부재와 명시적 추천 끄기는 다른 정보 수정 후에도 각각 유지된다', async () => {
  for (const extra of [{}, { checkinIntervalDays: 0 }]) {
    const { context, element, submit } = harness([person(extra)]);
    context.openPersonDialog(true);
    assert.equal(element('new-person-checkin').value, Object.hasOwn(extra, 'checkinIntervalDays') ? '0' : '30');
    assert.equal(element('new-person-checkin-custom').hidden, true);
    element('new-person-relationship').value = '대학 친구';
    await submit();
    assert.equal(context.state.people[0].relationship, '대학 친구');
    assert.equal(Object.hasOwn(context.state.people[0], 'checkinIntervalDays'), Object.hasOwn(extra, 'checkinIntervalDays'));
    if (Object.hasOwn(extra, 'checkinIntervalDays')) {
      assert.equal(context.state.people[0].checkinIntervalDays, 0);
      assert.equal(context.checkinSummary(context.state.people[0]), '일반 안부 추천 꺼짐');
    }
  }
});

test('직접 정한 45일을 다시 열어 편집하고 각 미리 정한 간격과 30일 복귀를 저장할 수 있다', async () => {
  const { context, element, submit, change } = harness([person({ checkinIntervalDays: 45 })]);
  context.openPersonDialog(true);
  assert.equal(element('new-person-checkin').value, 'custom');
  assert.equal(element('new-person-checkin-days').value, '45');
  assert.equal(element('new-person-checkin-custom').hidden, false);
  assert.equal(element('new-person-checkin-days').disabled, false);
  assert.equal(element('new-person-checkin-days').required, true);
  element('new-person-name').value = '이름을 고친 친구';
  await submit();
  assert.equal(context.state.people[0].checkinIntervalDays, 45);
  for (const selected of ['7', '14', '60', '90', '0', '30']) {
    context.openPersonDialog(true); change(selected);
    await submit();
    assert.equal(context.state.people[0].checkinIntervalDays, Number(selected));
    assert.equal(element('new-person-checkin-days').disabled, true);
  }
  assert.equal(context.checkinSummary(context.state.people[0]), '안부 추천 기준 · 마지막 챙김 후 30일');
});

test('직접 입력의 1일·45일·365일을 저장하고 기본값 부재인 사람의 30일 복귀는 부재로 남긴다', async () => {
  for (const days of ['1', '45', '365']) {
    const { context, submit, change } = harness([person()]);
    context.openPersonDialog(true); change('custom', days);
    await submit();
    assert.equal(context.state.people[0].checkinIntervalDays, Number(days));
    assert.ok(context.checkinSummary(context.state.people[0]).includes(`${days}일`));
  }
  const { context, submit, change } = harness([person()]);
  context.openPersonDialog(true); change('custom', '45'); change('30');
  await submit();
  assert.equal(Object.hasOwn(context.state.people[0], 'checkinIntervalDays'), false);
});

test('직접 입력의 빈칸·0·소수·지수표기·범위초과는 저장 전에 거부하며 원래 수첩을 건드리지 않는다', async () => {
  for (const invalid of ['', ' ', '0', '-1', '1.5', '1.0', '1e2', '366', 'Infinity', 'NaN']) {
    const { context, element, submit, change, writes, notices } = harness([person({ checkinIntervalDays: 14 })]);
    context.persist = true;
    const before = JSON.stringify(context.state);
    context.openPersonDialog(true); change('custom', invalid);
    element('new-person-name').value = '저장되면 안 되는 이름';
    await assert.rejects(submit(), /1일부터 365일까지 정수/u, invalid);
    assert.equal(JSON.stringify(context.state), before, invalid);
    assert.equal(writes.length, 0, invalid);
    assert.equal(notices.length, 0, invalid);
    assert.equal(element('person-dialog').open, true, invalid);
  }
});

test('직접 정하기 전환은 입력칸의 숨김·필수·비활성 상태만 바꾸며 저장 전에는 사람을 바꾸지 않는다', () => {
  const { context, element, change } = harness([person({ checkinIntervalDays: 7 })]);
  const before = JSON.stringify(context.state);
  context.openPersonDialog(true); change('custom', '45');
  assert.equal(element('new-person-checkin-custom').hidden, false);
  assert.equal(element('new-person-checkin-days').required, true);
  assert.equal(element('new-person-checkin-days').disabled, false);
  change('0');
  assert.equal(element('new-person-checkin-custom').hidden, true);
  assert.equal(element('new-person-checkin-days').required, false);
  assert.equal(element('new-person-checkin-days').disabled, true);
  assert.equal(JSON.stringify(context.state), before);
});

test('닫기와 브라우저 취소로 끝낸 미저장 변경은 수첩에 남지 않고 다시 열면 원래 값을 보여 준다', () => {
  for (const action of ['close-button', 'browser-cancel']) {
    const { context, element, handlers, change, notices, writes } = harness([person({ checkinIntervalDays: 14 })]);
    const before = JSON.stringify(context.state);
    context.openPersonDialog(true); change('custom', '45');
    element('new-person-name').value = '취소할 이름';
    if (action === 'close-button') {
      handlers.get('close-person-dialog:click')();
      assert.equal(context.personDialogContext, null);
    } else {
      // Native <dialog> cancellation closes without a form submit. The app has
      // no cancel handler; the next open must still rehydrate persisted values.
      element('person-dialog').close();
    }
    assert.equal(element('person-dialog').open, false);
    assert.equal(JSON.stringify(context.state), before);
    assert.equal(writes.length, 0);
    assert.equal(notices.length, 0);
    context.openPersonDialog(true);
    assert.equal(element('new-person-checkin').value, '14');
    assert.equal(element('new-person-name').value, '친구');
  }
});

test('편집 중 계정 epoch·사람 원본·편집 대상이 바뀌거나 사람이 삭제되면 저장을 거부한다', async () => {
  for (const mutation of ['epoch', 'fingerprint', 'removed', 'edit-id', 'closed']) {
    const { context, element, submit, change, writes } = harness([person({ checkinIntervalDays: 7 }), person({ id: 'other', name: '다른 친구' })]);
    context.persist = true;
    context.openPersonDialog(true); change('custom', '45');
    if (mutation === 'epoch') context.authEpoch++;
    else if (mutation === 'fingerprint') context.state.people[0] = makePerson({ ...context.state.people[0], checkinIntervalDays: 90 });
    else if (mutation === 'removed') context.state.people = context.state.people.filter(item => item.id !== 'p');
    else if (mutation === 'edit-id') element('person-edit-id').value = 'other';
    else context.personDialogContext = null;
    const before = JSON.stringify(context.state);
    await assert.rejects(submit(), /계정이나 사람 정보가 바뀌었/u, mutation);
    assert.equal(JSON.stringify(context.state), before, mutation);
    assert.equal(writes.length, 0, mutation);
  }
});

test('수첩 교체는 열려 있던 사람 창과 임시 입력을 닫고 이전 제출을 무효화한다', async () => {
  const { context, element, submit, change } = harness([person({ checkinIntervalDays: 14 })]);
  context.openPersonDialog(true); change('custom', '45');
  element('new-person-name').value = '이전 계정의 미저장 이름';
  context.authEpoch++;
  const next = { ...emptyState(), people: [person({ id: 'other', name: '다른 계정의 친구', checkinIntervalDays: 90 })] };
  context.replaceState(next);
  assert.equal(element('person-dialog').open, false);
  assert.equal(context.personDialogContext, null);
  assert.equal(element('new-person-name').value, '');
  const before = JSON.stringify(context.state);
  await assert.rejects(submit(), /계정이나 사람 정보가 바뀌었/u);
  assert.equal(JSON.stringify(context.state), before);
  assert.equal(context.state.people[0].checkinIntervalDays, 90);
});

test('기기 저장 실패 때 변경은 메모리에 남기고 저장 완료 토스트를 띄우지 않는다', async () => {
  const { context, submit, change, notices, writes } = harness([person({ checkinIntervalDays: 7 })]);
  context.persist = true; context.storageFails = true;
  context.openPersonDialog(true); change('custom', '45');
  await submit();
  assert.equal(context.state.people[0].checkinIntervalDays, 45);
  assert.equal(context.saveFailed, true);
  assert.equal(writes.length, 0);
  assert.ok(notices.some(message => /브라우저에 저장하지 못했어요/u.test(message)));
  assert.ok(notices.every(message => !/사람 정보를 수정했어요|수첩에 기억했어요|이름과 날짜를 기억했어요/u.test(message)));
});

test('저장 뒤 화면을 여는 사이 계정이 바뀌면 예전 계정의 성공 토스트를 남기지 않는다', async () => {
  const { context, element, submit, change, notices } = harness();
  context.openPersonDialog(); element('new-person-name').value = '새 친구'; change('14');
  const saving = submit();
  context.authEpoch++;
  await saving;
  assert.equal(notices.length, 0);
});
