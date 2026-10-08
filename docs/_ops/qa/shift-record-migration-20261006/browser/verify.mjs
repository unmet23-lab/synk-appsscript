// Synthetic records, a disposable company database and fresh Chromium contexts only.
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
import * as M from '../../../../../experiences/shift-workbench/model.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=dirname(fileURLToPath(import.meta.url)),repo=fileURLToPath(new URL('../../../../../',import.meta.url));
const report={at:new Date().toISOString(),checks:[],errors:[],assetErrors:[],externalRequests:[],screenshots:[],sources:{},boundaries:{syntheticOnly:true,temporaryCompanyDatabase:true,freshBrowserContexts:true,paidCalls:0,productionWrites:0}};
const check=(name,value=true)=>{assert.ok(value,name);report.checks.push(name);};
const taskDirectory=await mkdtemp(join(tmpdir(),'synk-shift-migration-ui-'));
const standalone=createServer();let company,browser;
function fixture(scope){
  const start=Date.now()-60000,at=n=>new Date(start+n*1000).toISOString();
  const settings={task:'meeting',goal:'work',minutes:10,support:'independent'};
  let state=M.startRun(M.newState(),settings,engine,at(0),scope);state.save=true;
  state=M.recordPracticeExposure(state,at(1),scope);
  state.run.prompt='완료 요청문 <img data-qa-injected="1" src=x onerror="globalThis.__qaExecuted=1"> 자료 M1~M3로 실행 목록을 정리해 주세요.';
  state.run.draft='완료 작성물 </pre><script data-qa-injected="1">globalThis.__qaExecuted=1</script> 지안은 10월 8일까지 안내 초안을 쓰고, 예산은 승인 대기임을 확인했습니다.';
  state.run.reviewed=true;
  for(const id of state.run.checkIds){const c=M.TASKS.meeting.checks.find(c=>c.id===id);state.run.answers[id]={kind:c.answer,source:c.source};}
  state.run.result=M.evaluate(state.run);state=M.completeRun(state,engine,at(2),scope);
  state=M.giveFeedback(state,'want_more',engine,at(3),scope);
  state=M.startRun(state,{...settings,task:'planning'},engine,at(4),scope);
  state.run.prompt='작성 중 요청문 <img data-qa-injected="1" src=x onerror="globalThis.__qaExecuted=1"> 대상과 예산을 확인해 주세요.';
  state.run.draft='작성 중 초안 </pre><script data-qa-injected="1">globalThis.__qaExecuted=1</script> 8명, 2주, 40만 원 안에서 검토 중인 내용입니다.';
  state.profile=engine.clearProfile(state.profile,{mode:'disable',at:at(10)});
  return state;
}
try{
  await mkdir(out,{recursive:true});
  for(const path of ['experiences/shift-workbench/model.mjs','experiences/shift-workbench/app.mjs','docs/마케팅/온라인마케팅지도/engagement/company/public/workroom-practice.js'])report.sources[path]=createHash('sha256').update(await readFile(join(repo,path))).digest('hex');
  await new Promise(r=>standalone.listen(0,'127.0.0.1',r));
  const standBase=`http://127.0.0.1:${standalone.address().port}`;
  const probe=portProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  company=createCompanyApp({dataDir:taskDirectory,port,schedule:false});
  const password='synthetic-shift-migration-only';
  const member=company.store.createUser({name:'이행 검증',email:'shift-migration@example.test',role:'member',password});
  await company.start();const companyBase=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  report.browser=browser.version();
  const pageFor=async(base)=>{
    const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
    await context.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith(base+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
      report.externalRequests.push(url);return route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',error=>report.errors.push({surface:base===standBase?'standalone':'company',message:error.message}));
    page.on('response',res=>{if(res.status()>=400&&['script','stylesheet','image','font'].includes(res.request().resourceType()))report.assetErrors.push({path:new URL(res.url()).pathname,status:res.status()});});
    return {context,page};
  };
  const inspectHistory=async(page,surface,rows)=>{
    const text=await page.locator(rows).allTextContents();
    check(surface+' restores completed and in-progress authored records',text.length===2&&text.some(t=>t.includes('완료한 실습의 작성물'))&&text.some(t=>t.includes('작성 중이던 내용')));
    check(surface+' labels both records as excluded from recommendations and evaluation',text.every(t=>t.includes('이전 조건에서 작성한 내용 · 추천·평가에 사용하지 않음')));
    check(surface+' preserves both original requests and drafts',text.some(t=>t.includes('완료 요청문')&&t.includes('완료 작성물'))&&text.some(t=>t.includes('작성 중 요청문')&&t.includes('작성 중 초안')));
    check(surface+' does not fabricate scores from archived writing',text.every(t=>!t.includes('첫 근거 확인')&&!t.includes('undefined')&&!t.includes('NaN')));
    await page.locator(rows+' details').evaluateAll(items=>items.forEach(item=>item.open=true));
    check(surface+' displays injected HTML as literal text',await page.locator('[data-qa-injected]').count()===0&&await page.evaluate(()=>globalThis.__qaExecuted===undefined));
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>document.fonts.ready);
      const fit=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      check(surface+' expanded history fits '+width,fit.scroll<=fit.client);
      const name=surface+'-history-'+width+'.png';await page.screenshot({path:join(out,name),fullPage:true});report.screenshots.push(name);
      if(surface==='company'&&width===390){
        for(let index=0;index<2;index++){
          const row=page.locator(rows).nth(index);await row.locator('h3').scrollIntoViewIfNeeded();
          const recordName=`company-saved-work-${index}-390.png`;
          await row.screenshot({path:join(out,recordName)});report.screenshots.push(recordName);
        }
      }
    }
  };
  {
    const {context,page}=await pageFor(standBase);await page.goto(standBase+'/');await page.locator('html[data-ready="true"]').waitFor();
    const record=fixture(M.SCOPE);await page.evaluate(({key,record})=>localStorage.setItem(key,JSON.stringify(record)),{key:M.STORAGE_KEY,record});
    await page.reload();await page.locator('html[data-ready="true"]').waitFor();
    check('standalone returns to setup after personal conditions were cleared',await page.locator('#setup').isVisible());
    await page.locator('#history-open').click();await inspectHistory(page,'standalone','.history-row');
    await page.locator('#history-close').click();await page.locator('#setup-form button[type="submit"]').click();await page.locator('#prompt').waitFor();
    check('standalone starts a new practice without claiming old evidence',(await page.locator('.recommendation').innerText()).includes('현재 추천에 사용할 이전 검토·피드백은 없어요'));
    const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),M.STORAGE_KEY);
    check('standalone saves only a new analysis generation while preserving authored work',stored.history.length===2&&stored.history.every(h=>h.kind==='saved-work'&&h.sourceGeneration<stored.profile.generation)&&stored.evaluation.decisions.length===1&&stored.evaluation.outcomes.length===0);
    await page.reload();await page.locator('#prompt').waitFor();
    check('standalone new practice survives another reload',await page.locator('#practice').isVisible());
    for(const width of [390,320]){await page.setViewportSize({width,height:844});check('standalone new practice fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));}
    await page.screenshot({path:join(out,'standalone-new-practice-320.png'),fullPage:true});report.screenshots.push('standalone-new-practice-320.png');await context.close();
  }
  {
    const {context,page}=await pageFor(companyBase);const url=companyBase+'/?tab=workroom&section=practice';await page.goto(url);
    await page.locator('[name=email]').fill('shift-migration@example.test');await page.locator('[name=password]').fill(password);await page.locator('[data-form=auth] button[type=submit]').click();await page.locator('.workspace-rail').waitFor();
    await page.goto(url);await page.locator('[data-workroom-practice="ready"]').waitFor();
    const scope={personId:member.id,productId:'company',contextId:'workroom-practice',domain:'SHIFT'},key=`synk-workroom:ai-practice:v1:${member.id}`;
    const record=fixture(scope);await page.evaluate(({key,record})=>localStorage.setItem(key,JSON.stringify(record)),{key,record});
    await page.reload();await page.locator('[data-wp-setup]').waitFor();
    check('company returns to setup after personal conditions were cleared',await page.locator('[data-wp-setup]').isVisible());
    await page.locator('[data-action="practice-history"]').click();await inspectHistory(page,'company','.wp-history');
    await page.locator('[data-action="practice-back"]').click();await page.locator('[data-wp-setup] button[type=submit]').click();await page.locator('[data-wp-field="prompt"]').waitFor();
    check('company starts a new practice without claiming old evidence',(await page.locator('.wp-section-head').innerText()).includes('현재 추천에 사용할 이전 검토·피드백은 없어요'));
    const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    check('company saves only a new analysis generation while preserving authored work',stored.history.length===2&&stored.history.every(h=>h.kind==='saved-work'&&h.sourceGeneration<stored.profile.generation)&&stored.evaluation.decisions.length===1&&stored.evaluation.outcomes.length===0);
    await page.reload();await page.locator('[data-wp-field="prompt"]').waitFor();
    check('company new practice survives another reload',await page.locator('[data-wp-field="prompt"]').isVisible());
    for(const width of [390,320]){await page.setViewportSize({width,height:844});check('company new practice fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));}
    await page.screenshot({path:join(out,'company-new-practice-320.png'),fullPage:true});report.screenshots.push('company-new-practice-320.png');await context.close();
  }
  check('no page exceptions',report.errors.length===0);check('all rendered assets load',report.assetErrors.length===0);check('no external requests or paid calls',report.externalRequests.length===0);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{
  if(browser)await browser.close();if(company)await company.stop();if(standalone.listening)await new Promise(r=>standalone.close(r));
  const target=resolve(taskDirectory),parent=resolve(tmpdir());assert.ok(target.startsWith(parent+sep)&&target.split(sep).at(-1).startsWith('synk-shift-migration-ui-'));
  await rm(target,{recursive:true,force:true});report.temporaryDatabaseRemoved=true;
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,errors:report.errors,assetErrors:report.assetErrors,externalRequests:report.externalRequests,failure:report.failure,out}));
}
