import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t,background='1'){
  const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED'];
  const previous=keys.map(key=>process.env[key]);
  process.env[keys[0]]=background;process.env[keys[1]]='1';
  const directory=await mkdtemp(join(tmpdir(),'synk-run-retention-'));
  let at='2026-11-16T00:00:00.000Z';
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>at,
    synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,aiMarketEnabled:false});
  t.after(async()=>{
    await app.stop();
    for(let i=0;i<keys.length;i++)if(previous[i]===undefined)delete process.env[keys[i]];else process.env[keys[i]]=previous[i];
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-run-retention-'));
    await rm(directory,{recursive:true,force:true});
  });
  return {app,at:next=>{at=next;},put:(id,startedAt,status='success')=>app.store.put('runs',id,{id,startedAt,status})};
}

test('scheduled maintenance deletes only old terminal runs with canonical real calendar dates',async t=>{
  const f=await fixture(t);
  f.put('old','2026-10-01T00:00:00.000Z');f.put('old-error','2026-10-01T00:00:00.000Z','error');
  f.put('cutoff','2026-11-02T00:00:00.000Z');f.put('recent','2026-11-15T00:00:00.000Z');
  f.put('queued','2026-10-01T00:00:00.000Z','queued');f.put('running','2026-10-01T00:00:00.000Z','running');
  for(const [id,value] of Object.entries({missingMs:'2026-10-01T00:00:00Z',offset:'2026-10-01T09:00:00.000+09:00',badLeap:'2026-02-29T00:00:00.000Z',badDay:'2026-04-31T00:00:00.000Z',hour24:'2026-10-01T24:00:00.000Z',numeric:1,empty:'',missing:undefined}))f.put(id,value);
  f.app.store.put('runs','no-status',{id:'no-status',startedAt:'2026-10-01T00:00:00.000Z'});
  f.put('unknown-status','2026-10-01T00:00:00.000Z','unknown');f.put('null-status','2026-10-01T00:00:00.000Z',null);
  await f.app.scheduledTick();
  assert.equal(f.app.store.get('runs','old'),null);assert.equal(f.app.store.get('runs','old-error'),null);
  for(const id of ['no-status','unknown-status','null-status','cutoff','recent','queued','running','missingMs','offset','badLeap','badDay','hour24','numeric','empty','missing'])assert.ok(f.app.store.get('runs',id),id+' must remain');
});
test('workroom scheduling alone does not enable operational data deletion',async t=>{
  const f=await fixture(t,'0');f.put('old','2026-10-01T00:00:00.000Z');
  await f.app.scheduledTick();assert.ok(f.app.store.get('runs','old'));
});
test('the operational one-hour maintenance interval remains intact',async t=>{
  const f=await fixture(t);f.put('first','2026-10-01T00:00:00.000Z');await f.app.scheduledTick();assert.equal(f.app.store.get('runs','first'),null);
  f.put('second','2026-10-01T00:00:00.000Z');f.at('2026-11-16T00:01:00.000Z');await f.app.scheduledTick();assert.ok(f.app.store.get('runs','second'));
  f.at('2026-11-16T01:00:01.000Z');await f.app.scheduledTick();assert.equal(f.app.store.get('runs','second'),null);
});

test('a failed cleanup is reported and can retry on the next scheduled tick',async t=>{
  const f=await fixture(t),remove=f.app.store.removeWhere,logs=[];let fail=true;
  t.mock.method(console,'error',(...args)=>logs.push(args.join(' ')));
  t.mock.method(f.app.store,'removeWhere',function(kind,...args){
    if(kind==='runs'&&fail){fail=false;throw new Error('synthetic-cleanup-failure');}
    return remove.call(this,kind,...args);
  });
  f.put('retry','2026-10-01T00:00:00.000Z');await f.app.scheduledTick();assert.ok(f.app.store.get('runs','retry'));
  assert.deepEqual(logs,['SYNK_COMPANY_RUN_MAINTENANCE_FAILED']);
  f.at('2026-11-16T00:01:00.000Z');await f.app.scheduledTick();assert.equal(f.app.store.get('runs','retry'),null);
});
