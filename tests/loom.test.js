/* Loom 공용 통로 회귀 — `tools/lib/loom.js`.
 *
 * 무엇을 지키나 — **넷 다 첫날에 실제로 밟은 자리다**(가상의 위험이 아니다 · 2026-08-16):
 *   ① **광학 보정을 `%` 로 주는 것.** CSS 백분율 패딩은 부모의 «너비» 기준이라,
 *      34.97px 원판에 h2 폭(790px)의 1.5% = **11.86px** 이 들어갔다. 렌더는 멀쩡해 보였다.
 *   ② **원판 함수 안의 `position`.** 호출부가 앞에 쓴 `position:absolute` 를 «나중에 오는 것이 이겨»
 *      덮었다 — 순번 원판이 제자리에 안 앉았는데 화면은 정상으로 보였다.
 *   ③ **`::before`/`::after` 의 em 기준이 갈리는 것.** `.72em` 이 걸린 쪽과 안 걸린 쪽에서
 *      같은 `1.55em` 이 18.97px vs 26.34px 이 됐다(림이 원판보다 컸다).
 *   ④ **반복 부품에 코랄을 가두는 것.** 불릿 수십 개가 코랄이면 신호 1점(철칙 ④)이 죽는다.
 *
 * 셋 다 «맞는 얼굴로 틀린 값»이다 — 지침 v9.2 맹점 ④가 말하는 새는 방향 그대로다.
 *
 * 탐지력은 «변형 픽스처»가 진다 — 실제 출력에서 그 한 줄을 병들게 한 사본을 만들어
 * 검사기가 빨개지는지 본다(맹점 ② — 실저장소가 아직 병들어 있기를 요구하지 않는다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const loom = require(path.join(루트, 'tools', 'lib', 'loom.js'));

/** 선택자 하나의 본문을 뜬다(중첩 없는 규칙 전용 — Loom CSS 는 @media 밖이 전부 평면이다). */
function 블록(css, 선택자) {
  const i = css.indexOf(선택자 + '{');
  if (i < 0) return null;
  const s = i + 선택자.length + 1;
  const e = css.indexOf('}', s);
  return e < 0 ? null : css.slice(s, e);
}
const 코랄rgb = '255,107,92';

/* ── 검사기 — CSS 문자열 하나를 받아 흠을 낸다(테스트와 픽스처가 «같은 눈»을 쓴다) ── */
function 흠찾기(css) {
  const 흠 = [];

  // ① 광학 보정에 백분율 금지 — 부모 «너비» 기준이라 원판에서 오작동한다.
  const 퍼센트 = css.match(/padding-bottom:\s*[\d.]+%/g);
  if (퍼센트) 흠.push(`광학 보정이 백분율이다(${퍼센트.join(', ')}) — 부모 너비 기준이라 원판에서 어긋난다`);

  // ② 원판을 쓰는 자리에서 position 이 «뒤집히지» 않는가.
  //    원판 서명 = display:inline-grid;place-items:center — 그 뒤에 position 이 오면 호출부가 진다.
  //    ⚠`[^}]` 으로 «같은 블록 안»에 가둔다 — [\s\S] 로 두면 닫는 중괄호를 넘어
  //      바로 다음 규칙(.번호::before{position:absolute})을 잡아 건강한 판도 빨개진다(첫 판 실측).
  const 원판뒤position = css.match(/place-items:center;padding-bottom:\.025em;[^}]{0,400}?position:/g);
  if (원판뒤position) 흠.push('원판 서명 뒤에 position 이 온다 — 호출부의 position 을 덮는다(순번 원판이 제자리를 잃는다)');
  const 순번 = 블록(css, 'ol>li::before');
  if (!순번) 흠.push('ol>li::before(순번 원판)가 없다');
  else if (!/position:absolute/.test(순번)) 흠.push('순번 원판이 absolute 가 아니다 — li 왼쪽에 안 앉는다');

  // ③ 원판과 그 림의 em 기준이 같은가.
  const 순번림 = 블록(css, 'ol>li::after');
  if (!순번림) 흠.push('ol>li::after(순번 림)가 없다');
  else {
    const 판fs = (순번 || '').match(/font-size:([\d.]+em)/);
    const 림fs = 순번림.match(/font-size:([\d.]+em)/);
    if (!림fs) 흠.push('순번 림에 font-size 가 없다 — em 기준이 갈려 림이 원판보다 커진다');
    else if (판fs && 판fs[1] !== 림fs[1]) 흠.push(`원판 ${판fs[1]} vs 림 ${림fs[1]} — em 기준이 갈렸다`);
  }

  // ④ 반복 부품(불릿)에 코랄을 가두지 않는다 — 신호 1점이 죽는다.
  const 불릿 = 블록(css, 'ul>li::before');
  if (!불릿) 흠.push('ul>li::before(레진 불릿)가 없다');
  else if (불릿.includes(코랄rgb)) 흠.push('불릿의 갇힌 빛이 코랄이다 — 수십 개가 반복되면 신호 1점(철칙 ④)이 죽는다');

  // ⑤ 레진 5층 — 하나라도 빠지면 그냥 유리로 읽힌다.
  if (불릿) {
    if (!/radial-gradient/.test(불릿)) 흠.push('레진에 코어 글로우(radial)가 없다 — 갇힌 빛이 없으면 유리다');
    const inset수 = (불릿.match(/inset /g) || []).length;
    if (inset수 < 2) 흠.push(`레진 굴절밴드가 부족하다(inset ${inset수}개 · 2개 이상) — «두께»의 유일한 단서다`);
    if (!/box-shadow:[^;]*[^t]\s0 \d+px \d+px/.test(불릿)) 흠.push('레진에 바닥 코스틱(바깥 그림자)이 없다');
  }

  // ⑥ 유리 몸에 안료를 칠하지 않는다 — 색은 분산 림이 낸다.
  const 유리 = 블록(css, '.유리');
  if (!유리) 흠.push('.유리 블록이 없다');
  else {
    const bg = (유리.match(/background:[\s\S]*?;/) || [''])[0];
    if (bg.includes(코랄rgb)) 흠.push('유리 «몸»에 코랄이 칠해졌다 — 유리가 아니라 「색 젤리」가 된다');
  }

  // ⑦ counter 배선 — 원고가 번호를 안 적어도 서야 한다.
  if (!/h2\{counter-increment:절/.test(css)) 흠.push('h2 에 counter-increment 가 없다 — 절번호가 자동으로 안 선다');
  //    ⚠«counter 를 실제로 내는 그 규칙»의 선택자를 본다 — 패턴이 CSS 어딘가에 있는지만 보면
  //      낮 지면에 같은 선택자가 또 있어서 밤 쪽이 망가져도 통과한다(첫 판 실측).
  const 절블록 = [...css.matchAll(/([^{}]+)\{([^{}]*content:counter\(절[^}]*)\}/g)];
  if (!절블록.length) 흠.push('절번호 counter content 가 없다 — 원고가 번호를 안 적으면 아무것도 안 선다');
  else if (!절블록.some((m) => /:has\(\.번호\)/.test(m[1])))
    흠.push(':has() 갈래가 없다 — 수동 .번호 span 과 counter 가 겹쳐 두 번 찍힌다');

  // ⑦-b 원판을 쓰는 블록에서 같은 속성이 두 번 나오지 않는가.
  //     렌더는 «뒤가 이겨» 의도대로 보이지만, 어느 쪽이 사는지 못 읽게 되면 다음 편집이 조용히 빗나간다.
  for (const [, 선택자, 본문] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!본문.includes('place-items:center;padding-bottom:.025em')) continue;
    for (const 속성 of ['font-size', 'box-shadow', 'padding-bottom']) {
      const n = (본문.match(new RegExp('(?<![-\\w])' + 속성 + ':', 'g')) || []).length;
      if (n > 1) 흠.push(`«${선택자.trim()}» 에 ${속성} 이 ${n}번 — 원판이 준 값을 호출부가 겹쳐 썼다`);
    }
  }

  // ⑧ 하드코딩 hex — 값은 전부 토큰에서 온다. :root 변수 선언 줄만 예외다.
  const 루트끝 = css.indexOf('*{box-sizing');
  const 몸통 = 루트끝 > 0 ? css.slice(루트끝) : css;
  const hex = 몸통.match(/#[0-9a-fA-F]{6}\b/g);
  if (hex) 흠.push(`:root 밖에 하드코딩 hex ${hex.length}개(${[...new Set(hex)].slice(0, 3).join(', ')}) — 값은 토큰에서만 온다`);

  return 흠;
}

/* ══ 실저장소 — 지금 이 통로가 규칙을 지키는가 ══════════════════════════════ */

test('Loom 문서 지면 — 흠 0', () => {
  const 흠 = 흠찾기(loom.css({ 지면: '문서' }));
  assert.deepStrictEqual(흠, [], '흠:\n  · ' + 흠.join('\n  · '));
});

test('Loom 지면 프리셋 전량 — 부품을 쓰는 프리셋은 모두 규칙을 지킨다', () => {
  const 밴 = [];
  for (const 이름 of Object.keys(loom.지면들)) {
    const css = loom.css({ 지면: 이름 });
    const 흠 = 흠찾기(css).filter((h) =>
      // 부품만 프리셋엔 바탕(:root 색·body)이 없어 하드코딩 검사의 기준점이 다르다 — 그 항목만 뺀다
      !(이름 === '부품만' && h.startsWith(':root 밖에 하드코딩')));
    if (흠.length) 밴.push(`[${이름}] ` + 흠.join(' / '));
  }
  assert.deepStrictEqual(밴, [], 밴.join('\n'));
});

test('부품 분모 — 토큰 목록 전량이 구현돼 있다', () => {
  const r = loom.분모();
  assert.strictEqual(r.없는것.length, 0, `구현 안 된 부품: ${r.없는것.join(', ')} (${r.구현}/${r.총})`);
  assert.strictEqual(r.목록밖.length, 0, `토큰 목록에 없는 부품이 CSS 에 있다: ${r.목록밖.join(', ')}`);
  assert.ok(r.총 >= 14, `부품이 줄었다 — ${r.총}종 (14 이상이어야 한다)`);
});

test('율 사다리 — 장 ≥ 켜×1.5 ≥ 단×2.5', () => {
  const s = loom.정본().율['단계'];
  assert.ok(s['장'].px >= s['켜'].px * 1.5, `장 ${s['장'].px} < 켜 ${s['켜'].px}×1.5`);
  assert.ok(s['켜'].px * 1.5 >= s['단'].px * 2.5, `켜 ${s['켜'].px}×1.5 < 단 ${s['단'].px}×2.5`);
  // 인접 두 단이 «눈에 갈리는가» — 선형이면 아무 데나 쓰게 된다
  const 값 = Object.values(s).map((v) => v.px);
  for (let i = 1; i < 값.length; i++) {
    assert.ok(값[i] / 값[i - 1] >= 1.3, `${값[i - 1]}→${값[i]} 는 배율 1.3 미만 — 눈에 안 갈린다`);
  }
});

test('재질 직책 — 셋이 다 서 있고 레진은 «1점» 규율을 지닌다', () => {
  const 재 = loom.정본().재질;
  for (const n of ['펠트', '유리', '레진']) assert.ok(재[n], `재질 «${n}» 이 토큰에 없다`);
  assert.ok(재['_직책'], '재질 직책 표가 없다 — 안 가르면 셋이 섞여 난잡해진다');
  assert.match(재['_직책']['레진'], /1점/, '레진의 «한 지면 1점» 규율이 직책에서 사라졌다');
  assert.ok(재['레진']['_헌법'].some((h) => /속|안/.test(h)),
    '레진 헌법에 «빛은 속에 있다»가 없다 — 그게 없으면 유리와 안 갈린다');
});

/* ══ 탐지력 — 병든 픽스처를 «실제로» 잡는가 ════════════════════════════════
   맹점 ②: 실저장소가 아직 병들어 있기를 요구하지 않는다. 건강한 출력을 병들게 해서 잡는지 본다. */

const 픽스처 = [
  ['백분율 광학 보정',
    (c) => c.replace('padding-bottom:.025em;', 'padding-bottom:1.5%;'), /백분율/],
  ['원판 뒤 position (호출부를 덮는다)',
    (c) => c.replace('place-items:center;padding-bottom:.025em;',
      'place-items:center;padding-bottom:.025em;position:relative;'), /position 이 온다|absolute 가 아니다/],
  ['순번 림의 em 기준이 갈린다',
    (c) => c.replace(/(ol>li::after\{[^}]*?)font-size:\.72em;/, '$1'), /em 기준|font-size 가 없다/],
  ['불릿에 코랄을 가둔다',
    (c) => c.replace(/(ul>li::before\{[^}]*?)rgba\(246,241,232,0?\.58\)/, `$1rgba(${코랄rgb},.58)`), /신호 1점/],
  ['레진에서 코어 글로우를 뺀다',
    (c) => c.replace(/(ul>li::before\{[^}]*?)radial-gradient\([^)]*\)[^,]*,/, '$1'), /코어 글로우|유리다/],
  ['유리 몸에 안료를 칠한다',
    (c) => c.replace(/(\.유리\{[\s\S]*?background:\s*\n?\s*linear-gradient\(176deg, )rgba\([^)]*\)/,
      `$1rgba(${코랄rgb},.11)`), /색 젤리/],
  ['counter 배선을 끊는다',
    (c) => c.replace('h2{counter-increment:절', 'h2{'), /counter-increment/],
  [':has() 갈래를 없앤다',
    (c) => c.replace(/h2:not\(:has\(\.번호\)\)::before/, 'h2::before'), /has\(\) 갈래/],
  ['하드코딩 hex 를 몸통에 심는다',
    (c) => c.replace('html{scroll-padding-top:96px;background:var(--navy2)',
      'html{scroll-padding-top:96px;background:#0F1730'), /하드코딩 hex/],
  ['원판 값을 호출부가 겹쳐 쓴다',
    (c) => c.replace(/(\.잔번호\{[^}]*?)\}/, '$1box-shadow:inset 0 1px 0 rgba(0,0,0,.5);}'), /두 번|번 —/],
];

test('탐지력 — 병든 픽스처 전량을 잡는다', () => {
  const 건강 = loom.css({ 지면: '문서' });
  assert.deepStrictEqual(흠찾기(건강), [], '기준 출력이 이미 병들어 있다 — 픽스처 대조가 무의미해진다');
  const 놓친것 = [];
  for (const [이름, 병들게, 기대] of 픽스처) {
    const 병든 = 병들게(건강);
    assert.notStrictEqual(병든, 건강, `픽스처 «${이름}» 가 아무것도 안 바꿨다 — 치환이 빗나갔다(회귀가 조용히 죽는다)`);
    const 흠 = 흠찾기(병든);
    if (!흠.some((h) => 기대.test(h))) 놓친것.push(`${이름} → 잡은 흠: ${흠.length ? 흠.join(' / ') : '없음'}`);
  }
  assert.deepStrictEqual(놓친것, [], '못 잡은 픽스처:\n  · ' + 놓친것.join('\n  · '));
});

/* ══ 자기 처방 — 검사가 시키는 대로 하면 통과하는가 (맹점 ③) ══════════════ */

test('자기 처방 — 흠 메시지가 시키는 고침이 실제로 통과한다', () => {
  const 건강 = loom.css({ 지면: '문서' });
  // 「백분율이다 → em 으로」 처방을 되먹인다
  const 병든 = 건강.replace('padding-bottom:.025em;', 'padding-bottom:1.5%;');
  assert.ok(흠찾기(병든).length > 0, '병든 판이 통과했다');
  const 고친 = 병든.replace('padding-bottom:1.5%;', 'padding-bottom:.025em;');
  assert.deepStrictEqual(흠찾기(고친), [], '처방대로 고쳤는데 여전히 빨갛다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다');
});

test('시연 — 자립형이고 부품 전량에 예시가 있다', () => {
  const s = loom.시연();
  const 외부 = [...s.matchAll(/(?:src|href)="(?!data:|#)([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(외부, [], `시연이 자립형이 아니다 — 첨부 단독으로 열면 전멸한다: ${외부.join(', ')}`);
  for (const p of loom.정본().부품['목록']) {
    assert.ok(s.includes(p['자리'].slice(0, 12)),
      `부품 «${p['이름']}» 이 시연에 안 실렸다 — 목록에서 자동 조립되는 자리가 끊겼다`);
  }
});
