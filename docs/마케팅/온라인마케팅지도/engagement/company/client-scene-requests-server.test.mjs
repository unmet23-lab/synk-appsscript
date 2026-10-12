import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=','base64');
async function fixture(t,{reviewer=false}={}){
  const fixtureAt=new Date().toISOString(),clock=()=>fixtureAt;
  const directory=await mkdtemp(join(tmpdir(),'synk-scene-http-'));
  let app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,clock}),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const users={},tokens={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['other','member','b'],['viewer','viewer','a']]){users[name]=app.store.createUser({name,email:name+'@scene.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'test-csrf'},60);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-scene-http-')));await rm(directory,{recursive:true,force:true});});
  const row=app.clientProjects.save(users.owner,{title:'합성 장면 요청',customerName:'합성 고객',reviewerId:reviewer?users.reviewer.id:null,stage:'producing',internalNotes:'PRIVATE-PROJECT'}).project,id=row.id;
  const raw=()=>app.clientProjects.project(users.owner,id),studio=()=>createPulseStudioService({store:app.store,clientProjects:app.clientProjects});
  studio().staffMutate(users.owner,id,{revision:raw().revision,action:'save_scene',title:'고객 공개 장면',description:'합성 장면',narration:'처음 말',screenText:'이전 문구',duration:10,visibility:'customer',purpose:'hook',valueNumbers:[]});
  const sceneId=raw().studio.scenes[0].id;
  const invite=app.clientProjects.invite(users.owner,id,{revision:raw().revision}),customer=app.clientProjects.open(invite.invite);
  async function request(path,{body,user='owner',asCustomer=false,headers={}}={}){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(asCustomer?{Cookie:'synk_pulse_session='+customer.session}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':'test-csrf',...(asCustomer?{'X-Pulse-CSRF':customer.csrf}:{}),'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,text:bytes.toString(),bytes,data:response.headers.get('content-type')?.startsWith('application/json')&&bytes.length?JSON.parse(bytes):null};}
  async function review(status='changes',text='화면 문구를 바꿔 주세요.',sceneRevision=raw().studio.scenes[0].revision){return request('/pulse/api/studio',{asCustomer:true,body:{revision:raw().revision,action:'review_scene',sceneId,sceneRevision,status,text}});}
  assert.equal((await review()).status,200);const requestId=raw().studio.sceneReviews.at(-1).id;
  const edit=(patch={})=>{const s=raw().studio.scenes[0];return studio().staffMutate(users.owner,id,{revision:raw().revision,action:'save_scene',id:sceneId,title:s.title,description:s.description,narration:s.narration,screenText:'새 화면 문구',duration:s.duration,visibility:s.visibility,purpose:'hook',valueNumbers:[],...patch});};
  const mutate=(body,options={})=>request('/api/client-projects/'+id+'/scene-requests',{body:{revision:raw().revision,requestId,...body},...options});
  async function item(){const r=await request('/api/client-projects');assert.equal(r.status,200,r.text);return r.data.projects.find(p=>p.id===id).sceneRequests.items.find(i=>i.id===requestId);}
  const submit=()=>mutate({action:'submit',sceneRevision:raw().studio.scenes[0].revision,confirmed:true,note:'PRIVATE-REVIEW-NOTE'});
  async function restart(dataDir=directory){await app.stop();app=createCompanyApp({dataDir,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false});address=await app.start();base='http://127.0.0.1:'+address.port;}
  return {directory,users,id,sceneId,requestId,raw,studio,request,review,edit,mutate,item,submit,restart,customer,get app(){return app;}};
}

test('scene request HTTP enforces identity, current role, origin, CSRF and project revision',async t=>{
  const f=await fixture(t);for(const [options,status]of [[{user:null},403],[{user:'other'},404],[{user:'viewer'},403],[{asCustomer:true},403],[{headers:{Origin:'https://evil.test'}},403],[{headers:{'X-CSRF-Token':'bad'}},403]])assert.equal((await f.mutate({action:'start'},options)).status,status);
  const before=f.raw().revision;assert.equal((await f.mutate({action:'start'})).status,200);assert.equal((await f.mutate({action:'reopen',revision:before})).status,409);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal((await f.mutate({action:'reopen'})).status,403);
});

test('only explicit staff submission followed by exact current customer scene confirmation completes a request',async t=>{
  const f=await fixture(t);assert.equal((await f.item()).status,'open');assert.equal((await f.submit()).status,409);f.edit();assert.notEqual((await f.item()).status,'done');
  assert.equal((await f.review('confirmed','')).status,200);assert.notEqual((await f.item()).status,'done','early customer confirmation does not replace staff submission');
  assert.equal((await f.submit()).status,200);assert.equal((await f.item()).status,'waiting_customer');assert.equal((await f.review('confirmed','',1)).status,409);assert.equal((await f.review('confirmed','')).status,200);assert.equal((await f.item()).status,'done');assert.equal(f.raw().stage,'producing');
});

test('assigned reviewer must approve current submitted scene and private review notes never reach the customer',async t=>{
  const f=await fixture(t,{reviewer:true});f.edit();assert.equal((await f.submit()).status,200);assert.equal((await f.item()).status,'review');
  assert.equal((await f.mutate({action:'accept',confirmed:true})).status,403);assert.equal((await f.review('confirmed','')).status,200);assert.equal((await f.item()).status,'review');
  const accepted=await f.mutate({action:'accept',confirmed:true,note:'PRIVATE-REVIEWER-NOTE'},{user:'reviewer'});assert.equal(accepted.status,200,accepted.text);assert.equal((await f.item()).status,'waiting_customer');
  const c=await f.request('/pulse/api/studio',{asCustomer:true});assert.equal(c.status,200);assert.doesNotMatch(JSON.stringify(c.data.project.sceneRequests),/PRIVATE|history|actions|authorId|fingerprint|canSubmit/);assert.doesNotMatch(JSON.stringify(c.data.project),/PRIVATE-REVIEW/);
  assert.equal((await f.review('confirmed','')).status,200);assert.equal((await f.item()).status,'done');
});

test('a new scene version invalidates submitted review and repeat customer changes reopen work',async t=>{
  const f=await fixture(t);f.edit();await f.submit();f.edit({screenText:'다시 달라진 문구'});assert.equal((await f.item()).status,'stale');await f.review('confirmed','');assert.notEqual((await f.item()).status,'done');
  assert.equal((await f.submit()).status,200);assert.equal((await f.review('changes','추가 수정이 필요합니다.')).status,200);assert.notEqual((await f.item()).status,'done');assert.notEqual((await f.item()).status,'waiting_customer');
});

test('duplicate submissions and malformed payloads cannot add approval history',async t=>{
  const f=await fixture(t);f.edit();const before=structuredClone(f.raw());for(const payload of [{action:'submit',sceneRevision:2,confirmed:false},{action:'submit',sceneRevision:2,confirmed:true,unexpected:true},{action:'accept',confirmed:true}])assert.notEqual((await f.mutate(payload)).status,200);assert.deepEqual(f.raw(),before);
  assert.equal((await f.submit()).status,200);const after=structuredClone(f.raw());assert.equal((await f.submit()).status,409);assert.deepEqual(f.raw(),after);
});

test('today and weekly reuse pending scene requests without duplicates and completed work disappears',async t=>{
  const f=await fixture(t,{reviewer:true});const a=await f.request('/api/client-workflow'),b=await f.request('/api/client-workflow');assert.deepEqual(a.data,b.data);assert.equal(a.data.items.filter(i=>i.kind==='scene_request').length,1);assert.match(a.data.items.find(i=>i.kind==='scene_request').href,/requests=1$/);
  for(const user of ['other','viewer','reviewer'])assert.equal((await f.request('/api/client-workflow',{user})).data.items.filter(i=>i.kind==='scene_request').length,0);
  const weekly=await f.request('/api/weekly-summary');assert.equal(weekly.status,200);assert.ok(JSON.stringify(weekly.data).includes('scene_request'));
  f.edit();await f.submit();assert.equal((await f.request('/api/client-workflow',{user:'reviewer'})).data.items.filter(i=>i.kind==='scene_request').length,1);await f.mutate({action:'accept',confirmed:true},{user:'reviewer'});await f.review('confirmed','');assert.equal((await f.request('/api/client-workflow')).data.items.filter(i=>i.kind==='scene_request').length,0);
});

test('scene request records and original image survive restart and existing backup restore',async t=>{
  const f=await fixture(t),assetId=randomUUID(),asset={id:assetId,diskName:assetId+'.png',fileName:'합성 이미지.png',mimeType:'image/png',byteSize:png.length};await mkdir(join(f.directory,'studio-media'),{recursive:true});await writeFile(join(f.directory,'studio-media',asset.diskName),png);f.studio().customerUpload(f.customer.session,f.customer.csrf,f.raw().revision,asset);f.edit({assetId});await f.submit();const before=await f.item();await f.restart();assert.deepEqual(await f.item(),before);
  const backupRoot=await mkdtemp(join(tmpdir(),'synk-scene-backup-'));t.after(async()=>{assert.equal(dirname(resolve(backupRoot)),resolve(tmpdir()));await rm(backupRoot,{recursive:true,force:true});});await f.app.stop();const backup=await backupWorkspace({destination:backupRoot,companyDataDir:f.directory,messengerDataDir:join(f.directory,'messenger')});await f.restart(join(backup,'company'));assert.deepEqual(await f.item(),before);assert.deepEqual((await f.request('/pulse/api/studio/media/'+assetId,{asCustomer:true})).bytes,png);
});

test('new scene request browser modules are served as their actual source',async t=>{
  const f=await fixture(t);for(const path of ['/client-scene-requests.js','/client-scene-requests.css','/pulse-app/scene-requests-view.mjs']){const r=await f.request(path);assert.equal(r.status,200);assert.doesNotMatch(r.text,/<!doctype html>/i);}
});
