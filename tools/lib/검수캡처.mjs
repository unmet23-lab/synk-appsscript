// 검수 묶음의 전후 캡처(2026-10-21, tools/검수묶음.mjs). 화면마다 바탕 판(전)과 지금 판(후)을 1440·390 폭으로 띄워
// 전체 화면 그림·보이는 글·콘솔 오류·실패한 요청·가로 넘침을 남기고, 전후 그림 차이를 odiff로 잰다.
// 「전」은 같은 서버에서 바뀐 파일만 바탕 판 바이트로 바꿔 내려 준다(context.route). 서버가 만들어 주는 글·자료는 전후 모두 지금 판이다.
// 바꿔 내려 주는 것은 이 PC 주소(127.0.0.1·localhost)뿐이고 밖의 사이트 요청은 건드리지 않는다.
// 그림은 두 번 잇달아 같게 나올 때까지 기다렸다 찍는다(늦게 뜨는 그림·나타나기 효과 — 10-21 synk.im 두 회차 견줌에서 /world/가 한 번은 검은 화면이었다).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export const 기기들 = [
  { 이름: '1440', 설정: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { 이름: '390', 설정: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
];
export const 최대높이 = 16000;
const 형식표 = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream',
};
export const 형식of = p => 형식표[path.extname(p).toLowerCase()] || 'application/octet-stream';
const 이PC = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** 저장소 폴더를 그대로 내주는 정적 서버(이 PC만). 폴더 주소는 끝 / 로 돌려보내 상대 경로가 맞게 한다. */
export function 정적서버(뿌리) {
  const 바닥 = path.resolve(뿌리);
  const 서버 = http.createServer((req, res) => {
    let 경로;
    try { 경로 = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
    let 파일 = path.resolve(바닥, '.' + 경로);
    if (파일 !== 바닥 && !파일.startsWith(바닥 + path.sep)) { res.writeHead(403); res.end(); return; }
    let 폴더 = false;
    try { 폴더 = fs.statSync(파일).isDirectory(); } catch { /* 없음 */ }
    if (폴더 && !경로.endsWith('/')) { res.writeHead(301, { location: encodeURI(경로 + '/') }); res.end(); return; }
    if (폴더) 파일 = path.join(파일, 'index.html');
    fs.readFile(파일, (e, 몸) => {
      if (e) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('없음'); return; }
      res.writeHead(200, { 'content-type': 형식of(파일), 'cache-control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : 몸);
    });
  });
  return new Promise((resolve, reject) => {
    서버.once('error', reject);
    서버.listen(0, '127.0.0.1', () => resolve({ 주소: `http://127.0.0.1:${서버.address().port}`, 닫기: () => new Promise(r => { 서버.closeAllConnections?.(); 서버.close(r); }) }));
  });
}

/**
 * 주소 → 저장소 경로. 이 PC 주소만 본다. 이 도구의 정적 서버면 경로 그대로, --주소뿌리(<주소 앞>=<저장소 경로 앞>)에 맞으면 그 앞을 바꾸고,
 * 그 밖에는 바뀐 파일 가운데 주소 경로로 끝나는 것이 하나뿐일 때 그것으로 본다(여럿이면 헷갈림으로 남긴다).
 */
export function 경로찾기만들기({ 정적주소 = null, 주소뿌리 = [], 바뀐경로들 = [], 헷갈림 = new Set() }) {
  const 정적 = 정적주소 ? new URL(정적주소).origin : null;
  return 주소 => {
    let u;
    try { u = new URL(주소); } catch { return null; }
    if (!이PC.has(u.hostname)) return null;
    let 길;
    try { 길 = decodeURIComponent(u.pathname); } catch { return null; }
    if (길.endsWith('/')) 길 += 'index.html';
    if (정적 && u.origin === 정적) return 길.replace(/^\/+/, '');
    for (const [앞, 저장소앞] of 주소뿌리) {
      const 앞u = new URL(앞);
      const 앞길 = decodeURIComponent(앞u.pathname);
      // 경로 경계에서만 맞춘다(/app이 /apple/…에 맞지 않게). 저장소 쪽은 Windows 역슬래시도 받는다.
      const 맞음 = 앞길.endsWith('/') ? 길.startsWith(앞길) : 길 === 앞길 || 길.startsWith(`${앞길}/`);
      if (u.origin === 앞u.origin && 맞음) return (저장소앞.replace(/\\/g, '/').replace(/\/?$/, '/') + 길.slice(앞길.length).replace(/^\/+/, '')).replace(/^\/+/, '');
    }
    const 맞음 = 바뀐경로들.filter(p => ('/' + p).endsWith(길));
    if (맞음.length === 1) return 맞음[0];
    if (맞음.length > 1) 헷갈림.add(`${길} → ${맞음.slice(0, 3).join(', ')}`);
    return null;
  };
}

/** 그 판 바이트로 바꿔 내려 준다. 판보기(경로): undefined = 안 바뀜(서버대로), null = 그 판에 없음(404), Buffer = 그 판 바이트. */
export async function 판입히기(context, { 판보기, 경로찾기, 기록, 못푼 = [] }) {
  await context.route('**/*', async route => {
    let 경로, 몸;
    // 처리기 안 예외는 잡히지 않은 거절이 되어 준비가 죽고 요청은 시간 초과까지 멈춘다 — 못 푼 요청은 그대로 넘기고 적는다
    try { 경로 = 경로찾기(route.request().url()); 몸 = 경로 ? 판보기(경로) : undefined; }
    catch (e) { 못푼.push(`${route.request().url()}: ${String(e).split('\n')[0].slice(0, 160)}`); return route.continue(); }
    if (몸 === undefined) return route.continue();
    기록.add(경로);
    if (몸 === null) return route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: '그 판에 없음' });
    return route.fulfill({ status: 200, contentType: 형식of(경로), body: 몸, headers: { 'cache-control': 'no-store' } });
  });
}

export async function 브라우저열기() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { throw new Error('playwright를 못 찾았다 — 공용 작업본에서 npm ci를 한 번 돌린다(package.json devDependencies)'); }
  try { return await chromium.launch({ channel: 'chrome', headless: true }); }
  catch { return chromium.launch({ headless: true }); }
}

async function 맥락열기(browser, 기기, 판, 시각) {
  const context = await browser.newContext({ ...기기.설정, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', serviceWorkers: 'block' });
  if (시각) await context.clock.setFixedTime(new Date(시각));
  const 덧기록 = new Set();
  if (판.덧) await 판입히기(context, { ...판.덧, 기록: 덧기록 });
  const 오류 = [];
  // 같은 곳(origin)의 실패만 센다 — 첫 문서 응답은 페이지 주소가 아직 about:blank라 연 주소(상태.기준)로 본다.
  const 상태 = { 기준: null };
  const 같은곳 = (a, b) => { try { return new URL(a).origin === new URL(b).origin; } catch { return false; } };
  const page = await context.newPage();
  const 곳 = () => 상태.기준 || page.url();
  const 짧게 = u => { try { const x = new URL(u); return 같은곳(u, 곳()) ? x.pathname + x.search : u; } catch { return u; } };
  // 주 문서 응답은 곳과 상관없이 센다(--장면이 연 첫 문서는 이때 page.url()이 아직 about:blank)
  const 주문서 = r => { try { return r.request().isNavigationRequest() && r.frame() === page.mainFrame(); } catch { return false; } };
  context.on('response', r => { if (r.status() >= 400 && (주문서(r) || 같은곳(r.url(), 곳())) && !/\/favicon\.ico$/.test(r.url())) 오류.push(`HTTP ${r.status()} ${짧게(r.url())}`); });
  context.on('requestfailed', q => { const e = q.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(e) && 같은곳(q.url(), 곳())) 오류.push(`요청 실패 ${짧게(q.url())} ${e}`); });
  page.on('console', m => { if (m.type() === 'error') 오류.push(`콘솔 ${m.text().replace(/\s+/g, ' ').slice(0, 300)}`); });
  page.on('pageerror', e => 오류.push(`페이지 오류 ${String(e).split('\n')[0].slice(0, 300)}`));
  return { context, page, 오류, 덧기록, 상태 };
}

/** 글꼴·늦게 뜨는 그림을 기다리고 끝까지 한 번 훑는다(스크롤로 나타나는 지면). */
export async function 가라앉히기(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts?.ready;
    const 끝 = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    for (let y = 0; y < 끝; y += Math.max(400, innerHeight * 0.8)) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); }
    scrollTo(0, 0);
    await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => {
      i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 4000);
    })));
  }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
}

/** 두 번 잇달아 같은 그림이 나올 때까지(최대 횟수) 찍는다. 끝내 같지 않으면 흔들림으로 남긴다. */
export async function 안정된그림(page, 찍는법, { 횟수 = 6, 간격 = 500 } = {}) {
  let 앞 = await page.screenshot(찍는법);
  for (let i = 1; i < 횟수; i++) {
    await page.waitForTimeout(간격);
    const 뒤 = await page.screenshot(찍는법);
    if (뒤.equals(앞)) return { 그림: 뒤, 흔들림: false, 찍은수: i + 1 };
    앞 = 뒤;
  }
  return { 그림: 앞, 흔들림: true, 찍은수: 횟수 };
}

async function 한장(page, { 폴더, 판, 기기, 이름, 오류 }) {
  await 가라앉히기(page);
  const 잼 = await page.evaluate(() => ({ inner: innerWidth, visual: Math.round(visualViewport?.width || innerWidth), scroll: document.documentElement.scrollWidth,
    높이: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0), 글: document.body ? document.body.innerText : '' }));
  const 넘침 = 잼.scroll > 잼.inner + 1 || 잼.inner > 잼.visual + 1 ? `${잼.scroll}/${잼.inner}/${잼.visual}` : null;
  const 폭 = 기기.설정.viewport.width;
  const 찍는법 = { fullPage: true, animations: 'disabled', caret: 'hide', ...(잼.높이 > 최대높이 ? { clip: { x: 0, y: 0, width: 폭, height: 최대높이 } } : {}) };
  const { 그림, 흔들림 } = await 안정된그림(page, 찍는법);
  const 파일 = path.join(폴더, 판, 기기.이름, `${이름}.png`);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 그림);
  fs.writeFileSync(파일.replace(/\.png$/, '.txt'), 잼.글);
  return { 이름, 판, 기기: 기기.이름, 주소: page.url(), 그림: 파일, 넘침, 높이: 잼.높이, 잘림: 잼.높이 > 최대높이, 흔들림, 글길이: 잼.글.length, 글sha: sha(잼.글).slice(0, 12), 오류: [...new Set(오류)] };
}

/**
 * 화면들([{이름, 주소: {전, 후}}])을 판마다·기기마다 찍는다. 판들: [{이름: '전'|'후', 덧: {판보기, 경로찾기} | null}].
 * 장면(함수)을 주면 화면마다 열지 않고 판·기기마다 한 번 부른다: 장면({page, 찍기, 판, 기기, 주소들}) — 찍기(이름)가 그때 화면을 남긴다.
 */
export async function 찍기({ 화면들 = [], 장면 = null, 판들, 폴더, 시각 = null, 열기 = 브라우저열기, 알리기 = () => {} }) {
  const browser = await 열기();
  const 장들 = [], 덧쓴 = new Set(), 못연 = [];
  try {
    for (const 판 of 판들) for (const 기기 of 기기들) {
      const 차례 = 장면 ? [{ 이름: null }] : 화면들;
      for (const 화면 of 차례) {
        const m = await 맥락열기(browser, 기기, 판, 시각);
        const 쓴이름 = new Set();
        try {
          // 장면이 같은 이름으로 또 찍으면 -2·-3을 붙인다(그림을 덮지 않게)
          const 찍음 = async 이름 => {
            const 바탕이름 = 이름표(이름);
            let 붙임 = 바탕이름;
            for (let k = 2; 쓴이름.has(붙임); k++) 붙임 = `${바탕이름}-${k}`;
            쓴이름.add(붙임);
            const r = await 한장(m.page, { 폴더, 판: 판.이름, 기기, 이름: 붙임, 오류: m.오류 });
            장들.push(r);
            return r;
          };
          if (장면) {
            const 주소들 = Object.fromEntries(화면들.map(x => [x.이름, x.주소[판.이름]]));
            await 장면({ page: m.page, 찍기: 찍음, 판: 판.이름, 기기: 기기.이름, 주소들 });
          } else {
            m.상태.기준 = 화면.주소[판.이름];
            await m.page.goto(화면.주소[판.이름], { waitUntil: 'load', timeout: 60000 });
            m.상태.기준 = null;
            await 찍음(화면.이름);
          }
        } catch (e) {
          못연.push({ 판: 판.이름, 기기: 기기.이름, 화면: 화면.이름, 오류: String(e).split('\n')[0].slice(0, 300) });
          알리기(`캡처 실패 ${판.이름} ${기기.이름} ${화면.이름 || '장면'}: ${String(e).split('\n')[0].slice(0, 160)}`);
        } finally {
          for (const p of m.덧기록) 덧쓴.add(p);
          await m.context.close();
        }
      }
    }
  } finally { await browser.close(); }
  const 차이들 = await 견주기(장들, 폴더);
  return { 장들, 차이들, 덧쓴: [...덧쓴].sort(), 못연 };
}

export const 이름표 = 이름 => String(이름 || '화면').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);

/** 같은 기기·이름의 전과 후를 odiff로 견준다. 차이 그림은 차이/<기기>/<이름>.png. 위에서 몇 px부터 달라졌는지(CSS px)도 남긴다. */
export async function 견주기(장들, 폴더) {
  let compare;
  try { ({ compare } = require('odiff-bin')); } catch { return [{ 오류: 'odiff-bin을 못 찾았다 — 공용 작업본에서 npm ci' }]; }
  const 차이들 = [];
  for (const 후 of 장들.filter(x => x.판 === '후')) {
    const 전 = 장들.find(x => x.판 === '전' && x.기기 === 후.기기 && x.이름 === 후.이름);
    if (!전) continue;
    const 배율 = 기기들.find(d => d.이름 === 후.기기)?.설정.deviceScaleFactor || 1;
    const 파일 = path.join(폴더, '차이', 후.기기, `${후.이름}.png`);
    fs.mkdirSync(path.dirname(파일), { recursive: true });
    let r;
    try { r = await compare(전.그림, 후.그림, 파일, { threshold: 0.1, antialiasing: true, captureDiffLines: true, diffOverlay: true, noFailOnFsErrors: true }); }
    catch (e) { 차이들.push({ 이름: 후.이름, 기기: 후.기기, 같음: false, 퍼센트: null, 이유: `견주지 못함: ${String(e).split('\n')[0].slice(0, 160)}`, 그림: null, 높이: { 전: 전.높이, 후: 후.높이 } }); continue; }
    차이들.push({ 이름: 후.이름, 기기: 후.기기, 같음: r.match, 퍼센트: r.match ? 0 : r.diffPercentage ?? null, 이유: r.match ? null : r.reason,
      ...(r.diffLines?.length ? { 위: Math.round(r.diffLines[0] / 배율), 아래: Math.round(r.diffLines.at(-1) / 배율) } : {}),
      그림: r.match ? null : 파일, 높이: { 전: 전.높이, 후: 후.높이 } });
    if (r.match) fs.rmSync(파일, { force: true });
  }
  return 차이들;
}

/** 전·후 보이는 글의 바뀐 줄(git diff --no-index, 앞뒤 한 줄). 같으면 빈 글. */
export function 글차이(전파일, 후파일) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', 'diff', '--no-index', '--no-color', '-U1', '--', 전파일, 후파일], { encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true });
  if (r.status === 0) return '';
  return String(r.stdout || '').split('\n').filter(l => !/^(diff --git|index |--- |\+\+\+ )/.test(l)).join('\n').trim();
}
