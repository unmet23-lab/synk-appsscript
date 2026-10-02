import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ITEMS } from './content.mjs';
import { composeRound } from './core.mjs';
import { itemMetadata, candidates, rankItems, answerPayload, missedPayload, skillReport } from './learning.mjs';

const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
let clock = Date.parse('2026-10-02T09:00:00Z');
function coach(store = new Map()) {
  return createGame({ gameId: 'blank-slice', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(clock += 60000).toISOString() });
}
const byId = (id) => ITEMS.find((x) => x.id === id);
const play = (g, x, correct) => g.answer(g.present(itemMetadata(x)), correct === null ? missedPayload() : answerPayload(correct));

test('문항 정보: 지도에 있는 읽기 항목·고정 키·한 개 고르기 형식, 엔진 검사 통과', () => {
  const ids = new Set(map.allNodes().map((n) => n.id));
  const keys = new Set();
  for (const x of ITEMS) {
    const m = itemMetadata(x);
    assert.ok(ids.has(m.skillId), m.skillId);
    assert.equal(m.modality, 'reading'); assert.equal(m.responseFormat, 'single-choice'); assert.equal(m.audioRequired, false);
    assert.match(m.itemKey, /^blank-slice\.[a-z]\d\d\.v1$/);
    assert.ok(!keys.has(m.itemKey)); keys.add(m.itemKey);
  }
  assert.doesNotThrow(() => coach().recommend(candidates(ITEMS)));
});

test('실제 엔진: 벤 정답은 혼자 해낸 기록, 놓침은 평가하지 않는다', () => {
  const g = coach();
  assert.equal(play(g, byId('p01'), true).independent, true);
  const miss = play(g, byId('v01'), null);
  assert.notEqual(miss.independent, true, '놓침은 혼자 해낸 기록이 아니다');
  assert.equal(play(g, byId('p02'), false).verdict, 'incorrect');
});

test('실제 엔진: 조사·문형을 거듭 틀리면 다음 판 앞쪽에 조사·문형 문장이 오고, 결과에 다음 연습으로 나온다', () => {
  const g = coach();
  // 같은 난도(1)에서 조사·문형만 세 번 틀리고 낱말은 네 번 혼자 맞힌다
  for (const id of ['p01', 'p02', 'p03']) play(g, byId(id), false);
  for (const id of ['v01', 'v02', 'v03', 'v04']) play(g, byId(id), true);
  const ranked = rankItems(g, ITEMS);
  assert.ok(ranked, '추천을 받는다');
  assert.equal(byId(ranked.order[0]).skill, 'ko.reading.grammar', '조사·문형 문장이 첫 순위');
  assert.match(ranked.reason, /조사|문형/);
  const round = composeRound(ITEMS, { ranked: ranked.order });
  assert.ok(round.filter((x) => x.skill === 'ko.reading.grammar').length >= 6, '다음 판에 조사·문형이 많다');
  const report = skillReport(g.summary());
  assert.equal(report.length, 2);
  assert.equal(report.find((r) => r.id === 'ko.reading.grammar').tone, 'focus');
});

test('결과의 학습 항목은 난도마다 따로 말하고, ‘다음 연습’은 아틀라스가 고른 항목을 따른다', () => {
  const g = coach();
  // 쉬운 조사·문형은 혼자 다 맞히고, 조금 어려운 조사·문형은 아직 한 번도 안 풀었다
  for (const id of ['p01', 'p02', 'p03', 'p04', 'e01', 'e04']) play(g, byId(id), true);
  for (const id of ['v01', 'v02', 'v03']) play(g, byId(id), false);
  const report = skillReport(g.summary(), { focusSkillId: 'ko.reading.grammar' });
  const gram = report.find((r) => r.id === 'ko.reading.grammar'), voc = report.find((r) => r.id === 'ko.reading.vocabulary');
  assert.notEqual(gram.levels.find((l) => l.d === 1).status, 'unseen');
  assert.equal(gram.levels.find((l) => l.d === 2).status, 'unseen');
  assert.match(gram.text, /쉬운 문장: .+ · 조금 어려운 문장: 아직 기록이 적어요/);
  assert.equal(gram.tone, 'focus', '아틀라스가 고른 항목에 다음 연습');
  assert.notEqual(voc.tone, 'focus', '다음 연습은 하나만');
  // 고른 항목이 없으면 상태의 우선순위로(낱말을 거듭 틀렸다)
  assert.equal(skillReport(g.summary()).find((r) => r.id === 'ko.reading.vocabulary').tone, 'focus');
});

test('기록이 반대인 두 학생은 다음 판의 첫 문장 항목이 다르다', () => {
  const a = coach(), b = coach();
  for (const id of ['p01', 'p02', 'p03']) { play(a, byId(id), false); play(b, byId(id), true); }
  for (const id of ['v01', 'v02', 'v03']) { play(a, byId(id), true); play(b, byId(id), false); }
  const ra = rankItems(a, ITEMS), rb = rankItems(b, ITEMS);
  assert.notEqual(byId(ra.order[0]).skill, byId(rb.order[0]).skill);
});

test('아틀라스가 없거나 오류면 null(원고 순서로 진행)', () => {
  assert.equal(rankItems(null, ITEMS), null);
  assert.equal(rankItems({ recommend: () => { throw new Error('x'); } }, ITEMS), null);
});
