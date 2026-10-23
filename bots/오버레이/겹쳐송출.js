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
 *   node 겹쳐송출.js --층 마스코트,전광판   마스코트를 팩에서 떼어낸 뒤에 쓸 차림 — 🆕 09-07 부터 기본값(무대만 팩)
 *   node 겹쳐송출.js --층 전광판            옛 팩(마스코트 박힘)으로 되돌릴 때
 *   --마스코트크기 0.32 --마스코트자리 중하 --마스코트바닥 2.5   층의 인형 크기(화면 폭 몫)·자리·발밑 여백(vh)
 *   --부스 1                              DJ 부스(09-08 · 기본 켬 · 층이 전자 결에서만 세운다) · 끄려면 0
 */
const path = require('path');
const 송출진척 = require('./송출진척.js');

const 설정 = require('./송출설정.js');
const 수명도구 = require('./송출수명.js');

function 만들기(인자 = [], 주입 = {}) {
const fs = 주입.fs || require('node:fs');
const http = 주입.http || require('node:http');
const spawn = 주입.spawn || require('node:child_process').spawn;
const execFileSync = 주입.execFileSync || require('node:child_process').execFileSync;
const WebSocket = 주입.WebSocket || globalThis.WebSocket;
const timers = 주입.timers || globalThis;
const 수명 = 수명도구.만들기({ timers });
const fetch = (url, options = {}) => (주입.fetch || globalThis.fetch)(url, { ...options, signal: 수명.signal });
const { 값, 지면뿌리, 팩폴더, 층, 마스코트크기, 마스코트자리, 마스코트바닥, 부스, 조율파일, 조율, 프레임, 뜨기, 소리목록, 무대목록, 연속소리, 장면분, 장면차례, 지면포트, 사건포트, 크롬포트, 열쇠파일, 크롬, 크롬프로필, 시늉파일, 시늉초 } = 설정.읽기(인자, { fs });
const setInterval = 수명.interval;
const 잠깐 = 수명.wait;
const 때 = () => new Date().toISOString().slice(11, 19);
const 말 = (...x) => console.log(`[겹쳐송출 ${때()}]`, ...x);

/* ── ① 지면 서버 — 층 지면과 그림을 크로미움에 먹인다 ───────────────────────────
   file:// 로 열면 프레임 사이에서 BroadcastChannel 이 안 통한다(미리보기 지면의 실측 주석).
   그래서 반드시 http 로 연다. 127.0.0.1 에만 묶어 바깥으로는 안 연다. */
const 확장자 = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function 지면서버세우기() {
  return new Promise((맞다, 아니다) => {
    const server = http.createServer((req, res) => {
      const 길 = decodeURIComponent(req.url.split('?')[0]);
      const 자리 = path.join(지면뿌리, 길);
      /* 뿌리 밖으로 못 나가게 — 지면이 서버의 다른 파일을 읽는 길을 내지 않는다 */
      if (!자리.startsWith(지면뿌리)) { res.writeHead(403); return res.end('밖'); }
      fs.readFile(자리, (e, 몸) => {
        if (e) { res.writeHead(404); return res.end('없다'); }
        res.writeHead(200, { 'content-type': 확장자[path.extname(자리).toLowerCase()] || 'application/octet-stream' });
        res.end(몸);
      });
    });
    서버소유(server);
    server.once('error', 아니다);
    server.listen(지면포트, '127.0.0.1', () => { 말(`지면 서버 ${지면포트} · 뿌리 ${지면뿌리}`); 맞다(server); });
  });
}

/* ── ② 크로미움 — 화면 없이 층 지면을 그린다 ─────────────────────────────────── */
function 크롬띄우기(주소) {
  try { fs.rmSync(크롬프로필, { recursive: true, force: true }); }
  catch (e) { 말('지난 크로미움 프로필을 못 비웠다(그냥 간다):', e.message); }
  const 옵션 = ['--headless=new', `--user-data-dir=${크롬프로필}`, '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--disable-dev-shm-usage', '--disable-extensions', '--no-first-run',
    /* 🔴 09-06 실측 — 여기에 `--default-background-color=00000000` 을 «시작 옵션으로» 주면
       브라우저가 통째로 굳는다. 붙자마자 Page.enable 조차 답이 없다(8초 시한 전부 초과).
       투명 바탕은 아래에서 `Emulation.setDefaultBackgroundColorOverride` 로 «붙은 뒤에» 건다 —
       그건 90ms 만에 답이 온다(같은 날 같은 기계에서 나란히 재봤다). */
    `--remote-debugging-port=${크롬포트}`, '--remote-allow-origins=*',
    '--window-size=1920,1080', 주소];
  const p = 프로세스소유(spawn(크롬, 옵션, { stdio: ['ignore', 'ignore', 'pipe'] }));
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
  const 연결 = await require('./송출연결.js').붙기(ws주소, { WebSocket, timers, signal: 수명.signal });
  수명.own(() => 연결.close());
  return 연결;
}

/* ── ③ ffmpeg — 팩과 층을 겹쳐 인코딩해 내보낸다 ──────────────────────────────── */

/* 🔴 2026-09-07 저녁 실측 — 방송 열쇠가 «이 길로» 샜다. 아래 stderr 리스너가 ffmpeg 의 문장을 그대로 일지에
   옮기는데, ffmpeg 이 끊길 때 내는 문장에 주소 전체가 들어 있다(`Error closing file rtmp://…/live2/<열쇠>`
   · `Error writing trailer of rtmp://…`). 24시간 일지에 2줄 확인. 코드 주석은 「열쇠는 안 찍는다」였는데
   그 약속이 여기서 깨져 있었다. 그래서 찍기 «전»에 rtmp 주소를 통째로 가린다 — 열쇠가 주소의 마지막
   토막이라 주소를 반만 가리면 또 샌다. */
const 열쇠가리기 = (글) => String(글).replace(/rtmps?:\/\/\S+/gi, 'rtmp://…(주소는 안 찍는다)');

function 열쇠읽기() {
  const 글 = fs.readFileSync(열쇠파일, 'utf8');
  const m = 글.match(/^\s*YOUTUBE_STREAM_KEY\s*=\s*(.+)$/m);
  if (!m) throw new Error(`${열쇠파일} 에 YOUTUBE_STREAM_KEY 가 없다`);
  return m[1].trim();
}

function ffmpeg띄우기() {
  /* 🆕 🔴 2026-09-08 «장면 따로 돌리기» — 유호 지시 09-08 「장면만 20분마다 바꾸는 테스트 해보자」.
     ■ 무엇이 달라지나
       그전에는 무대 그림이 곡 파일 «안에» 박혀 있어서, 곡이 바뀌어야 장면이 바뀌었다.
       이제 소리와 무대를 **따로 흘린다** — 소리는 곡 차례대로, 무대는 제 시계(<장면분>분)대로.
       그래서 한 곡이 도는 동안에도 무대가 바뀌고, 같은 무대에서 여러 곡이 이어진다.
     ■ 어떻게
       입력 0 = 소리 목록(곡 aac 들) · 입력 1 = 무대 목록(60초 되풀이 영상을 <장면분>분어치 늘어놓은 것) · 입력 2 = 층(그림 파이프)
       무대 목록은 `tools/라디오장면차례.js` 가 만든다 — 한 무대를 스무 번 적으면 20분이다.
     🔑 곁들여 가벼워진다 — 곡에서 «영상을 안 푼다»(소리만 있는 파일이라). 무대 영상 하나만 풀면 된다.
     ⚠ 소리와 무대 «둘 다» -re 로 실시간에 묶는다. 하나만 묶으면 안 묶인 쪽이 앞질러 달려 어긋난다. */
  const 두갈래 = !!(소리목록 && 무대목록);
  const 목록 = 두갈래 ? 소리목록 : path.join(팩폴더, 'playlist.txt');
  if (!fs.existsSync(목록)) throw new Error(`재생목록이 없다: ${목록}`);
  if (두갈래 && !fs.existsSync(무대목록)) throw new Error(`무대 차례가 없다: ${무대목록}`);
  const 무대칸 = 두갈래 ? '1:v' : '0:v';
  const 층칸 = 두갈래 ? '2:v' : '1:v';
  const 겹치기 = `[${층칸}]format=rgba,setpts=PTS-STARTPTS[층];`
    + `[${무대칸}][층]overlay=0:0:eof_action=pass:repeatlast=1,fps=${프레임},format=yuv420p[영상]`;
  const 앞 = ['-hide_banner', '-loglevel', 'warning',
    '-re', '-f', 'concat', '-safe', '0', '-stream_loop', '-1', '-i', 목록,
    ...(두갈래 ? ['-re', '-f', 'concat', '-safe', '0', '-stream_loop', '-1', '-i', 무대목록] : []),
    /* 🔴 09-06 실측 — 층 그림의 «시각»을 벽시계로 맡기면(`-use_wallclock_as_timestamps`) 층이
       방송보다 뒤처져, 인사를 넣어도 그 장면이 한참 뒤(또는 끝난 뒤)에 온다. 그래서 층은 **정확히
       초당 <뜨기>장**을 흘려보내고(못 뜬 순간은 직전 장을 다시 쓴다) 여기서는 그 박자를 믿는다.
       thread_queue_size 를 늘려 두는 것은 「queue blocking」 경고가 그 어긋남을 키우기 때문이다. */
    '-f', 'image2pipe', '-framerate', String(뜨기), '-thread_queue_size', '512', '-i', 'pipe:0',
    '-filter_complex', 겹치기, '-map', '[영상]', '-map', '0:a',
    /* 🔴 09-07 저녁 실측 — veryfast 로는 e2-medium(코어 둘을 나눠 쓰는 기계)에서 실시간대비 0.45~0.88x 로 뒤처져
       유튜브가 굶는다(videoIngestionStarved). ultrafast 는 화질을 조금 내주고 인코딩 CPU 를 크게 아낀다 —
       방송이 1280×720 · 2.5Mbps 라 눈에 띄는 차이는 작다. 값은 아래 1분 보고의 «실시간대비»가 판정한다. */
    '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '5000k',
    '-g', String(프레임 * 2),
    ...(연속소리 ? ['-af', 'asetpts=N/SR/TB', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2'] : ['-c:a', 'copy']),
    '-progress', 'pipe:2'];   // 09-07 · 실시간을 따라가나(speed)를 재려고 — 값은 아래 1분 보고로만 나간다
  const 뒤 = 시늉파일
    ? ['-t', String(시늉초), '-y', 시늉파일]
    : ['-rw_timeout', '15000000', '-f', 'flv', `rtmp://a.rtmp.youtube.com/live2/${열쇠읽기()}`];
  말(시늉파일 ? `시늉 — ${시늉초}초를 ${시늉파일} 로 뽑는다` : '유튜브로 민다(열쇠는 안 찍는다)');
  const p = 프로세스소유(spawn('ffmpeg', 앞.concat(뒤), { stdio: ['pipe', 'ignore', 'pipe'] }), true);
  /* 🆕 2026-09-07 «뒤처짐을 재는 자» — 유튜브가 `videoIngestionStarved`(영상이 모자라게 들어온다)를
     냈는데 우리 일지는 「실패 0」만 찍고 있었다. 뜨는 쪽과 흘려보내는 쪽만 세고, **ffmpeg 이 실시간을
     따라가는지는 아무도 안 재고 있었다.** 그래서 `-progress` 로 그 수를 받아 둔다.
     🔑 읽는 법: `speed` 가 1.0 이면 실시간 · 0.9 면 10% 뒤처져 유튜브가 굶는다 · `drop`·`dup` 은 버린/겹친 장.
     ⚠ 이 값들은 초당 한 번씩 쏟아지므로 **일지에 안 찍는다** — 아래 1분 보고에 한 줄로 실린다. */
  p.stderr.on('data', (d) => {
    const 남은 = 진척읽기.받기(d).join(' ').trim();
    if (남은) 말('ffmpeg:', 열쇠가리기(남은).slice(0, 200));
  });
  return p;
}
/* ffmpeg 이 스스로 알려 주는 진척 — 위 리스너가 채우고 1분 보고가 읽는다. */
const 진척읽기 = 송출진척.만들기();
const 진척 = 진척읽기.상태;

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
  /* 🔴 09-07 실측 — 10초 간격이면 하루 8,640회 × 5점(liveChatMessages.list) = 43,200점이라 한도 10,000점을 대여섯 시간에 태우고,
     그 뒤로는 403 quota 로 종일 헛돈다(인사가 죽는다). 45초면 1,920회 × 5 = 9,600점 — 한도 안이다(방송 찾기 몇 번의 여유).
     사람이 늘어 더 빨리 읽고 싶으면 --채팅간격 으로 줄이되, 그 값 × 5 × 86400/간격 < 10,000 을 먼저 센다. */
  const 최소간격 = Math.max(3000, Number(값('--채팅간격', '45000')));
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

  while (!수명.signal.aborted) {
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
      if (수명.signal.aborted) return;
      말('채팅 감시 헛돌았다:', e.message);
      if (/liveChatNotFound|forbidden|404|403/i.test(e.message)) 채팅id = null;
      await 잠깐(30000);
    }
  }
}

/* ── ④-3 결 신호 — «지금 어느 장르 곡인가»를 층에 알린다 (09-07 · 무대만 팩 뒤 필요해진 자리)
   무대만 팩으로 가면서 인형이 층으로 나왔다. 층은 결(곡 장르)을 받아야 누가 서고 무엇을 입나를 정한다
   (마스코트.html 장르차림). ffmpeg 의 concat 은 곡이 바뀌는 순간을 밖으로 안 알려 주므로, 재생목록의
   차례와 각 곡의 길이(ffprobe)로 «시계»를 만들어 경계마다 결 사건을 던진다. -re 가 실시간을 지키니 어긋남은 초 단위다.
   🔑 결 이름은 마스코트.html 장르차림의 낱말이다 — 팩 이름의 영어 키(house·citypop·calm)를 그 낱말로 옮긴다. */
/* 🆕 09-07 chuseok — 추석 시즌 무대(보름달 뜬 한옥 마당). 2026 추석 = 09-25.
   팩 파일 이름의 영어 키가 `-chuseok-air.ts` 이면 이 결이 층에 간다. */
/* 🆕 09-08 house → 전자네온물가 — 유호 확정 09-07 「전자(하우스) 곡의 무대는 전자네온물가로 간다」(결정.md D+0).
   무대 영상도 그 결로 굽는다(tools/무대영상굽기.js → 층_house.mp4). 옛 값 = 전자밤도시. */
/* house는 09-08부터 네온 층 영상의 편성 키다. 삭제한 house.png(밤도시)와 연결하지 않는다.
   09-09 물·들판은 보존한 야외 원본의 명시적 장면 이름으로만 통지한다. */
const 결이름 = { house: '전자네온물가', neon_water: '전자네온물가',
  chuseok: '추석보름달마당',
  dream_water: '거울수면과문', dream_field: '반딧불노을들판'
};
function 재생차례() {
  const 줄들 = fs.readFileSync(path.join(팩폴더, 'playlist.txt'), 'utf8').split(/\r?\n/);
  const 파일들 = 줄들.map((l) => (l.match(/^file\s+'(.+)'\s*$/) || [])[1]).filter(Boolean);
  let 표 = {};
  try { for (const t of JSON.parse(fs.readFileSync(path.join(팩폴더, '재생목록.json'), 'utf8')).트랙 || []) 표[t.파일] = t.결; } catch { /* 없으면 이름에서 읽는다 */ }
  return 파일들.map((f) => {
    const 키 = 표[f] || (f.match(/-([a-z_]+)-air\.ts$/) || [])[1] || '';
    let 초 = 0;
    try { 초 = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(팩폴더, f)], { encoding: 'utf8' }).trim()) || 0; } catch { /* 길이를 못 재면 0 — 아래서 건너뛴다 */ }
    return { 파일: f, 결: 결이름[키] || null, 초 };
  }).filter((t) => t.초 > 0);
}
/* 🆕 🔴 2026-09-08 «장면 시계» — 무대를 곡이 아니라 «시간»이 정할 때의 결 신호(유호 지시 09-08).
   무대 목록이 <장면분>분마다 다음 무대로 넘어가므로, 층에도 같은 시계로 알린다.
   🔑 ffmpeg 과 이 시계는 «둘 다 벽시계»를 본다 — 무대 영상이 -re 로 실시간에 묶여 있어서 어긋남이 초 단위다.
   ⚠ 첫 무대는 목록의 첫 줄이므로 켜자마자 한 번 던진다(안 던지면 다음 스무 분까지 몽글 맨몸이 선다). */
async function 장면시계(사건넣기) {
  const 한칸 = 장면분 * 60 * 1000;
  말(`장면 시계 켬 — ${장면분}분마다 · 차례 ${장면차례.join(' → ')}`);
  const 시작t = Date.now();
  let 마지막 = -1;
  const 한번 = async () => {
    const i = Math.floor((Date.now() - 시작t) / 한칸) % 장면차례.length;
    if (i === 마지막) return;
    마지막 = i;
    await 사건넣기({ 종류: '결', 결: 장면차례[i] });
    말(`장면 ${i + 1}/${장면차례.length} → 결 ${장면차례[i]} (${장면분}분)`);
  };
  await 잠깐(2500);            // 층이 컷을 다 읽을 틈
  await 한번();
  setInterval(() => { 한번().catch((e) => 말('장면 시계 실패:', e.message)); }, 1000);
}
async function 결신호(사건넣기) {
  if (소리목록 && 무대목록) return 장면시계(사건넣기);   // 장면을 시간이 정하면 곡 시계는 안 쓴다
  const 차례 = 재생차례();
  const 한바퀴 = 차례.reduce((a, t) => a + t.초, 0);
  if (!차례.length || !한바퀴) { 말('결 신호를 못 켠다 — 재생목록의 길이를 못 쟀다'); return; }
  말(`결 신호 켬 — ${차례.length}곡 · 한 바퀴 ${Math.round(한바퀴)}초 · ` + 차례.map((t) => `${t.결 || '?'}`).join(','));
  const 시작t = Date.now();
  let 마지막 = -1;
  const 한번 = async () => {
    let 남은 = ((Date.now() - 시작t) / 1000) % 한바퀴;
    let i = 0;
    while (i < 차례.length - 1 && 남은 >= 차례[i].초) { 남은 -= 차례[i].초; i++; }
    if (i === 마지막) return;
    마지막 = i;
    const t = 차례[i];
    if (!t.결) { 말(`곡 ${i + 1} ${t.파일} — 결을 몰라 층에 안 알린다`); return; }
    await 사건넣기({ 종류: '결', 결: t.결 });
    말(`곡 ${i + 1}/${차례.length} ${t.파일} → 결 ${t.결}`);
  };
  await 잠깐(2500);            // 층이 컷을 다 읽을 틈(첫 결 신호가 교대 연출을 부른다)
  await 한번();
  setInterval(() => { 한번().catch((e) => 말('결 신호 실패:', e.message)); }, 1000);
}

/* ── ④ 사건 문 — 봇이 여기로 던지면 층이 받는다 ──────────────────────────────── */
function 사건문세우기(사건넣기) {
  const server = http.createServer((req, res) => {
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
  });
  서버소유(server);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(사건포트, '127.0.0.1', () => { 말(`사건 문 ${사건포트}`); resolve(server); });
  });
}

/* ── ⑤ 이어 붙이기 ─────────────────────────────────────────────────────────── */
function 서버소유(server) {
  수명.own(() => new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections?.();
  }));
  server.on('error', (error) => { void 수명.stop({ code: 1, error }); });
}
function 프로세스소유(child, encoder = false) {
  수명.own((result) => {
    // SIGINT만 보내면 image2pipe의 read가 EOF를 기다리며 인코더가 남을 수 있다.
    if (encoder) child.stdin?.destroy();
    if (child.exitCode == null && !child.killed) child.kill(encoder ? (result.force ? 'SIGKILL' : 'SIGINT') : 'SIGTERM');
  });
  child.on('error', (error) => { void 수명.stop({ code: 1, error }); });
  return child;
}
let 시작됨 = false;
async function 시작() {
  if (시작됨) throw Error('송출은 한 번만 시작할 수 있습니다');
  시작됨 = true;
  try {
  수명.check();
  await 지면서버세우기();
  수명.check();
  const 주소 = `http://127.0.0.1:${지면포트}/bots/오버레이/방송층.html?층=${encodeURIComponent(층)}`
    + `&크기=${encodeURIComponent(마스코트크기)}&자리=${encodeURIComponent(마스코트자리)}&바닥=${encodeURIComponent(마스코트바닥)}`
    + `&부스=${encodeURIComponent(부스)}`;
  말('층 지면:', 주소);
  말(`무게: 내보내는 초당 ${프레임}장 · 층을 초당 ${뜨기}장 흘린다`
    + (Object.keys(조율).length ? ` (조율 파일이 정했다: ${조율파일})` : ''));
  말(소리목록 && 무대목록
    ? `차림: 소리와 무대를 따로 흘린다 — 소리 ${path.basename(소리목록)} · 무대 ${path.basename(무대목록)} · 장면 ${장면분}분마다`
    : '차림: 곡 팩 하나로 흘린다(무대가 곡 안에 박혀 있다)');
  const 크롬프로 = 크롬띄우기(주소);
  const { 부르기 } = await 붙기(await 문찾기());
  await 부르기('Page.enable');
  await 부르기('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  /* 지면은 1920×1080 으로 짜여 있고 방송은 1280×720 이다. 배율을 3분의 2 로 줄여서 뜨면
     지면을 고치지 않고도 방송 크기로 나온다(글자도 같이 줄어 비율이 안 깨진다). */
  await 부르기('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 2 / 3, mobile: false });
  await 잠깐(1500);   // 층이 그려질 틈

  const ff = ffmpeg띄우기();
  ff.on('exit', (코드) => { 말('ffmpeg 끝 · 코드', 코드); void 수명.stop({ code: 코드 || 0 }); });

  /* 사건은 «한 문»으로만 들어간다 — 사람이 손으로 던지든, 채팅 감시가 스스로 던지든 같은 길이다. */
  const 사건넣기 = (사건) => 부르기('Runtime.evaluate', {
    expression: `(() => { const 문 = new BroadcastChannel('라디오오버레이');`
      + ` 문.postMessage(${JSON.stringify(사건)}); setTimeout(() => 문.close(), 1000); })()`,
  });
  try {
    const timer = (주입.현재곡 || require('./현재곡.js')).시작({ playlist: 소리목록, progress: 진척, send: 사건넣기, log: 말 });
    if (timer) 수명.own(() => timers.clearInterval(timer));
  }
  catch (e) { 말('곡 시간표 오류:', e.message); }
  await 사건문세우기(사건넣기);
  수명.check();
  채팅감시(사건넣기).catch((e) => { if (!수명.signal.aborted) 말('채팅 감시가 죽었다:', e.message); });
  결신호(사건넣기).catch((e) => { if (!수명.signal.aborted) 말('결 신호가 죽었다:', e.message); });

  const 프레임상태 = require('./송출프레임.js').시작({ 부르기, ff, 뜨기, 말, interval: 수명.interval, now: 주입.now || Date.now });

  /* 🆕 09-07 — 보고에 «실시간을 따라가나»를 같이 싣는다. 앞의 두 수(뜬 것·내보낸 것)는 우리 쪽만 세므로
     유튜브가 굶고 있어도 「실패 0」이 나온다(09-07 실측 · 그 거짓 초록 때문에 20시간을 못 봤다).
     🔑 speed 가 1.0 아래로 오래 머물면 유튜브가 `videoIngestionStarved` 를 낸다 — 그때 보이라고 찍는다. */
  /* 🔴 09-07 저녁 실측 — «내보낸 것»이 늘어나는 것은 좋은 얼굴이 아니다. 죽은 판(10:31~10:40)에서 그 수가
     분당 480 → 580 으로 늘어나는 «동안» 실시간대비가 0.82 → 0.456 으로 처졌다. ffmpeg 의 입력 대기줄
     (`-thread_queue_size 512` = 51초치)이 밀린 그림을 쓸어 담기만 했기 때문이다. 그래서 쌓인 수 대신
     **초당 몇 장인가**를 같이 찍는다 — 「8.0/10」처럼 약속과 실물이 한눈에 보이게. */
  /* 🔴 09-07 11:25 실측 — «박자가 몇 번 불렸나»(불린 박자)가 이번 판정을 갈랐다. 거른 박자가 0 인데
     내보낸 것이 초당 8.0 이면 답은 하나뿐이다: 타이머가 약속한 만큼 안 불린 것이다. 그 수 없이는
     «못 삼켰다»와 «안 불렸다»를 못 가른다. 읽는 법 = 불린 박자가 초당 <뜨기> 아래면 기계가 모자란 것. */
  /* 🆕 🔴 2026-09-08 «멎음 지킴이» — ffmpeg 이 살아 있는데 방송만 죽는 무늬를 잡는다.
     그날 실측: 유튜브가 연결을 닫았는데(소켓 CLOSE-WAIT) ffmpeg 은 그걸 모른 채 계속 돌았다.
     겉으로는 멀쩡했다 — 「실패 0 · 버린장 0 · 겹친장 0 · 내보낸 것 초당 10.0/10」. 죽지 않으니
     systemd 의 «죽으면 되살리기»도 안 걸려서, 유튜브 쪽은 40분 넘게 **아무것도 못 받고 있었다**.
     🔑 가르는 자 = **`out_time`(ffmpeg 이 실제로 내보낸 방송 시각)이 나아가나.**
        · 기계가 바빠서 느린 것 → out_time 은 «느리게라도» 나아간다(옆 세션 인코딩 때 실측 0.5~0.7배).
        · 받는 쪽이 닫힌 것 → out_time 이 **멈춘다.** 이 둘을 speed 하나로는 못 가른다.
     09-09: 실제 연결 정체 뒤 약 4분 기다린 사례가 있어 점검을 10초/무진전30초로 단축한다.
     시작60초 유예와 느리더라도 진행 중이면 유지하는 조건은 송출진척.js가 검사한다. */
  setInterval(() => {
    const 상태 = 진척읽기.확인();
    if (!상태.재시작) return;
    말(`🔴 방송 시각이 ${Math.round(상태.멎은ms / 1000)}초째 제자리다(${상태.out_time}) — 기존 자동 복구로 다시 연결한다.`);
    void 수명.stop({ code: 1, force: true });
  }, 10000);
  let 앞수 = { 센것: 0, 다시쓴것: 0, 불린것: 0 };
  setInterval(() => {
    const { 센것, 다시쓴것, 거른것, 불린것, 실패 } = 프레임상태.상태();
    const 뜬속 = ((센것 - 앞수.센것) / 60).toFixed(1);
    const 낸속 = ((다시쓴것 - 앞수.다시쓴것) / 60).toFixed(1);
    const 불린속 = ((불린것 - 앞수.불린것) / 60).toFixed(1);
    앞수 = { 센것, 다시쓴것, 불린것 };
    말(`층 ${센것}장 떴다(초당 ${뜬속}) · 내보낸 것 ${다시쓴것}(초당 ${낸속}/${뜨기}) · 실패 ${실패}`
      + ` · 불린 박자 초당 ${불린속}/${뜨기} · 거른 박자 ${거른것}`
      + ` · 실시간대비 ${진척.speed} · 버린장 ${진척.drop_frames} · 겹친장 ${진척.dup_frames} · 방송시각 ${진척.out_time}`);
  }, 60000);
  return api;
  } catch (error) {
    await 수명.stop({ code: 수명.signal.aborted ? 0 : 1, error });
    if (error.name === 'AbortError') return api;
    throw error;
  }
}
const api = { start: 시작, stop: 수명.stop, done: 수명.done };
return api;
}

async function main(argv = process.argv.slice(2)) {
  const runtime = 만들기(argv);
  const stop = () => { void runtime.stop({ code: 0 }); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runtime.start();
    const result = await runtime.done;
    if (result.error) console.error('🔴 ' + result.error.message);
    process.exitCode = result.code;
    return result.code;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}
module.exports = { 만들기, main };
// CLI는 자원 정리 뒤 종료를 보장해 기존 systemd 프로세스 복구 계약을 유지한다.
if (require.main === module) main().then((code) => process.exit(code)).catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
