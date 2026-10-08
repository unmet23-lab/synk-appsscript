import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent, importBackup, exportBackup, addFollowup, updateFollowup, saveCarePlan, recordPreparation, updatePreparation, captureSource } from '../model.mjs';

const now = '2026-10-06T03:00:00.000Z';
function fixture() {
  return { ...emptyState(), people: [makePerson({ id: 'p', name: '친구' }), makePerson({ id: 'other', name: '다른 사람' })], events: [makeEvent({ id: 'e', personId: 'p', date: '1990-10-07' })] };
}
const followup = state => addFollowup(state, { personId: 'p', title: '검사 뒤 안부 묻기', dueOn: '2026-10-09' }, now);
const preparation = state => recordPreparation(state, { personId: 'p', eventId: 'e', recommendedAction: 'contact' }, now);

test('이전 v1 백업에 새 기록은 빈 목록으로 추가되고 원문은 그대로 왕복한다', () => {
  const old = fixture(); delete old.followups; delete old.preparations;
  assert.deepEqual(importBackup(old).followups, []);
  let state = followup(importBackup(old)); state = preparation(state);
  assert.deepEqual(importBackup(JSON.stringify(exportBackup(state, now))), state);
  assert.equal(old.followups, undefined);
});

test('후속 챙김은 직접 저장한 날짜와 상태만 바꾸고 기존 상태를 변경하지 않는다', () => {
  const original = fixture(); const added = followup(original); const item = added.followups[0];
  assert.equal(original.followups.length, 0);
  assert.equal(item.status, 'pending');
  const later = updateFollowup(added, item.id, { dueOn: '2026-10-10' }, '2026-10-06T04:00:00Z');
  const done = updateFollowup(later, item.id, { status: 'done' }, '2026-10-10T04:00:00Z');
  assert.equal(done.followups[0].createdAt, now);
  assert.equal(done.followups[0].updatedAt, '2026-10-10T04:00:00.000Z');
  assert.equal(added.followups[0].dueOn, '2026-10-09');
  assert.equal(done.activities.length, 0); // 상태만으로 발송·챙김 실적을 만들지 않는다.
  assert.equal(updateFollowup(done, item.id, { status: 'dismissed' }, '2026-10-11T04:00:00Z').followups[0].status, 'dismissed');
});

test('후속 챙김은 같은 사람의 보관 원문에 정확히 있는 근거만 받는다', () => {
  const state = captureSource(fixture(), { personId: 'p', title: '대화', text: '10월 9일에 검사 결과가 나와요.' }, now);
  const sourceId = state.sources[0].id;
  const input = { personId: 'p', title: '검사 결과 뒤 안부', dueOn: '2026-10-09', sourceId, sourceQuote: '검사 결과가 나와요.' };
  const added = addFollowup(state, input, now);
  assert.equal(added.followups[0].sourceQuote, input.sourceQuote);
  for (const patch of [{ personId: 'other' }, { sourceQuote: '추측한 문장' }, { sourceQuote: '' }, { sourceId: '' }, { sourceId: false }]) assert.throws(() => addFollowup(state, { ...input, ...patch }, now));
  assert.equal(state.followups.length, 0);
});

test('잘못된 후속 날짜·상태·참조·중복·추가필드·시간 역전은 원본을 손상하지 않는다', () => {
  const state = followup(fixture()), original = JSON.stringify(state), row = state.followups[0];
  for (const patch of [{ dueOn: '2026-02-30' }, { status: 'sent' }, { personId: 'absent' }, { title: '' }, { title: '가'.repeat(121) }, { rawAudio: 'extra' }, { updatedAt: '2026-10-05T00:00:00Z' }, { status: undefined }]) {
    assert.throws(() => importBackup({ ...state, followups: [{ ...row, ...patch }] }));
  }
  assert.throws(() => importBackup({ ...state, followups: [row, row] }));
  assert.throws(() => updateFollowup(state, row.id, { personId: 'other' }, now));
  assert.throws(() => updateFollowup(state, 'missing', { status: 'done' }, now));
  assert.equal(JSON.stringify(state), original);
});

test('계획 적용은 연락 완료를 만들지 않고 선택한 일정만 바꾼다', () => {
  const original = fixture();
  const state = saveCarePlan(original, 'e', { action: 'gift', amountWon: 20000, note: '배송비 포함 예산' });
  assert.deepEqual(state.events[0].carePlan, { action: 'gift', amountWon: 20000, note: '배송비 포함 예산' });
  assert.equal(original.events[0].carePlan.action, 'contact');
  assert.equal(state.activities.length + state.completions.length, 0);
  assert.throws(() => saveCarePlan(original, 'absent', { action: 'contact' }));
});

test('준비 기록은 실제 표시·선택·나중의 만족도 시간과 출처를 분리한다', () => {
  const shown = preparation(fixture()), row = shown.preparations[0];
  assert.equal(row.chosenAction, null); assert.equal(row.satisfaction, null);
  const selected = updatePreparation(shown, row.id, { chosenAction: 'remember', elapsedSeconds: 30 }, '2026-10-06T03:01:00Z');
  const rated = updatePreparation(selected, row.id, { satisfaction: 4 }, '2026-10-07T03:00:00Z');
  assert.equal(rated.preparations[0].recommendedAction, 'contact');
  assert.equal(rated.preparations[0].selectedAt, '2026-10-06T03:01:00.000Z');
  assert.equal(rated.preparations[0].satisfactionAt, '2026-10-07T03:00:00.000Z');
  assert.equal(shown.preparations[0].chosenAction, null);
  assert.equal(rated.activities.length + rated.completions.length, 0);
  const withdrawn = updatePreparation(rated, row.id, { satisfaction: null }, '2026-10-08T03:00:00Z');
  assert.equal(withdrawn.preparations[0].satisfactionAt, null);
});

test('준비 표시만으로 만족도를 만들거나 선택을 덮어쓰거나 실제 경과보다 큰 시간을 넣을 수 없다', () => {
  const shown = preparation(fixture()), id = shown.preparations[0].id;
  assert.throws(() => updatePreparation(shown, id, { satisfaction: 5 }, now));
  assert.throws(() => updatePreparation(shown, id, { chosenAction: 'contact', elapsedSeconds: 61 }, '2026-10-06T03:01:00Z'));
  assert.throws(() => updatePreparation(shown, id, { chosenAction: 'contact', elapsedSeconds: 0.5 }, '2026-10-06T03:01:00Z'));
  assert.throws(() => updatePreparation(shown, id, { shownAt: now }, now));
  const selected = updatePreparation(shown, id, { chosenAction: 'contact' }, '2026-10-06T03:01:00Z');
  assert.throws(() => updatePreparation(selected, id, { chosenAction: 'gift' }, '2026-10-06T03:02:00Z'));
  for (const satisfaction of [0, 6, 2.5, '5']) assert.throws(() => updatePreparation(selected, id, { satisfaction }, '2026-10-06T03:02:00Z'));
});

test('준비 기록의 잘못된 사람·일정·행동·시간쌍·추가필드·중복을 백업에서 거부한다', () => {
  const state = preparation(fixture()), row = state.preparations[0];
  for (const patch of [{ personId: 'other' }, { eventId: 'missing' }, { recommendedAction: '' }, { chosenAction: 'sent' }, { chosenAction: 'contact' }, { satisfaction: 5 }, { selectedAt: now }, { elapsedSeconds: 1 }, { unknown: 'extra' }]) assert.throws(() => importBackup({ ...state, preparations: [{ ...row, ...patch }] }));
  assert.throws(() => importBackup({ ...state, preparations: [row, row] }));
  const selected = updatePreparation(state, row.id, { chosenAction: 'contact' }, '2026-10-06T03:01:00Z');
  assert.throws(() => importBackup({ ...selected, preparations: [{ ...selected.preparations[0], satisfaction: 4, satisfactionAt: now }] }));
});

test('새 목록의 개수와 전체 4MiB 상한을 함께 유지한다', () => {
  const state = preparation(followup(fixture()));
  const many = (row, count) => Array.from({ length: count }, (_, index) => ({ ...row, id: `row_${index}` }));
  assert.equal(importBackup({ ...state, followups: many(state.followups[0], 1000), preparations: many(state.preparations[0], 500) }).followups.length, 1000);
  assert.throws(() => importBackup({ ...state, followups: many(state.followups[0], 1001) }), /1,000/);
  assert.throws(() => importBackup({ ...state, preparations: many(state.preparations[0], 501) }), /500/);
  const source = { id: 's', personId: 'p', title: '원문', text: '가'.repeat(5000), kind: 'text', createdAt: now };
  assert.throws(() => importBackup({ ...state, sources: [source], followups: many({ ...state.followups[0], sourceId: 's', sourceQuote: source.text }, 1000) }), /4 MB/);
});
