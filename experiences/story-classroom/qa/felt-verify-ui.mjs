import { chromium } from 'file:///C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EPISODE } from '../story.mjs';

const qaRoot=path.dirname(fileURLToPath(import.meta.url));
const gameRoot=path.dirname(qaRoot);
const report={date:'2026-10-02',scope:'Final photographed felt UI with voice/account controls, actual UI journey to ending and reading notes',browser:'Google Chrome via Playwright, headless, deviceScaleFactor 1, reduced motion',sourceSha256:{},viewports:[],screenshots:[],notEstablishedByThisCheck:['Direct listening and voice quality','WORLD authenticated remote record synchronization','Student learning effects and real device performance']};
for(const name of ['index.html','style.css','app.mjs','core.mjs','story.mjs','voice.mjs','audio.mjs','learning.mjs'])report.sourceSha256[name]=createHash('sha256').update(await readFile(path.join(gameRoot,name))).digest('hex');
const browser=await chromium.launch({channel:'chrome',headless:true});
async function inspect(page){return page.evaluate(()=>{
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),small=[];let node;
  while(node=walker.nextNode()){
    if(!node.textContent.trim())continue;const el=node.parentElement;if(!el||['SCRIPT','STYLE'].includes(el.tagName))continue;
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&parseFloat(s.fontSize)<11)small.push({text:node.textContent.trim().slice(0,60),font:s.fontSize});
  }
  const statusText=[...document.querySelectorAll('#voice-status,#account-status,#toast')].filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width&&r.height&&s.visibility!=='hidden'&&parseFloat(s.opacity)>0;}).map(el=>({id:el.id,text:el.textContent.trim()}));
  return {horizontalOverflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth),visibleTextBelow11Px:small,mainReadingFontPx:parseFloat(getComputedStyle(document.querySelector('#dialogue-text')).fontSize),visibleInternalErrors:statusText.filter(s=>/Illegal invocation|Failed to execute|TypeError|ReferenceError|Error:/i.test(s.text)),statusText,brokenImages:[...document.images].filter(i=>i.getBoundingClientRect().width&&(!i.complete||!i.naturalWidth)).map(i=>i.src),fonts:[document.fonts.check('800 18px "SUIT Variable"'),document.fonts.check('500 16px "Inter Tight"'),document.fonts.check('400 11px "DM Mono"')]};
});}
async function capture(page,width,state){const name=`felt-${width}-${state}.png`;await page.screenshot({path:path.join(qaRoot,name),fullPage:true});report.screenshots.push(name);}
async function advanceTo(page,target){for(let i=0;i<35;i++){const state=await page.evaluate(()=>window.__storyState);if(state.phase===target)return;await page.locator('#dialogue-next').click();}throw new Error('Could not reach '+target);}
async function move(page,mission){await page.locator(`[data-actor="${mission.actor}"]`).click();await page.locator(`[data-object="${mission.object}"]`).click();await page.locator(`[data-destination="${mission.destination}"]`).click();await page.waitForFunction(()=>!window.__storyState.busy);}
try{
  for(const [width,height] of [[1440,1000],[390,844],[320,800]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage(),row={width,height,states:[],pageErrors:[],httpErrors:[]};
    page.on('pageerror',e=>row.pageErrors.push(e.message));page.on('response',r=>{if(r.status()>=400)row.httpErrors.push({status:r.status(),url:r.url()});});
    await page.goto(process.env.SYNK_STORY_QA_URL||'http://127.0.0.1:5213/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await capture(page,width,'landing');row.states.push({state:'landing',...await inspect(page)});
    await page.locator('#start').click();await capture(page,width,'opening');row.states.push({state:'opening',...await inspect(page)});
    for(let i=0;i<25;i++){if((await page.evaluate(()=>window.__storyState)).phase==='play')break;await page.locator('#dialogue-next').click();}
    await page.evaluate(()=>scrollTo(0,0));await capture(page,width,'play');row.states.push({state:'play',...await inspect(page)});
    await page.locator('#reading-mode').click();row.readingOnlyControls={pressed:await page.locator('#reading-mode').getAttribute('aria-pressed'),replayDisabled:await page.locator('#voice-replay').isDisabled(),missionListenDisabled:await page.locator('.mission-listen').first().isDisabled()};await capture(page,width,'reading-only');
    await page.locator('#reading-mode').click();
    await page.locator('[data-actor="marin"]').click();await page.locator('[data-object="snacks"]').click();await page.locator('[data-destination="box"]').click();await page.waitForFunction(()=>!window.__storyState.busy);await page.evaluate(()=>scrollTo(0,0));await capture(page,width,'badge');row.states.push({state:'badge',...await inspect(page)});row.completedBadgeUsesFelt=await page.locator('.mission.done .mission-check').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('badge-check.webp'));
    await page.locator('#reading-mode').click();
    for(const act of EPISODE.acts){for(const mission of act.missions){if(!(await page.evaluate(()=>window.__storyState)).completedIds.includes(mission.id))await move(page,mission);}await advanceTo(page,act===EPISODE.acts.at(-1)?'review':'play');}
    for(const mission of EPISODE.review)await move(page,mission);
    await capture(page,width,'ending');row.states.push({state:'ending',...await inspect(page)});
    await page.locator('#see-reading').click();await capture(page,width,'reading-notes');row.states.push({state:'reading-notes',...await inspect(page)});
    row.pass=row.states.every(s=>s.horizontalOverflowPx===0&&s.mainReadingFontPx===18&&!s.visibleTextBelow11Px.length&&!s.visibleInternalErrors.length&&!s.brokenImages.length&&s.fonts.every(Boolean))&&!row.pageErrors.length&&!row.httpErrors.length&&row.readingOnlyControls.pressed==='true'&&row.readingOnlyControls.replayDisabled&&row.readingOnlyControls.missionListenDisabled&&row.completedBadgeUsesFelt;
    report.viewports.push(row);console.log(JSON.stringify({width,pass:row.pass,pageErrors:row.pageErrors,httpErrors:row.httpErrors,readingOnlyControls:row.readingOnlyControls}));await context.close();
  }
}finally{await browser.close();report.pass=report.viewports.length===3&&report.viewports.every(v=>v.pass);await writeFile(path.join(qaRoot,'felt-verification.json'),JSON.stringify(report,null,2)+'\n');}
if(!report.pass)process.exitCode=1;
