import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from '../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs';
import {createTrialFeedback as createClient,normalizeAnswers} from '../experiences/talk-rally/trial-feedback.mjs';

async function setup(t,{clockSkew=0}={}){
  const directory=await mkdtemp(join(tmpdir(),'trial-client-server-'));let now=Date.parse('2026-11-09T03:00:00.000Z');
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,trialFeedbackOptions:{origins:['https://synk.im'],clock:()=>new Date(now).toISOString()}});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`,memory=new Map(),calls=[];
  let loseNextAck=false,offline=false;
  const client=createClient({storage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},collector:base,cohort:'qa-real-http',now:()=>now+clockSkew,uuid:randomUUID,
    fetchImpl:async(url,init)=>{calls.push({path:new URL(url).pathname,input:JSON.parse(init.body),credentials:init.credentials});if(offline)throw new TypeError('synthetic offline');const response=await fetch(url,{...init,headers:{...init.headers,Origin:'https://synk.im'}});if(loseNextAck){loseNextAck=false;await response.arrayBuffer();throw new TypeError('synthetic lost response');}return response;}});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const round=()=>({roundId:randomUUID(),startedAt:new Date(now+clockSkew-60000).toISOString(),mode:'normal',total:12,correct:8,helped:2,soundOn:true});
  return {app,client,calls,round,advance:ms=>{now+=ms;},loseAck:()=>{loseNextAck=true;},offline:value=>{offline=value;},setSkew:value=>{clockSkew=value;}};
}
test('the actual browser client contract works against company HTTP from consent to event collection and withdrawal',async t=>{
  const f=await setup(t),first=f.round();f.client.lobby();f.client.roundStart(first);f.client.roundComplete(first);await f.client.flush();assert.equal(f.calls.length,0);
  const answer=await f.client.enroll({age14:true,answers:normalizeAnswers({again:'again_7d'}),round:first});assert.equal(answer.kind,'sent');assert.equal(f.client.status().phase,'active');
  assert.equal(f.app.store.count('trialParticipants'),1);assert.equal(f.app.store.count('trialEvents'),3);
  assert.equal(f.app.store.all('trialParticipants')[0].synthetic,true);assert.equal(f.app.store.all('trialParticipants')[0].answers.fun,null);
  f.advance(86400000);const second=f.round();f.client.roundStart(second);f.client.roundComplete(second);await f.client.flush();
  assert.equal(f.app.store.count('trialEvents'),6);assert.equal(f.calls.every(call=>call.credentials==='omit'),true);
  assert.equal(f.app.store.all('trialEvents').filter(row=>row.roundId===second.roundId).length,2);
  assert.equal((await f.client.withdraw()).kind,'withdrawn');assert.equal(f.app.store.count('trialParticipants'),0);assert.equal(f.app.store.count('trialEvents'),0);
  const count=f.calls.length;f.client.lobby();f.client.roundStart(f.round());await f.client.flush();assert.equal(f.calls.length,count);
});
test('losing an accepted HTTP response retries the same submission once and does not duplicate the first round',async t=>{
  const f=await setup(t);f.loseAck();
  const first=await f.client.enroll({age14:true,answers:normalizeAnswers({fun:'fun_3',note:'synthetic transport test'}),round:f.round()});
  assert.equal(first.kind,'offline');assert.equal(f.client.status().phase,'pending');assert.equal(f.app.store.count('trialParticipants'),1);
  const retry=await f.client.flush();assert.equal(retry.kind,'sent');assert.equal(retry.duplicate,true);assert.equal(f.client.status().phase,'active');
  assert.equal(f.calls[0].input.submissionId,f.calls[1].input.submissionId);assert.equal(f.app.store.count('trialEvents'),3);
  await f.client.withdraw();assert.equal(f.app.store.count('trialParticipants'),0);
  assert.equal(f.app.store.db.prepare("SELECT count(*) AS n FROM credentials WHERE id LIKE 'trial-note:%'").get().n,0);
});
test('offline enrollment precedes queued rounds with a small fast device clock',async t=>{
  const f=await setup(t,{clockSkew:2000});f.offline(true);
  assert.equal((await f.client.enroll({age14:true,answers:normalizeAnswers({again:'again_1d'}),round:f.round()})).kind,'offline');
  f.advance(86400000);const next=f.round();f.client.roundStart(next);f.client.roundComplete(next);await f.client.flush();
  assert.equal(f.app.store.count('trialParticipants'),0);f.offline(false);await f.client.flush();
  assert.equal(f.client.status().phase,'active');assert.equal(f.app.store.count('trialParticipants'),1);assert.equal(f.app.store.count('trialEvents'),6);
  assert.equal(f.app.store.all('trialEvents').filter(row=>row.roundId===next.roundId).length,2);
});
test('one invalid clock event is dropped while later valid queued events still reach the real server',async t=>{
  const f=await setup(t);await f.client.enroll({age14:true,answers:normalizeAnswers({again:'again_1d'}),round:f.round()});
  f.offline(true);f.advance(86400000);f.setSkew(600000);const bad=f.round();f.client.roundStart(bad);await f.client.flush();
  f.setSkew(0);const good=f.round();f.client.roundStart(good);f.client.roundComplete(good);await f.client.flush();
  f.offline(false);await f.client.flush();const rows=f.app.store.all('trialEvents');
  assert.equal(rows.filter(row=>row.roundId===bad.roundId).length,0);assert.equal(rows.filter(row=>row.roundId===good.roundId).length,2);assert.equal(f.client.status().phase,'active');
});
test('an excessive enrollment clock never shows a saved participation or creates a measurement cohort',async t=>{
  const f=await setup(t,{clockSkew:420000});const result=await f.client.enroll({age14:true,answers:normalizeAnswers({fun:'fun_3'}),round:f.round()});
  assert.equal(result.kind,'invalid');assert.equal(f.client.status().phase,'none');assert.equal(f.app.store.count('trialParticipants'),0);assert.equal(f.app.store.count('trialEvents'),0);
});
