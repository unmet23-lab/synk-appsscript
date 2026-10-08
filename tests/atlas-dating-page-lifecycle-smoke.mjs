// Free synthetic SQLite/browser lifecycle checks. Never contacts an identity provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { DATING_CHECKPOINT_KEY } from '../experiences/atlas-lab/dating-checkpoint.mjs';
import { captureDatingDatabase } from './lib/dating-sqlite-faults.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const out=fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-page-lifecycle/',import.meta.url));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'synk-dating-page-lifecycle-'));
const ACCOUNT='95000000-0000-4000-8000-000000000001',TOKEN='synthetic-page-lifecycle-token';
const SESSION='synk.oauth.session.dating',DRAFT='다시 돌아와 이어 쓸 합성 소개';
const report={at:new Date().toISOString(),status:'running',kind:'synthetic-page-lifecycle-browser',actualUsers:0,physicalDevices:0,realIdentityProviderCalls:0,modelCalls:0,externalApiCost:0,paths:[],navigation:[],screenshots:[],errors:[],externalRequests:[]};
const fixtures=[];let browser,away;
const snap=page=>page.evaluate(()=>window.synkDating.snapshot());
const idle=page=>page.waitForFunction(()=>!document.getElementById('content').hasAttribute('aria-busy'));
const marker=page=>page.evaluate(key=>sessionStorage.getItem(key),DATING_CHECKPOINT_KEY);
async function click(page,action){await page.locator(`[data-action="${action}"]`).click();await idle(page);}
async function hashes(){const result={};for(const name of ['dating-ui.mjs','dating-account.mjs','dating-delivery.mjs','dating-checkpoint.mjs','dating-server.mjs','dating-service.mjs'])result[name]=createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../experiences/atlas-lab/'+name,import.meta.url)))).digest('hex');return result;}
async function call(f,route,body){const response=await fetch(f.origin+'/api/atlas-dating'+route,{method:body?'POST':'GET',headers:{Origin:f.origin,Authorization:'Bearer '+TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value.error));return value;}
async function fixture(name,width,{start=true}={}){
 const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const config={version:1,supabaseUrl:'https://synthetic-identity.example.test',supabasePublishableKey:'sb_publishable_synthetic_fixture',accountApiUrl:'https://synthetic-identity.example.test',portalUrl:'https://synthetic-identity.example.test/id/',clients:{platform:{clientId:'synthetic-page-lifecycle',redirectUri:`http://127.0.0.1:${port}/atlas-lab/dating.html`}}};
 let revoked=false;
 const captured=captureDatingDatabase(()=>createDatingServer({mode:'account',databasePath:path.join(tmp,name+'.sqlite'),accountConfig:config,verify:async token=>token===TOKEN&&!revoked?{accountId:ACCOUNT}:null}));
 const server=captured.value;await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 const f={server,db:captured.database,origin:`http://127.0.0.1:${port}`,config,requests:[],revoke:()=>{revoked=true;}};fixtures.push(f);
 for(const action of [{kind:'profile',profile:{nickname:'합성 계정',region:'합성 지역',intro:'저장된 합성 소개',values:{},required:[]}},{kind:'adult',declared:true},{kind:'consents',consents:{profilePublic:false,receiveInvitations:false,storePreferences:false}}]){const current=await call(f,'/state');await call(f,'/action',{requestId:randomUUID(),expectedRevision:current.view.revision,action});}
 const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Seoul',serviceWorkers:'block'});
 // No network routing: intercepted requests can prevent native back/forward caching.
 await context.addInitScript(({config,token,key})=>{
  if(!sessionStorage.getItem('synthetic.lifecycle.injected')){sessionStorage.setItem('synthetic.lifecycle.injected','true');sessionStorage.setItem(key,JSON.stringify({binding:[config.supabaseUrl,config.accountApiUrl,config.clients.platform.clientId,config.clients.platform.redirectUri].join('|'),session:{access_token:token,refresh_token:'synthetic-unused-refresh',expires_at:Date.now()+3600000}}));}
  window.__qaLifecycleInstance=crypto.randomUUID();window.__qaLifecycle=[];
  const intervals=new Set(),set=window.setInterval,clear=window.clearInterval;window.__qaPollingIntervals=intervals;
  window.setInterval=function(fn,delay,...args){const id=Reflect.apply(set,window,[fn,delay,...args]);if(delay===12000)intervals.add(id);return id;};
  window.clearInterval=function(id){intervals.delete(id);return Reflect.apply(clear,window,[id]);};
  for(const name of ['pagehide','pageshow'])window.addEventListener(name,event=>window.__qaLifecycle.push({name,persisted:event.persisted,trusted:event.isTrusted}));
 },{config,token:TOKEN,key:SESSION});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.accept());page.on('pageerror',error=>report.errors.push(error.message));
 page.on('request',request=>{const url=new URL(request.url());if(![f.origin,away.origin].includes(url.origin))report.externalRequests.push(url.origin);if(url.origin===f.origin&&url.pathname.startsWith('/api/atlas-dating/'))f.requests.push({method:request.method(),path:url.pathname,body:request.method()==='POST'?request.postDataJSON():null});});
 f.page=page;f.context=context;if(!start)return f;
 await page.goto(f.origin+'/atlas-lab/dating.html');await page.waitForFunction(()=>!!window.synkDating?.snapshot().view);await idle(page);
 await click(page,'nav-settings');await page.locator('[data-profile-editor] > summary').click();await page.locator('[name="intro"]').fill(DRAFT);return f;
}
const count=(f,method,route)=>f.requests.filter(request=>request.method===method&&request.path==='/api/atlas-dating'+route).length;
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');}
async function persistedRoundTrip(f,label,{fallback=true}={}){
 const page=f.page,before=await page.evaluate(()=>window.__qaLifecycleInstance);
 await page.goto(away.origin+'/');await page.goBack({waitUntil:'commit'});await page.waitForFunction(()=>!!window.synkDating?.snapshot().view);await idle(page);
 const native=await page.evaluate(before=>({sameInstance:window.__qaLifecycleInstance===before,events:window.__qaLifecycle,native:window.__qaLifecycleInstance===before&&window.__qaLifecycle.some(event=>event.name==='pageshow'&&event.persisted&&event.trusted)}),before);
 report.navigation.push({scenario:label,...native});
 if(!native.native&&fallback){
  // Explicitly tagged lifecycle-handler fallback; this is not native BFCache proof.
  await click(page,'nav-settings');await page.locator('[data-profile-editor] > summary').click();await page.locator('[name="intro"]').fill(DRAFT);
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  report.navigation.at(-1).fallback='synthetic persisted PageTransitionEvent after actual browser navigation';
 }
 return native.native;
}
async function activePath(){
 const f=await fixture('active',390),page=f.page;const native=await persistedRoundTrip(f,'editable-return');
 assert.equal(await page.locator('[name="intro"]').inputValue(),DRAFT);
 const before=count(f,'GET','/state');await page.evaluate(()=>window.synkDating.refreshUpdates());
 const after=count(f,'GET','/state');report.activeRecovery={native,inputPreserved:true,stateRequestsBefore:before,stateRequestsAfter:after,notice:await page.locator('#notice').innerText()};
 assert.ok(after>before,'return must restore actual state polling');
 await click(page,'reload');assert.equal(await page.locator('[name="intro"]').inputValue(),DRAFT);
 await click(page,'save-profile');assert.equal((await snap(page)).view.profile.intro,DRAFT);assert.equal(count(f,'POST','/action'),1);
 await shot(page,'editable-return-can-save-390');report.paths.push({scenario:'editable-return',native,inputPreserved:true,pollingRecovered:true,manualSavePosts:1});await f.context.close();
}
async function pendingPath(){
 const f=await fixture('pending',320),page=f.page,initial=(await snap(page)).view.revision,initialReceipts=f.db.prepare('SELECT COUNT(*) AS n FROM dating_receipts WHERE actor=?').get(ACCOUNT).n;
 f.db.exec('PRAGMA query_only=ON');await click(page,'save-profile');assert.equal((await snap(page)).hasPendingDelivery,true);const savedMarker=await marker(page);assert.ok(savedMarker);assert.equal(savedMarker.includes(DRAFT),false);f.db.exec('PRAGMA query_only=OFF');
 const native=await persistedRoundTrip(f,'uncertain-save-return',{fallback:false});
 if(!native){
  // Native navigation reloads into receipt-only mode; test the existing reload boundary.
  assert.equal((await snap(page)).pendingCheckOnly,true);assert.equal(count(f,'POST','/action'),1);await click(page,'delivery-check');assert.equal((await snap(page)).hasPendingDelivery,true);
  report.paths.push({scenario:'native-navigation-without-cache',native:false,pendingCheckOnly:true,additionalActionPosts:0});await f.context.close();
  // A fresh fixture exercises preserved in-memory envelope across the persisted event pair.
  return pendingInjectedPath();
 }
 await verifyPending(f,{native,initial,initialReceipts,savedMarker});
}
async function pendingInjectedPath(){const f=await fixture('pending-injected',320),page=f.page,initial=(await snap(page)).view.revision,initialReceipts=f.db.prepare('SELECT COUNT(*) AS n FROM dating_receipts WHERE actor=?').get(ACCOUNT).n;f.db.exec('PRAGMA query_only=ON');await click(page,'save-profile');const savedMarker=await marker(page);f.db.exec('PRAGMA query_only=OFF');await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await verifyPending(f,{native:false,initial,initialReceipts,savedMarker});}
async function verifyPending(f,{native,initial,initialReceipts,savedMarker}){
 const page=f.page;assert.equal((await snap(page)).hasPendingDelivery,true);assert.equal((await snap(page)).pendingCheckOnly,false);assert.equal(await marker(page),savedMarker);assert.equal(await page.locator('[name="intro"]').inputValue(),DRAFT);assert.equal(count(f,'POST','/action'),1);
 await click(page,'delivery-check');assert.equal((await snap(page)).hasPendingDelivery,true);assert.equal(count(f,'POST','/action'),1);await shot(page,'pending-return-awaits-explicit-retry-320');
 await click(page,'delivery-retry');const posts=f.requests.filter(request=>request.method==='POST'&&request.path.endsWith('/action'));assert.equal(posts.length,2);assert.deepEqual(posts[1].body,posts[0].body);assert.equal((await snap(page)).view.revision,initial+1);assert.equal((await snap(page)).view.profile.intro,DRAFT);assert.equal((await snap(page)).hasPendingDelivery,false);assert.equal(await marker(page),null);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM dating_receipts WHERE actor=?').get(ACCOUNT).n,initialReceipts+1);
 report.paths.push({scenario:'uncertain-save-return',native,inputAndReceiptPreserved:true,automaticActionPosts:0,explicitRetrySameEnvelope:true,revisionIncrement:1,receiptIncrement:1});await f.context.close();
}
async function finalDisposalPath(){const f=await fixture('final-disposal',390),page=f.page;await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});const before=count(f,'GET','/state');await page.evaluate(()=>window.synkDating.refreshUpdates());assert.equal(count(f,'GET','/state'),before);await click(page,'save-profile');assert.equal(count(f,'POST','/action'),0);assert.match(await page.locator('#notice').innerText(),/바뀌었어요|다시 불러와/);report.paths.push({scenario:'final-disposal',injected:true,disposedClientCannotBeRevived:true,actionPosts:0});await f.context.close();}
function holdNextState(f){
 let captured,release;const ready=new Promise(resolve=>captured=resolve);
 const listener=(req,res)=>{if(new URL(req.url,f.origin).pathname!=='/api/atlas-dating/state')return;f.server.removeListener('request',listener);const end=res.end;res.end=function(...args){release=()=>Reflect.apply(end,res,args);captured();return res;};};
 f.server.prependListener('request',listener);return{ready,release:()=>release()};
}
async function remoteIntro(f,intro){const current=await call(f,'/state');return call(f,'/action',{requestId:randomUUID(),expectedRevision:current.view.revision,action:{kind:'profile',profile:{...current.view.profile,intro}}});}
async function stalePollingPath(){
 const f=await fixture('stale-poll',390),page=f.page;
 await remoteIntro(f,'떠나기 직전에만 유효했던 합성 소개');const old=holdNextState(f);
 const polling=page.evaluate(()=>window.synkDating.refreshUpdates());await old.ready;
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await remoteIntro(f,'돌아온 뒤 현재의 합성 소개');const fresh=holdNextState(f);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));old.release();await polling;await fresh.ready;
 const between=await snap(page);assert.equal(between.view.profile.intro,'저장된 합성 소개');assert.equal(await page.locator('[name="intro"]').inputValue(),DRAFT);
 fresh.release();await page.waitForFunction(()=>window.synkDating.snapshot().view?.profile?.intro==='돌아온 뒤 현재의 합성 소개');
 assert.equal(count(f,'POST','/action'),0);report.paths.push({scenario:'stale-state-crossing-return',injected:true,oldResponseIgnored:true,freshStateRead:true,actionPosts:0});await f.context.close();
}
async function staleManualPath(){
 const f=await fixture('stale-manual',390),page=f.page;
 await remoteIntro(f,'수동 조회의 이전 합성 소개');const old=holdNextState(f),loading=page.evaluate(()=>window.synkDating.reload());await old.ready;
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await remoteIntro(f,'수동 복귀 후 현재 합성 소개');const fresh=holdNextState(f);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await fresh.ready;old.release();await loading;
 assert.equal((await snap(page)).view.profile.intro,'저장된 합성 소개');assert.equal(await page.locator('[name="intro"]').inputValue(),DRAFT);
 fresh.release();await page.waitForFunction(()=>window.synkDating.snapshot().view?.profile?.intro==='수동 복귀 후 현재 합성 소개');assert.equal(count(f,'POST','/action'),0);
 report.paths.push({scenario:'manual-state-crossing-return',injected:true,oldResponseIgnored:true,freshStateRead:true,actionPosts:0});await f.context.close();
}
async function initialBootPath(){
 const f=await fixture('boot-crossing',390,{start:false}),page=f.page,requestId=randomUUID();
 const binding=['v1','account',f.config.supabaseUrl,f.config.accountApiUrl,f.config.clients.platform.clientId,f.config.clients.platform.redirectUri].join('|');
 const savedMarker=JSON.stringify({version:1,requestId,actorId:ACCOUNT,demo:false,binding:createHash('sha256').update(binding).digest('hex'),createdAt:new Date().toISOString()});
 await f.context.addInitScript(({key,value})=>sessionStorage.setItem(key,value),{key:DATING_CHECKPOINT_KEY,value:savedMarker});
 const old=holdNextState(f);await page.goto(f.origin+'/atlas-lab/dating.html');await old.ready;assert.equal((await snap(page)).view,null);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await remoteIntro(f,'첫 조회 복귀 뒤 현재 합성 소개');const fresh=holdNextState(f);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await fresh.ready;old.release();
 assert.equal((await snap(page)).view,null);fresh.release();await page.waitForFunction(()=>window.synkDating.snapshot().view?.profile?.intro==='첫 조회 복귀 뒤 현재 합성 소개'&&window.synkDating.snapshot().pendingCheckOnly);
 assert.equal(await marker(page),savedMarker);assert.equal(count(f,'POST','/action'),0);assert.equal(await page.evaluate(()=>window.__qaPollingIntervals.size),1);
 report.paths.push({scenario:'initial-state-crossing-return',injected:true,freshViewLoaded:true,checkpointRestored:true,actionPosts:0,activePollingIntervals:1});await f.context.close();
}
async function revokedAcrossReturnPath(){
 const f=await fixture('revoked-crossing',320),page=f.page;f.db.exec('PRAGMA query_only=ON');await click(page,'save-profile');assert.equal((await snap(page)).hasPendingDelivery,true);assert.ok(await marker(page));f.db.exec('PRAGMA query_only=OFF');f.revoke();
 const old=holdNextState(f),polling=page.evaluate(()=>window.synkDating.refreshUpdates());await old.ready;
 await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});old.release();await polling;
 await page.waitForFunction(()=>window.synkDating.snapshot().view===null);assert.equal((await snap(page)).hasPendingDelivery,false);assert.equal(await marker(page),null);assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),SESSION),null);assert.equal(await page.locator('[name="intro"]').count(),0);assert.equal(count(f,'POST','/action'),1);
 report.paths.push({scenario:'revoked-session-crossing-return',injected:true,privateViewCleared:true,checkpointCleared:true,credentialCleared:true,additionalActionPosts:0});await f.context.close();
}
async function initialUnavailablePath(){
 const f=await fixture('boot-unavailable',320,{start:false}),page=f.page,old=holdNextState(f);
 await page.goto(f.origin+'/atlas-lab/dating.html');await old.ready;await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));f.db.exec('PRAGMA query_only=ON');
 const unavailable=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/atlas-dating/state'&&response.status()===503);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await unavailable;old.release();await page.waitForFunction(()=>window.synkDating.snapshot().view===null&&window.synkDating.snapshot().sync.status==='offline');
 assert.ok(await page.evaluate(key=>sessionStorage.getItem(key),SESSION));const before=count(f,'GET','/state');f.db.exec('PRAGMA query_only=OFF');
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>window.synkDating.snapshot().view?.accountId==='95000000-0000-4000-8000-000000000001'&&window.synkDating.snapshot().sync.status==='connected');
 assert.equal(count(f,'GET','/state'),before+1);assert.equal(count(f,'POST','/action'),0);assert.equal(await page.evaluate(()=>window.__qaPollingIntervals.size),1);
 report.paths.push({scenario:'initial-return-storage-unavailable',injected:true,realSqlite503:true,credentialPreserved:true,onlineRecoveredView:true,actionPosts:0,activePollingIntervals:1});await f.context.close();
}
async function timerBoundaryPath(){
 const f=await fixture('timer-boundary',390),page=f.page;assert.equal(await page.evaluate(()=>window.__qaPollingIntervals.size),1);
 for(let i=0;i<3;i++){
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));const before=count(f,'GET','/state');assert.equal(await page.evaluate(()=>window.__qaPollingIntervals.size),0);await page.evaluate(()=>window.synkDating.refreshUpdates());assert.equal(count(f,'GET','/state'),before);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForFunction(()=>window.synkDating.snapshot().sync.status==='connected');assert.equal(count(f,'GET','/state'),before+1);assert.equal(await page.evaluate(()=>window.__qaPollingIntervals.size),1);
 }
 report.paths.push({scenario:'repeat-suspend-return',injected:true,cycles:3,queriesWhileSuspended:0,activePollingIntervals:1,actionPosts:0});await f.context.close();
}
try{
 await fs.mkdir(out,{recursive:true});report.sourceBefore=await hashes();
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><title>합성 이동 화면</title><p>브라우저 뒤로 가기 확인용 합성 화면</p>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));away={server,origin:`http://127.0.0.1:${server.address().port}`};
 browser=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
 await activePath();await pendingPath();await stalePollingPath();await staleManualPath();await initialBootPath();await initialUnavailablePath();await revokedAcrossReturnPath();await timerBoundaryPath();await finalDisposalPath();assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1;}
finally{
 report.sourceAfter=await hashes();report.sourceStable=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);await browser?.close();
 for(const f of fixtures)await f.server.shutdownDating();if(away)await new Promise(resolve=>away.server.close(resolve));
 const target=path.resolve(tmp);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert.ok(path.basename(target).startsWith('synk-dating-page-lifecycle-'));await fs.rm(target,{recursive:true,force:true});
 const name=report.status==='failed'?`failed-${Date.now()}.json`:'result.json';await fs.writeFile(path.join(out,name),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,paths:report.paths.length,sourceStable:report.sourceStable,nativeReturns:report.navigation.filter(item=>item.native).length,failure:report.failure||null,output:path.join(out,name)}));
}
