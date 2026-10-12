import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleView} from './public/pulse-app/schedule-view.mjs';
import {projectView} from './public/pulse-app/views.mjs';

globalThis.location=new URL('http://127.0.0.1:64046/pulse-app/');
const id='01234567-89ab-cdef-0123-456789abcdef';
const plan={enabled:true,canEdit:true,calendar:'weekdays',calendarLabel:'평일(월~금, 공휴일 미반영)',targets:{draft:'2099-08-01'},remainingWorkDays:4,customerWaitDays:3,internalReviewDays:2,checkedAt:'2026-10-12',today:'2026-10-12',status:'attention',statusLabel:'확인할 일정 있음',pendingCount:3,agreedDueDate:'2026-10-19',estimatedFinishDate:'2026-10-16',remainingDays:7,risk:{status:'at_risk',text:'내부 예상일과 확인 대기를 함께 검토해 주세요.'},milestones:[{id:'draft',label:'PRIVATE-MILESTONE',targetDate:'2099-08-01',href:'https://evil.test/milestone'}],waiting:[{id:'review',label:'PRIVATE-WAIT',since:'2099-07-01',dueDate:'2099-07-03',href:'javascript:alert(1)'}]};
const project={id,revision:9,title:'일정 시험',customerName:'합성 고객',stage:'producing',dueDate:'2026-10-19',versions:[],messages:[],studio:{preferences:{},references:[],assets:[],concepts:[],scenes:[],sceneReviews:[],comments:[]},schedule:plan};
const state=(patch={})=>({mode:'staff',canEdit:true,project:structuredClone(project),tab:'strategy',demo:false,...patch});

test('staff summary distinguishes agreed date, remaining production days and internal estimate',()=>{
  const html=scheduleView(state());assert.match(html,/제작 일정·확인 지연/);assert.match(html,/오늘 확인 3건/);assert.match(html,/합의한 납품일/);assert.match(html,/2026-10-19/);assert.match(html,/남은 제작일로 계산한 예상일/);assert.match(html,/2026-10-16/);assert.match(html,/4일/);assert.match(html,/평일\(월~금, 공휴일 미반영\) 기준/);assert.match(html,/고객과 합의한 납품일은 자동으로 바뀌지 않습니다/);
});

test('customer and demo modes render no internal schedule even if the staff report is accidentally present',()=>{
  for(const patch of [{mode:'customer'},{mode:'staff',demo:true},{mode:'customer',demo:true}])assert.equal(scheduleView(state(patch)), '');
  const customer=state({mode:'customer'});customer.project.schedule.estimatedFinishDate='2099-12-30';customer.project.schedule.risk.text='PRIVATE-SCHEDULE-PLAN';
  for(const tab of ['strategy','direction','concepts','storyboard','review','history']){const html=projectView({...customer,tab});assert.doesNotMatch(html,/schedule-summary|schedule-setup|PRIVATE-SCHEDULE-PLAN|2099-12-30|2099-08-01|2099-07-03|schedule=1/);}
});

test('the summary is common to staff project tabs and leaves the surrounding production views intact',()=>{
  for(const tab of ['strategy','direction','concepts','storyboard','review','history']){const html=projectView(state({tab}));assert.equal((html.match(/id="schedule-summary-title"/g)||[]).length,1);assert.match(html,new RegExp('data-current-tab="'+tab+'"'));assert.match(html,/이번 확인의 범위/);}
});

test('disabled plans show only a small authorized setup link, with no old internal dates or estimates',()=>{
  const s=state();s.project.schedule.enabled=false;const html=scheduleView(s);assert.match(html,/제작 일정 점검 설정/);assert.doesNotMatch(html,/2026-10-16|2099-|PRIVATE|오늘 확인|4일/);
  s.project.schedule.canEdit=false;assert.equal(scheduleView(s),'');s.project.schedule.canEdit=true;s.project.stage='archived';assert.equal(scheduleView(s),'');
  assert.equal(scheduleView(state({project:{...project,schedule:null}})),'');
});

test('the staff panel stays read-only and generates only the exact local project schedule link',()=>{
  const s=state({canEdit:false});s.project.schedule.canEdit=false;const html=scheduleView(s),links=[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(links,[`/?tab=workroom&amp;section=clients&amp;project=${id}&amp;schedule=1`]);assert.match(html,/rel="noopener noreferrer"/);assert.doesNotMatch(html,/<form|<input|<textarea|<select|data-mutate|data-action|evil\.test|javascript:|PRIVATE-MILESTONE|PRIVATE-WAIT/);
});

test('invalid project identifiers never become links or attributes',()=>{
  for(const value of ['',null,'p','../customer','https://evil.test','" onmouseover="bad']){const s=state();s.project.id=value;const html=scheduleView(s);assert.doesNotMatch(html,/href=|onmouseover=|evil\.test/);}
});

test('displayed dates, risk text and calendar labels are escaped instead of becoming markup',()=>{
  const s=state();s.project.schedule.agreedDueDate='<img src=x>';s.project.schedule.estimatedFinishDate='<script>bad</script>';s.project.schedule.calendarLabel='" onmouseover="bad';s.project.schedule.risk.text='<svg onload=bad>';
  const html=scheduleView(s);assert.match(html,/&lt;img src=x&gt;/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;svg onload=bad&gt;/);assert.doesNotMatch(html,/<img|<script|<svg| onmouseover="bad/);
});

test('zero production days and zero due checks are shown accurately without inventing missing dates',()=>{
  const s=state();Object.assign(s.project.schedule,{remainingWorkDays:0,pendingCount:0,agreedDueDate:'',estimatedFinishDate:''});const html=scheduleView(s);assert.match(html,/오늘 확인 0건/);assert.match(html,/>0일</);assert.match(html,/아직 미확정/);assert.match(html,/아직 계산 전/);
  Object.assign(s.project.schedule,{remainingWorkDays:null,pendingCount:null});const missing=scheduleView(s);assert.match(missing,/아직 미입력/);assert.match(missing,/확인 상태 불러오기 필요/);assert.doesNotMatch(missing,/NaN|undefined|null|오늘 확인 0건/);
});

test('archived schedules show a record label rather than a current action count',()=>{
  const s=state();s.project.schedule.status='archived';s.project.schedule.pendingCount=7;const html=scheduleView(s);assert.match(html,/보관된 일정/);assert.doesNotMatch(html,/오늘 확인 7건|data-mutate/);
});

test('rendering is pure and does not change source schedules, waiting records or customer dates',()=>{
  const s=state(),before=JSON.stringify(s);scheduleView(s);projectView(s);assert.equal(JSON.stringify(s),before);
  const demo=state({demo:true,demoGuide:{title:'체험',description:'합성 체험',tab:'strategy',step:1,total:6,action:'strategy'},demoPersistent:false});assert.doesNotMatch(projectView(demo),/schedule-summary|schedule-setup|schedule=1|2026-10-16/);
});
