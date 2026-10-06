import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mountListeningCheck } from './listening-check-ui.mjs';
import { LISTENING_CHECKS, checkMetadata } from './listening-check.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const tick = () => new Promise(resolve => setImmediate(resolve));
class Element {
  constructor() { this.children = []; this.dataset = {}; this.open = false; this._text = ''; this.nodes = new Map(); this.classList = { toggle() {} }; }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map(node => typeof node === 'string' ? node : node.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = nodes; }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Element()); return this.nodes.get(selector); }
  setAttribute() {} addEventListener() {} focus() {}
  showModal() { this.open = true; } close() { this.open = false; }
}
class AudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; }
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  decodeAudioData() { return Promise.resolve({ duration: 1 }); }
  createBufferSource() { return { connect() {}, stop() {}, start() { queueMicrotask(() => this.onended?.()); } }; }
}
function fixture(t, { noApi = false, throws = false, exhausted = false } = {}) {
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const saved = new Map(), calls = [], rechecks = [], answers = [];
  const coach = createGame({ gameId: 'korean-runner', map, fold: false, storage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } });
  const items = LISTENING_CHECKS.filter(item => checkMetadata(item).skillId === 'ko.listening.detail').slice(0, 3);
  coach.assignment = () => ({ ...checkMetadata(items[0]), familyKeys: items.map(item => checkMetadata(item).familyKey), itemKeys: items.map(item => checkMetadata(item).itemKey), requiredAttempts: 3 });
  const originalAnswer = coach.answer, originalRecheck = coach.recheck;
  coach.answer = (...args) => { const result = originalAnswer(...args); answers.push(result); return result; };
  coach.recheck = noApi ? undefined : (...ids) => { calls.push(ids); if (throws) throw Error('history unavailable'); const result = originalRecheck(...ids); rechecks.push(result); return result; };
  if (exhausted) coach.exposure = () => ({ seen: true });
  const globals = { document: { getElementById: $, createElement: () => new Element(), addEventListener() {} }, window: { AudioContext },
    requestAnimationFrame() {}, addEventListener() {}, fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const ui = mountListeningCheck({ coach, beforeOpen: () => true });
  const answer = async (correct = true, assisted = false) => {
    await tick(); const state = ui.state(); assert.equal(state.audio, 'completed');
    if (assisted) { await $('check-replay').onclick(); await tick(); }
    const choice = correct ? state.correct : (state.correct + 1) % 3;
    $('check-choices').children[choice].onclick(); return answers.at(-1);
  };
  return { $, ui, coach, calls, rechecks, answers, answer, open: async () => { await $('listening-check').onclick(); await tick(); }, next: async () => { $('check-next').onclick(); await tick(); } };
}
test('Runner UI rechecks the actual fresh follow-up pair once; later correct answers and review replay do not reuse it', async t => {
  const f = fixture(t); await f.open(); const source = await f.answer(false);
  await f.next(); const target = await f.answer();
  assert.deepEqual(f.calls, [[source.eventId, target.eventId]]);
  assert.match(f.$('check-feedback').textContent, /다른 새 문항은 도움 없이 맞혔어요/);
  assert.equal(f.rechecks[0].status, 'independent-correct');
  const events = f.coach.events(); await f.$('check-replay').onclick(); await tick(); assert.deepEqual(f.coach.events(), events);
  await f.next(); await f.answer(); assert.equal(f.calls.length, 1);
  assert.doesNotMatch(f.$('check-feedback').textContent, /다른 새 문항은/);
  assert.equal(f.ui.state().rightCount, 2);
});
test('Runner UI shows assisted success and then links only that answer to a fresh failed follow-up', async t => {
  const f = fixture(t); await f.open(); const first = await f.answer(false); await f.next();
  const second = await f.answer(true, true); assert.deepEqual(f.calls, [[first.eventId, second.eventId]]);
  assert.match(f.$('check-feedback').textContent, /다른 새 문항은 도움을 보고 맞혔어요/);
  await f.next(); const third = await f.answer(false);
  assert.deepEqual(f.calls.at(-1), [second.eventId, third.eventId]);
  assert.match(f.$('check-feedback').textContent, /다른 새 문항은 도움 없이 풀었지만 틀렸어요/);
});
test('Runner UI close drops the pending source before a new round', async t => {
  const f = fixture(t); await f.open(); await f.answer(false); await f.next(); f.ui.close();
  await f.open(); await f.answer(); assert.deepEqual(f.calls, []); assert.doesNotMatch(f.$('check-feedback').textContent, /다른 새 문항은/);
});
for (const options of [{ noApi: true }, { throws: true }]) test(`Runner UI preserves scoring without a readable recheck (${Object.keys(options)[0]})`, async t => {
  const f = fixture(t, options); await f.open(); await f.answer(false); await f.next(); const target = await f.answer();
  assert.equal(target.verdict, 'correct'); assert.equal(f.ui.state().answered, true);
  assert.doesNotMatch(f.$('check-feedback').textContent, /다른 새 문항은/); assert.equal(f.$('check-next').hidden, false);
});
test('Runner UI does not recheck a remaining review question when no unseen follow-up is available', async t => {
  const f = fixture(t, { exhausted: true }); await f.open(); await f.answer(false); await f.next(); await f.answer(); assert.deepEqual(f.calls, []);
});
test('Runner UI displays a helped incorrect follow-up without reporting independent success', async t => {
  const f = fixture(t); await f.open(); await f.answer(false); await f.next(); await f.answer(false, true);
  assert.equal(f.rechecks[0].status, 'assisted-incorrect');
  assert.match(f.$('check-feedback').textContent, /다른 새 문항은 도움을 보고 풀었지만 틀렸어요/);
});
test('Runner UI displays unavailable measurement when the actual source evidence was excluded', async t => {
  const f = fixture(t); await f.open(); const source = await f.answer(false); f.coach.exclude(source.eventId);
  await f.next(); await f.answer(); assert.equal(f.rechecks[0].status, 'unavailable');
  assert.match(f.$('check-feedback').textContent, /새 문항 확인 결과를 판단할 기록이 충분하지 않아요/);
  assert.doesNotMatch(f.$('check-feedback').textContent, /다른 새 문항은 도움 없이 맞혔어요/);
});
