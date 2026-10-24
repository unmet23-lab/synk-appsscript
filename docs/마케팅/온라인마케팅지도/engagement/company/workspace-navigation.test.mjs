import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const teamOverviewSource=readFileSync(new URL('./public/team-overview.js',import.meta.url),'utf8');
const demoSource=readFileSync(new URL('./public/demo-ui.js',import.meta.url),'utf8');
const workroomSource=readFileSync(new URL('./public/workroom.js',import.meta.url),'utf8');
function fixture(role='admin'){
  const resizeHandlers=[],messageHandlers=[],windowHandlers=new Map(),documentHandlers=new Map(),state={user:{id:'tester',role},tab:'overview',marketingView:'summary',scope:'mine',teamId:'',reportRequest:0},cp={view:'library'},location=new URL('http://localhost:4191/');
  const context=vm.createContext({state,cp,location,URL,URLSearchParams,
    canManageTeam:()=>['admin','manager'].includes(state.user?.role),isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',
    window:{addEventListener(type,handler){if(type==='resize')resizeHandlers.push(handler);if(type==='message')messageHandlers.push(handler);windowHandlers.set(type,[...(windowHandlers.get(type)||[]),handler]);},scrollTo(){}},document:{hidden:false,addEventListener(type,handler){documentHandlers.set(type,[...(documentHandlers.get(type)||[]),handler]);},getElementById(){return null;}},
    MutationObserver:class{observe(){}},history:{replaceState(_a,_b,value){location.href=new URL(value,location).href;}},
    crypto:{randomUUID:()=> 'test-share'},render(){},icon:()=>'',
  });
  vm.runInContext(source+'\n'+demoSource,context);return{state,cp,location,context,run:s=>vm.runInContext(s,context),resize(){for(const handler of resizeHandlers)handler();},message:event=>Promise.all(messageHandlers.map(handler=>handler(event))),windowEvent:(type,event={})=>Promise.all((windowHandlers.get(type)||[]).map(handler=>handler(event))),documentEvent:(type,event={})=>Promise.all((documentHandlers.get(type)||[]).map(handler=>handler(event)))};
}

test('an initial stalled messenger keeps recovering after the first two attempts and clears recovery after ready/logout',async()=>{
  const f=fixture(),timers=new Map(),status={textContent:''},standalone={hidden:true},host={style:{},remove(){this.removed=true;}},posts=[],frame={contentWindow:{postMessage:message=>posts.push(message)}};let sequence=0,navigations=0;
  Object.defineProperty(frame,'src',{get:()=>'/messenger/',set:value=>{assert.equal(value,'/messenger/');navigations++;}});
  const loading={hidden:false,setAttribute(){},querySelector:selector=>selector==='[role="status"]'?status:standalone},slot={setAttribute(){},querySelector:()=>loading};
  const delays=[];
  Object.assign(f.context,{setTimeout(callback,ms){assert.ok([12000,29000,1000].includes(ms));delays.push(ms);timers.set(++sequence,callback);return sequence;},clearTimeout:id=>timers.delete(id),clearInterval(){},host,frame});
  const tick=()=>{const next=timers.keys().next().value,callback=timers.get(next);timers.delete(next);callback();};
  f.context.document.getElementById=id=>id==='messenger-module-slot'?slot:null;
  f.run('workspaceModule.host=host;workspaceModule.frame=frame;startWorkspaceModuleLoading();syncWorkspaceLoading()');
  assert.equal(standalone.hidden,true);assert.equal(host.style.visibility,'hidden');
  tick();assert.equal(posts.at(-1).type,'workspace:ready-check');assert.equal(navigations,0);
  tick();assert.equal(navigations,1);assert.match(status.textContent,/다시 시도/);assert.equal(standalone.hidden,true);
  tick();tick();assert.equal(navigations,2);
  tick();tick();assert.equal(navigations,3);assert.equal(timers.size,1);assert.equal(standalone.hidden,false);assert.match(status.textContent,/늦어지고/);
  for(let attempt=0;attempt<4;attempt++){tick();tick();}
  assert.equal(navigations,7);assert.equal(timers.size,1);assert.deepEqual(delays.slice(0,4),[12000,1000,12000,1000]);assert.ok(delays.slice(4).every(delay=>delay===29000||delay===1000));
  await f.message({origin:f.location.origin,source:frame.contentWindow,data:{type:'messenger:ready'}});
  assert.equal(host.style.visibility,'');assert.equal(loading.hidden,true);assert.equal(standalone.hidden,true);assert.equal(f.run('workspaceModule.frame'),frame);
  f.run('retryWorkspaceModule()');assert.equal(frame.src,'/messenger/');assert.equal(loading.hidden,false);assert.equal(standalone.hidden,true);
  await f.message({origin:f.location.origin,source:frame.contentWindow,data:{type:'messenger:ready'}});assert.equal(timers.has(sequence),false);
  f.run('retryWorkspaceModule()');
  const stale=timers.get(sequence);f.run('resetWorkspaceModule()');assert.equal(host.removed,true);assert.equal(timers.has(sequence),false);
  stale();assert.equal(f.run('workspaceModule.loadDelayed'),false);
});

test('a repeated ready handshake and an active call both prevent initial recovery from navigating the frame',async()=>{
  for(const activeCall of [false,true]){
    const f=fixture(),timers=new Map(),frame={contentWindow:{postMessage(){}}};let sequence=0;
    Object.assign(f.context,{setTimeout:callback=>{timers.set(++sequence,callback);return sequence;},clearTimeout:id=>timers.delete(id),clearInterval(){},frame});
    const tick=()=>{const id=timers.keys().next().value,callback=timers.get(id);timers.delete(id);callback();};
    f.run('workspaceModule.frame=frame;startWorkspaceModuleLoading()');tick();
    if(activeCall){f.run("workspaceModule.voice={call:{phase:'connected'}}");tick();}
    else{await f.message({origin:f.location.origin,source:frame.contentWindow,data:{type:'messenger:ready'}});assert.equal(timers.size,0);}
    assert.equal(frame.src,undefined);assert.equal(f.run('workspaceModule.loadRetries'),0);
  }
});

function initialLoadFixture(){
  const f=fixture(),timers=new Map(),posts=[],frame={contentWindow:{postMessage:message=>posts.push(message)}};let sequence=0,navigations=0;
  Object.defineProperty(frame,'src',{get:()=>'/messenger/',set:value=>{assert.equal(value,'/messenger/');navigations++;}});
  Object.assign(f.context,{setTimeout(callback,ms){timers.set(++sequence,{callback,ms});return sequence;},clearTimeout:id=>timers.delete(id),clearInterval(){},frame});
  f.run('workspaceModule.frame=frame;refreshWorkspaceSummary=async()=>{};renderWorkspaceCall=()=>{}');
  return Object.assign(f,{timers,posts,frame,navigations:()=>navigations,tick(){assert.equal(timers.size,1,'one recovery timer must remain');const id=timers.keys().next().value,item=timers.get(id);timers.delete(id);item.callback();return item.ms;}});
}

test('hidden and offline documents pause initial recovery and resume with a ready handshake without a button',async()=>{
  const f=initialLoadFixture();f.context.navigator={onLine:true};f.context.document.hidden=true;
  f.run('startWorkspaceModuleLoading()');assert.equal(f.timers.size,0);assert.equal(f.navigations(),0);
  f.context.document.hidden=false;await f.documentEvent('visibilitychange');assert.equal(f.tick(),0);assert.equal(f.posts.at(-1).type,'workspace:ready-check');
  const stale=f.timers.values().next().value.callback;
  f.context.document.hidden=true;await f.documentEvent('visibilitychange');assert.equal(f.timers.size,0);stale();assert.equal(f.navigations(),0);
  f.context.navigator.onLine=false;f.context.document.hidden=false;await f.documentEvent('visibilitychange');assert.equal(f.timers.size,0);
  f.context.navigator.onLine=true;await f.windowEvent('online');const resumedTimer=f.run('workspaceModule.loadTimer');stale();assert.equal(f.run('workspaceModule.loadTimer'),resumedTimer);assert.equal(f.navigations(),0);assert.equal(f.tick(),0);assert.equal(f.tick(),1000);assert.equal(f.navigations(),1);
  f.context.navigator.onLine=false;await f.windowEvent('offline');assert.equal(f.timers.size,0);
  f.context.navigator.onLine=true;await f.windowEvent('online');assert.equal(f.tick(),0);
  await f.message({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:ready'}});assert.equal(f.timers.size,0);
  await f.windowEvent('online');await f.documentEvent('visibilitychange');assert.equal(f.timers.size,0);assert.equal(f.navigations(),1);
});

test('active calls and logout cancel initial recovery even when a timeout callback was already queued',async()=>{
  const f=initialLoadFixture();f.run('startWorkspaceModuleLoading()');f.tick();const stale=f.timers.values().next().value.callback;
  await f.message({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:voice',voice:{call:{phase:'connected'}}}});
  assert.equal(f.timers.size,0);stale();assert.equal(f.navigations(),0);
  await f.windowEvent('online');await f.documentEvent('visibilitychange');assert.equal(f.timers.size,0);
  await f.message({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:voice',voice:null}});
  assert.equal(f.tick(),0);assert.equal(f.tick(),1000);assert.equal(f.navigations(),1);
  const loggedOut=f.timers.values().next().value.callback;f.state.user=null;f.run('resetWorkspaceModule()');assert.equal(f.timers.size,0);
  loggedOut();await f.windowEvent('online');await f.documentEvent('visibilitychange');assert.equal(f.navigations(),1);assert.equal(f.timers.size,0);
});

test('page lifecycle clears recovery work and resumes only an unfinished initial document',async()=>{
  const f=initialLoadFixture();f.run('startWorkspaceModuleLoading()');await f.windowEvent('pagehide');assert.equal(f.timers.size,0);
  await f.windowEvent('pageshow',{persisted:true});assert.equal(f.tick(),0);assert.equal(f.tick(),1000);assert.equal(f.navigations(),1);
  await f.message({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:ready'}});
  await f.windowEvent('pagehide');await f.windowEvent('pageshow',{persisted:true});assert.equal(f.timers.size,0);assert.equal(f.navigations(),1);
});

function withWorkroom(f){
  const storage=new Map();
  Object.assign(f.context,{sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},makerTools:{view:'publish'},makerToolsReset(){f.context.makerTools.view='publish';},setTimeout(){return 1;},clearTimeout(){}});
  vm.runInContext(workroomSource,f.context,{filename:'workroom.js'});return f;
}

test('workroom sections use canonical URLs and survive a fresh identity after reload',()=>{
  for(const section of ['desk','trends','tools','pages']){
    const f=withWorkroom(fixture());f.run('wrIdentity()');f.context.section=section;f.run("selectWorkspaceView('workroom',section);syncWorkspaceLocation()");
    assert.equal(f.state.tab,'workroom');assert.equal(f.run('wr.view'),section);assert.equal(f.location.searchParams.get('tab'),'workroom');assert.equal(f.location.searchParams.get('section'),section);
    const restored=withWorkroom(fixture());restored.location.href=f.location.href;restored.context.requested={tab:restored.location.searchParams.get('tab'),section:restored.location.searchParams.get('section')};
    restored.run('selectWorkspaceView(requested.tab,requested.section);wrIdentity();syncWorkspaceLocation()');
    assert.equal(restored.state.tab,'workroom');assert.equal(restored.run('wr.view'),section);assert.equal(restored.location.searchParams.get('section'),section);
  }
});

test('all production tools reload to their own view and returning from another workspace retains the choice',()=>{
  for(const tool of ['publish','subtitles','sources']){
    const f=withWorkroom(fixture());f.location.search=new URLSearchParams({tab:'workroom',section:'tools',tool,teamId:'old-team',draftId:'old-draft'}).toString();
    f.run("selectWorkspaceView('workroom','tools');wrIdentity();syncWorkspaceLocation()");
    assert.equal(f.run('wr.view'),'tools');assert.equal(f.context.makerTools.view,tool);assert.equal(f.location.searchParams.get('tool'),tool);assert.equal(f.location.searchParams.has('teamId'),false);assert.equal(f.location.searchParams.has('draftId'),false);
    f.run("selectWorkspaceView('home');syncWorkspaceLocation()");assert.equal(f.location.searchParams.has('section'),false);assert.equal(f.location.searchParams.has('tool'),false);
    f.run("selectWorkspaceView('workroom');wrIdentity();syncWorkspaceLocation()");assert.equal(f.run('wr.view'),'tools');assert.equal(f.context.makerTools.view,tool);assert.equal(f.location.searchParams.get('section'),'tools');assert.equal(f.location.searchParams.get('tool'),tool);
  }
});

test('leaving tools removes a stale tool parameter while invalid workroom sections do not select another screen',()=>{
  const f=withWorkroom(fixture());f.location.search='?tab=workroom&section=tools&tool=subtitles';f.run("selectWorkspaceView('workroom','tools');wrIdentity();syncWorkspaceLocation()");
  f.run("selectWorkspaceView('workroom','trends');syncWorkspaceLocation()");assert.equal(f.location.searchParams.get('section'),'trends');assert.equal(f.location.searchParams.has('tool'),false);
  f.run("selectWorkspaceView('workroom','unknown');syncWorkspaceLocation()");assert.equal(f.run('wr.view'),'trends');assert.equal(f.location.searchParams.get('section'),'trends');assert.equal(f.state.tab,'workroom');
});

test('resize before the app state script loads does not break workspace initialization',()=>{
  const f=fixture();delete f.context.state;
  assert.doesNotThrow(()=>f.resize());
  f.context.state=f.state;f.state.tab='home';assert.doesNotThrow(()=>f.resize());
});

test('only daily work is in primary navigation; management remains role scoped',()=>{
  for(const [role,count] of [['admin',3],['manager',2],['member',1],['viewer',1]]){
    const f=fixture(role);assert.deepEqual(Array.from(f.run('workspacePrimaryTabs.map(row=>row[0])')),['workroom','teaching','social','messenger']);
    assert.equal(f.run('workspaceUtilityTabs().length'),count);
  }
});

test('teaching has a canonical direct entry without leaking marketing filters into classroom links',()=>{
  const f=fixture('member');f.location.search='?tab=workroom&section=tools&tool=subtitles&draftId=old';
  f.run("selectWorkspaceView('teaching');syncWorkspaceLocation()");
  assert.equal(f.state.tab,'teaching');assert.equal(f.location.searchParams.get('tab'),'teaching');
  for(const key of ['section','tool','draftId'])assert.equal(f.location.searchParams.has(key),false);
  f.run("selectWorkspaceView('messenger');selectWorkspaceView('teaching');syncWorkspaceLocation()");
  assert.equal(f.location.searchParams.get('tab'),'teaching');
});

test('company guidance is accessible through settings for every role and retains its direct URL without a sidebar',()=>{
  const f=fixture('viewer');f.state.workspaceSidebarOpen=true;f.run("selectWorkspaceView('handbook');syncWorkspaceLocation()");
  assert.equal(f.state.tab,'handbook');assert.equal(f.state.workspaceSidebarOpen,false);assert.equal(f.location.searchParams.get('tab'),'handbook');assert.equal(f.location.searchParams.has('section'),false);
  assert.equal(f.run('workspacePrimaryView()'),'handbook');
  assert.equal(f.run('workspaceHasContextMenu()'),false);
  for(const role of ['admin','manager','member','viewer']){
    const crew=fixture(role);assert.ok(crew.run("workspaceUtilityTabs().some(row=>row[0]==='handbook')"));
    crew.run("selectWorkspaceView('handbook')");assert.equal(crew.state.tab,'handbook');
  }
});

test('navigation does not consume authentication links or share as viewer',()=>{
  const f=fixture('viewer');f.location.hash='launch=one-time-token';const before=f.location.href;
  f.run('syncWorkspaceLocation();shareWorkspaceView()');assert.equal(f.location.href,before);assert.equal(f.run('workspaceModule.share'),null);
  f.location.hash='view=studio';f.run("selectWorkspaceView('studio');syncWorkspaceLocation()");assert.equal(f.location.hash,'');assert.equal(f.location.searchParams.get('tab'),'content');
});

test('OAuth result cleanup preserves the channel-management destination for reload',async()=>{
  const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
  const initialize=appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()'));
  for(const outcome of ['connected=youtube','connectionError=temporary']){
    const f=fixture();f.location.search='?'+outcome;let section='';
    Object.assign(f.context,{socialWorkspaceSetView:value=>{section=value;},socialWorkspaceSection:()=>section,api:async()=>({user:f.state.user,csrfToken:'test-csrf'}),loadState:async()=>f.run('syncWorkspaceLocation()'),loadReport:async()=>{},reportTabs:()=>true,startPolling(){},notify(){},render(){if(['channels','collection','studio'].includes(f.state.tab))f.run('selectWorkspaceView(state.tab)');f.run('syncWorkspaceLocation()');}});
    f.run(initialize);await f.run('initialize()');
    assert.equal(f.state.tab,'social');assert.equal(f.run('socialWorkspaceSection()'),'accounts','수집 연결 뒤에는 SNS 계정 화면(옛 채널·수집)');
    assert.equal(f.location.searchParams.get('tab'),'social');assert.equal(f.location.searchParams.get('section'),'accounts');
    assert.equal(f.location.searchParams.has('connected'),false);assert.equal(f.location.searchParams.has('connectionError'),false);
  }
});

test('team normalization preserves a valid choice and falls back only to allowed active teams',()=>{
  const f=fixture();f.location.search='?demo=1';f.state.scope='team';f.state.teamId='from-link';
  f.run('normalizeMarketingScope()');assert.equal(f.state.teamId,'from-link','wait for state before rejecting a shared team');
  f.state.user.teamId='own';f.state.data={teams:[{id:'first'},{id:'own'},{id:'stopped',active:false}]};
  f.run('normalizeMarketingScope()');assert.equal(f.state.teamId,'own');
  f.state.teamId='first';f.run('normalizeMarketingScope()');assert.equal(f.state.teamId,'first');
  f.state.user.teamId=null;f.state.teamId='stopped';f.run('normalizeMarketingScope()');assert.equal(f.state.teamId,'first');
  f.state.user.role='member';f.state.user.teamId='own';f.run('normalizeMarketingScope()');assert.equal(f.state.teamId,'own');
  f.state.user.teamId=null;f.run('normalizeMarketingScope()');assert.equal(f.state.teamId,'');assert.equal(f.state.scope,'team');
  f.state.user.role='admin';f.state.data.teams=[];f.run('normalizeMarketingScope()');assert.equal(f.state.teamId,'');
  f.state.scope='all';f.state.teamId='legacy';assert.equal(f.run('marketingScope()'),'team');
  f.run("selectWorkspaceView('overview','summary')");assert.equal(f.state.scope,'all');assert.equal(f.state.teamId,'');
  f.run('selectWorkspaceView(null)');assert.equal(f.state.tab,'home');assert.equal(f.state.scope,'all','the home preserves the previous marketing scope for a return visit');
});

test('social sections use one canonical workspace entry and preserve legacy analytics routes',()=>{
  const f=fixture();let section='overview';
  f.context.socialWorkspaceSection=()=>section;f.context.socialWorkspaceSetView=value=>{if(['today','results','accounts','inbox','fix'].includes(value))section=value;};
  for(const view of ['today','results','accounts','inbox','fix']){f.context.socialSection=view;f.run("selectWorkspaceView('social',socialSection);syncWorkspaceLocation()");assert.equal(f.state.tab,'social');assert.equal(f.location.searchParams.get('tab'),'social');assert.equal(f.location.searchParams.get('section'),view);assert.equal(f.run('workspacePrimaryView()'),'social');}
  f.run("selectWorkspaceView('analysis')");assert.equal(f.state.tab,'social');assert.equal(section,'results','옛 성과 분석 주소는 SNS 성과로');
});


function pendingDocumentFixture(readyState='interactive',url='http://localhost:4191/messenger/'){
  const f=initialLoadFixture();let now=1000;
  f.context.Date={now:()=>now};f.frame.contentDocument={readyState,location:new URL(url)};
  return Object.assign(f,{advance(ms){now+=ms;},clock(){return now;},next(){const delay=f.timers.values().next().value.ms;now+=delay;f.tick();return delay;}});
}
test('a slow same-origin messenger module keeps its document while ready checks continue',async()=>{
  for(const state of ['loading','interactive']){
    const f=pendingDocumentFixture(state);f.run('startWorkspaceModuleLoading()');
    f.next();f.next();assert.equal(f.navigations(),0);assert.equal(f.posts.at(-1).type,'workspace:ready-check');assert.equal(f.run('workspaceModule.loadDelayed'),true);
    assert.equal(f.run('workspaceModule.loadStartedAt'),1000);
    await f.message({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:ready'}});
    assert.equal(f.timers.size,0);assert.equal(f.navigations(),0);
  }
});
test('an unfinished messenger document cannot extend its loading grace beyond sixty seconds',()=>{
  const f=pendingDocumentFixture();f.run('startWorkspaceModuleLoading()');
  for(let check=0;check<4;check++){f.next();f.next();assert.equal(f.navigations(),0);}
  assert.equal(f.clock(),53000);assert.equal(f.next(),7000);assert.equal(f.navigations(),0);assert.equal(f.next(),1000);
  assert.equal(f.clock(),61000);assert.equal(f.navigations(),1);assert.equal(f.run('workspaceModule.loadStartedAt'),61000);
});
test('completed failures, about blank, foreign pages and inaccessible frames retain initial recovery',()=>{
  for(const [state,url,throws] of [['complete','http://localhost:4191/messenger/',false],['loading','about:blank',false],['loading','https://elsewhere.example/messenger/',false],['loading','http://localhost:4191/other',false],['loading','http://localhost:4191/messenger/',true]]){
    const f=pendingDocumentFixture(state,url);if(throws)Object.defineProperty(f.frame,'contentDocument',{get(){throw new Error('inaccessible document');}});
    f.run('startWorkspaceModuleLoading()');f.next();f.next();assert.equal(f.navigations(),1);
  }
});
test('hidden and online recovery do not restart the current document grace and stale callbacks stay cancelled',async()=>{
  const f=pendingDocumentFixture();f.context.navigator={onLine:true};f.run('startWorkspaceModuleLoading()');f.next();f.next();
  const stale=f.timers.values().next().value.callback;f.context.document.hidden=true;await f.documentEvent('visibilitychange');assert.equal(f.timers.size,0);
  f.advance(50000);f.context.document.hidden=false;await f.documentEvent('visibilitychange');stale();assert.equal(f.run('workspaceModule.loadStartedAt'),1000);
  f.next();f.next();assert.equal(f.navigations(),1);
});
test('logout during document grace cancels the delayed retry and clears its attempt time',async()=>{
  const f=pendingDocumentFixture();f.run('startWorkspaceModuleLoading()');f.next();f.next();const stale=f.timers.values().next().value.callback;
  f.state.user=null;f.run('resetWorkspaceModule()');stale();assert.equal(f.navigations(),0);assert.equal(f.timers.size,0);assert.equal(f.run('workspaceModule.loadStartedAt'),null);
});

test('old marketing entries open the SNS three screens; the demo address keeps the old graphs',()=>{
  const moved=[['marketing','','results'],['mine','','results'],['team','','results'],['all','','results'],['overview','','results'],['overview','channels','accounts'],['analysis','','results'],['history','','results'],['summary','','results'],['channels','','accounts'],['collection','','accounts']];
  for(const [view,section,expected] of moved){
    const f=fixture();let opened='';f.context.socialWorkspaceSetView=value=>{opened=value;};f.context.socialWorkspaceSection=()=>opened;
    f.context.view=view;f.context.section=section;f.run('selectWorkspaceView(view,section)');
    assert.equal(f.state.tab,'social',view);assert.equal(opened,expected,view+' '+section);
  }
  const plan=fixture();plan.run("selectWorkspaceView('content','examples');syncWorkspaceLocation()");assert.equal(plan.state.tab,'content');assert.equal(plan.location.searchParams.get('section'),'examples','기획 화면은 메뉴에서만 빠지고 바로 여는 길은 남는다');
  const demo=fixture();demo.location.search='?demo=1';demo.run("selectWorkspaceView('team')");assert.equal(demo.state.tab,'overview');assert.equal(demo.run('marketingScope()'),'team');
  const menu=fixture();menu.state.tab='social';menu.context.socialWorkspaceSection=()=>'today';const html=menu.run('workspaceContextMenu()');
  assert.match(html,/data-view="today"/);assert.match(html,/data-view="results"/);assert.match(html,/data-view="accounts"/);
  assert.doesNotMatch(html,/data-view="(compose|calendar|queue|bulk|inbox|settings|overview)"|내 현황|팀 현황|전체 현황|콘텐츠 기획|채널·수집/);
  menu.state.tab='workroom';assert.match(menu.run('workspaceContextMenu()'),/data-action="social-view" data-view="results"/);
});
