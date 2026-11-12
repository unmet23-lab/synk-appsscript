// Browser check of the one-login screens (2026-11-12, 「한 사람 = SYNK ID 하나」): the workspace login puts 「SYNK ID로 로그인」 first and
// folds the company password under 「회사 비밀번호로 로그인」, the PULSE staff screen sends people to that login and gets them back,
// and 「로그인 정보」 names the company account email. Also: a deep link survives the PULSE trip, a SYNK ID return that failed says why,
// and a SYNK ID session names the SYNK ID login email next to the company email. Disposable SQLite and synthetic crews only; outside requests are blocked.
// node qa/verify-one-login.mjs  (Playwright: MESSENGER_PLAYWRIGHT, Chrome: MESSENGER_CHROME, output: SYNK_ONE_LOGIN_QA_OUT)
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {createCompanyApp} from '../server.mjs';

const require=createRequire(import.meta.url),here=dirname(fileURLToPath(import.meta.url));
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=resolve(process.env.SYNK_ONE_LOGIN_QA_OUT||join(here,'../../../../../../.tmp/synk-login-20261112/qa'));
const report={checkedAt:new Date().toISOString(),synthetic:true,production:false,checks:[],errors:[],consoleErrors:[],assetErrors:[],apiFailures:[],unauthorized:[],unexpectedRequests:[],screenshots:[],responsive:[]};
const check=(name,value=true,detail)=>{report.checks.push({name,ok:Boolean(value),...(detail===undefined?{}:{detail})});assert.ok(value,name+(detail===undefined?'':' '+JSON.stringify(detail)));};
const password='one-login-ui-password-2026',missingProject='0a0b0c0d-1111-4222-8333-444455556666',synkOwnerEmail='one-login-owner@example.test';
const freePort=async()=>{const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));return port;};
const apps=[],dirs=[];let browser;
async function startApp(synk){
  const dataDir=await mkdtemp(join(tmpdir(),'synk-one-login-ui-'));dirs.push(dataDir);const port=await freePort();
  const app=createCompanyApp({dataDir,messengerDataDir:join(dataDir,'messenger'),port,origin:`http://127.0.0.1:${port}`,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,
    synkIdentityConfig:synk?{accountApiUrl:'https://identity.example.test/functions/v1/synk-account',publishableKey:'fixture-public',issuer:'https://identity.example.test',clientId:'messenger-browser'}:null,
    synkIdentityVerifier:async()=>{throw Object.assign(Error('no central identity in this check'),{status:401});},teachingConfig:null,synkCustomerIdentityConfig:null,
    messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})},collector:async()=>{throw Error('Collection is not part of this check');}});
  const crew=app.store.createUser({name:'합성 크루',email:'one-login-crew@example.test',password,role:'member'});
  app.store.createUser({name:'합성 관리자',email:'one-login-admin@example.test',password,role:'admin'});
  await app.start();apps.push(app);return {app,crew,base:`http://127.0.0.1:${port}`};
}
async function newPage(base,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base||['data:','blob:'].includes(url.protocol))return route.continue();report.unexpectedRequests.push(url.href);return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('response',response=>{const path=new URL(response.url()).pathname;if(response.status()>=400&&['script','stylesheet','image','font'].includes(response.request().resourceType()))report.assetErrors.push({path,status:response.status()});if(response.status()>=400&&path.startsWith('/api/')&&!['/api/me','/api/login'].includes(path))report.apiFailures.push({path,status:response.status()});if(response.status()===401)report.unauthorized.push({path,page:new URL(page.url()).pathname+new URL(page.url()).search});});
  return {context,page};
}
async function fit(page,label){
  const d=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,modal:(()=>{const box=document.querySelector('[role=dialog]')?.getBoundingClientRect();return box?{x:box.x,right:box.right}:null;})()}));
  report.responsive.push({label,...d});check(label+' has no horizontal overflow',d.scroll<=d.width+1,d);
  if(d.modal)check(label+' dialog fits the viewport',d.modal.x>=-1&&d.modal.right<=d.width+1,d.modal);
}
async function shot(page,name){const path=join(out,name);await page.screenshot({path,fullPage:true});report.screenshots.push(path);}
const visible=(page,selector)=>page.locator(selector).first().isVisible();
async function passwordLogin(page,crew){
  if(!await page.locator('#auth-company').evaluate(node=>node.open))await page.locator('#auth-company > summary').click();
  await page.fill('#auth-form input[name="email"]',crew.email);await page.fill('#auth-form input[name="password"]',password);await page.locator('#auth-form button[type="submit"]').click();
}
try{
  await mkdir(out,{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const ready=await startApp(true),closed=await startApp(false);
  for(const [width,height,tag] of [[1440,960,'1440'],[390,844,'390']]){
    // 1. SYNK ID first, company password folded.
    let {context,page}=await newPage(ready.base,width,height);
    await page.goto(ready.base+'/');await page.locator('#synk-id-login').waitFor();
    await page.waitForFunction(()=>document.querySelector('#synk-id-login-note')?.textContent!=='연결 상태를 확인하고 있어요.');
    check(tag+' SYNK ID button is the one open way in',(await page.locator('#synk-id-login').innerText()).trim()==='SYNK ID로 로그인'&&!await page.locator('#synk-id-login').isDisabled());
    check(tag+' note says which SYNK ID gets in',(await page.locator('#synk-id-login-note').innerText()).includes('회사 계정에 연결한 SYNK ID만'));
    check(tag+' company password row starts folded',!await page.locator('#auth-company').evaluate(node=>node.open)&&!await visible(page,'#auth-form input[name="password"]'));
    check(tag+' SYNK ID entry stands above the folded row',await page.evaluate(()=>{const a=document.querySelector('.synk-login-entry'),b=document.querySelector('#auth-company');return Boolean(a&&b&&a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);}));
    check(tag+' stuck link stays outside the fold',await visible(page,'.auth-form-card > .auth-help-link'));
    await shot(page,`${tag}-01-login-folded.png`);await fit(page,tag+' login folded');
    // 2. Opening the row puts focus on the company email; labels say whose password.
    await page.locator('#auth-company > summary').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.activeElement?.name==='email');
    const labels=await page.locator('#auth-form .field').allInnerTexts();
    check(tag+' fields name the company email and company password',labels.some(t=>t.startsWith('회사 계정 이메일'))&&labels.some(t=>t.startsWith('회사 비밀번호')),labels);
    check(tag+' note says it is not the SYNK ID password',(await page.locator('.auth-company-note').innerText()).includes('SYNK ID 비밀번호가 아니라'));
    await shot(page,`${tag}-02-login-open.png`);await fit(page,tag+' login open');
    // 3. A wrong company password names both passwords.
    await page.fill('#auth-form input[name="email"]',ready.crew.email);await page.fill('#auth-form input[name="password"]','not-the-password-123');await page.locator('#auth-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#auth-form .form-error')?.textContent.trim());
    check(tag+' wrong password message names the company password and the SYNK ID way',(await page.locator('#auth-form .form-error').innerText()).includes('회사 비밀번호')&&(await page.locator('#auth-form .form-error').innerText()).includes('SYNK ID로 로그인'));
    // 4. Company password login, then 「로그인 정보」.
    await page.fill('#auth-form input[name="password"]',password);await page.locator('#auth-form button[type="submit"]').click();
    await page.waitForFunction(()=>Boolean(state.user&&state.data));
    check(tag+' this browser remembers the company password way',await page.evaluate(()=>localStorage.getItem('synk.workspace.lastLogin'))==='password');
    await page.evaluate(()=>loginInfoModal());await page.locator('dl.login-info').waitFor();
    const terms=await page.locator('dl.login-info dt').allInnerTexts();
    check(tag+' login information names the company email and company password',terms.join('|')==='회사 계정 이메일|회사 비밀번호|SYNK ID',terms);
    check(tag+' login information shows the company email',(await page.locator('dl.login-info').innerText()).includes(ready.crew.email));
    check(tag+' a company-password session names no SYNK ID email',await page.locator('.login-info-differs').count()===0);
    await shot(page,`${tag}-03-login-info.png`);await fit(page,tag+' login info');
    // 4b. SYNK ID round trips while signed in: a failure keeps the company session and says so once, a link says it is done, a login says nothing.
    const toast=()=>page.evaluate(()=>({text:document.querySelector('#toast')?.textContent||'',shown:Boolean(document.querySelector('#toast')?.classList.contains('show'))}));
    await page.goto(ready.base+'/?tab=messenger&synkError=SYNK_FLOW');await page.waitForFunction(()=>Boolean(state.user&&state.data));
    let notice=await toast();
    check(tag+' a failed SYNK ID return while signed in keeps the company session and says so',notice.shown&&notice.text.includes('회사 계정은 그대로')&&!new URL(page.url()).searchParams.has('synkError'),notice);
    await page.evaluate(()=>sessionStorage.setItem('synk.workspace.synkAction','link'));await page.goto(ready.base+'/?tab=messenger&synkConnected=1');await page.waitForFunction(()=>Boolean(state.user&&state.data));
    notice=await toast();check(tag+' a link return says the link is done',notice.shown&&notice.text==='SYNK ID 연결을 완료했어요.',notice);
    await page.evaluate(()=>sessionStorage.setItem('synk.workspace.synkAction','login'));await page.goto(ready.base+'/?tab=messenger&synkConnected=1');await page.waitForFunction(()=>Boolean(state.user&&state.data));
    notice=await toast();check(tag+' a login return shows no link notice',!notice.shown&&!new URL(page.url()).searchParams.has('synkConnected')&&await page.evaluate(()=>sessionStorage.getItem('synk.workspace.synkAction'))===null,notice);
    // 5. Signed out again in the same browser: the remembered way opens the row by itself.
    await context.clearCookies();await page.goto(ready.base+'/');await page.locator('#synk-id-login').waitFor();
    check(tag+' remembered company password way opens the row',await page.locator('#auth-company').evaluate(node=>node.open));
    await context.close();
    // 6. PULSE staff screen: one SYNK ID button, back to the staff screen after signing in.
    ({context,page}=await newPage(ready.base,width,height));
    // Opened from a deep link (a project this crew cannot see): the link has to survive the trip through the workspace login.
    await page.goto(ready.base+`/pulse-app/?mode=staff&project=${missingProject}&tab=history`);await page.locator('.login-wrap').waitFor();
    check(tag+' PULSE staff login has no password form and no check button',await page.locator('form[data-form="login"]').count()===0&&await page.locator('[data-action="check-login"]').count()===0);
    check(tag+' PULSE staff login sends people to the workspace login with a way back',await page.locator('.login-wrap a.button.primary').getAttribute('href')==='/?after=pulse-staff');
    await shot(page,`${tag}-04-pulse-staff-login.png`);await fit(page,tag+' PULSE staff login');
    check(tag+' PULSE staff login button keeps the deep link',await page.locator('.login-wrap a.button.primary').getAttribute('data-staff-login')!==null);
    await page.locator('.login-wrap a.button.primary').click();await page.locator('#synk-id-login').waitFor();
    check(tag+' the deep link waits in this tab while signing in',JSON.parse(await page.evaluate(()=>sessionStorage.getItem('synk-pulse-staff-return'))||'{}').search===`mode=staff&project=${missingProject}&tab=history`);
    check(tag+' workspace login says it will go back',await visible(page,'.auth-after-note'));
    check(tag+' the way-back key leaves the address',!new URL(page.url()).searchParams.has('after'));
    await shot(page,`${tag}-05-login-after-pulse.png`);await fit(page,tag+' login after PULSE');
    await passwordLogin(page,ready.crew);
    await page.waitForURL(url=>url.pathname==='/pulse-app/'&&url.searchParams.get('mode')==='staff');
    await page.waitForFunction(()=>!document.querySelector('.login-wrap')&&document.querySelector('#main')?.children.length>0);
    check(tag+' signed in, the PULSE staff screen opens without its login card',await page.locator('.login-wrap').count()===0);
    check(tag+' the way back is used once',await page.evaluate(()=>sessionStorage.getItem('synk.workspace.after'))===null);
    await page.waitForFunction(()=>!document.querySelector('#notice')?.hidden);
    check(tag+' the deep link opens after signing in (this crew is told the project is not theirs)',(await page.locator('#notice').innerText()).includes('이 프로젝트를 찾을 수 없거나')&&await page.evaluate(()=>sessionStorage.getItem('synk-pulse-staff-return'))===null);
    await shot(page,`${tag}-06-pulse-staff-after.png`);await fit(page,tag+' PULSE staff after');
    await context.close();
    // 7. Back from SYNK ID with a SYNK ID that is not linked: the reason stays under the button and the company row opens.
    ({context,page}=await newPage(ready.base,width,height));
    await page.goto(ready.base+'/?tab=messenger&synkError=SYNK_NOT_LINKED');await page.locator('#synk-id-login').waitFor();
    await page.waitForFunction(()=>!document.querySelector('#synk-id-login')?.disabled);
    const failedNote=await page.locator('#synk-id-login-note').innerText();
    check(tag+' a SYNK ID that is not linked is told how to link it',failedNote.includes('아직 회사 계정에 연결되지 않았어요')&&failedNote.includes('연결 관리')&&await page.locator('#synk-id-login-note').evaluate(node=>node.classList.contains('is-error')),failedNote);
    check(tag+' the failed return opens the company password row',await page.locator('#auth-company').evaluate(node=>node.open));
    check(tag+' the failure code leaves the address and the screen stays put',!new URL(page.url()).searchParams.has('synkError')&&new URL(page.url()).searchParams.get('tab')==='messenger');
    check(tag+' the login screen shows the reason once, not as a toast',!await page.evaluate(()=>document.querySelector('#toast')?.classList.contains('show')));
    await shot(page,`${tag}-08-login-synk-not-linked.png`);await fit(page,tag+' login SYNK not linked');
    await page.reload();await page.locator('#synk-id-login').waitFor();await page.waitForFunction(()=>!document.querySelector('#synk-id-login')?.disabled);
    check(tag+' after a reload the usual note is back',(await page.locator('#synk-id-login-note').innerText()).includes('회사 계정에 연결한 SYNK ID만'));
    await context.close();
    // 8. A SYNK ID session (stood in for in the browser; the server side is server-synk-identity.test.mjs): remembered as the SYNK ID way, login information names both emails.
    ({context,page}=await newPage(ready.base,width,height));
    await page.goto(ready.base+'/');await page.locator('#synk-id-login').waitFor();await passwordLogin(page,ready.crew);await page.waitForFunction(()=>Boolean(state.user&&state.data));
    await page.route(ready.base+'/api/me',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),synkUserId:'00000000-0000-4000-8000-000000000001'}});});
    await page.route(ready.base+'/api/synk-id/status',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),linked:true,loginEmail:synkOwnerEmail}});});
    await page.reload();await page.waitForFunction(()=>Boolean(state.user&&state.data));
    check(tag+' a SYNK ID session is remembered as the SYNK ID way',await page.evaluate(()=>localStorage.getItem('synk.workspace.lastLogin'))==='synk');
    await page.evaluate(()=>loginInfoModal());await page.locator('dl.login-info').waitFor();
    const synkInfo=await page.locator('dl.login-info').innerText();
    check(tag+' login information names the SYNK ID login email and the company email',synkInfo.includes('지금 들어온 SYNK ID 이메일: '+synkOwnerEmail)&&synkInfo.includes(ready.crew.email),synkInfo);
    check(tag+' a different SYNK ID email gets the company-email notice',await page.locator('.login-info-differs').count()===1);
    await shot(page,`${tag}-09-login-info-synk.png`);await fit(page,tag+' login info SYNK');
    await context.clearCookies();await page.unroute(ready.base+'/api/me');await page.unroute(ready.base+'/api/synk-id/status');
    await page.goto(ready.base+'/');await page.locator('#synk-id-login').waitFor();await page.waitForFunction(()=>!document.querySelector('#synk-id-login')?.disabled);
    check(tag+' signed out after a SYNK ID session, the company row stays folded',!await page.locator('#auth-company').evaluate(node=>node.open));
    await context.close();
    // 9. A server without SYNK ID: the row opens by itself and focus stays put.
    ({context,page}=await newPage(closed.base,width,height));
    await page.goto(closed.base+'/');await page.locator('#synk-id-login').waitFor();
    await page.waitForFunction(()=>document.querySelector('#synk-id-login-note')?.textContent!=='연결 상태를 확인하고 있어요.');
    check(tag+' without SYNK ID the button is closed and the row is open',await page.locator('#synk-id-login').isDisabled()&&await page.locator('#auth-company').evaluate(node=>node.open));
    check(tag+' without SYNK ID the note points to the company password',(await page.locator('#synk-id-login-note').innerText()).includes('회사 비밀번호'));
    check(tag+' opening by itself does not move focus into the form',await page.evaluate(()=>!document.activeElement?.closest?.('#auth-company')));
    await shot(page,`${tag}-07-login-no-synk.png`);await fit(page,tag+' login without SYNK');
    await page.locator('[data-action="auth-help"]').click();await page.locator('.auth-help').waitFor();
    await page.locator('.auth-help [data-action="auth-login"]').click();await page.locator('#auth-form').waitFor();
    check(tag+' back from help with the row open puts focus on the company email',await page.evaluate(()=>document.activeElement?.name)==='email');
    await context.close();
  }
  check('no page errors',report.errors.length===0,report.errors);
  // Step 3 types a wrong company password once per width on purpose, and step 7 opens the signed-out screen at the server's SYNK ID return
  // address (?tab=messenger), whose messenger frame asks once and is refused (as it was before this change). Those 401s and nothing else.
  const unauthorized=report.unauthorized.map(row=>row.path+' @ '+row.page).sort();
  check('the only 401s are the deliberate wrong passwords and the signed-out messenger frame',JSON.stringify(unauthorized)===JSON.stringify(['/api/login @ /','/api/login @ /','/messenger/api/bootstrap @ /?tab=messenger','/messenger/api/bootstrap @ /?tab=messenger']),unauthorized);
  const expected401=report.consoleErrors.filter(text=>text.includes('status of 401')),otherConsole=report.consoleErrors.filter(text=>!text.includes('status of 401'));
  check('the console shows those 401s and nothing else',expected401.length===unauthorized.length&&otherConsole.length===0,report.consoleErrors);
  check('no failed assets',report.assetErrors.length===0,report.assetErrors);
  check('no failed API calls besides the expected login checks',report.apiFailures.length===0,report.apiFailures);
  check('no outside requests',report.unexpectedRequests.length===0,report.unexpectedRequests);
}finally{
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n').catch(()=>{});
  await browser?.close();for(const app of apps)await app.stop().catch(()=>{});
  for(const dir of dirs){assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.ok).length,screenshots:report.screenshots.length,out}));
