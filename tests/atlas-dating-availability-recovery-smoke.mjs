// Free browser checks; all identities, lifecycle events and databases are synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { DATING_CHECKPOINT_KEY } from '../experiences/atlas-lab/dating-checkpoint.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const out=fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-availability-recovery/',import.meta.url));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'synk-availability-recovery-'));
const demoOnly=process.argv.includes('--demo-only');
const reproduceDefaultEntry=process.argv.includes('--default-entry-reproduce');
const reproduceBootAuth=process.argv.includes('--boot-auth-reproduce');
const report={at:new Date().toISOString(),status:'running',kind:'synthetic-availability-recovery-browser',actualUsers:0,modelCalls:0,externalApiCost:0,paths:[],errors:[],externalRequests:[],screenshots:[],dialogs:[]};
const START='2026-10-10T03:00:00.000Z';
const A='30000000-0000-4000-8000-000000000001',B='30000000-0000-4000-8000-000000000002';
const TOKEN_A='synthetic-local-account-bearer-a',TOKEN_B='synthetic-local-account-bearer-b',LIFECYCLE='synthetic-local-availability-server-secret-0001';
const fixtures=[];let browser;
const snap=page=>page.evaluate(()=>window.synkDating.snapshot());
const idle=page=>page.waitForFunction(()=>!document.getElementById('content').hasAttribute('aria-busy'));
const poll=page=>page.evaluate(()=>window.synkDating.refreshUpdates());
const marker=page=>page.evaluate(key=>sessionStorage.getItem(key),DATING_CHECKPOINT_KEY);
async function click(page,action,scope=page){await scope.locator(`[data-action="${action}"]`).click();await idle(page);}
async function reveal(locator){if(await locator.evaluate(n=>n.tagName==='DETAILS'&&!n.open))await locator.locator(':scope > summary').click();return locator;}
async function fixture(name,{account=false}={}){
 let port=0,accountConfig;
 if(account){const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  accountConfig={version:1,supabaseUrl:'https://synthetic-identity.example.test',supabasePublishableKey:'sb_publishable_synthetic_fixture',accountApiUrl:'https://synthetic-identity.example.test',portalUrl:'https://synthetic-identity.example.test/id/',clients:{platform:{clientId:'synthetic-dating-browser',redirectUri:`http://127.0.0.1:${port}/atlas-lab/dating.html`}}};}
 const server=createDatingServer({databasePath:path.join(tmp,`${name}.sqlite`),clock:()=>new Date(START),...(account?{mode:'account',accountConfig,verify:async token=>({accountId:token===TOKEN_A?A:token===TOKEN_B?B:null}),lifecycle:{token:LIFECYCLE,issuer:'synk-account',audience:'atlas-dating'}}:{})});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));const f={server,origin:`http://127.0.0.1:${server.address().port}`,accountConfig};fixtures.push(f);return f;
}
async function pageFor(f,role='sample-1',width=390){
 const context=await browser.newContext({viewport:{width,height:950},timezoneId:'Asia/Seoul',serviceWorkers:'block'});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==f.origin){report.externalRequests.push(url.origin);return route.abort();}return route.continue();});
 if(f.accountConfig){const c=f.accountConfig;await context.addInitScript(({c,token})=>{if(!sessionStorage.getItem('synk.oauth.session.dating'))sessionStorage.setItem('synk.oauth.session.dating',JSON.stringify({binding:[c.supabaseUrl,c.accountApiUrl,c.clients.platform.clientId,c.clients.platform.redirectUri].join('|'),session:{access_token:token,refresh_token:'synthetic-not-used-refresh',expires_at:Date.now()+3600000}}));},{c,token:role==='account-b'?TOKEN_B:TOKEN_A});}
 await context.addInitScript(()=>{window.__qaReturnEvents={online:0,offline:0,visibility:0};window.addEventListener('online',()=>window.__qaReturnEvents.online++);window.addEventListener('offline',()=>window.__qaReturnEvents.offline++);document.addEventListener('visibilitychange',()=>window.__qaReturnEvents.visibility++);});
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));
 page.on('dialog',async dialog=>{report.dialogs.push({type:dialog.type(),decision:'accept'});await dialog.accept();});
 await page.goto(`${f.origin}/atlas-lab/dating.html${f.accountConfig||role===null?'':`?demo=${role}`}`);
 if(!f.accountConfig&&role===null){await page.waitForSelector('[data-action="demo"]');await click(page,'demo');}
 await page.waitForFunction(()=>!!window.synkDating?.snapshot().view);await idle(page);return page;
}
async function prepare(page){for(let i=0;i<18;i++){const q=(await snap(page)).view.discovery.question;if(!q||q.optional)break;const values={consent:'true',availability:'weekend','self.pace':'lead','self.plan':'planned'};await click(page,`answer-${values[q.field]||q.options[0].id}`);}assert.equal((await snap(page)).view.discovery.status,'ready');}
async function ownIntro(page,text){await click(page,'nav-settings');const box=page.locator('details').filter({has:page.locator(':scope > summary',{hasText:'내 소개 수정'})});await reveal(box);const input=box.locator('[name="intro"]');await input.fill(text);return input;}
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)),[]);await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});report.screenshots.push(`${name}.png`);}
async function call(f,route,token,body,{lifecycle=false}={}){const response=await fetch(f.origin+'/api/atlas-dating'+route,{method:body?'POST':'GET',headers:{...(!lifecycle?{Origin:f.origin}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();assert.equal(response.status,200,`${route} failed: ${value.error?.code||response.status}`);return value;}
async function act(f,token,action){const current=await call(f,'/state',token);return call(f,'/action',token,{requestId:randomUUID(),expectedRevision:current.view.revision,action});}
async function interruptedProfile(f,page,{after=false,text}={}){
 const input=await ownIntro(page,text);const posts=[];let bearer;
 const handler=async route=>{posts.push(route.request().postDataJSON());bearer=route.request().headers().authorization; if(after){const response=await route.fetch();assert.equal(response.status(),200);await response.body();}return route.abort('connectionreset');};
 await page.route('**/api/atlas-dating/action',handler);await click(page,'save-profile');
 assert.equal((await snap(page)).hasPendingDelivery,true);assert.equal(await input.inputValue(),text);
 const raw=await marker(page);assert.equal(typeof raw,'string');assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['actorId','binding','createdAt','demo','requestId','version']);
 assert.equal(raw.includes(text),false);assert.equal(raw.includes(bearer.replace(/^Bearer /,'')),false);assert.equal(raw.includes('expectedRevision'),false);assert.equal(raw.includes('profile'),false);
 return{posts,handler};
}
async function checkpointPaths(){
 const f=await fixture('checkpoint-applied'),a=await pageFor(f,null);
 assert.equal((await snap(a)).view.accountId,'demo:adult-a');
 await a.locator('[name="nickname"]').fill('기본 입구 가상 성인');await a.locator('[name="region"]').fill('가상 지역');
 for(const name of ['adult','public','invites','save'])await a.locator(`[name="${name}"]`).check();await click(a,'onboard');await prepare(a);
 const {posts,handler}=await interruptedProfile(f,a,{after:true,text:'응답 유실 뒤 원문을 표식에 보관하지 않는 가상 소개'});
 await a.unroute('**/api/atlas-dating/action',handler);let restoredPosts=0,receiptGets=0;a.on('request',r=>{const pathname=new URL(r.url()).pathname;if(r.method()==='POST'&&pathname.endsWith('/action'))restoredPosts++;if(r.method()==='GET'&&pathname.endsWith('/receipt'))receiptGets++;});
 await a.reload();
 try{await a.waitForFunction(()=>window.synkDating?.snapshot().hasPendingDelivery,null,{timeout:5000});}
 catch(error){const failed=await snap(a);report.defaultEntryRecovery={startedThroughDefaultLanding:true,rolePreservedInURL:new URL(a.url()).searchParams.get('demo')==='adult-a',hasView:!!failed.view,hasPendingDelivery:failed.hasPendingDelivery,pendingCheckOnly:failed.pendingCheckOnly,checkpointStillPresent:!!await marker(a),additionalActionPosts:restoredPosts};throw error;}
 await idle(a);
 assert.equal((await snap(a)).pendingCheckOnly,true);assert.equal(await a.locator('[data-action="delivery-retry"]').count(),0);
 assert.equal(await a.locator('[data-action="nav-settings"]').isDisabled(),true);await shot(a,'reload-checks-receipt-without-resending-390');
 await click(a,'delivery-check');assert.equal((await snap(a)).hasPendingDelivery,false);assert.equal(await marker(a),null);assert.equal(restoredPosts,0);assert.equal(posts.length,1);
 assert.equal((await snap(a)).view.profile.intro,'응답 유실 뒤 원문을 표식에 보관하지 않는 가상 소개');
 report.defaultEntryRecovery={startedThroughDefaultLanding:true,rolePreservedInURL:new URL(a.url()).searchParams.get('demo')==='adult-a',actorRetained:(await snap(a)).view.accountId==='demo:adult-a',receiptGets,additionalActionPosts:restoredPosts,checkpointCleared:await marker(a)===null};
 assert.equal(report.defaultEntryRecovery.rolePreservedInURL,true);assert.equal(report.defaultEntryRecovery.actorRetained,true);assert.equal(receiptGets,1);
 report.paths.push('starting from the default landing through the demo button preserves the adult role across reload; an actually committed POST with a lost response restores only a six-field receipt marker without body or credential and performs a GET with no additional action POST');
 await a.context().close();

 const n=await fixture('checkpoint-missing'),b=await pageFor(n);await prepare(b);const pending=await interruptedProfile(n,b,{text:'아직 도착하지 않은 가상 원문'});
 await b.unroute('**/api/atlas-dating/action',pending.handler);let laterPosts=0;b.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.endsWith('/action'))laterPosts++;});
 await b.reload();await b.waitForFunction(()=>window.synkDating?.snapshot().pendingCheckOnly);await idle(b);await click(b,'delivery-check');
 assert.equal((await snap(b)).hasPendingDelivery,true);assert.equal((await snap(b)).pendingCheckOnly,true);assert.match(await b.locator('#notice').innerText(),/처리 중일 수도/);
 assert.equal(await b.locator('[data-action="delivery-retry"]').count(),0);assert.equal(await b.locator('[data-action="nav-settings"]').isDisabled(),true);assert.equal(laterPosts,0);
 await b.setViewportSize({width:320,height:950});await shot(b,'missing-receipt-remains-get-only-320');
 report.paths.push('a never-delivered request restores only GET receipt recovery after reload; a missing receipt remains uncertain, mutations stay locked and no retry body or unsaved certainty is invented');
 await b.goto(`${n.origin}/atlas-lab/dating.html?demo=sample-3`);await b.waitForFunction(()=>window.synkDating?.snapshot().view?.accountId==='demo:sample-3');await idle(b);
 assert.equal((await snap(b)).hasPendingDelivery,false);assert.equal(await marker(b),null);assert.doesNotMatch(await b.locator('body').innerText(),/아직 도착하지 않은 가상 원문/);assert.equal(laterPosts,0);
 report.paths.push('opening another actual demo actor in the same tab clears the previous receipt marker without transferring its pending request or sending an action');await b.context().close();
}
async function unloadPath(){
 const f=await fixture('unsaved-navigation'),a=await pageFor(f);await prepare(a);const input=await ownIntro(a,'떠나기 전 확인할 가상 초안');
 a.removeAllListeners('dialog');const initialURL=a.url();
 const first=a.waitForEvent('dialog');const navigation=a.goto(`${f.origin}/api/atlas-dating/config`).catch(e=>e);
 const dismissed=await first;assert.equal(dismissed.type(),'beforeunload');report.dialogs.push({type:dismissed.type(),decision:'dismiss'});await dismissed.dismiss();await navigation;
 assert.equal(a.url(),initialURL);assert.equal(await input.inputValue(),'떠나기 전 확인할 가상 초안');
 const second=a.waitForEvent('dialog'),departure=a.goto(`${f.origin}/api/atlas-dating/config`);const accepted=await second;assert.equal(accepted.type(),'beforeunload');report.dialogs.push({type:accepted.type(),decision:'accept'});await accepted.accept();await departure;
 assert.equal(new URL(a.url()).pathname,'/api/atlas-dating/config');
 report.paths.push('the real beforeunload dialog lets the person dismiss departure and retain the unsent input, or explicitly accept departure without pretending that the draft was saved');await a.context().close();
}
async function networkPaths(){
 const f=await fixture('network'),a=await pageFor(f),b=await pageFor(f,'sample-3',1280);await prepare(a);
 await click(a,'nav-discover');const candidate=a.locator('[data-candidate="demo:sample-3"]');if(!await candidate.isVisible())await reveal(a.locator('[data-other-candidates]'));
 await click(a,'connect',candidate);await click(b,'nav-inbox');await click(b,'refresh');await click(b,'intro-accept');await click(a,'refresh');
 await ownIntro(a,'네트워크 점검 중 유지할 가상 입력');await click(a,'reload');let input=a.locator('[name="intro"]');await input.focus();
 const before=await snap(a),notice=await a.locator('#notice').innerText(),last=await a.locator('#sync-time').getAttribute('datetime');assert.equal(before.sync.status,'connected');assert.ok(notice);
 const abort=route=>route.abort('connectionreset');await a.route('**/api/atlas-dating/state',abort);await poll(a);
 assert.equal((await snap(a)).sync.status,'offline');assert.equal(await a.locator('#sync-time').getAttribute('datetime'),last);assert.equal(await a.locator('#notice').innerText(),notice);assert.equal(await input.inputValue(),'네트워크 점검 중 유지할 가상 입력');assert.equal(await input.evaluate(n=>n===document.activeElement),true);
 await a.unroute('**/api/atlas-dating/state',abort);await poll(a);assert.equal((await snap(a)).sync.status,'connected');assert.equal((await snap(a)).hasNewResponse,false);
 assert.equal(await a.locator('#notice').innerText(),notice);assert.equal(await input.evaluate(n=>n===document.activeElement),true);assert.equal(await input.inputValue(),'네트워크 점검 중 유지할 가상 입력');
 report.paths.push('a failed state GET changes only connection health and retains the last successful check time, user notice and focused draft; an unchanged successful poll restores connected status without a stale error or response banner');
 await a.context().setOffline(true);await a.waitForFunction(()=>window.synkDating.snapshot().sync.status==='offline');
 await click(b,'nav-settings');await b.locator('[name="public"]').uncheck();await click(b,'consents');
 await a.context().setOffline(false);await a.waitForFunction(()=>window.synkDating.snapshot().view.pairs.at(-1).status==='closed',{timeout:5000});
 assert.ok(await a.evaluate(()=>window.__qaReturnEvents.online)>0);assert.equal((await snap(a)).sync.status,'connected');assert.equal(await a.locator('[name="intro"]').inputValue(),'네트워크 점검 중 유지할 가상 입력');
 assert.equal((await snap(a)).view.candidates.some(c=>c.accountId==='demo:sample-3'),false);
 await shot(a,'connection-restored-preserves-own-input-390');
 report.paths.push('a real browser offline-to-online event invokes the production recovery handler and applies a counterpart public withdrawal while retaining an unrelated own draft');
 // The visible-page event exercises the installed handler, not a mutation hook.
 const oldCount=await a.evaluate(()=>window.__qaReturnEvents.visibility);await a.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await a.waitForFunction(count=>window.__qaReturnEvents.visibility>count,oldCount);
 await a.context().close();await b.context().close();
}
async function accountPaths(){
 const f=await fixture('central',{account:true});
 for(const [token,id,label] of [[TOKEN_A,A,'개인정보마스크확인가상갑'],[TOKEN_B,B,'개인정보마스크확인가상을']]){
  await act(f,token,{kind:'profile',profile:{nickname:label,region:'마스크확인 가상지역',intro:'중앙 보류 전에만 볼 가상 소개',values:{availability:'weekend','self.pace':'lead','self.plan':id===A?'planned':'spontaneous'},required:[]}});
  await act(f,token,{kind:'adult',declared:true});await act(f,token,{kind:'consents',consents:{profilePublic:true,receiveInvitations:true,storePreferences:true}});
  for(const [field,value] of Object.entries({consent:true,availability:'weekend'}))await act(f,token,{kind:'discovery',action:{kind:'set',field,value}});
 }
 const sent=await act(f,TOKEN_A,{kind:'connect',targetAccountId:B}),pairId=sent.result.pairId;let p=(await call(f,'/state',TOKEN_B)).view.pairs.find(p=>p.pairId===pairId);
 await act(f,TOKEN_B,{kind:'introduction',pairId,expectedIntroductionRevision:p.introduction.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'accept'}});
 const a=await pageFor(f,'account-a');await click(a,'nav-profile');const section=a.locator('[data-preference-field="wants.notice"]');await reveal(section);await section.locator('[name="value"]').selectOption('advance');await click(a,'edit-wants.notice',section);assert.equal(await a.locator('[data-preview="pending"]').count(),1);
 await a.route('**/api/atlas-dating/action',route=>route.abort('connectionreset'));await click(a,'preview-apply');assert.equal((await snap(a)).hasPendingDelivery,true);assert.ok(await marker(a));
 const lifecycle=(status,sequence)=>call(f,'/lifecycle',LIFECYCLE,{version:2,type:'account.availability',eventId:randomUUID(),subjectId:A,occurredAt:START,issuer:'synk-account',audience:'atlas-dating',status,sequence},{lifecycle:true});
 await lifecycle('deletion-requested',1);await poll(a);let state=await snap(a);
 assert.equal(state.view.centralAvailability.status,'deletion-requested');assert.equal(state.hasPendingDelivery,false);assert.equal(state.hasNewResponse,false);assert.equal(await marker(a),null);assert.equal(await a.locator('[data-preview="pending"]').count(),0);
  assert.equal(state.view.profile,undefined);assert.deepEqual(state.view.pairs,[]);assert.equal(state.view.discovery,null);assert.equal(await a.locator('#nav').isVisible(),false);
  assert.equal(await a.locator('#notice').innerText(),'계정 이용 상태가 바뀌어 작성 중인 내용과 전송 확인을 정리했어요.');assert.doesNotMatch(await a.locator('#notice').innerText(),/유지/);
 assert.doesNotMatch(await a.locator('body').innerText(),/개인정보마스크확인가상갑|개인정보마스크확인가상을|마스크확인 가상지역|중앙 보류 전에만 볼 가상 소개/);
 await a.setViewportSize({width:320,height:950});await shot(a,'central-hold-masks-private-view-320');
 report.paths.push('an actual version-2 central hold reaches the synthetic account server during preview and uncertain delivery; the production poll masks profile, recommendation and pair data and clears preview, private drafts, pending request and receipt marker');
 await a.unroute('**/api/atlas-dating/action');await lifecycle('active',2);await poll(a);state=await snap(a);
 assert.equal(state.view.centralAvailability.status,'active');assert.equal(state.view.centralAvailability.resumeRequired,true);assert.equal(state.view.consents.profilePublic,false);assert.equal(state.view.consents.receiveInvitations,false);
 p=state.view.pairs.find(p=>p.pairId===pairId);assert.equal(p.status,'closed');assert.equal(p.introduction.accepted,false);
 await click(a,'central-resume-settings');await a.locator('[name="public"]').check();await a.locator('[name="invites"]').check();await click(a,'consents');state=await snap(a);
 assert.equal(state.view.centralAvailability.resumeRequired,false);assert.equal(state.view.consents.profilePublic,true);assert.equal(state.view.consents.receiveInvitations,true);
 p=state.view.pairs.find(p=>p.pairId===pairId);assert.equal(p.status,'closed');assert.equal(p.introduction.accepted,false);assert.equal(p.view,null);
 report.paths.push('a central active event keeps publicity and invitations off and requires an explicit settings choice; resuming those permissions does not revive the former introduction acceptance or closed pair');await a.context().close();
}
async function bootAuthPath(){
 const f=await fixture('boot-auth',{account:true});
 await act(f,TOKEN_A,{kind:'profile',profile:{nickname:'초기로그인확인 가상성인',region:'가상지역',intro:'합성초기자료',values:{availability:'weekend'},required:[]}});
 await act(f,TOKEN_A,{kind:'adult',declared:true});await act(f,TOKEN_A,{kind:'consents',consents:{profilePublic:true,receiveInvitations:true,storePreferences:true}});
 const a=await pageFor(f,'account-a');const interrupted=await interruptedProfile(f,a,{text:'초기인증거절뒤남으면안되는가상원문'});await a.unroute('**/api/atlas-dating/action',interrupted.handler);
 assert.ok(await marker(a));
 await a.route('**/api/atlas-dating/state',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'AUTH_REQUIRED'}})}));
 await a.reload();await a.waitForFunction(()=>!!window.synkDating&&document.getElementById('notice').textContent.includes('SYNK ID'),null,{timeout:5000});await idle(a);
 const state=await snap(a);report.bootAuthRecovery={hasView:!!state.view,hasPendingDelivery:state.hasPendingDelivery,checkpointStillPresent:!!await marker(a),storedCredentialCleared:await a.evaluate(()=>sessionStorage.getItem('synk.oauth.session.dating')===null),originalActionPosts:interrupted.posts.length};
 assert.equal(report.bootAuthRecovery.storedCredentialCleared,true);
 assert.equal(state.view,null);assert.equal(state.hasPendingDelivery,false);assert.equal(await marker(a)===null,true,'initial account authentication loss must remove the previous receipt marker');
 assert.doesNotMatch(await a.locator('body').innerText(),/초기인증거절뒤남으면안되는가상원문/);
 report.paths.push('an account state HTTP 401 during initial boot after reload clears the prior receipt marker and private recovery state as well as the synthetic login session');await a.context().close();
}
try{await fs.mkdir(out,{recursive:true});browser=await chromium.launch({channel:'chrome',headless:true});if(reproduceBootAuth)await bootAuthPath();else{await checkpointPaths();await unloadPath();await networkPaths();if(!demoOnly){await accountPaths();await bootAuthPath();}}assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.status='passed';}
catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,reproduceBootAuth?'boot-auth-before-fix.json':reproduceDefaultEntry?'default-entry-before-fix.json':demoOnly?'demo-result.json':'result.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();for(const f of fixtures)await new Promise(resolve=>f.server.close(resolve));const target=path.resolve(tmp);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert.ok(path.basename(target).startsWith('synk-availability-recovery-'));await fs.rm(target,{recursive:true,force:true});console.log(JSON.stringify(report,null,2));}
