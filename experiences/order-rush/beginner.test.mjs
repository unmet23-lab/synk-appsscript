import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { STAGES, VOICE_LINES, stageOrders, makeOrder, judge, observation, summary, metadata, newProgress, readProgress, validateVoiceManifest } from './beginner-core.mjs';

test('a zero-Korean learner meets two nouns before requests and quantities; every request has exact audio', () => {
  assert.deepEqual(STAGES[0].items, ['water', 'bread']);
  assert.deepEqual(STAGES[0].demos, ['water', 'bread']);
  for (let seed = 1; seed < 30; seed++) for (let s = 0; s < STAGES.length; s++) {
    const orders = stageOrders(s, seed); assert.equal(orders.length, STAGES[s].rounds);
    for (const o of orders) {
      assert.ok(STAGES[s].items.includes(o.item)); assert.ok(VOICE_LINES.some(v => v.id === o.voice && v.text === o.text));
      assert.equal(judge(o, Array(o.count).fill(o.item)).correct, true);
      assert.equal(judge(o, Array(o.count).fill(o.item === 'bread' ? 'apple' : 'bread')).correct, false);
    }
  }
  assert.ok(stageOrders(0).every(o => ['물', '빵'].includes(o.text)));
  assert.equal(stageOrders(2).filter(o => o.count === 3).length, 2);
  assert.equal(STAGES.reduce((sum, s) => sum + s.rounds, 0), 27);
});
test('serving requires both the requested item and quantity, not simply tray length', () => {
  const o = makeOrder('bread', 2, 'count');
  assert.equal(judge(o, ['bread', 'apple']).correct, false);
  assert.equal(judge(o, ['bread']).correct, false);
  assert.equal(judge(o, []).empty, true);
  assert.equal(judge(o, ['bread', 'bread']).correct, true);
  assert.throws(() => makeOrder('water', 2, 'count'));
});
test('demo, replay, help, resumed and corrected attempts never become independent listening wins', () => {
  const order = makeOrder('water'), base = { heard: true, firstCorrect: true, attempts: 1, stage: 0 };
  assert.equal(observation(order, base).independent, true);
  for (const delta of [{ heard: false }, { demo: true }, { help: true }, { replay: true }, { resumed: true }, { firstCorrect: false, attempts: 2 }]) assert.equal(observation(order, { ...base, ...delta }).independent, false);
  const stats = summary([observation(order, base), observation(order, { ...base, demo: true }), observation(order, { ...base, firstCorrect: false, attempts: 2 })]);
  assert.deepEqual(stats, { total: 2, firstCorrect: 1, independent: 1, helped: 0, retried: 1 });
});
test('resume preserves the first wrong submission and cannot unlock later chapters out of order', () => {
  const p = newProgress(3); p.checkpoint = { stage: 0, phase: 'order', index: 3, touched: true, attempts: 1, firstCorrect: false, helped: true };
  const restored = readProgress(JSON.parse(JSON.stringify(p)));
  assert.equal(restored.checkpoint.firstCorrect, false); assert.equal(restored.checkpoint.attempts, 1); assert.equal(restored.checkpoint.helped, true);
  assert.deepEqual(readProgress({ ...p, completed: [3] }).completed, []);
  assert.equal(readProgress({ ...p, completed: [0, 1, 2, 3] }).finished, true);
  assert.equal(readProgress({ ...p, checkpoint: { stage: 0, phase: 'order', index: 6 } }).checkpoint, null);
});

test('resume restores a partial tray and picture help, ignoring invalid or excess saved items', () => {
  const p = { ...newProgress(44), completed: [0, 1], checkpoint: { stage: 2, phase: 'order', index: 1, touched: true, hint: true, tray: ['bread', 'apple', 'water', '<bad>', 'bread', 'apple'] } };
  const r = readProgress(p); assert.deepEqual(r.checkpoint.tray, ['bread', 'apple', 'bread']); assert.equal(r.checkpoint.hint, true);
  assert.deepEqual(readProgress({ ...p, checkpoint: { ...p.checkpoint, tray: null } }).checkpoint.tray, []);
});
test('voices must be approved Typecast, complete and exact; no fallback engine is accepted', async () => {
  const manifest = JSON.parse(await readFile(new URL('assets/beginner/voices.json', import.meta.url)));
  const approved = { ...manifest, approved: true };
  assert.equal(validateVoiceManifest(approved), true);
  assert.throws(() => validateVoiceManifest({ ...approved, approved: false }));
  assert.throws(() => validateVoiceManifest({ ...approved, provider: 'os-tts' }));
  assert.throws(() => validateVoiceManifest({ ...approved, clips: { ...approved.clips, water: { text: '빵', file: 'audio/water.mp3' } } }));
  assert.throws(() => validateVoiceManifest({ ...approved, clips: { ...approved.clips, water: { text: '물', file: '../../escape.mp3' } } }));
});
test('Atlas keeps action answers separate from drink composition and word meaning separate from request details', () => {
  assert.equal(metadata(makeOrder('water')).responseFormat, 'action');
  assert.equal(metadata(makeOrder('water')).skillId, 'ko.listening.word');
  assert.equal(metadata(makeOrder('bread', 2, 'count')).skillId, 'ko.listening.detail');
  assert.equal(metadata(makeOrder('bread', 2, 'count')).difficulty, 2);
});

test('actual Atlas accepts beginner action observations without creating cup-composition evidence', () => {
  const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
  const memory = new Map(), coach = createGame({ gameId: 'order-rush', map: createMap(require('../../strata/maps/topik-i.json')), storage: { getItem: k => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) } });
  const p = coach.present(metadata(makeOrder('water'))); coach.delivery(p, { audio: 'completed' });
  assert.equal(coach.answer(p, { correct: true, assessable: true }).independent, true);
  const q = coach.present(metadata(makeOrder('bread', 2, 'count'))); coach.delivery(q, { audio: 'completed' }); coach.help(q, 'hint');
  assert.equal(coach.answer(q, { correct: true, assessable: true }).independent, false);
  const word = coach.summary().skills.find(s => s.id === 'ko.listening.word'); assert.equal(word.formats.action.n, 1); assert.equal(word.formats['cup-compose'].n, 0);
});
