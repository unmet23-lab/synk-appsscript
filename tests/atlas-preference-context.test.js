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
