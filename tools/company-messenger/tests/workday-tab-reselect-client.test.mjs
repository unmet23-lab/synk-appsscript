import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// 「내 업무」에서 이미 열린 「오늘」 탭을 다시 눌러도 오늘 할 일 줄의 단추가 계속 할 일을 연다.
// 탭을 누르면 목록 상태를 비우는데, 오늘 할 일은 자료가 같으면 다시 그리지 않아(스냅숏 비교) 빈 목록으로 남던 것(10-23 화면 검수).
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function fixture(){
  const nodes=new Map(),requests=[];
  const node=()=>({innerHTML:'',value:'',textContent:'',hidden:false,disabled:false,open:false,isConnected:true,dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},contains:()=>false,setAttribute(){},removeAttribute(){},getAttribute:()=>null,addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],focus(){},scrollIntoView(){},close(){this.open=false;}});
  for(const key of ['#app','#modal','#drawer','#personal-body','#close-drawer','#sidebar','#mobile-scrim','#mobile-menu'])nodes.set(key,node());
  const tabs=['workday','catchup'].map(key=>({...node(),dataset:{personalTab:key}}));
  nodes.get('#drawer').querySelectorAll=selector=>selector==='[data-personal-tab]'?tabs:[];
  const document={hidden:false,activeElement:null,body:node(),querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}};
  const window={parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}};
  const context=vm.createContext({document,window,location:{pathname:'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>0,clearTimeout(){},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=>'request'}});
  const run=code=>vm.runInContext(code,context);run(source);
  run("Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},members:[{id:'u1',name:'담당'}],channels:[{id:'c1',name:'프로젝트',kind:'channel',memberIds:['u1'],canPost:true}],channelId:'c1',chatCategory:'all'});");
  context.request=path=>new Promise((resolve,reject)=>requests.push({path,resolve,reject}));
  run("api=request;toast=()=>{};attachDeadlineSettings=async()=>{};syncDrawerAccess=()=>{};openTaskDetail=message=>{state.openedTasks=(state.openedTasks||[]).concat(message?.task?.id||null);};");
  return {run,nodes,tabs,requests,state:run('state')};
}
const task={id:'t1',messageId:'1',channelId:'c1',title:'시안 수정',stage:'doing',status:'doing',assignee:{id:'u1',name:'담당'},reviewer:null,createdBy:{id:'u1',name:'담당'},dueDate:'2026-10-09',revision:7,canManage:true,allowedStages:['done'],message:{id:'1',channelId:'c1',body:'요청 원문'}};
const workday=()=>({date:'2026-10-09',serverNow:'2026-10-09T01:00:00Z',nextDayRefreshAfterMs:3600000,today:{groups:{reply:[],due:[task],review:[],recovery:[]},counts:{reply:0,due:1,review:0,recovery:0},total:1},remaining:{groups:{upcoming:[],undated:[],waiting:[]},counts:{upcoming:0,undated:0,waiting:0},total:0},openTotal:1});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
// 줄 끝 단추(3판의 「열기」)를 누른 것과 같은 사건
const rowButton={target:{closest:selector=>selector==='[data-workday-task-id]'?{dataset:{workdayTaskId:'t1'}}:selector==='[data-workday-task]'?{dataset:{workdayTask:'0'}}:null}};

test('reselecting the open today tab keeps the row buttons opening their task when today is unchanged',async()=>{
  const f=fixture();
  f.run("openPersonalPanel('workday')");
  assert.equal(f.requests.at(-1).path,'/api/workday');f.requests.at(-1).resolve(workday());await flush();
  assert.ok(f.nodes.get('#personal-body').innerHTML.includes('시안 수정'),'today renders the task');
  await f.nodes.get('#personal-body').onclick(rowButton);
  assert.deepEqual([...(f.state.openedTasks||[])],['t1'],'the row opens its task before reselecting');
  f.tabs[0].onclick();
  assert.equal(f.requests.at(-1).path,'/api/workday');f.requests.at(-1).resolve(workday());await flush();
  // 줄이 화면에 남아 있어야 한다 — 같은 자료면 다시 그리지 않으므로, 불러오는 표시로 덮으면 빈 화면이 된다
  assert.ok(f.nodes.get('#personal-body').innerHTML.includes('시안 수정'),'the row stays on screen after reselecting the open tab');
  await f.nodes.get('#personal-body').onclick(rowButton);
  assert.deepEqual([...(f.state.openedTasks||[])],['t1','t1'],'the same row still opens its task after reselecting the open tab');
});

test('switching to another tab still starts that tab with an empty list',async()=>{
  const f=fixture();
  f.run("openPersonalPanel('workday')");f.requests.at(-1).resolve(workday());await flush();
  assert.ok(f.state.personalItems.length>0);
  f.tabs[1].onclick();
  assert.equal(f.state.personalTab,'catchup');assert.equal(f.state.personalItems.length,0,'a different tab does not keep the previous tab rows');
});
