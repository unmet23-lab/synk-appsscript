import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createSocialFollowups} from './social-followups.mjs';
import {createMessenger} from '../../../../../tools/company-messenger/server.mjs';

function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-followups-')),store=new Store(directory);
  t.after(()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const users={};for(const [id,role]of[['writer','member'],['worker','member'],['other','member'],['viewer','viewer'],['admin','admin']]){users[id]={id,name:'합성 '+id,role,active:true,teamId:id==='other'?'b':'a'};store.put('users',id,users[id]);}
  const channel={id:'social',platform:'instagram',ownerIds:['writer','worker'],teamId:'a',active:true};store.put('channels',channel.id,channel);
  const inbox={id:'inbox',channelId:'social',revision:1,source:'api:instagram',externalId:'300',sourceAccountId:'100',kind:'comment',text:'PRIVATE_ORIGINAL_CUSTOMER_CONTACT',author:'PRIVATE_AUTHOR',url:'https://www.instagram.com/p/PRIVATE_POST/',replyDraft:'PRIVATE_REPLY',createdAt:'2026-10-13T00:00:00Z'};store.put('socialInbox',inbox.id,inbox);
  const rooms=[{id:'private',name:'담당자 대화',companyUserIds:['writer','worker'],taskAssignees:[{id:'m-writer',companyUserId:'writer',name:'합성 writer'},{id:'m-worker',companyUserId:'worker',name:'합성 worker'}]},{id:'public',name:'전체 대화',companyUserIds:['writer','worker','other'],taskAssignees:[{id:'m-worker',companyUserId:'worker',name:'합성 worker'}]},{id:'unmapped',name:'미연결 인원',companyUserIds:['writer',null],taskAssignees:[{id:'m-writer',companyUserId:'writer'}]}];
  const calls=[],ledger=new Map();let counter=0,createHook,getHook,optionsHook;
  const tasks={
    options(user){optionsHook?.(user);return {channels:rooms};},
    create(user,input){
      calls.push({userId:user.id,...input});const key=user.id+':'+input.requestId,prior=ledger.get(key);if(prior){assert.deepEqual(prior.input,input);return {...prior.result,created:false};}
      const message={id:String(++counter),channelId:input.channelId,body:input.body},task={id:'task-'+counter,messageId:message.id,channelId:input.channelId,title:input.title,stage:'requested',status:'todo',revision:1,dueDate:input.dueDate,assignee:{id:input.assigneeId,companyUserId:input.assigneeId.slice(2),name:'합성 담당자'},canManage:true,updatedAt:'2026-10-13T00:00:00Z',workday:{todayReasons:['reply']}};
      const result={message,task,created:true};ledger.set(key,{input:structuredClone(input),result});createHook?.(result);return result;
    },
    get(user,{messageId}){getHook?.(user,messageId);const value=[...ledger.values()].find(row=>row.result.message.id===messageId);if(!value)throw Object.assign(new Error('not found'),{status:404});return value.result;}
  };
  const service=createSocialFollowups({store,tasks,clock:()=> '2026-10-13T01:00:00.000Z'}),input={inboxId:'inbox',revision:1,roomId:'private',assigneeId:'worker',nextAction:'정책을 확인하고 답변 준비',dueDate:'2026-10-14'};
  return {store,users,channel,inbox,rooms,tasks,calls,ledger,service,input,setCreateHook:value=>createHook=value,setGetHook:value=>getHook=value,setOptionsHook:value=>optionsHook=value};
}

test('explicit followup reuses task lifecycle and only copies authored action plus an internal source link',t=>{
  const f=fixture(t),options=f.service.workspace(f.users.writer,{inboxId:'inbox'});assert.deepEqual(options.targets.map(row=>row.id),['private']);assert.equal(options.deadlineBasis,'Asia/Seoul');assert.equal(options.date,'2026-10-13');
  const result=f.service.create(f.users.writer,f.input);assert.equal(result.created,true);assert.equal(result.followup.stage,'requested');assert.equal(result.followup.assigneeId,'worker');assert.equal(result.followup.dueDate,'2026-10-14');assert.match(result.followup.taskHref,/tab=messenger/);assert.equal(f.calls[0].title,'SNS 문의 후속 업무');assert.equal(f.calls[0].reviewerId,null);assert.match(f.calls[0].body,/SNS 문의 원문: \/\?tab=social&section=inbox&inboxId=inbox/);
  assert.doesNotMatch(JSON.stringify(f.calls)+JSON.stringify(f.store.all('socialFollowups')),/PRIVATE_/);assert.deepEqual(f.store.get('socialInbox','inbox'),f.inbox);assert.equal(f.service.list(f.users.writer).items[0].canCreate,false);assert.equal(f.ledger.size,1);
});

test('duplicate clicks and service restarts recover one existing task, while changed content conflicts',t=>{
  const f=fixture(t),first=f.service.create(f.users.writer,f.input),again=f.service.create(f.users.writer,f.input);assert.equal(again.created,false);assert.equal(again.followup.taskId,first.followup.taskId);assert.equal(f.calls.length,1);
  const resumed=createSocialFollowups({store:f.store,tasks:f.tasks});assert.equal(resumed.create(f.users.worker,f.input).followup.taskId,first.followup.taskId);assert.equal(f.calls.length,1);
  assert.throws(()=>resumed.create(f.users.writer,{...f.input,nextAction:'다른 업무'}),{status:409});assert.equal(f.ledger.size,1);
});

test('a lost task response retains one stable request ID and recovers without a second task',t=>{
  const f=fixture(t);f.setCreateHook(()=>{throw Object.assign(new Error('synthetic lost response'),{status:502});});assert.throws(()=>f.service.create(f.users.writer,f.input),{status:502});assert.equal(f.ledger.size,1);assert.equal(f.store.get('socialFollowups','inbox').state,'pending');
  assert.throws(()=>f.service.create(f.users.worker,f.input),{status:409});assert.throws(()=>f.service.create(f.users.writer,{...f.input,nextAction:'다른 다음 행동'}),{status:409,message:/등록 결과를 확인하는 중/});f.setCreateHook(null);
  const resumed=createSocialFollowups({store:f.store,tasks:f.tasks}),result=resumed.create(f.users.writer,f.input);assert.equal(result.created,false);assert.equal(result.followup.state,'linked');assert.equal(f.ledger.size,1);assert.equal(f.calls[0].requestId,f.calls[1].requestId);
});

test('task acceptance, assignment, deadline and completion are read from the existing task rather than cached SNS state',t=>{
  const f=fixture(t);f.service.create(f.users.writer,f.input);const row=[...f.ledger.values()][0].result.task;Object.assign(row,{stage:'done',status:'done',revision:5,dueDate:'2026-10-15',assignee:{id:'m-writer',companyUserId:'writer',name:'새 담당자'},workday:{todayReasons:[]}});
  const result=f.service.workspace(f.users.writer,{inboxId:'inbox'}).items[0].followup;assert.equal(result.stage,'done');assert.equal(result.assigneeId,'writer');assert.equal(result.dueDate,'2026-10-15');assert.equal(result.revision,5);assert.deepEqual(result.workday.todayReasons,[]);
});

test('current source access applies before idempotency lookup and does not leak private task details',t=>{
  const f=fixture(t);f.service.create(f.users.writer,f.input);assert.throws(()=>f.service.create(f.users.other,f.input),{status:404});assert.deepEqual(f.service.list(f.users.other),{items:[]});
  f.store.put('channels','social',{...f.channel,ownerIds:['worker']});assert.deepEqual(f.service.list(f.users.writer),{items:[]});assert.throws(()=>f.service.workspace(f.users.writer,{inboxId:'inbox'}),{status:404});assert.throws(()=>f.service.create(f.users.writer,f.input),{status:404});
  f.store.put('users','worker',{...f.users.worker,active:false});assert.throws(()=>f.service.list(f.users.worker),{status:401});
});

test('room members and assignee must currently have source access; viewer cannot create',t=>{
  const f=fixture(t);for(const patch of [{roomId:'public'},{roomId:'unmapped'},{assigneeId:'other'},{assigneeId:'viewer'}])assert.throws(()=>f.service.create(f.users.writer,{...f.input,...patch}),{status:403});
  assert.throws(()=>f.service.create(f.users.viewer,f.input),{status:403});assert.equal(f.service.workspace(f.users.viewer,{inboxId:'inbox'}).targets.length,0);assert.equal(f.calls.length,0);assert.equal(f.store.all('socialFollowups').length,0);
});

test('a hidden, archived or reassigned source stops creates and hides existing followups',t=>{
  for(const change of [{hidden:true},{active:false},{ownerIds:[],teamId:'b'}]){const f=fixture(t);f.service.create(f.users.writer,f.input);f.store.put('channels','social',{...f.channel,...change});assert.equal(f.service.list(f.users.writer).items.length,0);assert.throws(()=>f.service.create(f.users.writer,f.input),{status:404});assert.equal(f.calls.length,1);}
});

test('deleted or inaccessible tasks are explicit and never automatically recreated',t=>{
  const f=fixture(t);f.service.create(f.users.writer,f.input);f.setGetHook(()=>{throw Object.assign(new Error('private room'),{status:403});});let followup=f.service.list(f.users.writer).items[0].followup;assert.equal(followup.state,'unavailable');assert.equal(followup.taskId,undefined);assert.equal(followup.nextAction,undefined);assert.equal(followup.taskHref,undefined);assert.equal(f.service.create(f.users.writer,f.input).created,false);assert.equal(f.calls.length,1);
  f.setGetHook(null);f.ledger.clear();followup=f.service.workspace(f.users.writer,{inboxId:'inbox'}).items[0].followup;assert.equal(followup.state,'unavailable');assert.equal(f.calls.length,1);
});

test('strict source revision, real date and input fields reject malformed or unapproved work before task creation',t=>{
  const f=fixture(t);for(const patch of [{revision:0},{revision:'1'},{dueDate:'2026-02-30'},{dueDate:'2026-13-01'},{dueDate:'2026-10-14T00:00:00Z'},{dueDate:''},{nextAction:''},{nextAction:'x'.repeat(2001)},{title:'copied private title'},{body:'private copy'},{confirmed:true}])assert.throws(()=>f.service.create(f.users.writer,{...f.input,...patch}));
  assert.equal(f.calls.length,0);assert.equal(f.store.all('socialFollowups').length,0);
});

test('cancelled, changed and revoked sessions cannot create while a completed task is recorded before response reauthorization',t=>{
  const f=fixture(t);assert.throws(()=>f.service.create(f.users.writer,f.input,{signal:{aborted:true}}),{status:409});assert.throws(()=>f.service.create(f.users.writer,f.input,{authorize:()=>f.users.other}),{status:401});assert.equal(f.calls.length,0);
  f.setCreateHook(()=>f.store.put('users','writer',{...f.users.writer,active:false}));assert.throws(()=>f.service.create(f.users.writer,f.input),{status:401});assert.equal(f.store.get('socialFollowups','inbox').state,'linked');assert.equal(f.ledger.size,1);assert.equal(f.service.list(f.users.worker).items[0].followup.state,'linked');
});

test('room membership changes between preview and create are denied instead of sharing the source reference',t=>{
  const f=fixture(t);assert.equal(f.service.workspace(f.users.writer,{inboxId:'inbox'}).targets.length,1);f.rooms[0].companyUserIds.push('other');assert.throws(()=>f.service.create(f.users.writer,f.input),{status:403});assert.equal(f.calls.length,0);
});

test('pending retry inputs are private to the creator and use the current revision; receipt lookup restores a changed task',t=>{
  const f=fixture(t);f.setCreateHook(()=>{throw Object.assign(new Error('lost response'),{status:502});});assert.throws(()=>f.service.create(f.users.writer,f.input));
  f.store.put('socialInbox','inbox',{...f.inbox,revision:2,text:'changed source'});
  const pending=f.service.list(f.users.writer).items[0].followup;assert.equal(pending.sourceRevision,1);assert.equal(pending.retryInput.revision,2);assert.equal(f.service.list(f.users.worker).items[0].followup.retryInput,undefined);
  f.tasks.find=(user,{requestId})=>f.ledger.get(user.id+':'+requestId)?.result||null;
  const task=[...f.ledger.values()][0].result.task;task.assignee={id:'m-writer',companyUserId:'writer',name:'new assignee'};f.store.put('users','worker',{...f.users.worker,active:false});
  const restored=f.service.create(f.users.writer,pending.retryInput);assert.equal(restored.created,false);assert.equal(restored.followup.assigneeId,'writer');assert.equal(f.calls.length,1);assert.equal(f.ledger.size,1);
});

async function realFixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-followups-real-')),store=new Store(join(directory,'company'));
  for(const id of ['writer','worker','outsider','viewer'])store.put('users',id,{id,name:'Synthetic '+id,role:id==='viewer'?'viewer':'member',active:true,teamId:'team'});
  const channel={id:'sns',platform:'instagram',active:true,ownerIds:['writer','worker'],teamId:'team'};store.put('channels','sns',channel);
  store.put('socialInbox','inquiry',{id:'inquiry',channelId:'sns',revision:1,text:'PRIVATE_CUSTOMER_BODY',author:'PRIVATE_AUTHOR',url:'https://www.instagram.com/p/PRIVATE/'});
  const integration={origin:'http://workspace.example.test',listUsers:()=>store.all('users'),listTeams:()=>[],authenticate(req){const user=store.get('users',req.headers['test-user']);return user?.active?{companyUserId:user.id,role:user.role,canWrite:user.role!=='viewer',canManage:false,csrfToken:'synthetic-csrf',token:'synthetic-session-'+user.id}:null;}};
  let messenger;
  const start=async()=>{messenger=createMessenger({dataDir:join(directory,'messenger'),integration,backgroundJobsEnabled:false,workNotificationsEnabled:false,driveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});await messenger.startMounted();};
  await start();
  t.after(async()=>{await messenger.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const ids=Object.fromEntries(messenger.db.prepare('SELECT company_user_id,messenger_user_id FROM company_identity_links').all().map(row=>[row.company_user_id,row.messenger_user_id]));
  messenger.db.prepare("INSERT INTO channels(id,name,description,kind,scope,category,creator_id,created_at) VALUES(?,?,?,?,?,?,?,?)").run('followup-room','Synthetic private followup','','channel','private','project',ids.writer,new Date().toISOString());
  for(const id of ['writer','worker'])messenger.db.prepare('INSERT INTO memberships(channel_id,user_id) VALUES(?,?)').run('followup-room',ids[id]);
  const tasks={options:user=>messenger.taskOptionsForCompanyUser(user.id),create:(user,input)=>messenger.createTaskForCompanyUser(user.id,input),get:(user,input)=>messenger.taskForCompanyUser(user.id,input),find:(user,input)=>messenger.findTaskForCompanyUser?.(user.id,input)||null};
  const service=createSocialFollowups({store,tasks}),user=store.get('users','writer'),input={inboxId:'inquiry',revision:1,roomId:'followup-room',assigneeId:'worker',nextAction:'실행 가능한 안내를 확인하고 담당자에게 전달',dueDate:'2026-10-14'};
  return {store,get messenger(){return messenger;},tasks,service,user,input,ids,channel,restart:async()=>{await messenger.close();await start();}};
}

test('real messenger bridge creates one ordinary task, workday item and assignment notification across restart',async t=>{
  const f=await realFixture(t);assert.ok(f.service.workspace(f.user,{inboxId:'inquiry'}).targets.some(room=>room.id==='followup-room'));
  const first=f.service.create(f.user,f.input);assert.equal(first.followup.assigneeId,'worker');assert.equal(first.followup.dueDate,'2026-10-14');assert.equal(f.messenger.db.prepare('SELECT COUNT(*) n FROM message_tasks').get().n,1);
  const message=f.messenger.db.prepare('SELECT body FROM messages WHERE id=?').get(first.followup.messageId);assert.doesNotMatch(message.body,/PRIVATE_/);assert.match(message.body,/inboxId=inquiry/);
  const work=f.messenger.productivityOverview({headers:{'test-user':'worker'}},'workday');assert.ok(work.today.groups.reply.some(row=>row.id===first.followup.taskId));assert.ok(f.messenger.notificationsForCompanyUser('worker').some(row=>row.task?.id===first.followup.taskId||row.message?.id===first.followup.messageId));
  await f.restart();assert.equal(f.service.create(f.user,f.input).followup.taskId,first.followup.taskId);assert.equal(f.messenger.db.prepare('SELECT COUNT(*) n FROM message_tasks').get().n,1);
});

test('real bridge enforces current room and source permissions instead of treating stored task IDs as access',async t=>{
  const f=await realFixture(t),created=f.service.create(f.user,f.input);
  assert.throws(()=>f.messenger.taskForCompanyUser('outsider',{messageId:created.followup.messageId}),{status:404});assert.throws(()=>f.service.create(f.store.get('users','viewer'),f.input),{status:403});
  f.messenger.db.prepare('DELETE FROM memberships WHERE channel_id=? AND user_id=?').run('followup-room',f.ids.writer);assert.equal(f.service.list(f.user).items[0].followup.state,'unavailable');assert.equal(f.service.create(f.user,f.input).created,false);assert.equal(f.messenger.db.prepare('SELECT COUNT(*) n FROM message_tasks').get().n,1);
  f.store.put('channels','sns',{...f.channel,ownerIds:['worker']});assert.deepEqual(f.service.list(f.user),{items:[]});assert.throws(()=>f.service.create(f.user,f.input),{status:404});
});

test('real receipt lookup restores a committed task after response loss, restart and source revision changes without another create',async t=>{
  const f=await realFixture(t),create=f.tasks.create;let calls=0;
  f.tasks.create=(...args)=>{calls++;create(...args);throw Object.assign(new Error('synthetic response loss'),{status:502});};
  assert.throws(()=>f.service.create(f.user,f.input),{status:502});assert.equal(f.store.get('socialFollowups','inquiry').state,'pending');assert.equal(f.messenger.db.prepare('SELECT COUNT(*) n FROM message_tasks').get().n,1);
  await f.restart();f.store.put('socialInbox','inquiry',{...f.store.get('socialInbox','inquiry'),revision:2,text:'CHANGED_PRIVATE_SOURCE'});
  f.messenger.db.prepare('UPDATE message_tasks SET assignee_id=?,revision=revision+1').run(f.ids.writer);
  f.store.put('users','worker',{...f.store.get('users','worker'),active:false});
  const input=f.service.list(f.user).items[0].followup.retryInput,result=f.service.create(f.user,input);
  assert.equal(input.revision,2);assert.equal(result.created,false);assert.equal(result.followup.assigneeId,'writer');assert.equal(result.followup.state,'linked');assert.equal(calls,1);assert.equal(f.messenger.db.prepare('SELECT COUNT(*) n FROM message_tasks').get().n,1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});
