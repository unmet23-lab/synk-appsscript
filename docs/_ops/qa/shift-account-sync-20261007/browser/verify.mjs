// Local existing-company host, disposable synthetic accounts, two independent browser storage contexts.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer as portProbe} from 'node:net';
import {createCompanyApp} from '../../../../마케팅/온라인마케팅지도/engagement/company/server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=dirname(fileURLToPath(import.meta.url)),repo=fileURLToPath(new URL('../../../../../',import.meta.url));
const report={at:new Date().toISOString(),checks:[],errors:[],assetErrors:[],externalRequests:[],screenshots:[],sources:{},boundaries:{syntheticOnly:true,paidCalls:0,productionWrites:0,isolatedBrowserContexts:2,physicalDevices:0}};
const check=(name,value=true)=>{assert.ok(value,name);report.checks.push(name);};
const directory=await mkdtemp(join(tmpdir(),'synk-shift-sync-ui-'));let company,browser;
const promptSel='[data-wp-field="prompt"]',syncSel='[data-wp-field="sync"]',saveSel='[data-wp-field="save"]',refreshSel='[data-action="practice-sync-refresh"]';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(assertion){const end=Date.now()+16000;while(Date.now()<end){if(await assertion())return;await pause(100);}throw new Error('Expected account state was not reached.');}
async function remote(page){return page.evaluate(async()=>{const response=await fetch('/api/workroom-practice/state',{cache:'no-store'});return response.json();});}
async function waitPrompt(page,text){await waitFor(async()=>{const record=await remote(page);return record.state?.run?.prompt===text;});await waitFor(()=>page.evaluate(()=>!wp.sync.view().busy));}
async function refresh(page){await waitFor(()=>page.evaluate(()=>!wp.sync.view().busy));if(await page.evaluate(()=>!!wp.sync.view().conflict))return;await page.locator(refreshSel).click();await waitFor(()=>page.evaluate(()=>!wp.sync.view().busy));}
try{
  await mkdir(out,{recursive:true});
  for(const path of ['experiences/shift-workbench/model.mjs','docs/마케팅/온라인마케팅지도/engagement/company/public/workroom-practice.js','docs/마케팅/온라인마케팅지도/engagement/company/public/workroom-practice-sync.js','docs/마케팅/온라인마케팅지도/engagement/company/public/workroom-practice.css','docs/마케팅/온라인마케팅지도/engagement/company/public/index.html','docs/마케팅/온라인마케팅지도/engagement/company/workroom-practice-sync-service.mjs','docs/마케팅/온라인마케팅지도/engagement/company/server.mjs','docs/마케팅/온라인마케팅지도/engagement/company/store.mjs'])report.sources[path]=createHash('sha256').update(await readFile(join(repo,path))).digest('hex');
  const probe=portProbe();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  company=createCompanyApp({dataDir:directory,port,schedule:false});const email='shift-sync@example.test',otherEmail='shift-other@example.test',password='synthetic-sync-only';
  const user=company.store.createUser({name:'동기화 검증',email,password,role:'member'}),other=company.store.createUser({name:'별도 계정',email:otherEmail,password,role:'member'});await company.start();const base=`http://127.0.0.1:${port}`,url=base+'/?tab=workroom&section=practice';
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browser=browser.version();
  const contexts=[],pages=[];let syncRequests=0;
  async function login(page,address=email){await page.locator('[name=email]').fill(address);await page.locator('[name=password]').fill(password);await page.locator('[data-form=auth] button[type=submit]').click();await page.locator('.workspace-rail').waitFor();await page.goto(url);await page.locator('[data-workroom-practice="ready"]').waitFor();}
  for(let i=0;i<2;i++){
    const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});contexts.push(context);
    await context.route('**/*',route=>{const requestUrl=route.request().url();if(requestUrl.startsWith(base+'/')||requestUrl.startsWith('data:')||requestUrl.startsWith('blob:'))return route.continue();report.externalRequests.push(requestUrl);return route.abort();});
    const page=await context.newPage();page.setDefaultTimeout(15000);pages.push(page);page.on('pageerror',error=>report.errors.push(error.message));
    page.on('request',request=>{if(new URL(request.url()).pathname==='/api/workroom-practice/state')syncRequests++;});
    page.on('response',response=>{if(response.status()>=400&&['script','stylesheet','image','font'].includes(response.request().resourceType()))report.assetErrors.push({path:new URL(response.url()).pathname,status:response.status()});});
    await page.goto(url);await login(page);check('device '+(i+1)+' sync and local saving start off',!await page.locator(syncSel).isChecked()&&!await page.locator(saveSel).isChecked());
  }
  const [a,b]=pages;check('opening practice with sync off makes no account-state requests',syncRequests===0);
  await a.locator(syncSel).check();await a.locator('#wp-sync-status').filter({hasText:'첫 실습을 시작하면'}).waitFor();check('opt-in before first practice does not create a stored document',(await remote(a)).status==='empty');
  await a.locator('[data-wp-setup] button[type=submit]').click();await a.locator(promptSel).waitFor();await waitFor(async()=>(await remote(a)).status==='active');
  check('first practice activates account persistence without local draft storage',await a.evaluate(id=>localStorage.getItem(`synk-workroom:ai-practice:v1:${id}`)===null,user.id));
  const textA='기기 A에서 작성한 가상 자료의 요청문입니다. 담당과 기한을 확인해 주세요.';await a.locator(promptSel).fill(textA);await waitPrompt(a,textA);
  await b.locator(syncSel).check();await b.locator(promptSel).waitFor();check('device B pulls device A request',(await b.locator(promptSel).inputValue())===textA);
  check('device B keeps local save off after pulling account data',!await b.locator(saveSel).isChecked()&&await b.evaluate(id=>localStorage.getItem(`synk-workroom:ai-practice:v1:${id}`)===null,user.id));
  const textB='기기 B에서 수정한 가상 업무 요청문입니다. 숫자와 근거를 함께 대조해 주세요.';await b.locator(promptSel).fill(textB);await waitPrompt(b,textB);await refresh(a);
  check('device B edit returns to device A',(await a.locator(promptSel).inputValue())===textB);
  await a.locator(promptSel).focus();await a.locator(promptSel).evaluate(el=>{el.setSelectionRange(5,5);el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'한'}));});
  await a.locator(promptSel).press('ArrowRight');const caret=await a.locator(promptSel).evaluate(el=>el.selectionStart);await a.evaluate(()=>wpCloudStatus());
  check('sync status updates preserve the active textarea and Korean composition',await a.locator(promptSel).evaluate((el,position)=>document.activeElement===el&&el.selectionStart===position&&wp.composing,caret));
  await a.locator(promptSel).evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'한'})));
  await a.locator(saveSel).check();check('local save can be opted in independently of account sync',await a.locator(syncSel).isChecked()&&await a.evaluate(id=>!!localStorage.getItem(`synk-workroom:ai-practice:v1:${id}`),user.id));
  await contexts[0].setOffline(true);const offlineA='<script>window.__syncLeak=1</script> A 오프라인에서 이어 쓴 가상 요청문입니다.';await a.locator(promptSel).fill(offlineA);await a.locator('#wp-sync-status').filter({hasText:'계정에 연결하지 못했어요'}).waitFor();
  check('offline writing remains in the editor and opted-in local storage',(await a.locator(promptSel).inputValue())===offlineA&&await a.evaluate(({id,text})=>JSON.parse(localStorage.getItem(`synk-workroom:ai-practice:v1:${id}`)).run.prompt===text,{id:user.id,text:offlineA}));
  const newB='기기 B의 최신 요청문입니다. A와 별도로 수정한 자료의 근거를 확인합니다.';await b.locator(promptSel).fill(newB);await waitPrompt(b,newB);await contexts[0].setOffline(false);await refresh(a);
  await a.locator('[data-action="practice-sync-local"]').waitFor();check('concurrent offline edits create a choice without replacing either draft',(await a.locator(promptSel).inputValue())===offlineA&&(await remote(b)).state.run.prompt===newB);
  for(const detail of await a.locator('.wp-sync-preview').all())await detail.locator('summary').click();
  check('conflict previews show both drafts and render stored markup as text',(await a.locator('#wp-sync-status').innerText()).includes(offlineA)&&(await a.locator('#wp-sync-status').innerText()).includes(newB)&&await a.evaluate(()=>window.__syncLeak===undefined));
  for(const detail of await a.locator('.wp-sync-preview').all())if(await detail.getAttribute('open')!==null)await detail.locator('summary').click();
  for(const width of [390,320]){await a.setViewportSize({width,height:844});await a.evaluate(()=>document.fonts.ready);await a.locator('.wp-cloud').evaluate(el=>el.scrollIntoView({block:'start'}));check('conflict controls and writing fit '+width,await a.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));const name=`company-sync-conflict-${width}.png`;await a.screenshot({path:join(out,name)});report.screenshots.push(name);}
  await a.locator('[data-action="practice-sync-local"]').click();await waitPrompt(a,offlineA);check('explicit local choice saves the offered local writing',(await remote(a)).state.run.prompt===offlineA);await refresh(b);check('chosen local writing reaches the other device',(await b.locator(promptSel).inputValue())===offlineA);
  await contexts[0].setOffline(true);await a.locator(promptSel).fill('A에서 별도로 작성한 두 번째 오프라인 요청문입니다.');await a.locator('#wp-sync-status').filter({hasText:'계정에 연결하지 못했어요'}).waitFor();const remoteChoice='B에서 완성한 최신 요청문으로 이어갑니다. 가상 업무 근거를 함께 대조합니다.';await b.locator(promptSel).fill(remoteChoice);await waitPrompt(b,remoteChoice);await contexts[0].setOffline(false);await refresh(a);await a.locator('[data-action="practice-sync-remote"]').click();await waitFor(async()=>(await a.locator(promptSel).inputValue())===remoteChoice);
  check('explicit remote choice loads the offered account writing',(await a.locator(promptSel).inputValue())===remoteChoice);
  // Hold a POST after its GET, then let the other device win the revision race.
  let held,releasePost;const intercepted=new Promise(resolve=>held=resolve),postGate=new Promise(resolve=>releasePost=resolve);let postCaptured=false;
  await contexts[0].route('**/api/workroom-practice/state',async route=>{if(route.request().method()==='POST'&&!postCaptured){postCaptured=true;held();await postGate;}await route.continue();});
  const raceA='A에서 먼저 보내려 했지만 충돌하는 가상 요청문입니다.';await a.locator(promptSel).fill(raceA);await intercepted;const raceB='B가 먼저 저장한 최신 요청문입니다. 다른 기기의 기록과 비교합니다.';await b.locator(promptSel).fill(raceB);await waitPrompt(b,raceB);releasePost();await a.locator('[data-action="practice-sync-remote"]').waitFor();
  check('HTTP 409 exposes a fresh explicit choice and preserves the unsent local draft',(await a.locator(promptSel).inputValue())===raceA&&(await remote(b)).state.run.prompt===raceB);await contexts[0].unroute('**/api/workroom-practice/state');await a.locator('[data-action="practice-sync-remote"]').click();await waitFor(async()=>(await a.locator(promptSel).inputValue())===raceB);
  const task=await a.evaluate(()=>({name:wp.value.run.task,checks:wp.value.run.checkIds.map(id=>wp.model.TASKS[wp.value.run.task].checks.find(check=>check.id===id))}));
  for(const c of task.checks){await a.locator(`[data-wp-check="${c.id}"][data-wp-part="kind"]`).selectOption(c.answer);await a.locator(`[data-wp-check="${c.id}"][data-wp-part="source"]`).selectOption(c.source);}
  await a.locator('[data-action="practice-check"]').click();const revised='사용자가 직접 수정한 가상 업무 결과입니다. 담당과 기한 및 확인되지 않은 내용을 원문에 대조해 작성했습니다.';await a.locator('[data-wp-field="draft"]').fill(revised);await a.locator('[data-wp-field="reviewed"]').check();await a.locator('[data-action="practice-complete"]').click();
  await waitFor(async()=>(await remote(a)).state?.run?.step==='result');await refresh(b);await b.locator('[data-wp-field="finished"]').waitFor();
  check('completed writing and review results continue on the other device',(await b.locator('[data-wp-field="finished"]').inputValue())===revised&&await b.evaluate(()=>wp.value.history.length===1&&wp.value.run.result.every(check=>check.correct)));
  await b.locator('[data-action="practice-feedback"][data-id="helpful"]').click();await waitFor(async()=>(await remote(b)).state?.run?.feedback==='helpful');await refresh(a);check('explicit feedback returns to the first device',await a.locator('[data-action="practice-feedback"][data-id="helpful"]').getAttribute('aria-pressed')==='true');
  await b.locator('[data-action="practice-next"]').click();await b.locator('[data-wp-field="task"][value="planning"]').check();await b.locator('[data-wp-setup] button[type=submit]').click();await b.locator(promptSel).waitFor();const nextPrompt='기획 실습에서도 같은 계정의 완료 기록과 근거를 확인하며 이어갑니다.';await b.locator(promptSel).fill(nextPrompt);await waitPrompt(b,nextPrompt);await refresh(a);
  check('a new task continues with the prior completion and profile in the same account',(await a.locator(promptSel).inputValue())===nextPrompt&&await a.evaluate(()=>wp.value.run.task==='planning'&&wp.value.history.length===1&&wp.value.profile.scope.personId===state.user.id));
  // Keep B's local writing while A deletes the shared private record.
  await b.locator(saveSel).check();await contexts[1].setOffline(true);const stale='삭제 후에도 이 기기에만 남겨 둔 가상 작성물입니다.';await b.locator(promptSel).fill(stale);await b.locator('#wp-sync-status').filter({hasText:'계정에 연결하지 못했어요'}).waitFor();
  await a.locator('[data-action="practice-ask-clear"]').click();await a.locator('[data-action="practice-clear"]').click();await waitFor(async()=>(await remote(a)).status==='deleted');check('deletion removes the remote body and clears the requesting device',(await remote(a)).state===null&&await a.locator('[data-wp-setup]').count()===1);
  await contexts[1].setOffline(false);await refresh(b);await b.locator('[data-action="practice-sync-local"]').waitFor();
  check('stale device sees deletion and stops sync instead of resurrecting the record',!await b.locator(syncSel).isChecked()&&(await b.locator(promptSel).inputValue())===stale&&(await remote(b)).status==='deleted');
  await b.reload();await b.locator(promptSel).waitFor();check('a stale locally saved draft can reload without re-uploading the deleted account record',(await b.locator(promptSel).inputValue())===stale&&!await b.locator(syncSel).isChecked()&&(await remote(b)).status==='deleted');
  await b.locator(syncSel).check();await waitPrompt(b,stale);check('a fresh explicit opt-in may activate a new account revision',(await remote(b)).status==='active');
  // A delayed response from the old login must never appear in a different employee's workspace.
  await a.locator(syncSel).check();await a.locator(promptSel).waitFor();await waitFor(()=>a.evaluate(()=>!wp.sync.view().busy));const oldRecord=await remote(a);let heldGet,releaseGet;const got=new Promise(resolve=>heldGet=resolve),getGate=new Promise(resolve=>releaseGet=resolve);let getCaptured=false;
  await contexts[0].route('**/api/workroom-practice/state',async route=>{if(route.request().method()==='GET'&&!getCaptured){getCaptured=true;heldGet();await getGate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(oldRecord)});}else await route.continue();});
  await a.locator(refreshSel).click();await got;await a.locator('[data-action="marin-account"]').click();await a.locator('[data-action="logout"]').click();await a.locator('[data-form="auth"]').waitFor();await login(a,otherEmail);releaseGet();await pause(300);
  check('late old-session response cannot populate a different account',await a.evaluate(id=>state.user.id===id&&wp.value.profile===null&&wp.value.run===null,other.id));check('new account has its own empty remote state',(await remote(a)).status==='empty');await contexts[0].unroute('**/api/workroom-practice/state');
  check('no script or UI exceptions',report.errors.length===0);check('all required assets load',report.assetErrors.length===0);check('no external service or paid AI requests',report.externalRequests.length===0);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{
  if(browser)await browser.close();if(company)await company.stop();const target=resolve(directory),parent=resolve(tmpdir());assert.ok(target.startsWith(parent+sep)&&target.split(sep).at(-1).startsWith('synk-shift-sync-ui-'));await rm(target,{recursive:true,force:true});report.temporaryDatabaseRemoved=true;
  await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failure:report.failure,errors:report.errors,assetErrors:report.assetErrors,externalRequests:report.externalRequests}));
}
