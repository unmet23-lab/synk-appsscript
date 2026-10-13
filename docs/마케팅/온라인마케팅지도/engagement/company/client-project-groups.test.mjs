import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {buildClientProjectGroups} from './client-project-groups.mjs';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';

const today='2026-10-12';
const item=(id,extra={})=>({id,projectId:'p1',projectTitle:'같은 제목',href:'/?tab=workroom&section=clients&project=p1&requests=1',title:'확인할 일',kind:'scene_request',group:'next',status:'open',dueDate:'',...extra});
const groups=items=>buildClientProjectGroups(items,{today});

test('projects use exact IDs and deduplicated source objects without changing the input order or fields',()=>{
  const first=Object.freeze(item('one',{seconds:12,note:'원문 메모',actions:Object.freeze([{action:'start'}])}));
  const second=Object.freeze(item('two',{projectId:'p2'}));
  const input=Object.freeze([first,second,first]);
  const result=groups(input);
  assert.deepEqual(result.map(row=>row.projectId),['p1','p2']);
  assert.equal(result[0].counts.total,1);
  assert.equal(result[0].primary,first);
  assert.equal(result[0].items[0],first);
  assert.equal(result[1].primary,second);
  assert.deepEqual(input,[first,second,first]);
  assert.equal(new URL(result[1].href,'https://local.example').searchParams.get('project'),'p2');
});

test('deadline urgency wins over task kind, timestamps and stale status labels',()=>{
  const rows=[item('undated',{kind:'client_kickoff',status:'overdue',updatedAt:'2099-01-01'}),item('future',{kind:'client_changes',dueDate:'2026-10-13'}),item('now',{kind:'support',dueDate:today}),item('late',{kind:'client_closeout',dueDate:'2026-10-11',status:'ready'})];
  const result=groups(rows)[0];
  assert.deepEqual(result.items.map(row=>row.id),['late','now','future','undated']);
  assert.equal(result.primary.id,'late');assert.equal(result.urgency,'overdue');assert.equal(result.dueDate,'2026-10-11');
  assert.equal(result.reason,'2026-10-11 기한이 지났고 내 차례예요.');
  assert.doesNotMatch(result.reason,/차단|막|실패/);
});

test('same urgency follows task kind then valid date then stable source ID',()=>{
  const rows=[item('z',{kind:'feedback',dueDate:'2026-10-11'}),item('a',{kind:'feedback',dueDate:'2026-10-11'}),item('earlier',{kind:'feedback',dueDate:'2026-10-10'}),item('kickoff',{kind:'client_kickoff',dueDate:'2026-10-11'})];
  const expected=['kickoff','earlier','a','z'];
  assert.deepEqual(groups(rows)[0].items.map(row=>row.id),expected);
  assert.deepEqual(groups(rows.toReversed())[0].items.map(row=>row.id),expected);
});

test('customer and internal waits never become primary even when their dates are earlier',()=>{
  const rows=[item('customer',{kind:'customer_review',group:'waiting',status:'waiting_customer',dueDate:'2020-01-01'}),item('staff',{group:'waiting',status:'review',dueDate:'2020-01-02'}),item('mine',{group:'review',status:'review',dueDate:today})];
  let result=groups(rows)[0];
  assert.equal(result.primary.id,'mine');assert.equal(result.urgency,'today');
  assert.deepEqual(result.counts,{total:3,actionable:1,waiting:2,customerWaiting:1,staffWaiting:1});
  assert.match(result.reason,/오늘\(2026-10-12\).*내 검토 차례/);
  result=groups(rows.slice(0,2))[0];
  assert.equal(result.primary,null);assert.equal(result.urgency,'waiting');assert.equal(result.dueDate,'');
  assert.match(result.reason,/고객 차례 1건 · 검토자 차례 1건/);
  assert.match(result.reason,/지금 내가 할 일은 없어요/);
  assert.equal(groups([item('mixed',{group:'next',status:'waiting_customer'})])[0].primary,null);
});

test('closed, archived, resolved and malformed projections are absent',()=>{
  const rows=['done','complete','completed','archived'].map(status=>item(status,{status}));
  rows.push(item('resolved',{resolved:true}),item('archived-project',{stage:'archived'}),null,item('',{}),item('no-project',{projectId:''}),item('unknown',{group:'unknown'}));
  assert.deepEqual(groups(rows),[]);assert.deepEqual(groups(null),[]);
});

test('invalid calendar dates stay undated; valid leap dates and explicit KST date are respected',()=>{
  for(const dueDate of ['2026-02-30','2026-13-01','2026-10-12T09:00:00+09:00','2026-1-01',' 2026-10-12','not-a-date',null]){
    const result=groups([item('one',{dueDate})])[0];
    assert.equal(result.urgency,'undated');assert.equal(result.dueDate,'');assert.match(result.reason,/기한은 없고/);
  }
  assert.equal(buildClientProjectGroups([item('leap',{dueDate:'2028-02-29'})],{today:'2028-02-29'})[0].urgency,'today');
  assert.throws(()=>buildClientProjectGroups([],{today:'2026-02-30'}),/기준 날짜/);
});

test('project ordering puts actionable deadlines before undated tasks and wait-only projects',()=>{
  const rows=[item('waiting',{projectId:'wait',group:'waiting',status:'review',dueDate:'2020-01-01'}),item('undated',{projectId:'none'}),item('future',{projectId:'future',dueDate:'2026-10-13'}),item('today',{projectId:'today',dueDate:today}),item('past',{projectId:'past',dueDate:'2026-10-11'})];
  assert.deepEqual(groups(rows).map(row=>row.projectId),['past','today','future','none','wait']);
});

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-project-groups-'));let store=new Store(directory),projects,workflow;
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};
  for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['outsider','member','b'],['manager','manager','a'],['viewer','viewer','a']])users[name]=store.createUser({name,email:name+'@groups.example',role,teamId});
  const now='2026-10-11T15:00:00.000Z';
  function services(){projects=createClientProjectsService({store,clock:()=>now});workflow=createClientWorkflowService({store,clientProjects:projects,clock:()=>now});}services();
  const draft={title:'그룹 검증 프로젝트',customerName:'합성 고객',dueDate:today,reviewerId:users.reviewer.id};
  const initial=projects.save(users.owner,draft).project;
  const customer=projects.open(projects.invite(users.owner,initial.id,{revision:initial.revision}).invite);
  const read=()=>projects.project(users.owner,initial.id);
  const action=(action,extra={})=>projects.customerAction(customer.session,customer.csrf,{revision:read().revision,action,...extra});
  const update=(name,id,action,extra={})=>workflow.update(users[name],{projectId:initial.id,messageId:id,revision:read().revision,action,...extra});
  const version=label=>projects.addVersion(users.owner,initial.id,{revision:read().revision,kind:'preview',label,url:'https://files.example/'+label}).project.versions.at(-1);
  return {users,draft,customer,read,action,update,version,get store(){return store},get projects(){return projects},get workflow(){return workflow},restart(){store.close();store=new Store(directory);services();}};
}

test('workflow adds source-backed groups using KST and immediately follows completion, reopening and restart',async t=>{
  const f=await fixture(t);f.action('support',{text:'원문 문의'});
  let result=f.workflow.workspace(f.users.owner),source=result.items[0];
  assert.equal(result.projectGroups[0].primary,source);
  assert.equal(result.projectGroups[0].urgency,'today','15:00 UTC is the next KST date');
  const id=source.messageId;f.restart();result=f.workflow.workspace(f.users.owner);
  assert.equal(result.projectGroups[0].primary.id,source.id);
  let updated=f.update('owner',id,'complete');assert.deepEqual(updated.items,[]);assert.deepEqual(updated.projectGroups,[]);
  updated=f.update('owner',id,'reopen');assert.equal(updated.projectGroups[0].primary.id,source.id);
  assert.equal(updated.projectGroups[0].counts.total,1);
});

test('groups inherit assignment, review and customer data boundaries without adding new access',async t=>{
  const f=await fixture(t),v1=f.version('v1');f.action('feedback',{versionId:v1.id,text:'12초 수정',seconds:12});
  const messageId=f.read().messages.at(-1).id,v2=f.version('v2');f.update('owner',messageId,'submit_review',{versionId:v2.id});
  let owner=f.workflow.workspace(f.users.owner),reviewer=f.workflow.workspace(f.users.reviewer);
  assert.equal(owner.projectGroups[0].primary,null);
  assert.equal(owner.projectGroups[0].counts.staffWaiting,1);
  assert.equal(reviewer.projectGroups[0].primary.group,'review');assert.equal(reviewer.projectGroups[0].primary.seconds,12);
  for(const name of ['peer','outsider','manager','viewer'])assert.deepEqual(f.workflow.workspace(f.users[name]).projectGroups,[]);
  assert.doesNotMatch(JSON.stringify(f.projects.read(f.customer.session)),/projectGroups|staffWaiting|내 검토 차례/);
  f.projects.save(f.users.manager,{...f.draft,revision:f.read().revision,reviewerId:f.users.peer.id},f.read().id);
  assert.deepEqual(f.workflow.workspace(f.users.reviewer).projectGroups,[]);
  assert.equal(f.workflow.workspace(f.users.peer).projectGroups[0].primary.group,'review');
});

test('current owner and reviewer changes, archive and restore recalculate groups without stored duplicates',async t=>{
  const f=await fixture(t);f.action('support',{text:'담당자 이관'});
  const id=f.read().id;
  f.projects.save(f.users.manager,{...f.draft,revision:f.read().revision,ownerId:f.users.peer.id},id);
  assert.deepEqual(f.workflow.workspace(f.users.owner).projectGroups,[]);
  let row=f.projects.project(f.users.peer,id);
  assert.equal(f.workflow.workspace(f.users.peer).projectGroups[0].counts.total,1);
  f.projects.save(f.users.peer,{...f.draft,revision:row.revision,stage:'archived'},id);
  assert.deepEqual(f.workflow.workspace(f.users.peer).projectGroups,[]);
  row=f.projects.project(f.users.peer,id);f.projects.save(f.users.peer,{...f.draft,revision:row.revision,stage:'received'},id);
  assert.equal(f.workflow.workspace(f.users.peer).projectGroups[0].counts.total,1);
  f.store.put('users',f.users.peer.id,{...f.users.peer,active:false});
  assert.throws(()=>f.workflow.workspace(f.users.peer),error=>error.status===401);
});
