// Browser acceptance checks use disposable company accounts and databases only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {createCompanyApp} from './server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const here=dirname(fileURLToPath(import.meta.url)),out=join(here,'verification/workroom-practice-20261002');
const dir=await mkdtemp(join(tmpdir(),'synk-workroom-practice-ui-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const app=createCompanyApp({dataDir:dir,port,schedule:false}),base=`http://127.0.0.1:${port}`;
const report={at:new Date().toISOString(),checks:[],errors:[],assetErrors:[],externalRequests:[]};let browser;
function check(name,value=true){assert.ok(value,name);report.checks.push(name);}
try{
  await mkdir(out,{recursive:true});
  const password='workroom-practice-fixture-only';
  const users={};for(const role of ['member','viewer'])users[role]=app.store.createUser({name:'검증 '+role,email:role+'@example.test',role,password});
  await app.start();
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true}),page=await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400&&['script','stylesheet','image','font'].includes(response.request().resourceType()))report.assetErrors.push({url:response.url(),status:response.status()});});
  page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))report.externalRequests.push(request.url());});
  const field=name=>page.locator(`[data-wp-field="${name}"]`),action=name=>page.locator(`[data-action="practice-${name}"]`);
  const ready=()=>page.locator('[data-workroom-practice="ready"]').waitFor();
  const screenshot=async name=>{await page.screenshot({path:join(out,name),fullPage:true});};
  const fit=async label=>check(label,await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  const practice=async()=>{await page.goto(base+'/?tab=workroom&section=practice');await ready();};
  const login=async role=>{await page.locator('[name=email]').fill(role+'@example.test');await page.locator('[name=password]').fill(password);await page.locator('[data-form=auth] button[type=submit]').click();try{await page.locator('.workspace-rail').waitFor();}catch(error){report.loginFailure={role,message:await page.locator('.form-error').allTextContents()};throw error;}};
  const logout=async()=>{await page.locator('[data-action="marin-account"]').click();await page.locator('[data-action="logout"]').click();await page.locator('[data-form=auth]').waitFor();};
  await page.goto(base+'/?tab=workroom&section=practice');
  check('anonymous user sees company login',await page.locator('[data-form=auth]').isVisible());
  await login('member');await practice();
  check('practice opens in company shell without a second client',await page.locator('.workspace-rail').isVisible()&&await page.locator('.wp-practice iframe').count()===0);
  check('default storage is off',!await field('save').isChecked());
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await fit('setup fits '+width);await screenshot('setup-'+width+'.png');}
  await page.locator('[data-wp-setup] button[type=submit]').click();await field('prompt').waitFor();
  await field('prompt').fill('원문 자료를 근거로 담당과 기한을 빠뜨리지 말고 실행 목록으로 정리해 주세요.');
  check('no opt-in creates no practice storage',await page.evaluate(()=>!Object.keys(localStorage).some(k=>k.startsWith('synk-workroom:ai-practice:'))));
  await field('prompt').press('ArrowLeft');
  const selection=await field('prompt').evaluate(e=>[e.selectionStart,e.selectionEnd]);
  await page.evaluate(()=>render());
  check('shell refresh preserves prompt and caret',await field('prompt').inputValue()==='원문 자료를 근거로 담당과 기한을 빠뜨리지 말고 실행 목록으로 정리해 주세요.'&&JSON.stringify(await field('prompt').evaluate(e=>[e.selectionStart,e.selectionEnd]))===JSON.stringify(selection)&&await field('prompt').evaluate(e=>document.activeElement===e));
  await action('desk').click();if(await page.getByRole('button',{name:'공통 메뉴 열기',exact:true}).isVisible())await page.getByRole('button',{name:'공통 메뉴 열기',exact:true}).click();await page.locator('[data-action="workroom-view"][data-tab="practice"]').click();await ready();
  check('draft survives workroom navigation',await field('prompt').inputValue()==='원문 자료를 근거로 담당과 기한을 빠뜨리지 말고 실행 목록으로 정리해 주세요.');
  await field('save').check();await page.reload();await ready();
  check('opt-in restores saved draft after reload',(await field('prompt').inputValue()).includes('실행 목록'));
  const runs=[
    {task:'meeting',answers:[['deadline','wrong','M1'],['approval','unsupported','M2']],draft:'지안은 10월 8일까지 안내 초안을 작성합니다. 80만 원 예산은 승인 대기입니다. 도윤은 10월 6일까지 접근성 검토 항목을 전달합니다.'},
    {task:'research',answers:[['ratio','wrong','R1'],['scope','unsupported','R2']],draft:'시범팀 20명 중 12명, 60%가 편리하다고 답했습니다. 전체 직원으로 확대할 수 없고 시간과 비용 효과는 측정하지 않았습니다.'},
    {task:'planning',answers:[['audience','match','P1'],['budget','wrong','P2']],draft:'신규 구성원 8명을 대상으로 2주 동안 최대 40만 원 안에서 시범 운영합니다. 유료 도구는 도입하지 않고 6명 이상의 독립 업무 완료를 확인합니다.'},
  ];
  for(const [index,run]of runs.entries()){
    if(index){await action('next').click();await page.locator(`[data-wp-field="task"][value="${run.task}"]`).check();await page.locator('[data-wp-setup] button[type=submit]').click();}
    await action('template').click();
    for(const [id,kind,source]of run.answers){await page.locator(`[data-wp-check="${id}"][data-wp-part="kind"]`).selectOption(kind);await page.locator(`[data-wp-check="${id}"][data-wp-part="source"]`).selectOption(source);}
    await action('check').click();check(run.task+' shows both source explanations',await page.locator('.wp-answer').count()===2);
    await field('draft').fill(run.draft);await field('reviewed').check();await action('complete').click();await field('finished').waitFor();
    check(run.task+' completes with the edited result',await field('finished').inputValue()===run.draft);
  }
  await screenshot('result-1280.png');
  const downloadPromise=page.waitForEvent('download');await action('export').click();const download=await downloadPromise;
  check('TXT download keeps the final edited result',(await readFile(await download.path(),'utf8')).includes(runs[2].draft)&&download.suggestedFilename()==='synk-shift-practice.txt');
  await page.locator('[data-action="practice-feedback"][data-id="helpful"]').click();
  check('feedback is submitted only once',await page.locator('[data-action="practice-feedback"][data-id="helpful"]').isDisabled());
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await fit('completed result fits '+width);await screenshot('result-'+width+'.png');}
  await page.setViewportSize({width:1280,height:900});
  await logout();await login('viewer');await practice();
  check('another company account cannot see prior draft or history',await page.locator('[data-wp-setup]').isVisible()&&(await action('history').textContent()).includes('0'));
  check('new account has not opted into storage',!await field('save').isChecked());
  await logout();await login('member');await practice();
  check('original account restores only its own finished practice',await field('finished').inputValue()===runs[2].draft);
  await action('history').click();check('all three exercises are retained',await page.locator('.wp-history').count()===3);
  await action('back').click();await action('next').click();
  await page.locator('[data-wp-field="task"][value="meeting"]').check();await field('minutes').selectOption('15');await field('goal').selectOption('prepare');await page.locator('[data-wp-setup] button[type=submit]').click();await action('template').click();
  for(const [id,kind,source]of [['deadline','wrong','M1'],['approval','unsupported','M2'],['missing','match','M3']]){await page.locator(`[data-wp-check="${id}"][data-wp-part="kind"]`).selectOption(kind);await page.locator(`[data-wp-check="${id}"][data-wp-part="source"]`).selectOption(source);}
  await action('check').click();await field('draft').fill(runs[0].draft);await field('reviewed').check();await action('complete').click();
  check('one missed source check identifies the relevant practice',await page.locator('.wp-next').innerText().then(text=>text.includes('누락·성공 기준 확인')&&text.includes('기획')));
  await action('next').click();check('next proposed task contains the missed skill',await page.locator('[data-wp-field="task"][value="planning"]').isChecked());
  await field('minutes').selectOption('5');await field('goal').selectOption('clarity');await page.locator('[data-wp-setup] button[type=submit]').click();
  check('short practice actually starts with the missed criterion',await page.locator('[data-wp-check]').first().getAttribute('data-wp-check')==='criteria');
  await action('setup').click();await page.locator('[data-wp-field="task"][value="research"]').check();await page.locator('[data-wp-setup] button[type=submit]').click();
  check('manual choice does not invent an unavailable weak-skill exercise',await page.locator('.wp-section-head').innerText().then(text=>text.includes('자료를 믿기 전에')&&!text.includes('누락·성공 기준 확인 항목부터')));
  await action('publish').click();
  await page.locator('[data-maker-tool="publish"][aria-pressed="true"]').waitFor();
  check('practice continues into existing production checks',await page.getByRole('heading',{name:'제작 도구',exact:true}).isVisible());
  check('no browser page exceptions',report.errors.length===0);check('all practice assets load',report.assetErrors.length===0);check('practice makes no external requests',report.externalRequests.length===0);
  report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{if(browser)await browser.close();await app.stop();const target=resolve(dir);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.split(sep).at(-1).startsWith('synk-workroom-practice-ui-'));await rm(target,{recursive:true,force:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,passed:report.checks.length,failure:report.failure,out}));}
