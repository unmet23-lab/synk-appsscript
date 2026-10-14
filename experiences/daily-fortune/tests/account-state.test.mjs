import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, birthProfile, validateState, readingKey, entryKey, saveReading, setVerdict, savePerson, removePerson,
  STATE_VERSION, MAX_PEOPLE, VERDICTS, RELATIONS,
} from '../account-state.mjs';
import { getFortune } from '../core.mjs';
import { getSaju } from '../saju-core.mjs';
import { getDailyCard } from '../daily.mjs';

const today = '2026-10-06';
const createdAt = '2026-10-06T09:00:00.000Z';
const updatedAt = '2026-10-06T10:00:00.000Z';
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const personId = number => `11111111-1111-4111-8111-${String(number).padStart(12, '0')}`;
const entry = (number = 1) => ({
  id: uuid(number), mode: 'western', date: today, signId: 'aries', birth: null,
  title: '합성 시험용 제목', action: '짧은 메모 한 줄을 적어 보세요.', note: '', completed: false, verdict: null, createdAt, updatedAt,
});
const person = (number = 1, values = {}) => ({
  id: personId(number), name: `합성 친구 ${number}`, relation: 'friend', birthDate: '1995-03-04', birthTime: null, ...values,
});
const populated = () => ({ ...emptyState(), profile: birthProfile('2000-02-29', '08:30', today),
  preferences: { mode: 'western', signId: 'aries' }, entries: [entry()], people: [person()] });
const v1Document = (entries = [entry()]) => ({ version: 1, profile: birthProfile('2000-02-29', '08:30', today),
  preferences: { mode: 'korean', signId: 'leo' }, entries: entries.map(({ verdict, ...item }) => item) });

test('빈 계정 상태는 v2이며 호출마다 독립적이고 허용한 데이터 필드만 가진다', () => {
  const a = emptyState(), b = emptyState();
  a.entries.push(entry());a.people.push(person());a.preferences.signId = 'aries';
  assert.equal(STATE_VERSION, 2);
  assert.deepEqual(b, { version: 2, profile: null, preferences: { mode: 'western', signId: null }, entries: [], people: [] });
  assert.deepEqual(validateState(b, today), b);
});

test('프로필·별자리 선택·기록·사람의 왕복은 원본을 변경하지 않는 새 상태를 반환한다', () => {
  const original = populated(), copy = validateState(original, today);
  assert.deepEqual(copy, original);
  copy.profile.birthTime = null;copy.entries[0].note = '새 회고';copy.preferences.signId = 'taurus';copy.people[0].name = '바뀐 이름';
  assert.equal(original.profile.birthTime, '08:30');
  assert.equal(original.entries[0].note, '');
  assert.equal(original.preferences.signId, 'aries');
  assert.equal(original.people[0].name, '합성 친구 1');
});

test('v1 문서는 그대로 읽히고 verdict null·빈 people을 더한 v2로 올라간다', () => {
  const v1 = v1Document([entry(1), { ...entry(2), note: '옛 메모', completed: true }]);
  const before = structuredClone(v1);
  const upgraded = validateState(v1, today);
  assert.equal(upgraded.version, 2);
  assert.deepEqual(upgraded.people, []);
  assert.deepEqual(upgraded.entries.map(item => item.verdict), [null, null]);
  assert.equal(upgraded.entries[1].note, '옛 메모');
  assert.deepEqual(upgraded.profile, v1.profile);
  assert.deepEqual(upgraded.preferences, v1.preferences);
  assert.deepEqual(v1, before, '읽기는 원본을 바꾸지 않는다');
  assert.deepEqual(validateState(upgraded, today), upgraded, 'v2로 올린 문서는 다시 읽어도 같다');
  assert.deepEqual(validateState({ version: 1, profile: null, preferences: { mode: 'western', signId: null }, entries: [] }, today), emptyState());
});

test('v1·v2 판마다 정확한 칸만 받는다', () => {
  const v1 = v1Document();
  for (const invalid of [
    { ...v1, people: [] }, // v1에는 people 칸이 없다
    { ...v1, entries: [entry()] }, // v1 기록에 verdict 칸이 있으면 거부
    { ...populated(), entries: [v1.entries[0]] }, // v2 기록에 verdict 칸이 없으면 거부
    (() => { const state = populated();delete state.people;return state; })(),
    { ...populated(), version: 3 }, { ...populated(), version: '2' }, null, [], 'state',
  ]) assert.throws(() => validateState(invalid, today));
});

test('양력·한국 시간 프로필은 날짜·시각·지원 범위를 엄격하게 검사한다', () => {
  assert.deepEqual(birthProfile('2000-02-29', null, today), { birthDate: '2000-02-29', birthTime: null, calendar: 'solar', timeZone: 'Asia/Seoul' });
  for (const birthDate of ['2001-02-29', '2000-13-01', '1899-12-31', '2026-10-07', '', null]) assert.throws(() => birthProfile(birthDate, null, today));
  for (const birthTime of ['24:00', '08:60', '8:00', '', 830, {}, [], false]) assert.throws(() => birthProfile('2000-01-01', birthTime, today));
});

test('시각처럼 문자열 변환되는 객체도 출생 시간으로 저장하지 않는다', () => {
  assert.throws(() => birthProfile('2000-01-01', { toString: () => '08:30' }, today));
});

test('상태·프로필·선택·기록·사람의 추가 필드나 누락 필드를 거부한다', () => {
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
    state => { delete state.entries[0].verdict; },
    state => { state.people[0].extra = true; },
    state => { delete state.people[0].birthTime; },
    state => { state.people = {}; },
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

test('verdict는 null·hit·meh·miss만 받는다', () => {
  assert.deepEqual(VERDICTS, ['hit', 'meh', 'miss']);
  for (const verdict of [null, ...VERDICTS]) assert.equal(validateState({ ...emptyState(), entries: [{ ...entry(), verdict }] }, today).entries[0].verdict, verdict);
  for (const verdict of ['HIT', '', 'yes', 1, true, false, undefined, {}, ['hit']]) {
    assert.throws(() => validateState({ ...emptyState(), entries: [{ ...entry(), verdict }] }, today), String(verdict));
  }
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

test('사람 칸: 이름 1~20자·관계 다섯 가지·출생일 범위·시간 형식·ID 중복·12명 한도', () => {
  assert.deepEqual(RELATIONS, ['family', 'friend', 'partner', 'work', 'other']);
  const ok = state => validateState({ ...emptyState(), people: state }, today);
  assert.equal(ok([person(1, { name: '가'.repeat(20) })]).people[0].name.length, 20);
  assert.equal(ok([person(1, { name: '😊'.repeat(20) })]).people.length, 1, '이름 길이는 유니코드 글자 수로 센다');
  for (const relation of RELATIONS) assert.equal(ok([person(1, { relation })]).people[0].relation, relation);
  assert.equal(ok([person(1, { birthTime: '23:59' })]).people[0].birthTime, '23:59');
  assert.equal(ok(Array.from({ length: MAX_PEOPLE }, (_, index) => person(index + 1))).people.length, 12);
  for (const invalid of [
    [person(1, { name: '' })], [person(1, { name: '   ' })], [person(1, { name: ' 앞빈칸' })], [person(1, { name: '뒤빈칸 ' })],
    [person(1, { name: '가'.repeat(21) })], [person(1, { name: '줄\n바꿈' })], [person(1, { name: '탭\t이름' })], [person(1, { name: 7 })],
    [person(1, { relation: 'enemy' })], [person(1, { relation: null })],
    [person(1, { birthDate: '1899-12-31' })], [person(1, { birthDate: '2026-10-07' })], [person(1, { birthDate: '2001-02-29' })],
    [person(1, { birthTime: '24:00' })], [person(1, { birthTime: '' })], [person(1, { birthTime: undefined })],
    [person(1, { id: 'not-a-uuid' })], [person(1), person(1, { name: '같은 ID' })],
    [person(1), { ...person(2), id: personId(1).toUpperCase() }],
    Array.from({ length: MAX_PEOPLE + 1 }, (_, index) => person(index + 1)),
  ]) assert.throws(() => ok(invalid), JSON.stringify(invalid).slice(0, 80));
});

test('기록과 사람의 ID는 각자 따로 중복을 검사한다', () => {
  const shared = '22222222-2222-4222-8222-222222222222';
  const state = validateState({ ...emptyState(), entries: [{ ...entry(), id: shared }], people: [person(1, { id: shared })] }, today);
  assert.equal(state.entries[0].id, state.people[0].id);
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

test('60KB 한도는 사람 칸까지 포함해 재고, 한도 가까운 v1 문서는 읽은 뒤 v2 저장에서 한도를 적용한다', () => {
  const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
  const v1 = v1Document(Array.from({ length: 90 }, (_, index) => entry(index + 1)));
  // v1 크기를 한도 100바이트 아래로 맞춘다. v2로 올리면 기록마다 ,"verdict":null(15바이트)과 people 칸이 붙는다.
  let room = 60 * 1024 - size(v1) - 100;
  for (const item of v1.entries) { const take = Math.min(room, 1000);item.note = 'a'.repeat(take);room -= take; }
  assert.ok(size(v1) <= 60 * 1024 && size(v1) > 60 * 1024 - 1000, 'v1 문서는 한도 바로 아래');
  const upgraded = validateState(v1, today);
  assert.equal(upgraded.entries.length, 90, '한도 가까운 v1 문서도 읽힌다');
  assert.ok(size(upgraded) > 60 * 1024, '이 시험 문서는 v2로 올리면 한도를 넘는다');
  assert.throws(() => validateState(upgraded, today), /용량/);
  const trimmed = { ...upgraded, entries: upgraded.entries.slice(2) };
  assert.equal(validateState(trimmed, today).entries.length, 88, '오래된 기록을 지우면 v2로 저장할 수 있다');
  const people = Array.from({ length: 12 }, (_, index) => person(index + 1, { name: '가'.repeat(20) }));
  assert.ok(size({ ...trimmed, people }) > 60 * 1024);
  assert.throws(() => validateState({ ...trimmed, people }, today), /용량/, '사람 칸도 용량에 들어간다');
});

test('같은 읽을거리를 다시 저장하면 ID·생성 시각·verdict를 지키면서 회고·완료를 갱신한다', () => {
  const fortune = getFortune('aries', today, 'western');
  const first = saveReading(emptyState(), fortune, { id: uuid(1), now: createdAt, note: '첫 메모' });
  assert.equal(first.entries[0].verdict, null);
  const judged = setVerdict(first, uuid(1), 'hit', { now: createdAt });
  const second = saveReading(judged, fortune, { id: uuid(2), now: updatedAt, note: '짧은 회고', completed: true });
  assert.equal(second.entries.length, 1);
  assert.equal(second.entries[0].id, uuid(1));
  assert.equal(second.entries[0].createdAt, createdAt);
  assert.equal(second.entries[0].updatedAt, updatedAt);
  assert.equal(second.entries[0].completed, true);
  assert.equal(second.entries[0].note, '짧은 회고');
  assert.equal(second.entries[0].verdict, 'hit', '다시 저장해도 맞았는지 표시를 지킨다');
  assert.equal(saveReading(second, fortune, { now: updatedAt, verdict: 'miss' }).entries[0].verdict, 'miss', '명시한 verdict는 바꾼다');
  assert.equal(saveReading(second, fortune, { now: updatedAt, verdict: null }).entries[0].verdict, null);
  assert.equal(first.entries[0].note, '첫 메모');
  assert.equal(readingKey(fortune), entryKey(second.entries[0]));
});

test('saveReading은 v1 문서를 받아도 v2로 저장하고 오늘 카드(headline·do)도 저장한다', () => {
  const card = getDailyCard({ mode: 'western', signId: 'leo', date: today });
  const saved = saveReading(v1Document(), card, { id: uuid(9), now: updatedAt });
  assert.equal(saved.version, 2);
  assert.equal(saved.entries[0].title, card.headline);
  assert.equal(saved.entries[0].action, card.do);
  assert.equal(saved.entries[1].verdict, null);
  const saju = getSaju({ birthDate: '1990-05-17', birthTime: null }, today);
  const korean = getDailyCard({ mode: 'korean', saju, date: today });
  const both = saveReading(saved, korean, { id: uuid(10), now: updatedAt });
  assert.deepEqual(both.entries[0].birth, birthProfile('1990-05-17', null, today));
  assert.equal(entryKey(both.entries[0]), readingKey(korean));
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

test('setVerdict는 표시만 바꾸고 자리·다른 칸을 지키며 잘못된 값과 없는 기록을 거부한다', () => {
  const state = { ...emptyState(), entries: [entry(1), { ...entry(2), note: '두 번째' }] };
  const marked = setVerdict(state, uuid(2).toUpperCase(), 'meh', { now: '2026-10-07T00:00:00.000Z' });
  assert.deepEqual(marked.entries.map(item => item.id), [uuid(1), uuid(2)]);
  assert.equal(marked.entries[1].verdict, 'meh');
  assert.equal(marked.entries[1].note, '두 번째');
  assert.equal(marked.entries[1].updatedAt, '2026-10-07T00:00:00.000Z');
  assert.equal(marked.entries[0].verdict, null);
  assert.equal(state.entries[1].verdict, null, '원본은 그대로');
  const earlier = setVerdict(marked, uuid(2), null, { now: '2020-01-01T00:00:00.000Z' });
  assert.equal(earlier.entries[1].verdict, null);
  assert.equal(earlier.entries[1].updatedAt, '2026-10-07T00:00:00.000Z', '시계가 거꾸로여도 수정 시각을 되돌리지 않는다');
  assert.throws(() => setVerdict(state, uuid(1), 'great'), /골라/);
  assert.throws(() => setVerdict(state, uuid(1), undefined), /골라/);
  assert.throws(() => setVerdict(state, uuid(3), 'hit'), /찾지/);
  assert.equal(setVerdict(v1Document(), uuid(1), 'hit', { now: updatedAt }).version, 2);
});

test('savePerson은 추가·수정·이름 다듬기·시간 모름을 처리하고 12명 한도를 지킨다', () => {
  let state = savePerson(emptyState(), { name: '  지민  ', relation: 'friend', birthDate: '1996-07-01', birthTime: '' }, { id: personId(1), today });
  assert.deepEqual(state.people, [{ id: personId(1), name: '지민', relation: 'friend', birthDate: '1996-07-01', birthTime: null }]);
  state = savePerson(state, { id: personId(1).toUpperCase(), name: '지민', relation: 'partner', birthDate: '1996-07-01', birthTime: '06:30' }, { id: personId(9), today });
  assert.equal(state.people.length, 1);
  assert.equal(state.people[0].id, personId(1), '수정은 원래 ID를 지킨다');
  assert.equal(state.people[0].relation, 'partner');
  assert.equal(state.people[0].birthTime, '06:30');
  for (let index = 2; index <= MAX_PEOPLE; index++) state = savePerson(state, { name: `친구${index}`, relation: 'other', birthDate: '2001-01-01' }, { id: personId(index), today });
  assert.equal(state.people.length, 12);
  assert.deepEqual(state.people.map(item => item.id), Array.from({ length: 12 }, (_, index) => personId(index + 1)), '새 사람은 끝에 붙는다');
  assert.throws(() => savePerson(state, { name: '열셋째', relation: 'friend', birthDate: '2001-01-01' }, { id: personId(13), today }), /12명/);
  assert.equal(savePerson(state, { id: personId(5), name: '고친 이름', relation: 'work', birthDate: '2001-01-01' }, { today }).people[4].name, '고친 이름', '가득 차도 수정은 된다');
  for (const invalid of [{ name: '', relation: 'friend', birthDate: '2001-01-01' }, { name: '가'.repeat(21), relation: 'friend', birthDate: '2001-01-01' }]) {
    assert.throws(() => savePerson(emptyState(), invalid, { today }), /이름/);
  }
  assert.throws(() => savePerson(emptyState(), { name: '관계 없음', relation: 'boss', birthDate: '2001-01-01' }, { today }), /관계/);
  assert.throws(() => savePerson(emptyState(), { name: '미래', relation: 'friend', birthDate: '2026-10-07' }, { today }));
  assert.throws(() => savePerson(emptyState(), { id: personId(77), name: '없는 사람', relation: 'friend', birthDate: '2001-01-01' }, { today }), /찾지/);
  assert.throws(() => savePerson(emptyState(), null, { today }));
});

test('removePerson은 한 사람만 지우고 없는 ID는 그대로 둔다', () => {
  const state = { ...emptyState(), people: [person(1), person(2), person(3)] };
  assert.deepEqual(removePerson(state, personId(2).toUpperCase(), { today }).people.map(item => item.id), [personId(1), personId(3)]);
  assert.deepEqual(removePerson(state, personId(9), { today }).people.length, 3);
  assert.deepEqual(removePerson(state, undefined, { today }).people.length, 3);
  assert.equal(state.people.length, 3, '원본은 그대로');
});
