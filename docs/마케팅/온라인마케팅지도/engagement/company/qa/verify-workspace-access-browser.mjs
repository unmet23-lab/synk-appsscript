// Disposable company SQLite and synthetic employees only; no invitations are sent.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createServer} from 'node:net';
import {createCompanyApp} from '../server.mjs';
import {크롬환경} from '../../../../../../tools/lib/크롬조종.js';
import {launchOwnedBrowser,closeOwnedBrowser} from './owned-browser.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {화면시험}=require('../../../../../../tools/lib/화면시험.cjs');
await 화면시험({분:12},async()=>{
const directory=await mkdtemp(join(tmpdir(),'synk-workspace-access-ui-'));
const output=resolve(process.env.WORKSPACE_ACCESS_QA_OUT||'.tmp/workspace-access-browser');
const probe=createServer();await new Promise(done=>probe.listen(0,'127.0.0.1',done));
const port=probe.address().port;await new Promise(done=>probe.close(done));
const app=createCompanyApp({dataDir:directory,port,allowTestHost:true,schedule:false,webPushEnabled:false});
const report={synthetic:true,production:false,checks:[],errors:[],consoleErrors:[],assets:[],shots:[]};
const password='workspace-access-browser-only';
const common=['home','messenger','members'],primary=['home','messenger','workroom','social','members','teaching','path','lectures'];
const cases=[
  ['lab',[['LAB','teacher']],[],[...common,'teaching']],
  ['labops',[['LAB','operations']],[],common],
  ['path',[['PATH','counselor']],[],[...common,'path']],
  ['shift',[['SHIFT','instructor']],[],[...common,'lectures']],
  ['shiftauto',[['SHIFT','automation']],[],common],
  ['pulse',[['PULSE','producer']],[],[...common,'workroom']],
  ['pages',[['PATH','counselor']],['pages'],[...common,'workroom','path']],
  ['dual',[['SHIFT','instructor'],['PULSE','producer']],['pages'],[...common,'workroom','lectures']],
  ['social',[],['social'],[...common,'workroom','social']],
  ['common',[],[],common],
  ['viewer',[['SHIFT','instructor']],[],[...common,'lectures']],
];
let browser,base,originalFailure;
const releases=[];
const consoleMessages=[],issuedCodes=[],invitePosts=[];
let expectedAbortedInvite=false;
const check=(name,condition=true)=>{assert.ok(condition,name);report.checks.push(name);};
async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timed out: '+label)),15000);})]);}finally{clearTimeout(timer);}}
async function session(user,viewport={width:1440,height:900}){
  const context=await browser.newContext({viewport,locale:'tr-TR'});
  if(user)await context.addCookies([{name:'synk_company_session',value:app.store.mint('session',user.id,{csrfToken:'synthetic-access-csrf'},30),url:base}]);
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{
    consoleMessages.push(message.text());
    if(message.type()==='error'&&!(expectedAbortedInvite&&message.location().url.endsWith('/api/members/invite')&&/net::ERR_(FAILED|ABORTED)/.test(message.text())))report.consoleErrors.push(message.text());
  });
  page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/members/invite'))invitePosts.push(request.postDataJSON()?.email);});
  page.on('response',response=>{if(response.status()>=400&&['image','font','script','stylesheet'].includes(response.request().resourceType()))report.assets.push({path:new URL(response.url()).pathname,status:response.status()});});
  return {context,page};
}
async function openTools(page){await page.locator('#ws-tools-toggle').click();await page.locator('#ws-tools-drawer').waitFor({state:'visible'});}
async function visibleTabs(page){
  await openTools(page);
  const tabs=await page.locator('#ws-tools-drawer [data-tab]').evaluateAll((nodes,primary)=>[...new Set(nodes.filter(node=>node.getClientRects().length).map(node=>node.dataset.tab).filter(tab=>primary.includes(tab)))].sort(),primary);
  await page.keyboard.press('Escape');await page.locator('#ws-tools-drawer').waitFor({state:'hidden'});return tabs;
}
async function navigate(page,tab){await openTools(page);await page.locator('#ws-tools-drawer [data-tab="'+tab+'"]').first().click();}
async function shot(page,name){await page.screenshot({path:join(output,name),fullPage:true});report.shots.push(name);}
async function fillInvite(page,name,email){
  await page.locator('#main [data-action="invite"]').first().click();
  const form=page.locator('[data-form="invite"]');
  await form.locator('[name="name"]').fill(name);await form.locator('[name="email"]').fill(email);
  await form.locator('[name="role"]').selectOption('member');
  await form.locator('[name="waCompany"][value="SHIFT"]').check();await form.locator('[name="waRole_SHIFT"]').selectOption('instructor');
  await form.locator('[name="waCompany"][value="PULSE"]').check();await form.locator('[name="waRole_PULSE"]').selectOption('producer');
  await form.locator('[name="waDuty"][value="pages"]').check();return form;
}
async function heldInvite(page,name,email,{abort=false}={}){
  let received,release,finished,result,count=0;
  const seen=new Promise(done=>{received=done;}),hold=new Promise(done=>{release=done;}),done=new Promise(resolve=>{finished=resolve;});releases.push(release);
  const handler=async route=>{
    count++;const response=await route.fetch();assert.equal(response.status(),201);result=await response.json();issuedCodes.push(result.code);received();await hold;
    try{if(abort)await route.abort('failed');else await route.fulfill({response});}finally{finished();}
  };
  await page.route('**/api/members/invite',handler);
  const form=await fillInvite(page,name,email);await form.locator('[type="submit"]').click();await bounded(seen,'held invitation');
  return {result,count:()=>count,async release(){release();await bounded(done,'forward held invitation');await page.unroute('**/api/members/invite',handler);}};
}
async function dismissModal(page){await page.locator('.modal-close[data-action="close-modal"]').click();}
async function openInvites(page){await page.locator('#main [data-action="wa-invites"]').first().click();await page.locator('.wa-invites-list').waitFor();}
async function logout(page){await page.locator('[data-action="marin-account"]:visible').click();await page.locator('#overlay [data-action="logout"]').click();await page.locator('#auth-form').waitFor();}
async function login(page,user){
  await page.locator('#auth-form [name="email"]').fill(user.email);await page.locator('#auth-form [name="password"]').fill(password);
  await page.locator('#auth-form [type="submit"]').click();await page.locator('#next-heading').waitFor();
  await navigate(page,'members');await page.locator('.organization-page').waitFor();
}
try{
  await mkdir(output,{recursive:true});
  const admin=app.store.createUser({email:'admin@example.test',name:'합성 관리자',role:'admin',password});
  const secondAdmin=app.store.createUser({email:'second-admin@example.test',name:'합성 다른 관리자',role:'admin',password});
  const people=cases.map(([key,memberships,duties,tabs])=>{
    const user=app.store.createUser({email:key+'@example.test',name:'합성 '+key,role:key==='viewer'?'viewer':'member',password});
    app.store.put('users',user.id,{...user,workspaceProfile:{version:1,revision:1,memberships:memberships.map(([company,role])=>({company,role})),duties}});
    return {key,user,tabs};
  });
  const address=await app.start();base=`http://127.0.0.1:${address.port}`;
  browser=await launchOwnedBrowser(chromium,{headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',env:크롬환경()});
  // Bare entry opens the sole assigned company; explicit query/hash navigation stays intact.
  for(const [key,expectedTab,expectedSection] of [['path','path',''],['shift','lectures',''],['pulse','workroom','clients'],['dual','home',''],['common','home','']]){
    const {context,page}=await session(people.find(row=>row.key===key).user);
    await page.goto(base+'/');await page.locator('.synk-workspace[data-view="'+expectedTab+'"]').waitFor();
    check(key+' bare entry opens the assigned workspace',await page.locator('.synk-workspace').getAttribute('data-view')===expectedTab);
    if(expectedSection)check(key+' starts with customer assignments',await page.evaluate(()=>wr.view)===expectedSection);
    await page.locator('.ws-brand[data-tab="home"]').click();await page.locator('#next-heading').waitFor();
    check(key+' explicit return stays on the assignment board',await page.locator('.synk-workspace').getAttribute('data-view')==='home');
    await context.close();
  }
  {
    const {context,page}=await session(people.find(row=>row.key==='shift').user);
    for(const suffix of ['?tab=home','?connected=1','?connectionError=qa','?teachingConnected=1','?teachingError=qa','?panel=tasks','#view=home','#unknown=qa']){
      await page.goto(base+'/'+suffix);await page.locator('#next-heading').waitFor();
      check('explicit entry is preserved: '+suffix,await page.locator('.synk-workspace').getAttribute('data-view')==='home');
    }
    await context.close();
  }
  for(const {key,user,tabs} of people){
    const {context,page}=await session(user);await page.goto(base+'/?tab=home');await page.locator('#next-heading').waitFor();
    assert.deepEqual(await visibleTabs(page),[...tabs].sort());check(key+' exact company and duty navigation');
    for(const [company,tab] of [['PATH','path'],['SHIFT','lectures']]){
      const response=await context.request.get(base+'/api/company-work/'+company);
      assert.equal(response.status(),tabs.includes(tab)?200:403,key+' '+company+' API boundary');
    }
    await page.setViewportSize({width:390,height:844});
    check(key+' supplemental navigation stays in tools instead of a permanent bottom bar',await page.locator('.workspace-mobile-bar').count()===0);
    check(key+' mobile home has no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await openTools(page);
    assert.deepEqual(await page.locator('#ws-tools-drawer [data-tab]').evaluateAll((nodes,primary)=>[...new Set(nodes.filter(node=>node.getClientRects().length).map(node=>node.dataset.tab).filter(tab=>primary.includes(tab)))].sort(),primary),[...tabs].sort());
    check(key+' mobile drawer retains exactly authorized tabs');
    check(key+' drawer exposes no background interaction',await page.evaluate(()=>document.querySelector('#main').inert&&document.querySelector('#ws-tools-drawer').contains(document.activeElement)));
    await page.evaluate(()=>{const nodes=[...document.querySelectorAll('#ws-tools-drawer a[href],#ws-tools-drawer button:not(:disabled),#ws-tools-drawer select:not(:disabled)')].filter(node=>node.getClientRects().length);nodes.at(-1).focus();});
    await page.keyboard.press('Tab');
    check(key+' Tab wraps inside the drawer',await page.evaluate(()=>document.activeElement===[...document.querySelectorAll('#ws-tools-drawer a[href],#ws-tools-drawer button:not(:disabled),#ws-tools-drawer select:not(:disabled)')].find(node=>node.getClientRects().length)));
    await page.keyboard.press('Shift+Tab');
    check(key+' reverse Tab stays inside the drawer',await page.evaluate(()=>document.activeElement===[...document.querySelectorAll('#ws-tools-drawer a[href],#ws-tools-drawer button:not(:disabled),#ws-tools-drawer select:not(:disabled)')].filter(node=>node.getClientRects().length).at(-1)));
    await page.keyboard.press('Escape');
    await page.locator('#ws-tools-drawer').waitFor({state:'hidden'});
    check(key+' Escape restores trigger focus',await page.locator('#ws-tools-toggle').evaluate(node=>node===document.activeElement));
    if(key==='dual'||key==='common')await shot(page,key+'-390.png');
    if(key==='viewer'){
      await page.goto(base+'/?tab=lectures');await page.locator('.wa-work').waitFor();
      check('viewer cannot open a lecture mutation form',await page.locator('[data-action="wa-work-edit"]').count()===0);
    }
    await context.close();
  }
  const adminSession=await session(admin),adminPage=adminSession.page;
  await adminPage.goto(base+'/?tab=members');await adminPage.locator('.organization-page').waitFor();
  await adminPage.locator('[data-org-filter="query"]').fill('shift');
  check('Turkish locale still finds ASCII SHIFT memberships',await adminPage.locator('.org-table tbody tr').count()===4);
  const group=adminPage.getByRole('group',{name:'소속 회사로 직원 찾기'});check('company card group has an accessible name',await group.count()===1);
  await adminPage.locator('[data-org-filter="query"]').fill('');
  const invite=await fillInvite(adminPage,'합성 새 겸임 직원','invited@example.test');
  const inviteReply=adminPage.waitForResponse(response=>response.url().endsWith('/api/members/invite')&&response.request().method()==='POST');
  await invite.locator('[type="submit"]').click();const issued=await inviteReply;assert.equal(issued.status(),201);const invitation=await issued.json();issuedCodes.push(invitation.code);
  await adminPage.locator('.invite-result').waitFor();assert.equal(await adminPage.locator('[aria-label="초대 코드"]').inputValue(),invitation.code);
  await adminPage.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__qaClipboard=text;}}}));
  await adminPage.locator('[aria-label="초대 코드"]').locator('..').locator('button').click();
  check('normal invitation copy uses the exact issued code',await adminPage.evaluate(()=>window.__qaClipboard)===invitation.code);
  check('administrator issues a code with exact SHIFT and PULSE roles and pages duty');await shot(adminPage,'invitation-issued-1440.png');
  const joined=await session(null,{width:390,height:844});await joined.page.goto(base+'/');
  await joined.page.locator('.wa-code-entry summary').click();await joined.page.locator('[data-form="wa-code"] [name="code"]').fill(invitation.code);
  await joined.page.locator('[data-form="wa-code"] [type="submit"]').click();await joined.page.locator('#wa-invite-summary').waitFor();
  check('code acceptance shows assigned companies',/SHIFT/.test(await joined.page.locator('#wa-invite-summary').textContent())&&/PULSE/.test(await joined.page.locator('#wa-invite-summary').textContent()));
  check('invite recipient has no role or company editor',await joined.page.locator('[name="waCompany"],[name="role"]').count()===0);
  await joined.page.locator('#auth-form [name="name"]').fill('합성 새 겸임 직원');await joined.page.locator('#auth-form [name="password"]').fill(password);
  await shot(joined.page,'invitation-accept-390.png');await joined.page.locator('#auth-form [type="submit"]').click();await joined.page.locator('#next-heading').waitFor();
  assert.deepEqual(await visibleTabs(joined.page),['home','lectures','members','messenger','workroom']);
  const me=await (await joined.context.request.get(base+'/api/me')).json();
  assert.deepEqual(me.user.workspaceAccess.memberships,[{company:'SHIFT',role:'instructor'},{company:'PULSE',role:'producer'}]);assert.deepEqual(me.user.workspaceAccess.duties,['pages']);
  check('accepted invitation applies exact roles and duties without granting SNS');
  await joined.page.goto(base+'/?tab=lectures');await joined.page.locator('.wa-work').waitFor();
  await joined.page.locator('[data-action="wa-work-edit"]').first().click();await joined.page.locator('[data-form="wa-work"] [name="title"]').fill('합성 강의 준비');
  await joined.page.locator('[data-form="wa-work"] [type="submit"]').click();await joined.page.locator('.wa-work-item h2').filter({hasText:'합성 강의 준비'}).waitFor();
  check('SHIFT uses lecture terminology and saves a canonical work record');await shot(joined.page,'lecture-saved-390.png');
  await dismissModal(adminPage);
  const delayed=await heldInvite(adminPage,'합성 지연 초대','delayed@example.test');
  await dismissModal(adminPage);await fillInvite(adminPage,'새 입력 초안','draft@example.test');
  const refresh=adminPage.waitForResponse(response=>response.url().endsWith('/api/state'));await delayed.release();await bounded(refresh,'state after delayed invite');await adminPage.waitForTimeout(100);
  check('late invitation response cannot replace a newer invitation draft',await adminPage.locator('[data-form="invite"] [name="name"]').count()===1&&await adminPage.locator('[data-form="invite"] [name="name"]').inputValue()==='새 입력 초안');
  check('detached success directs the same administrator to invite management',/초대 관리/.test(await adminPage.locator('#toast').textContent()));
  await dismissModal(adminPage);await openInvites(adminPage);
  const recovered=adminPage.locator('[aria-label="초대 코드"]');await recovered.waitFor();
  check('one-time recovery shows the exact delayed result',await recovered.inputValue()===delayed.result.code);
  const managed=await (await adminSession.context.request.get(base+'/api/workspace-invites')).json();
  check('recovery corresponds to one actual pending invitation',managed.invites.filter(row=>row.id===delayed.result.id&&row.email==='delayed@example.test'&&row.status==='pending').length===1&&delayed.count()===1);
  check('server invitation list never exposes raw codes',!JSON.stringify(managed).includes(delayed.result.code));
  await dismissModal(adminPage);await openInvites(adminPage);
  check('reopening invite management cannot replay a recovered code',await adminPage.locator('[aria-label="초대 코드"]').count()===0&&!await adminPage.evaluate(code=>document.documentElement.outerHTML.includes(code),delayed.result.code));
  await dismissModal(adminPage);
  const closed=await heldInvite(adminPage,'합성 닫힌 초대','closed@example.test');await dismissModal(adminPage);await closed.release();
  await adminPage.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('합성 닫힌 초대'));
  check('successful issuance after a closed modal does not show an exception',!/TypeError|null|innerHTML/.test(await adminPage.locator('#toast').textContent()));
  await openInvites(adminPage);assert.equal(await adminPage.locator('[aria-label="초대 코드"]').inputValue(),closed.result.code);await dismissModal(adminPage);
  const cached=await heldInvite(adminPage,'합성 미확인 결과','cached@example.test');await dismissModal(adminPage);await cached.release();
  await adminPage.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('합성 미확인 결과'));
  await logout(adminPage);await login(adminPage,admin);await openInvites(adminPage);
  check('logging in again cannot recover an earlier session memory result',await adminPage.locator('[aria-label="초대 코드"]').count()===0&&!await adminPage.evaluate(code=>document.documentElement.outerHTML.includes(code),cached.result.code));
  await dismissModal(adminPage);
  for(const [label,nextUser] of [['logout',null],['same-account',admin],['different-account',secondAdmin]]){
    const current=await heldInvite(adminPage,'합성 세션 변경 '+label,label+'@example.test');await dismissModal(adminPage);await logout(adminPage);
    if(nextUser)await login(adminPage,nextUser);
    await current.release();await adminPage.waitForTimeout(150);
    check(label+' cannot display the previous generation code',!await adminPage.evaluate(code=>document.documentElement.outerHTML.includes(code),current.result.code));
    check(label+' cannot announce previous-generation issuance',!await adminPage.locator('#toast').textContent().then(value=>value.includes('합성 세션 변경 '+label)));
    if(!nextUser)await login(adminPage,admin);
    await openInvites(adminPage);
    check(label+' leaves no recoverable raw invitation',await adminPage.locator('[aria-label="초대 코드"]').count()===0);
    await dismissModal(adminPage);
    if(nextUser===secondAdmin){await logout(adminPage);await login(adminPage,admin);}
  }
  const uncertain=await heldInvite(adminPage,'합성 응답 유실','network@example.test',{abort:true});expectedAbortedInvite=true;await uncertain.release();
  await adminPage.waitForFunction(()=>[document.querySelector('[data-form="invite"] .form-error')?.textContent,document.querySelector('#toast')?.textContent].some(value=>value?.includes('초대 관리')));
  await adminPage.waitForTimeout(300);expectedAbortedInvite=false;
  const afterNetwork=await (await adminSession.context.request.get(base+'/api/workspace-invites')).json();
  check('a lost response is not automatically issued again',uncertain.count()===1&&invitePosts.filter(email=>email==='network@example.test').length===1&&afterNetwork.invites.filter(row=>row.email==='network@example.test'&&row.status==='pending').length===1);
  const persisted=await adminPage.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));
  check('issued raw codes stay out of browser persistence and console logs',issuedCodes.every(code=>!persisted.includes(code)&&!consoleMessages.some(message=>message.includes(code))));
  await adminSession.context.close();await joined.context.close();
  check('no browser runtime, console or asset failures',report.errors.length===0&&report.consoleErrors.length===0&&report.assets.length===0);
}catch(error){originalFailure=error;report.failure={message:error.message};throw error;}
finally{
  for(const release of releases)release();
  const errors=[];
  try{if(browser)report.browserCleanup=await closeOwnedBrowser(browser);}catch(error){errors.push(error);}
  try{await app.stop();}catch(error){errors.push(error);}
  try{const absolute=resolve(directory);assert.ok(absolute.startsWith(resolve(tmpdir())+sep+'synk-workspace-access-ui-'));await rm(absolute,{recursive:true,force:true});}catch(error){errors.push(error);}
  if(errors.length)report.cleanupErrors=errors.map(error=>error.message);
  try{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}catch(error){errors.push(error);}
  if(errors.length){if(!originalFailure)throw new AggregateError(errors,'Workspace browser cleanup failed');console.error(JSON.stringify({cleanupErrors:errors.map(error=>error.message)}));}
}
console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,output}));
});
