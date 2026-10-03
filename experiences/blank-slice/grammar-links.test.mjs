import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ITEMS } from './content.mjs';
import { GRAMMAR, WORD, itemMetadata, candidates } from './learning.mjs';

// 조사·문형 문항은 Strata가 정답 형태로 읽은 문형에 이어진다(strata/topik-i-forms.js).
const require = createRequire(import.meta.url);
const { grammarOf } = require('../../strata/topik-i-forms.js');
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const after = (x) => x.text.slice(x.text.indexOf('{}') + 2);

test('문형 연결: 조사·문형 문항은 Strata가 정답과 빈칸 뒤 말로 읽은 문형, 이음말은 연결 없음, 낱말 문항은 낱말', () => {
  for (const x of ITEMS) {
    const expected = x.skill === 'ko.reading.grammar' ? grammarOf(x.answer, { after: after(x) }) : null;
    assert.equal(GRAMMAR[x.id] ?? null, expected, x.id);
    const concepts = expected ? [expected] : x.skill === 'ko.reading.vocabulary' ? [`ko.word.${WORD[x.id]}`] : [];
    assert.deepEqual(itemMetadata(x).conceptIds, concepts, x.id);
  }
  assert.equal(Object.keys(GRAMMAR).length, 18);
  for (const id of Object.values(GRAMMAR)) assert.equal(map.getNode(id)?.kind, 'grammar_point', id);
  for (const c of candidates(ITEMS)) assert.deepEqual(c.conceptIds, itemMetadata(ITEMS.find((x) => x.id === c.itemId)).conceptIds);
});

test('문형 연결: 틀린 조사 문항의 문형이 연습할 내용에 나온다', () => {
  let t = Date.parse('2026-10-02T09:00:00Z');
  const store = new Map();
  const coach = createGame({ gameId: 'blank-slice', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(t += 60000).toISOString() });
  coach.answer(coach.present(itemMetadata(ITEMS.find((x) => x.id === 'p02'))), { correct: false, assessable: true });
  const concept = coach.summary().concepts.find((c) => c.id === 'G207');
  assert.ok(concept, 'G207(에서)가 틀린 뒤 연습할 내용에 있다');
  assert.equal(concept.formats['single-choice'].incorrect, 1);
});

// 낱말 문항은 정답 낱말의 기본형에 이어진다(strata/topik-i.words.json). 활용형은 기본형으로.
const LEMMA = { v01: '물', v02: '입다', v03: '개', v04: '비싸다', v05: '병원', v06: '우산', v07: '운동하다', v08: '맵다', v09: '잔', v10: '우체국',
  v11: '생일', v12: '조용히', v13: '작다', a02: '열심히', v14: '사다' };
test('낱말 연결: 낱말 문항마다 정답의 기본형, 틀리면 그 낱말이 연습할 내용에 나온다', () => {
  const { topikMap } = require('../../strata/topik-i.js');
  const words = createMap(topikMap());
  const vocabulary = ITEMS.filter((x) => x.skill === 'ko.reading.vocabulary');
  assert.deepEqual(Object.keys(WORD).sort(), vocabulary.map((x) => x.id).sort());
  for (const x of vocabulary) {
    const node = words.getNode(`ko.word.${WORD[x.id]}`);
    assert.equal(node?.kind, 'word', x.id);
    assert.equal(node.label_ko, LEMMA[x.id], `${x.id}: ${x.answer}`);
  }
  let t = Date.parse('2026-10-03T09:00:00Z');
  const store = new Map();
  const coach = createGame({ gameId: 'blank-slice', map: words, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(t += 60000).toISOString() });
  coach.answer(coach.present(itemMetadata(ITEMS.find((x) => x.id === 'v06'))), { correct: false, assessable: true });
  const concept = coach.summary().concepts.find((c) => c.id === `ko.word.${WORD.v06}`);
  assert.ok(concept, '우산이 틀린 뒤 연습할 내용에 있다');
  assert.equal(concept.kind, 'word');
});
