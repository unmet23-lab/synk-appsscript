import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const now='2026-10-12T03:00:00.000Z';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-deadline-overlap-http-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,clock:()=>now});
  await app.start();const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-deadline-overlap-http-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['peer','member','a'],['other','member','b'],['admin','admin',null]]){users[name]=app.store.createUser({name,email:name+'@deadline-overlap-http.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'deadline-overlap-http'},30);}
  function create(name='owner',extra={}){const project=app.clientProjects.save(users[name],{title:'일정 확인 '+name,customerName:'PRIVATE-CUSTOMER-'+name,internalNotes:'PRIVATE-NOTES',reviewerId:name==='owner'?users.reviewer.id:null,nextContactDate:'2026-10-12',nextStep:'기존 후속 연락 유지',...extra}).project;return app.clientProjects.schedule(users[name],project.id,{action:'configure',revision:project.revision,enabled:true,calendar:'calendar',targets:{kickoff:'',preview:'2026-10-15',customer:'',revision:'',delivery:''},remainingWorkDays:null,customerWaitDays:null,internalReviewDays:null}).project;}
  const own=[create(),create()],other=create('other',{title:'PRIVATE-OTHER-PROJECT'});
  async function api(user='owner',headers={}){const response=await fetch(base+'/api/client-workflow',{headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...headers}});return {status:response.status,data:await response.json(),headers:response.headers};}
  const snapshot=()=>app.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all();
  return {app,users,api,own,other,snapshot};
}

test('HTTP existing workflow retains tasks and adds read-only current-project deadline overlaps',async t=>{
  const f=await fixture(t),before=f.snapshot(),result=await f.api();assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.ok(result.data.items.some(item=>item.kind==='follow_up'));assert.ok(result.data.projectGroups.length);assert.ok(Object.hasOwn(result.data,'rechecks'));
  const report=result.data.deadlineOverlaps.data;assert.equal(report.period.startDate,'2026-10-12');assert.equal(report.period.endDate,'2026-11-11');assert.equal(report.days.length,1);assert.equal(report.days[0].date,'2026-10-15');assert.equal(report.days[0].projectCount,2);assert.deepEqual(new Set(report.days[0].projects.map(project=>project.projectId)),new Set(f.own.map(project=>project.id)));assert.doesNotMatch(JSON.stringify(report),/PRIVATE-|contact|internalNotes/);
  for(const project of report.days[0].projects)for(const milestone of project.milestones){const url=new URL(milestone.href,'https://local.test');assert.equal(url.searchParams.get('project'),project.projectId);assert.ok(url.pathname==='/'&&url.searchParams.get('section')==='clients'||url.pathname==='/pulse-app/'&&url.searchParams.get('mode')==='staff');}
  assert.deepEqual(f.snapshot(),before);const second=await f.api();assert.deepEqual(second.data,result.data);assert.deepEqual(f.snapshot(),before);
});

test('HTTP overlap scope respects owner, valid reviewer, team manager, viewer and unrelated members',async t=>{
  const f=await fixture(t);for(const user of ['owner','reviewer','manager','viewer']){const result=await f.api(user);assert.equal(result.status,200);assert.equal(result.data.deadlineOverlaps.data.counts.visibleProjectCount,2);assert.equal(result.data.deadlineOverlaps.data.days[0].projectCount,2);assert.doesNotMatch(JSON.stringify(result.data.deadlineOverlaps),/PRIVATE-OTHER-PROJECT/);}
  const peer=await f.api('peer');assert.equal(peer.data.deadlineOverlaps.data.counts.visibleProjectCount,0);assert.deepEqual(peer.data.deadlineOverlaps.data.days,[]);const other=await f.api('other');assert.equal(other.data.deadlineOverlaps.data.counts.visibleProjectCount,1);assert.deepEqual(other.data.deadlineOverlaps.data.days,[]);assert.equal((await f.api('admin')).data.deadlineOverlaps.data.days[0].projectCount,3);
});

test('HTTP revoked sessions, inactive accounts and customer sessions cannot access staff overlap reports',async t=>{
  const f=await fixture(t);assert.equal((await f.api(null)).status,401);const project=f.app.store.get('clientProjects',f.own[0].id),customer=f.app.clientProjects.open(f.app.clientProjects.invite(f.users.owner,project.id,{revision:project.revision}).invite);assert.equal((await f.api(null,{Cookie:'synk_pulse_session='+customer.session})).status,401);
  f.app.store.revokeUser(f.users.owner.id);assert.equal((await f.api()).status,401);f.app.store.put('users',f.users.viewer.id,{...f.users.viewer,active:false});assert.equal((await f.api('viewer')).status,401);
});

test('HTTP current team changes and project reassignment remove previously visible overlaps immediately',async t=>{
  const f=await fixture(t);assert.equal((await f.api('reviewer')).data.deadlineOverlaps.data.days.length,1);f.app.store.put('users',f.users.reviewer.id,{...f.users.reviewer,teamId:'b'});assert.equal((await f.api('reviewer')).data.deadlineOverlaps.data.counts.visibleProjectCount,0);f.app.store.put('users',f.users.viewer.id,{...f.users.viewer,teamId:'b'});assert.equal((await f.api('viewer')).data.deadlineOverlaps.data.counts.visibleProjectCount,1);
  const row=f.app.store.get('clientProjects',f.own[0].id);f.app.store.put('clientProjects',row.id,{...row,ownerId:f.users.other.id,teamId:'b',reviewerId:null});const result=await f.api();assert.equal(result.data.deadlineOverlaps.data.counts.visibleProjectCount,1);assert.deepEqual(result.data.deadlineOverlaps.data.days,[]);assert.ok(result.data.items.every(item=>item.projectId!==row.id));assert.equal((await f.api('other')).data.deadlineOverlaps.data.days[0].projectCount,2);
});

test('HTTP malformed overlap projection returns an explicit error while retaining the existing task list',async t=>{
  const f=await fixture(t),before=await f.api(),workspace=f.app.clientProjects.workspace;
  f.app.clientProjects.workspace=(...args)=>{const result=workspace(...args);for(const project of result.projects)if(project.id===f.own[0].id)project.schedule.milestones.find(item=>item.id==='preview').targetDate='2026-02-30';return result;};
  const result=await f.api();assert.equal(result.status,200);assert.equal(typeof result.data.deadlineOverlaps.error,'string');assert.match(result.data.deadlineOverlaps.error,/계산하지 못했어요/);assert.equal(Object.hasOwn(result.data.deadlineOverlaps,'data'),false);assert.deepEqual(result.data.items,before.data.items);assert.deepEqual(result.data.projectGroups,before.data.projectGroups);f.app.clientProjects.workspace=workspace;
  const recovered=await f.api();assert.equal(recovered.data.deadlineOverlaps.data.days.length,1);
});

test('HTTP reads project projections once and cannot mask a failed source read as empty overlaps',async t=>{
  const f=await fixture(t),workspace=f.app.clientProjects.workspace;let reads=0;f.app.clientProjects.workspace=(...args)=>{reads++;return workspace(...args);};assert.equal((await f.api()).status,200);assert.equal(reads,1);
  f.app.clientProjects.workspace=()=>{throw Object.assign(new Error('Synthetic source unavailable'),{status:503});};const failed=await f.api();assert.equal(failed.status,503);assert.equal(Object.hasOwn(failed.data,'deadlineOverlaps'),false);assert.equal(Object.hasOwn(failed.data,'items'),false);
});
