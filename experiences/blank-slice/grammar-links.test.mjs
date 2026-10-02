import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ITEMS } from './content.mjs';
import { GRAMMAR, itemMetadata, candidates } from './learning.mjs';

// 조사·문형 문항은 Strata가 정답 형태로 읽은 문형에 이어진다(strata/topik-i-forms.js).
const require = createRequire(import.meta.url);
const { grammarOf } = require('../../strata/topik-i-forms.js');
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const after = (x) => x.text.slice(x.text.indexOf('{}') + 2);

test('문형 연결: 조사·문형 문항은 Strata가 정답과 빈칸 뒤 말로 읽은 문형, 낱말 문항과 이음말은 연결 없음', () => {
  for (const x of ITEMS) {
    const expected = x.skill === 'ko.reading.grammar' ? grammarOf(x.answer, { after: after(x) }) : null;
    assert.equal(GRAMMAR[x.id] ?? null, expected, x.id);
    assert.deepEqual(itemMetadata(x).conceptIds, expected ? [expected] : [], x.id);
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
