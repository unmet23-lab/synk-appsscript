'use strict';
/**
 * 퀴즈 응답 스위프 — 둘째 답을 버리지 않는다 · 문항 지문과 스냅샷 지연을 남긴다 (2026-09-06 · 철학 심문 1·3·4회차 A2·A3)
 *
 * ■ 무엇을 지키나
 *   ① 같은 문항에 다시 낸 답은 **시도 번호를 달고 남는다**(철학 Ⅲ-2 v1.21 「아는가의 판정은 다시 낸 문항의 결과가 한다」).
 *      옛 코드는 둘째 답을 조용히 버렸다 — 첫 진짜 학생 «전»에 고쳐야 하는 소급 불가 자리.
 *   ② 행마다 스위프가 붙인 «문항 지문»(문제|정답 해시)과 «응답→스냅샷 지연초»가 남는다 — 폼은 학생이 본 문항 판을
 *      안 실어 보내므로, 뒤에 문항이 개정됐을 때 이 둘로 「어느 판을 봤나」를 되짚는다.
 *   ③ 약점 재료(`퀴즈오답맵_`)는 시도 1 만 읽는다 — 「무엇을 골랐나」가 고쳐 낸 답에 오염되지 않는다.
 *
 * ■ 재는 법 — `quizSweep_` 정본을 그대로 태운다. 시트 흉내 + 속성·유틸 스텁(헤더보정_ 은 흉내가 열을 못 늘려 스텁).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');

const code = engineSource();
function section(시작, 끝) {
  const s = code.indexOf(시작);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${시작}`);
  const e = code.indexOf(끝, s + 시작.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${끝}`);
  return code.slice(s, e);
}
function 불러오기(시작, 끝, 이름, 의존) {
  const src = section(시작, 끝);
  const n = Object.keys(의존);
  return new Function(...n, `${src}\nreturn ${이름};`)(...n.map((k) => 의존[k]));
}
/** 함수 하나를 «닫는 괄호까지» 잘라 온다. */
function 함수(이름, 의존 = {}) {
  const s = code.indexOf(`function ${이름}(`);
  assert.notEqual(s, -1, `함수를 찾지 못함: ${이름}`);
  const e = code.indexOf('\n}\n', s);
  assert.notEqual(e, -1, `함수의 끝을 찾지 못함: ${이름}`);
  const src = code.slice(s, e + 2);
  const n = Object.keys(의존);
  return new Function(...n, `${src}\nreturn ${이름};`)(...n.map((k) => 의존[k]));
}

const QUIZ_LOG_HEADERS = JSON.parse(code.match(/const QUIZ_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const QUIZ_CONFIDENCE = JSON.parse(code.match(/const QUIZ_CONFIDENCE = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const 열 = (이름) => QUIZ_LOG_HEADERS.indexOf(이름);

test('정본 헤더에 시도·문항지문·스냅샷지연초 세 칸이 «끝에» 붙었다 — 앞 칸 위치는 그대로다', () => {
  assert.deepEqual(QUIZ_LOG_HEADERS.slice(-3), ['시도', '문항지문', '스냅샷지연초']);
  assert.equal(열('정답여부'), 7); assert.equal(열('확신도'), 8); assert.equal(열('제출일'), 9);
});

/* ── 스위프를 실제로 태운다 ── */
const quizNorm_ = 함수('quizNorm_');
const quizAnswerKeys_ = 함수('quizAnswerKeys_', { quizNorm_ });
const quizGrade_ = 함수('quizGrade_', { quizAnswerKeys_, quizNorm_ });
const 문항지문_ = 함수('문항지문_', {
  Utilities: {
    DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (_a, s) => require('node:crypto').createHash('md5').update(String(s), 'utf8').digest(),
  },
});

function 스위프돌리기({ 응답행들, 기존로그 = [] }) {
  const 로그 = 시트흉내({ 첫행: 1, 행들: [QUIZ_LOG_HEADERS.slice(), ...기존로그] });
  const 표 = {
    '퀴즈폼_응답': 시트흉내({ 첫행: 2, 행들: 응답행들 }),
    profiles: 시트흉내({ 첫행: 2, 행들: [(() => { const r = new Array(67).fill(''); r[0] = 'S1'; r[3] = 'student'; r[66] = 2; return r; })()] }),
    contents: 시트흉내({ 첫행: 2, 행들: [['Q1', 'quiz', '조사', '학교__ 가요|에']] }),
    ai_daily: null, quiz_log: 로그, point_logs: null,
  };
  const ss = { getSheetByName: (n) => 표[n] || null, getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' };
  const props = {}; const 알림 = [];
  const 의존 = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k], setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: { formatDate: (d) => '20260906' },
    ensureSheet: (s, n) => s.getSheetByName(n),
    헤더보정_: () => {},
    셀안전_: (v) => v,
    quizGrade_, 문항지문_,
    dstr: () => '2026-09-06',
    notifyDroppedSids_: (_w, ids) => 알림.push(...ids),
    퀴즈응답포인트_: () => {},
    Logger: { log: () => {} },
    SCHEMA_VER: 'c16', QUIZ_LOG_HEADERS,
  };
  const quizSweep_ = 불러오기('function quizSweep_(ss)', '\n/* [v9.147] 🎯 퀴즈 응답 포인트', 'quizSweep_', 의존);
  quizSweep_(ss);
  const n = 로그.getLastRow();
  return { 행들: n >= 2 ? 로그.getRange(2, 1, n - 1, QUIZ_LOG_HEADERS.length).getValues() : [], 알림 };
}
const 응답 = (분전, qid, 답, 확신 = QUIZ_CONFIDENCE[0]) => [new Date(Date.now() - 분전 * 60000), 'S1', qid, 답, 확신];

test('🔴 같은 문항의 둘째 답이 시도 2 로 남는다 — 버리지 않는다', () => {
  const { 행들 } = 스위프돌리기({ 응답행들: [응답(30, 'Q1', '을'), 응답(10, 'Q1', '에')] });
  assert.equal(행들.length, 2, '둘째 답이 버려졌다');
  assert.equal(행들[0][열('시도')], 1); assert.equal(행들[0][열('정답여부')], '오답');
  assert.equal(행들[1][열('시도')], 2); assert.equal(행들[1][열('정답여부')], '정답');
  assert.notEqual(행들[0][0], 행들[1][0], '두 행의 id 가 같다 — 둘째 행이 첫 행을 덮는 꼴이 된다');
  assert.match(String(행들[1][0]), /-2$/);
});

test('🔴 같은 응답을 다시 읽어도(적재 뒤 포인터 저장 실패 → 재스위프) 새 시도로 안 센다 — 재제출과 재처리를 가른다', () => {
  const 원본 = 응답(30, 'Q1', '을');
  const 첫 = 스위프돌리기({ 응답행들: [원본] });
  assert.equal(첫.행들.length, 1);
  /* 포인터가 저장 안 된 채 같은 원본 행을 다시 읽는다 — 구 코드는 seen 이 걸렀고, 시도 번호를 단 첫 판은 시도 2 로 또 쌓았다(코덱스 09-06 P1) */
  const 재처리 = 스위프돌리기({ 응답행들: [원본], 기존로그: 첫.행들 });
  assert.equal(재처리.행들.length, 1, '같은 응답이 시도 2 로 또 쌓였다');
  /* 진짜 재제출(다른 답)은 그대로 시도 2 */
  const 재제출 = 스위프돌리기({ 응답행들: [원본, 응답(10, 'Q1', '에')], 기존로그: 첫.행들 });
  assert.equal(재제출.행들.length, 2);
  assert.equal(재제출.행들[1][열('시도')], 2);
  assert.equal(재제출.행들[1][열('고른답')], '에');
});

test('이미 로그에 시도 1 이 있으면 새 답은 시도 2 다(옛 행에 시도 칸이 비어도 1 로 센다)', () => {
  const 옛 = new Array(QUIZ_LOG_HEADERS.length).fill(''); 옛[0] = 'QL-옛'; 옛[1] = 'S1'; 옛[2] = 'Q1'; 옛[7] = '오답';
  const { 행들 } = 스위프돌리기({ 응답행들: [응답(5, 'Q1', '에')], 기존로그: [옛] });
  assert.equal(행들.length, 2);
  assert.equal(행들[1][열('시도')], 2);
});

test('문항 지문과 스냅샷 지연초가 행에 남는다 — 지문은 문제|정답에서, 지연은 응답 시각에서', () => {
  const { 행들 } = 스위프돌리기({ 응답행들: [응답(20, 'Q1', '에')] });
  assert.equal(행들.length, 1);
  assert.equal(행들[0][열('문항지문')], 문항지문_('학교__ 가요', '에'));
  assert.equal(String(행들[0][열('문항지문')]).length, 12);
  const 지연 = Number(행들[0][열('스냅샷지연초')]);
  assert.ok(지연 >= 19 * 60 && 지연 <= 21 * 60, `지연초가 이상하다: ${지연}`);
  assert.equal(문항지문_('', ''), '', '빈 문항의 지문은 빈 문자열이다 — 「없음」과 「빈 문항의 지문」을 안 섞는다');
});

test('약점 재료(퀴즈오답맵_)는 시도 1 만 읽는다 — 고쳐 낸 답이 «무엇을 골랐나»를 오염시키지 않는다', () => {
  const toDate_ = (v) => (v instanceof Date ? v : null);
  const 퀴즈라벨_ = (유형, 문제) => String(유형 || '') || null;
  const 퀴즈오답맵_ = 함수('퀴즈오답맵_', { QUIZ_LOG_HEADERS, QUIZ_CONFIDENCE, toDate_, 퀴즈라벨_ });
  const 행 = (시도, 판정) => { const r = new Array(QUIZ_LOG_HEADERS.length).fill(''); r[1] = 'S1'; r[2] = 'Q1'; r[3] = '조사'; r[7] = 판정; r[8] = QUIZ_CONFIDENCE[0]; r[9] = new Date(); r[열('시도')] = 시도; return r; };
  const 로그 = 시트흉내({ 첫행: 1, 행들: [QUIZ_LOG_HEADERS.slice(), 행(1, '오답'), 행(2, '정답')] });
  const ss = { getSheetByName: (n) => (n === 'quiz_log' ? 로그 : null) };
  const { 맵 } = 퀴즈오답맵_(ss, null);
  assert.match(String(맵.S1 || ''), /틀림 조사/, '시도 1 의 오답이 약점 재료에 안 실렸다');
  assert.doesNotMatch(String(맵.S1 || ''), /×2|찍어서/, '시도 2 의 답이 셈에 섞였다');
  /* 대조군 — 시도 칸이 빈 옛 행 둘은 여전히 둘 다 센다(옛 행 = 시도 1) */
  const 옛 = (판정) => { const r = 행(1, 판정); r[열('시도')] = ''; return r; };
  const 로그2 = 시트흉내({ 첫행: 1, 행들: [QUIZ_LOG_HEADERS.slice(), 옛('오답'), 옛('오답')] });
  const { 맵: 맵2 } = 퀴즈오답맵_({ getSheetByName: (n) => (n === 'quiz_log' ? 로그2 : null) }, null);
  assert.match(String(맵2.S1 || ''), /틀림 조사 ×2/, '옛 행이 시도 1 로 안 읽혔다');
});
