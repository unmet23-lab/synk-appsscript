import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';

const revisions=view=>({projectRevision:view.projectRevision,draftRevision:view.draftRevision,approvedPreviewId:view.approvedPreview?.id});
const spec={label:'납품 규격 합성 영상',kind:'video',platform:'instagram',placement:'릴스',durationSeconds:30,aspectRatio:'9:16',language:'한국어',subtitles:'none',fileFormat:'MP4',quantity:1,notes:''};
const sample=Buffer.concat([Buffer.from([0,0,0,16]),Buffer.from('ftypisom0000'),Buffer.alloc(100)]);

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-delivery-check-http-'));
  const control={calls:0,closed:0,duration:30,status:'inspected',code:'inspected',gate:null};
  const fileInspector={async inspect(media){control.calls++;if(control.gate)await control.gate();let bytes;try{bytes=await readFile(join(directory,'studio-media',media.diskName));}catch{return {status:'unavailable',code:'missing',message:'저장된 파일을 찾을 수 없습니다.'};}return {status:control.status,code:control.code,sha256:createHash('sha256').update(bytes).digest('hex'),byteSize:bytes.length,metadata:{kind:'video',width:1080,height:1920,displayAspectRatio:9/16,duration:control.duration,videoCodec:'h264',audioCodecs:['aac']}};},async close(){control.closed++;}};
  const options={dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,workNotificationsEnabled:false,deliveryFileInspector:fileInspector};
  let app,base;async function start(){app=createCompanyApp(options);const address=await app.start();base='http://127.0.0.1:'+address.port;}await start();
  const users={},tokens={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['viewer','viewer','a'],['manager','manager','a'],['other','member','b']]){users[name]=app.store.createUser({name,email:name+'@delivery-check.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'test-csrf'},10);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-delivery-check-http-'));await rm(directory,{recursive:true,force:true});});
  async function request(path,{body,user='owner',customer,headers={},method=body===undefined?'GET':'POST'}={}){
    const response=await fetch(base+path,{method,headers:{...(customer?{Cookie:'synk_pulse_session='+customer.session}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'Content-Type':'application/json',...(customer?{'X-Pulse-CSRF':customer.csrf}:{'X-CSRF-Token':'test-csrf'})}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text();return {status:response.status,text,headers:response.headers,data:response.headers.get('content-type')?.startsWith('application/json')&&text?JSON.parse(text):null};
  }
  let row=app.clientProjects.save(users.owner,{title:'17번 합성 HTTP 확인',customerName:'합성 고객',reviewerId:users.reviewer.id,internalNotes:'PRIVATE-CHECK-NOTES',contact:'PRIVATE-CHECK-CONTACT'}).project;
  const mediaId=randomUUID(),media={id:mediaId,diskName:mediaId+'.mp4',mimeType:'video/mp4',byteSize:sample.length,fileName:'합성 시안.mp4'},mediaPath=join(directory,'studio-media',media.diskName);
  await mkdir(join(directory,'studio-media'),{recursive:true});await writeFile(mediaPath,sample);
  row=app.clientProjects.addVersion(users.owner,row.id,{revision:row.revision,kind:'preview',label:'합성 승인 시안'},media).project;
  const invite=app.clientProjects.invite(users.owner,row.id,{revision:row.revision}),customer=app.clientProjects.open(invite.invite);row=app.clientProjects.project(users.owner,row.id);
  let result=await request('/api/client-projects/'+row.id+'/studio',{body:{revision:row.revision,action:'save_deliverables',deliverableRevision:0,items:[spec],notes:''}});assert.equal(result.status,200,result.text);row=result.data.project;
  result=await request('/api/client-projects/'+row.id+'/studio',{body:{revision:row.revision,action:'request_deliverable_review',deliverableRevision:row.studio.deliverables.revision}});assert.equal(result.status,200,result.text);row=result.data.project;
  result=await request('/pulse/api/studio',{customer,body:{revision:row.revision,action:'confirm_deliverables',deliverableRevision:row.studio.deliverables.revision}});assert.equal(result.status,200,result.text);row=result.data.project;
  result=await request('/pulse/api/action',{customer,body:{revision:row.revision,action:'approve',versionId:row.versions.at(-1).id}});assert.equal(result.status,200,result.text);row=result.data.project;
  const id=row.id,path='/api/client-projects/'+id+'/delivery',deliverableId=row.studio.deliverables.items[0].id;
  async function get(user='owner'){const response=await request(path,{user});assert.equal(response.status,200,response.text);return response.data;}
  const mutate=(view,input,options={})=>request(path,{body:{...revisions(view),...input},...options});
  const check=(view,options={})=>request(path+'/check',{body:revisions(view),...options});
  async function select(){const response=await mutate(await get(),{action:'use_approved',requirementId:'video',label:'최종 합성 영상',deliverableItemId:deliverableId});assert.equal(response.status,200,response.text);return response.data;}
  async function confirm(view){const response=await mutate(view,{action:'update_item',itemId:view.items[0].id,confirmed:true,confirmationToken:view.items[0].confirmationToken});assert.equal(response.status,200,response.text);return response.data;}
  return {directory,control,users,tokens,media,mediaPath,id,path,customer,deliverableId,get app(){return app;},get base(){return base;},request,get,mutate,check,select,confirm,async restart(){await app.stop();await start();}};
}

test('delivery check endpoint enforces staff ACL, CSRF, origin and three exact revision fields',async t=>{
  const f=await fixture(t),view=await f.select(),stamp=revisions(view),beforeCalls=f.control.calls;
  assert.equal((await f.check(view,{user:null})).status,403);assert.equal((await f.check(view,{customer:f.customer})).status,403);
  assert.equal((await f.check(view,{user:'other'})).status,404);for(const user of ['viewer','reviewer'])assert.equal((await f.check(view,{user})).status,403);
  for(const headers of [{Origin:'https://wrong.test'},{'X-CSRF-Token':'wrong'}])assert.equal((await f.check(view,{headers})).status,403);
  for(const key of Object.keys(stamp)){const missing={...stamp};delete missing[key];assert.equal((await f.request(f.path+'/check',{body:missing})).status,409);const stale={...stamp,[key]:key==='approvedPreviewId'?randomUUID():stamp[key]-1};assert.equal((await f.request(f.path+'/check',{body:stale})).status,409);}
  assert.equal((await f.request(f.path+'/check',{body:{...stamp,media:f.media}})).status,400);assert.equal(f.control.calls,beforeCalls);
  assert.equal((await f.check(view,{user:'manager'})).status,200);assert.equal((await f.get('viewer')).canEdit,false);
});

test('GET and explicit recheck update only derived checks; customer views and project revisions remain unchanged',async t=>{
  const f=await fixture(t),view=await f.select(),project=f.app.store.get('clientProjects',f.id),draft=f.app.store.all('clientDeliveryDrafts')[0];
  const before=(await f.request('/pulse/api/project',{customer:f.customer})).data;
  assert.equal(view.deliveryCheck.status,'manual');assert.ok(view.deliveryCheck.confirmed);assert.equal(view.items[0].confirmed,false);
  for(let i=0;i<2;i++){const result=await f.check(view);assert.equal(result.status,200,result.text);assert.deepEqual(revisions(result.data),revisions(view));assert.equal(result.data.deliveryCheck.blockingCount,0);}
  assert.deepEqual(revisions(await f.get()),revisions(view));assert.deepEqual(f.app.store.get('clientProjects',f.id),project);assert.deepEqual(f.app.store.all('clientDeliveryDrafts')[0],draft);assert.equal(f.app.store.all('clientDeliveryChecks').length,1);
  for(const endpoint of ['/pulse/api/project','/pulse/api/studio']){const response=await f.request(endpoint,{customer:f.customer});assert.equal(response.status,200);assert.deepEqual(response.data,before);assert.doesNotMatch(response.text,/deliveryCheck|confirmationToken|clientDeliveryChecks|fingerprint|diskName|sha256|PRIVATE-CHECK/);}
  assert.doesNotMatch(JSON.stringify(await f.get()),/diskName|sha256|PRIVATE-CHECK/);
});

test('HTTP confirmation uses current inspection token; changed file bytes invalidate acknowledgement before publication',async t=>{
  const f=await fixture(t);let view=await f.select();
  assert.equal((await f.mutate(view,{action:'update_item',itemId:view.items[0].id,confirmed:true})).status,409);
  view=await f.confirm(view);assert.equal(view.deliveryCheck.status,'ready');assert.equal(view.canPublish,true);const saved=revisions(view),oldToken=view.items[0].confirmationToken;
  assert.equal((await f.check(view)).data.items[0].confirmed,true);
  const changed=Buffer.from(sample);changed[changed.length-1]=1;await writeFile(f.mediaPath,changed);
  const blockedPublish=await f.mutate(view,{action:'publish',confirmed:true});assert.equal(blockedPublish.status,409,blockedPublish.text);assert.equal(f.app.store.get('clientProjects',f.id).versions.filter(row=>row.kind==='final').length,0);
  view=await f.get();assert.deepEqual(revisions(view),saved);assert.equal(view.items[0].confirmed,false);assert.notEqual(view.items[0].confirmationToken,oldToken);assert.equal(view.deliveryCheck.status,'manual');
  assert.equal((await f.mutate(view,{action:'update_item',itemId:view.items[0].id,confirmed:true,confirmationToken:oldToken})).status,409);
  view=await f.confirm(view);assert.equal(view.canPublish,true);
  const published=await f.mutate(view,{action:'publish',confirmed:true});assert.equal(published.status,200,published.text);assert.equal(published.data.status,'delivered');assert.equal(published.data.deliveredVersionIds.length,1);
});

test('known wrong duration and missing stored files remain blocked after a human check',async t=>{
  const f=await fixture(t);let view=await f.select();f.control.duration=35;view=(await f.check(view)).data;
  assert.equal(view.deliveryCheck.checks.find(row=>row.id.endsWith(':duration')).status,'fail');view=await f.confirm(view);assert.equal(view.canPublish,false);assert.equal((await f.mutate(view,{action:'publish',confirmed:true})).status,409);
  await rm(f.mediaPath);view=await f.get();assert.equal(view.deliveryCheck.checks.find(row=>row.id.endsWith(':inspection')).status,'missing');assert.equal(view.canPublish,false);assert.equal((await f.mutate(view,{action:'publish',confirmed:true})).status,409);
});

test('server scan produces one owner Today entry and clears it after current verification',async t=>{
  const f=await fixture(t);let view=await f.select();const before=revisions(view);assert.deepEqual(await f.app.scanDeliveryChecks(),{checked:1,failed:0});assert.deepEqual(revisions(await f.get()),before);
  const tasks=async user=>(await f.request('/api/client-workflow',{user})).data.items.filter(item=>item.projectId===f.id&&item.kind==='client_delivery_check');
  for(let i=0;i<2;i++){const rows=await tasks('owner');assert.equal(rows.length,1);assert.equal(rows[0].actions.length,0);const url=new URL(rows[0].href,f.base);assert.equal(url.searchParams.get('delivery'),'1');assert.equal(url.searchParams.get('project'),f.id);}
  for(const user of ['reviewer','viewer','other','manager'])assert.equal((await tasks(user)).length,0);
  view=await f.confirm(view);assert.equal((await tasks('owner')).length,0);
  const changed=Buffer.from(sample);changed[changed.length-1]=2;await writeFile(f.mediaPath,changed);await f.app.scanDeliveryChecks();assert.equal((await tasks('owner')).length,1);
  const row=f.app.store.get('clientProjects',f.id);f.app.store.put('clientProjects',f.id,{...row,stage:'archived'});assert.deepEqual(await f.app.scanDeliveryChecks(),{checked:0,failed:0});assert.equal((await tasks('owner')).length,0);
});

test('revoked staff permissions during an awaited HTTP check prevent persisting stale inspection',async t=>{
  const f=await fixture(t),view=await f.select(),before=f.app.store.all('clientDeliveryChecks');
  let start,release;const started=new Promise(resolve=>start=resolve),waiting=new Promise(resolve=>release=resolve);f.control.gate=async()=>{start();await waiting;};
  const pending=f.check(view);await started;f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});release();const result=await pending;f.control.gate=null;
  assert.equal(result.status,403,result.text);assert.deepEqual(f.app.store.all('clientDeliveryChecks'),before);assert.deepEqual(revisions(f.app.clientDelivery.get(f.users.owner,f.id)),revisions(view));
});

test('draft changes during asynchronous HTTP inspection reject stale checks without overwriting the new guide',async t=>{
  const f=await fixture(t),view=await f.select(),before=f.app.store.all('clientDeliveryChecks');
  let start,release;const started=new Promise(resolve=>start=resolve),waiting=new Promise(resolve=>release=resolve);f.control.gate=async()=>{start();await waiting;};
  const pending=f.check(view);await started;f.app.clientDelivery.mutate(f.users.owner,f.id,{...revisions(view),action:'save_guide',guide:'검사 중 저장한 최신 사용 안내'});release();const result=await pending;f.control.gate=null;
  assert.equal(result.status,409,result.text);assert.deepEqual(f.app.store.all('clientDeliveryChecks'),before);const fresh=await f.get();assert.equal(fresh.guide,'검사 중 저장한 최신 사용 안내');assert.equal(fresh.draftRevision,view.draftRevision+1);
});

test('restart preserves checks and human acknowledgement; an unapproved new preview cannot reuse them',async t=>{
  const f=await fixture(t);const view=await f.confirm(await f.select()),before=f.app.store.all('clientDeliveryChecks');await f.restart();assert.equal(f.control.closed,1);const restored=await f.get();assert.deepEqual(revisions(restored),revisions(view));assert.equal(restored.deliveryCheck.status,'ready');assert.equal(restored.items[0].confirmed,true);assert.equal(f.app.store.all('clientDeliveryChecks').length,before.length);
  let row=f.app.clientProjects.project(f.users.owner,f.id);row=f.app.clientProjects.addVersion(f.users.owner,f.id,{revision:row.revision,kind:'preview',label:'다음 미승인 시안',url:'https://example.test/v2.mp4'}).project;
  assert.equal((await f.check(view)).status,409);const fresh=await f.get();assert.equal(fresh.status,'waiting_approval');assert.equal(fresh.items.length,0);assert.equal(fresh.deliveryCheck.canInspect,false);assert.equal(fresh.deliveryCheck.checks.find(item=>item.id==='approval').status,'missing');
});
