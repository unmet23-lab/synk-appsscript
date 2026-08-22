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

/**
 * LOGO SLOT 주석 바로 뒤의 <svg>…</svg> 를 확정 로고로 갈아끼운다.
 *
 * ⚠ 감싸는 div 의 class 를 `symbol` 로 못박지 말 것. 브로셔 뒤표지는 `symbol sm`(작은 판)이라
 *   처음 정규식이 그 슬롯을 **아예 못 잡았다** — 그리고 못 잡은 것은 「어긋남 0」으로 보인다.
 *   가드가 새는 방향은 언제나 「통과」다. 그래서 class 는 무엇이든 받고, 슬롯 개수를 같이 보고한다.
 */
function inject(html) {
  const re = /(<!--\s*LOGO SLOT[\s\S]*?-->\s*(?:<div class="symbol[^"]*">\s*)?)<svg[\s\S]*?<\/svg>/g;
  /* 🔴 실측 08-22: 발표물은 CRLF 로 저장되는데 이 상수는 소스 그대로 LF 라,
   *    **내용이 같아도 매번 «어긋남»** 으로 보고됐다(슬롯 14 중 10). 늘 빨간불인 가드는
   *    신호로서 죽는다 — 사람이 보고도 「또 그거겠지」 하고 넘긴다.
   *    ⇒ 파일이 쓰는 줄끝에 상수를 맞춘 뒤 비교한다(내용 비교이지 서식 비교가 아니다). */
  const 줄끝 = html.includes('\r\n') ? '\r\n' : '\n';
  const 정본 = W5_DARK.replace(/\r?\n/g, 줄끝);
  let hits = 0;
  const out = html.replace(re, (m, head) => { hits++; return head + 정본; });
  return { out, hits };
}

const check = process.argv.includes('--check');
if (!fs.existsSync(DIR)) { console.log('[로고주입] docs/발표물 없음 — 할 일 없음'); process.exit(0); }

let changed = 0, stale = 0, slots = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.html'))) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  const { out, hits } = inject(src);
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
