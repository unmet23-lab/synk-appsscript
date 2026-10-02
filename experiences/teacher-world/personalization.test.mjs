import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createDemoState,DEMO_TEACHER,demoLearnerActor} from './fixtures.mjs';
import {getWorkspace,getStudentWorkspace,createAssignment,migrateTeacherState,getPersonalization,updatePersonalization,completePersonalization,feedbackPersonalization} from './model.mjs';
import {createTeacherServer} from './server.mjs';

const NOW=Date.parse('2026-10-02T03:00:00.000Z'),options={now:NOW};
const nara=demoLearnerActor('demo-nara'),bora=demoLearnerActor('demo-bora');
const other=Object.freeze({id:'teacher-other',role:'teacher',mode:'demo'});
const state=()=>createDemoState(options);
const read=(s,actor=DEMO_TEACHER)=>getPersonalization(s,actor,options);
const save=(s,answers={},actor=DEMO_TEACHER)=>updatePersonalization(s,actor,{action:'save',revision:read(s,actor).revision,consent:true,answers},options).personalization;
const action=(s,type,actor=DEMO_TEACHER)=>updatePersonalization(s,actor,{action:type,revision:read(s,actor).revision},options).personalization;
const fails=(run,code)=>assert.throws(run,error=>error.code===code);

test('old saved state migrates without resetting assignments, evidence, counters or its caller',()=>{
  const old=state();delete old.personalization;
  createAssignment(old,DEMO_TEACHER,{classId:'class-morning',learnerIds:['demo-nara'],contentId:'reading-detail',dueAt:new Date(NOW+86400000).toISOString()},options);
  const before=structuredClone(old),migrated=migrateTeacherState(old);
  assert.deepEqual(old,before);assert.deepEqual(migrated,{...before,personalization:{version:1,records:{}}});
  assert.equal(getWorkspace(migrated,DEMO_TEACHER,options).assignments.length,1);
  assert.equal(read(migrated).status,'new');
  fails(()=>migrateTeacherState({...old,personalization:{version:2,records:{}}}),'STATE_VERSION');
});

test('consent and supported enum values are required before remembering any preferences',()=>{
  const s=state(),original=structuredClone(s);
  fails(()=>updatePersonalization(s,DEMO_TEACHER,{action:'save',revision:0,answers:{support:'individual'}},options),'CONSENT_REQUIRED');
  fails(()=>save(s,{experience:'expert-scored'}),'INVALID_PERSONALIZATION');
  fails(()=>save(s,{studentAbility:'beginner'}),'INVALID_PERSONALIZATION');
  fails(()=>save(s,{sessionMinutes:20}),'INVALID_PERSONALIZATION');
  assert.deepEqual(s,original);
});

test('declared teacher context changes lesson allocation, dashboard action and real assignment templates',()=>{
  const s=state();
  const p=save(s,{goal:'daily',classFormat:'individual',sessionMinutes:'20',preparationMinutes:'5',experience:'practiced',support:'individual',detail:'detailed',textSize:'large',motion:'reduced'});
  assert.equal(p.status,'active');assert.equal(p.benefit.suggestedView,'assignments');
  assert.equal(p.benefit.defaultAssignmentDays,1);assert.equal(p.presentation.textSize,'large');
  assert.equal(p.presentation.motion,'reduced');
  assert.ok(p.lessonPlans.every(plan=>plan.minutes===20&&plan.preparationMinutes===5&&plan.steps.reduce((sum,step)=>sum+step.minutes,0)===20));
  assert.match(p.lessonPlans[0].steps[0].description,/생활/);
  assert.match(p.lessonPlans[0].steps[1].description,/준비된 읽기 활동/);
  assert.ok(p.assignmentTemplates.every(template=>template.defaultAssignmentDays===1&&template.reason.includes('핵심 낱말')));
  assert.ok(!p.assignmentTemplates.some(template=>template.learnerId==='demo-bora'),'unconnected listening must not be assigned as reading');
  const template=p.assignmentTemplates.find(row=>row.learnerId==='demo-nara');
  const made=createAssignment(s,DEMO_TEACHER,{...template,learnerIds:[template.learnerId],dueAt:new Date(NOW+86400000).toISOString()},options);
  assert.equal(made.assignment.reason,template.reason);
  assert.equal(s.personalization.records['teacher:teacher-demo'].profile.provenance.experience.source,'self-declared');
});

test('GETs and returned objects cannot change stored settings or generate fresh decision IDs',()=>{
  const s=state(),first=save(s,{support:'explanation'}),before=structuredClone(s);
  assert.ok(first.decisionId);assert.equal(first.benefit.suggestedView,'review');
  for(let i=0;i<4;i++)assert.equal(getWorkspace(s,DEMO_TEACHER,options).personalization.decisionId,first.decisionId);
  assert.deepEqual(s,before);
  const response=read(s);response.answers.goal='invalid';response.lessonPlans[0].learnerIds.length=0;
  assert.deepEqual(s,before);
});

test('teacher plans remain in own classes and personal answers never cross into another person',()=>{
  const s=state();save(s,{support:'explanation',textSize:'large'});save(s,{support:'individual'},other);save(s,{audio:'off',textSize:'large'},nara);
  const p=read(s,other);assert.deepEqual(p.lessonPlans.map(row=>row.classId),['class-evening']);
  assert.ok(p.assignmentTemplates.every(row=>row.learnerId==='demo-roan'));
  assert.equal(read(s,bora).status,'new');assert.equal(read(s,other).answers.textSize,undefined);assert.equal(read(s,other).presentation.textSize,'standard');
  const teacher=getWorkspace(s,DEMO_TEACHER,options);
  assert.ok(teacher.classes.flatMap(row=>row.learners).every(row=>!Object.hasOwn(row,'personalization')));
  assert.ok(!JSON.stringify(teacher).includes('"audio":"off"'));
  fails(()=>getPersonalization(s,{...DEMO_TEACHER,id:'not-fixture'},options),'FORBIDDEN');
  fails(()=>getPersonalization({...s,mode:'live'},DEMO_TEACHER,options),'AUTH_NOT_CONFIGURED');
  const before=structuredClone(s);
  fails(()=>updatePersonalization(s,nara,{action:'clear',revision:read(s,nara).revision,learnerId:'demo-bora'},options),'FORBIDDEN');
  assert.deepEqual(s,before);
});

test('student time and sound settings constrain candidates without inventing or changing skill evidence',()=>{
  const s=state(),before=getWorkspace(s,DEMO_TEACHER,options),evidence=structuredClone(s.learners);
  const quiet=save(s,{audio:'off',availableMinutes:'3',preference:'independent'},bora);
  assert.ok(quiet.recommendations.length);assert.ok(quiet.recommendations.every(row=>row.modality==='reading'));
  assert.match(quiet.benefit.reason,/소리가 필요 없는/);
  assert.match(quiet.explanation.evidence,/조작 점수/);
  assert.deepEqual(s.learners,evidence);
  assert.deepEqual(getWorkspace(s,DEMO_TEACHER,options).classes,before.classes);
  const audible=save(s,{audio:'available',availableMinutes:'5'},bora);
  assert.equal(audible.recommendations[0].contentId,'racing-listening');
  assert.equal(getStudentWorkspace(s,bora,options).personalization.answers.audio,'available');
});

test('unanswered fields remain unknown rather than becoming self-declared defaults',()=>{
  const s=state(),p=save(s,{support:'individual'}),record=s.personalization.records['teacher:teacher-demo'];
  assert.deepEqual(p.answers,{support:'individual'});
  assert.deepEqual(record.profile.values,{goal:'study',support:'independent'});
  assert.deepEqual(Object.keys(record.profile.provenance).sort(),['goal','support']);
  assert.equal(p.lessonPlans[0].minutes,40,'execution can use a documented fallback without claiming the person answered it');
  const empty=save(s,{});assert.deepEqual(empty.answers,{});assert.deepEqual(s.personalization.records['teacher:teacher-demo'].profile.values,{});
  assert.deepEqual(s.personalization.records['teacher:teacher-demo'].profile.provenance,{});
});

test('explicit independent guidance changes the selected method and actual steps even for a TOPIK goal',()=>{
  const s=state(),guided=save(s,{goal:'topik',preference:'step'},nara);
  assert.match(guided.benefit.title,/한 단계씩/);
  const independent=save(s,{goal:'topik',preference:'independent'},nara);
  assert.match(independent.benefit.title,/먼저 풀고/);
  assert.match(independent.benefit.steps[0],/먼저 혼자/);
  assert.notDeepEqual(independent.benefit.steps,guided.benefit.steps);
});

test('skip, off and erasure remove preference memory while preserving actual learning work',()=>{
  const s=state();const workBefore=structuredClone(s.learners);
  assert.equal(action(s,'skip').status,'skipped');assert.equal(read(s).decisionId,null);
  const active=save(s,{support:'individual',detail:'detailed'});
  const off=action(s,'disable');assert.equal(off.status,'disabled');assert.equal(off.consent,false);
  assert.deepEqual(off.answers,{});assert.equal(off.benefit.defaultAssignmentDays,3);
  assert.deepEqual(s.personalization.records['teacher:teacher-demo'].events,[]);
  const restored=save(s,{support:'explanation'});assert.notEqual(restored.decisionId,active.decisionId);
  const cleared=action(s,'clear'),record=s.personalization.records['teacher:teacher-demo'];
  assert.equal(cleared.status,'new');assert.deepEqual(record.answers,{});assert.deepEqual(record.profile.values,{});assert.deepEqual(record.profile.provenance,{});assert.deepEqual(record.events,[]);
  assert.equal(record.decision,undefined);assert.equal(record.reasons,undefined);
  assert.deepEqual(s.learners,workBefore);
  fails(()=>updatePersonalization(s,DEMO_TEACHER,{action:'save',revision:active.revision,consent:true,answers:{support:'individual'}},options),'REVISION_CONFLICT');
});

test('feedback requires this persons completed current plan and changes the next approach',()=>{
  const s=state(),p=save(s,{support:'individual'});save(s,{support:'individual'},other);
  fails(()=>feedbackPersonalization(s,DEMO_TEACHER,{revision:p.revision,completionId:'made-up',value:'not_fit'},options),'COMPLETION_REQUIRED');
  fails(()=>completePersonalization(s,DEMO_TEACHER,{revision:p.revision,decisionId:'other-plan'},options),'DECISION_CONFLICT');
  const completed=completePersonalization(s,DEMO_TEACHER,{revision:p.revision,decisionId:p.decisionId},options).personalization;
  assert.ok(completed.completionId);assert.equal(completed.feedbackAllowed,true);
  const otherBefore=structuredClone(s.personalization.records['teacher:teacher-other']);
  const changed=feedbackPersonalization(s,DEMO_TEACHER,{revision:completed.revision,completionId:completed.completionId,value:'not_fit'},options).personalization;
  assert.notEqual(changed.benefit.title,p.benefit.title);assert.notEqual(changed.decisionId,p.decisionId);assert.equal(changed.completionId,null);
  assert.deepEqual(s.personalization.records['teacher:teacher-other'],otherBefore);
  assert.ok(s.personalization.records['teacher:teacher-demo'].events.some(row=>row.type==='feedback.given'));
});

async function serve(t,{state:s=state(),...settings}={}){
  const server=await createTeacherServer({state:s,now:()=>NOW,...settings});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const read=async url=>{const response=await fetch(origin+url);return {status:response.status,data:await response.json()};};
  const token=(await read('/api/workspace')).data._token;
  const post=async(url,body)=>{const response=await fetch(origin+url,{method:'POST',headers:{'Content-Type':'application/json','X-SYNK-Preview-Token':token},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
  return {read,post,origin};
}
test('HTTP owner is fixed by route and student query; posted identity and missing student are refused',async t=>{
  const {read,post}=await serve(t);
  assert.equal((await read('/api/personalization')).data.status,'new');
  assert.equal((await post('/api/personalization',{action:'save',revision:0,consent:true,answers:{support:'individual'},personId:'teacher-other'})).status,403);
  assert.equal((await post('/api/student/personalization',{action:'skip',revision:0,learnerId:'demo-nara'})).status,403);
  assert.equal((await post('/api/student/personalization?learnerId=demo-nara',{action:'skip',revision:0,learnerId:'demo-bora'})).status,403);
  const saved=await post('/api/student/personalization?learnerId=demo-nara',{action:'save',revision:0,consent:true,answers:{audio:'off'}});
  assert.equal(saved.status,200);assert.equal(saved.data.personalization.scope.personId,'demo-nara');
  assert.equal((await read('/api/student?learnerId=demo-bora')).data.personalization.status,'new');
  assert.equal((await read('/api/workspace')).data.personalization.status,'new');
});

test('HTTP persistence retains settings and decision IDs on restart, including migrated old work',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'synk-personalization-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));const persistPath=path.join(directory,'state.json');
  const old=state();delete old.personalization;
  const first=await serve(t,{state:old,persistPath});
  const made=await first.post('/api/personalization',{action:'save',revision:0,consent:true,answers:{sessionMinutes:'60',support:'explanation'}});
  assert.equal(made.status,200);const p=made.data.personalization;
  const persisted=JSON.parse(await fs.readFile(persistPath,'utf8'));assert.deepEqual(persisted.learners,old.learners);
  const second=await serve(t,{state:persisted,persistPath});const loaded=(await second.read('/api/personalization')).data;
  assert.equal(loaded.decisionId,p.decisionId);assert.equal(loaded.answers.sessionMinutes,'60');
  const complete=await second.post('/api/personalization/complete',{revision:loaded.revision,decisionId:loaded.decisionId});
  assert.equal(complete.status,200);const c=complete.data.personalization;
  const feedback=await second.post('/api/personalization/feedback',{revision:c.revision,completionId:c.completionId,value:'not_fit'});
  assert.equal(feedback.status,200);assert.notEqual(feedback.data.personalization.benefit.title,p.benefit.title);
  const cleared=await second.post('/api/personalization',{action:'clear',revision:feedback.data.personalization.revision});
  assert.equal(cleared.data.personalization.status,'new');
  const deleted=JSON.parse(await fs.readFile(persistPath,'utf8')).personalization.records['teacher:teacher-demo'];
  assert.deepEqual(deleted.answers,{});assert.deepEqual(deleted.events,[]);assert.deepEqual(deleted.profile.values,{});
});

test('failed preference persistence cannot change the in-memory plan or lose prior work',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'synk-personalization-failure-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));const file=path.join(directory,'file');await fs.writeFile(file,'x');
  const {read,post}=await serve(t,{persistPath:path.join(file,'state.json')});
  assert.equal((await post('/api/personalization',{action:'save',revision:0,consent:true,answers:{support:'individual'}})).status,500);
  const loaded=(await read('/api/workspace')).data;
  assert.equal(loaded.personalization.status,'new');assert.equal(loaded.personalization.revision,0);assert.equal(loaded.analytics.learners,4);
});

test('concurrent settings writers have one winner and a revision conflict, without silent overwrite',async t=>{
  const {read,post}=await serve(t);
  const results=await Promise.all(['individual','explanation'].map(support=>post('/api/personalization',{action:'save',revision:0,consent:true,answers:{support}})));
  assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
  const winner=results.find(row=>row.status===200).data.personalization;
  assert.deepEqual((await read('/api/workspace')).data.personalization.answers,winner.answers);
});
