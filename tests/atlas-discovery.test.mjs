import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createDiscoveryAdapter, DISCOVERY_FIELDS, DISCOVERY_SCENARIOS } from '../experiences/atlas-lab/discovery.mjs';
import { mountDiscoveryLab } from '../experiences/atlas-lab/discovery-ui.mjs';
const api = createDiscoveryAdapter({ Domain, Ask, Personalization });
const inspect = state => api.inspect(state);
const set = (state, field, value, required) => api.record(state, { kind: 'set', field, value, ...(required === undefined ? {} : { required }) });
const clear = (state, field) => api.record(state, { kind: 'clear', field });
const choose = (state, candidateId) => api.record(state, { kind: 'select', candidateId });
const row = (state, id) => inspect(state).candidates.find(candidate => candidate.id === id);
const contextSet = (state, field, value, extra = {}) => api.record(state, { kind: 'set', field, value, target: 'context', ...extra });
const fieldView = (state, id) => inspect(state).fields.find(field => field.id === id);

test('expanded situational declarations remain unknown in legacy records and change ranking only after an explicit answer', () => {
  const initial = api.create('ready');
  for (const axis of ['purpose', 'relationshipGoal', 'relationshipSpeed', 'contact', 'rhythm']) for (const kind of ['self', 'wants']) assert.equal(fieldView(initial, `${kind}.${axis}`).state, 'unknown');
  const neutral = set(set(initial, 'wants.pace', 'any'), 'wants.plan', 'any');
  for (const [field, value, expected] of [['wants.relationshipGoal', 'committed', 'candidate-2'], ['wants.contact', 'daily', 'candidate-2'], ['wants.rhythm', 'variable', 'candidate-3']]) {
    const next = set(neutral, field, value); assert.equal(inspect(next).topCandidateId, expected);
    assert.equal(fieldView(next, field.replace('wants.', 'self.')).value, null);
    assert.ok(inspect(next).fields.find(item => item.id === field).options.some(item => item.value === value));
  }
  const hard = set(neutral, 'wants.contact', 'daily', true);
  assert.equal(row(hard, 'candidate-1').status, 'excluded');
  assert.equal(row(contextSet(hard, 'wants.contact', 'any'), 'candidate-1').status, 'excluded');
  const unknown = api.record(neutral, { kind: 'mark-unknown', field: 'wants.contact' });
  assert.equal(fieldView(unknown, 'wants.contact').source, 'explicit-unknown');
});

test('candidate feedback does not infer preferences and skip-current lasts only for its context', () => {
  const initial = choose(api.create('ready'), 'candidate-1');
  let next = api.record(initial, { kind: 'feedback', candidateId: 'candidate-1', reason: 'no-attraction', decision: 'record-only' });
  assert.deepEqual(inspect(next).fields, inspect(initial).fields); assert.deepEqual(inspect(next).selection, inspect(initial).selection);
  assert.deepEqual(api.handoff(next), api.handoff(initial)); assert.equal(inspect(next).feedback[0].reason, 'no-attraction');
  next = api.record(next, { kind: 'feedback', candidateId: 'candidate-1', reason: 'context', decision: 'skip-current' });
  assert.equal(row(next, 'candidate-1').status, 'excluded'); assert.equal(inspect(next).selection, null);
  assert.equal(fieldView(next, 'wants.pace').value, 'lead');
  next = api.record(next, { kind: 'start-context' });
  assert.equal(row(next, 'candidate-1').status, 'eligible'); assert.deepEqual(inspect(next).exclusions, []);
  assert.throws(() => api.record(next, { kind: 'feedback', candidateId: 'hidden-no-consent', reason: 'unknown', decision: 'record-only' }), /feedback/);
  assert.throws(() => api.record(next, { kind: 'feedback', candidateId: 'candidate-1', reason: 'inferred-trait', decision: 'record-only' }), /feedback/);
});

test('question pause suppresses only optional choices and resume retains missing answers', () => {
  let state = api.record(api.create(), { kind: 'stop-questions' });
  assert.equal(inspect(state).question.field, 'consent');
  state = set(state, 'consent', true); assert.equal(inspect(state).question.field, 'availability');
  state = set(state, 'availability', 'weekend'); assert.equal(inspect(state).question.field, 'self.pace', 'reciprocal must-have still requires my answer');
  state = set(state, 'self.pace', 'listen'); assert.equal(inspect(state).question, null);
  state = api.record(state, { kind: 'continue-questions' }); assert.notEqual(inspect(state).question, null);
  state = set(state, 'wants.contact', 'daily', true); state = clear(state, 'wants.contact');
  state = api.record(state, { kind: 'stop-questions' });
  assert.equal(inspect(state).question.field, 'wants.contact'); assert.equal(inspect(state).question.optional, false);
});

test('field undo restores prior layers and hard requirements but never selection, consent, or an old context', () => {
  let state = choose(api.create('ready'), 'candidate-1');
  state = contextSet(state, 'wants.pace', 'listen');
  const change = inspect(state).changes.at(-1); assert.equal(change.before.effective.value, 'lead');
  state = api.record(state, { kind: 'undo-field', field: change.field, changeId: change.id });
  assert.equal(fieldView(state, 'wants.pace').value, 'lead'); assert.equal(fieldView(state, 'wants.pace').context.state, 'inherit');
  assert.equal(inspect(state).selection, null); assert.equal(api.handoff(state), null);
  assert.throws(() => api.record(state, { kind: 'undo-field', field: change.field, changeId: change.id }), /latest/);
  state = set(state, 'wants.pace', 'lead', true); const requiredChange = inspect(state).changes.at(-1);
  state = api.record(state, { kind: 'undo-field', field: 'wants.pace', changeId: requiredChange.id }); assert.equal(fieldView(state, 'wants.pace').required, false);
  const consentChange = inspect(state).changes.find(item => item.field === 'consent');
  assert.equal(consentChange.canUndo, false); assert.throws(() => api.record(state, { kind: 'undo-field', field: 'consent', changeId: consentChange.id }), /consent/);
  const stale = inspect(state).changes.find(item => item.field === 'self.plan'); state = api.record(state, { kind: 'start-context' });
  assert.throws(() => api.record(state, { kind: 'undo-field', field: 'self.plan', changeId: stale.id }), /current-context/);
});

test('exposure rotates only exactly tied eligible candidates and cannot improve an excluded or weaker candidate', () => {
  let state = set(api.create('ready'), 'wants.plan', 'any');
  assert.equal(inspect(state).topCandidateId, 'candidate-1'); assert.deepEqual(inspect(state).topTierIds, ['candidate-1', 'candidate-3']);
  state = choose(state, 'candidate-1'); const seed = api.handoff(state);
  state = api.record(state, { kind: 'expose', candidateIds: ['candidate-1'] });
  assert.equal(inspect(state).topCandidateId, 'candidate-3'); assert.deepEqual(api.handoff(state), seed);
  assert.equal(inspect(state).exposure[0].count, 1); assert.equal(inspect(state).selection.candidateId, 'candidate-1');
  assert.throws(() => api.record(state, { kind: 'expose', candidateIds: ['candidate-4'] }), /eligible/);
  assert.throws(() => api.record(state, { kind: 'expose', candidateIds: ['candidate-5'] }), /eligible/);
  state = set(state, 'wants.pace', 'lead'); state = set(state, 'wants.plan', 'planned');
  assert.equal(inspect(state).topCandidateId, 'candidate-1', 'exposure never outweighs explicit fit');
});

const publicPool = () => [
  { id: 'member:b@example', label: '공개 사용자 B', tagline: '직접 공개한 소개', values: { consent: true, availability: 'weekend', 'self.pace': 'lead', 'wants.pace': 'listen' }, required: ['wants.pace'] },
  { id: 'member-c', label: '공개 사용자 C', values: { consent: true, availability: 'weekend', 'self.pace': 'listen', 'wants.pace': 'any' }, required: [] },
];
const externalApi = (candidates = publicPool(), extra = {}) => createDiscoveryAdapter({ Domain, Ask, Personalization, candidates, ownerId: 'account:a@example', contextId: 'dating-account', synthetic: false, ...extra });
const publicReady = adapter => ['consent', 'availability', 'self.pace', 'wants.pace'].reduce((state, field, i) => adapter.record(state, { kind: 'set', field, value: [true, 'weekend', 'listen', 'lead'][i] }), adapter.create());

test('external public pool uses the same reciprocal constraints without demo profiles, invented values, or synthetic meeting seeds', () => {
  const adapter = externalApi(); let state = publicReady(adapter), view = adapter.inspect(state);
  assert.equal(view.synthetic, false); assert.equal(view.topCandidateId, 'member:b@example');
  assert.equal(view.candidates.length, 2); assert.equal(view.fields.find(field => field.id === 'self.purpose').state, 'unknown');
  assert.equal(state.ownerId, 'account:a@example'); assert.throws(() => adapter.create('ready'), /without synthetic/);
  state = adapter.record(state, { kind: 'select', candidateId: 'member:b@example' }); assert.equal(adapter.handoff(state), null);
  state = adapter.record(state, { kind: 'set', field: 'self.pace', value: 'lead' });
  assert.equal(adapter.inspect(state).candidates.find(row => row.id === 'member:b@example').status, 'excluded');
  assert.throws(() => externalApi(publicPool(), { ownerId: 'other-account' }).inspect(state), /invalid state/);
  assert.throws(() => externalApi(publicPool(), { contextId: 'other-context' }).inspect(state), /invalid state/);
});

test('removed or undisclosed external profiles cannot break history replay or leak through feedback, exposure, preview, or selection', () => {
  const adapter = externalApi(); let state = publicReady(adapter);
  state = adapter.record(state, { kind: 'expose', candidateIds: ['member:b@example'] });
  state = adapter.record(state, { kind: 'feedback', candidateId: 'member:b@example', reason: 'unknown', decision: 'record-only' });
  state = adapter.record(state, { kind: 'select', candidateId: 'member:b@example' });
  const draft = adapter.preview(state, { kind: 'set', field: 'wants.pace', value: 'listen' });
  for (const pool of [publicPool().slice(1), publicPool().map((p, i) => i ? p : { ...p, values: { ...p.values, consent: false } }), []]) {
    const changed = externalApi(pool), view = changed.inspect(state);
    assert.equal(view.selection, null); assert.equal(JSON.stringify(view).includes('member:b@example'), false);
    assert.equal(JSON.stringify(view).includes('공개 사용자 B'), false);
    assert.throws(() => changed.record(state, { kind: 'select', candidateId: 'member:b@example' }), /eligible/);
    assert.throws(() => changed.record(state, { kind: 'feedback', candidateId: 'member:b@example', reason: 'unknown', decision: 'record-only' }), /feedback/);
    assert.throws(() => changed.record(state, { kind: 'expose', candidateIds: ['member:b@example'] }), /eligible/);
    assert.throws(() => changed.applyPreview(state, draft), /stale preview/);
    assert.equal(changed.inspect(changed.record(state, { kind: 'set', field: 'wants.contact', value: 'daily' })).fields.find(field => field.id === 'wants.contact').value, 'daily');
  }
});

test('external profile changes invalidate an old selection without making private answers unreadable', () => {
  const adapter = externalApi(); let state = publicReady(adapter);
  state = adapter.record(state, { kind: 'select', candidateId: 'member:b@example' });
  const pool = publicPool(); pool[0].values['self.pace'] = 'listen';
  const changed = externalApi(pool); assert.equal(changed.inspect(state).selection, null);
  const selected = changed.record(state, { kind: 'select', candidateId: 'member:b@example' }); assert.equal(changed.inspect(selected).selection.candidateId, 'member:b@example');
  pool[0].values.availability = 'weekday'; assert.equal(externalApi(pool).inspect(selected).selection, null);
});

test('external candidate validation is finite and a non-consenting profile never enters Core or Ask', () => {
  const seen = [], pool = publicPool(); pool.push({ id: 'private-person', label: '비공개', values: { consent: false, 'self.pace': 'lead' }, required: [] });
  const adapter = externalApi(pool, { Domain: { ...Domain, decide: input => { seen.push(JSON.stringify(input)); return Domain.decide(input); } } });
  const view = adapter.inspect(publicReady(adapter)); assert.equal(view.candidates.length, 2);
  assert.equal(seen.some(text => text.includes('private-person')), false);
  assert.throws(() => externalApi([{ ...publicPool()[0], values: { consent: true, age: 24 } }]), /candidate/);
  assert.throws(() => externalApi([{ ...publicPool()[0], values: { consent: true, 'self.pace': 'unknown' } }]), /value/);
  assert.throws(() => externalApi([{ ...publicPool()[0], required: ['self.pace'] }]), /candidate/);
  assert.throws(() => externalApi([publicPool()[0], publicPool()[0]]), /duplicate/);
  assert.throws(() => externalApi(Array.from({ length: 101 }, (_, i) => ({ ...publicPool()[0], id: `p-${i}` }))), /pool/);
});

// Small DOM double for the public mount/restore contract; real browser layout and
// interaction are checked separately by the product smoke tests.
function discoveryDocument() {
  class Element {
    constructor(tag, text = '') { this.tagName = tag; this.text = text; this.children = []; this.dataset = {}; this.listeners = {}; this.selected = false; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; if (this.tagName === 'select') delete this.chosen; }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
    set value(value) { this.chosen = value; }
    get value() { return this.chosen ?? (this.tagName === 'select' ? (this.children.find(node => node.selected) || this.children[0])?.value : '') ?? ''; }
    addEventListener(kind, fn) { this.listeners[kind] = fn; }
    dispatch(kind = 'click') { this.listeners[kind]?.(); }
    setAttribute(name, value) { this[name] = value; }
    focus() {} scrollIntoView() {}
  }
  const body = new Element('body');
  const walk = node => [node, ...node.children.flatMap(walk)];
  const doc = { createElement: tag => new Element(tag), createTextNode: text => new Element('#text', text),
    getElementById: id => walk(body).find(node => node.id === id),
    action: (kind, predicate = () => true) => walk(body).find(node => node.dataset.discoveryAction === kind && predicate(node)), body };
  for (const id of ['discovery-summary', 'discovery-notice', 'discovery-preview', 'discovery-question', 'discovery-profile', 'discovery-change', 'discovery-candidates', 'discovery-held', 'discovery-selection', 'discovery-scenarios', 'meeting-title']) {
    const node = doc.createElement('div'); node.id = id; body.append(node);
  }
  return doc;
}

test('legacy UI handlers pause questions, record private reasons, and skip only the current candidate', () => {
  const doc = discoveryDocument(), ui = mountDiscoveryLab({ root: doc, Domain, Ask, Personalization, initialState: api.create('ready'), now: () => '2026-10-06T13:00:00.000Z' });
  doc.action('stop-questions').dispatch(); assert.equal(ui.snapshot().questionsPaused, true); assert.equal(ui.snapshot().question, null);
  doc.action('continue-questions').dispatch(); assert.equal(ui.snapshot().questionsPaused, false);
  const before = ui.snapshot().fields;
  doc.getElementById('discovery-feedback-candidate-1').value = 'no-attraction'; doc.action('feedback').dispatch();
  assert.equal(ui.snapshot().feedback.at(-1).reason, 'no-attraction'); assert.deepEqual(ui.snapshot().fields, before);
  doc.action('skip-candidate').dispatch(); assert.ok(ui.snapshot().exclusions.includes('candidate-1'));
  assert.deepEqual(ui.snapshot().fields, before); ui.dispose();
});

test('legacy UI handlers undo a field without restoring selection and rotate equal-condition candidates', () => {
  const initial = contextSet(choose(api.create('ready'), 'candidate-1'), 'wants.pace', 'listen');
  const doc = discoveryDocument(), ui = mountDiscoveryLab({ root: doc, Domain, Ask, Personalization, initialState: initial, now: () => '2026-10-06T13:00:00.000Z' });
  const change = ui.snapshot().changes.at(-1); doc.action('undo-field', element => element.dataset.discoveryChange === change.id).dispatch();
  assert.equal(ui.snapshot().fields.find(field => field.id === 'wants.pace').value, 'lead'); assert.equal(ui.snapshot().selection, null);
  ui.restoreState(set(api.create('ready'), 'wants.plan', 'any'));
  doc.action('expose').dispatch(); assert.equal(ui.snapshot().topCandidateId, 'candidate-3'); assert.equal(ui.snapshot().exposure[0].candidateId, 'candidate-1'); ui.dispose();
});

test('UI export and restore are detached, validate before replacement, and resynchronize the selected handoff', () => {
  const doc = discoveryDocument(), callbacks = [], saves = [], initial = choose(api.create('ready'), 'candidate-1');
  const ui = mountDiscoveryLab({ root: doc, Domain, Ask, Personalization, initialState: initial,
    now: () => '2026-10-06T11:00:00.000Z', onSelectionChange: seed => callbacks.push(seed), onStateChange: state => saves.push(state) });
  assert.equal(ui.handoff().candidateId, 'candidate-1'); assert.equal(callbacks.length, 1);
  initial.events.length = 0; assert.equal(ui.snapshot().selection.candidateId, 'candidate-1');
  const saved = ui.exportState(); saved.events.length = 0; assert.equal(ui.snapshot().selection.candidateId, 'candidate-1');
  const alternate = choose(api.create('ready'), 'candidate-2'); ui.restoreState(alternate);
  assert.equal(callbacks.at(-1).candidateId, 'candidate-2'); assert.equal(saves.length, 0, 'restore does not cause a cross-tab save echo');
  alternate.events.length = 0; assert.equal(ui.snapshot().selection.candidateId, 'candidate-2');
  const before = ui.exportState(), bad = structuredClone(before); bad.events.at(-1).candidateId = 'hidden-no-consent';
  assert.throws(() => ui.restoreState(bad), /not currently eligible/); assert.deepEqual(ui.exportState(), before);
  doc.action('close-context').dispatch(); assert.equal(ui.snapshot().context.closed, true); assert.equal(callbacks.at(-1), null);
  assert.equal(saves.length, 1); saves[0].events.length = 0; assert.equal(ui.snapshot().context.closed, true);
  assert.ok(Date.parse(ui.exportState().events.at(-1).at) > Date.parse(before.events.at(-1).at), 'an earlier wall clock cannot reorder synthetic events');
});

test('UI context controls apply a temporary choice, unknown mask, revert, and new-context reset through real handlers', () => {
  const doc = discoveryDocument(), ui = mountDiscoveryLab({ root: doc, Domain, Ask, Personalization,
    initialState: api.create('ready'), now: () => '2026-10-06T13:00:00.000Z' });
  const target = doc.getElementById('discovery-edit-target'); target.value = 'context'; target.dispatch('change');
  assert.equal(doc.getElementById('discovery-edit-required').disabled, true);
  doc.getElementById('discovery-edit-value').value = 'listen'; doc.action('preview').dispatch();
  assert.equal(ui.snapshot().topCandidateId, 'candidate-1'); assert.equal(ui.previewSnapshot().after.topCandidateId, 'candidate-2');
  doc.action('preview-apply').dispatch(); assert.equal(ui.snapshot().topCandidateId, 'candidate-2');
  assert.equal(ui.snapshot().fields.find(field => field.id === 'wants.pace').baseline.value, 'lead');
  doc.action('mark-unknown').dispatch(); assert.equal(ui.snapshot().fields.find(field => field.id === 'wants.pace').source, 'explicit-unknown');
  doc.action('revert-context').dispatch(); assert.equal(ui.snapshot().topCandidateId, 'candidate-1');
  doc.action('close-context').dispatch(); assert.equal(ui.snapshot().candidates.length, 0);
  doc.action('start-context').dispatch(); assert.equal(ui.snapshot().context.closed, false); assert.equal(ui.snapshot().topCandidateId, 'candidate-1');
});

test('UI preview uses one clock reading even when wall time advances between calls', () => {
  let tick = Date.parse('2026-10-06T13:00:00.000Z');
  const doc = discoveryDocument(), ui = mountDiscoveryLab({ root: doc, Domain, Ask, Personalization,
    initialState: api.create('ready'), now: () => new Date(tick++).toISOString() });
  doc.getElementById('discovery-edit-value').value = 'listen';
  doc.action('preview').dispatch();
  assert.equal(ui.previewSnapshot()?.after.topCandidateId, 'candidate-2');
  assert.equal(ui.snapshot().topCandidateId, 'candidate-1', 'preview remains read-only');
  doc.action('preview-apply').dispatch(); assert.equal(ui.snapshot().topCandidateId, 'candidate-2');
});

test('switching an edit scope preserves the answer the user has just selected', () => {
  const doc = discoveryDocument(), ui = mountDiscoveryLab({ root: doc, Domain, Ask, Personalization,
    initialState: api.create('ready'), now: () => '2026-10-06T13:00:00.000Z' });
  doc.getElementById('discovery-edit-value').value = 'listen';
  doc.getElementById('discovery-edit-target').value = 'context'; doc.getElementById('discovery-edit-target').dispatch('change');
  assert.equal(doc.getElementById('discovery-edit-value').value, 'listen');
  doc.action('save').dispatch();
  const field = ui.snapshot().fields.find(field => field.id === 'wants.pace');
  assert.equal(field.value, 'listen'); assert.equal(field.baseline.value, 'lead');
});

test('an observed expiry cannot reopen an old selection after the UI wall clock moves backward', () => {
  const expiresAt = '2026-10-06T14:00:00.000Z';
  let state = api.record(api.create('ready'), { kind: 'start-context', at: '2026-10-06T13:00:00.000Z', expiresAt });
  state = api.record(state, { kind: 'select', candidateId: 'candidate-1' });
  let currentTime = '2026-10-06T13:30:00.000Z';
  const ui = mountDiscoveryLab({ root: discoveryDocument(), Domain, Ask, Personalization, initialState: state, now: () => currentTime });
  try {
    currentTime = expiresAt; assert.equal(ui.snapshot().context.closed, true); assert.equal(ui.handoff(), null);
    currentTime = '2026-10-06T13:59:59.000Z';
    assert.equal(ui.snapshot().context.closed, true); assert.equal(ui.handoff(), null);
    ui.restoreState(state); assert.equal(ui.snapshot().context.closed, true); assert.equal(ui.handoff(), null);
  } finally { ui.dispose(); }
});

test('live scenarios can start before the fixed fixture clock and accept a real future deadline', () => {
  const at = '2026-10-06T11:13:00.000Z', expiresAt = '2026-10-06T11:23:00.000Z';
  let state = api.create('ready', { at });
  assert.equal(state.events[0].at, at); assert.ok(Date.parse(state.events.at(-1).at) <= Date.parse(at) + 10);
  state = api.record(state, { kind: 'start-context', at: '2026-10-06T11:13:00.010Z', expiresAt });
  assert.equal(inspect(state).context.expiresAt, expiresAt); assert.equal(inspect(state).status, 'ready');
  assert.equal(api.create('ready').events[0].at, '2026-10-06T12:00:01.000Z', 'existing deterministic fixtures keep their old timestamps');
});

test('live UI uses real time for initial answers and explicit scenario resets, while restored future logs stay ordered', () => {
  const at = '2026-10-06T11:13:00.000Z', expiresAt = '2026-10-06T11:23:00.000Z';
  const doc = discoveryDocument(), ui = mountDiscoveryLab({ root: doc, Domain, Ask, Personalization, now: () => at });
  try {
    doc.action('answer', node => node.dataset.discoveryField === 'consent' && node.dataset.discoveryAnswer === 'true').dispatch();
    assert.ok(Date.parse(ui.exportState().events[0].at) < Date.parse(expiresAt));
    ui.restoreState(api.create('ready'));
    doc.getElementById('discovery-edit-value').value = 'listen'; doc.action('save').dispatch();
    assert.ok(Date.parse(ui.exportState().events.at(-1).at) > Date.parse('2026-10-06T12:00:06.000Z'), 'a restored legacy history cannot be reordered');
    doc.action('scenario', node => node.dataset.discoveryScenario === 'ready').dispatch();
    assert.equal(ui.exportState().events[0].at, at, 'explicitly new scenarios use current time rather than the previous synthetic floor');
    const date = new Date(expiresAt), pad = n => String(n).padStart(2, '0');
    doc.getElementById('discovery-context-expiry').value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    doc.action('start-context').dispatch();
    assert.equal(ui.snapshot().context.expiresAt, expiresAt); assert.equal(ui.snapshot().context.closed, false);
  } finally { ui.dispose(); }
});

test('UI reaches an explicitly scheduled expiry without another click and invalidates the connected candidate', async () => {
  const base = '2026-10-06T13:00:00.000Z', expiresAt = '2026-10-06T13:00:00.050Z';
  let state = api.record(api.create('ready'), { kind: 'start-context', at: base, expiresAt });
  state = api.record(state, { kind: 'select', candidateId: 'candidate-1', at: '2026-10-06T13:00:00.001Z' });
  let now = '2026-10-06T13:00:00.001Z';
  const doc = discoveryDocument(), callbacks = [];
  const ui = mountDiscoveryLab({ root: doc, Domain, Ask, Personalization, initialState: state, now: () => now,
    onSelectionChange: seed => callbacks.push(seed) });
  try {
    assert.equal(callbacks.at(-1).candidateId, 'candidate-1'); now = expiresAt;
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(callbacks.at(-1), null); assert.equal(ui.snapshot().context.endedReason, 'expired');
    assert.equal(doc.getElementById('discovery-candidates').children.length, 0);
    assert.match(doc.getElementById('discovery-summary').textContent, /종료 시점/);
  } finally { ui.dispose(); }
});

test('current-context choices preserve the baseline and return to it only after an explicit revert', () => {
  const original = api.create('ready');
  let state = contextSet(original, 'wants.pace', 'listen');
  assert.equal(inspect(state).topCandidateId, 'candidate-2');
  const field = fieldView(state, 'wants.pace');
  assert.equal(field.baseline.value, 'lead'); assert.equal(field.context.value, 'listen'); assert.equal(field.effective.value, 'listen');
  assert.equal(field.source, 'context'); assert.equal(field.context.provenance.duration, 'once');
  state = api.record(state, { kind: 'revert-context', field: 'wants.pace' });
  assert.equal(inspect(state).topCandidateId, 'candidate-1'); assert.equal(fieldView(state, 'wants.pace').context.state, 'inherit');
  assert.equal(fieldView(original, 'wants.pace').value, 'lead');
});

test('explicit unknown masks the baseline, any is a known value, and cancellation restores the baseline', () => {
  let state = contextSet(api.create('ready'), 'wants.pace', 'listen');
  state = api.record(state, { kind: 'mark-unknown', field: 'wants.pace' });
  const unknown = fieldView(state, 'wants.pace');
  assert.equal(unknown.value, null); assert.equal(unknown.state, 'unknown'); assert.equal(unknown.baseline.value, 'lead');
  assert.equal(unknown.context.state, 'unknown'); assert.equal(unknown.source, 'explicit-unknown'); assert.notEqual(inspect(state).question?.field, 'wants.pace');
  assert.equal(unknown.context.provenance.eventId, state.events.at(-1).id); assert.equal(unknown.context.provenance.duration, 'once');
  state = contextSet(state, 'wants.pace', 'any'); assert.equal(fieldView(state, 'wants.pace').state, 'known');
  assert.equal(fieldView(state, 'wants.pace').value, 'any');
  state = api.record(state, { kind: 'clear', field: 'wants.pace', target: 'context' });
  assert.equal(fieldView(state, 'wants.pace').value, 'lead', 'cancellation never revives the previous once listen');
});

test('deleting a baseline answer preserves this-context unknown and does not repeat the declined optional question', () => {
  let state = api.record(api.create('ready'), { kind: 'mark-unknown', field: 'wants.pace' });
  const declaration = fieldView(state, 'wants.pace').context.provenance;
  state = clear(state, 'wants.pace');
  const field = fieldView(state, 'wants.pace');
  assert.equal(field.baseline.value, null); assert.equal(field.source, 'explicit-unknown');
  assert.deepEqual(field.context.provenance, declaration); assert.notEqual(inspect(state).question?.field, 'wants.pace');
  state = api.record(state, { kind: 'revert-context', field: 'wants.pace' });
  assert.equal(fieldView(state, 'wants.pace').source, 'missing');
  assert.equal(inspect(state).question.field, 'wants.pace', 'explicit cancellation makes the question available again without restoring the deleted baseline');
});

test('temporary soft choices cannot replace or relax an independently confirmed must-have', () => {
  const hard = set(api.create('ready'), 'wants.pace', 'lead', true);
  let state = contextSet(hard, 'wants.pace', 'any');
  assert.equal(row(state, 'candidate-2').status, 'excluded'); assert.equal(fieldView(state, 'wants.pace').requiredValue, 'lead');
  state = contextSet(state, 'wants.pace', 'listen');
  assert.equal(inspect(state).status, 'blocked'); assert.equal(inspect(state).topCandidateId, null);
  assert.deepEqual(inspect(state).context.conflicts, ['wants.pace']); assert.match(inspect(state).summary, /필수조건/);
  assert.throws(() => contextSet(hard, 'wants.pace', 'listen', { required: false }), /cannot change a hard requirement/);
  state = api.record(state, { kind: 'revert-context', field: 'wants.pace' }); assert.equal(inspect(state).topCandidateId, 'candidate-1');
  state = set(state, 'wants.pace', 'listen', false); assert.equal(inspect(state).topCandidateId, 'candidate-2');
});

test('clearing a baseline required answer stays pending even if a current soft answer exists', () => {
  let state = contextSet(set(api.create('ready'), 'wants.pace', 'lead', true), 'wants.pace', 'any');
  state = clear(state, 'wants.pace');
  assert.equal(fieldView(state, 'wants.pace').value, 'any'); assert.equal(fieldView(state, 'wants.pace').required, true);
  assert.equal(fieldView(state, 'wants.pace').requiredValue, null); assert.equal(inspect(state).topCandidateId, null);
  assert.equal(inspect(state).question.field, 'wants.pace'); assert.equal(inspect(state).question.target, 'baseline');
  assert.equal(inspect(state).question.optional, false);
  state = set(state, 'wants.pace', 'lead'); assert.equal(fieldView(state, 'wants.pace').context.state, 'inherit');
  assert.equal(inspect(state).topCandidateId, 'candidate-1');
});

test('explicit unknown on a required choice asks again without replacing the stored must-have', () => {
  let state = set(api.create('ready'), 'wants.pace', 'lead', true);
  state = api.record(state, { kind: 'mark-unknown', field: 'wants.pace' });
  assert.equal(fieldView(state, 'wants.pace').requiredValue, 'lead'); assert.equal(inspect(state).topCandidateId, null);
  assert.equal(inspect(state).question.field, 'wants.pace'); assert.equal(inspect(state).question.optional, false);
  assert.throws(() => api.record(state, { kind: 'skip', field: 'wants.pace' }), /only an unknown optional/);
});

test('baseline edits clear the current override and unknown mask, while deleted baseline values never return', () => {
  let state = contextSet(api.create('ready'), 'wants.pace', 'listen');
  state = set(state, 'wants.pace', 'any'); assert.equal(fieldView(state, 'wants.pace').context.state, 'inherit');
  state = api.record(state, { kind: 'mark-unknown', field: 'wants.pace' }); state = set(state, 'wants.pace', 'lead');
  assert.equal(fieldView(state, 'wants.pace').source, 'baseline');
  state = clear(state, 'wants.pace'); state = contextSet(state, 'wants.pace', 'listen');
  state = api.record(state, { kind: 'start-context' });
  assert.equal(fieldView(state, 'wants.pace').value, null); assert.equal(fieldView(state, 'wants.pace').baseline.value, null);
});

test('ending a discovery hides its candidates and handoff; a new context restores only current baseline declarations', () => {
  let state = choose(contextSet(api.create('ready'), 'wants.pace', 'listen'), 'candidate-2');
  const oldSeed = api.handoff(state), oldId = inspect(state).context.id;
  state = api.record(state, { kind: 'close-context' });
  assert.equal(inspect(state).context.closed, true); assert.equal(inspect(state).context.endedReason, 'closed');
  assert.deepEqual(inspect(state).candidates, []); assert.equal(api.handoff(state), null); assert.equal(inspect(state).question, null);
  assert.equal(fieldView(state, 'wants.pace').value, 'lead');
  assert.throws(() => contextSet(state, 'wants.pace', 'listen'), /context is closed/);
  assert.throws(() => choose(state, 'candidate-1'), /not currently eligible/);
  state = api.record(state, { kind: 'start-context' });
  assert.notEqual(inspect(state).context.id, oldId); assert.equal(inspect(state).topCandidateId, 'candidate-1'); assert.equal(inspect(state).selection, null);
  state = choose(state, 'candidate-2'); assert.notEqual(api.handoff(state).key, oldSeed.key);
});

test('explicit expiry uses caller time without imposing an automatic lifetime and rejects stale preview application', () => {
  const expiry = '2026-10-07T12:00:00.000Z';
  let state = api.record(api.create('ready'), { kind: 'start-context', expiresAt: expiry });
  state = choose(contextSet(state, 'wants.pace', 'listen'), 'candidate-2');
  const draft = api.preview(state, { kind: 'set', field: 'wants.pace', value: 'lead', target: 'context' });
  assert.equal(api.inspect(state, { at: '2026-10-07T11:59:59.999Z' }).context.closed, false);
  const expired = api.inspect(state, { at: expiry });
  assert.equal(expired.context.closed, true); assert.equal(expired.context.endedReason, 'expired'); assert.deepEqual(expired.candidates, []);
  assert.equal(api.handoff(state, { at: expiry }), null); assert.throws(() => api.applyPreview(state, draft, { at: expiry }), /expired/);
  assert.equal(inspect(state).context.closed, false, 'pure projection does not mutate the saved history');
  state = api.record(state, { kind: 'start-context', at: '2026-10-07T12:00:01.000Z' });
  assert.equal(fieldView(state, 'wants.pace').value, 'lead'); assert.equal(inspect(state).context.expiresAt, null);
  assert.equal(api.inspect(state, { at: '2027-10-07T12:00:01.000Z' }).context.closed, false);
});

test('scope-specific previews are pure, preserve hard constraints and become stale after context closure', () => {
  let state = choose(api.create('ready'), 'candidate-1'); const snapshot = structuredClone(state), seed = api.handoff(state);
  const draft = api.preview(state, { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context' });
  assert.equal(draft.after.topCandidateId, 'candidate-2'); assert.deepEqual(state, snapshot); assert.deepEqual(api.handoff(state), seed);
  state = api.applyPreview(state, draft); assert.equal(fieldView(state, 'wants.pace').baseline.value, 'lead'); assert.equal(api.handoff(state), null);
  const next = api.preview(state, { kind: 'mark-unknown', field: 'wants.pace' });
  state = api.record(state, { kind: 'close-context' }); assert.throws(() => api.applyPreview(state, next), /stale/);
});

test('consent and self declarations never become temporary inferred choices; availability remains directly declared', () => {
  const state = api.create('ready');
  for (const target of ['', null, false, 'other']) assert.throws(() => api.record(state, { kind: 'set', field: 'wants.pace', value: 'listen', target }), /invalid preference target/);
  for (const [field, value] of [['consent', true], ['self.pace', 'lead'], ['self.plan', 'planned']])
    assert.throws(() => contextSet(state, field, value), /only wants and explicit availability/);
  let next = contextSet(state, 'availability', 'weekday'); assert.equal(inspect(next).topCandidateId, null);
  next = api.record(next, { kind: 'mark-unknown', field: 'availability' }); assert.equal(inspect(next).question.field, 'availability');
  assert.equal(fieldView(next, 'availability').value, null);
  next = api.record(next, { kind: 'start-context' }); assert.equal(fieldView(next, 'availability').value, 'weekend');
  next = set(next, 'consent', false); next = api.record(next, { kind: 'start-context' }); assert.deepEqual(inspect(next).candidates, []);
});

test('first asks explicit discovery consent before showing any candidates or invented profile', () => {
  const state = api.create(), view = inspect(state);
  assert.equal(DISCOVERY_FIELDS.length, 19); assert.equal(DISCOVERY_FIELDS.filter(field => field.legacy).length, 2); assert.equal(DISCOVERY_SCENARIOS.length, 3);
  assert.equal(view.synthetic, true); assert.equal(view.status, 'needs-confirmation');
  assert.equal(view.question.field, 'consent'); assert.equal(view.question.optional, false);
  assert.deepEqual(view.candidates, []); assert.equal(view.topCandidateId, null); assert.equal(view.selection, null);
  assert.ok(view.fields.every(field => field.state === 'unknown' && field.value === null));
  assert.throws(() => choose(state, 'candidate-1'), /not currently eligible/);
});

test('ready has three eligible candidates, one reciprocal must-have failure and one unknown schedule', () => {
  const state = api.create('ready'), view = inspect(state);
  assert.equal(view.status, 'ready'); assert.equal(view.topCandidateId, 'candidate-1');
  assert.deepEqual(view.candidates.map(candidate => [candidate.id, candidate.status]), [
    ['candidate-1', 'eligible'], ['candidate-2', 'eligible'], ['candidate-3', 'eligible'], ['candidate-5', 'pending'], ['candidate-4', 'excluded'],
  ]);
  assert.ok(view.candidates.every(candidate => !Object.hasOwn(candidate, 'score')));
  assert.ok(view.candidates.every(candidate => Array.isArray(candidate.reciprocal) && Array.isArray(candidate.unknown)));
  assert.match(row(state, 'candidate-5').unknown.join(' '), /일정/);
  assert.match(row(state, 'candidate-4').reciprocal.join(' '), /꼭.*달라요/);
});

test('the candidate the user wants still fails if the candidate requires a different self style', () => {
  let state = api.create('ready');
  const excluded = row(state, 'candidate-4');
  assert.ok(excluded.matched.some(text => text.includes('내가 바라는 대화 방식') && text.includes('맞아요')));
  assert.equal(excluded.status, 'excluded'); assert.throws(() => choose(state, 'candidate-4'), /not currently eligible/);
  state = set(state, 'self.pace', 'lead'); assert.equal(row(state, 'candidate-4').status, 'eligible');
  state = clear(state, 'self.pace'); assert.equal(row(state, 'candidate-4').status, 'pending', 'missing self must not become listen, lead or any');
});

test('situational wants change real candidate order without changing own style or inventing candidate liking', () => {
  let state = api.create('ready'); const ownBefore = inspect(state).fields.filter(field => field.id.startsWith('self.'));
  state = set(state, 'wants.pace', 'listen'); const view = inspect(state);
  assert.equal(view.topCandidateId, 'candidate-2'); assert.deepEqual(view.fields.filter(field => field.id.startsWith('self.')), ownBefore);
  assert.deepEqual({ before: view.change.beforeId, after: view.change.afterId }, { before: 'candidate-1', after: 'candidate-2' });
  assert.match(view.change.reason, /상대에게 바라는 대화 방식.*차분히 듣고 응답/);
  assert.ok(view.candidates.filter(candidate => candidate.status === 'eligible').every(candidate => candidate.reason.includes('호감이나 수락을 뜻하지 않아요')));
});

test('soft mismatch is eligible while explicit wants must-have strictly excludes it', () => {
  let state = api.create('ready'); assert.equal(row(state, 'candidate-2').status, 'eligible');
  assert.ok(row(state, 'candidate-2').differences.some(text => text.includes('대화 방식')));
  state = set(state, 'wants.pace', 'lead', true); assert.equal(row(state, 'candidate-2').status, 'excluded');
  assert.equal(row(state, 'candidate-5').status, 'excluded', 'a definite must-have failure remains excluded even with another unknown');
  state = set(state, 'wants.pace', 'any', true); assert.equal(row(state, 'candidate-2').status, 'eligible');
  assert.equal(row(state, 'candidate-5').status, 'pending', 'explicit any removes only that condition, not missing schedule');
});

test('schedule is mandatory; explicit either schedule works but absent schedule is never filled in', () => {
  let state = clear(api.create('ready'), 'availability');
  assert.equal(inspect(state).status, 'needs-confirmation'); assert.equal(inspect(state).topCandidateId, null);
  assert.equal(inspect(state).question.field, 'availability'); assert.throws(() => choose(state, 'candidate-1'), /not currently eligible/);
  state = set(state, 'availability', 'any'); assert.equal(row(state, 'candidate-1').status, 'eligible');
  assert.equal(row(state, 'candidate-5').status, 'pending');
  state = set(state, 'availability', 'weekday'); assert.equal(row(state, 'candidate-1').status, 'excluded');
  assert.equal(inspect(state).topCandidateId, null);
});

test('boundary with no eligible candidates never substitutes an excluded or unknown person', () => {
  const state = api.create('boundary'), view = inspect(state);
  assert.equal(view.status, 'blocked'); assert.equal(view.topCandidateId, null);
  assert.ok(view.candidates.every(candidate => candidate.status === 'excluded'));
  for (const candidate of view.candidates) assert.throws(() => choose(state, candidate.id), /not currently eligible/);
});

test('consent withdrawal and clearing hide all candidates, change history and selection; restoring needs new selection', () => {
  for (const withdraw of [state => set(state, 'consent', false), state => clear(state, 'consent')]) {
    let state = choose(api.create('ready'), 'candidate-1'); state = withdraw(state); let view = inspect(state);
    assert.deepEqual(view.candidates, []); assert.equal(view.selection, null); assert.equal(view.change, null); assert.equal(view.topCandidateId, null);
    assert.ok(!JSON.stringify(view).includes('candidate-1'));
    assert.throws(() => choose(state, 'candidate-1'), /not currently eligible/);
    state = set(state, 'consent', true); view = inspect(state);
    assert.equal(view.candidates.length, 5); assert.equal(view.selection, null); assert.ok(view.candidates.every(candidate => !candidate.selected));
  }
});

test('select is only a cancelable user choice and does not alter own profile or imply mutual acceptance', () => {
  let state = api.create('ready'), before = inspect(state);
  state = choose(state, 'candidate-2'); const selected = inspect(state);
  assert.deepEqual(selected.fields, before.fields); assert.equal(selected.selection.candidateId, 'candidate-2');
  assert.equal(selected.topCandidateId, 'candidate-1'); assert.equal(selected.candidates.filter(candidate => candidate.selected).length, 1);
  assert.equal(Object.hasOwn(selected.selection, 'mutual'), false);
  state = api.record(state, { kind: 'unselect' }); assert.equal(inspect(state).selection, null); assert.deepEqual(inspect(state).fields, before.fields);
});

test('any explicit set or clear invalidates an old selection, including repeating the same answer', () => {
  for (const change of [state => set(state, 'wants.pace', 'lead'), state => set(state, 'wants.pace', 'listen'), state => clear(state, 'wants.plan')]) {
    let state = choose(api.create('ready'), 'candidate-1'); const revision = inspect(state).selection.revision;
    state = change(state); assert.equal(inspect(state).selection, null);
    state = choose(state, inspect(state).topCandidateId); assert.ok(inspect(state).selection.revision > revision);
  }
});

test('skipping unknown wants preserves the exact ranking and unknown value; known or mandatory fields cannot be skipped', () => {
  let state = clear(clear(api.create('ready'), 'wants.pace'), 'wants.plan'), before = inspect(state);
  state = api.record(state, { kind: 'skip', field: 'wants.pace' });
  const after = inspect(state); assert.deepEqual(after.candidates, before.candidates); assert.equal(after.topCandidateId, before.topCandidateId);
  assert.equal(after.fields.find(field => field.id === 'wants.pace').state, 'unknown'); assert.notEqual(after.question?.field, 'wants.pace');
  assert.throws(() => api.record(state, { kind: 'skip', field: 'availability' }), /unknown optional/);
  assert.throws(() => api.record(state, { kind: 'skip', field: 'self.pace' }), /unknown optional/);
  state = set(state, 'wants.pace', 'lead'); assert.throws(() => api.record(state, { kind: 'skip', field: 'wants.pace' }), /unknown optional/);
});

test('no personal wants and equal policy ranks are explicitly described without a compatibility number', () => {
  let state = set(set(api.create('ready'), 'wants.pace', 'any'), 'wants.plan', 'any');
  assert.match(inspect(state).summary, /가장 맞는다는 뜻은 아니에요/);
  state = set(state, 'wants.pace', 'lead'); const view = inspect(state);
  assert.match(view.summary, /우선순위가 같은 후보/); assert.equal(view.topCandidateId, 'candidate-1');
  assert.equal(view.candidates[1].id, 'candidate-3');
});

test('Domain runs both directions and Ask evaluates the same ordered eligible set through scoped preferences', () => {
  const calls = { domain: [], questions: [], layers: 0, record: 0 };
  const adapter = createDiscoveryAdapter({
    Domain: { ...Domain, decide: input => { calls.domain.push(structuredClone(input)); return Domain.decide(input); } },
    Ask: { ...Ask, choose: input => { calls.questions.push(input); return Ask.choose(input); } },
    Personalization: { preferences: { project: Personalization.preferences.project, layers: input => { calls.layers++; return Personalization.preferences.layers(input); }, record: input => { calls.record++; return Personalization.preferences.record(input); } } },
  });
  let state = adapter.create('ready'); state = adapter.record(state, { kind: 'clear', field: 'wants.pace' });
  const view = adapter.inspect(state), input = calls.questions.at(-1);
  assert.equal(view.question.field, 'wants.pace');
  assert.equal(input.decide({ 'wants.pace': 'lead' }).eligible[0], 'candidate-1');
  assert.equal(input.decide({ 'wants.pace': 'listen' }).eligible[0], 'candidate-2');
  assert.ok(calls.domain.some(input => input.scope.subject === 'discovery-me' && input.candidates[0].id === 'candidate-1'));
  assert.ok(calls.domain.some(input => input.scope.subject === 'candidate-1' && input.candidates[0].id === 'discovery-me'));
  assert.ok(calls.layers > 0 && calls.record > 0);
  assert.ok(!JSON.stringify(calls.domain).includes('hidden-no-consent'), 'nonconsenting candidate does not enter Domain input or hypothetical decisions');
  assert.ok(!JSON.stringify(view).includes('비공개 가상 성인')); assert.ok(!JSON.stringify(view).includes('hidden-no-consent'));
});

test('no consent also prevents all candidate decision calls, not just final visual display', () => {
  const ids = [];
  const adapter = createDiscoveryAdapter({ Domain: { ...Domain, decide: input => { ids.push(input.candidates[0].id); return Domain.decide(input); } }, Ask, Personalization });
  // Rendering the first consent question legitimately tries a hypothetical consent=true.
  // With an explicit no, there is no question and no candidate evaluation at all.
  const state = adapter.record(adapter.create(), { kind: 'set', field: 'consent', value: false }); ids.length = 0;
  const view = adapter.inspect(state); assert.deepEqual(ids, []); assert.equal(view.question, null); assert.deepEqual(view.candidates, []);
});

test('strict finite replay rejects foreign actors, invalid flags, fake fields, unknown candidates and noncanonical times', () => {
  const state = api.create('ready'), before = JSON.stringify(state);
  assert.throws(() => api.record(state, { kind: 'set', person: 'candidate-1', field: 'self.pace', value: 'lead' }), /invalid action/);
  assert.throws(() => set(state, 'diagnosis', 'anything'), /unknown field/);
  assert.throws(() => set(state, 'self.pace', 'any'), /preference value/);
  assert.throws(() => set(state, 'consent', true, false), /requirement flag/);
  assert.throws(() => set(state, 'self.pace', 'listen', true), /requirement flag/);
  assert.throws(() => choose(state, 'hidden-no-consent'), /not currently eligible/);
  assert.throws(() => api.record(state, { kind: 'unselect', field: 'wants.pace' }), /invalid or unordered/);
  assert.throws(() => api.record(state, { kind: 'clear', field: 'wants.pace', at: state.events.at(-1).at.replace('Z', '+00:00') }), /unordered/);
  const raw = structuredClone(state); raw.events[0].at = raw.events[0].at.replace('Z', '+00:00'); assert.throws(() => inspect(raw), /unordered/);
  assert.throws(() => inspect({ ...state, events: Array(501).fill(state.events[0]) }), /invalid state/);
  assert.deepEqual(inspect(state), inspect(state)); assert.equal(JSON.stringify(state), before);
});

test('clearing a required answer preserves the requirement; reanswering cannot silently relax it', () => {
  let state = set(api.create('ready'), 'wants.pace', 'lead', true);
  assert.equal(row(state, 'candidate-2').status, 'excluded');
  state = clear(state, 'wants.pace'); let view = inspect(state);
  const field = view.fields.find(field => field.id === 'wants.pace');
  assert.equal(field.state, 'unknown'); assert.equal(field.required, true);
  assert.equal(view.topCandidateId, null); assert.equal(row(state, 'candidate-2').status, 'pending');
  assert.equal(view.question.field, 'wants.pace'); assert.equal(view.question.optional, false);
  assert.throws(() => api.record(state, { kind: 'skip', field: 'wants.pace' }), /unknown optional/);
  state = set(state, 'wants.pace', 'lead'); view = inspect(state);
  assert.equal(view.fields.find(field => field.id === 'wants.pace').required, true);
  assert.equal(row(state, 'candidate-2').status, 'excluded');
  state = set(state, 'wants.pace', 'lead', false);
  assert.equal(inspect(state).fields.find(field => field.id === 'wants.pace').required, false);
  assert.equal(row(state, 'candidate-2').status, 'eligible');
});

test('reciprocal matches stay in the reciprocal explanation rather than masquerading as my own wants', () => {
  const candidate = row(api.create('ready'), 'candidate-1');
  assert.ok(candidate.reciprocal.some(text => text.includes('상대가 바라는 약속 방식')));
  assert.ok(candidate.matched.every(text => !text.startsWith('상대가')));
});

test('preview shows the actual reordered candidate list without changing state, selection, requirements or handoff', () => {
  const state = choose(api.create('ready'), 'candidate-1'), serialized = JSON.stringify(state), before = inspect(state), seed = api.handoff(state);
  const action = { kind: 'set', field: 'wants.pace', value: 'listen' }, draft = api.preview(state, action);
  assert.equal(draft.before.topCandidateId, 'candidate-1'); assert.equal(draft.after.topCandidateId, 'candidate-2');
  assert.deepEqual(draft.before.eligibleIds, ['candidate-1', 'candidate-2', 'candidate-3']);
  assert.deepEqual(draft.after.eligibleIds, ['candidate-2', 'candidate-1', 'candidate-3']);
  assert.deepEqual(draft.entered, []); assert.deepEqual(draft.left, []);
  assert.equal(draft.selectionWillClear, true); assert.equal(draft.summary, '적용하면 먼저 살펴볼 후보가 달라져요: 가상 성인 1 → 가상 성인 2.');
  assert.equal(JSON.stringify(state), serialized); assert.deepEqual(inspect(state), before); assert.deepEqual(api.handoff(state), seed);
  assert.deepEqual(action, { kind: 'set', field: 'wants.pace', value: 'listen' });
  // Discarding the draft needs no action; the actual source and meeting key stay identical.
  assert.deepEqual(api.handoff(state), seed);
});

test('applying a reviewed preview equals the ordinary explicit action and clears the old selection', () => {
  const state = choose(api.create('ready'), 'candidate-1');
  const draft = api.preview(state, { kind: 'set', field: 'wants.pace', value: 'listen', required: true });
  assert.deepEqual(draft.left.map(row => row.id), ['candidate-1', 'candidate-3']);
  const applied = api.applyPreview(state, draft);
  assert.deepEqual(applied, api.record(state, draft.action));
  assert.equal(inspect(applied).topCandidateId, 'candidate-2'); assert.equal(inspect(applied).selection, null); assert.equal(api.handoff(applied), null);
  assert.throws(() => api.applyPreview(applied, draft), /stale preview/);
  assert.equal(inspect(state).selection.candidateId, 'candidate-1');
});

test('clearing a mandatory answer in a preview preserves the real setting and shows hypothetical holds', () => {
  const state = choose(set(api.create('ready'), 'wants.pace', 'lead', true), 'candidate-1'), before = inspect(state);
  const draft = api.preview(state, { kind: 'clear', field: 'wants.pace' });
  assert.equal(draft.after.status, 'needs-confirmation'); assert.equal(draft.after.topCandidateId, null); assert.deepEqual(draft.after.eligibleIds, []);
  assert.equal(draft.summary, '적용하면 필수 확인이 남아 추천을 보류해요.');
  assert.ok(draft.held.some(row => row.id === 'candidate-2' && row.status === 'pending'));
  assert.deepEqual(inspect(state), before); assert.equal(api.handoff(state).candidateId, 'candidate-1');
  const applied = api.applyPreview(state, draft), field = inspect(applied).fields.find(field => field.id === 'wants.pace');
  assert.equal(field.state, 'unknown'); assert.equal(field.required, true); assert.equal(inspect(applied).topCandidateId, null);
});

test('preview reports newly eligible and still-held people without relaxing the other side requirements', () => {
  const state = set(api.create('ready'), 'wants.pace', 'lead', true);
  const draft = api.preview(state, { kind: 'set', field: 'wants.pace', value: 'lead', required: false });
  assert.deepEqual(draft.entered, [{ id: 'candidate-2', label: '가상 성인 2' }]);
  assert.ok(draft.held.some(row => row.id === 'candidate-4' && row.status === 'excluded'));
  assert.ok(draft.held.some(row => row.id === 'candidate-5' && row.status === 'pending'));
  assert.ok(!JSON.stringify(draft).includes('hidden-no-consent'));
  assert.throws(() => api.preview(state, { kind: 'select', candidateId: 'candidate-2' }), /only supports/);
  assert.throws(() => api.preview(state, { kind: 'set', person: 'candidate-4', field: 'wants.pace', value: 'any' }), /only supports/);
});

test('preview application rejects changed sources, including equal-length alternate states and intervening selection changes', () => {
  const original = api.create('ready'), draft = api.preview(original, { kind: 'set', field: 'wants.pace', value: 'listen' });
  const changed = set(original, 'wants.plan', 'spontaneous'); assert.throws(() => api.applyPreview(changed, draft), /stale preview/);
  const selected = choose(original, 'candidate-1'); assert.throws(() => api.applyPreview(selected, draft), /stale preview/);
  const noSelection = api.record(selected, { kind: 'unselect' }); assert.throws(() => api.applyPreview(noSelection, draft), /stale preview/);
  let left = set(original, 'wants.plan', 'any'), right = set(original, 'wants.plan', 'planned');
  assert.equal(left.events.length, right.events.length);
  assert.throws(() => api.applyPreview(right, api.preview(left, { kind: 'clear', field: 'wants.pace' })), /stale preview/);
});

test('preview application rejects modified actions, candidate changes, extra fields and invented confirmation text', () => {
  const state = choose(api.create('ready'), 'candidate-1'), draft = api.preview(state, { kind: 'set', field: 'wants.pace', value: 'listen' });
  const corruptions = [
    item => { item.action.value = 'lead'; }, item => { item.after.topCandidateId = 'candidate-5'; },
    item => { item.entered = [{ id: 'hidden-no-consent', label: '비공개' }]; }, item => { item.selectionWillClear = false; },
    item => { item.summary = '이미 적용했어요'; }, item => { item.unrecognized = true; }, item => { delete item.held; },
  ];
  for (const corrupt of corruptions) { const item = structuredClone(draft); corrupt(item); assert.throws(() => api.applyPreview(state, item), /preview/); }
  const reordered = Object.fromEntries(Object.entries(draft).reverse());
  assert.deepEqual(api.applyPreview(state, reordered), api.record(state, draft.action), 'JSON property order is not semantic tampering');
});

test('handoff contains only the selected public identity and both explicit schedules, without meeting consent or inferred preferences', () => {
  assert.equal(api.handoff(api.create()), null); assert.equal(api.handoff(api.create('ready')), null); assert.equal(api.handoff(api.create('boundary')), null);
  const state = choose(api.create('ready'), 'candidate-2'), seed = api.handoff(state);
  assert.deepEqual(Object.keys(seed).sort(), ['candidateId', 'key', 'people', 'sourceRevision', 'version']);
  assert.equal(seed.version, 'discovery-meeting-seed-1'); assert.equal(seed.candidateId, 'candidate-2'); assert.equal(seed.sourceRevision, 6);
  assert.match(seed.key, /^[A-Za-z0-9_.-]{1,48}$/);
  assert.deepEqual(seed.people, [{ id: 'person-a', label: '나 · 가상 역할', availability: 'weekend' }, { id: 'person-b', label: '가상 성인 2', availability: 'weekend' }]);
  assert.ok(!JSON.stringify(seed).includes('consent')); assert.ok(!JSON.stringify(seed).includes('pace')); assert.ok(!JSON.stringify(seed).includes('feedback'));
  const flexible = choose(set(api.create('ready'), 'availability', 'any'), 'candidate-1');
  assert.equal(api.handoff(flexible).people[0].availability, 'any', 'explicit flexibility is not silently narrowed to the candidate schedule');
});

test('handoff keys preserve revisits but distinguish reselection, different candidates and equal-count condition changes', () => {
  const ready = api.create('ready'), selected = choose(ready, 'candidate-1'), key = api.handoff(selected).key;
  assert.equal(api.handoff(structuredClone(selected)).key, key);
  assert.notEqual(api.handoff(choose(selected, 'candidate-1')).key, key, 'a new explicit selection is a new source');
  assert.notEqual(api.handoff(choose(ready, 'candidate-2')).key, key);
  const left = choose(set(ready, 'wants.plan', 'any'), 'candidate-1'), right = choose(set(ready, 'wants.plan', 'planned'), 'candidate-1');
  assert.equal(left.events.length, right.events.length); assert.notEqual(api.handoff(left).key, api.handoff(right).key);
  const pending = choose(clear(ready, 'wants.pace'), 'candidate-1');
  const skipped = api.record(pending, { kind: 'skip', field: 'wants.pace' });
  assert.equal(api.handoff(skipped).key, api.handoff(pending).key, 'skipping a question does not change source conditions or selection');
});

test('answers, consent and selection withdrawal immediately remove handoff and old meeting identity cannot revive', () => {
  const state = choose(api.create('ready'), 'candidate-1'), old = api.handoff(state);
  for (const invalid of [set(state, 'wants.pace', 'lead'), clear(state, 'availability'), set(state, 'consent', false), api.record(state, { kind: 'unselect' })]) assert.equal(api.handoff(invalid), null);
  let restored = set(set(state, 'consent', false), 'consent', true); assert.equal(api.handoff(restored), null);
  restored = choose(restored, 'candidate-1'); assert.notEqual(api.handoff(restored).key, old.key);
});

test('hypothetical consent cannot authorize candidate disclosure: consent changes are direct and other previews require current consent', () => {
  const ready = api.create('ready');
  for (const state of [api.create(), set(ready, 'consent', false), clear(ready, 'consent')]) {
    const before = JSON.stringify(state);
    for (const action of [{ kind: 'set', field: 'consent', value: true }, { kind: 'set', field: 'consent', value: false }, { kind: 'clear', field: 'consent' }]) {
      assert.throws(() => api.preview(state, action), /consent changes require direct confirmation/);
    }
    assert.throws(() => api.preview(state, { kind: 'set', field: 'wants.pace', value: 'listen' }), /current consent is required/);
    assert.throws(() => api.preview(state, { kind: 'clear', field: 'availability' }), /current consent is required/);
    assert.equal(JSON.stringify(state), before); assert.deepEqual(inspect(state).candidates, []); assert.equal(api.handoff(state), null);
  }
  for (const action of [{ kind: 'set', field: 'consent', value: false }, { kind: 'clear', field: 'consent' }]) {
    assert.throws(() => api.preview(ready, action), /consent changes require direct confirmation/);
  }
  const revoked = set(ready, 'consent', false), restored = set(revoked, 'consent', true);
  assert.equal(api.preview(restored, { kind: 'set', field: 'wants.pace', value: 'listen' }).after.topCandidateId, 'candidate-2');
  const old = api.preview(ready, { kind: 'set', field: 'wants.pace', value: 'listen' });
  assert.throws(() => api.applyPreview(revoked, old), /stale preview/);
});
