import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const here=path.dirname(fileURLToPath(import.meta.url)),errors=[],results=[];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const width of [1440,320]){
  const context=await browser.newContext({viewport:{width,height:1000}}),p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:5213/');await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:path.join(here,`final-${width}-landing.png`),fullPage:true});await p.locator('#start').click();
  for(let i=0;i<20;i++){if(await p.evaluate(()=>window.__storyState.phase==='play'))break;await p.locator('#dialogue-next').click();}
  await p.locator('[data-actor="kkamong"]').click();await p.locator('[data-object="paper"]').click();await p.locator('#cancel-selection').click();assert.equal(await p.evaluate(()=>window.__storyState.held),null);await p.locator('[data-object="paper"]').click();await p.locator('[data-destination="drawer"]').click();// 드는 층은 걷기 390ms 뒤 510ms 동안만 켜진다. 정해진 500ms 뒤에 보면 느린 실행에서 이미 내려놓은 뒤(955)라 흔들렸다. 드는 동안을 기다려 그 순간의 층을 잰다.
  const carryLayer=await (await p.waitForFunction(()=>{const e=document.querySelector('[data-object="paper"]');return e.classList.contains('carried')?e.style.zIndex:false;},null,{polling:'raf',timeout:5000})).jsonValue();assert.equal(carryLayer,'1300');await p.locator('#stage').screenshot({path:path.join(here,`final-${width}-carrying.png`)});await p.waitForFunction(()=>!window.__storyState.busy);assert.equal(await p.evaluate(()=>window.__storyState.scene.paper),'drawer');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);results.push({width,cancelSelection:true,visibleCarryingLayer:true,correctPlacement:true,overflow:false});await context.close();
 }
 assert.deepEqual(errors,[]);
 const sourceHashes=Object.fromEntries(await Promise.all(['app.mjs','stage.mjs','core.mjs','story.mjs','audio.mjs','index.html','style.css'].map(async name=>[name,createHash('sha256').update(await readFile(path.join(here,'..',name))).digest('hex')])));
 await writeFile(path.join(here,'final-smoke.json'),JSON.stringify({date:new Date().toISOString(),pass:true,results,errors,sourceHashes},null,2)+'\n');console.log(JSON.stringify({pass:true,results,errors},null,2));
}finally{await browser.close();}
