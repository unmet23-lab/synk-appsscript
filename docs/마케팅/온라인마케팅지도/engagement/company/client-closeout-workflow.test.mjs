import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';
import {createWeeklySummaryService} from './weekly-summary.mjs';

const BASE='2026-10-06T03:00:00.000Z';
async function fixture(t){
  t.mock.timers.enable({apis:['Date'],now:Date.parse(BASE)});
  const directory=await mkdtemp(join(tmpdir(),'synk-closeout-flow-'));let store=new Store(directory),projects,workflow,weekly;
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-closeout-flow-')));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['peer','member','a'],['reviewer','member','a'],['manager','manager','a'],['other','member','b'],['viewer','viewer','a']])users[name]=store.createUser({name,email:name+'@closeout-flow.test',role,teamId});
  function build(){projects=createClientProjectsService({store});workflow=createClientWorkflowService({store,clientProjects:projects});weekly=createWeeklySummaryService({store,clientProjects:projects,clientWorkflow:workflow});}build();
  let p=projects.save(users.owner,{title:'합성 수령 확인',customerName:'합성 고객',reviewerId:users.reviewer.id,internalNotes:'PRIVATE-INTERNAL',contact:'PRIVATE-CONTACT'}).project;
  p=projects.addVersion(users.owner,p.id,{revision:p.revision,kind:'preview',label:'승인 시안',url:'https://example.test/preview.mp4'}).project;
  const invite=projects.invite(users.owner,p.id,{revision:p.revision}).invite;
  const open=()=>projects.open(invite),read=()=>projects.project(users.owner,p.id),view=()=>projects.workspace(users.owner).projects.find(x=>x.id===p.id);
  let customer=open();projects.customerAction(customer.session,customer.csrf,{revision:read().revision,action:'approve',versionId:read().versions.at(-1).id});
  p=projects.addVersion(users.owner,p.id,{revision:read().revision,kind:'final',label:'최종 영상',url:'https://example.test/final.mp4',guide:'합성 사용 안내'}).project;
  const act=(action,extra={})=>projects.closeout(users.owner,p.id,{revision:read().revision,deliveryKey:view().closeout.deliveryKey,action,...extra});
  const confirm=()=>{const c=open();return projects.customerAction(c.session,c.csrf,{revision:read().revision,deliveryKey:view().closeout.deliveryKey,action:'confirm_delivery',confirmed:true});};
  const save=extra=>projects.save(users.owner,{...read(),...extra,revision:read().revision},p.id);
  return {users,id:p.id,read,view,act,confirm,save,open,get store(){return store;},get projects(){return projects;},get workflow(){return workflow;},get weekly(){return weekly;},setTime(value){t.mock.timers.setTime(Date.parse(value));},restart(){store.close();store=new Store(directory);build();}};
}
const related=f=>f.workflow.workspace(f.users.owner).items.filter(x=>['delivery_receipt','client_closeout'].includes(x.kind));
const section=(data,id)=>data.sections.find(s=>s.id===id).items;

test('receipt reminder appears on its KST date once and survives restart without duplicate tasks',async t=>{
  const f=await fixture(t);assert.equal(related(f).length,0);
  f.setTime('2026-10-08T14:59:59.999Z');assert.equal(related(f).length,0);
  f.setTime('2026-10-08T15:00:00.000Z');const pending=related(f);assert.equal(pending.length,1);assert.equal(pending[0].kind,'delivery_receipt');assert.equal(pending[0].dueDate,'2026-10-09');assert.equal(new URL(pending[0].href,'https://example.test').searchParams.get('closeout'),'1');
  assert.deepEqual(related(f),pending);f.restart();assert.deepEqual(related(f),pending);
  f.act('set_reminder',{remindAfterDays:0});assert.equal(related(f).length,0);f.act('set_reminder',{remindAfterDays:5});assert.equal(related(f).length,0);
  f.setTime('2026-10-10T15:00:00.000Z');assert.equal(related(f).length,1);
});

test('only the current owner receives receipt and closure work; reassignment and archive remove it',async t=>{
  const f=await fixture(t);f.setTime('2026-10-09T03:00:00Z');assert.equal(related(f).length,1);
  for(const key of ['reviewer','peer','manager','other','viewer'])assert.equal(f.workflow.workspace(f.users[key]).items.filter(x=>x.kind==='delivery_receipt').length,0);
  f.projects.save(f.users.manager,{...f.read(),ownerId:f.users.peer.id,revision:f.read().revision},f.id);assert.equal(related(f).length,0);assert.equal(f.workflow.workspace(f.users.peer).items.filter(x=>x.kind==='delivery_receipt').length,1);
  const p=f.projects.project(f.users.peer,f.id);f.projects.save(f.users.peer,{...p,revision:p.revision,stage:'archived'},p.id);assert.equal(f.workflow.workspace(f.users.peer).items.length,0);
});

test('customer confirmation replaces receipt reminder with explicit closeout work and closing clears it',async t=>{
  const f=await fixture(t);f.confirm();let items=related(f);assert.equal(items.length,1);assert.equal(items[0].kind,'client_closeout');
  f.act('close',{confirmed:true});assert.equal(related(f).length,0);assert.equal(f.read().stage,'delivered');assert.ok(f.projects.read(f.open().session).project.versions.some(v=>v.kind==='final'));
});

test('pending questions and planned contact keep closure blocked until existing workflow is completed',async t=>{
  const f=await fixture(t),customer=f.open();f.projects.customerAction(customer.session,customer.csrf,{revision:f.read().revision,action:'support',text:'사용 안내 질문'});f.confirm();assert.equal(related(f).length,0);
  const question=f.read().messages.find(x=>x.action==='support');f.workflow.update(f.users.owner,{projectId:f.id,revision:f.read().revision,messageId:question.id,action:'complete'});assert.equal(related(f)[0].kind,'client_closeout');
  f.save({nextContactDate:'2026-10-09'});assert.equal(related(f).length,0);f.projects.completeFollowUp(f.users.owner,f.id,{revision:f.read().revision,note:'질문을 정리했습니다.',disposition:'done'});assert.equal(related(f)[0].kind,'client_closeout');
});

test('weekly records distinguish receipt and explicit closure from delivery, omit private content, and show reopening',async t=>{
  const f=await fixture(t);f.confirm();f.act('close',{confirmed:true});f.setTime('2026-10-12T00:00:00Z');let report=f.weekly.get(f.users.owner),completed=section(report,'completed');
  assert.equal(completed.filter(x=>x.kind==='client_delivery_receipt').length,1);assert.equal(completed.filter(x=>x.kind==='client_closeout').length,1);assert.equal(completed.find(x=>x.kind==='client_closeout').statusLabel,'프로젝트 마감');assert.doesNotMatch(JSON.stringify(report),/PRIVATE-INTERNAL|PRIVATE-CONTACT/);
  f.save({nextContactDate:'2026-10-13'});report=f.weekly.get(f.users.owner);assert.match(section(report,'completed').find(x=>x.kind==='client_closeout').statusLabel,/현재 다시 확인/);
  for(const user of [f.users.peer,f.users.other,f.users.manager,f.users.viewer])assert.equal(section(f.weekly.get(user),'completed').filter(x=>x.kind==='client_closeout').length,0);
});

test('weekly upcoming and attention derive current receipt dates and disappear on explicit receipt',async t=>{
  const f=await fixture(t);f.act('set_reminder',{remindAfterDays:8});f.setTime('2026-10-12T00:00:00Z');let report=f.weekly.get(f.users.owner);assert.equal(section(report,'upcoming').filter(x=>x.kind==='client_receipt_due').length,1);assert.equal(section(report,'attention').filter(x=>x.kind==='delivery_receipt').length,0);
  f.act('set_reminder',{remindAfterDays:3});report=f.weekly.get(f.users.owner);assert.equal(section(report,'attention').filter(x=>x.kind==='delivery_receipt').length,1);f.confirm();report=f.weekly.get(f.users.owner);assert.equal(section(report,'attention').filter(x=>x.kind==='delivery_receipt').length,0);assert.equal(section(report,'upcoming').filter(x=>x.kind==='client_receipt_due').length,0);
});
