// tests/조편성.test.js — [v9.80] 조 편성·역할 로테이션 회귀 테스트
// 실행: node --test tests/조편성.test.js  (CI: syntax-check.yml이 tests/*.test.js 전체 구동)
// 방식은 safety.test.js와 동일 — 소스에서 섹션을 잘라 스텁 주입 후 순수 함수만 실행.
//
// 이 테스트가 지키는 것 = 「SYNK LAB 강사 수업 규칙」 v3.0 §5의 조 편성 계약.
// 규칙서가 강사에게서 앱으로 넘긴 항목이라, 여기가 틀리면 교실에서 아무도 못 잡는다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');
/* 주석 제거 통로는 공용 하나다 — `tests/lib/소스검사.js` (F401 계열 · 대기열 P3 줄73). */
const { 코드만 } = require('./lib/소스검사.js');
const code = engineSource();

// 조 편성 섹션(상수 ~ 편성 코어)만 잘라 로드한다. 시트·SpreadsheetApp 의존 함수는 정의만 되고 호출하지 않는다.
function loadGroupCore() {
  const start = code.indexOf('const GROUP_COUNT = 4;');
  assert.notEqual(start, -1, 'GROUP_COUNT 섹션을 찾지 못함');
  const end = code.indexOf('/* --- 반 하나 편성', start);
  assert.notEqual(end, -1, 'assignGroups 앞 표식을 찾지 못함');
  const source = code.slice(start, end);
  // lessonNoOf_가 쓰는 classDowOk_만 주입 (Code.js 원본과 동일 정의)
  const classDowOk_ = (type, dow) => (String(type) === '주말' ? dow === 6 : (dow >= 1 && dow <= 5));
  return new Function('classDowOk_', `${source}
    return { roleOfSeat_, roleIconOf_, pairSeatOf_, lessonNoOf_, seasonWeekOf_, skillScoreOf_,
             buildGroupPlan_, ROLE_NAMES, GROUP_COUNT, SEASON_WEEKS };`)(classDowOk_);
}

const G = loadGroupCore();

/* ── 역할 로테이션 ─────────────────────────────────────────── */

test('4명 조는 4차시 만에 전원이 네 역할을 한 번씩 거친다', () => {
  for (let seat = 0; seat < 4; seat++) {
    const roles = [];
    for (let n = 1; n <= 4; n++) roles.push(G.roleOfSeat_(seat, n, 4));
    assert.deepEqual([...roles].sort(), [...G.ROLE_NAMES].sort(),
      `좌석 ${seat}이 4차시 안에 네 역할을 다 거치지 않음: ${roles.join(',')}`);
  }
});

test('같은 차시에 한 조의 네 명은 서로 다른 역할을 맡는다', () => {
  for (let n = 1; n <= 12; n++) {
    const roles = [0, 1, 2, 3].map((s) => G.roleOfSeat_(s, n, 4));
    assert.equal(new Set(roles).size, 4, `${n}차시에 역할이 겹침: ${roles.join(',')}`);
  }
});

test('역할 순환 방향은 진행 → 기록 → 발표 → 질문이다', () => {
  // 좌석 0의 차시별 역할이 곧 순환 순서다
  const seq = [1, 2, 3, 4].map((n) => G.roleOfSeat_(0, n, 4));
  assert.deepEqual(seq, ['진행', '기록', '발표', '질문']);
});

/* ── 발표 순번 — 규칙서 §3⑤ "8주 동안 전원이 최소 2회 대표로 말한다" ──── */

test('주말반(8주 × 주 1차시 = 8차시)은 전원이 정확히 2회 발표한다', () => {
  for (let seat = 0; seat < 4; seat++) {
    let count = 0;
    for (let n = 1; n <= 8; n++) if (G.roleOfSeat_(seat, n, 4) === '발표') count++;
    assert.equal(count, 2, `좌석 ${seat}의 8차시 발표 횟수가 2회가 아님: ${count}회`);
  }
});

test('평일반(8주 × 주 5차시 = 40차시)은 전원이 10회 발표한다', () => {
  for (let seat = 0; seat < 4; seat++) {
    let count = 0;
    for (let n = 1; n <= 40; n++) if (G.roleOfSeat_(seat, n, 4) === '발표') count++;
    assert.equal(count, 10, `좌석 ${seat}의 40차시 발표 횟수: ${count}회`);
  }
});

test('12명 이하 반의 3명 조는 진행·기록·발표만 돌고 질문은 배정되지 않는다', () => {
  const roles = new Set();
  for (let seat = 0; seat < 3; seat++) for (let n = 1; n <= 9; n++) roles.add(G.roleOfSeat_(seat, n, 3));
  assert.deepEqual([...roles].sort(), ['기록', '발표', '진행'],
    '3명 조에 질문 역할이 섞이면 그 차시 한 명은 역할이 없다');
});

/* ── 짝 조합 순환 — 규칙서 §5 "조 안의 2인 짝은 매 차시 바뀐다(3가지 조합)" ── */

test('짝은 항상 서로를 가리킨다 (a의 짝이 b면 b의 짝도 a)', () => {
  for (let n = 1; n <= 12; n++) {
    for (let seat = 0; seat < 4; seat++) {
      const p = G.pairSeatOf_(seat, n, 4);
      assert.equal(G.pairSeatOf_(p, n, 4), seat, `${n}차시 좌석 ${seat}↔${p} 짝이 비대칭`);
      assert.notEqual(p, seat, `${n}차시 좌석 ${seat}이 자기 자신과 짝`);
    }
  }
});

test('연속 3차시에 세 가지 짝 조합이 모두 나오고 4차시에 처음으로 되돌아온다', () => {
  const sig = (n) => [0, 1, 2, 3].map((s) => G.pairSeatOf_(s, n, 4)).join('');
  const three = [sig(1), sig(2), sig(3)];
  assert.equal(new Set(three).size, 3, `3차시 안에 조합이 겹침: ${three.join(' / ')}`);
  assert.equal(sig(4), sig(1), '4차시에 1차시 조합으로 순환하지 않음');
});

test('3명 조는 짝을 나누지 않는다 (셋이 함께)', () => {
  assert.equal(G.pairSeatOf_(0, 1, 3), -1);
});

/* ── 차시 번호 — 시즌 시작일부터 그 반의 수업 요일만 센다 ──────────── */

test('평일반은 주 5차시, 주말반은 주 1차시로 센다', () => {
  const mon = new Date(2027, 1, 1);          // 2027-02-01 월요일
  const sameFri = new Date(2027, 1, 5);      // 같은 주 금요일
  const nextMon = new Date(2027, 1, 8);      // 다음 주 월요일
  assert.equal(G.lessonNoOf_(mon, mon, '평일'), 1, '시작일 당일이 1차시여야 함');
  assert.equal(G.lessonNoOf_(mon, sameFri, '평일'), 5, '첫 주 금요일이 5차시');
  assert.equal(G.lessonNoOf_(mon, nextMon, '평일'), 6, '2주차 월요일이 6차시');
  const sat1 = new Date(2027, 1, 6), sat2 = new Date(2027, 1, 13);
  assert.equal(G.lessonNoOf_(mon, sat1, '주말'), 1, '주말반 첫 토요일이 1차시');
  assert.equal(G.lessonNoOf_(mon, sat2, '주말'), 2, '주말반 둘째 토요일이 2차시');
});

test('평일반 8주 시즌은 40차시, 주말반은 8차시로 끝난다', () => {
  const start = new Date(2027, 1, 1);                  // 월요일 시작
  const lastFri = new Date(2027, 1, 1 + 7 * 7 + 4);    // 8주차 금요일
  assert.equal(G.lessonNoOf_(start, lastFri, '평일'), 40);
  const lastSat = new Date(2027, 1, 1 + 7 * 7 + 5);    // 8주차 토요일
  assert.equal(G.lessonNoOf_(start, lastSat, '주말'), 8);
});

test('시즌 시작 전 날짜와 한참 지난 날짜는 0차시로 막는다', () => {
  const start = new Date(2027, 1, 1);
  assert.equal(G.lessonNoOf_(start, new Date(2027, 0, 20), '평일'), 0, '시작 전은 0');
  assert.equal(G.lessonNoOf_(start, new Date(2027, 5, 1), '평일'), 0, '시즌 밖은 0(무한 루프 방어)');
});

test('시즌 주차는 1주차부터 시작해 8주차까지 간다', () => {
  const start = new Date(2027, 1, 1);
  assert.equal(G.seasonWeekOf_(start, start), 1);
  assert.equal(G.seasonWeekOf_(start, new Date(2027, 1, 7)), 1, '시작 후 6일까지 1주차');
  assert.equal(G.seasonWeekOf_(start, new Date(2027, 1, 8)), 2);
  assert.equal(G.seasonWeekOf_(start, new Date(2027, 1, 1 + 7 * 7)), 8);
});

/* ── 조 편성 — 규칙서 §5 "실력 섞기 · 말수 섞기 · 같은 학교는 다른 조" ── */

const mk = (n, extra) => {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push(Object.assign({ sid: 'S' + i, name: '학생' + i, skill: n - i + 1, quiet: 0, tag: '' },
      extra ? extra(i) : {}));
  }
  return out; // skill이 큰 순서 = S1이 1위
};
const sizesOf = (plan) => {
  const c = [0, 0, 0, 0];
  plan.forEach((p) => { c[p.grp - 1]++; });
  return c;
};

test('16명 반은 4·4·4·4로 나뉜다', () => {
  assert.deepEqual(sizesOf(G.buildGroupPlan_(mk(16), {})), [4, 4, 4, 4]);
});

test('12명 반은 3명씩 4조로 나뉜다 (규칙서 §5 단서)', () => {
  assert.deepEqual(sizesOf(G.buildGroupPlan_(mk(12), {})), [3, 3, 3, 3]);
});

test('14명처럼 안 떨어지는 인원도 한 명도 빠짐없이 앉는다', () => {
  [13, 14, 15, 9, 7].forEach((n) => {
    const plan = G.buildGroupPlan_(mk(n), {});
    assert.equal(plan.length, n, `${n}명 중 ${plan.length}명만 배정됨 — 배정 누락`);
    assert.equal(new Set(plan.map((p) => p.sid)).size, n, `${n}명 배정에 중복 발생`);
  });
});

test('16명 반은 네 조의 실력 합이 완전히 같다 (빠른1 + 보통2 + 느린1)', () => {
  const plan = G.buildGroupPlan_(mk(16), {});
  const rank = {};
  mk(16).forEach((m, i) => { rank[m.sid] = i + 1; }); // skill 내림차순 = 배열 순서
  const sums = [0, 0, 0, 0];
  plan.forEach((p) => { sums[p.grp - 1] += rank[p.sid]; });
  assert.deepEqual(sums, [34, 34, 34, 34], `조별 실력 합이 어긋남: ${sums.join(',')}`);
});

test('각 조에 상위 4명 중 정확히 한 명씩 들어간다', () => {
  const plan = G.buildGroupPlan_(mk(16), {});
  const topGroups = plan.filter((p) => ['S1', 'S2', 'S3', 'S4'].indexOf(p.sid) > -1).map((p) => p.grp);
  assert.deepEqual([...topGroups].sort(), [1, 2, 3, 4], '빠른 학생이 한 조에 몰림');
});

test('좌석은 조마다 0부터 빈틈없이 매겨진다 (역할·짝 순환의 축)', () => {
  const plan = G.buildGroupPlan_(mk(16), {});
  for (let g = 1; g <= 4; g++) {
    const seats = plan.filter((p) => p.grp === g).map((p) => p.seat).sort();
    assert.deepEqual(seats, [0, 1, 2, 3], `${g}조 좌석이 연속이 아님: ${seats.join(',')}`);
  }
});

test('같은 학교 학생이 한 조에 몰리지 않는다', () => {
  // 상위 4명을 전부 같은 학교로 두면, 교환이 없을 때 네 명이 각 조에 흩어져 있어야 한다
  const members = mk(16, (i) => ({ tag: i <= 8 ? ('학교' + ((i - 1) % 4)) : '' }));
  const plan = G.buildGroupPlan_(members, {});
  const tagOf = {};
  members.forEach((m) => { tagOf[m.sid] = m.tag; });
  for (let g = 1; g <= 4; g++) {
    const tags = plan.filter((p) => p.grp === g).map((p) => tagOf[p.sid]).filter(Boolean);
    assert.equal(new Set(tags).size, tags.length, `${g}조에 같은 학교가 겹침: ${tags.join(',')}`);
  }
});

test('조용한 학생이 한 조에 몰리지 않는다 (마감폼 미발화 기록 기반)', () => {
  // 같은 실력 계층(스네이크 라운드) 안에 조용한 학생을 몰아넣고, 교환이 실제로 흩어놓는지 본다.
  // 계층을 가로지르는 교환은 실력 균형을 깨므로 하지 않는다 — 그래서 같은 라운드에 심는다.
  const quietSids = ['S1', 'S2', 'S3', 'S4'];
  const members = mk(16, (i) => ({ quiet: i <= 4 ? 9 : 0 }));
  const plan = G.buildGroupPlan_(members, {});
  for (let g = 1; g <= 4; g++) {
    const hi = plan.filter((p) => p.grp === g).filter((p) => quietSids.indexOf(p.sid) > -1).length;
    assert.ok(hi <= 1, `${g}조에 조용한 학생이 ${hi}명 몰림`);
  }
});

test('침묵 점수가 편성에 실제로 반영된다 (필드명이 어긋나면 이 테스트가 죽는다)', () => {
  // talk→quiet 개명 때 buildGroupPlan_만 바꾸고 호출부를 안 고치면 quiet가 undefined가 되어
  // 교환 로직이 통째로 무음이 된다. 그래도 스네이크만으로 대부분 흩어져 겉으로는 통과한다.
  // 그래서 '편성근거'에 침묵 횟수가 실리는지를 직접 본다.
  const plan = G.buildGroupPlan_(mk(8, (i) => ({ quiet: i === 1 ? 5 : 0 })), {});
  const s1 = plan.filter((p) => p.sid === 'S1')[0];
  assert.ok(/침묵 5회/.test(s1.why), `편성근거에 침묵 횟수가 없다: ${s1.why}`);
});

test('강사가 잠근 학생(고정=Y)은 그 조 자리를 지킨다', () => {
  const plan = G.buildGroupPlan_(mk(16), { S16: { grp: 1, seat: 0 }, S15: { grp: 2, seat: 0 } });
  assert.equal(plan.filter((p) => p.sid === 'S16')[0].grp, 1, '고정 학생이 1조를 벗어남');
  assert.equal(plan.filter((p) => p.sid === 'S15')[0].grp, 2, '고정 학생이 2조를 벗어남');
  assert.equal(plan.length, 16, '고정을 넣자 배정 인원이 줄었다');
});

test('학생이 0명이면 빈 편성을 돌려주고 죽지 않는다', () => {
  assert.deepEqual(G.buildGroupPlan_([], {}), []);
});

/* ── 실력 점수 — 급수가 있으면 급수가 지배한다 ─────────────────── */

test('급수가 높은 학생이 포인트가 많은 무급수 학생보다 앞선다', () => {
  const withLevel = []; withLevel[66] = 1; withLevel[15] = 0; withLevel[21] = 0;
  const noLevelHugePoints = []; noLevelHugePoints[66] = 0; noLevelHugePoints[15] = 999999; noLevelHugePoints[21] = 0;
  assert.ok(G.skillScoreOf_(withLevel) > G.skillScoreOf_(noLevelHugePoints),
    '급수 1급이 무급수 고포인트에 밀리면 실력 계층이 뒤집힌다');
});

test('급수가 같으면 누계 포인트로 가른다 (개원 첫 시즌은 전원 무급수)', () => {
  const a = []; a[66] = 0; a[15] = 500; a[21] = 0;
  const b = []; b[66] = 0; b[15] = 100; b[21] = 0;
  assert.ok(G.skillScoreOf_(a) > G.skillScoreOf_(b));
});

/* ── 배선 — 시트 골격·브리핑 ───────────────────────────────── */

test('groups가 시트 골격에 등록돼 preflightGlide가 자동 생성한다', () => {
  const i = code.indexOf('function sheetSkeleton_()');
  assert.notEqual(i, -1, 'sheetSkeleton_()을 찾지 못함');
  const body = code.slice(i, code.indexOf('\n  ];', i));
  assert.ok(/\['groups', GROUPS_HEADERS\]/.test(body), 'groups가 시트 골격에 없다 — 조립 때 시트가 안 생긴다');
});

// 2026-07-31 실사고: GROUPS_HEADERS를 파일 끝에 두고 시트 골격에서 참조했다가 const TDZ로
// 스크립트 전체가 ReferenceError로 죽을 뻔했다. [v9.135] 골격을 지연 평가 함수(sheetSkeleton_)로
// 바꿔 이 사고 계급(정의 위치·파일 순서 의존) 자체를 제거 — 이제 지키는 불변식은
// 「골격은 톱레벨 const로 되돌아가지 않는다」 + 「참조 상수의 정의가 실존한다」다.
test('시트 골격은 지연 평가 함수다 — 톱레벨 const로 되돌리면 초기화 순서 사고가 되살아난다', () => {
  assert.equal(코드만(code).includes('const SHEET_SKELETON'), false,
    '골격이 톱레벨 const로 회귀 — 타파일 상수 참조가 파일 초기화 순서에 따라 전 트리거를 죽인다');
  const DECL = 'function sheetSkeleton_()';
  const skeletonAt = code.indexOf(DECL);
  assert.notEqual(skeletonAt, -1, 'sheetSkeleton_()을 찾지 못함');
  // 선언 이후 본문만 보고, 주석(// …)과 문자열('…')을 걷어낸 뒤 남은 식별자만 검사한다.
  // 그러지 않으면 헤더 문자열의 '카드HTML' 같은 대문자나 자기 이름까지 참조로 오인한다.
  /* 🔑 [2026-08-13] 주석 제거를 공용 통로로(F401 계열). 문자열 비우기는 여기 몫으로 남는다 —
   *   렉서가 문자열 «안»을 안 건드리므로 순서 의존(`'//'` 오인)이 사라진다.
   * ⚠ **이름을 `body` 에서 갈랐다** — 이 파일엔 `body` 선언이 넷인데 나머지 셋은 `code.slice(…)`
   *   그대로다(정제 안 함). 계수기는 파일 하나를 한 스코프로 근사하고 «첫 선언이 이긴다» —
   *   그래서 여기 정제된 `body` 가 **그 셋까지 「안전」으로 물들이고 있었다**(실측: 안전 15 중 3이
   *   그 거짓 신용이었다). 못 합치면 이름을 가른다 — 새는 방향은 언제나 통과다. */
  const 골격코드 = 코드만(code.slice(skeletonAt + DECL.length, code.indexOf('\n  ];', skeletonAt)));
  const 골격본문 = 골격코드.replace(/'[^']*'/g, "''");
  const refs = new Set(골격본문.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || []);
  assert.ok(refs.has('GROUPS_HEADERS'), '검사 대상에 GROUPS_HEADERS가 안 잡힘 — 테스트가 무력화됨');
  refs.forEach((name) => {
    assert.notEqual(code.indexOf(`const ${name} `), -1,
      `시트 골격이 참조하는 ${name}의 const 정의를 찾지 못함 — 호출 시점 ReferenceError`);
  });
});

test('수업 12분 전 브리핑에 조 편성표가 실린다', () => {
  const i = code.indexOf('function classPrepMail_');
  const body = code.slice(i, code.indexOf('\nfunction ', i + 1));
  assert.ok(/groupBoardText_\(ss, cname, now, tz\)/.test(body), '브리핑이 조 편성표를 만들지 않는다');
  assert.ok(/gbText \? gbText/.test(body), '만든 조 편성표를 메일 본문에 넣지 않는다');
  // 편성이 없어도 브리핑 자체는 나가야 한다 — try/catch로 감쌌는지
  const call = body.slice(body.indexOf('const gbText'), body.indexOf('const body'));
  assert.ok(/try\s*\{/.test(call) && /catch/.test(call),
    '조 편성표 실패가 브리핑 전체를 막으면 안 된다(try/catch 누락)');
});

// Apps Script 편집기의 ▶ 버튼은 인자를 못 넘긴다. "인자 없으면 오늘"로 두면 확인하려고 누른 ▶ 한 번에
// 엉뚱한 날짜가 박히고, 시즌 시작일이 틀어지면 차시 번호가 밀려 역할·짝·발표자가 전부 어긋난다.
test('시즌 시작일은 ▶ 버튼 한 번으로 실수 설정되지 않는다', () => {
  const i = code.indexOf('function setSeasonStart');
  const body = code.slice(i, code.indexOf('\n// 시즌 라벨', i));
  assert.ok(/if \(!dateStr\)/.test(body), '인자 없이 실행했을 때의 분기가 없다');
  const guard = body.slice(body.indexOf('if (!dateStr)'), body.indexOf('const d = toDate_'));
  assert.equal(/setState/.test(코드만(guard)), false,
    '인자 없이 실행했는데 시즌 시작일을 써버린다 — ▶ 오작동으로 차시가 통째로 밀린다');
});

/* ── profiles 열 안전 — 2026-07-31 배포 직전 실사고 ────────────────
 * v9.80 초안이 학교·동네를 profiles 76·77(BX·BY)에 박았는데, 그 두 열은 v9.20부터
 * '오늘의알림'·'나의여정'으로 calcAll이 매일 쓰는 라이브 열이었다. 헤더를 덮어써
 * Glide 인앱 배너와 개인 스토리 카드를 깨뜨릴 배치였고, 값은 한 칸 밀린 열에서 읽고 있었다.
 * 공유 열은 v9.74·v9.81에서 계속 늘어나므로 번호 고정 자체가 시한폭탄이다. */

test('학교·동네 열은 번호를 박지 않고 이름으로 찾는다', () => {
  const i = code.indexOf('function setupClassroomInputs');
  const body = code.slice(i, code.indexOf('\n/* =====', i));
  assert.ok(/langColOf_\(pfG, '학교'\)/.test(body) && /langColOf_\(pfG, '동네'\)/.test(body),
    '학교·동네 열을 langColOf_로 확보하지 않는다');
  assert.equal(/pfG\.getRange\(1, *7[0-9]/.test(코드만(body)), false,
    'profiles 70번대 열에 헤더를 직접 쓴다 — 오늘의알림(76)·나의여정(77)을 덮어쓸 자리다');
});

test('조 편성이 오늘의알림·나의여정 열을 침범하지 않는다', () => {
  const i = code.indexOf('function assignGroups(className, opts)');
  const body = code.slice(i, code.indexOf('\n// 전 반 일괄', i));
  assert.ok(/langColOf_\(pf, '학교'\)/.test(body), '학교 열을 이름으로 찾지 않는다');
  assert.equal(/r\[7[67]\]/.test(코드만(body)), false,
    'r[76]·r[77]을 직접 읽는다 — 공유 열이 늘어나면 엉뚱한 값이 학교·동네로 들어간다');
});

/* ── 쓰기 예산 — 규칙서 §11 (Glide 월 500건) ────────────────────── */

test('역할·짝·발표자는 시트에 저장하지 않는다 (매 차시 쓰기 0)', () => {
  const start = code.indexOf('const GROUP_COUNT = 4;');
  const end = code.indexOf('/* --- 반 하나 편성', start);
  const pure = code.slice(start, end);
  ['roleOfSeat_', 'pairSeatOf_'].forEach((fn) => {
    const i = pure.indexOf(`function ${fn}`);
    assert.notEqual(i, -1, `${fn} 정의를 찾지 못함`);
    const body = pure.slice(i, pure.indexOf('\nfunction ', i + 1));
    assert.equal(/setValue|appendRow|setValues/.test(코드만(body)), false,
      `${fn}이 시트에 쓴다 — 매 차시 쓰기가 발생해 월 500건 한도를 넘긴다`);
  });
});
