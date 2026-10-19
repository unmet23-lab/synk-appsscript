// Browser check: a workroom deep link keeps its focus and scroll even when another module repaints late on first load.
// Starts verify-workspace-fixture.mjs (disposable data, synthetic users), drives headless Chrome, then removes that fixture's temp folder.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {lstat,mkdtemp,realpath,rm} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),here=dirname(fileURLToPath(import.meta.url));
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const temporaryRoot=await realpath(tmpdir()),runDirectory=await mkdtemp(join(temporaryRoot,'synk-deeplink-focus-'));
const repaint=page=>page.evaluate(()=>render());
const scenarios=[
  {name:'workroom answers late',delay:['workroom-guide|content-workspace',800],expect:end=>end.active==='url'&&end.main>0},
  {name:'publication data answers late',delay:['publication-workspace',900],expect:end=>end.active==='url'&&end.main>0},
  {name:'a later full repaint puts the target back',act:repaint,expect:end=>end.active==='url'&&end.main>0},
  {name:'tabbing away is not pulled back',act:async page=>{await page.keyboard.press('Tab');await repaint(page);},expect:end=>end.active!=='url'},
  {name:'an opened dialog keeps its focus',act:async page=>{await page.keyboard.press('Control+K');await page.waitForTimeout(300);await repaint(page);},expect:end=>end.inOverlay===true},
];
const results=[];let child,childClosed,browser;
try{
  child=spawn(process.execPath,['verify-workspace-fixture.mjs'],{cwd:resolve(here,'..'),env:{...process.env,TEMP:runDirectory,TMP:runDirectory,TMPDIR:runDirectory},stdio:['ignore','pipe','inherit']});
  childClosed=new Promise(done=>child.once('close',done));
  const fixture=await new Promise((done,fail)=>{let text='';const timer=setTimeout(()=>fail(new Error('fixture startup timed out')),30000),finish=(callback,value)=>{clearTimeout(timer);callback(value);};child.stdout.setEncoding('utf8').on('data',chunk=>{text+=chunk;const line=text.split(/\r?\n/).find(row=>row.trim().startsWith('{'));if(line)try{finish(done,JSON.parse(line));}catch{}});child.once('error',error=>finish(fail,error));child.once('exit',code=>finish(fail,new Error('fixture exited '+code)));});
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),login=await context.newPage();
  await login.goto(fixture.url,{waitUntil:'domcontentloaded'});
  await login.fill('input[placeholder="이메일 또는 기존 아이디"]',fixture.email);await login.fill('input[type="password"]',fixture.password);await login.press('input[type="password"]','Enter');
  await login.waitForURL(/tab=home/,{timeout:15000});await login.close();
  for(const scenario of scenarios){
    const page=await context.newPage(),[pattern,ms]=scenario.delay||['',0];
    if(pattern){const match=new RegExp('/api/('+pattern+')');await page.route(url=>match.test(url.pathname),async route=>{await new Promise(resolve=>setTimeout(resolve,ms));await route.continue();});}
    await page.goto(new URL('/?tab=workroom&section=tools&tool=publication&publicationAction=register',fixture.url).href,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(ms+1500);
    if(scenario.act){await scenario.act(page);await page.waitForTimeout(300);}
    const end=await page.evaluate(()=>{const active=document.activeElement;return {active:active?.getAttribute?.('data-pf-register')||active?.tagName||null,main:Math.round(document.querySelector('main')?.scrollTop||0),inOverlay:!!document.getElementById('overlay')?.contains(active)};});
    results.push({name:scenario.name,ok:scenario.expect(end),end});await page.close();
  }
}finally{
  try{await browser?.close();}finally{
    if(child){if(child.exitCode===null&&child.signalCode===null)child.kill();await childClosed;}
    const target=resolve(runDirectory),info=await lstat(target),actual=await realpath(target);
    assert.ok(info.isDirectory()&&!info.isSymbolicLink()&&actual===target&&dirname(actual)===temporaryRoot,'Unexpected QA temporary directory');
    await rm(target,{recursive:true,force:true});
  }
}
for(const row of results)console.log(`${row.ok?'ok  ':'FAIL'} ${row.name} ${JSON.stringify(row.end)}`);
assert.ok(results.length===scenarios.length&&results.every(row=>row.ok),'deep-link focus scenarios failed');
