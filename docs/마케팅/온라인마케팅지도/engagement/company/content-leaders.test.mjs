import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContentLeaders } from './content-leaders.mjs';
import { recordsForOwner } from './ownership-report.mjs';

const date='2026-09-30',prior='2026-09-29';
const channel={id:'c',ready:true,displayName:'공개 채널',ownerIds:['current']};
const users=[{id:'old',name:'이전 담당'},{id:'current',name:'현재 담당'},{id:'creator',name:'제작자'}];
function records(rows){
  return {posts:rows.map(({id,title=id,...extra})=>({id,title,channelId:'c',publishedDate:'2025-01-01',...extra})),
    snapshots:rows.flatMap(row=>[...(row.before===undefined?[]:[{postId:row.id,date:prior,views:row.before}]),...(row.after===undefined?[]:[{postId:row.id,date,views:row.after,...row.observation}])]),channelSnapshots:[]};
}
const run=(data,options={})=>buildContentLeaders(data,{channels:[channel]},{date,users,...options});

test('change leaders include positive, zero and negative complete changes and sort ties by title then id',()=>{
  const data=records([{id:'positive',before:10,after:15},{id:'zero',before:5,after:5},{id:'down-b',title:'같은 제목',before:10,after:8},{id:'down-a',title:'같은 제목',before:20,after:18},{id:'unknown',after:9999}]);
  const result=run(data);
  assert.equal(result.count,4);assert.equal(result.eligible,5);assert.equal(result.complete,false);
  assert.deepEqual(result.items.map(item=>[item.rank,item.id,item.value]),[[1,'positive',5],[2,'zero',0],[3,'down-a',-2]]);
  const falling=run(records([{id:'one',before:5,after:1},{id:'two',before:4,after:2},{id:'three',before:4,after:3}]));
  assert.deepEqual(falling.items.map(item=>item.value),[-1,-2,-4]);assert.equal(falling.complete,true);
  assert.equal(run(records([{id:'unknown',after:1}])).emptyReason,'no-comparable-records');
});

test('total leaders use only exact observations, preserve a real zero, and never include future or hidden posts',()=>{
  const data=records([{id:'stale',before:9999},{id:'known',after:5},{id:'zero',after:0},{id:'null',after:null},{id:'future',publishedDate:'2026-10-01',after:99999},{id:'hidden',channelId:'secret',after:99999}]);
  const result=run(data,{mode:'total'});
  assert.equal(result.eligible,4);assert.equal(result.count,2);assert.deepEqual(result.items.map(item=>[item.id,item.value]),[['known',5],['zero',0]]);
  assert.equal(result.message,'당일 확인된 콘텐츠 기준입니다.');
  assert.equal(run(records([{id:'stale',before:5}]),{mode:'total'}).emptyReason,'no-exact-records');
});

test('creator attribution uses explicit visible creators or the same observed day, never the current channel owner',()=>{
  const own=ownerIds=>({ownership:{known:true,ownerIds}});
  for(const [extra,observation,basis,names] of [
    [{creatorIds:['creator','not-visible']},own(['old']),'creator',['제작자']],
    [{creatorName:'제작자'},own(['old']),'creator',['제작자']],
    [{creatorName:'비공개 이름'},own(['old']),'observed-owner',['이전 담당']],
    [{},own(['not-visible']),'unregistered',[]],
    [{},{},'unregistered',[]],
    [{},{...own(['old']),checkedAt:'2026-10-01T09:00:00Z'},'unregistered',[]],
  ]){
    const item=run(records([{id:'p',after:50,...extra,observation}]),{mode:'total'}).items[0];
    assert.equal(item.creatorBasis,basis);assert.deepEqual(item.creatorNames,names);
    assert.equal(Object.hasOwn(item,'observation'),false);assert.equal(Object.hasOwn(item,'post'),false);
  }
  const events=[{channelId:'c',effectiveAt:'2026-01-01T00:00:00Z',beforeOwnerIds:[],afterOwnerIds:['old']},{channelId:'c',effectiveAt:'2026-10-01T00:00:00Z',beforeOwnerIds:['old'],afterOwnerIds:['current']}];
  const item=run(records([{id:'p',after:50,observation:{checkedAt:'2026-09-30T09:00:00Z'}}]),{mode:'total',ownershipEvents:events}).items[0];
  assert.equal(item.creatorBasis,'observed-owner');assert.equal(item.creatorLabel,'당시 담당 크루');assert.deepEqual(item.creatorNames,['이전 담당']);
  const demo=run(records([{id:'p',after:50}]),{mode:'total',demo:true}).items[0];
  assert.equal(demo.creatorBasis,'demo-creator');assert.deepEqual(demo.creatorNames,['현재 담당']);
});

test('ownership-filtered comparison gaps remain incomparable while ordinary new posts may use a valid zero baseline',()=>{
  const events=[{channelId:'c',effectiveAt:'2025-01-01T00:00:00Z',beforeOwnerIds:[],afterOwnerIds:['old']},{channelId:'c',effectiveAt:'2026-09-30T00:00:00Z',beforeOwnerIds:['old'],afterOwnerIds:['current']}];
  const data=records([{id:'p',before:10,after:50}]);
  data.snapshots=data.snapshots.map(row=>({...row,checkedAt:row.date+'T09:00:00Z'}));
  const selected=recordsForOwner(data,[channel],events,'current',date);
  assert.equal(run(selected.records,{ownershipEvents:events}).count,0);
  assert.equal(run(selected.records,{mode:'total',ownershipEvents:events}).items[0].value,50);
  const newPost=records([{id:'new',publishedDate:date,after:50}]);assert.equal(run(newPost).items[0].value,50);
  newPost.posts[0].requiresRecordedBaseline=true;assert.equal(run(newPost).count,0);
});

test('followers explicitly have no per-content leaders and unsupported inputs are rejected',()=>{
  const data=records([{id:'p',after:5}]),result=run(data,{metric:'followers'});
  assert.deepEqual(result.items,[]);assert.equal(result.emptyReason,'account-metric');assert.match(result.message,/계정 지표/);
  for(const options of [{metric:'password'},{mode:'latest'},{date:'2026-02-30'}])assert.throws(()=>run(data,options));
});
