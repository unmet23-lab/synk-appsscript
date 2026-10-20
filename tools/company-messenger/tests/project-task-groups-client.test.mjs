import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
const uid='12345678-1234-1234-1234-123456789abc';
const entryId='a1'.repeat(32);
const publicationHref=(action='prepare',fields='inboxId='+uid)=>`/?tab=workroom&section=tools&tool=publication&publicationAction=${action}&${fields}`;
function fixture({embedded=true,integrated=embedded}={}){
  const nodes=new Map(),requests=[],timers=new Map(),messages=[],windowEvents=new Map(),documentEvents=new Map();let timerId=0;
  const node=()=>({value:'',textContent:'',disabled:false,open:false,isConnected:true,dataset:{},listeners:{},scrollTop:0,writes:0,_html:'',get innerHTML(){return this._html;},set innerHTML(value){this._html=value;this.writes++;},classList:{add(){},remove(){},toggle(){}},contains(target){return target?.inside===this;},setAttribute(){},removeAttribute(){},addEventListener(name,handler){this.listeners[name]=handler;},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],focus(){},close(){this.open=false;}});
  for(const key of ['#app','#modal','#drawer','#personal-body','#composer-input'])nodes.set(key,node());
  const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener:(name,handler)=>documentEvents.set(name,handler)};
  const window={parent:{postMessage:(value,origin)=>messages.push({value,origin})},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(name,handler)=>windowEvents.set(name,handler),getSelection:()=>null};
  const context=vm.createContext({document,window,location:{pathname:embedded?'/messenger/':'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{id,callback,delay});return id;},clearTimeout:id=>timers.delete(id),URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=>uid},actualClientWorkflowApi:null});
  const run=code=>vm.runInContext(code,context);run(source);
  run(`Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},channels:[],members:[],drawer:'personal',personalTab:'workday',integrated:${integrated?"{companyUserId:'owner',canWrite:true}":'null'}});moduleVisible=true;`);
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));
  run('actualClientWorkflowApi=clientWorkflowApi;api=request;clientWorkflowApi=()=>request("/api/client-workflow");publicationWorkflowApi=()=>request("/api/publication-workflow");attachDeadlineSettings=async()=>{};refreshChannels=async()=>{};refreshMessages=async()=>{};');
  return{context,run,nodes,requests,timers,messages,document,window,windowEvents,documentEvents,state:run('state'),node,fire(timer){timers.delete(timer.id);timer.callback();}};
}
const flush=async()=>{for(let index=0;index<12;index++)await Promise.resolve();};
const workday=()=>({date:'2026-10-12',nextDayRefreshAfterMs:60000,today:{groups:{reply:[],due:[],review:[],recovery:[]}},remaining:{groups:{upcoming:[],undated:[],waiting:[]},counts:{upcoming:0,undated:0,waiting:0}}});
const clientItem=(id,overrides={})=>({id,projectId:uid,projectTitle:'봄 캠페인',group:'reply',kind:'client_request',title:'수정 의견 '+id,text:'장면과 요청을 확인하세요.',href:'/?tab=workroom&section=clients&project='+uid+'&version=version-1&message=message-1&seconds=62.5',actionLabel:'요청 원문',actions:[],...overrides});
function group(items){const actionable=items.filter(item=>item.group!=='waiting'),waiting=items.filter(item=>item.group==='waiting');return {projectId:items[0].projectId,projectTitle:items[0].projectTitle,href:items[0].href,primary:actionable[0]||null,reason:actionable.length?'기한이 지나 먼저 확인하세요.':'고객 또는 내부 담당자의 확인을 기다리고 있어요. 지금 할 일은 없어요.',urgency:actionable.length?'overdue':'waiting',dueDate:'2026-10-11',counts:{total:items.length,actionable:actionable.length,waiting:waiting.length,customerWaiting:waiting.filter(item=>item.status!=='review'&&item.waitingFor!=='staff').length,staffWaiting:waiting.filter(item=>item.status==='review'||item.waitingFor==='staff').length},items};}
async function load(f,data){const start=f.requests.length,pending=f.run('loadPersonalPanel()');for(const request of f.requests.slice(start)){if(request.path==='/api/workday')request.resolve(workday());else if(request.path==='/api/client-workflow')request.resolve(data);else if(request.path==='/api/publication-workflow')request.resolve({items:[]});else assert.fail(request.path);}await pending;return f.nodes.get('#personal-body').innerHTML;}

test('the grouped workday shows one project card with every item, first-action reason and original actionable item total',async()=>{
  const f=fixture(),items=[clientItem('first'),clientItem('second',{group:'next'}),clientItem('waiting',{group:'waiting'})],html=await load(f,{items,projectGroups:[group(items)]});
  assert.equal((html.match(/data-client-project=/g)||[]).length,1);assert.match(html,/오늘 할 일 2개/);assert.match(html,/프로젝트 1개 · 할 일 3개/);assert.match(html,/먼저 할 일/);assert.match(html,/기한이 지나 먼저 확인/);assert.match(html,/같은 프로젝트의 다른 일 2개/);assert.match(html,/답 기다리는 일 1개/);
  for(const item of items)assert.equal((html.match(new RegExp('data-client-item="'+item.id+'"','g'))||[]).length,1);
  assert.doesNotMatch(html,/class="workday-quick-task"/);assert.doesNotMatch(html,/고객 답 기다림<\/h3>/);
});

test('waiting-only projects retain customer and staff rows without requiring a first action or doubling mixed projects',async()=>{
  const f=fixture(),mixed=[clientItem('action'),clientItem('wait',{group:'waiting'})],waiting=[clientItem('staff',{projectId:'project-two',projectTitle:'가을 캠페인',group:'waiting',status:'review',statusLabel:'팀 검토 기다림'}),clientItem('customer',{projectId:'project-two',projectTitle:'가을 캠페인',group:'waiting',status:'waiting_customer',statusLabel:'고객 확인 대기'})],html=await load(f,{items:[...mixed,...waiting],projectGroups:[group(mixed),group(waiting)]});
  assert.equal((html.match(/data-client-project=/g)||[]).length,2);assert.match(html,/답을 기다리는 프로젝트/);assert.match(html,/팀 검토 기다림/);assert.match(html,/고객 확인 대기/);const staffRow=html.match(/data-client-item="staff"[^>]*>([\s\S]*?)<\/article>/)?.[1];assert.ok(staffRow);assert.match(staffRow,/팀 검토 기다림/);assert.doesNotMatch(staffRow,/고객 답 기다림/);assert.match(html,/지금 할 일은 없어요/);assert.match(html,/오늘 할 일 1개/);
  const only=await load(f,{items:waiting,projectGroups:[group(waiting)]});assert.match(only,/오늘 할 일은 없어요/);assert.doesNotMatch(only,/<strong>먼저 할 일<\/strong>/);
});

test('legacy list responses retain the original customer list, while empty group responses remain honest empty work',async()=>{
  const f=fixture(),items=[clientItem('legacy')],legacy=await load(f,{items});assert.match(legacy,/내 고객 업무/);assert.match(legacy,/data-client-open="0"/);assert.doesNotMatch(legacy,/data-client-project=/);
  const empty=await load(f,{items:[],projectGroups:[]});assert.match(empty,/오늘 할 일은 없어요/);assert.doesNotMatch(empty,/data-client-project=/);
});

test('grouped source links keep exact version, message, scene and every supported special card',async()=>{
  const f=fixture(),items=[clientItem('scene'),...['followUp','delivery','closeout','kickoff','changes','requests','schedule'].map(key=>clientItem(key,{href:'/?tab=workroom&section=clients&project='+uid+'&'+key+'=1'}))];await load(f,{items,projectGroups:[group(items)]});
  for(let index=0;index<items.length;index++){let prevented=false;const target={dataset:{clientOpen:String(index)}};await f.nodes.get('#personal-body').onclick({preventDefault(){prevented=true;},target:{closest:selector=>selector==='[data-client-open]'?target:null}});assert.equal(prevented,true);assert.equal(f.messages.at(-1).value.url,'http://localhost'+items[index].href);assert.equal(f.messages.at(-1).value.type,'messenger:client-open');}
  assert.equal(f.requests.length,3,'navigation must not submit a workflow change');
});

test('grouped workflow actions keep the canonical item identifiers and revision after items reorder',async()=>{
  const f=fixture(),first=clientItem('first'),second=clientItem('second',{projectId:uid,messageId:'message-2',versionId:'version-2',revision:7,actions:[{action:'resolve',label:'반영 완료'}]}),items=[second,first],data={items,projectGroups:[{...group(items),primary:first}]};
  const html=await load(f,data);assert.match(html,/data-client-work="0" data-client-action="resolve"/);f.run('loadPersonalPanel=async()=>{};toast=()=>{};clientWorkflowApi=options=>request("workflow-action",options)');const target={dataset:{clientWork:'0',clientAction:'resolve'},disabled:false},pending=f.nodes.get('#personal-body').onclick({target:{closest:selector=>selector==='[data-client-work]'?target:null}});const request=f.requests.at(-1);assert.equal(request.path,'workflow-action');assert.deepEqual({...request.options.body},{projectId:uid,messageId:'message-2',versionId:'version-2',revision:7,action:'resolve'});request.resolve({});await pending;
});

test('group text is escaped and unsafe source links cannot become navigation actions',async()=>{
  const f=fixture(),items=[clientItem('bad',{title:'<img src=x>',projectTitle:'<script>project</script>',text:'<svg onload=bad()>',href:'javascript:bad()'})],data=group(items);data.reason='<img src=reason>';const html=await load(f,{items,projectGroups:[data]});assert.doesNotMatch(html,/<img|<script>|<svg|href="javascript/);assert.match(html,/&lt;script&gt;project/);assert.match(html,/&lt;img src=reason/);assert.doesNotMatch(html,/data-client-open=/);
});

test('the actual workflow API rejects malformed, missing or incomplete group lists and late-session responses',async()=>{
  const f=fixture(),items=[clientItem('one')],valid={items,projectGroups:[group(items)]};f.context.fetch=async()=>({ok:true,json:async()=>valid});assert.deepEqual(await f.run('actualClientWorkflowApi()'),valid);
  for(const mutate of [data=>delete data.items,data=>data.projectGroups=null,data=>data.projectGroups=[],data=>data.projectGroups[0].counts.total=2,data=>data.projectGroups[0].primary=null,data=>data.projectGroups[0].items[0].projectId='wrong',data=>data.projectGroups.push(data.projectGroups[0])]){const value=structuredClone(valid);mutate(value);f.context.fetch=async()=>({ok:true,json:async()=>value});await assert.rejects(f.run('actualClientWorkflowApi()'),/목록/);}
  let resolve;f.context.fetch=()=>new Promise(done=>resolve=done);const pending=f.run('actualClientWorkflowApi()');f.run('resetWorkNotificationState()');resolve({ok:true,json:async()=>valid});await assert.rejects(pending,/로그인/);
});

test('refresh retains project expansion and stable item focus even when indexes change, then clears expansion on session change',()=>{
  const f=fixture(),body=f.nodes.get('#personal-body'),oldDetails={dataset:{clientGroup:uid},open:true},newDetails={dataset:{clientGroup:uid},open:false};f.state.customerGroupIdentity='u1:0';let rendered=false,focusCount=0;body.querySelectorAll=()=>rendered?[newDetails]:[oldDetails];let html='';Object.defineProperty(body,'innerHTML',{set:value=>{html=value;rendered=true;},get:()=>html});body.scrollTop=280;
  const focused={inside:body,hasAttribute:key=>key==='data-client-focus',getAttribute:()=> 'first:open',getBoundingClientRect:()=>({top:180})},replacement={focus:options=>{assert.equal(options.preventScroll,true);focusCount++;},getBoundingClientRect:()=>({top:180})};f.document.activeElement=focused;f.nodes.set('[data-client-focus="first:open"]',replacement);f.run('renderWorkdayBody($("#personal-body"),"changed")');assert.equal(newDetails.open,true);assert.equal(body.scrollTop,280);assert.equal(focusCount,1);
  f.run('resetWorkNotificationState()');rendered=false;newDetails.open=false;f.run('renderWorkdayBody($("#personal-body"),"next session")');assert.equal(newDetails.open,false);assert.equal(f.state.customerWork.length,0);
});
