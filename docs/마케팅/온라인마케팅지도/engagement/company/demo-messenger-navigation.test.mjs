import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const demoSource=readFileSync(new URL('./public/demo-ui.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const workspaceSource=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const helpers=['const escape =','const validNumber =','const numberFormatter =','const number ='].map(prefix=>appSource.split('\n').find(line=>line.startsWith(prefix))).join('\n');
const initialUrl='http://localhost:4191/?tab=history&section=team&teamId=demo-team&demo=1&persona=crew-a&ownerId=demo-owner&connected=youtube#view=history&launch=old-token';
function fixture(href=initialUrl){
  const address=new URL(href),navigations=[],handlers=[],notifications=[],renders=[],requests=[];let ordinaryActions=0,mounts=0,polls=0,reports=0;
  const location={get href(){return address.href;},set href(value){address.href=new URL(value,address).href;navigations.push(address.href);},replace(value){address.href=new URL(value,address).href;navigations.push(address.href);},get origin(){return address.origin;},get pathname(){return address.pathname;},get search(){return address.search;},get hash(){return address.hash;}};
  const state={tab:'history',marketingView:'summary',scope:'team',teamId:'demo-team',user:{id:'demo-crew',role:'admin',name:'가상 크루',teamId:'demo-team'},data:{demo:{enabled:true,personaId:'crew-a',people:[]},channels:[]},report:{synthetic:true},reportRequest:1,authMode:'login',error:'',loading:false};
  const app={innerHTML:'',querySelectorAll:()=>[],contains:()=>false,querySelector:()=>null},document={activeElement:null,addEventListener:(type,handler,capture=false)=>handlers.push({type,handler,capture}),getElementById:()=>null,querySelector:()=>null};
  const context=vm.createContext({state,app,document,location,URL,URLSearchParams,Intl,cp:{view:'library'},renderedTab:'history',window:{addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false})},requestAnimationFrame:callback=>callback(),history:{replaceState(_a,_b,value){address.href=new URL(value,address).href;}},MutationObserver:class{observe(){}},crypto:{randomUUID:()=> 'test-share'},
    canManageTeam:()=>['admin','manager'].includes(state.user?.role),isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',
    icon:()=>'',searchIcon:()=>'',roleLabel:role=>role,busyRuns:()=>false,dateToday:()=> '2026-09-30',button:()=>'',notify:message=>notifications.push(message),shiftDate:(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10),
    render:()=>renders.push({tab:state.tab,userId:state.user?.id,demo:state.data?.demo?.enabled}),renderAuth:()=>renders.push({auth:true}),resetTeamOverview(){},startPolling:()=>polls++,reportTabs:()=>['overview','analysis','history'].includes(state.tab),loadReport:async()=>reports++,loadContentWorkspace:async()=>{throw new Error('messenger navigation must not load content');}});
  const run=code=>vm.runInContext(code,context);run(helpers+'\n'+workspaceSource+'\n'+demoSource);
  const target=(action='tab',disabled=false)=>({dataset:{action,tab:'messenger'},disabled,closest(selector){return selector==='[data-action]'?this:null;}});
  function dispatch(clicked){const event={target:clicked,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const listener of handlers.filter(row=>row.type==='click').sort((a,b)=>Number(b.capture)-Number(a.capture))){listener.handler(event);if(event.stopped)break;}return event;}
  handlers.push({type:'click',capture:false,handler:()=>ordinaryActions++});
  return{state,context,document,location,address,navigations,notifications,renders,requests,app,run,target,dispatch,ordinaryActions:()=>ordinaryActions,mounts:()=>mounts,polls:()=>polls,reports:()=>reports,installShell(){context.mountWorkspaceModule=()=>mounts++;run(appSource.slice(appSource.indexOf('function shell('),appSource.indexOf('function render()')));}};
}

function sidebarDom(f){
  const nodes=new Map(),make=()=>({hidden:false,inert:false,style:{},attrs:{},contains:()=>false,setAttribute(key,value){this.attrs[key]=String(value);},focus(){f.document.activeElement=this;}});
  for(const id of ['workspace-sidebar-content','workspace-sidebar-toggle','workspace-sidebar-scrim','main'])nodes.set(id,make());
  const shell=make();f.document.querySelector=selector=>selector==='.app-shell'?shell:null;f.document.getElementById=id=>nodes.get(id)||null;
  return{nodes,shell,get:id=>nodes.get(id)};
}

test('the messenger destination preserves the app path and removes every demo/filter/auth fragment',()=>{
  for(const pathname of ['/','/company/']){
    const f=fixture(initialUrl.replace('4191/','4191'+pathname)),destination=new URL(f.run('demoMessengerUrl()'),f.location.href);
    assert.equal(destination.origin,'http://localhost:4191');assert.equal(destination.pathname,pathname);assert.equal(destination.search,'?tab=messenger');assert.equal(destination.hash,'');
    assert.equal(f.navigations.length,0,'constructing the URL does not mutate the current page');
  }
});

test('teaching leaves demo before any classroom or company request and removes demo identity fragments',()=>{
  const f=fixture(),target=f.target();target.dataset.tab='teaching';
  const event=f.dispatch(target);assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.equal(f.ordinaryActions(),0);
  assert.equal(f.location.href,'http://localhost:4191/?tab=teaching');assert.equal(f.requests.length,0);
});

test('demo menu and quick-search messenger actions perform full navigation before ordinary app handlers',()=>{
  for(const action of ['tab','command-tab']){
    const f=fixture(),beforeUser=f.state.user,beforeData=f.state.data;f.context.clicked=f.target(action);
    assert.equal(f.run('demoAllowsAction(clicked.dataset.action,clicked)'),false,'general demo in-memory navigation remains restricted');
    const event=f.dispatch(f.context.clicked);assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.equal(f.ordinaryActions(),0);
    assert.deepEqual(f.navigations,['http://localhost:4191/?tab=messenger']);assert.equal(f.notifications.length,0);
    assert.equal(f.state.user,beforeUser);assert.equal(f.state.data,beforeData);assert.equal(f.state.tab,'history');assert.equal(f.renders.length,0,'the old demo persona is not mounted into the real messenger');
  }
});
test('workroom entries exit demo and reload the real account before personal work can open',async()=>{
 for(const action of ['tab','command-tab']){
  const f=fixture(),target=f.target(action);target.dataset.tab='workroom';const event=f.dispatch(target);
  assert.equal(event.stopped,true);assert.deepEqual(f.navigations,['http://localhost:4191/?tab=workroom']);assert.equal(f.renders.length,0);
 }
 const f=fixture('http://localhost:4191/?tab=workroom&demo=1&persona=crew-a#launch=obsolete');f.context.api=async path=>{f.requests.push(path);throw new Error('unexpected demo request');};
 f.run(appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()')));await f.run('initialize()');
 assert.deepEqual(f.navigations,['http://localhost:4191/?tab=workroom']);assert.deepEqual(f.requests,[]);
});

test('the actual demo shell exposes an enabled messenger entry with its real-account transition explained',()=>{
  const f=fixture();f.installShell();f.run("shell('<p>demo graph</p>')");
  const messenger=f.app.innerHTML.match(/<button\b[^>]*data-tab="messenger"[^>]*>/)?.[0];assert.ok(messenger);assert.doesNotMatch(messenger,/\bdisabled(?:\s|=|>)/);assert.match(messenger,/aria-description="[^"]*실제 계정[^"]*"/);
});

test('a fresh messenger page loads the real authenticated user and state before rendering its workspace',async()=>{
  const prior=fixture();prior.dispatch(prior.target());const f=fixture(prior.location.href);Object.assign(f.state,{user:null,data:null,report:null,scope:'mine',teamId:'',tab:'overview'});
  const realUser={id:'real-user',name:'실제 크루',role:'member',teamId:'real-team'};
  f.context.fetch=async(path,options)=>{f.requests.push({path,options});return{ok:true,status:200,json:async()=>path==='/api/me'?{user:realUser,csrfToken:'real-csrf'}:path==='/api/state'?{user:realUser,channels:[{id:'real-channel'}],teams:[{id:'real-team',active:true}]}:(()=>{throw new Error('unexpected fetch '+path);})()};};
  f.run(appSource.slice(appSource.indexOf('async function api('),appSource.indexOf('function notify(')));
  f.run(appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadReport()')));await f.run('initialize()');
  assert.deepEqual(f.requests.map(row=>row.path),['/api/me','/api/state']);assert.ok(f.requests.every(row=>row.options.headers['X-Synk-Demo']===undefined));assert.ok(f.requests.every(row=>row.options.credentials==='same-origin'));
  assert.equal(f.state.tab,'messenger');assert.equal(f.state.user.id,'real-user');assert.equal(f.state.csrf,'real-csrf');assert.equal(f.state.data.channels[0].id,'real-channel');assert.equal(f.state.data.demo,undefined);
  assert.deepEqual(f.renders,[{tab:'messenger',userId:'real-user',demo:undefined}]);assert.equal(f.state.initialized,true);assert.equal(f.polls(),1);assert.equal(f.reports(),0);
});

test('direct query and hash messenger destinations leave demo before making any API or launch request',async()=>{
  for(const suffix of ['?demo=1&persona=crew-a&tab=messenger#launch=obsolete','?demo=1&persona=crew-a#view=messenger&invite=obsolete']){
    const f=fixture('http://localhost:4191/'+suffix);f.context.api=async path=>{f.requests.push(path);throw new Error('a direct demo messenger link must redirect before fetching');};
    f.run(appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()')));await f.run('initialize()');
    assert.deepEqual(f.navigations,['http://localhost:4191/?tab=messenger']);assert.deepEqual(f.requests,[]);assert.deepEqual(f.renders,[]);assert.equal(f.state.tab,'history');
  }
});

test('messenger suppresses the demo entry banner so the workspace retains its full width',()=>{
  for(const url of [initialUrl,'http://localhost:4191/?tab=messenger']){
    const f=fixture(url);f.state.tab='messenger';f.state.data.demoAvailable=true;assert.equal(f.run('demoBanner()'),'');
    f.state.tab='overview';assert.notEqual(f.run('demoBanner()'),'','marketing keeps its demo entry or explanation');
  }
});

test('the explicit exit does not authorize demo writes, messenger APIs or disabled/unrelated actions',()=>{
  const f=fixture();assert.throws(()=>f.run("demoApiUrl('/messenger/api/bootstrap')"),/실제 데이터/);assert.throws(()=>f.run("demoApiUrl('/messenger/api/channels/x/messages','POST')"),/실제 자료/);assert.throws(()=>f.run("demoApiUrl('/api/channels','POST')"),/실제 자료/);
  for(const target of [f.target('tab',true),f.target('marketing-section'),{...f.target('tab'),dataset:{action:'tab',tab:'content'}},{...f.target('collect'),dataset:{action:'collect'}}]){const event=f.dispatch(target);assert.equal(event.stopped,true);}
  assert.equal(f.navigations.length,0);assert.equal(f.ordinaryActions(),0);
});

test('messenger navigation outside demo mode keeps the normal app handler and current URL',()=>{
  const f=fixture('http://localhost:4191/?tab=analysis&section=mine'),before=f.location.href;
  const event=f.dispatch(f.target());assert.equal(event.stopped,false);assert.equal(event.defaultPrevented,false);assert.equal(f.ordinaryActions(),1);assert.equal(f.location.href,before);assert.equal(f.navigations.length,0);
});

test('desktop context stays visible and preserves manual collapse around the menu-free messenger while the mobile menu closes on workspace entry',()=>{
  const initial=vm.runInNewContext(appSource.split('\n').find(line=>line.startsWith('const state ='))+'\nstate;', {dateToday:()=> '2026-09-30',shiftDate:()=> '2026-09-24'});
  assert.equal(initial.workspaceSidebarOpen,false);
  const f=fixture('http://localhost:4191/?tab=history'),dom=sidebarDom(f);f.state.workspaceSidebarOpen=initial.workspaceSidebarOpen;f.installShell();
  f.run("shell('<p>기존 분석</p>')");assert.equal(dom.get('workspace-sidebar-content').inert,false);assert.equal(dom.get('workspace-sidebar-toggle').attrs['aria-expanded'],'true');
  f.run('setWorkspaceSidebar(false)');assert.equal(f.mounts(),1,'manual collapse must not remount the page or messenger');assert.equal(f.renders.length,0);assert.equal(dom.get('workspace-sidebar-content').hidden,true);
  f.run("shell('<p>갱신된 분석</p>')");assert.equal(dom.get('workspace-sidebar-content').hidden,true,'desktop collapse survives background refresh');
  f.run("selectWorkspaceView('workroom');shell('<p>작업실</p>')");assert.equal(dom.get('workspace-sidebar-content').hidden,true,'desktop collapse survives navigation');
  f.run('setWorkspaceSidebar(true)');assert.equal(f.renders.length,0);assert.equal(dom.get('workspace-sidebar-content').hidden,false);assert.equal(dom.get('workspace-sidebar-toggle').attrs['aria-expanded'],'true');
  f.run("shell('<p>갱신된 분석</p>')");assert.equal(f.state.workspaceSidebarOpen,true);assert.equal(dom.shell.attrs['data-sidebar-open'],'true');
  f.run("selectWorkspaceView('messenger');shell(messengerWorkspacePage())");assert.equal(f.state.workspaceSidebarOpen,false);assert.equal(f.run('workspaceSidebarExpanded()'),false,'the conversation list is the messenger menu, so no duplicated context menu exists');
  assert.doesNotMatch(f.app.innerHTML,/id="workspace-sidebar/);assert.match(f.app.innerHTML,/<nav class="workspace-rail"[^>]*>(?:(?!<\/nav>)[\s\S])*data-tab="marketing"/,'desktop navigation remains available');assert.equal(dom.get('main').inert,false);
  f.run("selectWorkspaceView('marketing');shell('<p>분석으로 복귀</p>')");assert.equal(f.state.tab,'history');assert.equal(f.run('workspaceSidebarExpanded()'),true,'the desktop context returns as the user left it');
  f.run("setWorkspaceSidebar(false);selectWorkspaceView('messenger');shell(messengerWorkspacePage());selectWorkspaceView('marketing');shell('<p>분석으로 복귀</p>')");assert.equal(f.run('workspaceSidebarExpanded()'),false,'desktop collapse survives the messenger');assert.equal(dom.get('workspace-sidebar-content').hidden,true);
  f.run('setWorkspaceSidebar(true)');f.context.window.matchMedia=()=>({matches:true});f.run("selectWorkspaceView('workroom');shell('<p>작업실</p>')");assert.equal(dom.get('workspace-sidebar-content').hidden,true,'mobile defaults to a closed drawer');
  f.run("setWorkspaceSidebar(true);shell('<p>작업실 갱신</p>')");assert.equal(f.state.workspaceSidebarOpen,true,'refreshing the same workspace does not close the menu');assert.equal(dom.get('main').inert,true);
  f.run("selectWorkspaceView('messenger');shell(messengerWorkspacePage())");assert.equal(f.state.workspaceSidebarOpen,false);assert.equal(dom.get('main').inert,false,'entering the messenger closes the drawer and releases the page');
  f.run("selectWorkspaceView('marketing');shell('<p>분석으로 복귀</p>')");assert.equal(f.state.workspaceSidebarOpen,false);assert.equal(f.state.tab,'history');assert.equal(dom.get('workspace-sidebar-content').hidden,true);
});

test('sidebar toggles retain the hidden messenger frame without rendering and a stale open state never blocks the menu-free messenger',()=>{
  const f=fixture('http://localhost:4191/?tab=history'),dom=sidebarDom(f),messages=[];f.state.tab='history';
  const host={style:{},inert:true,hidden:true},frame={src:'/messenger/',contentWindow:{postMessage:(message,origin)=>messages.push({message,origin})}},slot={getBoundingClientRect:()=>({left:66,top:90,width:1134,height:700})};
  Object.assign(f.context,{persistedHost:host,persistedFrame:frame,persistedSlot:slot});f.run('Object.assign(workspaceModule,{host:persistedHost,frame:persistedFrame,slot:persistedSlot})');
  f.run('setWorkspaceSidebar(false)');assert.equal(dom.get('workspace-sidebar-content').hidden,true);assert.equal(host.inert,true);assert.deepEqual(host.style,{},'the hidden messenger frame keeps its place');assert.equal(dom.get('main').inert,false);
  f.run('setWorkspaceSidebar(true)');assert.equal(dom.get('workspace-sidebar-content').hidden,false);assert.equal(host.inert,true);assert.deepEqual(host.style,{});assert.equal(messages.at(-1).message.visible,false);
  f.document.activeElement={};f.context.window.matchMedia=()=>({matches:true});f.run('syncWorkspaceSidebar()');assert.equal(f.document.activeElement,dom.get('workspace-sidebar-toggle'),'page focus moves inside the mobile menu before the page becomes inert');assert.equal(dom.get('main').inert,true);assert.equal(dom.get('workspace-sidebar-scrim').hidden,false);assert.equal(host.inert,true);
  const modalInput={};dom.nodes.set('overlay',{children:[modalInput]});f.document.activeElement=modalInput;f.run('syncWorkspaceSidebar()');assert.equal(f.document.activeElement,modalInput,'an existing modal keeps its own focus');dom.nodes.delete('overlay');
  f.run('setWorkspaceSidebar(false)');assert.equal(dom.get('main').inert,false);assert.equal(dom.get('workspace-sidebar-scrim').hidden,true);assert.equal(f.document.activeElement,dom.get('workspace-sidebar-toggle'));
  f.state.tab='messenger';f.state.workspaceSidebarOpen=true;f.document.activeElement=frame;f.run('syncWorkspaceSidebar()');
  assert.equal(f.run('workspaceSidebarBlocksContent()'),false,'a stale open state cannot cover the messenger');assert.equal(dom.get('main').inert,false);assert.equal(f.document.activeElement,frame,'typing in the messenger keeps its focus');assert.equal(host.style.left,'66px');assert.equal(host.style.width,'1134px');
  assert.equal(f.run('workspaceModule.frame'),frame);assert.equal(f.run('workspaceModule.host'),host);assert.equal(frame.src,'/messenger/');assert.equal(f.renders.length,0);assert.equal(f.mounts(),0);assert.equal(f.app.innerHTML,'');
});

test('demo mode permits sidebar open and close actions without authorizing any API writes',()=>{
  const f=fixture();
  for(const action of ['workspace-sidebar-toggle','workspace-sidebar-close']){
    const target=f.target(action);assert.equal(f.run(`demoAllowsAction('${action}',{dataset:{}})`),true);
    const event=f.dispatch(target);assert.equal(event.defaultPrevented,false);assert.equal(event.stopped,false);
  }
  assert.equal(f.ordinaryActions(),2);assert.equal(f.navigations.length,0);assert.equal(f.notifications.length,0);
  assert.throws(()=>f.run("demoApiUrl('/api/channels','POST')"),/실제 자료/);
});

test('demo home entry fully reloads the real identity and strips persona, report filters and auth fragments',()=>{
  for(const action of ['tab','command-tab']){
    const f=fixture(),target=f.target(action);target.dataset.tab='home';const beforeUser=f.state.user;
    assert.equal(f.run('demoHomeUrl()'),'/?tab=home');assert.equal(f.navigations.length,0);
    assert.throws(()=>f.run("demoApiUrl('/api/assistant','POST')"),/실제 자료/,'an assistant request is blocked while the demo is active');const event=f.dispatch(target);
    assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.deepEqual(f.navigations,['http://localhost:4191/?tab=home']);assert.equal(f.ordinaryActions(),0);assert.equal(f.state.user,beforeUser);assert.equal(f.renders.length,0);
  }
});

test('direct demo home query and hash links redirect before any authentication or assistant request',async()=>{
  for(const suffix of ['?demo=1&persona=crew-a&tab=home#launch=obsolete','?demo=1&persona=crew-a#view=home&invite=obsolete']){
    const f=fixture('http://localhost:4191/'+suffix);f.context.api=async path=>{f.requests.push(path);throw new Error('redirect before requesting any data');};
    f.run(appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()')));await f.run('initialize()');
    assert.deepEqual(f.navigations,['http://localhost:4191/?tab=home']);assert.deepEqual(f.requests,[]);assert.deepEqual(f.renders,[]);
  }
});
