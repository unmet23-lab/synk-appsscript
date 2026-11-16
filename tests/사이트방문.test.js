'use strict';
// synk.im 방문자 분석 모으기 도구(tools/사이트방문/) — 네트워크 없이 도는 시험. node --test tests/사이트방문.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 값 = require('../tools/사이트방문/값.js');
const 셈 = require('../tools/사이트방문/방문셈.js');
const 구글 = require('../tools/사이트방문/구글.js');
const AI = require('../tools/사이트방문/AI재기.js');
const 요약 = require('../tools/사이트방문/요약.js');
const 모으기 = require('../tools/사이트방문/모으기.js');

const 하루 = 24 * 3600 * 1000;
const 지금 = new Date('2026-11-17T03:00:00Z'); // 한국 11-17 12:00
/** 실제 시각 → 시트 일련번호(한국 벽시계) */
const 일련 = (ms) => (ms + 540 * 60000) / 하루 + 25569;
const 머리 = ['타임스탬프', '기록'];
/** 시트 한 줄: [일련번호, 「기록」 JSON] — 사이트 쪽 세기 코드가 보내는 꼴 */
function 줄(전시간, 칸) {
  const o = { 판: 'visit-v1', 기록: '들어옴', 쪽: '/', '쪽 언어': '한국어 쪽', '들어온 곳': '직접', 기기: '휴대폰', ...칸 };
  return [일련(+지금 - 전시간 * 3600 * 1000), JSON.stringify(o)];
}

test('값 목록 — 사이트 세기 코드가 보내는 글과 같아야 한다', () => {
  assert.deepEqual(Object.values(값.기록), ['들어옴', '떠남', '누름']);
  assert.deepEqual(값.갈래차례, ['검색', 'SNS', 'AI 답변', '직접', '다른 사이트']);
  assert.equal(값.갈래표['블로그'], 'SNS');
  assert.equal(값.갈래표['SYNK 안'], null);
  assert.deepEqual(값.머문시간, ['10초 아래', '10~30초', '30초~1분', '1~3분', '3~10분', '10분 넘음']);
  assert.deepEqual(값.내려본곳, ['4분의 1 아래', '절반 아래', '4분의 3 아래', '끝 앞', '끝까지']);
  assert.deepEqual(Object.values(값.다음), ['사이트 안 다른 쪽', '바깥 링크', '화면을 떠남']);
  assert.ok(값.문의묶음.every((x) => 값.누른것.includes(x)) && 값.앱받기묶음.every((x) => 값.누른것.includes(x)));
  assert.equal(값.쪽이름('/en/pulse/'), '영어 PULSE');
  assert.equal(값.쪽이름('/en/'), '영어 홈');
  assert.equal(값.쪽이름('/try/x/'), '/try/x/');
});

test('시각읽기 — 시트 일련번호와 한국어 날짜 글', () => {
  const t = Date.parse('2026-11-16T13:40:40Z'); // 한국 22:40:40
  assert.equal(셈.시각읽기(일련(t)), t);
  assert.equal(셈.시각읽기('2026. 11. 16 오후 10:40:40'), t);
  assert.equal(셈.시각읽기('2026. 11. 16 오전 12:05:00'), Date.parse('2026-11-15T15:05:00Z'));
  assert.equal(셈.시각읽기(''), null);
  assert.equal(셈.한국날(t), '2026-11-16');
});

test('방문줄 — 판 · 꼬리표 · 빼기 · 모르는 기록 · 깨진 JSON은 세지 않는다', () => {
  const r = (칸) => { const [t, j] = 줄(1, 칸); return { 타임스탬프: t, 기록: j }; };
  assert.ok(셈.방문줄(r({})));
  assert.equal(셈.방문줄(r({ 판: 'gate-v1' })), null);
  assert.equal(셈.방문줄(r({ 꼬리표: 'launch-check' })), null);
  assert.equal(셈.방문줄(r({ 기록: '봄' })), null);
  assert.equal(셈.방문줄({ ...r({}), 빼기: '빼기' }), null);
  assert.equal(셈.방문줄({ 타임스탬프: 일련(+지금), 기록: '{깨짐' }), null);
  assert.equal(셈.방문줄({ 타임스탬프: 일련(+지금), 기록: '[1,2]' }), null);
  assert.equal(셈.방문줄(r({})).처음들어온곳, '직접', '처음 들어온 곳이 비면 들어온 곳');
  assert.equal(셈.방문줄(r({ 쪽: 'x'.repeat(200) })).쪽.length, 80, '값은 80자까지만 읽는다');
  assert.deepEqual(셈.열쇠들.slice(0, 2), ['판', '기록']);
});

test('방문셈 — 사람 방문 · 갈래 · 첫 쪽 · 날마다 · 쪽 비율 · 누름', () => {
  const 값들 = [머리,
    // 이번 7일: 사람 방문 넷(검색 구글, 인스타, AI ChatGPT, 직접) + 사이트 안 이동 하나
    줄(2, { '들어온 곳': '검색', '들어온 곳 이름': '구글', 쪽: '/' }),
    줄(3, { '들어온 곳': '인스타그램', 쪽: '/pulse/' }),
    줄(30, { '들어온 곳': 'AI 답변', '들어온 곳 이름': 'ChatGPT', 쪽: '/' }),
    줄(50, { 쪽: '/lab/' }),
    줄(2.5, { '들어온 곳': 'SYNK 안', '처음 들어온 곳': '검색', 쪽: '/lab/' }),
    // 홈 떠남 여섯(비율이 보이는 문턱 5를 넘김)
    ...['10~30초', '30초~1분', '30초~1분', '1~3분', '1~3분', '3~10분'].map((m, i) => 줄(2, { 기록: '떠남', 쪽: '/', '머문 시간': m, '내려 본 곳': i < 2 ? '끝까지' : '절반 아래', 다음: i < 3 ? '사이트 안 다른 쪽' : '화면을 떠남' })),
    // 누름: 문의 메일 하나(처음 검색) · 앱 받기 Windows 둘 · 모르는 누름 하나
    줄(2, { 기록: '누름', '누른 것': '문의 메일', '처음 들어온 곳': '검색' }),
    줄(3, { 기록: '누름', '누른 것': '앱 받기(Windows)', '처음 들어온 곳': '인스타그램', '들어온 곳': '인스타그램' }),
    줄(3, { 기록: '누름', '누른 것': '앱 받기(Windows)', '처음 들어온 곳': '인스타그램', '들어온 곳': '인스타그램' }),
    줄(3, { 기록: '누름', '누른 것': '모르는 것' }),
    // 앞 7일 사람 방문 둘, 15일 전 하나(안 셈)
    줄(24 * 8, {}), 줄(24 * 10, { '들어온 곳': '검색' }), 줄(24 * 15, {}),
  ];
  const 정리 = 셈.줄들읽기(값들).map((r) => 셈.방문줄(r)).filter(Boolean);
  const { 방문, 쪽, 행동 } = 셈.방문셈(정리, { 지금 });
  assert.equal(방문.사람, 4);
  assert.equal(방문.앞사람, 2);
  assert.equal(방문.본쪽, 5);
  assert.deepEqual(방문.갈래, [{ 이름: '검색', 수: 1 }, { 이름: 'SNS', 수: 1 }, { 이름: 'AI 답변', 수: 1 }, { 이름: '직접', 수: 1 }, { 이름: '다른 사이트', 수: 0 }]);
  assert.equal(방문.AI방문, 1);
  assert.deepEqual(방문.들어온곳.map((x) => x.이름).sort(), ['ChatGPT', '구글', '인스타그램', '직접'].sort());
  assert.equal(방문.첫쪽[0].쪽, '/');
  assert.equal(방문.첫쪽[0].이름, '홈');
  assert.equal(방문.날마다.length, 7);
  assert.equal(방문.날마다[6].날, '2026-11-17');
  assert.equal(방문.날마다.reduce((a, d) => a + d.수, 0), 4);
  const 홈 = 쪽.쪽들.find((p) => p.쪽 === '/');
  assert.equal(홈.떠남수, 6);
  assert.equal(홈.머문시간, '30초~1분', '여섯의 아래쪽 가운데');
  assert.equal(홈.끝까지, 0.333);
  assert.equal(홈.떠남비율, 0.5);
  const lab = 쪽.쪽들.find((p) => p.쪽 === '/lab/');
  assert.equal(lab.머문시간, null, '떠남 줄이 5개 안 되면 비율을 보이지 않는다');
  assert.equal(행동.문의.합, 1);
  assert.equal(행동.앱받기.합, 2);
  assert.deepEqual(행동.앱받기.나눔, [{ 이름: '앱 받기(Windows)', 수: 2 }, { 이름: '앱 받기(Mac)', 수: 0 }]);
  assert.equal(행동.문의비율, 0.25);
  assert.deepEqual(행동.처음들어온곳별, [{ 갈래: '검색', 문의: 1, 앱받기: 0 }, { 갈래: 'SNS', 문의: 0, 앱받기: 2 }]);
  assert.ok(방문.마지막기록);
});

test('목적셈 — 시트 「요약」 탭과 같은 셈, 시험 꼬리표 · 빼기 줄 뺌', () => {
  const 머리2 = ['타임스탬프', '결정', '고른 칸', '쪽 언어', '들어온 곳', '링크 꼬리표', '기기', '판', '빼기'];
  const r = (전시간, 결정, 칸 = '', 꼬리표 = '', 빼기 = '') => [일련(+지금 - 전시간 * 3600 * 1000), 결정, 칸, '한국어 쪽', '직접', 꼬리표, '휴대폰', 'gate-v1', 빼기];
  const 값들 = [머리2, r(1, '칸을 고름', 'LAB · 한국어'), r(2, '고르지 않고 내려감'), r(3, '내려갔다가 칸을 고름', 'PULSE · 광고·영상'),
    r(4, '칸을 고름', 'LAB · 한국어', 'qa'), r(5, '칸을 고름', 'LAB · 한국어', '', '빼기'), r(24 * 9, '칸을 고름', 'LAB · 한국어')];
  const c = 셈.목적셈(셈.줄들읽기(값들), { 지금 });
  assert.equal(c.방문, 2);
  assert.equal(c.고른방문, 2);
  assert.deepEqual(c.고른칸, [{ 이름: 'LAB · 한국어', 수: 1 }, { 이름: 'PULSE · 광고·영상', 수: 1 }]);
});

test('구글 — 서비스 계정 JWT 서명과 서치콘솔 칸(끝은 오늘에서 3일 앞)', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const 열쇠 = { type: 'service_account', client_email: 'reader@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' };
  let 받은 = null;
  const 토큰 = await 구글.접근토큰(열쇠, { 지금: () => +지금, fetch기: async (u, o) => { 받은 = { u, body: String(o.body) }; return { ok: true, status: 200, json: async () => ({ access_token: 'T' }) }; } });
  assert.equal(토큰, 'T');
  const assertion = new URLSearchParams(받은.body).get('assertion');
  const [h, b, s] = assertion.split('.');
  assert.ok(crypto.createVerify('RSA-SHA256').update(`${h}.${b}`).verify(publicKey, Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')));
  const 몸 = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  assert.equal(몸.scope, 구글.범위.join(' '));
  assert.equal(몸.exp - 몸.iat, 3600);

  const 부름 = [];
  const fetch기 = async (u, o) => {
    const q = JSON.parse(o.body); 부름.push(q);
    const rows = q.dimensions.length === 0 ? [{ clicks: q.startDate === '2026-10-17' ? 3 : 1, impressions: 400, position: 9.46 }]
      : q.dimensions[0] === 'query' ? [{ keys: ['synk'], clicks: 2, impressions: 300 }] : [{ keys: ['https://synk.im/en/'], clicks: 0, impressions: 200 }];
    return { ok: true, status: 200, json: async () => ({ rows }) };
  };
  const c = await 구글.구글칸({ 속성: 'https://synk.im/', 오늘: '2026-11-17', 토큰: 'T', fetch기 });
  assert.equal(c.끝, '2026-11-14');
  assert.equal(c.시작, '2026-10-18');
  assert.equal(부름[1].endDate, '2026-10-17');
  assert.equal(부름[1].startDate, '2026-09-20');
  assert.equal(c.클릭, 1);
  assert.equal(c.앞.클릭, 1);
  assert.equal(c.평균순위, 9.5);
  assert.deepEqual(c.검색어, [{ 말: 'synk', 노출: 300, 클릭: 2 }]);
  assert.deepEqual(c.쪽, [{ 쪽: '/en/', 노출: 200, 클릭: 0 }]);
});

test('AI — Claude 응답 읽기(인용 · 검색 결과 · 검색 오류 객체)', () => {
  const r = AI.클로드읽기({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [
    { type: 'server_tool_use', name: 'web_search' },
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://synk.im/pulse/' }, { url: 'https://kmong.com/a' }] },
    { type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } },
    { type: 'text', text: '추천은 이렇습니다. ', citations: [{ url: 'https://kmong.com/a' }] },
    { type: 'text', text: '끝.' },
  ] });
  assert.equal(r.답, '추천은 이렇습니다. 끝.');
  assert.deepEqual(r.인용주소, ['https://kmong.com/a']);
  assert.deepEqual(r.검색주소, ['https://synk.im/pulse/', 'https://kmong.com/a']);
  assert.equal(r.거절, false);
  assert.equal(AI.클로드읽기({ stop_reason: 'refusal', content: [] }).거절, true);
});

test('AI — Gemini 구독 통로의 답 글에서 출처 주소를 읽고, 판정은 붙인 꼬리를 뺀다', () => {
  const r = AI.제미나이읽기({ selectedModel: 'gemini-3.8-flash-low', text: `추천합니다.
**참고 출처 주소**
https://kmong.com
https://synk.im/pulse/.
(https://soomgo.com)` });
  assert.deepEqual(r.인용주소, ['https://kmong.com', 'https://synk.im/pulse/', 'https://soomgo.com']);
  assert.equal(r.모델, 'gemini-3.8-flash-low');
  const q = { id: 'K01', 묶음: 'PULSE', 글: '질문' };
  const 꼬리만 = AI.판정(q, { 답: `질문${AI.제미나이꼬리}`.repeat(6), 인용주소: [], 검색주소: [] });
  assert.equal(꼬리만.답없음, true, '질문과 꼬리만 되풀이한 답은 답 없음');
});

test('AI — 판정(질문 글은 빼고 언급 · 브랜드는 언급을 세지 않음 · 짧은 답은 답 없음)', () => {
  const 긴 = '가'.repeat(120);
  const 일반 = { id: 'K01', 묶음: 'PULSE', 글: 'AI로 광고 영상을 만들어 주는 업체를 추천해 줘' };
  const 브랜드 = { id: 'B01', 묶음: '브랜드', 글: 'SYNK는 어떤 회사야?' };
  assert.equal(AI.판정(일반, { 답: `${긴} SYNK PULSE가 있습니다`, 인용주소: [], 검색주소: [] }).언급, true);
  assert.equal(AI.판정(일반, { 답: `${긴} Snyk는 보안 회사입니다`, 인용주소: [], 검색주소: [] }).언급, false);
  const b = AI.판정(브랜드, { 답: `SYNK는어떤회사야? ${긴} SYNK는 회사`, 인용주소: ['https://www.synk.im/'], 검색주소: [] });
  assert.equal(b.언급, false);
  assert.equal(b.인용, true);
  assert.equal(AI.판정(일반, { 답: '짧음', 인용주소: ['https://synk.im/'], 검색주소: [] }).답없음, true);
  assert.equal(AI.판정(일반, { 답: '짧음', 인용주소: ['https://synk.im/'], 검색주소: [] }).인용, false, '답 없음은 인용으로 세지 않는다');
  assert.equal(AI.판정(일반, { 답: 긴.repeat(2), 인용주소: ['https://notsynk.im/'], 검색주소: ['https://synk.im/x'] }).인용, false);
  assert.equal(AI.판정(일반, { 답: 긴.repeat(2), 인용주소: [], 검색주소: ['https://synk.im/x'] }).검색에걸림, true);
});

test('AI — 회차재기는 연달아 세 번 실패하거나 429면 그 서비스만 멈춘다', async () => {
  const 질문들 = ['K01', 'K02', 'K03', 'K04', 'B01'].map((id) => ({ id, 묶음: id.startsWith('B') ? '브랜드' : 'PULSE', 글: `질문 ${id}` }));
  const 긴답 = { 답: `${'답'.repeat(100)} synk`, 인용주소: ['https://synk.im/'], 검색주소: [] };
  const 회차 = await AI.회차재기({ 날: '2026-11-17', 질문들, 쉬기: async () => {}, 묻기: {
    Claude: async () => 긴답,
    Gemini: async () => { throw new Error('연결 끊김'); },
    Grok: async (q) => { if (q.id === 'K02') { const e = new Error('HTTP 429'); e.http = 429; throw e; } return 긴답; },
  } });
  const c = 회차.서비스.find((s) => s.이름 === 'Claude');
  assert.deepEqual([c.일반질문, c.답받음, c.언급, c.인용, c.브랜드질문, c.브랜드인용], [4, 4, 4, 4, 1, 1]);
  assert.equal(c.설명, '웹 검색을 켠 답');
  const g = 회차.서비스.find((s) => s.이름 === 'Gemini');
  assert.equal(g.판정들.length, 3);
  assert.ok(회차.멈춤.Gemini);
  assert.equal(회차.서비스.find((s) => s.이름 === 'Grok').판정들.length, 2);
  assert.ok(회차.멈춤.Grok);
});

test('요약 — 측정 전 · 권한 기다림 · 3일 안의 앞 값 이어 쓰기', () => {
  const s = 요약.요약만들기({ 지금, 단계: {
    방문: { 상태: '측정 전', 까닭: '사이트 전체 방문 기록을 아직 켜지 않았습니다.' },
    목적: { 상태: '권한 기다림', 까닭: '홈 방문 목적 시트를 읽을 권한을 기다립니다.' },
    구글: { 오류: true, 까닭: '구글 서치콘솔을 읽지 못했습니다(HTTP 500).' },
    네이버: { 상태: '등록 전', 까닭: '네이버 서치어드바이저에 아직 등록하지 않았습니다.' },
    AI: { 상태: '측정 전' },
  }, 앞요약: { 판: 1, 검색: { 구글: { 상태: '됨', 받은때: new Date(+지금 - 하루).toISOString(), 노출: 10, 클릭: 1 } } } });
  assert.equal(s.판, 1);
  assert.equal(s.방문.상태, '측정 전');
  assert.equal(s.쪽.상태, '측정 전');
  assert.equal(s.행동.까닭, '사이트 전체 방문 기록을 아직 켜지 않았습니다.');
  assert.equal(s.목적.상태, '권한 기다림');
  assert.equal(s.검색.구글.상태, '됨');
  assert.equal(s.검색.구글.낡음, true);
  assert.equal(s.검색.구글.까닭, '오늘은 읽지 못해 11월 16일 값을 보입니다.');
  assert.equal(s.AI.상태, '측정 전');
  assert.equal(s.AI.까닭, '첫 회차를 아직 재지 않았습니다.');
  assert.equal(s.AI.AI방문, null);
  // 앞 값이 3일보다 오래면 이어 쓰지 않는다
  const t = 요약.요약만들기({ 지금, 단계: { 방문: {}, 구글: { 오류: true, 까닭: 'x' } }, 앞요약: { 판: 1, 검색: { 구글: { 상태: '됨', 받은때: new Date(+지금 - 4 * 하루).toISOString() } } } });
  assert.equal(t.검색.구글.상태, '못 읽음');
});

test('요약 쓰기 — 임시 파일을 거쳐 바꾸고 판이 다르면 읽지 않는다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '사이트방문-'));
  const p = path.join(d, 'site-visits', 'summary.json');
  요약.요약쓰기({ 판: 1, 만든때: 'x' }, p);
  assert.equal(요약.요약읽기(p).만든때, 'x');
  fs.writeFileSync(p, JSON.stringify({ 판: 2 }));
  assert.equal(요약.요약읽기(p), null);
  assert.deepEqual(fs.readdirSync(path.dirname(p)), ['summary.json']);
});

test('돌리기 — 켠 날이 없으면 시트가 있어도 측정 전', async () => {
  const 설정 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', '사이트방문', '설정.json'), 'utf8'));
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '사이트방문-'));
  const { 요약: s } = await 모으기.돌리기({ 지금, 설정: { ...설정, 방문기록: { ...설정.방문기록, 켠날: null } }, 건너뛰기: ['AI'], 의존: { 장부폴더: d, 열쇠: { fake: true }, 접근토큰: async () => 'T', fetch기: async () => ({ ok: true, status: 200, json: async () => ({ values: [], rows: [] }) }), 앞요약: null } });
  assert.equal(s.방문.상태, '측정 전');
  assert.equal(s.방문.까닭, '사이트 전체 방문 기록을 아직 켜지 않았습니다.');
});

test('돌리기 — 열쇠가 없으면 시트 · 서치콘솔은 권한 기다림, AI는 장부의 마지막 회차', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '사이트방문-'));
  fs.writeFileSync(path.join(d, 'AI재기.jsonl'), `${JSON.stringify({ 잰때: new Date(+지금 - 하루).toISOString(), 날: '2026-11-16', 서비스: [{ 이름: 'Claude', 일반질문: 24, 답받음: 24, 언급: 0, 인용: 0, 브랜드질문: 6, 브랜드답받음: 6, 브랜드인용: 2 }], 멈춤: {} })}\n`);
  const 설정 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', '사이트방문', '설정.json'), 'utf8'));
  let 재기 = 0;
  const { 요약: s } = await 모으기.돌리기({ 지금, 설정: { ...설정, 방문기록: { ...설정.방문기록, 시트: 'S', 켠날: '2026-11-01' } }, 의존: { 장부폴더: d, 열쇠: null, 앞요약: null, 회차재기: async () => { 재기 += 1; return null; } } });
  assert.equal(재기, 0, '6.5일 안이면 다시 재지 않는다');
  assert.equal(s.방문.상태, '권한 기다림', '권한이 없는 것은 고장(못 읽음)과 나눈다');
  assert.equal(s.방문.까닭, '방문 기록 시트를 읽을 권한을 기다립니다.');
  assert.equal(s.검색.구글.까닭, '구글 서치콘솔을 읽을 권한을 기다립니다.');
  assert.equal(s.검색.네이버.상태, '등록 전');
  assert.equal(s.AI.상태, '됨');
  assert.equal(s.AI.회차날, '2026-11-16');
  assert.equal(s.AI.서비스[0].브랜드인용, 2);
  assert.equal(s.세는쪽.length, 15);
});

test('돌리기 — 열쇠와 시트가 있으면 방문 · 목적 · 구글을 세고, AI 때가 되면 한 회차를 장부에 덧붙인다', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '사이트방문-'));
  const 설정 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', '사이트방문', '설정.json'), 'utf8'));
  const 방문값 = [머리, 줄(1, { '들어온 곳': '검색', '들어온 곳 이름': '네이버' }), 줄(2, { 기록: '누름', '누른 것': '문의 양식' })];
  const 목적값 = [['타임스탬프', '결정', '고른 칸', '쪽 언어', '들어온 곳', '링크 꼬리표', '기기', '판', '빼기'], [일련(+지금 - 3600e3), '칸을 고름', 'LAB · 한국어', '한국어 쪽', '직접', '', '휴대폰', 'gate-v1', '']];
  const fetch기 = async (u, o) => {
    if (u.startsWith('https://sheets.googleapis.com/')) return { ok: true, status: 200, json: async () => ({ values: u.includes('/S/') ? 방문값 : 목적값 }) };
    return { ok: true, status: 200, json: async () => ({ rows: JSON.parse(o.body).dimensions.length ? [] : [{ clicks: 2, impressions: 50, position: 7 }] }) };
  };
  const 회차 = { 날: '2026-11-17', 서비스: [{ 이름: 'Claude', 일반질문: 24, 답받음: 23, 언급: 1, 인용: 0, 브랜드질문: 6, 브랜드답받음: 6, 브랜드인용: 3, 판정들: [] }], 멈춤: {} };
  const { 요약: s, 알림 } = await 모으기.돌리기({ 지금, 설정: { ...설정, 방문기록: { ...설정.방문기록, 시트: 'S', 켠날: '2026-11-15' } },
    의존: { 장부폴더: d, 열쇠: { fake: true }, 접근토큰: async () => 'T', fetch기, 앞요약: null, 질문세트: { 질문: [] }, 회차재기: async () => 회차, 원문쓰기: null } });
  assert.equal(s.방문.상태, '됨');
  assert.equal(s.방문.사람, 1);
  assert.equal(s.방문.앞사람, null, '켠 지 7일이 안 되면 앞 7일과 견주지 않는다');
  assert.equal(s.방문.까닭, '방문 기록은 11월 15일에 켰습니다. 그 앞은 세지 않았습니다.');
  assert.deepEqual(s.방문.들어온곳, [{ 이름: '네이버', 수: 1 }]);
  assert.equal(s.행동.문의.합, 1);
  assert.equal(s.목적.고른방문, 1);
  assert.equal(s.검색.구글.클릭, 2);
  assert.equal(s.AI.서비스[0].언급, 1);
  assert.equal(s.AI.서비스[0].판정들, undefined, '요약에는 판정 원문을 싣지 않는다');
  assert.equal(s.AI.AI방문, 0);
  const 장부 = fs.readFileSync(path.join(d, 'AI재기.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(장부.length, 1);
  assert.equal(장부[0].서비스[0].판정들, undefined);
  assert.ok(알림.some((a) => a.startsWith('방문 기록: 시트 2줄')));
  assert.match(모으기.보기글(s), /사람 1\(앞 —\)/);
  assert.deepEqual(모으기.숫자줄(s), { 날: '2026-11-17', 사람: 1, 문의: 1, 앱받기: 0, 구글노출: 50, 구글클릭: 2, AI언급: 1 });
});
