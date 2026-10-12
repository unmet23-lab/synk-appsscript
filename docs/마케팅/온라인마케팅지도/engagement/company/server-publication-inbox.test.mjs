import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createCompanyApp} from './server.mjs';
import {stagePublicationDelivery} from '../../../../../tools/완성본등록.mjs';
const run=promisify(execFile);

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-inbox-http-'));let external=0;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,collector:async()=>{external++;throw new Error('No external collection in local inbox tests.');},...options}),address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-inbox-http-'));await rm(directory,{recursive:true,force:true});});
  const owner=app.store.createUser({name:'Owner',email:'owner@inbox.test',role:'member'}),other=app.store.createUser({name:'Other',email:'other@inbox.test',role:'member'}),viewer=app.store.createUser({name:'Viewer',email:'viewer@inbox.test',role:'viewer'}),sessions=new Map([owner,other,viewer].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'inbox-http-fixture'},30)]));
  async function request(path,input,user=owner,headers={}){const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions.get(user.id)}:{}),...(input===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'inbox-http-fixture'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json()};}
  async function video(){const path=join(directory,'source.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=15','-t','0.5','-c:v','libx264','-pix_fmt','yuv420p','-y',path],{windowsHide:true,timeout:30000});return path;}
  return {app,directory,base,owner,other,viewer,sessions,request,video,external:()=>external};
}

test('local inbox settings retain authentication, CSRF, fixed per-user directory and viewer boundaries',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/api/publication-inbox',undefined,null)).status,401);
  assert.equal((await f.request('/api/publication-inbox/settings',{active:true},f.owner,{Origin:'https://untrusted.test'})).status,403);
  assert.equal((await f.request('/api/publication-inbox/settings',{active:true},f.owner,{'X-CSRF-Token':'invalid'})).status,403);
  assert.equal((await f.request('/api/publication-inbox/settings',{active:true},f.viewer)).status,403);
  const settings=await f.request('/api/publication-inbox/settings',{active:true});assert.equal(settings.status,200,JSON.stringify(settings.data));assert.equal(settings.data.active,true);assert.ok(settings.data.inboxPath.endsWith(f.owner.id));
  const other=await f.request('/api/publication-inbox',undefined,f.other);assert.equal(other.status,200);assert.equal(other.data.active,false);assert.ok(!JSON.stringify(other.data).includes(f.owner.id));
  const workspace=await f.request('/api/publication-workspace');assert.equal(workspace.data.inbox.active,true);assert.equal(f.external(),0);
});

test('a finalized file bundle is imported once and can create a real publication ZIP through existing routes',async t=>{
  const f=await fixture(t),settings=(await f.request('/api/publication-inbox/settings',{active:true})).data,video=await f.video(),original=await readFile(video);
  const staged=await stagePublicationDelivery({inbox:settings.inboxPath,video,title:'자동 등록 확인',body:'실제 게시가 아닌 격리 시험입니다.',channels:['youtube-shorts'],confirmed:true});
  const scanned=await f.request('/api/publication-inbox/scan',{});assert.equal(scanned.status,200,JSON.stringify(scanned.data));
  const row=scanned.data.entries.find(entry=>entry.status==='ready');assert.ok(row,JSON.stringify(scanned.data));
  const loaded=await f.request('/api/publication-inbox/'+row.id+'/draft');assert.equal(loaded.status,200);assert.equal(loaded.data.draft.title,'자동 등록 확인');assert.equal(loaded.data.draft.body,'실제 게시가 아닌 격리 시험입니다.');assert.equal(loaded.data.production.versions.length,1);
  assert.equal((await f.request('/api/publication-inbox/'+row.id+'/draft',undefined,f.other)).status,404);
  assert.equal((await f.request('/api/publication-inbox',undefined,f.other)).data.entries.length,0);
  const before=f.app.store.all('studioProductions').length;await f.request('/api/publication-inbox/scan',{});assert.equal(f.app.store.all('studioProductions').length,before);
  const made=await f.request('/api/publication-packages',loaded.data.draft);assert.equal(made.status,201,JSON.stringify(made.data));assert.equal(made.data.package.outputs.length,1);
  assert.deepEqual(await readFile(video),original);assert.ok(await readFile(join(staged.path,'ready.json')));assert.equal(f.external(),0);
});

test('the local five-second scanner imports a delivered bundle without a manual scan while broader schedules stay off',async t=>{
  const f=await fixture(t,{publicationInboxSchedule:true}),settings=(await f.request('/api/publication-inbox/settings',{active:true})).data;
  await stagePublicationDelivery({inbox:settings.inboxPath,video:await f.video(),title:'자동 스캔 확인',confirmed:true});
  const deadline=Date.now()+9000;let state;
  while(Date.now()<deadline){state=(await f.request('/api/publication-inbox')).data;if(state.entries.some(entry=>entry.status==='ready'))break;await new Promise(resolve=>setTimeout(resolve,150));}
  assert.ok(state.entries.some(entry=>entry.status==='ready'),JSON.stringify(state));assert.equal(f.external(),0);
  const stopped=await f.request('/api/publication-inbox/settings',{active:false});assert.equal(stopped.data.active,false);
});

test('a non-local configured origin never exposes or enables filesystem intake',async t=>{
  const f=await fixture(t,{origin:'https://workspace.example.test'}),state=await f.request('/api/publication-inbox');
  assert.equal(state.status,200);assert.equal(state.data.available,false);assert.ok(!state.data.inboxPath);assert.equal((await f.request('/api/publication-inbox/settings',{active:true})).status,403);
});
