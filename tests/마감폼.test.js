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
/* 부정 단언의 주어만 정제한다 — 주석이 금지 패턴을 «설명»하면 그 설명이 위반으로 잡힌다(대기열 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');
const code = engineSource();

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
  assert.equal(/indexOf\('발화자'\)/.test(코드만(reader)), false,
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

// 2026-08-01 실사고: 첫 실행이 8분 만에 DEADLINE_EXCEEDED. 폼은 이미 생성됐는데 ID 저장이 맨 뒤라
// 앱이 그 폼을 몰랐다 — 재실행하면 폼이 하나 더 생기고 이미 배포한 강사 링크가 죽는다.
test('폼 생성 직후 즉시 ID를 기록한다 (중간에 죽어도 고아가 안 생기게)', () => {
  const create = bodyOf('function createLessonCloseForm', '\n}');
  const createAt = create.indexOf('FormApp.create(');
  const idAt = create.indexOf("setState(st, '마감폼ID'", createAt);
  const destAt = create.indexOf('setDestination(');
  assert.ok(createAt > -1 && idAt > createAt, '폼 생성 후 ID를 저장하지 않는다');
  assert.ok(idAt < destAt,
    'ID 저장이 응답 시트 연결보다 뒤에 있다 — 그 사이에 타임아웃되면 앱이 모르는 고아 폼이 남는다');
});

test('무거운 단계는 이미 끝났으면 건너뛴다 (재실행이 남은 단계만 이어서 한다)', () => {
  const create = bodyOf('function createLessonCloseForm', '\n}');
  assert.ok(/getDestinationId\(\)/.test(create), '응답 시트 연결 여부를 확인하지 않는다 — 매번 다시 연결한다');
  assert.ok(/if \(!form\.getItems\(\)\.length\)/.test(create),
    '문항 존재 여부를 확인하지 않는다 — 재실행 때 문항이 중복 추가되면 sweep 5열 계약이 깨진다');
  assert.ok(/DriveApp\.getFilesByName\(spec\.title\)/.test(create),
    '같은 이름의 고아 폼을 회수하지 않는다 — 직전 실행이 남긴 폼 위에 또 만든다');
});

/* ── 배선 ────────────────────────────────────────────────── */

test('lesson_close가 시트 골격에 있고, 헤더 정본 상수가 실존한다', () => {
  // [v9.135] 골격이 지연 평가 함수로 바뀌어 정의 순서(const TDZ) 제약은 소멸 — 정의 실존만 지킨다.
  const skeletonAt = code.indexOf('function sheetSkeleton_()');
  assert.notEqual(skeletonAt, -1, 'sheetSkeleton_()을 찾지 못함');
  const body = code.slice(skeletonAt, code.indexOf('\n  ];', skeletonAt));
  assert.ok(/\['lesson_close', LESSON_CLOSE_HEADERS\]/.test(body), 'lesson_close가 시트 골격에 없다');
  assert.notEqual(code.indexOf('const LESSON_CLOSE_HEADERS = ['), -1, 'LESSON_CLOSE_HEADERS 정의를 찾지 못함');
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

/* ── 필수화 강제 — 유호 08-01 확정 「마감 30초를 강사 필수 루틴으로」 ────
 * 문서에 "필수"라고 쓰기만 하면 재량과 같다. 안 낸 차시를 앱이 잡아야 필수가 된다. */

test('어제 마감 미제출 반을 아침에 담당 강사에게 알린다', () => {
  const mj = bodyOf('function morningJobs()', '\n}');
  assert.ok(/lessonCloseGapAlert_/.test(mj), 'morningJobs가 미제출을 확인하지 않는다 — 필수가 재량이 된다');
});

test('출석 0건인 반은 휴강으로 보고 미제출로 세지 않는다 (규칙서 §6 정의 재사용)', () => {
  const g = bodyOf('function lessonCloseGapAlert_', '\n}');
  assert.ok(/if \(!Object\.keys\(taught\)\.length\) return ''/.test(g),
    '어제 수업이 아예 없던 날에도 알림이 나간다 — 공휴일마다 오경보');
  assert.ok(/getSheetByName\('attendance'\)/.test(g), '출석 기록으로 수업 여부를 판정하지 않는다');
});

test('일요일은 판정 자체를 열지 않는다 (주말반=토요일만)', () => {
  const g = bodyOf('function lessonCloseGapAlert_', '\n}');
  assert.ok(/classDowOk_\('평일', y\.getDay\(\)\)/.test(g) && /classDowOk_\('주말', y\.getDay\(\)\)/.test(g),
    '요일 판정에 기존 classDowOk_를 쓰지 않는다 — 시간표 규칙과 어긋날 수 있다');
});

test('같은 날 재알림이 나가지 않는다 (하루 1통)', () => {
  const g = bodyOf('function lessonCloseGapAlert_', '\n}');
  assert.ok(/마감미제출_알림/.test(g), 'dedup 키가 없다 — 아침 배치가 두 번 돌면 두 번 간다');
  const guardAt = g.indexOf("getState(st, '마감미제출_알림')");
  const mailAt = g.indexOf('MailApp.sendEmail');
  assert.ok(guardAt > -1 && guardAt < mailAt, 'dedup 확인이 발송보다 뒤에 있다');
});

test('전 반이 제출한 날에도 dedup 키를 찍는다 (다음 배치가 다시 훑지 않게)', () => {
  const g = bodyOf('function lessonCloseGapAlert_', '\n}');
  assert.ok(/if \(!gaps\.length\) \{ setState\(st, '마감미제출_알림', yStr\); return ''/.test(g),
    '미제출 0건일 때 키를 안 찍으면 같은 날 배치마다 전 시트를 다시 스캔한다');
});

test('시즌 마감 제출률이 주간 리포트에 실린다 (필수 준수의 유일한 계측치)', () => {
  const wj = bodyOf('function weeklyJobs()', '\n}');
  assert.ok(/lessonCloseRate_/.test(wj), '주간 리포트에 제출률 섹션이 없다');
  const rate = bodyOf('function lessonCloseRate_', '\n}');
  assert.ok(/taught\[/.test(rate) && /closed\[/.test(rate),
    '분모를 출석이 있었던 차시로 잡지 않는다 — 반마다 분모가 달라져 등급 심사에 못 쓴다');
});

test('이름 매칭 실패는 버리지 않고 sid 공란으로 적재한다 (복구 가능하게)', () => {
  const sweep = bodyOf('function sweepLessonCloseForm_', '\n}');
  assert.ok(/matchStudentsByNameClass_/.test(sweep), '기존 이름 매칭 규칙을 쓰지 않는다');
  assert.ok(/'미매칭'/.test(sweep), '미매칭 표시가 없다 — 나중에 어느 행을 고쳐야 할지 못 찾는다');
  assert.ok(/미발화자이름/.test(code), '원본 이름을 남기지 않으면 매칭 실패 시 복구 불가');
});
