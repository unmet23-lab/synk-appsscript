import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createAutomationNotificationsService} from './automation-notifications.mjs';

const KIND='automationNotificationStates',NOW='2026-10-12T00:00:00.000Z';
const issue=(id='links:broken:one',automationId='links',extra={})=>({id,automationId,kind:'broken',status:'failed',text:'저장한 링크의 접속 결과를 확인해 주세요.',title:'PRIVATE-TITLE',href:'https://private.example/SECRET',...extra});
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-automation-notification-'));let store=new Store(directory),at=NOW,service,reader;
  const owner=store.createUser({name:'owner',email:'owner@notifications.example',teamId:'a'}),other=store.createUser({name:'other',email:'other@notifications.example',teamId:'b'}),viewer=store.createUser({name:'viewer',email:'viewer@notifications.example',role:'viewer'});
  const views=new Map(),events=[];let reads=0;
  const empty=()=>({cards:[{id:'links',status:'idle'},{id:'inbox',status:'idle'}],issues:[],observedIssueIds:[]});
  reader=user=>views.get(user.id)||empty();
  function build(){service=createAutomationNotificationsService({store,clock:()=>at,automationHealth:{get(user){reads++;return reader(user);}},onChange:ids=>events.push(ids)});}build();
  t.after(()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-automation-notification-')));rmSync(directory,{recursive:true,force:true});});
  const set=(issues=[],{user=owner,status='failed',observedIssueIds=[],...extra}={})=>views.set(user.id,{cards:[{id:'links',status},{id:'inbox',status}],issues,observedIssueIds,...extra});
  return {owner,other,viewer,views,events,set,get store(){return store;},get service(){return service;},get reads(){return reads;},setTime(value){at=value;},setReader(fn){reader=fn;},restart(){store.close();store=new Store(directory);build();},rows(){return store.all(KIND);}};
}

test('no target, waiting and disabled states do not manufacture alerts',t=>{
  const f=fixture(t);for(const status of ['idle','ready','scheduled','running','paused']){f.set([],{status});assert.equal(f.service.scan().created,0);assert.deepEqual(f.service.list(f.owner),{notifications:[],unreadCount:0});}assert.equal(f.events.length,0);
});

test('one durable metadata record and one event per stable issue, even across restart',t=>{
  const f=fixture(t);f.set([issue(),issue()]);assert.equal(f.service.list(f.owner).notifications.length,0);assert.equal(f.service.scan().created,1);
  const first=f.service.list(f.owner).notifications[0];assert.match(first.id,/^automation:[0-9a-f]{64}:1$/);assert.equal(first.title,'자동화 확인 필요');assert.equal(first.href,'/?tab=workroom&section=tools&tool=automation');assert.equal(first.message,null);
  assert.equal(f.events.length,1);const before=JSON.stringify(f.rows());f.setTime('2026-10-12T01:00:00Z');f.service.scan();assert.equal(JSON.stringify(f.rows()),before);assert.equal(f.events.length,1);f.restart();f.service.scan();assert.equal(f.service.list(f.owner).notifications[0].id,first.id);assert.equal(f.events.length,1);
  assert.deepEqual(Object.keys(f.rows()[0]).sort(),['automationId','changedAt','createdAt','episode','id','issueId','ownerId','readAt','reason','schema','state']);assert.doesNotMatch(JSON.stringify(f.rows()),/PRIVATE|SECRET|저장한 링크|href|title|body|text/);
});

test('current text is projected, source link and title are never copied',t=>{
  const f=fixture(t);f.set([issue()]);f.service.scan();f.set([issue(undefined,undefined,{text:'새 현재 조치',title:'CHANGED-PRIVATE'})]);const item=f.service.list(f.owner).notifications[0];assert.equal(item.text,'새 현재 조치');assert.equal(item.body,item.text);assert.doesNotMatch(JSON.stringify(item),/PRIVATE|SECRET/);assert.equal(f.events.length,1);
});

test('reading is idempotent and does not resolve the source',t=>{
  const f=fixture(t);f.set([issue()]);f.service.scan();const id=f.service.list(f.owner).notifications[0].id;assert.equal(f.service.read(f.owner,id).unreadCount,0);assert.equal(f.rows()[0].state,'active');assert.ok(f.rows()[0].readAt);f.service.read(f.owner,id);f.service.scan();assert.equal(f.events.length,2);assert.equal(f.service.list(f.owner).notifications.length,1);
});

test('authoritatively observed recovery disappears and recurrence is a new unread episode',t=>{
  const f=fixture(t);f.set([issue()]);f.service.scan();const first=f.service.list(f.owner).notifications[0];f.service.read(f.owner,first.id);
  f.set([],{status:'ready',observedIssueIds:[issue().id]});assert.equal(f.service.list(f.owner).notifications.length,0);assert.equal(f.service.scan().resolved,1);assert.equal(f.rows()[0].state,'resolved');assert.throws(()=>f.service.read(f.owner,first.id),{status:404});
  f.setTime('2026-10-12T02:00:00Z');f.set([issue()]);assert.equal(f.service.scan().reopened,1);const second=f.service.list(f.owner).notifications[0];assert.equal(second.id,first.id.replace(/:1$/,':2'));assert.equal(second.unread,true);assert.equal(second.readAt,null);assert.equal(second.createdAt,'2026-10-12T02:00:00.000Z');assert.throws(()=>f.service.read(f.owner,first.id),{status:404});
});

test('deletion, permission loss and unobserved absence suppress without claiming recovery',t=>{
  const f=fixture(t);f.set([issue()]);f.service.scan();const first=f.service.list(f.owner).notifications[0];f.service.read(f.owner,first.id);f.set([],{status:'ready'});assert.equal(f.service.scan().suppressed,1);assert.equal(f.rows()[0].state,'suppressed');assert.equal(f.rows()[0].reason,'not-current');
  f.set([issue()]);assert.equal(f.service.scan().restored,1);const restored=f.service.list(f.owner).notifications[0];assert.equal(restored.id,first.id);assert.equal(restored.unread,false);
});

test('paused or partial sources cannot resolve old issues even with stale observed ids',t=>{
  const f=fixture(t);f.set([issue()]);f.service.scan();const id=f.service.list(f.owner).notifications[0].id;f.service.read(f.owner,id);
  for(const status of ['paused','partial']){f.set([],{status,observedIssueIds:[issue().id]});f.service.scan();assert.equal(f.rows()[0].state,'suppressed');assert.equal(f.rows()[0].reason,status==='partial'?'unavailable':'paused');f.set([issue()]);f.service.scan();assert.equal(f.service.list(f.owner).notifications[0].id,id);assert.equal(f.service.list(f.owner).unreadCount,0);}
});

test('whole source read failure is unavailable, preserves receipt, and never leaks error detail',t=>{
  const f=fixture(t);f.set([issue()]);f.service.scan();const id=f.service.list(f.owner).notifications[0].id;f.service.read(f.owner,id);f.setReader(user=>{if(user.id===f.owner.id)throw new Error('SECRET-CONNECTION');return {cards:[],issues:[]};});assert.equal(f.service.scan().failedUsers,1);assert.equal(f.rows()[0].state,'suppressed');assert.equal(f.rows()[0].reason,'unavailable');assert.throws(()=>f.service.list(f.owner),error=>error.status===503&&!error.message.includes('SECRET'));
  const before=f.events.length;f.service.scan();assert.equal(f.events.length,before);f.setReader(user=>f.views.get(user.id)||{cards:[],issues:[]});f.service.scan();assert.equal(f.service.list(f.owner).notifications[0].id,id);assert.equal(f.service.list(f.owner).unreadCount,0);
});

test('partial source error gets its own stable alert while old source issue remains unresolved',t=>{
  const f=fixture(t);f.set([issue()]);f.service.scan();f.set([issue('links:source-error','links',{kind:'source',status:'partial',text:'링크 원문을 확인하지 못했습니다.'})],{status:'partial',observedIssueIds:[issue().id]});assert.equal(f.service.scan().created,1);assert.equal(f.rows().find(row=>row.issueId===issue().id).state,'suppressed');assert.equal(f.service.list(f.owner).notifications.length,1);f.service.scan();assert.equal(f.rows().length,2);
});

test('permission changes are checked on every list and read, before scheduled scan',t=>{
  const f=fixture(t);f.setReader(user=>({cards:[{id:'links',status:'failed'}],issues:user.teamId==='a'?[issue()]:[],observedIssueIds:[]}));f.service.scan();const id=f.service.list(f.owner).notifications[0].id;f.store.put('users',f.owner.id,{...f.owner,teamId:'b'});assert.equal(f.service.list(f.owner).notifications.length,0);assert.throws(()=>f.service.read(f.owner,id),{status:404});assert.equal(f.service.readAll(f.owner).count,0);assert.equal(f.rows()[0].readAt,null);f.service.scan();assert.equal(f.rows()[0].state,'suppressed');
});

test('inactive users and viewers cannot receive or preserve visible notices',t=>{
  const f=fixture(t);f.set([issue()]);f.set([issue()],{user:f.viewer});assert.equal(f.service.scan().created,1);assert.equal(f.service.list(f.viewer).notifications.length,0);const id=f.service.list(f.owner).notifications[0].id;f.store.put('users',f.owner.id,{...f.owner,role:'viewer'});assert.equal(f.service.list(f.owner).unreadCount,0);assert.throws(()=>f.service.read(f.owner,id),{status:404});f.service.scan();assert.equal(f.rows()[0].reason,'ineligible');
  f.store.put('users',f.owner.id,{...f.owner,active:false});for(const action of [()=>f.service.list(f.owner),()=>f.service.read(f.owner,id),()=>f.service.readAll(f.owner)])assert.throws(action,{status:401});
});

test('user and automation are part of identity and readAll only marks currently visible records',t=>{
  const f=fixture(t);f.set([issue(),issue('links:broken:one','inbox')]);f.set([issue()],{user:f.other});f.service.scan();const mine=f.service.list(f.owner),theirs=f.service.list(f.other);assert.equal(new Set([...mine.notifications,...theirs.notifications].map(row=>row.id)).size,3);assert.throws(()=>f.service.read(f.other,mine.notifications[0].id),{status:404});
  f.set([issue()]);assert.equal(f.service.readAll(f.owner).count,1);assert.equal(f.service.list(f.other).unreadCount,1);assert.equal(f.rows().find(row=>row.ownerId===f.owner.id&&row.automationId==='inbox').readAt,null);const events=f.events.length;assert.equal(f.service.readAll(f.owner).count,0);assert.equal(f.events.length,events);
});

test('read-source malformed data fails closed and malformed issues do not create metadata',t=>{
  const f=fixture(t);f.set([issue(),null,issue('', 'links'),issue('x','missing'),issue('bad\nkey','links')]);assert.equal(f.service.scan().created,1);f.setReader(()=>({cards:[],issues:null}));assert.equal(f.service.scan().failedUsers,2);assert.throws(()=>f.service.list(f.owner),{status:503});assert.equal(f.rows()[0].state,'suppressed');
});

test('onChange is once per affected user batch and a failed callback cannot roll back metadata',t=>{
  const f=fixture(t);f.set([issue(),issue('links:broken:two')]);f.set([issue()],{user:f.other});f.service.scan();assert.equal(f.events.length,1);assert.deepEqual(new Set(f.events[0]),new Set([f.owner.id,f.other.id]));
  const service=createAutomationNotificationsService({store:f.store,clock:()=>NOW,automationHealth:{get:()=>({cards:[{id:'links',status:'failed'}],issues:[issue('links:broken:three')]})},onChange(){throw new Error('callback');}});assert.doesNotThrow(()=>service.scan());assert.equal(service.list(f.owner).notifications.length,1);
});

test('scheduled scan produces the same durable issue transitions as the synchronous scan',async t=>{
  const f=fixture(t);f.set([issue()]);f.set([issue('inbox:import:other','inbox')],{user:f.other});
  const expected=f.service.scan(),rows=f.rows();for(const row of rows)f.store.remove(KIND,row.id);
  assert.deepEqual(await f.service.scanAsync(),expected);assert.deepEqual(f.rows(),rows);
  const first=f.service.list(f.owner).notifications[0];f.service.read(f.owner,first.id);
  f.set([],{status:'ready',observedIssueIds:[issue().id]});assert.equal((await f.service.scanAsync()).resolved,1);
  f.set([issue()]);assert.equal((await f.service.scanAsync()).reopened,1);assert.equal(f.service.list(f.owner).notifications[0].unread,true);
});

test('scheduled scan yields, coalesces overlapping calls and checks live permissions before each user',async t=>{
  const f=fixture(t);f.set([issue()]);f.set([issue()],{user:f.other});
  const pending=f.service.scanAsync();assert.equal(f.service.scanAsync(),pending);assert.equal(f.reads,0);
  await new Promise(resolve=>setImmediate(()=>{f.store.put('users',f.other.id,{...f.other,active:false});const item=f.service.list(f.owner).notifications[0];assert.ok(item);f.service.read(f.owner,item.id);resolve();}));
  const result=await pending;assert.equal(result.created,1);assert.ok(f.rows()[0].readAt);assert.equal(f.rows()[0].ownerId,f.owner.id);
});

test('scheduled cancellation stops before the next user and a later run can resume normally',async t=>{
  const f=fixture(t);f.set([issue()]);f.set([issue()],{user:f.other});let cancelled=true;
  assert.equal((await f.service.scanAsync({shouldStop:()=>cancelled})).cancelled,true);assert.equal(f.reads,0);assert.equal(f.rows().length,0);
  cancelled=false;assert.equal((await f.service.scanAsync({shouldStop:()=>cancelled})).created,2);
  f.setReader(user=>{if(user.id===f.owner.id)throw Error('unavailable');return f.views.get(user.id);});
  assert.equal((await f.service.scanAsync()).failedUsers,1);assert.equal(f.rows().find(row=>row.ownerId===f.owner.id).reason,'unavailable');assert.equal(f.rows().find(row=>row.ownerId===f.other.id).state,'active');
});
