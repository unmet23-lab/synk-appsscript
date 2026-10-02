import test from 'node:test';
import assert from 'node:assert/strict';
import { createTownTransport } from './linked-client.mjs';
import { READING_CHECKS, readingMetadata, readingAnswer } from './understanding.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
test('only three authored reading answers generate learning evidence; hints remain assisted', () => {
  const rows = new Map(), coach = createGame({ gameId: 'synk-town', map, storage: { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v) } });
  for (const [i, item] of READING_CHECKS.entries()) {
    const pid = coach.present(readingMetadata(item)); if (i === 1) coach.help(pid, 'hint');
    const result = coach.answer(pid, readingAnswer(item, item.correct));
    assert.equal(result.verdict, 'correct'); assert.equal(result.independent, i !== 1);
  }
  assert.equal(coach.summary().independent, 2); assert.throws(() => readingAnswer(READING_CHECKS[0], -1));
});
function windowFixture(host) { return { location: { pathname: '/synk-town/linked.html', origin: 'http://127.0.0.1:1' }, parent: { location: { origin: 'http://127.0.0.1:1' }, SYNKTownHost: host } }; }
const data = { mode: 'local-linked', state: {}, view: {} };
test('Town linked transport never fetches a token and rejects host replacement during an awaited response', async () => {
  let resolve; const host = { read: () => new Promise(r => resolve = r), command: async () => data }, w = windowFixture(host);
  const t = createTownTransport({ windowObject: w, fetcher: () => { throw Error('No direct fetch'); } });
  const reading = t.read(); w.parent.SYNKTownHost = { ...host }; resolve(data);
  await assert.rejects(reading, /WORLD/);
});
test('standalone/cross-origin/missing hosts cannot unlock linked Town', async () => {
  for (const w of [windowFixture(null), windowFixture({})]) await assert.rejects(createTownTransport({ windowObject: w }).read());
  const w = windowFixture({ read: async () => data, command: async () => data }); w.parent.location.origin = 'https://foreign.test';
  await assert.rejects(createTownTransport({ windowObject: w }).read());
  w.parent = w; await assert.rejects(createTownTransport({ windowObject: w }).read());
});
