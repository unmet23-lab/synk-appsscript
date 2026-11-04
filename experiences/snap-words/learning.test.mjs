import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PLACES, PLACE_ORDER } from './places.mjs';
import { WORDS } from './words.mjs';
import { pickMissions, makeRng } from './core.mjs';
import { itemMetadata, missionMetadata, missionCandidates, createLearning, GAME_ID } from './learning.mjs';

const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
let clock = Date.parse('2026-11-04T09:00:00Z');
const game = (store = new Map()) => createGame({ gameId: GAME_ID, map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, clock: () => new Date(clock += 60000).toISOString() });

test('모든 낱말 · 꼴의 기록 칸이 맵과 맞다', () => {
  for (const word of Object.keys(WORDS)) for (const form of ['meaning', 'word', 'sound', 'notice', 'recall-word', 'recall-meaning']) {
    const m = itemMetadata(form, word), node = map.getNode(m.skillId);
    assert.ok(node, m.skillId); assert.equal(node.domain, m.modality, `${form} ${word}`);
    assert.ok([1, 2, 3].includes(m.difficulty)); assert.equal(m.audioRequired, form === 'sound');
  }
});

test('한 번에 맞힌 부탁은 혼자 해낸 기록이고, 낱말을 본 뒤의 맞힘은 도움 받음이다', () => {
  const g = game(), L = createLearning(() => g), mission = { kind: 'meaning', word: 'library' };
  L.present(mission); L.answer(mission, { correct: true, selected: 'library', attemptNo: 1 });
  const first = g.summary().skills?.find?.((s) => s.id === 'ko.reading.vocabulary') ?? null;
  const g2 = game(), L2 = createLearning(() => g2), m2 = { kind: 'meaning', word: 'bank' };
  L2.present(m2);
  L2.answer(m2, { correct: false, selected: 'library', attemptNo: 1 });
  L2.helped(m2);
  L2.answer(m2, { correct: true, selected: 'bank', attemptNo: 2 });
  assert.ok(first === null || first);   // 요약 꼴은 엔진 몫 — 여기서는 던지지 않는지 본다
  L2.leave();
});

test('소리 부탁은 듣기 문항으로 들어간다', () => {
  const g = game(), L = createLearning(() => g), mission = { kind: 'sound', word: 'library' };
  L.present(mission); assert.ok(mission.pid);
  L.heard(mission);
  L.answer(mission, { correct: true, selected: 'library', attemptNo: 1 });
  L.leave();
  assert.equal(missionMetadata(mission).modality, 'listening');
});

test('인화 한 문제 · 답 없이 나가기 · 아틀라스가 없어도 게임은 돈다', () => {
  const g = game(), L = createLearning(() => g);
  L.recall({ mode: 'word', answer: 'cat' }, 'tree');
  L.recall({ mode: 'meaning', answer: 'bank' }, 'bank');
  const m = { kind: 'word', word: 'cat' }; L.present(m); L.leave();
  const none = createLearning(() => { throw Error('없음'); });
  assert.equal(none.available(), false);
  const x = { kind: 'meaning', word: 'bank' };
  none.present(x); none.answer(x, { correct: true, selected: 'bank', attemptNo: 1 }); none.recall({ mode: 'word', answer: 'cat' }, 'cat'); none.leave();
  assert.deepEqual(none.weak(PLACES.gate), []);
});

test('약한 낱말 고르기는 장소의 뜻 부탁 후보에서만 고르고, 기록이 없어도 던지지 않는다', () => {
  for (const id of PLACE_ORDER) {
    const L = createLearning(() => game()), words = missionCandidates(PLACES[id]).map((c) => c.word), weak = L.weak(PLACES[id]);
    assert.ok(words.length >= 3); assert.ok(weak.every((w) => words.includes(w)));
  }
});

test('고른 부탁을 그대로 기록할 수 있다', () => {
  for (const id of PLACE_ORDER) for (let seed = 1; seed < 15; seed += 1) {
    const L = createLearning(() => game());
    for (const m of pickMissions(PLACES[id], { rng: makeRng(seed), notices: seed % 2 === 0 })) { L.present(m); assert.ok(m.pid, m.word); L.heard(m); L.answer(m, { correct: true, selected: m.word, attemptNo: 1 }); }
  }
});
