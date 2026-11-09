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

function fixture({url='http://localhost:4191/',storage=new Map()}={}){
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
  const context=vm.createContext({state,document,location,URL,URLSearchParams,Intl,Date,sessionStorage,localStorage:sessionStorage,cp:{view:'library'},
    window:{addEventListener:(type,handler)=>windowHandlers.push({type,handler}),scrollTo(){},matchMedia:()=>({matches:false})},history:{replaceState(_a,_b,url){location.href=new URL(url,location).href;}},MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:callback=>callback(),clearInterval(){},clearTimeout:id=>timers.delete(id),setTimeout:(callback,delay=0)=>{const id=nextTimer++;timers.set(id,{callback,delay});return id;},crypto:{randomUUID:()=> 'test-id'},
    isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',canManageTeam:()=>['admin','manager'].includes(state.user?.role),icon:()=>'',button:()=>'',dateToday:()=> '2026-09-30',shiftDate:(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10),
    render:()=>renders.push({tab:state.tab,userId:state.user?.id}),notify:message=>notifications.push(message),api(path,body,method){return new Promise((resolve,reject)=>requests.push({path,body,method,resolve,reject}));},
  });
  const run=source=>vm.runInContext(source,context);run(helpers+'\n'+workspaceSource+'\n'+demoSource+'\n'+homeSource);
  const dispatch=(type,target,props={})=>{const event={target,prevented:false,preventDefault(){this.prevented=true;},...props};for(const row of handlers.filter(row=>row.type===type))row.handler(event);return event;};
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

test('a home refresh preserves the focused prompt and caret with teaching in the rail and guidance in settings',()=>{
  const f=fixture();f.run("ensureMarinSession();marinHome.draft='성과를 확인하고 싶어요'");const input=f.nodes.get('marin-input');input.value=f.home.draft;input.selectionStart=3;input.selectionEnd=5;input.focus();
  let markup='';const app={get innerHTML(){return markup;},set innerHTML(value){markup=value;const replacement=f.element('textarea');replacement.id='marin-input';f.nodes.set('marin-input',replacement);f.document.activeElement=null;},querySelectorAll:()=>[],contains:()=>true,querySelector:()=>null};
  Object.assign(f.context,{app,renderedTab:'home'});f.run(appSource.slice(appSource.indexOf('function shell('),appSource.indexOf('function render()')));f.run('shell(marinHomePage())');
  assert.equal(f.document.activeElement,f.nodes.get('marin-input'));assert.equal(f.nodes.get('marin-input').value,f.home.draft);assert.equal(f.nodes.get('marin-input').selectionStart,3);assert.equal(f.nodes.get('marin-input').selectionEnd,5);
  const rail=markup.match(/<nav class="workspace-rail"[\s\S]*?<\/nav>/)?.[0]||'';
  // 11-06 새 판: 위 막대 없이 레일 하나 — 오늘 · 메신저 · 작업실 · SNS · 수업, 아래 찾기 · 계정(계정 메뉴 단추는 하나).
  assert.equal((rail.match(/<button[^>]*data-action="tab"/g)||[]).length,5);assert.match(rail,/data-tab="home"[\s\S]*data-tab="messenger"[\s\S]*data-tab="workroom"[\s\S]*data-tab="social"[\s\S]*data-tab="teaching"/);assert.match(rail,/data-action="command"[\s\S]*data-action="marin-account"/);assert.doesNotMatch(rail,/data-tab="handbook"/);assert.doesNotMatch(markup,/id="workspace-sidebar(?:-toggle)?"|class="home-workspaces"|class="home-resume"|class="rail-account"|class="workspace-appbar"/);assert.equal((markup.match(/data-action="marin-account"/g)||[]).length,1);assert.doesNotMatch(markup,/data-tab="settings"/);assert.equal(f.requests.length,0);
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
  assert.match(f.root.innerHTML,/추천을 모두 봤어요/);assert.match(f.root.innerHTML,/넘긴 업무는 그대로/);assert.doesNotMatch(f.root.innerHTML,/지금 내 차례인 일이 없어요/);
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
    {data:nextResponse({status:'partial',coverage:{messenger:{status:'ok'},client:{status:'error'},publication:{status:'ok'}}}).data,matches:[/일부 업무를 확인하지 못했어요/,/확인된 범위에서 추천해요/,/미확인: 고객 업무/,/합성 원본 제목/],absent:/지금 내 차례인 일이 없어요/},
    {data:nextResponse({status:'unknown',next:null,totalCount:0,coverage:{messenger:{status:'error'},client:{status:'error'},publication:{status:'error'}}}).data,matches:[/업무를 불러오지 못했어요/,/새로 확인/],absent:/지금 내 차례인 일이 없어요|추천을 모두 봤어요/},
    {data:nextResponse({status:'empty',next:null,totalCount:0}).data,matches:[/확인한 업무에 지금 내 차례인 일이 없어요/],absent:/업무를 불러오지 못했어요|추천을 모두 봤어요/},
    {data:nextResponse({status:'empty',next:null,totalCount:0,unavailableCount:2}).data,matches:[/담당·검토 크루를 확인해야 하는 업무 2개/,/전체 업무에서 확인/],absent:/추천을 모두 봤어요/},
    {data:nextResponse({status:'empty',next:null,totalCount:2,excludedCount:2}).data,matches:[/추천을 모두 봤어요/,/넘긴 업무는 그대로/],absent:/지금 내 차례인 일이 없어요/},
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
