import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {createTrialFeedbackRoutes} from './trial-feedback-routes.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'trial-routes-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,trialFeedbackOptions:{origins:['https://synk.im']}});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Trial test admin',email:'admin@example.test',password:'local-test-password',role:'admin'});
  const enrollment=()=>({v:1,app:'talk-rally',surface:'lab-web',participantId:randomUUID(),submissionId:randomUUID(),cohort:'qa-integration',consentAt:new Date().toISOString(),consent:{version:'2026-11-09',age14:true},round:{roundId:randomUUID(),startedAt:new Date().toISOString(),mode:'normal',total:12,correct:8,helped:1,soundOn:true},answers:{fun:'fun_3',stuck:['listen'],stuckNote:'synthetic fixture only',again:'again_7d'}});
  const post=(path,input,headers={})=>fetch(base+path,{method:'POST',headers:{Origin:'https://synk.im','Content-Type':'application/json',...headers},body:JSON.stringify(input)});
  const login=async()=>{const response=await post('/api/login',{email:'admin@example.test',password:'local-test-password'},{Origin:app.origin});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
  return {app,base,admin,enrollment,post,login};
}
test('public enrollment uses exact origin CORS without granting credentials or a staff session',async t=>{
  const f=await fixture(t),input=f.enrollment();
  const preflight=await fetch(f.base+'/trial-feedback/enroll',{method:'OPTIONS',headers:{Origin:'https://synk.im','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://synk.im');assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
  for(const origin of ['https://synk.im.evil.test','null','https://other.test']){const r=await f.post('/trial-feedback/enroll',input,{Origin:origin});assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);}
  let result=await f.post('/trial-feedback/enroll',input);assert.equal(result.status,201);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(result.headers.get('set-cookie'),null);
  result=await f.post('/trial-feedback/enroll',input);assert.equal(result.status,200);assert.equal((await result.json()).duplicate,true);
  const report=await fetch(f.base+'/api/trial-feedback/summary',{headers:{Origin:'https://synk.im'}});assert.equal(report.status,401);assert.equal(report.headers.get('access-control-allow-origin'),null);
});
test('staff results require a current active role and keep synthetic data out of the default report',async t=>{
  const f=await fixture(t);assert.equal((await f.post('/trial-feedback/enroll',f.enrollment())).status,201);const cookie=await f.login();
  const report=async(query='')=>fetch(f.base+'/api/trial-feedback/summary'+query,{headers:{Cookie:cookie}});
  let r=await report();assert.equal(r.status,200);let data=await r.json();assert.equal(data.denominators.participants,0);assert.equal(data.otherDataCount,1);
  r=await report('?data=synthetic');data=await r.json();assert.equal(data.denominators.participants,1);assert.equal(data.comments[0].note,'synthetic fixture only');
  f.app.store.put('users',f.admin.id,{...f.app.store.get('users',f.admin.id),role:'viewer'});data=await (await report('?data=synthetic')).json();assert.equal(data.comments,null);
  f.app.store.put('users',f.admin.id,{...f.app.store.get('users',f.admin.id),role:'customer'});assert.equal((await report()).status,403);
  f.app.store.put('users',f.admin.id,{...f.app.store.get('users',f.admin.id),active:false});assert.equal((await report()).status,401);
});
test('unknown query keys, duplicate filters, non-JSON bodies and oversized payloads fail without storing',async t=>{
  const f=await fixture(t),input=f.enrollment();
  assert.equal((await f.post('/trial-feedback/enroll?demo=1',input)).status,403);
  assert.equal((await f.post('/trial-feedback/enroll?extra=1',input)).status,400);
  assert.equal((await f.post('/trial-feedback/enroll',input,{'x-synk-demo':'1'})).status,403);
  assert.equal((await f.post('/trial-feedback/enroll',input,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await fetch(f.base+'/trial-feedback/enroll',{headers:{Origin:'https://synk.im'}})).status,405);
  const malformed=await fetch(f.base+'/trial-feedback/enroll',{method:'POST',headers:{Origin:'https://synk.im','Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,400);
  assert.equal((await f.post('/trial-feedback/enroll',{...input,huge:'x'.repeat(5000)})).status,413);
  assert.equal(f.app.store.count('trialParticipants'),0);
  const cookie=await f.login();for(const query of ['?days=30&days=7','?data=','?unknown=1','?cohort=','?days=1'])assert.equal((await fetch(f.base+'/api/trial-feedback/summary'+query,{headers:{Cookie:cookie}})).status,400);
});
test('public withdrawal erases feedback and its delayed retry is refused through HTTP',async t=>{
  const f=await fixture(t),input=f.enrollment();await f.post('/trial-feedback/enroll',input);
  const request={v:1,app:'talk-rally',participantId:input.participantId};
  assert.deepEqual(await (await f.post('/trial-feedback/withdraw',request)).json(),{ok:true,deleted:true});
  assert.equal((await f.post('/trial-feedback/enroll',input)).status,410);
  assert.deepEqual(await (await f.post('/trial-feedback/withdraw',request)).json(),{ok:true,deleted:true});
  assert.equal(f.app.store.count('trialParticipants'),0);assert.equal(f.app.store.count('trialEvents'),0);
});
test('public routing leaves the staff page and its assets to the static handler',async()=>{
  const routes=createTrialFeedbackRoutes({service:{},send(){throw new Error('unexpected send');}});
  for(const path of ['/trial-feedback/','/trial-feedback/trial-feedback.js','/trial-feedback/trial-feedback.css','/unrelated'])assert.equal(await routes.publicRoutes({method:'GET'},{},{url:new URL('https://work.example.test'+path)}),false);
});
test('shutdown while reading a public body cannot create a participant',async()=>{
  let stopped=false,writes=0,result;
  const routes=createTrialFeedbackRoutes({service:{allowOrigin:()=>true,enroll:()=>{writes++;}},body:async()=>{stopped=true;return {};},send:(_res,status,data)=>{result={status,data};},isStopped:()=>stopped,clientAddress:()=>''});
  await routes.publicRoutes({method:'POST',headers:{origin:'https://synk.im','content-type':'application/json'}},{setHeader(){}},{url:new URL('https://work.example.test/trial-feedback/enroll')});
  assert.equal(writes,0);assert.equal(result.status,503);assert.equal(result.data.error,'stopped');
});
