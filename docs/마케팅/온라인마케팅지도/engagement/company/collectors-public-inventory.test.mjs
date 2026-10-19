import test from 'node:test';
import assert from 'node:assert/strict';
import {collectChannel} from './collectors.mjs';
const ok=data=>new Response(JSON.stringify(data),{status:200});
test('shared YouTube authorization reads public videos only and never asks for mine or Analytics',async()=>{
  const urls=[],id='UCabcdefghijklmnopqrstuv',r=await collectChannel('https://www.youtube.com/@brief',{accessToken:'synthetic',publicOnly:true},{fetchImpl:async raw=>{const u=new URL(raw);urls.push(u);assert.equal(u.origin,'https://www.googleapis.com');assert.equal(u.searchParams.has('mine'),false);if(u.pathname.endsWith('/channels'))return ok({items:[{id,snippet:{title:'Brief'},statistics:{videoCount:'1',viewCount:'12',subscriberCount:'0'},contentDetails:{relatedPlaylists:{uploads:'UPLOADS'}}}]});if(u.pathname.endsWith('/playlistItems'))return ok({items:['abcdefghijk','lmnopqrstuv','zyxwvutsrqp'].map(videoId=>({contentDetails:{videoId}}))});return ok({items:['public','private','unlisted'].map((privacyStatus,i)=>({id:['abcdefghijk','lmnopqrstuv','zyxwvutsrqp'][i],snippet:{channelId:id,publishedAt:'2026-10-01T00:00:00Z',title:privacyStatus},status:{privacyStatus},statistics:{viewCount:'12',likeCount:'0'}}))});}});
  assert.equal(r.posts.length,1);assert.equal(r.posts[0].externalId,'abcdefghijk');assert.equal(r.coverage.ownerAuthorized,false);assert.equal(r.coverage.inventoryComplete,true);assert.ok(urls.every(u=>u.hostname!=='youtubeanalytics.googleapis.com'));
});
test('Facebook combines feed and video/Reels inventory once, resolves relative permalinks and preserves actual zero',async()=>{
  const r=await collectChannel('https://www.facebook.com/synk',{accessToken:'synthetic'},{fetchImpl:async raw=>{const u=new URL(raw);if(u.pathname.endsWith('/me'))return ok({id:'123',username:'synk',followers_count:0});if(u.pathname.endsWith('/posts'))return ok({data:[{id:'123_11',permalink_url:'https://www.facebook.com/synk/posts/11',message:'Feed video',created_time:'2026-10-01T00:00:00Z',attachments:{data:[{target:{id:'77'}}]},reactions:{summary:{total_count:0}}}]});return ok({data:[{id:'77',permalink_url:'/reel/77/',views:10,created_time:'2026-10-01T00:00:00Z'},{id:'88',permalink_url:'/reel/88/',views:0,created_time:'2026-10-02T00:00:00Z',comments:{summary:{total_count:0}}}]});}});
  assert.equal(r.posts.length,2);assert.equal(r.posts[0].metrics.views,10);assert.equal(r.posts[1].url,'https://www.facebook.com/reel/88/');assert.equal(r.posts[1].metrics.views,0);assert.equal(r.posts[1].metrics.comments,0);assert.equal(r.posts[1].metrics.shares,null);assert.equal(r.coverage.inventoryComplete,true);
});
test('Facebook video permission failure keeps the feed and marks inventory incomplete',async()=>{
 const r=await collectChannel('https://www.facebook.com/synk',{accessToken:'synthetic'},{fetchImpl:async raw=>{const u=new URL(raw);if(u.pathname.endsWith('/me'))return ok({id:'123',username:'synk'});if(u.pathname.endsWith('/posts'))return ok({data:[]});return new Response(JSON.stringify({error:{code:10}}),{status:403});}});
 assert.equal(r.coverage.status,'partial');assert.equal(r.coverage.inventoryComplete,false);
});

test('missing optional Instagram insights does not stop automatic basic media and reaction polling',async()=>{
 const r=await collectChannel('https://www.instagram.com/synk',{accessToken:'synthetic',authType:'instagram-login'},{recentSince:'2026-10-01T00:00:00Z',now:'2026-10-02T00:00:00Z',fetchImpl:async raw=>{const u=new URL(raw);if(u.pathname.endsWith('/me'))return ok({id:'123',username:'synk',media_count:1});if(u.pathname.endsWith('/media'))return ok({data:[{id:'456',permalink:'https://www.instagram.com/p/example/',timestamp:'2026-10-01T12:00:00Z',like_count:0,comments_count:2}]});return new Response(JSON.stringify({error:{code:200}}),{status:403});}});
 assert.equal(r.posts.length,1);assert.equal(r.posts[0].metrics.likes,0);assert.equal(r.posts[0].metrics.comments,2);assert.equal(r.posts[0].metrics.views,null);assert.equal(r.coverage.status,'partial');assert.equal(r.coverage.collectionError,undefined);
});
