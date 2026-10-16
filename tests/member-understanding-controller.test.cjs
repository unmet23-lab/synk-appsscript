'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
let createMemberUnderstanding;
before(async () => { ({ createMemberUnderstanding } = await import('../desktop/renderer/member-understanding-controller.mjs')); });
const NOW = Date.parse('2026-10-14T16:00:00.000Z');
const iso = value => new Date(value).toISOString();
const empty = () => ({ version: 1, reviews: [], overrides: [] });
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const row = (facetId = 'support', values = ['step']) => ({ id: randomUUID(), facetId, values, note: '', at: iso(NOW) });
function fixture({ state = empty(), signedIn = true, timeoutMs = 1000 } = {}) {
  const owner = randomUUID(), records = new Map([[owner, { state: structuredClone(state), revision: 1 }]]), calls = [];
  let identity = { status: signedIn ? 'signed-in' : 'signed-out', signedIn, accountId: owner, sessionGeneration: 1 }, hook, generated = 0;
  const response = id => ({ ok: true, scope: 'synk-personal', resource: 'member-understanding', accountId: id, updatedAt: iso(NOW), ...structuredClone(records.get(id) || { state: null, revision: 0 }) });
  const dispatch = (operation, params, id) => {
    if (operation === 'understandingLoad') return response(id);
    const old = records.get(id) || { state: null, revision: 0 };
    if (old.revision !== params.expected_revision) throw Object.assign(new Error('conflict'), { code: 'REVISION_CONFLICT' });
    assert.ok(['understandingSave', 'understandingDelete'].includes(operation));
    records.set(id, { state: operation === 'understandingDelete' ? null : structuredClone(params.state), revision: old.revision + 1 });
    return response(id);
  };
  const controller = createMemberUnderstanding({ getIdentity: () => identity, now: () => NOW, uuid: () => { generated++; return randomUUID(); }, timeoutMs,
    request: async (operation, params) => { const id = identity.accountId, call = { operation, params: structuredClone(params), owner: id }; calls.push(call); return hook ? hook(call, () => dispatch(operation, params, id)) : dispatch(operation, params, id); } });
  return { controller, owner, records, calls, get generated() { return generated; }, setHook(value) { hook = value; }, setIdentity(patch) { identity = { ...identity, ...patch }; }, saved() { return structuredClone(records.get(owner)); } };
}
function edit(f, facetId = 'support', values = ['step']) {
  assert.equal(f.controller.begin({ facetId, mode: 'override', values, facet: { id: facetId, title: '합성 항목', choices: values.map(id => ({ id, label: id })) } }), true);
}

test('signed-out never fetches or persists; opening and cancelling an editor does not save', async () => {
  const off = fixture({ signedIn: false }); await off.controller.refresh(); await off.controller.save(); assert.equal(off.calls.length, 0);
  const f = fixture(); await f.controller.refresh(); edit(f); f.controller.updateDraft({ note: '직접 쓴 설명' });
  assert.equal(f.calls.filter(x => x.operation !== 'understandingLoad').length, 0);
  f.controller.cancel(); assert.equal(f.controller.read().editor, null); assert.deepEqual(f.saved().state, empty());
});

test('explicit correction persists; a fresh controller restores it and undo removes only that correction', async () => {
  const f = fixture(); await f.controller.refresh(); edit(f); f.controller.updateDraft({ note: '처음에는 혼자\n필요할 때 도움' }); await f.controller.save();
  assert.equal(f.controller.read().editor, null); assert.equal(f.saved().state.overrides[0].note, '처음에는 혼자\n필요할 때 도움');
  const next = fixture({ state: f.saved().state }); await next.controller.refresh(); assert.deepEqual(next.controller.read().document, f.saved().state);
  const saved = next.controller.read().document.overrides[0]; await next.controller.remove({ kind: 'override', id: saved.id, facetId: saved.facetId }); assert.deepEqual(next.saved().state, empty());
});

test('a concurrent edit of the same facet is surfaced rather than silently overwritten', async () => {
  const f = fixture(); await f.controller.refresh(); edit(f);
  const remote = row('support', ['independent']); f.records.set(f.owner, { state: { ...empty(), overrides: [remote] }, revision: 2 });
  await f.controller.save(); assert.equal(f.controller.read().error, 'conflict'); assert.ok(f.controller.read().editor); assert.equal(f.saved().state.overrides[0].id, remote.id);
  assert.equal(f.calls.filter(x => x.operation === 'understandingSave').length, 0);
});

test('CAS retry merges an unrelated correction without changing the submitted UUID', async () => {
  const f = fixture(); await f.controller.refresh(); edit(f); let conflicted = false;
  f.setHook((call, dispatch) => {
    if (call.operation === 'understandingSave' && !conflicted) { conflicted = true; f.records.set(f.owner, { state: { ...empty(), overrides: [row('explanation', ['brief'])] }, revision: 2 }); throw Object.assign(new Error('CAS'), { code: 'REVISION_CONFLICT' }); }
    return dispatch();
  });
  await f.controller.save(); assert.equal(f.saved().state.overrides.length, 2); assert.equal(f.generated, 1);
  const saves = f.calls.filter(x => x.operation === 'understandingSave'); assert.equal(saves.length, 2);
  assert.equal(saves[0].params.state.overrides.find(x => x.facetId === 'support').id, saves[1].params.state.overrides.find(x => x.facetId === 'support').id);
});

test('a timed-out acknowledgement is recovered with the same submission and no duplicate write', async () => {
  const f = fixture({ timeoutMs: 15 }); await f.controller.refresh(); edit(f);
  f.setHook((call, dispatch) => { const result = dispatch(); return call.operation === 'understandingSave' ? new Promise(() => {}) : result; });
  await f.controller.save(); assert.ok(f.controller.read().editor); assert.equal(f.saved().state.overrides.length, 1);
  f.setHook(null); await f.controller.save(); assert.equal(f.controller.read().editor, null); assert.equal(f.generated, 1);
  assert.equal(f.calls.filter(x => x.operation === 'understandingSave').length, 1);
});

test('account/session replacement discards drafts and late response ownership', async () => {
  for (const replaceOwner of [true, false]) {
    const f = fixture(); await f.controller.refresh(); edit(f); const gate = deferred();
    f.setHook((call, dispatch) => call.operation === 'understandingLoad' ? gate.promise.then(dispatch) : dispatch());
    const saving = f.controller.save(); await tick(); f.setIdentity({ accountId: replaceOwner ? randomUUID() : f.owner, sessionGeneration: 2 });
    assert.equal(f.controller.read().editor, null); assert.equal(f.controller.read().document, null); gate.resolve(); await saving;
    assert.equal(f.calls.filter(x => x.operation === 'understandingSave').length, 0); assert.equal(f.controller.read().document, null);
  }
});

test('wrong resource/account and missing state envelopes cannot authorize a write', async () => {
  for (const patch of [{ resource: 'member-insight' }, { accountId: randomUUID() }, { state: undefined }, { revision: -1 }]) {
    const f = fixture(); f.setHook((_call, dispatch) => ({ ...dispatch(), ...patch })); await f.controller.refresh();
    assert.equal(f.controller.read().status, 'error'); assert.equal(f.controller.begin({ facetId: 'support', mode: 'override', values: ['step'] }), false);
    assert.equal(f.calls.filter(x => x.operation !== 'understandingLoad').length, 0);
  }
});

test('read failure preserves only the unsaved draft and retry can complete it', async () => {
  const f = fixture(); await f.controller.refresh(); edit(f); f.controller.updateDraft({ note: '입력 유지' });
  f.setHook(() => { throw new Error('secret upstream detail'); }); await f.controller.save();
  assert.equal(f.controller.read().status, 'error'); assert.equal(f.controller.read().editor.note, '입력 유지'); assert.doesNotMatch(f.controller.read().message, /secret/);
  f.setHook(null); await f.controller.save(); assert.equal(f.saved().state.overrides[0].note, '입력 유지');
});

test('delete advances an empty revision, but does not delete a newer unseen remote correction', async () => {
  const f = fixture(); await f.controller.refresh(); await f.controller.clear(); assert.equal(f.saved().revision, 2); assert.equal(f.saved().state, null);
  await f.controller.refresh(); const remote = row(); f.records.set(f.owner, { state: { ...empty(), overrides: [remote] }, revision: 3 });
  await f.controller.clear(); assert.equal(f.controller.read().error, 'conflict'); assert.equal(f.saved().state.overrides[0].id, remote.id);
});

function describe(f, text = '혼자 하는 게 좋지만 처음에는 예시가 필요해') {
  assert.equal(f.controller.describe(), true);
  f.controller.updateStatementDraft({ text });
  assert.equal(f.controller.previewStatement(), true);
  const preview = f.controller.read().statementEditor.preview;
  f.controller.updateStatementDraft({ acceptedIds: preview.proposals.filter(p => p.confirmable).map(p => p.id) });
}

test('confirmed text survives a new analysis and undo preserves existing corrections', async () => {
  const original = { ...empty(), overrides: [row('explanation', ['brief'])] };
  const f = fixture({ state: original }); await f.controller.refresh(); describe(f);
  assert.equal(f.calls.filter(x => x.operation === 'understandingSave').length, 0);
  await f.controller.confirmStatement();
  const saved = f.saved().state; assert.equal(saved.version, 7); assert.equal(saved.statements.length, 1);
  assert.equal(saved.statements[0].meanings.length, 2); assert.deepEqual(saved.overrides, original.overrides);
  const next = fixture({ state: saved }); await next.controller.refresh();
  assert.deepEqual(next.controller.read().document.statements, saved.statements);
  await next.controller.removeStatement({ id: saved.statements[0].id });
  assert.equal(next.saved().state.statements.length, 0); assert.deepEqual(next.saved().state.overrides, original.overrides);
  await f.controller.clear(); assert.equal(f.calls.at(-1).params.document_version, 7);
});

test('version-three documents retain their delete acknowledgement and existing corrections', async () => {
  const original = { version: 3, reviews: [], overrides: [row()], statements: [] };
  const f = fixture({ state: original }); await f.controller.refresh();
  assert.deepEqual(f.controller.read().document, original);
  edit(f, 'explanation', ['brief']); await f.controller.save();
  assert.equal(f.saved().state.version, 3); assert.equal(f.saved().state.overrides.length, 2);
  await f.controller.clear(); assert.equal(f.calls.at(-1).params.document_version, 3); assert.equal(f.saved().state, null);
});

test('preview cannot save without selection and changing its text invalidates confirmation', async () => {
  const f = fixture(); await f.controller.refresh(); describe(f);
  f.controller.updateStatementDraft({ text: '짧은 설명을 좋아해' });
  assert.equal(f.controller.read().statementEditor.preview, null);
  await f.controller.confirmStatement(); assert.deepEqual(f.saved().state, empty());
  f.controller.previewStatement(); await f.controller.confirmStatement(); assert.deepEqual(f.saved().state, empty());
  assert.equal(f.controller.read().error, 'interpretation');
});

const clarificationText = '새 일에서는 설명이 있어야 마음이 놓여요';
function answer(f, optionId) {
  const question = f.controller.read().statementEditor.preview.question;
  assert.ok(question, `question for ${optionId}`);
  assert.ok(question.options.some(option => option.id === optionId));
  assert.equal(f.controller.answerStatement({ questionId: question.id, optionId }), true);
  return question.id;
}

test('successive clarification answers remain local until the newly interpreted meaning is explicitly confirmed', async () => {
  const f = fixture(); await f.controller.refresh(); describe(f, clarificationText);
  const initial = f.controller.read().statementEditor;
  assert.equal(initial.clarifications.length, 0); assert.ok(initial.preview.question);
  assert.equal(f.controller.answerStatement({ questionId: 'old-question', optionId: 'support' }), false);
  assert.equal(f.controller.answerStatement({ questionId: initial.preview.question.id, optionId: 'invented-option' }), false);
  assert.deepEqual(f.controller.read().statementEditor, initial);
  const first = answer(f, 'support');
  assert.equal(f.controller.answerStatement({ questionId: first, optionId: 'support' }), false);
  for (const optionId of ['example', 'prefer', 'first-try']) answer(f, optionId);
  const ready = f.controller.read().statementEditor;
  assert.equal(ready.preview.question, null); assert.equal(ready.preview.at, initial.preview.at);
  assert.equal(ready.clarifications.length, 4); assert.equal(ready.preview.clarificationAnswers.length, 4);
  assert.deepEqual(ready.acceptedIds, []); assert.equal(ready.preview.proposals.length, 1);
  assert.equal(ready.preview.proposals[0].value, 'example'); assert.equal(ready.preview.proposals[0].condition, 'first-try');
  assert.equal(f.calls.filter(call => call.operation !== 'understandingLoad').length, 0);
  await f.controller.confirmStatement(); assert.deepEqual(f.saved().state, empty());
  f.controller.updateStatementDraft({ acceptedIds: [ready.preview.proposals[0].id] });
  // Public snapshots cannot change the controller's source, preview, or answers.
  ready.text = '혼자 하는 게 좋아요.'; ready.clarifications[0].optionId = 'explanation'; ready.preview.proposals[0].value = 'independent';
  await f.controller.confirmStatement();
  const state = f.saved().state;
  assert.equal(state.version, 7); assert.equal(state.statements[0].text, clarificationText);
  assert.equal(state.statements[0].clarifications.length, 4); assert.equal(state.statements[0].meanings[0].value, 'example');
  const reopened = fixture({ state }); await reopened.controller.refresh(); assert.deepEqual(reopened.controller.read().document, state);
});

test('a pending question blocks persistence and resetting answers removes accepted meanings', async () => {
  const f = fixture(); await f.controller.refresh(); describe(f, '혼자 하는 게 좋아요. ' + clarificationText);
  await f.controller.confirmStatement();
  assert.equal(f.controller.read().error, 'interpretation'); assert.deepEqual(f.saved().state, empty());
  for (const optionId of ['support', 'example', 'prefer', 'first-try']) answer(f, optionId);
  const ready = f.controller.read().statementEditor;
  f.controller.updateStatementDraft({ acceptedIds: ready.preview.proposals.map(row => row.id) });
  assert.equal(f.controller.resetStatementAnswers(), true);
  const reset = f.controller.read().statementEditor;
  assert.equal(reset.clarifications.length, 0); assert.deepEqual(reset.acceptedIds, []); assert.ok(reset.preview.question);
  assert.deepEqual(f.saved().state, empty());
  answer(f, 'skip');
  assert.equal(f.controller.read().statementEditor.preview.question, null);
  assert.equal(f.controller.read().statementEditor.preview.proposals.length, 1);
  assert.equal(f.controller.read().statementEditor.preview.proposals[0].value, 'independent');
});

test('editing, cancellation, leaving and account replacement discard all clarification answers without writes', async () => {
  for (const action of ['edit', 'change', 'cancel', 'hide', 'account', 'generation']) {
    const f = fixture(); await f.controller.refresh(); describe(f, clarificationText); answer(f, 'support');
    if (action === 'edit') f.controller.editStatementText();
    else if (action === 'change') f.controller.updateStatementDraft({ text: '자세한 설명이 좋아요.' });
    else if (action === 'cancel') f.controller.cancel();
    else if (action === 'hide') f.controller.hide();
    else f.setIdentity(action === 'account' ? { accountId: randomUUID() } : { sessionGeneration: 2 });
    const next = f.controller.read().statementEditor;
    if (['edit', 'change'].includes(action)) { assert.deepEqual(next.clarifications, []); assert.equal(next.preview, null); assert.deepEqual(next.acceptedIds, []); }
    else assert.equal(next, null);
    assert.equal(f.controller.answerStatement({ questionId: 'old-question', optionId: 'example' }), false);
    assert.equal(f.calls.filter(call => call.operation !== 'understandingLoad').length, 0);
    f.controller.stop();
  }
});

test('statement acknowledgement timeout retries one UUID and preserves other concurrent statements', async () => {
  const f = fixture({ timeoutMs: 15 }); await f.controller.refresh(); describe(f);
  f.setHook((call, dispatch) => { const result = dispatch(); return call.operation === 'understandingSave' ? new Promise(() => {}) : result; });
  await f.controller.confirmStatement(); assert.ok(f.controller.read().statementEditor);
  f.controller.updateStatementDraft({ acceptedIds: f.controller.read().statementEditor.acceptedIds });
  f.setHook(null); await f.controller.confirmStatement(); assert.equal(f.generated, 1); assert.equal(f.saved().state.statements.length, 1);
  describe(f, '자세한 설명을 좋아해');
  const before = f.saved().state;
  f.records.set(f.owner, { state: { ...before, statements: [] }, revision: f.saved().revision + 1 });
  await f.controller.confirmStatement(); assert.equal(f.controller.read().error, 'conflict'); assert.equal(f.saved().state.statements.length, 0);
});

test('session change during statement save discards draft and prevents a late write', async () => {
  const f = fixture(); await f.controller.refresh(); describe(f); const gate = deferred();
  f.setHook((call, dispatch) => call.operation === 'understandingLoad' ? gate.promise.then(dispatch) : dispatch());
  const saving = f.controller.confirmStatement(); await tick(); f.setIdentity({ sessionGeneration: 2 });
  assert.equal(f.controller.read().statementEditor, null); gate.resolve(); await saving;
  assert.equal(f.calls.filter(x => x.operation === 'understandingSave').length, 0);
});

test('leaving the screen invalidates a pending read and clears local corrections and draft', async () => {
  const f = fixture({ state: { ...empty(), overrides: [row()] } }), gate = deferred();
  f.setHook((_call, dispatch) => gate.promise.then(dispatch)); const loading = f.controller.refresh(); await tick(); f.controller.hide(); gate.resolve(); await loading;
  assert.equal(f.controller.read().document, null); assert.equal(f.controller.read().editor, null);
});

test('account changes in promise handoffs cannot publish a prior load/save/delete acknowledgement', async () => {
  for (const operation of ['understandingLoad', 'understandingSave', 'understandingDelete']) {
    for (let depth = 0; depth < 12; depth++) {
      let identity = { status: 'signed-in', signedIn: true, accountId: 'synthetic-owner-a', sessionGeneration: 1 }, hold = false;
      let state = { ...empty(), overrides: [row('support', ['independent'])] }, revision = 5;
      const gate = deferred(), reached = deferred(); let acknowledgement;
      const controller = createMemberUnderstanding({ getIdentity: () => identity, now: () => NOW, request(name, params) {
        if (name === 'understandingSave') { state = structuredClone(params.state); revision++; }
        if (name === 'understandingDelete') { state = null; revision++; }
        const result = { ok: true, scope: 'synk-personal', resource: 'member-understanding', accountId: 'synthetic-owner-a', state: structuredClone(state), revision };
        if (hold && name === operation) { acknowledgement = result; reached.resolve(); return gate.promise; }
        return result;
      } });
      await controller.refresh(); hold = true;
      let pending;
      if (operation === 'understandingLoad') pending = controller.refresh();
      else if (operation === 'understandingDelete') pending = controller.clear();
      else { assert(controller.begin({ facetId: 'support', mode: 'override', values: ['step'] })); pending = controller.save(); }
      await reached.promise; gate.resolve(acknowledgement);
      const change = () => { identity = { status: 'signed-in', signedIn: true, accountId: 'synthetic-owner-b', sessionGeneration: 2 }; controller.read(); };
      let next = change; for (let i = 0; i < depth; i++) { const task = next; next = () => queueMicrotask(task); } next();
      await pending; await tick(); const result = controller.read();
      assert.equal(result.document, null, `${operation}, handoff ${depth}: previous owner's document`);
      assert.equal(result.revision, 0, `${operation}, handoff ${depth}: previous owner's revision`);
      assert.equal(result.message, '', `${operation}, handoff ${depth}: previous owner's success notice`);
      assert.equal(result.editor, null); controller.stop();
    }
  }
});
