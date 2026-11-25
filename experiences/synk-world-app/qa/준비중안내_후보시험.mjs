// WORLD 배우기 · 놀이 「준비 중」 안내 — 공개 후보를 실제 synk.im/world 위에서 돌린다(공개본은 바꾸지 않는다).
//   node experiences/synk-world-app/qa/준비중안내_후보시험.mjs <후보 폴더(cand)> <캡처 폴더>
//   node experiences/synk-world-app/qa/준비중안내_후보시험.mjs --공개본 <캡처 폴더>      공개 뒤: 끼우지 않고 공개본 그대로
// 후보 폴더가 아는 /world/ 파일만 page.route로 후보 바이트를 내주고 나머지는 지금 공개본을 받는다. 후보의 새 ?v= 주소는 네트워크로 내보내지 않는다
// (공개 전에 새 ?v= 주소를 부르면 CDN이 옛 내용을 그 주소로 10분 묶는다 — 현장 노트 배포_공개).
// 첫 실행을 마친 손님 기기(한글 답 · 튜터)로 들어가 배우기 판 팩 카드 · 지금 할 일과 놀이 판 게임 카드를 눌러 안내 판을 확인하고 닫는다.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createLifeProgress} from '../life-progress.mjs';
import {SOON_TEXT,reserveHref} from '../world-learn-soon.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const live = process.argv.includes('--공개본');
const rest = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [cand, out] = live ? [null, rest[0]] : rest;
if (!out) throw Error('쓰는 법: <후보 폴더> <캡처 폴더> 또는 --공개본 <캡처 폴더>');
fs.mkdirSync(out, {recursive: true});

const files = new Map();
if (!live) (function walk(dir, rel = '') {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;   // 공개.js가 남긴 .앞판(지금 공개본 사본)은 후보가 아니다
    const full = path.join(dir, name), r = `${rel}/${name}`;
    if (fs.statSync(full).isDirectory()) walk(full, r); else if (rel) files.set(r, full);
  }
})(cand);
// 새 토큰: 후보 쪽에만 있는 ?v= 값(지금 공개본 쪽에 있는 값은 그대로 받아도 된다)
const tokensOf = html => new Set([...html.matchAll(/[?&]v=([0-9a-f]{8,64})/g)].map(m => m[1]));
const newTokens = new Set();
for (const [r, f] of files) if (r.endsWith('.html')) {
  const now = await fetch(`https://synk.im${r.replace(/index.html$/, '')}?probe=${Date.now()}`, {cache: 'no-store'}).then(x => x.ok ? x.text() : '');
  const old = tokensOf(now);
  for (const t of tokensOf(fs.readFileSync(f, 'utf8'))) if (!old.has(t)) newTokens.add(t);
}
const type = f => f.endsWith('.html') ? 'text/html; charset=utf-8' : /\.(mjs|js)$/.test(f) ? 'text/javascript; charset=utf-8' : f.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream';

// exam: 시험 목표(TOPIK I 2급)를 저장해 홈 「이번 주 계획」이 보이게 한다.
function seeded({exam = false} = {}) {
  const values = new Map(), storage = {getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k)};
  const life = createLifeProgress({storage, owner: 'guest', now: () => Date.now()});
  life.setHangulReading('reads', {via: 'question'}); life.selectTutor('mongle');
  if (exam) life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['exam'],primaryReason:'exam',examType:'topik1',targetGrade:2}});
  return Object.fromEntries(values);
}

const result = {mode: live ? '공개본' : '후보', checks: {}};
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  for (const [lang, width, height, exam = false] of [['mn', 390, 844], ['ko', 1440, 900, true], ['en', 390, 844]]) {
    const tag = `${width}-${lang}`, text = SOON_TEXT[lang];
    const seen = result.checks[tag] = {blocked: [], errors: [], failed: [], served: new Set(), leaked: []};
    const context = await browser.newContext({viewport: {width, height}, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce'});
    context.setDefaultTimeout(30000);
    if (!live) await context.route('https://synk.im/world/**', route => {
      const u = new URL(route.request().url()), p = u.pathname === '/world/' ? '/world/index.html' : u.pathname, f = files.get(p);
      if (f) { seen.served.add(p); return route.fulfill({status: 200, body: fs.readFileSync(f), headers: {'content-type': type(f), 'cache-control': 'no-store'}}); }
      const v = u.searchParams.get('v');
      if (v && newTokens.has(v)) { seen.leaked.push(u.href); return route.abort(); }
      return route.continue();
    });
    await context.addInitScript(({seed, lang}) => {
      if (window.top !== window || localStorage.getItem('qa.seeded')) return;
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem('synk.world.lang', lang); localStorage.setItem('qa.seeded', '1');
    }, {seed: seeded({exam}), lang});
    const page = await context.newPage();
    page.on('pageerror', e => seen.errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && /synk\.im/.test(r.url())) seen.failed.push(`${r.status()} ${r.url()}`); });
    await page.goto(`https://synk.im/world/?opening=off&lang=${lang}`, {waitUntil: 'domcontentloaded', timeout: 60000});
    // 첫 실행(언어 → 한글 질문 → 튜터)이 남아 있으면 지나간다(world-learn-soon-browser.test.mjs와 같은 길).
    await page.waitForFunction(() => ['ready', 'welcome'].includes(window.__synkWorld?.client.status));
    await page.waitForFunction(() => document.querySelector('[data-lang-picker]') || document.querySelector('dialog[open] [data-first-hangul]') || document.querySelector('dialog[open] .tutor-option') || document.querySelector('.world-shell')?.dataset.entry === 'ready');
    if (await page.locator('[data-lang-picker]').count()) { await page.locator(`[data-lang-choice="${lang}"]`).click(); await page.locator('[data-lang-confirm]').click(); }
    await page.waitForFunction(() => document.querySelector('dialog[open] [data-first-hangul]') || document.querySelector('dialog[open] .tutor-option') || document.querySelector('.world-shell')?.dataset.entry === 'ready');
    if (await page.locator('dialog[open] [data-first-hangul="reads"]').count()) await page.locator('dialog[open] [data-first-hangul="reads"]').click();
    await page.waitForFunction(() => document.querySelector('dialog[open] .tutor-option') || document.querySelector('.world-shell')?.dataset.entry === 'ready');
    if (await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()) { await page.locator('.tutor-option[data-tutor-id="mongle"]').click(); await page.locator('.tutor-primary').click(); await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(() => {}); }
    await page.waitForFunction(() => document.querySelector('.world-shell')?.dataset.entry === 'ready' && !document.querySelector('dialog[open] .tutor-option'));
    seen.lang = await page.evaluate(() => document.documentElement.lang);
    const press = async (selector, name, screen) => {
      const target = page.locator(selector).first(); await target.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => document.querySelector('#panel-title')?.textContent);
      await target.click({force: true}); await page.waitForSelector('dialog.learn-soon[open]'); await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.querySelector('dialog.learn-soon[open] .learn-soon-art')?.complete === true);
      const state = await page.evaluate(({screen}) => {
        const box = document.querySelector('dialog.learn-soon[open]'), r = box.getBoundingClientRect();
        return {title: box.querySelector('.learn-soon-title')?.textContent, lead: box.querySelector('.learn-soon-lead')?.textContent, reserve: box.querySelector('.learn-soon-reserve')?.getAttribute('href') || null,
          screen: !!document.querySelector(`#panel-content ${screen}`), panelTitle: document.querySelector('#panel-title')?.textContent, frames: document.querySelectorAll('.game-frame').length,
          inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, art: box.querySelector('.learn-soon-art')?.naturalWidth > 0};
      }, {screen});
      await page.screenshot({path: path.join(out, `${tag}-${name}.png`)});
      await page.locator('dialog.learn-soon [data-learn-soon-close]').click(); await page.waitForFunction(() => !document.querySelector('dialog.learn-soon[open]'));
      const ok = state.title === text.title && state.lead === text.lead && state.reserve === reserveHref(lang) && state.screen && state.panelTitle === before && state.frames === 0 && state.inView && state.art;
      seen.blocked.push({name, ok, ...state});
    };
    // 우리 동네 홈 카드의 「내 위치 보기」(11-24 「홈도 막기」)와 홈 「학습 목표」 판 안의 「내 위치 보기」 줄(11-25 Fable P2):
    // 내 위치 판을 열지 않고 안내를 띄운다. 판 상태(열림 · 제목)는 누르기 전 그대로다. 그림은 그려진 뒤에 찍는다(11-25 Fable P3).
    const pressKeep = async (selector, name) => {
      const panelNow = () => page.evaluate(() => ({panel: !!document.querySelector('#world-panel[open]'), title: document.querySelector('#world-panel[open] #panel-title')?.textContent || null}));
      const before = await panelNow();
      await page.locator(selector).first().click({force: true}); await page.waitForSelector('dialog.learn-soon[open]');
      await page.waitForFunction(() => { const img = document.querySelector('dialog.learn-soon[open] .learn-soon-art'); return !!img && img.complete && img.naturalWidth > 0; });
      await page.evaluate(() => document.querySelector('dialog.learn-soon[open] .learn-soon-art')?.decode().catch(() => {}));
      const state = await page.evaluate(() => {
        const box = document.querySelector('dialog.learn-soon[open]'), r = box.getBoundingClientRect(), img = box.querySelector('.learn-soon-art');
        return {title: box.querySelector('.learn-soon-title')?.textContent, reserve: box.querySelector('.learn-soon-reserve')?.getAttribute('href') || null, art: !!img && img.naturalWidth > 0,
          inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, panel: !!document.querySelector('#world-panel[open]'), panelTitle: document.querySelector('#world-panel[open] #panel-title')?.textContent || null};
      });
      await page.screenshot({path: path.join(out, `${tag}-${name}.png`)});
      await page.locator('dialog.learn-soon [data-learn-soon-close]').click(); await page.waitForFunction(() => !document.querySelector('dialog.learn-soon[open]'));
      const ok = state.title === text.title && state.reserve === reserveHref(lang) && state.art && state.inView && state.panel === before.panel && state.panelTitle === before.title;
      seen.blocked.push({name, ok, ...state});
    };
    await pressKeep('.life-home-board [data-view="position"]', 'home-position');
    if (exam) { await page.waitForFunction(() => { const b = document.querySelector('#study-plan-button'); return !!b && !b.hidden; }); await pressKeep('#study-plan-button', 'home-plan'); }
    await page.locator('.life-home-board [data-view="study"]').first().click(); await page.waitForSelector('#world-panel[open] #panel-content .study-position-row');
    await pressKeep('#panel-content .study-position-row', 'study-position');
    await page.locator('#panel-close').click(); await page.waitForFunction(() => !document.querySelector('#world-panel[open]'));
    await page.locator('nav [data-view="packs"]').click(); await page.waitForSelector('#panel-content .life-hub .life-pack-card');
    await page.screenshot({path: path.join(out, `${tag}-learn.png`)});
    await press('#panel-content .life-pack-card >> nth=2', 'pack-card', '.life-hub');
    await press('#panel-content .life-now button', 'up-next', '.life-hub');
    await page.locator('#panel-close').click(); await page.waitForFunction(() => !document.querySelector('#world-panel[open]'));
    await page.locator('nav [data-view="play"]').click(); await page.waitForSelector('#panel-content .play-list [data-game]');
    await press('#panel-content .play-list [data-game] >> nth=0', 'game', '.play-list');
    seen.docOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    seen.served = [...seen.served];
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, (k, v) => v instanceof Set ? [...v] : v, 1));
}
const bad = Object.entries(result.checks).flatMap(([tag, c]) => [
  ...c.blocked.filter(b => !b.ok).map(b => `${tag} ${b.name}`), ...c.errors.map(e => `${tag} 오류 ${e}`), ...c.failed.map(f => `${tag} 실패 요청 ${f}`), ...c.leaked.map(u => `${tag} 새 토큰 요청 ${u}`),
  ...(c.docOverflow > 0 ? [`${tag} 가로 넘침 ${c.docOverflow}`] : []), ...(c.lang !== tag.split('-')[1] ? [`${tag} 언어 ${c.lang}`] : []),
  ...(!live && c.served.length < files.size ? [`${tag} 후보를 끼우지 못함(${c.served.length}/${files.size})`] : [])]);
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.checks).map(([k, v]) => [k, {blocked: v.blocked.map(b => b.name + (b.ok ? ' ✓' : ' ✗')), served: [...v.served], failed: v.failed, errors: v.errors.length}]))));
if (bad.length) { console.error('걸림:\n' + bad.join('\n')); process.exitCode = 1; } else console.log(`통과 — ${result.mode} · ${Object.keys(result.checks).length}판`);
