/* Loom «범위» 회귀 — `tools/lib/loom.js` 의 `범위씌우기` (F517).
 *
 * 무엇을 지키나:
 *   `부품만` 프리셋은 주석에 「남의 지면에 얹을 때」라고 적혀 있었는데, 산출 CSS 규칙 62 중
 *   **28 이 맨요소 규칙**이라 남의 판을 그대로 때렸다 — 발표물 6벌 기준 **34 자리**.
 *   이 파일이 지키는 것은 그 «가둠»이고, **새는 방향이 언제나 「안 가둔다」**라는 것이 요점이다.
 *
 * 🔑 왜 픽스처로 재나 — 짓는 동안 내 판정 규칙이 실제로 두 번 샜고, 둘 다 「통과」로 샜다:
 *   ① 뼈 추출을 «공백으로 자르기»로 했더니 `a:not(.민):not(.레일 a)::before` 의 괄호 «안» 공백에
 *      속아 뼈가 깨졌고, 깨진 것은 «맨요소가 아니다» → **안 가둔다**로 떨어졌다.
 *      ⇒ 판정을 「맨요소인가」가 아니라 **「전역이어도 되는가」**로 뒤집었다(모르면 가둔다).
 *   ② `@keyframes` 안의 `from`·`to`·`50%` 는 선택자가 아닌데 가두면 애니메이션이 죽는다.
 *      저장소에 오늘 `@keyframes` 가 0개라는 것은 근거가 아니다 — 스택으로 구조적으로 막았다.
 *
 * 탐지력은 **픽스처**가 진다(맹점 ② — 실저장소가 아직 병들어 있기를 요구하지 않는다).
 * 실저장소에는 「거짓양성 0」만 검사한다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const loom = require(path.join(루트, 'tools', 'lib', 'loom.js'));
const { 범위씌우기, 기본범위, css, 지면들 } = loom;

/* ── 눈 — CSS 에서 «가두지 못한» 선택자를 센다. 테스트와 픽스처가 같은 눈을 쓴다. ── */

/** 규칙 머리만 뽑는다(@-룰 머리는 뺀다 · 선언부는 `{` 를 안 만나 안 걸린다). */
function 머리들(css빈) {
  const s = css빈.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]*)\{/g;
  let m;
  while ((m = re.exec(s))) {
    const h = m[1].trim().replace(/\s+/g, ' ');
    if (h && !h.startsWith('@')) out.push(h);
  }
  return out;
}

/** 전역으로 남아도 되는 선택자인가 — 부품 클래스·ID·`:root` 뿐이다. */
const 전역허용 = (sel) => /^[.#]/.test(sel) || sel.startsWith(':root');

/** 가두지 못한 선택자 전량 — **이것이 0 이라는 것이 이 파일의 주장이다.** */
function 안가둔것(css빈, 범위) {
  return 머리들(css빈).flatMap((h) => h.split(','))
    .map((s) => s.trim()).filter(Boolean)
    .filter((s) => !전역허용(s) && !s.startsWith(범위));
}

/* ══ ① 실저장소 — 거짓양성 0 ══════════════════════════════════════════════ */

test('부품만 — 맨요소 규칙이 하나도 «범위 밖»에 없다', () => {
  const 범위 = 기본범위['부품만'];
  assert.ok(범위, '부품만 에 기본 범위가 없다 — 옵션이면 안 준 사람이 남의 판을 때린다');
  const 샌것 = 안가둔것(css({ 지면: '부품만' }), 범위);
  assert.deepStrictEqual(샌것, [],
    '범위 밖으로 샌 선택자 ' + 샌것.length + '개: ' + 샌것.slice(0, 8).join(' · '));
});

test('부품만 — 부품 클래스와 :root 는 전역으로 남는다(가두면 안 쓰이는 부품이 된다)', () => {
  const out = css({ 지면: '부품만' });
  for (const 부품 of ['.번호', '.체크', '.칩', '.히어로수', '.실금']) {
    assert.ok(new RegExp('(^|[,\\s{])' + 부품.replace('.', '\\.') + '[,{:]', 'm').test(out),
      부품 + ' 가 전역에 없다 — 조상에 클래스를 달아야 쓰이는 부품은 안 쓰인다');
  }
  assert.ok(/:root\{/.test(out), ':root 변수가 사라졌다');
});

test('통짜 지면 프리셋(문서·인쇄·웹·캐러셀)은 안 가둔다 — 자기가 곧 판이다', () => {
  for (const 이름 of ['문서', '인쇄', '웹', '캐러셀']) {
    assert.strictEqual(기본범위[이름], undefined, 이름 + ' 에 기본 범위가 붙었다');
    assert.ok(/(^|\n)\s*body\{/.test(css({ 지면: 이름 })),
      이름 + ' 의 body 규칙이 사라졌다 — 통짜 지면인데 가둬졌다');
  }
});

test('지면 프리셋 전량이 범위 판정을 지난다 — 새 프리셋이 조용히 새지 않는다', () => {
  for (const 이름 of Object.keys(지면들)) {
    const 범위 = 기본범위[이름];
    if (!범위) continue;                        // 통짜 지면 — 위 시험이 본다
    assert.deepStrictEqual(안가둔것(css({ 지면: 이름 }), 범위), [], 이름 + ' 이 샜다');
  }
});

/* ══ ② 픽스처 — 탐지력 (병든 입력에 실제로 반응하나) ═══════════════════════ */

test('탐지력 — 맨요소는 가두고, 컨테이너는 범위 «자신»으로 접는다', () => {
  const 판 = [
    ['h2{color:red}', '.룸 h2{color:red}', '맨요소'],
    ['ul>li::before{content:""}', '.룸 ul>li::before{content:""}', '자손·의사요소'],
    ['p,li,td,th{font-family:a}', '.룸 p,.룸 li,.룸 td,.룸 th{font-family:a}', '묶음 전량'],
    ['.번호{color:red}', '.번호{color:red}', '부품 클래스는 전역'],
    [':root{--단:4px}', ':root{--단:4px}', '변수는 전역'],
    ['body{margin:0}', '.룸{margin:0}', '컨테이너는 접는다'],
    ['.글,article,body{counter-reset:절}', '.글,.룸{counter-reset:절}', '접히며 중복이 사라진다'],
    ['body.어쩌고{margin:0}', '.룸.어쩌고{margin:0}', '꼬리 조건은 살린다'],
  ];
  for (const [들, 나, 무엇] of 판) {
    assert.strictEqual(범위씌우기(들, '.룸'), 나, 무엇 + ' — 들: ' + 들);
  }
});

test('탐지력 — 괄호 «안» 공백에 안 속는다 (실제로 밟은 구멍 ①)', () => {
  /* 이 둘이 내가 짓는 동안 실제로 「안 가둔다」로 샜던 모양이다. */
  assert.strictEqual(범위씌우기('a:not(.민):not(.레일 a)::before{content:""}', '.룸'),
    '.룸 a:not(.민):not(.레일 a)::before{content:""}');
  assert.strictEqual(범위씌우기('h2:not(:has(.번호))::before{content:""}', '.룸'),
    '.룸 h2:not(:has(.번호))::before{content:""}');
});

test('탐지력 — @keyframes 안의 머리는 선택자가 아니다 (실제로 밟은 구멍 ②)', () => {
  const 들 = '@keyframes 뛰기{from{opacity:0}50%{opacity:.5}to{opacity:1}}';
  assert.strictEqual(범위씌우기(들, '.룸'), 들, 'from·to·50% 를 가두면 애니메이션이 조용히 죽는다');
  // @media 안쪽은 반대로 «가둔다» — 그것들은 진짜 선택자다.
  assert.strictEqual(범위씌우기('@media print{h2{color:red}}', '.룸'),
    '@media print{.룸 h2{color:red}}');
});

test('탐지력 — 문자열·주석 «안»의 중괄호가 깊이를 못 속인다', () => {
  /* ⚠이 시험은 한 번 헐거웠다 — `includes` 로 물었더니 앞에 `.룸 ` 이 붙어 망가진 산출물도
   *   그 조각을 «포함»해서 통과했다(변이 ⑧ 이 구멍으로 나왔다). 그래서 **완전 일치**로 못박는다.
   *   부분 일치는 «맞는 얼굴로 틀린 값»을 통과시키는 자리다. */
  const 판 = [
    ['.칩::before{content:"{"}h2{color:red}', '.칩::before{content:"{"}.룸 h2{color:red}',
      '문자열 안 중괄호'],
    ['/* body{x} */h2{color:red}', '/* body{x} */.룸 h2{color:red}',
      '주석 안 중괄호 — 이걸 놓치면 주석 뒤 규칙이 통째로 어긋난다'],
    ['/*loom부품:번호*/h2{color:red}', '/*loom부품:번호*/.룸 h2{color:red}',
      '마커 주석은 머리 «앞»에 붙는다 — 자리를 살린 채 선택자만 고친다'],
    ['/* "quote */h2{color:red}', '/* "quote */.룸 h2{color:red}',
      '주석 안 홑따옴표가 문자열 모드를 열면 그 뒤가 통째로 먹힌다'],
  ];
  for (const [들, 나, 무엇] of 판) {
    assert.strictEqual(범위씌우기(들, '.룸'), 나, 무엇 + ' — 들: ' + 들);
  }
});

test('탐지력 — 범위가 없으면 한 글자도 안 바꾼다(무변경이 기본값)', () => {
  const 들 = 'h2{color:red}body{margin:0}';
  assert.strictEqual(범위씌우기(들, null), 들);
  assert.strictEqual(범위씌우기(들, ''), 들);
});

/* ══ ③ 자기 처방 — 가둔 CSS 가 실제로 «닿나» ═══════════════════════════════
 * 맹점 ③: 차단 사유가 시키는 것을 그대로 했을 때 통과해야 한다.
 * 여기선 「범위 클래스를 달면 부품이 온다」가 그 처방이다. */

test('자기 처방 — 범위 클래스를 단 마크업에는 규칙이 실제로 닿는다', () => {
  const out = css({ 지면: '부품만' });
  const 범위 = 기본범위['부품만'].slice(1);          // `.룸` → `룸`
  /* 처방대로 `class="룸"` 을 달면, 그 안의 h2·ol·ul 을 겨냥한 규칙이 존재해야 한다. */
  for (const el of ['h2', 'ol', 'ul']) {
    assert.ok(new RegExp('\\.' + 범위 + ' ' + el + '[{,>:\\s]').test(out),
      '범위 안 ' + el + ' 를 겨냥한 규칙이 없다 — 처방을 따라도 부품이 안 온다');
  }
});
