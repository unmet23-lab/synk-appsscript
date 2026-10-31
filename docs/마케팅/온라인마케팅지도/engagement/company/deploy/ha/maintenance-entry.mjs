// A deliberately narrow, same-release maintenance rehearsal. This module does
// not install a release, mutate node/plan/guard files, start apps, or arm HA.
import {createHash} from 'node:crypto';

export const digest=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const check=(v,c)=>{if(!v)throw Object.assign(new Error(c),{code:c});};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const protectedState=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['maintenanceUntil','updatedAt'].includes(k)).sort(([a],[b])=>a.localeCompare(b)));

export function validateContract(c,now=Date.now()){
  check(c?.schema==='synk-ha-maintenance-rehearsal/v1'&&c.action==='same-release-noop','CONTRACT_SCHEMA');
  check(/^[a-f0-9]{32}$/.test(c.id)&&c.project==='synk-bake-unmet27','CONTRACT_ID');
  check(c.ownerId==='6695198820229895670'&&Number.isSafeInteger(c.activeEpoch)&&c.activeEpoch>0,'OWNER_CONTRACT');
  check(c.createdAt<=now&&now<c.expiresAt&&c.expiresAt-c.createdAt<=600_000,'CONTRACT_EXPIRED');
  check(Number.isSafeInteger(c.maintenanceMs)&&c.maintenanceMs>=180_000&&c.maintenanceMs<=600_000,'MAINTENANCE_BOUND');
  check(c.expiresAt-now>=120_000,'CONTRACT_TIME_REMAINING');
  check(c.oldReleaseSha256===c.candidateReleaseSha256&&sha(c.oldReleaseSha256),'SAME_RELEASE_ONLY');
  check(sha(c.nodeConfigSha256)&&sha(c.planSha256)&&sha(c.controllerPlanSha256)&&sha(c.workerSha256)&&sha(c.entrySha256),'CONTRACT_HASHES');
  check(c.control?.bucket==='synk-company-ha-control-931078180935'&&c.control?.object==='company/ha-control/state.json','CONTROL_RESOURCE');
  check(/^\d+$/.test(c.control.generation)&&sha(c.control.sha256),'CONTROL_PIN');
  check(Array.isArray(c.guards)&&c.guards.length>=3&&c.guards.every(x=>typeof x.path==='string'&&sha(x.sha256)),'GUARD_PIN');
  check(Array.isArray(c.images)&&c.images.length===3&&c.images.every(x=>typeof x.name==='string'&&/^sha256:[a-f0-9]{64}$/.test(x.imageId)),'IMAGE_PIN');
  check(c.data?.diskId==='1729270376038801899'&&c.data?.filesystemUuid==='a84fb145-8e49-452c-8bf8-c254e2b6a74c','DATA_PIN');
  check(same(Object.keys(c.runtime).sort(),['controller.mjs','failover-policy.mjs','node-agent.mjs','node-host.py'])&&Object.values(c.runtime).every(sha),'RUNTIME_PIN');
  return c;
}

export function validateState(r,c,{maintenanceUntil=0,expectedRecord=null}={}){
  const s=r?.value;
  check(/^\d+$/.test(r?.generation)&&sha(r?.sha256),'STATE_RECORD');
  if(expectedRecord)check(r.generation===expectedRecord.generation&&r.sha256===expectedRecord.sha256,'STATE_GENERATION_CHANGED');
  check(s?.schema==='synk-ha-control/v1'&&s.project===c.project&&s.activeId===c.ownerId&&s.activeEpoch===c.activeEpoch,'OWNER_OR_EPOCH_CHANGED');
  check(!s.operation&&!s.command&&!s.api&&!s.runner,'OPERATION_IN_PROGRESS');
  check(same(s.bootAllowed,[c.ownerId])&&same(s.readyAllowed,[c.ownerId]),'OWNER_ONLY_REQUIRED');
  check(s.maintenanceUntil===maintenanceUntil,'MAINTENANCE_CHANGED');
  return r;
}

// Adapter operations are implemented by the operator-side wrapper. The owner
// worker obtains the real Linux flock and keeps it until finish() acknowledges
// cloud state. Every child must have a deadline and be joined by close().
export async function rehearse(c,a,{now=Date.now,signal}={}){
  validateContract(c,now());
  const report={schema:'synk-ha-maintenance-rehearsal-result/v1',id:c.id,scope:'same-release-noop',status:'preflight',armed:false,applicationCommands:0,newReleaseSupported:false};
  let worker=null,entered=null,original=null,enterTarget=null,left=null;
  const save=async()=>a.save({...report});
  const fresh=()=>{check(!signal?.aborted,'CANCELLED');check(now()<c.expiresAt,'CONTRACT_EXPIRED');};
  const controller=async()=>{const p=await a.controller();check(p.armed===false&&p.planSha256===c.controllerPlanSha256&&p.loadedPlanProven===true&&p.serviceActive===true,'LIVE_CONTROLLER_DISARM_REQUIRED');return p;};
  // Never retry a mutation after an ambiguous response. Its exact intended
  // bytes must be found under a new generation; otherwise leave a visible hold.
  const cas=async(before,value,phase)=>{
    const raw=JSON.stringify(value);report.intent={phase,generation:before.generation,sha256:digest(raw)};await save();
    try{await a.cas(before.generation,raw);}catch{} // read-back resolves unknown outcome
    const after=await a.read();check(after.generation!==before.generation&&after.sha256===digest(raw)&&same(after.value,value),'CAS_NOT_PROVEN');return after;
  };
  try{
    await save();worker=await a.openWorker(c);await worker.ready();fresh();
    report.controllerBefore=await controller();
    original=validateState(await a.read(),c,{expectedRecord:c.control});
    report.before=original;await worker.proof(original);fresh();
    enterTarget={...original.value,maintenanceUntil:Math.min(c.expiresAt,now()+c.maintenanceMs),updatedAt:now()};
    check(enterTarget.maintenanceUntil-now()>=120_000,'MAINTENANCE_TOO_SHORT');
    entered=await cas(original,enterTarget,'enter');report.entered=entered;report.status='maintenance-entered';await save();
    validateState(entered,c,{maintenanceUntil:enterTarget.maintenanceUntil});
    report.proof=await worker.proof(entered);fresh();await controller();
    report.https=await a.https();check(report.https?.ready===true&&report.https?.status===200&&report.https?.tlsVerified===true,'HTTPS_NOT_READY');
    const current=validateState(await a.read(),c,{maintenanceUntil:enterTarget.maintenanceUntil,expectedRecord:entered});
    check(same(protectedState(current.value),protectedState(original.value)),'PROTECTED_STATE_CHANGED');
    await worker.proof(current);fresh();await controller();
    left=await cas(current,{...current.value,maintenanceUntil:0,updatedAt:now()},'leave');
    validateState(left,c);check(same(protectedState(left.value),protectedState(original.value)),'PROTECTED_STATE_CHANGED');
    report.left=left;await worker.finish(left);report.status='same-release-rehearsal-passed';await save();return report;
  }catch(e){
    report.status='hold';report.code=e.code||'REHEARSAL_FAILED';
    // The workload never changed. A healthy, same-owner process may leave our
    // own exact maintenance state; no expired contract or changed CAS is used.
    // This recovery remains inside the same flock and never starts/stops apps.
    try{
      if(worker&&entered&&!left&&now()<c.expiresAt){
        await controller();const current=validateState(await a.read(),c,{maintenanceUntil:enterTarget.maintenanceUntil,expectedRecord:entered});
        await worker.proof(current);const h=await a.https();check(h?.ready&&h.status===200&&h.tlsVerified,'RECOVERY_HTTPS_NOT_READY');
        left=await cas(current,{...current.value,maintenanceUntil:0,updatedAt:now()},'recovery-leave');
        await worker.finish(left);report.recovery='same-owner-maintenance-left';report.left=left;
      }
    }catch(recovery){report.recovery='hold-until-bounded-maintenance-expiry';report.recoveryCode=recovery.code||'RECOVERY_FAILED';}
    // Enter CAS may have committed when the first readback failed. Keep the
    // exact intent in the journal; never assume the absent entered receipt
    // means no remote mutation and never silently issue another enter.
    if(!entered&&report.intent?.phase==='enter')report.recovery='enter-outcome-unknown-use-journal';
    await save();throw Object.assign(e,{report});
  }finally{
    if(worker){
      try{await worker.close();report.workerJoined=true;await save();}
      catch(error){report.status='hold';report.code=error.code||'WORKER_JOIN_UNPROVEN';report.workerJoined=false;await save();throw Object.assign(error,{report});}
    }
  }
}
