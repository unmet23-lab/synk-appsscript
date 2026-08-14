/* [v9.95] 반 편성 회귀 테스트 — 반 수·정원·좌석 합계가 정본과 어긋나면 여기서 잡힌다.
 *
 * 왜 이 파일이 필요한가: 2026-08-01에 급여 인센티브 정본 v1.1(전 반 16석 균일)과 코드가
 *   벌어져 있는 것이 발견됐다. 코드는 정규반 20명 4반 + 집중반 10명 6반(220석)을 만들고 있었고,
 *   그 어긋남을 아무도 몰랐다 — **좌석 합계를 세는 장치가 어디에도 없었기 때문이다.**
 *   숫자가 문서에만 살아 있으면 다음 개정 때 또 벌어진다. 그래서 좌석을 코드가 스스로 세게 한다.
 *
 * 이 파일이 지키는 계약 4가지:
 *   ① 반 수 = 슬롯 수 × 실 수  ② 전 반 정원 동일  ③ 좌석 = 반 수 × 정원
 *   ④ 반 이름은 전부 고유하고, 4실을 열어도 3실 시절 이름이 하나도 안 바뀐다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');
const code = engineSource();
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다. `section()` 은 앵커를 원문에서 찾아야 하므로 정제하지 않는다. (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');

function section(startMarker, endMarker) {
  const start = code.indexOf(startMarker);
  assert.notEqual(start, -1, `시작 표식을 찾지 못함: ${startMarker}`);
  const end = code.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `끝 표식을 찾지 못함: ${endMarker}`);
  return code.slice(start, end);
}

// 상수 + 생성기를 Code.js에서 그대로 떼어와 실행한다(값을 테스트에 베끼면 드리프트가 다시 생긴다).
const schedSrc = section("const SCHEDULE_HEADERS =", 'function classNumOf(');
const sandbox = new Function(`${schedSrc}
  return { SCHEDULE_HEADERS, CLASS_CAP_DEFAULT, CORE_ROOMS_DEFAULT, ROOM_LETTERS, CORE_SLOTS, buildCoreSchedule_ };`)();
const { SCHEDULE_HEADERS, CLASS_CAP_DEFAULT, CORE_ROOMS_DEFAULT, ROOM_LETTERS, CORE_SLOTS, buildCoreSchedule_ } = sandbox;

/* ── ① 급여 인센티브 정본 v1.1 §1과의 대조 ────────────────────── */

test('[v9.102] 기준선 = 4실 24반 · 전 반 16명 · 384석 (유호 08-01 4실 확정)', () => {
  const rows = buildCoreSchedule_();                       // 인자 생략 = 확정 기준선
  assert.equal(rows.length, 24, '기준선 반 수가 24반이 아니다');
  assert.equal(CORE_ROOMS_DEFAULT, 4, '기본값이 4실이 아니다 — 08-01 3실 폐기 확정');
  assert.equal(CLASS_CAP_DEFAULT, 16, '전 반 정원이 16명이 아니다(급여 정본 §1)');

  const seats = rows.reduce((s, r) => s + Number(r[3]), 0);
  assert.equal(seats, 384, `좌석 합계가 384석이 아니다(실측 ${seats}석)`);

  const weekday = rows.filter((r) => r[1] === '평일');
  const weekend = rows.filter((r) => r[1] === '주말');
  assert.equal(weekday.length, 16, '평일 코어가 16반이 아니다');
  assert.equal(weekend.length, 8, '주말 코어가 8반이 아니다');
  assert.equal(weekday.reduce((s, r) => s + Number(r[3]), 0), 256, '평일 좌석이 256석이 아니다');
  assert.equal(weekend.reduce((s, r) => s + Number(r[3]), 0), 128, '주말 좌석이 128석이 아니다');
});

test('[v9.102] 램프업은 인자로 남아 있다 — 2실 192석 · 3실 288석', () => {
  // 개원 초 좌석이 남으면 작은 수로 열고 채워지면 재실행한다(표시명은 보존되므로 이름이 안 날아간다)
  assert.equal(buildCoreSchedule_(2).reduce((s, r) => s + Number(r[3]), 0), 192, '2실 좌석이 192석이 아니다');
  assert.equal(buildCoreSchedule_(3).reduce((s, r) => s + Number(r[3]), 0), 288, '3실 좌석이 288석이 아니다');
  assert.equal(buildCoreSchedule_(2).length, 12, '2실 반 수가 12반이 아니다');
  assert.equal(buildCoreSchedule_(3).length, 18, '3실 반 수가 18반이 아니다');
});

test('[v9.95] 반 수 = 슬롯 수 × 실 수 (표를 늘려도 산수가 깨지지 않는다)', () => {
  [1, 2, 3, 4].forEach((n) => {
    assert.equal(buildCoreSchedule_(n).length, CORE_SLOTS.length * n, `${n}실 반 수가 슬롯×실과 다르다`);
  });
  // 범위 밖 입력은 조용히 잘린다 — 5실짜리 시간표가 실수로 생성되지 않게
  assert.equal(buildCoreSchedule_(9).length, CORE_SLOTS.length * ROOM_LETTERS.length, '실 수 상한이 안 걸린다');
  assert.equal(buildCoreSchedule_(0).length, CORE_SLOTS.length * CORE_ROOMS_DEFAULT, '0·공백 입력이 기본값으로 안 떨어진다');
});

/* ── ② 이름 체계 계약 ──────────────────────────────────────── */

test('[v9.95] 반 이름은 전부 고유하고, 4실을 열어도 3실 이름이 하나도 안 바뀐다', () => {
  const three = buildCoreSchedule_(3).map((r) => r[0]);
  const four = buildCoreSchedule_(4).map((r) => r[0]);
  assert.equal(new Set(three).size, three.length, '3실 반 이름에 중복이 있다');
  assert.equal(new Set(four).size, four.length, '4실 반 이름에 중복이 있다');
  // 확장이 기존 학생의 반 이름을 건드리면 상담시트·profiles·과거 기록이 전부 어긋난다
  three.forEach((nm) => assert.ok(four.includes(nm), `4실 개방이 기존 반 이름을 바꿨다: ${nm}`));
  assert.deepEqual(four.filter((nm) => !three.includes(nm)).map((nm) => nm.slice(-1)),
    Array(CORE_SLOTS.length).fill('D'), '4실에서 늘어난 반이 D실이 아니다');
});

test('[v9.95] 코어 슬롯은 11·14·15:30·18시 + 토 11·14시이고, 시각 단일 소스는 시작시간 열이다', () => {
  const wd = CORE_SLOTS.filter((s) => s.type === '평일').map((s) => s.time);
  const we = CORE_SLOTS.filter((s) => s.type === '주말').map((s) => s.time);
  assert.deepEqual(wd, ['11:00', '14:00', '15:30', '18:00'], '평일 코어 슬롯이 정본과 다르다');
  assert.deepEqual(we, ['11:00', '14:00'], '주말 코어 슬롯이 정본과 다르다');

  // 이름의 '15'는 라벨일 뿐 — 실제 시각 15:30은 C열이 들고 있어야 한다(15:00으로 오독되면 미등원 판정이 30분 어긋난다)
  const row = buildCoreSchedule_(3).find((r) => r[0] === '평일15A');
  assert.ok(row, '평일15A가 없다');
  assert.equal(row[2], '15:30', '평일15A의 시작시간이 15:30이 아니다');

  // 태그가 겹치면 이름이 충돌한다 — 분을 떼도 안전한지를 기계로 확인
  const tags = CORE_SLOTS.filter((s) => s.type === '평일').map((s) => s.tag);
  assert.equal(new Set(tags).size, tags.length, '평일 슬롯 태그가 중복이다(이름 충돌)');
});

test('[v9.95] 표시명은 키와 분리돼 있고, 개원 기본값은 시각이다', () => {
  assert.deepEqual(SCHEDULE_HEADERS, ['반', '요일유형', '시작시간', '정원', '표시명'],
    'schedule 헤더가 정본과 다르다');
  const rows = buildCoreSchedule_(3);
  const byName = Object.fromEntries(rows.map((r) => [r[0], r]));
  assert.equal(byName['평일11A'][4], '11시 A');
  assert.equal(byName['평일15C'][4], '3시반 C');
  assert.equal(byName['주말14B'][4], '토요일 2시 B');
  // 키와 표시명이 같아지면 분리한 의미가 사라진다(이름을 바꾸는 순간 키가 따라 움직인다)
  rows.forEach((r) => assert.notEqual(r[0], r[4], `키와 표시명이 같다: ${r[0]}`));
});

/* ── ③ 구 v8.3 이름 판정이 되살아나지 않는다 ───────────────────── */

test('[v9.95] 정원은 이름이 아니라 시트가 정한다 — 구 v8.3 이름 판정 잔존 0', () => {
  const raid = section('const smR = scheduleMap(ss);', 'const lg = ensureSheet(ss, \'league_pairs\'');
  /* 부정 단언의 주어만 정제한다 — 「구 v8.3 이름 판정을 쓰지 않는다」를 **설명하는 주석**이 그대로
   *   위반으로 잡히는 자리다(검사는 가장 잘 적어 둔 파일에서 깨진다). 아래 긍정 단언은 원문 그대로. */
  const raid코드 = 코드만(raid);
  assert.equal(/indexOf\('집중반'\)/.test(raid코드), false, "보스 HP가 아직 '집중반' 이름으로 정원을 판정한다");
  assert.equal(/indexOf\('주말정규반'\)/.test(raid코드), false, "보스 HP가 아직 '주말정규반' 이름으로 정원을 판정한다");
  assert.equal(/Number\(num\)\s*<=\s*4\s*\?\s*20/.test(raid코드), false, "보스 HP가 아직 '번호 ≤4면 20명' 추측을 쓴다");
  assert.ok(raid.includes('eS ? eS.cap'), '보스 HP가 schedule 시트의 정원을 안 읽는다');

  // scheduleMap이 정원·표시명을 실어 나르는 단일 소스여야 한다
  const smap = section('function scheduleMap(ss)', 'function schedOf(');
  assert.ok(smap.includes('cap:'), 'scheduleMap이 정원을 안 싣는다');
  assert.ok(smap.includes('disp:'), 'scheduleMap이 표시명을 안 싣는다');
  assert.ok(smap.includes('CLASS_CAP_DEFAULT'), '정원 없는 구 3열 시트의 폴백이 없다');
  assert.ok(smap.includes('sc.getLastColumn()'), '읽기 폭이 3열로 고정돼 있어 정원·표시명이 안 읽힌다');
});

test('[v9.95] 보스 HP = 정원 × 계수 — 16명이면 평일 448 · 주말 128', () => {
  const per = new Function(`${section('const RAID_HP_PER =', 'const WORLD_HP_PER')}\nreturn RAID_HP_PER;`)();
  assert.equal(CLASS_CAP_DEFAULT * per.평일, 448, '평일 보스 HP가 448이 아니다');
  assert.equal(CLASS_CAP_DEFAULT * per.주말, 128, '주말 보스 HP가 128이 아니다');
  // 계수는 1인당 주간 획득량에서 나온 값이라 정원이 바뀌어도 안 움직인다(v9.83 산정 근거)
  assert.equal(per.평일, 28, 'RAID_HP_PER.평일이 바뀌었다 — 정원 변경으로 계수를 건드리면 안 된다');
  assert.equal(per.주말, 8, 'RAID_HP_PER.주말이 바뀌었다 — 정원 변경으로 계수를 건드리면 안 된다');
});

/* ── ④ 표시명 보존 — 되돌릴 수 없는 사고의 기계 차단 ──────────────── */

test('[v9.95] setupSchedule 재실행이 각 반이 지은 표시명을 지우지 않는다', () => {
  const body = section('function setupSchedule(rooms)', '/* ===================== [v9.89]');
  // 순서가 핵심: 지우기(clear) 전에 옛 표시명을 읽어둬야 한다
  const readAt = body.indexOf('prev[nm] = disp');
  const clearAt = body.indexOf('sc.clear()');
  assert.ok(readAt > -1, '표시명 보존 로직이 없다 — 재실행 한 번에 전 반 이름이 사라진다');
  assert.ok(clearAt > -1, 'sc.clear()를 찾지 못함');
  assert.ok(readAt < clearAt, '표시명을 clear() 뒤에 읽는다 — 항상 빈 값만 읽힌다');
  assert.ok(body.includes('if (prev[r[0]])'), '옛 표시명을 새 행에 물려주지 않는다');
  // 구 3열 시트에서 읽으면 r[4]가 undefined다 — 폭 가드가 없으면 조용히 깨진다
  assert.ok(body.includes('w >= 5'), '구 3열 시트에 대한 폭 가드가 없다');
});

test('[v9.95] 4실 개방은 표시명을 물려받는다 (3실 이름이 D 추가로 안 날아간다)', () => {
  // buildCoreSchedule_ + setupSchedule의 보존 규칙을 합쳐 재현: 반명이 같으면 옛 표시명이 이긴다
  const prev = { '평일11A': '알탄가다스 크루', '주말14C': '놈솜 크루' };
  const rows = buildCoreSchedule_(4);
  rows.forEach((r) => { if (prev[r[0]]) r[4] = prev[r[0]]; });
  const byName = Object.fromEntries(rows.map((r) => [r[0], r]));
  assert.equal(byName['평일11A'][4], '알탄가다스 크루', '4실 개방이 기존 표시명을 덮어썼다');
  assert.equal(byName['주말14C'][4], '놈솜 크루', '4실 개방이 기존 표시명을 덮어썼다');
  assert.equal(byName['평일11D'][4], '11시 D', '새로 열린 반이 기본 표시명을 못 받았다');
});

/* ── ⑤ 반 수 변화에 하위 시스템이 견딘다 ────────────────────────── */

test('[v9.95] 리그 짝짓기가 18반(짝수)·홀수 반 수 모두에서 안 깨진다', () => {
  const body = section("const lg = ensureSheet(ss, 'league_pairs'", 'function leagueSettle_');
  assert.ok(/i \+ 1 < roster\.length/.test(body), '짝짓기 루프가 마지막 홀수 반에서 undefined를 짝으로 잡는다');
  // 반 수는 어디에도 하드코딩돼 있으면 안 된다(16반 전제가 남아 있으면 18반에서 2반이 조용히 빠진다)
  assert.equal(/roster\.slice\(0,\s*\d+\)/.test(코드만(body)), false, '리그 로스터에 반 수 상한이 박혀 있다');
});
