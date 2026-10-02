import test from 'node:test';
import assert from 'node:assert/strict';
import {collectDailyTrends,parseGoogleTrends,parseBaiduTrends,parseYoutubeCulture,parseYoutubeChart,trendUrl} from './trend-collectors.mjs';

const at='2026-10-02T01:00:00.000Z';
const rss='<rss><channel><item><title><![CDATA[A &amp; B]]></title><ht:approx_traffic>2,000+</ht:approx_traffic><pubDate>Thu, 1 Oct 2026 12:20:00 -0700</pubDate><link>https://trends.google.com/trending/rss?geo=KR</link><ht:news_item><ht:news_item_title>Story &#x1f600;</ht:news_item_title><ht:news_item_url>https://example.com/story?a=1&amp;b=2</ht:news_item_url><ht:news_item_source>News</ht:news_item_source></ht:news_item><ht:news_item><ht:news_item_title>Bad link</ht:news_item_title><ht:news_item_url>javascript:alert(1)</ht:news_item_url></ht:news_item></item></channel></rss>';
const baidu='<!--s-data:'+JSON.stringify({data:{cards:[{component:'hotList',content:[{word:'Pinned',isTop:true,index:0,hotScore:'999',url:'https://www.baidu.com/s?wd=pinned'},{word:'热搜',index:0,hotScore:'123456',rawUrl:'https://www.baidu.com/s?wd=hot'},{word:'Invalid',index:1,hotScore:'NaN',rawUrl:'javascript:evil()'}]}]}})+'-->';
const culture='<rss><channel><item><title>Analysis</title><link>https://blog.youtube/culture-and-trends/story/</link><pubDate>Thu, 1 Oct 2026 12:20:00 -0700</pubDate></item><item><title>Corporate news</title><link>https://blog.youtube/inside-youtube/launch/</link></item><item><title>Fake host</title><link>https://evil.example/culture-and-trends/story/</link></item></channel></rss>';

test('Google RSS preserves approximate search signal and original linked evidence without inventing rank',()=>{
  const [row]=parseGoogleTrends(rss,{region:'KR',at});assert.equal(row.title,'A & B');assert.deepEqual(row.metric,{label:'대략 검색량',value:2000,display:'2,000+'});assert.equal(row.rank,null);assert.equal(row.region,'KR');assert.equal(row.related.length,1);assert.equal(row.related[0].title,'Story 😀');assert.equal(row.related[0].url,'https://example.com/story?a=1&b=2');assert.equal(new URL(row.url).searchParams.get('q'),'A & B');assert.equal(row.publishedAt,'2026-10-01T19:20:00.000Z');assert.equal(row.collectedAt,at);
});
test('RSS entity declarations and invalid feed shapes are rejected',()=>{
  assert.throws(()=>parseGoogleTrends('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]>'+rss,{region:'US',at}),/FEED_FORMAT/);assert.throws(()=>parseGoogleTrends('<html>Login</html>',{region:'US',at}),/FEED_FORMAT/);
});
test('Baidu pinned headline does not become rank one and invalid links are discarded',()=>{
  const rows=parseBaiduTrends(baidu,{at});assert.equal(rows.length,1);assert.equal(rows[0].title,'热搜');assert.equal(rows[0].rank,1);assert.equal(rows[0].metric.value,123456);assert.equal(rows[0].publishedAt,null);assert.equal(rows[0].region,'CN');assert.throws(()=>parseBaiduTrends('Login',{at}),/FEED_FORMAT/);
});
test('official YouTube analysis never receives a fabricated country, ranking or popularity metric',()=>{
  const rows=parseYoutubeCulture(culture,{at});assert.equal(rows.length,1);assert.equal(rows[0].region,'GLOBAL');assert.equal(rows[0].category,'analysis');assert.equal(rows[0].rank,null);assert.equal(rows[0].metric,null);
});
test('YouTube chart uses valid video IDs and cumulative view counts only',()=>{
  const rows=parseYoutubeChart({items:[{id:'abcdefghijk',snippet:{title:'Chart item'},statistics:{viewCount:'123'}},{id:'https://evil',snippet:{title:'Bad ID'}}]},{region:'US',at});assert.equal(rows.length,1);assert.equal(rows[0].rank,1);assert.equal(rows[0].metric.label,'누적 조회수');assert.equal(rows[0].metric.value,123);assert.equal(rows[0].region,'US');
});
test('URLs cannot use scripts, local addresses, credentials or alternate ports',()=>{
  for(const value of ['javascript:alert(1)','http://example.com','https://127.0.0.1/','https://localhost/','https://user:pw@example.com/','https://example.com:8080/','https://[::1]/'])assert.equal(trendUrl(value),'');assert.equal(trendUrl('https://example.com/news'),'https://example.com/news');
});
test('one unavailable source does not stop the other countries, while absent permissions stay explicit',async()=>{
  const visited=[];const result=await collectDailyTrends({at,fetchImpl:async url=>{visited.push(url);if(url.includes('geo=US'))throw new Error('private-value-never-persist');return new Response(url.includes('baidu')?baidu:url.includes('blog.youtube')?culture:rss);}});
  assert.equal(result.items.length,3);assert.equal(result.sources.find(s=>s.id==='google-us').status,'error');assert.equal(result.sources.find(s=>s.id==='google-kr').status,'ok');assert.equal(result.sources.find(s=>s.id==='baidu-cn').count,1);assert.equal(result.sources.find(s=>s.id==='tiktok-kr').status,'needs_connection');assert.equal(result.sources.find(s=>s.id==='instagram-us').status,'needs_connection');assert.equal(result.sources.find(s=>s.id==='xiaohongshu-cn').status,'unavailable');assert.equal(result.sources.some(s=>s.id==='google-cn'),false);assert.equal(result.sources.some(s=>s.id==='youtube-cn'),false);assert.equal(visited.length,4);assert.equal(JSON.stringify(result).includes('private-value'),false);
});
test('configured YouTube key stays out of persisted source URLs and error details',async()=>{
  const key='never-persist-this-key';const result=await collectDailyTrends({regions:['US'],at,youtubeConfig:{apiKey:key},fetchImpl:async url=>new Response(url.includes('googleapis')?'{}':url.includes('blog.youtube')?culture:rss,{status:url.includes('googleapis')?403:200})});assert.equal(result.sources.find(s=>s.id==='youtube-us').status,'error');assert.equal(JSON.stringify(result).includes(key),false);
});
test('source size and redirects to unknown hosts are rejected before parsing',async()=>{
  const result=await collectDailyTrends({regions:['KR'],at,fetchImpl:async url=>url.includes('trends.google')?new Response('',{status:302,headers:{location:'https://localhost/private'}}):new Response('x',{headers:{'content-length':'99999999'}})});assert.equal(result.items.length,0);assert.equal(result.sources.find(s=>s.id==='google-kr').status,'error');assert.equal(result.sources.find(s=>s.id==='youtube-culture-global').status,'error');
});
