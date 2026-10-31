'use strict';
// 응답 형식 'spoken'(드라마 말하기 — 학습자가 말한 대사를 받아 적은 글로 규칙 판정, 2026-10-31).
// Core · Trail · Temper가 이 꼴을 다른 꼴과 섞지 않고 다루는지, 계약 이름과 관찰이 같은 이름을 쓰는지 본다.
const test = require('node:test'), assert = require('node:assert/strict');
const Game = require('../atlas/game-learning'), Learning = require('../atlas/learning'), Trail = require('../atlas/trail');
const Flow = require('../atlas/flow');
const Contract = require('../atlas/member-understanding-contract');
const { memberPracticeObservations } = require('../atlas/trail-member-observations');
const { createMap } = require('../strata');

const SKILL = 'ko.speaking.test';
// 말하기 능력 하나뿐인 작은 지도 — 실제 말하기 지도(strata/maps/ko-speaking.json)는 Strata 시험이 본다.
const map = createMap({ map_ver: 'spoken-test-1', subject: 'ko', sources: { t: { path: 'tests/atlas-spoken.test.js', sha256: '0'.repeat(64) } },
  nodes: [{ id: SKILL, kind: 'skill', label_ko: '말하기 시험', domain: 'speaking', level: null, source_refs: [{ source: 't', selector: 'skill' }] }],
  edges: [], tag_vocabulary: [], links: { tags: [] } });
const DAY = 86400000, ORIGIN = Date.parse('2026-10-01T00:00:00Z');
function fixture() {
  const values = new Map(); let at = ORIGIN;
  const game = Game.createGame({ gameId: 'drama-audit', map, fold: false, followups: true,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, clock: () => new Date(at += 1000).toISOString() });
  const play = (id, { correct = true, responseFormat = 'spoken', assessable = true } = {}) => {
    const pid = game.present({ id, itemKey: id, familyKey: id, skillId: SKILL, modality: 'speaking', difficulty: 1, responseFormat, audioRequired: false });
    return game.answer(pid, { correct, assessable });
  };
  return { game, play, day: n => { at = ORIGIN + n * DAY; } };
}
const formats = f => f.game.summary().skills.find(s => s.id === SKILL).levels[1].formats;

test("'spoken' is its own Core format; Trail accepts it and still refuses unknown names", () => {
  assert.ok(Learning.RESPONSE_FORMATS.includes('spoken'));
  assert.equal(Learning.RESPONSE_FORMATS.at(-1), 'unknown', 'unknown stays the last fallback bucket');
  const f = fixture();
  for (let i = 0; i < 4; i++) f.play(`line.${i}`);
  assert.equal(formats(f).spoken.status, 'recent-independent');
  for (const other of ['binary-choice', 'single-choice', 'cup-compose', 'action', 'unknown']) assert.equal(formats(f)[other].n, 0, other);
  const presented = f.game.events().find(e => e.type === 'practice.presented');
  assert.equal(presented.measure.responseFormat, 'spoken');
  assert.doesNotThrow(() => Trail.validate(presented));
  assert.throws(() => Trail.validate({ ...presented, measure: { ...presented.measure, responseFormat: 'speech' } }), /measurement contract/);
  assert.throws(() => f.game.present({ id: 'x', itemKey: 'x', familyKey: 'x', skillId: SKILL, modality: 'speaking', difficulty: 1, responseFormat: 'speech' }), /invalid measured item/);
});

test('spoken success never steadies another format, and unassessed takes stay unscored', () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) f.play(`scene.${i}`, { correct: null, assessable: false });
  assert.equal(formats(f).spoken.n, 0, 'a scene take judged without confidence is not independent evidence');
  assert.equal(formats(f).spoken.unassessed, 3);
  for (let i = 0; i < 4; i++) f.play(`unseen.${i}`);
  const plan = f.game.recommend([{ id: 'choice', label: 'choice', skillIds: [SKILL], modality: 'speaking', difficulty: 1, responseFormat: 'single-choice' },
    { id: 'spoken', label: 'spoken', skillIds: [SKILL], modality: 'speaking', difficulty: 1, responseFormat: 'spoken' }]);
  assert.equal(plan.selected.id, 'choice', 'the untried format is still unseen');
});

test('a content start can move up from spoken evidence in the spoken format only', () => {
  const spec = { id: 'drama-card', version: 1, target: .8, knobs: [], items: { start: 0, levels: [1, 2, 3] } };
  const f = fixture();
  for (let i = 0; i < 4; i++) f.play(`unseen.${i}`);
  const summary = f.game.summary();
  assert.equal(Flow.priorFromSummary(spec, summary, [SKILL], { responseFormat: 'spoken' })?.level, 2);
  assert.equal(Flow.priorFromSummary(spec, summary, [SKILL], { responseFormat: 'single-choice' }), null);
});

test('Temper anchors a first spoken answer and watches a fresh line a week later', () => {
  const f = fixture();
  const source = f.play('t1', { correct: false });
  f.day(8); // d7 창은 7~10일
  const target = f.play('t2', { correct: true });
  const d7 = f.game.followups().items.find(item => item.window === 'd7' && item.sourceAttemptId === source.eventId);
  assert.ok(d7, 'the spoken source has a d7 window');
  assert.equal(d7.targetAttemptId, target.eventId);
  assert.equal(d7.outcome, 'independent-correct');
  // 'unknown'(꼴을 모르는 시도)은 예전처럼 다시 확인의 출발점이 되지 않는다.
  const g = fixture();
  g.play('u1', { correct: false, responseFormat: 'unknown' });
  assert.equal(g.game.followups().items.length, 0);
});

test("member understanding names 'spoken' and the observation counts it under that name", () => {
  const facet = Contract.understandingFacet('practice-response');
  assert.deepEqual(facet.choices.find(choice => choice.id === 'spoken'), { id: 'spoken', label: '말로 답하기' });
  const f = fixture();
  for (let i = 0; i < 2; i++) f.play(`line.${i}`);
  const events = f.game.events(), asOf = new Date(ORIGIN + DAY).toISOString();
  const summary = Trail.summarize(events, { scope: events.find(e => e.type === 'practice.presented').scope, asOf });
  const observed = memberPracticeObservations({ attempts: summary.attempts, map, asOf });
  assert.deepEqual(observed.formats.map(row => [row.id, row.count]), [['spoken', 2]]);
  assert.ok(observed.formats.every(row => facet.choices.some(choice => choice.id === row.id)), 'every observed format is a contract choice');
});
