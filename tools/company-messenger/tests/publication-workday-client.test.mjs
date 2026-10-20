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
  const context=vm.createContext({document,window,location:{pathname:embedded?'/messenger/':'/',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{id,callback,delay});return id;},clearTimeout:id=>timers.delete(id),URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=>uid}});
  const run=code=>vm.runInContext(code,context);run(source);
  run(`Object.assign(state,{user:{id:'u1',name:'담당',role:'member'},channels:[],members:[],drawer:'personal',personalTab:'workday',integrated:${integrated?"{companyUserId:'owner',canWrite:true}":'null'}});moduleVisible=true;`);
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));
  run('api=request;clientWorkflowApi=()=>request("/api/client-workflow");publicationWorkflowApi=()=>request("/api/publication-workflow");attachDeadlineSettings=async()=>{};refreshChannels=async()=>{};refreshMessages=async()=>{};');
  return{context,run,nodes,requests,timers,messages,document,window,windowEvents,documentEvents,state:run('state'),node,fire(timer){timers.delete(timer.id);timer.callback();}};
}
const flush=async()=>{for(let index=0;index<12;index++)await Promise.resolve();};
function task(id='task'){return{id,title:'오늘 마감 영상',stage:'doing',dueDate:'2026-10-11',assignee:{id:'u1'},message:{id:'1',channelId:'c1',body:'영상 편집'}};}
function workday({today=[],remaining=[],delay=60000,date='2026-10-11',serverNow='2026-10-11T00:00:00Z'}={}){return{date,serverNow,nextDayRefreshAfterMs:delay,today:{groups:{reply:[],due:today,review:[],recovery:[]}},remaining:{groups:{upcoming:remaining,undated:[],waiting:[]},counts:{upcoming:remaining.length,undated:0,waiting:0}}};}
function item(overrides={}){return{id:'publication:prepare:'+uid,kind:'publication_prepare',group:'next',title:'LAB 완성본 확인',text:'영상과 자막을 확인하고 게시 묶음을 만드세요.',statusLabel:'완성본 도착',actionLabel:'완성본 확인',href:publicationHref(),...overrides};}
async function load(f,{items=[],customers=[],work=workday(),background=false}={}){
  const offset=f.requests.length,promise=f.run(`loadPersonalPanel({background:${background}})`);
  const pending=f.requests.slice(offset);for(const request of pending){if(request.path==='/api/workday')request.resolve(work);else if(request.path==='/api/client-workflow')request.resolve({items:customers});else if(request.path==='/api/publication-workflow')request.resolve({items});else assert.fail(request.path);}
  await promise;return f.nodes.get('#personal-body').innerHTML;
}

test('company today combines unique publication actions with tasks and customer work without creating records',async()=>{
  const f=fixture(),prepare=item(),publish=item({id:'publish',kind:'publication_publish',title:'게시 주소 기록',href:publicationHref('publish','packageId='+uid)}),html=await load(f,{items:[prepare,prepare,publish],customers:[{id:'client',group:'reply',title:'고객 답변'}],work:workday({today:[task()],remaining:[task('later')]})});
  assert.match(html,/오늘 할 일 4개/);assert.match(html,/게시할 일/);assert.match(html,/완성본 확인/);assert.match(html,/이후 마감 1개/);assert.equal(f.state.publicationWork.length,2);assert.equal(f.state.personalItems.length,2);
  assert.deepEqual(f.requests.map(request=>request.path),['/api/workday','/api/client-workflow','/api/publication-workflow']);assert.ok(f.requests.every(request=>!request.options.method||request.options.method==='GET'));
});

test('publication source errors keep the count incomplete and cannot claim zero work',async()=>{
  const f=fixture(),loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday());f.requests[1].resolve({items:[]});f.requests[2].reject(new Error('<img src=x> 게시 조회 실패'));await loading;const html=f.nodes.get('#personal-body').innerHTML;
  assert.match(html,/오늘 할 일을 다 불러오지 못했어요/);assert.match(html,/게시 업무를 불러오지 못했어요/);assert.match(html,/못 불러옴/);assert.match(html,/data-productivity-refresh/);assert.ok(!html.includes('오늘 할 일은 없어요'));assert.ok(!html.includes('<img src=x>'));assert.ok(html.includes('&lt;img'));
});

test('known tasks remain visible when publication loading fails',async()=>{
  const f=fixture(),loading=f.run('loadPersonalPanel()');f.requests[0].resolve(workday({today:[task()]}));f.requests[1].resolve({items:[]});f.requests[2].reject(new Error('게시 연결 실패'));await loading;
  assert.match(f.nodes.get('#personal-body').innerHTML,/불러온 할 일 1개/);assert.match(f.nodes.get('#personal-body').innerHTML,/오늘 마감 영상/);
});

test('standalone and an unauthenticated company module do not request the company publication API',async()=>{
  for(const options of [{embedded:false,integrated:false},{embedded:false,integrated:true},{embedded:true,integrated:false}]){const f=fixture(options);await load(f);assert.ok(!f.requests.some(request=>request.path==='/api/publication-workflow'));assert.equal([...f.timers.values()][0].delay,60000);}
});

test('only exact same-origin publication targets are allowed',()=>{
  const f=fixture();for(const href of [publicationHref(),publicationHref('prepare',`productionId=${uid}&versionId=${uid}`),publicationHref('publish','packageId='+uid),publicationHref('performance',`entryId=${entryId}&checkpoint=24h`),publicationHref('performance',`entryId=${entryId}&checkpoint=72h`)]){f.context.href=href;assert.equal(f.run('safePublicationWorkflowHref(href)'),'http://localhost'+href);}
  const valid=publicationHref();for(const href of [null,'',valid+'#x',valid+'&tab=workroom',valid+'&packageId='+uid,valid+'&next=/admin','https://evil.test'+valid,'http://user:pass@localhost'+valid,publicationHref('publish','packageId=invalid'),publicationHref('prepare',`productionId=${uid}`),publicationHref('performance',`entryId=${entryId}&checkpoint=48h`),publicationHref('performance',`entryId=${uid}&checkpoint=24h`),valid.replace('section=tools','section=clients'),valid.replace('tab=workroom','tab=home'),valid.replace(uid,uid+'x'),valid.replace('/?','/messenger/?')]){f.context.href=href;assert.equal(f.run('safePublicationWorkflowHref(href)'),null,String(href));}
});

test('a publication click looks up its stable current ID and sends only the validated company target',async()=>{
  const f=fixture(),first=item(),second=item({id:'publication:publish',kind:'publication_publish',href:publicationHref('publish','packageId='+uid)});await load(f,{items:[first,second]});f.state.publicationWork.reverse();let prevented=false;
  await f.nodes.get('#personal-body').onclick({preventDefault(){prevented=true;},target:{closest:selector=>selector==='[data-publication-open]'?{dataset:{publicationOpen:first.id}}:null}});
  assert.equal(prevented,true);assert.equal(f.messages.length,1);assert.equal(f.messages[0].value.type,'messenger:publication-open');assert.equal(f.messages[0].value.url,'http://localhost'+first.href);assert.equal(f.messages[0].origin,'http://localhost');assert.equal(f.requests.length,3);
  f.state.publicationWork[1].href='https://evil.test/';await f.nodes.get('#personal-body').onclick({preventDefault(){},target:{closest:selector=>selector==='[data-publication-open]'?{dataset:{publicationOpen:first.id}}:null}});assert.equal(f.messages.length,1);
});

test('publication formats belong only to an exact publish target and stay in the known format set',()=>{
  const f=fixture();for(const format of ['youtube-shorts','youtube-video','instagram-reels']){f.context.href=publicationHref('publish',`packageId=${uid}&publicationFormat=${format}`);assert.equal(f.run('safePublicationWorkflowHref(href)'),'http://localhost'+f.context.href);}
  for(const href of [publicationHref('publish',`packageId=${uid}&publicationFormat=unknown`),publicationHref()+'&publicationFormat=youtube-shorts',publicationHref('publish',`packageId=${uid}&publicationFormat=youtube-shorts&publicationFormat=youtube-video`)]){f.context.href=href;assert.equal(f.run('safePublicationWorkflowHref(href)'),null);}
});

test('server-sourced action labels and titles are escaped in the summary and detail cards',async()=>{
  const f=fixture(),html=await load(f,{items:[item({title:'<script>제목</script>',text:'<img src=x>',actionLabel:'<b>확인</b>',statusLabel:'<svg>'})]});for(const fragment of ['&lt;script&gt;','&lt;img','&lt;b&gt;','&lt;svg&gt;'])assert.ok(html.includes(fragment));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x>'));
});

test('one company refresh timer is capped at ten seconds and keeps the earlier server midnight boundary',async()=>{
  const f=fixture();await load(f);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,10000);await load(f,{work:workday({delay:1500})});assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,1500);
});

test('unchanged work skips DOM replacement even while server clock metadata advances',async()=>{
  const f=fixture();await load(f,{items:[item()]});const body=f.nodes.get('#personal-body'),writes=body.writes,handler=body.onclick;body.scrollTop=410;f.nodes.get('#composer-input').value='채팅 작성 중';
  await load(f,{items:[item()],background:true,work:workday({delay:57000,serverNow:'2026-10-11T00:00:03Z'})});assert.equal(body.writes,writes);assert.equal(body.onclick,handler);assert.equal(body.scrollTop,410);assert.equal(f.nodes.get('#composer-input').value,'채팅 작성 중');assert.equal(f.timers.size,1);
});

test('changed original status removes a completed action and preserves the drawer scroll',async()=>{
  const f=fixture();await load(f,{items:[item()]});const body=f.nodes.get('#personal-body'),writes=body.writes;body.scrollTop=230;const html=await load(f,{background:true});assert.match(html,/오늘 할 일은 없어요/);assert.ok(!html.includes('LAB 완성본 확인'));assert.equal(body.writes,writes+1);assert.equal(body.scrollTop,230);assert.equal(f.state.publicationWork.length,0);
});

test('a retained focused action uses its ID and corrects its position in the actual scrolling body',()=>{
  const f=fixture(),body=f.nodes.get('#personal-body'),attrs={'data-publication-open':'kept'},focused={inside:body,hasAttribute:name=>name in attrs,getAttribute:name=>attrs[name],getBoundingClientRect:()=>({top:120})},replacement={focus(options){this.options=options;},getBoundingClientRect:()=>({top:170})};
  f.document.activeElement=focused;body.scrollTop=200;f.nodes.set('[data-publication-open="kept"]',replacement);f.context.body=body;f.run('renderWorkdayBody(body,"새 항목")');assert.equal(body.scrollTop,250);assert.equal(replacement.options.preventScroll,true);
});

for(const [name,interact] of [['modal',f=>{f.nodes.get('#modal').open=true;}],['input',f=>{f.document.activeElement={inside:f.nodes.get('#personal-body'),matches:()=>true,value:'입력 중'};}],['selection',f=>{f.window.getSelection=()=>({isCollapsed:false,anchorNode:{inside:f.nodes.get('#personal-body')}});}]]){
  test(`background refresh preserves an active ${name} and waits until the next check`,async()=>{
    const f=fixture();await load(f,{items:[item()]});const body=f.nodes.get('#personal-body'),writes=body.writes,count=f.requests.length;interact(f);await f.run('loadPersonalPanel({background:true})');assert.equal(f.requests.length,count);assert.equal(body.writes,writes);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,10000);
  });
}

test('starting an interaction while a refresh is in flight does not replace the current list',async()=>{
  const f=fixture();await load(f,{items:[item()]});const body=f.nodes.get('#personal-body'),writes=body.writes,offset=f.requests.length,pending=f.run('loadPersonalPanel({background:true})');f.nodes.get('#modal').open=true;f.requests[offset].resolve(workday());f.requests[offset+1].resolve({items:[]});f.requests[offset+2].resolve({items:[]});await pending;assert.equal(body.writes,writes);assert.equal(f.state.publicationWork.length,1);assert.equal(f.timers.size,1);
  f.nodes.get('#modal').open=false;await load(f,{background:true});assert.equal(f.state.publicationWork.length,0);
});

for(const [name,change] of [['different account',"state.user={id:'u2'}"],['new session','resetWorkNotificationState()'],['different panel',"state.personalTab='tasks'"],['hidden module','moduleVisible=false;cancelWorkdayRefresh()'],['hidden document','document.hidden=true;cancelWorkdayRefresh()']]){
  test(`a late publication read cannot paint or restart polling after a ${name}`,async()=>{
    const f=fixture(),pending=f.run('loadPersonalPanel({background:true})');f.run(change);f.nodes.get('#personal-body').innerHTML='현재 화면';f.requests[0].resolve(workday());f.requests[1].resolve({items:[]});f.requests[2].resolve({items:[item()]});await pending;assert.equal(f.nodes.get('#personal-body').innerHTML,'현재 화면');assert.equal(f.timers.size,0);assert.equal(f.state.publicationWork.length,0);
  });
}

test('hiding the module invalidates the ten-second callback',async()=>{
  const f=fixture();await load(f,{items:[item()]});const timer=[...f.timers.values()][0],count=f.requests.length;await f.windowEvents.get('message')({origin:'http://localhost',source:f.window.parent,data:{type:'workspace:visible',visible:false}});assert.equal(f.timers.size,0);f.fire(timer);assert.equal(f.requests.length,count);
});

test('an initial company workday read also discards its response after leaving the module',async()=>{
  const f=fixture(),pending=f.run('loadPersonalPanel()');f.run('moduleVisible=false');f.nodes.get('#personal-body').innerHTML='이동한 화면';f.requests[0].resolve(workday());f.requests[1].resolve({items:[]});f.requests[2].resolve({items:[item()]});await pending;assert.equal(f.nodes.get('#personal-body').innerHTML,'이동한 화면');assert.equal(f.timers.size,0);
});

test('a failed workday poll reports unknown work and schedules recovery without a false zero',async()=>{
  const f=fixture();await load(f,{items:[item()]});const offset=f.requests.length,pending=f.run('loadPersonalPanel({background:true})');f.requests[offset].reject(new Error('업무 읽기 실패'));f.requests[offset+1].resolve({items:[]});f.requests[offset+2].resolve({items:[]});await pending;assert.match(f.nodes.get('#personal-body').innerHTML,/할 일을 불러오지 못했어요/);assert.ok(!f.nodes.get('#personal-body').innerHTML.includes('오늘 할 일은 없어요'));assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,10000);
});

test('returning from another personal tab renders today even with an unchanged source snapshot',async()=>{
  const f=fixture();await load(f,{items:[item()]});f.run("state.personalTab='catchup'");const pending=f.run('loadPersonalPanel()');f.requests.at(-1).resolve({events:[]});await pending;assert.equal(f.state.workdaySnapshot,null);f.run("state.personalTab='workday'");const html=await load(f,{items:[item()]});assert.match(html,/LAB 완성본 확인/);
});

test('publication API rejects malformed responses and responses from a previous login',async()=>{
  const f=fixture();f.run(source.slice(source.indexOf('async function publicationWorkflowApi(){'),source.indexOf('function publicationWorkflowItems(')));const fetches=[];f.context.fetch=(path,options)=>new Promise(resolve=>fetches.push({path,options,resolve}));
  let pending=f.run('publicationWorkflowApi()');fetches[0].resolve({ok:true,json:async()=>({})});await assert.rejects(pending,/게시 업무 목록/);assert.equal(fetches[0].path,'/api/publication-workflow');assert.equal(fetches[0].options.credentials,'same-origin');
  pending=f.run('publicationWorkflowApi()');fetches[1].resolve({ok:true,json:async()=>({items:[{id:'broken'}]})});await assert.rejects(pending,/게시 업무 목록/);
  pending=f.run('publicationWorkflowApi()');f.run('resetWorkNotificationState()');fetches[2].resolve({ok:true,json:async()=>({items:[item()]})});await assert.rejects(pending,/로그인이 바뀌어/);
});

test('package review is accepted by the real API validator and opens its exact package from today',async()=>{
  const f=fixture(),review=item({id:'publication:review:'+uid,kind:'publication_review',title:'합성 게시 전 점검',actionLabel:'남은 점검 확인',href:publicationHref('review','packageId='+uid)});
  f.run(source.slice(source.indexOf('async function publicationWorkflowApi(){'),source.indexOf('function publicationWorkflowItems(')));
  f.context.fetch=async()=>({ok:true,json:async()=>({items:[review]})});const response=await f.run('publicationWorkflowApi()');assert.equal(response.items[0].kind,'publication_review');
  f.context.href=review.href;assert.equal(f.run('safePublicationWorkflowHref(href)'),'http://localhost'+review.href);
  f.context.href=review.href+'&publicationFormat=youtube-shorts';assert.equal(f.run('safePublicationWorkflowHref(href)'),null);
  f.run('publicationWorkflowApi=()=>request("/api/publication-workflow")');const html=await load(f,{items:[review]});assert.match(html,/오늘 할 일 1개/);assert.match(html,/남은 점검 확인/);
  await f.nodes.get('#personal-body').onclick({preventDefault(){},target:{closest:selector=>selector==='[data-publication-open]'?{dataset:{publicationOpen:review.id}}:null}});
  assert.equal(f.messages[0].value.url,'http://localhost'+review.href);assert.equal(f.messages[0].value.type,'messenger:publication-open');
});

test('link errors open exactly one stored package or post and reject mixed targets',async()=>{
  const f=fixture();
  for(const field of ['packageId='+uid,'entryId='+entryId]){
    const entry=item({id:'publication:link:'+field,kind:'publication_link',title:'합성 링크 접속 오류',actionLabel:'링크 오류 확인',href:publicationHref('link',field)});
    f.run(source.slice(source.indexOf('async function publicationWorkflowApi(){'),source.indexOf('function publicationWorkflowItems(')));f.context.fetch=async()=>({ok:true,json:async()=>({items:[entry]})});assert.equal((await f.run('publicationWorkflowApi()')).items[0].kind,'publication_link');
    f.run('publicationWorkflowApi=()=>request("/api/publication-workflow")');const html=await load(f,{items:[entry]});assert.match(html,/링크 오류 확인/);
    await f.nodes.get('#personal-body').onclick({preventDefault(){},target:{closest:selector=>selector==='[data-publication-open]'?{dataset:{publicationOpen:entry.id}}:null}});assert.equal(f.messages.at(-1).value.url,'http://localhost'+entry.href);
  }
  for(const fields of [`packageId=${uid}&entryId=${entryId}`,`packageId=${uid}&checkpoint=24h`,`entryId=${entryId}&publicationFormat=youtube-shorts`,'packageId='+entryId,'entryId='+uid,'url=https://example.test']){f.context.href=publicationHref('link',fields);assert.equal(f.run('safePublicationWorkflowHref(href)'),null);}
});
