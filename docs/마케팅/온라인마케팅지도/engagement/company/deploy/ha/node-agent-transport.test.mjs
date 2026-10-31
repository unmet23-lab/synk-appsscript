import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNodeGoogle,createNodeAgent} from './node-agent.mjs';
import {initialControlState} from './controller.mjs';

const plan=JSON.parse(readFileSync(new URL('./plan.json',import.meta.url)));
const node=plan.nodes.primary;
const config={schema:'synk-ha-node/v1',nodeId:node.instanceId,nodeName:node.name,zone:node.zone,planPath:'/etc/synk/ha/plan.json',helperPath:'/opt/synk/ha/node-host.py',activationAllowed:true,diskId:plan.data.diskId,diskName:plan.data.name,releaseSha256:plan.release.manifestSha256};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status});
const reset=()=>new TypeError('private URL and token must not be logged',{cause:Object.assign(new Error('private transport message'),{code:'ECONNRESET'})});
function fixture(handle,options={}){
  const calls=[],logs=[];let now=1000000;
  const state=initialControlState(plan,now);
  const fetchImpl=async(url,request)=>{
    calls.push({url,request});
    const override=await handle?.(url,request,calls);if(override!==undefined)return override;
    if(url.endsWith('project-id'))return new Response(plan.project,{headers:{'Metadata-Flavor':'Google'}});
    if(url.endsWith('/instance/id'))return new Response(config.nodeId,{headers:{'Metadata-Flavor':'Google'}});
    if(url.endsWith('/token'))return new Response(JSON.stringify({access_token:'PRIVATE_TOKEN',token_type:'Bearer',expires_in:3600}),{headers:{'Metadata-Flavor':'Google'}});
    if(url.includes('/instances/'))return reply({id:config.nodeId,disks:[{source:`https://compute.googleapis.com/compute/v1/projects/${plan.project}/regions/${plan.region}/disks/${plan.data.name}`,mode:'READ_WRITE',boot:false,autoDelete:false}]});
    if(url.includes('/disks/'))return reply({id:config.diskId});
    return reply(new URL(url).searchParams.get('alt')==='media'?state:{generation:'17'});
  };
  return {calls,logs,state,google:createNodeGoogle(config,plan,{fetchImpl,now:()=>now,log:x=>logs.push(x),...options}),advance:ms=>{now+=ms;},now:()=>now};
}
const cloud=url=>url.startsWith('https://storage.googleapis.com/storage/');
const body=url=>cloud(url)&&new URL(url).searchParams.get('alt')==='media';

test('one transient GET reset recovers with the same generation and safe diagnostics',async()=>{
  let count=0;const f=fixture(url=>{if(body(url)&&++count===1)throw reset();});
  const result=await f.google.readState();assert.equal(result.generation,'17');assert.equal(count,2);
  const requests=f.calls.filter(x=>body(x.url));assert.equal(requests[0].url,requests[1].url);
  assert.deepEqual(f.logs.map(x=>[x.phase,x.outcome,x.attempt]),[['STATE_BODY','RETRY',1],['STATE_BODY','RECOVERED',2]]);
  assert.equal(f.logs[0].errorName,'TypeError');assert.equal(f.logs[0].errorCode,'ECONNRESET');assert.equal(f.logs[0].stage,'headers');
  assert.ok(f.logs.every(x=>Number.isInteger(x.elapsedMs)&&Number.isInteger(x.attemptMs)));
  assert.doesNotMatch(JSON.stringify(f.logs),/PRIVATE_TOKEN|https?:|Authorization|private|access_token|generation|bootAllowed/);
});

test('persistent GET transport failure stops at two attempts with a phase code',async()=>{
  const f=fixture(url=>{if(cloud(url))throw reset();});
  await assert.rejects(f.google.readState(),{code:'STATE_META_TRANSPORT'});
  assert.equal(f.calls.filter(x=>cloud(x.url)).length,2);assert.equal(f.logs.at(-1).outcome,'FAILED');
});

for(const status of [408,429,500,502,503,504])test(`GET HTTP ${status} retries once and cancels the failed response`,async()=>{
  let calls=0,cancelled=0;const f=fixture(url=>{
    if(cloud(url)&&!body(url)&&++calls===1)return new Response(new ReadableStream({cancel(){cancelled++;}}),{status});
  });
  await f.google.readState();assert.equal(calls,2);assert.equal(cancelled,1);assert.equal(f.logs[0].code,'STATE_META_HTTP_'+status);
});

for(const status of [400,401,403])test(`GET HTTP ${status} fails closed without retry`,async()=>{
  const f=fixture(url=>cloud(url)?reply({},status):undefined);
  await assert.rejects(f.google.readState(),{code:'STATE_META_HTTP_'+status});
  assert.equal(f.calls.filter(x=>cloud(x.url)).length,1);assert.equal(f.logs[0].outcome,'FAILED');
});

test('GET 404 remains an absent object rather than a retry',async()=>{
  const f=fixture(url=>cloud(url)?reply({},404):undefined);assert.equal(await f.google.readState(),null);
  assert.equal(f.calls.filter(x=>cloud(x.url)).length,1);assert.equal(f.logs.length,0);
});

for(const failure of ['timeout','503'])test(`POST ${failure} is never retried`,async()=>{
  const f=fixture((url,request)=>{if(request.method==='POST'){if(failure==='timeout')throw new DOMException('private request','TimeoutError');return reply({},503);}});
  await assert.rejects(f.google.putReceipt({operationId:'synthetic-operation',generation:1},{status:'DONE'}),{code:'RECEIPT_WRITE_'+(failure==='timeout'?'TIMEOUT':'HTTP_503')});
  assert.equal(f.calls.filter(x=>x.request.method==='POST').length,1);assert.equal(f.logs.at(-1).outcome,'FAILED');
});

test('malformed body and unrecognized transport error are not transient',async()=>{
  for(const failure of ['json','tls']){
    const f=fixture(url=>{if(cloud(url)){if(failure==='json')return new Response('{broken');throw new TypeError('private certificate detail',{cause:{code:'CERT_HAS_EXPIRED'}});}});
    await assert.rejects(f.google.readState(),{code:failure==='json'?'STATE_META_RESPONSE_INVALID':'STATE_META_FAILED'});
    assert.equal(f.calls.filter(x=>cloud(x.url)).length,1);assert.doesNotMatch(JSON.stringify(f.logs),/certificate|CERT_HAS_EXPIRED|private/);
  }
});

test('numeric TimeoutError becomes a phase code and a late second response is rejected',async()=>{
  let elapsed=0,calls=0;const f=fixture(url=>{if(cloud(url)){if(++calls===1){elapsed=4000;throw new DOMException('private timeout','TimeoutError');}elapsed=10000;return reply({generation:'17'});}},{clock:()=>elapsed});
  await assert.rejects(f.google.readState(),{code:'STATE_META_TIMEOUT'});assert.equal(calls,2);
  assert.equal(f.logs.at(-1).elapsedMs,10000);assert.equal(f.logs.at(-1).code,'STATE_META_TIMEOUT');assert.equal(f.logs.at(-1).outcome,'FAILED');
});

test('metadata read retries within its original four-second deadline',async()=>{
  let elapsed=0,calls=0;const f=fixture(url=>{if(url.endsWith('/token')){if(++calls===1){elapsed=2000;throw reset();}elapsed=4000;return new Response(JSON.stringify({access_token:'PRIVATE_TOKEN',token_type:'Bearer',expires_in:3600}),{headers:{'Metadata-Flavor':'Google'}});}},{clock:()=>elapsed});
  await assert.rejects(f.google.readState(),{code:'META_TOKEN_TIMEOUT'});assert.equal(calls,2);
  assert.equal(f.calls.filter(x=>cloud(x.url)).length,0);assert.equal(f.logs.at(-1).elapsedMs,4000);
});

test('external cancellation suppresses retry even when transport reports a timeout',async()=>{
  const controller=new AbortController();const f=fixture(url=>{if(cloud(url)){controller.abort();throw new DOMException('private','TimeoutError');}});
  const value={schema:'synk-ha-health/v1',nodeId:config.nodeId,releaseSha256:config.releaseSha256,activeEpoch:1,alive:true,ready:true,activationAllowed:true,guardsAccepted:true,at:1000000,stopFailed:false,status:'healthy'};
  await assert.rejects(f.google.putHealth(value,{signal:controller.signal}),{code:'HEALTH_META_ABORTED'});
  assert.equal(f.calls.filter(x=>cloud(x.url)).length,1);assert.equal(f.calls.filter(x=>x.request.method==='POST').length,0);
});

test('logging failure cannot change successful transport recovery',async()=>{
  let calls=0;const f=fixture(url=>{if(cloud(url)&&++calls===1)throw reset();},{log:()=>{throw new Error('logger unavailable');}});
  assert.equal((await f.google.readState()).generation,'17');
});

test('agent remains fresh only on confirmed state and still stops after exhausted reads',async()=>{
  let fail=false,begin,release;const started=new Promise(r=>begin=r),pending=new Promise(r=>release=r);
  const f=fixture(async url=>{if(fail&&cloud(url)){begin();await pending;throw reset();}}),actions=[];
  const agent=createNodeAgent({config,plan,google:f.google,now:f.now,host:async action=>{actions.push(action);return {guardsAccepted:true};}});
  await agent.tick();assert.equal(agent.status().ready,true);fail=true;
  const tick=agent.tick();await started;f.advance(15001);assert.equal(agent.status().ready,false);assert.equal(agent.status().alive,false);
  release();await tick;assert.equal(actions.at(-1),'stop');assert.equal(agent.status().reason,'STATE_META_TRANSPORT');assert.equal(agent.status().ready,false);
});

test('revoked permission in a retried generation-bound body is acted on immediately',async()=>{
  let fail=false,calls=0;const f=fixture(url=>{if(fail&&body(url)&&++calls===1){f.state.bootAllowed=[];f.state.readyAllowed=[];throw reset();}}),actions=[];
  const agent=createNodeAgent({config,plan,google:f.google,now:f.now,host:async action=>{actions.push(action);return {guardsAccepted:true};}});
  await agent.tick();assert.equal(agent.status().ready,true);fail=true;await agent.tick();
  assert.equal(calls,2);assert.equal(agent.status().ready,false);assert.equal(actions.at(-1),'stop');assert.equal(agent.status().reason,'STANDBY');
});

test('first-attempt body timeout is retried using TimeoutError rather than numeric code 23',{timeout:7000},async t=>{
  const keepAlive=setInterval(()=>{},1000);t.after(()=>clearInterval(keepAlive));let calls=0;
  const f=fixture((url,request)=>{if(cloud(url)&&!body(url)&&++calls===1)return new Response(new ReadableStream({start(controller){request.signal.addEventListener('abort',()=>controller.error(new DOMException('private body abort','AbortError')),{once:true});}}));});
  await f.google.readState();assert.equal(calls,2);assert.equal(f.logs[0].stage,'body');assert.equal(f.logs[0].code,'STATE_META_TIMEOUT');assert.equal(f.logs[0].errorName,'TimeoutError');assert.equal(f.logs.at(-1).outcome,'RECOVERED');
});

test('persistent header stalls use one ten-second deadline across both attempts',{timeout:13000},async t=>{
  const keepAlive=setInterval(()=>{},1000);t.after(()=>clearInterval(keepAlive));
  const f=fixture((url,request)=>{if(cloud(url))return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(request.signal.reason),{once:true}));});
  const start=performance.now();await assert.rejects(f.google.readState(),{code:'STATE_META_TIMEOUT'});const elapsed=performance.now()-start;
  assert.equal(f.calls.filter(x=>cloud(x.url)).length,2);assert.ok(elapsed>=9500&&elapsed<11500,'retry must not renew the ten-second deadline');assert.equal(f.logs.at(-1).stage,'headers');
});
