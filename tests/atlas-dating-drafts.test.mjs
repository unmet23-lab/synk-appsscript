import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftRegistry, createBasisDrafts, createBasisDraft, createScheduleEditor } from '../experiences/atlas-lab/dating-drafts.mjs';

// The same-tab editing session contract (E02). The page supplies the basis
// rules; these tests use a synthetic view with the same ingredients as the
// page's appointment basis: account, active pair, the server's schedule draft
// basis, storage consent and the proposal version of the form.
const A = 'synthetic-draft-a', B = 'synthetic-draft-b', PAIR = 'pair-1', BASIS = 'a'.repeat(64);
function world() {
  const state = { view: { accountId: A, consent: true, pairs: [{ pairId: PAIR, status: 'active', basis: BASIS, version: 1,
    seed: { appointmentId: 'old-1', proposalVersion: 1, place: '합정역 2번 출구', durationMinutes: 90 } }] } };
  const pair = id => state.view?.pairs.find(item => item.pairId === id);
  const basis = (pairId, formKey) => {
    const p = pair(pairId);
    if (!state.view?.consent || p?.status !== 'active') return null;
    return JSON.stringify([state.view.accountId, pairId, p.basis, formKey === 'new' ? 'new' : `${formKey}:${p.version}`]);
  };
  const seedOf = (pairId, appointmentId) => { const p = pair(pairId); return p?.seed?.appointmentId === appointmentId ? { ...p.seed } : null; };
  return { state, pair, editor: createScheduleEditor({ basis, seedOf }) };
}
function form() {
  const listeners = {}, details = { open: true, listeners: {}, addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); } };
  return { dataset: {}, isConnected: true, details, listeners,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, closest: selector => selector === 'details' ? details : null,
    fire(type) { for (const fn of listeners[type] || []) fn(); }, toggle(open) { details.open = open; for (const fn of details.listeners.toggle || []) fn(); } };
}
const values = (place = '', startsAt = '') => ({ startsAt, durationMinutes: '', endsAt: '', place, note: '' });
function mounted(editor, { formKey = 'new', input = values() } = {}) {
  const node = form(); let current = input;
  editor.mount(node, { pairId: PAIR, formKey, read: () => ({ values: current, endEdited: false }) });
  return { node, type(next) { current = next; node.fire('input'); }, toggle: open => node.toggle(open) };
}

test('a draft registry clears, prunes and reports unsent work through each registered kind without naming them', () => {
  const drafts = createDraftRegistry(), calls = [];
  const kind = (name, unsent) => drafts.register(name, { clear: () => calls.push(`clear ${name}`), prune: () => calls.push(`prune ${name}`), hasDraft: () => unsent });
  kind('profile', false); kind('schedule', true);
  const remembered = drafts.register('open-forms', new Set(['pair-1']));
  assert.equal(drafts.hasDraft(), true); assert.deepEqual(drafts.unsaved(), ['schedule']);
  drafts.prune(); drafts.clear();
  assert.deepEqual(calls, ['prune profile', 'prune schedule', 'clear profile', 'clear schedule']);
  assert.equal(remembered.size, 0, 'a registered Set is cleared on owner reset');
  const quiet = createDraftRegistry(); quiet.register('open-forms', new Set(['pair-1'])); assert.equal(quiet.hasDraft(), false, 'remembered disclosure state is not unsent work');
});

test('a basis draft survives only while its scope keeps the basis it was written against', () => {
  const sources = { profile: 'basis-1', 'self.contact': 'basis-2' };
  const drafts = createBasisDrafts({ basisOf: key => sources[key] ?? null });
  drafts.write('profile', 'basis-1', { values: ['가상 소연'] }); drafts.write('self.contact', 'basis-2', { values: ['daily'] });
  assert.deepEqual(drafts.read('profile'), { values: ['가상 소연'], basis: 'basis-1' });
  sources.profile = 'basis-1b';
  assert.equal(drafts.read('profile'), null, 'a newer saved source is not overwritten by the older draft');
  assert.equal(drafts.has('profile'), false, 'reading a stale draft drops it');
  sources['self.contact'] = null; drafts.prune();
  assert.equal(drafts.size, 0); assert.equal(drafts.hasDraft(), false);
  const reopened = createBasisDrafts({ basisOf: () => 'k', counts: () => false });
  reopened.write('wants.contact', 'k', { value: 'daily' });
  assert.equal(reopened.hasDraft(), false, 'a kind can keep a reopenable selection without calling it unsent work');
  assert.equal(reopened.read('wants.contact').value, 'daily');
});

test('a single draft slot discards on a basis change and keeps a draft written against the same empty basis', () => {
  let key = 'context-1';
  const draft = createBasisDraft({ basisOf: () => key });
  draft.write(key, { target: 'context', until: '' }); assert.equal(draft.read().target, 'context'); assert.equal(draft.hasDraft(), true);
  key = 'context-2'; draft.prune(); assert.equal(draft.read(), null); assert.equal(draft.hasDraft(), false);
  key = null; draft.write(null, { target: 'baseline' }); draft.prune(); assert.equal(draft.read().target, 'baseline', 'same basis keeps the draft');
  draft.discard(); assert.equal(draft.read(), null);
});

test('appointment editing: re-rendering the form while a change is pending keeps the typed input and a detached old form cannot overwrite it', () => {
  const { editor } = world();
  const first = mounted(editor);
  first.type(values('성수역 3번 출구', '2026-10-30T19:00'));
  assert.equal(first.node.dataset.scheduleForm, 'new'); assert.equal(first.node.dataset.schedulePair, PAIR); assert.ok(first.node.dataset.scheduleDraftKey);
  // A queued live update re-renders the inbox: the new form reads the draft before laying out its fields.
  first.node.isConnected = false;
  const resumed = editor.readDraft(PAIR, 'new');
  assert.equal(resumed.values.place, '성수역 3번 출구'); assert.equal(resumed.values.startsAt, '2026-10-30T19:00');
  const second = mounted(editor, { input: resumed.values });
  first.type(values('옛 폼의 늦은 입력'));
  assert.equal(editor.readDraft(PAIR, 'new').values.place, '성수역 3번 출구', 'input from a detached form is ignored');
  second.type(values('성수역 4번 출구', '2026-10-30T19:00'));
  assert.equal(editor.readDraft(PAIR, 'new').values.place, '성수역 4번 출구');
  assert.equal(editor.hasDraft(), true);
});

test('appointment editing: a changed server basis or proposal version discards the older draft instead of restoring it', () => {
  for (const change of [s => { s.view.pairs[0].basis = 'b'.repeat(64); }, s => { s.view.pairs[0].version = 2; }, s => { s.view.pairs[0].status = 'closed'; }, s => { s.view.consent = false; }]) {
    const { state, editor } = world(), formKey = 'appt-1';
    const open = mounted(editor, { formKey });
    open.type(values('이전 판에서 고친 장소', '2026-10-30T19:00'));
    change(state);
    assert.equal(editor.readDraft(PAIR, formKey), null, 'the newer basis never receives the older text');
    editor.updateBasis(); assert.equal(editor.hasDraft(), false);
    open.type(values('바뀐 뒤 같은 화면에 남은 입력'));
    assert.equal(editor.hasDraft(), false, 'an input on a form still showing the outdated basis is not remembered either');
  }
});

test('appointment editing: an owner reset through the registry disposes every private draft and seed for good', () => {
  const { state, editor } = world(), drafts = createDraftRegistry(); drafts.register('schedule', editor);
  mounted(editor).type(values('비공개 장소', '2026-10-30T19:00'));
  assert.ok(editor.reuse(PAIR, 'old-1'));
  drafts.clear();
  assert.equal(editor.readDraft(PAIR, 'new'), null); assert.equal(editor.readSeed(PAIR), null); assert.equal(drafts.hasDraft(), false);
  state.view = { ...state.view, accountId: B };
  assert.equal(editor.readDraft(PAIR, 'new'), null, 'another account never sees the previous draft');
  state.view = { ...state.view, accountId: A };
  assert.equal(editor.readDraft(PAIR, 'new'), null, 'returning to the first account does not revive it');
});

test('appointment editing: reuse seeds only the previous place and length, replaces the new-form input and does not survive a consent round trip', () => {
  const { state, editor } = world();
  mounted(editor).type(values('작성 중이던 장소', '2026-10-30T19:00'));
  const reused = editor.reuse(PAIR, 'old-1');
  assert.deepEqual(reused, { seed: { appointmentId: 'old-1', proposalVersion: 1, place: '합정역 2번 출구', durationMinutes: 90 }, kept: true });
  assert.equal(editor.readDraft(PAIR, 'new'), null, 'explicit reuse replaces the earlier new-form input');
  assert.equal(editor.readSeed(PAIR).place, '합정역 2번 출구');
  state.view.consent = false; editor.updateBasis(); state.view.consent = true;
  assert.equal(editor.readSeed(PAIR), null, 'turning storage consent off and on does not revive the seed');
  assert.equal(editor.reuse(PAIR, 'missing'), null, 'an appointment the view no longer offers cannot be reused');
  state.view.consent = false;
  assert.deepEqual(editor.reuse(PAIR, 'old-1'), { seed: { appointmentId: 'old-1', proposalVersion: 1, place: '합정역 2번 출구', durationMinutes: 90 }, kept: false });
  state.view.consent = true; assert.equal(editor.readSeed(PAIR), null, 'without a basis the seed is filled once and not remembered');
  editor.reuse(PAIR, 'old-1'); state.view.pairs[0].seed.place = '바뀐 장소';
  assert.equal(editor.readSeed(PAIR), null, 'a seed whose source changed is dropped');
  state.view.pairs[0].seed.place = '합정역 2번 출구'; editor.reuse(PAIR, 'old-1'); state.view.pairs[0].seed.durationMinutes = 60; editor.updateBasis();
  state.view.pairs[0].seed.durationMinutes = 90;
  assert.equal(editor.readSeed(PAIR), null, 'a seed dropped at a render because its source changed is not revived when the source changes back');
});

test('appointment editing: a sent proposal ends its draft and seed, and only non-empty drafts count as unsent work', () => {
  const { editor } = world(), open = mounted(editor);
  open.type(values()); assert.equal(editor.hasDraft(), false, 'touching an empty form is not unsent work');
  open.type(values('성수역', '2026-10-30T19:00')); editor.reuse(PAIR, 'old-1'); open.type(values('성수역', '2026-10-30T19:00'));
  assert.equal(editor.hasDraft(), true);
  editor.sent(PAIR, 'new');
  assert.equal(editor.hasDraft(), false); assert.equal(editor.readSeed(PAIR), null); assert.equal(editor.readDraft(PAIR, 'new'), null);
});

test('appointment editing: after a render the section opens as the draft left it and later toggles follow only the current form', () => {
  const { state, editor } = world(), open = mounted(editor);
  open.node.details.open = false; open.type(values('성수역', '2026-10-30T19:00'));
  const rendered = mounted(editor, { input: editor.readDraft(PAIR, 'new').values }); rendered.node.details.open = true;
  const root = { querySelectorAll: selector => selector === '[data-schedule-form]' ? [rendered.node] : [] };
  assert.equal(editor.restore(root), true, 'a non-empty draft resumed');
  assert.equal(rendered.node.details.open, false, 'the section stays closed as the draft left it');
  rendered.toggle(true); assert.equal(editor.readDraft(PAIR, 'new').open, true);
  rendered.node.isConnected = false; rendered.toggle(false); assert.equal(editor.readDraft(PAIR, 'new').open, true, 'a detached form does not change the draft');
  state.view.pairs[0].basis = 'c'.repeat(64);
  const fresh = mounted(editor); fresh.node.details.open = true;
  assert.equal(editor.restore({ querySelectorAll: () => [fresh.node] }), false, 'no draft resumes into a form with a different basis');
  assert.equal(fresh.node.details.open, true);
});
