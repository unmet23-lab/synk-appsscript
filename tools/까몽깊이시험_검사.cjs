'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const runtime=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=runtime('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/_ops/삼디문지기/깊이시험');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file:///'+path.join(dir,'실험보기.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.depthReady===true);await page.evaluate(()=>document.fonts.ready);
const qa=await page.evaluate(()=>({depth:window.depthQA,images:[...document.querySelectorAll('img')].map(i=>[i.naturalWidth,i.naturalHeight]),fonts:document.fonts.status}));
qa.viewports=[];for(const width of[1200,390]){await page.setViewportSize({width,height:900});qa.viewports.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));}
await page.setViewportSize({width:1200,height:900});await page.locator('.pair').nth(0).screenshot({path:path.join(dir,'부위점_실물.png')});
qa.states=[];for(const x of[-.3,0,.3]){await page.locator('#view').evaluate((e,x)=>{e.value=String(x);e.dispatchEvent(new Event('input'));},x);qa.states.push(await page.locator('#position').textContent());}
await page.locator('.pair').nth(1).screenshot({path:path.join(dir,'시점오른쪽_비교.png')});
await page.locator('#mesh').check();await page.locator('#depth').check();await page.locator('.pair').nth(1).screenshot({path:path.join(dir,'깊이값_비교.png')});
await page.locator('#reset').click();qa.reset=await page.evaluate(()=>({x:document.getElementById('view').value,depth:document.getElementById('depth').checked}));
await page.locator('#mesh').uncheck();await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(dir,'실험보기_390.png'),fullPage:true});
qa.errors=errors;qa.checkedAt=new Date().toISOString();qa.pass=errors.length===0&&qa.viewports.every(v=>v.scrollWidth<=v.width)&&qa.states.join(',')==='-0.30,0.00,0.30'&&qa.reset.x==='0'&&qa.reset.depth===false;
fs.writeFileSync(path.join(dir,'화면검사.json'),JSON.stringify(qa,null,2));console.log(JSON.stringify(qa,null,2));if(!qa.pass)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
