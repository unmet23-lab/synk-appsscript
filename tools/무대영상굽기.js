#!/usr/bin/env node
'use strict';
/* 무대 층(bots/오버레이/무대.html)을 «되풀이 영상»으로 굽는다 (2026-09-08 · 0원).
 *
 * ■ 왜 있나
 *   무대 층의 살아 있는 것(가로등 깜빡임·창 반짝임·물비침 일렁임·숨)은 방송에 «그대로» 나가지 않는다.
 *   방송 배경은 곡 팩(.ts)에 영상으로 박혀 있고, 라디오무대만팩.sh 가 `docs/라디오/무대영상/<장르>.mp4` 를 반복해 깐다.
 *   전에는 그 영상이 Veo 가 구운 8초짜리였다. 이제는 이 도구가 무대 층을 헤드리스 크롬으로 한 장씩 찍어 만든다 —
 *   그래야 미리보기에서 유호님이 보신 «바로 그 움직임»이 방송에도 선다.
 *
 * ■ 어떻게
 *   ① 저장소 뿌리를 지면 서버로 연다(file:// 는 안 된다 · 겹쳐송출.js 와 같은 까닭).
 *   ② 크롬을 화면 없이 띄워 `무대.html?결=<결>&루프=<초>` 를 연다 — 루프 인자가 모든 박자를 루프의 약수로 맞춘다.
 *   ③ 그림이 다 뜨고 첫 무대의 밝기가 1 이 된 뒤, 페이지의 «모든 애니메이션»을 멈추고 시계를 손으로 민다:
 *      프레임 k 마다 currentTime = k × (1000/뜨기) 로 놓고 사진 한 장. 그래서 기계가 느려도 프레임이 안 빠진다(결정적).
 *   ④ 사진을 ffmpeg 에 그대로 흘려 넣어 mp4 로 굳힌다(h264 · yuv420p · 30fps).
 *   ⑤ 첫 장과 «루프 끝 다음 장»(= 첫 장이어야 한다)을 PSNR 로 견줘 이음매를 잰다 — 40dB 아래면 경고.
 *
 * ■ 쓰기
 *   node tools/무대영상굽기.js --결 전자네온물가 --낼 docs/라디오/무대영상/층_house.mp4 [--루프 60] [--뜨기 30] [--폭 1280 --높이 720]
 *   그 뒤: bash tools/라디오무대만팩.sh <오디오폴더> <낼폴더>  (층_<장르>.mp4 가 있으면 그것을 1:1 로 깐다)
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const 인자 = process.argv.slice(2);
const 값 = (k, d) => { const i = 인자.indexOf(k); return i >= 0 && 인자[i + 1] != null ? 인자[i + 1] : d; };
const 결 = 값('--결', '');
const 낼 = 값('--낼', '');
const 루프 = Number(값('--루프', '60'));
const 뜨기 = Number(값('--뜨기', '30'));
const 폭 = Number(값('--폭', '1280'));
const 높이 = Number(값('--높이', '720'));
const 지면포트 = Number(값('--지면포트', '8767'));
const 크롬포트 = Number(값('--크롬포트', '9224'));
const 크롬 = 값('--크롬', process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/chromium');
if (!결 || !낼) { console.error('쓰기: node tools/무대영상굽기.js --결 <결> --낼 <mp4> [--루프 60] [--뜨기 30]'); process.exit(2); }

const 뿌리 = path.resolve(__dirname, '..');
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
const 말 = (...x) => console.log('[무대영상굽기]', ...x);

/* ① 지면 서버 */
const 확장자 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
function 지면서버() {
  return new Promise((맞다) => {
    const s = http.createServer((req, res) => {
      const 길 = decodeURIComponent(req.url.split('?')[0]);
      const 자리 = path.join(뿌리, 길);
      if (!자리.startsWith(뿌리)) { res.writeHead(403); return res.end(); }
      fs.readFile(자리, (e, 몸) => {
        if (e) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': 확장자[path.extname(자리).toLowerCase()] || 'application/octet-stream' });
        res.end(몸);
      });
    });
    s.listen(지면포트, '127.0.0.1', () => 맞다(s));
  });
}

/* ② 크롬 + CDP(크롬 원격 조종 규약) — 겹쳐송출.js 의 붙기 그대로 */
async function 문찾기() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${크롬포트}/json/list`);
      const 쪽 = (await r.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (쪽) return 쪽.webSocketDebuggerUrl;
    } catch { /* 아직 */ }
    await 잠깐(500);
  }
  throw new Error('크롬 문이 30초 안에 안 열렸다');
}
async function 붙기(ws주소) {
  const ws = new WebSocket(ws주소);
  await new Promise((맞다, 아니다) => { ws.onopen = () => 맞다(); ws.onerror = () => 아니다(new Error('문 열기 실패')); });
  let 번호 = 0; const 기다림 = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && 기다림.has(m.id)) { const w = 기다림.get(m.id); 기다림.delete(m.id); m.error ? w.아니다(new Error(m.error.message)) : w.맞다(m.result); }
  };
  const 부르기 = (수단, 짐, 제한 = 20000) => new Promise((맞다, 아니다) => {
    const id = ++번호; 기다림.set(id, { 맞다, 아니다 });
    ws.send(JSON.stringify({ id, method: 수단, params: 짐 || {} }));
    setTimeout(() => { if (기다림.has(id)) { 기다림.delete(id); 아니다(new Error(`${수단} 이 ${제한 / 1000}초 안에 답이 없다`)); } }, 제한);
  });
  return { ws, 부르기 };
}
async function 셈(부르기, 식) {
  const r = await 부르기('Runtime.evaluate', { expression: 식, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('지면 안 오류: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
  return r.result.value;
}

/* ⑤ 이음매 자 — 두 PNG 를 ffmpeg psnr 로 견준다 */
function psnr(a, b) {
  const r = spawnSync('ffmpeg', ['-loglevel', 'info', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:([\d.]+|inf)/.exec(r.stderr || '');
  return m ? (m[1] === 'inf' ? Infinity : Number(m[1])) : NaN;
}

(async () => {
  const 서버 = await 지면서버();
  const 주소 = `http://127.0.0.1:${지면포트}/bots/오버레이/무대.html?결=${encodeURIComponent(결)}&루프=${루프}`;
  말(`결 ${결} · ${루프}초 × ${뜨기}fps = ${루프 * 뜨기}장 · ${폭}×${높이}`);
  const 프로필 = fs.mkdtempSync(path.join(os.tmpdir(), '무대굽기-'));
  const 크롬p = spawn(크롬, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    '--disable-extensions', `--user-data-dir=${프로필}`, `--remote-debugging-port=${크롬포트}`, '--remote-allow-origins=*',
    `--window-size=${폭},${높이}`, 주소], { stdio: ['ignore', 'ignore', 'pipe'] });
  크롬p.stderr.on('data', (d) => { const s = String(d).trim(); if (/error|fail/i.test(s) && !/DevTools|GPU|dbus/i.test(s)) 말('크롬:', s.slice(0, 160)); });
  const 끝내기 = () => { try { 크롬p.kill(); } catch { /* 이미 */ } try { 서버.close(); } catch { /* 이미 */ } try { fs.rmSync(프로필, { recursive: true, force: true }); } catch { /* 잠긴 것 */ } };
  process.on('exit', 끝내기);

  const { ws, 부르기 } = await 붙기(await 문찾기());
  await 부르기('Page.enable');
  await 부르기('Emulation.setDeviceMetricsOverride', { width: 폭, height: 높이, deviceScaleFactor: 1, mobile: false });
  /* ③ 그림·첫 무대를 기다린다 — 시간이 아니라 «신호»로(wait-for-signal-not-time) */
  for (let i = 0; i < 100; i++) {
    const 준비 = await 셈(부르기, `(() => {
      const 선 = document.querySelector('.장.선다'); if (!선) return false;
      if (parseFloat(선.style.opacity) < 1) return false;
      const 그림 = [...선.querySelectorAll('img')].filter((im) => im.getAttribute('src'));
      return 그림.length > 0 && 그림.every((im) => im.complete && im.naturalWidth > 0);
    })()`);
    if (준비) break;
    if (i === 99) throw new Error('무대가 20초 안에 안 섰다(그림이 없거나 결 이름이 틀렸다)');
    await 잠깐(200);
  }
  await 잠깐(300);                                   // 마지막 프레임의 서서히() 시계가 끝나게
  const 몇 = await 셈(부르기, `(() => { const A = document.getAnimations(); A.forEach((a) => a.pause()); return A.length; })()`);
  const 박자표 = await 셈(부르기, `getComputedStyle(document.documentElement).getPropertyValue('--숨주기') + ' / 등 ' + [...document.querySelectorAll('.빛들 i.등')].map((e) => e.style.getPropertyValue('--주기')).join(',')`);
  말(`애니메이션 ${몇}개를 멈추고 시계를 손으로 민다 · 숨 ${박자표}`);

  /* ④ ffmpeg 에 흘려 넣기 */
  fs.mkdirSync(path.dirname(path.resolve(뿌리, 낼)), { recursive: true });
  const 낼길 = path.resolve(뿌리, 낼);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(뜨기), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-g', String(뜨기 * 2), '-movflags', '+faststart', 낼길],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const 쓰기 = (buf) => new Promise((r) => { if (ff.stdin.write(buf)) r(); else ff.stdin.once('drain', r); });
  const 장수 = Math.round(루프 * 뜨기);
  const 첫장 = path.join(프로필, '첫.png');
  const 끝장 = path.join(프로필, '끝.png');
  const t0 = Date.now();
  for (let k = 0; k <= 장수; k++) {                  // 장수+1 번째(= 루프 끝) 는 영상에 안 넣고 이음매 자로만 쓴다
    const T = (k * 1000) / 뜨기;
    await 셈(부르기, `(() => { for (const a of document.getAnimations()) a.currentTime = ${T}; return true; })()`);
    const { data } = await 부르기('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const buf = Buffer.from(data, 'base64');
    if (k === 0) fs.writeFileSync(첫장, buf);
    if (k === 장수) { fs.writeFileSync(끝장, buf); break; }
    await 쓰기(buf);
    if (k % (뜨기 * 5) === 0 && k) { const 초 = (Date.now() - t0) / 1000; 말(`${k}/${장수}장 · ${초.toFixed(0)}초 · 남은 약 ${((장수 - k) * 초 / k).toFixed(0)}초`); }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  ws.close();
  const 이음 = psnr(첫장, 끝장);
  const 크기 = fs.statSync(낼길).size;
  const 길이 = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 낼길], { encoding: 'utf8' }).stdout.trim();
  말(`✅ ${낼} · ${(크기 / 1048576).toFixed(1)}MB · ${길이}초 · 이음매 PSNR ${isFinite(이음) ? 이음.toFixed(2) + 'dB' : '∞'}${이음 < 40 ? ' ⚠ 40dB 아래 — 어느 박자가 루프를 안 나눈다' : ''}`);
  끝내기();
  process.exit(0);
})().catch((e) => { console.error('🔴', e.message); process.exit(1); });
