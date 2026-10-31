import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createController,initialControlState} from './controller.mjs';
import {REQUIRED_ACCEPTANCE} from './failover-policy.mjs';
const base=JSON.parse(readFileSync(new URL('./plan.json',import.meta.url)));
function fixture(mode,change){
 let clock=1_000_000,writes=0,permitReads=0;const plan=structuredClone(base),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';plan.armed=false;
 plan.runtime.operatorPermitObject='company/ha-control/operator-permits/'+id+'.json';
 let state=initialControlState(plan,clock);
 if(mode==='rearm-automatic-failover')state.operation={operationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',from:plan.nodes.standby.instanceId,to:plan.nodes.primary.instanceId,diskId:plan.data.diskId,releaseSha256:plan.release.manifestSha256,activeEpoch:1,phase:'COMPLETE',generation:7};
 const original=structuredClone(state),permit={schema:'synk-ha-operator-permit/v1',mode,requestId:id,from:state.activeId,to:plan.nodes.standby.instanceId,diskId:plan.data.diskId,releaseSha256:plan.release.manifestSha256,expectedStateGeneration:'1',expectedActiveEpoch:1,issuedAt:clock,expiresAt:clock+100};
 let generation='2',available=true;
 const adapter={readState:async()=>({generation:'1',value:structuredClone(state)}),readOperatorPermit:async()=>{permitReads++;return available?{generation,value:structuredClone(permit)}:null},getNode:async n=>({id:n.instanceId,status:'RUNNING'}),getDisk:async()=>({}),probe:async()=>({alive:true,body:{activationAllowed:true,guardsAccepted:true,releaseSha256:plan.release.manifestSha256}}),replicaHealth:async()=>{if(change==='expire')clock+=101;if(change==='generation')generation='3';if(change==='bytes')permit.qaSha256='a'.repeat(64);if(change==='remove')available=false;if(change==='clock')clock+=10;return {diskId:plan.data.diskId,healthy:true,replicas:[plan.nodes.primary.zone,plan.nodes.standby.zone].map(zone=>({zone,at:clock,states:{Synced:1}}))}},casState:async value=>{state=structuredClone(value);writes++;return {generation:'3',value:state}}};
 const controller=createController({plan,acceptance:Object.fromEntries(REQUIRED_ACCEPTANCE.map(k=>[k,true])),adapter,now:()=>clock,monotonic:()=>clock});
 return {tick:()=>controller.tick(),get state(){return state},get writes(){return writes},get permitReads(){return permitReads},original,get clock(){return clock}};
}
for(const mode of ['planned-handover-drill','rearm-automatic-failover']){
 for(const change of ['expire','generation','bytes','remove'])test(mode+' rejects '+change+' during probes before any state write',async()=>{
  const f=fixture(mode,change),r=await f.tick();assert.equal(r.code,change==='expire'?'OPERATOR_PERMIT_EXPIRED':'OPERATOR_PERMIT_CHANGED');assert.equal(f.writes,0);assert.deepEqual(f.state,f.original);assert.equal(f.permitReads,2);
 });
 test(mode+' binds acceptance to final valid observation time',async()=>{const f=fixture(mode,'clock'),r=await f.tick();assert.equal(r.code,mode==='planned-handover-drill'?'OPERATOR_HANDOVER_PERSISTED':'REARM_PREPARED_STILL_DISARMED');assert.equal(f.writes,1);const a=mode==='planned-handover-drill'?f.state.operation.operatorAuthorization:f.state.lastRearm;assert.equal(a.acceptedAt,f.clock);});
}
