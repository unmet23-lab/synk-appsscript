/* 코드가 정의한 시트 칸 ↔ 라이브 시트 실물 칸 대조
 * 자 = 코드의 `const *_HEADERS = [...]` 전량 vs 라이브 93탭의 첫 행
 * 🔴 이 자가 재는 것은 «칸이 서 있나»뿐이다 — «값이 차나»는 다른 층이다.
 *
 * ■ 🔴 **고치지 않는다. 재기만 한다.** (유호 확정 2026-09-07)
 *   라이브 칸을 실제로 늘리는 일은 소급 불가 자리라 「더 발전한 설계로 나중에」로 미뤄 뒀다.
 *   그러니 이 파일에 «고치는 손잡이»를 붙이지 않는다 — 붙이는 순간 재는 자가 만지는 자가 된다.
 *   고치는 자(`헤더보정_` · `엔진_수집.js`)는 따로 있고, 그것을 부르는 것은 그날의 판단이다.
 *
 * ■ 🔴 **이 자는 «반쪽만 지금»이다** (09-07 에 붙인 자)
 *   코드 쪽은 지금 트리를 읽어 늘 최신인데, 라이브 쪽은 **떠 둔 사진**(`라이브시트_헤더.json`)이다.
 *   사진이 낡으면 「라이브가 안 따라왔다」가 거짓이 될 수 있다(그 사이 배포가 칸을 세웠을 수 있다).
 *   ⇒ 사진의 나이를 «먼저» 찍고, 오래됐으면 운다. 자를 밝히지 않으면 이 자는 조용히 거짓말한다
 *      (memory measurement-needs-its-instrument · zero-is-a-success-face-taxonomy).
 *
 * 쓰기: node docs/_ops/소급불가_울트라/헤더대조.js   (어느 폴더에서 불러도 된다) */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 여기 = __dirname;                         // docs/_ops/소급불가_울트라
const ROOT = path.resolve(여기, '..', '..', '..');  // 저장소 뿌리
const 사진경로 = path.join(여기, '라이브시트_헤더.json');
const live = JSON.parse(fs.readFileSync(사진경로, 'utf8'));

/* 사진이 언제 뜬 것인가 — 사진 «안»의 도장이 첫째 자다(09-07 신설).
 * 🔴 git 커밋 날짜를 첫째 자로 쓰면 «방금 새로 뜬 사진»이 커밋 전이라 옛 날짜를 말한다 —
 *   09-07 에 그 거짓을 눈으로 봤다(새로 떴는데 「09-03 · 3일 전」으로 찍혔다). */
function 사진나이() {
  const 도장 = live && live._뜬때 && live._뜬때.when;
  if (도장) return { 때: new Date(도장), 자: '사진 안의 도장' };
  try {
    const d = execFileSync('git', ['-C', ROOT, 'log', '-1', '--format=%cI', '--', 사진경로],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (d) return { 때: new Date(d), 자: 'git 마지막 커밋' };
  } catch { /* git 이 없거나 얕은 체크아웃 — 아래로 내려간다 */ }
  return { 때: fs.statSync(사진경로).mtime, 자: '파일 시각(git 이 답을 못 했다)' };
}
const 나이 = 사진나이();
const 지난날 = Math.floor((Date.now() - 나이.때.getTime()) / 86400000);
const 낡음문턱 = 14;
/* 🔴 `toISOString()` 은 UTC 라 한국 새벽에 뜬 사진이 «어제»로 찍힌다(09-07 에 봤다). 여기 시각으로 적는다. */
const 날짜 = `${나이.때.getFullYear()}-${String(나이.때.getMonth() + 1).padStart(2, '0')}-${String(나이.때.getDate()).padStart(2, '0')}`;
console.log(`📷 라이브 사진 = ${날짜} · ${지난날}일 전 (자 = ${나이.자})`);
if (지난날 >= 낡음문턱) {
  console.log(`🔴 사진이 ${낡음문턱}일을 넘었다 — 아래 「없는 칸」은 그 사이 배포가 세웠을 수 있다.`);
  console.log('   다시 뜨는 법 = 라이브 시트를 열어 탭마다 첫 행을 받아 이 파일을 새로 쓴다(읽기만 · 라이브를 안 만진다).');
}
console.log('');

const files = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f) && !/^_/.test(f));
let src = '';
for (const f of files) src += '\n/*FILE:' + f + '*/\n' + fs.readFileSync(path.join(ROOT, f), 'utf8');

// const XXX_HEADERS = [ ... ];  (여러 줄 허용)
const re = /const\s+([A-Z0-9_]*HEADERS[A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]\s*;/g;
const defs = {};
let m;
while ((m = re.exec(src))) {
  const cols = [...m[2].matchAll(/'([^']*)'|"([^"]*)"/g)].map(x => x[1] !== undefined ? x[1] : x[2]);
  if (cols.length) defs[m[1]] = cols;
}

// 라이브 탭 이름 → 헤더
/* `_` 로 시작하는 키는 탭이 아니라 사진 자신의 쪽지다(`_뜬때`) — 탭으로 세면 대조가 어긋난다. */
const liveTabs = Object.entries(live).filter(([name]) => !name.startsWith('_'))
  .map(([name, v]) => ({ name, headers: (v.headers || []).map(s => String(s).trim()), rows: v.filled_rows }));

function score(cols, tab) {
  const set = new Set(tab.headers);
  let hit = 0;
  for (const c of cols) if (set.has(c)) hit++;
  return hit;
}

const report = [];
const 못붙임 = [];   // 라이브 탭에 짝이 없는 코드 상수 — 「없는 칸 0」과 헷갈리면 안 된다
for (const [key, cols] of Object.entries(defs)) {
  if (cols.length < 3) { 못붙임.push([key, cols.length, '칸이 셋 미만이라 짝을 못 고른다(확장 칸 정의로 보인다)']); continue; }
  let best = null, bestScore = 0;
  for (const tab of liveTabs) {
    const s = score(cols, tab);
    if (s > bestScore) { bestScore = s; best = tab; }
  }
  if (!best || bestScore < Math.min(3, cols.length)) {
    못붙임.push([key, cols.length, '이 사진의 93탭 어디와도 안 겹친다 — 탭이 없거나 «다른 스프레드시트»에 산다']);
    continue;
  }
  const set = new Set(best.headers);
  const missing = cols.filter(c => c && !set.has(c));
  const extra = best.headers.filter(c => c && !cols.includes(c));
  report.push({ key, tab: best.name, code_cols: cols.length, live_cols: best.headers.length, rows: best.rows, missing, extra });
}

report.sort((a, b) => b.missing.length - a.missing.length);
fs.writeFileSync(path.join(여기, '헤더대조.json'), JSON.stringify(report, null, 1));

console.log('헤더 상수', Object.keys(defs).length, '· 라이브 탭에 붙인 것', report.length);
console.log('\n🔴 라이브에 «없는 칸»이 있는 표 — 코드는 세웠는데 시트가 안 따라왔다');
for (const r of report) {
  if (!r.missing.length) continue;
  console.log(`▸ ${r.tab} (${r.key}) · 코드 ${r.code_cols}칸 ↔ 라이브 ${r.live_cols}칸 · 값든행 ${r.rows}`);
  console.log(`   없는 칸 ${r.missing.length}: ${r.missing.join(', ')}`);
}
const clean = report.filter(r => !r.missing.length);
console.log(`\n✅ 칸이 다 선 표 ${clean.length}: ${clean.map(r => r.tab).join(', ')}`);

/* 🔴 짝을 못 찾은 상수를 «조용히 건너뛰면» 위 셈이 전수인 것처럼 읽힌다 — 그것이 거짓 초록이다.
 *   09-07 에 넷이 여기 걸렸고, 그중 상담 계열은 «다른 스프레드시트»(CONSULT_SHEET_ID)에 산다.
 *   이 사진은 SYNK_앱데이터 한 벌만 뜬 것이라 원천적으로 그 탭을 못 본다. */
if (못붙임.length) {
  console.log(`\n❔ 라이브 탭에 «못 붙인» 코드 상수 ${못붙임.length} — 위 셈에 안 들어 있다`);
  for (const [key, n, why] of 못붙임) console.log(`   · ${key} (${n}칸) — ${why}`);
}
