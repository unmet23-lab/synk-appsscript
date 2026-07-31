// tests/발화퀄리티.test.js — [v9.99] 발화 퀄리티 엔진 회귀 테스트
// 실행: node tests/발화퀄리티.test.js  (CI: syntax-check.yml이 tests/*.test.js 전체 구동)
//
// 이 테스트가 지키는 것 = 정원 16명 소그룹 20분의 계약.
//   교실에서 강사 1명이 4조를 동시에 들을 수 없으므로, 여기가 틀리면 아무도 못 잡는다.
//   특히 「선언만 하고 아무도 안 쓰는 상수」 검사는 v9.80이 ROLE_TALK를 선언만 하고
//   어디서도 참조하지 않아 「발화량 추정」이 주석으로만 존재했던 사고(08-01 발견)의 회귀 장치다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');

function section(startMarker, endMarker) {
  const s = code.indexOf(startMarker);
  assert.notEqual(s, -1, `섹션 시작 표식을 찾지 못함: ${startMarker}`);
  const e = code.indexOf(endMarker, s + startMarker.length);
  assert.notEqual(e, -1, `섹션 끝 표식을 찾지 못함: ${endMarker}`);
  return code.slice(s, e);
}

// 조 편성·발화 상수 + 순수 계산 함수를 실값으로 로드(하드코딩 금지 — 정본이 바뀌면 검사도 함께 움직인다)
function loadCore() {
  const start = code.indexOf('const GROUP_COUNT = 4;');
  const end = code.indexOf('/* --- 실력 점수', start);
  assert.notEqual(start, -1, 'GROUP_COUNT 섹션을 찾지 못함');
  assert.notEqual(end, -1, 'skillScoreOf_ 앞 표식을 찾지 못함');
  const classDowOk_ = (type, dow) => (String(type) === '주말' ? dow === 6 : (dow >= 1 && dow <= 5));
  const Utilities = { formatDate: (d) => d.toISOString().slice(0, 10) };
  return new Function('classDowOk_', 'Utilities', `${code.slice(start, end)}
    return { roleOfSeat_, pairSeatOf_, pairRoundsOf_, focusGroupOf_, lessonDayMap_, lessonNoOf_,
             ROLE_NAMES, ROLE_ICONS, ROLE_TALK, ROLE_DUTY, GROUP_COUNT, SEASON_WEEKS,
             TALK_PLAN_MIN, TALK_ROUNDS, FOCUS_START_WEEK, PAIR_PATTERNS };`)(classDowOk_, Utilities);
}

const G = loadCore();

/* ── ① 3라운드 짝 — 4/3/2 반복의 핵심 계약 ───────────────────────── */

test('4인 조는 3라운드 안에 나머지 셋을 정확히 한 번씩 만난다', () => {
  for (let seat = 0; seat < 4; seat++) {
    const mates = G.pairRoundsOf_(seat, 4);
    assert.equal(mates.length, 3, `좌석 ${seat}의 라운드 수가 3이 아님`);
    assert.ok(!mates.includes(seat), `좌석 ${seat}이 자기 자신과 짝이 됨`);
    const uniq = [...new Set(mates)];
    assert.equal(uniq.length, 3, `좌석 ${seat}이 같은 상대를 두 번 만남: ${mates.join(',')}`);
    assert.deepEqual([...mates].sort(), [0, 1, 2, 3].filter((s) => s !== seat),
      `좌석 ${seat}이 만나지 못한 조원이 있음: ${mates.join(',')}`);
  }
});

test('짝은 라운드마다 서로를 가리킨다(A의 짝이 B면 B의 짝도 A)', () => {
  for (let r = 0; r < G.TALK_ROUNDS.length; r++) {
    for (let seat = 0; seat < 4; seat++) {
      const mate = G.pairRoundsOf_(seat, 4)[r];
      assert.equal(G.pairRoundsOf_(mate, 4)[r], seat,
        `${r + 1}R에서 좌석 ${seat}↔${mate} 짝이 비대칭 — 한쪽만 상대가 바뀌면 교실이 엉킨다`);
    }
  }
});

test('3인 조는 짝을 만들지 않는다(셋이 함께)', () => {
  assert.deepEqual(G.pairRoundsOf_(0, 3), [], '3인 조에 짝이 생기면 한 명이 남는다');
  assert.deepEqual(G.pairRoundsOf_(2, 3), []);
});

test('라운드 수와 짝 조합 수가 일치한다 — 한쪽만 늘리면 조용히 라운드가 빈다', () => {
  assert.equal(G.TALK_ROUNDS.length, G.PAIR_PATTERNS.length,
    'TALK_ROUNDS와 PAIR_PATTERNS 길이가 다르다(4라운드로 늘리면 4번째 짝이 없다)');
});

/* ── ② 20분 타임박스 — 물리적으로 가능한 배분인가 ─────────────────── */

test('타임박스 합이 소그룹 20분을 넘지 않는다', () => {
  const sum = G.TALK_PLAN_MIN + G.TALK_ROUNDS.reduce((a, b) => a + b, 0);
  assert.ok(sum <= 20, `계획+라운드 합 ${sum}분 > 20분 — 정리·발표 시간이 사라진다`);
  assert.ok(sum >= 8, `계획+라운드 합 ${sum}분은 너무 짧다 — 20분을 설계 없이 흘려보낸다`);
});

test('라운드 시간은 점점 짧아진다(4/3/2 — 같은 내용을 더 빨리 말하게 하는 설계)', () => {
  for (let i = 1; i < G.TALK_ROUNDS.length; i++) {
    assert.ok(G.TALK_ROUNDS[i] < G.TALK_ROUNDS[i - 1],
      `${i + 1}R이 앞 라운드보다 짧지 않다 — 유창성 압박이 사라진다`);
  }
});

/* ── ③ 역할 의무 — 저발화 역할에도 발화를 심는다 ─────────────────── */

test('역할 의무가 모든 역할에 1:1로 있다', () => {
  assert.equal(G.ROLE_DUTY.length, G.ROLE_NAMES.length,
    '역할과 의무 개수가 다르다 — 브리핑에 undefined가 찍힌다');
  G.ROLE_DUTY.forEach((d, i) => assert.ok(String(d).trim().length > 0,
    `${G.ROLE_NAMES[i]} 역할의 의무가 비어 있다`));
});

test('저발화 역할(가중 1)에도 발화 의무가 붙어 있다', () => {
  G.ROLE_TALK.forEach((w, i) => {
    if (w > 1) return;
    assert.ok(String(G.ROLE_DUTY[i]).trim().length > 0,
      `${G.ROLE_NAMES[i]}(가중 ${w})에 발화 의무가 없다 — 4차시 중 2차시를 침묵으로 보내게 된다`);
  });
});

/* ── ④ 정밀 청취 로테이션 ────────────────────────────────────────── */

test('정밀 청취는 4차시 만에 전 조를 한 번씩 돈다', () => {
  const seen = [];
  for (let n = 1; n <= G.GROUP_COUNT; n++) seen.push(G.focusGroupOf_(n, G.FOCUS_START_WEEK));
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4], `4차시 순환이 깨짐: ${seen.join(',')}`);
});

test('1~2주차에는 정밀 청취를 지정하지 않는다(조 자율 운행 미성숙 구간)', () => {
  for (let w = 1; w < G.FOCUS_START_WEEK; w++) {
    assert.equal(G.focusGroupOf_(5, w), 0, `${w}주차에 정밀 청취가 켜짐 — 나머지 3조가 방치된다`);
  }
  assert.equal(G.focusGroupOf_(0, 8), 0, '시즌 기간 밖(차시 0)인데 정밀 청취가 켜짐');
});

/* ── ⑤ 발화 지수 — 지명 순서를 정하는 계산 ───────────────────────── */

function loadTalkIndex() {
  const src = section('function talkIndexOf_(', '/* [v9.99] 학생용 오늘의 만남');
  const stub = {
    groupBoardOf_: () => null,
    seasonStartOf_: () => new Date(2027, 1, 1),
    scheduleMap: () => ({}),
    schedOf: () => ({ type: '평일' }),
    quietScoreMap_: () => ({}),
    lessonDayMap_: () => ({ D1: 1, D2: 2, D3: 3, D4: 4 }),
    attDayMapCached_: () => ({
      A: { D1: 1, D2: 1, D3: 1, D4: 1 },   // 개근
      B: { D1: 1 },                        // 1차시만 출석
      C: { D1: 1, D2: 1, D3: 1, D4: 1 },   // 개근이지만 미발화 기록 1회
    }),
    ROLE_TALK: G.ROLE_TALK, ROLE_NAMES: G.ROLE_NAMES, roleOfSeat_: G.roleOfSeat_,
  };
  const names = Object.keys(stub);
  return new Function(...names, `${src}\nreturn talkIndexOf_;`)(...names.map((n) => stub[n]));
}

test('발화 지수 = 출석한 차시의 역할 가중 합 — 결석은 그날 역할을 통째로 잃는다', () => {
  const talkIndexOf_ = loadTalkIndex();
  const board = {
    lessonNo: 4,
    groups: [[{ sid: 'A', name: '아', seat: 0 }, { sid: 'B', name: '바', seat: 1 }, { sid: 'C', name: '차', seat: 2 }]],
  };
  const out = talkIndexOf_({}, '평일11A', new Date(2027, 1, 4), 'Asia/Ulaanbaatar', board, { C: 1 });
  const by = {};
  out.forEach((x) => { by[x.sid] = x; });

  // 3인 조라 역할은 앞 3개(진행2·기록1·발표2)만 순환 → 4차시 최대 = 2+1+2+2 = 좌석마다 동일하지 않을 수 있으므로 실측 대조
  assert.equal(by.A.got, by.A.max, '개근인데 획득이 최대와 다르다');
  assert.equal(by.A.pct, 100, '개근·침묵 0인데 100%가 아니다');
  assert.ok(by.B.got < by.B.max, '1차시만 출석했는데 최대치를 받았다');
  assert.ok(by.B.pct < by.A.pct, '결석이 많은 학생이 개근 학생보다 지수가 높다');
  assert.ok(by.C.pct < by.A.pct && by.C.pct > by.B.pct,
    '미발화 기록이 지수에 반영되지 않았다(개근 무침묵보다 낮고 대량 결석보다 높아야 한다)');
  assert.equal(out[0].sid, 'B', '지명 우선 정렬이 낮은 지수부터가 아니다');
});

test('발화 지수는 편성이 없으면 조용히 빈 배열(개원 전 무소음)', () => {
  const talkIndexOf_ = loadTalkIndex();
  assert.deepEqual(talkIndexOf_({}, 'X', new Date(), 'Asia/Ulaanbaatar', null, {}), []);
  assert.deepEqual(talkIndexOf_({}, 'X', new Date(), 'Asia/Ulaanbaatar', { lessonNo: 0, groups: [] }, {}), []);
});

/* ── ⑥ 배선 — 계산이 실제로 강사·학생 화면까지 도달하는가 ────────── */

test('선언만 하고 아무도 안 쓰는 상수가 없다 — v9.80 ROLE_TALK 미배선의 회귀 장치', () => {
  // 주석을 걷어낸 코드에서만 센다(ROLE_TALK는 주석에 여러 번 등장해 그대로 세면 미배선을 못 잡는다)
  const bare = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/[^\n'"]*$/gm, '');
  ['ROLE_TALK', 'ROLE_DUTY', 'TALK_ROUNDS', 'TALK_PLAN_MIN', 'FOCUS_START_WEEK', 'PAIR_PATTERNS', 'ROLE_ICONS']
    .forEach((n) => {
      const uses = bare.split(new RegExp(`\\b${n}\\b`)).length - 1;
      assert.ok(uses >= 2,
        `${n}이 선언(1회)만 되고 실제로 쓰이지 않는다 — 약속한 기능이 주석으로만 존재한다`);
    });
});

test('20분 프로토콜이 조 편성표가 나가는 모든 경로에 실린다', () => {
  const board = section('function groupBoardText_(', '// 수동 확인용');
  assert.ok(board.includes('talkProtocolLines_'), '강사 브리핑 조 편성표에 20분 프로토콜이 없다');
  assert.ok(board.includes('talkIndexOf_'), '조 편성표에 지명 우선(발화 지수)이 없다');
  assert.ok(board.includes('m.rounds'), '조 편성표 짝이 3라운드로 펴지지 않았다');
  const hud = section('function buildGroupHud_(', 'function groupHudsByClass_(');
  assert.ok(hud.includes('TALK_ROUNDS') && hud.includes('ROLE_DUTY'),
    'Glide 반 상세 HUD에 타임박스·역할 의무가 없다(교실에서 보는 화면)');
  assert.ok(hud.includes('b.focus'), 'HUD에 정밀 청취 조 표시가 없다');
  const plan = section('function lessonPlanFill_(', '[v9.91] 📋 차시 마감폼');
  assert.ok(plan.includes('TALK_ROUNDS') && plan.includes('ROLE_DUTY'), '주간 교안에 20분 타임박스가 없다');
  assert.ok(plan.includes('o.talkReal'), '교안 §12 지명 계획이 발화 실측으로 승격되지 않았다');
});

test('학생 화면 오늘의만남(DY129) 배선 — 행 수 정합·수업 없는 날 공란', () => {
  assert.ok(code.includes("pf.getRange('DY1').getValue()) !== '오늘의만남'"), 'DY129 헤더 보장이 없다');
  assert.ok(code.includes('writeIfChanged(pf, 2, 129, meetOut)'), 'DY129 기입이 없다 — 이 검사·레지스트리 갱신 필요');
  assert.ok(code.includes('meetOut.push('), 'meetOut이 학생 루프에서 채워지지 않는다(행 수 어긋남 = 열 전체 밀림)');
  const fn = section('function todayPairsBySid_(', '/* [v9.99] 강사가 매 차시 보는');
  assert.ok(fn.includes('classDowOk_'), '수업 없는 날 가드가 없다 — 어제 짝이 남아 오정보가 된다');
  assert.ok(fn.includes('pairRoundsOf_'), '학생 화면 짝이 조 편성표와 다른 계산을 쓴다');
});

test('출석 원본은 실행당 1회만 읽는다(반 18개 × 전체 읽기 방지)', () => {
  const fn = section('function attDayMapCached_(', '/* [v9.99] 🔈 발화 지수');
  assert.ok(fn.includes('if (TALK_ATT_CACHE_) return TALK_ATT_CACHE_'), '출석 읽기 메모이즈가 없다');
  const idx = section('function talkIndexOf_(', '/* [v9.99] 학생용 오늘의 만남');
  assert.ok(!idx.includes("getSheetByName('attendance')"),
    '발화 지수가 attendance를 직접 읽는다 — 캐시를 우회하면 반마다 전체 읽기가 된다');
});
