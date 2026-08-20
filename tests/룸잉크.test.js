/* 룸잉크 회귀 — `tools/lib/룸잉크.js` (부품 위 잉크가 안 보이는가).
 *
 * 무엇을 지키나 — 2026-08-19 하루에 **같은 원인으로 세 번** 당했다. Loom 부품 몇은 제 바탕
 * (어두운 유리 원판)을 깔고 그 위에 밝은 잉크를 얹는데, 원고에 그 요소를 겨냥한 «더 센» 규칙이
 * 있으면 **색만 원고가 이겨** 어두운 바탕에 어두운 잉크가 남는다 — 숫자가 통째로 안 보인다.
 *
 * 🔑 이 실패는 **초록의 얼굴로 온다**: 훅도 마커도 있으니 `지면방` 전파는 「입었다」로 센다.
 *    진척 지표가 좋아졌다고 말하는 동안 화면은 나빠진다. 그래서 재는 것이 분모가 아니라 술어다.
 *
 * 탐지력은 **픽스처가 진다**(가드 맹점 ②). 실저장소는 지금 0건이라, 실물만 검사하면 배선을
 * 통째로 끊어도 초록이다. ⇒ 아래는 «병든 지면»을 손으로 만들어 무는지 본다.
 *
 * 🔑 이 스위트의 눈금은 **렌더로 교정됐다**(2026-08-19 · 헤드리스 크롬 6컷). 아래 색들은
 *    지어낸 값이 아니라 «눈으로 확인한» 사례다:
 *      🔴 Navy 3 · Slate 2  — 원판 위에서 안 보인다(고쳤다)
 *      ✅ Coral · Chalk     — 또렷하다(안 물어야 한다)
 *    거짓 적색을 특히 경계한다 — 하드 게이트에서 주인 없는 적색은 남의 배포를 막고,
 *    따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const 루트 = path.resolve(__dirname, '..');
const 잉 = require(path.join(루트, 'tools', 'lib', '룸잉크.js'));
const loom = require(path.join(루트, 'tools', 'lib', 'loom.js'));
const 지면방 = require(path.join(루트, 'tools', 'lib', '지면방.js'));

/** 픽스처 지면 — Loom CSS 는 «진짜» 출력이다(축소 모형은 실물과 갈리고, 갈리면 통과한다). */
const 룸CSS = loom.css({ 지면: '부품만' });
const 지면 = (원고CSS, 마크업) =>
  `<html><head><style>:root{--paper:#FAFAF9;--navy-3:#2A3358;--slate2:#676767;`
  + `--coral:#FF6B5C;--chalk:#E4E4E7}\n${원고CSS}</style></head><body>${마크업}`
  + `</body><style data-loom="부품만">\n${룸CSS}\n</style></html>`;

/* ── ① 급소 — 어두운 잉크를 무나 ─────────────────────────────────────────── */

test('🔴 원고가 부품 잉크를 이기고 «안 보이면» 문다 — 오늘 세 번 당한 그 자리', () => {
  for (const [이름, 색] of [['Navy 3', 'var(--navy-3)'], ['Slate 2', 'var(--slate2)']]) {
    const r = 잉.충돌들(지면(`h3 .num{color:${색}}`, '<h3><span class="num 번호">1</span> 제목</h3>'));
    assert.equal(r.length, 1, `${이름} 이 안 물렸다 — 이 장치의 존재 이유가 그 자리다`);
    assert.equal(r[0].판정, '🔴');
    assert.ok(r[0].대비 < 잉.문턱, `${이름} 대비가 ${r[0].대비} 로 나왔다`);
  }
});

/* ── ② 거짓 적색 — 「이겼다」가 곧 「안 보인다」는 아니다 ─────────────────── */

test('✅ 밝은 잉크는 «이겨도» 안 문다 — 렌더에서 또렷했던 Coral·Chalk', () => {
  for (const [이름, 색] of [['Coral', 'var(--coral)'], ['Chalk', 'var(--chalk)']]) {
    const r = 잉.충돌들(지면(`h2 .번호{color:${색}}`, '<h2><span class="번호">1</span> 제목</h2>'));
    assert.equal(r.length, 0, `${이름} 을 물었다 — 거짓 적색이다(렌더에서 또렷하다)`);
  }
});

test('✅ 바탕까지 원고가 가져갔으면 안 문다 — 둘이 «한 쌍»이라 스스로 맞다', () => {
  /* 실측: `02_학부모_안내문_A4_mn` 의 `.slot .lim` 이 이 경우다(칩 바탕을 밝게 덮고 navy 잉크). */
  const r = 잉.충돌들(지면('.slot .lim{background:#E7DDC7;color:var(--navy-3)}',
    '<div class="slot"><span class="lim 칩">30</span></div>'));
  assert.equal(r.length, 0, '바탕까지 덮은 자리를 물었다 — 거짓 적색이다');
});

test('🔴 조상이 안 맞으면 안 문다 — `nav.jump span` 거짓 적색(실측 1건)', () => {
  const 마크업 = '<nav class="jump"><span>시행일</span></nav><h3><span class="num 번호">1</span> 제목</h3>';
  const r = 잉.충돌들(지면('nav.jump span{color:var(--navy-3)}', 마크업));
  assert.equal(r.length, 0, '조상을 안 봐서 엉뚱한 span 을 물었다 — 조상 사슬 추적이 죽었다');
});

test('특정도가 부품보다 낮거나 같으면 안 문다 — 그 규칙은 애초에 못 이긴다', () => {
  const r = 잉.충돌들(지면('.num{color:var(--navy-3)}', '<h3><span class="num 번호">1</span></h3>'));
  assert.equal(r.length, 0, '(0,1,0) 은 부품과 동점이라 뒤에 오는 Loom 이 이긴다');
});

/* ── ③ 두 번째 방향 — Loom 이 남의 글자를 다시 칠하는가 ──────────────────── */

test('🔴 가두는 프리셋은 «남의 글자»를 다시 칠하지 않는다 — 제목이 1.21:1 로 사라졌던 자리', () => {
  for (const 프리셋 of ['부품만', '인쇄부품']) {
    const 흠 = 잉.남의글자재도색(loom.css({ 지면: 프리셋 }));
    assert.deepEqual(흠.map((x) => x.선택자), [],
      `${프리셋} 이 맨요소 색을 잡는다 — 라이트 지면에서 그 글자가 사라진다`);
  }
});

test('통짜 프리셋은 그대로 칠한다 — 「안 칠하기」를 과하게 밀면 지면 프리셋이 죽는다', () => {
  /* 이 줄이 없으면 「전부 지우기」로도 위 시험이 통과한다(반대쪽 대가를 같이 못박는다). */
  for (const 프리셋 of ['문서', '캐러셀', '웹'])
    assert.ok(잉.남의글자재도색(loom.css({ 지면: 프리셋 })).length > 0,
      `${프리셋} 은 자기가 곧 판이라 글자색을 져야 한다`);
});

/* ── ④ 분모 — 부품 목록을 손으로 안 든다 ─────────────────────────────────── */

test('잉크 부품 목록은 `loom.css()` 에서 «캔다» — 손 목록은 낡고, 낡은 분모는 조용히 통과한다', () => {
  const 부품 = 잉.잉크부품들('부품만');
  assert.ok(부품.has('번호') && 부품.has('칩'), `대표 부품이 빠졌다: ${[...부품].join('·')}`);
  for (const c of 부품) assert.ok(/[가-힣]/.test(c), `한글 부품이 아닌 것이 섞였다: ${c}`);
});

/* ── ⑤ 실저장소 — 0 은 «분모와 함께» 쓴다(F207) ──────────────────────────── */

test('실저장소 — 입은 지면 전량에 흐린 잉크 0건', () => {
  const 입은것 = 지면방.점검().갈래.입는다.filter((r) => r.입음);
  assert.ok(입은것.length >= 15, `분모가 수상하다 — 입은 지면 ${입은것.length}벌`);
  const 흠 = [];
  for (const r of 입은것) {
    const html = fs.readFileSync(path.join(루트, r.경로), 'utf8');
    if (잉.허용됐나(html)) continue;
    for (const c of 잉.충돌들(html)) 흠.push(`${r.경로} — \`${c.선택자}\` → ${c.색} (대비 ${c.대비 === null ? '?' : c.대비.toFixed(2)})`);
  }
  assert.deepEqual(흠, [], `부품 위 잉크가 흐린 자리 ${흠.length}건 (분모 ${입은것.length}벌)`);
});
