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

test('정본 헤더에 시도·문항지문·스냅샷지연초·응답시각ms 네 칸이 «끝에» 붙었다 — 앞 칸 위치는 그대로다', () => {
  assert.deepEqual(QUIZ_LOG_HEADERS.slice(-4), ['시도', '문항지문', '스냅샷지연초', '응답시각ms']);
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

/* 날짜는 «시트가 사는 시간대»(시트흉내는 'yyyy-MM-dd' 문자열을 지역 자정 Date 로 되읽는다)로 잰다 — UTC 로 재면 밤 9시 뒤 하루가 어긋난다 */
const 지역날짜 = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const 날짜 = (v) => (v instanceof Date ? 지역날짜(v) : String(v || '').slice(0, 10));

function 스위프돌리기({ 응답행들, 기존로그 = [] }) {
  const 로그 = 시트흉내({ 첫행: 1, 행들: [QUIZ_LOG_HEADERS.slice(), ...기존로그] });
  const 표 = {
    '퀴즈폼_응답': 시트흉내({ 첫행: 2, 행들: 응답행들 }),
    profiles: 시트흉내({ 첫행: 2, 행들: [(() => { const r = new Array(67).fill(''); r[0] = 'S1'; r[3] = 'student'; r[66] = 2; return r; })()] }),
    contents: 시트흉내({ 첫행: 2, 행들: [['Q1', 'quiz', '조사', '학교__ 가요|에']] }),
    ai_daily: null, quiz_log: 로그, point_logs: null,
  };
  const ss = { getSheetByName: (n) => 표[n] || null, getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' };
  const props = {}; const 알림 = []; const 지급 = [];
  const 의존 = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k], setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: { formatDate: (d) => '20260906' },
    ensureSheet: (s, n) => s.getSheetByName(n),
    헤더보정_: () => {},
    셀안전_: (v) => v,
    quizGrade_, 문항지문_,
    /* 진짜 날짜를 낸다 — 재처리 판정이 «오늘 응답인가»를 보므로 상수면 자정 경계를 못 잰다. 실물 dstr 처럼 Date 는 시간대로 접고 문자열은 앞 10자 */
    dstr: (v) => 날짜(v),
    notifyDroppedSids_: (_w, ids) => 알림.push(...ids),
    퀴즈응답포인트_: (_s, loaded) => 지급.push(...loaded.map((r) => String(r[1]) + '@' + 날짜(r[열('제출일')]))), // 학생@응답일 — 날짜 판정은 실물 함수가 한다(아래 별도 시험)
    Logger: { log: () => {} },
    SCHEMA_VER: 'c16', QUIZ_LOG_HEADERS,
  };
  const quizSweep_ = 불러오기('function quizSweep_(ss)', '\n/* [v9.147] 🎯 퀴즈 응답 포인트', 'quizSweep_', 의존);
  quizSweep_(ss);
  const n = 로그.getLastRow();
  return { 행들: n >= 2 ? 로그.getRange(2, 1, n - 1, QUIZ_LOG_HEADERS.length).getValues() : [], 알림, 지급, 포인터: props['퀴즈폼_포인터'] };
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

test('🔴 같은 응답을 다시 읽어도(적재 뒤 포인터 저장 실패 → 재스위프) 새 시도로 안 센다 — 정체는 폼이 찍은 시각이다', () => {
  const 원본 = 응답(0.001, 'Q1', '을'); // 방금(오늘) — 재처리 보상은 오늘 응답만 다시 태우므로 «오늘»이어야 한다
  const 첫 = 스위프돌리기({ 응답행들: [원본] });
  assert.equal(첫.행들.length, 1);
  assert.equal(Number(첫.행들[0][열('응답시각ms')]), 원본[0].getTime(), '응답 시각(ms)이 행에 안 남았다');
  const 오늘 = 날짜(원본[0]);
  assert.deepEqual(첫.지급, ['S1@' + 오늘]);
  /* 포인터가 저장 안 된 채 같은 원본 행을 다시 읽는다 — 구 코드는 seen 이 걸렀고, 시도 번호를 단 첫 판은 시도 2 로 또 쌓았다(코덱스 09-06 2차 P1) */
  const 재처리 = 스위프돌리기({ 응답행들: [원본], 기존로그: 첫.행들 });
  assert.equal(재처리.행들.length, 1, '같은 응답이 시도 2 로 또 쌓였다');
  assert.deepEqual(재처리.지급, ['S1@' + 오늘], '재처리에서 하루 보상이 다시 안 태워졌다 — 앞 실행이 적재 뒤·지급 전에 죽었으면 보상이 영영 빈다(3차 P1) · 응답일이 같이 가야 지급 함수가 가른다');
  assert.equal(재처리.포인터, '2', '재처리 뒤 포인터가 안 저장됐다');
  /* 진짜 재제출 — 같은 답을 다시 내도, 확신도만 바꿔도 시각이 다르니 «다른 응답»으로 남는다(원신호 보존 · 3차 P1 4a682b0d875b) */
  const 재제출 = 스위프돌리기({ 응답행들: [원본, 응답(10, 'Q1', '을', QUIZ_CONFIDENCE[QUIZ_CONFIDENCE.length - 1]), 응답(5, 'Q1', '에')], 기존로그: 첫.행들 });
  assert.equal(재제출.행들.length, 3, '같은 답·다른 시각의 재제출이 버려졌다');
  assert.equal(재제출.행들[1][열('시도')], 2); assert.equal(재제출.행들[1][열('고른답')], '을');
  assert.equal(재제출.행들[2][열('시도')], 3); assert.equal(재제출.행들[2][열('고른답')], '에');
  assert.deepEqual(재제출.지급, ['S1@' + 오늘, 'S1@' + 오늘, 'S1@' + 오늘], '지급 재료는 적재 행 + 재처리 행 전부다(하루 1회 상한은 지급 함수가 쥔다)');
});

test('어제 응답의 재처리도 «응답일»을 달고 지급 함수로 간다 — 날짜로 거르는 자는 스위프가 아니라 지급 함수다(5차 P1)', () => {
  const 어제 = 응답(24 * 60 + 10, 'Q1', '을');
  const 첫 = 스위프돌리기({ 응답행들: [어제] });
  assert.equal(첫.행들.length, 1);
  assert.equal(날짜(첫.행들[0][열('제출일')]), 날짜(어제[0])); // 시트흉내가 날짜 문자열을 Date 로 되읽으니 같은 자로 접어 비교한다
  assert.notEqual(날짜(어제[0]), 날짜(new Date()), '시험 재료가 어제가 아니다');
  assert.deepEqual(첫.지급, ['S1@' + 날짜(어제[0])], '첫 적재는 응답일(어제)을 달고 지급 재료가 된다(늦은 스위프)');
  const 재처리 = 스위프돌리기({ 응답행들: [어제], 기존로그: 첫.행들 });
  assert.equal(재처리.행들.length, 1, '어제 응답이 다시 쌓였다');
  assert.deepEqual(재처리.지급, ['S1@' + 날짜(어제[0])], '재처리 행에 응답일이 안 실렸다 — 지급 함수가 어제 지급을 못 가른다');
  assert.equal(재처리.포인터, '2');
});

test('같은 응답이라도 «시각»이 다르면 다른 응답이다 — 응답시각 칸이 없던 옛 행은 재처리 판정에 안 낀다(5차 P1 5abb05b259f5)', () => {
  const 지금 = 응답(0.001, 'Q1', '을');
  const 구형 = new Array(QUIZ_LOG_HEADERS.length).fill('');
  구형[0] = 'QL-구형'; 구형[1] = 'S1'; 구형[2] = 'Q1'; 구형[열('고른답')] = '을'; 구형[열('제출일')] = 날짜(지금[0]); // 시도·응답시각ms 비어 있음
  const 결과 = 스위프돌리기({ 응답행들: [지금], 기존로그: [구형] });
  assert.equal(결과.행들.length, 2, '같은 날 같은 답이라도 옛 행(시각 없음)과는 다른 응답이다 — 날짜·답으로 가르면 진짜 재제출을 영구히 버린다');
  assert.equal(결과.행들[1][열('시도')], 2, '옛 행이 시도 1 이므로 새 응답은 시도 2');
});

/* ── 지급 함수를 실물로 태운다 — 「하루 1회」의 하루는 «응답의 날»이다 ── */
function 지급돌리기({ 행들, 지급이력 = [] }) {
  const 나간것 = [];
  const 의존 = {
    Utilities: { formatDate: (d) => 지역날짜(d) },
    asDate_: (v) => (v instanceof Date ? v : new Date(v)),
    dstr: (v) => 날짜(v),
    PT: { 퀴즈응답: 1 },
    appendPoints: (_s, rows) => 나간것.push(...rows.map((r) => r[0])),
    QUIZ_LOG_HEADERS,
  };
  const 퀴즈응답포인트_ = 함수('퀴즈응답포인트_', 의존);
  const pl = 시트흉내({ 첫행: 1, 행들: [['id', 'student_id', 'pts', 'reason', 'by', 'created_at'], ...지급이력] });
  퀴즈응답포인트_({ getSheetByName: (n) => (n === 'point_logs' ? pl : null) }, 행들, 'Asia/Ulaanbaatar');
  return 나간것;
}
const 지급행 = (sid, 언제) => ['P', sid, 1, '퀴즈응답', '시스템', 언제];
const 응답행 = (sid, 응답일) => { const r = new Array(QUIZ_LOG_HEADERS.length).fill(''); r[1] = sid; r[2] = 'Q1'; r[열('제출일')] = 응답일; return r; };

test('🔴 지급은 «응답의 날» 이후 지급이 있으면 건너뛴다 — 자정 경계·늦은 적재·재처리가 같은 답을 낸다(5차 P1 둘)', () => {
  const 지금 = new Date(), 어제 = new Date(Date.now() - 86400000), 그제 = new Date(Date.now() - 2 * 86400000);
  /* ① 어제 응답이 어제 지급됐고 자정 뒤 재처리로 다시 왔다 → 안 준다 */
  assert.deepEqual(지급돌리기({ 행들: [응답행('S1', 날짜(어제))], 지급이력: [지급행('S1', 어제)] }), []);
  /* ② 어제 응답을 오늘 처음 적재하다 지급이 죽고 다시 읽었다(어제 이후 지급 0) → 준다 */
  assert.deepEqual(지급돌리기({ 행들: [응답행('S1', 날짜(어제))], 지급이력: [지급행('S1', 그제)] }), ['S1']);
  /* ③ 오늘 이미 받은 학생의 오늘 다른 문항 → 안 준다(옛 규칙) · 다른 학생은 준다 */
  assert.deepEqual(지급돌리기({ 행들: [응답행('S1', 날짜(지금)), 응답행('S2', 날짜(지금))], 지급이력: [지급행('S1', 지금)] }), ['S2']);
  /* ④ 한 호출 안 같은 학생 셋 → 1회 */
  assert.deepEqual(지급돌리기({ 행들: [응답행('S3', 날짜(지금)), 응답행('S3', 날짜(지금)), 응답행('S3', 날짜(어제))] }), ['S3']);
  /* ⑤ 제출일이 빈 행은 실행일로 본다 */
  assert.deepEqual(지급돌리기({ 행들: [응답행('S4', '')], 지급이력: [지급행('S4', 지금)] }), []);
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
