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
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지어를 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다. 구간 앵커는 원문 그대로 둔다(앵커가 주석 배너면 정제가 앵커를 지운다). */
const { 코드만 } = require('./lib/소스검사.js');

const api = new Function(엔진 + '\n;return { 상담_정규화_: 상담_정규화_, 상담_메시지조립_: 상담_메시지조립_, 상담_창열림_: 상담_창열림_, 상담_확인화면본_: 상담_확인화면본_ };')();

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
  assert.ok(!/k=.*상담AI_URL키|상담AI_URL키.*base|getProperty\('상담AI_URL키'\)/.test(코드만(fn)),
    '인계 메일이 마스터 키를 링크에 싣는다 — 메일함이 곧 위조 웹훅 권한이 된다');
  assert.ok(fn.includes('상담_링크토큰_'), '서명 토큰 대신 무엇으로 링크를 인증하는지 알 수 없다');
  const tok = 엔진.slice(엔진.indexOf('function 상담_링크토큰_('));
  assert.ok(tok.includes('computeHmacSha256Signature'), '토큰이 서명이 아니다 — 추측 가능한 값이면 게이트가 아니다');
});

test('발송은 2단이다 — 메일 링크(act=draft)는 부작용이 없고, 발송 링크는 메일에 없다', () => {
  const 알림 = 엔진.slice(엔진.indexOf('function 상담_인계알림_('), 엔진.indexOf('function 상담_인계메일_('));
  assert.ok(알림.includes('act=draft'), '메일 링크가 확인 단계를 거치지 않는다');
  assert.ok(!코드만(알림).includes('act=send'), 'act=send 가 메일에 실렸다 — 메일 스캐너·미리보기가 열면 학부모에게 실제로 나간다(비가역)');
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
  assert.ok(!/\badminMail\(/.test(코드만(알림)), '인계 알림이 아직 adminMail(다이제스트 큐)로 나간다 — 링크가 도착할 때는 창이 닫혀 있다');
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
  assert.ok(!/HtmlService/.test(코드만(doget)), 'doGet 에 HtmlService 가 들어왔다 — 상담AI.js 머리말 ⛔ 참조');
});

/* 🔴 실행층 방어(F081 계열) — 이 함수는 ScriptApp.getService()·MailApp·UrlFetchApp 를 쓴다.
 *   웹앱 미배포·쿼터 같은 **환경 조건에서만** 던지는 자리라 소스 검사로는 안 보인다. 예외가 새면
 *   호출부(상담응답_)가 봇 답변을 전송하기도 전에 doPost 의 catch 로 튀어 학부모가 침묵을 받는다. */
test('인계 알림이 통째로 실패해도 봇 답변 경로를 죽이지 않는다', () => {
  const 겉 = 엔진.slice(엔진.indexOf('function 상담_인계알림_('), 엔진.indexOf('function 상담_인계알림본_('));
  assert.ok(/try \{[\s\S]*상담_인계알림본_[\s\S]*\} catch/.test(겉),
    '인계 본체가 try 로 감싸이지 않았다 — 여기서 던지면 학부모에게 답이 안 나간다');
  assert.ok(겉.includes('초안 회로 실패'), '실패했을 때 유호님께 알리는 최후 메일이 없다 — 조용히 사라진다');
  assert.ok(/catch \(__\)/.test(겉), '최후 메일마저 실패할 때를 안 잡는다 — 그 예외가 그대로 새어 나간다');
});

test('인계 메일은 초안 생성이 실패해도 나간다 (폴백 — 인계는 마지막 안전망)', () => {
  // ⚠ 구간은 본체만 자른다 — 상담_인계메일_ 까지 삼키면 그 안의 adminMail 폴백을 본체 것으로 오인한다
  const fn = 엔진.slice(엔진.indexOf('function 상담_인계알림본_('), 엔진.indexOf('function 상담_인계메일_('));
  assert.ok(fn.includes('원문만 보냅니다'), '초안 실패 폴백 메일이 없다 — 인계 자체가 조용히 죽는다');
  assert.ok((fn.match(/상담_인계메일_\(/g) || []).length >= 2, '폴백·본선 두 경로 모두 즉시 발송 통로를 타야 한다');
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

/* ── ⑤ 채널 칸 — 소급이 안 되는 자리 (유호 확정 08-07 「데이터 쌓는 구조로」) ──
 * 페북=학부모 / 인스타=학생이라 이 라벨이 없으면 두 말뭉치가 한 덩어리가 되고, **지나간 행은 되살릴 수 없다**
 * (세션은 양쪽 다 숫자열이라 나중에 못 가른다). 빠졌을 때의 증상이 「빈 칸」이라 조용해서 회귀로 못박는다. */

// 시트 없이 상담_기록_ 만 떼어 돌린다 — ensureSheet·SpreadsheetApp 를 인자로 주입한다(상담AI.js 톱레벨은 GAS 무호출).
function 기록기(초기폭) {
  const 기록 = { 행: [], 머리글: null, 폭: 초기폭 };
  const sh = {
    getLastColumn: () => 기록.폭,
    getRange: (_r, _c, _nr, nc) => ({ setValues: (v) => { 기록.머리글 = v[0]; 기록.폭 = nc; } }),
    appendRow: (row) => 기록.행.push(row),
  };
  const 만들기 = new Function('SpreadsheetApp', 'ensureSheet', 엔진 + '\n;return 상담_기록_;');
  return { 쓰기: 만들기({ getActiveSpreadsheet: () => ({}) }, () => sh), 기록 };
}

test('대화 행이 채널(fb/ig)을 들고 쌓인다 — 고정 10번째 칸', () => {
  const { 쓰기, 기록 } = 기록기(11);
  쓰기('IG123', 'user', 'Сайн уу', false, null, '', 'ig');
  쓰기('PS1', 'bot', '안녕하세요', false, null, '', 'fb');
  assert.equal(기록.행[0].length, 11, '칸 수가 머리글과 다르다');
  assert.equal(기록.행[0][9], 'ig', '인스타 대화에 채널이 안 실렸다 — 학생 말뭉치를 나중에 못 가른다');
  assert.equal(기록.행[1][9], 'fb');
});

test('모르는 채널은 지어내지 않고 비운다 — 「fb 로 접기」가 학부모 말뭉치를 오염시킨다', () => {
  const { 쓰기, 기록 } = 기록기(11);
  쓰기('-', 'system', '오류', true, null);
  assert.equal(기록.행[0][9], '', '채널을 모르는 행이 특정 채널로 접혔다');
});

/* [v9.201] 모델 칸 — 채널과 같은 「소급이 안 되는 자리」다. 단가가 다른 모델이 한 달에 섞이면
 * 토큰 수만 남은 지난 행은 **어느 단가로 셀지 되짚을 근거가 없다**(비용 보고가 영영 틀린다). */
test('토큰이 실린 행은 어느 모델이 답했는지 들고 쌓인다', () => {
  const { 쓰기, 기록 } = 기록기(11);
  쓰기('PS1', 'bot', '안녕하세요', false, { input_tokens: 10, output_tokens: 5 }, '', 'fb');
  assert.ok(기록.행[0][10], '토큰이 실린 행에 모델이 없다 — 그 달 비용은 단가를 되짚을 수 없다');
});

test('토큰이 없는 행에는 모델을 안 적는다 — 학생 발화가 「그 모델이 답한 행」으로 세어진다', () => {
  const { 쓰기, 기록 } = 기록기(11);
  쓰기('PS1', 'user', '안녕', false, null, '', 'fb');
  assert.equal(기록.행[0][10], '', '토큰 없는 행에 모델이 찍혔다');
});

test('이미 서 있는 옛 시트(10칸)는 머리글을 스스로 넓힌다 — 새 칸이 이름 없이 쌓이면 안 된다', () => {
  const { 쓰기, 기록 } = 기록기(10);
  쓰기('PS1', 'user', '안녕', false, null, '', 'fb');
  assert.deepEqual(기록.머리글, ['시각', '세션', '발신', '내용', '인계', '입력토큰', '캐시읽기', '출력토큰', '비고', '채널', '모델']);
  assert.equal(기록.폭, 11);
});

test('칸은 **끝에만** 늘린다 — 중간에 끼우면 발송 표식(9번 칸)이 엉뚱한 칸에 찍힌다', () => {
  const 머리글 = /상담AI_로그헤더 = (\[[^\]]*\])/.exec(엔진);
  assert.ok(머리글, '로그 머리글 상수를 못 찾았다');
  const 칸 = JSON.parse(머리글[1].replace(/'/g, '"'));
  assert.equal(칸.indexOf('비고'), 8, '비고가 9번째 칸이 아니다 — 발송 표식 setValue(_, 9) 가 어긋난다');
  assert.equal(칸.indexOf('채널'), 9, '채널이 10번째 칸이 아니다 — 읽는 쪽이 전부 r[9] 로 집는다');
  assert.equal(칸[칸.length - 1], '모델', '모델이 마지막 칸이 아니다 — 새 칸은 끝에만 늘린다');
});

/* 호출 하나의 인자를 깊이 세어 가른다 — 꼬리 정규식으로는 못 센다.
 * `JSON.stringify({...})`·`'인계 초안(미발송) '` 처럼 인자 안에 괄호·중괄호가 들어오고,
 * 마지막 인자가 `플랫폼 || 'fb'` 면 「플랫폼으로 끝나는가」류 검사는 **거짓양성**을 낸다(실측으로 잡았다). */
function 인자들(원문, 여는괄호) {
  let 깊이 = 0, 따옴표 = '', 현재 = '', out = [];
  for (let i = 여는괄호; i < 원문.length; i += 1) {
    const c = 원문[i];
    if (따옴표) { 현재 += c; if (c === 따옴표 && 원문[i - 1] !== '\\') 따옴표 = ''; continue; }
    if (c === "'" || c === '"' || c === '`') { 따옴표 = c; 현재 += c; continue; }
    if ('([{'.includes(c)) { 깊이 += 1; if (깊이 === 1) continue; }
    if (')]}'.includes(c)) { 깊이 -= 1; if (깊이 === 0) { out.push(현재.trim()); return out; } }
    if (c === ',' && 깊이 === 1) { out.push(현재.trim()); 현재 = ''; continue; }
    현재 += c;
  }
  return null;                                   // 닫히지 않았다 = 검사 불가(호출부가 아니다)
}

test('플랫폼을 아는 기록 호출은 하나도 빠짐없이 채널을 넘긴다 (호출부가 늘 때 빠지는 그 자리)', () => {
  // 같은 방어를 손으로 N번 얹는 구조라 N+1 번째가 빠진다(v9.153 계열 재발 7건) — 소스에서 전수로 센다.
  const 빠진 = [];
  let 검사한수 = 0;
  for (const m of 엔진.matchAll(/상담_기록_\(/g)) {
    const 앞 = 엔진.slice(0, m.index);
    if (/function\s*$/.test(앞)) continue;        // 정의부는 호출이 아니다
    // ⚠ +1 — 줄바꿈을 포함해 자르면 split('\n')[0] 이 **빈 문자열**이라 시그니처를 영영 못 본다
    //   (그러면 「아는 자리」가 0건이 되어 이 검사가 통째로 헛돈다 — 변이로 잡았다).
    const 본문 = 엔진.slice(앞.lastIndexOf('\nfunction ') + 1, m.index);
    assert.ok(본문.startsWith('function '), '함수 경계를 못 찾았다 — 이 검사가 헛돈다');
    // 이 함수 안에서 채널을 알 수 있는가(인자 플랫폼 · opts.플랫폼 · draft JSON 의 d.플랫폼)
    // ⚠ `\b` 를 쓰지 않는다 — JS 의 단어 경계는 ASCII 라 **한글 앞뒤에선 영영 안 걸린다**(변이로 잡았다).
    if (!(본문.split('\n')[0].includes('플랫폼') || /opts\.플랫폼|d\.플랫폼/.test(본문))) continue;
    검사한수 += 1;
    const args = 인자들(엔진, m.index + '상담_기록_'.length);
    assert.ok(args, '인자를 못 갈랐다 — 검사 불가를 통과로 읽으면 안 된다');
    if (args.length < 7 || !args[6].includes('플랫폼')) {
      빠진.push(엔진.slice(m.index, m.index + 80).replace(/\s+/g, ' '));
    }
  }
  // 0건과 미실행을 가른다 — 「아는 자리」가 하나도 안 잡히면 위 필터가 죽은 것이다.
  assert.ok(검사한수 >= 8, `채널을 아는 기록 호출이 ${검사한수}건뿐 — 필터가 헛돈다`);
  assert.deepEqual(빠진, [], '플랫폼을 아는 자리인데 채널 없이 기록한다 — 그 행은 영영 채널 미상이다');
});

/* ── ⑤ 확인 화면 — 발송 링크는 역번역이 있을 때만 (컨텍스트 독립 리뷰 P2-② · 08-13) ──
 * 화면의 존재 이유가 「원장이 못 읽는 몽골어의 뜻을 확인하고 보낸다」(v9.185)인데, 구판은 역번역이
 * 실패해도 링크를 남겼다 — 「확실하지 않으면 보내지 마세요」는 판단 재료 없는 판단 요구다.
 * 일시(null)와 검증 폐기({사유:'옛글자'})는 안내가 다르다 — 후자를 일반 실패로 접으면 조작·금지 문자
 * 신호가 네트워크 오류로 위장된다(마커를 만드는 판정 자체는 옛글자런타임.test.js ⑥이 진다). */

const 발송주소픽스처 = 'https://script.example/exec?act=send&s=S1&i=abcd1234&t=tok&d=1';

/* ⚠ 아래 `본` 은 **`코드만()` 으로 감싸지 않는다** — `api.상담_확인화면본_()` 이 그려 낸 «런타임 산출»
 *   (유호님이 실제로 볼 확인 화면 HTML)이지 파일 원문이 아니다. JS 렉서를 대면 화면 문구의 `//`·`/*`
 *   를 주석으로 읽어 본문을 지운다 — 부정 단언이라 그래도 초록이라 아무도 모른다. (갈래 ⓑ · 대기열 #Q72) */

test('역번역 성공 — 발송 링크가 실리고 역번역이 보인다', () => {
  const 본 = api.상담_확인화면본_('Сайн байна уу', ['안녕하세요'], 1, 발송주소픽스처);
  assert.ok(본.includes('안녕하세요'), '역번역 본문이 화면에 없다');
  assert.ok(본.includes(발송주소픽스처), '역번역이 멀쩡한데 발송 링크가 없다 — 정상 통로가 막혔다');
});

test('역번역 일시 실패(null) — 발송 링크를 열지 않고 새로고침 재시도를 안내한다', () => {
  const 본 = api.상담_확인화면본_('Сайн байна уу', null, 2, 발송주소픽스처);
  assert.ok(!본.includes(발송주소픽스처), '역번역 없이 발송 링크가 노출됐다 — 뜻 모를 문장이 학원 이름으로 나가는 문이 열린다');
  assert.ok(본.includes('새로고침'), '재시도 통로 안내가 없다 — 일시 오류가 막다른 길이 된다');
});

test('역번역 검증 폐기(옛 글자) — 링크를 열지 않고, 사유를 이름으로 말하며, 반복 시 초안을 버리라 한다', () => {
  const 본 = api.상담_확인화면본_('Сайн байна уу', { 사유: '옛글자', 짚음: 'U+683C' }, 3, 발송주소픽스처);
  assert.ok(!본.includes(발송주소픽스처), '검증 폐기인데 발송 링크가 노출됐다 — 게이트가 화면에서 되돌려진다');
  assert.ok(본.includes('U+683C'), '무엇이 걸렸는지 코드포인트 표기로 말하지 않는다(F298 — 글자 인용은 금지, 표기는 필수)');
  assert.ok(본.includes('쓰지 말'), '반복 시 초안 폐기 안내가 없다 — 「계속 새로고침」이 무한 루프 처방이 된다');
});

test('배선 — 화면이 조립기를 실제로 쓰고, 메일이 폐기 사유를 말하고, 인계초안 system 이 정본을 싣는다', () => {
  // 조립기만 고치고 화면이 옛 조립을 쓰면 위 세 검사는 공회전이다 — 배선을 소스로 핀다.
  const 발송덩이 = 엔진.split(/\nfunction /).find((c) => c.startsWith('상담_초안발송_'));
  assert.ok(발송덩이 && 발송덩이.includes('상담_확인화면본_('), '확인 화면이 조립기를 안 쓴다 — 링크 게이트가 죽은 코드다');
  const 알림덩이 = 엔진.split(/\nfunction /).find((c) => c.startsWith('상담_인계알림본_'));
  assert.ok(알림덩이 && 알림덩이.includes('!Array.isArray(확장.역번역)'),
    '인계 메일이 역번역 폐기를 일시 오류의 얼굴로 둔다 — 「확인 화면에서 다시」가 무한 재시도 안내가 된다 (P2-②)');
  // P2-③ — 문자 규칙은 상담_시스템_ 에만 적는다: 인계초안이 그 정본을 그대로 실어 한 줄이 두 깔때기를 덮는다.
  const 초안덩이 = 엔진.split(/\nfunction /).find((c) => c.startsWith('상담_인계초안_'));
  assert.ok(초안덩이 && 초안덩이.includes('상담_시스템_()'),
    '인계초안 system 이 상담_시스템_ 정본에서 떨어졌다 — 문자 규칙 한 줄이 두 깔때기를 덮는 전제가 깨졌다 (P2-③)');
});
