import test from 'node:test';
import assert from 'node:assert/strict';
import Learning from '../../atlas/learning.js';
import {createDemoState,DEMO_TEACHER,demoLearnerActor} from './fixtures.mjs';
import {getWorkspace,getStudentWorkspace,createAssignment,updateAssignment,cancelAssignment,submitAssignment,addObservation,CONTENT_CATALOG} from './model.mjs';

const NOW=Date.parse('2026-10-02T03:00:00.000Z'),DAY=86400000,options={now:NOW};
const state=()=>createDemoState(options),learner=id=>demoLearnerActor(id),other=Object.freeze({id:'teacher-other',role:'teacher',mode:'demo'});
const nara=learner('demo-nara'),bora=learner('demo-bora');
const dueAt=new Date(NOW+DAY).toISOString();
const answers={'detail-open':'b','detail-books':'b','detail-return':'c'};
const assign=(s,overrides={})=>createAssignment(s,DEMO_TEACHER,{classId:'class-morning',learnerIds:['demo-nara'],contentId:'reading-detail',dueAt,...overrides},options).assignment;
const submit=(s,a,overrides={},actor=nara)=>submitAssignment(s,actor,{assignmentId:a.id,answers,idempotencyKey:'submit-1',...overrides},options);
const throwsCode=(fn,code)=>assert.throws(fn,error=>error.code===code);
const student=(workspace,id)=>workspace.classes.flatMap(row=>row.learners).find(row=>row.id===id);

test('synthetic fixtures are serializable and existing Core/Strata select different practice from evidence',()=>{
  const s=state(),w=getWorkspace(s,DEMO_TEACHER,options);
  assert.equal(w.mode,'demo');assert.equal(w.synthetic,true);assert.equal(w.analytics.learners,4);
  assert.equal(w.integration.core,Learning.POLICY.version);assert.match(w.integration.strata,/^topik-i-/);
  assert.equal(student(w,'demo-nara').recommendation.contentId,'reading-detail');
  assert.equal(student(w,'demo-bora').recommendation.contentId,'racing-listening');
  assert.equal(student(w,'demo-dami').recommendation.contentId,'reading-negation');
  assert.equal(student(w,'demo-roan').recommendation.contentId,'reading-condition');
  assert.deepEqual(getWorkspace(JSON.parse(JSON.stringify(s)),DEMO_TEACHER,options),w);
  assert.equal(Object.isFrozen(DEMO_TEACHER),true);assert.equal(Object.isFrozen(nara),true);
});

test('game motor scores never establish language proficiency; old and assisted evidence remain distinct',()=>{
  const w=getWorkspace(state(),DEMO_TEACHER,options),dami=student(w,'demo-dami'),roan=student(w,'demo-roan');
  assert.equal(dami.skills.find(row=>row.id==='ko.listening.main').n,0);
  assert.equal(dami.skills.find(row=>row.id==='ko.listening.main').status,'unseen');
  assert.equal(dami.excludedEvidence.length,4);
  assert.equal(dami.skills.find(row=>row.id==='ko.reading.negation').freshness,'review-due');
  assert.equal(roan.skills.find(row=>row.id==='ko.reading.detail').freshness,'stale');
  assert.equal(roan.skills.find(row=>row.id==='ko.reading.condition').n,0);
  assert.equal(roan.skills.find(row=>row.id==='ko.reading.condition').source,'assisted-language-items');
  assert.equal(roan.skills.find(row=>row.id==='ko.reading.condition').freshness,'recent');
  assert.equal(roan.recommendation.supportingEvidence.length,2);
  for(const s of w.classes.flatMap(row=>row.learners)){assert.equal(s.grade,null);assert.equal(s.learningEffectClaim,false);}
});

test('teacher scope derives from trusted state membership and rejects body class escalation',()=>{
  const s=state(),w=getWorkspace(s,{...other,classIds:['class-morning']},options);
  assert.deepEqual(w.classes.map(row=>row.id),['class-evening']);
  assert.equal(w.classes[0].learners[0].id,'demo-roan');
  throwsCode(()=>createAssignment(s,other,{classId:'class-morning',learnerIds:['demo-nara'],contentId:'reading-detail',dueAt},options),'FORBIDDEN');
  throwsCode(()=>assign(s,{learnerIds:['demo-roan']}),'FORBIDDEN');
  throwsCode(()=>getWorkspace(s,nara,options),'FORBIDDEN');
  throwsCode(()=>getWorkspace(s,{id:'unknown',role:'teacher',mode:'demo'},options),'FORBIDDEN');
});

test('live or unconfigured identity paths fail closed without mutating state',()=>{
  const s=state(),original=JSON.stringify(s);
  throwsCode(()=>createAssignment(s,{...DEMO_TEACHER,mode:'live'},{},options),'AUTH_NOT_CONFIGURED');
  throwsCode(()=>getWorkspace({...s,mode:'live'},DEMO_TEACHER,options),'AUTH_NOT_CONFIGURED');
  throwsCode(()=>getWorkspace({...s,synthetic:false},DEMO_TEACHER,options),'AUTH_NOT_CONFIGURED');
  assert.equal(JSON.stringify(s),original);
});

test('create records recommendation provenance and requires a reason for teacher override',()=>{
  const s=state(),initial=JSON.stringify(s);
  throwsCode(()=>assign(s,{contentId:'reading-condition'}),'OVERRIDE_REASON_REQUIRED');
  assert.equal(JSON.stringify(s),initial);
  const a=assign(s,{contentId:'reading-condition',reason:'수업에서 신청 조건을 함께 확인할 예정'});
  assert.equal(a.recommendations[0].teacherOverride,true);
  assert.equal(a.recommendations[0].recommendedContentId,'reading-detail');
  assert.equal(a.recommendations[0].evidence.length,3);
  assert.equal(a.assignedCount,1);assert.equal(a.revision,1);
  assert.equal(s.audit[0].action,'assignment.created');
});

test('empty optional reason is accepted for the recommended activity and for cancellation',()=>{
  const s=state(),a=assign(s,{reason:''});assert.equal(a.reason,'');
  assert.equal(cancelAssignment(s,DEMO_TEACHER,{assignmentId:a.id,reason:''},options).assignment.status,'cancelled');
});

test('nonassignable listening game suggestions cannot be silently marked as reading homework',()=>{
  const s=state();throwsCode(()=>assign(s,{contentId:'racing-listening'}),'CONTENT_NOT_ASSIGNABLE');
  assert.equal(s.assignments.length,0);
  assert.equal(CONTENT_CATALOG.find(row=>row.id==='racing-listening').assignable,false);
});

test('assignment create retries are idempotent and changed payloads conflict',()=>{
  const s=state(),a=assign(s,{idempotencyKey:'create-1'}),b=assign(s,{idempotencyKey:'create-1'});
  assert.equal(a.id,b.id);assert.equal(s.assignments.length,1);assert.equal(s.audit.length,1);
  throwsCode(()=>assign(s,{idempotencyKey:'create-1',title:'다른 과제'}),'IDEMPOTENCY_CONFLICT');
});

test('due dates, recipients and unsupported update scope are validated before mutation',()=>{
  const s=state();throwsCode(()=>assign(s,{dueAt:new Date(NOW-1).toISOString()}),'INVALID_DUE_DATE');
  throwsCode(()=>assign(s,{learnerIds:[] }),'INVALID_RECIPIENTS');
  throwsCode(()=>assign(s,{learnerIds:['demo-nara','demo-nara']}),'INVALID_RECIPIENTS');
  const a=assign(s),before=JSON.stringify(s);
  throwsCode(()=>updateAssignment(s,DEMO_TEACHER,{assignmentId:a.id,contentId:'reading-condition'},options),'ASSIGNMENT_SCOPE_FIXED');
  throwsCode(()=>updateAssignment(s,DEMO_TEACHER,{assignmentId:a.id,revision:999,title:'새 제목'},options),'REVISION_CONFLICT');
  assert.equal(JSON.stringify(s),before);
});

test('teacher can revise title, reason and due date while unrelated teacher cannot',()=>{
  const s=state(),a=assign(s);
  throwsCode(()=>updateAssignment(s,other,{assignmentId:a.id,title:'다른 반 변경'},options),'FORBIDDEN');
  const result=updateAssignment(s,DEMO_TEACHER,{assignmentId:a.id,revision:1,title:'도서관 운영시간',reason:'다음 수업 전에 다시 확인',dueAt:new Date(NOW+2*DAY).toISOString()},options);
  assert.equal(result.assignment.revision,2);assert.equal(result.assignment.title,'도서관 운영시간');
  assert.equal(getStudentWorkspace(s,nara,options).assignments[0].title,'도서관 운영시간');
});

test('student sees only own assignments and never receives answer keys before submission',()=>{
  const s=state(),a=assign(s),w=getStudentWorkspace(s,nara,options);
  assert.equal(w.assignments[0].id,a.id);assert.equal(w.assignments[0].content.questions.length,3);
  assert.doesNotMatch(JSON.stringify(w),/correctAnswer|"answer"|teacherId|demo-bora/);
  // Public personalization may explain a recommendation; task explanations and
  // answer keys still stay off the learner's unsubmitted assignment payload.
  assert.doesNotMatch(JSON.stringify(w.assignments),/explanation/);
  assert.equal(getStudentWorkspace(s,bora,options).assignments.length,0);
  throwsCode(()=>submit(s,a,{},bora),'FORBIDDEN');
  throwsCode(()=>submit(s,a,{learnerId:'demo-bora'}),'FORBIDDEN');
  throwsCode(()=>submitAssignment(s,DEMO_TEACHER,{assignmentId:a.id,answers,idempotencyKey:'x'},options),'FORBIDDEN');
});

test('server grades actual answers and submitted evidence changes the teacher profile and analytics',()=>{
  const s=state(),a=assign(s),result=submit(s,a,{correct:0,total:999,score:100});
  assert.equal(result.submission.correct,3);assert.equal(result.submission.total,3);
  assert.equal(result.submission.results[0].correctAnswer,'b');
  const w=getWorkspace(s,DEMO_TEACHER,options),reading=student(w,'demo-nara').skills.find(row=>row.id==='ko.reading.detail');
  assert.equal(reading.n,6);assert.equal(reading.correct,4);
  assert.equal(w.analytics.assigned,1);assert.equal(w.analytics.completed,1);assert.equal(w.analytics.pending,0);
  assert.equal(w.analytics.correct,3);assert.equal(w.analytics.questions,3);
  assert.equal(getStudentWorkspace(s,nara,options).assignments[0].completed,true);
});

test('submission retries add no duplicate result or evidence and changed retry payload conflicts',()=>{
  const s=state(),a=assign(s),first=submit(s,a),before=JSON.stringify(s),again=submit(s,a);
  assert.equal(again.duplicate,true);assert.equal(again.submission.id,first.submission.id);assert.equal(JSON.stringify(s),before);
  throwsCode(()=>submit(s,a,{answers:{...answers,'detail-open':'a'}}),'IDEMPOTENCY_CONFLICT');
  throwsCode(()=>submit(s,a,{idempotencyKey:'another-submit'}),'ALREADY_SUBMITTED');
  assert.equal(JSON.stringify(s),before);
});

test('incomplete answers reject atomically and another assignment cannot reuse an old key',()=>{
  const s=state(),a=assign(s),before=JSON.stringify(s);
  throwsCode(()=>submit(s,a,{answers:{'detail-open':'b'}}),'INVALID_ANSWERS');assert.equal(JSON.stringify(s),before);
  submit(s,a);const next=assign(s,{reason:'다시 읽으며 복습'});
  throwsCode(()=>submit(s,next),'IDEMPOTENCY_CONFLICT');
});

test('reassigning the same questions does not manufacture fresh independent evidence',()=>{
  const s=state(),a=assign(s);submit(s,a);
  const count=student(getWorkspace(s,DEMO_TEACHER,options),'demo-nara').skills.find(row=>row.id==='ko.reading.detail').n;
  const b=assign(s,{reason:'익숙한 문항을 복습'}),second=submit(s,b,{idempotencyKey:'submit-2'});
  assert.ok(second.submission.results.every(row=>row.independent===false));
  assert.equal(student(getWorkspace(s,DEMO_TEACHER,options),'demo-nara').skills.find(row=>row.id==='ko.reading.detail').n,count);
});

test('cancelled assignments remain recorded and reject new submissions without deleting prior results',()=>{
  const s=state(),a=assign(s);submit(s,a);
  cancelAssignment(s,DEMO_TEACHER,{assignmentId:a.id,reason:'수업 순서 변경'},options);
  assert.equal(submit(s,a).duplicate,true);assert.equal(s.submissions.length,1);
  throwsCode(()=>updateAssignment(s,DEMO_TEACHER,{assignmentId:a.id,title:'수정'},options),'ASSIGNMENT_CANCELLED');
  const b=assign(s,{reason:'새 과제'});cancelAssignment(s,DEMO_TEACHER,{assignmentId:b.id},options);
  throwsCode(()=>submit(s,b,{idempotencyKey:'submit-2'}),'ASSIGNMENT_CANCELLED');
  assert.equal(getWorkspace(s,DEMO_TEACHER,options).analytics.activeAssignments,0);
});

test('late submissions are accepted as late and remove their overdue pending count',()=>{
  const s=state(),a=assign(s),later={now:NOW+2*DAY};
  assert.equal(getWorkspace(s,DEMO_TEACHER,later).analytics.overdue,1);
  const result=submitAssignment(s,nara,{assignmentId:a.id,answers,idempotencyKey:'late-1'},later);
  assert.equal(result.submission.late,true);
  const w=getWorkspace(s,DEMO_TEACHER,later);assert.equal(w.analytics.overdue,0);assert.equal(w.analytics.lateSubmissions,1);
  assert.equal(w.assignments[0].overdue,false);
  assert.equal(getStudentWorkspace(s,nara,later).assignments[0].overdue,false);
});

test('teacher notes persist with provenance but do not fabricate independent language results',()=>{
  const s=state(),before=student(getWorkspace(s,DEMO_TEACHER,options),'demo-nara').skills;
  const payload={learnerId:'demo-nara',skillId:'ko.reading.detail',note:'날짜를 다시 확인한 뒤 스스로 수정함',idempotencyKey:'note-1'};
  const first=addObservation(s,DEMO_TEACHER,payload,options),again=addObservation(s,DEMO_TEACHER,payload,options);
  assert.equal(again.duplicate,true);assert.equal(first.observation.id,again.observation.id);
  const after=student(getWorkspace(s,DEMO_TEACHER,options),'demo-nara');assert.equal(after.observations.length,1);assert.deepEqual(after.skills,before);
  throwsCode(()=>addObservation(s,DEMO_TEACHER,{...payload,note:'다른 기록'},options),'IDEMPOTENCY_CONFLICT');
  throwsCode(()=>addObservation(s,other,payload,options),'FORBIDDEN');
  throwsCode(()=>addObservation(s,DEMO_TEACHER,{...payload,classId:'class-evening'},options),'FORBIDDEN');
  assert.equal(getStudentWorkspace(s,nara,options).observations,undefined);
});

test('returned workspaces and assignments cannot mutate persisted state or catalog',()=>{
  const s=state(),a=assign(s);a.learnerIds.push('demo-roan');a.recommendations[0].reason='changed';
  const w=getWorkspace(s,DEMO_TEACHER,options);w.classes[0].learners[0].evidence.length=0;w.content[0].title='changed';
  assert.equal(s.assignments[0].learnerIds.length,1);assert.notEqual(s.assignments[0].recommendations[0].reason,'changed');
  assert.equal(s.learners[0].evidence.length,8);assert.notEqual(CONTENT_CATALOG[0].title,'changed');
});
