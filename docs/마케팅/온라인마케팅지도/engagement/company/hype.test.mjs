import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHypeFeed,HYPE_RULES} from './hype.mjs';

const NOW='2026-09-27T12:00:00.000Z',at=minutes=>new Date(Date.parse(NOW)+minutes*60_000).toISOString();
const channel=(id='channel-a',extra={})=>({id,platform:'youtube',displayName:'SYNK LAB',ownerIds:['yuho'],active:true,connected:true,...extra});
const post=(id='post-a',channelId='channel-a',extra={})=>({id,channelId,title:'회의록이 실행표가 되는 순간',publishedAt:at(-1440),url:'https://www.youtube.com/watch?v=abc',...extra});
const observation=(minutes,views,extra={})=>({id:`post-a:${minutes}`,postId:'post-a',channelId:'channel-a',checkedAt:at(minutes),source:'api:youtube',ownership:{ownerIds:['yuho'],known:true},views,likes:null,comments:null,shares:null,saves:null,...extra});
const users=[{id:'yuho',name:'유호'},{id:'min',name:'민서'}];
const observations=()=>[observation(-125,0),observation(-95,10),observation(-65,20),observation(-35,30),observation(-5,90)];
const feed=(extra={})=>buildHypeFeed({channels:[channel()],posts:[post()],observations:observations(),users,now:NOW,...extra});

test('real 30 minute growth compares to three earlier same-channel intervals',()=>{
  const result=feed(),item=result.items[0];
  assert.equal(result.items.length,1);assert.equal(item.kind,'acceleration');
  assert.equal(item.delta,60);assert.equal(item.normalizedDelta,60);assert.equal(item.ratio,6);
  assert.equal(item.evidence.baselineCount,3);assert.equal(item.evidence.baselineMedian,10);
  assert.equal(item.evidence.baselineStartAt,at(-125));assert.equal(item.evidence.baselineEndAt,at(-35));
  assert.equal(item.evidence.previousValue,30);assert.equal(item.evidence.currentValue,90);
  assert.equal(item.evidence.previousAt,at(-35));assert.equal(item.evidence.currentAt,at(-5));
  assert.equal(item.evidence.intervalMinutes,30);assert.match(item.summary,/유호 담당/);assert.doesNotMatch(item.summary,/올린|작성한/);
  assert.match(item.title,/^유호님 담당 콘텐츠,/);assert.doesNotMatch(item.title,/올린|작성한/);
});

test('45 minute intervals retain actual evidence and normalize speed to 30 minutes',()=>{
  const rows=[observation(-185,0),observation(-140,15),observation(-95,30),observation(-50,45),observation(-5,135)];
  const item=feed({observations:rows}).items[0];
  assert.equal(item.delta,90);assert.equal(item.normalizedDelta,60);assert.equal(item.ratio,6);
  assert.equal(item.evidence.intervalMinutes,45);assert.match(item.summary,/45분 동안 조회수 \+90회/);
});

test('same channel baseline cannot borrow later intervals or another channel',()=>{
  const rows=observations().slice(-2);
  for(let i=0;i<4;i++)rows.push(observation(-125+i*30,i*10,{id:`foreign:${i}`,postId:'foreign',channelId:'other'}));
  const result=feed({channels:[channel(),channel('other')],posts:[post(),post('foreign','other')],observations:rows});
  assert.equal(result.items.length,0);
});

test('baseline can use independent earlier posts on the same channel',()=>{
  const rows=[observation(-35,30),observation(-5,90)];
  const posts=[post()];
  for(let i=0;i<3;i++) {
    posts.push(post(`old-${i}`));
    rows.push(observation(-95,100,{postId:`old-${i}`}),observation(-65,110,{postId:`old-${i}`}));
  }
  const item=feed({posts,observations:rows}).items[0];
  assert.equal(item.postId,'post-a');assert.equal(item.ratio,6);assert.equal(item.evidence.baselineCount,3);
});

test('unknown metrics stay null and cannot be interpreted as zero or fabricated growth',()=>{
  assert.equal(feed({observations:observations().map(row=>({...row,views:null,likes:undefined,comments:'500',shares:NaN,saves:-1}))}).items.length,0);
  const rows=observations();rows.at(-2).views=null;rows.at(-1).views=1500;
  const item=feed({observations:rows}).items[0];
  assert.equal(item.kind,'milestone');assert.equal(item.delta,null);assert.equal(item.normalizedDelta,null);assert.equal(item.ratio,null);
});

test('first observed milestone reports a lifetime fact without claiming fresh growth',()=>{
  const item=feed({observations:[observation(-5,1256)]}).items[0];
  assert.equal(item.kind,'milestone');assert.equal(item.milestone,1000);assert.equal(item.value,1256);
  assert.equal(item.delta,null);assert.equal(item.ratio,null);assert.equal(item.evidence.baselineCount,0);
  assert.match(item.summary,/누적 조회수 1,256회/);assert.doesNotMatch(item.summary,/급상승|돌파|방금|배 속도|좋은 반응/);
});

test('zero baselines and tiny absolute growth do not create accelerated claims',()=>{
  const flat=observations().map((row,index)=>({...row,views:index===4?60:0}));
  assert.equal(feed({observations:flat}).items.length,0);
  const tiny=observations().map((row,index)=>({...row,views:index===4?15:index}));
  assert.equal(feed({observations:tiny}).items.length,0);
});

test('latest downward revisions are excluded even above a milestone',()=>{
  const rows=[observation(-35,2000),observation(-5,1900)];
  assert.equal(feed({observations:rows}).items.length,0);
});

test('old, future, expired, inactive, disconnected and disabled data produce no highlights',()=>{
  const cases=[
    {observations:[observation(-91,1500)]},
    {observations:[observation(1,1500)]},
    {observations:[observation(-5,1500,{expiresAt:NOW})]},
    {observations:[observation(-5,1500,{expiresAt:'invalid'})]},
    {posts:[post('post-a','channel-a',{expiresAt:NOW})]},
    {posts:[post('post-a','channel-a',{publishedAt:at(-7*1440-1)})]},
    {posts:[post('post-a','channel-a',{publishedAt:at(1)})]},
    {channels:[channel('channel-a',{active:false})]},
    {channels:[channel('channel-a',{connected:false})]},
    {channels:[channel('channel-a',{collectionDisabled:true})]}
  ];
  for(const value of cases)assert.equal(feed(value).items.length,0,JSON.stringify(value));
});

test('mismatched channels, observations before publish and source changes cannot establish growth',()=>{
  assert.equal(feed({observations:observations().map(row=>({...row,channelId:'other'}))}).items.length,0);
  assert.equal(feed({posts:[post('post-a','channel-a',{publishedAt:at(-1)})]}).items.length,0);
  const rows=observations();rows.at(-1).source='api:other';
  assert.equal(feed({observations:rows}).items.length,0);
});

test('15–90 minute interval bounds are enforced without inventing a previous timestamp',()=>{
  for(const gap of [14,91]) {
    const item=feed({observations:[observation(-5-gap,1000),observation(-5,1500)]}).items[0];
    assert.equal(item.kind,'milestone');assert.equal(item.delta,null);assert.equal(item.evidence.previousAt,null);
  }
  const item=feed({observations:[observation(-20,1000),observation(-5,1500)]}).items[0];
  assert.equal(item.delta,500);assert.equal(item.normalizedDelta,1000);assert.equal(item.evidence.intervalMinutes,15);
});

test('duplicate timestamps cannot multiply baseline samples and conflicts become unknown',()=>{
  const rows=observations().slice(-3);rows.push(...rows.map(row=>({...row,id:row.id+':duplicate'})));
  assert.equal(feed({observations:rows}).items.length,0);
  const conflicting=observations();conflicting.push(observation(-5,5000,{id:'conflict'}));
  assert.equal(feed({observations:conflicting}).items.length,0);
});

test('unknown historical ownership does not credit a current replacement owner',()=>{
  const rows=observations();rows.at(-1).ownership={ownerIds:[],known:false};
  const item=feed({channels:[channel('channel-a',{ownerIds:['min']})],observations:rows}).items[0];
  assert.deepEqual(item.owners,[]);assert.equal(item.attribution,'담당 확인 필요');assert.doesNotMatch(item.summary,/민서|유호/);
  assert.match(item.title,/^이 콘텐츠,/);assert.doesNotMatch(item.title,/민서|유호/);
  rows.at(-1).ownership={ownerIds:['yuho'],known:true};
  assert.deepEqual(feed({channels:[channel('channel-a',{ownerIds:['min']})],observations:rows}).items[0].owners,[{id:'yuho',name:'유호'}]);
});

test('one card per post, at most three, with channel and teammate variety',()=>{
  const channels=[channel(),channel('channel-b',{ownerIds:['min']}),channel('channel-c')];
  const posts=[post(),post('post-b'),post('post-c','channel-b'),post('post-d','channel-c')];
  const rows=posts.flatMap((p,index)=>observations().map((row,i)=>({...row,id:p.id+':'+i,postId:p.id,channelId:p.channelId,views:row.views*(5-index),likes:row.views,ownership:{ownerIds:[index===2?'min':'yuho'],known:true}})));
  const result=feed({channels,posts,observations:rows});
  assert.equal(result.items.length,3);assert.equal(new Set(result.items.map(item=>item.postId)).size,3);
  assert.equal(new Set(result.items.map(item=>item.channelId)).size,3);assert.equal(result.items[0].postId,'post-a');
  assert.ok(result.items.some(item=>item.owners.some(owner=>owner.id==='min')));
});

test('ranking is deterministic, inputs are unchanged and item IDs persist across refresh',()=>{
  const input={channels:[channel()],posts:[post()],observations:observations(),users,now:NOW};
  const saved=structuredClone(input),first=buildHypeFeed(input),second=buildHypeFeed({...input,now:at(10)});
  assert.deepEqual(input,saved);assert.equal(first.items[0].id,second.items[0].id);
  assert.deepEqual(first,buildHypeFeed({...input,observations:[...input.observations].reverse()}));
  assert.deepEqual(first.rules,HYPE_RULES);assert.equal(first.eligiblePostCount,1);assert.equal(first.observedPostCount,1);assert.equal(first.latestObservationAt,at(-5));
});

test('unsafe links and invalid reference time cannot escape the feed contract',()=>{
  const item=feed({posts:[post('post-a','channel-a',{url:'javascript:alert(1)',thumbnailUrl:'http://insecure/image'})]}).items[0];
  assert.equal(item.url,null);assert.equal(item.thumbnailUrl,null);
  assert.throws(()=>feed({now:'not a date'}),/기준 시각/);
  assert.deepEqual(buildHypeFeed({now:NOW}).items,[]);
});

test('delayed Analytics batches remain lifetime records, never live acceleration',()=>{
  const rows=observations().map(row=>({...row,views:null,shares:row.views,metricPeriods:{shares:{source:'youtube-analytics-api-v2',lagged:true}}}));
  const item=feed({observations:rows}).items[0];
  assert.equal(item.kind,'milestone');assert.equal(item.metric,'shares');assert.equal(item.value,90);
  assert.equal(item.delta,null);assert.equal(item.normalizedDelta,null);assert.equal(item.ratio,null);
  assert.equal(item.evidence.lagged,true);assert.equal(item.evidence.source,'youtube-analytics-api-v2');
  assert.match(item.evidence.comparisonLabel,/지연 반영/);assert.doesNotMatch(item.title,/이어지고|속도/);
  rows.at(-1).metricPeriods.shares.lagged=false;
  assert.equal(feed({observations:rows}).items[0].kind,'milestone','a new direct reading cannot use old delayed baselines');
});
