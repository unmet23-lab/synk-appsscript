'use strict';

// 수요 스캔(tools/수요스캔/) — 네트워크 없이 순수 함수만 본다. 유튜브·틱톡 응답은 모두 합성이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../tools/lib/평소배수.js');
const 판정 = require('../tools/수요스캔/수요판정.js');
const 수집 = require('../tools/수요스캔/수요수집.js');
const 스캔 = require('../tools/수요스캔/스캔.js');

const vid = (글자, n) => `${글자}${String(n).padStart(10, '0')}`.slice(0, 11);
const 기본설정 = () => ({
  브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: 'UC' + 'a'.repeat(22), 이름: '가' }], 검색: { 어: ['learn korean'] },
});

test('설정 넷이 모두 맞다 — 시드 채널·검색어·틱톡·못 잼, 우리 계정 표시', () => {
  for (const b of 판정.브랜드목록) {
    const { 설정, 오류 } = 스캔.설정읽기(b);
    assert.deepEqual(오류, [], b);
    assert.equal(설정.브랜드, b);
    assert.ok(설정.유튜브.filter(c => !c.우리).length >= 10, `${b} 시드 채널이 10곳 넘게 있다`);
    assert.ok(설정.검색.어.length >= 20, `${b} 10-22 검색어`);
    assert.ok(설정.틱톡.length >= 4, `${b} 틱톡 고정 목록`);
    assert.ok(설정.못잼.some(m => /인스타/.test(m.곳)), `${b} 인스타는 못 잼으로 둔다`);
  }
  const 우리 = b => 스캔.설정읽기(b).설정;
  assert.ok(우리('lab-en').유튜브.some(c => c.우리 && c.핸들 === '@synkkorean'));
  assert.ok(우리('lab-mn').틱톡.some(t => t.우리 && t.핸들 === 'synk.mn'));
  assert.ok(우리('synkbrief').유튜브.some(c => c.우리 && c.핸들 === '@synkbrief'));
  assert.ok(우리('yuhobuilds').유튜브.some(c => c.우리 && c.핸들 === '@yuhobuilds'));
  assert.ok(우리('lab-en').틱톡.some(t => t.핸들 === 'cake.learnkorean') && 우리('lab-mn').틱톡.some(t => t.핸들 === 'idoclass_'));
});

test('설정 검사가 틀린 꼴을 잡는다', () => {
  const 틀림 = 바꿈 => { const raw = 기본설정(); 바꿈(raw); return 판정.설정검사(raw, 'lab-en').오류.join('\n'); };
  assert.equal(판정.설정검사(기본설정(), 'lab-en').오류.length, 0);
  assert.match(틀림(r => { r.유튜브[0].id = 'UCshort'; }), /채널 ID 꼴/);
  assert.match(틀림(r => { r.유튜브.push({ 핸들: 'no-at' }); }), /@핸들 꼴/);
  assert.match(틀림(r => { r.유튜브.push({ id: r.유튜브[0].id }); }), /두 번/);
  assert.match(틀림(r => { r.유튜브.push({ 핸들: '@Same' }, { 핸들: '@same' }); }), /두 번/);
  assert.match(틀림(r => { r.틱톡 = [{ 핸들: 'has space' }]; }), /틱톡 핸들 꼴/);
  assert.match(틀림(r => { r.검색.주제 = '(unclosed'; }), /정규식이 틀렸다/);
  assert.match(틀림(r => { r.검색.필터 = '아무거나 필터'; }), /검색.필터/);
  assert.match(틀림(r => { r.검색.어 = []; }), /검색.어가 비었다/);
  assert.match(틀림(r => { r.판정 = { 배수: 3, 없는칸: 1 }; }), /모르는 칸/);
  assert.match(틀림(r => { r.판정 = { 기준편수: 3, 최소편수: 5 }; }), /기준편수 ≥ 최소편수/);
  assert.match(판정.설정검사(기본설정(), 'lab-mn').오류.join(), /파일 이름/);
  assert.match(틀림(r => { r.못잼 = [{ 곳: '인스타그램' }]; }), /못잼/);
  const 좋음 = 판정.설정검사({ ...기본설정(), 틱톡: [{ 핸들: '@korean_hamin' }], 검색: { 어: ['a'], 필터: '이번달짧은', 주제: 'AI|클로드' } }, 'lab-en').설정;
  assert.equal(좋음.틱톡[0].핸들, 'korean_hamin', '@는 떼고 둔다');
  assert.equal(좋음.검색.필터, 판정.검색필터.이번달짧은);
  assert.ok(좋음.검색.주제.test('클로드 꿀팁'));
  assert.equal(좋음.판정.작은채널구독상한, 30000, '안 적은 칸은 10-22 기본값');
});

test('기준선은 쇼츠 탭 맨 앞 30편의 중앙값(평소배수 lib 그대로)이고 5편이 안 되면 못 잰다', () => {
  const 조회 = Array.from({ length: 40 }, (_, i) => (i + 1) * 10);
  const b = 판정.기준선(조회);
  assert.equal(b.편수, 30);
  assert.equal(b.중앙값, lib.median(조회.slice(0, 30)));
  assert.equal(판정.기준선([null, 5, 'x', 7]).편수, 2);
  assert.equal(판정.기준선([1, 2, 3, 4]).중앙값, null);
  assert.equal(판정.기준선([1, 2, 3, 4, 5]).중앙값, 3);
});

test('튄 편 판정 — A(중앙값 3배·하한), B(작은 채널 조회 ≥ 구독), 구독을 모르면 A만, 평소가 없으면 못 잼', () => {
  const p = 판정.기본.판정; // 하한 3,000 · 작은 채널 3만
  const 큰 = { 중앙값: 2000, 편수: 30, 구독: 500000 };
  assert.deepEqual(판정.튄편판정(6000, 큰, p), { 규칙: 'A', 배수: 3 });
  assert.equal(판정.튄편판정(5999, 큰, p), null);
  assert.equal(판정.튄편판정(2999, { 중앙값: 900, 편수: 30, 구독: 900000 }, p), null, '3배라도 하한 아래');
  const 작은 = { 중앙값: 4000, 편수: 12, 구독: 844 };
  assert.deepEqual(판정.튄편판정(5000, 작은, p), { 규칙: 'B', 배수: 1.25 }, '배수는 낮아도 구독보다 많이 봤다');
  assert.equal(판정.튄편판정(2500, { ...작은, 구독: 100 }, p), null, '작은 채널도 하한은 넘어야');
  assert.equal(판정.튄편판정(40000, { ...작은, 구독: 30001 }, p).규칙, 'A', '3만 넘으면 B가 아니다');
  assert.equal(판정.튄편판정(50000, { 중앙값: 1000, 편수: 30, 구독: 2000 }, p).규칙, 'AB');
  assert.equal(판정.튄편판정(5000, { 중앙값: 4000, 편수: 12, 구독: null }, p), null, '구독 모르면 B를 안 본다');
  assert.equal(판정.튄편판정(99999, { 중앙값: 10, 편수: 4, 구독: 10 }, p), null, '쇼츠 5편 미만은 평소를 못 잰다');
  assert.equal(판정.튄편판정(null, 큰, p), null);
});

// 합성 채널: 쇼츠 탭 맨 앞 30편이 모두 조회 1,000(중앙값 1,000)
function 탭만들기(앞) {
  const 편 = [...앞, ...Array.from({ length: 30 }, (_, i) => ({ id: vid('B', i), 제목: `평범 ${i}`, 조회: 1000 }))];
  return { 구독: 50000, 핸들: '@test', 편 };
}

test('증분 — 새로 튄 편만 후보, 이미 보고한 편은 다시 안 나오고, 지난번 평범하던 편이 이번에 3배를 넘으면 나오며, 창 밖은 안 나온다', () => {
  const 판 = 판정.기본.판정;
  const NEW = vid('N', 1);
  const LATE = vid('L', 1);
  const OLD = vid('O', 1);
  // 1회차(10-26): NEW는 5배, LATE는 1.5배, OLD(09-01)는 50배지만 창(28일) 밖
  const 탭1 = 탭만들기([{ id: NEW, 제목: '새 편', 조회: 5000 }, { id: LATE, 제목: '늦게 뜰 편', 조회: 1500 }, { id: OLD, 제목: '옛 편', 조회: 50000 }]);
  const rss1 = { 전체수: 15, 편: [
    { id: NEW, 제목: '새 편', 날짜: '2026-10-25T10:00:00+00:00', 쇼츠: true, 조회: 5100 },
    { id: LATE, 제목: '늦게 뜰 편', 날짜: '2026-10-24T10:00:00+00:00', 쇼츠: true, 조회: 1500 },
    { id: OLD, 제목: '옛 편', 날짜: '2026-09-01T10:00:00+00:00', 쇼츠: true, 조회: 50000 },
    ...Array.from({ length: 12 }, (_, i) => ({ id: vid('B', i), 제목: '', 날짜: '2026-08-20T00:00:00+00:00', 쇼츠: true, 조회: 1000 })),
  ] };
  const r1 = 판정.채널정리({ 이전: undefined, 탭: 탭1, rss: rss1, 튄편: {}, 오늘: '2026-10-26', 판정: 판 });
  assert.deepEqual(r1.후보.map(h => h.id), [NEW]);
  assert.equal(r1.후보[0].조회, 5100, '탭과 RSS 가운데 큰 조회');
  assert.equal(r1.후보[0].날짜, '2026-10-25');
  assert.equal(r1.기준.출처, '이번');
  assert.equal(r1.상태.중앙값, 1000);
  assert.equal(r1.상태.편[LATE], '2026-10-24', 'RSS 날짜를 누적에 기억한다(조회는 안 남긴다)');
  assert.equal(r1.상태.편[OLD], '2026-09-01', '창보다 옛 편이라도 쇼츠 탭에 있으면 날짜를 기억한다(날짜 모름으로 되살아나지 않게)');
  assert.ok(!(vid('B', 20) in r1.상태.편), '날짜를 모르는 편은 적지 않는다');
  const 누적글 = JSON.stringify(r1.상태);
  assert.ok(!누적글.includes('새 편') && !누적글.includes('평범'), '누적에는 제목을 넣지 않는다');

  // NEW를 보고했다. 2회차(11-02): RSS에서 LATE가 빠졌지만(최신 15편 밖) 탭에는 있고 이제 4배다
  const 튄편 = { [NEW]: { 곳: '유튜브', 날짜: '2026-10-25', 조회: 5100, 잡은날: '2026-10-26' } };
  const 탭2 = 탭만들기([{ id: NEW, 제목: '새 편', 조회: 9000 }, { id: LATE, 제목: '늦게 뜰 편', 조회: 4000 }, { id: OLD, 제목: '옛 편', 조회: 60000 }]);
  const rss2 = { 전체수: 15, 편: Array.from({ length: 15 }, (_, i) => ({ id: vid('R', i), 제목: '', 날짜: '2026-11-01T00:00:00+00:00', 쇼츠: true, 조회: 900 })) };
  const r2 = 판정.채널정리({ 이전: r1.상태, 탭: 탭2, rss: rss2, 튄편, 오늘: '2026-11-02', 판정: 판 });
  assert.deepEqual(r2.후보.map(h => h.id), [LATE], '보고한 NEW는 빠지고, 날짜는 누적에서 찾은 LATE가 나온다');
  assert.equal(r2.후보[0].날짜, '2026-10-24');
  assert.equal(r2.후보[0].배수, 4);
  assert.equal(r2.상태.편[OLD], '2026-09-01', '탭에 아직 있는 옛 히트의 날짜는 남는다 — 날짜 모름 후보로 되살아나지 않는다');

  // 쇼츠 탭을 안 읽은 주에는 덜어 내지 않고, 탭을 다시 읽은 주에 탭에서 빠진 옛 편만 덜어 낸다
  const 안읽은주 = 판정.채널정리({ 이전: r2.상태, 탭: null, rss: rss2, 튄편, 오늘: '2026-11-09', 판정: 판 });
  assert.equal(안읽은주.상태.편[OLD], '2026-09-01');
  const 탭3 = 탭만들기([{ id: NEW, 조회: 9500 }, { id: LATE, 조회: 4100 }]);
  const 읽은주 = 판정.채널정리({ 이전: 안읽은주.상태, 탭: 탭3, rss: rss2, 튄편, 오늘: '2026-11-16', 판정: 판 });
  assert.ok(!(OLD in 읽은주.상태.편), '탭에서 빠진 창 밖 편은 잊는다');
  assert.equal(읽은주.상태.편[LATE], '2026-10-24', '창 + 여유 안이거나 탭에 있는 편은 남긴다');
});

test('RSS가 창을 덮으면 날짜 모르는 탭 편은 창 밖 · RSS를 못 읽으면 날짜 모르는 튄 편은 탭 어디든 날짜 확인 후보', () => {
  const 앞 = vid('F', 1);
  const 뒤 = vid('Z', 1);
  const 탭 = 탭만들기([{ id: 앞, 제목: '', 조회: 8000 }]);
  탭.편.splice(20, 0, { id: 뒤, 제목: '', 조회: 9000 }); // 탭 21번째(RSS 밖) 튄 조회
  const 덮는rss = { 전체수: 15, 편: [
    { id: 앞, 날짜: '2026-10-20T00:00:00+00:00', 쇼츠: true, 조회: 8000 },
    ...Array.from({ length: 14 }, (_, i) => ({ id: vid('B', i), 날짜: '2026-09-10T00:00:00+00:00', 쇼츠: true, 조회: 1000 })),
  ] };
  const r = 판정.채널정리({ 탭, rss: 덮는rss, 오늘: '2026-10-26' });
  assert.deepEqual(r.후보.map(h => h.id), [앞], '가장 옛 RSS 편(09-10)이 창보다 앞이라 뒤 편은 창 밖');
  const 없음 = 판정.채널정리({ 탭, rss: null, 오늘: '2026-10-26' });
  assert.deepEqual(없음.후보.map(h => [h.id, h.날짜]), [[뒤, null], [앞, null]], '탭 21번째 편도(2차 검수 GA5), 날짜는 모름으로 — 조회 많은 순');
});

test('쇼츠 탭을 못 읽으면 지난 기준선(중앙값·구독)으로 RSS 새 편을 판정한다', () => {
  const 이전 = { 구독: 900, 중앙값: 400, 편수: 30, 기준선잰날: '2026-10-19', 편: {} };
  const rss = { 전체수: 3, 편: [{ id: vid('N', 2), 제목: 'x', 날짜: '2026-10-25T00:00:00Z', 쇼츠: true, 조회: 3500 }] };
  const r = 판정.채널정리({ 이전, 탭: null, rss, 오늘: '2026-10-26' });
  assert.equal(r.기준.출처, '지난(2026-10-19)');
  assert.deepEqual(r.후보.map(h => h.규칙), ['AB']);
  assert.equal(r.상태.기준선잰날, '2026-10-19', '기준선 날짜는 그대로');
  const 롱폼 = 판정.채널정리({ 이전, 탭: null, rss: { 전체수: 1, 편: [{ id: vid('V', 1), 날짜: '2026-10-25T00:00:00Z', 쇼츠: false, 조회: 99999 }] }, 오늘: '2026-10-26' });
  assert.equal(롱폼.후보.length, 0, '채널 RSS의 롱폼은 보지 않는다');
});

test('쇼츠 탭은 기준선이 없거나 갱신일이 지났을 때 다시 읽는다 — 기본은 회차마다(7일)', () => {
  const 잰 = 날 => ({ 편수: 30, 중앙값: 1000, 기준선잰날: 날 });
  assert.equal(판정.탭다시읽기(undefined, '2026-10-26'), true);
  assert.equal(판정.탭다시읽기(잰('2026-10-19'), '2026-10-26'), true, '기본 7일 — 주마다 읽는다');
  assert.equal(판정.탭다시읽기(잰('2026-10-22'), '2026-10-26'), false, '나흘 전에 읽었으면 그대로');
  assert.equal(판정.탭다시읽기(잰('2026-10-19'), '2026-10-26', 14), false, '--기준선 14면 2주마다');
  assert.equal(판정.탭다시읽기(잰('2026-10-12'), '2026-10-26', 14), true);
  assert.equal(판정.탭다시읽기(잰('2026-10-25'), '2026-10-26', 0), true, '0이면 매번');
});

test('틱톡 — 날짜순으로 다시 세워 고정된 옛 편이 기준을 흔들지 않고, 창 안 새 편만 후보', () => {
  const 목록 = [
    { id: '7000000000000000001', 날짜: '2025-01-01', 조회: 900000, 길이: 30 }, // 고정된 옛 편(맨 앞)
    { id: '7000000000000000002', 날짜: '2026-10-24', 조회: 40000, 길이: 15, 저장: 300 },
    ...Array.from({ length: 30 }, (_, i) => ({ id: String(7100000000000000000n + BigInt(i)), 날짜: `2026-09-${String(10 + (i % 15)).padStart(2, '0')}`, 조회: 2000 })),
  ];
  const r = 판정.틱톡정리({ 목록, 오늘: '2026-10-26' });
  assert.equal(r.기준.중앙값, 2000, '고정된 90만 편은 최근 30편 밖');
  assert.deepEqual(r.후보.map(h => [h.id, h.규칙, h.배수, h.저장]), [['7000000000000000002', 'A', 20, 300]]);
  assert.equal(r.기준.구독, null);
  const 다시 = 판정.틱톡정리({ 이전: r.상태, 목록, 튄편: { '7000000000000000002': {} }, 오늘: '2026-10-27' });
  assert.equal(다시.후보.length, 0);
});

test('영상 정보 덧입히기 — 날짜가 창 밖이면 버리고, 정확한 조회로 다시 판정', () => {
  const 기준 = { 중앙값: 1000, 편수: 30, 구독: 50000, 출처: '이번' };
  const 후보 = { id: vid('N', 3), 제목: '탭 제목', 조회: 3200, 날짜: null };
  assert.deepEqual(판정.상세반영(후보, { 날짜: '2026-08-01' }, 기준, 판정.기본.판정, '2026-09-28'), { 밖: true, 날짜: '2026-08-01' });
  const 됨 = 판정.상세반영(후보, { 날짜: '2026-10-20', 조회: 3300, 길이: 14, 좋아요: 50, 댓글수: 7, 제목: '진짜 제목' }, 기준, 판정.기본.판정, '2026-09-28');
  assert.equal(됨.줄.조회, 3300);
  assert.equal(됨.줄.길이, 14);
  assert.equal(됨.줄.제목, '진짜 제목');
  assert.equal(판정.상세반영({ ...후보, 조회: 2900 }, { 날짜: '2026-10-20', 조회: 2950 }, 기준, 판정.기본.판정, '2026-09-28').아님, true);
  assert.equal(판정.상세반영(후보, null, 기준, 판정.기본.판정, '2026-09-28').줄.날짜, null, '정보를 못 읽으면 날짜 모름으로 남긴다');
});

test('검색 — 돌려 가며 고르고, 모르는 채널 가운데 3분 이하·하한 넘는 편이 있는 채널만, 주제·제외를 건다', () => {
  assert.deepEqual(판정.검색차례(['a', 'b', 'c'], 2, 2), { 이번: ['c', 'a'], 다음차례: 1 });
  assert.deepEqual(판정.검색차례(['a', 'b'], 0, 5), { 이번: ['a', 'b'], 다음차례: 0 });
  assert.deepEqual(판정.검색차례(['a'], 0, 0), { 이번: [], 다음차례: 0 });
  assert.equal(판정.검색글('korean slang', ' shorts'), 'korean slang shorts');
  assert.equal(판정.검색글('learn korean shorts', ' shorts'), 'learn korean shorts');
  const 아는 = new Set(['UC' + 'k'.repeat(22)]);
  const 결과 = [
    { id: vid('S', 1), 제목: '클로드 꿀팁', 조회: 90000, 길이: 40, 채널id: 'UC' + 'k'.repeat(22), 채널이름: '아는 채널' },
    { id: vid('S', 2), 제목: '클로드 쓰는 법', 조회: 50000, 길이: 50, 채널id: 'UC' + 'n'.repeat(22), 채널이름: '새 채널', 검색어: 'q' },
    { id: vid('S', 3), 제목: '클로드 강의', 조회: 80000, 길이: 1500, 채널id: 'UC' + 'l'.repeat(22), 채널이름: '롱폼' },
    { id: vid('S', 4), 제목: '클로드 뉴스', 조회: 70000, 길이: 30, 채널id: 'UC' + 'm'.repeat(22), 채널이름: 'YTN 뉴스' },
    { id: vid('S', 5), 제목: '요리', 조회: 70000, 길이: 30, 채널id: 'UC' + 'o'.repeat(22), 채널이름: '요리 채널' },
    { id: vid('S', 6), 제목: '클로드', 조회: 100, 길이: 30, 채널id: 'UC' + 'p'.repeat(22), 채널이름: '작은 조회' },
  ];
  const 검색 = { 주제: /클로드/i, 제외: /뉴스|YTN/i, 찾기상한: 5 };
  assert.deepEqual(판정.새채널고르기(결과, 아는, 검색, 판정.기본.판정).map(c => c.채널이름), ['새 채널']);
  assert.equal(판정.새채널고르기(결과, new Set(), { 찾기상한: 1 }, 판정.기본.판정).length, 1, '찾기 상한');
});

test('찾은 채널은 상한 안으로(최근에 튄 채널을 남긴다) · 오래된 튄 편 기록은 덜어 낸다', () => {
  const 찾은 = { A: { 찾은날: '2026-10-01', 마지막튐: null }, B: { 찾은날: '2026-09-01', 마지막튐: '2026-10-20' }, C: { 찾은날: '2026-10-19', 마지막튐: null } };
  assert.deepEqual(Object.keys(판정.찾은채널정리(찾은, 2)).sort(), ['B', 'C']);
  // 올린 날이 창 + 여유(35일)보다 옛 편은 다시 후보가 될 수 없어 잊는다 — 잡은 날이 최근이어도
  const 튄편 = { a: { 날짜: '2026-10-01', 잡은날: '2026-10-05' }, b: { 날짜: '2026-09-01', 잡은날: '2026-10-19' }, c: { 잡은날: '2026-10-20' } };
  assert.deepEqual(Object.keys(판정.튄편정리(튄편, '2026-10-26')), ['a', 'c']);
});

test('댓글은 본문만 — 쓴 사람 이름·아이디·사진·주소·댓글 ID를 담지 않고, 메일·@언급·링크·전화는 가리며, 답글은 뺀다', () => {
  const 원본 = [
    { id: 'Ugx1', parent: 'root', text: '나도 ㄹ이 어려웠다 ㅋㅋ', like_count: 6000, author: '김철수', author_id: 'UCauthorid1234567890ab', author_thumbnail: 'https://yt3.example/a.jpg', author_url: 'https://www.youtube.com/@kimcs', author_is_uploader: false, is_pinned: false },
    { id: 'Ugx2', parent: 'root', text: '@kimcs 맞아요 메일 me@example.com 으로 https://spam.example/x 010-1234-5678', like_count: 10, author: '이영희', author_id: 'UCauthorid0987654321cd', is_pinned: false },
    { id: 'Ugx3', parent: 'Ugx1', text: '답글은 뺀다', like_count: 99999, author: '박답글' },
    { id: 'Ugx4', parent: 'root', text: '몇 개 알았어?', like_count: 3, author: '채널주인', author_is_uploader: true, is_pinned: true },
    { id: 'Ugx5', parent: 'root', text: '   ', like_count: 1, author: '빈글' },
  ];
  const 줄 = 판정.댓글줄이기(원본, 30);
  assert.deepEqual(줄.map(c => c.글.slice(0, 6)), ['몇 개 알았', '나도 ㄹ이 ', '@… 맞아요'], '고정 먼저, 그다음 좋아요 순');
  for (const c of 줄) assert.deepEqual(Object.keys(c).sort(), ['고정', '글', '좋아요', '채널주인']);
  const 글 = JSON.stringify(줄);
  for (const 남 of ['김철수', '이영희', '박답글', 'UCauthorid', 'yt3.example', 'kimcs', 'Ugx', 'me@example.com', 'spam.example', '010-1234-5678']) {
    assert.ok(!글.includes(남), `「${남}」가 남으면 안 된다`);
  }
  assert.match(줄[2].글, /\[메일\].*\[링크\].*\[번호\]/);
  assert.equal(판정.댓글줄이기(원본, 1).length, 1);
  assert.deepEqual(판정.댓글줄이기(undefined), []);
});

test('RSS 읽기 — 쇼츠 링크·정확한 조회·글자 풀기', () => {
  const xml = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>UC${'c'.repeat(22)}</yt:channelId>
 <entry><yt:videoId>ItupcsChBXM</yt:videoId><title>Tom &amp; Jerry &#39;말&#39; &#x1F600;</title><link rel="alternate" href="https://www.youtube.com/shorts/ItupcsChBXM"/>
  <published>2026-10-19T14:17:15+00:00</published><media:group><media:community><media:statistics views="272845"/></media:community></media:group></entry>
 <entry><yt:videoId>LongVideo01</yt:videoId><title>long</title><link rel="alternate" href="https://www.youtube.com/watch?v=LongVideo01"/><published>2026-10-01T00:00:00+00:00</published></entry>
</feed>`;
  const r = 수집.rss읽기(xml);
  assert.equal(r.채널id, 'UC' + 'c'.repeat(22));
  assert.equal(r.전체수, 2);
  assert.deepEqual(r.편[0], { id: 'ItupcsChBXM', 제목: "Tom & Jerry '말' 😀", 날짜: '2026-10-19T14:17:15+00:00', 쇼츠: true, 조회: 272845 });
  assert.equal(r.편[1].쇼츠, false);
  assert.equal(r.편[1].조회, null);
  assert.equal(수집.rss주소('UC' + 'c'.repeat(22), '쇼츠'), `https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH${'c'.repeat(22)}`);
});

test('yt-dlp 응답 읽기 — 쇼츠 탭(구독·핸들)·검색(채널·재생목록 결과 뺌)·영상(올린 날)·틱톡', () => {
  const 탭 = 수집.탭읽기({ id: 'UC' + 'd'.repeat(22), channel: 'Hayan Lee', uploader_id: '@hayanleekr', channel_follower_count: 46800,
    entries: [{ id: 'ItupcsChBXM', title: 't', view_count: 264000 }, { id: 'bad' }, null] });
  assert.deepEqual(탭, { 채널id: 'UC' + 'd'.repeat(22), 채널이름: 'Hayan Lee', 핸들: '@hayanleekr', 구독: 46800, 편: [{ id: 'ItupcsChBXM', 제목: 't', 조회: 264000 }] });
  assert.equal(수집.탭읽기({ entries: [] }).구독, null);
  const 검색 = 수집.검색읽기([
    { id: '54FcGPI6yyM', ie_key: 'Youtube', title: 'a', view_count: 804, duration: 1425, channel_id: 'UC' + 'e'.repeat(22), channel: 'Arirang' },
    { id: 'UC' + 'f'.repeat(22), ie_key: 'YoutubeTab', title: 'channel result' },
    { id: 'PLxxxxxxxxx', ie_key: 'YoutubeTab', title: 'playlist' },
  ]);
  assert.deepEqual(검색.map(x => [x.id, x.길이, x.채널id]), [['54FcGPI6yyM', 1425, 'UC' + 'e'.repeat(22)]]);
  const 영상 = 수집.영상읽기({ id: '7Sakz7p-ERY', title: 'Korean is NOT easy', upload_date: '20260920', duration: 13, view_count: 11020050,
    like_count: 137119, comment_count: 2300, channel_follower_count: 46800, description: '문의 biz@example.com' });
  assert.equal(영상.날짜, '2026-09-20');
  assert.equal(영상.길이, 13);
  assert.ok(!영상.설명.includes('@example.com'), '설명의 메일은 가린다');
  assert.equal(수집.영상읽기({ id: 'x', timestamp: Date.UTC(2026, 9, 1, 12) / 1000 }).날짜, '2026-10-01');
  const 틱톡 = 수집.틱톡읽기([{ id: '7659252593088154900', title: '첫 줄\n둘째 줄', view_count: 49000, like_count: 7371, comment_count: 62, save_count: 1723, repost_count: 193, duration: 102, upload_date: '20260706' }, { id: 'abc' }]);
  assert.deepEqual(틱톡, [{ id: '7659252593088154900', 제목: '첫 줄', 조회: 49000, 좋아요: 7371, 댓글수: 62, 저장: 1723, 공유: 193, 길이: 102, 날짜: '2026-07-06' }]);
  assert.deepEqual(수집.json줄들('{"a":1}\nWARNING x\n{"b":\n{"c":2}'), [{ a: 1 }, { c: 2 }]);
});

test('yt-dlp 인자 — 모든 호출이 --skip-download·--ignore-config이고, 받기·로그인 옵션이 없으며, 댓글은 첫 쪽·답글 0', () => {
  const 금지 = new Set(['-f', '--format', '-o', '--output', '--cookies', '--cookies-from-browser', '--username', '--password', '-u', '-p', '--netrc', '--write-info-json', '--write-thumbnail', '--write-subs']);
  const 묶음 = [
    수집.yt인자('탭', { id: 'UC' + 'g'.repeat(22), 수: 30 }),
    수집.yt인자('탭', { 핸들: '@강지영의동그라미' }),
    수집.yt인자('검색', { 어: 'солонгос хэл', 필터: '', 수: 20 }),
    수집.yt인자('영상', { id: '7Sakz7p-ERY', 댓글수: 30, 시도: 0 }),
    수집.yt인자('영상', { id: '7Sakz7p-ERY', 댓글수: 0, 시도: 2 }),
    수집.yt인자('틱톡', { 핸들: 'idoclass_' }),
  ];
  for (const a of 묶음) {
    assert.ok(a.includes('--skip-download') && a.includes('--ignore-config'), a.join(' '));
    for (const x of a) assert.ok(!금지.has(x), `금지 인자 ${x}`);
  }
  assert.ok(묶음[0].at(-1).endsWith(`/channel/UC${'g'.repeat(22)}/shorts`));
  assert.ok(묶음[1].at(-1).includes('/@') && 묶음[1].at(-1).endsWith('/shorts'));
  assert.equal(new URL(묶음[2].at(-1)).searchParams.get('search_query'), 'солонгос хэл');
  const 댓글 = 묶음[3];
  assert.ok(댓글.includes('--write-comments') && 댓글.includes('--verbose'), '댓글 전체 수는 --verbose 출력에만 있다');
  assert.match(댓글[댓글.indexOf('--extractor-args') + 1], /^youtube:player_client=web_safari;player_skip=webpage;comment_sort=top;max_comments=30,all,0$/);
  assert.ok(!묶음[4].includes('--write-comments') && !묶음[4].includes('--verbose'));
  assert.match(묶음[4][묶음[4].indexOf('--extractor-args') + 1], /player_client=web_embedded/);
  assert.equal(묶음[5].at(-1), 'https://www.tiktok.com/@idoclass_');
  assert.throws(() => 수집.yt인자('받기', {}), /모르는/);
});

test('막힘 갈래와 부르개 — 간격을 지키고, 막히면 쉬었다가, 연달아 셋이면 그 서비스를 이번 회차에서 멈춘다', async () => {
  assert.equal(수집.실패갈래('ERROR: [youtube] x: Unable to download API page: HTTP Error 403: Forbidden'), '막힘');
  assert.equal(수집.실패갈래('ERROR: Sign in to confirm you’re not a bot'), '막힘');
  assert.equal(수집.실패갈래('ERROR: [youtube:tab] UCx: This channel does not have a shorts tab'), '없음');
  // 없는 계정이 아니다 — 같은 계정이 앞뒤 회차엔 읽혔다(10-24 PC 8곳 · 10-25 서버, 흉내내기 없는 판에서 잦다)
  assert.equal(수집.실패갈래('ERROR: [tiktok:user] koreanhoon: Unable to extract secondary user ID'), '실패');
  assert.equal(수집.실패갈래('ERROR: something else'), '실패');
  // 댓글을 받으면 JSON의 comment_count는 받은 개수로 덮인다 — 전체 수는 --verbose 줄에서 읽는다
  assert.equal(수집.댓글총수('[debug] x\n[youtube] Downloading ~1,382 comments\n[youtube] Extracted 30 comments'), 1382);
  assert.equal(수집.댓글총수('[youtube] Extracted 30 comments'), null);

  let 지금 = 1_000_000;
  const 시각 = [];
  let 불림 = 0;
  const 실행기 = async () => { 불림 += 1; 시각.push(지금); return { 코드: 1, 출력: '', 오류글: 'ERROR: HTTP Error 429: Too Many Requests', ms: 5 }; };
  const 기록 = [];
  const p = new 수집.부르개({ 간격초: 2, 막힘쉼초: 30, 막힘한도: 3, 실행기, 쉬기: async ms => { 지금 += ms; }, 지금: () => 지금, 기록: 줄 => 기록.push(줄) });
  const 결과 = [];
  for (let i = 0; i < 4; i += 1) 결과.push((await p.yt('탭', { id: 'UC' + 'h'.repeat(22) })).상태);
  assert.deepEqual(결과, ['막힘', '막힘', '막힘', '멈춤']);
  assert.equal(불림, 3, '멈춘 뒤에는 부르지 않는다');
  assert.ok(시각[1] - 시각[0] >= 30_000 && 시각[2] - 시각[1] >= 30_000, '막힌 뒤 30초 쉰다');
  assert.deepEqual(p.셈.멈춘서비스, ['youtube']);
  assert.equal(기록.length, 3);
  assert.ok(기록.every(줄 => 줄.상태 === '막힘' && 줄.오류.includes('429')));

  // 틱톡은 따로 센다 · 성공하면 연속 막힘이 풀린다 · 간격을 지킨다
  let 차례 = 0;
  const 섞인 = async () => { 차례 += 1; 시각.push(지금); return 차례 % 2 ? { 코드: 1, 출력: '', 오류글: 'HTTP Error 403', ms: 1 } : { 코드: 0, 출력: '{"id":"7000000000000000001","view_count":1,"upload_date":"20261020"}\n', 오류글: '', ms: 1 }; };
  const q = new 수집.부르개({ 간격초: 2, 막힘쉼초: 0, 막힘한도: 2, 실행기: 섞인, 쉬기: async ms => { 지금 += ms; }, 지금: () => 지금 });
  const 틱 = [];
  시각.length = 0;
  for (let i = 0; i < 4; i += 1) 틱.push((await q.yt('틱톡', { 핸들: 'a_b' })).상태);
  assert.deepEqual(틱, ['막힘', '됨', '막힘', '됨']);
  for (let i = 1; i < 시각.length; i += 1) assert.ok(시각[i] - 시각[i - 1] >= 2000, '호출 사이 2초 넘게');
});

test('짧은 수·배수·인용 — 10-22 보고서 꼴', () => {
  assert.deepEqual([697, 2620, 46800, 755380, 11020050, 123456789, null].map(판정.짧은수), ['697', '2.6천', '4.7만', '75.5만', '1,102만', '1.2억', '—']);
  assert.equal(판정.배수글(93.04), '×93');
  assert.equal(판정.배수글(4.81), '×4.8');
  assert.equal(판정.인용글({ id: '7Sakz7p-ERY', 조회: 11020050, 배수: 93, 규칙: 'A', 날짜: '2026-09-20', 길이: 13 }), '7Sakz7p-ERY(1,102만 · ×93 · 2026-09-20 · 13초)');
  assert.equal(판정.인용글({ id: '15g7W6qZZUY', 조회: 2220313, 배수: 1188, 규칙: 'AB', 구독: 697, 날짜: '2026-09-30', 길이: null }), '15g7W6qZZUY(222만 · ×1188 · 구독 697 · 2026-09-30 · 길이 못 잼)');
  assert.equal(판정.인용글({ id: '7000000000000000002', 조회: 40000, 배수: 20, 규칙: 'A', 저장: 391, 날짜: '2026-10-24', 길이: 15 }), '7000000000000000002(4만 · ×20 · 저장 391 · 2026-10-24 · 15초)');
});

test('요약 글 — 브랜드마다 새 튄 편 표(영상 ID·날짜·조회·배수·길이·제목)·인용·댓글 본문·날짜 모름·우리·못 잰 곳', () => {
  const 줄 = { 곳: '유튜브', id: '7Sakz7p-ERY', 주소: 'https://www.youtube.com/shorts/7Sakz7p-ERY', 채널: 'Hayan Lee', 구독: 46800, 조회: 11020050, 배수: 93, 규칙: 'A',
    날짜: '2026-09-20', 길이: 13, 제목: 'Korean is NOT easy | 🇰🇷', 댓글수: 2300,
    댓글: { 파일: '댓글/lab-en/7Sakz7p-ERY.json', 읽은수: 2, 위: [{ 글: '몇 개 알았어?', 좋아요: 3, 고정: true, 채널주인: true }] } };
  줄.인용 = 판정.인용글(줄);
  const 요약 = 판정.요약합치기(null, { 판: 1, 날짜: '2026-10-26', 규칙: '규칙 글', 브랜드: { 'lab-en': {
    이름: 'LAB 영어', 창: { 부터: '2026-09-28', 까지: '2026-10-26' }, 지난스캔: null,
    표본: { 유튜브: { 대상: 5, 읽음: 4, 편: 150, 창안: 20 }, 틱톡: { 대상: 2, 읽음: 1, 편: 35 }, 검색: { 어: ['korean slang'], 쇼츠: 3, 새채널: 1 } },
    새튄편: [줄], 날짜모름: [{ 곳: '유튜브', id: 'xxxxxxxxxxx', 조회: 9000, 배수: 9, 채널: 'A', 까닭: '영상 정보 못 읽음' }],
    우리: [{ 곳: '유튜브', 계정: '@synkkorean', 기준: { 중앙값: 172, 편수: 13 }, 편: [{ id: 'ourvideo001', 날짜: '2026-10-25', 조회: 344, 배수: 2 }] }],
    못잼: [{ 곳: '인스타그램', 계정: '@hangugo__study', 까닭: '로그인 벽' }, { 곳: '틱톡', 계정: '@koreanhoon', 까닭: '없음·비공개' }],
  } } });
  const md = 판정.요약글(요약);
  assert.match(md, /^# 수요 스캔 · 2026-10-26/);
  assert.match(md, /\| 곳 \| 영상 ID \| 날짜 \| 조회 \| 배수 \| 길이 \| 채널\(구독\) \| 제목 \|/);
  assert.match(md, /\| 유튜브 \| 7Sakz7p-ERY \| 2026-09-20 \| 1,102만 \| ×93 \| 13초 \| Hayan Lee\(4.7만\) \| Korean is NOT easy ｜ 🇰🇷 \|/, '표 안의 | 는 바꾼다');
  assert.match(md, /- 7Sakz7p-ERY\(1,102만 · ×93 · 2026-09-20 · 13초\)/);
  assert.match(md, /\(3 · 고정 · 채널 주인\) 몇 개 알았어\?/);
  assert.match(md, /날짜를 확인 못 한 후보[\s\S]*xxxxxxxxxxx/);
  assert.match(md, /@synkkorean — 최근 13편 중앙 172 · 창 안 ourvideo001 2026-10-25 344\(×2.0\)/);
  assert.match(md, /### 못 잰 곳 2[\s\S]*@hangugo__study — 로그인 벽/);
  assert.match(md, /첫 스캔/);
  const 둘 = 판정.요약합치기(요약, { 판: 1, 날짜: '2026-10-26', 규칙: '규칙 글', 브랜드: { synkbrief: { ...요약.브랜드['lab-en'], 이름: 'synkbrief', 새튄편: [] } } });
  assert.deepEqual(둘.브랜드순, ['lab-en', 'synkbrief'], '같은 날 나눠 돌린 브랜드를 합친다');
  assert.match(판정.요약글(둘), /## synkbrief[\s\S]*새로 튄 편이 없다/);

  // 표는 상한까지만(나머지는 요약.json), 상한 때문에 안 읽은 길이는 「—」, 제목의 해시태그는 걷는다
  const 많은 = Array.from({ length: 판정.기본.요약표상한 + 3 }, (_, i) => ({ 곳: '유튜브', id: vid('M', i), 주소: 'u', 채널: 'c', 구독: 1000, 조회: 99999 - i, 배수: 5, 규칙: 'A',
    날짜: '2026-10-20', 길이: null, 상세: '상한', 제목: `제목 ${i} #learnkorean #kpop`, 인용: `i${i}` }));
  const 긴md = 판정.요약글({ 날짜: '2026-10-26', 규칙: '규칙', 브랜드: { 'lab-en': { ...요약.브랜드['lab-en'], 새튄편: 많은 } } });
  assert.match(긴md, /나머지 3편은 요약.json/);
  assert.match(긴md, /\| — \| c\(1천\) \| 제목 0 \|/);
  assert.match(긴md, /길이 「—」 = 영상 정보 상한/);
  assert.ok(!긴md.includes('#learnkorean'));
});

test('요약.md 제목 다듬기 — 해시태그를 걷고 길이를 줄인다', () => {
  assert.equal(판정.제목다듬기('How Koreans say thank you 🙏 ㅋㅋ #learnkorean #kpop #korean'), 'How Koreans say thank you 🙏 ㅋㅋ');
  assert.equal(판정.제목다듬기('a|b'), 'a｜b');
  assert.equal([...판정.제목다듬기('가'.repeat(80))].length, 60);
  assert.ok(판정.제목다듬기('가'.repeat(80)).endsWith('…'));
});

test('누적 파일 — 다시 읽으면 같은 값, 편 배열은 한 줄, 판이 다르면 새로 시작(덮지 않게 알린다)', () => {
  const 누적 = { ...판정.빈누적('lab-en'), 마지막스캔: '2026-10-26T00:00:00.000Z',
    채널: { ['UC' + 'q'.repeat(22)]: { 핸들: '@x', 구독: 1, 중앙값: 2.5, 편수: 30, 기준선잰날: '2026-10-26', 편: { ItupcsChBXM: '2026-10-19', abcdefghijk: '2026-10-20' }, 막힘: null } },
    검색어목록: Array.from({ length: 30 }, (_, i) => `긴 검색어 ${i}번`) };
  const 글 = 판정.줄맞춰(누적);
  assert.deepEqual(JSON.parse(글), 누적);
  assert.match(글, /"편": \{ "ItupcsChBXM": "2026-10-19", "abcdefghijk": "2026-10-20" \}/, '날짜만 든 작은 편 목록은 한 줄');
  assert.ok(글.split('\n').every(l => l.length <= 200), '긴 글 배열은 줄마다 나눈다');
  assert.equal(판정.누적검사({ ...누적, 판: 99 }, 'lab-en').새로, true);
  assert.equal(판정.누적검사(누적, 'lab-mn').새로, true);
  const { 누적: 고침, 새로 } = 판정.누적검사({ 판: 1, 브랜드: 'lab-en', 채널: [] }, 'lab-en');
  assert.equal(새로, false);
  assert.deepEqual(고침.채널, {}, '꼴이 틀린 칸은 비운다');
});

test('다시볼 — 날짜를 몰라 근거에서 뺀 유튜브 편만 남기고, 다음 회차에 지난 기준선으로 후보가 된다(날짜 있는 편은 보충 쪽)', () => {
  const 줄들 = [
    { 곳: '유튜브', id: 'aaaaaaaaaaa', 채널id: 'UCx', 조회: 7000, 날짜: null, 상세: '상한' },
    { 곳: '유튜브', id: 'ddddddddddd', 채널id: 'UCx', 조회: 6500, 날짜: null, 상세: '됨' },
    { 곳: '유튜브', id: 'bbbbbbbbbbb', 채널id: 'UCx', 조회: 6000, 날짜: '2026-10-24', 상세: '못 잼' },
    { 곳: '틱톡', id: '7000000000000000009', 조회: 1, 상세: undefined },
  ];
  const 다시볼 = 판정.다시볼정리(줄들, { ddddddddddd: { 남긴날: '2026-10-19' } }, '2026-10-26');
  assert.deepEqual(Object.keys(다시볼).sort(), ['aaaaaaaaaaa', 'ddddddddddd'], '날짜 없는 편만 — 영상 정보를 읽었는데 날짜가 없던 편도');
  assert.equal(다시볼.ddddddddddd.남긴날, '2026-10-19', '처음 남긴 날을 지킨다');
  assert.equal(판정.다시볼정리(줄들, { ddddddddddd: { 남긴날: '2026-09-01' } }, '2026-10-26').ddddddddddd, undefined, '오래 못 읽으면 버린다');
  const 채널 = { UCx: { 중앙값: 1000, 편수: 30, 구독: 50000, 기준선잰날: '2026-10-26', 편: { aaaaaaaaaaa: ['2026-10-23', 1] } } };
  const 후보 = 판정.다시볼후보(다시볼, 채널, {}, 판정.기본.판정, '2026-10-05');
  assert.deepEqual(후보.map(h => [h.id, h.조회, h.날짜, h.규칙]), [['aaaaaaaaaaa', 7000, '2026-10-23', 'A'], ['ddddddddddd', 6500, null, 'A']],
    '날짜는 누적에서(옛 꼴 [날짜, 조회]도 읽는다), 조회는 다시볼에 남긴 값');
  assert.equal(판정.다시볼후보(다시볼, 채널, { aaaaaaaaaaa: {} }, 판정.기본.판정, '2026-10-05').length, 1, '그사이 보고한 편은 뺀다');
  assert.equal(판정.다시볼후보(다시볼, {}, {}, 판정.기본.판정, '2026-10-05').length, 0, '채널 기준선이 없으면 못 본다');
  // 보충후보: 보고는 했지만 길이가 없는 편(창 안, 기준선 있는 채널)
  const 튄 = { bbbbbbbbbbb: { 곳: '유튜브', 채널: 'UCx', 날짜: '2026-10-24', 조회: 6000, 잡은날: '2026-10-26', 보충: true },
    eeeeeeeeeee: { 곳: '유튜브', 채널: 'UCx', 날짜: '2026-09-01', 조회: 9000, 잡은날: '2026-09-02', 보충: true },
    fffffffffff: { 곳: '유튜브', 채널: 'UCx', 날짜: '2026-10-24', 조회: 9000, 잡은날: '2026-10-26', 길이: 20 } };
  assert.deepEqual(판정.보충후보(튄, 채널, '2026-10-05').map(h => [h.id, h.보고한날]), [['bbbbbbbbbbb', '2026-10-26']], '창 밖·길이 있는 편은 빼고');
});

// ── 브랜드 하나를 가짜 부르개로 두 회차 돈다(네트워크 없음) ──
function rss글(편) {
  return `<feed><yt:channelId>x</yt:channelId>${편.map(p => `<entry><yt:videoId>${p.id}</yt:videoId><title>${p.id}</title>`
    + `<link rel="alternate" href="https://www.youtube.com/shorts/${p.id}"/><published>${p.날짜}T00:00:00+00:00</published>`
    + `<media:statistics views="${p.조회}"/></entry>`).join('')}</feed>`;
}

function 가짜장면() {
  const A = 'UC' + 'a'.repeat(22);
  const N = 'UC' + 'n'.repeat(22);
  const 평범 = (글자, 수, 조회) => Array.from({ length: 수 }, (_, i) => ({ id: vid(글자, i), title: `평범 ${i}`, view_count: 조회 }));
  const 탭 = {
    [A]: { id: A, channel: '가 채널', uploader_id: '@aa', channel_follower_count: 50000,
      entries: [{ id: 'NEW1aaaaaaa', title: '새 편 1', view_count: 9000 }, { id: 'NEW2aaaaaaa', title: '새 편 2', view_count: 6000 },
        { id: 'UNDaaaaaaaa', title: '날짜 모를 편', view_count: 7000 }, ...평범('B', 30, 1000)] },
    [N]: { id: N, channel: '찾은 채널', uploader_id: '@nn', channel_follower_count: 120000, entries: [{ id: 'NEWNaaaaaaa', title: '찾은 편', view_count: 20000 }, ...평범('C', 30, 500)] },
  };
  const rss = {
    [A]: [{ id: 'NEW1aaaaaaa', 날짜: '2026-10-25', 조회: 9100 }, { id: 'NEW2aaaaaaa', 날짜: '2026-10-24', 조회: 6000 },
      ...Array.from({ length: 13 }, (_, i) => ({ id: vid('B', i), 날짜: `2026-10-${String(1 + i).padStart(2, '0')}`, 조회: 1000 }))],
    [N]: [{ id: 'NEWNaaaaaaa', 날짜: '2026-10-22', 조회: 20000 }, ...Array.from({ length: 3 }, (_, i) => ({ id: vid('C', i), 날짜: '2026-08-01', 조회: 500 }))],
  };
  const 영상 = {
    NEW1aaaaaaa: { id: 'NEW1aaaaaaa', title: '새 편 1', channel: '가 채널', upload_date: '20261025', duration: 12, view_count: 9500, like_count: 300, comment_count: 40 },
    NEW2aaaaaaa: { id: 'NEW2aaaaaaa', title: '새 편 2', channel: '가 채널', upload_date: '20261024', duration: 20, view_count: 6800, like_count: 90, comment_count: 9 },
    UNDaaaaaaaa: { id: 'UNDaaaaaaaa', title: '옛 편', channel: '가 채널', upload_date: '20260901', duration: 30, view_count: 7100 },
    NEWNaaaaaaa: { id: 'NEWNaaaaaaa', title: '찾은 편', channel: '찾은 채널', upload_date: '20261022', duration: 9, view_count: 21000, like_count: 800,
      comment_count: 3, comments: [
        { id: 'c1', parent: 'root', text: '이거 나도 그랬다', like_count: 50, author: '홍길동', author_id: 'UCauthorsecret000000000a' },
        { id: 'c2', parent: 'c1', text: '답글', like_count: 999, author: '답글러' },
        { id: 'c3', parent: 'root', text: '@someone 저장!', like_count: 5, author: '아무개' },
      ] },
  };
  const 틱톡 = [{ id: '7000000000000000001', title: '튄 틱톡', view_count: 30000, upload_date: '20261024', duration: 15, save_count: 400 },
    ...Array.from({ length: 30 }, (_, i) => ({ id: String(7100000000000000000n + BigInt(i)), title: 't', view_count: 2000, upload_date: '20261005' }))];
  return {
    A, N,
    yt(종류, 값) {
      const 줄 = o => ({ 상태: '됨', 줄들: [o], 오류: '', 오류글: '' });
      if (종류 === '탭') return 줄(탭[값.id]);
      if (종류 === '검색') return { 상태: '됨', 줄들: [{ id: 'NEWNaaaaaaa', ie_key: 'Youtube', title: '찾은 편', view_count: 20000, duration: 9, channel_id: N, channel: '찾은 채널' }], 오류: '', 오류글: '' };
      if (종류 === '영상') return { 상태: '됨', 줄들: [영상[값.id]], 오류: '', 오류글: 값.댓글수 ? '[youtube] Downloading ~1,234 comments' : '' };
      if (종류 === '틱톡') return { 상태: '됨', 줄들: 틱톡, 오류: '', 오류글: '' };
      throw new Error(종류);
    },
    rss(url) {
      const id = 'UC' + /UUSH(.{22})/.exec(url)[1];
      return { 상태: '됨', 글: rss글(rss[id]), 오류: '' };
    },
  };
}

test('브랜드 스캔 두 회차 — 검색으로 채널 찾기·상한·댓글 본문만·다시볼, 둘째 주에는 쇼츠 탭을 안 읽고 새 편만', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const 출력 = fs.mkdtempSync(path.join(os.tmpdir(), '수요스캔-시험-'));
  try {
    const 장면 = 가짜장면();
    const 불림 = [];
    const 부르개 = { 셈: { 호출: 0, 막힘: 0, 멈춘서비스: [] },
      async yt(종류, 값) { 불림.push([종류, 값.id || 값.핸들 || 값.어]); return 장면.yt(종류, 값); },
      async rss(url) { 불림.push(['rss', url]); return 장면.rss(url); } };
    const { 설정, 오류 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: 장면.A, 이름: '가 채널', 핸들: '@aa' }],
      틱톡: [{ 핸들: 'tt_one' }], 검색: { 어: ['q1', 'q2'], 회차당: 1 }, 판정: { 최소조회: 3000 }, 틱톡판정: { 최소조회: 10000 }, 못잼: [] }, 'lab-en');
    assert.deepEqual(오류, []);
    const o = 스캔.인자(['lab-en', '--상세', '2', '--댓글', '1', '--기준선', '14']); // 2주마다 탭을 읽는 느린 쪽(막힘이 잦을 때)
    const 누적 = 판정.빈누적('lab-en');

    const 하나 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    const 새 = 하나.요약.새튄편;
    assert.deepEqual(새.map(r => r.id), ['7000000000000000001', 'NEWNaaaaaaa', 'NEW1aaaaaaa', 'NEW2aaaaaaa'], '조회 순: 틱톡·찾은 채널·시드');
    const 찾은 = 새.find(r => r.id === 'NEWNaaaaaaa');
    assert.equal(찾은.길이, 9);
    assert.equal(찾은.댓글수, 1234, '전체 댓글 수는 --verbose 줄에서');
    assert.equal(찾은.찾은길, '검색 「q1」');
    assert.equal(새.find(r => r.id === 'NEW2aaaaaaa').상세, '상한');
    assert.deepEqual(하나.요약.날짜모름.map(r => r.id), ['UNDaaaaaaaa']);
    assert.deepEqual(Object.keys(누적.튄편).sort(), ['7000000000000000001', 'NEW1aaaaaaa', 'NEW2aaaaaaa', 'NEWNaaaaaaa'], '날짜가 확정돼 실은 편은 보고한 편');
    assert.equal(누적.튄편.NEW2aaaaaaa.보충, true, '상한으로 길이를 못 읽은 편은 보충 대상');
    assert.equal(누적.튄편.NEW1aaaaaaa.길이, 12);
    assert.deepEqual(Object.keys(누적.다시볼).sort(), ['UNDaaaaaaaa'], '다시볼은 날짜 모르는 편만');
    assert.ok(누적.찾은채널[장면.N]);
    assert.equal(누적.검색차례, 1);
    const 댓글파일 = path.join(출력, '댓글', 'lab-en', 'NEWNaaaaaaa.json');
    const 댓글글 = fs.readFileSync(댓글파일, 'utf8');
    for (const 남 of ['홍길동', '답글러', '아무개', 'UCauthorsecret', 'someone', '"c1"']) assert.ok(!댓글글.includes(남), `댓글 파일에 「${남}」`);
    assert.equal(JSON.parse(댓글글).댓글.length, 2);
    const 누적글 = 판정.줄맞춰(누적);
    assert.ok(!누적글.includes('새 편') && !누적글.includes('이거 나도'), '누적에는 제목·댓글이 없다');

    // 둘째 주: 기준선이 7일밖에 안 돼(--기준선 14) 쇼츠 탭은 안 읽는다. 다시볼(UND)과 보충(NEW2)을 마저 읽고, 보고한 편은 다시 안 나온다
    불림.length = 0;
    const 둘 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    assert.ok(!불림.some(([종류]) => 종류 === '탭'), '둘째 주에는 쇼츠 탭을 안 읽는다');
    assert.ok(불림.some(([종류, 대상]) => 종류 === 'rss' && 대상.includes('a'.repeat(22))), 'RSS는 읽는다');
    assert.deepEqual(둘.요약.새튄편, [], 'RSS에 아직 있는 NEW2도 이미 보고한 편이라 새 튄 편으로 다시 안 낸다');
    assert.deepEqual(둘.요약.보충.map(r => [r.id, r.길이, r.보고한날]), [['NEW2aaaaaaa', 20, '2026-10-26']], '길이를 마저 읽어 보충에 적는다');
    assert.match(판정.요약글({ 날짜: '2026-11-02', 규칙: '', 브랜드: { 'lab-en': 둘.요약 } }), /지난 목록 보충 1편[\s\S]*NEW2aaaaaaa\(6\.8천 · ×6\.8 · 2026-10-24 · 20초\)/);
    assert.equal(누적.튄편.NEW2aaaaaaa.길이, 20);
    assert.ok(!누적.튄편.NEW2aaaaaaa.보충);
    assert.ok(불림.some(([종류, 대상]) => 종류 === '영상' && 대상 === 'UNDaaaaaaaa'), 'RSS에도 없고 탭도 안 읽은 UND는 다시볼로만 후보가 된다');
    assert.deepEqual(둘.요약.날짜모름, [], 'UND는 영상 정보로 보니 창 밖(09-01)');
    assert.deepEqual(누적.다시볼, {});
    assert.equal(누적.채널[장면.A].편.UNDaaaaaaaa, '2026-09-01', '창 밖으로 드러난 날짜도 기억한다');
    assert.deepEqual(누적.틱톡.tt_one, { 중앙값: 2000, 편수: 30, 잰날: '2026-11-02' }, '틱톡은 기준선만 둔다');
    assert.ok(누적.튄편.NEW2aaaaaaa);
    assert.equal(둘.요약.표본.검색.어[0], 'q2', '검색어는 돌려 가며');
  } finally {
    fs.rmSync(출력, { recursive: true, force: true });
  }
});

test('탭을 안 읽는 주에 RSS가 막히면 — 지난번 된 갈래부터 세 번까지 부르고, 그래도 안 되면 쇼츠 탭을 읽는다', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const 출력 = fs.mkdtempSync(path.join(os.tmpdir(), '수요스캔-시험-'));
  try {
    const 장면 = 가짜장면();
    let rss막힘 = false;
    const 불림 = [];
    const 쉼 = [];
    const 부르개 = { 셈: { 호출: 0, 막힘: 0, 멈춘서비스: [] }, async 쉬기(ms) { 쉼.push(ms); },
      async yt(종류, 값) { 불림.push([종류, 값.id || 값.핸들 || 값.어]); return 장면.yt(종류, 값); },
      async rss(url) { 불림.push(['rss', url]); return rss막힘 ? { 상태: '실패', 글: '', 오류: 'HTTP 500' } : 장면.rss(url); } };
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: 장면.A, 이름: '가 채널' }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const o = 스캔.인자(['lab-en', '--상세', '0', '--댓글', '0', '--틱톡', '0', '--기준선', '14']);
    const 누적 = 판정.빈누적('lab-en');
    await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.equal(누적.채널[장면.A].rss, '쇼츠');
    rss막힘 = true;
    불림.length = 0;
    const 둘 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    const rss들 = 불림.filter(([종류]) => 종류 === 'rss').map(([, u]) => (u.includes('playlist_id=UUSH') ? '쇼츠' : '채널'));
    assert.deepEqual(rss들, ['쇼츠', '채널', '쇼츠'], '지난번 된 쇼츠 RSS부터, 채널 RSS, 3초 쉬고 쇼츠 RSS 한 번 더');
    assert.deepEqual(쉼, [3000]);
    assert.ok(불림.some(([종류, 대상]) => 종류 === '탭' && 대상 === 장면.A), 'RSS가 다 막히면 쇼츠 탭을 읽는다');
    assert.equal(둘.요약.표본.유튜브.읽음, 1, '그 채널은 이번 주에도 읽은 것으로 센다');
    assert.ok(!둘.요약.못잼.some(m => m.계정 === '가 채널'));
  } finally {
    fs.rmSync(출력, { recursive: true, force: true });
  }
});

test('RSS가 채널 셋을 연달아 다 실패하면 남은 채널은 RSS를 안 부르고 쇼츠 탭으로만 읽는다(브랜드를 건너서 센다)', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const 출력 = fs.mkdtempSync(path.join(os.tmpdir(), '수요스캔-시험-'));
  try {
    const ids = ['p', 'q', 'r', 's'].map(c => 'UC' + c.repeat(22));
    const 불림 = [];
    const 부르개 = { 셈: { 호출: 0, 막힘: 0, 멈춘서비스: [] }, async 쉬기() {},
      async yt(종류, 값) {
        불림.push([종류, 값.id]);
        return { 상태: '됨', 줄들: [{ id: 값.id, channel: 값.id, uploader_id: '@' + 값.id.slice(2, 6), channel_follower_count: 1000,
          entries: Array.from({ length: 10 }, (_, i) => ({ id: vid('T', i), title: 't', view_count: 100 })) }], 오류: '', 오류글: '' };
      },
      async rss(url) { 불림.push(['rss', url]); return { 상태: '없음', 글: '', 오류: 'HTTP 404' }; } };
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: ids.map(id => ({ id })), 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const o = 스캔.인자(['lab-en', '--상세', '0', '--댓글', '0', '--틱톡', '0']);
    const 캐시 = new Map();
    const 하나 = await 스캔.브랜드스캔({ 설정, 누적: 판정.빈누적('lab-en'), o, 부르개, 캐시, 오늘: '2026-10-26', 출력 });
    assert.equal(불림.filter(([종류]) => 종류 === 'rss').length, 9, '앞 세 채널만 세 번씩');
    assert.equal(하나.요약.표본.유튜브.읽음, 4, '네 채널 모두 쇼츠 탭으로 읽었다');
    assert.equal(하나.요약.표본.유튜브.rss멈춤, true);
    assert.match(판정.요약글({ 날짜: '2026-10-26', 규칙: '', 브랜드: { 'lab-en': 하나.요약 } }), /RSS가 막혀 일부는 쇼츠 탭으로만/);
    불림.length = 0;
    await 스캔.브랜드스캔({ 설정: { ...설정, 브랜드: 'lab-en' }, 누적: 판정.빈누적('lab-en'), o, 부르개, 캐시: Object.assign(new Map(), { rss연속실패: 캐시.rss연속실패 }), 오늘: '2026-10-26', 출력 });
    assert.equal(불림.filter(([종류]) => 종류 === 'rss').length, 0, '같은 회차의 다음 브랜드도 RSS를 안 부른다');
  } finally {
    fs.rmSync(출력, { recursive: true, force: true });
  }
});

test('우리 계정 — 핸들만으로 채널을 찾아 비교 줄에만 두고, 새 튄 편·보고 목록에는 넣지 않는다', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const 출력 = fs.mkdtempSync(path.join(os.tmpdir(), '수요스캔-시험-'));
  try {
    const OURS = 'UC' + 'o'.repeat(22);
    const 탭 = { id: OURS, channel: '우리', uploader_id: '@ours', channel_follower_count: 8,
      entries: [{ id: 'OUR1aaaaaaa', title: '우리 편', view_count: 3440 }, ...Array.from({ length: 12 }, (_, i) => ({ id: vid('U', i), title: 'u', view_count: 172 }))] };
    const 불림 = [];
    const 부르개 = { 셈: { 호출: 0, 막힘: 0, 멈춘서비스: [] }, async 쉬기() {},
      async yt(종류, 값) {
        불림.push([종류, 값.id || 값.핸들]);
        if (종류 === '탭') return { 상태: '됨', 줄들: [탭], 오류: '', 오류글: '' };
        if (종류 === '틱톡') return { 상태: '됨', 줄들: [{ id: '7200000000000000001', view_count: 4000, upload_date: '20261024', duration: 20 },
          ...Array.from({ length: 6 }, (_, i) => ({ id: String(7300000000000000000n + BigInt(i)), view_count: 100, upload_date: '20261010' }))], 오류: '', 오류글: '' };
        // 10-28 우리 편 댓글 — 창 안 우리 편의 댓글 본문만 읽는다(쓴 사람 칸은 버린다)
        if (종류 === '영상' && 값.id === 'OUR1aaaaaaa' && 값.댓글수 > 0) return { 상태: '됨', 줄들: [{ id: 'OUR1aaaaaaa', title: '우리 편', upload_date: '20261025', duration: 20,
          view_count: 3440, comments: [{ id: 'k1', parent: 'root', text: '이거 저장해요 다음 편도요', like_count: 4, author: '보는사람', author_id: 'UCviewer0000000000000000' }] }], 오류: '', 오류글: '[youtube] Downloading ~1 comments' };
        throw new Error(`우리 계정에는 ${종류}를 부르지 않는다`);
      },
      async rss(url) { 불림.push(['rss', url]); return { 상태: '됨', 글: rss글([{ id: 'OUR1aaaaaaa', 날짜: '2026-10-25', 조회: 3440 }]), 오류: '' }; } };
    const { 설정 } = 판정.설정검사({ 브랜드: 'synkbrief', 이름: '시험', 유튜브: [{ 핸들: '@ours', 이름: '우리', 우리: true }],
      틱톡: [{ 핸들: 'our_tt', 우리: true }], 검색: { 어: ['q'], 회차당: 0 } }, 'synkbrief');
    const o = 스캔.인자(['synkbrief', '--기준선', '14']);
    const 누적 = 판정.빈누적('synkbrief');
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.deepEqual(요약.새튄편, [], '우리 편은 3배를 넘어도 새 튄 편이 아니다');
    assert.deepEqual(Object.keys(누적.튄편), []);
    assert.deepEqual(요약.우리.map(u => [u.곳, u.계정, u.기준.중앙값]), [['유튜브', '@ours', 172], ['틱톡', '@our_tt', 100]]);
    assert.deepEqual(요약.우리[0].편[0], { id: 'OUR1aaaaaaa', 날짜: '2026-10-25', 조회: 3440, 배수: 20 });
    assert.deepEqual(요약.우리[0].댓글.map(d => [d.id, d.읽은수, d.파일]), [['OUR1aaaaaaa', 1, '댓글/synkbrief/우리_OUR1aaaaaaa.json']], '우리 편 댓글을 모은다');
    const 우리댓글 = fs.readFileSync(path.join(출력, '댓글', 'synkbrief', '우리_OUR1aaaaaaa.json'), 'utf8');
    assert.match(우리댓글, /다음 편도요/);
    assert.doesNotMatch(우리댓글, /보는사람|UCviewer/, '쓴 사람 이름·아이디는 남기지 않는다');
    assert.match(판정.요약글({ 날짜: '2026-10-26', 브랜드: { synkbrief: 요약 } }), /우리 편 댓글 \*\*OUR1aaaaaaa\*\*/);
    assert.equal(누적.채널[OURS].핸들, '@ours', '핸들로 찾은 채널 ID를 누적에 둔다');
    assert.ok(불림.some(([종류, 대상]) => 종류 === '탭' && 대상 === '@ours'));
    불림.length = 0;
    await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    assert.ok(!불림.some(([종류]) => 종류 === '탭'), '둘째 주에는 누적의 ID로 RSS만');
    assert.ok(불림.some(([종류, 대상]) => 종류 === 'rss' && 대상.includes('o'.repeat(22))));
  } finally {
    fs.rmSync(출력, { recursive: true, force: true });
  }
});

// ── 2차 검수(아르곤 A1~A5·B1~B3 · GPT GA1~GA6·GB1~GB3, 10-23) 재현 ──
// 원문: .tmp/검수/수요스캔-도구-20261023/지적표.md

function 임시폴더() {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  return fs.mkdtempSync(path.join(os.tmpdir(), '수요스캔-검수-'));
}

function 가짜(yt, rss = () => ({ 상태: '실패', 글: '', 오류: 'HTTP 500' })) {
  const 불림 = [];
  return { 불림, 셈: { 호출: 0, 막힘: 0, 멈춘서비스: [] }, async 쉬기() {},
    async yt(종류, 값) { 불림.push([종류, 값.id || 값.핸들 || 값.어]); return yt(종류, 값); },
    async rss(url) { 불림.push(['rss', url]); return rss(url); } };
}

function 탭응답(id, entries, extra = {}) {
  return { 상태: '됨', 줄들: [{ id, channel: extra.channel || '채널', uploader_id: extra.handle || null, channel_follower_count: extra.subs ?? 50000, entries }], 오류: '', 오류글: '' };
}

const 평범30 = (글자, 조회 = 1000) => Array.from({ length: 30 }, (_, i) => ({ id: vid(글자, i), title: 't', view_count: 조회 }));

test('검수 A1·GA1 — 정확한 조회(영상 정보·RSS)가 있으면 반올림된 탭 조회보다 그것을 믿는다', () => {
  const 기준 = { 중앙값: 1000, 편수: 30, 구독: 50000, 출처: '이번' };
  const 후보 = { id: vid('X', 1), 제목: '', 조회: 3000, 날짜: '2026-10-20' };
  assert.equal(판정.상세반영(후보, { 날짜: '2026-10-20', 조회: 2999 }, 기준, 판정.기본.판정, '2026-09-28').아님, true, '정확한 2,999는 3배·최소 조회 미달');
  assert.equal(판정.상세반영(후보, { 날짜: '2026-10-20', 조회: 3100 }, 기준, 판정.기본.판정, '2026-09-28').줄.조회, 3100);
  assert.equal(판정.상세반영(후보, { 날짜: '2026-10-20' }, 기준, 판정.기본.판정, '2026-09-28').줄.조회, 3000, '영상 정보에 조회가 없으면 후보 조회');
  const X = vid('X', 2);
  const 탭 = 탭만들기([{ id: X, 제목: '', 조회: 3000 }]);
  const rss = { 전체수: 15, 편: [{ id: X, 날짜: '2026-10-20T00:00:00Z', 쇼츠: true, 조회: 2999 },
    ...Array.from({ length: 14 }, (_, i) => ({ id: vid('B', i), 날짜: '2026-09-01T00:00:00Z', 쇼츠: true, 조회: 1000 }))] };
  assert.deepEqual(판정.채널정리({ 탭, rss, 오늘: '2026-10-26' }).후보.map(h => h.id), [], '탭(반올림 3천)과 RSS(정확한 2,999)가 함께 있으면 RSS');
  const rss없는수 = { 전체수: 1, 편: [{ id: X, 날짜: '2026-10-20T00:00:00Z', 쇼츠: true, 조회: null }] };
  assert.deepEqual(판정.채널정리({ 탭, rss: rss없는수, 오늘: '2026-10-26' }).후보.map(h => h.id), [X], '정확한 수가 없으면 탭 조회로');
});

test('검수 A2·GA6 — 쇼츠가 5편이 안 돼 기준선을 못 만든 채널은 다음 회차에 쇼츠 탭을 다시 읽는다', () => {
  assert.equal(판정.탭다시읽기({ 편수: 4, 중앙값: null, 기준선잰날: '2026-10-26' }, '2026-11-02', 14), true);
  assert.equal(판정.탭다시읽기({ 편수: 0, 중앙값: null, 기준선잰날: '2026-11-01' }, '2026-11-02', 14), true);
  assert.equal(판정.탭다시읽기({ 편수: 30, 중앙값: 1000, 기준선잰날: '2026-10-26' }, '2026-11-02', 14), false);
});

test('검수 A3·GA2 — JSON을 일부 받았어도 403·429로 끝난 호출은 막힘으로 센다(받은 줄은 쓰고, 쉬고, 연달아 셋이면 멈춤)', async () => {
  let 지금 = 0;
  let 불림 = 0;
  const 시각 = [];
  const 실행기 = async () => { 불림 += 1; 시각.push(지금); return { 코드: 1, 출력: '{"id":"aaaaaaaaaaa"}\n', 오류글: 'ERROR: Unable to download API page: HTTP Error 429: Too Many Requests', ms: 1 }; };
  const p = new 수집.부르개({ 간격초: 0, 막힘쉼초: 30, 막힘한도: 3, 실행기, 쉬기: async ms => { 지금 += ms; }, 지금: () => 지금 });
  const 결과 = [];
  for (let i = 0; i < 4; i += 1) 결과.push(await p.yt('검색', { 어: 'q' }));
  assert.deepEqual(결과.map(r => r.상태), ['일부', '일부', '일부', '멈춤']);
  assert.ok(결과.slice(0, 3).every(r => r.막힘 === true && r.줄들.length === 1), '받은 줄은 쓰되 막힘 표시');
  assert.equal(불림, 3);
  assert.equal(p.셈.막힘, 3);
  assert.ok(시각[1] - 시각[0] >= 30000, '막힌 뒤 30초 쉰다');
});

test('검수 A4 — 한글·키릴 바로 뒤에 붙은 @아이디도 가린다', () => {
  const 글 = 판정.가리기('친구@kimcs 선생님@idoclass_ Привет@ivan_k 메일 a.b@example.com 끝');
  for (const 남 of ['kimcs', 'idoclass_', 'ivan_k']) assert.ok(!글.includes(남), 남);
  assert.equal(글, '친구@… 선생님@… Привет@… 메일 [메일] 끝');
});

test('검수 GA3 — 점·괄호·공백으로 나눈 전화번호도 가린다(날짜·소수·천 단위 수는 그대로)', () => {
  const 글 = 판정.가리기('전화 010.1234.5678 또는 (212) 555-0123, 몽골 +976 9911 2233. 붙여서 01012345678 날짜 2026.10.23 값 3.14 조회 1,234,567');
  for (const 남 of ['010.1234', '555-0123', '(212)', '9911 2233', '01012345678']) assert.ok(!글.includes(남), 남);
  assert.equal((글.match(/\[번호\]/g) || []).length, 4);
  assert.ok(글.includes('2026.10.23') && 글.includes('3.14') && 글.includes('1,234,567'), 글);
  assert.ok(!판정.댓글줄이기([{ parent: 'root', text: '연락 010.1234.5678', like_count: 1 }])[0].글.includes('5678'));
  assert.equal(판정.가리기('010.1234.5678 (212) 555-0123'), '[번호] [번호]', '붙어 있는 두 번호를 따로 가린다');
});

test('검수 A5 — 쇼츠 탭에 남은 옛 히트의 날짜는 편 수 상한(60)에 잘리지 않는다', () => {
  const 옛히트 = vid('H', 1);
  const 편 = {};
  for (let i = 0; i < 65; i += 1) 편[vid('R', i)] = `2026-10-${String(1 + (i % 25)).padStart(2, '0')}`;
  편[옛히트] = '2026-08-01';
  const 이전 = { 구독: 50000, 중앙값: 1000, 편수: 30, 기준선잰날: '2026-10-19', 편 };
  const r = 판정.채널정리({ 이전, 탭: 탭만들기([{ id: 옛히트, 제목: '', 조회: 90000 }]), rss: null, 오늘: '2026-10-26' });
  assert.equal(r.상태.편[옛히트], '2026-08-01');
  assert.deepEqual(r.후보.map(h => h.id), [], '날짜를 알아 창 밖으로 거른다');
});

test('검수 B1 — 검색은 실제로 돈 만큼만 차례를 넘긴다(막힌 검색어부터 다음 회차에)', async () => {
  const 출력 = 임시폴더();
  try {
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: 'UC' + 'k'.repeat(22) }], 검색: { 어: ['q1', 'q2', 'q3', 'q4', 'q5'], 회차당: 3 } }, 'lab-en');
    const o = 스캔.인자(['lab-en', '--상세', '0', '--틱톡', '0', '--채널', '0']);
    const 한번막힘 = 가짜((종류, 값) => (값.어 === 'q1' ? { 상태: '됨', 줄들: [], 오류: '', 오류글: '' } : { 상태: '막힘', 줄들: [], 오류: 'HTTP Error 429', 오류글: '' }));
    const 누적 = 판정.빈누적('lab-en');
    await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 한번막힘, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.equal(누적.검색차례, 1, 'q1만 돌았다 — 다음 회차는 q2부터');
    const 다막힘 = 가짜(() => ({ 상태: '막힘', 줄들: [], 오류: 'HTTP Error 429', 오류글: '' }));
    await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 다막힘, 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    assert.equal(누적.검색차례, 1, '하나도 못 돌았으면 그대로');
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

function main시험폴더(설정) {
  const fs = require('node:fs');
  const path = require('node:path');
  const 뿌리 = 임시폴더();
  const 폴더 = { 뿌리, 설정: path.join(뿌리, '설정'), 누적: path.join(뿌리, '누적'), 출력: path.join(뿌리, '출력') };
  fs.mkdirSync(폴더.설정, { recursive: true });
  fs.mkdirSync(폴더.누적, { recursive: true });
  fs.writeFileSync(path.join(폴더.설정, '수요_lab-en.json'), JSON.stringify(설정));
  폴더.누적파일 = path.join(폴더.누적, '수요_lab-en.json');
  return 폴더;
}

test('검수 B1 — 브랜드에서 한 곳도 못 읽은 회차는 누적을 덮지 않는다', async () => {
  const fs = require('node:fs');
  const A = 'UC' + 'm'.repeat(22);
  const 폴더 = main시험폴더({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q1', 'q2', 'q3'], 회차당: 2 } });
  try {
    const 옛 = { ...판정.빈누적('lab-en'), 마지막스캔: '2026-10-19T00:00:00.000Z', 검색차례: 1 };
    fs.writeFileSync(폴더.누적파일, 판정.줄맞춰(옛) + '\n');
    const 앞 = fs.readFileSync(폴더.누적파일, 'utf8');
    const 부르개 = 가짜(() => ({ 상태: '막힘', 줄들: [], 오류: 'HTTP Error 429', 오류글: '' }), () => ({ 상태: '막힘', 글: '', 오류: 'HTTP 429' }));
    const 코드 = await 스캔.main(['lab-en', '--누적', 폴더.누적, '--출력', 폴더.출력, '--날짜', '2026-10-26', '--틱톡', '0'], { 부르개, 설정폴더: 폴더.설정 });
    assert.equal(코드, 1);
    assert.equal(fs.readFileSync(폴더.누적파일, 'utf8'), 앞, '누적은 그대로');
    assert.ok(fs.existsSync(require('node:path').join(폴더.출력, '요약.md')), '못 잰 요약은 남긴다');
  } finally {
    fs.rmSync(폴더.뿌리, { recursive: true, force: true });
  }
});

test('검수 B2 — 핸들만 적은 시드 채널이 검색에 잡혀도 「찾은 채널」로 따로 들지 않고, 다음 회차에 두 번 읽히지 않는다', async () => {
  const 출력 = 임시폴더();
  try {
    const X = 'UC' + 'x'.repeat(22);
    const 탭 = 탭응답(X, [{ id: 'HITxxxxxxxx', title: '튄 편', view_count: 9000 }, ...평범30('S')], { handle: '@seedx', channel: '시드 채널' });
    const rss = () => ({ 상태: '됨', 글: rss글([{ id: 'HITxxxxxxxx', 날짜: '2026-10-25', 조회: 9000 }]), 오류: '' });
    const yt = (종류, 값) => {
      if (종류 === '탭') return 탭;
      if (종류 === '검색') return { 상태: '됨', 줄들: [{ id: 'HITxxxxxxxx', ie_key: 'Youtube', title: '튄 편', view_count: 9000, duration: 30, channel_id: X, channel: '시드 채널' }], 오류: '', 오류글: '' };
      if (종류 === '영상') return { 상태: '됨', 줄들: [{ id: 'HITxxxxxxxx', title: '튄 편', upload_date: '20261025', duration: 30, view_count: 9100 }], 오류: '', 오류글: '' };
      throw new Error(종류);
    };
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ 핸들: '@seedx', 이름: '시드 채널' }], 검색: { 어: ['q'], 회차당: 1 } }, 'lab-en');
    const 누적 = 판정.빈누적('lab-en');
    // 첫 회차: 시드를 --채널 0으로 건너뛰어(또는 탭이 막혀) 시드의 ID를 아직 모른다
    await 스캔.브랜드스캔({ 설정, 누적, o: 스캔.인자(['lab-en', '--채널', '0', '--틱톡', '0', '--상세', '0']), 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.ok(!(X in 누적.찾은채널), '핸들이 시드와 같으면 찾은 채널이 아니다');
    assert.equal(누적.채널[X].핸들, '@seedx');
    const 둘 = await 스캔.브랜드스캔({ 설정, 누적, o: 스캔.인자(['lab-en', '--틱톡', '0', '--검색', '0']), 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    assert.equal(둘.요약.표본.유튜브.대상, 1, '같은 채널을 두 번 세지 않는다');
    const 나온 = [...둘.요약.새튄편, ...(둘.요약.보충 || [])].filter(r => r.id === 'HITxxxxxxxx');
    assert.equal(나온.length, 1, '같은 편을 두 번 내지 않는다(첫 회차에 길이 없이 실어 이번에는 보충으로 한 번)');
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('검수 B2 — 핸들을 모르는 옛 「찾은 채널」이 이번 회차에 핸들 시드와 같은 채널로 드러나도 한 번만 읽고 한 번만 낸다', async () => {
  const 출력 = 임시폴더();
  try {
    const Y = 'UC' + 'y'.repeat(22);
    const 탭 = 탭응답(Y, [{ id: 'HITyyyyyyyy', title: '튄 편', view_count: 9000 }, ...평범30('T')], { handle: '@seedy', channel: '시드 채널' });
    const yt = (종류, 값) => {
      if (종류 === '탭') return 탭;
      if (종류 === '영상') return { 상태: '됨', 줄들: [{ id: 'HITyyyyyyyy', upload_date: '20261025', duration: 30, view_count: 9100 }], 오류: '', 오류글: '' };
      throw new Error(종류);
    };
    const rss = () => ({ 상태: '됨', 글: rss글([{ id: 'HITyyyyyyyy', 날짜: '2026-10-25', 조회: 9000 }]), 오류: '' });
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ 핸들: '@seedy' }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    // 옛 누적: 찾은 채널 Y의 칸에 핸들이 없다(그때 쇼츠 탭을 못 읽었다) — 시작 때는 시드인지 알 수 없다
    const 누적 = { ...판정.빈누적('lab-en'), 찾은채널: { [Y]: { 찾은날: '2026-10-12', 마지막튐: null } },
      채널: { [Y]: { 구독: 50000, 중앙값: 1000, 편수: 30, 기준선잰날: '2026-10-12', 편: {} } } };
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적, o: 스캔.인자(['lab-en', '--틱톡', '0']), 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.equal(요약.표본.유튜브.대상, 1);
    assert.deepEqual(요약.새튄편.map(r => r.id), ['HITyyyyyyyy']);
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

function rss글이름(이름, 편) {
  return rss글(편).replace('<feed>', `<feed><title>Short videos</title><author><name>${이름}</name><uri>x</uri></author>`);
}

test('검수 B3 — 검색으로 찾은 채널은 탭을 안 읽는 주에도 RSS·대신 읽은 탭의 채널 이름으로 보인다', async () => {
  const 출력 = 임시폴더();
  try {
    const N = 'UC' + 'q'.repeat(22);
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: 'UC' + 'z'.repeat(22) }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const 기본누적 = () => ({ ...판정.빈누적('lab-en'), 찾은채널: { [N]: { 찾은날: '2026-10-19', 마지막튐: null } },
      채널: { [N]: { 구독: 9000, 중앙값: 500, 편수: 30, 기준선잰날: '2026-10-19', 편: {}, rss: '쇼츠' } } });
    const o = 스캔.인자(['lab-en', '--틱톡', '0', '--상세', '0', '--기준선', '14']);
    const 시드막힘 = id => id === N;
    const RSS됨 = 가짜((종류, 값) => (시드막힘(값.id) ? 탭응답(N, 평범30('Q', 500), { channel: '탭 이름' }) : { 상태: '막힘', 줄들: [], 오류: '', 오류글: '' }),
      url => (url.includes('q'.repeat(22)) ? { 상태: '됨', 글: rss글이름('찾은 채널 이름', [{ id: 'NQaaaaaaaaa', 날짜: '2026-10-24', 조회: 600 }]), 오류: '' } : { 상태: '실패', 글: '', 오류: 'HTTP 500' }));
    const 하나 = await 스캔.브랜드스캔({ 설정, 누적: 기본누적(), o, 부르개: RSS됨, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.equal(하나.원자료.채널.find(c => c.id === N).이름, '찾은 채널 이름', 'RSS 머리의 채널 이름');
    const 탭대신 = 가짜((종류, 값) => (시드막힘(값.id) ? 탭응답(N, 평범30('Q', 500), { channel: '탭 이름' }) : { 상태: '막힘', 줄들: [], 오류: '', 오류글: '' }));
    const 둘 = await 스캔.브랜드스캔({ 설정, 누적: 기본누적(), o, 부르개: 탭대신, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.equal(둘.원자료.채널.find(c => c.id === N).이름, '탭 이름', 'RSS가 막혀 대신 읽은 쇼츠 탭의 채널 이름');
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('검수 GA4 — 기본값으로는 회차마다 쇼츠 탭을 읽어, RSS 최신 15편 밖으로 밀린 편이 뒤늦게 튀어도 잡는다', async () => {
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'g'.repeat(22);
    let 늦은조회 = 1500;
    const yt = (종류, 값) => {
      if (종류 === '탭') return 탭응답(A, [{ id: 'LATEgggggg1', title: '늦게 뜬 편', view_count: 늦은조회 }, ...평범30('G')]);
      if (종류 === '영상') return { 상태: '됨', 줄들: [{ id: 값.id, title: '늦게 뜬 편', upload_date: '20261024', duration: 20, view_count: 늦은조회 }], 오류: '', 오류글: '' };
      throw new Error(종류);
    };
    let rss편 = [{ id: 'LATEgggggg1', 날짜: '2026-10-24', 조회: 1500 }, ...Array.from({ length: 14 }, (_, i) => ({ id: vid('G', i), 날짜: '2026-10-10', 조회: 1000 }))];
    const rss = () => ({ 상태: '됨', 글: rss글(rss편), 오류: '' });
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const o = 스캔.인자(['lab-en', '--틱톡', '0']);
    const 누적 = 판정.빈누적('lab-en');
    const 하나 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.equal(하나.요약.새튄편.length, 0, '첫 주에는 1.5배라 평범');
    // 둘째 주: 새 편 15개가 RSS를 채워 LATE는 RSS 밖, 조회는 4,000(4배)
    늦은조회 = 4000;
    rss편 = Array.from({ length: 15 }, (_, i) => ({ id: vid('N', i), 날짜: '2026-11-01', 조회: 900 }));
    const 부르개 = 가짜(yt, rss);
    const 둘 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    assert.ok(부르개.불림.some(([종류]) => 종류 === '탭'), '기본은 회차마다 쇼츠 탭을 읽는다');
    assert.deepEqual(둘.요약.새튄편.map(r => [r.id, r.날짜, r.배수]), [['LATEgggggg1', '2026-10-24', 4]]);
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('검수 GA5 — RSS를 못 읽으면 탭 16번째 뒤의 날짜 모르는 튄 편도 날짜 확인 후보로 본다', () => {
  const 탭 = 탭만들기([]);
  탭.편.splice(20, 0, { id: vid('Y', 1), 제목: '', 조회: 9000 });
  assert.deepEqual(판정.채널정리({ 탭, rss: null, 오늘: '2026-10-26' }).후보.map(h => [h.id, h.날짜]), [[vid('Y', 1), null]]);
});

test('검수 GB1 — 요약·원자료를 다 쓴 뒤에만 누적(보고한 편)을 쓴다', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const A = 'UC' + 'w'.repeat(22);
  const 폴더 = main시험폴더({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } });
  try {
    fs.mkdirSync(폴더.출력, { recursive: true });
    fs.writeFileSync(path.join(폴더.출력, '원자료'), '폴더 자리에 파일 — 원자료 쓰기가 실패한다');
    const 부르개 = 가짜((종류, 값) => {
      if (종류 === '탭') return 탭응답(A, [{ id: 'HITwwwwwwww', title: 't', view_count: 9000 }, ...평범30('W')]);
      if (종류 === '영상') return { 상태: '됨', 줄들: [{ id: 값.id, upload_date: '20261025', duration: 10, view_count: 9000 }], 오류: '', 오류글: '' };
      throw new Error(종류);
    }, () => ({ 상태: '됨', 글: rss글([{ id: 'HITwwwwwwww', 날짜: '2026-10-25', 조회: 9000 }]), 오류: '' }));
    await assert.rejects(스캔.main(['lab-en', '--누적', 폴더.누적, '--출력', 폴더.출력, '--날짜', '2026-10-26', '--틱톡', '0'], { 부르개, 설정폴더: 폴더.설정 }));
    assert.ok(!fs.existsSync(폴더.누적파일), '요약을 못 남겼으면 보고한 편으로 적지 않는다');
  } finally {
    fs.rmSync(폴더.뿌리, { recursive: true, force: true });
  }
});

test('검수 GB2 — 같은 누적을 두 회차가 함께 고치지 못한다(잠금), 죽은 잠금은 걷어 낸다', async () => {
  const fs = require('node:fs');
  const A = 'UC' + 'v'.repeat(22);
  const 폴더 = main시험폴더({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } });
  const 출력2 = 임시폴더();
  try {
    let 둘째시작;
    const 둘째 = new Promise(r => { 둘째시작 = r; });
    const 만들기 = (튈id, 기다림) => 가짜(async (종류, 값) => {
      if (기다림) await Promise.race([둘째, new Promise(r => setTimeout(r, 150))]);
      else 둘째시작();
      if (종류 === '탭') return 탭응답(A, [{ id: 튈id, title: 't', view_count: 9000 }, ...평범30('V')]);
      if (종류 === '영상') return { 상태: '됨', 줄들: [{ id: 값.id, upload_date: '20261025', duration: 10, view_count: 9000 }], 오류: '', 오류글: '' };
      throw new Error(종류);
    }, () => ({ 상태: '실패', 글: '', 오류: 'HTTP 500' }));
    const 인자 = 출력 => ['lab-en', '--누적', 폴더.누적, '--출력', 출력, '--날짜', '2026-10-26', '--틱톡', '0'];
    const [코드1, 코드2] = await Promise.all([
      스캔.main(인자(폴더.출력), { 부르개: 만들기('ONEvvvvvvvv', true), 설정폴더: 폴더.설정 }),
      new Promise(r => setTimeout(r, 10)).then(() => 스캔.main(인자(출력2), { 부르개: 만들기('TWOvvvvvvvv', false), 설정폴더: 폴더.설정 })),
    ]);
    const 남은 = JSON.parse(fs.readFileSync(폴더.누적파일, 'utf8'));
    const 둘다 = 'ONEvvvvvvvv' in 남은.튄편 && 'TWOvvvvvvvv' in 남은.튄편;
    assert.ok((코드1 === 0 && 코드2 === 0) ? 둘다 : ([코드1, 코드2].includes(1) && Object.keys(남은.튄편).length >= 1),
      `두 회차가 모두 끝났다고 했는데 한쪽 보고가 사라졌다(코드 ${코드1}·${코드2}, 남은 ${Object.keys(남은.튄편)})`);
    assert.ok([코드1, 코드2].includes(1), '늦게 온 회차는 잠금에 막혀 멈춘다');
    // 죽은 회차가 남긴 잠금은 걷어 내고 돈다
    fs.writeFileSync(스캔.잠금경로(폴더.누적), JSON.stringify({ pid: 2147483646, 때: '2026-10-26T00:00:00.000Z' }));
    const 코드3 = await 스캔.main(인자(출력2), { 부르개: 만들기('THRvvvvvvvv', false), 설정폴더: 폴더.설정 });
    assert.equal(코드3, 0);
    assert.ok(!fs.existsSync(스캔.잠금경로(폴더.누적)), '끝나면 잠금을 푼다');
    // 살아 있는 회차의 잠금이면 손대지 않고 멈춘다
    fs.writeFileSync(스캔.잠금경로(폴더.누적), JSON.stringify({ pid: process.pid, 때: new Date().toISOString() }));
    const 앞 = fs.readFileSync(폴더.누적파일, 'utf8');
    assert.equal(await 스캔.main(인자(출력2), { 부르개: 만들기('FOURvvvvvvv', false), 설정폴더: 폴더.설정 }), 1);
    assert.equal(fs.readFileSync(폴더.누적파일, 'utf8'), 앞);
    fs.rmSync(스캔.잠금경로(폴더.누적), { force: true });
  } finally {
    fs.rmSync(폴더.뿌리, { recursive: true, force: true });
    fs.rmSync(출력2, { recursive: true, force: true });
  }
});

test('검수 GB3 — 「일부만 읽음」(쇼츠 탭·틱톡·영상 정보)을 요약에 남긴다', async () => {
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'p'.repeat(22);
    const 일부 = (줄들, 오류) => ({ 상태: '일부', 줄들, 오류, 오류글: '', 막힘: false });
    const yt = (종류, 값) => {
      if (종류 === '탭') return 일부([{ id: A, channel: '가', uploader_id: '@pp', channel_follower_count: 50000, entries: [{ id: 'HITpppppppp', title: 't', view_count: 9000 }, ...평범30('P')] }], 'HTTP Error 500 (다음 쪽)');
      if (종류 === '틱톡') return 일부([{ id: '7400000000000000001', view_count: 50000, upload_date: '20261024', duration: 10 },
        ...Array.from({ length: 10 }, (_, i) => ({ id: String(7500000000000000000n + BigInt(i)), view_count: 1000, upload_date: '20261010' }))], 'HTTP Error 500 (다음 쪽)');
      if (종류 === '영상') return 일부([{ id: 값.id, upload_date: '20261025', duration: 10, view_count: 9000, comments: [] }], '댓글 다음 쪽 HTTP Error 500');
      throw new Error(종류);
    };
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 틱톡: [{ 핸들: 'tt_part' }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적: 판정.빈누적('lab-en'), o: 스캔.인자(['lab-en', '--댓글', '1']), 부르개: 가짜(yt, () => ({ 상태: '됨', 글: rss글([{ id: 'HITpppppppp', 날짜: '2026-10-25', 조회: 9000 }]), 오류: '' })), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    const 일부들 = 요약.못잼.filter(m => /일부만 읽음/.test(m.까닭)).map(m => m.곳);
    assert.ok(일부들.includes('유튜브') && 일부들.includes('틱톡'), JSON.stringify(요약.못잼));
    const 줄 = 요약.새튄편.find(r => r.id === 'HITpppppppp');
    assert.equal(줄.상세, '일부');
    assert.match(줄.확인, /일부만 읽음/);
    assert.match(판정.요약글({ 날짜: '2026-10-26', 규칙: '', 브랜드: { 'lab-en': 요약 } }), /일부만 읽음/);
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

// ── 재확인 검수(아르곤 B1~B5 · GPT GB1~GB4, 10-23) 재현 ──
// 원문: .tmp/검수/수요스캔-도구-재확인-20261023/지적표.md

const 아무탭 = id => 탭응답(id, 평범30(id.slice(2, 3).toUpperCase()));
const 실패rss = () => ({ 상태: '실패', 글: '', 오류: 'HTTP 500' });

test('재확인 B1·GB4 — 찾은 채널 상한에서 밀린 채널은 누적.채널에서도 지워 다시 찾을 수 있고, 누적이 커지지 않는다', async () => {
  const 출력 = 임시폴더();
  try {
    const SEED = 'UC' + 's'.repeat(22);
    const OLD = 'UC' + 'o'.repeat(22);
    const NEW = 'UC' + 'n'.repeat(22);
    let 검색채널 = NEW;
    const yt = (종류, 값) => {
      if (종류 === '탭') return 아무탭(값.id);
      if (종류 === '검색') return { 상태: '됨', 줄들: [{ id: `HIT${검색채널.slice(2, 10)}`, ie_key: 'Youtube', title: 't', view_count: 9000, duration: 30, channel_id: 검색채널, channel: 'x' }], 오류: '', 오류글: '' };
      throw new Error(종류);
    };
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: SEED }], 검색: { 어: ['q'], 회차당: 1, 찾은채널상한: 1 } }, 'lab-en');
    const 누적 = { ...판정.빈누적('lab-en'), 찾은채널: { [OLD]: { 찾은날: '2026-10-01', 마지막튐: null } },
      채널: { [OLD]: { 구독: 9000, 중앙값: 1000, 편수: 30, 기준선잰날: '2026-10-19', 편: {} } } };
    const o = 스캔.인자(['lab-en', '--틱톡', '0']);
    await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 가짜(yt, 실패rss), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.deepEqual(Object.keys(누적.찾은채널), [NEW], '상한 1 — 새로 찾은 채널만 남는다');
    assert.ok(!(OLD in 누적.채널), '밀린 채널의 칸도 지운다');
    assert.ok(SEED in 누적.채널, '시드 칸은 남긴다');
    검색채널 = OLD;
    await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 가짜(yt, 실패rss), 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    assert.ok(OLD in 누적.찾은채널, '밀렸던 채널도 검색에 다시 잡히면 다시 찾는다');
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('재확인 B2① — 지난 회차에 날짜를 몰라 근거에서 빠졌던 편이 날짜가 확인돼 처음 실릴 때는 「다시」로 표시하지 않는다', async () => {
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'd'.repeat(22);
    let rss = 실패rss;
    const yt = (종류, 값) => {
      if (종류 === '탭') return 탭응답(A, [{ id: 'UNDdddddddd', title: 't', view_count: 9000 }, ...평범30('D')]);
      if (종류 === '영상') return { 상태: '됨', 줄들: [{ id: 값.id, upload_date: '20261020', duration: 14, view_count: 9500 }], 오류: '', 오류글: '' };
      throw new Error(종류);
    };
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const 누적 = 판정.빈누적('lab-en');
    const 하나 = await 스캔.브랜드스캔({ 설정, 누적, o: 스캔.인자(['lab-en', '--틱톡', '0', '--상세', '0']), 부르개: 가짜(yt, () => rss()), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.deepEqual(하나.요약.날짜모름.map(r => r.id), ['UNDdddddddd'], '첫 회차는 날짜를 몰라 근거에서 뺐다');
    rss = () => ({ 상태: '됨', 글: rss글([{ id: 'UNDdddddddd', 날짜: '2026-10-20', 조회: 9500 }]), 오류: '' });
    const 둘 = await 스캔.브랜드스캔({ 설정, 누적, o: 스캔.인자(['lab-en', '--틱톡', '0']), 부르개: 가짜(yt, () => rss()), 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    const 줄 = 둘.요약.새튄편.find(r => r.id === 'UNDdddddddd');
    assert.ok(줄, '날짜가 확인돼 처음으로 실린다');
    assert.ok(!줄.다시, '처음 실리는 편이다 — 「지난 목록」 표시가 아니다');
    assert.ok(!판정.요약글({ 날짜: '2026-11-02', 규칙: '', 브랜드: { 'lab-en': 둘.요약 } }).includes('↻'));
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('재확인 B2② — RSS로 날짜·조회가 확정돼 실린 편은 영상 정보만 실패해도 다음 회차에 새 튄 편으로 또 나오지 않고, 길이는 「보충」으로', async () => {
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'e'.repeat(22);
    let 영상됨 = false;
    const yt = (종류, 값) => {
      if (종류 === '탭') return 탭응답(A, [{ id: 'HITeeeeeeee', title: 't', view_count: 9000 }, ...평범30('E')]);
      if (종류 === '영상') return 영상됨 ? { 상태: '됨', 줄들: [{ id: 값.id, upload_date: '20261025', duration: 21, view_count: 9300 }], 오류: '', 오류글: '' } : { 상태: '막힘', 줄들: [], 오류: 'HTTP Error 429', 오류글: '' };
      throw new Error(종류);
    };
    const rss = () => ({ 상태: '됨', 글: rss글([{ id: 'HITeeeeeeee', 날짜: '2026-10-25', 조회: 9000 }]), 오류: '' });
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const 누적 = 판정.빈누적('lab-en');
    const o = 스캔.인자(['lab-en', '--틱톡', '0']);
    const 하나 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.deepEqual(하나.요약.새튄편.map(r => [r.id, r.상세]), [['HITeeeeeeee', '못 잼']]);
    영상됨 = true;
    const 둘 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    assert.deepEqual(둘.요약.새튄편.map(r => r.id), [], '이미 실린 편은 새 튄 편으로 다시 내지 않는다');
    assert.deepEqual((둘.요약.보충 || []).map(r => [r.id, r.길이]), [['HITeeeeeeee', 21]], '못 읽은 길이를 마저 읽어 보충에 적는다');
    assert.equal(누적.튄편.HITeeeeeeee.길이, 21);
    assert.ok(!누적.튄편.HITeeeeeeee.보충);
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('재확인 B3 — 창 안·정확한 조회가 확정된 편만 댓글을 같이 부르고, 댓글 0개면 몫을 깎지 않고 빈 파일을 만들지 않는다', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'c'.repeat(22);
    const 영상호출 = [];
    const 정보 = {
      OLDcccccccc: { upload_date: '20260801', duration: 20, view_count: 50000 },
      NEWcccccccc: { upload_date: '20261025', duration: 15, view_count: 9000, comments: [] },
      NEW2ccccccc: { upload_date: '20261024', duration: 12, view_count: 8000, comments: [{ parent: 'root', text: '좋아요', like_count: 3 }] },
    };
    const yt = (종류, 값) => {
      if (종류 === '탭') return 탭응답(A, [{ id: 'OLDcccccccc', title: 't', view_count: 50000 }, { id: 'NEWcccccccc', title: 't', view_count: 9000 }, { id: 'NEW2ccccccc', title: 't', view_count: 8000 }, ...평범30('C')]);
      if (종류 === '영상') { 영상호출.push([값.id, 값.댓글수]); return { 상태: '됨', 줄들: [{ id: 값.id, ...정보[값.id] }], 오류: '', 오류글: '' }; }
      throw new Error(종류);
    };
    // RSS 15편이 모두 창 안(10-10~)이라 RSS 밖의 OLD는 날짜 모름 후보 — 실제로는 08-01 영상
    const rss = () => ({ 상태: '됨', 글: rss글([{ id: 'NEWcccccccc', 날짜: '2026-10-25', 조회: 9000 }, { id: 'NEW2ccccccc', 날짜: '2026-10-24', 조회: 8000 },
      ...Array.from({ length: 13 }, (_, i) => ({ id: vid('C', i), 날짜: `2026-10-${String(10 + i).padStart(2, '0')}`, 조회: 1000 }))]), 오류: '' });
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적: 판정.빈누적('lab-en'), o: 스캔.인자(['lab-en', '--틱톡', '0', '--댓글', '1']), 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    const 댓글로 = Object.fromEntries(영상호출.filter(([, n]) => n > 0).map(([id]) => [id, true]));
    assert.ok(!댓글로.OLDcccccccc, '날짜 모르는 옛 히트에는 댓글을 같이 부르지 않는다');
    assert.ok(댓글로.NEW2ccccccc, '앞 편 댓글이 0개라 몫이 남아 다음 편 댓글을 모은다');
    assert.ok(!fs.existsSync(path.join(출력, '댓글', 'lab-en', 'NEWcccccccc.json')), '댓글 0개면 빈 파일을 만들지 않는다');
    assert.ok(fs.existsSync(path.join(출력, '댓글', 'lab-en', 'NEW2ccccccc.json')));
    assert.equal(요약.표본.댓글.편, 1);
  } finally {
    fs.rmSync(출력, { recursive: true, force: true });
  }
});

test('재확인 B4 — 찾은 채널의 마지막튐은 실제로 새 튄 편을 낸 때만 오늘로(영상 정보로 창 밖·미달이면 그대로)', async () => {
  const 출력 = 임시폴더();
  try {
    const SEED = 'UC' + 'f'.repeat(22);
    const D = 'UC' + 'h'.repeat(22);
    const yt = (종류, 값) => {
      if (종류 === '탭') return 값.id === D ? 탭응답(D, [{ id: 'OLDhhhhhhhh', title: 't', view_count: 50000 }, ...평범30('H')]) : { 상태: '막힘', 줄들: [], 오류: '', 오류글: '' };
      if (종류 === '영상') return { 상태: '됨', 줄들: [{ id: 값.id, upload_date: '20260801', duration: 20, view_count: 50000 }], 오류: '', 오류글: '' };
      throw new Error(종류);
    };
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: SEED }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const 누적 = { ...판정.빈누적('lab-en'), 찾은채널: { [D]: { 찾은날: '2026-10-19', 마지막튐: null } } };
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적, o: 스캔.인자(['lab-en', '--틱톡', '0']), 부르개: 가짜(yt, 실패rss), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.deepEqual(요약.새튄편, []);
    assert.equal(누적.찾은채널[D].마지막튐, null);
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('재확인 B5 — 3분 넘는 영상은 튄 편으로 싣지 않는다(유튜브 영상 정보·틱톡)', () => {
  const 기준 = { 중앙값: 1000, 편수: 30, 구독: 50000, 출처: '이번' };
  const 후보 = { id: vid('L', 1), 제목: '', 조회: 9000, 날짜: '2026-10-20' };
  assert.equal(판정.상세반영(후보, { 날짜: '2026-10-20', 조회: 9000, 길이: 200 }, 기준, 판정.기본.판정, '2026-09-28').아님, true);
  assert.ok(판정.상세반영(후보, { 날짜: '2026-10-20', 조회: 9000, 길이: 180 }, 기준, 판정.기본.판정, '2026-09-28').줄, '3분까지는 쇼츠');
  // Data API 길이는 1초 올림 — 꼭 3분인 쇼츠가 181초로 온다(10-25 대조: 같은 편이 yt-dlp 17·11·59초, API 18·12·60초)
  assert.ok(판정.상세반영(후보, { 날짜: '2026-10-20', 조회: 9000, 길이: 181, 길이출처: 'api' }, 기준, 판정.기본.판정, '2026-09-28').줄, 'API 181초는 3분 쇼츠');
  assert.equal(판정.상세반영(후보, { 날짜: '2026-10-20', 조회: 9000, 길이: 182, 길이출처: 'api' }, 기준, 판정.기본.판정, '2026-09-28').아님, true);
  assert.equal(판정.상세반영(후보, { 날짜: '2026-10-20', 조회: 9000, 길이: 181 }, 기준, 판정.기본.판정, '2026-09-28').아님, true, 'yt-dlp 길이는 그대로 180초까지');
  assert.equal(수집.api영상읽기({ id: 'x1234567890', snippet: {}, statistics: {}, contentDetails: { duration: 'PT3M1S' } }).길이출처, 'api');
  const 목록 = [
    { id: '7600000000000000001', 날짜: '2026-10-24', 조회: 50000, 길이: 240 },
    { id: '7600000000000000002', 날짜: '2026-10-23', 조회: 40000, 길이: 60 },
    ...Array.from({ length: 10 }, (_, i) => ({ id: String(7700000000000000000n + BigInt(i)), 날짜: '2026-10-10', 조회: 1000, 길이: 30 })),
  ];
  assert.deepEqual(판정.틱톡정리({ 목록, 오늘: '2026-10-26' }).후보.map(h => h.id), ['7600000000000000002']);
});

test('재확인 GB1 — 같은 날 같은 브랜드를 다시 돌려도 앞 회차의 새 튄 편이 요약에서 사라지지 않는다', async () => {
  const 앞 = { 날짜: '2026-10-26', 브랜드: { 'lab-en': { 이름: 'x', 새튄편: [{ id: 'v1', 조회: 10 }], 보충: [], 날짜모름: [] } } };
  const 뒤 = { 날짜: '2026-10-26', 브랜드: { 'lab-en': { 이름: 'x', 새튄편: [{ id: 'v2', 조회: 20 }], 보충: [], 날짜모름: [{ id: 'v1' }] } } };
  const 합 = 판정.요약합치기(앞, 뒤).브랜드['lab-en'];
  assert.deepEqual(합.새튄편.map(r => r.id), ['v2', 'v1']);
  assert.deepEqual(합.날짜모름, [], '앞 회차에 실린 편은 날짜 모름에서 뺀다');
  assert.deepEqual(판정.요약합치기({ ...앞, 날짜: '2026-10-19' }, 뒤).브랜드['lab-en'].새튄편.map(r => r.id), ['v2'], '다른 날 요약은 바꾼다');

  const fs = require('node:fs');
  const path = require('node:path');
  const A = 'UC' + 'i'.repeat(22);
  const 폴더 = main시험폴더({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } });
  try {
    const 부르개 = () => 가짜((종류, 값) => {
      if (종류 === '탭') return 탭응답(A, [{ id: 'HITiiiiiiii', title: 't', view_count: 9000 }, ...평범30('I')]);
      if (종류 === '영상') return { 상태: '됨', 줄들: [{ id: 값.id, upload_date: '20261025', duration: 10, view_count: 9000 }], 오류: '', 오류글: '' };
      throw new Error(종류);
    }, () => ({ 상태: '됨', 글: rss글([{ id: 'HITiiiiiiii', 날짜: '2026-10-25', 조회: 9000 }]), 오류: '' }));
    const 인자 = ['lab-en', '--누적', 폴더.누적, '--출력', 폴더.출력, '--날짜', '2026-10-26', '--틱톡', '0'];
    assert.equal(await 스캔.main(인자, { 부르개: 부르개(), 설정폴더: 폴더.설정 }), 0);
    assert.equal(await 스캔.main(인자, { 부르개: 부르개(), 설정폴더: 폴더.설정 }), 0);
    const 요약 = JSON.parse(fs.readFileSync(path.join(폴더.출력, '요약.json'), 'utf8'));
    assert.deepEqual(요약.브랜드['lab-en'].새튄편.map(r => r.id), ['HITiiiiiiii'], '두 번째 회차가 첫 보고를 지우지 않는다');
    assert.match(fs.readFileSync(path.join(폴더.출력, '요약.md'), 'utf8'), /HITiiiiiiii/);
  } finally {
    fs.rmSync(폴더.뿌리, { recursive: true, force: true });
  }
});

test('재확인 GB2 — 막 만들어진 빈 잠금은 깨진 것으로 지우지 않는다(1분 넘게 비어 있으면 걷어 낸다)', async () => {
  const fs = require('node:fs');
  const A = 'UC' + 'j'.repeat(22);
  const 폴더 = main시험폴더({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } });
  try {
    const 잠금 = 스캔.잠금경로(폴더.누적);
    const 부르개 = () => 가짜((종류, 값) => (종류 === '탭' ? 아무탭(값.id) : { 상태: '막힘', 줄들: [], 오류: '', 오류글: '' }));
    const 인자 = ['lab-en', '--누적', 폴더.누적, '--출력', 폴더.출력, '--날짜', '2026-10-26', '--틱톡', '0'];
    fs.writeFileSync(잠금, ''); // 다른 회차가 막 만들고 아직 내용을 안 쓴 잠금
    assert.equal(await 스캔.main(인자, { 부르개: 부르개(), 설정폴더: 폴더.설정 }), 1, '막 생긴 빈 잠금이면 멈춘다');
    assert.ok(fs.existsSync(잠금), '남의 잠금을 지우지 않는다');
    const 예전 = new Date(Date.now() - 120_000);
    fs.utimesSync(잠금, 예전, 예전);
    assert.equal(await 스캔.main(인자, { 부르개: 부르개(), 설정폴더: 폴더.설정 }), 0, '2분 넘게 빈 잠금은 죽은 잠금');
    assert.ok(!fs.existsSync(잠금));
  } finally {
    fs.rmSync(스캔.잠금경로(폴더.누적), { force: true });
    fs.rmSync(폴더.뿌리, { recursive: true, force: true });
  }
});

test('재확인 GB3 — 날짜·길이가 다 있어야 보고 끝으로 친다(길이 없는 편은 보충 대상, 날짜 없는 성공 응답은 다시볼)', async () => {
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'k'.repeat(21) + 'x';
    let 길이 = undefined;
    const yt = (종류, 값) => {
      if (종류 === '탭') return 탭응답(A, [{ id: 'HITkkkkkkkk', title: 't', view_count: 9000 }, { id: 'NODATEkkkkk', title: 't', view_count: 8000 }, ...평범30('K')]);
      if (종류 === '영상') {
        if (값.id === 'NODATEkkkkk') return { 상태: '됨', 줄들: [{ id: 값.id, duration: 30, view_count: 8000 }], 오류: '', 오류글: '' };
        return { 상태: '됨', 줄들: [{ id: 값.id, upload_date: '20261025', ...(길이 ? { duration: 길이 } : {}), view_count: 9100 }], 오류: '', 오류글: '' };
      }
      throw new Error(종류);
    };
    // RSS 15편이 다 창 안이라 RSS 밖의 NODATE는 날짜 모름 후보
    const rss = () => ({ 상태: '됨', 글: rss글([{ id: 'HITkkkkkkkk', 날짜: '2026-10-25', 조회: 9000 },
      ...Array.from({ length: 14 }, (_, i) => ({ id: vid('K', i), 날짜: `2026-10-${String(10 + i).padStart(2, '0')}`, 조회: 1000 }))]), 오류: '' });
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const 누적 = 판정.빈누적('lab-en');
    const o = 스캔.인자(['lab-en', '--틱톡', '0']);
    const 하나 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.deepEqual(하나.요약.새튄편.map(r => [r.id, r.길이]), [['HITkkkkkkkk', null]]);
    assert.equal(누적.튄편.HITkkkkkkkk.보충, true, '길이가 없으니 보고는 했지만 마저 읽을 편');
    assert.ok('NODATEkkkkk' in 누적.다시볼, '날짜 없는 성공 응답은 다시볼로');
    길이 = 33;
    const 둘 = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개: 가짜(yt, rss), 캐시: new Map(), 오늘: '2026-11-02', 출력 });
    assert.deepEqual((둘.요약.보충 || []).map(r => [r.id, r.길이]), [['HITkkkkkkkk', 33]]);
    assert.equal(누적.튄편.HITkkkkkkkk.길이, 33);
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('명령 인자 — 브랜드 순서, 전부, 숫자 검사', () => {
  assert.deepEqual(스캔.인자(['yuhobuilds', 'lab-en']).브랜드, ['lab-en', 'yuhobuilds']);
  assert.deepEqual(스캔.인자(['전부']).브랜드, 판정.브랜드목록);
  const o = 스캔.인자(['lab-en', '--채널', '5', '--검색', '1', '--틱톡', '0', '--댓글', '2', '--누적안씀', '--날짜', '2026-10-26']);
  assert.deepEqual([o.채널, o.검색, o.틱톡, o.댓글, o.누적안씀, o.날짜], [5, 1, 0, 2, true, '2026-10-26']);
  assert.throws(() => 스캔.인자(['lab-en', '--채널', '-1']), /0 이상/);
  assert.throws(() => 스캔.인자(['lab-xx']), /모르는 인자/);
  assert.throws(() => 스캔.인자(['--날짜', '10/26']), /YYYY-MM-DD/);
  assert.equal(스캔.인자(['lab-en']).유튜브, 'api', '유튜브 채널은 기본으로 Data API');
  assert.equal(스캔.인자(['lab-en', '--유튜브', 'ytdlp']).유튜브, 'ytdlp');
  assert.throws(() => 스캔.인자(['lab-en', '--유튜브', 'rss']), /api 또는 ytdlp/);
});

// ── YouTube Data API(10-25 — tools/수요스캔/서버.md 「권하는 길」) — 가짜 fetch로, 네트워크 없음 ──

/** 가짜 Data API 장면 → {api, 불림, 기록}. 채널: {id: {이름, 핸들, 구독}} · 목록: {채널id: [영상id…]}(없으면 404) · 영상: {id: {…}} */
function 가짜api({ 채널 = {}, 목록 = {}, 영상 = {}, 고장 = () => null, 토큰들 = ['TOKEN-1'] } = {}) {
  const 불림 = [];
  const 기록 = [];
  let 토큰차례 = 0;
  const 응답 = (status, 몸) => ({ ok: status >= 200 && status < 300, status, json: async () => 몸 });
  const 채널항목 = id => ({ id, snippet: { title: 채널[id].이름 || id, customUrl: 채널[id].핸들 || '' },
    statistics: { subscriberCount: String(채널[id].구독 ?? 0), hiddenSubscriberCount: 채널[id].구독 === null } });
  const fetch기 = async (url, opts) => {
    const u = new URL(url);
    const 자원 = u.pathname.split('/').pop();
    const 값 = Object.fromEntries(u.searchParams);
    불림.push([자원, 값, opts.headers.authorization]);
    const 깨짐 = 고장(자원, 값, 불림.length);
    if (깨짐) return 응답(깨짐.status, 깨짐.몸 || {});
    if (자원 === 'channels') {
      if (값.forHandle) {
        const id = Object.keys(채널).find(k => String(채널[k].핸들 || '').replace(/^@/, '') === 값.forHandle);
        return 응답(200, { items: id ? [채널항목(id)] : [] });
      }
      return 응답(200, { items: 값.id.split(',').filter(id => 채널[id]).map(채널항목) });
    }
    if (자원 === 'playlistItems') {
      const id = 'UC' + 값.playlistId.slice(4);
      if (!목록[id]) return 응답(404, { error: { errors: [{ reason: 'playlistNotFound' }] } });
      return 응답(200, { items: 목록[id].slice(0, Number(값.maxResults)).map(v => ({ contentDetails: { videoId: v } })) });
    }
    if (자원 === 'videos') {
      return 응답(200, { items: 값.id.split(',').filter(v => 영상[v]).map(v => ({ id: v,
        snippet: { title: 영상[v].제목 || v, channelId: 영상[v].채널, channelTitle: 채널[영상[v].채널]?.이름 || '', publishedAt: `${영상[v].날짜}T09:00:00Z`, description: '' },
        statistics: { viewCount: String(영상[v].조회), ...(영상[v].좋아요 === undefined ? {} : { likeCount: String(영상[v].좋아요) }), ...(영상[v].댓글 === undefined ? {} : { commentCount: String(영상[v].댓글) }) },
        contentDetails: { duration: `PT${영상[v].길이 ?? 20}S` } })) });
    }
    throw new Error(자원);
  };
  const api = new 수집.API부르개({ 토큰: async () => 토큰들[Math.min(토큰차례++, 토큰들.length - 1)], fetch기, 기록: 줄 => 기록.push(줄), 지금: () => 0 });
  return { api, 불림, 기록 };
}

/** 채널 하나의 쇼츠 30편 장면 — 맨 앞은 튄 편(9,100회 · 10-25 · 12초), 나머지 29편은 1,000회 */
function api채널장면(A, { 튄 = 'NEW1aaaaaaa', 핸들 = '@aa', 구독 = 50000 } = {}) {
  const 평범 = Array.from({ length: 29 }, (_, i) => vid('B', i));
  const 영상 = { [튄]: { 채널: A, 날짜: '2026-10-25', 조회: 9100, 좋아요: 300, 댓글: 40, 길이: 12, 제목: '새 편 1' } };
  평범.forEach((v, i) => { 영상[v] = { 채널: A, 날짜: `2026-10-${String(1 + (i % 20)).padStart(2, '0')}`, 조회: 1000, 길이: 30 }; });
  return { 채널: { [A]: { 이름: '가 채널', 핸들, 구독 } }, 목록: { [A]: [튄, ...평범] }, 영상 };
}

test('Data API 부르개 — 토큰은 머리에만(기록에 없음), 401이면 한 번 새로 받고, 한도 403이면 이 회차 멈춤, 404는 없음, 묶음은 50편씩', async () => {
  assert.equal(수집.api영상읽기({ id: 'x1234567890', snippet: { publishedAt: '2026-10-23T14:23:49Z' }, statistics: { viewCount: '14478' }, contentDetails: { duration: 'PT1M5S' } }).길이, 65);
  const 하나 = 수집.api영상읽기({ id: 'x1234567890', snippet: { title: 't', channelId: 'UCx', publishedAt: '2026-10-23T14:23:49Z' }, statistics: { viewCount: '14478', commentCount: '7' }, contentDetails: { duration: 'PT25S' } });
  assert.deepEqual([하나.조회, 하나.좋아요, 하나.댓글수, 하나.날짜, 하나.올린때], [14478, null, 7, '2026-10-23', '2026-10-23T14:23:49Z'], '좋아요를 숨기면 null');
  assert.equal(수집.api채널읽기({ id: 'UCx', snippet: { customUrl: 'hayanleekr' }, statistics: { subscriberCount: '47400' } }).핸들, '@hayanleekr');
  assert.equal(수집.api채널읽기({ id: 'UCx', snippet: {}, statistics: { hiddenSubscriberCount: true, subscriberCount: '0' } }).구독, null, '숨긴 구독은 0이 아니라 모름');

  const A = 'UC' + 'a'.repeat(22);
  const 장면 = api채널장면(A);
  // 첫 호출은 401(토큰 끝남) → 새 토큰으로 다시
  const 하나장면 = 가짜api({ ...장면, 고장: (자원, 값, n) => (n === 1 ? { status: 401 } : null), 토큰들: ['TOKEN-old', 'TOKEN-new'] });
  const 목록 = await 하나장면.api.쇼츠목록(A, 30);
  assert.equal(목록.상태, '됨');
  assert.deepEqual(하나장면.불림.map(([자원, , 머리]) => [자원, 머리]), [['playlistItems', 'Bearer TOKEN-old'], ['playlistItems', 'Bearer TOKEN-new']]);
  assert.equal(하나장면.불림[1][1].playlistId, 'UUSH' + 'a'.repeat(22));
  assert.ok(!JSON.stringify(하나장면.기록).includes('TOKEN'), '기록에 토큰이 없다');
  assert.ok(하나장면.기록.every(줄 => 줄.곳 === 'api'));

  // 영상 120편은 50 · 50 · 20 세 묶음
  const 많이 = Array.from({ length: 120 }, (_, i) => vid('M', i));
  const 셋 = 가짜api({ 영상: Object.fromEntries(많이.map(v => [v, { 채널: A, 날짜: '2026-10-20', 조회: 5 }])) });
  const 받음 = await 셋.api.영상들(많이);
  assert.equal(받음.상세.size, 120);
  assert.deepEqual(셋.불림.map(([, 값]) => 값.id.split(',').length), [50, 50, 20]);

  // 404는 없음(그 채널만), 한도 403은 멈춤 — 멈춘 뒤에는 부르지 않는다
  const 넷 = 가짜api({ ...장면, 고장: (자원) => (자원 === 'videos' ? { status: 403, 몸: { error: { errors: [{ reason: 'quotaExceeded' }] } } } : null) });
  assert.equal((await 넷.api.쇼츠목록('UC' + 'z'.repeat(22), 30)).상태, '없음');
  assert.equal(넷.api.셈.멈춤, false, '404 하나로 멈추지 않는다');
  assert.equal((await 넷.api.영상들([vid('B', 1)])).상태, '멈춤');
  assert.equal(넷.api.셈.멈춤, true);
  assert.match(넷.api.셈.까닭, /403 quotaExceeded/);
  const 앞 = 넷.불림.length;
  assert.equal((await 넷.api.쇼츠목록(A, 30)).상태, '멈춤');
  assert.equal(넷.불림.length, 앞, '멈춘 뒤에는 부르지 않는다');

  // 연달아 셋 실패(500)면 멈춘다 · 토큰을 못 받으면 처음부터 멈춘다
  const 다섯 = 가짜api({ ...장면, 고장: () => ({ status: 500 }) });
  for (let i = 0; i < 3; i += 1) assert.equal((await 다섯.api.쇼츠목록(A, 30)).상태, '실패');
  assert.equal(다섯.api.셈.멈춤, true);
  const 여섯 = new 수집.API부르개({ 토큰: async () => { throw new Error('LAB YouTube 자격이 없다'); }, fetch기: async () => { throw new Error('부르면 안 된다'); } });
  assert.equal((await 여섯.영상들([vid('B', 1)])).상태, '멈춤');
  assert.match(여섯.셈.까닭, /토큰을 못 받았다 — LAB YouTube 자격이 없다/);
});

test('Data API 길 — 채널은 API로만 읽고(쇼츠 탭·RSS 안 부름), 정확한 조회로 기준선, 길이·좋아요·댓글 수는 API 값, 상세 상한을 안 깎고, yt-dlp는 댓글 본문만', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'a'.repeat(22);
    const { api, 불림: api불림 } = 가짜api(api채널장면(A));
    const yt불림 = [];
    const 부르개 = 가짜((종류, 값) => {
      yt불림.push([종류, 값.id, 값.댓글수]);
      if (종류 === '영상' && 값.댓글수 > 0) return { 상태: '됨', 줄들: [{ id: 값.id, duration: 999, view_count: 1, comments: [
        { id: 'c1', parent: 'root', text: '이거 나도 그랬다', like_count: 50, author: '홍길동', author_id: 'UCauthorsecret000000000a' }] }], 오류: '', 오류글: '[youtube] Downloading ~1,234 comments' };
      throw new Error(`${종류}는 부르지 않는다`);
    });
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A, 이름: '가 채널' }], 검색: { 어: ['q'], 회차당: 0 }, 판정: { 최소조회: 3000 } }, 'lab-en');
    const o = 스캔.인자(['lab-en', '--상세', '0', '--댓글', '1', '--틱톡', '0']);
    const 누적 = 판정.빈누적('lab-en');
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, api, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.deepEqual(yt불림, [['영상', 'NEW1aaaaaaa', 30]], 'yt-dlp는 댓글 본문 한 번만');
    assert.deepEqual(api불림.map(([자원]) => 자원), ['channels', 'playlistItems', 'videos'], '채널 50곳 한 번 · 쇼츠 목록 · 영상 묶음');
    const [줄] = 요약.새튄편;
    assert.deepEqual([줄.id, 줄.조회, 줄.날짜, 줄.길이, 줄.좋아요, 줄.댓글수, 줄.구독, 줄.배수], ['NEW1aaaaaaa', 9100, '2026-10-25', 12, 300, 40, 50000, 9.1],
      '숫자·길이는 API 값(댓글 호출의 999초·조회 1·「~1,234」가 아니다)');
    assert.match(줄.인용, /NEW1aaaaaaa\(9\.1천 · ×9\.1 · 2026-10-25 · 12초\)/);
    assert.equal(줄.상세, '됨');
    assert.deepEqual([요약.표본.유튜브.api, 요약.표본.유튜브.탭, 요약.표본.유튜브.rss, 요약.표본.유튜브.읽음], [1, 0, 0, 1]);
    assert.deepEqual(요약.표본.상세, { 시도: 1, 됨: 1, api: 1 });
    assert.deepEqual(누적.튄편.NEW1aaaaaaa.길이, 12);
    assert.ok(!누적.튄편.NEW1aaaaaaa.보충, '길이를 API로 읽었으니 보충이 아니다');
    const 칸 = 누적.채널[A];
    assert.deepEqual([칸.중앙값, 칸.편수, 칸.구독, 칸.핸들, 칸.기준선잰날], [1000, 30, 50000, '@aa', '2026-10-26'], '정확한 조회 30편으로 기준선');
    assert.equal(칸.편.NEW1aaaaaaa, '2026-10-25');
    const 댓글글 = fs.readFileSync(path.join(출력, '댓글', 'lab-en', 'NEW1aaaaaaa.json'), 'utf8');
    assert.ok(!댓글글.includes('홍길동') && !댓글글.includes('UCauthorsecret'));
    assert.equal(JSON.parse(댓글글).댓글수, 40, '전체 댓글 수도 API 값');
    assert.match(판정.요약글({ 날짜: '2026-10-26', 규칙: '', 브랜드: { 'lab-en': 요약 } }), /Data API로 1곳/);
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('Data API 길 — 지난 회차의 보충(길이 없음)·다시볼(날짜 없음)은 영상 묶음 한 번으로 채운다(yt-dlp 안 부름)', async () => {
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'a'.repeat(22);
    const 장면 = api채널장면(A, { 튄: vid('B', 99) });
    장면.영상[vid('B', 99)].조회 = 1000; // 이번 목록에는 튄 편이 없다
    장면.영상.OLD1aaaaaaa = { 채널: A, 날짜: '2026-10-10', 조회: 8500, 길이: 20 };
    장면.영상.UND1aaaaaaa = { 채널: A, 날짜: '2026-10-12', 조회: 7200, 길이: 15 };
    const { api, 불림: api불림 } = 가짜api(장면);
    const 부르개 = 가짜((종류) => { throw new Error(`${종류}는 부르지 않는다`); });
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A, 이름: '가 채널' }], 검색: { 어: ['q'], 회차당: 0 }, 판정: { 최소조회: 3000 } }, 'lab-en');
    const 누적 = { ...판정.빈누적('lab-en'),
      채널: { [A]: { 중앙값: 1000, 편수: 30, 구독: 50000, 기준선잰날: '2026-10-19', 편: {} } },
      튄편: { OLD1aaaaaaa: { 곳: '유튜브', 채널: A, 날짜: '2026-10-10', 조회: 8000, 배수: 8, 규칙: 'A', 잡은날: '2026-10-19', 보충: true } },
      다시볼: { UND1aaaaaaa: { 채널: A, 조회: 7000, 날짜: null, 남긴날: '2026-10-19' } } };
    const o = 스캔.인자(['lab-en', '--상세', '0', '--댓글', '0', '--틱톡', '0']);
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, api, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    const 영상부름 = api불림.filter(([자원]) => 자원 === 'videos').map(([, 값]) => 값.id.split(',').sort());
    assert.deepEqual(영상부름.at(-1), ['OLD1aaaaaaa', 'UND1aaaaaaa'], '다시볼·보충 두 편을 한 묶음으로');
    assert.deepEqual(요약.새튄편.map(r => [r.id, r.날짜, r.길이, r.찾은길]), [['UND1aaaaaaa', '2026-10-12', 15, '지난 회차에 날짜를 확인 못 함']], '날짜를 API로 알게 된 다시볼 편이 처음 실린다');
    assert.deepEqual(요약.날짜모름, []);
    assert.deepEqual(요약.보충.map(r => [r.id, r.길이, r.조회, r.보고한날]), [['OLD1aaaaaaa', 20, 8500, '2026-10-19']]);
    assert.ok(!누적.튄편.OLD1aaaaaaa.보충);
    assert.equal(누적.튄편.OLD1aaaaaaa.길이, 20);
    assert.deepEqual(누적.다시볼, {});
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('Data API 길 — 한도(403 quotaExceeded)로 멈추면 그 채널부터 쇼츠 탭·RSS(yt-dlp)로 읽고 못 잰 곳에 적는다 · 쇼츠 목록 404인 채널도 쇼츠 탭으로', async () => {
  const 출력 = 임시폴더();
  try {
    const A = 'UC' + 'a'.repeat(22);
    const B = 'UC' + 'b'.repeat(22);
    const C = 'UC' + 'c'.repeat(22);
    const 장면 = api채널장면(A);
    장면.채널[B] = { 이름: '나 채널', 핸들: '@bb', 구독: 1000 };
    장면.채널[C] = { 이름: '다 채널', 핸들: '@cc', 구독: 1000 };
    // C는 쇼츠 목록이 없고(404), A의 영상 묶음에서 한도가 끝난다
    const { api } = 가짜api({ ...장면, 고장: (자원) => (자원 === 'videos' ? { status: 403, 몸: { error: { errors: [{ reason: 'quotaExceeded' }] } } } : null) });
    const 부르개 = 가짜((종류, 값) => {
      if (종류 === '탭') return 값.id === C ? { 상태: '없음', 줄들: [], 오류: 'This channel does not have a shorts tab', 오류글: '' } : 탭응답(값.id, 평범30('T'));
      throw new Error(종류);
    });
    const { 설정 } = 판정.설정검사({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: C, 이름: '다 채널' }, { id: A, 이름: '가 채널' }, { id: B, 이름: '나 채널' }], 검색: { 어: ['q'], 회차당: 0 } }, 'lab-en');
    const o = 스캔.인자(['lab-en', '--상세', '0', '--댓글', '0', '--틱톡', '0']);
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적: 판정.빈누적('lab-en'), o, 부르개, api, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.deepEqual(부르개.불림.filter(([종류]) => 종류 === '탭').map(([, id]) => id), [C, A, B], 'C는 목록 404라, A는 영상 묶음이 멈춰서, B는 멈춘 뒤라 쇼츠 탭');
    assert.equal(요약.표본.유튜브.api, 0);
    assert.equal(요약.표본.유튜브.읽음, 2);
    assert.ok(요약.못잼.some(m => m.계정 === '다 채널' && /쇼츠 탭 없음/.test(m.까닭)));
    assert.ok(요약.못잼.some(m => m.계정 === 'Data API' && /403 quotaExceeded/.test(m.까닭) && /yt-dlp/.test(m.까닭)));
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('Data API 길 — 핸들만 적은 우리 계정도 API로 찾아 비교 줄에만 두고, 누적에 ID·핸들을 둔다', async () => {
  const 출력 = 임시폴더();
  try {
    const OURS = 'UC' + 'o'.repeat(22);
    const 편 = ['OUR1aaaaaaa', ...Array.from({ length: 12 }, (_, i) => vid('U', i))];
    // 댓글 수가 0인 우리 편은 댓글을 부르지 않는다(API 숫자로 거른다) — 댓글 있는 OUR1만 yt-dlp로 본문을 읽는다(10-28)
    const 영상 = Object.fromEntries(편.map((v, i) => [v, { 채널: OURS, 날짜: i ? '2026-10-20' : '2026-10-25', 조회: i ? 172 : 3440, 길이: 20, 댓글: i ? 0 : 2 }]));
    const { api, 불림 } = 가짜api({ 채널: { [OURS]: { 이름: '우리', 핸들: '@ours', 구독: 8 } }, 목록: { [OURS]: 편 }, 영상 });
    const 부르개 = 가짜((종류, 값) => {
      if (종류 === '영상' && 값.id === 'OUR1aaaaaaa') return { 상태: '됨', 줄들: [{ id: 'OUR1aaaaaaa', comments: [{ id: 'k1', parent: 'root', text: '좋아요', like_count: 1 }, { id: 'k2', parent: 'root', text: '다음 편은?', like_count: 0 }] }], 오류: '', 오류글: '' };
      throw new Error(`우리 계정에는 ${종류}(${값.id})를 부르지 않는다`);
    });
    const { 설정 } = 판정.설정검사({ 브랜드: 'synkbrief', 이름: '시험', 유튜브: [{ 핸들: '@ours', 이름: '우리', 우리: true }], 검색: { 어: ['q'], 회차당: 0 } }, 'synkbrief');
    const 누적 = 판정.빈누적('synkbrief');
    const { 요약 } = await 스캔.브랜드스캔({ 설정, 누적, o: 스캔.인자(['synkbrief', '--틱톡', '0']), 부르개, api, 캐시: new Map(), 오늘: '2026-10-26', 출력 });
    assert.equal(불림[0][1].forHandle, 'ours');
    assert.deepEqual(요약.새튄편, []);
    assert.deepEqual(요약.우리.map(u => [u.곳, u.계정, u.기준.중앙값]), [['유튜브', '@ours', 172]]);
    assert.equal(누적.채널[OURS].핸들, '@ours');
    assert.deepEqual(요약.우리[0].댓글.map(d => [d.id, d.댓글수, d.읽은수]), [['OUR1aaaaaaa', 2, 2]]);
    assert.deepEqual(부르개.불림.filter(([종류]) => 종류 === '영상').map(([, id]) => id), ['OUR1aaaaaaa'], '댓글 0인 우리 편은 부르지 않는다');
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});

test('Data API 길 — main은 가짜 부르개만 주면 API를 만들지 않고(시험이 네트워크를 안 탄다), API를 주면 요약 호출 칸에 그 셈을 남긴다', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const A = 'UC' + 'a'.repeat(22);
  const 폴더 = main시험폴더({ 브랜드: 'lab-en', 이름: '시험', 유튜브: [{ id: A }], 검색: { 어: ['q'], 회차당: 0 } });
  try {
    const 인자 = ['lab-en', '--누적', 폴더.누적, '--출력', 폴더.출력, '--날짜', '2026-10-26', '--틱톡', '0', '--댓글', '0', '--누적안씀'];
    const 옛 = 가짜((종류, 값) => (종류 === '탭' ? 탭응답(값.id, 평범30('T')) : { 상태: '막힘', 줄들: [], 오류: '', 오류글: '' }));
    assert.equal(await 스캔.main(인자, { 부르개: 옛, 설정폴더: 폴더.설정 }), 0);
    let 요약 = JSON.parse(fs.readFileSync(path.join(폴더.출력, '요약.json'), 'utf8'));
    assert.equal(요약.호출.api, undefined, '가짜 부르개만 주면 Data API를 쓰지 않는다');
    assert.ok(옛.불림.some(([종류]) => 종류 === '탭'));
    fs.rmSync(폴더.출력, { recursive: true, force: true });
    const { api } = 가짜api(api채널장면(A));
    const 새 = 가짜((종류) => { throw new Error(`${종류}는 부르지 않는다`); });
    assert.equal(await 스캔.main(인자, { 부르개: 새, api, 설정폴더: 폴더.설정 }), 0);
    요약 = JSON.parse(fs.readFileSync(path.join(폴더.출력, '요약.json'), 'utf8'));
    assert.deepEqual([요약.호출.api.호출, 요약.호출.api.멈춤], [3, false]);
    assert.deepEqual(요약.브랜드['lab-en'].새튄편.map(r => [r.id, r.길이]), [['NEW1aaaaaaa', 12]]);
  } finally {
    fs.rmSync(폴더.뿌리, { recursive: true, force: true });
  }
});

test('짝 브랜드(synkbrief · yuhobuilds)는 시드가 겹치지 않고, 짝의 시드 · 찾은 채널은 검색으로 찾아도 들이지 않는다(10-28)', async () => {
  const 설정 = b => 스캔.설정읽기(b).설정;
  assert.deepEqual(판정.시드겹침(설정('synkbrief'), 설정('yuhobuilds')), [], '지금 두 설정은 겹치지 않는다');
  const 가 = 판정.설정검사({ 브랜드: 'synkbrief', 이름: '가', 유튜브: [{ id: 'UC' + 'a'.repeat(22), 이름: '같은 채널' }, { 핸들: '@ours', 우리: true }], 검색: { 어: ['q'] } }, 'synkbrief').설정;
  const 나 = 판정.설정검사({ 브랜드: 'yuhobuilds', 이름: '나', 유튜브: [{ id: 'UC' + 'a'.repeat(22), 이름: '같은 채널' }, { 핸들: '@seed' }, { 핸들: '@ours', 우리: true }], 검색: { 어: ['q'] } }, 'yuhobuilds').설정;
  assert.deepEqual(판정.시드겹침(가, 나), ['같은 채널'], '우리 계정은 겹침으로 세지 않는다');
  const 짝누적 = { 채널: { ['UC' + 's'.repeat(22)]: { 핸들: '@seed' } }, 찾은채널: { ['UC' + 'f'.repeat(22)]: { 찾은날: '2026-10-20' } } };
  assert.deepEqual([...판정.남의채널(나, 짝누적)].sort(), ['UC' + 'a'.repeat(22), 'UC' + 'f'.repeat(22), 'UC' + 's'.repeat(22)]);
  // main은 시드가 겹치면 멈춘다(대상이 한쪽뿐이어도 짝 설정을 읽는다)
  const fs = require('node:fs');
  const path = require('node:path');
  const 폴더 = 임시폴더();
  try {
    for (const [b, raw] of [['synkbrief', { 브랜드: 'synkbrief', 이름: '가', 유튜브: [{ id: 'UC' + 'a'.repeat(22) }], 검색: { 어: ['q'] } }], ['yuhobuilds', { 브랜드: 'yuhobuilds', 이름: '나', 유튜브: [{ id: 'UC' + 'a'.repeat(22) }], 검색: { 어: ['q'] } }]]) {
      fs.writeFileSync(path.join(폴더, `수요_${b}.json`), JSON.stringify(raw));
    }
    const 원래 = console.error;
    const 말 = [];
    console.error = (...a) => 말.push(a.join(' '));
    try { assert.equal(await 스캔.main(['synkbrief', '--설정검사'], { 설정폴더: 폴더 }), 1); } finally { console.error = 원래; }
    assert.match(말.join('\n'), /yuhobuilds와 겹친다/);
  } finally {
    fs.rmSync(폴더, { recursive: true, force: true });
  }
  // 브랜드 스캔: 짝 브랜드가 쥔 채널은 지난 회차의 찾은 채널에서 빼고, 검색에 잡혀도 새로 찾지 않는다
  const N = 'UC' + 'n'.repeat(22);
  const 출력 = 임시폴더();
  try {
    const 부르개 = 가짜((종류) => {
      if (종류 === '검색') return { 상태: '됨', 줄들: [{ id: 'NEWNaaaaaaa', ie_key: 'Youtube', title: '찾은 편', view_count: 20000, duration: 9, channel_id: N, channel: '짝 채널' }], 오류: '', 오류글: '' };
      throw new Error(`짝 브랜드 채널은 읽지 않는다: ${종류}`);
    });
    const { 설정 } = 판정.설정검사({ 브랜드: 'synkbrief', 이름: '시험', 유튜브: [{ 핸들: '@ours', 우리: true }], 검색: { 어: ['q'], 회차당: 1 } }, 'synkbrief');
    const 누적 = 판정.빈누적('synkbrief');
    누적.찾은채널[N] = { 찾은날: '2026-10-20', 마지막튐: null };
    const o = 스캔.인자(['synkbrief', '--틱톡', '0', '--채널', '0']);
    await 스캔.브랜드스캔({ 설정, 누적, o, 부르개, 캐시: new Map(), 오늘: '2026-10-26', 출력, 남의채널: new Set([N]) });
    assert.equal(누적.찾은채널[N], undefined, '짝 브랜드 채널은 찾은 채널에서 뺀다');
    assert.ok(!부르개.불림.some(([종류, id]) => 종류 === '탭' && id === N), '읽지도 않는다');
  } finally {
    require('node:fs').rmSync(출력, { recursive: true, force: true });
  }
});
