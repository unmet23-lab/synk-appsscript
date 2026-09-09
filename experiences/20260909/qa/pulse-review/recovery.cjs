const fs=require('node:fs');const path=require('node:path');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createExperienceServer}=require('../../server.cjs');
const results={};let browser,app;
(async()=>{
 app=createExperienceServer({root:'C:/Users/q1212/Documents/SYNK-worktrees/pulse-20260909/experiences/20260909'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});
 const c=await browser.newContext({viewport:{width:1440,height:960}}),p=await c.newPage();
 await p.goto(base+'/pulse/');await p.locator('#loading').waitFor({state:'hidden',timeout:60000});
 results.tabOrder=[];
 for(let i=0;i<12;i++){await p.keyboard.press('Tab');results.tabOrder.push(await p.evaluate(()=>{const el=document.activeElement;return {tag:el.tagName,id:el.id,cls:el.className,label:el.getAttribute('aria-label')||el.textContent.slice(0,65),effectiveOpacity:(()=>{let n=el,x=1;while(n instanceof Element){x*=+getComputedStyle(n).opacity;n=n.parentElement;}return x})()}}));}
 await p.locator('#dual-start').click();await p.waitForFunction(()=>document.querySelector('#experience').dataset.phase==='explore');
 const code=await p.locator('#room-code').textContent();
 await p.locator('#object-nav').getByRole('button',{name:/멈춘 전차/}).click();await p.locator('.private-clue').first().waitFor();
 await p.locator('#display-toggle').click();await p.locator('#motion-choice').selectOption('reduce');
 results.motion={choice:await p.locator('html').getAttribute('data-synk-motion-choice'),effective:await p.locator('html').getAttribute('data-synk-motion')};
 await p.locator('#leave-room').click();await p.locator('#resume-room').waitFor({state:'visible'});
 await p.locator('#resume-room').click();await p.locator('#story-panel').waitFor({state:'visible'});
 results.resumeAfterPause={sameRoom:(await p.locator('#room-code').textContent())===code,privateClues:await p.locator('.private-clue').count()};
 await p.reload();await p.waitForFunction(()=>document.querySelector('#experience').dataset.phase==='explore');
 results.reloadAfterPause={sameRoom:(await p.locator('#room-code').textContent())===code,role:await p.locator('#current-role').textContent()};
 await c.close();
 const f=await browser.newContext({viewport:{width:390,height:844}});await f.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:original.call(this,type,...args)};});
 const q=await f.newPage();await q.goto(base+'/pulse/');await q.locator('#fallback').waitFor({state:'visible'});await q.locator('#dual-start').click();await q.waitForFunction(()=>document.querySelector('#experience').dataset.phase==='explore');
 await q.locator('#object-nav').getByRole('button',{name:/멈춘 전차/}).click();await q.locator('.private-clue').first().waitFor();results.webglFallback={visible:await q.locator('#fallback').isVisible(),privateClues:await q.locator('.private-clue').count()};await f.close();
})().catch(e=>{results.error=e.message;process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(app)app.close();fs.writeFileSync(path.join(__dirname,'recovery.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));});
