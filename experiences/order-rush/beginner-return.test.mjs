import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, readProgress, stageOrders, shuffle, STAGES, VOICE_LINES } from './beginner-core.mjs';
import { nextFestivalRound, memoryCandidates, nextMemoryRound, memoryShelf } from './beginner-return.mjs';
import { beginnerRewardLink } from './beginner-shop.mjs';

const fixture = () => ({ ...newProgress(42), completed: [0, 1], stage: 2, records: [
  { voice: 'bread-please', stage: 1, heard: true, firstCorrect: false, independent: false, helped: true, guest: 'rabbit' },
  { voice: 'apple-2', stage: 2, heard: true, firstCorrect: true, independent: false, replayed: true, guest: 'bear' },
], checkpoint: { phase: 'order', stage: 2, index: 1, touched: true, tray: ['bread'], firstCorrect: false, hint: true }, roundId: 'order-rush:kept' });
const story = progress => Object.fromEntries(['seed', 'completed', 'stage', 'records', 'checkpoint', 'finished', 'roundId'].map(key => [key, progress[key]]));

test('free festivals change both order and guest sequence across reloads without changing taught recipes or story', () => {
  for (let seed = 1; seed <= 50; seed++) {
    let progress = readProgress({ ...newProgress(seed), completed: [0, 1, 2, 3] }), previous = stageOrders(3, seed + 3);
    const before = story(progress), recipes = previous.map(order => order.voice).sort();
    for (let visit = 0; visit < 30; visit++) {
      const round = nextFestivalRound(progress);
      assert.notDeepEqual(round.orders.map(order => order.voice), previous.map(order => order.voice));
      assert.notDeepEqual(round.orders.map(order => order.guest), previous.map(order => order.guest));
      assert.deepEqual(round.orders.map(order => order.voice).sort(), recipes);
      assert.ok(round.orders.every(order => VOICE_LINES.some(line => line.id === order.voice && line.text === order.text)));
      progress.festivalPractice = round.history; progress = readProgress(JSON.parse(JSON.stringify(progress))); previous = round.orders;
      assert.deepEqual(story(progress), before); assert.equal(progress.festivalPractice.visits, visit + 1);
    }
  }
});
test('legacy progress gains optional history only; invalid or overlong histories cannot inject target content', () => {
  const progress = fixture(), normalized = readProgress(progress);
  assert.equal(normalized.festivalPractice.visits, 0); assert.equal(normalized.memoryPractice.visits, 0);
  const restored = readProgress({ ...progress, festivalPractice: { visits: -1, previous: { voices: ['evil'], guests: ['<img>'] } }, memoryPractice: { visits: 1e100, previous: { voices: ['bread-please', 'bread-please', 'bread-please'], guests: ['bear', 'bear', 'bear'] } } });
  assert.deepEqual(restored.festivalPractice, { visits: 0, previous: null }); assert.deepEqual(restored.memoryPractice, { visits: 0, previous: null });
  assert.deepEqual(story(restored), story(normalized));
});
test('memory selects at most two actual assisted orders and excludes demos, failed audio, invented or now-independent answers', () => {
  const progress = fixture();
  assert.deepEqual(memoryCandidates(progress).map(order => order.voice), ['apple-2', 'bread-please']);
  progress.records.push({ voice: 'apple-2', stage: 2, heard: true, firstCorrect: true, independent: true }, { voice: 'water', stage: 0, heard: false, firstCorrect: false }, { voice: 'bread-3', stage: 0, heard: true, firstCorrect: false }, { voice: 'water', stage: 0, demo: true, heard: true, firstCorrect: false });
  assert.deepEqual(memoryCandidates(progress).map(order => order.voice), ['bread-please']);
  assert.equal(nextMemoryRound(newProgress()), null);
});
test('memory gives the same familiar request to new guests and different layouts without modifying story or creating results', () => {
  let progress = readProgress(fixture()); const before = story(progress); let previous = null;
  for (let visit = 0; visit < 20; visit++) {
    const round = nextMemoryRound(progress); assert.equal(round.orders.length, 2);
    for (let i = 0; i < round.orders.length; i++) {
      const order = round.orders[i]; assert.notEqual(order.guest, order.previousGuest); if (previous) assert.notEqual(order.guest, previous.guests[i]);
      assert.ok(round.items.includes(order.item)); assert.ok(VOICE_LINES.some(line => line.id === order.voice && line.text === order.text));
      const layout = memoryShelf(round.items, round.shelfSeed + i * 131, order, progress.seed), original = shuffle(STAGES[order.stage].items, progress.seed + order.storyIndex + order.stage * 71);
      assert.notDeepEqual(layout, original); assert.ok(!Object.hasOwn(order, 'independent')); assert.ok(!Object.hasOwn(order, 'correct'));
    }
    progress.memoryPractice = round.history; previous = round.history.previous; progress = readProgress(JSON.parse(JSON.stringify(progress))); assert.deepEqual(story(progress), before);
  }
});
test('reward links use the verified route only and daily-limit or unavailable fallback never promises coins', () => {
  const html = beginnerRewardLink({ available: true, href: '/word-magic/?chapter=0', label: '마법 한 장', labelEn: 'One chapter', description: '소리로 장면을 완성해요.', descriptionEn: 'Complete a scene.' });
  assert.match(html, /href="\/word-magic\/\?chapter=0"/); assert.match(html, /마법 한 장/);
  for (const route of [null, { available: false, reason: 'daily-limit' }, { available: true, href: 'javascript:alert(1)' }]) { const fallback = beginnerRewardLink(route); assert.match(fallback, /href="\/learning-hub\/#beginner-title"/); assert.doesNotMatch(fallback, /받아요|earn \d|\+\d/); }
});
