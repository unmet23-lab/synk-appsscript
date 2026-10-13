import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialControlState} from './controller.mjs';
import {createNodeAgent,healthRecord,validateHealthRecord} from './node-agent.mjs';
const plan=JSON.parse(readFileSync(new URL('./plan.json',import.meta.url)));
function fixture(owner=true){
 let now=1000000,online=true,failStop=true,afterStop=()=>{};const n=owner?plan.nodes.primary:plan.nodes.standby,state=initialControlState(plan,now),calls=[];
 const c={schema:'synk-ha-node/v1',nodeId:n.instanceId,nodeName:n.name,zone:n.zone,planPath:'/etc/synk/ha/plan.json',helperPath:'/opt/synk/ha/node-host.py',activationAllowed:true,diskId:plan.data.diskId,diskName:plan.data.name,releaseSha256:plan.release.manifestSha256};
 const google={readState:async()=>{if(!online)throw Error('offline');return {generation:'1',value:structuredClone(state)}},diskOwnership:async()=>true};
 const host=async action=>{calls.push(action);if(action==='stop'){if(failStop)throw Error('failed stop');afterStop()}return {guardsAccepted:true}};
 const agent=createNodeAgent({config:c,plan,google,host,now:()=>now});
 return {agent,c,calls,state,get now(){return now},setOnline(v){online=v},setStopFailure(v){failStop=v},setAfterStop(v){afterStop=v},advance(){now+=5000}};
}
test('owner requires confirmed stop and authority recheck before clearing a prior stop failure',async()=>{
 const f=fixture();await f.agent.tick();f.setOnline(false);f.advance();await f.agent.tick();assert.equal(f.agent.status().stopFailed,true);
 f.setOnline(true);f.setStopFailure(false);f.advance();const before=f.calls.length;await f.agent.tick();const recovery=f.calls.slice(before);
 assert.ok(recovery.indexOf('stop')>=0&&recovery.indexOf('start')>recovery.indexOf('stop'));assert.equal(f.agent.status().stopFailed,false);assert.equal(f.agent.status().ready,true);
 assert.doesNotThrow(()=>validateHealthRecord(healthRecord(f.agent.status()),f.c,f.now));
});
test('failed recovery stop never reports ready or starts despite healthy retained application',async()=>{
 const f=fixture();await f.agent.tick();f.setOnline(false);f.advance();await f.agent.tick();f.setOnline(true);f.advance();const before=f.calls.length;await f.agent.tick();
 assert.equal(f.agent.status().ready,false);assert.equal(f.agent.status().stopFailed,true);assert.ok(!f.calls.slice(before).includes('start'));
 assert.doesNotThrow(()=>validateHealthRecord(healthRecord(f.agent.status()),f.c,f.now));
});
test('standby clears old stop-failure only after next actual stop succeeds and never becomes ready',async()=>{
 const f=fixture(false);await f.agent.tick();assert.equal(f.agent.status().stopFailed,true);f.setStopFailure(false);f.advance();await f.agent.tick();
 assert.equal(f.agent.status().stopFailed,false);assert.equal(f.agent.status().ready,false);assert.equal(f.calls.at(-1),'stop');assert.ok(!f.calls.includes('start'));
});
test('revoked permission during confirmed recovery stop prevents a restart',async()=>{
 const f=fixture();await f.agent.tick();f.setOnline(false);f.advance();await f.agent.tick();f.setOnline(true);f.setStopFailure(false);f.setAfterStop(()=>{f.state.bootAllowed=[];f.state.readyAllowed=[]});f.advance();await f.agent.tick();
 assert.equal(f.agent.status().ready,false);assert.ok(!f.calls.includes('start'));assert.equal(f.agent.status().reason,'COMMAND_REPLACED');
});

function promotionFixture(phase,prior=false,failedStop=true){
 const f=fixture(false),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',n=f.c.nodeId;let now=1000000,readFailure=true,stopFailure=failedStop,running=true,afterStop=()=>{},afterStart=()=>{};const receipts=[],actions=[];
 f.state.operation={operationId:id,from:plan.nodes.primary.instanceId,to:n,diskId:f.c.diskId,releaseSha256:f.c.releaseSha256,activeEpoch:2,phase,phaseStartedAt:now,generation:1};
 f.state.command={...f.state.operation,nonce:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',issuedAt:now};f.state.bootAllowed=[n];f.state.readyAllowed=phase==='EXPOSE_CANDIDATE'?[n]:[];
 const google={readState:async()=>({generation:'1',value:structuredClone(f.state)}),diskOwnership:async()=>true,readReceipt:async()=>{if(readFailure)throw Error('transient receipt read');return prior?{value:{status:'DONE'}}:null},putReceipt:async(q,e)=>receipts.push(e)};
 const host=async action=>{actions.push(action);if(action==='stop'){if(stopFailure)throw Error('failed stop');running=false;await afterStop()}if(action==='start'){running=true;await afterStart()}if(action==='health'&&!running)throw Error('stopped');return {guardsAccepted:true,startCompleted:true,durableHealthOk:true}};
 let agent;agent=createNodeAgent({config:f.c,plan,google,host,now:()=>now,verifyNetwork:async()=>({authBoundaryOk:true,outboundOk:true}),verifyPublic:async()=>{if(!agent.status().ready)throw Error('route unready');return {publicHttpsReady:true}}});
 return {agent,c:f.c,state:f.state,receipts,actions,async failThenRecover(){await agent.tick();readFailure=false;stopFailure=false;now+=5000;},setAfterStop(fn){afterStop=fn},setAfterStart(fn){afterStart=fn},get now(){return now},get running(){return running}};
}
for(const phase of ['START_CANDIDATE','VERIFY_CANDIDATE','EXPOSE_CANDIDATE'])for(const prior of [false,true])test(phase+' recovers its own earlier failed stop with prior receipt='+prior,async()=>{
 const f=promotionFixture(phase,prior);await f.failThenRecover();assert.equal(f.agent.status().stopFailed,true);const before=f.actions.length;await f.agent.tick();const recovery=f.actions.slice(before);
 assert.equal(f.agent.status().stopFailed,false);assert.equal(f.running,true);assert.equal(recovery.filter(x=>x==='start').length,1);assert.ok(recovery.indexOf('stop')<recovery.indexOf('start'));assert.equal(f.agent.status().ready,phase==='EXPOSE_CANDIDATE');assert.equal(f.receipts.length,prior?0:1);assert.doesNotThrow(()=>validateHealthRecord(healthRecord(f.agent.status()),f.c,f.now));
});
test('VERIFY recovers even when its earlier fail-closed stop succeeded',async()=>{
 const f=promotionFixture('VERIFY_CANDIDATE',true,false);await f.failThenRecover();assert.equal(f.running,false);assert.equal(f.agent.status().stopFailed,false);await f.agent.tick();assert.equal(f.running,true);assert.equal(f.actions.filter(x=>x==='start').length,1);
});
test('promotion maintenance prevents recovery start',async()=>{
 const f=promotionFixture('START_CANDIDATE');await f.failThenRecover();f.state.maintenanceUntil=f.now+60000;await f.agent.tick();assert.ok(!f.actions.includes('start'));assert.equal(f.agent.status().ready,false);assert.equal(f.receipts.length,0);
});
test('promotion replacement during confirmed stop cannot restart from old command',async()=>{
 const f=promotionFixture('VERIFY_CANDIDATE');await f.failThenRecover();f.setAfterStop(()=>{f.state.command.nonce='cccccccc-cccc-4ccc-8ccc-cccccccccccc'});await f.agent.tick();assert.ok(!f.actions.includes('start'));assert.equal(f.agent.status().reason,'COMMAND_REPLACED');assert.equal(f.receipts.length,0);
});
test('promotion authority revoked during recovery start emits no receipt and stops again',async()=>{
 const f=promotionFixture('EXPOSE_CANDIDATE');await f.failThenRecover();f.setAfterStart(()=>{f.state.bootAllowed=[];f.state.readyAllowed=[]});await f.agent.tick();assert.equal(f.agent.status().ready,false);assert.equal(f.running,false);assert.equal(f.receipts.length,0);
});
test('shutdown while recovery stop is pending cannot start a promotion',async()=>{
 const f=promotionFixture('START_CANDIDATE');await f.failThenRecover();let started,release;const gate=new Promise(r=>release=r),waiting=new Promise(r=>started=r);f.setAfterStop(async()=>{started();await gate});const tick=f.agent.tick();await waiting;const done=f.agent.shutdown();release();await Promise.all([tick,done]);assert.ok(!f.actions.includes('start'));assert.equal(f.agent.status().ready,false);assert.equal(f.receipts.length,0);
});
