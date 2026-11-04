import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES } from './places.mjs';
import { pickMissions, layoutPlates, judgeShot, helpLevel, makeRng, emptyAlbum, normalizeAlbum, addCard, nameCard, placeProgress, dailyMission, dayKey, finishDaily, recordRound, makeRecall } from './core.mjs';

test('부탁은 넷, 꼴은 뜻 둘 · 소리 · 낱말', () => {
  for (let seed = 1; seed < 50; seed += 1) {
    const ms = pickMissions(PLACES.gate, { rng: makeRng(seed) });
    assert.equal(ms.length, 4);
    assert.deepEqual(ms.map((m) => m.kind).sort(), ['meaning', 'meaning', 'sound', 'word']);
    assert.equal(new Set(ms.map((m) => m.word)).size, 4);
  }
});

test('안내문을 켜면 뜻 하나가 안내문 부탁이 된다', () => {
  const ms = pickMissions(PLACES.gate, { rng: makeRng(3), notices: true });
  assert.deepEqual(ms.map((m) => m.kind).sort(), ['meaning', 'notice', 'sound', 'word']);
});

test('소리를 끄면 소리 부탁이 뜻 부탁으로 바뀐다', () => {
  for (let seed = 1; seed < 30; seed += 1) {
    const ms = pickMissions(PLACES.gate, { rng: makeRng(seed), voice: false });
    assert.equal(ms.length, 4); assert.ok(!ms.some((m) => m.kind === 'sound'));
  }
});

test('약한 낱말이 먼저 정답이 된다', () => {
  for (let seed = 1; seed < 30; seed += 1) assert.ok(pickMissions(PLACES.gate, { rng: makeRng(seed), weak: ['pharmacy'] }).some((m) => m.word === 'pharmacy'));
});

test('판정: 고정 판 글자는 정답이 아니고, 낱말 부탁은 물건만 맞다', () => {
  assert.equal(judgeShot({ kind: 'meaning', word: 'library' }, { kind: 'plate', word: 'library' }), true);
  assert.equal(judgeShot({ kind: 'meaning', word: 'library' }, { kind: 'plate', word: 'bank' }), false);
  assert.equal(judgeShot({ kind: 'meaning', word: 'store' }, { kind: 'fixed', word: 'store' }), false);
  assert.equal(judgeShot({ kind: 'word', word: 'cat' }, { kind: 'thing', word: 'cat' }), true);
  assert.equal(judgeShot({ kind: 'word', word: 'cat' }, { kind: 'plate', word: 'cat' }), false);
});

test('도움: 첫 다름은 짚기만, 둘째는 낱말 보이기, 셋째는 판 깜빡 — 막히지 않는다', () => {
  assert.equal(helpLevel(1), 'point'); assert.equal(helpLevel(2), 'word'); assert.equal(helpLevel(3), 'plate'); assert.equal(helpLevel(9), 'plate');
});

test('판 수만큼 글이 얹히고 같은 무리에 같은 낱말이 둘 있지 않다', () => {
  for (let seed = 1; seed < 50; seed += 1) {
    const ms = pickMissions(PLACES.union, { rng: makeRng(seed) });
    const plates = layoutPlates(PLACES.union, ms, makeRng(seed + 7));
    for (const [gid, g] of Object.entries(PLACES.union.groups)) {
      const list = plates.filter((p) => p.group === gid);
      assert.equal(list.length, g.slots.length); assert.equal(new Set(list.map((p) => p.word)).size, list.length);
    }
  }
});

test('앨범: 찍음 → 이름 붙음. 찍기만으로는 장소 낱말 수가 오르지 않는다', () => {
  const album = emptyAlbum();
  assert.equal(addCard(album, { word: 'cat', kind: 'thing', q: [] }, 'gate', 1), true);
  assert.equal(addCard(album, { word: 'cat', kind: 'thing', q: [] }, 'gate', 2), false);
  assert.equal(album.cards.cat.at, 1); assert.equal(album.cards.cat.named, false);
  assert.equal(placeProgress(album, PLACES.gate).got, 0);
  assert.equal(nameCard(album, 'cat', 5), true);
  assert.equal(nameCard(album, 'cat', 6), false);
  assert.equal(placeProgress(album, PLACES.gate).got, 1);
  assert.equal(nameCard(album, 'bank', 7), false);   // 찍지 않은 낱말에는 이름을 붙이지 않는다
});

test('아무거나 찍어도 앨범이 차지 않는다: 부탁 판을 다 찍어도 이름 붙은 카드는 0', () => {
  const album = emptyAlbum();
  for (const word of PLACES.gate.groups.blade.pool) addCard(album, { word, kind: 'plate', q: [] }, 'gate', 1);
  const p = placeProgress(album, PLACES.gate);
  assert.equal(p.got, 0); assert.equal(p.shot, PLACES.gate.groups.blade.pool.length); assert.equal(p.done, false);
});

test('망가진 저장은 빈 앨범 · 모르는 낱말은 버린다', () => {
  assert.deepEqual(normalizeAlbum({ v: 9 }), emptyAlbum());
  assert.deepEqual(Object.keys(normalizeAlbum({ v: 1, cards: { cat: { place: 'gate' }, hacked: {} } }).cards), ['cat']);
});

test('안내문을 켜면 분모에 안내문이 더해진다', () => {
  const album = emptyAlbum(), off = placeProgress(album, PLACES.gate);
  assert.equal(placeProgress({ ...album, notices: true }, PLACES.gate).total, off.total + 6);
  assert.ok(off.total >= 16, String(off.total));
});

test('인화는 아직 이름 없는 사진을 먼저 묻는다', () => {
  const shots = [{ word: 'cat', kind: 'thing' }, { word: 'tree', kind: 'thing' }, { word: 'bike', kind: 'thing' }, { word: 'bench', kind: 'thing' }, { word: 'library', kind: 'plate' }];
  const album = emptyAlbum();
  for (const s of shots) addCard(album, s, 'gate', 1);
  nameCard(album, 'cat', 2); nameCard(album, 'tree', 2);
  for (let seed = 1; seed < 40; seed += 1) {
    const qs = makeRecall(PLACES.gate, shots, { rng: makeRng(seed), album });
    assert.equal(qs.length, 3); assert.ok(qs.every((q) => !album.cards[q.answer].named));
  }
});

test('내 기록: 부탁 넷을 다 한 번에 찾은 판의 시간 · 처음이면 새 기록', () => {
  const album = emptyAlbum();
  assert.equal(recordRound(album, 'gate', { ms: 60000, first: 3, of: 4 }).newBest, true);
  assert.equal(recordRound(album, 'gate', { ms: 50000, first: 2, of: 4 }).newBest, true);
  assert.equal(recordRound(album, 'gate', { ms: 70000, first: 4, of: 4 }).newBest, false);
  assert.equal(album.best.gate.ms, 50000); assert.equal(album.best.gate.first, 4); assert.equal(album.placePlays.gate, 3);
});

test('오늘의 찾기: 같은 날 같고 · 한국 날짜로 바뀌고 · 이어 한 날 수를 센다', () => {
  const at = Date.UTC(2026, 10, 3, 15, 30);   // 11-04 00:30 KST
  assert.equal(dayKey(at), '2026-11-04');
  assert.deepEqual(dailyMission([PLACES.gate, PLACES.union], at), dailyMission([PLACES.gate, PLACES.union], at + 3600000));
  assert.ok(dailyMission([PLACES.gate], at).word);
  const album = emptyAlbum(), day = 86400000;
  assert.equal(finishDaily(album, at), 1);
  assert.equal(finishDaily(album, at), 1);          // 같은 날 두 번은 그대로
  assert.equal(finishDaily(album, at + day), 2);
  assert.equal(finishDaily(album, at + 3 * day), 1);   // 끊기면 다시 하나부터(잃는 것은 없다)
});
