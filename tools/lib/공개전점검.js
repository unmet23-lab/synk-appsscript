'use strict';
/**
 * 공개 전 점검 — synk.im 공개 후보 가운데 이번에 바뀌거나 새로 생긴 HTML 쪽을 «후보 바이트 그대로» 로컬에서 띄워 두 가지를 잰다(2026-11-08).
 *
 * ■ 왜 있나
 *   접근성(axe) 위반과 페이지 오류는 그동안 공개 «뒤» 배포 점검(GitHub 액션 site-check)에서만 잡혔다. 11-08 눈가림 시험에서
 *   검수자 셋(GPT · 아르곤 · Fable)이 모두 놓친 두 결함이 이 종류였다 — snap-words 입구의 role="listbox" 안에 option이 아니라
 *   단추(axe aria-required-children 치명), /world/seoul-arrival/을 앱 밖에서 직접 열면 크기 바뀜 처리기가 지워진 요소를 찾다 난
 *   페이지 오류. 검수자를 늘리는 대신 공개 전에 기계로 막는다.
 *
 * ■ 무엇을 재나 — 쪽마다 새 크롬 맥락(저장소 · 서비스 워커가 섞이지 않게)에서
 *   1. 390×844로 열고(앱 틀 · iframe 없이 주소로 바로) load를 기다린 뒤(20초까지) 3초
 *   2. axe(tools/접근성검사.js 재기 — 끝까지 훑고 나타나기를 기다린 뒤 붓는다)
 *   3. 창을 1440×900으로 바꾸고 1.5초 → 다시 axe
 *   그동안 생긴 잡히지 않은 오류(Runtime.exceptionThrown = Playwright pageerror)와 console.error · 브라우저 오류 기록(404 · CSP)을 모은다.
 *   같은 쪽의 앞 공개본(origin/main 판)도 같은 서버 꼴 · 같은 순서로 잰다.
 *
 * ■ 무엇을 막나 — 「이번 공개가 새로 만든 것」만
 *   · axe 치명(critical) 위반 가운데 앞 공개본에 없던 자리(같은 규칙 · 같은 선택자, 선택자가 바뀌었으면 같은 HTML 조각)
 *   · 잡히지 않은 오류 가운데 앞 공개본의 같은 쪽에서는 안 나던 것(첫 줄 글에서 로컬 주소 · ?v= · 줄 번호를 뺀 열쇠로 견준다)
 *   · 후보 쪽을 아예 재지 못했는데 공개본은 쟀거나 새 쪽인 것(쪽이 멈추거나 무너진 경우)
 *   새 쪽은 견줄 앞 판이 없어 치명 · 오류가 모두 새것이다. 심각 이하 axe · console.error · 공개본에도 있던 것은 「알림」으로만 보인다.
 *   오류도 앞 공개본과 견주는 까닭: 로컬 주소(127.0.0.1)에서만 나는 오류(바깥 API의 CORS 등)와 이미 공개된 오류가 이번 공개를
 *   막지 않게 — 같은 조건에서 공개본에도 나면 이번 공개가 만든 것이 아니다.
 *
 * ■ 무엇을 못 재나 (자의 한계)
 *   · 쪽을 누르고 다니는 흐름(게임 시작 · 질문창 답)은 안 한다 — 배포 점검 4 · 5단계가 맡는다. 처음 3초와 크기 바꿈 한 번뿐이다.
 *   · 고른 쪽 = 후보 항목 가운데 지우지 않는 .html(바꿈 · 새 · ?v= 갱신) + 바뀐 스크립트 · 스타일 · 데이터의 가장 가까운 위 폴더
 *     index.html(가까운 쪽, 8개까지). 그 밖의 쪽이 부르는 바뀐 파일은 못 본다 — 잰 쪽이 안 부른 바뀐 파일은 알림으로 센다.
 *   · Jekyll 머리말 쪽(공개 바이트가 저장소와 다름)과 밑줄 · 점 경로(공개 주소로 안 나감)는 안 띄운다.
 *   · 크롬을 못 띄우면 막지 않고 「못 잼」으로 보이고 넘어간다.
 *
 * 크롬은 tools/lib/크롬조종.js의 크롬찾기로 찾는다(SYNK_CHROME). 그 통로는 사건을 한 번만 들어 잡히지 않은 오류를 계속 받을 수 없어,
 * 여기에 사건을 계속 듣는 작은 통로(cdp연결)를 둔다. 시험: node --test tests/공개전점검.test.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const 좁은 = { width: 390, height: 844 };
const 넓은 = { width: 1440, height: 900 };
const 기본시간 = { 실림: 20000, 처음: 3000, 바꾼뒤: 1500, 나타남: 2200, 명령: 30000, axe: 60000, 전체: 150000 };
const 가까운쪽한도 = 8;
const 검사이름 = '공개 전 점검';
const 건너뜀옵션 = '--공개전점검건너뜀';

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

/** 공개 주소로 나가는 경로인가(Jekyll이 밑줄 · 점 경로를 내보내지 않는다 — .well-known만 나간다) */
const 나가는경로 = (p) => !String(p).split('/').some((s) => s.startsWith('_') || (s.startsWith('.') && s !== '.well-known'));
const 머리말있음 = (b) => Buffer.isBuffer(b) && /^---\r?\n/.test(b.subarray(0, 8).toString('latin1'));
const 쪽꼴 = /\.html?$/i;
const 스크립트꼴 = /\.(m?js|css|json)$/i;

/** 공개 경로 → 주소 길: index.html → /, a/index.html → /a/, a/b.html → /a/b.html */
function 주소로(p) {
  const 앞 = p === 'index.html' ? '' : p.endsWith('/index.html') ? p.slice(0, -'index.html'.length) : p;
  return `/${앞.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * 잴 쪽을 고른다. 항목들: 공개 도구 후보 항목 [{경로, 종류, 버퍼(지움이면 null)}]. 후보있나(p): 후보 트리에 p가 있나(가까운 쪽 찾기).
 * 반환 { 쪽들: [{경로, 주소, 까닭, 새쪽, 부른?}], 빠짐: [{경로, 이유}] }
 */
function 쪽고르기(항목들, { 후보있나 = () => false, 한도 = 가까운쪽한도 } = {}) {
  const 쪽 = new Map();
  const 빠짐 = [];
  for (const x of 항목들 || []) {
    if (!x || !x.버퍼 || !쪽꼴.test(x.경로) || !나가는경로(x.경로)) continue;
    if (머리말있음(x.버퍼)) { 빠짐.push({ 경로: x.경로, 이유: 'Jekyll 머리말 쪽이라 공개 바이트가 저장소와 달라 로컬에서 그대로 못 띄운다' }); continue; }
    쪽.set(x.경로, { 경로: x.경로, 주소: 주소로(x.경로), 까닭: x.종류 || '바꿈', 새쪽: x.종류 === '새' });
  }
  // 바뀐 스크립트 · 스타일 · 데이터만 바뀌고 쪽은 그대로인 공개(?v= 없이 부르는 모듈 등) — 가장 가까운 위 폴더의 index.html을 잰다
  let 더함 = 0;
  for (const x of 항목들 || []) {
    if (!x || !x.버퍼 || !스크립트꼴.test(x.경로) || !나가는경로(x.경로)) continue;
    const 칸 = x.경로.split('/');
    for (let i = 칸.length - 1; i >= 0; i--) {
      const 곳 = [...칸.slice(0, i), 'index.html'].join('/');
      if (쪽.has(곳)) break;
      if (!후보있나(곳)) continue;
      if (더함 >= 한도) { 빠짐.push({ 경로: 곳, 이유: `${x.경로}의 가까운 쪽이지만 가까운 쪽 한도(${한도}개)를 넘어 재지 않았다` }); break; }
      쪽.set(곳, { 경로: 곳, 주소: 주소로(곳), 까닭: '가까운 쪽', 새쪽: false, 부른: x.경로 });
      더함++;
      break;
    }
  }
  return { 쪽들: [...쪽.values()], 빠짐 };
}

// ── 정적 서버 ───────────────────────────────────────────────────────────────

const 종류표 = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', cjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', map: 'application/json; charset=utf-8', webmanifest: 'application/manifest+json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8', xml: 'application/xml; charset=utf-8', csv: 'text/csv; charset=utf-8',
  vtt: 'text/vtt; charset=utf-8', srt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
  wasm: 'application/wasm', glb: 'model/gltf-binary', gltf: 'model/gltf+json', pdf: 'application/pdf',
};
const 종류 = (p) => 종류표[(/\.([A-Za-z0-9]+)$/.exec(p) || [])[1]?.toLowerCase()] || 'application/octet-stream';

/** 주소 길 → {경로, 버퍼} · {경로, 옮김} · {경로, 못실음} · {경로}(없음). GitHub Pages처럼 /a → /a/(a/index.html이 있으면) · /a → a.html */
async function 길풀기(길, 읽기) {
  let p = String(길).replace(/^\/+/, '');
  if (p.split('/').some((s) => s === '..')) return { 경로: p };
  const 폴더길 = !p || p.endsWith('/');
  if (폴더길) p += 'index.html';
  if (!나가는경로(p)) return { 경로: p };
  const 첫 = await 읽기(p);
  if (Buffer.isBuffer(첫)) return { 경로: p, 버퍼: 첫 };
  if (첫 && 첫.못실음) return { 경로: p, 못실음: 첫.못실음 };
  if (!폴더길) {
    const 안 = await 읽기(`${p}/index.html`);
    if (Buffer.isBuffer(안) || (안 && 안.못실음)) return { 경로: p, 옮김: `${주소로(`${p}/index.html`)}` };
    const 붙임 = await 읽기(`${p}.html`);
    if (Buffer.isBuffer(붙임)) return { 경로: `${p}.html`, 버퍼: 붙임 };
  }
  return { 경로: p };
}

/**
 * 판 하나를 내주는 작은 정적 서버(127.0.0.1, 빈 포트). 읽기(공개경로) → Buffer | null(없음) | {못실음: 이유}.
 * 쪽이 /assets/… 같은 뿌리 경로 · 상대 경로 자원을 부르므로 file:// 대신 서버로 띄운다. 요청마다 {경로, 상태}를 적는다.
 */
async function 정적서버(읽기) {
  const 요청 = [];
  const 답하기 = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    let 길 = null;
    try { 길 = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (_) { /* 깨진 주소 */ }
    const 풀이 = 길 === null ? { 경로: '' } : await 길풀기(길, 읽기);
    if (풀이.옮김) {
      요청.push({ 경로: 풀이.경로, 상태: 301 });
      res.writeHead(301, { location: 풀이.옮김, 'cache-control': 'no-store' });
      res.end();
      return;
    }
    if (!풀이.버퍼) {
      요청.push({ 경로: 풀이.경로, 상태: 404, ...(풀이.못실음 ? { 못실음: 풀이.못실음 } : {}) });
      const 없음쪽 = await 읽기('404.html');
      const 몸 = Buffer.isBuffer(없음쪽) ? 없음쪽 : Buffer.from('Not Found');
      res.writeHead(404, { 'content-type': Buffer.isBuffer(없음쪽) ? 종류표.html : 종류표.txt, 'cache-control': 'no-store', 'content-length': 몸.length });
      res.end(req.method === 'HEAD' ? undefined : 몸);
      return;
    }
    const { 경로, 버퍼 } = 풀이;
    const 머리 = { 'content-type': 종류(경로), 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
    const 범위 = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
    if (범위 && (범위[1] || 범위[2])) {
      let 시작, 끝;
      if (범위[1]) { 시작 = Number(범위[1]); 끝 = 범위[2] ? Math.min(Number(범위[2]), 버퍼.length - 1) : 버퍼.length - 1; }
      else { 시작 = Math.max(0, 버퍼.length - Number(범위[2])); 끝 = 버퍼.length - 1; }
      if (!(시작 <= 끝) || 시작 >= 버퍼.length) {
        요청.push({ 경로, 상태: 416 });
        res.writeHead(416, { 'content-range': `bytes */${버퍼.length}` });
        res.end();
        return;
      }
      요청.push({ 경로, 상태: 206 });
      res.writeHead(206, { ...머리, 'content-range': `bytes ${시작}-${끝}/${버퍼.length}`, 'content-length': 끝 - 시작 + 1 });
      res.end(req.method === 'HEAD' ? undefined : 버퍼.subarray(시작, 끝 + 1));
      return;
    }
    요청.push({ 경로, 상태: 200 });
    res.writeHead(200, { ...머리, 'content-length': 버퍼.length });
    res.end(req.method === 'HEAD' ? undefined : 버퍼);
  };
  const 서버 = http.createServer((req, res) => {
    답하기(req, res).catch((e) => {
      요청.push({ 경로: String(req.url || ''), 상태: 500, 오류: String((e && e.message) || e).slice(0, 200) });
      try { if (!res.headersSent) res.writeHead(500, { 'content-type': 종류표.txt }); res.end(String((e && e.message) || e)); } catch (_) { /* 이미 닫힘 */ }
    });
  });
  await new Promise((r, j) => { 서버.once('error', j); 서버.listen(0, '127.0.0.1', r); });
  return {
    주소: `http://127.0.0.1:${서버.address().port}`, 요청,
    닫기: () => new Promise((r) => { if (서버.closeAllConnections) 서버.closeAllConnections(); 서버.close(() => r()); }),
  };
}

// ── 크롬 ────────────────────────────────────────────────────────────────────

/**
 * 조종 통로(DevTools 규약) 한 벌 — 보내고 답을 기다리되(기다림ms가 지나면 거절), 사건은 끌 때까지 계속 듣는다.
 * 브라우저 층 주소에 붙고 flatten 세션(sessionId)으로 쪽마다 명령을 나눈다.
 */
function cdp연결(주소) {
  const ws = new WebSocket(주소);
  let 번호 = 0;
  let 끊김 = null;
  const 기다림 = new Map();
  const 듣기들 = new Map();
  const 열림 = new Promise((r, j) => {
    ws.addEventListener('open', () => r());
    ws.addEventListener('error', () => j(new Error('조종 통로가 안 열렸다')));
  });
  ws.addEventListener('message', (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch (_) { return; }
    if (m.id && 기다림.has(m.id)) {
      const w = 기다림.get(m.id);
      기다림.delete(m.id);
      clearTimeout(w.시계);
      if (m.error) w.아니다(new Error(`${w.method}: ${m.error.message}`)); else w.맞다(m.result || {});
      return;
    }
    if (m.method && 듣기들.has(m.method)) {
      for (const fn of [...듣기들.get(m.method)]) { try { fn(m.params || {}, m.sessionId); } catch (_) { /* 듣는 쪽 오류가 통로를 멈추지 않게 */ } }
    }
  });
  ws.addEventListener('close', () => {
    끊김 = new Error('조종 통로가 닫혔다');
    for (const w of 기다림.values()) { clearTimeout(w.시계); w.아니다(끊김); }
    기다림.clear();
  });
  return {
    열림,
    보냄(method, params = {}, sessionId, 기다림ms = 기본시간.명령) {
      if (끊김) return Promise.reject(끊김);
      return new Promise((맞다, 아니다) => {
        const id = ++번호;
        const 시계 = setTimeout(() => { 기다림.delete(id); 아니다(new Error(`${method}가 ${Math.round(기다림ms / 1000)}초 안에 답하지 않았다`)); }, 기다림ms);
        기다림.set(id, { 맞다, 아니다, 시계, method });
        try { ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
        catch (e) { clearTimeout(시계); 기다림.delete(id); 아니다(e); }
      });
    },
    듣기(method, fn) {
      if (!듣기들.has(method)) 듣기들.set(method, new Set());
      듣기들.get(method).add(fn);
      return () => 듣기들.get(method).delete(fn);
    },
    닫기() { try { ws.close(); } catch (_) { /* 이미 닫힘 */ } },
  };
}

/**
 * 크롬을 띄운다(headless, 빈 프로필). 배포 점검(CI)과 같게 WebGL은 SwiftShader로, 소리 자동 재생은 허용(소리는 끔).
 * 창 여럿을 함께 재므로 뒤 창 타이머를 늦추지 않는다. 반환 {cdp, 닫기()}. 크롬이 없거나 통로가 안 열리면 던진다.
 */
async function 크롬열기({ 실행파일 = null, 기다림ms = 20000 } = {}) {
  const 크롬 = 실행파일 || require('./크롬조종.js').크롬찾기();
  const 프로필 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-공개전점검-'));
  // 11-08 실측: 깃발 없이는 크롬이 띄울 때마다 최적화 안내 모델(약 3.5MB)을 받고 셰이더 캐시 · 분류 DB를 써서, 끝낼 때 그 쓰기와
  // 프로필 지우기가 겹쳐 프로필이 남았다(12번 중 5번) — 그 일들을 끄고, 지우기는 크롬이 끝난 뒤 여러 번 다시 해 본다.
  const 깃발 = [
    '--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-default-apps',
    '--disable-features=OptimizationHints,OptimizationGuideModelDownloading,OptimizationTargetPrediction,SegmentationPlatform,Translate,MediaRouter',
    '--disable-gpu-shader-disk-cache', '--disable-breakpad', '--metrics-recording-only', '--no-pings',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    '--remote-debugging-port=0', `--user-data-dir=${프로필}`, 'about:blank',
  ];
  const 아이 = spawn(크롬, 깃발, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let 끝남 = false;
  const 끝 = new Promise((r) => { 아이.once('exit', () => { 끝남 = true; r(); }); 아이.once('error', () => { 끝남 = true; r(); }); });
  const 치우기 = async () => {
    if (!끝남) { try { 아이.kill(); } catch (_) { /* 이미 끝남 */ } }
    let 시계;
    await Promise.race([끝, new Promise((r) => { 시계 = setTimeout(r, 5000); })]);
    clearTimeout(시계);
    // 크롬 곁 프로세스가 마지막 쓰기를 마칠 때까지 이벤트 고리를 막지 않고 다시 해 본다(최대 약 11초)
    await fs.promises.rm(프로필, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => { /* 청소 실패는 잰 결과와 무관 */ });
  };
  let cdp = null;
  try {
    const 주소 = await new Promise((맞다, 아니다) => {
      let 쌓임 = '';
      const 늦음 = setTimeout(() => 아니다(new Error(`크롬이 조종 통로를 ${Math.round(기다림ms / 1000)}초 안에 안 열었다`)), 기다림ms);
      아이.stderr.on('data', (d) => {
        쌓임 += d.toString();
        const m = 쌓임.match(/ws:[/][/][!-~]+/);
        if (m) { clearTimeout(늦음); 맞다(m[0]); }
      });
      아이.once('error', (e) => { clearTimeout(늦음); 아니다(new Error(`크롬을 못 띄웠다: ${e.message}`)); });
      아이.once('exit', (c) => { clearTimeout(늦음); 아니다(new Error(`크롬이 먼저 끝났다(rc=${c}) ${쌓임.slice(-300)}`)); });
    });
    cdp = cdp연결(주소);
    await cdp.열림;
  } catch (e) {
    if (cdp) cdp.닫기();
    await 치우기();
    throw e;
  }
  return {
    cdp,
    async 닫기() {
      await cdp.보냄('Browser.close', {}, undefined, 5000).catch(() => {});
      cdp.닫기();
      await 치우기();
    },
  };
}

const 원점빼기 = (s) => String(s == null ? '' : s).replace(/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/g, '');
/** 견줄 열쇠: 첫 줄에서 로컬 주소 · ?v= 토큰 · 줄:칸 번호를 뺀다(후보와 공개본은 포트 · 토큰 · 줄 번호가 다르다) */
const 열쇠로 = (s) => 원점빼기(s).split('\n')[0].replace(/\?v=[\w.-]+/g, '').replace(/:\d+(?::\d+)?(?=[)\s,]|$)/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
const 곳글 = (url, 줄) => (url ? `${원점빼기(url).replace(/\?v=[\w.-]+/, '')}${줄 != null ? `:${줄 + 1}` : ''}` : '');

function 예외글(d = {}) {
  const ex = d.exception || {};
  let 말 = ex.description || (ex.value !== undefined ? `${d.text || 'Uncaught'} ${typeof ex.value === 'string' ? ex.value : JSON.stringify(ex.value)}` : d.text || '알 수 없는 오류');
  if (/in promise/i.test(d.text || '') && !/in promise/i.test(말)) 말 = `(in promise) ${말}`;
  const 첫틀 = d.stackTrace && d.stackTrace.callFrames && d.stackTrace.callFrames[0];
  const 곳 = d.url ? 곳글(d.url, d.lineNumber) : 첫틀 ? 곳글(첫틀.url, 첫틀.lineNumber) : '';
  return { 말: 원점빼기(말).split('\n')[0].slice(0, 300), 곳, 열쇠: 열쇠로(말) };
}

function 콘솔글(p = {}) {
  const 말 = (p.args || []).map((a) => (a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : a.description || a.type || '')).join(' ') || p.type;
  const 첫틀 = p.stackTrace && p.stackTrace.callFrames && p.stackTrace.callFrames[0];
  return { 말: 원점빼기(말).split('\n')[0].slice(0, 300), 곳: 첫틀 ? 곳글(첫틀.url, 첫틀.lineNumber) : '', 열쇠: 열쇠로(말), 종류: p.type === 'assert' ? 'assert' : 'console.error' };
}

function 기록글(entry = {}) {
  const 말 = `${entry.text || ''}${entry.url ? ` ${원점빼기(entry.url)}` : ''}`;
  return { 말: 원점빼기(말).split('\n')[0].slice(0, 300), 곳: entry.url ? 곳글(entry.url) : '', 열쇠: 열쇠로(말), 종류: `브라우저 ${entry.source || '기록'}` };
}

/** 같은 열쇠는 한 번만(셈을 붙여) — 그리기 고리 안의 오류는 수백 번 난다 */
function 모으기(목록, x, 한도 = 30) {
  const 있던 = 목록.find((y) => y.열쇠 === x.열쇠);
  if (있던) { 있던.수 = (있던.수 || 1) + 1; return; }
  if (목록.length < 한도) 목록.push({ ...x, 수: 1 });
}

/**
 * 쪽 하나를 잰다(새 크롬 맥락 · 새 창). 반환 {주소, 실림, 상태?, 오류: [], 콘솔: [], axe: {좁은, 넓은}, 문제: null|이유, 초}.
 * axe 칸은 접근성검사.재기의 결과({어긴것, 원판못잼}) 또는 {오류}.
 */
async function 쪽재기({ 브라우저, 주소, 시간 = {}, 접근성 = require('../접근성검사.js') }) {
  const t = { ...기본시간, ...시간 };
  const { cdp } = 브라우저;
  const 시작 = Date.now();
  const 결과 = { 주소, 실림: false, 오류: [], 콘솔: [], axe: {}, 문제: null };
  let 맥락 = null, 창 = null, 세션 = null;
  const 끄기 = [];
  let 무너짐 = null;
  const 내것 = (s) => Boolean(세션) && s === 세션;
  const 잼 = async () => {
    ({ browserContextId: 맥락 } = await cdp.보냄('Target.createBrowserContext', { disposeOnDetach: true }));
    ({ targetId: 창 } = await cdp.보냄('Target.createTarget', { url: 'about:blank', browserContextId: 맥락, newWindow: true }));
    ({ sessionId: 세션 } = await cdp.보냄('Target.attachToTarget', { targetId: 창, flatten: true }));
    끄기.push(cdp.듣기('Runtime.exceptionThrown', (p, s) => { if (내것(s)) 모으기(결과.오류, 예외글(p.exceptionDetails)); }));
    끄기.push(cdp.듣기('Runtime.consoleAPICalled', (p, s) => { if (내것(s) && (p.type === 'error' || p.type === 'assert')) 모으기(결과.콘솔, 콘솔글(p)); }));
    끄기.push(cdp.듣기('Log.entryAdded', (p, s) => {
      if (!내것(s) || !p.entry || p.entry.level !== 'error' || /\/favicon\.ico(?:$|\?)/.test(p.entry.url || '')) return;
      모으기(결과.콘솔, 기록글(p.entry));
    }));
    끄기.push(cdp.듣기('Inspector.targetCrashed', (p, s) => { if (내것(s)) 무너짐 = '쪽이 무너졌다(렌더러 멈춤)'; }));
    let 실림풀기;
    const 실림 = new Promise((r) => { 실림풀기 = r; });
    끄기.push(cdp.듣기('Page.loadEventFired', (p, s) => { if (내것(s)) 실림풀기(true); }));
    const 보냄 = (m, p = {}, ms = t.명령) => cdp.보냄(m, p, 세션, ms);
    await 보냄('Page.enable');
    await 보냄('Runtime.enable');
    await 보냄('Log.enable');
    await 보냄('Inspector.enable').catch(() => {});
    await 보냄('Emulation.setDeviceMetricsOverride', { ...좁은, deviceScaleFactor: 1, mobile: false });
    const 감 = await 보냄('Page.navigate', { url: 주소 });
    if (감.errorText) throw new Error(`열지 못했다: ${감.errorText}`);
    let 실림시계;
    결과.실림 = await Promise.race([실림, new Promise((r) => { 실림시계 = setTimeout(() => r(false), t.실림); })]);
    clearTimeout(실림시계);
    await 잠깐(t.처음);
    const axe보냄 = (m, p) => 보냄(m, p, t.axe);
    const axe한번 = async () => { try { return await 접근성.재기(axe보냄, { 나타남ms: t.나타남 }); } catch (e) { return { 오류: String(e.message || e).split('\n')[0].slice(0, 200) }; } };
    결과.axe.좁은 = await axe한번();
    if (무너짐) throw new Error(무너짐);
    await 보냄('Emulation.setDeviceMetricsOverride', { ...넓은, deviceScaleFactor: 1, mobile: false });
    await 잠깐(t.바꾼뒤);
    결과.axe.넓은 = await axe한번();
    if (무너짐) throw new Error(무너짐);
  };
  try {
    let 시계;
    await Promise.race([잼(), new Promise((_, j) => { 시계 = setTimeout(() => j(new Error(`${Math.round(t.전체 / 1000)}초 안에 재기를 마치지 못했다`)), t.전체); })])
      .finally(() => clearTimeout(시계));
  } catch (e) {
    결과.문제 = String((e && e.message) || e).split('\n')[0].slice(0, 240);
  } finally {
    for (const f of 끄기) f();
    if (창) await cdp.보냄('Target.closeTarget', { targetId: 창 }, undefined, 5000).catch(() => {});
    if (맥락) await cdp.보냄('Target.disposeBrowserContext', { browserContextId: 맥락 }, undefined, 5000).catch(() => {});
  }
  결과.초 = Math.round((Date.now() - 시작) / 100) / 10;
  return 결과;
}

// ── 견주기 · 판정 ────────────────────────────────────────────────────────────

const html다듬기 = (h) => String(h || '').replace(/\?v=[\w.-]+/g, '').replace(/\s+/g, ' ').trim();
const 곳들 = (v) => (Array.isArray(v.곳) && v.곳.length ? v.곳 : (v.자리 || []).map((대상) => ({ 대상, html: '' })));

/**
 * axe 한 판(한 창 크기)을 앞 공개본과 견준다. 후보 · 공개: 접근성검사.재기 결과({어긴것}) · {오류} · null(새 쪽).
 * 공개본의 같은 규칙에서 같은 선택자, 없으면 같은 HTML 조각인 자리를 하나씩 지워 가며 남은 후보 자리를 새것으로 센다.
 * 반환 [{id, impact, help, 새곳: [{대상, html}], 있던곳, 모두, 견줌}] — 견줌이 거짓이면(공개본 없음 · 못 잼) 모든 자리가 새것이다.
 */
function axe견주기(후보, 공개) {
  const 견줌 = Boolean(공개 && Array.isArray(공개.어긴것));
  const 남은 = new Map();
  if (견줌) for (const v of 공개.어긴것) 남은.set(v.id, 곳들(v).map((n) => ({ 대상: n.대상, html: html다듬기(n.html), 씀: false })));
  const 결과 = [];
  for (const v of (후보 && Array.isArray(후보.어긴것) ? 후보.어긴것 : [])) {
    const 앞 = 남은.get(v.id) || [];
    const 새곳 = [];
    let 있던곳 = 0;
    for (const n of 곳들(v)) {
      const h = html다듬기(n.html);
      const 짝 = 앞.find((x) => !x.씀 && x.대상 === n.대상) || (h ? 앞.find((x) => !x.씀 && x.html && x.html === h) : null);
      if (짝) { 짝.씀 = true; 있던곳++; } else 새곳.push(n);
    }
    결과.push({ id: v.id, impact: v.impact || 'minor', help: v.help || '', 새곳, 있던곳, 모두: Number(v.n) || 곳들(v).length, 견줌 });
  }
  return 결과;
}

/** 같은 판을 두 번 잰 것을 합친다(오류 · 콘솔은 열쇠로, axe는 규칙마다 선택자로) — 앞 공개본 기준을 넓혀 가끔만 나는 것을 새것으로 막지 않게 */
function 잰것합치기(a, b) {
  if (!a || a.문제) return b;
  if (!b || b.문제) return a;
  const 합 = { ...a, 오류: [...(a.오류 || [])], 콘솔: [...(a.콘솔 || [])], axe: { ...(a.axe || {}) } };
  for (const e of b.오류 || []) if (!합.오류.some((x) => x.열쇠 === e.열쇠)) 합.오류.push(e);
  for (const e of b.콘솔 || []) if (!합.콘솔.some((x) => x.열쇠 === e.열쇠)) 합.콘솔.push(e);
  for (const 폭 of ['좁은', '넓은']) {
    const x = a.axe && a.axe[폭], y = b.axe && b.axe[폭];
    if (!x || x.오류 || !Array.isArray(x.어긴것)) { if (y) 합.axe[폭] = y; continue; }
    if (!y || y.오류 || !Array.isArray(y.어긴것)) continue;
    const 규칙 = new Map(x.어긴것.map((v) => [v.id, { ...v, 곳: [...곳들(v)] }]));
    for (const v of y.어긴것) {
      if (!규칙.has(v.id)) { 규칙.set(v.id, { ...v, 곳: [...곳들(v)] }); continue; }
      const g = 규칙.get(v.id);
      for (const n of 곳들(v)) if (!g.곳.some((m) => m.대상 === n.대상)) g.곳.push(n);
      g.n = Math.max(Number(g.n) || 0, g.곳.length);
    }
    합.axe[폭] = { ...x, 어긴것: [...규칙.values()] };
  }
  return 합;
}

/** 잡히지 않은 오류 · 콘솔 오류를 앞 공개본과 견준다(열쇠 모음). 공개 null이면(새 쪽 · 못 잼) 모두 새것. 반환 {새, 있던} */
function 오류견주기(후보 = [], 공개 = null) {
  const 앞 = new Set((공개 || []).map((e) => e.열쇠));
  const 새 = [], 있던 = [];
  for (const e of 후보 || []) (공개 && 앞.has(e.열쇠) ? 있던 : 새).push(e);
  return { 새, 있던 };
}

const 무게말 = { critical: '치명', serious: '심각', moderate: '보통', minor: '가벼움' };
const 폭말 = { 좁은: '390', 넓은: '1440' };
const 짧게 = (s, n = 80) => { const t = String(s || ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const 오류한줄 = (e) => `${짧게(e.말, 140)}${e.곳 ? ` (${짧게(e.곳, 60)})` : ''}${e.수 > 1 ? ` ×${e.수}` : ''}`;

/**
 * 쪽마다 후보 · 공개본 잰 것을 견줘 걸림 · 알림을 낸다. 쪽결과들: [{쪽, 후보, 공개본}] (공개본: 새 쪽이면 null)
 * 반환 {걸림, 알림, 쪽: [요약]}
 */
function 판정(쪽결과들) {
  const 걸림 = [], 알림 = [], 쪽 = [];
  const 막기 = (경로, 이유) => 걸림.push({ 경로, 검사: 검사이름, 이유 });
  const 알리기 = (경로, 이유) => 알림.push({ 경로, 검사: 검사이름, 이유 });
  for (const { 쪽: 그쪽, 후보: c, 공개본: p } of 쪽결과들) {
    const 경로 = 그쪽.경로;
    const 요약 = { 경로, 주소: 그쪽.주소, 까닭: 그쪽.까닭, 새쪽: Boolean(그쪽.새쪽), ...(그쪽.부른 ? { 부른: 그쪽.부른 } : {}) };
    쪽.push(요약);
    const 공개잼 = p && !p.문제 ? p : null;
    if (!c || c.문제) {
      const 이유 = c ? c.문제 : '재지 못했다';
      요약.문제 = 이유;
      if (공개잼) 막기(경로, `후보 쪽을 재지 못했다 — ${이유} (공개본의 같은 쪽은 쟀다 — 이번 판이 쪽을 멈추게 했을 수 있다)`);
      else if (그쪽.새쪽) 막기(경로, `새 쪽을 재지 못했다 — ${이유} (다시 미리 보거나, 쪽이 아니라 이 PC 사정이 분명하면 ${건너뜀옵션} "<까닭>")`);
      else 알리기(경로, `못 잼 — 후보 · 공개본 모두 재지 못했다(${이유}) · 막지 않았다`);
      continue;
    }
    if (p && p.문제) 알리기(경로, `앞 공개본을 재지 못해(${p.문제}) 견주지 못했다 — 후보의 오류 · 치명 위반을 모두 새것으로 봤다`);
    // 1) 잡히지 않은 오류
    const 오 = 오류견주기(c.오류, 공개잼 ? 공개잼.오류 : null);
    요약.오류 = { 모두: (c.오류 || []).length, 새: 오.새.length };
    if (오.새.length) {
      막기(경로, `직접 열기(처음 3초 + 창 390→1440)에서 잡히지 않은 오류 ${오.새.length}가지${공개잼 ? '(앞 공개본의 같은 쪽에는 없던 것)' : 그쪽.새쪽 ? '(새 쪽)' : ''}: ${오.새.slice(0, 3).map(오류한줄).join(' / ')}${오.새.length > 3 ? ' …' : ''}`);
    }
    if (오.있던.length) 알리기(경로, `잡히지 않은 오류 ${오.있던.length}가지는 앞 공개본에서도 같게 나 막지 않았다: ${오.있던.slice(0, 2).map(오류한줄).join(' / ')}`);
    // 2) axe — 두 창 크기를 합쳐 규칙마다 센다
    const 규칙 = new Map(); // id → {impact, help, 새곳: Map(대상 → 폭들), 있던곳, 모두}
    const axe못돎 = [];
    for (const 폭 of ['좁은', '넓은']) {
      const ca = c.axe && c.axe[폭];
      if (!ca || ca.오류) { axe못돎.push(`${폭말[폭]}: ${ca ? ca.오류 : '안 돎'}`); continue; }
      const pa = 공개잼 && 공개잼.axe ? 공개잼.axe[폭] : null;
      if (공개잼 && (!pa || pa.오류)) axe못돎.push(`${폭말[폭]} 공개본: ${pa ? pa.오류 : '안 돎'} — 이 폭은 모든 위반을 새것으로 봤다`);
      for (const r of axe견주기(ca, 공개잼 ? pa : null)) {
        if (!규칙.has(r.id)) 규칙.set(r.id, { impact: r.impact, help: r.help, 새곳: new Map(), 있던곳: 0, 모두: 0 });
        const g = 규칙.get(r.id);
        for (const n of r.새곳) { const k = n.대상 || n.html || '?'; if (!g.새곳.has(k)) g.새곳.set(k, []); g.새곳.get(k).push(폭말[폭]); }
        g.있던곳 = Math.max(g.있던곳, r.있던곳);
        g.모두 = Math.max(g.모두, r.모두);
      }
    }
    const 셈 = { 치명: 0, 새치명: 0, 그밖새: 0 };
    const 새치명줄 = [], 그밖줄 = [], 있던치명줄 = [];
    for (const [id, g] of 규칙) {
      const 새수 = g.새곳.size;
      const 예 = [...g.새곳].slice(0, 2).map(([k, 폭들]) => `${짧게(k, 70)}(${[...new Set(폭들)].join('·')})`).join(' , ');
      if (g.impact === 'critical') {
        셈.치명 += g.모두;
        셈.새치명 += 새수;
        if (새수) 새치명줄.push(`${id} 새 ${새수}곳${g.있던곳 ? ` · 공개본에도 있던 ${g.있던곳}곳` : ''} — 예: ${예}`);
        else if (g.있던곳) 있던치명줄.push(`${id} ${g.있던곳}곳`);
      } else if (새수) {
        셈.그밖새 += 새수;
        그밖줄.push(`${무게말[g.impact] || g.impact} ${id} 새 ${새수}곳(예: ${짧게([...g.새곳.keys()][0], 60)})`);
      }
    }
    요약.axe = 셈;
    if (새치명줄.length) 막기(경로, `axe 치명 위반${공개잼 ? '(앞 공개본에 없던 자리)' : 그쪽.새쪽 ? '(새 쪽)' : ''}: ${새치명줄.join(' / ')}`);
    if (있던치명줄.length) 알리기(경로, `axe 치명 위반 ${있던치명줄.join(', ')}은 앞 공개본에도 같은 자리에 있어 막지 않았다`);
    if (그밖줄.length) 알리기(경로, `axe 새 위반(막지 않음): ${그밖줄.slice(0, 4).join(' · ')}${그밖줄.length > 4 ? ` … 외 ${그밖줄.length - 4}가지` : ''}`);
    if (axe못돎.length) 알리기(경로, `axe를 다 돌리지 못했다 — ${axe못돎.join(' · ')}`);
    // 3) console.error · 브라우저 오류 기록(404 · CSP) — 알림만
    const 콘 = 오류견주기(c.콘솔, 공개잼 ? 공개잼.콘솔 : null);
    요약.콘솔 = { 모두: (c.콘솔 || []).length, 새: 콘.새.length };
    if (콘.새.length) 알리기(경로, `console.error · 브라우저 오류 ${콘.새.length}가지${공개잼 ? '(앞 공개본에 없던 것)' : ''}(막지 않음): ${콘.새.slice(0, 2).map(오류한줄).join(' / ')}${콘.새.length > 2 ? ' …' : ''}`);
    if (!c.실림) 알리기(경로, `load가 ${Math.round(기본시간.실림 / 1000)}초 안에 안 와 그 상태로 쟀다`);
  }
  return { 걸림, 알림, 쪽 };
}

async function 풀어서(일들, 동시, 하기) {
  const 결과 = new Array(일들.length);
  let 다음 = 0;
  await Promise.all(Array.from({ length: Math.min(동시, 일들.length) }, async () => {
    while (다음 < 일들.length) { const i = 다음++; 결과[i] = await 하기(일들[i], i); }
  }));
  return 결과;
}

/**
 * 공개 도구가 부르는 입구. 항목들: 후보 항목(최종 바이트). 후보읽기 · 공개읽기(공개경로) → Buffer | null | {못실음}(async 됨).
 * 후보있나(p): 후보 트리에 있나(가까운 쪽). 건너뜀: 사람이 밝힌 까닭(있으면 재지 않는다).
 * 재기(일): 시험이 크롬 대신 쓴다 — 일 {쪽, 판: '후보'|'공개본', 주소} → 쪽재기 결과 꼴. 브라우저열기: 크롬 열기를 바꿔 끼운다(시험).
 * 반환 {결과: '통과'|'걸림'|'못 잼'|'건너뜀'|'볼 쪽 없음', 쪽, 빠짐, 걸림, 알림, 초, 이유?, 까닭?}
 */
async function 점검하기({ 항목들, 후보읽기, 공개읽기, 후보있나 = () => false, 건너뜀 = null, 재기 = null, 브라우저열기 = 크롬열기, 알리기 = () => {}, 동시 = 3, 시간 = {} }) {
  const 시작 = Date.now();
  const { 쪽들, 빠짐 } = 쪽고르기(항목들, { 후보있나 });
  const 쪽목록 = 쪽들.map((x) => ({ 경로: x.경로, 주소: x.주소, 까닭: x.까닭, 새쪽: x.새쪽, ...(x.부른 ? { 부른: x.부른 } : {}) }));
  const 빠짐알림 = 빠짐.map((x) => ({ 경로: x.경로, 검사: 검사이름, 이유: `재지 않음 — ${x.이유}` }));
  const 초 = () => Math.round((Date.now() - 시작) / 1000);
  if (!쪽들.length) return { 결과: '볼 쪽 없음', 쪽: [], 빠짐, 걸림: [], 알림: 빠짐알림, 초: 0 };
  const 쪽이름들 = `${쪽들.slice(0, 4).map((x) => x.주소).join(', ')}${쪽들.length > 4 ? ' …' : ''}`;
  if (건너뜀) {
    return { 결과: '건너뜀', 까닭: 건너뜀, 쪽: 쪽목록, 빠짐, 걸림: [],
      알림: [{ 검사: 검사이름, 이유: `건너뜀 — ${건너뜀} (쪽 ${쪽들.length}개 ${쪽이름들}를 재지 않았다 · 까닭은 커밋 메시지에 남는다)` }, ...빠짐알림], 초: 0 };
  }
  const 서버 = { 후보: null, 공개본: null };
  let 브라우저 = null;
  try {
    서버.후보 = await 정적서버(후보읽기);
    서버.공개본 = await 정적서버(공개읽기);
    let 잼 = 재기;
    if (!잼) {
      try {
        브라우저 = await 브라우저열기();
      } catch (e) {
        const 이유 = String((e && e.message) || e).split('\n')[0].slice(0, 200);
        return { 결과: '못 잼', 이유, 브라우저못엶: true, 쪽: 쪽목록, 빠짐, 걸림: [],
          알림: [{ 검사: 검사이름, 이유: `못 잼 — ${이유} · 쪽 ${쪽들.length}개(${쪽이름들})를 재지 못했고 막지 않았다(크롬이 있는 PC에서 다시 미리 보면 잰다)` }, ...빠짐알림], 초: 초() };
      }
      잼 = (일) => 쪽재기({ 브라우저, 주소: 일.주소, 시간 });
    }
    const 일들 = 쪽들.flatMap((쪽) => [
      { 쪽, 판: '후보', 주소: `${서버.후보.주소}${쪽.주소}` },
      ...(쪽.새쪽 ? [] : [{ 쪽, 판: '공개본', 주소: `${서버.공개본.주소}${쪽.주소}` }]),
    ]);
    알리기(`공개 전 점검: 쪽 ${쪽들.length}개(후보 · 공개본 ${일들.length}번)를 로컬에서 직접 열어 잰다`);
    let 끝낸 = 0;
    const 잰것 = await 풀어서(일들, Math.max(1, 동시), async (일) => {
      let r;
      try { r = await 잼(일); } catch (e) { r = { 주소: 일.주소, 문제: String((e && e.message) || e).split('\n')[0].slice(0, 240), 오류: [], 콘솔: [], axe: {} }; }
      끝낸++;
      알리기(`공개 전 점검 ${끝낸}/${일들.length} ${일.판} ${일.쪽.주소}${r && r.문제 ? ` — 못 잼: ${r.문제}` : ''}`);
      return { 일, r };
    });
    const 쪽결과들 = 쪽들.map((쪽) => ({
      쪽,
      후보: (잰것.find((x) => x.일.쪽 === 쪽 && x.일.판 === '후보') || {}).r || null,
      공개본: 쪽.새쪽 ? null : (잰것.find((x) => x.일.쪽 === 쪽 && x.일.판 === '공개본') || {}).r || null,
    }));
    let 판 = 판정(쪽결과들);
    // 막힌 쪽은 앞 공개본을 한 번 더 재 합친다 — 공개본에서도 가끔만 나는 오류 · 위반을 이번 공개의 새것으로 막지 않게.
    // 공개본 첫 잼이 「못 잼」이었던 쪽도 다시 잰다 — 그대로 두면 견줄 판이 없어 공개본에도 있던 오류까지 모두 새것으로 막는다(11-08 Claude 검토).
    const 다시볼 = 쪽결과들.filter((x) => x.공개본 && 판.걸림.some((g) => g.경로 === x.쪽.경로));
    if (다시볼.length) {
      알리기(`공개 전 점검: 막힌 쪽 ${다시볼.length}개의 앞 공개본을 한 번 더 잰다`);
      const 또 = await 풀어서(다시볼, Math.max(1, 동시), async (x) => {
        try { return await 잼({ 쪽: x.쪽, 판: '공개본', 주소: `${서버.공개본.주소}${x.쪽.주소}`, 다시: true }); } catch (_) { return null; }
      });
      다시볼.forEach((x, i) => { x.공개본 = 잰것합치기(x.공개본, 또[i]) || x.공개본; });
      판 = 판정(쪽결과들);
    }
    // 잰 쪽이 부르지 않은 바뀐 스크립트 · 스타일 · 데이터 — 이 점검이 못 본 곳을 분모로 밝힌다
    const 불린 = new Set(서버.후보.요청.filter((x) => x.상태 < 400).map((x) => x.경로));
    const 안불림 = (항목들 || []).filter((x) => x && x.버퍼 && 스크립트꼴.test(x.경로) && 나가는경로(x.경로) && !불린.has(x.경로)).map((x) => x.경로);
    if (안불림.length && 쪽결과들.some((x) => x.후보 && !x.후보.문제)) {
      판.알림.push({ 검사: 검사이름, 이유: `바뀐 스크립트 · 스타일 · 데이터 ${안불림.length}개는 잰 쪽이 처음 3초 · 크기 바꿈 동안 부르지 않아 이 점검이 못 봤다: ${안불림.slice(0, 4).join(', ')}${안불림.length > 4 ? ' …' : ''}` });
    }
    const 못실음 = [...new Set([...서버.후보.요청, ...서버.공개본.요청].filter((x) => x.못실음).map((x) => x.경로))];
    if (못실음.length) 판.알림.push({ 검사: 검사이름, 이유: `사본에 없는 큰 영상 · 소리 ${못실음.length}개는 받지 않고 404로 두었다: ${못실음.slice(0, 3).join(', ')}${못실음.length > 3 ? ' …' : ''}` });
    판.알림.push(...빠짐알림);
    const 다못잼 = 쪽결과들.every((x) => !x.후보 || x.후보.문제);
    return {
      결과: 판.걸림.length ? '걸림' : 다못잼 ? '못 잼' : '통과', 쪽: 판.쪽, 빠짐, 걸림: 판.걸림, 알림: 판.알림, 초: 초(),
      ...(다못잼 && !판.걸림.length ? { 이유: '고른 쪽을 하나도 재지 못했다' } : {}),
    };
  } finally {
    if (브라우저) await 브라우저.닫기().catch(() => {});
    for (const s of Object.values(서버)) if (s) await s.닫기().catch(() => {});
  }
}

/** 미리 보기 글 줄 */
function 점검글(r) {
  if (!r) return [];
  if (r.결과 === '볼 쪽 없음') return ['공개 전 점검 — 바뀐 HTML 쪽이 없어 재지 않았다'];
  if (r.결과 === '건너뜀') return [`공개 전 점검 — 건너뜀: ${r.까닭} (쪽 ${(r.쪽 || []).length}개를 재지 않았다)`];
  if (r.브라우저못엶) return [`공개 전 점검 — 못 잼: ${r.이유} · 막지 않았다(쪽 ${(r.쪽 || []).length}개)`];
  const 쪽 = r.쪽 || [];
  const 새 = 쪽.filter((x) => x.새쪽).length, 가까운 = 쪽.filter((x) => x.까닭 === '가까운 쪽').length;
  const 덧 = [새 ? `새 ${새}` : '', 가까운 ? `가까운 쪽 ${가까운}` : ''].filter(Boolean).join(' · ');
  const 줄 = [`공개 전 점검 — ${r.결과} · 쪽 ${쪽.length}개${덧 ? `(${덧})` : ''}를 후보 · 앞 공개본으로 로컬에서 직접 열어 잼(처음 3초 + 창 390→1440 · axe 치명과 잡히지 않은 오류는 새것만 막음) · ${r.초}초`];
  for (const x of 쪽.slice(0, 20)) {
    if (x.문제) { 줄.push(`  ${x.주소}  ${x.새쪽 ? '새 쪽 · ' : ''}못 잼: ${x.문제}`); continue; }
    const o = x.오류 || { 모두: 0, 새: 0 }, a = x.axe || { 치명: 0, 새치명: 0, 그밖새: 0 }, k = x.콘솔 || { 모두: 0, 새: 0 };
    줄.push(`  ${x.주소}  ${x.새쪽 ? '새 쪽' : x.까닭 === '가까운 쪽' ? `가까운 쪽(${x.부른})` : x.까닭} · 잡히지 않은 오류 ${o.모두}(새 ${o.새}) · axe 치명 ${a.치명}(새 ${a.새치명}) · 그밖 새 위반 ${a.그밖새} · console.error ${k.모두}(새 ${k.새})`);
  }
  if (쪽.length > 20) 줄.push(`  … 외 ${쪽.length - 20}쪽`);
  if (r.결과 === '걸림') 줄.push(`  막음 — 아래 걸림을 고쳐 다시 미리 본다. 의도한 것이거나 이 점검이 틀렸으면 ${건너뜀옵션} "<까닭>"(까닭은 커밋 메시지에 남는다)`);
  return 줄;
}

/** --실행 커밋 메시지 끝에 건너뛴 까닭을 남긴다(바로올리기 --시험건너뜀과 같은 꼴) */
function 메시지덧(메시지, 까닭) {
  const 글 = String(메시지 || '').replace(/\s+$/, '');
  return 까닭 ? `${글}\n\n공개 전 점검 건너뜀: ${String(까닭).trim()}` : 글;
}

module.exports = {
  점검하기, 쪽고르기, 정적서버, 길풀기, 크롬열기, 쪽재기, cdp연결, axe견주기, 오류견주기, 잰것합치기, 판정, 점검글, 메시지덧,
  열쇠로, 주소로, 나가는경로, 검사이름, 건너뜀옵션, 기본시간,
};
