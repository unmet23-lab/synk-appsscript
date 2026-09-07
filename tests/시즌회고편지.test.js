'use strict';
/**
 * 📜 시즌 회고 편지 — 「우리가 당신에 대해 알게 된 것」이 이해 대장 칸 이름으로 되짚어지고, 읽은 사람의 물음 하나가 증언 그릇에 닿는가
 * (09-07 · 브랜드 v2 ㉡-1 · 트랙 §0-명품 5번)
 *
 * ■ 이 시험이 재는 것
 *   ① 블록(회고_알게된것_) — 층 셋(㉠ 실력 · ㉡ 사람 · ㉢ 삶)이 «늘» 줄로 서고, 재료가 있으면 이름으로, 없으면 「아직 적을 것이 없습니다」로(지어내지 않는다).
 *      시즌 창 밖의 기록은 안 센다 · 이름은 안 싣는다.
 *   ② 편지(회고편지글_) — 무대 Ⓐ(본인)/Ⓑ(보호자)의 낱말이 다르고, 물음과 링크가 있고, 「없다」도 답이라고 말한다.
 *   ③ 시즌 고르기(회고대상시즌_) — 8주가 끝난 다음 주(9~10주차)에만 · 시즌시작일이 다음 시즌으로 넘어갔으면 지난 시즌을 본다 · 시즌 중엔 null.
 *   ④ 배선 — 월요일 weeklyJobs 가 부른다 · 상담AI.js 가 ?p=회고 를 GET·POST 둘 다 잇는다 · 통로는 ContentService 뿐(HtmlService 0) ·
 *      답은 있다/없다 둘뿐이고 증언남기기_(출처 '회고물음')로 간다 · 한 번 답하면 다시 못 쓴다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { engineSource } = require('./_engine-source');
const code = engineSource();

function section(시작, 끝) {
  const s = code.indexOf(시작);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${시작}`);
  const e = code.indexOf(끝, s + 시작.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${끝}`);
  return code.slice(s, e);
}

const 절 = section("const RETRO_SOURCE_ = '회고물음';", 'function 시즌회고발송_(');
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

function 엔진(sheets, 성취, 증언) {
  const ss = { getSheetByName: (n) => sheets[n] || null, getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' };
  const toDate_ = (v) => (v instanceof Date ? v : (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : null));
  const 진단문형이름_ = (g) => ({ G502: '-(으)ㄹ 것 같다', G708: '-더라도' }[g] || '');
  const 성취맵_ = () => ({ 맵: 성취 || {} });
  const 증언맵_ = () => ({ 맵: 증언 || {}, 건수: 0, 학생수: 0 });
  const seasonStartOf_ = () => (sheets.__start === undefined ? null : sheets.__start);
  const Utilities = { formatDate: (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) };
  const E = new Function('toDate_', '진단문형이름_', '성취맵_', '증언맵_', 'seasonStartOf_', 'Utilities', 'SEASON_WEEKS',
    `${주차절}\n${절}\nreturn { 회고_알게된것_, 회고편지글_, 회고물음_, 회고대상시즌_, 회고날짜_, 회고칸이름_ };`)(toDate_, 진단문형이름_, 성취맵_, 증언맵_, seasonStartOf_, Utilities, 8);
  return { E, ss };
}
const D = (s) => new Date(s + 'T00:00:00');
const 시즌 = { 키: '2026-11-30', 시작: D('2026-11-30'), 끝: D('2027-01-24') };

/* ───────────────────── ① 블록 ───────────────────── */
test('[회고] 재료가 없으면 세 층이 전부 「아직 적을 것이 없습니다」로 선다 — 층은 늘 셋이고 지어내지 않는다(재료수 0)', () => {
  const { E, ss } = 엔진({});
  const r = E.회고_알게된것_(ss, 'S1', 시즌);
  assert.equal(r.재료수, 0);
  assert.deepEqual(r.줄들.map(l => l.칸), ['㉠', '㉡', '㉢']);
  r.줄들.forEach(l => assert.ok(/아직 적을 것이 없습니다/.test(l.글), l.글));
});

test('[회고] ㉠ 실력 — 시작 진단(시작점 ✓)의 다음 자리와 시즌 안 「도달」 문법이 이름으로 적히고, 시즌 밖·연습·남의 행은 안 센다', () => {
  const 진단 = 시트(['세션번호', '학생번호', '시작점', '표본급수', '다음문형'], [
    ['d1', 'S1', '✓', 3, '["G502","G708"]'],
    ['d2', 'S1', '', 4, '["G999"]'],
    ['d3', 'S2', '✓', 3, '["G708"]'],
  ]);
  const ml = 시트(['student_id', 'grammar_id', '상태', '첫기록일', '도달일'], [
    ['S1', 'G502', '도달', D('2026-12-01'), D('2026-12-20')],
    ['S1', 'G777', '도달', D('2026-12-01'), D('2027-02-10')],   // 시즌 밖
    ['S1', 'G708', '연습', D('2026-12-05'), ''],                  // 연습은 도달이 아니다
    ['S2', 'G708', '도달', D('2026-12-05'), D('2026-12-06')],     // 남의 행
  ]);
  const { E, ss } = 엔진({ 진단세션: 진단, mastery_log: ml });
  const r = E.회고_알게된것_(ss, 'S1', 시즌);
  const 실력줄 = r.줄들[0].글;
  assert.ok(/시작 진단 3급/.test(실력줄), 실력줄);
  assert.ok(/-\(으\)ㄹ 것 같다·-더라도/.test(실력줄), '그때 다음 자리가 이름으로: ' + 실력줄);
  assert.ok(/도달로 적힌 문법 1개\(-\(으\)ㄹ 것 같다\)/.test(실력줄), 실력줄);
  assert.ok(/다음 자리 중 1개에 닿았습니다/.test(실력줄), 실력줄);
  assert.ok(실력줄.indexOf('G777') === -1 && 실력줄.indexOf('G999') === -1, '시즌 밖·시작점 아닌 행이 섞였다: ' + 실력줄);
  assert.equal(r.재료수, 1);
});

test('[회고] ㉡ 사람 — 시즌 안 출석·숙제 제출 수와 리듬(achievements 히든)이 한 줄로 · ㉢ 삶 — 처음의 드림 한 줄 → 지금, 스스로 한 말', () => {
  const at = 시트(['id', 'student_id', 'timestamp'], [['a', 'S1', D('2026-12-03')], ['b', 'S1', D('2027-03-01')], ['c', 'S2', D('2026-12-03')]]);
  const hf = 시트(['id', 'student_id', '제출일'], [['h', 'S1', D('2026-12-10')]]);
  const sd = 시트(['student_id', '필드', '값'], [['S1', '드림한줄', '한국 회사'], ['S1', '최애', 'BTS'], ['S1', '드림한줄', '한국 대학원']]);
  const { E, ss } = 엔진({ attendance: at, hw_feedback: hf, self_declare_log: sd }, { S1: '리듬: 아침형' }, { S1: '느낀 것 → 있다 — 이름을 기억해 줬다' });
  const r = E.회고_알게된것_(ss, 'S1', 시즌);
  assert.ok(/출석 1회 · 숙제 제출 1건 · 언제·어떻게 움직였나 — 리듬: 아침형/.test(r.줄들[1].글), r.줄들[1].글);
  assert.ok(/처음 쓴 드림 한 줄 「한국 회사」 → 지금 「한국 대학원」/.test(r.줄들[2].글), r.줄들[2].글);
  assert.ok(/스스로 한 말 — 느낀 것 → 있다/.test(r.줄들[2].글), r.줄들[2].글);
  assert.equal(r.재료수, 2);
  assert.ok(!/S1/.test(JSON.stringify(r)), '블록에 학생 번호가 실렸다');
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
  assert.ok(a.indexOf('https://synk.im/retro/?t=abc') > -1);
  assert.ok(/「없다」는 답도 그대로 받습니다/.test(a));
  assert.equal(E.회고물음_('Ⓑ'), '이 글에서 우리 아이에 대해 우리가 안다고 느낀 것이 있었나요?');
});

/* ───────────────────── ③ 시즌 고르기 ───────────────────── */
test('[회고] 회고대상시즌_ — 8주가 끝난 다음 주(9주차)와 그다음 주에만 · 시즌 중엔 null · 시즌시작일이 넘어갔으면 지난 시즌(−8주)', () => {
  const { E, ss } = 엔진({ __start: D('2026-11-30') });
  assert.equal(E.회고대상시즌_(ss, D('2027-01-05'), 'tz'), null, '6주차');
  const 아홉 = E.회고대상시즌_(ss, D('2027-01-25'), 'tz');
  assert.equal(아홉 && 아홉.키, '2026-11-30');
  assert.equal(아홉.끝.getTime(), D('2027-01-24').getTime(), '끝 = 시작 + 55일');
  assert.equal(E.회고대상시즌_(ss, D('2027-02-01'), 'tz').키, '2026-11-30', '10주차도 된다(쿼터 보류 재실행 여유)');
  assert.equal(E.회고대상시즌_(ss, D('2027-02-08'), 'tz'), null, '11주차부턴 안 보낸다');
  const 다음 = 엔진({ __start: D('2027-01-25') });   // 유호님이 시즌시작일을 다음 시즌으로 이미 옮겼다
  assert.equal(다음.E.회고대상시즌_(다음.ss, D('2027-01-25'), 'tz').키, '2026-11-30', '지난 시즌을 본다');
  const 없음 = 엔진({ __start: null });
  assert.equal(없음.E.회고대상시즌_(없음.ss, D('2027-01-25'), 'tz'), null);
});

/* ───────────────────── ④ 배선 ───────────────────── */
test('[회고] 배선 — 월요일 weeklyJobs 가 부르고, ?p=회고 가 GET·POST 둘 다 회고API_ 로 가며, 통로는 ContentService 뿐이다', () => {
  const weekly = section('function weeklyJobs() {', 'function monthlyJobs() {');
  assert.ok(/safeRun\('seasonRetro', 시즌회고발송_\);/.test(weekly), 'weeklyJobs 에 회고 발송이 없다');
  /* 상담AI.js 는 엔진 소스 목록(tests/_engine-source.js) 밖이라 따로 읽는다 — 줄끝을 접어 표식이 갈리지 않게. */
  const 상담 = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '상담AI.js'), 'utf8').replace(/\r\n/g, '\n');
  const cut = (s, a, b) => { const i = s.indexOf(a); assert.notEqual(i, -1, '표식 없음: ' + a); const j = s.indexOf(b, i); assert.notEqual(j, -1, '끝 없음: ' + b); return s.slice(i, j); };
  const doPost = cut(상담, 'function doPost(e) {', 'function doGet(e) {');
  const doGet = cut(상담, 'function doGet(e) {', "return ContentService.createTextOutput('SYNK');");
  assert.ok(/p === '회고'\) return 회고API_\(e, 'post'\)/.test(doPost));
  assert.ok(/p\.p === '회고'\) return 회고API_\(e, 'get'\)/.test(doGet));
  const api = section('function 회고API_(e, method) {', '\n}\n');
  assert.ok(!/HtmlService/.test(api), '회고API_ 가 HtmlService 를 돌려주면 171개 함수 브릿지가 열린다(상담AI.js ⛔)');
  assert.ok((api.match(/ContentService\.createTextOutput/g) || []).length >= 2);
});

test('[회고] 답 — 있다/없다 둘뿐 · 증언남기기_(출처 회고물음)로 가고 · 한 번 답하면 중복으로 막는다 · 열쇠 없으면 아무것도 안 보여 준다', () => {
  const api = section('function 회고API_(e, method) {', '\n}\n');
  assert.ok(/if \(답 !== '있다' && 답 !== '없다'\) out = \{ ok: false, error: 'bad-answer' \}/.test(api));
  assert.ok(/증언남기기_\(ss, \{ student_id: sid, 출처: RETRO_SOURCE_, 물음: 회고물음_\(무대\)/.test(api), '답이 증언 그릇으로 안 간다');
  assert.ok(/else if \(답함\) out = \{ ok: true, 중복: true \}/.test(api));
  assert.ok(/if \(!표\) out = \{ ok: false, error: 'no-token' \}/.test(api));
  assert.ok(/'회고답:' \+ t/.test(api), '답한 사실을 열쇠에 남겨야 두 번째 답을 막는다');
  const 발송 = section('function 시즌회고발송_() {', 'function 회고API_(');
  assert.ok(/getState\(st, '회고토큰:' \+ 토큰\)\.row > 0/.test(발송), '보낸 사람은 열쇠로 가려 다시 안 보낸다');
  assert.ok(/if \(!보류\) setState\(st, '회고발송시즌', 시즌\.키\)/.test(발송), '쿼터 보류가 있으면 시즌 도장을 안 찍어 다음 월요일에 다시 돈다');
});
