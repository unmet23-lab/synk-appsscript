'use strict';
// 구 일치 검사와 속도 재기(1-가 구현 설계 8절 「구 일치 검사」, 1절).
// 시안(docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html)이 장면마다 넘긴 셰이더 값을 그대로 받아,
// PC 앱의 셰이더(desktop/renderer/orb-stage.mjs의 ORB_SHADER)로 같은 값을 그린 뒤 두 그림을 화소마다 견준다.
// --speed를 주면 웅장한 판의 새 판 받기 장면을 그 창 크기로 이어 그려 한 장에 걸리는 시간을 잰다.
// --installer-cpu=<orb-render.exe>를 주면 Windows 설치기의 CPU 판(desktop/installer/tests/orb-render.cs)으로 같은 값을 그려 시안과 견준다.
//   설치기 GPU 판은 화면에 창을 띄워야 찍히므로 여기서 보지 않는다. 판을 낼 때 desktop/installer/tests/orb-preview.cs로 이 PC에서 본다.
//
// 쓰기(desktop 폴더에서):
//   node_modules\.bin\electron tools/orb-parity.cjs --scale=1.5 --w=1440 --h=940 --out=<폴더> [--speed] [--frames=240]
// 결과: <폴더>/parity.json, 장면마다 시안.png · pc.png
const { app, BrowserWindow, nativeImage } = require('electron');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const arg = (k, d) => { const a = process.argv.find(v => v.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const flag = k => process.argv.includes('--' + k);
const scale = Number(arg('scale', '1'));
const W = Number(arg('w', '1440')), H = Number(arg('h', '940'));
const out = path.resolve(arg('out', path.join(process.cwd(), '.orb-parity')));
const frames = Number(arg('frames', '240'));
const repo = path.resolve(__dirname, '..', '..');
const sian = path.join(repo, 'docs', '디자인', '플랫폼_클라이언트_검정구_20261116', '검정구.html');
const stageModule = path.join(repo, 'desktop', 'renderer', 'orb-stage.mjs');
app.commandLine.appendSwitch('force-device-scale-factor', String(scale));
app.commandLine.appendSwitch('high-dpi-support', '1');
const wait = ms => new Promise(r => setTimeout(r, ms));

// 시안의 확인용 손잡이(__orb.at)로 세우는 장면. 첫 장면은 장면이 바뀌기 전 화면으로 찍힐 수 있어 버린다(11-16 시험)
const SCENES = [
  { name: 'warmup', at: "__orb.at('forge',{p:.2,grand:true})", drop: true },
  { name: 'forge-grand-p00', at: "__orb.at('forge',{p:0,grand:true})" },
  { name: 'forge-grand-p40', at: "__orb.at('forge',{p:.4,grand:true})" },
  { name: 'forge-grand-p80', at: "__orb.at('forge',{p:.8,grand:true})" },
  { name: 'forge-grand-p100', at: "__orb.at('forge',{p:1,grand:true})" },
  { name: 'forge-grand-failed', at: "__orb.at('forge',{p:.4,grand:true,failed:true})" },
  { name: 'rest-eyes-calm', at: "__orb.at('rest',{mood:'calm'})" },
  { name: 'rest-eyes-smile', at: "__orb.at('rest',{mood:'smile'})" },
];

// 시안 창: 셰이더 값을 이름별로 적고, 원할 때 다음 프레임을 멈춘다
const RECORD = `(() => {
  const names = new WeakMap();
  const P = WebGLRenderingContext.prototype;
  const gul = P.getUniformLocation;
  P.getUniformLocation = function (prog, name) { const loc = gul.call(this, prog, name); if (loc) names.set(loc, name); return loc; };
  window.__uni = {};
  for (const fn of ['uniform1f', 'uniform2f', 'uniform3f', 'uniform4f']) {
    const orig = P[fn];
    P[fn] = function (loc, ...v) { const n = loc && names.get(loc); if (n) window.__uni[n] = v; return orig.call(this, loc, ...v); };
  }
  const raf = window.requestAnimationFrame.bind(window);
  const held = [];
  window.__freeze = false;
  window.requestAnimationFrame = cb => raf(t => { if (window.__freeze) { held.push(cb); return; } cb(t); });
  setInterval(() => { if (!window.__freeze && held.length) { const list = held.splice(0); for (const cb of list) raf(cb); } }, 50);
})();`;

// PC 창: PC 앱의 셰이더를 받은 값으로 그린다. 시안 캔버스와 같은 화소 크기로 둔다
const PC_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}canvas{position:fixed;inset:0;width:100vw;height:100vh;display:block}</style></head>
<body><canvas id="c"></canvas><script type="module">
import { ORB_SHADER } from ${JSON.stringify(pathToFileURL(stageModule).href)};
const c = document.getElementById('c');
const gl = c.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, ORB_SHADER.VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, ORB_SHADER.FS)); gl.linkProgram(pr);
if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
gl.useProgram(pr);
const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = Object.fromEntries(ORB_SHADER.UNIFORMS.map(k => [k, gl.getUniformLocation(pr, k)]));
const ZERO = { uVis: [0, 0, 0] };
function set(u) {
  const all = { ...ZERO, ...u };
  for (const k of ORB_SHADER.UNIFORMS) { const v = all[k]; if (!v || !U[k]) continue; gl['uniform' + v.length + 'f'](U[k], ...v); }
}
window.__draw = u => {
  const [w, h] = u.uRes; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } gl.viewport(0, 0, w, h);
  set(u); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); return [c.width, c.height];
};
// 속도: 받은 값에서 깎인 만큼만 바꿔 가며 이어 그린다. 한 장의 그리기 시간(gl.finish까지)과 장 사이 간격을 함께 잰다
window.__speed = (u, n) => new Promise(res => {
  const [w, h] = u.uRes; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } gl.viewport(0, 0, w, h);
  const draws = [], gaps = []; let last = 0, i = 0;
  function step(t) {
    if (last) gaps.push(t - last); last = t;
    const t0 = performance.now(); set({ ...u, uCut: [(i % 300) / 300], uSeed: [i % 64] }); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); draws.push(performance.now() - t0);
    if (++i < n) requestAnimationFrame(step); else res({ draws, gaps });
  }
  requestAnimationFrame(step);
});
window.__ready = true;
</script></body></html>`;

function stats(list) {
  const s = [...list].sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { n: s.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) };
}
function compare(a, b) {
  const A = a.toBitmap(), B = b.toBitmap(), sa = a.getSize(), sb = b.getSize();
  if (sa.width !== sb.width || sa.height !== sb.height) return { error: 'size ' + sa.width + 'x' + sa.height + ' vs ' + sb.width + 'x' + sb.height };
  const hist = new Uint32Array(256); let sum = 0, n = 0, max = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    hist[d]++; sum += d; n++; if (d > max) max = d;
  }
  let acc = 0, p999 = 0; for (let d = 0; d < 256; d++) { acc += hist[d]; if (acc >= n * 0.999) { p999 = d; break; } }
  return { mean: +(sum / n).toFixed(4), p999, max, over8: +(hist.slice(9).reduce((x, y) => x + y, 0) / n * 100).toFixed(4) + '%' };
}

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  const preload = path.join(out, '__record-preload.cjs');
  fs.writeFileSync(preload, RECORD);
  const opts = extra => ({ width: W, height: H, useContentSize: true, show: false, paintWhenInitiallyHidden: true, frame: false, backgroundColor: '#000000',
    webPreferences: { contextIsolation: false, sandbox: false, backgroundThrottling: false, ...extra } });
  const a = new BrowserWindow(opts({ preload }));
  const b = new BrowserWindow(opts({ webSecurity: false }));
  await a.loadURL(pathToFileURL(sian).href);
  const pcFile = path.join(out, '__pc.html'); fs.writeFileSync(pcFile, PC_PAGE);
  await b.loadURL(pathToFileURL(pcFile).href);
  await wait(3500);
  const ok = await b.webContents.executeJavaScript('window.__ready===true').catch(() => false);
  if (!ok) { console.error('PC 셰이더를 세우지 못했다'); app.exit(1); return; }
  const result = { scale, W, H, scenes: {}, speed: null };
  for (const s of SCENES) {
    const css = '#meta{display:none!important}#forge,#ask,#app,#switch,.layer{visibility:hidden!important}';
    await a.webContents.executeJavaScript(`(()=>{window.__freeze=false;let st=document.getElementById('__t');if(!st){st=document.createElement('style');st.id='__t';document.head.appendChild(st);}st.textContent=${JSON.stringify(css)};window.__uni={};${s.at};return 1;})()`);
    // 장면을 세운 뒤 시안이 쉬면 그리기를 멈춘다(장면 하나 건너 값을 받지 못했다). 값을 장면 앞에서 비우고, 마지막으로 그린 장의 값을 쓴다
    await wait(900);
    const uni = await a.webContents.executeJavaScript('window.__freeze=true;JSON.stringify(window.__uni)');
    await wait(200);
    const ia = await a.webContents.capturePage();
    const u = JSON.parse(uni);
    if (!u.uRes) { result.scenes[s.name] = { error: 'no uniforms' }; continue; }
    await b.webContents.executeJavaScript('window.__draw(' + uni + ')');
    await wait(200);
    const ib = await b.webContents.capturePage();
    if (s.drop) continue;
    fs.writeFileSync(path.join(out, s.name + '-시안.png'), ia.toPNG());
    fs.writeFileSync(path.join(out, s.name + '-pc.png'), ib.toPNG());
    // 설치기 판(GPU, CPU)을 같은 값으로 그릴 때 쓴다(--installer)
    fs.writeFileSync(path.join(out, s.name + '.uni.json'), uni);
    const installer = arg('installer-cpu', '');
    let installerCpu;
    if (installer) {
      const size = ia.getSize(), png = path.join(out, s.name + '-installer-cpu.png');
      const run = spawnSync(installer, [path.join(out, s.name + '.uni.json'), png, String(size.width), String(size.height)], { encoding: 'utf8', timeout: 120000 });
      installerCpu = run.status === 0 ? { ...compare(ia, nativeImage.createFromPath(png)), ...JSON.parse(run.stdout.trim()) } : { error: (run.stderr || String(run.error)).slice(0, 400) };
    }
    result.scenes[s.name] = { ...compare(ia, ib), uR: u.uR?.[0], uCut: u.uCut?.[0], uEye: u.uEye, ...(installerCpu ? { installerCpu } : {}) };
    console.log(s.name, JSON.stringify(result.scenes[s.name]));
  }
  if (flag('speed')) {
    await a.webContents.executeJavaScript(`window.__freeze=false;__orb.at('forge',{p:.5,grand:true});1`);
    await wait(900);
    await a.webContents.executeJavaScript('window.__uni={};1'); await wait(150);
    const uni = await a.webContents.executeJavaScript('window.__freeze=true;JSON.stringify(window.__uni)');
    b.show(); await wait(500);
    const r = await b.webContents.executeJavaScript('window.__speed(' + uni + ',' + frames + ')');
    const u = JSON.parse(uni);
    result.speed = { canvas: u.uRes, dpr: u.uDpr?.[0], draw: stats(r.draws), gap: stats(r.gaps.slice(10)) };
    console.log('speed', JSON.stringify(result.speed));
  }
  fs.writeFileSync(path.join(out, 'parity.json'), JSON.stringify(result, null, 2) + '\n');
  app.quit();
});
