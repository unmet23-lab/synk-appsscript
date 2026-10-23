// Browser check of login recovery (2026-10-23): help panel, one-time reset link, login after reset, the administrator's link
// window and every crew's login information window. Disposable SQLite and synthetic crews only; outside requests are blocked.
// node qa/verify-login-recovery.mjs  (Playwright: MESSENGER_PLAYWRIGHT, Chrome: MESSENGER_CHROME, output: SYNK_LOGIN_RECOVERY_QA_OUT)
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
const out=resolve(process.env.SYNK_LOGIN_RECOVERY_QA_OUT||join(here,'../../../../../../.tmp/login-recovery-20261023/qa'));
const dataDir=await mkdtemp(join(tmpdir(),'synk-login-recovery-ui-'));
const report={checkedAt:new Date().toISOString(),synthetic:true,production:false,checks:[],errors:[],consoleErrors:[],assetErrors:[],apiFailures:[],unexpectedRequests:[],screenshots:[],responsive:[]};
const check=(name,value=true,detail)=>{report.checks.push({name,ok:Boolean(value),...(detail===undefined?{}:{detail})});assert.ok(value,name);};
const password='login-recovery-ui-password',fresh='login-recovery-ui-new-password';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
let company,browser;
async function fit(page,label){
  const d=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,inner:innerWidth,visual:visualViewport?.width||innerWidth,modal:(()=>{const box=document.querySelector('[role=dialog]')?.getBoundingClientRect();return box?{x:box.x,y:box.y,right:box.right,bottom:box.bottom}:null;})()}));
  report.responsive.push({label,...d});
  check(label+' has no horizontal overflow',d.scroll<=d.width+1&&d.inner<=d.visual+1,d);
  if(d.modal)check(label+' dialog fits the viewport',d.modal.x>=-1&&d.modal.right<=d.inner+1,d.modal);
}
async function shot(page,name){const path=join(out,name);await page.screenshot({path,fullPage:true});report.screenshots.push(path);}
async function newPage(width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base||['data:','blob:'].includes(url.protocol))return route.continue();report.unexpectedRequests.push(url.href);return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('response',response=>{const path=new URL(response.url()).pathname;if(response.status()>=400&&['script','stylesheet','image','font'].includes(response.request().resourceType()))report.assetErrors.push({path,status:response.status()});if(response.status()>=400&&path.startsWith('/api/'))report.apiFailures.push({path,status:response.status()});});
  return {context,page};
}
let base;
try{
  await mkdir(out,{recursive:true});
  company=createCompanyApp({dataDir,messengerDataDir:join(dataDir,'messenger'),port,origin:`http://127.0.0.1:${port}`,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})},collector:async()=>{throw Error('Collection is not part of this check');}});
  const admin=company.store.createUser({name:'합성 관리자',email:'recovery-admin@example.test',password,role:'admin'});
  const crew=company.store.createUser({name:'합성 크루',email:'recovery-crew@example.test',password,role:'member'});
  const bare=company.store.createUser({name:'비밀번호 없는 크루',email:'recovery-bare@example.test',role:'member'});
  await company.start();base=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const [width,height,tag] of [[1440,960,'1440'],[390,844,'390']]){
    // 1. Login screen → help panel → back.
    let {context,page}=await newPage(width,height);
    await page.goto(base+'/');await page.locator('#auth-form').waitFor();
    check(tag+' login shows the forgot link',await page.locator('[data-action="auth-help"]').count()===1);
    await shot(page,`${tag}-01-login.png`);await fit(page,tag+' login');
    await page.locator('[data-action="auth-help"]').click();await page.locator('.auth-help').waitFor();
    check(tag+' help panel has three ways and the administrator line',await page.locator('.auth-help-way').count()===3&&await page.locator('.auth-help-admin').count()===1);
    await page.waitForFunction(()=>document.querySelector('#auth-help-synk-note')?.textContent!=='연결 상태를 확인하고 있어요.');
    check(tag+' help SYNK button stays closed without SYNK settings',await page.locator('#auth-help-synk').isDisabled());
    await shot(page,`${tag}-02-help.png`);await fit(page,tag+' help');
    await page.locator('.auth-help [data-action="auth-login"]').click();await page.locator('#auth-form').waitFor();check(tag+' back to login',await page.locator('.auth-help').count()===0);
    check(tag+' back to login puts focus on the login ID field',await page.evaluate(()=>document.activeElement?.name)==='email');
    await context.close();
    // 2. Administrator makes a link in 팀·크루.
    ({context,page}=await newPage(width,height));
    await page.goto(base+'/');await page.locator('#auth-form').waitFor();
    await page.fill('#auth-form input[name="email"]',admin.email);await page.fill('#auth-form input[name="password"]',password);await page.locator('#auth-form button[type="submit"]').click();
    await page.waitForFunction(()=>Boolean(state.user&&state.data));
    await page.evaluate(()=>{selectWorkspaceView('members');render();});await page.locator('.people-list').waitFor();
    check(tag+' reset button only on the active non-admin crew rows',await page.locator('[data-action="member-password-reset"]').count()===2&&await page.locator(`[data-action="member-password-reset"][data-id="${admin.id}"]`).count()===0);
    // Fable 검수 F1: three buttons on a crew row must stay inside the list and off the status chip and channel count at every width.
    for(const width of tag==='1440'?[1920,1440,1180,1000]:[390]){
      await page.setViewportSize({width,height});
      const geometry=await page.evaluate(()=>{const list=document.querySelector('.people-list').getBoundingClientRect(),rows=[...document.querySelectorAll('.person-row')].filter(row=>row.querySelector('[data-action="member-password-reset"]'));
        const inside=box=>box.left>=list.left-1&&box.right<=list.right+1,overlap=(a,b)=>a&&b&&a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
        return rows.map(row=>{const buttons=[...row.querySelectorAll('.person-actions button')].map(button=>button.getBoundingClientRect()),badge=row.querySelector(':scope>.status-badge'),channels=row.querySelector('.person-channels'),badgeBox=badge&&getComputedStyle(badge).display!=='none'?badge.getBoundingClientRect():null,channelBox=channels&&getComputedStyle(channels).display!=='none'?channels.getBoundingClientRect():null;
          return {buttons:buttons.length,inside:buttons.every(inside),coversBadge:buttons.some(box=>overlap(box,badgeBox)),coversChannels:buttons.some(box=>overlap(box,channelBox))};});});
      check(`${tag} crew row buttons fit at ${width}px`,geometry.length===2&&geometry.every(row=>row.buttons===3&&row.inside&&!row.coversBadge&&!row.coversChannels),geometry);
    }
    await page.setViewportSize({width,height});
    await page.locator(`.person-row:has([data-id="${crew.id}"])`).first().scrollIntoViewIfNeeded();
    await shot(page,`${tag}-03a-members.png`);await fit(page,tag+' members');
    await page.locator(`[data-action="member-password-reset"][data-id="${crew.id}"]`).click();await page.locator('[role=dialog]').waitFor();
    check(tag+' confirm names the crew and login ID',(await page.locator('[role=dialog]').innerText()).includes('recovery-crew@example.test'));
    await shot(page,`${tag}-03-admin-confirm.png`);
    await page.locator('[data-action="member-password-reset-confirm"]').click();await page.locator('[aria-label="비밀번호 재설정 링크"]').waitFor();
    const link=await page.locator('[aria-label="비밀번호 재설정 링크"]').inputValue();
    check(tag+' link window shows the link, login ID and an expiry time',/#reset=/.test(link)&&/까지 한 번 쓸 수 있어요/.test(await page.locator('[role=dialog]').innerText()));
    await shot(page,`${tag}-04-admin-link.png`);await fit(page,tag+' admin link window');
    await page.keyboard.press('Escape');
    // 3. Settings window entry and the login information window for this administrator.
    await page.locator('.appbar-account').click();await page.locator('.workspace-settings-list').waitFor();
    check(tag+' settings window lists login information',await page.locator('.workspace-settings-list [data-action="account-login-info"]').count()===1);
    await shot(page,`${tag}-05-settings.png`);
    await page.locator('.workspace-settings-list [data-action="account-login-info"]').click();await page.locator('.login-info').waitFor();
    check(tag+' login information shows the login ID and asks for the current password',(await page.locator('.login-info').innerText()).includes(admin.email)&&await page.locator('form[data-form="password"] input[name="oldPassword"]').count()===1);
    check(tag+' an administrator is sent to the operator, not to an administrator',(await page.locator('form[data-form="password"]').innerText()).includes('운영 담당'));
    await shot(page,`${tag}-06-login-info.png`);await fit(page,tag+' login information');
    await page.keyboard.press('Escape');check(tag+' closing login information returns focus to the account button',await page.evaluate(()=>document.activeElement?.classList.contains('appbar-account')));
    await context.close();
    // 4. The crew opens the link (a link preview or a second look does not spend it), sets a password and signs in.
    //    Fable 검수 F4: a busy limit on the first check keeps the link — 「다시 확인하기」 opens the form.
    ({context,page}=await newPage(width,height));
    let busy=true;await page.route('**/api/password-reset/inspect',route=>{if(!busy)return route.continue();busy=false;report.simulated=(report.simulated||0)+1;return route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.'})});});
    await page.goto(link);await page.locator('[data-action="auth-reset-retry"]').waitFor();
    check(tag+' a busy check offers to check again instead of calling the link spent',(await page.locator('.auth-form-card h2').innerText())==='링크를 확인하지 못했어요'&&await page.evaluate(()=>document.activeElement?.dataset?.action)==='auth-reset-retry');
    await shot(page,`${tag}-07a-reset-retry.png`);
    await page.locator('[data-action="auth-reset-retry"]').click();await page.locator('#auth-reset-form').waitFor();
    check(tag+' reset screen removes the token from the address',!page.url().includes('reset='));
    check(tag+' reset screen shows the login ID',(await page.locator('.auth-account').innerText()).includes('recovery-crew@example.test'));
    await shot(page,`${tag}-07-reset.png`);await fit(page,tag+' reset');
    await page.fill('#auth-reset-form input[name="password"]',fresh);await page.fill('#auth-reset-form input[name="confirmPassword"]',fresh+'x');await page.locator('#auth-reset-form button[type="submit"]').click();
    await page.locator('#auth-reset-form .form-error').filter({hasText:'서로 달라요'}).waitFor();
    await page.fill('#auth-reset-form input[name="confirmPassword"]',fresh);await page.locator('#auth-reset-form button[type="submit"]').click();
    await page.locator('#auth-form .auth-notice').waitFor();
    check(tag+' login after reset has the login ID filled in and focuses the password',await page.locator('#auth-form input[name="email"]').inputValue()==='recovery-crew@example.test'&&await page.evaluate(()=>document.activeElement?.name)==='password');
    await shot(page,`${tag}-08-after-reset.png`);await fit(page,tag+' after reset');
    await page.fill('#auth-form input[name="password"]',fresh);await page.locator('#auth-form button[type="submit"]').click();
    await page.waitForFunction(email=>state.user?.email===email,'recovery-crew@example.test');check(tag+' crew signs in with the new password',true);
    await context.close();
    // 5. The used link now says so.
    ({context,page}=await newPage(width,height));
    await page.goto(link);await page.locator('.auth-form-card .form-error').waitFor();
    check(tag+' used link explains what to do',/만료됐거나 이미 썼어요/.test(await page.locator('.auth-form-card .form-error').innerText())&&await page.locator('.auth-form-card [data-action="auth-help"]').count()===1);
    await shot(page,`${tag}-09-used-link.png`);await fit(page,tag+' used link');
    await context.close();
    // 6. A crew without a password sets the first one from the login information window.
    ({context,page}=await newPage(width,height));
    await context.addCookies([{name:'synk_company_session',value:company.store.mint('session',bare.id,{csrfToken:'bare-csrf'},60),url:base,httpOnly:true,sameSite:'Lax'}]);
    await page.goto(base+'/');await page.waitForFunction(()=>Boolean(state.user&&state.data));
    await page.locator('.appbar-account').click();await page.locator('.workspace-settings-list [data-action="account-login-info"]').click();await page.locator('.login-info').waitFor();
    check(tag+' a crew without a password is not asked for the current one',await page.locator('form[data-form="password"] input[name="oldPassword"]').count()===0&&(await page.locator('.login-info').innerText()).includes('아직 없음'));
    await shot(page,`${tag}-10-first-password.png`);await fit(page,tag+' first password');
    const first='first-password-from-window';
    await page.fill('form[data-form="password"] input[name="password"]',first);await page.fill('form[data-form="password"] input[name="confirmPassword"]',first);await page.locator('form[data-form="password"] button[type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('[role=dialog]')&&state.passwordSet===true);
    check(tag+' first password keeps this session',(await page.evaluate(async()=>(await fetch('/api/me')).json())).user?.email==='recovery-bare@example.test');
    await context.close();
    company.store.put('users',bare.id,{...company.store.get('users',bare.id),passwordHash:null});
  }
  check('no page errors',report.errors.length===0,report.errors);
  // The only refused API calls are, per width, the simulated busy check (429) and the used link (403); the browser logs each as a failed resource.
  const refusal=status=>({path:'/api/password-reset/inspect',status});
  check('the only refused API calls are the simulated busy check and the used-link check',JSON.stringify(report.apiFailures)===JSON.stringify([refusal(429),refusal(403),refusal(429),refusal(403)])&&report.simulated===2,report.apiFailures);
  check('no console errors besides those refusals',report.consoleErrors.filter(text=>!/Failed to load resource: the server responded with a status of (403|429)/.test(text)).length===0&&report.consoleErrors.length===report.apiFailures.length,report.consoleErrors);
  check('no missing assets',report.assetErrors.length===0,report.assetErrors);
  check('no outside requests',report.unexpectedRequests.length===0,report.unexpectedRequests);
  report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack||String(error);process.exitCode=1;}
finally{
  await browser?.close().catch(()=>{});await company?.stop().catch(()=>{});
  const target=resolve(dataDir),prefix=resolve(tmpdir())+sep;if(target.startsWith(prefix))await rm(target,{recursive:true,force:true});
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failed:report.checks.filter(row=>!row.ok).map(row=>row.name),failure:report.failure?.split('\n').slice(0,6).join('\n'),out},null,2));
}
