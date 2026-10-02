import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrowthSummary, growthMonthWindow, growthWeekWindow } from './growth-summary.mjs';
import { recordsForOwner } from './ownership-report.mjs';
import { dateRange } from '../analytics.mjs';

const channel={id:'c',ready:true,ownerIds:['owner'],teamId:'team'};
const post={id:'p',channelId:'c',publishedDate:'2023-01-01'};
const catalog={channels:[channel]};
function records(values,followers=values){
  return {posts:[post],snapshots:Object.entries(values).map(([date,views])=>({postId:post.id,date,views})),channelSnapshots:Object.entries(followers).map(([date,value])=>({channelId:channel.id,date,followers:value}))};
}

test('growth reports exact today, yesterday and month-to-date increase curves in the same unit',()=>{
  const rows=records({'2024-01-31':10,'2024-02-01':20,'2024-02-02':25,'2024-02-03':30,'2024-02-29':100,'2024-03-01':130,'2024-03-02':150,'2024-03-03':160});
  const before=JSON.stringify(rows),result=buildGrowthSummary(rows,catalog,{asOf:'2024-03-03'}),views=result.metrics.views;
  assert.equal(JSON.stringify(rows),before);assert.equal(result.asOf,'2024-03-03');assert.equal(result.yesterday,'2024-03-02');
  assert.equal(views.today.total,160);assert.equal(views.yesterday.total,150);assert.equal(views.day.delta,10);
  assert.equal(views.month.current.delta,60);assert.equal(views.month.previous.delta,20);
  assert.equal(views.month.difference,40);assert.equal(views.month.rate,200);assert.equal(views.month.comparable,true);
  assert.deepEqual(views.trend.map(row=>row.value),[30,50,60]);assert.deepEqual(views.trend.map(row=>row.previousValue),[10,15,20]);
  assert.deepEqual(views.trend.map(row=>row.previousDate),['2024-02-01','2024-02-02','2024-02-03']);
  assert.equal(result.metrics.followers.today.total,160);assert.equal(result.metrics.likes.today.total,null);
  assert.equal(result.metrics.likes.month.rate,null);assert.equal(result.metrics.likes.month.comparable,false);
});

test('missing exact dates stay null and a recent known value never becomes today or a connected trend point',()=>{
  const result=buildGrowthSummary(records({'2024-01-31':10,'2024-02-01':15,'2024-02-02':20,'2024-02-03':25,'2024-02-29':100,'2024-03-01':110,'2024-03-03':null}),catalog,{asOf:'2024-03-03'});
  const views=result.metrics.views;
  assert.equal(views.today.total,null);assert.equal(views.today.latest,110);assert.equal(views.today.count,0);assert.equal(views.today.stale,1);
  assert.equal(views.today.newest,'2024-03-01');assert.equal(views.yesterday.total,null);assert.equal(views.day.delta,null);
  assert.deepEqual(views.trend.map(row=>row.value),[10,null,null]);assert.equal(views.month.difference,null);
});

test('partial observations retain their coverage but cannot produce a full month comparison',()=>{
  const data=records({'2024-01-31':10,'2024-02-03':20,'2024-02-29':100,'2024-03-02':120,'2024-03-03':130});
  data.posts.push({...post,id:'p2'});
  data.snapshots.push(...data.snapshots.filter(row=>row.date!=='2024-03-03').map(row=>({...row,postId:'p2'})));
  const views=buildGrowthSummary(data,catalog,{asOf:'2024-03-03'}).metrics.views;
  assert.equal(views.today.total,130);assert.equal(views.today.latest,250);assert.equal(views.today.count,1);assert.equal(views.today.eligible,2);
  assert.equal(views.day.delta,10);assert.equal(views.day.complete,false);assert.equal(views.month.current.delta,30);
  assert.equal(views.month.current.complete,false);assert.equal(views.month.previous.complete,true);
  assert.equal(views.month.difference,null);assert.equal(views.month.rate,null);assert.equal(views.month.comparable,false);
});

test('zero growth and negative corrections remain numeric while zero or negative comparison bases have no rate',()=>{
  const zero=buildGrowthSummary(records({'2024-01-31':0,'2024-02-03':0,'2024-02-29':0,'2024-03-02':0,'2024-03-03':0}),catalog,{asOf:'2024-03-03'}).metrics.views;
  assert.equal(zero.today.total,0);assert.equal(zero.day.delta,0);assert.equal(zero.day.rate,null);
  assert.equal(zero.month.difference,0);assert.equal(zero.month.rate,null);assert.equal(zero.month.comparable,true);
  const negative=buildGrowthSummary(records({'2024-01-31':10,'2024-02-03':20,'2024-02-29':50,'2024-03-02':45,'2024-03-03':40}),catalog,{asOf:'2024-03-03'}).metrics.views;
  assert.equal(negative.day.delta,-5);assert.equal(negative.month.current.delta,-10);assert.equal(negative.month.difference,-20);assert.equal(negative.month.rate,-200);
  const falling=buildGrowthSummary(records({'2024-01-31':20,'2024-02-03':10,'2024-02-29':50,'2024-03-03':60}),catalog,{asOf:'2024-03-03'}).metrics.views;
  assert.equal(falling.month.difference,20);assert.equal(falling.month.rate,null);
});

test('calendar windows clamp short months and leap days without repeating the previous final point',()=>{
  for(const [asOf,previousEnd,previousDays] of [['2024-03-31','2024-02-29',29],['2025-03-31','2025-02-28',28],['2026-05-31','2026-04-30',30]]){
    const window=growthMonthWindow(asOf);assert.equal(window.previous.end,previousEnd);assert.equal(window.previous.days,previousDays);assert.equal(window.sameDayCount,false);
    const rows=Object.fromEntries(dateRange(window.previous.start.slice(0,8)+'01',asOf).map((date,index)=>[date,index+100]));
    const base=new Date(window.previous.start+'T00:00:00Z');base.setUTCDate(base.getUTCDate()-1);rows[base.toISOString().slice(0,10)]=99;
    const views=buildGrowthSummary(records(rows),catalog,{asOf}).metrics.views;
    assert.equal(views.month.current.complete,true);assert.equal(views.month.previous.complete,true);
    assert.equal(views.month.comparable,false);assert.equal(views.month.difference,null);assert.equal(views.month.rate,null);
    assert.equal(views.trend[previousDays-1].previousDate,previousEnd);
    for(const point of views.trend.slice(previousDays)){assert.equal(point.previousDate,null);assert.equal(point.previousValue,null);assert.equal(point.previous,null);}
  }
  assert.deepEqual(growthMonthWindow('2026-01-15'),{current:{start:'2026-01-01',end:'2026-01-15',days:15},previous:{start:'2025-12-01',end:'2025-12-15',days:15},sameDayCount:true,comparisonDays:15});
  assert.equal(growthMonthWindow('2024-02-29').previous.end,'2024-01-29');
  for(const invalid of ['2025-02-29','2026-02-30','wrong'])assert.throws(()=>growthMonthWindow(invalid));
});

test('ownership-scoped growth excludes earlier owners and cannot bridge a handover or returning owner',()=>{
  const events=[
    {channelId:'c',effectiveAt:'2024-01-01T00:00:00Z',beforeOwnerIds:[],afterOwnerIds:['old'],afterTeamId:'team'},
    {channelId:'c',effectiveAt:'2024-03-02T00:00:00Z',beforeOwnerIds:['old'],afterOwnerIds:['new'],afterTeamId:'team'},
  ];
  const data=records({'2024-01-31':10,'2024-02-03':20,'2024-02-29':100,'2024-03-01':110,'2024-03-02':130,'2024-03-03':140});
  data.posts=[{...post,publishedDate:'2024-01-02',publishedAt:'2024-01-02T00:00:00Z'}];
  data.snapshots=data.snapshots.map(row=>({...row,checkedAt:row.date+'T09:00:00Z'}));
  data.channelSnapshots=data.channelSnapshots.map(row=>({...row,checkedAt:row.date+'T09:00:00Z'}));
  const selected=recordsForOwner(data,[channel],events,'new','2024-03-03');
  const current=buildGrowthSummary(selected.records,{channels:selected.channels},{asOf:'2024-03-03'}).metrics.views;
  assert.equal(current.today.total,140);assert.equal(current.day.delta,10);assert.equal(current.month.current.delta,null);assert.equal(current.month.previous.delta,null);
  const old=recordsForOwner(data,[channel],events,'old','2024-03-03');
  assert.equal(buildGrowthSummary(old.records,{channels:old.channels},{asOf:'2024-03-03'}).metrics.views.today.total,null);
  const returnEvents=[...events,{channelId:'c',effectiveAt:'2024-03-03T00:00:00Z',beforeOwnerIds:['new'],afterOwnerIds:['old'],afterTeamId:'team'}];
  const returned=recordsForOwner(data,[channel],returnEvents,'old','2024-03-03');
  assert.equal(buildGrowthSummary(returned.records,{channels:returned.channels},{asOf:'2024-03-03'}).metrics.views.month.current.delta,null);
});

test('new posts may start at zero only when ownership permits that baseline, and unseen channels remain absent',()=>{
  const data={posts:[{id:'new',channelId:'c',publishedDate:'2024-03-02'}, {id:'foreign',channelId:'secret',publishedDate:'2023-01-01'}],snapshots:[{postId:'new',date:'2024-03-03',views:25},{postId:'foreign',date:'2024-03-03',views:90000}],channelSnapshots:[]};
  const first=buildGrowthSummary(data,catalog,{asOf:'2024-03-03'}).metrics.views;assert.equal(first.today.total,25);assert.equal(first.today.eligible,1);assert.equal(first.month.current.delta,25);
  data.posts[0].requiresRecordedBaseline=true;
  assert.equal(buildGrowthSummary(data,catalog,{asOf:'2024-03-03'}).metrics.views.month.current.delta,null);
  assert.equal(buildGrowthSummary(data,{channels:[]},{asOf:'2024-03-03'}).metrics.views.today.total,null);
});

test('weekly windows align Monday through the same weekday across month and year boundaries',()=>{
  for(const [asOf,start,previousStart,previousEnd,days] of [
    ['2026-09-28','2026-09-28','2026-09-21','2026-09-21',1],
    ['2026-09-30','2026-09-28','2026-09-21','2026-09-23',3],
    ['2026-10-04','2026-09-28','2026-09-21','2026-09-27',7],
    ['2026-01-01','2025-12-29','2025-12-22','2025-12-25',4],
    ['2024-03-01','2024-02-26','2024-02-19','2024-02-23',5],
  ])assert.deepEqual(growthWeekWindow(asOf),{current:{start,end:asOf,days},previous:{start:previousStart,end:previousEnd,days},sameDayCount:true,comparisonDays:days});
  assert.throws(()=>growthWeekWindow('2026-02-30'));
});

test('weekly increases and curves use Sunday baselines and never compare a partial week with the full last week',()=>{
  const data=records({'2026-09-20':100,'2026-09-21':110,'2026-09-22':120,'2026-09-23':130,'2026-09-27':280,'2026-09-28':300,'2026-09-29':330,'2026-09-30':340,'2026-10-04':420});
  const result=buildGrowthSummary(data,catalog,{asOf:'2026-09-30'}),views=result.metrics.views;
  assert.equal(views.today.total,340);assert.equal(views.day.delta,10);
  assert.equal(views.week.current.delta,60);assert.equal(views.week.previous.delta,30);
  assert.equal(views.week.current.baseDate,'2026-09-27');assert.equal(views.week.previous.baseDate,'2026-09-20');
  assert.equal(views.week.difference,30);assert.equal(views.week.rate,100);assert.equal(views.week.comparable,true);
  assert.deepEqual(views.week.trend.map(point=>point.value),[20,50,60]);assert.deepEqual(views.week.trend.map(point=>point.previousValue),[10,20,30]);
  assert.deepEqual(views.week.trend.map(point=>point.previousDate),['2026-09-21','2026-09-22','2026-09-23']);
  const monday=buildGrowthSummary(data,catalog,{asOf:'2026-09-28'}).metrics.views.week;
  assert.equal(monday.trend.length,1);assert.equal(monday.current.delta,20);assert.equal(monday.previous.delta,10);
  const sunday=buildGrowthSummary(data,catalog,{asOf:'2026-10-04'}).metrics.views.week;
  assert.equal(sunday.trend.length,7);assert.equal(sunday.current.delta,140);assert.equal(sunday.previous.delta,180);assert.equal(sunday.difference,-40);
  assert.equal(result.month.current.start,'2026-09-01');assert.equal(views.trend.length,30,'monthly curve remains available');
});

test('weekly comparisons preserve zeros and negative corrections, expose gaps, and withhold partial comparison rates',()=>{
  const zero=buildGrowthSummary(records({'2026-09-20':0,'2026-09-23':0,'2026-09-27':0,'2026-09-30':0}),catalog,{asOf:'2026-09-30'}).metrics.views.week;
  assert.equal(zero.current.delta,0);assert.equal(zero.previous.delta,0);assert.equal(zero.difference,0);assert.equal(zero.rate,null);assert.equal(zero.comparable,true);
  const negative=buildGrowthSummary(records({'2026-09-20':10,'2026-09-23':20,'2026-09-27':50,'2026-09-30':40}),catalog,{asOf:'2026-09-30'}).metrics.views.week;
  assert.equal(negative.current.delta,-10);assert.equal(negative.difference,-20);assert.equal(negative.rate,-200);
  const priorDrop=buildGrowthSummary(records({'2026-09-20':20,'2026-09-23':10,'2026-09-27':50,'2026-09-30':60}),catalog,{asOf:'2026-09-30'}).metrics.views.week;
  assert.equal(priorDrop.difference,20);assert.equal(priorDrop.rate,null);
  const partialData=records({'2026-09-20':10,'2026-09-23':20,'2026-09-27':50,'2026-09-28':60,'2026-09-30':80});
  partialData.posts.push({...post,id:'p2'});
  partialData.snapshots.push(...partialData.snapshots.filter(row=>row.date!=='2026-09-30').map(row=>({...row,postId:'p2'})));
  const partial=buildGrowthSummary(partialData,catalog,{asOf:'2026-09-30'}).metrics.views.week;
  assert.equal(partial.current.delta,30);assert.equal(partial.current.count,1);assert.equal(partial.current.eligible,2);
  assert.equal(partial.current.complete,false);assert.equal(partial.previous.complete,true);assert.equal(partial.comparable,false);
  assert.equal(partial.difference,null);assert.equal(partial.rate,null);assert.deepEqual(partial.trend.map(point=>point.value),[20,null,30]);
  const missing=buildGrowthSummary(records({}),catalog,{asOf:'2026-09-30'}).metrics.views.week;
  assert.equal(missing.current.delta,null);assert.equal(missing.previous.delta,null);assert.equal(missing.comparable,false);
});
