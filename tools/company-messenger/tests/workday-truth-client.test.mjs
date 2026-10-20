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
const text=html=>String(html).replace(/<[^>]*>/g,'');const confirmsEmptyDay=html=>/오늘 할 일 0개/.test(text(html));
const fold=(html,key)=>{const start=html.indexOf('data-client-group="fold:'+key+'"');if(start<0)return '';const next=html.indexOf('data-client-group="fold:',start+1),end=next<0?html.indexOf('<footer',start):next;return html.slice(start,end<0?undefined:end);};
function body(f,work,client={data:{items:[]}}){f.context.work=work;f.context.client=client;return f.run("state.personalItems=[];state.customerWork=[...new Map((client.data?.items||[]).map(item=>[item.id,item])).values()];workdayBodyHtml({work,client,customers:state.customerWork,publication:{data:{items:[]}}})");}

test('a successfully checked empty day states clearly that there is no work to process today',()=>{
  const f=fixture(),html=summary(f,workday());assert.ok(confirmsEmptyDay(html));assert.ok(html.includes('맡은 일도, 고객·게시 일도 없어요.'));assert.doesNotMatch(html,/불러오지 못|role="alert"/);assert.equal(f.requests.length,0);
});

test('a task shown for more than one reason is counted once in the today summary',()=>{
  const f=fixture(),item=task({stage:'review'}),work=workday({today:{due:[item],review:[item]}});assert.equal(work.today.total,1);
  const html=summary(f,work);assert.ok(text(html).includes('오늘 할 일 1개'));assert.ok(!text(html).includes('오늘 할 일 2개'));assert.ok(!confirmsEmptyDay(html));
  const rows=body(f,work);assert.equal((rows.match(/data-workday-task-id="t1"/g)||[]).length,1);assert.equal(f.state.personalItems.length,1);assert.match(rows,/data-workday-group="review"/);assert.doesNotMatch(rows,/data-workday-group="due"/);
});

test('future and undated active work stays visible instead of implying there is no work to do',()=>{
  const f=fixture(),work=workday({remaining:{upcoming:[task({id:'future',title:'다음 주 소개 영상',stage:'accepted',dueDate:'2026-10-12'})],undated:[task({id:'undated',title:'자료 폴더 정리',dueDate:null})],waiting:[task({id:'waiting',title:'외부 검토 대기',stage:'review',assignee:{id:'u2',name:'다른 담당'}})]}});
  const html=summary(f,work);assert.ok(confirmsEmptyDay(html));assert.ok(html.includes('오늘까지 할 일은 없어요.'));assert.ok(!html.includes('맡은 일도'));
  const rows=body(f,work),later=fold(rows,'later'),waiting=fold(rows,'waiting');
  assert.match(rows,/data-client-group="fold:later"[^>]* open/,'an empty day opens later work in place');assert.match(later,/<strong>나중에 할 일<\/strong><span class="wd-group-count">2</);
  for(const value of ['다음 주 소개 영상','자료 폴더 정리','datetime="2026-10-12"','기한 없음','data-workday-task-id="future"','data-workday-task-id="undated"'])assert.ok(later.includes(value),value);
  assert.ok(!later.includes('외부 검토 대기'),'later work must not promote waiting work');assert.ok(waiting.includes('외부 검토 대기'));assert.doesNotMatch(rows,/data-client-group="fold:waiting"[^>]* open/);assert.ok(rows.indexOf('fold:later')<rows.indexOf('fold:waiting'));
});

test('a waiting-only day differs from active remaining work and from a completely empty workspace',()=>{
  const f=fixture(),work=workday({remaining:{waiting:[task({id:'waiting',stage:'review',assignee:{id:'u2',name:'다른 담당'}})]}}),waiting=summary(f,work),empty=summary(f,workday());
  assert.ok(confirmsEmptyDay(waiting));assert.ok(waiting.includes('다른 사람을 기다리는 일만 있어요.'));assert.ok(!waiting.includes('오늘까지 할 일은 없어요.'));assert.notEqual(waiting,empty);assert.ok(!empty.includes('기다리는 일'));
  assert.match(body(f,work),/<strong>기다리는 일<\/strong><span class="wd-group-count">1</);
});

test('an unavailable customer workflow cannot produce an unqualified empty-day claim',()=>{
  const f=fixture();f.run('state.integrated={canWrite:true}');const html=summary(f,workday(),{error:'<img src=x> 고객 업무 확인 실패'});
  assert.ok(!confirmsEmptyDay(html));assert.ok(html.includes('오늘 할 일을 다 불러오지 못했어요'));assert.match(html,/불러오지 못/);assert.ok(!html.includes('<img src=x>'));assert.ok(html.includes('&lt;img src=x&gt; 고객 업무 확인 실패'));
});

test('a customer read failure retains known actionable work while labelling the count incomplete',()=>{
  const f=fixture();f.run('state.integrated={canWrite:true}');const html=summary(f,workday({today:{due:[task()]}}),{error:'고객 업무 확인 실패'});
  assert.ok(text(html).includes('불러온 할 일 1개'));assert.ok(!confirmsEmptyDay(html));assert.match(html,/고객 업무.*불러오지 못/s);assert.match(html,/role="alert"/);assert.ok(html.includes('고객 업무 확인 실패'));
});

test('waiting customer work stays waiting even when a reopen action is offered',()=>{
  const f=fixture();f.run('state.integrated={canWrite:true}');const client={data:{items:[{id:'c1',group:'waiting',title:'고객 승인 기다림',href:'/?tab=workroom&section=clients&project=p1',actions:[{action:'reopen',label:'검토 다시 열기'}]}]}},html=summary(f,workday(),client);
  assert.ok(confirmsEmptyDay(html));assert.ok(html.includes('다른 사람을 기다리는 일만 있어요.'));assert.ok(!text(html).includes('오늘 할 일 1개'));
  const rows=body(f,workday(),client),waiting=fold(rows,'waiting');assert.ok(waiting.includes('고객 승인 기다림'));assert.match(waiting,/data-client-action="reopen"/);assert.doesNotMatch(rows,/data-workday-group=/);
});

test('customer reply, review and next-step items count once per recorded item',()=>{
  const f=fixture();f.run('state.integrated={canWrite:true}');const items=[{id:'c1',group:'reply',actions:[]},{id:'c1',group:'review',actions:[]},{id:'c2',group:'next',actions:[]},{id:'c3',group:'waiting',actions:[{action:'reopen'}]}];
  const html=summary(f,workday(),{data:{items}});assert.ok(text(html).includes('오늘 할 일 2개'));assert.ok(!text(html).includes('오늘 할 일 3개'));assert.ok(!text(html).includes('오늘 할 일 4개'));assert.ok(!confirmsEmptyDay(html));
});

test('a legacy response without today classification never confirms an empty day',()=>{
  const f=fixture(),html=summary(f,{date:'2026-10-09',groups:{reply:[],due:[],review:[],waiting:[]},counts:{reply:0,due:0,review:0,waiting:0}});
  assert.ok(html.includes('오늘 할 일을 다 불러오지 못했어요'));assert.ok(!confirmsEmptyDay(html));assert.match(html,/다시 불러와/);assert.match(html,/role="alert"/);
});

test('task rows open the recorded task with one verb and keep the original request in the detail',()=>{
  const f=fixture();f.context.task=task({stage:'requested',title:'<script>예약 안내</script>'});f.context.task.message.body='<img src=x onerror=alert(1)> 예약 링크를 연결하세요.';const html=f.run('workdayTaskHtml(task,0,"2026-10-09",{group:"reply"})');
  assert.match(html,/data-workday-task-id="t1"[^>]*aria-label="보기 — &lt;script&gt;예약 안내&lt;\/script&gt;"[^>]*>보기<\/button>/);assert.match(html,/class="wd-quote">“&lt;img src=x onerror=alert\(1\)&gt; 예약 링크를 연결하세요.”/);assert.ok(html.includes('&lt;script&gt;예약 안내&lt;/script&gt;'));assert.ok(!html.includes('<script>예약 안내'));assert.ok(!html.includes('<img src=x'));
  f.run("task.stage='review';state.user={id:'u2',name:'검토',role:'member'}");const review=f.run('workdayTaskHtml(task,0,"2026-10-09",{group:"review"})');assert.match(review,/>검토<\/button>/);assert.match(review,/<b>담당<\/b> 올림/);
  f.run("state.user={id:'u1',name:'담당',role:'member'};task.stage='requested';task.allowedStages=['accepted'];task.workday={date:'2026-10-09',todayReasons:['reply'],remainingReasons:[]}");const detail=f.run('taskDetailHtml(taskMessage(task))');assert.match(detail,/data-source-message="m1"/);assert.match(detail,/data-task-action="stage" data-task-stage="accepted">수락하기</);assert.ok(detail.includes('&lt;img src=x'));assert.ok(!detail.includes('<img src=x'));
});

test('an empty day opens later work in place and keeps waiting work folded below it',async()=>{
  const f=fixture(),work=workday({remaining:{upcoming:[task({id:'future',title:'다음 주 소개 영상',dueDate:'2026-10-12'})],undated:[task({id:'undated',title:'자료 폴더 정리',dueDate:null})],waiting:[task({id:'waiting',title:'외부 검토 대기',stage:'review',assignee:{id:'u2',name:'다른 담당'}})]}});
  const loading=f.run('loadPersonalPanel()');assert.equal(f.requests[0].path,'/api/workday');f.requests[0].resolve(work);await loading;
  const html=f.nodes.get('#personal-body').innerHTML;assert.ok(confirmsEmptyDay(html));assert.ok(html.includes('오늘까지 할 일은 없어요.'));for(const title of ['다음 주 소개 영상','자료 폴더 정리','외부 검토 대기'])assert.ok(html.includes(title),title);
  assert.match(html,/data-client-group="fold:later"[^>]* open/);assert.doesNotMatch(html,/data-client-group="fold:waiting"[^>]* open/);
  assert.ok(html.indexOf('오늘까지 할 일은 없어요.')<html.indexOf('다음 주 소개 영상'));assert.ok(html.indexOf('자료 폴더 정리')<html.indexOf('외부 검토 대기'),'later work comes before waiting work on an empty day');
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
  assert.ok(html.includes('할 일을 불러오지 못했어요'));assert.ok(!confirmsEmptyDay(html));assert.match(html,/data-productivity-refresh/);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x>'));
});

test('a customer fetch failure stays visible after the workday API successfully returns zero',async()=>{
  const f=fixture();f.run("state.integrated={canWrite:true};clientWorkflowApi=async()=>{throw new Error('고객 업무 읽기 실패')}");const loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday());await loading;const html=f.nodes.get('#personal-body').innerHTML;
  assert.ok(!confirmsEmptyDay(html));assert.ok(html.includes('고객 업무 읽기 실패'));assert.match(html,/role="alert"/);assert.match(html,/data-productivity-refresh/);
});

test('a late empty-day response cannot overwrite another personal view',async()=>{
  const f=fixture(),loading=f.run('loadPersonalPanel()');f.run("state.personalTab='tasks'");f.nodes.get('#personal-body').innerHTML='전체 할 일 목록';f.requests[0].resolve(workday());await loading;assert.equal(f.nodes.get('#personal-body').innerHTML,'전체 할 일 목록');
});

test('a redraw keeps folds the user changed and otherwise lets an empty day open later work',()=>{
  const f=fixture(),body=f.nodes.get('#personal-body');f.state.customerGroupIdentity='u1:0';let rendered=false,html='';Object.defineProperty(body,'innerHTML',{set:value=>{html=value;rendered=true;},get:()=>html});
  const untouched={dataset:{clientGroup:'fold:later'},open:false},closedByUser={dataset:{clientGroup:'fold:waiting',defaultOpen:'1'},open:false},openedByUser={dataset:{clientGroup:'fold:deferred'},open:true};
  const later={dataset:{clientGroup:'fold:later',defaultOpen:'1'},open:true},waiting={dataset:{clientGroup:'fold:waiting',defaultOpen:'1'},open:true},deferred={dataset:{clientGroup:'fold:deferred'},open:false};
  body.querySelectorAll=()=>rendered?[later,waiting,deferred]:[untouched,closedByUser,openedByUser];f.context.body=body;f.run('renderWorkdayBody(body,"새 하루")');
  assert.equal(later.open,true,'a fold the user never touched takes the new default');assert.equal(waiting.open,false,'a fold the user closed stays closed');assert.equal(deferred.open,true,'a fold the user opened stays open');
});
test('an open more menu pauses background redraws and closes on Escape or when an item is picked',async()=>{
  const f=fixture(),loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday());await loading;const body=f.nodes.get('#personal-body'),menu={open:true,contains:()=>false,querySelector:()=>null};
  f.nodes.set('.wd-more[open]',menu);body.querySelectorAll=selector=>selector==='.wd-more[open]'&&menu.open?[menu]:[];f.context.body=body;
  assert.equal(f.run('workdayInteractionActive(body)'),true,'an open menu counts as an interaction');
  let stopped=false;body.onkeydown({key:'Escape',target:{closest:()=>null},preventDefault(){},stopPropagation(){stopped=true;}});assert.equal(menu.open,false);assert.equal(stopped,true,'Escape closes the menu without closing the drawer');
  menu.open=true;await body.onclick({target:{closest:selector=>selector==='.wd-more'?menu:selector==='.wd-more-menu button'?{}:selector==='[data-client-recheck]'?{dataset:{clientRecheck:'9'}}:null}});assert.equal(menu.open,false,'picking an item closes the menu');
  f.nodes.delete('.wd-more[open]');menu.open=false;assert.equal(f.run('workdayInteractionActive(body)'),false);
});

test('the deadline digest opens a task from anywhere on its row and keeps one task attribute',()=>{
  const f=fixture(),opened=[],modalBody={},today={};f.context.recordDetail=message=>opened.push(message);f.nodes.set('.modal-body',modalBody);f.nodes.set('#digest-today',today);
  f.run("openTaskDetail=recordDetail;openModal=(title,html)=>{modalVersion++;modal.open=true;state.testModal=html;}");f.context.item={digest:{date:'2026-10-09',tasks:[task()]}};f.run('showDeadlineDigest(item)');
  const html=f.state.testModal;assert.match(html,/10월 9일 금에 모은 일/);assert.match(html,/data-digest-task="0"/);assert.doesNotMatch(html,/data-workday-task=/);
  const button={dataset:{digestTask:'0'}},row={querySelector:selector=>selector==='[data-digest-task]'?button:null};modalBody.onclick({target:{closest:selector=>selector==='[data-workday-row]'?row:null}});assert.equal(opened.length,1);assert.equal(opened[0].task.id,'t1');
});

test('a deferred customer row brings work back only from its own button',()=>{
  const f=fixture();f.run("state.integrated={canWrite:true};state.customerWork=[{id:'d1',title:'미룬 일',projectTitle:'봄 캠페인',group:'reply',dueDate:'2026-10-15'}];state.clientRechecks={d1:{state:'deferred',date:'2026-10-19',fingerprint:'a'.repeat(64)}}");
  const html=f.run('customerDeferredRowHtml(state.customerWork[0],{date:"2026-10-12"})');assert.match(html,/data-client-restore="0"[^>]*>꺼내기</);assert.doesNotMatch(html,/data-row-act/);assert.match(html,/<span class="wd-source">고객<\/span><span class="sr-only"> · <\/span><time datetime="2026-10-19">10월 19일<\/time> 다시 보기 · 봄 캠페인 · <time datetime="2026-10-15">10월 15일<\/time>까지/);
});
