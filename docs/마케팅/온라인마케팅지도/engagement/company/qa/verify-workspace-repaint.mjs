// Browser check: while a collection run is going, polling must not throw the reader back to the top.
// A: an unchanged /api/state answer repaints nothing. B: a changed answer repaints in the background and keeps
// scroll, focus and opened sections, and waits while typed-in input is unsaved or a click is held. The team comparison chart
// refreshes in place without a loading paint. Clicking to another section still starts at the top.
// Starts verify-workspace-fixture.mjs in its own temporary folder (disposable data, synthetic users), drives headless Chrome, then removes that folder.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {lstat,mkdtemp,realpath,rm} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),here=dirname(fileURLToPath(import.meta.url));
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const temporaryRoot=await realpath(tmpdir()),runDirectory=await mkdtemp(join(temporaryRoot,'synk-workspace-repaint-'));
const views=[['workroom tools','/?tab=workroom&section=tools&tool=publication'],['social results','/?tab=social&section=results'],['overview','/?tab=overview'],['workroom desk','/?tab=workroom&section=desk'],['analysis all','/?tab=analysis&section=all']];
const results=[];let child,childClosed,browser,fixture;
const watch=()=>{const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');window.__repaints=0;Object.defineProperty(Element.prototype,'innerHTML',{configurable:true,get(){return html.get.call(this);},set(value){if(this.id==='app')window.__repaints++;html.set.call(this,value);}});};
async function session(options){
  const context=await browser.newContext(options);await context.addInitScript(watch);
  const login=await context.newPage();await login.goto(fixture.url,{waitUntil:'domcontentloaded'});
  await login.fill('input[placeholder="이메일 또는 기존 아이디"]',fixture.email);await login.fill('input[type="password"]',fixture.password);await login.press('input[type="password"]','Enter');
  await login.waitForURL(/tab=home/,{timeout:15000});await login.close();return context;
}
async function busy(context,changing){let tick=0;await context.route(url=>url.pathname==='/api/state',async route=>{const response=await route.fetch(),body=await response.json();body.runs=[{id:'qa-run',status:'running',channelId:null,startedAt:'2026-10-18T00:00:00.000Z',processed:changing?tick++:0},...(body.runs||[])];await route.fulfill({response,json:body});});}
async function open(context,path){const page=await context.newPage();await page.goto(new URL(path,fixture.url).href,{waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);return page;}
const scrollDown=page=>page.evaluate(()=>{const main=document.querySelector('main');main.scrollTop=Math.min(600,main.scrollHeight-main.clientHeight);window.__repaints=0;return Math.round(main.scrollTop);});
const after=page=>page.evaluate(()=>({main:Math.round(document.querySelector('main').scrollTop),repaints:window.__repaints}));
const step=async(name,run)=>{try{const {ok,detail}=await run();results.push({name,ok,detail});}catch(error){results.push({name,ok:false,detail:{error:error.message.split('\n')[0]}});}};
try{
  child=spawn(process.execPath,['verify-workspace-fixture.mjs'],{cwd:resolve(here,'..'),env:{...process.env,TEMP:runDirectory,TMP:runDirectory,TMPDIR:runDirectory},stdio:['ignore','pipe','inherit']});
  childClosed=new Promise(done=>child.once('close',done));
  fixture=await new Promise((done,fail)=>{let text='';const timer=setTimeout(()=>fail(new Error('fixture startup timed out')),30000),finish=(callback,value)=>{clearTimeout(timer);callback(value);};child.stdout.setEncoding('utf8').on('data',chunk=>{text+=chunk;const line=text.split(/\r?\n/).find(row=>row.trim().startsWith('{'));if(line)try{finish(done,JSON.parse(line));}catch{}});child.once('error',error=>finish(fail,error));child.once('exit',code=>finish(fail,new Error('fixture exited '+code)));});
  browser=await chromium.launch({channel:'chrome',headless:true});
  const quiet=await session({viewport:{width:1280,height:900}});await busy(quiet,false);
  for(const [name,path] of views.slice(0,2))await step(`unchanged poll repaints nothing · ${name}`,async()=>{const page=await open(quiet,path),start=await scrollDown(page);await page.waitForTimeout(15000);const end=await after(page);await page.close();return {ok:end.repaints===0&&end.main===start,detail:{start,...end}};});
  await quiet.close();
  const desk=await session({viewport:{width:1280,height:900}});await busy(desk,true);
  for(const [name,path] of views)await step(`changed poll keeps the place · ${name}`,async()=>{const page=await open(desk,path),start=await scrollDown(page);await page.waitForTimeout(15000);const end=await after(page);await page.close();return {ok:end.repaints>=2&&end.main===start&&start>0,detail:{start,...end}};});
  await step('changed poll refreshes the team chart in place, keeping the opened table and the chosen date · overview team',async()=>{const page=await open(desk,'/?tab=overview&section=team');await page.click('details.tt-records > summary');
    await page.focus('[data-team-trend-date]');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');const date=await page.evaluate(()=>teamTrends.date);
    let fetches=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/team-trends')fetches++;});const start=await scrollDown(page);await page.waitForTimeout(15000);
    const end=await page.evaluate(()=>({main:Math.round(document.querySelector('main').scrollTop),repaints:window.__repaints,open:document.querySelector('details.tt-records')?.open===true,date:teamTrends.date,focused:document.activeElement?.hasAttribute?.('data-team-trend-date')===true}));await page.close();
    return {ok:fetches>=1&&end.repaints>=2&&end.open&&!!date&&end.date===date&&end.focused&&end.main===start&&start>0,detail:{start,fetches,chosen:date,...end}};});
  await step('a field being typed in is not swapped out while the reader types',async()=>{const page=await open(desk,'/?tab=social&section=results');await page.click('input[name="query"]');await page.keyboard.type('검증');await page.evaluate(()=>{window.__repaints=0;});await page.waitForTimeout(15000);
    const end=await page.evaluate(()=>({repaints:window.__repaints,focused:document.activeElement?.getAttribute?.('name'),value:document.activeElement?.value??null}));await page.close();return {ok:end.repaints===0&&end.focused==='query'&&end.value==='검증',detail:end};});
  await step('a focused field nobody typed in keeps focus through background repaints',async()=>{const page=await open(desk,'/?tab=social&section=results');await page.click('input[name="query"]');await page.evaluate(()=>{window.__repaints=0;});await page.waitForTimeout(15000);
    const end=await page.evaluate(()=>({repaints:window.__repaints,focused:document.activeElement?.getAttribute?.('name')}));await page.close();return {ok:end.repaints>=2&&end.focused==='query',detail:end};});
  await step('a background repaint waits for a held click, so the click still lands',async()=>{const page=await open(desk,'/?tab=workroom&section=tools&tool=publication'),button=page.locator('[data-pf-action="performance"]').first();await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.evaluate(()=>{window.__repaints=0;});
    await page.mouse.down();await page.evaluate(()=>renderBackground());const during=await page.evaluate(()=>window.__repaints);await page.waitForTimeout(120);await page.mouse.up();await page.waitForTimeout(400);
    const end=await page.evaluate(()=>({view:pf.view,repaints:window.__repaints}));await page.close();return {ok:during===0&&end.view==='performance',detail:{during,...end}};});
  await step('clicking another section still starts at the top',async()=>{const page=await open(desk,'/?tab=workroom&section=tools&tool=publication'),start=await scrollDown(page);await page.click('[data-action="workroom-view"][data-tab="desk"]');await page.waitForTimeout(800);const end=await after(page);await page.close();return {ok:start>0&&end.main===0,detail:{start,...end}};});
  await desk.close();
  const phone=await session({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await busy(phone,true);
  await step('changed poll keeps the place · phone 390',async()=>{const page=await open(phone,'/?tab=social&section=results'),start=await scrollDown(page);await page.waitForTimeout(15000);const end=await after(page);await page.close();return {ok:end.repaints>=2&&end.main===start&&start>0,detail:{start,...end}};});
  await phone.close();
}finally{
  try{await browser?.close();}finally{
    if(child){if(child.exitCode===null&&child.signalCode===null)child.kill();await childClosed;}
    const target=resolve(runDirectory),info=await lstat(target),actual=await realpath(target);
    assert.ok(info.isDirectory()&&!info.isSymbolicLink()&&actual===target&&dirname(actual)===temporaryRoot,'Unexpected QA temporary directory');
    await rm(target,{recursive:true,force:true});
  }
}
for(const row of results)console.log(`${row.ok?'ok  ':'FAIL'} ${row.name} ${JSON.stringify(row.detail)}`);
assert.ok(results.length===13&&results.every(row=>row.ok),'workspace repaint scenarios failed');
