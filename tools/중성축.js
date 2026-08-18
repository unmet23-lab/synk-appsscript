#!/usr/bin/env node
/**
 * 중성축 — 킷의 «네이비·크림·슬레이트» 11색을 두 정박점(근사 검정 / 근사 흰색)에서 **유도**한다.
 *
 * 왜 도구인가(손 hex 금지):
 *   유호 확정 08-18 「③ 브랜드 색 교체 — 근사 검정 #08090C / 근사 흰색 #FAFAF9 · 코랄은 유지」.
 *   정박점은 앞으로도 몇 단위씩 움직일 수 있는 값이다. 손으로 11개를 박으면 그때마다 11번을 다시 짜고,
 *   대비표·조항·테스트가 갈라진다(F045 계열). 그래서 **정박점 2개만 입력**이고 나머지는 전부 파생이다.
 *   → 유호님이 정박점을 바꾸면 `node tools/중성축.js --적용` 한 번이 전부다.
 *
 * 무엇을 보존하는가:
 *   각 색이 «자기 바닥»에 대해 지금 갖는 WCAG 대비. 그 수치가 곧 §12 대비표·철칙 ②③·
 *   Slate 허용바닥이 서 있는 근거다. 색상(hue)만 죽이고 명도 «관계»는 옮긴다.
 *
 * 무엇을 «못» 보존하는가 (이 도구가 스스로 신고한다):
 *   무채로 내리면 구 킷에서 **색상으로만** 갈리던 짝이 같은 회색으로 붙는다(Ink↔Navy Ink 류).
 *   억지로 벌리면 대비 근거가 깨지므로, 이 도구는 벌리지 않고 **붙은 짝을 적색으로 보고**한다 —
 *   슬롯을 합칠지는 킷 구조 변경이라 유호님 확정 사안이다(개수 잠금 = tests/토큰정본.test.js).
 *
 * 쓰기:
 *   node tools/중성축.js              — 유도표 + 게이트 검산만 (파일 무변경)
 *   node tools/중성축.js --적용        — docs/디자인_토큰.json 에 hex·이름·직책을 반영
 *   node tools/중성축.js --다크 #0C0D11 --라이트 #F7F7F5   — 정박점을 바꿔서 다시 유도
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 토큰경로 = path.join(ROOT, 'docs', '디자인_토큰.json');

/* ── 정박점 — 유호 확정 2026-08-18 ─────────────────────────────────────── */
const 기본다크 = '#08090C';
const 기본라이트 = '#FAFAF9';

/* ── WCAG 2.x ─────────────────────────────────────────────────────────── */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const 선형 = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const [r, g, b] = rgb(hex).map(선형); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const 대비 = (a, b) => { const [x, y] = [lum(a), lum(b)]; const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };

/* CIE Lab L* — 「눈에 몇 단으로 보이는가」는 대비가 아니라 이쪽이 안다 */
const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
const Lstar = (hex) => 116 * fLab(lum(hex)) - 16;
const 채도폭 = (hex) => { const [r, g, b] = rgb(hex); return Math.max(r, g, b) - Math.min(r, g, b); };
const hex화 = (v) => '#' + v.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0').toUpperCase()).join('');
const 거리 = (a, b) => { const [x, y] = [rgb(a), rgb(b)]; return Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0)); };

/* ── 구 킷의 정박점 — 유도의 «기준선» (이 값들은 역사이지 미래가 아니다) ── */
const 구다크 = '#0F1730';   // Navy 2
const 구라이트 = '#FBF7EE'; // Paper

/**
 * 목표 대비를 내는 회색을 «전 구간 주사»로 찾는다.
 * 이진탐색을 안 쓰는 이유: 바닥보다 밝은 쪽·어두운 쪽 중 어디에 답이 있는지가 색마다 다르고
 * (Cream 2 는 라이트 바닥«보다 어두운» 면이다), 방향을 인자로 받으면 그 인자가 틀렸을 때
 * 조용히 반대쪽 끝(#000000)으로 수렴한다 — 실측으로 한 번 밟은 함정이다.
 */
function 회색_대비맞춤(바닥, 목표대비, 바닥보다밝은가) {
  let best = null, bestErr = Infinity;
  for (let v = 0; v <= 255; v++) {
    const hex = hex화([v, v, v]);
    if (바닥보다밝은가 !== (lum(hex) > lum(바닥))) continue;
    const err = Math.abs(대비(hex, 바닥) - 목표대비);
    if (err < bestErr) { bestErr = err; best = v; }
  }
  return best;
}

/** 정박점이 가진 만큼의 색조를 «끝에서 멀어질수록 옅게» 얹는다 — 가운데가 가장 순수한 회색 */
function 색조입히기(v, 정박점, 밝은쪽) {
  const [r, g, b] = rgb(정박점);
  const m = (r + g + b) / 3;
  const 방향 = [r - m, g - m, b - m];
  const k = Math.max(0, 밝은쪽 ? (v - 128) / 127 : (128 - v) / 128);
  return hex화(방향.map((d) => v + d * k));
}

/* ── 갈아탈 11칸 ────────────────────────────────────────────────────────
 * 새이름의 서사: **종이 위엔 연필심, 칠판 위엔 분필.** 라이트 = Paper + Graphite,
 * 다크 = Graphite + Chalk. 신호는 그대로 Coral 하나. 구 이름(Navy·Cream·Slate)은
 * 색상을 가리키는 낱말이라, 무채로 내리는 순간 그 자리에서 거짓이 된다 —
 * 「킷19」가 색이 늘자 거짓이 됐을 때 이 저장소가 한 일과 같은 처분이다.
 * 번호는 «밝기 순»이다(Graphite 가 가장 깊고 4가 가장 옅다 / Chalk 는 그 반대 방향).
 *
 * ⚠ **구 hex 를 토큰 파일에서 읽지 않고 여기 박는 이유**: 이 도구는 그 파일을 «자기가 고친다».
 *   파일에서 읽으면 한 번 적용한 뒤로는 기준선이 사라져 두 번째 실행이 자기 산출물을 기준으로 삼는다
 *   (= 정박점을 바꿔 다시 돌릴 수 없다). 구 킷 값은 되돌아갈 일 없는 **역사**라 여기 고정하는 것이 맞다.
 *   출처 = docs/디자인_컨셉_정본_v1.md v1.3~v1.10 · 08-01 원천 HTML. */
const 갈래 = [
  { 구: 'Paper',    구hex: '#FBF7EE', 신: 'Paper',      팔레트: '02 Chalk Family',    바닥: null,     밝은쪽: true,  고정: '라이트', 직책: '바탕(라이트) — 순백 아님(근사 흰색)' },
  { 구: 'Navy 2',   구hex: '#0F1730', 신: 'Graphite',   팔레트: '04 Graphite Family', 바닥: null,     밝은쪽: false, 고정: '다크',   직책: '바탕(다크·반전면) — 순검정 아님(근사 검정) · 표지·머리 띠' },
  { 구: 'Cream',    구hex: '#F6F1E8', 신: 'Chalk',      팔레트: '02 Chalk Family',    바닥: '다크',   밝은쪽: true,  직책: '잉크(다크 위) — 칠판 위의 분필' },
  { 구: 'Cream 2',  구hex: '#EFE7D7', 신: 'Chalk 2',    팔레트: '02 Chalk Family',    바닥: '라이트', 밝은쪽: false, 직책: '문서 콜아웃 바닥 — 종이보다 반 톤 내린 면' },
  { 구: 'Cream 3',  구hex: '#E7DDC7', 신: 'Chalk 3',    팔레트: '02 Chalk Family',    바닥: '다크',   밝은쪽: true,  직책: '반전면 보조·괘선' },
  { 구: 'Ink',      구hex: '#171820', 신: 'Ink',        팔레트: '01 Core',            바닥: '라이트', 밝은쪽: false, 직책: '본문·대형 타이포(라이트)' },
  { 구: 'Navy',     구hex: '#1A2340', 신: 'Graphite 3', 팔레트: '04 Graphite Family', 바닥: '라이트', 밝은쪽: false, 직책: '잉크(발표물 본문) — 순검정 아님' },
  { 구: 'Navy Ink', 구hex: '#131A32', 신: 'Graphite 2', 팔레트: '04 Graphite Family', 바닥: '라이트', 밝은쪽: false, 직책: '문서의 가장 깊은 글자' },
  { 구: 'Navy 3',   구hex: '#2A3358', 신: 'Graphite 4', 팔레트: '04 Graphite Family', 바닥: '라이트', 밝은쪽: false, 직책: '보조 잉크·괘선' },
  { 구: 'Slate',    구hex: '#8A93AD', 신: 'Ash',        팔레트: '06 Ash',             바닥: '다크',   밝은쪽: true,  직책: '보조 잉크 2(3번째 글자 층) — 바닥은 Graphite·Graphite 2·Graphite 3만' },
  { 구: 'Slate 2',  구hex: '#5F657D', 신: 'Ash 2',      팔레트: '06 Ash',             바닥: '라이트', 밝은쪽: false, 직책: '보조 잉크 2(3번째 글자 층) — 바닥은 Paper·Chalk·Chalk 2만' },
];

/* 「죽은 색」 — tests/브랜드색.test.js 의 DEAD 와 같은 목록. 같은 판정을 두 곳에 적으면 갈라지므로
 * 여기서는 «부활 여부를 신고만» 하고, 목록의 정본은 그 테스트가 계속 진다. */
const DEAD = {
  '#0B1A2E': '구 미드나잇블루 배경(유호 확정 08-01 폐기)',
  '#08080B': '구 순검정 배경(유호 확정 07-28 폐기 — v1.2)',
  '#F5F1E8': '구 웜크림 잉크',
  '#FDFCF8': '구 종이 바탕(유호 확정 08-01 폐기 — v1.3)',
  '#101014': '구 모드B 잉크',
  '#101528': '구 교재 다크(탈락)',
  '#183946': '구 유호 원안 배경(탈락)',
};

function 유도(다크 = 기본다크, 라이트 = 기본라이트) {
  return 갈래.map((g) => {
    const 구hex = g.구hex;
    if (g.고정) {
      const 새hex = g.고정 === '다크' ? 다크 : 라이트;
      return { ...g, 구hex, 새hex, 구대비: null, 새대비: null };
    }
    const [구바닥, 새바닥] = g.바닥 === '다크' ? [구다크, 다크] : [구라이트, 라이트];
    const 구대비 = 대비(구hex, 구바닥);
    const v = 회색_대비맞춤(새바닥, 구대비, g.밝은쪽);
    const 새hex = 색조입히기(v, g.바닥 === '다크' ? 다크 : 라이트, g.밝은쪽);
    return { ...g, 구hex, 새hex, 구대비, 새대비: 대비(새hex, 새바닥) };
  });
}

function 검산(표, 다크, 라이트) {
  const 경고 = [];
  const P = (s) => console.log(s);

  P('── 유도표 ───────────────────────────────────────────────────────────────────────────────');
  P('구 이름     구 hex    L*   채도 │ 새 이름       새 hex    L*   채도 │ 바닥    대비 구→새      Δ');
  P('─'.repeat(104));
  for (const r of 표) {
    const d = r.구대비 == null ? '   정박점(입력값)   ' :
      `${r.구대비.toFixed(2).padStart(6)}→${r.새대비.toFixed(2).padStart(6)}  ${(r.새대비 - r.구대비).toFixed(2).padStart(6)}`;
    P(`${r.구.padEnd(10)} ${r.구hex}  ${Lstar(r.구hex).toFixed(1).padStart(5)} ${String(채도폭(r.구hex)).padStart(3)}  │ ` +
      `${r.신.padEnd(12)} ${r.새hex}  ${Lstar(r.새hex).toFixed(1).padStart(5)} ${String(채도폭(r.새hex)).padStart(3)}  │ ` +
      `${(r.바닥 || '—').padEnd(6)} ${d}`);
  }

  /* ① 대비 보존 — 게이트 */
  const 깨진대비 = 표.filter((r) => r.구대비 != null && Math.abs(r.새대비 - r.구대비) > 0.25);
  P('\n① 대비 보존 (허용 ±0.25) — ' + (깨진대비.length ? `🔴 ${깨진대비.length}건` : `✅ ${표.filter((r) => r.구대비 != null).length}/${표.filter((r) => r.구대비 != null).length}`));
  깨진대비.forEach((r) => 경고.push(`대비 이탈 ${r.신} ${r.구대비.toFixed(2)}→${r.새대비.toFixed(2)}`));

  /* ② 무채화 — 채도폭이 정박점 이하인가 */
  const 최대채도 = Math.max(채도폭(다크), 채도폭(라이트));
  const 안내린것 = 표.filter((r) => 채도폭(r.새hex) > 최대채도);
  P(`② 무채화 (채도폭 ≤ 정박점 ${최대채도}) — ` + (안내린것.length ? `🔴 ${안내린것.map((r) => r.신).join(', ')}` : `✅ 11/11 · 구 킷 최대 46 → 새 최대 ${Math.max(...표.map((r) => 채도폭(r.새hex)))}`));
  안내린것.forEach((r) => 경고.push(`무채화 미달 ${r.신}`));

  /* ③ 눈에 갈리는가 — 같은 팔레트 안에서 ΔL* < 2.5 면 같은 색으로 읽힌다 */
  P('③ 단 분리 (같은 팔레트 안 ΔL* ≥ 2.5)');
  const 팔레트별 = {};
  표.forEach((r) => (팔레트별[r.팔레트] ||= []).push(r));
  let 붙음 = 0;
  for (const [p, 목록] of Object.entries(팔레트별)) {
    const 정렬 = [...목록].sort((a, b) => Lstar(a.새hex) - Lstar(b.새hex));
    for (let i = 1; i < 정렬.length; i++) {
      const dL = Lstar(정렬[i].새hex) - Lstar(정렬[i - 1].새hex);
      const 구dL = Lstar(정렬[i].구hex) - Lstar(정렬[i - 1].구hex);
      if (dL < 2.5) {
        붙음++;
        P(`   🔴 ${p}: ${정렬[i - 1].신}(${정렬[i - 1].새hex}) ↔ ${정렬[i].신}(${정렬[i].새hex}) ΔL* ${dL.toFixed(1)}` +
          `  ← 구판에선 ${구dL.toFixed(1)} 이었고 «색상»으로 갈렸다. 무채로 내리면 그 구분이 사라진다.`);
        경고.push(`단 붙음 ${정렬[i - 1].신}↔${정렬[i].신} ΔL* ${dL.toFixed(1)}`);
      }
    }
  }
  if (!붙음) P('   ✅ 붙은 짝 없음');

  /* ④ 죽은 색 부활 — 거리 16 미만이면 사실상 같은 색이다 */
  P('④ 죽은 색(DEAD) 부활 검사');
  let 부활 = 0;
  for (const r of 표) {
    for (const [d, why] of Object.entries(DEAD)) {
      const dist = 거리(r.새hex, d);
      if (dist < 16) {
        부활++;
        P(`   🔴 ${r.신} ${r.새hex} ↔ ${d} (${why}) 거리 ${dist.toFixed(1)}`);
        경고.push(`DEAD 부활 ${r.신} ${r.새hex} ≈ ${d}`);
      }
    }
  }
  if (!부활) P('   ✅ 부활 없음');

  /* ⑤ 코랄은 유지 — 새 바닥 위에서 조항 ②③ 가 그대로 서는가 */
  const 토큰 = JSON.parse(fs.readFileSync(토큰경로, 'utf8'));
  const 코랄 = Object.fromEntries(토큰.색.킷.filter((c) => c.팔레트.includes('Coral') || c.이름 === 'Coral').map((c) => [c.이름, c.hex]));
  const Ink = 표.find((r) => r.신 === 'Ink').새hex;
  P('\n⑤ 코랄(무변경) — 새 바닥 위 대비');
  for (const [n, h] of Object.entries(코랄)) {
    P(`   ${n.padEnd(11)} ${h}  다크 ${대비(h, 구다크).toFixed(2)}→${대비(h, 다크).toFixed(2)}   라이트 ${대비(h, 구라이트).toFixed(2)}→${대비(h, 라이트).toFixed(2)}`);
  }
  const 코랄글자라이트 = 대비(코랄['Coral'], 라이트);
  P(`   철칙 ② (라이트 배경 코랄 «글자» 금지 · 근거 = 4.5 미달): ${코랄글자라이트.toFixed(2)} → ` +
    (코랄글자라이트 < 4.5 ? '✅ 조항 그대로 선다' : '🔴 근거가 사라졌다 — 조항 재작성 필요'));
  if (코랄글자라이트 >= 4.5) 경고.push('철칙 ② 근거 소멸');

  const 위Ink = 대비(Ink, 코랄['Coral']), 위다크 = 대비(다크, 코랄['Coral']);
  P(`   철칙 ③ (코랄 «면» 위 글자는 Ink·바탕다크만 · 근거 = 4.5 이상): Ink ${위Ink.toFixed(2)} · Graphite ${위다크.toFixed(2)} → ` +
    (Math.min(위Ink, 위다크) >= 4.5 ? '✅ 둘 다 선다' : '🔴 한쪽이 무너졌다'));
  if (Math.min(위Ink, 위다크) < 4.5) 경고.push('철칙 ③ 근거 붕괴');

  /* ⑥ 마스코트 — 새 바닥 위에서 여린 단이 안 먹히는가 */
  const 램프 = [...(토큰.색.마스코트.램프 || []), ...(토큰.색.마스코트.평상복램프 || [])];
  const 최소 = (바닥) => Math.min(...램프.map((c) => 대비(c.hex, 바닥)));
  P(`\n⑥ 마스코트 10단 중 «가장 먹히는 단»의 바닥 대비 (높을수록 잘 뜬다)`);
  P(`   다크  ${구다크} ${최소(구다크).toFixed(2)} → ${다크} ${최소(다크).toFixed(2)}  ${최소(다크) >= 최소(구다크) ? '✅ 안 나빠짐' : '🔴 나빠졌다'}`);
  P(`   라이트 ${구라이트} ${최소(구라이트).toFixed(2)} → ${라이트} ${최소(라이트).toFixed(2)}  ${최소(라이트) >= 최소(구라이트) ? '✅ 안 나빠짐' : '🔴 나빠졌다'}`);
  if (최소(다크) < 최소(구다크)) 경고.push('마스코트 다크 바닥 악화');
  if (최소(라이트) < 최소(구라이트)) 경고.push('마스코트 라이트 바닥 악화');

  P(`\n⑦ 정박점 사이 대비: 구 ${대비(구다크, 구라이트).toFixed(2)} → 새 ${대비(다크, 라이트).toFixed(2)}`);

  return 경고;
}

function 적용(표) {
  const 원문 = fs.readFileSync(토큰경로, 'utf8');
  const 토큰 = JSON.parse(원문);
  const 맵 = Object.fromEntries(표.map((r) => [r.구, r]));

  /* 킷 — hex·이름·팔레트·직책을 한 번에 옮긴다(따로 옮기면 그 사이 판이 거짓이다) */
  토큰.색.킷 = 토큰.색.킷.map((c) => {
    const r = 맵[c.이름];
    if (!r) return c;
    return { 이름: r.신, hex: r.새hex, 팔레트: r.팔레트, 직책: r.직책 };
  });

  /* 시맨틱 — 이름 참조를 새 이름으로 (hex 신설 금지 문법 유지) */
  const 이름맵 = Object.fromEntries(표.map((r) => [r.구, r.신]));
  for (const [모드, 표2] of Object.entries(토큰.색.시맨틱)) {
    if (모드.startsWith('_')) continue;
    for (const [자리, 값] of Object.entries(표2)) {
      if (이름맵[값]) 표2[자리] = 이름맵[값];
    }
  }
  /* 마스코트 허용바닥도 이름 참조다 */
  const 허용 = 토큰.색.마스코트?.허용바닥;
  if (허용) {
    허용.이름들 = 허용.이름들.map((n) => 이름맵[n] || n);
    if (이름맵[허용.가장잘뜨는곳]) 허용.가장잘뜨는곳 = 이름맵[허용.가장잘뜨는곳];
  }

  fs.writeFileSync(토큰경로, JSON.stringify(토큰, null, 2) + '\n', 'utf8');
  return 표.length;
}

/* 회귀(tests/중성축.test.js)가 이 유도를 다시 돌려 킷과 대조한다 — 값을 두 곳에 적지 않기 위해서다 */
module.exports = { 유도, 검산, 적용, 기본다크, 기본라이트, 갈래, 대비, Lstar, 채도폭 };

/* ── main ── 라이브러리로 불릴 땐 안 돈다 ────────────────────────────────── */
if (require.main !== module) return;
const argv = process.argv.slice(2);

/* 모르는 낱말을 조용히 삼키지 않는다 — 이 도구는 **킷 hex 11개를 덮어쓴다**.
 * `--적용` 을 `--반영` 으로 잘못 치면 「돌았는데 아무것도 안 바뀐 판」이 「검산만 했다」와 같은 모양이다. */
const { 인자게이트 } = require('./lib/인자게이트.js');
const 아는플래그 = ['--적용', '--다크', '--라이트'];
const 플래그오류 = 인자게이트('중성축', argv, 아는플래그);
if (플래그오류) { console.error(플래그오류); process.exit(2); }

const 인자 = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1].toUpperCase() : d; };
const 다크 = 인자('--다크', 기본다크);
const 라이트 = 인자('--라이트', 기본라이트);
for (const [n, v] of [['--다크', 다크], ['--라이트', 라이트]]) {
  if (!/^#[0-9A-F]{6}$/.test(v)) { console.error(`${n} 값이 hex 가 아니다: ${v}`); process.exit(2); }
}

console.log(`정박점 — 다크 ${다크} · 라이트 ${라이트}  (구: ${구다크} · ${구라이트})\n`);
const 표 = 유도(다크, 라이트);
const 경고 = 검산(표, 다크, 라이트);

if (argv.includes('--적용')) {
  const n = 적용(표);
  console.log(`\n✅ docs/디자인_토큰.json — ${n}칸 반영(hex·이름·팔레트·직책 + 시맨틱·허용바닥 이름 참조).`);
  console.log('   ▶ 다음: node tools/토큰빌드.js · DESIGN.md §2 표 · 컨셉 정본 §12 · tests/브랜드색.test.js 의 DEAD');
} else {
  console.log('\n(파일은 안 건드렸다 — 반영하려면 --적용)');
}

if (경고.length) {
  console.log(`\n🔴 사람이 판정할 것 ${경고.length}건:`);
  경고.forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
  process.exitCode = 0; /* 신고이지 실패가 아니다 — 판정은 유호님 몫이다 */
}
