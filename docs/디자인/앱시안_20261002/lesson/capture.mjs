// 휴대폰 크기(390 폭, 2배)로 정확히 찍는다. 크롬 창 최소 폭 문제를 피하려고 기기 흉내(CDP)를 쓴다.
// 쓰는 법: node capture.mjs <주소> <저장.png> [높이]  높이를 주면 화면 자체를 그 높이로 흉내 낸다(앱의 스크롤 상자가 다 펼쳐지게)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const [url, outFile, hArg] = process.argv.slice(2);
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
const p = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
const portFile = path.join(dir, 'DevToolsActivePort');
for (let i = 0; i < 200 && !fs.existsSync(portFile); i++) await new Promise((r) => setTimeout(r, 50));
const [port] = fs.readFileSync(portFile, 'utf8').split('\n');
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const wait = new Map(); const ev = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d.result); wait.delete(d.id); } else if (d.method) ev.push(d.method); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: Number(hArg) || 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url });
for (let i = 0; i < 100 && !ev.includes('Page.loadEventFired'); i++) await new Promise((r) => setTimeout(r, 100));
await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,800)))', awaitPromise: true });
if (process.env.EVAL) console.log(JSON.stringify((await send('Runtime.evaluate', { expression: process.env.EVAL, returnByValue: true })).result.value));
const h = Number(hArg) || (await send('Runtime.evaluate', { expression: 'Math.max(document.documentElement.scrollHeight, 844)', returnByValue: true })).result.value;
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height: h, scale: 1 } });
fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
ws.close(); p.kill(); console.log('saved', outFile, h);
