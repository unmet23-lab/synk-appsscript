import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';
import {emptyPulseStudio} from './pulse-studio.mjs';

const csrf='synthetic-material-usage-csrf',uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),target='material:reference:'+uuid(2),now='2026-10-13T03:00:00Z';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-material-usage-http-'));let external=0;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,clock:()=>now,collector:async()=>{external++;throw new Error('Unexpected external call');},synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});await app.start();
  const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-material-usage-http-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]]){users[name]=app.store.createUser({name,email:name+'@usage-http.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);}
  const project=app.clientProjects.save(users.owner,{title:'사용 구분 HTTP 합성 프로젝트',customerName:'합성 고객',reviewerId:users.reviewer.id}).project,id=project.id,path='/api/client-projects/'+id+'/material-usage',rightsPath='/api/client-projects/'+id+'/rights';
  app.store.put('clientProjects',id,{...project,studio:{...emptyPulseStudio(),references:[{id:uuid(2),label:'허가 음악 원본',url:'https://example.test/music.mp3',at:now}]},versions:[{id:uuid(3),kind:'preview',label:'승인 시안',url:'https://example.test/preview.mp4',createdAt:now,approvedAt:now},{id:uuid(4),kind:'final',label:'현재 최종 영상',url:'https://example.test/final.mp4',createdAt:now,approvedPreviewId:uuid(3)}]});
  async function api({user='owner',url=path,input,method=input===undefined?'GET':'POST',headers={}}={}){const response=await fetch(base+url,{method,headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json(),headers:response.headers};}
  const input=async(overrides={})=>{const data=(await api()).data,item=data.items.find(item=>item.targetId===target);return {expectedRevision:data.revision,projectRevision:data.projectRevision,contextFingerprint:data.contextFingerprint,targetId:target,sourceFingerprint:item.sourceFingerprint,status:'reference',...overrides};};
  async function allow(targetId=target){const data=(await api({url:rightsPath})).data,item=data.items.find(item=>item.targetId===targetId);return api({url:rightsPath,input:{expectedRevision:data.revision,projectRevision:data.projectRevision,targetId,sourceFingerprint:item.sourceFingerprint,status:'allowed',scope:'합성 사용 범위',evidence:'HTTP-PRIVATE-USAGE-RIGHTS',agreedAt:'2026-10-01',expiryMode:'date',expiresAt:'2026-10-15'}});}
  async function slow(change){const data=JSON.stringify(await input()),arrived=new Promise(resolve=>app.server.once('request',()=>queueMicrotask(resolve)));let req;const pending=new Promise((resolve,reject)=>{req=request(base+path,{method:'POST',headers:{Cookie:'synk_company_session='+sessions.owner,Origin:app.origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},response=>{let result='';response.setEncoding('utf8');response.on('data',chunk=>result+=chunk);response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(result)}));});req.on('error',reject);});req.write(data.slice(0,15));await arrived;change();req.end(data.slice(15));return pending;}
  return {app,users,sessions,id,path,rightsPath,api,input,allow,slow,row:()=>app.store.get('clientProjects',id),external:()=>external};
}
const tasks=result=>result.data.items.filter(item=>item.kind==='client_rights_expiry');
const rightsCard=result=>result.data.cards.find(item=>item.id==='rights');

test('HTTP usage is encrypted, read-only for customers and separate from project approvals and messages',async t=>{
  const f=await fixture(t),customer=f.app.clientProjects.open(f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.row().revision}).invite),customerHeaders={Cookie:'synk_pulse_session='+customer.session},before=JSON.stringify(f.row()),customerBefore=await f.api({user:null,url:'/pulse/api/project',headers:customerHeaders});
  assert.equal(customerBefore.status,200,JSON.stringify(customerBefore.data));let result=await f.api();assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(result.data.summary.undecided,1);assert.equal(result.data.summary.currentFinals,1);
  result=await f.api({input:await f.input()});assert.equal(result.status,200);assert.equal(result.data.summary.reference,1);assert.equal(result.data.items[0].record.actorName,'owner');assert.equal(result.data.items.find(item=>item.isCurrentFinal).canEdit,false);assert.equal(JSON.stringify(f.row()),before);
  assert.doesNotMatch(JSON.stringify(f.app.store.get('clientMaterialUsage',f.id)),/sourceFingerprint|contextFingerprint|reference/);
  const customerAfter=await f.api({user:null,url:'/pulse/api/project',headers:customerHeaders});assert.deepEqual(customerAfter.data,customerBefore.data);assert.doesNotMatch(JSON.stringify(customerAfter.data),/contextFingerprint|appliesToCurrent|referenceOnly|clientMaterialUsage/);
  assert.equal((await f.api({user:null,headers:customerHeaders})).status,401);assert.equal((await f.api({user:null,headers:customerHeaders,input:await f.input()})).status,401);assert.equal(f.external(),0);
});

test('HTTP only current authorized staff can record usage; origin, CSRF, queries and bounded bodies are enforced',async t=>{
  const f=await fixture(t),input=await f.input();assert.equal((await f.api({user:null})).status,401);assert.equal((await f.api({user:'other'})).status,404);assert.equal((await f.api({user:'other',input})).status,404);
  for(const user of ['reviewer','viewer']){assert.equal((await f.api({user})).data.canEdit,false);assert.equal((await f.api({user,input})).status,403);}assert.equal((await f.api({user:'admin'})).data.canEdit,true);
  for(const headers of [{'X-CSRF-Token':'bad'},{Origin:'https://other.example'},{Origin:'null'}])assert.equal((await f.api({input,headers})).status,403);
  for(const suffix of ['?query=private-text','?demo=1'])assert.equal((await f.api({url:f.path+suffix})).status,400);
  assert.equal((await f.api({method:'DELETE'})).status,405);assert.equal((await f.api({input:{...input,actorId:'forged'}})).status,400);assert.equal((await f.api({input:{...input,status:'x'.repeat(3000)}})).status,413);assert.equal(f.app.store.all('clientMaterialUsage').length,0);
});

test('HTTP concurrent writes, current context and source checks reject stale changes; an unchanged current save is idempotent',async t=>{
  const f=await fixture(t),input=await f.input(),results=await Promise.all([f.api({input}),f.api({input})]);assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);assert.equal((await f.api({input:await f.input()})).data.revision,1);
  for(const patch of [{sourceFingerprint:'b'.repeat(64)},{contextFingerprint:'c'.repeat(64)}])assert.equal((await f.api({input:await f.input(patch)})).status,409);
  const latest=await f.input(),row=f.row();row.revision++;f.app.store.put('clientProjects',f.id,row);assert.equal((await f.api({input:latest})).status,409);assert.equal((await f.api()).data.revision,1);
  row.studio.references[0].url='https://example.test/replaced.mp3';row.revision++;f.app.store.put('clientProjects',f.id,row);assert.equal((await f.api()).data.summary.stale,1);assert.equal((await f.api({input:{...latest,projectRevision:row.revision}})).status,409);
});

test('HTTP reference-only removes its #34 task and health entry immediately while preserving portfolio consent and original records',async t=>{
  const f=await fixture(t);assert.equal((await f.allow()).status,200);assert.equal((await f.allow('portfolio')).status,200);const before=JSON.stringify(f.row()),rightsBefore=JSON.stringify(f.app.store.all('clientRights'));
  const workflow=()=>f.api({url:'/api/client-workflow'}),health=()=>f.api({url:'/api/automation-health'});assert.equal(tasks(await workflow()).length,2);assert.equal(rightsCard(await health()).counts.manual,2);
  assert.equal((await f.api({input:await f.input()})).status,200);assert.deepEqual(tasks(await workflow()).map(item=>new URL(item.href,f.app.origin).searchParams.get('rightsTarget')),['portfolio']);assert.equal(rightsCard(await health()).counts.manual,1);
  const rights=(await f.api({url:f.rightsPath})).data.items.find(item=>item.targetId===target);assert.equal(rights.referenceOnly,true);assert.equal(rights.effectiveStatus,'allowed');assert.equal(rights.record.evidence,'HTTP-PRIVATE-USAGE-RIGHTS');
  for(const status of ['used','undecided']){assert.equal((await f.api({input:await f.input({status})})).status,200);assert.equal(tasks(await workflow()).length,2);assert.equal(rightsCard(await health()).counts.manual,2);}
  assert.equal(JSON.stringify(f.row()),before);assert.equal(JSON.stringify(f.app.store.all('clientRights')),rightsBefore);assert.equal(f.external(),0);
});

test('HTTP a new final invalidates the usage decision and restores expiry; current final files and their aliases cannot be reference-only',async t=>{
  const f=await fixture(t);await f.allow();await f.api({input:await f.input()});const stale=await f.input(),row=f.row();row.versions.push({id:uuid(5),kind:'final',label:'새 자막',url:'https://example.test/new.srt',createdAt:now,approvedPreviewId:uuid(3)});row.revision++;f.app.store.put('clientProjects',f.id,row);
  let data=(await f.api()).data;assert.equal(data.summary.stale,1);assert.equal(data.items[0].status,'undecided');assert.equal(tasks(await f.api({url:'/api/client-workflow'})).length,1);assert.equal((await f.api({input:{...stale,projectRevision:row.revision}})).status,409);
  const final=data.items.find(item=>item.isCurrentFinal);assert.equal((await f.api({input:await f.input({targetId:final.targetId,sourceFingerprint:final.sourceFingerprint})})).status,400);assert.equal((await f.api({input:await f.input({targetId:'portfolio'})})).status,400);
  row.studio.references[0].url=row.versions[1].url;row.revision++;f.app.store.put('clientProjects',f.id,row);data=(await f.api()).data;assert.equal(data.items[0].status,'used');assert.equal(data.items[0].isCurrentFinal,true);assert.equal((await f.api({input:await f.input()})).status,409);
});

test('HTTP usage reads hide removed sources, archived writes are blocked and projects without a final stay undecided',async t=>{
  const f=await fixture(t);await f.api({input:await f.input()});let row=f.row();row.stage='archived';f.app.store.put('clientProjects',f.id,row);assert.equal((await f.api()).data.canEdit,false);assert.equal((await f.api({input:await f.input()})).status,409);
  row.stage='delivered';row.studio.references[0].hidden=true;f.app.store.put('clientProjects',f.id,row);assert.ok(!(await f.api()).data.items.some(item=>item.targetId===target));delete row.studio.references[0].hidden;row.versions=[];row.revision++;f.app.store.put('clientProjects',f.id,row);let data=(await f.api()).data;assert.equal(data.hasDelivery,false);assert.equal(data.canEdit,false);assert.equal(data.items[0].status,'undecided');assert.equal((await f.api({input:await f.input()})).status,409);
});

test('HTTP rechecks session, role and assignment after body receipt before storing any usage history',async t=>{
  for(const change of ['session','role','assignment']){const f=await fixture(t),result=await f.slow(()=>{if(change==='session')f.app.store.revokeUser(f.users.owner.id);else if(change==='role')f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});else f.app.store.put('clientProjects',f.id,{...f.row(),ownerId:f.users.other.id,teamId:'b'});});assert.equal(result.status,change==='session'?401:change==='role'?403:404);assert.equal(f.app.store.all('clientMaterialUsage').length,0);}
});
