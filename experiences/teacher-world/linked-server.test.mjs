import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createLinkedServer,createLinkedState} from './linked-server.mjs';
import Game from '../../atlas/game-learning.js';
import Strata from '../../strata/index.js';
import mapData from '../../strata/maps/topik-i.json' with {type:'json'};
const START=Date.parse('2026-10-02T06:00:00Z'),map=Strata.createMap(mapData);
const answers={'detail-open':'b','detail-books':'b','detail-return':'c'};
async function fixture(t,options={}){
  let now=START;const server=await createLinkedServer({now:()=>now,...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(route,{token,payload,headers={}}={})=>{const response=await fetch(origin+route,{headers:{...headers,...(token?{Authorization:`Bearer ${token}`}:{ }),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{method:'POST',body:JSON.stringify(payload)}:{})});return {status:response.status,body:await response.json()};};
  const teacher=(await call('/api/teacher/session',{payload:{key:server.ownerKey}})).body.token;
  const join=async(name='연결 학생')=>{const link=await call('/api/links',{token:teacher,payload:{classId:'class-local',name}});assert.equal(link.status,200);const joined=await call('/api/join',{payload:{code:link.body.code,consent:true}});assert.equal(joined.status,200);return {...joined.body,link:link.body};};
  const assign=async(student,extra={})=>{const r=await call('/api/assignments',{token:teacher,payload:{classId:'class-local',learnerIds:[student.learner.id],contentId:'reading-detail',dueAt:new Date(now+86400000).toISOString(),reason:'실제 응답 확인',idempotencyKey:'assign-'+Math.random().toString(16).slice(2),...extra}});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.assignment;};
  return {server,origin,call,teacher,join,assign,advance:ms=>now+=ms,get now(){return now;}};
}
const studentFrom=w=>w.classes.flatMap(c=>c.learners)[0];
function events(now,{help=false,audio=true,motor=false}={}){
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const coach=Game.createGame({gameId:'korean-rhythm',storage,map,clock:()=>new Date(now).toISOString()});
  const pid=coach.present({id:'actual-listening',itemKey:'actual-listening',familyKey:'actual-listening',skillId:'ko.listening.main',modality:'listening',difficulty:1,responseFormat:'binary-choice',audioRequired:true,confounded:motor});
  if(audio)coach.delivery(pid,{audio:'completed'});if(help)coach.help(pid,'text');coach.answer(pid,{correct:true,assessable:true});return coach.syncPort.events();
}
test('starts empty and connects WORLD practice, teacher assignment and server-scored result with one identity',async t=>{
  const f=await fixture(t);let w=(await f.call('/api/workspace',{token:f.teacher})).body;assert.equal(w.classes[0].learners.length,0);assert.equal(w.mode,'local-linked');assert.equal(w.integration.productionConnected,false);
  const s=await f.join();assert.equal((await f.call('/api/world/account',{token:s.token})).body.account.synk_user_id,`local-world-${s.learner.id}`);
  const content=(await f.call('/api/world/practice',{token:s.token})).body.content;assert(!JSON.stringify(content).includes('"answer":'));
  const p=await f.call('/api/world/practice',{token:s.token,payload:{contentId:'reading-detail',answers:{...answers,'detail-open':'a'},revision:s.sharing.revision,idempotencyKey:'practice-1'}});assert.equal(p.body.submission.correct,2);
  w=(await f.call('/api/workspace',{token:f.teacher})).body;assert.equal(studentFrom(w).evidence.length,3);assert.equal(studentFrom(w).evidence[0].grading,'server-scored');
  const a=await f.assign(s),inbox=(await f.call('/api/student',{token:s.token})).body;assert.equal(inbox.assignments[0].id,a.id);assert(!JSON.stringify(inbox.assignments[0].content).includes('"answer":'));
  const result=await f.call('/api/submissions',{token:s.token,payload:{assignmentId:a.id,revision:a.revision,answers,idempotencyKey:'submit-1'}});assert.equal(result.status,200);assert.equal(result.body.submission.correct,3);assert(result.body.submission.results.every(r=>r.independent===false));
  w=(await f.call('/api/workspace',{token:f.teacher})).body;assert.equal(w.analytics.completed,1);assert.equal(w.analytics.correct,3);assert.equal(studentFrom(w).evidence.length,6);
});
test('student token cannot access teacher data, issue links or submit for another student',async t=>{
  const f=await fixture(t),a=await f.join('A'),b=await f.join('B'),assignment=await f.assign(b);
  assert.equal((await f.call('/api/workspace',{token:a.token})).status,403);
  assert.equal((await f.call('/api/links',{token:a.token,payload:{classId:'class-local',name:'intruder'}})).status,404);
  assert.equal((await f.call('/api/submissions',{token:a.token,payload:{assignmentId:assignment.id,revision:1,answers,idempotencyKey:'attack'}})).status,403);
  assert.equal((await f.call('/api/world/practice',{token:a.token,payload:{learnerId:b.learner.id,contentId:'reading-detail',answers,revision:2,idempotencyKey:'attack'}})).status,403);
  assert.equal((await f.call('/api/student',{token:a.token})).body.assignments.length,0);
});
test('owner key required and pairing codes expire, require consent and can be used only once',async t=>{
  const f=await fixture(t);assert.equal((await f.call('/api/workspace')).status,401);assert.equal((await f.call('/api/teacher/session',{payload:{key:'bad'}})).status,401);
  const s=await f.join();assert.equal((await f.call('/api/join',{payload:{code:s.link.code,consent:true}})).status,410);
  const link=(await f.call('/api/links',{token:f.teacher,payload:{classId:'class-local',name:'next'}})).body;
  assert.equal((await f.call('/api/join',{payload:{code:link.code,consent:false}})).body.code,'CONSENT_REQUIRED');f.advance(600001);
  assert.equal((await f.call('/api/join',{payload:{code:link.code,consent:true}})).status,410);
});
test('bad origin, source/state files and wrong roles fail closed',async t=>{
  const f=await fixture(t);assert.equal((await f.call('/api/workspace',{token:f.teacher,headers:{Origin:'https://example.com'}})).status,403);
  for(const url of ['/linked-server.mjs','/model.mjs','/.local/linked-state.json','/synk-account/src/local-world.mjs'])assert.equal((await fetch(f.origin+url)).status,404,url);
  assert.equal((await f.call('/api/student',{token:f.teacher})).status,403);
});
test('game events cross the shared server with provenance, deduplicate and reject conflicting bodies',async t=>{
  const f=await fixture(t),s=await f.join(),log=events(f.now+1);f.advance(10);
  const payload={revision:s.sharing.revision,events:log};assert.equal((await f.call('/api/world/learning',{token:s.token,payload})).status,200);
  assert.equal((await f.call('/api/world/learning',{token:s.token,payload})).status,200);
  const w=(await f.call('/api/workspace',{token:f.teacher})).body,l=studentFrom(w);assert.equal(l.evidence.length,1);assert.equal(l.evidence[0].grading,'game-reported');assert(l.evidence[0].sourceEventId);assert.equal(l.skills.find(x=>x.id==='ko.listening.main').n,1);
  assert.equal((await f.call('/api/world/learning?after=0&revision=2',{token:s.token})).body.events.length,log.length);
  const changed=structuredClone(log);changed[0].at=new Date(f.now+1).toISOString();assert.equal((await f.call('/api/world/learning',{token:s.token,payload:{...payload,events:changed}})).body.code,'EVENT_CONFLICT');
});
test('hinted, failed audio and motor-confounded play never become independent language mastery',async t=>{
  for(const opts of [{help:true},{audio:false},{motor:true}]){const f=await fixture(t),s=await f.join(),log=events(f.now+1,opts);f.advance(10);assert.equal((await f.call('/api/world/learning',{token:s.token,payload:{revision:2,events:log}})).status,200);const l=studentFrom((await f.call('/api/workspace',{token:f.teacher})).body);assert.equal(l.skills.find(x=>x.id==='ko.listening.main').n,0);}
});
test('foreign event scope and pre-consent events cannot be adopted as this learner history',async t=>{
  const f=await fixture(t),s=await f.join(),log=events(f.now-10);assert.equal((await f.call('/api/world/learning',{token:s.token,payload:{revision:2,events:log}})).status,400);
  const foreign=events(f.now);foreign.forEach(e=>e.scope.subject='another');assert.equal((await f.call('/api/world/learning',{token:s.token,payload:{revision:2,events:foreign}})).status,400);assert.equal(f.server.snapshot().learners[0].events.length,0);
});
test('sharing withdrawal clears derived teacher evidence, blocks stale uploads and does not revive old tasks on consent',async t=>{
  const f=await fixture(t),s=await f.join(),a=await f.assign(s);await f.call('/api/world/practice',{token:s.token,payload:{contentId:'reading-detail',answers,revision:2,idempotencyKey:'practice'}});
  assert.equal((await f.call('/api/world/sharing',{token:s.token,payload:{enabled:false,revision:2}})).body.revision,3);
  let w=(await f.call('/api/workspace',{token:f.teacher})).body;assert.equal(studentFrom(w).evidence.length,0);assert.equal(w.assignments.length,0);
  assert.equal((await f.call('/api/world/learning',{token:s.token,payload:{revision:2,events:events(f.now)}})).body.code,'LEARNING_DISABLED');
  await f.call('/api/world/sharing',{token:s.token,payload:{enabled:true,revision:3}});assert.equal((await f.call('/api/student',{token:s.token})).body.assignments.length,0);
  assert.equal((await f.call('/api/submissions',{token:s.token,payload:{assignmentId:a.id,revision:1,answers,idempotencyKey:'stale'}})).status,403);
  w=(await f.call('/api/workspace',{token:f.teacher})).body;assert.equal(studentFrom(w).evidence.length,0);
});
test('changed or cancelled assignments reject stale submissions and preserve server state',async t=>{
  const f=await fixture(t),s=await f.join(),a=await f.assign(s);
  assert.equal((await f.call('/api/assignments/update',{token:f.teacher,payload:{assignmentId:a.id,revision:1,title:'수정 과제'}})).status,200);
  assert.equal((await f.call('/api/submissions',{token:s.token,payload:{assignmentId:a.id,revision:1,answers,idempotencyKey:'old'}})).body.code,'REVISION_CONFLICT');
  assert.equal((await f.call('/api/assignments/cancel',{token:f.teacher,payload:{assignmentId:a.id,revision:2,reason:'다음 수업에 배정'}})).status,200);
  assert.equal((await f.call('/api/submissions',{token:s.token,payload:{assignmentId:a.id,revision:3,answers,idempotencyKey:'cancelled'}})).body.code,'ASSIGNMENT_CANCELLED');assert.equal(f.server.snapshot().submissions.length,0);
});
test('lost response retries and concurrent submissions create exactly one score and evidence set',async t=>{
  const f=await fixture(t),s=await f.join(),a=await f.assign(s),payload={assignmentId:a.id,revision:1,answers,idempotencyKey:'stable'};
  const responses=await Promise.all([f.call('/api/submissions',{token:s.token,payload}),f.call('/api/submissions',{token:s.token,payload})]);assert(responses.every(r=>r.status===200));assert.equal(responses[0].body.submission.id,responses[1].body.submission.id);assert.equal(f.server.snapshot().submissions.length,1);assert.equal(f.server.snapshot().learners[0].evidence.length,3);
  assert.equal((await f.call('/api/submissions',{token:s.token,payload:{...payload,answers:{...answers,'detail-open':'a'}}})).body.code,'IDEMPOTENCY_CONFLICT');
});
test('link revocation and logout invalidate server sessions',async t=>{
  const f=await fixture(t),s=await f.join();assert.equal((await f.call('/api/links/revoke',{token:f.teacher,payload:{learnerId:s.learner.id,revision:2}})).status,200);assert.equal((await f.call('/api/student',{token:s.token})).status,401);
  await f.call('/api/logout',{token:f.teacher,payload:{}});assert.equal((await f.call('/api/workspace',{token:f.teacher})).status,401);
});
test('session expiration never returns cached student or teacher data',async t=>{
  const f=await fixture(t,{sessionMs:1000}),s=await f.join();f.advance(1001);assert.equal((await f.call('/api/student',{token:s.token})).status,401);assert.equal((await f.call('/api/workspace',{token:f.teacher})).status,401);
});
test('restart retains identity, assignments and results in separate linked storage',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'synk-linked-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));const persistPath=path.join(dir,'state.json');
  const f=await fixture(t,{persistPath}),s=await f.join(),a=await f.assign(s);await f.call('/api/submissions',{token:s.token,payload:{assignmentId:a.id,revision:1,answers,idempotencyKey:'restart'}});
  const g=await fixture(t,{persistPath});assert.equal((await g.call('/api/student',{token:s.token})).body.assignments[0].submission.correct,3);assert.equal((await g.call('/api/workspace',{token:g.teacher})).body.analytics.completed,1);assert(!JSON.stringify(JSON.parse(await readFile(persistPath,'utf8'))).includes(s.token));
});
test('failed persistence is atomic and never acknowledges or exposes unsaved data',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'synk-linked-failure-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'state.json');const f=await fixture(t,{persistPath:file});await rm(file);await mkdir(file);
  const before=f.server.snapshot();assert.equal((await f.call('/api/links',{token:f.teacher,payload:{classId:'class-local',name:'save failure'}})).status,500);assert.deepEqual(f.server.snapshot(),before);
});
test('demo state can never be used as linked student history',async()=>{await assert.rejects(()=>createLinkedServer({state:{...createLinkedState(),mode:'demo',synthetic:true}}),/Refusing/);});
test('reading mistakes recommend available reading practice and a new passage updates the same skill',async t=>{
  const f=await fixture(t),s=await f.join();await f.call('/api/world/practice',{token:s.token,payload:{contentId:'reading-detail',answers:{'detail-open':'a','detail-books':'a','detail-return':'a'},revision:2,idempotencyKey:'baseline'}});
  const w=(await f.call('/api/workspace',{token:f.teacher})).body;assert.equal(studentFrom(w).recommendation.skillId,'ko.reading.detail');assert.notEqual(studentFrom(w).recommendation.contentId,'reading-detail');
  const a=await f.assign(s,{contentId:'reading-detail-transfer'});const result=await f.call('/api/submissions',{token:s.token,payload:{assignmentId:a.id,revision:1,answers:{'transfer-day':'b','transfer-time':'c','transfer-place':'a','transfer-bring':'b'},idempotencyKey:'fresh-passage'}});
  assert.equal(result.body.submission.total,4);assert(result.body.submission.results.every(r=>r.independent));
  const reading=studentFrom((await f.call('/api/workspace',{token:f.teacher})).body).skills.find(x=>x.id==='ko.reading.detail');assert.equal(reading.n,7);assert.equal(reading.correct,4);
});
test('a delayed observation retry cannot resurrect an earlier consent epoch',async t=>{
  const f=await fixture(t),s=await f.join(),payload={learnerId:s.learner.id,skillId:'ko.reading.detail',note:'수업에서 문장을 확인했어요.',idempotencyKey:'old-epoch-note'};
  assert.equal((await f.call('/api/observations',{token:f.teacher,payload})).status,200);
  await f.call('/api/world/sharing',{token:s.token,payload:{enabled:false,revision:2}});await f.call('/api/world/sharing',{token:s.token,payload:{enabled:true,revision:3}});
  assert.equal((await f.call('/api/observations',{token:f.teacher,payload})).body.code,'REVISION_CONFLICT');assert.equal((await f.call('/api/workspace',{token:f.teacher})).body.observations.length,0);
});
test('an assignment keeps its authored question snapshot without exposing its answer key',async t=>{
  const f=await fixture(t),s=await f.join(),a=await f.assign(s);assert.equal(f.server.snapshot().assignments[0].taskSnapshot.questions[0].answer,'b');
  const content=(await f.call('/api/student',{token:s.token})).body.assignments[0].content;assert(!Object.hasOwn(content.questions[0],'answer'));assert(!Object.hasOwn(content.questions[0],'explanation'));
  assert.equal((await f.call('/api/student',{token:s.token})).body.assignments[0].contentVersion,'v1');
});
