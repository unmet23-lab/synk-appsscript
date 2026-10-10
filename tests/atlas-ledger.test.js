'use strict';
// Folding older items into a ledger keeps a long history small. These plays fold often (every
// few dozen entries) and compare everything a game reads with a game that never folds.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, KEY } = require('../atlas/game-learning');
const Ledger = require('../atlas/learning-ledger');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const map = createMap(topikMap());
const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];
const SKILLS = [['ko.listening.word', 'listening'], ['ko.listening.detail', 'listening'], ['ko.reading.detail', 'reading'], ['ko.reading.grammar', 'reading']];
const FORMATS = ['binary-choice', 'single-choice', 'action'];
const FOLD = { max: 90, keep: 60, ageMs: 0 };

// One script of plays, applied to every game given: the same items, times and answers.
function script(seed, items) {
  const r = rng(seed), steps = [];
  let t = Date.parse('2026-08-01T00:00:00Z');
  for (let i = 0; i < items; i += 1) {
    t += 1000 + Math.floor(r() * 3000) + (r() < 0.03 ? 9 * 86400000 : 0);
    const [skillId, modality] = pick(r, SKILLS), n = Math.floor(r() * 30);
    const item = { id: `q${i}`, itemKey: `item.${n}`, familyKey: r() < 0.6 ? `family.${n % 11}` : undefined, skillId, modality,
      difficulty: 1 + Math.floor(r() * 2), responseFormat: pick(r, FORMATS), confounded: r() < 0.05,
      conceptIds: skillId === 'ko.listening.word' ? [`ko.word.w${String(1 + (n % 9)).padStart(4, '0')}`] : r() < 0.3 ? ['G209'] : [] };
    steps.push({ t, item, audio: modality === 'listening' ? (r() < 0.9 ? 'completed' : 'failed') : null,
      help: r() < 0.25 ? pick(r, ['text', 'hint', 'replay', 'answer']) : null,
      answers: Array.from({ length: r() < 0.2 ? 2 : 1 }, () => ({ correct: r() < 0.1 ? null : r() < 0.7, assessable: r() < 0.92, reason: r() < 0.04 ? 'motor' : undefined })),
      exclude: r() < 0.02 });
  }
  return steps;
}
function player(options) {
  let now = Date.parse('2026-08-01T00:00:00Z');
  const storage = options.storage || memory();
  const game = createGame({ gameId: 'ledger-play', map, storage, clock: () => new Date(now).toISOString(), ...options.game });
  return { game, storage, set: t => { now = t; } };
}
function play(p, step) {
  p.set(step.t);
  const pid = p.game.present(step.item);
  if (step.audio) { p.set(step.t + 300); p.game.delivery(pid, { audio: step.audio }); }
  if (step.help) { p.set(step.t + 400); p.game.help(pid, step.help); }
  const results = step.answers.map((a, k) => { p.set(step.t + 500 + k * 200); return p.game.answer(pid, { ...a, attemptNo: k + 1 }); });
  if (step.exclude) { p.set(step.t + 900); p.game.exclude(results.at(-1).eventId); }
  return results.map(r => [r.independent, r.assisted, r.exposure]);
}
const cells = s => s.skills.flatMap(skill => [1, 2, 3].flatMap(level => Object.values(skill.levels[level].formats).map(f =>
  [skill.id, level, f.responseFormat, f.status, f.n, f.correct, f.lastAt, f.assisted, f.unassessed, f.evidence.length])));
const content = s => s.concepts.map(c => [c.id, c.status, ...Object.values(c.formats).map(f => [f.responseFormat, f.status, f.n, f.correct, f.lastAt, f.assisted, f.unassessed])]);
const counts = c => [c.presented, c.attempts, c.independent.evaluated, c.independent.correct, c.assisted, c.unknownAssistance, c.repeat,
  c.unknownExposure, c.unassessed, c.skipped, c.excludedAttempts, JSON.stringify(Object.entries(c.byConcept).sort())];
const CANDIDATES = [
  { id: 'c-word', itemKey: 'item.3', skillIds: ['ko.listening.word'], modality: 'listening', difficulty: 1, responseFormat: 'single-choice', conceptIds: ['ko.word.w0004'] },
  { id: 'c-detail', itemKey: 'item.4', familyKey: 'family.4', skillIds: ['ko.listening.detail'], modality: 'listening', difficulty: 1, responseFormat: 'binary-choice' },
  { id: 'c-read', itemKey: 'item.5', skillIds: ['ko.reading.detail'], modality: 'reading', difficulty: 2, responseFormat: 'action' },
  { id: 'c-grammar', itemKey: 'q7', skillIds: ['ko.reading.grammar'], modality: 'reading', difficulty: 1, responseFormat: 'single-choice', conceptIds: ['G209'] },
  { id: 'c-pack', skillIds: ['ko.reading.detail'], modality: 'reading', difficulty: 1, responseFormat: 'single-choice', familyKeys: ['family.1', 'family.2'] },
];
const reading = g => { const s = g.summary(); return { cells: cells(s), content: content(s), counts: counts(s.counts),
  pick: g.recommend(CANDIDATES).selected?.id, picks: g.recommend(CANDIDATES.slice(1)).alternatives.map(c => c.id) }; };

test('a folding game answers, profiles, counts and recommends exactly like one that keeps everything', () => {
  for (const seed of [11, 22, 33, 44]) {
    const steps = script(seed, 260), folding = player({ game: { fold: FOLD } }), full = player({ game: { fold: false } });
    steps.forEach((step, i) => {
      assert.deepEqual(play(folding, step), play(full, step), `seed ${seed} item ${i}: answer provenance`);
      if (i % 20 === 19) assert.deepEqual(reading(folding.game), reading(full.game), `seed ${seed} after ${i + 1} items`);
    });
    const stored = JSON.parse(folding.storage.getItem(`${KEY}.device`));
    assert.ok(stored.ledger && stored.ledger.folded > 0, 'the folding game actually folded');
    assert.ok(stored.events.length <= FOLD.max + 20, `kept entries stay bounded: ${stored.events.length}`);
    assert.ok(JSON.parse(full.storage.getItem(`${KEY}.device`)).events.length > 5 * stored.events.length);
  }
});

test('a reopened game reads the folded history exactly as the game that wrote it', () => {
  const steps = script(7, 200), p = player({ game: { fold: FOLD } });
  steps.forEach(step => play(p, step));
  let now = steps.at(-1).t + 2000;
  const again = createGame({ gameId: 'ledger-play', map, storage: p.storage, clock: () => new Date(now).toISOString(), fold: FOLD });
  p.set(now);
  assert.deepEqual(reading(again), reading(p.game));
});

test('two tabs folding the same history stay consistent with a single tab that keeps everything', () => {
  const steps = script(99, 240), shared = memory();
  const one = player({ storage: shared, game: { fold: FOLD } }), two = player({ storage: shared, game: { fold: FOLD } }), full = player({ game: { fold: false } });
  steps.forEach((step, i) => {
    const tab = i % 3 === 2 ? two : one;
    assert.deepEqual(play(tab, step), play(full, step), `item ${i}: answer provenance across tabs`);
  });
  const t = steps.at(-1).t + 2000; one.set(t); two.set(t); full.set(t);
  assert.deepEqual(reading(one.game), reading(full.game));
  assert.deepEqual(reading(two.game), reading(full.game));
});

test('a folded answer can no longer be excluded; a reset clears the ledger', () => {
  const steps = script(5, 160), p = player({ game: { fold: FOLD } });
  const first = play(p, steps[0]);
  const firstAttempt = p.game.events().find(e => e.type === 'practice.attempted').id;
  steps.slice(1).forEach(step => play(p, step));
  assert.ok(first.length);
  assert.throws(() => p.game.exclude(firstAttempt), /exclusion target/);
  p.game.reset();
  assert.equal(JSON.parse(p.storage.getItem(`${KEY}.device`)).ledger, undefined);
});

test('a tampered ledger leaves the history unreadable and untouched', () => {
  const steps = script(3, 150), p = player({ game: { fold: FOLD } });
  steps.forEach(step => play(p, step));
  const stored = JSON.parse(p.storage.getItem(`${KEY}.device`));
  stored.ledger.keys['item.1'] = 99;
  const tampered = JSON.stringify(stored); p.storage.setItem(`${KEY}.device`, tampered);
  const again = createGame({ gameId: 'ledger-play', map, storage: p.storage, fold: FOLD });
  assert.equal(again.summary().storage.available, false);
  assert.equal(p.storage.getItem(`${KEY}.device`), tampered, 'an unreadable history is preserved, never replaced');
});

test('a long history stays small and quick: 5,000 items with the default fold', () => {
  const r = rng(1), p = player({ game: { fold: { ageMs: 0 } } });
  let t = Date.parse('2026-08-01T00:00:00Z');
  const start = process.hrtime.bigint();
  for (let i = 0; i < 5000; i += 1) {
    t += 2000; p.set(t);
    const [skillId, modality] = SKILLS[i % 4], n = i % 2000;
    const pid = p.game.present({ id: `q${i}`, itemKey: `item.${n}`, skillId, modality, difficulty: 1, responseFormat: 'single-choice',
      conceptIds: skillId === 'ko.listening.word' ? [`ko.word.w${String(1 + n).padStart(4, '0')}`] : [] });
    if (modality === 'listening') p.game.delivery(pid, { audio: 'completed' });
    p.game.answer(pid, { correct: r() < 0.75, assessable: true });
  }
  const seconds = Number(process.hrtime.bigint() - start) / 1e9;
  const raw = p.storage.getItem(`${KEY}.device`), stored = JSON.parse(raw);
  assert.ok(stored.events.length <= 2000, `kept entries ${stored.events.length}`);
  assert.ok(raw.length < 2.5e6, `stored size ${(raw.length / 1e6).toFixed(2)}M characters`);
  assert.equal(p.game.summary().counts.attempts, 5000, 'every answer is still counted');
  assert.ok(seconds < 120, `5,000 items took ${seconds.toFixed(1)}s`);
  assert.ok(Ledger.validate(stored.ledger));
});
