// Free browser checks with injected synthetic credentials and a loopback SQLite service.
// This does not exercise a real identity provider, real login, or physical phones.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const out=fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-account-session/',import.meta.url));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'synk-dating-account-session-'));
const boundaryOnly=process.argv.includes('--logout-boundary');
const ACCOUNT='84000000-0000-4000-8000-000000000001';
const TOKENS=['synthetic-session-one','synthetic-session-two'];
const PRIVATE='로그아웃 경계 합성 비공개 소개',DRAFT='로그아웃 경계 합성 미저장 원문';
const sessionKey='synk.oauth.session.dating';
const report={at:new Date().toISOString(),kind:'synthetic-account-session-browser',status:'running',actualUsers:0,physicalDevices:0,realIdentityProviderCalls:0,modelCalls:0,externalApiCost:0,paths:[],errors:[],externalRequests:[],screenshots:[],logoutObservations:[]};
const fixtures=[];let browser;
const idle=page=>page.waitForFunction(()=>!document.getElementById('content').hasAttribute('aria-busy'));
const snap=page=>page.evaluate(()=>window.synkDating.snapshot());
async function click(page,action){await page.locator(`[data-action="${action}"]`).click();await idle(page);}
async function sourceHashes(){const result={};for(const name of ['dating-account.mjs','dating-ui.mjs','dating-live.mjs','dating-delivery.mjs','dating-server.mjs','dating-service.mjs'])result[name]=createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../experiences/atlas-lab/'+name,import.meta.url)))).digest('hex');return result;}
async function fixture(name){
  const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const accountConfig={version:1,supabaseUrl:'https://synthetic-identity.example.test',supabasePublishableKey:'sb_publishable_synthetic_fixture',accountApiUrl:'https://synthetic-identity.example.test',portalUrl:'https://synthetic-identity.example.test/id/',clients:{platform:{clientId:'synthetic-account-session',redirectUri:`http://127.0.0.1:${port}/atlas-lab/dating.html`}}};
  const revoked=new Set();
  const server=createDatingServer({mode:'account',databasePath:path.join(tmp,name+'.sqlite'),accountConfig,verify:async token=>TOKENS.includes(token)&&!revoked.has(token)?{accountId:ACCOUNT}:null});
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  const f={server,origin:`http://127.0.0.1:${port}`,accountConfig,revoke:index=>revoked.add(TOKENS[index])};fixtures.push(f);
  for(const action of [{kind:'profile',profile:{nickname:'합성 계정',region:'합성 지역',intro:PRIVATE,values:{},required:[]}},{kind:'adult',declared:true},{kind:'consents',consents:{profilePublic:false,receiveInvitations:false,storePreferences:false}}]){
    const current=await call(f,'/state');await call(f,'/action',{requestId:randomUUID(),expectedRevision:current.view.revision,action});
  }
  return f;
}
async function call(f,route,body,index=0){const response=await fetch(f.origin+'/api/atlas-dating'+route,{method:body?'POST':'GET',headers:{Origin:f.origin,Authorization:'Bearer '+TOKENS[index],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result.error));return result;}
async function pageFor(f,index=0,width=390){
  const context=await browser.newContext({viewport:{width,height:950},timezoneId:'Asia/Seoul',serviceWorkers:'block'});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==f.origin){report.externalRequests.push(new URL(route.request().url()).origin);return route.abort();}return route.continue();});
  // Mark injection once per tab so reload after logout cannot manufacture a new login.
  await context.addInitScript(({config,token,key})=>{if(sessionStorage.getItem('synthetic.session.fixture.injected'))return;sessionStorage.setItem('synthetic.session.fixture.injected','true');sessionStorage.setItem(key,JSON.stringify({binding:[config.supabaseUrl,config.accountApiUrl,config.clients.platform.clientId,config.clients.platform.redirectUri].join('|'),session:{access_token:token,refresh_token:'synthetic-unused-refresh',expires_at:Date.now()+3600000}}));},{config:f.accountConfig,token:TOKENS[index],key:sessionKey});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>report.errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(f.origin+'/atlas-lab/dating.html');await page.waitForFunction(()=>!!window.synkDating?.snapshot().view);await idle(page);return page;
}
async function draft(page){
  await click(page,'nav-settings');const input=page.locator('[name="intro"]');
  for(const box of await input.locator('xpath=ancestor::details').all())if(!await box.evaluate(n=>n.open))await box.locator(':scope > summary').click();
  await input.fill(DRAFT);return input;
}
async function loggedOutState(page){return page.evaluate(({privateText,draftText,key})=>({viewCleared:window.synkDating.snapshot().view===null,credentialCleared:sessionStorage.getItem(key)===null,privateTextInDOM:document.body.textContent.includes(privateText),draftInDOM:[...document.querySelectorAll('input,textarea')].some(node=>node.value.includes(draftText)),privateControls:document.querySelectorAll('[data-editing-scope],[data-onboarding-form],[data-schedule-form]').length,signInVisible:!!document.querySelector('[data-action="signin"]'),navigationHidden:document.getElementById('nav').hidden}),{privateText:PRIVATE,draftText:DRAFT,key:sessionKey});}
function assertCleared(state){assert.deepEqual(state,{viewCleared:true,credentialCleared:true,privateTextInDOM:false,draftInDOM:false,privateControls:0,signInVisible:true,navigationHidden:true});}
async function screenshot(page,name){await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');}
async function holdLogout(page,f,{fail=false}={}){
  let entered,release;const ready=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  const handler=async route=>{assert.equal(route.request().method(),'POST');assert.equal(new URL(route.request().url()).searchParams.get('scope'),'local');entered();await gate;if(fail)return route.abort('connectionreset');return route.fulfill({status:200,contentType:'application/json',body:'{}'});};
  await page.route(f.accountConfig.supabaseUrl+'/auth/v1/logout?scope=local',handler);
  return{ready,release};
}
async function delayedLogout(){
  const f=await fixture('delayed-logout'),a=await pageFor(f),b=await pageFor(f,1,320);await draft(a);
  const held=await holdLogout(a,f);await a.locator('[data-action="signout"]').click();await held.ready;
  const during=await loggedOutState(a);report.logoutObservations.push({case:'delayed-success',phase:'remote-response-pending',...during});
  await screenshot(a,'delayed-logout-private-dom-boundary-390');held.release();await idle(a);
  // Assert after releasing the synthetic route so a failing pre-fix run also cleans up.
  assertCleared(during);assertCleared(await loggedOutState(a));
  await b.evaluate(()=>window.synkDating.refreshUpdates());assert.equal((await snap(b)).view.accountId,ACCOUNT);assert.equal(await b.evaluate(key=>!!sessionStorage.getItem(key),sessionKey),true);
  await a.reload();await a.waitForSelector('[data-action="signin"]');assertCleared(await loggedOutState(a));
  report.paths.push('local logout clears private DOM, draft controls, navigation and stored credentials before a delayed synthetic identity response; the second isolated session of the same synthetic account remains usable, and reload cannot recreate the logged-out session');
  await a.context().close();await b.context().close();
}
async function failedLogout(){
  const f=await fixture('failed-logout'),a=await pageFor(f,0,320);await draft(a);const held=await holdLogout(a,f,{fail:true});
  await a.locator('[data-action="signout"]').click();await held.ready;const during=await loggedOutState(a);report.logoutObservations.push({case:'network-failure',phase:'remote-response-pending',...during});held.release();await idle(a);assertCleared(during);assertCleared(await loggedOutState(a));
  assert.match(await a.locator('#content').innerText(),/이 화면에서 로그아웃했어요.*서버의 로그인 종료는 다시 확인/);await screenshot(a,'logout-provider-unreachable-local-cleared-320');
  report.paths.push('a synthetic identity logout network failure keeps the page locally signed out and presents the server-termination limitation without restoring the former private view');await a.context().close();
}
async function lateState(){
  const f=await fixture('late-state'),a=await pageFor(f);await draft(a);
  let entered,release;const ready=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  await a.route('**/api/atlas-dating/state',async route=>{const response=await route.fetch();entered();await gate;await route.fulfill({response});});
  const pending=a.evaluate(()=>window.synkDating.refreshUpdates());await ready;
  const held=await holdLogout(a,f);await a.locator('[data-action="signout"]').click();await held.ready;held.release();await idle(a);assertCleared(await loggedOutState(a));
  release();await pending;assertCleared(await loggedOutState(a));
  report.paths.push('an authorized state response captured before logout and delivered afterward cannot restore the former private view or credentials');await a.context().close();
}
async function offlineThenRevoked(){
  const f=await fixture('offline-revoked'),a=await pageFor(f),b=await pageFor(f,1,320);const input=await draft(a);
  await a.context().setOffline(true);await a.waitForFunction(()=>window.synkDating.snapshot().sync.status==='offline');await a.evaluate(()=>window.synkDating.refreshUpdates());
  assert.equal((await snap(a)).view.accountId,ACCOUNT);assert.equal(await input.inputValue(),DRAFT);assert.equal(await a.evaluate(key=>!!sessionStorage.getItem(key),sessionKey),true);
  f.revoke(0);await b.evaluate(()=>window.synkDating.refreshUpdates());assert.equal((await snap(b)).view.accountId,ACCOUNT);
  await a.context().setOffline(false);await a.waitForFunction(()=>window.synkDating.snapshot().view===null);assertCleared(await loggedOutState(a));assert.equal((await snap(a)).sync.status,'unavailable');
  await screenshot(a,'offline-return-revoked-clears-private-view-390');
  report.paths.push('ordinary browser offline failure preserves the current synthetic session and own draft; the real online event then receives local-service HTTP 401 for only the revoked token and clears the private DOM, while the other isolated session remains authorized');await a.context().close();await b.context().close();
}
try{
  await fs.mkdir(out,{recursive:true});report.sourcesBefore=await sourceHashes();browser=await chromium.launch({channel:'chrome',headless:true});
  await delayedLogout();if(!boundaryOnly){await failedLogout();await lateState();await offlineThenRevoked();}
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1;}
finally{
  report.sourcesAfter=await sourceHashes();await browser?.close();for(const f of fixtures){f.server.closeAllConnections();await new Promise(resolve=>f.server.close(resolve));}
  const resolved=path.resolve(tmp);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('synk-dating-account-session-'));await fs.rm(resolved,{recursive:true,force:true});
  await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,boundaryOnly?'logout-boundary-result.json':'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
