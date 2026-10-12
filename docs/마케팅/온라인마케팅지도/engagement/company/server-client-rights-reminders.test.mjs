import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const csrf='synthetic-expiry-csrf',assetId='00000000-0000-4000-8000-000000000002';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-rights-reminders-http-'));let now='2026-10-12T14:59:59.999Z',external=0;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,clock:()=>now,collector:async()=>{external++;throw new Error('Unexpected external call');},synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});await app.start();
  const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-rights-reminders-http-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]]){users[name]=app.store.createUser({name,email:name+'@reminders-http.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);}
  const project=app.clientProjects.save(users.owner,{title:'기간 알림 합성 프로젝트',customerName:'합성 고객',reviewerId:users.reviewer.id}).project,id=project.id,rightsPath='/api/client-projects/'+id+'/rights';
  app.store.put('clientProjects',id,{...project,studio:{assets:[],references:[{id:assetId,label:'합성 참고 이미지',url:'https://example.test/original.png'}],concepts:[],scenes:[],comments:[],sceneReviews:[]}});
  async function api(path,options={}){const {user='owner',input}=options,method=input===undefined?'GET':'POST',response=await fetch(base+path,{method,headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(input===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json(),headers:response.headers};}
  async function save(overrides={}){const data=(await api(rightsPath)).data,item=data.items[0];return api(rightsPath,{input:{expectedRevision:data.revision,projectRevision:data.projectRevision,targetId:item.targetId,sourceFingerprint:item.sourceFingerprint,status:'allowed',scope:'회사 웹사이트',evidence:'HTTP-PRIVATE-RIGHTS-EVIDENCE',agreedAt:'2026-10-01',expiryMode:'date',expiresAt:'2026-10-20',...overrides}});}
  const workflow=async(user='owner')=>api('/api/client-workflow',{user}),health=async(user='owner')=>api('/api/automation-health',{user});
  return {app,users,id,rightsPath,api,save,workflow,health,row:()=>app.store.get('clientProjects',id),setNow:value=>now=value,external:()=>external};
}
const tasks=result=>result.data.items.filter(item=>item.kind==='client_rights_expiry');
const card=result=>result.data.cards.find(item=>item.id==='rights');

test('HTTP rights snapshots, Today and automation health share the seven-day KST boundary without duplicate writes',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),saved=await f.save();assert.equal(saved.status,200);assert.equal(saved.data.reminders.targets,1);assert.equal(saved.data.reminders.items.length,0);assert.equal(tasks(await f.workflow()).length,0);let health=await f.health();assert.equal(card(health).nextDueAt,'2026-10-12T15:00:00.000Z');assert.equal(card(health).nextRunAt,null);
  f.setNow('2026-10-12T15:00:00.000Z');let workflow=await f.workflow(),task=tasks(workflow)[0];assert.equal(workflow.status,200);assert.match(workflow.headers.get('cache-control'),/no-store/);assert.equal(task.status,'upcoming');assert.equal(task.statusLabel,'7일 뒤 사용 기간 만료');assert.equal(new URL(task.href,f.app.origin).searchParams.get('rightsTarget'),'material:reference:'+assetId);health=await f.health();assert.equal(card(health).counts.targets,1);assert.equal(card(health).counts.staffWaiting,1);assert.equal(card(health).status,'manual');assert.equal(card(health).counts.issues,0);assert.equal(card(health).nextRunAt,null);assert.equal(health.data.manual.filter(item=>item.automationId==='rights').length,1);
  const rightsBefore=JSON.stringify(f.app.store.all('clientRights'));for(let n=0;n<3;n++){assert.deepEqual(tasks(await f.workflow()).map(item=>item.id),[task.id]);assert.equal(card(await f.health()).counts.manual,1);}f.app.scanAutomationHealth();assert.equal(JSON.stringify(f.app.store.all('clientRights')),rightsBefore);assert.equal(JSON.stringify(f.row()),before);assert.equal(f.app.store.all('clientNotificationReads').length,0);assert.equal(f.app.store.all('automationNotificationStates').length,0);assert.equal(f.external(),0);assert.doesNotMatch(JSON.stringify(workflow.data)+JSON.stringify(health.data),/HTTP-PRIVATE-RIGHTS-EVIDENCE|회사 웹사이트/);
});

test('HTTP expiry includes the entire final day and a renewed record resolves both task and health immediately',async t=>{
  const f=await fixture(t);await f.save({expiresAt:'2026-10-12'});let task=tasks(await f.workflow())[0];assert.equal(task.status,'due');assert.equal((await f.api(f.rightsPath)).data.items[0].effectiveStatus,'allowed');f.setNow('2026-10-12T15:00:00.000Z');assert.equal(tasks(await f.workflow())[0].status,'expired');assert.equal((await f.api(f.rightsPath)).data.items[0].effectiveStatus,'expired');const before=JSON.stringify(f.row());assert.equal((await f.save({expiresAt:'2026-11-12'})).status,200);assert.equal(tasks(await f.workflow()).length,0);const health=await f.health();assert.equal(card(health).counts.targets,1);assert.equal(card(health).counts.manual,0);assert.equal(card(health).status,'ready');assert.equal(card(health).nextRunAt,null);assert.equal((await f.api(f.rightsPath)).data.history.length,2);assert.equal(JSON.stringify(f.row()),before);
});

test('HTTP tasks follow current ownership, retain accessible archived periods, and exclude hidden or deleted projects',async t=>{
  const f=await fixture(t);await f.save({expiresAt:'2026-10-12'});for(const user of ['reviewer','viewer','admin','other']){assert.equal(tasks(await f.workflow(user)).length,0);assert.equal(card(await f.health(user)).counts.targets,0);}assert.equal((await f.api(f.rightsPath,{user:'other'})).status,404);
  for(const stage of ['delivered','archived']){f.app.store.put('clientProjects',f.id,{...f.row(),stage});assert.equal(tasks(await f.workflow()).length,1);assert.equal(card(await f.health()).counts.targets,1);}for(const patch of [{hidden:true},{hidden:false,deleted:true},{deleted:false,active:false}]){f.app.store.put('clientProjects',f.id,{...f.row(),...patch});assert.equal(tasks(await f.workflow()).length,0);assert.equal(card(await f.health()).counts.targets,0);}
  f.app.store.put('clientProjects',f.id,{...f.row(),stage:'delivered',active:true,ownerId:f.users.other.id,teamId:'b'});assert.equal(tasks(await f.workflow()).length,0);assert.equal(tasks(await f.workflow('other')).length,1);assert.equal(card(await f.health('other')).counts.targets,1);f.app.store.put('users',f.users.other.id,{...f.users.other,active:false});assert.equal((await f.workflow('other')).status,401);assert.equal((await f.health('other')).status,401);
});

test('HTTP health reuses one rights read per request but observes changes and corrupt state on the next request',async t=>{
  const f=await fixture(t);await f.save({expiresAt:'2026-10-12'});const get=f.app.store.get.bind(f.app.store);let reads=0;f.app.store.get=(kind,id)=>{if(kind==='clientRights')reads++;return get(kind,id);};let result=await f.health();assert.equal(result.status,200);assert.equal(reads,1);reads=0;await f.health();assert.equal(reads,1);const envelope=get('clientRights',f.id);f.app.store.put('clientRights',f.id,{...envelope,ciphertext:'bad-cipher'});result=await f.health();assert.equal(card(result).status,'partial');assert.equal(card(result).checkedAt,null);assert.equal((await f.workflow()).status,500);assert.doesNotMatch(JSON.stringify(result.data),/bad-cipher|HTTP-PRIVATE-RIGHTS-EVIDENCE/);
});
