import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// 할 일 상세 3판(2026-10-20 유호님 A안): 단계마다 주 단추 하나, 수락·시작·완료는 같은 revision으로 바로 PATCH,
// 수정 요청은 한 번 더 확인한 뒤 답글 쓰기로, 검토 맡기기·다시 열기·검토자 정하기는 바꾸기 양식을 연다.
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
const text=html=>String(html).replace(/<[^>]*>/g,'');
function fixture(userId='u1'){
  const nodes=new Map(),requests=[],toasts=[],calls=[];
  const node=()=>{const classes=new Set();return {innerHTML:'',value:'',textContent:'',disabled:false,open:false,isConnected:true,listeners:{},dataset:{},values:{},classes,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),toggle:(name,force)=>{const on=force===undefined?!classes.has(name):Boolean(force);if(on)classes.add(name);else classes.delete(name);return on;},contains:name=>classes.has(name)},setAttribute(){},removeAttribute(){},addEventListener(name,handler){this.listeners[name]=handler;},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],focus(){calls.push(['focus',key(this)]);},close(){this.open=false;}};};
  const key=value=>[...nodes.entries()].find(([,item])=>item===value)?.[0]||'?';
  for(const name of ['#app','#modal','#personal-body','#drawer','#task-actions','#task-changes-confirm','#task-action-error','#task-action-reload','.task-management','#task-form','select[name=stage]','#workflow-stage-help','[data-task-manage-entry]','#replacement-reviewer','[data-picker-query]','select[name=reviewerId]','#task-reload','button[type=submit]'])nodes.set(name,node());
  const buttons=[];nodes.get('#modal').querySelectorAll=selector=>selector==='[data-task-action]'?buttons:[];
  const document={hidden:false,activeElement:null,querySelector:name=>nodes.get(name)||null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=>'request-uuid'}});
  const run=code=>vm.runInContext(code,context);run(source);
  run("Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},members:[{id:'u1',name:'담당'},{id:'u2',name:'검토'},{id:'u3',name:'하윤'}],channels:[{id:'c1',name:'가을 캠페인',kind:'channel',memberIds:['u1','u2','u3'],canPost:true}],channelId:'c1'});");
  run(`state.user=state.members.find(person=>person.id==='${userId}');`);
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.record=(...args)=>calls.push(args);
  run("api=request;toast=(message,error)=>record('toast',message,Boolean(error));openModal=(title,html)=>{modalVersion++;modal.open=true;state.testTitle=title;state.testModal=html;};bindMessagePicker=()=>{};refreshTaskViews=async(context,message)=>record('refresh',message);openSearchMessage=async message=>record('open',message.id);startReply=message=>record('reply',message.id);");
  return {context,run,nodes,requests,calls,buttons,state:run('state')};
}
const base={id:'t1',messageId:'1',channelId:'c1',title:'가을 캠페인 썸네일 3안',stage:'requested',status:'todo',assignee:{id:'u1',name:'담당'},reviewer:null,reviewerId:null,createdBy:{id:'u3',name:'하윤'},dueDate:'2026-10-22',revision:4,allowedStages:['accepted'],canManage:true,workday:{date:'2026-10-20',todayReasons:['reply'],remainingReasons:[]}};
const message=(task={})=>({id:'1',channelId:'c1',body:'썸네일 3안 부탁해요. 금요일 오전까지 보고 고를게요.',user:{id:'u3',name:'하윤'},createdAt:'2026-10-19T01:12:00Z',task:{...base,...task}});
const labels=(f,task,userId)=>{if(userId)f.run(`state.user=state.members.find(person=>person.id==='${userId}');`);f.context.message=message(task);return Array.from(f.run('taskDetailActions(message)'),item=>(item.primary?'*':'')+item.label);};
const click=(f,dataset)=>{const button={dataset,disabled:false};f.buttons.push(button);return f.nodes.get('#task-actions').onclick({target:{closest:selector=>selector==='[data-task-action]'?button:null}});};

test('each stage and role offers at most one primary action that the server would accept',()=>{
  const f=fixture(),cases=[
    [{stage:'requested',allowedStages:['accepted']},'u1',['*수락하기']],
    [{stage:'requested',allowedStages:[]},'u3',[]],
    [{stage:'accepted',reviewer:{id:'u2',name:'검토'},reviewerId:'u2',allowedStages:['doing']},'u1',['*시작하기']],
    [{stage:'accepted',allowedStages:['doing','done']},'u1',['*시작하기','완료']],
    [{stage:'doing',reviewer:{id:'u2',name:'검토'},reviewerId:'u2',allowedStages:['review']},'u1',['*검토 맡기기']],
    [{stage:'changes',allowedStages:['review','done']},'u1',['*완료','검토 맡기기']],
    [{stage:'review',assignee:{id:'u3',name:'하윤'},reviewer:{id:'u1',name:'담당'},reviewerId:'u1',resultMessageId:'2',allowedStages:['changes','done']},'u1',['*완료','수정 요청']],
    [{stage:'review',reviewer:{id:'u2',name:'검토'},reviewerId:'u2',resultMessageId:'2',allowedStages:[]},'u1',[]],
    [{stage:'done',allowedStages:['doing']},'u1',['다시 열기']],
    [{stage:'doing',reviewer:null,reviewerId:'former',reviewerUnavailable:true,canReassignReviewer:true,assignee:{id:'u2',name:'검토'},allowedStages:[]},'u3',['*검토자 정하기']],
    [{stage:'doing',reviewer:null,reviewerId:'former',reviewerUnavailable:true,allowedStages:[]},'u1',[]],
    [{stage:'requested',canManage:false,allowedStages:[]},'u2',[]],
  ];
  for(const [task,userId,expected] of cases){const actual=labels(f,task,userId);assert.deepEqual(actual,expected,JSON.stringify(task));assert.ok(actual.filter(label=>label.startsWith('*')).length<=1);}
  f.run("state.integrated={canWrite:false}");assert.deepEqual(labels(f,{stage:'requested',allowedStages:['accepted']},'u1'),[],'a view-only account gets no action');
});

test('the detail puts the request above one black action and folds the reasons',()=>{
  const f=fixture();f.context.message=message();f.run('taskDialog(message)');const html=f.state.testModal;
  assert.equal(f.state.testTitle,'할 일 · 가을 캠페인');assert.ok(html.indexOf('썸네일 3안 부탁해요')<html.indexOf('id="task-actions"'),'the request comes before the action bar');
  const bar=html.slice(html.indexOf('id="task-actions"'),html.indexOf('</div>',html.indexOf('id="task-actions"')));assert.equal((bar.match(/class="button primary"/g)||[]).length,1);assert.match(bar,/data-task-action="stage" data-task-stage="accepted">수락하기</);assert.match(bar,/data-task-manage-entry[^>]*>바꾸기</);
  assert.match(html,/<details class="task-management" id="task-management">/);assert.match(html,/<summary>.*왜 오늘 할 일인가요\?/);assert.match(html,/아직 수락하지 않은 요청이라 기한과 상관없이 오늘 봐야 해요/);assert.match(html,/언제 끝나나요\?/);
  assert.match(html,/<span>요청<\/span><strong>하윤<\/strong>/,'the people block names the requester');assert.match(text(html),/하윤 · 10월 19일 오전 10:12 · 범위가 애매하면/);assert.match(html,/<div class="is-me"><span>담당<\/span><strong>나<\/strong>/);assert.match(html,/data-source-message="1"/);assert.match(html,/id="task-add-reply">답글 쓰기</);
});

test('review puts the submitted result above complete and changes, and a viewer-less task shows no form',()=>{
  const f=fixture();f.context.message=message({stage:'review',assignee:{id:'u3',name:'하윤'},reviewer:{id:'u1',name:'담당'},reviewerId:'u1',resultMessageId:'2',resultMessage:{id:'2',body:'릴스_1편_편집본.mp4',user:{id:'u3',name:'하윤'},createdAt:'2026-10-20T07:05:00Z'},allowedStages:['changes','done']});f.run('taskDialog(message)');const html=f.state.testModal;
  assert.ok(html.indexOf('올린 결과물')<html.indexOf('id="task-actions"'));assert.match(html,/릴스_1편_편집본\.mp4/);assert.match(html,/data-source-message="2"/);assert.match(html,/data-task-action="stage" data-task-stage="done">완료</);assert.match(html,/data-task-action="changes">수정 요청</);assert.match(html,/id="task-changes-confirm"/);
  f.context.message=message({canManage:false,allowedStages:[]});f.run("state.user=state.members.find(person=>person.id==='u2');taskDialog(message)");assert.doesNotMatch(f.state.testModal,/task-management|id="task-actions"|data-task-action=/);
});

test('accepting sends only the stage with the shown revision and redraws the same detail',async()=>{
  const f=fixture();f.context.message=message();f.run('taskDialog(message)');f.run('taskDialog=value=>{state.redrawn=value.task}');
  const pending=click(f,{taskAction:'stage',taskStage:'accepted'});assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/messages/1/task');assert.equal(f.requests[0].options.method,'PATCH');assert.deepEqual({...f.requests[0].options.body},{revision:4,stage:'accepted'});assert.equal(f.buttons[0].disabled,true);
  f.requests[0].resolve({task:{...base,stage:'accepted',revision:5,allowedStages:['doing']}});await pending;
  assert.equal(f.state.redrawn.stage,'accepted');assert.equal(f.state.redrawn.revision,5);assert.deepEqual(f.calls.filter(call=>call[0]==='refresh'),[['refresh','수락했어요.']]);
});

test('a conflict keeps the detail open, explains it and only offers a reload',async()=>{
  const f=fixture();f.context.message=message();f.run('taskDialog(message)');f.run('taskDialog=value=>{state.redrawn=value.task}');
  const pending=click(f,{taskAction:'stage',taskStage:'accepted'});f.requests[0].reject(Object.assign(new Error('changed'),{status:409}));await pending;
  assert.equal(f.state.redrawn,undefined);assert.equal(f.nodes.get('#modal').open,true);assert.match(f.nodes.get('#task-action-error').textContent,/다른 크루가 바꿨어요.*새로 불러온 뒤/);assert.equal(f.nodes.get('#task-action-error').classes.has('hidden'),false);assert.equal(f.nodes.get('#task-action-reload').classes.has('hidden'),false);assert.equal(f.buttons[0].disabled,true);assert.equal(f.calls.filter(call=>call[0]==='refresh').length,0);
  const reload=f.nodes.get('#task-action-reload').onclick();assert.equal(f.requests[1].path,'/api/messages/1');f.requests[1].resolve({message:message({stage:'accepted',revision:5})});await reload;assert.equal(f.state.redrawn.stage,'accepted');
});

test('other failures stay retryable and a session change drops the late answer',async()=>{
  const f=fixture();f.context.message=message();f.run('taskDialog(message)');let pending=click(f,{taskAction:'stage',taskStage:'accepted'});f.requests[0].reject(new Error('잠시 연결이 끊겼어요.'));await pending;
  assert.equal(f.nodes.get('#task-action-error').textContent,'잠시 연결이 끊겼어요.');assert.equal(f.buttons[0].disabled,false);assert.equal(f.nodes.get('#task-action-reload').classes.has('hidden'),true);
  f.run('taskDialog=value=>{state.redrawn=value.task}');pending=click(f,{taskAction:'stage',taskStage:'accepted'});f.run('resetWorkNotificationState()');f.requests[1].resolve({task:{...base,stage:'accepted',revision:5}});await pending;assert.equal(f.state.redrawn,undefined);assert.equal(f.calls.filter(call=>call[0]==='refresh').length,0);
});

test('asking for changes needs a second confirmation, then opens a reply in the original chat',async()=>{
  const f=fixture();f.context.message=message({stage:'review',assignee:{id:'u3',name:'하윤'},reviewer:{id:'u1',name:'담당'},reviewerId:'u1',resultMessageId:'2',allowedStages:['changes','done']});f.run('taskDialog(message)');
  await click(f,{taskAction:'changes'});assert.equal(f.requests.length,0);assert.equal(f.nodes.get('#task-actions').classes.has('hidden'),true);assert.equal(f.nodes.get('#task-changes-confirm').classes.has('hidden'),false);
  await click(f,{taskAction:'changes-cancel'});assert.equal(f.nodes.get('#task-actions').classes.has('hidden'),false);assert.equal(f.nodes.get('#task-changes-confirm').classes.has('hidden'),true);assert.equal(f.requests.length,0);
  const pending=f.nodes.get('#task-changes-confirm').onclick({target:{closest:selector=>selector==='[data-task-action]'?{dataset:{taskAction:'changes-confirm'},disabled:false}:null}});assert.deepEqual({...f.requests[0].options.body},{revision:4,stage:'changes'});f.requests[0].resolve({task:{...base,stage:'changes',revision:5}});await pending;
  assert.equal(f.nodes.get('#modal').open,false);assert.deepEqual(f.calls.filter(call=>['refresh','open','reply'].includes(call[0])),[['refresh','수정 요청으로 바꿨어요. 답글로 고칠 점을 남겨 주세요.'],['open','1'],['reply','1']]);
});

test('submitting for review, reopening and reviewer recovery open the change form instead of saving',async()=>{
  const f=fixture(),select=f.nodes.get('select[name=stage]');select.options=[{value:'doing'},{value:'review'}];
  f.context.message=message({stage:'doing',reviewer:{id:'u2',name:'검토'},reviewerId:'u2',allowedStages:['review']});f.run('taskDialog(message)');
  await click(f,{taskAction:'submit'});assert.equal(f.requests.length,0);assert.equal(f.nodes.get('.task-management').open,true);assert.equal(select.value,'review');assert.match(f.nodes.get('#workflow-stage-help').textContent,/검토자가 결과물을 보고/);assert.ok(f.calls.some(call=>call[0]==='focus'&&call[1]==='[data-picker-query]'));
  f.nodes.get('.task-management').open=false;select.options=[{value:'done'},{value:'doing'}];f.context.message=message({stage:'done',allowedStages:['doing']});f.run('taskDialog(message)');await click(f,{taskAction:'reopen'});assert.equal(select.value,'doing');assert.equal(f.requests.length,0);
  f.nodes.get('.task-management').open=false;f.context.message=message({stage:'doing',reviewer:null,reviewerId:'former',reviewerUnavailable:true,canReassignReviewer:true,assignee:{id:'u2',name:'검토'},allowedStages:[]});f.run("state.user=state.members.find(person=>person.id==='u3');taskDialog(message)");await click(f,{taskAction:'recovery'});assert.equal(f.nodes.get('.task-management').open,true);assert.ok(f.calls.some(call=>call[0]==='focus'&&call[1]==='#replacement-reviewer'));assert.equal(f.requests.length,0);
});

test('the change button toggles the same form open and closed',()=>{
  const f=fixture();f.context.message=message();f.run('taskDialog(message)');const entry=f.nodes.get('[data-task-manage-entry]'),management=f.nodes.get('.task-management');
  entry.onclick();assert.equal(management.open,true);entry.onclick();assert.equal(management.open,false);
});

test('due labels read as people talk while the machine date stays in the markup',()=>{
  const f=fixture(),due=(value,today,options)=>f.run(`workdayDueHtml(${JSON.stringify(value)},${JSON.stringify(today)},${JSON.stringify(options||{})})`);
  assert.equal(due('2026-10-18','2026-10-20'),'<b>2일 지남</b>');assert.equal(due('2026-10-20','2026-10-20'),'오늘까지');assert.equal(due('2026-10-21','2026-10-20'),'내일까지');assert.equal(due('2026-10-27','2026-10-20'),'<time datetime="2026-10-27">10월 27일</time>까지');assert.equal(due(null,'2026-10-20'),'기한 없음');
  assert.equal(due('2026-10-22','2026-10-20',{long:true}),'<time datetime="2026-10-22">10월 22일 목요일</time>까지');assert.equal(due('2026-10-18','2026-10-20',{long:true}),'<time datetime="2026-10-18">10월 18일 일요일</time>까지 · <b>2일 지남</b>');
  assert.equal(due('2026-02-30','2026-10-20'),'2026-02-30');
});

test('the drawer tabs carry today and notification counts and the footer shows the deadline setting value',async()=>{
  const f=fixture(),counts=new Map();for(const name of ['workday','notifications']){const node={hidden:true,textContent:''};counts.set(name,node);f.nodes.set(`[data-tab-count="${name}"]`,node);}
  f.run("setPersonalTabCount('workday',7);setPersonalTabCount('notifications',120)");assert.deepEqual({...counts.get('workday')},{hidden:false,textContent:'7'});assert.deepEqual({...counts.get('notifications')},{hidden:false,textContent:'99+'});
  f.run("setPersonalTabCount('workday',0)");assert.equal(counts.get('workday').hidden,true);f.run("setPersonalTabCount('workday',null)");assert.equal(counts.get('workday').hidden,true);
  assert.deepEqual(Array.from(f.run('personalTabs'),([,label])=>label),['오늘','바뀐 것','전체','알림','결정·최종본','저장']);
  for(const [settings,label] of [[{enabled:false},'마감 알림 꺼짐'],[{enabled:true,schedulerEnabled:false},'마감 알림 · 회사 알림 꺼짐'],[{enabled:true,includeWeekends:true,schedulerEnabled:true},'마감 알림 · 매일 오전 9시'],[{enabled:true,includeWeekends:false,schedulerEnabled:true},'마감 알림 · 평일 오전 9시']]){f.context.settings=settings;assert.equal(f.run('deadlineSettingsLabel(settings)'),label);}
  const button={hidden:true,isConnected:true,textContent:'마감 알림 설정',dataset:{deadlineLabel:''}};f.nodes.set('#deadline-settings',button);const attaching=f.run('attachDeadlineSettings()');f.requests[0].resolve({enabled:true,includeWeekends:false,schedulerEnabled:true});await attaching;assert.equal(button.hidden,false);assert.equal(button.textContent,'마감 알림 · 평일 오전 9시');
});
test('asking for changes folds an open change form, and the form brings the action bar back',async()=>{
  const f=fixture();f.context.message=message({stage:'review',assignee:{id:'u3',name:'하윤'},reviewer:{id:'u1',name:'담당'},reviewerId:'u1',resultMessageId:'2',allowedStages:['changes','done']});f.run('taskDialog(message)');
  const entry=f.nodes.get('[data-task-manage-entry]'),management=f.nodes.get('.task-management');entry.onclick();assert.equal(management.open,true);
  await click(f,{taskAction:'changes'});assert.equal(management.open,false,'the confirmation never sits on top of the open form');assert.equal(f.nodes.get('#task-changes-confirm').classes.has('hidden'),false);
  await click(f,{taskAction:'submit'});assert.equal(management.open,true);assert.equal(f.nodes.get('#task-changes-confirm').classes.has('hidden'),true);assert.equal(f.nodes.get('#task-actions').classes.has('hidden'),false);
});

test('while an action is sent the change form is locked, and a conflict closes it',async()=>{
  const f=fixture(),entry=f.nodes.get('[data-task-manage-entry]'),management=f.nodes.get('.task-management'),submit={disabled:false},reassign={disabled:false};f.nodes.set('#task-form button[type=submit]',submit);f.nodes.set('#reassign-reviewer',reassign);
  f.context.message=message();f.run('taskDialog(message)');management.open=true;const pending=click(f,{taskAction:'stage',taskStage:'accepted'});
  assert.equal(entry.disabled,true);assert.equal(submit.disabled,true);assert.equal(reassign.disabled,true);
  f.requests[0].reject(Object.assign(new Error('changed'),{status:409}));await pending;assert.equal(management.open,false);assert.equal(entry.disabled,true);assert.equal(submit.disabled,true);
});

test('a confirmed change request closes the detail before the views refresh',async()=>{
  const f=fixture(),seen=[];f.context.seen=seen;f.context.message=message({stage:'review',assignee:{id:'u3',name:'하윤'},reviewer:{id:'u1',name:'담당'},reviewerId:'u1',resultMessageId:'2',allowedStages:['changes','done']});f.run('taskDialog(message)');f.run('refreshTaskViews=async()=>{seen.push(modal.open)}');
  const pending=f.nodes.get('#task-changes-confirm').onclick({target:{closest:selector=>selector==='[data-task-action]'?{dataset:{taskAction:'changes-confirm'},disabled:false}:null}});f.requests[0].resolve({task:{...base,stage:'changes',revision:5}});await pending;assert.deepEqual(seen,[false]);
});

test('finished work drops relative due words, own requests read in the first person and view-only accounts get no button steps',()=>{
  const f=fixture();f.context.message=message({stage:'done',dueDate:'2026-10-18',allowedStages:['doing'],workday:{date:'2026-10-20',todayReasons:[],remainingReasons:[]}});let html=f.run('taskDetailHtml(message,{managementHtml:"x"})');
  assert.match(html,/<time datetime="2026-10-18">10월 18일 일요일<\/time>까지<\/span>/);assert.doesNotMatch(html,/지남/);
  f.context.message=message({stage:'review',assignee:{id:'u2',name:'검토'},reviewer:{id:'u1',name:'담당'},reviewerId:'u1',createdBy:{id:'u1',name:'담당'},resultMessageId:'2',resultMessage:{id:'2',body:'결과.mp4'},allowedStages:['changes','done']});html=f.run('taskDetailHtml(message)');assert.match(html,/ · 내가 요청한 일이에요\./);assert.doesNotMatch(html,/담당 님이 요청한 일이에요/);
  f.run("state.integrated={canWrite:false}");f.context.message=message({stage:'requested',allowedStages:['accepted']});html=f.run('taskDetailHtml(message)');assert.match(html,/이 계정으로는 상태를 바꿀 수 없어요/);assert.doesNotMatch(html,/수락하기/);
});

test('a reviewer with nothing to change gets neither the change button nor an empty form',()=>{
  const f=fixture();f.context.message=message({stage:'doing',assignee:{id:'u3',name:'하윤'},createdBy:{id:'u3',name:'하윤'},reviewer:{id:'u1',name:'담당'},reviewerId:'u1',allowedStages:[]});f.run('taskDialog(message)');
  assert.doesNotMatch(f.state.testModal,/data-task-manage-entry|class="task-management"|id="task-form"/);assert.match(f.state.testModal,/하윤의 차례예요/);
});
