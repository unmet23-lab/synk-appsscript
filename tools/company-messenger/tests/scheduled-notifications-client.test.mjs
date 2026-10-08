import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const nodes=new Map(),requests=[],toasts=[],errors=[];
  const node=()=>({innerHTML:'',textContent:'',value:'',checked:false,disabled:false,hidden:false,isConnected:true,open:false,listeners:{},classList:{add(){},remove(){},toggle(){}},addEventListener(name,callback){this.listeners[name]=callback;},querySelector:selector=>nodes.get(selector)||null,querySelectorAll:()=>[],close(){this.open=false;},focus(){}});
  nodes.set('#app',node());nodes.set('#modal',node());
  const document={body:node(),hidden:false,activeElement:null,querySelector:selector=>nodes.get(selector)||null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,location:{pathname:'/',origin:'http://localhost'},window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=> 'fixture-id'},FormData:class extends Map{constructor(){super();for(const [key,control]of nodes)if(key.startsWith('input[name=')&&!control.disabled){const name=key.slice(11,-1);if(control.type!=='checkbox'||control.checked)this.set(name,control.type==='checkbox'?'on':control.value);}}}});
  const run=code=>vm.runInContext(code,context);run(source);
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));
  context.renderModal=(title,html)=>{
    const modal=nodes.get('#modal');for(const [key,control]of nodes)if(key!=='#app'&&key!=='#modal'){control.isConnected=false;nodes.delete(key);}
    modal.innerHTML=html;modal.title=title;
    for(const match of html.matchAll(/<(input|button|form|p)\b([^>]*)>/g)){
      const attrs=match[2],control=node(),id=attrs.match(/\bid="([^"]+)"/)?.[1],name=attrs.match(/\bname="?([^"\s>]+)/)?.[1];
      control.disabled=/\bdisabled(?:\s|$)/.test(attrs);control.checked=/\bchecked(?:\s|$)/.test(attrs);control.value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';control.type=attrs.match(/\btype="?([^"\s>]+)/)?.[1]||'';
      if(id)nodes.set('#'+id,control);if(name)nodes.set(`${match[1]}[name=${name}]`,control);if(control.type==='submit')nodes.set('button[type=submit]',control);
    }
  };
  context.recordToast=value=>toasts.push(value);context.recordError=value=>errors.push(value);
  run("Object.assign(state,{user:{id:'u1',name:'담당자',role:'owner'},channels:[],members:[],deadlineSettingsUser:'u1'});api=request;toast=recordToast;formError=recordError;refreshMessages=async()=>{};refreshDetailViews=async()=>{};refreshNotificationCount=async()=>{};openModal=(title,html)=>{modalVersion++;modal.open=true;renderModal(title,html);};");
  context.message={id:'m1',body:'확인할 메시지',channelId:'c1',reminder:{id:'r1',remindAt:'2099-01-01T00:00:00.000Z'}};
  return{context,run,nodes,requests,toasts,errors,node,state:run('state'),modal:nodes.get('#modal')};
}
async function openReminder(f,settings){f.run('reminderDialog(message)');assert.equal(f.requests.at(-1).path,'/api/workday/notifications');f.requests.at(-1).resolve(settings);await settle();}
const submit=f=>f.nodes.get('#reminder-form').onsubmit({preventDefault(){}});
const submitDeadline=f=>f.nodes.get('#deadline-settings-form').onsubmit({preventDefault(){}});

test('bootstrap accepts only explicit scheduler flags and resets previous user settings',async()=>{
  const f=fixture();f.run('renderShell=()=>{};clearChannelSelection=()=>{};connectEvents=()=>{};parentMessage=()=>{};');
  for(const enabled of [true,false,undefined]){
    f.context.bootData={user:{id:'u1'},channels:[],members:[],scheduledNotifications:{enabled}};
    f.run('state.deadlineSettings={enabled:true};enterWorkspace(bootData)');await settle();
    assert.equal(f.state.scheduledNotifications.enabled,enabled??null);assert.equal(f.state.deadlineSettings,undefined);
  }
  f.run('resetWorkNotificationState()');assert.equal(f.state.scheduledNotifications.enabled,null);
});

test('pending reminder labels distinguish paused, unknown and scheduled while preserving delivered history',()=>{
  const f=fixture();for(const [enabled,label]of [[true,'알림 예정'],[false,'알림 중지 중'],[null,'알림 가동 확인 필요']]){f.context.enabled=enabled;f.run('setWorkNotificationStatus(enabled)');assert.equal(f.run('reminderStatusLabel(message.reminder)'),label);}
  f.run('message.reminder.deliveredAt="2026-10-09T00:00:00Z"');assert.equal(f.run('reminderStatusLabel(message.reminder)'),'알림함에 도착');
});

test('a paused scheduler blocks both reminder actions while existing reservation removal remains available',async()=>{
  const f=fixture();f.run('setWorkNotificationStatus(true);reminderDialog(message)');assert.equal(f.nodes.get('button[type=submit]').disabled,true);assert.equal(f.nodes.get('#remind-tomorrow').disabled,true);
  f.requests[0].resolve({enabled:true,schedulerEnabled:false});await settle();assert.match(f.nodes.get('#reminder-scheduler-status').textContent,/중지되어 있어 예약할 수 없습니다/);
  await submit(f);await f.nodes.get('#remind-tomorrow').onclick();assert.equal(f.requests.length,1);assert.equal(f.nodes.get('#remove-reminder').disabled,false);
  const removing=f.nodes.get('#remove-reminder').listeners.click();assert.equal(f.requests[1].options.method,'DELETE');f.requests[1].resolve({ok:true});await removing;assert.equal(f.modal.open,false);assert.deepEqual(f.toasts,[]);
});

test('legacy response or failed status lookup never inherits an enabled bootstrap flag',async()=>{
  for(const failure of [false,true]){const f=fixture();f.run('setWorkNotificationStatus(true);reminderDialog(message)');if(failure)f.requests[0].reject(Object.assign(new Error('old server'),{status:404}));else f.requests[0].resolve({enabled:true});await settle();assert.equal(f.nodes.get('button[type=submit]').disabled,true);assert.match(f.nodes.get('#reminder-scheduler-status').textContent,/가동 여부를 확인할 수 없어/);assert.equal(f.state.scheduledNotifications.enabled,null);await submit(f);assert.equal(f.requests.length,1);}
});

test('verified running state allows one reminder write and claims success only after persistence',async()=>{
  const f=fixture();await openReminder(f,{enabled:true,schedulerEnabled:true});assert.equal(f.nodes.get('button[type=submit]').disabled,false);
  const saving=submit(f);assert.equal(f.requests[1].options.method,'PUT');assert.equal(f.nodes.get('#remind-tomorrow').disabled,true);await submit(f);assert.equal(f.requests.length,2);assert.deepEqual(f.toasts,[]);
  f.requests[1].resolve({ok:true});await saving;assert.equal(f.modal.open,false);assert.deepEqual(f.toasts,['다시 볼 시간을 예약했어요.']);
});

test('a stop between the status read and reminder write disables retry without a success promise',async()=>{
  const f=fixture();await openReminder(f,{enabled:true,schedulerEnabled:true});const saving=submit(f);f.requests[1].reject(Object.assign(new Error('현재 업무 알림이 중지되어 있어 예약할 수 없습니다.'),{status:503,code:'SYNK_WORK_NOTIFICATIONS_PAUSED'}));await saving;
  assert.equal(f.modal.open,true);assert.equal(f.nodes.get('button[type=submit]').disabled,true);assert.equal(f.nodes.get('#remove-reminder').disabled,false);assert.equal(f.state.scheduledNotifications.enabled,false);assert.deepEqual(f.toasts,[]);await submit(f);assert.equal(f.requests.length,2);
});

test('newly opening the reminder dialog refreshes status after the service becomes available',async()=>{
  const f=fixture();await openReminder(f,{enabled:true,schedulerEnabled:false});assert.equal(f.nodes.get('button[type=submit]').disabled,true);await openReminder(f,{enabled:true,schedulerEnabled:true});assert.equal(f.requests.length,2);assert.equal(f.nodes.get('button[type=submit]').disabled,false);
});

test('a late status result cannot revive a logged-out session even when the same user logs in again',async()=>{
  const f=fixture();f.run('reminderDialog(message)');f.run("resetWorkNotificationState();state.user={id:'u1'};modal.close()");f.requests[0].resolve({enabled:true,schedulerEnabled:true});await settle();assert.equal(f.state.scheduledNotifications.enabled,null);assert.equal(f.state.deadlineSettings,undefined);assert.equal(f.modal.open,false);
});

test('a late reminder write cannot close another dialog or announce success for a different account',async()=>{
  const f=fixture();await openReminder(f,{enabled:true,schedulerEnabled:true});const saving=submit(f);f.run("state.user={id:'u2'};resetWorkNotificationState();openModal('다른 창','')");f.requests[1].resolve({ok:true});await saving;assert.equal(f.modal.open,true);assert.equal(f.modal.title,'다른 창');assert.deepEqual(f.toasts,[]);
});

test('paused or unknown deadline delivery remains distinct from a personal opt-in and still permits turning it off',async()=>{
  for(const schedulerEnabled of [false,undefined]){
    const f=fixture();f.context.preferences={enabled:true,includeWeekends:false,schedulerEnabled};f.run('state.deadlineSettings=preferences;deadlineSettingsDialog()');const enabled=f.nodes.get('input[name=enabled]');assert.equal(enabled.checked,true);assert.equal(enabled.disabled,false);assert.equal(f.nodes.get('button[type=submit]').disabled,true);
    assert.match(f.modal.innerHTML,schedulerEnabled===false?/개인 설정이 켜져 있어도 마감 알림은 전달되지 않아요/:/가동 여부를 확인할 수 없어요/);
    await submitDeadline(f);assert.equal(f.requests.length,0);enabled.checked=false;enabled.onchange();assert.equal(f.nodes.get('button[type=submit]').disabled,false);
    const saving=submitDeadline(f);assert.equal(f.requests[0].options.body.enabled,false);f.requests[0].resolve({enabled:false,includeWeekends:false,schedulerEnabled});await saving;assert.equal(f.modal.open,false);
  }
});

test('disabled personal deadlines cannot be enabled while service availability is unverified',async()=>{
  const f=fixture();f.run('state.deadlineSettings={enabled:false,includeWeekends:false};deadlineSettingsDialog()');const enabled=f.nodes.get('input[name=enabled]');assert.equal(enabled.disabled,true);
  enabled.disabled=false;enabled.checked=true;await submitDeadline(f);assert.equal(f.requests.length,0);assert.match(f.errors.at(-1),/실행 중일 때/);
});

test('opening deadline settings refreshes availability even after the entry was previously enabled',async()=>{
  const f=fixture(),button=f.node();button.hidden=true;f.nodes.set('#deadline-settings',button);const attaching=f.run('attachDeadlineSettings()');f.requests[0].resolve({enabled:true,includeWeekends:false,schedulerEnabled:true});await attaching;
  const opening=button.onclick();assert.equal(f.requests[1].path,'/api/workday/notifications');f.requests[1].resolve({enabled:true,includeWeekends:false,schedulerEnabled:false});await opening;assert.match(f.modal.innerHTML,/개인 설정이 켜져 있어도/);assert.equal(f.nodes.get('button[type=submit]').disabled,true);
});

test('a deadline save rejected by a newly paused server updates availability and leaves opt-out usable',async()=>{
  const f=fixture();f.run('state.deadlineSettings={enabled:true,includeWeekends:false,schedulerEnabled:true};deadlineSettingsDialog()');const saving=submitDeadline(f);f.requests[0].reject(Object.assign(new Error('중지됨'),{status:503,code:'SYNK_WORK_NOTIFICATIONS_PAUSED'}));await saving;
  assert.equal(f.nodes.get('button[type=submit]').disabled,true);assert.match(f.nodes.get('#deadline-scheduler-status').textContent,/중지되어 있어요/);assert.deepEqual(f.toasts,[]);const enabled=f.nodes.get('input[name=enabled]');enabled.checked=false;enabled.onchange();assert.equal(f.nodes.get('button[type=submit]').disabled,false);
});

test('a scheduler change received after refreshed messages repaints pending labels without losing drafts or scroll',async()=>{
  const f=fixture(),composer=f.node(),scroller=f.node(),list=f.node();composer.value='아직 작성 중인 초안';Object.assign(scroller,{scrollHeight:900,scrollTop:120,clientHeight:300});f.nodes.set('#composer-input',composer);f.nodes.set('#message-scroll',scroller);f.nodes.set('#message-list',list);
  Object.assign(f.context.message,{user:{id:'u1',name:'담당자'},createdAt:'2026-10-09T00:00:00Z',files:[],reactions:[]});
  f.run("state.channels=[{id:'c1',kind:'channel',name:'프로젝트',memberIds:['u1'],canPost:true}];state.channelId='c1';state.chatCategory='all';state.messages=[message];state.replyTarget={id:'reply1'};state.workspaceLink={title:'결과 검토',url:'http://localhost/#view=content'};setWorkNotificationStatus(true);renderMessages({preserve:true});state.testDetailRefreshes=0;refreshDetailViews=async()=>{state.testDetailRefreshes++;};");
  assert.match(list.innerHTML,/알림 예정/);const refreshing=f.run('refreshStorageProvider()');
  // SSE can deliver the messages request before bootstrap on reconnection.
  f.run('renderMessages({preserve:true})');f.requests[0].resolve({user:{id:'u1',name:'담당자',role:'owner'},scheduledNotifications:{enabled:false}});await refreshing;
  assert.match(list.innerHTML,/알림 중지 중/);assert.ok(!list.innerHTML.includes('알림 예정'));assert.equal(composer.value,'아직 작성 중인 초안');assert.equal(scroller.scrollTop,120);assert.equal(f.state.replyTarget.id,'reply1');assert.equal(f.state.workspaceLink.title,'결과 검토');assert.equal(f.state.testDetailRefreshes,1);
  const oldSession=f.run('refreshStorageProvider()');f.run("resetWorkNotificationState();state.user={id:'u2',role:'owner'};");list.innerHTML='다른 계정의 대화';f.requests[1].resolve({user:{id:'u1',role:'owner'},scheduledNotifications:{enabled:true}});await oldSession;assert.equal(f.state.user.id,'u2');assert.equal(f.state.scheduledNotifications.enabled,null);assert.equal(list.innerHTML,'다른 계정의 대화');assert.equal(f.state.testDetailRefreshes,1);
});

test('later settings and bootstrap reads win over delayed responses from the same signed-in account',async()=>{
  const f=fixture();f.run('reminderDialog(message)');f.run('reminderDialog(message)');f.requests[1].resolve({enabled:true,schedulerEnabled:true});await settle();f.requests[0].resolve({enabled:true,schedulerEnabled:false});await settle();assert.equal(f.state.scheduledNotifications.enabled,true);assert.equal(f.state.deadlineSettings.schedulerEnabled,true);assert.equal(f.nodes.get('button[type=submit]').disabled,false);assert.match(f.nodes.get('#reminder-scheduler-status').textContent,/실행 중/);
  const oldBootstrap=f.run('refreshStorageProvider()'),newSettings=f.run('loadWorkNotificationSettings()');f.requests[3].resolve({enabled:true,schedulerEnabled:true});await newSettings;f.requests[2].resolve({user:{id:'u1',role:'owner'},scheduledNotifications:{enabled:false}});await oldBootstrap;assert.equal(f.state.scheduledNotifications.enabled,true);
  f.run('renderMessages=()=>{}');const oldSettings=f.run('loadWorkNotificationSettings()'),newBootstrap=f.run('refreshStorageProvider()');f.requests[5].resolve({user:{id:'u1',role:'owner'},scheduledNotifications:{enabled:false}});await newBootstrap;f.requests[4].resolve({enabled:true,schedulerEnabled:true});assert.equal(await oldSettings,null);assert.equal(f.state.scheduledNotifications.enabled,false);
});

test('a paused write rejection invalidates in-flight settings and bootstrap results',async()=>{
  const f=fixture();await openReminder(f,{enabled:true,schedulerEnabled:true});const saving=submit(f),oldSettings=f.run('loadWorkNotificationSettings()'),oldBootstrap=f.run('refreshStorageProvider()');f.requests[1].reject(Object.assign(new Error('중지됨'),{status:503,code:'SYNK_WORK_NOTIFICATIONS_PAUSED'}));await saving;assert.equal(f.state.scheduledNotifications.enabled,false);
  f.requests[2].resolve({enabled:true,schedulerEnabled:true});f.requests[3].resolve({user:{id:'u1',role:'owner'},scheduledNotifications:{enabled:true}});await oldSettings;await oldBootstrap;assert.equal(f.state.scheduledNotifications.enabled,false);assert.equal(f.nodes.get('button[type=submit]').disabled,true);
});

test('settings reads and paused write errors update visible reservation labels without extra network or view rendering',async()=>{
  const f=fixture(),chat=f.node(),thread=f.node(),saved=f.node(),delivered=f.node(),labels=[chat,thread,saved,delivered];for(const label of labels){label.dataset={reminderDelivered:label===delivered?'1':'0'};label.textContent=label===delivered?'알림함에 도착':'알림 예정';}
  f.context.document.querySelectorAll=selector=>selector==='[data-reminder-status]'?labels:[];
  f.run("state.channels=[{id:'c1',name:'프로젝트',kind:'channel'}];state.messages=[message];state.testRenders=0;renderMessages=()=>{state.testRenders++;};setWorkNotificationStatus(true)");
  assert.match(f.run('messageProductivityHtml(message)'),/data-reminder-status/);assert.match(f.run("personalItemHtml(message,0,'saved')"),/data-reminder-status/);
  const loading=f.run('loadWorkNotificationSettings()');f.requests[0].resolve({enabled:true,schedulerEnabled:false});await loading;assert.deepEqual(labels.map(label=>label.textContent),['알림 중지 중','알림 중지 중','알림 중지 중','알림함에 도착']);assert.equal(f.requests.length,1);assert.equal(f.state.testRenders,0);
  await openReminder(f,{enabled:true,schedulerEnabled:true});assert.equal(chat.textContent,'알림 예정');const saving=submit(f);f.requests[2].reject(Object.assign(new Error('중지됨'),{status:503,code:'SYNK_WORK_NOTIFICATIONS_PAUSED'}));await saving;assert.deepEqual(labels.map(label=>label.textContent),['알림 중지 중','알림 중지 중','알림 중지 중','알림함에 도착']);assert.equal(f.requests.length,3);assert.equal(f.state.testRenders,0);
});
