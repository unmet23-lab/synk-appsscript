// tests/마감폼.test.js — [v9.91] 차시 마감폼 회귀 테스트
// 실행: node --test tests/마감폼.test.js  (CI: syntax-check.yml이 tests/*.test.js 전체 구동)
// 방식은 safety.test.js와 동일 — 소스 텍스트 마커 검사(시트·FormApp 의존이라 실행 불가).
//
// 이 테스트가 지키는 것 = 「SYNK LAB 강사 수업 규칙」 v3.0 §6의 계약.
// 강사가 매 차시 30초를 쓰는 입력이라, 여기가 조용히 어긋나면 데이터가 쌓이는 줄 알고 8주가 지난다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');

function bodyOf(startMarker, endMarker) {
  const i = code.indexOf(startMarker);
  assert.notEqual(i, -1, `표식을 찾지 못함: ${startMarker}`);
  const j = code.indexOf(endMarker, i + startMarker.length);
  assert.notEqual(j, -1, `끝 표식을 찾지 못함: ${endMarker}`);
  return code.slice(i, j);
}

/* ── 원천 ↔ 소비처 정합 — 이 팩의 심장 ─────────────────────────
 * 마감폼이 적재하는 열 이름과, 조 편성이 읽는 열 이름이 어긋나면
 * quietScoreMap_은 조용히 빈 맵을 돌려주고 침묵 균형이 통째로 사라진다.
 * 에러도 로그도 없이 "편성은 됐는데 조용한 학생이 한 조에 몰리는" 상태가 된다. */

test('조 편성이 읽는 열 이름이 마감폼이 쓰는 헤더에 실제로 있다', () => {
  const headers = bodyOf("const LESSON_CLOSE_HEADERS = [", "];");
  const reader = bodyOf('function quietScoreMap_', '\n}');
  const m = /head\.indexOf\('([^']+)'\)/.exec(reader);
  assert.ok(m, 'quietScoreMap_이 열을 이름으로 찾지 않는다');
  assert.ok(headers.indexOf(`'${m[1]}'`) > -1,
    `조 편성은 '${m[1]}' 열을 읽는데 LESSON_CLOSE_HEADERS에 그 이름이 없다 — 침묵 점수가 조용히 죽는다`);
});

test('조 편성이 읽는 시트 이름과 마감폼이 쓰는 시트 이름이 같다', () => {
  const reader = bodyOf('function quietScoreMap_', '\n}');
  assert.ok(/getSheetByName\('lesson_close'\)/.test(reader), 'quietScoreMap_이 lesson_close를 보지 않는다');
  const sweep = bodyOf('function sweepLessonCloseForm_', '\n}');
  assert.ok(/ensureSheet\(ss, 'lesson_close', LESSON_CLOSE_HEADERS\)/.test(sweep),
    'sweep이 lesson_close에 적재하지 않는다');
});

test('침묵 점수는 발화가 아니라 미발화를 센다 (의미 반전이 유지되는지)', () => {
  const reader = bodyOf('function quietScoreMap_', '\n}');
  assert.equal(/indexOf\('발화자'\)/.test(reader), false,
    "'발화자' 열을 읽고 있다 — 마감폼은 미발화자를 적재하므로 의미가 뒤집힌다");
});

/* ── 폼 계약 — 항목 수와 sweep 읽기 폭 ──────────────────────── */

test('폼 4문항과 sweep의 5열 읽기가 맞물린다 (타임스탬프 + 4문항)', () => {
  const create = bodyOf('function createLessonCloseForm', '\n}');
  // 강사·반은 로스터 유무에 따라 List/Text 두 갈래로 쓰여 add*Item 호출은 6번 등장한다.
  // 실제 문항 수는 서로 다른 setTitle 제목의 개수다.
  const titles = new Set((create.match(/setTitle\('([^']+)'\)/g) || []));
  assert.equal(titles.size, 4, `폼 문항이 ${titles.size}개(${[...titles].join(',')}) — sweep은 타임스탬프 포함 5열을 읽는다`);
  const sweep = bodyOf('function sweepLessonCloseForm_', '\n}');
  assert.ok(/getRange\(from \+ 1, 1, last - from, 5\)/.test(sweep),
    'sweep이 5열을 읽지 않는다 — 폼 항목 수와 어긋나면 열이 밀린다');
});

test('진도는 완료·이월·미실시 3택이다 (규칙서 §6)', () => {
  const c = bodyOf('const LESSON_PROGRESS', ';');
  ['완료', '이월', '미실시'].forEach((v) => assert.ok(c.indexOf(`'${v}'`) > -1, `진도 선택지에 ${v}가 없다`));
});

test('미발화자 문항은 필수가 아니다 (전원 발화한 정상 차시가 기본값)', () => {
  const create = bodyOf('function createLessonCloseForm', '\n}');
  const line = create.split('\n').filter((l) => l.indexOf('말하지 않은 학생') > -1 && l.indexOf('addTextItem') > -1)[0];
  assert.ok(line, '미발화자 문항이 없다');
  assert.ok(/setRequired\(false\)/.test(line),
    '미발화자를 필수로 두면 전원 발화한 날 강사가 빈칸을 못 넘겨 폼이 막힌다');
});

test('폼은 재실행해도 복제되지 않고 제자리 업그레이드된다 (URL 불변)', () => {
  const create = bodyOf('function createLessonCloseForm', '\n}');
  assert.ok(/const synced = syncLessonCloseForm_\(ss, st\)/.test(create), '동기화 경로가 없다');
  assert.ok(/if \(synced >= 0\)/.test(create),
    '이미 있을 때 조기 반환하지 않는다 — 두 번 누르면 폼이 복제되고 강사 링크가 갈린다');
});

/* ── 배선 ────────────────────────────────────────────────── */

test('lesson_close가 시트 골격에 있고, 상수는 골격보다 앞에 정의된다 (const TDZ)', () => {
  const skeletonAt = code.indexOf('const SHEET_SKELETON = [');
  const body = code.slice(skeletonAt, code.indexOf('\n  ];', skeletonAt));
  assert.ok(/\['lesson_close', LESSON_CLOSE_HEADERS\]/.test(body), 'lesson_close가 시트 골격에 없다');
  const defAt = code.indexOf('const LESSON_CLOSE_HEADERS = [');
  assert.notEqual(defAt, -1, 'LESSON_CLOSE_HEADERS 정의를 찾지 못함');
  assert.ok(defAt < skeletonAt,
    'LESSON_CLOSE_HEADERS가 SHEET_SKELETON보다 뒤에 정의됨 — const TDZ로 스크립트 전체가 죽는다');
});

test('마감 스위프는 10분 틱에 돌고, 수업 전 브리핑보다 먼저다', () => {
  const ps = bodyOf('function parentSweep()', '\n}');
  // 주석에도 함수 이름이 나오므로 반드시 safeRun 호출 형태로 찾는다 — 주석을 잡으면 순서가 뒤집혀 보인다.
  const sweepAt = ps.indexOf("safeRun('sweepLessonCloseForm'");
  const mailAt = ps.indexOf("safeRun('classPrepMail'");
  assert.notEqual(sweepAt, -1, 'parentSweep에 마감 스위프가 없다 — 폼 응답이 영원히 시트로 안 간다');
  assert.ok(sweepAt < mailAt,
    '마감 스위프가 브리핑보다 뒤에 있다 — 같은 틱에 들어온 마감이 다음 수업 조 편성표에 안 실린다');
});

test('마감폼 미생성이 preflight에서 경고된다', () => {
  assert.ok(/\['마감폼URL', 'createLessonCloseForm'/.test(code),
    '폼 감시 큐에 마감폼이 없다 — 안 만들어도 조용히 넘어가고 지표 3개가 빈 채로 개원한다');
});

test('4주차 침묵 명단이 주간 리포트 섹션으로 나간다', () => {
  const wj = bodyOf('function weeklyJobs()', '\n}');
  assert.ok(/silentRosterAlert_/.test(wj), 'weeklyJobs가 4주차 명단을 호출하지 않는다');
  assert.ok(/silText/.test(wj), '결과를 리포트 섹션으로 넘기지 않는다');
});

/* ── 재적재·오경보 방어 ───────────────────────────────────── */

test('포인터는 적재 직후·메일 전에 마감된다 (메일 실패가 같은 응답을 두 번 적재하지 않게)', () => {
  const sweep = bodyOf('function sweepLessonCloseForm_', '\n}');
  const ptrAt = sweep.indexOf("props.setProperty('마감폼_포인터'");
  const mailAt = sweep.indexOf('adminMail');
  assert.notEqual(ptrAt, -1, '포인터를 갱신하지 않는다 — 매 틱마다 전체 응답을 재적재한다');
  assert.ok(ptrAt < mailAt, '포인터가 메일보다 뒤에 있다 — 메일이 실패하면 같은 마감이 중복 적재된다');
});

test('이월 경보 임계는 4회이고 반별로 시즌 1회만 울린다', () => {
  const c = bodyOf('const LESSON_CARRY_LIMIT', ';');
  assert.ok(/= 4/.test(c), '이월 임계가 4가 아니다 (규칙서 「외울 것 2」)');
  const alert = bodyOf('function lessonCarryAlert_', '\n}');
  assert.ok(/cnt\[c\] > LESSON_CARRY_LIMIT/.test(alert), '임계 비교가 상수를 쓰지 않는다');
  assert.ok(/이월경보_/.test(alert) && /setState/.test(alert),
    '반복 발송 방지(app_state dedup)가 없다 — 매 응답마다 같은 경보가 나간다');
});

test('4주차 명단은 4주차에만, 시즌당 한 번만 나간다', () => {
  const s = bodyOf('function silentRosterAlert_', '\n}');
  assert.ok(/week !== 4/.test(s), '4주차 조건이 없다 — 매주 나간다');
  assert.ok(/침묵명단_/.test(s), '시즌 dedup 키가 없다');
  assert.ok(/if \(String\(getState\(st, key\)\.val \|\| ''\)\) return ''/.test(s),
    '이미 보낸 시즌인지 확인하지 않는다');
});

test('이름 매칭 실패는 버리지 않고 sid 공란으로 적재한다 (복구 가능하게)', () => {
  const sweep = bodyOf('function sweepLessonCloseForm_', '\n}');
  assert.ok(/matchStudentsByNameClass_/.test(sweep), '기존 이름 매칭 규칙을 쓰지 않는다');
  assert.ok(/'미매칭'/.test(sweep), '미매칭 표시가 없다 — 나중에 어느 행을 고쳐야 할지 못 찾는다');
  assert.ok(/미발화자이름/.test(code), '원본 이름을 남기지 않으면 매칭 실패 시 복구 불가');
});
