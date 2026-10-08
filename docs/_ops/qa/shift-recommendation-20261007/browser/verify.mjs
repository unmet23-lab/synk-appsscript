// Synthetic practice records, disposable company database and isolated Chromium contexts.
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

const require=createRequire(import.meta.url);
const {chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=dirname(fileURLToPath(import.meta.url)),repo=fileURLToPath(new URL('../../../../../',import.meta.url));
const report={at:new Date().toISOString(),checks:[],errors:[],assetErrors:[],externalRequests:[],screenshots:[],sources:{},cases:[],boundaries:{syntheticOnly:true,temporaryCompanyDatabase:true,freshBrowserContexts:true,paidCalls:0,productionWrites:0}};
const check=(name,value=true)=>{assert.ok(value,name);report.checks.push(name);};
const taskDirectory=await mkdtemp(join(tmpdir(),'synk-shift-recommendation-ui-'));
const standalone=createServer();let company,browser;
const draft='제공된 자료의 담당과 기한, 예산 승인 여부를 직접 확인했습니다. 지안은 10월 8일까지 초안을 쓰며 예산은 승인 대기입니다.';
function fixture(scope,kind){
  const start=Date.now()-3600000,at=n=>new Date(start+n*60000).toISOString();
  const settings={task:'meeting',goal:'work',minutes:10,support:'step'};
  let value=M.newState();value.save=true;
  const tasks=kind==='unseen'?['planning','meeting','meeting','meeting']:['research','planning','meeting','meeting','meeting'];
  tasks.forEach((task,index)=>{
    value=M.startRun(value,{...settings,task},engine,at(index*2),scope);
    value=M.recordPracticeExposure(value,at(index*2+.1),scope);
    value.run.prompt=M.TASKS[task].template;value.run.draft=draft;value.run.reviewed=true;
    for(const id of value.run.checkIds){const c=M.TASKS[task].checks.find(c=>c.id===id);value.run.answers[id]={kind:c.answer,source:c.source};}
    value.run.result=M.evaluate(value.run);value=M.completeRun(value,engine,at(index*2+1),scope);
  });
  return M.startRun(value,settings,engine,at(20),scope);
}
try{
  await mkdir(out,{recursive:true});
  for(const path of ['experiences/shift-workbench/model.mjs','experiences/shift-workbench/app.mjs','docs/마케팅/온라인마케팅지도/engagement/company/public/workroom-practice.js'])report.sources[path]=createHash('sha256').update(await readFile(join(repo,path))).digest('hex');
  await new Promise(r=>standalone.listen(0,'127.0.0.1',r));const standBase=`http://127.0.0.1:${standalone.address().port}`;
  const probe=portProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  company=createCompanyApp({dataDir:taskDirectory,port,schedule:false});
  const password='synthetic-shift-recommendation-only',email='shift-recommendation@example.test';
  const member=company.store.createUser({name:'추천 검증',email,role:'member',password});await company.start();const companyBase=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browser=browser.version();
  for(const surface of ['standalone','company'])for(const kind of ['unseen','least-recent']){
    const isCompany=surface==='company',base=isCompany?companyBase:standBase,prefix=`${surface} ${kind}`;
    const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();report.externalRequests.push(url);return route.abort();});
    const page=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',error=>report.errors.push({surface,kind,message:error.message}));
    page.on('response',res=>{if(res.status()>=400&&['script','stylesheet','image','font'].includes(res.request().resourceType()))report.assetErrors.push({surface,kind,path:new URL(res.url()).pathname,status:res.status()});});
    const url=base+(isCompany?'/?tab=workroom&section=practice':'/');await page.goto(url);
    if(isCompany){await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill(password);await page.locator('[data-form=auth] button[type=submit]').click();await page.locator('.workspace-rail').waitFor();await page.goto(url);await page.locator('[data-workroom-practice="ready"]').waitFor();}
    else await page.locator('html[data-ready="true"]').waitFor();
    const scope=isCompany?{personId:member.id,productId:'company',contextId:'workroom-practice',domain:'SHIFT'}:M.SCOPE,key=isCompany?`synk-workroom:ai-practice:v1:${member.id}`:M.STORAGE_KEY;
    const record=fixture(scope,kind);await page.evaluate(({key,record})=>localStorage.setItem(key,JSON.stringify(record)),{key,record});await page.reload();
    const prompt=isCompany?'[data-wp-field="prompt"]':'#prompt',finished=isCompany?'[data-wp-field="finished"]':'#finished-draft',nextPanel=isCompany?'.wp-next':'.next';
    await page.locator(prompt).fill(M.TASKS.meeting.template);
    for(const id of record.run.checkIds){const c=M.TASKS.meeting.checks.find(c=>c.id===id),wrong=id==='approval';
      await page.locator(isCompany?`[data-wp-check="${id}"][data-wp-part="kind"]`:`[data-check="${id}"][data-field="kind"]`).selectOption(wrong?'match':c.answer);
      await page.locator(isCompany?`[data-wp-check="${id}"][data-wp-part="source"]`:`[data-check="${id}"][data-field="source"]`).selectOption(c.source);
    }
    await page.locator(isCompany?'[data-action="practice-check"]':'#check').click();
    await page.locator(isCompany?'[data-wp-field="draft"]':'#draft').fill(draft);
    await page.locator(isCompany?'[data-wp-field="reviewed"]':'#reviewed').check();
    await page.locator(isCompany?'[data-action="practice-complete"]':'#complete').click();await page.locator(finished).waitFor();
    let stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),suggestion=M.nextTaskSuggestion(stored),reason=M.nextTaskReason(stored);
    check(prefix+' completed through visible controls',stored.run.step==='result'&&stored.run.result.find(c=>c.id==='approval').correct===false);
    check(prefix+' recent miss remains actionable after earlier correct reviews',suggestion.task==='research'&&suggestion.focus==='evidence');
    check(prefix+' renders the model reason exactly',(await page.locator(nextPanel+' p').first().innerText())===reason);
    check(prefix+' explains task exposure priority',kind==='unseen'?/아직|처음|새로운/.test(reason):/오래|이전/.test(reason));
    check(prefix+' keeps user choice and outcome limits visible',(await page.locator(nextPanel).innerText()).includes('업무와 조건은 직접 바꿀 수 있어요')&&(await page.locator(nextPanel).innerText()).includes('반복 정답만으로 능력 향상을 판단하지 않습니다'));
    report.cases.push({surface,kind,suggestion,reason,firstBeforeNext:stored.run.checkIds[0]});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});await page.evaluate(()=>document.fonts.ready);
      check(prefix+' result fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
      const name=`${surface}-${kind}-result-${width}.png`;await page.locator(nextPanel).screenshot({path:join(out,name)});report.screenshots.push(name);
    }
    await page.reload();await page.locator(finished).waitFor();
    check(prefix+' reload preserves suggestion and reason',(await page.locator(nextPanel+' p').first().innerText())===reason);
    await page.locator(isCompany?'[data-action="practice-next"]':'#next').click();
    const picked=isCompany?'[data-wp-field="task"]:checked':'[name="task"]:checked';
    check(prefix+' next action selects the suggested task',await page.locator(picked).inputValue()===suggestion.task);
    await page.locator(isCompany?'[data-wp-setup] button[type=submit]':'#setup-form button[type=submit]').click();await page.locator(prompt).waitFor();
    stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const checkSelector=isCompany?'[data-wp-check][data-wp-part="kind"]':'[data-check][data-field="kind"]';
    const shown=await page.locator(checkSelector).first().getAttribute(isCompany?'data-wp-check':'data-check');
    check(prefix+' suggested focus is actually shown first',stored.run.task===suggestion.task&&M.TASKS[stored.run.task].checks.find(c=>c.id===shown).focus===suggestion.focus);
    check(prefix+' first DOM check matches the product recommendation and evaluation',shown===stored.run.checkIds[0]&&shown===stored.run.focusDecision.practicePlan.selectedId&&shown===stored.evaluation.decisions.find(d=>d.id===stored.run.reviewDecisionId).selectedId);
    report.cases.at(-1).firstAfterNext=shown;
    const practiceReason=isCompany?'[data-review-decision-id]':'.recommendation';
    check(prefix+' explains why this check is first',(await page.locator(practiceReason).innerText()).includes(M.FOCUS[suggestion.focus]));
    await page.locator(practiceReason+' summary').click();
    check(prefix+' identifies the original unresolved question',(await page.locator(practiceReason).innerText()).includes(M.TASKS.meeting.checks.find(c=>c.id==='approval').label));
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});check(prefix+' next practice fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
    }
    const shot=`${surface}-${kind}-next-320.png`;await page.screenshot({path:join(out,shot),fullPage:true});report.screenshots.push(shot);
    const firstShot=`${surface}-${kind}-first-check-320.png`;await page.locator(isCompany?'.wp-check':'.review-item').first().screenshot({path:join(out,firstShot)});report.screenshots.push(firstShot);
    await page.reload();await page.locator(prompt).waitFor();
    check(prefix+' next practice survives reload with its first check',await page.locator(checkSelector).first().getAttribute(isCompany?'data-wp-check':'data-check')===shown);
    await context.close();
  }
  check('no page exceptions',report.errors.length===0);check('all rendered assets load',report.assetErrors.length===0);check('no external requests or paid calls',report.externalRequests.length===0);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{
  if(browser)await browser.close();if(company)await company.stop();if(standalone.listening)await new Promise(r=>standalone.close(r));
  const target=resolve(taskDirectory),parent=resolve(tmpdir());assert.ok(target.startsWith(parent+sep)&&target.split(sep).at(-1).startsWith('synk-shift-recommendation-ui-'));
  await rm(target,{recursive:true,force:true});report.temporaryDatabaseRemoved=true;
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,errors:report.errors,assetErrors:report.assetErrors,externalRequests:report.externalRequests,failure:report.failure,out}));
}
