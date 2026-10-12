import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildClientDeadlineOverlaps} from '../../../docs/마케팅/온라인마케팅지도/engagement/company/client-deadline-overlaps.mjs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
const now='2026-10-12T03:00:00Z';
function fixture({integrated=true}={}){
  const nodes=new Map(),requests=[],timers=new Map(),messages=[];let serial=0;
  const node=()=>({value:'',open:false,isConnected:true,dataset:{},scrollTop:0,writes:0,_html:'',get innerHTML(){return this._html;},set innerHTML(value){this._html=value;this.writes++;},classList:{add(){},remove(){},toggle(){}},contains(target){return target?.inside===this;},setAttribute(){},removeAttribute(){},addEventListener(){},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],focus(){},close(){this.open=false;}});
  for(const key of ['#app','#modal','#drawer','#personal-body','#composer-input'])nodes.set(key,node());
  const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}};
  const window={parent:{postMessage:(value,origin)=>messages.push({value,origin})},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},getSelection:()=>null};
  const context=vm.createContext({document,window,location:{pathname:'/messenger/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:(callback,delay)=>{const id=++serial;timers.set(id,{id,callback,delay});return id;},clearTimeout:id=>timers.delete(id),URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=>first}});
  const run=code=>vm.runInContext(code,context);run(source);
  run(`Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},channels:[],members:[],drawer:'personal',personalTab:'workday',integrated:${integrated?"{companyUserId:'owner',canWrite:true}":'null'}});moduleVisible=true;`);
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));
  run('api=request;clientWorkflowApi=()=>request("/api/client-workflow");publicationWorkflowApi=()=>request("/api/publication-workflow");attachDeadlineSettings=async()=>{};');
  return {context,run,nodes,requests,timers,messages,document,state:run('state')};
}
const workday=()=>({date:'2026-10-12',nextDayRefreshAfterMs:60000,today:{groups:{reply:[],due:[],review:[],recovery:[]}},remaining:{groups:{upcoming:[],undated:[],waiting:[]},counts:{upcoming:0,undated:0,waiting:0}}});
function project(id,title='동명 프로젝트',date='2026-10-15'){
  const href='/?tab=workroom&section=clients&project='+id+'&schedule=1';
  return {id,title,stage:'received',schedule:{enabled:true,status:'tracking',milestones:['preview','customer','revision','delivery'].map(key=>({id:key,label:key==='preview'?'첫 시안 등록':key,targetDate:key==='preview'?date:'',status:key==='revision'?'not_required':key==='preview'?'upcoming':'undated',href:key==='preview'?'/pulse-app/?mode=staff&project='+id+'&tab=review':href})),waiting:[],agreedDueDate:date}};
}
const report=(projects=[project(first),project(second)])=>buildClientDeadlineOverlaps(projects,{now});
async function load(f,result={data:report()},{background=false,clientError=null}={}){
  const start=f.requests.length,pending=f.run(`loadPersonalPanel({background:${background}})`);
  for(const request of f.requests.slice(start)){if(request.path==='/api/workday')request.resolve(workday());else if(request.path==='/api/client-workflow'){if(clientError)request.reject(new Error(clientError));else request.resolve({items:[],projectGroups:[],deadlineOverlaps:result});}else if(request.path==='/api/publication-workflow')request.resolve({items:[]});else assert.fail(request.path);}
  await pending;return f.nodes.get('#personal-body').innerHTML;
}

test('today displays existing projected overlaps without adding any request, timer, task or today-action count',async()=>{
  const f=fixture(),html=await load(f);assert.match(html,/여러 프로젝트의 기한 겹침/);assert.match(html,/1일 · 2개 프로젝트/);assert.match(html,/2개 프로젝트 · 기한 항목 4개/);assert.match(html,/내가 처리할 일과 별도로/);assert.match(html,/현재 열람 권한이 있는 프로젝트 2개/);assert.match(html,/오늘 처리할 일이 없습니다/);assert.match(html,/고객 합의 기한/);assert.match(html,/내부 목표일/);assert.match(html,/실제 작업 시간이나 과부하를 뜻하지/);
  assert.deepEqual(f.requests.map(request=>request.path),['/api/workday','/api/client-workflow','/api/publication-workflow']);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,10000);assert.equal(f.state.personalItems.length,0);
});

test('one project with several dates is not a cross-project overlap and undated entries remain visible',async()=>{
  const html=await load(fixture(),{data:report([project(first)])});assert.match(html,/0일 · 0개 프로젝트/);assert.match(html,/같은 날 겹치는 프로젝트가 없습니다/);assert.match(html,/기한 미입력 2개/);assert.doesNotMatch(html,/class="deadline-overlap-day"/);
});

test('no enabled projects, missing dates, past dates and dates after the window have distinct observable states',async()=>{
  const f=fixture();assert.match(await load(f,{data:report([])}),/일정 점검 중인 프로젝트가 없습니다/);
  const missing=project(first,'날짜 없음',''),past=project(second,'지난 프로젝트','2026-10-11'),later=project('33333333-3333-4333-8333-333333333333','이후 프로젝트','2026-11-12');
  const html=await load(f,{data:report([missing,past,later])});assert.match(html,/기간 안에 등록된 미완료 기한이 없습니다/);assert.match(html,/기한 미입력 8개/);assert.match(html,/지난 기한 2개/);assert.match(html,/기간 이후 2개/);assert.match(html,/2026-11-11/);assert.match(html,/날짜 없음/);assert.match(html,/지난 프로젝트/);assert.match(html,/이후 프로젝트/);
});

test('malformed or unavailable overlap data is a separate failure instead of an empty-success result',async()=>{
  const f=fixture();for(const result of [null,{}, {error:'<img src=x> 일정 조회 실패'}, {data:{}}]){const html=await load(f,result);assert.match(html,/겹치는 기한이 없다는 뜻은 아닙니다/);assert.match(html,/확인 필요/);assert.doesNotMatch(html,/0일 · 0개 프로젝트|<img/);assert.match(html,/data-productivity-refresh/);}
  const html=await load(f,undefined,{clientError:'고객 조회 실패'});assert.match(html,/고객 프로젝트를 불러오지 못해 기한 겹침도 확인하지 못했습니다/);
});

test('duplicate projects, invalid counts, another project links and impossible period cannot pass UI validation',async()=>{
  const f=fixture();for(const change of [data=>data.days[0].projects[1]=data.days[0].projects[0],data=>data.counts.overlapDayCount=0,data=>data.days[0].milestoneCount=8,data=>data.days[0].projects[0].milestones[0].href='/?tab=workroom&section=clients&project='+second+'&schedule=1',data=>data.period.endDate='2026-11-10',data=>data.observations.undated.milestoneCount=0]){const data=report();change(data);assert.match(await load(f,{data}),/기한 정보를 확인하지 못했습니다/);}
});

test('same-origin original PULSE and workroom links are preserved while unrelated or duplicate parameters are rejected',()=>{
  const f=fixture();for(const href of ['/?tab=workroom&section=clients&project='+first+'&schedule=1','/pulse-app/?mode=staff&project='+first+'&tab=review','/pulse-app/?mode=staff&project='+first+'&tab=strategy']){f.context.href=href;f.context.projectId=first;assert.equal(f.run('safeDeadlineOverlapHref(href,projectId)'),'http://localhost'+href);}
  for(const href of ['https://evil.example/pulse-app/?mode=staff&project='+first+'&tab=review','/pulse-app/?mode=staff&project='+first+'&tab=review&next=/admin','/pulse-app/?mode=staff&project='+first+'&tab=review&project='+second,'/pulse-app/?mode=customer&project='+first+'&tab=review','/?tab=workroom&section=clients&project='+second+'&schedule=1','javascript:alert(1)']){f.context.href=href;assert.equal(f.run('safeDeadlineOverlapHref(href,projectId)'),null,href);}
});

test('original workroom links navigate through the existing host and PULSE links retain native top navigation',async()=>{
  const f=fixture();await load(f);const click=async href=>{let prevented=false;const target={dataset:{deadlineProject:first},getAttribute:key=>key==='href'?href:null};await f.nodes.get('#personal-body').onclick({preventDefault(){prevented=true;},target:{closest:selector=>selector==='[data-deadline-open]'?target:null}});return prevented;};
  const workroom='http://localhost/?tab=workroom&section=clients&project='+first+'&schedule=1';assert.equal(await click(workroom),true);assert.equal(f.messages[0].value.type,'messenger:client-open');assert.equal(f.messages[0].value.url,workroom);assert.equal(await click('http://localhost/pulse-app/?mode=staff&project='+first+'&tab=review'),false);assert.equal(f.messages.length,1);assert.equal(f.requests.length,3);
});

test('only a checkedAt change does not replace the expanded DOM or move focus',async()=>{
  const f=fixture(),data=report();await load(f,{data});const body=f.nodes.get('#personal-body'),writes=body.writes;data.checkedAt='2026-10-12T03:01:00Z';await load(f,{data},{background:true});assert.equal(body.writes,writes);assert.equal(f.timers.size,1);
});

test('late previous-session response cannot reveal project titles and a failed refresh removes earlier overlaps',async()=>{
  const f=fixture();await load(f);const pending=f.run('loadPersonalPanel()'),requests=f.requests.slice(-3);f.run('resetWorkNotificationState();state.user={id:"next",role:"member"};');for(const request of requests)request.resolve(request.path==='/api/workday'?workday():request.path==='/api/client-workflow'?{items:[],deadlineOverlaps:{data:report([project(first,'LATE PRIVATE'),project(second)])}}:{items:[]});await pending;assert.doesNotMatch(f.nodes.get('#personal-body').innerHTML,/LATE PRIVATE/);
  const html=await load(f,{error:'일정 응답 없음'});assert.doesNotMatch(html,/동명 프로젝트/);assert.match(html,/일정 응답 없음/);
});

test('project text is escaped and standalone workday never displays company overlap data',async()=>{
  const html=await load(fixture(),{data:report([project(first,'<svg onload=x>'),project(second)])});assert.doesNotMatch(html,/<svg/);assert.match(html,/&lt;svg/);const f=fixture({integrated:false});assert.doesNotMatch(await load(f),/여러 프로젝트의 기한 겹침/);assert.deepEqual(f.requests.map(request=>request.path),['/api/workday']);
});
