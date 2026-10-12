import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';
import {clientTaskRecheckFingerprint,createClientTaskRechecksService} from './client-task-rechecks.mjs';

const rejects=(run,status)=>assert.throws(run,error=>error.status===status);
const draft={title:'개인 다시 확인 시험',customerName:'합성 고객',dueDate:'2026-10-13',internalNotes:'원래 비공개 메모'};
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-task-rechecks-'));let store=new Store(directory),now='2026-10-11T15:30:00.000Z',projects,workflow;
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['manager','manager','a'],['outsider','member','b'],['admin','admin',null],['viewer','viewer','a']])users[name]=store.createUser({name,email:name+'@recheck.example',role,teamId});
  function services(){projects=createClientProjectsService({store,clock:()=>now});workflow=createClientWorkflowService({store,clientProjects:projects,clock:()=>now});}services();
  const row=projects.save(users.owner,{...draft,reviewerId:users.reviewer.id}).project;
  const customer=projects.open(projects.invite(users.owner,row.id,{revision:row.revision}).invite);
  const read=()=>projects.project(users.owner,row.id);
  const action=(action,extra={})=>projects.customerAction(customer.session,customer.csrf,{revision:read().revision,action,...extra});
  const ws=(name='owner')=>workflow.workspace(users[name]);
  const defer=(item,date='2026-10-19',name='owner')=>workflow.recheck(users[name],{action:'defer',itemId:item.id,date,fingerprint:ws(name).rechecks[item.id].fingerprint});
  const save=extra=>projects.save(users.owner,{...draft,reviewerId:users.reviewer.id,revision:read().revision,...extra},row.id);
  return {users,customer,read,action,ws,defer,save,setNow:value=>{now=value;},get store(){return store},get projects(){return projects},get workflow(){return workflow},restart(){store.close();store=new Store(directory);services();}};
}

test('personal recheck keeps authoritative tasks, groups, deadlines and customer records intact; reload persists',async t=>{
  const f=await fixture(t);f.action('support',{text:'이번 주 확인할 합성 문의'});
  const before=f.ws(),item=before.items[0],source=f.store.all('clientProjects'),after=f.defer(item);
  assert.equal(after.recheckToday,'2026-10-12');assert.deepEqual(after.items,before.items);assert.deepEqual(after.projectGroups,before.projectGroups);
  assert.deepEqual(after.todayItems,[]);assert.deepEqual(after.todayProjectGroups,[]);assert.deepEqual(after.deferredItems,[item]);
  assert.deepEqual(after.rechecks[item.id],{fingerprint:before.rechecks[item.id].fingerprint,state:'deferred',date:'2026-10-19'});
  assert.deepEqual(f.store.all('clientProjects'),source);
  assert.doesNotMatch(JSON.stringify(f.store.all('clientTaskRechecks')),/이번 주|비공개|고객|title|text|note/);
  assert.doesNotMatch(JSON.stringify(f.projects.read(f.customer.session)),/recheck|deferred|fingerprint/);
  f.restart();assert.equal(f.ws().deferredItems[0].id,item.id);
});

test('read-only projection is write-free; due KST date reappears without a timer or client clock',async t=>{
  const f=await fixture(t);f.save({dueDate:''});f.action('support',{text:'날짜 시험'});const item=f.ws().items[0];f.defer(item,'2026-10-13');
  const original=f.store.put.bind(f.store),saved=f.store.get('clientTaskRechecks',f.users.owner.id);let writes=0;f.store.put=(...args)=>{writes++;return original(...args)};
  f.setNow('2026-10-12T14:59:59.999Z');assert.equal(f.ws().deferredItems.length,1);
  f.setNow('2026-10-12T15:00:00.000Z');const due=f.ws();assert.equal(due.recheckToday,'2026-10-13');assert.equal(due.todayItems[0].id,item.id);assert.equal(due.rechecks[item.id].state,'due');assert.equal(due.deferredItems.length,0);
  assert.equal(writes,0);assert.deepEqual(f.store.get('clientTaskRechecks',f.users.owner.id),saved);
});

test('newly overdue original deadline resurfaces and can be consciously deferred again',async t=>{
  const f=await fixture(t);f.action('support',{text:'기한 확인'});const item=f.ws().items[0],oldFingerprint=f.ws().rechecks[item.id].fingerprint;f.defer(item,'2026-10-20');
  f.setNow('2026-10-13T15:00:00.000Z');let state=f.ws();assert.equal(state.rechecks[item.id].state,'overdue');assert.equal(state.todayItems.length,1);assert.equal(state.items[0].dueDate,'2026-10-13');
  rejects(()=>f.workflow.recheck(f.users.owner,{action:'defer',itemId:item.id,date:'2026-10-20',fingerprint:oldFingerprint}),409);
  state=f.defer(state.items[0],'2026-10-20');assert.equal(state.deferredItems.length,1);assert.equal(state.projectGroups[0].urgency,'overdue');
  f.setNow('2026-10-14T15:00:00.000Z');assert.equal(f.ws().deferredItems.length,1);
});

test('follow-up next step changes invalidate its date while title and general internal notes do not',async t=>{
  const f=await fixture(t);f.save({nextContactDate:'2026-10-12',nextStep:'합의 조건 확인'});let item=f.ws().items.find(value=>value.kind==='follow_up');assert.equal(item.nextStep,'합의 조건 확인');f.defer(item);
  f.save({nextContactDate:'2026-10-12',nextStep:'합의 조건 확인',title:'다른 프로젝트 제목',internalNotes:'일반 메모 수정'});assert.equal(f.ws().rechecks[item.id].state,'deferred');
  f.save({nextContactDate:'2026-10-12',nextStep:'최신 견적 확인'});assert.equal(f.ws().rechecks[item.id].state,'changed');
});

test('new customer request resurfaces previous deferred tasks in that project and stale fingerprint cannot hide it',async t=>{
  const f=await fixture(t);f.action('support',{text:'첫 문의'});const item=f.ws().items[0],old=f.ws().rechecks[item.id].fingerprint;f.defer(item);
  f.action('support',{text:'새 고객 요청'});const state=f.ws();assert.equal(state.items.length,2);assert.equal(state.todayItems.length,2);assert.equal(state.rechecks[item.id].state,'changed');assert.notEqual(state.rechecks[item.id].fingerprint,old);
  rejects(()=>f.workflow.recheck(f.users.owner,{action:'defer',itemId:item.id,date:'2026-10-20',fingerprint:old}),409);
});

test('new preview and task workflow changes resurface while unrelated project edits do not',async t=>{
  const f=await fixture(t);f.action('support',{text:'최신 상태 확인'});let state=f.ws(),item=state.items[0],fingerprint=state.rechecks[item.id].fingerprint;f.defer(item);
  f.save({title:'제목만 바꿈',summary:'일반 프로젝트 설명',internalNotes:'관련 없는 내부 메모'});state=f.ws();assert.equal(state.rechecks[item.id].fingerprint,fingerprint);assert.equal(state.deferredItems.length,1);
  f.workflow.update(f.users.owner,{projectId:f.read().id,messageId:item.messageId,revision:f.read().revision,action:'start'});state=f.ws();assert.equal(state.rechecks[item.id].state,'changed');assert.equal(state.todayItems.length,1);
  f.defer(state.items[0]);f.projects.addVersion(f.users.owner,f.read().id,{revision:f.read().revision,kind:'preview',label:'새 합성 시안',url:'https://files.example/preview'});state=f.ws();assert.equal(state.rechecks[item.id].state,'changed');assert.equal(state.deferredItems.length,0);
});

test('owner and reviewer control their own copy only and invalid accounts cannot write preferences',async t=>{
  const f=await fixture(t);
  const version=label=>f.projects.addVersion(f.users.owner,f.read().id,{revision:f.read().revision,kind:'preview',label,url:'https://files.example/'+label}).project.versions.at(-1);
  const v1=version('v1');f.action('feedback',{versionId:v1.id,text:'검토 요청'});const item=f.ws().items.find(item=>item.kind==='feedback'),v2=version('v2');
  f.workflow.update(f.users.owner,{projectId:f.read().id,messageId:item.messageId,revision:f.read().revision,action:'submit_review',versionId:v2.id});
  f.defer(f.ws().items.find(value=>value.id===item.id));assert.equal(f.ws('reviewer').todayItems.length,1);f.defer(f.ws('reviewer').items[0],'2026-10-18','reviewer');assert.equal(f.store.all('clientTaskRechecks').length,2);
  f.workflow.recheck(f.users.reviewer,{action:'restore',itemId:item.id});assert.equal(f.ws('reviewer').deferredItems.length,0);assert.equal(f.ws().deferredItems.filter(value=>value.id===item.id).length,1);
  for(const name of ['peer','manager','outsider','admin'])rejects(()=>f.workflow.recheck(f.users[name],{action:'restore',itemId:item.id}),404);
  rejects(()=>f.workflow.recheck(f.users.viewer,{action:'restore',itemId:item.id}),403);assert.deepEqual(f.ws('viewer').rechecks,{});
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});rejects(()=>f.workflow.recheck(f.users.owner,{action:'restore',itemId:item.id}),401);
});

test('reassignment, completed source and archival remove personal access without exposing dormant preferences',async t=>{
  const f=await fixture(t);f.action('support',{text:'소유권 변경 확인'});const item=f.ws().items[0];f.defer(item);
  f.projects.save(f.users.manager,{...draft,ownerId:f.users.peer.id,reviewerId:f.users.reviewer.id,revision:f.read().revision},f.read().id);
  assert.deepEqual(f.ws().items,[]);assert.deepEqual(f.ws().rechecks,{});assert.equal(f.ws('peer').todayItems.length,1);assert.equal(f.ws('peer').deferredItems.length,0);
  rejects(()=>f.workflow.recheck(f.users.owner,{action:'restore',itemId:item.id}),404);
  const current=f.projects.project(f.users.peer,item.projectId);f.workflow.update(f.users.peer,{projectId:current.id,messageId:item.messageId,revision:current.revision,action:'complete'});
  rejects(()=>f.workflow.recheck(f.users.peer,{action:'restore',itemId:item.id}),404);
  const row=f.projects.project(f.users.peer,item.projectId);f.projects.save(f.users.manager,{...draft,ownerId:f.users.peer.id,reviewerId:f.users.reviewer.id,revision:row.revision,stage:'archived'},row.id);
  assert.deepEqual(f.ws('peer').todayItems,[]);
});

test('strict date range, fingerprint and input validation leave personal state unchanged on rejection',async t=>{
  const f=await fixture(t);f.action('support',{text:'잘못된 입력 시험'});const item=f.ws().items[0],fingerprint=f.ws().rechecks[item.id].fingerprint,base={action:'defer',itemId:item.id,date:'2026-10-19',fingerprint};
  for(const date of ['','2026-10-12','2026-10-11','2026-02-30','2026-13-01','2027-10-13','2026-10-19T00:00:00Z',null,42])rejects(()=>f.workflow.recheck(f.users.owner,{...base,date}),400);
  for(const extra of [{userId:f.users.reviewer.id},{projectId:f.read().id},{action:'complete'},{itemId:''}])rejects(()=>f.workflow.recheck(f.users.owner,{...base,...extra}),400);
  rejects(()=>f.workflow.recheck(f.users.owner,{...base,fingerprint:undefined}),409);assert.equal(f.store.all('clientTaskRechecks').length,0);
  f.workflow.recheck(f.users.owner,{...base,date:'2027-10-12'});const before=f.store.get('clientTaskRechecks',f.users.owner.id);
  rejects(()=>f.workflow.recheck(f.users.owner,{action:'restore',itemId:item.id,date:'2026-10-19'}),400);assert.deepEqual(f.store.get('clientTaskRechecks',f.users.owner.id),before);
  f.workflow.recheck(f.users.owner,{action:'restore',itemId:item.id});assert.equal(f.store.all('clientTaskRechecks').length,0);assert.equal(f.ws().todayItems.length,1);
});

test('semantic fingerprints cover changed kickoff materials, schedule milestones, scene requests and file checks',()=>{
  const base={id:'client:p:x',kind:'client_kickoff',group:'next',status:'due',projectId:'p',dueDate:'2026-10-12'},row={id:'p',versions:[],messages:[],kickoff:{requirements:[{id:'a',status:'missing'}],checks:[]}};
  const first=clientTaskRecheckFingerprint(base,row),edited=structuredClone(row);edited.kickoff.requirements[0].id='b';assert.notEqual(clientTaskRecheckFingerprint(base,edited),first);
  for(const kind of ['client_kickoff','client_schedule','client_changes','scene_request','client_closeout','delivery_receipt'])assert.equal(clientTaskRecheckFingerprint({...base,kind},row),clientTaskRecheckFingerprint({...base,kind,updatedAt:'later',revision:55,title:'바뀐 제목'},{...row,updatedAt:'later',revision:55,internalNotes:'개인 메모'}));
  const delivery={...base,kind:'client_delivery_check'};assert.notEqual(clientTaskRecheckFingerprint(delivery,row,{fingerprint:'a',checks:[]}),clientTaskRecheckFingerprint(delivery,row,{fingerprint:'b',checks:[]}));
  const schedule={...base,kind:'client_schedule'},planned={...row,schedule:{targets:{preview:'2026-10-13'},milestones:[{id:'preview',targetDate:'2026-10-13',status:'upcoming'}],waiting:[]}};assert.notEqual(clientTaskRecheckFingerprint(schedule,planned),clientTaskRecheckFingerprint(schedule,{...planned,schedule:{...planned.schedule,milestones:[{id:'preview',targetDate:'2026-10-13',status:'due'}]}}));
});

test('newly overdue internal schedule target restores an item even without a project due date',()=>{
  const data=new Map(),store={get:(kind,id)=>data.get(kind+id),put:(kind,id,value)=>data.set(kind+id,value),remove:(kind,id)=>data.delete(kind+id)},service=createClientTaskRechecksService({store}),user={id:'u',role:'member'},item={id:'client:p:schedule',kind:'client_schedule',group:'next',status:'attention',projectId:'p',dueDate:''},row={id:'p',schedule:{milestones:[{id:'preview',targetDate:'2026-10-12',status:'due'}],waiting:[]}},context={items:[item],projects:[row],today:'2026-10-12'};
  const fingerprint=service.project(user,context).rechecks[item.id].fingerprint;service.update(user,{action:'defer',itemId:item.id,date:'2026-10-19',fingerprint},context);
  const changed=service.project(user,{...context,today:'2026-10-13'});assert.equal(changed.rechecks[item.id].state,'overdue');assert.equal(changed.todayItems.length,1);
});

test('project deadline changes and newly overdue agreements resurface tasks whose own due date is empty',()=>{
  for(const kind of ['client_changes','scene_request']){
    const data=new Map(),store={get:(kind,id)=>data.get(kind+id),put:(kind,id,value)=>data.set(kind+id,value),remove:(kind,id)=>data.delete(kind+id)},service=createClientTaskRechecksService({store}),user={id:'u',role:'member'},item={id:'client:p:'+kind,kind,group:'next',status:'pending',projectId:'p',dueDate:''},row={id:'p',dueDate:'2026-10-13'},context={items:[item],projects:[row],today:'2026-10-12'};
    const fingerprint=service.project(user,context).rechecks[item.id].fingerprint;
    service.update(user,{action:'defer',itemId:item.id,date:'2026-10-19',fingerprint},context);
    const late={...context,today:'2026-10-14'},overdue=service.project(user,late);assert.equal(overdue.rechecks[item.id].state,'overdue',kind);assert.equal(overdue.todayItems.length,1);
    rejects(()=>service.update(user,{action:'defer',itemId:item.id,date:'2026-10-19',fingerprint},late),409);
    service.update(user,{action:'defer',itemId:item.id,date:'2026-10-19',fingerprint:overdue.rechecks[item.id].fingerprint},late);assert.equal(service.project(user,late).deferredItems.length,1,'Already overdue can be consciously deferred');
    const rescheduled={...late,projects:[{...row,dueDate:'2026-10-20'}]},changed=service.project(user,rescheduled);assert.equal(changed.rechecks[item.id].state,'changed');assert.equal(changed.todayItems.length,1);assert.equal(changed.todayItems[0].dueDate,'');
  }
});
