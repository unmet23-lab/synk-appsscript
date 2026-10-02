// The hub suggests a game by the ability, difficulty and response format it names. Each of
// those cells must exist among that game's real items, or its "unseen" state could never
// change and the hub would keep suggesting the same game for a reason it cannot meet.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const here = new URL('./', import.meta.url), games = new URL('../', here);
const source = fs.readFileSync(new URL('app.js', here), 'utf8');
const block = source.match(/const catalog = (\[[\s\S]*?\n\]);/);
const catalog = vm.runInNewContext(block[1]);

async function cells() {
  const found = { racing: new Set(), rhythm: new Set(), order: new Set(), entry: new Set(), story: new Set(), slice: new Set() };
  const metas = { racing: [], rhythm: [], order: [], entry: [], story: [], slice: [] };
  Object.defineProperty(found, 'metas', { value: metas });
  const add = (game, m) => { found[game].add(`${m.skillId}|${m.difficulty}|${m.responseFormat}`); metas[game].push(m); };
  const racing = await import(new URL('korean-racing/personalization.js', games));
  const { CAMPAIGN } = await import(new URL('korean-racing/campaign.js', games));
  for (const stage of CAMPAIGN) for (const item of stage.items) add('racing', racing.racingItem(item));
  add('racing', racing.racingItem({ answer: 'w0001', mode: 'listen' }));
  const rhythm = await import(new URL('korean-rhythm/personalization.mjs', games));
  const { TRACKS } = await import(new URL('korean-rhythm/core.mjs', games));
  for (const track of TRACKS) track.questions.forEach((q, i) => add('rhythm', rhythm.rhythmItem(track.id, { id: `q${i}`, sourceIndex: i, variant: 0 })));
  const order = await import(new URL('order-rush/learning.mjs', games)), orders = await import(new URL('order-rush/core.mjs', games));
  for (const o of [...orders.ORDERS, ...orders.REVIEW]) add('order', order.orderMetadata(o));
  const entry = await import(new URL('entry-check/learning.mjs', games)), venues = await import(new URL('entry-check/content.mjs', games));
  for (const venue of venues.VENUES) for (const c of venue.cases) add('entry', entry.caseMetadata(c));
  const story = await import(new URL('story-classroom/learning.mjs', games)), episode = await import(new URL('story-classroom/story.mjs', games));
  const E = episode.EPISODE || episode.default?.EPISODE;
  for (const m of [...E.acts.flatMap(a => a.missions), ...E.review]) add('story', { responseFormat: 'action', ...story.missionMetadata(m) });
  const slice = await import(new URL('blank-slice/learning.mjs', games)), sentences = await import(new URL('blank-slice/content.mjs', games));
  for (const item of sentences.ITEMS) add('slice', slice.itemMetadata(item));
  return found;
}
const GAME = { 'racing-reading': 'racing', 'racing-listening': 'racing', order: 'order', rhythm: 'rhythm', 'reading-entry-check': 'entry', 'reading-story-classroom': 'story', 'reading-blank-slice': 'slice' };

test('every ability the hub names exists in its game at that difficulty and response format', async () => {
  const found = await cells();
  for (const entry of catalog) {
    const game = GAME[entry.id];
    assert.ok(game, `unknown catalog entry ${entry.id}`);
    for (const skillId of entry.skillIds) {
      const cell = `${skillId}|${entry.difficulty}|${entry.responseFormat}`;
      assert.ok(found[game].has(cell), `${entry.id}: ${cell} is not among ${game}'s items`);
    }
  }
});

// Each entry also names the item families its game has in those cells. Once all were presented the game
// can give no new first try there, so Core puts the entry behind those that still can (learning.js).
// Through JSON: values made in the vm context have that context's prototypes.
const families = JSON.parse(JSON.stringify(vm.runInNewContext(`(${source.match(/const families = (\{[\s\S]*?\n\});/)[1]})`)));
test('each entry names exactly the item families its game has in those cells', async () => {
  const found = await cells();
  assert.deepEqual(Object.keys(families).sort(), Array.from(catalog, e => e.id).sort());
  for (const entry of catalog) {
    const expected = [...new Set(found.metas[GAME[entry.id]].filter(m => entry.skillIds.includes(m.skillId) && m.difficulty === entry.difficulty
      && (m.responseFormat || 'unknown') === entry.responseFormat && m.modality === entry.modality).map(m => m.familyKey || m.itemKey))];
    assert.ok(expected.length, entry.id);
    assert.deepEqual(families[entry.id], expected, `${entry.id}: families differ from the game's items; rerun the generator or update the list`);
  }
});

test('a game spent in that cell goes behind one that can still give a first try', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
  const map = createMap(require('../../strata/topik-i.js').topikMap());
  let t = Date.parse('2026-10-03T09:00:00Z'); const store = new Map();
  const coach = createGame({ gameId: 'learning-hub', map, storage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, clock: () => new Date(t += 60000).toISOString() });
  const entries = catalog.map(entry => ({ ...entry, familyKeys: families[entry.id] }));
  // Two misses on the story's reading cell: without families the hub would keep sending the person there.
  const story = await import(new URL('story-classroom/learning.mjs', games)), episode = await import(new URL('story-classroom/story.mjs', games));
  const missions = [...episode.EPISODE.acts.flatMap(a => a.missions), ...episode.EPISODE.review].map(m => story.missionMetadata(m))
    .filter(m => families['reading-story-classroom'].includes(m.familyKey || m.itemKey));
  for (const m of missions) coach.answer(coach.present(m), { correct: false, assessable: true });
  const spent = coach.recommend(entries, { audioAvailable: true });
  assert.notEqual(spent.selected.id, 'reading-story-classroom', 'every family of that cell was presented: another entry first');
  assert.ok(spent.alternatives.some(e => e.id === 'reading-story-classroom'), 'still available when chosen');
});
