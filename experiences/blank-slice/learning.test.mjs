import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { ITEMS } from './content.mjs';
import { composeRound } from './core.mjs';
import { itemMetadata, candidates, rankItems, answerPayload, missedPayload, skillReport, assignmentItems } from './learning.mjs';

const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
// The game's own map: abilities, grammar and the word layer (word items link their word).
const map = createMap(require('../../strata/topik-i.js').topikMap());
let clock = Date.parse('2026-10-02T09:00:00Z');
function coach(store = new Map()) {
  return createGame({ gameId: 'blank-slice', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(clock += 60000).toISOString() });
}
const byId = (id) => ITEMS.find((x) => x.id === id);
const play = (g, x, correct) => g.answer(g.present(itemMetadata(x)), correct === null ? missedPayload() : answerPayload(correct));

test('WORLD 목표는 실제 영역·난도·문항 쌍만 출제하고 순서와 원고를 보존한다', () => {
  const chosen = ITEMS.filter(x => x.skill === 'ko.reading.grammar' && x.difficulty === 2).slice(-3).reverse();
  const target = { skillId: 'ko.reading.grammar', difficulty: 2, modality: 'reading', responseFormat: 'single-choice', items: chosen.map(itemMetadata) };
  const before = JSON.stringify(target);
  assert.deepEqual(assignmentItems(target), chosen);
  assert.equal(JSON.stringify(target), before);
  assert.equal(assignmentItems(null), null, '자유 플레이는 원래 구성 함수를 사용한다');
  const wrong = ['skillId', 'difficulty', 'modality', 'responseFormat', 'itemKey', 'familyKey'];
  for (const key of wrong) {
    const changed = structuredClone(target); changed.items[0][key] = key === 'difficulty' ? 1 : 'wrong';
    assert.deepEqual(assignmentItems(changed), [], `목표 일부만 가능한 경우 전체 시작을 막는다: ${key}`);
  }
  assert.deepEqual(assignmentItems({...target, difficulty:1}), []);
  assert.deepEqual(assignmentItems({...target, items:[...target.items,...target.items]}), chosen, '같은 문항은 두 번 넣지 않는다');
});

test('이전 판을 포함한 WORLD 과제는 남은 한 문항으로 조용히 줄이지 않는다', () => {
  const chosen = ['v06', 'v07', 'v08'].map(byId);
  const items = chosen.map(itemMetadata);
  const target = { ...items[0], items, requiredAttempts: 3 };
  assert.deepEqual(assignmentItems(target), chosen, '현재 판은 모두 출제한다');
  const old = { ...target, items: items.map(m => ({ ...m, itemKey: m.itemKey.replace(/\.v2$/, '.v1') })) };
  assert.deepEqual(assignmentItems(old), [], '현재 남아 있는 v08 하나만 실행하면 과제를 끝낼 수 없다');
  assert.deepEqual(assignmentItems({ ...target, items: items.slice(1) }), [], '목표 수보다 적은 문항도 거절한다');
});

test('문항 정보: 지도에 있는 읽기 항목·고정 키·한 개 고르기 형식, 엔진 검사 통과', () => {
  const ids = new Set(map.allNodes().map((n) => n.id));
  const keys = new Set();
  for (const x of ITEMS) {
    const m = itemMetadata(x);
    assert.ok(ids.has(m.skillId), m.skillId);
    assert.equal(m.modality, 'reading'); assert.equal(m.responseFormat, 'single-choice'); assert.equal(m.audioRequired, false);
    assert.match(m.itemKey, /^blank-slice\.[a-z]\d\d\.v\d+$/);
    assert.equal(m.familyKey, `blank-slice.${x.id}.v1`, '판이 바뀌어도 같은 계열');
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

// 문장·보기·정답이 바뀌면 그 문항의 판(learning.mjs ITEM_VERSION)을 올려야 한다(학습기준 §7-2).
// 판을 올린 뒤 이 표의 판과 지문(앞 12자리 해시)을 함께 바꾼다. 새 문항은 판 1로 더한다.
const CONTENT = {
  p01: [1, '9a2e02d76a1f'],
  v01: [1, '419dd7c4e654'],
  p02: [1, '732294bc6bd9'],
  v02: [1, 'e92a61c59e70'],
  v03: [1, '805c4a52febe'],
  p03: [1, '04ac2df48448'],
  t01: [1, 'a35b8a178121'],
  v04: [1, '5cfb4bd1a300'],
  p04: [1, 'c5f4af41e4a6'],
  v05: [1, '8f7ead7d72d5'],
  p05: [1, '55dbf3f2d14a'],
  v06: [2, '2f890b33070c'],
  v07: [2, 'a0d087d69f1e'],
  v08: [1, '9eb8ebb9959d'],
  g01: [1, '5e125a3d06f0'],
  g02: [1, '8496fc8d2e0d'],
  e01: [2, '57e0ecd478c0'],
  v09: [1, '0fda09b8b43a'],
  v10: [1, 'a987cdd4911c'],
  e02: [1, '20fb95451fd9'],
  v11: [1, 'b223acacf5d5'],
  v12: [1, '2d66771c5832'],
  e03: [1, '6b447533fc37'],
  e04: [1, '2be32abcc22c'],
  v13: [1, '92f293df2e23'],
  e05: [1, '6d79026fa7b5'],
  a01: [1, '7f82e1c50c50'],
  e06: [1, 'b6467f246f68'],
  e07: [1, 'ab79a664326e'],
  e08: [2, '87cb834d5cf4'],
  g03: [1, '05b64b59a857'],
  e09: [1, 'eb2f92057844'],
  e10: [1, '3aad530c9105'],
  a02: [1, '65addaff1ad0'],
  p06: [1, 'a08ef82f408c'],
  v14: [1, 'a18c1c5eedeb'],
};
test('문항 판: 문장·보기·정답을 바꾸면 판이 올라간다', () => {
  const digest = (x) => crypto.createHash('sha256').update(JSON.stringify([x.text, x.options, x.answer])).digest('hex').slice(0, 12);
  assert.deepEqual(Object.keys(CONTENT).sort(), ITEMS.map((x) => x.id).sort(), '새 문항은 이 표에 판 1로 더한다');
  for (const x of ITEMS) {
    const [version, hash] = CONTENT[x.id];
    assert.equal(digest(x), hash, `${x.id}: 내용이 바뀌었으면 ITEM_VERSION에서 판을 올리고 이 표를 고친다`);
    assert.equal(itemMetadata(x).itemKey, `blank-slice.${x.id}.v${version}`, x.id);
  }
});
