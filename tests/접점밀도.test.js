'use strict';
/**
 * 🧭 접점 밀도 — 최저점이 원장 앞줄에 «늘» 서는가 (09-07 · 브랜드 v2 ㉠-3 · 눈금 v1 Ⅱ · 트랙 §0-명품 4번)
 *
 * ■ 이 시험이 재는 것
 *   ① 자(접점최저_) — 평균이 아니라 **가장 낮은 값**이 점수다 · 같은 최저는 이름을 전부 단다 · 빈 점수는 «미판정»이라 0 으로 세고 이름을 단다
 *      (모른다를 좋은 값으로 접지 않는다).
 *   ② 씨앗(접점열둘_) — 눈금 v1 4-1 표 열둘이 그대로다 · 09-07 의 최저는 8번 「첫 5분」 0 점(유호 자리). 씨앗은 역사라 안 낡는다.
 *   ③ 표(접점표_) — 빈 시트에만 씨앗을 깐다(있는 값은 코드가 안 덮는다) · 칸 이름은 골격 한 곳에서 온다.
 *   ④ 배선 — 원장 오늘판 **첫 줄**이고 실패해도 줄이 선다 · 주간 리포트에도 값이 없든 있든 줄이 선다(눈금 §⑦ 함정 하나).
 *
 * ■ 왜 소스 모양까지 재나 — 심문 두 집안이 나란히 짚은 자리다(「그렇게 묶어 두면 개원까지 아무도 그 0 점을 안 고친다」).
 *   자가 맞아도 줄이 둘째 줄로 밀리거나 값이 없을 때 생략되면, 0 점은 다시 배경이 된다.
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

const 절 = section("const TOUCHPOINT_TAB_ = '접점밀도';", 'function todayBoard_(ss) {');
const HEADERS = ['#', '접점', '점수', '근거', '정본', '판정일', '판정자'];

/** 순수 함수 + 시트 함수를 가짜 의존으로 태운다 — ensureSheet · Utilities · sheetSkeleton_ 만 흉내낸다. */
function 엔진(sheetState) {
  const calls = { setValues: [] };
  const sh = {
    rows: sheetState.rows || [],
    getLastRow() { return this.rows.length + 1; },
    getRange(r, c, n, w) {
      const self = this;
      return {
        setValues(v) { calls.setValues.push({ r, c, n, w, v }); self.rows = self.rows.concat(v); },
        getValues() { return self.rows.slice(r - 2, r - 2 + n).map(row => row.slice(c - 1, c - 1 + w)); },
      };
    },
  };
  const ss = { getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' };
  const ensureSheet = (s, name, headers) => { calls.ensure = { name, headers }; return sh; };
  const Utilities = { formatDate: () => '2026-09-07' };
  const sheetSkeleton_ = () => [['today_board', ['유형']], ['접점밀도', HEADERS.slice()]];
  const E = new Function('ensureSheet', 'Utilities', 'sheetSkeleton_',
    `${절}\nreturn { 접점열둘_, 접점헤더_, 접점점수_, 접점최저_, 접점한줄_, 접점표_, 접점보드줄_, TOUCHPOINT_BOARD_TYPE_ };`)(ensureSheet, Utilities, sheetSkeleton_);
  return { E, ss, sh, calls };
}

/* ───────────────────── ① 자 ───────────────────── */
test('[접점밀도] 점수 칸 읽기 — 0~3 정수만 값이고, 손글씨(「3점」·공백)는 받되 4·음수·글자·빈칸은 «미판정»(null)이다', () => {
  const { E } = 엔진({});
  assert.equal(E.접점점수_(3), 3);
  assert.equal(E.접점점수_('2점'), 2);
  assert.equal(E.접점점수_(' 1 '), 1);
  assert.equal(E.접점점수_('0'), 0);
  assert.equal(E.접점점수_(''), null);
  assert.equal(E.접점점수_(null), null);
  assert.equal(E.접점점수_('4'), null, '4 는 눈금 밖이다 — 좋은 값으로 접지 않는다');
  assert.equal(E.접점점수_(-1), null);
  assert.equal(E.접점점수_('보통'), null);
});

test('[접점밀도] 최저점 방식 — 평균이 아니라 가장 낮은 값이 점수이고, 같은 최저는 이름을 전부 단다', () => {
  const { E } = 엔진({});
  const r = E.접점최저_([[1, '앱 화면', 3], [2, '첫 5분', 0], [3, '홈페이지', 0], [4, '리포트', 2]]);
  assert.equal(r.점수, 0);
  assert.deepEqual(r.이름들, ['첫 5분', '홈페이지']);
  assert.equal(r.전체, 4);
  assert.deepEqual(r.미판정, []);
  const 평균이면 = (3 + 0 + 0 + 2) / 4;
  assert.notEqual(r.점수, 평균이면, '평균을 내면 0 점이 사라진다 — 눈금 v1 4-3 「평균 내지 않는다」');
});

test('[접점밀도] 빈 점수는 «미판정» — 0 으로 세고 이름을 단다(모른다를 좋은 값으로 접지 않는다) · 이름 없는 행은 안 센다', () => {
  const { E } = 엔진({});
  const r = E.접점최저_([[1, '앱 화면', 3], [2, '강사', ''], [3, '', 0], [4, '위기의 말', '아직']]);
  assert.equal(r.점수, 0);
  assert.deepEqual(r.이름들, ['강사', '위기의 말']);
  assert.deepEqual(r.미판정, ['강사', '위기의 말']);
  assert.equal(r.전체, 3, '접점 이름이 빈 행은 분모에서 뺀다');
  const 빈표 = E.접점최저_([]);
  assert.equal(빈표.점수, null);
  assert.equal(빈표.전체, 0);
});

test('[접점밀도] 원장이 읽는 한 줄 — 점수와 그 점수를 만든 접점 이름이 같이 있고, 표가 비어도 빈 줄이 아니다', () => {
  const { E } = 엔진({});
  const 줄 = E.접점한줄_(E.접점최저_([[1, '앱 화면', 3], [8, '첫 5분 — 가격·주소·체험 절차', 0]]));
  assert.ok(/0점/.test(줄), '점수가 줄에 있어야 한다: ' + 줄);
  assert.ok(줄.indexOf('첫 5분 — 가격·주소·체험 절차') > -1, '그 점수를 만든 접점 이름이 줄에 있어야 한다: ' + 줄);
  assert.ok(줄.indexOf('앱 화면') === -1, '최저가 아닌 접점은 첫 줄에 안 올린다');
  const 미 = E.접점한줄_(E.접점최저_([[1, '앱 화면', 3], [2, '강사', '']]));
  assert.ok(/미판정 1: 강사/.test(미), '미판정은 수와 이름으로 드러난다: ' + 미);
  const 전부 = E.접점한줄_(E.접점최저_([[1, 'a', 3], [2, 'b', 3]]));
  assert.ok(/3점 ← 열두 자리 전부/.test(전부), '전부 같은 값이면 이름을 나열하지 않는다: ' + 전부);
  const 빈 = E.접점한줄_(E.접점최저_([]));
  assert.ok(빈.length > 10 && /못 잰다/.test(빈), '표가 비면 그 사실이 줄이다(생략 금지): ' + 빈);
});

/* ───────────────────── ② 씨앗 ───────────────────── */
test('[접점밀도] 씨앗 열둘 = 눈금 v1 4-1 표 — 번호 1~12 · 이름 겹침 0 · 점수 0~3 정수 · 09-07 의 최저는 8번 「첫 5분」 0 점(유호 자리)', () => {
  const { E } = 엔진({});
  const 씨앗 = E.접점열둘_();
  assert.equal(씨앗.length, 12);
  assert.deepEqual(씨앗.map(r => r[0]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(new Set(씨앗.map(r => r[1])).size, 12, '접점 이름이 겹친다');
  씨앗.forEach(r => {
    assert.equal(r.length, 5, '씨앗 행은 [#, 접점, 점수, 근거, 정본] 다섯이다: ' + r[1]);
    assert.ok(Number.isInteger(r[2]) && r[2] >= 0 && r[2] <= 3, '점수 눈금 밖: ' + r[1] + ' = ' + r[2]);
    assert.ok(String(r[3]).trim() && String(r[4]).trim(), '근거·정본이 비면 유호님이 왜 그 점수인지 못 본다: ' + r[1]);
  });
  const 최저 = E.접점최저_(씨앗);
  assert.equal(최저.점수, 0, '09-07 씨앗의 오늘 점수는 0 이다 — 「점수 0 이 눈에 보인다」가 완료 조건이다');
  assert.deepEqual(최저.이름들, ['첫 5분 — 가격·주소·체험 절차']);
  assert.ok(/유호 자리/.test(씨앗[7][3]), '0 점의 근거는 유호 자리를 가리켜야 한다');
});

/* ───────────────────── ③ 표 ───────────────────── */
test('[접점밀도] 빈 시트에만 씨앗을 깐다(열둘 × 칸 일곱 · 판정일·판정자 동봉) — 값이 있으면 코드는 한 칸도 안 덮는다', () => {
  const a = 엔진({ rows: [] });
  const rows = a.E.접점표_(a.ss);
  assert.equal(a.calls.ensure.name, '접점밀도');
  assert.deepEqual(a.calls.ensure.headers, HEADERS);
  assert.equal(a.calls.setValues.length, 1, '씨앗은 한 번에 깐다');
  assert.equal(a.calls.setValues[0].n, 12);
  assert.equal(a.calls.setValues[0].w, 7);
  assert.equal(rows.length, 12);
  rows.forEach(r => assert.equal(r.length, 7));
  assert.equal(rows[0][5], '2026-09-07', '판정일');
  assert.ok(/씨앗/.test(rows[0][6]), '판정자 칸이 「코드 씨앗」임을 밝힌다 — 유호 눈 판정과 섞이지 않는다');

  const b = 엔진({ rows: [[8, '첫 5분', 2, '유호가 고침', '—', '2026-11-01', '유호']] });
  const rows2 = b.E.접점표_(b.ss);
  assert.equal(b.calls.setValues.length, 0, '값이 있는 표에 씨앗을 다시 깔면 유호님이 고친 점수가 죽는다');
  assert.equal(rows2.length, 1);
  assert.equal(rows2[0][2], 2);
});

test('[접점밀도] 칸 이름은 골격(sheetSkeleton_) 한 곳만 안다 — 접점헤더_ 는 그것을 읽고, 제 목록을 안 가진다', () => {
  const { E } = 엔진({});
  assert.deepEqual(E.접점헤더_(), HEADERS);
  const 몸 = section('function 접점헤더_(', 'function 접점점수_(');
  assert.ok(/sheetSkeleton_\(\)/.test(몸), '골격에서 파생해야 한다');
  assert.ok(!/'#'/.test(몸), '헤더 목록을 여기 다시 적으면 두 곳이 갈린다');
  const 골격 = section('function sheetSkeleton_() {', 'function 수집장부탭_() {');
  const 줄 = 골격.split('\n').filter(l => l.indexOf("['접점밀도'") > -1);
  assert.equal(줄.length, 1, '골격에 접점밀도 탭이 정확히 한 줄');
  assert.ok(/'#','접점','점수','근거','정본','판정일','판정자'/.test(줄[0]), '골격 칸 일곱: ' + 줄[0]);
  assert.ok(!/수집표식_/.test(줄[0]), '접점밀도는 사람이 고치는 표지 수집 시트가 아니다 — 표식을 주면 도달 장부가 소비자를 요구한다');
});

/* ───────────────────── ④ 배선 ───────────────────── */
test('[접점밀도] 원장 오늘판 — 접점 줄이 **첫 줄**이고(강사·학생·순간 앞), 못 쟀어도 그 사실이 줄로 선다', () => {
  const { E, ss } = 엔진({ rows: [] });
  const 줄 = E.접점보드줄_(ss);
  assert.equal(줄.length, 1);
  assert.equal(줄[0].length, 5, 'today_board 폭(유형·이름·반·시각·퇴근)');
  assert.equal(줄[0][0], E.TOUCHPOINT_BOARD_TYPE_);
  const 본문 = section('function todayBoard_(ss) {', 'updateTeacherInOut_(ss, tz, pf);');
  assert.ok(/const all = 접점Rows\.concat\(rows\)\.concat\(stuRows\)\.concat\(momentRows\);/.test(본문),
    '접점 줄이 all 의 맨 앞이 아니다 — 둘째 줄부터는 배경이 된다');
  assert.ok(/try \{ 접점Rows = 접점보드줄_\(ss\); \} catch/.test(본문), '실패는 격리한다(출결 보드를 깨면 안 된다)');
  assert.ok(/접점Rows = \[\[TOUCHPOINT_BOARD_TYPE_, '접점 밀도를 못 쟀다/.test(본문), '실패해도 줄은 선다 — 조용한 생략 금지');
});

test('[접점밀도] 주간 리포트 — 값이 없든 있든 🧭 줄이 선다(눈금 §⑦ 함정 하나 · 생략되는 섹션은 배경이 된다)', () => {
  const 본문 = section('function weeklyReport(asText) {', "body += '\\n🗣 발화 지수(주간 스냅샷)\\n';");
  assert.ok(/try \{ body \+= '\\n🧭 접점 밀도: ' \+ 접점한줄_\(접점최저_\(접점표_\(ss\)\)\)/.test(본문), '주간 리포트에 접점 밀도 줄이 없다');
  assert.ok(/catch \(eTp\) \{ body \+= '\\n🧭 접점 밀도: 못 쟀다/.test(본문), '못 쟀을 때도 줄이 서야 한다');
  const 앞 = 본문.slice(0, 본문.indexOf('🧭 접점 밀도'));
  assert.ok(!/if \([^)]*\)\s*\{?\s*$/.test(앞.trimEnd()), '접점 줄이 조건문 안에 들어가면 값 없는 주에 생략된다');
});
