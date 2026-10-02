import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/growth-history.js',import.meta.url),'utf8');
const keys=['views','likes','followers','comments','shares','saves','reach'];
const shift=(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
const change=(delta,complete=true,baseDate='2026-08-28')=>({delta,complete,count:complete?2:delta===null?0:1,eligible:2,baseDate});
function data(){
  const values=[100,120,125,125,null,150,140];
  const daily=values.map((value,index)=>{
    const date=shift('2026-08-28',index),status=index===2?'partial':index===3?'stale':value===null?'missing':'exact',complete=status==='exact';
    const point={latest:value,total:complete?value:status==='partial'?60:null,count:complete?2:status==='partial'?1:0,latestCount:value===null?0:2,eligible:2,stale:status==='stale'?2:status==='partial'?1:0,complete,status,newest:status==='stale'?'2026-08-30':date,change:change([900,20,99,null,null,25,-10][index],index===0||index===1||index===6,shift(date,-1))};
    return{date,start:date,end:date,days:1,metrics:Object.fromEntries(keys.map(key=>[key,{...point}]))};
  });
  const metrics=Object.fromEntries(keys.map(key=>[key,{...daily.at(-1).metrics[key],change:change(40)}]));
  return{history:{start:'2026-08-28',end:'2026-09-03',days:7,lastObservedDate:'2026-09-03',daily,metrics,selection:{start:'2026-08-28',end:'2026-09-03',days:7,baselineDate:'2026-08-28',metrics}}};
}
function fixture(report=data()){
  const listeners={},calls=[],nodes={},state={tab:'history',scope:'mine',teamId:'',user:{id:'user-1',role:'member',teamId:'team-a'},data:{},report,metric:'views',historyRange:'all',historyGroup:'day',historyDate:'',historyStart:'',historyEnd:'',reportRequest:1};
  let renders=0,loads=0;
  const context=vm.createContext({state,Intl,URLSearchParams,Date,document:{addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn),querySelector:selector=>nodes[selector]||null},render:()=>renders++,loadHistoryReport:()=>loads++,isDemoMode:()=>false,query:overrides=>new URLSearchParams(Object.entries({scope:state.scope,teamId:state.teamId,...overrides}).filter(([,value])=>value!=null&&value!=='')).toString(),api:path=>new Promise((resolve,reject)=>calls.push({path,resolve,reject}))});
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  function emit(type,target,extra={}){let prevented=false;for(const fn of listeners[type]||[])fn({target,preventDefault(){prevented=true;},...extra});return prevented;}
  function action(action,value,date){const button={dataset:{historyAction:action,historyValue:value,historyDate:date},closest:selector=>selector==='[data-history-action]'?button:null};emit('click',button);}
  return{state,context,calls,nodes,run,emit,action,render:()=>run('growthHistoryPage()'),renders:()=>renders,loads:()=>loads};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('full history defaults to one cumulative series and a start-day baseline, not summed daily totals',()=>{
  const f=fixture(),html=f.render();
  assert.equal((html.match(/<article class="gh-stat">/g)||[]).length,4);
  assert.match(html,/data-history-value="all" aria-pressed="true"/);
  assert.match(html,/종료일 기준 누적<\/span><strong>140/);
  assert.match(html,/선택 시작일 대비<\/span><strong>\+40/);
  assert.match(html,/일평균 증감<\/span><strong>\+6.7/);
  assert.match(html,/최고 성장일<\/span><strong>\+20/,'baseline day 900 and partial day 99 must be excluded');
  assert.match(html,/2026-08-29 · 비교 완료 2\/6일 중/);
  assert.match(html,/data-history-hover-summary>9.3 · 140회/);
  assert.match(html,/<details class="gh-more-metrics">/);assert.match(html,/<details class="gh-method">/);
  assert.equal((html.match(/role="slider"/g)||[]).length,1);
  assert.equal((html.match(/tabindex="0"/g)||[]).length,1,'graph is one keyboard stop, not a stop for every date');
  assert.doesNotMatch(html,/900<small>|NaN|Infinity|undefined|data-action=/);
});

test('week and month grouping pick final in-range snapshots, including partial boundary buckets',()=>{
  const f=fixture();
  f.state.historyRange='custom';f.state.historyStart='2026-08-30';f.state.historyEnd='2026-09-02';
  const monthly=plain(f.run('historyVisibleRows(state.report.history,historyRangeFor(state.report.history),"month")'));
  assert.deepEqual(monthly.map(row=>[row.bucketStart,row.date,row.metrics.views.latest]),[['2026-08-30','2026-08-31',125],['2026-09-01','2026-09-02',150]]);
  const weekly=plain(f.run('historyVisibleRows(state.report.history,historyRangeFor(state.report.history),"week")'));
  assert.deepEqual(weekly.map(row=>[row.bucketStart,row.date,row.metrics.views.latest]),[['2026-08-30','2026-08-30',125],['2026-08-31','2026-09-02',150]]);
});

test('preset calendar ranges clamp to stored history and use valid month-end dates',()=>{
  const f=fixture();f.context.history={start:'2025-01-01',end:'2026-03-31'};
  assert.deepEqual(plain(f.run('historyRangeFor(history,"week")')),{start:'2026-03-25',end:'2026-03-31',days:7});
  assert.deepEqual(plain(f.run('historyRangeFor(history,"month")')),{start:'2026-03-01',end:'2026-03-31',days:31});
  assert.equal(f.run('historyRangeFor(history,"quarter").start'),'2026-01-01');
  f.context.history={start:'2026-03-29',end:'2026-03-31'};
  assert.equal(f.run('historyRangeFor(history,"week").start'),'2026-03-29');
  assert.equal(f.run('historyValidDate("2026-02-30")'),false);
});

test('request ranges follow the current date across rollover and scope changes, while custom ranges persist',()=>{
  const f=fixture();f.state.historyStart='2026-08-28';f.state.historyEnd='2026-09-03';
  assert.deepEqual(plain(f.run('historyRequestDates("2026-10-01")')),{historyStart:null,historyEnd:null},'all lets a different scope reveal older history');
  f.state.historyRange='week';assert.deepEqual(plain(f.run('historyRequestDates("2026-10-01")')),{historyStart:'2026-09-25',historyEnd:'2026-10-01'});
  f.state.historyRange='month';assert.deepEqual(plain(f.run('historyRequestDates("2027-03-31")')),{historyStart:'2027-03-01',historyEnd:'2027-03-31'});
  f.state.historyRange='quarter';assert.deepEqual(plain(f.run('historyRequestDates("2027-01-01")')),{historyStart:'2026-10-02',historyEnd:'2027-01-01'});
  f.state.historyRange='custom';assert.deepEqual(plain(f.run('historyRequestDates("2026-10-01")')),{historyStart:'2026-08-28',historyEnd:'2026-09-03'});
});

test('partial/stale/null remain distinct, gaps are not joined, and zero remains a real observation',()=>{
  const f=fixture();let html=f.render();
  assert.match(html,/gh-dot is-partial/);
  assert.equal(f.run('historyStatus(state.report.history.daily[3].metrics.views)'),'이전 기록 유지 · 마지막 2026-08-30');
  assert.equal(f.run('historyStatus(state.report.history.daily[4].metrics.views)'),'기록 없음');
  const exactOnly=html.match(/<polyline class="gh-line"[^>]+/g)||[];
  assert.ok(exactOnly.length>=1);assert.ok(exactOnly.every(path=>path.split('points="')[1].trim().split(' ').length<=2),'isolated observations cannot bridge partial or missing days');
  Object.assign(f.state.report.history.daily[1].metrics.views,{complete:false,status:'stale'});
  assert.match(f.render(),/gh-line is-stale/,'carried-forward values use a visibly different line');
  for(const row of f.state.report.history.daily)for(const key of keys)Object.assign(row.metrics[key],{latest:null,total:null,status:'missing',complete:false,change:change(null,false)});
  for(const key of keys)f.state.report.history.selection.metrics[key].change=change(null,false);
  html=f.render();assert.match(html,/이 기간에는 확인한 기록이 없어요/);assert.doesNotMatch(html,/role="slider"|NaN|Infinity|>0<small>|%/);
  const final=f.state.report.history.daily.at(-1).metrics.views;Object.assign(final,{latest:0,total:0,complete:true,status:'exact'});
  html=f.render();assert.match(html,/종료일 기준 누적<\/span><strong>0<small>회/);assert.match(html,/class="gh-dot"/);
});

test('percentage is shown only for a complete comparison with a finite rate',()=>{
  const f=fixture(),comparison=f.state.report.history.selection.metrics.views.change;comparison.rate=40;
  assert.match(f.render(),/\+40% · 2026-08-28 기준/);
  comparison.complete=false;assert.doesNotMatch(f.render(),/40%/);
  comparison.complete=true;comparison.rate=null;assert.doesNotMatch(f.render(),/%/,'zero baseline is supplied by the server as a null rate');
  comparison.rate=Infinity;assert.doesNotMatch(f.render(),/Infinity|%/);
  comparison.rate=0;assert.match(f.render(),/0% · 2026-08-28 기준/);
});

test('range mismatch hides previous summary while loading and one-day or partial periods omit average',()=>{
  const f=fixture();f.state.historyRange='custom';f.state.historyStart='2026-09-03';f.state.historyEnd='2026-09-03';f.state.loading=true;
  let html=f.render();assert.match(html,/class="gh-stats" aria-busy="true"/);assert.doesNotMatch(html,/\+40<small>|\+6.7<small>/);assert.match(html,/선택 기간을 불러오고 있어요/);
  f.state.report.history.selection={start:'2026-09-03',end:'2026-09-03',metrics:{views:{change:change(0,true,'2026-09-03')}}};f.state.loading=false;
  html=f.render();assert.match(html,/일평균 증감<\/span><strong>—/);assert.match(html,/최고 성장일<\/span><strong>—/);
  f.state.historyStart='2026-08-28';f.state.report.history.selection={start:'2026-08-28',end:'2026-09-03',metrics:{views:{change:change(18,false)}}};
  html=f.render();assert.match(html,/선택 시작일 대비<\/span><strong>\+18/);assert.match(html,/일부 대상 비교/);assert.match(html,/일평균 증감<\/span><strong>—/);
});

test('metric/group switches are local, range selection requests once, and invalid custom dates stay local',()=>{
  const f=fixture();f.action('metric','likes');f.action('group','month');
  assert.equal(f.state.metric,'likes');assert.equal(f.state.historyGroup,'month');assert.equal(f.renders(),2);assert.equal(f.loads(),0);assert.equal(f.calls.length,0);
  f.action('metric','<script>');f.action('group','year');assert.equal(f.renders(),2);
  f.action('range','week');assert.equal(f.loads(),1);assert.equal(f.state.historyStart,'2026-08-28');assert.equal(f.state.historyEnd,'2026-09-03');
  const error={textContent:''},form={elements:{historyStart:{value:'2026-09-03'},historyEnd:{value:'2026-08-28'}},querySelector:()=>error,closest:()=>form};
  assert.equal(f.emit('submit',form),true);assert.match(error.textContent,/시작일과 종료일/);assert.equal(f.loads(),1);
  form.elements.historyStart.value='2026-08-29';form.elements.historyEnd.value='2026-09-02';f.emit('submit',form);assert.equal(f.loads(),2);assert.equal(f.state.historyRange,'custom');assert.equal(f.state.historyStart,'2026-08-29');
});

test('keyboard and pointer select dates without fetching or rerendering, using the actually visible SVG',()=>{
  const f=fixture(),attributes={},hover={textContent:''},selection={innerHTML:''};
  const svg=mobile=>({classList:{contains:()=>mobile},getBoundingClientRect:()=>({width:mobile?0:500,left:100}),querySelector:()=>({setAttribute(){}})});
  const chart={getBoundingClientRect:()=>({width:500,left:100}),querySelectorAll:()=>[svg(false),svg(true)],setAttribute:(key,value)=>attributes[key]=value,focus(){},closest:selector=>selector==='[data-history-chart]'?chart:null};
  f.nodes['[data-history-chart]']=chart;f.nodes['[data-history-hover-summary]']=hover;f.nodes['[data-history-selection]']=selection;
  assert.equal(f.emit('keydown',chart,{key:'Home'}),true);assert.equal(f.state.historyDate,'2026-08-28');assert.match(hover.textContent,/8.28 · 100회/);
  f.emit('keydown',chart,{key:'ArrowRight'});assert.equal(f.state.historyDate,'2026-08-29');assert.equal(attributes['aria-valuenow'],'1');
  f.emit('pointermove',chart,{clientX:332,pointerType:'mouse'});assert.equal(f.state.historyDate,'2026-08-31','a desktop SVG narrowed by a sidebar still uses desktop plot geometry');
  f.emit('keydown',chart,{key:'End'});assert.equal(f.state.historyDate,'2026-09-03');assert.equal(f.calls.length,0);assert.equal(f.renders(),0);
  f.emit('pointermove',chart,{clientX:100,pointerType:'touch'});assert.equal(f.state.historyDate,'2026-09-03');
  f.emit('click',chart,{clientX:100});assert.equal(f.state.historyDate,'2026-08-28','touch-generated click selects and focuses the chart');
});

test('date ticks are readable at desktop/mobile intervals without duplicate dates',()=>{
  const f=fixture(),html=f.render(),desktop=html.match(/<svg class="gh-svg is-desktop"[\s\S]*?<\/svg>/)[0],mobile=html.match(/<svg class="gh-svg is-mobile"[\s\S]*?<\/svg>/)[0];
  assert.equal((desktop.match(/gh-date-tick/g)||[]).length,5);assert.equal((mobile.match(/gh-date-tick/g)||[]).length,3);
  f.state.historyRange='custom';f.state.historyStart=f.state.historyEnd='2026-09-03';
  const one=f.render();assert.equal((one.match(/gh-date-tick/g)||[]).length,2,'one date tick per responsive SVG, not five coincident labels');
});

test('day request is scoped, deduplicated, escaped, and explicitly marks partial comparison coverage',async()=>{
  const f=fixture();f.state.scope='team';f.state.teamId='team-a';
  const first=f.run('historyLoadDay("2026-09-03")');const duplicate=f.run('historyLoadDay("2026-09-03")');assert.equal(f.calls.length,1);
  const url=new URL(f.calls[0].path,'http://localhost');assert.equal(url.pathname,'/api/day');assert.equal(url.searchParams.get('scope'),'team');assert.equal(url.searchParams.get('teamId'),'team-a');assert.equal(url.searchParams.get('date'),'2026-09-03');assert.equal(url.searchParams.has('start'),false);
  f.calls[0].resolve({groups:[{label:'<img src=x onerror=alert(1)>',metrics:{views:{latest:14,count:2,eligible:2,day:{delta:-3,complete:false,count:1,eligible:2}}}}]});await first;await duplicate;
  const html=f.run('historyChannelMarkup(historyContext().selected)');assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/일부 비교 · 1\/2개 비교/);assert.match(html,/>-3<small>/);
  await f.run('historyLoadDay("2026-09-03")');assert.equal(f.calls.length,1);
});

test('late day results are ignored across date, metric, scope, report, or user changes',async()=>{
  for(const mutate of [state=>state.historyDate='2026-08-28',state=>state.metric='likes',state=>state.scope='all',state=>state.reportRequest++,state=>state.user={id:'other-user'},state=>state.user=null]){
    const f=fixture(),pending=f.run('historyLoadDay("2026-09-03")');mutate(f.state);f.calls[0].resolve({groups:[{label:'Private channel'}]});await pending;
    assert.equal(f.run('historyDayCache.result'),null);assert.doesNotMatch(f.run('historyChannelMarkup(historyContext().selected)'),/Private channel/);
  }
});

test('day errors can retry and stale errors do not replace a newer request',async()=>{
  const f=fixture();let pending=f.run('historyLoadDay("2026-09-03")');f.calls[0].reject(new Error('<private failure>'));await pending;
  assert.match(f.run('historyChannelMarkup(historyContext().selected)'),/&lt;private failure&gt;/);
  pending=f.run('historyLoadDay("2026-09-03")');assert.equal(f.calls.length,2);f.calls[1].resolve({groups:[]});await pending;assert.match(f.run('historyChannelMarkup(historyContext().selected)'),/확인한 채널 기록이 없어요/);
  const older=f.run('historyLoadDay("2026-08-28")'),newer=f.run('historyLoadDay("2026-08-29")');f.calls[2].reject(new Error('old error'));f.calls[3].resolve({groups:[{label:'Latest'}]});await older;await newer;
  const html=f.run('historyChannelMarkup(historyContext().selected)');assert.match(html,/Latest/);assert.doesNotMatch(html,/old error/);
});
