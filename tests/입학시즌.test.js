'use strict';
/**
 * 🎓 입학 시즌 칸 — 「이 학생은 몇 기인가」가 정직하게, 한 번만, 이름으로 적히는가 (09-07 · 브랜드 v2 ㉢-1 · 트랙 §0-명품 1번)
 *
 * ■ 이 시험이 재는 것
 *   ① 값 규칙(입학시즌값_) — 이미 적힌 값은 절대 안 덮는다(선점) · 반이 없으면 빈칸 · 조 편성 첫 시즌이 오늘의 후보보다 앞선다 ·
 *      빈칸에 「미정」 같은 낱말을 채우지 않는다.
 *   ② 시즌 후보(시즌후보_) — 다가오는 시즌도 후보다(1기는 시작 «전» 11월에 반배정이 난다) · 끝난 시즌은 후보가 아니다.
 *   ③ 조 편성 첫 시즌(조편성첫시즌맵_) — 가장 이른 키 · Date 로 삼켜진 셀도 같은 글자 · 시연 행과 깨진 키는 안 센다.
 *   ④ 배선 — 자리를 **이름으로** 찾고(profilesBlockAt_) 점거 가드(profilesBlockWrite_)를 지나며, 서식을 쓰기 «앞»에 텍스트로 굳히고,
 *      기존 값은 행 삭제 «앞»에 걷는다. 고정 열 번호를 되살리지 않는다(열 충돌 3회의 회귀 장치와 같은 결).
 *   ⑤ 읽는 자리(입학시즌명단글_) — 빈칸(모른다)이 한 묶음으로 «보인다» · 시연 행·비학생은 안 센다 · 메뉴가 그 함수를 부른다.
 *
 * ■ 왜 소스 모양까지 재나 — 이 칸은 소급 불가다(1기 첫 수업 12-05 뒤에는 복원 못 한다). 값 규칙이 맞아도 배선이 어긋나면
 *   (번호로 박거나 · 서식을 뒤에 굳히거나 · 기존 값을 행 삭제 뒤에 읽거나) 아침마다 조용히 틀린 값이 쌓이고 증상이 없다.
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

/* yyyy-MM-dd — 시험은 한 시간대에서만 돌고 Date 는 전부 로컬 자정으로 만드니 로컬 게터로 족하다(엔진은 Utilities 를 쓴다). */
const ymd = (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
const Utilities = { formatDate: (d, tz, fmt) => { assert.equal(fmt, 'yyyy-MM-dd', '시즌 키 서식이 yyyy-MM-dd 가 아니다'); return ymd(d); } };
const Session = { getScriptTimeZone: () => 'Asia/Ulaanbaatar' };

/* 순수 함수 넷 + 시즌 키 접기(seasonKeyOf_ · 셋업확장)를 한 자리에서 태운다 — 갈라 태우면 「키를 접는 자가 바뀌었는데 입학 쪽만 옛 꼴」을 못 본다. */
const 절 = section('function 시즌후보_(', 'function 입학시즌명단_(') + section('function 입학시즌명단글_(', '/* [함께한날 막1] 퇴소 스냅샷의 승계 열 목록');
const 키절 = section('function seasonKeyOf_(', 'function seasonLabelOf_(');
const E = new Function('Utilities', 'Session',
  `${키절}\n${절}\nreturn { 시즌후보_, 조편성첫시즌맵_, 입학시즌값_, 입학시즌명단글_, seasonKeyOf_ };`)(Utilities, Session);

const D = (y, m, d) => new Date(y, m - 1, d);
const TZ = 'Asia/Ulaanbaatar';

/* ───────────────────── ① 값 규칙 ───────────────────── */
test('[입학시즌] 이미 적힌 값은 절대 안 덮는다 — 조 편성·후보가 달라도 기존이 이긴다(선점 · 손으로 고친 값 보호)', () => {
  assert.equal(E.입학시즌값_('2026-11-30', '11A', '2027-02-25', '2027-02-25'), '2026-11-30');
  assert.equal(E.입학시즌값_(' 2026-11-30 ', '', '', ''), '2026-11-30', '기존 값은 반이 비어도 지킨다(퇴소 뒤 반이 비는 날이 있다)');
});

test('[입학시즌] 반배정 «전»은 빈칸이다 — 아직 입학이 아니다', () => {
  assert.equal(E.입학시즌값_('', '', '2026-11-30', '2026-11-30'), '');
  assert.equal(E.입학시즌값_('', '   ', '2026-11-30', '2026-11-30'), '');
});

test('[입학시즌] 조 편성의 첫 시즌이 오늘의 후보보다 앞선다 — 편성 행이 가장 정확한 증거다', () => {
  assert.equal(E.입학시즌값_('', '11A', '2026-11-30', '2027-02-25'), '2026-11-30');
});

test('[입학시즌] 편성이 없으면 오늘의 시즌 후보 · 후보도 없으면 빈칸 — 「미정」 같은 낱말을 채우지 않는다', () => {
  assert.equal(E.입학시즌값_('', '11A', '', '2026-11-30'), '2026-11-30');
  assert.equal(E.입학시즌값_('', '11A', '', ''), '');
  assert.equal(E.입학시즌값_(null, '11A', undefined, null), '');
  const 본문 = section('function 입학시즌값_(', 'function 입학시즌명단_(');
  assert.ok(!/미정|unknown|없음/.test(본문), '입학시즌값_ 이 빈칸에 낱말을 채운다 — 빈칸은 «모른다»여야 한다');
});

/* ───────────────────── ② 시즌 후보 ───────────────────── */
test('[입학시즌] 다가오는 시즌도 후보다 — 1기는 시작(11-30) «전» 11월에 반배정이 나고 11-27 에 잰다', () => {
  assert.equal(E.시즌후보_(D(2026, 11, 30), D(2026, 11, 10), 8, TZ), '2026-11-30');
  assert.equal(E.시즌후보_(D(2026, 11, 30), D(2026, 11, 27), 8, TZ), '2026-11-30');
});

test('[입학시즌] 도는 시즌은 후보다 · 끝난 시즌은 후보가 아니다(8주 = 56일째부터 빈칸)', () => {
  assert.equal(E.시즌후보_(D(2026, 11, 30), D(2026, 12, 20), 8, TZ), '2026-11-30');
  assert.equal(E.시즌후보_(D(2026, 11, 30), D(2027, 1, 24), 8, TZ), '2026-11-30', '마지막 날(01-24)까지는 그 시즌이다');
  assert.equal(E.시즌후보_(D(2026, 11, 30), D(2027, 1, 25), 8, TZ), '', '56일째(01-25)부터는 끝난 시즌 — 다음 시작일을 박기 전엔 빈칸');
});

test('[입학시즌] 시작일이 없거나 깨졌으면 후보가 없다 — 지어내지 않는다', () => {
  assert.equal(E.시즌후보_(null, D(2026, 11, 10), 8, TZ), '');
  assert.equal(E.시즌후보_(new Date('x'), D(2026, 11, 10), 8, TZ), '');
  assert.equal(E.시즌후보_(D(2026, 11, 30), null, 8, TZ), '');
});

/* ───────────────────── ③ 조 편성 첫 시즌 ───────────────────── */
test('[입학시즌] 조 편성에서 학생마다 «가장 이른» 시즌을 고른다 · Date 로 삼켜진 셀도 같은 글자다', () => {
  const rows = [
    ['2027-02-25', '11A', 'S1'],
    ['2026-11-30', '11A', 'S1'],
    [D(2026, 11, 30), '11A', 'S2'],          // 시트가 날짜로 삼킨 옛 행(v9.132 의 그 오염)
    ['garbage', '11A', 'S3'],                // 깨진 키 — 안 센다
    ['2026-11-30', '11A', 'DEMO-9'],         // 시연 행 — 안 센다
    ['2026-11-30', '11A', ''],               // 학생 번호 없음
  ];
  assert.deepEqual(E.조편성첫시즌맵_(rows, TZ), { S1: '2026-11-30', S2: '2026-11-30' });
  assert.deepEqual(E.조편성첫시즌맵_([], TZ), {});
  assert.deepEqual(E.조편성첫시즌맵_(null, TZ), {});
});

/* ───────────────────── ④ 배선 ───────────────────── */
test('[입학시즌] 헤더는 상수 하나(ENTRY_SEASON_HEADS_)이고 칸은 「입학시즌」 하나다', () => {
  const m = code.match(/const ENTRY_SEASON_HEADS_ = \[([^\]]*)\];/);
  assert.ok(m, 'ENTRY_SEASON_HEADS_ 가 없다');
  assert.deepEqual(m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean), ['입학시즌']);
});

test('[입학시즌] 자리는 «이름»으로 찾고 점거 가드를 지난다 — 고정 열 번호를 되살리지 않는다', () => {
  const sync = section('function syncProfiles()', 'function 명부스윕_()');
  assert.ok(sync.includes('profilesBlockAt_(dst, ENTRY_SEASON_HEADS_)'), '입학시즌 칸이 profilesBlockAt_ 를 안 쓴다 — 번호로 박으면 라이브의 남의 열을 덮는다');
  assert.ok(sync.includes('profilesBlockWrite_(dst, 입학열, ENTRY_SEASON_HEADS_'), '점거 가드(profilesBlockWrite_)를 안 지난다');
  assert.ok(!/ENTRY_SEASON_COL\w*\s*=\s*\d/.test(code), '입학시즌 칸에 고정 열 번호가 생겼다');
  assert.ok(sync.includes("'입학시즌열충돌'"), '충돌 보류 상태 키가 없다 — 남의 헤더를 만나면 덮지 않고 멈춰야 한다');
});

test('[입학시즌] 서식을 쓰기 «앞»에 텍스트(@)로 굳힌다 — 뒤에 굳히면 이미 날짜로 삼켜진 뒤다(groups A열 v9.132 순서)', () => {
  const sync = section('function syncProfiles()', 'function 명부스윕_()');
  const iFmt = sync.indexOf("dst.getRange(1, 입학열, dst.getMaxRows(), 1).setNumberFormat('@')");
  const iWrite = sync.indexOf('profilesBlockWrite_(dst, 입학열, ENTRY_SEASON_HEADS_');
  assert.ok(iFmt > -1, '입학시즌 열을 텍스트 서식으로 굳히는 줄이 없다');
  assert.ok(iFmt < iWrite, '서식 굳히기가 쓰기 «뒤»에 있다 — 첫 쓰기의 값이 날짜로 삼켜진다');
  assert.ok(sync.indexOf('insertColumnsAfter(dst.getMaxColumns(), 입학열 - dst.getMaxColumns())') < iFmt,
    '열을 늘리기 전에 서식을 굳히면 없는 열에 서식을 건다');
});

test('[입학시즌] 기존 값은 행 삭제 «앞»에 걷는다 — 뒤에 읽으면 밀린 행의 값이 남의 학생에게 붙는다(v9.34 의 그 사고)', () => {
  const sync = section('function syncProfiles()', 'function 명부스윕_()');
  const iRead = sync.indexOf('const 입학열0 = profilesBlockAt_(dst, ENTRY_SEASON_HEADS_)');
  const iDel = sync.indexOf('.forEach(rn => dst.deleteRow(rn))');
  assert.ok(iRead > -1 && iDel > -1, '읽는 줄·지우는 줄 표식을 못 찾았다');
  assert.ok(iRead < iDel, '입학시즌 기존 값을 행 삭제 뒤에 읽는다');
  assert.ok(sync.includes('seasonKeyOf_(v[0], tz0)'), '기존 값을 seasonKeyOf_ 로 안 접는다 — Date 로 삼켜진 값이 String(Date) 로 굳는다');
  assert.ok(sync.includes('입학시즌값_(입학맵[e.id] || \'\', e.main[4], 첫시즌[e.id] || \'\', 후보)'),
    '값 규칙이 입학시즌값_ 하나를 안 지난다 — 규칙이 두 곳에 살면 갈린다');
});

/* ───────────────────── ⑤ 읽는 자리 ───────────────────── */
test('[입학시즌] 명단은 시즌 키로 묶고 빈칸(모른다)도 한 묶음으로 «보인다» · 시연 행·비학생은 안 센다', () => {
  //            A id    B 이름   C      D role     E 반    … 뒤쪽 어딘가에 입학시즌(여기선 6번째 칸 = index 5)
  const rows = [
    ['S1', '바트', '', 'student', '11A', '2026-11-30'],
    ['S2', '사라', '', 'student', '11A', D(2026, 11, 30)],   // 날짜로 삼켜진 셀 — 같은 묶음이어야 한다
    ['S3', '난딩', '', 'student', '', ''],                    // 반배정 전 — 빈칸 묶음
    ['DEMO-1', '시연', '', 'student', '11A', '2026-11-30'],
    ['T1', '선생', '', 'teacher', '', '2026-11-30'],
    ['', '', '', '', '', ''],
  ];
  const t = E.입학시즌명단글_(rows, 5, TZ);
  assert.ok(t.includes('학생 3명'), '학생 수가 3이 아니다(시연·비학생을 셌다): ' + t.split('\n')[0]);
  assert.ok(t.includes('■ 2026-11-30 — 2명'), '2026-11-30 묶음이 2명이 아니다');
  assert.ok(t.includes('■ (빈칸 · 모른다) — 1명'), '빈칸 묶음이 안 보인다 — 안 보이면 아무도 안 채운다');
  assert.ok(t.includes('· 난딩'), '빈칸 묶음의 학생 이름이 없다');
  assert.ok(!t.includes('시연') && !t.includes('선생'), '시연 행이나 비학생이 명단에 실렸다');
});

test('[입학시즌] 칸이 아직 없을 때(col = -1)도 죽지 않고 «칸이 없다»를 말한다 — 개원 전 첫 아침의 모습', () => {
  const t = E.입학시즌명단글_([['S1', '바트', '', 'student', '11A']], -1, TZ);
  assert.ok(t.includes('「입학시즌」 칸이 아직 없다'), '칸 부재를 말하지 않는다');
  assert.ok(t.includes('■ (빈칸 · 모른다) — 1명'));
});

test('[입학시즌] 원장 메뉴가 명단 함수를 부른다 — 「1기만 보여 줘」가 클릭 하나로 된다', () => {
  assert.ok(code.includes("'menuEntrySeasonRoster'"), '점검·진단 메뉴에 입학 시즌 명단 항목이 없다');
  assert.ok(/function menuEntrySeasonRoster\(\)\s*\{\s*menuRun_\(입학시즌명단_\);/.test(code), 'menuEntrySeasonRoster 가 입학시즌명단_ 을 menuRun_ 으로 안 부른다');
});
