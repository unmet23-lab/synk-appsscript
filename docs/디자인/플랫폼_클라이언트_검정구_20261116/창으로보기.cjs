'use strict';
/*
 * 검정 구 시안을 제목 줄 없는 실제 창으로 띄운다. PC 앱(desktop)에 깔린 Electron을 빌려 쓴다.
 *
 * 쓰기(저장소 뿌리에서):
 *   desktop\node_modules\.bin\electron docs/디자인/플랫폼_클라이언트_검정구_20261116/창으로보기.cjs
 * 확인만 할 때는 끝에 --찍기 <그림 파일> [장면]을 붙인다. 창을 보이지 않고 한 장 찍은 뒤 끝낸다.
 *   장면은 rest · ask · app · switch 가운데 하나이고, 안 적으면 rest다.
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const at = process.argv.indexOf('--찍기');
const shot = at > -1 ? process.argv[at + 1] : null;
const scene = at > -1 && process.argv[at + 2] ? process.argv[at + 2] : 'rest';

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 780,
    minHeight: 520,
    show: false,
    title: 'SYNK',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    // 제목 줄을 없애고 창 단추(최소화 · 최대화 · 닫기)만 검정 위에 얹는다.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#000000', symbolColor: '#8f8c86', height: 40 },
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await win.loadFile(path.join(__dirname, '검정구.html'));

  if (!shot) {
    win.show();
    return;
  }
  try {
    const state = await win.webContents.executeJavaScript(
      `new Promise(r => setTimeout(() => { const s = window.__orb.at(${JSON.stringify(scene)}, {}); setTimeout(() => { window.__orb.draw(); r(JSON.stringify({ ...s, gl: !!document.getElementById('orb').getContext('webgl'), fonts: [...document.fonts].filter(f => f.status === 'loaded').length })); }, 400); }, 900))`
    );
    // 숨은 창의 첫 캡처는 앞 화면을 돌려줄 수 있어 한 번 찍어 버리고 다시 찍는다(현장 노트 · 시험 · 화면 확인).
    await win.webContents.capturePage(undefined, { stayHidden: true });
    await new Promise(resolve => setTimeout(resolve, 160));
    await win.webContents.executeJavaScript('window.__orb.draw()');
    const image = await win.webContents.capturePage(undefined, { stayHidden: true });
    fs.mkdirSync(path.dirname(path.resolve(shot)), { recursive: true });
    fs.writeFileSync(shot, image.toPNG());
    const size = image.getSize();
    console.log('찍었다: ' + shot + ' (' + size.width + '×' + size.height + ') ' + state);
  } catch (error) {
    console.error('찍지 못했다: ' + (error && error.message));
    process.exitCode = 1;
  }
  app.quit();
});

app.on('window-all-closed', () => app.quit());
