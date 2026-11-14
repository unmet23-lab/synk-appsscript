import {workspaceClientContext} from './workspace-access-test-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const workspaceSource=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const contentSource=readFileSync(new URL('./public/content.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const draftId='11111111-1111-4111-8111-111111111111';
const draft={id:draftId,title:'회의록 검토 순서',ownerId:'author',status:'draft',input:{proof:'SHOULD NOT BE SHARED'},plan:{secret:'PRIVATE FULL PLAN',ideas:[]}};
const link={title:draft.title,url:`/#view=content&section=plan&draftId=${draftId}`,kind:'content-review'};
function fixture(){
  const windowHandlers=new Map(),documentHandlers=new Map(),requests=[],sent=[],notifications=[],renders=[],modals=[];let currentForm=null;
  const state={user:{id:'author',role:'member'},tab:'content',scope:'mine',marketingView:'summary',data:{channels:[]},modalRequest:0,reportRequest:0};
  const location=new URL('http://localhost:4191/');
  const form=()=>({isConnected:true,values:{target:''},error:{textContent:''},submit:{disabled:false},querySelector(selector){return selector==='[type="submit"]'?this.submit:selector==='.form-error'?this.error:null;}});
  const context=workspaceClientContext({state,location,URL,URLSearchParams,Intl,structuredClone,
    document:{addEventListener(type,fn){documentHandlers.set(type,[...(documentHandlers.get(type)||[]),fn]);},getElementById:()=>null,querySelector:selector=>selector==='[data-cp-review-share]'?currentForm:null},
    window:{addEventListener(type,fn){windowHandlers.set(type,[...(windowHandlers.get(type)||[]),fn]);},scrollTo(){},matchMedia:()=>({matches:false})},MutationObserver:class{observe(){}},
    history:{replaceState(_a,_b,url){location.href=new URL(url,location).href;}},crypto:{randomUUID:()=> 'share-request'},
    canManageTeam:()=>false,isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',bmReset(){},
    icon:()=>'',button:(title,action)=>`<button data-action="${action}">${title}</button>`,escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    render:()=>renders.push(state.tab),notify:message=>notifications.push(message),
    modal(title,subtitle,html){state.modalRequest++;if(currentForm)currentForm.isConnected=false;currentForm=html.includes('data-cp-review-share')?form():null;modals.push({title,subtitle,html});},
    closeModal(){state.modalRequest++;if(currentForm)currentForm.isConnected=false;currentForm=null;},
    FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key];}},
    api(path,body){return new Promise((resolve,reject)=>requests.push({path,body,resolve,reject}));},
  });
  const run=code=>vm.runInContext(code,context);run(workspaceSource+'\n'+contentSource);context.fixtureDraft=structuredClone(draft);
  run("cp.userId=state.user.id;cp.data={drafts:[],catalog:{series:[]},references:[]};cp.draftId=fixtureDraft.id;cp.activeDraft=fixtureDraft;cp.view='plan';");
  const frame={contentWindow:{postMessage:(value,origin)=>sent.push({value,origin})}};context.savedFrame=frame;run('workspaceModule.frame=savedFrame;workspaceModule.ready=true;');
  return{state,context,location,requests,sent,notifications,renders,modals,run,cp:run('cp'),frame,get form(){return currentForm;},emitMessage(event){for(const handler of windowHandlers.get('message')||[])handler(event);}};
}
const targets={workspaceLink:link,channels:[{id:'team',name:'마케팅팀',scope:'team',allowed:false,reason:'기획을 볼 수 없는 참여자가 있어요'}],people:[{id:'admin-messenger-id',name:'관리자',allowed:true}]};

test('workspace cards accept only safe local destinations and identify a specific saved plan',()=>{
  const f=fixture();f.context.cardUrl=link.url;assert.equal(f.run('workspaceLinkDestination(cardUrl).draftId'),draftId);
  for(const url of ['https://evil.test/'+link.url,'//evil.test/#view=content','javascript:alert(1)','/#view=content&section=plan&draftId=x&token=secret','/?tab=content#view=content','/#view=content&section=library&draftId=x','/#view=analysis&draftId=x','/#view=content&view=analysis','/#view=content&section=plan&draftId=../../data']){f.context.cardUrl=url;assert.equal(f.run('workspaceLinkDestination(cardUrl)'),null,url);}
  assert.ok(f.run("workspaceLinkDestination('/?tab=history&section=team&teamId=team-a')"));
});

test('a plan card opens the exact plan on a fresh content workspace and preserves its URL for reload',async()=>{
  const f=fixture();f.cp.userId='';f.cp.draftId='';f.cp.activeDraft=null;f.state.tab='messenger';f.context.cardUrl=link.url;
  const opening=f.run('navigateWorkspaceLink(cardUrl)');assert.equal(f.state.tab,'content');assert.equal(f.state.workspaceSidebarOpen,false);assert.equal(f.requests[0].path,'/api/content-workspace');
  f.requests[0].resolve({drafts:[{id:draftId,title:draft.title}],references:[],catalog:{series:[]}});await new Promise(setImmediate);
  assert.equal(f.cp.error,'');assert.equal(f.cp.draftId,draftId);
  assert.equal(f.requests[1].path,'/api/content-drafts/'+draftId);f.requests[1].resolve({draft:structuredClone(draft)});assert.equal(await opening,true);
  assert.equal(f.cp.draftId,draftId);assert.equal(f.cp.activeDraft.title,draft.title);assert.equal(f.cp.view,'plan');
  f.run('syncWorkspaceLocation()');assert.equal(f.location.searchParams.get('draftId'),draftId);assert.equal(f.location.searchParams.get('section'),'plan');
  f.run("selectWorkspaceView('analysis');syncWorkspaceLocation()");assert.equal(f.location.searchParams.has('draftId'),false);
});

test('review selection prepares only a title/link card for the chosen reviewer and never posts a message',async()=>{
  const f=fixture(),opening=f.run('cpReviewRequest()');assert.equal(f.requests[0].path,`/api/content-drafts/${draftId}/share-targets`);f.requests[0].resolve(targets);await opening;
  const html=f.modals.at(-1).html;assert.match(html,/disabled>마케팅팀/);assert.match(html,/관리자 · 개인 대화/);assert.ok(!html.includes('SHOULD NOT BE SHARED'));assert.ok(!html.includes('PRIVATE FULL PLAN'));
  const form=f.form;form.values.target='person:admin-messenger-id';const choosing=form.onsubmit({preventDefault(){}});assert.equal(f.requests.length,2,'permissions are checked again immediately before preparing the draft');
  f.requests[1].resolve(targets);await choosing;
  assert.equal(f.state.tab,'messenger');assert.equal(f.sent.length,1);assert.equal(f.sent[0].value.type,'workspace:share');assert.equal(f.sent[0].value.userId,'admin-messenger-id');assert.deepEqual(JSON.parse(JSON.stringify(f.sent[0].value.workspaceLink)),link);
  assert.ok(f.requests.every(row=>row.body===undefined));assert.ok(f.requests.every(row=>!row.path.includes('/messages')));assert.ok(!JSON.stringify(f.sent).includes('PRIVATE FULL PLAN'));assert.equal(f.run('workspaceModule.frame'),f.frame);
});

test('a stale review modal cannot switch users or bypass changed recipient permissions',async()=>{
  const f=fixture(),opening=f.run('cpReviewRequest()');f.requests[0].resolve(targets);await opening;
  const form=f.form;form.values.target='person:admin-messenger-id';const choosing=form.onsubmit({preventDefault(){}});f.requests[1].resolve({...targets,people:[]});await choosing;
  assert.equal(f.sent.length,0);assert.equal(f.state.tab,'content');assert.match(form.error.textContent,/권한이 바뀌었어요/);assert.equal(form.submit.disabled,false);
  const again=f.run('cpReviewRequest()');f.state.user={id:'different-user',role:'member'};f.run('resetContentWorkspace()');f.requests[2].resolve(targets);await again;assert.equal(f.sent.length,0);assert.equal(f.cp.activeDraft,null);
});

test('only the current messenger frame can request local navigation',async()=>{
  const f=fixture();f.state.tab='messenger';f.emitMessage({origin:'https://evil.test',source:f.frame.contentWindow,data:{type:'messenger:navigate',url:link.url}});f.emitMessage({origin:f.location.origin,source:{},data:{type:'messenger:navigate',url:link.url}});
  assert.equal(f.requests.length,0);assert.equal(f.state.tab,'messenger');
  f.emitMessage({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:navigate',url:'https://evil.test/#view=content'}});assert.equal(f.requests.length,0);
  f.context.loadContentWorkspace=async()=>{};f.emitMessage({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:navigate',url:link.url}});await Promise.resolve();assert.equal(f.state.tab,'content');assert.equal(f.cp.draftId,draftId);
});

test('query and shared hash deep links restore the saved plan after authenticating a fresh page',async()=>{
  for(const suffix of [`?tab=content&section=plan&draftId=${draftId}`,`#view=content&section=plan&draftId=${draftId}`]){
    const f=fixture();f.location.href=f.location.origin+'/'+suffix;f.state.user=null;f.cp.userId='';f.cp.draftId='';f.cp.activeDraft=null;
    Object.assign(f.context,{isDemoMode:()=>false,loadState:async()=>{},reportTabs:()=>false,startPolling(){},renderAuth(){throw Error('Unexpected unauthenticated view');},app:{innerHTML:''}});
    f.run(appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()')));
    const initializing=f.run('initialize()');assert.equal(f.requests[0].path,'/api/me');f.requests[0].resolve({user:{id:'author',role:'member'},csrfToken:'csrf'});await new Promise(setImmediate);
    assert.equal(f.requests[1].path,'/api/content-workspace');f.requests[1].resolve({drafts:[],references:[],catalog:{series:[]}});await new Promise(setImmediate);
    assert.equal(f.requests[2].path,'/api/content-drafts/'+draftId);f.requests[2].resolve({draft:structuredClone(draft)});await initializing;
    assert.equal(f.state.initialized,true);assert.equal(f.cp.activeDraft.id,draftId);assert.equal(f.cp.view,'plan');assert.equal(f.context.app.innerHTML,'');
  }
});

test('an inaccessible linked plan shows the server error without retaining a previously opened plan',async()=>{
  const f=fixture();f.context.cardUrl='/#view=content&section=plan&draftId=unreadable-plan';
  const opening=f.run('navigateWorkspaceLink(cardUrl)');assert.equal(f.cp.activeDraft,null);
  f.requests[0].resolve({drafts:[{id:draftId,title:draft.title}],references:[],catalog:{series:[]}});await new Promise(setImmediate);
  f.requests[1].reject(Error('기획을 찾을 수 없어요.'));await opening;
  assert.equal(f.run('cpDraft()'),undefined);assert.equal(f.cp.activeDraft,null);assert.equal(f.cp.error,'기획을 찾을 수 없어요.');
});

// Execute the actual home event, navigation, page rendering and permission predicates.
{
function actualFunction(source,name){
  const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(start>=0,name);
  const lines=source.slice(start).split(/\r?\n/);let text='';
  for(const line of lines){text+=(text?'\n':'')+line;try{new vm.Script('('+text+')');return text;}catch(error){if(!(error instanceof SyntaxError))throw error;}}
  throw Error('Incomplete function '+name);
}
const sources=Object.fromEntries(['app.js','workspace.js','workspace-access.js','workroom.js','marin-home.js','maker-tools.js','studio.js'].map(n=>[n,readFileSync(new URL('./public/'+n,import.meta.url),'utf8')]));
const fn=(file,name)=>actualFunction(sources[file],name);
function fixture(features=['production','clients','pages'],options={}){
 const profile={admin:options.admin||false,legacy:options.legacy||false,features,memberships:[{company:'PULSE',role:'producer'}],companies:['PULSE'],duties:[]},state={user:{id:'synthetic-producer',role:profile.admin?'admin':'member',workspaceAccess:profile},csrf:'synthetic',tab:'home',data:{channels:[],teams:[]},scope:'all'},events={},h={paint:''};
 const results={innerHTML:''};
 const g={state,cp:{view:'library'},location:new URL('https://synthetic.invalid/?tab=home'),URL,URLSearchParams,document:{visibilityState:'visible',addEventListener(t,f){(events[t]||=[]).push(f);},querySelector(){return null;},getElementById(){return null;}},window:{addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false})},sessionStorage:{removeItem(){},getItem:()=>null,setItem(){}},MutationObserver:class{observe(){}},setTimeout:()=>0,clearTimeout(){},clearInterval(){},history:{replaceState(){}},isAdmin:()=>profile.admin,isViewer:()=>false,isDemoMode:()=>false,canManageTeam:()=>profile.admin,escape:String,icon:()=>'',pageHeading:(_a,b)=>'<h1>'+b+'</h1>',button:(text,action,_icon,_cls,attrs='')=>`<button data-action="${action}" ${attrs}>${text}</button>`,shell:s=>{h.paint=s;},notify(){},clientDeskPanel:()=>'<section>CLIENTS</section>',mtSwitch:()=>'',mtEmpty:(a,b)=>a+' '+b,mtNow:o=>o.actions||o.title,swReviewed:()=>false,swBtn:()=>'',api:()=>{throw Error('No network allowed');},$:s=>s==='.command-results'?results:null,$$:()=>[],empty:(a,b)=>a+' '+b,channelName:x=>x.name,platformMark:()=>'',searchIcon:()=>'',modal(){}};
 for(const n of ['renderSocialWorkspace','companyGuidePage','marketingPage','analysisPage','historyPage','membersPage','settingsPage','messengerWorkspacePage','contentPage','renderAuth'])g[n]=()=>'';
 g.overlay={};const context=vm.createContext(g);vm.runInContext(sources['workspace-access.js']+'\n'+sources['workspace.js']+'\n'+sources['workroom.js'],context);
 for(const [file,names]of [['app.js',['render','renderCommandResults','channelSearchText']],['marin-home.js',['marinWorkroomPage']],['maker-tools.js',['makerToolsMovedPanel']],['studio.js',['swNow']]])for(const n of names)vm.runInContext(fn(file,n),context);
 vm.runInContext("wrDeskDrafts=()=>[];wrWorkingPlan=()=>null;wrDeskGuide=()=>'';wrPages=()=>'<section>PAGES</section>';",context);
 const run=s=>vm.runInContext(s,context);return Object.assign(h,{context,state,run,results,events,click:action=>{const target={dataset:action,disabled:false,isConnected:true},e={target:{closest:()=>target},preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};for(const f of events.click||[]){f(e);if(e.stopped)break;}}});
}

for(const section of ['clients','pages'])test('first home shortcut preserves workroom '+section,()=>{
  const h=fixture();h.run('waNormalizeView()');assert.match(h.run('waHome()'),new RegExp('data-section="'+section+'"'));
  h.click({action:'wa-open',tab:'workroom',section});assert.equal(h.state.tab,'workroom');assert.equal(h.run('wr.view'),section);assert.match(h.paint,new RegExp(section==='clients'?'CLIENTS':'PAGES'));
});
test('client-only first home shortcut opens the client view without production access',()=>{
  const h=fixture(['clients']);h.run('waNormalizeView()');h.click({action:'wa-open',tab:'workroom',section:'clients'});assert.equal(h.run("waFeature('production')"),false);assert.equal(h.run('wr.view'),'clients');assert.match(h.paint,/CLIENTS/);
});
for(const config of [{name:'production-only',features:['production','clients']},{name:'social',features:['production','clients','social']},{name:'legacy',features:[],legacy:true},{name:'admin',features:[],admin:true}])test('SNS entry buttons respect '+config.name+' access',()=>{
  const h=fixture(config.features,config);h.run('waNormalizeView();wrIdentity();wr.guide={series:[]};');
  const html=[h.run('wrDesk()'),h.run('makerToolsMovedPanel()'),h.run("swNow({id:'synthetic-production',stage:'published'},null)")];
  for(const [i,value]of html.entries())assert.equal(/data-action="social-view"/.test(value),config.name!=='production-only',['desk','maker','studio'][i]);
  h.state.tab='workroom';h.run("selectWorkspaceView('social','results')");assert.equal(h.state.tab,config.name==='production-only'?'home':'social');
});
test('menu search finds the visible Korean PATH and organization labels without granting hidden routes',()=>{
  const h=fixture(['path']);h.run('waNormalizeView()');
  for(const [query,tab]of [['PATH','path'],['상담','path'],['정착','path'],['사람','members'],['조직','members'],['직원','members']]){h.context.query=query;h.run('renderCommandResults(query)');assert.match(h.results.innerHTML,new RegExp('data-tab="'+tab+'"'),query);}
  const denied=fixture(['production']);denied.run('waNormalizeView();renderCommandResults("상담")');assert.doesNotMatch(denied.results.innerHTML,/data-tab="path"/);
});
for(const [feature,tab,company]of [['path','path','PATH'],['lectures','lectures','SHIFT']])test(company+' load failure offers retry without stale loading text',()=>{
  const h=fixture([feature]);h.state.tab=tab;h.context.company=company;h.run("waNormalizeView();wa.workKey=state.user.id+':'+company;wa.workError='합성 조회 오류';");
  const html=h.run('waWorkPage()');assert.match(html,/합성 조회 오류/);assert.match(html,/data-action="wa-work-refresh"/);assert.doesNotMatch(html,/업무를 준비하고 있어요/);
});
}

// Invitation initialization uses the actual API and session-generation checks.
{
function actualFunction(source,name){
  const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(start>=0,name);
  const lines=source.slice(start).split(/\r?\n/);let text='';
  for(const line of lines){text+=(text?'\n':'')+line;try{new vm.Script('('+text+')');return text;}catch(error){if(!(error instanceof SyntaxError))throw error;}}
  throw Error('Incomplete function '+name);
}
const sources=Object.fromEntries([['app','app.js'],['workspace','workspace.js'],['access','workspace-access.js']].map(([key,name])=>[key,readFileSync(new URL('./public/'+name,import.meta.url),'utf8')]));
const fn=(source,name)=>actualFunction(source,name);
const auth=sources.app.slice(sources.app.indexOf('async function api('),sources.app.indexOf('\nfunction notify('));
const decl=name=>{const line=sources.workspace.split(/\r?\n/).find(line=>line.startsWith('const '+name+'='));assert.ok(line,name);return line;};
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
const response=x=>({ok:true,status:200,json:async()=>x});
function fixture(access,{signedIn=false,delay=false}={}){
 const h={calls:[],notices:[],history:[]},user={id:'existing-synthetic-member',role:'member'},state={user:null,csrf:'',authMode:'login',authToken:'',tab:'home',data:null,modalRequest:0};
 let form=null,host=null,submit=null,name=null,html='';
 const app={get innerHTML(){return html;},set innerHTML(s){html=s;if(form)form.isConnected=false;host=null;submit={disabled:false};name={value:''};form={isConnected:true,dataset:{form:'auth'},querySelector:q=>q==='[type="submit"]'?submit:q==='[name="name"]'?name:null,insertAdjacentHTML(_where,s){host={innerHTML:s,textContent:'초대를 확인하고 있어요.',setAttribute(){}};}};}};
 let resolveInspect;const pending=new Promise(resolve=>resolveInspect=resolve);
 const document={addEventListener(){},getElementById:id=>id==='auth-form'?form:id==='wa-invite-summary'?host:null,querySelector:()=>null};
 const location=new URL('https://synthetic.invalid/#invite=fixture-only-invite-000000000000000');
 const context=vm.createContext({state,app,document,window:{},location,history:{replaceState(_a,_b,u){h.history.push(u);}},URLSearchParams,URL,Object,clearInterval(){},clearTimeout(){},escape:String,icon:()=>'',isAdmin:()=>state.user?.role==='admin',isViewer:()=>false,isDemoMode:()=>false,demoApiUrl:p=>p,notify:x=>h.notices.push(x),button:()=>'',fetch:async(url,options)=>{h.calls.push({url,method:options.method});if(url==='/api/me')return response({user:signedIn?user:null,csrfToken:'synthetic-csrf',needsSetup:false});if(url==='/api/workspace-invite/inspect')return delay?pending:response({name:'Invited Synthetic Person',memberships:[{company:'PATH'}]});throw Error('Unexpected synthetic request '+url);},closeModal(){},loadState(){throw Error('Invite initialization must not load employee state');},startPolling(){throw Error('Invite initialization must not start polling');}});
 vm.runInContext(auth,context);vm.runInContext(decl('workspaceModule')+'\n'+decl('WORKSPACE_MARKETING_MOVED'),context);
 for(const n of ['isMarketingWorkspace','selectWorkspaceView','resetWorkspaceModule','stopWorkspaceModuleLoading'])vm.runInContext(fn(sources.workspace,n),context);
 vm.runInContext(access,context);for(const n of ['selectRequestedView','renderAuth','initialize'])vm.runInContext(fn(sources.app,n),context);
 return Object.assign(h,{state,context,run:s=>vm.runInContext(s,context),initialize:()=>vm.runInContext('initialize()',context),resolveInspect,summary:()=>({userId:state.user?.id||null,authMode:state.authMode,calls:h.calls.map(x=>x.url),disabled:submit?.disabled,name:name?.value,summary:host?.innerHTML,invite:h.run('wa.invite'),inviteLoading:h.run('wa.inviteLoading'),inviteError:h.run('wa.inviteError')})});
}

for(const signedIn of [false,true])test('invite link is inspectable with '+(signedIn?'an existing session':'a guest session'),async()=>{
  const h=fixture(sources.access,{signedIn});await h.initialize();await flush();const value=h.summary();assert.equal(value.authMode,'join');assert.equal(value.calls.filter(x=>x.endsWith('/inspect')).length,1);assert.equal(value.disabled,false);assert.equal(value.name,'Invited Synthetic Person');assert.equal(value.inviteError,'');
});
for(const signedIn of [false,true])test('late invite response cannot overwrite '+(signedIn?'an existing':'a guest')+' session after account change',async()=>{
  const h=fixture(sources.access,{signedIn,delay:true});await h.initialize();await flush();assert.equal(h.calls.filter(x=>x.url.endsWith('/inspect')).length,1);
  h.state.user={id:'other-synthetic-account',role:'member'};h.state.csrf='other-synthetic-csrf';h.resolveInspect(response({name:'Stale Synthetic Person',memberships:[]}));await flush();const value=h.summary();assert.equal(value.invite,null);assert.notEqual(value.name,'Stale Synthetic Person');
});
}

// Real app API/auth generation is exercised here; only transport and DOM boundaries are synthetic.
{
const sources=Object.fromEntries(['app.js','workspace-access.js','workroom.js'].map(n=>[n,readFileSync(new URL('./public/'+n,import.meta.url),'utf8')]));
const app=sources['app.js'];
const auth=app.slice(app.indexOf('async function api('),app.indexOf('\nfunction notify('));
assert.ok(auth.includes('companyAuthGeneration'));
const loadStateSource=app.slice(app.indexOf('async function loadState()'),app.indexOf('async function loadReport()'));
const renderSource=app.split(/\r?\n/).find(line=>line.startsWith('function render()'));
const fn=name=>name==='loadState'?loadStateSource:renderSource;
const submitStart=app.indexOf("document.addEventListener('submit',");
const submitSource=app.slice(submitStart,app.indexOf("document.addEventListener('keydown',",submitStart));
assert.ok(submitSource.includes("case 'password':"));
assert.ok(app.includes("if(state.tab==='workroom'&&typeof ensureWorkroom==='function')ensureWorkroom();"));
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
const response=data=>({ok:true,status:200,json:async()=>data});
const user=id=>({id,role:'admin',workspaceAccess:{admin:false,legacy:false,features:['production','teaching'],memberships:[{company:'PULSE',role:'producer'},{company:'LAB',role:'teacher'}],duties:[],companies:['LAB','PULSE']}});
function fixture(){
 const state={user:user('employee-a'),csrf:'synthetic-csrf-1',tab:'workroom',data:null,authMode:'login',passwordSet:true,hypeRequest:0};
 const h={state,events:{},requests:[],paints:[],notices:[],nextUser:null};
 const data=()=>({user:JSON.parse(JSON.stringify(state.user)),channels:[],workspaceCatalog:{companies:[{id:'PULSE',features:['production']},{id:'LAB',features:['teaching']}],duties:[]}});
 state.data=data();
 const g={state,URL,URLSearchParams,location:new URL('https://synthetic.invalid/?tab=workroom'),document:{addEventListener:(name,f)=>{(h.events[name]??=[]).push(f);},querySelector:()=>null,visibilityState:'visible'},window:{scrollTo(){}},sessionStorage:{removeItem(){},getItem(){return null;}},setTimeout:()=>1,clearTimeout(){},escape:String,icon:()=>'',button:(label,action)=>`<button data-action="${action}">${label}</button>`,pageHeading:()=>'',isAdmin:()=>true,isViewer:()=>false,isDemoMode:()=>false,isMarketingWorkspace:()=>false,demoApiUrl:p=>p,initializeDemoRange(){},resetTeamOverview(){},normalizeMarketingScope(){},closeModal(){},renderAuth(){h.paints.push({tab:'auth'});},notify:m=>h.notices.push(m),selectRequestedView(){state.tab='workroom';},reportTabs:()=>false,startPolling(){},fetch:(url,options)=>{const request={url,method:options.method,user:state.user?.id,csrf:state.csrf};h.requests.push(request);if(url==='/api/state')return Promise.resolve(response(data()));if(url==='/api/account/password'||url==='/api/login')return Promise.resolve(response({}));if(url==='/api/me')return Promise.resolve(response({user:h.nextUser||user(state.user.id),csrfToken:'synthetic-csrf-2',passwordSet:true}));if(['/api/workroom-guide','/api/content-workspace'].includes(url)){return new Promise(resolve=>{request.resolve=body=>resolve(response(body));});}throw new Error('Unexpected synthetic request '+url);},FormData:class {constructor(f){this.values=Object.entries(f.values);}[Symbol.iterator](){return this.values[Symbol.iterator]();}}};
 for(const name of ['renderSocialWorkspace','companyGuidePage','marketingPage','analysisPage','historyPage','membersPage','settingsPage','messengerWorkspacePage','contentPage'])g[name]=()=>'';
 g.shell=html=>{h.paints.push({tab:state.tab,html});if(state.tab==='workroom')h.run('ensureWorkroom()');};
 h.context=vm.createContext(g);h.run=s=>vm.runInContext(s,h.context);
 h.run(auth+'\n'+fn('loadState')+'\n'+fn('render'));
 h.run(sources['workspace-access.js']);h.run(sources['workroom.js']);
 h.run("wrEnsureDaily=()=>{};wrDesk=()=>'<section>'+String(wr.guide?.marker||'')+'</section>';function marinWorkroomPage(){return contentWorkroomPage();}");
 h.run(submitSource);
 h.wr=h.run('wr');h.wa=h.run('wa');
 h.work=()=>h.requests.filter(x=>x.url.startsWith('/api/workroom-')||x.url==='/api/content-workspace');
 h.submit=async(kind,values)=>{const control={disabled:false,isConnected:true},error={textContent:'',isConnected:true};const form={dataset:{form:kind},values,reset(){},closest:q=>q==='form[data-form]'?form:null,querySelector:q=>q==='button[type="submit"]'?control:error};await h.events.submit.at(-1)({target:form,preventDefault(){}});assert.equal(error.textContent,'');};
 h.password=()=>h.submit('password',{oldPassword:'synthetic-old',password:'synthetic-new',confirmPassword:'synthetic-new'});
 h.snapshot=()=>({auth:h.run('companyAuthSnapshot()'),wr:{userId:h.wr.userId,loading:h.wr.loading,attempted:h.wr.attempted,request:h.wr.request,guide:h.wr.guide?.marker||null,error:h.wr.error},workGetCount:h.work().length,lastPaint:h.paints.at(-1)});
 h.resolve=(requests,marker)=>requests.forEach(r=>r.resolve({marker,series:[],drafts:[]}));
 return h;
}
const record=(id,run)=>test('workroom actual authentication: '+id,run);
for(const seeded of [false,true])record(seeded?'same-user-password-change-during-refresh':'same-user-password-change-during-initial-load',async()=>{
 const h=fixture();h.run('wrIdentity()');if(seeded)h.wr.guide={marker:'previously-loaded',series:[]};
 const pending=h.run('loadWorkroom()'),old=h.work().slice();assert.equal(old.length,2);const before=h.snapshot();
 await h.password();assert.equal(h.state.user.id,'employee-a');assert.equal(h.state.csrf,'synthetic-csrf-2');
 h.resolve(old,'stale-response');await pending;await flush();const afterOld=h.snapshot();
 await h.run('loadState()');await h.run('loadWorkroom()');h.state.tab='home';h.run('render()');h.state.tab='workroom';h.run('render()');await flush();
 const afterRefreshAndReturn=h.snapshot();assert.equal(h.work().length,4,'the new authentication generation starts exactly one fresh pair of GETs');assert.notEqual(h.wr.guide?.marker,'stale-response');
 const fresh=h.work().slice(2);h.resolve(fresh,'current-generation');await flush();assert.equal(h.wr.loading,false);assert.equal(h.wr.error,'');assert.equal(h.wr.guide.marker,'current-generation');assert.match(h.paints.at(-1).html,/current-generation/);assert.doesNotMatch(h.paints.at(-1).html,/제작 자료를 불러오고 있어요/);
 return{reproduced:false,before,afterOld,afterRefreshAndReturn,afterFresh:h.snapshot(),sourceOfAuthChange:'실제 app.js password submit이 합성 /api/me의 새 CSRF를 대입했습니다.',attemptedRecovery:['actual loadState + render','actual loadWorkroom refresh','home then workroom render'],guard:'새 인증 세대로 정확히 한 번 재조회하며 새 자료를 그린 뒤 로딩을 끝냅니다.'};
});
for(const oldFirst of [true,false])record(oldFirst?'different-user-old-response-before-new-response':'different-user-old-response-after-new-response',async()=>{
 const h=fixture(),oldPending=h.run('loadWorkroom()'),old=h.work().slice();h.run('clearCompanySessionView()');h.nextUser=user('employee-b');await h.submit('auth',{email:'synthetic@example.test',password:'synthetic'});await flush();const fresh=h.work().slice(2);assert.equal(fresh.length,2);const before=h.snapshot(),newRequest=h.wr.request;
 if(oldFirst){h.resolve(old,'employee-a-stale');await oldPending;await flush();assert.equal(h.wr.loading,true);assert.equal(h.wr.request,newRequest);h.resolve(fresh,'employee-b-current');}else{h.resolve(fresh,'employee-b-current');await flush();h.resolve(old,'employee-a-stale');await oldPending;}
 await flush();assert.equal(h.wr.guide.marker,'employee-b-current');assert.equal(h.wr.loading,false);assert.equal(h.wr.userId,'employee-b');assert.equal(h.wr.request,newRequest);assert.match(h.paints.at(-1).html,/employee-b-current/);
 return{reproduced:false,guard:'실제 clearCompanySessionView → auth submit → loadState → render → wrIdentity가 새 사용자 요청을 시작하며 오래된 요청은 이를 지우지 않습니다.',before,after:h.snapshot()};
});
record('same-user-old-response-does-not-clear-new-scope-request',async()=>{
 const h=fixture(),oldPending=h.run('loadWorkroom()'),old=h.work().slice();await h.password();
 h.wa.company='LAB';h.run('ensureWorkroom()');assert.equal(h.wr.loading,false);h.wa.company='PULSE';h.run('ensureWorkroom()');const fresh=h.work().slice(2);assert.equal(fresh.length,2);const request=h.wr.request;
 h.resolve(old,'stale');await oldPending;await flush();assert.equal(h.wr.loading,true);assert.equal(h.wr.request,request);h.resolve(fresh,'current');await flush();assert.equal(h.wr.guide.marker,'current');assert.equal(h.wr.loading,false);
 return{reproduced:false,guard:'회사 범위 변경으로 새 요청을 명시적으로 시작한 뒤에는 이전 인증 세대의 응답이 새 loading/request를 지우지 않습니다.',after:h.snapshot()};
});

}
