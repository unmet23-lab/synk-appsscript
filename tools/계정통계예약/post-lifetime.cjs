'use strict';
// 게시물별 누적값(post-lifetime) 보완 수집(2026-11-19). 서버에 계정 합계만 있던 계정에서 로그인한 통계 화면의 게시물별 숫자를 읽는다.
// 계정 합계 수집(ownerCapture · officialScreen)과 따로, 회차마다 한 번 돈다. 서버가 하루 한 벌(snapshots)로 남기면 3시간 판정(tools/게시성과.js)이 줍는다.
// 읽기만 한다: 화면이 스스로 부르는 목록을 같은 로그인으로 다시 읽을 뿐 게시 · 설정 · 삭제는 하지 않는다. ego 프로필에서만 돈다(Aside 계정은 건너뛴다).
const fs=require('node:fs');
const path=require('node:path');
const {parseDouyinWorks,parseThreadsInsights}=require('../lib/외부통계파싱.cjs');

// 아래 두 함수는 계정에 지정된 ego 프로필의 페이지 안에서 그대로 돈다(pageJob이 toString으로 넘긴다). 바깥 이름을 쓰지 않는다.
async function douyinWorksPage(p,args){
  await p.waitForFunction(()=>/作品\s*[(（]\s*\d+\s*[)）]|没有更多作品|暂无作品/.test(document.body.innerText),undefined,{timeout:18000}).catch(()=>{});
  const at=await p.evaluate(()=>location.origin+location.pathname);
  if(at!==args.entry)return {reason:'need_owner'};
  const get=route=>p.evaluate(async route=>{
    const res=await fetch(route,{credentials:'include'});
    if(!res.ok)return null;
    try{return JSON.parse(await res.text());}catch{return null;}
  },route);
  const user=await get('/aweme/v1/creator/pc/user/info/');
  const ownerUid=user&&user.status_code===0&&user.uid!==undefined&&user.uid!==null?String(user.uid):null;
  if(!ownerUid)return {reason:'need_owner'};
  const rows=[];
  let cursor=0,more=true,total=null;
  for(let i=0;i<12&&more;i++){
    const list=await get('/janus/douyin/creator/pc/work_list?status=0&count=20&max_cursor='+encodeURIComponent(String(cursor))+'&scene=star_atlas&device_platform=android&aid=1128');
    if(!list||list.status_code!==0||!Array.isArray(list.aweme_list))return {reason:'format',at:'work_list'};
    total=list.total;
    for(const a of list.aweme_list){
      const s=a.statistics;
      rows.push({awemeId:String(a.aweme_id),awemeType:a.aweme_type,createTime:a.create_time,desc:String(a.desc||'').slice(0,200),
        authorUid:String(a.author?.uid??''),authorId:String(a.author?.short_id||a.author?.unique_id||''),deleted:a.status?.is_delete===true,
        stats:s?{play:s.play_count,like:s.digg_count,comment:s.comment_count,share:s.share_count,collect:s.collect_count}:null});
    }
    more=list.has_more===true;cursor=list.max_cursor;
  }
  if(more)return {reason:'format',at:'pagination'};
  return {observedAt:new Date().toISOString(),sourceUrl:at,ownerUid,total,complete:true,rows};
}

async function threadsInsightsPage(p,args){
  // 「PDF로 내보내기」 같은 머리글은 목록보다 먼저 뜬다(11-19 첫 실제 회차에서 빈 목록을 읽었다). 목록 칸이 뜰 때까지 기다린다.
  await p.waitForFunction(()=>[...document.querySelectorAll('a[href^="/insights/post/"]')].some(a=>/\n조회수$/.test(a.innerText.trim())),undefined,{timeout:20000}).catch(()=>{});
  const info=await p.evaluate(handle=>({
    sourceUrl:location.origin+location.pathname.replace(/\/?$/,'/'),
    owner:[...document.querySelectorAll('a[href]')].some(a=>a.pathname==='/@'+handle&&(a.innerText||a.getAttribute('aria-label')||a.textContent).trim()==='프로필'),
    rows:[...document.querySelectorAll('a[href^="/insights/post/"]')].map(a=>({path:a.pathname,lines:a.innerText.split('\n').map(s=>s.trim()).filter(Boolean).slice(-3)}))
  }),args.handle);
  if(!info.owner||info.sourceUrl!==args.entry)return {reason:'need_owner'};
  if(!info.rows.length)return {reason:'retry',at:'list'};
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

const ROUTES=Object.freeze({
  douyin:{name:'douyin-works',page:douyinWorksPage,parse:parseDouyinWorks,handle:/^[0-9]{6,20}$/,entry:()=>'https://creator.douyin.com/creator-micro/content/manage'},
  threads:{name:'threads-insights',page:threadsInsightsPage,parse:parseThreadsInsights,handle:/^[A-Za-z0-9_.]{1,40}$/,entry:()=>'https://www.threads.com/insights/'},
});

// 게시물별 값을 읽어 올린다 → null(이 계정은 대상 아님) · 'limited'(올림) · 'need_owner' · 'format' · 'retry' · 'no_posts'
async function postLifetime(ctx,{pageJob,storeBatch}){
  const {account:a,profile}=ctx,route=ROUTES[a.platform];
  if(!route||profile?.browser!=='ego'||!profile.profileId)return null;
  const handle=String(a.handle||'').replace(/^@/,'');
  if(!route.handle.test(handle))return 'need_owner';
  await ctx.setStage('creator-screen');
  const data=await pageJob(ctx,route.name,route.page,{entry:route.entry(handle),handle});
  if(!data||data.reason)return data?.reason||'retry';
  let parsed;
  try{parsed=route.parse(data,{accountId:a.id,handle});}
  catch(error){
    if(error.code==='SYNK_METRICS_NO_ROWS')return 'no_posts';
    throw error;
  }
  await storeBatch(ctx,route.name+'-posts',data,parsed.envelope);
  return 'limited';
}

// 실패해도 계정 합계 수집은 이어 간다. 까닭 글자만 회차 폴더에 남긴다(수치 · 화면 글은 남기지 않는다).
function note(ctx,reason,error){
  if(!ctx.dir)return;
  try{fs.writeFileSync(path.join(ctx.dir,'post-lifetime-failed.json'),JSON.stringify({at:new Date().toISOString(),reason,code:String(error?.code||'').slice(0,60)}),{flag:'wx'});}catch{/* 이미 있으면 첫 실패를 둔다 */}
}
module.exports={postLifetime,douyinWorksPage,threadsInsightsPage,note,ROUTES};
