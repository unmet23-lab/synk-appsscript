import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import ConditionalPreference from '../atlas/conditional-preference.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
import { replayObservation } from './fixtures/atlas-discovery-replay-contract.mjs';

// These persisted synthetic documents and outcomes were captured from the pre-refactor source,
// not calculated by today's reducers. They keep replay compatibility testable after that source
// disappears from the worktree. A policy change needs a deliberate fixture review.
const fixture = JSON.parse(await readFile(new URL('./fixtures/atlas-discovery-replay-golden.json', import.meta.url), 'utf8'));
const outcome = fn => {
  try { return { ok: true, value: fn() }; }
  catch (error) { return { ok: false, name: error.name, message: error.message, ...(error.code === undefined ? {} : { code: error.code }) }; }
};
const json = value => JSON.parse(JSON.stringify(value));
test('persisted fixture observes display state, a successful handoff and both expiry boundaries', () => {
  assert.equal(fixture.baselineCommit, 'c5db75a882270ceff99cb3d307bf1cd0fd796295');
  assert.equal(fixture.baselineSha256LF, 'f19deaee63299fe3d057fc490e0ef5bb52f2f973cb9a6a199469730269ea561a');
  const item = name => {
    const found = fixture.cases.find(row => row.name === name);
    assert.ok(found, `missing replay boundary: ${name}`);
    return found;
  };
  assert.ok(fixture.cases.some(row => row.expected.inspect.value.change?.afterId));
  assert.ok(fixture.cases.some(row => row.expected.inspect.value.repetition?.status === 'unchanged'));
  const selected = item('selection and successful handoff survive before preference expiry');
  const expired = item('selection and handoff disappear exactly when the preference basis expires');
  assert.deepEqual(selected.state, expired.state, 'same persisted selection must be read on both sides of expiry');
  assert.equal(Date.parse(expired.readOptions.at) - Date.parse(selected.readOptions.at), 1);
  assert.ok(selected.expected.inspect.value.selection);
  assert.ok(selected.expected.handoff.value?.key);
  assert.equal(selected.expected.handoff.value.sourceRevision, selected.expected.inspect.value.selection.revision);
  assert.equal(expired.expected.inspect.value.selection, null);
  assert.equal(expired.expected.handoff.value, null);
  for (const name of ['context closes exactly at its expiry and keeps baseline declarations',
    'event after context expiry retains the expired boundary before replaying baseline write']) {
    const view = item(name).expected.inspect.value;
    assert.equal(view.context.closed, true);
    assert.equal(view.context.endedReason, 'expired');
    assert.equal(view.status, 'blocked');
  }
});
for (const item of fixture.cases) test(`persisted discovery replay: ${item.name}`, () => {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization, ConditionalPreference, ...item.config });
  const state = json(item.state), saved = json(state);
  for (const method of ['inspect', 'handoff', 'meetingRegionDeclaration']) {
    assert.deepEqual(json(outcome(() => method === 'inspect' ? replayObservation(api.inspect(state, item.readOptions)) : api[method](state, item.readOptions))), item.expected[method], method);
    assert.deepEqual(state, saved, `${method} must not rewrite history`);
  }
  for (const { action, expected } of item.appends) {
    const actionBefore = json(action);
    assert.deepEqual(json(outcome(() => api.record(state, action))), expected, JSON.stringify(action));
    assert.deepEqual(state, saved, 'appending or rejecting must not mutate the persisted input');
    assert.deepEqual(action, actionBefore, 'appending must not mutate the requested action');
  }
});

test('persisted owner declaration does not evaluate peers or ask questions', () => {
  const item = fixture.cases.find(row => row.name.startsWith('owner meeting declaration'));
  const forbidden = () => { throw new Error('peer evaluation must not run for an owner declaration'); };
  const api = createDiscoveryAdapter({ Domain: { ...Domain, decide: forbidden }, Ask: { ...Ask, choose: forbidden }, Personalization, ConditionalPreference, ...item.config });
  assert.deepEqual(json(outcome(() => api.meetingRegionDeclaration(json(item.state), item.readOptions))), item.expected.meetingRegionDeclaration);
});
