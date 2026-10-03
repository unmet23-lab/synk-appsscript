import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ORDERS, REVIEW } from './core.mjs';
import { ORDER_GRAMMAR, orderMetadata, orderCandidates } from './learning.mjs';

// 주문은 그 문장에서 Strata가 읽은 문형에 이어진다(strata/topik-i-forms.js grammarIn).
const require = createRequire(import.meta.url);
const { grammarIn } = require('../../strata/topik-i-forms.js');
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const ALL = [...ORDERS, ...REVIEW];

test('문형 연결: 주문 문장은 Strata가 읽은 문형, 후보도 같은 문형', () => {
  assert.deepEqual(Object.keys(ORDER_GRAMMAR).sort(), ALL.map((o) => o.id).sort());
  for (const o of ALL) {
    assert.deepEqual(ORDER_GRAMMAR[o.id], grammarIn(o.text), o.id);
    assert.deepEqual(orderMetadata(o).conceptIds, grammarIn(o.text), o.id);
    for (const c of orderCandidates([o])) assert.deepEqual(c.conceptIds, grammarIn(o.text), o.id);
  }
  for (const id of new Set(Object.values(ORDER_GRAMMAR).flat())) assert.equal(map.getNode(id)?.kind, 'grammar_point', id);
  assert.ok(ALL.some((o) => ORDER_GRAMMAR[o.id].includes('G404')) && ALL.some((o) => !ORDER_GRAMMAR[o.id].includes('G404')), '빼기·넣기 요청만 -아/어 주세요');
});

test('문형 연결: 빼기 요청을 놓치면 -아/어 주세요가 연습할 내용에 나온다', () => {
  let t = Date.parse('2026-10-03T09:00:00Z');
  const store = new Map();
  const coach = createGame({ gameId: 'order-rush', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(t += 60000).toISOString() });
  const pid = coach.present(orderMetadata(ALL.find((o) => o.id === 'o03')));
  coach.delivery(pid, { audio: 'completed' });
  coach.answer(pid, { correct: false, assessable: true });
  const concept = coach.summary().concepts.find((c) => c.id === 'G404');
  assert.ok(concept, '-아/어 주세요가 틀린 뒤 연습할 내용에 있다');
  assert.equal(concept.formats['cup-compose'].incorrect, 1);
});
