/* [v9.255] 주간 H7 해설의 «재료» 계수 — 게이트가 실제로 닫히는지를 **돌려서** 잰다.
 *
 * ■ 왜 이 파일이 따로 있나 (①배포 검수 P1 `222c989ac23f` · 2026-08-18 실측)
 *   v9.254 는 같은 목적의 게이트를 세우고 `tests/기능압축.test.js` 에 회귀 4건을 달았다.
 *   그런데 그 4건은 전부 **소스 문자열 검사**였다 — 「게이트가 있나」·「0 에서 시작하나」·
 *   「호출보다 앞인가」·「원문을 세나」. 넷 다 초록인데 **게이트는 안 닫혀 있었다**:
 *   화이트리스트 섹션 둘(`kpiSection_`·`updateBizDashboard`)이 재료가 0 이어도 «0 이 박힌
 *   상수 서식»을 돌려주므로 `집계실물` 이 언제나 2 이상이었기 때문이다.
 *   구조가 맞는데 값이 틀린 자리라, 구조 검사로는 원리상 못 잡는다 → 여기서 «값»으로 잰다.
 *
 * ■ 이 검사가 틀릴 때의 모습
 *   `시트흉내` 계약이 라이브와 어긋나면 이 파일도 같이 틀린다(그 파일의 「대가」 절).
 *   못 닫은 것: 라이브 `profiles`·`leads` 의 실제 열 배치가 바뀌면 여기도 같이 낡는다 —
 *   행 판정을 `updateBizDashboard` 와 **같은 조건**으로 적어 둔 이유가 그거다(갈리면 둘 다 본다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');

/** 엔진을 vm 에 올린다 — 이 축이 쓰는 것은 `Logger` 뿐이라 나머지는 무해 stub. */
function 엔진() {
  const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
  const 로그 = [];
  const ctx = {
    SpreadsheetApp: stub, Utilities: stub, Session: stub, MailApp: stub, GmailApp: stub,
    UrlFetchApp: stub, DriveApp: stub, FormApp: stub, DocumentApp: stub, ScriptApp: stub,
    CacheService: stub, LockService: stub, HtmlService: stub, PropertiesService: stub,
    Logger: { log: (m) => 로그.push(String(m)) }, console,
  };
  vm.createContext(ctx);
  vm.runInContext(engineSource(), ctx);
  ctx.로그 = 로그;
  return ctx;
}

/** 시트 몇 장을 든 스프레드시트 흉내. 없는 이름엔 `null` — 라이브도 그렇다. */
function 시트집합(장부) {
  return { getSheetByName: (n) => (Object.prototype.hasOwnProperty.call(장부, n) ? 장부[n] : null) };
}

const 학생행 = (이름) => [이름, '', '', 'student'];
const 리드행 = (날짜, 이름) => [날짜, 이름];

// ── ① 탐지력 (픽스처) — 이 검사가 실제로 «0» 을 볼 수 있나 ────────────────────

test('🔴 미개원 — 학생 0·리드 0 이면 재료는 0이다 (v9.254 가 여기서 2 를 냈다)', () => {
  const ctx = 엔진();
  const ss = 시트집합({
    profiles: 시트흉내({ 첫행: 2, 행들: [] }),
    leads: 시트흉내({ 첫행: 2, 행들: [] }),
  });
  assert.equal(ctx.주간해설재료_(ss), 0);
});

test('🔴 시트가 아직 태어나지도 않았으면 재료는 0이다 — 없음이 예외가 되면 게이트가 열린다', () => {
  const ctx = 엔진();
  assert.equal(ctx.주간해설재료_(시트집합({})), 0);
});

// ── ② 반대쪽 — 재료가 있으면 반드시 «열려야» 한다 (닫히기만 하는 게이트는 기능을 죽인다) ──

test('🔑 학생이 하나라도 있으면 센다', () => {
  const ctx = 엔진();
  const ss = 시트집합({
    profiles: 시트흉내({ 첫행: 2, 행들: [학생행('바트')] }),
    leads: 시트흉내({ 첫행: 2, 행들: [] }),
  });
  assert.equal(ctx.주간해설재료_(ss), 1);
});

test('🔑 리드가 하나라도 있으면 센다 — 학생 0 이어도 마케팅 숫자는 해설할 것이 된다', () => {
  const ctx = 엔진();
  const ss = 시트집합({
    profiles: 시트흉내({ 첫행: 2, 행들: [] }),
    leads: 시트흉내({ 첫행: 2, 행들: [리드행('2026-08-18', '체험문의')] }),
  });
  assert.equal(ctx.주간해설재료_(ss), 1);
});

// ── ③ 행 판정이 `updateBizDashboard` 와 같은가 (갈리면 두 곳이 다른 「재적」을 말한다) ──

test('🔑 profiles 의 student 아닌 행은 재적이 아니다 (그 함수의 nStu 조건과 같다)', () => {
  const ctx = 엔진();
  const ss = 시트집합({
    profiles: 시트흉내({ 첫행: 2, 행들: [['학부모', '', '', 'parent'], ['강사', '', '', 'teacher']] }),
    leads: 시트흉내({ 첫행: 2, 행들: [] }),
  });
  assert.equal(ctx.주간해설재료_(ss), 0);
});

test('🔑 leads 의 날짜 없는 행·이름 없는 행은 리드가 아니다 (그 함수의 L 적재 조건과 같다)', () => {
  const ctx = 엔진();
  const ss = 시트집합({
    profiles: 시트흉내({ 첫행: 2, 행들: [] }),
    leads: 시트흉내({ 첫행: 2, 행들: [리드행('', '이름만'), 리드행('2026-08-18', '')] }),
  });
  assert.equal(ctx.주간해설재료_(ss), 0);
});

// ── ④ 「못 쟀다」는 0 이 아니다 — 그리고 새는 방향이 돈 쪽인지 확인한다 ──────────

test('🔴 계수가 실패하면 -1 이다 — 0 과 같은 모양이면 게이트가 거짓말한다', () => {
  const ctx = 엔진();
  const 터지는ss = { getSheetByName: () => { throw new Error('시트 접근 불가'); } };
  assert.equal(ctx.주간해설재료_(터지는ss), -1);
  assert.ok(ctx.로그.some((m) => m.includes('H7 재료 계수 실패')),
    '못 쟀는데 로그가 조용하다 — 조용한 실패는 이 저장소가 반복해 밟은 자리다');
});

test('🔴 -1 은 게이트를 «연다» — 해설을 조용히 잃는 쪽으로 안 샌다', () => {
  // 게이트 식은 `!집계실물 || 재료행 === 0` 이라 -1 은 통과다.
  // 이 단언은 그 «방향»을 못박는다 — 반대로 짜면(예: `재료행 <= 0`) 학생이 온 뒤에도
  // 계수 실패가 해설을 영영 없애고, 그건 로그 한 줄 말고는 아무 데도 안 보인다.
  const 게이트 = (집계실물, 재료행) => !집계실물 || 재료행 === 0;
  assert.equal(게이트(2, -1), false, '못 쟀을 때 해설이 사라진다 — 새는 방향이 뒤집혔다');
  assert.equal(게이트(2, 0), true, '재료 0 인데 호출이 나간다');
  assert.equal(게이트(0, 5), true, '렌더된 글자가 0 인데 호출이 나간다');
  assert.equal(게이트(2, 3), false, '재료가 있는데 해설이 막힌다');
});
