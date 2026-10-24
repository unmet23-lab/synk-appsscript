// 휴대폰 첫 화면(390×844)에서 큰 제목 · 버튼 · 이모지 그림의 자리를 잰다 — 영상에서 버터 테를 칠 곳.
// node 상자.mjs <html…>  → JSON(파일마다 {title, buttons[], emoji[]}, 단위 CSS px)
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { chromium } = require(path.join(루트, 'node_modules/playwright'));

const 브라우저 = await chromium.launch({ channel: 'chrome' });
const 결과 = {};
for (const f of process.argv.slice(2)) {
  const 쪽 = await 브라우저.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await 쪽.goto(pathToFileURL(path.resolve(f)).href, { waitUntil: 'networkidle' }).catch(() => {});
  await 쪽.waitForTimeout(1500);
  결과[path.basename(f, '.html')] = await 쪽.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const 보임 = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.y < 844 && b.bottom > 0; };
    const 제목 = [...document.querySelectorAll('h1, h2')].filter(보임).sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0];
    const 버튼 = [...document.querySelectorAll('a, button')].filter(보임).filter((el) => {
      const s = getComputedStyle(el);
      return (s.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(s.borderTopWidth) > 0) && parseFloat(s.paddingTop) >= 8 && el.getBoundingClientRect().y > 80;
    }).slice(0, 3).map((el) => ({ ...r(el), 글: el.textContent.trim().slice(0, 20) }));
    const 이모지 = [];
    const 훑기 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (훑기.nextNode()) {
      const n = 훑기.currentNode;
      if (/\p{Extended_Pictographic}/u.test(n.textContent) && 보임(n.parentElement)) 이모지.push({ ...r(n.parentElement), 글: n.textContent.trim().slice(0, 6), 크기: getComputedStyle(n.parentElement).fontSize });
    }
    return { 제목: 제목 ? { ...r(제목), 글: 제목.textContent.trim().slice(0, 24) } : null, 버튼, 이모지 };
  });
  await 쪽.close();
}
await 브라우저.close();
console.log(JSON.stringify(결과, null, 1));
