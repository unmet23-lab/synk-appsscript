// OpenAI 도움말 「Using locked chats in ChatGPT」와 릴리스 노트(10-20) 실제 화면을 뜬다(로그인 없음 · 쿠키 동의 누르지 않음).
//   node docs/마케팅/synkbrief_ChatGPT대화잠그기_20261021/그림/화면캡처.mjs
// 확인 화면(봇 확인)이 뜨면 넘기려 하지 않고 그대로 멈춘다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '화면');
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [
  { id: 'help-locked', url: 'https://help.openai.com/en/articles/20001411-using-locked-chats-in-chatgpt' },
  { id: 'release-notes', url: 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes' },
];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1500 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'Asia/Seoul' });
const log = {};
for (const p of PAGES) {
  const page = await ctx.newPage();
  await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const title = await page.title();
  log[p.id] = { url: page.url(), title, at: new Date().toISOString() };
  if (/잠시만|Just a moment|Attention/i.test(title)) { console.log('확인 화면 — 멈춤', p.id); await page.close(); continue; }
  await page.screenshot({ path: path.join(OUT, `${p.id}-전체.png`), fullPage: true });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, '뜬시각.json'), JSON.stringify(log, null, 1) + '\n');
console.log(JSON.stringify(log, null, 1));
