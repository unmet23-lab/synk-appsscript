import {workspaceClientContext} from './workspace-access-test-context.mjs';
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
  const context=workspaceClientContext({state,app,document,location,URL,URLSearchParams,Intl,cp:{view:'library'},renderedTab:'history',window:{addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false})},requestAnimationFrame:callback=>callback(),history:{replaceState(_a,_b,value){address.href=new URL(value,address).href;}},MutationObserver:class{observe(){}},crypto:{randomUUID:()=> 'test-share'},
    canManageTeam:()=>['admin','manager'].includes(state.user?.role),isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',
    icon:()=>'',searchIcon:()=>'',roleLabel:role=>role,busyRuns:()=>false,dateToday:()=> '2026-09-30',button:()=>'',notify:message=>notifications.push(message),shiftDate:(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10),
    render:()=>renders.push({tab:state.tab,userId:state.user?.id,demo:state.data?.demo?.enabled}),renderAuth:()=>renders.push({auth:true}),resetTeamOverview(){},startPolling:()=>polls++,reportTabs:()=>['overview','analysis','history'].includes(state.tab),loadReport:async()=>reports++,loadContentWorkspace:async()=>{throw new Error('messenger navigation must not load content');}});
  const run=code=>vm.runInContext(code,context);run(helpers+'\n'+workspaceSource+'\n'+demoSource);
  const target=(action='tab',disabled=false)=>({dataset:{action,tab:'messenger'},disabled,closest(selector){return selector==='[data-action]'?this:null;}});
  function dispatch(clicked){const event={target:clicked,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const listener of handlers.filter(row=>row.type==='click').sort((a,b)=>Number(b.capture)-Number(a.capture))){listener.handler(event);if(event.stopped)break;}return event;}
  handlers.push({type:'click',capture:false,handler:()=>ordinaryActions++});
  return{state,context,document,location,address,navigations,notifications,renders,requests,app,run,target,dispatch,ordinaryActions:()=>ordinaryActions,mounts:()=>mounts,polls:()=>polls,reports:()=>reports,installShell(){context.mountWorkspaceModule=()=>mounts++;run(appSource.slice(appSource.indexOf('function shell('),appSource.indexOf('function render()')));}};
}

function toolsDrawerDom(f){
  const nodes=new Map(),make=()=>({hidden:false,inert:false,style:{},attrs:{},contains:()=>false,setAttribute(key,value){this.attrs[key]=String(value);},focus(){f.document.activeElement=this;}});
  for(const id of ['ws-tools-drawer','ws-tools-toggle','ws-tools-scrim','main'])nodes.set(id,make());
  const entry=make();nodes.set('entry',entry);nodes.get('ws-tools-drawer').querySelector=()=>entry;nodes.get('ws-tools-drawer').contains=node=>node===entry;
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
  const messenger=f.app.innerHTML.match(/<button\b[^>]*data-tab="messenger"[^>]*>/)?.[0];assert.ok(messenger);assert.doesNotMatch(messenger,/\bdisabled(?:\s|=|>)/);assert.match(f.app.innerHTML,/<section\b[^>]*data-tools-group="primary" aria-label="실제 공간으로 이동">(?:(?!<\/section>)[\s\S])*data-tab="messenger"/);assert.match(f.app.innerHTML,/실제 공간으로 나가기/);
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
    f.state.tab='overview';const banner=f.run('demoBanner()');if(f.location.search.includes('demo=1'))assert.notEqual(banner,'','the demo itself keeps its explanation');else assert.equal(banner,'','10-24: the graph demo entry is gone outside the demo address');
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

test('the tools drawer opens on request, survives a refresh, and closes on navigation while restoring focus',()=>{
  const initial=vm.runInNewContext(appSource.split('\n').find(line=>line.startsWith('const state ='))+'\nstate;', {dateToday:()=> '2026-09-30',shiftDate:()=> '2026-09-24'});
  assert.equal(initial.workspaceToolsOpen,false);
  const f=fixture('http://localhost:4191/?tab=history&demo=1'),dom=toolsDrawerDom(f);f.state.workspaceToolsOpen=false;f.installShell();
  f.run("shell('<p>기존 분석</p>')");assert.equal(dom.get('ws-tools-drawer').hidden,true);assert.equal(dom.get('ws-tools-drawer').inert,true);assert.equal(dom.get('main').inert,false);
  f.run('setWorkspaceToolsOpen(true)');assert.equal(dom.get('ws-tools-drawer').hidden,false);assert.equal(dom.get('ws-tools-drawer').inert,false);assert.equal(dom.get('ws-tools-toggle').attrs['aria-expanded'],'true');assert.equal(dom.get('main').inert,true);assert.equal(f.document.activeElement,dom.get('entry'));assert.equal(f.mounts(),1);assert.equal(f.renders.length,0);
  f.run("shell('<p>갱신된 분석</p>')");assert.equal(f.state.workspaceToolsOpen,true);assert.equal(dom.shell.attrs['data-tools-open'],'true');
  f.run('setWorkspaceToolsOpen(false)');assert.equal(f.document.activeElement,dom.get('ws-tools-toggle'));assert.equal(dom.get('main').inert,false);assert.equal(dom.get('ws-tools-scrim').hidden,true);
  for(const tab of ['workroom','messenger','marketing']){f.run('setWorkspaceToolsOpen(true)');f.run('selectWorkspaceView('+JSON.stringify(tab)+')');f.run('syncWorkspaceToolsDrawer()');assert.equal(f.state.workspaceToolsOpen,false);assert.equal(dom.get('ws-tools-drawer').hidden,true);assert.equal(dom.get('main').inert,false);}
});

test('tools toggles preserve the persistent messenger frame, block its background while open and retain draft focus after closure',()=>{
  const f=fixture('http://localhost:4191/?tab=history'),dom=toolsDrawerDom(f),messages=[];f.state.tab='history';
  const host={style:{},classList:{add(){},remove(){}},inert:true,hidden:true},frame={src:'/messenger/',draft:'unsent private message',contentWindow:{postMessage:(message,origin)=>messages.push({message,origin})}},slot={getBoundingClientRect:()=>({left:66,top:90,width:1134,height:700})};
  Object.assign(f.context,{persistedHost:host,persistedFrame:frame,persistedSlot:slot});f.run('Object.assign(workspaceModule,{host:persistedHost,frame:persistedFrame,slot:persistedSlot})');
  f.run('setWorkspaceToolsOpen(false)');assert.equal(host.inert,true);assert.deepEqual(host.style,{});assert.equal(dom.get('main').inert,false);
  f.run('setWorkspaceToolsOpen(true)');assert.equal(host.inert,true);assert.equal(dom.get('main').inert,true);assert.equal(messages.at(-1).message.visible,false);assert.equal(f.document.activeElement,dom.get('entry'));
  const modalInput={};dom.nodes.set('overlay',{children:[modalInput]});f.document.activeElement=modalInput;f.run('syncWorkspaceToolsDrawer()');assert.equal(f.document.activeElement,modalInput);dom.nodes.delete('overlay');
  f.run('setWorkspaceToolsOpen(false)');f.state.tab='messenger';f.state.workspaceSidebarOpen=true;f.document.activeElement=frame;f.run('syncWorkspaceToolsDrawer()');assert.equal(f.run('workspaceBlocksBackground()'),false);assert.equal(dom.get('main').inert,false);assert.equal(host.inert,false);assert.equal(f.document.activeElement,frame);
  f.run('setWorkspaceToolsOpen(true)');assert.equal(host.inert,true);assert.equal(messages.at(-1).message.visible,false);f.run('setWorkspaceToolsOpen(false)');assert.equal(host.inert,false);assert.equal(messages.at(-1).message.visible,true);
  assert.equal(f.run('workspaceModule.frame'),frame);assert.equal(f.run('workspaceModule.host'),host);assert.equal(frame.src,'/messenger/');assert.equal(frame.draft,'unsent private message');assert.equal(host.style.left,'66px');assert.equal(host.style.width,'1134px');assert.equal(f.renders.length,0);assert.equal(f.mounts(),0);assert.equal(f.app.innerHTML,'');
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
