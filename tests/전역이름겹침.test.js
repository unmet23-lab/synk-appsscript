/* [F437] 엔진 톱레벨 이름 겹침 — **한 이름은 한 파일**이다.
 *
 * ■ 왜 (2026-08-14 실사고 · F437)
 *   발화 지수 로그 상수를 `TALK_LOG_HEADERS` 로 지었는데 `엔진_수집.js` 의 회화 로그 상수가
 *   같은 이름을 이미 쓰고 있었다. Apps Script 는 전역을 **파일 순서대로 합쳐** 초기화하므로
 *   `const` 재선언 = 프로젝트 전체 SyntaxError = **모든 트리거 사망**이다. `node --check` 는
 *   파일 단위라 초록이었고, 그 트랙의 회귀 39건도 전부 초록이었다.
 *
 * ■ 🔴 이 파일이 «따로» 존재하는 이유 — 합본 평가가 못 보는 절반이 있다
 *   `const`·`let`·`class` 가 겹치면 합본이 **예외를 던지므로** 그건 이미 잡힌다(월키원인차단 등이
 *   합본을 실제로 평가한다 — F437 때 빨개진 것이 그것 하나였다). 그러나 **`function`·`var` 가
 *   겹치면 예외가 안 난다** — 뒤 파일이 앞 파일을 **조용히 덮고** 아무 신호도 없다. 그쪽은
 *   지금까지 어느 검사도 안 봤다: 「맞는 얼굴로 틀린 값을 내는 자리」(CLAUDE.md 가드 맹점 ④)다.
 *   아래 ③번 시험이 그 사각을 픽스처로 못박는다 — 이 파일의 존재 이유가 회귀에 박혀 있어야
 *   나중에 누가 「합본이 이미 잡는데 왜 둘이냐」고 지우지 못한다.
 *
 * ■ 재는 방법 = **파싱이 아니라 실행**
 *   톱레벨인지를 정규식으로 가르면 주석·문자열·중첩 블록에서 새고, 새는 방향은 언제나 「통과」다.
 *   그래서 각 파일을 **빈 컨텍스트에 혼자** 돌리고 그 파일이 만든 전역 키를 센다. 이건 어림이
 *   아니라 실물과 같은 판정이다.
 *   🔑 파일이 도중에 던져도 이름 집합은 **온전하다** — 스크립트는 실행 «전»에 함수 선언과 var
 *      바인딩을 먼저 심는다(호이스팅). 그래서 예외를 삼켜도 미탐이 안 생긴다. 던진 사실 자체는
 *      ②번에서 따로 말한다(조용히 넘기면 「검사를 못 했다」가 「통과」와 같은 모양이 된다).
 *   ⚠ 이 방법이 못 보는 것: `const`·`let`·`class` 는 전역 «객체»에 안 붙어 여기서 안 세진다.
 *      그쪽은 위에 적은 대로 합본 예외가 지고, ④번이 그 통로가 살아 있는지 대조한다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { ENGINE_FILES, engineParts } = require('./_engine-source');

/** Apps Script 전역 흉내 — 무엇을 부르든 자기를 돌려주는 스텁(월키원인차단과 같은 모양). */
function 스텁컨텍스트() {
  const s = new Proxy(function () {}, { get: () => s, apply: () => s });
  return {
    SpreadsheetApp: s, PropertiesService: s, Utilities: s, Session: s, MailApp: s, GmailApp: s,
    UrlFetchApp: s, DriveApp: s, FormApp: s, DocumentApp: s, ScriptApp: s, CacheService: s,
    LockService: s, HtmlService: s, Logger: { log: () => {} }, console,
  };
}

/** 그 소스가 **만드는** 톱레벨 전역 이름(function·var)과, 혼자 돌 때 던진 예외. */
function 전역이름(src, filename) {
  const ctx = 스텁컨텍스트();
  const 전 = new Set(Object.keys(ctx));
  vm.createContext(ctx);
  let 던진것 = null;
  try { vm.runInContext(src, ctx, { filename }); } catch (e) { 던진것 = e; }
  return { 이름: Object.keys(ctx).filter((k) => !전.has(k)), 던진것 };
}

/** 파일별 측정 결과 — 시험마다 다시 재지 않는다(같은 재료를 두 번 재면 갈라진다). */
const 잰것 = engineParts().map(({ file, src }) => ({ file, ...전역이름(src, file) }));

/** 두 파일 이상에 사는 이름 — **판정은 여기 하나뿐이다.**
 *  🔑 실저장소용과 픽스처용을 따로 적으면, 실저장소가 오늘 겹침 0이라 ①은 어차피 초록이고
 *     픽스처는 «딴 코드»를 재게 된다 — 즉 이 접기 로직에 심은 버그를 **아무 시험도 못 잡는다**.
 *     (처음에 실제로 그렇게 짰다가 변이로 잡았다.) 그래서 ①·③이 같은 함수를 지난다. */
function 겹친이름들(잰것들) {
  const 어디에 = new Map();
  for (const { file, 이름 } of 잰것들) {
    for (const n of 이름) {
      if (!어디에.has(n)) 어디에.set(n, []);
      어디에.get(n).push(file);
    }
  }
  return [...어디에].filter(([, fs]) => fs.length > 1)
    .map(([n, fs]) => `${n} ← ${fs.join(' · ')}`)
    .sort();
}

/* ═══════ ① 실저장소 — 거짓양성만 검사한다(탐지력은 아래 픽스처가 진다 · F296) ═══════ */

test('🔴 [F437] 엔진 톱레벨 이름은 파일마다 유일하다 — 겹치면 뒤 파일이 앞 파일을 조용히 덮는다', () => {
  const 겹친것 = 겹친이름들(잰것);
  assert.deepEqual(겹친것, [],
    '엔진 전역 이름이 두 파일에 있다 — Apps Script 는 파일 순서대로 합치므로 뒤가 앞을 덮는다.\n' +
    '  이름을 하나 바꾸거나, 같은 뜻이면 한 파일로 모으고 나머지는 그 통로를 부른다:\n' +
    겹친것.map((l) => '    · ' + l).join('\n'));
});

/* ═══════ ② 분모 — 「안 쟀다」가 「겹침 0」과 같은 모양이면 안 된다 (F207) ═══════ */

test('🔴 [F437·분모] 모든 엔진 파일이 실제로 돌았고 이름을 냈다 — 0이면 안 잰 것이다', () => {
  assert.equal(잰것.length, ENGINE_FILES.length, '엔진 파일 수가 목록과 다르다');
  const 안돈것 = 잰것.filter((r) => r.이름.length === 0).map((r) => r.file);
  assert.deepEqual(안돈것, [], '이 파일들이 전역을 하나도 안 냈다 — 위 ①의 초록은 그만큼 빈 초록이다');
  /* 던진 파일은 **막지 않고 드러낸다** — 이름 집합은 호이스팅 덕에 온전하지만(머리말),
   * 「혼자서는 못 도는 엔진 파일」은 로드 순서 사고의 앞마당이라 조용히 지나가면 안 된다. */
  const 던진것 = 잰것.filter((r) => r.던진것).map((r) => `${r.file}: ${r.던진것.name}`);
  assert.deepEqual(던진것, [],
    '엔진 파일이 혼자 돌 때 던진다 — 톱레벨이 다른 파일에 기대고 있다(로드 순서에 목숨이 걸린 모양).');
});

/* ═══════ ③ 탐지력 — 픽스처로 못박는다. ①은 실저장소라 오늘 초록인 것이 우연일 수 있다 ═══════ */

const 픽스처갑 = 'function 반키_(v) { return String(v).split("(")[0]; }\nvar 몫 = 1;\n';
const 픽스처을 = 'function 반키_(v) { return String(v).trim(); }\nvar 몫 = 2;\n';

test('[F437·탐지력] 두 파일이 같은 `function`·`var` 이름을 만들면 잡힌다', () => {
  /* ①과 **같은 통로**(`겹친이름들`)로 잰다 — 위 머리말의 이유. 문구까지 그대로 대조해
   * 「어느 파일들인가」가 보고에서 빠지는 변이도 여기서 빨개진다(사람이 그걸로 찾아간다). */
  const 겹침 = 겹친이름들([
    { file: '갑.js', ...전역이름(픽스처갑, '갑.js') },
    { file: '을.js', ...전역이름(픽스처을, '을.js') },
  ]);
  assert.deepEqual(겹침, ['몫 ← 갑.js · 을.js', '반키_ ← 갑.js · 을.js'].sort(),
    '겹치는 이름을 못 셌다 — ① 의 초록은 탐지력이 아니라 우연이다');
});

test('[F437·거짓양성] **한 파일 안**에서 두 번 선언한 것은 겹침이 아니다', () => {
  /* 같은 파일이 같은 이름을 두 번 내는 것은 이 신고가 겨눈 것(파일 «간» 충돌)이 아니고,
   * 실물에서도 정상 패턴이다. 이걸 안 가르면 검사가 상시 빨개져 결국 안 쓰이게 된다. */
  const 한파일 = 전역이름(픽스처갑 + 픽스처을, '갑.js');
  assert.deepEqual(겹친이름들([{ file: '갑.js', ...한파일 }]), [],
    '한 파일 안의 재선언을 파일 간 겹침으로 셌다 — 거짓양성이 곧 이 검사의 사망이다');
});

test('🔴 [F437·존재 이유] 그 겹침을 **합본 평가는 못 잡는다** — 예외가 안 난다', () => {
  /* 이 시험이 빨개지는 날 = 합본이 function 겹침에도 던지게 된 날. 그때는 이 파일이 필요 없어진다.
   * 지금은 그 반대라, 「합본이 이미 잡는다」는 이유로 위 ①을 지우면 그 자리가 통째로 사각이 된다. */
  const ctx = 스텁컨텍스트();
  vm.createContext(ctx);
  vm.runInContext(픽스처갑, ctx, { filename: '갑.js' });
  vm.runInContext(픽스처을, ctx, { filename: '을.js' });     // ← 던지지 않는다
  assert.equal(ctx.반키_('가 (나)'), '가 (나)'.trim(),
    '뒤 파일이 앞 파일을 덮지 않았다 — 이 시험의 전제(조용한 덮어쓰기)가 바뀌었다');
  assert.equal(ctx.몫, 2, 'var 도 조용히 덮인다는 전제가 바뀌었다');
});

/* ═══════ ④ 나머지 절반(const·let·class)의 통로가 살아 있나 ═══════ */

test('🔴 [F437] `const` 겹침은 합본이 **예외로** 잡는다 — 그 통로가 죽으면 여기서 알린다', () => {
  const ctx = 스텁컨텍스트();
  vm.createContext(ctx);
  vm.runInContext('const TALK_LOG_HEADERS = [1];\n', ctx, { filename: '갑.js' });
  assert.throws(() => vm.runInContext('const TALK_LOG_HEADERS = [2];\n', ctx, { filename: '을.js' }),
    /already been declared/,
    'const 재선언이 더는 안 던진다 — 그러면 ①의 방법(전역 객체 키)만으로는 그 절반이 사각이다');
});
