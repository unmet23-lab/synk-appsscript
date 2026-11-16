'use strict';
// 1-가 시험: 검정 구 시안의 새 판 받기 장면을 찍고, 그 그림을 그린 순간의 셰이더 값(uniform)을 함께 적는다.
// 쓰기(저장소 뿌리에서): desktop\node_modules\.bin\electron docs/디자인/플랫폼_클라이언트_검정구_20261116/1-가_시험/capture.cjs --scale=1 --out=<폴더>
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const arg = (k, d) => { const a = process.argv.find(v => v.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const scale = Number(arg('scale', '1'));
const out = path.resolve(arg('out', path.join(__dirname, 'shots')));
const W = Number(arg('w', '1440')), H = Number(arg('h', '900'));
app.commandLine.appendSwitch('force-device-scale-factor', String(scale));
app.commandLine.appendSwitch('high-dpi-support', '1');
const page = path.resolve(__dirname, '..', '검정구.html');
const wait = ms => new Promise(r => setTimeout(r, ms));
const scenes = [
  // 첫 장면은 장면이 바뀌기 전 화면으로 찍혀 버린다(11-16 시험). 버리는 장면을 하나 앞에 둔다
  { name: 'warmup', at: "__orb.at('forge',{p:.2})" },
  { name: 'forge-p40', at: "__orb.at('forge',{p:.4})" },
  { name: 'forge-p40-text', at: "__orb.at('forge',{p:.4})", text: true },
  { name: 'forge-ready', at: "__orb.at('forge',{ready:true})" },
  { name: 'forge-ready-text', at: "__orb.at('forge',{ready:true})", text: true },
  { name: 'forge-grand-p40', at: "__orb.at('forge',{p:.4,grand:true})" },
  { name: 'forge-grand-p40-text', at: "__orb.at('forge',{p:.4,grand:true})", text: true },
  { name: 'forge-p100', at: "__orb.at('forge',{p:1})" },
];
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, paintWhenInitiallyHidden: true, frame: false, backgroundColor: '#000000',
    webPreferences: { preload: path.join(__dirname, 'capture-preload.cjs'), contextIsolation: false, sandbox: false, backgroundThrottling: false } });
  await win.loadURL(pathToFileURL(page).href);
  await wait(3500);
  for (const s of scenes) {
    const css = '#meta{display:none!important}' + (s.text ? '' : '#forge,#ask,#app,#switch,.layer{visibility:hidden!important}');
    const uni = await win.webContents.executeJavaScript(`(()=>{window.__freeze=false;let st=document.getElementById('__t');if(!st){st=document.createElement('style');st.id='__t';document.head.appendChild(st);}st.textContent=${JSON.stringify(css)};window.__uni={};${s.at};window.__freeze=true;return JSON.stringify(window.__uni);})()`);
    await wait(s.text ? 1600 : 500);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(out, s.name + '.png'), img.toPNG());
    const u = JSON.parse(uni);
    fs.writeFileSync(path.join(out, s.name + '.uni.txt'), Object.entries(u).map(([k, v]) => k + '=' + v.join(',')).join('\n') + '\n');
    const sz = img.getSize();
    console.log(s.name, sz.width + 'x' + sz.height, 'uR=' + (u.uR || []).join(','), 'uCut=' + (u.uCut || []).join(','));
  }
  app.quit();
});
