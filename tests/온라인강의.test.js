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
const { engineSource } = require('./_engine-source');
/* 주석 제거 통로는 공용 하나다 — `tests/lib/소스검사.js` (F401 계열 · 대기열 P3 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');
const code = engineSource();
/* 🔑 **부정 단언 전용** 정제본 — 「없어야 한다」를 원문에 대고 재면 그 문구를 주석에 적는 순간
 *   가드가 엉뚱하게 빨개진다. 긍정 단언과 `section()` 앵커는 원문 `code` 를 그대로 본다. */
const 코드정제 = 코드만(code);

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
  assert.ok(body.includes("String(sch.type).trim() !== '주말'"), '주말반 한정 필터가 없다 — 평일반까지 이수율을 매긴다 (v9.125: trim 정규화 포함 — 후행 공백이면 대상 0명이 되던 구멍)');
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
  assert.equal(/const lv = .*r\[7\]/.test(코드만(body)), false, 'H열(연락처)을 레벨로 읽는 코드가 되살아났다');
  assert.equal(/PROFILE_LEVEL_COL/.test(코드정제), false, '위치 상수 방식이 되살아났다');
});

test('[v9.119] 레벨 열을 못 찾으면 매칭을 포기한다 — 엉뚱한 열로 오답을 내지 않는다', () => {
  const body = section('function lectureRatesOf_(ss)', 'function createLectureForm()');
  const helper = section('function profileLevelCol_(pf)', 'const PROFILE_LEVELS');
  assert.ok(/return -1/.test(helper), '못 찾았을 때 -1을 돌려주지 않는다');
  assert.ok(/lvCol < 0/.test(body), '못 찾은 경우를 호출부가 안 다룬다');
  // 폭 고정은 열이 늘면 바로 깨진다(구 15열이 그랬다)
  assert.equal(/pf\.getRange\(2, 1, pf\.getLastRow\(\) - 1, 15\)/.test(코드만(body)), false, '읽기 폭이 15열로 고정됐다');
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
  /* [vNEXT · #Q100] `lecture_views` 는 수집 표식을 받아 칸이 셋이다 — 닫는 괄호를 못박지 않는다
   *   (뜻은 「골격에 있고 헤더 정본 상수를 쓴다」이지 「칸이 둘이다」가 아니었다). */
  assert.ok(/\['lecture_views', LECTURE_VIEW_HEADERS[,\]]/.test(code), 'SHEET_SKELETON에 lecture_views가 없다');
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
  assert.equal(/addCheckboxItem\(\)\s*\.setTitle\('(봤|시청)/.test(코드만(body)), false, '시청 여부 체크박스가 생겼다');
});

/* ── ⑥ [v9.121] 카탈로그와 폼 선택지가 갈리지 않는다 ────────
 * 08-01 실사고: 카탈로그를 새 어휘로 갈아엎어도 폼은 폐기된 Lv1/Lv2 선택지를 계속 보여줬다.
 *   createLectureForm이 「문항이 있으면 건너뜀」이라 아무도 따라가지 않았기 때문이다.
 *   학생이 폐기된 선택지를 고르면 존재하지 않는 강의ID가 lecture_views에 쌓여 분자가 영영 0이 된다. */

test('[v9.121] 선택지 문자열은 한 곳에서만 만든다 (생성·동기화가 같은 모양)', () => {
  const build = section('function lectureChoices_(ss)', 'function syncLectureFormChoices()');
  assert.ok(build.includes("' - '"), '구분자가 바뀌었다 — sweepLectureForm_이 앞부분을 강의ID로 자르는 계약이 깨진다');
  assert.ok(build.includes('slice(-200)'), '폼 목록 상한이 사라졌다 (v9.125: 뒤에서 200개 — 앞에서 자르면 잘리는 쪽이 최신 시즌이다)');
  // [v9.125] 공백 ID 차단 — trim 전 truthy 검사는 스페이스 한 칸을 빈 선택지('')로 만들었다(setChoiceValues 거부 → 4단계 차단)
  assert.ok(/trim\(\);\s*if \(!id\) return;/.test(build), '공백 강의ID 필터가 없다 — 빈 선택지가 폼 생성을 막는다');
  // 생성부가 자기만의 선택지 조립을 되살리면 두 모양이 갈린다
  const create = section('function createLectureForm()', 'function sweepLectureForm_(ss)');
  assert.ok(create.includes('lectureChoices_(ss)'), '생성부가 공용 빌더를 안 쓴다 — 모양이 갈릴 수 있다');
  assert.equal(/choices\.push\(/.test(코드만(create)), false, '생성부에 선택지 조립이 되살아났다(중복 정본)');
});

test('[v9.121] 동기화는 문항을 지웠다 만들지 않는다 (응답 열 계약 보존)', () => {
  const body = section('function syncLectureFormChoices()', 'function createLectureForm()');
  assert.ok(body.includes('setChoiceValues('), '선택지 교체가 없다');
  assert.equal(/deleteItem\(|addListItem\(/.test(코드만(body)), false,
    '문항을 삭제·재생성한다 — 응답 시트 열이 갈려 sweep 적재가 어긋난다');
  assert.ok(body.includes('FormApp.ItemType.LIST'), '목록 문항을 유형으로 찾지 않는다');
});

test('[v9.121] 동기화는 멱등이고, 못 할 상황이면 조용히 고치지 않고 사실을 돌려준다', () => {
  const body = section('function syncLectureFormChoices()', 'function createLectureForm()');
  assert.ok(/every\(/.test(body), '같은지 비교하지 않는다 — 매번 폼을 쓴다');
  assert.ok(body.includes("'강의폼ID'"), '폼ID를 app_state에서 읽지 않는다');
  assert.ok(/!want\.length/.test(body), '카탈로그가 빈 경우를 안 막는다 — 선택지를 전멸시킬 수 있다');
  assert.ok(/if \(!li\)/.test(body), '자유 입력 폼(목록 문항 없음)을 처리하지 않는다');
});

test('[v9.121] 카탈로그 재시딩 뒤 폼이 낡은 채 남지 않는다 (생성부 자가치유 + 메뉴)', () => {
  const create = section('function createLectureForm()', 'function sweepLectureForm_(ss)');
  assert.ok(create.includes('syncLectureFormChoices()'),
    '문항이 이미 있을 때 그냥 건너뛴다 — 카탈로그를 갈아엎어도 폼이 따라가지 않는다(08-01 실사고)');
  assert.ok(code.includes("'menuSyncLectureForm'"), '시트 메뉴에 없다 — 유호님이 시즌마다 실행할 경로가 없다(v9.124부터 래퍼 경유)');
});

/* ── ⑦ [v9.123] 낡은 자리 정리는 '지우지 않는 쪽'으로 틀린다 ──
 * 손으로 행을 지우는 건 행 번호 조준이라 옆 세션이 목록을 밀면 멀쩡한 행을 문다(08-01 실사고 계열).
 *   그래서 조준을 내용으로 옮겼고, 그 조준이 느슨해지지 않도록 4중 잠금을 기계로 잠근다. */

test('[v9.123] 살아 있는 레벨 판정은 상수가 아니라 상수 ∪ 시트 실재값이다', () => {
  const body = section('function liveLectureLevels_(ss)', 'function pruneStaleLectures()');
  assert.ok(body.includes('PROFILE_LEVELS'), '상수를 안 쓴다');
  assert.ok(body.includes('profileLevelCol_(pf)'), 'profiles 실재값을 안 읽는다 — 새 레벨이 유령으로 오판된다');
});

test('[v9.123] 삭제 4중 잠금 — 하나라도 어긋나면 남긴다', () => {
  const body = section('function pruneStaleLectures()', 'function lectureChoices_(ss)');
  assert.ok(body.includes('if (live[lv]) return'), '① 살아 있는 레벨을 지울 수 있다');
  assert.ok(/URL 있음/.test(body), '② URL이 채워진 행을 지울 수 있다 — 유호님 작업물 손실');
  assert.ok(/제목 수정됨/.test(body), '③ 손으로 고친 제목을 지울 수 있다');
  assert.ok(/수강 기록/.test(body) && body.includes('viewed[id]'), '④ 학생 수강 기록이 있는 강의를 지울 수 있다');
  assert.ok(body.includes('lecture_views'), '수강 기록을 아예 안 본다');
});

test('[v9.123] 삭제는 아래에서 위로 — 행 번호 밀림 자해 차단', () => {
  const body = section('function pruneStaleLectures()', 'function lectureChoices_(ss)');
  assert.ok(/sort\(function \(a, b\) \{ return b\.row - a\.row; \}\)/.test(body),
    '역순 정렬이 없다 — 위에서 지우면 남은 행이 밀려 다음 삭제가 엉뚱한 행을 문다');
  assert.ok(body.includes('deleteRows('), '삭제가 없다');
});

test('[v9.123] 남긴 이유와 지운 내역을 보고한다 (조용한 삭제 금지)', () => {
  const body = section('function pruneStaleLectures()', 'function lectureChoices_(ss)');
  assert.ok(body.includes('keep.push('), '남긴 행을 모으지 않는다 — 왜 안 지웠는지 알 수 없다');
  assert.ok(/첫 삭제/.test(body) && /끝 삭제/.test(body), '지운 범위를 보고하지 않는다');
  assert.ok(code.includes("'menuPruneStaleLectures'"), '시트 메뉴에 없다 — 유호님이 실행할 경로가 없다(v9.124부터 래퍼 경유)');
});

test('[v9.123] 자동 제목 재구성은 제목이 아니라 강의ID에서 차시를 얻는다(순환 금지)', () => {
  const body = section('function pruneStaleLectures()', 'function lectureChoices_(ss)');
  assert.ok(body.includes("id.split('-').pop()"), '차시 번호를 강의ID에서 얻지 않는다');
  assert.equal(/const auto = [^\n]*r\[4\]/.test(코드만(body)), false,
    '자동 제목을 제목 자신으로 만든다 — 항상 일치해 ③ 잠금이 죽는다');
});

/* ── ⑧ [v9.123] 정적 검사로는 부족하다 — 실제로 돌려서 무엇이 지워지는지 본다 ──
 * 08-01 교훈(`guard-must-check-result`): 가드가 "그 문구가 있는지"만 보면 문구를 옮기는 순간 죽는다.
 *   여기서는 가짜 시트로 pruneStaleLectures를 **실행**해 삭제된 행 자체를 확인한다. */

function runPrune(lectureRows, viewRows, profileLevels) {
  const deleted = [];
  const mkSheet = (rows, width) => ({
    getLastRow: () => rows.length + 1,
    getLastColumn: () => width,
    getRange: (r, c, n, w) => ({
      getValues: () => rows.slice(r - 2, r - 2 + n).map((row) => row.slice(c - 1, c - 1 + w)),
      // [v9.125] 삭제 직전 내용 재확인용 단일 셀 읽기 — 실물 Range 계약과 동일
      getValue: () => { const row = rows[r - 2]; return row ? row[c - 1] : ''; },
    }),
    deleteRows: (r, n) => { deleted.push(r); rows.splice(r - 2, n); },
  });
  const sheets = {
    lectures: mkSheet(lectureRows, 7),
    lecture_views: mkSheet(viewRows, 8),
    profiles: mkSheet(profileLevels.map((v) => [v]), 1),
  };
  const scope = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] || null }) },
    PROFILE_LEVELS: ['완전초보', '기초', '초중급', '중급', '고급'],
    LECTURE_HEADERS: ['강의ID', '레벨', '시즌', '주차', '제목', 'URL', '필수'],
    LECTURE_VIEW_HEADERS: ['날짜', 'student_id', '이름', '반', '강의ID', '한줄요약', 'created_at', '비고'],
    profileLevelCol_: () => 0,
    Logger: { log: () => {} },
  };
  const src = section('function liveLectureLevels_(ss)', 'function lectureChoices_(ss)');
  const fn = new Function(...Object.keys(scope), `${src}\nreturn pruneStaleLectures;`)(...Object.values(scope));
  return { msg: fn(), deleted, remaining: lectureRows.map((r) => r[0]) };
}

const seat = (id, lv, s, w, n, url, title) =>
  [id, lv, s, w, title === undefined ? `${lv} 시즌${s} ${w}주차 ${n}차시` : title, url || '', 'Y'];

test('[v9.123] 낡은 어휘 자리만 지우고 살아 있는 어휘는 남긴다 (실행 검증)', () => {
  const rows = [
    seat('L1-S1-W01-1', 'Lv1', 1, 1, 1),
    seat('완전초보-S1-W01-1', '완전초보', 1, 1, 1),
    seat('L2-S1-W01-1', 'Lv2', 1, 1, 1),
    seat('기초-S1-W01-1', '기초', 1, 1, 1),
  ];
  const r = runPrune(rows, [], ['완전초보', '기초']);
  assert.deepEqual(r.remaining, ['완전초보-S1-W01-1', '기초-S1-W01-1'], '살아 있는 어휘를 지웠거나 유령을 남겼다');
  assert.match(r.msg, /낡은 강의 자리 2개 삭제/);
});

test('[v9.123] 사람·학생의 작업물은 낡은 어휘여도 남긴다 (실행 검증)', () => {
  const rows = [
    seat('L1-S1-W01-1', 'Lv1', 1, 1, 1, 'https://youtu.be/abc'),        // ② URL 있음
    seat('L1-S1-W01-2', 'Lv1', 1, 1, 2, '', '손으로 고친 제목'),          // ③ 제목 수정됨
    seat('L1-S1-W01-3', 'Lv1', 1, 1, 3),                                 // ④ 수강 기록 있음
    seat('L1-S1-W01-4', 'Lv1', 1, 1, 4),                                 // 순수 유령 — 이것만 지워야 한다
  ];
  const views = [['2026-08-01', 'S1', '학생', 'A반', 'L1-S1-W01-3', '요약', '2026-08-01', '']];
  const r = runPrune(rows, views, ['완전초보']);
  assert.deepEqual(r.remaining, ['L1-S1-W01-1', 'L1-S1-W01-2', 'L1-S1-W01-3'], '사람·학생 작업물을 지웠다');
  assert.match(r.msg, /남긴 행 3개/);
  assert.match(r.msg, /URL 있음/);
  assert.match(r.msg, /수강 기록 1건/);
});

test('[v9.123] profiles에만 있는 새 레벨도 살아 있는 것으로 본다 (실행 검증)', () => {
  const rows = [seat('심화-S1-W01-1', '심화', 1, 1, 1)];   // 상수에는 없고 profiles에만 있는 레벨
  const r = runPrune(rows, [], ['심화']);
  assert.deepEqual(r.remaining, ['심화-S1-W01-1'], '시트에 실재하는 레벨의 자리를 유령으로 오판해 지웠다');
  assert.match(r.msg, /지울 낡은 자리가 없습니다/);
});

test('[v9.123] 여러 행을 지워도 행 번호가 밀리지 않는다 (실행 검증)', () => {
  const rows = [
    seat('완전초보-S1-W01-1', '완전초보', 1, 1, 1),
    seat('L1-S1-W01-1', 'Lv1', 1, 1, 1),
    seat('기초-S1-W01-1', '기초', 1, 1, 1),
    seat('L2-S1-W01-1', 'Lv2', 1, 1, 1),
    seat('L2-S1-W01-2', 'Lv2', 1, 1, 2),
  ];
  const r = runPrune(rows, [], ['완전초보', '기초']);
  assert.deepEqual(r.remaining, ['완전초보-S1-W01-1', '기초-S1-W01-1'],
    '위에서부터 지워 남은 행이 밀렸다 — 멀쩡한 행이 함께 사라진다');
  assert.deepEqual(r.deleted, [6, 5, 3], '삭제가 역순(아래→위)이 아니다');
});

/* ── ⑨ [v9.124] 눌렀는데 아무 일도 안 일어난 것처럼 보이면 안 된다 ──
 * 메뉴 항목이 Logger.log만 남기면 유호님은 성공·실패를 구별할 수 없다. 확인 없는 재클릭이 사고가 된다. */

test('[v9.124] 강의 메뉴 5종은 결과를 보여주는 래퍼를 부른다', () => {
  ['menuSetupLectures', 'menuCreateLectureForm', 'menuPruneStaleLectures', 'menuSyncLectureForm', 'menuLectureJoinDiag']
    .forEach((fn) => {
      assert.ok(code.includes(`'${fn}'`), `메뉴가 ${fn}을 부르지 않는다`);
      assert.ok(code.includes(`function ${fn}()`), `${fn} 정의가 없다 — 메뉴에서 'Script function not found'`);
    });
  // 원본 함수를 메뉴에 직접 걸면 결과가 안 보이던 상태로 되돌아간다
  ['setupLectures', 'createLectureForm', 'pruneStaleLectures', 'syncLectureFormChoices'].forEach((fn) => {
    assert.equal(코드정제.includes(`.addItem('📚 강의 자리 깔기(1단계)', '${fn}')`), false, `${fn}이 메뉴에 직접 걸렸다`);
  });
});

test('[v9.124] 실패는 alert로 보이고, 실행 기록에도 실패로 남는다', () => {
  const body = section('function menuRun_(fn)', 'function menuSetupLectures()');
  assert.ok(body.includes('ui.alert('), '결과를 안 보여준다');
  assert.ok(/catch \(err\)/.test(body) && body.includes('throw err'),
    '오류를 삼킨다 — alert만 띄우고 삼키면 실행 기록에 「완료됨」으로 남아 사후 추적이 거짓말을 한다');
});

test('[v9.124] 조인 진단은 읽기 전용이고, 안 붙을 때 원인을 지목한다', () => {
  const body = section('function lectureJoinDiag()', 'function liveLectureLevels_(ss)');
  assert.equal(/setValues\(|deleteRows\(|setState\(|appendRow\(/.test(코드만(body)), false,
    '진단이 시트를 쓴다 — 읽기 전용이어야 아무 때나 눌러도 안전하다');
  assert.ok(body.includes('profileLevelCol_(pf)') && body.includes('lectureRatesOf_(ss)'),
    '실제 조인 경로가 아니라 다른 계산을 본다 — 진단이 본체와 갈리면 거짓 안심을 준다');
  assert.ok(/orphan/.test(body), '학생 레벨에 배정된 필수 강의가 0개인 경우를 지목하지 않는다(조인 실패의 실제 모양)');
  assert.ok(/조인 성립/.test(body) && /원인 = /.test(body), '판정과 원인을 문장으로 내지 않는다');
});

/* ── ⑩ [v9.198] 한줄요약 읽기 배선 (엔진도달 전수감사 §4 ㉡) ────────────────────
 * 이 칸은 **쌓기만 하고 읽는 코드가 0**이었다 — 수집이 도는데 도달이 0인 형태.
 * 첨삭 통로에 실려야 hw_feedback → 강사 정답 모음 표본 → 평가 픽스처로 나간다(저장소의 유일한 도달선).
 * 정적 검사가 아니라 **실행**해서 무엇이 대기줄에 오르는지 본다(⑧과 같은 이유). */

const 대기줄 = (viewRows, fbRows, lecRows, fbW) => {
  const mk = (rows, width) => ({
    getLastRow: () => rows.length + 1,
    getLastColumn: () => width,
    // 실물 Range 계약 — 시트 폭을 넘는 요구는 **예외**다(관대한 스텁은 폭 클램프 누락을 초록으로 덮는다)
    getRange: (r, c, n, w) => {
      assert.ok(c - 1 + w <= width, `시트 폭(${width})을 넘는 범위를 요구했다: c=${c} w=${w}`);
      return { getValues: () => rows.slice(r - 2, r - 2 + n).map((row) => row.slice(c - 1, c - 1 + w)) };
    },
  });
  const sheets = { lecture_views: mk(viewRows, 8) };
  if (fbRows) sheets.hw_feedback = mk(fbRows, fbW || 19);
  if (lecRows) sheets.lectures = mk(lecRows, 7);
  const scope = {
    LECTURE_VIEW_HEADERS: ['날짜', 'student_id', '이름', '반', '강의ID', '한줄요약', 'created_at', '비고'],
    LECTURE_HEADERS: ['강의ID', '레벨', '시즌', '주차', '제목', 'URL', '필수'],
    LECTURE_SRC_PREFIX: '강의:',
  };
  // dstr은 실물을 그대로 쓴다 — 테스트가 날짜 문자열화를 자기 식으로 베끼면 중복 키가 갈라진 채 초록이 된다
  const src = section('function dstr(v, tz, fmt)', '\nfunction ') +
    section('function 강의요약대기_(ss, tz)', 'function aiFeedbackBatch_()');
  const fn = new Function(...Object.keys(scope), `${src}\nreturn 강의요약대기_;`)(...Object.values(scope));
  return fn({ getSheetByName: (n) => sheets[n] || null }, 'Asia/Ulaanbaatar');
};
const 뷰 = (sid, lid, 요약, d) => [d || '2026-08-08', sid, '이름', 'A반', lid, 요약, d || '2026-08-08', ''];
const 첨삭행 = (sid, d, 숙제ID) => ['FB1', sid, d, '원문', '교정', '', '', '', '노출', '', '', 숙제ID];

test('[v9.198] ㉡ 한줄요약이 첨삭 대기줄에 오른다 — 접두·제목 스냅샷·포인터 없음', () => {
  const q = 대기줄([뷰('S1', 'L1-S1-W01-1', '오늘은 조사를 배웠어요')], null, [['L1-S1-W01-1', '기초', 1, 1, '조사 1강', '', 'Y']]);
  assert.equal(q.length, 1);
  assert.equal(q[0].hwId, '강의:L1-S1-W01-1', '출처 접두가 없으면 2년 뒤 이 행이 과제 답으로 읽힌다');
  assert.equal(q[0].문항, '조사 1강', '강의 제목 스냅샷이 없다 — lectures가 개정되면 해석 불능(원칙 2)');
  assert.equal(q[0].text, '오늘은 조사를 배웠어요');
  assert.equal(q[0].ptr, 0, '강의요약이 숙제폼 포인터를 밀면 그 사이 도착한 숙제 제출이 통째로 유실된다');
});

test('[v9.198] 이미 첨삭된 요약은 다시 안 올린다 — 중복 과금·중복 카드 차단(같은 날 단위)', () => {
  const v = 뷰('S1', 'L1', '요약', '2026-08-08');
  assert.equal(대기줄([v], [첨삭행('S1', '2026-08-08', '강의:L1')]).length, 0, '같은 학생·같은 날·같은 강의가 다시 올랐다');
  assert.equal(대기줄([v], [첨삭행('S1', '2026-08-07', '강의:L1')]).length, 1, '다른 날 제출까지 막았다');
  assert.equal(대기줄([v], [첨삭행('S2', '2026-08-08', '강의:L1')]).length, 1, '다른 학생의 적재가 이 학생을 막았다');
  assert.equal(대기줄([v], [첨삭행('S1', '2026-08-08', 'HW7')]).length, 1, '같은 날 숙제 첨삭이 강의요약을 막았다');
});

/* 🔑 이 설계를 포인터가 아니라 「적재된 것 대조」로 만든 이유가 이 한 건이다.
 *   이름 매칭 실패 행은 student_id가 빈 채로 쌓이고 사람이 나중에 채운다(sweepLectureForm_ 통보 메일).
 *   포인터였다면 배치가 이미 그 행을 지나쳐 **영영** 안 걸린다 — 미매칭이 곧 영구 유실이 된다. */
test('[v9.198] 미매칭 행은 건너뛰되, student_id가 나중에 채워지면 그때 걸린다', () => {
  assert.equal(대기줄([뷰('', 'L1', '요약')]).length, 0, 'student_id 없는 행을 올렸다 — 누구 것인지 모르는 첨삭이 나간다');
  assert.equal(대기줄([뷰('S1', 'L1', '요약')]).length, 1, '나중에 채워진 sid를 못 집는다(포인터 방식의 사각)');
  assert.equal(대기줄([뷰('S1', 'L1', '   ')]).length, 0, '빈 요약으로 API를 호출한다');
  assert.equal(대기줄([뷰('S1', '', '요약')]).length, 0, '강의ID 없는 행은 중복 키가 성립하지 않는다');
});

test('[v9.198] 시트 안 중복 제출은 1건 · 카탈로그에 없는 강의ID도 버리지 않는다(수집이 채점보다 우선)', () => {
  assert.equal(대기줄([뷰('S1', 'L1', '요약'), 뷰('S1', 'L1', '요약')]).length, 1, '같은 배치에서 같은 행을 두 번 올렸다');
  const q = 대기줄([뷰('S1', '없는강의', '요약')], null, [['L1', '기초', 1, 1, '조사 1강', '', 'Y']]);
  assert.equal(q.length, 1, '카탈로그에 없다고 학생이 쓴 문장을 버렸다');
  assert.equal(q[0].문항, '', '없는 제목을 지어냈다');
});

/* 🔴 이 대기줄은 `hwFeedbackEnsureCols_`(15열 증분) **앞**에서 돈다 — 구 11열 시트를 만나면
 *   12열 요구가 그 자리에서 예외를 던져 첨삭 배치 전체가 죽는다(요약 하나 때문에 숙제 첨삭이 멎는 것). */
test('[v9.198] 구 11열 hw_feedback 을 만나도 배치가 죽지 않는다 — 폭은 물리 열수로 클램프', () => {
  const 좁은 = [['FB1', 'S1', '2026-08-08', '원문', '교정', '', '', '', '노출', '', '']]; // 11열(v9.138 이전)
  const q = 대기줄([뷰('S1', 'L1', '요약')], 좁은, null, 11);
  assert.equal(q.length, 1, 'L열이 없으면 「강의:」 행도 없으니 빈 대조표가 정답이다');
});

test('[v9.198] 배치가 실제로 이 대기줄을 먹고, 숙제 뒤에 붙는다(상한을 요약이 먼저 먹지 않게)', () => {
  const body = section('function aiFeedbackBatch_()', 'function callClaudeFeedback_(');
  assert.ok(body.includes('강의요약대기_(ss, tz)'), '만들어만 두고 아무도 안 부른다(v9.90 ROLE_TALK 사고 계열)');
  // 뒤에 「붙는」 것이 계약이다 — unshift로 바뀌면 소스 순서는 그대로인데 굶는 쪽만 뒤집힌다
  assert.ok(body.includes('Array.prototype.push.apply(q, 강의요약대기_(ss, tz))'),
    '강의요약이 대기줄 앞에 붙으면 AI_FEEDBACK_MAX_PER_RUN을 요약이 먼저 먹어 숙제 첨삭이 굶는다');
  assert.ok(body.indexOf("ss.getSheetByName('숙제폼_응답')") < body.indexOf('강의요약대기_(ss, tz)'),
    '숙제 대기줄을 강의요약보다 나중에 만든다 — 순서가 뒤집힌 자리');
});
