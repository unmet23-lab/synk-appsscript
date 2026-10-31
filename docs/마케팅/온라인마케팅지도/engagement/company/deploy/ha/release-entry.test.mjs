import {test} from 'node:test';
import assert from 'node:assert/strict';
import {digest} from './maintenance-entry.mjs';
import {deployReviewedRelease,validateDeployment} from './release-entry.mjs';
function fixture(){
 let now=1000000,gen=1,release='a'.repeat(64),data='current regional user data';const events=[],journal=[];
 const ownerId='6695198820229895670',standbyId='8318146427425792493';
 const value={schema:'synk-ha-control/v1',project:'synk-bake-unmet27',activeId:ownerId,activeEpoch:1,maintenanceUntil:0,bootAllowed:[ownerId],readyAllowed:[ownerId],operation:null,command:null,api:null,runner:null};
 let record={generation:'1',sha256:digest(value),value};
 const c={schema:'synk-ha-release-entry/v1',id:'c'.repeat(32),project:value.project,ownerId,standbyId,activeEpoch:1,oldReleaseSha256:release,newReleaseSha256:'b'.repeat(64),dataDiskId:'1729270376038801899',dataRestoreAllowed:false,automaticRearm:false,schemaChangesAllowed:false,createdAt:now-1000,expiresAt:now+1700000,candidateReceiptSha256:'d'.repeat(64),primaryCapsuleSha256:'e'.repeat(64),standbyCapsuleSha256:'f'.repeat(64),controllerCapsuleSha256:'1'.repeat(64),control:{generation:'1',sha256:record.sha256}};
 const workers={};const locks={primary:false,standby:false},stops={primary:false,standby:false};
 for(const role of ['primary','standby'])workers[role]={
  stageProof:async()=>({oldReleaseSha256:c.oldReleaseSha256,newReleaseSha256:c.newReleaseSha256,candidateReceiptSha256:c.candidateReceiptSha256,imagesAccepted:true,guardsAccepted:true,exclusiveLockHeld:locks[role]}),
  stop:async()=>{assert.equal(record.value.maintenanceUntil,c.expiresAt);assert.deepEqual(record.value.bootAllowed,[]);assert.equal(locks[role],true);stops[role]=true;events.push(role+':stop');},
  stopped:async()=>({writersStopped:stops[role],agentStopped:stops[role],timersStopped:stops[role],exclusiveLockHeld:locks[role],soleDiskOwner:ownerId}),
  captureCurrentRegionalData:async()=>({writerStopped:true,originalKeysAndSessionsAccepted:true,logicalReceiptSha256:digest(data),sameRegionalDisk:true}),
  apply:async()=>{assert.equal(locks[role],true);events.push(role+':apply');return {phase:'software-switched-writers-stopped',dataWrites:0,applicationStarts:0};},
  acceptedSoftware:async()=>({newReleaseSha256:c.newReleaseSha256}),
  compareCurrentRegionalData:async(_,p)=>({exactPreStartPreservation:p.logicalReceiptSha256===digest(data)}),
  release:async()=>{events.push(role+':unlock');locks[role]=false;return {childrenJoined:true,lockReleased:true};},
  rollbackSoftware:async()=>{assert.equal(locks[role],true);events.push(role+':rollback-software');},
  close:async()=>{events.push(role+':join');locks[role]=false;},
 };
 const a={
  save:async r=>journal.push(structuredClone(r)),openHostLeases:async()=>{locks.primary=true;locks.standby=true;return workers;},
  controller:{proof:async()=>({disarmed:true,loadedPlanProven:true,releaseSha256:release}),commitDisarmed:async()=>{release=c.newReleaseSha256;events.push('controller:commit-disarmed');return {disarmed:true,acceptanceInvalidated:true,releaseSha256:release};},rollbackDisarmed:async()=>{release=c.oldReleaseSha256;events.push('controller:rollback-disarmed');}},
  control:{read:async()=>structuredClone(record),cas:async(generation,raw)=>{assert.equal(generation,record.generation);record={generation:String(++gen),sha256:digest(raw),value:JSON.parse(raw)};events.push('cas:'+record.value.bootAllowed.length+':'+record.value.readyAllowed.length+':'+(record.value.maintenanceUntil>0));}},
  startAgentsAndProveStandby:async()=>{assert.equal(locks.primary,false);assert.equal(locks.standby,false);assert.deepEqual(record.value.bootAllowed,[ownerId]);assert.deepEqual(record.value.readyAllowed,[]);assert.ok(record.value.maintenanceUntil>now);events.push('guarded-start');return {nodeId:standbyId,ready:false,containersRunning:0};},
  proveOwnerStartup:async()=>({nodeId:ownerId,internalTlsHealthy:true,originalKeysPreserved:true,dataAccepted:true,sameRegionalDisk:true,sourceAndGuardsAccepted:true}),
  publicProof:async()=>{assert.deepEqual(record.value.readyAllowed,[ownerId]);return {ready:true,tlsVerified:true,sourceVerified:true};},
 };
 return {a,c,workers,events,journal,now:()=>now,advance:x=>now+=x,data:()=>data,setData:x=>data=x,record:()=>record};
}
test('new release commits both hosts and disarmed controller before owner startup',async()=>{const f=fixture();const r=await deployReviewedRelease(f.c,f.a,{now:f.now});assert.equal(r.status,'new-release-online-disarmed');assert.equal(r.hostChildrenJoined,true);assert.equal(r.armed,false);assert.equal(f.data(),'current regional user data');assert.ok(f.events.indexOf('standby:apply')<f.events.indexOf('primary:apply'));assert.ok(f.events.indexOf('controller:commit-disarmed')<f.events.indexOf('primary:unlock'));assert.ok(f.events.indexOf('primary:unlock')<f.events.indexOf('guarded-start'));assert.equal(f.record().value.maintenanceUntil,0);});
test('fails before cloud entry if either host lacks accepted candidate',async()=>{const f=fixture();f.workers.standby.stageProof=async()=>({});await assert.rejects(deployReviewedRelease(f.c,f.a,{now:f.now}),{code:'BOTH_HOSTS_CANDIDATE_REQUIRED'});assert.equal(f.events.some(x=>x.startsWith('cas:')),false);});
test('partial software failure restores software on same current regional data',async()=>{const f=fixture();f.workers.primary.apply=async()=>{throw Error('disk read error');};await assert.rejects(deployReviewedRelease(f.c,f.a,{now:f.now}));assert.equal(f.journal.at(-1).recovery,'old-software-online-current-regional-data');assert.ok(f.events.includes('standby:rollback-software'));assert.equal(f.data(),'current regional user data');assert.equal(f.record().value.maintenanceUntil,0);});
test('uncertain owner start never restores software or data automatically',async()=>{const f=fixture();f.a.startAgentsAndProveStandby=async()=>{throw Error('unknown start');};await assert.rejects(deployReviewedRelease(f.c,f.a,{now:f.now}));assert.equal(f.journal.at(-1).recovery,'hold-after-start-never-restore-old-data');assert.equal(f.events.some(x=>x.includes('rollback')),false);assert.ok(f.record().value.maintenanceUntil>f.now());});
test('data drift before startup prevents new app exposure',async()=>{const f=fixture();f.workers.primary.compareCurrentRegionalData=async()=>({exactPreStartPreservation:false});await assert.rejects(deployReviewedRelease(f.c,f.a,{now:f.now}),{code:'DATA_CHANGED_BEFORE_START'});assert.ok(f.events.includes('controller:rollback-disarmed'));assert.equal(f.journal.at(-1).recovery,'old-software-online-current-regional-data');});
test('failed public proof keeps maintenance and current regional data',async()=>{const f=fixture();f.a.publicProof=async()=>({ready:false});await assert.rejects(deployReviewedRelease(f.c,f.a,{now:f.now}),{code:'PUBLIC_PROOF_REQUIRED'});assert.ok(f.record().value.maintenanceUntil>0);assert.equal(f.events.some(x=>x.includes('rollback')),false);});
test('ambiguous accepted CAS is reconciled without duplicate mutation',async()=>{const f=fixture(),old=f.a.control.cas;let n=0;f.a.control.cas=async(...args)=>{n++;await old(...args);throw Error('transport lost');};await deployReviewedRelease(f.c,f.a,{now:f.now});assert.equal(n,4);});
test('unproven CAS keeps workers stopped and does not advance deployment',async()=>{const f=fixture();f.a.control.cas=async()=>{};await assert.rejects(deployReviewedRelease(f.c,f.a,{now:f.now}),{code:'CAS_UNKNOWN_HOLD'});assert.equal(f.events.some(x=>x.includes(':apply')),false);assert.equal(f.events.includes('guarded-start'),false);});
test('expired transaction refuses apply and does not use expired recovery',async()=>{const f=fixture(),old=f.workers.primary.captureCurrentRegionalData;f.workers.primary.captureCurrentRegionalData=async(...args)=>{const p=await old(...args);f.advance(1800000);return p;};await assert.rejects(deployReviewedRelease(f.c,f.a,{now:f.now}),{code:'DEPLOYMENT_EXPIRED'});assert.equal(f.events.some(x=>x.includes(':apply')),false);});
test('host cleanup uncertainty cannot leave a passed receipt',async()=>{const f=fixture();f.workers.primary.close=async()=>{throw Error('join unknown');};await assert.rejects(deployReviewedRelease(f.c,f.a,{now:f.now}),{code:'HOST_CHILD_JOIN_UNPROVEN'});assert.equal(f.journal.at(-1).status,'hold');assert.equal(f.journal.at(-1).hostChildrenJoined,false);});
test('disallows data restore, automatic rearm, schema change and arbitrary target',()=>{for(const [k,v] of [['dataRestoreAllowed',true],['automaticRearm',true],['schemaChangesAllowed',true],['ownerId','other']]){const f=fixture();f.c[k]=v;assert.throws(()=>validateDeployment(f.c,f.now()));}});
