import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';

const draft={title:'왕복 검증 프로젝트',customerName:'합성 고객',summary:'시안 수정',internalNotes:'staff-secret'};
const rejects=(run,status)=>assert.throws(run,error=>error.status===status);
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-client-workflow-'));let store=new Store(directory);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['manager','manager','a'],['outsider','member','b'],['admin','admin',null],['viewer','viewer','a']])users[name]=store.createUser({name,email:name+'@workflow.example',role,teamId});
  let now='2026-10-08T03:00:00.000Z',projects,workflow;
  function services(){projects=createClientProjectsService({store,clock:()=>now});workflow=createClientWorkflowService({store,clientProjects:projects,clock:()=>now});}services();
  let row=projects.save(users.owner,{...draft,reviewerId:users.reviewer.id}).project;
  const customer=projects.open(projects.invite(users.owner,row.id,{revision:row.revision}).invite);
  const read=()=>projects.project(users.owner,row.id);
  const version=label=>{now=new Date(Date.parse(now)+1000).toISOString();return projects.addVersion(users.owner,row.id,{revision:read().revision,label,kind:'preview',url:'https://files.example/'+label}).project.versions.at(-1);};
  const action=(action,extra={})=>projects.customerAction(customer.session,customer.csrf,{revision:read().revision,action,...extra});
  const update=(user,messageId,action,extra={})=>workflow.update(users[user],{projectId:row.id,messageId,action,revision:read().revision,...extra});
  return {users,customer,read,version,action,update,get store(){return store},get projects(){return projects},get workflow(){return workflow},restart(){store.close();store=new Store(directory);services();}};
}

test('customer request projects exactly once with scene link, survives restart, and follows reassignment',async t=>{
  const f=await fixture(t),v=f.version('v1');f.action('feedback',{versionId:v.id,text:'12초 자막 수정',seconds:12});
  const item=f.workflow.workspace(f.users.owner).items.find(item=>item.kind==='feedback');
  assert.equal(item.seconds,12);assert.equal(new URL(item.href,'https://company.example').searchParams.get('message'),item.messageId);
  assert.equal(f.workflow.workspace(f.users.owner).items.filter(row=>row.id===item.id&&row.kind==='feedback').length,1);
  f.restart();assert.equal(f.workflow.workspace(f.users.owner).items.find(x=>x.kind==='feedback').id,item.id);
  const current=f.read();f.projects.save(f.users.manager,{...draft,revision:current.revision,ownerId:f.users.peer.id,reviewerId:f.users.reviewer.id},current.id);
  assert.equal(f.workflow.workspace(f.users.owner).items.length,0);assert.equal(f.workflow.workspace(f.users.peer).items.find(x=>x.kind==='feedback').id,item.id);
  rejects(()=>f.workflow.update(f.users.owner,{projectId:current.id,messageId:item.messageId,action:'start',revision:current.revision+1}),404);
});

test('feedback passes revision, internal reviewer, correction and customer approval gates before delivery',async t=>{
  const f=await fixture(t),v1=f.version('v1');f.action('feedback',{versionId:v1.id,text:'수정 요청',seconds:12});
  const messageId=f.read().messages.at(-1).id;
  f.update('owner',messageId,'start');rejects(()=>f.update('owner',messageId,'submit_review',{versionId:v1.id}),409);
  const v2=f.version('v2');f.update('owner',messageId,'submit_review',{versionId:v2.id,note:'자막 수정'});
  assert.equal(f.workflow.workspace(f.users.reviewer).items[0].group,'review');
  rejects(()=>f.update('owner',messageId,'accept'),409);rejects(()=>f.update('reviewer',messageId,'request_changes'),400);
  f.update('reviewer',messageId,'request_changes',{note:'여백을 더 주세요.'});
  assert.equal(f.workflow.workspace(f.users.owner).items.find(x=>x.messageId===messageId).group,'reply');
  rejects(()=>f.update('owner',messageId,'submit_review',{versionId:v2.id}),409);
  const v3=f.version('v3');f.update('owner',messageId,'submit_review',{versionId:v3.id});f.update('reviewer',messageId,'accept');
  assert.equal(f.read().versions.at(-1).approvedAt,null,'internal acceptance must never become customer approval');
  assert.equal(f.workflow.workspace(f.users.owner).items.find(x=>x.messageId===messageId).status,'waiting_customer');
  rejects(()=>f.action('approve',{versionId:v2.id}),409);f.action('approve',{versionId:v3.id});
  assert.equal(f.read().messages.find(x=>x.id===messageId).resolved,true);assert.match(f.read().nextStep,/최종본과 사용 안내/);
  const after=f.workflow.workspace(f.users.owner).items;assert.equal(after.some(x=>x.group==='waiting'),false);assert.equal(after[0].kind,'delivery');
  f.projects.addVersion(f.users.owner,f.read().id,{revision:f.read().revision,label:'final',kind:'final',url:'https://files.example/final',guide:'최종 사용 안내'});
  assert.equal(f.workflow.workspace(f.users.owner).items.length,0);
});

test('stale replay, private/customer boundaries, disabled role and cross-team reviewer are enforced',async t=>{
  const f=await fixture(t);f.action('support',{text:'후속 문의'});const messageId=f.read().messages.at(-1).id,revision=f.read().revision;
  const input={projectId:f.read().id,messageId,revision,action:'start'};f.workflow.update(f.users.owner,input);rejects(()=>f.workflow.update(f.users.owner,input),409);
  for(const user of ['peer','outsider','viewer','manager'])assert.equal(f.workflow.workspace(f.users[user]).items.length,0);
  rejects(()=>f.workflow.update(f.users.manager,{...input,revision:revision+1}),403);
  rejects(()=>f.workflow.workspace({id:f.customer.session}),401);
  f.update('owner',messageId,'complete',{note:'PRIVATE-WORKFLOW-NOTE'});
  assert.doesNotMatch(JSON.stringify(f.projects.read(f.customer.session)),/workflow|reviewerId|PRIVATE-WORKFLOW-NOTE|staff-secret/);
  f.update('owner',messageId,'reopen');assert.equal(f.workflow.workspace(f.users.owner).items[0].status,'open');
  const current=f.read();rejects(()=>f.projects.save(f.users.owner,{...draft,revision:current.revision,reviewerId:f.users.outsider.id},current.id),403);
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});rejects(()=>f.workflow.workspace(f.users.owner),401);
});

test('new preview invalidates previous approval and new reviewer alone receives pending review',async t=>{
  const f=await fixture(t),v1=f.version('v1');f.action('feedback',{versionId:v1.id,text:'새 결과 확인'});const messageId=f.read().messages.at(-1).id,v2=f.version('v2');
  f.update('owner',messageId,'submit_review',{versionId:v2.id});const current=f.read();
  f.projects.save(f.users.manager,{...draft,revision:current.revision,reviewerId:f.users.peer.id},current.id);
  assert.equal(f.workflow.workspace(f.users.reviewer).items.length,0);assert.equal(f.workflow.workspace(f.users.peer).items[0].group,'review');
  rejects(()=>f.update('reviewer',messageId,'accept'),404);
  f.update('peer',messageId,'accept');f.action('approve',{versionId:v2.id});assert.equal(f.workflow.workspace(f.users.owner).items[0].kind,'delivery');
  f.version('v3');assert.equal(f.workflow.workspace(f.users.owner).items.some(x=>x.kind==='delivery'),false);assert.equal(f.workflow.workspace(f.users.owner).items[0].kind,'customer_review');
});

test('reviewer grant cannot mutate source ownership, invitations or media; source resolve/final cannot bypass outstanding feedback',async t=>{
  const f=await fixture(t),v1=f.version('v1');f.action('feedback',{versionId:v1.id,text:'내부 검토가 필요한 수정'});const messageId=f.read().messages.at(-1).id;
  let row=f.read();
  rejects(()=>f.projects.save(f.users.reviewer,{...draft,revision:row.revision,ownerId:f.users.reviewer.id,reviewerId:null},row.id),403);
  rejects(()=>f.projects.invite(f.users.reviewer,row.id,{revision:row.revision}),403);
  rejects(()=>f.projects.addVersion(f.users.reviewer,row.id,{revision:row.revision,kind:'preview',label:'unauthorized',url:'https://files.example/unauthorized'}),403);
  rejects(()=>f.projects.resolveMessage(f.users.owner,row.id,messageId,{revision:row.revision}),409);
  const v2=f.version('v2');f.update('owner',messageId,'submit_review',{versionId:v2.id});f.action('approve',{versionId:v2.id});row=f.read();
  assert.ok(row.versions.at(-1).approvedAt,'customer decision is recorded separately even before internal acceptance');
  assert.equal(f.workflow.workspace(f.users.owner).items.some(item=>item.kind==='delivery'),false);
  rejects(()=>f.projects.addVersion(f.users.owner,row.id,{revision:row.revision,kind:'final',label:'final',url:'https://files.example/final',guide:'사용 안내'}),409);
  rejects(()=>f.projects.save(f.users.owner,{...draft,revision:row.revision,stage:'delivered'},row.id),409);
  f.update('reviewer',messageId,'accept');assert.equal(f.workflow.workspace(f.users.owner).items[0].kind,'delivery');
  row=f.read();f.projects.addVersion(f.users.owner,row.id,{revision:row.revision,kind:'final',label:'final',url:'https://files.example/final',guide:'사용 안내'});
});

test('ordinary message capacity cannot remove outstanding feedback or bypass the assigned review',async t=>{
  const f=await fixture(t),v1=f.version('v1');f.action('feedback',{versionId:v1.id,text:'보존해야 할 수정 요청'});
  const messageId=f.read().messages.at(-1).id,v2=f.version('v2');
  f.update('owner',messageId,'submit_review',{versionId:v2.id});f.action('approve',{versionId:v2.id});
  for(let i=0;i<299;i++)f.projects.message(f.users.owner,f.read().id,{revision:f.read().revision,text:'내부 검토 참고 '+i,visibility:'internal'});
  let row=f.read();const originalRequest=row.messages.find(message=>message.id===messageId);
  assert.equal(row.messages.length,301);assert.equal(originalRequest.resolved,false);assert.equal(originalRequest.workflow.status,'review');
  rejects(()=>f.projects.message(f.users.owner,row.id,{revision:row.revision,text:'history must not rotate'}),409);
  rejects(()=>f.projects.addVersion(f.users.owner,row.id,{revision:row.revision,kind:'final',label:'final',url:'https://files.example/final',guide:'사용 안내'}),409);
  assert.equal(f.workflow.workspace(f.users.reviewer).items.filter(item=>item.messageId===messageId).length,1);
  f.update('reviewer',messageId,'accept');row=f.read();
  assert.equal(row.messages.find(message=>message.id===messageId).resolved,true);
  row=f.projects.addVersion(f.users.owner,row.id,{revision:row.revision,kind:'final',label:'final',url:'https://files.example/final',guide:'사용 안내'}).project;
  assert.equal(row.stage,'delivered');assert.equal(row.messages.length,301);assert.ok(row.messages.some(message=>message.id===messageId));
});
