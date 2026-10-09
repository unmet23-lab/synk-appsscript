import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function fixture(){
  const nodes=new Map(),requests=[],errors=[];
  const node=()=>({innerHTML:'',value:'',textContent:'',disabled:false,open:false,isConnected:true,listeners:{},dataset:{},values:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(name,handler){this.listeners[name]=handler;},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],focus(){},insertAdjacentHTML(_position,html){this.innerHTML+=html;},close(){this.open=false;}});
  for(const key of ['#app','#modal','#personal-body','#drawer','#catchup-read','#decisions-search','#task-form','#task-result-picker','.workflow-source-actions','select[name=stage]','#task-reload','#workflow-stage-help','button[type=submit]'])nodes.set(key,node());
  const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=> 'request-uuid'},FormData:class extends Map{constructor(form){super(Object.entries(form.values));}}});
  const run=code=>vm.runInContext(code,context);run(source);context.originalNotificationCount=run('refreshNotificationCount');
  run("Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},members:[{id:'u1',name:'담당'},{id:'u2',name:'검토'}],channels:[{id:'c1',name:'프로젝트',kind:'channel',memberIds:['u1','u2'],canPost:true}],channelId:'c1',drawer:'personal'});");
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.report=value=>errors.push(value);
  run('api=request;toast=report;refreshMessages=async()=>{};refreshDetailViews=async()=>{};refreshNotificationCount=async()=>{};');
  return{context,run,nodes,requests,errors,node,state:run('state')};
}
const task={id:'t1',messageId:'1',channelId:'c1',title:'시안 수정',stage:'review',status:'doing',assignee:{id:'u1',name:'담당'},reviewer:{id:'u2',name:'검토'},createdBy:{id:'u1',name:'담당'},dueDate:'2026-10-08',revision:7,resultMessageId:'2',allowedStages:[],canManage:true};

test('today renders actual stage, due urgency and all four work groups without a company API in standalone',async()=>{
  const f=fixture();f.run("state.personalTab='workday'");const loading=f.run('loadPersonalPanel()');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/workday');
  f.requests[0].resolve({date:'2026-10-09',groups:{reply:[],due:[task],review:[],waiting:[task]},counts:{reply:0,due:1,review:0,waiting:1}});await loading;
  const html=f.nodes.get('#personal-body').innerHTML;assert.ok(html.includes('기한 지남'));assert.ok(html.includes('검토 요청'));assert.ok(html.includes('내가 답할 요청'));assert.ok(html.includes('내가 검토할 결과'));assert.ok(html.includes('내 요청의 진행 상황'));assert.ok(html.includes('data-source-message="1"'));assert.equal(f.state.personalItems.length,2);
});

test('a late today response cannot overwrite a different personal panel',async()=>{
  const f=fixture();f.run("state.personalTab='workday'");const loading=f.run('loadPersonalPanel()');f.run("state.personalTab='decisions'");f.nodes.get('#personal-body').innerHTML='결정 화면';f.requests[0].resolve({groups:{},counts:{}});await loading;assert.equal(f.nodes.get('#personal-body').innerHTML,'결정 화면');
});

test('actionable customer work appears before compact empty groups',async()=>{
  const f=fixture();f.run("state.personalTab='workday';state.integrated={canWrite:true};clientWorkflowApi=async()=>({items:[{id:'c1',group:'next',title:'납품 파일 전달',text:'승인된 버전을 전달하세요.',href:'/?tab=workroom&section=clients&project=p1',actions:[]}]})");const loading=f.run('loadPersonalPanel()');f.requests[0].resolve({date:'2026-10-09',groups:{reply:[],due:[],review:[],waiting:[]},counts:{reply:0,due:0,review:0,waiting:0}});await loading;const html=f.nodes.get('#personal-body').innerHTML;assert.ok(html.indexOf('납품 파일 전달')<html.indexOf('workday-empty-row'));assert.equal((html.match(/workday-empty-row/g)||[]).length,4);assert.ok(!html.includes('담당자로 지정된 요청을 확인하고 수락하세요.'));
});

test('catch-up stays unread until explicit acknowledgement and sends only the displayed boundary',async()=>{
  const f=fixture();f.run("state.personalTab='catchup'");const loading=f.run('loadPersonalPanel()');f.requests[0].resolve({since:2,through:5,hasMore:true,events:[{sequence:5,kind:'task_stage',createdAt:'2026-10-08T00:00:00Z',message:{id:'1',channelId:'c1'},task,changes:{from:'doing',to:'review'},actor:{name:'담당'}}]});await loading;
  assert.equal(f.requests.length,1);assert.ok(f.nodes.get('#personal-body').innerHTML.includes('진행 중 → 검토 요청'));
  f.run('loadPersonalPanel=async()=>{}');const confirming=f.nodes.get('#catchup-read').listeners.click({currentTarget:f.nodes.get('#catchup-read')});assert.equal(f.requests[1].path,'/api/catch-up/read');assert.equal(f.requests[1].options.body.through,5);f.requests[1].resolve({through:5});await confirming;
});

test('decision pagination preserves query, kind and history selection',async()=>{
  const f=fixture();f.run("state.personalTab='decisions';state.decisionQuery='승인';state.decisionCurrent=false;state.decisionKind='final';state.personalItems=[{id:'old',summary:'기존',channelId:'c1',messageId:'1'}]");const loading=f.run('loadPersonalPanel({append:true})');const query=new URL('http://local'+f.requests[0].path).searchParams;assert.equal(query.get('q'),'승인');assert.equal(query.get('kind'),'final');assert.equal(query.get('current'),'0');assert.equal(query.get('offset'),'1');
  f.requests[0].resolve({decisions:[{id:'new',summary:'최종 승인',channelId:'c1',messageId:'2',kind:'final',effectiveDate:'2026-10-08',confirmedAt:'2026-10-08T00:00:00Z',confirmedBy:{name:'검토'},replacesId:'old',resultMessageId:'3'}],hasMore:false});await loading;assert.deepEqual(Array.from(f.state.personalItems,item=>item.id),['old','new']);assert.ok(f.nodes.get('#personal-body').innerHTML.includes('data-decision-id="old"'));assert.ok(f.nodes.get('#personal-body').innerHTML.includes('data-source-message="3"'));
});

test('customer destinations allow only one same-origin client context and never credentials or injected routes',()=>{
  const f=fixture(),valid='/?tab=workroom&section=clients&project=p1&version=v1&message=m1&seconds=12.5';f.context.href=valid;assert.equal(f.run('safeClientWorkflowHref(href)'),'http://localhost'+valid);
  for(const href of ['https://elsewhere.test'+valid,'http://user:password@localhost'+valid,valid+'#x',valid+'&tab=workroom',valid+'&next=/admin','/?tab=home&section=clients&project=p1',valid.replace('12.5','-1'),valid.replace('12.5','Infinity')]){f.context.href=href;assert.equal(f.run('safeClientWorkflowHref(href)'),null,href);}
});

test('change summaries use crew names, retain both reviewer changes and escape untrusted content',()=>{
  const f=fixture();f.context.event={kind:'task_assignment',changes:{from:{assigneeId:'u1',reviewerId:null},to:{assigneeId:'u2',reviewerId:'u1'}}};const description=f.run('catchUpChangeText(event)');assert.equal(description,'담당 담당 → 검토 · 검토 미지정 → 담당');
  f.context.decision={id:'d1',summary:'<img src=x onerror=alert(1)>',confirmedBy:{name:'<script>'},channelId:'c1',messageId:'1'};const html=f.run('decisionHtml(decision)');assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));
});

function taskFixture(userId='u1'){
  const f=fixture();f.context.message={id:'1',channelId:'c1',body:'원래 요청',task:{...task}};
  f.run("openModal=(title,html)=>{modalVersion++;modal.open=true;state.testModal=html;};bindMessagePicker=()=>{};formError=report;");f.run(`state.user=state.members.find(person=>person.id==='${userId}');`);return f;
}

test('reviewers see only allowed transitions and send the existing reviewer when metadata fields are disabled',async()=>{
  const f=taskFixture('u2');f.run("message.task.allowedStages=['changes','done'];taskDialog(message)");const html=f.state.testModal;assert.match(html,/name="assigneeId" required disabled/);assert.match(html,/name="reviewerId" disabled/);assert.ok(html.includes('<option value="done"'));assert.ok(!html.includes('<option value="doing"'));assert.ok(!html.includes('data-picker-search'));
  const form=f.nodes.get('#task-form');form.values={stage:'done'};const saving=form.onsubmit({preventDefault(){}});assert.equal(f.requests[0].options.body.reviewerId,'u2');assert.equal(f.requests[0].options.body.resultMessageId,'2');assert.equal(f.requests[0].options.body.revision,7);assert.equal(f.requests[0].options.body.assigneeId,undefined);f.requests[0].resolve({task:{...task,stage:'done'}});await saving;
});

test('completed results stay locked and an assignee cannot remove their own reviewer',()=>{
  const f=taskFixture();f.run("message.task.stage='done';message.task.allowedStages=['doing'];taskDialog(message)");let html=f.state.testModal;assert.ok(!html.includes('data-picker-search'));assert.match(html,/name="assigneeId" required disabled/);assert.match(html,/name="reviewerId" disabled/);
  f.run("message.task.stage='doing';message.task.allowedStages=['review'];taskDialog(message)");html=f.state.testModal;assert.match(html,/name="reviewerId" disabled/);assert.ok(html.includes('data-picker-search'));
});

test('an assignee can nominate the first reviewer before review while existing reviewers stay protected',async()=>{
  const f=taskFixture();f.run("message.task.stage='doing';message.task.reviewer=null;message.task.createdBy={id:'u2'};message.task.allowedStages=['review','done'];taskDialog(message)");assert.match(f.state.testModal,/name="reviewerId" >/);const form=f.nodes.get('#task-form');form.values={title:task.title,assigneeId:'u1',reviewerId:'u2',dueDate:task.dueDate,stage:'review'};const saving=form.onsubmit({preventDefault(){}});assert.equal(f.requests[0].options.body.reviewerId,'u2');assert.equal(f.requests[0].options.body.stage,'review');f.requests[0].resolve({task:{...task,stage:'review'}});await saving;
  for(const stage of ['review','done']){f.context.stage=stage;f.run("message.task.stage=stage;message.task.reviewer=null;taskDialog(message)");assert.match(f.state.testModal,/name="reviewerId" disabled/);}
});

test('an optimistic conflict preserves the dialog and requires reloading before resubmission',async()=>{
  const f=taskFixture();f.run("message.task.stage='doing';message.task.allowedStages=['review'];taskDialog(message)");const form=f.nodes.get('#task-form');form.values={title:'내가 수정한 제목',assigneeId:'u1',reviewerId:'u2',dueDate:'2026-10-09',stage:'review'};const saving=form.onsubmit({preventDefault(){}});f.requests[0].reject(Object.assign(new Error('conflict'),{status:409}));await saving;assert.equal(f.nodes.get('#modal').open,true);assert.equal(form.values.title,'내가 수정한 제목');assert.equal(f.nodes.get('button[type=submit]').disabled,true);assert.ok(f.errors[0].includes('최신 상태'));
});

test('linked message picker ignores late search results after a different modal replaces it',async()=>{
  const f=fixture();for(const key of ['[data-picker-selected]','[data-picker-results]','[data-picker-query]'])f.nodes.set(key,f.node());const root=f.node();f.context.pickerRoot=root;f.run("modal.open=true;bindMessagePicker(pickerRoot,{channelId:'c1',excludeId:'1',onChange:()=>{}})");assert.ok(f.requests[0].path.includes('channelId=c1'));f.run('modalVersion++');f.nodes.get('[data-picker-results]').innerHTML='새 창';f.requests[0].resolve({messages:[{id:'2',body:'이전 응답'}],hasMore:false});await Promise.resolve();await Promise.resolve();assert.equal(f.nodes.get('[data-picker-results]').innerHTML,'새 창');
});

test('unavailable reviewer recovery excludes the assignee and requires the explicit server permission',()=>{
  const f=fixture();f.context.task={...task,reviewer:null,reviewerId:'former',reviewerUnavailable:true,canReassignReviewer:true};const html=f.run('reviewerRecoveryHtml(task,state.members)');assert.ok(html.includes('id="reassign-reviewer"'));assert.ok(html.includes('같은 결과물'));assert.ok(!html.includes('value="u1"'));assert.ok(html.includes('value="u2"'));
  f.run('task.canReassignReviewer=false');const readonly=f.run('reviewerRecoveryHtml(task,state.members)');assert.ok(!readonly.includes('id="reassign-reviewer"'));assert.ok(readonly.includes('업무 요청자'));
});

function recoveryFixture(){
  const f=taskFixture('u2');for(const key of ['#reassign-reviewer','#replacement-reviewer','#reviewer-recovery-confirm'])f.nodes.set(key,f.node());f.run("message.task.reviewer=null;message.task.reviewerId='former';message.task.reviewerUnavailable=true;message.task.canReassignReviewer=true;taskDialog(message)");return f;
}

test('reviewer recovery requires confirmation and submits no stage, result or assignment changes',async()=>{
  const f=recoveryFixture(),button=f.nodes.get('#reassign-reviewer');f.nodes.get('#replacement-reviewer').value='u2';await button.onclick();assert.equal(f.requests.length,0);assert.ok(f.errors[0].includes('확인'));
  f.nodes.get('#reviewer-recovery-confirm').checked=true;const saving=button.onclick();assert.deepEqual({...f.requests[0].options.body},{revision:7,reviewerId:'u2',reassignReviewer:true});f.run('taskDialog=value=>state.recoveredTask=value.task');f.requests[0].resolve({task:{...task,reviewer:{id:'u2'},revision:8}});await saving;assert.equal(f.state.recoveredTask.resultMessageId,'2');assert.equal(f.state.recoveredTask.stage,'review');
});

test('reviewer recovery conflicts keep selection and confirmation while blocking stale resubmission',async()=>{
  const f=recoveryFixture(),button=f.nodes.get('#reassign-reviewer');f.nodes.get('#replacement-reviewer').value='u2';f.nodes.get('#reviewer-recovery-confirm').checked=true;const saving=button.onclick();f.requests[0].reject(Object.assign(new Error('already reassigned'),{status:409}));await saving;assert.equal(f.nodes.get('#replacement-reviewer').value,'u2');assert.equal(f.nodes.get('#reviewer-recovery-confirm').checked,true);assert.equal(button.disabled,true);assert.equal(f.nodes.get('button[type=submit]').disabled,true);assert.ok(f.errors[0].includes('선택은 보존'));
});

test('an unavailable reviewer raw ID survives ordinary metadata save and is never silently removed',async()=>{
  const f=taskFixture('u1');f.run("message.task.stage='doing';message.task.reviewer=null;message.task.reviewerId='former';message.task.reviewerUnavailable=true;taskDialog(message)");assert.match(f.state.testModal,/name="reviewerId" disabled/);const form=f.nodes.get('#task-form');form.values={title:'기한만 조정',stage:'doing',dueDate:'2026-10-12'};const saving=form.onsubmit({preventDefault(){}});assert.equal(f.requests[0].options.body.reviewerId,'former');f.requests[0].resolve({task});await saving;
});

test('customer notifications render exact context and read only on opening, even if SSE refreshes the list meanwhile',async()=>{
  const f=fixture();f.run("state.personalTab='notifications'");const opened=[];f.context.location.assign=url=>opened.push(url);f.context.item={id:'client:1',kind:'client_workflow',title:'고객의 수정 요청',body:'<img src=x>',projectTitle:'가을 영상',seconds:12,href:'/?tab=workroom&section=clients&project=p1&version=v1&message=m1&seconds=12',createdAt:'2026-10-08T00:00:00Z',readAt:null,message:null};const html=f.run('personalItemHtml(item,0,"notifications")');assert.ok(html.includes('0:12'));assert.ok(html.includes('&lt;img'));assert.equal(f.requests.length,0);
  const opening=f.run('openPersonalNotification(item)');assert.equal(f.requests[0].path,'/api/notifications/client%3A1/read');f.run('state.personalSeq++');f.requests[0].resolve({ok:true});await opening;assert.equal(opened.length,1);assert.ok(opened[0].includes('message=m1&seconds=12'));
});

test('unsafe customer notification links are neither read nor opened',async()=>{
  const f=fixture();f.run("state.personalTab='notifications'");f.context.item={id:'client:1',kind:'client_workflow',href:'https://outside.test/?tab=workroom&section=clients&project=p1'};await f.run('openPersonalNotification(item)');assert.equal(f.requests.length,0);assert.ok(f.errors[0].includes('연결'));
});

test('deadline notifications with no chat message open their task collection after read',async()=>{
  const f=fixture();f.run("state.personalTab='notifications';showDeadlineDigest=item=>state.openedDigest=item.digest");f.context.item={id:'due:1',kind:'due_digest',createdAt:'2026-10-08T00:00:00Z',message:null,digest:{date:'2026-10-08',taskCount:1,overdueCount:1,tasks:[task]}};assert.ok(f.run('personalItemHtml(item,0,"notifications")').includes('마감 업무 1개'));const opening=f.run('openPersonalNotification(item)');assert.equal(f.requests[0].path,'/api/notifications/due%3A1/read');f.requests[0].resolve({ok:true});await opening;assert.equal(f.state.openedDigest.tasks[0].messageId,'1');
});

test('notification badge ignores an older unread response arriving after a newer one',async()=>{
  const f=fixture(),badge=f.node();f.nodes.set('#personal-unread',badge);f.run('refreshNotificationCount=originalNotificationCount');const first=f.run('refreshNotificationCount()'),second=f.run('refreshNotificationCount()');f.requests[1].resolve({unreadCount:0});await second;f.requests[0].resolve({unreadCount:4});await first;assert.equal(f.state.notificationCount,0);assert.equal(badge.hidden,true);
});

test('deadline setting remains hidden on older servers and activates only on a supported endpoint',async()=>{
  const f=fixture(),button=f.node();button.hidden=true;f.nodes.set('#deadline-settings',button);let loading=f.run('attachDeadlineSettings()');f.requests[0].reject(Object.assign(new Error('not found'),{status:404}));await loading;assert.equal(button.hidden,true);assert.equal(f.state.deadlineSettings,null);
  f.run('state.deadlineSettings=undefined');loading=f.run('attachDeadlineSettings()');f.requests[1].resolve({enabled:true,includeWeekends:false});await loading;assert.equal(button.hidden,false);assert.equal(typeof button.onclick,'function');
});

test('a delayed deadline setting save cannot overwrite another signed-in users preferences',async()=>{
  const f=fixture();f.nodes.set('#deadline-settings-form',f.node());f.run("state.deadlineSettingsUser='u1';state.deadlineSettings={enabled:true,includeWeekends:false};openModal=(title,html)=>{modalVersion++;modal.open=true;state.testModal=html;};deadlineSettingsDialog()");const form=f.nodes.get('#deadline-settings-form');form.values={includeWeekends:'on'};const saving=form.onsubmit({preventDefault(){},currentTarget:form});assert.deepEqual({...f.requests[0].options.body},{enabled:false,includeWeekends:true});f.run("state.user={id:'u2'};state.deadlineSettingsUser='u2';state.deadlineSettings={enabled:true,includeWeekends:false}");f.requests[0].resolve({enabled:false,includeWeekends:true});await saving;assert.deepEqual({...f.state.deadlineSettings},{enabled:true,includeWeekends:false});assert.equal(f.errors.length,0);
});
