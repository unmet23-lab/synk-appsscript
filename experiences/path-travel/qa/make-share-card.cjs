#!/usr/bin/env node
// 서울 하루(/try/travel/) 공유 카드 굽기(2026-11-14).
// PATH 카드를 굽는 SYNK-website site-v10/make-og.mjs와 같은 설정이다. 1440×756 창을 두 배로 찍어 1200×630 JPEG(품질 84)로 줄인다.
// 그림 아래 끝에 반쯤 걸리는 조건 막대(#conditions-panel)와 「장소 둘러보기」(#explore)는 숨기고 찍는다.
// 다 구우면 experiences/path-travel/index.html의 og:image · twitter:image 주소 끝 ?v=를 새 그림의 sha256 앞 12자리로 고쳐 쓴다.
// 첫 화면의 제목이나 고르기 이름이 바뀌었으면 og:image:alt도 손으로 맞춘다(tests/path-travel-share-card.test.mjs가 어긋남을 알려 준다).
// 사용: node experiences/path-travel/qa/make-share-card.cjs [--url https://synk.im/try/travel/]
//   --url은 찍을 주소다. 공개 전 판을 찍으려면 공개 후보를 내는 이 PC 서버 주소를 준다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const repo = path.resolve(__dirname, '..', '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const URL = opt('--url', 'https://synk.im/try/travel/');
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));
const sharp = require(path.join(repo, 'desktop', 'node_modules', 'sharp'));
const OUT = path.join(repo, 'experiences', 'path-travel', 'assets', 'og-travel-ko.jpg');
const HTML = path.join(repo, 'experiences', 'path-travel', 'index.html');

(async () => {
  const browser = await chromium.launch({ channel: process.env.OG_CHANNEL || 'chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 756 }, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'ko-KR' });
    const page = await ctx.newPage();
    await page.goto(URL + (URL.includes('?') ? '&' : '?') + 'og=' + Date.now(), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { for (const s of ['#conditions-panel', '#explore', '.skip']) for (const e of document.querySelectorAll(s)) e.style.visibility = 'hidden'; scrollTo(0, 0); });
    await page.waitForFunction(() => [...document.images].filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; }).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    await page.waitForTimeout(800);
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).resize(1200, 630, { kernel: 'lanczos3' }).jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(OUT);
  } finally { await browser.close(); }
  const v = crypto.createHash('sha256').update(fs.readFileSync(OUT)).digest('hex').slice(0, 12);
  const html = fs.readFileSync(HTML, 'utf8');
  const next = html.replace(/(https:\/\/synk\.im\/try\/travel\/assets\/og-travel-ko\.jpg\?v=)[0-9a-f]{12}/g, `$1${v}`);
  if (next !== html) fs.writeFileSync(HTML, next);
  console.log(`${path.relative(repo, OUT)} ${fs.statSync(OUT).size}바이트 · ?v=${v}${next !== html ? ' · index.html 표식 고침' : ' · 표식 그대로'}`);
})().catch(e => { console.error(e); process.exit(1); });
