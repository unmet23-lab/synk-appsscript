'use strict';
// strata/topik-i-forms.js: the grammar point a filled blank uses, read from its form.
const test = require('node:test');
const assert = require('node:assert/strict');
const { grammarOf, grammarIn, particleAfter, PARTICLES, ENDING_POINTS } = require('../strata/topik-i-forms');
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

test('a whole sentence names its endings and numbers in the order they come', () => {
  const cases = [
    ['수영 모자를 꼭 써야 합니다.', ['G403']],
    ['7살 이하 어린이는 어른과 함께 들어와야 합니다.', ['G212', 'G403']],
    ['음식은 가지고 들어갈 수 없습니다. 음료는 뚜껑이 있으면 괜찮습니다.', ['G402', 'G401']],
    ['관람은 오후 6시까지입니다. 입장은 오후 5시까지만 할 수 있습니다.', ['G212', 'G402']],
    ['돗자리는 가지고 와도 됩니다. 의자는 가지고 올 수 없습니다.', ['G505', 'G402']],
    ['여기에서는 사진을 찍으면 안 됩니다.', ['G506']],
    ['꽃을 놓은 뒤, 까몽은 편지를 칠판에 붙여 줘.', ['G406']],
    ['케이크를 놓은 다음, 마린은 리본을 칠판에 붙여 줘.', ['G406']],
    ['밥을 먹은 후에 이를 닦아요.', ['G406']],
    ['학교에 간 다음에 친구를 만나요.', ['G406']],
    ['자기 전에 책을 읽어요.', ['G406']],
    ['내일 친구를 만날 거예요.', ['G302']],
    ['작지만 아주 좋아요.', ['G307']],
  ];
  for (const [sentence, ids] of cases) assert.deepEqual(grammarIn(sentence), ids, sentence);
});

// -아/어 주세요 written with a space is read from the verb before 주세요; a noun before it, a counter or the
// plain 줘 of a story request is not (덜 잇기: a verb that is also a TOPIK I noun, such as 해, is missed).
test('a spaced -아/어 주세요 is read from its verb, and plain 주세요 stays -(으)세요', () => {
  const cases = [
    ['따뜻한 차 한 잔 주세요. 설탕은 빼 주세요.', ['G211', 'G404']],
    ['따뜻한 커피 한 잔 주세요. 설탕도 넣어 주세요.', ['G211', 'G404']],
    ['문을 열어 주세요.', ['G404']],
    ['이름을 써 주세요.', ['G404']],
    ['사과 주세요.', ['G211']],
    ['이거 주세요.', ['G211']],
    ['물 좀 주세요.', ['G211']],
    ['케이크를 칠판 앞에 놓아 줘.', []],
  ];
  for (const [sentence, ids] of cases) assert.deepEqual(grammarIn(sentence), ids, sentence);
});

// A blank is known to hold a form; a word in a sentence may be a noun, a time or a place.
test('a noun, a time or a place in a sentence is not read as an ending', () => {
  const cases = [
    ['친구하고 학교에서 라면을 먹고 집에 가요.', []],
    ['어린이는 달러로 내요.', []],
    ['병원 뒤에 약국이 있어요.', []],
    ['책상 뒤에 가방이 있어요.', []],
    ['동생은 뒤에 앉았어요.', ['G208']],
    ['저는 다음 주에 가요.', []],
    ['다음에 또 오세요.', ['G211']],
    ['전에 서울에 살았어요.', ['G208']],
    ['1시간 후에 만나요.', ['G212']],
    ['한 시간 후에 만나요.', []],
    ['저는 거기에 가요.', []],
    ['편지만 가지고 오세요.', ['G211']],
  ];
  for (const [sentence, ids] of cases) assert.deepEqual(grammarIn(sentence), ids, sentence);
});

test('the particle after a word, through a place noun between them', () => {
  const text = '마린은 과자를 상자 안에 넣어 줘.';
  assert.deepEqual(['마린', '과자', '상자'].map(word => particleAfter(text, word)), ['G202', 'G203', 'G206']);
  assert.equal(particleAfter('이번에는 까몽이 과자를 선반 위에 놓아요.', '까몽'), 'G201');
  assert.equal(particleAfter('까몽은 편지를 칠판에 붙여 줘.', '칠판'), 'G206');
  assert.equal(particleAfter('친구와 같이 가요.', '친구'), 'G210');
  assert.equal(particleAfter('마린은 과자를 상자 안에 넣어 줘.', '서랍'), null);
  assert.equal(particleAfter('과자 하나', '과자'), null);
});
