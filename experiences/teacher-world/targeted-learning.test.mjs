import test from 'node:test';
import assert from 'node:assert/strict';
import {createLinkedServer} from './linked-server.mjs';
import {GAME_CONTENT,gameItems} from './game-catalog.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../korean-runner/listening-check.mjs';
import {READING_CHECKS,readingMetadata} from '../synk-town/understanding.mjs';
import Game from '../../atlas/game-learning.js';
import Strata from '../../strata/index.js';
import mapData from '../../strata/maps/topik-i.json' with {type:'json'};
const map=Strata.createMap(mapData),START=Date.parse('2026-10-02T18:00:00Z');
const content=id=>GAME_CONTENT.find(c=>c.id===id);
const tuple=x=>[x.skillId,x.difficulty,x.responseFormat,x.modality];

async function fixture(t){
  let now=START,key=0;const server=await createLinkedServer({now:()=>now});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(route,token,payload)=>{const r=await fetch(origin+route,{method:payload?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});return {status:r.status,...await r.json()};};
  const teacher=(await call('/api/teacher/session',null,{key:server.ownerKey})).token;
  const join=async name=>{const link=await call('/api/links',teacher,{classId:'class-local',name});assert.equal(link.status,200);const student=await call('/api/join',null,{code:link.code,consent:true});assert.equal(student.status,200);return student;};
  const assign=async(student,contentId,extra={})=>{const r=await call('/api/assignments',teacher,{classId:'class-local',learnerIds:[student.learner.id],contentId,dueAt:new Date(now+86400000).toISOString(),reason:'격리 시험: 이 학생의 목표를 실제 출제에 연결',idempotencyKey:`assignment-${++key}`,...extra});assert.equal(r.status,200,JSON.stringify(r));return r.assignment;};
  const start=async(student,assignment)=>{const r=await call('/api/world/runs/start',student.token,{assignmentId:assignment.id,revision:assignment.revision,idempotencyKey:`run-${++key}`});assert.equal(r.status,200,JSON.stringify(r));return r.run;};
  const view=async student=>(await call('/api/workspace',teacher)).classes.flatMap(c=>c.learners).find(l=>l.id===student.learner.id);
  return {server,call,teacher,join,assign,start,view,clock:()=>new Date(++now).toISOString(),get now(){return now;}};
}
function coach(f,gameId){const memory=new Map();return Game.createGame({gameId,map,storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},clock:f.clock});}
function respond(c,m,{correct=true,help=false,audio=true,confounded=false}={}){const p=c.present({id:m.itemKey,...m,audioRequired:m.modality==='listening',confounded});if(m.modality==='listening'&&audio)c.delivery(p,{audio:'completed'});if(help)c.help(p,'hint');return c.answer(p,{correct,assessable:true});}
async function upload(f,s,c,run){return f.call('/api/world/learning',s.token,{revision:s.sharing.revision,...(run?{runId:run.id}:{}),events:c.events()});}
async function seed(f,s,{modality,correct,count=4,help=false,skill='detail',suffix='history'}){
  const c=coach(f,modality==='listening'?'korean-racing':'entry-check');
  for(let i=0;i<count;i++){const key=`qa-${modality}-${skill}-${suffix}-${s.learner.id}-${i}`;respond(c,{itemKey:key,familyKey:key,skillId:`ko.${modality}.${skill}`,difficulty:1,responseFormat:'single-choice',modality},{correct,help});}
  const r=await upload(f,s,c);assert.equal(r.status,200,JSON.stringify(r));
}
function assertTarget(target,c){
  assert.ok(target,'a real authored target is required');assert.ok(target.items?.length>0);assert.equal(target.requiredAttempts,new Set(target.items.map(m=>m.familyKey)).size);
  const authored=gameItems(c),pool=authored.filter(m=>JSON.stringify(tuple(m))===JSON.stringify(tuple(target)));
  assert.equal(target.requiredAttempts,Math.min(3,new Set(pool.map(m=>m.familyKey)).size));
  assert.deepEqual(new Set(target.familyKeys),new Set(target.items.map(m=>m.familyKey)));assert.deepEqual(new Set(target.itemKeys),new Set(target.items.map(m=>m.itemKey)));
  for(const item of target.items)assert.ok(pool.some(m=>m.familyKey===item.familyKey&&m.itemKey===item.itemKey),'target must use an authored family/item pair');
  assert.equal(target.freshCount+target.reviewCount,target.requiredAttempts);
}

test('actual Atlas histories produce opposite listening/reading targets and preserve missing and assisted evidence',async t=>{
  const f=await fixture(t),a=await f.join('듣기 기록 충분·읽기 추가 연습'),b=await f.join('읽기 기록 충분·듣기 추가 연습'),empty=await f.join('아직 기록 없음'),helped=await f.join('도움과 함께 읽기');
  await seed(f,a,{modality:'listening',correct:true});await seed(f,a,{modality:'reading',correct:false,count:3});
  await seed(f,b,{modality:'reading',correct:true});await seed(f,b,{modality:'listening',correct:false,count:3});
  await seed(f,helped,{modality:'reading',skill:'negation',correct:true,count:3,help:true});
  const av=await f.view(a),bv=await f.view(b),ev=await f.view(empty),hv=await f.view(helped);
  assert.equal(av.recommendation.skillId,'ko.reading.detail');assert.equal(av.recommendation.state,'practice',JSON.stringify({recommendation:av.recommendation,skill:av.skills.find(s=>s.id==='ko.reading.detail')}));
  assert.equal(bv.recommendation.skillId,'ko.listening.detail');assert.equal(bv.recommendation.state,'practice');
  assert.equal(av.skills.find(s=>s.id==='ko.listening.detail').status,'recent-independent');assert.equal(bv.skills.find(s=>s.id==='ko.reading.detail').status,'recent-independent');
  assert.ok(ev.skills.every(s=>s.n===0&&s.status==='unseen'));assert.equal(ev.recommendation.state,'unseen');assert.equal(ev.grade,null);
  const helpedSkill=hv.skills.find(s=>s.id==='ko.reading.negation');assert.equal(helpedSkill.n,0);assert.equal(helpedSkill.assisted,3);assert.equal(helpedSkill.status,'supported');assert.equal(hv.recommendation.skillId,'ko.reading.negation');
  for(const v of [av,bv,ev,hv])assert.equal(v.learningEffectClaim,false);
});

for(const id of GAME_CONTENT.map(c=>c.id))test(`${id}: teacher target uses authored capacity, reaches owned run and only its items complete`,async t=>{
  const f=await fixture(t),s=await f.join('목표별 수행 학생'),c=content(id),a=await f.assign(s,id),target=a.targets?.[s.learner.id];assertTarget(target,c);
  const run=await f.start(s,a);assert.deepEqual(run.target,target);assert.equal(run.requiredAttempts,target.requiredAttempts);
  const before=await f.call('/api/student',s.token);assert.deepEqual(before.assignments.find(x=>x.id===a.id).target,target);
  const game=coach(f,c.gameId),base={...target.items[0],skillId:target.skillId,difficulty:target.difficulty,responseFormat:target.responseFormat,modality:target.modality};
  respond(game,{...base,itemKey:'qa-invented-item',familyKey:'qa-invented-family'});assert.equal((await upload(f,s,game,run)).status,200);
  let inbox=await f.call('/api/student',s.token);assert.equal(inbox.assignments[0].run.progress.total,0);assert.equal(inbox.assignments[0].completed,false);
  const uniqueItems=[...new Map(target.items.map(m=>[m.familyKey,m])).values()];
  for(const [i,item]of uniqueItems.entries())respond(game,{...base,...item},{correct:i!==1,help:i===uniqueItems.length-1});
  const sent=await upload(f,s,game,run);assert.equal(sent.status,200,JSON.stringify(sent));assert.equal((await upload(f,s,game,run)).status,200);
  inbox=await f.call('/api/student',s.token);const own=inbox.assignments.find(x=>x.id===a.id);assert.equal(own.completed,true);assert.equal(own.submission.total,target.requiredAttempts);assert.equal(own.submission.assisted,1);assert.equal(own.submission.grading,'game-reported');assert.equal(own.submission.learningEffectClaim,false);
  assert.ok(own.submission.results.every(r=>target.itemKeys.includes(r.itemKey)));assert.equal(f.server.snapshot().submissions.filter(x=>x.assignmentId===a.id).length,1);
  const teacher=await f.call('/api/workspace',f.teacher);assert.equal(teacher.assignments.find(x=>x.id===a.id).completedCount,1);
});

test('wrong skill, level, response format and authored but unselected pair cannot fill the target',async t=>{
  const f=await fixture(t),s=await f.join('목표 외 기록 제외'),a=await f.assign(s,'entry-reading'),run=await f.start(s,a),target=run.target;
  const base={...target.items[0],skillId:target.skillId,difficulty:target.difficulty,responseFormat:target.responseFormat,modality:target.modality};
  const mutations=[{skillId:target.skillId.endsWith('.negation')?'ko.reading.detail':'ko.reading.negation'},{difficulty:target.difficulty===3?1:3},{responseFormat:'binary-choice'},{itemKey:'qa-unselected-item'},{familyKey:'qa-unselected-family'}];
  for(const change of mutations){const game=coach(f,run.gameId);respond(game,{...base,...change});assert.equal((await upload(f,s,game,run)).status,200);}
  const pair=gameItems(content('entry-reading')).find(m=>!target.itemKeys.includes(m.itemKey));if(pair){const game=coach(f,run.gameId);respond(game,pair);assert.equal((await upload(f,s,game,run)).status,200);}
  const own=(await f.call('/api/student',s.token)).assignments[0];assert.equal(own.run.progress.total,0);assert.equal(own.completed,false);assert.ok(own.run.progress.excluded>=mutations.length);
});

test('repeating one family and unplayed listening cannot replace the remaining authored questions',async t=>{
  const f=await fixture(t),s=await f.join('듣기 중복 기록 확인'),a=await f.assign(s,'runner-listening',{target:{skillId:'ko.listening.detail',difficulty:1,responseFormat:'single-choice'}}),run=await f.start(s,a),target=run.target;assert.ok(target.requiredAttempts>=2);
  const game=coach(f,run.gameId),first={...target.items[0],skillId:target.skillId,difficulty:target.difficulty,responseFormat:target.responseFormat,modality:target.modality};
  respond(game,first);respond(game,first);respond(game,{...first,...target.items[1]},{audio:false});await upload(f,s,game,run);
  let own=(await f.call('/api/student',s.token)).assignments[0];assert.equal(own.run.progress.total,1);assert.equal(own.completed,false);
  for(const item of target.items.slice(1))respond(game,{...first,...item});await upload(f,s,game,run);
  own=(await f.call('/api/student',s.token)).assignments[0];assert.equal(own.completed,true);assert.equal(own.submission.total,target.requiredAttempts);
});

test('a second assignment chooses unseen families before review while the first target remains fixed',async t=>{
  const f=await fixture(t),s=await f.join('새 문항으로 확인'),request={target:{skillId:'ko.listening.detail',difficulty:1,responseFormat:'single-choice'}},a=await f.assign(s,'runner-listening',request),run=await f.start(s,a),game=coach(f,run.gameId);
  const fixed=structuredClone(run.target);for(const item of fixed.items)respond(game,{...item,skillId:fixed.skillId,difficulty:fixed.difficulty,responseFormat:fixed.responseFormat,modality:fixed.modality});await upload(f,s,game,run);
  const next=await f.assign(s,'runner-listening',request),target=next.targets[s.learner.id],pool=gameItems(content('runner-listening')).filter(m=>JSON.stringify(tuple(m))===JSON.stringify(tuple(fixed))),unseen=new Set(pool.filter(m=>!fixed.familyKeys.includes(m.familyKey)).map(m=>m.familyKey));
  assert.ok(unseen.size>0,'expanded runner needs fresh follow-up families');assert.equal(target.freshCount,Math.min(target.requiredAttempts,unseen.size));assert.equal(target.items.filter(i=>unseen.has(i.familyKey)).length,target.freshCount);
  const inbox=await f.call('/api/student',s.token);assert.deepEqual(inbox.assignments.find(x=>x.id===a.id).target,fixed);
});

test('new independent families change the recommendation but repeated right answers never erase first errors',async t=>{
  const f=await fixture(t),s=await f.join('독립 새 문항 변화'),c=coach(f,'entry-check');
  const metadata=i=>({itemKey:`qa-transfer-${i}`,familyKey:`qa-transfer-${i}`,skillId:'ko.reading.detail',difficulty:1,responseFormat:'single-choice',modality:'reading'});
  for(let i=0;i<3;i++)respond(c,metadata(i),{correct:false});await upload(f,s,c);assert.equal((await f.view(s)).recommendation.skillId,'ko.reading.detail');
  for(let i=0;i<3;i++)respond(c,metadata(i),{correct:true});await upload(f,s,c);let row=(await f.view(s)).skills.find(x=>x.id==='ko.reading.detail');assert.equal(row.n,3);assert.equal(row.incorrect,3);assert.equal(row.status,'practice');
  for(let i=3;i<16;i++)respond(c,metadata(i),{correct:true});await upload(f,s,c);const after=await f.view(s);row=after.skills.find(x=>x.id==='ko.reading.detail');assert.equal(row.status,'recent-independent');assert.notDeepEqual([after.recommendation.skillId,after.recommendation.difficulty,after.recommendation.responseFormat],['ko.reading.detail',1,'single-choice']);
});

test('different learner, withdrawn sharing and changed assignment cannot inherit or finish an owned target',async t=>{
  const f=await fixture(t),a=await f.join('본인'),b=await f.join('다른 학생'),assignment=await f.assign(a,'town-reading'),run=await f.start(a,assignment),game=coach(f,run.gameId),target=run.target;
  for(const item of target.items)respond(game,{...item,skillId:target.skillId,difficulty:target.difficulty,responseFormat:target.responseFormat,modality:target.modality});
  assert.equal((await upload(f,b,game,run)).status,403);assert.equal((await f.call('/api/world/runs/start',b.token,{assignmentId:assignment.id,revision:1,idempotencyKey:'foreign'})).status,403);assert.equal((await f.call('/api/student',b.token)).assignments.length,0);
  await f.call('/api/assignments/update',f.teacher,{assignmentId:assignment.id,revision:1,title:'새 버전 과제'});await upload(f,a,game,run);assert.equal(f.server.snapshot().submissions.length,0);
  const withdrawn=await f.call('/api/world/sharing',a.token,{revision:a.sharing.revision,enabled:false});assert.equal(withdrawn.status,200);assert.equal((await upload(f,a,game,run)).status,403);assert.equal((await f.call('/api/student',a.token)).activeRun,null);
});

test('expanded runner and Town source questions independently provide at least three real families per included goal',()=>{
  for(const [items,metadata]of [[LISTENING_CHECKS,checkMetadata],[READING_CHECKS,readingMetadata]]){
    const groups=new Map();for(const item of items){assert.ok(item.choices.length>=2);assert.ok(Number.isInteger(item.correct)&&item.choices[item.correct]);const m=metadata(item),key=JSON.stringify(tuple(m));if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(m.familyKey);}
    assert.ok(groups.size>=3);for(const [key,families]of groups)assert.ok(families.size>=3,`${key} needs three independently authored questions`);
  }
});

test('one class assignment freezes distinct student targets without exposing another learner target in the student API',async t=>{
  const f=await fixture(t),a=await f.join('읽기 세부 확인'),b=await f.join('읽기 부정 확인');
  await seed(f,a,{modality:'reading',skill:'detail',correct:false,count:3});await seed(f,b,{modality:'reading',skill:'negation',correct:false,count:3});
  const assignment=await f.assign(a,'town-reading',{learnerIds:[a.learner.id,b.learner.id]});
  assert.equal(assignment.targets[a.learner.id].skillId,'ko.reading.detail');assert.equal(assignment.targets[b.learner.id].skillId,'ko.reading.negation');
  for(const s of [a,b]){const own=(await f.call('/api/student',s.token)).assignments[0];assert.deepEqual(own.target,assignment.targets[s.learner.id]);assert.equal(Object.hasOwn(own,'targets'),false);assert.equal(Object.hasOwn(own,'learnerIds'),false);}
  assert.equal((await f.start(a,assignment)).target.skillId,'ko.reading.detail');assert.equal((await f.start(b,assignment)).target.skillId,'ko.reading.negation');
});

test('invalid target tuples are rejected atomically and retries cannot silently change a teacher target',async t=>{
  const f=await fixture(t),s=await f.join('목표 고정 검증'),payload={classId:'class-local',learnerIds:[s.learner.id],contentId:'town-reading',dueAt:new Date(f.now+86400000).toISOString(),reason:'교사 선택 검증',idempotencyKey:'fixed-target',target:{skillId:'ko.reading.detail',difficulty:1,responseFormat:'single-choice'}};
  const first=await f.call('/api/assignments',f.teacher,payload);assert.equal(first.status,200);
  assert.equal((await f.call('/api/assignments',f.teacher,payload)).assignment.id,first.assignment.id);
  assert.equal((await f.call('/api/assignments',f.teacher,{...payload,target:{...payload.target,skillId:'ko.reading.negation'}})).code,'IDEMPOTENCY_CONFLICT');
  for(const target of [{skillId:'ko.listening.detail',difficulty:1,responseFormat:'single-choice'},{skillId:'ko.reading.detail',difficulty:9,responseFormat:'single-choice'},{skillId:'ko.reading.detail',difficulty:1,responseFormat:'arbitrary'}]){
    const r=await f.call('/api/assignments',f.teacher,{...payload,idempotencyKey:'invalid-'+target.skillId+'-'+target.difficulty+'-'+target.responseFormat,target});assert.equal(r.status,400);assert.equal(r.code,'INVALID_TARGET');
  }
  assert.equal(f.server.snapshot().assignments.length,1);
  const run=await f.call('/api/world/runs/start',s.token,{assignmentId:first.assignment.id,revision:1,idempotencyKey:'malicious-target',target:{skillId:'ko.reading.negation',difficulty:1,responseFormat:'single-choice',familyKeys:['invented']}});assert.equal(run.status,200);assert.deepEqual(run.run.target,first.assignment.targets[s.learner.id]);
});
