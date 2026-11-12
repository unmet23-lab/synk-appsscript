'use strict';
// Windows integration check; invoked explicitly with the pinned restic input.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createApplication}=require('../worker/handlers.cjs');
test('startup read failure preserves the confirmed value and reports failure without stopping the worker',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'swb-startup-read-'));
  let fail=false,reads=0;
  assert.ok(process.env.SOLO_BACKUP_RESTIC,'SOLO_BACKUP_RESTIC must point to the pinned Windows restic binary');
  const app=await createApplication({root,resticPath:process.env.SOLO_BACKUP_RESTIC,publish:()=>{},testMode:true,host:async method=>{
    // The window also takes the engine lock and reads a run's progress (STAGE1_DESIGN.md 4.1).
    if(method==='engine.lock'||method==='engine.unlock')return true;
    if(method==='run.progress')return null;
    assert.equal(method,'startup.read');reads++;await new Promise(r=>setTimeout(r,10));if(fail)throw Error('HOST_BUSY');return true;
  }});
  try{
    assert.equal(app.state().launchAtLogin,true);fail=true;
    const responses=await Promise.all(Array.from({length:24},()=>app.call('getState',[])));
    assert.equal(reads,2);assert.ok(responses.every(r=>r.ok===false&&r.code==='STARTUP_READ_FAILED'));
    assert.equal(app.state().launchAtLogin,true);fail=false;
    assert.equal((await app.call('getState',[])).ok,true);
  }finally{await app.stop();}
});
