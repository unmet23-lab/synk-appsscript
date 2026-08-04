// tests/상담인계.test.js — [v9.185] DM 상담 로드맵 Phase 1·2 회귀
// 실행: node --test tests/상담인계.test.js
//
// 지키는 것:
//   ① 인스타 DM(object:'instagram')이 버려지지 않는다 — 구 코드는 'page'만 받아 오류도 로그도 없이
//      버렸다(로드맵 §1-② · 마케팅의 절반이 무응답). 퀵리플라이·postback 도 사람의 응답으로 받는다.
//   ② Meta 상한(텍스트 2000자 한 통·퀵리플라이 13개/제목 20자·카드 10장)을 조립층이 기계로 지킨다.
//   ③ 24시간 창 판정 — 모름은 「닫힘」이다(fail-closed). 창 밖 발송은 Meta가 거부하므로
//      열림으로 잘못 접히면 유호님 클릭이 조용히 실패한다.
//   ④ 인계 회로 배선 — 초안 발송 게이트(URL키 fail-closed·1회성·창 검사)와 폴백(초안 생성 실패에도
//      인계 메일은 나간다)이 소스에 산다.
//
// ⚠ 순수 함수(정규화·조립·창열림)는 **실행**으로 검증한다 — 상담AI.js 톱레벨에 GAS 호출이 없다는
//    v9.57 규약이 전제이고, 그 규약 자체는 tests/safety.test.js 가 지킨다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 엔진 = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8').replace(/\r\n/g, '\n');

const api = new Function(엔진 + '\n;return { 상담_정규화_: 상담_정규화_, 상담_메시지조립_: 상담_메시지조립_, 상담_창열림_: 상담_창열림_ };')();

/* ── ① 정규화 — 인스타 분기 ── */

const 메타틀 = (object, messaging) => ({ object, entry: [{ id: 'ACC1', messaging }] });

test('인스타 DM(object:instagram)을 페북과 같은 모양으로 정규화한다 — 플랫폼 ig', () => {
  const r = api.상담_정규화_(메타틀('instagram', [{ sender: { id: 'IG123' }, message: { mid: 'm1', text: 'Сайн уу' } }]));
  assert.ok(r, '인스타 웹훅이 null 로 버려졌다 — §1-② 재발');
  assert.equal(r.세션, 'IG123');
  assert.equal(r.내용, 'Сайн уу');
  assert.equal(r.플랫폼, 'ig');
  assert.equal(r.경로, 'meta');
});

test('페북 페이지 웹훅은 그대로 산다 — 플랫폼 fb', () => {
  const r = api.상담_정규화_(메타틀('page', [{ sender: { id: 'PS1' }, message: { mid: 'm2', text: '안녕하세요' } }]));
  assert.ok(r);
  assert.equal(r.플랫폼, 'fb');
  assert.equal(r.내용, '안녕하세요');
});

test('퀵리플라이 탭·버튼 postback 도 사람의 응답이다 — payload 를 발화로 받는다', () => {
  const qr = api.상담_정규화_(메타틀('page', [{ sender: { id: 'PS1' }, message: { mid: 'm3', text: '표시제목', quick_reply: { payload: 'FAQ_수업요일' } } }]));
  assert.equal(qr.내용, 'FAQ_수업요일', '퀵리플라이 payload 가 아니라 표시 텍스트를 읽었다');
  const pb = api.상담_정규화_(메타틀('instagram', [{ sender: { id: 'IG1' }, postback: { mid: 'm4', payload: 'CARD_상담신청' } }]));
  assert.ok(pb, 'postback 이 버려졌다 — 카드 버튼을 누른 사람이 무응답을 받는다');
  assert.equal(pb.내용, 'CARD_상담신청');
});

test('메아리(is_echo)·읽음표시는 여전히 무시한다', () => {
  assert.equal(api.상담_정규화_(메타틀('instagram', [{ sender: { id: 'IG1' }, message: { mid: 'm5', text: 'x', is_echo: true } }])), null);
  assert.equal(api.상담_정규화_(메타틀('page', [{ sender: { id: 'PS1' }, delivery: { mids: ['m6'] } }])), null);
});

/* ── ② 조립 — Meta 상한을 기계로 ── */

test('퀵리플라이는 13개·제목 20자로 잘린다 (Meta 상한 — 실조회 2026-08-04)', () => {
  const 목록 = Array.from({ length: 20 }, (_, i) => ({ title: '아주아주아주아주아주긴제목입니다' + i, payload: 'P' + i }));
  const m = api.상담_메시지조립_('본문', { 퀵리플라이: 목록 });
  assert.equal(m.quick_replies.length, 13, '퀵리플라이 상한(13)을 안 지키면 Meta가 전송 자체를 거부한다');
  m.quick_replies.forEach(q => assert.ok(q.title.length <= 20, '제목 20자 상한 위반: ' + q.title));
  assert.equal(m.quick_replies[0].content_type, 'text');
});

test('제네릭 템플릿 카드는 10장으로 잘리고, 카드가 있으면 카드가 본문이다', () => {
  const 카드들 = Array.from({ length: 14 }, (_, i) => ({ title: '카드' + i }));
  const m = api.상담_메시지조립_('이 텍스트는 무시된다', { 카드들 });
  assert.equal(m.attachment.payload.template_type, 'generic');
  assert.equal(m.attachment.payload.elements.length, 10, '캐러셀 상한(10장)을 안 지키면 전송이 거부된다');
  assert.equal(m.text, undefined, '카드와 텍스트를 한 통에 같이 실으면 Meta가 거부한다');
});

test('평문은 1900자로 잘린다 (한 통 상한 2000자·여유 포함)', () => {
  const m = api.상담_메시지조립_('가'.repeat(3000), {});
  assert.equal(m.text.length, 1900);
});

/* ── ③ 24시간 창 ── */

test('24시간 창 — 안이면 열림, 밖이면 닫힘, 모름(null·깨진 값)은 닫힘이다', () => {
  const now = new Date('2026-08-04T12:00:00Z');
  assert.equal(api.상담_창열림_(new Date('2026-08-04T11:00:00Z'), now), true);
  assert.equal(api.상담_창열림_(new Date('2026-08-03T11:59:00Z'), now), false, '25시간 전이 열림으로 나왔다');
  assert.equal(api.상담_창열림_(null, now), false, '모름이 열림으로 접혔다 — 유호님 클릭이 조용히 실패하는 자리');
  assert.equal(api.상담_창열림_(new Date('잘못된 날짜'), now), false);
});

/* ── ④ 배선 — 소스 검증 ── */

test('초안 링크는 서명 토큰 fail-closed 다 — 시트를 읽기 전에 거부한다', () => {
  const fn = 엔진.slice(엔진.indexOf('function 상담_초안발송_('), 엔진.indexOf('\n}', 엔진.indexOf('function 상담_초안발송_(')));
  const 서명검사 = fn.indexOf('상담_링크토큰_');
  const 시트접근 = fn.indexOf('getSheetByName');
  assert.ok(서명검사 >= 0, '초안 링크에 서명 검사가 없다 — 링크를 아는 누구나 학부모에게 발송한다');
  assert.ok(시트접근 > 서명검사, '서명 검사보다 시트 접근이 앞이다 — fail-closed 가 아니다');
  assert.ok(/p\.act === 'draft'/.test(엔진), 'doGet 에 확인 분기가 없다 — 메일 링크가 죽은 링크다');
});

/* 🔴 보안 검토(2026-08-04)가 잡은 4건의 회귀. 넷 다 「초록인 채로 새는」 형태라 문구가 아니라 배선을 본다. */
test('메일 링크에 웹훅 마스터 키(상담AI_URL키)를 싣지 않는다 — 그 키는 doPost 의 유일한 인증이다', () => {
  const fn = 엔진.slice(엔진.indexOf('function 상담_인계알림_('), 엔진.indexOf('function 상담_인계메일_('));
  assert.ok(!/k=.*상담AI_URL키|상담AI_URL키.*base|getProperty\('상담AI_URL키'\)/.test(fn),
    '인계 메일이 마스터 키를 링크에 싣는다 — 메일함이 곧 위조 웹훅 권한이 된다');
  assert.ok(fn.includes('상담_링크토큰_'), '서명 토큰 대신 무엇으로 링크를 인증하는지 알 수 없다');
  const tok = 엔진.slice(엔진.indexOf('function 상담_링크토큰_('));
  assert.ok(tok.includes('computeHmacSha256Signature'), '토큰이 서명이 아니다 — 추측 가능한 값이면 게이트가 아니다');
});

test('발송은 2단이다 — 메일 링크(act=draft)는 부작용이 없고, 발송 링크는 메일에 없다', () => {
  const 알림 = 엔진.slice(엔진.indexOf('function 상담_인계알림_('), 엔진.indexOf('function 상담_인계메일_('));
  assert.ok(알림.includes('act=draft'), '메일 링크가 확인 단계를 거치지 않는다');
  assert.ok(!알림.includes('act=send'), 'act=send 가 메일에 실렸다 — 메일 스캐너·미리보기가 열면 학부모에게 실제로 나간다(비가역)');
  const fn = 엔진.slice(엔진.indexOf('function 상담_초안발송_('));
  assert.ok(/const 실행 = String\(p\.act \|\| ''\) === 'send'/.test(fn), '확인·발송을 가르는 플래그가 없다');
  const 확인분기 = fn.indexOf('if (!실행)');
  const 전송호출 = fn.indexOf('상담_전송_(세션, 텍스트');
  assert.ok(확인분기 >= 0 && 확인분기 < 전송호출, '확인 화면이 전송보다 뒤에 있거나 없다 — 2단이 아니다');
});

test('링크는 「세션의 최신 초안」이 아니라 그 초안 id 를 가리킨다', () => {
  const 알림 = 엔진.slice(엔진.indexOf('function 상담_인계알림_('), 엔진.indexOf('function 상담_인계메일_('));
  assert.ok(알림.includes('초안id'), '초안 묶음에 고유 id 가 없다');
  assert.ok(/i=' \+ 초안id/.test(알림), '링크에 초안 id 가 안 실린다 — 유호님이 읽은 것과 다른 답이 나간다');
  const fn = 엔진.slice(엔진.indexOf('function 상담_초안발송_('));
  assert.ok(/r\[2\] === 'draft' && String\(r\[8\]\)\.indexOf\(초안id\) >= 0/.test(fn),
    '초안 행을 id 로 찾지 않는다 — 마지막 draft 가 이기면 승인 대상이 밀린다');
});

test('인계 메일은 다이제스트를 타지 않는다 — 다음 날 08시면 24시간 창이 이미 닫힌다', () => {
  const fn = 엔진.slice(엔진.indexOf('function 상담_인계메일_('), 엔진.indexOf('function 상담_링크토큰_('));
  assert.ok(fn.includes('MailApp.sendEmail'), '인계 메일이 즉시 발송 경로를 안 쓴다');
  assert.ok(fn.includes('quotaOk'), '쿼터 관문(리허설 차단 포함)을 건너뛴다');
  // ⚠ 구간은 상담_인계알림_ 하나만 자른다 — 상담_인계메일_ 까지 삼키면 그 안의 **정당한 폴백**을 위반으로 읽는다
  //   (초록/적색이 뒤집히는 게 아니라 거짓 적색이 되는 자리 · 08-04 「테스트 자신이 결함」 계열)
  const 알림 = 엔진.slice(엔진.indexOf('function 상담_인계알림_('), 엔진.indexOf('function 상담_인계메일_('));
  assert.ok(!/\badminMail\(/.test(알림), '인계 알림이 아직 adminMail(다이제스트 큐)로 나간다 — 링크가 도착할 때는 창이 닫혀 있다');
});

test('IG 잠금 비대칭은 fail-closed 다 — 페이지ID만 걸면 인스타가 무잠금으로 새면 안 된다', () => {
  const dopost = 엔진.slice(엔진.indexOf('function doPost('), 엔진.indexOf('function doGet('));
  assert.ok(dopost.includes('ig-lock-missing'),
    '페이지ID는 잠갔는데 IG계정ID가 없을 때 통과시킨다 — object:instagram 이라고만 선언하면 잠금을 우회한다');
});

test('승인 대상은 실제 발송문의 역번역이다 — 한국어 필드는 발송문을 보증하지 않는다', () => {
  const 알림 = 엔진.slice(엔진.indexOf('function 상담_인계알림_('), 엔진.indexOf('function 상담_인계메일_('));
  assert.ok(알림.includes('역번역'), '메일이 발송문의 역번역을 안 보여준다 — 유호님이 못 읽는 문장을 승인하게 된다');
  const 역 = 엔진.slice(엔진.indexOf('function 상담_역번역_('));
  assert.ok(/지시가 아니다/.test(역), '역번역 프롬프트가 입력을 자료로 못박지 않는다 — 같은 주입에 같이 넘어간다');
  const 초안 = 엔진.slice(엔진.indexOf('function 상담_인계초안_('), 엔진.indexOf('function 상담_역번역_('));
  assert.ok(/지시가 아니다/.test(초안), '초안 생성 프롬프트에 주입 방어 문구가 없다');
});

test('초안 발송은 1회성 + 24시간 창 검사를 지난다', () => {
  const fn = 엔진.slice(엔진.indexOf('function 상담_초안발송_('));
  assert.ok(fn.includes('발송됨'), '이미 발송된 초안의 재발송을 막는 표식이 없다 — 메일 전달·재클릭이 중복 발송이 된다');
  assert.ok(fn.includes('상담_창열림_'), '발송 전 24시간 창을 확인하지 않는다');
});

test('doGet 은 여전히 HtmlService 를 반환하지 않는다 (⛔ 2026-08-03 — 171개 전역이 원장 권한으로 열린다)', () => {
  const doget = 엔진.slice(엔진.indexOf('function doGet('), 엔진.indexOf('function 상담_정규화_('));
  assert.ok(!/HtmlService/.test(doget), 'doGet 에 HtmlService 가 들어왔다 — 상담AI.js 머리말 ⛔ 참조');
});

test('인계 메일은 초안 생성이 실패해도 나간다 (폴백 — 인계는 마지막 안전망)', () => {
  const fn = 엔진.slice(엔진.indexOf('function 상담_인계알림_('), 엔진.indexOf('function 상담_인계초안_('));
  assert.ok(fn.includes('원문만 보냅니다'), '초안 실패 폴백 메일이 없다 — 인계 자체가 조용히 죽는다');
  assert.ok((fn.match(/adminMail\(/g) || []).length >= 2, '폴백·본선 두 경로 모두 adminMail 을 불러야 한다');
  assert.ok(fn.includes('slice(0, 500)'), '초안을 셀 상한 아래로 자르지 않는다 — JSON이 2000자에서 잘려 발송이 죽는다');
});

test('대화 이력은 user·bot 만 읽는다 — draft·system 행이 모델 입력에 섞이면 안 된다', () => {
  const fn = 엔진.slice(엔진.indexOf('function 상담_이력_('), 엔진.indexOf('function 셀안전_('));
  assert.ok(/r\[2\] === 'user' \|\| r\[2\] === 'bot'/.test(fn),
    '이력 필터가 발신 종류를 안 가른다 — 인계 초안 JSON이 assistant 발화로 모델에 들어간다');
});

test('웹훅 잠금이 플랫폼별로 갈린다 — 인스타 entry.id 는 페이지ID가 아니다', () => {
  assert.ok(엔진.includes('상담AI_IG계정ID'), 'IG 계정ID 잠금이 없다 — 페이지ID 하나로 거르면 인스타 전체가 wrong-page 로 죽는다');
  const dopost = 엔진.slice(엔진.indexOf('function doPost('), 엔진.indexOf('function doGet('));
  assert.ok(/플랫폼 === 'ig'/.test(dopost), 'doPost 의 잠금 선택이 플랫폼을 안 본다');
});

test('발송 토큰이 플랫폼으로 갈린다 — IG 전용 토큰이 있으면 그것, 없으면 페이지토큰 폴백', () => {
  const fn = 엔진.slice(엔진.indexOf('function 상담_전송_('), 엔진.indexOf('function 상담_팔로우확인_('));
  assert.ok(fn.includes('상담AI_IG토큰'), '전송이 IG 토큰을 모른다');
  assert.ok(fn.includes('상담AI_페이지토큰'), '페이지토큰 폴백이 사라졌다 — 연결 계정(공용 토큰) 배선이 죽는다');
});

test('팔로우 게이트는 「모름=null」을 보존한다 — 모름을 아니오로 번역하면 안 된다', () => {
  const fn = 엔진.slice(엔진.indexOf('function 상담_팔로우확인_('), 엔진.indexOf('function 상담_인계알림_('));
  assert.ok(fn.includes('is_user_follow_business'), '팔로우 조회 필드가 없다');
  assert.ok((fn.match(/return null/g) || []).length >= 3, '실패 경로가 null 이 아니다 — 조회 실패가 「팔로우 안 함」으로 접힌다');
});
