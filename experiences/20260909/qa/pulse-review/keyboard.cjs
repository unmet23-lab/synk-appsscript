const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createExperienceServer}=require('../../server.cjs');let app,browser;const result={actions:[]};
async function press(page,locator,label){await locator.waitFor({state:'visible'});for(let i=0;i<100;i++){if(await locator.isDisabled()){await page.waitForTimeout(50);continue;}if(await locator.evaluate(el=>el===document.activeElement)){await page.keyboard.press('Enter');result.actions.push(label);return;}await page.keyboard.press('Tab');}throw Error('Keyboard could not reach '+label);}
(async()=>{
 app=createExperienceServer({root:'C:/Users/q1212/Documents/SYNK-worktrees/pulse-20260909/experiences/20260909'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'chrome',headless:true});const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await c.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:original.call(this,type,...args)};});
 const p=await c.newPage();await p.goto('http://127.0.0.1:'+app.server.address().port+'/pulse/');await p.locator('#fallback').waitFor({state:'visible'});
 await press(p,p.locator('#dual-start'),'start two roles');await p.waitForFunction(()=>document.querySelector('#experience').dataset.phase==='explore');
 await press(p,p.locator('#object-nav').getByRole('button',{name:/멈춘 전차/}),'inspect tram');
 for(let i=0;i<2;i++){await press(p,p.getByRole('button',{name:'이 단서 함께 나누기 →',exact:true}).first(),'share signal '+(i+1));await p.waitForFunction(n=>document.querySelector('#shared-count').textContent===String(n),i+1);}
 await press(p,p.locator('#role-switch').getByRole('button',{name:/방송 기록원/}),'switch to archive');await p.waitForFunction(()=>document.querySelector('#current-role').textContent==='방송 기록원' && document.querySelector('#connection').dataset.status==='online' && !document.querySelector('#objective').textContent.includes('펼치는 중'));
 await press(p,p.locator('#object-nav').getByRole('button',{name:/작은 방송국/}),'inspect radio');
 for(let i=0;i<2;i++){await press(p,p.getByRole('button',{name:'이 단서 함께 나누기 →',exact:true}).first(),'share archive '+(i+1));await p.waitForFunction(n=>document.querySelector('#shared-count').textContent===String(n),i+3);}
 await p.waitForFunction(()=>document.querySelector('#experience').dataset.phase==='vote');await press(p,p.locator('#open-vote'),'open vote');
 await press(p,p.locator('[data-choice="homes"]'),'archive votes homes');
 await press(p,p.locator('#role-switch').getByRole('button',{name:/전차 정비사/}),'switch to signal');await p.waitForFunction(()=>document.querySelector('#current-role').textContent==='전차 정비사'&&document.querySelector('#connection').dataset.status==='online' && !document.querySelector('#objective').textContent.includes('펼치는 중'));
 await press(p,p.locator('[data-choice="homes"]'),'signal votes homes');await press(p,p.locator('#finalize'),'finalize');await p.waitForFunction(()=>document.querySelector('#experience').dataset.phase==='ended');
 assert((await p.locator('#ending').innerText()).includes('서로의 창문'));result.ending='서로의 창문';result.completed=true;
})().catch(e=>{result.error=e.message;process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(app)app.close();fs.writeFileSync(path.join(__dirname,'keyboard.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
