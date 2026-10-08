import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent, captureSource, recordCareAction, importBackup, exportBackup, personTimeline } from '../model.mjs';

const now = new Date('2026-10-06T03:00:00Z');
const person = makePerson({ id: 'p_1', name: '지민', group: 'friend' });
const other = makePerson({ id: 'p_2', name: '서연', group: 'family' });
const event = overrides => makeEvent({ id: 'e_1', personId: person.id, type: 'wedding', date: '2026-10-05', ...overrides });
const state = () => ({ ...emptyState(), people: [person, other], events: [event()] });
const sourceInput = overrides => ({ personId: person.id, title: '지민의 청첩장', kind: 'text', text: '결혼식은 10월 10일이야. 답장은 천천히 해도 괜찮아.', memories: [{ kind: 'preference', text: '답장을 기다리지 않기', sourceQuote: '답장은 천천히 해도 괜찮아.' }], events: [], ...overrides });

test('확인한 원문·근거·기억을 함께 보관하고 입력 상태는 바꾸지 않는다', () => {
  const before = state(); const snapshot = JSON.stringify(before);
  const after = captureSource(before, sourceInput(), now);
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(after.sources.length, 1);
  assert.equal(after.sources[0].text, sourceInput().text);
  assert.equal(after.memories[0].sourceId, after.sources[0].id);
  assert.equal(after.memories[0].personId, person.id);
  assert.equal(after.memories[0].text, '답장을 기다리지 않기');
  assert.equal(after.people[0].recipientPreference.noReplyPressure, false);
  assert.deepEqual(importBackup(exportBackup(after, now)), after);
});

test('원문에 없는 근거를 추가하거나 다른 사람의 근거를 가져오는 백업은 거부한다', () => {
  const before = state();
  assert.throws(() => captureSource(before, sourceInput({ memories: [{ kind: 'memory', text: '가짜 기억', sourceQuote: '원문에는 없는 문장' }] }), now), /근거/u);
  const after = captureSource(before, sourceInput(), now);
  const crossPerson = structuredClone(after); crossPerson.memories[0].personId = other.id;
  assert.throws(() => importBackup(crossPerson), /근거/u);
  const missingSource = structuredClone(after); missingSource.memories[0].sourceId = 'source_missing';
  assert.throws(() => importBackup(missingSource), /근거/u);
  const missingPerson = structuredClone(after); missingPerson.sources[0].personId = 'person_missing';
  assert.throws(() => importBackup(missingPerson), /사람/u);
  assert.equal(before.sources.length, 0);
});

test('기존 일정과 같은 날짜·종류를 다시 가져오면 전체 저장을 취소한다', () => {
  const before = state();
  assert.throws(() => captureSource(before, sourceInput({ events: [event({ id: undefined })] }), now), /이미/u);
  assert.equal(before.sources.length, 0);
  assert.equal(before.events.length, 1);
});

test('하나의 가져오기 안에서도 같은 일정을 두 번 보관하지 않는다', () => {
  const next = { type: 'birthday', date: '2026-10-10' };
  assert.throws(() => captureSource(state(), sourceInput({ events: [next, { ...next }] }), now), /중복|이미|같은/u);
});

test('구버전 백업은 새 기록 배열과 분류·계획 기본값을 안전하게 채운다', () => {
  const legacy = { version: 1, people: [{ id: 'old_person', name: '오래된 수첩' }], events: [{ id: 'old_event', personId: 'old_person', type: 'birthday', date: '1995-01-01' }], completions: [], drafts: [] };
  const restored = importBackup(legacy);
  assert.deepEqual(restored.sources, []); assert.deepEqual(restored.memories, []); assert.deepEqual(restored.activities, []);
  assert.equal(restored.people[0].group, 'other');
  assert.deepEqual(restored.events[0].carePlan, { action: 'contact', amountWon: null, note: '' });
});

test('실제 내역은 준비 예산과 분리되며 주고받은 방향·날짜가 보존된다', () => {
  const data = state(); data.events[0] = event({ carePlan: { action: 'attend', amountWon: 100000, note: '참석 준비' } });
  const recorded = recordCareAction(data, { personId: person.id, eventId: 'e_1', kind: 'money', occurredOn: '2026-10-05', amountWon: 50000, direction: 'received', note: '실제로 받음' }, now);
  assert.equal(recorded.events[0].carePlan.amountWon, 100000);
  assert.equal(recorded.activities[0].amountWon, 50000);
  assert.equal(recorded.activities[0].direction, 'received');
  assert.equal(recorded.activities[0].occurredOn, '2026-10-05');
  assert.equal(recorded.completions.length, 0);
  const timeline = personTimeline(recorded, person.id);
  assert.equal(timeline[0].kind, 'activity');
  assert.equal(timeline[0].activityKind, 'money');
  assert.equal(personTimeline(recorded, other.id).length, 0);
});

test('실제 내역의 잘못된 금액·미래 날짜·다른 사람 일정을 거부한다', () => {
  const input = { personId: person.id, eventId: 'e_1', kind: 'money', occurredOn: '2026-10-06', amountWon: 10000 };
  for (const value of [-1, 1.5, 1000000001, '10000', Infinity]) assert.throws(() => recordCareAction(state(), { ...input, amountWon: value }, now), /금액/u);
  for (const value of [-1, 1.5, 1000000001, '10000']) assert.throws(() => event({ carePlan: { amountWon: value } }), /금액/u);
  assert.throws(() => recordCareAction(state(), { ...input, occurredOn: '2026-10-07' }, now), /오늘|미래/u);
  assert.throws(() => recordCareAction(state(), { ...input, personId: other.id }, now), /사람/u);
  assert.throws(() => recordCareAction(state(), { ...input, eventId: 'event_missing' }, now), /일정/u);
  assert.equal(recordCareAction(state(), { ...input, eventId: '', amountWon: 0 }, now).activities[0].amountWon, 0);
});

test('백업에서도 기록한 시점보다 미래인 실행 내역은 거부한다', () => {
  const recorded = recordCareAction(state(), { personId: person.id, kind: 'contact', occurredOn: '2026-10-06' }, now);
  const tampered = structuredClone(recorded); tampered.activities[0].occurredOn = '2026-10-07';
  assert.throws(() => importBackup(tampered), /날짜|미래|시점|오늘/u);
});

test('명시적으로 보관한 녹취 글은 남기고 알려지지 않은 음성 바이트는 버린다', () => {
  const recorded = captureSource(state(), sourceInput({ kind: 'transcript', audioBase64: 'DO_NOT_STORE', audioBytes: [1, 2, 3] }), now);
  recorded.audioBase64 = 'DO_NOT_STORE'; recorded.sources[0].audioBase64 = 'DO_NOT_STORE'; recorded.people[0].audio = 'DO_NOT_STORE';
  const serialized = JSON.stringify(exportBackup(recorded, now));
  assert.ok(serialized.includes('답장은 천천히'));
  assert.ok(serialized.includes('transcript'));
  assert.ok(!serialized.includes('DO_NOT_STORE'));
  assert.ok(!serialized.includes('audioBase64'));
});
