import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAlbum, isQuestionRef, skipQuestion, setStoryteller, upsertPage, validateAlbum } from '../model.mjs';
import { TOPICS, QUESTION_BANK, PHOTO_STARTERS, SKIP_HINT, questionById, fillQuestion, nextQuestion, topicMap, topicQuestions, pageFromAnswer, answerQuestion, voiceOnlyStory } from '../questions.mjs';

const at = '2026-10-14T00:00:00.000Z';
const mother = { name: '김순자', relation: 'mother', callName: '어머니', birthYear: 1942, hometown: '강릉' };
const father = { name: '박영수', relation: 'father', callName: '아버지', birthYear: 1975, hometown: '' };
const self = { name: '나', relation: 'self', callName: '', birthYear: 1990, hometown: '' };
const albumOf = (storyteller, pages = []) => validateAlbum({ ...emptyAlbum(), ...(storyteller ? { storyteller } : {}), pages });
const deepFreeze = value => { for (const item of Object.values(value)) if (item && typeof item === 'object') deepFreeze(item); return Object.freeze(value); };
let seq = 0;
const answer = (album, questionId, extra = {}) => answerQuestion(album, { question: questionId, text: '그때 이야기를 직접 들려주셨다.', author: '딸', id: `answer-${++seq}`, at, ...extra });

test('bank covers at least 12 Korean family topics with 8+ open questions each and 100+ in total', () => {
  assert.ok(TOPICS.length >= 12);
  assert.ok(QUESTION_BANK.length >= 100, `${QUESTION_BANK.length} questions`);
  for (const topic of TOPICS) assert.ok(QUESTION_BANK.filter(q => q.topic === topic.id).length >= 8, topic.id);
  for (const required of ['hometown', 'school', 'war', 'military', 'work', 'marriage', 'parenting', 'home', 'hard-times', 'holidays', 'kitchen', 'legacy']) assert.ok(TOPICS.some(t => t.id === required), required);
  assert.ok(QUESTION_BANK.some(q => q.topic === 'parenting' && /이름/.test(q.text)), 'children naming question');
  assert.ok(QUESTION_BANK.some(q => q.topic === 'hard-times' && /IMF/.test(q.text)), 'IMF question');
  assert.ok(QUESTION_BANK.some(q => q.topic === 'holidays' && /김장/.test(q.text)) && QUESTION_BANK.some(q => q.topic === 'holidays' && /제사/.test(q.text)));
  assert.equal(TOPICS.find(t => t.id === 'kitchen').recipe, true);
  assert.ok(QUESTION_BANK.filter(q => q.topic === 'kitchen').every(q => q.recipe), 'kitchen answers lead to recipe pages');
});

test('every question is a well-formed, polite, non-duplicated open question', () => {
  const ids = new Set(), texts = new Set();
  for (const q of QUESTION_BANK) {
    assert.ok(isQuestionRef(q.id), q.id);
    assert.ok(!ids.has(q.id), `duplicate id ${q.id}`); ids.add(q.id);
    assert.ok(!texts.has(q.text), `duplicate text ${q.id}`); texts.add(q.text);
    assert.ok(TOPICS.some(t => t.id === q.topic), q.id);
    assert.ok(isQuestionRef(q.group), q.id);
    assert.ok(typeof q.title === 'string' && q.title.length >= 2 && q.title.length <= 30, q.id);
    assert.ok(q.text.includes('?'), `${q.id} asks a question`);
    assert.match(q.text, /[?.]$/u, q.id);
    assert.match(q.text, /요[?.]/u, `${q.id} uses polite speech`);
    assert.doesNotMatch(q.text, /당신|무엇인가요|입니까|하십니까|에 대해|어떠한|있나요\?$/u, `${q.id} avoids translated phrasing`);
    for (const placeholder of q.text.match(/\{[^}]*\}/gu) ?? []) assert.ok(['{호칭}', '{고향}', '{배우자}'].includes(placeholder), `${q.id} ${placeholder}`);
    if (q.text.includes('{호칭}')) assert.match(q.text, /\{호칭\}(, | )/u, `${q.id} placeholder can be dropped cleanly`);
    for (const item of q.followups ?? []) assert.ok(typeof item === 'string' && item.includes('?'), q.id);
    if (q.photoPrompt) assert.ok(q.photoPrompt.includes('?'), q.id);
    if (q.needsBornBefore) assert.ok(Number.isInteger(q.needsBornBefore) && q.needsBornBefore > 1900, q.id);
    assert.ok(Object.isFrozen(q));
  }
  // A shared group joins related questions across topics, never paraphrases inside one topic.
  const groups = new Map();
  for (const q of QUESTION_BANK) { if (!groups.has(q.group)) groups.set(q.group, []); groups.get(q.group).push(q); }
  for (const [group, list] of groups) if (list.length > 1) assert.equal(new Set(list.map(q => q.topic)).size, list.length, group);
  assert.ok([...groups.values()].some(list => list.length > 1), 'cross-topic groups exist');
  assert.ok(QUESTION_BANK.filter(q => q.photoPrompt).length >= 12);
  assert.equal(PHOTO_STARTERS.length, 3);
});

test('war memories are age-gated and sensitive; unknown birth year never gets them', () => {
  const war = QUESTION_BANK.filter(q => q.topic === 'war');
  assert.ok(war.every(q => q.needsBornBefore && q.sensitive));
  assert.ok(war.some(q => q.needsBornBefore === 1946));
  for (const [teller, expectWar] of [[mother, true], [{ ...mother, birthYear: 1980 }, false], [{ ...mother, birthYear: null }, false], [null, false]]) {
    let album = albumOf(teller), sawWar = false, sawImf = false;
    for (let q = nextQuestion({ album }); q; q = nextQuestion({ album })) {
      if (q.topic === 'war') sawWar = true;
      if (q.id === 'hard-imf') sawImf = true;
      album = skipQuestion(album, q.id);
    }
    assert.equal(sawWar, expectWar, JSON.stringify(teller));
    assert.equal(sawImf, Boolean(teller?.birthYear && teller.birthYear < 1980));
    assert.equal(nextQuestion({ album: albumOf(teller), topic: 'war' }) === null, !expectWar);
  }
  const born1960 = topicQuestions({ storyteller: { ...mother, birthYear: 1960 }, topic: 'war' }).map(q => q.id);
  assert.deepEqual(born1960, ['war-heard'], 'later generations only get stories they heard');
  const map = topicMap(albumOf({ ...mother, birthYear: 1985 }));
  assert.equal(map.topics.find(t => t.id === 'war').available, false);
  assert.ok(!map.empty.includes('war'));
});

test('military life is not asked of mothers and grandmothers, who still get the send-off question', () => {
  const asked = topicQuestions({ storyteller: mother, topic: 'military' }).map(q => q.id);
  assert.ok(!asked.includes('military-enlist') && asked.includes('military-sendoff'));
  assert.equal(nextQuestion({ album: albumOf(mother), topic: 'military' }).id, 'military-sendoff');
  assert.equal(nextQuestion({ album: albumOf(father), topic: 'military' }).id, 'military-enlist');
});

test('answering until the bank runs out never repeats a meaning group', () => {
  for (const teller of [mother, father, self]) {
    let album = albumOf(teller); const seenGroups = new Set(); let count = 0;
    for (let q = nextQuestion({ album }); q; q = nextQuestion({ album })) {
      assert.ok(!seenGroups.has(q.group), `${q.id} repeats ${q.group}`);
      seenGroups.add(q.group);
      // Keep within the 30-page album limit: drop the oldest answer but keep its id skipped.
      album = answer(album, q.id);
      if (album.pages.length > 25) album = skipQuestion({ ...album, pages: album.pages.slice(0, -1) }, album.pages.at(-1).questionId);
      count++;
    }
    assert.equal(count, topicMap(album).total, `${teller.relation} asked every eligible group exactly once`);
    assert.ok(topicMap(album).topics.every(t => !t.available || t.complete));
  }
});

test('a skipped question closes its group, including the related question in another topic', () => {
  let album = albumOf(mother);
  album = skipQuestion(album, 'war-meals');
  album = answer(album, 'hard-helper');
  const asked = [];
  for (let q = nextQuestion({ album }); q; q = nextQuestion({ album })) { asked.push(q.id); album = skipQuestion(album, q.id); }
  for (const id of ['war-meals', 'hard-hungry', 'hard-helper', 'war-helpers']) assert.ok(!asked.includes(id), id);
  const statuses = Object.fromEntries(topicQuestions({ album, topic: 'hard-times' }).map(q => [q.id, q.status]));
  assert.equal(statuses['hard-hungry'], 'skipped');
  assert.equal(statuses['hard-helper'], 'answered');
  assert.equal(Object.fromEntries(topicQuestions({ album, topic: 'war' }).map(q => [q.id, q.status]))['war-helpers'], 'covered');
});

test('selection is deterministic, does not mutate the album and fills the least covered topic first', () => {
  const album = deepFreeze(albumOf(mother));
  const first = nextQuestion({ album });
  assert.deepEqual(nextQuestion({ album }), first);
  assert.deepEqual(nextQuestion({ album: structuredClone(album), storyteller: mother }), first);
  assert.equal(first.id, 'hometown-village');
  assert.equal(first.text, '어머니, 태어나신 동네는 어떤 곳이었어요? 눈 감으면 제일 먼저 떠오르는 풍경이 있으세요?');
  const afterOne = answer(album, first.id);
  assert.notEqual(nextQuestion({ album: afterOne }).topic, 'hometown');
  // Topics whose next question is heavy wait until the light ones had a turn.
  const order = []; let current = albumOf(mother);
  for (let i = 0; i < TOPICS.length; i++) { const q = nextQuestion({ album: current }); order.push(q.topic); current = answer(current, q.id); }
  assert.equal(new Set(order).size, TOPICS.length, 'one question per topic in the first round');
  assert.equal(order.at(-1), 'war');
  assert.ok(order.slice(0, 5).every(topic => !QUESTION_BANK.find(q => q.topic === topic).sensitive));
});

test('「다른 질문」 excludes shown questions and, without a topic, moves to another topic', () => {
  const album = albumOf(mother);
  const first = nextQuestion({ album });
  const other = nextQuestion({ album, exclude: [first.id] });
  assert.notEqual(other.id, first.id);
  assert.notEqual(other.topic, first.topic);
  assert.deepEqual(nextQuestion({ album, exclude: [first.id] }), other, 'still deterministic');
  const sameTopic = nextQuestion({ album, topic: 'kitchen' });
  const nextInTopic = nextQuestion({ album, topic: 'kitchen', exclude: [sameTopic.id] });
  assert.equal(nextInTopic.topic, 'kitchen');
  assert.notEqual(nextInTopic.id, sameTopic.id);
  assert.equal(nextInTopic.recipe, true);
  assert.equal(nextQuestion({ album, exclude: ['retired-question', 42, null] }).id, first.id, 'unknown ids are ignored');
  const all = QUESTION_BANK.filter(q => q.topic === 'legacy').map(q => q.id);
  assert.equal(nextQuestion({ album, topic: 'legacy', exclude: all }), null);
  assert.throws(() => nextQuestion({ album, topic: 'unknown' }));
});

test('sensitive questions carry the skip hint and come after gentle ones inside a topic', () => {
  const list = topicQuestions({ storyteller: mother, topic: 'hard-times' });
  const first = nextQuestion({ album: albumOf(mother), topic: 'hard-times' });
  assert.equal(first.sensitive, false);
  const heavy = list.find(q => q.sensitive);
  assert.equal(heavy.skipHint, SKIP_HINT);
  assert.equal(SKIP_HINT, '건너뛰어도 괜찮아요');
  assert.equal(list.find(q => !q.sensitive).skipHint, null);
});

test('photo start offers only questions with a photo prompt, filled for the storyteller', () => {
  let album = albumOf(mother); const seen = [];
  for (let q = nextQuestion({ album, withPhoto: true }); q; q = nextQuestion({ album, withPhoto: true })) {
    assert.ok(q.photoPrompt && q.photoPrompt.includes('?'), q.id);
    assert.ok(!/\{/.test(q.photoPrompt));
    seen.push(q.id); album = skipQuestion(album, q.id);
  }
  assert.equal(seen.length, QUESTION_BANK.filter(q => q.photoPrompt && !q.skipRelations?.includes('mother')).length);
});

test('fillQuestion places call name, hometown and spouse word without leaving placeholders', () => {
  const village = questionById('hometown-village').text;
  assert.equal(fillQuestion(village, mother).startsWith('어머니, 태어나신'), true);
  assert.equal(fillQuestion(village, self).startsWith('태어나신'), true, 'own story drops the vocative');
  assert.equal(fillQuestion(village, { ...mother, callName: '' }).startsWith('어머니, '), true, 'relation default call name');
  assert.equal(fillQuestion(village, { name: '김영희', relation: 'other', callName: '', birthYear: null, hometown: '' }).startsWith('태어나신'), true);
  assert.equal(fillQuestion(village, { name: '김영희', relation: 'other', callName: '이모', birthYear: null, hometown: '' }).startsWith('이모, 태어나신'), true);
  assert.equal(fillQuestion(questionById('roots-own-name').text, mother).startsWith('어머니 이름은'), true);
  assert.equal(fillQuestion(questionById('roots-own-name').text, null).startsWith('이름은'), true);
  assert.equal(fillQuestion(questionById('hometown-longing').text, mother).startsWith('강릉에서'), true);
  assert.equal(fillQuestion(questionById('hometown-longing').text, self).startsWith('고향에서'), true);
  assert.equal(fillQuestion(questionById('marriage-meeting').text, mother).startsWith('아버지하고는'), true);
  assert.equal(fillQuestion(questionById('marriage-meeting').text, father).startsWith('어머니하고는'), true);
  assert.equal(fillQuestion(questionById('marriage-meeting').text, self).startsWith('배우자분하고는'), true);
  assert.equal(fillQuestion('{호칭}, 괜찮으세요?', { ...mother, callName: '엄마 $& $1' }), '엄마 $& $1, 괜찮으세요?', 'call name is inserted literally');
  for (const teller of [mother, father, self, null, { name: 'x', relation: 'other', callName: '큰아버지', birthYear: null, hometown: '경북 안동' }]) {
    for (const q of QUESTION_BANK) for (const value of [q.text, q.photoPrompt, ...(q.followups ?? [])].filter(Boolean)) {
      const filled = fillQuestion(value, teller);
      assert.doesNotMatch(filled, /[{}]|\s{2}|^[\s,]/u, `${q.id}: ${filled}`);
    }
  }
});

test('topicMap reports answered, skipped and empty topics per meaning group', () => {
  let album = albumOf(mother);
  const empty = topicMap(album);
  assert.equal(empty.answered, 0);
  assert.equal(empty.empty.length, TOPICS.length);
  assert.equal(empty.topics.find(t => t.id === 'military').total, QUESTION_BANK.filter(q => q.topic === 'military').length - 4);
  album = answer(album, 'kitchen-signature');
  album = answer(album, 'war-meals');
  album = skipQuestion(album, 'kitchen-mishap');
  const map = topicMap(album);
  const kitchen = map.topics.find(t => t.id === 'kitchen'), hard = map.topics.find(t => t.id === 'hard-times');
  assert.deepEqual({ answered: kitchen.answered, skipped: kitchen.skipped, covered: kitchen.covered, remaining: kitchen.remaining }, { answered: 1, skipped: 1, covered: 2, remaining: kitchen.total - 2 });
  assert.equal(hard.answered, 0);
  assert.equal(hard.covered, 1, 'hungry-times was answered under war');
  assert.ok(map.empty.includes('hard-times') && !map.empty.includes('kitchen') && !map.empty.includes('war'));
  assert.equal(map.answered, 2);
  assert.equal(topicMap(album, null).topics.find(t => t.id === 'war').total, 1, 'answered war page still counts without a birth year');
});

test('retired or unknown question ids in an album are ignored rather than breaking selection', () => {
  const album = validateAlbum({ ...emptyAlbum(), skippedQuestions: ['retired-one'], pages: [{ id: 'p1', title: '옛 질문', date: '', person: '', author: '나', story: '예전 질문에 답했다.', photo: null, audio: null, details: {}, skipped: [], contributions: [], createdAt: at, updatedAt: at, questionId: 'retired-two' }] });
  assert.equal(nextQuestion({ album, storyteller: mother }).id, 'hometown-village');
  assert.equal(topicMap(album, mother).answered, 0);
});

test('pageFromAnswer builds a valid page linked to the question from text or voice', () => {
  const page = pageFromAnswer({ question: nextQuestion({ album: albumOf(mother) }), storyteller: mother, text: '  강릉 바닷가 마을이었지.  ', date: '1950-05-01', id: 'p-1', at });
  assert.deepEqual(page, { id: 'p-1', title: '태어난 동네', date: '1950-05-01', person: '', author: '김순자', story: '강릉 바닷가 마을이었지.', photo: null, audio: null, details: {}, skipped: [], contributions: [], createdAt: at, updatedAt: at, questionId: 'hometown-village' });
  const wav = Buffer.alloc(80); wav.write('RIFF'); wav.write('WAVE', 8);
  const audio = { name: '어머니 목소리.wav', type: 'audio/wav', data: `data:audio/wav;base64,${wav.toString('base64')}` };
  const voice = pageFromAnswer({ question: 'kitchen-measure', storyteller: mother, audio, id: 'p-2', at, title: '된장찌개 간', author: '딸' });
  assert.equal(voice.story, voiceOnlyStory('kitchen-measure', mother));
  assert.match(voice.story, /^「“대충”, “적당히” 넣는다는 양념은 실제로 얼마쯤이에요\? 숟가락으로 치면요\?」에 목소리로 답한 이야기예요\.$/u);
  assert.equal(voice.author, '딸');
  assert.deepEqual(voice.audio, audio);
  assert.throws(() => pageFromAnswer({ question: 'kitchen-measure', storyteller: mother, text: '   ' }), /녹음하거나 글로/);
  assert.throws(() => pageFromAnswer({ question: 'retired', storyteller: mother, text: '답' }), /질문/);
  assert.throws(() => pageFromAnswer({ question: 'kitchen-measure', storyteller: null, text: '답' }), /이름/);
  assert.throws(() => pageFromAnswer({ question: 'kitchen-measure', storyteller: mother, text: '답', date: '1950-02-30' }));
  const album = answerQuestion(setStoryteller(emptyAlbum(), mother), { question: 'kitchen-measure', text: '한 숟가락 반', id: 'p-3', at });
  assert.equal(album.pages[0].questionId, 'kitchen-measure');
  assert.equal(album.pages[0].author, '김순자');
  assert.deepEqual(upsertPage(album, { ...album.pages[0], story: '두 숟가락' }).pages[0].questionId, 'kitchen-measure', 'editing keeps the question link');
});
