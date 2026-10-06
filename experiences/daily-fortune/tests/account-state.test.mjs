import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, birthProfile, validateState, readingKey, entryKey, saveReading } from '../account-state.mjs';
import { getFortune } from '../core.mjs';
import { getSaju } from '../saju-core.mjs';

const today = '2026-10-06';
const createdAt = '2026-10-06T09:00:00.000Z';
const updatedAt = '2026-10-06T10:00:00.000Z';
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const entry = (number = 1) => ({
  id: uuid(number), mode: 'western', date: today, signId: 'aries', birth: null,
  title: '합성 시험용 제목', action: '짧은 메모 한 줄을 적어 보세요.', note: '', completed: false, createdAt, updatedAt,
});
const populated = () => ({ ...emptyState(), profile: birthProfile('2000-02-29', '08:30', today),
  preferences: { mode: 'western', signId: 'aries' }, entries: [entry()] });

test('빈 계정 상태는 호출마다 독립적이며 허용한 데이터 필드만 가진다', () => {
  const a = emptyState(), b = emptyState();
  a.entries.push(entry());a.preferences.signId = 'aries';
  assert.deepEqual(b, { version: 1, profile: null, preferences: { mode: 'western', signId: null }, entries: [] });
  assert.deepEqual(validateState(b, today), b);
});

test('프로필·별자리 선택·기록의 왕복은 원본을 변경하지 않는 새 상태를 반환한다', () => {
  const original = populated(), copy = validateState(original, today);
  assert.deepEqual(copy, original);
  copy.profile.birthTime = null;copy.entries[0].note = '새 회고';copy.preferences.signId = 'taurus';
  assert.equal(original.profile.birthTime, '08:30');
  assert.equal(original.entries[0].note, '');
  assert.equal(original.preferences.signId, 'aries');
});

test('양력·한국 시간 프로필은 날짜·시각·지원 범위를 엄격하게 검사한다', () => {
  assert.deepEqual(birthProfile('2000-02-29', null, today), { birthDate: '2000-02-29', birthTime: null, calendar: 'solar', timeZone: 'Asia/Seoul' });
  for (const birthDate of ['2001-02-29', '2000-13-01', '1899-12-31', '2026-10-07', '', null]) assert.throws(() => birthProfile(birthDate, null, today));
  for (const birthTime of ['24:00', '08:60', '8:00', '', 830, {}, [], false]) assert.throws(() => birthProfile('2000-01-01', birthTime, today));
});

test('시각처럼 문자열 변환되는 객체도 출생 시간으로 저장하지 않는다', () => {
  assert.throws(() => birthProfile('2000-01-01', { toString: () => '08:30' }, today));
});

test('상태·프로필·선택·기록의 추가 필드나 누락 필드를 거부한다', () => {
  const mutations = [
    state => { state.access_token = 'synthetic-should-never-be-data'; },
    state => { delete state.version; },
    state => { state.profile.fullName = '합성 이름'; },
    state => { state.profile.calendar = 'lunar'; },
    state => { state.profile.timeZone = 'America/New_York'; },
    state => { state.preferences.extra = true; },
    state => { state.preferences.mode = 'unknown'; },
    state => { state.preferences.signId = '__proto__'; },
    state => { state.entries[0].extra = true; },
    state => { delete state.entries[0].completed; },
  ];
  for (const mutate of mutations) { const state = populated();mutate(state);assert.throws(() => validateState(state, today)); }
});

test('기록의 별자리·사주 방식과 날짜·출생 정보가 맞아야 저장된다', () => {
  const sajuEntry = { ...entry(), mode: 'korean', signId: null, birth: birthProfile('2000-01-01', null, today) };
  assert.equal(validateState({ ...emptyState(), entries: [sajuEntry] }, today).entries[0].birth.birthDate, '2000-01-01');
  for (const invalid of [
    { ...entry(), birth: sajuEntry.birth }, { ...entry(), signId: 'unknown' },
    { ...sajuEntry, signId: 'rat' }, { ...sajuEntry, birth: null },
    { ...sajuEntry, date: '1999-12-31' }, { ...sajuEntry, birth: { ...sajuEntry.birth, extra: 'rejected' } },
  ]) assert.throws(() => validateState({ ...emptyState(), entries: [invalid] }, today));
});

test('고유 기록 ID와 정규 UTC 시각 및 수정 순서를 검사한다', () => {
  for (const invalid of [
    { ...entry(), id: 'not-a-uuid' }, { ...entry(), createdAt: '2026-10-06' },
    { ...entry(), updatedAt: '2026-10-06T19:00:00+09:00' }, { ...entry(), updatedAt: '2026-10-06T08:00:00.000Z' },
    { ...entry(), createdAt: '-000001-01-01T00:00:00.000Z' },
    { ...entry(), createdAt: '+010000-01-01T00:00:00.000Z', updatedAt: '+010000-01-01T00:00:00.000Z' },
    { ...entry(), completed: 'false' }, { ...entry(), note: '제어\u0000문자' },
  ]) assert.throws(() => validateState({ ...emptyState(), entries: [invalid] }, today));
  assert.throws(() => validateState({ ...emptyState(), entries: [entry(), entry()] }, today));
});

test('회고의 유니코드 길이·90개 제한·전체 UTF-8 용량을 모두 확인한다', () => {
  const state = { ...emptyState(), entries: [{ ...entry(), note: '😊'.repeat(1000) }] };
  assert.equal(validateState(state, today).entries[0].note, state.entries[0].note);
  assert.throws(() => validateState({ ...state, entries: [{ ...entry(), note: '😊'.repeat(1001) }] }, today));
  const ninety = Array.from({ length: 90 }, (_, index) => entry(index + 1));
  assert.equal(validateState({ ...emptyState(), entries: ninety }, today).entries.length, 90);
  assert.throws(() => validateState({ ...emptyState(), entries: [...ninety, entry(91)] }, today));
  assert.throws(() => validateState({ ...emptyState(), entries: ninety.map(item => ({ ...item, note: '한'.repeat(1000) })) }, today), /용량/);
});

test('같은 읽을거리를 다시 저장하면 ID와 생성 시각을 지키면서 회고·완료를 갱신한다', () => {
  const fortune = getFortune('aries', today, 'western');
  const first = saveReading(emptyState(), fortune, { id: uuid(1), now: createdAt, note: '첫 메모' });
  const second = saveReading(first, fortune, { id: uuid(2), now: updatedAt, note: '짧은 회고', completed: true });
  assert.equal(second.entries.length, 1);
  assert.equal(second.entries[0].id, uuid(1));
  assert.equal(second.entries[0].createdAt, createdAt);
  assert.equal(second.entries[0].updatedAt, updatedAt);
  assert.equal(second.entries[0].completed, true);
  assert.equal(second.entries[0].note, '짧은 회고');
  assert.equal(first.entries[0].note, '첫 메모');
  assert.equal(readingKey(fortune), entryKey(second.entries[0]));
});

test('사주 출생 시간이 바뀌면 기록을 분리하며 시간 모름도 별도 보관한다', () => {
  let state = emptyState();
  for (const [index, birthTime] of ['08:37', '10:37', null].entries()) {
    const result = getSaju({ birthDate: '2005-12-23', birthTime }, today);
    state = saveReading(state, result, { id: uuid(index + 1), now: createdAt });
    assert.equal(entryKey(state.entries[0]), readingKey(result));
  }
  assert.equal(state.entries.length, 3);
  assert.equal(new Set(state.entries.map(entryKey)).size, 3);
  assert.ok(state.entries.every(item => item.signId === null && item.birth));
});
