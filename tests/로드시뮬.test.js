/* [v9.135] GAS 로드 시뮬 — 파일 초기화 순서를 「실행」으로 검증한다.
 *
 * 왜 따로 있나: safety.test.js [v9.57]의 텍스트 추출기는 { } 내부를 못 본다 —
 *   `const X = { a: 타파일상수 }`는 텍스트 검사를 통과하지만, 라이브에선 파일 초기화 순서에 따라
 *   ReferenceError로 프로젝트 전체(모든 트리거·실행)가 즉사한다(07-24 상담AI.gs:27 실사고 계급).
 *   여기서는 파일별 vm.Script를 .clasp.json filePushOrder 순서 그대로 같은 context에서 평가한다.
 *   vm은 같은 context의 스크립트끼리 전역 렉시컬 환경(const/let·TDZ)을 공유하므로,
 *   Apps Script의 「파일 순서대로 전역 초기화」와 같은 의미론이다(분할 2단계 리뷰에서 역순 발화 확인).
 *
 * 감도의 조건: GAS 서비스 스텁은 이름을 명시해 심는다 — globalThis 전체를 Proxy로 덮으면
 *   미정의 식별자 접근(ReferenceError)까지 삼켜 이 시뮬의 존재 이유가 사라진다.
 *
 * ⚠ node:vm은 보안 샌드박스가 아니다 — 여기서 평가하는 건 이 repo의 1st-party 소스뿐이라 무해하지만,
 *   이 repo가 훗날 pull_request 트리거 CI를 받게 되면 이 테스트는 포크 코드 실행 경로가 되므로 게이트할 것. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./_engine-source');

// 톱레벨 코드가 만질 수 있는 GAS 전역 서비스 — 부족분이 나오면 여기 추가한다(오류 메시지가 이름을 말해 준다).
const GAS_GLOBALS = ['SpreadsheetApp', 'PropertiesService', 'ScriptApp', 'Session', 'Utilities',
  'Logger', 'UrlFetchApp', 'HtmlService', 'ContentService', 'DriveApp', 'MailApp', 'GmailApp',
  'FormApp', 'DocumentApp', 'SlidesApp', 'CacheService', 'LockService', 'CalendarApp', 'Charts',
  'LanguageApp', 'Browser', 'console'];

// 무엇을 부르든 자기 자신을 돌려주는 재귀 스텁 — 체이닝·호출·문자열 연결을 전부 무해하게 흡수한다.
function gasStub() {
  const p = new Proxy(function () { }, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') return () => '';
      if (prop === Symbol.iterator) return function* () { };
      return p;
    },
    apply() { return p; },
    construct() { return p; },
  });
  return p;
}

function freshContext() {
  const g = {};
  for (const name of GAS_GLOBALS) g[name] = gasStub();
  return vm.createContext(g);
}

// 라이브 로드 순서: filePushOrder 등재분 먼저(순서 보증), 미등재 루트 .js(만족도팩.js)는 그 뒤.
function loadOrder() {
  const pushOrder = JSON.parse(fs.readFileSync(path.join(ROOT, '.clasp.json'), 'utf8')).filePushOrder || [];
  for (const f of pushOrder) assert.ok(fs.existsSync(path.join(ROOT, f)), `filePushOrder의 ${f}가 실존하지 않는다`);
  const rest = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js') && !pushOrder.includes(f)).sort();
  return pushOrder.concat(rest);
}

function runAll(files, ctx) {
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    try {
      new vm.Script(src, { filename: f }).runInContext(ctx);
    } catch (e) {
      assert.fail(`${f} 톱레벨 평가 크래시(${e.name}: ${e.message}) — 이 순서로 라이브가 로드되면 전 트리거가 죽는다`);
    }
  }
}

test('[v9.135] 정순(filePushOrder) 전 파일 톱레벨 평가 — 라이브 로드 순서 그대로 크래시 0', () => {
  runAll(loadOrder(), freshContext());
});

test('[v9.135] 역순 평가도 크래시 0 — 톱레벨 크로스파일 참조 0(순서 독립)의 실행 증명', () => {
  // [v9.57] strict(텍스트)와 같은 불변식의 실행판. 텍스트 검사가 못 보는 { } 내부 참조까지
  // 여기서 잡힌다: 순서 의존이 하나라도 생기면 역순에서 TDZ ReferenceError로 발화한다.
  runAll(loadOrder().slice().reverse(), freshContext());
});

test('[v9.135] 감도 자가 검증 — { } 사각의 역순 주입이 ReferenceError로 발화한다', () => {
  // 시뮬 자체가 눈이 멀면 위 두 테스트는 「성공적으로 아무것도 말하지 않는다」 — 카나리로 감도를 증명.
  const fwd = freshContext();
  new vm.Script('const CANARY_BASE = 1;', { filename: 'canary-a.js' }).runInContext(fwd);
  new vm.Script('const CANARY_OBJ = { v: CANARY_BASE };', { filename: 'canary-b.js' }).runInContext(fwd);
  const rev = freshContext();
  assert.throws(
    () => new vm.Script('const CANARY_OBJ = { v: CANARY_BASE };', { filename: 'canary-b.js' }).runInContext(rev),
    // vm 렐름의 ReferenceError는 호스트 렐름 생성자와 다른 객체라 instanceof 매칭이 안 된다 — 이름으로 판별.
    (e) => e && e.name === 'ReferenceError',
    '역순 크로스파일 참조가 발화하지 않는다 — 이 시뮬은 감도가 없다(스텁이 전역을 통째로 덮었는지 의심)');
});
