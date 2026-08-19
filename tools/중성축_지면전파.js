#!/usr/bin/env node
/**
 * 중성축 지면 전파 — 킷을 «hex 로 직접 박아 쓰는» 지면을 새 축으로 옮긴다 (조항 ⓗ · 2026-08-18).
 *
 * 왜 도구인가: 손으로 치환하면 ①rgb() 형태를 빠뜨리고 ②원고(_src)만 고치고 구움본을 안 고치거나
 *   그 반대를 하며 ③몇 건을 옮겼는지 아무도 모른다. 셋 다 실측으로 밟은 함정이라 세는 것까지 도구가 한다.
 *
 * ⚠ **과녁을 좁게 잡는다.** 저장소에는 구 hex 가 2,500건 넘게 있지만 대부분 «동결된 구 산출물»이고,
 *   토큰 규약 ④ 가 그것들을 소급 개서하지 말라고 한다(그때 무엇이었는지가 사라진다). 그래서 여기서 옮기는 것은
 *   **가드가 「현재 킷」으로 재는 자리 + 그 자리를 다시 굽는 원고**뿐이다 — 그 목록이 아래 과녁이고,
 *   과녁을 넓히고 싶으면 그 자리를 재는 가드부터 있어야 한다(가드 없는 개서는 그냥 유실이다).
 *
 * 쓰기: node tools/중성축_지면전파.js [--적용]
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/* 모르는 낱말 거절 — 이 도구는 지면 15벌을 한 번에 덮어쓴다. 오타가 「검산만 했다」로 보이면 안 된다. */
const { 인자게이트 } = require('./lib/인자게이트.js');
const 플래그오류 = 인자게이트('중성축_지면전파', process.argv.slice(2), ['--적용']);
if (플래그오류) { console.error(플래그오류); process.exit(2); }

/* 구 → 신. 값은 지어낸 것이 아니라 tools/중성축.js 가 유도한 것이다(같은 목록을 두 곳에 안 적기 위해 거기서 읽는다). */
const 유도 = require('./중성축.js');
/* 옮길 것 두 갈래 — 둘 다 없으면 지면이 조용히 낡는다:
 *   ㉠ 구 킷 hex → 새 hex        (Slate 2 `#5F657D` → …)
 *   ㉡ **옛 «유도값»** → 지금 값  (`#676767` → `#666666`) — 이건 «한때 새 hex 였던 것»이라
 *      ㉠ 의 map 에도 DEAD 목록에도 안 걸린다. 이미 그 값으로 구워진 지면을 덮는 자리다. */
const 맵 = Object.fromEntries([
  ...유도.유도().map((r) => [r.구hex.toUpperCase(), r.새hex.toUpperCase()]),
  ...Object.entries(유도.옛유도 || {}).map(([옛, v]) => [옛.toUpperCase(), v.지금.toUpperCase()]),
]);

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/* ── 과녁 셋 ────────────────────────────────────────────────────────────────
 *   ① 발표물 — `tests/로고정본색.test.js` 가 「킷 밖 색 0」으로 잰다(구움본 + 원고).
 *   ② 「입는다」 지면 — `지면방` 이 살아있다고 판정한 것들. 굳은 산출물이 아니라 **지금 쓰는 화면**이다.
 *   ③ 그 지면을 굽는 **생성기** — 🔑 여기가 뿌리다. 지면만 고치면 다음 빌드가 퇴역색을 도로 심는다
 *      (실측 2026-08-18: 생성기 10벌 전부가 구 hex 를 들고 있었다 · 85건).
 *   ⚠ 그래도 좁다 — `_archive`·굳은 HTML 은 토큰 규약 ④ 대로 소급 개서하지 않는다. */
const 생성기들 = [
  'tools/이해대장.js', 'tools/운영자료.js', 'tools/자율기록.js', 'tools/작동대장.js',
  'tools/브랜드킷조립.py', 'tools/교재읽기본.js', 'tools/인쇄본빌드.js', 'tools/시스템대장.js',
  'tools/발표물린트.js', 'tools/harness-export.js', 'tools/로고주입.js',
];

function 과녁들() {
  const out = [];
  const 발표물 = path.join(ROOT, 'docs', '발표물');
  for (const sub of ['', '로고']) {                                    // ①
    const d = path.join(발표물, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.html')) out.push(path.join(d, f));
  }
  out.push(path.join(발표물, '_브랜드킷.md'));

  /* ② 목록을 여기 손으로 적지 않는다 — 지면방이 이미 그 판정을 진다(같은 판정을 두 곳에 적으면 갈라진다) */
  for (const r of require('./lib/지면방.js').점검().갈래.입는다) out.push(path.join(ROOT, r.경로));
  const 원고 = path.join(ROOT, 'docs', '엔진', '_원고');               // 구움본만 고치면 다음 빌드가 되돌린다
  if (fs.existsSync(원고)) for (const f of fs.readdirSync(원고)) if (f.endsWith('.html')) out.push(path.join(원고, f));

  for (const g of 생성기들) out.push(path.join(ROOT, g));               // ③

  return [...new Set(out)].filter((p) => fs.existsSync(p));
}

let 총hex = 0, 총rgb = 0, 파일수 = 0;
const 적용 = process.argv.includes('--적용');

for (const p of 과녁들()) {
  let s = fs.readFileSync(p, 'utf8');
  const 전 = s;
  let h = 0, r = 0;

  for (const [구, 신] of Object.entries(맵)) {
    /* ① hex — 대소문자 무관, 3자리 축약형은 이 킷에 없으므로 6자리만 */
    s = s.replace(new RegExp(구, 'gi'), () => { h++; return 신; });

    /* ② rgb()/rgba() — 가드가 이 형태도 세므로 같이 옮긴다.
     *    공백 표기가 제각각이라(`rgb(15,23,48)` · `rgba( 15 , 23 , 48 , .5)`) 숫자 셋만 잡고 나머지는 원문 보존. */
    const [a, b, c] = rgb(구);
    const [x, y, z] = rgb(신);
    s = s.replace(
      new RegExp(`(rgba?\\(\\s*)${a}(\\s*,\\s*)${b}(\\s*,\\s*)${c}\\b`, 'g'),
      (_m, p1, p2, p3) => { r++; return `${p1}${x}${p2}${y}${p3}${z}`; }
    );
  }

  if (s !== 전) {
    파일수++;
    총hex += h; 총rgb += r;
    console.log(`  ${path.relative(ROOT, p).padEnd(46)} hex ${String(h).padStart(3)} · rgb ${String(r).padStart(2)}`);
    if (적용) fs.writeFileSync(p, s, 'utf8');
  }
}

console.log(`\n과녁 ${과녁들().length}벌 중 ${파일수}벌 변경 · hex ${총hex} · rgb ${총rgb}`);
if (!적용) { console.log('(파일 무변경 — 반영하려면 --적용)'); process.exit(0); }

/* 검산 — 과녁에 구 hex/rgb 가 한 건도 안 남았는가 */
const 남음 = [];
for (const p of 과녁들()) {
  const s = fs.readFileSync(p, 'utf8');
  for (const 구 of Object.keys(맵)) {
    if (new RegExp(구, 'i').test(s)) 남음.push(`${path.relative(ROOT, p)} : ${구}`);
    const [a, b, c] = rgb(구);
    if (new RegExp(`rgba?\\(\\s*${a}\\s*,\\s*${b}\\s*,\\s*${c}\\b`).test(s)) 남음.push(`${path.relative(ROOT, p)} : rgb(${a},${b},${c})`);
  }
}
console.log(남음.length ? `🔴 잔재 ${남음.length}건\n   ` + 남음.join('\n   ') : '✅ 과녁 잔재 0');
console.log('▶ 다음: node tools/발표물빌드.js  (원고를 고쳤으니 구움본을 다시 굽는다)');
