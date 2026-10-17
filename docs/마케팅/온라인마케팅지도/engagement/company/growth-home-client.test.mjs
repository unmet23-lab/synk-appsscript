import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildGrowthHistory} from './growth-history.mjs';

const read=name=>readFileSync(new URL('./public/'+name,import.meta.url),'utf8');
const app=read('app.js');
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));
const lines=prefixes=>prefixes.map(prefix=>app.split('\n').find(line=>line.startsWith(prefix))).join('\n');
const detail={total:200,count:1,eligible:1,delta:20,complete:true};
const metric=(total,delta)=>({today:{...detail,total},day:{...detail,delta},week:{current:{...detail,delta:delta*3},previous:{...detail,delta:delta*2},difference:delta,rate:delta?50:null,comparable:true,trend:[]},month:{current:detail,previous:detail,difference:0,rate:0,comparable:true},trend:[]});
const report=()=>({growth:{asOf:'2026-09-30',yesterday:'2026-09-29',week:{current:{start:'2026-09-28',end:'2026-09-30',days:3},previous:{start:'2026-09-21',end:'2026-09-23',days:3},sameDayCount:true},month:{current:{start:'2026-09-01',end:'2026-09-30',days:30},previous:{start:'2026-08-01',end:'2026-08-30',days:30},sameDayCount:true},metrics:{views:metric(200,20),likes:metric(12,2),followers:metric(7,0)}},byPost:[]});
function fixture({scope='mine',demo=false,role='admin',today='2026-09-30'}={}){
  const handlers=[],requests=[],calls={hype:0,renders:0};
  const state={user:{id:'u',role,teamId:'team-a'},data:{teams:[{id:'team-a',name:'내 팀'},{id:'team-b',name:'다른 팀'}],channels:[{id:'c',teamId:'team-a',owners:[{id:'u'}]}],...(demo?{demo:{enabled:true,anchorDate:'2026-08-19'}}:{})},tab:'overview',marketingView:'summary',scope,teamId:scope==='team'?'team-a':'',start:'2026-05-02',end:'2026-05-08',range:'custom',metric:'views',report:null,reportRequest:0,ownerId:'',platform:'',channel:'',analysisView:'daily',homeExtrasOpen:false};
  const location=new URL('http://localhost:4191/'+(demo?'?demo=1&persona=a':''));
  const context=vm.createContext({state,location,URL,URLSearchParams,Intl,cp:{view:'library'},
    isAdmin:()=>state.user?.role==='admin',canManageTeam:()=>['admin','manager'].includes(state.user?.role),isViewer:()=>state.user?.role==='viewer',
    dateToday:()=>today,shiftDate:(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10),
    api:async url=>{requests.push(url);return url.startsWith('/api/team-overview')?{teams:[]}:report();},
    render(){calls.renders++;},loadHype:async()=>{calls.hype++;},notify(){},icon:()=>'',
    topContentSection:()=>'<section data-extra="content">콘텐츠</section>',healthPanel:()=>'<section data-extra="operations">운영</section>',hypeSection:()=>'<section data-extra="hype">최근 반응</section>',
    window:{addEventListener(){},scrollTo(){}},document:{addEventListener(type,handler,capture=false){handlers.push({type,handler,capture});},getElementById(){return null;}},MutationObserver:class{observe(){}},
    history:{replaceState(){}},overlay:{querySelector(){return null;}},
  });
  const run=code=>vm.runInContext(code,context);
  run(between('const METRICS =','const PLATFORMS ='));
  run(lines(['const escape =','const validNumber =','const numberFormatter =','const number =','function query(','function scopedChannels(','function scopeLabel(','function reportTabs(','function button(','function empty(']));
  for(const file of ['workspace.js','demo-ui.js','team-overview.js','growth-home.js'])run(read(file));
  run(between('async function loadReport()','function startPolling()'));
  run(between('function marketingScopeEmpty()','function contextBar('));
  run(between('function marketingReportSwitch()','function marketingReportHeading('));
  run(between('function overviewPage()','function hypeSection()'));
  run(between("document.addEventListener('toggle'", "document.addEventListener('change', async"));
  const changeStart=app.indexOf("document.addEventListener('change', async");
  run(app.slice(changeStart,app.indexOf("document.addEventListener('input',",changeStart)));
  const dispatch=async(type,target)=>{
    const event={target,preventDefault(){},stopped:false,stopImmediatePropagation(){this.stopped=true;}};
    for(const listener of handlers.filter(row=>row.type===type).sort((a,b)=>Number(b.capture)-Number(a.capture))){await listener.handler(event);if(event.stopped)break;}
  };
  const click=(action,data={})=>dispatch('click',{dataset:{action,...data},disabled:false,classList:{contains:()=>false},closest(selector){return selector==='[data-action]'?this:null;}});
  return{state,location,context,requests,calls,run,dispatch,click};
}

test('home requests only Monday-to-today growth data for the chosen scope and does not fetch hidden extras',async()=>{
  for(const scope of ['mine','team','all'])for(const demo of [false,true]){
    const f=fixture({scope,demo});Object.assign(f.state,{ownerId:'old-owner',platform:'youtube',channel:'old-channel'});
    await f.run('loadReport()');assert.equal(f.requests.length,1);assert.equal(f.calls.hype,0);
    const query=new URL(f.requests[0],'http://localhost').searchParams;
    assert.equal(query.get('growth'),'1');assert.equal(query.get('scope'),scope);assert.equal(query.get('teamId'),scope==='team'?'team-a':null);
    assert.equal(query.get('start'),demo?'2026-08-17':'2026-09-28');assert.equal(query.get('end'),demo?'2026-08-19':'2026-09-30');assert.equal(f.state.range,'custom');
    for(const key of ['ownerId','platform','channel'])assert.equal(query.has(key),false);
  }
});

test('calendar weeks start on Monday even on Sundays and across month or year boundaries',async()=>{
  for(const [today,monday] of [['2026-09-28','2026-09-28'],['2026-10-04','2026-09-28'],['2027-01-01','2026-12-28']]){
    const f=fixture({today});await f.run('loadReport()');
    const query=new URL(f.requests.at(-1),'http://localhost').searchParams;
    assert.equal(query.get('start'),monday);assert.equal(query.get('end'),today);assert.equal(f.state.range,'custom');
  }
});

test('home to historical analysis and back resets only the home period while preserving scope and analysis filters',async()=>{
  const f=fixture({scope:'team'});await f.run('loadReport()');await f.click('report-view',{view:'analysis'});
  const firstAnalysis=new URL(f.requests.filter(url=>url.startsWith('/api/analytics')).at(-1),'http://localhost').searchParams;
  assert.equal(firstAnalysis.get('start'),'2026-09-28');assert.equal(firstAnalysis.get('end'),'2026-09-30');assert.equal(firstAnalysis.has('growth'),false);assert.equal(f.state.range,'custom');
  Object.assign(f.state,{start:'2026-04-02',end:'2026-04-08',range:'custom',ownerId:'owner-a',platform:'youtube',channel:'channel-a'});
  await f.run('loadReport()');
  const detailUrl=new URL(f.requests.filter(url=>url.startsWith('/api/analytics')).at(-1),'http://localhost');
  assert.equal(detailUrl.searchParams.has('growth'),false);assert.equal(detailUrl.searchParams.get('start'),'2026-04-02');assert.equal(detailUrl.searchParams.get('end'),'2026-04-08');
  assert.equal(detailUrl.searchParams.get('ownerId'),'owner-a');assert.equal(detailUrl.searchParams.get('platform'),'youtube');assert.equal(detailUrl.searchParams.get('channel'),'channel-a');assert.equal(f.state.range,'custom');
  assert.ok(f.requests.some(url=>url.startsWith('/api/team-overview')),'comparison is loaded when detail analysis needs it');
  const before=f.requests.length;await f.click('report-view',{view:'overview'});
  assert.equal(f.requests.length,before+1,'returning home only loads its summary');
  const homeUrl=new URL(f.requests.at(-1),'http://localhost');assert.equal(homeUrl.searchParams.get('start'),'2026-09-28');assert.equal(homeUrl.searchParams.get('end'),'2026-09-30');assert.equal(homeUrl.searchParams.get('growth'),'1');assert.equal(f.state.range,'custom');
  assert.equal(homeUrl.searchParams.get('scope'),'team');assert.equal(homeUrl.searchParams.get('teamId'),'team-a');for(const key of ['ownerId','platform','channel'])assert.equal(homeUrl.searchParams.has(key),false);
  assert.equal(f.state.scope,'team');assert.equal(f.state.teamId,'team-a');assert.equal(f.calls.hype,0);
});

test('metric controls render the selected growth statistic without refetching or changing scope',async()=>{
  for(const demo of [false,true]){
    const f=fixture({demo});await f.run('loadReport()');const count=f.requests.length,oldRenders=f.calls.renders;
    await f.click('growth-metric',{metric:'likes'});
    assert.equal(f.state.metric,'likes');assert.equal(f.state.tab,'overview');assert.equal(f.state.scope,'mine');assert.equal(f.requests.length,count);assert.ok(f.calls.renders>oldRenders);
    const html=f.run('overviewPage()');assert.match(html,/이번 주 누적 좋아요/);assert.match(html,/지난주 누적 좋아요/);assert.match(html,/>6<small>개/);assert.match(html,/>4<small>개/);assert.match(html,/오늘 누적 12개/);assert.match(html,/어제 대비 \+2개/);
    await f.click('growth-metric',{metric:'unknown'});assert.equal(f.state.metric,'likes');assert.equal(f.requests.length,count);
  }
});

test('the initial home exposes four weekly figures and one history link while extras start collapsed',async()=>{
  const f=fixture();await f.run('loadReport()');const html=f.run('overviewPage()');
  assert.equal((html.match(/data-action="report-view" data-view="history"/g)||[]).length,1);assert.match(html,/이번 주 누적 조회수/);assert.equal((html.match(/<article class="growth-stat/g)||[]).length,4);
  const extras=html.match(/<details class="growth-home-extras"[^>]*>/)?.[0];assert.ok(extras);assert.doesNotMatch(extras,/\bopen\b/);
  assert.match(html,/<summary>콘텐츠와 운영 현황<\/summary>/);assert.ok(html.indexOf('data-extra="content"')>html.indexOf(extras));
  assert.doesNotMatch(html,/data-date=|data-filter=|data-comparison-filter=|data-action="add-channel"|\/api\/export\.csv|기간별 성과 비교|대상별 성과 비교/);
  f.state.user.role='viewer';f.state.data.channels=[];const empty=f.run('overviewPage()');assert.doesNotMatch(empty,/data-tab="channels"|data-tab="members"|채널 등록/);
});

test('history requests separate the current endpoint and history selection from stale analysis dates',async()=>{
  for(const scope of ['mine','team','all'])for(const demo of [false,true]){
    const f=fixture({scope,demo});Object.assign(f.state,{tab:'history',start:'2024-01-01',end:'2024-01-07',ownerId:'old-owner',platform:'youtube',channel:'old-channel',homeExtrasOpen:true,historyRange:'custom',historyStart:'2025-03-01',historyEnd:'2025-03-31'});
    await f.run('loadReport()');assert.equal(f.requests.length,1);assert.equal(f.calls.hype,0);assert.equal(f.run('reportTabs()'),true);
    const query=new URL(f.requests[0],'http://localhost').searchParams,today=demo?'2026-08-19':'2026-09-30';
    assert.equal(query.get('history'),'1');assert.equal(query.get('growth'),null);assert.equal(query.get('start'),today);assert.equal(query.get('end'),today);
    assert.equal(query.get('scope'),scope);assert.equal(query.get('teamId'),scope==='team'?'team-a':null);
    for(const key of ['ownerId','platform','channel'])assert.equal(query.has(key),false);
    assert.equal(query.get('historyStart'),'2025-03-01');assert.equal(query.get('historyEnd'),'2025-03-31');
    assert.equal(f.state.start,'2024-01-01');assert.equal(f.state.end,'2024-01-07');assert.equal(f.state.historyStart,'2025-03-01');assert.equal(f.state.historyEnd,'2025-03-31');
  }
});

test('history navigation and return to weekly home preserve scope and exclude hidden team and hype requests',async()=>{
  for(const scope of ['mine','team','all'])for(const demo of [false,true]){
    const f=fixture({scope,demo});Object.assign(f.state,{tab:'analysis',start:'2022-02-01',end:'2022-02-07',ownerId:'selected-owner',historyRange:'year',historyGroup:'month'});
    await f.click('report-view',{view:'history'});
    assert.equal(f.state.tab,'history');assert.equal(f.state.scope,scope);assert.equal(f.state.teamId,scope==='team'?'team-a':'');assert.equal(f.requests.length,1);assert.equal(f.calls.hype,0);
    assert.equal(f.run('workspacePrimaryView()'),'social','10-14부터 마케팅 분석은 레일의 「SNS·마케팅」(social) 안에 있다');assert.match(f.run('marketingNavigation()'),new RegExp(`data-tab="${scope}" class="active" aria-current="page"`));
    const historyQuery=new URL(f.requests.at(-1),'http://localhost').searchParams;assert.equal(historyQuery.get('history'),'1');assert.equal(historyQuery.get('end'),demo?'2026-08-19':'2026-09-30');assert.equal(historyQuery.get('historyStart'),null);assert.equal(historyQuery.get('historyEnd'),null);
    await f.click('report-view',{view:'overview'});assert.equal(f.state.tab,'overview');assert.equal(f.state.scope,scope);assert.equal(f.requests.length,2);assert.equal(f.calls.hype,0);
    const homeQuery=new URL(f.requests.at(-1),'http://localhost').searchParams;assert.equal(homeQuery.get('growth'),'1');assert.equal(homeQuery.get('history'),null);assert.equal(homeQuery.get('start'),demo?'2026-08-17':'2026-09-28');assert.equal(homeQuery.get('end'),demo?'2026-08-19':'2026-09-30');
    assert.equal(f.state.historyRange,'year');assert.equal(f.state.historyGroup,'month');assert.equal(f.state.ownerId,'selected-owner');
  }
});

test('switching teams clears an old custom period before loading a team whose first record is later',async()=>{
  for(const demo of [false,true]){
    const f=fixture({scope:'team',demo});Object.assign(f.state,{tab:'history',historyRange:'custom',historyStart:'2026-01-01',historyEnd:'2026-01-31',historyDate:'2026-01-15',historyGroup:'month'});
    const records={posts:[{id:'new-post',channelId:'new-channel',publishedDate:'2026-06-01'}],snapshots:[{postId:'new-post',date:'2026-06-02',views:10},{postId:'new-post',date:'2026-08-19',views:20}],channelSnapshots:[]},catalog={channels:[{id:'new-channel',ready:true}]};
    // This is the original failure: the previous team's January selection predates the new team's records.
    assert.throws(()=>buildGrowthHistory(records,catalog,{asOf:'2026-09-30',selectionStart:f.state.historyStart,selectionEnd:f.state.historyEnd}),/보존된 기록이 없습니다/);
    f.context.api=async url=>{f.requests.push(url);const params=new URL(url,'http://localhost').searchParams;return{history:buildGrowthHistory(records,catalog,{asOf:params.get('end'),selectionStart:params.get('historyStart')||undefined,selectionEnd:params.get('historyEnd')||undefined})};};
    await f.dispatch('change',{value:'team-b',dataset:{},hasAttribute:name=>name==='data-scope-team'});
    assert.equal(f.state.tab,'history');assert.equal(f.state.scope,'team');assert.equal(f.state.teamId,'team-b');assert.equal(f.state.historyRange,'all');
    for(const key of ['historyStart','historyEnd','historyDate'])assert.equal(f.state[key],'');
    assert.equal(f.state.historyGroup,'month','display grouping remains a preference');assert.equal(f.state.error,'');assert.equal(f.state.loading,false);assert.equal(f.state.report.history.start,'2026-06-02');assert.equal(f.state.report.history.selection.start,'2026-06-02');
    const params=new URL(f.requests.at(-1),'http://localhost').searchParams;assert.equal(params.get('teamId'),'team-b');assert.equal(params.get('history'),'1');assert.equal(params.get('historyStart'),null);assert.equal(params.get('historyEnd'),null);
    assert.equal(f.requests.length,1);assert.equal(f.calls.hype,0);
  }
});

test('supplementary hype loads only on an explicit open and never in demo mode',async()=>{
  for(const demo of [false,true]){
    const f=fixture({demo});const target={id:'growth-home-extras',isConnected:true,open:true};
    await f.dispatch('toggle',{...target,isConnected:false});assert.equal(f.calls.hype,0);
    await f.dispatch('toggle',target);assert.equal(f.state.homeExtrasOpen,true);assert.equal(f.calls.hype,demo?0:1);
    await f.dispatch('toggle',target);assert.equal(f.calls.hype,demo?0:1,'render-generated duplicate toggle does not reload');
    await f.dispatch('toggle',{...target,open:false});assert.equal(f.state.homeExtrasOpen,false);
    f.state.tab='analysis';await f.dispatch('toggle',target);assert.equal(f.state.homeExtrasOpen,false);
    f.state.tab='overview';f.state.homeExtrasOpen=true;await f.run('loadReport()');assert.equal(f.calls.hype,demo?0:2);
  }
});
