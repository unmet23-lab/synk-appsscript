import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalWorldClient} from '../src/local-world-client.mjs';
const ok=value=>({ok:true,status:200,json:async()=>value});
test('local join is explicit and authenticated requests send only the current bearer to fixed local paths',async()=>{
  const requests=[],client=createLocalWorldClient({getToken:()=> 'local-A',guard(){},fetcher:async(path,init)=>{requests.push({path,init});return ok({ok:true});}});
  await client.join('join-code',true);assert.equal(requests[0].init.headers.Authorization,undefined);assert.deepEqual(JSON.parse(requests[0].init.body),{code:'join-code',consent:true});
  await client.student();await client.learning.get({after:8,revision:3});await client.learning.post({revision:3,events:[{id:'event-1'}]});
  assert.equal(requests[1].path,'/api/student');assert.equal(requests[2].path,'/api/world/learning?after=8&revision=3');
  for(const row of requests.slice(1)){assert.equal(row.init.headers.Authorization,'Bearer local-A');assert.equal(row.init.credentials,'omit');}
  assert.deepEqual(JSON.parse(requests[3].init.body),{revision:3,events:[{id:'event-1'}]});
});
test('a late response after account switch cannot return another account data or log out the new connection',async()=>{
  let active=true,resolve,expired=0;const client=createLocalWorldClient({getToken:()=> 'local-A',guard(){if(!active)throw Object.assign(new Error('changed'),{code:'ACCOUNT_CHANGED'});},onUnauthorized(){expired++;},fetcher:()=>new Promise(done=>resolve=done)});
  const request=client.student();active=false;resolve({ok:false,status:401,json:async()=>({code:'AUTH_REQUIRED'})});
  await assert.rejects(request,error=>error.code==='ACCOUNT_CHANGED');assert.equal(expired,0);
});
test('identity is checked after JSON parsing and rejected sharing changes cannot trigger a reload',async()=>{
  let active=true,parse,sharing=0;const client=createLocalWorldClient({getToken:()=> 'local-A',guard(){if(!active)throw Object.assign(new Error('changed'),{code:'ACCOUNT_CHANGED'});},onSharing(){sharing++;},fetcher:async()=>({ok:true,status:200,json:()=>new Promise(done=>parse=done)})});
  const request=client.setLearning(false,2);await new Promise(done=>setImmediate(done));active=false;parse({ok:true,enabled:false,revision:3});
  await assert.rejects(request,error=>error.code==='ACCOUNT_CHANGED');assert.equal(sharing,0);
});
test('only a current 401 expires the local session, while forbidden and revision errors remain visible',async()=>{
  for(const status of [401,403,409]){let expired=0;const client=createLocalWorldClient({getToken:()=> 'current',guard(){},onUnauthorized:token=>{assert.equal(token,'current');expired++;},fetcher:async()=>({ok:false,status,json:async()=>({ok:false,code:status===409?'REVISION_CONFLICT':'FORBIDDEN',message:'확인 필요'})})});await assert.rejects(client.student(),/확인 필요/);assert.equal(expired,status===401?1:0);}
});
test('timed-out requests abort without inventing a submission result',async()=>{
  const client=createLocalWorldClient({getToken:()=> 'current',guard(){},timeoutMs:5,fetcher:(_path,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('timeout'),{name:'AbortError'}))))});
  await assert.rejects(client.submit({assignmentId:'a',answers:{q:'o'},revision:1,idempotencyKey:'retry-same'}),error=>error.code==='NETWORK_ERROR');
});
