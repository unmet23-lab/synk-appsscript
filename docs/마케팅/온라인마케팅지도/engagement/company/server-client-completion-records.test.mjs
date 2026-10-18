import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';

const csrf='synthetic-completion-csrf';
const pdfBytes=Buffer.from('%PDF-1.7\nSYNTHETIC HTTP RENDERER\n%%EOF');
const csvBytes=Buffer.from('\ufeffsection,value\r\ncurrent_summary,합성 기록\r\n');
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-completion-http-'));
  const rendering={calls:0,handler:null};
  const renderer={pdf:async report=>{rendering.calls++;return rendering.handler?rendering.handler(report):pdfBytes;},csv:()=>{rendering.calls++;return csvBytes;}};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,completionRecordsRenderer:renderer});
  await app.start();
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-completion-http-'));await rm(directory,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  for(const [name,role,teamId]of [['owner','member','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]]){
    users[name]=app.store.createUser({name,email:name+'@completion-http.test',role,teamId});
    sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);
  }
  const project=app.clientProjects.save(users.owner,{title:'합성 완료 기록 / 한글',customerName:'합성 고객',internalNotes:'NEVER-EXPORT-INTERNAL-MEMO',contact:'NEVER-EXPORT-CONTACT'}).project;
  const id=project.id,path='/api/client-projects/'+id+'/completion-records';
  app.store.put('clientProjects',id,{...project,messages:[{id:'00000000-0000-4000-8000-000000000031',visibility:'internal',text:'NEVER-EXPORT-PRIVATE-MESSAGE',at:'2026-10-12T08:00:00.000Z',resolved:false,actor:users.owner.id}],studio:{assets:[],references:[{id:'00000000-0000-4000-8000-000000000032',label:'합성 참고 원본',url:'https://example.test/reference.png'}],concepts:[],scenes:[],comments:[],sceneReviews:[]}});
  function headers(user='owner',method='GET',extra={}){return {...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...extra};}
  async function api({user='owner',url=path,input,method=input===undefined?'GET':'POST',headers:extra={}}={}){
    const response=await fetch(base+url,{method,headers:headers(user,method,extra),...(input===undefined?{}:{body:JSON.stringify(input)})}),bytes=Buffer.from(await response.arrayBuffer());
    return {status:response.status,bytes,text:bytes.toString('utf8'),data:response.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes.toString('utf8')):null,headers:response.headers};
  }
  async function input(format='pdf',user='owner'){const prepared=await api({user});assert.equal(prepared.status,200,prepared.text);return {format,fingerprint:prepared.data.fingerprint};}
  async function raw({method='GET',body='',extra={},onArrived,url=path}={}){
    const arrived=deferred();if(onArrived)app.server.once('request',()=>setImmediate(arrived.resolve));
    let req;
    const result=new Promise((resolve,reject)=>{req=request(base+url,{method,headers:headers('owner',method,{'Content-Length':Buffer.byteLength(body),...extra})},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const bytes=Buffer.concat(chunks);resolve({status:res.statusCode,text:bytes.toString('utf8'),headers:res.headers});});});req.on('error',reject);});
    if(onArrived){req.write(body.slice(0,10));await arrived.promise;onArrived();req.end(body.slice(10));}else req.end(body);
    return result;
  }
  function blockRender(){const started=deferred(),release=deferred();rendering.handler=async()=>{started.resolve();await release.promise;return pdfBytes;};return {started:started.promise,release:release.resolve};}
  return {app,base,users,sessions,id,path,api,input,raw,rendering,blockRender,row:()=>app.store.get('clientProjects',id)};
}

test('completion preview is no-store, staff read-only and omits private project fields',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row());
  for(const user of ['owner','viewer','admin']){const result=await f.api({user});assert.equal(result.status,200,result.text);assert.equal(result.data.projectId,f.id);assert.match(result.data.fingerprint,/^[a-f0-9]{64}$/);assert.ok(Array.isArray(result.data.sections));assert.match(result.headers.get('cache-control'),/no-store/);assert.doesNotMatch(result.text,/NEVER-EXPORT-(INTERNAL-MEMO|CONTACT|PRIVATE-MESSAGE)/);}
  assert.equal(f.rendering.calls,0);assert.equal(JSON.stringify(f.row()),before);
});

test('PDF and CSV downloads use attachment headers and do not modify original records',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row());
  for(const format of ['pdf','csv']){const result=await f.api({input:await f.input(format)});assert.equal(result.status,200,result.text);assert.deepEqual(result.bytes,format==='pdf'?pdfBytes:csvBytes);assert.match(result.headers.get('content-type'),format==='pdf'?/^application\/pdf/:/^text\/csv/);assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(result.headers.get('x-content-type-options'),'nosniff');const disposition=result.headers.get('content-disposition');assert.match(disposition,/^attachment;/);assert.match(disposition,/filename="[\x20-\x7e]+"/);assert.match(disposition,/filename\*=UTF-8''/i);assert.doesNotMatch(disposition,/[\r\n]/);}
  assert.equal(f.rendering.calls,2);assert.equal(JSON.stringify(f.row()),before);
});

test('current staff ACL applies to preview and download and never accepts customer sessions',async t=>{
  const f=await fixture(t),input=await f.input();
  for(const user of [null,'other'])for(const requestInput of [undefined,input])assert.equal((await f.api({user,input:requestInput})).status,user===null?401:404);
  assert.equal((await f.api({user:'viewer',input:await f.input('pdf','viewer')})).status,200);
  const customer=f.app.clientProjects.open(f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.row().revision}).invite);
  for(const requestInput of [undefined,input])assert.equal((await f.api({user:null,input:requestInput,headers:{Cookie:'synk_pulse_session='+customer.session}})).status,401);
});

test('strict query, body, method, format and CSRF validation prevents rendering',async t=>{
  const f=await fixture(t),input=await f.input();
  for(const query of ['?demo=1','?format=csv','?fingerprint='+input.fingerprint])for(const requestInput of [undefined,input])assert.equal((await f.api({url:f.path+query,input:requestInput})).status,query==='?demo=1'&&requestInput?403:400);
  for(const headers of [{'X-CSRF-Token':''},{'X-CSRF-Token':'wrong'},{Origin:'https://wrong.example'},{Origin:''}])assert.equal((await f.api({input,headers})).status,403);
  for(const invalid of [{...input,format:'html'},{...input,format:'PDF'},{...input,fingerprint:null},{...input,extra:'private'},{format:'pdf'},[],null])assert.equal((await f.api({input:invalid})).status,400);
  assert.equal((await f.api({input:{...input,fingerprint:'a'.repeat(600)}})).status,413);
  assert.equal((await f.api({method:'DELETE'})).status,405);
  assert.equal((await f.raw({body:'{}'})).status,400);
  assert.ok([400,404].includes((await f.api({url:'/api/client-projects/not-a-project/completion-records'})).status));
  assert.equal(f.rendering.calls,0);
});

test('stale preview fingerprints reject before rendering and leave changed source untouched',async t=>{
  const f=await fixture(t),input=await f.input();
  f.app.store.put('clientProjects',f.id,{...f.row(),revision:f.row().revision+1,title:'새 이름'});
  const before=JSON.stringify(f.row()),result=await f.api({input});assert.equal(result.status,409);assert.equal(f.rendering.calls,0);assert.equal(JSON.stringify(f.row()),before);
});

test('session and project permission are rechecked after a slow request body',async t=>{
  for(const reason of ['session','assignment']){const f=await fixture(t),input=await f.input(),result=await f.raw({method:'POST',body:JSON.stringify(input),onArrived:()=>{if(reason==='session')f.app.store.revokeUser(f.users.owner.id);else f.app.store.put('clientProjects',f.id,{...f.row(),ownerId:f.users.other.id,teamId:'b'});}});assert.equal(result.status,reason==='session'?401:404,result.text);assert.equal(f.rendering.calls,0);}
});

test('revoked session during slow rendering never receives a prepared file',async t=>{
  const f=await fixture(t),input=await f.input(),gate=f.blockRender(),pending=f.api({input});await gate.started;f.app.store.revokeUser(f.users.owner.id);gate.release();const result=await pending;assert.equal(result.status,401);assert.ok(!result.bytes.includes(pdfBytes));
});

test('source edits during slow rendering reject the obsolete PDF',async t=>{
  const f=await fixture(t),input=await f.input(),gate=f.blockRender(),pending=f.api({input});await gate.started;f.app.store.put('clientProjects',f.id,{...f.row(),revision:f.row().revision+1,title:'렌더 중 변경'});const before=JSON.stringify(f.row());gate.release();const result=await pending;assert.equal(result.status,409);assert.equal(JSON.stringify(f.row()),before);assert.ok(!result.bytes.includes(pdfBytes));
});

test('rights changes during rendering invalidate a file even when the project revision is unchanged',async t=>{
  const f=await fixture(t),input=await f.input(),gate=f.blockRender(),pending=f.api({input});await gate.started;
  const url='/api/client-projects/'+f.id+'/rights',rights=(await f.api({url})).data,item=rights.items.find(item=>item.kind==='material'),revision=f.row().revision;
  const saved=await f.api({url,input:{expectedRevision:rights.revision,projectRevision:rights.projectRevision,targetId:item.targetId,sourceFingerprint:item.sourceFingerprint,status:'denied',scope:'',evidence:'합성 변경 근거',agreedAt:'',expiryMode:'unknown',expiresAt:''}});
  gate.release();const result=await pending;assert.equal(saved.status,200,saved.text);assert.equal(f.row().revision,revision);assert.equal(result.status,409);assert.ok(!result.bytes.includes(pdfBytes));
});

test('project reassignment during slow rendering rechecks authorization',async t=>{
  const f=await fixture(t),input=await f.input(),gate=f.blockRender(),pending=f.api({input});await gate.started;f.app.store.put('clientProjects',f.id,{...f.row(),ownerId:f.users.other.id,teamId:'b'});gate.release();const result=await pending;assert.equal(result.status,404);assert.ok(!result.bytes.includes(pdfBytes));
});

test('administrator role removal during slow rendering cannot export an otherwise inaccessible project',async t=>{
  const f=await fixture(t),input=await f.input('pdf','admin'),gate=f.blockRender(),pending=f.api({user:'admin',input});await gate.started;f.app.store.put('users',f.users.admin.id,{...f.users.admin,role:'member',teamId:'b'});gate.release();const result=await pending;assert.equal(result.status,404);assert.ok(!result.bytes.includes(pdfBytes));
});

test('one user can render only one file at a time, then retry after completion',async t=>{
  const f=await fixture(t),input=await f.input(),gate=f.blockRender(),pending=f.api({input});await gate.started;const concurrent=await f.api({input});assert.equal(concurrent.status,429);assert.equal(f.rendering.calls,1);gate.release();assert.equal((await pending).status,200);f.rendering.handler=null;assert.equal((await f.api({input})).status,200);assert.equal(f.rendering.calls,2);
});

test('oversized renderer output is rejected and the per-user slot is released',async t=>{
  const f=await fixture(t),input=await f.input();f.rendering.handler=()=>Buffer.alloc(64*1024*1024+1);const result=await f.api({input});assert.equal(result.status,413);assert.ok(result.bytes.length<10000);f.rendering.handler=null;assert.equal((await f.api({input})).status,200);
});

test('renderer failure does not expose sensitive exception text and allows retry',async t=>{
  const f=await fixture(t),input=await f.input();f.rendering.handler=()=>{throw new Error('DO-NOT-LEAK-PRIVATE-RENDER-TEXT');};const result=await f.api({input});assert.equal(result.status,500);assert.doesNotMatch(result.text,/DO-NOT-LEAK-PRIVATE-RENDER-TEXT/);f.rendering.handler=null;assert.equal((await f.api({input})).status,200);
});
