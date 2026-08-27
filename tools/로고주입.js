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
//   node tools/로고주입.js --펠트             펠트판으로(예외용 — 180px 이상으로 크게 나가는 지면만)
'use strict';
const fs = require('fs');
const path = require('path');
const 로고 = require('./lib/로고정본.js');

const 루트 = path.resolve(__dirname, '..');
const DIR = path.resolve(루트, 'docs', '발표물');

/* 🔑 08-28 — 홈페이지가 이 통로에 들어왔다.
 *   까닭이 이 도구의 머리말과 «같은 문장»이다: 홈페이지도 자립형 1파일이라 로고가 파일에 복사된다.
 *   그런데 병합판 헤더는 손으로 친 글자 `syn<` 였다 — 정본 SVG 가 아니라 **텍스트**였고,
 *   그 꼴은 08-24 확정이 **두 번** 막아 둔 자리다: ①`syn<` 워드마크 은퇴(「syn+화살표」 오인)
 *   ②기호 `<` 는 «안에 들어온 자리»용이고 **상단바 왼쪽 금지**. 홈페이지 헤더는 처음 오는
 *   학부모가 보는 «보여주는 순간»이라 이름 `synk` 가 서야 하는 자리다.
 *   ⇒ 도구가 안 보던 폴더라 정본에서 새어 있었다. 과녁을 넓혀 같은 명령이 여기도 덮게 한다. */
const 낱개과녁 = [
  path.resolve(루트, 'docs', '홈페이지_시안', '병합판.html'),   // 홈페이지 정본(유호 확정 08-28)
].filter((p) => fs.existsSync(p));

/**
 * LOGO SLOT 주석 바로 뒤의 <svg>…</svg> 를 확정 로고로 갈아끼운다.
 *
 * ⚠ 감싸는 div 의 class 를 `symbol` 로 못박지 말 것. 브로셔 뒤표지는 `symbol sm`(작은 판)이라
 *   처음 정규식이 그 슬롯을 **아예 못 잡았다** — 그리고 못 잡은 것은 「어긋남 0」으로 보인다.
 *   가드가 새는 방향은 언제나 「통과」다. 그래서 class 는 무엇이든 받고, 슬롯 개수를 같이 보고한다.
 */
function inject(html, 정본svg) {
  /* 🔴 08-28 — 위 주석이 「class 는 무엇이든 받고」라고 적어 뒀는데 **코드는 `symbol` 로 못 박고
   *    있었다**(주석과 코드가 갈린 자리 · 이 저장소가 「검사가 제 말과 반대를 잰다」로 세어 둔 무늬).
   *    그래서 홈페이지 헤더(`class="logo"`)를 «LOGO SLOT 없음»으로 흘려보냈다 —
   *    그리고 못 잡은 것은 언제나 「어긋남 0」, 즉 **초록 얼굴**로 나온다(주석이 예고한 그대로).
   *    ⇒ class 를 실제로 무엇이든 받게 고쳤다. 발표물 14슬롯은 그대로다(전후 실측 14 · 갱신 0). */
  const re = /(<!--\s*LOGO SLOT[\s\S]*?-->\s*(?:<div class="[^"]*">\s*)?)<svg[\s\S]*?<\/svg>/g;
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
/* 🔑 **발표물 기본 = 민판**(유호 전후비교 08-24 실측으로 정정).
 *   펠트판은 «표시 크기»가 커야 산다 — 크기별 실측: 80·110·140px 은 결이 글자 윤곽을 갉아
 *   너덜너덜하고 실땀이 노이즈로 읽힌다. 180px 부터 결이 «펠트»로 서고 240px 이상이 제 얼굴이다.
 *   그런데 발표물 로고 자리는 **21~44mm(≈79~166px)** 라 전부 그 아래다
 *   (`.symbol{width:24mm}` 안내문 · 42mm 덱 · 27mm 로드맵 · 21mm 요약 · 44/22mm 브로셔).
 *   ⇒ 이 통로의 기본은 민판이고, 펠트는 «큰 판»(스플래시·포스터급)에서만 `--펠트` 로 쓴다.
 *   🔴 첫 집행(08-24)에서 펠트로 주입했다가 전후 대조 확대에서 잡혔다 — 큰 판만 보고 정한 값이었다. */
const 표현 = process.argv.includes('--펠트') ? '펠트' : '민';
const 과녁 = [
  ...(fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((x) => x.endsWith('.html')).map((x) => path.join(DIR, x)) : []),
  ...낱개과녁,
];
if (!과녁.length) { console.log('[로고주입] 과녁 0 — 할 일 없음'); process.exit(0); }

const 쓸것 = 로고.워드마크({ 판: '다크', 표현 });
console.log(`[로고주입] synk 벡터 펠트(${표현}판) — 정본 = tools/lib/로고정본.js\n`);

let changed = 0, stale = 0, slots = 0;
for (const p of 과녁) {
  const f = path.relative(루트, p).split(path.sep).join('/');
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
