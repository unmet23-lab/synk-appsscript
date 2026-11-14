import {workspaceClientContext} from './workspace-access-test-context.mjs';
import {workspaceAccess,WORKSPACE_COMPANIES,WORKSPACE_DUTIES} from './workspace-access.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const source=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const teamOverviewSource=readFileSync(new URL('./public/team-overview.js',import.meta.url),'utf8');
const demoSource=readFileSync(new URL('./public/demo-ui.js',import.meta.url),'utf8');
const workroomSource=readFileSync(new URL('./public/workroom.js',import.meta.url),'utf8');
const accessSource=readFileSync(new URL('./public/workspace-access.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');

function accessFormFixture({realApi=false,user=null}={}){
  const handlers=new Map(),nodes=new Map(),calls=[],notifications=[],state={user,tab:'lectures',authMode:'login',modalRequest:0};
  let response={},failure=null,implementation=null;
  const context=vm.createContext({state,URL,URLSearchParams,location:new URL('https://workspace.example.test/'),
    document:{addEventListener(type,handler){handlers.set(type,handler);},getElementById:id=>nodes.get(id)||null},
    FormData:class extends URLSearchParams{constructor(form){super(form.fields);}},
    api:async(path,input)=>{calls.push({path,input});if(implementation)return implementation(path,input);if(failure)throw failure;return response;},
    crypto:{randomUUID},queueMicrotask,escape:value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),icon:()=>'',button:()=>'',
    renderAuth(){},closeModal(){},loadState:async()=>{},renderBackground(){},notify:message=>notifications.push(message),
  });
  if(realApi){
    const transport=context.api;
    Object.assign(context,{demoApiUrl:path=>path,isDemoMode:()=>false,clearCompanySessionView(){},fetch:async(path,options)=>{
      const body=await transport(path,options.body===undefined?undefined:JSON.parse(options.body));
      return {ok:true,status:200,json:async()=>body};
    }});
    const start=appSource.indexOf('async function api('),end=appSource.indexOf('function clearCompanySessionView()',start);
    assert.ok(start>=0&&end>start,'load the actual API and session-generation fence');
    vm.runInContext(appSource.slice(start,end),context);
  }
  vm.runInContext(accessSource,context);
  const dispatch=async(type,target)=>{handlers.get(type)({target,preventDefault(){},stopImmediatePropagation(){}});await new Promise(resolve=>setImmediate(resolve));};
  return {calls,notifications,state,nodes,context,respond:value=>{response=value;},reject:error=>{failure=error;},handle:fn=>{implementation=fn;},
    run:script=>vm.runInContext(script,context),
    async submit(kind,fields,dataset={}){
      const submit={disabled:false},error={textContent:''},form={fields,dataset:{form:kind,...dataset},isConnected:true,querySelector:selector=>selector==='[type="submit"]'?submit:error};
      await dispatch('submit',form);return {form,submit,error};
    },
    resubmit:record=>dispatch('submit',record.form),
    click:action=>{const target={dataset:{action},disabled:false,closest:()=>null};return dispatch('click',{closest:()=>target});},
  };
}

test('invite form parses raw codes and links and enters join only after server inspection succeeds',async()=>{
  const token='synthetic-invitation-token-1234567890';
  for(const code of [token,'https://workspace.example.test/#invite='+token]){
    const f=accessFormFixture();f.respond({memberships:[{company:'SHIFT',role:'instructor'}]});
    const form=await f.submit('wa-code',{code:' '+code+' '});
    assert.equal(f.calls[0].path,'/api/workspace-invite/inspect');assert.equal(f.calls[0].input.token,token);
    assert.equal(f.state.authMode,'join');assert.equal(f.state.authToken,token);assert.equal(form.submit.disabled,false);
  }
  const invalid=accessFormFixture(),bad=await invalid.submit('wa-code',{code:'bad-code'});
  assert.equal(invalid.calls.length,0);assert.match(bad.error.textContent,/다시 확인/);assert.equal(invalid.state.authMode,'login');assert.equal(invalid.state.authToken,undefined);
  const revoked=accessFormFixture();revoked.reject(new Error('취소된 초대예요.'));
  const denied=await revoked.submit('wa-code',{code:token});assert.equal(denied.error.textContent,'취소된 초대예요.');assert.equal(revoked.state.authMode,'login');assert.equal(revoked.state.authToken,undefined);
  const moved=accessFormFixture();let finish;moved.respond(new Promise(resolve=>{finish=resolve;}));
  const pending=moved.submit('wa-code',{code:token});moved.state.authMode='reset';finish({memberships:[]});await pending;
  assert.equal(moved.state.authMode,'reset');assert.equal(moved.state.authToken,undefined,'a late response cannot enter join after the auth view changes');
});

test('member form submits concurrent roles with a revision and displays assignment warnings',async()=>{
  const f=accessFormFixture({user:{id:'synthetic-admin',role:'admin'}});f.respond({warnings:['기존 고객 업무의 담당자를 다시 지정해 주세요.']});
  const fields=[['waCompany','SHIFT'],['waRole_SHIFT','instructor'],['waCompany','PULSE'],['waRole_PULSE','producer'],['waDuty','social']];
  await f.submit('wa-member',fields,{id:'synthetic-member',revision:'3'});
  assert.equal(f.calls[0].path,'/api/members/synthetic-member/workspace-profile');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].input)),{revision:3,workspaceProfile:{memberships:[{company:'SHIFT',role:'instructor'},{company:'PULSE',role:'producer'}],duties:['social']}});
  assert.match(f.notifications[0],/담당자를 다시 지정/);
});

test('lecture form saves company and revision then refreshes its list; failures remain editable',async()=>{
  const f=accessFormFixture({user:{id:'synthetic-staff',role:'member'}});f.respond({items:[]});
  await f.submit('wa-work',{title:'합성 강의',date:'2026-12-01',note:'준비',status:'open'},{id:'synthetic-lecture',company:'SHIFT',revision:'4'});
  assert.equal(f.calls[0].path,'/api/company-work/SHIFT/synthetic-lecture');assert.equal(f.calls[0].input.revision,4);
  assert.equal(f.calls[1].path,'/api/company-work/SHIFT');assert.equal(f.notifications[0],'저장했어요.');
  f.reject(new Error('다른 사람이 수정했어요.'));const failed=await f.submit('wa-work',{title:'합성 강의'},{id:'synthetic-lecture',company:'SHIFT',revision:'4'});
  assert.equal(failed.error.textContent,'다른 사람이 수정했어요.');assert.equal(failed.submit.disabled,false);assert.equal(f.notifications.length,1);
});

function fixture(role='admin'){
  const resizeHandlers=[],messageHandlers=[],windowHandlers=new Map(),documentHandlers=new Map(),state={user:{id:'tester',role},tab:'overview',marketingView:'summary',scope:'mine',teamId:'',reportRequest:0},cp={view:'library'},location=new URL('http://localhost:4191/');
  const context=workspaceClientContext({state,cp,location,URL,URLSearchParams,
    canManageTeam:()=>['admin','manager'].includes(state.user?.role),isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',
    window:{addEventListener(type,handler){if(type==='resize')resizeHandlers.push(handler);if(type==='message')messageHandlers.push(handler);windowHandlers.set(type,[...(windowHandlers.get(type)||[]),handler]);},scrollTo(){}},document:{hidden:false,addEventListener(type,handler){documentHandlers.set(type,[...(documentHandlers.get(type)||[]),handler]);},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];}},
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

test('people remains available within the server member scope for every signed-in role',()=>{
  for(const [role,count] of [['admin',3],['manager',1],['member',1],['viewer',1]]){
    const f=fixture(role);assert.deepEqual(Array.from(f.run('workspaceAvailableTabs().map(row=>row[0])')),['home','messenger','workroom','social','members','teaching']);
    assert.equal(f.run('workspaceUtilityTabs().length'),count);
    f.run("selectWorkspaceView('members');syncWorkspaceLocation()");
    assert.equal(f.state.tab,'members');assert.equal(f.location.searchParams.get('tab'),'members');
  }
});

test('server computed admin access includes all company tabs',()=>{
  const f=fixture('admin');f.state.user.workspaceAccess=workspaceAccess({...f.state.user,active:true});
  assert.deepEqual(Array.from(f.run('workspaceAvailableTabs().map(row=>row[0])')),['home','messenger','workroom','social','members','teaching','path','lectures']);
  assert.deepEqual(Array.from(f.run('workspaceUtilityTabs().map(row=>row[0])')),['handbook','admin','settings']);
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
  const menu=fixture();menu.state.tab='social';menu.context.socialWorkspaceSection=()=>'today';const html=menu.run('workspaceInlineSubnav()');
  assert.match(html,/data-view="today"/);assert.match(html,/data-view="results"/);assert.match(html,/data-view="accounts"/);
  assert.doesNotMatch(html,/data-view="(compose|calendar|queue|bulk|inbox|settings|overview)"|내 현황|팀 현황|전체 현황|콘텐츠 기획|채널·수집/);
  menu.state.tab='workroom';assert.match(menu.run('workspaceToolsDrawer()'),/data-action="tab" data-tab="social"/,'the SNS workspace remains reachable from Tools after the persistent side menu is removed');
});


test('assigned company features filter navigation and reject deep links; concurrent work can be narrowed',()=>{
  const f=fixture('member');
  f.state.user.workspaceAccess=workspaceAccess({role:'member',active:true,workspaceProfile:{memberships:[{company:'SHIFT',role:'instructor'},{company:'PULSE',role:'producer'}],duties:[],revision:1}});
  f.state.data={workspaceCatalog:{companies:WORKSPACE_COMPANIES,duties:WORKSPACE_DUTIES}};
  assert.deepEqual(Array.from(f.run('workspaceAvailableTabs().map(row=>row[0])')),['home','messenger','workroom','members','lectures']);
  f.run("selectWorkspaceView('teaching')");assert.equal(f.state.tab,'home');
  f.run("selectWorkspaceView('social')");assert.equal(f.state.tab,'home');
  f.run("selectWorkspaceView('lectures')");assert.equal(f.state.tab,'lectures');
  f.run("wa.company='SHIFT'");assert.deepEqual(Array.from(f.run('workspaceAvailableTabs().map(row=>row[0])')),['home','messenger','members','lectures']);
  f.run("wa.company='PULSE'");assert.deepEqual(Array.from(f.run('workspaceAvailableTabs().map(row=>row[0])')),['home','messenger','workroom','members']);
  f.run("selectWorkspaceView('lectures')");assert.equal(f.state.tab,'lectures');assert.equal(f.run('wa.company'),'all');
});

test('a concurrent company source link opens its requested workroom section even when another section is already allowed',()=>{
  const f=withWorkroom(fixture('member'));
  f.state.user.workspaceAccess=workspaceAccess({role:'member',active:true,workspaceProfile:{memberships:[{company:'SHIFT',role:'instructor'},{company:'PULSE',role:'producer'}],duties:['pages'],revision:1}});
  f.state.data={workspaceCatalog:{companies:WORKSPACE_COMPANIES,duties:WORKSPACE_DUTIES}};
  f.run("wa.userId=state.user.id;wa.company='SHIFT';wrIdentity();selectWorkspaceView('workroom','clients');waNormalizeView();syncWorkspaceLocation()");
  assert.equal(f.state.tab,'workroom');assert.equal(f.run('wa.company'),'all');assert.equal(f.run('wr.view'),'clients');
  assert.equal(f.location.searchParams.get('section'),'clients');
  f.state.user.workspaceAccess=workspaceAccess({role:'member',active:true,workspaceProfile:{memberships:[{company:'SHIFT',role:'instructor'}],duties:['pages'],revision:2}});
  f.run("wa.company='SHIFT';selectWorkspaceView('workroom','clients');waNormalizeView()");
  assert.notEqual(f.run('wr.view'),'clients');assert.equal(f.run("waFeature('clients')"),false);
});

test('skipping production in one company does not suppress its first load after switching to PULSE',async()=>{
  const f=withWorkroom(fixture('member')),calls=[];
  f.state.user.workspaceAccess=workspaceAccess({role:'member',active:true,workspaceProfile:{memberships:[{company:'SHIFT',role:'instructor'},{company:'PULSE',role:'producer'}],duties:['pages'],revision:1}});
  f.state.data={workspaceCatalog:{companies:WORKSPACE_COMPANIES,duties:WORKSPACE_DUTIES}};f.state.tab='workroom';
  Object.assign(f.context,{api:async path=>{calls.push(path);return path==='/api/workroom-guide'?{series:[]}:{drafts:[]};},renderBackground(){}});
  f.run("wa.userId=state.user.id;wa.company='SHIFT';wrEnsureDaily=()=>{};ensureWorkroom()");
  assert.deepEqual(calls,[]);assert.equal(f.run('wr.attempted'),false);
  f.run("wa.company='PULSE';ensureWorkroom()");await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['/api/workroom-guide','/api/content-workspace']);
  assert.deepEqual(JSON.parse(f.run('JSON.stringify(wr.content)')),{drafts:[]});assert.equal(f.run('wr.loading'),false);
});

test('a successful lecture save supersedes a still pending initial list without accepting its stale response',async()=>{
  const f=accessFormFixture(),pending=[];
  f.state.user={id:'tester',role:'member'};
  f.handle((path,input)=>input?Promise.resolve({id:'created',revision:1}):new Promise(resolve=>pending.push(resolve)));
  f.run("wa.userId='tester';wa.workKey='tester:SHIFT'");const first=f.run('waLoadWork()');
  await f.submit('wa-work',{title:'새 강의',date:'2026-12-01',note:'준비',status:'open'},{company:'SHIFT',id:'',revision:'0'});
  const row={id:'created',title:'새 강의',revision:1};
  if(pending[1])pending[1]({items:[row]});
  pending[0]({items:[]});await first;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(pending.length,2,'saving must request a fresh list even while the previous GET is pending');
  assert.deepEqual(JSON.parse(f.run('JSON.stringify(wa.work.items)')),[row]);assert.equal(f.run('wa.workLoading'),false);
});

test('an invitation can be inspected again after a transient failure without accepting a revoked code',async()=>{
  const f=accessFormFixture(),submit={disabled:true},name={value:''},host={innerHTML:'',textContent:'',setAttribute(key,value){this[key]=value;}};
  f.nodes.set('wa-invite-summary',host);f.nodes.set('auth-form',{querySelector:selector=>selector==='[type="submit"]'?submit:selector==='[name="name"]'?name:null});
  Object.assign(f.state,{authMode:'join',authToken:'synthetic-invitation-token-1234567890'});let attempts=0;
  f.handle(()=>{if(++attempts===1)throw Object.assign(new Error('일시적인 연결 오류'),{status:503});return {name:'검증 직원',memberships:[{company:'SHIFT',role:'instructor'}]};});
  await f.run('waInspectInvite()');assert.equal(submit.disabled,true);assert.match(host.innerHTML,/data-action="wa-invite-retry"/);
  await f.click('wa-invite-retry');assert.equal(attempts,2);assert.equal(submit.disabled,false);assert.equal(name.value,'검증 직원');assert.equal(f.run('wa.inviteError'),'');
  f.handle(()=>{throw Object.assign(new Error('취소된 초대'),{status:403});});
  await f.click('wa-invite-retry');assert.equal(submit.disabled,true);assert.equal(f.run('wa.invite'),null);assert.match(host.innerHTML,/취소된 초대/);
});

test('a new work form retains its request identity across an ambiguous save retry',async()=>{
  const f=accessFormFixture();let html='',posts=0;
  f.context.modal=(_title,_description,body)=>{html=body;};f.run('waWorkModal()');
  const requestId=html.match(/data-request-id="([^"]+)"/)?.[1];assert.match(requestId||'',/^[0-9a-f-]{36}$/i);
  f.handle((_path,input)=>{if(!input)return {items:[]};if(++posts===1)throw new Error('응답 연결 끊김');return {item:{id:'created',revision:1}};});
  const form=await f.submit('wa-work',{title:'검증 강의',note:'준비',date:'2026-12-01',status:'open'},{company:'SHIFT',id:'',revision:'0',requestId});
  assert.equal(form.submit.disabled,false);assert.match(form.error.textContent,/연결 끊김/);
  await f.resubmit(form);
  const submissions=f.calls.filter(row=>row.input);assert.equal(submissions.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(submissions[0].input)),JSON.parse(JSON.stringify(submissions[1].input)));
  assert.equal(submissions[1].input.requestId,requestId);assert.equal(submissions[1].input.revision,0);
  f.run('waWorkModal()');assert.notEqual(html.match(/data-request-id="([^"]+)"/)?.[1],requestId);
});

test('a late save from a previous account cannot close or reset the current account work form',async()=>{
  const f=accessFormFixture({realApi:true});let resolveSave,closed=0;
  f.state.user={id:'first',role:'member'};f.context.closeModal=()=>closed++;
  f.handle((_path,input)=>input?new Promise(resolve=>{resolveSave=resolve;}):{items:[]});
  await f.submit('wa-work',{title:'이전 계정 강의',status:'open'},{company:'SHIFT',id:'',revision:'0'});
  f.state.user={id:'second',role:'member'};f.run("wa.userId='second';wa.workKey='second:SHIFT';wa.request=20;wa.workLoading=true");
  resolveSave({item:{id:'first-record'}});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closed,0,'the previous account response must not close a current modal');
  assert.equal(f.run('wa.request'),20);assert.equal(f.run('wa.workLoading'),true);assert.deepEqual(f.notifications,[]);
  assert.equal(f.calls.length,1);
});

test('a save finishing after its form was dismissed does not close a later dialog',async()=>{
  const f=accessFormFixture({realApi:true});let resolveSave,closed=0;
  f.state.user={id:'tester',role:'member'};f.context.closeModal=()=>closed++;
  f.handle((_path,input)=>input?new Promise(resolve=>{resolveSave=resolve;}):{items:[]});
  const first=await f.submit('wa-work',{title:'첫 강의',status:'open'},{company:'SHIFT',id:'',revision:'0'});
  first.form.isConnected=false;resolveSave({item:{id:'created'}});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closed,0,'a detached form must not close a replacement dialog');
});
