import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('./public/team-trends.js',import.meta.url),'utf8');
function fixture(){
  const requests=[],listeners={};const state={user:{id:'one',role:'member',teamId:'alpha'},data:{},scope:'team',tab:'overview',marketingView:'summary'};
  const ctx=vm.createContext({state,URLSearchParams,document:{addEventListener:(name,fn)=>{listeners[name]=fn;}},reportToday:()=> '2026-09-30',shiftDate:(date,n)=>new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10),render(){},isDemoMode:()=>false,isAdmin:()=>false,
    api(path){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,resolve,reject});return promise;}});
  vm.runInContext(source,ctx);const run=code=>vm.runInContext(code,ctx),cache=run('teamTrends');return {state,requests,listeners,run,cache};
}
const point=(date,latest,extra={})=>({date,latest,count:1,latestCount:1,eligible:1,complete:true,change:{delta:latest,complete:true},...extra});
const payload=()=>({start:'2026-09-01',end:'2026-09-30',ownTeamId:'alpha',teams:[{id:'alpha',name:'우리 팀',isOwn:true,summary:{latest:0,count:1,eligible:1,period:{delta:0,count:1,eligible:1,complete:true}},series:[point('2026-09-01',0),point('2026-09-30',0)]},{id:'beta',name:'다른 팀',summary:{latest:15,count:1,eligible:1,period:{delta:5,count:1,eligible:1,complete:true}},series:[point('2026-09-01',10),point('2026-09-30',15)]}]});

test('defaults to the own team, exposes likes and shares, and compares other teams without depending on detail permissions',async()=>{
  const f=fixture(),promise=f.run('loadTeamTrends()');f.requests[0].resolve(payload());await promise;
  assert.equal(f.cache.selectedId,'alpha');assert.equal(f.cache.metric,'likes');assert.equal(f.run('ttVisible().length'),2);
  const html=f.run('teamTrendsSection()');assert.match(html,/우리 팀/);assert.match(html,/다른 팀/);assert.match(html,/data-team-trend-value="shares"/);assert.match(html,/내 팀 보기/);assert.match(html,/0<small>개/);
  f.cache.selectedId='beta';assert.equal(f.run('ttSelected().name'),'다른 팀');f.cache.compareId='none';assert.equal(f.run('ttVisible().length'),1);
  await f.run('loadTeamTrends()');assert.equal(f.requests.length,1);
});
test('late metric results and errors cannot replace the newer chart or an account change',async()=>{
  for(const failure of [false,true]){
    const f=fixture(),old=f.run('loadTeamTrends()');f.cache.metric='shares';const next=f.run('loadTeamTrends()');
    f.requests[1].resolve(payload());await next;
    if(failure)f.requests[0].reject(new Error('OLD SECRET'));else f.requests[0].resolve({...payload(),teams:[]});await old;
    assert.equal(f.cache.result.teams.length,2);assert.equal(f.cache.error,'');
    f.state.user={id:'two',role:'viewer',teamId:'beta'};const changed=f.run('loadTeamTrends()');assert.equal(f.cache.result,null);assert.equal(f.cache.selectedId,'');
    f.requests[2].resolve({...payload(),ownTeamId:'beta'});await changed;assert.equal(f.cache.selectedId,'beta');
  }
});
test('missing and partial points do not create zero lines, negative changes fit the chart and text is escaped',async()=>{
  const f=fixture(),promise=f.run('loadTeamTrends()'),data=payload();
  data.teams[0].name='<img src=x onerror="bad()">';data.teams[0].series=[point('2026-09-01',null,{complete:false}),point('2026-09-02',12,{complete:false}),point('2026-09-03',10,{change:{delta:-2,complete:true}})];
  data.teams[1].series=[point('2026-09-01',0),point('2026-09-02',null,{complete:false}),point('2026-09-03',0)];
  f.requests[0].resolve(data);await promise;const html=f.run('teamTrendsSection()');assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.match(html,/is-partial/);
  f.cache.mode='change';assert.match(f.run('ttChart()'),/-2개/);
});
test('error retry, empty teams and metric/period request keys keep the screen actionable',async()=>{
  const f=fixture(),first=f.run('loadTeamTrends()');f.requests[0].reject(new Error('<script>failure</script>'));await first;
  assert.match(f.run('teamTrendsSection()'),/다시 불러오기/);assert.doesNotMatch(f.run('teamTrendsSection()'),/<script>/);
  f.cache.range='all';const next=f.run('loadTeamTrends()');assert.match(f.requests[1].path,/range=all/);f.requests[1].resolve({...payload(),teams:[],ownTeamId:null});await next;
  assert.match(f.run('teamTrendsSection()'),/등록된 팀이 아직 없어요/);assert.equal(f.cache.loading,false);
});
