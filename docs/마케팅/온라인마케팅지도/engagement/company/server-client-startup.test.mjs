import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-startup-api-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,clock:()=> '2026-10-12T01:00:00.000Z'});
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-startup-api-'));await rm(directory,{recursive:true,force:true});});
  for(const name of ['owner','other','viewer']){users[name]=app.store.createUser({name,email:name+'@startup-api.example',role:name==='viewer'?'viewer':'member',teamId:name==='other'?'b':'a'});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'startup-api'},30);}
  async function api(name,path,method='GET',input,options={}){
    const response=await fetch(base+path,{method,headers:{...(name?{Cookie:'synk_company_session='+sessions[name]}:{}),...(input?{Origin:app.origin,'Content-Type':'application/json',...(options.noCsrf?{}:{'X-CSRF-Token':options.csrf||'startup-api'})}:{}),...(options.headers||{})},...(input?{body:JSON.stringify(input)}:{})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  const project=app.clientProjects.save(users.owner,{title:'시작 설정 API 합성 프로젝트',customerName:'합성 고객',dueDate:'2026-11-10',internalNotes:'PRIVATE-STARTUP-MEMO'}).project;
  const read=()=>app.store.get('clientProjects',project.id),path=`/api/client-projects/${project.id}/startup`;
  const preview=()=>({action:'preview',revision:read().revision,presetId:'short_ad',referenceDate:'2026-10-12',calendar:'weekdays'});
  const apply=view=>({action:'apply',revision:view.revision,presetId:view.presetId,referenceDate:view.referenceDate,calendar:view.calendar,sections:['kickoff','schedule','deliverables'],draft:view.draft});
  return {app,api,users,read,id:project.id,path,preview,apply};
}

test('HTTP startup preview is read-only and apply appears in the existing kickoff, schedule and PULSE specification',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.read()),catalog=await f.api('owner',f.path);assert.equal(catalog.status,200);assert.equal(catalog.data.presets.length,3);assert.match(catalog.headers.get('cache-control'),/no-store/);
  const preview=await f.api('owner',f.path,'POST',f.preview());assert.equal(preview.status,200);assert.equal(JSON.stringify(f.read()),before);
  preview.data.draft.deliverables.items[0].durationSeconds=40;const applied=await f.api('owner',f.path,'POST',f.apply(preview.data));assert.equal(applied.status,200);assert.equal(applied.data.project.revision,preview.data.revision+1);assert.equal(applied.data.project.dueDate,'2026-11-10');assert.equal(applied.data.project.kickoff.enabled,true);assert.equal(applied.data.project.schedule.enabled,true);
  const studio=(await f.api('owner',`/api/client-projects/${f.id}/studio`)).data.project.studio;assert.equal(studio.deliverables.items[0].durationSeconds,40);assert.equal(studio.deliverables.request,null);assert.equal(studio.deliverables.confirmation,null);assert.equal(studio.strategy.revision,0);assert.equal(f.read().versions.length,0);
  const refreshed=(await f.api('owner',f.path)).data;assert.ok(Object.values(refreshed.sections).every(section=>!section.available));assert.equal((await f.api('owner',f.path,'POST',f.apply(preview.data))).status,409);
});

test('HTTP access, current role, CSRF and revision guard both preview and apply',async t=>{
  const f=await fixture(t),input=f.preview(),preview=(await f.api('owner',f.path,'POST',input)).data,apply=f.apply(preview),before=JSON.stringify(f.read());
  for(const [who,code] of [[null,401],['other',404],['viewer',403]]){assert.equal((await f.api(who,f.path)).status,code);const writeCode=who?code:403;assert.equal((await f.api(who,f.path,'POST',input)).status,writeCode);assert.equal((await f.api(who,f.path,'POST',apply)).status,writeCode);}
  assert.equal((await f.api('owner',f.path,'POST',apply,{noCsrf:true})).status,403);assert.equal((await f.api('owner',f.path,'POST',apply,{csrf:'wrong'})).status,403);assert.equal(JSON.stringify(f.read()),before);
  f.app.clientProjects.message(f.users.owner,f.id,{revision:f.read().revision,text:'동시 편집',visibility:'internal'});assert.equal((await f.api('owner',f.path,'POST',apply)).status,409);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal((await f.api('owner',f.path)).status,403);
});

test('HTTP malformed drafts fail atomically and customer PULSE sees unconfirmed specs without private plans',async t=>{
  const f=await fixture(t),preview=(await f.api('owner',f.path,'POST',f.preview())).data,invalid=f.apply(preview),before=JSON.stringify(f.read());invalid.draft.deliverables.items[0].confirmation={at:'forged'};
  assert.equal((await f.api('owner',f.path,'POST',invalid)).status,400);assert.equal(JSON.stringify(f.read()),before);delete invalid.draft.deliverables.items[0].confirmation;
  assert.equal((await f.api('owner',f.path,'POST',invalid)).status,200);const invitation=f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.read().revision}),customer=f.app.clientProjects.open(invitation.invite);
  const pulse=await f.api(null,'/pulse/api/studio','GET',undefined,{headers:{Cookie:'synk_pulse_session='+customer.session}});
  assert.equal(pulse.status,200);assert.equal(pulse.data.project.studio.deliverables.confirmation,null);assert.doesNotMatch(JSON.stringify(pulse.data),/PRIVATE-STARTUP-MEMO|schedulePlan|remainingWorkDays|internalReviewDays/);
});
