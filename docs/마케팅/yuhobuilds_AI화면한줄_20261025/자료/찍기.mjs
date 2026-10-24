// Y5 실험 화면 찍기 — node 찍기.mjs <html 폴더> [<옮길 폴더>]
// 폴더 안 *.html을 (옮길 폴더가 있으면 그리로 복사한 뒤) 1280×800 첫 화면 · 전체 · 390×844 휴대폰 첫 화면으로 찍는다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { chromium } = require(path.join(루트, 'node_modules/playwright'));

const [원천, 옮길곳] = process.argv.slice(2);
const 폴더 = 옮길곳 || 원천;
fs.mkdirSync(폴더, { recursive: true });
const 파일들 = fs.readdirSync(원천).filter((f) => f.endsWith('.html'));
if (옮길곳) for (const f of 파일들) fs.copyFileSync(path.join(원천, f), path.join(옮길곳, f));

const 브라우저 = await chromium.launch({ channel: 'chrome' });
for (const f of 파일들) {
  const 파일 = path.join(폴더, f);
  const 이름 = f.replace(/\.html$/, '');
  for (const [꼬리, viewport, 전체] of [['', { width: 1280, height: 800 }, false], ['_전체', { width: 1280, height: 800 }, true], ['_폰', { width: 390, height: 844 }, false]]) {
    const 쪽 = await 브라우저.newPage({ viewport, deviceScaleFactor: 꼬리 === '_폰' ? 2 : 1 });
    await 쪽.goto(pathToFileURL(path.resolve(파일)).href, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await 쪽.waitForTimeout(2000);
    await 쪽.screenshot({ path: path.join(폴더, `${이름}${꼬리}.png`), fullPage: 전체 });
    await 쪽.close();
  }
  console.log('찍음', 이름);
}
await 브라우저.close();
