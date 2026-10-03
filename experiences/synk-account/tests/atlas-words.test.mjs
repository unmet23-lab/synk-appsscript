// The SYNK ID card's words for Core's account summary, and the practice it picks for declared
// learning reasons: one source for the reason names (the contract), real Strata situations, and a
// line only where a WORLD game practises the reason's situation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { REASON_WORDS, WORLD_GAMES, picksForReasons } from '../src/atlas-words.mjs';

const require = createRequire(import.meta.url);
const contract = require('../../../계약/배우는이유_선택응답_계약.json');
const raw = require('../../../strata/maps/topik-i.json');
const { createMap } = require('../../../strata');
const { summarizeAccount } = require('../../../atlas/account-summary');
const map = createMap(raw);
const forReasons = reasons => summarizeAccount({ events: [], map, asOf: '2026-10-03T12:00:00.000Z', reasons }).forReasons;

test('the card names every learning reason of the contract, and no other', () => {
  assert.deepEqual(Object.keys(REASON_WORDS).sort(), contract.배우는이유.보기.map(option => option.값).sort());
});

test('each WORLD game names only real Strata situations, and the seven games stay listed', () => {
  assert.deepEqual(WORLD_GAMES.map(game => game.path), ['korean-racing', 'korean-runner', 'korean-rhythm', 'order-rush', 'entry-check', 'story-classroom', 'blank-slice']);
  for (const game of WORLD_GAMES) for (const id of game.situations) assert.equal(map.getNode(id)?.kind, 'situation', `${game.path}: ${id}`);
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
