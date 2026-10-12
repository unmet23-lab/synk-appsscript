import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService,clientFollowUpToday} from './client-projects.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';

const BASE='2026-10-12T14:59:59.000Z';
function fixture(t){
  // Store session expiry and the injected project clock must share the same
  // test time; otherwise real wall-clock time can expire these fixed-date cases.
  t.mock.timers.enable({apis:['Date'],now:new Date(BASE)});
  const directory=mkdtempSync(join(tmpdir(),'synk-client-follow-up-'));let store=new Store(directory),at=BASE,projects,workflow;
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['manager','manager','a'],['other','member','b'],['otherManager','manager','b'],['admin','admin',null],['viewer','viewer','a']])users[name]=store.createUser({name,email:name+'@follow-up.example',role,teamId});
  function services(){projects=createClientProjectsService({store,clock:()=>at});workflow=createClientWorkflowService({store,clientProjects:projects,clock:()=>at});}services();
  t.after(()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-client-follow-up-')));rmSync(directory,{recursive:true,force:true});});
  const create=(extra={})=>projects.save(users.owner,{title:'합성 고객 프로젝트',customerName:'합성 고객',nextStep:'납품한 자료의 사용 여부를 확인해 주세요.',nextContactDate:'2026-10-12',internalNotes:'PRIVATE-ORIGINAL',reviewerId:users.reviewer.id,...extra}).project;
  const current=row=>projects.project(users.owner,row.id);
  const finish=(row,extra={},user=users.owner)=>projects.completeFollowUp(user,row.id,{revision:store.get('clientProjects',row.id).revision,note:'PRIVATE-FOLLOW-UP-RESULT',disposition:'done',...extra}).project;
  const tasks=(user=users.owner)=>workflow.workspace(user).items.filter(item=>item.kind==='follow_up');
  return {users,create,current,finish,tasks,get projects(){return projects;},get workflow(){return workflow;},get store(){return store;},now(value){at=value;t.mock.timers.setTime(new Date(value).getTime());},restart(){store.close();store=new Store(directory);services();}};
}

test('KST midnight includes due and overdue contact dates without including future, archived or malformed dates',t=>{
  const f=fixture(t),today=f.create(),overdue=f.create({nextContactDate:'2026-10-11'}),future=f.create({nextContactDate:'2026-10-13'}),empty=f.create({nextContactDate:''}),archived=f.create({stage:'archived'}),invalid=f.create();f.store.put('clientProjects',invalid.id,{...f.store.get('clientProjects',invalid.id),nextContactDate:'2026-02-30'});
  assert.equal(clientFollowUpToday(BASE),'2026-10-12');assert.deepEqual(new Set(f.tasks().map(item=>item.projectId)),new Set([today.id,overdue.id]));assert.equal(f.tasks().find(item=>item.projectId===today.id).status,'due');assert.equal(f.tasks().find(item=>item.projectId===overdue.id).status,'overdue');
  f.now('2026-10-12T15:00:00.000Z');assert.equal(clientFollowUpToday('2026-10-12T15:00:00.000Z'),'2026-10-13');assert.deepEqual(new Set(f.tasks().map(item=>item.projectId)),new Set([today.id,overdue.id,future.id]));assert.equal(f.tasks().find(item=>item.projectId===future.id).status,'due');assert.ok(!f.tasks().some(item=>[empty.id,archived.id,invalid.id].includes(item.projectId)));
});

test('follow-up projects one stable owner-only task with exact navigation and current project context',t=>{
  const f=fixture(t),row=f.create(),item=f.tasks()[0],url=new URL(item.href,'https://workroom.example');assert.equal(item.title,'고객 후속 연락');assert.equal(item.group,'next');assert.equal(item.customerName,row.customerName);assert.equal(item.nextStep,row.nextStep);assert.equal(item.dueDate,'2026-10-12');assert.equal(url.searchParams.get('project'),row.id);assert.equal(url.searchParams.get('followUp'),'1');assert.equal(url.searchParams.get('section'),'clients');assert.equal(item.messageId,null);assert.deepEqual(item.actions,[]);
  for(const who of ['reviewer','peer','manager','other','otherManager','admin','viewer'])assert.equal(f.tasks(f.users[who]).length,0,who);assert.deepEqual(f.tasks(),[item]);
  const before=f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all();f.tasks();f.tasks();assert.deepEqual(f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),before);f.restart();assert.deepEqual(f.tasks(),[item]);assert.equal(f.store.all('messengerTasks').length,0);
});

test('completion atomically clears the contact date, preserves customer copy and writes internal actor evidence',async t=>{
  const f=fixture(t),row=f.create(),before=structuredClone(f.current(row)),events=[];f.projects.subscribeChanges(change=>events.push(change));f.now('2026-10-12T15:00:01.000Z');const after=f.finish(row);await Promise.resolve();
  assert.equal(after.nextContactDate,'');assert.equal(after.revision,before.revision+1);assert.equal(after.nextStep,before.nextStep);assert.equal(after.internalNotes,before.internalNotes);assert.deepEqual(after.messages,before.messages);assert.equal(f.tasks().length,0);assert.equal(after.followUpHistory.length,1);const event=after.followUpHistory[0];assert.equal(event.actor,f.users.owner.id);assert.equal(event.actorName,'owner');assert.equal(event.at,'2026-10-12T15:00:01.000Z');assert.equal(event.note,'PRIVATE-FOLLOW-UP-RESULT');assert.equal(event.previousContactDate,'2026-10-12');assert.equal(event.nextContactDate,'');assert.equal(event.disposition,'done');assert.equal(events.length,1);assert.ok(events[0].userIds.includes(f.users.owner.id));assert.match(after.history.at(-1).action,/후속 연락 결과 · 완료/);assert.doesNotMatch(after.history.at(-1).action,/PRIVATE-FOLLOW/);
});

test('rescheduling hides until the next KST date and preserves the task identity on reappearance',t=>{
  const f=fixture(t),row=f.create(),id=f.tasks()[0].id;f.finish(row,{disposition:'schedule',nextContactDate:'2026-10-14'});assert.equal(f.tasks().length,0);f.restart();assert.equal(f.tasks().length,0);f.now('2026-10-13T14:59:59.999Z');assert.equal(f.tasks().length,0);f.now('2026-10-13T15:00:00.000Z');const tasks=f.tasks();assert.equal(tasks.length,1);assert.equal(tasks[0].id,id);assert.equal(tasks[0].status,'due');assert.equal(tasks[0].nextContactDate,'2026-10-14');f.finish(row);assert.equal(f.tasks().length,0);assert.equal(f.current(row).followUpHistory.length,2);
});

test('same-day follow-up remains one task and never multiplies after repeated scheduling',t=>{
  const f=fixture(t),row=f.create(),id=f.tasks()[0].id;for(let index=0;index<3;index++){f.finish(row,{disposition:'schedule',nextContactDate:'2026-10-12',note:'같은 날 다시 확인할 약속 '+index});assert.equal(f.tasks().length,1);assert.equal(f.tasks()[0].id,id);}assert.equal(f.current(row).followUpHistory.length,3);
});

test('reassignment moves only the follow-up owner while preserving independent customer request work',t=>{
  const f=fixture(t),row=f.create(),id=f.tasks()[0].id;const customer=f.projects.open(f.projects.invite(f.users.owner,row.id,{revision:row.revision}).invite);f.projects.customerAction(customer.session,customer.csrf,{revision:f.current(row).revision,action:'support',text:'기존 고객 문의'});
  const before=f.workflow.workspace(f.users.owner).items;assert.equal(before.filter(item=>item.kind==='support').length,1);assert.equal(before.filter(item=>item.kind==='follow_up').length,1);f.finish(row,{disposition:'schedule',nextContactDate:'2026-10-12'});assert.equal(f.workflow.workspace(f.users.owner).items.filter(item=>item.kind==='support').length,1);
  const current=f.current(row);f.projects.save(f.users.manager,{...current,revision:current.revision,ownerId:f.users.peer.id},row.id);assert.equal(f.tasks().length,0);assert.equal(f.tasks(f.users.peer)[0].id,id);assert.throws(()=>f.finish(row,{},f.users.owner),{status:404});assert.equal(f.workflow.workspace(f.users.peer).items.filter(item=>item.kind==='support').length,1);
});

test('follow-up mutation requires current project write permission, not a stale role or reviewer grant',t=>{
  const f=fixture(t),row=f.create();for(const who of ['reviewer','peer','other','otherManager','viewer'])assert.throws(()=>f.finish(row,{},f.users[who]),error=>[403,404].includes(error.status),who);
  const managed=f.finish(row,{disposition:'schedule',nextContactDate:'2026-10-13'},f.users.manager);assert.equal(managed.followUpHistory[0].actor,f.users.manager.id);const done=f.finish(row,{},f.users.admin);assert.equal(done.followUpHistory[1].actor,f.users.admin.id);
  const other=f.create();f.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal(f.tasks({...f.users.owner,role:'admin'}).length,0);assert.throws(()=>f.finish(other,{}, {...f.users.owner,role:'admin'}),{status:403});f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.throws(()=>f.tasks(),{status:401});assert.throws(()=>f.finish(other),{status:401});
});

test('replayed or conflicting completion is rejected without overwriting the newer result',t=>{
  const f=fixture(t),row=f.create(),input={revision:row.revision,note:'첫 결과',disposition:'schedule',nextContactDate:'2026-10-13'};f.projects.completeFollowUp(f.users.owner,row.id,input);const before=structuredClone(f.current(row));assert.throws(()=>f.projects.completeFollowUp(f.users.owner,row.id,input),{status:409});assert.deepEqual(f.current(row),before);assert.throws(()=>f.projects.completeFollowUp(f.users.owner,row.id,{...input,note:'다른 창 결과',nextContactDate:'2026-10-14'}),{status:409});assert.deepEqual(f.current(row),before);
});

test('invalid, missing or past schedule dates and empty results fail without writing any partial evidence',t=>{
  const f=fixture(t),row=f.create(),before=structuredClone(f.current(row));f.now('2026-10-12T15:00:00.000Z');
  for(const nextContactDate of [undefined,'','2026-10-12','2026-02-30','2026-13-01','2026-1-14','2026-10-13T00:00:00Z','2026-10-13 ',0,false,{}])assert.throws(()=>f.finish(row,{disposition:'schedule',nextContactDate}),{status:400});
  for(const extra of [{note:''},{note:'   '},{note:'x'.repeat(3001)},{note:'bad\u0000note'},{note:{}},{disposition:'unknown'},{disposition:'done',nextContactDate:'2026-10-13'},{actor:'forged'},{nextStep:'PRIVATE-COPY-LEAK'}])assert.throws(()=>f.finish(row,extra),{status:400});assert.deepEqual(f.current(row),before);
  const valid=f.finish(row,{note:'x'.repeat(3000),disposition:'schedule',nextContactDate:'2026-10-13'});assert.equal(valid.followUpHistory[0].note.length,3000);assert.equal(f.tasks()[0].status,'due');
});

test('absent and archived follow-ups cannot be completed and disabled owners receive no task',t=>{
  const f=fixture(t),empty=f.create({nextContactDate:''}),archived=f.create({stage:'archived'}),row=f.create();assert.throws(()=>f.finish(empty),{status:409});assert.throws(()=>f.finish(archived),{status:409});f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal(f.tasks(f.users.admin).length,0);assert.throws(()=>f.finish(row),{status:401});
});

test('internal follow-up result and dates never enter the public customer session or notifications',t=>{
  const f=fixture(t),row=f.create(),customer=f.projects.open(f.projects.invite(f.users.owner,row.id,{revision:row.revision}).invite),before=f.projects.read(customer.session).project,notificationEvents=structuredClone(f.current(row).notificationEvents);f.finish(row,{disposition:'schedule',nextContactDate:'2026-10-13'});
  const after=f.projects.read(customer.session).project;assert.equal(after.nextStep,before.nextStep);assert.deepEqual(after.messages,before.messages);assert.doesNotMatch(JSON.stringify(after),/followUpHistory|nextContactDate|previousContactDate|PRIVATE-FOLLOW-UP-RESULT|PRIVATE-ORIGINAL/);assert.deepEqual(f.current(row).notificationEvents,notificationEvents);
});

test('history capacity rejects rather than trimming prior follow-up records or changing the date',t=>{
  const f=fixture(t),row=f.create(),history=Array.from({length:300},(_,index)=>({id:'old-'+index,actor:f.users.owner.id,at:BASE,note:'기존 결과 '+index,previousContactDate:'2026-10-11',nextContactDate:'2026-10-12',disposition:'schedule'}));f.store.put('clientProjects',row.id,{...f.current(row),followUpHistory:history});const before=structuredClone(f.current(row));assert.throws(()=>f.finish(row),{status:409});assert.deepEqual(f.current(row),before);assert.equal(f.tasks().length,1);
});

test('saving or importing project fields cannot replace already recorded internal follow-up history',t=>{
  const f=fixture(t),row=f.create();f.finish(row,{disposition:'schedule',nextContactDate:'2026-10-13'});const current=f.current(row),history=structuredClone(current.followUpHistory);f.projects.save(f.users.owner,{...current,revision:current.revision,title:'정상 제목 수정',followUpHistory:[{note:'forged'}]},row.id);assert.deepEqual(f.current(row).followUpHistory,history);f.restart();assert.deepEqual(f.current(row).followUpHistory,history);
});
