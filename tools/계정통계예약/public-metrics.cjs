'use strict';

// This function also runs inside the browser. Return only visible counts and their account/post identities.
function readPublicPage({platform, handle, urls}) {
  const cleanUrl = raw => {
    try {const u=new URL(raw);return u.origin+u.pathname.replace(/\/+$/,'')+(u.pathname==='/profile.php'?'?id='+u.searchParams.get('id'):'');}
    catch {return '';}
  };
  const url=cleanUrl(location.href), matched=urls.some(u=>cleanUrl(u)===url);
  const data={url,observedAt:new Date().toISOString(),matched,metrics:{},labels:{},posts:[],empty:false};
  if(!matched) return data;
  const visible=node=>node?.getClientRects().length>0;
  const exact=raw=>{
    const s=String(raw??'').trim();
    if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s))return null;
    const n=Number(s.replaceAll(',',''));return Number.isSafeInteger(n)?n:null;
  };
  const add=(k,label,value)=>{const n=exact(value);if(n!==null){data.metrics[k]=n;data.labels[k]=label;}};
  const tag=String(handle||'').trim().replace(/^@/,'').toLowerCase();
  const pageText=document.body?.innerText||'';
  if(platform==='tiktok'){
    const titles=[...document.querySelectorAll('[data-e2e="user-title"],[data-e2e="user-subtitle"]')];
    if(!titles.some(t=>visible(t)&&t.innerText.trim().replace(/^@/,'').toLowerCase()===tag)){data.matched=false;return data;}
    for(const [key,attr] of [['likes','likes-count'],['followers','followers-count']]){
      const el=document.querySelector('[data-e2e="'+attr+'"]');if(visible(el))add(key,attr,el.innerText);
    }
    data.empty=/아직 게시된 동영상이 없습니다|어떤 동영상도 게시하지 않았습니다|아직 동영상 없음|아직 동영상이 없|No videos yet|还没有作品/i.test(pageText);
  } else if(platform==='brunch'){
    const m=pageText.match(/(?:^|\n)팔로워\s*\n?\s*((?:\d{1,3}(?:,\d{3})+|\d+))(?=\s*(?:\n|$))/);
    if(m)add('followers','팔로워',m[1]);
  } else if(platform==='behance'){
    if(!/\/info\/?$/.test(location.pathname))return data;
    const m=pageText.match(/(?:^|\n)(?:프로젝트 보기|프로젝트 조회수|Project Views)[\t ]+([\d,]+)(?=\s*(?:\n|$))/i);
    if(m)add('views','프로젝트 조회수',m[1]);
  } else if(platform==='naver-clip'){
    const lines=pageText.split('\n').map(s=>s.trim()).filter(Boolean);
    if(!lines.some(s=>s.replace(/^@/,'').toLowerCase()===tag)){data.matched=false;return data;}
    for(const [key,label] of [['posts','콘텐츠'],['followers','팔로워']]){
      const i=lines.indexOf(label);if(i>=0)add(key,label,lines[i+1]);
    }
  } else if(platform==='tistory'){
    const m=pageText.match(/(?:전체\s*글|전체\s*보기|분류\s*전체보기)\s*\(?\s*([\d,]+)\s*\)?/);
    if(m)add('posts','전체 글',m[1]);
  } else if(platform==='instagram'){
    const head=document.querySelector('main header,header:has(h2),header:has(h1)');
    if(!visible(head)||!Array.from(head.querySelectorAll('h1,h2,a')).some(e=>e.innerText.trim().replace(/^@/,'').toLowerCase()===tag)){
      data.matched=false;return data;
    }
    const post=head.innerText.match(/(?:게시물\s*([\d,]+)|([\d,]+)\s*posts)\b/i);
    if(post)add('posts','게시물',post[1]||post[2]);
    const follower=head.innerText.match(/(?:팔로워\s*([\d,]+)|([\d,]+)\s*followers)\b/i);
    if(follower)add('followers','팔로워',follower[1]||follower[2]);
    for(const el of head.querySelectorAll('li,a')){
      const m=el.innerText.trim().match(/^(?:팔로워|followers)\s*([\d,]+)(?:명)?$|^([\d,]+)\s*followers$/i);
      if(visible(el)&&m)add('followers','팔로워',m[1]||m[2]);
    }
  } else if(platform==='x'){
    if(/\bThese posts are protected\b|게시물이 비공개|이 게시물은 비공개/i.test(pageText))return data;
    for(const article of document.querySelectorAll('article[data-testid="tweet"]')){
      const time=article.querySelector('time[datetime]'),link=time?.closest('a[href]');
      if(!visible(time)||!link)continue;
      const post=new URL(link.href),m=post.pathname.match(/^\/([^/]+)\/status\/(\d+)$/);
      if(!m||m[1].toLowerCase()!==tag||post.origin!==location.origin)continue;
      const group=Array.from(article.querySelectorAll('[role="group"][aria-label]')).filter(e=>visible(e)&&e.closest('article')===article);
      if(group.length!==1)continue;
      const label=group[0].getAttribute('aria-label');
      const metrics={};
      const counters={views:/(?:^|[,，]\s+)(?:([\d,]+)\s+views?|조회수?\s*([\d,]+)회?)(?=\s*(?:[,，]\s+|$))/i,
        likes:/(?:^|[,，]\s+)(?:([\d,]+)\s+likes?|(?:마음에 들어요|좋아요)\s*([\d,]+)(?:개|회)?)(?=\s*(?:[,，]\s+|$))/i};
      for(const [key,re] of Object.entries(counters)){
        const hit=label.match(re);
        if(hit){const n=exact(hit[1]||hit[2]);if(n!==null)metrics[key]=n;}
      }
      if(Object.keys(metrics).length)data.posts.push({externalId:m[2],url:post.origin+post.pathname,publishedAt:time.dateTime,metrics});
    }
  }
  return data;
}

function publicEnvelope({account,sourceUrl,snapshot,digest}){
  if(!snapshot.matched)return null;
  const observations=[];
  if(Object.keys(snapshot.metrics).length)observations.push({kind:'account-lifetime',metrics:snapshot.metrics,labels:{metricLabels:snapshot.labels}});
  const seen=new Set();
  for(const {metrics,...post} of snapshot.posts){
    if(seen.has(post.externalId))continue;
    seen.add(post.externalId);
    observations.push({kind:'post-lifetime',post,metrics});
  }
  if(!observations.length)return null;
  return {sourceType:'public-page',sourceUrl,observedAt:snapshot.observedAt,identity:{accountId:account.id,
    ...(account.externalId?{externalId:account.externalId}:{handle:account.handle})},evidenceSha256:digest,observations};
}

module.exports={readPublicPage,publicEnvelope};

