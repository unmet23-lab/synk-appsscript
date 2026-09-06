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
  /* 🔴 승계는 **한 번뿐이어야 한다**(①배포 검수 P2). 옛 키가 살아 있으면 경보문이 시키는 대로
   *   새 키를 지워도 다음 실행이 옛 키에서 같은 기준선을 다시 물어 와 **같은 경보가 영원히 반복**된다
   *   — 따를 수 없는 처방이라 사람이 그 점검을 통째로 무시하게 된다(F103). */
  assert.equal(속성.통['자기선언이력_최고건수'], undefined, '옛 키가 안 지워졌다 — 처방대로 새 키를 지워도 경보가 되살아난다');
  assert.equal(속성.통['탭최고건수_self_declare_log'], '9', '승계한 값을 새 키에 안 옮겼다 — 기준선이 통째로 증발한다');
  delete 속성.통['탭최고건수_self_declare_log'];               // 원장이 처방대로 지웠다
  assert.equal(ctx.탭수축_(탭흉내(자기선언탭, ['a'])).줄었나, false, '처방을 따랐는데 경보가 되살아난다');
});

test('🔑 탐지력 — 오염된 기준선(NaN)은 감시를 «조용히» 끄지 않는다', () => {
  /* `Number('없음')` = NaN 이고 NaN 비교는 전부 false 라, 오염 한 번이면 그 탭은 영영 안 빨개진다.
   * 0으로 접어 첫 실행처럼 기준을 새로 깐다(①배포 검수 P3 · f84cc19e7eba). */
  const 속성 = 속성흉내({ '탭최고건수_quiz_log': '없음' });
  const ctx = 엔진(속성);
  const r = ctx.탭수축_(탭흉내('quiz_log', ['a', 'b']));
  assert.equal(r.hwm, 0);
  assert.equal(r.줄었나, false);
  assert.equal(속성.통['탭최고건수_quiz_log'], '2', '오염된 값을 새 기준으로 못 갈아 끼웠다 — 다음 주도 같은 상태다');
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

test('🔴 실저장소 — 첫 실행 명부가 **옛 필수 35종으로 깔린다**(교체가 기존 경보를 지우면 안 된다)', () => {
  /* 🔴 ①배포 검수 P1: 명부가 빈 채로 첫 실행을 맞으면 «그때 이미 없는» 탭이 전부 「아직 안 태어남」
   *   (정보)으로 접힌다 — 옛 판이 「누락 시트」로 외치던 경보가 교체 순간 조용히 사라진다.
   *   즉 이 판의 첫 실행이 **경보를 지우는 마이그레이션**이 될 뻔했다. 씨앗은 역사라 안 낡는다. */
  const ctx = 엔진(속성흉내());
  /* ⚠ 이 `엔진(...)` 호출 자체가 **로드 순서 가드**다 — 씨앗을 톱레벨 const 로 두면 여기서
   *   `ReferenceError: Cannot access 'OUTCOME_TAB_' before initialization` 로 죽는다(실제로 한 번 죽었다).
   *   라이브에서는 그게 전 트리거 즉사라 이 적색이 가장 값싼 자리다. */
  /* ⚠ vm 이 만든 배열은 호스트와 렐름이 달라 `deepStrictEqual` 이 값이 같아도 실패한다 —
   *   이 저장소의 관례대로 **문자열로 눌러서** 본다(월키원인차단.test.js 와 같은 이음매). */
  const 씨앗 = [...ctx.옛필수탭_()].map(String);
  assert.equal(씨앗.slice().sort().join('|'), 옛손목록.slice().sort().join('|'),
    '첫 실행 씨앗이 옛 손 목록 35종과 갈렸다 — 갈린 만큼 교체 순간 경보가 사라지거나 없던 경보가 생긴다');
  /* 🔴 씨앗이 «실제로 깔리는가»까지 잰다 — 상수만 맞고 안 쓰이면 그게 정확히 그 사고다
   *   (2차 변이에서 이 구멍으로 한 번 통과했다: 씨앗은 그대로 두고 쓰는 줄만 되돌렸더니 전건 초록). */
  const 첫실행 = ctx.본적명부_(null);
  assert.equal(씨앗.filter((n) => !첫실행[n]).join('|'), '', '첫 실행 명부에 옛 필수 탭이 안 깔린다');
  const r = ctx.탭없음가르기_(씨앗, {}, 첫실행);
  assert.equal([...r.미출생].join('|'), '', '옛 필수 탭이 「안 태어남」으로 접힌다 — 그게 경보가 사라지는 자리다');
  assert.equal(r.지워짐.length, 씨앗.length);
  /* ⚠ 빈 문자열은 `null` 과 다르다 — 원장이 의도적으로 비운 것이라 씨앗을 다시 깔면 안 된다
   *   (그러면 「명부에서 이름을 지우세요」라는 처방이 영영 안 먹는다 · F103). */
  assert.equal(Object.keys(ctx.본적명부_('')).length, 0, '빈 명부에 씨앗을 다시 깔았다 — 처방이 안 먹는다');
});

test('🔑 실저장소 — 수집 탭에서 **행을 지우는 자리** 둘 다 기준선을 내린다(데모 퇴장 · 음성 철회)', () => {
  /* ①배포 검수 P2(723c1d0137a4): `voiceWithdraw` 가 voice_log 행을 지우는데 기준선을 안 내려
   * 다음 주부터 「줄었다」를 매주 외쳤다 — 우리가 시킨 삭제라 따를 처방이 없는 경보다(F103). */
  const 교재 = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const i = 교재.indexOf('mine.map(m => m.row).sort((a, b) => b - a).forEach(r => vl.deleteRow(r));');
  assert.notEqual(i, -1, 'voice_log 행 삭제 자리를 못 찾았다 — 이 검사가 조용히 0건이 되는 자리다');
  assert.ok(/if\s*\(\s*mine\.length\s*\)\s*\{?\s*탭수축기준선지움_\('voice_log'\)/.test(교재.slice(i, i + 700)),
    '음성 동의 철회가 기준선을 안 내린다(또는 죽은 조건 아래 있다) — 매주 거짓 경보가 뜬다');
});

test('🔴 실저장소 — 옛 키에 **쓰는 자리가 0**이다(읽는 쪽만 갈아타면 승계가 밤마다 되살아난다)', () => {
  /* 🔴 ①배포 검수 2회차 P2(7f91b9dad177): 읽는 쪽을 새 키로 옮겼는데 야간 writer 가 옛 키에
   *   계속 썼다 — 「승계는 한 번뿐」이 통째로 무효가 되고 기준선이 두 키로 갈라진다.
   *   낱말 하나가 아니라 **쓰기 자리 전체**를 0으로 못박는다(다음에 또 생기면 여기서 죽는다). */
  const src = 코드만(fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8'));
  assert.equal((src.match(/setProperty\(\s*SELF_DECLARE_HWM_/g) || []).length, 0,
    '옛 키에 쓰는 자리가 남아 있다 — 승계가 매번 되살아나 처방(새 키 삭제)이 안 먹는다');
  assert.ok(/deleteProperty\(SELF_DECLARE_HWM_\)/.test(src), '옛 키를 지우는 자리가 사라졌다 — 승계가 영구가 된다');
});

test('🔴 실저장소 — 첫 실행은 명부를 **반드시 한 번 저장한다**(새 이름이 0이어도)', () => {
  /* 🔴 ①배포 검수 2회차 P2(54ff60d02fa9): 씨앗 35종이 마침 전부 살아 있으면 새 이름이 0이라
   *   아무것도 안 쓰고 끝난다 — 그러면 「명부에서 그 이름 줄을 지우세요」 처방이 지울 대상조차
   *   없고, 다음 실행이 또 씨앗을 깔아 되돌린다(따를 수 없는 처방 · F103). */
  const src = 코드만(fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8'));
  assert.ok(/if\s*\(\s*새이름\.length\s*\|\|\s*propsW\.getProperty\(SEEN_TABS_\)\s*==\s*null\s*\)/.test(src),
    '명부 저장이 새 이름 유무에만 달려 있다 — 첫 실행이 아무것도 안 남겨 처방이 지울 대상이 없다');
});

test('🔑 실저장소 — 축소 경보가 **실제 속성 키**를 알려준다(자리표를 그대로 내보내지 않는다)', () => {
  /* 주석은 벗기고 본다 — 이 규칙을 «설명»하는 주석이 그대로 위반으로 잡힌다(#Q72 그 자리). */
  const src = 코드만(fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8'));
  assert.ok(!src.includes("탭수축키_('<탭이름>')"),
    "경보문이 자리표 `<탭이름>` 을 그대로 내보낸다 — 원장이 무엇을 지워야 할지 모른다(F103)");
  assert.ok(/줄어든키/.test(src), '줄어든 탭의 실제 키를 만들지 않는다');
});

/* 🔴 **의도적 퇴역** — 옛 손 목록에 있었지만 유호님 확정으로 골격에서 «뺀» 탭.
 *
 * 왜 옛손목록에서 그냥 지우지 않나: 그 목록은 「교체 직전의 역사」라 낡지 않는다(위 주석). 거기서
 *   이름을 지우면 **실수로 흘린 것과 일부러 뺀 것이 같은 모양**이 된다 — 다음 사람이 「원래 없었나 보다」로
 *   읽고, 이 회귀가 지키려던 바로 그 사고(도출로 갈아타며 조용히 감시에서 빠짐)가 다시 열린다.
 *   ⇒ 뺀 것은 **여기에 이유와 함께** 적는다. 목록이 늘면 그만큼 검사의 분모가 줄어드는 것이므로,
 *   한 줄 한 줄이 유호님 확정을 가리켜야 한다.
 * 대가(틀릴 때의 모습): 이 배열에 이름을 넣기만 하면 검사가 초록이 된다 — 기계는 「정말 지웠나」까지
 *   못 본다. 그래서 사유에 **날짜와 확정자**를 박는다(리뷰가 그 위를 진다). */
const 의도적퇴역 = [
  // 2026-09-03 유호 확정 — 반 대항 리그 폐지(08-27)의 마무리. 골격·라이브 시트 양쪽에서 제거.
  //   실측: league_history 데이터 0행 · league_pairs 6행(데모 시절 대진표). 쓰는 코드는 08-27부터 0이었다.
  'league_history', 'league_pairs',
  // 2026-09-03 유호 확정 — 졸업생 명예의 전당. 08-27 랭킹 폐지와는 «다른 사유»다:
  //   채울 데이터가 아직 없다(첫 졸업생은 1년 이상 뒤). 실측: 데모 1행 말고 0행.
  'hall_of_fame',
];

test('🔑 실저장소 — 감시 목록이 골격에서 나오고, 옛 손 목록 35종을 **하나도 안 흘렸다**', () => {
  const ctx = 엔진(속성흉내());
  const 골격탭 = ctx.sheetSkeleton_().map((k) => String(k[0]));
  assert.ok(골격탭.length >= 갯수하한, `골격이 ${골격탭.length}종밖에 안 된다 — 도출 원천이 줄었다(분모가 줄면 초록이 거짓말한다)`);
  const 흘린것 = 옛손목록.filter((n) => 골격탭.indexOf(n) === -1 && 의도적퇴역.indexOf(n) === -1);
  assert.deepEqual(흘린것, [], `도출로 갈아타며 감시에서 사라진 탭 — ${흘린것.join(', ')}`);
  /* 퇴역 목록이 «거짓 면제»가 되지 않게: 여기 적힌 이름은 정말로 골격에 없어야 한다.
   *   되살아난 탭을 퇴역 목록에 남겨 두면 그 탭은 감시도 안 받고 검사도 안 받는 사각이 된다. */
  const 되살아남 = 의도적퇴역.filter((n) => 골격탭.indexOf(n) !== -1);
  assert.deepEqual(되살아남, [], `퇴역시켰다는 탭이 골격에 다시 있다 — ${되살아남.join(', ')}`);
});
const 갯수하한 = 50;   /* 교체 직전 실측 53에서 «의도적 퇴역 2»를 뺀 값(09-03). 아래로 내려가면
                        원천이 줄었다는 뜻이다 — 하한을 내릴 때는 위 퇴역 목록도 같이 늘어야 한다. */

test('🔴 실저장소 — 워치독이 손 목록으로 되돌아가지 않았다(등록층)', () => {
  const src = fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');
  assert.ok(/const 골격탭 = sheetSkeleton_\(\)/.test(src),
    '워치독이 골격에서 도출하지 않는다 — 새 시트가 생겨도 감시에 안 든다');
  assert.ok(!코드만(src).includes('const reqSheets'),
    '손 목록 `reqSheets` 가 되살아났다 — v9.144·v9.202 와 같은 병의 네 번째가 된다');
  /* 🔴 **배선층** — 씨앗 로직이 맞아도 호출부가 `|| ''` 하나로 무력화한다(`null` 이 안 닿으면
   *   첫 실행 판정 자체가 사라진다). 2차 변이가 이 구멍으로 통과했다: 순수 함수는 그대로 두고
   *   부르는 줄만 되돌렸는데 17건이 전부 초록이었다. 가드는 로직보다 등록층에서 샌다. */
  assert.ok(/const 본적 = 본적명부_\(propsW\.getProperty\(SEEN_TABS_\)\);/.test(src),
    '워치독이 명부 원문을 그대로 안 넘긴다 — `null`(첫 실행)이 함수에 안 닿으면 씨앗이 영영 안 깔린다');
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

test('🔑 실저장소 — 월간 아카이빙도 point_logs 기준선을 함께 내린다(#Q100 이 연 세 번째 삭제 자리)', () => {
  /* [vNEXT] `point_logs` 가 수집 표식을 받은 순간 `archivePointLogs` 는 「수집 장부가 줄었다」의
   *   발원지가 된다 — 매달 1일마다, 우리가 시킨 이동인데 따를 처방이 없는 경보다(F103).
   * 🔴 **조건까지 못박는다** — 바로 위 `wipe` 검사가 변이 시험에서 배운 것 그대로다: 호출문만
   *   보면 `if (false)` 로 죽여도 통과한다. `move.length` = 실제로 옮긴 행 수이니 조건이 곧 규격. */
  const 배치 = fs.readFileSync(path.join(ROOT, '엔진_운영배치.js'), 'utf8');
  const i = 배치.indexOf("arc.getRange(arc.getLastRow() + 1, 1, move.length, 8).setValues(move)");
  assert.notEqual(i, -1, '아카이빙 이동 지점을 못 찾았다 — 이 검사가 조용히 0건이 되는 자리다');
  const 구역 = 배치.slice(i, i + 1400);
  assert.ok(/if\s*\(\s*move\.length\s*\)\s*\{?\s*탭수축기준선지움_\('point_logs'\)/.test(구역),
    '월간 아카이빙이 기준선을 안 내린다(또는 죽은 조건 아래 있다) — 매달 1일 「줄었다」 오경보가 선다');
});

test('🔴 실저장소 — 넓힌 분모가 그대로 산다(표식 30종 = #Q100 22 + Ⅰ-④ 상담로그 + scene_log + 발음 사건 원장 둘 + 동의 이력 + 순간 + 진단세션·자율일배정 · 신규 전건)', () => {
  /* 표식은 **두 장부의 분모**다(«줄었나» 감시 · 도달 장부). 한 줄이 조용히 빠지면 그 탭은 두 곳
   * 모두에서 사라지고, 증상은 언제나 「위반 0」이다 — 그래서 이름을 세지 말고 **적어서** 못박는다.
   * [v9.259 · Ⅰ-④] 분모 22→23: `상담로그` 편입(입학 «전» 대화 원문 — E1 재료 · §8-0 두 관문 통과).
   * [함께한날 막1] 분모 23→24: `scene_log` 편입(장면이 열린 날은 소급 불가 — 설계 §4-1 «신설은 3종 세트»).
   * [2026-09-01 · 심문 P0-⑧] 분모 24→26: `voice_labels`·`voice_delivery` 편입. 관찰 «원본»(voice_log)에
   *   섞여 있던 AI 추론과 전달 사건을 갈랐다 — 그전엔 원본 행 안에 있어서 **이 장부가 세지도 못했다.**
   *   ⚠ 둘 다 지금 도달 0 이라 래칫이 2→4 로 올랐다(`시트도달상한_` 에 까닭·되갚을 조건을 적었다).
   * [2026-09-02 · 가져가는것 걸음1] 분모 27→28: `portfolio_moments` 편입(그날의 순간 — 무대·작품·촬영은 그날 안 담으면 없다 ·
   *   설계 §2-c). 소비자(calcAll 걸어온길·오늘의알림)를 같은 커밋에 세워 래칫은 그대로다.
   * [2026-09-07 · 판매 §0] 분모 28→30: `진단세션`·`자율일배정` 편입(진단 답·정답 스냅샷과 그날 배정한 묶음의 판은 소급 불가 ·
   *   docs/급수진단_설계_v1.md §⑥ · docs/자율일_설계_v1.md §③). 소비자(진단결과_ · sundayBundleJudge_)를 같은 커밋에 세워 래칫은 그대로다. */
  const ctx = 엔진(속성흉내());
  const 수집 = ctx.수집장부탭_();
  const 신규 = ['point_logs', 'attendance', 'attendance_batch', 'achievements', 'weekly_topics',
    'hw_batch', 'exit_log', 'absence_notice', 'absence_followup', 'lecture_views',
    'lesson_close', 'student_errors', 'academic_log', '상담로그', 'scene_log',
    'voice_labels', 'voice_delivery', 'consent_log', 'portfolio_moments', '진단세션', '자율일배정'];
  const 빠짐 = 신규.filter((n) => 수집.indexOf(n) === -1);
  assert.deepEqual(빠짐, [], `넓힌 수집 탭이 분모 밖으로 나갔다 — ${빠짐.join(', ')}`);
  assert.equal(수집.length, 30, `수집 표식 ${수집.length}종 — 30이 아니면 판정표(docs/엔진도달_설계.md §8-0 · 그 문서는 파생이라 코드가 정본)와 갈라졌다`);
  /* leads 는 사람이 고치는 리드 원장(inquiries 동류)이라 골격엔 들되 표식은 ㉡ 탈락이다. */
  assert.equal(수집.indexOf('leads'), -1, 'leads 에 수집 표식이 붙었다 — 사람 원장은 ㉡ 탈락(Ⅰ-④ 판정)');
  /* 🔴 **탈락 쪽도 못박는다** — 통과 목록만 검사하면 「넓히기」가 무제한으로 번져도 초록이다.
   *   `teacher_checkins` 는 자기치유가 연타를 지우는데(`엔진_폼리포트.js`) 그 자리가 기준선을
   *   안 내린다 — 표식을 주면 매주 우는 경보가 된다. 학생 산출도 아니라 ㉡에서도 걸린다. */
  assert.equal(수집.indexOf('teacher_checkins'), -1,
    'teacher_checkins 에 수집 표식이 붙었다 — 자기치유가 기준선 없이 행을 지워 따를 수 없는 경보가 된다(F103)');
  /* 파생·재계산되는 탭은 지워져도 다시 태어난다 — 표식은 «소급 불가»에만 준다. */
  ['class_stats', 'teacher_stats', 'titles', 'system_manifest', 'groups', 'schedule'].forEach((n) => {
    assert.equal(수집.indexOf(n), -1, `${n} 은 파생·재생성 탭이라 수집 표식 대상이 아니다`);
  });
});
