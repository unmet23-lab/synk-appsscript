import test from 'node:test';
import assert from 'node:assert/strict';
import {createLinkedServer} from './linked-server.mjs';
import {GAME_CONTENT,gameProfiles,gameItems} from './game-catalog.mjs';
import Game from '../../atlas/game-learning.js';
import Strata from '../../strata/index.js';
import mapData from '../../strata/maps/topik-i.json' with {type:'json'};
const map=Strata.createMap(mapData);
async function setup(t,options={}){let now=Date.parse('2026-10-02T14:00:00Z');const server=await createLinkedServer({...options,now:()=>now});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  const call=async(route,token,payload)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${route}`,{headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{method:'POST',body:JSON.stringify(payload)}:{})});return {status:r.status,...await r.json()};};
  const teacher=(await call('/api/teacher/session',null,{key:server.ownerKey})).token;
  const join=async()=>{const link=await call('/api/links',teacher,{classId:'class-local',name:'격리 시험 학생'});return call('/api/join',null,{code:link.code,consent:true});};
  const s=await join();
  const assign=async(id)=>{const result=await call('/api/assignments',teacher,{classId:'class-local',learnerIds:[s.learner.id],contentId:id,dueAt:new Date(now+86400000).toISOString(),reason:'콘텐츠별 실제 수행 확인',idempotencyKey:'assign-'+id});assert.equal(result.status,200,JSON.stringify(result));return result.assignment;};
  return {server,call,teacher,s,join,assign,advance:()=>++now,get now(){return now;}};
}
const targets=new WeakMap();
function coachFor(c,f){const values=new Map(),coach=Game.createGame({gameId:c.gameId,map,storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},clock:()=>new Date(f.advance()).toISOString()});targets.set(coach,f.server.snapshot().learningRuns?.filter(r=>r.gameId===c.gameId).at(-1)?.target);return coach;}
function answer(coach,c,index,{help=false,audio=true,confounded=false,same=false}={}){const profile=gameProfiles(c)[0],pool=targets.get(coach)?.items||gameItems(c).filter(m=>m.skillId===profile.skillIds[0]&&m.difficulty===profile.difficulty),unique=[...new Map(pool.map(m=>[m.familyKey,m])).values()],m=unique[same?0:index]||gameItems(c).find(m=>!unique.some(u=>u.familyKey===m.familyKey));assert(m,'Test requires an authored question');const p=coach.present({id:m.itemKey,...m,audioRequired:c.modality==='listening',confounded});if(audio&&c.modality==='listening')coach.delivery(p,{audio:'completed'});if(help)coach.help(p,'hint');return coach.answer(p,{correct:index!==1,assessable:true});}
for(const c of GAME_CONTENT)test(`${c.id}: assignment → owned run → 3 actual Atlas answers → teacher result`,async t=>{
  const f=await setup(t),a=await f.assign(c.id),start=await f.call('/api/world/runs/start',f.s.token,{assignmentId:a.id,revision:a.revision,idempotencyKey:'start'});assert.equal(start.status,200);assert.equal(start.run.gameId,c.gameId);
  const coach=coachFor(c,f);for(let i=0;i<3;i++)answer(coach,c,i,{help:i===2});
  const payload={revision:2,runId:start.run.id,events:coach.events()},posted=await f.call('/api/world/learning',f.s.token,payload);assert.equal(posted.status,200,JSON.stringify(posted));
  await f.call('/api/world/learning',f.s.token,payload);
  const student=await f.call('/api/student',f.s.token),result=student.assignments[0];assert.equal(result.run.status,'completed');assert.equal(result.submission.total,3);assert.equal(result.submission.correct,2);assert.equal(result.submission.assisted,1);assert.equal(result.submission.independent,2);
  const teacher=await f.call('/api/workspace',f.teacher);assert.equal(teacher.analytics.completed,1);assert.equal(teacher.classes[0].learners[0].evidence.length,3);assert.equal(f.server.snapshot().submissions.length,1);
});
test('backlog and another learner cannot claim a new run; ownership cannot change',async t=>{
  const f=await setup(t),c=GAME_CONTENT.find(c=>c.id==='entry-reading'),coach=coachFor(c,f);answer(coach,c,0);const old=coach.events();await f.call('/api/world/learning',f.s.token,{revision:2,events:old});f.advance();
  const start=await f.call('/api/world/runs/start',f.s.token,{contentId:c.id,revision:2,idempotencyKey:'new'}),other=await f.join();
  assert.equal((await f.call('/api/world/learning',f.s.token,{revision:2,runId:start.run.id,events:old})).code,'EVENT_RUN_CONFLICT');
  const fresh=coachFor(c,f);answer(fresh,c,2);assert.equal((await f.call('/api/world/learning',other.token,{revision:2,runId:start.run.id,events:fresh.events()})).status,403);
});
test('foreign game and cross-run presentation/answer cannot complete a task',async t=>{
  const f=await setup(t),c=GAME_CONTENT.find(c=>c.id==='entry-reading'),a=await f.assign(c.id),run=(await f.call('/api/world/runs/start',f.s.token,{assignmentId:a.id,revision:1,idempotencyKey:'r'})).run;
  const foreign=coachFor(GAME_CONTENT[0],f);answer(foreign,GAME_CONTENT[0],0);assert.equal((await f.call('/api/world/learning',f.s.token,{revision:2,runId:run.id,events:foreign.events()})).code,'WRONG_RUN_CONTENT');
  const coach=coachFor(c,f);answer(coach,c,0);const events=coach.events(),pre=events.filter(e=>['decision.made','practice.presented'].includes(e.type)),post=events.filter(e=>!pre.includes(e));
  assert.equal((await f.call('/api/world/learning',f.s.token,{revision:2,events:pre})).status,200);assert.equal((await f.call('/api/world/learning',f.s.token,{revision:2,runId:run.id,events:post})).status,200);
  assert.equal((await f.call('/api/student',f.s.token)).assignments[0].run.progress.total,0);
});
test('repeated family, failed audio, and motor evidence cannot manufacture completion',async t=>{
  const f=await setup(t),c=GAME_CONTENT.find(c=>c.id==='runner-listening'),a=await f.assign(c.id),run=(await f.call('/api/world/runs/start',f.s.token,{assignmentId:a.id,revision:1,idempotencyKey:'r'})).run,coach=coachFor(c,f);
  answer(coach,c,0);answer(coach,c,1,{same:true});answer(coach,c,2,{audio:false});answer(coach,c,3,{confounded:true});
  await f.call('/api/world/learning',f.s.token,{revision:2,runId:run.id,events:coach.events()});const result=(await f.call('/api/student',f.s.token)).assignments[0];assert.equal(result.completed,false);assert.equal(result.run.progress.total,1);assert.equal(result.run.progress.excluded,2);
});
test('cancelled and revised runs drain queued records but never resurrect assignment completion',async t=>{
  for(const action of ['cancel','update']){const f=await setup(t),c=GAME_CONTENT.find(c=>c.id==='entry-reading'),a=await f.assign(c.id),run=(await f.call('/api/world/runs/start',f.s.token,{assignmentId:a.id,revision:1,idempotencyKey:'r'})).run,coach=coachFor(c,f);for(let i=0;i<3;i++)answer(coach,c,i);
    await f.call('/api/assignments/'+action,f.teacher,{assignmentId:a.id,revision:1,reason:'변경'});assert.equal((await f.call('/api/world/learning',f.s.token,{revision:2,runId:run.id,events:coach.events()})).status,200);assert.equal(f.server.snapshot().submissions.length,0);assert.equal((await f.call('/api/student',f.s.token)).activeRun,null);
  }
});
test('readings are downloaded into the same Atlas history without doubling teacher evidence',async t=>{
  const f=await setup(t);const r=await f.call('/api/world/practice',f.s.token,{contentId:'reading-detail',revision:2,answers:{'detail-open':'a','detail-books':'a','detail-return':'a'},idempotencyKey:'reading'});assert.equal(r.status,200);
  const log=await f.call('/api/world/learning?revision=2',f.s.token);assert.equal(log.events.filter(e=>e.type==='practice.attempted').length,3);
  const c=coachFor(GAME_CONTENT.find(c=>c.id==='entry-reading'),f);c.syncPort.importEvents(log.events);assert.equal(c.summary().skills.find(s=>s.id==='ko.reading.detail').n,3);
  assert.equal((await f.call('/api/world/learning',f.s.token,{revision:2,events:log.events})).status,200);assert.equal((await f.call('/api/workspace',f.teacher)).classes[0].learners[0].evidence.length,3);
  const fake={...log.events.find(e=>e.type==='practice.attempted'),id:'new-client-attempt'};assert.equal((await f.call('/api/world/learning',f.s.token,{revision:2,events:[fake]})).code,'SERVER_EVIDENCE_REQUIRED');
});
test('coaching and recommendations use current consent and never turn unseen skills into weakness',async t=>{
  const f=await setup(t);const w=await f.call('/api/student',f.s.token);assert.deepEqual([...new Set(w.content.filter(c=>c.kind==='game').map(c=>c.gameId))].sort(),['blank-slice','entry-check','korean-racing','korean-rhythm','korean-runner','order-rush','story-classroom','synk-town']);assert.equal(w.coaching.basedOn.length,0);assert.match(w.coaching.summary,/부족/);
  await f.call('/api/world/sharing',f.s.token,{revision:2,enabled:false});const off=await f.call('/api/student',f.s.token);assert.equal(off.coaching.next.length,0);assert.equal(off.activeRun,null);
});
test('closing and resuming an assignment preserves partial work while lost start retries do not revive a closed run',async t=>{
  const f=await setup(t),c=GAME_CONTENT.find(c=>c.id==='entry-reading'),a=await f.assign(c.id),payload={assignmentId:a.id,revision:1,idempotencyKey:'start'},start=await f.call('/api/world/runs/start',f.s.token,payload),coach=coachFor(c,f);answer(coach,c,0);
  await f.call('/api/world/learning',f.s.token,{revision:2,runId:start.run.id,events:coach.events()});
  assert.equal((await f.call('/api/world/runs/start',f.s.token,payload)).run.id,start.run.id);
  await f.call('/api/world/runs/stop',f.s.token,{runId:start.run.id});assert.equal((await f.call('/api/world/runs/start',f.s.token,payload)).code,'RUN_ENDED');
  const resumed=await f.call('/api/world/runs/start',f.s.token,{...payload,idempotencyKey:'resume'});assert.equal(resumed.run.id,start.run.id);assert.equal(resumed.run.progress.total,1);
  for(let i=1;i<3;i++)answer(coach,c,i);await f.call('/api/world/learning',f.s.token,{revision:2,runId:start.run.id,events:coach.events()});assert.equal((await f.call('/api/student',f.s.token)).assignments[0].submission.total,3);
});

test('ending class membership rejects learner APIs even if a session and consent still exist',async t=>{
  const first=await setup(t),state=first.server.snapshot();state.classes[0].learnerIds=[];const f=await setup(t,{state});
  for(const [route,payload] of [['/api/student'],['/api/world/account'],['/api/world/learning?revision=2'],['/api/world/runs/start',{contentId:'entry-reading',revision:2,idempotencyKey:'forbidden'}],['/api/world/sharing',{revision:2,enabled:false}]])assert.equal((await f.call(route,first.s.token,payload)).status,403,route);
  assert.equal(f.server.snapshot().learningRuns?.length||0,0);
});

test('an older unfinished run without a target cannot resume as a targeted task',async t=>{
  const first=await setup(t),a=await first.assign('entry-reading');
  const old=(await first.call('/api/world/runs/start',first.s.token,{assignmentId:a.id,revision:1,idempotencyKey:'old-start'})).run;
  const state=first.server.snapshot();delete state.learningRuns[0].target;delete state.assignments[0].targets;
  const f=await setup(t,{state});
  assert.equal((await f.call('/api/student',first.s.token)).activeRun,null);
  assert.equal((await f.call('/api/world/runs/start',first.s.token,{assignmentId:a.id,revision:1,idempotencyKey:'old-start'})).code,'RUN_ENDED');
  const fresh=await f.call('/api/world/runs/start',first.s.token,{assignmentId:a.id,revision:1,idempotencyKey:'new-target-start'});
  assert.equal(fresh.status,200);assert.notEqual(fresh.run.id,old.id);assert.ok(fresh.run.target.items.length);assert.equal(fresh.run.progress.total,0);
  assert.equal(f.server.snapshot().learningRuns.find(r=>r.id===old.id).status,'stopped');
});
