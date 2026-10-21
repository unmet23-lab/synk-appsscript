// 세 회사 공식 요금 페이지와 구글 할인 공지를 실제 화면 그대로 뜬다(로그인 없음 · 쿠키는 비필수 거부).
//   node docs/마케팅/synkbrief_AI구독하나고르기_20261021/그림/화면캡처.mjs
// 페이지마다 전체 화면(1280폭 · 2배)과, 요금 글자를 품은 카드만 오린 판을 그림/화면/에 둔다. 뜬 시각은 화면/뜬시각.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '화면');
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [
  { id: 'chatgpt', url: 'https://chatgpt.com/ko-KR/pricing/', cards: ['₩0', '₩13,000', '₩29,000'], reject: '비필수사항 거부' },
  { id: 'google', url: 'https://one.google.com/about/google-ai-plans/?hl=ko', cards: ['₩7,500/월', '₩29,000/월'] },
  { id: 'claude', url: 'https://claude.com/ko/pricing', cards: ['$0', '$18'] },
  { id: 'google-blog', url: 'https://blog.google/intl/ko-kr/company-news/google-gemini-ai-pro-campaign-kr/', cards: [] },
];

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const log = {};
for (const p of PAGES) {
  const page = await ctx.newPage();
  await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  for (const t of [p.reject, '비필수사항 거부', '모두 거부', 'Reject all', '거부'].filter(Boolean)) {
    const b = page.getByRole('button', { name: t, exact: true });
    if (await b.count().catch(() => 0)) { await b.first().click().catch(() => {}); await page.waitForTimeout(800); break; }
  }
  await page.screenshot({ path: path.join(OUT, `${p.id}-위.png`) });
  await page.screenshot({ path: path.join(OUT, `${p.id}-전체.png`), fullPage: true });
  // 요금 글자 → 그 글자를 품은 카드(가로 220~700px, 세로 280~1400px인 가장 가까운 조상)
  for (const price of p.cards) {
    const el = page.getByText(price, { exact: false }).first();
    if (!(await el.count())) { console.log('못 찾음', p.id, price); continue; }
    const card = await el.evaluateHandle((n) => {
      let e = n;
      while (e && e.parentElement) {
        const r = e.getBoundingClientRect();
        if (r.width >= 220 && r.width <= 700 && r.height >= 280 && r.height <= 1400) return e;
        e = e.parentElement;
      }
      return n;
    });
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    const name = `${p.id}-카드-${price.replace(/[^\d$₩]/g, '')}.png`;
    await card.screenshot({ path: path.join(OUT, name) });
    console.log('카드', name);
  }
  log[p.id] = { url: page.url(), title: await page.title(), at: new Date().toISOString() };
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, '뜬시각.json'), JSON.stringify(log, null, 1) + '\n');
console.log(JSON.stringify(log, null, 1));
