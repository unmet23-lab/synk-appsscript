#!/usr/bin/env node
'use strict';
/**
 * 겹쳐송출 — 곡 팩 위에 «살아 있는 층»을 실시간으로 얹어 유튜브로 민다.
 * (유호 지시 2026-09-06 「프레임이 좀 낮아도 좋으니까 이런식으로 라이브로 하고싶어」)
 *
 * ■ 무엇이 달라지나
 *   여태 송출은 `-c copy` 였다. 그림이 곡에 «박혀» 있어서 계산이 0 이었고, 그래서 방송 중에는
 *   아무것도 못 바꿨다. 이 파일은 그 대신 매 순간 화면을 새로 만든다. 그래서 채팅에 누가 말을 걸면
 *   그 자리에서 「○○님, 안녕하세요」가 뜬다. 값은 계산 장치다 — 서버를 e2-medium 으로 키운 까닭이
 *   여기다(09-06 · 돈장부 참조).
 *
 * ■ 층은 어떻게 그리나
 *   화면 없는 크로미움(headless)이 `방송층.html` 을 열고, 이 파일이 그 그림을 초당 몇 장 떠서
 *   ffmpeg 에 넘긴다. 층 지면은 OBS 용으로 이미 서 있던 것 그대로다 — 새로 그리지 않았다.
 *   🔑 그림을 «뜨는 횟수»(--뜨기)와 «방송 프레임»(--프레임)은 따로다. 층은 거의 안 움직이니
 *      적게 떠도 되고, 그만큼 계산이 준다.
 *
 * ■ 사건은 어떻게 들어오나
 *   POST http://127.0.0.1:<사건포트>/사건  {"종류":"인사","닉네임":"바트자야"}
 *   받은 것을 그대로 `BroadcastChannel('라디오오버레이')` 에 던진다. 봇이 하던 방식과 같아서
 *   층 지면은 고칠 것이 없다. 🔴 닉네임 말고 사람을 가리키는 칸(실명·학생코드)은 층의 판정기가
 *   사건 전체를 버린다 — 그 철칙은 여기서 우회하지 않는다.
 *
 * ■ 쓰기
 *   node 겹쳐송출.js                      팩을 읽어 유튜브로 (열쇠는 --열쇠 파일에서)
 *   node 겹쳐송출.js --시늉 /tmp/맛보기.mp4  유튜브로 안 보내고 파일로 20초만 뽑는다(시험)
 *   node 겹쳐송출.js --층 마스코트,전광판   마스코트를 팩에서 떼어낸 뒤에 쓸 차림
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const 인자 = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = 인자.indexOf(이름); return i > -1 && 인자[i + 1] ? 인자[i + 1] : 기본; };
const 있나 = (이름) => 인자.includes(이름);

const 지면뿌리 = 값('--지면뿌리', path.resolve(__dirname, '..', '..'));
const 팩폴더 = 값('--팩', '/opt/synk-radio/팩');
const 층 = 값('--층', '전광판');
const 프레임 = Number(값('--프레임', '20'));
const 뜨기 = Number(값('--뜨기', '10'));
const 지면포트 = Number(값('--지면포트', '8765'));
const 사건포트 = Number(값('--사건포트', '8790'));
const 크롬포트 = Number(값('--크롬포트', '9222'));
const 열쇠파일 = 값('--열쇠', '/opt/synk-radio/송출/.env');
const 크롬 = 값('--크롬', '/usr/bin/chromium');
const 시늉파일 = 있나('--시늉') ? 값('--시늉', '/tmp/겹쳐맛보기.mp4') : null;
const 시늉초 = Number(값('--시늉초', '20'));

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
const 때 = () => new Date().toISOString().slice(11, 19);
const 말 = (...x) => console.log(`[겹쳐송출 ${때()}]`, ...x);

/* ── ① 지면 서버 — 층 지면과 그림을 크로미움에 먹인다 ───────────────────────────
   file:// 로 열면 프레임 사이에서 BroadcastChannel 이 안 통한다(미리보기 지면의 실측 주석).
   그래서 반드시 http 로 연다. 127.0.0.1 에만 묶어 바깥으로는 안 연다. */
const 확장자 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function 지면서버세우기() {
  return new Promise((맞다) => {
    http.createServer((req, res) => {
      const 길 = decodeURIComponent(req.url.split('?')[0]);
      const 자리 = path.join(지면뿌리, 길);
      /* 뿌리 밖으로 못 나가게 — 지면이 서버의 다른 파일을 읽는 길을 내지 않는다 */
      if (!자리.startsWith(지면뿌리)) { res.writeHead(403); return res.end('밖'); }
      fs.readFile(자리, (e, 몸) => {
        if (e) { res.writeHead(404); return res.end('없다'); }
        res.writeHead(200, { 'content-type': 확장자[path.extname(자리).toLowerCase()] || 'application/octet-stream' });
        res.end(몸);
      });
    }).listen(지면포트, '127.0.0.1', () => { 말(`지면 서버 ${지면포트} · 뿌리 ${지면뿌리}`); 맞다(); });
  });
}

/* ── ② 크로미움 — 화면 없이 층 지면을 그린다 ─────────────────────────────────── */
function 크롬띄우기(주소) {
  const 옵션 = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--disable-dev-shm-usage', '--disable-extensions', '--no-first-run',
    /* 🔴 09-06 실측 — 여기에 `--default-background-color=00000000` 을 «시작 옵션으로» 주면
       브라우저가 통째로 굳는다. 붙자마자 Page.enable 조차 답이 없다(8초 시한 전부 초과).
       투명 바탕은 아래에서 `Emulation.setDefaultBackgroundColorOverride` 로 «붙은 뒤에» 건다 —
       그건 90ms 만에 답이 온다(같은 날 같은 기계에서 나란히 재봤다). */
    `--remote-debugging-port=${크롬포트}`, '--remote-allow-origins=*',
    '--window-size=1920,1080', 주소];
  const p = spawn(크롬, 옵션, { stdio: ['ignore', 'ignore', 'pipe'] });
  p.stderr.on('data', (d) => { const s = String(d).trim(); if (/error|fail/i.test(s)) 말('크로미움:', s.slice(0, 200)); });
  return p;
}

async function 문찾기() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${크롬포트}/json/list`);
      const 목록 = await r.json();
      const 쪽 = 목록.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (쪽) return 쪽.webSocketDebuggerUrl;
    } catch { /* 아직 안 열렸다 */ }
    await 잠깐(500);
  }
  throw new Error('크로미움 문이 30초 안에 안 열렸다');
}

async function 붙기(ws주소) {
  const ws = new WebSocket(ws주소);
  await new Promise((맞다, 아니다) => { ws.onopen = () => 맞다(); ws.onerror = (e) => 아니다(new Error('문 열기 실패')); });
  let 번호 = 0; const 기다리는것 = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && 기다리는것.has(m.id)) {
      const { 맞다, 아니다 } = 기다리는것.get(m.id); 기다리는것.delete(m.id);
      m.error ? 아니다(new Error(m.error.message)) : 맞다(m.result);
    }
  };
  /* 🔴 09-06 실측 — 제한을 안 걸면 «답이 영영 안 오는» 한 번이 그리기를 통째로 멈춘다.
     그날 첫 판이 그렇게 죽었다(60초 동안 0장 · 건너뛴 것 597). 그래서 부르기마다 시한을 둔다. */
  const 부르기 = (수단, 짐, 제한 = 10000) => new Promise((맞다, 아니다) => {
    const id = ++번호; 기다리는것.set(id, { 맞다, 아니다 });
    ws.send(JSON.stringify({ id, method: 수단, params: 짐 || {} }));
    setTimeout(() => { if (기다리는것.has(id)) { 기다리는것.delete(id); 아니다(new Error(`${수단} 이 ${제한 / 1000}초 안에 답이 없다`)); } }, 제한);
  });
  ws.onclose = () => { for (const [id, w] of 기다리는것) { 기다리는것.delete(id); w.아니다(new Error('문이 닫혔다')); } };
  return { ws, 부르기 };
}

/* ── ③ ffmpeg — 팩과 층을 겹쳐 인코딩해 내보낸다 ──────────────────────────────── */
function 열쇠읽기() {
  const 글 = fs.readFileSync(열쇠파일, 'utf8');
  const m = 글.match(/^\s*YOUTUBE_STREAM_KEY\s*=\s*(.+)$/m);
  if (!m) throw new Error(`${열쇠파일} 에 YOUTUBE_STREAM_KEY 가 없다`);
  return m[1].trim();
}

function ffmpeg띄우기() {
  const 목록 = path.join(팩폴더, 'playlist.txt');
  if (!fs.existsSync(목록)) throw new Error(`재생목록이 없다: ${목록}`);
  const 겹치기 = `[1:v]format=rgba,setpts=PTS-STARTPTS[층];`
    + `[0:v][층]overlay=0:0:eof_action=pass:repeatlast=1,fps=${프레임},format=yuv420p[영상]`;
  const 앞 = ['-hide_banner', '-loglevel', 'warning',
    '-re', '-f', 'concat', '-safe', '0', '-stream_loop', '-1', '-i', 목록,
    /* 🔴 09-06 실측 — 층 그림의 «시각»을 벽시계로 맡기면(`-use_wallclock_as_timestamps`) 층이
       방송보다 뒤처져, 인사를 넣어도 그 장면이 한참 뒤(또는 끝난 뒤)에 온다. 그래서 층은 **정확히
       초당 <뜨기>장**을 흘려보내고(못 뜬 순간은 직전 장을 다시 쓴다) 여기서는 그 박자를 믿는다.
       thread_queue_size 를 늘려 두는 것은 「queue blocking」 경고가 그 어긋남을 키우기 때문이다. */
    '-f', 'image2pipe', '-framerate', String(뜨기), '-thread_queue_size', '512', '-i', 'pipe:0',
    '-filter_complex', 겹치기, '-map', '[영상]', '-map', '0:a',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '5000k',
    '-g', String(프레임 * 2), '-c:a', 'copy'];
  const 뒤 = 시늉파일
    ? ['-t', String(시늉초), '-y', 시늉파일]
    : ['-f', 'flv', `rtmp://a.rtmp.youtube.com/live2/${열쇠읽기()}`];
  말(시늉파일 ? `시늉 — ${시늉초}초를 ${시늉파일} 로 뽑는다` : '유튜브로 민다(열쇠는 안 찍는다)');
  const p = spawn('ffmpeg', 앞.concat(뒤), { stdio: ['pipe', 'ignore', 'pipe'] });
  p.stderr.on('data', (d) => 말('ffmpeg:', String(d).trim().slice(0, 200)));
  return p;
}

/* ── ④-2 채팅 감시 — «처음 말을 건 사람»에게 인사한다 ─────────────────────────
   (유호 지시 2026-09-06 「이런 반응을 캐치해서 인사같은거 하게 못만드나?」)

   🔑 유튜브는 «누가 들어왔는지»를 안 알려준다. 시청자 수는 숫자로만 오고 누구인지는 안 온다.
      그래서 「들어왔을 때」의 실체는 **「채팅에 처음 말했을 때」**다. 그 사람의 유튜브 이름만
      화면에 오른다 — 실명·학생코드는 층의 판정기가 사건째로 버린다(§3 철칙).

   🔑 방송을 «켜기 전»에도 채팅방은 열려 있다(09-06 실측 — 미리보기 단계에서 읽혔다).
      그래서 유호님이 관제실 채팅에 한 마디 쓰면 그 자리에서 인사가 뜬다.

   ⚠ 쿼터 — 채팅 한 번 읽기가 하루 한도(10,000)를 먹는다. 유튜브가 「1초마다 물어라」고 답해도
      그대로 따르면 하루치를 몇 시간에 태운다. 그래서 최소 간격을 따로 두고 그것을 지킨다.
   ⚠ 켜지는 조건 = 열쇠 파일에 RADIO_YT_CLIENT_ID·SECRET·REFRESH_TOKEN 이 있을 때만.
      없으면 조용히 안 돈다(송출은 그대로 산다). */
function 자격읽기() {
  try {
    const 표 = {};
    for (const 줄 of fs.readFileSync(열쇠파일, 'utf8').split(/\r?\n/)) {
      const m = 줄.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) 표[m[1]] = m[2].trim();
    }
    if (표.RADIO_YT_CLIENT_ID && 표.RADIO_YT_CLIENT_SECRET && 표.RADIO_YT_REFRESH_TOKEN) return 표;
  } catch { /* 없으면 안 돈다 */ }
  return null;
}

async function 채팅감시(사건넣기) {
  const 자격 = 자격읽기();
  if (!자격) { 말('채팅 감시는 안 켠다 — 열쇠 파일에 유튜브 자격이 없다'); return; }
  const 최소간격 = Math.max(3000, Number(값('--채팅간격', '10000')));
  let 토큰 = null, 토큰끝 = 0, 채팅id = null, 쪽표 = null;
  const 인사한사람 = new Set();
  let 첫바퀴 = true;

  const 새토큰 = async () => {
    if (토큰 && Date.now() < 토큰끝) return 토큰;
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: 자격.RADIO_YT_CLIENT_ID, client_secret: 자격.RADIO_YT_CLIENT_SECRET,
        refresh_token: 자격.RADIO_YT_REFRESH_TOKEN, grant_type: 'refresh_token' }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.access_token) throw new Error('유튜브 토큰 갱신 실패 ' + r.status);
    토큰 = j.access_token; 토큰끝 = Date.now() + (j.expires_in - 120) * 1000;
    return 토큰;
  };
  const yt = async (길) => {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${길}`, { headers: { authorization: `Bearer ${await 새토큰()}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${r.status} ${String(j.error?.message || '').slice(0, 140)}`);
    return j;
  };
  /* 어느 방송의 채팅인지는 «지금 살아 있는 것»에서 스스로 찾는다 — 방송 자리가 바뀌어도
     유닛을 고칠 일이 없다(끝난 자리는 되살릴 수 없어서 자리는 종종 바뀐다 · 09-06). */
  const 채팅찾기 = async () => {
    const b = await yt('liveBroadcasts?part=id,snippet,status&mine=true&maxResults=10');
    const 산것 = (b.items || []).find((x) => ['ready', 'testing', 'live'].includes(x.status?.lifeCycleStatus) && x.snippet?.liveChatId);
    if (!산것) return null;
    말(`채팅방을 찾았다 — 방송 ${산것.id} (${산것.status.lifeCycleStatus})`);
    return 산것.snippet.liveChatId;
  };

  for (;;) {
    try {
      if (!채팅id) { 채팅id = await 채팅찾기(); 쪽표 = null; 첫바퀴 = true; }
      if (!채팅id) { await 잠깐(60000); continue; }
      const 답 = await yt(`liveChat/messages?liveChatId=${채팅id}&part=snippet,authorDetails&maxResults=200`
        + (쪽표 ? `&pageToken=${쪽표}` : ''));
      쪽표 = 답.nextPageToken || null;
      for (const 말한것 of 답.items || []) {
        const 누구 = 말한것.authorDetails?.channelId;
        const 이름 = 말한것.authorDetails?.displayName;
        if (!누구 || !이름 || 인사한사람.has(누구)) continue;
        인사한사람.add(누구);
        /* 첫 바퀴는 «이미 쌓여 있던 말»이라 인사하지 않는다 — 켜자마자 옛 사람들에게
           우르르 인사하면 그건 반응이 아니라 소음이다. 이름만 적어 두고 넘어간다. */
        if (첫바퀴) continue;
        await 사건넣기({ 종류: '인사', 닉네임: 이름 });
        말('처음 말을 건 사람에게 인사했다:', 이름);
        await 잠깐(5000);   // 여럿이 한꺼번에 말해도 인사가 겹쳐 쌓이지 않게
      }
      첫바퀴 = false;
      await 잠깐(Math.max(최소간격, Number(답.pollingIntervalMillis) || 0));
    } catch (e) {
      말('채팅 감시 헛돌았다:', e.message);
      if (/liveChatNotFound|forbidden|404|403/i.test(e.message)) 채팅id = null;
      await 잠깐(30000);
    }
  }
}

/* ── ④ 사건 문 — 봇이 여기로 던지면 층이 받는다 ──────────────────────────────── */
function 사건문세우기(사건넣기) {
  http.createServer((req, res) => {
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('겹쳐송출 돌고 있다\n'); }
    let 몸 = '';
    req.on('data', (c) => { 몸 += c; if (몸.length > 4096) req.destroy(); });
    req.on('end', async () => {
      let 사건; try { 사건 = JSON.parse(몸); } catch { res.writeHead(400); return res.end('json 아니다'); }
      try {
        await 사건넣기(사건);
        말('사건 넣었다:', 사건.종류, 사건.닉네임 || '');
        res.writeHead(200); res.end('받았다');
      } catch (e) { 말('사건 실패:', e.message); res.writeHead(500); res.end(e.message); }
    });
  }).listen(사건포트, '127.0.0.1', () => 말(`사건 문 ${사건포트}`));
}

/* ── ⑤ 이어 붙이기 ─────────────────────────────────────────────────────────── */
(async () => {
  await 지면서버세우기();
  const 주소 = `http://127.0.0.1:${지면포트}/bots/오버레이/방송층.html?층=${encodeURIComponent(층)}`;
  말('층 지면:', 주소);
  const 크롬프로 = 크롬띄우기(주소);
  const { 부르기 } = await 붙기(await 문찾기());
  await 부르기('Page.enable');
  await 부르기('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  /* 지면은 1920×1080 으로 짜여 있고 방송은 1280×720 이다. 배율을 3분의 2 로 줄여서 뜨면
     지면을 고치지 않고도 방송 크기로 나온다(글자도 같이 줄어 비율이 안 깨진다). */
  await 부르기('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 2 / 3, mobile: false });
  await 잠깐(1500);   // 층이 그려질 틈

  const ff = ffmpeg띄우기();
  ff.on('exit', (코드) => { 말('ffmpeg 끝 · 코드', 코드); process.exit(코드 || 0); });

  /* 사건은 «한 문»으로만 들어간다 — 사람이 손으로 던지든, 채팅 감시가 스스로 던지든 같은 길이다. */
  const 사건넣기 = (사건) => 부르기('Runtime.evaluate', {
    expression: `(() => { const 문 = new BroadcastChannel('라디오오버레이');`
      + ` 문.postMessage(${JSON.stringify(사건)}); setTimeout(() => 문.close(), 1000); })()`,
  });
  사건문세우기(사건넣기);
  채팅감시(사건넣기).catch((e) => 말('채팅 감시가 죽었다:', e.message));

  let 뜨는중 = false, 막힘 = false, 센것 = 0, 다시쓴것 = 0, 실패 = 0, 마지막장 = null;
  ff.stdin.on('drain', () => { 막힘 = false; });
  ff.stdin.on('error', () => { /* ffmpeg 가 먼저 끝나면 여기로 온다 — exit 가 처리한다 */ });

  /* ⓐ 뜨는 쪽 — 되는 만큼 뜬다. 한 번이 늦어도 박자를 안 무너뜨린다. */
  setInterval(async () => {
    if (뜨는중) return;
    뜨는중 = true;
    try {
      const r = await 부르기('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 5000);
      마지막장 = Buffer.from(r.data, 'base64');
      if (센것 === 0) 말(`첫 장이 떴다 — ${Math.round(마지막장.length / 1024)}KB`);
      센것++; 실패 = 0;
    } catch (e) {
      실패++;
      if (실패 === 1 || 실패 % 20 === 0) 말(`뜨기 실패 ${실패}번째:`, e.message);
    }
    뜨는중 = false;
  }, Math.round(1000 / 뜨기));

  /* ⓑ 흘려보내는 쪽 — «정확히» 초당 뜨기장. 못 뜬 순간은 직전 장을 다시 쓴다.
     이 박자가 곧 층의 시각이라, 어긋나면 인사가 엉뚱한 때에 뜬다(09-06 실측). */
  setInterval(() => {
    if (!마지막장 || 막힘 || ff.stdin.destroyed) return;
    막힘 = !ff.stdin.write(마지막장);
    다시쓴것++;
  }, Math.round(1000 / 뜨기));

  setInterval(() => 말(`층 ${센것}장 떴다 · 내보낸 것 ${다시쓴것} · 실패 ${실패}`), 60000);
  process.on('SIGINT', () => { try { 크롬프로.kill(); ff.kill('SIGINT'); } catch {} process.exit(0); });
})().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
