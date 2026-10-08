import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {EPISODE} from '../story.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=path.dirname(fileURLToPath(import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results={date:new Date().toISOString(),url:'http://127.0.0.1:5213/',checks:[],errors:[],badRequests:[],screenshots:[]};
function track(page){page.on('pageerror',e=>results.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)results.badRequests.push({url:r.url(),status:r.status()});});}
async function state(page){return page.evaluate(()=>window.__storyState);}
async function idle(page){await page.waitForFunction(()=>window.__storyState&&!window.__storyState.busy);}
async function picture(page,name){await page.screenshot({path:path.join(output,name),fullPage:true,animations:'disabled'});results.screenshots.push(name);}
async function throughDialogue(page,target='play'){
 for(let i=0;i<35;i++){const s=await state(page);if(s.phase===target)return;if(['play','review','complete'].includes(s.phase))throw Error(`Unexpected play barrier: ${s.phase}, expected ${target}`);await page.locator('#dialogue-next').click();}
 throw Error('Dialogue did not reach target');
}
async function move(page,actor,object,destination){const s=await state(page);if(s.held&&s.held!==object)await page.locator('#cancel-selection').click();if(s.actor!==actor)await page.locator(`[data-actor="${actor}"]`).click();if((await state(page)).held!==object)await page.locator(`[data-object="${object}"]`).click();await page.locator(`[data-destination="${destination}"]`).click();await idle(page);}
function record(s,id){return s.records.find(r=>r.id===id);}
async function measure(page,label){await page.evaluate(()=>Promise.allSettled([...document.images].map(i=>i.decode())));const r=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,fonts:document.fonts.check('500 18px "SUIT Variable"'),images:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),missions:[...document.querySelectorAll('.mission-copy p')].map(e=>({text:e.textContent,size:getComputedStyle(e).fontSize})),actors:[...document.querySelectorAll('[data-actor]:not(.teacher)')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,disabled:e.disabled};})}));assert.equal(r.overflow,false,`${label} horizontal overflow`);assert.equal(r.fonts,true);assert.deepEqual(r.images,[]);results.checks.push({label,...r});}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();track(page);
 await page.goto(results.url);await page.evaluate(()=>document.fonts.ready);await measure(page,'desktop landing');await picture(page,'desktop-landing.png');
 await page.locator('#start').click();
 for(let i=0;i<3;i++)await page.locator('#dialogue-next').click();
 assert.equal((await state(page)).dialogueIndex,3);await page.waitForTimeout(750);await picture(page,'desktop-teacher.png');
 await throughDialogue(page);await measure(page,'desktop first scene');await picture(page,'desktop-play.png');
 await page.locator('#journal').click();assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);assert.match(await page.locator('#modal').textContent(),/교실이 왜 이렇게/);await page.keyboard.press('Escape');assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
 await move(page,'kkamong','paper','bin');let s=await state(page);assert.equal(s.scene.paper,'bin');assert.equal(record(s,'cleanup-paper').firstCorrect,false);assert.match(await page.locator('#dialogue-text').textContent(),/종이는 버리면 안 돼/);await picture(page,'desktop-wrong.png');
 await page.locator('#undo').click();s=await state(page);assert.equal(s.scene.paper,'floor');assert.equal(record(s,'cleanup-paper').firstCorrect,false);
 await move(page,'kkamong','paper','drawer');await move(page,'marin','snacks','box');assert.equal((await state(page)).phase,'outro');
 // Reopen the last successful action; the first response remains a fact.
 await page.locator('#undo').click();s=await state(page);assert.equal(s.phase,'play');assert.equal(record(s,'cleanup-snacks').firstCorrect,true);await move(page,'marin','snacks','box');
 await throughDialogue(page);
 await move(page,'kkamong','letter','board');s=await state(page);assert.equal(record(s,'clue-letter').mistakes[0].kind,'order');assert.equal(s.completedIds.includes('clue-letter'),false);
 await page.locator('#undo').click();await page.locator('#hint').click();assert.equal((await state(page)).records.some(r=>r.helpUsed),true);
 await move(page,'marin','flowers','table');s=await state(page);assert.equal(s.completedIds.includes('clue-letter'),false);
 // Save/reload happens after an actual move; there is no test-only solve hook.
 const before=s.scene;await page.reload();await page.locator('#resume').click();s=await state(page);assert.deepEqual(s.scene,before);assert.equal(s.phase,'play');assert.equal(s.actIndex,1);
 await move(page,'kkamong','letter','board');await throughDialogue(page);await move(page,'kkamong','cake','table');await move(page,'marin','ribbon','board');assert.equal((await state(page)).phase,'outro');
 await throughDialogue(page,'review');await page.waitForTimeout(180);await picture(page,'desktop-party.png');
 // A remembered answer from act one is incorrect for the new written request.
 await move(page,'marin','snacks','box');s=await state(page);assert.equal(record(s,'review-snacks').firstCorrect,false);await page.locator('#undo').click();
 for(const m of EPISODE.review)await move(page,m.actor,m.object,m.destination);
 s=await state(page);assert.equal(s.phase,'complete');assert.equal(s.records.filter(r=>r.completed).length,9);await measure(page,'desktop ending');await picture(page,'desktop-ending.png');
 await page.locator('#see-reading').click();assert.equal(await page.locator('.recap-items article').count(),9);await page.keyboard.press('Escape');
 results.checks.push({label:'story, mistakes, undo, order, hints, save/resume, changed review, all nine completed',records:s.records});
 // A completed session also remains resumable.
 await page.reload();await page.locator('#resume').click();assert.equal((await state(page)).phase,'complete');await context.close();

 for(const width of [780,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:width===780?1100:844},hasTouch:width<780,isMobile:width<780,reducedMotion:'reduce'}),p=await ctx.newPage();track(p);await p.goto(results.url);await p.evaluate(()=>document.fonts.ready);await picture(p,`mobile-${width}-landing.png`);await measure(p,`${width}px landing`);await p.locator('#start').click();await throughDialogue(p);await measure(p,`${width}px play`);await picture(p,`mobile-${width}-play.png`);
  if(width===390){
   await p.locator('[data-actor="kkamong"]').tap();const from=await p.locator('[data-object="paper"]').boundingBox(),to=await p.locator('[data-destination="drawer"]').boundingBox();
   await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();await p.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:16});await p.mouse.up();await idle(p);assert.equal((await state(p)).scene.paper,'drawer');assert.equal((await state(p)).completedIds.includes('cleanup-paper'),true);
   await p.locator('#sound').tap();assert.equal(await p.locator('#sound').getAttribute('aria-pressed'),'false');await move(p,'marin','snacks','box');await throughDialogue(p);for(const m of EPISODE.acts[1].missions)await move(p,m.actor,m.object,m.destination);await throughDialogue(p);for(const m of EPISODE.acts[2].missions)await move(p,m.actor,m.object,m.destination);await throughDialogue(p,'review');for(const m of EPISODE.review)await move(p,m.actor,m.object,m.destination);assert.equal((await state(p)).phase,'complete');await picture(p,'mobile-390-ending.png');await measure(p,'390px ending');results.checks.push({label:'390px touch selection, actual pointer drag, muted complete story, reduced motion',pass:true});
  }else{await p.locator('#restart').click();await p.locator('#keep-playing').click();assert.equal((await state(p)).phase,'play');await move(p,'marin','snacks','box');assert.equal((await state(p)).completedIds.includes('cleanup-snacks'),true);}
  await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:1024,height:800},reducedMotion:'reduce'});await ctx.addInitScript(()=>localStorage.setItem('synk.story-classroom.v1','{"game":{"records":[null]}}'));const p=await ctx.newPage();track(p);await p.goto(results.url);assert.equal(await p.locator('#resume').isVisible(),false);await p.locator('#start').click();await throughDialogue(p);await p.locator('#journal').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#modal').evaluate(e=>e.open),true);await p.keyboard.press('Escape');await p.locator('[data-actor="marin"]').focus();await p.keyboard.press('Enter');await p.locator('[data-object="snacks"]').focus();await p.keyboard.press('Space');await p.locator('[data-destination="box"]').focus();await p.keyboard.press('Enter');await idle(p);assert.equal((await state(p)).completedIds.includes('cleanup-snacks'),true);await measure(p,'1024px keyboard play');results.checks.push({label:'invalid save ignored, keyboard move and dialog focus',pass:true});await ctx.close();
 assert.deepEqual(results.errors,[]);assert.deepEqual(results.badRequests,[]);results.pass=true;
}catch(error){results.pass=false;results.failure=String(error.stack||error);process.exitCode=1;}finally{await writeFile(path.join(output,'browser-results.json'),JSON.stringify(results,null,2)+'\n');await browser.close();console.log(JSON.stringify({pass:results.pass,checks:results.checks.map(c=>c.label),errors:results.errors,badRequests:results.badRequests,failure:results.failure,screenshots:results.screenshots},null,2));}
