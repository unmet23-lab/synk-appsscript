// Light per-tick observation and the one-minute full host check. Synthetic plan,
// fake host actions and local test servers only: no cloud, Docker or systemd.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createServer as createNetServer} from 'node:net';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialControlState} from './controller.mjs';
import {createNodeAgent,createLiveProbe,dockerInspect,appHealth,DEEP_HOST_MS} from './node-agent.mjs';

const plan={schema:'synk-ha-plan/v1',project:'synk-bake-unmet27',region:'asia-northeast3',armed:false,automaticFailback:false,
  nodes:{primary:{name:'synk-company-1',instanceId:'1000000000000000001',privateIp:'10.77.0.2',zone:'asia-northeast3-a'},
    standby:{name:'synk-company-2',instanceId:'1000000000000000002',privateIp:'10.77.0.3',zone:'asia-northeast3-b'},
    controller:{name:'synk-company-ha-control',instanceId:'1000000000000000003',privateIp:'10.77.0.4',zone:'asia-northeast3-c'}},
  data:{name:'synk-company-data-ha',diskId:'2000000000000000001',singleWriter:true,replication:'regional-pd-synchronous'},
  routing:{dropTrafficIfUnhealthy:true,healthCheck:{port:4192}},release:{manifestSha256:'a'.repeat(64)},
  runtime:{bucket:'synk-ha-synthetic-state',stateObject:'company/ha-control/state.json',receiptPrefix:'company/ha-control/receipts/',
    healthPrefix:'company/ha-control/health/',uptimeCheckId:'synthetic-check',observerIds:['observer-a','observer-b']}};
const failure=code=>Object.assign(new Error(code),{code});
const configFor=n=>({schema:'synk-ha-node/v1',nodeId:n.instanceId,nodeName:n.name,zone:n.zone,planPath:'/etc/synk/ha/plan.json',helperPath:'/opt/synk/ha/node-host.py',activationAllowed:true,diskId:plan.data.diskId,diskName:plan.data.name,releaseSha256:plan.release.manifestSha256});

function fixture({role='primary',light=true}={}){
  let now=1_000_000,mono=0,running=true,lightFailure=null,healthFailures=0,guards=true;
  const node=plan.nodes[role],config=configFor(node),state=initialControlState(plan,now),calls=[],logs=[];
  const google={readState:async()=>{calls.push('state');return {generation:'1',value:structuredClone(state)};},diskOwnership:async()=>{calls.push('disk');return true;},readReceipt:async()=>null,putReceipt:async()=>{calls.push('receipt');}};
  const host=async action=>{
    calls.push(action);
    if(action==='stop')running=false;
    if(action==='start')running=true;
    if(action==='health'&&(!running||healthFailures-->0))throw failure('HOST_HEALTH_FAILED');
    return {guardsAccepted:guards,startCompleted:true,durableHealthOk:true,externalReplaySafe:true};
  };
  const liveProbe=async()=>{calls.push('live');if(lightFailure)throw failure(lightFailure);if(!running)throw failure('LIVE_CONTAINER_NOT_READY');return true;};
  const agent=createNodeAgent({config,plan,google,host,now:()=>now,clock:()=>mono,liveProbe:light?liveProbe:null,log:x=>logs.push(x),verifyNetwork:async()=>({authBoundaryOk:true,outboundOk:true}),verifyPublic:async()=>({publicHttpsReady:true})});
  return {agent,config,state,calls,logs,
    async every(ms,count){const seen=[];for(let i=0;i<count;i++){const from=calls.length;await agent.tick();seen.push(calls.slice(from));now+=ms;mono+=ms;}return seen;},
    advance(ms){now+=ms;mono+=ms;},stepWall(ms){now+=ms;},get now(){return now;},set lightFailure(v){lightFailure=v;},set healthFailures(v){healthFailures=v;},set guards(v){guards=v;},get running(){return running;}};
}
const full=tick=>tick.includes('guards')&&tick.includes('health')&&!tick.includes('live');
const lightOnly=tick=>tick.includes('live')&&!tick.includes('guards')&&!tick.includes('health');

test('without a light probe every tick keeps the full guards and health path',async()=>{
  const f=fixture({light:false}),ticks=await f.every(5000,4);
  assert.ok(ticks.every(full));assert.equal(f.agent.status().ready,true);
});

test('a steady writer runs the full path once a minute and a fresh light probe in between',async()=>{
  const f=fixture(),ticks=await f.every(5000,13);
  assert.ok(full(ticks[0])&&full(ticks[12]),'first tick and the tick one minute later are full');
  assert.ok(ticks.slice(1,12).every(lightOnly),'the eleven ticks in between run only the light probe');
  assert.ok(ticks.every(x=>x.includes('state')&&x.includes('disk')),'write authority is read on every tick');
  assert.equal(f.calls.filter(x=>x==='release').length,2);assert.equal(f.agent.status().ready,true);assert.equal(f.agent.status().guardsAccepted,true);
  assert.equal(DEEP_HOST_MS,60000);
});

test('every authority change forces the full path on that tick, lease renewal does not',async()=>{
  for(const change of [s=>{s.activeEpoch+=1;},s=>{s.maintenanceUntil=1;},s=>{s.readyAllowed=[];},s=>{s.bootAllowed=[];s.readyAllowed=[];}]){
    const f=fixture();await f.every(5000,2);change(f.state);const [tick]=await f.every(5000,1);
    assert.ok(tick.includes('guards'),'authority change runs the guard check');
  }
  const f=fixture();await f.every(5000,2);f.state.updatedAt+=4000;f.state.lastReceipt={renewed:true};
  const [tick]=await f.every(5000,1);assert.ok(lightOnly(tick));
});

test('a control state without operation or command fields stays steady and never fences the writer',async()=>{
  const f=fixture();delete f.state.operation;delete f.state.command;const ticks=await f.every(5000,3);
  assert.ok(full(ticks[0])&&lightOnly(ticks[1])&&lightOnly(ticks[2]));assert.ok(!f.calls.includes('stop'));assert.equal(f.agent.status().ready,true);
});

test('a writer that left readiness is exposed again only after the full path',async()=>{
  const f=fixture();await f.every(5000,2);f.state.readyAllowed=[];
  let [tick]=await f.every(5000,1);assert.equal(f.agent.status().ready,false);assert.ok(!tick.includes('health')&&!tick.includes('live'));
  f.state.readyAllowed=[f.config.nodeId];[tick]=await f.every(5000,1);
  assert.ok(full(tick));assert.equal(f.agent.status().ready,true);
});

test('maintenance and unfinished operations keep the full path on every tick',async()=>{
  const m=fixture();m.state.maintenanceUntil=m.now+120000;assert.ok((await m.every(5000,4)).every(full),'maintenance window');
  const o=fixture();
  const done={operationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',from:plan.nodes.standby.instanceId,to:plan.nodes.primary.instanceId,diskId:plan.data.diskId,releaseSha256:plan.release.manifestSha256,activeEpoch:1,phase:'COMPLETE',phaseStartedAt:o.now,generation:7};
  o.state.operation=done;const after=await o.every(5000,3);
  assert.ok(full(after[0])&&lightOnly(after[1])&&lightOnly(after[2]),'a completed operation is steady');
  const fence={...done,from:plan.nodes.primary.instanceId,to:plan.nodes.standby.instanceId,activeEpoch:2,phase:'FENCE_OLD_WRITER',generation:8};
  o.state.operation=fence;o.state.command={schema:'synk-ha-command/v1',...fence,nonce:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',issuedAt:o.now};o.state.bootAllowed=[];o.state.readyAllowed=[];
  const busy=await o.every(5000,3);
  assert.ok(busy.every(x=>x.includes('guards')&&!x.includes('live')),'an operation in progress never uses the light probe');
  assert.equal(o.agent.status().ready,false);
  for(const [field,value] of [['api',{kind:'stop',requestId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}],['deployment',{id:'synthetic-deployment'}]]){
    const d=fixture();await d.every(5000,2);d.state[field]=value;
    assert.ok((await d.every(5000,3)).every(full),field+' record keeps the full path');
  }
  const r=fixture();await r.every(5000,2);r.state.runner={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',until:r.now+60000};
  assert.ok(lightOnly((await r.every(5000,1))[0]),'a controller lease renewal is not an authority change');
});

test('a failed light probe is confirmed by the full health check in the same tick',async()=>{
  const f=fixture();await f.every(5000,2);f.lightFailure='LIVE_APP_NOT_READY';
  const ticks=await f.every(5000,2);
  for(const tick of ticks){assert.ok(tick.indexOf('live')<tick.indexOf('health'));assert.ok(!tick.includes('stop')&&!tick.includes('start')&&!tick.includes('guards'));}
  assert.equal(f.agent.status().ready,true);
  assert.deepEqual(f.logs,[{event:'SYNK_HA_NODE_LIGHT',code:'LIVE_APP_NOT_READY'}],'one log line per new light failure code');
  f.lightFailure=null;await f.every(5000,1);assert.deepEqual(f.logs.at(-1),{event:'SYNK_HA_NODE_LIGHT',code:'LIGHT_RECOVERED'});
});

test('a failed light probe and a failed full check use the existing owner recovery',async()=>{
  const f=fixture();await f.every(5000,2);f.lightFailure='LIVE_CONTAINER_NOT_READY';f.healthFailures=1;
  const [tick]=await f.every(5000,1);
  assert.deepEqual(tick.filter(x=>['live','health','stop','start'].includes(x)),['live','health','stop','start','health']);
  assert.equal(f.agent.status().ready,true);f.lightFailure=null;
  const [next]=await f.every(5000,1);assert.ok(full(next),'a stop or start drops the reused evidence');
});

test('a failed tick drops the reused evidence and the next tick is full',async()=>{
  const f=fixture();await f.every(5000,2);
  f.state.schema='broken';const [bad]=await f.every(5000,1);f.state.schema='synk-ha-control/v1';
  assert.ok(bad.includes('stop'),'an invalid control state fences the writer');assert.equal(f.agent.status().ready,false);
  const [recovering]=await f.every(5000,1);
  assert.ok(recovering.includes('guards')&&!recovering.includes('live'),'the tick after a failure runs the full path');
  assert.ok(recovering.indexOf('stop')<recovering.indexOf('start'),'the stopped owner is recovered by the existing path');
  assert.equal(f.agent.status().ready,true);
  const [after]=await f.every(5000,1);assert.ok(full(after),'a tick with a stop and start is followed by a full tick');
  const [steady]=await f.every(5000,1);assert.ok(lightOnly(steady));assert.equal(f.agent.status().ready,true);
});

test('the standby fence keeps the guard check on every tick',async()=>{
  const f=fixture({role:'standby'}),ticks=await f.every(5000,6);
  assert.ok(ticks.every(x=>x.includes('guards')&&x.includes('stop')&&!x.includes('live')));assert.equal(f.agent.status().ready,false);
});

test('a late tick, a wall clock behind the last full pass or a paused VM forces the full path',async()=>{
  const late=fixture();await late.every(5000,2);late.advance(DEEP_HOST_MS);
  assert.ok(full((await late.every(5000,1))[0]),'a minute or more since the last full pass');
  const back=fixture();await back.every(5000,2);back.stepWall(-20000);
  assert.ok(full((await back.every(5000,1))[0]),'wall time before the last full pass');
  const paused=fixture();await paused.every(5000,2);paused.stepWall(120000);
  assert.ok(full((await paused.every(5000,1))[0]),'wall time moved on while the monotonic clock did not');
});

test('a small wall clock step back cannot stretch the evidence beyond a minute',async()=>{
  const f=fixture(),start=await f.every(5000,10);assert.ok(full(start[0])&&start.slice(1).every(lightOnly));
  f.stepWall(-30000);const ticks=await f.every(5000,3);
  assert.ok(lightOnly(ticks[0])&&lightOnly(ticks[1]),'50 and 55 seconds of real time');
  assert.ok(full(ticks[2]),'60 seconds of real time although the wall clock shows 30');
});

test('rejected guards on the minute check stop the writer',async()=>{
  const f=fixture();await f.every(5000,12);f.guards=false;const [tick]=await f.every(5000,1);
  assert.ok(tick.includes('guards')&&tick.at(-1)==='stop');assert.equal(f.agent.status().ready,false);assert.equal(f.agent.status().reason,'GUARDS_NOT_ACCEPTED');
});

// Live probe adapter: exact copy of node-host.py durable_health container rules.
const IMAGES={'synk-company-company-1':'sha256:'+'1'.repeat(64),'synk-company-https-1':'sha256:'+'2'.repeat(64),'synk-spaceship-spaceship-1':'sha256:'+'3'.repeat(64)};
const liveConfig=()=>({...configFor(plan.nodes.primary),mount:'/srv/synk',containers:Object.entries(IMAGES).map(([name,imageId])=>({name,imageId}))});
const MOUNTINFO='22 1 8:1 / / rw,relatime shared:1 - ext4 /dev/sda1 rw\n301 22 8:16 / /srv/synk rw,nosuid,nodev,relatime shared:150 - ext4 /dev/sdb rw,discard\n';
function inspected(){
  return Object.fromEntries(Object.entries(IMAGES).map(([name,Image])=>[name,{Name:'/'+name,Image,HostConfig:{RestartPolicy:{Name:'no'}},
    State:{Running:true,Paused:false,Restarting:false,Dead:false,...(name==='synk-spaceship-spaceship-1'?{}:{Health:{Status:'healthy'}})},
    Config:{Env:name==='synk-company-company-1'?['SYNK_COMPANY_SECRET=never-read','SYNK_COMPANY_ORIGIN=https://workspace.example.test','SYNK_COMPANY_PORT=4191','OTHER=private']:[]},
    NetworkSettings:{Networks:{'synk-company_edge':{IPAddress:name==='synk-company-company-1'?'172.30.77.2':'172.30.77.3'}}}}]));
}
function probeFixture(change=()=>{}){
  const docker=inspected(),io={mountInfo:MOUNTINFO,device:'8:16',app:{ready:true,ok:true}},seen=[];change(docker,io);
  const probe=createLiveProbe(liveConfig(),{docker:async name=>{if(!docker[name])throw failure('LIVE_CONTAINER_MISSING');return docker[name];},
    app:async target=>{seen.push(target);return io.app;},mountInfo:async()=>io.mountInfo,device:async()=>io.device});
  return {probe,seen};
}

test('the live probe accepts a healthy writer and probes the application by its public Host',async()=>{
  const f=probeFixture();assert.equal(await f.probe(),true);
  assert.deepEqual(f.seen,[{address:'172.30.77.2',port:4191,host:'workspace.example.test'}]);
});

for(const [name,change,code] of [
  ['missing container',d=>{delete d['synk-company-https-1'];},'LIVE_CONTAINER_MISSING'],
  ['different image',d=>{d['synk-company-company-1'].Image='sha256:'+'9'.repeat(64);},'LIVE_CONTAINER_IMAGE'],
  ['different name',d=>{d['synk-spaceship-spaceship-1'].Name='/other';},'LIVE_CONTAINER_IMAGE'],
  ['docker restart policy',d=>{d['synk-company-https-1'].HostConfig.RestartPolicy.Name='unless-stopped';},'LIVE_RESTART_BYPASS'],
  ['stopped container',d=>{d['synk-spaceship-spaceship-1'].State.Running=false;},'LIVE_CONTAINER_NOT_READY'],
  ['paused container',d=>{d['synk-company-https-1'].State.Paused=true;},'LIVE_CONTAINER_NOT_READY'],
  ['restarting container',d=>{d['synk-company-company-1'].State.Restarting=true;},'LIVE_CONTAINER_NOT_READY'],
  ['dead container',d=>{d['synk-company-company-1'].State.Dead=true;},'LIVE_CONTAINER_NOT_READY'],
  ['company health starting',d=>{d['synk-company-company-1'].State.Health.Status='starting';},'LIVE_CONTAINER_NOT_READY'],
  ['company health missing',d=>{delete d['synk-company-company-1'].State.Health;},'LIVE_CONTAINER_NOT_READY'],
  ['sidecar unhealthy',d=>{d['synk-company-https-1'].State.Health.Status='unhealthy';},'LIVE_CONTAINER_NOT_READY'],
  ['read-only mount',(d,io)=>{io.mountInfo=io.mountInfo.replace('/srv/synk rw,','/srv/synk ro,');},'LIVE_MOUNT_READ_ONLY'],
  ['read-only filesystem after errors',(d,io)=>{io.mountInfo=io.mountInfo.replace('/dev/sdb rw,discard','/dev/sdb ro,discard');},'LIVE_MOUNT_READ_ONLY'],
  ['unmounted data disk',(d,io)=>{io.mountInfo=io.mountInfo.split('\n')[0];},'LIVE_MOUNT_MISSING'],
  ['stacked data mounts',(d,io)=>{io.mountInfo+=io.mountInfo.split('\n')[1].replace('301 ','302 ');},'LIVE_MOUNT_MISSING'],
  ['other device at the mount point',(d,io)=>{io.device='8:32';},'LIVE_MOUNT_DEVICE'],
  ['bind mount of a directory of the data disk',(d,io)=>{io.mountInfo=io.mountInfo.replace('301 22 8:16 / /srv/synk','301 22 8:16 /old /srv/synk');},'LIVE_MOUNT_SUBTREE'],
  ['application not ready',(d,io)=>{io.app={ready:false};},'LIVE_APP_NOT_READY'],
  ['application without a body',(d,io)=>{io.app=null;},'LIVE_APP_NOT_READY'],
  ['two container networks',d=>{d['synk-company-company-1'].NetworkSettings.Networks.extra={IPAddress:'172.30.78.2'};},'LIVE_APP_ADDRESS'],
  ['public container address',d=>{d['synk-company-company-1'].NetworkSettings.Networks['synk-company_edge'].IPAddress='34.64.0.1';},'LIVE_APP_ADDRESS'],
  ['origin with a path',d=>{d['synk-company-company-1'].Config.Env[1]='SYNK_COMPANY_ORIGIN=https://workspace.example.test/x';},'LIVE_APP_ORIGIN'],
  ['missing origin',d=>{d['synk-company-company-1'].Config.Env.splice(1,1);},'LIVE_APP_ORIGIN'],
  ['duplicated origin',d=>{d['synk-company-company-1'].Config.Env.push('SYNK_COMPANY_ORIGIN=https://other.example.test');},'LIVE_APP_ORIGIN'],
  ['invalid port',d=>{d['synk-company-company-1'].Config.Env[2]='SYNK_COMPANY_PORT=70000';},'LIVE_APP_ORIGIN'],
])test('the live probe rejects '+name,async()=>{
  const f=probeFixture(change);await assert.rejects(f.probe(),e=>e.code===code&&!/never-read|private/.test(e.message));
});

test('the live probe refuses an unexpected container or mount contract before any read',()=>{
  for(const change of [c=>{c.containers.pop();},c=>{c.containers[0].name='other';},c=>{c.containers[1].imageId='latest';},c=>{c.mount='/srv/other';},c=>{delete c.containers;}]){
    const c=liveConfig();change(c);assert.throws(()=>createLiveProbe(c),/LIVE_(CONTAINER|MOUNT)_CONTRACT/);
  }
});

async function listen(t,handler,address){
  const server=createServer(handler);await new Promise(resolve=>server.listen(address??0,address?undefined:'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));return server.address();
}

test('the Docker read uses the local socket, a name-only path and a bounded body',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'synk-ha-docker-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const socketPath=process.platform==='win32'?'\\\\.\\pipe\\synk-ha-docker-'+process.pid+'-'+Date.now():join(dir,'docker.sock'),seen=[];
  await listen(t,(req,res)=>{seen.push({path:req.url,method:req.method});
    if(req.url==='/containers/missing/json'){res.writeHead(404);res.end('{}');return;}
    if(req.url==='/containers/huge/json'){res.end('{"x":"'+'a'.repeat(1_100_000)+'"}');return;}
    if(req.url==='/containers/broken/json'){res.end('not json');return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({Name:'/synk-company-company-1'}));},socketPath);
  assert.deepEqual(await dockerInspect('synk-company-company-1',{socketPath}),{Name:'/synk-company-company-1'});
  await assert.rejects(dockerInspect('missing',{socketPath}),/LIVE_CONTAINER_MISSING/);
  await assert.rejects(dockerInspect('huge',{socketPath}),/LIVE_RESPONSE_TOO_LARGE/);
  await assert.rejects(dockerInspect('broken',{socketPath}),/LIVE_DOCKER_INVALID/);
  assert.deepEqual(seen[0],{path:'/containers/synk-company-company-1/json',method:'GET'});
});

test('the application probe sends the public Host, reads at most 4096 bytes and times out',async t=>{
  const seen=[];const {port}=await listen(t,(req,res)=>{seen.push({host:req.headers.host,path:req.url});
    if(req.headers.host!=='workspace.example.test'){res.writeHead(403);res.end('{}');return;}
    if(req.url!=='/api/health'){res.writeHead(404);res.end('{}');return;}
    res.end('{"ok":true,"ready":true}');});
  assert.deepEqual(await appHealth({address:'127.0.0.1',port,host:'workspace.example.test'}),{ok:true,ready:true});
  await assert.rejects(appHealth({address:'127.0.0.1',port,host:'127.0.0.1'}),/LIVE_APP_NOT_READY/);
  assert.deepEqual(seen[0],{host:'workspace.example.test',path:'/api/health'});
  const big=await listen(t,(req,res)=>res.end('{"ready":true,"pad":"'+'a'.repeat(5000)+'"}'));
  await assert.rejects(appHealth({address:'127.0.0.1',port:big.port,host:'x'}),/LIVE_RESPONSE_TOO_LARGE/);
  const slow=await listen(t,()=>{});
  await assert.rejects(appHealth({address:'127.0.0.1',port:slow.port,host:'x'},{timeoutMs:200}),e=>e.name==='TimeoutError'||e.name==='AbortError');
});

test('a 101 upgrade reply or a connection closed without a reply ends the probe at once',async t=>{
  const raw=async reply=>{
    const server=createNetServer(socket=>socket.once('data',()=>reply(socket)));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
    return server.address().port;
  };
  const upgrade=await raw(socket=>socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'));
  const closed=await raw(socket=>socket.end());
  for(const [port,pattern] of [[upgrade,/LIVE_UNEXPECTED_UPGRADE/],[closed,/LIVE_RESPONSE_INCOMPLETE|ECONNRESET|socket hang up/]]){
    const started=Date.now();
    await assert.rejects(appHealth({address:'127.0.0.1',port,host:'x'},{timeoutMs:30000}),e=>pattern.test(e.code??e.message));
    assert.ok(Date.now()-started<5000,'settles without waiting for the deadline');
  }
});
