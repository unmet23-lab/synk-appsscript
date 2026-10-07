'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Personalization = require('../atlas/personalization');
const P = Personalization.preferences;
const contract = { id: 'meeting.preference', version: '1', purpose: 'first-meeting', fields: [
  { id: 'atmosphere', kind: 'enum', values: ['quiet', 'lively'] },
  { id: 'minutes', kind: 'number', range: [20, 120] },
  { id: 'outside', kind: 'boolean' },
], criteria: [] };
const scope = { personId: 'person-a', productId: 'matching', contextId: 'first-meeting', domain: 'SYNK' };
const encounterId = 'meeting-1';
const time = n => new Date(Date.UTC(2026, 9, 6, 0, 0, n)).toISOString();
const input = (events = [], options = {}) => ({ contract, scope, events, encounterId, at: time(20), ...options });
const add = (events, id, kind, extra = {}) => P.record(input(events, { id, kind, ...extra }));
const view = (events, extra = {}) => P.project(input(events, extra));
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); for (const part of Object.values(value)) freeze(part); } return value; };

test('explicit deadlines expire at equality while preserving detached current source metadata', () => {
  const events = freeze(add([], 'deadline', 'set', { at: time(1), field: 'minutes', value: 40, duration: 'ongoing', until: time(10) }));
  const justBefore = new Date(Date.parse(time(10)) - 1).toISOString();
  assert.equal(view(events, { at: justBefore }).values.minutes, 40);
  assert.equal(view(events, { at: justBefore }).provenance.minutes.until, time(10));
  const expired = view(events, { at: time(10) });
  assert.deepEqual(expired.values, {}); assert.deepEqual(expired.provenance, {});
  assert.deepEqual(expired.expired, [{ field: 'minutes', value: 40, eventId: 'deadline', source: 'explicit', duration: 'ongoing', encounterId, at: time(1), until: time(10) }]);
  assert.equal(P.layers(input(events, { at: time(10) })).baseline.expired[0].eventId, 'deadline');
  expired.expired[0].value = 120; assert.equal(view(events).expired[0].value, 40);
  assert.deepEqual(view(events), view(events), 'projection does not append a virtual expiry event or refresh its clock');
  assert.equal(events.length, 1);
});

test('expired newest ongoing values never resurrect an older declaration in the same scope', () => {
  let events = add([], 'old', 'set', { at: time(1), field: 'minutes', value: 90, duration: 'ongoing' });
  events = add(events, 'newer', 'set', { at: time(2), field: 'minutes', value: 40, duration: 'ongoing', until: time(10) });
  assert.deepEqual(view(events).values, {}); assert.deepEqual(view(events).expired.map(row => row.eventId), ['newer']);
  assert.deepEqual(view(events, { encounterId: 'meeting-2' }).values, {});
  events = add(events, 'fresh', 'set', { at: time(20), field: 'minutes', value: 60, duration: 'ongoing' });
  assert.deepEqual(view(events).values, { minutes: 60 }); assert.equal('expired' in view(events), false);
});

test('an expired once choice returns to the current live baseline, never an older once choice', () => {
  let events = add([], 'baseline', 'set', { at: time(1), field: 'minutes', value: 90, duration: 'ongoing', until: time(30) });
  events = add(events, 'old-once', 'set', { at: time(2), field: 'minutes', value: 60, duration: 'once' });
  events = add(events, 'latest-once', 'set', { at: time(3), field: 'minutes', value: 40, duration: 'once', until: time(10) });
  let layers = P.layers(input(events));
  assert.deepEqual(layers.context.values, {}); assert.equal(layers.context.expired[0].eventId, 'latest-once');
  assert.deepEqual(layers.effective.values, { minutes: 90 }); assert.equal(layers.effective.provenance.minutes.eventId, 'baseline');
  assert.equal(layers.effective.expired[0].eventId, 'latest-once');
  layers = P.layers(input(events, { at: time(30) }));
  assert.deepEqual(layers.effective.values, {}); assert.deepEqual(layers.effective.expired.map(row => row.eventId), ['baseline', 'latest-once']);
  assert.equal('expired' in P.layers(input(events, { encounterId: 'meeting-2' })).context, false);
});

test('baseline expiry stays visible independently even when a live once value could satisfy a soft preference', () => {
  let events = add([], 'hard-baseline', 'set', { at: time(1), field: 'atmosphere', value: 'quiet', duration: 'ongoing', until: time(10) });
  events = add(events, 'soft-context', 'set', { at: time(2), field: 'atmosphere', value: 'lively', duration: 'once', until: time(30) });
  const layers = P.layers(input(events));
  assert.deepEqual(layers.baseline.values, {}); assert.equal(layers.baseline.expired[0].eventId, 'hard-baseline');
  assert.equal(layers.effective.values.atmosphere, 'lively');
  assert.equal(layers.effective.expired[0].eventId, 'hard-baseline');
  // Whether this baseline is a must-have is a product contract. It must inspect
  // baseline availability rather than use the soft effective choice as proof.
});

test('withdrawal, reset and close remove current expired records as well as live values without history revival', () => {
  let events = add([], 'original', 'set', { at: time(1), field: 'minutes', value: 90, duration: 'ongoing' });
  events = add(events, 'deadline', 'set', { at: time(2), field: 'minutes', value: 40, duration: 'ongoing', until: time(10) });
  for (const [id, kind, extra] of [['withdraw', 'withdraw', { field: 'minutes', duration: 'ongoing' }], ['reset', 'reset', {}]]) {
    const forgotten = add(events, id, kind, extra); assert.deepEqual(view(forgotten).values, {}); assert.equal('expired' in view(forgotten), false);
  }
  const once = add(events, 'once', 'set', { at: time(3), field: 'outside', value: false, duration: 'once', until: time(10) });
  const closed = add(once, 'close', 'close'); const layers = P.layers(input(closed));
  assert.equal(layers.context.closed, true); assert.equal('expired' in layers.context, false);
  assert.deepEqual(layers.effective.expired.map(row => row.eventId), ['deadline']);
});

test('ongoing corrections discard the current once declaration even if the correction later expires', () => {
  let events = add([], 'once', 'set', { at: time(1), field: 'minutes', value: 90, duration: 'once' });
  events = add(events, 'new-baseline', 'set', { at: time(2), field: 'minutes', value: 40, duration: 'ongoing', until: time(10) });
  const layers = P.layers(input(events)); assert.deepEqual(layers.effective.values, {}); assert.deepEqual(layers.context.values, {});
  assert.deepEqual(layers.effective.expired.map(row => row.eventId), ['new-baseline']);
});

test('feedback application accepts an explicit deadline but keeps proposal, feedback and confirmation distinct', () => {
  let events = add([], 'idea', 'propose', { at: time(1), field: 'minutes', value: 40, feedbackId: 'real-feedback' });
  assert.equal(view(events).values.minutes, undefined); assert.equal(view(events).pendingProposals.length, 1);
  events = add(events, 'confirmed', 'apply', { at: time(2), proposalId: 'idea', duration: 'once', until: time(10) });
  assert.equal(view(events, { at: time(9) }).provenance.minutes.source, 'feedback-confirmed');
  assert.equal(view(events).expired[0].proposalId, 'idea'); assert.equal(view(events).expired[0].feedbackId, 'real-feedback');
  assert.throws(() => add(events, 'again', 'apply', { proposalId: 'idea', duration: 'ongoing', until: time(30) }), /not pending/);
});

test('invalid deadlines, stale applications and until on non-application actions are rejected without consuming proposals', () => {
  const proposed = add([], 'idea', 'propose', { at: time(1), field: 'minutes', value: 40, feedbackId: 'feedback-1' });
  for (const until of [time(1), time(0), null, 10, 'bad', '2026-10-06T00:00:30+00:00']) {
    assert.throws(() => add([], 'bad', 'set', { at: time(1), field: 'minutes', value: 40, duration: 'once', until }), /deadline|ISO UTC/);
  }
  for (const until of [time(19), time(20)]) assert.throws(() => add(proposed, 'late-apply', 'apply', { proposalId: 'idea', duration: 'once', until }), /deadline/);
  assert.equal(view(proposed).pendingProposals.length, 1);
  for (const [kind, extra] of [['propose', { field: 'minutes', value: 40, feedbackId: 'feedback-2' }], ['withdraw', { field: 'minutes', duration: 'once' }], ['close', {}], ['reset', {}], ['dismiss', { proposalId: 'idea' }]]) {
    assert.throws(() => add(proposed, `bad-${kind}`, kind, { ...extra, until: time(30) }), /unsupported/);
  }
  const corrected = add(proposed, 'correction', 'set', { field: 'minutes', value: 90, duration: 'once', until: time(30) });
  assert.throws(() => add(corrected, 'stale', 'apply', { proposalId: 'idea', duration: 'once', until: time(30) }), /not pending/);
});

test('deadline changes are substantive event content and saved projections remain chronological and detached', () => {
  const events = add([], 'same', 'set', { at: time(1), field: 'outside', value: false, duration: 'once', until: time(10) });
  assert.equal(add(events, 'same', 'set', { at: time(1), field: 'outside', value: false, duration: 'once', until: time(10) }).length, 1);
  assert.throws(() => add(events, 'same', 'set', { at: time(1), field: 'outside', value: false, duration: 'once', until: time(11) }), /conflicting/);
  assert.deepEqual(view(JSON.parse(JSON.stringify(events))), view(events));
  assert.throws(() => view([{ ...events[0], until: time(1) }]), /deadline/);
  const legacy = add([], 'legacy', 'set', { field: 'outside', value: false, duration: 'ongoing' });
  assert.deepEqual(Object.keys(view(legacy)).sort(), ['closed', 'pendingProposals', 'provenance', 'values', 'version']);
  assert.equal('until' in view(legacy).provenance.outside, false);
});

test('layers exposes independent baseline and current provenance while project retains its exact contract', () => {
  let events = add([], 'usual-layer', 'set', { field: 'minutes', value: 90, duration: 'ongoing' });
  events = add(events, 'temporary-layer', 'set', { field: 'minutes', value: 40, duration: 'once' });
  const layers = P.layers(input(events));
  assert.equal(layers.version, 'core-preference-layers-1');
  assert.deepEqual(layers.baseline.values, { minutes: 90 }); assert.deepEqual(layers.context.values, { minutes: 40 });
  assert.equal(layers.baseline.provenance.minutes.eventId, 'usual-layer');
  assert.equal(layers.context.provenance.minutes.eventId, 'temporary-layer');
  assert.deepEqual(layers.effective, view(events));
  assert.deepEqual(Object.keys(view(events)).sort(), ['closed', 'pendingProposals', 'provenance', 'values', 'version']);
  layers.baseline.values.minutes = 20; assert.equal(P.layers(input(events)).baseline.values.minutes, 90);
});

test('layers observes withdrawal and closure without exposing old overrides or another encounter', () => {
  let events = add([], 'usual-layer', 'set', { field: 'minutes', value: 90, duration: 'ongoing' });
  events = add(events, 'temporary-layer', 'set', { field: 'minutes', value: 40, duration: 'once' });
  assert.deepEqual(P.layers(input(events, { encounterId: 'meeting-2' })).context.values, {});
  events = add(events, 'close-layer', 'close');
  let layers = P.layers(input(events)); assert.equal(layers.context.closed, true);
  assert.deepEqual(layers.context.values, {}); assert.deepEqual(layers.effective.values, { minutes: 90 });
  events = add(events, 'withdraw-layer', 'withdraw', { field: 'minutes', duration: 'ongoing' });
  layers = P.layers(input(events)); assert.deepEqual(layers.baseline.values, {}); assert.deepEqual(layers.effective.values, {});
  assert.throws(() => P.layers(input(events, { scope: { ...scope, personId: 'other-person' } })), /scope/);
});

test('one-encounter override restores the ongoing declaration in a new encounter', () => {
  let events = add([], 'usual', 'set', { field: 'atmosphere', value: 'quiet', duration: 'ongoing' });
  events = add(events, 'today', 'set', { field: 'atmosphere', value: 'lively', duration: 'once' });
  assert.deepEqual(view(events).values, { atmosphere: 'lively' });
  assert.deepEqual(view(events, { encounterId: 'meeting-2' }).values, { atmosphere: 'quiet' });
  assert.equal(view(events).provenance.atmosphere.duration, 'once');
  assert.equal(view(events, { encounterId: 'meeting-2' }).provenance.atmosphere.eventId, 'usual');
});

test('closing an encounter expires the override and proposals without erasing ongoing settings', () => {
  let events = add([], 'usual', 'set', { field: 'atmosphere', value: 'quiet', duration: 'ongoing' });
  events = add(events, 'today', 'set', { field: 'atmosphere', value: 'lively', duration: 'once' });
  events = add(events, 'idea', 'propose', { field: 'minutes', value: 40, feedbackId: 'feedback-1' });
  events = add(events, 'end', 'close');
  assert.deepEqual(view(events).values, { atmosphere: 'quiet' });
  assert.equal(view(events).closed, true);
  assert.deepEqual(view(events).pendingProposals, []);
  assert.throws(() => add(events, 'reopen', 'set', { field: 'minutes', value: 40, duration: 'once' }), /closed/);
  const reset = add(events, 'forget', 'reset');
  assert.equal(view(reset).closed, true);
  assert.deepEqual(view(reset).values, {});
});

test('withdrawal never revives an older once or ongoing value', () => {
  let events = add([], 'usual-1', 'set', { field: 'minutes', value: 90, duration: 'ongoing' });
  events = add(events, 'usual-2', 'set', { field: 'minutes', value: 60, duration: 'ongoing' });
  events = add(events, 'once-1', 'set', { field: 'minutes', value: 40, duration: 'once' });
  events = add(events, 'once-2', 'set', { field: 'minutes', value: 30, duration: 'once' });
  events = add(events, 'withdraw-once', 'withdraw', { field: 'minutes', duration: 'once' });
  assert.deepEqual(view(events).values, { minutes: 60 });
  events = add(events, 'withdraw-usual', 'withdraw', { field: 'minutes', duration: 'ongoing' });
  assert.deepEqual(view(events).values, {});
  assert.deepEqual(view(events, { encounterId: 'meeting-2' }).values, {});
});

test('an explicit ongoing correction takes effect immediately over the current override', () => {
  let events = add([], 'once', 'set', { field: 'minutes', value: 30, duration: 'once' });
  events = add(events, 'correct', 'set', { field: 'minutes', value: 60, duration: 'ongoing' });
  assert.deepEqual(view(events).values, { minutes: 60 });
  events = add(events, 'forget', 'withdraw', { field: 'minutes', duration: 'ongoing' });
  assert.deepEqual(view(events).values, {});
});

test('feedback proposals do not affect recommendations until a separate explicit application', () => {
  let events = add([], 'usual', 'set', { field: 'minutes', value: 90, duration: 'ongoing' });
  events = add(events, 'proposal', 'propose', { field: 'minutes', value: 40, feedbackId: 'feedback-self-1' });
  assert.deepEqual(view(events).values, { minutes: 90 });
  assert.equal(view(events).pendingProposals.length, 1);
  events = add(events, 'confirm', 'apply', { proposalId: 'proposal', duration: 'once' });
  assert.deepEqual(view(events).values, { minutes: 40 });
  assert.deepEqual(view(events, { encounterId: 'meeting-2' }).values, { minutes: 90 });
  assert.deepEqual(view(events).provenance.minutes, { eventId: 'confirm', source: 'feedback-confirmed', duration: 'once',
    encounterId, at: time(20), proposalId: 'proposal', feedbackId: 'feedback-self-1' });
  assert.deepEqual(view(events).pendingProposals, []);
  assert.throws(() => add(events, 'reapply', 'apply', { proposalId: 'proposal', duration: 'ongoing' }), /not pending/);
});

test('confirmed feedback can be scoped to the next encounter without changing other encounters', () => {
  let events = add([], 'first-end', 'close');
  events = add(events, 'next-proposal', 'propose', { encounterId: 'meeting-2', field: 'outside', value: false, feedbackId: 'first-feedback' });
  assert.deepEqual(view(events).pendingProposals, []);
  assert.throws(() => add(events, 'wrong-encounter', 'apply', { proposalId: 'next-proposal', duration: 'once' }), /closed/);
  events = add(events, 'next-confirm', 'apply', { encounterId: 'meeting-2', proposalId: 'next-proposal', duration: 'once' });
  assert.deepEqual(view(events, { encounterId: 'meeting-2' }).values, { outside: false });
  assert.deepEqual(view(events, { encounterId: 'meeting-3' }).values, {});
});

test('new declarations, withdrawals, resets and rejection prevent stale proposals from overwriting a correction', () => {
  const proposal = add([], 'proposal', 'propose', { field: 'minutes', value: 40, feedbackId: 'feedback-1' });
  const changes = [
    ['set', { field: 'minutes', value: 90, duration: 'ongoing' }],
    ['withdraw', { field: 'minutes', duration: 'ongoing' }], ['reset', {}], ['dismiss', { proposalId: 'proposal' }],
  ];
  for (const [kind, extra] of changes) {
    const events = add(proposal, `change-${kind}`, kind, extra);
    assert.deepEqual(view(events).pendingProposals, []);
    assert.throws(() => add(events, 'late', 'apply', { proposalId: 'proposal', duration: 'ongoing' }), /not pending/, kind);
  }
  const unrelated = add(proposal, 'other-field', 'set', { field: 'outside', value: true, duration: 'once' });
  assert.equal(view(unrelated).pendingProposals.length, 1);
});

test('reset clears ongoing and every encounter override, including inactive contexts', () => {
  let events = add([], 'usual', 'set', { field: 'minutes', value: 90, duration: 'ongoing' });
  events = add(events, 'once-1', 'set', { field: 'minutes', value: 40, duration: 'once' });
  events = add(events, 'once-2', 'set', { encounterId: 'meeting-2', field: 'minutes', value: 30, duration: 'once' });
  events = add(events, 'reset', 'reset');
  for (const context of ['meeting-1', 'meeting-2', 'meeting-3']) assert.deepEqual(view(events, { encounterId: context }).values, {});
});

test('person, product, purpose, stable context, domain and contract version never cross scopes', () => {
  const events = add([], 'usual', 'set', { field: 'minutes', value: 90, duration: 'ongoing' });
  for (const [key, value] of Object.entries({ personId: 'person-b', productId: 'shopping', contextId: 'work', domain: 'SHIFT' })) {
    assert.throws(() => view(events, { scope: { ...scope, [key]: value } }), /foreign/, key);
  }
  for (const [key, value] of Object.entries({ id: 'other', version: '2', purpose: 'other-purpose' })) {
    assert.throws(() => view(events, { contract: { ...contract, [key]: value } }), /foreign/, key);
  }
  const proposal = add([], 'proposal', 'propose', { field: 'minutes', value: 40, feedbackId: 'feedback-1' });
  assert.throws(() => add(proposal, 'foreign-context', 'apply', { encounterId: 'meeting-2', proposalId: 'proposal', duration: 'ongoing' }), /not pending/);
});

test('unapproved values, traits, sources and event properties are rejected', () => {
  const invalid = [ { field: 'minutes', value: '40' }, { field: 'minutes', value: Infinity }, { field: 'minutes', value: 121 },
    { field: 'outside', value: 0 }, { field: 'atmosphere', value: 'introvert' }, { field: 'personality', value: 'introvert' },
    { field: 'minutes', value: null }, { field: '__proto__', value: 'quiet' } ];
  for (const extra of invalid) assert.throws(() => add([], 'bad', 'set', { ...extra, duration: 'ongoing' }));
  assert.throws(() => add([], 'bad', 'set', { field: 'minutes', value: 40, duration: 'ongoing', source: 'inferred' }), /unsupported/);
  assert.throws(() => add([], 'bad', 'set', { field: 'minutes', value: 40, duration: 'forever' }), /duration/);
  const valid = add([], 'valid', 'set', { field: 'minutes', value: 40, duration: 'ongoing' });
  for (const source of ['inferred', 'observed', 'feedback-confirmed']) assert.throws(() => view([{ ...valid[0], source }]), /source/);
  assert.throws(() => view([{ ...valid[0], secret: 'value' }]), /event/);
  assert.throws(() => add([], '__proto__', 'set', { field: 'minutes', value: 40, duration: 'once' }), /event/);
  assert.equal({}.polluted, undefined);
});

test('PULSE allows direct settings and withdrawal while rejecting feedback proposals and applications', () => {
  const pulse = { ...scope, domain: 'PULSE' };
  let events = add([], 'chosen', 'set', { scope: pulse, field: 'minutes', value: 40, duration: 'ongoing' });
  assert.deepEqual(view(events, { scope: pulse }).values, { minutes: 40 });
  assert.throws(() => add(events, 'suggestion', 'propose', { scope: pulse, field: 'minutes', value: 90, feedbackId: 'opinion-1' }), /PULSE/);
  assert.throws(() => add(events, 'apply', 'apply', { scope: pulse, proposalId: 'suggestion', duration: 'ongoing' }), /PULSE/);
  events = add(events, 'forget', 'withdraw', { scope: pulse, field: 'minutes', duration: 'ongoing' });
  assert.deepEqual(view(events, { scope: pulse }).values, {});
  events = add(events, 'once', 'set', { scope: pulse, field: 'outside', value: false, duration: 'once' });
  events = add(events, 'end', 'close', { scope: pulse });
  assert.deepEqual(view(events, { scope: pulse }).values, {});
  events = add(events, 'clear', 'reset', { scope: pulse });
  assert.deepEqual(view(events, { scope: pulse }).values, {});
});

test('PULSE projection cannot replay forged or imported personal feedback events', () => {
  const pulse = { ...scope, domain: 'PULSE' };
  let events = add([], 'suggestion', 'propose', { field: 'minutes', value: 40, feedbackId: 'opinion-1' });
  events = add(events, 'confirmed', 'apply', { proposalId: 'suggestion', duration: 'ongoing' });
  const relabeled = events.map(event => ({ ...event, scope: pulse }));
  assert.throws(() => view(relabeled, { scope: pulse }), /PULSE/);
  assert.throws(() => view([relabeled[1]], { scope: pulse }), /PULSE/);
});

test('event replay has exact deduplication, conflicting-ID rejection and strict chronology', () => {
  const first = add([], 'same', 'set', { at: time(1), field: 'minutes', value: 40, duration: 'once' });
  const retry = add(first, 'same', 'set', { at: time(1), field: 'minutes', value: 40, duration: 'once' });
  assert.equal(retry.length, 1);
  assert.deepEqual(view([...first, ...first]).values, { minutes: 40 });
  assert.throws(() => view([first[0], { ...first[0], value: 60 }]), /conflicting/);
  assert.throws(() => add(first, 'older', 'set', { at: time(0), field: 'minutes', value: 60, duration: 'once' }), /future/);
  assert.throws(() => view([{ ...first[0], at: time(21) }]), /future/);
  const newer = add(first, 'later', 'set', { at: time(2), field: 'minutes', value: 60, duration: 'once' });
  assert.throws(() => view([...newer].reverse()), /time reversal/);
  assert.throws(() => view(first, { at: '2026-10-06' }), /ISO UTC/);
  assert.deepEqual(view(newer).values, { minutes: 60 });
});

test('the pure API neither mutates nor aliases frozen source events and declarations', () => {
  const original = freeze(input([], { id: 'set', kind: 'set', field: 'minutes', value: 40, duration: 'ongoing' }));
  const before = JSON.stringify(original), events = P.record(original);
  assert.equal(JSON.stringify(original), before);
  freeze(events);
  const projected = view(events);
  projected.values.minutes = 120;
  projected.provenance.minutes.source = 'inferred';
  assert.deepEqual(view(events).values, { minutes: 40 });
  assert.equal(view(events).provenance.minutes.source, 'explicit');
});

test('the existing UMD exposes the optional capability without changing learning profile APIs', () => {
  const context = vm.createContext({});
  for (const file of ['engine.js', 'domain.js', 'personalization.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../atlas', file), 'utf8'), context);
  const result = vm.runInContext(`(() => {
    const P = SynkAtlasPersonalization;
    const args = ${JSON.stringify(input([], { id: 'choice', kind: 'set', field: 'minutes', value: 40, duration: 'once' }))};
    const events = P.preferences.record(args);
    return { value: P.preferences.project({...args, events}).values.minutes, version: P.PREFERENCE_VERSION, oldAPI: typeof P.createProfile };
  })()`, context);
  assert.equal(result.value, 40);
  assert.equal(result.version, Personalization.PREFERENCE_VERSION);
  assert.equal(result.oldAPI, 'function');
});
