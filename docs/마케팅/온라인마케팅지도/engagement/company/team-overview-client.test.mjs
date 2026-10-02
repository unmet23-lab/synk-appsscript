import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/team-overview.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const escapeSource=appSource.split('\n').find(line=>line.startsWith('const escape ='));
const team=(id,name=id,extra={})=>({id,name,memberCount:2,channelCount:1,connectedCount:1,metrics:{views:{latest:123,latestCount:1,eligible:1,period:{delta:23}},followers:{latest:45}},...extra});
function fixture(role='admin'){
  const requests=[];let renders=0;
  const state={user:{id:'user-a',role,teamId:'marketing'},data:{teams:[{id:'marketing',active:true},{id:'design',active:true}]},scope:'team',teamId:'marketing',tab:'overview',marketingView:'summary',start:'2026-09-23',end:'2026-09-29'};
  const context=vm.createContext({state,URLSearchParams,
    api(path){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,resolve,reject});return promise;},
    render(){renders++;},isAdmin:()=>state.user?.role==='admin',
    icon:()=>'',button:(label,action)=>`<button data-action="${action}">${label}</button>`,
    validNumber:value=>typeof value==='number'&&Number.isFinite(value),number:value=>typeof value==='number'&&Number.isFinite(value)?String(value):'—',delta:value=>typeof value==='number'&&Number.isFinite(value)?String(value):'—',
  });
  vm.runInContext(escapeSource+'\n'+source,context,{filename:'team-overview.js'});
  const run=code=>vm.runInContext(code,context),cache=run('teamOverview');
  return{state,requests,cache,run,get renders(){return renders;}};
}

test('the same user and period share one request and cached comparison across selected teams',async()=>{
  const f=fixture();const first=f.run('loadTeamOverview()');
  await f.run('loadTeamOverview()');f.state.teamId='design';await f.run('loadTeamOverview()');
  assert.equal(f.requests.length,1);assert.equal(f.cache.loading,true);
  const request=new URL(f.requests[0].path,'http://localhost');
  assert.equal(request.searchParams.get('start'),f.state.start);assert.equal(request.searchParams.get('end'),f.state.end);
  assert.equal(request.searchParams.has('teamId'),false,'comparison covers permitted teams rather than only the selected detail');
  f.requests[0].resolve({teams:[team('marketing'),team('design')]});await first;
  await f.run('loadTeamOverview()');assert.equal(f.requests.length,1);assert.equal(f.cache.loading,false);
  assert.match(f.run('teamOverviewSection()'),/data-id="design" aria-pressed="true"/);
  assert.match(f.run('teamOverviewSection()'),/data-id="marketing" aria-pressed="false"/);
});

test('late results and failures from a previous period cannot replace the current comparison',async()=>{
  for(const oldOutcome of ['success','error']){
    const f=fixture(),old=f.run('loadTeamOverview()');
    f.state.start='2026-09-01';f.state.end='2026-09-30';const current=f.run('loadTeamOverview()');
    assert.equal(f.requests.length,2);
    f.requests[1].resolve({teams:[team('marketing','CURRENT PERIOD')]});await current;
    const renders=f.renders;
    if(oldOutcome==='success')f.requests[0].resolve({teams:[team('marketing','OLD PERIOD')]});else f.requests[0].reject(new Error('OLD ERROR'));
    await old;
    const html=f.run('teamOverviewSection()');assert.match(html,/CURRENT PERIOD/);assert.doesNotMatch(html,/OLD PERIOD|OLD ERROR/);
    assert.equal(f.cache.loading,false);assert.equal(f.cache.error,'');assert.equal(f.renders,renders);
  }
});

test('logout and another identity cannot display a previous user result or accept its pending response',async()=>{
  for(const destination of ['logged-out','another-user','changed-role']){
    const f=fixture(),initial=f.run('loadTeamOverview()');
    f.requests[0].resolve({teams:[team('marketing','PRIVATE USER A')]});await initial;
    assert.match(f.run('teamOverviewSection()'),/PRIVATE USER A/);
    const originalUser=f.state.user,nextUser=destination==='logged-out'?null:{id:destination==='another-user'?'user-b':'user-a',role:destination==='changed-role'?'member':'admin',teamId:'marketing'};
    f.state.user=nextUser;
    assert.doesNotMatch(f.run('teamOverviewSection()'),/PRIVATE USER A/);
    f.state.user=originalUser;const delayed=f.run('loadTeamOverview(true)');f.state.user=nextUser;
    const renders=f.renders;f.requests[1].resolve({teams:[team('marketing','LATE USER A')]});await delayed;
    assert.doesNotMatch(f.run('teamOverviewSection()'),/PRIVATE USER A|LATE USER A/);assert.equal(f.renders,renders);
    if(destination==='logged-out'){await f.run('loadTeamOverview()');assert.equal(f.requests.length,2);}
    else{
      const next=f.run('loadTeamOverview()');assert.equal(f.requests.length,3);
      f.requests[2].resolve({teams:[team('marketing','CURRENT IDENTITY')]});await next;
      assert.match(f.run('teamOverviewSection()'),/CURRENT IDENTITY/);
    }
  }
});

test('resetting an authenticated workspace invalidates pending work even if the same user returns',async()=>{
  const f=fixture(),old=f.run('loadTeamOverview()');
  f.run('resetTeamOverview()');assert.equal(f.cache.result,null);assert.equal(f.cache.loading,false);assert.equal(f.cache.error,'');
  const current=f.run('loadTeamOverview()');assert.equal(f.requests.length,2);
  f.requests[0].resolve({teams:[team('marketing','PREVIOUS SESSION')]});await old;
  assert.equal(f.cache.loading,true);assert.equal(f.cache.result,null);
  f.requests[1].resolve({teams:[team('marketing','NEW SESSION')]});await current;
  const html=f.run('teamOverviewSection()');assert.match(html,/NEW SESSION/);assert.doesNotMatch(html,/PREVIOUS SESSION/);
});

test('a failed comparison presents an escaped retry state and a retry replaces it with current results',async()=>{
  const f=fixture(),first=f.run('loadTeamOverview()');
  f.requests[0].reject(new Error('<img src=x onerror="alert(1)"> temporary failure'));await first;
  const failure=f.run('teamOverviewSection()');assert.match(failure,/team-overview-retry/);assert.match(failure,/&lt;img/);assert.doesNotMatch(failure,/<img/);assert.equal(f.cache.loading,false);
  const retry=f.run('loadTeamOverview(true)');assert.equal(f.requests.length,2);assert.equal(f.cache.error,'');assert.equal(f.cache.loading,true);
  f.requests[1].resolve({teams:[team('marketing','RECOVERED')]});await retry;
  const recovered=f.run('teamOverviewSection()');assert.match(recovered,/RECOVERED/);assert.doesNotMatch(recovered,/temporary failure|team-overview-retry/);assert.equal(f.cache.loading,false);
});

test('comparison cards show only active permitted teams and escape API names and identifiers',async()=>{
  const id='own" data-fake="unsafe',name='<img src=x onerror="alert(1)"> & Team';
  const f=fixture('member');f.state.user.teamId=id;f.state.teamId=id;
  f.state.data.teams=[{id,active:true},{id:'design',active:true},{id:'inactive',active:false}];
  const pending=f.run('loadTeamOverview()');
  f.requests[0].resolve({teams:[team(id,name),team('design','FOREIGN TEAM SECRET'),team('inactive','INACTIVE TEAM SECRET'),team('unknown','UNLISTED TEAM SECRET')]});await pending;
  const html=f.run('teamOverviewSection()');
  assert.match(html,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; Team/);
  assert.match(html,/data-id="own&quot; data-fake=&quot;unsafe"/);
  assert.doesNotMatch(html,/<img| data-fake="unsafe|FOREIGN TEAM SECRET|INACTIVE TEAM SECRET|UNLISTED TEAM SECRET/);
  assert.equal((html.match(/class="team-comparison-card"/g)||[]).length,1);
  f.state.data.teams[0].active=false;assert.equal(f.run('teamOverviewSection()'),'');
});

test('unrelated screens and unauthenticated users do not request team comparisons',async()=>{
  for(const patch of [{scope:'mine'},{tab:'content'},{marketingView:'channels'},{user:null}]){
    const f=fixture();Object.assign(f.state,patch);await f.run('loadTeamOverview()');assert.equal(f.requests.length,0);
  }
});

test('team and company comparisons are available in summary and detail views without refetching between them',async()=>{
  const f=fixture();f.state.scope='all';f.state.tab='analysis';
  const pending=f.run('loadTeamOverview()');assert.equal(f.requests.length,1);
  f.requests[0].resolve({teams:[team('marketing'),team('design')]});await pending;
  assert.equal(f.cache.loading,false);assert.equal(f.cache.result.teams.length,2);assert.ok(f.renders>=2);
  for(const scope of ['team','all'])for(const tab of ['overview','analysis']){
    Object.assign(f.state,{scope,tab});await f.run('loadTeamOverview()');assert.equal(f.requests.length,1);
  }
});
