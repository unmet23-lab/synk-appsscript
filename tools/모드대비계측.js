#!/usr/bin/env node
/* 모드대비계측 — 앱 실화면을 **라이트/다크 두 벌로 놓았을 때 무엇이 깨지는지**를 잰다.
 *
 * 왜 있나:
 *   「다크가 마음에 든다」는 스와치 선호이고, 「다크를 앱 기본 모드로」는 화면 전체의 판정이다.
 *   그 사이를 잇는 것은 취향이 아니라 **두 벌을 같은 눈금으로 잰 표** 하나다 —
 *   어느 칸이 라이트에서 킷 조항 밖으로 나가는지는 재 봐야만 안다(눈으로는 「좀 흐리네」로 보인다).
 *
 * 무엇을 재나:
 *   ① 대비 — 두 모드의 글자 층 전부를 WCAG 대비로. 알파 층(태그·서브·메타·희미)은 바닥에 합성해서.
 *   ② 마스코트 바닥 — 램프가 각 면에서 먹히는지(CIEDE2000). 계산은 `브랜드렌더린트.js` 것을 **그대로** 쓴다.
 *   ③ 킷 조항 — 라이트 번역이 철칙 ②(라이트 위 코랄 글자)·③(코랄 면 위 글자)·Slate 바닥을 넘는가.
 *   ④ 구조 비용 — 모드 전환이 실제로 몇 곳을 건드리는가(`색.` 참조 수·StyleSheet 블록 수).
 *
 * 🔑 다크 값은 **talk 저장소의 `src/테마.js` 원문에서 읽는다.** 여기 사본을 두면 앱이 색을
 *   바꾼 날 이 표가 조용히 낡는다(F143 이 그 형태였다 — 손 사본이 토큰과 갈라져 있었다).
 * 🔑 라이트 카드 면은 **목록이 아니라 계산으로** 고른다(다크의 카드 들림 L* 와 가장 가까운 킷 면).
 *   손으로 「Cream 2 겠지」라고 적으면 안 잰 면을 조용히 배제한다(마스코트 바닥 임계와 같은 규율).
 *
 * ⚠ talk 저장소가 없으면 검사하지 않고 **SKIP(exit 2)** 로 드러낸다 — 통과와 미실행이 같은
 *   모양이면 안 된다(브랜드렌더린트의 크롬 없음과 같은 처리).
 *
 * ■ 이 도구의 대가 — **틀릴 때의 모습**(지침 v9.2 맹점 ④):
 *   맞는 얼굴로 틀린 값을 내는 자리는 하나다 — `테마.js` 가 색 정의 문법을 바꾸는 날
 *   (예: 상수 참조·객체 전개로 옮기면) 정규식이 그 칸을 못 읽는다. 그래서 **못 읽으면 던진다** —
 *   빠진 칸 이름을 대고 죽지, 그 칸만 빼고 표를 내지 않는다(그게 「위반 0」의 얼굴을 쓴다).
 *   ⚠ 반대로 「읽었는데 뜻이 바뀐」 경우는 못 잡는다 — 같은 이름의 칸이 다른 역할을 맡으면
 *     숫자는 멀쩡한 얼굴로 틀린다. 이건 사람이 화면을 보고 가르는 자리다.
 * ■ 닫을 것: **없다.** CI 에 안 걸고 아무것도 게이트하지 않는 «판정 재료 계측기»라,
 *   상시 비용이 0 이고 닫아서 되찾을 예산도 0 이다(판정이 끝나면 도구째 지우면 된다).
 *
 * 사용법:
 *   node tools/모드대비계측.js                     # 표를 낸다
 *   node tools/모드대비계측.js --json
 *   node tools/모드대비계측.js --쓰기               # docs/앱_모드판정_라이트vs다크.html 의 계측 블록을 갱신
 * 종료 코드: 0=쟀다 · 2=talk 없음(미실행)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* 이음매(`SYNK_TALK_ROOT`)는 그대로 이긴다 — 기본 자리만 정본 통로에서 파생한다(워크트리에서
 * `ROOT/..` 는 `worktrees/` 라 형제를 못 찾고, 이 도구는 그때 「미실행(2)」으로 끝난다). */
const TALK = process.env.SYNK_TALK_ROOT
  || require(path.join(ROOT, '.claude', 'hooks', 'lib', '형제저장소.js')).형제경로(ROOT);
const 린트 = require(path.join(ROOT, 'tools', '브랜드렌더린트.js'));
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));

const 킷 = Object.fromEntries(토큰.색.킷.map((c) => [c.이름, c.hex.toUpperCase()]));

/* ── 색 계산 ───────────────────────────────────────────────────────────────── */
const srgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const 선형 = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const 광도 = (h) => { const v = srgb(h).map(선형); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const 대비 = (a, b) => {
  const x = 광도(a), y = 광도(b);
  return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
};
const Lstar = (h) => { const y = 광도(h); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
/* 알파 층을 바닥에 합성 — 「rgba 로 적힌 글자」의 실제 대비는 이 합성색으로만 잴 수 있다. */
const 합성 = (fg, bg, a) => {
  const F = srgb(fg), B = srgb(bg);
  return '#' + F.map((c, i) => Math.round((c * a + B[i] * (1 - a)) * 255).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
};

/* ── 다크 = talk `src/테마.js` 원문 ─────────────────────────────────────────
 * ESM 이라 require 가 안 된다. 파싱은 눈에 보이게 하고, **한 칸이라도 못 읽으면 던진다** —
 * 조용히 빈 표를 내면 「위반 0」이 되어 미실행이 통과의 얼굴을 쓴다(새는 방향은 언제나 통과). */
const 테마경로 = path.join(TALK, 'src', '테마.js');
function 다크읽기() {
  const 원문 = fs.readFileSync(테마경로, 'utf8');
  const 블록 = 원문.match(/export const 색 = \{([\s\S]*?)\n\};/);
  if (!블록) throw new Error(`테마.js 에서 \`export const 색\` 블록을 못 찾았다 — ${테마경로}`);
  const 값 = {};
  for (const m of 블록[1].matchAll(/^\s*([가-힣_]+):\s*'([^']+)'/gm)) 값[m[1]] = m[2];
  const 필수 = ['바탕', '바탕띄움', '잉크', '신호', '잉크_태그', '잉크_서브', '잉크_메타', '잉크_희미', '잉크_보조'];
  const 빠짐 = 필수.filter((k) => !값[k]);
  if (빠짐.length) throw new Error(`테마.js 에서 못 읽은 칸: ${빠짐.join(', ')}`);
  return 값;
}

/* rgba(r,g,b,a) → { hex, 알파 } · #RRGGBB → { hex, 알파:1 } */
function 색풀기(v) {
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (m) {
    const hex = '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    return { hex, 알파: m[4] === undefined ? 1 : Number(m[4]) };
  }
  return { hex: v.toUpperCase(), 알파: 1 };
}

/* ── 라이트 번역 ────────────────────────────────────────────────────────────
 * 바탕·잉크·보조잉크는 토큰 `시맨틱.라이트` 가 정한다(여기서 고르지 않는다).
 * 카드 면만 토큰에 칸이 없어 **계산으로** 고른다: 다크의 카드 들림(|ΔL*|)과 가장 가까운 킷 면.
 * 후보는 Slate 2 의 허용 바닥으로 제한한다 — 3번째 글자 층이 그 위에 서야 하기 때문이다. */
function 라이트카드고르기(다크바탕, 다크카드) {
  const 목표 = Math.abs(Lstar(다크카드) - Lstar(다크바탕));
  const 바탕 = 킷[토큰.색.시맨틱.라이트.바탕];
  const 슬레이트2바닥 = ['Paper', 'Cream', 'Cream 2', 'Coral Wash']; // 토큰 Slate 2 직책의 허용 바닥
  let 최선 = null;
  for (const 이름 of 슬레이트2바닥) {
    const hex = 킷[이름];
    if (hex === 바탕) continue; // 바탕과 같은 면은 「한 층 위」가 아니다
    const 차 = Math.abs(Math.abs(Lstar(hex) - Lstar(바탕)) - 목표);
    if (!최선 || 차 < 최선.차) 최선 = { 이름, hex, 들림: Math.round(Math.abs(Lstar(hex) - Lstar(바탕)) * 100) / 100, 차 };
  }
  return { ...최선, 목표: Math.round(목표 * 100) / 100 };
}

/* ── 구조 비용 ──────────────────────────────────────────────────────────────
 * 「모드를 하나 더 두면 얼마나 큰 일인가」를 유호님이 셀 수 있는 단위로 낸다(파일 수·자리 수).
 * StyleSheet.create 는 모듈 로드 때 **한 번** 평가돼 색이 굳는다 — 런타임 전환은 이 블록들을
 * 전부 함수·훅으로 바꾸는 일이라, 그 개수가 곧 공사 규모다. */
function 구조비용() {
  const 결과 = { 색참조: 0, 색파일: 0, 스타일블록: 0, 스타일파일: 0, 테마밖색: [] };
  const 훑기 = (디렉터리) => {
    let 목록 = [];
    for (const e of fs.readdirSync(디렉터리, { withFileTypes: true })) {
      const p = path.join(디렉터리, e.name);
      if (e.isDirectory()) 목록 = 목록.concat(훑기(p));
      else if (e.name.endsWith('.js')) 목록.push(p);
    }
    return 목록;
  };
  const 파일들 = [];
  for (const d of ['src', 'lib']) {
    const p = path.join(TALK, d);
    if (fs.existsSync(p)) 파일들.push(...훑기(p));
  }
  for (const f of 파일들) {
    const 글 = fs.readFileSync(f, 'utf8');
    const 색n = (글.match(/색\./g) || []).length;
    if (색n) { 결과.색참조 += 색n; 결과.색파일 += 1; }
    const 스n = (글.match(/StyleSheet\.create/g) || []).length;
    if (스n) { 결과.스타일블록 += 스n; 결과.스타일파일 += 1; }
    /* 🔴 테마를 **안 거친** 색 — 모드 전환이 못 따라가는 자리다(전환해도 이 값만 다크로 남는다). */
    if (path.resolve(f) !== path.resolve(테마경로)) {
      for (const m of 글.matchAll(/(?:^|[^\w])(#[0-9A-Fa-f]{6}|rgba?\([\d\s,.]+\))/g)) {
        const 줄 = 글.slice(0, m.index).split('\n').length;
        결과.테마밖색.push({ 파일: path.relative(TALK, f).replace(/\\/g, '/'), 줄, 값: m[1] });
      }
    }
  }
  return 결과;
}

/* ── 카드 면 후보 (유호님 확정 ㉡ 2026-08-14 「면 2단 보강」) ──────────────────
 * 지금 다크는 바탕(Navy 2)과 카드(Navy Ink)가 ΔL* 1.48 뿐이라 카드가 거의 안 떠 있다.
 * 어느 단으로 올릴지는 **취향이 아니라 제약**이 가른다 — 카드 위에 서는 글자 층이
 * 그 면에서 전부 살아남아야 한다. 특히 `Slate`(3번째 글자 층)는 허용 바닥이 좁다.
 *
 * 🔑 후보를 손으로 고르지 않는다 — **Navy 계열 킷 면 전부**를 재고, 각 면에서
 *   ①글자 층 전부가 기준을 넘는지 ②Slate 허용 바닥인지 ③마스코트가 뜨는지를 함께 낸다.
 *   「제일 예뻐 보이는 단」이 아니라 「조항을 안 깨는 단 중 가장 많이 뜨는 단」이 답이다. */
const SLATE_허용바닥 = ['Navy 2', 'Navy', 'Navy Ink']; // 토큰 Slate 직책(Navy 3 위 4.00 미달)

function 카드후보(바탕, 잉크, 사다리) {
  const 결과 = [];
  for (const c of 토큰.색.킷) {
    if (!/^Navy/.test(c.이름)) continue;
    const hex = c.hex.toUpperCase();
    if (hex === 바탕) continue; // 바탕 자신은 「한 층 위」가 아니다
    const 층 = 사다리.map(([이름, a]) => {
      const 색 = 합성(잉크, hex, a);
      return { 층: 이름, 대비: 대비(색, hex), 기준: 이름 === '희미' ? 3.0 : 4.5 };
    });
    const slate = 킷[토큰.색.시맨틱.다크.보조잉크2];
    결과.push({
      이름: c.이름, hex,
      들림: Math.round(Math.abs(Lstar(hex) - Lstar(바탕)) * 100) / 100,
      면대면: 대비(hex, 바탕),
      층,
      글자OK: 층.every((x) => x.대비 >= x.기준 || x.층 === '희미'), // 희미는 두 면 다 이미 미달(선 전용)
      slate: { 대비: 대비(slate, hex), 허용바닥: SLATE_허용바닥.includes(c.이름) },
      신호: 대비(킷.Coral, hex),
      마스코트: 린트.마스코트가바닥에서는가(hex),
    });
  }
  return 결과.sort((a, b) => a.들림 - b.들림);
}

/* ── 계측 ───────────────────────────────────────────────────────────────────── */
function 재기() {
  const 다크값 = 다크읽기();
  const 다크 = { 바탕: 색풀기(다크값.바탕).hex, 카드: 색풀기(다크값.바탕띄움).hex };
  const 잉크 = 색풀기(다크값.잉크).hex;
  /* 알파 사다리는 **테마가 적은 그대로** 읽는다 — 여기 숫자를 적으면 정본이 둘이 된다. */
  const 사다리 = [['잉크', 1], ['태그', 색풀기(다크값.잉크_태그).알파], ['서브', 색풀기(다크값.잉크_서브).알파],
    ['메타', 색풀기(다크값.잉크_메타).알파], ['희미', 색풀기(다크값.잉크_희미).알파]];

  const 라이트바탕 = 킷[토큰.색.시맨틱.라이트.바탕];
  const 라이트잉크 = 킷[토큰.색.시맨틱.라이트.잉크];
  const 카드고름 = 라이트카드고르기(다크.바탕, 다크.카드);
  const 라이트 = { 바탕: 라이트바탕, 카드: 카드고름.hex };

  const 층 = [];
  for (const [면, d, l] of [['바탕', 다크.바탕, 라이트.바탕], ['카드', 다크.카드, 라이트.카드]]) {
    for (const [이름, a] of 사다리) {
      const dc = 합성(잉크, d, a), lc = 합성(라이트잉크, l, a);
      층.push({
        면, 층: 이름, 글자아님: 이름 === '희미',
        다크: { 색: dc, 대비: 대비(dc, d) }, 라이트: { 색: lc, 대비: 대비(lc, l) },
      });
    }
    층.push({
      면, 층: '보조잉크2', 다크: { 색: 킷[토큰.색.시맨틱.다크.보조잉크2], 대비: 대비(킷[토큰.색.시맨틱.다크.보조잉크2], d) },
      라이트: { 색: 킷[토큰.색.시맨틱.라이트.보조잉크2], 대비: 대비(킷[토큰.색.시맨틱.라이트.보조잉크2], l) },
    });
  }

  /* 신호(코랄) — 이 앱에서 코랄이 **글자로** 서는 자리가 답장 화면의 오류 태그다(13px).
   * 라이트에서는 그 자리에 놓을 킷 값이 «없다» — 그것이 이 계측의 급소다. */
  const 코랄 = 킷.Coral, 코랄3 = 킷['Coral 3'];
  const 신호 = {
    다크_바탕: 대비(코랄, 다크.바탕), 다크_카드: 대비(코랄, 다크.카드),
    라이트_바탕_코랄: 대비(코랄, 라이트.바탕), 라이트_카드_코랄: 대비(코랄, 라이트.카드),
    라이트_바탕_코랄3: 대비(코랄3, 라이트.바탕), 라이트_카드_코랄3: 대비(코랄3, 라이트.카드),
  };
  /* 코랄 면 위의 점(녹음 버튼 안쪽) — 철칙 ③: 코랄 면 위 글자·도형은 Ink·Navy 2 만. */
  const 코랄면 = { 다크점: 대비(다크.바탕, 코랄), 라이트점_잉크: 대비(라이트잉크, 코랄), 라이트점_바탕: 대비(라이트바탕, 코랄) };
  /* 맥박링 — 코랄 35% 링(말하기화면 `맥박링` opacity 0.35). 장식이라 기준은 없고 «보이는가»가 전부다. */
  const 맥박 = { 다크: 대비(합성(코랄, 다크.바탕, 0.35), 다크.바탕), 라이트: 대비(합성(코랄, 라이트.바탕, 0.35), 라이트.바탕) };

  const 마스코트 = {};
  for (const [키, hex] of [['다크_바탕', 다크.바탕], ['다크_카드', 다크.카드], ['라이트_바탕', 라이트.바탕], ['라이트_카드', 라이트.카드]]) {
    마스코트[키] = 린트.마스코트가바닥에서는가(hex);
  }

  return {
    다크, 라이트, 잉크, 라이트잉크, 카드고름, 사다리, 층, 신호, 코랄면, 맥박, 마스코트,
    카드후보: 카드후보(다크.바탕, 잉크, 사다리), 구조: 구조비용(),
  };
}

/* ── 출력 ──────────────────────────────────────────────────────────────────── */
const 기준 = (r) => (r.글자아님 ? 3.0 : 4.5); // 비텍스트 3.0 · 본문 4.5 (WCAG)
const 표식 = (v, t) => (v >= t ? '✓' : '✗');

function 사람에게(r) {
  const 줄 = [];
  줄.push(`■ 면 — 다크 바탕 ${r.다크.바탕} · 카드 ${r.다크.카드}  /  라이트 바탕 ${r.라이트.바탕} · 카드 ${r.라이트.카드}`);
  줄.push(`  카드 면은 계산으로 골랐다: 다크의 카드 들림 ΔL* ${r.카드고름.목표} → 가장 가까운 킷 면 = ${r.카드고름.이름}(${r.카드고름.들림})`);
  줄.push('');
  줄.push('■ 글자 층 대비 (기준: 본문 4.5 · 비텍스트 3.0)');
  줄.push('  면    층         다크                라이트');
  for (const x of r.층) {
    const t = 기준(x);
    줄.push(`  ${x.면.padEnd(5)} ${x.층.padEnd(9)} ${String(x.다크.대비).padStart(6)} ${표식(x.다크.대비, t)}   ${String(x.라이트.대비).padStart(6)} ${표식(x.라이트.대비, t)}`);
  }
  줄.push('');
  줄.push('■ 신호(코랄)가 글자로 서는 자리 — 답장 화면 오류 태그 13px');
  줄.push(`  다크   Coral on 바탕 ${r.신호.다크_바탕} ✓ · on 카드 ${r.신호.다크_카드} ✓`);
  줄.push(`  라이트 Coral on 바탕 ${r.신호.라이트_바탕_코랄} ✗ (철칙② = 라이트 위 코랄 글자 금지 — 크기 불문)`);
  줄.push(`  라이트 Coral 3 on 바탕 ${r.신호.라이트_바탕_코랄3} · on 카드 ${r.신호.라이트_카드_코랄3}`);
  줄.push('         → Coral 3 은 24px↑ 또는 18.7px↑ bold 한정이라 13px 태그에 못 쓴다.');
  줄.push('         → **라이트에는 이 자리에 놓을 킷 값이 없다.**');
  줄.push('');
  줄.push('■ 코랄 면 위 (녹음 버튼 안쪽 점 — 철칙③: Ink·Navy 2 만)');
  줄.push(`  다크 Navy 2 점 ${r.코랄면.다크점} ✓ · 라이트 Ink 점 ${r.코랄면.라이트점_잉크} ✓ · 라이트 Paper 점 ${r.코랄면.라이트점_바탕} ✗(철칙③)`);
  줄.push(`■ 맥박링(코랄 35%) — 다크 ${r.맥박.다크} · 라이트 ${r.맥박.라이트}`);
  줄.push('');
  줄.push(`■ 마스코트 바닥 (CIEDE2000 · 임계 ${린트.마스코트바닥_임계})`);
  for (const [k, v] of Object.entries(r.마스코트)) {
    줄.push(`  ${k.padEnd(12)} ΔE ${String(v.최소).padStart(5)} ${v.ok ? '✓' : '✗ 먹힘'}  ← 가장 먼저 먹히는 단: ${v.단}`);
  }
  줄.push('');
  줄.push('■ 다크 카드 면 후보 — 「조항을 안 깨는 단 중 가장 많이 뜨는 단」');
  줄.push('  이름         들림ΔL*  면대면  글자층  Slate바닥  마스코트  판정');
  for (const c of r.카드후보) {
    const 현행 = c.hex === r.다크.카드 ? ' ← 현행' : '';
    const ok = c.글자OK && c.slate.허용바닥 && c.마스코트.ok;
    줄.push(`  ${c.이름.padEnd(10)} ${String(c.들림).padStart(6)} ${String(c.면대면).padStart(6)}  `
      + `${c.글자OK ? '  ✓  ' : '  ✗  '}  ${c.slate.허용바닥 ? `✓ ${c.slate.대비}` : `✗ ${c.slate.대비}`}`
      + `   ΔE ${String(c.마스코트.최소).padStart(4)}  ${ok ? '쓸 수 있다' : '못 쓴다'}${현행}`);
  }
  줄.push('');
  줄.push('■ 구조 비용 (모드를 하나 더 두면 건드릴 자리)');
  줄.push(`  \`색.\` 참조 ${r.구조.색참조}곳 · 파일 ${r.구조.색파일}개`);
  줄.push(`  StyleSheet.create 블록 ${r.구조.스타일블록}개 · 파일 ${r.구조.스타일파일}개 (모듈 로드 때 색이 굳는다 — 런타임 전환은 전부 함수화)`);
  if (r.구조.테마밖색.length) {
    줄.push(`  🔴 테마를 안 거친 색 ${r.구조.테마밖색.length}곳 — 모드를 바꿔도 이 자리는 안 따라온다:`);
    for (const v of r.구조.테마밖색) 줄.push(`     · ${v.파일}:${v.줄}  ${v.값}`);
  } else {
    줄.push('  테마 밖 색 0곳');
  }
  return 줄.join('\n');
}

/* HTML 계측 블록 주입 — 숫자의 원천을 **이 도구 하나**로 둔다.
 * 손으로 베낀 사본을 페이지에 두면 재계산한 날 둘이 갈라지고, 갈라진 표는 판정 재료가 아니다. */
const 시작표식 = '<!-- 계측:시작 — node tools/모드대비계측.js --쓰기 가 이 블록을 갱신한다. 손으로 고치지 않는다. -->';
const 끝표식 = '<!-- 계측:끝 -->';

function html조각(r) {
  const 칸 = (x) => {
    const t = 기준(x);
    const 줄 = (v) => `<td class="num ${v >= t ? 'ok' : 'no'}">${v.toFixed(2)}</td>`;
    return `<tr><td>${x.면}</td><td>${x.층}</td>${줄(x.다크.대비)}${줄(x.라이트.대비)}<td class="th">${t.toFixed(1)}</td></tr>`;
  };
  const m = (k) => `${r.마스코트[k].최소} <span class="dim">(${r.마스코트[k].단})</span>`;
  return [
    시작표식,
    '<table class="meas">',
    '<thead><tr><th>면</th><th>층</th><th>다크</th><th>라이트</th><th>기준</th></tr></thead>',
    '<tbody>' + r.층.map(칸).join('') + '</tbody>',
    '</table>',
    '<dl class="meas-notes">',
    `<dt>신호(코랄) 글자 — 오류 태그 13px</dt><dd>다크 <b>${r.신호.다크_카드}</b> ✓ · 라이트 코랄 <b>${r.신호.라이트_카드_코랄}</b> ✗(철칙② 금지) · 라이트 Coral 3 <b>${r.신호.라이트_카드_코랄3}</b>(24px↑ 한정이라 13px 에 못 씀)</dd>`,
    `<dt>코랄 면 위 점 — 철칙③</dt><dd>다크 Navy 2 <b>${r.코랄면.다크점}</b> ✓ · 라이트 Ink <b>${r.코랄면.라이트점_잉크}</b> ✓ · 라이트 Paper <b>${r.코랄면.라이트점_바탕}</b> ✗</dd>`,
    `<dt>맥박링(코랄 35%)</dt><dd>다크 <b>${r.맥박.다크}</b> · 라이트 <b>${r.맥박.라이트}</b></dd>`,
    `<dt>마스코트 바닥 ΔE (임계 ${린트.마스코트바닥_임계})</dt><dd>다크 바탕 <b>${m('다크_바탕')}</b> · 다크 카드 <b>${m('다크_카드')}</b> · 라이트 바탕 <b>${m('라이트_바탕')}</b> · 라이트 카드 <b>${m('라이트_카드')}</b></dd>`,
    `<dt>구조 비용</dt><dd><code>색.</code> 참조 <b>${r.구조.색참조}</b>곳 / 파일 <b>${r.구조.색파일}</b>개 · <code>StyleSheet.create</code> 블록 <b>${r.구조.스타일블록}</b>개 · 테마 밖 색 <b>${r.구조.테마밖색.length}</b>곳${r.구조.테마밖색.map((v) => `<br><span class="dim">${v.파일}:${v.줄} — <code>${v.값}</code></span>`).join('')}</dd>`,
    `<dt>라이트 카드 면</dt><dd>계산으로 고름 — 다크 카드 들림 ΔL* ${r.카드고름.목표} → <b>${r.카드고름.이름}</b> (${r.카드고름.hex} · 들림 ${r.카드고름.들림})</dd>`,
    '</dl>',
    끝표식,
  ].join('\n');
}

function main(argv) {
  if (!fs.existsSync(테마경로)) {
    console.error(`SKIP — talk 저장소를 못 찾았다: ${테마경로}`);
    console.error('  (미실행이지 통과가 아니다 · SYNK_TALK_ROOT 로 경로를 줄 수 있다)');
    return 2;
  }
  const r = 재기();
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); return 0; }
  if (argv.includes('--쓰기')) {
    const 페이지 = path.join(ROOT, 'docs', '앱_모드판정_라이트vs다크.html');
    const 원문 = fs.readFileSync(페이지, 'utf8');
    const i = 원문.indexOf(시작표식), j = 원문.indexOf(끝표식);
    if (i < 0 || j < 0) throw new Error(`계측 표식을 못 찾았다 — ${페이지} 에 시작/끝 주석이 있어야 한다`);
    fs.writeFileSync(페이지, 원문.slice(0, i) + html조각(r) + 원문.slice(j + 끝표식.length), 'utf8');
    console.log(`계측 블록 갱신 — ${path.relative(ROOT, 페이지)}`);
    return 0;
  }
  console.log(사람에게(r));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { 재기, 대비, 합성, Lstar, 라이트카드고르기, 색풀기, 시작표식, 끝표식, html조각, TALK, 테마경로 };
