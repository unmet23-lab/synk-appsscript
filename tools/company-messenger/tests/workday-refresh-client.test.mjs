import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function fixture({pathname='/',instant='2026-10-09T14:59:59.500Z'}={}){
  const nodes=new Map(),requests=[],toasts=[],timers=new Map(),documentEvents=new Map(),windowEvents=new Map();let now=Date.parse(instant),timerId=0;
  class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const node=()=>({innerHTML:'',value:'',textContent:'',disabled:false,checked:false,open:false,isConnected:true,listeners:{},dataset:{},values:{},classList:{add(){},remove(){},toggle(){}},contains:()=>false,setAttribute(){},removeAttribute(){},addEventListener(name,handler){this.listeners[name]=handler;},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],focus(){},close(){this.open=false;}});
  for(const key of ['#app','#modal','#drawer','#personal-body','#task-form','#task-result-picker','.workflow-source-actions','select[name=stage]','#task-reload','#workflow-stage-help','button[type=submit]','#reassign-reviewer','#replacement-reviewer','#reviewer-recovery-confirm'])nodes.set(key,node());
  const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener:(name,handler)=>documentEvents.set(name,handler)};
  const window={parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(name,handler)=>windowEvents.set(name,handler)};
  const context=vm.createContext({document,window,location:{pathname,origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{id,callback,delay});return id;},clearTimeout:id=>timers.delete(id),Date:ClockDate,URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=> 'refresh-request'},FormData:class extends Map{constructor(form){super(Object.entries(form.values));}}});
  const run=code=>vm.runInContext(code,context);run(source);
  run("Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},members:[{id:'u1',name:'담당'},{id:'u2',name:'검토'}],channels:[{id:'c1',name:'프로젝트',kind:'channel',memberIds:['u1','u2'],canPost:true}],channelId:'c1',chatCategory:'all',drawer:'personal',personalTab:'workday'});");
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.report=(message,error)=>toasts.push({message,error});
  run("api=request;toast=report;formError=message=>toast(message,true);attachDeadlineSettings=async()=>{};bindMessagePicker=()=>{};syncDrawerAccess=()=>{};openModal=(title,html)=>{modalVersion++;modal.open=true;state.testModal=html;};");
  return{context,run,nodes,requests,toasts,timers,documentEvents,windowEvents,state:run('state'),advance:milliseconds=>{now+=milliseconds;},fire:timer=>{timers.delete(timer.id);timer.callback();}};
}
function workday(date='2026-10-09',items=[],delay=1500){return{date,serverNow:'2026-10-09T14:59:59.500Z',nextDayRefreshAfterMs:delay,today:{groups:{reply:[],due:items,review:[],recovery:[]},counts:{reply:0,due:items.length,review:0,recovery:0},total:items.length},remaining:{groups:{upcoming:[],undated:[],waiting:[]},counts:{upcoming:0,undated:0,waiting:0},total:0},openTotal:items.length};}
function message(){return{id:'1',channelId:'c1',body:'요청 원문',task:{id:'t1',messageId:'1',channelId:'c1',title:'시안 수정',stage:'doing',status:'doing',assignee:{id:'u1',name:'담당'},reviewer:null,createdBy:{id:'u1',name:'담당'},dueDate:'2026-10-09',revision:7,canManage:true,allowedStages:['done']}};}
const flush=async()=>{for(let count=0;count<8;count++)await Promise.resolve();};
function startSave(f){f.context.message=message();f.run('taskDialog(message)');const form=f.nodes.get('#task-form');form.values={title:'시안 수정',assigneeId:'u1',reviewerId:'',dueDate:'2026-10-09',stage:'done'};return form.onsubmit({preventDefault(){}});}

test('a successful task save refreshes today even if the current chat cannot be read',async()=>{
  const f=fixture();f.run("refreshMessages=async()=>{throw new Error('현재 채팅방 읽기 실패')}");f.nodes.get('#personal-body').innerHTML='오늘 할 일 1개';const saving=startSave(f);
  f.requests[0].resolve({task:{...message().task,stage:'done'}});await flush();assert.equal(f.requests[1].path,'/api/workday');f.requests[1].resolve(workday());await saving;
  assert.ok(f.nodes.get('#personal-body').innerHTML.includes('오늘 할 일은 없어요'));assert.equal(f.nodes.get('#modal').open,false);assert.match(f.toasts[0].message,/저장했어요.*대화 내용.*불러오지 못/s);assert.equal(f.toasts[0].error,true);
});

test('a files refresh failure cannot prevent the personal workday from updating after a save',async()=>{
  const f=fixture();f.run("state.mode='files';refreshMessages=async()=>{};loadFiles=async()=>{throw new Error('파일 조회 실패')}");const saving=startSave(f);f.requests[0].resolve({task:{...message().task,stage:'done'}});await flush();assert.equal(f.requests[1].path,'/api/workday');f.requests[1].resolve(workday());await saving;
  assert.ok(f.nodes.get('#personal-body').innerHTML.includes('오늘 할 일은 없어요'));assert.equal(f.toasts[0].error,true);
});

test('a saved task with failed chat and workday refreshes never turns unknown work into an empty day',async()=>{
  const f=fixture();f.run("refreshMessages=async()=>{throw new Error('채팅 조회 실패')}");const saving=startSave(f);f.requests[0].resolve({task:{...message().task,stage:'done'}});await flush();assert.equal(f.requests[1].path,'/api/workday');f.requests[1].reject(new Error('오늘 업무 조회 실패'));await saving;
  const html=f.nodes.get('#personal-body').innerHTML;assert.ok(html.includes('할 일을 불러오지 못했어요'));assert.ok(!html.includes('오늘 할 일은 없어요'));assert.ok(html.includes('data-productivity-refresh'));assert.match(f.toasts[0].message,/저장했어요.*불러오지 못/s);
});

for(const [label,change] of [['another account',"state.user={id:'u2'}"],['a new login session','resetWorkNotificationState()']]){
  test(`a late save cannot refresh or toast into ${label}`,async()=>{
    const f=fixture();f.run('refreshMessages=async()=>{}');const saving=startSave(f);f.run(change);f.requests[0].resolve({task:{...message().task,stage:'done'}});await saving;assert.equal(f.requests.length,1);assert.equal(f.toasts.length,0);
  });
}

test('reviewer reassignment refreshes today despite a failed unrelated chat read',async()=>{
  const f=fixture(),original=message();original.task={...original.task,stage:'review',reviewerId:'former',reviewerUnavailable:true,canReassignReviewer:true,assignee:{id:'u2',name:'다른 담당'},resultMessageId:'2'};f.context.message=original;
  f.run("refreshMessages=async()=>{throw new Error('채팅 조회 실패')};modal.open=true;bindReviewerRecovery(message,modalVersion);taskDialog=value=>state.recoveredTask=value.task;");f.nodes.get('#replacement-reviewer').value='u1';f.nodes.get('#reviewer-recovery-confirm').checked=true;
  const saving=f.nodes.get('#reassign-reviewer').onclick();f.requests[0].resolve({task:{...original.task,reviewerId:'u1',reviewer:{id:'u1',name:'담당'},reviewerUnavailable:false,revision:8}});await flush();assert.equal(f.requests[1].path,'/api/workday');f.requests[1].resolve(workday());await saving;
  assert.equal(f.state.recoveredTask.revision,8);assert.ok(f.nodes.get('#personal-body').innerHTML.includes('오늘 할 일은 없어요'));assert.equal(f.toasts[0].error,true);
});

test('a late reviewer reassignment cannot reopen a dialog after the login session changes',async()=>{
  const f=fixture(),original=message();original.task={...original.task,stage:'review',reviewerId:'former',reviewerUnavailable:true,canReassignReviewer:true,assignee:{id:'u2',name:'다른 담당'},resultMessageId:'2'};f.context.message=original;
  f.run('modal.open=true;bindReviewerRecovery(message,modalVersion);taskDialog=value=>state.recoveredTask=value.task;');f.nodes.get('#replacement-reviewer').value='u1';f.nodes.get('#reviewer-recovery-confirm').checked=true;
  const saving=f.nodes.get('#reassign-reviewer').onclick();f.run('resetWorkNotificationState()');f.requests[0].resolve({task:{...original.task,revision:8}});await saving;assert.equal(f.state.recoveredTask,undefined);assert.equal(f.requests.length,1);assert.equal(f.toasts.length,0);
});

for(const stage of ['requested','doing']){
  test(`a ${stage} reviewer recovery preserves the existing task and does not claim submitted-result review`,async()=>{
    const f=fixture(),original=message();original.task={...original.task,stage,assignee:{id:'u2',name:'다른 담당'},reviewer:{id:'former',name:'기존 검토자'},reviewerId:'former',reviewerUnavailable:true,canReassignReviewer:true,allowedStages:[],resultMessageId:null};f.context.message=original;
    f.run("state.members.push({id:'former',name:'기존 검토자'});state.channels[0].memberIds.push('former');refreshMessages=async()=>{};refreshDetailViews=async()=>{};taskDialog(message)");const html=f.state.testModal;assert.ok(html.includes('검토자 바꾸기'));assert.ok(html.includes('요청과 담당은 그대로'));assert.ok(!html.includes('같은 결과물로 새 검토자에게 다시 맡길'));const reviewerField=html.match(/<select name="reviewerId"[^>]*>([\s\S]*?)<\/select>/);assert.equal((reviewerField[1].match(/value="former"/g)||[]).length,1);assert.ok(reviewerField[1].includes('검토할 수 없음 · 기존 검토자'));
    f.nodes.get('#replacement-reviewer').value='u1';f.nodes.get('#reviewer-recovery-confirm').checked=true;const saving=f.nodes.get('#reassign-reviewer').onclick();assert.deepEqual({...f.requests[0].options.body},{revision:7,reviewerId:'u1',reassignReviewer:true});
    const updated={...original.task,revision:8,reviewerId:'u1',reviewer:{id:'u1',name:'담당'},reviewerUnavailable:false,canReassignReviewer:false};f.requests[0].resolve({task:updated});await saving;assert.equal(updated.stage,stage);assert.equal(updated.resultMessageId,null);assert.equal(updated.title,original.task.title);assert.equal(updated.dueDate,original.task.dueDate);assert.equal(updated.assignee.id,'u2');assert.match(f.toasts[0].message,/검토자를 바꿨어요/);assert.ok(!f.toasts[0].message.includes('같은 결과물'));
  });
}

test('an unavailable assignee starts on a required empty placeholder instead of selecting another crew member',()=>{
  const f=fixture(),original=message();original.task={...original.task,stage:'accepted',assignee:{id:'u2',name:'기존 담당자'},assigneeUnavailable:true,allowedStages:[]};f.context.message=original;f.run('taskDialog(message)');const field=f.state.testModal.match(/<select name="assigneeId"[^>]*>([\s\S]*?)<\/select>/);assert.ok(field);assert.match(field[1],/<option value="" disabled selected>담당을 다시 골라 주세요<\/option>/);assert.equal((field[1].match(/\bselected\b/g)||[]).length,1);
  f.context.message={...original,task:null};f.run('taskDialog(message)');const creation=f.state.testModal.match(/<select name="assigneeId"[^>]*>([\s\S]*?)<\/select>/);assert.ok(!creation[1].includes('담당을 다시 골라 주세요'));assert.match(creation[1],/<option value="u1" selected>/);
});

test('returning to a visible document reads today independently of failed chat reads',async()=>{
  const f=fixture();f.run("refreshChannels=async()=>{throw new Error('방 조회 실패')};refreshMessages=async()=>{throw new Error('채팅 조회 실패')}");f.documentEvents.get('visibilitychange')();assert.equal(f.requests[0].path,'/api/workday');f.requests[0].resolve(workday('2026-10-10'));await flush();assert.ok(f.nodes.get('#personal-body').innerHTML.includes('2026-10-10'));
});

test('showing the workspace module reads today even when channel refresh fails',async()=>{
  const f=fixture({pathname:'/messenger/'});f.run("refreshChannels=async()=>{throw new Error('방 조회 실패')};refreshMessages=async()=>{}");const visible=f.windowEvents.get('message')({origin:'http://localhost',source:f.context.window.parent,data:{type:'workspace:visible',visible:true}});
  assert.equal(f.requests[0].path,'/api/workday');f.requests[0].resolve(workday('2026-10-10'));await visible;await flush();assert.ok(f.nodes.get('#personal-body').innerHTML.includes('2026-10-10'));assert.equal(f.timers.size,1);
});

test('one timer uses the server midnight delay even when the PC clock is one second fast',async()=>{
  const f=fixture({instant:'2026-10-09T15:00:00.500Z'}),loading=f.run('loadPersonalPanel()');assert.equal(f.timers.size,0,'no client-clock timer is armed before the server response');f.requests[0].resolve(workday());await loading;assert.equal(f.timers.size,1);const timer=[...f.timers.values()][0];assert.equal(timer.delay,1500);
  f.advance(1500);f.fire(timer);assert.equal(f.requests[1].path,'/api/workday');f.requests[1].resolve(workday('2026-10-10',[message().task],86399000));await flush();assert.ok(f.nodes.get('#personal-body').innerHTML.includes('2026-10-10'));assert.ok(f.nodes.get('#personal-body').innerHTML.includes('오늘 할 일 1개'));assert.equal(f.timers.size,1);
});

test('an older response cannot overwrite the next days work loaded on visibility',async()=>{
  const f=fixture();f.run('refreshChannels=async()=>{};refreshMessages=async()=>{}');const old=f.run('loadPersonalPanel()');f.documentEvents.get('visibilitychange')();assert.equal(f.requests.length,2);f.requests[1].resolve(workday('2026-10-10'));await flush();f.requests[0].resolve(workday('2026-10-09',[message().task]));await old;assert.ok(f.nodes.get('#personal-body').innerHTML.includes('2026-10-10'));assert.ok(!f.nodes.get('#personal-body').innerHTML.includes('2026-10-09'));
});

test('a response still carrying the previous day schedules another server check rather than waiting a PC day',async()=>{
  const f=fixture({instant:'2026-10-09T15:00:01.100Z'}),loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday('2026-10-09',[],1001));await loading;const first=[...f.timers.values()][0];assert.equal(first.delay,1001);f.fire(first);f.requests[1].resolve(workday('2026-10-09',[],1500));await flush();assert.equal([...f.timers.values()][0].delay,1500);
});

test('missing or invalid server delays never fall back to the PC clock',async()=>{
  for(const delay of [undefined,null,'1500',0,1,1000,1500.5,86401001]){const f=fixture(),snapshot=workday();snapshot.nextDayRefreshAfterMs=delay;f.run("Date.now=()=>{throw new Error('PC clock must not schedule workday')}");const loading=f.run('loadPersonalPanel()');f.requests[0].resolve(snapshot);await loading;assert.equal(f.timers.size,0,String(delay));}
});

test('starting another workday read replaces the midnight timer instead of adding one',async()=>{
  const f=fixture(),first=f.run('loadPersonalPanel()');f.requests[0].resolve(workday());await first;const old=[...f.timers.values()][0],second=f.run('loadPersonalPanel()');assert.equal(f.timers.size,0);assert.ok(!f.timers.has(old.id));f.requests[1].resolve(workday());await second;assert.equal(f.timers.size,1);f.fire(old);assert.equal(f.requests.length,2);
});

test('logging in again as the same user invalidates the old timer without canceling the new one',async()=>{
  const f=fixture(),loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday());await loading;const old=[...f.timers.values()][0];f.run('resetWorkNotificationState();scheduleWorkdayRefresh(1500)');const next=[...f.timers.values()][0];assert.notEqual(next.id,old.id);f.fire(old);assert.equal(f.requests.length,1);assert.equal(f.timers.size,1);assert.ok(f.timers.has(next.id));
});

test('a module hidden behind the workspace does not read workday on document visibility',()=>{
  const f=fixture({pathname:'/messenger/'});f.run('refreshChannels=async()=>{};refreshMessages=async()=>{}');f.documentEvents.get('visibilitychange')();assert.equal(f.requests.length,0);assert.equal(f.timers.size,0);
});

test('a session change while views reload suppresses both the old list and the save notification',async()=>{
  const f=fixture();f.run('refreshMessages=async()=>{}');const saving=startSave(f);f.requests[0].resolve({task:{...message().task,stage:'done'}});await flush();f.run('resetWorkNotificationState()');f.nodes.get('#personal-body').innerHTML='새 세션 업무';f.requests[1].resolve(workday());await saving;assert.equal(f.nodes.get('#personal-body').innerHTML,'새 세션 업무');assert.equal(f.toasts.length,0);
});

for(const [label,change] of [['a different panel',"state.personalTab='tasks';scheduleWorkdayRefresh()"],['a hidden document',"document.hidden=true;documentEvents.get('visibilitychange')()"],['logout',"state.user=null;resetWorkNotificationState()"]]){
  test(`a canceled midnight callback makes no API read after ${label}`,async()=>{
    const f=fixture();f.context.documentEvents=f.documentEvents;const loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday());await loading;const timer=[...f.timers.values()][0];f.run(change);assert.equal(f.timers.size,0);f.fire(timer);assert.equal(f.requests.length,1);
  });
}

test('a workday response from the previous login cannot replace a new session screen',async()=>{
  const f=fixture(),loading=f.run('loadPersonalPanel()');f.run('resetWorkNotificationState()');f.nodes.get('#personal-body').innerHTML='새 로그인 화면';f.requests[0].resolve(workday());await loading;assert.equal(f.nodes.get('#personal-body').innerHTML,'새 로그인 화면');assert.equal(f.timers.size,0);
});

test('hiding the workspace module cancels its date timer',async()=>{
  const f=fixture({pathname:'/messenger/'});f.run('moduleVisible=true');const loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday());await loading;const timer=[...f.timers.values()][0];await f.windowEvents.get('message')({origin:'http://localhost',source:f.context.window.parent,data:{type:'workspace:visible',visible:false}});assert.equal(f.timers.size,0);f.fire(timer);assert.equal(f.requests.length,1);
});
