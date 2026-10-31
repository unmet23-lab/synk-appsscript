// Typed coordinator for a reviewed company release on the current regional
// disk. Host adapters are explicit; no arbitrary shell command or data restore.
// Not a CLI: the live adapter and exact candidate require their own acceptance.
import {digest} from './maintenance-entry.mjs';
const check=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const PRIMARY='6695198820229895670',STANDBY='8318146427425792493';
export function validateDeployment(c,now){
  check(c?.schema==='synk-ha-release-entry/v1'&&/^[a-f0-9]{32}$/.test(c.id),'DEPLOYMENT_CONTRACT');
  check(c.project==='synk-bake-unmet27'&&c.ownerId===PRIMARY&&c.standbyId===STANDBY&&Number.isSafeInteger(c.activeEpoch)&&c.activeEpoch>0,'PINNED_NODES');
  check(hash(c.oldReleaseSha256)&&hash(c.newReleaseSha256)&&c.oldReleaseSha256!==c.newReleaseSha256,'NEW_RELEASE_REQUIRED');
  check(c.dataDiskId==='1729270376038801899'&&c.dataRestoreAllowed===false&&c.automaticRearm===false,'PRESERVATION_REQUIRED');
  check(Number.isSafeInteger(c.createdAt)&&Number.isSafeInteger(c.expiresAt)&&c.createdAt<=now&&c.expiresAt-now>=300000&&c.expiresAt-c.createdAt<=1800000,'BOUNDED_DEPLOYMENT');
  check(/^\d+$/.test(c.control?.generation)&&hash(c.control?.sha256),'INITIAL_CONTROL_PIN');
  check(c.schemaChangesAllowed===false&&hash(c.candidateReceiptSha256)&&hash(c.primaryCapsuleSha256)&&hash(c.standbyCapsuleSha256)&&hash(c.controllerCapsuleSha256),'REVIEWED_CAPSULES');
}
function state(record,c,{boot,ready,maintenance,expected}){
  check(/^\d+$/.test(record?.generation)&&hash(record?.sha256),'CONTROL_RECORD');
  if(expected)check(record.generation===expected.generation&&record.sha256===expected.sha256,'CONTROL_DRIFT');
  const s=record.value;check(s?.schema==='synk-ha-control/v1'&&s.project===c.project&&s.activeId===c.ownerId&&s.activeEpoch===c.activeEpoch,'OWNER_EPOCH_CHANGED');
  check(!s.operation&&!s.command&&!s.api&&!s.runner,'ACTIVE_OPERATION');
  check(same(s.bootAllowed,boot)&&same(s.readyAllowed,ready)&&s.maintenanceUntil===maintenance,'MAINTENANCE_PERMISSIONS');return record;
}
export async function deployReviewedRelease(c,a,{now=Date.now,signal}={}){
  validateDeployment(c,now());
  const r={schema:'synk-ha-release-entry-result/v1',id:c.id,status:'preflight',oldReleaseSha256:c.oldReleaseSha256,newReleaseSha256:c.newReleaseSha256,armed:false,dataRestoreCommands:0};
  let workers,control,original,expiry=0,entered=false,switched=false,startDispatched=false,controllerSwitched=false,locksHeld=false;
  const save=()=>a.save(structuredClone(r));
  const fresh=()=>{check(!signal?.aborted,'CANCELLED');check(now()<c.expiresAt,'DEPLOYMENT_EXPIRED');};
  const controller=async release=>{const v=await a.controller.proof();check(v.disarmed===true&&v.loadedPlanProven===true&&v.releaseSha256===release,'CONTROLLER_CONTRACT');return v;};
  async function cas(fields,phase){
    fresh();const current=await a.control.read();check(current.generation===control.generation&&current.sha256===control.sha256,'CONTROL_DRIFT');
    const value={...current.value,...fields,updatedAt:now()},raw=JSON.stringify(value);r.intent={phase,generation:current.generation,sha256:digest(raw)};await save();
    try{await a.control.cas(current.generation,raw);}catch{}
    const after=await a.control.read();check(after.generation!==current.generation&&after.sha256===digest(raw)&&same(after.value,value),'CAS_UNKNOWN_HOLD');control=after;r.control=after;await save();return after;
  }
  async function stoppedProof(){
    fresh();state(await a.control.read(),c,{boot:[],ready:[],maintenance:expiry,expected:control});
    await controller(controllerSwitched?c.newReleaseSha256:c.oldReleaseSha256);
    for(const role of ['primary','standby']){const p=await workers[role].stopped(control);check(p.writersStopped&&p.agentStopped&&p.timersStopped&&p.exclusiveLockHeld&&p.soleDiskOwner===c.ownerId,'STOPPED_PROOF_REQUIRED');}
  }
  async function releaseLocks(){
    check(locksHeld,'LEASE_NOT_HELD');await stoppedProof();
    for(const role of ['standby','primary']){const p=await workers[role].release(control);check(p.childrenJoined&&p.lockReleased,'LEASE_RELEASE_UNPROVEN');}
    locksHeld=false;r.localLocksReleasedForGuardedStart=true;await save();
  }
  async function startAccepted(release){
    await controller(release);await cas({bootAllowed:[c.ownerId],readyAllowed:[]},'authorize-current-owner');
    // Existing start wrappers take shared flock. Start only after both exclusive
    // leases are released. GCS CAS maintenance + disarmed controller continue to
    // serialize the whole lifecycle, including startup and failure handling.
    startDispatched=true;r.status='owner-start-dispatched';await save();
    const standby=await a.startAgentsAndProveStandby(control,release);check(standby.ready===false&&standby.containersRunning===0&&standby.nodeId===c.standbyId,'STANDBY_NONOWNER_NOT_PROVEN');
    const owner=await a.proveOwnerStartup(control,release);check(owner.nodeId===c.ownerId&&owner.internalTlsHealthy&&owner.originalKeysPreserved&&owner.dataAccepted&&owner.sameRegionalDisk&&owner.sourceAndGuardsAccepted,'OWNER_STARTUP_NOT_ACCEPTED');
    r.ownerStartup=owner;await cas({readyAllowed:[c.ownerId]},'expose-accepted-owner');
    const publicProof=await a.publicProof(release);check(publicProof.ready&&publicProof.tlsVerified&&publicProof.sourceVerified,'PUBLIC_PROOF_REQUIRED');
    await controller(release);await cas({maintenanceUntil:0},'leave-maintenance');r.publicProof=publicProof;
  }
  try{
    await save();workers=await a.openHostLeases(c);locksHeld=true;
    await controller(c.oldReleaseSha256);control=await a.control.read();
    original=state(control,c,{boot:[c.ownerId],ready:[c.ownerId],maintenance:0,expected:c.control});
    for(const role of ['standby','primary']){const p=await workers[role].stageProof();check(p.oldReleaseSha256===c.oldReleaseSha256&&p.newReleaseSha256===c.newReleaseSha256&&p.candidateReceiptSha256===c.candidateReceiptSha256&&p.imagesAccepted&&p.guardsAccepted&&p.exclusiveLockHeld,'BOTH_HOSTS_CANDIDATE_REQUIRED');}
    fresh();expiry=c.expiresAt;await cas({maintenanceUntil:expiry,bootAllowed:[],readyAllowed:[]},'enter-deployment');entered=true;
    for(const role of ['standby','primary'])await workers[role].stop(control);
    await stoppedProof();r.preserved=await workers.primary.captureCurrentRegionalData(control);check(r.preserved.writerStopped&&r.preserved.originalKeysAndSessionsAccepted&&r.preserved.logicalReceiptSha256&&r.preserved.sameRegionalDisk,'WRITER_STOPPED_DATA_PROOF');
    r.status='writer-stopped-data-accepted';await save();
    // Switch standby first, then owner, then disarmed controller. A failure at
    // any boundary leaves boot/ready empty; no mixed contract can start an app.
    for(const role of ['standby','primary']){
      await stoppedProof();switched=true;const p=await workers[role].apply(control);check(p.phase==='software-switched-writers-stopped'&&p.dataWrites===0&&p.applicationStarts===0,'SOFTWARE_SWITCH_NOT_PROVEN');r[role]=p;await save();
    }
    const cp=await a.controller.commitDisarmed(c,control);check(cp.disarmed&&cp.acceptanceInvalidated&&cp.releaseSha256===c.newReleaseSha256,'CONTROLLER_COMMIT_NOT_PROVEN');controllerSwitched=true;
    await controller(c.newReleaseSha256);await stoppedProof();
    for(const role of ['primary','standby'])check((await workers[role].acceptedSoftware(control)).newReleaseSha256===c.newReleaseSha256,'HOST_SOFTWARE_NOT_ACCEPTED');
    check((await workers.primary.compareCurrentRegionalData(control,r.preserved)).exactPreStartPreservation===true,'DATA_CHANGED_BEFORE_START');
    await releaseLocks();await startAccepted(c.newReleaseSha256);r.status='new-release-online-disarmed';r.acceptanceMustBeRenewed=true;await save();return r;
  }catch(error){
    r.status='hold';r.code=error.code||'DEPLOYMENT_FAILED';r.startDispatched=startDispatched;await save();
    // Automatic software recovery is restricted to the no-new-writes phase.
    // After any start dispatch (including timeout), preserve current regional
    // data and require fresh stopped compatibility proof before recovery.
    if(entered&&!startDispatched&&locksHeld&&now()<c.expiresAt&&!signal?.aborted){
      try{
        for(const role of ['standby','primary'])await workers[role].stop(control);
        await stoppedProof();if(switched)for(const role of ['primary','standby'])await workers[role].rollbackSoftware(control);
        if(controllerSwitched){await a.controller.rollbackDisarmed(c,control);controllerSwitched=false;}
        await controller(c.oldReleaseSha256);r.recovery='old-software-current-regional-data';await releaseLocks();await startAccepted(c.oldReleaseSha256);r.recovery='old-software-online-current-regional-data';await save();
      }catch(recovery){r.recovery='hold-current-regional-data';r.recoveryCode=recovery.code||'RECOVERY_FAILED';await save();}
    }else r.recovery=startDispatched?'hold-after-start-never-restore-old-data':'hold-before-start';
    await save();throw Object.assign(error,{report:r});
  }finally{
    if(workers){
      const joined=await Promise.allSettled(['standby','primary'].map(role=>workers[role].close()));
      r.hostChildrenJoined=joined.every(x=>x.status==='fulfilled');
      if(!r.hostChildrenJoined){r.status='hold';r.code='HOST_CHILD_JOIN_UNPROVEN';await save();throw Object.assign(Error(r.code),{code:r.code,report:r});}
      await save();
    }
  }
}
