'use strict';
// 게시물별 누적값(post-lifetime) 보완 수집(2026-11-19). 서버에 계정 합계만 있던 계정에서 로그인한 통계 화면의 게시물별 숫자를 읽는다.
// 계정 합계 수집(ownerCapture · officialScreen)과 따로, 회차마다 한 번 돈다. 서버가 하루 한 벌(snapshots)로 남기면 3시간 판정(tools/게시성과.js)이 줍는다.
// 읽기만 한다: 화면이 스스로 부르는 목록을 같은 로그인으로 다시 읽을 뿐 게시 · 설정 · 삭제는 하지 않는다. 길마다 정한 브라우저(ego 프로필 또는 Aside 계정)에서만 돈다.
const fs=require('node:fs');
const path=require('node:path');
const {parseDouyinWorks,parseThreadsInsights,parseLinkedInPosts,parseTistoryDaily,parseVkClips,parseNaverBlogPosts}=require('../lib/외부통계파싱.cjs');

// 아래 함수들은 계정에 지정된 브라우저의 페이지 안에서 그대로 돈다(pageJob이 toString으로 넘긴다). 바깥 이름을 쓰지 않는다.
async function douyinWorksPage(p,args){
  await p.waitForFunction(()=>/作品\s*[(（]\s*\d+\s*[)）]|没有更多作品|暂无作品/.test(document.body.innerText),undefined,{timeout:18000}).catch(()=>{});
  const {at,where}=await p.evaluate(a=>{const h=location.hostname;return {at:location.origin+location.pathname,where:!h?'blank':h===a.entry.split('/')[2]?'same':a.logins.includes(h)?'login':'other'};},{entry:args.entry,logins:args.logins||[]});
  if(at!==args.entry)return {reason:'need_owner',step:'landed',where};
  const get=route=>p.evaluate(async route=>{
    const res=await fetch(route,{credentials:'include'});
    if(!res.ok)return null;
    try{return JSON.parse(await res.text());}catch{return null;}
  },route);
  const user=await get('/aweme/v1/creator/pc/user/info/');
  const ownerUid=user&&user.status_code===0&&user.uid!==undefined&&user.uid!==null?String(user.uid):null;
  if(!ownerUid)return {reason:'need_owner',step:'owner'};
  const rows=[];
  let cursor=0,more=true,total=null;
  for(let i=0;i<12&&more;i++){
    const list=await get('/janus/douyin/creator/pc/work_list?status=0&count=20&max_cursor='+encodeURIComponent(String(cursor))+'&scene=star_atlas&device_platform=android&aid=1128');
    if(!list||list.status_code!==0||!Array.isArray(list.aweme_list))return {reason:'format',step:'work_list'};
    total=list.total;
    for(const a of list.aweme_list){
      const s=a.statistics;
      rows.push({awemeId:String(a.aweme_id),awemeType:a.aweme_type,createTime:a.create_time,desc:String(a.desc||'').slice(0,200),
        authorUid:String(a.author?.uid??''),authorId:String(a.author?.short_id||a.author?.unique_id||''),deleted:a.status?.is_delete===true,
        stats:s?{play:s.play_count,like:s.digg_count,comment:s.comment_count,share:s.share_count,collect:s.collect_count}:null});
    }
    more=list.has_more===true;cursor=list.max_cursor;
  }
  if(more)return {reason:'format',step:'pagination'};
  return {observedAt:new Date().toISOString(),sourceUrl:at,ownerUid,total,complete:true,rows};
}

async function threadsInsightsPage(p,args){
  // 「PDF로 내보내기」 같은 머리글은 목록보다 먼저 뜬다(11-19 첫 실제 회차에서 빈 목록을 읽었다). 목록 칸이 뜰 때까지 기다린다.
  await p.waitForFunction(()=>[...document.querySelectorAll('a[href^="/insights/post/"]')].some(a=>/\n조회수$/.test(a.innerText.trim())),undefined,{timeout:20000}).catch(()=>{});
  const info=await p.evaluate(x=>({
    sourceUrl:location.origin+location.pathname.replace(/\/?$/,'/'),
    where:!location.hostname?'blank':location.hostname===x.entry.split('/')[2]?'same':x.logins.includes(location.hostname)?'login':'other',
    owner:[...document.querySelectorAll('a[href]')].some(a=>a.pathname==='/@'+x.handle&&(a.innerText||a.getAttribute('aria-label')||a.textContent).trim()==='프로필'),
    rows:[...document.querySelectorAll('a[href^="/insights/post/"]')].map(a=>({path:a.pathname,lines:a.innerText.split('\n').map(s=>s.trim()).filter(Boolean).slice(-3)}))
  }),{handle:args.handle,entry:args.entry,logins:args.logins||[]});
  if(!info.owner||info.sourceUrl!==args.entry)return {reason:'need_owner',step:info.sourceUrl===args.entry?'owner':'landed',where:info.where};
  if(!info.rows.length)return {reason:'retry',step:'list'};
  const observedAt=new Date().toISOString();
  const ids=[...new Set(info.rows.map(r=>r.path.split('/')[3]).filter(Boolean))];
  const times={};
  if(ids.length){
    await p.goto('https://www.threads.com/@'+args.handle,{waitUntil:'domcontentloaded',timeout:25000});
    for(let i=0;i<8;i++){
      await p.waitForFunction(()=>document.querySelector('time[datetime]'),undefined,{timeout:10000}).catch(()=>{});
      const found=await p.evaluate(handle=>[...document.querySelectorAll('time[datetime]')].map(t=>({path:t.closest('a')?.pathname||'',at:t.dateTime}))
        .filter(x=>x.path.startsWith('/@'+handle+'/post/')),args.handle);
      for(const f of found){const id=f.path.split('/')[3];if(id&&!times[id])times[id]=f.at;}
      if(ids.every(id=>times[id]))break;
      await p.evaluate(()=>window.scrollBy(0,Math.round(document.documentElement.clientHeight*1.5)));
      await p.waitForTimeout(1200);
    }
  }
  return {observedAt,sourceUrl:info.sourceUrl,handle:args.handle,rows:info.rows,times:Object.fromEntries(ids.filter(id=>times[id]).map(id=>[id,times[id]]))};
}

// 링크드인 개인 프로필: 본인 프로필에만 있는 「소개 편집」 링크로 주인을 확인하고, 최근 활동의 「분석 보기」 링크(본인 글에만 있다)에서
// 활동 번호를 모은 뒤 게시물 분석 화면을 하나씩 연다. 화면 글은 「회원 도달」 줄 앞뒤만 남긴다(게시물 본문은 남기지 않는다).
async function linkedinPostsPage(p,args){
  const profile='/in/'+args.handle;
  await p.waitForFunction(q=>[...document.links].some(a=>decodeURI(a.pathname)===q+'/edit/intro/'),profile,{timeout:15000}).catch(()=>{});
  const who=await p.evaluate(x=>{const h=location.hostname;return {owner:decodeURI(location.pathname).replace(/\/$/,'')===x.q&&[...document.links].some(a=>decodeURI(a.pathname)===x.q+'/edit/intro/'),
    where:!h?'blank':h===x.entry.split('/')[2]?'same':x.logins.includes(h)?'login':'other'};},{q:profile,entry:args.entry,logins:args.logins||[]});
  if(!who.owner)return {reason:'need_owner',step:'owner',where:who.where};
  await p.goto('https://www.linkedin.com'+profile+'/recent-activity/all/',{waitUntil:'domcontentloaded',timeout:25000});
  const ids=[];
  for(let i=0;i<6&&ids.length<args.limit;i++){
    await p.waitForFunction(()=>document.querySelector('a[href*="/analytics/post-summary/urn:li:activity:"]'),undefined,{timeout:10000}).catch(()=>{});
    const found=await p.evaluate(()=>[...document.querySelectorAll('a[href*="/analytics/post-summary/urn:li:activity:"]')].map(a=>(/urn:li:activity:([0-9]{15,25})/.exec(a.getAttribute('href'))||[])[1]).filter(Boolean));
    for(const id of found)if(!ids.includes(id))ids.push(id);
    await p.evaluate(()=>window.scrollBy(0,Math.round(document.documentElement.clientHeight*1.5)));
    await p.waitForTimeout(1500);
  }
  const posts=[];
  for(const id of ids.slice(0,args.limit)){
    await p.goto('https://www.linkedin.com/analytics/post-summary/urn:li:activity:'+id+'/',{waitUntil:'domcontentloaded',timeout:25000});
    await p.waitForFunction(()=>(document.querySelector('main')?.innerText||'').includes('LinkedIn에서 보내기'),undefined,{timeout:15000}).catch(()=>{});
    const seen=await p.evaluate(()=>{
      const lines=(document.querySelector('main')?.innerText||'').split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean);
      // 노출수 수 칸부터 「LinkedIn에서 보내기」 수 칸까지만 남긴다. 그 앞은 게시물 본문이다. 회원 도달 칸은 게시물에 따라 없다(11-19 실측).
      const end=lines.lastIndexOf('LinkedIn에서 보내기'),from=end<0?-1:lines.lastIndexOf('노출수',end);
      return {sourceUrl:location.origin+location.pathname,lines:from<1?[]:lines.slice(from-1,end+2)};
    });
    posts.push({activityId:id,observedAt:new Date().toISOString(),...seen});
  }
  return {handle:args.handle,posts};
}

// 티스토리(Aside u0 · 10-26 유호님 규칙): 관리자 방문 통계 화면이 부르는 글 목록과 하루 인기글을 같은 로그인으로 읽는다. Playwright 꼴 페이지(Aside)와 ego에서 같이 돈다.
async function tistoryDailyPage(p,args){
  await p.waitForFunction(()=>document.readyState!=='loading',undefined,{timeout:15000}).catch(()=>{});
  const {at,where}=await p.evaluate(a=>{const h=location.hostname;return {at:location.origin+location.pathname,where:!h?'blank':h===a.entry.split('/')[2]?'same':a.logins.includes(h)?'login':'other'};},{entry:args.entry,logins:args.logins||[]});
  if(at!==args.entry)return {reason:'need_owner',step:'landed',where};
  return await p.evaluate(async({days})=>{
    const get=async route=>{const res=await fetch(route,{credentials:'include'});if(!res.ok)throw new Error('HTTP '+res.status+' '+route.split('?')[0]);return res.json();};
    const posts=[];
    for(let page=1;page<=10;page++){
      const list=await get('/manage/posts.json?category=-3&page='+page+'&searchKeyword=&searchType=title&visibility=all');
      for(const item of list.items||[])posts.push({id:String(item.id),published:item.published,visibility:item.visibility,scheduled:item.isScheduled===true,permalink:item.permalink,comments:item.countOfComments});
      if(!list.items||!list.items.length||posts.length>=list.totalCount)break;
    }
    const observedAt=new Date().toISOString(),today=Date.parse(new Date(Date.now()+9*3600000).toISOString().slice(0,10)+'T00:00:00Z');
    const out=[];
    for(let i=days;i>=0;i--){
      const date=new Date(today-i*86400000).toISOString().slice(0,10);
      const top=await get('/manage/v2/statistics/blog/topEntry?metric=pv&startDate='+date+'&granularity=day');
      const entries=(top.data&&top.data.result||[]).map(r=>({entryId:r.entryId,count:r.count}));
      out.push({date,length:entries.length,entries});
    }
    return {observedAt,sourceUrl:location.origin+location.pathname,host:location.hostname,posts,days:out};
  },{days:args.days});
}

// VK 커뮤니티의 공개 클립 목록(vk.ru/clips/<커뮤니티>)에서 클립 번호를 모으고, 클립 화면이 받은 응답에 박힌 조회 · 좋아요 · 댓글 · 공유와 게시 시각을 읽는다(11-19).
// 로그인 없는 요청에는 보안 확인 화면이 떠서 등록 커뮤니티를 관리하는 ego 프로필로 연다. 값은 누구나 보는 공개 수치라 공개 화면(public-page)으로 올린다.
async function vkClipsPage(p,args){
  const owner='-'+args.communityId;
  await p.waitForFunction(()=>!!document.querySelector('a[href*="z=clip-"]'),undefined,{timeout:20000}).catch(()=>{});
  const {at,where}=await p.evaluate(a=>{const h=location.hostname;return {at:location.origin+location.pathname,where:!h?'blank':h===a.entry.split('/')[2]?'same':a.logins.includes(h)?'login':'other'};},{entry:args.entry,logins:args.logins||[]});
  if(at!==args.entry)return {reason:'need_owner',step:'landed',where};
  // 목록은 내릴 때 더 불러온다. 2.5초씩 세 번(7.5초) 연달아 늘지 않아야 끝으로 본다. 40번 내려도 계속 늘면 덜 읽은 목록이라 올리지 않는다(GPT GA3).
  const links=()=>p.evaluate(()=>[...document.querySelectorAll('a[href*="z=clip-"]')].map(a=>{const u=new URL(a.getAttribute('href'),location.href);
    return {z:u.searchParams.get('z')||'',owner:u.searchParams.get('owner')||'',feed:u.searchParams.get('feedType')||''};}));
  let seen=await links(),still=0;
  for(let i=0;i<40&&still<3;i++){
    await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await p.waitForTimeout(2500);
    const next=await links();
    still=next.length>seen.length?0:still+1;seen=next;
  }
  if(still<3)return {reason:'retry',step:'list'};
  if(!seen.length)return {reason:'no_posts',step:'list'};
  const ids=[...new Set(seen.map(l=>{const m=/^clip(-?\d+)_(\d+)$/.exec(l.z);return m&&m[1]===owner?m[2]:null;}).filter(Boolean))];
  const rows=await p.evaluate(async ({owner,ids})=>{
    const BS=String.fromCharCode(92);
    // 여는 괄호에서 짝이 맞는 닫는 괄호까지(글자 안의 괄호와 이스케이프는 건너뛴다).
    const objectAt=(body,index)=>{
      let s=-1,depth=0;
      for(let i=index;i>=0;i--){const c=body[i];if(c==='}')depth++;else if(c==='{'){if(depth===0){s=i;break;}depth--;}}
      if(s<0)return null;
      let inText=false;depth=0;
      for(let i=s;i<body.length;i++){
        const c=body[i];
        if(inText){if(c===BS){i++;continue;}if(c==='"')inText=false;continue;}
        if(c==='"'){inText=true;continue;}
        if(c==='{')depth++;else if(c==='}'){depth--;if(depth===0)return body.slice(s,i+1);}
      }
      return null;
    };
    const out=[];
    for(const id of ids){
      const res=await fetch('/clip'+owner+'_'+id,{credentials:'include'});
      if(!res.ok){out.push({clipId:id,error:'http'});continue;}
      const body=await res.text(),key='"owner_id":'+owner+',"id":'+id+',';
      let item=null;
      for(let at=body.indexOf(key);at>=0&&!item;at=body.indexOf(key,at+1)){
        try{const o=JSON.parse(objectAt(body,at)||'null');if(o&&o.engagement&&o.publish_timestamp!==undefined)item=o;}catch{/* 다음 자리 */}
      }
      if(!item){out.push({clipId:id,error:'missing'});continue;}
      const e=item.engagement;
      out.push({clipId:id,ownerId:item.owner_id,publishTimestamp:item.publish_timestamp,isAuthor:item.is_author,viewPrivacy:item.privacy&&item.privacy.view?item.privacy.view.category:null,
        engagement:{views:e.view_count,likes:e.like_count,comments:e.comment_count,shares:e.repost_count}});
    }
    return out;
  },{owner,ids});
  if(rows.some(r=>r.error))return {reason:'format',step:'clip'};
  return {observedAt:new Date().toISOString(),sourceUrl:at,communityId:args.communityId,links:seen,rows};
}

// 네이버 블로그 주인이 로그인해 연 자기 블로그(blog.naver.com/<아이디>)에서 글 목록(PostTitleListAsync)을 읽는다(11-19). 글별 누적 조회수(readCount)는
// 주인 세션에만 차고 로그인 없이는 빈칸이다. 목록의 날짜는 「9시간 전」 꼴이라 게시 시각은 같은 블로그 RSS의 pubDate로 잇는다. Aside 계정에서 돈다.
async function naverBlogPostsPage(p,args){
  await p.waitForLoadState('domcontentloaded').catch(()=>{});
  const {at,where}=await p.evaluate(a=>{const h=location.hostname;return {at:location.origin+location.pathname,where:!h?'blank':h===a.entry.split('/')[2]?'same':a.logins.includes(h)?'login':'other'};},{entry:args.entry,logins:args.logins||[]});
  if(at!==args.entry)return {reason:'need_owner',step:'landed',where};
  const list=await p.evaluate(async handle=>{
    const BS=String.fromCharCode(92),rows=[];let total=null;
    // 30편씩 33쪽(990편)까지 읽는다. 파서의 읽기 상한(1,000줄) 안이고, 더 많은 블로그는 앞쪽만 읽어도 RSS 글이 모두 그 안에 있으면 받는다(GPT GA4).
    for(let page=1;page<=33;page++){
      const res=await fetch('/PostTitleListAsync.naver?blogId='+encodeURIComponent(handle)+'&viewdate=&currentPage='+page+'&categoryNo=0&parentCategoryNo=&countPerPage=30',{credentials:'include'});
      if(!res.ok)return {error:'http'};
      // 이 응답은 쪽 번호 HTML 칸에 JSON이 아닌 \' 이스케이프를 쓴다. 그 두 글자만 '로 바꿔 읽는다.
      let data;
      try{data=JSON.parse((await res.text()).split(BS+"'").join("'"));}catch{return {error:'json'};}
      if(!data||data.resultCode!=='S'||!Array.isArray(data.postList))return {error:'result'};
      total=Number(data.totalCount);
      for(const post of data.postList){
        // 제목은 주소 꼴로 담기고 그 안에 &quot; 같은 HTML 기호가 남는다. textarea에 넣어 글자로만 푼다(실행되는 요소를 만들지 않는다).
        let title='';
        try{const box=document.createElement('textarea');box.innerHTML=decodeURIComponent(String(post.title||'').split('+').join(' '));title=box.value;}catch{title='';}
        rows.push({logNo:String(post.logNo||''),readCount:post.readCount===undefined||post.readCount===null?'':String(post.readCount),addDate:String(post.addDate||''),title:title.slice(0,200)});
      }
      if(!data.postList.length||rows.length>=total)break;
    }
    return {total,rows};
  },args.handle);
  if(!list||list.error)return {reason:'format',step:list?list.error:'list'};
  const observedAt=new Date().toISOString();
  await p.goto('https://rss.blog.naver.com/'+args.handle+'.xml',{waitUntil:'domcontentloaded',timeout:25000});
  const times=await p.evaluate(handle=>{
    const out={},prefix='https://blog.naver.com/'+handle+'/';
    for(const item of document.querySelectorAll('item')){
      const guid=(item.querySelector('guid')?.textContent||'').trim(),no=guid.startsWith(prefix)?guid.slice(prefix.length):'';
      const when=new Date((item.querySelector('pubDate')?.textContent||'').trim());
      if(/^[0-9]{6,20}$/.test(no)&&!Number.isNaN(when.getTime()))out[no]=when.toISOString();
    }
    return out;
  },args.handle);
  return {observedAt,sourceUrl:at,total:list.total,rows:list.rows,times};
}

// live:false인 길은 서버(회사 판)가 그 주소를 받기 전이라 돌지 않는다. VK 클립은 회사 판 76(11-20 06:00 묶음)이, 네이버 글 목록은 회사 판 86(11-25 17:00 묶음)이 서버 규칙을 실어 켰다.
const ROUTES=Object.freeze({
  douyin:{name:'douyin-works',browser:'ego',live:true,page:douyinWorksPage,parse:parseDouyinWorks,handle:/^[0-9]{6,20}$/,entry:()=>'https://creator.douyin.com/creator-micro/content/manage'},
  threads:{name:'threads-insights',browser:'ego',live:true,page:threadsInsightsPage,parse:parseThreadsInsights,handle:/^[A-Za-z0-9_.]{1,40}$/,entry:()=>'https://www.threads.com/insights/'},
  // 개인 프로필(/in/<이름>/)만 읽는다. 회사 페이지는 다른 화면이라 이 길로 읽지 않는다.
  linkedin:{name:'linkedin-posts',browser:'ego',live:true,page:linkedinPostsPage,parse:parseLinkedInPosts,handle:/^[A-Za-z0-9_-]{3,100}$/,limit:10,
    entry:handle=>'https://www.linkedin.com/in/'+handle+'/',personal:account=>/^https:\/\/www\.linkedin\.com\/in\/[^/]+\/?$/.test(account.publicUrl||'')},
  // 티스토리는 Aside로 읽는다. 45일 전부터 오늘까지 하루씩 읽는다(판정은 7일까지만 쓴다).
  tistory:{name:'tistory-daily',page:tistoryDailyPage,parse:parseTistoryDaily,handle:/^[a-z0-9-]{1,63}\.tistory\.com$/,browsers:['aside'],days:45,
    entry:handle=>'https://'+handle+'/manage/statistics/blog'},
  vk:{name:'vk-clips',browser:'ego',live:true,stage:'public-page',page:vkClipsPage,parse:parseVkClips,handle:/^[A-Za-z0-9_.]{2,64}$/,entry:h=>'https://vk.ru/clips/'+h,community:true},
  'naver-blog':{name:'naver-blog-list',browser:'aside',live:true,page:naverBlogPostsPage,parse:parseNaverBlogPosts,handle:/^[a-z0-9_-]{2,40}$/,entry:h=>'https://blog.naver.com/'+h},
});
// 길마다 쓰는 브라우저(browser 하나 또는 browsers 여럿)와 개인 설정의 브라우저가 맞아야 읽는다. Aside는 계정, ego는 프로필이 있어야 한다.
const usable=(route,profile)=>(route.browsers||[route.browser||'ego']).includes(profile?.browser)&&(profile.browser==='aside'?!!profile.account:!!profile.profileId);

// 게시물별 값을 읽어 올린다 → null(이 계정은 대상 아님) · 'limited'(올림) · 'need_owner' · 'format' · 'retry' · 'no_posts'
async function postLifetime(ctx,{pageJob,storeBatch},routes=ROUTES){
  const {account:a,profile}=ctx,route=routes[a.platform];
  if(!route||route.live===false||!usable(route,profile)||route.personal&&!route.personal(a))return null;
  const handle=String(a.handle||'').replace(/^@/,'');
  // 읽지 못하고 까닭만 돌려줄 때도 회차 폴더에 적는다. 적지 않으면 실패 파일이 없는 회차를 「읽혔다」로 잘못 본다(11-20 ~ 25 티스토리 일곱 회차).
  const stop=(reason,detail)=>{note(ctx,reason,detail);return reason;};
  if(!route.handle.test(handle))return stop('need_owner',{step:'handle'});
  // VK 클립 번호의 소유자 칸은 커뮤니티 번호다. 개인 설정(browser-profiles)의 communityId와 등록 공개 주소가 맞아야 읽는다.
  if(route.community&&(!/^[0-9]{1,15}$/.test(String(profile.communityId||''))||a.publicUrl!=='https://vk.ru/'+handle))return stop('need_owner',{step:'community'});
  await ctx.setStage(route.stage||'creator-screen');
  const data=await pageJob(ctx,route.name,route.page,{entry:route.entry(handle),handle,limit:route.limit||0,days:route.days||0,logins:LOGIN_HOSTS,...(route.community?{communityId:String(profile.communityId)}:{})});
  if(!data)return stop('retry',{code:'NO_MARKER'});
  if(data.reason)return stop(data.reason,{step:data.step,where:data.where});
  let parsed;
  try{parsed=route.parse(data,{accountId:a.id,handle,...(route.community?{communityId:String(profile.communityId)}:{})});}
  catch(error){
    if(error.code==='SYNK_METRICS_NO_ROWS')return stop('no_posts',{code:error.code});
    throw error;
  }
  // 출처 주소가 게시물마다 다른 화면(링크드인)은 게시물 하나가 봉투 하나다.
  for(const batch of parsed.batches||[{name:route.name+'-posts',evidence:data,envelope:parsed.envelope}])await storeBatch(ctx,batch.name,batch.evidence,batch.envelope);
  return 'limited';
}

// 로그인이 풀렸을 때 넘어가는 화면의 호스트다. 실제 호스트 이름은 남기지 않고 이 목록에 있으면 login, 맞는 호스트면 same, 빈 화면이면 blank, 나머지는 other라고만 적는다.
const LOGIN_HOSTS=Object.freeze(['accounts.kakao.com','www.tistory.com','nid.naver.com','accounts.google.com','www.instagram.com','id.vk.com','login.vk.com','login.vk.ru','vk.com']);

// 실패해도 계정 합계 수집은 이어 간다. 까닭만 회차 폴더에 남긴다(수치 · 화면 글 · 주소 · 호스트 이름은 남기지 않는다).
// 값이 아직 없는 것(no_posts)도 적는다. 그래야 값 파일도 까닭 파일도 없는 회차가 「게시물별 읽기까지 가지 못했다」는 뜻이 된다.
function note(ctx,reason,detail){
  if(!ctx.dir)return;
  try{
    const only=(value,rule)=>{try{const text=String(value??'');return rule.test(text)?text:'';}catch{return '';}};
    const record={at:new Date().toISOString(),reason:only(reason,/^[a-z_]{1,24}$/),code:only(detail?.code||(detail?.killed?'TIMEOUT':''),/^[A-Za-z0-9_.-]{1,60}$/),
      step:only(detail?.step,/^[a-z_]{1,24}$/),where:only(detail?.where,/^(?:blank|same|login|other)$/)};
    fs.writeFileSync(path.join(ctx.dir,'post-lifetime-failed.json'),JSON.stringify(record),{flag:'wx'});
  }catch{/* 이미 있으면 첫 실패를 둔다. 쓰기가 막혀도 앞에서 정한 결과를 바꾸지 않는다 */}
}
module.exports={postLifetime,douyinWorksPage,threadsInsightsPage,linkedinPostsPage,tistoryDailyPage,vkClipsPage,naverBlogPostsPage,note,ROUTES,LOGIN_HOSTS};
