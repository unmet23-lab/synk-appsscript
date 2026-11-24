import {workspaceClientContext} from './workspace-access-test-context.mjs';
import {workspaceAccess,WORKSPACE_COMPANIES,WORKSPACE_DUTIES} from './workspace-access.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const workspaceSource=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const homeSource=readFileSync(new URL('./public/marin-home.js',import.meta.url),'utf8');
const demoSource=readFileSync(new URL('./public/demo-ui.js',import.meta.url),'utf8');
const helpers=['const escape =','const number =','const validNumber ='].map(prefix=>appSource.split('\n').find(line=>line.startsWith(prefix))).join('\n');
const tick=()=>new Promise(setImmediate);

function fixture({url='http://localhost:4191/',storage=new Map(),withAccessEvents=false}={}){
  const location=new URL(url),nodes=new Map(),handlers=[],windowHandlers=[],requests=[],renders=[],notifications=[],posted=[],created=[];
  const timers=new Map();let nextTimer=1;
  const state={user:{id:'crew-a',name:'크루 가',role:'member',teamId:'team-a'},data:{channels:[],teams:[{id:'team-a',active:true}]},tab:'home',marketingView:'summary',scope:'mine',teamId:'',report:null,reportRequest:0,modalRequest:0,authMode:'login',csrf:'test-csrf',error:''};
  const lookup=id=>id==='messenger-module-slot'&&state.tab!=='messenger'?null:nodes.get(id)||null;
  const document={activeElement:null,hidden:false,addEventListener:(type,handler)=>handlers.push({type,handler}),getElementById:lookup,querySelector:selector=>selector.startsWith('#')?lookup(selector.slice(1)):null,querySelectorAll:()=>[]};
  function element(tag='div'){
    const attributes={},classes=new Set(),row={tagName:tag.toUpperCase(),attributes,style:{},dataset:{},children:[],value:'',innerHTML:'',textContent:'',hidden:false,inert:false,disabled:false,isConnected:true,selectionStart:0,selectionEnd:0,scrollTop:0,scrollHeight:100,clientHeight:100,
      setAttribute(name,value){attributes[name]=String(value);},getAttribute:name=>attributes[name]??null,removeAttribute:name=>delete attributes[name],append(...children){row.children.push(...children);for(const child of children){child.parentElement=row;if(child.id)nodes.set(child.id,child);}},remove(){row.isConnected=false;if(row.id)nodes.delete(row.id);},addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],contains:target=>row===target||row.children.includes(target),closest:()=>null,focus(){document.activeElement=row;},setSelectionRange(start,end){row.selectionStart=start;row.selectionEnd=end;},getBoundingClientRect:()=>({left:20,top:50,width:900,height:700}),classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),toggle(name,value){if(value??!classes.has(name))classes.add(name);else classes.delete(name);}},contentWindow:tag==='iframe'?{postMessage:(message,origin)=>posted.push({message,origin}),draft:'unfinished messenger draft'}:undefined};return row;
  }
  document.createElement=tag=>{const row=element(tag);created.push(row);return row;};document.body=element('body');
  for(const id of ['marin-input','marin-form','marin-conversation','messenger-module-slot']){const row=element(id==='marin-input'?'textarea':'section');row.id=id;nodes.set(id,row);}
  const sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
  let historyIndex=0;
  const entries=[location.href];
  function traverseHistory(offset){
    const index=historyIndex+offset;
    if(index<0||index>=entries.length)return;
    historyIndex=index;
    location.href=entries[index];
    for(const {handler} of windowHandlers.filter(row=>row.type==='popstate'))handler({type:'popstate'});
  }
  const history={
    replaceState(_data,_title,url){location.href=new URL(url,location).href;entries[historyIndex]=location.href;},
    pushState(_data,_title,url){location.href=new URL(url,location).href;entries.splice(++historyIndex,entries.length,location.href);},
    back:()=>traverseHistory(-1),
    forward:()=>traverseHistory(1),
  };
  const context=workspaceClientContext({state,document,location,URL,URLSearchParams,Intl,Date,queueMicrotask,sessionStorage,localStorage:sessionStorage,cp:{view:'library'},
    window:{addEventListener:(type,handler)=>windowHandlers.push({type,handler}),scrollTo(){},matchMedia:()=>({matches:false})},history,MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:callback=>callback(),clearInterval(){},clearTimeout:id=>timers.delete(id),setTimeout:(callback,delay=0)=>{const id=nextTimer++;timers.set(id,{callback,delay});return id;},crypto:{randomUUID:()=> 'test-id'},
    isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',canManageTeam:()=>['admin','manager'].includes(state.user?.role),icon:()=>'',button:()=>'',dateToday:()=> '2026-09-30',shiftDate:(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10),
    render:()=>renders.push({tab:state.tab,userId:state.user?.id}),notify:message=>notifications.push(message),api(path,body,method){return new Promise((resolve,reject)=>requests.push({path,body,method,resolve,reject}));},
  },{withEvents:withAccessEvents});
  const run=source=>vm.runInContext(source,context);run(helpers+'\n'+workspaceSource+'\n'+demoSource+'\n'+homeSource);
  run(appSource.slice(appSource.indexOf('let companyAuthGeneration='),appSource.indexOf('function inviteResultMarkup(')));
  const dispatch=(type,target,props={})=>{
    const event={target,prevented:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...props};
    for(const row of handlers.filter(row=>row.type===type)){row.handler(event);if(event.stopped)break;}
    return event;
  };
  return{state,context,location,document,nodes,handlers,windowHandlers,requests,renders,notifications,posted,created,storage,timers,run,dispatch,element,home:run('marinHome')};
}

test('default entry is the Marine home; messenger and saved-plan routes keep their destinations and old marketing routes open the SNS screens',()=>{
  const f=fixture();
  for(const input of [undefined,'home']){f.context.destination=input;f.run('selectWorkspaceView(destination)');assert.equal(f.state.tab,'home');}
  for(const [view,section,expected] of [['handbook','','handbook'],['workroom','','workroom'],['overview','mine','social'],['analysis','team','social'],['history','all','social'],['messenger','','messenger'],['channels','','social'],['studio','','content']]){
    f.context.destination={view,section};f.run('selectWorkspaceView(destination.view,destination.section)');assert.equal(f.state.tab,expected);
  }
  f.run("selectWorkspaceView('content','plan',undefined,'saved-plan');syncWorkspaceLocation()");assert.equal(f.location.searchParams.get('draftId'),'saved-plan');
  f.run("selectWorkspaceView('home');syncWorkspaceLocation()");assert.equal(f.state.tab,'home');assert.equal(f.location.searchParams.get('tab'),'home');assert.equal(f.location.searchParams.has('draftId'),false);
});

test('initial bare, query and hash routes load only the selected workspace after authentication',async()=>{
  const initialize=appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()'));
  for(const [suffix,tab,reports,content] of [['','home',0,0],['?tab=home','home',0,0],['?tab=workroom','workroom',0,0],['?tab=handbook','handbook',0,0],['?tab=messenger','messenger',0,0],['#view=messenger','messenger',0,0],['?tab=history&section=team&teamId=team-a','social',0,0],['#view=content&section=plan&draftId=saved-plan','content',0,1]]){
    const f=fixture({url:'http://localhost:4191/'+suffix});let reportCount=0,contentCount=0;
    Object.assign(f.context,{loadState:async()=>{},loadReport:async()=>reportCount++,loadContentWorkspace:async()=>contentCount++,startPolling(){},app:{innerHTML:''}});
    f.run(appSource.split('\n').find(line=>line.startsWith('function reportTabs('))+'\n'+initialize);
    const opening=f.run('initialize()');assert.equal(f.requests[0].path,'/api/me');f.requests[0].resolve({user:f.state.user,csrfToken:'test-csrf'});await opening;
    assert.equal(f.state.initialized,true,suffix);assert.equal(f.state.tab,tab,suffix);assert.equal(reportCount,reports,suffix);assert.equal(contentCount,content,suffix);assert.equal(f.requests.length,1,'opening home must not send an assistant prompt');
  }
});

test('home navigation hides the persistent messenger frame and restores the same frame and draft when returning',()=>{
  const f=fixture();f.run("selectWorkspaceView('messenger');mountWorkspaceModule()");
  const frame=f.run('workspaceModule.frame'),host=f.run('workspaceModule.host');assert.equal(frame.src,'/messenger/');
  assert.equal(f.run('workspaceModule.loadRetries'),0,'a scheduled recovery does not run synchronously');assert.deepEqual([...f.timers.values()].map(timer=>timer.delay),[12000],'the real recovery delay remains scheduled');
  f.run("selectWorkspaceView('home');mountWorkspaceModule()");assert.equal(f.run('workspaceModule.frame'),frame);assert.equal(host.hidden,true);assert.equal(host.inert,true);assert.equal(frame.contentWindow.draft,'unfinished messenger draft');
  f.run("selectWorkspaceView('marketing');mountWorkspaceModule();selectWorkspaceView('home');mountWorkspaceModule();selectWorkspaceView('messenger');mountWorkspaceModule()");
  assert.equal(f.run('workspaceModule.frame'),frame);assert.equal(host.hidden,false);assert.equal(host.inert,false);assert.equal(frame.contentWindow.draft,'unfinished messenger draft');assert.equal(f.created.filter(row=>row.tagName==='IFRAME').length,1);
});

test('submitting a prompt sends only the assistant request, prevents duplicate/IME sends, and renders response text safely',async()=>{
  const f=fixture();f.run('ensureMarinSession()');const input=f.nodes.get('marin-input');input.value='  이번 주 내 성과  ';f.dispatch('input',input);
  f.dispatch('compositionstart',input);assert.equal(f.dispatch('keydown',input,{key:'Enter'}).prevented,false);assert.equal(f.requests.length,0);
  f.dispatch('compositionend',input);assert.equal(f.dispatch('keydown',input,{key:'Enter',isComposing:true}).prevented,false);assert.equal(f.requests.length,0);
  assert.equal(f.dispatch('keydown',input,{key:'Enter',shiftKey:true}).prevented,false);assert.equal(f.requests.length,0);
  assert.equal(f.dispatch('keydown',input,{key:'Enter'}).prevented,true);f.dispatch('submit',f.nodes.get('marin-form'));
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/assistant');assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body)),{message:'이번 주 내 성과'});assert.equal(f.home.pending,true);assert.equal(f.home.entries.length,1);
  f.requests[0].resolve({text:'<img src=x onerror=alert(1)> 현재 조회수 0회, 비교 수치는 미확인입니다.',actions:[{type:'marketing',label:'<script>내 현황</script>',view:'overview',section:'mine'},{type:'external',url:'https://example.com',label:'외부 실행'}]});await tick();
  assert.equal(f.home.pending,false);assert.equal(f.home.entries.length,2);assert.equal(f.home.entries[1].actions.length,1);assert.equal(f.renders.length,0,'answers update the home without replacing the persistent workspace');assert.equal(f.state.tab,'home','a suggested action never runs itself');
  const html=f.run('marinConversationHtml()');assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<img|<script/);assert.equal(f.requests.length,1);
});

test('failed requests retain the original prompt and retry once without duplicating the conversation',async()=>{
  const f=fixture();f.run("ensureMarinSession();marinHome.draft='디자인팀 대화방 찾아줘'");const first=f.run('submitMarinMessage()');f.requests[0].reject(new Error('잠시 연결할 수 없어요'));await first;
  assert.equal(f.home.error,'잠시 연결할 수 없어요');assert.equal(f.home.pending,false);assert.equal(f.home.entries.length,1);
  const retry=f.run('submitMarinMessage(true)');assert.equal(f.home.entries.length,1);assert.equal(f.requests[1].body.message,'디자인팀 대화방 찾아줘');assert.equal(f.home.error,'');
  f.requests[1].resolve({text:'열람 가능한 대화방을 찾았어요.',actions:[]});await retry;assert.equal(f.home.entries.length,2);assert.equal(f.home.error,'');
  await f.run('submitMarinMessage(true)');assert.equal(f.requests.length,2,'retry cannot replay an already answered prompt');
});

test('session storage restores only the signed-in crew history and logout clears it while invalidating late answers',async()=>{
  const storage=new Map(),f=fixture({storage});f.run("ensureMarinSession();marinHome.draft='내 비공개 대화방 찾아줘'");const pending=f.run('submitMarinMessage()');
  assert.ok(storage.has('synk-marin:session:crew-a'));f.state.user={id:'crew-b',name:'크루 나',role:'viewer'};f.run('ensureMarinSession()');assert.equal(f.home.entries.length,0);assert.equal(f.home.draft,'');
  f.requests[0].resolve({text:'크루 가의 늦은 응답',actions:[]});await pending;assert.equal(f.home.userId,'crew-b');assert.equal(f.home.entries.length,0);assert.equal(f.home.pending,false);
  f.state.user={id:'crew-a',name:'크루 가',role:'member'};f.run('ensureMarinSession()');assert.equal(f.home.entries[0].text,'내 비공개 대화방 찾아줘');
  f.run("marinHome.draft='계속 입력하던 말';saveMarinSession()");const reloaded=fixture({storage});reloaded.run('ensureMarinSession()');assert.equal(reloaded.home.draft,'계속 입력하던 말');assert.equal(reloaded.home.entries.length,1);
  const oldRequest=f.run('submitMarinMessage()');f.state.user=null;f.context.app={innerHTML:''};f.run(appSource.slice(appSource.indexOf('function renderAuth()'),appSource.indexOf('function shell(')));f.run('renderAuth()');
  assert.equal(storage.has('synk-marin:session:crew-a'),false);assert.equal(f.home.userId,null);assert.equal(f.home.entries.length,0);
  f.state.user={id:'crew-a',name:'크루 가',role:'member'};f.run('ensureMarinSession()');f.requests[1].resolve({text:'로그아웃 전 응답',actions:[]});await oldRequest;assert.equal(f.home.entries.length,0,'even logging in as the same crew cannot revive an old request');
});

test('stored history is bounded and safely validates actions before display or explicit dispatch',async()=>{
  const storage=new Map([['synk-marin:session:crew-a',JSON.stringify({draft:'x'.repeat(1200),entries:Array.from({length:25},(_,i)=>({role:'assistant',text:'답변 '+i,actions:[{type:'marketing',view:'settings',label:'관리자'},{type:'messenger',channelId:'room-a',label:'대화방',url:'javascript:alert(1)'}]}))})]]),f=fixture({storage});f.run('ensureMarinSession()');
  assert.equal(f.home.entries.length,20);assert.equal(f.home.entries[0].text,'답변 5');assert.equal(f.home.draft.length,1000);assert.equal(f.home.entries[0].actions.length,1);assert.equal(f.home.entries[0].actions[0].url,undefined);
  for(const action of [null,{type:'external',label:'외부',url:'https://example.com'},{type:'marketing',view:'content',section:'settings',label:'기획'},{type:'marketing',view:'overview',section:'mine',teamId:'other',label:'권한우회'},{type:'messenger',channelId:'one',userId:'two',label:'둘 다'},{type:'messenger',panel:'admin',label:'관리'},{type:'messenger',channelId:'../../admin',label:'경로'}]){f.context.candidate=action;assert.equal(f.run('safeMarinAction(candidate)'),null);}
  const opened=[];f.context.openWorkspaceDestination=async action=>{opened.push(action);return true;};assert.equal(await f.run('dispatchMarinAction(0,0)'),true);assert.equal(opened[0].channelId,'room-a');assert.equal(opened[0].url,undefined);
  assert.equal(await f.run('dispatchMarinAction(100,0)'),false);f.state.user={id:'crew-b'};assert.equal(await f.run('dispatchMarinAction(0,0)'),false);assert.equal(opened.length,1);assert.equal(f.requests.length,0,'stored buttons must not post messages or silently open a DM');
});

test('old marketing actions from the assistant open SNS results without loading the old reports, while a plan action still opens the plan',async()=>{
  const f=fixture();let reports=0,plans=0;f.context.loadReport=async()=>reports++;f.context.loadContentWorkspace=async()=>plans++;f.run(appSource.split('\n').find(line=>line.startsWith('function reportTabs(')));f.run("ensureMarinSession();marinHome.entries=[{role:'assistant',text:'업무 찾기',actions:[{type:'marketing',label:'팀 현황',view:'history',section:'team',teamId:'team-a'},{type:'marketing',label:'새 기획',view:'content',section:'plan'}]}]");
  assert.equal(await f.run('dispatchMarinAction(0,0)'),true);assert.equal(f.state.tab,'social');assert.equal(reports,0);assert.equal(plans,0);
  assert.equal(await f.run('dispatchMarinAction(0,1)'),true);assert.equal(f.state.tab,'content');assert.equal(f.run('cp.view'),'plan');assert.equal(reports,0);assert.equal(plans,1);assert.equal(f.requests.length,0);
});

test('an explicit messenger suggestion queues until the current frame is ready and a later home visit cancels it',()=>{
  const f=fixture(),deliver=(data,source,origin=f.location.origin)=>{for(const listener of f.windowHandlers.filter(row=>row.type==='message'))listener.handler({data,source,origin});};
  assert.equal(f.run("openWorkspaceDestination({type:'messenger',label:'자료의 원문',channelId:'room-a',messageId:'27',fileId:'file-a',panel:'files'})"),true);assert.equal(f.state.tab,'messenger');assert.equal(f.requests.length,0);assert.equal(f.posted.length,0);
  f.run('mountWorkspaceModule()');const frame=f.run('workspaceModule.frame'),pending=f.run('workspaceModule.open');
  deliver({type:'messenger:ready'},{});deliver({type:'messenger:ready'},frame.contentWindow,'https://other.example');assert.equal(f.run('workspaceModule.ready'),false);assert.equal(f.posted.filter(row=>row.message.type==='workspace:open').length,0);
  deliver({type:'messenger:ready'},frame.contentWindow);const sent=f.posted.find(row=>row.message.type==='workspace:open');assert.ok(sent);assert.equal(sent.message.channelId,'room-a');assert.equal(sent.message.panel,'files');assert.equal(sent.message.messageId,'27');assert.equal(sent.message.fileId,'file-a');assert.equal(sent.origin,f.location.origin);
  deliver({type:'messenger:open-received',requestId:'wrong'},frame.contentWindow);assert.equal(f.run('workspaceModule.open'),pending);deliver({type:'messenger:open-received',requestId:pending.requestId},frame.contentWindow);assert.equal(f.run('workspaceModule.open'),null);
  f.run("workspaceModule.ready=false;openWorkspaceDestination({type:'messenger',label:'다른 대화',channelId:'room-b'});selectWorkspaceView('home');mountWorkspaceModule()");assert.equal(f.run('workspaceModule.open'),null);const count=f.posted.filter(row=>row.message.type==='workspace:open').length;deliver({type:'messenger:ready'},frame.contentWindow);assert.equal(f.posted.filter(row=>row.message.type==='workspace:open').length,count);assert.equal(f.run('workspaceModule.host.hidden'),true);assert.equal(f.requests.length,0);
});

test('notification click destination passes the company allowlist and queues a fixed inbox without writes',()=>{
  const f=fixture();
  assert.equal(f.run("openWorkspaceDestination({type:'messenger',label:'알림',panel:'notifications'})"),true);
  assert.equal(f.state.tab,'messenger');assert.equal(f.run('workspaceModule.open.panel'),'notifications');
  assert.equal(f.requests.length,0);assert.equal(f.run("safeMarinAction({type:'messenger',label:'관리',panel:'admin'})"),null);
});

test('weekly summary action is fixed and exact task deep links survive a fresh workspace mount',async()=>{
  const f=fixture({url:'http://localhost:4191/?tab=messenger&panel=tasks&channelId=room-a&messageId=27'});
  f.state.tab='messenger';f.run('mountWorkspaceModule()');
  assert.equal(f.run('workspaceModule.open.channelId'),'room-a');assert.equal(f.run('workspaceModule.open.messageId'),'27');assert.equal(f.run('workspaceModule.open.panel'),'tasks');
  assert.equal(f.location.searchParams.has('messageId'),false);
  const invalid=fixture({url:'http://localhost:4191/?tab=messenger&panel=tasks&channelId=..%2Fadmin&messageId=27'});invalid.state.tab='messenger';invalid.run('mountWorkspaceModule()');assert.equal(invalid.run('workspaceModule.open'),null);
  const home=fixture();home.run("ensureMarinSession();marinHome.entries=[{role:'assistant',text:'주간 정리',actions:[{type:'weekly-summary',label:'주간 정리 열기',url:'https://evil.example'}]}]");
  assert.equal(await home.run('dispatchMarinAction(0,0)'),true);assert.equal(home.location.href,'http://localhost:4191/?tab=social&section=results','주간 정리는 SNS 성과로(10-24)');assert.equal(home.requests.length,0);
});

test('a home refresh preserves the focused prompt and caret with teaching and guidance reachable in Tools',()=>{
  const f=fixture();f.run("ensureMarinSession();marinHome.draft='성과를 확인하고 싶어요'");const input=f.nodes.get('marin-input');input.value=f.home.draft;input.selectionStart=3;input.selectionEnd=5;input.focus();
  let markup='';const app={get innerHTML(){return markup;},set innerHTML(value){markup=value;const replacement=f.element('textarea');replacement.id='marin-input';f.nodes.set('marin-input',replacement);f.document.activeElement=null;},querySelectorAll:()=>[],contains:()=>true,querySelector:()=>null};
  Object.assign(f.context,{app,renderedTab:'home'});f.run(appSource.slice(appSource.indexOf('function shell('),appSource.indexOf('function render()')));f.run('shell(marinHomePage())');
  assert.equal(f.document.activeElement,f.nodes.get('marin-input'));assert.equal(f.nodes.get('marin-input').value,f.home.draft);assert.equal(f.nodes.get('marin-input').selectionStart,3);assert.equal(f.nodes.get('marin-input').selectionEnd,5);
  const tools=markup.match(/<aside class="ws-tools-drawer"[\s\S]*?<\/aside>/)?.[0]||'';
  // The same permitted destinations live in Tools; refresh still preserves IME and selection.
  assert.equal((tools.match(/<button[^>]*data-action="tab"/g)||[]).length,7);assert.match(tools,/data-tab="home"[\s\S]*data-tab="messenger"[\s\S]*data-tab="workroom"[\s\S]*data-tab="social"[\s\S]*data-tab="members"[\s\S]*data-tab="teaching"/);assert.match(tools,/data-action="command"/);assert.equal((tools.match(/data-tab="handbook"/g)||[]).length,1,'the shared handbook remains reachable in Tools');assert.doesNotMatch(markup,/id="workspace-sidebar(?:-toggle)?"|class="workspace-rail"|class="home-workspaces"|class="home-resume"|class="rail-account"|class="workspace-appbar"/);assert.equal((markup.match(/data-action="marin-account"/g)||[]).length,1);assert.doesNotMatch(markup,/data-tab="settings"/);assert.equal(f.requests.length,0);
  const composing=f.nodes.get('marin-input');f.dispatch('compositionstart',composing);f.run('shell(marinHomePage())');assert.equal(f.nodes.get('marin-input'),composing,'an ongoing IME composition cannot be replaced by a background refresh');assert.equal(f.document.activeElement,composing);
});

const plain=value=>JSON.parse(JSON.stringify(value));
const nextDateConstructor=instant=>class extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return Date.parse(instant);}};
const nextCandidate=(overrides={})=>({key:'messenger:task-1:revision-1',source:'messenger',title:'합성 원본 제목',context:'합성 프로젝트',reasons:[{text:'내가 답할 차례예요.'}],checks:['요청한 결과물을 확인하세요.'],action:{type:'messenger',label:'업무 원본 열기',panel:'tasks',channelId:'room-a',messageId:'27'},...overrides});
const nextResponse=(overrides={})=>({intent:'next-action',data:{status:'ready',generatedAt:'2026-11-09T03:00:00.000Z',coverage:{messenger:{status:'ok'},client:{status:'ok'},publication:{status:'ok'}},totalCount:1,excludedCount:0,unavailableCount:0,next:nextCandidate(),alternatives:[],...overrides}});
function nextFixture(options={}){
  const f=fixture(options),root=f.element('section'),opened=[],navigated=[];root.id='next-action';f.nodes.set(root.id,root);
  f.context.Date=nextDateConstructor(options.now||'2026-11-09T03:00:00.000Z');
  f.context.openWorkspaceDestination=action=>{opened.push(plain(action));f.state.tab='messenger';return true;};
  f.location.assign=href=>{navigated.push(href);f.location.href=new URL(href,f.location).href;};
  f.run('ensureMarinSession();ensureMarinNextSession()');
  const click=(action,key)=>{const button=f.element('button');button.dataset={action,...(key?{key}:{})};button.closest=selector=>selector==='[data-action]'||selector==='[data-action^="next-"]'&&action.startsWith('next-')?button:null;f.dispatch('click',button);return button;};
  return {...f,root,opened,navigated,click,next:f.run('marinNext')};
}

test('next-action lookup sends exclusions without a chat prompt, coalesces clicks, and persists no task content',async()=>{
  const f=nextFixture();assert.match(f.run('marinNextHtml()'),/다음 할 일 추천/);assert.equal(f.requests.length,0);
  f.next.excluded=['client:old:version-1'];const pending=f.run('requestMarinNext()');await f.run('requestMarinNext()');
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/assistant');assert.deepEqual(plain(f.requests[0].body),{intent:'next-action',exclusions:['client:old:version-1']});
  assert.equal(f.root.getAttribute('aria-busy'),'true');assert.match(f.root.innerHTML,/role="status"/);
  f.requests[0].resolve(nextResponse({next:nextCandidate({title:'<img src=x onerror=alert(1)>',reasons:[{text:'<script>원문</script>'}],checks:['<b>확인</b>']})}));await pending;
  assert.equal(f.root.getAttribute('aria-busy'),'false');assert.match(f.root.innerHTML,/&lt;img/);assert.match(f.root.innerHTML,/&lt;script&gt;/);assert.match(f.root.innerHTML,/&lt;b&gt;/);assert.doesNotMatch(f.root.innerHTML,/<img|<script|<b>/);
  const saved=JSON.parse(f.storage.get('synk-next-action:session:crew-a'));assert.deepEqual(saved,{date:'2026-11-09',started:true,excluded:['client:old:version-1']});
  assert.doesNotMatch(JSON.stringify(saved),/title|action|href|channelId|messageId|원문|onerror/);assert.equal(f.home.entries.length,0);assert.deepEqual(f.opened,[]);assert.deepEqual(f.navigated,[]);
});

test('skipping and restoring recommendations only change this session exclusion payload, not source work',async()=>{
  const f=nextFixture();const initial=f.run('requestMarinNext()');f.requests[0].resolve(nextResponse());await initial;
  f.click('next-skip');assert.equal(f.requests.length,2);assert.deepEqual(plain(f.requests[1].body.exclusions),['messenger:task-1:revision-1']);
  f.requests[1].resolve(nextResponse({status:'empty',next:null,totalCount:1,excludedCount:1}));await tick();
  assert.match(f.root.innerHTML,/추천을 모두 확인했어요/);assert.match(f.root.innerHTML,/넘긴 업무는 원본에 그대로/);assert.doesNotMatch(f.root.innerHTML,/지금 내 차례인 일이 없어요/);
  const restored=nextFixture({storage:f.storage});assert.deepEqual(plain(restored.next.excluded),['messenger:task-1:revision-1']);assert.equal(restored.next.started,true);assert.equal(restored.next.data,null,'a restored session must re-read task contents');
  f.click('next-restore');assert.equal(f.requests.length,3);assert.deepEqual(plain(f.requests[2].body),{intent:'next-action',exclusions:[]});
  f.requests[2].resolve(nextResponse());await tick();assert.deepEqual(plain(f.next.excluded),[]);assert.deepEqual(JSON.parse(f.storage.get('synk-next-action:session:crew-a')).excluded,[]);
  assert.ok(f.requests.every(row=>row.path==='/api/assistant'));assert.deepEqual(f.opened,[]);assert.deepEqual(f.navigated,[]);
});

test('KST day rollover clears excluded recommendations and stale content while keeping opt-in',()=>{
  const f=nextFixture({now:'2026-11-09T14:59:59.000Z'});f.next.started=true;f.next.excluded=['messenger:task-1:revision-1'];f.next.data=nextResponse().data;f.run('saveMarinNext()');
  f.context.Date=nextDateConstructor('2026-11-09T15:00:00.000Z');f.run('ensureMarinNextSession()');
  assert.equal(f.next.date,'2026-11-10');assert.equal(f.next.started,true);assert.deepEqual(plain(f.next.excluded),[]);assert.equal(f.next.data,null);assert.equal(f.next.needsRefresh,true);
  assert.deepEqual(JSON.parse(f.storage.get('synk-next-action:session:crew-a')),{date:'2026-11-10',started:true,excluded:[]});assert.equal(f.requests.length,0);
});

test('changed, missing and unverified candidates never navigate after a fresh source check',async()=>{
  for(const status of ['changed','missing','unverified']){
    const f=nextFixture(),key=nextCandidate().key;f.context.key=key;const pending=f.run('openMarinNext(key)');
    assert.deepEqual(plain(f.requests[0].body),{intent:'next-action',exclusions:[],candidateKey:key});
    f.requests[0].resolve(nextResponse({candidateCheck:{status,candidate:nextCandidate()}}));await pending;
    assert.deepEqual(f.opened,[],status);assert.deepEqual(f.navigated,[],status);assert.match(f.next.note,status==='unverified'?/최신 상태를 확인하지 못했어요/:/담당이나 단계가 바뀌었어요/);
  }
});

test('only the matching freshly confirmed candidate can open its current original destination',async()=>{
  for(const source of ['messenger','workspace']){
    const f=nextFixture(),key=nextCandidate().key,action=source==='messenger'?nextCandidate().action:{type:'workspace',label:'고객 요청 열기',href:'/?tab=workroom&section=clients&project=project-1&message=request-1'};
    f.context.key=key;const pending=f.run('openMarinNext(key)');assert.deepEqual(f.opened,[]);assert.deepEqual(f.navigated,[]);
    f.requests[0].resolve(nextResponse({candidateCheck:{status:'confirmed',candidate:nextCandidate({action})}}));await pending;
    assert.equal(f.requests.length,1);assert.equal(f.next.needsRefresh,true);
    if(source==='messenger'){assert.deepEqual(f.opened,[action]);assert.deepEqual(f.navigated,[]);}else{assert.deepEqual(f.navigated,[action.href]);assert.deepEqual(f.opened,[]);}
  }
  const mismatch=nextFixture();mismatch.context.key=nextCandidate().key;const pending=mismatch.run('openMarinNext(key)');mismatch.requests[0].resolve(nextResponse({candidateCheck:{status:'confirmed',candidate:nextCandidate({key:'messenger:another:revision-2'})}}));await pending;assert.deepEqual(mismatch.opened,[]);assert.deepEqual(mismatch.navigated,[]);
});

test('a source check cannot navigate after home exit, account replacement, or logout and login to the same account',async()=>{
  for(const change of ['leave-home','other-account','logout-same-account']){
    const f=nextFixture();f.context.key=nextCandidate().key;const pending=f.run('openMarinNext(key)');
    if(change==='leave-home')f.state.tab='workroom';
    if(change==='other-account'){f.state.user={id:'crew-b',role:'member'};f.run('ensureMarinSession();ensureMarinNextSession()');}
    if(change==='logout-same-account'){f.run('resetMarinHome()');f.state.user=null;assert.equal(f.storage.has('synk-next-action:session:crew-a'),false);f.state.user={id:'crew-a',role:'member'};f.run('ensureMarinSession();ensureMarinNextSession()');}
    f.requests[0].resolve(nextResponse({candidateCheck:{status:'confirmed',candidate:nextCandidate()}}));await pending;
    assert.deepEqual(f.opened,[],change);assert.deepEqual(f.navigated,[],change);
    if(change!=='leave-home'){assert.equal(f.next.data,null,change);assert.equal(f.next.started,false,change);assert.deepEqual(plain(f.next.excluded),[],change);}
  }
});

test('an old account response cannot overwrite or unlock a newer recommendation request',async()=>{
  const f=nextFixture(),old=f.run('requestMarinNext()');f.state.user={id:'crew-b',role:'member'};f.run('ensureMarinSession();ensureMarinNextSession()');const fresh=f.run('requestMarinNext()');
  f.requests[0].resolve(nextResponse({next:nextCandidate({title:'이전 계정 비공개 업무'})}));await old;assert.equal(f.next.pending,true);assert.equal(f.next.data,null);assert.doesNotMatch(f.root.innerHTML,/이전 계정 비공개 업무/);
  f.requests[1].resolve(nextResponse({status:'empty',next:null,totalCount:0}));await fresh;assert.equal(f.next.pending,false);assert.equal(f.next.userId,'crew-b');assert.equal(f.next.data.next,null);
});

test('partial, unknown, unavailable, empty and skipped results keep their distinct meaning',async()=>{
  const cases=[
    {data:nextResponse({status:'partial',coverage:{messenger:{status:'ok'},client:{status:'error'},publication:{status:'ok'}}}).data,matches:[/일부 업무를 확인하지 못했어요/,/확인된 범위에서 먼저 추천해요/,/미확인: 고객 업무/,/합성 원본 제목/],absent:/지금 내 차례인 일이 없어요/},
    {data:nextResponse({status:'unknown',next:null,totalCount:0,coverage:{messenger:{status:'error'},client:{status:'error'},publication:{status:'error'}}}).data,matches:[/업무를 불러오지 못했어요/,/새로 확인/],absent:/지금 내 차례인 일이 없어요|추천을 모두 확인했어요/},
    {data:nextResponse({status:'empty',next:null,totalCount:0}).data,matches:[/확인한 업무 중 지금 내 차례인 일이 없어요/],absent:/업무를 불러오지 못했어요|추천을 모두 확인했어요/},
    {data:nextResponse({status:'empty',next:null,totalCount:0,unavailableCount:2}).data,matches:[/읽기 전용이거나 담당·검토자를 확인해야 하는 업무 2건/,/대화 업무 보기에서 확인/],absent:/추천을 모두 확인했어요|전체 업무에서 확인/},
    {data:nextResponse({status:'empty',next:null,totalCount:2,excludedCount:2}).data,matches:[/추천을 모두 확인했어요/,/넘긴 업무는 원본에 그대로/],absent:/지금 내 차례인 일이 없어요/},
  ];
  for(const {data,matches,absent}of cases){const f=nextFixture(),pending=f.run('requestMarinNext()');f.requests[0].resolve({data});await pending;for(const pattern of matches)assert.match(f.root.innerHTML,pattern);assert.doesNotMatch(f.root.innerHTML,absent);}
});

test('unsafe workspace destinations are rejected even when source revalidation says confirmed',async()=>{
  const unsafe=['https://evil.example/?tab=workroom&section=clients&project=p','//evil.example/?tab=workroom&section=clients&project=p','javascript:alert(1)','/?tab=settings','/?tab=workroom&section=clients','/?tab=workroom&section=tools&tool=automation','/?tab=social&section=accounts','/?tab=social&section=today#outside','/?tab=social&section=today\\outside','/?tab=social&section= today'];
  for(const href of unsafe){const f=nextFixture(),action={type:'workspace',label:'원본 열기',href};f.context.candidate=action;assert.equal(f.run('safeNextAction(candidate)'),null,href);f.context.key=nextCandidate().key;const pending=f.run('openMarinNext(key)');f.requests[0].resolve(nextResponse({candidateCheck:{status:'confirmed',candidate:nextCandidate({action})}}));await pending;assert.deepEqual(f.opened,[],href);assert.deepEqual(f.navigated,[],href);}
  for(const href of ['/?tab=workroom&section=clients&project=p&message=m','/?tab=workroom&section=tools&tool=publication&publicationAction=review&packageId=p','/?tab=social&section=today','/?tab=social&section=fix']){const f=nextFixture();f.context.candidate={type:'workspace',label:'원본',href};assert.equal(f.run('safeNextAction(candidate).href'),href);}
});

test('a failed or malformed recommendation response keeps exclusions and offers retry without declaring no work',async()=>{
  for(const malformed of [false,true]){const f=nextFixture();f.next.excluded=['client:one:version-1'];const pending=f.run('requestMarinNext()');if(malformed)f.requests[0].resolve({data:{status:'ready'}});else f.requests[0].reject(new Error('일시 연결 오류'));await pending;
    assert.equal(f.next.pending,false);assert.equal(f.next.data,null);assert.deepEqual(plain(f.next.excluded),['client:one:version-1']);assert.match(f.root.innerHTML,/role="alert"/);assert.match(f.root.innerHTML,/새로 확인/);assert.doesNotMatch(f.root.innerHTML,/지금 내 차례인 일이 없어요/);
    const retry=f.run('requestMarinNext()');assert.deepEqual(plain(f.requests[1].body.exclusions),['client:one:version-1']);f.requests[1].resolve(nextResponse());await retry;assert.equal(f.next.error,'');assert.equal(f.next.data.status,'ready');assert.equal(f.requests.length,2);
  }
});

test('a background home repaint preserves the focused recommendation and expanded alternatives',()=>{
  const f=nextFixture();f.next.started=true;f.next.data=nextResponse({alternatives:[nextCandidate({key:'messenger:task-2:revision-1',title:'두 번째 후보'})]}).data;f.next.checkedAt=f.context.Date.now();
  const alternatives=f.element('details'),focused=f.element('button');alternatives.className='next-alternatives';alternatives.open=true;focused.dataset={action:'next-open',key:'messenger:task-2:revision-1'};focused.closest=selector=>selector==='[data-action]'?focused:null;f.root.append(focused);f.root.querySelector=selector=>selector==='.next-alternatives'?alternatives:null;focused.focus();
  let newRoot,newAlternative,newButton,markup='';
  const app={get innerHTML(){return markup;},set innerHTML(value){markup=value;newRoot=f.element('section');newRoot.id='next-action';newAlternative=f.element('details');newAlternative.className='next-alternatives';newAlternative.open=false;newButton=f.element('button');newButton.dataset={...focused.dataset};newButton.closest=selector=>selector==='[data-action]'?newButton:null;newRoot.append(newButton);newRoot.querySelector=selector=>selector==='.next-alternatives'?newAlternative:selector.includes('next-open')?newButton:null;newRoot.querySelectorAll=selector=>selector==='[data-action]'?[newButton]:[];f.nodes.set('next-action',newRoot);f.document.activeElement=f.document.body;},querySelectorAll:()=>[],contains:()=>true,querySelector:()=>newButton};
  Object.assign(f.context,{app,renderedTab:'home'});f.run(appSource.slice(appSource.indexOf('function shell('),appSource.indexOf('function render()')));f.run('workspaceRepaint.background=true;shell(marinHomePage())');
  assert.equal(f.document.activeElement,newButton,'polling must not drop keyboard focus from a recommendation to the page body');assert.equal(newAlternative.open,true,'polling must not collapse the candidate list the employee is reading');assert.equal(f.requests.length,0);
});

test('a background home repaint preserves focus on the direct Marin conversation summary',()=>{
  const f=nextFixture(),summary=f.element('summary');summary.matches=selector=>selector==='.next-assistant>summary';summary.focus();
  let replacement,markup='';
  f.document.querySelector=selector=>selector==='.next-assistant>summary'?replacement:null;
  const app={get innerHTML(){return markup;},set innerHTML(value){markup=value;replacement=f.element('summary');replacement.matches=summary.matches;f.document.activeElement=f.document.body;},querySelectorAll:()=>[],contains:()=>true,querySelector:()=>replacement};
  Object.assign(f.context,{app,renderedTab:'home'});f.run(appSource.slice(appSource.indexOf('function shell('),appSource.indexOf('function render()')));f.run('workspaceRepaint.background=true;shell(marinHomePage())');
  assert.equal(f.document.activeElement,replacement,'polling must keep the keyboard user at the direct conversation entry');assert.equal(f.requests.length,0);
});

const WORK_UUID_1='11111111-1111-4111-8111-111111111111';
const WORK_UUID_2='22222222-2222-4222-8222-222222222222';
const WORK_UUID_3='33333333-3333-4333-8333-333333333333';
const companyWorkCatalog={companies:[{id:'SHIFT',name:'SYNK SHIFT',features:['lectures'],roles:[['instructor','강사'],['lead','책임자'],['automation','자동화']]},{id:'PATH',name:'SYNK PATH',features:['path'],roles:[['counselor','상담 담당'],['lead','책임자']]},{id:'PULSE',name:'SYNK PULSE',features:['clients','production'],roles:[['pm','PM']]}],duties:[],classification:[]};

test('SHIFT and PATH staff load personal open schedules immediately on home without hiding today items behind 5 overdue items or unsafe hrefs',async()=>{
  const f=nextFixture({now:'2026-11-20T01:00:00.000Z'});
  f.state.data.workspaceCatalog=companyWorkCatalog;
  f.state.user={id:'staff-dual',name:'겸임 담당',role:'member',workspaceAccess:{configured:true,legacy:false,admin:false,features:['lectures','path'],companies:['SHIFT','PATH'],memberships:[{company:'SHIFT',role:'instructor'},{company:'PATH',role:'counselor'}],duties:[]}};
  const slot=f.element('section');slot.id='wa-mine-work';f.nodes.set('wa-mine-work',slot);
  const initialHtml=f.run('marinHomePage()');
  // 11-24 사무실: 옛 「내 강의·상담 일정」 칸 대신 SHIFT · PATH 방이 같은 자료를 받고, 받기 전에는 「확인하고 있어요」를 보인다(0이라고 말하지 않는다).
  assert.match(initialHtml,/data-room="shift" data-action="ws-inbox" aria-label="SHIFT AI 강의실 · 지금 내 차례 없음"/);
  assert.match(initialHtml,/data-room="path" data-action="ws-inbox" aria-label="PATH 유학 상담실 /);
  assert.match(initialHtml,/내 차례를 확인하고 있어요/);
  await tick();
  assert.equal(f.requests.length,1);
  assert.equal(f.requests[0].path,'/api/company-work/mine');
  assert.equal(f.requests[0].body,undefined);
  f.run('waSyncMine();void waLoadMine()');
  assert.equal(f.requests.length,1,'in-flight personal schedule lookup is deduplicated');
  const overdue=Array.from({length:6},(_,i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`,company:'SHIFT',title:`지난 강의 ${i+1}`,date:`2026-11-1${i}`,revision:1,href:`/?tab=lectures&workId=00000000-0000-4000-8000-00000000000${i+1}`}));
  f.requests[0].resolve({
    companies:['SHIFT','PATH'],
    date:'2026-11-20',
    canAct:false,
    items:[
      ...overdue,
      {id:WORK_UUID_1,company:'SHIFT',title:'오늘 자동화 실습 강의',date:'2026-11-20',revision:2,href:`/?tab=lectures&workId=${WORK_UUID_1}`},
      {id:WORK_UUID_2,company:'PATH',title:'다음 주 정착 상담',date:'2026-11-25',revision:1,href:`/?tab=path&workId=${WORK_UUID_2}`},
      {id:WORK_UUID_3,company:'PATH',title:'날짜 미정 상담',date:'',revision:1,href:'javascript:alert(1)'},
    ],
  });
  await tick();
  assert.equal(slot.getAttribute('aria-busy'),'false');
  assert.match(slot.innerHTML,/미완료 9건 · 오늘 1 · 지난 일정 6 · 예정 1 · 일정 미정 1/);
  assert.match(slot.innerHTML,/보기 전용 권한이에요/);
  const [beforeMore,moreMarkup='']=slot.innerHTML.split('<details');
  assert.match(beforeMore,/오늘 자동화 실습 강의/,'today schedule is never hidden behind 6 overdue items');
  assert.match(moreMarkup,/이후·미정 일정 2건 더 보기/);
  assert.match(moreMarkup,/다음 주 정착 상담/);
  assert.match(moreMarkup,/날짜 미정 상담/);
  assert.doesNotMatch(slot.innerHTML,/javascript:alert/);
  assert.doesNotMatch(slot.innerHTML,new RegExp(`data-work-id="${WORK_UUID_3}"`));
  // 11-24 사무실: 범위를 고르면 방 수도 그 회사 일정만 센다(지난 6 + 오늘 1 = SHIFT 7, PATH는 다음 주 · 날짜 미정뿐이라 0).
  f.run("wa.company='SHIFT'");assert.match(f.run('marinHomePage()'),/aria-label="SHIFT AI 강의실 · 내 차례 7개"/);assert.doesNotMatch(f.run('marinHomePage()'),/다음 주 정착 상담/);
  f.run("wa.company='PATH'");assert.match(f.run('marinHomePage()'),/aria-label="PATH 유학 상담실 · 지금 내 차례 없음"/);assert.doesNotMatch(f.run('marinHomePage()'),/오늘 자동화 실습 강의/);
  assert.equal(f.requests.length,1,'switching scope reuses stamped personal schedule without extra GETs');
});

test('admin home, unassigned roles and public demo send 0 company-work requests, while errors stay distinct from empty lists and stale responses are dropped',async()=>{
  const admin=nextFixture();
  admin.state.data.workspaceCatalog=companyWorkCatalog;
  admin.state.user={id:'admin-1',name:'관리자',role:'admin',workspaceAccess:{configured:true,legacy:false,admin:true,features:['lectures','path','clients'],companies:['SHIFT','PATH','PULSE'],memberships:[],duties:[]}};
  const adminHtml=admin.run('marinHomePage()');await tick();
  assert.equal(admin.requests.length,0);
  assert.doesNotMatch(adminHtml,/wa-mine-work/);
  // 11-24 사무실: 관리자 입구는 사무실 「바로 가기」가 아니라 왼쪽 메뉴 「관리」 묶음에 있다(workspace-shell-client 시험이 소속별 메뉴 표로 본다).
  assert.match(adminHtml,/id="ws-office"/);assert.doesNotMatch(adminHtml,/wa-primary-entry/);

  const demo=nextFixture();
  demo.state.data.workspaceCatalog=companyWorkCatalog;
  demo.state.user={id:'demo-instructor',name:'데모 강사',role:'member',workspaceAccess:{configured:true,legacy:false,admin:false,features:['lectures'],companies:['SHIFT'],memberships:[{company:'SHIFT',role:'instructor'}],duties:[]}};
  demo.context.isDemoMode=()=>true;demo.next.started=true;
  const demoHtml=demo.run('marinHomePage()');demo.run('syncMarinNext()');await tick();
  assert.equal(demo.requests.length,0,'public demo sends 0 authenticated requests');
  assert.doesNotMatch(demoHtml,/wa-mine-work/);

  const f=nextFixture();
  f.state.data.workspaceCatalog=companyWorkCatalog;
  f.state.user={id:'inst-a',name:'강사 가',role:'member',workspaceAccess:{configured:true,legacy:false,admin:false,features:['lectures'],companies:['SHIFT'],memberships:[{company:'SHIFT',role:'instructor'}],duties:[]}};
  const slot=f.element('section');slot.id='wa-mine-work';f.nodes.set('wa-mine-work',slot);
  const stale=f.run('waLoadMine()');
  f.state.user={id:'inst-b',name:'강사 나',role:'member',workspaceAccess:{configured:true,legacy:false,admin:false,features:['lectures'],companies:['SHIFT'],memberships:[{company:'SHIFT',role:'instructor'}],duties:[]}};
  f.run('waNormalizeView()');
  const failed=f.run('waLoadMine()');
  f.requests[0].resolve({companies:['SHIFT'],date:'2026-11-20',canAct:true,items:[{id:WORK_UUID_1,company:'SHIFT',title:'이전 계정 강의',date:'2026-11-20',revision:1,href:`/?tab=lectures&workId=${WORK_UUID_1}`}]});
  await stale;
  assert.doesNotMatch(slot.innerHTML,/이전 계정 강의/);
  f.requests[1].reject(new Error('일시 조회 실패'));
  await failed;
  assert.match(slot.innerHTML,/role="alert"/);
  assert.match(slot.innerHTML,/일시 조회 실패/);
  assert.doesNotMatch(slot.innerHTML,/남은 미완료 강의 일정이 없어요/);
  const recovered=f.run('waLoadMine({force:true})');
  f.requests[2].resolve({companies:['SHIFT'],date:'2026-11-20',canAct:true,items:[]});
  await recovered;
  assert.doesNotMatch(slot.innerHTML,/일시 조회 실패/);
  assert.match(slot.innerHTML,/남은 미완료 강의 일정이 없어요/);
});

test('personal schedule refresh keeps keyboard focus during and after delayed responses, ignores duplicate activation, supports repeat and error retry, and never steals external focus',async()=>{
  const f=fixture({withAccessEvents:true});
  f.state.data.workspaceCatalog=companyWorkCatalog;
  f.state.user={id:'inst-focus',name:'강사 포커스',role:'member',workspaceAccess:{configured:true,legacy:false,admin:false,features:['lectures'],companies:['SHIFT'],memberships:[{company:'SHIFT',role:'instructor'}],duties:[]}};
  const slot=f.element('section');slot.id='wa-mine-work';
  let html='',buttons=[];
  Object.defineProperty(slot,'innerHTML',{
    get:()=>html,
    set(value){
      html=String(value);
      if(buttons.includes(f.document.activeElement))f.document.activeElement=f.document.body;
      for(const prev of buttons)prev.isConnected=false;
      buttons=[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([,attrs,label])=>{
        const btn=f.element('button');
        btn.parentElement=slot;
        btn.textContent=label.replace(/<[^>]+>/g,'');
        const action=attrs.match(/data-action="([^"]+)"/)?.[1];
        const company=attrs.match(/data-company="([^"]+)"/)?.[1];
        const workId=attrs.match(/data-work-id="([^"]+)"/)?.[1];
        const cls=attrs.match(/class="([^"]+)"/)?.[1]||'';
        const ariaDisabled=attrs.match(/aria-disabled="([^"]+)"/)?.[1];
        for(const c of cls.split(/\s+/).filter(Boolean))btn.classList.add(c);
        if(action)btn.dataset.action=action;
        if(company)btn.dataset.company=company;
        if(workId)btn.dataset.workId=workId;
        if(ariaDisabled)btn.setAttribute('aria-disabled',ariaDisabled);
        btn.disabled=/\sdisabled(?=[>\s]|$)/.test(attrs);
        const inError=btn.classList.contains('next-button')&&html.includes('class="wa-mine-error"');
        btn.focus=()=>{if(!btn.disabled&&btn.isConnected)f.document.activeElement=btn;};
        btn.closest=sel=>sel==='[data-action]'&&action?btn:sel==='.wa-mine-error'&&inError?slot:null;
        return btn;
      });
      slot.children=buttons;
    },
  });
  slot.contains=target=>target===slot||buttons.includes(target);
  slot.querySelectorAll=sel=>sel==='[data-action]'?buttons.filter(b=>b.dataset.action):[];
  slot.querySelector=sel=>{
    if(sel==='[data-action="wa-mine-refresh"]:not(:disabled)')return buttons.find(b=>b.dataset.action==='wa-mine-refresh'&&!b.disabled)||null;
    if(sel==='[data-action="wa-mine-refresh"]')return buttons.find(b=>b.dataset.action==='wa-mine-refresh')||null;
    return null;
  };
  f.nodes.set('wa-mine-work',slot);
  const click=target=>f.dispatch('click',target,{button:0,defaultPrevented:false,stopImmediatePropagation(){},stopPropagation(){}});
  const input=f.nodes.get('marin-input');
  input.focus();

  slot.innerHTML=f.run('waMineInnerHtml()');
  f.run('waQueueMineLoad()');
  await tick();
  assert.equal(f.requests.length,1);
  assert.equal(f.document.activeElement,input,'initial load does not steal external focus');
  f.requests[0].resolve({companies:['SHIFT'],date:'2026-11-20',canAct:true,items:[{id:WORK_UUID_1,company:'SHIFT',title:'오전 강의',date:'2026-11-20',revision:1,href:`/?tab=lectures&workId=${WORK_UUID_1}`}]});
  await tick();
  assert.equal(f.document.activeElement,input,'resolving initial load keeps external focus');

  f.run('wa.mineCheckedAt=1;waSyncMine()');
  assert.equal(f.requests.length,2);
  assert.equal(f.document.activeElement,input,'stale auto-refresh does not steal external focus');
  f.requests[1].resolve({companies:['SHIFT'],date:'2026-11-20',canAct:true,items:[{id:WORK_UUID_1,company:'SHIFT',title:'오전 강의',date:'2026-11-20',revision:1,href:`/?tab=lectures&workId=${WORK_UUID_1}`}]});
  await tick();
  assert.equal(f.document.activeElement,input);

  const refreshBtn=buttons.find(b=>b.dataset.action==='wa-mine-refresh');
  refreshBtn.focus();
  click(f.document.activeElement);
  assert.equal(f.requests.length,3);
  assert.notEqual(f.document.activeElement,f.document.body,'focus stays off document.body during pending refresh');
  assert.equal(f.document.activeElement.dataset.action,'wa-mine-refresh');
  assert.equal(f.document.activeElement.getAttribute('aria-disabled'),'true');

  click(f.document.activeElement);
  assert.equal(f.requests.length,3,'duplicate activation while aria-disabled is ignored');

  await tick();
  f.requests[2].resolve({companies:['SHIFT'],date:'2026-11-20',canAct:true,items:[{id:WORK_UUID_1,company:'SHIFT',title:'오전 강의 갱신',date:'2026-11-20',revision:2,href:`/?tab=lectures&workId=${WORK_UUID_1}`}]});
  await tick();
  assert.equal(f.document.activeElement.dataset.action,'wa-mine-refresh','focus remains on refresh button after delayed response');
  assert.equal(f.document.activeElement.getAttribute('aria-disabled'),null);

  click(f.document.activeElement);
  assert.equal(f.requests.length,4,'repeated activation in place triggers another refresh');
  assert.equal(f.document.activeElement.dataset.action,'wa-mine-refresh');
  assert.equal(f.document.activeElement.getAttribute('aria-disabled'),'true');
  f.requests[3].reject(new Error('일시 네트워크 오류'));
  await tick();
  assert.match(slot.innerHTML,/일시 네트워크 오류/);
  assert.equal(f.document.activeElement.dataset.action,'wa-mine-refresh','focus stays on refresh button when refresh fails');
  assert.equal(f.document.activeElement.getAttribute('aria-disabled'),null);

  const retryBtn=buttons.find(b=>b.classList.contains('next-button'));
  assert.ok(retryBtn);
  retryBtn.focus();
  click(f.document.activeElement);
  assert.equal(f.requests.length,5);
  assert.equal(f.document.activeElement.dataset.action,'wa-mine-refresh','focus stays on refresh control during error retry');
  assert.equal(f.document.activeElement.getAttribute('aria-disabled'),'true');
  f.requests[4].resolve({companies:['SHIFT'],date:'2026-11-20',canAct:true,items:[]});
  await tick();
  assert.match(slot.innerHTML,/남은 미완료 강의 일정이 없어요/);
  assert.equal(f.document.activeElement.dataset.action,'wa-mine-refresh','focus stays on refresh button after error recovery');
  assert.equal(f.document.activeElement.getAttribute('aria-disabled'),null);

  click(f.document.activeElement);
  assert.equal(f.requests.length,6);
  input.focus();
  f.requests[5].resolve({companies:['SHIFT'],date:'2026-11-20',canAct:true,items:[]});
  await tick();
  assert.equal(f.document.activeElement,input,'moving focus outside while pending is respected on completion');
});

test('recommendations accept only strict workId links, match actual coverage in partial and empty states, and rename messenger-only all-work link',async()=>{
  const f=nextFixture();
  f.state.data.workspaceCatalog=companyWorkCatalog;
  f.state.user={id:'inst-a',name:'강사',role:'member',workspaceAccess:{configured:true,legacy:false,admin:false,features:['lectures'],companies:['SHIFT'],memberships:[{company:'SHIFT',role:'instructor'}],duties:[]}};
  for(const valid of [`/?tab=lectures&workId=${WORK_UUID_1}`,`/?tab=path&workId=${WORK_UUID_2}`]){
    f.context.candidate={type:'workspace',label:'일정 열기',href:valid};
    assert.equal(f.run('safeNextAction(candidate)?.href'),valid);
  }
  for(const rejected of [
    '/?tab=lectures',
    `/?tab=lectures&item=${WORK_UUID_1}`,
    '/?tab=lectures&workId=not-a-uuid',
    `/?tab=lectures&workId=${WORK_UUID_1}&workId=${WORK_UUID_2}`,
    `/?tab=lectures&workId=${WORK_UUID_1}&extra=1`,
    `/?tab=lectures&workId=${WORK_UUID_1}#card`,
    `/?workId=${WORK_UUID_1}&tab=lectures`,
    '/?tab=lectures&workId=%311111111-1111-4111-8111-111111111111',
  ]){
    f.context.candidate={type:'workspace',label:'일정 열기',href:rejected};
    assert.equal(f.run('safeNextAction(candidate)'),null,rejected);
  }
  const emptyPending=f.run('requestMarinNext()');
  f.requests[0].resolve({data:{status:'empty',generatedAt:'2026-11-20T03:00:00.000Z',coverage:{messenger:{status:'ok'},lectures:{status:'ok'}},totalCount:0,excludedCount:0,unavailableCount:0,next:null,alternatives:[]}});
  await emptyPending;
  assert.match(f.root.innerHTML,/대화 업무, 강의 일정에서 확인했어요/);
  assert.doesNotMatch(f.root.innerHTML,/고객 프로젝트|게시·SNS|전체 업무 보기/);
  assert.match(f.root.innerHTML,/대화 업무 보기/);
  assert.match(f.root.innerHTML,/강의 일정 보기/);

  const partialPending=f.run('requestMarinNext()');
  f.requests[1].resolve({data:{
    status:'partial',
    generatedAt:'2026-11-20T03:05:00.000Z',
    coverage:{messenger:{status:'ok'},lectures:{status:'error'}},
    totalCount:1,
    excludedCount:0,
    unavailableCount:0,
    next:nextCandidate(),
    today:[{key:`lectures:${WORK_UUID_1}:rev-1`,source:'lectures',title:'오늘 필수 강의',context:'SHIFT 강의',due:{label:'강의 일정',precision:'date',value:'2026-11-20'},action:{type:'workspace',label:'강의 열기',href:`/?tab=lectures&workId=${WORK_UUID_1}`}}],
    alternatives:[],
  }});
  await partialPending;
  assert.match(f.root.innerHTML,/확인: 대화 업무 · 미확인: 강의 일정/);
  assert.match(f.root.innerHTML,/오늘 내 일정[\s\S]*오늘 필수 강의/);
  assert.match(f.root.innerHTML,/강의 일정 · 2026-11-20/);
  assert.doesNotMatch(f.root.innerHTML,/강의 일정 · 강의 일정/);

  f.click('next-open',`lectures:${WORK_UUID_1}:rev-1`);
  f.requests[2].resolve(nextResponse({candidateCheck:{status:'confirmed',candidate:{key:`lectures:${WORK_UUID_1}:rev-1`,source:'lectures',title:'오늘 필수 강의',action:{type:'workspace',label:'강의 열기',href:`/?tab=lectures&workId=${WORK_UUID_1}`}}}}));
  await tick();
  assert.deepEqual(f.navigated,[`/?tab=lectures&workId=${WORK_UUID_1}`]);
});

test('direct workId routes, home clicks and popstate verify fresh company records, focus the card heading once, and explain done, missing or unauthorized targets',async()=>{
  const setupWorkEnv=url=>{
    const f=nextFixture({url,withAccessEvents:true});
    let markup='';
    f.state.data.workspaceCatalog=companyWorkCatalog;
    f.context.pageHeading=(_e,title,_s,action='')=>`<header><h1>${title}</h1>${action}</header>`;
    f.context.empty=(title,copy,action='')=>`<div class="empty"><h2>${title}</h2><p>${copy}</p>${action}</div>`;
    f.context.render=()=>{if(['lectures','path'].includes(f.state.tab))markup=f.run('waWorkPage()');else if(f.state.tab==='home')markup=f.run('marinHomePage()');f.renders.push({tab:f.state.tab});};
    f.context.renderBackground=()=>f.context.render();
    return{f,getMarkup:()=>markup,setMarkup:v=>{markup=v;}};
  };

  // 1. Direct open -> fresh GET, focus once, no re-scroll on background repaint, no auto-save
  const openCase=setupWorkEnv(`http://localhost:4191/?tab=lectures&workId=${WORK_UUID_1}`);
  openCase.f.state.user={id:'inst-1',name:'강사',role:'member',workspaceAccess:{configured:true,legacy:false,admin:false,features:['lectures'],companies:['SHIFT'],memberships:[{company:'SHIFT',role:'instructor'}],duties:[]}};
  const heading=openCase.f.element('h2');heading.id=`wa-work-heading-${WORK_UUID_1}`;openCase.f.nodes.set(heading.id,heading);
  let focusCount=0;const origFocus=heading.focus;heading.focus=opts=>{focusCount++;origFocus(opts);};
  openCase.f.run('waNormalizeView()');assert.equal(openCase.f.state.tab,'lectures');
  openCase.f.context.render();await tick();
  assert.equal(openCase.f.requests.length,1);assert.equal(openCase.f.requests[0].path,'/api/company-work/SHIFT');
  openCase.f.requests[0].resolve({company:'SHIFT',canWrite:true,items:[{id:WORK_UUID_1,title:'직무 자동화 실습',date:'2026-11-20',status:'open',ownerName:'강사',note:'자료 점검',revision:3}]});
  await tick();
  assert.match(openCase.getMarkup(),/wa-work-item is-target/);
  assert.match(openCase.getMarkup(),/선택한 일정/);
  assert.equal(focusCount,1);assert.equal(openCase.f.document.activeElement,heading);
  const otherControl=openCase.f.element('button');otherControl.focus();
  openCase.f.context.renderBackground();await tick();
  assert.equal(focusCount,1,'background repaint must not steal focus or scroll again');
  assert.equal(openCase.f.document.activeElement,otherControl);
  assert.equal(openCase.f.requests.length,1,'opening a card never auto-edits or saves');

  // 2. Completed item & popstate navigation on PATH
  const pathCase=setupWorkEnv('http://localhost:4191/?tab=home');
  pathCase.f.state.user={id:'path-1',name:'상담사',role:'member',workspaceAccess:{configured:true,legacy:false,admin:false,features:['path'],companies:['PATH'],memberships:[{company:'PATH',role:'counselor'}],duties:[]}};
  const pathHeading=pathCase.f.element('h2');pathHeading.id=`wa-work-heading-${WORK_UUID_2}`;pathCase.f.nodes.set(pathHeading.id,pathHeading);
  pathCase.f.run('waNormalizeView()');
  pathCase.f.location.href=`http://localhost:4191/?tab=path&workId=${WORK_UUID_2}`;
  for(const row of pathCase.f.windowHandlers.filter(r=>r.type==='popstate'))row.handler({});
  assert.equal(pathCase.f.state.tab,'path');
  assert.equal(pathCase.f.renders.at(-1)?.tab,'path','popstate itself renders the destination');
  await tick();
  const pathReq=pathCase.f.requests.find(r=>r.path==='/api/company-work/PATH');
  assert.ok(pathReq);
  pathReq.resolve({company:'PATH',canWrite:true,items:[{id:WORK_UUID_2,title:'완료된 체류 상담',date:'2026-11-18',status:'done',ownerName:'상담사',note:'',revision:4}]});
  await tick();
  assert.match(pathCase.getMarkup(),/이미 완료된 기록이에요/);
  assert.match(pathCase.getMarkup(),/status-badge good[\s\S]*완료/);
  assert.equal(pathCase.f.document.activeElement,pathHeading);

  // 3. Missing item & invalid query
  const missingCase=setupWorkEnv(`http://localhost:4191/?tab=lectures&workId=${WORK_UUID_3}`);
  missingCase.f.state.user=openCase.f.state.user;
  missingCase.f.run('waNormalizeView()');missingCase.f.context.render();await tick();
  missingCase.f.requests[0].resolve({company:'SHIFT',canWrite:true,items:[{id:WORK_UUID_1,title:'남아 있는 강의',date:'2026-11-22',status:'open',ownerName:'강사',note:'',revision:1}]});
  await tick();
  assert.match(missingCase.getMarkup(),/찾으시는 일정이 없거나 삭제·권한 변경으로 열람할 수 없어요/);
  assert.match(missingCase.getMarkup(),/남아 있는 강의/);

  const invalidCase=setupWorkEnv('http://localhost:4191/?tab=lectures&workId=invalid');
  invalidCase.f.state.user=openCase.f.state.user;
  invalidCase.f.run('waNormalizeView()');invalidCase.f.context.render();
  assert.match(invalidCase.getMarkup(),/유효하지 않은 업무 연결이에요/);
  assert.equal(invalidCase.f.location.search,'?tab=lectures');

  // 4. Unauthorized / other company deep link redirects to home with clear notice
  const denied=setupWorkEnv(`http://localhost:4191/?tab=lectures&workId=${WORK_UUID_1}`);
  denied.f.state.user=pathCase.f.state.user;
  denied.f.run('waNormalizeView()');
  assert.equal(denied.f.state.tab,'home');
  denied.f.context.render();
  assert.match(denied.getMarkup(),/SHIFT 강의 일정 열람 권한이 없거나 다른 회사의 업무예요/);
});

test('an owned schedule opens from home, header exits it, and browser history restores the displayed tab',()=>{
  const f=fixture({url:'http://localhost:4191/?tab=home',withAccessEvents:true});
  f.state.user.workspaceAccess={configured:true,features:['lectures'],companies:['SHIFT'],memberships:[{company:'SHIFT',role:'instructor'}],duties:[]};
  f.state.data.workspaceCatalog=companyWorkCatalog;
  f.context.reportTabs=()=>false;
  f.context.render=()=>{
    f.run('waNormalizeView();syncWorkspaceLocation()');
    f.renders.push({tab:f.state.tab,workId:f.run('wa.workTarget?.workId')});
  };
  const clickListener=appSource.indexOf("document.addEventListener('click', async event =>");
  const changeListener=appSource.indexOf("document.addEventListener('change', async event =>",clickListener);
  f.run(appSource.slice(clickListener,changeListener));
  function clickControl(dataset){
    const control=f.element('button');
    control.dataset=dataset;
    control.closest=selector=>selector==='[data-action]'?control:null;
    f.dispatch('click',control);
  }
  f.context.render();
  clickControl({action:'wa-mine-open',company:'SHIFT',workId:WORK_UUID_1});
  assert.deepEqual(f.renders.at(-1),{tab:'lectures',workId:WORK_UUID_1});
  assert.equal(f.location.searchParams.get('workId'),WORK_UUID_1);
  f.context.history.back();
  assert.deepEqual(f.renders.at(-1),{tab:'home',workId:undefined});
  f.context.history.forward();
  assert.deepEqual(f.renders.at(-1),{tab:'lectures',workId:WORK_UUID_1});
  clickControl({action:'tab',tab:'home'});
  assert.deepEqual(f.renders.at(-1),{tab:'home',workId:undefined});
  assert.equal(f.location.search,'?tab=home');

  const project=fixture({url:'http://localhost:4191/?tab=lectures&project=qa-project',withAccessEvents:true});
  project.state.user.workspaceAccess=f.state.user.workspaceAccess;
  project.state.data.workspaceCatalog=companyWorkCatalog;
  project.run("selectWorkspaceView('lectures');waNormalizeView();syncWorkspaceLocation()");
  assert.equal(project.state.tab,'lectures');
  assert.equal(project.run('wa.workTarget'),null);
  assert.equal(project.run('wa.workTargetNotice'),'');
  assert.equal(project.location.searchParams.get('project'),'qa-project');
});

test('a session refresh for the same employee starts a fresh schedule lookup after the stale response',async()=>{
  const f=fixture({url:'http://localhost:4191/?tab=home'});
  f.state.user.workspaceAccess={configured:true,features:['lectures'],companies:['SHIFT'],memberships:[{company:'SHIFT',role:'instructor'}],duties:[]};
  f.state.data.workspaceCatalog=companyWorkCatalog;
  const slot=f.element('section');slot.id='wa-mine-work';f.nodes.set(slot.id,slot);
  f.context.companyAuthSnapshot=()=>({userId:f.state.user.id,csrf:f.state.csrf});
  f.context.companyAuthCurrent=snapshot=>snapshot.userId===f.state.user.id&&snapshot.csrf===f.state.csrf;
  f.run('waNormalizeView()');
  const first=f.run('waLoadMine()');
  f.state.csrf='updated-test-csrf';
  f.requests[0].resolve({companies:['SHIFT'],canAct:true,date:'2026-11-20',items:[]});
  await first;
  assert.deepEqual(f.requests.map(request=>request.path),['/api/company-work/mine','/api/company-work/mine']);
  f.requests[1].resolve({companies:['SHIFT'],canAct:true,date:'2026-11-20',items:[]});
  await tick();
  assert.equal(f.run('wa.mineLoading'),false);
  assert.match(slot.innerHTML,/남은 미완료 강의 일정이 없어요/);
});

// ── 11-24 다시 짓기(시안 F · 설계 12절): 왼쪽 메뉴 · 아래 탭 · 「더보기」 시트 · 받은편지함 ──
const shellRows=[
  ['관리자',{role:'admin'}],
  ['미지정',{role:'member'}],
  ['LAB 교사',{memberships:[['LAB','teacher']]}],
  ['LAB 운영',{memberships:[['LAB','operations']]}],
  ['PATH 상담',{memberships:[['PATH','counselor']]}],
  ['SHIFT 강사',{memberships:[['SHIFT','instructor']]}],
  ['SHIFT 자동화',{memberships:[['SHIFT','automation']]}],
  ['PULSE 제작',{memberships:[['PULSE','producer']]}],
  ['SNS 담당',{memberships:[['LAB','teacher']],duties:['social']}],
  ['겸임 · 모두',{memberships:[['SHIFT','instructor'],['PULSE','producer']],scope:'all'}],
  ['겸임 · SHIFT',{memberships:[['SHIFT','instructor'],['PULSE','producer']],scope:'SHIFT'}],
  ['겸임 · PULSE',{memberships:[['SHIFT','instructor'],['PULSE','producer']],scope:'PULSE'}],
  ['보기 전용',{role:'viewer'}],
];
function shellFixture({role='member',memberships,duties=[],scope='all'}={}){
  const f=fixture(),opened=[];let dialog='';
  const raw={id:'crew-'+role,name:'크루',role,active:true,...(memberships?{workspaceProfile:{version:1,revision:1,memberships:memberships.map(([company,r])=>({company,role:r})),duties}}:{})};
  f.state.user={id:raw.id,name:'크루',role,workspaceAccess:workspaceAccess(raw)};
  f.state.data.workspaceCatalog={companies:WORKSPACE_COMPANIES,duties:WORKSPACE_DUTIES,classification:[]};
  Object.assign(f.context,{workspaceTurnEnsure(){},modal:(_title,_sub,html)=>{dialog=html;},closeModal(){f.context.closed=(f.context.closed||0)+1;},button:(label,action)=>`<button type="button" data-action="${action}">${label}</button>`});
  f.run(`wa.userId=state.user.id;wa.company=${JSON.stringify(scope)}`);
  return {...f,opened,dialog:()=>{dialog='';f.run('marinAccountDialog()');return dialog;}};
}
// 단추 · 링크 하나를 「어디로 가는가」 한 낱말로 줄인다: tab:X · workroom:X · social:X · panel:X · 그 밖의 동작 이름.
function shellDestinations(html){
  const out=new Set();
  for(const [tag] of html.matchAll(/<(?:a|button)\b[^>]*>/g)){
    const attr=name=>tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]??null;
    const action=attr('data-action'),tab=attr('data-tab'),href=attr('href');
    if(action==='tab'||action==='command-tab')out.add('tab:'+tab);
    else if(action==='wa-open')out.add(tab+':'+attr('data-section'));
    else if(action==='workroom-view')out.add('workroom:'+tab);
    else if(action==='social-view')out.add('social:'+attr('data-view'));
    else if(action==='marin-workroom-panel')out.add('panel:'+attr('data-panel'));
    else if(action)out.add(action);
    else if(href)out.add('href:'+href);
  }
  for(const local of ['workspace-tools-close','workspace-tools-toggle'])out.delete(local);
  return out;
}
const shellTabs=set=>[...set].filter(key=>key.startsWith('tab:')).sort();
// 바꾸기 전 「도구」 서랍이 소속마다 내보내던 곳(11-24 고정). 휴대폰의 「더보기」 시트는 이 서랍 그대로다.
const FROZEN_DRAWER={
  "관리자":["account-login-info","command","device-notifications-open","href:/trial-feedback/","invite","logout","panel:saved","panel:tasks","social:map","social:today","synk-id-account","tab:admin","tab:handbook","tab:home","tab:lectures","tab:members","tab:messenger","tab:path","tab:settings","tab:social","tab:teaching","tab:tips","tab:workroom","wa-invites","workroom:desk","workroom:pages","workroom:tools","workroom:trends"],
  "미지정":["account-login-info","command","device-notifications-open","href:/trial-feedback/","logout","panel:saved","panel:tasks","social:map","social:today","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger","tab:social","tab:teaching","tab:workroom","workroom:desk","workroom:pages","workroom:tools","workroom:trends"],
  "LAB 교사":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger","tab:teaching"],
  "LAB 운영":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger"],
  "PATH 상담":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger","tab:path"],
  "SHIFT 강사":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:lectures","tab:members","tab:messenger"],
  "SHIFT 자동화":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger"],
  "PULSE 제작":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger","tab:workroom","workroom:desk","workroom:tools","workroom:trends"],
  "SNS 담당":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","social:map","social:today","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger","tab:social","tab:teaching","tab:workroom","workroom:desk","workroom:pages","workroom:tools","workroom:trends"],
  "겸임 · 모두":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:lectures","tab:members","tab:messenger","tab:workroom","workroom:desk","workroom:tools","workroom:trends"],
  "겸임 · SHIFT":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:lectures","tab:members","tab:messenger"],
  "겸임 · PULSE":["account-login-info","command","device-notifications-open","logout","panel:saved","panel:tasks","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger","tab:workroom","workroom:desk","workroom:tools","workroom:trends"],
  "보기 전용":["account-login-info","command","device-notifications-open","href:/trial-feedback/","logout","panel:saved","panel:tasks","social:map","social:today","synk-id-account","tab:handbook","tab:home","tab:members","tab:messenger","tab:social","tab:teaching","tab:workroom","workroom:desk","workroom:pages","workroom:tools","workroom:trends"],
};

test('every membership reaches exactly the frozen drawer destinations: 1440 through the side menu and account menu, 390 through the bottom tabs and the more sheet',()=>{
  const drawers={};
  for(const [name,row] of shellRows){
    const f=shellFixture(row);f.state.tab='home';
    const drawer=shellDestinations(f.run('workspaceToolsDrawer(false)'));drawers[name]=[...drawer].sort();
    assert.deepEqual(drawers[name],FROZEN_DRAWER[name],name+': the more sheet keeps the frozen drawer');
    // 1440: 메뉴(사무실 · 만들기 · SNS를 골랐을 때의 하위 줄까지) ∪ 계정 메뉴
    const side=new Set();
    for(const view of ['home','workroom','social']){f.state.tab=view;for(const key of shellDestinations(f.run('workspaceSideNav(false)')))side.add(key);}
    f.state.tab='home';for(const key of shellDestinations(f.dialog()))side.add(key);
    const missing=[...drawer].filter(key=>!side.has(key));
    assert.deepEqual(missing,[],name+': 1440 side menu plus account menu reach every drawer destination');
    assert.deepEqual(shellTabs(side),shellTabs(drawer),name+': the side menu shows no tab the drawer does not allow');
    assert.ok(side.has('ws-inbox')&&side.has('command'),name+': 내 차례 and 찾기 are in the side menu');
    // 390: 아래 탭 ∪ 시트. 아래 탭은 허용된 탭만, SNS는 허용될 때만, 「더보기」는 늘 있다.
    const barHtml=f.run('workspaceTabBar(false)'),bar=shellDestinations(barHtml);
    assert.match(barHtml,/id="ws-tools-toggle"[^>]*aria-controls="ws-tools-drawer"/,name+': 더보기 opens the sheet');
    assert.deepEqual(shellTabs(bar).filter(key=>!drawer.has(key)),[],name+': bottom tabs only show allowed tabs');
    assert.equal(bar.has('tab:social'),drawer.has('tab:social'),name+': SNS tab follows the SNS permission');
    assert.ok(bar.has('tab:home')&&bar.has('ws-inbox'),name+': 사무실 and 내 차례 are bottom tabs');
  }
  // 관리 묶음 · 초대 둘은 관리자에게만.
  const admin=shellFixture({role:'admin'}),member=shellFixture({memberships:[['SHIFT','instructor']]});
  assert.match(admin.run('workspaceSideNav(false)'),/<p class="ws-side-head">관리<\/p>[\s\S]*data-tab="admin"[\s\S]*data-tab="tips"[\s\S]*data-tab="settings"/);
  assert.doesNotMatch(member.run('workspaceSideNav(false)'),/data-tab="admin"|data-tab="tips"/);
  assert.match(admin.dialog(),/data-action="invite"[\s\S]*data-action="wa-invites"/);assert.doesNotMatch(member.dialog(),/data-action="invite"|data-action="wa-invites"/);
  // 회사 안내는 모든 직원에게, 관리 묶음 밖에.
  assert.match(member.run('workspaceSideNav(false)'),/<div class="ws-side-foot"><ul class="ws-side-list"><li><a class="ws-side-link" href="\/\?tab=handbook"/);
});

test('account menu 내 할 일 and 저장한 메시지 close the dialog and operate the messenger',()=>{
  for(const panel of ['tasks','saved']){
    const f=shellFixture({memberships:[['SHIFT','instructor']]});
    assert.match(f.dialog(),new RegExp(`data-action="marin-workroom-panel"\\s+data-panel="${panel}"`));
    const overlay=f.element('div'),button=f.element('button');button.dataset={action:'marin-workroom-panel',panel};
    button.closest=selector=>selector==='[data-action]'?button:selector==='#overlay'?overlay:null;
    f.dispatch('click',button);
    assert.equal(f.context.closed,1,panel+': the account dialog closes first');
    assert.equal(f.state.tab,'messenger',panel+': the messenger opens');
    assert.equal(f.run('workspaceModule.open.panel'),panel,panel+': the messenger receives the panel to show');
  }
});

test('the inbox keeps its address, accepts only the six rooms and goes back to the office in one step',()=>{
  const f=fixture({withAccessEvents:true});f.state.tab='home';f.run('syncWorkspaceLocation()');
  const office=f.location.href;
  f.run("openWorkspaceInbox('lab')");
  assert.equal(f.location.pathname+f.location.search,'/?tab=home&section=inbox&room=lab');
  assert.equal(f.run('workspaceInbox.open'),true);assert.equal(f.run('workspaceInbox.room'),'lab');
  f.run('syncWorkspaceLocation()');assert.equal(f.location.searchParams.get('room'),'lab','sync keeps section and room');
  f.run("openWorkspaceInbox('');syncWorkspaceLocation()");assert.equal(f.location.searchParams.has('room'),false,'모든 내 차례 replaces the room without a new history step');
  f.run('closeWorkspaceInbox()');
  assert.equal(f.location.href,office,'back to the office address');assert.equal(f.run('workspaceInbox.open'),false);assert.equal(f.state.tab,'home');
  for(const [search,room] of [['?tab=home&section=inbox&room=path','path'],['?tab=home&section=inbox&room=evil',''],['?tab=home&section=inbox','']]){
    const g=fixture({url:'http://localhost:4191/'+search});g.state.tab='home';g.run('workspaceInboxFromLocation()');
    assert.equal(g.run('workspaceInbox.open'),true,search);assert.equal(g.run('workspaceInbox.room'),room,search);
  }
  const plain=fixture({url:'http://localhost:4191/?tab=home&room=lab'});plain.state.tab='home';plain.run('workspaceInboxFromLocation()');
  assert.equal(plain.run('workspaceInbox.open'),false,'room without section=inbox is ignored');
});

function turnFixture(){
  const f=shellFixture({memberships:[['SHIFT','instructor'],['PATH','counselor'],['PULSE','producer']],duties:['social']});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const day=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
  Object.assign(f.context,{
    tipSharesAllowed:()=>true,tipShares:{loading:false,loadedAt:Date.now(),triedAt:Date.now(),data:{rows:[{row:1,summary:'시안 하나',decidable:true,pending:null},{row:2,summary:'시안 둘',decidable:true,pending:null},{row:3,summary:'고른 시안',decidable:true,pending:{to:'버림',claimed:false}}]}},
    snsSimple:{data:{accounts:[{platform:'instagram',handle:'lab_korean',business:'LAB'}],tonight:[],health:{},problems:[]},error:'',loading:false},
    ssReviewSplit:()=>({waiting:[{postId:'p1',at:today+'T13:00',title:'LAB 게시물',plates:[{platform:'instagram',handle:'lab_korean'}]}],late:[{postId:'p2',at:today+'T09:00',title:'지난 게시물',plates:[{platform:'tiktok',handle:'synk'}]}]}),
  });
  f.run(`wa.mine={companies:['SHIFT','PATH'],items:[{id:'w1',company:'SHIFT',date:'${today}',title:'오늘 강의'},{id:'w2',company:'PATH',date:'${day(-2)}',title:'지난 상담'},{id:'w3',company:'PATH',date:'${day(30)}',title:'다음 달 상담'}]}`);
  return {f,today,day};
}
const workdayReply=(today,day)=>({today:{groups:{reply:[{id:'t1',title:'답할 일',dueDate:today}],review:[{id:'t2',title:'검토할 일',dueDate:day(-1)},{id:'t1',title:'답할 일',dueDate:today}]}},remaining:{groups:{upcoming:[{id:'t3',title:'이번 주 일',dueDate:day(3)},{id:'t4',title:'다음 달 일',dueDate:day(40)}]}}});

test('room counts add up to the inbox total; SNS reviews stay in 알아 둘 것 and out of every count',async()=>{
  const {f,today,day}=turnFixture();
  f.context.fetch=async()=>({ok:true,status:200,json:async()=>workdayReply(today,day)});
  const messenger=f.run('wsLoadMessenger()'),clients=f.run('wsLoadClients()');
  const request=f.requests.find(row=>row.path==='/api/client-workflow');
  request.resolve({items:[{id:'c1',group:'review',reviewerId:f.state.user.id,title:'편집본 확인',dueDate:day(-1)},{id:'c2',group:'reply',ownerId:'someone-else',title:'남의 일'},{id:'c3',group:'next',ownerId:f.state.user.id,title:'내 다음 일',dueDate:today}]});
  await messenger;await clients;
  const model=plain(f.run('workspaceTurnModel()'));
  const rooms=plain(f.run('WS_ROOMS.map(room=>room.id)'));
  const sum=rooms.reduce((total,room)=>total+f.run(`wsRoomCount(workspaceTurnModel(),${JSON.stringify(room)})`),0);
  assert.equal(model.total,2+2+3+2,'tips 2 + clients 2 + messenger 3 (week included) + schedule 2');
  assert.equal(sum,model.total,'the sum of room counts equals the inbox count');
  f.run("workspaceInbox.room='';workspaceInbox.filter='all'");assert.equal(f.run('wsInboxItems(workspaceTurnModel()).items.length'),model.total);
  for(const room of rooms){f.context.room=room;f.run('workspaceInbox.room=room');assert.equal(f.run('wsInboxItems(workspaceTurnModel()).items.length'),f.run('wsRoomCount(workspaceTurnModel(),room)'),room);}
  assert.equal(model.items.some(item=>item.group==='sns'),false,'SNS reviews are never counted as my turn');
  assert.deepEqual(model.notes.filter(note=>note.group==='sns').map(note=>note.room).sort(),['desk','lab'],'SNS notes go to the LAB room by account, others to the desk');
  const labels=[...f.run('wsOfficeRoomsHtml(workspaceTurnModel())').matchAll(/aria-label="[^"]* · 내 차례 (\d+)개"/g)].map(match=>Number(match[1]));
  assert.equal(labels.reduce((a,b)=>a+b,0),model.total,'the office picture shows the same total');
  assert.equal(f.run('workspaceTurnTotal()'),model.total,'the menu badge shows the same total');
});

test('a 403 hides that group, while 5xx, network failures and messenger 401 show 못 불러왔어요 without logging out',async()=>{
  for(const [kind,reply,expected] of [['messenger-403',{ok:false,status:403},'hidden'],['messenger-502',{ok:false,status:502},'failed'],['messenger-401',{ok:false,status:401},'failed'],['messenger-network',null,'failed']]){
    const {f}=turnFixture();
    f.context.fetch=async()=>{if(!reply)throw new TypeError('network');return {...reply,json:async()=>({})};};
    await f.run('wsLoadMessenger()');
    const model=plain(f.run('workspaceTurnModel()'));
    assert.equal(model.groups.messenger,expected,kind);
    const office=f.run('wsOfficeTurnHtml(workspaceTurnModel())');
    assert.equal(/data-action="ws-turn-retry" data-group="messenger"/.test(office.rest+office.lead),expected==='failed',kind+': retry only for failures');
    assert.ok(f.state.user,kind+': the company session stays');assert.equal(f.notifications.length,0,kind);
  }
  for(const [status,expected] of [[403,'hidden'],[500,'failed']]){
    const {f}=turnFixture();const pending=f.run('wsLoadClients()');
    f.requests.find(row=>row.path==='/api/client-workflow').reject(Object.assign(new Error('x'),{status}));await pending;
    assert.equal(plain(f.run('workspaceTurnModel()')).groups.clients,expected,'clients '+status);
  }
  // 권한 없는 무리는 API를 부르지 않는다.
  const shift=shellFixture({memberships:[['SHIFT','instructor']]});
  await shift.run('wsLoadClients()');assert.equal(shift.requests.filter(row=>row.path==='/api/client-workflow').length,0);
  assert.equal(plain(shift.run('workspaceTurnModel()')).groups.clients,'hidden');
});
