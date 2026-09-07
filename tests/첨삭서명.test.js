'use strict';
/* 첨삭 서명 회귀 — 2026-09-07 (유호 지시 「명품 습관을 전부 일감에 등록해서 하나씩」 · 트랙 §0-명품 ㉡)
 *
 * 무엇을 지키나: **「이 답장을 사람이 봤나」에 거짓이 안 붙는가.**
 *   실측 09-07: `HW_FEEDBACK_HEADERS` 에 `model`·`prompt_ver`(어느 AI 가 썼나)는 있는데
 *   «누가 봐줬나» 칸이 0 이었다. 그런데 칸만 만들면 더 나쁜 자리가 열린다 —
 *   `AI_FEEDBACK_AUTOPUBLISH = true` 라 지금 첨삭은 **무인 발행**이고, 무인이 낸 '노출' 과
 *   사람이 격리를 풀어 만든 '노출' 이 시트에서 **같은 글자**다.
 *
 * 🔴 **[v9.317] 심문이 첫 판의 구멍을 잡았다**(09-07 아스트라 P0-2 · 실제 입력으로 재현).
 *   「멈췄던 길 + 노출」 둘만 보면, 사람이 격리를 푼 «뒤» 문장이 바뀌어도 그 값이 안 변해
 *   서명이 계속 살아 있다 — 서명이 **그 사람이 본 적 없는 문장**을 가리키게 된다.
 *   ⇒ 확인 기록(누가·무엇을 보고)까지 맞아야 참이다. 그 심장이 아래 두 시험이다.
 * 🔴 [v9.317] 09-07 배포 검수(코덱스)가 셋을 더 잡았다 — ①지문에 «오늘의포인트»가 빠져 그 설명만 바꾸면
 *   서명이 살아남았다 ②판정이 「언제」(확인시각)를 안 봤다 ③아래 칸 수 검사기가 문자열 속 쉼표를 칸으로 셌다.
 *   셋 다 여기서 잰다.
 *
 * ⚠ 여기서 재는 것은 **판정 코어**(`사람이봤나_`)와 **헤더 정본**뿐이다.
 *   시트에 열이 서는 층(`헤더보정_`)과 지문 계산(`카드지문_` — Apps Script `Utilities` 를 부른다)은
 *   라이브 층이라 «안 재봤다». 동의이력 회귀가 시트 래퍼를 뺀 것과 같은 선이다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
/* ⚠ 줄끝을 먼저 고른다 — 작업본이 CRLF 라 LF 표식으로 자르면 「함수 끝을 못 찾는다」로 죽는다. */
const 수집소스 = () => fs.readFileSync(path.join(ROOT, '엔진_수집.js'), 'utf8').replace(/\r\n/g, '\n');
const AI소스 = () => fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8').replace(/\r\n/g, '\n');

function 조각(src, 표식, 끝표식) {
  const s = src.indexOf(표식);
  assert.ok(s > -1, `표식을 못 찾았다: ${표식} — 이름이 바뀌었으면 이 시험부터 고친다`);
  const e = src.indexOf(끝표식, s);
  assert.ok(e > s, `끝을 못 찾았다: ${끝표식}`);
  return src.slice(s, e + 끝표식.length);
}

/* `사람이봤나_` 는 `노출카드_` 와 `발행경로_` 를 부른다 — 셋을 한 스코프에 올린다. */
const 판정 = (() => {
  const src = 수집소스();
  const 몸 = [
    조각(src, 'function 노출카드_(', '\n}\n'),
    조각(src, 'const 발행경로_ =', '\n'),
    조각(src, 'function 사람이봤나_(', '\n}\n'),
  ].join('\n');
  return new Function(몸 + '\nreturn { 사람이봤나_: 사람이봤나_, 발행경로_: 발행경로_ };')();
})();
const 봤나 = 판정.사람이봤나_;
const 길 = 판정.발행경로_;

const 지문 = 'a1b2c3d4e5f60718'; // 사람이 볼 때 찍힌 지문
const 딴지문 = 'ffffffffffffffff'; // 그 뒤 문장이 바뀌어 지금 계산되는 지문
const 시각 = '2026-09-07 06:40';  // 사람이 본 «때» — 이것도 없으면 기록이 아니다

/* ── 심장 넷 ── */

test('🔴 무인 발행이 낸 «노출» 에는 서명이 안 붙는다 — 붙으면 학생이 받는 카드 전량이 매일 거짓말이 된다', () => {
  assert.strictEqual(봤나(길.무인, '노출', '유호', 시각, 지문, 지문), false);
});

test('🔴 사람이 본 «뒤» 문장이 바뀌면 서명이 죽는다 — 안 죽으면 본 적 없는 문장에 서명이 남는다(심문 P0-2)', () => {
  assert.strictEqual(봤나(길.격리, '노출', '유호', 시각, 지문, 딴지문), false);
});

test('🔴 확인자 이름이 없으면 서명이 아니다 — 「멈췄다가 열렸다」는 사람이 봤다는 뜻이 아니다(심문 P0-2)', () => {
  assert.strictEqual(봤나(길.격리, '노출', '', 시각, 지문, 지문), false);
  assert.strictEqual(봤나(길.격리, '노출', '   ', 시각, 지문, 지문), false);
  assert.strictEqual(봤나(길.격리, '노출', null, 시각, 지문, 지문), false);
});

test('🔴 확인시각이 없으면 서명이 아니다 — 「누가·언제·무엇을 보고」 셋 중 «언제»가 빈 기록(검수 P3)', () => {
  assert.strictEqual(봤나(길.격리, '노출', '유호', '', 지문, 지문), false);
  assert.strictEqual(봤나(길.격리, '노출', '유호', '   ', 지문, 지문), false);
  assert.strictEqual(봤나(길.격리, '노출', '유호', null, 지문, 지문), false);
  assert.strictEqual(봤나(길.격리, '노출', '유호', undefined, 지문, 지문), false);
});

test('🔴 발행경로가 빈 옛 행은 «안 봤다»가 아니라 «모른다» — 모를 때는 말하지 않는다', () => {
  assert.strictEqual(봤나('', '노출', '유호', 시각, 지문, 지문), false);
  assert.strictEqual(봤나(null, '노출', '유호', 시각, 지문, 지문), false);
  assert.strictEqual(봤나(undefined, '노출', '유호', 시각, 지문, 지문), false);
});

/* ── 참이 되는 유일한 자리 ── */

test('멈춘 카드를 사람이 풀었고, 그 사람이 본 문장이 지금 문장과 같을 때만 서명이 선다', () => {
  assert.strictEqual(봤나(길.격리, '노출', '유호', 시각, 지문, 지문), true);
  assert.strictEqual(봤나(길.대기, '노출', '유호', 시각, 지문, 지문), true);
});

test('지문이 한쪽이라도 비면 거짓 — 「무엇을 보고 서명했는지」를 모르면 서명이 아니다', () => {
  assert.strictEqual(봤나(길.격리, '노출', '유호', 시각, '', 지문), false);
  assert.strictEqual(봤나(길.격리, '노출', '유호', 시각, 지문, ''), false);
  assert.strictEqual(봤나(길.격리, '노출', '유호', 시각, null, null), false);
});

/* ── 나머지 갈래 ── */

test('멈춘 채로 아직 안 풀린 카드에는 서명이 없다 — 「멈췄다」와 「사람이 봤다」는 다른 말이다', () => {
  assert.strictEqual(봤나(길.격리, '격리:짧음', '유호', 시각, 지문, 지문), false);
  assert.strictEqual(봤나(길.대기, '대기', '유호', 시각, 지문, 지문), false);
});

test('오류 행에는 서명이 없다 — 학생에게 나가지도 않은 행이다', () => {
  assert.strictEqual(봤나(길.오류, '오류:파싱실패', '유호', 시각, 지문, 지문), false);
  assert.strictEqual(봤나(길.오류, '노출', '유호', 시각, 지문, 지문), false);
});

test('낯선 발행경로는 참으로 읽지 않는다 — 어휘가 늘면 이 시험이 먼저 빨개져야 한다', () => {
  assert.strictEqual(봤나('사람', '노출', '유호', 시각, 지문, 지문), false);
  assert.strictEqual(봤나('무인 ', '노출', '유호', 시각, 지문, 지문), false);
});

test('앞뒤 공백은 접는다 — 시트 손편집이 흔한 칸이다', () => {
  assert.strictEqual(봤나(' 격리 ', '노출', ' 유호 ', 시각, ' ' + 지문 + ' ', 지문), true);
});

/* ── 지문이 «학생이 읽는 네 자리»를 다 잰다 (검수 P1 · 오늘의포인트 누락) ── */

test('🔴 카드지문_ 은 고친문장·오늘의포인트·칭찬·다음미션 넷을 받는다 — 하나라도 빠지면 그 칸만 바꾼 카드에 서명이 남는다', () => {
  const src = 수집소스();
  const m = src.match(/function 카드지문_\(([^)]*)\)/);
  assert.ok(m, '카드지문_ 를 못 찾았다');
  const 인자 = m[1].split(',').map((x) => x.trim());
  assert.deepStrictEqual(인자, ['고친문장', '오늘의포인트', '칭찬', '다음미션'], '지문 인자가 학생이 읽는 네 자리와 다르다');
  /* 인자를 받기만 하고 안 섞으면 같은 구멍이다 — 해시에 들어가는 배열이 넷을 다 품는지 본다. */
  const 몸 = 조각(src, 'function 카드지문_(', '\n}\n');
  assert.ok(/\[고친문장, 오늘의포인트, 칭찬, 다음미션\]/.test(몸), '해시 원문 배열에 넷이 그 순서로 안 들어 있다');
});

/* ── 헤더 정본 ── */

test('🔴 서명·확인 넉 칸은 헤더 «끝» 에 있다 — 중간 삽입은 소비처를 조용히 파괴한다', () => {
  const src = 수집소스();
  const m = src.match(/const HW_FEEDBACK_HEADERS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'HW_FEEDBACK_HEADERS 리터럴을 못 찾았다');
  const 헤더 = JSON.parse(m[1].replace(/'/g, '"'));
  assert.deepStrictEqual(헤더.slice(-4), ['발행경로', '확인자', '확인시각', '확인지문'], '서명·확인 넉 칸이 끝에 없다');
  assert.strictEqual(헤더.indexOf('schema_ver'), 헤더.length - 5, 'schema_ver 앞자리가 밀렸다 — 앞 20칸은 못 박혀 있다');
});

test('☠️ 헤더 배열 안에 주석이 없다 — safety 골격 대조가 이 리터럴을 JSON 으로 읽는다', () => {
  /* 09-07 실측: 배열 «안» 에 주석 한 줄을 넣었더니 시험 셋이 한꺼번에 빨개졌다.
     증상은 「JSON 파싱 실패」라 원인이 헤더라는 것이 안 보인다 — 그래서 여기서 먼저 잡는다. */
  const src = 수집소스();
  const m = src.match(/const HW_FEEDBACK_HEADERS = \[([\s\S]*?)\];/);
  assert.ok(m, 'HW_FEEDBACK_HEADERS 리터럴을 못 찾았다');
  assert.ok(!/\/\/|\/\*/.test(m[1]), '헤더 배열 안에 주석이 있다 — 배열 밖으로 뺀다');
});

/* ── 배선 ── */

test('🔴 첨삭을 쓰는 자리 «전부» 가 발행경로를 싣는다 — 하나라도 빠지면 그 행의 서명이 영영 빈다', () => {
  /* ⚠ 「참조 수 = 호출 수」로 세면 안 된다 — 한 호출 안 삼항이 발행경로_ 를 셋 쓴다(09-07 실측).
     호출 «하나씩» 잘라서 그 안에 들었는지를 본다. */
  const src = AI소스();
  const 호출들 = [];
  let i = 0;
  for (;;) {
    const s = src.indexOf('fb.appendRow([', i);
    if (s < 0) break;
    const e = src.indexOf(']);', s);
    assert.ok(e > s, 'appendRow 의 끝(`]);`)을 못 찾았다 — 표기가 바뀌었으면 이 시험부터 고친다');
    호출들.push(src.slice(s, e));
    i = e;
  }
  assert.ok(호출들.length >= 2, `첨삭 appendRow 를 ${호출들.length}곳 찾았다 — 분모 소실은 통과가 아니다`);
  const 빠진곳 = 호출들.filter((c) => c.indexOf('발행경로_') < 0).length;
  assert.strictEqual(빠진곳, 0, `appendRow ${호출들.length}곳 중 ${빠진곳}곳이 발행경로를 안 싣는다`);
});

/* appendRow 몸통의 «최상위 칸 수» — 괄호 안 쉼표(삼항·함수 인자)와 **문자열·주석 속 쉼표**는 칸이 아니다.
 *   [v9.317] 검수 P1: 첫 판은 문자열을 몰라 `',,'` 한 칸을 세 칸으로 셌다 — 칸이 빠져도 초록이었다. */
function 칸수(몸) {
  let 깊이 = 0, 줄주석 = false, 블록주석 = false, 따옴표 = null;
  const 칸들 = []; let 글자 = 0;               // 칸마다 «뜻 있는 글자» 수 — 0 이면 빈 자리(끝 쉼표 뒤)
  for (let k = 0; k < 몸.length; k++) {
    const c = 몸[k];
    if (줄주석) { if (c === '\n') 줄주석 = false; continue; }
    if (블록주석) { if (c === '*' && 몸[k + 1] === '/') { 블록주석 = false; k++; } continue; }
    if (따옴표) { 글자++; if (c === '\\') { k++; continue; } if (c === 따옴표) 따옴표 = null; continue; }
    if (c === '/' && 몸[k + 1] === '/') { 줄주석 = true; k++; continue; }
    if (c === '/' && 몸[k + 1] === '*') { 블록주석 = true; k++; continue; }
    if (c === "'" || c === '"' || c === '`') { 따옴표 = c; 글자++; continue; }
    if (c === '(' || c === '[' || c === '{') { 깊이++; 글자++; continue; }
    if (c === ')' || c === ']' || c === '}') { 깊이--; 글자++; continue; }
    if (c === ',' && 깊이 === 0) { 칸들.push(글자); 글자 = 0; continue; }
    if (!/\s/.test(c)) 글자++;
  }
  칸들.push(글자);
  /* 끝 쉼표 뒤의 빈 자리는 칸이 아니다 — JS 배열 리터럴 `[a, b,]` 는 두 칸이다. 첫 수리는 「쉼표 수 + 1」이라
     마지막 칸을 지우고 쉼표만 남겨도 24/24 로 통과했다(09-07 재지적 · 검수 P1). */
  if (칸들.length && 칸들[칸들.length - 1] === 0) 칸들.pop();
  return 칸들.length;
}

test('🔴 칸 수 검사기가 문자열·주석 속 쉼표를 칸으로 안 센다 — 세면 칸이 빠져도 초록이다(검수 P1)', () => {
  assert.strictEqual(칸수("a, b, c"), 3);
  assert.strictEqual(칸수("a, ',,', c"), 3, '작은따옴표 문자열 속 쉼표');
  assert.strictEqual(칸수('a, ",,", c'), 3, '큰따옴표 문자열 속 쉼표');
  assert.strictEqual(칸수("a, f(x, y), c ? d : e"), 3, '괄호 안 쉼표');
  assert.strictEqual(칸수("a, // x, y\n b"), 2, '줄주석 속 쉼표');
  assert.strictEqual(칸수("a, /* x, y */ b"), 2, '블록주석 속 쉼표');
  assert.strictEqual(칸수("a, 'it\\'s, ok', c"), 3, '이스케이프된 따옴표');
  assert.strictEqual(칸수("a, '', '', ''"), 4, '빈 문자열 세 칸은 세 칸이다');
  assert.strictEqual(칸수("a, b,"), 2, '끝 쉼표는 칸이 아니다 — 마지막 칸을 지우고 쉼표만 남기면 한 칸이 줄어야 한다(재지적)');
  assert.strictEqual(칸수("a, '', '',"), 3, '끝 쉼표 앞 빈 문자열 두 칸');
  assert.strictEqual(칸수("a, b, // x, y\n"), 2, '끝 쉼표 뒤 줄주석');
  assert.strictEqual(칸수(''), 0, '빈 몸통은 0칸');
});

test('🔴 쓰는 칸 수가 헤더 칸 수와 같다 — 모자라면 뒤 칸이 «적재되는 척하며» 조용히 사라진다', () => {
  /* 헤더 정본이 늘었는데 appendRow 를 안 늘리면 증상이 없다(그 시트 주석이 적은 그 함정 그대로). */
  const 헤더수 = JSON.parse(수집소스().match(/const HW_FEEDBACK_HEADERS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"')).length;
  const src = AI소스();
  let i = 0, 잰곳 = 0;
  for (;;) {
    const s = src.indexOf('fb.appendRow([', i);
    if (s < 0) break;
    const e = src.indexOf(']);', s);
    const 몸 = src.slice(s + 'fb.appendRow(['.length, e);
    const 칸 = 칸수(몸);
    assert.strictEqual(칸, 헤더수, `appendRow 하나가 ${칸}칸을 쓰는데 헤더는 ${헤더수}칸이다`);
    잰곳++; i = e;
  }
  assert.ok(잰곳 >= 2, `잰 곳이 ${잰곳}곳 — 분모 소실은 통과가 아니다`);
});

test('무인 여부는 상수에서 파생한다 — 리터럴을 다시 적으면 스위치를 내려도 안 따라온다', () => {
  const src = AI소스();
  assert.ok(/AI_FEEDBACK_AUTOPUBLISH \? 발행경로_\.무인 : 발행경로_\.대기/.test(src),
    '발행경로가 AI_FEEDBACK_AUTOPUBLISH 를 안 읽는다 — 상태 열과 갈라진다');
});

/* ── [㉡-1 부품 · 09-07] 서명을 «채우는» 통로 — onHwFeedbackEdit ── */

/* 통로 넷(편집자이름_ · 첨삭서명대상열_ · 첨삭서명찍기_ · onHwFeedbackEdit)을 가짜 의존으로 태운다. 카드지문_ 은 Utilities 층이라 흉내낸다. */
function 통로(opts) {
  const o = opts || {};
  const src = 수집소스();
  const 몸 = [
    조각(src, 'const 발행경로_ =', '\n'),
    조각(src, "const HW_SIGN_HANDLER_ = 'onHwFeedbackEdit';", '\n'),
    조각(src, 'function 편집자이름_(', '\n}\n'),
    조각(src, 'function 첨삭서명대상열_(', '\n}\n'),
    조각(src, 'function 첨삭서명찍기_(', '\n}\n'),
    조각(src, 'function onHwFeedbackEdit(', '\n}\n'),
    조각(src, 'function 첨삭서명트리거보장_(', '\n}\n'),
  ].join('\n');
  const logs = [];
  const writes = [];
  const 헤더 = o.헤더 || ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션', '상태', '학생확인', '포인트지급',
    '숙제ID', '오류태그', '재작성원본', '다시쓰기URL', '숙제문항', '급수', 'model', 'prompt_ver', 'schema_ver', '발행경로', '확인자', '확인시각', '확인지문'];
  const rows = o.rows || {};
  const sh = {
    getName: () => o.시트이름 || 'hw_feedback',
    getLastColumn: () => 헤더.length,
    getParent: () => ({ getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' }),
    getRange(r, c, n, w) {
      return {
        getValues: () => (r === 1 ? [헤더.slice(c - 1, c - 1 + (w || 1))] : [[]]),
        getValue: () => ((rows[r] || {})[헤더[c - 1]] === undefined ? '' : rows[r][헤더[c - 1]]),
        setValue: (v) => { writes.push({ r, 칸: 헤더[c - 1], v }); },
      };
    },
  };
  const e = o.e === null ? null : Object.assign({
    range: { getSheet: () => sh, getRow: () => o.row || 2, getLastRow: () => o.lastRow || o.row || 2, getColumn: () => o.col || 9, getLastColumn: () => o.lastCol || o.col || 9 },
    user: { getEmail: () => (o.user === undefined ? 'yuho@synk.im' : o.user) },
  }, o.eExtra || {});
  const triggers = o.triggers || [];
  const made = [];
  const ScriptApp = {
    getProjectTriggers: () => triggers.map(h => ({ getHandlerFunction: () => h })),
    newTrigger: (h) => ({ forSpreadsheet: () => ({ onEdit: () => ({ create: () => { made.push(h); } }) }) }),
  };
  const F = new Function('Session', 'Utilities', 'Logger', 'ScriptApp', 'SpreadsheetApp', '카드지문_',
    몸 + '\nreturn { onHwFeedbackEdit: onHwFeedbackEdit, 첨삭서명대상열_: 첨삭서명대상열_, 첨삭서명트리거보장_: 첨삭서명트리거보장_ };')(
    { getActiveUser: () => ({ getEmail: () => (o.session === undefined ? '' : o.session) }) },
    { formatDate: () => '2026-09-07 06:40' },
    { log: (m) => logs.push(String(m)) },
    ScriptApp, { getActiveSpreadsheet: () => ({}) },
    (a, b, c, d) => 'fp:' + [a, b, c, d].join('|'));
  return { F, e, writes, logs, made };
}
const 격리행 = { 발행경로: '격리', 고친문장: '고친', 오늘의포인트: '포', 칭찬: '칭', 다음미션: '미', 상태: '노출' };

test('🔴 통로 — 격리 행의 상태를 사람이 «노출»로 바꾼 그 자리에서 확인자·확인시각·확인지문 셋이 찍힌다(지문 = 지금 그 문장)', () => {
  const t = 통로({ rows: { 2: 격리행 }, col: 9 });
  t.F.onHwFeedbackEdit(t.e);
  assert.deepStrictEqual(t.writes.map(w => w.칸), ['확인자', '확인시각', '확인지문']);
  assert.strictEqual(t.writes[0].v, 'yuho@synk.im');
  assert.strictEqual(t.writes[1].v, '2026-09-07 06:40');
  assert.strictEqual(t.writes[2].v, 'fp:고친|포|칭|미', '지문은 학생이 읽는 네 자리로 — 인자 순서가 카드지문_ 과 같아야 한다');
});

test('🔴 통로 — 무인 발행 행에는 사람이 손대도 서명이 안 붙는다(그 카드를 낸 것은 배치다) · 빈 발행경로도 마찬가지', () => {
  const a = 통로({ rows: { 2: Object.assign({}, 격리행, { 발행경로: '무인' }) }, col: 5 });
  a.F.onHwFeedbackEdit(a.e);
  assert.deepStrictEqual(a.writes, []);
  const b = 통로({ rows: { 2: Object.assign({}, 격리행, { 발행경로: '' }) }, col: 5 });
  b.F.onHwFeedbackEdit(b.e);
  assert.deepStrictEqual(b.writes, []);
});

test('통로 — 좁게 본다: 다른 시트 · 헤더 행 · 서명 칸 자체를 고치는 편집 · 학생이 안 읽는 칸(포인트지급)은 즉시 return', () => {
  const 딴시트 = 통로({ rows: { 2: 격리행 }, 시트이름: 'profiles', col: 9 }); 딴시트.F.onHwFeedbackEdit(딴시트.e);
  const 헤더행 = 통로({ rows: { 2: 격리행 }, row: 1, col: 9 }); 헤더행.F.onHwFeedbackEdit(헤더행.e);
  const 서명칸 = 통로({ rows: { 2: 격리행 }, col: 22 }); 서명칸.F.onHwFeedbackEdit(서명칸.e);
  const 딴칸 = 통로({ rows: { 2: 격리행 }, col: 11 }); 딴칸.F.onHwFeedbackEdit(딴칸.e);
  [딴시트, 헤더행, 서명칸, 딴칸].forEach(t => assert.deepStrictEqual(t.writes, []));
  const 없음 = 통로({ e: null }); 없음.F.onHwFeedbackEdit(없음.e);
  assert.deepStrictEqual(없음.writes, []);
});

test('🔴 통로 — 편집자 이름을 못 얻으면 안 찍는다(모르는 이름을 지어 넣지 않는다) · e.user 가 비면 실행 계정으로 한 번 더 본다', () => {
  const a = 통로({ rows: { 2: 격리행 }, col: 9, user: '', session: '' });
  a.F.onHwFeedbackEdit(a.e);
  assert.deepStrictEqual(a.writes, []);
  assert.ok(a.logs.some(l => /이름을 못 얻었다/.test(l)), '건너뛴 사실이 로그에 남아야 한다');
  const b = 통로({ rows: { 2: 격리행 }, col: 9, user: '', session: 'owner@gmail.com' });
  b.F.onHwFeedbackEdit(b.e);
  assert.strictEqual(b.writes[0].v, 'owner@gmail.com');
});

test('통로 — 붙여넣기로 여러 행이 한꺼번에 바뀌면 격리·대기 행마다 찍고 무인 행은 건너뛴다', () => {
  const t = 통로({ rows: { 2: 격리행, 3: Object.assign({}, 격리행, { 발행경로: '무인' }), 4: Object.assign({}, 격리행, { 발행경로: '대기' }) }, row: 2, lastRow: 4, col: 5, lastCol: 8 });
  t.F.onHwFeedbackEdit(t.e);
  assert.deepStrictEqual(t.writes.map(w => w.r + ':' + w.칸), ['2:확인자', '2:확인시각', '2:확인지문', '4:확인자', '4:확인시각', '4:확인지문']);
});

test('통로 — 서명 칸이 아직 안 선 시트(옛 헤더)에는 아무것도 안 쓴다 · 설치 보장은 멱등이다', () => {
  const 옛 = 통로({ rows: { 2: 격리행 }, col: 5, 헤더: ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션', '상태'] });
  옛.F.onHwFeedbackEdit(옛.e);
  assert.deepStrictEqual(옛.writes, []);
  const 있음 = 통로({ triggers: ['onHwFeedbackEdit', 'parentSweep'] });
  assert.strictEqual(있음.F.첨삭서명트리거보장_(), '있음');
  assert.deepStrictEqual(있음.made, []);
  const 없음 = 통로({ triggers: ['parentSweep'] });
  assert.strictEqual(없음.F.첨삭서명트리거보장_(), '만듦');
  assert.deepStrictEqual(없음.made, ['onHwFeedbackEdit']);
});

test('🔴 등록층 — 매니페스트에 onHwFeedbackEdit 이 있고, resetAllTriggers 가 재설치하며, 아침 배치가 설치를 보장한다', () => {
  const src = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8').replace(/\r\n/g, '\n');
  const 매니 = 조각(src, 'function triggerManifest_(tbOn) {', '\n}\n');
  assert.ok(/'onHwFeedbackEdit'/.test(매니), '매니페스트 밖이면 워치독이 실종을 못 본다(v9.164 의 그 병)');
  const 재설치 = 조각(src, 'function resetAllTriggers(force) {', '\n}\n');
  assert.ok(/ScriptApp\.newTrigger\('onHwFeedbackEdit'\)\.forSpreadsheet\(SpreadsheetApp\.getActiveSpreadsheet\(\)\)\.onEdit\(\)\.create\(\)/.test(재설치), '전체 삭제 루프 뒤 재설치가 없으면 조용히 실종된다(이름은 글자로 — safety 회귀가 글자로 대조한다)');
  const 아침 = 조각(src, 'function morningJobs() {', '\n}\n');
  assert.ok(/safeRun\('첨삭서명트리거', 첨삭서명트리거보장_\)/.test(아침), '손으로 켜는 설정을 두지 않는다 — 아침 배치가 보장한다');
});
