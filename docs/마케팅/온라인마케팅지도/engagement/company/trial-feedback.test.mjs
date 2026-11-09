import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createTrialFeedback} from './trial-feedback.mjs';

const DAY=86400000,ORIGIN='https://synk.im';
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-trial-')),store=new Store(directory);
  let now=Date.parse('2026-11-09T03:00:00.000Z');const clock=()=>new Date(now).toISOString();
  const service=createTrialFeedback({store,clock}),admin=store.createUser({email:'admin@example.test',name:'Admin',role:'admin'}),viewer=store.createUser({email:'viewer@example.test',name:'Viewer',role:'viewer'});
  t.after(()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const enrollment=(overrides={})=>({v:1,app:'talk-rally',surface:'lab-web',participantId:randomUUID(),submissionId:randomUUID(),cohort:'open',consentAt:clock(),consent:{version:'2026-11-09',age14:true},round:{roundId:randomUUID(),startedAt:new Date(now-120000).toISOString(),mode:'normal',total:12,correct:9,helped:2,soundOn:true},answers:{fun:'fun_3',stuck:['listen'],stuckNote:'소리를 한 번 더 듣고 싶어요.',again:'again_1d'},...overrides});
  const event=(participant,kind,round,overrides={})=>({v:1,app:'talk-rally',participantId:participant.participantId,eventId:randomUUID(),kind,occurredAt:clock(),...(round?{round}:{}),...overrides});
  return {directory,store,service,admin,viewer,clock,enrollment,event,context:{origin:ORIGIN,client:'test-address'},advance:ms=>{now+=ms;},set:iso=>{now=Date.parse(iso);}};
}
test('enrollment atomically stores consent, first round and an encrypted note without identity',t=>{
  const f=fixture(t),input=f.enrollment(),reply=f.service.enroll(input,f.context);
  assert.equal(reply.duplicate,false);assert.equal(Date.parse(reply.expiresAt)-Date.parse(reply.consentAt),30*DAY);
  assert.equal(f.store.count('trialParticipants'),1);assert.equal(f.store.count('trialEvents'),3);
  const record=f.store.all('trialParticipants')[0];assert.equal(record.hasNote,true);assert.equal(f.store.secret('trial-note:'+record.id),input.answers.stuckNote);
  const documents=JSON.stringify([...f.store.all('trialParticipants'),...f.store.all('trialEvents')]);
  for(const hidden of [input.participantId,input.answers.stuckNote,'test-address'])assert.equal(documents.includes(hidden),false);
  assert.equal(f.store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('trial-note:'+record.id).ciphertext.includes(input.answers.stuckNote),false);
  assert.deepEqual(f.service.summary(f.admin).denominators,{participants:1,visits:1,returnVisits:0,participantsReturned:0,roundStarts:1,roundCompletes:1,roundsStartedNotCompleted:0,roundsCompletedWithoutStart:0});
});
test('retries survive a later server clock and never overwrite an accepted answer',t=>{
  const f=fixture(t),input=f.enrollment(),first=f.service.enroll(input,f.context);f.advance(4*DAY);
  assert.deepEqual(f.service.enroll(structuredClone(input),f.context),{...first,duplicate:true});
  assert.throws(()=>f.service.enroll({...input,answers:{...input.answers,fun:'fun_1'}},f.context),{status:409,trialCode:'conflict'});
  assert.throws(()=>f.service.enroll({...input,submissionId:randomUUID()},f.context),{status:409,trialCode:'already_enrolled'});
  assert.equal(f.store.count('trialEvents'),3);assert.equal(f.service.summary(f.admin).fun.counts.fun_3,1);
});
test('strict nested validation rejects extra personal data, absent consent and invalid answers',t=>{
  const f=fixture(t);
  const bad=[{email:'private@example.test'},{consent:{version:'2026-11-09',age14:false}},{consent:{version:'old',age14:true}},{answers:{fun:null,stuck:null,stuckNote:null,again:null}},{answers:{fun:'fun_3',stuck:['none','listen'],stuckNote:null,again:null}},{answers:{fun:'fun_3',stuck:[],stuckNote:null,again:null}},{answers:{fun:'fun_3',stuck:null,stuckNote:'x'.repeat(101),again:null}},{answers:{fun:'fun_3',stuck:null,stuckNote:'a\nb',again:null}},{surface:'world'},{participantId:'not-a-uuid'},{consentAt:'nonsense'}];
  for(const update of bad)assert.throws(()=>f.service.enroll(f.enrollment(update),f.context),{status:400});
  const input=f.enrollment();assert.throws(()=>f.service.enroll({...input,round:{...input.round,correct:13}},f.context),{status:400});
  assert.equal(f.store.count('trialParticipants'),0);assert.equal(f.store.count('trialEvents'),0);
  const partial=f.enrollment({answers:{fun:null,stuck:null,stuckNote:null,again:'again_unsure'}});f.service.enroll(partial,f.context);
  const report=f.service.summary(f.admin);assert.equal(report.fun.answered,0);assert.equal(report.fun.skipped,1);
});
test('withdrawal removes only its records and prevents an in-flight enrollment from resurrecting',t=>{
  const f=fixture(t),input=f.enrollment();f.service.enroll(input,f.context);
  f.store.put('otherService','preserve',{id:'preserve',value:42});const id=f.store.all('trialParticipants')[0].id;
  const request={v:1,app:'talk-rally',participantId:input.participantId};
  assert.deepEqual(f.service.withdraw(request,f.context),{ok:true,deleted:true});assert.deepEqual(f.service.withdraw(request,f.context),{ok:true,deleted:true});
  assert.equal(f.store.count('trialParticipants'),0);assert.equal(f.store.count('trialEvents'),0);assert.equal(f.store.secret('trial-note:'+id),null);
  assert.deepEqual(f.store.get('otherService','preserve'),{id:'preserve',value:42});
  assert.throws(()=>createTrialFeedback({store:f.store,clock:f.clock}).enroll(input,f.context),{status:410,trialCode:'withdrawn'});
  const pending=f.enrollment();f.service.withdraw({...request,participantId:pending.participantId},f.context);
  assert.throws(()=>f.service.enroll(pending,f.context),{status:410});
  assert.throws(()=>f.service.event(f.event(input,'visit'),f.context),{status:404});
  assert.deepEqual(Object.keys(f.store.all('trialWithdrawn')[0]).sort(),['id','until']);
});
test('event and round retries are idempotent; completion may arrive before its start',t=>{
  const f=fixture(t),input=f.enrollment();f.service.enroll(input,f.context);f.advance(DAY);
  const round={roundId:randomUUID(),mode:'normal',total:12,correct:10,helped:0,soundOn:true},complete=f.event(input,'round_complete',round);
  f.service.event(complete,f.context);assert.equal(f.service.summary(f.admin).denominators.roundsCompletedWithoutStart,1);
  assert.equal(f.service.event(complete,f.context).duplicate,true);
  assert.equal(f.service.event({...complete,eventId:randomUUID()},f.context).duplicate,true);
  assert.throws(()=>f.service.event({...complete,round:{...round,correct:1}},f.context),{status:409});
  f.service.event(f.event(input,'round_start',{roundId:round.roundId,mode:round.mode}),f.context);
  f.service.event(f.event(input,'visit'),f.context);assert.equal(f.service.event(f.event(input,'visit'),f.context).duplicate,true);
  const second=f.enrollment();f.service.enroll(second,f.context);
  assert.throws(()=>f.service.event({...complete,participantId:second.participantId},f.context),{status:409});
  assert.equal(f.service.summary(f.admin).denominators.roundsCompletedWithoutStart,0);
});
test('late semantic duplicates and first deliveries cannot fabricate a return visit',t=>{
  const f=fixture(t),input=f.enrollment();f.service.enroll(input,f.context);f.advance(3600000);
  const repeated=f.event(input,'visit'),neverSent=f.event(input,'visit');
  assert.equal(f.service.event(repeated,f.context).duplicate,true);
  f.advance(4*DAY);
  for(const event of [repeated,neverSent])assert.throws(()=>f.service.event(event,f.context),{status:400,trialCode:'invalid',field:'occurredAt'});
  assert.equal(f.store.count('trialEvents'),3);
  const report=f.service.summary(f.admin);assert.equal(report.denominators.visits,1);assert.equal(report.denominators.returnVisits,0);assert.equal(report.denominators.participantsReturned,0);
  assert.deepEqual(report.againVsReturn[0].within1d,{eligible:1,returned:0});
});
test('accepted retries keep their day and valid delayed events retain their original timestamp',t=>{
  const f=fixture(t),input=f.enrollment();f.service.enroll(input,f.context);f.advance(DAY);
  const accepted=f.event(input,'visit');assert.equal(f.service.event(accepted,f.context).duplicate,false);
  f.advance(4*DAY);assert.equal(f.service.event(accepted,f.context).duplicate,true);
  const delayedAt=new Date(Date.parse(f.clock())-2*DAY).toISOString(),delayed=f.event(input,'visit',null,{occurredAt:delayedAt});
  assert.equal(f.service.event(delayed,f.context).duplicate,false);
  assert.ok(f.store.all('trialEvents').some(row=>row.at===delayedAt));
  for(const occurredAt of [new Date(Date.parse(f.clock())+DAY).toISOString(),new Date(Date.parse(input.consentAt)-300001).toISOString()]){
    assert.throws(()=>f.service.event(f.event(input,'visit',null,{occurredAt}),f.context),{status:400,field:'occurredAt'});
  }
  assert.equal(f.store.count('trialEvents'),5);assert.equal(f.service.summary(f.admin).denominators.returnVisits,2);
});
test('small positive device clock skew preserves every event and the next-day return',t=>{
  for(const skew of [500,2000,299000,300000]){
    const f=fixture(t),input=f.enrollment({consentAt:new Date(Date.parse(f.clock())+skew).toISOString()});
    assert.equal(f.service.enroll(input,f.context).consentAt,input.consentAt);f.advance(DAY);
    const occurredAt=new Date(Date.parse(f.clock())+skew).toISOString(),round={roundId:randomUUID(),mode:'normal',total:12,correct:8,helped:1,soundOn:true};
    for(const [kind,value] of [['visit',null],['round_start',{roundId:round.roundId,mode:round.mode}],['round_complete',round]]){
      assert.equal(f.service.event(f.event(input,kind,value,{occurredAt}),f.context).duplicate,false);
    }
    assert.equal(f.store.count('trialEvents'),6);f.advance(DAY);
    assert.deepEqual(f.service.summary(f.admin).againVsReturn[0].within1d,{eligible:1,returned:1});
  }
});
test('enrollment rejects excessive future clocks instead of creating an unobservable return cohort',t=>{
  const f=fixture(t),now=Date.parse(f.clock());
  for(const delta of [300001,420000])assert.throws(()=>f.service.enroll(f.enrollment({consentAt:new Date(now+delta).toISOString()}),f.context),{status:400,field:'consentAt'});
  assert.equal(f.store.count('trialParticipants'),0);assert.equal(f.store.count('trialEvents'),0);
  for(const delta of [-3*DAY,-3*DAY-1]){
    const input=f.enrollment({consentAt:new Date(now+delta).toISOString()}),reply=f.service.enroll(input,f.context);
    assert.equal(reply.consentAt,delta===-3*DAY?input.consentAt:f.clock());
  }
});
test('visit and round semantic retries spanning midnight keep their original device day',t=>{
  for(const skew of [0,60000]){
    const f=fixture(t);f.set('2026-11-09T14:59:30.000Z');
    const consentAt=new Date(Date.parse(f.clock())+skew).toISOString(),input=f.enrollment({consentAt});f.service.enroll(input,f.context);
    const visit=f.event(input,'visit',null,{occurredAt:consentAt}),round=f.event(input,'round_start',{roundId:input.round.roundId,mode:'normal'},{occurredAt:consentAt});
    for(const request of [visit,round])assert.equal(f.service.event(request,f.context).duplicate,true);
    f.advance(90000);for(const request of [visit,round])assert.equal(f.service.event(request,f.context).duplicate,true);
    assert.equal(f.store.count('trialEvents'),3);assert.equal(f.service.summary(f.admin).denominators.returnVisits,0);
  }
});
test('timestamp windows include their exact boundaries without shifting dates',t=>{
  const f=fixture(t);f.set('2026-11-09T15:02:00.000Z');const input=f.enrollment();f.service.enroll(input,f.context);
  const consent=Date.parse(input.consentAt);
  for(const delta of [-300000,300000])assert.equal(f.service.event(f.event(input,'round_start',{roundId:randomUUID(),mode:'normal'},{occurredAt:new Date(consent+delta).toISOString()}),f.context).duplicate,false);
  for(const delta of [-300001,300001])assert.throws(()=>f.service.event(f.event(input,'visit',null,{occurredAt:new Date(consent+delta).toISOString()}),f.context),{status:400,field:'occurredAt'});
  assert.equal(f.service.summary(f.admin).denominators.visits,1);
  f.advance(4*DAY);const earliest=Date.parse(f.clock())-3*DAY;
  assert.equal(f.service.event(f.event(input,'visit',null,{occurredAt:new Date(earliest).toISOString()}),f.context).duplicate,false);
  assert.throws(()=>f.service.event(f.event(input,'visit',null,{occurredAt:new Date(earliest-1).toISOString()}),f.context),{status:400,field:'occurredAt'});
});
test('future device dates remain readable and outside-window errors precede expiry',t=>{
  const f=fixture(t);f.set('2026-11-09T14:58:00.000Z');
  const input=f.enrollment({consentAt:'2026-11-09T15:02:00.000Z'}),reply=f.service.enroll(input,f.context);
  const report=f.service.summary(f.admin);assert.equal(report.today,'2026-11-09');assert.equal(report.comments[0].date,'2026-11-10');assert.equal(report.denominators.visits,1);
  f.set(new Date(Date.parse(reply.expiresAt)-10*60000).toISOString());
  assert.throws(()=>f.service.event(f.event(input,'visit',null,{occurredAt:new Date(Date.parse(reply.expiresAt)+10*60000).toISOString()}),f.context),{status:400,field:'occurredAt'});
  f.set(new Date(Date.parse(reply.expiresAt)-60000).toISOString());
  assert.throws(()=>f.service.event(f.event(input,'visit',null,{occurredAt:reply.expiresAt}),f.context),{status:410,trialCode:'expired'});
});
test('a daily event cap stays tied to the event day across retries',t=>{
  const f=fixture(t),input=f.enrollment();f.service.enroll(input,f.context);
  for(let i=0;i<57;i++)f.service.event(f.event(input,'round_start',{roundId:randomUUID(),mode:'normal'}),{...f.context,client:'cap-'+i});
  const request=f.event(input,'round_start',{roundId:randomUUID(),mode:'normal'});
  for(let i=0;i<2;i++)assert.throws(()=>f.service.event(request,{...f.context,client:'cap-retry'}),{status:429});
  assert.equal(f.store.count('trialEvents'),60);
});
test('real and synthetic cohorts remain separate and return windows mature on Seoul calendar boundaries',t=>{
  const f=fixture(t);f.set('2026-11-09T14:50:00.000Z');const real=f.enrollment(),synthetic=f.enrollment({cohort:'qa-browser'});
  f.service.enroll(real,f.context);f.service.enroll(synthetic,f.context);
  f.set('2026-11-09T15:01:00.000Z');f.service.event(f.event(real,'round_start',{roundId:randomUUID(),mode:'normal'}),f.context);
  let report=f.service.summary(f.admin);assert.equal(report.denominators.participants,1);assert.equal(report.otherDataCount,1);
  assert.equal(report.denominators.visits,2);assert.equal(report.denominators.participantsReturned,1);
  assert.deepEqual(report.againVsReturn[0].within1d,{eligible:0,returned:0});
  f.set('2026-11-10T15:00:00.000Z');report=f.service.summary(f.admin);
  assert.deepEqual(report.againVsReturn[0].within1d,{eligible:1,returned:1});
  assert.equal(report.denominators.roundsStartedNotCompleted,1);
  f.set('2026-11-16T15:00:00.000Z');assert.deepEqual(f.service.summary(f.admin).againVsReturn[0].within7d,{eligible:1,returned:1});
  const testOnly=f.service.summary(f.admin,{data:'synthetic'});assert.equal(testOnly.denominators.participants,1);assert.equal(testOnly.denominators.participantsReturned,0);assert.equal(testOnly.comments[0].cohort,'qa-browser');
});
test('the first round spanning midnight does not fabricate a pre-consent visit',t=>{
  const f=fixture(t);f.set('2026-11-09T15:00:30.000Z');const input=f.enrollment();f.service.enroll(input,f.context);
  assert.equal(f.service.summary(f.admin).denominators.visits,1);
});
test('current staff roles control results and free text, not the caller-supplied role',t=>{
  const f=fixture(t);f.service.enroll(f.enrollment(),f.context);
  assert.throws(()=>f.service.summary(null),{status:401});
  const viewer=f.service.summary({...f.viewer,role:'admin'});assert.equal(viewer.comments,null);assert.equal(viewer.commentsHidden,true);
  f.store.put('users',f.admin.id,{...f.admin,role:'customer'});assert.throws(()=>f.service.summary(f.admin),{status:403});
  f.store.put('users',f.admin.id,{...f.admin,active:false});assert.throws(()=>f.service.summary(f.admin),{status:401});
  for(const query of [{days:'1'},{days:''},{cohort:''},{data:'all'},{data:'real',email:'private'}])assert.throws(()=>f.service.summary(f.viewer,query),{status:400});
});
test('expired participation rejects new events but still allows withdrawal',t=>{
  const f=fixture(t),input=f.enrollment();f.service.enroll(input,f.context);f.advance(31*DAY);
  assert.throws(()=>f.service.event(f.event(input,'visit'),f.context),{status:410});
  assert.equal(f.service.withdraw({v:1,app:'talk-rally',participantId:input.participantId},f.context).deleted,true);
});
test('maintenance expires answers, encrypted notes, events and old withdrawal markers without a public request',t=>{
  const f=fixture(t),input=f.enrollment(),other=f.enrollment();f.service.enroll(input,f.context);f.service.enroll(other,f.context);
  f.service.withdraw({v:1,app:'talk-rally',participantId:other.participantId},f.context);
  f.advance(91*DAY);f.service.maintain();
  for(const kind of ['trialParticipants','trialEvents','trialWithdrawn'])assert.equal(f.store.count(kind),0);
  assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM credentials WHERE id LIKE 'trial-note:%'").get().n,0);
  assert.equal(f.store.count('users'),2);
  const report=f.service.summary(f.admin);assert.equal(report.performance.firstRound.medianCorrectRatio,null);assert.deepEqual(report.comments,[]);
});
test('cross-origin traffic and rate limits cannot persist arbitrary input',t=>{
  const f=fixture(t);assert.equal(f.service.allowOrigin('https://synk.im.evil.test'),false);
  assert.throws(()=>f.service.enroll(f.enrollment(),{origin:'https://evil.test'}),{status:403});
  const input=f.enrollment();for(let i=0;i<30;i++)f.service.enroll(input,f.context);
  assert.throws(()=>f.service.enroll(input,f.context),{status:429});assert.equal(f.store.count('trialParticipants'),1);
  f.advance(60000);assert.equal(f.service.enroll(input,f.context).duplicate,true);
});
test('participant capacity returns a truthful full response instead of evicting existing feedback',t=>{
  const f=fixture(t);
  f.store.db.prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<5000) INSERT INTO documents(kind,id,body) SELECT 'trialParticipants','fill-'||i,json_object('id','fill-'||i,'deleteAt','2027-01-01T00:00:00.000Z') FROM n").run();
  assert.throws(()=>f.service.enroll(f.enrollment(),f.context),{status:503,trialCode:'full'});assert.equal(f.store.count('trialParticipants'),5000);
});
