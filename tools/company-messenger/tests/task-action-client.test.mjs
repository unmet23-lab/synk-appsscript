import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');

function fixture(){
  const nodes=new Map(),requests=[],errors=[],focused=[];
  const node=key=>({innerHTML:'',value:'',textContent:'',disabled:false,open:false,isConnected:true,listeners:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(name,handler){this.listeners[name]=handler;},querySelector:selector=>nodes.get(selector)||null,querySelectorAll:()=>[],focus(){focused.push(key);},scrollIntoView(){},close(){this.open=false;}});
  for(const key of ['#app','#modal','.modal-body','.task-detail','[data-task-manage-entry]','.task-management','#task-form','#replacement-reviewer','select[name=stage]','input[name=dueDate]','input[name=title]','summary','.workflow-source-actions','#task-result-picker','#workflow-stage-help','#task-reload','button[type=submit]'])nodes.set(key,node(key));
  const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=> 'task-action-request'}});
  const run=code=>vm.runInContext(code,context);run(source);
  run("Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},members:[{id:'u1',name:'담당'},{id:'u2',name:'검토'},{id:'u3',name:'요청자'}],channels:[{id:'c1',name:'프로젝트 방',kind:'channel',memberIds:['u1','u2','u3'],canPost:true}],channelId:'c1',chatCategory:'all'});");
  context.request=(path,options={})=>{requests.push({path,options});return Promise.resolve({});};context.report=message=>errors.push(message);
  run("api=request;toast=report;bindMessagePicker=()=>{};openModal=(title,html)=>{modalVersion++;modal.open=true;state.testModalTitle=title;state.testModalHtml=html;document.querySelector('.modal-body').innerHTML=html;};");
  return{context,run,nodes,requests,errors,focused,state:run('state')};
}

function task(overrides={}){
  return{id:'t1',messageId:'m1',channelId:'c1',title:'예약 안내 제작',stage:'accepted',status:'accepted',assignee:{id:'u1',name:'담당'},reviewer:{id:'u2',name:'검토'},createdBy:{id:'u3',name:'요청자'},dueDate:'2026-10-15',allowedStages:['doing'],canManage:true,workday:{date:'2026-10-10',todayReasons:[],remainingReasons:['upcoming']},...overrides};
}

function message(taskOverrides={}){
  return{id:'m1',channelId:'c1',body:'첫 화면에 예약 날짜와 문의 링크를 넣어 주세요.',user:{id:'u3',name:'요청자'},task:task(taskOverrides)};
}

function basis(f,value){f.context.item=value;return f.run('taskWorkdayBasisHtml(item)');}
function click(f){const button=f.nodes.get('[data-task-manage-entry]'),handler=button.onclick||button.listeners.click;assert.equal(typeof handler,'function','the visible management entry must have a click handler');return handler({preventDefault(){},currentTarget:button});}
function bind(f,value=message()){f.context.message=value;f.run("openModal('할 일 상세','현재 업무');bindTaskManagementEntry(message,modalVersion)");f.nodes.get('select[name=stage]').value=value.task.stage;return value;}

test('task classification cites the server date rather than the computer clock',()=>{
  const f=fixture();f.run("Date=class {constructor(){throw new Error('computer clock must not classify work')}static now(){throw new Error('computer clock must not classify work')}}");
  const html=basis(f,task({workday:{date:'2035-01-01',todayReasons:['due'],remainingReasons:[]}}));assert.match(html,/2035-01-01/);assert.match(html,/서버/);assert.match(html,/오늘 할 일에 포함되는 이유/);assert.match(html,/기한|마감/);assert.equal(f.requests.length,0);
});

for(const [key,pattern] of [['reply',/수락|응답|수정 요청|요청 확인/],['due',/기한|마감/],['review',/결과물.*검토|검토.*차례/],['recovery',/검토자.*지정|검토.*불가|검토.*다시/]]){
  test(`today reason ${key} tells the person why this task is actionable now`,()=>{
    const f=fixture(),html=basis(f,task({workday:{date:'2026-10-10',todayReasons:[key],remainingReasons:[]}}));assert.match(html,/오늘 할 일에 포함되는 이유/);assert.match(html,pattern);assert.ok(!html.includes('오늘 처리 대상이 아닌 이유'));
  });
}

test('several today reasons are all explained once despite duplicate keys',()=>{
  const f=fixture(),html=basis(f,task({workday:{date:'2026-10-10',todayReasons:['reply','due','review','recovery','due','review'],remainingReasons:[]}}));
  const reasons=[...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(match=>match[1]);assert.equal(reasons.length,4);assert.equal(new Set(reasons).size,4);
});

test('a future accepted task is described as remaining work rather than due today',()=>{
  const f=fixture(),html=basis(f,task());assert.match(html,/오늘 처리 대상이 아닌 이유/);assert.match(html,/이후|앞으로|다음|나중|아직/);assert.match(html,/기한|마감/);assert.ok(!html.includes('오늘 할 일에 포함되는 이유'));assert.ok(!html.includes('완료된 업무'));
});

test('an undated task says the deadline is unset without implying that there is no task',()=>{
  const f=fixture(),html=basis(f,task({dueDate:null,workday:{date:'2026-10-10',todayReasons:[],remainingReasons:['undated']}}));assert.match(html,/오늘 처리 대상이 아닌 이유/);assert.match(html,/기한.*(없|미정|정해지지|지정되지)/);assert.ok(!/(할 일이 없|업무가 없|완료된 업무)/.test(html));
});

test('a waiting task explains the other person or review dependency',()=>{
  const f=fixture(),html=basis(f,task({stage:'review',workday:{date:'2026-10-10',todayReasons:[],remainingReasons:['waiting']}}));assert.match(html,/오늘 처리 대상이 아닌 이유/);assert.match(html,/기다리|대기/);assert.match(html,/담당|검토|응답/);assert.ok(!html.includes('오늘 할 일에 포함되는 이유'));
});

test('a requester awaiting another assignee review sees reviewer response waiting instead of further assignee work',()=>{
  const f=fixture(),value=message({stage:'review',status:'review',assignee:{id:'u2',name:'<img src=x onerror=alert(1)>'},reviewer:{id:'u3',name:'<svg onload=alert(1)>검토자'},createdBy:{id:'u1',name:'요청자'},canReassignReviewer:false,allowedStages:[],workday:{date:'2026-10-10',todayReasons:[],remainingReasons:['waiting']}}),before=JSON.stringify(value),html=basis(f,value.task);assert.match(html,/결과물을 제출했고 지정된 검토자의 답변을 기다리/);assert.ok(!/요청 확인이나 작업 결과를 기다리/.test(html));assert.match(html,/오늘 처리 대상이 아닌 이유/);assert.ok(!html.includes('오늘 할 일에 포함되는 이유'));
  f.context.message=value;const detail=f.run('taskDetailHtml(message)');assert.ok(detail.includes('&lt;img')&&detail.includes('&lt;svg onload=alert(1)&gt;검토자'));assert.ok(!detail.includes('<img src=x')&&!detail.includes('<svg onload=alert(1)>'));assert.equal(JSON.stringify(value),before);assert.deepEqual(value.task.workday.todayReasons,[]);assert.deepEqual(value.task.workday.remainingReasons,['waiting']);assert.equal(f.requests.length,0);
});

test('waiting with an unavailable assignee prioritizes access confirmation instead of awaiting an impossible reply',()=>{
  const f=fixture(),value=message({stage:'review',status:'review',assignee:{id:'former',name:'<img src=x onerror=alert(1)>'},assigneeUnavailable:true,reviewerUnavailable:true,canManage:false,allowedStages:[],workday:{date:'2026-10-10',todayReasons:[],remainingReasons:['waiting']}});
  value.body='<script>구체적인 요청 내용</script>';const original=JSON.stringify(value),html=basis(f,value.task);assert.match(html,/담당 크루.*확인할 수 없.*참여 권한.*진행 상태.*확인/s);assert.ok(!/기다리|검토가 멈춘|오늘 할 일에 포함되는 이유/.test(html));assert.match(html,/오늘 처리 대상이 아닌 이유/);
  f.context.message=value;const detail=f.run('taskDetailHtml(message)');assert.ok(detail.includes('&lt;img')&&detail.includes('&lt;script&gt;구체적인 요청 내용'));assert.ok(!detail.includes('<img src=x')&&!detail.includes('<script>'));assert.ok(!detail.includes('data-task-manage-entry'));assert.equal(f.run('taskManagementEntryHtml(message)'),'');assert.equal(JSON.stringify(value),original);assert.equal(f.requests.length,0);
});

test('waiting with a missing assignee is an unresolved assignment without changing the server classification',()=>{
  for(const assignee of [null,{name:'기록에만 남은 담당'}]){
    const f=fixture(),value=task({stage:'review',status:'review',assignee,canManage:false,allowedStages:[],workday:{date:'2026-10-10',todayReasons:[],remainingReasons:['waiting']}}),before=JSON.stringify(value),html=basis(f,value);assert.match(html,/담당 크루.*확인할 수 없.*진행 상태.*확인/s);assert.ok(!/기다리|오늘 할 일에 포함되는 이유/.test(html));assert.match(html,/오늘 처리 대상이 아닌 이유/);assert.equal(JSON.stringify(value),before);assert.deepEqual(value.workday.todayReasons,[]);assert.deepEqual(value.workday.remainingReasons,['waiting']);assert.equal(f.requests.length,0);
  }
});

test('waiting with an unavailable reviewer requests reassignment while preserving read-only access and escaped records',()=>{
  const f=fixture(),value=message({stage:'review',status:'review',reviewer:{id:'former',name:'<svg onload=alert(1)>검토자'},reviewerUnavailable:true,canReassignReviewer:false,canManage:false,allowedStages:[],workday:{date:'2026-10-10',todayReasons:[],remainingReasons:['waiting']}}),before=JSON.stringify(value),html=basis(f,value.task);assert.match(html,/검토자가 검토할 수 없어.*검토가 멈춘/s);assert.match(html,/담당자가 아닌 요청자나 관리자.*새 검토자 지정/s);assert.ok(!/기다리|오늘 할 일에 포함되는 이유/.test(html));assert.match(html,/오늘 처리 대상이 아닌 이유/);
  f.context.message=value;const detail=f.run('taskDetailHtml(message)');assert.ok(detail.includes('&lt;svg onload=alert(1)&gt;검토자'));assert.ok(!detail.includes('<svg onload=alert(1)>'));assert.ok(!detail.includes('data-task-manage-entry'));assert.equal(f.run('taskManagementEntryHtml(message)'),'');assert.equal(JSON.stringify(value),before);assert.deepEqual(value.task.workday.todayReasons,[]);assert.deepEqual(value.task.workday.remainingReasons,['waiting']);assert.equal(f.requests.length,0);
});

test('a completed task with empty classification has a completion explanation',()=>{
  const f=fixture(),html=basis(f,task({stage:'done',status:'done',workday:{date:'2026-10-10',todayReasons:[],remainingReasons:[]}}));assert.match(html,/완료/);assert.match(html,/오늘 처리 대상이 아닌 이유/);assert.ok(!html.includes('오늘 할 일에 포함되는 이유'));assert.ok(!/(확인하지 못|확인할 수 없)/.test(html));
});

for(const [name,workday] of [['missing',undefined],['null',null],['date missing',{todayReasons:[],remainingReasons:[]}],['invalid date',{date:'not-a-date',todayReasons:[],remainingReasons:[]}],['today reasons missing',{date:'2026-10-10',remainingReasons:[]}],['today reasons wrong type',{date:'2026-10-10',todayReasons:'due',remainingReasons:[]}],['remaining reasons wrong type',{date:'2026-10-10',todayReasons:[],remainingReasons:null}]]){
  test(`${name} server classification stays unknown instead of claiming today or no task`,()=>{
    const f=fixture(),html=basis(f,task({dueDate:'2020-01-01',workday}));assert.match(html,/확인.*(못|없)|분류.*(없|못)/s);assert.ok(!html.includes('오늘 할 일에 포함되는 이유'));assert.ok(!html.includes('오늘 처리 대상이 아닌 이유'));assert.ok(!/(할 일이 없|업무가 없|완료된 업무)/.test(html));
  });
}

test('unknown reason keys do not fabricate an actionable or empty classification',()=>{
  const f=fixture(),html=basis(f,task({workday:{date:'2026-10-10',todayReasons:['<img src=x onerror=alert(1)>'],remainingReasons:[]}}));assert.match(html,/확인.*(못|없)|분류.*(없|못)/s);assert.ok(!html.includes('<img'));assert.ok(!html.includes('오늘 할 일에 포함되는 이유'));assert.ok(!html.includes('오늘 처리 대상이 아닌 이유'));
});

test('classification does not change the server task or the stored reason arrays',()=>{
  const f=fixture(),value=task({title:'<script>예약 안내</script>',workday:{date:'2026-10-10',todayReasons:['due','review','due'],remainingReasons:[]}}),before=JSON.stringify(value);
  const html=basis(f,value);assert.equal(JSON.stringify(value),before);assert.ok(!html.includes('<script>'));assert.equal(f.requests.length,0);
});

test('the task detail integrates the current server classification and explicit management entry',()=>{
  const f=fixture();f.context.message=message({workday:{date:'2026-10-10',todayReasons:['due'],remainingReasons:[]}});const html=f.run('taskDetailHtml(message)');assert.match(html,/오늘 할 일에 포함되는 이유/);assert.match(html,/2026-10-10/);assert.match(html,/data-task-manage-entry/);assert.match(html,/상태·담당·기한·결과물 관리/);
});

test('a writable manageable task offers an explicit button with its exact action label',()=>{
  const f=fixture();f.context.message=message();const html=f.run('taskManagementEntryHtml(message)');assert.match(html,/<button\b[^>]*type="button"[^>]*data-task-manage-entry|<button\b[^>]*data-task-manage-entry[^>]*type="button"/);assert.match(html,/상태·담당·기한·결과물 관리/);assert.equal(f.requests.length,0);
});

for(const [name,change] of [['task permission denied','message.task.canManage=false'],['company read only','state.integrated={canWrite:false}'],['room read only','state.channels[0].canPost=false'],['room unavailable',"state.unavailableChannels.add('c1')"]]){
  test(`management entry is hidden for ${name}`,()=>{
    const f=fixture();f.context.message=message();f.run(change);assert.equal(f.run('taskManagementEntryHtml(message)'),'');assert.ok(!f.run('taskDetailHtml(message)').includes('data-task-manage-entry'));assert.equal(f.requests.length,0);
  });
}

test('opening management focuses the enabled stage without writing or changing the chosen stage',()=>{
  const f=fixture(),value=bind(f),before=JSON.stringify(value);click(f);assert.equal(f.nodes.get('.task-management').open,true);assert.equal(f.nodes.get('select[name=stage]').value,'accepted');assert.ok(f.focused.includes('select[name=stage]'));assert.equal(JSON.stringify(value),before);assert.equal(f.requests.length,0);
});

test('opening management falls back to the enabled deadline field when stage is disabled',()=>{
  const f=fixture();bind(f);f.nodes.get('select[name=stage]').disabled=true;click(f);assert.equal(f.nodes.get('.task-management').open,true);assert.ok(f.focused.includes('input[name=dueDate]'));assert.ok(!f.focused.includes('select[name=stage]'));assert.equal(f.requests.length,0);
});

test('reviewer recovery management focuses the enabled replacement field before normal task metadata',()=>{
  const f=fixture(),value=message({stage:'review',status:'review',assignee:{id:'u2',name:'다른 담당'},reviewer:{id:'former',name:'이전 검토자'},createdBy:{id:'u1',name:'요청자'},reviewerUnavailable:true,canReassignReviewer:true,allowedStages:[],workday:{date:'2026-10-10',todayReasons:['recovery'],remainingReasons:[]}}),before=JSON.stringify(value);bind(f,value);f.nodes.get('#replacement-reviewer').value='u3';click(f);assert.equal(f.nodes.get('.task-management').open,true);assert.deepEqual(f.focused,['#replacement-reviewer']);assert.equal(f.nodes.get('select[name=stage]').value,'review');assert.equal(f.nodes.get('#replacement-reviewer').value,'u3');assert.equal(JSON.stringify(value),before);assert.equal(f.requests.length,0);
});

for(const missing of [false,true]){
  test(`reviewer recovery with a ${missing?'missing':'disabled'} replacement field falls back to an allowed enabled stage`,()=>{
    const f=fixture(),value=message({assignee:{id:'u2',name:'다른 담당'},createdBy:{id:'u1',name:'요청자'},reviewerUnavailable:true,canReassignReviewer:true});f.run("state.user.role='owner'");bind(f,value);if(missing)f.nodes.delete('#replacement-reviewer');else f.nodes.get('#replacement-reviewer').disabled=true;const before=JSON.stringify(value);click(f);assert.equal(f.nodes.get('.task-management').open,true);assert.deepEqual(f.focused,['select[name=stage]']);assert.equal(f.nodes.get('select[name=stage]').value,'accepted');assert.equal(JSON.stringify(value),before);assert.equal(f.requests.length,0);
  });
}

test('an empty allowed-stage list skips an enabled stage selector and focuses the real deadline field',()=>{
  const f=fixture(),value=message({stage:'review',status:'review',createdBy:{id:'u1',name:'요청자'},assignee:{id:'u2',name:'다른 담당'},allowedStages:[],canReassignReviewer:false}),before=JSON.stringify(value);bind(f,value);f.nodes.get('input[name=dueDate]').value='2026-10-15';assert.equal(f.nodes.get('select[name=stage]').disabled,false);click(f);assert.equal(f.nodes.get('.task-management').open,true);assert.deepEqual(f.focused,['input[name=dueDate]']);assert.equal(f.nodes.get('select[name=stage]').value,'review');assert.equal(f.nodes.get('input[name=dueDate]').value,'2026-10-15');assert.equal(JSON.stringify(value),before);assert.equal(f.requests.length,0);
});

test('management entry remains harmless when its rendered nodes were detached',()=>{
  for(const selector of ['[data-task-manage-entry]','.task-management']){
    const f=fixture();bind(f);f.nodes.get(selector).isConnected=false;click(f);assert.equal(f.nodes.get('.task-management').open,false);assert.deepEqual(f.focused,[]);assert.equal(f.requests.length,0);
  }
});

for(const [name,change] of [['closed dialog','modal.close()'],['replaced dialog',"openModal('다른 업무','다른 업무')"],['changed account',"state.user={id:'u2',name:'다른 크루',role:'member'}"],['changed session','state.workNotificationSession++'],['lost write access','state.integrated={canWrite:false}'],['room posting revoked','state.channels[0].canPost=false'],['room no longer available',"state.unavailableChannels.add('c1')"]]){
  test(`an old management click cannot act after ${name}`,()=>{
    const f=fixture();bind(f);f.run(change);click(f);assert.equal(f.nodes.get('.task-management').open,false);assert.deepEqual(f.focused,[]);assert.equal(f.requests.length,0);
  });
}

test('task dialog binds its management entry while preserving the original current stage',()=>{
  const f=fixture();f.context.message=message();f.run('taskDialog(message)');assert.match(f.state.testModalHtml,/data-task-manage-entry/);assert.match(f.state.testModalHtml,/<option value="accepted" selected>/);click(f);assert.equal(f.nodes.get('.task-management').open,true);assert.equal(f.context.message.task.stage,'accepted');assert.equal(f.requests.length,0);
});
