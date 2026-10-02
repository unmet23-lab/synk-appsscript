import { createHash } from 'node:crypto';

const MAX_BYTES=2*1024*1024, MAX_ITEMS=50;
const networkHosts=new Set(['trends.google.com','top.baidu.com','blog.youtube','www.googleapis.com']);
const plain=(value,max=300)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,max);
const iso=value=>{const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null;};
const integer=value=>/^\d{1,16}$/.test(String(value))&&Number.isSafeInteger(Number(value))?Number(value):null;
const id=(source,value)=>createHash('sha256').update(source+'\n'+value).digest('hex').slice(0,24);
export function trendUrl(value){
  try{const u=new URL(String(value));if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname==='localhost'||u.hostname.endsWith('.local')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':'))return '';return u.href.slice(0,3000);}catch{return '';}
}
function entity(value){
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>{
    const common={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(common[v.toLowerCase()]!==undefined)return common[v.toLowerCase()];
    const code=v.toLowerCase().startsWith('#x')?parseInt(v.slice(2),16):parseInt(v.slice(1),10);
    return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):'';
  });
}
function xmlText(xml,tag){const value=xml.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>','i'))?.[1];return value===undefined?'':plain(entity(value),3000);}
function rssItems(xml){
  if(typeof xml!=='string'||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<rss(?:\s|>)/i.test(xml))throw new Error('FEED_FORMAT');
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,MAX_ITEMS).map(m=>m[1]);
}
export function parseGoogleTrends(xml,{region,at}){
  const sourceId='google-'+region.toLowerCase();
  return rssItems(xml).map(item=>{
    const title=plain(xmlText(item,'title')),traffic=plain(xmlText(item,'ht:approx_traffic'),40);
    const value=/^[\d,]+\+$/.test(traffic)?integer(traffic.replace(/[,+]/g,'')):null;
    const url=new URL('https://trends.google.com/trends/explore');url.searchParams.set('geo',region);url.searchParams.set('q',title);
    const related=[...item.matchAll(/<ht:news_item(?:\s[^>]*)?>([\s\S]*?)<\/ht:news_item>/gi)].slice(0,3).map(m=>({title:plain(xmlText(m[1],'ht:news_item_title')),url:trendUrl(xmlText(m[1],'ht:news_item_url')),source:plain(xmlText(m[1],'ht:news_item_source'),100)})).filter(row=>row.title&&row.url);
    return {id:id(sourceId,title),sourceId,platform:'google',region,title,url:url.href,publishedAt:iso(xmlText(item,'pubDate')),rank:null,metric:traffic?{label:'대략 검색량',value,display:traffic}:null,related,collectedAt:at,category:'search'};
  }).filter(row=>row.title);
}
export function parseBaiduTrends(html,{at}){
  const content=html.match(/<!--s-data:([\s\S]*?)-->/)?.[1];if(!content)throw new Error('FEED_FORMAT');
  let data;try{data=JSON.parse(content);}catch{throw new Error('FEED_FORMAT');}
  const rows=data?.data?.cards?.find(card=>card.component==='hotList')?.content;if(!Array.isArray(rows))throw new Error('FEED_FORMAT');
  // The pinned headline is not position 1. Baidu's index is zero based.
  return rows.filter(row=>!row.isTop).slice(0,MAX_ITEMS).map(row=>{
    const title=plain(row.word||row.query),url=trendUrl(row.rawUrl||row.url),value=integer(row.hotScore);
    return {id:id('baidu-cn',title),sourceId:'baidu-cn',platform:'baidu',region:'CN',title,url,publishedAt:null,rank:Number.isInteger(row.index)&&row.index>=0?row.index+1:null,metric:value===null?null:{label:'바이두 인기 지수',value,display:value.toLocaleString('ko-KR')},related:[],collectedAt:at,category:'search'};
  }).filter(row=>row.title&&row.url);
}
export function parseYoutubeCulture(xml,{at}){
  return rssItems(xml).map(item=>{
    const url=trendUrl(xmlText(item,'link'));if(!url||new URL(url).hostname!=='blog.youtube'||!new URL(url).pathname.startsWith('/culture-and-trends/'))return null;
    const title=plain(xmlText(item,'title'));return {id:id('youtube-culture-global',url),sourceId:'youtube-culture-global',platform:'youtube-culture',region:'GLOBAL',title,url,publishedAt:iso(xmlText(item,'pubDate')),rank:null,metric:null,related:[],collectedAt:at,category:'analysis'};
  }).filter(row=>row?.title).sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
}
export function parseYoutubeChart(data,{region,at}){
  if(data?.error||!Array.isArray(data?.items))throw new Error('FEED_FORMAT');const sourceId='youtube-'+region.toLowerCase();
  return data.items.slice(0,MAX_ITEMS).map((row,index)=>{
    const videoId=String(row.id||''),title=plain(row.snippet?.title),value=integer(row.statistics?.viewCount);if(!/^[\w-]{11}$/.test(videoId)||!title)return null;
    return {id:id(sourceId,videoId),sourceId,platform:'youtube',region,title,url:'https://www.youtube.com/watch?v='+videoId,publishedAt:iso(row.snippet?.publishedAt),rank:index+1,metric:value===null?null:{label:'누적 조회수',value,display:value.toLocaleString('ko-KR')},related:[],collectedAt:at,category:'video'};
  }).filter(Boolean);
}
async function requestText(url,fetchImpl){
  let target=new URL(url);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);timer.unref?.();
  try{
    for(let redirects=0;redirects<=3;redirects++){
      if(target.protocol!=='https:'||!networkHosts.has(target.hostname))throw new Error('SOURCE_URL');
      const response=await fetchImpl(target.href,{signal:controller.signal,redirect:'manual',headers:{Accept:'application/rss+xml, application/xml, text/html, application/json;q=0.9','User-Agent':'SYNK-Daily-Trends/1.0'}});
      if([301,302,303,307,308].includes(response.status)){if(redirects===3)throw new Error('SOURCE_REDIRECT');target=new URL(response.headers.get('location'),target);await response.body?.cancel?.();continue;}
      if(!response.ok){await response.body?.cancel?.();throw new Error('HTTP_'+response.status);}
      if(Number(response.headers.get('content-length'))>MAX_BYTES){await response.body?.cancel?.();throw new Error('SOURCE_SIZE');}
      if(!response.body?.getReader){const value=await response.text();if(Buffer.byteLength(value)>MAX_BYTES)throw new Error('SOURCE_SIZE');return value;}
      const reader=response.body.getReader();let bytes=0;const chunks=[];
      try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES){await reader.cancel();throw new Error('SOURCE_SIZE');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
      return Buffer.concat(chunks).toString('utf8');
    }
  }finally{clearTimeout(timer);}
}
function failureMessage(error){
  if(/^HTTP_\d+$/.test(error?.message||''))return '원본 서버가 HTTP '+error.message.slice(5)+' 응답을 보냈어요. 다음 수집 때 다시 확인합니다.';
  if(error?.message==='FEED_FORMAT')return '원본의 응답 형식이 달라서 목록을 확인하지 못했어요.';
  if(error?.message==='SOURCE_SIZE')return '원본 응답의 크기가 수집 한도를 넘어 목록을 저장하지 않았어요.';
  return '원본에 연결하지 못했어요. 다음 수집 때 다시 확인합니다.';
}
export async function collectDailyTrends({regions=['KR','US','CN'],at=new Date().toISOString(),fetchImpl=globalThis.fetch,youtubeConfig={}}={}){
  const tasks=[],sources=[],items=[],selected=new Set(regions.filter(r=>['KR','US','CN'].includes(r)));
  const unavailable=(platform,region,label,message,url,status='needs_connection')=>sources.push({id:platform+'-'+region.toLowerCase(),platform,region,label,status,count:0,message,collectedAt:null,url});
  const collect=(source,parser,url)=>tasks.push((async()=>{
    try{const rows=parser(await requestText(url||source.url,fetchImpl));if(!rows.length){sources.push({...source,status:'unavailable',count:0,collectedAt:at,message:'이번 원본 목록에 표시할 항목이 없어요.'});return;}
      items.push(...rows);sources.push({...source,status:'ok',count:rows.length,collectedAt:at});
    }catch(error){sources.push({...source,status:'error',count:0,collectedAt:null,attemptedAt:at,message:failureMessage(error)});}
  })());
  for(const region of ['KR','US'])if(selected.has(region)){
    collect({id:'google-'+region.toLowerCase(),platform:'google',region,label:'Google 급상승 검색',url:'https://trends.google.com/trending/rss?geo='+region,message:'공식 급상승 검색 RSS 표본입니다. SNS 반응이나 전체 검색 순위가 아니며 검색량은 대략값이에요.'},xml=>parseGoogleTrends(xml,{region,at}));
    const source={id:'youtube-'+region.toLowerCase(),platform:'youtube',region,label:'YouTube 인기 차트',url:'https://developers.google.com/youtube/v3/docs/videos/list',message:'음악·영화·게임 중심의 mostPopular 차트 표본입니다. 조회수는 누적값이며 전체 유튜브 급상승 순위가 아니에요.'};
    if(youtubeConfig?.apiKey){const endpoint=new URL('https://www.googleapis.com/youtube/v3/videos');for(const [key,value] of Object.entries({part:'snippet,statistics',chart:'mostPopular',regionCode:region,maxResults:'50',key:youtubeConfig.apiKey}))endpoint.searchParams.set(key,value);
      collect(source,value=>parseYoutubeChart(JSON.parse(value),{region,at}),endpoint.href);
    }else unavailable('youtube',region,source.label,'회사 설정에서 YouTube Data API 키를 연결하면 이 지역의 음악·영화·게임 인기 차트를 수집합니다.',source.url);
    unavailable('tiktok',region,'TikTok 트렌드','공식 Discovery API의 트렌드 조회 권한 연결이 필요해요. 일반 계정 수치 연결과 별도이며 아직 수집하지 않았어요.','https://business-api.tiktok.com/gateway/docs/index?doc_id=1738811145996290&language=ENGLISH');
    unavailable('instagram',region,'Instagram 참고 콘텐츠','공식 API는 전체 탐색 추천을 제공하지 않아요. 승인된 해시태그·전문 계정 표본을 정한 뒤 연결해야 합니다.','https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search');
  }
  if(selected.has('CN')){
    collect({id:'baidu-cn',platform:'baidu',region:'CN',label:'바이두 실시간 인기 검색',url:'https://top.baidu.com/board?tab=realtime',message:'공개 실시간 인기 목록입니다. 인기 지수는 검색량·SNS 조회수와 다른 바이두 자체 지표예요.'},html=>parseBaiduTrends(html,{at}));
    unavailable('douyin','CN','도우인 트렌드','중국 도우인 자료는 TikTok과 별도예요. 승인된 트렌드 데이터 연결 전에는 순위를 수집하지 않습니다.','https://open.douyin.com/');
    unavailable('xiaohongshu','CN','샤오홍슈 트렌드','인증 없이 정기 수집할 수 있는 공식 인기 목록 연결을 아직 확보하지 못했어요.','https://www.xiaohongshu.com/', 'unavailable');
  }
  if(selected.size)collect({id:'youtube-culture-global',platform:'youtube-culture',region:'GLOBAL',label:'YouTube 공식 문화·트렌드 분석',url:'https://blog.youtube/rss/',message:'공식 블로그의 최신 분석 글입니다. 국가별 급상승 순위나 반응 지표가 아니에요.'},xml=>parseYoutubeCulture(xml,{at}));
  await Promise.all(tasks);
  return {items:items.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)||(a.rank??Infinity)-(b.rank??Infinity)||String(b.publishedAt||'').localeCompare(String(a.publishedAt||''))),sources:sources.sort((a,b)=>a.id.localeCompare(b.id))};
}
