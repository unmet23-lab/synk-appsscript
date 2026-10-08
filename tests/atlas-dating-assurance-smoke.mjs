// Actual local UI/API proof. All accounts are synthetic; outbound calls are blocked.
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
const out=fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-assurance/',import.meta.url));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'synk-dating-assurance-browser-'));
const START='2026-10-10T03:00:00.000Z';
const ids=['71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002'],tokens=['synthetic-assurance-owner','synthetic-assurance-peer'];
const sourceNames=['dating-ui.mjs','dating.css','discovery.mjs','dating-insights.mjs','dating-service.mjs','dating-server.mjs','dating-store.mjs','preference-deadline.mjs','meeting-regions.mjs','introduction-guidance.mjs','discovery-guidance.mjs','product-experience.mjs'];
const report={at:new Date().toISOString(),status:'running',actualUsers:0,modelCalls:0,externalApiCost:0,paths:[],errors:[],externalRequests:[],screenshots:[],sourceFreezeRequired:true};
const fixtures=[];let browser;
async function sourceHashes(){const hashes={};for(const name of sourceNames)hashes[name]=createHash('sha256').update(await fs.readFile(fileURLToPath(new URL('../experiences/atlas-lab/'+name,import.meta.url)))).digest('hex');return hashes;}
const snap=page=>page.evaluate(()=>window.synkDating.snapshot());
const idle=page=>page.waitForFunction(()=>!document.getElementById('content').hasAttribute('aria-busy'));
async function reveal(box){for(const ancestor of await box.locator('xpath=ancestor::details').all())if(!await ancestor.evaluate(node=>node.open))await reveal(ancestor);if(!await box.evaluate(node=>node.open))await box.locator(':scope > summary').click();return box;}
async function click(page,key,holder=page){const control=holder.locator(`[data-action="${key}"]`);for(const ancestor of await control.locator('xpath=ancestor::details').all())if(!await ancestor.evaluate(node=>node.open))await reveal(ancestor);await control.click();await idle(page);}
const fieldOf=(view,id)=>view.discovery.fields.find(field=>field.id===id);
const priorityAction=(fields,target,until)=>({kind:'discovery',action:{kind:'priorities',fields,target,...(until?{until}:{})}});
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}: horizontal overflow`);assert.deepEqual(await page.locator('img').evaluateAll(images=>images.filter(image=>!image.complete||!image.naturalWidth).map(image=>image.src)),[]);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');}
async function viewportShot(page,focus,name){for(const ancestor of await focus.locator('xpath=ancestor::details').all())if(!await ancestor.evaluate(node=>node.open))await reveal(ancestor);await focus.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}: horizontal overflow`);await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});report.screenshots.push(name+'.png');}
async function fixture(name){
 const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));let now=Date.parse(START);
 const accountConfig={version:1,supabaseUrl:'https://synthetic-identity.example.test',supabasePublishableKey:'sb_publishable_synthetic_fixture',accountApiUrl:'https://synthetic-identity.example.test',portalUrl:'https://synthetic-identity.example.test/id/',clients:{platform:{clientId:'synthetic-assurance-browser',redirectUri:`http://127.0.0.1:${port}/atlas-lab/dating.html`}}};
 const server=createDatingServer({mode:'account',databasePath:path.join(tmp,name+'.sqlite'),clock:()=>new Date(now),accountConfig,verify:async token=>tokens.includes(token)?{accountId:ids[tokens.indexOf(token)]}:null});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));const f={server,origin:`http://127.0.0.1:${port}`,accountConfig,now:()=>now,advance:ms=>{now+=ms;}};fixtures.push(f);return f;
}
async function call(f,route,index,body){const response=await fetch(f.origin+'/api/atlas-dating'+route,{method:body?'POST':'GET',headers:{Origin:f.origin,Authorization:'Bearer '+tokens[index],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();assert.equal(response.status,200,`${route}: ${JSON.stringify(value.error)}`);return value;}
async function action(f,index,event){const current=await call(f,'/state',index);return call(f,'/action',index,{requestId:randomUUID(),expectedRevision:current.view.revision,action:event});}
const answer=(f,index,field,value,extra={})=>action(f,index,{kind:'discovery',action:{kind:'set',field,value,...extra}});
async function seed(f,index,{required=false}={}){
 await action(f,index,{kind:'profile',profile:{nickname:`안심 검사 가상 ${index+1}`,region:'무료 합성 지역',intro:'합성 계정의 무료 기능 확인',values:{availability:'weekend','self.meetingRegions':['seoul-center'],'self.contact':'daily','self.plan':'planned','self.relationshipGoal':'committed','self.relationshipSpeed':'gradual'},required:[]}});
 await action(f,index,{kind:'adult',declared:true});await action(f,index,{kind:'consents',consents:{profilePublic:true,receiveInvitations:true,storePreferences:true}});
 for(const[field,value]of Object.entries({consent:true,availability:'weekend','self.meetingRegions':['seoul-center'],'wants.contact':'daily','wants.plan':'planned','wants.pace':'lead','wants.notice':'advance','wants.relationshipGoal':'exploring','wants.relationshipSpeed':'gradual'}))await answer(f,index,field,value,field==='wants.contact'&&required?{required:true}:{});
}
async function pageFor(f,index=0,width=390){
 const context=await browser.newContext({viewport:{width,height:950},timezoneId:'Asia/Seoul',serviceWorkers:'block'});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==f.origin){report.externalRequests.push(url.origin);return route.abort();}return route.continue();});
 await context.addInitScript(({config,token})=>sessionStorage.setItem('synk.oauth.session.dating',JSON.stringify({binding:[config.supabaseUrl,config.accountApiUrl,config.clients.platform.clientId,config.clients.platform.redirectUri].join('|'),session:{access_token:token,refresh_token:'synthetic-unused',expires_at:Date.now()+3600000}})),{config:f.accountConfig,token:tokens[index]});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));page.on('dialog',dialog=>dialog.accept());await page.goto(f.origin+'/atlas-lab/dating.html');
 try{await page.waitForFunction(()=>!!window.synkDating?.snapshot().view);await idle(page);}catch(error){report.loadingDiagnosis=await page.locator('body').innerText();throw error;}return page;
}
function latestPriority(view,target){return view.discovery.priorityChanges.filter(change=>change.kind==='priorities'&&change.target===target).at(-1);}
async function priorityUndo(target){
 const f=await fixture('undo-'+target);await seed(f,0,{required:true});await seed(f,1);
 const otherTarget=target==='baseline'?'context':'baseline';await action(f,0,priorityAction(['wants.pace'],otherTarget));
 const previousUntil=new Date(f.now()+3600000).toISOString(),currentUntil=new Date(f.now()+7200000).toISOString();
 await action(f,0,priorityAction(['wants.contact'],target,previousUntil));await action(f,0,priorityAction(['wants.plan'],target,currentUntil));
 const page=await pageFor(f,0,target==='baseline'?320:390);await click(page,'nav-profile');const before=(await snap(page)).view,change=latestPriority(before,target),row=page.locator(`[data-priority-change="${change.id}"]`);assert.equal(change.canUndo,true);
 await reveal(row.locator('xpath=ancestor::details').last());assert.match(await row.innerText(),/변경 전:.*연락.*변경 후:.*약속/s);assert.match(await row.innerText(),target==='baseline'?/평소 기준/:/이번 추천에서만/);assert.match(await row.innerText(),/변경 전 기한:.*변경 후 기한:/s);
 await click(page,'undo-priorities',row);await page.waitForSelector('[data-preview="pending"]');assert.equal((await snap(page)).view.revision,before.revision);assert.match(await page.locator('[data-deadline-confirmation]').innerText(),/적용 후:.*연락|필수조건/s);await shot(page,`importance-${target}-undo-preview-${target==='baseline'?320:390}`);await click(page,'preview-cancel');
 let view=(await snap(page)).view;assert.equal(view.revision,before.revision);assert.deepEqual(view.discovery.priorities,before.discovery.priorities);assert.equal(fieldOf(view,'wants.contact').required,true);
 report.paths.push(`${target} importance undo opens a before-and-after preview with its original deadline; cancellation preserves revision, priorities and required contact`);
 await click(page,'undo-priorities',page.locator(`[data-priority-change="${change.id}"]`));await page.waitForSelector('[data-preview="pending"]');await click(page,'preview-apply');view=(await snap(page)).view;
 assert.deepEqual(view.discovery.priorities[target],['wants.contact']);assert.equal(view.discovery.priorities.deadlines[target],previousUntil);assert.deepEqual(view.discovery.priorities[otherTarget],['wants.pace']);assert.equal(fieldOf(view,'wants.contact').required,true);assert.equal(fieldOf(view,'wants.contact').requiredValue,'daily');assert.equal(fieldOf(view,'wants.plan').value,'planned');assert.equal(view.discovery.priorityChanges.at(-1).kind,'undo-priorities');assert.equal(view.discovery.priorityChanges.at(-1).canUndo,false);await shot(page,`importance-${target}-undo-applied-${target==='baseline'?320:390}`);
 await viewportShot(page,page.locator(`[data-priority-change="${view.discovery.priorityChanges.at(-1).id}"]`),`importance-${target}-undo-history-viewport-${target==='baseline'?320:390}`);
 report.paths.push(`${target} explicit undo apply restores only that layer's original importance and lifetime while keeping the independent layer, required answer and preference values`);await page.context().close();
}
async function expiredUndo(target){
 const f=await fixture('expired-undo-'+target);await seed(f,0,{required:true});await seed(f,1);if(target==='context')await action(f,0,priorityAction(['wants.pace'],'baseline'));
 const until=new Date(f.now()+60000).toISOString();await action(f,0,priorityAction(['wants.contact'],target,until));await action(f,0,priorityAction(['wants.plan'],target));f.advance(120000);
 const page=await pageFor(f,0,320);await click(page,'nav-profile');const before=(await snap(page)).view,change=latestPriority(before,target),row=page.locator(`[data-priority-change="${change.id}"]`);await click(page,'undo-priorities',row);assert.match(await page.locator('[data-deadline-confirmation]').innerText(),/기한이 지나 복원하지/);assert.equal((await snap(page)).view.revision,before.revision);await shot(page,`importance-${target}-expired-source-320`);await click(page,'preview-apply');const view=(await snap(page)).view;
 assert.deepEqual(view.discovery.priorities[target],target==='context'?null:[]);assert.ok(!view.discovery.priorities.deadlines?.[target]);assert.deepEqual(view.discovery.priorities.effective,target==='context'?['wants.pace']:[]);assert.equal(fieldOf(view,'wants.contact').required,true);
 report.paths.push(`${target} undo explains that an expired previous importance will not be revived and actually returns to ${target==='context'?'the valid baseline':'no separate baseline importance'} without weakening required contact`);await page.context().close();
}
async function expiryDuringUndoPreview(){
 const f=await fixture('undo-preview-expiry');await seed(f,0,{required:true});await seed(f,1);await action(f,0,priorityAction(['wants.pace'],'baseline'));await action(f,0,priorityAction(['wants.contact'],'context',new Date(f.now()+60000).toISOString()));await action(f,0,priorityAction(['wants.plan'],'context'));
 const page=await pageFor(f);await click(page,'nav-profile');const before=(await snap(page)).view,change=latestPriority(before,'context');await click(page,'undo-priorities',page.locator(`[data-priority-change="${change.id}"]`));await page.waitForSelector('[data-preview="pending"]');f.advance(120000);await click(page,'preview-apply');
 assert.equal(await page.locator('[data-preview="pending"]').count(),1);assert.match(await page.locator('#notice').innerText(),/바뀌|기한|미리보기|최신/);let actual=(await call(f,'/state',0)).view;assert.equal(actual.revision,before.revision);assert.deepEqual(actual.discovery.priorities.context,['wants.plan']);await click(page,'preview-cancel');actual=(await snap(page)).view;assert.deepEqual(actual.discovery.priorities.context,['wants.plan']);assert.equal(fieldOf(actual,'wants.contact').required,true);
 report.paths.push('if the old importance expires while its restoration preview is open, actual apply is rejected and returning to refreshed state preserves the newer choice and required answer');await page.context().close();
}
async function relationshipScene({id,field,choice,value,untouched,width}){
 const f=await fixture('scene-'+id);await seed(f,0);await seed(f,1);const page=await pageFor(f,0,width),before=(await snap(page)).view;let scene=await reveal(page.locator(`[data-scene="${id}"]`));const descriptor=before.discovery.scenes.find(item=>item.id===id);assert.equal(descriptor.field,field);assert.equal(descriptor.canRespond,true);assert.match(descriptor.intro,/연락 간격과 이번 약속은 같/);const independentBefore=fieldOf(before,untouched).value;
 await click(page,'scene-'+choice,scene);let view=(await snap(page)).view;assert.equal(fieldOf(view,field).value,fieldOf(before,field).value);assert.equal(fieldOf(view,untouched).value,independentBefore);assert.deepEqual(view.discovery.priorities,before.discovery.priorities);assert.deepEqual(view.discovery.candidates,before.discovery.candidates);assert.equal(view.discovery.scenes.find(item=>item.id===id).response.choice,choice);assert.equal(view.profile.values[field],undefined);
 const peer=(await call(f,'/state',1)).view;assert.equal(peer.discovery.scenes.find(item=>item.id===id).response,null);report.paths.push(`${id} records only the private scene reaction with contact and appointment held constant; neither relationship axis, ranking, publication nor counterpart reaction changes automatically`);
 scene=await reveal(page.locator(`[data-scene="${id}"]`));const revision=view.revision;await click(page,'scene-preview',scene);await page.waitForSelector('[data-preview="pending"]');assert.equal((await snap(page)).view.revision,revision);await shot(page,`relationship-${id}-explicit-preview-${width}`);await click(page,'preview-cancel');view=(await snap(page)).view;assert.equal(view.revision,revision);assert.equal(fieldOf(view,field).value,fieldOf(before,field).value);
 scene=await reveal(page.locator(`[data-scene="${id}"]`));await click(page,'scene-preview',scene);await click(page,'preview-apply');view=(await snap(page)).view;assert.equal(fieldOf(view,field).value,value);assert.equal(fieldOf(view,field).source,'context');assert.equal(fieldOf(view,field).baseline.value,fieldOf(before,field).baseline.value);assert.equal(fieldOf(view,untouched).value,independentBefore);assert.equal(view.profile.values[field],undefined);
 await click(page,'nav-discover');scene=await reveal(page.locator(`[data-scene="${id}"]`));await click(page,'scene-withdraw',scene);view=(await snap(page)).view;assert.equal(view.discovery.scenes.find(item=>item.id===id).response,null);assert.equal(fieldOf(view,field).value,value);assert.equal(fieldOf(view,untouched).value,independentBefore);await shot(page,`relationship-${id}-withdraw-keeps-applied-answer-${width}`);
 scene=await reveal(page.locator(`[data-scene="${id}"]`));await viewportShot(page,scene,`relationship-${id}-withdrawn-scene-viewport-${width}`);
 report.paths.push(`${id} applies only the explicitly previewed current ${field} answer; cancelling leaves it unchanged and later withdrawing the reaction keeps the independently applied answer`);await page.context().close();
}
try{
 await fs.mkdir(out,{recursive:true});report.sourceBefore=await sourceHashes();browser=await chromium.launch({channel:'chrome',headless:true});
 for(const target of ['baseline','context'])await priorityUndo(target);
 for(const target of ['baseline','context'])await expiredUndo(target);
 await expiryDuringUndoPreview();
 await relationshipScene({id:'relationship-goal',field:'wants.relationshipGoal',choice:'a',value:'committed',untouched:'wants.relationshipSpeed',width:390});
 await relationshipScene({id:'relationship-speed',field:'wants.relationshipSpeed',choice:'b',value:'steady',untouched:'wants.relationshipGoal',width:320});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;for(const context of browser?.contexts()||[])for(const page of context.pages())try{await fs.writeFile(path.join(out,'failure-body.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});}catch{}throw error;}
finally{report.sourceSha256=await sourceHashes();report.sourceStable=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceSha256);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();for(const f of fixtures){f.server.closeAllConnections();await new Promise(resolve=>f.server.close(resolve));}const target=path.resolve(tmp);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert.ok(path.basename(target).startsWith('synk-dating-assurance-browser-'));await fs.rm(target,{recursive:true,force:true});console.log(JSON.stringify(report,null,2));}
