// 첫날 끝 · 맞춤 앞면 실제 앱 흐름 시험(로컬 WORLD 리허설 서버 · 운영 계정 · talk를 건드리지 않는다).
//   node experiences/world-front/qa/흐름.mjs [--폭 390x844] [--언어 ko|en|mn] [--찍기] [--꺼짐]
// 서울행을 끝낸 손님 기록(stage left)을 심고 타이틀을 지나면 튜터 고르기 · 펠트 동네 대신 앞면 틀이 뜨는지 본다.
// 첫날 끝 → 「지금 더 연습하기」 → 오늘 할 일을 열면 레슨 시트가 앞면 위에 뜨고, 닫으면 앞면으로 돌아오는지까지 간다.
// --꺼짐: 주소에 frontAuto를 붙이지 않는다(스위치 FRONT_AUTO=false 그대로) — 같은 기록이어도 앞면이 안 뜨고 지금 길로 가는지 본다.
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
const [W, H] = opt('--폭', '390x844').split('x').map(Number), LANG = opt('--언어', 'ko'), SHOTS = has('--찍기'), OFF = has('--꺼짐');
const OUT = path.join(ROOT, '.tmp', 'world-front-qa', `${W}-${LANG}${OFF ? '-off' : ''}`); fs.mkdirSync(OUT, {recursive: true});
const PORT = Number(opt('--포트', String(4800 + Math.floor(Math.random() * 300))));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [], fail = [];
const check = (ok, what, detail = '') => { log.push(`${ok ? '통과' : '실패'} ${what}${detail ? ` — ${detail}` : ''}`); if (!ok) fail.push(what); console.log(log.at(-1)); };

const data = path.join(ROOT, '.tmp', 'world-front-qa', `db-${PORT}`);
const server = spawn(process.execPath, [path.join(ROOT, 'experiences/seoul-arrival/qa/서버.mjs'), String(PORT)], {env: {...process.env, SYNK_WORLD_DATA_DIR: data}, stdio: 'ignore'});
process.on('exit', () => { try { server.kill(); } catch {} });
const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 120; i++) { try { const r = await fetch(base + '/health'); if (r.ok) break; } catch {} await sleep(500); }

const browser = await chromium.launch({channel: 'msedge'});
const context = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: W < 700, locale: LANG === 'ko' ? 'ko-KR' : LANG === 'mn' ? 'mn-MN' : 'en-US'});
const page = await context.newPage();
const errors = [], bad = [];
page.on('pageerror', e => errors.push('페이지 ' + String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('콘솔 ' + m.text().slice(0, 300)); });
page.on('response', r => { const u = r.url(); if (r.status() >= 400 && !/\/api\//.test(u)) bad.push(`${r.status()} ${u.replace(base, '')}`); });
const frontAsked = []; page.on('request', q => { if (/\/world-front\//.test(q.url())) frontAsked.push(q.url()); });
const shot = async name => { if (SHOTS) await page.screenshot({path: path.join(OUT, name + '.png')}); };
const F = () => page.frames().find(f => f.url().includes('/world-front/'));
const inF = (fn, arg) => F().evaluate(fn, arg);
const until = async (what, fn, ms = 30000) => { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) { check(false, what, '시간 초과'); return null; } await sleep(150); } };
async function finish() {
  check(!errors.length, '콘솔 · 페이지 오류 0', errors.slice(0, 4).join(' | '));
  check(!bad.length, '404 · 400대 응답 0', bad.slice(0, 4).join(' | '));
  fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify({폭: `${W}x${H}`, 언어: LANG, 꺼짐: OFF, 통과: log.filter(l => l.startsWith('통과')).length, 실패: fail, 기록: log}, null, 1));
  console.log(fail.length ? `실패 ${fail.length}건` : '모두 통과');
  await browser.close(); server.kill(); process.exit(fail.length ? 1 : 0);
}

// ── 서울행을 끝낸 손님 기록 ──
const night = Date.now() - 90e3;
const arrival = {version: 1, stage: 'left', dream: 'idol', name: '볼로르', nameEn: 'Bolor', call: '언니', from: '몽골', look: 'mn_f',
  best: {s1e01: {n: 3, t2: true, tr: false}}, scenes: [{id: 's1e01.wrap', at: night, lines: 4}], momAnswer: 'fix', momAt: night, updatedAt: night};
await page.goto(`${base}/mobile.html${OFF ? '' : '?frontAuto=1'}`, {waitUntil: 'domcontentloaded'});
await page.evaluate(({lang, arrival}) => {
  if (lang !== 'ko') localStorage.setItem('synk.world.lang', lang);
  localStorage.setItem('synk.world.arrival.v1:guest', JSON.stringify(arrival));
}, {lang: LANG, arrival});
await page.reload({waitUntil: 'domcontentloaded'});
await until('타이틀', () => page.evaluate(() => window.__synkOpening?.stage?.() === 'title'));
await sleep(800);
check(!await page.evaluate(() => !!document.querySelector('#front-layer')), '타이틀 아래에 앞면 틀이 없음');
await page.mouse.click(W / 2, H * .55);

if (OFF) {
  await until('지금 길(입장 관문 또는 동네)', () => page.evaluate(() => document.querySelector('#world-panel')?.open || document.querySelector('#seoul-layer') || window.__synkOpening?.stage?.() !== 'title'), 20000);
  await sleep(1500); await shot('꺼짐');
  check(!await page.evaluate(() => !!document.querySelector('#front-layer')), '스위치를 끄면 앞면 층이 안 뜸');
  check(frontAsked.length === 0, '앞면 파일을 받지 않음', frontAsked.slice(0, 3).join(' '));
  await finish();
}

// ── 첫날 끝 ──
await until('앞면 틀', () => page.evaluate(() => document.querySelector('#front-layer')?.open) && F(), 20000);
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
  await until('한글 답 뒤 할 일 줄', () => inF(() => !document.querySelector('[data-hangul]') && !!document.querySelector('[data-act="bye"]')), 8000);
  await sleep(1500); await shot('1b-한글답');
  const tomorrow = await inF(() => document.querySelector('.view')?.innerText || '');
  check(!/몽글|까몽|마린/.test(tomorrow), '내일 할 일 줄에 마스코트 이름이 안 보임');
}

// ── 「오늘은 여기까지」 → 불 끔 ──
const bye = await F().$('[data-act="bye"]');
check(!!bye, '「오늘은 여기까지」 단추가 있음');
if (bye) {
  await bye.click();
  await until('불 끈 화면', () => inF(() => !!document.querySelector('.view.night.off')), 8000);
  await sleep(2500); await shot('2-불끔');
  const mark = await page.evaluate(() => JSON.parse(localStorage.getItem('synk.world.front.v1:guest') || '{}'));
  check(mark.ended === true, '첫날 끝을 기기에 적음');
}

// ── 같은 날 다시 열면 첫날 맞춤 ──
await page.reload({waitUntil: 'domcontentloaded'});
// 같은 탭에서는 오프닝을 본 뒤라 타이틀 없이 바로 들어갈 수 있다
if (await until('다시 연 타이틀 또는 앞면', () => page.evaluate(() => window.__synkOpening?.stage?.() === 'title' || !!document.querySelector('#front-layer')?.open)) && await page.evaluate(() => window.__synkOpening?.stage?.() === 'title')) { await sleep(800); await page.mouse.click(W / 2, H * .55); }
await until('다시 연 앞면', () => page.evaluate(() => document.querySelector('#front-layer')?.open) && F(), 20000);
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
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('synk.world.front.v1:guest') || '{}').after);
      check(!after, '열기만 하고 닫으면 「첫 연습」을 적지 않음');
    }
  }
}
await finish();
