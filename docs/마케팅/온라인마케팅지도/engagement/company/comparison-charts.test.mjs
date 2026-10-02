import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/comparison-charts.js',import.meta.url),'utf8');
const metric=(latest,change=latest,previous=null)=>({latest,latestCount:latest===null?0:1,eligible:1,period:{delta:change,count:change===null?0:1,eligible:1},previousPeriod:{delta:previous,count:previous===null?0:1,eligible:1}});
function fixture(){
  const state={scope:'all',metric:'views',start:'2026-09-23',end:'2026-09-29',data:{teams:[{id:'a',name:'기획팀',active:true},{id:'b',name:'운영팀',active:false}]},comparisonExpanded:false};
  const context=vm.createContext({state,Intl,teamOverview:{key:'current',result:null},teamOverviewKey:()=> 'current'});vm.runInContext(source,context);
  return{state,context,run:code=>vm.runInContext(code,context)};
}
function report(){return{start:'2026-09-23',end:'2026-09-29',scope:{scope:'all'},channels:[{id:'c1',teamId:'a',displayName:'기획채널',platform:'youtube'},{id:'c2',teamId:null,displayName:'미배정채널',platform:'instagram'},{id:'c3',teamId:'b',displayName:'지난채널',platform:'youtube'}],groups:[{id:'c1',metrics:{views:metric(120,20)}},{id:'c2',metrics:{views:metric(null,null)}},{id:'c3',metrics:{views:metric(80,-10)}}],memberGroups:[{id:'u1',name:'유호',channelCount:1,metrics:{views:metric(120,20)}},{id:'u2',name:'미배정',channelCount:0,metrics:{views:metric(null,null)}}],byPost:[{id:'p1',channelId:'c1',title:'첫 게시물',metrics:{views:metric(120,20),followers:metric(99)}}],metrics:{views:metric(200,10,-20)}};}

test('signed bars share zero and scale while unknown and measured zero remain distinct',()=>{
  const f=fixture();f.context.rows=[{id:'positive',label:'증가',value:100},{id:'negative',label:'감소',value:-50},{id:'zero',label:'변동 없음',value:0},{id:'unknown',label:'미확인',value:null}];
  const scale=f.run('comparisonScale(rows.map(row=>row.value))');assert.equal(scale.minimum,-50);assert.equal(scale.maximum,100);assert.ok(Math.abs(scale.zero-100/3)<1e-10);
  const html=f.run("horizontalComparisonChart({rows,metricLabel:'조회수',signed:true})");
  assert.match(html,/x1="33\.3333"/);assert.match(html,/x="33\.3333" y="7" width="66\.6667"/);assert.match(html,/x="0\.0000" y="7" width="33\.3333"/);assert.match(html,/comparison-zero-value/);assert.match(html,/미확인 또는 비교 불가/);assert.match(html,/>\+100</);assert.match(html,/>-50</);assert.doesNotMatch(html,/style=/,'SVG presentation attributes respect the local-only style CSP');
});

test('null aggregate stays null and observed zero is preserved without counting dates repeatedly',()=>{
  const f=fixture();f.context.report=report();
  const rows=f.run("comparisonRows(report,'platform','views','latest')");assert.equal(rows.find(row=>row.id==='youtube').value,200);assert.equal(rows.find(row=>row.id==='instagram').value,null);
  f.context.report.groups[1].metrics.views=metric(0,0);
  assert.equal(f.run("comparisonRows(report,'platform','views','latest')").find(row=>row.id==='instagram').value,0);
});

test('all-team comparisons retain unassigned and retired channels even when a team cache exists',()=>{
  const f=fixture();f.context.report=report();f.context.teamOverview.result={teams:[{id:'a',name:'기획팀',memberCount:3,channelCount:1,metrics:{views:metric(120,20)}}]};
  const rows=f.run("comparisonRows(report,'teams','views','period')");assert.equal(rows.length,3);assert.equal(rows.find(row=>row.id==='a').value,20);assert.match(rows.find(row=>row.id==='a').secondary,/크루 3명/);assert.equal(rows.find(row=>row.id==='').label,'팀 미배정');assert.equal(rows.find(row=>row.id==='').value,null);assert.match(rows.find(row=>row.id==='b').label,/운영 종료/);assert.equal(rows.find(row=>row.id==='b').action,null);
});

test('scoped filters use report data rather than a broader team cache',()=>{
  const f=fixture();f.context.report=report();f.state.scope='team';f.state.teamId='a';f.context.teamOverview.result={teams:[{id:'a',name:'기획팀',memberCount:3,channelCount:1,metrics:{views:metric(999)}}]};
  assert.equal(f.run("comparisonRows(report,'teams','views','latest')")[0].value,999);
  f.context.report.scope.channel='c1';f.context.report.channels=f.context.report.channels.slice(0,1);f.context.report.groups=f.context.report.groups.slice(0,1);
  assert.equal(f.run("comparisonRows(report,'teams','views','latest')")[0].value,120);
  f.context.report.scope.channel='';f.context.teamOverview.key='old-period';assert.equal(f.run("comparisonRows(report,'teams','views','latest')")[0].value,120);
});

test('member comparisons exclude unassigned rows; content never invents account follower counts',()=>{
  const f=fixture();f.context.report=report();const members=f.run("comparisonRows(report,'members','views','period')");assert.equal(members.length,1);assert.equal(members[0].action,'member-filter');
  assert.equal(f.run("comparisonRows(report,'content','followers','latest')")[0].value,null);
  f.state.comparisonGroup='content';f.state.metric='followers';assert.match(f.run('comparisonChartsSection(report)'),/계정 단위 지표/);
});

test('defaults follow scope, top ten can expand, and user supplied labels and attributes are escaped',()=>{
  const f=fixture();f.context.report=report();
  for(const [scope,group]of[['mine','channels'],['team','members'],['all','teams']]){f.state.scope=scope;assert.equal(f.run('comparisonGroup()'),group);}
  f.context.rows=Array.from({length:12},(_,index)=>({id:String(index),label:`항목 ${index}`,value:index,action:'post-detail',attrs:{'data-id':String(index)}}));
  f.context.rows[11].label='<img src=x onerror=alert(1)>';f.context.rows[11].attrs={'data-id':'"><svg onload=alert(1)>',onclick:'alert(1)'};
  const html=f.run('horizontalComparisonChart({rows,maxRows:10})');assert.equal((html.match(/class="comparison-bar-row/g)||[]).length,10);assert.match(html,/&lt;img/);assert.match(html,/&quot;&gt;&lt;svg/);assert.doesNotMatch(html,/<img|<svg onload|onclick=/);
  f.state.scope='mine';f.context.report.groups=f.context.rows.map(row=>({id:row.id,label:row.label,metrics:{views:metric(row.value)}}));
  const collapsed=f.run('comparisonChartsSection(report)');assert.match(collapsed,/12개 모두 보기/);assert.equal((collapsed.match(/class="comparison-bar-row/g)||[]).length,10);
  f.state.comparisonExpanded=true;const expanded=f.run('comparisonChartsSection(report)');assert.equal((expanded.match(/class="comparison-bar-row/g)||[]).length,12);assert.match(expanded,/상위 10개만 보기/);
});

test('period graphs compare recorded deltas across equal date spans with metric-specific scales',()=>{
  const f=fixture();f.context.report=report();f.context.report.metrics.likes=metric(1000,2,8);const html=f.run('periodComparisonCharts(report)');
  assert.match(html,/2026-09-23 — 2026-09-29/);assert.match(html,/2026-09-16 — 2026-09-22/);assert.match(html,/조회수 이번 \+10 회/);assert.match(html,/조회수 직전 -20 회/);assert.match(html,/좋아요 이번 \+2 개/);assert.match(html,/팔로워·구독자 이번 비교 불가/);assert.equal((html.match(/class="period-comparison-card/g)||[]).length,7);assert.doesNotMatch(html,/1000|1,000|style=/);assert.match(html,/지표 사이의 막대 길이/);
});
