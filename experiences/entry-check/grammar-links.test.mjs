import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { VENUES } from './content.mjs';
import { RULE_GRAMMAR, caseMetadata, caseCandidates, answerPayload } from './learning.mjs';

// 손님 문항은 근거 규칙 문장에서 Strata가 읽은 문형에 이어진다(strata/topik-i-forms.js).
const require = createRequire(import.meta.url);
const { grammarIn } = require('../../strata/topik-i-forms.js');
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const rulesOf = (v) => [...v.notice.rules, ...(v.memo ? [v.memo.rule] : [])];

test('문형 연결: 규칙은 Strata가 그 문장에서 읽은 문형, 손님은 근거 규칙들의 문형', () => {
  const rules = VENUES.flatMap((v) => rulesOf(v).map((r) => [`${v.id}.${r.id}`, r.text]));
  assert.deepEqual(Object.keys(RULE_GRAMMAR).sort(), rules.map(([key]) => key).sort());
  for (const [key, text] of rules) assert.deepEqual(RULE_GRAMMAR[key], grammarIn(text), key);
  for (const v of VENUES) for (const c of v.cases) {
    const expected = [...new Set(c.evidence.flatMap((r) => RULE_GRAMMAR[`${v.id}.${r}`]))];
    assert.ok(expected.length, `${c.id}: 근거 규칙에 문형이 있다`);
    assert.deepEqual(caseMetadata(c).conceptIds, expected, c.id);
    for (const x of caseCandidates([c])) assert.deepEqual(x.conceptIds, expected, c.id);
  }
  for (const id of new Set(Object.values(RULE_GRAMMAR).flat())) assert.equal(map.getNode(id)?.kind, 'grammar_point', id);
});

test('문형 연결: 틀린 손님의 문형이 연습할 내용에 나온다', () => {
  let t = Date.parse('2026-10-02T09:00:00Z');
  const store = new Map();
  const coach = createGame({ gameId: 'entry-check', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(t += 60000).toISOString() });
  const chair = VENUES.flatMap((v) => v.cases).find((c) => c.id === 'concert-02');
  coach.answer(coach.present(caseMetadata(chair)), answerPayload(false));
  for (const id of ['G505', 'G402']) {
    const concept = coach.summary().concepts.find((c) => c.id === id);
    assert.ok(concept, `${id}가 틀린 뒤 연습할 내용에 있다`);
    assert.equal(concept.formats['single-choice'].incorrect, 1, id);
  }
});
