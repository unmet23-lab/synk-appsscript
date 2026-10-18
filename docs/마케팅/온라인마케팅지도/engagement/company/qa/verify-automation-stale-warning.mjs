// Browser check: 자동화 상태 lists the stopped post-performance collector warning (S4) first and opens 2. 게시 후 성과.
// Starts verify-workspace-fixture.mjs (disposable data, synthetic users) and adds the warning only inside headless
// Chrome (page.route on /api/automation-health). Screenshots and result.json go to SYNK_QA_OUT. The fixture's temp
// folder is created inside this run's own temp directory, which is removed at the end.
// SYNK_QA_FIXTURE_DIR=<another company folder> runs that checkout's server while this checkout's status tool
// (automation-health.js/.css) is served to the page, e.g. a worktree change against the shared working copy.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {lstat,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),here=dirname(fileURLToPath(import.meta.url)),company=resolve(here,'..');
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const fixtureDir=resolve(process.env.SYNK_QA_FIXTURE_DIR||company),out=resolve(process.env.SYNK_QA_OUT||join(company,'../../../../../.tmp/automation-stale-warning-qa'));
const client=fixtureDir===company?null:{'/automation-health.js':['text/javascript; charset=utf-8',await readFile(join(company,'public/automation-health.js'))],'/automation-health.css':['text/css; charset=utf-8',await readFile(join(company,'public/automation-health.css'))]};
await mkdir(out,{recursive:true});
const temporaryRoot=await realpath(tmpdir()),runDirectory=await mkdtemp(join(temporaryRoot,'synk-stale-warning-'));
// The same fields automation-health.mjs gives the S4 issue; its per-post delay rows come before it in the response.
const since=new Date(Date.now()-2*3600000).toISOString(),entry='a'.repeat(64);
const late={id:`performance:late:${entry}:24`,automationId:'performance',kind:'late',status:'delayed',statusLabel:'확인 지연',title:'검증 게시물',text:'24시간 수치를 아직 기록하지 못했습니다. 관측 기간이 끝나기 전에 원문을 확인해 주세요.',href:`/?tab=workroom&section=tools&tool=publication&publicationAction=performance&entryId=${entry}&checkpoint=24h`,occurredAt:null,dueAt:since};
const stale={id:'performance:collector-stale:current',automationId:'performance',kind:'collector-stale',status:'delayed',statusLabel:'확인 지연',title:'게시 성과 자동 수집 확인 지연',text:'게시물 2편의 관측 시각 뒤에 수집기가 정상 점검을 마친 기록이 없어요. 서버의 자동 수집 상태를 확인해 주세요.',href:'/?tab=workroom&section=tools&tool=publication',occurredAt:since,dueAt:since,code:'post-performance-collector-stale',since,affectedEntries:[entry,'b'.repeat(64),entry]};
const bare=Object.fromEntries(Object.entries(stale).filter(([key])=>!['since','affectedEntries'].includes(key)));
const results=[],pageErrors=[],consoleErrors=[];let child,childClosed,browser,fixture;
const check=(name,ok,detail={})=>results.push({name,ok:!!ok,...detail});
async function login(context){
  const page=await context.newPage();await page.goto(fixture.url,{waitUntil:'domcontentloaded'});
  await page.fill('input[placeholder="이메일 또는 기존 아이디"]',fixture.email);await page.fill('input[type="password"]',fixture.password);await page.press('input[type="password"]','Enter');
  await page.waitForURL(/tab=home/,{timeout:15000});await page.close();
}
async function openStatus(context,issues){
  const page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  if(client)await page.route(url=>Object.hasOwn(client,url.pathname),route=>{const [contentType,body]=client[new URL(route.request().url()).pathname];return route.fulfill({status:200,contentType,body});});
  if(issues)await page.route(url=>url.pathname==='/api/automation-health',async route=>{
    const response=await route.fetch(),data=await response.json(),card=data.cards.find(row=>row.id==='performance');
    data.issues=[...issues,...data.issues];data.counts.issues=data.issues.length;Object.assign(card,{status:'delayed',statusLabel:'확인 지연'});card.counts.issues+=issues.length;
    await route.fulfill({response,json:data});
  });
  await page.goto(new URL('/?tab=workroom&section=tools&tool=automation',fixture.url).href,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.ah-panel[aria-busy="false"] .ah-summary',{timeout:20000});
  await page.evaluate(()=>{const main=document.querySelector('main'),panel=document.querySelector('.ah-panel');main.scrollTop+=panel.getBoundingClientRect().top-main.getBoundingClientRect().top-12;});
  return page;
}
const shot=(page,name,selector)=>(selector?page.locator(selector).first():page).screenshot({path:join(out,name+'.png')});
const publicationState=page=>page.evaluate(()=>({tool:makerTools.view,view:typeof pf==='undefined'?null:pf.view,performancePressed:document.querySelector('[data-pf-action="performance"]')?.getAttribute('aria-pressed')||null,search:location.search}));
try{
  child=spawn(process.execPath,['verify-workspace-fixture.mjs'],{cwd:fixtureDir,env:{...process.env,TEMP:runDirectory,TMP:runDirectory,TMPDIR:runDirectory},stdio:['ignore','pipe','inherit']});
  childClosed=new Promise(done=>child.once('close',done));
  fixture=await new Promise((done,fail)=>{let text='';const timer=setTimeout(()=>fail(new Error('fixture startup timed out')),30000),finish=(callback,value)=>{clearTimeout(timer);callback(value);};child.stdout.setEncoding('utf8').on('data',chunk=>{text+=chunk;const line=text.split(/\r?\n/).find(row=>row.trim().startsWith('{'));if(line)try{finish(done,JSON.parse(line));}catch{}});child.once('error',error=>finish(fail,error));child.once('exit',code=>finish(fail,new Error('fixture exited '+code)));});
  assert.notEqual(new URL(fixture.url).port,'4191','must not use the real-data workroom');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const desktop=await browser.newContext({viewport:{width:1280,height:900}}),phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await login(desktop);await login(phone);

  // 1. No warning in the real fixture response; the card link keeps the publication tool's default tab.
  let page=await openStatus(desktop);
  check('no warning without the S4 issue',await page.locator('.ah-stale').count()===0,{issues:await page.locator('#ah-issues-title + span').textContent()});
  await shot(page,'1-no-warning-desktop');
  await page.locator('[data-ah-card="performance"] [data-ah-source]').click();await page.waitForSelector('.pf-tabs');
  const plain=await publicationState(page);check('card #2 link still opens the current publication tab',plain.tool==='publication'&&plain.view==='prepare'&&plain.performancePressed==='false',plain);await page.close();

  // 2. Warning first, in Korean with KST start time and the deduplicated count.
  page=await openStatus(desktop,[late,stale]);
  const first=await page.$eval('.ah-attention [data-ah-item]',node=>node.dataset.ahItem),strong=(await page.textContent('.ah-stale strong')).trim(),expected=await page.evaluate(value=>`게시 성과 자동 수집이 ${ahDate(value)}부터 멈춰 있어요 · 영향 게시물 2개`,since);
  check('warning is the first issue',first==='performance:performance:collector-stale:current',{first});
  check('warning text',strong===expected,{strong,expected});
  check('warning link',await page.locator('.ah-stale a[data-ah-view="performance"]').getAttribute('href')==='/?tab=workroom&section=tools&tool=publication');
  await shot(page,'2-warning-desktop');await shot(page,'2-warning-desktop-issues','.ah-attention > section');

  // 3. The link lands on 2. 게시 후 성과.
  await page.locator('.ah-stale a[data-ah-view="performance"]').click();await page.waitForSelector('.pf-tabs');await page.waitForTimeout(500);
  const opened=await publicationState(page);check('warning link opens 2. 게시 후 성과',opened.tool==='publication'&&opened.view==='performance'&&opened.performancePressed==='true'&&/tool=publication/.test(opened.search),opened);
  await shot(page,'3-opened-performance-desktop');await page.close();

  // 4. Missing since/affectedEntries keep the warning without a time or count.
  page=await openStatus(desktop,[bare]);
  const bareText=(await page.textContent('.ah-stale strong')).trim();check('missing fields',bareText==='게시 성과 자동 수집이 멈춰 있어요',{strong:bareText});
  await shot(page,'4-missing-fields-desktop','.ah-stale');await page.close();

  // 5. Phone width: no sideways scroll, the warning fits.
  page=await openStatus(phone,[late,stale]);
  const fit=await page.evaluate(()=>{const box=document.querySelector('.ah-stale').getBoundingClientRect();return {page:document.documentElement.scrollWidth,viewport:innerWidth,left:Math.round(box.left),right:Math.round(box.right)};});
  check('phone width fits',fit.page<=fit.viewport&&fit.left>=0&&fit.right<=fit.viewport,fit);
  await page.evaluate(()=>{const main=document.querySelector('main'),list=document.querySelector('.ah-attention');main.scrollTop+=list.getBoundingClientRect().top-main.getBoundingClientRect().top-8;});
  await shot(page,'5-warning-phone');await page.close();
  check('no page errors',pageErrors.length===0,{pageErrors});
}finally{
  try{await browser?.close();}finally{
    if(child){if(child.exitCode===null&&child.signalCode===null)child.kill();await childClosed;}
    const target=resolve(runDirectory),info=await lstat(target),actual=await realpath(target);
    assert.ok(info.isDirectory()&&!info.isSymbolicLink()&&actual===target&&dirname(actual)===temporaryRoot,'Unexpected QA temporary directory');
    await rm(target,{recursive:true,force:true});
  }
}
await writeFile(join(out,'result.json'),JSON.stringify({checkedAt:new Date().toISOString(),fixtureDir,clientOverride:!!client,results,consoleErrors},null,1));
for(const row of results)console.log(`${row.ok?'ok  ':'FAIL'} ${row.name} ${JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key])=>!['name','ok'].includes(key))))}`);
if(consoleErrors.length)console.log('console errors:',JSON.stringify(consoleErrors));
assert.ok(results.length&&results.every(row=>row.ok),'stale warning browser checks failed');
