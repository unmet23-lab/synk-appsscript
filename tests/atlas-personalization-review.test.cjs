'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../atlas/engine');
const Ask = require('../atlas/ask');
const Vellum = require('../atlas/vellum-flow');
const Temper = require('../atlas/temper');
const Life = require('../atlas/trail-life');
const scope = { domain: 'LAB', workspace: 'personalization-review', subject: 'synthetic' };
const at = '2026-10-29T00:00:00.000Z';

test('a corrective release preserves the decision wire policy accepted by already-open clients', () => {
  let id = 0;
  const session = Core.createSession({ scope, clock: () => at, id: () => `wire.${++id}` });
  session.plan('reading', [{ id: 'one', minutes: 3, pace: 'standard' }]);
  const record = session.events().find(event => event.type === 'decision.made');
  // The deployed 2.4.0 validator rejects a new policy. A future policy migration
  // needs its own compatibility rollout; this patch changes no schema.
  assert.equal(record.policy, 'atlas-2.4.0');
});

test('confirmation qualifies the observation shown then, including equal-clock append order', () => {
  for (const kind of ['need', 'due', 'trait']) {
    for (const later of [at, '2026-10-30T00:00:00.000Z']) {
      let now = at, serial = 0;
      const session = Core.createSession({ scope, clock: () => now, id: () => `review.${++serial}` });
      session.observe({ kind, key: 'skill.reading', n: 1, strength: 0.4 });
      session.respond(`${kind}:skill.reading`, 'yes');
      assert.equal(session.state().lines[0].status, 'confirmed');
      const candidates = [{ id: 'a.default', minutes: 3, pace: 'standard' },
        { id: 'z.targeted', minutes: 3, pace: 'standard', targets: [`${kind}:skill.reading`] }];
      assert.equal(session.plan('reading', candidates).selected.id, 'z.targeted');
      now = later;
      const latest = session.observe({ kind, key: 'skill.reading', n: 1, strength: 0.8 });
      const line = session.state().lines[0];
      assert.equal(line.status, 'unconfirmed', `${kind}, ${later}`);
      assert.equal(line.usable, false);
      assert.deepEqual(line.evidence, [latest.id]);
      assert.equal(session.plan('reading', candidates).selected.id, 'a.default');
      session.respond(`${kind}:skill.reading`, 'yes');
      assert.equal(session.state().lines[0].status, 'confirmed');
      assert.equal(session.plan('reading', candidates).selected.id, 'z.targeted');
    }
  }
});

test('a response cannot confirm evidence which was not recorded when the person answered', () => {
  const events = [
    { schema: 1, scope, id: 'late-source', type: 'signal.observed', kind: 'need', key: 'reading', n: 1, strength: 0.8,
      at: '2026-10-28T00:00:00.000Z', recordedAt: at },
    { schema: 1, scope, id: 'earlier-answer', type: 'estimate.responded', line: 'need:reading', value: 'yes',
      at: '2026-10-28T01:00:00.000Z', recordedAt: '2026-10-28T01:00:00.000Z' },
  ];
  const line = Core.understand(events, scope, at).lines[0];
  assert.equal(line.status, 'unconfirmed');
  assert.equal(line.usable, false);
  assert.deepEqual(line.evidence, ['late-source']);
});

test('declined trait guesses stay declined while new needs may reopen', () => {
  for (const kind of ['need', 'trait']) {
    let serial = 0;
    const session = Core.createSession({ scope, clock: () => at, id: () => `denied.${++serial}` });
    session.observe({ kind, key: 'reading', n: 1, strength: 0.4 });
    session.respond(`${kind}:reading`, 'no');
    session.observe({ kind, key: 'reading', n: 1, strength: 0.8 });
    assert.equal(session.state().lines[0].status, kind === 'trait' ? 'denied' : 'unconfirmed');
  }
});

test('late evidence cannot gain confirmation by occurrence sorting or a later answer receipt', () => {
  const event = (id, type, happened, recorded, fields) => ({ schema: 1, scope, id, type, at: happened, recordedAt: recorded, ...fields });
  const old = event('old', 'signal.observed', '2026-10-27T00:00:00.000Z', '2026-10-27T00:00:00.000Z', { kind: 'need', key: 'reading', n: 1, strength: 0.4 });
  const response = event('answer', 'estimate.responded', at, at, { line: 'need:reading', value: 'yes' });
  const late = event('late', 'signal.observed', '2026-10-28T00:00:00.000Z', at, { kind: 'need', key: 'reading', n: 1, strength: 0.8 });
  assert.equal(Core.understand([old, response, late], scope, at).lines[0].status, 'unconfirmed');
  const laterReceipt = { ...response, at: '2026-10-28T01:00:00.000Z', recordedAt: '2026-10-30T00:00:00.000Z' };
  assert.equal(Core.understand([old, late, laterReceipt], scope, '2026-10-30T00:00:00.000Z').lines[0].status, 'unconfirmed');
});

test('refresh can revisit a known answer only if another answer changes the decision', () => {
  const question = { id: 'today-audio', kind: 'refresh', about: 'audio', options: [{ id: 'off' }, { id: 'available' }] };
  const input = { questions: [question], answers: { audio: 'available' }, now: at,
    decide: answers => answers.audio === 'off' ? 'reading' : 'listening' };
  assert.equal(Ask.choose(input).status, 'ask');
  assert.equal(Ask.choose({ ...input, denied: [question.id] }).status, 'none');
  assert.equal(Ask.choose({ ...input, asked: { [question.id]: at } }).status, 'none');
  assert.equal(Ask.choose({ ...input, usedToday: 1 }).reason, 'budget');
  assert.equal(Ask.choose({ ...input, decide: () => 'reading' }).status, 'none');
  assert.equal(Ask.choose({ ...input, questions: [{ ...question, kind: 'setting' }] }).status, 'none');
  assert.equal(Ask.choose({ ...input, now: null }).status, 'none');
  assert.throws(() => Ask.choose({ ...input, now: 'invalid' }), /invalid time/);
  assert.deepEqual(input.answers, { audio: 'available' });
});

test('invalid question cooldowns cannot bypass the quiet period', () => {
  for (const quietDays of [-1, NaN, Infinity, '7']) {
    assert.throws(() => Ask.choose({ questions: [], decide: () => null, quietDays }), /quiet|cooldown|invalid/i);
  }
});

test('a personal help threshold always requires a positive integer sample floor', () => {
  for (const minSamples of [0, -1, 1.5, NaN, Infinity, '5']) {
    assert.throws(() => Vellum.stuckFor({ latencies: [], minSamples }), /invalid stuck/);
  }
  assert.equal(Vellum.stuckFor({ latencies: [], minSamples: 1 }).basis, 'default');
  assert.equal(Vellum.stuckFor({ latencies: [3000], minSamples: 1 }).afterMs, 8000);
});

test('group comparisons reject duplicate attempts just like individual measurement', () => {
  const attempt = { eventId: 'one-answer', independent: true, assisted: false, exposure: 'new', verdict: 'correct', arm: 'baseline', conceptIds: ['reading'] };
  const row = { version: 'trail-practice-2', scope, presentations: [], help: [], attempts: [attempt, { ...attempt }] };
  assert.throws(() => Temper.measure(row), /duplicate attempt/);
  assert.throws(() => Temper.groups({ rows: [row], labels: { 'LAB/personalization-review/synthetic': { cohort: 'synthetic' } },
    arms: ['baseline', 'adapted'], minimum: 1 }), /duplicate attempt/);
  assert.throws(() => Temper.groups({ rows: [row], labels: {}, arms: ['baseline', 'adapted'], minimum: 1 }), /duplicate attempt/);
});

test('long NPC source chains preserve permission and propagate revocation', () => {
  const events = [], depth = 256;
  const add = body => events.push({ schema: 1, scope, seq: events.length + 1, ...body });
  for (let i = 0; i < depth; i++) add({ id: `fact.${i}`, type: 'life.fact', factType: 'helped',
    causes: i ? [`fact.${i - 1}`] : [], revisions: {}, knownBy: i === depth - 1 ? ['npc'] : [] });
  for (let i = depth - 2; i >= 0; i--) add({ id: `grant.${i}`, type: 'life.knowledge', factId: `fact.${i}`,
    npcId: 'npc', allowed: true, viaId: `fact.${i + 1}` });
  assert.equal(Life.summarize(events, { scope }).knowledge.npc.length, depth);
  add({ id: 'withdraw', type: 'life.knowledge', factId: `fact.${depth - 1}`, npcId: 'npc', allowed: false, viaId: null });
  assert.deepEqual(Life.summarize(events, { scope }).knowledge.npc, []);
});
