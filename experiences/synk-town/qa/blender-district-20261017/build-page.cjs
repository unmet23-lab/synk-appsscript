// Builds the comparison page (one self-contained HTML + WebP shots).
// NODE_PATH=desktop/node_modules node build-page.cjs --data=<page-data.json> --out=<dir>
const fs = require('node:fs'), path = require('node:path');
const sharp = require('sharp');
const font = require('../../../../tools/lib/브랜드폰트.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const data = JSON.parse(fs.readFileSync(path.resolve(args.data), 'utf8'));
const out = path.resolve(args.out); fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async () => {
  // Shots: data.variants[i].shots[viewKey] = png path.
  const views = data.views, shots = {};
  for (const v of data.variants) for (const view of views) {
    const src = v.shots?.[view.key]; if (!src || !fs.existsSync(src)) continue;
    const name = `${v.id}-${view.key}.webp`;
    await sharp(src).webp({ quality: 84 }).toFile(path.join(out, 'shots', name));
    (shots[view.key] ||= {})[v.id] = 'shots/' + name;
  }
  const variantsJson = JSON.stringify(data.variants.map(v => ({ id: v.id, label: v.label })));
  const shotsJson = JSON.stringify(shots);
  const viewsJson = JSON.stringify(views);
  const metricRows = data.metrics.map(row => `<tr><th scope="row">${esc(row.label)}${row.note ? `<span class="note">${esc(row.note)}</span>` : ''}</th>${data.variants.map(v => `<td class="${row.best === v.id ? 'best' : ''}">${esc(row.values[v.id] ?? '—')}</td>`).join('')}</tr>`).join('\n');
  const fpsRows = data.fps.map(row => `<tr><th scope="row">${esc(row.label)}</th>${data.variants.map(v => `<td class="${row.best === v.id ? 'best' : ''}">${esc(row.values[v.id] ?? '—')}</td>`).join('')}</tr>`).join('\n');
  const notes = data.unverified.map(n => `<li>${esc(n)}</li>`).join('');
  const how = data.variants.map(v => `<div class="how"><p class="how-label">${esc(v.label)}</p><p>${esc(v.how)}</p></div>`).join('');
  const html = `<title>찻집 구역 블렌더 비교</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@450;550;600;650;680&family=DM+Mono:wght@500&display=swap">
${font.블록()}
<style>
/* Layout: one reading column; the shot stage spans wider, numbers sit in one table. */
:root {
  --bg: #f4f6f3; --panel: #ffffff; --ink: #1d2421; --muted: #5d6a63; --line: #d9dfda;
  --accent: #2f5bb7; --good: #2f7d4f; --stage: #e8ece8;
  --ko: 'SUIT Variable', 'Inter Tight', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  --latin: 'Inter Tight', 'SUIT Variable', system-ui, sans-serif;
  --mono: 'DM Mono', ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #131816; --panel: #1b2220; --ink: #e8eeea; --muted: #a2b0a8; --line: #2c3632; --accent: #8db0ff; --good: #7fd1a0; --stage: #0f1311; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #131816; --panel: #1b2220; --ink: #e8eeea; --muted: #a2b0a8; --line: #2c3632; --accent: #8db0ff; --good: #7fd1a0; --stage: #0f1311; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--ko); font-size: 15px; font-weight: 450; line-height: 1.6; word-break: keep-all; }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 34px; }
header { display: grid; gap: 8px; max-width: 70ch; }
.eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .04em; color: var(--muted); }
h1 { font-size: clamp(26px, 4vw, 36px); font-weight: 680; line-height: 1.25; margin: 0; text-wrap: balance; }
h2 { font-size: 20px; font-weight: 650; margin: 0; text-wrap: balance; }
p { margin: 0; }
.lead { color: var(--muted); font-size: 16px; }
section { display: grid; gap: 14px; min-width: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font: inherit; font-size: 14px; font-weight: 550; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.chip:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.trio { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.trio.phone { grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); max-width: 820px; }
figure { margin: 0; display: grid; gap: 6px; min-width: 0; }
figure img { width: 100%; height: auto; display: block; border-radius: 6px; background: var(--stage); }
figcaption { font-size: 13px; font-weight: 550; color: var(--muted); }
.wipe { position: relative; max-width: 100%; border-radius: 8px; overflow: hidden; background: var(--stage); touch-action: pan-y; }
.wipe img { display: block; width: 100%; height: auto; }
.wipe .over { position: absolute; inset: 0; clip-path: inset(0 0 0 var(--cut, 50%)); }
.wipe .bar { position: absolute; top: 0; bottom: 0; left: var(--cut, 50%); width: 2px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.25); pointer-events: none; }
.wipe .tag { position: absolute; top: 10px; font-size: 13px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: rgba(20,24,22,.72); color: #fff; }
.wipe .tag.l { left: 10px; } .wipe .tag.r { right: 10px; }
.wipe-row { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; font-size: 14px; }
.wipe-row label { font-weight: 550; }
input[type=range] { width: min(100%, 420px); accent-color: var(--accent); }
.wipe.phone { max-width: 420px; }
.table-wrap { overflow-x: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; min-width: 560px; font-size: 14px; }
th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { font-weight: 600; font-size: 13px; color: var(--muted); background: var(--panel); }
tbody th { font-weight: 550; }
td { font-family: var(--latin); font-variant-numeric: tabular-nums; }
td.best { color: var(--good); font-weight: 600; }
.note { display: block; font-size: 13px; font-weight: 450; color: var(--muted); }
.hows { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 12px; }
.how { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; display: grid; gap: 6px; min-width: 0; }
.how-label { font-weight: 650; }
.decide { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; display: grid; gap: 8px; }
.decide .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); margin-right: 8px; vertical-align: middle; }
.decide .lbl { font-size: 13px; font-weight: 550; color: var(--muted); }
ul { margin: 0; padding-left: 1.2em; display: grid; gap: 4px; }
.small { font-size: 13px; color: var(--muted); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
<div class="wrap">
<header>
  <p class="eyebrow">SYNK TOWN · CAFE DISTRICT · ${esc(data.date)}</p>
  <h1>찻집 구역 블렌더 비교</h1>
  <p class="lead">${esc(data.lead)}</p>
</header>

<section aria-labelledby="shots-h">
  <h2 id="shots-h">같은 시점 화면</h2>
  <div class="chips" role="group" aria-label="시점 고르기" id="view-chips"></div>
  <div class="trio" id="trio"></div>
</section>

<section aria-labelledby="wipe-h">
  <h2 id="wipe-h">겹쳐 보기</h2>
  <div class="wipe-row">
    <label for="wipe-against">v20과 비교할 판</label>
    <select id="wipe-against" class="chip"></select>
    <label for="wipe-cut">경계 위치</label>
    <input id="wipe-cut" type="range" min="0" max="100" value="50">
  </div>
  <div class="wipe" id="wipe"><img id="wipe-base" alt=""><div class="over"><img id="wipe-over" alt=""></div><div class="bar"></div><span class="tag l">v20</span><span class="tag r" id="wipe-tag"></span></div>
  <p class="small">슬라이더 왼쪽이 v20, 오른쪽이 고른 판입니다. 같은 카메라 위치·시야각에 고정해 찍었습니다.</p>
</section>

<section aria-labelledby="num-h">
  <h2 id="num-h">수치</h2>
  <div class="table-wrap"><table>
    <thead><tr><th scope="col">항목</th>${data.variants.map(v => `<th scope="col">${esc(v.label)}</th>`).join('')}</tr></thead>
    <tbody>${metricRows}</tbody>
  </table></div>
  <div class="table-wrap"><table>
    <thead><tr><th scope="col">정지 시점 fps (중앙값)</th>${data.variants.map(v => `<th scope="col">${esc(v.label)}</th>`).join('')}</tr></thead>
    <tbody>${fpsRows}</tbody>
  </table></div>
  <p class="small">${esc(data.fpsNote)}</p>
</section>

<section aria-labelledby="how-h">
  <h2 id="how-h">각 판을 만든 방식</h2>
  <div class="hows">${how}</div>
</section>

<section aria-labelledby="todo-h">
  <h2 id="todo-h">아직 확인하지 못한 것</h2>
  <ul>${notes}</ul>
</section>

<div class="decide" role="note">
  <p class="lbl"><span class="dot" aria-hidden="true"></span>정하실 것</p>
  <p>${esc(data.decide)}</p>
</div>
</div>
<script>
const VARIANTS = ${variantsJson}, SHOTS = ${shotsJson}, VIEWS = ${viewsJson};
const chips = document.getElementById('view-chips'), trio = document.getElementById('trio');
const against = document.getElementById('wipe-against'), cut = document.getElementById('wipe-cut'), wipe = document.getElementById('wipe');
let current = VIEWS[0].key;
for (const v of VARIANTS.slice(1)) { const o = document.createElement('option'); o.value = v.id; o.textContent = v.label; against.append(o); }
function render() {
  for (const b of chips.children) b.setAttribute('aria-pressed', String(b.dataset.key === current));
  const view = VIEWS.find(v => v.key === current), phone = view.key.startsWith('390');
  trio.className = 'trio' + (phone ? ' phone' : ''); trio.replaceChildren();
  for (const v of VARIANTS) {
    const src = SHOTS[current]?.[v.id]; if (!src) continue;
    const f = document.createElement('figure'), img = document.createElement('img'), cap = document.createElement('figcaption');
    img.src = src; img.alt = v.label + ' · ' + view.label; img.loading = 'lazy'; cap.textContent = v.label;
    f.append(img, cap); trio.append(f);
  }
  wipe.className = 'wipe' + (phone ? ' phone' : '');
  document.getElementById('wipe-base').src = SHOTS[current]?.v20 || '';
  document.getElementById('wipe-over').src = SHOTS[current]?.[against.value] || '';
  document.getElementById('wipe-tag').textContent = VARIANTS.find(v => v.id === against.value)?.label || '';
}
for (const v of VIEWS) { const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.dataset.key = v.key; b.textContent = v.label; b.addEventListener('click', () => { current = v.key; render(); }); chips.append(b); }
// v20 shows left of the cut, the chosen Blender version right of it.
cut.addEventListener('input', () => wipe.style.setProperty('--cut', cut.value + '%'));
against.addEventListener('change', render);
wipe.style.setProperty('--cut', '50%');
render();
</script>
`;
  fs.writeFileSync(path.join(out, 'index.html'), html);
  console.log(JSON.stringify({ out, bytes: Buffer.byteLength(html), shots: fs.readdirSync(path.join(out, 'shots')).length }));
})().catch(e => { console.error(e); process.exitCode = 1; });
