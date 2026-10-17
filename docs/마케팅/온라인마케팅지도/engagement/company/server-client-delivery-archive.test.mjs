import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';

const csrf='synthetic-archive-csrf';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-delivery-archive-http-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});
  await app.start();
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-delivery-archive-http-'));await rm(directory,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  for(const [name,role,teamId]of [['owner','member','a'],['viewer','viewer','a'],['other','member','b']]){users[name]=app.store.createUser({name,email:name+'@archive-http.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);}
  const project=app.clientProjects.save(users.owner,{title:'합성 최종 납품',customerName:'합성 고객',internalNotes:'NEVER-INCLUDE-INTERNAL',contact:'NEVER-INCLUDE-CONTACT'}).project;
  const previewId=randomUUID(),id=project.id,mediaId=randomUUID(),bytes=Buffer.from('synthetic final video bytes'),media={id:mediaId,diskName:mediaId+'.mp4',fileName:'한글 최종.mp4',mimeType:'video/mp4',byteSize:bytes.length},at=new Date().toISOString();
  await mkdir(join(directory,'studio-media'));await writeFile(join(directory,'studio-media',media.diskName),bytes);
  app.store.put('clientProjects',id,{...project,stage:'delivered',versions:[{id:previewId,kind:'preview',label:'승인 시안',url:'https://example.test/preview',createdAt:at,approvedAt:at},{id:randomUUID(),kind:'final',label:'최종 영상',media,guide:'고객 사용 안내',createdAt:at,approvedPreviewId:previewId},{id:randomUUID(),kind:'final',label:'외부 자막',url:'https://example.test/final.srt',guide:'외부 링크',createdAt:at,approvedPreviewId:previewId}]});
  const path='/api/client-projects/'+id+'/delivery-archive';
  const headers=(user='owner',method='GET',extra={})=>({...user?{Cookie:'synk_company_session='+sessions[user]}:{},...method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{},...extra});
  async function api({user='owner',method='GET',input,url=path,extra={},form=false}={}){const response=await fetch(base+url,{method,headers:headers(user,method,{...form?{'Content-Type':'application/x-www-form-urlencoded'}:{},...extra}),...input===undefined?{}:{body:form?new URLSearchParams(input).toString():JSON.stringify(input)}}),bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,bytes,text:bytes.toString('utf8'),headers:response.headers,data:response.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes.toString('utf8')):null};}
  const prepared=async user=>{const result=await api({user});assert.equal(result.status,200,result.text);return result.data;};
  return {app,base,path,id,users,sessions,api,headers,prepared,row:()=>app.store.get('clientProjects',id)};
}
test('preview and JSON/native POST deliver a real ZIP with originals and links without mutations',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),prepared=await f.prepared();assert.equal(prepared.files.length,1);assert.equal(prepared.links.length,1);
  for(const form of [false,true]){const result=await f.api({method:'POST',form,input:{fingerprint:prepared.fingerprint,...form?{csrfToken:csrf}:{}}});assert.equal(result.status,200,result.text);assert.equal(result.bytes.readUInt32LE(0),0x04034b50);assert.equal(result.bytes.readUInt32LE(result.bytes.length-22),0x06054b50);assert.equal(Number(result.headers.get('content-length')),result.bytes.length);assert.equal(result.headers.get('content-type'),'application/zip');assert.match(result.headers.get('content-disposition'),/attachment;.*filename\*=UTF-8''/);assert.match(result.headers.get('cache-control'),/no-store/);assert.match(result.text,/synthetic final video bytes/);assert.match(result.text,/https:\/\/example.test\/final.srt/);assert.doesNotMatch(result.text,/NEVER-INCLUDE/);}
  assert.equal(JSON.stringify(f.row()),before);
});
test('native form errors stay in same-origin frame and are readable without navigating the workroom',async t=>{
  const f=await fixture(t),p=await f.prepared();for(const input of [{fingerprint:p.fingerprint,csrfToken:'wrong'},{fingerprint:'a'.repeat(64),csrfToken:csrf}]){const result=await f.api({method:'POST',form:true,input});assert.ok([403,409].includes(result.status));assert.equal(result.headers.get('x-frame-options'),'SAMEORIGIN');assert.match(result.headers.get('content-security-policy'),/frame-ancestors 'self'/);assert.equal(result.data.status,result.status);assert.equal(typeof result.data.error,'string');}
});
test('no-referrer native forms require same-origin browser metadata and the session CSRF token',async t=>{
  const f=await fixture(t),p=await f.prepared(),input={fingerprint:p.fingerprint,csrfToken:csrf};
  assert.equal((await f.api({method:'POST',form:true,input,extra:{Origin:'null','Sec-Fetch-Site':'same-origin'}})).status,200);
  for(const site of ['cross-site','same-site','none',''])assert.equal((await f.api({method:'POST',form:true,input,extra:{Origin:'null','Sec-Fetch-Site':site}})).status,403);
  assert.equal((await f.api({method:'POST',form:true,input:{...input,csrfToken:'bad'},extra:{Origin:'null','Sec-Fetch-Site':'same-origin'}})).status,403);
  assert.equal((await f.api({method:'POST',input:{fingerprint:p.fingerprint},extra:{Origin:'null','Sec-Fetch-Site':'same-origin'}})).status,403);
});
test('staff ACL is enforced for previews and downloads, including read-only viewer',async t=>{
  const f=await fixture(t);for(const user of [null,'other']){assert.equal((await f.api({user})).status,user===null?401:404);assert.equal((await f.api({user,method:'POST',form:true,input:{fingerprint:'a'.repeat(64),csrfToken:csrf}})).status,user===null?401:404);}
  const p=await f.prepared('viewer');assert.equal((await f.api({user:'viewer',method:'POST',input:{fingerprint:p.fingerprint}})).status,200);
  const customer=f.app.clientProjects.open(f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.row().revision}).invite);assert.equal((await f.api({user:null,extra:{Cookie:'synk_pulse_session='+customer.session}})).status,401);
});
test('strict methods, query, form fields, Origin and CSRF are required',async t=>{
  const f=await fixture(t),p=await f.prepared();assert.equal((await f.api({method:'DELETE'})).status,405);assert.equal((await f.api({url:f.path+'?extra=1'})).status,400);
  for(const extra of [{Origin:''},{Origin:'https://example.test'},{'X-CSRF-Token':'wrong'}])assert.equal((await f.api({method:'POST',input:{fingerprint:p.fingerprint},extra})).status,403);
  for(const input of [{fingerprint:p.fingerprint,csrfToken:csrf,extra:'bad'},{fingerprint:p.fingerprint},{fingerprint:'bad',csrfToken:csrf}])assert.equal((await f.api({method:'POST',form:true,input})).status,input.csrfToken?400:400);
  const result=await fetch(f.base+f.path,{method:'POST',headers:f.headers('owner','POST',{'Content-Type':'application/x-www-form-urlencoded'}),body:'fingerprint='+p.fingerprint+'&csrfToken='+csrf+'&csrfToken='+csrf});assert.equal(result.status,400);
});
test('stale bundle, removed file and approval withdrawal never return an archive',async t=>{
  for(const change of ['revision','approval']){const f=await fixture(t),p=await f.prepared(),row=f.row();if(change==='revision')row.revision++;else row.versions[0].approvedAt=null;f.app.store.put('clientProjects',f.id,row);assert.equal((await f.api({method:'POST',input:{fingerprint:p.fingerprint}})).status,409);}
});
test('session revoked during a slow native form body is rechecked before any file bytes',async t=>{
  const f=await fixture(t),p=await f.prepared(),body=new URLSearchParams({fingerprint:p.fingerprint,csrfToken:csrf}).toString();
  let arrived;const gate=new Promise(done=>arrived=done);f.app.server.once('request',()=>setImmediate(arrived));
  let req;const pending=new Promise((resolve,reject)=>{req=request(f.base+f.path,{method:'POST',headers:f.headers('owner','POST',{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)})},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);});
  req.write(body.slice(0,10));await gate;f.app.store.revokeUser(f.users.owner.id);req.end(body.slice(10));const result=await pending;assert.equal(result.status,401);assert.doesNotMatch(result.text,/synthetic final video bytes/);
});
test('archive UI assets are available with correct MIME types',async t=>{const f=await fixture(t);for(const [name,type]of [['client-delivery-archive.js','text/javascript'],['client-delivery-archive.css','text/css']]){const response=await fetch(f.base+'/'+name);assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith(type));}});
