import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, metadata, VOICE_LINES } from './beginner-core.mjs';
import { picnicRound, picnicScene, PICNIC_FRIENDS, PICNIC_VISITS_KEY, nextPicnicRound, createPicnicVisits, readPicnicVisits } from './beginner-picnic.mjs';
test('picnic reuses only taught expressions and exact approved voice lines', () => {
  for (let completed = 0; completed <= 4; completed++) {
    const saved = { ...newProgress(42), completed: Array.from({ length: completed }, (_, i) => i) };
    const before = JSON.stringify(saved), round = picnicRound(saved);
    assert.equal(round.guided, completed === 0); assert.equal(round.orders.length, 3);
    assert.deepEqual(round.orders.map(o => o.guest), PICNIC_FRIENDS); assert.equal(JSON.stringify(saved), before);
    for (const order of round.orders) { assert.ok(VOICE_LINES.some(v => v.id === order.voice && v.text === order.text)); assert.ok(metadata(order).familyKey.startsWith('order-rush.beginner.')); }
    if (completed < 2) assert.ok(round.orders.every(o => ['water', 'bread'].includes(o.voice)));
    if (completed === 2) assert.ok(round.orders.every(o => o.voice.endsWith('-please')));
  }
});
test('picnic scene reveals delivered food only after each serving', () => {
  const round = picnicRound(newProgress(1));
  const start = picnicScene(round.orders, 0, { active: 'rabbit' });
  assert.ok(!start.includes('class="b-picnic-food')); assert.ok(start.includes('assets/cast/rabbit.webp')); assert.ok(!start.includes('assets/cast/deer.webp'));
  const end = picnicScene(round.orders, 3); assert.equal((end.match(/class="b-picnic-food/g) || []).length, 3);
  assert.ok(end.includes('assets/cast/deer.webp')); assert.ok(end.includes('A PICNIC MADE TOGETHER'));
});
test('same-level repeat visits change both orders and friend order without introducing untaught content', () => {
  for (let completed = 0; completed <= 4; completed++) for (const seed of [1, 42, 0xffffffff]) {
    const saved = { ...newProgress(seed), completed: Array.from({ length: completed }, (_, i) => i) }, original = JSON.stringify(saved);
    let state = readPicnicVisits(null, seed), last = null;
    for (let visit = 0; visit < 100; visit++) {
      const result = nextPicnicRound(saved, state), voices = result.round.orders.map(o => o.voice), friends = result.round.orders.map(o => o.guest);
      if (last) { assert.notDeepEqual(voices, last.voices); assert.notDeepEqual(voices.map(id => id.split('-')[0]), last.voices.map(id => id.split('-')[0])); assert.notDeepEqual(friends, last.friends); }
      assert.deepEqual([...friends].sort(), [...PICNIC_FRIENDS].sort());
      for (const o of result.round.orders) {
        assert.ok(VOICE_LINES.some(line => line.id === o.voice && line.text === o.text));
        if (completed < 2) { assert.ok(['water', 'bread'].includes(o.voice)); assert.equal(o.count, 1); }
        else if (completed === 2) assert.ok(['water-please', 'bread-please', 'apple-please'].includes(o.voice));
        else assert.ok(['water-please', 'bread-please', 'apple-please', 'bread-1', 'bread-2', 'bread-3', 'apple-1', 'apple-2', 'apple-3'].includes(o.voice));
        assert.equal(metadata(o).familyKey, `order-rush.beginner.${o.voice}.v1`);
      }
      state = JSON.parse(JSON.stringify(result.state)); last = { voices, friends };
    }
    assert.equal(JSON.stringify(saved), original);
  }
});
test('variation history continues after reload and failed writes only affect reload continuity', () => {
  const values = new Map(), progress = newProgress(8); let blocked = false;
  const storage = { getItem: k => values.get(k) || null, setItem: (k, value) => { if (blocked) throw Error('blocked'); values.set(k, value); } };
  const first = createPicnicVisits(storage, 8).next(progress), nextSession = createPicnicVisits(storage, 8), second = nextSession.next(progress);
  assert.equal(first.stored, true); assert.equal(second.state.visits, 2); assert.notDeepEqual(first.state.previous, second.state.previous);
  assert.deepEqual([...values.keys()], [PICNIC_VISITS_KEY]); const preserved = values.get(PICNIC_VISITS_KEY); blocked = true;
  const third = nextSession.next(progress), fourth = nextSession.next(progress);
  assert.equal(third.stored, false); assert.equal(fourth.stored, false); assert.notDeepEqual(third.state.previous.voices, fourth.state.previous.voices); assert.notDeepEqual(third.state.previous.friends, fourth.state.previous.friends); assert.equal(values.get(PICNIC_VISITS_KEY), preserved);
  const unavailable = createPicnicVisits({ getItem() { throw Error('unreadable'); }, setItem() { assert.fail('must not overwrite unreadable history'); } }, 8).next(progress); assert.equal(unavailable.stored, false);
});
test('varied scenes keep each delivered order below the actual invited friend', () => {
  const round = nextPicnicRound({ ...newProgress(42), completed: [0, 1, 2] }, { version: 1, seed: 6, visits: 2, previous: { voices: ['water-please', 'bread-2', 'apple-3'], friends: [...PICNIC_FRIENDS] } }).round;
  const start = picnicScene(round.orders, 0, { active: round.orders[0].guest });
  assert.ok(start.includes(`class="b-picnic-friend friend-0" src="assets/cast/${round.orders[0].guest}.webp"`));
  assert.equal((start.match(/class="b-picnic-friend/g) || []).length, 1);
  const one = picnicScene(round.orders, 1, { active: round.orders[1].guest });
  assert.ok(one.includes(`class="b-picnic-friend friend-1" src="assets/cast/${round.orders[1].guest}.webp"`)); assert.equal((one.match(/class="b-picnic-food/g) || []).length, 1);
});
