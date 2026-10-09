import test from 'node:test';
import assert from 'node:assert/strict';
import {learnerOverview,teacherOverviewModel,createTeacherOverview,careDateValue,careDueAt} from './workspace-overview.mjs';
const practice={id:'ko.reading.detail',label:'읽기 세부 정보',status:'practice',n:3,correct:1,source:'independent-language-items'};
const learner=(id,extra={})=>({id,name:'학생 '+id,accountConnected:true,sharing:{enabled:true,revision:2},skills:[practice],...extra});
test('care dates use the Korean service day and end-of-day deadline consistently on creation and editing',()=>{
  assert.equal(careDueAt('2026-10-12'),'2026-10-12T14:59:59.000Z');assert.equal(careDateValue('2026-10-11T20:00:00Z'),'2026-10-12');assert.equal(careDateValue(careDueAt('2026-10-12')),'2026-10-12');assert.throws(()=>careDueAt('2026-02-31'));assert.throws(()=>careDueAt('invalid'));
});
test('actual roster counts follow two sixteen-member classes without inserting slots or limiting larger classes',()=>{
  const data={classes:['a','b'].map(id=>({id,name:id,learners:Array.from({length:16},(_,i)=>learner(id+'-'+i))}))};
  const model=teacherOverviewModel(data);assert.equal(model.classes.length,2);assert.equal(model.learnerCount,32);
  const other=teacherOverviewModel({classes:[{id:'small',learners:[learner('one')]},{id:'large',learners:Array.from({length:18},(_,i)=>learner('large-'+i))}]});assert.equal(other.learnerCount,19);assert.equal(other.classes.find(row=>row.id==='large').learners.length,18);
});
test('class and student rosters have stable Korean numeric order with an ID tie break',()=>{
  const data={classes:[{id:'b',name:'B반',learners:[]},{id:'a',name:'A반',learners:[learner('z',{name:'학생10'}),learner('y',{name:'학생2'}),learner('same-b',{name:'가람'}),learner('same-a',{name:'가람'})]}]},before=structuredClone(data);
  const model=teacherOverviewModel(data);assert.deepEqual(model.classes.map(row=>row.id),['a','b']);assert.deepEqual(model.classes[0].learners.map(row=>row.id),['same-a','same-b','y','z']);assert.deepEqual(data,before);
});
test('unconnected, unshared, no-record and missing activity integration stay separate and cannot become weaknesses',()=>{
  const unconnected=learnerOverview(learner('a',{accountConnected:false,connectedAt:null,revoked:true}));assert.equal(unconnected.sharing,'unconnected');assert.equal(unconnected.practice.length,0);
  const unshared=learnerOverview(learner('b',{connectedAt:null,sharing:{enabled:false,revision:2}}));assert.equal(unshared.sharing,'unshared');assert.equal(unshared.worldText,'학습 공유 안 함');assert.equal(unshared.practice.length,0);
  const absent=learnerOverview(learner('c'));assert.equal(absent.worldText,'활동 요약 미연결');assert.equal(absent.townText,'생활 활동 연결 준비 중');
  const empty=learnerOverview(learner('d',{skills:[],activity:{world:{status:'no-record'},town:{status:'no-record'}}}));assert.equal(empty.worldText,'활동 기록 없음');assert.equal(empty.practice.length,0);assert.equal(empty.guidance,'학습 근거 없음');
  const unknown=learnerOverview({id:'e',skills:[practice]});assert.equal(unknown.sharing,'unknown');assert.equal(unknown.practice.length,0);
});
test('Town activity and helped or insufficient samples do not increase language weakness counts',()=>{
  const value=learnerOverview(learner('a',{skills:[{...practice,status:'checking',n:1},{...practice,status:'supported',n:0,assisted:3,source:'assisted-language-items'}],activity:{world:{status:'shared',eventCount:4,lastReceivedAt:'2026-10-09T03:00:00Z'},town:{status:'shared',activityCount:100,lastReceivedAt:'2026-10-09T04:00:00Z',learningEvidence:false}}}));
  assert.equal(value.practice.length,0);assert.match(value.townText,/100건/);assert.deepEqual(value.lastActivity,{type:'TOWN',at:'2026-10-09T04:00:00Z'});
});
test('care list contains current sharing revisions and current class learners only',()=>{
  const student=learner('a'),tasks=[{id:'ok',classId:'c',learnerId:'a',status:'open',sharingRevision:2,dueAt:'2026-10-08T00:00:00Z'},{id:'old',classId:'c',learnerId:'a',status:'open',sharingRevision:1},{id:'foreign',classId:'other',learnerId:'a',status:'open',sharingRevision:2}];
  const model=teacherOverviewModel({generatedAt:'2026-10-09T00:00:00Z',classes:[{id:'c',learners:[student]}],care:tasks});assert.deepEqual(model.care.map(row=>row.id),['ok']);assert.equal(model.openCareCount,1);assert.equal(model.overdueCareCount,1);
});
test('overview escapes user names and task content and renders only actual student cards',()=>{
  const root={innerHTML:'',addEventListener(){},removeEventListener(){},replaceChildren(){this.innerHTML='';}},view=createTeacherOverview({root});
  view.render({classes:[{id:'c',name:'<script>bad</script>',learners:[learner('a',{name:'<img onerror=bad>'})]}]});assert.match(root.innerHTML,/&lt;img/);assert.doesNotMatch(root.innerHTML,/<script>/);assert.equal([...root.innerHTML.matchAll(/data-overview-student=/g)].length,1);view.stop();
});
