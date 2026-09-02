'use strict';
/**
 * [v9.299] 폼↔응답 탭 «연결»로 찾기 회귀 — 이름이 갈라져도 응답이 안 새는가.
 *
 * ■ 무엇을 지키나 (09-03 라이브 실측이 만든 검사)
 *   폼 만들기를 두 번 누르면 `linkFormTab_` 이 이름 충돌을 날짜 접미로 피한다
 *   (`약점메모폼_응답` → `약점메모폼_응답_0724_2032`). 그때 app_state 폼ID 는 **새 폼**으로
 *   갈아끼워지는데 읽는 쪽이 옛 이름을 열면 **응답이 조용히 안 읽힌다**. 09-03 라이브에서
 *   강사 약점 메모가 정확히 그 상태였다(폼에서 「Sheets에서 보기」를 눌러 확인).
 *   ⇒ ①`폼응답탭_` 이 이름이 아니라 폼 연결로 찾는가 ②`폼탭대조_` 가 갈림을 «세는가»
 *     ③짝 목록이 실제 읽는 이름과 안 갈렸는가 ④배선(스위프·preflight)이 실재하는가.
 *
 * ■ 자 — 함수 몸을 소스에서 잘라 실제로 돌린다(폼넷.test.js 의 fnOf/load 계보).
 *   스텁은 바깥 세계(시트·폼)뿐이다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { engineSource } = require('./_engine-source');
const { 코드만 } = require('./lib/소스검사.js');

const code = engineSource();

/* [09-03] 소비자를 찾을 때는 **배포 집합 전체**를 본다 — `engineSource()` 로는 못 본다.
 *   `tests/_engine-source.js` 머리말이 밝혀 두었듯 `교재연동.js`(8번째 뒤)·`엔진_두뇌.js`(마지막)는
 *   filePushOrder 가드와 충돌해 ENGINE_FILES 에 «구조상» 못 들어간다. 그런데 목소리 폼을 쓰는
 *   코드가 바로 거기 산다(교재연동.js) — 엔진 소스만 보면 「그 키를 쓰는 코드가 없다」는
 *   **거짓 적색**이 난다(실측 09-03). 런타임엔 같은 전역이므로 검사만 넓히면 된다. */
const 배포소스 = (function () {
  const ROOT = path.resolve(__dirname, '..');
  /* ⚠ `filePushOrder` 만으로는 모자란다 — 만족도팩.js 처럼 그 목록에 없는데도 `.claspignore`
   *   허용으로 라이브에 올라가는 파일이 있다(09-03 실측: clasp push 17개 ↔ filePushOrder 15개).
   *   ⇒ 루트의 `.js` 전부를 본다. `_` 로 시작하는 것(`_보류_…`)만 뺀다 — 그건 배포에서 빠진 자리다. */
  const 파일들 = fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .filter((f) => fs.statSync(path.join(ROOT, f)).isFile());
  return 파일들.map((f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return ''; } }).join('\n');
})();

function fnOf(name) {
  const s = code.indexOf('function ' + name + '(');
  assert.notEqual(s, -1, name + ' 정의를 찾지 못함');
  const e = code.indexOf('\nfunction ', s + 10);
  return code.slice(s, e === -1 ? code.length : e);
}
function load(name, deps) {
  deps = deps || {};
  const names = Object.keys(deps);
  return new Function(...names, fnOf(name) + '\nreturn ' + name + ';')(...names.map((n) => deps[n]));
}

/** 시트 흉내 — getFormUrl 이 폼 연결을 흉내낸다(폼 없는 탭은 null 또는 예외). */
function 탭(name, formUrl, 던지나) {
  return {
    getName: () => name,
    getFormUrl: () => { if (던지나) throw new Error('폼 없음'); return formUrl || null; },
    getLastRow: () => 5,
  };
}
function 문서(탭들) {
  return {
    getSheets: () => 탭들,
    getSheetByName: (n) => 탭들.find((s) => s.getName() === n) || null,
  };
}
const 폼URL = (id) => 'https://docs.google.com/forms/d/' + id + '/edit';

/* ── ① 폼응답탭_ — 이름이 아니라 연결로 찾는다 ─────────────────────── */

test('🔑 이름이 갈라져도 «폼이 쓰는 탭»을 찾는다 — 09-03 강사 메모가 새던 바로 그 자리', () => {
  const 폼응답탭_ = load('폼응답탭_');
  const ss = 문서([
    탭('약점메모폼_응답', null),                       // 옛 탭 — 폼 연결이 없다
    탭('약점메모폼_응답_0724_2032', 폼URL('FID-NEW')), // 폼이 실제로 쓰는 탭
  ]);
  const got = 폼응답탭_(ss, 'FID-NEW', '약점메모폼_응답');
  assert.equal(got.getName(), '약점메모폼_응답_0724_2032',
    '이름 폴백이 이겨 버리면 09-03 결함이 그대로 남는다');
});

test('폼ID 가 비면 이름으로 떨어진다 — 아직 안 만든 폼에서 새 실패 모드를 만들지 않는다', () => {
  const 폼응답탭_ = load('폼응답탭_');
  const ss = 문서([탭('퀴즈폼_응답', null)]);
  assert.equal(폼응답탭_(ss, '', '퀴즈폼_응답').getName(), '퀴즈폼_응답');
  assert.equal(폼응답탭_(ss, null, '퀴즈폼_응답').getName(), '퀴즈폼_응답');
});

test('어느 탭도 그 폼을 안 물면 이름으로 떨어진다(옛 동작 보존)', () => {
  const 폼응답탭_ = load('폼응답탭_');
  const ss = 문서([탭('마감폼_응답', 폼URL('OTHER'))]);
  assert.equal(폼응답탭_(ss, 'FID-X', '마감폼_응답').getName(), '마감폼_응답');
  assert.equal(폼응답탭_(ss, 'FID-X', ''), null, '폴백 이름이 없으면 null — 대조가 이 값을 쓴다');
});

test('🔴 getFormUrl 이 던지는 탭을 만나도 계속 훑는다 — 한 탭 때문에 전체가 죽으면 안 된다', () => {
  const 폼응답탭_ = load('폼응답탭_');
  const ss = 문서([
    탭('보통탭', null, true),                 // 예외를 던진다
    탭('직장기록_응답', 폼URL('FID-JOB')),
  ]);
  assert.equal(폼응답탭_(ss, 'FID-JOB', '').getName(), '직장기록_응답');
});

test('부분 일치로 엉뚱한 탭을 물지 않는다 — 폼ID 는 URL 안에 통째로 들어 있어야 한다', () => {
  const 폼응답탭_ = load('폼응답탭_');
  const ss = 문서([탭('설문폼_응답', 폼URL('AAA-BBB'))]);
  assert.equal(폼응답탭_(ss, 'ZZZ', ''), null);
  assert.equal(폼응답탭_(ss, 'AAA-BBB', '').getName(), '설문폼_응답');
});

/* ── ② 폼탭대조_ — 갈림을 «세는가» ────────────────────────────────── */

function 대조하기(짝들, 상태, 탭들, FormApp) {
  const 폼응답탭_ = load('폼응답탭_');
  const 폼탭대조_ = load('폼탭대조_', {
    ensureSheet: () => ({}),
    getState: (st, k) => (상태[k] ? { val: 상태[k], row: 1 } : { row: -1 }),
    폼탭짝_: () => 짝들,
    폼응답탭_,
    FormApp: FormApp || { openByUrl: () => { throw new Error('폼 못 엶'); } },
  });
  return 폼탭대조_(문서(탭들));
}

test('🔑 갈린 짝을 잡아낸다 — 키·기대 이름·실제 이름을 함께 낸다(처방이 서게)', () => {
  const r = 대조하기(
    [['약점메모폼ID', '약점메모폼_응답']],
    { 약점메모폼ID: 'FID-1' },
    [탭('약점메모폼_응답', null), 탭('약점메모폼_응답_0724_2032', 폼URL('FID-1'))]);
  assert.equal(r.갈림.length, 1);
  assert.deepEqual(r.갈림[0], { 키: '약점메모폼ID', 이름: '약점메모폼_응답', 실제: '약점메모폼_응답_0724_2032' });
  assert.equal(r.정상, 0);
});

test('이름이 맞으면 정상으로 센다', () => {
  const r = 대조하기([['마감폼ID', '마감폼_응답']], { 마감폼ID: 'F2' }, [탭('마감폼_응답', 폼URL('F2'))]);
  assert.equal(r.갈림.length, 0);
  assert.equal(r.정상, 1);
});

test('🔴 아직 안 만든 폼은 «미생성»이지 갈림이 아니다 — 0을 한 갈래로 뭉치지 않는다', () => {
  const r = 대조하기(
    [['퀴즈폼ID', '퀴즈폼_응답'], ['대화폼ID', '대화폼_응답']],
    {},                       // 폼ID 가 하나도 없다(개원 전 상태)
    [탭('퀴즈폼_응답', null)]);
  assert.equal(r.갈림.length, 0, '안 만든 폼을 결함으로 세면 따를 수 없는 경보가 된다');
  assert.equal(r.미생성, 2);
});

test('폼은 있는데 이 문서에 응답 탭이 없으면 «확인불가» — 정상으로도 갈림으로도 안 센다', () => {
  const r = 대조하기([['면접폼ID', '면접기록_응답']], { 면접폼ID: 'F9' }, [탭('딴탭', null)]);
  assert.equal(r.확인불가, 1);
  assert.equal(r.갈림.length, 0);
  assert.equal(r.정상, 0);
});

/* ── ②-B 게시 URL 갈래(레벨테스트) — codex 배포검수 P1② ──────────── */

const 게시 = (id) => 'https://docs.google.com/forms/d/e/' + id + '/viewform';
function 폼앱(pubById) {
  return { openByUrl: (edit) => {
    const id = String(edit).match(/\/forms\/d\/([^/]+)\//)[1];
    if (!pubById[id]) throw new Error('그 폼을 못 엶');
    return { getPublishedUrl: () => pubById[id] };
  } };
}

test('🔑 게시 URL 갈래 — 그 탭에 «다른 폼»이 쓰고 있으면 갈림으로 잡는다', () => {
  const r = 대조하기(
    [['레벨테스트URL', '레벨테스트_응답', 'url']],
    { 레벨테스트URL: 게시('PUB-학생에게-나간-폼') },
    [탭('레벨테스트_응답', 폼URL('EDIT-딴폼'))],
    폼앱({ 'EDIT-딴폼': 게시('PUB-딴폼') }));
  assert.equal(r.갈림.length, 1, '학생에게 나간 폼의 응답이 딴 탭에 쌓이는데 정상으로 셌다');
  assert.equal(r.정상, 0);
});

test('게시 URL 갈래 — 같은 폼이면 정상(꼬리 ?usp=…·/viewform 차이는 무시한다)', () => {
  const r = 대조하기(
    [['레벨테스트URL', '레벨테스트_응답', 'url']],
    { 레벨테스트URL: 게시('PUB-1') + '?usp=sf_link' },
    [탭('레벨테스트_응답', 폼URL('EDIT-1'))],
    폼앱({ 'EDIT-1': 게시('PUB-1') }));
  assert.equal(r.갈림.length, 0, '꼬리 차이를 갈림으로 세면 매번 거짓 경보가 뜬다');
  assert.equal(r.정상, 1);
});

test('게시 URL 갈래 — 폼을 못 열면 «확인불가»(갈림으로도 정상으로도 안 센다)', () => {
  const r = 대조하기(
    [['레벨테스트URL', '레벨테스트_응답', 'url']],
    { 레벨테스트URL: 게시('PUB-1') },
    [탭('레벨테스트_응답', 폼URL('EDIT-없는폼'))],
    폼앱({}));
  assert.equal(r.확인불가, 1);
  assert.equal(r.갈림.length, 0);
});

test('게시 URL 갈래 — 탭의 폼 연결이 끊겼으면 «확인불가»', () => {
  const r = 대조하기(
    [['레벨테스트URL', '레벨테스트_응답', 'url']],
    { 레벨테스트URL: 게시('PUB-1') },
    [탭('레벨테스트_응답', null)], 폼앱({}));
  assert.equal(r.확인불가, 1);
});

/* ── ③ 짝 목록이 실물과 안 갈렸는가 ──────────────────────────────── */

test('🔴 짝 목록의 이름은 «짝 목록 밖의 코드»가 실제로 쓰는 이름과 같다 — 낡으면 대조가 거짓 초록을 낸다', () => {
  /* [codex 재검수 P2] 옛 판은 소스 «전체»에서 찾았다 — 그런데 그 소스에 `폼탭짝_` 정의가 들어 있어
   *   단언이 **자기 자신을 다시 읽고** 있었다(목록에 무슨 이름을 적든 초록). 소비자가 딴 이름을
   *   써도 안 잡히니 이 검사가 지키려던 것을 정확히 놓친다.
   *   ⇒ 짝 목록 정의를 «도려낸» 소스에서 찾는다. 그러면 「그 이름을 실제로 쓰는 다른 코드」만 남는다. */
  const 폼탭짝_ = load('폼탭짝_');
  const 짝 = 폼탭짝_();
  assert.ok(짝.length >= 17, '짝이 ' + 짝.length + '개로 줄었다 — 분모가 줄면 초록이 거짓말한다');

  /* 도려내기는 «배포소스 자신»에서 자른다 — engineSource 로 자른 조각은 줄끝이 달라 안 물린다(09-03). */
  const s0 = 배포소스.indexOf('function 폼탭짝_(');
  assert.notEqual(s0, -1, '폼탭짝_ 정의를 배포 집합에서 못 찾았다');
  const e0 = 배포소스.indexOf('\nfunction ', s0 + 10);
  const 밖 = 코드만(배포소스.slice(0, s0) + '\n/* 짝 목록 정의는 도려냈다 */\n' +
    배포소스.slice(e0 === -1 ? 배포소스.length : e0));
  assert.equal(밖.indexOf("['약점메모폼ID', '약점메모폼_응답']"), -1,
    '짝 목록 정의가 안 도려내졌다 — 이 검사는 다시 자기 자신을 본다(이 줄이 P2 의 재발 감시다)');
  assert.ok(밖.includes("setState(st, '목소리폼ID'"),
    '배포 집합 전체를 안 보고 있다 — 교재연동.js 가 시야 밖이면 거짓 적색이 난다');

  짝.forEach(([key, tab]) => {
    assert.ok(밖.includes("'" + key + "'"),
      '폼ID 키 ' + key + ' 를 «쓰는» 코드가 짝 목록 밖에 없다(목록이 낡았거나 소비자가 사라졌다)');
    assert.ok(밖.includes("'" + tab + "'"),
      '응답 탭 ' + tab + ' 을 «여는» 코드가 짝 목록 밖에 없다(소비자가 딴 이름을 쓰고 있다)');
  });
  const keys = 짝.map((p) => p[0]);
  assert.equal(new Set(keys).size, keys.length, '같은 폼ID 키가 두 번 — 대조가 같은 자리를 두 번 센다');
});

/* ── ④ 배선 ──────────────────────────────────────────────────────── */

test('🔑 약점메모 스위프가 «이름»이 아니라 폼응답탭_ 으로 탭을 잡는다', () => {
  const 몸 = 코드만(fnOf('sweepTeacherMemoForm_'));
  assert.ok(/폼응답탭_\(ss,/.test(몸), '스위프가 폼 연결로 안 찾는다 — 09-03 결함이 되살아났다');
  assert.ok(!/const src = ss\.getSheetByName\('약점메모폼_응답'\)/.test(몸),
    '옛 직접 열기가 남아 있다');
});

test('🔴 포인터는 «표식이 지금 탭과 같을 때만» 쓴다 — 첫 실행이 바로 위험한 순간이다(codex P1)', () => {
  const 몸 = 코드만(fnOf('sweepTeacherMemoForm_'));
  assert.ok(/약점메모폼_포인터탭/.test(몸), '읽은 탭 이름을 안 적는다 — 탭이 갈리면 포인터가 뜻을 잃는다');
  assert.ok(/let from = \(이전탭 === 지금탭\)/.test(몸),
    '표식이 «같을 때만» 쓰는 꼴이 아니다 — 「이전탭 && …」 로 가드하면 표식이 없는 첫 판을 통과시킨다');
  assert.ok(!/if \(이전탭 && 이전탭 !== 지금탭\)/.test(몸), '옛 가드가 남아 있다(첫 판 구멍)');
  // 순서: 표식 판정이 «클램프보다 앞»이어야 한다 — 뒤면 클램프가 먼저 포인터를 내리고 return 해 버린다
  const i판정 = 몸.indexOf('이전탭 === 지금탭');
  const i클램프 = 몸.indexOf('from > last');
  assert.ok(i판정 !== -1 && i클램프 !== -1 && i판정 < i클램프,
    '표식 판정이 클램프 뒤에 있다 — 새 탭 첫 행이 다시 사라진다');
});

test('🔴 조립 점검이 «확인불가»를 초록으로 안 낸다 — 못 잰 것은 통과가 아니다(codex P1)', () => {
  const s = code.indexOf('function preflightGlide(');
  const e = code.indexOf('\nfunction ', s + 10);
  const 몸 = 코드만(code.slice(s, e === -1 ? code.length : e));
  const i대조 = 몸.indexOf('폼탭대조_(ss)');
  const 절 = 몸.slice(i대조, i대조 + 1600);
  assert.ok(/대조\.확인불가/.test(절), '확인불가를 아예 안 본다');
  assert.ok(/else if \(대조\.확인불가\)[\s\S]{0,400}?warn\(/.test(절),
    '확인불가인데 ok() 로 찍는다 — 응답이 안 읽히는 경로가 ✅ 로 통과한다');
});

test('조립 점검(preflight)이 폼↔탭 대조를 부른다 — 사람 눈에 안 기댄다', () => {
  const s = code.indexOf('function preflightGlide(');
  assert.notEqual(s, -1);
  const e = code.indexOf('\nfunction ', s + 10);
  const 몸 = 코드만(code.slice(s, e === -1 ? code.length : e));
  assert.ok(/폼탭대조_\(ss\)/.test(몸), 'preflight 가 대조를 안 부른다 — 갈림이 다시 사람 눈 몫이 된다');
});
