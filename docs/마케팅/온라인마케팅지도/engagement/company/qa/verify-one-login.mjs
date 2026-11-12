// Browser check of the one-login screens (2026-11-12, 「한 사람 = SYNK ID 하나」): the workspace login puts 「SYNK ID로 로그인」 first and
// folds the company password under 「회사 비밀번호로 로그인」, the PULSE staff screen sends people to that login and gets them back,
// and 「로그인 정보」 names the company account email. Disposable SQLite and synthetic crews only; outside requests are blocked.
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
const report={checkedAt:new Date().toISOString(),synthetic:true,production:false,checks:[],errors:[],consoleErrors:[],assetErrors:[],apiFailures:[],unexpectedRequests:[],screenshots:[],responsive:[]};
const check=(name,value=true,detail)=>{report.checks.push({name,ok:Boolean(value),...(detail===undefined?{}:{detail})});assert.ok(value,name+(detail===undefined?'':' '+JSON.stringify(detail)));};
const password='one-login-ui-password-2026';
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
  page.on('response',response=>{const path=new URL(response.url()).pathname;if(response.status()>=400&&['script','stylesheet','image','font'].includes(response.request().resourceType()))report.assetErrors.push({path,status:response.status()});if(response.status()>=400&&path.startsWith('/api/')&&!['/api/me','/api/login'].includes(path))report.apiFailures.push({path,status:response.status()});});
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
    // 5. Signed out again in the same browser: the remembered way opens the row by itself.
    await context.clearCookies();await page.goto(ready.base+'/');await page.locator('#synk-id-login').waitFor();
    check(tag+' remembered company password way opens the row',await page.locator('#auth-company').evaluate(node=>node.open));
    await context.close();
    // 6. PULSE staff screen: one SYNK ID button, back to the staff screen after signing in.
    ({context,page}=await newPage(ready.base,width,height));
    await page.goto(ready.base+'/pulse-app/?mode=staff');await page.locator('.login-wrap').waitFor();
    check(tag+' PULSE staff login has no password form and no check button',await page.locator('form[data-form="login"]').count()===0&&await page.locator('[data-action="check-login"]').count()===0);
    check(tag+' PULSE staff login sends people to the workspace login with a way back',await page.locator('.login-wrap a.button.primary').getAttribute('href')==='/?after=pulse-staff');
    await shot(page,`${tag}-04-pulse-staff-login.png`);await fit(page,tag+' PULSE staff login');
    await page.locator('.login-wrap a.button.primary').click();await page.locator('#synk-id-login').waitFor();
    check(tag+' workspace login says it will go back',await visible(page,'.auth-after-note'));
    check(tag+' the way-back key leaves the address',!new URL(page.url()).searchParams.has('after'));
    await shot(page,`${tag}-05-login-after-pulse.png`);await fit(page,tag+' login after PULSE');
    await passwordLogin(page,ready.crew);
    await page.waitForURL(url=>url.pathname==='/pulse-app/'&&url.searchParams.get('mode')==='staff');
    await page.waitForFunction(()=>!document.querySelector('.login-wrap')&&document.querySelector('#main')?.children.length>0);
    check(tag+' signed in, the PULSE staff screen opens without its login card',await page.locator('.login-wrap').count()===0);
    check(tag+' the way back is used once',await page.evaluate(()=>sessionStorage.getItem('synk.workspace.after'))===null);
    await shot(page,`${tag}-06-pulse-staff-after.png`);await fit(page,tag+' PULSE staff after');
    await context.close();
    // 7. A server without SYNK ID: the row opens by itself and focus stays put.
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
  // Step 3 types a wrong company password once per width on purpose; the browser logs that 401 and nothing else may appear.
  const expected401=report.consoleErrors.filter(text=>text.includes('status of 401')),otherConsole=report.consoleErrors.filter(text=>!text.includes('status of 401'));
  check('only the two deliberate wrong-password 401s reach the console',expected401.length===2&&otherConsole.length===0,report.consoleErrors);
  check('no failed assets',report.assetErrors.length===0,report.assetErrors);
  check('no failed API calls besides the expected login checks',report.apiFailures.length===0,report.apiFailures);
  check('no outside requests',report.unexpectedRequests.length===0,report.unexpectedRequests);
}finally{
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n').catch(()=>{});
  await browser?.close();for(const app of apps)await app.stop().catch(()=>{});
  for(const dir of dirs){assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.ok).length,screenshots:report.screenshots.length,out}));
