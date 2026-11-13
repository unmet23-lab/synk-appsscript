import {workspaceClientContext} from './workspace-access-test-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const workspace=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const initializeSource=app.slice(app.indexOf('async function initialize()'),app.indexOf('async function loadState()'));
const slice=name=>{const start=app.indexOf(`function ${name}()`);return app.slice(start,app.indexOf('\nfunction ',start+1));};

// Real workspace routing plus the real initialize(); only the network, sign-in checks and painting are stubbed.
function fixture({role,search}){
  const location=new URL('http://localhost:4191/'+search),seen={};
  const state={user:null,tab:'home',marketingView:'summary',scope:'mine',teamId:'',reportRequest:0};
  const context=workspaceClientContext({state,cp:{view:'library'},location,URL,URLSearchParams,
    canManageTeam:()=>['admin','manager'].includes(state.user?.role),isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',isDemoMode:()=>false,
    window:{addEventListener(){},scrollTo(){}},document:{hidden:false,addEventListener(){},getElementById(){return null;}},MutationObserver:class{observe(){}},
    history:{replaceState(_a,_b,value){location.href=new URL(value,location).href;}},render(){},icon:()=>'',
    api:async path=>{assert.equal(path,'/api/me');return {user:role?{id:'tester',role}:null,csrfToken:'csrf'};},
    loadState:async()=>{seen.tabAtLoad=state.tab;},reportTabs:()=>false,startPolling(){},renderAuth(){seen.auth=true;},notify(){},app:{innerHTML:''},escape:String});
  vm.runInContext(workspace+'\n'+initializeSource,context);
  return {state,seen,run:code=>vm.runInContext(code,context)};
}

test('a direct team or settings link opens that screen once the role is known',async()=>{
  for(const [role,search,tab] of [['admin','?tab=members','members'],['manager','?tab=members','members'],['admin','?tab=settings','settings']]){
    const f=fixture({role,search});await f.run('initialize()');
    assert.equal(f.state.tab,tab,`${role} ${search}`);assert.equal(f.seen.tabAtLoad,tab,'the first paint and URL sync already use the requested screen');
    assert.equal(f.state.requestedView,null);
  }
});

test('roles without access stay on the home screen as before',async()=>{
  for(const [role,search] of [['member','?tab=members'],['viewer','?tab=members'],['manager','?tab=settings'],['member','?tab=settings']]){
    const f=fixture({role,search});await f.run('initialize()');assert.equal(f.state.tab,'home',`${role} ${search}`);
  }
});

test('a signed-out visit keeps the request for the sign-in form and the login path chooses it before loading',async()=>{
  const f=fixture({role:null,search:'?tab=settings'});await f.run('initialize()');
  assert.equal(f.seen.auth,true);assert.equal(f.state.tab,'home');assert.equal(f.state.requestedView[0],'settings');
  f.state.user={id:'tester',role:'admin'};f.run('selectRequestedView()');assert.equal(f.state.tab,'settings');assert.equal(f.state.requestedView,null);
  const login=app.split('\n').find(line=>line.includes("const me = synkEntry?.me||await api('/api/me')")&&line.includes('state.user = me.user'));
  assert.match(login,/state\.user = me\.user;.*selectRequestedView\(\);.*await loadState\(\)/);
});

function emptyFixture(user,teams){
  const state={user,scope:'team',teamId:'',data:{teams}};
  const context=workspaceClientContext({state,isAdmin:()=>state.user.role==='admin',isViewer:()=>state.user.role==='viewer',
    button:(label,action,_icon,_kind,attrs='')=>`<button data-action="${action}" ${attrs}>${label}</button>`,empty:(title,text,actions)=>`<h3>${title}</h3><p>${text}</p>${actions}`});
  vm.runInContext(slice('marketingScopeEmpty'),context);return vm.runInContext('marketingScopeEmpty()',context);
}

test('the team status empty state tells an administrator to restart a paused team, and keeps the no-team text otherwise',()=>{
  const paused=emptyFixture({role:'admin'},[{id:'old',active:false}]);
  assert.match(paused,/운영 중인 팀이 없어요/);assert.match(paused,/멈춘 팀을 다시 운영하거나 새 팀을 만들어/);assert.match(paused,/data-tab="members"/);
  const none=emptyFixture({role:'admin'},[]);assert.match(none,/팀을 만들면 팀별 현황이 보여요/);assert.match(none,/팀을 만들고 크루와 채널을 넣어/);
  const member=emptyFixture({role:'member'},[{id:'old',active:false}]);assert.match(member,/관리자에게 팀에 넣어 달라고/);assert.doesNotMatch(member,/data-tab="members"/);
});
