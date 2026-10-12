// background.html을 1배(660×448)·2배(1320×896) PNG로 찍는다. electron-builder가 두 장을 Retina용 TIFF로 묶는다.
// 사용: PLAYWRIGHT_MODULE=<playwright/index.mjs 경로> CHROME=<chrome.exe 경로> node make-background.mjs
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
if(!process.env.PLAYWRIGHT_MODULE)throw Error('PLAYWRIGHT_MODULE에 playwright/index.mjs 경로를 주세요.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({executablePath:process.env.CHROME||undefined,args:['--force-color-profile=srgb']});
try{
  for(const [scale,name] of [[1,'background.png'],[2,'background@2x.png']]){
    const page=await browser.newPage({viewport:{width:660,height:448},deviceScaleFactor:scale});
    await page.goto(pathToFileURL(join(here,'background.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('#bg').screenshot({path:join(here,name)});
    console.log(name);
    await page.close();
  }
}finally{await browser.close();}
