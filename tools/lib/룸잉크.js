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

/** 마크업에서 부품 클래스를 단 요소들 → `{태그, 클래스들, 부품}`. `<style>`·`<script>` 안은 안 본다. */
function 부품단요소들(html, 부품집합) {
  const 몸 = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const 결과 = [];
  for (const m of 몸.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\bclass\s*=\s*"([^"]*)"/g)) {
    const 클래스들 = new Set(m[2].split(/\s+/).filter(Boolean));
    for (const c of 클래스들) if (부품집합.has(c)) { 결과.push({ 태그: m[1].toLowerCase(), 클래스들, 부품: c }); break; }
  }
  return 결과;
}

/** 이 선택자의 «마지막 조각»이 이 요소에 닿나 — 조상 조건은 안 본다(닿는 쪽으로 너그럽게). */
function 끝이닿나(sel, 요소) {
  const 끝 = String(sel).trim().split(/[\s>+~]+/).pop() || '';
  const 몸 = 끝.replace(/::?[a-z-]+(\([^)]*\))?/gi, '').replace(/\[[^\]]*\]/g, '');
  if (!몸) return false;
  const 클 = (몸.match(/\.([^\s.:#[]+)/g) || []).map((x) => x.slice(1));
  const 태 = 몸.replace(/[.#][^\s.:#[]+/g, '').trim().toLowerCase();
  if (태 && 태 !== '*' && 태 !== 요소.태그) return false;
  return 클.every((c) => 요소.클래스들.has(c));
}

/** 원고가 지정한 색 — 거짓 적색이 떴을 때 사람이 1초에 가르라고 이름째 돌려준다. */
const 색값 = (몸) => (String(몸).match(/(^|[;\s])color\s*:\s*([^;}]+)/) || [])[2]?.trim() || '?';

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
      for (const 요소 of 요소들) {
        if (!끝이닿나(sel, 요소)) continue;
        충돌.push({ 선택자: sel, 부품: 요소.부품, 태그: 요소.태그, 색: 색값(몸), 특정도: 특정도(sel) });
        break;
      }
    }
  }
  return 충돌;
}

/** 이 지면이 예외를 선언했나 — 원고 주석에 표식이 있으면 통째로 봐준다(의도한 자리). */
const 허용됐나 = (html) => String(html).includes(허용표식);

module.exports = { 허용표식, 껍질벗기기, 잉크부품들, 특정도, 더센가, 부품단요소들, 끝이닿나, 색값, 충돌들, 허용됐나 };

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
    console.log(`🔴 ${f} — 원고가 부품 잉크를 이긴다 ${c.length}건:`);
    for (const x of c) console.log(`     \`${x.선택자}\` (${x.특정도.join(',')}) → color:${x.색}  ·  부품 .${x.부품}`);
  }
  /* 0 은 분모와 함께 쓴다(F207) — 몇 벌을 봤는지 안 밝히면 미실행이 통과와 같은 모양이다. */
  console.log(`\n${적색 ? '🔴' : '✅'} 지면 ${파일들.length}벌 · 충돌 ${적색}건`);
  if (적색) process.exitCode = 1;
}
