#!/usr/bin/env node
// synk.im 새 홈(v11) 공개 전 확인 — 후보(짓기.mjs 출력)를 공개본 위에 얹어 https://synk.im/** 에 끼워 연다(2026-11-20).
// 공개본 바이트는 도구 전용 bare 사본(origin/main)에서 읽고, synk.im에는 요청을 한 번도 보내지 않는다(새 ?v= 주소를 CDN에 묶지 않게 —
// 현장 노트 「공개 전에 후보의 새 ?v= 주소를 synk.im에 부르면」). 바깥 사이트 요청은 끊고 목록으로만 남긴다.
//
//   node 살펴보기.mjs og [--out <후보>]                 공유 그림 열여섯 장을 공개빌드/og/에 찍는다(홈은 ?sky=day, 1200×630)
//   node 살펴보기.mjs 확인 [--out <후보>] [--찍기 <폴더>]  쪽 열여섯 × 1440 · 1024 · 390: 가로 넘침 · 콘솔 · 페이지 오류 · 실패 요청 · axe 치명/심각,
//                                                       홈: 자주 묻는 질문 · 직접 쓴 질문 · 들어오는 주소 · 하늘 셋 · 앨범 열 장, /lab/ 질문창
//   node 살펴보기.mjs 찍기 <주소…> [--폭 1440,390] [--찍기 <폴더>] [--전체]   화면을 찍는다(주소는 /korean/ 꼴)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '..', '..', '..', '..');
const require = createRequire(path.join(저장소, 'package.json'));
const { chromium, firefox } = require('playwright');
const 인자 = process.argv.slice(2), 명령 = 인자[0];
const 옵션 = (k, d) => { const i = 인자.indexOf(k); return i >= 0 ? 인자[i + 1] : d; };
const 후보 = path.resolve(옵션('--out', path.join(저장소, '.tmp', 'synk-home-v11', 'out')));
const 찍을곳 = path.resolve(옵션('--찍기', path.join(저장소, '.tmp', 'synk-home-v11', 'shots')));
const 사본 = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const 머리 = JSON.parse(fs.readFileSync(path.join(path.dirname(후보), '빌드.json'), 'utf8')).공개본;
const AXE = fs.readFileSync(path.join(저장소, 'tools', 'vendor', 'axe.min.js'), 'utf8');

const 종류 = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', xml: 'application/xml', svg: 'image/svg+xml', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', avif: 'image/avif', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wasm: 'application/wasm', ico: 'image/x-icon', glb: 'model/gltf-binary' };
const 공개캐시 = new Map();
function 공개본(p) {
  if (공개캐시.has(p)) return 공개캐시.get(p);
  let b = null;
  try {
    const 줄 = execFileSync('git', ['--git-dir', 사본, 'ls-tree', 머리, '--', p], { env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).toString().trim();
    if (줄 && 줄.split(/\s+/)[1] === 'blob') {
      const oid = 줄.split(/\s+/)[2];
      try { b = execFileSync('git', ['--git-dir', 사본, 'cat-file', 'blob', oid], { env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 30 }); }
      catch { execFileSync('git', ['--git-dir', 사본, 'fetch', '-q', '--no-tags', '--filter=blob:none', 'origin', oid]); b = execFileSync('git', ['--git-dir', 사본, 'cat-file', 'blob', oid], { maxBuffer: 1 << 30 }); }
    }
  } catch {}
  공개캐시.set(p, b);
  return b;
}
function 찾기(pathname) {
  let p = decodeURIComponent(pathname).replace(/^\//, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  const f = path.join(후보, p);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return { 몸: fs.readFileSync(f), 곳: '후보', p };
  const b = 공개본(p);
  return b ? { 몸: b, 곳: '공개본', p } : null;
}
async function 맥락(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr || 1, isMobile: viewport.width < 600 && browser.browserType().name() === 'chromium', hasTouch: viewport.width < 600, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  const 기록 = { 바깥: [], 실패: [], 후보파일: new Set() };
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'synk.im') { 기록.바깥.push(u.href.slice(0, 120)); return route.abort(); }
    const r = 찾기(u.pathname);
    if (!r) { 기록.실패.push('404 ' + u.pathname); return route.fulfill({ status: 404, body: 'not found' }); }
    if (r.곳 === '후보') 기록.후보파일.add(r.p);
    const ext = r.p.split('.').pop().toLowerCase();
    return route.fulfill({ status: 200, body: r.몸, headers: { 'content-type': 종류[ext] || 'application/octet-stream', 'cache-control': 'no-store' } });
  });
  return { ctx, 기록 };
}
const 쪽목록 = () => {
  const 쪽 = [];
  const walk = (d, pre = '') => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) { if (n !== 'assets') walk(f, pre + n + '/'); } else if (n === 'index.html') 쪽.push('/' + pre); } };
  walk(후보);
  return 쪽.sort();
};
const og이름 = p => { const en = p.startsWith('/en/'); const k = p.replace(/^\/en\//, '/').replace(/\//g, '') || 'home'; return k + '-' + (en ? 'en' : 'ko'); };
async function 끝까지(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
}
async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => { const r = await window.axe.run(document, { resultTypes: ['violations'] }); return r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, 곳: v.nodes.slice(0, 3).map(x => x.target.join(' ')) })); });
}

async function og() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  fs.mkdirSync(path.join(여기, 'og'), { recursive: true });
  for (const p of 쪽목록()) {
    const { ctx } = await 맥락(browser, { width: 1200, height: 630 }, { reduce: true });
    const page = await ctx.newPage();
    await page.goto('https://synk.im' + p + '?from=qa&sky=day&still', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1200);
    const f = path.join(여기, 'og', og이름(p) + '.jpg');
    await page.screenshot({ path: f, type: 'jpeg', quality: 82 });
    console.log('og', p, fs.statSync(f).size);
    await ctx.close();
  }
  await browser.close();
}

async function 확인() {
  fs.mkdirSync(찍을곳, { recursive: true });
  const 결과 = { 쪽: [], 홈: [], 문제: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const 문제 = t => { 결과.문제.push(t); console.log('  ✗ ' + t); };
  const 고른 = 옵션('--쪽', '').split(',').filter(Boolean);
  for (const p of 쪽목록().filter(p => !고른.length || 고른.includes(p))) for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const { ctx, 기록 } = await 맥락(browser, vp, { dpr: vp.width < 600 ? 2 : 1 });
    const page = await ctx.newPage(), 콘솔 = [], 오류 = [];
    page.on('console', m => { if (m.type() === 'error') 콘솔.push(m.text().slice(0, 160)); });
    page.on('pageerror', e => 오류.push(String(e).slice(0, 160)));
    page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).hostname === 'synk.im') 기록.실패.push(r.status() + ' ' + new URL(r.url()).pathname); });
    await page.goto('https://synk.im' + p + '?from=qa', { waitUntil: 'load', timeout: 90000 });
    await 끝까지(page);
    const 폭 = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
    const 글꼴 = await page.evaluate(() => [...document.fonts].filter(f => f.family.includes('SYNK')).map(f => f.status).join(','));
    const 위반 = vp.width === 1024 ? [] : await axe(page);
    if (vp.width !== 1024) await page.screenshot({ path: path.join(찍을곳, `${og이름(p)}-${vp.width}.png` ) });
    const 줄 = { p, w: vp.width, 넘침: 폭.scroll > 폭.inner + 1 ? `${폭.scroll}/${폭.inner}` : '', 콘솔, 오류, 실패: [...new Set(기록.실패)], 바깥: [...new Set(기록.바깥)].length, 글꼴, 위반 };
    결과.쪽.push(줄);
    const 나쁨 = [줄.넘침 && '넘침 ' + 줄.넘침, ...오류.map(x => '오류 ' + x), ...콘솔.map(x => '콘솔 ' + x), ...줄.실패.map(x => '실패 ' + x), ...위반.filter(v => v.impact === 'critical').map(v => `axe 치명 ${v.id} ${v.곳.join(' , ')}`), 글꼴 !== 'loaded' && '글꼴 ' + 글꼴].filter(Boolean);
    console.log(`${p} ${vp.width} ${나쁨.length ? '✗ ' + 나쁨.join(' | ') : '통과'}${위반.length ? ' · axe 심각 ' + 위반.filter(v => v.impact === 'serious').map(v => v.id + '×' + v.n).join(',') : ''}`);
    for (const x of 나쁨) 문제(`${p} ${vp.width}: ${x}`);
    await ctx.close();
  }
  // 바닥 링크를 실제로 누를 수 있는가 — 링크 가운데를 덮는 것이 그 링크(또는 그 안)여야 한다(Opus 대체 최종 검수 F1: 큰 「synk」 글자가 덮었다)
  for (const p of 쪽목록().filter(p => !고른.length || 고른.includes(p))) for (const width of [1024, 1440, 1920]) {
    const { ctx } = await 맥락(browser, { width, height: 900 });
    const page = await ctx.newPage();
    await page.goto(`https://synk.im${p}?from=qa&still`, { waitUntil: 'load' });
    // 늦게 차는 그림으로 쪽이 길어지므로 높이가 멈출 때까지 맨 아래로 내린 뒤 잰다(다시 검수 FA1)
    // 쪽이 부드러운 스크롤을 쓰므로 순간 이동으로 내린다(내리는 도중에 재면 바닥이 화면 밖이다)
    for (let k = 0, 앞 = -1; k < 12; k++) { const h = await page.evaluate(() => { scrollTo({ top: 1e7, behavior: 'instant' }); return document.documentElement.scrollHeight; }); await page.waitForTimeout(500); if (h === 앞) break; 앞 = h; }
    await page.evaluate(() => scrollTo({ top: 1e7, behavior: 'instant' })); await page.waitForTimeout(300);
    const { 잰, 덮임 } = await page.evaluate(() => { const 보임 = [...document.querySelectorAll('.foot a, .foot button')].filter(a => { const r = a.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight; });
      return { 잰: 보임.length, 덮임: 보임.map(a => { const r = a.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el && (el === a || a.contains(el)) ? null : `${a.textContent.trim().slice(0, 20)} ← ${el ? el.tagName + '.' + el.className : '없음'}`; }).filter(Boolean) }; });
    if (!잰) 문제(`${p} ${width} 바닥 링크를 하나도 재지 못함(바닥이 화면에 없다)`);
    if (덮임.length) 문제(`${p} ${width} 바닥 링크가 덮임: ${덮임.join(' · ')}`);
    await ctx.close();
  }
  console.log('바닥 링크 누름 자리 확인 끝');
  // 키보드: 다섯 곳 줄(열린 칸 안 링크에 Tab으로 닿음) · 휴대폰 메뉴(열면 첫 항목, Escape로 닫고 단추로) · 길 무대(마지막 핀 다음 Tab이 단계 카드로)
  for (const lang of ['ko', 'en']) {
    const 앞 = lang === 'en' ? '/en' : '';
    { const { ctx } = await 맥락(browser, { width: 1440, height: 900 }); const page = await ctx.newPage();
      await page.goto(`https://synk.im${앞}/classroom/?from=qa`, { waitUntil: 'load' });
      const 첫줄 = page.locator('[data-hang] .lines li').first();
      await 첫줄.scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
      await 첫줄.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
      await page.keyboard.press('Tab'); await page.waitForTimeout(200);
      const 칸안 = await page.evaluate(() => Boolean(document.activeElement?.closest('.hang-pane.on')));
      await 첫줄.focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
      const 줄 = await page.evaluate(() => { const rows = [...document.querySelectorAll('[data-hang] .lines li')]; return { 초점: rows.indexOf(document.activeElement), 열림: rows.findIndex(r => r.classList.contains('on')), 탭: rows.map(r => r.tabIndex).join('') }; });
      if (줄.초점 !== 1 || 줄.열림 !== 1 || 줄.탭 !== '-10-1') 문제(`${lang} 교실 줄 방향키 ${JSON.stringify(줄)}`);
      if (!칸안) 문제(`${lang} 교실 열린 칸 안 링크에 Tab이 닿지 않음`);
      await ctx.close(); }
    { const { ctx } = await 맥락(browser, { width: 390, height: 844 }); const page = await ctx.newPage();
      await page.goto(`https://synk.im${앞}/?from=qa`, { waitUntil: 'load' });
      await page.locator('.menu-btn').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
      const 열림 = await page.evaluate(() => ({ 열림: document.querySelector('.nav').classList.contains('open'), 첫항목: document.activeElement === document.querySelector('.nav ul a') }));
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const 닫힘 = await page.evaluate(() => ({ 닫힘: !document.querySelector('.nav').classList.contains('open'), 단추: document.activeElement === document.querySelector('.menu-btn') }));
      if (!열림.열림 || !열림.첫항목 || !닫힘.닫힘 || !닫힘.단추) 문제(`${lang} 메뉴 키보드 ${JSON.stringify({ ...열림, ...닫힘 })}`);
      // 복사 안내: 비어 있을 때 링크 묶음 높이를 늘리지 않고, 글이 들어가면 링크와 같은 600 16px(최종 검수 b F1)
      const 복사 = await page.evaluate(async () => { const links = document.querySelector('.ask-links'), out = document.querySelector('#ask-out'), 자리 = out.nextSibling;
        const 있을때 = links.getBoundingClientRect().height; out.remove(); const 없을때 = links.getBoundingClientRect().height; links.insertBefore(out, 자리);
        document.querySelector('#ask-copy').click(); await new Promise(r => setTimeout(r, 300)); const s = getComputedStyle(out);
        return { 틈: Math.round(있을때 - 없을때), 글: out.textContent.length > 0, 크기: s.fontSize, 굵기: s.fontWeight, 안: out.parentElement === links }; });
      if (복사.틈 !== 0 || !복사.글 || 복사.크기 !== '16px' || 복사.굵기 !== '600' || !복사.안) 문제(`${lang} 복사 안내 자리 ${JSON.stringify(복사)}`);
      await ctx.close(); }
    { const { ctx } = await 맥락(browser, { width: 1440, height: 900 }); const page = await ctx.newPage();
      await page.goto(`https://synk.im${앞}/?from=qa`, { waitUntil: 'load' });
      const 핀 = page.locator('.w-pins button').last(); await 핀.scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await 핀.focus();
      await page.keyboard.press('Tab'); await page.waitForTimeout(1500);
      const 카드 = await page.evaluate(() => { const a = document.activeElement, s = a?.closest('.w-say'); return { 카드: Boolean(s), 보임: s ? +getComputedStyle(s).opacity : 0 }; });
      if (!카드.카드 || 카드.보임 < .5) 문제(`${lang} 길 무대 Tab이 단계 카드로 가지 않음 ${JSON.stringify(카드)}`);
      await ctx.close(); }
  }
  console.log('키보드 확인 끝');
  // 홈: 질문창 · 들어오는 주소 · 하늘 · 앨범
  for (const lang of ['ko', 'en']) {
    const 앞 = lang === 'en' ? '/en' : '';
    const { ctx } = await 맥락(browser, { width: 1440, height: 900 });
    const page = await ctx.newPage(), 오류 = [];
    page.on('pageerror', e => 오류.push(String(e).slice(0, 160)));
    await page.goto(`https://synk.im${앞}/?from=qa`, { waitUntil: 'load' });
    const q = page.locator('.faq-q').first();
    await q.scrollIntoViewIfNeeded(); await q.click();
    await page.waitForFunction(() => document.querySelector('#faq-a-1')?.querySelector('.qa-a'), null, { timeout: 20000 }).catch(() => {});
    const 첫답 = await page.evaluate(() => ({ 열림: document.querySelector('.faq-q').getAttribute('aria-expanded'), 글: document.querySelector('#faq-a-1')?.innerText.replace(/\s+/g, ' ').slice(0, 160) }));
    await page.locator('#faq-a-1').screenshot({ path: path.join(찍을곳, `ask-faq-${lang}.png`) }).catch(() => {});
    await page.fill('#question', lang === 'en' ? 'How do I download the PC app?' : 'PC 앱은 어떻게 받나요?');
    await page.click('#send');
    await page.waitForFunction(() => document.querySelector('#messages .qa-a'), null, { timeout: 20000 }).catch(() => {});
    const 쓴답 = await page.evaluate(() => document.querySelector('#messages')?.innerText.replace(/\s+/g, ' ').slice(0, 200));
    await page.locator('#messages').screenshot({ path: path.join(찍을곳, `ask-typed-${lang}.png`) }).catch(() => {});
    결과.홈.push({ lang, 첫답, 쓴답, 오류: [...오류] });
    console.log(lang, '자주 묻는 질문:', JSON.stringify(첫답).slice(0, 220)); console.log(lang, '직접 쓴 질문:', 쓴답);
    if (첫답.열림 !== 'true' || !첫답.글 || 첫답.글.length < 30) 문제(`${lang} 자주 묻는 질문 답이 안 나옴`);
    if (!쓴답 || 쓴답.length < 30) 문제(`${lang} 직접 쓴 질문 답이 안 나옴`);
    for (const x of 오류) 문제(`${lang} 질문창 오류 ${x}`);
    // 앨범 열 장
    for (let i = 0; i < 10; i++) { await page.click('#p-next'); await page.waitForTimeout(520); }
    const 앨범 = await page.evaluate(() => [...document.querySelectorAll('#p-shelf img')].map(i => i.complete && i.naturalWidth > 0).filter(Boolean).length);
    if (앨범 !== 10) 문제(`${lang} 앨범 표지 ${앨범}/10`);
    await ctx.close();
    // 들어오는 주소
    const 넘기는곳 = ['#atlas', '#principles', '#philosophy', '#drama', '#founder', '#founder-quote'];
    for (const h of ['#platform', '#platform-get', '#now', '#contact', '#business', '#top', '#lab', ...넘기는곳]) {
      const { ctx: c2 } = await 맥락(browser, { width: 1440, height: 900 });
      const pg = await c2.newPage();
      // 넘어간 쪽이 열리는지도 본다(문서 응답이 200이 아니면 문제)
      const 문서 = [];
      pg.on('response', r => { if (r.request().resourceType() === 'document') 문서.push([r.url(), r.status()]); });
      await pg.goto(`https://synk.im${앞}/?from=qa${h}`, { waitUntil: 'load' }); await pg.waitForTimeout(3300);
      for (const [u, st] of 문서) if (st !== 200) 문제(`${lang} ${h} → ${u} 응답 ${st}`);
      const 자리 = await pg.evaluate(h => { const el = document.getElementById(h.slice(1)); return { 주소: location.pathname + location.hash, 위: el ? Math.round(el.getBoundingClientRect().top) : null }; }, h);
      console.log(lang, h, JSON.stringify(자리));
      if (넘기는곳.includes(h)) { if (자리.주소.startsWith(앞 + '/') && 자리.주소 === 앞 + '/' + h) 문제(`${lang} ${h}가 넘어가지 않음`); }
      else if (자리.위 === null || Math.abs(자리.위) > 120) 문제(`${lang} ${h} 자리 ${자리.위}`);
      await c2.close();
    }
    // 하늘 셋 · 세로
    for (const sky of ['day', 'sunset', 'night']) for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const { ctx: c3, 기록 } = await 맥락(browser, vp);
      const pg = await c3.newPage();
      pg.on('response', r => { if (r.status() >= 400) 기록.실패.push(r.status() + ' ' + new URL(r.url()).pathname); });
      await pg.goto(`https://synk.im${앞}/?from=qa&sky=${sky}`, { waitUntil: 'load' }); await 끝까지(pg);
      if (기록.실패.length) 문제(`${lang} 하늘 ${sky} ${vp.width}: ${[...new Set(기록.실패)].join(', ')}`);
      await c3.close();
    }
  }
  // /lab/ 질문창(고친 knowledge.json으로)
  {
    const { ctx, 기록 } = await 맥락(browser, { width: 1440, height: 900 });
    const page = await ctx.newPage(), 오류 = [];
    page.on('pageerror', e => 오류.push(String(e).slice(0, 160)));
    await page.goto('https://synk.im/lab/?from=qa', { waitUntil: 'load' });
    await page.evaluate(q => { const i = document.querySelector('#question'); i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#question-form').requestSubmit(); }, 'SYNK는 어떤 회사인가요?');
    await page.waitForFunction(() => document.querySelector('#messages .qa-a'), null, { timeout: 20000 }).catch(() => {});
    const 답 = await page.evaluate(() => document.querySelector('#messages')?.innerText.replace(/\s+/g, ' ').slice(0, 240));
    console.log('/lab/ 질문창:', 답, '· 후보 파일', [...기록.후보파일].join(','));
    if (!답 || !답.includes('셋')) 문제('/lab/ 질문창 답에 새 짜임이 안 보임');
    for (const x of 오류) 문제('/lab/ 오류 ' + x);
    await ctx.close();
  }
  await browser.close();
  // Firefox로 홈 한 번(글꼴 · 오류)
  try {
    const fb = await firefox.launch({ headless: true });
    for (const p of ['/', '/en/', '/korean/']) {
      const { ctx } = await 맥락(fb, { width: 1440, height: 900 });
      const page = await ctx.newPage(), 오류 = [];
      page.on('pageerror', e => 오류.push(String(e).slice(0, 160)));
      await page.goto('https://synk.im' + p + '?from=qa', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const 글꼴 = await page.evaluate(() => [...document.fonts].filter(f => f.family.includes('SYNK')).map(f => f.status).join(','));
      await page.screenshot({ path: path.join(찍을곳, `firefox-${og이름(p)}.png`) });
      console.log('firefox', p, 글꼴, 오류.join(' | ') || '오류 0');
      if (글꼴 !== 'loaded') 문제(`firefox ${p} 글꼴 ${글꼴}`);
      for (const x of 오류) 문제(`firefox ${p} 오류 ${x}`);
      await ctx.close();
    }
    await fb.close();
  } catch (e) { console.log('firefox 못 엶: ' + String(e).split('\n')[0]); }
  fs.writeFileSync(path.join(찍을곳, '확인.json'), JSON.stringify(결과, null, 1));
  console.log(결과.문제.length ? `문제 ${결과.문제.length}건` : '문제 0건');
  process.exit(결과.문제.length ? 1 : 0);
}

async function 찍기() {
  const 주소들 = 인자.slice(1).filter(a => a.startsWith('/'));
  const 폭들 = 옵션('--폭', '1440,390').split(',').map(Number);
  fs.mkdirSync(찍을곳, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const u of 주소들) for (const w of 폭들) {
    const vp = { width: w, height: w < 600 ? 844 : 900 };
    const { ctx } = await 맥락(browser, vp, { dpr: w < 600 ? 2 : 1 });
    const page = await ctx.newPage();
    await page.goto('https://synk.im' + u + (u.includes('?') ? '&' : '?') + 'from=qa', { waitUntil: 'load' });
    await 끝까지(page);
    const 이름 = u.replace(/[^\w가-힣-]+/g, '_').replace(/^_|_$/g, '') || 'home';
    await page.screenshot({ path: path.join(찍을곳, `찍기-${이름}-${w}.png`), fullPage: 인자.includes('--전체') });
    console.log('찍음', u, w);
    await ctx.close();
  }
  await browser.close();
}

// 검수 묶음 그림: 전 = 승인된 시안(시안 폴더를 http://127.0.0.1:4973/에 끼움), 후 = 공개 후보. 같은 자리를 같은 이름으로 찍는다
// (검수묶음.mjs 준비 --캡처 <폴더>가 읽는 꼴: 전|후/<폭>/<이름>.png). 홈은 구역마다, 상세 쪽은 첫 화면과 바닥.
const 시안폴더 = path.join(여기, '..', '시안');
async function 시안맥락(browser, vp) {
  const { ctx, 기록 } = await 맥락(browser, vp, { dpr: 1 });
  await ctx.route('http://127.0.0.1:4973/**', route => {
    const u = new URL(route.request().url()); let p = decodeURIComponent(u.pathname).replace(/^\//, ''); if (!p || p.endsWith('/')) p += 'index.html';
    const f = path.join(시안폴더, p);
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': 종류[p.split('.').pop()] || 'application/octet-stream' } });
  });
  return { ctx, 기록 };
}
async function 묶음그림() {
  const 곳 = path.resolve(옵션('--곳', path.join(path.dirname(후보), '검수그림')));
  fs.rmSync(곳, { recursive: true, force: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const 상세id = { korean: 'korean', classroom: 'classroom', 'study-abroad': 'study', job: 'job', community: 'community', ai: 'ai', studio: 'ad' };
  const 일 = [];
  for (const lang of ['ko', 'en']) {
    const 앞 = lang === 'en' ? '/en' : '', 시안앞 = lang === 'en' ? 'en/' : '';
    일.push({ 이름: `home-${lang}`, 후: `https://synk.im${앞}/?from=qa`, 전: `http://127.0.0.1:4973/${시안앞}index.html`, 자리: ['#gate', '#glance', '#why', '#news', '#ask', '#start', '#platform', '.foot'], 폭: [1440, 390] });
    for (const [주소, id] of Object.entries(상세id)) 일.push({ 이름: `${주소}-${lang}`, 후: `https://synk.im${앞}/${주소}/?from=qa&still`, 전: `http://127.0.0.1:4973/${시안앞}detail.html?p=${id}&still`, 자리: ['top', '.foot'], 폭: lang === 'ko' ? [1440, 390] : [1440] });
  }
  for (const 할 of 일) for (const w of 할.폭) for (const 판 of ['전', '후']) {
    const vp = { width: w, height: w < 600 ? 844 : 900 };
    const { ctx } = 판 === '전' ? await 시안맥락(browser, vp) : await 맥락(browser, vp, { dpr: 1 });
    const page = await ctx.newPage();
    await page.goto(할[판], { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await 끝까지(page);
    for (const [k, sel] of 할.자리.entries()) {
      const y = await page.evaluate(sel => { if (sel === 'top') return 0; const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null; }, sel);
      if (y === null) continue;
      if (sel === '#ask') { const b = page.locator('.faq button').first(); await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(400); await b.click().catch(() => {}); await page.waitForTimeout(2500); }
      await page.evaluate(v => scrollTo(0, v), sel === '.foot' ? 1e7 : y); await page.waitForTimeout(1300);
      const 파일 = path.join(곳, 판, String(w), `${할.이름}-${String(k + 1).padStart(2, '0')}-${sel.replace(/[^\w]/g, '') || 'top'}.png`);
      fs.mkdirSync(path.dirname(파일), { recursive: true });
      await page.screenshot({ path: 파일 });
    }
    await ctx.close();
    console.log('찍음', 판, w, 할.이름);
  }
  await browser.close();
  console.log(곳);
}

if (명령 === '묶음그림') await 묶음그림();
else if (명령 === 'og') await og();
else if (명령 === '확인') await 확인();
else if (명령 === '찍기') await 찍기();
else { console.error('용법: node 살펴보기.mjs og|확인|찍기 …'); process.exit(2); }
