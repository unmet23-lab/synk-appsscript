'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
let bindMemberUnderstandingEditor, captureMemberUnderstandingFocus;
before(async () => ({ bindMemberUnderstandingEditor, captureMemberUnderstandingFocus } = await import('../desktop/renderer/member-understanding-host.mjs')));

function fixture(stage = 'preview') {
  const listeners = new Map(), calls = [];
  const root = { contains: () => true, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const controller = Object.fromEntries(['answerStatement', 'resetStatementAnswers', 'previewStatement', 'confirmStatement', 'editStatementText', 'updateStatementDraft', 'cancel'].map(name => [name, value => calls.push({ name, value })]));
  controller.read = () => ({ statementEditor: { stage } });
  const dispose = bindMemberUnderstandingEditor(root, { controller });
  const click = (action, attributes = {}, disabled = false) => {
    const button = { disabled, dataset: { insightAction: 'understanding-' + action, ...attributes }, closest: () => null };
    const event = { target: { closest: () => button }, preventDefault() {}, stopImmediatePropagation() {} };
    listeners.get('click')(event);
  };
  const submit = () => listeners.get('submit')({ target: { matches: selector => selector === '[data-insight-statement-editor]', querySelector: () => null, querySelectorAll: () => [] }, preventDefault() {}, stopPropagation() {} });
  return { calls, click, submit, dispose, listeners };
}

test('a clarification click forwards only question and option identity without confirming or drafting', () => {
  const f = fixture();
  f.click('answer-statement', { insightQuestion: 'scope.0', insightOption: 'first-try', insightText: 'untrusted ignored text' });
  assert.deepEqual(f.calls, [{ name: 'answerStatement', value: { questionId: 'scope.0', optionId: 'first-try' } }]);
  f.click('answer-statement', { insightQuestion: 'scope.0', insightOption: 'skip' }, true);
  assert.equal(f.calls.length, 1);
  f.click('reset-answers'); assert.equal(f.calls.at(-1).name, 'resetStatementAnswers');
  f.dispose(); assert.equal(f.listeners.size, 0);
});

test('submitting a statement previews writing but never treats Enter as final confirmation', () => {
  const writing = fixture('writing'); writing.submit();
  assert.deepEqual(writing.calls.map(call => call.name), ['updateStatementDraft', 'previewStatement']);
  const preview = fixture('preview'); preview.submit();
  assert.deepEqual(preview.calls.map(call => call.name), ['updateStatementDraft']);
  preview.click('confirm-statement');
  assert.equal(preview.calls.at(-1).name, 'confirmStatement');
});

test('a new clarification receives focus rather than a similarly named option from the previous question', () => {
  const values = new Map([['data-insight-action', 'understanding-answer-statement'], ['data-insight-question', 'scope.0'], ['data-insight-option', 'skip']]);
  const active = { getAttribute: name => values.get(name) ?? null, hasAttribute: name => values.has(name) };
  let wrongFocus = false, headingFocus = false;
  const next = { getAttribute: name => name === 'data-insight-question' ? 'meaning.0' : values.get(name) ?? null, focus() { wrongFocus = true; } };
  const container = { ownerDocument: { activeElement: active }, contains: () => true, querySelectorAll: () => [next], querySelector: () => ({ focus() { headingFocus = true; } }) };
  captureMemberUnderstandingFocus(container)();
  assert.equal(wrongFocus, false); assert.equal(headingFocus, true);
});
