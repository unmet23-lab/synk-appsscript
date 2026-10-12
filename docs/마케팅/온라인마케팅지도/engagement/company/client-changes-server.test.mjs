import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {emptyStrategyData} from './pulse-strategy.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=','base64');
const strategy={...emptyStrategyData(),objective:'brand',product:'합성 제품',audience:'합성 고객',primaryPromise:'함께 확인',evidence1:'직접 확인할 수 있는 사용 장면',memoryHook:'확정 기준',desiredAction:'변경 확인',value1:'정확함',value2:'편리함',channels:['youtube'],durationSeconds:30,screenCopy:'첫 확정 문구',proposedDeadline:'2099-12-30'};
async function fixture(t){
  const fixtureAt=new Date().toISOString(),clock=()=>fixtureAt;
  const directory=await mkdtemp(join(tmpdir(),'synk-changes-http-'));
  let app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,clock}),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const users={},tokens={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['other','member','b'],['viewer','viewer','a'],['manager','manager','a']]){users[name]=app.store.createUser({name,email:name+'@changes.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'test-csrf'},60);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-changes-http-')));await rm(directory,{recursive:true,force:true});});
  async function request(path,{body,user='owner',customer,headers={},method=body===undefined?'GET':'POST'}={}){
    const response=await fetch(base+path,{method,headers:{...(customer?{Cookie:'synk_pulse_session='+customer.session}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':'test-csrf',...(customer?{'X-Pulse-CSRF':customer.csrf}:{}),'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,bytes,text:bytes.toString(),data:response.headers.get('content-type')?.startsWith('application/json')&&bytes.length?JSON.parse(bytes):null};
  }
  const row=app.clientProjects.save(users.owner,{title:'합성 변경 추적',customerName:'합성 고객',reviewerId:users.reviewer.id,stage:'planning',dueDate:'2099-12-31',terms:'30초 영상 1편',internalNotes:'PRIVATE-CHANGE-NOTE',contact:'PRIVATE-CONTACT'}).project,id=row.id;
  const raw=()=>app.clientProjects.project(users.owner,id),studio=()=>createPulseStudioService({store:app.store,clientProjects:app.clientProjects});
  const saveStrategy=patch=>studio().staffMutate(users.owner,id,{revision:raw().revision,action:'save_strategy',strategy:{...raw().studio?.strategy?.data||strategy,...patch}});
  saveStrategy(strategy);
  const invite=app.clientProjects.invite(users.owner,id,{revision:raw().revision}),customer=app.clientProjects.open(invite.invite);
  const confirm=()=>{studio().staffMutate(users.owner,id,{revision:raw().revision,action:'request_strategy_review'});studio().customerMutate(customer.session,customer.csrf,{revision:raw().revision,action:'confirm_strategy',strategyRevision:raw().studio.strategy.revision});};confirm();
  const saveScene=(patch={},sceneId)=>studio().staffMutate(users.owner,id,{revision:raw().revision,action:'save_scene',...(sceneId?{id:sceneId}:{}),title:'기획 v1 장면',description:'제작 내용',narration:'안녕하세요',screenText:'첫 확정 문구',duration:30,visibility:'customer',purpose:'hook',valueNumbers:[1],...patch});saveScene();saveScene({title:'PRIVATE-SCENE',visibility:'internal'});
  await mkdir(join(directory,'studio-media'),{recursive:true});const assetId=randomUUID(),publicAsset={id:assetId,diskName:assetId+'.png',fileName:'공유 로고.png',mimeType:'image/png',byteSize:png.length};await writeFile(join(directory,'studio-media',publicAsset.diskName),png);studio().customerUpload(customer.session,customer.csrf,raw().revision,publicAsset);
  const privateId=randomUUID(),privateAsset={id:privateId,diskName:privateId+'.png',fileName:'PRIVATE-ASSET.png',mimeType:'image/png',byteSize:png.length};await writeFile(join(directory,'studio-media',privateAsset.diskName),png);studio().staffUpload(users.owner,id,raw().revision,privateAsset);
  const path='/api/client-projects/'+id+'/changes';
  const mutate=(body,options={})=>request(path,{body:{revision:raw().revision,...body},...options});
  const capture=()=>mutate({action:'capture',confirmed:true});
  async function view(){const r=await request('/api/client-projects');assert.equal(r.status,200,r.text);return r.data.projects.find(p=>p.id===id);}
  async function reviewAll(){const report=(await view()).changes;for(const impact of report.impacts.filter(i=>!i.checked)){const r=await mutate({action:'review',changeKey:report.changeKey,impactId:impact.id,decision:'unchanged',note:'PRIVATE-REVIEW-NOTE',confirmed:true});assert.equal(r.status,200,r.text);}}
  async function restart(dataDir=directory){await app.stop();app=createCompanyApp({dataDir,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false});address=await app.start();base='http://127.0.0.1:'+address.port;}
  return {directory,users,id,raw,studio,request,view,mutate,capture,saveStrategy,saveScene,confirm,reviewAll,restart,customer,publicAsset,privateAsset,get app(){return app;}};
}

test('change tracking HTTP protects staff ACL, origin, CSRF, latest role and current revision',async t=>{
  const f=await fixture(t),input={action:'capture',confirmed:true};
  for(const [options,status]of [[{user:null},403],[{user:'other'},404],[{user:'reviewer'},403],[{user:'viewer'},403],[{customer:f.customer},403],[{headers:{Origin:'https://evil.test'}},403],[{headers:{'X-CSRF-Token':'bad'}},403]])assert.equal((await f.mutate(input,options)).status,status);
  const before=f.raw().revision,result=await f.mutate(input,{user:'manager'});assert.equal(result.status,200,result.text);assert.equal((await f.mutate({...input,revision:before})).status,409);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal((await f.mutate({action:'set_enabled',enabled:false})).status,403);
});

test('capture requires explicit agreement and cannot overwrite an existing comparison baseline',async t=>{
  const f=await fixture(t);assert.equal((await f.view()).changes.enabled,false);const before=structuredClone(f.raw());assert.notEqual((await f.mutate({action:'capture',confirmed:false})).status,200);assert.deepEqual(f.raw(),before);
  f.saveStrategy({durationSeconds:31});assert.equal((await f.capture()).status,409);f.confirm();assert.equal((await f.capture()).status,200);const saved=structuredClone(f.raw());assert.equal((await f.capture()).status,409);assert.deepEqual(f.raw(),saved);
});

test('changed planning flows through staff impact reviews and real customer confirmation before advancing',async t=>{
  const f=await fixture(t);assert.equal((await f.capture()).status,200);const baseline=(await f.view()).changes.baseline;f.saveStrategy({durationSeconds:60,screenCopy:'새 문구'});
  let p=await f.view();assert.equal(p.changes.status,'pending');assert.ok(p.changes.changes.some(d=>d.before.includes('30')&&d.after.includes('60')));assert.equal(p.changes.currentStrategyConfirmed,false);
  const work=await f.request('/api/client-workflow');assert.equal(work.data.items.filter(i=>i.kind==='client_changes').length,1);assert.match(work.data.items.find(i=>i.kind==='client_changes').href,/changes=1$/);
  await f.reviewAll();p=await f.view();assert.equal(p.changes.status,'pending');assert.equal((await f.mutate({action:'advance',changeKey:p.changes.changeKey,confirmed:true})).status,409);
  f.confirm();p=await f.view();assert.equal(p.changes.status,'reviewed');assert.equal(p.changes.canAdvance,true);
  const advanced=await f.mutate({action:'advance',changeKey:p.changes.changeKey,confirmed:true});assert.equal(advanced.status,200,advanced.text);p=await f.view();assert.equal(p.changes.status,'clean');assert.notEqual(p.changes.baseline.id,baseline.id);assert.ok(p.changes.history.length>=1);assert.equal(p.stage,'planning');assert.equal(p.versions.length,0);assert.equal((await f.request('/api/client-workflow')).data.items.filter(i=>i.kind==='client_changes').length,0);
});

test('new edits reject stale change keys and invalidate prior impact acknowledgements',async t=>{
  const f=await fixture(t);await f.capture();f.saveStrategy({durationSeconds:60});await f.reviewAll();const before=(await f.view()).changes,scene=f.raw().studio.scenes[0];
  f.saveScene({title:'편집한 장면',duration:60},scene.id);const report=(await f.view()).changes;assert.notEqual(report.changeKey,before.changeKey);assert.ok(report.impacts.some(i=>!i.checked));
  assert.equal((await f.mutate({action:'review',changeKey:before.changeKey,impactId:before.impacts[0].id,decision:'unchanged',note:'stale',confirmed:true})).status,409);
});

test('customer change view omits private scenes, assets, checks, actors and review notes',async t=>{
  const f=await fixture(t);await f.capture();f.saveStrategy({durationSeconds:60});await f.reviewAll();
  const r=await f.request('/pulse/api/project',{customer:f.customer});assert.equal(r.status,200,r.text);const c=r.data.project.changes,serialized=JSON.stringify(c);assert.ok(c.changes.length>0);assert.doesNotMatch(serialized,/PRIVATE|changeKey|fingerprint|diskName|authorId|impactId|pastBaselines/);assert.ok(!serialized.includes(f.privateAsset.id));assert.ok(!serialized.includes(f.users.owner.id));
  assert.equal((await f.request('/pulse/api/action',{customer:f.customer,body:{revision:f.raw().revision,action:'advance',confirmed:true,changeKey:(await f.view()).changes.changeKey}})).status,400);
});

test('HTTP review requires explicit confirmation and valid decision, and duplicate submission never adds history',async t=>{
  const f=await fixture(t);await f.capture();f.saveStrategy({durationSeconds:60});const report=(await f.view()).changes,body={action:'review',changeKey:report.changeKey,impactId:report.impacts[0].id,decision:'unchanged',note:'확인',confirmed:true};
  for(const patch of [{confirmed:false},{decision:'auto'},{note:'x'.repeat(601)},{unexpected:true}]){const before=structuredClone(f.raw());assert.notEqual((await f.mutate({...body,...patch})).status,200);assert.deepEqual(f.raw(),before);}
  assert.equal((await f.mutate(body)).status,200);const saved=structuredClone(f.raw());assert.equal((await f.mutate(body)).status,409);assert.deepEqual(f.raw(),saved);
});

test('today and weekly derive current work without duplicates and disabling preserves the baseline',async t=>{
  const f=await fixture(t);await f.capture();f.saveStrategy({durationSeconds:60});const baseline=(await f.view()).changes.baseline,revision=f.raw().revision;
  const a=await f.request('/api/client-workflow'),b=await f.request('/api/client-workflow');assert.deepEqual(a.data,b.data);assert.equal(f.raw().revision,revision);
  for(const user of ['reviewer','other','viewer','manager'])assert.equal((await f.request('/api/client-workflow',{user})).data.items.filter(i=>i.kind==='client_changes').length,0);
  const weekly=await f.request('/api/weekly-summary');assert.equal(weekly.status,200,weekly.text);assert.ok(JSON.stringify(weekly.data).includes('client_changes'));assert.doesNotMatch(JSON.stringify(weekly.data),/PRIVATE-/);
  assert.equal((await f.mutate({action:'set_enabled',enabled:false})).status,200);assert.deepEqual((await f.view()).changes.baseline,baseline);assert.equal((await f.request('/api/client-workflow')).data.items.filter(i=>i.kind==='client_changes').length,0);
  assert.equal((await f.mutate({action:'set_enabled',enabled:true})).status,200);assert.equal((await f.view()).changes.status,'pending');
  const raw=f.raw();f.app.clientProjects.save(f.users.owner,{...raw,revision:raw.revision,stage:'archived'},f.id);assert.equal((await f.request('/api/client-workflow')).data.items.filter(i=>i.kind==='client_changes').length,0);assert.equal((await f.mutate({action:'set_enabled',enabled:false})).status,409);
});

test('pinned baseline survives more than twenty strategy saves and compares the original agreed value',async t=>{
  const f=await fixture(t);await f.capture();const baseline=(await f.view()).changes.baseline;for(let n=0;n<22;n++)f.saveStrategy({durationSeconds:40+n});
  const p=await f.view();assert.equal(f.raw().studio.strategy.history.length,20);assert.deepEqual(p.changes.baseline,baseline);assert.ok(p.changes.changes.some(d=>d.before.includes('30')&&d.after.includes('61')));
});

test('comparison baseline and reviews survive restart and existing backup restore alongside original media',async t=>{
  const f=await fixture(t);await f.capture();f.saveStrategy({durationSeconds:60});await f.reviewAll();const before=(await f.view()).changes;
  await f.restart();assert.deepEqual((await f.view()).changes,before);
  const backupRoot=await mkdtemp(join(tmpdir(),'synk-changes-backup-'));t.after(async()=>{assert.equal(dirname(resolve(backupRoot)),resolve(tmpdir()));await rm(backupRoot,{recursive:true,force:true});});
  await f.app.stop();const backup=await backupWorkspace({destination:backupRoot,companyDataDir:f.directory,messengerDataDir:join(f.directory,'messenger')});assert.ok((await readFile(join(backup,'COMPLETE'),'utf8')).length);
  await f.restart(join(backup,'company'));assert.deepEqual((await f.view()).changes,before);assert.deepEqual((await f.request('/pulse/api/studio/media/'+f.publicAsset.id,{customer:f.customer})).bytes,png);
});

test('new and dependent browser modules resolve without HTML fallbacks',async t=>{
  const f=await fixture(t);for(const path of ['/client-changes.js','/client-changes.css','/pulse-app/changes-view.mjs','/pulse-app/app.mjs','/pulse-app/views.mjs','/pulse-app/install.mjs']){const r=await f.request(path);assert.equal(r.status,200,path);assert.doesNotMatch(r.text,/<!doctype html>/i,path);}
});
