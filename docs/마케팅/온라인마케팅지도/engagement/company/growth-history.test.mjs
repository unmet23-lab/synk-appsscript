import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrowthHistory } from './growth-history.mjs';
import { metricPoint, metricIndex, compareMetric, shiftDate } from '../analytics.mjs';
import { recordsForOwner } from './ownership-report.mjs';

const channels=[{id:'c',ready:true,ownerIds:['owner']}],catalog={channels};
const make=(snapshots,posts=[{id:'a',channelId:'c',publishedDate:'2025-01-01'},{id:'b',channelId:'c',publishedDate:'2025-01-01'}],channelSnapshots=[])=>({posts,snapshots,channelSnapshots});

test('history distinguishes exact, partial, stale and missing values without summing daily cumulative snapshots',()=>{
  const records=make([
    {postId:'a',date:'2026-01-01',views:10},{postId:'b',date:'2026-01-01',views:100},
    {postId:'a',date:'2026-01-03',views:20},
    {postId:'a',date:'2026-01-04',views:null},
    {postId:'a',date:'2026-01-05',views:30},{postId:'b',date:'2026-01-05',views:210},
  ],undefined,[{channelId:'c',date:'2026-01-01',followers:0},{channelId:'c',date:'2026-01-05',followers:5}]);
  const history=buildGrowthHistory(records,catalog,{asOf:'2026-01-06'});
  assert.equal(history.start,'2026-01-01');assert.equal(history.end,'2026-01-06');assert.equal(history.lastObservedDate,'2026-01-05');assert.equal(history.days,6);
  assert.deepEqual(history.daily.map(row=>row.metrics.views.latest),[110,110,120,120,240,240]);
  assert.deepEqual(history.daily.map(row=>row.metrics.views.total),[110,null,20,null,240,null]);
  assert.deepEqual(history.daily.map(row=>row.metrics.views.status),['exact','stale','partial','stale','exact','stale']);
  assert.equal(history.daily[0].metrics.views.change.delta,null,'first observation is not newly earned growth');
  assert.equal(history.daily[4].metrics.views.change.delta,null,'missing previous observation is not zero');
  assert.equal(history.metrics.views.latest,240);assert.equal(history.metrics.views.total,null);assert.equal(history.metrics.views.change.delta,null);
  assert.equal(history.daily[0].metrics.followers.total,0);assert.ok(history.daily.every(row=>row.metrics.likes.status==='missing'));
  const src={entities:records.posts,index:metricIndex(records.snapshots,'postId'),isPost:true};
  for(const row of history.daily){
    const expected=metricPoint(src,'views',row.date);
    for(const key of Object.keys(expected))assert.deepEqual(row.metrics.views[key],expected[key],`${row.date} ${key}`);
    assert.deepEqual(row.metrics.views.change,compareMetric(src,'views',shiftDate(row.date,-1),row.date));
  }
});

test('weekly and monthly buckets use closing points and original matching endpoints, including negative corrections',()=>{
  const records=make([
    {postId:'a',date:'2026-08-30',views:100},{postId:'a',date:'2026-08-31',views:110},
    {postId:'a',date:'2026-09-01',views:130},{postId:'a',date:'2026-09-06',views:150},
    {postId:'a',date:'2026-09-07',views:140},{postId:'a',date:'2026-09-08',views:145},
  ],[{id:'a',channelId:'c',publishedDate:'2025-01-01'}]);
  const history=buildGrowthHistory(records,catalog,{asOf:'2026-09-08'});
  const week=history.weekly.find(row=>row.start==='2026-08-31');
  assert.equal(week.end,'2026-09-06');assert.equal(week.days,7);assert.equal(week.metrics.views.latest,150);assert.equal(week.metrics.views.change.delta,50);
  const month=history.monthly.find(row=>row.start==='2026-09-01');
  assert.equal(month.end,'2026-09-08');assert.equal(month.metrics.views.latest,145);assert.equal(month.metrics.views.change.delta,35);
  assert.equal(history.daily.find(row=>row.date==='2026-09-07').metrics.views.change.delta,-10);
  assert.equal(history.metrics.views.change.delta,45);assert.equal(history.metrics.views.change.baseDate,'2026-08-30');
});

test('selection summary compares raw same-entity endpoints instead of mixed-coverage aggregate subtraction',()=>{
  const records=make([
    {postId:'a',date:'2026-01-01',views:10},{postId:'b',date:'2026-01-01',views:100},
    {postId:'a',date:'2026-01-02',views:15},{postId:'a',date:'2026-01-03',views:20},
    {postId:'a',date:'2026-01-04',views:30},{postId:'b',date:'2026-01-04',views:200},
  ]);
  const history=buildGrowthHistory(records,catalog,{asOf:'2026-01-05',selectionStart:'2026-01-02',selectionEnd:'2026-01-04'}),selection=history.selection;
  assert.equal(history.days,5);assert.equal(selection.days,3);assert.equal(selection.baselineDate,'2026-01-02');
  const metric=selection.metrics.views;
  assert.equal(metric.baseline.latest,115);assert.equal(metric.latest,230);
  assert.equal(metric.change.delta,15,'230 - 115 = 115 would invent a second entity baseline');
  assert.equal(metric.change.complete,false);assert.equal(metric.change.count,1);assert.equal(metric.change.eligible,2);
  assert.deepEqual(metric.dailyCoverage,{days:3,observedDays:3,completeDays:1,partialDays:2,staleDays:0,missingDays:0});
  const clamped=buildGrowthHistory(records,catalog,{asOf:'2026-01-05',selectionStart:'2025-01-01',selectionEnd:'2026-02-01'});
  assert.equal(clamped.selection.start,'2026-01-01');assert.equal(clamped.selection.end,'2026-01-05');
  assert.throws(()=>buildGrowthHistory(records,catalog,{asOf:'2026-01-05',selectionStart:'2026-02-30'}));
  assert.throws(()=>buildGrowthHistory(records,catalog,{asOf:'2026-01-05',selectionStart:'2026-01-04',selectionEnd:'2026-01-01'}));
});

test('more than two years of history remain complete without the detailed report 366-day limit',t=>{
  const count=820,posts=Array.from({length:24},(_,i)=>({id:`p${i}`,channelId:'c',publishedDate:'2022-01-01'}));
  const snapshots=[];
  for(let day=0;day<count;day++){const date=shiftDate('2023-01-01',day);for(let p=0;p<posts.length;p++)snapshots.push({postId:posts[p].id,date,views:day*10+p,likes:day+p});}
  const records=make(snapshots,posts),before=performance.now(),history=buildGrowthHistory(records,catalog,{asOf:shiftDate('2023-01-01',count-1)});
  t.diagnostic(`820 days / 24 posts history: ${(performance.now()-before).toFixed(1)} ms`);
  assert.equal(history.daily.length,count);assert.equal(history.selection.days,count);assert.equal(history.days,count);assert.ok(history.monthly.length>24);
  assert.equal(history.metrics.views.latest,posts.length*(count-1)*10+posts.length*(posts.length-1)/2);
  assert.equal(history.selection.metrics.views.change.delta,posts.length*(count-1)*10);assert.equal(history.selection.metrics.views.change.complete,true);
});

test('history only uses visible channels and attributable owner intervals, with empty and future data staying unknown',()=>{
  const records=make([
    {postId:'a',date:'2026-01-01',views:10,checkedAt:'2026-01-01T09:00:00Z'},
    {postId:'a',date:'2026-01-03',views:50,checkedAt:'2026-01-03T09:00:00Z'},
    {postId:'a',date:'2026-01-04',views:60,checkedAt:'2026-01-04T09:00:00Z'},
    {postId:'hidden',date:'2020-01-01',views:99999},
    {postId:'a',date:'2026-01-20',views:99999},
  ],[{id:'a',channelId:'c',publishedDate:'2025-01-01'},{id:'hidden',channelId:'secret',publishedDate:'2019-01-01'}]);
  const events=[{channelId:'c',effectiveAt:'2025-01-01T00:00:00Z',beforeOwnerIds:[],afterOwnerIds:['old']},{channelId:'c',effectiveAt:'2026-01-03T00:00:00Z',beforeOwnerIds:['old'],afterOwnerIds:['new']}];
  const selected=recordsForOwner(records,channels,events,'new','2026-01-05');
  const history=buildGrowthHistory(selected.records,{channels:selected.channels},{asOf:'2026-01-05'});
  assert.equal(history.start,'2026-01-03');assert.equal(history.metrics.views.latest,60);assert.equal(history.metrics.views.total,null);
  assert.equal(history.daily[1].metrics.views.change.delta,10);assert.equal(history.daily[0].metrics.views.change.delta,null);
  const plain=buildGrowthHistory(records,catalog,{asOf:'2026-01-04'});assert.equal(plain.start,'2026-01-01');assert.equal(plain.metrics.views.latest,60);
  const empty=buildGrowthHistory(records,{channels:[]},{asOf:'2026-01-05'});
  assert.equal(empty.start,null);assert.equal(empty.days,0);assert.deepEqual(empty.daily,[]);assert.deepEqual(empty.monthly,[]);assert.equal(empty.selection.days,0);assert.equal(empty.metrics.views.latest,null);
});
