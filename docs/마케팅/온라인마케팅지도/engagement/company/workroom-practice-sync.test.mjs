import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {request as httpRequest} from 'node:http';
import {createCompanyApp} from './server.mjs';
import engine from '../../../../../atlas/personalization.js';
import temper from '../../../../../atlas/temper-outcomes.js';
import * as M from '../../../../../experiences/shift-workbench/model.mjs';

const endpoint='/api/workroom-practice/state';
const password='workroom-sync-fixture-password';
const scope=id=>({personId:id,productId:'company',contextId:'workroom-practice',domain:'SHIFT'});
const settings={task:'meeting',goal:'work',minutes:10,support:'independent'};
function practice(id,{completed=false,text='두 기기에서 이어 쓸 가상 자료를 검토하고 담당·기한·확인 사항을 사람이 직접 수정한 초안입니다.'}={}){
  const base=Date.now()-10000,at=n=>new Date(base+n*1000).toISOString();
  let value=M.startRun(M.newState(),settings,engine,at(0),scope(id));value.save=true;
  value=M.recordPracticeExposure(value,at(1),scope(id));
  value.run.prompt=M.TASKS.meeting.template;value.run.draft=text;
  if(completed){
    for(const checkId of value.run.checkIds){const c=M.TASKS.meeting.checks.find(c=>c.id===checkId);value.run.answers[checkId]={kind:c.answer,source:c.source};}
    value.run.result=M.evaluate(value.run);value.run.reviewed=true;
    value=M.completeRun(value,engine,at(2),scope(id));
  }
  return value;
}
const save=(state,expectedRevision=0,activate=true)=>({action:'save',expectedRevision,activate,state});
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-workroom-sync-test-'));
  let app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  let address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.split(sep).at(-1).startsWith('synk-workroom-sync-test-'));await rm(target,{recursive:true,force:true});});
  const users={};
  for(const role of ['member','other','admin','viewer'])users[role]=app.store.createUser({name:'Fixture '+role,email:role+'@workroom-sync.example.test',role:role==='other'?'member':role,password});
  async function client(role='member',login=true){
    let cookie='',csrf='';
    async function request(path=endpoint,body,headers={},raw){
      const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined&&raw===undefined?{}:{Origin:app.origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'}),...headers},...(body===undefined&&raw===undefined?{}:{body:raw??JSON.stringify(body)})});
      const changed=response.headers.get('set-cookie');if(changed)cookie=changed.split(';')[0];
      const text=await response.text(),data=response.headers.get('content-type')?.startsWith('application/json')&&text?JSON.parse(text):null;
      if(data?.csrfToken)csrf=data.csrfToken;
      return {status:response.status,data,text,headers:response.headers};
    }
    if(login)assert.equal((await request('/api/login',{email:users[role].email,password})).status,200);
    return {request,get cookie(){return cookie;},get csrf(){return csrf;}};
  }
  async function restart(){await app.stop();app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});address=await app.start();base=`http://127.0.0.1:${address.port}`;}
  return {users,client,restart,directory,get app(){return app;},get base(){return base;}};
}
function envelope(result,revision,status){
  assert.equal(result.status,200,result.text);assert.equal(result.data.revision,revision);assert.equal(result.data.status,status);
  assert.deepEqual(Object.keys(result.data).sort(),['revision','state','status','updatedAt']);
  if(status==='empty'){assert.equal(result.data.updatedAt,null);assert.equal(result.data.state,null);}
  else assert.ok(Number.isFinite(Date.parse(result.data.updatedAt)));
  if(status==='deleted')assert.equal(result.data.state,null);
  assert.match(result.headers.get('cache-control'),/no-store/);
}

test('actual login sessions share their own validated practice after server restart',async t=>{
  const f=await fixture(t),a=await f.client(),b=await f.client(),value=practice(f.users.member.id,{completed:true});
  assert.notEqual(a.cookie,b.cookie);envelope(await a.request(),0,'empty');
  const written=await a.request(endpoint,save(value));envelope(written,1,'active');
  assert.deepEqual(written.data.state,M.restore(JSON.stringify(value),engine,scope(f.users.member.id),temper));
  const received=await b.request();envelope(received,1,'active');assert.deepEqual(received.data.state,written.data.state);
  received.data.state.run.draft='다른 세션에서 사람이 직접 수정한 가상 업무 결과';
  const changed=await b.request(endpoint,save(received.data.state,1,false));envelope(changed,2,'active');
  await f.restart();const restored=await a.request();envelope(restored,2,'active');assert.equal(restored.data.state.run.draft,received.data.state.run.draft);
  assert.deepEqual(restored.data.state.history,received.data.state.history);
});

test('concurrent saves from two sessions commit exactly one revision and return the winning draft',async t=>{
  const f=await fixture(t),a=await f.client(),b=await f.client(),value=practice(f.users.member.id);
  envelope(await a.request(endpoint,save(value)),1,'active');
  const left=structuredClone(value),right=structuredClone(value);left.run.draft='기기 A 수정';right.run.draft='기기 B 수정';
  const results=await Promise.all([a.request(endpoint,save(left,1,false)),b.request(endpoint,save(right,1,false))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const won=results.find(r=>r.status===200),lost=results.find(r=>r.status===409);
  assert.equal(won.data.revision,2);assert.equal(lost.data.code,'PRACTICE_CONFLICT');assert.deepEqual(lost.data.current,won.data);
  assert.equal((await b.request()).data.state.run.draft,won.data.state.run.draft);
});

test('deletion leaves a persisted tombstone and stale autosave or stale activation cannot revive it',async t=>{
  const f=await fixture(t),a=await f.client(),b=await f.client(),value=practice(f.users.member.id);
  envelope(await a.request(endpoint,save(value)),1,'active');
  const removed=await b.request(endpoint,{action:'delete',expectedRevision:1});envelope(removed,2,'deleted');
  for(const activate of [false,true]){
    const stale=await a.request(endpoint,save(value,1,activate));assert.equal(stale.status,409);assert.equal(stale.data.current.status,'deleted');assert.equal(stale.data.current.revision,2);assert.equal(stale.data.current.state,null);
  }
  const noRestart=await a.request(endpoint,save(value,2,false));assert.equal(noRestart.status,409);assert.equal(noRestart.data.code,'PRACTICE_DELETED');
  await f.restart();envelope(await b.request(),2,'deleted');
  envelope(await a.request(endpoint,save(value,2,true)),3,'active');
  assert.equal((await b.request()).data.state.run.draft,value.run.draft);
});

test('sync starts only on explicit opt-in and deletion of an empty account also blocks old autosaves',async t=>{
  const f=await fixture(t),a=await f.client(),value=practice(f.users.member.id);
  const noOptIn=await a.request(endpoint,save(value,0,false));assert.equal(noOptIn.status,409);assert.equal(noOptIn.data.code,'PRACTICE_NOT_ENABLED');assert.equal(noOptIn.data.current.status,'empty');
  envelope(await a.request(),0,'empty');envelope(await a.request(endpoint,{action:'delete',expectedRevision:0}),1,'deleted');
  assert.equal((await a.request(endpoint,save(value,0,true))).status,409);
  envelope(await a.request(endpoint,save(value,1,true)),2,'active');
});

test('private practice stays isolated from other accounts and administrators cannot select another owner',async t=>{
  const f=await fixture(t),a=await f.client(),value=practice(f.users.member.id,{text:'synthetic-private-practice-marker'});
  envelope(await a.request(endpoint,save(value)),1,'active');
  for(const role of ['other','admin']){
    const client=await f.client(role);envelope(await client.request(),0,'empty');
    for(const query of ['?ownerId='+f.users.member.id,'?userId='+f.users.member.id,'?scope=company','?revision=1']){
      const response=await client.request(endpoint+query);assert.equal(response.status,400);assert.ok(!response.text.includes(value.run.draft));
    }
    assert.equal((await client.request(endpoint,save(value))).status,400,'foreign model scope');
    assert.equal((await client.request(endpoint,{...save(practice(f.users[role].id)),ownerId:f.users.member.id})).status,400,'caller-selected owner');
    envelope(await client.request(),0,'empty');
  }
  assert.equal(f.app.store.all('workroomPracticeSync').length,1);
});

test('viewer can save only their personal exercise through the private practice endpoint',async t=>{
  const f=await fixture(t),viewer=await f.client('viewer'),value=practice(f.users.viewer.id);
  envelope(await viewer.request(endpoint,save(value)),1,'active');
  assert.equal((await viewer.request('/api/settings',{hourKst:1,enabled:true})).status,403);
  envelope(await viewer.request(endpoint,{action:'delete',expectedRevision:1}),2,'deleted');
});

test('session, Origin, CSRF and demo write guards protect synchronization',async t=>{
  const f=await fixture(t),anonymous=await f.client('member',false),a=await f.client(),value=practice(f.users.member.id);
  assert.equal((await anonymous.request()).status,401);
  assert.equal((await anonymous.request(endpoint,save(value))).status,403);
  for(const headers of [{'X-CSRF-Token':'wrong'},{Origin:'https://evil.example.test'},{Origin:''},{'X-Synk-Demo':'1'}])assert.equal((await a.request(endpoint,save(value),headers)).status,403);
  assert.equal((await a.request(endpoint+'?demo=1',save(value))).status,403);
  envelope(await a.request(),0,'empty');
  envelope(await a.request(endpoint,save(value)),1,'active');
  for(const headers of [{'X-CSRF-Token':'wrong'},{Origin:'https://evil.example.test'},{'X-Synk-Demo':'1'}])assert.equal((await a.request(endpoint,{action:'delete',expectedRevision:1},headers)).status,403);
  envelope(await a.request(),1,'active');
});

test('malformed request shapes and invalid model ownership or lineage never replace a valid server copy',async t=>{
  const f=await fixture(t),a=await f.client(),value=practice(f.users.member.id,{completed:true});
  envelope(await a.request(endpoint,save(value)),1,'active');
  const invalid=[
    null,[],{action:'unknown',expectedRevision:1},{action:'delete',expectedRevision:1,state:value},
    {action:'save',expectedRevision:-1,activate:false,state:value},{action:'save',expectedRevision:1.5,activate:false,state:value},
    {action:'save',expectedRevision:'1',activate:false,state:value},{action:'save',expectedRevision:1,activate:'true',state:value},
    {...save(value,1,false),contextId:'different'},save({...value,save:false},1,false),save({...M.newState(),save:true},1,false),
    save({...value,version:99},1,false),save({...value,unexpected:'data'},1,false)
  ];
  for(const mutate of [s=>{s.profile.scope.personId=f.users.other.id;},s=>{s.profile.scope.productId='shift';},s=>{s.events[0].scope.subject='foreign';},s=>{s.history[0].correct=0;},s=>{s.run.focusDecision.scope.subject='foreign';},s=>{s.evaluation.exposures[0].candidateId='invented';},s=>{s.profile.values.secret='bad';}]){
    const corrupt=structuredClone(value);mutate(corrupt);invalid.push(save(corrupt,1,false));
  }
  for(const body of invalid)assert.equal((await a.request(endpoint,body)).status,400,JSON.stringify(body).slice(0,120));
  assert.equal((await a.request(endpoint+'?ownerId='+f.users.member.id,save(value,1,false))).status,400);
  const unchanged=await a.request();envelope(unchanged,1,'active');assert.deepEqual(unchanged.data.state,value);
});

test('route accepts a valid state above ordinary API size and rejects over-limit characters or bytes',async t=>{
  const f=await fixture(t),a=await f.client(),value=practice(f.users.member.id),json=JSON.stringify(save(value));
  // JSON whitespace keeps the model unchanged while exercising only transport size.
  const largeValid=' '.repeat(780000-json.length)+json;
  envelope(await a.request(endpoint,undefined,{},largeValid),1,'active');
  assert.equal((await a.request('/api/settings',undefined,{},largeValid)).status,413,'ordinary API body limit stays unchanged');
  const tooManyChars=' '.repeat(1000001)+JSON.stringify(save(value,1,false));
  assert.equal((await a.request(endpoint,undefined,{},tooManyChars)).status,413);
  const tooManyBytes=JSON.stringify({...save(value,1,false),padding:'한'.repeat(1000001)});
  assert.equal((await a.request(endpoint,undefined,{},tooManyBytes)).status,413);
  envelope(await a.request(),1,'active');
});

test('GET rejects a caller-selected JSON body instead of treating it as a practice scope',async t=>{
  const f=await fixture(t),admin=await f.client('admin'),raw=JSON.stringify({ownerId:f.users.member.id});
  const response=await new Promise((resolve,reject)=>{
    const req=httpRequest(f.base+endpoint,{method:'GET',headers:{Cookie:admin.cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString()}));
    });req.on('error',reject);req.end(raw);
  });
  assert.equal(response.status,400,response.text);assert.ok(!response.text.includes(f.users.member.id));
  envelope(await admin.request(),0,'empty');
});

test('personal drafts are encrypted in persisted documents and deletion removes the payload',async t=>{
  const f=await fixture(t),a=await f.client(),marker='fixture-secret-practice-'+Date.now(),value=practice(f.users.member.id,{text:marker});
  envelope(await a.request(endpoint,save(value)),1,'active');
  const row=f.app.store.db.prepare('SELECT id,body FROM documents WHERE kind=?').get('workroomPracticeSync');assert.equal(row.id,f.users.member.id);assert.ok(!row.body.includes(marker));assert.ok(!row.body.includes(value.run.prompt));
  const db=await readFile(join(f.directory,'company.sqlite'));assert.ok(!db.includes(Buffer.from(marker)));
  const wal=await readFile(join(f.directory,'company.sqlite-wal')).catch(()=>Buffer.alloc(0));assert.ok(!wal.includes(Buffer.from(marker)));
  const companyState=await a.request('/api/state');assert.ok(!companyState.text.includes(marker));
  envelope(await a.request(endpoint,{action:'delete',expectedRevision:1}),2,'deleted');
  const deleted=f.app.store.get('workroomPracticeSync',f.users.member.id);assert.ok(!JSON.stringify(deleted).includes(marker));
  assert.equal((await a.request()).data.state,null);
});

test('revoked and deactivated sessions cannot read or mutate existing practice',async t=>{
  const f=await fixture(t),a=await f.client(),other=await f.client('other'),value=practice(f.users.member.id);
  envelope(await a.request(endpoint,save(value)),1,'active');f.app.store.revokeUser(f.users.member.id);
  assert.equal((await a.request()).status,401);assert.equal((await a.request(endpoint,save(value,1,false))).status,403);
  f.app.store.put('users',f.users.other.id,{...f.users.other,active:false});
  assert.equal((await other.request()).status,401);assert.equal((await other.request(endpoint,save(practice(f.users.other.id)))).status,403);
  const again=await f.client();envelope(await again.request(),1,'active');
});

test('session revocation during streamed body receipt is rechecked before the save commits',async t=>{
  const f=await fixture(t),a=await f.client(),value=practice(f.users.member.id),raw=JSON.stringify(save(value));
  let entered,serverRequest;const receivedRequest=new Promise(resolve=>{entered=resolve;});
  f.app.server.once('request',req=>{serverRequest=req;entered();});
  let request;
  const response=new Promise((resolve,reject)=>{
    request=httpRequest(f.base+endpoint,{method:'POST',headers:{Cookie:a.cookie,Origin:f.app.origin,'X-CSRF-Token':a.csrf,'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())}));
    });request.on('error',reject);request.flushHeaders();
  });
  await receivedRequest;
  // The async body iterator subscribes to readable only after the initial
  // authentication checks. Wait for that observable state, not a timed guess.
  const deadline=Date.now()+5000;
  while(serverRequest.listenerCount('readable')===0&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,1));
  assert.ok(serverRequest.listenerCount('readable')>0,'request entered the body receiver');
  let seen;const receiving=new Promise(resolve=>{seen=resolve;});serverRequest.once('readable',()=>seen());
  request.write(raw.slice(0,40));await receiving;
  f.app.store.revokeUser(f.users.member.id);request.end(raw.slice(40));
  const result=await response;assert.equal(result.status,401,JSON.stringify(result.data));assert.equal(f.app.store.all('workroomPracticeSync').length,0);
});
