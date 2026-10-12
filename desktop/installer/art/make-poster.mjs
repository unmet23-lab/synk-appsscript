// poster.html을 2배 해상도 PNG로 찍어 설치 창 포스터 바탕(poster-platform.png)을 만든다.
// 사용: PLAYWRIGHT_MODULE=<playwright/index.mjs 경로> CHROME=<chrome.exe 경로> node make-poster.mjs
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const module=process.env.PLAYWRIGHT_MODULE;
if(!module)throw Error('PLAYWRIGHT_MODULE에 playwright/index.mjs 경로를 주세요.');
const {chromium}=await import(pathToFileURL(module).href);
const browser=await chromium.launch({executablePath:process.env.CHROME||undefined,args:['--force-color-profile=srgb']});
try{
  const page=await browser.newPage({viewport:{width:308,height:428},deviceScaleFactor:2});
  await page.goto(pathToFileURL(join(here,'poster.html')).href);
  await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
  await page.locator('#poster').screenshot({path:join(here,'poster-platform.png'),omitBackground:true});
  console.log('poster-platform.png');
}finally{await browser.close();}
