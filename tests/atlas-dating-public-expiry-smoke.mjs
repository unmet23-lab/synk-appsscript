// Free isolated browser checks: synthetic identities, loopback and no paid provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createDatingServer} from '../experiences/atlas-lab/dating-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const out=fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-public-expiry/',import.meta.url));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'synk-dating-public-expiry-browser-'));
const START='2026-10-10T03:00:00.000Z',ids=['70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002'];
const tokens=['synthetic-control-owner','synthetic-control-peer'],fixtures=[];
const sourceNames=['public-profile.mjs','dating-ui.mjs','dating-live.mjs','dating.css','discovery.mjs','introduction-guidance.mjs','preference-deadline.mjs','meeting-regions.mjs','discovery-guidance.mjs','dating-insights.mjs','product-experience.mjs','dating-service.mjs','dating-server.mjs','dating-store.mjs'];
const report={at:new Date().toISOString(),status:'running',actualUsers:0,modelCalls:0,externalApiCost:0,paths:[],errors:[],externalRequests:[],screenshots:[]};
let browser;
async function sourceHashes(){const value={};for(const name of sourceNames)value[name]=createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../experiences/atlas-lab/'+name,import.meta.url)))).digest('hex');return value;}
const snap=page=>page.evaluate(()=>window.synkDating.snapshot());
const idle=page=>page.waitForFunction(()=>!document.getElementById('content').hasAttribute('aria-busy'));
async function click(page,key,holder=page){const control=holder.locator(`[data-action="${key}"]`);for(const ancestor of await control.locator('xpath=ancestor::details').all())if(!await ancestor.evaluate(node=>node.open))await reveal(ancestor);await control.click();await idle(page);}
async function reveal(box){for(const ancestor of await box.locator('xpath=ancestor::details').all())if(!await ancestor.evaluate(n=>n.open))await reveal(ancestor);if(!await box.evaluate(n=>n.open))await box.locator(':scope > summary').click();return box;}
async function poll(page){await page.evaluate(()=>window.synkDating.refreshUpdates());await idle(page);}
const fieldOf=(view,id)=>view.discovery.fields.find(item=>item.id===id);
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');assert.deepEqual(await page.locator('img').evaluateAll(nodes=>nodes.filter(n=>!n.complete||!n.naturalWidth).map(n=>n.src)),[]);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');}
async function fixture(name){
  const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));let now=Date.parse(START);
  const accountConfig={version:1,supabaseUrl:'https://synthetic-identity.example.test',supabasePublishableKey:'sb_publishable_synthetic_fixture',accountApiUrl:'https://synthetic-identity.example.test',portalUrl:'https://synthetic-identity.example.test/id/',clients:{platform:{clientId:'synthetic-control-browser',redirectUri:`http://127.0.0.1:${port}/atlas-lab/dating.html`}}};
  const server=createDatingServer({mode:'account',databasePath:path.join(tmp,name+'.sqlite'),clock:()=>new Date(now),accountConfig,verify:async token=>tokens.includes(token)?{accountId:ids[tokens.indexOf(token)]}:null});
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));const f={server,origin:`http://127.0.0.1:${port}`,accountConfig,now:()=>now,advance:ms=>{now+=ms;}};fixtures.push(f);return f;
}
async function call(f,route,index,body){const response=await fetch(f.origin+'/api/atlas-dating'+route,{method:body?'POST':'GET',headers:{Origin:f.origin,Authorization:'Bearer '+tokens[index],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();assert.equal(response.status,200,`${route}: ${JSON.stringify(value.error)}`);return value;}
async function action(f,index,value){const current=await call(f,'/state',index);return call(f,'/action',index,{requestId:randomUUID(),expectedRevision:current.view.revision,action:value});}
const answer=(f,index,field,value,extra={})=>action(f,index,{kind:'discovery',action:{kind:'set',field,value,...extra}});
async function seed(f,index,{publicRegions=['seoul-center'],privateRegions=['seoul-center'],extraAnswers={}}={}){
  await action(f,index,{kind:'profile',profile:{nickname:`조절 검사 가상 ${index+1}`,region:'가상 소개 지역',intro:'무료 확인을 위한 합성 소개',values:{availability:'weekend','self.contact':'daily','self.notice':'advance',...(publicRegions?{'self.meetingRegions':publicRegions}:{})},required:[]}});
  await action(f,index,{kind:'adult',declared:true});await action(f,index,{kind:'consents',consents:{profilePublic:true,receiveInvitations:true,storePreferences:true}});
  for(const [field,value]of Object.entries({consent:true,availability:'weekend','wants.contact':'daily','wants.plan':'planned',...(privateRegions?{'self.meetingRegions':privateRegions}:{}),...extraAnswers}))await answer(f,index,field,value);
}
async function pageFor(f,index=0,width=390,timezoneId='Asia/Seoul'){
  const context=await browser.newContext({viewport:{width,height:950},timezoneId,serviceWorkers:'block'});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==f.origin){report.externalRequests.push(url.origin);return route.abort();}return route.continue();});
  await context.addInitScript(({config,token})=>sessionStorage.setItem('synk.oauth.session.dating',JSON.stringify({binding:[config.supabaseUrl,config.accountApiUrl,config.clients.platform.clientId,config.clients.platform.redirectUri].join('|'),session:{access_token:token,refresh_token:'synthetic-unused',expires_at:Date.now()+3600000}})),{config:f.accountConfig,token:tokens[index]});
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));page.on('dialog',dialog=>dialog.accept());await page.goto(f.origin+'/atlas-lab/dating.html');
  try{await page.waitForFunction(()=>!!window.synkDating?.snapshot().view);await idle(page);}catch(error){report.loadingDiagnosis=await page.locator('body').innerText();throw error;}return page;
}
async function publicDeadlines(){
  const f=await fixture('public-deadlines');await seed(f,0);await seed(f,1);
  const page=await pageFor(f,0,390,'America/Los_Angeles');await click(page,'nav-profile');
  const ownBefore=(await snap(page)).view;
  let box=await reveal(page.locator('[data-public-lifetime="availability"]'));
  await box.locator('[name="public-until-mode-availability"]').selectOption('today');
  await click(page,'save-disclosure');assert.equal((await snap(page)).view.revision,ownBefore.revision);
  assert.match(await page.locator('[data-public-review]').innerText(),/미확인|필수조건/);
  await page.locator('[data-public-review]').scrollIntoViewIfNeeded();await shot(page,'public-deadline-review-390');await page.screenshot({path:path.join(out,'public-review-viewport-390.png'),fullPage:false});report.screenshots.push('public-review-viewport-390.png');await click(page,'cancel-regions-disclosure');
  assert.deepEqual((await snap(page)).view.profile,ownBefore.profile);
  report.paths.push('public deadline preview and cancel leave saved disclosure and private preferences unchanged');
  await click(page,'save-disclosure');await box.locator('[name="public-until-mode-availability"]').selectOption('none');
  assert.equal(await page.locator('[data-action="save-regions-disclosure"]').count(),0);assert.equal((await snap(page)).view.revision,ownBefore.revision);
  await box.locator('[name="public-until-mode-availability"]').selectOption('today');
  report.paths.push('editing a public value or lifetime after review clears the old confirmation so a stale payload cannot be saved');
  await click(page,'save-disclosure');await click(page,'save-regions-disclosure');
  let v=(await snap(page)).view;assert.equal(v.profile.expirations.availability,'2026-10-10T15:00:00.000Z');
  assert.equal(fieldOf(v,'availability').baseline.provenance.until,undefined);assert.deepEqual(v.consents,ownBefore.consents);
  const peerBefore=(await call(f,'/state',1)).view;assert.equal(peerBefore.candidates.find(c=>c.accountId===ids[0]).values.availability,'weekend');
  report.paths.push('today publication is explicit and uses Korean midnight in a Los Angeles browser without copying a private deadline or enabling consent');
  await click(page,'nav-profile');box=await reveal(page.locator('[data-public-lifetime="self.contact"]'));await box.locator('[name="public-until-mode-self.contact"]').selectOption('custom');await box.locator('[name="public-until-self.contact"]').fill('2000-01-01T12:00');const rev=v.revision;await click(page,'save-disclosure');assert.equal((await snap(page)).view.revision,rev);assert.match(await page.locator('#notice').innerText(),/공개 기한/);
  report.paths.push('a past public deadline is rejected in the form without saving any answers');
  await page.reload();await page.waitForFunction(()=>!!window.synkDating?.snapshot().view);await idle(page);await click(page,'nav-profile');
  f.advance(12*3600000);await poll(page);v=(await snap(page)).view;assert.ok(v.publicAnswers.expiredFields.includes('availability'));assert.equal(v.publicAnswers.values.availability,undefined);assert.equal(v.profile.values.availability,'weekend');
  await reveal(page.locator('[data-disclosure]'));assert.match(await page.locator('[data-public-expired]').innerText(),/기한이 지난 답/);await page.setViewportSize({width:320,height:950});await page.locator('[data-public-expired]').evaluate(node=>node.scrollIntoView({block:'start'}));await shot(page,'expired-disclosure-needs-confirmation-320');await page.screenshot({path:path.join(out,'public-expired-viewport-320.png'),fullPage:false});report.screenshots.push('public-expired-viewport-320.png');
  const peer=(await call(f,'/state',1)).view;assert.equal(peer.candidates.find(c=>c.accountId===ids[0]).values.availability,undefined);assert.equal(peer.discovery.candidates.find(c=>c.id===ids[0]).canConnect,false);
  assert.equal(fieldOf(v,'availability').value,'weekend');
  report.paths.push('clock-only expiration removes the answer from counterpart comparison and displays own reconfirmation while preserving the private answer and saved owner history');
  await page.locator('[name="public-availability"]').selectOption('weekday');await click(page,'save-disclosure');assert.equal((await snap(page)).view.revision,v.revision);assert.match(await page.locator('#notice').innerText(),/새 기한|기한 없이 공개/);await page.locator('[name="public-availability"]').selectOption('weekend');
  report.paths.push('changing an expired answer while retaining its expired lifetime is stopped locally with a concrete reconfirmation instruction');
  await click(page,'nav-settings');await reveal(page.locator('details').filter({has:page.locator(':scope > summary',{hasText:'내 소개 수정'})}));await page.locator('[name="intro"]').fill('기한을 바꾸지 않는 소개글 수정');await click(page,'save-profile');v=(await snap(page)).view;assert.equal(v.profile.expirations.availability,'2026-10-10T15:00:00.000Z');assert.equal(v.publicAnswers.values.availability,undefined);
  report.paths.push('editing a profile biography after expiry round-trips the original deadline and cannot revive the public answer');
  await click(page,'nav-profile');box=await reveal(page.locator('[data-public-lifetime="availability"]'));await box.locator('[name="public-until-mode-availability"]').selectOption('none');await click(page,'save-disclosure');assert.equal((await snap(page)).view.publicAnswers.values.availability,undefined);assert.match(await page.locator('[data-public-review]').innerText(),/기한 없이 공개/);await click(page,'save-regions-disclosure');v=(await snap(page)).view;assert.equal(v.publicAnswers.values.availability,'weekend');assert.ok(!v.publicAnswers.expiredFields.includes('availability'));await shot(page,'explicit-public-reconfirmation-320');
  report.paths.push('restoring expired disclosure requires explicit new lifetime selection and confirmation; no old private answer or consent is copied');await page.context().close();
}
try{await fs.mkdir(out,{recursive:true});report.sourceBefore=await sourceHashes();browser=await chromium.launch({channel:'chrome',headless:true});await publicDeadlines();assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);assert.deepEqual(await sourceHashes(),report.sourceBefore);report.status='passed';}
catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{report.sourceSha256=await sourceHashes();report.sourceStable=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceSha256);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();for(const f of fixtures){f.server.closeAllConnections();await new Promise(resolve=>f.server.close(resolve));}const target=path.resolve(tmp);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert.ok(path.basename(target).startsWith('synk-dating-public-expiry-browser-'));await fs.rm(target,{recursive:true,force:true});console.log(JSON.stringify(report,null,2));}
