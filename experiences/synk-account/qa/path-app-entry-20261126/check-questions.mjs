// /path/ · /en/path/ 질문창에서 PATH 답을 열어 글과 단추 목적지를 잰다. 후보의 knowledge.json만 끼운다.
//   node check-questions.mjs <후보 폴더 | -> <캡처 폴더>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [cand, shots] = process.argv.slice(2);
fs.mkdirSync(shots, { recursive: true });
const files = cand === '-' ? {} : { '/knowledge.json': 'knowledge.json', '/en/knowledge.json': 'en/knowledge.json' };
const browser = await chromium.launch({ channel: 'chrome' });
const result = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route('https://synk.im/**', route => {
    const hit = files[new URL(route.request().url()).pathname];
    return hit ? route.fulfill({ body: fs.readFileSync(path.join(cand, hit)), contentType: 'application/json; charset=utf-8' }) : route.continue();
  });
  for (const [lang, url, asks] of [
    ['ko', 'https://synk.im/path/', ['유학 준비를 어떻게 돕나요?', 'PATH는 어떤 곳인가요?', 'PATH의 비전은 무엇인가요?', 'PATH의 유학·취업 지원은 어디까지 하나요?']],
    ['en', 'https://synk.im/en/path/', ['How does PATH help me plan my studies?', 'What is PATH?', 'What is the vision of PATH?', 'How far does PATH’s study and job support go?']],
  ]) {
    const page = await context.newPage(); const bad = [];
    page.on('pageerror', e => bad.push('오류 ' + e.message)); page.on('console', m => m.type() === 'error' && bad.push('콘솔 ' + m.text().slice(0, 160)));
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(2000);
    let n = 0;
    for (const ask of asks) {
      n++;
      await page.fill('#question', ask); await page.click('#send'); await page.waitForTimeout(1800);
      const last = await page.evaluate(() => { const m = [...document.querySelectorAll('#messages > *')].pop(); return m ? { text: m.innerText.replace(/\s+/g, ' ').slice(0, 700), links: [...m.querySelectorAll('a')].map(a => a.innerText.trim() + ' → ' + a.getAttribute('href')) } : null; });
      await page.locator('#messages > *').last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(shots, `${lang}-${n}-${w}.png`) });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      result.push({ lang, w, ask, over, bad: [...bad], ...last });
    }
    await page.close();
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(shots, 'questions.json'), JSON.stringify(result, null, 1));
for (const r of result) console.log(JSON.stringify(r));
