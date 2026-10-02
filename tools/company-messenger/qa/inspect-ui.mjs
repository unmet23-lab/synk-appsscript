// Local visual inspection helper; Playwright is a development tool, not an app dependency.
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const playwrightPath = process.env.MESSENGER_PLAYWRIGHT || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {chromium} = require(playwrightPath);
const browser = await chromium.launch({executablePath: process.env.MESSENGER_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
const page = await browser.newPage({viewport:{width:1440,height:960}, deviceScaleFactor:1});
const issues=[];
page.on('pageerror',e=>issues.push(e.message));
page.on('console',m=>{if(m.type()==='error')issues.push(m.text());});
try {
  await page.goto(process.env.MESSENGER_URL || 'http://127.0.0.1:4197');
  await page.waitForFunction(()=>!document.querySelector('.boot'),null,{timeout:10000});
  await page.evaluate(()=>document.fonts.ready);
  await mkdir(path.join(root,'qa-output'),{recursive:true});
  await page.screenshot({path:path.join(root,'qa-output/setup-desktop.png'),fullPage:true});
  console.log(JSON.stringify({text:await page.locator('body').innerText(),inputs:await page.locator('input').evaluateAll(xs=>xs.map(x=>({id:x.id,name:x.name,type:x.type,placeholder:x.placeholder}))),issues},null,2));
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(root,'qa-output/setup-mobile.png'),fullPage:true});
}finally{await browser.close();}
