import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');

function fixture(){
  const nodes=new Map(),requests=[],errors=[];
  const node=()=>({innerHTML:'',value:'',textContent:'',disabled:false,open:false,isConnected:true,listeners:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(name,handler){this.listeners[name]=handler;},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],focus(){},insertAdjacentHTML(_position,html){this.innerHTML+=html;},close(){this.open=false;}});
  for(const key of ['#app','#modal','#personal-body','#drawer','#close-drawer'])nodes.set(key,node());
  const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=> 'workday-request'}});
  const run=code=>vm.runInContext(code,context);run(source);
  run("Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},members:[{id:'u1',name:'담당'},{id:'u2',name:'검토'}],channels:[{id:'c1',name:'프로젝트 방',kind:'channel',memberIds:['u1','u2'],canPost:true}],channelId:'c1',chatCategory:'all',drawer:'personal',personalTab:'workday'});");
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.report=message=>errors.push(message);
  run('api=request;toast=report;attachDeadlineSettings=async()=>{};');
  return{context,run,nodes,requests,errors,state:run('state')};
}

function task(overrides={}){
  return{id:'t1',messageId:'m1',channelId:'c1',title:'예약 안내 제작',stage:'doing',status:'doing',assignee:{id:'u1',name:'담당'},reviewer:{id:'u2',name:'검토'},createdBy:{id:'u2',name:'요청자'},dueDate:'2026-10-09',allowedStages:['review'],canManage:true,message:{id:'m1',channelId:'c1',body:'안내 영상 끝에 예약 링크를 연결해 주세요.'},...overrides};
}

function workday({today={},remaining={},openTotal}={}){
  const groups=(keys,values)=>Object.fromEntries(keys.map(key=>[key,values[key]||[]]));
  const section=groups=>({groups,counts:Object.fromEntries(Object.entries(groups).map(([key,tasks])=>[key,tasks.length])),total:new Set(Object.values(groups).flat().map(item=>item.id)).size});
  const todaySection=section(groups(['reply','due','review','recovery'],today)),remainingSection=section(groups(['upcoming','undated','waiting'],remaining));
  return{date:'2026-10-09',today:todaySection,remaining:remainingSection,openTotal:openTotal??new Set([...Object.values(todaySection.groups).flat(),...Object.values(remainingSection.groups).flat()].map(item=>item.id)).size};
}

function summary(f,work,client={data:{items:[]}}){f.context.work=work;f.context.client=client;return f.run('workdaySummaryHtml(work,client)');}

test('a successfully checked empty day states clearly that there is no work to process today',()=>{
  const f=fixture(),html=summary(f,workday());assert.ok(html.includes('오늘 처리할 일이 없습니다'));assert.ok(!html.includes('오늘 처리할 일 0개'));assert.equal(f.requests.length,0);
});

test('a task shown for more than one reason is counted once in the today summary',()=>{
  const f=fixture(),item=task({stage:'review'}),work=workday({today:{due:[item],review:[item]}});assert.equal(work.today.total,1);
  const html=summary(f,work);assert.ok(html.includes('오늘 처리할 일 1개'));assert.ok(!html.includes('오늘 처리할 일 2개'));assert.ok(!html.includes('오늘 처리할 일이 없습니다'));
});

test('future and undated active work stays visible instead of implying there is no work to do',()=>{
  const f=fixture(),work=workday({remaining:{upcoming:[task({id:'future',title:'다음 주 소개 영상',stage:'accepted',dueDate:'2026-10-12'})],undated:[task({id:'undated',title:'자료 폴더 정리',dueDate:null})],waiting:[task({id:'waiting',title:'외부 검토 대기',stage:'review',assignee:{id:'u2',name:'다른 담당'}})]}});
  const html=summary(f,work);assert.ok(html.includes('남아 있는 내 업무 2개'));assert.ok(!html.includes('오늘 처리할 일이 없습니다'));assert.ok(html.includes('오늘 마감·응답·검토 대상은 없습니다'));
  for(const count of ['이후 마감 1개','기한 미정 1개','대기 중 1개'])assert.ok(html.includes(count),count);
  for(const value of ['다음 주 소개 영상','자료 폴더 정리','2026-10-12','기한 미정','data-workday-task-id="future"','data-workday-task-id="undated"'])assert.ok(html.includes(value),value);
  assert.ok(!html.includes('외부 검토 대기'),'the active quick list must not promote waiting work');assert.ok(!html.includes('오늘 처리할 일 3개'));
});

test('a waiting-only day differs from active remaining work and from a completely empty workspace',()=>{
  const f=fixture(),waiting=summary(f,workday({remaining:{waiting:[task({id:'waiting',stage:'review',assignee:{id:'u2',name:'다른 담당'}})]}})),empty=summary(f,workday());
  assert.ok(waiting.includes('오늘 처리할 일이 없습니다'));assert.ok(waiting.includes('대기 중 1개'));assert.ok(!waiting.includes('남아 있는 내 업무'));assert.notEqual(waiting,empty);assert.ok(!empty.includes('대기 중 1개'));
});

test('an unavailable customer workflow cannot produce an unqualified empty-day claim',()=>{
  const f=fixture();f.run('state.integrated={canWrite:true}');const html=summary(f,workday(),{error:'<img src=x> 고객 업무 확인 실패'});
  assert.ok(!html.includes('오늘 처리할 일이 없습니다'));assert.match(html,/(확인.*못|확인.*실패|확인.*필요)/s);assert.ok(!html.includes('<img src=x>'));
});

test('a customer read failure retains known actionable work while labelling the count incomplete',()=>{
  const f=fixture();f.run('state.integrated={canWrite:true}');const html=summary(f,workday({today:{due:[task()]}}),{error:'고객 업무 확인 실패'});
  assert.ok(html.includes('확인된 오늘 할 일 1개'));assert.ok(!html.includes('오늘 처리할 일이 없습니다'));assert.match(html,/고객 업무.*확인하지 못/s);
});

test('waiting customer work stays waiting even when a reopen action is offered',()=>{
  const f=fixture();f.run('state.integrated={canWrite:true}');const html=summary(f,workday(),{data:{items:[{id:'c1',group:'waiting',title:'고객 승인 기다림',actions:[{action:'reopen',label:'검토 다시 열기'}]}]}});
  assert.ok(html.includes('오늘 처리할 일이 없습니다'));assert.ok(!html.includes('오늘 처리할 일 1개'));assert.match(html,/대기/);
});

test('customer reply, review and next-step items count once per recorded item',()=>{
  const f=fixture();f.run('state.integrated={canWrite:true}');const items=[{id:'c1',group:'reply',actions:[]},{id:'c1',group:'review',actions:[]},{id:'c2',group:'next',actions:[]},{id:'c3',group:'waiting',actions:[{action:'reopen'}]}];
  const html=summary(f,workday(),{data:{items}});assert.ok(html.includes('오늘 처리할 일 2개'));assert.ok(!html.includes('오늘 처리할 일 3개'));assert.ok(!html.includes('오늘 처리할 일 4개'));assert.ok(!html.includes('오늘 처리할 일이 없습니다'));
});

test('a legacy response without today classification never confirms an empty day',()=>{
  const f=fixture(),html=summary(f,{date:'2026-10-09',groups:{reply:[],due:[],review:[],waiting:[]},counts:{reply:0,due:0,review:0,waiting:0}});
  assert.ok(html.includes('오늘 할 일을 정확히 분류할 수 없습니다'));assert.ok(!html.includes('오늘 처리할 일이 없습니다'));assert.match(html,/(업데이트|새로|확인)/);
});

test('task cards show the next concrete action and keep the original request accessible',()=>{
  const f=fixture();f.context.task=task({stage:'requested',title:'<script>예약 안내</script>'});f.context.task.message.body='<img src=x onerror=alert(1)> 예약 링크를 연결하세요.';const html=f.run('workdayTaskHtml(task,0,"2026-10-09")');
  assert.match(html,/class="workday-next-action"/);assert.match(html,/(확인|수락)/);assert.match(html,/data-source-message="m1"/);assert.ok(html.includes('&lt;script&gt;예약 안내&lt;/script&gt;'));assert.ok(!html.includes('<script>예약 안내'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
  f.run("task.stage='review';state.user={id:'u2',name:'검토',role:'member'}");const review=f.run('workdayTaskHtml(task,0,"2026-10-09")'),action=review.match(/<p class="workday-next-action">([\s\S]*?)<\/p>/);assert.ok(action);assert.match(action[1].replace(/<[^>]*>/g,''),/결과물.*(승인|수정)/);
});

test('the today panel surfaces active remaining work before the full later and waiting sections',async()=>{
  const f=fixture(),work=workday({remaining:{upcoming:[task({id:'future',title:'다음 주 소개 영상',dueDate:'2026-10-12'})],undated:[task({id:'undated',title:'자료 폴더 정리',dueDate:null})],waiting:[task({id:'waiting',title:'외부 검토 대기',stage:'review',assignee:{id:'u2',name:'다른 담당'}})]}});
  const loading=f.run('loadPersonalPanel()');assert.equal(f.requests[0].path,'/api/workday');f.requests[0].resolve(work);await loading;
  const html=f.nodes.get('#personal-body').innerHTML;assert.ok(html.includes('남아 있는 내 업무 2개'));assert.ok(!html.includes('오늘 처리할 일이 없습니다'));for(const title of ['다음 주 소개 영상','자료 폴더 정리','외부 검토 대기'])assert.ok(html.includes(title),title);
  assert.ok(html.indexOf('남아 있는 내 업무 2개')<html.indexOf('다음 주 소개 영상'),'the active-work result must appear before its tasks');
  assert.ok(html.indexOf('자료 폴더 정리')<html.indexOf('workday-section'),'the remaining active names must be immediately visible in the summary');
});

test('quick-list task clicks resolve the recorded task ID and open its detail',async()=>{
  const f=fixture(),opened=[];f.context.recordDetail=message=>opened.push(message);f.run('openTaskDetail=recordDetail');
  const first=task({id:'first',messageId:'first-message',title:'첫 번째 업무'}),second=task({id:'second',messageId:'second-message',title:'선택한 업무'}),loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday({today:{reply:[first],due:[second]}}));await loading;
  const html=f.nodes.get('#personal-body').innerHTML;assert.ok(html.includes('data-workday-task-id="second"'));
  f.state.personalItems.reverse();await f.nodes.get('#personal-body').onclick({target:{closest:selector=>selector==='[data-workday-task-id]'?{dataset:{workdayTaskId:'second'}}:null}});
  assert.equal(opened.length,1);assert.equal(opened[0].id,'second-message');assert.equal(opened[0].task.id,'second');assert.equal(f.requests.length,1);
});

test('a failed workday read says that work is unknown and offers refresh without claiming zero',async()=>{
  const f=fixture(),loading=f.run('loadPersonalPanel()');f.requests[0].reject(new Error('<img src=x> 네트워크 오류'));await loading;const html=f.nodes.get('#personal-body').innerHTML;
  assert.ok(html.includes('할 일을 확인하지 못했습니다'));assert.ok(!html.includes('오늘 처리할 일이 없습니다'));assert.match(html,/data-productivity-refresh/);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x>'));
});

test('a customer fetch failure stays visible after the workday API successfully returns zero',async()=>{
  const f=fixture();f.run("state.integrated={canWrite:true};clientWorkflowApi=async()=>{throw new Error('고객 업무 읽기 실패')}");const loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday());await loading;const html=f.nodes.get('#personal-body').innerHTML;
  assert.ok(!html.includes('오늘 처리할 일이 없습니다'));assert.ok(html.includes('고객 업무 읽기 실패'));assert.match(html,/data-productivity-refresh/);
});

test('a late empty-day response cannot overwrite another personal view',async()=>{
  const f=fixture(),loading=f.run('loadPersonalPanel()');f.run("state.personalTab='tasks'");f.nodes.get('#personal-body').innerHTML='전체 할 일 목록';f.requests[0].resolve(workday());await loading;assert.equal(f.nodes.get('#personal-body').innerHTML,'전체 할 일 목록');
});
