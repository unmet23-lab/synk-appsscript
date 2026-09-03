/* 코드가 정의한 시트 칸 ↔ 라이브 시트 실물 칸 대조
 * 자 = 코드의 `const *_HEADERS = [...]` 전량 vs 라이브 93탭의 첫 행
 * 🔴 이 자가 재는 것은 «칸이 서 있나»뿐이다 — «값이 차나»는 다른 층이다. */
const fs = require('fs');
const live = JSON.parse(fs.readFileSync('docs/_ops/소급불가_울트라/라이브시트_헤더.json', 'utf8'));

const files = fs.readdirSync('.').filter(f => /\.js$/.test(f) && !/^_/.test(f));
let src = '';
for (const f of files) src += '\n/*FILE:' + f + '*/\n' + fs.readFileSync(f, 'utf8');

// const XXX_HEADERS = [ ... ];  (여러 줄 허용)
const re = /const\s+([A-Z0-9_]*HEADERS[A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]\s*;/g;
const defs = {};
let m;
while ((m = re.exec(src))) {
  const cols = [...m[2].matchAll(/'([^']*)'|"([^"]*)"/g)].map(x => x[1] !== undefined ? x[1] : x[2]);
  if (cols.length) defs[m[1]] = cols;
}

// 라이브 탭 이름 → 헤더
const liveTabs = Object.entries(live).map(([name, v]) => ({ name, headers: (v.headers || []).map(s => String(s).trim()), rows: v.filled_rows }));

function score(cols, tab) {
  const set = new Set(tab.headers);
  let hit = 0;
  for (const c of cols) if (set.has(c)) hit++;
  return hit;
}

const report = [];
for (const [key, cols] of Object.entries(defs)) {
  if (cols.length < 3) continue;
  let best = null, bestScore = 0;
  for (const tab of liveTabs) {
    const s = score(cols, tab);
    if (s > bestScore) { bestScore = s; best = tab; }
  }
  if (!best || bestScore < Math.min(3, cols.length)) continue;
  const set = new Set(best.headers);
  const missing = cols.filter(c => c && !set.has(c));
  const extra = best.headers.filter(c => c && !cols.includes(c));
  report.push({ key, tab: best.name, code_cols: cols.length, live_cols: best.headers.length, rows: best.rows, missing, extra });
}

report.sort((a, b) => b.missing.length - a.missing.length);
fs.writeFileSync('docs/_ops/소급불가_울트라/헤더대조.json', JSON.stringify(report, null, 1));

console.log('헤더 상수', Object.keys(defs).length, '· 라이브 탭에 붙인 것', report.length);
console.log('\n🔴 라이브에 «없는 칸»이 있는 표 — 코드는 세웠는데 시트가 안 따라왔다');
for (const r of report) {
  if (!r.missing.length) continue;
  console.log(`▸ ${r.tab} (${r.key}) · 코드 ${r.code_cols}칸 ↔ 라이브 ${r.live_cols}칸 · 값든행 ${r.rows}`);
  console.log(`   없는 칸 ${r.missing.length}: ${r.missing.join(', ')}`);
}
const clean = report.filter(r => !r.missing.length);
console.log(`\n✅ 칸이 다 선 표 ${clean.length}: ${clean.map(r => r.tab).join(', ')}`);
