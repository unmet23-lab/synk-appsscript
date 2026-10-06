import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mountUnderstanding } from './understanding-ui.mjs';
import { READING_CHECKS, readingMetadata } from './understanding.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
class Element {
  constructor() { this.children = []; this.dataset = {}; this.open = false; this.textContent = ''; }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener() {} showModal() { this.open = true; } close() { this.open = false; }
}
function fixture(t, { noApi = false, throws = false, exhausted = false } = {}) {
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const saved = new Map(), calls = [], rechecks = [], answers = [];
  const coach = createGame({ gameId: 'synk-town', map, fold: false, storage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } });
  const items = READING_CHECKS.filter(item => item.skill === 'detail');
  coach.assignment = () => ({ ...readingMetadata(items[0]), familyKeys: items.map(item => readingMetadata(item).familyKey), itemKeys: items.map(item => readingMetadata(item).itemKey), requiredAttempts: 3 });
  const originalAnswer = coach.answer, originalRecheck = coach.recheck;
  coach.answer = (...args) => { const result = originalAnswer(...args); answers.push(result); return result; };
  coach.recheck = noApi ? undefined : (...ids) => { calls.push(ids); if (throws) throw Error('history unavailable'); const result = originalRecheck(...ids); rechecks.push(result); return result; };
  if (exhausted) coach.exposure = () => ({ seen: true });
  let read = async () => {}, enabled = true;
  const globals = { document: { getElementById: $, createElement: () => new Element() }, localStorage: {}, SynkLearning: { createGame: () => coach } };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const ui = mountUnderstanding({ transport: { linked: true, read: () => read(), learningReady: () => true }, available: () => enabled });
  const answer = async (correct = true, assisted = false) => {
    const item = READING_CHECKS.find(item => item.id === $('reading-dialog').dataset.item);
    if (assisted) $('reading-hint').onclick();
    await $('reading-choices').children[correct ? item.correct : (item.correct + 1) % 3].onclick(); return answers.at(-1);
  };
  return { $, ui, coach, calls, rechecks, answers, answer, open: () => $('reading-open').onclick(), next: () => $('reading-next').onclick(),
    setRead(fn) { read = fn; }, setAvailable(value) { enabled = value; } };
}
test('Town UI joins only the intended fresh source/target and never reuses it after a later ordinary correct answer', async t => {
  const f = fixture(t); await f.open(); const source = await f.answer(false); f.next(); const target = await f.answer();
  assert.deepEqual(f.calls, [[source.eventId, target.eventId]]); assert.equal(f.rechecks[0].status, 'independent-correct');
  assert.match(f.$('reading-feedback').textContent, /다른 새 문항은 도움 없이 맞혔어요/);
  f.next(); await f.answer(); assert.equal(f.calls.length, 1); assert.doesNotMatch(f.$('reading-feedback').textContent, /다른 새 문항은/);
});
test('Town UI keeps help separate and starts the next pair from the assisted answer itself', async t => {
  const f = fixture(t); await f.open(); const first = await f.answer(false); f.next(); const second = await f.answer(true, true);
  assert.deepEqual(f.calls, [[first.eventId, second.eventId]]); assert.equal(f.rechecks[0].status, 'assisted-correct');
  assert.match(f.$('reading-feedback').textContent, /다른 새 문항은 도움을 보고 맞혔어요/);
  f.next(); const third = await f.answer(false); assert.deepEqual(f.calls.at(-1), [second.eventId, third.eventId]);
  assert.equal(f.rechecks[1].status, 'independent-incorrect'); assert.match(f.$('reading-feedback').textContent, /다른 새 문항은 도움 없이 풀었지만 틀렸어요/);
});
test('Town UI close and invalidate reset pending and active recheck sources', async t => {
  const f = fixture(t); await f.open(); await f.answer(false); f.$('reading-close').onclick(); await f.open(); await f.answer();
  assert.deepEqual(f.calls, []);
  f.ui.invalidate(); await f.open(); await f.answer(false); f.next(); f.ui.invalidate(); await f.open(); await f.answer();
  assert.deepEqual(f.calls, []);
});
for (const options of [{ noApi: true }, { throws: true }]) test(`Town UI retains the answer and next control without recheck (${Object.keys(options)[0]})`, async t => {
  const f = fixture(t, options); await f.open(); await f.answer(false); f.next(); const target = await f.answer();
  assert.equal(target.verdict, 'correct'); assert.equal(f.$('reading-next').hidden, false); assert.equal(f.$('reading-dialog').open, true);
  assert.doesNotMatch(f.$('reading-feedback').textContent, /다른 새 문항은/);
});
test('Town UI does not claim a recheck for an unavailable fresh follow-up', async t => {
  const f = fixture(t, { exhausted: true }); await f.open(); await f.answer(false); f.next(); await f.answer(); assert.deepEqual(f.calls, []);
});
test('Town UI ignores an answer still waiting for transport after its dialog is closed', async t => {
  const f = fixture(t); await f.open(); await f.answer(false); f.next();
  let release; f.setRead(() => new Promise(resolve => { release = resolve; }));
  const pending = f.answer(); f.ui.invalidate(); release(); await pending;
  assert.equal(f.answers.length, 1); assert.deepEqual(f.calls, []); assert.equal(f.$('reading-feedback').textContent, '');
});
test('Town UI displays assisted failure using the actual target record', async t => {
  const f = fixture(t); await f.open(); await f.answer(false); f.next(); await f.answer(false, true);
  assert.equal(f.rechecks[0].status, 'assisted-incorrect');
  assert.match(f.$('reading-feedback').textContent, /다른 새 문항은 도움을 보고 풀었지만 틀렸어요/);
});
test('Town UI marks an excluded source pair unavailable rather than claiming fresh independent success', async t => {
  const f = fixture(t); await f.open(); const source = await f.answer(false); f.coach.exclude(source.eventId); f.next(); await f.answer();
  assert.equal(f.rechecks[0].status, 'unavailable'); assert.match(f.$('reading-feedback').textContent, /새 문항 확인 결과를 판단할 기록이 충분하지 않아요/);
  assert.doesNotMatch(f.$('reading-feedback').textContent, /다른 새 문항은 도움 없이 맞혔어요/);
});
