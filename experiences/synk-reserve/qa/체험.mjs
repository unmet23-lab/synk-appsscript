// 사전예약 쪽의 1회용 체험(/reserve/play/) 흐름 시험: 사전예약 쪽에서 눌러 타이틀부터 1화 끝 · 내 팬 · 쪽지를 지나 사전예약 쪽으로 돌아온다.
//   node experiences/synk-reserve/qa/체험.mjs [--폭 390x844] [--언어 ko|en|mn] [--꿈 idol|actor] [--찍기] [--끝 road] [--라이브]
// · reserve/는 이 저장소의 dist를, 나머지(이야기 · 1화)는 지금 공개본을 받는다. --라이브면 reserve/도 공개본이다. 공개본은 바꾸지 않는다.
// · 이 기기에 로그인 흉내와 앞 학생의 기록을 심어 두고, 체험이 그것을 읽지도 바꾸지도 않는지 본다(유호님 11-25 「로그인 정보가 계속 이어지는데 1회성으로」).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const MAIN = path.join(os.homedir(), 'Documents', 'SYNK-appsscript');
const require = createRequire(path.join(fs.existsSync(path.join(ROOT, 'node_modules')) ? ROOT : MAIN, 'x.js'));
const { chromium } = require('playwright');
const args = process.argv.slice(2), opt = (n, d = null) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; }, has = n => args.includes(n);
const [W, H] = opt('--폭', '390x844').split('x').map(Number), LANG = opt('--언어', 'ko'), DREAM = opt('--꿈', 'idol'), SHOTS = has('--찍기'), LIVE = has('--라이브'), END = opt('--끝', 'all');
const OUT = path.join(ROOT, '.tmp', 'rsv-play-qa', `${W}-${LANG}-${DREAM}`);
fs.mkdirSync(OUT, { recursive: true });
const DIST = path.resolve(HERE, '../dist/reserve');
const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = [];
const check = (ok, what, detail = '') => { console.log(`${ok ? '통과' : '실패'} ${what}${detail ? ` — ${detail}` : ''}`); if (!ok) fail.push(what); };

const browser = await chromium.launch({ channel: 'msedge', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: W < 700, locale: LANG === 'ko' ? 'ko-KR' : LANG === 'mn' ? 'mn-MN' : 'en-US', permissions: ['microphone'] });
const page = await context.newPage();
const errors = [], bad = [], asked = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
context.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
// 계정 · 로그인 · 받아쓰기로 가는 요청, WORLD 앱 묶음
context.on('request', q => { const u = q.url(); if (/supabase|\/auth\/v1|world-speaking(?:[?#/]|$)|world-account|app-shell|talk\./.test(u)) asked.push(u); });
if (!LIVE) await context.route(u => u.origin === 'https://synk.im' && u.pathname.startsWith('/reserve/'), async route => {
  const u = new URL(route.request().url());
  let rel = decodeURIComponent(u.pathname.replace(/^\/reserve\//, ''));
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ status: 200, headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }, body: fs.readFileSync(file) });
});

const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(OUT, `${name}.png`) }); };
const F = () => page.frames().find(f => f.url().includes('/world/seoul-arrival/'));
const D = () => page.frames().find(f => f.url().includes('/world/drama/'));
const inF = (fn, arg) => F().evaluate(fn, arg);
const finish = async () => {
  check(errors.length === 0, '오류 없음', errors.slice(0, 4).join(' | '));
  check(bad.filter(x => !/favicon/.test(x)).length === 0, '없는 파일 요청 없음', bad.slice(0, 4).join(' | '));
  check(asked.length === 0, '계정 · 로그인 · 받아쓰기 · WORLD 앱 요청 없음', asked.slice(0, 3).join(' '));
  await browser.close();
  console.log(fail.length ? `실패 ${fail.length}: ${fail.join(' / ')}` : '모두 통과');
  process.exit(fail.length ? 1 : 0);
};
const until = async (what, fn, ms = 30000) => {
  const t0 = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* 아직 */ }
    if (Date.now() - t0 > ms) { check(false, what, '시간 초과'); await shot('멈춤'); await finish(); }
    await sleep(120);
  }
};
const overflow = async where => { const d = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); const f = await inF(() => document.documentElement.scrollWidth - innerWidth).catch(() => 0); if (d > 0 || f > 0) check(false, `가로 넘침 ${where}`, `${d} ${f}`); };
const store = () => page.evaluate(() => JSON.stringify([localStorage, sessionStorage].map(s => Object.fromEntries(Object.keys(s).sort().map(k => [k, s.getItem(k)])))));
const advance = async stop => { for (let i = 0; i < 120; i += 1) { if (await stop()) return true; await inF(() => document.querySelector('#vn')?.click()); await sleep(160); } return false; };

// ── 앞 학생의 로그인 흉내 · 기록을 심고 사전예약 쪽에서 시작한다 ──
await page.goto(`https://synk.im/reserve/?lang=${LANG}&from=qa-play`, { waitUntil: 'load' });
await page.evaluate(() => {
  localStorage.setItem('synk.world.arrival.v1:guest', JSON.stringify({ version: 1, stage: 'left', dream: 'actor', name: '앞학생', nameEn: 'Before', from: '몽골', call: '선배', look: 'mn_m', scenes: [{ id: 's1e01.wrap', at: 1 }], best: { s1e01: { n: 3, t2: true, tr: true } }, lights: 5, issuedAt: 1 }));
  localStorage.setItem('sb-qa-auth-token', '{"access_token":"qa","user":{"id":"qa"}}');
  localStorage.setItem('synk.world.tutor.v1:guest', 'seoha');
  localStorage.setItem('synk.world.lang', 'en');
});
const before = await store();
const links = await page.evaluate(() => [...document.querySelectorAll('[data-world]')].map(a => a.getAttribute('href')));
check(links.length === 2 && links.every(h => h === `/reserve/play/?lang=${LANG}&from=qa-play`), '해 보기 단추 둘이 1회용 체험으로 간다', links.join(' '));
await page.click('#world-go');
await page.waitForURL(u => u.pathname === '/reserve/play/');
await until('이야기 틀', () => page.evaluate(() => document.querySelector('.pl-story')?.classList.contains('on')));
check(await inF(() => document.querySelector('#s-title').classList.contains('on')), '타이틀에서 시작');
check(await inF(() => !window.__seoulQA.state.name && !window.__seoulQA.state.dreamPicked && window.__seoulQA.state.scenes.length === 0), '앞 학생의 이름 · 꿈 · 기록이 이어지지 않음');
check(await page.evaluate(l => document.documentElement.lang === l, LANG), '화면 언어가 사전예약 쪽과 같음');
const word = await inF(() => document.querySelector('.title-foot b').textContent.trim());
check(LANG === 'ko' ? /화면을 눌러 시작/.test(word) : !/[가-힣]/.test(word), '틀도 같은 언어', word);
await sleep(900);
await shot('01-타이틀');
await overflow('타이틀');

// ── 이야기 ──
await page.mouse.click(W / 2, H * 0.55);
await until('내 방', () => inF(() => document.querySelector('#roomStage')?.classList.contains('on')));
await until('건너뛰기 단추', () => inF(() => !document.querySelector('#skipBtn').hidden), 12000);
await sleep(500);
await shot('02-내방');
await F().click('#skipBtn');
await sleep(600);
if (await inF(() => { const s = document.querySelector('#skipAsk'); return !!s && !s.hidden; })) await F().click('#skipGo');
await until('거울 앞', () => inF(() => document.querySelector('#mirror').classList.contains('on')), 9000);
await sleep(500);
await F().click(`.mr-pick[data-dream="${DREAM}"]`);
await until('꿈 시트', () => inF(() => document.querySelector('#mrSheet').classList.contains('on')), 5000);
await sleep(400);
await F().click('#mrGo');
await sleep(800);
await until('여정의 건너뛰기', () => inF(() => !document.querySelector('#skipBtn').hidden), 12000);
await sleep(1200);
await F().click('#skipBtn');
await sleep(500);
if (await inF(() => { const s = document.querySelector('#skipAsk'); return !!s && !s.hidden; })) await F().click('#skipGo');
await until('정문', () => inF(() => document.querySelector('#s-gate').classList.contains('on')), 9000);
await sleep(1500);
check(await advance(() => inF(() => !!document.querySelector('#panel.on .sheetpad input'))), '이름 묻기까지');
await F().fill('#panel .sheetpad input', 'Bolor');
await F().click('#panel .sheetpad .ok');
check(await advance(() => inF(() => !!document.querySelector('#panel.on .ko-cand'))), '한글 이름 후보');
await F().click('#panel [data-a="ok"]');
check(await advance(() => inF(() => document.querySelector('#nameTrace').classList.contains('on'))), '이름 쓰기 칸');
await sleep(800);
await F().click('#ntSkip');
check(await advance(() => inF(() => !!document.querySelector('#panel.on .learn'))), '이름 말해 보기');
await F().click('#panel [data-n]');
check(await advance(() => inF(() => !!document.querySelector('#panel.on [data-i]'))), '나라 묻기');
await F().click('#panel [data-i="0"]');
check(await advance(() => inF(() => !!document.querySelector('#panel.on [data-k]'))), '부르는 말');
await F().click('#panel [data-k="선배"]');
check(await advance(() => inF(() => document.querySelector('#look').classList.contains('on'))), '얼굴 고르기');
await sleep(500);
check(await inF(() => !document.querySelector('.lk-me')), '계정 기능(내 사진) 칸이 없음');
await shot('03-얼굴');
await F().click('.lk-th[data-i="1"]');
await sleep(600);
await F().click('#lkShoot');
check(await advance(() => inF(() => document.querySelector('#cardHint').classList.contains('on'))), '학생증 인쇄 안내');
const rig = await F().locator('#cardRig').boundingBox();
await page.mouse.click(rig.x + rig.width / 2, rig.y + rig.height / 2);
await until('내 길 단추', () => inF(() => document.querySelector('#cardFoot').classList.contains('on')), 9000);
await sleep(500);
check(await inF(() => window.__seoulQA.state.name === '볼로르'), '이번 이름으로 학생증');
await shot('04-학생증');
await F().click('#toPath');
await until('내 길', () => inF(() => document.querySelector('#s-path').classList.contains('on')));
await sleep(3000);
const road = await inF(() => ({ home: document.querySelector('#goHome')?.textContent.trim(), start: document.querySelector('#startEp')?.textContent.trim() }));
check(LANG !== 'ko' || (road.home === '오늘은 여기까지' && road.start === '1화 시작'), '내 길 끝 단추에 우리 동네가 없음', JSON.stringify(road));
await shot('05-내길');
await overflow('내 길');
check(await store() === before, '여기까지 이 기기 저장이 그대로');

// ── 새로고침하면 처음부터 ──
if (END === 'road') {
  await page.reload({ waitUntil: 'load' });
  await until('새로고침 뒤 타이틀', () => page.evaluate(() => document.querySelector('.pl-story')?.classList.contains('on')));
  check(await inF(() => document.querySelector('#s-title').classList.contains('on') && !window.__seoulQA.state.name), '새로고침하면 타이틀부터');
  check(await store() === before, '새로고침 뒤에도 이 기기 저장이 그대로');
  await finish();
}

// ── 1화 ──
await F().click('#startEp');
await until('1화 판', () => page.evaluate(() => document.querySelector('#ep').open && !!document.querySelector('.pl-drama')), 14000);
check(await page.evaluate(() => document.querySelector('#ep').matches(':modal')), '1화 판이 모달');
await until('1화 틀', () => D()?.evaluate(() => !!document.querySelector('#epTag')), 20000);
await sleep(1800);
await shot('06-1화');
const t0 = Date.now();
let last = '';
for (;;) {
  if (Date.now() - t0 > 300000) { check(false, '1화 끝까지', '시간 초과'); await shot('06-멈춤'); await finish(); }
  const st = await D()?.evaluate(() => {
    const vis = el => !!el && el.getClientRects().length > 0 && !el.disabled;
    if (document.querySelector('.wrap .log')) return 'wrap';
    const dlg = document.querySelector('dialog[open]');
    if (dlg) { const b = [...dlg.querySelectorAll('button')].filter(vis).pop(); if (b) { b.click(); return `dialog:${b.textContent.slice(0, 20)}`; } }
    const end = [...document.querySelectorAll('button')].filter(vis).find(b => /^(마치기|Finish|Дуусгах)/.test(b.textContent.trim()));
    if (end) { end.click(); return 'finish'; }
    const orb = document.querySelector('#orbBtn');
    if (vis(orb) && !document.querySelector('#mic')?.hidden) { orb.click(); return 'orb'; }
    const pill = [...document.querySelectorAll('button.pill,button.big')].filter(vis)[0];
    if (pill) { pill.click(); return `pill:${pill.textContent.slice(0, 24)}`; }
    return 'wait';
  }).catch(() => null);
  if (st === 'wrap') break;
  if (st !== last) { console.log('  드라마', `${Math.round((Date.now() - t0) / 1000)}초`, st); last = st; }
  await sleep(1100);
}
await until('체험 끝 띠', () => page.evaluate(() => !!document.querySelector('.pl-end')), 8000);
await sleep(400);
await shot('07-체험끝');
const band = await page.evaluate(() => {
  const a = document.querySelector('.pl-end a'), b = document.querySelector('.pl-end').getBoundingClientRect(), f = document.querySelector('.pl-drama').getBoundingClientRect();
  return { href: a.getAttribute('href'), target: a.target, text: document.querySelector('.pl-end').innerText.replace(/\s+/g, ' '), over: f.bottom - b.top, bottom: b.bottom - innerHeight, wide: [...document.querySelectorAll('.pl-end-row>*')].map(x => Math.round(x.getBoundingClientRect().right - innerWidth)) };
});
check(band.href === `/reserve/?from=qa-play&lang=${LANG}` && band.target === '_blank', '체험 끝 띠의 사전예약 주소가 들어온 곳을 잇는다', JSON.stringify(band));
check(band.over <= 1 && band.bottom <= 1 && band.wide.every(x => x <= 0), '띠가 1화를 가리지 않고 화면 안에 있다');
check(LANG === 'ko' || !/[가-힣]/.test(band.text), '띠가 화면 언어', band.text);

// ── 내 팬 ──
await page.click('.pl-end button');
await until('객석', () => inF(() => document.querySelector('#s-crowd').classList.contains('on')), 6000);
check(await page.evaluate(() => !document.querySelector('#ep').open && !document.querySelector('.pl-drama') && !window.SYNKDramaHost), '1화 판을 닫고 통로를 걷음');
await sleep(1500);
await shot('08-객석');
for (let i = 0; i < 90 && !await inF(() => document.querySelector('#crowdFoot').classList.contains('on')); i += 1) { await page.mouse.click(W / 2, H * 0.4); await sleep(700); }
check(await inF(() => document.querySelector('#crowdFoot').classList.contains('on')), '객석 끝까지');
check(await inF(() => window.__seoulQA.state.lights >= 3), '불빛이 이번에 말한 줄만큼', String(await inF(() => window.__seoulQA.state.lights)));
await sleep(500);
await shot('09-객석끝');
await F().click('#backPath');
await until('쪽지', () => inF(() => document.querySelector('#mom').classList.contains('on')), 8000);
await until('답 단추', () => inF(() => !document.querySelector('#momActs').hidden), 8000);
await F().click('#momFix');
await until('내 길로 단추', () => inF(() => !document.querySelector('#momBye').hidden), 8000);
await F().click('#momBye');
await sleep(800);
check(await store() === before, '1화 끝까지 이 기기 저장이 그대로');
const end = await inF(() => document.querySelector('#goHome')?.textContent.trim());
check(LANG !== 'ko' || end === '오늘 마무리하기', '1화 뒤 끝 단추', end);
await shot('10-내길끝');

// ── 나가면 사전예약 쪽, 뒤로 오면 처음부터 ──
await F().click('#goHome');
await page.waitForURL(u => u.pathname === '/reserve/', { timeout: 10000 }).catch(() => {});
check(page.url() === `https://synk.im/reserve/?from=qa-play&lang=${LANG}`, '나가면 사전예약 쪽(들어온 곳 그대로)', page.url());
await page.goBack({ waitUntil: 'load' }).catch(() => {});
await until('뒤로 와도 타이틀부터', async () => await page.evaluate(() => location.pathname === '/reserve/play/' && document.querySelector('.pl-story')?.classList.contains('on')) && await inF(() => document.querySelector('#s-title').classList.contains('on') && !window.__seoulQA.state.name));
check(true, '뒤로 와도 타이틀부터');
check(await store() === before, '끝난 뒤에도 앞 학생의 로그인 · 기록이 그대로');
await finish();
