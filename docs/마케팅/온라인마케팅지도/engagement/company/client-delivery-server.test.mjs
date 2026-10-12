import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {request as httpRequest} from 'node:http';
import {createCompanyApp} from './server.mjs';
import {mediaView} from './public/pulse-app/views.mjs';
const srt=Buffer.from('1\n00:00:00,000 --> 00:00:02,800\n납품 자막 확인입니다.\n'),vtt=Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.800\n확인용 자막입니다.\n');
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-delivery-http-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false}),address=await app.start(),base='http://127.0.0.1:'+address.port,users={},tokens={};
  for(const [name,role,teamId]of [['owner','member','a'],['other','member','b'],['viewer','viewer','a']]){users[name]=app.store.createUser({name,email:name+'@delivery.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'test-csrf'},10);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  async function request(path,{body,user='owner',customer,headers={},method=body===undefined?'GET':'POST',raw=false}={}){const response=await fetch(base+path,{method,headers:{...(customer?{Cookie:'synk_pulse_session='+customer.session}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':'test-csrf','Content-Type':raw?'application/x-subrip':'application/json'}),...headers},...(body===undefined?{}:{body:raw?body:JSON.stringify(body)})});const bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,headers:response.headers,bytes,text:bytes.toString(),data:response.headers.get('content-type')?.startsWith('application/json')&&bytes.length?JSON.parse(bytes):null};}
  let row=app.clientProjects.save(users.owner,{title:'합성 납품 검증',customerName:'합성 고객',internalNotes:'PRIVATE-INTERNAL-NOTE',contact:'PRIVATE-CONTACT'}).project;
  row=app.clientProjects.addVersion(users.owner,row.id,{revision:row.revision,kind:'preview',label:'승인 시안',url:'https://example.test/approved.mp4'}).project;
  const invite=app.clientProjects.invite(users.owner,row.id,{revision:row.revision}),customer=app.clientProjects.open(invite.invite);
  app.clientProjects.customerAction(customer.session,customer.csrf,{revision:customer.project.revision,action:'approve',versionId:customer.project.versions.at(-1).id});
  const path='/api/client-projects/'+row.id+'/delivery',get=async()=>{const response=await request(path);assert.equal(response.status,200,response.text);return response.data;},stamp=report=>({projectRevision:report.projectRevision,draftRevision:report.draftRevision,approvedPreviewId:report.approvedPreview.id});
  const mutate=async(report,input,options={})=>request(path,{body:{...stamp(report),...input},...options});
  const uploadHeaders=report=>({'X-File-Name':encodeURIComponent('최종 자막.srt'),'X-Version-Label':encodeURIComponent('최종 자막'),'X-Project-Revision':String(report.projectRevision),'X-Delivery-Revision':String(report.draftRevision),'X-Approved-Preview-Id':report.approvedPreview.id,'X-Requirement-Id':'subtitle'});
  const upload=(report,{body=srt,headers={},...options}={})=>request(path+'/media',{body,raw:true,headers:{...uploadHeaders(report),...headers},...options});
  return {directory,app,base,users,tokens,customer,path,request,get,mutate,upload,uploadHeaders};
}

test('delivery GET and changes preserve staff ACL, origin, CSRF and customer separation',async t=>{
  const f=await fixture(t),report=await f.get();assert.equal(f.app.store.all('clientDeliveryDrafts').length,0);
  assert.equal((await f.request(f.path,{user:null})).status,401);assert.equal((await f.request(f.path,{user:'other'})).status,404);assert.equal((await f.request(f.path,{customer:f.customer})).status,401);
  const viewer=await f.request(f.path,{user:'viewer'});assert.equal(viewer.status,200);assert.equal(viewer.data.canEdit,false);
  for(const headers of [{Origin:'https://evil.test'},{'X-CSRF-Token':'bad'}])assert.equal((await f.mutate(report,{action:'use_approved',requirementId:'video',label:'최종 영상'},{headers})).status,403);
  assert.equal((await f.mutate(report,{action:'use_approved',requirementId:'video',label:'최종 영상'},{user:'viewer'})).status,403);
});

test('staged subtitle remains private until complete confirmed delivery and downloads as exact attachment',async t=>{
  const f=await fixture(t);let report=await f.get();const before=f.app.store.get('clientProjects',report.projectId);
  const pending=(await f.request('/api/client-workflow')).data.items.find(item=>item.projectId===report.projectId&&item.kind==='delivery');assert.ok(pending);assert.equal(new URL(pending.href,f.base).searchParams.get('delivery'),'1');
  report=(await f.mutate(report,{action:'save_requirements',requirements:report.requirements.map(r=>({...r,required:r.id==='video'||r.id==='subtitle'}))})).data;
  report=(await f.upload(report)).data;const media=report.items[0].media;
  const unchanged=f.app.store.get('clientProjects',report.projectId);assert.equal(unchanged.revision,before.revision);assert.deepEqual(unchanged.notificationEvents,before.notificationEvents);
  let customerView=await f.request('/pulse/api/project',{customer:f.customer});assert.doesNotMatch(customerView.text,/최종 자막|PRIVATE-INTERNAL-NOTE|PRIVATE-CONTACT/);assert.equal((await f.request('/pulse/api/media/'+media.id,{customer:f.customer})).status,404);
  assert.equal((await f.request(media.url,{user:'other'})).status,404);assert.deepEqual((await f.request(media.url)).bytes,srt);
  assert.equal((await f.mutate(report,{action:'publish',confirmed:true})).status,409);
  report=(await f.mutate(report,{action:'use_approved',requirementId:'video',label:'최종 영상'})).data;
  for(const item of report.items)report=(await f.mutate(report,{action:'update_item',itemId:item.id,confirmed:true})).data;
  assert.equal(report.canPublish,true);const result=await f.mutate(report,{action:'publish',confirmed:true});assert.equal(result.status,200,result.text);report=result.data;assert.equal(report.status,'delivered');assert.equal(report.deliveredVersionIds.length,2);
  assert.equal((await f.request('/api/client-workflow')).data.items.some(item=>item.projectId===report.projectId&&item.kind==='delivery'),false);
  customerView=await f.request('/pulse/api/project',{customer:f.customer});assert.equal(customerView.data.project.versions.filter(v=>v.kind==='final').length,2);assert.doesNotMatch(customerView.text,/PRIVATE-INTERNAL-NOTE|PRIVATE-CONTACT|clientDeliveryDrafts|diskName/);
  const path='/pulse/api/media/'+media.id,full=await f.request(path,{customer:f.customer});assert.equal(full.status,200);assert.deepEqual(full.bytes,srt);assert.match(full.headers.get('content-disposition'),/^attachment;/);assert.equal(full.headers.get('x-content-type-options'),'nosniff');assert.match(full.headers.get('content-security-policy'),/sandbox/);
  const partial=await f.request(path,{customer:f.customer,headers:{Range:'bytes=0-7'}});assert.equal(partial.status,206);assert.deepEqual(partial.bytes,srt.subarray(0,8));const head=await f.request(path,{customer:f.customer,method:'HEAD'});assert.equal(head.status,200);assert.equal(head.bytes.length,0);assert.equal(head.headers.get('content-length'),String(srt.length));
  assert.equal((await f.request(path,{customer:f.customer,headers:{Range:'bytes=999999-'}})).status,416);
  assert.equal((await f.mutate(report,{action:'publish',confirmed:true})).status,409);
  f.app.clientProjects.revoke(f.users.owner,report.projectId,{revision:report.projectRevision});assert.equal((await f.request(path,{customer:f.customer})).status,401);
});

test('subtitle uploads validate size, UTF-8, extension, time structure and never leave invalid files',async t=>{
  const f=await fixture(t),report=await f.get();
  for(const [body,headers,status]of [[Buffer.from('<script>oops</script>'),{},422],[Buffer.from([255,254,250]),{},422],[srt,{'Content-Type':'text/html'},415],[Buffer.from('1\n00:03:00,000 --> 00:00:02,000\nbad\n'),{},422],[Buffer.alloc(256*1024+1,65),{},413]])assert.equal((await f.upload(report,{body,headers})).status,status);
  assert.equal((await readdir(join(f.directory,'studio-media')).catch(()=>[])).length,0);
  const uploaded=await f.upload(report,{body:vtt,headers:{'Content-Type':'text/vtt','X-File-Name':'ko.vtt'}});assert.equal(uploaded.status,201,uploaded.text);assert.equal(uploaded.data.items[0].media.mimeType,'text/vtt');assert.deepEqual((await f.request(uploaded.data.items[0].media.url)).bytes,vtt);
});

test('stale and concurrent uploads preserve one file and one draft change',async t=>{
  const f=await fixture(t),report=await f.get(),results=await Promise.all([f.upload(report),f.upload(report)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal((await readdir(join(f.directory,'studio-media'))).length,1);assert.equal((await f.get()).items.length,1);
});

test('role change while raw upload is streaming rejects commit and removes staged bytes',async t=>{
  const f=await fixture(t),report=await f.get();
  const response=await new Promise((resolve,reject)=>{const req=httpRequest(f.base+f.path+'/media',{method:'POST',headers:{Cookie:'synk_company_session='+f.tokens.owner,Origin:f.app.origin,'X-CSRF-Token':'test-csrf','Content-Type':'application/x-subrip',...f.uploadHeaders(report)}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.write(srt.subarray(0,12));setTimeout(()=>{f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});req.end(srt.subarray(12));},60);});
  assert.equal(response.status,403,response.text);assert.equal((await readdir(join(f.directory,'studio-media')).catch(()=>[])).length,0);assert.equal(f.app.store.all('clientDeliveryDrafts').length,0);
});

test('new preview prevents stale delivery and removed draft media stays stored but inaccessible',async t=>{
  const f=await fixture(t);let report=(await f.upload(await f.get())).data;const media=report.items[0].media;
  report=(await f.mutate(report,{action:'remove_item',itemId:report.items[0].id})).data;assert.equal((await f.request(media.url)).status,404);assert.equal((await readdir(join(f.directory,'studio-media'))).length,1);
  f.app.clientProjects.addVersion(f.users.owner,report.projectId,{revision:report.projectRevision,kind:'preview',label:'새 시안',url:'https://example.test/new.mp4'});
  assert.equal((await f.mutate(report,{action:'use_approved',requirementId:'video',label:'예전 승인본'})).status,409);const fresh=await f.get();assert.equal(fresh.status,'waiting_approval');assert.equal(fresh.items.length,0);
});

test('client UI serves delivery assets and customer subtitle rendering does not claim missing media',async t=>{
  const f=await fixture(t);for(const path of ['/client-delivery.js','/client-delivery.css'])assert.equal((await f.request(path)).status,200);
  const previousLocation=globalThis.location;globalThis.location={origin:f.base};t.after(()=>{if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;});
  const html=mediaView({id:'subtitle',label:'자막',media:{mimeType:'application/x-subrip',url:'/pulse/api/media/00000000-0000-0000-0000-000000000000',fileName:'ko.srt'}});assert.match(html,/파일 받기/);assert.doesNotMatch(html,/아직 준비되지|<img|<video/);
  const legacy=await readFile(new URL('./public/pulse-lounge.js',import.meta.url),'utf8');assert.match(legacy,/mimeType.startsWith\('image\/'\)/);
});
