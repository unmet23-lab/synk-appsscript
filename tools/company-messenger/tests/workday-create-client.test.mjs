import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
const flush=async()=>{for(let index=0;index<8;index++)await Promise.resolve();};
const decode=value=>String(value||'').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attribute=(text,name)=>new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`).exec(text)?.[2];

function fixture(){
  const nodes=new Map(),fields=new Map(),requests=[],toasts=[],opened=[],refreshes=[],storage=new Map();let uuid=0,currentState;
  const optionRows=html=>[...html.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(match=>({value:decode(attribute(match[1],'value')??match[2]),selected:/\bselected\b/.test(match[1]),disabled:/\bdisabled\b/.test(match[1]),text:decode(match[2])}));
  const node=key=>{
    const classes=new Set();let html='';
    const value={value:'',textContent:'',disabled:false,checked:false,open:false,isConnected:true,dataset:{},listeners:{},required:false,focusCount:0,
      classList:{add:(...values)=>values.forEach(item=>classes.add(item)),remove:(...values)=>values.forEach(item=>classes.delete(item)),contains:item=>classes.has(item),toggle(item,force){const yes=force??!classes.has(item);if(yes)classes.add(item);else classes.delete(item);return yes;}},
      setAttribute(name,text){if(name==='disabled')this.disabled=true;else this[name]=text;},removeAttribute(name){if(name==='disabled')this.disabled=false;},
      addEventListener(name,handler){this.listeners[name]=handler;},querySelector:selector=>nodes.get(selector)||null,querySelectorAll:selector=>selector==='input,textarea,select,button'?[...fields.values(),nodes.get('#task-create-submit')]:[],contains:()=>true,
      focus(){this.focusCount++;},close(){this.open=false;},reportValidity:()=>true,checkValidity:()=>true,insertAdjacentHTML(_position,text){this.innerHTML+=text;}};
    Object.defineProperty(value,'innerHTML',{get:()=>html,set:text=>{html=String(text);if(value.kind==='select'){value.options=optionRows(html);value.optionsHtml=html;value.value=(value.options.find(option=>option.selected)||value.options[0])?.value||'';}parseFields(html);if(currentState&&key==='.modal-body')currentState.testModal=html;}});
    return value;
  };
  const parseFields=html=>{
    const update=(kind,attrs,content='')=>{
      const name=attribute(attrs,'name');if(!name)return;let field=fields.get(name);
      if(!field){field=node(`[name=${name}]`);fields.set(name,field);}
      field.kind=kind;field.required=/\brequired\b/.test(attrs);field.disabled=/\bdisabled\b/.test(attrs);field.optionsHtml=content;
      if(kind==='select'){
        const options=optionRows(content);
        field.options=options;field.value=(options.find(option=>option.selected)||options[0])?.value||'';
      }else field.value=decode(kind==='textarea'?content:attribute(attrs,'value')||'');
      for(const selector of [`[name=${name}]`,`[name="${name}"]`,`${kind}[name=${name}]`,`${kind}[name="${name}"]`])nodes.set(selector,field);
      const id=attribute(attrs,'id');if(id)nodes.set('#'+id,field);
    };
    for(const match of html.matchAll(/<input\b([^>]*)>/g))update('input',match[1]);
    for(const match of html.matchAll(/<(textarea|select)\b([^>]*)>([\s\S]*?)<\/\1>/g))update(match[1],match[2],match[3]);
    const form=nodes.get('#task-create-form');if(form)form.elements=Object.assign({namedItem:name=>fields.get(name)||null},Object.fromEntries(fields));
  };
  for(const key of ['#app','#modal','.modal-body','#drawer','#personal-body','#close-drawer','#task-create-form','#task-create-people','#task-create-scope','#task-create-submit','#task-create-cancel','#task-create-retry','#modal-error','button[type=submit]','#composer-input'])nodes.set(key,node(key));
  nodes.set('button[type=submit]',nodes.get('#task-create-submit'));
  const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/',origin:'http://localhost'},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`},FormData:class extends Map{constructor(){super([...fields].filter(([,field])=>!field.disabled).map(([name,field])=>[name,field.value]));}}});
  const run=code=>vm.runInContext(code,context);run(source);currentState=run('state');context.originalRefreshTaskViews=run('refreshTaskViews');
  run("Object.assign(state,{user:{id:'u1',name:'나',role:'member'},members:[{id:'u1',name:'나',companyRole:'member'},{id:'u2',name:'다른 담당',companyRole:'member'},{id:'u3',name:'읽기 전용',companyRole:'viewer'}],channels:[{id:'self',name:'나에게',kind:'self',memberIds:['u1'],canPost:true},{id:'c1',name:'프로젝트',kind:'channel',memberIds:['u1','u2','u3'],canPost:true},{id:'c2',name:'다른 방',kind:'channel',memberIds:['u1','u2'],canPost:true}],channelId:'c1',chatCategory:'all',drawer:'personal',personalTab:'workday'});");
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));
  context.report=(message,error)=>toasts.push({message,error});context.openedTask=message=>opened.push(message);context.recordRefresh=context=>{refreshes.push(context);return Promise.resolve();};
  run("api=request;toast=report;formError=message=>toast(message,true);attachDeadlineSettings=async()=>{};syncDrawerAccess=()=>{};taskDialog=openedTask;refreshTaskViews=recordRefresh;openModal=(title,html)=>{modalVersion++;modal.open=true;state.testModalTitle=title;state.testModal=html;document.querySelector('.modal-body').innerHTML=html;};");
  return{context,run,nodes,fields,requests,toasts,opened,refreshes,storage,state:currentState};
}

function options(f,changes={}){
  const people=Array.from(f.state.members).filter(person=>person.companyRole!=='viewer');
  return{date:'2026-10-10',channels:Array.from(f.state.channels).map(channel=>({...channel,taskAssignees:people.filter(person=>channel.memberIds.includes(person.id))})),...changes};
}
function snapshot(){return{date:'2026-10-10',nextDayRefreshAfterMs:86400000,today:{groups:{reply:[],due:[],review:[],recovery:[]},counts:{reply:0,due:0,review:0,recovery:0},total:0},remaining:{groups:{upcoming:[],undated:[],waiting:[]},counts:{upcoming:0,undated:0,waiting:0},total:0},openTotal:0};}
async function open(f,data=options(f)){
  const opening=f.run("openTaskCreateDialog({date:'2026-10-10'})");await flush();
  assert.equal(f.requests[0]?.path,'/api/tasks/create-options');assert.equal(f.requests[0].options.method||'GET','GET');
  f.requests[0].resolve(data);await opening;return f.nodes.get('#task-create-form');
}
function fill(f,changes={}){
  const values={title:'예약 안내 제작',body:'안내 영상 끝에 예약 링크를 넣어 주세요.\n초안과 최종 파일을 남겨 주세요.',channelId:'self',assigneeId:'u1',reviewerId:'',dueDate:'2026-10-10',...changes};
  for(const [name,value] of Object.entries(values)){assert.ok(f.fields.has(name),`missing field ${name}`);f.fields.get(name).value=value;}return values;
}
const submit=form=>form.onsubmit({preventDefault(){},currentTarget:form});
function created(values={}){const message={id:'21',channelId:values.channelId||'self',body:values.body||'요청 원문',user:{id:'u1',name:'나'},task:{id:'t21',messageId:'21',channelId:values.channelId||'self',title:values.title||'예약 안내 제작',assignee:{id:values.assigneeId||'u1',name:'나'},stage:'requested',status:'todo',revision:1,canManage:true}};return{created:true,message,task:message.task};}

test('today offers direct registration with the server date and suppresses it for a readonly account',()=>{
  const f=fixture();f.context.serverDate='2026-10-10';let html=f.run('taskCreateEntryHtml(serverDate)');assert.match(html,/data-task-create\b/);assert.match(html,/data-task-create-date="2026-10-10"/);assert.match(html,/할 일/);
  f.run('state.integrated={canWrite:false}');assert.equal(f.run('taskCreateEntryHtml(serverDate)'),'');
});

test('the today registration click passes the observed server date without creating a task',async()=>{
  const f=fixture(),dates=[];f.context.recordDate=value=>dates.push(value);f.run('openTaskCreateDialog=recordDate');const loading=f.run('loadPersonalPanel()');f.requests[0].resolve(snapshot());await loading;
  assert.match(f.nodes.get('#personal-body').innerHTML,/data-task-create-date="2026-10-10"/);
  await f.nodes.get('#personal-body').onclick({target:{closest:selector=>selector==='[data-task-create]'?{dataset:{taskCreateDate:'2026-10-10'}}:null}});
  assert.deepEqual(JSON.parse(JSON.stringify(dates)),[{date:'2026-10-10'}]);assert.equal(f.requests.length,1);
});

test('registration gets authoritative room members, defaults to self, and retains the chat draft',async()=>{
  const f=fixture();f.nodes.get('#composer-input').value='아직 보내지 않은 메시지';f.run("state.mentionIds=['u2'];state.workspaceLink={title:'작성 중 링크'};state.replyTarget={id:'7'};state.queues.set('c1',[{key:'upload',file:{id:'f1'}}]);");
  const before=JSON.stringify(f.state.queues.get('c1'));await open(f);const html=f.state.testModal;
  for(const name of ['title','body','channelId','assigneeId','reviewerId','dueDate'])assert.match(html,new RegExp(`name="${name}"`));assert.match(html,/name="body"[^>]*maxlength="8000"/);
  assert.equal(f.fields.get('channelId').value,'self');assert.equal(f.fields.get('assigneeId').value,'u1');assert.equal(f.state.channelId,'c1');assert.equal(f.nodes.get('#composer-input').value,'아직 보내지 않은 메시지');assert.equal(JSON.stringify(f.state.queues.get('c1')),before);assert.equal(f.state.replyTarget.id,'7');assert.deepEqual(Array.from(f.state.mentionIds),['u2']);
});

test('without a self room the room and assignee stay on explicit empty placeholders',async()=>{
  const f=fixture();f.run("state.channels=state.channels.filter(room=>room.kind!=='self')");await open(f);assert.equal(f.fields.get('channelId').value,'');assert.equal(f.fields.get('assigneeId').value,'');
});

test('server option names are escaped and unauthorized bootstrap rooms are not offered',async()=>{
  const f=fixture();f.run("state.channels.find(room=>room.id==='c2').canPost=false;state.unavailableChannels.add('c1');state.channels.push({id:'c3',name:'새 방',kind:'channel',memberIds:['u1'],canPost:true})");const data=options(f);data.channels.find(room=>room.id==='c3').name='<img src=x>';data.channels[0].taskAssignees[0].name='<script>alert(1)</script>';await open(f,data);const html=f.state.testModal+f.fields.get('assigneeId').innerHTML;
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!f.fields.get('channelId').options.some(option=>option.value==='c1'||option.value==='c2'));
});

test('room selection uses only its server roster and preserves an eligible assignee',async()=>{
  const f=fixture();await open(f);const channel=f.fields.get('channelId');channel.value='c1';await channel.onchange({target:channel});assert.ok(f.fields.get('assigneeId').options.some(option=>option.value==='u2'));assert.ok(!f.fields.get('assigneeId').options.some(option=>option.value==='u3'));
  f.fields.get('assigneeId').value='u2';channel.value='c2';await channel.onchange({target:channel});assert.equal(f.fields.get('assigneeId').value,'u2');
});

test('a local member excluded by the server posting roster is not offered or accepted',async()=>{
  const f=fixture(),data=options(f);data.channels.find(room=>room.id==='c1').taskAssignees=data.channels.find(room=>room.id==='c1').taskAssignees.filter(person=>person.id==='u1');const form=await open(f,data),channel=f.fields.get('channelId');channel.value='c1';await channel.onchange({target:channel});
  assert.ok(!f.fields.get('assigneeId').options.some(option=>option.value==='u2'));fill(f,{channelId:'c1',assigneeId:'u2'});await submit(form);assert.equal(f.requests.length,1);assert.equal(f.opened.length,0);assert.ok(f.toasts.some(item=>item.error&&/담당/.test(item.message)));
});

test('room changes clear an ineligible assignee and reviewer rather than assigning somebody else',async()=>{
  const f=fixture(),data=options(f);data.channels.find(room=>room.id==='c2').taskAssignees=[];await open(f,data);const channel=f.fields.get('channelId');channel.value='c1';await channel.onchange({target:channel});f.fields.get('assigneeId').value='u2';f.fields.get('reviewerId').value='u1';channel.value='c2';await channel.onchange({target:channel});assert.equal(f.fields.get('assigneeId').value,'');assert.equal(f.fields.get('reviewerId').value,'');
});

test('the assigned crew cannot also be the reviewer and changing assignee clears that selection',async()=>{
  const f=fixture();await open(f);const channel=f.fields.get('channelId');channel.value='c1';await channel.onchange({target:channel});const assignee=f.fields.get('assigneeId');assignee.value='u2';await assignee.onchange({target:assignee});assert.ok(!f.fields.get('reviewerId').options.some(option=>option.value==='u2'));
  f.fields.get('reviewerId').value='u1';assignee.value='u1';await assignee.onchange({target:assignee});assert.equal(f.fields.get('reviewerId').value,'');
});

test('one submit creates both the original request and task through one atomic endpoint',async()=>{
  const f=fixture(),form=await open(f),values=fill(f);const saving=submit(form),request=f.requests[1];assert.equal(request.path,'/api/tasks');assert.equal(request.options.method,'POST');assert.equal(request.options.body.title,values.title);assert.equal(request.options.body.body,values.body);assert.equal(request.options.body.channelId,'self');assert.equal(request.options.body.assigneeId,'u1');assert.equal(request.options.body.reviewerId,null);assert.equal(request.options.body.dueDate,'2026-10-10');assert.match(request.options.body.requestId,/^[0-9a-f-]{36}$/);
  const response=created(values);request.resolve(response);await saving;assert.equal(f.refreshes.length,1);assert.equal(f.opened.length,1);assert.equal(f.opened[0].id,'21');assert.equal(f.opened[0].body,values.body);assert.equal(f.requests.length,2,'there must be no intermediate message POST or task attachment POST');
});

test('an undated request sends null and an optional reviewer is sent separately',async()=>{
  const f=fixture(),form=await open(f);fill(f,{channelId:'c1',assigneeId:'u2',reviewerId:'u1',dueDate:''});const saving=submit(form);assert.equal(f.requests[1].options.body.dueDate,null);assert.equal(f.requests[1].options.body.reviewerId,'u1');f.requests[1].resolve(created({channelId:'c1',assigneeId:'u2'}));await saving;
});

test('a saved direct request refreshes today even if the current chat read fails',async()=>{
  const f=fixture(),form=await open(f),values=fill(f);f.run("refreshTaskViews=originalRefreshTaskViews;refreshMessages=async()=>{throw new Error('채팅 읽기 실패')}");const saving=submit(form);const response=created(values);f.requests[1].resolve(response);await flush();assert.equal(f.requests[2]?.path,'/api/workday');const work=snapshot();work.today.groups.reply=[response.task];work.today.counts.reply=1;work.today.total=1;work.openTotal=1;f.requests[2].resolve(work);await saving;
  assert.ok(f.nodes.get('#personal-body').innerHTML.includes(values.title));assert.ok(f.nodes.get('#personal-body').innerHTML.includes('오늘 할 일 1개'));assert.ok(f.toasts.some(item=>item.error&&/추가했어요/.test(item.message)&&/불러오지 못/.test(item.message)));
});

test('a saved direct request with a failed today refresh never reports an empty day',async()=>{
  const f=fixture(),form=await open(f);fill(f);f.run('refreshTaskViews=originalRefreshTaskViews;refreshMessages=async()=>{}');const saving=submit(form);f.requests[1].resolve(created());await flush();assert.equal(f.requests[2]?.path,'/api/workday');f.requests[2].reject(new Error('오늘 업무 조회 실패'));await saving;
  const html=f.nodes.get('#personal-body').innerHTML;assert.ok(html.includes('할 일을 불러오지 못했어요'));assert.ok(!html.includes('오늘 할 일은 없어요'));assert.match(html,/data-productivity-refresh/);
});

test('repeated submit events while pending send only one task creation',async()=>{
  const f=fixture(),form=await open(f);fill(f);const first=submit(form),second=submit(form);await second;assert.equal(f.requests.length,2);assert.equal(f.nodes.get('#task-create-submit').disabled,true);f.requests[1].resolve(created());await first;assert.equal(f.refreshes.length,1);
});

test('network uncertainty preserves entered text and reuses the request ID for the same payload',async()=>{
  const f=fixture(),form=await open(f),values=fill(f),first=submit(form),requestId=f.requests[1].options.body.requestId;f.requests[1].reject(new Error('네트워크 연결 끊김'));await first;
  assert.equal(f.fields.get('title').value,values.title);assert.equal(f.fields.get('body').value,values.body);assert.equal(f.nodes.get('#modal').open,true);assert.equal(f.nodes.get('#task-create-submit').disabled,false);assert.equal(f.opened.length,0);
  const retry=submit(form);assert.equal(f.requests[2].options.body.requestId,requestId);f.requests[2].resolve({...created(values),created:false});await retry;assert.equal(f.opened.length,1);
});

test('editing a failed payload uses a new request ID and preserves the revised original text',async()=>{
  const f=fixture(),form=await open(f);fill(f);const first=submit(form),requestId=f.requests[1].options.body.requestId;f.requests[1].reject(new Error('입력 확인 실패'));await first;f.fields.get('body').value='변경한 요청 원문';const retry=submit(form);assert.notEqual(f.requests[2].options.body.requestId,requestId);assert.equal(f.requests[2].options.body.body,'변경한 요청 원문');f.requests[2].resolve(created({body:'변경한 요청 원문'}));await retry;
});

test('permission removal before submission refuses a stale form without a POST',async()=>{
  const f=fixture(),form=await open(f);fill(f);f.run("state.channels.find(room=>room.id==='self').canPost=false");await submit(form);assert.equal(f.requests.length,1);assert.equal(f.opened.length,0);
});

test('an open form reports readonly access after write permission changes and sends no POST',async()=>{
  const f=fixture(),form=await open(f);fill(f);f.run('state.integrated={canWrite:false}');await submit(form);assert.equal(f.requests.length,1);assert.equal(f.opened.length,0);assert.ok(f.toasts.some(item=>item.error&&item.message==='보기 전용 계정이라 할 일을 추가할 수 없어요.'));
});

test('a backend rejection keeps all inputs and does not claim success or open task detail',async()=>{
  const f=fixture(),form=await open(f),values=fill(f),saving=submit(form);f.requests[1].reject(Object.assign(new Error('담당 크루 권한이 변경되었습니다'),{status:403}));await saving;
  for(const [name,value] of Object.entries(values))assert.equal(f.fields.get(name).value,value,name);assert.equal(f.refreshes.length,0);assert.equal(f.opened.length,0);assert.ok(f.toasts.some(item=>item.error&&/권한/.test(item.message)));assert.equal(f.nodes.get('#task-create-submit').disabled,false);
});

for(const [label,change] of [['account changes',"state.user={id:'other',role:'member'}"],['the same account logs in again','resetWorkNotificationState()']]){
  test(`a pending create cannot submit or paint after ${label}`,async()=>{
    const f=fixture(),form=await open(f);fill(f);f.run(change);await submit(form);assert.equal(f.requests.length,1);assert.equal(f.toasts.length,0);
  });
  test(`a late successful create cannot refresh or show detail after ${label}`,async()=>{
    const f=fixture(),form=await open(f);fill(f);const saving=submit(form);f.run(change);f.requests[1].resolve(created());await saving;assert.equal(f.refreshes.length,0);assert.equal(f.opened.length,0);assert.equal(f.toasts.length,0);
  });
}

test('late options cannot replace another modal or accept a new login session',async()=>{
  for(const change of ["openModal('다른 창','다른 내용')",'resetWorkNotificationState()',"state.user={id:'other',role:'member'}"]){const f=fixture(),opening=f.run('openTaskCreateDialog()');await flush();f.run(change);const before=f.state.testModal;f.requests[0].resolve(options(f));await opening;assert.equal(f.state.testModal,before);assert.equal(f.requests.length,1);}
});

test('write access removed while options are loading cannot expose a registration form',async()=>{
  const f=fixture(),opening=f.run('openTaskCreateDialog()');await flush();f.run('state.integrated={canWrite:false}');f.requests[0].resolve(options(f));await opening;assert.ok(!f.state.testModal.includes('id="task-create-form"'));assert.match(f.state.testModal,/role="alert"[^>]*>보기 전용 계정이라 할 일을 추가할 수 없어요\./);assert.equal(f.requests.length,1);assert.equal(f.toasts.length,0);
});

test('a late create rejection cannot paint an error into a replacement modal',async()=>{
  const f=fixture(),form=await open(f);fill(f);const saving=submit(form);f.run("openModal('다른 창','다른 내용')");f.requests[1].reject(Object.assign(new Error('이전 등록 권한 실패'),{status:403}));await saving;assert.equal(f.state.testModal,'다른 내용');assert.equal(f.toasts.length,0);assert.equal(f.refreshes.length,0);assert.equal(f.opened.length,0);
});

test('closing or replacing the creation modal suppresses automatic detail opening after success',async()=>{
  for(const change of ['modal.close()',"openModal('다른 창','다른 내용')"]){const f=fixture(),form=await open(f);fill(f);const saving=submit(form);f.run(change);f.requests[1].resolve(created());await saving;assert.equal(f.opened.length,0);}
});

test('failed options remain a visible recoverable error and never allow a creation POST',async()=>{
  const f=fixture(),opening=f.run('openTaskCreateDialog()');await flush();f.requests[0].reject(new Error('<img src=x> 등록 가능한 대화방 읽기 실패'));await opening;
  assert.equal(f.requests.length,1);assert.equal(f.opened.length,0);assert.ok(f.state.testModal.includes('실패'));assert.ok(f.state.testModal.includes('&lt;img'));assert.ok(!f.state.testModal.includes('<img src=x>'));
});
