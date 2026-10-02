import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/growth-home.js',import.meta.url),'utf8');
const comparison=(delta,complete=true,count=2)=>({delta,complete,count,eligible:2,baseDate:'2026-08-31',endDate:'2026-09-03'});
function data(){
  const metric={today:{total:1200,latest:1200,count:2,eligible:2},yesterday:{total:1150,count:2,eligible:2},day:comparison(50),month:{current:comparison(500),previous:comparison(400),difference:100,rate:25,comparable:true},trend:[{day:1,date:'2026-09-01',value:765432,previousDate:'2026-08-01',previousValue:654321,current:comparison(765432),previous:comparison(654321)}]};
  metric.week={current:comparison(150),previous:comparison(120),difference:30,rate:25,comparable:true,trend:[1,2,3].map(day=>({day,date:`2026-09-${27+day}`,previousDate:`2026-09-${20+day}`,value:day*50,previousValue:day*40,current:comparison(day*50),previous:comparison(day*40)}))};
  return{growth:{asOf:'2026-09-30',yesterday:'2026-09-29',week:{current:{start:'2026-09-28',end:'2026-09-30',days:3},previous:{start:'2026-09-21',end:'2026-09-23',days:3},sameDayCount:true,comparisonDays:3},month:{current:{start:'2026-09-01',end:'2026-09-30',days:30},previous:{start:'2026-08-01',end:'2026-08-30',days:30},sameDayCount:true,comparisonDays:30},metrics:{views:metric}}};
}
function fixture(report=data()){
  const state={metric:'views'},context=vm.createContext({state,report,Intl});vm.runInContext(source,context);
  return{state,report,context,run:code=>vm.runInContext(code,context),render:()=>vm.runInContext('growthHomeSection(report)',context)};
}

test('home prioritizes four weekly figures, same-weekday graph, and a separate monthly comparison',()=>{
  const f=fixture(),html=f.render();
  assert.equal((html.match(/<article class="growth-stat/g)||[]).length,4);
  assert.match(html,/>150<small>회/);assert.match(html,/>120<small>회/);assert.match(html,/>\+30<small>회/);assert.match(html,/>\+100<small>회/);assert.match(html,/\+25% · 같은 요일까지 비교/);
  assert.match(html,/이번 주 누적 조회수/);assert.match(html,/지난주 누적 조회수/);assert.match(html,/전주 대비/);assert.match(html,/전월 동기 대비/);
  assert.match(html,/이번 주 조회수 증가량은 지난주 같은 기간보다 30회 높아요/);assert.match(html,/오늘 누적 1,200회 \(2\/2개 확인\)/);assert.match(html,/어제 대비 \+50회/);assert.match(html,/전체 관측일 · 이번 주 3\/3일 · 지난주 3\/3일/);
  assert.match(html,/>월<\/text>/);assert.match(html,/>화<\/text>/);assert.match(html,/>수<\/text>/);assert.doesNotMatch(html,/>목<\/text>|이번 달의 성장|765,432|654,321/);
  assert.match(html,/growth-chart-svg is-desktop/);assert.match(html,/growth-chart-svg is-mobile/);assert.match(html,/viewBox="0 0 360 230"/);
  assert.doesNotMatch(html,/data-action="report-view"/,'the workspace heading owns navigation, so the graph does not duplicate it');
  assert.match(html,/<details id="growth-other-metrics" class="growth-other-metrics">/);assert.match(html,/<details id="growth-daily-records" class="growth-data-details">/);
  assert.doesNotMatch(html,/style=|onclick=|comparison-filter|순위/);
});

test('today never substitutes stale latest values and empty growth does not invent zero',()=>{
  const f=fixture(),metric=f.report.growth.metrics.views;
  metric.today={total:null,latest:999999,count:0,eligible:2};metric.day=comparison(null,false,0);metric.month={comparable:false};metric.week={current:comparison(null,false,0),previous:comparison(null,false,0),comparable:false,trend:[]};
  const html=f.render();assert.match(html,/오늘 수집 전/);assert.match(html,/이번 주와 지난주 기록이 모두 확인되면/);assert.match(html,/이번 주의 기록을 기다리고 있어요/);assert.doesNotMatch(html,/999,999|999999|growth-curve/);assert.equal((html.match(/growth-stat-value is-missing">—/g)||[]).length,4);
});

test('measured zero and decreases keep their meaning without growth praise',()=>{
  const f=fixture(),metric=f.report.growth.metrics.views;metric.today.total=0;metric.day.delta=0;metric.week.current.delta=0;metric.week.previous.delta=0;metric.week.difference=0;metric.week.rate=0;metric.month.difference=0;metric.month.rate=0;
  let html=f.render();assert.match(html,/>0<small>회/);assert.match(html,/이번 주와 지난주 같은 기간의 조회수 증가량이 같아요/);assert.doesNotMatch(html,/늘었어요|\+0/);
  metric.week.difference=-20;metric.month.difference=-10;metric.month.rate=-2.5;html=f.render();assert.match(html,/is-negative">-20<small>회/);assert.match(html,/지난주 같은 기간보다 20회 낮아요/);assert.match(html,/>↓<\/span>/);assert.doesNotMatch(html,/늘었어요|>↑<\/span>/);
});

test('incomplete observations are explicitly partial and are never connected across gaps',()=>{
  const f=fixture(),growth=f.report.growth,metric=growth.metrics.views;growth.asOf='2026-10-02';growth.week.current.days=5;metric.day=comparison(12,false,1);metric.today.count=1;metric.week.current=comparison(20,false,1);metric.week.comparable=false;
  metric.week.trend=[{day:1,date:'2026-09-28',value:10,current:comparison(10)},{day:2,date:'2026-09-29',value:null,current:comparison(null,false,0)},{day:3,date:'2026-09-30',value:-5,current:comparison(-5)},{day:4,date:'2026-10-01',value:12,current:comparison(12,false,1)},{day:5,date:'2026-10-02',value:20,current:comparison(20)}];
  const rows=f.run('growthSeries(report.growth,report.growth.metrics.views.week)'),segments=f.run('growthSegments(growthSeries(report.growth,report.growth.metrics.views.week))');
  assert.deepEqual(Array.from(rows,row=>row.day),[0,1,2,3,4,5]);assert.deepEqual(Array.from(segments,segment=>Array.from(segment,row=>row.day)),[[0,1],[3],[5]]);
  const html=f.render();assert.match(html,/1\/2개 확인/);assert.match(html,/1\/2개 비교 · 일부 기록/);assert.match(html,/두 주의 비교 가능한 기록이 더 필요해요/);assert.match(html,/growth-dot is-current is-partial/);
  const chart=f.run('growthChart(report.growth,report.growth.metrics.views,growthMetric())');assert.equal((chart.match(/<polyline class="growth-curve is-current"/g)||[]).length,2,'only the baseline-to-first-day segment exists in each responsive view');
  metric.week.trend[0].current.complete=false;assert.notEqual(f.run('growthSeries(report.growth,report.growth.metrics.views.week)')[0].day,0,'no invented baseline when the first record is incomplete');
});

test('future points and absent previous-week dates cannot supply a plotted or tabulated value',()=>{
  const f=fixture(),metric=f.report.growth.metrics.views;
  metric.week.trend.push({day:4,date:'2026-10-01',value:987654,current:comparison(987654),previousDate:null,previousValue:876543,previous:comparison(876543)});
  assert.equal(f.run('growthSeries(report.growth,report.growth.metrics.views.week)').at(-1).value,null);assert.equal(f.run('growthSeries(report.growth,report.growth.metrics.views.week,true)').at(-1).value,null);
  const html=f.render();assert.doesNotMatch(html,/987,654|876,543|987654|876543/);
});

test('month-end day-count mismatch and incomplete months never display a comparison rate',()=>{
  const f=fixture(),growth=f.report.growth;growth.month.sameDayCount=false;growth.metrics.views.month.rate=432.1;growth.metrics.views.month.difference=4567;
  let html=f.render();assert.match(html,/두 달의 일수가 달라/);assert.doesNotMatch(html,/432.1%|4,567/);
  growth.month.sameDayCount=true;growth.metrics.views.month.comparable=false;html=f.render();assert.match(html,/두 달의 비교 가능한 기록이 더 필요/);assert.doesNotMatch(html,/432.1%|4,567/);
});

test('series use the same axes for equal amounts, preserve negative positions, and omit missing markers',()=>{
  const f=fixture(),metric=f.report.growth.metrics.views;metric.week.trend[0].value=metric.week.trend[0].previousValue=25;metric.week.trend[1].value=-25;metric.week.trend[2].value=null;
  const html=f.render(),current=html.match(/<circle class="growth-dot is-current" cx="([\d.]+)" cy="([\d.]+)"/),previous=html.match(/<circle class="growth-dot is-previous" cx="([\d.]+)" cy="([\d.]+)"/);
  assert.equal(current[1],previous[1]);assert.equal(current[2],previous[2]);
  const positions=[...html.matchAll(/<circle class="growth-dot is-current" cx="[\d.]+" cy="([\d.]+)"/g)].map(match=>Number(match[1]));assert.ok(positions[1]>positions[0]);assert.equal(positions.length,4,'two measured days in each responsive view');
});

test('all labels are escaped and metric controls use the root event contract',()=>{
  const f=fixture(),metric=f.report.growth.metrics.views;metric.week.trend[0].previousDate='"><img src=x onerror=alert(1)>';
  let html=f.render();assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|onclick=|style=/);assert.equal((html.match(/data-action="growth-metric"/g)||[]).length,7);
  f.state.metric='shares';f.report.growth.metrics.shares=metric;html=f.render();assert.match(html,/data-metric="shares" aria-pressed="true"/);assert.match(html,/id="growth-other-metrics" class="growth-other-metrics" open/);assert.match(html,/이번 주 누적 공유/);
  f.state.metric='invalid';assert.equal(f.run('growthMetric()[0]'),'views');f.context.report=null;assert.match(f.render(),/aria-busy="true"/);
});

test('followers show weekly net growth rather than claiming a sum of follower snapshots',()=>{
  const f=fixture();f.state.metric='followers';f.report.growth.metrics.followers=f.report.growth.metrics.views;const html=f.render();
  assert.match(html,/이번 주 팔로워·구독자 순증/);assert.match(html,/지난주 팔로워·구독자 순증/);assert.match(html,/주 시작 대비 팔로워·구독자 순증/);assert.match(html,/일별 누적 수치를 여러 번 더하지 않아요/);assert.doesNotMatch(html,/이번 주 누적 팔로워|지난주 누적 팔로워/);
});
