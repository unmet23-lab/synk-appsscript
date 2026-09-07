#!/usr/bin/env node
/**
 * 어느 결(곡 장르)의 방송 화면이 «어떻게 나오는지» 한 장으로 만든다 (2026-09-08 · 0원).
 *
 * ■ 왜 있나
 *   지금 방송에 나가는 화면은 서버에서 그대로 뜰 수 있다(스크래치패드 `지금화면.js`).
 *   그런데 **아직 안 나온 결**(예: 재생목록에서 한 시간 뒤에 오는 전자 곡)은 그렇게 못 본다.
 *   방송을 흔들어 결을 억지로 바꾸면 화면에 «틀린 무대 + 맞는 인형»이 잠깐 나가 버린다 — 그건 안 한다.
 *   그래서 **방송이 쓰는 것과 같은 재료·같은 셈**으로 그 결의 한 장을 만든다.
 *
 * ■ 같은 재료·같은 셈이라는 뜻
 *   ① 무대 = 그 결의 «실제 곡 팩»에서 뽑은 한 장(또는 `--무대` 로 준 그림)
 *   ② 층   = 방송이 여는 것과 «같은 지면·같은 인자»를 화면 없는 크롬으로 열어 찍는다
 *            (1920×1080 을 배율 2/3 로 = 1280×720 · 투명 바탕 — 겹쳐송출.js 와 같은 값)
 *   ③ 겹치기 = `overlay=0:0` (겹쳐송출.js 의 filter_complex 와 같은 셈)
 *
 * ■ 쓰기
 *   node tools/라디오화면미리.js --결 전자네온물가 --무대 <무대한장.png> --낼 화면.png
 *   node tools/라디오화면미리.js --결 전자네온물가 --낼 화면.png        (무대 없이 층만 · 바탕은 투명)
 */
'use strict';
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const 인자 = process.argv.slice(2);
const 값 = (k, d) => { const i = 인자.indexOf(k); return i >= 0 && 인자[i + 1] != null ? 인자[i + 1] : d; };
const 결 = 값('--결', '');
const 무대 = 값('--무대', '');
const 낼 = 값('--낼', '');
/* 방송이 주는 값 그대로가 기본값이다 — 여기서 다르게 주면 «미리»가 아니라 딴 그림이 된다(겹쳐송출.js 기본값과 같게 둔다) */
const 크기 = 값('--크기', '0.32');
const 자리 = 값('--자리', '중하');
const 바닥 = 값('--바닥', '2.5');
const 부스 = 값('--부스', '1');
const 층목록 = 값('--층', '마스코트,전광판');
const 폭 = Number(값('--폭', '1920'));
const 높이 = Number(값('--높이', '1080'));
const 배율 = Number(값('--배율', String(2 / 3)));
const 지면포트 = Number(값('--지면포트', '8771'));
const 크롬포트 = Number(값('--크롬포트', '9228'));
const 크롬 = 값('--크롬', process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/chromium');
if (!결 || !낼) { console.error('쓰기: node tools/라디오화면미리.js --결 <결> --낼 <png> [--무대 <png>]'); process.exit(2); }

const 뿌리 = path.resolve(__dirname, '..');
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
const 말 = (...x) => console.log('[라디오화면미리]', ...x);
const 확장자 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function 지면서버() {
  return new Promise((맞다) => {
    const s = http.createServer((req, res) => {
      const 자리길 = path.join(뿌리, decodeURIComponent(req.url.split('?')[0]));
      if (!자리길.startsWith(뿌리)) { res.writeHead(403); return res.end(); }
      fs.readFile(자리길, (e, 몸) => {
        if (e) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': 확장자[path.extname(자리길).toLowerCase()] || 'application/octet-stream' });
        res.end(몸);
      });
    });
    s.listen(지면포트, '127.0.0.1', () => 맞다(s));
  });
}
async function 문찾기() {
  for (let i = 0; i < 60; i++) {
    try {
      const 쪽 = (await (await fetch(`http://127.0.0.1:${크롬포트}/json/list`)).json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (쪽) return 쪽.webSocketDebuggerUrl;
    } catch { /* 아직 */ }
    await 잠깐(500);
  }
  throw new Error('크롬 문이 30초 안에 안 열렸다');
}

(async () => {
  const 서버 = await 지면서버();
  /* 🔴 09-08 — 화면 없는 크롬에서는 층의 프레임 루프가 «찍을 때만» 한 칸씩 돌아, 컷이 깜빡임(눈감음)에
     붙박이는 일이 잦다(마흔 번 찍어도 안 풀렸다). 방송 쪽은 초당 여섯 번을 내리 찍으니 안 그렇다.
     그래서 «보여 주는 한 장»에는 층이 이미 갖고 있는 손잡이 `?고정=<컷>` 을 쓴다 — 그 컷을 계속 들게 하는 자리다.
     기본값 `기본` = 눈 뜨고 서 있는 얼굴(화면에 가장 오래 서 있는 그 얼굴). `--고정 없음` 이면 안 건다. */
  const 고정 = 값('--고정', '기본');
  const 주소 = `http://127.0.0.1:${지면포트}/bots/오버레이/방송층.html`
    + `?층=${encodeURIComponent(층목록)}&크기=${크기}&자리=${encodeURIComponent(자리)}&바닥=${바닥}&부스=${부스}`
    + (고정 && 고정 !== '없음' ? `&고정=${encodeURIComponent(고정)}` : '');
  const 프로필 = fs.mkdtempSync(path.join(os.tmpdir(), '화면미리-'));
  const 크롬p = spawn(크롬, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    '--disable-extensions', `--user-data-dir=${프로필}`, `--remote-debugging-port=${크롬포트}`, '--remote-allow-origins=*',
    `--window-size=${폭},${높이}`, 주소], { stdio: ['ignore', 'ignore', 'pipe'] });
  크롬p.stderr.on('data', () => { /* 크롬 잡소리는 안 옮긴다 */ });
  const 끝내기 = () => { try { 크롬p.kill(); } catch { /* 이미 */ } try { 서버.close(); } catch { /* 이미 */ } try { fs.rmSync(프로필, { recursive: true, force: true }); } catch { /* 잠긴 것 */ } };
  process.on('exit', 끝내기);

  const ws = new WebSocket(await 문찾기());
  await new Promise((맞다, 아니다) => { ws.onopen = () => 맞다(); ws.onerror = () => 아니다(new Error('문 열기 실패')); });
  let 번호 = 0; const 기다림 = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && 기다림.has(m.id)) { const w = 기다림.get(m.id); 기다림.delete(m.id); m.error ? w.아니다(new Error(m.error.message)) : w.맞다(m.result); } };
  const 부르기 = (수단, 짐) => new Promise((맞다, 아니다) => { const id = ++번호; 기다림.set(id, { 맞다, 아니다 }); ws.send(JSON.stringify({ id, method: 수단, params: 짐 || {} })); setTimeout(() => { if (기다림.has(id)) { 기다림.delete(id); 아니다(new Error(`${수단} 이 20초 안에 답이 없다`)); } }, 20000); });
  const 셈 = async (식) => {
    const r = await 부르기('Runtime.evaluate', { expression: 식, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('지면 안 오류: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  await 부르기('Page.enable');
  /* 겹쳐송출.js 와 «같은 값» — 이게 다르면 인형 크기·자리가 방송과 달라진다 */
  await 부르기('Emulation.setDeviceMetricsOverride', { width: 폭, height: 높이, deviceScaleFactor: 배율, mobile: false });
  await 부르기('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

  /* 결을 알린다 — 봇이 던지는 것과 «같은 문»(BroadcastChannel)으로 */
  for (let i = 0; i < 60; i++) {
    const 떴나 = await 셈(`document.querySelectorAll('iframe').length >= ${층목록.split(',').length}`);
    if (떴나) break;
    await 잠깐(200);
  }
  await 잠깐(1200);                                   // 층이 컷을 다 읽을 틈
  await 셈(`(() => { const 문 = new BroadcastChannel('라디오오버레이'); 문.postMessage({ 종류: '결', 결: ${JSON.stringify(결)} }); setTimeout(() => 문.close(), 1000); return true; })()`);
  await 잠깐(4000);                                   // 갈아입고 들어오는 연출이 끝날 때까지
  /* 🔴 09-08 — 화면 없는 크롬에서는 그림 시계(requestAnimationFrame)가 «찍을 때만» 돈다.
     그래서 층의 프레임 루프가 거의 안 돌아 컷이 깜빡임에 붙박이기 쉽다(세 번 다 눈감음이 나왔다).
     처음 찍는 한 장이 시계를 깨우므로, **몇 번 찍어 시계를 돌린 뒤** 원하는 컷이 들렸을 때 쓴다.
     `--컷` 을 주면 그 컷을 기다리고, 안 주면 「기본」(눈 뜬 얼굴)을 기다린다. 못 기다리면 그냥 마지막 것을 쓴다. */
  const 바라는컷 = 값('--컷', 고정 === '기본' ? '본체' : '');
  for (let i = 0; 바라는컷 && i < 40; i++) {
    await 부르기('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });   // 시계 한 칸
    const 지금컷 = await 셈(`(() => {
      const 마 = [...document.querySelectorAll('iframe')].map((f) => { try { return f.contentDocument; } catch (e) { return null; } }).find((d) => d && d.getElementById('부스'));
      if (!마) return '';
      const im = [...마.querySelectorAll('#마스코트틀 img')].find((x) => !x.hidden && !x.classList.contains('옷'));
      return im ? (im.getAttribute('src') || '') : '';
    })()`);
    if (지금컷.includes(바라는컷)) break;
    await 잠깐(120);
  }
  const 선것 = await 셈(`(() => {
    const 마 = [...document.querySelectorAll('iframe')].map((f) => { try { return f.contentDocument; } catch (e) { return null; } }).find((d) => d && d.getElementById('부스'));
    if (!마) return { 층: '못 찾음' };
    return { 부스섰나: !마.getElementById('부스').hidden,
      컷: [...마.querySelectorAll('#마스코트틀 img')].filter((i) => !i.hidden).map((i) => (i.getAttribute('src') || '').split('/').pop()),
      경고: [...마.querySelectorAll('.경고')].map((e) => e.textContent) };
  })()`);
  말('층 상태:', JSON.stringify(선것));
  const { data } = await 부르기('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const 층파일 = path.join(프로필, '층.png');
  fs.writeFileSync(층파일, Buffer.from(data, 'base64'));
  ws.close();

  const 낼길 = path.resolve(뿌리, 낼);
  fs.mkdirSync(path.dirname(낼길), { recursive: true });
  if (무대) {
    const 무대길 = path.resolve(뿌리, 무대);
    const 크기줄 = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', 무대길], { encoding: 'utf8' }).stdout.trim().replace(',', ':');
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 무대길, '-i', 층파일,
      '-filter_complex', `[1:v]scale=${크기줄}:flags=lanczos,format=rgba[층];[0:v][층]overlay=0:0`, '-frames:v', '1', 낼길], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('겹치기 실패: ' + (r.stderr || '').slice(0, 200));
  } else {
    fs.copyFileSync(층파일, 낼길);
  }
  말(`✅ ${낼} (결 ${결}${무대 ? ' · 무대 ' + 무대 : ' · 층만'})`);
  끝내기();
  process.exit(0);
})().catch((e) => { console.error('🔴', e.message); process.exit(1); });
