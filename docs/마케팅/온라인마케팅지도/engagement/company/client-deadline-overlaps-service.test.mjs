import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientDeadlineOverlapsService} from './client-deadline-overlaps.mjs';

const now='2026-10-12T03:00:00.000Z';
const status=(fn,value)=>assert.throws(fn,error=>error.status===value);
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-deadline-overlaps-')),store=new Store(directory);t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-deadline-overlaps-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['peer','member','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@overlaps.test',role,teamId});
  const projects=createClientProjectsService({store,clock:()=>now}),service=createClientDeadlineOverlapsService({store,clientProjects:projects,clock:()=>now});
  function create(name='owner',extra={}){const project=projects.save(users[name],{title:'합성 일정 '+name,customerName:'합성 고객',reviewerId:name==='owner'?users.reviewer.id:null,...extra}).project;return projects.schedule(users[name],project.id,{action:'configure',revision:project.revision,enabled:true,calendar:'calendar',targets:{kickoff:'',preview:'2026-10-15',customer:'',revision:'',delivery:''},remainingWorkDays:null,customerWaitDays:null,internalReviewDays:null}).project;}
  return {store,users,projects,service,create,get:(name='owner')=>service.get(users[name])};
}

test('service only aggregates existing accessible projects for owner, reviewer, manager, viewer and admin',async t=>{
  const f=await fixture(t);const own=[f.create(),f.create()],other=f.create('other',{title:'PRIVATE-OTHER-PROJECT'});for(const name of ['owner','reviewer','manager','viewer']){const report=f.get(name);assert.equal(report.counts.visibleProjectCount,2);assert.equal(report.days[0].projectCount,2);assert.doesNotMatch(JSON.stringify(report),/PRIVATE-OTHER/);assert.deepEqual(new Set(report.days[0].projects.map(row=>row.projectId)),new Set(own.map(row=>row.id)));}
  assert.equal(f.get('peer').counts.visibleProjectCount,0);assert.deepEqual(f.get('other').days,[]);assert.equal(f.get('admin').days[0].projectCount,3);assert.ok(f.get('admin').days[0].projects.some(row=>row.projectId===other.id));
});

test('current team, role, ownership and active account are rechecked despite stale caller objects',async t=>{
  const f=await fixture(t),a=f.create(),b=f.create();assert.equal(f.get('reviewer').days.length,1);f.store.put('users',f.users.reviewer.id,{...f.users.reviewer,teamId:'b'});assert.equal(f.get('reviewer').counts.visibleProjectCount,0);
  f.store.put('users',f.users.manager.id,{...f.users.manager,role:'member'});assert.equal(f.get('manager').counts.visibleProjectCount,0);f.store.put('users',f.users.viewer.id,{...f.users.viewer,teamId:'b'});assert.equal(f.get('viewer').counts.visibleProjectCount,0);
  const row=f.store.get('clientProjects',a.id);f.store.put('clientProjects',a.id,{...row,ownerId:f.users.other.id,teamId:'b',reviewerId:null});const view=f.get();assert.equal(view.counts.visibleProjectCount,1);assert.deepEqual(view.days,[]);assert.equal(view.observations.undated.projects[0].projectId,b.id);
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.get(),401);status(()=>f.service.get(null),401);f.store.put('users',f.users.owner.id,{...f.users.owner,role:'invalid'});status(()=>f.get(),401);
});

test('current reviewer validity changes internal review dates without keeping a stale conflict',async t=>{
  const f=await fixture(t),a=f.create(),b=f.create();const row=f.store.get('clientProjects',a.id),pv={id:'11111111-1111-4111-8111-111111111111',kind:'preview',label:'합성',createdAt:now,approvedAt:now};row.versions=[pv];row.messages=[{id:'22222222-2222-4222-8222-222222222222',author:'customer',action:'feedback',visibility:'customer',resolved:false,workflow:{status:'review',resultVersionId:pv.id,updatedAt:'2026-10-13T03:00:00Z',history:[{action:'submit_review',at:'2026-10-13T03:00:00Z'}]}}];row.schedulePlan.internalReviewDays=2;f.store.put('clientProjects',a.id,row);
  let report=f.get();assert.equal(report.days[0].projectCount,2);assert.equal(report.days[0].projects.find(project=>project.projectId===a.id).milestones[0].dateType,'check');f.store.put('users',f.users.reviewer.id,{...f.users.reviewer,active:false});report=f.get();assert.deepEqual(report.days,[]);assert.equal(report.counts.rangeProjectCount,1);assert.equal(report.counts.visibleProjectCount,2);
});

test('reading deadline overlap never writes source projects, dates, personal drafts or task records',async t=>{
  const f=await fixture(t);f.create();f.create();f.store.put('clientDrafts','synthetic',{ciphertext:'not-read'});const before=f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all();for(let i=0;i<3;i++)assert.equal(f.get().days[0].projectCount,2);assert.deepEqual(f.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all(),before);
});

test('service reads one fresh workspace and surfaces source failure rather than returning empty success',()=>{
  const user={id:'owner',active:true,role:'member',teamId:'a'};let calls=0;const store={get:(kind,id)=>kind==='users'&&id===user.id?user:null},clientProjects={workspace:live=>{assert.equal(live,user);calls++;return {projects:[]};}},service=createClientDeadlineOverlapsService({store,clientProjects,clock:()=>now});assert.equal(service.get({...user,role:'admin'}).counts.visibleProjectCount,0);assert.equal(calls,1);
  clientProjects.workspace=()=>{throw Object.assign(new Error('source unavailable'),{status:503});};status(()=>service.get(user),503);
});
