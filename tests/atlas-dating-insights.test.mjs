import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter, DISCOVERY_FIELDS } from '../experiences/atlas-lab/discovery.mjs';
import { compareCandidates, getDisclosureDifferences, getPreferenceSummary } from '../experiences/atlas-lab/dating-insights.mjs';

const clone = value => structuredClone(value);
const reason = (field, comparison, message = `${field} 공개 근거`) => ({ field, label: field, comparison, text: message, owner: 'self', editable: true, source: 'baseline' });
const candidate = (id, reasons) => ({ id, label: `공개 후보 ${id}`, status: 'eligible', reasonDetails: reasons });
function discovery(priorities = ['wants.pace', 'wants.plan']) {
  return { status: 'ready', context: { closed: false }, priorities: { effective: priorities }, fields: DISCOVERY_FIELDS.map(field => ({
    id: field.id, label: field.label, kind: field.kind, value: field.id === 'consent' ? true : null, state: field.id === 'consent' ? 'known' : 'unknown' })),
    candidates: [candidate('a', [reason('wants.pace', 'match'), reason('wants.plan', 'different')]),
      candidate('b', [reason('wants.pace', 'different'), reason('wants.plan', 'match')])] };
}
function hosted() {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
  return { status: 'active', consents: { storePreferences: true, profilePublic: true }, profile: { values: {} }, discovery: api.inspect(api.create('ready')) };
}

test('preference summary shows only required, known priorities, active context and unknown declarations without repeating ordinary baseline answers', () => {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
  let state = api.record(api.create('ready'), { kind: 'set', field: 'wants.pace', value: 'lead', required: true });
  state = api.record(state, { kind: 'priorities', fields: ['wants.plan', 'wants.contact'], target: 'baseline' });
  state = api.record(state, { kind: 'set', field: 'wants.plan', value: 'spontaneous', target: 'context', until: '2026-10-08T00:00:00.000Z' });
  const view = hosted(); view.discovery = api.inspect(state); const before = clone(view), out = getPreferenceSummary(view);
  assert.equal(out.status, 'ready'); assert.deepEqual(out.groups.map(g => g.id), ['required', 'priorities', 'context', 'unknown']);
  assert.deepEqual(out.groups[0].items.map(i => i.field), ['availability', 'wants.pace']);
  assert.deepEqual(out.groups[1].items.map(i => i.field), ['wants.plan'], 'an unknown priority is not a known preference');
  assert.equal(out.groups[2].items[0].field, 'wants.plan'); assert.equal(out.groups[2].items[0].until, '2026-10-08T00:00:00.000Z');
  assert.ok(out.groups[3].items.some(i => i.field === 'wants.contact'));
  assert.ok(out.groups.every(g => g.items.every(i => !['consent', 'self.pace', 'self.plan'].includes(i.field))));
  assert.match(out.summary, /나머지 평소 답/); assert.deepEqual(view, before);
  out.groups[0].items[0].valueLabel = 'changed'; assert.notEqual(getPreferenceSummary(view).groups[0].items[0].valueLabel, 'changed');
});

test('summary keeps the baseline must-have visible beside conflicting context and does not let an unknown or missing hard answer inherit soft context', () => {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
  let state = api.record(api.create('ready'), { kind: 'set', field: 'wants.pace', value: 'lead', required: true });
  state = api.record(state, { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context' });
  const inspect = state => getPreferenceSummary({ ...hosted(), discovery: api.inspect(state) });
  const conflict = inspect(state);
  assert.match(conflict.groups[0].items.find(i => i.field === 'wants.pace').valueLabel, /이끌어/);
  assert.match(conflict.groups[2].items.find(i => i.field === 'wants.pace').valueLabel, /차분히/);
  assert.match(conflict.groups[0].items.find(i => i.field === 'wants.pace').detail, /보류/);
  state = api.record(state, { kind: 'mark-unknown', field: 'wants.pace' });
  assert.match(inspect(state).groups[3].items.find(i => i.field === 'wants.pace').detail, /직접/);
  assert.match(inspect(state).groups[0].items.find(i => i.field === 'wants.pace').detail, /이번에는 모른/);
  state = api.record(state, { kind: 'clear', field: 'wants.pace', target: 'baseline' });
  state = api.record(state, { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context' });
  const missing = inspect(state);
  assert.equal(missing.groups[0].items.find(i => i.field === 'wants.pace').valueLabel, '답 미확인');
  assert.ok(missing.groups[3].items.some(i => i.field === 'wants.pace'));
});

test('summary returns to a live baseline after context expiry, preserves explicit any and distinguishes expired baseline from unknown', () => {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization }), until = '2026-10-07T00:00:00.000Z';
  let state = api.record(api.create('ready'), { kind: 'priorities', fields: ['wants.plan'], target: 'baseline' });
  state = api.record(state, { kind: 'set', field: 'wants.plan', value: 'any', target: 'context', until });
  const out = at => getPreferenceSummary({ ...hosted(), discovery: api.inspect(state, at ? { at } : {}) });
  assert.match(out().groups[2].items[0].valueLabel, /어느 쪽도/); assert.ok(!out().groups[3].items.some(i => i.field === 'wants.plan'));
  assert.equal(out(until).groups[2].items.length, 0); assert.match(out(until).groups[1].items[0].valueLabel, /미리 계획/);
  assert.match(out(until).summary, /유효한 평소 답/);
  state = api.record(api.create('ready'), { kind: 'set', field: 'wants.pace', value: 'lead', required: true, until });
  const expired = out(until);
  assert.match(expired.groups[0].items.find(i => i.field === 'wants.pace').valueLabel, /기한/);
  assert.ok(expired.groups[3].items.some(i => i.field === 'wants.pace'));
});

test('summary validates priority limits, ignores other private projections and does not ask questions or read source events', () => {
  for (const fields of [['wants.pace', 'wants.pace'], ['self.pace'], ['wants.pace', 'wants.plan', 'wants.contact']]) {
    const view = hosted(); view.discovery.priorities.effective = fields;
    const out = getPreferenceSummary(view); assert.equal(out.status, 'unavailable'); assert.ok(out.groups.every(g => !g.items.length));
  }
  for (const override of [{ status: 'deleted' }, { status: 'suspended' }, { consents: { storePreferences: false } }, { discovery: null }])
    assert.equal(getPreferenceSummary({ ...hosted(), ...override }).status, 'unavailable');
  const view = hosted();
  for (const key of ['experience', 'pairs', 'profile']) Object.defineProperty(view, key, { get() { throw new Error(`private ${key}`); } });
  for (const key of ['events', 'reasons', 'feedback', 'scenes', 'question', 'candidates']) Object.defineProperty(view.discovery, key, { get() { throw new Error(`not needed ${key}`); } });
  assert.equal(getPreferenceSummary(view).status, 'ready');
});

test('comparison uses the two declared priority fields and their existing own-direction reasons', () => {
  const d = discovery(), result = compareCandidates(d, ['a', 'b'], { fields: ['wants.notice'] });
  assert.equal(result.status, 'ready'); assert.deepEqual(result.fields, ['wants.pace', 'wants.plan']);
  assert.deepEqual(result.rows.map(row => row.cells.map(cell => cell.state)), [['match', 'different'], ['different', 'match']]);
  assert.equal(result.same, false); assert.equal('score' in result, false);
  assert.deepEqual(result.columns, [{ id: 'a', label: '공개 후보 a' }, { id: 'b', label: '공개 후보 b' }]);
});

test('without priorities the user chooses one or two comparison fields without changing recommendation settings', () => {
  const d = discovery([]), snapshot = clone(d);
  const missing = compareCandidates(d, ['a', 'b']);
  assert.equal(missing.status, 'choose-fields'); assert.deepEqual(missing.rows, []);
  assert.ok(missing.options.some(item => item.field === 'wants.notice'));
  assert.ok(missing.options.every(item => item.field.startsWith('wants.')));
  assert.equal(compareCandidates(d, ['a', 'b'], { fields: ['wants.plan'] }).rows.length, 1);
  assert.deepEqual(d, snapshot);
  for (const fields of [['self.pace'], ['wants.pace', 'wants.pace'], ['wants.pace', 'wants.plan', 'wants.notice']])
    assert.equal(compareCandidates(d, ['a', 'b'], { fields }).status, 'unavailable');
});

test('invalid, duplicate, revoked, held or excluded selections return no candidate identity or explanation', () => {
  for (const ids of [[], ['a'], ['a', 'a'], ['a', 'b', 'c'], ['a', 'hidden']]) {
    const out = compareCandidates(discovery(), ids); assert.equal(out.status, 'unavailable'); assert.deepEqual(out.columns, []); assert.deepEqual(out.rows, []);
  }
  for (const status of ['pending', 'excluded']) {
    const d = discovery(); d.candidates[1].status = status;
    const out = compareCandidates(d, ['a', 'b']); assert.equal(out.status, 'unavailable'); assert.deepEqual(out.columns, []);
  }
  const revoked = discovery(); revoked.fields.find(field => field.id === 'consent').value = false;
  assert.deepEqual(compareCandidates(revoked, ['a', 'b']).columns, []);
  const closed = discovery(); closed.context.closed = true; assert.deepEqual(compareCandidates(closed, ['a', 'b']).columns, []);
  const duplicate = discovery(); duplicate.candidates.push(clone(duplicate.candidates[0])); assert.deepEqual(compareCandidates(duplicate, ['a', 'b']).columns, []);
});

test('same result is based on structured comparison, never candidate names or localized wording', () => {
  const d = discovery(['wants.pace']);
  d.candidates[0].reasonDetails = [reason('wants.pace', 'match', 'A가 공개한 답은 기준에 맞아요.')];
  d.candidates[1].reasonDetails = [reason('wants.pace', 'match', 'B의 답도 같은 기준을 충족해요.')];
  const result = compareCandidates(d, ['a', 'b']);
  assert.equal(result.same, true); assert.match(result.summary, /비교 결과는 같아요/);
  d.candidates[1].reasonDetails[0].comparison = 'different';
  d.candidates[1].reasonDetails[0].text = d.candidates[0].reasonDetails[0].text;
  assert.equal(compareCandidates(d, ['a', 'b']).same, false, 'identical text cannot override structured differences');
});

test('unknown, absent, duplicate and legacy textual reasons never invent a comparison', () => {
  const d = discovery(['wants.pace']);
  d.candidates[0].reasonDetails = [reason('wants.pace', 'unknown')];
  d.candidates[1].reasonDetails = [{ field: 'wants.pace', owner: 'self', text: '완벽하게 맞아요.' }];
  let out = compareCandidates(d, ['a', 'b']); assert.equal(out.same, null); assert.deepEqual(out.rows[0].cells.map(item => item.state), ['unknown', 'unknown']);
  d.candidates[1].reasonDetails = [reason('wants.pace', 'match'), reason('wants.pace', 'different')];
  out = compareCandidates(d, ['a', 'b']); assert.equal(out.rows[0].cells[1].state, 'unknown');
  d.candidates[1].reasonDetails = [{ ...reason('wants.pace', 'match'), owner: 'partner' }];
  assert.equal(compareCandidates(d, ['a', 'b']).rows[0].cells[1].state, 'unknown');
});
test('condition satisfied from structured contact metadata is distinct from a primary match', () => {
  const d = discovery(['wants.contact']);
  d.candidates[0].reasonDetails = [{ ...reason('wants.contact', 'conditional', '공개한 사전 예고 방식이 허용 조건에 맞아요.'), conditionStatus: 'satisfied', conditionalRuleId: 'contact-with-notice' }];
  d.candidates[1].reasonDetails = [reason('wants.contact', 'match', '원래 연락 선호와 같아요.')];
  let out = compareCandidates(d, ['a', 'b']);
  assert.deepEqual(out.rows[0].cells.map(cell => cell.state), ['conditional', 'match']); assert.equal(out.same, false);
  d.candidates[0].reasonDetails[0].conditionStatus = 'unknown';
  out = compareCandidates(d, ['a', 'b']); assert.equal(out.rows[0].cells[0].state, 'unknown');
});

test('explicit any is a known comparison result, and raw candidate values or private data are never read', () => {
  const d = discovery(['wants.pace']);
  for (const person of d.candidates) {
    person.reasonDetails = [reason('wants.pace', 'any')];
    for (const key of ['values', 'raw', 'private', 'feedback', 'matched', 'differences'])
      Object.defineProperty(person, key, { get() { throw new Error(`must not read ${key}`); } });
  }
  const result = compareCandidates(d, ['a', 'b']);
  assert.deepEqual(result.rows[0].cells.map(item => item.state), ['known', 'known']); assert.equal(result.same, true);
});

test('comparison results are detached and cannot change the source view', () => {
  const d = discovery(), snapshot = clone(d), result = compareCandidates(d, ['a', 'b']);
  result.columns[0].label = 'changed'; result.rows[0].cells[0].text = 'changed'; result.fields[0] = 'wants.notice';
  result.options[0].label = 'changed'; assert.deepEqual(d, snapshot);
});

test('actual Discovery comparison metadata exposes the expected tradeoff without inspecting raw candidates', () => {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
  const state = api.record(api.create('ready'), { kind: 'priorities', fields: ['wants.pace', 'wants.plan'], target: 'context' });
  const result = compareCandidates(api.inspect(state), ['candidate-1', 'candidate-2']);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.rows.map(row => row.cells.map(cell => cell.state)), [['match', 'different'], ['match', 'match']]);
  assert.equal(result.same, false);
  assert.equal(compareCandidates(api.inspect(state), ['candidate-1', 'candidate-4']).status, 'unavailable');
  assert.equal(compareCandidates(api.inspect(state), ['candidate-1', 'candidate-5']).status, 'unavailable');
});

test('disclosure differences compare valid ongoing self answers only, not wants, consent or availability', () => {
  const view = hosted(), result = getDisclosureDifferences(view);
  assert.equal(result.status, 'ready'); assert.deepEqual(result.differences.map(item => item.field), ['self.pace', 'self.plan']);
  const pace = result.differences[0]; assert.equal(pace.baselineValue, 'listen'); assert.equal(pace.publicValue, null);
  assert.match(pace.baselineLabel, /듣고/); assert.equal(result.canEnablePublic, false);
  view.profile.values['self.pace'] = 'listen'; assert.deepEqual(getDisclosureDifferences(view).differences.map(item => item.field), ['self.plan']);
  view.profile.values['self.plan'] = 'spontaneous';
  assert.equal(getDisclosureDifferences(view).differences[0].publicValue, 'spontaneous');
});

test('context-only, expired, missing and once provenance can never be published as an ongoing answer', () => {
  for (const mutate of [
    field => { field.baseline.state = 'unknown'; field.context = { state: 'known', value: 'lead' }; field.value = 'lead'; },
    field => { field.baseline.state = 'expired'; },
    field => { field.baseline.expired = [{ field: 'self.pace', value: 'listen' }]; },
    field => { field.baseline.provenance.duration = 'once'; },
    field => { field.baseline.value = 'not-a-declared-option'; },
  ]) {
    const view = hosted(); mutate(view.discovery.fields.find(field => field.id === 'self.pace'));
    assert.equal(getDisclosureDifferences(view).differences.some(item => item.field === 'self.pace'), false);
  }
  const view = hosted(), pace = view.discovery.fields.find(field => field.id === 'self.pace');
  pace.value = 'lead'; pace.context = { state: 'known', value: 'lead' };
  assert.equal(getDisclosureDifferences(view).differences.find(item => item.field === 'self.pace').baselineValue, 'listen', 'only the valid baseline is used');
});

test('disclosure requires current active account/storage projection and never grants public visibility', () => {
  for (const extra of [{ status: 'deleted' }, { status: 'suspended' }, { consents: { storePreferences: false, profilePublic: true } }, { discovery: null }]) {
    const out = getDisclosureDifferences({ ...hosted(), ...extra }); assert.equal(out.status, 'unavailable'); assert.deepEqual(out.differences, []);
  }
  const view = hosted(); view.consents.profilePublic = false;
  const out = getDisclosureDifferences(view); assert.equal(out.status, 'ready'); assert.equal(out.profilePublic, false); assert.equal(out.canEnablePublic, false);
  assert.match(out.notice, /공개를 켜지 않아요/); assert.equal(out.differences.length, 2);
  assert.equal(view.consents.profilePublic, false);
});

test('disclosure ignores private reasons and arbitrary malformed public values and returns detached summaries', () => {
  const view = hosted(); view.profile.values['self.pace'] = 'sensitive arbitrary text';
  for (const key of ['reasons', 'feedback', 'pendingProposals'])
    Object.defineProperty(view.discovery, key, { get() { throw new Error(`must not read ${key}`); } });
  const result = getDisclosureDifferences(view);
  assert.equal(result.differences.some(item => item.field === 'self.pace'), false);
  assert.equal(JSON.stringify(result).includes('sensitive arbitrary text'), false);
  result.differences[0].baselineValue = 'changed';
  assert.equal(view.discovery.fields.find(field => field.id === 'self.plan').baseline.value, 'planned');
});

test('actual preference expiry removes a previously publishable baseline while keeping saved public data unchanged', () => {
  const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
  const state = api.record(api.create('ready'), { kind: 'set', field: 'self.pace', value: 'lead', until: '2026-10-07T00:00:00.000Z' });
  const view = hosted(); view.profile.values['self.pace'] = 'listen'; view.discovery = api.inspect(state);
  assert.equal(getDisclosureDifferences(view).differences.find(item => item.field === 'self.pace').baselineValue, 'lead');
  view.discovery = api.inspect(state, { at: '2026-10-07T00:00:00.000Z' });
  assert.equal(getDisclosureDifferences(view).differences.some(item => item.field === 'self.pace'), false);
  assert.equal(view.profile.values['self.pace'], 'listen');
  const renewed = api.record(state, { kind: 'set', field: 'self.pace', value: 'lead', at: '2026-10-07T00:00:01.000Z' });
  view.discovery = api.inspect(renewed);
  assert.equal(view.discovery.fields.find(item => item.id === 'self.pace').baseline.expired, undefined, 'Core exposes only the latest selected baseline, not historical expiry');
  assert.equal(getDisclosureDifferences(view).differences.find(item => item.field === 'self.pace').baselineValue, 'lead');
});
