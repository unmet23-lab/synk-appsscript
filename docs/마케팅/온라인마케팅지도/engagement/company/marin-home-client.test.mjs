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
    window:{addEventListener:(type,handler)=>windowHandlers.push({type,handler}),scrollTo(){},matchMedia:()=>({matches:false})},history:{replaceState(_a,_b,url){location.href=new URL(url,location).href;}},MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:callback=>callback(),clearInterval(){},clearTimeout(){},setTimeout:callback=>{callback();return 1;},crypto:{randomUUID:()=> 'test-id'},
    isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',canManageTeam:()=>['admin','manager'].includes(state.user?.role),icon:()=>'',button:()=>'',dateToday:()=> '2026-09-30',shiftDate:(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10),
    render:()=>renders.push({tab:state.tab,userId:state.user?.id}),notify:message=>notifications.push(message),api(path,body,method){return new Promise((resolve,reject)=>requests.push({path,body,method,resolve,reject}));},
  });
  const run=source=>vm.runInContext(source,context);run(helpers+'\n'+workspaceSource+'\n'+demoSource+'\n'+homeSource);
  const dispatch=(type,target,props={})=>{const event={target,prevented:false,preventDefault(){this.prevented=true;},...props};for(const row of handlers.filter(row=>row.type===type))row.handler(event);return event;};
  return{state,context,location,document,nodes,handlers,windowHandlers,requests,renders,notifications,posted,created,storage,run,dispatch,element,home:run('marinHome')};
}

test('default entry is the Marine home while explicit marketing, messenger and saved-plan routes retain their destinations',()=>{
  const f=fixture();
  for(const input of [undefined,'home']){f.context.destination=input;f.run('selectWorkspaceView(destination)');assert.equal(f.state.tab,'home');}
  for(const [view,section,expected] of [['handbook','','handbook'],['workroom','','workroom'],['overview','mine','overview'],['analysis','team','analysis'],['history','all','history'],['messenger','','messenger'],['channels','','overview'],['studio','','content']]){
    f.context.destination={view,section};f.run('selectWorkspaceView(destination.view,destination.section)');assert.equal(f.state.tab,expected);
  }
  f.run("selectWorkspaceView('content','plan',undefined,'saved-plan');syncWorkspaceLocation()");assert.equal(f.location.searchParams.get('draftId'),'saved-plan');
  f.run("selectWorkspaceView('home');syncWorkspaceLocation()");assert.equal(f.state.tab,'home');assert.equal(f.location.searchParams.get('tab'),'home');assert.equal(f.location.searchParams.has('draftId'),false);
});

test('initial bare, query and hash routes load only the selected workspace after authentication',async()=>{
  const initialize=appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()'));
  for(const [suffix,tab,reports,content] of [['','home',0,0],['?tab=home','home',0,0],['?tab=workroom','workroom',0,0],['?tab=handbook','handbook',0,0],['?tab=messenger','messenger',0,0],['#view=messenger','messenger',0,0],['?tab=history&section=team&teamId=team-a','history',1,0],['#view=content&section=plan&draftId=saved-plan','content',0,1]]){
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

test('explicit marketing actions preserve permitted scope and load only that destination',async()=>{
  const f=fixture();let reports=0,plans=0;f.context.loadReport=async()=>reports++;f.context.loadContentWorkspace=async()=>plans++;f.run(appSource.split('\n').find(line=>line.startsWith('function reportTabs(')));f.run("ensureMarinSession();marinHome.entries=[{role:'assistant',text:'업무 찾기',actions:[{type:'marketing',label:'팀 현황',view:'history',section:'team',teamId:'team-a'},{type:'marketing',label:'새 기획',view:'content',section:'plan'}]}]");
  assert.equal(await f.run('dispatchMarinAction(0,0)'),true);assert.equal(f.state.tab,'history');assert.equal(f.state.scope,'team');assert.equal(f.state.teamId,'team-a');assert.equal(reports,1);assert.equal(plans,0);
  assert.equal(await f.run('dispatchMarinAction(0,1)'),true);assert.equal(f.state.tab,'content');assert.equal(f.run('cp.view'),'plan');assert.equal(reports,1);assert.equal(plans,1);assert.equal(f.requests.length,0);
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
  assert.equal(await home.run('dispatchMarinAction(0,0)'),true);assert.equal(home.location.href,'http://localhost:4191/?tab=workroom&section=tools&tool=weekly');assert.equal(home.requests.length,0);
});

test('a home refresh preserves the focused prompt and caret with teaching in the rail and guidance in settings',()=>{
  const f=fixture();f.run("ensureMarinSession();marinHome.draft='성과를 확인하고 싶어요'");const input=f.nodes.get('marin-input');input.value=f.home.draft;input.selectionStart=3;input.selectionEnd=5;input.focus();
  let markup='';const app={get innerHTML(){return markup;},set innerHTML(value){markup=value;const replacement=f.element('textarea');replacement.id='marin-input';f.nodes.set('marin-input',replacement);f.document.activeElement=null;},querySelectorAll:()=>[],contains:()=>true,querySelector:()=>null};
  Object.assign(f.context,{app,renderedTab:'home'});f.run(appSource.slice(appSource.indexOf('function shell('),appSource.indexOf('function render()')));f.run('shell(marinHomePage())');
  assert.equal(f.document.activeElement,f.nodes.get('marin-input'));assert.equal(f.nodes.get('marin-input').value,f.home.draft);assert.equal(f.nodes.get('marin-input').selectionStart,3);assert.equal(f.nodes.get('marin-input').selectionEnd,5);
  const rail=markup.match(/<nav class="workspace-rail"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.equal((rail.match(/<button[^>]*data-action="tab"/g)||[]).length,4);assert.match(rail,/data-tab="workroom"[\s\S]*data-tab="teaching"[\s\S]*data-tab="marketing"[\s\S]*data-tab="messenger"/);assert.doesNotMatch(rail,/data-tab="handbook"/);assert.doesNotMatch(markup,/id="workspace-sidebar(?:-toggle)?"|class="home-workspaces"|class="home-resume"|class="rail-account"/);assert.equal((markup.match(/data-action="marin-account"/g)||[]).length,1);assert.doesNotMatch(markup,/data-tab="settings"/);assert.equal(f.requests.length,0);
  const composing=f.nodes.get('marin-input');f.dispatch('compositionstart',composing);f.run('shell(marinHomePage())');assert.equal(f.nodes.get('marin-input'),composing,'an ongoing IME composition cannot be replaced by a background refresh');assert.equal(f.document.activeElement,composing);
});
