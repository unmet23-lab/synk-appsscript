'use strict';
// 업종 반응 브리핑 도구(tools/업종브리핑/) — 네트워크 없이 도는 순수 함수 시험. node --test tests/업종브리핑.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const 유튜브 = require('../tools/업종브리핑/유튜브.js');
const 집계모듈 = require('../tools/업종브리핑/집계.js');
const 나누기모듈 = require('../tools/업종브리핑/나누기.js');
const 글모듈 = require('../tools/업종브리핑/글.js');
const 그리기모듈 = require('../tools/업종브리핑/그리기.js');
const 브리핑 = require('../tools/업종브리핑/브리핑.js');

test('튄 편 판정 — 평소 3배 이상이거나 작은 채널에서 조회 ≥ 구독', () => {
  assert.equal(유튜브.튄편판정({ 조회: 30000, 구독: 100000, 평소: 9000 }, 10000).튄편, true);
  assert.equal(유튜브.튄편판정({ 조회: 26000, 구독: 100000, 평소: 9000 }, 10000).튄편, false);
  const 작은 = 유튜브.튄편판정({ 조회: 20000, 구독: 15000, 평소: 18000 }, 10000);
  assert.equal(작은.튄편, true);
  assert.match(작은.까닭, /작은 채널/);
  assert.equal(유튜브.튄편판정({ 조회: 9000, 구독: 500, 평소: 100 }, 10000).튄편, false, '최소 조회 아래는 튄 편이 아니다');
  assert.equal(유튜브.튄편판정({ 조회: 50000, 구독: null, 평소: null }, 10000).튄편, false, '평소·구독을 모르면 판정하지 않는다');
});

test('제외 낱말과 가리기', () => {
  assert.equal(유튜브.제외인가({ 제목: '남자 코트 추천', 채널이름: 'a' }, ['남자']), true);
  assert.equal(유튜브.제외인가({ 제목: '여자 코트', 채널이름: 'a' }, []), false);
  assert.equal(유튜브.가리기('메일 a@b.com 링크 https://x.y/z 전화 010-1234-5678 @누구'), '메일 [메일] 링크 [링크] 전화 [전화] @[언급]');
});

test('하루 값 → 주 평균(7일 다 찬 주만) → 해마다 정점', () => {
  // 2024-01-01은 월요일
  const 하루 = Array.from({ length: 17 }, (_, i) => i + 1);
  const 주 = 집계모듈.주평균('2024-01-01', 하루);
  assert.deepEqual(주.map((w) => w.주), ['2024-01-01', '2024-01-08']);
  assert.equal(주[0].값, 4);
  // 3년치 주 자료: 해마다 11월 셋째 주에 정점, 5월에 작은 봉우리
  const 주들 = [];
  for (let t = Date.parse('2022-12-05T00:00:00Z'); t < Date.parse('2026-10-20T00:00:00Z'); t += 7 * 864e5) {
    const s = new Date(t).toISOString().slice(0, 10);
    const 월 = Number(s.slice(5, 7)), 일 = Number(s.slice(8, 10));
    주들.push({ 주: s, 값: 월 === 11 && 일 >= 13 && 일 <= 19 ? 60 : 월 === 5 ? 20 : 5 });
  }
  const 정점 = 집계모듈.해마다정점(주들, '2026-10-30');
  assert.equal(정점.length, 3);
  for (const p of 정점) assert.match(p.다가올.주, /-11-1[3-9]$/);
  assert.match(집계모듈.달날구간(정점.map((p) => p.다가올)), /^11월 1\d~1\d일$|^11월 1\d일$/);
});

test('비중 — 상대값을 합 100으로', () => {
  const r = 집계모듈.비중([{ 값: '40', 이름: '40대', 상대: 100 }, { 값: '50', 이름: '50대', 상대: 100 }]);
  assert.deepEqual(r.map((x) => x.비중), [50, 50]);
});

test('광고 카드 글 읽기', () => {
  const 카드 = ' 1350315926992496\n2026. 10. 12.에 게재 시작함\n플랫폼\n​\n광고 상세 정보 보기\n어느브랜드\n광고\n겨울 코트 고민되셨죠?\n이 코트 하나면 돼요\nSHOP.EXAMPLE.COM\n울 코트 블랙\nShop Now\n활성';
  const a = 집계모듈.광고카드읽기(카드);
  assert.equal(a.id, '1350315926992496');
  assert.equal(a.시작, '2026-10-12');
  assert.equal(a.광고주, '어느브랜드');
  assert.equal(a.본문, '겨울 코트 고민되셨죠? 이 코트 하나면 돼요');
  assert.equal(a.제목, '울 코트 블랙');
  assert.equal(집계모듈.광고카드읽기('글만 있음'), null);
  const 영어 = 집계모듈.광고카드읽기([' 9988776655', 'Started running on Oct 2, 2026', 'See ad details', 'Brand', 'Sponsored', 'Winter coat', 'SHOP.COM', 'Coat'].join('\n'));
  assert.equal(영어.시작, '2026-10-02');
  assert.equal(영어.광고주, 'Brand');
});

function 가짜자료() {
  const 후보 = [];
  for (let i = 0; i < 12; i++) {
    후보.push({ id: `v${String(i).padStart(10, '0')}`, 제목: `영상 ${i}`, 채널: `채널${i}`, 구독: i === 0 ? 300 : 100000, 조회: 60000 + i, 길이: i < 6 ? 20 : 50, 배수: i < 6 ? 5 : 1.2, 튄편: i < 6 });
  }
  const 댓글 = { [후보[0].id]: [{ 글: '어디 거예요? 정보 주세요', 좋아요: 10, 주인: false }, { 글: '채널 주인 답', 좋아요: 0, 주인: true }, { 글: '키 몇이세요', 좋아요: 3, 주인: false }] };
  const 나누기 = {
    영상: Object.fromEntries(후보.map((v, i) => [v.id, i < 6 ? ['비교'] : ['모음·하울']])),
    댓글: { [`${후보[0].id}#0`]: ['제품 정보 요청'], [`${후보[0].id}#2`]: ['키·사이즈·핏'] },
    광고: { 111111: ['할인·쿠폰'], 222222: ['나이대', '고민 공감'] },
  };
  const 메타 = { 상태: { q: '됨' }, 검색: [{ 검색어: 'q', 카드: [
    ' 111111\n2026. 10. 20.에 게재 시작함\n광고 상세 정보 보기\nTemu\n광고\n최대 90% 할인\nTEMU.COM\n패딩',
    ' 222222\n2025. 11. 2.에 게재 시작함\n광고 상세 정보 보기\n작은브랜드\n광고\n4050 코트 고민이시죠\nSHOP.KR\n코트',
  ] }] };
  const 네이버 = { 상태: { 쇼핑: '됨', 검색: '못 읽음: 시험' }, 쇼핑: { 비중: { Age: [{ 값: '20', 이름: '20대', 상대: 5 }, { 값: '30', 이름: '30대', 상대: 30 }, { 값: '40', 이름: '40대', 상대: 100 }, { 값: '50', 이름: '50대', 상대: 95 }], Device: [{ 값: 'mo', 이름: '모바일', 상대: 100 }, { 값: 'pc', 이름: 'PC', 상대: 10 }], Gender: [] }, 순위: [{ 이름: '최근 7일', 낱말: ['패딩', '코트'] }], 클릭: [] } };
  return { 유튜브: { 상태: '됨', 후보, 댓글 }, 네이버, 메타, 나누기, 기준일: '2026-10-30' };
}

test('집계 — 지표·상태·막힌 갈래는 지표가 없다', () => {
  const r = 집계모듈.집계(가짜자료());
  const 지 = r.지표;
  assert.equal(지['영상.편수'].값, 12);
  assert.equal(지['영상.튄비율'].값, 50);
  assert.equal(지['영상.각도.비교.튄비율'].값, 100);
  assert.equal(지['영상.작은채널.구독'].값, 300);
  assert.equal(지['댓글.수'].값, 2, '채널 주인 댓글은 뺀다');
  assert.equal(지['댓글.주제.제품 정보 요청.비율'].값, 50);
  assert.equal(지['쇼핑.주연령'].값, '40·50대');
  assert.equal(지['쇼핑.주연령비중'].값, 84, '보이는 두 연령 비중(43·41)의 합');
  assert.equal(지['쇼핑.모바일'].값, 91);
  assert.equal(지['광고.수'].값, 2);
  assert.equal(지['광고.해외직구.수'].값, 1);
  assert.equal(지['광고.최장.광고주'].값, '작은브랜드');
  assert.equal(지['광고.최장.일수'].값, 362);
  assert.equal(r.상태.검색, '못 읽음: 시험');
  assert.ok(!Object.keys(지).some((k) => k.startsWith('검색.')), '못 읽은 검색은 지표가 없다');
  assert.ok(r.표본.댓글['제품 정보 요청'][0].글.includes('어디'));
});

test('나누기 — 번호 맞추기·기타·빠진 번호·캐시', async () => {
  const 주제들 = 나누기모듈.주제목록('댓글', { 주제: { 댓글고유: [{ 이름: '키·사이즈·핏', 설명: '' }] } });
  assert.ok(주제들.some((t) => t.이름 === '키·사이즈·핏'));
  assert.equal(주제들[주제들.length - 1].이름, '기타');
  let 부름 = 0;
  const 보내기 = async (본문) => {
    부름++;
    const 수 = (본문.messages[0].content.match(/^\[\d+\]/gm) || []).length;
    const 결과 = Array.from({ length: 수 }, (_, i) => ({ 번호: i, 주제: i === 0 ? ['제품 정보 요청', '기타'] : ['기타'] }));
    return { 응답: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ 결과 }) }] } };
  };
  const 설정 = { 업종: '시험', 주제: {} };
  const 캐시 = {};
  const 항목 = [{ 키: 'a', 글: '어디 거예요' }, { 키: 'b', 글: 'ㅋㅋ' }];
  const r = await 나누기모듈.나누기({ 보내기, 종류: '댓글', 설정, 항목, 캐시 });
  assert.deepEqual(r.표.a, ['제품 정보 요청'], '기타와 다른 주제가 함께면 기타를 뺀다');
  assert.deepEqual(r.표.b, ['기타']);
  const 두번 = await 나누기모듈.나누기({ 보내기, 종류: '댓글', 설정, 항목, 캐시 });
  assert.equal(두번.부름, 0, '같은 글은 캐시로');
  assert.equal(부름, 1);
  const 빠짐 = async () => ({ 응답: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ 결과: [{ 번호: 0, 주제: ['기타'] }] }) }] } });
  const 캐시2 = {};
  const r2 = await 나누기모듈.나누기({ 보내기: 빠짐, 종류: '영상', 설정, 항목: [{ 키: 'x', 글: '에르노 패딩 4종 비교' }, { 키: 'y', 글: '아무 말' }], 캐시: 캐시2 });
  assert.deepEqual(r2.낱말로, ['x', 'y'], '빠진 번호가 있으면 그 묶음은 낱말 규칙으로');
  assert.deepEqual(r2.표.x, ['비교']);
  assert.deepEqual(r2.표.y, ['기타']);
  assert.equal(Object.keys(캐시2).length, 0, '낱말로 나눈 것은 캐시에 넣지 않는다');
});

test('나누기 — 거절되면 반으로 쪼개 다시', async () => {
  const 크기들 = [];
  const 보내기 = async (본문) => {
    const 수 = (본문.messages[0].content.match(/^\[\d+\]/gm) || []).length;
    크기들.push(수);
    if (수 > 10) return { 응답: { stop_reason: 'refusal', content: [] } };
    return { 응답: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ 결과: Array.from({ length: 수 }, (_, i) => ({ 번호: i, 주제: ['칭찬·감탄'] })) }) }] } };
  };
  const 항목 = Array.from({ length: 24 }, (_, i) => ({ 키: `k${i}`, 글: `예뻐요 ${i}` }));
  const r = await 나누기모듈.나누기({ 보내기, 종류: '댓글', 설정: { 업종: '시험', 주제: {} }, 항목, 캐시: {} });
  assert.equal(Object.keys(r.표).length, 24);
  assert.equal(r.낱말로.length, 0);
  assert.deepEqual(크기들.slice(0, 3), [24, 12, 6], '거절은 같은 묶음을 다시 보내지 않고 바로 쪼갠다');
});

test('유튜브 모으기 — 평소는 그 편을 뺀 채널 쇼츠 중앙값, 검색 캐시는 다시 부르지 않는다', async () => {
  const 채널 = 'UC' + 'a'.repeat(22);
  const 영상 = (id, 조회) => ({ id, 제목: `제목 ${id}`, 채널id: 채널, 채널이름: '가게', 조회, 길이: 20, 날짜: '2026-10-01', 설명: '' });
  const 목록 = ['vvvvvvvvvv0', 'vvvvvvvvvv1', 'vvvvvvvvvv2', 'vvvvvvvvvv3', 'vvvvvvvvvv4', 'vvvvvvvvvv5'];
  const 조회 = { vvvvvvvvvv0: 900000, vvvvvvvvvv1: 20000, vvvvvvvvvv2: 20000, vvvvvvvvvv3: 20000, vvvvvvvvvv4: 20000, vvvvvvvvvv5: 20000 };
  const 부른 = [];
  const 부르개 = {
    채널칸: new Map(),
    async 부르기(자원, 값) { 부른.push(자원); if (자원 === 'search') return { 상태: '됨', 몸: { items: [{ id: { videoId: 'vvvvvvvvvv0' } }] } }; return { 상태: '됨', 몸: { items: [] } }; },
    async 영상들(ids) { return { 상태: '됨', 상세: new Map(ids.map((id) => [id, 영상(id, 조회[id])])) }; },
    async 채널들() { this.채널칸.set(채널, { 채널id: 채널, 구독: 500000 }); },
    async 쇼츠목록() { return { 상태: '됨', ids: 목록 }; },
  };
  const 설정 = { 유튜브: { 검색어: ['q'], 최소조회: 10000, 제외낱말: [], 댓글영상: 0 } };
  const 캐시 = {};
  const r = await 유튜브.모으기(설정, { 부르개, 시작일: '2026-09-15', 검색캐시: 캐시 });
  assert.equal(r.후보[0].평소, 20000, '그 편(90만)을 빼고 잰다');
  assert.equal(r.후보[0].튄편, true);
  assert.deepEqual(캐시, { q: ['vvvvvvvvvv0'] });
  부른.length = 0;
  await 유튜브.모으기(설정, { 부르개, 시작일: '2026-09-15', 검색캐시: 캐시 });
  assert.ok(!부른.includes('search'), '같은 날 다시 돌리면 search를 부르지 않는다');
});

function 지표샘플() {
  return {
    '쇼핑.주연령': { 값: '40·50대', 단위: '', 출처: '네이버', 설명: '두 연령' },
    '쇼핑.주연령비중': { 값: 73, 단위: '%', 출처: '네이버', 설명: '합' },
    '영상.튄비율': { 값: 55, 단위: '%', 출처: '유튜브', 설명: '비율' },
    '댓글.주제.제품 정보 요청.비율': { 값: 18, 단위: '%', 출처: '댓글', 설명: '비율' },
  };
}

function 글샘플() {
  return {
    한줄: '누르는 사람의 {{쇼핑.주연령비중}}가 {{쇼핑.주연령}}예요.',
    타일: [0, 1, 2, 3].map(() => ({ 라벨: '주 연령', 지표: '쇼핑.주연령비중', 설명: '네이버 쇼핑' })),
    가려운곳: [0, 1, 2].map(() => ({ 질문: '나 같은 사람이 입으면?', 설명: '정보를 묻는 댓글이 {{댓글.주제.제품 정보 요청.비율}}예요.', 근거: ['댓글.주제.제품 정보 요청.비율'], 예시: [{ 댓글: 'v#0', 뜻: '어디 것인지 묻는 말' }] })),
    언제: '', 누가: '{{쇼핑.주연령}}가 많이 눌러요.', 반응: '전체 {{영상.튄비율}}가 튀었어요.', 광고: '',
    제안: [0, 1, 2].map(() => ({ 이름: '착용 비교', 때: '지금', 무엇: '모델 셋이 입어요.', 근거: '나이' })),
  };
}

test('글 검사 — 숫자·없는 지표·원문 옮기기·못 읽은 칸', () => {
  const 지표 = 지표샘플();
  const 표본댓글 = { 'v#0': '이거 어디 브랜드 제품인지 정보 좀 꼭 알려주세요 너무 예뻐요' };
  const 상태 = { 검색: '못 읽음', 쇼핑: '됨', 영상: '됨', 댓글: '됨', 광고: '못 읽음' };
  assert.deepEqual(글모듈.검사하기(글샘플(), { 지표, 표본댓글, 상태 }), []);
  const 나쁜 = 글샘플();
  나쁜.한줄 = '누르는 사람의 73%가 40대예요. {{없는.지표}}';
  나쁜.언제 = '검색은 곧 올라요.';
  나쁜.가려운곳[0].예시[0].뜻 = '어디 브랜드 제품인지 정보 좀 꼭 알려주세요';
  const 문제 = 글모듈.검사하기(나쁜, { 지표, 표본댓글, 상태 });
  assert.ok(문제.some((x) => /숫자/.test(x)));
  assert.ok(문제.some((x) => /없는 지표/.test(x)));
  assert.ok(문제.some((x) => /그대로 옮겼다/.test(x)));
  assert.ok(문제.some((x) => /「언제」 칸/.test(x)));
});

test('글 쓰기 — 검사에 걸리면 까닭을 붙여 다시 받는다', async () => {
  const 지표 = 지표샘플();
  const 표본 = { 댓글: { '제품 정보 요청': [{ 키: 'v#0', 영상: 'v', 좋아요: 3, 글: '정보 주세요' }] } };
  const 상태 = { 검색: '못 읽음', 쇼핑: '됨', 영상: '됨', 댓글: '됨', 광고: '못 읽음' };
  const 답들 = [{ ...글샘플(), 한줄: '73%가 40·50대예요.' }, 글샘플()];
  const 받은 = [];
  const 보내기 = async (본문) => { 받은.push(본문.messages[0].content); return { 응답: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(답들.shift()) }] } }; };
  const r = await 글모듈.쓰기({ 보내기, 설정: { 업종: '시험', 받는사람: '시험 브랜드' }, 지표, 표본, 상태 });
  assert.equal(r.번, 2);
  assert.match(받은[1], /고칠 것/);
  assert.equal(받은.length, 2);
});

test('그리기 — 자리 채우기·이스케이프·못 읽은 칸·막대가 칸 안', () => {
  const 지표 = 지표샘플();
  const 글 = 글샘플();
  글.반응 = '<script>alert(1)</script> {{영상.튄비율}}';
  const 그림 = { 쇼핑: { 나이: [{ 이름: '40대', 값: '40', 비중: 37 }, { 이름: '50대', 값: '50', 비중: 36 }], 순위: [{ 이름: '최근 7일', 낱말: ['패딩'] }] }, 영상: { 전체: { 튄비율: 55 }, 각도줄: [{ 이름: '비교', 편수: 10, 튄비율: 70 }], 길이줄: [{ 이름: '15초 이하', 편수: 13, 튄비율: 77 }], 튄순: [] } };
  const 설정 = { 업종: '여성 겨울 아우터', 받는사람: '브랜드', 네이버: { 분류: { 이름: '아우터' } }, 유튜브: { 검색어: ['a'], 최소조회: 10000 } };
  const 상태 = { 검색: '못 읽음: 시험', 쇼핑: '됨', 영상: '됨', 댓글: '됨', 광고: '못 읽음: 시험' };
  const { 문서, 조각 } = 그리기모듈.그리기({ 지표, 그림, 글, 상태, 설정, 기준일: '2026-10-30', 표본: {} });
  assert.ok(!문서.includes('{{'), '자리표시자가 남지 않는다');
  assert.ok(문서.includes('73%'));
  assert.ok(!문서.includes('<script>alert'), '글은 이스케이프');
  assert.match(문서, /이번엔 이 자료를 읽지 못했어요/);
  assert.match(조각, /^<title>/);
  assert.ok(!조각.includes('<html'));
  // 0부터 세는 양은 빗금 막대(그래프 문법) — 페이지에 옛 SVG 막대가 남지 않고, 튄 비율은 전체 평균 자리에 점선
  assert.ok(문서.includes('<div class="빗금표" role="list" aria-label="연령별 클릭 비중">'));
  assert.ok(문서.includes('<i class="빗기준" style="--기준:0.5500"></i>'), '각도 · 길이 막대에 전체 평균 55% 점선');
  assert.equal(문서.includes('class="막대이름"'), false);
  const 빗 = 그리기모듈.빗금막대([{ 이름: 'a', 값: 30, 메모: '30%', 강조: true }], { 최대: 60, 기준선: 15 });
  assert.ok(빗.includes('<i class="빗기준" style="--기준:0.2500"></i><span class="빗띠 강조" style="--w:0.5000">'));
  assert.equal(그리기모듈.빗금막대([{ 이름: 'a', 값: 1, 메모: '1' }], { 최대: 2 }).includes('빗기준'), false, '기준선이 없으면 점선 없음');
  const 막대 = 그리기모듈.가로막대([{ 이름: '아주 긴 각도 이름입니다', 값: 100, 메모: '100% · 300편', 강조: true }], { 최대: 100, 너비: 360 });
  const [, w] = /viewBox="0 0 (\d+) /.exec(막대);
  for (const m of 막대.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)) assert.ok(Number(m[1]) + Number(m[2]) <= Number(w));
});

test('글HTML — 자리표시자 뒤 조사를 값의 끝소리로 맞춘다(쓰는 쪽은 값을 모른다)', () => {
  const 지 = (값, 단위) => ({ 값, 단위, 출처: 's', 설명: 'd' });
  const 지표 = { a: 지(94, '%'), b: 지(239, '편'), c: 지(169, '개'), d: 지(1, '일'), e: 지(3, '곳'), f: 지(1220, '') };
  const 글 = (t) => 그리기모듈.글HTML(t, 지표).replace(/<b[^>]*>/g, '[').replace(/<\/b>/g, ']');
  assert.equal(글('여성이 {{a}}이에요.'), '여성이 [94%]예요.');
  assert.equal(글('쇼츠 {{b}}를 봤고 {{b}}예요.'), '쇼츠 [239편]을 봤고 [239편]이에요.');
  assert.equal(글('광고 {{c}}을 나눴어요'), '광고 [169개]를 나눴어요');
  assert.equal(글('{{b}}가 넘고 {{a}}이 넘어요'), '[239편]이 넘고 [94%]가 넘어요');
  assert.equal(글('{{d}}으로 · {{e}}로'), '[1일]로 · [3곳]으로', 'ㄹ 받침은 「로」');
  assert.equal(글('{{f}}는'), '[1,220]은', '끝이 0이면 「십」으로 읽어 받침 있음');
  assert.equal(글('{{a}}가장 높다'), '[94%]가장 높다', '조사가 아닌 낱말은 건드리지 않는다');
  assert.equal(그리기모듈.끝소리('A'), null);
  assert.equal(그리기모듈.조사맞춤('A', '을'), '을', '모르는 끝소리면 그대로');
});

test('휴대폰 — 선 그래프는 넓은 판 · 좁은 판을 함께, 큰 영상 표는 좁은 판에서 카드가 되게 붙임 글을 단다', () => {
  const 지표 = 지표샘플();
  const 그림 = {
    검색: [{ 이름: '패딩', 주들: [{ 주: '2025-01-06', 값: 10 }, { 주: '2025-07-07', 값: 40 }, { 주: '2026-01-05', 값: 20 }], 정점: [] }],
    영상: { 전체: { 튄비율: 50 }, 각도줄: [], 길이줄: [], 튄순: [{ 제목: '<b>제목</b>', 주소: 'https://youtu.be/x', 채널: '채널', 구독: 1930, 조회: 260408, 배수: 314.7, 길이: 58 }] },
  };
  const 설정 = { 업종: '시험', 받는사람: '브랜드', 네이버: { 분류: { 이름: '아우터' } }, 유튜브: { 검색어: ['a'], 최소조회: 1 } };
  const 상태 = { 검색: '됨', 쇼핑: '못 읽음: 시험', 영상: '됨', 댓글: '됨', 광고: '못 읽음: 시험' };
  const { 문서 } = 그리기모듈.그리기({ 지표, 그림, 글: null, 글까닭: '시험', 상태, 설정, 기준일: '2026-10-30', 표본: {} });
  assert.ok(문서.includes('<div class="선그림"><div class="넓은"><svg viewBox="0 0 720 280"'), '넓은 판');
  assert.ok(문서.includes('<div class="좁은"><svg viewBox="0 0 360 240"'), '좁은 판(글자가 화면 px 그대로)');
  assert.ok(문서.includes('<table class="튄표" role="table">'));
  assert.ok(문서.includes('<td role="cell" class="제목칸"><a href="https://youtu.be/x" target="_blank" rel="noopener">&lt;b&gt;제목&lt;/b&gt;</a></td>'));
  assert.ok(문서.includes('<span class="붙임">구독 </span>1,930') && 문서.includes('<span class="붙임">평소의 </span>314.7배'));
});

test('브리핑 — 네이버 일감 날짜와 나누기 항목', () => {
  const 설정 = { 이름: '시험', 네이버: { 성별: 'f', 분류: { cid: 1, 하위: [{ 이름: '패딩', cid: 2 }] }, 검색어묶음: [{ 이름: '패딩', 낱말: ['패딩'] }] } };
  const 일감 = 브리핑.네이버일감(설정, '2026-10-30', '/tmp/x');
  const 작년 = 일감.쇼핑.순위.find((r) => r.이름 === '작년 다음 달');
  assert.deepEqual([작년.시작, 작년.끝], ['2025-11-01', '2025-11-30']);
  assert.equal(일감.쇼핑.순위.find((r) => r.이름 === '최근 7일').끝, '2026-10-29');
  assert.equal(일감.검색.시작, '2023-01-01');
  const 항목 = 브리핑.나누기항목({ 상태: '됨', 후보: [{ id: 'v', 제목: '제목', 설명: '' }], 댓글: { v: [{ 글: 'a', 주인: false }, { 글: 'b', 주인: true }, { 글: ' ', 주인: false }] } }, null);
  assert.deepEqual(항목.댓글.map((h) => h.키), ['v#0']);
  assert.equal(항목.영상[0].글, '제목');
});

test('검사 — 같은 원자료·나누기면 지표와 페이지가 바이트까지 같고, 손대면 잡는다', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '업종브리핑-'));
  const 자료 = 가짜자료();
  const 설정 = 브리핑.설정읽기('여성_겨울아우터');
  const w = (n, x) => fs.writeFileSync(path.join(폴더, `${n}.json`), JSON.stringify(x));
  w('유튜브', 자료.유튜브); w('네이버', 자료.네이버); w('메타', 자료.메타); w('나누기', 자료.나누기);
  const 모음 = 집계모듈.집계({ ...자료, 설정 });
  w('집계', 모음);
  w('글', { 상태: '못 씀', 까닭: '시험' });
  const 받는 = 브리핑.받는사람(설정, { 받는사람: '시험 브랜드' });
  const 문서 = 그리기모듈.그리기({ 지표: 모음.지표, 그림: 모음.그림, 표본: 모음.표본, 글: null, 글까닭: '시험', 상태: 모음.상태, 설정: { ...설정, 받는사람: 받는 }, 기준일: '2026-10-30' }).문서;
  fs.writeFileSync(path.join(폴더, '브리핑.html'), 문서);
  const o = { 낱말: ['여성_겨울아우터'], 날짜: '2026-10-30', 출력: 폴더, 받는사람: '시험 브랜드' };
  assert.deepEqual(브리핑.검사(o).문제, []);
  fs.writeFileSync(path.join(폴더, '브리핑.html'), 문서.replace('반응 브리핑</h1>', '반응 브리핑!</h1>'));
  assert.ok(브리핑.검사(o).문제.some((x) => /다시 그린 페이지가 다르다/.test(x)));
  fs.rmSync(폴더, { recursive: true, force: true });
});

test('구조화 출력 스키마 — 배열 maxItems·minItems>1을 쓰지 않는다(API가 400으로 거절, 10-30 실측)', () => {
  const 걷기 = (x, 길 = '') => {
    if (!x || typeof x !== 'object') return [];
    const 문제 = [];
    if ('maxItems' in x) 문제.push(`${길}.maxItems`);
    if (Number(x.minItems) > 1) 문제.push(`${길}.minItems=${x.minItems}`);
    for (const [k, v] of Object.entries(x)) 문제.push(...걷기(v, `${길}.${k}`));
    return 문제;
  };
  assert.deepEqual(걷기(나누기모듈.스키마(['가', '기타'])), []);
  assert.deepEqual(걷기(글모듈.스키마(['가.나'], ['v#0'])), []);
  const 원문 = require('node:fs').readFileSync(require.resolve('../tools/업종브리핑/브리핑.js'), 'utf8');
  assert.ok(!/maxItems|minItems: [2-9]/.test(원문), '새업종 스키마에도 없다');
});

test('해마다 정점 — 창 가장자리의 오르는 비탈은 정점으로 내지 않는다', () => {
  // 매해 10월부터 11월 셋째 주까지 오르기만 하는 묶음 — 기준일(10-30) 앞 반년의 최고는 가장자리라 뺀다
  const 주들 = [];
  for (let t = Date.parse('2022-12-05T00:00:00Z'); t < Date.parse('2026-10-20T00:00:00Z'); t += 7 * 864e5) {
    const s = new Date(t).toISOString().slice(0, 10);
    const 월 = Number(s.slice(5, 7)), 일 = Number(s.slice(8, 10));
    const 값 = 월 === 10 ? 10 + 일 : 월 === 11 ? (일 <= 19 ? 45 + 일 : 30) : 5;
    주들.push({ 주: s, 값 });
  }
  const 정점 = 집계모듈.해마다정점(주들, '2026-10-30');
  for (const p of 정점) { assert.equal(p.지난, null); assert.match(p.다가올.주, /-11-1\d$/); }
});

test('나누기 — 잘린 이모지 반쪽은 보내기 전에 바로잡는다', async () => {
  let 보낸 = '';
  const 보내기 = async (본문) => { 보낸 = 본문.messages[0].content; return { 응답: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ 결과: [{ 번호: 0, 주제: ['기타'] }] }) }] } }; };
  const 반쪽 = '좋아요 \ud83d'; // 이모지를 자르다 남은 앞 반쪽
  await 나누기모듈.나누기({ 보내기, 종류: '댓글', 설정: { 업종: '시험', 주제: {} }, 항목: [{ 키: 'a', 글: 반쪽 }], 캐시: {} });
  assert.ok(보낸.isWellFormed(), '보낸 글에 외톨이 surrogate가 없다');
});
