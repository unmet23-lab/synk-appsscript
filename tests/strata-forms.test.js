'use strict';
// strata/topik-i-forms.js: the grammar point a filled blank uses, read from its form.
const test = require('node:test');
const assert = require('node:assert/strict');
const { grammarOf, PARTICLES, ENDING_POINTS } = require('../strata/topik-i-forms');
const grammar = require('../strata/topik-i.grammar.json');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');

test('particles are the forms written in the grammar file, each with one point', () => {
  const expected = [['이', 'G201'], ['가', 'G201'], ['은', 'G202'], ['는', 'G202'], ['을', 'G203'], ['를', 'G203'], ['에', 'G206'], ['에서', 'G207'],
    ['하고', 'G210'], ['와', 'G210'], ['과', 'G210'], ['으로', 'G309'], ['로', 'G309'], ['에게', 'G310'], ['한테', 'G310'], ['보다', 'G312']];
  for (const [form, id] of expected) assert.equal(grammarOf(form), id, form);
  assert.equal(PARTICLES.size, expected.length);
});

// 못생겼어요 is a past form of 못생기다, not 못 부정: 못 counts only as a word of its own.
test('a filled ending names its point, and the more particular construction wins', () => {
  const cases = [
    ['못 갔어요', '', 'G305'], ['안 했어요', '', 'G209'], ['찍으면', ' 안 돼요.', 'G506'], ['있으면', ' 같이 밥 먹을까요?', 'G401'],
    ['먹어도', ' 돼요?', 'G505'], ['먹을', ' 수 있어요.', 'G402'], ['갈 수 없어요', '', 'G402'], ['가 본', ' 적이 있어요.', 'G509'],
    ['올', ' 것 같아요.', 'G608'], ['도와줄', ' 거예요.', 'G302'], ['잘', ' 때 음악을 들어요.', 'G603'],
    ['후에', ' 친구를 만나요.', 'G406'], ['끝난', ' 후에', 'G406'], ['먹기', ' 전에', 'G406'], ['먹는', ' 것을 좋아해요.', 'G407'],
    ['먹고 싶어요', '', 'G301'], ['읽고', ' 있어요.', 'G409'], ['가려고', ' 해요.', 'G405'], ['가야', ' 해요.', 'G403'],
    ['도와주세요', '', 'G404'], ['먹어 봤어요', '', 'G408'], ['가지', ' 않아요.', 'G304'], ['가지', ' 못했어요.', 'G313'],
    ['보러', ' 극장에 갔어요.', 'G303'], ['먹을까요?', '', 'G311'], ['할게요', '', 'G612'], ['먹을래요', '', 'G612'],
    ['비싸니까', '', 'G410'], ['가는데', '', 'G610'], ['좋은데', '', 'G610'], ['어렵지만', '', 'G307'], ['와서', '', 'G308'],
    ['먹어서', '', 'G308'], ['먹고', ' 자요.', 'G306'], ['예쁘네요', '', 'G411'], ['덥지요?', '', 'G412'], ['타세요', '', 'G211'],
    ['주세요', '', 'G211'], ['학생이에요', '', 'G204'], ['의사예요', '', 'G204'], ['쉬었어요', '', 'G208'], ['갔어요', '', 'G208'], ['못생겼어요', '', 'G208'],
    ['여행하는', ' 동안 고양이에게 밥을 주세요.', 'G501'],
  ];
  for (const [answer, after, id] of cases) assert.equal(grammarOf(answer, { after }), id, `${answer} | ${after}`);
});

test('a conjunction, a plain present ending or a word names no point', () => {
  for (const [answer, after] of [['그래서', ''], ['하지만', ' 재미있어요.'], ['그리고', ''], ['그러니까', ''], ['그런데', ''], ['그러면', ''],
    ['먹어요', ''], ['있어요', ''], ['재미있어요', ''], ['물', '을 마셔요.'], ['', ''], [null, '']]) {
    assert.equal(grammarOf(answer, { after }), null, String(answer));
  }
});

test('every grammar point is named by a form or a rule, except the two no form can tell', () => {
  const named = new Set([...PARTICLES.values(), ...ENDING_POINTS]);
  assert.deepEqual(grammar.points.map(([id]) => id).filter(id => !named.has(id)), ['G205', 'G212']);
  const map = createMap(topikMap());
  for (const id of named) assert.equal(map.getNode(id)?.kind, 'grammar_point', id);
});
