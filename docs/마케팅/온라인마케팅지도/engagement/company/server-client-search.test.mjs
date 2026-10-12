import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';

const csrf='synthetic-search-csrf';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-client-search-http-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});
  await app.start();const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-client-search-http-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role,teamId]of [['owner','member','a'],['viewer','viewer','a'],['peer','member','a'],['other','member','b'],['admin','admin',null]]){users[name]=app.store.createUser({name,email:name+'@search-http.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);}
  const project=app.clientProjects.save(users.owner,{title:'자막 제작 프로젝트',customerName:'합성 고객',internalNotes:'자막 내부 메모'}).project,id=project.id,path='/api/client-search',row=()=>app.store.get('clientProjects',id);
  for(let index=0;index<4;index++)app.clientProjects.message(users.owner,id,{revision:row().revision,text:'자막 답변 '+index,visibility:'customer'});
  const input=(extra={})=>({query:'자막',projectId:id,limit:20,...extra}),snapshot=()=>app.store.db.prepare('SELECT kind,id,body FROM documents ORDER BY kind,id').all();
  async function api({user='owner',url=path,input:payload=input(),method='POST',headers={}}={}){const response=await fetch(base+url,{method,headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},...(method==='POST'?{body:JSON.stringify(payload)}:{})});return {status:response.status,data:await response.json(),headers:response.headers};}
  async function slow(mutate){const body=JSON.stringify(input()),arrived=new Promise(resolve=>app.server.once('request',()=>queueMicrotask(resolve)));let req;const done=new Promise((resolve,reject)=>{req=request(base+path,{method:'POST',headers:{Cookie:'synk_company_session='+sessions.owner,Origin:app.origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{let data='';response.setEncoding('utf8');response.on('data',chunk=>data+=chunk);response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(data)}));});req.on('error',reject);});req.write(body.slice(0,10));await arrived;mutate();req.end(body.slice(10));return done;}
  return {app,users,id,row,path,api,input,snapshot,slow};
}

test('HTTP search uses read-only POST for staff and viewers without recording queries or altering source documents',async t=>{
  const f=await fixture(t),before=f.snapshot();for(const user of ['owner','viewer','admin']){const result=await f.api({user});assert.equal(result.status,200);assert.equal(result.data.total,6);assert.equal(result.data.items.length,6);assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(result.data.projects[0].count,6);}
  const query='PRIVATE-UNRECORDED-QUERY',empty=await f.api({input:f.input({query})});assert.equal(empty.status,200);assert.equal(empty.data.total,0);assert.deepEqual(f.snapshot(),before);assert.ok(!JSON.stringify(f.snapshot()).includes(query));
});

test('HTTP authentication CSRF origin method and URL restrictions protect query privacy and current project access',async t=>{
  const f=await fixture(t);assert.equal((await f.api({user:null})).status,401);for(const user of ['peer','other']){assert.equal((await f.api({user})).status,404);const scoped=await f.api({user,input:f.input({projectId:null})});assert.equal(scoped.status,200);assert.equal(scoped.data.total,0);assert.deepEqual(scoped.data.projects,[]);}
  for(const headers of [{'X-CSRF-Token':'bad'},{Origin:'https://unrelated.example'}])assert.equal((await f.api({headers})).status,403);assert.equal((await f.api({url:f.path+'?query=secret'})).status,400);assert.equal((await f.api({method:'GET'})).status,405);
  const customer=f.app.clientProjects.open(f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.row().revision}).invite);assert.equal((await f.api({user:null,headers:{Cookie:'synk_pulse_session='+customer.session}})).status,401);
});

test('HTTP pagination remains stable and source or query changes invalidate the old cursor',async t=>{
  const f=await fixture(t),first=await f.api({input:f.input({limit:2})});assert.equal(first.status,200);assert.equal(first.data.items.length,2);assert.ok(first.data.hasMore);assert.equal(first.data.projects[0].count,6);const next=await f.api({input:f.input({limit:2,cursor:first.data.nextCursor})});assert.equal(next.status,200);assert.equal(next.data.items.length,2);assert.ok(next.data.items.every(item=>!first.data.items.some(previous=>previous.id===item.id)));
  assert.equal((await f.api({input:f.input({query:'메모',limit:2,cursor:first.data.nextCursor})})).status,409);f.app.clientProjects.message(f.users.owner,f.id,{revision:f.row().revision,text:'추가 자막 답변',visibility:'customer'});const stale=await f.api({input:f.input({limit:2,cursor:first.data.nextCursor})});assert.equal(stale.status,409);assert.match(stale.data.error,/처음부터/);
});

test('HTTP invalid and oversized search payloads are bounded and never persist',async t=>{
  const f=await fixture(t),before=f.snapshot();for(const input of [f.input({query:'가'}),f.input({query:'x'.repeat(161)}),f.input({limit:51}),f.input({kinds:['unknown']}),f.input({userId:f.users.admin.id}),f.input({query:{text:'자막'}})])assert.equal((await f.api({input})).status,400);assert.equal((await f.api({input:f.input({query:'x'.repeat(7000)})})).status,413);assert.deepEqual(f.snapshot(),before);
});

test('HTTP search rechecks project reassignment after receiving a partial body',async t=>{
  const f=await fixture(t),result=await f.slow(()=>{const row=f.row();f.app.store.put('clientProjects',row.id,{...row,ownerId:f.users.other.id,teamId:'b'});});assert.equal(result.status,404);assert.doesNotMatch(JSON.stringify(result.data),/자막 내부/);assert.equal((await f.api()).status,404);
});

test('HTTP search rechecks session revocation after receiving a partial body',async t=>{
  const f=await fixture(t),before=f.snapshot(),result=await f.slow(()=>f.app.store.revokeUser(f.users.owner.id));assert.equal(result.status,401);assert.deepEqual(f.snapshot(),before);
});

test('HTTP current viewer team and inactive account changes are honored on the next request',async t=>{
  const f=await fixture(t);assert.equal((await f.api({user:'viewer'})).status,200);f.app.store.put('users',f.users.viewer.id,{...f.users.viewer,teamId:'b'});assert.equal((await f.api({user:'viewer'})).status,404);f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal((await f.api()).status,401);
});

test('HTTP source failures stay explicit and use a single lightweight permission projection',async t=>{
  const f=await fixture(t),source=f.app.clientProjects.searchSources;let reads=0;f.app.clientProjects.searchSources=(...args)=>{reads++;return source(...args);};f.app.clientProjects.workspace=()=>{throw new Error('Heavy workspace must not be called');};assert.equal((await f.api()).status,200);assert.equal(reads,1);
  f.app.clientProjects.searchSources=()=>{throw Object.assign(new Error('Synthetic unavailable source'),{status:503});};const result=await f.api();assert.equal(result.status,503);assert.equal(Object.hasOwn(result.data,'total'),false);assert.equal(Object.hasOwn(result.data,'items'),false);
});
