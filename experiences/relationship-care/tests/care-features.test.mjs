import test from 'node:test';
import assert from 'node:assert/strict';
import { makePerson, makeEvent, emptyState } from '../model.mjs';
import { filterPeople, shiftMonth, monthCalendar, pastUnfinishedEvents, captureCandidates } from '../care-features.mjs';

const now = new Date('2026-10-06T03:00:00Z');
const person = makePerson({ id: 'p1', name: '지민', relationship: '대학 동기', group: 'friend', notes: '함께 부산 여행' });
const event = input => makeEvent({ id: 'e1', personId: 'p1', type: 'birthday', date: '1995-10-06', ...input });
const state = events => ({ ...emptyState(), people: [person], events });

test('검색은 이름·관계·메모·전달받은 기억을 함께 찾고 직접 고른 분류만 쓴다', () => {
  const family = { ...person, id: 'p2', name: '민서', group: 'family', memories: [{ text: '커피보다 차를 좋아해요' }] };
  const legacy = { id: 'p3', name: '다온', relationship: '친구' };
  assert.deepEqual(filterPeople([person, family, legacy], { query: '지민 부산', group: 'friend' }).map(p => p.id), ['p1']);
  assert.deepEqual(filterPeople([person, family, legacy], { query: '차를', group: 'family' }).map(p => p.id), ['p2']);
  assert.deepEqual(filterPeople([legacy], { group: 'friend' }), []);
  assert.equal(filterPeople([legacy], { group: 'other' }).length, 1);
  assert.throws(() => filterPeople([person], { group: 'guessed' }));
});

test('월별 달력은 오늘·완료한 회차·같은 날 여러 사람을 정확히 표시한다', () => {
  const data = state([event(), event({ id: 'e2', type: 'wedding', date: '2026-10-06', time: '14:00' })]);
  data.completions.push({ eventId: 'e1', occurrenceId: 'e1:2026-10-06' });
  const result = monthCalendar(data, '2026-10', now);
  assert.equal(result.days.length, 42);
  assert.equal(result.days[0].date, '2026-09-27');
  const day = result.days.find(day => day.date === '2026-10-06');
  assert.equal(day.today, true);
  assert.equal(day.rows.length, 2);
  assert.equal(day.rows[0].status, 'completed');
  assert.equal(day.rows[1].status, 'upcoming');
  assert.ok(result.days.filter(day => !day.inMonth).every(day => day.rows.length === 0));
});

test('월 달력은 음력의 양력 회차와 2월 29일 정책을 기존 모델과 같이 쓴다', () => {
  const lunar = event({ calendar: 'lunar', date: '1995-01-01' });
  const february = monthCalendar(state([lunar]), '2026-02', now);
  assert.equal(february.rows[0].occurrence.date, '2026-02-17');
  const leap = event({ date: '2000-02-29', leapDayPolicy: 'feb28' });
  assert.equal(monthCalendar(state([leap]), '2027-02', now).rows[0].occurrence.date, '2027-02-28');
});

test('지난 미처리는 지난 365일의 누락 회차만 보여주고 오늘·완료·범위 밖은 제외한다', () => {
  const data = state([
    event({ id: 'missed', date: '1995-10-05' }), event({ id: 'today', type: 'wedding', date: '2026-10-06' }),
    event({ id: 'done', type: 'wedding', date: '2026-09-20' }), event({ id: 'old', type: 'wedding', date: '2025-10-01' }),
  ]);
  data.completions.push({ occurrenceId: 'done:2026-09-20' });
  const rows = pastUnfinishedEvents(data, now);
  assert.deepEqual(rows.map(row => row.event.id), ['missed']);
  assert.equal(rows[0].occurrence.date, '2026-10-05');
  assert.equal(rows[0].daysAgo, 1);
  assert.equal(rows[0].status, 'overdue');
});

test('기준 시간은 UTC 자정이 아닌 한국 날짜이며 달 이동은 연말을 넘는다', () => {
  assert.equal(monthCalendar(state([event()]), '2026-10', '2026-10-05T15:01:00Z').days.find(day => day.today).date, '2026-10-06');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.throws(() => shiftMonth('2199-12', 1));
  assert.throws(() => monthCalendar(state([]), '2026-13', now));
  assert.throws(() => pastUnfinishedEvents(state([]), now, { lookbackDays: 1000 }));
});

test('청첩장 날짜·시각·장소와 답장 선호는 원문 근거를 보존한 후보로만 나온다', () => {
  const text = '결혼식은 2026-10-10 오후 2시 30분이야.\n장소: 서울 웨딩홀 3층\n답장은 천천히 해도 괜찮아.';
  const result = captureCandidates(text, { person, now });
  assert.equal(result.events.length, 1);
  assert.deepEqual({ type: result.events[0].type, date: result.events[0].date, time: result.events[0].time, location: result.events[0].location }, { type: 'wedding', date: '2026-10-10', time: '14:30', location: '서울 웨딩홀 3층' });
  assert.equal(result.events[0].personId, person.id);
  assert.equal(result.events[0].sourceQuote, text);
  assert.equal(result.memories[0].kind, 'preference');
  assert.ok(text.includes(result.memories[0].sourceQuote));
  assert.equal(person.recipientPreference.noReplyPressure, false);
});

test('연도 없는 날짜·내일·다음 주 토요일은 기준과 확인 사항을 표시한다', () => {
  const monthDay = captureCandidates('생일은 10월 10일이야.', { now });
  assert.equal(monthDay.events[0].date, '2026-10-10');
  assert.match(monthDay.events[0].cautions.join(' '), /연도가 없어/u);
  const tomorrow = captureCandidates('내일 생일이야.', { now: '2026-12-31T01:00:00Z' });
  assert.equal(tomorrow.events[0].date, '2027-01-01');
  assert.match(tomorrow.events[0].cautions.join(' '), /원문을 받은 날짜/u);
  assert.equal(captureCandidates('다음 주 토요일에 결혼해.', { now }).events[0].date, '2026-10-17');
});

test('잘못된 날짜는 후보에서 제외하고 애매한 시각은 확인 필요로 남긴다', () => {
  const invalid = captureCandidates('결혼식은 2026-02-30이야.', { now });
  assert.equal(invalid.events.length, 0);
  assert.match(invalid.warnings.join(' '), /실제 날짜/u);
  const ambiguous = captureCandidates('생일 10월 10일 3시', { now });
  assert.equal(ambiguous.events[0].time, '03:00');
  assert.match(ambiguous.events[0].cautions.join(' '), /오전·오후/u);
  const lunar = captureCandidates('생신은 음력 2월 30일이에요.', { now });
  assert.equal(lunar.events[0].calendar, 'lunar');
  assert.match(lunar.events[0].cautions.join(' '), /윤달/u);
  const leap = captureCandidates('생신은 음력 윤6월 1일이에요.', { now });
  assert.equal(leap.events[0].calendar, 'lunar');
  assert.equal(leap.events[0].lunarLeapMonth, true);
  assert.equal(captureCandidates('결혼식 10월 10일 오후 2시 반', { now }).events[0].time, '14:30');
});

test('후보 없는 글은 원인을 알리고 중복 문장은 기억 하나로 묶는다', () => {
  assert.match(captureCandidates('안녕하세요.', { now }).warnings.join(' '), /찾지 못/u);
  assert.equal(captureCandidates('커피보다 차를 좋아해요.\n커피보다 차를 좋아해요.', { now }).memories.length, 1);
  assert.equal(captureCandidates('', { now }).events.length, 0);
  assert.throws(() => captureCandidates('x'.repeat(50001), { now }));
});
