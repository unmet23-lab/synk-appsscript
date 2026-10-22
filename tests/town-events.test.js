'use strict';
// 싱크타운 사건 계약(세로 조각 설계 §20-1, 시험 §20-10 town-events) — 플레이어가 든 사건에만 관계 칸이 있고, 원문·이름 칸은 없다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule } = require('./lib/town.js');

const relationFields = { participantRole: ['choose'], help: { by: 'player', to: ['cafe-owner'] }, deliveredSegmentIds: ['join.1', 'join.2'],
  canonicalActivityId: 'card.C1', storyFamily: 'cafe-life' };

test('플레이어가 든 사건에만 관계 칸 셋·활동·계열이 있다', async () => {
  const { playerEvent, eventProblem, validEvent } = await townModule('events');
  const base = { id: 'E-1', kind: 'card.resolved', card: 'C1', path: 'player', actors: ['cafe-owner'], place: 'cafe', public: false };
  const event = playerEvent(base, relationFields);
  assert.deepEqual(event.actors, ['cafe-owner', 'player']);
  assert.ok(validEvent(event));
  assert.match(eventProblem({ ...base, path: 'pair', actors: ['cafe-owner', 'workshop-owner'], ...relationFields }), /residents-only/);
  assert.equal(eventProblem({ ...base, path: 'pair', actors: ['cafe-owner', 'workshop-owner'] }), null, '주민끼리 사건은 관계 칸 없이');
  assert.match(eventProblem({ ...event, participantRole: undefined }), /participantRole/);
  assert.match(eventProblem({ ...event, participantRole: ['choose', 'make', 'watch'] }), /participantRole/, '역할은 하나나 둘');
  assert.match(eventProblem({ ...event, storyFamily: 'fishing' }), /family/);
  assert.match(eventProblem({ ...event, help: { by: 'player', to: ['player'] } }), /help/);
  assert.equal(eventProblem({ ...event, help: undefined }), null, '도움이 아니면 help가 없다');
});

test('「그만할래요」로 닫은 장면은 본 차례까지만 남는다', async () => {
  const { shownUpTo, playerEvent } = await townModule('events');
  const segments = ['T1', 'T2', 'T3.sweet-less'];
  assert.deepEqual(shownUpTo(segments, 'T2'), ['T1', 'T2']);
  assert.deepEqual(shownUpTo(segments, 'never'), []);
  const closed = playerEvent({ id: 'E-2', kind: 'scene.closed', actors: ['researcher'] }, { ...relationFields, deliveredSegmentIds: shownUpTo(segments, 'T1') });
  assert.deepEqual(closed.deliveredSegmentIds, ['T1']);
});

test('새 사건 종류는 제 칸을 갖고, 결과를 본 순간은 reaction.delivered 한 줄이다', async () => {
  const { eventProblem, reactionDelivered, KINDS } = await townModule('events');
  assert.equal(eventProblem(reactionDelivered('E-9', 'E-1')), null);
  assert.match(eventProblem({ id: 'E-9', kind: 'reaction.delivered' }), /reaction.delivered/);
  assert.equal(eventProblem({ id: 'E-3', kind: 'feedback.given', completionId: 'E-1', value: 'helpful', canonicalActivityId: 'tea-order' }), null);
  assert.match(eventProblem({ id: 'E-3', kind: 'feedback.given', completionId: 'E-1', value: 'great', canonicalActivityId: 'tea-order' }), /feedback/, 'Atlas의 네 낱말만');
  assert.equal(eventProblem({ id: 'E-4', kind: 'memory.forgotten', npc: 'cafe-owner', target: 'E-1' }), null);
  assert.equal(eventProblem({ id: 'E-5', kind: 'consent.changed', consent: 'evalSignals', state: 'withdrawn', ver: 'town-eval-signals-1' }), null);
  for (const kind of ['item.granted', 'item.transferred', 'item.consumed']) assert.ok(Object.hasOwn(KINDS, kind));
});

test('사건에는 원문·이름·답 칸이 없다', async () => {
  const { eventProblem } = await townModule('events');
  const base = { id: 'E-6', kind: 'card.resolved', actors: ['cafe-owner'] };
  for (const key of ['text', 'line', 'name', 'answer', 'message', 'email']) {
    assert.equal(eventProblem({ ...base, [key]: 'x' }), 'raw words', key);
    assert.equal(eventProblem({ ...base, effects: [{ ref: 'cafe-tray', [key]: 'x' }] }), 'raw words', `${key} 안쪽`);
  }
});
