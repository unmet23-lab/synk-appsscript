'use strict';
/**
 * [v9.241] 수집 탭 워치독 회귀 — 「수집 탭이 사라져도 배치가 정상을 보고한다」의 두 축 (대기열 #Q89).
 *
 * ■ 발단(실측)
 *   주간 워치독의 필수 시트 목록이 **손 목록**이었다. 실측: 손 35종 · 골격 53종 · 손이 한 번도
 *   못 보던 22종. 그 22종에 학습 수집 장부 6종이 전부 들어 있었다 —
 *   voice_log · talk_index_log · mastery_log · quiz_log · hw_feedback · teacher_gold.
 *   학습 증거는 **소급이 안 된다**(잃으면 다시 못 모은다). 이 함수는 같은 병을 이미 두 번 앓았다:
 *   v9.144 월키 열 목록 · v9.202 트리거 목록 — 처방은 매번 같았다, **선언에서 도출한다.**
 *
 * ■ 이 회귀가 지키는 것 넷
 *   ① 목록이 `sheetSkeleton_()` 에서 나온다 — 손 목록으로 되돌아가면 빨개진다.
 *   ② 갈아타며 감시가 **좁아지지 않았다** — 옛 손 목록 35종을 픽스처로 못박고 전건 포함을 잰다.
 *      (도출 교체의 유일한 사고 모양이 이것이다: 넓힌 줄 알았는데 넷을 흘리는 것.)
 *   ③ 「없다」가 두 뜻으로 갈린다 — 지워짐(경보)과 아직 안 태어남(정보). 안 가르면 미개원 상태에서
 *      수십 개가 매주 «누락»으로 떠서 사람이 이 점검을 통째로 무시한다(따를 수 없는 경보 · F103).
 *   ④ **탭이 있는지로는 못 보는 사고**를 «몇 줄 남았나»로 잡는다 — 탭을 지워도 야간 배치의
 *      `ensureSheet` 가 빈 시트로 되살리므로 주간 워치독이 볼 때는 «있다»(v9.197 이 자기선언 한 탭에
 *      이미 적어 둔 말이다). 되살아난 빈 시트는 **행 수가 안 되살아난다.**
 *
 * ■ 탐지력은 픽스처가 진다 · 실저장소에는 거짓양성과 **분모**만 묻는다(F207).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');
const { 코드만 } = require('./lib/소스검사.js');

const ROOT = process.env.SYNK_TEST_SRC_ROOT || path.resolve(__dirname, '..');

/** 톱레벨 `const` 문자열 — vm 컨텍스트 객체엔 안 올라오므로(렉시컬 선언) 소스에서 뜬다. */
function 문자열상수(name) {
  const m = new RegExp('const ' + name + " = '([^']*)'").exec(engineSource());
  assert.ok(m, name + ' 문자열 상수를 못 찾았다 — 이 검사가 조용히 엉뚱한 키를 재는 자리다');
  return m[1];
}
const 자기선언탭 = 문자열상수('SELF_DECLARE_TAB_');

/** 스크립트 속성 흉내 — 이 축의 판정이 전부 여기 걸려 있어 값을 직접 들여다본다. */
function 속성흉내(초기) {
  const 통 = Object.assign({}, 초기 || {});
  return {
    통: 통,
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(통, k) ? 통[k] : null),
    setProperty: (k, v) => { 통[k] = String(v); },
    deleteProperty: (k) => { delete 통[k]; },
  };
}

/** 엔진을 vm 에 올린다 — 스크립트 속성만 내가 쥔다(나머지는 호출되면 안 되는 자리라 stub). */
function 엔진(속성) {
  const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
  const ctx = {
    SpreadsheetApp: stub, Utilities: stub, Session: stub, MailApp: stub, GmailApp: stub,
    UrlFetchApp: stub, DriveApp: stub, FormApp: stub, DocumentApp: stub, ScriptApp: stub,
    CacheService: stub, LockService: stub, HtmlService: stub, Logger: { log: () => {} }, console,
    PropertiesService: { getScriptProperties: () => 속성, getUserProperties: () => 속성, getDocumentProperties: () => 속성 },
  };
  vm.createContext(ctx);
  vm.runInContext(engineSource(), ctx);
  return ctx;
}

/** 이름 있는 시트 흉내 — `탭수축_` 은 `getName()` 으로 속성 키를 짓는다. */
function 탭흉내(이름, 행들) {
  return Object.assign(시트흉내({ 첫행: 2, 행들: 행들.map((v) => [v]) }), { getName: () => 이름 });
}

// ── ① 탐지력 (픽스처) — 「없다」를 두 뜻으로 가른다 ──────────────────────────

test('🔴 탐지력 — 한 번이라도 있었는데 지금 없으면 «지워짐»(경보)이다', () => {
  const ctx = 엔진(속성흉내());
  const r = ctx.탭없음가르기_(['a', 'b'], { b: true }, { a: true, b: true });
  assert.deepEqual([...r.지워짐], ['a']);
  assert.deepEqual([...r.미출생], []);
});

test('🔴 탐지력 — 한 번도 없었으면 «아직 안 태어남»(정보)이다 — 경보로 세면 미개원 내내 늑대소년이 된다', () => {
  const ctx = 엔진(속성흉내());
  const r = ctx.탭없음가르기_(['a', 'b'], { b: true }, { b: true });
  assert.deepEqual([...r.지워짐], []);
  assert.deepEqual([...r.미출생], ['a']);
});

test('🔑 탐지력 — 지금 있으면 명부에 있든 없든 어느 쪽도 아니다', () => {
  const ctx = 엔진(속성흉내());
  const r = ctx.탭없음가르기_(['a', 'b'], { a: true, b: true }, { a: true });
  assert.deepEqual([...r.지워짐], []);
  assert.deepEqual([...r.미출생], []);
});

// ── ② 탐지력 (픽스처) — «몇 줄 남았나» ──────────────────────────────────────

test('🔴 탐지력 — 줄면 잡고, 기준선은 **안 내린다**(고칠 때까지 리포트에 남아야 한다)', () => {
  const 속성 = 속성흉내({ '탭최고건수_quiz_log': '5' });
  const ctx = 엔진(속성);
  const r = ctx.탭수축_(탭흉내('quiz_log', ['a', 'b']));
  assert.equal(r.줄었나, true);
  assert.equal(r.hwm, 5);
  assert.equal(r.지금, 2);
  assert.equal(속성.통['탭최고건수_quiz_log'], '5', '줄었는데 기준선이 따라 내려갔다 — 다음 주엔 조용해진다');
});

test('🔑 탐지력 — 늘면 기준선이 올라가고 경보는 없다', () => {
  const 속성 = 속성흉내({ '탭최고건수_quiz_log': '2' });
  const ctx = 엔진(속성);
  const r = ctx.탭수축_(탭흉내('quiz_log', ['a', 'b', 'c']));
  assert.equal(r.줄었나, false);
  assert.equal(속성.통['탭최고건수_quiz_log'], '3');
});

test('🔑 탐지력 — 기준선이 없으면 첫 실행은 조용히 기준만 깐다(첫 주 거짓 경보 0)', () => {
  const 속성 = 속성흉내();
  const ctx = 엔진(속성);
  const r = ctx.탭수축_(탭흉내('voice_log', ['a', 'b']));
  assert.equal(r.줄었나, false);
  assert.equal(속성.통['탭최고건수_voice_log'], '2');
});

test('🔴 탐지력 — **가운데를 파낸 삭제**를 잡는다(행 인덱스로 재면 통째로 안 보인다)', () => {
  /* 마지막 행은 가운데를 지워도 그대로다. `getLastRow()` 로 세는 순간 이 사고가 사라진다 —
   * v9.197 이 자기선언에서 이미 실측한 자리이고, 공용 통로로 넓히면서 그 성질을 잃으면 안 된다. */
  const 속성 = 속성흉내({ '탭최고건수_talk_log': '4' });
  const ctx = 엔진(속성);
  const sh = 탭흉내('talk_log', ['a', 'b', 'c', 'd']);
  sh.getRange(3, 1, 2, 1).clearContent();          // 가운데 2건만 비운다 — 마지막 행은 그대로
  assert.equal(sh.getLastRow(), 5, '흉내가 라이브와 다르다 — 이 픽스처의 전제가 깨졌다');
  const r = ctx.탭수축_(sh);
  assert.equal(r.줄었나, true, '가운데를 파낸 삭제를 못 봤다 — 기록 수가 아니라 행 인덱스를 세고 있다');
  assert.equal(r.지금, 2);
});

test('🔑 탐지력 — 자기선언은 **옛 키의 기준선을 물려받는다**(안 물려받으면 그 사이 삭제가 안 보인다)', () => {
  const 속성 = 속성흉내({ '자기선언이력_최고건수': '9' });
  const ctx = 엔진(속성);
  const r = ctx.탭수축_(탭흉내(자기선언탭, ['a']));
  assert.equal(r.hwm, 9, '구 키를 안 읽었다 — v9.197 이 쌓아 온 기준선이 0으로 리셋된다');
  assert.equal(r.줄었나, true);
});

test('🔑 탐지력 — 의도한 축소는 기준선을 지운다(구 키까지)', () => {
  const 속성 = 속성흉내({ '탭최고건수_mastery_log': '7', '자기선언이력_최고건수': '3', '탭최고건수_self_declare_log': '3' });
  const ctx = 엔진(속성);
  ctx.탭수축기준선지움_('mastery_log');
  ctx.탭수축기준선지움_(자기선언탭);
  assert.equal(속성.통['탭최고건수_mastery_log'], undefined);
  assert.equal(속성.통['탭최고건수_self_declare_log'], undefined);
  assert.equal(속성.통['자기선언이력_최고건수'], undefined, '구 키가 남으면 다음 실행이 그것을 물려받아 되살아난다');
});

// ── ③ 실저장소 — 도출·분모·좁아짐 금지 ─────────────────────────────────────

/** 교체 직전의 손 목록 35종 — **역사라 안 낡는다**(픽스처로 못박는 이유). */
const 옛손목록 = [
  'profiles', 'point_logs', 'attendance', 'teacher_checkins', 'notices', 'form_responses',
  'contents', 'class_stats', 'app_state', 'raid', 'schedule', 'monthly_snapshot', 'titles',
  'achievements', 'story', 'manual_titles', 'teacher_stats', 'report_cards', 'league_history',
  'class_fuel', 'weekly_topics', 'hw_batch', 'today_board', 'league_pairs', 'world_raid',
  'synk_stories', 'synk_cards', 'academic_log', 'exit_log', 'absence_notice', 'inquiries',
  'payments', 'outcome_log', 'trajectory', 'self_declare_log',
];

test('🔑 실저장소 — 감시 목록이 골격에서 나오고, 옛 손 목록 35종을 **하나도 안 흘렸다**', () => {
  const ctx = 엔진(속성흉내());
  const 골격탭 = ctx.sheetSkeleton_().map((k) => String(k[0]));
  assert.ok(골격탭.length >= 갯수하한, `골격이 ${골격탭.length}종밖에 안 된다 — 도출 원천이 줄었다(분모가 줄면 초록이 거짓말한다)`);
  const 흘린것 = 옛손목록.filter((n) =>골격탭.indexOf(n) === -1);
  assert.deepEqual(흘린것, [], `도출로 갈아타며 감시에서 사라진 탭 — ${흘린것.join(', ')}`);
});
const 갯수하한 = 53;   // 교체 직전 골격 실측치. 아래로 내려가면 원천이 줄었다는 뜻이다.

test('🔴 실저장소 — 워치독이 손 목록으로 되돌아가지 않았다(등록층)', () => {
  const src = fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');
  assert.ok(/const 골격탭 = sheetSkeleton_\(\)/.test(src),
    '워치독이 골격에서 도출하지 않는다 — 새 시트가 생겨도 감시에 안 든다');
  assert.ok(!코드만(src).includes('const reqSheets'),
    '손 목록 `reqSheets` 가 되살아났다 — v9.144·v9.202 와 같은 병의 네 번째가 된다');
});

test('🔑 실저장소 — 수집 장부 목록도 **골격 세 번째 칸에서 도출**하고, #Q89 의 6종을 전부 든다', () => {
  const ctx = 엔진(속성흉내());
  const 수집 = ctx.수집장부탭_();
  const 표식 = 문자열상수('수집표식_');
  const 골격수집 = ctx.sheetSkeleton_().filter((k) => k[2] === 표식).map((k) => String(k[0]));
  assert.deepEqual(수집.join('|'), 골격수집.join('|'), '수집 목록이 골격 도출이 아니다 — 손 목록이 또 생겼다');
  const 여섯 = ['voice_log', 'talk_index_log', 'mastery_log', 'quiz_log', 'hw_feedback', 'teacher_gold'];
  const 빠짐 = 여섯.filter((n) => 수집.indexOf(n) === -1);
  assert.deepEqual(빠짐, [], `#Q89 가 지목한 수집 탭이 «줄었나» 감시 밖이다 — ${빠짐.join(', ')}`);
  assert.ok(수집.length >= 여섯.length, `수집 장부 ${수집.length}종 — 0이면 표식이 통째로 날아간 것이다`);
});

test('🔑 실저장소 — 데모 퇴장이 지우는 수집 탭은 **기준선도 함께** 지운다(따를 수 없는 경보 차단)', () => {
  /* `exitDemoMode` 의 `wipe` 는 mastery_log 등에서 행을 지운다. 기준선을 안 내리면 개원 첫 주
   * 워치독이 「수집 장부가 줄었다」고 외치는데, 그건 우리가 시킨 정리다 — 처방이 없는 경보다. */
  const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const i = 셋업.indexOf('const wipe = (name, pred, width)');
  assert.notEqual(i, -1, 'wipe 를 못 찾았다 — 이 검사가 조용히 0건이 되는 자리다');
  const 구역 = 셋업.slice(i, 셋업.indexOf('const isDemoSid', i));
  /* 🔴 **조건까지 못박는 이유** — 초판은 `탭수축기준선지움_(name)` 이 «있나»만 봤고, 변이 시험에서
   *   `if (n)` → `if (false)` 를 통과시켰다(변이 10 중 유일한 구멍이었다). 호출문은 그대로 남고
   *   실행만 죽는 형태라 낱말 검사로는 원리상 안 보인다 — 새는 방향은 언제나 「통과」다(맹점 ④).
   *   `n` = 실제로 지운 행 수. 0행이면 기준선을 건드릴 이유가 없으니 조건 자체가 규격이다. */
  assert.ok(/if\s*\(\s*n\s*\)\s*\{?\s*탭수축기준선지움_\(name\)/.test(구역),
    'wipe 가 기준선을 안 지운다(또는 죽은 조건 아래 있다) — 의도한 축소가 다음 주 경보로 되돌아온다');
});
