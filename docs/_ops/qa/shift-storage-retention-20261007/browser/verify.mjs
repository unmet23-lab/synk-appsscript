// Disposable accounts, synthetic text, local servers and isolated browser contexts.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer as portProbe} from 'node:net';
import {createServer} from '../../../../../experiences/shift-workbench/server.mjs';
import {createCompanyApp} from '../../../../마케팅/온라인마케팅지도/engagement/company/server.mjs';
import engine from '../../../../../atlas/personalization.js';
import '../../../../../atlas/domain.js';
import '../../../../../atlas/temper-outcomes.js';
import * as M from '../../../../../experiences/shift-workbench/model.mjs';
const require=createRequire(import.meta.url),{chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=dirname(fileURLToPath(import.meta.url)),repo=fileURLToPath(new URL('../../../../../',import.meta.url));
const report={at:new Date().toISOString(),checks:[],errors:[],assetErrors:[],externalRequests:[],screenshots:[],sources:{},cases:[],boundaries:{syntheticOnly:true,paidCalls:0,productionWrites:0}};
const check=(name,value=true)=>{assert.ok(value,name);report.checks.push(name);};
const directory=await mkdtemp(join(tmpdir(),'synk-shift-storage-ui-')),standalone=createServer();let company,browser;
const prompt='<img src=x onerror="window.__upgradeLeak=1"> 사용자가 저장한 이전 요청문입니다.',draft='사용자가 직접 작성한 가상 업무 결과입니다. 담당과 기한을 대조하고 확인되지 않은 효과는 구분했습니다. <script>window.__upgradeLeak=1</script>';
const source=await readFile(join(repo,'experiences/shift-workbench/model.mjs'),'utf8');
const oldSource=source.replace('export const TASKS = Object.freeze({','const ORIGINAL_TASKS = Object.freeze({')
  .replace('export const ANSWERS =',"export const TASKS=Object.freeze({...ORIGINAL_TASKS,retired:{...ORIGINAL_TASKS.planning,name:'이전 기획 실습'}});\nexport const ANSWERS =")
  .replace("'./storage-upgrade.mjs'",JSON.stringify(new URL('../../../../../experiences/shift-workbench/storage-upgrade.mjs',import.meta.url).href));
const Old=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
function fixture(scope){
  const base=Date.now()-3600000,at=n=>new Date(base+n*1000).toISOString(),settings={task:'meeting',goal:'work',minutes:10,support:'step'};
  let record=Old.startRun({...Old.newState(),save:true},settings,engine,at(0),scope);
  record=Old.recordPracticeExposure(record,at(1),scope);Object.assign(record.run,{prompt,draft,reviewed:true});
  for(const id of record.run.checkIds){const c=Old.TASKS.meeting.checks.find(c=>c.id===id);record.run.answers[id]={kind:c.answer,source:c.source};}
  record.run.result=Old.evaluate(record.run);record=Old.completeRun(record,engine,at(2),scope);
  record=Old.startRun(record,{...settings,task:'retired'},engine,at(3),scope);Object.assign(record.run,{prompt,draft});return record;
}
try{
  await mkdir(out,{recursive:true});
  for(const path of ['experiences/shift-workbench/model.mjs','experiences/shift-workbench/storage-upgrade.mjs','experiences/shift-workbench/app.mjs','experiences/shift-workbench/server.mjs','docs/마케팅/온라인마케팅지도/engagement/company/public/workroom-practice.js','docs/마케팅/온라인마케팅지도/engagement/company/server.mjs'])report.sources[path]=createHash('sha256').update(await readFile(join(repo,path))).digest('hex');
  await new Promise(r=>standalone.listen(0,'127.0.0.1',r));const standBase=`http://127.0.0.1:${standalone.address().port}`;
  const probe=portProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  company=createCompanyApp({dataDir:directory,port,schedule:false});
  const email='shift-storage@example.test',password='synthetic-storage-only',member=company.store.createUser({name:'저장 검증',email,password,role:'member'});await company.start();const companyBase=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browser=browser.version();
  for(const surface of ['standalone','company']){
    const isCompany=surface==='company',base=isCompany?companyBase:standBase,context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();report.externalRequests.push(url);return route.abort();});
    const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));
    page.on('response',res=>{if(res.status()>=400&&['script','stylesheet','image','font'].includes(res.request().resourceType()))report.assetErrors.push({path:new URL(res.url()).pathname,status:res.status()});});
    const url=base+(isCompany?'/?tab=workroom&section=practice':'/');await page.goto(url);
    if(isCompany){await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill(password);await page.locator('[data-form=auth] button[type=submit]').click();await page.locator('.workspace-rail').waitFor();await page.goto(url);await page.locator('[data-workroom-practice="ready"]').waitFor();}else await page.locator('html[data-ready="true"]').waitFor();
    const scope=isCompany?{personId:member.id,productId:'company',contextId:'workroom-practice',domain:'SHIFT'}:M.SCOPE,key=isCompany?`synk-workroom:ai-practice:v1:${member.id}`:M.STORAGE_KEY;
    const old=fixture(scope),oldIds=old.events.map(e=>e.id);await page.evaluate(({key,old})=>localStorage.setItem(key,JSON.stringify(old)),{key,old});await page.reload();
    const status=isCompany?'#wp-storage-status':'#save-status';await page.locator(status).filter({hasText:'업데이트 전 작성한 내용'}).waitFor();
    check(surface+' explains recovered work and excluded analysis',(await page.locator(status).innerText()).includes('이전 답안·점수'));
    const open=isCompany?'[data-action="practice-history"]':'#history-open';await page.locator(open).click();
    const rows=isCompany?'.wp-history':'.history-row';check(surface+' preserves completed writing and the removed-task draft',await page.locator(rows).count()===2);
    check(surface+' keeps the removed task name',(await page.locator(rows).allTextContents()).join(' ').includes('이전 기획 실습'));
    for(const detail of await page.locator(rows+' details').all())await detail.locator('summary').click();
    const text=(await page.locator(rows).allTextContents()).join(' ');check(surface+' shows both literal requests and drafts',text.includes(prompt)&&text.includes(draft));check(surface+' archive shows no old review score',!text.includes('첫 근거 확인'));
    check(surface+' stored markup is never executed',await page.evaluate(()=>window.__upgradeLeak===undefined));
    for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.evaluate(()=>document.fonts.ready);check(surface+' recovered history fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));const name=`${surface}-recovered-${width}.png`;await page.locator(rows).first().screenshot({path:join(out,name)});report.screenshots.push(name);}
    await page.locator(isCompany?'[data-action="practice-back"]':'#history-close').click();
    await page.locator(isCompany?'[data-wp-setup] button[type=submit]':'#setup-form button[type=submit]').click();
    const request=isCompany?'[data-wp-field="prompt"]':'#prompt';await page.locator(request).waitFor();
    let stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    check(surface+' new practice excludes every old analytical event',stored.events.every(e=>!oldIds.includes(e.id))&&stored.history.every(M.isSavedWork));
    check(surface+' preserves the two archives while saving the current manifest',stored.history.length===2&&stored.manifest.content===M.PRODUCT_MANIFEST.content);
    check(surface+' new recommendation does not use recovered work',M.practiceHistoryUsed(stored)===false&&M.practiceObservations(stored,scope).length===0);
    await page.locator(request).fill(M.TASKS[stored.run.task].template);
    for(const id of stored.run.checkIds){const c=M.TASKS[stored.run.task].checks.find(c=>c.id===id);await page.locator(isCompany?`[data-wp-check="${id}"][data-wp-part="kind"]`:`[data-check="${id}"][data-field="kind"]`).selectOption(c.answer);await page.locator(isCompany?`[data-wp-check="${id}"][data-wp-part="source"]`:`[data-check="${id}"][data-field="source"]`).selectOption(c.source);}
    await page.locator(isCompany?'[data-action="practice-check"]':'#check').click();await page.locator(isCompany?'[data-wp-field="draft"]':'#draft').fill(draft);await page.locator(isCompany?'[data-wp-field="reviewed"]':'#reviewed').check();await page.locator(isCompany?'[data-action="practice-complete"]':'#complete').click();
    await page.locator(isCompany?'[data-wp-field="finished"]':'#finished-draft').waitFor();stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    check(surface+' can complete a new practice after recovery',stored.run.step==='result'&&stored.history.length===3&&stored.history.filter(M.isSavedWork).length===2&&stored.evaluation.decisions.length===1);
    await page.reload();await page.locator(isCompany?'[data-wp-field="finished"]':'#finished-draft').waitFor();await page.locator(open).click();
    check(surface+' save and reload preserve both archives alongside the new completion',await page.locator(rows).count()===3);
    check(surface+' repeat recovery never duplicates writing',(await page.locator(rows).allTextContents()).filter(t=>t.includes('업데이트 전 작성한 내용')).length===2);
    report.cases.push({surface,sourceManifest:old.manifest,currentManifest:stored.manifest,archives:2,newCompleted:1});await context.close();
  }
  check('no page exceptions',report.errors.length===0);check('all assets and modules load',report.assetErrors.length===0);check('no external requests',report.externalRequests.length===0);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{
  if(browser)await browser.close();if(company)await company.stop();if(standalone.listening)await new Promise(r=>standalone.close(r));
  const target=resolve(directory),parent=resolve(tmpdir());assert.ok(target.startsWith(parent+sep)&&target.split(sep).at(-1).startsWith('synk-shift-storage-ui-'));await rm(target,{recursive:true,force:true});report.temporaryDatabaseRemoved=true;
  await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failure:report.failure,errors:report.errors,assetErrors:report.assetErrors,externalRequests:report.externalRequests}));
}
