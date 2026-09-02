'use strict';
/* 가져가는 것 — 걸음 1 회귀 (2026-09-02) · 설계 = docs/가져가는것_설계_v1.md §2-c·§2-d·§6 걸음1 · 판정 = docs/_ops/심문결과/가져가는것_설계_v1-전건판정.md §7
 *
 * 무엇을 지키나 — 소급 불가 둘이 «학생 0명인 지금» 닫힌 모양 그대로 서 있는가:
 *   A. attendance.class_snapshot(5번째 칸) — 쓰는 자 넷이 전부 5폭으로 쓰고, 폼 출석은 «쓰는 시점»에 반을 얼려 넣는다.
 *   B. portfolio_moments 최소 원본 — 폴더 이름 파서 · session_key · 기간키 · 멱등(같은 폴더 두 번 = 행 1) · 소비자 장부 등재 ·
 *      학생 문구는 contents_순간.js 에서만.
 *
 * ⚠ 재는 것은 **순수 코어**(파서·계획·키)와 **소스 형상**이다 — Drive·Sheets 를 부르는 래퍼(momentSweep_ 본체)는 회귀가 못 잡는다(안 재봤다).
 *   sweepAttendanceForm_ 만은 시트를 흉내내 실제로 태운다(반 스냅샷이 «값»으로 들어가는지가 이 걸음의 첫 줄이라서).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { engineSource } = require('./_engine-source');
const { 코드만 } = require('./lib/소스검사.js');

const ROOT = path.resolve(__dirname, '..');
const code = engineSource();
const 코드정제 = 코드만(code);
const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

function section(startMarker, endMarker) {
  const s = code.indexOf(startMarker);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${startMarker}`);
  const e = code.indexOf(endMarker, s + startMarker.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${endMarker}`);
  return code.slice(s, e);
}

/* 순수 코어 — 엔진_폼리포트.js 순간 절의 상수 + 순수 함수 넷을 잘라 그대로 평가한다(스텁 0 · 정본이 깨지면 여기가 빨개진다). */
const 순수 = (() => {
  const src = section('const MOMENT_ROOT_FOLDER_ =', '/* ── Drive·시트 래퍼');
  return new Function(`${src}\nreturn { momentParseFolderName_, momentSessionKey_, momentPeriodKey_, momentKnownFromRows_, momentPlan_, momentRow_, MOMENT_OFFSEASON_, MOMENT_COPY_RETRY_MAX_ };`)();
})();
const 헤더 = (() => {
  const m = code.match(/const PORTFOLIO_MOMENTS_HEADERS = (\[[^\]]*\]);/);
  assert.ok(m, 'PORTFOLIO_MOMENTS_HEADERS 정본을 못 찾았다');
  return new Function(`return ${m[1]};`)();
})();
const 출석헤더 = (() => {
  const m = code.match(/const ATTENDANCE_HEADERS = (\[[^\]]*\]);/);
  assert.ok(m, 'ATTENDANCE_HEADERS 정본을 못 찾았다');
  return new Function(`return ${m[1]};`)();
})();

// ── ① attendance 헤더 5칸 · 쓰는 자 넷이 5폭으로 쓴다 ─────────────────────────────────────

test('① attendance 헤더 정본은 5칸이고 끝이 class_snapshot 이다 — 골격이 그 상수를 본다(손사본 0)', () => {
  assert.deepEqual(출석헤더, ['id', 'student_id', 'timestamp', 'method', 'class_snapshot']);
  assert.match(code, /\['attendance',\s*ATTENDANCE_HEADERS,\s*수집표식_\]/, '골격 attendance 행이 정본 상수를 안 본다');
  assert.ok(!코드정제.includes("['id', 'student_id', 'timestamp', 'method']"), '구 4칸 손사본이 코드에 남아 있다 — 한 값을 두 곳이 알면 갈린다');
});

test('① 쓰는 자 넷 — 일괄 전개·폼 스위프·데모 시드·GPS 백필이 전부 5폭이고, 라이브 헤더 증분은 헤더보정_ 을 지난다', () => {
  const batch = 코드만(section('function expandAttendanceBatch_(', 'function parentWeeklyDigest()'));
  assert.ok(batch.includes("ensureSheet(ss, 'attendance', ATTENDANCE_HEADERS)"), '일괄 전개가 정본 헤더로 ensureSheet 하지 않는다');
  assert.ok(batch.includes('헤더보정_(at, ATTENDANCE_HEADERS)'), '일괄 전개에 라이브 헤더 증분 통로가 없다');
  assert.ok(batch.includes("'출석(일괄)', clsBatch || clsOf[sid] || ''"), '일괄 전개 행에 반 스냅샷(배치 행의 반 → 지금 반 폴백)이 없다');
  assert.ok(batch.includes('ATTENDANCE_HEADERS.length).setValues(newRows)'), '일괄 전개 setValues 폭이 정본 길이가 아니다');

  const form = 코드만(section('function sweepAttendanceForm_(', 'function sweepFeedbackAck_('));
  assert.ok(form.includes("ensureSheet(ss, 'attendance', ATTENDANCE_HEADERS)"), '폼 스위프가 정본 헤더로 ensureSheet 하지 않는다');
  assert.ok(form.includes('헤더보정_(at, ATTENDANCE_HEADERS)'), '폼 스위프에 라이브 헤더 증분 통로가 없다');
  assert.ok(form.includes("'출석(폼)', clsOf[sid] || ''"), '폼 출석 행에 반 스냅샷이 없다');
  assert.ok(form.includes('ATTENDANCE_HEADERS.length).setValues(out)'), '폼 스위프 setValues 폭이 정본 길이가 아니다');

  const demo = 코드만(section('// ③ attendance — 반유형별 수업일만', '// ④ point_logs'));
  assert.ok(demo.includes("'출석(데모)', demoCls[sid] || ''"), '데모 시드 행에 반 스냅샷이 없다 — 데모로 검증한 조인이 실전과 어긋난다');
  assert.ok(demo.includes('ATTENDANCE_HEADERS.length).setValues(atRows)'), '데모 시드 setValues 폭이 정본 길이가 아니다');

  const calc = 코드만(section('function calcAll()', 'function writeSharedCols_'));
  assert.ok(calc.includes('at.getRange(2, 1, atLast - 1, ATTENDANCE_HEADERS.length)'), 'calcAll 이 attendance 를 정본 폭으로 안 읽는다');
  assert.ok(calc.indexOf('헤더보정_(at, ATTENDANCE_HEADERS)') > -1 && calc.indexOf('헤더보정_(at, ATTENDANCE_HEADERS)') < calc.indexOf('at.getRange(2, 1, atLast - 1'),
    'calcAll 의 헤더 증분이 읽기보다 뒤에 있다(또는 없다) — 학생 0명 라이브에서 5열이 영영 안 생긴다');
  assert.ok(calc.includes('writeIfChanged(at, cFirst + 2, 5, clsColA)'), 'GPS 셀프 출석 backfill(E열)이 없다');
  assert.ok(calc.includes("if (!r[1] || !r[2] || String(r[4] || '').trim()) return;"), 'backfill 이 이미 찍힌 스냅샷을 덮어쓴다 — 스냅샷은 한 번만 찍힌다');
});

// ── ② sweepAttendanceForm_ 이 «쓰는 시점»에 profiles.class_name 을 읽어 얼려 넣는다(실제로 태운다) ──

test('② 폼 출석 — 쓰는 시점의 profiles.class_name 이 5번째 칸에 값으로 들어간다(조인 시점 참조가 아니라 스냅샷)', () => {
  const src = section('function sweepAttendanceForm_(', 'function sweepFeedbackAck_(');
  const writes = [];
  const sheetOf = (rows, opts) => ({
    getLastRow: () => rows.length + 1,
    getRange: (r, c, n, w) => ({
      getValues: () => rows.slice(r - 2, r - 2 + n).map((row) => row.slice(c - 1, c - 1 + w)),
      setValues: (v) => { writes.push({ c, w, v }); },
    }),
    getMaxColumns: () => (opts && opts.cols) || 26,
    insertColumnsAfter: () => {},
  });
  const ts = new Date(2027, 2, 14, 11, 0, 0);
  const sheets = {
    '출석폼_응답': sheetOf([[ts, 'S1'], [ts, 'S9']]),                                  // S9 = 미등록(드롭 통보만)
    profiles: sheetOf([['S1', '테무진', 'Тэмүжин', 'student', 'A2반'], ['T1', '강사', '', 'teacher', '']]),
    attendance: sheetOf([]),
  };
  const ss = { getSheetByName: (n) => sheets[n] || null, getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' };
  const props = {};
  const dropped = [];
  const fn = new Function('PropertiesService', 'Utilities', 'ensureSheet', '헤더보정_', 'dstr', 'notifyDroppedSids_', 'ATTENDANCE_HEADERS',
    `${src}\nreturn sweepAttendanceForm_;`)(
    { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    { formatDate: (d, tz, fmt) => (fmt === 'yyyyMMdd' ? '20270314' : '2027-03-14') },
    (s, name) => sheets[name],
    (sh, H) => { /* 헤더 증분 — 흉내 시트에선 무동작 */ },
    (v) => '2027-03-14',
    (label, bad) => { dropped.push(bad.slice()); },
    출석헤더
  );
  fn(ss);
  const att = writes.find((w) => w.v[0] && String(w.v[0][0]).indexOf('ATF') === 0);
  assert.ok(att, 'attendance 에 아무 행도 안 썼다');
  assert.equal(att.w, 5, `setValues 폭이 ${att.w} — 5(class_snapshot)여야 한다`);
  assert.deepEqual(att.v, [['ATF20270314-S1', 'S1', ts, '출석(폼)', 'A2반']], '반 스냅샷이 «지금 값»으로 안 들어갔다');
  assert.deepEqual(dropped, [['S9']], '미등록 sid 드롭 통보가 바뀌었다 — 이 수정은 통보 경로를 건드리면 안 된다');
  assert.equal(props['출석폼_포인터'], '3', '포인터 전진이 깨졌다');
});

// ── ③ 폴더 이름 파서 ────────────────────────────────────────────────────────────────────

test('③ 파서 — 정상 이름은 다섯 칸으로 갈리고, 한 줄 안의 ` - ` 는 한 줄의 일부다', () => {
  const p = 순수.momentParseFolderName_('2027-03-14 - A2반 - 12차시 - 작품 - 우리 반 김밥집 간판을 만들었다');
  assert.equal(p.ok, true, p.사유);
  assert.deepEqual([p.사건일, p.반, p.차시, p.종류, p.한줄], ['2027-03-14', 'A2반', 12, '작품', '우리 반 김밥집 간판을 만들었다']);
  const q = 순수.momentParseFolderName_('2027-03-14 - A2반 - 12차시 - 작품 - 김밥 - 간판');
  assert.equal(q.한줄, '김밥 - 간판', '한 줄 안의 구분자가 한 줄을 잘랐다');
  const r = 순수.momentParseFolderName_('2027-03-14  -  A2반 - 0차시 - 기념 - 첫날 이름표');
  assert.equal(r.ok, true, '겹공백이 파싱을 깨뜨렸다');
  assert.equal(r.차시, 0, '시즌 밖 0차시는 정상 값이다(지어내지 않는다)');
});

test('③ 파서 — 구분자 틀림·낫표·밑줄·날짜 없음은 «미분류»이고 사유가 이름을 갖는다(버리지 않는다 · §3-b)', () => {
  const 사유 = (name) => { const p = 순수.momentParseFolderName_(name); assert.equal(p.ok, false, `잡아야 하는데 통과했다: ${name}`); return p.사유; };
  assert.equal(사유('2027-03-14 – A2반 – 12차시 – 작품 – 한줄'), '구분자', '긴 줄표');
  assert.equal(사유('2027-03-14-A2반-12차시-작품-한줄'), '구분자', '공백 없는 붙임표');
  assert.equal(사유('2027-03-14 - A2반 - 12차시 - 작품 - 「한줄」'), '낫표');
  assert.equal(사유('2027-03-14_A2반_12차시_작품_한줄'), '밑줄');
  assert.equal(사유('A2반 - 12차시 - 작품 - 한줄'), '날짜없음');
  assert.equal(사유('2027-13-40 - A2반 - 12차시 - 작품 - 한줄'), '날짜', '있지 않은 날짜');
  assert.equal(사유('2027-03-14 - A2반 - 12차시'), '한줄없음', '배치가 만든 빈 이름 그대로');
  assert.equal(사유('2027-03-14 - A2반 - 12차시 - 우리 반 간판'), '종류없음');
  assert.equal(사유('2027-03-14 - A2반 - 12 - 작품 - 한줄'), '차시');
  assert.equal(사유(''), '이름없음');
  const p = 순수.momentParseFolderName_('2027-03-14 - A2반 - 12차시 - 사진 - 한줄', ['무대', '작품']);
  assert.equal(p.사유, '종류:사진', '허용 종류 밖이면 그 이름을 사유에 싣는다');
  assert.deepEqual([p.사건일, p.반], ['2027-03-14', 'A2반'], '미분류라도 읽어낸 만큼(사건일·반)은 실린다 — 원장 오늘판이 반 칸에 쓴다');
});

// ── ④ session_key · 기간키 ───────────────────────────────────────────────────────────────

test('④ session_key = 사건일|반|차시 — 같은 날 두 수업이 갈린다(판정 ②) · 행에는 정상일 때만 적힌다', () => {
  assert.equal(순수.momentSessionKey_('2027-03-14', 'A2반', 12), '2027-03-14|A2반|12');
  assert.notEqual(순수.momentSessionKey_('2027-03-14', 'A2반', 12), 순수.momentSessionKey_('2027-03-14', 'A2반', 13), '보강(다른 차시)이 같은 세션이 됐다');
  assert.equal(순수.momentSessionKey_('2027-03-14', 'A2반', ''), '2027-03-14|A2반|');
  const ok = 순수.momentParseFolderName_('2027-03-14 - A2반 - 12차시 - 작품 - 한줄');
  const row = 순수.momentRow_({ folder: { id: 'F1', name: 'x' }, parse: ok, media: [], copyFolderId: 'C1', loadedAt: '2027-03-15 21:03:00', status: '정상', periodKey: '2027-02-25' });
  assert.equal(row.length, 헤더.length, '행 폭이 헤더 정본과 다르다');
  assert.equal(row[헤더.indexOf('session_key')], '2027-03-14|A2반|12');
  assert.equal(row[헤더.indexOf('사건일')], '2027-03-14', '사건일은 폴더 이름의 날짜다(적재일이 아니다 · 판정 ③)');
  assert.equal(row[헤더.indexOf('적재일')], '2027-03-15 21:03:00');
  assert.equal(row[헤더.indexOf('공개범위')], '반');
  const bad = 순수.momentParseFolderName_('2027-03-14 - A2반 - 12차시');
  const row2 = 순수.momentRow_({ folder: { id: 'F2', name: '2027-03-14 - A2반 - 12차시' }, parse: bad, media: [], loadedAt: 'd', status: '미분류:한줄없음', periodKey: '비시즌' });
  assert.equal(row2[헤더.indexOf('session_key')], '', '미분류 행에 session_key 가 박혔다 — 조인 재료가 아닌 것이 조인된다');
  assert.equal(row2[헤더.indexOf('한줄')], '2027-03-14 - A2반 - 12차시', '미분류 행은 폴더 이름을 그대로 실어 원장이 무엇을 고칠지 보게 한다');
});

test('④ 기간키 — 시즌 8주 안이면 시즌 시작일(= groups 키), 밖이면 비시즌 · 체험 2주는 시즌 밖(판정 ⑥) · 시작일이 없어도 지어내지 않는다', () => {
  const k = 순수.momentPeriodKey_;
  assert.equal(k('2027-03-14', '2027-02-25', 8), '2027-02-25');
  assert.equal(k('2027-02-25', '2027-02-25', 8), '2027-02-25', '첫날은 안이다');
  assert.equal(k('2027-04-21', '2027-02-25', 8), '2027-02-25', '56일째(마지막 날)는 안이다');
  assert.equal(k('2027-04-22', '2027-02-25', 8), 순수.MOMENT_OFFSEASON_, '57일째는 밖이다');
  assert.equal(k('2027-02-11', '2027-02-25', 8), 순수.MOMENT_OFFSEASON_, '체험 첫날(02-11)은 시즌 밖이다');
  assert.equal(k('2027-02-11', '', 8), 순수.MOMENT_OFFSEASON_, '시즌 시작일이 없으면 비시즌 — 시즌을 지어내지 않는다');
  assert.equal(k('', '2027-02-25', 8), 순수.MOMENT_OFFSEASON_);
});

// ── ⑤ 멱등 — 같은 폴더 두 번 = 행 1 · 미디어 추가 = «추가» 행 ────────────────────────────

test('⑤ 멱등 — 같은 폴더를 두 번 훑으면 두 번째는 할 일이 없고, 새 파일이 들어오면 그 파일만 «추가»다(판정 ⑤)', () => {
  const parse = 순수.momentParseFolderName_('2027-03-14 - A2반 - 12차시 - 작품 - 한줄');
  const f2 = { id: 'F1', files: [{ id: 'a', name: 'a.jpg', kind: '사진' }, { id: 'b', name: 'b.jpg', kind: '사진' }] };
  const first = 순수.momentPlan_({}, f2, parse);
  assert.equal(first.종류, '신규');
  assert.deepEqual(first.파일.map((f) => f.id), ['a', 'b']);
  const rows = [순수.momentRow_({ folder: { id: 'F1', name: 'n' }, parse, media: [{ 원본: 'a', 사본: 'A', 종류: '사진', 이름: 'a.jpg' }, { 원본: 'b', 사본: 'B', 종류: '사진', 이름: 'b.jpg' }], loadedAt: 'd', status: '정상', periodKey: '비시즌' })];
  const known = 순수.momentKnownFromRows_(rows);
  assert.equal(순수.momentPlan_(known, f2, parse), null, '같은 폴더가 두 번째에 또 행을 만든다 — 재실행마다 중복 행이 는다');
  const f3 = { id: 'F1', files: f2.files.concat([{ id: 'c', name: 'c.mp4', kind: '영상' }]) };
  const add = 순수.momentPlan_(known, f3, parse);
  assert.equal(add.종류, '추가');
  assert.deepEqual(add.파일.map((f) => f.id), ['c'], '이미 담긴 파일이 다시 복사된다');
  assert.equal(순수.momentPlan_({}, { id: 'F9', files: [] }, parse), null, '빈 폴더(배치가 만든 그대로)는 행이 아니다');
});

test('⑤ 멱등 — 미분류였던 폴더의 이름을 고치면 «정정»(정상 행 한 줄 더) · 복사 실패분은 재시도하되 상한이 있다', () => {
  const bad = 순수.momentParseFolderName_('2027-03-14 - A2반 - 12차시');
  const rows = [순수.momentRow_({ folder: { id: 'F1', name: '2027-03-14 - A2반 - 12차시' }, parse: bad, media: [{ 원본: 'a', 사본: 'A', 종류: '사진', 이름: 'a.jpg' }], loadedAt: 'd', status: '미분류:한줄없음', periodKey: '비시즌' })];
  const known = 순수.momentKnownFromRows_(rows);
  const good = 순수.momentParseFolderName_('2027-03-14 - A2반 - 12차시 - 작품 - 한줄');
  const fix = 순수.momentPlan_(known, { id: 'F1', files: [{ id: 'a', name: 'a.jpg', kind: '사진' }] }, good);
  assert.equal(fix.종류, '정정', '이름을 고쳤는데 미분류로 영영 남는다');
  assert.deepEqual(fix.파일, [], '정정이 이미 담긴 파일을 다시 복사한다');
  /* 사본이 비어 있는(복사 실패) 파일은 다음 밤에 다시 시도한다 — 다만 상한을 넘으면 «추가» 행을 더 안 만든다(매일 우는 행 방지). */
  const failRows = [];
  for (let i = 0; i < 순수.MOMENT_COPY_RETRY_MAX_; i++) failRows.push(순수.momentRow_({ folder: { id: 'F2', name: 'n' }, parse: good, media: [{ 원본: 'z', 사본: '', 종류: '사진', 이름: 'z.jpg' }], loadedAt: 'd', status: '정상 · 복사실패', periodKey: '비시즌' }));
  const k2 = 순수.momentKnownFromRows_(failRows.slice(0, 1));
  assert.equal(순수.momentPlan_(k2, { id: 'F2', files: [{ id: 'z', name: 'z.jpg', kind: '사진' }] }, good).종류, '추가', '복사 실패분이 재시도되지 않는다 — 사본이 정본인데 영영 비어 있다');
  const k3 = 순수.momentKnownFromRows_(failRows);
  assert.equal(순수.momentPlan_(k3, { id: 'F2', files: [{ id: 'z', name: 'z.jpg', kind: '사진' }] }, good), null, '재시도 상한이 없다 — 영구 실패 파일이 매일 «추가» 행을 만든다');
  const k4 = 순수.momentKnownFromRows_([['F3', '', '', '', '', '', '', '', '{깨진 JSON', '', '', '', '정상', '반']]);
  assert.deepEqual(k4.F3.사본있음, {}, '깨진 미디어 JSON 이 훑기를 죽였다 — 빈 목록으로 보고 다음 행으로 가야 한다');
});

// ── ⑥ 소비자 장부 — 생산·소비 같은 커밋 ──────────────────────────────────────────────────

test('⑥ portfolio_moments 가 골격에 수집 표식으로 서고, 도달 장부에 소비자(Code.js:calcAll · 제품)로 등재돼 있다 — 래칫 위반 0', () => {
  assert.match(code, /\[PORTFOLIO_MOMENTS_TAB_,\s*PORTFOLIO_MOMENTS_HEADERS,\s*수집표식_\]/, '골격 등재(수집 표식)가 없다 — 도달 감시 눈 밖에서 조용히 0이 된다');
  assert.equal(code.match(/'portfolio_moments'/g).length, 1, "시트 이름 리터럴이 상수 선언 밖에도 있다 — 이름이 갈라진다");
  const { 읽다 } = require('../tools/lib/시트도달.js');
  const r = 읽다(ROOT);
  assert.ok(r.탭.includes('portfolio_moments'), '수집 탭 목록에 없다');
  assert.deepEqual(r.장부.portfolio_moments, { 소비자: 'Code.js:calcAll', 층: '제품' }, '소비자 장부 칸이 다르다 — 생산과 소비는 같은 커밋이다(§2-c ⚠)');
  assert.deepEqual(r.위반, [], '시트층 도달 장부가 빨갛다: ' + JSON.stringify(r.위반));
  assert.deepEqual(헤더, ['moment_id', 'session_key', '사건일', '반', '차시', '종류', '한줄', '기간키', '미디어', '원본폴더', '사본폴더', '적재일', '상태', '공개범위'],
    '헤더 순서가 정본과 다르다 — 행이 하나라도 들어가면 못 고친다');
});

test('⑥ 생산자 — momentSweep_ 는 제 트리거(21시)로 돌고 원본을 지우지 않는다 · 원장 소비자 둘이 배선돼 있다', () => {
  const mfSrc = section('function triggerManifest_(', '\nfunction resetAllTriggers(');
  const 매니 = new Function(mfSrc + '\nreturn triggerManifest_;')()(false);
  assert.ok(매니.includes('momentSweepJob'), '트리거 매니페스트에 momentSweepJob 이 없다 — preflight·워치독이 실종을 못 본다');
  const install = 코드만(section('triggers.forEach(t => ScriptApp.deleteTrigger(t));', '트리거 통합 재설치 완료'));
  assert.ok(install.includes("newTrigger('momentSweepJob').timeBased().atHour(21).everyDays(1)"), '재설치 목록에 21시 트리거가 없다');
  assert.ok(코드정제.includes("function momentSweepJob()         { safeRun('momentSweep', momentSweep_); }".replace(/\s+/g, ' ')) || /function momentSweepJob\(\)\s*\{\s*safeRun\('momentSweep',\s*momentSweep_\);/.test(코드정제), 'safeRun 보호 래퍼가 없다');
  const night = 코드만(section('function nightJobs()', 'function dailyBackupJob()'));
  assert.ok(!night.includes('momentSweep'), 'nightJobs 6분 예산 안에 넣었다 — Drive 복사는 파일 수에 비례해 길다(제 트리거로)');
  const sweep = 코드만(section('function momentSweep_(', 'function momentRowsView_('));
  ['setTrashed', 'removeFile', 'deleteFile'].forEach((bad) => assert.ok(!sweep.includes(bad), `momentSweep_ 가 ${bad} 를 부른다 — 원본 삭제는 절대 금지다`));
  const copy = 코드만(section('function momentCopyOne_(', 'function momentSweep_('));
  ['setTrashed', 'removeFile'].forEach((bad) => assert.ok(!copy.includes(bad), `momentCopyOne_ 가 ${bad} 를 부른다`));
  assert.ok(copy.includes('drive.google.com/thumbnail?id=') && copy.includes('ScriptApp.getOAuthToken()'), '축소본 통로(Drive 썸네일 + OAuth)가 없다');
  assert.ok(copy.includes('makeCopy('), '축소본 실패 시 원본 복사 폴백이 없다');
  assert.ok(sweep.includes('MOMENT_BUDGET_MS_'), '실행 예산이 없다 — 6분 강제 종료가 부분 행조차 안 남긴다');
  assert.ok(sweep.includes('행소독_(out)'), '폴더 이름(남의 글)이 소독 없이 시트에 들어간다');
  const board = 코드만(section('function todayBoard_(', 'function expandHwBatch()'));
  assert.ok(board.includes('momentBoardRows_(ss, tz, schMap, now, weekCls)'), '원장 오늘판 소비자 ②(어제 미분류 · 이번 주 0건 반)가 배선돼 있지 않다');
  assert.ok(board.includes('catch (eMo)'), '순간 줄 실패가 출결 보드를 깨뜨린다');
  assert.ok(board.includes('at.getRange(2, 1, at.getLastRow() - 1, ATTENDANCE_HEADERS.length)') && board.includes('weekCls[cls5] = 1'),
    '0건 경보의 분모가 «이번 주 출석 사건이 있었던 반»이 아니다 — 개원 전(학생 0명)에 시간표 전 반이 매일 운다(F103)');
  const boardFn = 코드만(section('function momentBoardRows_(', 'function momentWeeklyText_('));
  assert.ok(boardFn.includes('Object.keys(weekCls || {})'), 'momentBoardRows_ 가 시간표 전체를 분모로 돈다');
  const weeklyFn = 코드만(section('function momentWeeklyText_(', '\n}\n'));
  assert.ok(weeklyFn.includes('ATTENDANCE_HEADERS.length') && weeklyFn.includes('met[c] = 1'), '주간 0건 반의 분모가 출석 사건이 아니다');
  const weekly = section('function weeklyJobs()', 'let body =');
  assert.ok(weekly.includes('momentWeeklyText_()'), '주 1회 「순간 0건 반」 경보가 원장 통로(주간 통합 리포트)에 없다');
});

// ── ⑦ BY/BX 문구는 contents_순간.js 에서만 온다 ─────────────────────────────────────────

test('⑦ 걸어온길(BY77)·오늘의알림(BX76)이 읽는 말은 contents_순간.js(MOMENT_SAY)에서 온다 — 엔진에 문구 0 · mn 은 빈칸(검수 대기)', () => {
  const bank = 읽기('contents_순간.js');
  assert.ok(/^const MOMENT_SAY = \{/m.test(bank), 'MOMENT_SAY 뱅크가 없다');
  assert.ok(!/\b(SpreadsheetApp|function |require\()/.test(코드만(bank)), 'contents_순간.js 에 로직이 들어갔다 — 로직 0줄');
  const MOMENT_SAY = new Function(`${코드만(bank)}\nreturn MOMENT_SAY;`)();
  const kinds = Object.keys(MOMENT_SAY).filter((k) => k !== '*');
  assert.ok(MOMENT_SAY['*'] && kinds.length >= 5, '공통 틀(*)과 종류 다섯이 없다');
  ['무대', '발표', '작품', '촬영', '기념'].forEach((k) => assert.ok(kinds.includes(k), `설계 §2-c 종류 «${k}» 가 뱅크에 없다`));
  Object.keys(MOMENT_SAY).forEach((k) => {
    assert.ok(MOMENT_SAY[k].걸어온길.includes('{한줄}') && MOMENT_SAY[k].오늘알림.includes('{한줄}'), `«${k}» 문구에 {한줄} 자리표가 없다 — 사람이 적은 유일한 글자가 안 실린다`);
    assert.equal(MOMENT_SAY[k].mn, '', `«${k}» mn 칸이 채워져 있다 — 검수자 0명, 지어낸 번역 금지`);
    assert.ok(!/\d+\s*(개|건)/.test(MOMENT_SAY[k].걸어온길 + MOMENT_SAY[k].오늘알림), `«${k}» 문구에 개수가 있다 — 개수는 옆 아이와 비교된다(㉢ · §4-b)`);
  });
  // 엔진 쪽 — 문구 리터럴 0 · 자리표 채우기만
  const lineSrc = section('function momentLine_(', '\n}\n') + '\n}';
  assert.ok(lineSrc.includes("typeof MOMENT_SAY === 'undefined'"), '반쪽 배포 가드가 없다 — calcAll 이 통째로 죽는다');
  const momentLine_ = new Function('MOMENT_SAY', `${lineSrc}\nreturn momentLine_;`)(MOMENT_SAY);
  const m = { d: '2027-03-14', kind: '작품', line: '우리 반 김밥집 간판을 만들었다' };
  assert.equal(momentLine_('걸어온길', m), '🎨 3월 14일, 우리 반 김밥집 간판을 만들었다');
  assert.ok(momentLine_('오늘알림', m).includes('우리 반 김밥집 간판을 만들었다') && momentLine_('오늘알림', m).includes('걸어온 길'), '오늘의알림이 무엇이 담겼는지·어디서 보는지를 안 말한다(판정 ⑲ 자기설명)');
  assert.equal(momentLine_('걸어온길', { d: '2027-03-14', kind: '모르는종류', line: 'x' }), '📷 3월 14일, x', '모르는 종류가 공통 틀로 안 떨어진다');
  assert.equal(new Function('MOMENT_SAY', `${lineSrc}\nreturn momentLine_;`)(undefined)('걸어온길', m), '', '뱅크가 없으면 빈 문자열이어야 한다');
  const calc = 코드만(section('function calcAll()', 'function writeSharedCols_'));
  assert.ok(calc.includes("momentLine_('오늘알림', momentTodayOfSid[id])"), 'BX 가 뱅크를 안 지난다');
  assert.ok(calc.includes('moment: momentOfSid[id] || null'), 'BY 걸어온길에 최근 순간이 안 실린다');
  const road = 코드만(section('function buildWalkedRoadHtml_(', 'function momentLine_('));
  assert.ok(road.includes("momentLine_('걸어온길', o.moment)"), '걸어온길 카드가 뱅크를 안 지난다');
  assert.ok(!/담겼어/.test(코드정제), '엔진 코드에 학생 문구 리터럴(담겼어)이 있다 — 문구는 contents_순간.js 한 곳');
  // 조인 규칙 — profiles.class_name 이 아니라 attendance.class_snapshot(r9[4])
  const join = calc.slice(calc.indexOf('const momentOfSid = {}'), calc.indexOf('const out = pfData.map'));
  assert.ok(join.includes("cls9 = String(r9[4] || '').trim()") && join.includes("dstr(r9[2], tz) + '|' + cls9"), '순간↔학생 조인이 attendance.class_snapshot 으로 안 걸린다(§2-d)');
  assert.ok(!join.includes('clsB2[') && !join.includes('clsNow9['), '조인에 profiles.class_name 을 썼다 — 반 이동 뒤 옛 순간이 새 반으로 붙는다(🚫 §2-d)');
  assert.ok(join.includes("m9.st.indexOf('미분류') === 0"), '미분류가 학생 화면에 나간다');
});

test('⑦ 배포 표면 — contents_순간.js 가 filePushOrder 에 있고 라이브 파생(.claspignore)에 잡힌다', () => {
  const cj = JSON.parse(fs.readFileSync(path.join(ROOT, '.clasp.json'), 'utf8'));
  assert.ok(cj.filePushOrder.includes('contents_순간.js'), 'filePushOrder 에 contents_순간.js 가 없다');
  const { liveFiles } = require('./_engine-source');
  assert.ok(liveFiles().includes('contents_순간.js'), '.claspignore 허용목록 파생에 contents_순간.js 가 없다 — 라이브가 반쪽이 된다');
});
