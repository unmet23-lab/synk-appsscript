'use strict';
/**
 * [09-02 폼 넷] 글라이드 이관대장 「잇는다 — 폼 증설·신설 4」 회귀 — 개원 전 필수 강사 입력 넷이 «엔진에 닿는가».
 *
 * ■ 무엇을 지키나 (대장 docs/글라이드_이관대장.md · 판정 확정 09-01)
 *   ① 차시 마감폼 증설 — 응답 8열 창(LESSON_CLOSE_FORM_COLS) · weekly_topics 행의 D(created_at) = «응답 시각»(밤 전개 둘이 그날 행을 D 로 가른다) ·
 *      열 위치는 골격 헤더에서 파생(손 인덱스 0) · 증설 «전» 5열 응답 탭에서도 죽지 않는다.
 *   ② 반 출석 폼 — «반 명부 − 결석자 = 출석자»의 반전 · 이름 매칭 실패는 버리지 않고 표기(처리상태 '미매칭:이름' + 관리자 메일) · 동명이인은 후보 전부를 결석으로.
 *   ③ 출퇴근 폼 — teacher_checkins 행 모양 3칸 · 구분 값은 출근/퇴근 둘뿐 · 60초 연타는 한 건(자기치유와 같은 자).
 *   ④ 새 스위프 둘 + 마감폼 스위프의 시트 직기입은 전부 행소독_ 통로(수식 주입 가드 · v9.157 계보).
 *   ⑤ sync 셋은 문항을 안 늘린다(응답 열 파싱 계약 · safety 의 강사 폼 규칙 그대로).
 *   ⑥ 라이브 증설(migrateLessonCloseForm0902)은 멱등 — 두 번 눌러도 문항이 7에서 멈춘다.
 *   ⑦ 배선 — parentSweep 순서(반 출석 → 전개 · 출퇴근 → 보드) · morningJobs 동기화 셋 · preflight 켜기 큐 · 시트 메뉴.
 *
 * ■ 자 — 함수는 «몸»을 소스에서 잘라 실제로 돌린다(fnOf/load · safety.test.js 의 loadFunction 계보). 스텁은 바깥 세계(시트·속성·폼)뿐이고
 *   판정에 걸린 엔진 함수(dstr·행소독_·matchStudentsByNameClass_·grammarStageOf_·ensureLessonCols_·classAttLabels_)는 진짜를 부른다 —
 *   스텁은 사본이라 실물이 퇴행해도 여기는 초록이다(발화퀄리티.test.js:584 규약).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');
const { 코드만 } = require('./lib/소스검사.js');

const code = engineSource();

/* ── 소스 자르기 ─────────────────────────────────────────────────────── */
function fnOf(name) {
  const s = code.indexOf('function ' + name + '(');
  assert.notEqual(s, -1, name + ' 정의를 찾지 못함');
  const e = code.indexOf('\nfunction ', s + 10);
  return code.slice(s, e === -1 ? code.length : e);
}
function load(name, deps) {
  const names = Object.keys(deps);
  return new Function(...names, fnOf(name) + '\nreturn ' + name + ';')(...names.map((n) => deps[n]));
}
function section(a, b) {
  const s = code.indexOf(a);
  assert.notEqual(s, -1, '시작 표식을 찾지 못함: ' + a);
  const e = code.indexOf(b, s + a.length);
  assert.notEqual(e, -1, '끝 표식을 찾지 못함: ' + b);
  return code.slice(s, e);
}
function assertOrder(text, markers) {
  let prev = -1;
  markers.forEach((m) => {
    const cur = text.indexOf(m);
    assert.notEqual(cur, -1, '순서 검사 표식을 찾지 못함: ' + m);
    assert.ok(cur > prev, '실행 순서가 잘못됨: ' + markers.join(' → '));
    prev = cur;
  });
}
function constArr(name) {
  const m = code.match(new RegExp('const ' + name + ' = (\\[[^\\]]*\\]);'));
  assert.ok(m, name + ' 배열 상수를 찾지 못함');
  return new Function('return ' + m[1])();
}
function constStr(name) {
  const m = code.match(new RegExp("const " + name + " = '([^']*)'"));
  assert.ok(m, name + ' 문자열 상수를 찾지 못함');
  return m[1];
}
/** 골격 한 줄에서 헤더를 뜬다 — 손으로 베끼면 정본이 바뀐 날 이 시험만 낡는다. */
function skeletonRow(tab) {
  const m = code.match(new RegExp("\\['" + tab + "', (\\[[^\\]]*\\])"));
  assert.ok(m, '골격에서 ' + tab + ' 줄을 찾지 못함');
  return new Function('return ' + m[1])();
}
function lessonFormCols() {
  const extra = constArr('LESSON_CLOSE_EXTRA_COLS');
  const m = code.match(/const LESSON_CLOSE_FORM_COLS = (.+);/);
  assert.ok(m, 'LESSON_CLOSE_FORM_COLS 를 찾지 못함');
  return new Function('LESSON_CLOSE_EXTRA_COLS', 'return ' + m[1])(extra);
}
function tcCols() {
  const m = code.match(/const TC_NAME_COL = (\d+), TC_TYPE_COL = (\d+), TC_TIME_COL = (\d+)/);
  assert.ok(m, 'TC_*_COL 상수를 찾지 못함');
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/* ── 바깥 세계 흉내 ───────────────────────────────────────────────────── */
const p2 = (n) => ('0' + n).slice(-2);
const fmt = (d, tz, f) => {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) throw new Error('Exception: 잘못된 날짜 (GAS Utilities.formatDate 모사)');
  const ymd = x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate());
  if (f === 'yyyy-MM') return ymd.slice(0, 7);
  if (f === 'yyyyMMdd') return ymd.replace(/-/g, '');
  if (f === 'HH:mm') return p2(x.getHours()) + ':' + p2(x.getMinutes());
  return ymd;
};
function mkSheet(rows) {
  const sh = 시트흉내({ 첫행: 1, 행들: rows });
  sh.getMaxColumns = () => 26;          // ensureLessonCols_ 가 본다 — 기본 시트 폭
  sh.insertColumnsAfter = () => sh;
  return sh;
}
function mkSs(sheets) {
  return {
    getSheetByName: (n) => sheets[n] || null,
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
    insertSheet: (n) => (sheets[n] = mkSheet([]))
  };
}
function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, headers.length).setValues([headers]); }
  return sh;
}
function 속성() {
  const 통 = {};
  return { 통, getProperty: (k) => (Object.prototype.hasOwnProperty.call(통, k) ? 통[k] : null), setProperty: (k, v) => { 통[k] = String(v); } };
}
const dataRows = (sh) => sh.data.slice(1).filter((r) => (r || []).some((v) => v !== '' && v != null));

const dstr = load('dstr', { Utilities: { formatDate: fmt } });
const 행소독_ = load('행소독_', { 셀안전_: (v) => v });
const matchStudentsByNameClass_ = load('matchStudentsByNameClass_', {});
const grammarStageOf_ = load('grammarStageOf_', {});
const lessonGrammarIdsOf_ = load('lessonGrammarIdsOf_', { grammarStageOf_ });
const ensureLessonCols_ = load('ensureLessonCols_', {});
const classAttLabels_ = load('classAttLabels_', {});
const getState = load('getState', {});
const skeletonHeadersOf_ = (name) => skeletonRow(name);
const PROFILES_HDR = ['user_id', '이름', '이름_몽골', 'role', 'class_name'];

/* ── ① 차시 마감폼 스위프 ─────────────────────────────────────────────── */
function runLessonClose(responseRows) {
  const sheets = {
    '마감폼_응답': mkSheet(responseRows),
    profiles: mkSheet([PROFILES_HDR, ['S1', '바트', '', 'student', 'A반'], ['S2', '사라', '', 'student', 'B반']])
  };
  const ss = mkSs(sheets);
  const props = 속성();
  const mails = [];
  const sweep = load('sweepLessonCloseForm_', {
    PropertiesService: { getScriptProperties: () => props },
    LESSON_CLOSE_FORM_COLS: lessonFormCols(), LESSON_CLOSE_HEADERS: constArr('LESSON_CLOSE_HEADERS'), LESSON_FUEL_NONE: constStr('LESSON_FUEL_NONE'),
    ensureSheet, skeletonHeadersOf_, ensureLessonCols_, 행소독_, dstr, matchStudentsByNameClass_, lessonGrammarIdsOf_,
    seasonStartOf_: () => null, scheduleMap: () => ({}), schedOf: () => null, lessonNoOf_: () => 0, seasonWeekOf_: () => 0,
    quotaOk: () => true, adminMail: (s, b) => mails.push([s, b]), lessonCarryAlert_: () => {}
  });
  sweep(ss);
  return { ss, props, mails };
}

test('① 마감폼 스위프 — 8열 창 · weekly_topics 행의 D = 응답 시각 · 열 위치는 골격 헤더에서 파생 · 셋 다 비면 행 없음', () => {
  const FORM_COLS = lessonFormCols();
  assert.equal(FORM_COLS.length, 8, '응답 창은 타임스탬프 + 문항 7 = 8열이어야 한다');
  assert.deepEqual(FORM_COLS.slice(5), constArr('LESSON_CLOSE_EXTRA_COLS'), '증설 셋은 정본 배열의 «끝»에만 붙는다(가운데 끼우면 옛 응답 열이 밀린다)');
  const ts = new Date(2026, 8, 2, 20, 30);
  const ts2 = new Date(2026, 8, 2, 21, 0);
  const { ss, props } = runLessonClose([
    FORM_COLS,
    [ts, '바트 T', 'A반', '완료', '', '오늘은 -고 싶다', '1급 G301 -고 싶다, 1급 G302 -(으)ㄹ 거예요, 1급 G301 -고 싶다', '⏰ 정시 출석 데이'],
    [ts2, '바트 T', 'B반', '이월', '사라', '', '', '없음']
  ]);
  const wtHdr = skeletonRow('weekly_topics');
  const rows = dataRows(ss.getSheetByName('weekly_topics'));
  assert.equal(rows.length, 1, '내용 로그가 있는 응답만 weekly_topics 행이 된다(B반 응답은 셋 다 비어 행 없음)');
  const w = rows[0];
  assert.equal(w.length, wtHdr.length, '행 폭 = 골격 헤더 폭(12)');
  assert.equal(w[wtHdr.indexOf('class_name')], 'A반');
  assert.equal(w[wtHdr.indexOf('배운내용')], '오늘은 -고 싶다');
  assert.equal(w[wtHdr.indexOf('입력자')], '바트 T');
  assert.equal(wtHdr.indexOf('created_at'), 3, 'D 열 = created_at(expandLessonLog_·expandMasteryLog_ 가 r[3] 으로 그날 행을 가른다)');
  assert.equal(w[3], ts, 'D = 응답 타임스탬프 그대로(스위프 시각이 아니다 — 밤 전개가 그날 행을 이걸로 가른다)');
  assert.equal(w[wtHdr.indexOf('문법태그')], 'G301,G302', '문법태그 = 라벨이 아니라 ID 쉼표(중복 제거) — expandMasteryLog_ 가 G3xx 로 검증한다');
  assert.equal(w[wtHdr.indexOf('연료미션')], '⏰ 정시 출석 데이', '연료 = contents fuel 이름 그대로(바이트 동일 · expandLessonLog_ → class_fuel → weeklyFuel_ 맵)');
  assert.equal(w[wtHdr.indexOf('처리상태')], '', 'K·L 은 비워 둔다 — 밤 전개가 마킹한다');
  assert.equal(w[wtHdr.indexOf('학습전개상태')], '');
  // 옛 적재(lesson_close)는 그대로 — 두 응답 모두 한 행씩
  const lc = dataRows(ss.getSheetByName('lesson_close'));
  assert.equal(lc.length, 2);
  assert.equal(lc[1][5], 'S2', '미발화자 이름→sid 매칭은 옛 동작 그대로');
  assert.equal(props.통['마감폼_포인터'], '3', '포인터는 마지막 응답 행으로');
});

test('① 마감폼 스위프 — 증설 «전» 5열 응답 탭에서도 죽지 않고, weekly_topics 행을 만들지 않는다', () => {
  const FORM_COLS = lessonFormCols();
  const ts = new Date(2026, 8, 2, 20, 30);
  const { ss } = runLessonClose([FORM_COLS.slice(0, 5), [ts, '바트 T', 'A반', '완료', '']]);
  assert.equal(dataRows(ss.getSheetByName('lesson_close')).length, 1);
  assert.equal(ss.getSheetByName('weekly_topics'), null, '증설 전 응답은 내용 로그가 없다 — 빈 행을 만들지 않는다');
  const body = 코드만(fnOf('sweepLessonCloseForm_'));
  assert.equal(/last - from, 5\)/.test(body), false, '5열 고정 창이 되살아났다 — 증설분이 영원히 안 읽힌다');
  assert.ok(body.includes('LESSON_CLOSE_FORM_COLS.indexOf'), '열 위치는 정본 배열에서 파생해야 한다(손 인덱스 금지)');
  assert.ok(body.includes("skeletonHeadersOf_('weekly_topics')"), '착지 열 위치는 골격 헤더에서 파생해야 한다');
  assert.ok(body.includes('ensureLessonCols_(tp)'), '옛 5열 weekly_topics 도 F~L 승격을 지나야 한다(전개 둘과 같은 통로)');
});

test('① 문법태그 라벨 → ID — 뱅크 파생 라벨 전량이 되돌아오고, 뱅크 밖 토큰은 버린다', () => {
  const choices = load('lessonGrammarChoices_', { GRAMMAR_BANK: [['G301', '-고 싶다', '', 1, null, '표'], ['G713', '-는 반면에', '', 4, null, '요'], ['G201', '이/가', '', 1, null, '요']] })();
  assert.deepEqual(choices, ['1급 G201 이/가', '1급 G301 -고 싶다', '4급 G713 -는 반면에'], '급수 → ID 순');
  assert.deepEqual(lessonGrammarIdsOf_(choices.join(', ')), ['G201', 'G301', 'G713']);
  assert.deepEqual(lessonGrammarIdsOf_('G999, 아무거나, G1xx'), [], '뱅크 형식(G2~7xx)이 아니면 싣지 않는다 — expandMasteryLog_ 검증과 같은 자');
  assert.deepEqual(lessonGrammarIdsOf_(''), []);
});

/* ── ② 반 출석 폼 스위프 ─────────────────────────────────────────────── */
test('② 반 출석 반전 — 명부 − 결석자 = 출석자 · 라벨/이름 매칭 · 실패는 버리지 않고 표기(동명이인은 전부 결석)', () => {
  const PREFIX = constStr('CLASS_ATT_ABSENT_PREFIX'), FREE = constStr('CLASS_ATT_FREE_TITLE');
  const labels = classAttLabels_([{ sid: 'S1', n: '바트' }, { sid: 'S2', n: '사라' }, { sid: 'S3', n: '사라' }]).map((x) => x.label);
  assert.deepEqual(labels, ['바트', '사라 (S2)', '사라 (S3)'], '같은 반 동명이인만 학생ID 로 가른다');
  const hdr = ['타임스탬프', '강사', '반', PREFIX + ' · A반', PREFIX + ' · B반', FREE];
  const ts = new Date(2026, 8, 2, 9, 5);
  const sheets = {
    '반출석폼_응답': mkSheet([hdr,
      [ts, '바트 T', 'A반', '사라 (S2)', '', ''],            // 체크박스 라벨 → sid 역조회
      [ts, '바트 T', 'B반', '', '나라', ''],                 // 라벨(이름) → 이름 매칭(반 안 유일)
      [ts, '바트 T', 'B반', '', '', '없는애, 테무진'],        // 직접 입력 — 하나는 명부 밖
      [ts, '바트 T', 'A반', '', '', '사라'],                 // 직접 입력 — 동명이인
      [ts, '바트 T', 'C반', '', '', '']                      // 명부에 없는 반
    ]),
    profiles: mkSheet([PROFILES_HDR,
      ['S1', '바트', '', 'student', 'A반'], ['S2', '사라', '', 'student', 'A반'], ['S3', '사라', '', 'student', 'A반'],
      ['S4', '나라', '', 'student', 'B반'], ['S5', '테무진', '', 'student', 'B반'], ['T1', '바트 T', '', 'teacher', '']])
  };
  const ss = mkSs(sheets);
  const props = 속성();
  const mails = [];
  const sweep = load('sweepClassAttendanceForm_', {
    PropertiesService: { getScriptProperties: () => props },
    CLASS_ATT_ABSENT_PREFIX: PREFIX, classAttLabels_, skeletonHeadersOf_, ensureSheet, dstr, matchStudentsByNameClass_, 행소독_,
    quotaOk: () => true, adminMail: (s, b) => mails.push([s, b])
  });
  sweep(ss);
  const abHdr = skeletonRow('attendance_batch');
  const rows = dataRows(ss.getSheetByName('attendance_batch'));
  assert.equal(rows.length, 4, '명부에 없는 반은 전개하지 않는다(메일로만)');
  rows.forEach((r) => { assert.equal(r.length, abHdr.length); assert.equal(r[abHdr.indexOf('created_at')], ts); assert.equal(r[abHdr.indexOf('입력자')], '바트 T'); });
  const P = abHdr.indexOf('출석자목록'), S = abHdr.indexOf('처리상태'), C = abHdr.indexOf('class_name');
  assert.deepEqual([rows[0][C], rows[0][P], rows[0][S]], ['A반', 'S1,S3', ''], '라벨 「사라 (S2)」 → S2 만 빠진다');
  assert.deepEqual([rows[1][C], rows[1][P], rows[1][S]], ['B반', 'S5', ''], '이름 「나라」 → S4 가 빠진다');
  assert.equal(rows[2][P], 'S4', '「테무진」은 매칭돼 빠지고, 명부 밖 「없는애」는 뺄 사람이 없다');
  assert.ok(String(rows[2][S]).indexOf('미매칭:없는애') === 0, '매칭 실패를 행에 표기한다: ' + rows[2][S]);
  assert.equal(rows[3][P], 'S1', '동명이인 「사라」 — 후보 둘을 «전부» 결석으로(모른 채 출석 처리하지 않는다)');
  assert.ok(String(rows[3][S]).indexOf('미매칭:사라') === 0, '동명이인도 표기한다: ' + rows[3][S]);
  assert.equal(props.통['반출석폼_포인터'], '6');
  assert.equal(mails.length, 1, '확인 필요 건은 관리자 메일 한 통으로');
  assert.ok(mails[0][0].includes('3건') && mails[0][1].includes('없는애') && mails[0][1].includes('C반'), mails[0].join(' / '));
});

test('② 반 출석 스위프는 열을 «헤더 이름»으로 읽는다 — 결석자 열이 반마다 하나씩이라 위치가 고정이 아니다', () => {
  const body = 코드만(fnOf('sweepClassAttendanceForm_'));
  assert.ok(body.includes("hdr.indexOf('강사')") && body.includes("hdr.indexOf('반')"), '강사·반 열을 이름으로 찾아야 한다');
  assert.ok(body.includes('h.indexOf(CLASS_ATT_ABSENT_PREFIX) === 0'), '결석자 열 전부(체크박스 반별 + 직접 입력)를 접두로 모아야 한다');
  assert.equal(/last - from, \d\)/.test(body), false, '고정 폭 창을 쓰면 섹션이 늘어난 날 값이 밀린다');
  assert.ok(body.includes("skeletonHeadersOf_('attendance_batch')"), '착지 헤더는 골격에서 파생');
});

/* ── ③ 출퇴근 폼 스위프 ──────────────────────────────────────────────── */
test('③ 출퇴근 행 모양 — 3칸 [이름, 구분, 시각(Date)] · 구분은 출근/퇴근 둘뿐 · 60초 연타는 한 건', () => {
  const TYPES = constArr('TEACHER_CHECKIN_TYPES');
  assert.deepEqual(TYPES, ['출근', '퇴근'], 'todayBoard_·teacherInOutMap_ 의 indexOf 판정 낱말 그대로');
  const [N, T, TM] = tcCols();
  const t0 = new Date(2026, 8, 2, 8, 58);
  const at = (ms) => new Date(t0.getTime() + ms);
  const tcHdr = skeletonRow('teacher_checkins');
  const sheets = {
    '출퇴근폼_응답': mkSheet([['타임스탬프', '강사 이름', '구분'],
      [t0, '바트 T', '출근'],
      [at(30000), '바트 T', '출근'],          // 연타
      [at(3 * 3600000), '바트 T', '퇴근'],
      [t0, '사라 T', '점심'],                 // 구분 밖
      [t0, '사라 T', '출근']                  // 시트에 이미 20초 전 출근이 있다
    ]),
    teacher_checkins: mkSheet([tcHdr, ['사라 T', '출근', at(-20000)]])
  };
  const ss = mkSs(sheets);
  const props = 속성();
  const sweep = load('sweepTeacherCheckinForm_', {
    PropertiesService: { getScriptProperties: () => props },
    TC_NAME_COL: N, TC_TYPE_COL: T, TC_TIME_COL: TM, ensureSheet, skeletonHeadersOf_, TEACHER_CHECKIN_TYPES: TYPES, 행소독_
  });
  sweep(ss);
  const rows = dataRows(ss.getSheetByName('teacher_checkins'));
  assert.equal(rows.length, 3, '기존 1 + 새로 2(연타·구분 밖·기존과 60초 안은 안 싣는다)');
  const added = rows.slice(1);
  added.forEach((r) => {
    assert.equal(r.length, tcHdr.length, '행 폭 = 골격 헤더 3칸');
    assert.ok(TYPES.includes(r[T - 1]), '구분 값 밖: ' + r[T - 1]);
    assert.ok(r[TM - 1] instanceof Date, '시각은 Date(자기치유가 yyyy-mm-dd hh:mm 서식을 건다)');
  });
  assert.deepEqual(added.map((r) => [r[N - 1], r[T - 1], r[TM - 1].getTime()]), [['바트 T', '출근', t0.getTime()], ['바트 T', '퇴근', at(3 * 3600000).getTime()]]);
  assert.equal(props.통['출퇴근폼_포인터'], '6');
});

/* ── ④ 소독 통로 ─────────────────────────────────────────────────────── */
test('④ 세 스위프의 시트 직기입은 전부 행소독_ 통로다 — 폼 응답이 raw 로 실리면 수식 주입', () => {
  [['sweepLessonCloseForm_', 'lesson_close + weekly_topics'], ['sweepClassAttendanceForm_', 'attendance_batch'], ['sweepTeacherCheckinForm_', 'teacher_checkins']].forEach(([name, label]) => {
    const body = fnOf(name);
    assert.ok(/\.(?:setValues|appendRow)\(행소독_\(/.test(body), label + ' 적재가 소독 통로를 지나지 않는다');
    assert.equal(/\.setValues\((?:out|add|wtRows)\)|\.appendRow\(\[/.test(코드만(body)), false, label + '에 소독 없는 적재가 남아 있다');
  });
  const lc = fnOf('sweepLessonCloseForm_');
  assert.equal((lc.match(/setValues\(행소독_\(/g) || []).length, 2, '마감폼 스위프는 lesson_close·weekly_topics 두 적재 모두 소독한다');
});

/* ── ⑤ sync 셋 — 문항 불변 ───────────────────────────────────────────── */
test('⑤ sync 셋은 문항을 안 늘린다 — 응답 시트에 새 열이 생겨 스위프 파싱이 깨진다(증설은 마이그레이션·섹션 늘리기 몫)', () => {
  ['syncLessonCloseForm_', 'syncClassAttendanceForm_', 'syncTeacherCheckinForm_'].forEach((name) => {
    const body = 코드만(fnOf(name));
    assert.equal(/\.add[A-Z]\w*Item\(/.test(body), false, name + ' 이 문항을 추가한다');
    assert.ok(body.includes('return -1'), name + ' — 폼이 없으면 -1(호출부가 생성 경로로)');
  });
  // 증설 문항은 생성 경로와 마이그레이션이 «같은 몸»(lessonCloseExtraItems_)을 쓴다 — 두 곳에 적으면 순서가 갈린다
  assert.ok(fnOf('createLessonCloseForm').includes('lessonCloseExtraItems_(form, spec, [])'), '새 폼 생성이 증설 셋을 안 붙인다 — 새 설치는 5열 폼으로 태어난다');
  assert.ok(fnOf('migrateLessonCloseForm0902').includes('lessonCloseExtraItems_(form, spec, have)'), '마이그레이션이 같은 몸을 안 쓴다');
  // 증설 문항을 «직접» 만드는 자리는 lessonCloseExtraItems_ 하나 — 생성부·마이그레이션은 위임만 한다(두 곳이 만들면 순서가 갈린다)
  ['createLessonCloseForm', 'migrateLessonCloseForm0902'].forEach((name) => {
    assert.equal(/addCheckboxItem|addParagraphTextItem/.test(코드만(fnOf(name))), false, name + ' 이 증설 문항을 직접 만든다 — lessonCloseExtraItems_ 에 위임해야 한다');
  });
  assert.equal((code.match(/function lessonCloseExtraItems_\(/g) || []).length, 1);
});

/* ── ⑥ 마이그레이션 멱등 ─────────────────────────────────────────────── */
const ItemType = { TEXT: 'TEXT', PARAGRAPH_TEXT: 'PARAGRAPH_TEXT', LIST: 'LIST', CHECKBOX: 'CHECKBOX', PAGE_BREAK: 'PAGE_BREAK' };
function fakeForm(titles) {
  const items = [];
  const mk = (type) => {
    const it = { title: '', type, choices: null, help: '' };
    it.getTitle = () => it.title; it.getType = () => it.type;
    it.setTitle = (t) => { it.title = t; return it; };
    it.setRequired = () => it;
    it.setHelpText = (h) => { it.help = h; return it; };
    it.setChoiceValues = (v) => { it.choices = v.slice(); return it; };
    items.push(it);
    return it;
  };
  titles.forEach((t) => mk(ItemType.TEXT).setTitle(t));
  return {
    items, getItems: () => items.slice(),
    addParagraphTextItem: () => mk(ItemType.PARAGRAPH_TEXT), addCheckboxItem: () => mk(ItemType.CHECKBOX),
    addListItem: () => mk(ItemType.LIST), addTextItem: () => mk(ItemType.TEXT),
    getPublishedUrl: () => 'https://forms.example/lesson-close', getId: () => 'FID'
  };
}
function runMigration(form, syncResult) {
  const st = mkSheet([['key', 'value'], ['마감폼ID', 'FID']]);
  const ss = { getSheetByName: (n) => (n === 'app_state' ? st : null) };
  const spec = { grammarChoices: ['1급 G201 이/가'], fuels: ['없음', '⏰ 정시 출석 데이'], help: {} };
  const migrate = load('migrateLessonCloseForm0902', {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ensureSheet: () => st,
    syncLessonCloseForm_: () => syncResult,
    FormApp: { openById: (id) => { assert.equal(id, 'FID'); return form; }, ItemType },
    getState,
    lessonCloseSpec_: () => spec,
    lessonCloseExtraItems_: load('lessonCloseExtraItems_', { LESSON_CLOSE_EXTRA_COLS: constArr('LESSON_CLOSE_EXTRA_COLS') }),
    LESSON_CLOSE_FORM_COLS: lessonFormCols(),
    Logger: { log: () => {} }
  });
  return migrate();
}

test('⑥ migrateLessonCloseForm0902 — 라이브 폼 «끝»에 셋을 더하고, 두 번째는 아무것도 안 더한다(멱등)', () => {
  const EXTRA = constArr('LESSON_CLOSE_EXTRA_COLS');
  const form = fakeForm(['강사', '반', '진도', '오늘 한 번도 말하지 않은 학생']);
  const first = runMigration(form, 0);
  assert.equal(form.items.length, 7, '4 + 3');
  assert.deepEqual(form.items.slice(4).map((x) => x.title), EXTRA, '순서 = 정본 배열 그대로(응답 열 순서가 곧 스위프의 창)');
  assert.deepEqual(form.items.slice(4).map((x) => x.type), [ItemType.PARAGRAPH_TEXT, ItemType.CHECKBOX, ItemType.LIST]);
  assert.deepEqual(form.items[5].choices, ['1급 G201 이/가'], '문법태그 선택지 = 뱅크 파생 라벨');
  assert.deepEqual(form.items[6].choices, ['없음', '⏰ 정시 출석 데이'], '연료 선택지 = 「없음」 + contents fuel');
  assert.ok(first.includes('추가 ' + EXTRA.join(' · ')), first);
  const second = runMigration(form, 0);
  assert.equal(form.items.length, 7, '두 번 눌러도 문항이 늘지 않는다');
  assert.ok(second.includes('이미 최신'), second);
  // 폼이 없으면 만들지 않고 안내만
  const untouched = fakeForm([]);
  const msg = runMigration(untouched, -1);
  assert.equal(untouched.items.length, 0);
  assert.ok(msg.includes('미연결'), msg);
});

/* ── ⑦ 배선 ──────────────────────────────────────────────────────────── */
test('⑦ 배선 — parentSweep 순서 · morningJobs 동기화 셋 · preflight 켜기 큐 · 시트 메뉴 · 생성 가드', () => {
  const sweep = section('function parentSweep()', 'function translateTopics_');
  assertOrder(sweep, ["safeRun('sweepAttendanceForm'", "safeRun('sweepClassAttendanceForm'", "safeRun('expandAttendanceBatch'"]); // 반 출석 → 같은 틱 전개
  assertOrder(sweep, ["safeRun('sweepTeacherCheckinForm'", "safeRun('checkoutCheerMail'", "safeRun('todayBoard'"]);          // 출퇴근 → 같은 틱 보드·응원
  const morning = section('function morningJobs()', 'function nightJobs()');
  ['lessonCloseFormSync', 'classAttendanceFormSync', 'teacherCheckinFormSync'].forEach((k) => assert.ok(morning.includes("safeRun('" + k + "'"), '아침 동기화 누락: ' + k));
  assert.ok(code.includes("['반출석폼URL', 'createClassAttendanceForm'") && code.includes("['출퇴근폼URL', 'createTeacherCheckinForm'"), 'preflight 켜기 큐 누락');
  const start = code.indexOf('function onOpen()');
  const menu = code.slice(start, code.indexOf('addToUi();', start));
  ['menuCreateLessonCloseForm', 'menuMigrateLessonCloseForm0902', 'menuCreateClassAttendanceForm', 'menuExtendClassAttendanceForm', 'menuCreateTeacherCheckinForm'].forEach((f) => {
    assert.ok(menu.includes("'" + f + "'"), '메뉴 항목 누락: ' + f + ' — 비개발자가 눌러야 하는 함수는 메뉴가 실행 경로다');
    assert.ok(code.includes('function ' + f + '()'), '메뉴 래퍼 정의 누락: ' + f);
  });
  // 생성 가드 — 있으면 제자리 업그레이드, 없을 때만 FormApp.create(URL 갈아끼움 사고 차단 · 강사 폼 계보)
  assertOrder(fnOf('createClassAttendanceForm'), ['syncClassAttendanceForm_(ss, st)', 'FormApp.create(']);
  assertOrder(fnOf('createTeacherCheckinForm'), ['syncTeacherCheckinForm_(ss, st)', 'FormApp.create(']);
  assertOrder(fnOf('createClassAttendanceForm'), ['FormApp.create(', "setState(st, '반출석폼ID'", 'form.setDestination(']); // ID 는 만든 그 자리에서
  assertOrder(fnOf('createTeacherCheckinForm'), ['FormApp.create(', "setState(st, '출퇴근폼ID'", 'form.setDestination(']);
  // 골격 — 응답 탭은 폼 링크 탭이라 골격 밖(출석폼_응답 관례) · teacher_checkins 에 수집 표식을 붙이지 않는다
  const skel = section('function sheetSkeleton_()', 'function 수집장부탭_()');
  ['반출석폼_응답', '출퇴근폼_응답', '마감폼_응답'].forEach((t) => assert.equal(skel.includes("'" + t + "'"), false, t + ' 은 폼 링크 탭이라 골격에 안 든다'));
  assert.ok(skel.includes("['teacher_checkins', ['이름','구분','시각']],"), 'teacher_checkins 골격 줄이 바뀌었다(수집 표식 금지 · 헤더 3칸)');
});
