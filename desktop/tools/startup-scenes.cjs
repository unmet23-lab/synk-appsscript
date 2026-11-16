'use strict';
// 시작 창 장면 찍기(1-가 구현 설계 9절 「캡처 계획」). 진짜 시작 창 모듈(src/platform-startup-window.cjs)에 가짜 관문을 물려
// 확인 중, 받는 중, 바꾸는 중, 실패를 차례로 지나가며 창을 찍는다. 앱 계정이나 네트워크는 쓰지 않는다.
// 쓰기(desktop 폴더에서): node_modules\.bin\electron tools/startup-scenes.cjs --scale=1.5 --out=<폴더> [--w=1440 --h=940] [--start=error:UPDATE_RECOVERED]
const { app, BrowserWindow, session, ipcMain, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createStartupUpdateWindow } = require('../src/platform-startup-window.cjs');

const arg = (k, d) => { const a = process.argv.find(v => v.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const scale = Number(arg('scale', '1'));
const out = path.resolve(arg('out', path.join(process.cwd(), '.startup-scenes')));
const W = Number(arg('w', '1440')), H = Number(arg('h', '940'));
const start = arg('start', '');
protocol.registerSchemesAsPrivileged([{ scheme: 'synk-desktop', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.commandLine.appendSwitch('force-device-scale-factor', String(scale));
app.commandLine.appendSwitch('high-dpi-support', '1');
const wait = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  let value = { state: 'checking', code: null, stage: 'check', platform: 'win32', progress: 0, currentVersion: '0.4.95', latestVersion: '0.4.96', canRetry: false, canOpenCurrent: false, canInstall: false };
  if (start.startsWith('error:')) value = { ...value, state: 'error', code: start.slice(6), stage: 'handoff', canRetry: true, canOpenCurrent: true };
  const opened = [];
  const gate = { isBlocking: () => true, snapshot: () => value, retry: () => value, openCurrent: () => { opened.push(Date.now()); return value; }, install: () => value, cancelInstall: () => value };
  const boot = { startedAt: Date.now(), kind: arg('kind', 'back') };
  const sw = createStartupUpdateWindow({ BrowserWindow, session, ipcMain, appRoot: path.resolve(__dirname, '..'), gate, placement: () => ({ x: 40, y: 40, width: W, height: H, minWidth: 960, minHeight: 680, maximized: false }), boot: () => boot, onClose: () => {} });
  sw.show();
  for (const w of BrowserWindow.getAllWindows()) w.webContents.on('console-message', (_e, level, message, line, source) => { if (level >= 2) console.log('[page]', message, source + ':' + line); });
  const win = () => BrowserWindow.getAllWindows()[0];
  const set = next => { value = { ...value, ...next }; sw.publish(value); };
  const shot = async name => { const img = await win().webContents.capturePage(); fs.writeFileSync(path.join(out, name + '.png'), img.toPNG()); const state = await win().webContents.executeJavaScript("(()=>{const r=document.getElementById('startup-update');const c=document.getElementById('startup-orb');return {state:r.dataset.state,ui:r.dataset.ui,say:document.getElementById('startup-title').textContent,ver:document.getElementById('startup-version-line').textContent,mode:c?.dataset.orbMode,acts:[...document.querySelectorAll('#startup-actions button')].filter(b=>!b.hidden).map(b=>b.textContent)};})()"); console.log(name, JSON.stringify(state)); };
  await wait(400);
  if (start) { await wait(3000); await shot('start-' + start.replace(/[^A-Za-z_]/g, '_')); await wait(Number(arg('watch', '9000'))); console.log('opened', opened.length); app.quit(); return; }
  await wait(2600); await shot('1-checking');
  set({ state: 'downloading', stage: 'download', progress: 0 }); await wait(1200); await shot('2-forge-entering');
  set({ progress: 40 }); await wait(2600); await shot('3-downloading-20pct');
  set({ progress: 100 }); await wait(2500); set({ state: 'installing', stage: 'handoff' }); await wait(1800); await shot('4-installing');
  set({ state: 'error', code: 'UPDATE_HANDOFF_TIMEOUT', canRetry: true, canOpenCurrent: true }); await wait(2200); await shot('5-failed-handoff');
  await wait(7000); console.log('auto-open fired', opened.length);
  app.quit();
});
