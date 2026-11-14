// Actual browser actions and HTTP handlers over a disposable synthetic database.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {createAdminBrowserFixture} from './admin-workspace-fixture.mjs';
import {크롬환경} from '../../../../../../tools/lib/크롬조종.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {화면시험,닫기}=require('../../../../../../tools/lib/화면시험.cjs');
await 화면시험({분:12},async()=>{
  const output=resolve(process.env.ADMIN_WORKSPACE_QA_OUT||'.tmp/admin-workspace-lifecycle');
  await mkdir(output,{recursive:true});
  const report={synthetic:true,production:false,checks:[],errors:[],requests:[]};
  const contexts=[],releases=[];let fixture,browser,page,failure;
  const check=(label,value=true)=>{assert.ok(value,label);report.checks.push(label);};
  const ready=async p=>{await p.locator('.admin-workspace h1').waitFor();await p.waitForFunction(()=>!adminState.loading&&!!adminState.data);};
  async function session(user){
    const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
    if(user)await context.addCookies([{name:'synk_company_session',value:fixture.cookieFor(user),url:fixture.base}]);
    const p=await context.newPage();p.setDefaultTimeout(15000);
    p.on('pageerror',error=>report.errors.push(error.message));
    p.on('request',r=>{if(new URL(r.url()).pathname==='/api/admin-workspace')report.requests.push(r.url());});
    await p.addInitScript(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.__copied.push(value)}});});
    if(user){await p.goto(fixture.base+'/?tab=admin');await ready(p);}
    return {page:p,context};
  }
  const closeModal=async p=>p.locator('.modal-close[data-action="close-modal"]').click();
  async function refresh(p){await p.locator('[data-admin-action="refresh"]').click();await ready(p);}
  async function held(p){
    let release,seen,finished;const gate=new Promise(r=>release=r),started=new Promise(r=>seen=r),done=new Promise(r=>finished=r);
    releases.push(release);let captured=false;
    const handler=async route=>{
      if(captured)return route.continue();captured=true;
      try{const response=await route.fetch();seen();await gate;await route.fulfill({response});}catch(error){if(!/closed|aborted|canceled|Invalid InterceptionId/i.test(error.message))throw error;}finally{finished();}
    };
    await p.route('**/api/admin-workspace?*',handler);
    return {started,async release(){release();await done;await p.unroute('**/api/admin-workspace?*',handler);}};
  }
  try{
    fixture=await createAdminBrowserFixture();browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',env:크롬환경()});
    ({page}=await session(fixture.admin));
    await page.locator('.admin-head [data-action="invite"]').click();
    const form=page.locator('[data-form="invite"]');
    await form.locator('[name="name"]').fill('검증 겸임 직원');await form.locator('[name="email"]').fill('new-dual@example.test');
    await form.locator('[name="teamId"]').selectOption('qa-team');await form.locator('[name="role"]').selectOption('member');
    for(const [company,role] of [['SHIFT','instructor'],['PULSE','producer']]){
      await form.locator(`[name="waCompany"][value="${company}"]`).check();await form.locator(`[name="waRole_${company}"]`).selectOption(role);
    }
    await form.locator('[name="waDuty"][value="social"]').check();
    const issuedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/members/invite');
    await form.locator('[type="submit"]').click();const response=await issuedResponse;assert.equal(response.status(),201);const issued=await response.json();
    await page.locator('.invite-result [aria-label="초대 코드"]').waitFor();
    check('administrator issues a real invitation with exact concurrent assignments',issued.code===await page.locator('[aria-label="초대 코드"]').inputValue());
    const copy=page.locator('.invite-result [data-action="copy"]');await copy.nth(0).click();await copy.nth(1).click();
    check('copy controls copy the real link and code',await page.evaluate(result=>__copied.includes(result.inviteUrl)&&__copied.includes(result.code),issued));
    await closeModal(page);await ready(page);await page.locator('[data-admin-tab="invitations"]').click();
    const inviteRow=()=>page.locator('.admin-invites-table tbody tr').filter({hasText:'new-dual@example.test'});
    check('successful issuance is listed without a page reload',await inviteRow().count()===1&&/대기/.test(await inviteRow().textContent()));
    check('the aggregate never exposes raw invitation codes',!await page.evaluate(code=>JSON.stringify(adminState.data).includes(code),issued.code));
    const recipient=await session();await recipient.page.goto(issued.inviteUrl);
    await recipient.page.locator('#wa-invite-summary').waitFor();await recipient.page.waitForFunction(()=>document.querySelector('#wa-invite-summary')?.textContent.includes('SHIFT'));
    await recipient.page.locator('#auth-form [name="name"]').fill('검증 겸임 직원');await recipient.page.locator('#auth-form [name="password"]').fill(fixture.password);
    const joinedResponse=recipient.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/join');await recipient.page.locator('#auth-form [type="submit"]').click();assert.equal((await joinedResponse).status(),201);
    await recipient.page.locator('#ws-tools-toggle').waitFor();const joined=fixture.app.store.all('users').find(row=>row.email==='new-dual@example.test');
    assert.deepEqual(joined.workspaceProfile.memberships,[{company:'SHIFT',role:'instructor'},{company:'PULSE',role:'producer'}]);assert.deepEqual(joined.workspaceProfile.duties,['social']);
    check('accepting the issued link creates exactly the assigned company and duty access');
    await refresh(page);await page.locator('[data-admin-tab="invitations"]').click();
    const link=inviteRow().locator('[data-admin-action="view-accepted-member"]');await link.waitFor();
    check('accepted invite links by the new account ID despite duplicate names',await link.getAttribute('data-id')===joined.id);
    await link.click();await page.locator('#admin-selected-member-name').waitFor();
    check('accepted-employee performance opens the new account, not a namesake',await page.evaluate(id=>adminState.selectedMemberId===id,joined.id));
    await page.locator('.admin-head [data-action="wa-invites"]').click();await page.locator('.wa-invites-list').waitFor();
    const revoke=page.locator(`[data-action="wa-revoke"][data-id="${fixture.pending.id}"]`);await revoke.click();await revoke.waitFor({state:'hidden'});
    const beforeClose=report.requests.length;await closeModal(page);await ready(page);
    check('closing invitation management refreshes the administrator summary',report.requests.length>beforeClose);
    await page.locator('[data-admin-tab="invitations"]').click();
    check('revoked invitation is shown as canceled',/취소/.test(await page.locator('.admin-invites-table tbody tr').filter({hasText:'pending@example.test'}).textContent()));
    const rejected=await fixture.request(null,'/api/join',{token:fixture.pending.code,name:'취소된 합성 초대',password:fixture.password});
    assert.equal(rejected.status,403);assert.match(rejected.data.error,/초대/);assert.equal(fixture.app.store.all('users').filter(row=>row.email==='pending@example.test').length,0);
    check('revoked invitation cannot create an account');
    const beforeInvalid=report.requests.length,range=page.locator('form[data-admin-range]');
    await range.locator('[name="start"]').fill(fixture.end);await range.locator('[name="end"]').fill(fixture.start);await range.locator('[type="submit"]').click();
    check('invalid date order makes no aggregate request',report.requests.length===beforeInvalid&&await page.evaluate(()=>!!adminState.rangeError));
    const delay=await held(page);await page.locator('[data-admin-preset="7"]').click();await delay.started;
    await page.locator('[data-admin-preset="30"]').click();await ready(page);await delay.release();
    check('older date response cannot replace the latest selection',await page.evaluate(start=>adminState.start===start&&adminState.data.start===start,fixture.start));
    let failOnce=true;const unavailable=async route=>{if(failOnce){failOnce=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'검증용 일시적인 집계 오류'})});}else await route.continue();};
    await page.route('**/api/admin-workspace?*',unavailable);await page.locator('[data-admin-preset="7"]').click();await page.locator('[data-admin-action="retry"]').first().waitFor();
    check('a failed refresh removes old performance values and offers retry',await page.evaluate(()=>adminState.data===null)&&await page.locator('.admin-metrics-table').count()===0);
    await page.locator('[data-admin-action="retry"]').first().click();await ready(page);await page.unroute('**/api/admin-workspace?*',unavailable);
    check('retry recovers real aggregate data',await page.evaluate(()=>!!adminState.data&&!adminState.error));
    const late=await held(page);await page.locator('[data-admin-preset="30"]').click();await late.started;
    await page.locator('[data-action="marin-account"]:visible').click();await page.locator('#overlay [data-action="logout"]').click();await page.locator('#auth-form').waitFor();await late.release();
    check('a late aggregate response after logout cannot restore employee data',await page.locator('.admin-workspace').count()===0&&await page.evaluate(()=>!adminState.data&&!state.user));
    for(const [status,change] of [[403,{role:'member'}],[401,{active:false}]]){
      const actor=fixture.app.store.get('users',fixture.otherAdmin.id);fixture.app.store.put('users',actor.id,{...actor,role:'admin',active:true});
      const current=await session(fixture.app.store.get('users',actor.id));page=current.page;
      const invalidate=async route=>{const row=fixture.app.store.get('users',actor.id);fixture.app.store.put('users',row.id,{...row,...change});await route.continue();};
      await page.route('**/api/admin-workspace?*',invalidate,{times:1});const denied=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin-workspace');
      await page.locator('[data-admin-preset="7"]').click();assert.equal((await denied).status(),status);
      await page.waitForFunction(()=>!adminState.data&&document.querySelectorAll('.admin-metrics-table').length===0);
      if(status===401)await page.locator('#auth-form').waitFor();else await page.waitForFunction(()=>state.user?.role==='member');
      check(`${status} clears sensitive aggregates after actual access changes`);
    }
    check('all lifecycle flows finish without runtime exceptions',report.errors.length===0);report.ok=true;
  }catch(error){failure=error;report.ok=false;report.failure=error.stack;if(page)try{await page.screenshot({path:join(output,'failure.png')});report.failureText=await page.locator('body').innerText();}catch{}}
  finally{
    for(const release of releases)release();for(const context of contexts)try{await 닫기(context);}catch(error){failure||=error;}
    if(browser)try{assert.ok(await 닫기(browser,{초:45}),'Browser cleanup must complete');}catch(error){failure||=error;}if(fixture)try{await fixture.close();}catch(error){failure||=error;}
    if(failure){report.ok=false;report.failure||=failure.stack;}
    await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,failure:failure?.message}));if(failure)throw failure;
});
