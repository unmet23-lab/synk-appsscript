import test from 'node:test';
import assert from 'node:assert/strict';
import {collectChannel} from './collectors.mjs';

const id='UCabcdefghijklmnopqrstuv';
const url='https://www.youtube.com/channel/'+id;
const ok=data=>new Response(JSON.stringify(data),{status:200});
const error=(status,reason)=>new Response(JSON.stringify({error:{errors:[{reason}]}}),{status});
function fixture({count='0',status=404,reason='playlistNotFound',laterPage=false,wrongId=false,wrongOwner=false}={}){
  const calls=[];
  return {calls,fetchImpl:async raw=>{
    const u=new URL(raw);calls.push(u);
    assert.equal(u.origin,'https://www.googleapis.com');
    if(u.pathname.endsWith('/channels')){
      if(u.searchParams.has('mine'))return ok({items:[{id:wrongOwner?'UCzyxwvutsrqponmlkjihgfe':id}]});
      return ok({items:[{id:wrongId?'UCzyxwvutsrqponmlkjihgfe':id,snippet:{title:'Empty channel'},statistics:{videoCount:count,viewCount:'42',subscriberCount:'3'},contentDetails:{relatedPlaylists:{uploads:'UUabcdefghijklmnopqrstuv'}}}]});
    }
    assert.ok(u.pathname.endsWith('/playlistItems'),'No videos or Analytics request for an empty channel');
    if(laterPage&&!u.searchParams.has('pageToken'))return ok({items:[],nextPageToken:'second'});
    return error(status,reason);
  }};
}

for(const [name,credentials] of [['shared reader',{accessToken:'synthetic',publicOnly:true}],['API key',{apiKey:'synthetic'}],['verified owner',{accessToken:'synthetic'}]]){
  test('verified empty YouTube channel retains channel statistics with no uploads playlist: '+name,async()=>{
    const f=fixture(),r=await collectChannel(url,credentials,f);
    assert.deepEqual(r.posts,[]);assert.equal(r.channel.externalId,id);
    assert.equal(r.channel.followers,3);assert.equal(r.channel.views,42);assert.equal(r.channel.metrics.posts,0);
    assert.equal(r.coverage.status,'complete');assert.equal(r.coverage.inventoryComplete,true);assert.equal(r.coverage.pagesFetched,0);
    assert.ok(r.coverage.unavailableMetrics.includes('shares'));
    assert.ok(r.warnings.some(w=>w.includes('공개 영상이 0개')));
    assert.equal(f.calls.filter(u=>u.pathname.endsWith('/playlistItems')).length,1);
  });
}
for(const count of [undefined,null,'','abc','1'])test('missing playlist remains an error without a confirmed zero count: '+String(count),async()=>{
  const f=fixture();const fetchImpl=async raw=>{
    const r=await f.fetchImpl(raw);if(!new URL(raw).pathname.endsWith('/channels'))return r;
    const j=await r.json();j.items[0].statistics.videoCount=count;return ok(j);
  };
  await assert.rejects(collectChannel(url,{apiKey:'synthetic'},{fetchImpl}),{code:'CHANNEL_NOT_FOUND',status:404});
});
test('a later missing playlist page is never converted to an empty channel',async()=>{
  await assert.rejects(collectChannel(url,{apiKey:'synthetic'},fixture({laterPage:true})),{code:'CHANNEL_NOT_FOUND',status:404});
});
for(const [status,reason,code] of [[401,'unauthorized','AUTH_REQUIRED'],[403,'forbidden','AUTH_REQUIRED'],[403,'quotaExceeded','RATE_LIMITED'],[429,'rateLimitExceeded','RATE_LIMITED'],[500,'backendError','API_ERROR'],[404,'notFound','CHANNEL_NOT_FOUND']])test('empty YouTube channels preserve other API failures: '+status+' '+reason,async()=>{
  await assert.rejects(collectChannel(url,{apiKey:'synthetic'},fixture({status,reason})),{code,status});
});
for(const [name,options,credentials] of [['channel',{wrongId:true},{apiKey:'synthetic'}],['owner',{wrongOwner:true},{accessToken:'synthetic'}]])test('empty channel handling preserves '+name+' identity verification',async()=>{
  const f=fixture(options);await assert.rejects(collectChannel(url,credentials,f),{code:'ACCOUNT_MISMATCH'});
  assert.equal(f.calls.some(u=>u.pathname.endsWith('/playlistItems')),false);
});
test('recent YouTube polling also accepts a confirmed empty uploads playlist',async()=>{
  const f=fixture(),r=await collectChannel(url,{accessToken:'synthetic',publicOnly:true},{...f,recentSince:'2026-11-01T00:00:00Z',now:'2026-11-14T00:00:00Z'});
  assert.deepEqual(r.posts,[]);assert.equal(r.coverage.scope,'recent');assert.equal(r.coverage.status,'complete');
});
