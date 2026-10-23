import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// 메신저 날짜·시각은 오늘 탭·할 일 상세와 같은 꼴로 보인다(10-23 화면 검수 F6) — 기한은 「…까지」, 날짜는 「10월 24일」, 날짜+시각은 「10월 24일 오후 7:04」.
// ISO(2026-10-24)·점 표기(10. 23.)·두 자리 시각(오후 07:04)이 화면 글로 다시 나오면 깨진다.
// 다시 볼 시간·바뀐 것·공지 확인 시각은 PC 시간으로 적으므로 이 파일은 한국 시간으로 고정해 같은 글을 기대한다.
process.env.TZ='Asia/Seoul';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function fixture(timers=null){
  const node=()=>({innerHTML:'',dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},setAttribute(){},getAttribute:()=>null,addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]});
  const document={hidden:false,activeElement:null,body:node(),querySelector:()=>node(),querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:(fn,ms)=>timers?timers.push({fn,ms}):0,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=>'request'}});
  const run=code=>vm.runInContext(code,context);run(source);
  run("Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},members:[{id:'u1',name:'담당'},{id:'u2',name:'하윤'}],channels:[{id:'c1',name:'마케팅팀',kind:'channel',memberIds:['u1','u2'],canPost:true}],channelId:'c1'});");
  return {run,context,document};
}
const text=html=>String(html).replace(/<[^>]*>/g,'');
const oldShapes=/2026-10-\d\d|\b10\. \d+\.|오후 0\d:/;
const task={id:'t1',messageId:'1',channelId:'c1',title:'시안 수정',stage:'doing',status:'doing',assignee:{id:'u1',name:'담당'},createdBy:{id:'u2',name:'하윤'},dueDate:'2026-10-24',revision:2,canManage:true,allowedStages:['done']};
const saved={id:'9',channelId:'c1',body:'다시 볼 메시지',createdAt:'2026-10-23T10:04:00Z',user:{id:'u2',name:'하윤'},reminder:{remindAt:'2026-10-24T10:04:00Z',status:'scheduled'}};

test('the all-tasks row and the chat task card show the due date like the today tab',()=>{
  const f=fixture();f.context.item={...task,message:{id:'1',channelId:'c1',body:'요청'},createdAt:'2026-10-23T10:04:00Z'};
  const row=text(f.run("personalItemHtml(item,0,'tasks')"));assert.match(row,/마케팅팀 · 10월 24일까지/);assert.doesNotMatch(row,oldShapes);
  f.context.message={id:'1',channelId:'c1',body:'요청',task:{...task,workday:{date:'2026-10-23'}}};
  const card=text(f.run('messageProductivityHtml(message)'));assert.match(card,/담당 · 진행 중 · 내일까지/);assert.doesNotMatch(card,oldShapes);
  f.context.item={...task,dueDate:null,message:{id:'1',channelId:'c1',body:'요청'},createdAt:'2026-10-23T10:04:00Z'};assert.match(text(f.run("personalItemHtml(item,0,'tasks')")),/마케팅팀 · 기한 없음/);
  // 끝난 일에는 상대 기한을 붙이지 않는다(할 일 상세와 같은 기준)
  const done={...task,stage:'done',status:'done',dueDate:'2026-10-21',workday:{date:'2026-10-23'}};
  f.context.item={...done,message:{id:'1',channelId:'c1',body:'요청'},createdAt:'2026-10-23T10:04:00Z'};const doneRow=text(f.run("personalItemHtml(item,0,'tasks')"));assert.match(doneRow,/마케팅팀 · 10월 21일까지/);assert.doesNotMatch(doneRow,/지남/);
  f.context.message={id:'1',channelId:'c1',body:'요청',task:done};const doneCard=text(f.run('messageProductivityHtml(message)'));assert.match(doneCard,/완료 · 10월 21일까지/);assert.doesNotMatch(doneCard,/지남/);
});

test('reminders, catch-up and decisions use one date and time shape',()=>{
  const f=fixture();
  f.context.saved=saved;
  const savedRow=text(f.run("personalItemHtml(saved,0,'saved')"));assert.match(savedRow,/10월 24일 오후 7:04/);assert.doesNotMatch(savedRow,oldShapes);
  assert.equal(f.run("catchUpChangeText({kind:'task_due',changes:{from:'2026-10-20',to:'2026-10-22'}})"),'10월 20일 → 10월 22일');
  assert.equal(f.run("catchUpChangeText({kind:'task_due',changes:{from:null,to:'2026-10-22'}})"),'기한 없음 → 10월 22일');
  assert.equal(f.run("catchUpChangeText({kind:'decision',decision:{effectiveDate:'2026-10-23'}})"),'10월 23일부터 적용');
  f.context.event={kind:'task_created',createdAt:'2026-10-23T11:14:00Z',task:{...task,message:{id:'1',channelId:'c1',body:'요청'}}};
  const event=text(f.run('catchUpEventHtml(event,0)'));
  assert.match(event,/10월 23일 오후 8:14/);assert.doesNotMatch(event,oldShapes);
  const decision=text(f.run("decisionHtml({id:'d1',kind:'decision',summary:'금요일 오전에 본다',channelId:'c1',messageId:'1',confirmedBy:{id:'u1',name:'담당'},confirmedAt:'2026-10-23T10:04:00Z',effectiveDate:'2026-10-23',isCurrent:true})"));
  assert.match(decision,/10월 23일부터 적용/);assert.match(decision,/10월 23일 기록/);assert.doesNotMatch(decision,oldShapes);
  // 새 기록이 바꿀 이전 기록을 고르는 줄도 결정 탭과 같은 글
  const option=text(f.run("replacementOptionHtml({id:'d1',summary:'금요일 오전에 본다',effectiveDate:'2026-10-23',confirmedBy:{id:'u1',name:'담당'}},false)"));
  assert.match(option,/10월 23일부터 · 담당/);assert.doesNotMatch(option,oldShapes);
});

test('the reminder time reads in the PC clock, the same clock its time box is typed in',()=>{
  const f=fixture();f.context.saved=saved;
  try{process.env.TZ='Asia/Ulaanbaatar';assert.match(text(f.run("personalItemHtml(saved,0,'saved')")),/10월 24일 오후 6:04/);}
  finally{process.env.TZ='Asia/Seoul';}
});
