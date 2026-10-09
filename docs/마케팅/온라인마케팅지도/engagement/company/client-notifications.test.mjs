import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';
import {createClientNotificationsService} from './client-notifications.mjs';
const rejects=(run,status)=>assert.throws(run,error=>error.status===status);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const draft={title:'알림 왕복 합성 프로젝트',customerName:'합성 고객',summary:'고객 시안 검토',internalNotes:'PRIVATE-PROJECT'};
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-client-notifications-'));let store=new Store(directory),projects,workflow,notifications;
  t.after(async()=>{notifications.close();await tick();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['other','member','b'],['manager','manager','a'],['viewer','viewer','a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@notifications.example',role,teamId});
  let now='2026-10-08T08:00:00.000Z';const changes=[];
  function services(){projects=createClientProjectsService({store,clock:()=>now});workflow=createClientWorkflowService({store,clientProjects:projects,clock:()=>now});notifications=createClientNotificationsService({store,clientProjects:projects,clientWorkflow:workflow,clock:()=>now,onChange:ids=>changes.push(ids)});}services();
  let project=projects.save(users.owner,{...draft,reviewerId:users.reviewer.id}).project;
  const customer=projects.open(projects.invite(users.owner,project.id,{revision:project.revision}).invite);
  const row=()=>store.get('clientProjects',project.id),advance=()=>{now=new Date(Date.parse(now)+1000).toISOString();};
  const version=label=>{advance();return projects.addVersion(users.owner,project.id,{revision:row().revision,label,kind:'preview',url:'https://files.example/'+label}).project.versions.at(-1);};
  const customerAction=(action,extra={})=>{advance();return projects.customerAction(customer.session,customer.csrf,{revision:row().revision,action,...extra});};
  const update=(name,messageId,action,extra={})=>{advance();return workflow.update(users[name],{projectId:project.id,messageId,action,revision:row().revision,...extra});};
  await tick();changes.length=0;
  return {users,changes,customer,row,version,customerAction,update,get store(){return store},get projects(){return projects},get workflow(){return workflow},get notifications(){return notifications},async restart(){notifications.close();await tick();store.close();store=new Store(directory);services();}};
}

test('real customer feedback creates one durable event and metadata-only callback; GET is pure and replay creates no duplicate',async t=>{
  const f=await fixture(t),version=f.version('v1');await tick();f.changes.length=0;
  const previous=f.row();f.customerAction('feedback',{versionId:version.id,text:'12초 수정',seconds:12});await tick();
  const first=f.notifications.list(f.users.owner),notification=first.notifications.find(item=>item.type==='customer_feedback');
  assert.ok(notification);assert.match(notification.id,/^client:/);assert.equal(notification.unread,true);assert.equal(notification.kind,'client_workflow');assert.equal(notification.message,null);
  const link=new URL(notification.href,'https://company.example');assert.equal(link.searchParams.get('version'),version.id);assert.equal(link.searchParams.get('message'),notification.messageId);assert.equal(link.searchParams.get('seconds'),'12');
  assert.deepEqual(f.changes,[[f.users.owner.id,f.users.reviewer.id]]);
  assert.equal(JSON.stringify(f.changes).includes('12초'),false);
  const before=JSON.stringify(f.row()),readsBefore=f.store.all('clientNotificationReads').length;
  for(let index=0;index<3;index++){assert.equal(f.notifications.unreadCount(f.users.owner),first.unreadCount);assert.equal(f.notifications.list(f.users.owner).notifications.find(item=>item.type==='customer_feedback').id,notification.id);}
  assert.equal(JSON.stringify(f.row()),before);assert.equal(f.store.all('clientNotificationReads').length,readsBefore);
  rejects(()=>f.projects.customerAction(f.customer.session,f.customer.csrf,{revision:previous.revision,action:'feedback',versionId:version.id,text:'12초 수정',seconds:12}),409);
  await tick();assert.equal(f.changes.length,1);assert.equal(f.notifications.list(f.users.owner).notifications.filter(item=>item.type==='customer_feedback').length,1);
  await f.restart();assert.equal(f.notifications.list(f.users.owner).notifications.find(item=>item.type==='customer_feedback').id,notification.id);
});

test('review request, correction, acceptance and exact-version approval notify current participants without leaking internal records',async t=>{
  const f=await fixture(t),v1=f.version('v1');f.customerAction('feedback',{versionId:v1.id,text:'자막 수정'});const messageId=f.row().messages.at(-1).id;
  const v2=f.version('v2');f.update('owner',messageId,'submit_review',{versionId:v2.id,note:'PRIVATE-SUBMIT'});
  let review=f.notifications.list(f.users.reviewer).notifications.find(item=>item.type==='review_requested');assert.equal(review.versionId,v2.id);
  assert.equal(f.notifications.list(f.users.owner).notifications.some(item=>item.type==='review_requested'),false);
  f.update('reviewer',messageId,'request_changes',{note:'PRIVATE-REVIEW'});assert.equal(f.notifications.list(f.users.owner).notifications.find(item=>item.type==='changes_requested').text,'PRIVATE-REVIEW');
  const v3=f.version('v3');f.update('owner',messageId,'submit_review',{versionId:v3.id});f.update('reviewer',messageId,'accept');
  assert.equal(f.notifications.list(f.users.owner).notifications.find(item=>item.type==='review_accepted').versionId,v3.id);
  f.customerAction('approve',{versionId:v3.id});
  const approval=f.notifications.list(f.users.owner).notifications.find(item=>item.type==='customer_approval');assert.equal(approval.versionId,v3.id);assert.ok(approval.href.includes('version='+v3.id));
  assert.equal(f.notifications.list(f.users.owner).notifications.filter(item=>item.createdAt===approval.createdAt).length,1,'one customer approval must not also notify completion of every linked correction');
  assert.doesNotMatch(JSON.stringify(f.projects.read(f.customer.session)),/notificationEvents|clientNotificationReads|audiences|PRIVATE-REVIEW|PRIVATE-SUBMIT|PRIVATE-PROJECT/);
  assert.equal(f.projects.workspace(f.users.owner).projects[0].notificationEvents,undefined);
  await tick();assert.ok(f.changes.length>=6);assert.ok(f.changes.every(ids=>ids.every(id=>typeof id==='string')));
});

test('read and read-all are explicit, idempotent, persisted and scoped to current authorized recipient',async t=>{
  const f=await fixture(t);f.customerAction('support',{text:'일정 문의'});f.customerAction('support',{text:'납품 문의'});const rows=f.notifications.list(f.users.owner).notifications;
  assert.equal(rows.length,2);assert.equal(f.notifications.unreadCount(f.users.owner),2);
  f.notifications.read(f.users.owner,rows[0].id);const recorded=f.store.all('clientNotificationReads');assert.equal(recorded.length,1);
  f.notifications.read(f.users.owner,rows[0].id);assert.equal(f.store.all('clientNotificationReads').length,1);assert.deepEqual(f.store.all('clientNotificationReads'),recorded);
  rejects(()=>f.notifications.read(f.users.peer,rows[1].id),404);assert.equal(f.notifications.list(f.users.peer).notifications.length,0);
  await f.restart();assert.equal(f.notifications.unreadCount(f.users.owner),1);assert.ok(f.notifications.list(f.users.owner).notifications.find(item=>item.id===rows[0].id).readAt);
  assert.equal(f.notifications.readAll(f.users.owner).count,1);assert.equal(f.notifications.readAll(f.users.owner).count,0);assert.equal(f.notifications.unreadCount(f.users.owner),0);
  assert.equal(f.notifications.list(f.users.owner,{unreadOnly:true}).total,0);assert.equal(f.notifications.list(f.users.owner,{limit:1}).notifications.length,1);
});

test('reassignment retracts previous badges and grants current owner/reviewer; demotion and deactivation are rechecked',async t=>{
  const f=await fixture(t),v1=f.version('v1');f.customerAction('feedback',{versionId:v1.id,text:'담당 변경 전 요청'});const messageId=f.row().messages.at(-1).id,v2=f.version('v2');f.update('owner',messageId,'submit_review',{versionId:v2.id});
  const oldOwner=f.notifications.list(f.users.owner).notifications.find(item=>item.type==='customer_feedback'),oldReview=f.notifications.list(f.users.reviewer).notifications.find(item=>item.type==='review_requested');
  await tick();f.changes.length=0;let row=f.row();f.projects.save(f.users.manager,{...draft,revision:row.revision,ownerId:f.users.peer.id,reviewerId:f.users.manager.id},row.id);await tick();
  assert.ok(f.changes[0].includes(f.users.owner.id));assert.ok(f.changes[0].includes(f.users.reviewer.id));assert.ok(f.changes[0].includes(f.users.peer.id));assert.ok(f.changes[0].includes(f.users.manager.id));
  assert.equal(f.notifications.unreadCount(f.users.owner),0);assert.equal(f.notifications.unreadCount(f.users.reviewer),0);rejects(()=>f.notifications.read(f.users.owner,oldOwner.id),404);
  assert.equal(f.notifications.list(f.users.peer).notifications.find(item=>item.type==='customer_feedback').id,oldOwner.id);assert.equal(f.notifications.list(f.users.manager).notifications.find(item=>item.type==='review_requested').id,oldReview.id);
  for(const name of ['admin','other','viewer'])assert.equal(f.notifications.list(f.users[name]).notifications.length,0);
  f.store.put('users',f.users.manager.id,{...f.users.manager,role:'viewer'});assert.equal(f.notifications.unreadCount(f.users.manager),0);
  f.store.put('users',f.users.peer.id,{...f.users.peer,active:false});rejects(()=>f.notifications.list(f.users.peer),401);
});

test('revoked customer cannot generate events and missing version/message/project hides stale links',async t=>{
  const f=await fixture(t),v1=f.version('v1');f.customerAction('feedback',{versionId:v1.id,text:'원본 확인'});const item=f.notifications.list(f.users.owner).notifications.find(item=>item.type==='customer_feedback');let row=f.row();
  f.projects.revoke(f.users.owner,row.id,{revision:row.revision});const eventCount=f.row().notificationEvents.length;
  rejects(()=>f.customerAction('support',{text:'철회 이후'}),401);assert.equal(f.row().notificationEvents.length,eventCount);
  row=f.row();f.store.put('clientProjects',row.id,{...row,versions:[]});assert.equal(f.notifications.list(f.users.owner).notifications.some(n=>n.id===item.id),false);rejects(()=>f.notifications.read(f.users.owner,item.id),404);
  f.store.put('clientProjects',row.id,{...row,messages:[]});assert.equal(f.notifications.list(f.users.owner).notifications.some(n=>n.id===item.id),false);
  f.store.remove('clientProjects',row.id);assert.equal(f.notifications.unreadCount(f.users.owner),0);
});

test('failed source transaction rolls back event together and emits no uncommitted change',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row());await tick();f.changes.length=0;
  assert.throws(()=>f.store.transaction(()=>{f.customerAction('support',{text:'rollback message'});throw new Error('synthetic rollback');}),/synthetic rollback/);
  await tick();assert.equal(JSON.stringify(f.row()),before);assert.equal(f.notifications.unreadCount(f.users.owner),0);assert.deepEqual(f.changes,[]);
});
