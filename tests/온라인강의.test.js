/* [v9.106] 온라인 녹화 강의 수강 이력 — 회귀 테스트.
 *
 * 왜: 주말반이 정규 트랙으로 승격되면서(유호 08-01) 대면은 주 1회뿐이고 나머지 시수를 녹화 강의가
 *   메운다. 이수 여부를 앱이 모르면 8주차 승급 도달제 판정과 강사 2층 「승급 통과율」 20점이
 *   대면 90분만 보고 내려진다 — 돈이 걸린 지표가 반쪽 데이터 위에 서는 구조다.
 *
 * 이 파일이 지키는 계약:
 *   ① 무데이터를 0%로 환산하지 않는다 (v9.89 결석 복귀율 규약 계승 — 앱 결함으로 사람이 불이익 받지 않게)
 *   ② 배선 4곳(스위프·시트 골격·켜기 큐·주간 리포트)이 살아 있다
 *   ③ 포인터가 적재 뒤에 마감돼 메일 실패가 같은 응답을 재적재하지 않는다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');

function section(startMarker, endMarker) {
  const start = code.indexOf(startMarker);
  assert.notEqual(start, -1, `시작 표식을 찾지 못함: ${startMarker}`);
  const end = code.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `끝 표식을 찾지 못함: ${endMarker}`);
  return code.slice(start, end);
}

const lectureProgressOf_ = new Function(
  `${section('function lectureProgressOf_(', 'function lectureRatesOf_(')}\nreturn lectureProgressOf_;`)();

/* ── ① 판정 규약 — 무데이터는 0%가 아니다 ─────────────────── */

test('[v9.106] 배정된 필수 강의가 없으면 rate=null — 0%로 환산하지 않는다', () => {
  assert.deepEqual(lectureProgressOf_([], ['L1']), { done: 0, total: 0, rate: null });
  assert.deepEqual(lectureProgressOf_(null, null), { done: 0, total: 0, rate: null });
  // 카탈로그를 아직 안 채웠다는 이유로 학생·강사가 0점을 맞으면 안 된다
  assert.equal(lectureProgressOf_(['', '  '], ['L1']).rate, null, '공백 강의ID가 분모를 만들었다');
});

test('[v9.106] 이수율 = 본 필수 강의 / 배정 필수 강의', () => {
  assert.deepEqual(lectureProgressOf_(['L1', 'L2', 'L3', 'L4'], ['L1', 'L3']),
    { done: 2, total: 4, rate: 50 });
  assert.equal(lectureProgressOf_(['L1', 'L2'], ['L1', 'L2']).rate, 100);
  assert.equal(lectureProgressOf_(['L1', 'L2'], []).rate, 0, '배정은 있는데 0건 시청이면 0%여야 한다');
});

test('[v9.106] 중복·공백·선택 강의가 분모를 부풀리지 않는다', () => {
  // 같은 강의를 두 번 배정해도 한 번만 센다(레벨 공통 + 레벨별에 같은 ID가 들어갈 수 있다)
  assert.equal(lectureProgressOf_(['L1', 'L1', 'L2'], ['L1']).total, 2, '중복 배정이 분모를 부풀렸다');
  // 학생이 같은 강의를 두 번 제출해도 분자가 2가 되지 않는다
  assert.deepEqual(lectureProgressOf_(['L1', 'L2'], ['L1', 'L1', 'L1']), { done: 1, total: 2, rate: 50 });
  // 공백 제출은 무시
  assert.equal(lectureProgressOf_(['L1'], ['', null, undefined]).done, 0);
});

test('[v9.106] 강의ID는 앞뒤 공백에 관계없이 맞는다 (폼 자유입력 대비)', () => {
  assert.equal(lectureProgressOf_([' L1 '], ['L1']).rate, 100);
  assert.equal(lectureProgressOf_(['L1'], ['  L1  ']).rate, 100);
});

/* ── ② 대상 한정 — 주말반만 ──────────────────────────────── */

test('[v9.106] 이수율 대상은 주말반 학생뿐이다 (평일반은 대면으로 시수가 찬다)', () => {
  const body = section('function lectureRatesOf_(ss)', 'function createLectureForm()');
  assert.ok(body.includes("sch.type !== '주말'"), '주말반 한정 필터가 없다 — 평일반까지 이수율을 매긴다');
  assert.ok(body.includes('schedOf('), '반유형을 scheduleMap이 아니라 다른 곳에서 읽는다');
  // 선택 강의가 필수 분모에 섞이면 이수율이 구조적으로 낮게 나온다
  assert.ok(/필수|TRUE/.test(body), '필수 여부 필터가 없다');
});

/* ── ②-b 조인 키 — 라이브 실측으로 잡은 결함 3겹 (v9.119) ───── */

test('[v9.119] 레벨 열은 이름으로 찾는다 — 위치 상수는 같은 자리에서 두 번 틀렸다', () => {
  const body = section('function lectureRatesOf_(ss)', 'function createLectureForm()');
  assert.ok(code.includes("const PROFILE_LEVEL_HEADER = '한국어수준'"), '헤더 이름 정본이 없다');
  assert.ok(code.includes('function profileLevelCol_(pf)'), '헤더 이름으로 찾는 헬퍼가 없다');
  assert.ok(body.includes('profileLevelCol_(pf)'), '레벨 열을 이름으로 안 찾는다');
  // 실패 이력: r[7]=연락처(v9.106) · r[18]=몬스터단계(v9.119 초판). profiles는 128열이고 계속 늘어난다
  assert.equal(/const lv = .*r\[7\]/.test(body), false, 'H열(연락처)을 레벨로 읽는 코드가 되살아났다');
  assert.equal(/PROFILE_LEVEL_COL/.test(code), false, '위치 상수 방식이 되살아났다');
});

test('[v9.119] 레벨 열을 못 찾으면 매칭을 포기한다 — 엉뚱한 열로 오답을 내지 않는다', () => {
  const body = section('function lectureRatesOf_(ss)', 'function createLectureForm()');
  const helper = section('function profileLevelCol_(pf)', 'const PROFILE_LEVELS');
  assert.ok(/return -1/.test(helper), '못 찾았을 때 -1을 돌려주지 않는다');
  assert.ok(/lvCol < 0/.test(body), '못 찾은 경우를 호출부가 안 다룬다');
  // 폭 고정은 열이 늘면 바로 깨진다(구 15열이 그랬다)
  assert.equal(/pf\.getRange\(2, 1, pf\.getLastRow\(\) - 1, 15\)/.test(body), false, '읽기 폭이 15열로 고정됐다');
  assert.ok(/pf\.getLastColumn\(\)/.test(body), '읽기 폭이 시트 실폭 기준이 아니다');
});

test('[v9.119] lectures 레벨 어휘 = profiles 한국어수준 어휘 (Lv1/Lv2는 조인 불가)', () => {
  assert.ok(code.includes("const PROFILE_LEVELS = ['완전초보', '기초', '초중급', '중급', '고급']"),
    'profiles 레벨 어휘 정본이 바뀌었다');
  const def = code.match(/const LECTURE_LEVELS_DEFAULT = (\[[^\]]*\])/);
  assert.ok(def, 'setupLectures 기본 레벨을 못 찾음');
  const levels = JSON.parse(def[1].replace(/'/g, '"'));
  const vocab = ['완전초보', '기초', '초중급', '중급', '고급'];
  levels.forEach((lv) => assert.ok(vocab.includes(lv),
    `기본 레벨 '${lv}'이 profiles 어휘에 없다 — 이수율이 조용히 무데이터가 된다`));
  assert.equal(/Lv[1-6]/.test(def[1]), false, "구 'Lv1/Lv2' 어휘가 되살아났다");
});

/* ── ③ 적재 안전 — 포인터·중복 ───────────────────────────── */

test('[v9.106] 스위프는 적재 뒤에 포인터를 마감한다 (메일 실패가 재적재를 부르지 않게)', () => {
  const body = section('function sweepLectureForm_(ss)', 'function lectureWeeklyText_(ss)');
  const write = body.indexOf('vw.getRange(vw.getLastRow() + 1');
  // ⚠ lastIndexOf 필수 — 함수 앞머리의 조기 종료 가드(from >= last)에도 같은 포인터 갱신이 있다.
  //   indexOf로 잡으면 그 가드를 "적재보다 앞선 마감"으로 오판한다(초안에서 실제로 오탐).
  const ptr = body.lastIndexOf("props.setProperty('강의폼_포인터'");
  const mail = body.indexOf('adminMail(');
  assert.ok(write > -1 && ptr > -1, '적재 또는 포인터 갱신이 없다');
  assert.ok(write < ptr, '포인터를 적재보다 먼저 마감한다 — 죽으면 응답이 통째로 유실된다');
  assert.ok(ptr < mail, '메일이 포인터보다 먼저다 — 메일이 throw하면 같은 응답을 다음 틱이 재적재한다');
  // 이름 매칭 실패를 조용히 버리지 않는다(행은 남기고 '미매칭' 표시 + 통보)
  assert.ok(body.includes("'미매칭'"), '미매칭 표시가 없다 — 실패가 조용히 사라진다');
});

/* ── ④ 배선이 살아 있다 ──────────────────────────────────── */

test('[v9.106] 배선 4곳 — 스위프·시트 골격·켜기 큐·주간 리포트', () => {
  assert.ok(code.includes("safeRun('sweepLectureForm'"), '10분 스위프에 안 걸려 있다 — 응답이 영영 전개되지 않는다');
  assert.ok(code.includes("['lectures', LECTURE_HEADERS]"), 'SHEET_SKELETON에 lectures가 없다');
  assert.ok(code.includes("['lecture_views', LECTURE_VIEW_HEADERS]"), 'SHEET_SKELETON에 lecture_views가 없다');
  assert.ok(code.includes("['강의폼URL', 'createLectureForm'"), '폼 미생성 감시(켜기 큐)에 없다 — 안 만들어도 아무도 모른다');
  assert.ok(code.includes('lectureWeeklyText_(ss)'), '주간 리포트 섹션에 안 걸려 있다');
});

test('[v9.106] 헤더 정본이 단일 소스다 (골격과 실사용이 같은 상수를 쓴다)', () => {
  assert.ok(code.includes("const LECTURE_HEADERS = ['강의ID', '레벨', '시즌', '주차', '제목', 'URL', '필수']"),
    'lectures 헤더 정본이 바뀌었다');
  assert.ok(code.includes("const LECTURE_VIEW_HEADERS = ['날짜', 'student_id', '이름', '반', '강의ID', '한줄요약', 'created_at', '비고']"),
    'lecture_views 헤더 정본이 바뀌었다');
  // 스위프가 쓰는 열 수와 헤더 길이가 어긋나면 적재가 밀린다
  const sweep = section('function sweepLectureForm_(ss)', 'function lectureWeeklyText_(ss)');
  assert.ok(sweep.includes('LECTURE_VIEW_HEADERS.length'), '적재 폭을 헤더 상수가 아니라 숫자로 박았다');
});

test('[v9.106] 폼 생성은 멱등이다 (v9.93 실사고 패턴 계승)', () => {
  const body = section('function createLectureForm()', 'function sweepLectureForm_(ss)');
  const create = body.indexOf('FormApp.create(');
  const idSave = body.indexOf("setState(st, '강의폼ID'");
  assert.ok(body.includes('getFilesByName(title)'), '고아 폼 회수 단계가 없다 — 재실행이 폼을 하나 더 만든다');
  assert.ok(create < idSave, '폼 생성 뒤 즉시 ID를 기록하지 않는다 — 중간에 죽으면 앱이 그 폼을 모른다');
  assert.ok(body.includes('!form.getItems().length'), '문항을 무조건 다시 만든다 — 응답 열 계약이 깨진다');
});

/* ── ⑤ 확인 방법 — 체크박스가 아니라 산출 ─────────────────── */

test('[v9.106] 시청 확인은 한국어 한 문장 산출로 받는다 (체크박스 금지)', () => {
  const body = section('function createLectureForm()', 'function sweepLectureForm_(ss)');
  assert.ok(body.includes('addParagraphTextItem'), '서술 문항이 없다 — 체크만으로는 3주 뒤 전원 100%가 된다');
  assert.ok(/한국어로 한 문장/.test(body), '한 줄 요약 문항이 사라졌다');
  assert.equal(/addCheckboxItem\(\)\s*\.setTitle\('(봤|시청)/.test(body), false, '시청 여부 체크박스가 생겼다');
});
