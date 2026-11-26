// 맞춤 앞면 얼굴 원의 「내 사진」 시험: 실제 앱(로컬 WORLD 리허설 서버) · 실제 앞면 다리 · 실제 틀에 가짜 제2의 나 status만 물린다.
//   node experiences/world-front/qa/내사진.mjs [--폭 390x844] [--찍기]   → 캡처는 .tmp/world-front-qa/내사진/
// 운영 계정 · talk · 학생 사진을 쓰지 않는다. 「고른 사진」은 시험이 그린 1152×1536 그림(얼굴 자리에 둥근 판)을 운영 저장소 주소 꼴로 흉내 낸다.
// 리허설 앱에는 제2의 나가 없어서, app-shell.mjs의 me2Status 한 줄만 가짜 status(window.__qaMe2)로 바꿔 내준다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MAIN = path.join(os.homedir(), 'Documents', 'SYNK-appsscript');
const require = createRequire(path.join(fs.existsSync(path.join(ROOT, 'node_modules')) ? ROOT : MAIN, 'x.js'));
const {chromium} = require('playwright');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const [W, H] = opt('--폭', '390x844').split('x').map(Number), SHOTS = args.includes('--찍기');
const OUT = path.join(ROOT, '.tmp', 'world-front-qa', '내사진'); fs.mkdirSync(OUT, {recursive: true});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = []; const check = (ok, what, detail = '') => { console.log(`${ok ? '통과' : '실패'} ${what}${detail ? ` — ${detail}` : ''}`); if (!ok) fail.push(what); };
const PHOTO_URL = 'https://qiwxeddwwnzkwalpsuty.supabase.co/storage/v1/object/sign/me2-media/qa/base.jpg?token=fixture';
const READY = {status: 'ok', consent: {given: true}, me: {state: 'ready', chosen_url: PHOTO_URL}};

const browser = await chromium.launch({channel: 'msedge'});
// 시험 그림: 회색 바탕, 얼굴 자리(가로 50% · 세로 36% · 폭 34%)에 주황 타원, 그 가운데 작은 파란 점
const PHOTO = await (async () => {
  const p = await browser.newPage();
  const b64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1152; c.height = 1536; const g = c.getContext('2d'); g.fillStyle = '#8a8f98'; g.fillRect(0, 0, 1152, 1536); g.fillStyle = '#e08a3c'; g.beginPath(); g.ellipse(576, 553, 196, 250, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2a5bd7'; g.beginPath(); g.arc(576, 553, 18, 0, Math.PI * 2); g.fill(); return c.toDataURL('image/png').split(',')[1]; });
  await p.close(); return Buffer.from(b64, 'base64');
})();

// 경우마다 새 리허설 서버(빈 기록)를 띄운다. 포트는 한 실행 안에서 겹치지 않게 하나씩 올리고, 끝나면 그 서버를 끈다.
let nextPort = 5200 + Math.floor(Math.random() * 300);
async function run(name, {status = READY, delay = 0, reject = false, guest = false} = {}) {
  console.log(`── ${name}`);
  const PORT = nextPort++, base = `http://127.0.0.1:${PORT}`;
  const server = spawn(process.execPath, [path.join(ROOT, 'experiences/seoul-arrival/qa/서버.mjs'), String(PORT)], {env: {...process.env, SYNK_WORLD_DATA_DIR: path.join(OUT, `db-${PORT}`)}, stdio: 'ignore'});
  try {
    for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await sleep(500); }
    const context = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: W < 700, locale: 'ko-KR'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('페이지 ' + String(e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('콘솔 ' + m.text().slice(0, 200)); });
    let patched = false, photoHits = 0;
    await context.route(/\/app-shell\.mjs(\?|$)/, async route => {
      const r = await route.fetch(); const text = await r.text();
      const body = text.replace(/async function me2Status\(\)\{if\(!me2Allowed\(\)\)return \{status:'not_invited'\};const owner=client\.snapshot\?\.accountId,out=await account\.me2Request\(\{action:'status'\}\);/,
        "async function me2Status(){if(!client.snapshot)return {status:'not_invited'};const owner=client.snapshot?.accountId,out=await window.__qaMe2();");
      patched = body !== text; return route.fulfill({response: r, body});
    });
    await context.route('https://qiwxeddwwnzkwalpsuty.supabase.co/storage/v1/object/sign/me2-media/qa/**', route => { photoHits++; return route.fulfill({status: 200, contentType: 'image/png', body: PHOTO}); });
    await context.addInitScript(({status, delay, reject}) => {
      window.__qaCalls = 0;
      window.__qaMe2 = () => { window.__qaCalls++; return new Promise((res, rej) => setTimeout(() => reject ? rej(new Error('qa status')) : res(JSON.parse(JSON.stringify(status))), delay)); };
    }, {status, delay, reject});
    const F = () => page.frames().find(f => f.url().includes('/world-front/'));
    const until = async (what, fn, ms = 30000) => { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) { check(false, `${name}: ${what}`, '시간 초과'); return null; } await sleep(120); } };
    const faceStyle = () => F()?.evaluate(() => document.querySelector('.view.night .me-tag .me')?.getAttribute('style') ?? null);
    const calls = () => page.evaluate(() => window.__qaCalls);

    const night = Date.now() - 90e3;
    const arrival = {version: 1, stage: 'left', dream: 'idol', name: '볼로르', nameEn: 'Bolor', call: '언니', from: '몽골', look: null, photo: 'me',
      best: {s1e01: {n: 3, t2: true, tr: false}}, scenes: [{id: 's1e01.wrap', at: night, lines: 4}], momAnswer: 'fix', momAt: night, updatedAt: night};
    await page.goto(`${base}/mobile.html?frontAuto=1`, {waitUntil: 'domcontentloaded'});
    await page.evaluate(a => localStorage.setItem('synk.world.arrival.v1:guest', JSON.stringify(a)), arrival);
    await page.reload({waitUntil: 'domcontentloaded'});
    if (!guest) {
      await until('앱 준비', () => page.evaluate(() => !!window.__synkWorld?.client));
      await page.evaluate(() => window.__synkWorld.client.signIn('player-a'));
      await page.reload({waitUntil: 'domcontentloaded'});
    }
    await until('타이틀', () => page.evaluate(() => window.__synkOpening?.stage?.() === 'title'));
    await sleep(800);
    await page.mouse.click(W / 2, H * .55);
    if (!guest) {
      const move = await until('「계정으로 옮기기」 질문', () => page.$('#world-panel[open] [data-world="seoul-move"][data-choice="yes"]'), 20000);
      if (move) { await sleep(500); await move.click(); }
    }
    check(patched, `${name}: 가짜 status를 앱에 물림`);
    await until('앞면 틀', async () => (await page.evaluate(() => !!document.querySelector('#front-layer')?.open)) && F(), 25000);
    await until('첫날 끝 화면', () => F().evaluate(() => !!document.querySelector('.view.night .me-tag')), 20000);
    const t0 = Date.now(), first = await faceStyle();
    return {page, context, errors, first, t0, faceStyle, calls, until, photoHits: () => photoHits, F,
      async end() { check(!errors.length, `${name}: 콘솔 · 페이지 오류 0`, errors.slice(0, 3).join(' | ')); await context.close(); server.kill(); }};
  } catch (error) { check(false, `${name}: 실행`, String(error).slice(0, 200)); server.kill(); return null; }
  finally { process.once('exit', () => { try { server.kill(); } catch {} }); }
}

// 1. 사진이 나와 고른 학생: 얼굴 원이 그 사진을 얼굴 자리(1152×1536의 50% · 36%, 폭 34%)로 자른다
{
  const c = await run('고른 사진');
  if (c) {
    const s = await c.until('얼굴 원에 사진', async () => { const v = await c.faceStyle(); return v && v.includes(PHOTO_URL) ? v : null; }, 8000);
    check(!!s && /background-size:\s*226\.24% auto/.test(s) && /background-position:\s*50\.00% 30\.05%/.test(s), '얼굴 원을 얼굴 자리로 자름', s || '');
    check((await c.calls()) === 1, '처음 그릴 때 status를 한 번만 물음', String(await c.calls()));
    // 한글 질문에 답하면 앞면이 state를 다시 짓는다 — 4분 안이라 다시 묻지 않고 같은 사진을 쓴다
    const reads = await c.F().$('[data-hangul="reads"]');
    if (reads) {
      await reads.click();
      await c.until('한글 답 뒤 다시 그림', () => c.F().evaluate(() => !document.querySelector('[data-hangul]')), 8000);
      await sleep(600);
      const again = await c.faceStyle();
      check(!!again && again.includes(PHOTO_URL), '다시 그려도 얼굴 원에 사진', again || '');
      check((await c.calls()) === 1, '4분 안에는 status를 다시 묻지 않음', String(await c.calls()));
      // 한글 질문 동안은 이름표가 숨는다 — 답한 뒤 보이는 얼굴 원에서 사진을 실제로 받는지, 얼굴 자리가 원 가운데에 오는지 본다
      await sleep(1200);
      await c.until('사진을 실제로 받음', () => c.photoHits() > 0, 5000);
      const box = await c.F().evaluate(() => { const r = document.querySelector('.view.night .me-tag .me').getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; });
      check(box.w > 0 && box.h > 0, '얼굴 원이 보임', `${box.w}×${box.h}`);
      if (SHOTS) {
        const frameBox = await (await c.page.$('#front-layer iframe')).boundingBox();
        await c.page.screenshot({path: path.join(OUT, '1-얼굴원.png'), clip: {x: frameBox.x + box.x - 6, y: frameBox.y + box.y - 6, width: box.w + 12, height: box.h + 12}});
        await c.page.screenshot({path: path.join(OUT, '1-첫날끝.png')});
      }
    } else check(false, '한글 질문이 있음');
    await c.end();
  }
}
// 2. status가 늦는 학생: 앞면은 기다리지 않고 얼굴 없이 뜬 뒤, 사진을 받으면 다시 그린다
{
  const c = await run('늦은 status', {delay: 5000});
  if (c) {
    check(!(c.first || '').includes('background-image'), '늦으면 얼굴 없이 먼저 뜸', c.first || '(빈 style)');
    const s = await c.until('받은 뒤 얼굴 원에 사진', async () => { const v = await c.faceStyle(); return v && v.includes(PHOTO_URL) ? v : null; }, 9000);
    check(!!s, '받으면 다시 그려 사진이 들어감');
    await c.end();
  }
}
// 3. 초대가 풀렸거나 status가 실패한 학생: 얼굴 없이(옛 얼굴 그림도 쓰지 않는다), 오류 없이
for (const [name, o] of [['초대 풀림', {status: {status: 'not_invited'}}], ['status 실패', {reject: true}], ['사진 지움', {status: {status: 'ok', consent: {given: true}, me: {state: 'none'}}}]]) {
  const c = await run(name, o);
  if (c) {
    await sleep(3000);
    const v = await c.faceStyle();
    check(!(v || '').includes('background-image'), `${name}: 얼굴 없이`, v || '(빈 style)');
    await c.end();
  }
}
// 4. 손님: 서버에 묻지 않는다
{
  const c = await run('손님', {guest: true});
  if (c) {
    await sleep(3000);
    check((await c.calls()) === 0, '손님은 status를 묻지 않음', String(await c.calls()));
    check(!((await c.faceStyle()) || '').includes('background-image'), '손님은 얼굴 없이');
    await c.end();
  }
}
await browser.close();
console.log(fail.length ? `실패 ${fail.length}건` : '모두 통과');
process.exit(fail.length ? 1 : 0);
