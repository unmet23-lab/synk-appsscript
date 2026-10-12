import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';

const csrf='synthetic-client-drafts';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-client-drafts-http-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});
  await app.start();const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-client-drafts-http-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role,teamId]of [['owner','member','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]]){users[name]=app.store.createUser({name,email:name+'@draft-api.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);}
  const project=app.clientProjects.save(users.owner,{title:'초안 HTTP 합성 프로젝트',customerName:'합성 고객'}).project,id=project.id,path='/api/client-projects/'+id+'/drafts',row=()=>app.store.get('clientProjects',id),input=(text='HTTP-PRIVATE-UNSENT',expectedRevision=0)=>({action:'save',expectedRevision,sourceRevision:row().revision,fields:{text}});
  async function api({user='owner',url=path,input,method=input===undefined?'GET':'POST',headers={}}={}){const response=await fetch(base+url,{method,headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json(),headers:response.headers};}
  async function slow(mutate){const body=JSON.stringify(input()),arrived=new Promise(resolve=>app.server.once('request',()=>queueMicrotask(resolve)));let req;const done=new Promise((resolve,reject)=>{req=request(base+path+'/message',{method:'POST',headers:{Cookie:'synk_company_session='+sessions.owner,Origin:app.origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{let data='';response.setEncoding('utf8');response.on('data',chunk=>data+=chunk);response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(data)}));});req.on('error',reject);});req.write(body.slice(0,10));await arrived;mutate();req.end(body.slice(10));return done;}
  return {app,users,api,slow,id,path,row,input};
}

test('HTTP autosave and explicit draft deletion persist privately without sending or completing source work',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),first=await f.api();assert.equal(first.status,200);assert.match(first.headers.get('cache-control'),/no-store/);assert.equal(first.data.drafts.length,4);
  const saved=await f.api({url:f.path+'/message',input:f.input()});assert.equal(saved.status,200);assert.equal(saved.data.draft.revision,1);assert.equal(saved.data.draft.fields.text,'HTTP-PRIVATE-UNSENT');assert.equal(JSON.stringify(f.row()),before);
  const deleted=await f.api({url:f.path+'/message',input:{action:'delete',expectedRevision:1}});assert.equal(deleted.status,200);assert.equal(deleted.data.draft.status,'deleted');assert.equal(deleted.data.draft.fields,null);assert.equal(JSON.stringify(f.row()),before);
});

test('HTTP unauthorized identities, CSRF, customer sessions and cross-user selectors cannot read or save drafts',async t=>{
  const f=await fixture(t);assert.equal((await f.api({user:null})).status,401);assert.equal((await f.api({user:'other'})).status,404);assert.equal((await f.api({user:'viewer',url:f.path+'/message',input:f.input()})).status,403);
  for(const headers of [{'X-CSRF-Token':'bad'},{Origin:'https://other.example'}])assert.equal((await f.api({url:f.path+'/message',input:f.input(),headers})).status,403);
  assert.equal((await f.api({url:f.path+'?userId='+f.users.owner.id})).status,400);assert.equal((await f.api({url:f.path+'/message',input:{...f.input(),userId:f.users.admin.id}})).status,400);
  const customer=f.app.clientProjects.open(f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.row().revision}).invite);assert.equal((await f.api({user:null,headers:{Cookie:'synk_pulse_session='+customer.session}})).status,401);assert.equal(f.app.store.all('clientDrafts').length,0);
});

test('HTTP concurrent sessions get a 409 with their own current draft and deletion tombstone prevents late resurrection',async t=>{
  const f=await fixture(t),results=await Promise.all(['left','right'].map(text=>f.api({url:f.path+'/message',input:f.input(text)})));assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);const conflict=results.find(row=>row.status===409);assert.equal(conflict.data.code,'CLIENT_DRAFT_CONFLICT');assert.equal(conflict.data.current.revision,1);
  const admin=await f.api({user:'admin'});assert.ok(admin.data.drafts.every(row=>row.fields===null));await f.api({url:f.path+'/message',input:{action:'delete',expectedRevision:1}});const late=await f.api({url:f.path+'/message',input:f.input('late',1)});assert.equal(late.status,409);assert.equal(late.data.current.status,'deleted');assert.equal(late.data.current.fields,null);
});

test('HTTP body, file-shaped fields, assignments and future source revisions are rejected without writing',async t=>{
  const f=await fixture(t);for(const input of [{...f.input(),fields:{text:{bytes:'abc'}}},{...f.input(),fields:{file:'data:abc'}},{...f.input(),fields:{text:'x'.repeat(3001)}},{...f.input(),sourceRevision:9999}])assert.equal((await f.api({url:f.path+'/message',input})).status,400);
  assert.equal((await f.api({url:f.path+'/project',input:{...f.input(),fields:{stage:'delivered'}}})).status,400);assert.equal((await f.api({url:f.path+'/message',input:{...f.input(),fields:{text:'x'.repeat(140000)}}})).status,413);assert.equal((await f.api({input:f.input()})).status,405);assert.equal((await f.api({url:f.path+'/message'})).status,405);assert.equal(f.app.store.all('clientDrafts').length,0);
});

test('HTTP rechecks current role after partial request body before storing private text',async t=>{
  const f=await fixture(t),result=await f.slow(()=>f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'}));assert.equal(result.status,403);assert.equal(f.app.store.all('clientDrafts').length,0);
});

test('HTTP rechecks revoked session after partial body and never creates a draft from that request',async t=>{
  const f=await fixture(t),result=await f.slow(()=>f.app.store.revokeUser(f.users.owner.id));assert.equal(result.status,401);assert.equal(f.app.store.all('clientDrafts').length,0);
});

test('HTTP current project reassignment removes old-owner draft access while leaving saved payload encrypted',async t=>{
  const f=await fixture(t);await f.api({url:f.path+'/message',input:f.input()});const row=f.row();f.app.store.put('clientProjects',row.id,{...row,ownerId:f.users.other.id,teamId:'b'});assert.equal((await f.api()).status,404);assert.equal((await f.api({url:f.path+'/message',input:f.input('late',1)})).status,404);const other=await f.api({user:'other'});assert.ok(other.data.drafts.every(row=>row.fields===null));assert.ok(!JSON.stringify(f.app.store.all('clientDrafts')).includes('HTTP-PRIVATE-UNSENT'));
});
