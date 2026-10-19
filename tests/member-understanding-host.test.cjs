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

// One-tap answers, the settings editor and the jump to the basis (2026-10-19 skeleton).
function insightFixture({ report = {}, saved = { error: null, editor: null } } = {}) {
  const listeners = new Map(), calls = [];
  const details = { tagName: 'DETAILS', open: false, scrollIntoView() { calls.push({ name: 'scroll' }); }, querySelector: () => ({ focus() { calls.push({ name: 'focus' }); } }) };
  const root = { contains: () => true, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), querySelector: selector => selector === '#mi2-why' ? details : null };
  const controller = Object.fromEntries(['answer', 'begin', 'cancel'].map(name => [name, value => { calls.push({ name, value }); return Promise.resolve({}); }]));
  controller.read = () => ({});
  const settings = { begin: value => calls.push({ name: 'settings.begin', value }), choose: value => calls.push({ name: 'settings.choose', value }), cancel: () => calls.push({ name: 'settings.cancel' }),
    save: async value => { calls.push({ name: 'settings.save', value }); return saved; } };
  bindMemberUnderstandingEditor(root, { controller, getReport: () => report, settings, getSettingsContext: () => ({ revision: 7, enabled: true, shared: 'practice-and-settings' }), onSettingsSaved: () => calls.push({ name: 'saved' }) });
  const click = (action, dataset = {}, form = null) => {
    const button = { disabled: false, dataset: { insightAction: action, ...dataset }, closest: () => form };
    listeners.get('click')({ target: { closest: () => button }, preventDefault() {}, stopImmediatePropagation() {} });
  };
  return { calls, click, details };
}
const facets = [
  { id: 'practice-mode', available: true, claim: { version: 1, reference: 'listening' }, choices: [{ id: 'listening', label: '듣기' }] },
  { id: 'learning-topic:sit-cafe', available: true, claim: { version: 1, reference: 'sit-cafe' }, choices: [{ id: 'interested' }, { id: 'practice-only' }, { id: 'not-now' }] },
  { id: 'learning-topic:gone', available: false, claim: null, choices: [{ id: 'interested' }] },
];

test('an answer tap sends the facet and the report\'s own claim, never a value from the page', () => {
  const f = insightFixture({ report: { understanding: { facets } } });
  f.click('understanding-answer', { insightFacet: 'practice-mode', insightVerdict: 'agree', insightClaim: '{"forged":true}' });
  assert.deepEqual(f.calls.at(-1), { name: 'answer', value: { facetId: 'practice-mode', verdict: 'agree', claim: facets[0].claim } });
  f.click('understanding-answer', { insightFacet: 'learning-topic:sit-cafe', insightValue: 'not-now' });
  assert.deepEqual(f.calls.at(-1), { name: 'answer', value: { facetId: 'learning-topic:sit-cafe', value: 'not-now' } });
  const before = f.calls.length;
  f.click('understanding-answer', { insightFacet: 'learning-topic:sit-cafe', insightValue: 'teleport' });
  f.click('understanding-answer', { insightFacet: 'learning-topic:gone', insightValue: 'interested' });
  f.click('understanding-answer', { insightFacet: 'unknown', insightVerdict: 'agree' });
  assert.equal(f.calls.length, before, 'unknown choices and unavailable facets are ignored');
});

test('settings open with the stored value, save with the summary\'s fence, and re-read the summary only after a save', async () => {
  const f = insightFixture({ report: { settings: { support: 'step' } } });
  f.click('settings-edit', { insightField: 'support' });
  assert.deepEqual(f.calls.at(-1), { name: 'settings.begin', value: { field: 'support', value: 'step' } });
  const form = { querySelector: () => ({ value: 'independent' }) };
  f.click('settings-save', {}, form); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls.slice(-3).map(call => call.name), ['settings.choose', 'settings.save', 'saved']);
  assert.deepEqual(f.calls.find(call => call.name === 'settings.save').value, { revision: 7, enabled: true, shared: 'practice-and-settings' });
  const failed = insightFixture({ report: { settings: {} }, saved: { error: 'FEATURE_DISABLED', editor: { field: 'support' } } });
  failed.click('settings-save', {}, form); await new Promise(resolve => setImmediate(resolve));
  assert.equal(failed.calls.some(call => call.name === 'saved'), false);
  failed.click('settings-cancel'); assert.equal(failed.calls.at(-1).name, 'settings.cancel');
});

test('「왜 이렇게 봤나요?」 opens the basis on the same page without a route change', () => {
  const f = insightFixture();
  f.click('jump', { insightTarget: 'mi2-why' });
  assert.equal(f.details.open, true); assert.deepEqual(f.calls.map(call => call.name), ['scroll', 'focus']);
  f.click('jump', { insightTarget: 'x"]); alert(1); //' }); assert.equal(f.calls.length, 2, 'an unexpected target is ignored');
});
