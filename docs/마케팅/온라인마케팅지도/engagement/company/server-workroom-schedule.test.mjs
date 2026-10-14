import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED','SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED'];
function environment(t,workroom){
  const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  process.env[keys[0]]='0';process.env[keys[2]]='0';
  if(workroom===undefined)delete process.env[keys[1]];else process.env[keys[1]]=workroom;
  t.after(()=>{for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];});
}
async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-workroom-schedule-'));let calls=0;
  const deny=async()=>{calls++;throw Error('Unexpected external collector');};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,collector:deny,dailyTrendsCollector:deny,contentFetch:deny,...options});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-workroom-schedule-'));await rm(directory,{recursive:true,force:true});});
  const user=app.store.createUser({name:'Synthetic scheduler',email:'scheduler@example.test',role:'member'});
  const session=app.store.mint('session',user.id,{csrfToken:'scheduler'},30);
  await app.start();await app.waitForIdle();
  async function get(route){const response=await fetch(`http://127.0.0.1:${app.server.address().port}`+route,{headers:{Cookie:'synk_company_session='+session}});assert.equal(response.status,200);return response.json();}
  return {app,user,get,calls:()=>calls};
}
const card=(report,id)=>report.cards.find(row=>row.id===id);

test('workroom opt-in starts local scheduled checks and SNS runtime while unconnected collectors stay off',async t=>{
  environment(t,'1');const f=await fixture(t);const report=await f.get('/api/automation-health');
  assert.equal(report.monitor.enabled,true);assert.ok(report.monitor.lastScanAt);
  for(const id of ['links','weekly']){assert.notEqual(card(report,id).status,'paused');assert.ok(card(report,id).lastSuccessAt,id);}
  assert.equal(card(report,'performance').status,'paused');
  const weekly=await f.get('/api/weekly-summary');assert.equal(weekly.schedule.enabled,true);assert.ok(f.app.store.all('weeklyWorkSummaries').length);
  const social=await f.get('/api/social/workspace');assert.equal(social.runtime.enabled,true);assert.ok(social.runtime.lastAttemptAt);assert.equal(social.provider.configured,false);assert.equal(social.ai.canUse,false);
  await f.app.scheduledTick();assert.equal(f.calls(),0);
});
test('unset or explicit disabled workroom flag preserves stopped background defaults',async t=>{
  for(const value of [undefined,'0'])await t.test(String(value),async t=>{
    environment(t,value);const f=await fixture(t);const report=await f.get('/api/automation-health');
    assert.equal(report.monitor.enabled,false);for(const id of ['links','weekly','performance'])assert.equal(card(report,id).status,'paused');
    assert.equal((await f.get('/api/weekly-summary')).schedule.enabled,false);assert.equal(f.calls(),0);
    assert.equal((await f.get('/api/social/workspace')).runtime.enabled,false);
  });
});
test('schedule false suppresses environment defaults and explicit job options still take precedence',async t=>{
  environment(t,'1');const f=await fixture(t,{schedule:false,weeklySummarySchedule:true});const report=await f.get('/api/automation-health');
  assert.equal(report.monitor.enabled,false);assert.equal(card(report,'links').status,'paused');assert.equal(card(report,'performance').status,'paused');
  assert.equal((await f.get('/api/weekly-summary')).schedule.enabled,true);assert.ok(card(report,'weekly').lastSuccessAt);assert.equal(f.calls(),0);
});
test('individual false options disable workroom opt-in and invalid flags fail before opening data',async t=>{
  environment(t,'1');const f=await fixture(t,{publicationLinkSchedule:false,weeklySummarySchedule:false,automationHealthSchedule:false});const report=await f.get('/api/automation-health');
  assert.equal(report.monitor.enabled,false);for(const id of ['links','weekly'])assert.equal(card(report,id).status,'paused');assert.equal(f.calls(),0);
  for(const value of ['true','', '2']){process.env[keys[1]]=value;assert.throws(()=>createCompanyApp(),/SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED/);}
});
