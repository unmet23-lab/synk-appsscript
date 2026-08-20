#!/usr/bin/env node
/**
 * 룸잉크 — 「부품 위의 잉크가 안 보이는가」를 재는 곳 (2026-08-19)
 *
 * ══ 왜 있나 — 같은 원인에 세 번 당했다 ═══════════════════════════════════
 *   Loom 부품 중 몇은 **자기 바탕을 깔고** 그 위에 잉크를 얹는다(`.번호` = 어두운 유리 원판 +
 *   `color:var(--cream)`). 그런데 원고에 그 요소를 겨냥한 «더 센» 규칙이 있으면 색만 원고가
 *   이겨서, **어두운 원판 위에 어두운 잉크**가 남는다. 숫자가 통째로 안 보인다.
 *
 *   2026-08-19 하루에 세 벌에서 났다 — 전부 «원고가 라이트 바탕을 전제로 잡아 둔 색»이었다:
 *     · `_src_01_설명회_덱`     `.col3 .c .n{color:var(--navy-3)}`  (0,3,0)
 *     · `_src_03_상담브로셔`     `.ph .no{color:var(--navy-3)}`      (0,2,0)
 *     · `개인정보처리방침_게시용` `h3 .num{color:var(--navy-3)}`      (0,2,0)
 *   셋 다 `.번호`(0,1,0)를 이겼다. 원고 저자에겐 죄가 없다 — 원판이 깔리기 «전»엔 옳은 값이었다.
 *
 * ══ 왜 이 실패가 특히 나쁜가 ══════════════════════════════════════════════
 *   **전파 술어는 초록이다.** 훅은 늘었고 마커도 있으니 `지면방` 은 「입었다」로 센다.
 *   즉 진척 지표가 «좋아졌다»고 말하는 동안 화면은 나빠진다 — 딱 「맞는 얼굴로 틀린 값」이고,
 *   CLAUDE.md 가 「장치는 안 도는 쪽보다 이쪽으로 더 자주 샌다」고 적은 바로 그 자리다.
 *   그래서 재는 것이 **부품 목록**(분모)이 아니라 **잉크**(술어)여야 한다.
 *
 * ══ 어떻게 재나 ═══════════════════════════════════════════════════════════
 *   ① 부품 목록을 **`loom.css()` 에서 캔다** — 바탕과 색을 «둘 다» 잡는 클래스가 과녁이다.
 *      손 목록을 두지 않는 이유: 부품이 늘면 목록이 낡고, 낡은 분모는 조용히 통과한다.
 *   ② 마크업에서 그 클래스를 단 요소를 찾아, 그 요소의 **다른 클래스·태그**를 적어 둔다.
 *   ③ 원고 CSS(= Loom 블록 «앞»)에서 `color` 를 잡는 규칙을 훑어, 그 요소에 닿으면서
 *      특정도가 부품 규칙(0,1,0)보다 **높은** 것을 고른다. 그것이 이기는 규칙이다.
 *
 * ══ 대가 — 이 장치가 틀릴 때의 모습 ═══════════════════════════════════════
 *   선택자를 못 읽으면 «안 닿는다»로 떨어져 **놓친다**(새는 방향 = 「통과」). 색을 실제로 재는
 *   것이 아니라 «누가 이기나»만 보므로, 원고가 이겨도 그 색이 마침 밝으면 거짓 적색이 난다.
 *   ⇒ 닫은 것 = ①`색값()` 이 원고가 지정한 색을 그대로 돌려주고, 호출부가 그 이름을 출력한다
 *     (거짓 적색이 떠도 사람이 1초에 가른다) ②`@media print` 안은 안 센다 — 낮 지면은 부품
 *     바탕이 통째로 달라 여기 셈이 애초에 안 맞는다.
 *   **닫지 않은 것**: 실제 대비(명도차)는 안 잰다. 재려면 CSS 변수를 끝까지 풀어야 하는데,
 *   그 해석기가 곧 두 번째 판정이 되어 갈라진다. 지금은 **「원고가 부품의 색을 이긴다」**는
 *   구조적 사실만 잡는다 — 그 자리는 «의도한 것»일 수도 있으니 예외를 허용한다(`룸잉크-허용`).
 */

'use strict';

const loom = require('./loom.js');

/** 예외 표식 — 원고가 «일부러» 부품 색을 이기는 자리에 주석으로 단다. */
const 허용표식 = '룸잉크-허용';

/** CSS 주석·문자열을 지운다(`loom훅` 과 같은 이유 — `content:"{"` 가 규칙 경계를 깬다). */
function 껍질벗기기(css) {
  return String(css)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
}

/**
 * 「제 바탕에 제 잉크를 얹는」 부품 클래스 — **`loom.css()` 에서 캔다**(손 목록 금지).
 * 바탕과 색을 둘 다 잡는 규칙만 과녁이다. 색만 잡는 부품은 이 사고가 원리적으로 안 난다.
 */
function 잉크부품들(지면 = '부품만') {
  const css = 껍질벗기기(loom.css({ 지면 }));
  const 나온것 = new Set();
  for (const [, 머리, 몸] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|[;\s])background\s*:/.test(몸) || !/(^|[;\s])color\s*:/.test(몸)) continue;
    for (const sel of 머리.split(',')) {
      /* 마지막 조각의 «맨 끝» 클래스가 그 규칙의 주인이다(`.룸 .번호` → 번호). */
      const 끝 = sel.trim().split(/[\s>+~]+/).pop() || '';
      const m = 끝.match(/\.([^\s.:#[]+)$/);
      if (m && /[가-힣]/.test(m[1])) 나온것.add(m[1]);
    }
  }
  return 나온것;
}

/** 선택자 특정도 [id, class, type] — 대략이면 충분하다(우리가 견주는 것은 0,1,0 하나뿐). */
function 특정도(sel) {
  const s = String(sel).replace(/::?[a-z-]+(\([^)]*\))?/gi, (m) =>
    /^::/.test(m) ? ' T ' : (/^:(not|is|where|has)/i.test(m) ? ' ' : ' C '));
  const id = (s.match(/#[^\s.:#[]+/g) || []).length;
  const cls = (s.match(/\.[^\s.:#[]+/g) || []).length + (s.match(/\[[^\]]*\]/g) || []).length
    + (s.match(/\bC\b/g) || []).length;
  const typ = (s.replace(/[.#][^\s.:#[]+/g, ' ').match(/\b[a-z][a-z0-9]*\b/gi) || [])
    .filter((t) => t !== 'C' && t !== 'T').length + (s.match(/\bT\b/g) || []).length;
  return [id, cls, typ];
}

const 더센가 = (a, b) => (a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2]);

/** 닫지 않는 요소 — 스택에 쌓으면 조상 사슬이 통째로 어긋난다. */
const 빈태그 = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

/**
 * 마크업에서 부품 클래스를 단 요소들 → `{태그, 클래스들, 부품, 조상[]}`.
 *
 * 🔑 **조상 사슬을 든다.** 그전엔 선택자의 «끝»만 봐서 `nav.jump span` 이 문서 어디의
 *   `.번호` span 이든 잡았다 — 실측 거짓 적색 1건(그 nav 안엔 번호가 없었다).
 *   하드 게이트는 거짓 적색을 못 견딘다: 주인 없는 적색은 남의 배포를 막고,
 *   따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).
 * ⚠`<style>`·`<script>` 안은 마크업이 아니다 — 거기 적힌 이름은 «정의»지 «쓴 것»이 아니다.
 */
function 부품단요소들(html, 부품집합) {
  const 몸 = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const 결과 = [], 스택 = [];
  for (const m of 몸.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
    const 닫음 = m[1] === '/', 태그 = m[2].toLowerCase(), 속성 = m[3] || '';
    if (닫음) {
      for (let i = 스택.length - 1; i >= 0; i--) if (스택[i].태그 === 태그) { 스택.length = i; break; }
      continue;
    }
    const 클래스들 = new Set(((속성.match(/\bclass\s*=\s*"([^"]*)"/) || [])[1] || '').split(/\s+/).filter(Boolean));
    const 마디 = { 태그, 클래스들 };
    for (const c of 클래스들) {
      if (!부품집합.has(c)) continue;
      결과.push({ 태그, 클래스들, 부품: c, 조상: 스택.map((x) => ({ 태그: x.태그, 클래스들: x.클래스들 })) });
      break;
    }
    if (!빈태그.has(태그) && !/\/\s*$/.test(속성)) 스택.push(마디);
  }
  return 결과;
}

/** 조각 하나(`div.a.b`)가 이 마디에 맞나. */
function 조각맞나(조각, 마디) {
  const 몸 = String(조각).replace(/::?[a-z-]+(\([^)]*\))?/gi, '').replace(/\[[^\]]*\]/g, '');
  if (!몸) return false;
  const 클 = (몸.match(/\.([^\s.:#[]+)/g) || []).map((x) => x.slice(1));
  const 태 = 몸.replace(/[.#][^\s.:#[]+/g, '').trim().toLowerCase();
  if (태 && 태 !== '*' && 태 !== 마디.태그) return false;
  return 클.every((c) => 마디.클래스들.has(c));
}

/**
 * 이 선택자가 이 요소에 닿나 — **조상 사슬까지 본다**(자손 결합자를 뒤에서부터 맞춘다).
 * `>`·`+`·`~` 는 자손으로 느슨하게 본다(틀리면 「닿는다」쪽 = 적색 쪽이라 안전하지 않으므로
 * 그 자리는 사람이 본다 — 대신 조상 조건이 아예 안 맞으면 확실히 뺀다).
 */
function 끝이닿나(sel, 요소) {
  const 조각들 = String(sel).trim().split(/[\s>+~]+/).filter(Boolean);
  if (!조각들.length) return false;
  if (!조각맞나(조각들[조각들.length - 1], 요소)) return false;
  let i = 조각들.length - 2, j = (요소.조상 || []).length - 1;
  while (i >= 0) {
    while (j >= 0 && !조각맞나(조각들[i], 요소.조상[j])) j--;
    if (j < 0) return false;          // 조상 조건이 안 맞는다 — 이 규칙은 이 요소에 안 닿는다
    i--; j--;
  }
  return true;
}

/** 원고가 지정한 색 — 거짓 적색이 떴을 때 사람이 1초에 가르라고 이름째 돌려준다. */
const 색값 = (몸) => (String(몸).match(/(^|[;\s])color\s*:\s*([^;}]+)/) || [])[2]?.trim() || '?';

/* ── 색을 «푼다» — 구조만 보면 거짓 적색이 난다 ────────────────────────────
 * 🔴 실측 2026-08-19: 구조 판정만으로 잡은 4건이 **4건 다 멀쩡했다**(3.04~13.55:1).
 *   원고가 이겨도 그 색이 마침 밝으면 아무 문제가 없다. 그대로 두면 이 장치는
 *   「거짓 적색 4건」을 상시로 내고, **주인 없는 적색은 남의 배포를 막는다** —
 *   그리고 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).
 * ⇒ 이기는지«만» 보지 않고 **실제 대비까지 잰다.** 못 풀면 `❔`(모름)로 낸다 —
 *   「못 쟀다」를 「없다」로도 「있다」로도 안 쓴다(F348·F207).
 * ⚠**바탕은 CSS 에서 못 읽는다** — `구움` 층이 마지막이라 부품의 실제 바탕은 «구운 이미지»
 *   (base64 WebP)다. CSS 의 `background` 는 그 뒤에 덮이는 **폴백**이라, 그걸로 재면
 *   반투명 rgba 가 종이와 섞여 «중간 회색» 바탕이 나온다 — 실물은 어두운 원판인데.
 *   (실측: 그 오독으로 coral 이 1.36:1 로 나왔는데 렌더에서는 또렷했다.)
 *   ⇒ 바탕은 **그 이미지를 «구운» 재질의 정본 색**(`디자인_토큰.json` 의 Graphite 2)으로 잡는다.
 *     지어낸 값이 아니라 굽기의 입력값이다.
 * ⚠문턱 4.5 = WCAG AA 본문 기준. 오늘 아는 다섯 색을 정확히 가른다:
 *     🔴 Navy 3 #2A3358(1.31) · Slate 2 #676767(3.04)   — 렌더로 «안 보인다» 확인
 *     ✅ Coral #FF6B5C(6.15) · Chalk/Cream #E4E4E7(13.55) — 렌더로 «또렷하다» 확인 */
const 문턱 = 4.5;

/** `#abc`·`#aabbcc`·`rgb()`·`rgba()` → [r,g,b,a]. 못 읽으면 null. */
function 색파싱(v) {
  const t = String(v).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(t);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = /^#([0-9a-f]{6})$/i.exec(t);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^rgba?\(([^)]+)\)$/i.exec(t);
  if (m) {
    const n = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (n.length >= 3 && n.slice(0, 3).every((x) => !Number.isNaN(x))) return [n[0], n[1], n[2], n.length > 3 && !Number.isNaN(n[3]) ? n[3] : 1];
  }
  return null;
}

/** 이 문서가 정의한 CSS 변수들 — 뒤에 온 정의가 이긴다(Loom 블록이 뒤에 온다). */
function 변수표(html) {
  const 표 = new Map();
  for (const m of String(html).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) 표.set(m[1], m[2].trim());
  return 표;
}

/** `var(--x, 폴백)` 를 끝까지 푼다. 순환·미정의는 null(= 모름). */
function 색풀기(값, 표, 깊이 = 0) {
  if (깊이 > 12) return null;
  const t = String(값).trim();
  const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(t);
  if (m) {
    const 다음 = 표.get(m[1]);
    if (다음 !== undefined) return 색풀기(다음, 표, 깊이 + 1);
    return m[2] ? 색풀기(m[2], 표, 깊이 + 1) : null;
  }
  return 색파싱(t);
}

/** 반투명 잉크·바탕을 아래 색에 얹는다(알파 합성). */
const 얹기색 = (위, 아래) => 위[3] >= 1 ? 위 : [0, 1, 2].map((i) => 위[i] * 위[3] + 아래[i] * (1 - 위[3])).concat(1);

const 상대휘도 = (c) => {
  const [r, g, b] = [0, 1, 2].map((i) => { const v = c[i] / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const 대비 = (a, b) => { const l1 = 상대휘도(a), l2 = 상대휘도(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

/**
 * 이 부품이 «제 바탕»으로 까는 색 — **굽기의 입력 재질**(`디자인_토큰.json` Graphite 2).
 * CSS 를 안 읽는 이유는 위 문턱 주석 참고(구운 이미지가 마지막이라 CSS 는 폴백이다).
 */
let _바탕캐시;
function 부품바탕() {
  if (_바탕캐시 !== undefined) return _바탕캐시;
  try {
    const 토큰 = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', '..', 'docs', '디자인_토큰.json'), 'utf8');
    const 색 = JSON.parse(토큰)['색'] || {};
    _바탕캐시 = 색파싱(색['Graphite 2'] || 색['Graphite2'] || '#1D1D1C');
  } catch { _바탕캐시 = 색파싱('#1D1D1C'); }
  return _바탕캐시;
}

/**
 * 충돌들 — 원고 규칙이 부품의 잉크를 이기는 자리.
 * @returns {Array<{선택자,부품,태그,색,특정도}>}
 */
function 충돌들(html, { 지면 = '부품만' } = {}) {
  const 부품집합 = 잉크부품들(지면);
  const 요소들 = 부품단요소들(html, 부품집합);
  if (!요소들.length) return [];

  /* 원고 = Loom 블록 «앞». 얹힌 CSS 를 원고로 세면 부품이 자기를 이긴다고 나온다. */
  const i = String(html).indexOf('<style data-loom=');
  const 원고 = i >= 0 ? html.slice(0, i) : html;
  const css원본 = (원고.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  /* 낮 지면(@media print)은 부품 바탕이 통째로 달라 이 셈이 안 맞는다 — 통째로 뺀다. */
  const css = 껍질벗기기(css원본.replace(/@media\s+print\s*\{[\s\S]*?\n\s*\}/gi, ' '));

  const 부품특정도 = [0, 1, 0];
  const 충돌 = [];
  for (const [, 머리, 몸] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|[;\s])color\s*:/.test(몸)) continue;
    if (머리.includes('@')) continue;
    for (const sel of 머리.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!더센가(특정도(sel), 부품특정도)) continue;
      /* 🔑 **바탕까지 원고가 가져갔으면 흠이 아니다.** 색만 이기면 어두운 원판 위에 어두운
       *   잉크가 남지만, 같은 규칙이 `background` 도 잡으면 둘이 «한 쌍»이라 스스로 맞다.
       *   실측 2026-08-19: `02_학부모_안내문_A4_mn` 의 `.slot .lim` 이 정확히 그 경우다 —
       *   칩 바탕을 cream-3 로 덮고 navy 잉크를 얹는다(렌더에서 또렷하다). 이걸 안 가르면
       *   **거짓 적색**이고, 하드 게이트에서 거짓 적색은 우회를 정상 통로로 만든다(F103). */
      if (/(^|[;\s])background(-color)?\s*:/.test(몸)) continue;
      for (const 요소 of 요소들) {
        if (!끝이닿나(sel, 요소)) continue;
        /* 이기기«만» 해서는 흠이 아니다 — 실제로 안 보여야 흠이다(위 「색을 «푼다»」 참고). */
        const 표 = 변수표(html);
        const 잉크 = 색풀기(색값(몸), 표);
        const 바탕 = 부품바탕();
        const 값 = (잉크 && 바탕) ? 대비(얹기색(잉크, 바탕), 바탕) : null;
        if (값 !== null && 값 >= 문턱) break;      // 이겨도 잘 보인다 — 흠이 아니다
        충돌.push({ 선택자: sel, 부품: 요소.부품, 태그: 요소.태그, 색: 색값(몸),
                   특정도: 특정도(sel), 대비: 값, 판정: 값 === null ? '❔' : '🔴' });
        break;
      }
    }
  }
  return 충돌;
}

/** 이 지면이 예외를 선언했나 — 원고 주석에 표식이 있으면 통째로 봐준다(의도한 자리). */
const 허용됐나 = (html) => String(html).includes(허용표식);

/**
 * ── 두 번째 방향 — 「가두는 프리셋이 **남의 글자**를 다시 칠한다」 ─────────────
 *
 * 위 `충돌들()` 이 «원고가 부품을 이긴다»면, 이쪽은 그 반대다: **Loom 이 원고를 이긴다.**
 * 가두는 프리셋(`부품만`·`인쇄부품`)은 남의 지면에 얹히는데, 그 지면의 맨요소(h2·a·blockquote)
 * 색까지 chalk(어두운 바탕 전제의 잉크)로 덮으면 **라이트 지면에서 글자가 사라진다.**
 * 2026-08-19 실측: `이해대장`·`작동대장`·`자율주행_결정록` 셋 다 제목이 **1.21:1** 이었다.
 *
 * 🔑 부품(제 바탕을 깔고 그 위에 얹는 잉크)과 **맨요소**(남의 글자)를 가르는 것이 전부다.
 *   `.번호`·`::before` 는 어두운 원판을 깔았으니 chalk 가 맞다. `h2` 는 남의 것이다.
 */
function 남의글자재도색(css) {
  const 한글클래스 = /\.[가-힣]/, 의사요소 = /::/;
  const 흠 = [];
  for (const [, 머리, 몸] of 껍질벗기기(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|[;\s])color\s*:/.test(몸)) continue;
    const 본 = 머리.trim();
    if (!본 || 본.startsWith('@')) continue;
    const sels = 본.split(',').map((x) => x.trim()).filter(Boolean);
    if (!sels.length) continue;
    /* 「전부 맨요소」일 때만 흠이다 — 섞이면 부품이 섞여 있으니 안 센다(안전한 방향). */
    if (sels.every((sel) => {
      const 끝 = sel.split(/[\s>+~]+/).pop() || '';
      return !한글클래스.test(끝) && !의사요소.test(sel);
    })) 흠.push({ 선택자: 본, 색: 색값(몸) });
  }
  return 흠;
}

module.exports = { 문턱, 조각맞나, 빈태그, 색파싱, 변수표, 색풀기, 얹기색, 대비, 부품바탕, 허용표식, 껍질벗기기, 잉크부품들, 특정도, 더센가, 부품단요소들, 끝이닿나, 색값, 충돌들, 허용됐나, 남의글자재도색 };

/* ── CLI ───────────────────────────────────────────────────────────────────
   node tools/lib/룸잉크.js <파일...>     — 충돌이 있으면 1 로 죽는다(게이트).
   ────────────────────────────────────────────────────────────────────────── */
if (require.main === module) {
  const fs = require('fs');
  const 파일들 = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!파일들.length) { console.error('용법: node tools/lib/룸잉크.js <파일...>'); process.exit(2); }
  let 적색 = 0;
  for (const f of 파일들) {
    const html = fs.readFileSync(f, 'utf8');
    if (허용됐나(html)) { console.log(`·  ${f} — 예외 선언(${허용표식})`); continue; }
    const c = 충돌들(html);
    if (!c.length) { console.log(`✅ ${f}`); continue; }
    적색 += c.length;
    console.log(`${c.some((x) => x.판정 === '🔴') ? '🔴' : '❔'} ${f} — 부품 위 잉크가 흐리다 ${c.length}건:`);
    for (const x of c) console.log(`     ${x.판정} \`${x.선택자}\` (${x.특정도.join(',')}) → color:${x.색}`
      + `  ·  부품 .${x.부품}  ·  대비 ${x.대비 === null ? '못 풀었다(색을 끝까지 못 읽음)' : x.대비.toFixed(2) + ':1 < ' + 문턱}`);
  }
  /* 0 은 분모와 함께 쓴다(F207) — 몇 벌을 봤는지 안 밝히면 미실행이 통과와 같은 모양이다. */
  console.log(`\n${적색 ? '🔴' : '✅'} 지면 ${파일들.length}벌 · 충돌 ${적색}건`);
  if (적색) process.exitCode = 1;
}
