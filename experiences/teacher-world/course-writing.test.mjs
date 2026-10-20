import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courseView,courseCommand} from './course-writing.mjs';
import catalog from './topik4-course.json' with {type:'json'};
import {build} from '../../tools/build-topik4-course.mjs';
import {courseMaterial} from './course-writing-ui.mjs';
const now=Date.parse('2026-10-20T00:00:00Z'),teacher={id:'teacher',role:'teacher'};
function fixture(count=1){return {classes:[{id:'class',teacherIds:['teacher']}],learners:Array.from({length:count},(_,i)=>({id:'student'+i,name:'합성 학생 '+i,accountId:'account'+i,sharing:{enabled:true,revision:2},accountLearning:{enabled:true}}))};}
function assign(s,week=1){return courseCommand(s,teacher,'/api/course/assign',{week,dueAt:'2026-10-21T00:00:00Z',idempotencyKey:'assign-week'+week},now).task;}
function submit(s,t,id='student0',more={}){return courseCommand(s,{id,role:'learner'},'/api/course/submit',{taskId:t.id,sharingRevision:2,baseVersion:0,text:'합성 학생의 첫 글입니다.',reading:Object.fromEntries(catalog[t.week-1].reading.map(q=>[q.id,q.answer])),idempotencyKey:'submit-'+id,...more},now);}
function feedback(s,t,id='student0',more={}){return courseCommand(s,teacher,'/api/course/feedback',{taskId:t.id,learnerId:id,sharingRevision:2,version:1,baseFeedback:0,good:'내용을 잘 옮겼어요.',focus:'문체를 맞춰요.',retry:'문장 끝을 다시 써 보세요.',tags:['체'],rubric:{content:1,structure:1,language:0},minutes:5,idempotencyKey:'feedback-'+id,...more},now);}
test('generated catalog stays in sync, hides answers, resolves every shared passage',()=>{
 assert.deepEqual(JSON.parse(build()),catalog);assert.equal(catalog.length,8);
 for(const w of catalog){assert.ok(!/예시답|가상 학생 초안|채점에서/.test(w.prompt));assert.equal(w.reading.length,5);assert.ok(w.reading.every(q=>!q.prompt.includes('같은 지문')));}
 const s=fixture(),t=assign(s),v=courseView(s,{id:'student0',role:'learner'},now);
 assert.equal(v.tasks[0].id,t.id);assert.equal(JSON.stringify(v).includes('"answer"'),false);
});
test('course material renders tables and emphasis but never server HTML',()=>{
 const html=courseMaterial('**문제**\n> <u>같은 뜻</u>\n| 가상 자료 | 수 |\n|---|---:|\n| 가 | 3 |\n<img src=x onerror=alert(1)>');
 assert.match(html,/<strong>문제<\/strong>/);assert.match(html,/<u>같은 뜻<\/u>/);assert.match(html,/<table>/);
 assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.ok(!html.includes('---'));
});
test('first original, feedback edits, revision and teacher improvement survive round trip',()=>{
 const s=fixture(),t=assign(s);submit(s,t);feedback(s,t);
 feedback(s,t,'student0',{baseFeedback:1,idempotencyKey:'edit-feedback',focus:'문체와 조사를 맞춰요.'});
 submit(s,t,'student0',{baseVersion:1,text:'학생이 직접 고쳐 쓴 글이다.',reflection:'문장 끝을 고쳤다.',idempotencyKey:'revision-student0'});
 feedback(s,t,'student0',{version:2,baseFeedback:0,rubric:{content:1,structure:1,language:2},idempotencyKey:'review-revision'});
 const record=courseView(JSON.parse(JSON.stringify(s)),teacher,now).learners[0].records[0];
 assert.equal(record.versions[0].text,'합성 학생의 첫 글입니다.');assert.equal(record.versions[0].feedback.length,2);
 assert.equal(record.versions[1].text,'학생이 직접 고쳐 쓴 글이다.');assert.equal(record.improvement.language,2);
 assert.equal(record.actions,undefined);assert.equal(record.versions[0].reading.filter(q=>q.correct).length,5);
});
test('uncertain retry is idempotent and conflicting writes cannot overwrite',()=>{
 const s=fixture(),t=assign(s);submit(s,t);assert.equal(submit(s,t).duplicate,true);
 assert.throws(()=>submit(s,t,'student0',{text:'다른 글'}),{code:'IDEMPOTENCY_CONFLICT'});
 assert.throws(()=>submit(s,t,'student0',{baseVersion:0,idempotencyKey:'concurrent-write'}),{code:'REVISION_CONFLICT'});
 feedback(s,t);assert.equal(feedback(s,t).duplicate,true);
 assert.throws(()=>feedback(s,t,'student0',{idempotencyKey:'concurrent-feedback'}),{code:'REVISION_CONFLICT'});
});
test('role, current sharing and separation protect manuscripts',()=>{
 const s=fixture(2),t=assign(s);submit(s,t);
 assert.throws(()=>courseCommand(s,{id:'stranger',role:'teacher'},'/api/course/assign',{week:2,dueAt:'2026-10-21',idempotencyKey:'not-teacher'},now),{code:'FORBIDDEN'});
 assert.equal(courseView(s,{id:'student1',role:'learner'},now).records.length,0);
 s.learners[0].sharing.enabled=false;
 assert.equal(courseView(s,teacher,now).learners.length,1);assert.equal(courseView(s,{id:'student0',role:'learner'},now).records.length,1);
 assert.equal(courseView(s,{id:'student0',role:'learner'},now).records[0].readOnly,true);
 assert.throws(()=>feedback(s,t),{code:'SHARING_DISABLED'});
 s.learners[0].sharing={enabled:true,revision:3};
 assert.equal(courseView(s,{id:'student0',role:'learner'},now).records[0].readOnly,true);
 assert.equal(courseView(s,{id:'student0',role:'learner'},now).records[0].versions[0].text,'합성 학생의 첫 글입니다.');
 assert.throws(()=>submit(s,t),{code:'REVISION_CONFLICT'});
});
test('group analysis needs separate consent, five independent contributors and five-member cells',()=>{
 const s=fixture(6),t=assign(s);
 for(let i=0;i<6;i++){submit(s,t,'student'+i);feedback(s,t,'student'+i);}
 assert.equal(courseView(s,teacher,now).groups[0].status,'insufficient');
 for(let i=0;i<5;i++)courseCommand(s,{id:'student'+i,role:'learner'},'/api/course/group-sharing',{taskId:t.id,sharingRevision:2,baseConsentRevision:1,enabled:true},now);
 let group=courseView(s,teacher,now).groups[0];assert.equal(group.cells[0].n,5);assert.equal(group.cells[0].분모,5);
 assert.ok(!JSON.stringify(group).includes('student'));assert.ok(!JSON.stringify(group).includes('첫 글'));
 const own=courseView(s,{id:'student0',role:'learner'},now);assert.equal(own.groups,undefined);
 const signature=JSON.stringify([group.reviewed,group.eligible,group.cells.map(c=>[c.tag,c.n])]);
 courseCommand(s,teacher,'/api/course/plan',{taskId:t.id,signature},now);
 assert.equal(courseView(s,teacher,now).groups[0].plan.materials.length,1);
 assert.equal(JSON.stringify(courseView(s,{id:'student0',role:'learner'},now)).includes('lessonPlan'),false);
 courseCommand(s,{id:'student0',role:'learner'},'/api/course/group-sharing',{taskId:t.id,sharingRevision:2,baseConsentRevision:2,enabled:false},now);
 group=courseView(s,teacher,now).groups[0];assert.deepEqual(group,{taskId:t.id,status:'insufficient',minimum:5,cells:[]});
});
