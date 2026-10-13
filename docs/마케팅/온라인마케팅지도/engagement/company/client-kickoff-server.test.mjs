import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {emptyStrategyData} from './pulse-strategy.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=','base64');
const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const strategy={...emptyStrategyData(),objective:'brand',product:'합성 제품',audience:'합성 대상',primaryPromise:'핵심 약속',evidence1:'직접 확인할 수 있는 사용 장면',memoryHook:'기억할 장면',desiredAction:'직접 볼 것',value1:'이해',value2:'재미',channels:['youtube'],screenCopy:'확정할 화면 문구',proposedDeadline:'2099-12-31'};
async function fixture(t){
  const fixtureAt=new Date().toISOString(),clock=()=>fixtureAt;
  const directory=await mkdtemp(join(tmpdir(),'synk-kickoff-http-'));
  let app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,clock}),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const users={},tokens={};
  for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['other','member','b'],['viewer','viewer','a'],['manager','manager','a']]){users[name]=app.store.createUser({name,email:name+'@kickoff.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'test-csrf'},60);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-kickoff-http-')));await rm(directory,{recursive:true,force:true});});
  async function request(path,{body,user='owner',customer,headers={},method=body===undefined?'GET':'POST'}={}){
    const response=await fetch(base+path,{method,headers:{...(customer?{Cookie:'synk_pulse_session='+customer.session}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':'test-csrf',...(customer?{'X-Pulse-CSRF':customer.csrf}:{}),'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,bytes,text:bytes.toString(),data:response.headers.get('content-type')?.startsWith('application/json')&&bytes.length?JSON.parse(bytes):null};
  }
  let row=app.clientProjects.save(users.owner,{title:'합성 착수 준비',customerName:'합성 고객',reviewerId:users.reviewer.id,stage:'planning',dueDate:today(),terms:'영상과 화면 문구, 수정 범위 협의 기록',internalNotes:'PRIVATE-KICKOFF-NOTES',contact:'PRIVATE-KICKOFF-CONTACT'}).project;
  const id=row.id,path='/api/client-projects/'+id+'/kickoff',raw=()=>app.clientProjects.project(users.owner,id);
  const studio=()=>createPulseStudioService({store:app.store,clientProjects:app.clientProjects});
  studio().staffMutate(users.owner,id,{revision:raw().revision,action:'save_strategy',strategy});
  studio().staffMutate(users.owner,id,{revision:raw().revision,action:'request_strategy_review'});
  const invite=app.clientProjects.invite(users.owner,id,{revision:raw().revision}),customer=app.clientProjects.open(invite.invite);
  studio().customerMutate(customer.session,customer.csrf,{revision:raw().revision,action:'confirm_strategy',strategyRevision:raw().studio.strategy.revision});
  await mkdir(join(directory,'studio-media'),{recursive:true});
  async function addAsset(staff=false){const assetId=randomUUID(),metadata={id:assetId,diskName:assetId+'.png',fileName:staff?'PRIVATE-ASSET.png':'고객 로고.png',mimeType:'image/png',byteSize:png.length};await writeFile(join(directory,'studio-media',metadata.diskName),png);if(staff)studio().staffUpload(users.owner,id,raw().revision,metadata);else studio().customerUpload(customer.session,customer.csrf,raw().revision,metadata);return metadata;}
  const publicAsset=await addAsset(),privateAsset=await addAsset(true);
  async function view(){const response=await request('/api/client-projects');assert.equal(response.status,200,response.text);return response.data.projects.find(p=>p.id===id);}
  const mutate=async(input,options={})=>request(path,{body:{revision:raw().revision,...input},...options});
  const configure=()=>mutate({action:'configure',enabled:true,dueDate:today(),requirements:[{label:'로고 원본',required:true}]});
  const submit=async(sourceKey='asset:'+publicAsset.id,extra={},options={})=>request('/pulse/api/action',{customer,body:{action:'submit_kickoff_source',revision:raw().revision,requirementId:(await view()).kickoff.requirements[0].id,sourceKey,...extra},...options});
  const review=async()=>{const p=await view(),requirement=p.kickoff.requirements[0];return mutate({action:'review',requirementId:requirement.id,sourceFingerprint:requirement.sourceFingerprint,confirmed:true});};
  async function restart(dataDir=directory){await app.stop();app=createCompanyApp({dataDir,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false});address=await app.start();base='http://127.0.0.1:'+address.port;}
  return {directory,users,customer,id,path,raw,studio,request,view,mutate,configure,submit,review,restart,publicAsset,privateAsset,get app(){return app;}};
}

test('kickoff HTTP requires staff permission, origin, CSRF and current revision',async t=>{
  const f=await fixture(t),input={action:'configure',enabled:true,dueDate:today(),requirements:[{label:'원본',required:true}]};
  for(const [options,status]of [[{user:null},403],[{user:'other'},404],[{user:'reviewer'},403],[{user:'viewer'},403],[{customer:f.customer},403],[{headers:{Origin:'https://evil.test'}},403],[{headers:{'X-CSRF-Token':'bad'}},403]])assert.equal((await f.mutate(input,options)).status,status);
  const old=f.raw().revision,saved=await f.mutate(input,{user:'manager'});assert.equal(saved.status,200,saved.text);
  assert.equal((await f.mutate({...input,revision:old})).status,409);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal((await f.mutate(input)).status,403);
});

test('customer submission means received, explicit staff review means ready, and today work clears',async t=>{
  const f=await fixture(t);assert.equal((await f.view()).kickoff.enabled,false);assert.equal((await f.configure()).status,200);
  const workflow=()=>f.request('/api/client-workflow');assert.equal((await workflow()).data.items.filter(x=>x.kind==='client_kickoff').length,1);
  const submitted=await f.submit();assert.equal(submitted.status,200,submitted.text);assert.equal(submitted.data.project.kickoff.requirements[0].status,'received');
  let p=await f.view();assert.equal(p.kickoff.status,'waiting');assert.equal(p.kickoff.confirmedDeadline,today());assert.equal(p.kickoff.requestedDeadline,'2099-12-31');
  const reviewed=await f.review();assert.equal(reviewed.status,200,reviewed.text);p=await f.view();assert.equal(p.kickoff.status,'ready');assert.equal(p.stage,'planning');assert.equal((await workflow()).data.items.filter(x=>x.kind==='client_kickoff').length,0);
});

test('customer projection and source validation protect internal assets, reviews and settings',async t=>{
  const f=await fixture(t);await f.configure();let p=await f.view();const req=p.kickoff.requirements[0];
  assert.ok((await f.mutate({action:'link',requirementId:req.id,sourceKey:'asset:'+f.privateAsset.id})).status===200);
  const result=await f.request('/pulse/api/project',{customer:f.customer}),serialized=JSON.stringify(result.data.project.kickoff);
  assert.equal(result.status,200);assert.doesNotMatch(serialized,/PRIVATE|diskName|authorId|sourceFingerprint|waiverReason|requestText/);assert.ok(!serialized.includes(f.privateAsset.id));
  assert.notEqual((await f.submit('asset:'+f.privateAsset.id)).status,200);
  assert.notEqual((await f.submit('asset:'+randomUUID())).status,200);
  assert.equal((await f.submit('asset:'+f.publicAsset.id,{}, {headers:{'X-Pulse-CSRF':'bad'}})).status,403);
  assert.notEqual((await f.submit('asset:'+f.publicAsset.id,{confirmed:true,sourceFingerprint:'forged'})).status,200);
});

test('source and strategy changes invalidate readiness while preserving existing original records',async t=>{
  const f=await fixture(t);await f.configure();await f.submit();await f.review();const p=await f.view(),req=p.kickoff.requirements[0],old=f.raw().studio.strategy.data;
  f.studio().staffMutate(f.users.owner,f.id,{revision:f.raw().revision,action:'save_strategy',strategy:{...old,screenCopy:'새 문구'}});
  assert.equal((await f.view()).kickoff.status,'waiting');assert.ok(f.raw().studio.strategy.history.length>0);
  assert.equal((await f.mutate({revision:p.revision,action:'review',requirementId:req.id,sourceFingerprint:req.sourceFingerprint,confirmed:true})).status,409);
  const asset=f.raw().studio.assets.find(a=>a.id===f.publicAsset.id);f.app.store.put('clientProjects',f.id,{...f.raw(),studio:{...f.raw().studio,assets:f.raw().studio.assets.map(a=>a.id===asset.id?{...a,fileName:'교체된 로고.png'}:a)}});
  assert.equal((await f.view()).kickoff.requirements[0].status,'received');
});

test('waiver needs a reason, can be undone, and no internal waiver note leaks to customer',async t=>{
  const f=await fixture(t);await f.configure();const req=(await f.view()).kickoff.requirements[0];
  assert.notEqual((await f.mutate({action:'waive',requirementId:req.id,reason:''})).status,200);
  const waived=await f.mutate({action:'waive',requirementId:req.id,reason:'PRIVATE-WAIVER: 이번 제작에는 필요 없음'});assert.equal(waived.status,200,waived.text);assert.equal((await f.view()).kickoff.status,'ready');
  assert.doesNotMatch(JSON.stringify((await f.request('/pulse/api/project',{customer:f.customer})).data.project),/PRIVATE-WAIVER/);
  assert.equal((await f.mutate({action:'reset',requirementId:req.id})).status,200);assert.equal((await f.view()).kickoff.status,'waiting');
});

test('customer resubmission cannot undo a staff waiver until staff explicitly resets it',async t=>{
  const f=await fixture(t);await f.configure();await f.submit();const req=(await f.view()).kickoff.requirements[0];
  assert.equal((await f.mutate({action:'waive',requirementId:req.id,reason:'이번 제작에는 필요 없음'})).status,200);
  const before=structuredClone(f.raw());
  for(const sourceKey of ['asset:'+f.publicAsset.id,'strategy:screenCopy']){
    const response=await f.submit(sourceKey);assert.equal(response.status,409,response.text);
    assert.deepEqual(f.raw(),before);
  }
  assert.equal((await f.request('/pulse/api/project',{customer:f.customer})).data.project.kickoff.requirements[0].status,'waived');
  assert.equal((await f.mutate({action:'reset',requirementId:req.id})).status,200);
  const submitted=await f.submit('strategy:screenCopy');assert.equal(submitted.status,200,submitted.text);
  assert.equal(submitted.data.project.kickoff.requirements[0].status,'received');
});

test('repeated reads do not mutate tasks and archive removes kickoff work and customer access',async t=>{
  const f=await fixture(t);await f.configure();const before=f.raw().revision;
  const a=await f.request('/api/client-workflow'),b=await f.request('/api/client-workflow');assert.deepEqual(a.data,b.data);assert.equal(f.raw().revision,before);
  for(const user of ['reviewer','other','viewer','manager'])assert.equal((await f.request('/api/client-workflow',{user})).data.items.filter(x=>x.kind==='client_kickoff').length,0);
  const raw=f.raw();f.app.clientProjects.save(f.users.owner,{...raw,revision:raw.revision,stage:'archived'},f.id);
  assert.equal((await f.request('/api/client-workflow')).data.items.filter(x=>x.kind==='client_kickoff').length,0);assert.equal((await f.request('/pulse/api/project',{customer:f.customer})).status,401);assert.equal((await f.configure()).status,409);
});

test('kickoff state and exact source file survive restart and workspace backup restoration',async t=>{
  const f=await fixture(t);await f.configure();await f.submit();await f.review();const before=(await f.view()).kickoff;
  await f.restart();assert.deepEqual((await f.view()).kickoff,before);
  const backupRoot=await mkdtemp(join(tmpdir(),'synk-kickoff-backup-'));t.after(async()=>{assert.equal(dirname(resolve(backupRoot)),resolve(tmpdir()));await rm(backupRoot,{recursive:true,force:true});});
  await f.app.stop();const baseline=await backupWorkspace({destination:backupRoot,companyDataDir:f.directory,messengerDataDir:join(f.directory,'messenger')});assert.ok((await readFile(join(baseline,'COMPLETE'),'utf8')).length);
  assert.deepEqual(await readFile(join(baseline,'company','studio-media',f.publicAsset.diskName)),png);
  await f.restart(join(baseline,'company'));assert.deepEqual((await f.view()).kickoff,before);assert.deepEqual((await f.request('/pulse/api/studio/media/'+f.publicAsset.id,{customer:f.customer})).bytes,png);
});

test('new browser modules are served as JavaScript and contain no login HTML fallback',async t=>{
  const f=await fixture(t);for(const path of ['/client-kickoff.js','/client-kickoff.css','/pulse-app/kickoff-view.mjs']){const r=await f.request(path);assert.equal(r.status,200,path);assert.doesNotMatch(r.text,/<!doctype html>/i,path);}
});
