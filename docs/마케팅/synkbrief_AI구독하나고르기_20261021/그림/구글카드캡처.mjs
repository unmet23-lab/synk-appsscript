// 06 장면용: 구글 원 요금 페이지의 Google AI Pro 카드(기간 한정 40% 할인 띠 포함)만 3배로 뜬다.
// 쿠키 알림은 누르지 않는다(동의 버튼) — 카드를 화면 위쪽으로 올려 아래 고정 알림과 겹치지 않게 뜬다.
//   node docs/마케팅/synkbrief_AI구독하나고르기_20261021/그림/구글카드캡처.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '화면', 'google-aipro-카드-3x.png');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 3, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const page = await ctx.newPage();
await page.goto('https://one.google.com/about/google-ai-plans/?hl=ko', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
const el = page.getByText('₩29,000/월').first();
const card = await el.evaluateHandle((n) => {
  let e = n;
  while (e && e.parentElement) {
    const r = e.getBoundingClientRect();
    if (r.width >= 220 && r.width <= 700 && r.height >= 280 && r.height <= 1400) return e;
    e = e.parentElement;
  }
  return n;
});
await card.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 40));
await page.waitForTimeout(800);
const box = await card.boundingBox();
console.log(JSON.stringify(box));
await page.screenshot({ path: OUT, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 1600 - box.y - 120) } });
console.log('저장', OUT, new Date().toISOString());
await browser.close();
