'use strict';
/**
 * 📜 시즌 회고 편지 — 「우리가 당신에 대해 알게 된 것」이 이해 대장 칸 이름으로 되짚어지고, 읽은 사람의 물음 하나가 증언 그릇에 닿는가
 * (09-07 · 브랜드 v2 ㉡-1 · 트랙 §0-명품 5번 · v9.324 손질 = 코덱스 검수 49eb769 의 지적 일곱)
 *
 * ■ 이 시험이 재는 것
 *   ① 블록(회고_알게된것_) — 층 셋(㉠㉡㉢)이 «늘» 줄로 서고, 재료가 있으면 이름으로, 없으면 「아직 적을 것이 없습니다」로.
 *      닿음 판정은 전체 이력(지난 시즌에 닿은 것도 닿은 것) · 숙제는 강의 요약 행을 빼고 같은 날은 한 번 · 드림 한 줄은 시즌 끝까지의 기록만 ·
 *      스스로 한 말은 시즌 창으로 읽는다 · 업적 «리듬» 문장은 안 싣는다(사람의 성향 판정은 확인 없이 안 나간다).
 *   ② 편지(회고편지글_) — 무대 Ⓐ/Ⓑ 낱말 · 물음 · 링크 · 「없다」도 답.
 *   ③ 시즌 고르기(회고대상시즌_) — 9~10주차에만 · «지난 시즌»은 실제로 돌았을 때만(조 편성·입학시즌에 그 키) · 첫 시즌 2주차엔 null.
 *   ④ 수신자(회고수신자_) — 그 시즌에 있던 학생만(입학시즌 ≤ 시즌키 · 없으면 등록일 ≤ 끝 · 둘 다 모르면 뺀다) · 보호자 이메일 우선.
 *   ⑤ 발송(시즌회고발송_) — 열쇠는 보낸 «뒤»에만 · 실패한 사람은 다음 주에 다시 · 못 보낸 사람이 있으면 시즌 도장을 안 찍는다 · 본문 고정.
 *   ⑥ 통로(회고API_) — 열쇠 없으면 0 · show 는 고정 본문 · answer 는 잠금 안에서 한 번만 · 보호자 답은 화자 보호자 · 증언남기기_ 로.
 *   ⑦ 배선 — 월요일 weeklyJobs · ?p=회고 GET·POST · HtmlService 0.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { engineSource } = require('./_engine-source');
const code = engineSource();

function section(시작, 끝) {
  const s = code.indexOf(시작);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${시작}`);
  const e = code.indexOf(끝, s + 시작.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${끝}`);
  return code.slice(s, e);
}
const 앞절 = section("const RETRO_SOURCE_ = '회고물음';", 'function 회고API_(e, method) {');
const API시작 = code.indexOf('function 회고API_(e, method) {');
const API절 = code.slice(API시작, code.indexOf('\n}\n', API시작) + 3);
const 주차절 = section('function seasonWeekOf_(', '/* --- 역할·짝');

/** 시트 흉내 — 헤더 + 행. */
function 시트(헤더, rows) {
  return {
    getLastRow() { return rows.length + 1; },
    getLastColumn() { return 헤더.length; },
    getRange(r, c, n, w) {
      return { getValues() { return r === 1 ? [헤더.slice(c - 1, c - 1 + w)] : rows.slice(r - 2, r - 2 + n).map(row => row.slice(c - 1, c - 1 + w)); } };
    },
  };
}
const D = (s) => new Date(s + 'T00:00:00');
const fmt = (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
const 시즌 = { 키: '2026-11-30', 시작: D('2026-11-30'), 끝: D('2027-01-24') };
const HWH = ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션', '상태', '학생확인', '포인트지급', '숙제ID'];

function 엔진(o) {
  o = o || {};
  const sheets = o.sheets || {};
  const state = o.state || new Map();
  const app = { getLastRow() { return state.size + 1; } };
  const calls = { mail: [], 증언: [], 증언맵창: null, locks: 0 };
  const ss = { getSheetByName: (n) => (n === 'app_state' ? app : (sheets[n] || null)), getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' };
  const toDate_ = (v) => (v instanceof Date ? v : (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : null));
  const 진단문형이름_ = (g) => ({ G502: '-(으)ㄹ 것 같다', G708: '-더라도' }[g] || '');
  const 증언맵_ = (s, 창) => { calls.증언맵창 = 창; return { 맵: o.증언 || {}, 건수: 0, 학생수: 0 }; };
  const seasonStartOf_ = () => (o.start === undefined ? null : o.start);
  const seasonKeyOf_ = (v) => (v instanceof Date ? fmt(v) : String(v == null ? '' : v).trim());
  const Utilities = {
    formatDate: (d) => fmt(d), getUuid: () => 'uuid-1',
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
  };
  const getState = (st, k) => (state.has(k) ? { row: 1, val: state.get(k) } : { row: -1, val: '' });
  const setState = (st, k, v) => { state.set(k, v); };
  const ensureSheet = () => app;
  const quotaOk = () => (o.quota === undefined ? true : o.quota);
  const MailApp = { sendEmail: (to, subj, body) => { if (o.mailFail && o.mailFail(to)) throw new Error('mail down'); calls.mail.push({ to, subj, body }); } };
  const props = new Map();
  const PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => props.get(k) || null, setProperty: (k, v) => { props.set(k, v); } }) };
  const LockService = { getScriptLock: () => ({ tryLock: () => { if (o.lockRefuse) return false; calls.locks++; return true; }, releaseLock: () => {} }) };
  const ContentService = { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ 본문: s, setMimeType() { return this; } }) };
  const 증언남기기_ = (s, 입력) => { calls.증언.push(입력); return { ok: true, id: 'x', 중복: false }; };
  const E = new Function('toDate_', '진단문형이름_', '증언맵_', 'seasonStartOf_', 'seasonKeyOf_', 'Utilities', 'SEASON_WEEKS', 'HW_FEEDBACK_HEADERS', 'LECTURE_SRC_PREFIX',
    'ENTRY_SEASON_HEADS_', 'getState', 'setState', 'ensureSheet', 'quotaOk', 'MailApp', 'PropertiesService', 'LockService', 'ContentService', 'SpreadsheetApp', 'Logger', '증언남기기_',
    `${주차절}\n${앞절}\n${API절}\nreturn { 회고_알게된것_, 회고편지글_, 회고물음_, 회고대상시즌_, 시즌있었나_, 회고수신자_, 시즌회고발송_, 회고API_, 회고토큰_ };`)(
    toDate_, 진단문형이름_, 증언맵_, seasonStartOf_, seasonKeyOf_, Utilities, 8, HWH, '강의:', ['입학시즌'], getState, setState, ensureSheet, quotaOk, MailApp, PropertiesService,
    LockService, ContentService, { getActiveSpreadsheet: () => ss }, { log: () => {} }, 증언남기기_);
  return { E, ss, state, calls };
}
const 결과 = (out) => JSON.parse(out.본문);

/* ───────────────────── ① 블록 ───────────────────── */
test('[회고] 재료가 없으면 세 층이 전부 「아직 적을 것이 없습니다」로 선다 — 층은 늘 셋이고 지어내지 않는다(재료수 0)', () => {
  const { E, ss } = 엔진({});
  const r = E.회고_알게된것_(ss, 'S1', 시즌);
  assert.equal(r.재료수, 0);
  assert.deepEqual(r.줄들.map(l => l.칸), ['㉠', '㉡', '㉢']);
  r.줄들.forEach(l => assert.ok(/아직 적을 것이 없습니다/.test(l.글), l.글));
});

test('[회고] ㉠ 실력 — 닿음 판정은 전체 이력이다(지난 시즌에 닿은 것도 닿은 것) · 이번 시즌 도달 수는 시즌 창 · 연습·남의 행·시즌 뒤는 안 센다', () => {
  const 진단 = 시트(['세션번호', '학생번호', '시작점', '표본급수', '다음문형'], [['d1', 'S1', '✓', 3, '["G502","G708"]'], ['d3', 'S2', '✓', 3, '["G708"]']]);
  const ml = 시트(['student_id', 'grammar_id', '상태', '첫기록일', '도달일'], [
    ['S1', 'G502', '도달', D('2026-10-01'), D('2026-10-20')],   // 지난 시즌에 이미 닿았다
    ['S1', 'G777', '도달', D('2026-12-01'), D('2027-02-10')],   // 시즌 뒤
    ['S1', 'G708', '연습', D('2026-12-05'), ''],
    ['S2', 'G708', '도달', D('2026-12-05'), D('2026-12-06')],
  ]);
  const { E, ss } = 엔진({ sheets: { 진단세션: 진단, mastery_log: ml } });
  const 줄 = E.회고_알게된것_(ss, 'S1', 시즌).줄들[0].글;
  assert.ok(/시작 진단 3급/.test(줄), 줄);
  assert.ok(/이번 시즌 도달로 적힌 문법은 아직 없습니다/.test(줄), 줄);
  assert.ok(/다음 자리 중 1개에 닿았습니다/.test(줄), '지난 시즌에 닿은 것을 「아직 안 닿았다」고 하면 안 된다(코덱스 09-07 P1): ' + 줄);
  assert.ok(줄.indexOf('G777') === -1, '시즌 뒤 도달이 섞였다');
});

test('[회고] ㉡ 사람 — 숙제는 강의 요약 행을 빼고 같은 날은 한 번 · 업적 리듬 문장은 안 싣는다 · ㉢ 삶 — 드림 한 줄은 시즌 끝까지의 기록만 · 스스로 한 말은 시즌 창', () => {
  const at = 시트(['id', 'student_id', 'timestamp'], [['a', 'S1', D('2026-12-03')], ['b', 'S1', D('2027-03-01')]]);
  const hf = 시트(HWH, [
    ['h1', 'S1', D('2026-12-10'), '', '', '', '', '', '노출', '', '', 'HW1'],
    ['h2', 'S1', D('2026-12-10'), '', '', '', '', '', '노출', '', '', 'HW2'],       // 같은 날 둘째 카드
    ['h3', 'S1', D('2026-12-11'), '', '', '', '', '', '노출', '', '', '강의:L1'],   // 강의 요약 — 제출이 아니다
  ]);
  const sd = 시트(['student_id', '필드', '값', '기록일'], [['S1', '드림한줄', '한국 회사', D('2026-12-01')], ['S1', '드림한줄', '한국 대학원', D('2027-02-10')]]);
  const { E, ss, calls } = 엔진({ sheets: { attendance: at, hw_feedback: hf, self_declare_log: sd }, 증언: { S1: '느낀 것 → 있다' } });
  const r = E.회고_알게된것_(ss, 'S1', 시즌);
  assert.equal(r.줄들[1].글, '8주 동안 출석 1회 · 숙제 제출 1건');
  assert.ok(/처음 쓴 드림 한 줄 「한국 회사」 — 그대로입니다/.test(r.줄들[2].글), '시즌 끝 뒤에 바꾼 드림 한 줄은 이 시즌 회고가 아니다: ' + r.줄들[2].글);
  assert.ok(/스스로 한 말 — 느낀 것 → 있다/.test(r.줄들[2].글));
  assert.deepEqual([calls.증언맵창.시작, calls.증언맵창.끝], [시즌.시작, 시즌.끝], '스스로 한 말은 시즌 창으로 읽는다');
  assert.ok(!/성취맵_|리듬/.test(앞절), '업적에서 만든 성향 문장은 확인 없이 밖으로 안 나간다(철학 Ⅰ-3① · 시즌회고 §10)');
});

/* ───────────────────── ② 편지 ───────────────────── */
test('[회고] 편지 — 무대 Ⓐ 는 「당신」, Ⓑ 는 「우리 아이」 · 세 칸 이름 · 물음 · 링크 · 「없다」도 답이라고 말한다', () => {
  const { E, ss } = 엔진({});
  const 블록 = E.회고_알게된것_(ss, 'S1', 시즌);
  const a = E.회고편지글_('바트', 'Ⓐ', 블록, 'https://synk.im/retro/?t=abc');
  const b = E.회고편지글_('바트', 'Ⓑ', 블록, 'https://synk.im/retro/?t=abc');
  assert.ok(/바트 님, 안녕하세요/.test(a) && /당신에 대해 우리가 안다고 느낀 것/.test(a), a);
  assert.ok(/보호자님/.test(b) && /우리 아이에 대해 우리가 안다고 느낀 것/.test(b), b);
  ['㉠ 실력', '㉡ 사람', '㉢ 삶'].forEach(k => assert.ok(a.indexOf(k) > -1, '칸 이름이 빠졌다: ' + k));
  assert.ok(a.indexOf('https://synk.im/retro/?t=abc') > -1 && /「없다」는 답도 그대로 받습니다/.test(a));
});

/* ───────────────────── ③ 시즌 고르기 ───────────────────── */
test('[회고] 회고대상시즌_ — 9~10주차에만 · 첫 시즌 2주차엔 «가상 지난 시즌»을 안 고른다(코덱스 09-07 P1) · 실제로 돈 지난 시즌만', () => {
  const 없음 = 엔진({ start: D('2026-11-30') });
  assert.equal(없음.E.회고대상시즌_(없음.ss, D('2026-12-07'), 'tz'), null, '1기 2주차 — 지난 시즌은 없었다(12-07 에 신입에게 편지가 나갈 뻔한 자리)');
  assert.equal(없음.E.회고대상시즌_(없음.ss, D('2027-01-05'), 'tz'), null, '6주차');
  const 아홉 = 없음.E.회고대상시즌_(없음.ss, D('2027-01-25'), 'tz');
  assert.equal(아홉 && 아홉.키, '2026-11-30');
  assert.equal(아홉.끝.getTime(), D('2027-01-24').getTime());
  assert.equal(없음.E.회고대상시즌_(없음.ss, D('2027-02-01'), 'tz').키, '2026-11-30', '10주차도 된다');
  assert.equal(없음.E.회고대상시즌_(없음.ss, D('2027-02-08'), 'tz'), null, '11주차부턴 안 보낸다');
  const groups = 시트(['시즌', 'class_name', 'student_id'], [[D('2026-11-30'), '11A', 'S1']]);
  const 다음 = 엔진({ start: D('2027-01-25'), sheets: { groups } });   // 시즌시작일이 다음 시즌으로 넘어갔고, 지난 시즌은 조 편성에 있다
  assert.equal(다음.E.회고대상시즌_(다음.ss, D('2027-01-25'), 'tz').키, '2026-11-30', '실제로 돈 지난 시즌을 본다');
  const 명부 = 시트(['user_id', '이름', '이름_몽골', 'role', 'class_name', '생일', 'email', '입학시즌'], [['S1', '바트', '', 'student', '11A', '', 'a@b.c', '2026-11-30']]);
  const 명부로 = 엔진({ start: D('2027-01-25'), sheets: { profiles: 명부 } });
  assert.equal(명부로.E.회고대상시즌_(명부로.ss, D('2027-01-25'), 'tz').키, '2026-11-30', '입학시즌에 그 키가 있어도 실재다');
  assert.equal(엔진({ start: null }).E.회고대상시즌_(엔진({ start: null }).ss, D('2027-01-25'), 'tz'), null);
});

/* ───────────────────── ④ 수신자 ───────────────────── */
test('[회고] 회고수신자_ — 그 시즌에 있던 학생만(입학시즌 ≤ 시즌키 · 없으면 등록일 ≤ 끝 · 둘 다 모르면 뺀다 · 세어서) · 보호자 이메일 우선 · 시연 행 제외', () => {
  const H = ['user_id', '이름', '이름_몽골', 'role', 'class_name', '생일', 'email', '연락처', 'messenger_link', 'parent_of', 'tuition', '등록일'];
  H.length = 25; H[25] = '보호자이메일'; H[26] = '입학시즌';
  const row = (id, 이름, email, 등록, pEmail, 입학) => { const r = [id, 이름, '', 'student', '11A', '', email, '', '', '', '', 등록]; r.length = 25; r[25] = pEmail; r[26] = 입학; return r; };
  const pf = 시트(H, [
    row('S1', '바트', 'a@x.c', '', '', '2026-11-30'),          // 입학시즌 = 시즌키
    row('S2', '뒤에', 'b@x.c', '', '', '2027-01-25'),          // 시즌 끝 뒤 입학
    row('S3', '등록', 'c@x.c', D('2026-12-01'), '', ''),       // 입학시즌 빈칸 · 등록일로
    row('S4', '모름', 'd@x.c', '', '', ''),                    // 둘 다 모른다
    row('S5', '메일없음', '', '', '', '2026-11-30'),
    row('S6', '보호자', 'e@x.c', '', 'p@x.c', '2026-11-30'),
    row('DEMO-1', '시연', 'z@x.c', '', '', '2026-11-30'),
  ]);
  const { E, ss } = 엔진({ sheets: { profiles: pf } });
  const r = E.회고수신자_(ss, 시즌, 'tz');
  assert.deepEqual(r.목록.map(s => s.sid + ':' + s.무대), ['S1:Ⓐ', 'S3:Ⓐ', 'S6:Ⓑ']);
  assert.equal(r.목록[2].메일, 'p@x.c');
  assert.equal(r.밖, 1); assert.equal(r.모름, 1); assert.equal(r.없음, 1); assert.equal(r.전체, 6);
});

/* ───────────────────── ⑤ 발송 ───────────────────── */
test('[회고] 시즌회고발송_ — 열쇠는 보낸 «뒤»에만 · 실패한 사람은 열쇠가 없어 다음 주에 다시 · 못 보낸 사람이 있으면 시즌 도장을 안 찍는다 · 본문 고정', () => {
  const H = ['user_id', '이름', '이름_몽골', 'role', 'class_name', '생일', 'email']; H.length = 26; H[26] = '입학시즌';
  const row = (id, email) => { const r = [id, id, '', 'student', '11A', '', email]; r.length = 26; r[26] = '2026-11-30'; return r; };
  const pf = 시트(H, [row('S1', 'a@x.c'), row('S2', 'b@x.c')]);
  let 죽음 = (to) => to === 'b@x.c';
  const o = { start: D('2026-11-30'), sheets: { profiles: pf }, mailFail: (to) => 죽음(to) };
  const { E, ss, state, calls } = 엔진(o);
  const 원래Date = Date;
  global.Date = class extends 원래Date { constructor(...a) { super(...(a.length ? a : ['2027-01-25T07:00:00'])); } static now() { return new 원래Date('2027-01-25T07:00:00').getTime(); } };
  try {
    const 말 = E.시즌회고발송_();
    assert.equal(calls.mail.length, 1, '성공 1');
    assert.ok(/보냄 1 · 이미 보냄 0 · 발송 실패 1/.test(말), 말);
    const 열쇠들 = [...state.keys()].filter(k => k.startsWith('회고토큰:'));
    assert.equal(열쇠들.length, 1, '실패한 사람의 열쇠가 남으면 영영 누락된다(코덱스 09-07 P1)');
    assert.equal(state.get(열쇠들[0]), 'S1|2026-11-30|Ⓐ');
    assert.ok(state.has(열쇠들[0].replace('회고토큰:', '회고본문:')), '발송 당시 본문을 고정한다');
    assert.equal(state.has('회고발송시즌'), false, '못 보낸 사람이 있으면 시즌 도장을 안 찍는다');
    죽음 = () => false;
    const 말2 = E.시즌회고발송_();
    assert.ok(/보냄 1 · 이미 보냄 1 · 발송 실패 0/.test(말2), '실패했던 사람만 다시: ' + 말2);
    assert.equal(state.get('회고발송시즌'), '2026-11-30');
    assert.equal(E.시즌회고발송_(), '이미 보냄 2026-11-30');
  } finally { global.Date = 원래Date; }
});

test('[회고] 시즌회고발송_ — 명부가 비면 도장 없이 돌아오고, 이메일 없음·소속 모름이 하나라도 있으면 시즌 도장을 안 찍는다(코덱스 2차 P1·P2) · 실패 로그에 번호 0', () => {
  const H = ['user_id', '이름', '이름_몽골', 'role', 'class_name', '생일', 'email']; H.length = 26; H[26] = '입학시즌';
  const row = (id, email) => { const r = [id, id, '', 'student', '11A', '', email]; r.length = 26; r[26] = '2026-11-30'; return r; };
  const 원래Date = Date;
  global.Date = class extends 원래Date { constructor(...a) { super(...(a.length ? a : ['2027-01-25T07:00:00'])); } static now() { return new 원래Date('2027-01-25T07:00:00').getTime(); } };
  try {
    const 빈 = 엔진({ start: D('2026-11-30'), sheets: { profiles: 시트(H, []) } });
    assert.ok(/명부에 학생이 없다/.test(빈.E.시즌회고발송_()));
    assert.equal(빈.state.has('회고발송시즌'), false, '명부가 빈 채로 도장을 찍으면 복구 뒤 영영 「이미 보냄」이다');
    const 하나없음 = 엔진({ start: D('2026-11-30'), sheets: { profiles: 시트(H, [row('S1', 'a@x.c'), row('S2', '')]) } });
    const 말 = 하나없음.E.시즌회고발송_();
    assert.ok(/보냄 1 .*이메일 없음 1/.test(말), 말);
    assert.equal(하나없음.state.has('회고발송시즌'), false, '이메일 없는 학생이 남아 있으면 도장을 안 찍는다 — 주소를 채우면 다시 돈다');
  } finally { global.Date = 원래Date; }
  const 발송 = section('function 시즌회고발송_() {', 'function 회고API_(');
  const c0 = 발송.indexOf('} catch (e) {');
  const 실패절 = 발송.slice(c0, 발송.indexOf('}', c0 + 13) + 1);   // catch 블록 몸통만
  assert.ok(!/s\.sid|Logger|e\.message/.test(실패절), '실패 처리에 학생 번호·예외 원문이 로그로 나가면 안 된다(코덱스 2차 P0): ' + 실패절);
});

/* ───────────────────── ⑥ 통로 ───────────────────── */
test('[회고] 회고API_ — 열쇠 없으면 0 · show 는 고정 본문 · answer 는 잠금 안에서 한 번만 · 보호자 답은 화자 보호자 · 답은 있다/없다 둘뿐', () => {
  const state = new Map();
  const t = 'a'.repeat(20);
  state.set('회고토큰:' + t, 'S1|2026-11-30|Ⓑ');
  state.set('회고본문:' + t, JSON.stringify([{ 칸: '㉠', 글: '고정된 글' }]));
  const { E, calls } = 엔진({ state });
  assert.equal(결과(E.회고API_({ parameter: { op: 'show', t: 'zzz' } }, 'get')).error, 'no-token');
  const s = 결과(E.회고API_({ parameter: { op: 'show', t } }, 'get'));
  assert.equal(s.ok, true); assert.equal(s.무대, 'Ⓑ'); assert.equal(s.줄들[0].글, '고정된 글'); assert.equal(s.답함, false);
  assert.ok(/우리 아이/.test(s.물음));
  const post = (body) => E.회고API_({ parameter: { p: '회고' }, postData: { contents: JSON.stringify(body) } }, 'post');
  assert.equal(결과(post({ op: 'answer', t, 답: '글쎄' })).error, 'bad-answer');
  const a1 = 결과(post({ op: 'answer', t, 답: '있다', 한줄: '이름을  기억해\r\n줬다 ' }));
  assert.deepEqual(a1, { ok: true, 중복: false });
  assert.equal(calls.증언.length, 1);
  assert.equal(calls.증언[0].화자, '보호자', '보호자 무대의 답은 「스스로 한 말」이 아니다');
  assert.equal(calls.증언[0].잠금없이, true, '바깥 잠금 안에서 부른다(같은 잠금을 두 번 안 잡는다)');
  assert.equal(calls.증언[0].답, '있다 — 이름을  기억해\n줬다', '한 줄은 공백·줄바꿈 그대로(원문 보존 · 코덱스 2차 P1)');
  assert.equal(calls.locks, 1);
  const a2 = 결과(post({ op: 'answer', t, 답: '없다' }));
  assert.deepEqual(a2, { ok: true, 중복: true }, '두 번째 답은 저장하지 않는다');
  assert.equal(calls.증언.length, 1);
  assert.equal(결과(E.회고API_({ parameter: { op: 'show', t } }, 'get')).답함, true);
  const 막힘 = 엔진({ state: new Map([['회고토큰:' + t, 'S1|2026-11-30|Ⓐ']]), lockRefuse: true });
  assert.equal(결과(막힘.E.회고API_({ postData: { contents: JSON.stringify({ op: 'answer', t, 답: '있다' }) } }, 'post')).error, 'busy');
});

/* ───────────────────── ⑦ 배선 ───────────────────── */
test('[회고] 배선 — 월요일 weeklyJobs 가 부르고, ?p=회고 가 GET·POST 둘 다 회고API_ 로 가며, 통로는 ContentService 뿐이다', () => {
  const weekly = section('function weeklyJobs() {', 'function monthlyJobs() {');
  assert.ok(/safeRun\('seasonRetro', 시즌회고발송_\);/.test(weekly), 'weeklyJobs 에 회고 발송이 없다');
  const 상담 = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '상담AI.js'), 'utf8').replace(/\r\n/g, '\n');
  const cut = (s, a, b) => { const i = s.indexOf(a); assert.notEqual(i, -1, '표식 없음: ' + a); const j = s.indexOf(b, i); assert.notEqual(j, -1, '끝 없음: ' + b); return s.slice(i, j); };
  assert.ok(/p === '회고'\) return 회고API_\(e, 'post'\)/.test(cut(상담, 'function doPost(e) {', 'function doGet(e) {')));
  assert.ok(/p\.p === '회고'\) return 회고API_\(e, 'get'\)/.test(cut(상담, 'function doGet(e) {', "return ContentService.createTextOutput('SYNK');")));
  assert.ok(!/HtmlService/.test(API절), '회고API_ 가 HtmlService 를 돌려주면 171개 함수 브릿지가 열린다(상담AI.js ⛔)');
  const 발송 = section('function 시즌회고발송_() {', 'function 회고API_(');
  assert.ok(발송.indexOf('MailApp.sendEmail(') < 발송.indexOf("setState(st, '회고토큰:'"), '열쇠는 보낸 뒤에 남긴다');
});
