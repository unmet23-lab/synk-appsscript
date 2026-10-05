'use strict';
// strata/topik-i-forms.js: the grammar point a filled blank uses, read from its form.
const test = require('node:test');
const assert = require('node:assert/strict');
const { grammarOf, grammarIn, particleAfter, PARTICLES, ENDING_POINTS, SENTENCE_POINTS } = require('../strata/topik-i-forms');
const grammar = require('../strata/topik-i.grammar.json');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');

test('particles are the forms written in the grammar file, each with one point', () => {
  const expected = [['이', 'G201'], ['가', 'G201'], ['은', 'G202'], ['는', 'G202'], ['을', 'G203'], ['를', 'G203'], ['에', 'G206'], ['에서', 'G207'],
    ['하고', 'G210'], ['와', 'G210'], ['과', 'G210'], ['으로', 'G309'], ['로', 'G309'], ['에게', 'G310'], ['한테', 'G310'], ['보다', 'G312'],
    // The standard 1·2급 particles the bank layer did not have (S points, 2026-10-03).
    ['께서', 'S101'], ['도', 'S102'], ['이랑', 'S103'], ['랑', 'S103'], ['부터', 'S104'], ['까지', 'S105'], ['의', 'S106'], ['만', 'S107'],
    ['께', 'S201'], ['마다', 'S202'], ['밖에', 'S203'], ['처럼', 'S204'], ['에서부터', 'S205'], ['에다가', 'S206'], ['에다', 'S206'],
    ['에게로', 'S207'], ['에게서', 'S208'], ['한테서', 'S209'], ['이나', 'S210'], ['나', 'S210']];
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

// Two no form can tell (-아/어요, a number is read on its own), and the standard points a sentence leaves to
// a blank or a role: -습니다, -(으)시- and the like sit in nearly every sentence, and the 2급 endings are
// not in our games yet.
test('every grammar point is named by a form or a rule, except those no form can tell and the layer-only ones', () => {
  const named = new Set([...PARTICLES.values(), ...ENDING_POINTS, ...SENTENCE_POINTS]);
  assert.deepEqual(grammar.points.map(([id]) => id).filter(id => !named.has(id)), ['G205', 'G212', 'S108', 'S109', 'S110', 'S111', 'S112', 'S113', 'S114',
    'S211', 'S212', 'S213', 'S214', 'S215', 'S216', 'S217', 'S218', 'S219', 'S220', 'S221', 'S222', 'S223', 'S224', 'S225', 'S227']);
  const map = createMap(topikMap());
  for (const id of named) assert.equal(map.getNode(id)?.kind, 'grammar_point', id);
});

test('a whole sentence names its endings and numbers in the order they come', () => {
  const cases = [
    ['수영 모자를 꼭 써야 합니다.', ['G403']],
    ['7살 이하 어린이는 어른과 함께 들어와야 합니다.', ['G212', 'G403']],
    ['음식은 가지고 들어갈 수 없습니다. 음료는 뚜껑이 있으면 괜찮습니다.', ['G402', 'G401']],
    ['관람은 오후 6시까지입니다. 입장은 오후 5시까지만 할 수 있습니다.', ['G212', 'S105', 'S107', 'G402']],
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
    // 편지만 is 만, not -지만.
    ['편지만 가지고 오세요.', ['S107', 'G211']],
  ];
  for (const [sentence, ids] of cases) assert.deepEqual(grammarIn(sentence), ids, sentence);
});

// The standard points a sentence names (2026-10-03): -지 말다 and 이/가 아니다, and 만·까지·부터 after a noun or
// a number, which a rule often turns on. 도, 의 and -습니다 are in nearly every sentence: only a blank names them.
test('a sentence names -지 말다, 이/가 아니다 and the 만·까지·부터 a rule turns on, not the forms in every sentence', () => {
  const cases = [
    ['설탕은 넣지 마세요.', ['S226', 'G211']],
    ['가운데로 가지 말고 오른쪽으로 가세요.', ['S226', 'G211']],
    ['까몽은 종이를 버리지 말고 서랍 안에 넣어 줘.', ['S226']],
    ['마린은 종이를 서랍이 아니라 상자 안에 넣어요.', ['S115']],
    ['약국은 일 층이 아니에요.', ['S115']],
    ['아니, 괜찮아요.', []],
    ['지금부터 음식은 가지고 들어갈 수 없습니다.', ['S104', 'G402']],
    ['어린이 표는 13살 이하만 쓸 수 있습니다.', ['G212', 'S107', 'G402']],
    ['오늘은 숙제를 해야 돼요.', ['G403']],
    ['설탕도 넣어 주세요.', ['G404']],
    ['다른 사람의 카드는 쓸 수 없습니다.', ['G402']],
    ['비가 오지만 가요.', ['G307']],
  ];
  for (const [sentence, ids] of cases) assert.deepEqual(grammarIn(sentence), ids, sentence);
  assert.equal(grammarOf('가지', { after: ' 마세요.' }), 'S226');
  assert.equal(grammarOf('도'), 'S102');
  assert.equal(grammarOf('의'), 'S106');
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

test('forms that only look like another point are not read as it', () => {
  // -겠- before 어요 is no past; a formal question is not -(으)니까; an adverb or a numeral before
  // 주세요 is no verb (found on the situation examples, 2026-10-05).
  const cases = [
    ['잘 모르겠어요.', []],
    ['네, 알겠어요.', []],
    ['재미있겠어요.', []],
    ['벌써 갔겠어요.', ['G208']],
    ['거기에 있었겠어요.', ['G208']],
    ['어제 집에 갔어요.', ['G208']],
    ['교수님, 안녕하십니까?', []],
    ['지금 갑니까?', []],
    ['비가 오니까 우산을 쓰세요.', ['G410', 'G211']],
    ['추우니까 문을 닫으세요.', ['G410', 'G211']],
    ['수건을 더 주세요.', ['G211']],
    ['하나 주세요.', ['G211']],
    ['먼저 주세요.', ['G211']],
    ['다 주세요.', ['G211']],
    ['끝내 주세요.', ['G404']],
    ['사 주세요.', ['G404']],
    ['와 주세요.', ['G404']],
    ['사과 세 개 주세요.', ['G211']],
    ['차 한 대 주세요.', ['G211']],
    ['차를 여기에 대 주세요.', ['G404']],
    ['설탕은 빼 주세요.', ['G404']],
    ['사진 보내 주세요.', ['G404']],
  ];
  for (const [sentence, ids] of cases) assert.deepEqual(grammarIn(sentence), ids, sentence);
  assert.equal(grammarOf('모르겠어요'), null);
  assert.equal(grammarOf('갔어요'), 'G208');
});
