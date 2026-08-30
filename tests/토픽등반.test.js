'use strict';
/**
 * ⛰ 토픽 등반 — 급수 «좌표»가 정직한가 (v9.279 · 유호 지시 2026-08-31)
 *
 * ■ 이 시험이 재는 것
 *   분모(`grammarGradeCounts_`)와 분자(`mastery_log` '도달')는 둘 다 이미 있었고, 이번에 «나누는 자»가
 *   생겼다. 나눗셈은 틀려도 **소리를 안 낸다** — 화면엔 언제나 그럴듯한 %가 뜬다. 그래서 여기서는
 *   숫자가 맞는가보다 **거짓말을 하지 않는가**를 먼저 잰다.
 *
 * ■ 가장 중요하게 막는 것 — 철학 Ⅱ-2 「없는 성공을 만들지 않는다 · 비교하지 않는다」.
 *   ① 5급 문형 하나를 우연히 맞힌 학생을 5급 봉우리에 세우면 그건 **없는 성공**이다.
 *   ② 카드에 「합격」·「부족」·「평균」 같은 낱말이 한 자라도 들어가면 평가·비교가 되살아난다.
 *   둘 다 실패해도 **어느 검사도 원래는 안 빨개진다**(HTML 이 한 줄 늘 뿐이다). 그래서 이름으로 잰다.
 *
 * ■ 리터럴을 안 쓴다 — 급수별 문형 수·문턱·과녁을 손으로 적지 않고 **정본에서 뽑아** 대조한다.
 *   시험이 숫자를 들고 있으면 뱅크가 늘어난 날 **검사만 조용히 낡는다**(그날 새는 방향은 「통과」다).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');

const code = engineSource();

function section(시작, 끝) {
  const s = code.indexOf(시작);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${시작}`);
  const e = code.indexOf(끝, s + 시작.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${끝}`);
  return code.slice(s, e);
}

/* 뱅크 정의부터 등반 절까지 한 덩이로 태운다 — 등반은 뱅크의 파생이라 갈라 태우면
 * 「뱅크가 바뀌었는데 등반만 옛 수를 쥔」 상태를 이 시험이 못 본다. */
const 등반절 = section('const GRAMMAR_BANK = [', '/* 그 레벨이 실제로');

function 태우기(escHtml_) {
  const 의존 = {
    escHtml_: escHtml_ || ((s) => String(s == null ? '' : s)),
    CARD_WEBFONT: '<style>/*webfont*/</style>',
    CARD_FONT: 'font-family:x;'
  };
  const n = Object.keys(의존);
  return new Function(...n, `${등반절}\nreturn { GRAMMAR_BANK, LEVEL_TOPIK_BAND, grammarNameMap_, grammarGradeCounts_,` +
    ` TOPIK_PEAK_MAX, TOPIK_PEAK_GATE, TOPIK_PEAK_TARGET, 토픽등반_, 등반카드HTML_, 토픽등반_도달맵_ };`)(...n.map((k) => 의존[k]));
}

const E = 태우기();
/** 그 급의 문형 ID 들 — 정본(뱅크)에서 뽑는다. */
const 급문형 = (급) => E.GRAMMAR_BANK.filter((g) => g[3] === 급).map((g) => g[0]);
/** ID 배열 → 도달 집합 */
const 집합 = (ids) => { const o = {}; ids.forEach((i) => { o[i] = true; }); return o; };

/* ───────────────────── 1. 분모는 뱅크가 정한다 (리터럴 0) ───────────────────── */

test('[v9.279] 급수별 분모는 GRAMMAR_BANK 도입급 수와 같다 — 손으로 센 수를 안 쓴다', () => {
  const c = E.토픽등반_({}, 0);
  assert.equal(c.급수들.length, E.TOPIK_PEAK_MAX, '봉우리 수가 뱅크 도입급 상한과 다르다');
  const 정본 = E.grammarGradeCounts_();
  c.급수들.forEach((s) => {
    assert.equal(s.분모, 정본[s.급] || 0, `${s.급}급 분모가 grammarGradeCounts_ 와 갈렸다 — 자가 둘이 되면 반드시 어긋난다`);
  });
  assert.ok(c.급수들.every((s) => s.분자 === 0), '아무것도 안 넘은 학생에게 분자가 0이 아니다');
});

test('[v9.279] 과녁은 유호 확정 4급이고, 봉우리 상한은 5다(6급 반은 열지 않는다)', () => {
  assert.equal(E.TOPIK_PEAK_TARGET, 4, '과녁이 4급이 아니다 — 결정.md 08-31 「몽골에서 4급까지 끌고 간다」');
  assert.equal(E.TOPIK_PEAK_MAX, 5, '봉우리 상한이 5가 아니다 — 자체 콘텐츠 상한이 5급이다');
  assert.ok(E.GRAMMAR_BANK.every((g) => g[3] >= 1 && g[3] <= E.TOPIK_PEAK_MAX),
    '뱅크에 봉우리 상한 밖 도입급이 있다 — 그 문형은 어느 봉우리에도 안 실려 «분모에서 사라진다»');
});

/* ───────────────────── 2. 없는 성공을 만들지 않는다 ───────────────────── */

test('[v9.279] 상위 급 문형만 맞힌 학생을 그 봉우리에 세우지 않는다 — 없는 성공 금지', () => {
  const c = E.토픽등반_(집합(급문형(5)), 0); // 5급을 통째로 넘었지만 1급이 비었다
  assert.equal(c.오른봉우리, 0, '아래 봉우리가 빈 채로 위 봉우리에 올려 세웠다(철학 Ⅱ-2 「없는 성공」)');
  assert.equal(c.다음봉우리, 1, '다음 봉우리는 «비어 있는 가장 아래»여야 한다');
});

test('[v9.279] 문턱을 넘어야 봉우리에 오른다 — 한 걸음 모자라면 안 오른다', () => {
  const g1 = 급문형(1);
  const 필요 = Math.ceil(g1.length * E.TOPIK_PEAK_GATE);
  const 모자람 = E.토픽등반_(집합(g1.slice(0, 필요 - 1)), 0);
  const 딱 = E.토픽등반_(집합(g1.slice(0, 필요)), 0);
  assert.equal(모자람.오른봉우리, 0, `문턱(${E.TOPIK_PEAK_GATE}) 아래인데 봉우리에 올랐다`);
  assert.equal(딱.오른봉우리, 1, '문턱을 넘었는데 봉우리에 안 올랐다');
  assert.equal(딱.다음봉우리, 2, '오른 뒤 다음 봉우리가 안 넘어간다');
});

test('[v9.279] 한 걸음의 무게 = 1/분모 — 「지금 하나 더 넘으면」의 근거', () => {
  const c = E.토픽등반_({}, 0);
  assert.equal(c.한걸음, 1 / c.지금.분모, '한 걸음이 분모의 역수가 아니다');
  assert.ok(c.한걸음 > 0, '한 걸음이 0이면 카드가 「더 넘으면」을 말할 수 없다');
});

test('[v9.279] 남은 문형은 «이름»으로 나온다 — ID 를 학생에게 보여주지 않는다', () => {
  const c = E.토픽등반_({}, 0);
  const 이름표 = E.grammarNameMap_();
  assert.ok(c.남은문형.length > 0, '아무것도 안 넘은 학생에게 남은 문형이 0이다');
  c.남은문형.forEach((g) => {
    assert.equal(g.이름, 이름표[g.id], `${g.id} 의 이름이 뱅크와 갈렸다`);
    assert.ok(!/^G\d{3}$/.test(g.이름), '학생에게 문법 ID 가 그대로 나간다');
  });
});

/* ───────────────────── 3. 출처 화이트리스트 (자가 둘이 되지 않게) ───────────────────── */

function 도달맵(행들) {
  const ml = 시트흉내({ 첫행: 1, 행들: [['student_id', 'grammar_id', '상태', '첫기록일', '도달일', '출처', 'updated_at']].concat(행들) });
  return E.토픽등반_도달맵_({ getSheetByName: (n) => (n === 'mastery_log' ? ml : null) });
}

test('[v9.279] 데모 씨앗의 lesson 발 「도달」은 안 센다 — 함께한 날과 «같은 자»', () => {
  const g = 급문형(1)[0];
  const 맵 = 도달맵([
    ['S1', g, '도달', '2026-08-01', '2026-08-02', 'lesson', ''],
    ['S2', g, '도달', '2026-08-01', '2026-08-02', 'AI첨삭', ''],
    ['S3', g, '연습', '2026-08-01', '', 'AI첨삭', '']
  ]);
  assert.equal(맵.S1, undefined, "'lesson' 출처 도달이 등반에 셌다 — 데모 씨앗 61행이 그대로 %가 된다");
  assert.deepEqual(맵.S2, { [g]: true }, 'AI첨삭 도달이 안 셌다');
  assert.equal(맵.S3, undefined, "'연습'이 '도달'로 세어졌다");
});

test('[v9.279] mastery_log 가 없거나 비어도 던지지 않는다 — 개원 첫날의 모습', () => {
  assert.deepEqual(E.토픽등반_도달맵_({ getSheetByName: () => null }), {}, '시트가 없을 때 던졌다');
  const c = E.토픽등반_({}, 0);
  assert.equal(c.오른봉우리, 0);
  assert.ok(E.등반카드HTML_(c).length > 0, '재료 0인 학생에게 카드가 통째로 비었다 — 개원일엔 전원이 그 자리다');
});

/* ───────────────────── 4. 카드가 하는 «말» ───────────────────── */

/** 카드 HTML 에서 사람이 읽는 글자만 남긴다(태그·스타일 안의 낱말이 오탐을 만들지 않게). */
const 글자만 = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ');

test('[v9.279] 카드에 비교·평가·재촉 낱말이 없다 — 철학 Ⅱ-2 발화 규격', () => {
  const 금칙 = ['합격', '불합격', '부족', '미달', '분발', '노력하', '평균', '순위', '등수', '남들', '다른 친구', '뒤처', '실패'];
  const 판들 = [E.토픽등반_({}, 0), E.토픽등반_(집합(급문형(1)), 3), E.토픽등반_(집합(E.GRAMMAR_BANK.map((g) => g[0])), 6)];
  판들.forEach((c) => {
    const t = 글자만(E.등반카드HTML_(c));
    금칙.forEach((w) => assert.ok(t.indexOf(w) === -1, `카드가 「${w}」를 말한다 — 평가·비교는 어느 화면에도 두지 않기로 했다`));
  });
});

test('[v9.279] 카드가 자기 «자»를 직접 말한다 — 철학 ⑤자기설명', () => {
  const t = 글자만(E.등반카드HTML_(E.토픽등반_({}, 3)));
  assert.ok(t.indexOf('두 번') > -1, '「서로 다른 날 두 번」이라는 자가 카드에 없다 — 다음 사람이 이 %를 합격 확률로 읽는다');
  assert.ok(t.indexOf('예측이 아니다') > -1, '「시험 점수 예측이 아니다」가 카드에 없다');
  assert.ok(t.indexOf('분모') > -1, '분모가 무엇인지 카드가 안 말한다');
});

test('[v9.279] 다 오른 학생에겐 「다음」을 말하지 않는다 — 빈 약속을 남기지 않는다', () => {
  const 전부 = E.토픽등반_(집합(E.GRAMMAR_BANK.map((g) => g[0])), 6);
  assert.equal(전부.오른봉우리, E.TOPIK_PEAK_MAX, '전부 넘었는데 마지막 봉우리에 안 섰다');
  assert.equal(전부.다올랐나, true);
  const t = 글자만(E.등반카드HTML_(전부));
  assert.ok(t.indexOf('다 올랐다') > -1, '다 오른 학생에게 완주 문장이 없다');
  assert.ok(t.indexOf('더 넘으면') === -1, '남은 것이 없는데 「더 넘으면」이 남아 있다');
  assert.ok(t.indexOf('가까이 온 것') === -1, '남은 문형이 0인데 「가까이 온 것」 칸이 남아 있다');
});

test('[v9.279] 교재 급수는 «표기»에만 쓰고 판정을 바꾸지 않는다', () => {
  const 도달 = 집합(급문형(1));
  const a = E.토픽등반_(도달, 0), b = E.토픽등반_(도달, 6);
  assert.equal(a.오른봉우리, b.오른봉우리, '교재 레벨이 등반 판정을 바꿨다 — 판정 재료는 도달뿐이어야 한다');
  assert.equal(a.분자, b.분자);
  const t = 글자만(E.등반카드HTML_(b));
  assert.ok(t.indexOf('Lv6') > -1, '교재 레벨이 카드에 안 실렸다');
  assert.ok(t.indexOf(String(E.TOPIK_PEAK_TARGET) + '급') > -1, '과녁이 카드에 안 실렸다');
});

test('[v9.279] 문형 이름은 escHtml_ 를 지나서 나간다 — 화이트리스트 파생이어도 겹으로', () => {
  const 본것 = [];
  const spy = 태우기((s) => { 본것.push(String(s == null ? '' : s)); return String(s == null ? '' : s); });
  const c = spy.토픽등반_({}, 0);
  spy.등반카드HTML_(c);
  const 기대 = c.남은문형.slice(0, 3).map((g) => g.이름);
  기대.forEach((n) => assert.ok(본것.indexOf(n) > -1, `「${n}」이 escHtml_ 를 안 지나고 HTML 로 나갔다`));
});

/* ───────────────────── 5. 열 자리 — 고정 번호를 안 쓴다 ───────────────────── */

test('[v9.279] 등반 열은 «이름»으로 찾는다 — 고정 열 번호를 안 쓴다(열 충돌 3회의 회귀 장치)', () => {
  const w = section('const CLIMB_HEADS_', '}\n');
  assert.ok(code.indexOf("profilesBlockAt_(pf, CLIMB_HEADS_)") > -1,
    '등반 열이 profilesBlockAt_ 를 안 쓴다 — 고정 번호로 쓰면 라이브의 진로 4열·「학교」·「동네」를 덮는다');
  assert.ok(code.indexOf("profilesBlockWrite_(pf, profilesBlockAt_(pf, CLIMB_HEADS_)") > -1,
    '점거 가드(profilesBlockWrite_)를 안 지난다 — 방어를 손으로 베끼면 한쪽만 낡는다');
  assert.ok(!/SHARED4_COL_HEADERS\s*=\s*\[[^\]]*등반/.test(code),
    '등반 카드가 SHARED4 고정 블록에 다시 들어갔다 — 그 블록은 번호로 쓴다');
  assert.ok(w.length > 0);
});
