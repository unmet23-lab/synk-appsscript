import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { TRACKS, RoundState } from './core.mjs';
import { RHYTHM_GRAMMAR, RHYTHM_CANDIDATES, rhythmItem } from './personalization.mjs';

// 문항은 들려주는 지문에서 Strata가 읽은 문형에 이어진다(strata/topik-i-forms.js). 다시 확인 문항은 그 지문의 문형.
const require = createRequire(import.meta.url);
const { grammarIn } = require('../../strata/topik-i-forms.js');
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));

test('문형 연결: 지문과 다시 확인 지문은 Strata가 읽은 문형, 곡 후보는 지문 문형의 합', () => {
  assert.equal(RHYTHM_GRAMMAR.length, TRACKS.length);
  for (const track of TRACKS) {
    assert.equal(RHYTHM_GRAMMAR[track.id].length, track.questions.length, `곡 ${track.id}`);
    track.questions.forEach((q, i) => {
      assert.deepEqual(RHYTHM_GRAMMAR[track.id][i], [grammarIn(q.prompt), grammarIn(q.recall.prompt)], `t${track.id}q${i}`);
      for (const variant of [0, 1]) assert.deepEqual(rhythmItem(track.id, { sourceIndex: i, variant }).conceptIds, grammarIn(q.prompt));
      assert.deepEqual(rhythmItem(track.id, { sourceIndex: i }, { recall: true }).conceptIds, grammarIn(q.recall.prompt));
    });
    const candidate = RHYTHM_CANDIDATES.find((c) => c.trackId === track.id);
    assert.deepEqual(candidate.conceptIds, [...new Set(track.questions.flatMap((q) => grammarIn(q.prompt)))]);
  }
  for (const id of new Set(RHYTHM_GRAMMAR.flat(3))) assert.equal(map.getNode(id)?.kind, 'grammar_point', id);
});

test('문형 연결: 틀린 지문의 문형이 연습할 내용에 나오고 그 문형이 있는 곡을 조금 앞세운다', () => {
  let t = Date.parse('2026-10-03T09:00:00Z');
  const store = new Map();
  const coach = createGame({ gameId: 'korean-rhythm', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(t += 60000).toISOString() });
  // 첫 곡의 「-지만」 지문(아침에는 비가 왔지만 …)을 틀린다.
  const q = new RoundState(TRACKS[0]).questions[2];
  const pid = coach.present(rhythmItem(0, q));
  coach.delivery(pid, { audio: 'completed' });
  coach.answer(pid, { correct: false, assessable: true });
  const concept = coach.summary().concepts.find((c) => c.id === 'G307');
  assert.ok(concept, '-지만이 틀린 뒤 연습할 내용에 있다');
  assert.equal(concept.formats['binary-choice'].incorrect, 1);
});
