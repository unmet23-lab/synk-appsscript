#!/usr/bin/env node
/**
 * 중성축 뒷정리 — `tools/중성축.js --적용` 이 hex·이름만 옮기고 **못 옮기는 것**을 마저 옮긴다.
 *
 * 왜 따로인가: 토큰 JSON 안에는 값 말고 «값에서 파생된 문장»이 산다 —
 *   Lime 2·Emerald 의 직책에 박힌 대비 수치 · 마스코트 허용바닥의 ΔE2000 실측 · 그림자 rgba.
 *   중성축이 바닥을 갈면 이 수치들이 그 자리에서 거짓이 되는데, **문장이라 아무 테스트도 안 운다.**
 *   그래서 「잴 수 있는 것은 잰다」를 여기서도 지킨다 — 지우고 다시 재서 박는다.
 *
 * 재는 자:
 *   대비 = WCAG 2.x (tests/브랜드색.test.js 와 같은 식)
 *   마스코트 바닥 = tools/브랜드렌더린트.js 의 deltaE2000 + 임계 12 (같은 판정을 두 곳에 안 적는다)
 *
 * 쓰기: node tools/중성축_뒷정리.js [--적용]
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 토큰경로 = path.join(ROOT, 'docs', '디자인_토큰.json');

/* 모르는 낱말 거절 — 이 도구도 토큰 정본을 덮어쓴다(중성축.js 와 같은 이유) */
const { 인자게이트 } = require('./lib/인자게이트.js');
const 플래그오류 = 인자게이트('중성축_뒷정리', process.argv.slice(2), ['--적용']);
if (플래그오류) { console.error(플래그오류); process.exit(2); }
const 토큰 = JSON.parse(fs.readFileSync(토큰경로, 'utf8'));
const 린트 = require('./브랜드렌더린트.js');

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const 선형 = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const [r, g, b] = rgb(hex).map(선형); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const 대비 = (a, b) => { const [x, y] = [lum(a), lum(b)]; const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };

const 킷 = Object.fromEntries(토큰.색.킷.map((c) => [c.이름, c.hex]));
const C = (a, b) => 대비(킷[a], 킷[b]).toFixed(2);

/* ── ① 마스코트 허용바닥 — 킷 23색 전수를 다시 잰다 ────────────────────── */
const 임계 = 린트.마스코트바닥_임계;
const 바닥단 = Object.keys(린트.MASCOT_바닥);
const 잰바닥 = 토큰.색.킷.map((c) => {
  const 최소 = Math.min(...바닥단.map((h) => 린트.deltaE2000(c.hex, h)));
  return { 이름: c.이름, hex: c.hex, ΔE: 최소, 통과: 최소 >= 임계 };
});
const 허용 = 잰바닥.filter((r) => r.통과).sort((a, b) => b.ΔE - a.ΔE);
const 막힘 = 잰바닥.filter((r) => !r.통과).sort((a, b) => a.ΔE - b.ΔE);

console.log(`── 마스코트 허용바닥 재측정 (두 의상 합집합 ${바닥단.length}단 · ΔE2000 임계 ${임계}) ──`);
console.log(`   막히는 면 ${막힘.length} : ` + 막힘.map((r) => `${r.이름} ${r.ΔE.toFixed(1)}`).join(' · '));
console.log(`   허용 ${허용.length} : ` + 허용.map((r) => `${r.이름} ${r.ΔE.toFixed(1)}`).join(' · '));
console.log(`   가장 잘 뜨는 곳 = ${허용[0].이름} (${허용[0].ΔE.toFixed(1)})`);

/* ── ② 파생 문장 다시 쓰기 ─────────────────────────────────────────────── */
const 그림자rgb = rgb(킷['Graphite']).join(',');

const 패치 = [
  ['_정본', () => (토큰._정본 =
    'SYNK 디자인 토큰 — 색·서체 값의 기계 원천 (v10 Crew Dossier 19색 · 2026-08-01 유호님 확정 / +Lime 2 · 2026-08-07 유호님 확정 / +Emerald · 2026-08-07 유호님 확정 / **중성축 11색 · 2026-08-18 유호님 확정** — 구 네이비 4단·크림 4단·슬레이트 2색이 근사 검정 #08090C / 근사 흰색 #FAFAF9 정박의 무채축으로 갈렸다. 유도기 = tools/중성축.js · 뒷정리 = tools/중성축_뒷정리.js · 근거 = 컨셉 정본 조항 ⓗ)')],

  ['Lime 2 직책', () => {
    const c = 토큰.색.킷.find((x) => x.이름 === 'Lime 2');
    c.직책 = `성장·획득의 가라앉힌 층 — 다크 위 글자·면(Graphite 4 ${C('Lime 2', 'Graphite 4')} 이상) / 라이트 위는 장식 면만(Paper ${C('Lime 2', 'Paper')} — 의미를 혼자 지면 안 된다) · 전용 구역 제한은 Lime 과 같다(철칙 ④)`;
  }],

  ['Emerald 직책', () => {
    const c = 토큰.색.킷.find((x) => x.이름 === 'Emerald');
    const 표식 = [['Chalk 3', C('Emerald', 'Chalk 3')], ['Coral Soft', C('Emerald', 'Coral Soft')]]
      .filter(([, v]) => Number(v) < 4.5);
    const 글자 = [['Paper', C('Emerald', 'Paper')], ['Chalk', C('Emerald', 'Chalk')], ['Chalk 2', C('Emerald', 'Chalk 2')], ['Coral Wash', C('Emerald', 'Coral Wash')], ['Chalk 3', C('Emerald', 'Chalk 3')], ['Coral Soft', C('Emerald', 'Coral Soft')]]
      .filter(([, v]) => Number(v) >= 4.5);
    c.직책 = `성장·획득의 라이트 면 — 라이트 전용 글자·면(${글자.map(([n, v]) => `${n} ${v}`).join('·')}` +
      (표식.length ? ` / ${표식.map(([n, v]) => `${n} ${v}`).join('·')} 는 표식만` : '') +
      `) · 다크 금지(Graphite ${C('Emerald', 'Graphite')} — 다크의 성장색은 Lime) · 이 색을 면으로 깔면 글자는 Chalk·Paper만(Ink ${대비(킷['Ink'], 킷['Emerald']).toFixed(2)} 미달)`;
  }],

  /* ⚠ `이름들` 은 «계산을 통과한 전부»가 아니라 **지면 바탕으로 실제 쓰는 큐레이션 넷**이다
   *   (구판 실측도 통과 17 중 넷만 실었다). 계산 결과를 그대로 부으면 목록이 17벌로 부풀어
   *   「사람이 읽는 요약」이라는 이 칸의 직책이 사라진다 — 계산은 린트가 이미 진다. */
  ['마스코트 허용바닥', () => {
    const h = 토큰.색.마스코트.허용바닥;
    const 큐레이션 = { 'Paper': 'Paper', 'Cream 2': 'Chalk 2', 'Coral Wash': 'Coral Wash', 'Navy 2': 'Graphite' };
    const 넷 = Object.values(큐레이션).map((n) => 잰바닥.find((r) => r.이름 === n));
    const 막힌넷 = 넷.filter((r) => !r.통과);
    if (막힌넷.length) throw new Error(`큐레이션 바닥이 막혔다: ${막힌넷.map((r) => `${r.이름} ${r.ΔE.toFixed(1)}`).join(', ')} — 중성축이 마스코트를 먹는다는 뜻이라 사람이 판정할 자리다`);
    const 최고 = [...넷].sort((a, b) => b.ΔE - a.ΔE)[0];
    h._주 = `마스코트를 «올릴 수 있는» 킷 면. 값은 킷 「이름」 참조다. 목록 밖 면 위에서는 여린 단이 바닥에 먹혀 캐릭터 윤곽이 뭉갠다. ⚠판정은 이 목록이 아니라 **계산**이다(브랜드렌더린트 ΔE2000 임계 ${임계}) — 목록은 «지면 바탕으로 실제 쓰는 넷»이라는 사람용 요약이고, 통과한 면은 이보다 많다. 실측 2026-08-18 «중성축 전환 후» 재측정(두 의상 합집합 · 킷 ${토큰.색.킷.length}색 전수): 막히는 면 ${막힘.length} — ${막힘.map((r) => `${r.이름} ${r.ΔE.toFixed(1)}`).join(' · ')}. 큐레이션 넷 = ${넷.map((r) => `${r.이름} ${r.ΔE.toFixed(1)}`).join(' · ')}. 🔑**축을 무채로 갈았는데 막히는 면 6은 그대로 코랄·핑크 계열이다** — 마스코트를 먹는 것은 밝기가 아니라 «같은 색상»이라서, 바탕에서 색을 빼는 이 개편은 마스코트 판정을 건드리지 않는다(구 넷 대비 ΔE Paper 22.5→${넷[0].ΔE.toFixed(1)} · 콜아웃 20.5→${넷[1].ΔE.toFixed(1)} · Coral Wash 15.3→${넷[2].ΔE.toFixed(1)} · 다크 바탕 26.7→${넷[3].ΔE.toFixed(1)}).`;
    h.이름들 = 넷.map((r) => r.이름);
    h.가장잘뜨는곳 = 최고.이름;
  }],

  /* 울패치중립 — 이름만 갈고 «수치는 안 옮긴다». 그 ΔE·결% 는 구 Slate(청회색 #8A93AD)·구 Navy 2 에
   * 대고 잰 값이라, 이름을 새것으로 바꿔 놓으면 «새 색으로 다시 잰 것»의 얼굴을 하게 된다.
   * 재염색 재굽기는 ④(지면 물리기)의 재질 층 몫이므로, 여기서는 낡았다는 표식만 박는다. */
  ['울패치중립 표식', () => {
    const w = 토큰.재질?.펠트?.울패치중립;
    if (!w) return;
    w._주 = w._주
      .replace(/Slate·Coral Soft 류/, 'Ash·Coral Soft 류')
      .replace(/실측 Slate ΔE 0\.09/, '실측 구 Slate ΔE 0.09')
      .replace(/극암부\(Navy 2 급\)/, '극암부(Graphite 급)')
      + ' ⚠**2026-08-18 중성축 전환 후 미재측정** — 위 ΔE·결% 는 구 Slate(#8A93AD 청회색)·구 Navy 2(#0F1730)에 대고 잰 값이다. 무채축에서는 게인이 곱이라는 제약이 더 세게 걸리므로(base 채도가 0에 가까울수록 유채로 못 간다) 새 값은 반드시 다시 재야 한다 — 재굽기는 지면 배선(④) 의 재질 층 몫.';
  }],

  ['그림자·스켈레톤 조항', () => {
    const 앱 = 토큰;
    const 훑기 = (o) => {
      if (Array.isArray(o)) return o.forEach((v, i) => {
        if (typeof v === 'string') {
          o[i] = v
            .replace(/그림자는 Navy 2 틴트만\(rgba\([\d,\s]*/, `그림자는 Graphite 틴트만(rgba(${그림자rgb},`)
            .replace(/스켈레톤 = Cream 3 \/ Navy 3/, '스켈레톤 = Chalk 3 / Graphite 4');
        } else 훑기(v);
      });
      if (o && typeof o === 'object') Object.values(o).forEach(훑기);
    };
    훑기(앱);
  }],
];

for (const [이름, fn] of 패치) { fn(); console.log(`   ✎ ${이름}`); }

/* ── ③ 남은 구 이름 신고 — 조용히 통과시키지 않는다 ───────────────────── */
/* 「구 Navy」처럼 **역사로 인용된** 자리는 거짓이 아니다 — 오히려 지워야 할 것은 그 인용 없이
 * 현재형으로 남은 이름이다. 그래서 앞에 「구 」가 붙은 것만 통과시킨다(뒤의 부정 전방탐색과 짝). */
const 구이름 = /(?<!구 )(Navy Ink|Navy 2|Navy 3|Navy|Cream 3|Cream 2|Cream|Slate 2|Slate)(?![a-zA-Z])/g;
const 남은 = [];
(function 훑기(o, 길) {
  if (typeof o === 'string') { const m = o.match(구이름); if (m) 남은.push(`${길}: ${[...new Set(m)].join(',')}`); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) 훑기(v, `${길}.${k}`);
})(토큰, '토큰');
console.log(남은.length ? `\n🔴 아직 구 이름이 남은 문장 ${남은.length}곳:\n   ` + 남은.join('\n   ') : '\n✅ 구 이름 잔재 0');

if (process.argv.includes('--적용')) {
  fs.writeFileSync(토큰경로, JSON.stringify(토큰, null, 2) + '\n', 'utf8');
  console.log('\n✅ docs/디자인_토큰.json 반영');
} else {
  console.log('\n(파일 무변경 — 반영하려면 --적용)');
}
