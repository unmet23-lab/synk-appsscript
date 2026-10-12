import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-schedule-http-'));let now='2026-10-08T00:00:00.000Z',app,base;
  const options={dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,clock:()=>now};
  async function start(dataDir=directory){app=createCompanyApp({...options,dataDir});const address=await app.start();base='http://127.0.0.1:'+address.port;}await start();
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-schedule-http-')));await rm(directory,{recursive:true,force:true});});
  const users={},tokens={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['other','member','b'],['viewer','viewer','a']]){users[name]=app.store.createUser({name,email:name+'@schedule.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'test-csrf'},60);}
  let row=app.clientProjects.save(users.owner,{title:'합성 일정 점검',customerName:'합성 고객',reviewerId:users.reviewer.id,stage:'producing',dueDate:'2026-10-15',terms:'합성 영상 1편',internalNotes:'PRIVATE-SCHEDULE-PROJECT'}).project;
  row=app.clientProjects.addVersion(users.owner,row.id,{revision:row.revision,kind:'preview',label:'합성 시안',url:'https://example.test/preview.mp4'}).project;
  const id=row.id,versionId=row.versions[0].id,raw=()=>app.clientProjects.project(users.owner,id),invite=app.clientProjects.invite(users.owner,id,{revision:raw().revision}),customer=app.clientProjects.open(invite.invite);
  const config={action:'configure',enabled:true,calendar:'calendar',targets:{kickoff:'',preview:'2026-10-09',customer:'2026-10-10',revision:'',delivery:'2026-10-15'},remainingWorkDays:2,customerWaitDays:1,internalReviewDays:2};now='2026-10-12T00:00:00.000Z';
  async function request(path,{body,user='owner',asCustomer=false,headers={}}={}){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(asCustomer?{Cookie:'synk_pulse_session='+customer.session}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'test-csrf',...(asCustomer?{'X-Pulse-CSRF':customer.csrf}:{})}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const bytes=Buffer.from(await response.arrayBuffer()),text=bytes.toString();return {status:response.status,bytes,text,data:response.headers.get('content-type')?.startsWith('application/json')&&bytes.length?JSON.parse(text):null};}
  const configure=(patch={},options={})=>request('/api/client-projects/'+id+'/schedule',{body:{...config,revision:raw().revision,...patch},...options});
  async function report(user='owner'){const r=await request('/api/client-projects',{user});assert.equal(r.status,200,r.text);return r.data.projects.find(p=>p.id===id)?.schedule;}
  const approve=()=>request('/pulse/api/action',{asCustomer:true,body:{revision:raw().revision,action:'approve',versionId}});
  const workflow=async(user='owner')=>(await request('/api/client-workflow',{user})).data.items.filter(item=>item.kind==='client_schedule');
  async function restart(dataDir=directory){await app.stop();await start(dataDir);}
  return {id,versionId,directory,users,raw,config,customer,request,configure,report,approve,workflow,restart,setNow:value=>now=value,get app(){return app;}};
}

test('schedule HTTP enforces current ACL, origin, CSRF and project revision',async t=>{
  const f=await fixture(t);for(const [options,status]of [[{user:null},403],[{user:'other'},404],[{user:'reviewer'},403],[{user:'viewer'},403],[{asCustomer:true},403],[{headers:{Origin:'https://evil.test'}},403],[{headers:{'X-CSRF-Token':'bad'}},403]])assert.equal((await f.configure({},options)).status,status);
  const old=f.raw().revision;assert.equal((await f.configure()).status,200);assert.equal((await f.configure({revision:old,remainingWorkDays:3})).status,409);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal((await f.configure({remainingWorkDays:3})).status,403);
});

test('schedule settings preserve agreed dates and current source approval controls delayed work',async t=>{
  const f=await fixture(t),before={dueDate:f.raw().dueDate,stage:f.raw().stage,versions:structuredClone(f.raw().versions)};const saved=await f.configure();assert.equal(saved.status,200,saved.text);
  let report=await f.report();assert.ok(report.pendingCount>0);assert.ok(report.waiting.some(item=>item.overdue));assert.equal(report.milestones.find(item=>item.id==='preview').status,'complete');assert.equal(report.estimatedFinishDate,'2026-10-14');assert.equal(f.raw().dueDate,before.dueDate);assert.equal(f.raw().stage,before.stage);assert.deepEqual(f.raw().versions,before.versions);
  assert.equal((await f.approve()).status,200);report=await f.report();assert.equal(report.waiting.length,0);assert.equal(report.pendingCount,0);assert.equal(report.milestones.find(item=>item.id==='customer').status,'complete');
});

test('clock passage changes due risk without mutating records or duplicating Today items',async t=>{
  const f=await fixture(t);await f.configure({targets:{kickoff:'',preview:'',customer:'',revision:'',delivery:''},remainingWorkDays:null,customerWaitDays:7});const before=structuredClone(f.raw());assert.equal((await f.report()).pendingCount,0);assert.equal((await f.workflow()).length,0);
  f.setNow('2026-10-15T00:00:00.000Z');assert.ok((await f.report()).pendingCount>0);assert.equal((await f.workflow()).length,1);assert.equal((await f.workflow()).length,1);assert.deepEqual(f.raw(),before);
  for(const user of ['other','reviewer','viewer'])assert.equal((await f.workflow(user)).length,0);
});

test('weekly attention and stage dates link to the same schedule while disabled plans retain settings',async t=>{
  const f=await fixture(t);await f.configure();const weekly=await f.request('/api/weekly-summary');assert.equal(weekly.status,200,weekly.text);assert.ok(weekly.data.sections.find(s=>s.id==='attention').items.some(i=>i.kind==='client_schedule'&&i.href.endsWith('&schedule=1')));assert.ok(weekly.data.sections.find(s=>s.id==='upcoming').items.some(i=>i.kind==='client_schedule_due'&&i.dueDate==='2026-10-15'));
  assert.equal((await f.configure({enabled:false})).status,200);assert.equal((await f.workflow()).length,0);const disabled=await f.report();assert.equal(disabled.enabled,false);assert.equal(disabled.targets.customer,'2026-10-10');assert.equal(disabled.pendingCount,0);
});

test('customer projections omit internal plan, duration estimates, goals and history',async t=>{
  const f=await fixture(t);await f.configure();for(const path of ['/pulse/api/project','/pulse/api/studio']){const response=await f.request(path,{asCustomer:true});assert.equal(response.status,200,response.text);assert.doesNotMatch(response.text,/schedulePlan|remainingWorkDays|customerWaitDays|internalReviewDays|estimatedFinishDate|PRIVATE-SCHEDULE/);assert.equal(response.data.project.schedule,undefined);}
});

test('unknown keys, impossible dates, fractions and duplicates cannot alter schedule history',async t=>{
  const f=await fixture(t),before=structuredClone(f.raw());for(const patch of [{dueDate:'2030-01-01'},{remainingWorkDays:-1},{remainingWorkDays:1.5},{customerWaitDays:0},{targets:{...f.config.targets,customer:'2026-02-30'}},{targets:{...f.config.targets,unknown:'2026-10-13'}}]){const result=await f.configure(patch);assert.equal(result.status,400,result.text);assert.deepEqual(f.raw(),before);}
  assert.equal((await f.configure()).status,200);const saved=structuredClone(f.raw());assert.equal((await f.configure()).status,409);assert.deepEqual(f.raw(),saved);
});

test('restart and existing workspace backup preserve plan and original media',async t=>{
  const f=await fixture(t);await f.configure();const assetId=randomUUID(),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=','base64');await mkdir(join(f.directory,'studio-media'),{recursive:true});await writeFile(join(f.directory,'studio-media',assetId+'.png'),png);
  f.app.clientProjects.addVersion(f.users.owner,f.id,{revision:f.raw().revision,kind:'preview',label:'합성 새 시안'},{id:assetId,diskName:assetId+'.png',fileName:'합성 시안.png',mimeType:'image/png',byteSize:png.length});const before=await f.report();await f.restart();assert.deepEqual(await f.report(),before);
  const backupRoot=await mkdtemp(join(tmpdir(),'synk-schedule-backup-'));t.after(async()=>{assert.equal(dirname(resolve(backupRoot)),resolve(tmpdir()));await rm(backupRoot,{recursive:true,force:true});});await f.app.stop();const backup=await backupWorkspace({destination:backupRoot,companyDataDir:f.directory,messengerDataDir:join(f.directory,'messenger')});await f.restart(join(backup,'company'));assert.deepEqual(await f.report(),before);const media=await f.request('/pulse/api/media/'+assetId,{asCustomer:true});assert.equal(media.status,200);assert.deepEqual(media.bytes,png);
});

test('schedule modules resolve to their real JavaScript and CSS',async t=>{
  const f=await fixture(t);for(const path of ['/client-schedule.js','/client-schedule.css','/pulse-app/schedule-view.mjs']){const r=await f.request(path);assert.equal(r.status,200);assert.doesNotMatch(r.text,/<!doctype html>/i);}
});
