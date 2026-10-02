'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Trail = require('../atlas/trail-life');
const Vellum = require('../atlas/vellum-life');
const scope = { domain: 'LAB', workspace: 'synk-town', subject: 'preview-local' };
const clone = value => JSON.parse(JSON.stringify(value));

// A deterministic fixture; IDs and sequence come from the game, never a clock.
function fixture(localScope = scope) {
  let log = [];
  const make = (type, fields, overrides = {}) => ({ schema: 1, id: `event.${log.length + 1}`, scope: clone(localScope),
    seq: log.length + 1, type, ...fields, ...overrides });
  const add = (type, fields, options, overrides) => {
    const event = make(type, fields, overrides); log = Trail.append(log, event, options); return event;
  };
  return { make, add, events: () => clone(log),
    fact: (fields = {}) => add('life.fact', { factType: 'object.placed', causes: [], revisions: { object: 1 }, knownBy: ['resident.one'], ...fields }),
    summary: (complete = true) => Trail.summarize(log, { scope: localScope, complete }) };
}
const candidate = (source, fields = {}) => ({ id: 'first', semanticKey: 'first-use', sourceIds: [source.id],
  requiredRevisions: { object: 1 }, conditions: { usable: true }, priority: 10, once: true,
  contentRef: 'content.first', actionRef: 'action.use', ...fields });
const receipt = (source, fields = {}) => ({ reactionId: 'first', deliveryId: 'delivery.1', npcId: 'resident.one',
  semanticKey: 'first-use', sourceIds: [source.id], revisions: { object: 1 }, contentVersion: 'content.1', mode: 'static', ...fields });
const select = (f, candidates, options = {}) => Vellum.select({ scope, trail: f.summary(), npcId: 'resident.one',
  currentRevisions: { object: 1 }, conditions: { usable: true }, candidates, ...options });

test('confirmed action remains pending after interruption; only a real host ack suppresses first thanks', () => {
  const f = fixture(), placed = f.fact(), used = f.fact({ factType: 'object.used', causes: [placed.id] });
  const first = candidate(used), daily = candidate(used, { id: 'daily', priority: 1, once: false, contentRef: 'content.daily' });
  const plan = select(f, [daily, first]);
  assert.equal(plan.selected.id, 'first');
  assert.equal(f.summary().deliveries.length, 0, 'planning does not deliver a reaction');
  const restored = Trail.summarize(JSON.parse(JSON.stringify(f.events())), { scope });
  assert.equal(select(f, [first, daily], { trail: restored }).selected.id, 'first');
  f.add('life.delivered', receipt(used), { currentRevisions: { object: 1 } });
  const revisit = select(f, [first, daily]);
  assert.equal(revisit.selected.id, 'daily');
  assert.deepEqual(revisit.rejected, [{ id: 'first', reason: 'already-delivered' }]);
  assert.equal(f.summary().learningEffectClaim, false);
});

test('exact event retries ignore JSON key order, conflicting IDs and regressive sequence are rejected', () => {
  const f = fixture(), fact = f.fact();
  const reordered = Object.fromEntries(Object.entries(fact).reverse());
  assert.deepEqual(Trail.append(f.events(), reordered), f.events());
  assert.throws(() => Trail.append(f.events(), { ...fact, factType: 'other' }), /conflicting event id/);
  assert.throws(() => Trail.append(f.events(), { ...fact, id: 'new', seq: 1 }), /sequence/);
  const later = { ...fact, id: 'later', seq: 10 };
  assert.equal(Trail.append(f.events(), later).length, 2, 'a projection may omit unrelated world events');
});

test('facts require prior valid causes; later correction invalidates dependant facts, not delivery history', () => {
  const f = fixture(), created = f.fact(), used = f.fact({ factType: 'object.used', causes: [created.id] });
  f.add('life.delivered', receipt(used), { currentRevisions: { object: 1 } });
  f.add('life.corrected', { targetId: created.id });
  assert.deepEqual(f.summary().facts, []);
  assert.deepEqual(f.summary().invalidated, [created.id, used.id]);
  assert.equal(f.summary().deliveries.length, 1);
  assert.equal(select(f, [candidate(used)]).rejected[0].reason, 'source-missing');
  assert.throws(() => f.fact({ causes: [created.id] }), /prior valid causes/);
  assert.throws(() => fixture().fact({ causes: ['future'] }), /prior valid causes/);
});

test('an unwitnessed NPC cannot use a fact; a witnessed handover permits only that fact', () => {
  const f = fixture(), original = f.fact();
  const unknown = select(f, [candidate(original)], { npcId: 'resident.two' });
  assert.equal(unknown.selected, null); assert.equal(unknown.rejected[0].reason, 'unknown-npc');
  assert.throws(() => f.add('life.knowledge', { factId: original.id, npcId: 'resident.two', allowed: true, viaId: original.id }), /witnessed source/);
  const message = f.fact({ factType: 'message.delivered', causes: [original.id], knownBy: ['resident.two'] });
  f.add('life.knowledge', { factId: original.id, npcId: 'resident.two', allowed: true, viaId: message.id });
  assert.equal(select(f, [candidate(original)], { npcId: 'resident.two' }).status, 'ready');
  assert.equal(select(f, [candidate(original)], { npcId: 'resident.three' }).status, 'unavailable');
  const unrelated = f.fact({ factType: 'weather.observed', knownBy: ['resident.three'] });
  assert.throws(() => f.add('life.knowledge', { factId: original.id, npcId: 'resident.three', allowed: true, viaId: unrelated.id }), /witnessed source/);
});

test('withdrawal blocks pending reactions and cannot be bypassed through a knowledge-source summary', () => {
  const f = fixture(), original = f.fact();
  const message = f.fact({ factType: 'message.delivered', causes: [original.id], knownBy: ['resident.two'] });
  f.add('life.knowledge', { factId: original.id, npcId: 'resident.two', allowed: true, viaId: message.id });
  f.add('life.knowledge', { factId: message.id, npcId: 'resident.two', allowed: false, viaId: null });
  assert.equal(select(f, [candidate(original)], { npcId: 'resident.two' }).rejected[0].reason, 'npc-unaware');
  assert.equal(f.summary().facts.length, 2, 'privacy withdrawal is not destruction of world facts');
  f.add('life.knowledge', { factId: original.id, npcId: 'resident.one', allowed: false, viaId: null });
  assert.equal(select(f, [candidate(original)]).rejected[0].reason, 'npc-unaware');
  assert.throws(() => f.add('life.delivered', receipt(original), { currentRevisions: { object: 1 } }), /permitted facts/);
});

test('correcting the communication source removes derived NPC knowledge without deleting the original fact', () => {
  const f = fixture(), original = f.fact();
  const message = f.fact({ factType: 'message.delivered', causes: [original.id], knownBy: ['resident.two'] });
  f.add('life.knowledge', { factId: original.id, npcId: 'resident.two', allowed: true, viaId: message.id });
  f.add('life.corrected', { targetId: message.id });
  assert.deepEqual(f.summary().facts.map(fact => fact.id), [original.id]);
  assert.equal(select(f, [candidate(original)], { npcId: 'resident.two' }).rejected[0].reason, 'npc-unaware');
});

test('stale plans and stale render acks are rejected; old achievement remains historical', () => {
  const f = fixture(), fact = f.fact();
  assert.equal(select(f, [candidate(fact)], { currentRevisions: { object: 2 } }).rejected[0].reason, 'revision-mismatch');
  assert.throws(() => f.add('life.delivered', receipt(fact), { currentRevisions: { object: 2 } }), /revision mismatch/);
  assert.throws(() => f.add('life.delivered', receipt(fact)), /revision mismatch/);
  assert.equal(f.summary().facts.length, 1); assert.equal(f.summary().deliveries.length, 0);
});

test('a lost ack retries its delivery ID once, even after the world changes; conflicting receipts fail', () => {
  const f = fixture(), fact = f.fact(), ack = f.add('life.delivered', receipt(fact), { currentRevisions: { object: 1 } });
  assert.deepEqual(Trail.append(f.events(), ack, { currentRevisions: { object: 2 } }), f.events());
  assert.deepEqual(Trail.append(f.events(), { ...ack, id: 'retry', seq: 10 }, { currentRevisions: { object: 2 } }), f.events());
  assert.throws(() => Trail.append(f.events(), { ...ack, id: 'retry', seq: 10, mode: 'motion' }, { currentRevisions: { object: 1 } }), /conflicting delivery id/);
  assert.equal(f.summary().deliveries.length, 1);
});

test('first-thanks semantics survive new wording, while another NPC and repeatable daily use remain eligible', () => {
  const f = fixture(), fact = f.fact({ knownBy: ['resident.one', 'resident.two'] });
  f.add('life.delivered', receipt(fact), { currentRevisions: { object: 1 } });
  const revised = candidate(fact, { id: 'first.v2', contentRef: 'content.v2' });
  assert.equal(select(f, [revised]).rejected[0].reason, 'already-delivered');
  assert.equal(select(f, [revised], { npcId: 'resident.two' }).status, 'ready');
  assert.equal(select(f, [candidate(fact, { once: false })]).status, 'ready');
  const separateGoal = f.fact({ factType: 'another.completed' });
  assert.equal(select(f, [candidate(separateGoal)]).status, 'ready', 'same wording for a distinct real goal is still eligible');
});

test('scope changes and incomplete restore fail closed instead of making a first encounter', () => {
  const f = fixture(), fact = f.fact(), otherScope = { ...scope, subject: 'another-account' };
  assert.throws(() => Trail.summarize(f.events(), { scope: otherScope }), /scope mismatch/);
  assert.throws(() => Trail.append(f.events(), { ...fact, id: 'foreign', seq: 2, scope: otherScope }), /scope mismatch/);
  assert.equal(select(f, [candidate(fact)], { scope: otherScope }).rejected[0].reason, 'scope-mismatch');
  const unknown = f.summary(false);
  assert.deepEqual(unknown.facts, []); assert.deepEqual(unknown.knowledge, {});
  assert.equal(select(f, [candidate(fact)], { trail: unknown }).rejected[0].reason, 'projection-unavailable');
});

test('Boolean conditions fail closed when missing, including a required false condition', () => {
  const f = fixture(), fact = f.fact(), option = candidate(fact, { conditions: { occupied: false } });
  assert.equal(select(f, [option], { conditions: {} }).rejected[0].reason, 'condition-unmet');
  assert.equal(select(f, [option], { conditions: { occupied: true } }).rejected[0].reason, 'condition-unmet');
  assert.equal(select(f, [option], { conditions: { occupied: false } }).status, 'ready');
});

test('selection is deterministic, preserves authored references and does not mutate facts or candidates', () => {
  const f = fixture(), fact = f.fact(), b = candidate(fact, { id: 'b' }), a = candidate(fact, { id: 'a' });
  const before = f.events(), input = [b, a], result = select(f, input);
  assert.equal(result.selected.id, 'a'); assert.equal(result.selected.actionRef, 'action.use');
  assert.equal(result.selected.contentRef, 'content.first');
  result.selected.requiredRevisions.object = 99; result.eligible[0].contentRef = 'changed';
  assert.equal(a.requiredRevisions.object, 1); assert.equal(a.contentRef, 'content.first');
  assert.deepEqual(f.events(), before); assert.deepEqual(input, [b, a]);
  const summary = f.summary(); summary.facts[0].knownBy.push('injected');
  assert.equal(f.summary().knowledge.injected, undefined);
});

test('life contracts reject raw dialogue and practice events instead of expanding the learning payload', () => {
  const f = fixture(), fact = f.fact();
  assert.throws(() => Trail.validate({ ...fact, dialogue: 'private free text' }), /fields/);
  assert.throws(() => Trail.validate({ ...fact, type: 'practice.presented' }), /fields/);
  assert.throws(() => Vellum.validateCandidate(candidate(fact, { prompt: 'unreviewed instruction' })), /candidate/);
  assert.throws(() => Vellum.validateCandidate(candidate(fact, { sourceIds: [] })), /candidate/);
});

test('the same contracts support a second cup-delivery example without shelter-specific branches', () => {
  const f = fixture(), given = f.fact({ factType: 'cup.delivered', revisions: { cup: 4 }, knownBy: ['recipient'] });
  const option = candidate(given, { id: 'cup.reply', semanticKey: 'cup.first', requiredRevisions: { cup: 4 },
    conditions: { cupHeld: true }, contentRef: 'cup.received', actionRef: 'cup.drink' });
  const settings = { npcId: 'recipient', currentRevisions: { cup: 4 }, conditions: { cupHeld: true } };
  assert.equal(select(f, [option], settings).selected.actionRef, 'cup.drink');
  f.add('life.delivered', receipt(given, { reactionId: 'cup.reply', deliveryId: 'cup.delivery', npcId: 'recipient',
    semanticKey: 'cup.first', revisions: { cup: 4 }, contentVersion: 'cup.1', mode: 'motion' }), { currentRevisions: { cup: 4 } });
  assert.equal(select(f, [option], settings).rejected[0].reason, 'already-delivered');
});

test('UMD browser globals and CommonJS produce the same plan without model or host services', () => {
  const context = vm.createContext({});
  for (const name of ['vellum-life.js', 'trail-life.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../atlas', name), 'utf8'), context);
  const f = fixture(), fact = f.fact(), input = { scope, trail: f.summary(), npcId: 'resident.one',
    currentRevisions: { object: 1 }, conditions: { usable: true }, candidates: [candidate(fact)] };
  assert.deepEqual(clone(context.SynkVellumLife.select(input)), Vellum.select(input));
  assert.deepEqual(clone(context.SynkTrailLife.summarize(f.events(), { scope })), f.summary());
  assert.deepEqual(Object.keys(context).sort(), ['SynkTrailLife', 'SynkVellumLife']);
});
