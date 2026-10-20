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

const fingerprint='a'.repeat(64);
function recheckData(items,deferred=[],today='2026-10-12'){
  const selected=new Set(deferred),todayItems=items.filter(item=>!selected.has(item.id)),deferredItems=items.filter(item=>selected.has(item.id));
  return {items,projectGroups:items.length?[group(items)]:[],todayItems,todayProjectGroups:todayItems.length?[group(todayItems)]:[],deferredItems,recheckToday:today,rechecks:Object.fromEntries(items.map(item=>[item.id,{fingerprint,state:selected.has(item.id)?'deferred':'active',date:selected.has(item.id)?'2026-10-19':null}]))};
}
test('personal dates move only selected tasks to an inspectable section and keep canonical indices and original deadlines',async()=>{
  const f=fixture(),items=[clientItem('later',{dueDate:'2026-10-15'}),clientItem('now')],html=await load(f,recheckData(items,['later']));
  assert.match(html,/오늘 할 일 1개/);assert.match(html,/미뤄 둔 일 1개/);assert.match(html,/프로젝트 1개 · 할 일 1개/);assert.match(html,/2026-10-19 다시 보기/);assert.match(html,/2026-10-15/);assert.match(html,/data-client-restore="0"/);assert.match(html,/data-client-recheck="1"/);
  for(const item of items)assert.equal((html.match(new RegExp('data-client-item="'+item.id+'"','g'))||[]).length,1);
  assert.deepEqual([...f.state.customerWork.map(item=>item.id)],['later','now']);assert.match(html,/원래 기한은 그대로/);
});
test('an entirely deferred day explicitly retains unfinished work rather than claiming everything is complete',async()=>{
  const f=fixture(),html=await load(f,recheckData([clientItem('later')],['later']));
  assert.match(html,/미뤄 둔 일이 있어요/);assert.doesNotMatch(html,/맡은 일도, 고객·게시 일도 없어요/);assert.doesNotMatch(html,/data-client-project=/);assert.match(html,/data-client-restore="0"/);
});
test('due dates and significant changes reappear with a reason while preserving exact source actions',async()=>{
  for(const [state,label]of [['due','다시 볼 날짜가 됐어요'],['changed','새 요청이나 바뀐 게 있어'],['overdue','기한이 지나 다시 꺼냈']]){
    const f=fixture(),item=clientItem('returned',{actions:[{action:'start',label:'처리 시작'}]}),data=recheckData([item]);data.rechecks.returned={fingerprint,state,date:'2026-10-11'};const html=await load(f,data);
    assert.match(html,new RegExp(label));assert.match(html,/data-client-work="0" data-client-action="start"/);assert.match(html,/data-client-recheck="0"/);assert.doesNotMatch(html,/data-client-restore=/);
  }
});
test('real API validates the full visible and deferred partition without silently losing or duplicating work',async()=>{
  const f=fixture(),valid=recheckData([clientItem('later'),clientItem('now')],['later']);f.context.fetch=async()=>({ok:true,json:async()=>valid});assert.deepEqual(await f.run('actualClientWorkflowApi()'),valid);
  for(const mutate of [d=>delete d.rechecks,d=>delete d.recheckToday,d=>d.todayItems=[],d=>d.deferredItems.push(d.todayItems[0]),d=>d.deferredItems=[],d=>d.rechecks.later.state='active',d=>d.rechecks.later.date='2026-10-11',d=>d.rechecks.now.fingerprint='broken',d=>d.todayProjectGroups=[]]){const data=structuredClone(valid);mutate(data);f.context.fetch=async()=>({ok:true,json:async()=>data});await assert.rejects(f.run('actualClientWorkflowApi()'),/목록/);}
});
test('restore uses the original stable item and fingerprint with the authenticated recheck endpoint',async()=>{
  const f=fixture(),item=clientItem('later');await load(f,recheckData([item],['later']));let call;
  f.state.integrated.csrfToken='fixture-csrf';f.context.fetch=async(path,options)=>{call={path,options};return {ok:true,json:async()=>({})};};f.run('clientWorkflowApi=actualClientWorkflowApi;loadPersonalPanel=async()=>{};toast=()=>{}');
  const button={dataset:{clientRestore:'0'},disabled:false,isConnected:true};await f.nodes.get('#personal-body').onclick({target:{closest:key=>key==='[data-client-restore]'?button:null}});
  assert.equal(call.path,'/api/client-workflow/recheck');assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.headers['X-CSRF-Token'],'fixture-csrf');assert.deepEqual(JSON.parse(call.options.body),{action:'restore',itemId:'later',fingerprint});
});
function dialogFixture(){
  const f=fixture(),item=clientItem('one');f.state.clientRechecks={one:{fingerprint,state:'active',date:null}};f.state.clientRecheckToday='2026-10-12';f.context.item=item;f.context.modalMarkup='';f.context.values={choice:'tomorrow',date:'2026-10-13'};f.context.FormData=class{get(key){return f.context.values[key];}};
  for(const key of ['#client-recheck-form','input[name="date"]','input[value="custom"]','button[type="submit"]','fieldset'])f.nodes.set(key,f.node());
  f.run('openModal=(title,html)=>{modalMarkup=html;modal.open=true;modalVersion++};formError=message=>{modalError=message};toast=()=>{};loadPersonalPanel=async()=>{};clientWorkflowApi=options=>request("recheck-action",options);openClientRecheck(item)');
  return {...f,item,form:f.nodes.get('#client-recheck-form')};
}
test('tomorrow, next week, and custom dates use the server Korean day with no PC clock dependency',async()=>{
  for(const [choice,date,expected]of [['tomorrow','2026-12-01','2026-10-13'],['week','2026-12-01','2026-10-19'],['custom','2026-11-03','2026-11-03']]){
    const f=dialogFixture();f.context.values={choice,date};const pending=f.form.onsubmit({preventDefault(){}}),request=f.requests.at(-1);assert.equal(request.path,'recheck-action');assert.equal(request.options.recheck,true);assert.deepEqual({...request.options.body},{action:'defer',date:expected,itemId:'one',fingerprint});request.resolve({});await pending;assert.equal(f.nodes.get('#modal').open,false);
  }
  const f=dialogFixture();f.nodes.get('input[name="date"]').listeners.input();assert.equal(f.nodes.get('input[value="custom"]').checked,true);assert.match(f.context.modalMarkup,/날짜 고르기 \(한국 시간\)/);
});
test('invalid/past custom date stays editable and stale work refreshes instead of persisting an obsolete selection',async()=>{
  const f=dialogFixture();f.context.values={choice:'custom',date:'2026-10-11'};await f.form.onsubmit({preventDefault(){}});assert.equal(f.requests.length,0);assert.match(f.context.modalError,/내일부터/);
  f.context.values={choice:'custom',date:'2026-10-20'};const pending=f.form.onsubmit({preventDefault(){}});f.requests.at(-1).reject(Object.assign(Error('changed'),{status:409}));await pending;assert.equal(f.nodes.get('#modal').open,false);
});
test('a late save cannot close another account dialog and reset discards personal metadata',async()=>{
  const f=dialogFixture(),pending=f.form.onsubmit({preventDefault(){}});f.run('resetWorkNotificationState();state.user={id:"other"};modalVersion++;modal.open=true;');f.requests.at(-1).resolve({});await pending;
  assert.equal(f.nodes.get('#modal').open,true);assert.equal(Object.keys(f.state.clientRechecks).length,0);assert.equal(f.state.clientRecheckToday,null);
});
test('the date dialog submits the fingerprint of the work the user actually saw, even after a newer list arrives',async()=>{
  const f=dialogFixture();f.state.clientRechecks.one={fingerprint:'b'.repeat(64),state:'changed',date:null};
  const pending=f.form.onsubmit({preventDefault(){}});assert.equal(f.requests.at(-1).options.body.fingerprint,fingerprint);f.requests.at(-1).reject(Object.assign(Error('changed'),{status:409}));await pending;assert.equal(f.nodes.get('#modal').open,false);
});
