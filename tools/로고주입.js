#!/usr/bin/env node
// 로고주입 — 발표물 HTML 의 `<!-- LOGO SLOT -->` 자리에 확정 로고(W5)를 넣는다.
//
// 왜 있나: 발표물은 「자립형 HTML 1파일」이라 로고를 외부 파일로 참조할 수 없다.
//   즉 파일마다 로고가 **복사된다**. 손으로 넣으면 10종이 되기 전에 반드시 어긋난다
//   (실측 — 후보시트에서 심볼 좌표를 한 곳만 고쳤다가 락업 두 개가 조용히 깨졌다).
//   그래서 정본은 이 파일 하나이고, 주입은 명령 한 번이다.
//
// 정본 = docs/발표물/_브랜드킷.md §3 (2026-08-04 유호님 확정: 메인 W5 + W1)
//
// 사용법:
//   node tools/로고주입.js                     전 발표물에 주입(변경분만)
//   node tools/로고주입.js --check             주입 없이 어긋난 파일만 보고(CI용)
//   node tools/로고주입.js --벡터             펠트 없이 벡터 꺾쇠로(예외용)
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'docs', '발표물');

// 어두운 바탕 기준(syn=Cream · `<`=Coral — 브랜드킷 §3 v2.0). 밝은 바탕에 쓸 땐 syn=#262626(Navy).
// ⚠ viewBox 여백을 깎지 말 것 — 획 두께 절반과 글자 사이드베어링이 여기 들어간다.
const W5_DARK = `<svg viewBox="-8 -2 181 116" role="img" aria-label="SYNK">
            <text x="0" y="86" font-family="Inter Tight, system-ui, sans-serif" font-size="72" font-weight="600" letter-spacing="-1" fill="#E4E4E7">syn</text>
            <path d="M146 46.7 L112 66.35 L146 86 L159 86 L125 66.35 L159 46.7 Z" fill="#F96859"/>
          </svg>`;

/* ── B2 «신호만 펠트» (로고 한 벌 확정 08-21 — 지면·인쇄 워드마크의 확정판) ─────────────
 * syn 은 벡터 그대로 두고 **꺾쇠 하나만** 펠트 실물로 갈아끼운다. 로고에서 신호는 꺾쇠뿐이니
 * 재질도 거기 한 점에만 준다(킷 철칙 ④ 「신호 1점」의 재질판).
 *
 * 자리 계산 — 눈대중 금지:
 *   렌더는 정면 직교(ortho_scale 2.5)로 굽고, 꺾쇠몸은 `(x-135.5)/24` 로 세운다.
 *   ⇒ 화면 한 변 = 2.5 × 24 = **벡터 60단위**, 중심 = 꺾쇠 중심 (135.5, 66.35).
 *   ⇒ <image> 는 x 105.5 y 36.35 에 60×60. viewBox(-8 -2 181 116) 안에 온전히 들어간다.
 *
 * ⚠**320px 로 줄여 싣는다.** 원본 1100px 은 base64 로 1.1MB 이고 발표물은 «자립형 1파일»이라
 *   파일마다 복사된다 — 10파일이면 15MB 가 된다. 인쇄 300dpi 에서 꺾쇠 실물 폭 10mm 면
 *   118px 이 필요하니 320px 은 2.7배 여유다(파일당 +55KB).
 * ⚠렌더판이 없으면(구움/ 은 git 밖이다) **벡터판으로 물러난다** — 조용히가 아니라 경고와 함께.
 *   벡터가 정본이고 펠트는 표현층이라 이 폴백은 정당하지만, 모르고 쓰면 「왜 안 펠트지」가 된다.
 */
const 꺾쇠판 = path.resolve(__dirname, '..', 'docs', 'Loom_자산', '구움', '로고꺾쇠_몸.png');

function 펠트판() {
  if (!fs.existsSync(꺾쇠판)) return null;
  const { execFileSync } = require('child_process');
  const 줄인것 = execFileSync('python', ['-c', `
import base64,io,sys
from PIL import Image
im = Image.open(r"${꺾쇠판}").convert("RGBA").resize((320,320), Image.LANCZOS)
b = io.BytesIO(); im.save(b, format="PNG", optimize=True)
sys.stdout.write(base64.b64encode(b.getvalue()).decode())
`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  return `<svg viewBox="-8 -2 181 116" role="img" aria-label="SYNK">
            <text x="0" y="86" font-family="Inter Tight, system-ui, sans-serif" font-size="72" font-weight="600" letter-spacing="-1" fill="#E4E4E7">syn</text>
            <image x="105.5" y="36.35" width="60" height="60" href="data:image/png;base64,${줄인것}"/>
          </svg>`;
}

/**
 * LOGO SLOT 주석 바로 뒤의 <svg>…</svg> 를 확정 로고로 갈아끼운다.
 *
 * ⚠ 감싸는 div 의 class 를 `symbol` 로 못박지 말 것. 브로셔 뒤표지는 `symbol sm`(작은 판)이라
 *   처음 정규식이 그 슬롯을 **아예 못 잡았다** — 그리고 못 잡은 것은 「어긋남 0」으로 보인다.
 *   가드가 새는 방향은 언제나 「통과」다. 그래서 class 는 무엇이든 받고, 슬롯 개수를 같이 보고한다.
 */
function inject(html, 쓸것) {
  const re = /(<!--\s*LOGO SLOT[\s\S]*?-->\s*(?:<div class="symbol[^"]*">\s*)?)<svg[\s\S]*?<\/svg>/g;
  /* 🔴 실측 08-22: 발표물은 CRLF 로 저장되는데 이 상수는 소스 그대로 LF 라,
   *    **내용이 같아도 매번 «어긋남»** 으로 보고됐다(슬롯 14 중 10). 늘 빨간불인 가드는
   *    신호로서 죽는다 — 사람이 보고도 「또 그거겠지」 하고 넘긴다.
   *    ⇒ 파일이 쓰는 줄끝에 상수를 맞춘 뒤 비교한다(내용 비교이지 서식 비교가 아니다). */
  const 줄끝 = html.includes('\r\n') ? '\r\n' : '\n';
  const 정본 = (쓸것 || W5_DARK).replace(/\r?\n/g, 줄끝);
  let hits = 0;
  const out = html.replace(re, (m, head) => { hits++; return head + 정본; });
  return { out, hits };
}

const check = process.argv.includes('--check');
/* 확정표(브랜드킷 §3 렌더판)가 「지면·인쇄 워드마크 = B2 신호만 펠트」라 **기본이 펠트**다.
 * 🔴 실측 08-24: 기본이 벡터이던 동안 `--check` 는 14 중 10 을 늘 빨간불로 찍었고(내용이 아니라
 *    모드가 달라서다), 그 빨간불을 보고 무심코 `node tools/로고주입.js` 를 돌리면 지면의 펠트가
 *    조용히 벡터로 **되돌아간다**. 정본과 기본값이 어긋나면 가드는 신호가 아니라 함정이 된다.
 *    옛 동작은 `--벡터` 로만 낸다(`--펠트` 는 하위호환으로 계속 받되 이제 기본과 같다). */
const 펠트 = !process.argv.includes('--벡터');
if (!fs.existsSync(DIR)) { console.log('[로고주입] docs/발표물 없음 — 할 일 없음'); process.exit(0); }

/* 확정표(브랜드킷 §3 렌더판)의 지면·인쇄 워드마크는 B2 «신호만 펠트»다. 다만 렌더판은 git 밖이라
 * 어느 기계에서나 있으리라 보장할 수 없다 — 없으면 벡터로 물러나되 **조용히 넘어가지 않는다.** */
let 쓸것 = null;
if (펠트) {
  쓸것 = 펠트판();
  if (쓸것) console.log('[로고주입] B2 «신호만 펠트» — 꺾쇠를 실물 렌더판으로 넣는다(320px 인라인)\n');
  else console.log('🟡 렌더판이 없어 벡터판으로 물러난다 — 먼저: node tools/룸굽기.js --굽기 로고꺾쇠\n');
}

let changed = 0, stale = 0, slots = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.html'))) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  const { out, hits } = inject(src, 쓸것);
  slots += hits;
  if (!hits) { console.log(`·  ${f} — LOGO SLOT 없음`); continue; }
  if (out === src) { console.log(`✅ ${f} — 슬롯 ${hits}개 이미 확정본`); continue; }
  if (check) { stale++; console.log(`🔴 ${f} — 슬롯 ${hits}개가 정본과 다르다`); continue; }
  fs.writeFileSync(p, out);
  changed++;
  console.log(`🔧 ${f} — 슬롯 ${hits}개 주입`);
}
console.log(`\n[로고주입] 슬롯 ${slots}개 · ${check ? `어긋남 ${stale}개` : `갱신 ${changed}개 파일`}`);
process.exit(check && stale ? 1 : 0);
