// 첫날 끝 · 맞춤 앞면 실제 앱 흐름 시험(로컬 WORLD 리허설 서버 · 운영 계정 · talk를 건드리지 않는다).
//   node experiences/world-front/qa/흐름.mjs [--폭 390x844] [--언어 ko|en|mn] [--찍기] [--꺼짐] [--로그인]
// 서울행을 끝낸 손님 기록(stage left)을 심고 타이틀을 지나면 튜터 고르기 · 펠트 동네 대신 앞면 틀이 뜨는지 본다.
// 첫날 끝 → 「지금 더 연습하기」 → 오늘 할 일을 열면 레슨 시트가 앞면 위에 뜨고, 닫으면 앞면으로 돌아오는지까지 간다.
// --로그인: 손님으로 서울행을 끝낸 뒤 리허설 계정(player-a)으로 로그인한다 — 서울행이 묻는 「계정으로 옮기기」를 지나 계정 기록으로 앞면이 뜨고,
//   첫날 끝 → 「지금 더 연습하기」 → 레슨을 열고 닫은 뒤 「나」에서 로그아웃하면 앞면이 내려가 타이틀로 가는지까지 본다.
// --며칠 N: 첫날이 N일 전인 학생(셋째 날부터는 「어제 · 둘째 날」 글 없이 질문부터). --1화안봄: 내 길에서 「오늘은 여기까지」로 나와 1화를 안 본 학생(--로그인과 함께).
// --꺼짐: 스위치를 끈 판(world-front-entry.mjs의 FRONT_AUTO만 false로 바꿔 내줌)에서 같은 기록이어도 앞면이 안 뜨고 지금 길로 가는지 본다.
// --후보 <폴더>: synk.im/world를 열되 공개.js --후보폴더의 파일만 그 폴더에서 내준다(공개본은 안 바꾼다, 서울행 qa/흐름.mjs와 같은 꼴). 손님 길만 — 후보는 스위치가 켜진 판이라 frontAuto를 붙이지 않는다.
// 기록: .tmp/world-front-qa/<폭>-<언어>/ (찍기와 결과.json)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MAIN = path.join(os.homedir(), 'Documents', 'SYNK-appsscript');
const require = createRequire(path.join(fs.existsSync(path.join(ROOT, 'node_modules')) ? ROOT : MAIN, 'x.js'));
const {chromium} = require('playwright');
const args = process.argv.slice(2), opt = (n, d = null) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; }, has = n => args.includes(n);
const [W, H] = opt('--폭', '390x844').split('x').map(Number), LANG = opt('--언어', 'ko'), SHOTS = has('--찍기'), OFF = has('--꺼짐'), LOGIN = has('--로그인'), DAYS = Number(opt('--며칠', '0')), NO_EP = has('--1화안봄'), CAND = opt('--후보');
if (CAND && (LOGIN || OFF)) { console.log('--후보는 손님 길만 본다(--로그인 · --꺼짐과 함께 못 쓴다)'); process.exit(2); }
const OUT = path.join(ROOT, '.tmp', 'world-front-qa', `${W}-${LANG}${OFF ? '-off' : ''}${LOGIN ? '-login' : ''}${DAYS ? `-d${DAYS}` : ''}${NO_EP ? '-noep' : ''}${CAND ? '-cand' : ''}`); fs.mkdirSync(OUT, {recursive: true});
const PORT = Number(opt('--포트', String(4800 + Math.floor(Math.random() * 300))));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [], fail = [];
const check = (ok, what, detail = '') => { log.push(`${ok ? '통과' : '실패'} ${what}${detail ? ` — ${detail}` : ''}`); if (!ok) fail.push(what); console.log(log.at(-1)); };

const data = path.join(ROOT, '.tmp', 'world-front-qa', `db-${PORT}`);
const server = CAND ? null : spawn(process.execPath, [path.join(ROOT, 'experiences/seoul-arrival/qa/서버.mjs'), String(PORT)], {env: {...process.env, SYNK_WORLD_DATA_DIR: data}, stdio: 'ignore'});
process.on('exit', () => { try { server?.kill(); } catch {} });
const base = CAND ? 'https://synk.im/world' : `http://127.0.0.1:${PORT}`;
if (!CAND) for (let i = 0; i < 120; i++) { try { const r = await fetch(base + '/health'); if (r.ok) break; } catch {} await sleep(500); }

const browser = await chromium.launch({channel: 'msedge'});
const context = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: W < 700, locale: LANG === 'ko' ? 'ko-KR' : LANG === 'mn' ? 'mn-MN' : 'en-US'});
const page = await context.newPage();
const errors = [], bad = [];
page.on('pageerror', e => errors.push('페이지 ' + String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('콘솔 ' + m.text().slice(0, 300)); });
page.on('response', r => { const u = r.url(); if (r.status() >= 400 && !/\/api\//.test(u)) bad.push(`${r.status()} ${u.replace(base, '')}`); });
if (CAND) {
  const TYPES = {'.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2'};
  let served = 0;
  await page.route('https://synk.im/world/**', async route => {
    const u = new URL(route.request().url()); let rel = decodeURIComponent(u.pathname.replace(/^\/world\//, '')); if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(path.resolve(CAND), 'world', rel);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.continue();
    served++; return route.fulfill({status: 200, headers: {'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store'}, body: fs.readFileSync(file)});
  });
  process.on('exit', () => console.log('후보에서 내준 파일', served));
}
if (OFF) await page.route(/\/world-front-entry\.mjs(\?|$)/,async route => { const r = await route.fetch(); return route.fulfill({response: r, body: (await r.text()).replace(/export const FRONT_AUTO=(true|false);/, 'export const FRONT_AUTO=false;')}); });
const frontAsked = []; page.on('request', q => { if (/\/world-front\//.test(q.url())) frontAsked.push(q.url()); });
const shot = async name => { if (SHOTS) await page.screenshot({path: path.join(OUT, name + '.png')}); };
const F = () => page.frames().find(f => f.url().includes('/world-front/'));
const inF = (fn, arg) => F().evaluate(fn, arg);
const until = async (what, fn, ms = 30000) => { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) { check(false, what, '시간 초과'); return null; } await sleep(150); } };
async function finish() {
  check(!errors.length, '콘솔 · 페이지 오류 0', errors.slice(0, 4).join(' | '));
  check(!bad.length, '404 · 400대 응답 0', bad.slice(0, 4).join(' | '));
  fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify({폭: `${W}x${H}`, 언어: LANG, 꺼짐: OFF, 로그인: LOGIN, 통과: log.filter(l => l.startsWith('통과')).length, 실패: fail, 기록: log}, null, 1));
  console.log(fail.length ? `실패 ${fail.length}건` : '모두 통과');
  await browser.close(); server?.kill(); process.exit(fail.length ? 1 : 0);
}

// ── 서울행을 끝낸 손님 기록 ──
const night = Date.now() - 90e3 - DAYS * 864e5;
const arrival = NO_EP
  ? {version: 1, stage: 'left', dream: 'idol', name: '볼로르', nameEn: 'Bolor', call: '언니', from: '몽골', look: 'mn_f', scenes: [], updatedAt: night}
  : {version: 1, stage: 'left', dream: 'idol', name: '볼로르', nameEn: 'Bolor', call: '언니', from: '몽골', look: 'mn_f',
    best: {s1e01: {n: 3, t2: true, tr: false}}, scenes: [{id: 's1e01.wrap', at: night, lines: 4}], momAnswer: 'fix', momAt: night, updatedAt: night};
await page.goto(`${base}/mobile.html${OFF || CAND ? '' : '?frontAuto=1'}`, {waitUntil: 'domcontentloaded'});
await page.evaluate(({lang, arrival}) => {
  if (lang !== 'ko') localStorage.setItem('synk.world.lang', lang);
  localStorage.setItem('synk.world.arrival.v1:guest', JSON.stringify(arrival));
}, {lang: LANG, arrival});
await page.reload({waitUntil: 'domcontentloaded'});
const ownerNow = () => page.evaluate(() => window.__synkWorld?.client?.snapshot?.accountId || 'guest');
const markNow = async () => { const o = await ownerNow(); return page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), 'synk.world.front.v1:' + o); };
if (LOGIN) {
  await until('앱 준비', () => page.evaluate(() => !!window.__synkWorld?.client));
  await page.evaluate(() => window.__synkWorld.client.signIn('player-a'));
  check(await ownerNow() !== 'guest', '리허설 계정으로 로그인');
  await page.reload({waitUntil: 'domcontentloaded'});
}
await until('타이틀', () => page.evaluate(() => window.__synkOpening?.stage?.() === 'title'));
await sleep(800);
check(!await page.evaluate(() => !!document.querySelector('#front-layer')), '타이틀 아래에 앞면 틀이 없음');
await page.mouse.click(W / 2, H * .55);
if (LOGIN) {
  // 서울행이 손님 기록을 계정으로 옮길지 묻는다 → 옮기면 계정 기록으로 앞면이 뜬다
  const move = await until('「계정으로 옮기기」 질문', () => page.$('#world-panel[open] [data-world="seoul-move"][data-choice="yes"]'), 20000);
  if (move) { await sleep(600); await shot('0-옮기기'); await move.click(); }
  await until('손님 기록을 지움', () => page.evaluate(() => !localStorage.getItem('synk.world.arrival.v1:guest')), 10000);
  check(await page.evaluate(() => !localStorage.getItem('synk.world.arrival.v1:guest')), '옮긴 뒤 기기의 손님 기록을 지움');
}

if (OFF) {
  await until('지금 길(입장 관문 또는 동네)', () => page.evaluate(() => document.querySelector('#world-panel')?.open || document.querySelector('#seoul-layer') || window.__synkOpening?.stage?.() !== 'title'), 20000);
  await sleep(1500); await shot('꺼짐');
  check(!await page.evaluate(() => !!document.querySelector('#front-layer')), '스위치를 끄면 앞면 층이 안 뜸');
  check(frontAsked.length === 0, '앞면 파일을 받지 않음', frontAsked.slice(0, 3).join(' '));
  await finish();
}

// ── 셋째 날부터: 「어제 · 둘째 날」 글 없이 질문부터 ──
if (DAYS >= 2) {
  await until('앞면 틀', async () => (await page.evaluate(() => !!document.querySelector('#front-layer')?.open)) && F(), 20000);
  await until('질문 화면', () => inF(() => !!document.querySelector('.view') && !document.querySelector('.view.night')), 20000);
  await sleep(2000); await shot('d-첫화면');
  const t = await inF(() => document.querySelector('.view')?.innerText || '');
  check(!/어제|둘째 날/.test(t), `첫날이 ${DAYS}일 전인 학생에게 「어제 · 둘째 날」 글이 없음`, t.slice(0, 90).replace(/\s+/g, ' '));
  check(!!await inF(() => document.querySelector('[data-hangul2],[data-hangul3],.rail.goals')), '새벽 창가 없이 질문부터');
  await finish();
}

// ── 첫날 끝 ──
await until('앞면 틀', async () => (await page.evaluate(() => !!document.querySelector('#front-layer')?.open)) && F(), 20000);
await until('첫날 끝 화면', () => inF(() => !!document.querySelector('.view.night:not(.off)')), 20000);
await sleep(2500); await shot('1-첫날끝');
check(!await page.evaluate(() => document.querySelector('#world-panel')?.open), '튜터 고르기 · 입장 관문 시트가 안 뜸');
const endText = await inF(() => document.querySelector('.view')?.innerText || '');
check(!/몽글|까몽|마린/.test(endText), '마스코트 이름이 안 보임');
const over = async where => { const d = await inF(() => document.documentElement.scrollWidth - innerWidth); if (d > 0) check(false, '가로 넘침 ' + where, String(d)); };
await over('첫날 끝');
// 한글 질문에 답하면 지금 관문과 같은 자리에 저장되고, 아래 덩어리가 실제 계획의 오늘 할 일로 바뀐다
const reads = await F().$('[data-hangul="reads"]');
check(!!reads, '한글 질문이 있음');
if (reads) {
  await reads.click();
  await until('한글 답 뒤 할 일 줄', () => inF(() => !document.querySelector('[data-hangul]') && !!document.querySelector('[data-act="bye"],[data-act="more"]')), 8000);
  await sleep(1500); await shot('1b-한글답');
  const tomorrow = await inF(() => document.querySelector('.view')?.innerText || '');
  check(!/몽글|까몽|마린/.test(tomorrow), '내일 할 일 줄에 마스코트 이름이 안 보임');
  if (LOGIN && LANG === 'ko' && !NO_EP) check(/1화에서/.test(tomorrow) && /엄마/.test(tomorrow), '로그인 학생은 1화에서 말한 줄과 엄마 답이 보임', tomorrow.slice(0, 80).replace(/\s+/g, ' '));
  if (NO_EP && LANG === 'ko') check(!/1화를 끝까지|개강 첫날/.test(tomorrow) && /학생증/.test(tomorrow), '1화를 안 본 학생에게 「1화를 끝까지 · 개강 첫날」이 없고 학생증이 보임', tomorrow.slice(0, 80).replace(/\s+/g, ' '));
  // 손님(11-23 손님 1화): 로그인 판을 부르지 않고 내 길의 1화로 보낸다. 1화를 본 손님은 그 기록이 보이고 단추가 「1화 다시 보기」다
  if (!LOGIN) {
    const acts = await inF(() => [...document.querySelectorAll('.view .acts [data-act]')].map(b => `${b.dataset.act}:${b.textContent.trim()}`));
    check(!acts.some(a => a.startsWith('login')) && acts.some(a => a.startsWith('story')), '손님 첫날 끝: 로그인 대신 1화로', acts.join(' | '));
    if (LANG === 'ko') check(NO_EP ? acts.includes('story:1화 보기') : acts.some(a => a.startsWith('story:1화 다시 보기')), NO_EP ? '1화를 안 본 손님은 「1화 보기」' : '1화를 본 손님은 「1화 다시 보기」', acts.join(' | '));
    if (LANG === 'ko' && !NO_EP) check(/1화에서/.test(tomorrow), '1화를 본 손님도 1화에서 말한 줄이 보임', tomorrow.slice(0, 80).replace(/\s+/g, ' '));
  }
  // 누르면 서울행 내 길이 앞면 위에 뜨고, 「오늘 마무리하기」로 닫으면 앞면으로 돌아온다.
  // 1화를 본 손님만 누른다 — 1화 전 내 길의 「오늘은 여기까지」는 동아리장 알림으로 바뀌어(11-24 동아리장 알림, experiences/world-front/qa/동아리흐름.mjs가 본다) 닫는 단추가 다르다
  if (!LOGIN && !NO_EP) {
    await F().click('.view .acts [data-act="story"]');
    const S = () => page.frames().find(x => x.url().includes('/seoul-arrival/'));
    await until('내 길이 앞면 위에 뜸', async () => (await page.evaluate(() => !!document.querySelector('#seoul-layer')?.matches(':modal'))) && !!S() && await S().evaluate(() => document.querySelector('#s-path')?.classList.contains('on')), 20000);
    await sleep(1200); await shot('1c-손님내길');
    check(await S().evaluate(() => !!document.querySelector('#startEp')), '내 길에 1화 단추가 있음');
    await S().click('#goHome');
    await until('앞면으로 돌아옴', () => page.evaluate(() => !document.querySelector('#seoul-layer') && !!document.querySelector('#front-layer')?.open), 10000);
    await until('첫날 끝 화면 다시', () => inF(() => !!document.querySelector('.view.night:not(.off) .acts')), 10000);
  }
}

// ── 로그인: 「지금 더 연습하기」 → 첫날 맞춤 / 손님: 「오늘은 여기까지」 → 불 끔 → 다시 열기 ──
const more = LOGIN ? await F().$('[data-act="more"]') : null;
if (LOGIN) {
  check(!!more, '「지금 더 연습하기」 단추가 있음');
  if (more) { await more.click(); await until('첫날 맞춤으로 넘어감', () => inF(() => !!document.querySelector('.view') && !document.querySelector('.view.night')), 15000); }
  check((await markNow()).ended === true, '첫날 끝을 계정 주인의 기기 표에 적음');
}
const bye = LOGIN ? null : await F().$('[data-act="bye"]');
if (!LOGIN) check(!!bye, '「오늘은 여기까지」 단추가 있음');
if (bye) {
  await bye.click();
  await until('불 끈 화면', () => inF(() => !!document.querySelector('.view.night.off')), 8000);
  await sleep(2500); await shot('2-불끔');
  const mark = await page.evaluate(() => JSON.parse(localStorage.getItem('synk.world.front.v1:guest') || '{}'));
  check(mark.ended === true, '첫날 끝을 기기에 적음');
}

// ── 같은 날 다시 열면 첫날 맞춤 ──
if (!LOGIN) await page.reload({waitUntil: 'domcontentloaded'});
// 같은 탭에서는 오프닝을 본 뒤라 타이틀 없이 바로 들어갈 수 있다
if (!LOGIN && await until('다시 연 타이틀 또는 앞면', () => page.evaluate(() => window.__synkOpening?.stage?.() === 'title' || !!document.querySelector('#front-layer')?.open)) && await page.evaluate(() => window.__synkOpening?.stage?.() === 'title')) { await sleep(800); await page.mouse.click(W / 2, H * .55); }
await until('다시 연 앞면', async () => (await page.evaluate(() => !!document.querySelector('#front-layer')?.open)) && F(), 20000);
const home = await until('첫날 맞춤 화면', () => inF(() => !!document.querySelector('.view') && !document.querySelector('.view.night')), 15000);
await sleep(1800); await shot('3-첫날맞춤');
if (home) {
  await over('첫날 맞춤');
  check(!await inF(() => !!document.querySelector('[data-hangul]')), '다시 열어도 한글 답이 남아 있음(질문을 다시 묻지 않음)');
  const homeText = await inF(() => document.querySelector('.view')?.innerText || '');
  check(!/몽글|까몽|마린/.test(homeText), '맞춤 화면에 마스코트 이름이 안 보임');
  // 오늘 할 일 열기 → 레슨 시트가 앞면 위에 뜬다
  const start = await F().$('[data-act="start"]');
  check(!!start, '「시작」 단추가 있음');
  if (start) {
    await start.click();
    const opened = await until('레슨 · 게임 시트', () => page.evaluate(() => document.querySelector('#world-panel')?.open), 15000);
    await sleep(1500); await shot('4-시트');
    if (opened) {
      check(await page.evaluate(() => document.querySelector('#world-panel').matches(':modal') && document.querySelector('#front-layer').matches(':modal')), '시트가 앞면 위에 모달로 뜸');
      await page.keyboard.press('Escape');
      await until('시트 닫힘', () => page.evaluate(() => !document.querySelector('#world-panel')?.open), 8000);
      await sleep(1200); await shot('5-돌아옴');
      check(await page.evaluate(() => !!document.querySelector('#front-layer')?.open), '시트를 닫으면 앞면으로 돌아옴');
      check(!(await markNow()).after, '열기만 하고 닫으면 「첫 연습」을 적지 않음');
    }
  }
}
// ── 로그인: 「나」 → 로그아웃 → 앞면이 내려가고 타이틀로 ──
if (LOGIN) {
  const me = await F().$('[data-act="me"]');
  check(!!me, '「나」 단추가 있음');
  if (me) {
    await me.click();
    // 「나」는 설정(화면 언어 · 소리 · 움직임)을 열고 맨 아래에 「내 계정」 단추를 둔다
    await until('설정 시트', () => page.$('#world-panel[open] input[name="world-lang"]'), 10000);
    check(!!await page.$('#world-panel[open] input[name="world-lang"]'), '「나」에서 화면 언어를 바꿀 수 있음');
    await sleep(600); await shot('6a-설정');
    // 설정에서 화면 언어를 바꿔도(홈이 설정을 다시 그린다) 앞면의 설정 꼴 — 「내 계정」 단추가 남고 튜터 단추는 없다
    const other = LANG === 'en' ? 'ko' : 'en';
    await page.click(`#world-panel[open] input[name="world-lang"][value="${other}"]`).catch(() => {});
    await sleep(700);
    const after = await page.evaluate(() => ({last: document.querySelector('#world-panel[open] .panel-actions .quiet-button:last-child')?.textContent || '', tutor: /튜터|tutor|Багш/i.test(document.querySelector('#world-panel[open]')?.innerText || '')}));
    check(/내 계정|My account|Миний бүртгэл/.test(after.last) && !after.tutor, '설정에서 언어를 바꿔도 「내 계정」 단추가 남고 튜터 단추가 없음', JSON.stringify(after));
    await page.click(`#world-panel[open] input[name="world-lang"][value="${LANG}"]`).catch(() => {});
    await sleep(700);
    const acct = await page.$('#world-panel[open] .panel-actions .quiet-button:last-child');
    if (acct) await acct.click();
    const out = await until('내 계정 시트의 로그아웃', () => page.$('#world-panel[open] [data-world="logout"]'), 10000);
    await sleep(800); await shot('6-나');
    if (out) {
      await out.click();
      await until('로그아웃 뒤 앞면이 내려감', () => page.evaluate(() => !document.querySelector('#front-layer')), 15000);
      // 기기의 손님 기록은 계정으로 옮겼으니 이 기기는 새 손님이다 — 처음 온 손님처럼 오프닝(서울행 시작)으로 간다
      await until('로그아웃 뒤 오프닝', () => page.evaluate(() => !!window.__synkOpening && !document.querySelector('#front-layer')), 15000);
      await sleep(1500); await shot('7-로그아웃');
      const after = await page.evaluate(() => ({front: !!document.querySelector('#front-layer'), stage: window.__synkOpening?.stage?.() || null, seoul: !!document.querySelector('#seoul-layer'), lang: localStorage.getItem('synk.world.lang'), nav: navigator.language}));
      check(!after.front, '로그아웃하면 앞면이 내려감', JSON.stringify(after));
      check(await ownerNow() === 'guest', '로그아웃 뒤 손님');
      // 같은 쪽에서 다시 로그인하면(PC 앱처럼 쪽을 새로 열지 않음) 타이틀을 지나 앞면이 다시 뜬다 — 관문 뒤 갈 곳을 다시 정하는지(Fable P2-2)
      // 오프닝을 본 기기라 로그아웃 뒤 타이틀은 바로 닫힌다(stage 'closed'). 타이틀이 떠 있으면 누르고 지난다.
      await page.evaluate(() => window.__synkWorld.client.signIn('player-a'));
      await until('같은 쪽에서 다시 로그인', async () => await ownerNow() !== 'guest', 10000);
      await sleep(600);
      if (await page.evaluate(() => window.__synkOpening?.stage?.() === 'title')) await page.mouse.click(W / 2, H * .55);
      const back = await until('다시 로그인한 뒤 앞면', () => page.evaluate(() => !!document.querySelector('#front-layer')?.open), 20000);
      await sleep(1200); await shot('8-다시로그인');
      check(!!back && !await page.evaluate(() => !!document.querySelector('[data-tutor-action]')), '같은 쪽에서 다시 로그인하면 튜터 고르기 없이 앞면이 다시 뜸');
    }
  }
}
await finish();
