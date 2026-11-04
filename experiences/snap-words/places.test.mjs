// 꼬리표 시험(설계 4절, Koe 규칙): 글자를 읽지 않고 색 · 자리 · 길이 · 글자 모양으로 풀리면 안 된다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, PLACE_ORDER, placeWords, STYLE_INK } from './places.mjs';
import { WORDS, wordOf } from './words.mjs';
import { pickMissions, layoutPlates, makeRng, makeRecall } from './core.mjs';

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

test('모든 낱말이 원고에 있다', () => {
  for (const id of PLACE_ORDER) for (const word of placeWords(PLACES[id], { notices: true })) assert.ok(WORDS[word], word);
});

test('① 부탁 정답인 판은 섞는 무리 — 일반 판 셋 이상(안내문 둘 이상) · 낱말 풀이 판 수보다 많다(⑤ 다시 해도 다른 판)', () => {
  for (const id of PLACE_ORDER) for (const [gid, g] of Object.entries(PLACES[id].groups)) {
    if (g.noMission) continue;
    assert.ok(g.slots.length >= (g.notice ? 2 : 3), gid);
    assert.ok(g.pool.length > g.slots.length, gid);
  }
});

test('② 뜻 부탁 글에 정답 낱말과 그 첫 두 음절이 없다', () => {
  for (const w of Object.values(WORDS)) {
    if (!w.ask) continue;
    const compact = w.ko.replace(/\s/g, '');
    for (const text of Object.values(w.ask)) {
      assert.ok(!text.includes(compact), `${w.id}: ${text}`);
      if (w.band !== 'notice' && compact.length >= 2) assert.ok(!text.includes(compact.slice(0, 2)), `${w.id}: ${text}`);
    }
  }
});

test('③ 낱말 부탁의 정답 물건에는 얹는 글이 없고, 뜻 · 소리 부탁의 정답은 섞는 판이다', () => {
  for (const id of PLACE_ORDER) for (const seed of seeds) {
    const place = PLACES[id], ms = pickMissions(place, { rng: makeRng(seed), notices: seed % 2 === 0 });
    const plates = layoutPlates(place, ms, makeRng(seed + 1000));
    for (const m of ms) {
      if (m.kind === 'word') {
        assert.ok(place.things.some((t) => t.word === m.word));
        assert.ok(!plates.some((p) => p.word === m.word), `${m.word}는 글이 없어야 한다`);
      } else {
        assert.ok(plates.some((p) => p.kind === 'plate' && p.group === m.group && p.word === m.word), m.word);
      }
      if (m.kind === 'sound') assert.equal(wordOf(m.word).voice, true, m.word);
    }
  }
});

test('안내문 부탁에는 같은 낱말을 쓰는 짝 판이 같이 선다(글자 일부만 보고 못 고른다)', () => {
  for (const seed of seeds) {
    const plates = layoutPlates(PLACES.gate, [{ kind: 'notice', group: 'stand', word: 'n-bike' }], makeRng(seed)).filter((p) => p.group === 'stand').map((p) => p.word).sort();
    assert.deepEqual(plates, ['n-bike', 'n-fix']);
  }
});

test('같은 부탁이라도 정답 판의 자리가 판마다 바뀐다', () => {
  const place = PLACES.gate, seen = new Set(), mission = { kind: 'meaning', group: 'blade', word: 'library' };
  for (const seed of seeds) seen.add(layoutPlates(place, [mission], makeRng(seed)).find((p) => p.word === 'library').id);
  assert.ok(seen.size >= 5, [...seen].join());
});

test('④ 인화 선택지는 셋 · 정답 포함 · 길이로 못 맞힌다(물건은 음절 차이 1 안, 뜻은 글 길이 비슷한 쪽부터)', () => {
  const place = PLACES.gate;
  const shots = [{ word: 'cat', kind: 'thing' }, { word: 'library', kind: 'plate' }, { word: 'tree', kind: 'thing' }, { word: 'n-smoke', kind: 'plate' }];
  for (const seed of seeds) {
    for (const q of makeRecall(place, shots, { rng: makeRng(seed), count: 4 })) {
      assert.equal(new Set(q.options).size, 3, q.answer); assert.ok(q.options.includes(q.answer));
      if (q.mode === 'word') for (const id of q.options) assert.ok(Math.abs([...wordOf(id).ko].length - [...wordOf(q.answer).ko].length) <= 1, `${q.answer}/${id}`);
    }
  }
});

test('판 모서리는 사진 안 · 볼록 · 시계 방향', () => {
  for (const id of PLACE_ORDER) {
    const place = PLACES[id];
    const quads = [...Object.values(place.groups).flatMap((g) => g.slots), ...place.fixed.map((f) => f.q), ...place.things.map((t) => t.q)];
    for (const q of quads) {
      assert.equal(q.length, 4);
      for (const [x, y] of q) assert.ok(x >= 0 && x <= place.w && y >= 0 && y <= place.h, JSON.stringify(q));
      for (let i = 0; i < 4; i += 1) {
        const [a, b, c] = [q[i], q[(i + 1) % 4], q[(i + 2) % 4]];
        assert.ok((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0, JSON.stringify(q));
      }
    }
  }
});

test('판마다 잉크색이 있고 바탕과 대비 4.5:1 이상', () => {
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const styles = new Set();
  for (const id of PLACE_ORDER) { Object.values(PLACES[id].groups).forEach((g) => styles.add(g.style)); PLACES[id].fixed.forEach((f) => styles.add(f.style)); }
  for (const style of styles) {
    const s = STYLE_INK[style]; assert.ok(s, style);
    const [a, b] = [lum(s.ink), lum(s.bg)].sort((x, y) => y - x);
    assert.ok((a + 0.05) / (b + 0.05) >= 4.5, `${style} ${(a + 0.05) / (b + 0.05)}`);
  }
});
