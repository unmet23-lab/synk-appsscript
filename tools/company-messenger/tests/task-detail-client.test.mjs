import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

import {appSource as source,installMessengerModules} from './support/messenger-client.mjs';

function fixture(){
  const nodes=new Map(),requests=[],dialogs=[],errors=[],opened=[];
  const node=()=>({innerHTML:'',value:'',textContent:'',disabled:false,open:false,isConnected:true,listeners:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(name,handler){this.listeners[name]=handler;},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],focus(){},close(){this.open=false;}});
  for(const key of ['#app','#modal','.modal-body','#personal-body','#task-detail-retry','#personal-task-scope','#personal-task-filter'])nodes.set(key,node());
  const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=> 'detail-request'}});
  installMessengerModules(context);const run=code=>vm.runInContext(code,context);run(source);
  run("Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},members:[{id:'u1',name:'담당'},{id:'u2',name:'검토'},{id:'u3',name:'요청자'}],channels:[{id:'c1',name:'프로젝트 방',kind:'channel',memberIds:['u1','u2','u3'],canPost:true}],channelId:'c1',chatCategory:'all',drawer:'personal',personalTab:'tasks',taskScope:'mine',taskFilter:'all'});");
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));
  context.recordDialog=message=>dialogs.push(message);context.report=message=>errors.push(message);context.recordSource=message=>opened.push(message);
  run("api=request;toast=report;taskDialog=recordDialog;openSearchMessage=recordSource;openModal=(title,html)=>{modalVersion++;modal.open=true;state.testModalTitle=title;state.testModalHtml=html;document.querySelector('.modal-body').innerHTML=html;};");
  return{context,run,nodes,requests,dialogs,errors,opened,state:run('state')};
}

function message(overrides={}){
  return{id:'m1',channelId:'c1',body:'첫 화면에는 예약 날짜를 넣고, 마지막 화면에는 문의 링크를 연결해 주세요.\n세로 영상과 정사각 이미지 두 버전을 전달해 주세요.',user:{id:'u3',name:'요청자'},createdAt:'2026-10-09T00:00:00Z',task:{id:'t1',messageId:'m1',channelId:'c1',title:'예약 안내 제작',stage:'doing',status:'doing',assignee:{id:'u1',name:'담당'},reviewer:{id:'u2',name:'검토'},createdBy:{id:'u3',name:'요청자'},dueDate:'2026-10-12',revision:7,resultMessageId:null,allowedStages:['review'],canManage:true},...overrides};
}

function nextAction(html){
  const list=html.match(/<h4>다음 할 일<\/h4><ol class="td-steps">([\s\S]*?)<\/ol>/);
  assert.ok(list,'the next action must be presented as a readable sequence');return list[1];
}

test('task details retain the full request and escape title, body, people and due date',()=>{
  const f=fixture(),original=message(),tail='본문 마지막 완료 조건';
  original.body='<img src=x onerror=alert(1)>\n'+ '구체적인 작업 지시 '.repeat(60)+tail;
  original.task.title='<script>제작 제목</script>';original.task.assignee.name='<b>담당</b>';original.task.reviewer.name='<svg onload=alert(1)>검토';original.task.createdBy.name='<i>요청자</i>';original.task.dueDate='2026-10-12" onclick="alert(1)';
  f.context.message=original;f.run("state.user={id:'u9',name:'다른 크루',role:'member'}");const before=JSON.stringify(original),html=f.run('taskDetailHtml(message)');
  assert.ok(html.includes(tail),'full source request must not be replaced by the short task title');
  for(const safe of ['&lt;img','&lt;script&gt;','&lt;b&gt;','&lt;svg','&lt;i&gt;','2026-10-12&quot;'])assert.ok(html.includes(safe),safe);
  for(const raw of ['<img src=x','<script>','<b>담당','<svg onload=','<i>요청자'])assert.ok(!html.includes(raw),'user supplied markup must remain text: '+raw);
  assert.equal(JSON.stringify(original),before);assert.equal(f.requests.length,0);
});

test('task details show the recorded request, assignment, review, deadline and completion guidance',()=>{
  const f=fixture();f.context.message=message();const html=f.run('taskDetailHtml(message)');
  for(const value of ['첫 화면에는 예약 날짜','문의 링크','세로 영상','정사각 이미지','요청자','담당','검토','10월 12일','완료','결과물'])assert.ok(html.includes(value),value);
  assert.match(html,/(다음|지금).*(행동|할 일|해야)/s);
  assert.match(html,/내가 담당이에요/);assert.match(html,/담당을 정한 기록/);
});

test('the next action changes with the current stage and signed-in role',()=>{
  const f=fixture();f.context.message=message();f.run("message.task.stage='requested'");const assigned=nextAction(f.run('taskDetailHtml(message)'));
  assert.match(assigned,/‘수락하기’를 눌러/);
  f.run("state.user={id:'u2',name:'검토',role:'member'}");const requestedReviewer=nextAction(f.run('taskDetailHtml(message)'));assert.notEqual(assigned,requestedReviewer,'reviewer must not receive the assignee next action');assert.ok(!/‘수락하기’를 눌러/.test(requestedReviewer));
  f.run("message.task.stage='review';message.task.resultMessageId='result1'");const review=nextAction(f.run('taskDetailHtml(message)'));assert.notEqual(requestedReviewer,review);assert.match(review,/결과물/);assert.match(review,/‘완료’를 눌러/);
  f.run("state.user={id:'u1',name:'담당',role:'member'}");const reviewAssignee=nextAction(f.run('taskDetailHtml(message)'));assert.notEqual(review,reviewAssignee,'assignee must not receive the reviewer approval action');assert.match(reviewAssignee,/기다려/);assert.ok(!/‘완료’를 눌러/.test(reviewAssignee));
  f.run("message.task.stage='changes'");const changes=nextAction(f.run('taskDetailHtml(message)'));assert.match(changes,/수정 의견대로.*고쳐/);assert.match(changes,/검토 맡기기/);
  f.run("message.task.stage='done'");assert.match(nextAction(f.run('taskDetailHtml(message)')),/끝난 일/);
});

for(const [stage,userId] of [['requested','u1'],['review','u2'],['done','u1']]){
  test(`read-only ${stage} details explain access instead of instructing an unavailable transition`,()=>{
    const f=fixture();f.context.message=message();f.context.stage=stage;f.context.userId=userId;f.run("message.task.stage=stage;message.task.canManage=false;message.task.allowedStages=[];state.integrated={canWrite:false};state.user=state.members.find(person=>person.id===userId)");
    const action=nextAction(f.run('taskDetailHtml(message)'));assert.match(action,/이 계정으로는 상태를 바꿀 수 없/);assert.match(action,/요청과 결과물만 볼 수/);assert.match(action,/요청한 사람에게/);assert.ok(!/‘(수락하기|시작하기|완료|검토 맡기기|수정 요청|다시 열기)’를 눌러/.test(action));
  });
}

test('missing reviewer and deadline are disclosed and completion stays aligned with the recorded workflow',()=>{
  const f=fixture();f.context.message=message();f.run('message.task.reviewer=null;message.task.dueDate=null');const html=f.run('taskDetailHtml(message)');assert.ok(html.includes('<span>검토</span><strong>없음</strong>')&&html.includes('기한 없음'));assert.match(html,/검토자가 없어서 담당이 ‘완료’로 바꾸면 끝나요/);
  f.run("message.task.stage='review';message.task.reviewerId='former';message.task.reviewerUnavailable=true");const unavailable=f.run('taskDetailHtml(message)');assert.ok(unavailable.includes('<strong>기존 검토자</strong>')&&unavailable.includes('검토자 바꿔야 함'));const action=nextAction(unavailable);assert.match(action,/새 검토/);assert.ok(!/‘완료’를 눌러/.test(action));
});

test('a departed reviewer is shown as unavailable by name before review and the assignee asks for reassignment',()=>{
  const f=fixture();f.context.message=message();f.run("message.task.stage='doing';message.task.reviewerUnavailable=true;message.task.canReassignReviewer=false;message.task.allowedStages=[]");const html=f.run('taskDetailHtml(message)'),action=nextAction(html);assert.ok(html.includes('검토자 바꿔야 함'));assert.ok(f.run('workdayTaskHtml(message.task,0,"2026-10-09")').includes('<b>검토자 바꿔야 함</b>'));assert.match(action,/요청한 사람이나 관리자에게 새 검토자/);assert.ok(!action.includes('검토 맡기기'));
  f.run("state.user=state.members.find(person=>person.id==='u3');message.task.canReassignReviewer=true");assert.match(nextAction(f.run('taskDetailHtml(message)')),/‘검토자 다시 정하기’를 눌러 새 검토자/);assert.match(f.run('workdayTaskHtml(message.task,0,"2026-10-09")'),/>정하기</);
});

for(const stage of ['requested','review','done']){
  test(`an unavailable ${stage} assignee is marked and never described as currently working`,()=>{
    const f=fixture();f.context.message=message();f.context.stage=stage;f.run('message.task.stage=stage;message.task.assigneeUnavailable=true;message.task.allowedStages=[]');const html=f.run('taskDetailHtml(message)'),action=nextAction(html);assert.ok(html.includes('담당 바꿔야 함'));assert.ok(f.run('workdayTaskHtml(message.task,0,"2026-10-09")').includes('<b>담당 바꿔야 함</b>'));assert.match(action,stage==='done'?/끝난 기록과 결과물은 그대로/:/담당 크루를 찾을 수 없어요.*담당을 다시 정해/);assert.ok(!/(차례예요|기다리는 중|‘(수락하기|시작하기|완료|검토 맡기기|다시 열기)’를 눌러)/.test(action));
  });
}

test('a completed task with an unavailable reviewer keeps its record and does not offer an impossible restart',()=>{
  const f=fixture();f.context.message=message();f.run("message.task.stage='done';message.task.reviewerUnavailable=true;message.task.allowedStages=[];message.task.canReassignReviewer=false");const action=nextAction(f.run('taskDetailHtml(message)'));assert.match(action,/끝난 기록과 결과물은 그대로/);assert.match(action,/새 할 일로 요청/);assert.ok(!/‘다시 열기’를 눌러/.test(action));assert.ok(!f.run('workdayTaskHtml(message.task,0,"2026-10-09")').includes('바꿔야 함'));assert.equal(f.run('reviewerRecoveryHtml(message.task,state.members)'),'');
});

test('a legacy task without an assignee asks for confirmation instead of claiming that someone is working',()=>{
  const f=fixture();f.context.message=message();f.run('message.task.assignee=null;message.task.canManage=true');assert.match(nextAction(f.run('taskDetailHtml(message)')),/담당 크루를 찾을 수 없어요.*담당을 다시 정해/);assert.ok(f.run('workdayTaskHtml(message.task,0,"2026-10-09")').includes('<b>담당 바꿔야 함</b>'));
});

test('reviewer change history describes preserved task state without inventing a prior result submission',()=>{
  const f=fixture();f.context.event={kind:'task_reviewer_reassigned',changes:{from:'u1',to:'u2'}};const text=f.run('catchUpChangeText(event)');assert.ok(text.includes('상태는 그대로'));assert.ok(!text.includes('같은 결과물'));
});

test('task selection explains explicit assignment and deadline order for the chosen scope',()=>{
  const f=fixture(),mine=f.run('taskSelectionHtml()');
  assert.match(mine,/(담당|배정)/);assert.match(mine,/기한/);assert.match(mine,/(정렬|순서|순으로|생성 순|먼저)/);assert.match(mine,/누군가 ‘할 일로 만들기’를 누르고/);assert.ok(!/자동으로/.test(mine));
  f.run("state.taskScope='all'");const all=f.run('taskSelectionHtml()');assert.notEqual(mine,all);assert.match(all,/(참여|대화방|모든 방)/);
  f.run("state.taskScope='channel'");const channel=f.run('taskSelectionHtml()');assert.notEqual(all,channel);assert.match(channel,/(이 대화방|현재 대화방)/);
  f.run("state.channelId=null");assert.equal(f.run('taskSelectionHtml()'),all,'channel scope without a selected room follows the all-room endpoint');
});

test('the task tile opens detail while a separate button still opens the original conversation',()=>{
  const f=fixture();f.context.item=message().task;const html=f.run('personalItemHtml(item,3,"tasks")');
  assert.match(html,/<button[^>]*class="personal-item-main"[^>]*data-personal-index="3"[^>]*data-personal-action="task"/);
  assert.match(html,/<button[^>]*data-personal-index="3"[^>]*data-personal-action="open"[^>]*>/);
});

test('task panel click fetches detail and original-conversation action navigates without changing the task',async()=>{
  const f=fixture(),original=message();const loading=f.run('loadPersonalPanel()');f.requests[0].resolve({tasks:[original.task],hasMore:false});await loading;
  const click=action=>f.nodes.get('#personal-body').onclick({target:{closest:()=>({dataset:{personalIndex:'0',personalAction:action}})}});
  const opening=click('task');assert.equal(f.requests[1].path,'/api/messages/m1');assert.equal(f.requests[1].options.method||'GET','GET');
  f.requests[1].resolve({message:original});await opening;assert.equal(f.dialogs[0].body,original.body);
  await click('open');assert.equal(f.opened.length,1);assert.equal(f.opened[0].id,'m1');assert.equal(f.requests.length,2);
});

test('existing task detail uses the freshest server message without a task write',async()=>{
  const f=fixture();f.context.message=message();const opening=f.run('openTaskDetail(message)');
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/messages/m1');assert.equal(f.requests[0].options.method||'GET','GET');assert.equal(f.requests[0].options.body,undefined);assert.equal(f.dialogs.length,0);
  const fresh=message({body:'최신 요청 원문',task:{...message().task,revision:8,stage:'review',resultMessageId:'r1'}});f.requests[0].resolve({message:fresh});await opening;
  assert.equal(f.dialogs.length,1);assert.equal(f.dialogs[0],fresh);assert.equal(f.dialogs[0].task.revision,8);assert.equal(f.requests.length,1);
});

test('creating a task from a message opens the existing creation form immediately',async()=>{
  const f=fixture(),original=message({task:null});f.context.message=original;await f.run('openTaskDetail(message)');assert.equal(f.requests.length,0);assert.equal(f.dialogs[0],original);
});

test('a task removed before the latest read stays an error instead of becoming a creation form',async()=>{
  const f=fixture();f.context.message=message();const opening=f.run('openTaskDetail(message)');f.requests[0].resolve({message:message({task:null})});await opening;assert.equal(f.dialogs.length,0);assert.match(f.nodes.get('.modal-body').innerHTML,/이제 할 일이 아니/);assert.equal(f.requests.length,1);
});

for(const [name,change] of [['closed modal','modal.close()'],['replaced modal',"openModal('새 창','새 창 내용')"],['changed account',"state.user={id:'u2',name:'다른 크루'}"]]){
  test(`a late detail response cannot replace a ${name}`,async()=>{
    const f=fixture();f.context.message=message();const opening=f.run('openTaskDetail(message)');f.run(change);f.requests[0].resolve({message:message({body:'늦은 응답'})});await opening;assert.equal(f.dialogs.length,0);assert.equal(f.errors.length,0);
  });
}

test('a newer task click wins when detail requests return out of order',async()=>{
  const f=fixture();f.context.first=message();f.context.second=message({id:'m2',task:{...message().task,id:'t2',messageId:'m2'}});const first=f.run('openTaskDetail(first)'),second=f.run('openTaskDetail(second)');
  f.requests[1].resolve({message:f.context.second});await second;f.requests[0].resolve({message:f.context.first});await first;assert.equal(f.dialogs.length,1);assert.equal(f.dialogs[0].id,'m2');
});

test('a failed late read cannot put its error into another dialog',async()=>{
  const f=fixture();f.context.message=message();const opening=f.run('openTaskDetail(message)');f.run("openModal('다른 업무','다른 업무 화면')");f.requests[0].reject(new Error('이전 요청 오류'));await opening;assert.equal(f.nodes.get('.modal-body').innerHTML,'다른 업무 화면');assert.equal(f.errors.length,0);
});

test('failed detail reads show a safe error and allow a fresh read-only retry',async()=>{
  const f=fixture();f.context.message=message();const opening=f.run('openTaskDetail(message)');f.requests[0].reject(new Error('<img src=x> 읽기 실패'));await opening;
  const html=f.nodes.get('.modal-body').innerHTML;assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.match(html,/(다시|재시도)/);
  const retry=f.nodes.get('#task-detail-retry');assert.equal(typeof retry.onclick,'function');const retrying=retry.onclick();assert.equal(f.requests[1].path,'/api/messages/m1');assert.equal(f.requests[1].options.method||'GET','GET');f.requests[1].resolve({message:message()});await retrying;assert.equal(f.dialogs.length,1);
});
