// The SYNK ID card's words for Core's account summary, and the practice it picks for declared
// learning reasons: one source for the reason names (the contract), real Strata situations, and a
// line only where a WORLD game practises the reason's situation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { REASON_WORDS, WORLD_GAMES, picksForReasons, sentencesForReasons } from '../src/atlas-words.mjs';

const require = createRequire(import.meta.url);
const contract = require('../../../계약/배우는이유_선택응답_계약.json');
const raw = require('../../../strata/maps/topik-i.json');
const { createMap } = require('../../../strata');
const { summarizeAccount } = require('../../../atlas/account-summary');
const map = createMap(raw);
const forReasons = reasons => summarizeAccount({ events: [], map, asOf: '2026-10-03T12:00:00.000Z', reasons }).forReasons;
// As the account server sends it: with Strata's example layer.
const { situationExamples } = require('../../../strata/topik-i-examples');
const layer = situationExamples(map);
const withSentences = reasons => summarizeAccount({ events: [], map, asOf: '2026-10-05T12:00:00.000Z', reasons, examples: layer.examplesFor }).forReasons;

test('the card names every learning reason of the contract, and no other', () => {
  assert.deepEqual(Object.keys(REASON_WORDS).sort(), contract.배우는이유.보기.map(option => option.값).sort());
});

test('each WORLD game names only real Strata situations, and the learning hub and eight games stay listed', () => {
  assert.deepEqual(WORLD_GAMES.map(game => game.path), ['learning-hub', 'korean-racing', 'korean-runner', 'korean-rhythm', 'order-rush', 'entry-check', 'story-classroom', 'blank-slice', 'talk-rally']);
  for (const game of WORLD_GAMES) for (const id of game.situations) assert.equal(map.getNode(id)?.kind, 'situation', `${game.path}: ${id}`);
  // The same games' folders under synk.im/try/ (published there, unlinked).
  assert.deepEqual(WORLD_GAMES.map(game => game.slug), ['learning-hub', 'racing', 'runner', 'rhythm', 'order-rush', 'entry-check', 'story-classroom', 'blank-slice', 'talk-rally']);
  assert.equal(picksForReasons(forReasons(['life']))[0].slug, 'entry-check');
});

test('practice serves as many declared reasons as it can, each game once, with the server\'s line', () => {
  assert.deepEqual(picksForReasons(forReasons(['travel', 'life', 'work'])).map(p => [p.reason, p.game, p.line]), [
    ['travel', 'order-rush', '주문할 때 쓰는 말이라 골랐어요.'],
    ['life', 'entry-check', '안내문을 읽을 때 쓰는 말이라 골랐어요.'],
    ['work', 'korean-runner', '작업 지시를 들을 때 쓰는 말이라 골랐어요.'],
  ], 'travel takes the café so that work can still have the runner');
  assert.deepEqual(picksForReasons(forReasons(['travel'])).map(p => [p.game, p.situation]), [['korean-runner', 'sit-travel-directions']], 'the contract\'s first situation first');
});

test('a reason no game practises gets no line rather than a near match', () => {
  for (const reasons of [['culture'], ['people'], ['study'], ['career'], ['exam'], ['hobby'], ['other'], []]) assert.deepEqual(picksForReasons(forReasons(reasons)), [], reasons.join());
  assert.deepEqual(picksForReasons(undefined), [], 'an older server sends no forReasons');
  assert.deepEqual(picksForReasons([{ reason: 'travel', situations: [{ id: 'sit-travel-order' }] }]), [], 'no line from the server, nothing shown');
});

test('every declared reason with situations shows one sentence, in a place its game does not already cover', () => {
  const said = reasons => { const summary = withSentences(reasons); return sentencesForReasons(summary, picksForReasons(summary)).map(s => [s.reason, s.label, s.ko]); };
  // travel alone: the runner takes 길 묻기, so the sentence shows the next place.
  assert.deepEqual(said(['travel']), [['travel', '주문', '따뜻한 커피 한 잔 주세요.']]);
  // travel with life and work: the café takes 주문, so the sentence is back at the first place.
  assert.deepEqual(said(['travel', 'life', 'work']), [
    ['travel', '길 묻기', '지하철역이 어디예요?'],
    ['life', '주민센터·병원·은행', '주소를 바꾸러 왔어요.'],
    ['work', '안전 표지', '들어가지 마십시오.'],
  ]);
  // A reason no game serves still shows where it leads.
  assert.deepEqual(said(['people', 'culture']), [['people', '안부', '오랜만이에요!'], ['culture', '대사와 가사의 반말·존댓말', '밥 먹었어?']]);
  for (const reasons of [['exam'], ['hobby'], ['other'], []]) assert.deepEqual(said(reasons), [], reasons.join());
});

test('no sentence is shown without one from the server', () => {
  assert.deepEqual(sentencesForReasons(forReasons(['travel', 'people'])), [], 'an older server sends situations without sentences');
  assert.deepEqual(sentencesForReasons(undefined), []);
  assert.deepEqual(sentencesForReasons([{ reason: 'travel', situations: [{ id: 'sit-travel-order', label: '주문', examples: [{ id: 'x', ko: '' }] }] }]), []);
  // The only situation with a sentence is the picked game's: it is shown rather than nothing.
  const one = [{ reason: 'travel', situations: [{ id: 'sit-travel-order', label: '주문', line: '주문할 때 쓰는 말이라 골랐어요.', examples: [{ id: 'ex-travel-order-1', ko: '따뜻한 커피 한 잔 주세요.' }] }] }];
  assert.deepEqual(sentencesForReasons(one, picksForReasons(one)).map(s => s.ko), ['따뜻한 커피 한 잔 주세요.']);
});
