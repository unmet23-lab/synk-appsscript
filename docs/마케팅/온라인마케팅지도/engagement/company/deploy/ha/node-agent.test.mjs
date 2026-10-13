import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {initialControlState} from './controller.mjs';
import {validateNodeConfig,bootAuthorized,commandForNode,createNodeAgent,createNodeGoogle,LOCAL_AUTH_PROBE_JS} from './node-agent.mjs';
const plan=JSON.parse(readFileSync(new URL('./plan.json',import.meta.url)));
const exec=promisify(execFile);
const healthProbe=readFileSync(new URL('./node-host.py',import.meta.url),'utf8').match(/HEALTH_PROBE_JS=r'''\r?\n([\s\S]*?)'''/)[1];
async function probeServer(t,handler){
 const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const port=server.address().port;
 return {port,run:async(script,overrides={})=>JSON.parse((await exec(process.execPath,['-e',script],{timeout:7000,env:{...process.env,SYNK_COMPANY_ORIGIN:'https://workspace.example.test',SYNK_COMPANY_PORT:String(port),...overrides}})).stdout)};
}
test('actual local probes pass the public Host guard before health and authentication checks',async t=>{
 const seen=[],fixture=await probeServer(t,(req,res)=>{
  seen.push({host:req.headers.host,path:req.url});res.setHeader('Content-Type','application/json');
  if(req.headers.host!=='workspace.example.test'){res.writeHead(403);res.end('{"error":"host"}');return;}
  if(req.url==='/api/health'){res.end('{"ready":true}');return;}
  res.writeHead(401);res.end('{"error":"authentication"}');
 });
 const old=await fetch(`http://127.0.0.1:${fixture.port}/api/health`);assert.equal(old.status,403);await old.body.cancel();
 assert.deepEqual(await fixture.run(healthProbe),{ready:true});assert.deepEqual(await fixture.run(LOCAL_AUTH_PROBE_JS),{status:401});
 assert.deepEqual(seen.slice(1),[{host:'workspace.example.test',path:'/api/health'},{host:'workspace.example.test',path:'/pulse/api/project'}]);
});
test('local probes preserve unhealthy and missing-auth-boundary responses',async t=>{
 const fixture=await probeServer(t,(req,res)=>{res.writeHead(req.url==='/api/health'?503:200);res.end('{"ready":false}');});
 await assert.rejects(fixture.run(healthProbe));assert.deepEqual(await fixture.run(LOCAL_AUTH_PROBE_JS),{status:200});
});
test('invalid public origin stops both local probes without any request',async t=>{
 let requests=0;const fixture=await probeServer(t,(req,res)=>{requests++;res.end('{}');});
 for(const script of [healthProbe,LOCAL_AUTH_PROBE_JS])await assert.rejects(fixture.run(script,{SYNK_COMPANY_ORIGIN:'https://workspace.example.test/unapproved'}));
 assert.equal(requests,0);
});
function setup(){let now=1000000,generation='10',state=initialControlState(plan,now);const n=plan.nodes.standby;
 const config={schema:'synk-ha-node/v1',nodeId:n.instanceId,nodeName:n.name,zone:n.zone,planPath:'/etc/synk/ha/plan.json',helperPath:'/opt/synk/ha/node-host.py',activationAllowed:true,diskId:plan.data.diskId,diskName:plan.data.name,releaseSha256:plan.release.manifestSha256};
 const calls=[],receipts=new Map();const google={readState:async()=>({generation,value:structuredClone(state)}),diskOwnership:async()=>{calls.push('disk');return true;},readReceipt:async q=>receipts.get(q.generation),putReceipt:async(q,r)=>{calls.push('receipt');receipts.set(q.generation,r);}};
 const host=async a=>{calls.push(a);return {releaseSha256:config.releaseSha256,externalReplaySafe:true,guardsAccepted:true,durableHealthOk:true,startCompleted:true};};
 const make=()=>createNodeAgent({config,plan,google,host,now:()=>now,verifyNetwork:async()=>({authBoundaryOk:true,outboundOk:true}),verifyPublic:async()=>({publicHttpsReady:true})});
 function command(phase){const operationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';state.operation={version:1,operationId,from:plan.nodes.primary.instanceId,to:n.instanceId,diskId:config.diskId,releaseSha256:config.releaseSha256,phase,phaseStartedAt:now,generation:1,activeEpoch:2};state.bootAllowed=[];state.readyAllowed=[];state.command={schema:'synk-ha-command/v1',...state.operation,nonce:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',issuedAt:now};return state.command;}
 return {config,google,host,calls,make,command,receipts,get state(){return state;},set state(s){state=s;},advance(ms){now+=ms;},replace(){generation=String(Number(generation)+1);}};
}
test('wrong node, disk or helper contract is rejected before access',()=>{for(const change of [{nodeId:'999'},{diskId:'99'},{helperPath:'/tmp/untrusted.py'}]){const f=setup();assert.throws(()=>validateNodeConfig({...f.config,...change},plan));}});
test('observe-only agent reads release but never stops or starts any service',async()=>{const f=setup();f.config.activationAllowed=false;const a=f.make();await a.tick();assert.deepEqual(f.calls,['release']);assert.equal(a.status().alive,true);assert.equal(a.status().ready,false);});
test('standby cannot authorize boot with live primary owner',()=>{const f=setup();assert.throws(()=>bootAuthorized(f.state,f.config,plan),/WRITER_NOT_AUTHORIZED/);});
test('standby stops any retained containers and remains unready',async()=>{const f=setup(),a=f.make();await a.tick();assert.deepEqual(f.calls,['release','guards','stop']);assert.equal(a.status().ready,false);});
test('target requires START or later phase for writer authorization',()=>{const f=setup();f.command('ACCEPT_DATA');f.state.bootAllowed=[f.config.nodeId];assert.throws(()=>bootAuthorized(f.state,f.config,plan),/WRITER_PHASE/);});
test('fencing proof does not start or mount business data',async()=>{const f=setup();f.command('FENCE_OLD_WRITER');const a=f.make();await a.tick();assert.deepEqual(f.calls,['release','guards','stop','fence-proof','receipt']);assert.equal(f.receipts.get(1).externalReplaySafe,true);});
test('command cannot claim a different release or retain old boot permission',()=>{const f=setup();f.command('START_CANDIDATE');f.state.bootAllowed=[plan.nodes.primary.instanceId];assert.throws(()=>commandForNode(f.state,f.config,plan,1000000),/OLD_WRITER/);f.state.bootAllowed=[];f.state.command.releaseSha256='f'.repeat(64);assert.throws(()=>commandForNode(f.state,f.config,plan,1000000),/COMMAND_CONTRACT/);});
test('GCE attachment failure prevents mount, start and receipt',async()=>{const f=setup();f.command('ACCEPT_DATA');f.google.diskOwnership=async()=>{throw Error('not attached');};const a=f.make();await a.tick();assert.ok(!f.calls.includes('accept-data'));assert.ok(!f.calls.includes('start'));assert.equal(f.receipts.size,0);assert.equal(a.status().ready,false);});
test('START executes only with current boot permission and never exposes readiness',async()=>{const f=setup();f.command('START_CANDIDATE');f.state.bootAllowed=[f.config.nodeId];const a=f.make();await a.tick();assert.ok(f.calls.includes('start'));assert.equal(f.receipts.get(1).activeGeneration,2);assert.equal(a.status().ready,false);});
test('lease renewal during a host action does not invalidate an unchanged command',async()=>{const f=setup();f.command('FENCE_OLD_WRITER');let reads=0;const old=f.google.readState;f.google.readState=async()=>{if(++reads===2)f.replace();return old();};const a=f.make();await a.tick();assert.equal(f.receipts.size,1);assert.equal(a.status().reason,'STANDBY');});

test('replaced command during a host action suppresses success receipt',async()=>{const f=setup();f.command('FENCE_OLD_WRITER');let reads=0;const old=f.google.readState;f.google.readState=async()=>{if(++reads===2){f.replace();f.state.command.nonce='cccccccc-cccc-4ccc-8ccc-cccccccccccc';}return old();};const a=f.make();await a.tick();assert.equal(f.receipts.size,0);assert.equal(a.status().reason,'COMMAND_REPLACED');});

test('revoked writer permission during START suppresses success receipt and readiness',async()=>{const f=setup();f.command('START_CANDIDATE');f.state.bootAllowed=[f.config.nodeId];let reads=0;const old=f.google.readState;f.google.readState=async()=>{if(++reads===2){f.replace();f.state.bootAllowed=[];}return old();};const a=f.make();await a.tick();assert.ok(f.calls.includes('start'));assert.equal(f.receipts.size,0);assert.equal(a.status().reason,'COMMAND_REPLACED');assert.equal(a.status().ready,false);});
test('durable receipt is never resent and same-phase new generation is rechecked',async()=>{const f=setup();f.command('FENCE_OLD_WRITER');const a=f.make();await a.tick();await a.tick();assert.equal(f.calls.filter(x=>x==='fence-proof').length,1);f.state.command.generation=2;f.state.operation.generation=2;f.state.command.nonce='cccccccc-cccc-4ccc-8ccc-cccccccccccc';await a.tick();assert.equal(f.calls.filter(x=>x==='fence-proof').length,2);});
test('expired state evidence closes readiness without inventing outage',async()=>{const f=setup();f.state.activeId=f.config.nodeId;f.state.bootAllowed=[f.config.nodeId];f.state.readyAllowed=[f.config.nodeId];const a=f.make();await a.tick();assert.equal(a.status().ready,true);f.advance(15001);assert.equal(a.status().ready,false);assert.equal(a.status().alive,false);});

test('cloud state loss stops an enabled writer and reports stop failure separately',async()=>{
 const f=setup();f.state.activeId=f.config.nodeId;f.state.bootAllowed=[f.config.nodeId];f.state.readyAllowed=[f.config.nodeId];const a=f.make();await a.tick();assert.equal(a.status().ready,true);
 f.google.readState=async()=>{throw Object.assign(Error('state'),{code:'CONTROL_UNAVAILABLE'});};await a.tick();assert.equal(f.calls.at(-1),'stop');assert.equal(a.status().ready,false);assert.equal(a.status().reason,'CONTROL_UNAVAILABLE');
 const b=createNodeAgent({config:f.config,plan,google:f.google,host:async()=>{throw Error('stop failed');}});await b.tick();assert.equal(b.status().stopFailed,true);
});

test('cloud failure in observe-only mode never stops production services',async()=>{const f=setup();f.config.activationAllowed=false;f.google.readState=async()=>{throw Error('offline');};const a=f.make();await a.tick();assert.equal(f.calls.length,0);});

test('release verification cache expires after sixty seconds',async()=>{const f=setup(),a=f.make();await a.tick();f.advance(5000);await a.tick();assert.equal(f.calls.filter(x=>x==='release').length,1);f.advance(55000);await a.tick();assert.equal(f.calls.filter(x=>x==='release').length,2);});

test('pending public routing keeps authorized readiness for LB health probes',async()=>{
 const f=setup();f.command('EXPOSE_CANDIDATE');f.state.bootAllowed=[f.config.nodeId];f.state.readyAllowed=[f.config.nodeId];
 const a=createNodeAgent({config:f.config,plan,google:f.google,host:f.host,now:()=>1000000,verifyPublic:async()=>{throw Error('LB warming');}});
 await a.tick();assert.equal(a.status().ready,true);assert.equal(a.status().reason,'ROUTE_PENDING');assert.equal(f.receipts.size,0);assert.ok(!f.calls.includes('stop'));
});

test('authority lost while public route warms stops the writer',async()=>{
 const f=setup();f.command('EXPOSE_CANDIDATE');f.state.bootAllowed=[f.config.nodeId];f.state.readyAllowed=[f.config.nodeId];
 const a=createNodeAgent({config:f.config,plan,google:f.google,host:f.host,now:()=>1000000,verifyPublic:async()=>{f.state.bootAllowed=[];f.state.readyAllowed=[];throw Error('pending');}});
 await a.tick();assert.equal(a.status().ready,false);assert.equal(f.calls.at(-1),'stop');assert.equal(f.receipts.size,0);
});

test('shutdown fences enabled writer and prevents subsequent ticks',async()=>{const f=setup(),a=f.make();await a.shutdown();const count=f.calls.length;await a.tick();assert.equal(f.calls.at(-1),'stop');assert.equal(f.calls.length,count);assert.equal(a.status().ready,false);});
test('revoking old owner stops containers and removes readiness on next observation',async()=>{const f=setup();f.state.activeId=f.config.nodeId;f.state.bootAllowed=[f.config.nodeId];f.state.readyAllowed=[f.config.nodeId];const a=f.make();await a.tick();f.state.bootAllowed=[];f.state.readyAllowed=[];await a.tick();assert.equal(a.status().ready,false);assert.equal(f.calls.at(-1),'stop');});

function owned(f){f.state.activeId=f.config.nodeId;f.state.bootAllowed=[f.config.nodeId];f.state.readyAllowed=[f.config.nodeId];}
test('current owner recovers a stopped stack after a transient control failure',async()=>{
 const f=setup();owned(f);let online=true,running=true;const read=f.google.readState;
 f.google.readState=async()=>{if(!online)throw Error('offline');return read();};
 const host=async action=>{f.calls.push(action);if(action==='stop')running=false;if(action==='start')running=true;if(action==='health'&&!running)throw Error('stopped');return {guardsAccepted:true};};
 const a=createNodeAgent({config:f.config,plan,google:f.google,host,now:()=>1000000});
 await a.tick();online=false;await a.tick();assert.equal(running,false);online=true;await a.tick();
 assert.equal(running,true);assert.equal(a.status().ready,true);assert.equal(f.calls.filter(x=>x==='start').length,1);
});
test('owner recovery cannot restart after authority is revoked during stop',async()=>{
 const f=setup();owned(f);let starts=0;
 const host=async action=>{if(action==='health')throw Error('stopped');if(action==='stop'){f.state.bootAllowed=[];f.state.readyAllowed=[];}if(action==='start')starts++;return {guardsAccepted:true};};
 const a=createNodeAgent({config:f.config,plan,google:f.google,host,now:()=>1000000});await a.tick();
 assert.equal(starts,0);assert.equal(a.status().ready,false);assert.equal(a.status().reason,'COMMAND_REPLACED');
});
test('repeated owner start failures are rate limited and maintenance never restarts',async()=>{
 const f=setup();owned(f);let now=1000000,starts=0;
 const host=async action=>{if(action==='health')throw Error('stopped');if(action==='start'){starts++;throw Error('cannot start');}return {guardsAccepted:true};};
 const a=createNodeAgent({config:f.config,plan,google:f.google,host,now:()=>now});
 await a.tick();now+=5000;await a.tick();assert.equal(starts,1);now+=60000;await a.tick();assert.equal(starts,2);
 f.state.maintenanceUntil=now+120000;now+=60000;await a.tick();assert.equal(starts,2);
});
test('candidate health failure during promotion never invokes owner recovery',async()=>{
 const f=setup();f.command('EXPOSE_CANDIDATE');f.state.bootAllowed=[f.config.nodeId];f.state.readyAllowed=[f.config.nodeId];let starts=0;
 const host=async action=>{if(action==='health')throw Error('not healthy');if(action==='start')starts++;return {guardsAccepted:true};};
 const a=createNodeAgent({config:f.config,plan,google:f.google,host,now:()=>1000000,verifyPublic:async()=>({})});await a.tick();assert.equal(starts,0);assert.equal(a.status().ready,false);
});
test('shutdown joins a cancelled start before its final stop and emits no receipt',async()=>{
 const f=setup();f.command('START_CANDIDATE');f.state.bootAllowed=[f.config.nodeId];let begin,releaseStart;
 const started=new Promise(r=>begin=r),pending=new Promise(r=>releaseStart=r),actions=[];
 const host=async action=>{actions.push(action);if(action==='start'){begin();await pending;actions.push('start-finished');}return {guardsAccepted:true,startCompleted:true};};
 const a=createNodeAgent({config:f.config,plan,google:f.google,host,now:()=>1000000,cancelHost:async()=>{actions.push('cancel');releaseStart();}});
 const tick=a.tick();await started;const done=a.shutdown();assert.equal(a.status().ready,false);await Promise.all([tick,done]);
 assert.ok(actions.indexOf('stop')>actions.indexOf('start-finished'));assert.equal(actions.filter(x=>x==='stop').length,1);assert.equal(f.receipts.size,0);
});
test('cloud identity mismatch cannot read state or create a receipt',async()=>{const f=setup();let external=0;const g=createNodeGoogle(f.config,plan,{fetchImpl:async u=>{if(!u.startsWith('http://169.254.169.254/'))external++;return new Response(u.endsWith('project-id')?plan.project:'999',{headers:{'Metadata-Flavor':'Google'}});}});await assert.rejects(g.readState(),/CLOUD_NODE_IDENTITY/);assert.equal(external,0);});
test('receipt upload is confined to own immutable prefix with generation zero',async()=>{const f=setup(),calls=[];const g=createNodeGoogle(f.config,plan,{fetchImpl:async(u,o)=>{calls.push({u,o});if(u.endsWith('project-id'))return new Response(plan.project,{headers:{'Metadata-Flavor':'Google'}});if(u.endsWith('/instance/id'))return new Response(f.config.nodeId,{headers:{'Metadata-Flavor':'Google'}});if(u.endsWith('/token'))return new Response(JSON.stringify({access_token:'synthetic',token_type:'Bearer',expires_in:3600}),{headers:{'Metadata-Flavor':'Google'}});return new Response(JSON.stringify({generation:'123'}));}});const q=f.command('FENCE_OLD_WRITER');await g.putReceipt(q,{status:'DONE'});const url=new URL(calls.at(-1).u);assert.equal(url.searchParams.get('ifGenerationMatch'),'0');assert.equal(url.searchParams.get('name'),`${plan.runtime.receiptPrefix}${f.config.nodeId}/${q.operationId}/1.json`);});
