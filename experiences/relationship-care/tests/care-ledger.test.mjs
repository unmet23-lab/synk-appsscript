import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, makeEvent, importBackup, recordCareAction, OCCASION_TYPES } from '../model.mjs';
import { ledgerEntries, ledgerSummary, amountContext, exportLedgerCsv, previewLedgerCsv, applyLedgerImport, parseWon, parseLedgerDate, CSV_HEADER } from '../care-ledger.mjs';

const NOW = '2026-10-14T10:00:00+09:00';
function fixture() {
  let state = importBackup({ ...emptyState(),
    people: [makePerson({ id: 'kim', name: '김민수', relationship: '직장 동료' }), makePerson({ id: 'lee1', name: '이서연', relationship: '대학 친구' }),
      makePerson({ id: 'lee2', name: '이서연', relationship: '사촌' })],
    events: [makeEvent({ id: 'kim-w', personId: 'kim', type: 'wedding', date: '2025-05-10' }), makeEvent({ id: 'lee-c', personId: 'lee1', type: 'condolence', date: '2024-03-02' })] });
  const add = (input, at = NOW) => { state = recordCareAction(state, input, at); };
  add({ personId: 'kim', eventId: 'kim-w', kind: 'money', direction: 'sent', occurredOn: '2025-05-10', amountWon: 100000, attended: true });
  add({ personId: 'kim', kind: 'money', direction: 'received', occurredOn: '2026-04-05', amountWon: 50000, occasion: 'first-birthday' });
  add({ personId: 'kim', kind: 'gift', direction: 'sent', occurredOn: '2026-04-05', item: '아기 내복', amountWon: 30000, occasion: 'first-birthday' });
  add({ personId: 'lee1', eventId: 'lee-c', kind: 'money', direction: 'sent', occurredOn: '2024-03-02', amountWon: 50000, attended: false });
  add({ personId: 'lee1', kind: 'attend', direction: 'sent', occurredOn: '2026-09-01', occasion: 'opening' });
  add({ personId: 'lee2', kind: 'contact', direction: 'sent', occurredOn: '2026-10-01', channel: 'call' });
  return state;
}

test('사람별 보낸·받은 합계, 마지막 금액, 참석 여부를 모은다', () => {
  const summary = ledgerSummary(fixture());
  assert.equal(summary.entries.length, 5, '금액 없는 연락은 장부에 넣지 않는다');
  const kim = summary.people.find(row => row.personId === 'kim');
  assert.deepEqual([kim.sent.totalWon, kim.sent.moneyWon, kim.sent.giftWon, kim.sent.count], [130000, 100000, 30000, 2]);
  assert.deepEqual([kim.received.totalWon, kim.received.count, kim.balanceWon], [50000, 1, -80000]);
  assert.deepEqual(kim.lastSent, { date: '2026-04-05', amountWon: 30000, item: '아기 내복', kind: 'gift', occasion: 'first-birthday', occasionLabel: '돌' });
  assert.equal(kim.lastReceived.amountWon, 50000);
  assert.equal(kim.lastAmount.date, '2026-04-05');
  assert.deepEqual(kim.attendance, { count: 1, last: true, lastDate: '2025-05-10' });
  const lee = summary.people.find(row => row.personId === 'lee1');
  assert.deepEqual(lee.attendance, { count: 1, last: true, lastDate: '2026-09-01' }, '참석 기록은 참석으로 센다');
  assert.equal(lee.sent.totalWon, 50000); assert.equal(lee.sent.count, 2);
  assert.deepEqual(summary.people.map(row => row.personId), ['lee1', 'kim'], '최근에 주고받은 사람 먼저');
  assert.deepEqual([summary.totals.sent.totalWon, summary.totals.received.totalWon, summary.totals.balanceWon], [180000, 50000, -130000]);
});

test('행사 종류는 기록의 분류를 먼저, 없으면 연결된 일정 종류에서 읽고, 연도별로도 모은다', () => {
  const state = fixture();
  const entries = ledgerEntries(state);
  const wedding = entries.find(entry => entry.eventId === 'kim-w');
  assert.deepEqual([wedding.occasion, wedding.occasionLabel, wedding.occasionSource, wedding.eventTitle], ['wedding', '결혼', 'event', '결혼']);
  assert.deepEqual([entries.find(entry => entry.eventId === 'lee-c').occasion, entries.find(entry => entry.eventId === 'lee-c').attended], ['funeral', false]);
  const summary = ledgerSummary(state);
  assert.deepEqual(summary.byOccasion.map(row => [row.key, row.sent.totalWon, row.received.totalWon]),
    [['wedding', 100000, 0], ['funeral', 50000, 0], ['first-birthday', 30000, 50000], ['opening', 0, 0]]);
  assert.deepEqual(summary.byYear.map(row => [row.label, row.sent.totalWon, row.received.totalWon, row.sent.count + row.received.count]),
    [['2026년', 30000, 50000, 3], ['2025년', 100000, 0, 1], ['2024년', 50000, 0, 1]]);
  assert.deepEqual(summary.years, [2026, 2025, 2024]);
  assert.equal(ledgerSummary(state, { year: 2026 }).entries.length, 3);
  assert.equal(ledgerSummary(state, { direction: 'received' }).totals.received.totalWon, 50000);
  assert.equal(ledgerEntries(state, { occasion: 'wedding' }).length, 1);
  assert.throws(() => ledgerEntries(state, { occasion: 'party' }), /행사 종류/);
  assert.deepEqual(amountContext(state, 'kim'), { personId: 'kim', lastReceived: { date: '2026-04-05', amountWon: 50000, item: '', kind: 'money', occasion: 'first-birthday', occasionLabel: '돌' },
    lastSent: { date: '2026-04-05', amountWon: 30000, item: '아기 내복', kind: 'gift', occasion: 'first-birthday', occasionLabel: '돌' }, receivedWon: 50000, receivedOn: '2026-04-05' });
});

test('CSV 내보내기는 엑셀용 BOM·CRLF·따옴표 처리·수식 막기를 지킨다', () => {
  let state = fixture();
  state = recordCareAction(state, { personId: 'lee2', kind: 'gift', direction: 'received', occurredOn: '2026-10-02', item: '=HYPERLINK("x")', note: '고마워, "정말"\n두 줄' }, NOW);
  const csv = exportLedgerCsv(state);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.endsWith('\r\n'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], CSV_HEADER.join(','));
  assert.equal(lines[1], '2024-03-02,이서연,대학 친구,보냄,경조금,장례·조문,50000,,불참,');
  assert.match(csv, /,"'=HYPERLINK\(""x""\)",/);
  assert.match(csv, /"고마워, ""정말""\n두 줄"/);
  assert.equal(exportLedgerCsv(state, { year: 2025 }).slice(1).split('\r\n').filter(Boolean).length, 2);
});

test('CSV 미리보기는 저장하지 않고 이름 일치·동명이인·새 이름·겹침·오류를 표시한다', () => {
  const state = fixture();
  const before = JSON.stringify(state);
  const csv = '﻿날짜,이름,관계,방향,종류,행사,금액(원),물품,참석,메모\r\n'
    + '2026.3.7,김민수,,받음,,결혼식,10만,,,\r\n'
    + '2026-05-01,이서연,,보냄,,돌잔치,"50,000",,참석,\r\n'
    + '2026-05-02,이서연,사촌,보냄,경조금,칠순,5만원,,,\r\n'
    + '2026-06-01,박지훈,,보냄,선물,집들이,,"휴지, 세제",,\r\n'
    + '2025-05-10,김민수,,보냄,경조금,결혼,100000,,참석,\r\n'
    + '2026-06-01,박지훈,,보냄,선물,집들이,,"휴지, 세제",,\r\n'
    + '2027-01-01,김민수,,보냄,,결혼,10만,,,\r\n'
    + '2026-02-30,김민수,,보냄,,결혼,10만,,,\r\n'
    + '2026-07-01,김민수,,모름,,결혼,십만,,,\r\n';
  const preview = previewLedgerCsv(state, csv, { now: NOW });
  assert.equal(JSON.stringify(state), before, '미리보기는 수첩을 바꾸지 않는다');
  const [r0, r1, r2, r3, r4, r5, r6, r7, r8] = preview.rows;
  assert.deepEqual([r0.date, r0.direction, r0.kind, r0.occasion, r0.amountWon, r0.match.status, r0.match.personId, r0.ready], ['2026-03-07', 'received', 'money', 'wedding', 100000, 'one', 'kim', true]);
  assert.deepEqual([r1.match.status, r1.match.candidates.map(item => item.relationship), r1.attended, r1.amountWon, r1.occasion, r1.ready], ['many', ['대학 친구', '사촌'], true, 50000, 'first-birthday', false]);
  assert.deepEqual([r2.match.status, r2.match.personId, r2.match.byRelationship, r2.occasion], ['one', 'lee2', true, 'milestone-birthday'], '관계 열로 동명이인을 좁힌다');
  assert.deepEqual([r3.match.status, r3.kind, r3.item, r3.amountWon], ['none', 'gift', '휴지, 세제', null]);
  assert.deepEqual([r4.duplicate, r4.ready], ['existing', false]);
  assert.equal(r5.duplicate, 'file');
  assert.match(r6.errors.join(), /오늘보다 뒤/);
  assert.match(r7.errors.join(), /날짜/);
  assert.equal(r8.errors.length, 2);
  assert.deepEqual(preview.counts, { total: 9, ready: 2, sameName: 1, newName: 2, duplicates: 2, errors: 3 });
  assert.match(preview.notes[0], /아직 저장하지 않았어요/);
});

test('보낸 금액·받은 금액 열이 나뉜 다른 앱 형식과 잘못된 파일을 다룬다', () => {
  const state = fixture();
  const preview = previewLedgerCsv(state, '일자,성명,보낸금액,받은금액,경조사\n2023/11/04,김민수,,"70,000",결혼\n2024년 2월 3일,김민수,30000,,개업\n', { now: NOW });
  assert.deepEqual(preview.rows.map(row => [row.date, row.direction, row.amountWon, row.occasion]), [['2023-11-04', 'received', 70000, 'wedding'], ['2024-02-03', 'sent', 30000, 'opening']]);
  assert.throws(() => previewLedgerCsv(state, '이름,금액\n김민수,1\n', { now: NOW }), /날짜.*이름/);
  assert.throws(() => previewLedgerCsv(state, '날짜,이름,관계\n2026-01-01,김민수,동료\n', { now: NOW }), /금액/);
  assert.throws(() => previewLedgerCsv(state, '날짜,이름,금액\n2026-01-01,김�,1\n', { now: NOW }), /CSV UTF-8/);
  assert.equal(parseWon('15만5천'), 155000); assert.equal(parseWon('₩100,000'), 100000); assert.equal(parseWon('1억'), 100000000);
  assert.equal(parseWon('십만'), undefined); assert.equal(parseWon(''), null);
  assert.equal(parseLedgerDate('2026.5.1.'), '2026-05-01'); assert.equal(parseLedgerDate('2026-02-30'), null);
});

test('가져오기는 고른 줄만 더하고, 동명이인은 고르게 하며, 새 이름은 한 사람으로 묶는다', () => {
  const state = fixture();
  const csv = '날짜,이름,관계,방향,종류,행사,금액,물품,참석,메모\n'
    + '2026-03-07,김민수,,받음,,결혼,10만,,,\n'
    + '2026-05-01,이서연,,보냄,,돌,5만,,참석,\n'
    + '2026-06-01,박지훈,후배,보냄,선물,집들이,,휴지,,\n'
    + '2026-06-09,박지훈,후배,받음,,개업,5만,,,\n'
    + '2025-05-10,김민수,,보냄,경조금,결혼,100000,,참석,\n';
  const preview = previewLedgerCsv(state, csv, { now: NOW });
  assert.throws(() => applyLedgerImport(state, preview, [], NOW), /직접 골라/);
  assert.throws(() => applyLedgerImport(state, preview, [{ index: 1 }], NOW), /누구인지 골라/);
  assert.throws(() => applyLedgerImport(state, preview, [{ index: 4 }], NOW), /이미 같은 기록/);
  const result = applyLedgerImport(state, preview, [{ index: 0 }, { index: 1, personId: 'lee2' }, { index: 2, newPerson: true }, { index: 3, newPerson: true }], NOW);
  assert.deepEqual([result.added, result.createdPeople], [4, 1]);
  assert.equal(result.state.people.length, 4);
  const park = result.state.people.find(person => person.name === '박지훈');
  assert.equal(park.relationship, '후배');
  const added = result.state.activities.slice(-4);
  assert.deepEqual(added.map(item => [item.personId === park.id ? 'park' : item.personId, item.kind, item.direction, item.amountWon, item.occasion]),
    [['kim', 'money', 'received', 100000, 'wedding'], ['lee2', 'money', 'sent', 50000, 'first-birthday'], ['park', 'gift', 'sent', null, 'housewarming'], ['park', 'money', 'received', 50000, 'opening']]);
  assert.equal(added[1].attended, true); assert.equal(added[2].item, '휴지');
  assert.equal(result.state.activities.length, state.activities.length + 4, '기존 기록은 그대로 두고 더하기만 한다');
  const forced = applyLedgerImport(state, preview, [{ index: 4, allowDuplicate: true }], NOW);
  assert.equal(forced.added, 1);
  // 내보낸 장부를 다시 넣으면 모두 겹침으로 표시된다.
  const roundtrip = previewLedgerCsv(result.state, exportLedgerCsv(result.state), { now: NOW });
  assert.equal(roundtrip.rows.filter(row => row.match.status === 'one').every(row => row.duplicate === 'existing'), true);
  assert.equal(roundtrip.counts.ready, 0);
});

test('모델의 장부 선택 칸은 없으면 키를 만들지 않고, 있으면 검사한다', () => {
  const base = importBackup({ ...emptyState(), people: [makePerson({ id: 'p', name: '사람' })] });
  const plain = recordCareAction(base, { personId: 'p', kind: 'money', occurredOn: '2026-10-01', amountWon: 50000 }, NOW).activities[0];
  assert.deepEqual(Object.keys(plain).sort(), ['amountWon', 'createdAt', 'direction', 'eventId', 'id', 'kind', 'note', 'occurredOn', 'personId']);
  const rich = recordCareAction(base, { personId: 'p', kind: 'money', occurredOn: '2026-10-01', amountWon: 50000, occasion: 'hospital', attended: false, item: '과일 바구니' }, NOW).activities[0];
  assert.deepEqual([rich.occasion, rich.attended, rich.item], ['hospital', false, '과일 바구니']);
  assert.deepEqual(importBackup(JSON.parse(JSON.stringify({ ...base, activities: [rich] }))).activities[0], rich, '백업 왕복에서 유지');
  assert.throws(() => recordCareAction(base, { personId: 'p', kind: 'money', occurredOn: '2026-10-01', occasion: 'party' }, NOW), /행사 분류/);
  assert.throws(() => recordCareAction(base, { personId: 'p', kind: 'money', occurredOn: '2026-10-01', attended: 'yes' }, NOW), /참석 여부/);
  assert.throws(() => recordCareAction(base, { personId: 'p', kind: 'gift', occurredOn: '2026-10-01', channel: 'call' }, NOW), /연락 기록에만/);
  assert.equal(Object.keys(OCCASION_TYPES).length, 11);
});
