#!/usr/bin/env node
// 로고주입 — 발표물 HTML 의 `<!-- LOGO SLOT -->` 자리에 확정 로고를 넣는다.
//
// 왜 있나: 발표물은 「자립형 HTML 1파일」이라 로고를 외부 파일로 참조할 수 없다.
//   즉 파일마다 로고가 **복사된다**. 손으로 넣으면 10종이 되기 전에 반드시 어긋난다
//   (실측 — 후보시트에서 심볼 좌표를 한 곳만 고쳤다가 락업 두 개가 조용히 깨졌다).
//   그래서 도형은 정본 한 곳에서 오고, 주입은 명령 한 번이다.
//
// 정본: 판정 = docs/발표물/_브랜드킷.md §3 · 도형·표현 = tools/lib/로고정본.js (유호 확정 08-24)
//   워드마크 = `synk`(벡터 펠트 · k Coral) — 예전 `syn<`(벡터+렌더판 B2)는 은퇴.
//   벡터 펠트라 렌더판 PNG(git 밖) 의존이 사라졌다 — 어느 기계에서나 같은 로고가 선다
//   (08-24 실사고: 렌더판이 없는 화면에서 꺾쇠가 그림자만 남았다).
//
// 사용법:
//   node tools/로고주입.js                     전 발표물에 주입(변경분만)
//   node tools/로고주입.js --check             주입 없이 어긋난 파일만 보고(CI용)
//   node tools/로고주입.js --벡터             민 벡터판으로(예외용 — 필터를 못 싣는 지면)
'use strict';
const fs = require('fs');
const path = require('path');
const 로고 = require('./lib/로고정본.js');

const DIR = path.resolve(__dirname, '..', 'docs', '발표물');

/**
 * LOGO SLOT 주석 바로 뒤의 <svg>…</svg> 를 확정 로고로 갈아끼운다.
 *
 * ⚠ 감싸는 div 의 class 를 `symbol` 로 못박지 말 것. 브로셔 뒤표지는 `symbol sm`(작은 판)이라
 *   처음 정규식이 그 슬롯을 **아예 못 잡았다** — 그리고 못 잡은 것은 「어긋남 0」으로 보인다.
 *   가드가 새는 방향은 언제나 「통과」다. 그래서 class 는 무엇이든 받고, 슬롯 개수를 같이 보고한다.
 */
function inject(html, 정본svg) {
  const re = /(<!--\s*LOGO SLOT[\s\S]*?-->\s*(?:<div class="symbol[^"]*">\s*)?)<svg[\s\S]*?<\/svg>/g;
  /* 🔴 실측 08-22: 발표물은 CRLF 로 저장되는데 이 상수는 소스 그대로 LF 라,
   *    **내용이 같아도 매번 «어긋남»** 으로 보고됐다(슬롯 14 중 10). 늘 빨간불인 가드는
   *    신호로서 죽는다 — 사람이 보고도 「또 그거겠지」 하고 넘긴다.
   *    ⇒ 파일이 쓰는 줄끝에 상수를 맞춘 뒤 비교한다(내용 비교이지 서식 비교가 아니다). */
  const 줄끝 = html.includes('\r\n') ? '\r\n' : '\n';
  const 정본 = 정본svg.replace(/\r?\n/g, 줄끝);
  let hits = 0;
  const out = html.replace(re, (m, head) => { hits++; return head + 정본; });
  return { out, hits };
}

const check = process.argv.includes('--check');
/* 기본 = 펠트(확정 표현). --벡터 는 필터를 못 싣는 지면용 예외 —
 * 🔴 기본과 정본이 어긋나면 --check 가 «늘 빨간불»이 되고, 그걸 보고 무심코 주입하면
 *    지면이 조용히 옛 표현으로 되돌아간다(08-24 실측 — B2 시절의 그 함정). 기본이 정본이다. */
const 표현 = process.argv.includes('--벡터') ? '민' : '펠트';
if (!fs.existsSync(DIR)) { console.log('[로고주입] docs/발표물 없음 — 할 일 없음'); process.exit(0); }

const 쓸것 = 로고.워드마크({ 판: '다크', 표현 });
console.log(`[로고주입] synk 벡터 펠트(${표현}판) — 정본 = tools/lib/로고정본.js\n`);

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
