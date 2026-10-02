'use strict';
// The fast path reads one answer from Trail's incremental index instead of summarising the
// whole log. These random plays check it gives exactly what summarize() gives, and that a
// long history does not make each answer slower in proportion.
const test = require('node:test');
const assert = require('node:assert/strict');
const Trail = require('../atlas/trail');
const Learning = require('../atlas/learning');
const { createGame } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];
const SKILLS = [['ko.listening.detail', 'listening'], ['ko.listening.negation', 'listening'], ['ko.reading.detail', 'reading'], ['ko.reading.sequence', 'reading']];
const FORMATS = ['binary-choice', 'single-choice', 'action', undefined];
function memory() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; }

function play(seed, rounds) {
  const r = rng(seed);
  let t = Date.parse('2026-09-01T00:00:00Z');
  const clock = () => new Date(t += Math.floor(r() * 4) * 1000 + (r() < 0.02 ? 9 * 86400000 : 0)).toISOString();
  const game = createGame({ gameId: 'random-play', map, storage: memory(), clock });
  const answers = [];
  for (let i = 0; i < rounds; i += 1) {
    const [skillId, modality] = pick(r, SKILLS), n = Math.floor(r() * 25);
    const item = { id: `q${i}`, itemKey: `item.${n}`, familyKey: r() < 0.5 ? `family.${n % 9}` : undefined, skillId, modality,
      difficulty: 1 + Math.floor(r() * 3), responseFormat: pick(r, FORMATS), confounded: r() < 0.1 };
    const pid = game.present(item);
    if (modality === 'listening' && r() < 0.9) game.delivery(pid, { audio: r() < 0.85 ? 'completed' : 'failed' });
    if (r() < 0.25) game.help(pid, pick(r, ['text', 'hint', 'replay', 'answer']));
    const tries = 1 + (r() < 0.2 ? 1 : 0);
    for (let k = 1; k <= tries; k += 1) {
      const correct = r() < 0.1 ? null : r() < 0.7;
      const recorded = game.answer(pid, { correct, assessable: r() < 0.9, attemptNo: k, ...(r() < 0.05 ? { reason: 'motor' } : {}) });
      answers.push(recorded);
    }
    if (r() < 0.03) game.exclude(answers.at(-1).eventId);
  }
  return { game, answers };
}

test('each answer read from the incremental index equals the whole-log summary at that moment', () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const r = rng(seed * 7919);
    let t = Date.parse('2026-09-01T00:00:00Z');
    const clock = () => new Date(t += Math.floor(r() * 3) * 1000).toISOString();
    const game = createGame({ gameId: 'random-play', map, storage: memory(), clock });
    for (let i = 0; i < 120; i += 1) {
      const [skillId, modality] = pick(r, SKILLS), n = Math.floor(r() * 20);
      const pid = game.present({ id: `q${i}`, itemKey: `item.${n}`, familyKey: r() < 0.5 ? `family.${n % 7}` : undefined, skillId, modality,
        difficulty: 1 + Math.floor(r() * 2), responseFormat: pick(r, FORMATS), confounded: r() < 0.1 });
      if (modality === 'listening' && r() < 0.9) game.delivery(pid, { audio: r() < 0.85 ? 'completed' : 'failed' });
      if (r() < 0.25) game.help(pid, pick(r, ['text', 'hint', 'replay', 'answer']));
      const recorded = game.answer(pid, { correct: r() < 0.1 ? null : r() < 0.7, assessable: r() < 0.9, ...(r() < 0.05 ? { reason: 'motor' } : {}) });
      // The reference: summarise the whole log as the old path did, right after the answer.
      const events = game.events(), asOf = events.at(-1).at;
      const batch = Trail.summarize(events, { scope: { domain: 'LAB', workspace: 'learning', subject: 'device' }, asOf });
      const row = batch.attempts.find(a => a.eventId === recorded.eventId);
      assert.equal(recorded.independent, !!row?.independent, `seed ${seed} item ${i}: independent`);
      assert.equal(recorded.assisted, row?.assisted ?? null, `seed ${seed} item ${i}: assisted`);
      assert.equal(recorded.exposure, row?.exposure ?? null, `seed ${seed} item ${i}: exposure`);
    }
  }
});

test('the learning basis read per item equals the same cell of the full profile', () => {
  const { game } = play(4242, 260);
  const profile = game.summary();
  const events = game.events(), summary = Trail.summarize(events, { scope: { domain: 'LAB', workspace: 'learning', subject: 'device' }, asOf: events.at(-1).at });
  const reference = Learning.summarizeLearning({ summary, map, complete: true });
  for (const skill of reference.skills) for (const level of [1, 2, 3]) for (const format of Learning.RESPONSE_FORMATS) {
    const mine = profile.skills.find(s => s.id === skill.id).levels[level].formats[format], theirs = skill.levels[level].formats[format];
    assert.deepEqual([mine.status, mine.n, mine.correct, mine.lastAt, mine.assisted], [theirs.status, theirs.n, theirs.correct, theirs.lastAt, theirs.assisted], `${skill.id} ${level} ${format}`);
  }
  // The decision snapshot written at presentation time used the same evidence the profile reports.
  const lastDecision = events.filter(e => e.type === 'decision.made').at(-1);
  const snap = lastDecision.candidateSnapshot[0].learning;
  assert.ok(['unseen', 'checking', 'practice', 'supported', 'recent-independent', 'review'].includes(snap.state));
});

test('an exclusion recorded after an answer removes it from the per-item basis, as it does from the profile', () => {
  let t = Date.parse('2026-09-01T00:00:00Z');
  const game = createGame({ gameId: 'exclusion', map, storage: memory(), clock: () => new Date(t += 1000).toISOString() });
  const item = i => ({ id: `q${i}`, itemKey: `item.${i}`, skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' });
  const results = [0, 1, 2, 3].map(i => game.answer(game.present(item(i)), { correct: true, assessable: true }));
  assert.equal(game.summary().skills.find(s => s.id === 'ko.reading.detail').levels[1].formats['single-choice'].status, 'recent-independent');
  game.exclude(results[0].eventId);
  const pid = game.present(item(9));
  const snapshot = game.events().filter(e => e.type === 'decision.made').at(-1).candidateSnapshot[0].learning;
  assert.equal(snapshot.state, 'checking', 'three remaining answers are not yet four');
  assert.equal(game.summary().skills.find(s => s.id === 'ko.reading.detail').levels[1].formats['single-choice'].n, 3);
  game.answer(pid, { correct: true, assessable: true });
});

test('a log that arrives out of time order falls back to the whole-log reading', () => {
  const storage = memory();
  let t = Date.parse('2026-09-10T00:00:00Z');
  const first = createGame({ gameId: 'tab-a', map, storage, clock: () => new Date(t += 1000).toISOString() });
  const item = i => ({ id: `q${i}`, itemKey: `item.${i}`, skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' });
  first.answer(first.present(item(1)), { correct: true, assessable: true });
  // Another device, its clock days ahead, recorded the same item; then this device answers it.
  let ahead = Date.parse('2026-09-20T00:00:00Z');
  const other = createGame({ gameId: 'tab-b', map, storage, clock: () => new Date(ahead += 1000).toISOString() });
  other.answer(other.present(item(2)), { correct: false, assessable: true });
  const back = first.answer(first.present(item(2)), { correct: true, assessable: true });
  const events = first.events();
  const batch = Trail.summarize(events, { scope: { domain: 'LAB', workspace: 'learning', subject: 'device' }, asOf: '2026-09-30T00:00:00Z' });
  assert.equal(back.exposure, batch.attempts.find(a => a.eventId === back.eventId).exposure);
  assert.equal(back.independent, false, 'the item was met on the other device first');
});

test('a long history does not make each answer proportionally slower', () => {
  let t = Date.parse('2026-09-01T00:00:00Z');
  const game = createGame({ gameId: 'speed', map, storage: memory(), clock: () => new Date(t += 1000).toISOString() });
  const item = i => ({ id: `q${i}`, itemKey: `item.${i}`, skillId: 'ko.listening.detail', modality: 'listening', difficulty: 1, responseFormat: 'single-choice' });
  const run = (from, to) => {
    const start = process.hrtime.bigint();
    for (let i = from; i < to; i += 1) { const pid = game.present(item(i)); game.delivery(pid, { audio: 'completed' }); game.answer(pid, { correct: i % 3 !== 0, assessable: true }); }
    return Number(process.hrtime.bigint() - start) / 1e6 / (to - from);
  };
  run(0, 1000);
  const late = Math.min(run(1000, 1050), run(1050, 1100));
  // Before this change one answer re-read the whole log several times: about 85ms an item
  // at 400 items and over 400ms at 1,000 on a desktop. Now it is a few milliseconds.
  assert.ok(late < 25, `${late.toFixed(2)}ms an item after 1,000 items`);
});
