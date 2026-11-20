'use strict';
// 게시물별 누적값 보완 수집(2026-11-19): 더우인 작품 목록 · 스레드 인사이트 목록 → 외부 관측 post-lifetime, 계정 합계 수집 뒤에 돈다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {parseDouyinWorks,parseThreadsInsights,parseLinkedInPosts,parseTistoryDaily}=require('../tools/lib/외부통계파싱.cjs');
const {postLifetime,douyinWorksPage,threadsInsightsPage,linkedinPostsPage}=require('../tools/계정통계예약/post-lifetime.cjs');
const {capture}=require('../tools/계정통계예약/capture-routes.cjs');
const 수집=require('../tools/계정통계수집.cjs');
const 판정=require('../tools/lib/게시성과판정.js');

const code=reason=>({code:'SYNK_METRICS_'+reason});
const DY={accountId:'lab-cn-douyin',handle:'39504393074'},TH={accountId:'yuhobuilds-threads',handle:'yuhobuilds'};
const OBSERVED='2026-11-19T06:00:00.000Z',sec=iso=>Date.parse(iso)/1000;
const work=(awemeId,createTime,stats={play:161,like:1,comment:0,share:0,collect:1},extra={})=>({awemeId,awemeType:4,createTime,desc:'韩语的“对不起”要看对象',authorUid:'3594780389672499',authorId:DY.handle,deleted:false,stats,...extra});
const douyin=(rows,extra={})=>({observedAt:OBSERVED,sourceUrl:'https://creator.douyin.com/creator-micro/content/manage',ownerUid:'3594780389672499',total:rows.length,complete:true,rows,...extra});
const threads=(rows,times,extra={})=>({observedAt:OBSERVED,sourceUrl:'https://www.threads.com/insights/',handle:'yuhobuilds',rows,times,...extra});
const post=(id,views,before=['여러분 PC에도 옮기고 남은 사본, 몇 기가쯤 있을 것 같아요?','1'])=>({path:'/insights/post/'+id,lines:[...before,String(views),'조회수'].slice(-3)});

test('더우인: 예약 · 지운 작품은 빼고 게시 작품의 다섯 칸을 www.douyin.com 영상 주소로 남긴다',()=>{
  const {envelope,summary}=parseDouyinWorks(douyin([
    work('7709384615689014547',sec('2026-11-22T06:00:00Z'),{play:0,like:0,comment:0,share:0,collect:0}),
    work('7709014174097100041',sec('2026-11-18T06:00:00Z')),
    work('7708642720381668635',sec('2026-11-17T06:00:00Z'),{play:4,like:0,comment:0,share:0,collect:0},{deleted:true}),
  ]),DY);
  assert.deepEqual(summary,{rows:3,published:1,scheduled:1,deleted:1});
  assert.equal(envelope.sourceType,'creator-screen');assert.equal(envelope.evidenceSha256,null);assert.deepEqual(envelope.identity,DY);
  assert.deepEqual(envelope.observations[0],{kind:'post-lifetime',post:{externalId:'7709014174097100041',url:'https://www.douyin.com/video/7709014174097100041',publishedAt:'2026-11-18T06:00:00.000Z',title:'韩语的“对不起”要看对象'},
    metrics:{views:161,likes:1,comments:0,shares:0,saves:1}});
});
test('더우인: 다른 작성자 · 끝까지 안 읽은 목록 · 줄인 수 · 빈 칸은 묶음 전체를 거절한다',()=>{
  const at=sec('2026-11-18T06:00:00Z');
  assert.throws(()=>parseDouyinWorks(douyin([work('7709014174097100041',at,undefined,{authorId:'12345678'})]),DY),code('IDENTITY'));
  assert.throws(()=>parseDouyinWorks(douyin([work('7709014174097100041',at,undefined,{authorUid:'1'})]),DY),code('IDENTITY'));
  assert.throws(()=>parseDouyinWorks(douyin([work('7709014174097100041',at)],{total:8}),DY),code('INCOMPLETE'));
  assert.throws(()=>parseDouyinWorks(douyin([work('7709014174097100041',at,{play:'1.2万',like:1,comment:0,share:0,collect:1})]),DY),code('COUNT'));
  assert.throws(()=>parseDouyinWorks(douyin([work('7709014174097100041',at,{play:161,like:null,comment:0,share:0,collect:1})]),DY),code('COUNT'));
  assert.throws(()=>parseDouyinWorks(douyin([work('7709014174097100041',at)],{sourceUrl:'https://creator.douyin.com/creator-micro/home'}),DY),code('SOURCE'));
  assert.throws(()=>parseDouyinWorks(douyin([work('7709384615689014547',sec('2026-11-22T06:00:00Z'))]),DY),code('NO_ROWS'));
});

test('스레드: 인사이트 목록의 조회수와 프로필 화면의 게시 시각으로 게시물 주소를 만든다',()=>{
  const {envelope}=parseThreadsInsights(threads([post('Df4dNhkEV8K',42),post('Df14Z4bEfye',7,['AI가 고친 화면에서 숫자가 틀렸던 적 있어요?'])],
    {Df4dNhkEV8K:'2026-11-18T12:01:18.000Z',Df14Z4bEfye:'2026-11-17T12:00:00.000Z'}),TH);
  assert.deepEqual(envelope.observations.map(o=>[o.post.url,o.post.publishedAt,o.metrics]),[
    ['https://www.threads.com/@yuhobuilds/post/Df4dNhkEV8K','2026-11-18T12:01:18.000Z',{views:42}],
    ['https://www.threads.com/@yuhobuilds/post/Df14Z4bEfye','2026-11-17T12:00:00.000Z',{views:7}]]);
  assert.deepEqual(envelope.identity,TH);
});
test('스레드: 시각을 못 찾은 게시물 · 줄인 수 · 다른 계정 · 다른 화면은 묶음 전체를 거절한다',()=>{
  const t={Df4dNhkEV8K:'2026-11-18T12:01:18.000Z'};
  assert.throws(()=>parseThreadsInsights(threads([post('Df4dNhkEV8K',42),post('Df14Z4bEfye',7)],t),TH),code('INCOMPLETE'));
  assert.throws(()=>parseThreadsInsights(threads([post('Df4dNhkEV8K','1.2천')],t),TH),code('COUNT'));
  assert.throws(()=>parseThreadsInsights(threads([post('Df4dNhkEV8K',42)],t,{handle:'other'}),TH),code('IDENTITY'));
  assert.throws(()=>parseThreadsInsights(threads([post('Df4dNhkEV8K',42)],t,{sourceUrl:'https://www.threads.com/@yuhobuilds'}),TH),code('SOURCE'));
  assert.throws(()=>parseThreadsInsights(threads([{path:'/insights/post/Df4dNhkEV8K',lines:['42','좋아요']}],t),TH),code('ROW'));
});

test('두 봉투 모두 서버 기록 규칙(external-observations.mjs)을 메모리 미리 보기에서 통과한다',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-post-lifetime-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const batches=[];
  for(const [name,accountId,evidence,parse,identity] of [
    ['douyin.json','lab-cn-douyin',douyin([work('7709014174097100041',sec('2026-11-18T06:00:00Z'))],{observedAt:new Date(Date.now()-60000).toISOString()}),parseDouyinWorks,DY],
    ['threads.json','yuhobuilds-threads',threads([post('Df4dNhkEV8K',42)],{Df4dNhkEV8K:'2026-11-18T12:01:18.000Z'},{observedAt:new Date(Date.now()-60000).toISOString()}),parseThreadsInsights,TH]]){
    const raw=Buffer.from(JSON.stringify(evidence));fs.writeFileSync(path.join(dir,name),raw);
    const {envelope}=parse(evidence,identity);
    batches.push({accountId,evidenceFile:name,envelope:{...envelope,evidenceSha256:crypto.createHash('sha256').update(raw).digest('hex')}});
  }
  const manifestPath=path.join(dir,'manifest.json');fs.writeFileSync(manifestPath,JSON.stringify({version:1,batches}));
  const report=await 수집.run({manifestPath,env:{},logDir:dir,connect:()=>{throw new Error('미리 보기에서 로그인하면 안 된다');}});
  assert.deepEqual(report.results.map(r=>[r.accountId,r.status,r.code]),[['lab-cn-douyin','ready',null],['yuhobuilds-threads','ready',null]]);
});

// 페이지 함수는 ego 페이지 안에서 돈다. 같은 꼴의 가짜 창(location · document · fetch)에서 그대로 돌려 본다.
function fakePage(realm){
  const run=(f,arg)=>vm.runInNewContext('('+f.toString()+')',realm)(arg);
  return {async waitForFunction(){},async waitForTimeout(){},async goto(url){realm.location=new URL(url);realm.document=realm.pages[url];},
    async evaluate(f,arg){const v=await run(f,arg);return v===undefined?undefined:JSON.parse(JSON.stringify(v));}};
}
test('더우인 페이지 함수: 화면이 부르는 작품 목록을 끝까지 넘기고 로그인 계정 번호를 함께 남긴다',async()=>{
  const page1={status_code:0,has_more:true,max_cursor:1795000000000,total:2,aweme_list:[{aweme_id:'7709014174097100041',aweme_type:4,create_time:sec('2026-11-18T06:00:00Z'),desc:'첫 작품',author:{uid:'3594780389672499',short_id:'39504393074',unique_id:'39504393074'},status:{is_delete:false},statistics:{play_count:161,digg_count:1,comment_count:0,share_count:0,collect_count:1}}]};
  const page2={status_code:0,has_more:false,max_cursor:0,total:2,aweme_list:[{...page1.aweme_list[0],aweme_id:'7708493104424160512',statistics:{play_count:66,digg_count:5,comment_count:0,share_count:0,collect_count:3}}]};
  const asked=[];
  const realm={location:new URL('https://creator.douyin.com/creator-micro/content/manage'),document:{body:{innerText:'作品 (2)'}},JSON,String,encodeURIComponent,
    fetch:async route=>{asked.push(route);const body=route.includes('user/info')?{status_code:0,uid:'3594780389672499'}:route.includes('max_cursor=0')?page1:page2;return {ok:true,text:async()=>JSON.stringify(body)};}};
  const data=await douyinWorksPage(fakePage(realm),{entry:'https://creator.douyin.com/creator-micro/content/manage',handle:'39504393074'});
  assert.equal(asked.length,3);assert.match(asked[2],/max_cursor=1795000000000/);
  const {summary,envelope}=parseDouyinWorks({...data,observedAt:OBSERVED},DY);
  assert.equal(summary.published,2);assert.deepEqual(envelope.observations[1].metrics,{views:66,likes:5,comments:0,shares:0,saves:3});
  realm.location=new URL('https://creator.douyin.com/creator-micro/home');
  assert.deepEqual(await douyinWorksPage(fakePage(realm),{entry:'https://creator.douyin.com/creator-micro/content/manage',handle:'39504393074'}),{reason:'need_owner'});
});
test('스레드 페이지 함수: 본인 프로필 메뉴가 있을 때만 읽고, 프로필 화면에서 목록 게시물의 게시 시각을 모은다',async()=>{
  const link=(pathname,innerText)=>({pathname,innerText,getAttribute:()=>null,textContent:innerText});
  const insights={body:{innerText:'PDF로 내보내기'},querySelector:()=>({}),querySelectorAll:sel=>sel==='a[href]'?[link('/@yuhobuilds','프로필')]:sel.startsWith('a[href^=')?[link('/insights/post/Df4dNhkEV8K','새 SSD 하나 달다\n1\n42\n조회수')]:[]};
  const time=(dateTime,pathname)=>({dateTime,closest:()=>({pathname})});
  const profile={body:{innerText:''},querySelector:()=>({}),querySelectorAll:sel=>sel==='time[datetime]'?[time('2026-11-18T12:01:18.000Z','/@yuhobuilds/post/Df4dNhkEV8K'),time('2026-11-18T10:00:00.000Z','/@other/post/Zz')]:[]};
  const realm={location:new URL('https://www.threads.com/insights'),document:insights,pages:{'https://www.threads.com/@yuhobuilds':profile},window:{scrollBy(){}},Math,Object};
  const data=await threadsInsightsPage(fakePage(realm),{entry:'https://www.threads.com/insights/',handle:'yuhobuilds'});
  assert.deepEqual(data.times,{Df4dNhkEV8K:'2026-11-18T12:01:18.000Z'});
  assert.deepEqual(parseThreadsInsights({...data,observedAt:OBSERVED},TH).envelope.observations[0].metrics,{views:42});
  realm.location=new URL('https://www.threads.com/insights');realm.document={...insights,querySelectorAll:sel=>sel==='a[href]'?[link('/@someone','프로필')]:[]};
  assert.deepEqual(await threadsInsightsPage(fakePage(realm),{entry:'https://www.threads.com/insights/',handle:'yuhobuilds'}),{reason:'need_owner'});
});

test('postLifetime: ego 프로필의 더우인 · 스레드만 읽고, 다른 플랫폼 · Aside 계정은 건드리지 않는다',async()=>{
  const ctx=(platform,handle,profile={browser:'ego',profileId:'Profile 5'})=>({account:{id:platform==='douyin'?DY.accountId:TH.accountId,platform,handle},profile,setStage:async()=>{}});
  let saved=null;
  const helpers={pageJob:async(c,name,fn,args)=>{assert.equal(typeof fn,'function');return name==='douyin-works'?douyin([work('7709014174097100041',sec('2026-11-18T06:00:00Z'))]):threads([post('Df4dNhkEV8K',42)],{Df4dNhkEV8K:'2026-11-18T12:01:18.000Z'});},
    storeBatch:async(c,name,raw,envelope)=>{saved={name,envelope};}};
  assert.equal(await postLifetime(ctx('douyin','39504393074'),helpers),'limited');assert.equal(saved.name,'douyin-works-posts');
  assert.equal(await postLifetime(ctx('threads','@yuhobuilds'),helpers),'limited');assert.equal(saved.envelope.observations[0].metrics.views,42);
  saved=null;
  assert.equal(await postLifetime(ctx('threads','@yuhokorean',{browser:'aside',account:'u2'}),helpers),null);
  assert.equal(await postLifetime(ctx('instagram','synk'),helpers),null);
  assert.equal(saved,null);
  assert.equal(await postLifetime(ctx('douyin','39504393074'),{...helpers,pageJob:async()=>douyin([work('7709384615689014547',sec('2026-11-22T06:00:00Z'))])}),'no_posts');
});
test('capture: 계정 합계 수집을 마친 뒤 게시물별 값을 읽고, 그 실패는 앞 결과를 바꾸지 않는다',async()=>{
  const order=[],base=()=>({account:{platform:'douyin'},profile:{},covered:()=>false,signal:new AbortController().signal});
  const ownerSource=async()=>{order.push('owner');return null;},publicSource=async()=>{order.push('public');return {reason:'limited'};};
  assert.equal(await capture(base(),{ownerSource,publicSource,postSource:async()=>{order.push('post');return 'limited';}}),'limited');
  assert.deepEqual(order,['owner','public','post']);
  assert.equal(await capture(base(),{ownerSource,publicSource,postSource:async()=>{throw Object.assign(new Error('x'),{code:'SYNK_METRICS_COUNT'});}}),'limited');
  assert.equal(await capture(base(),{ownerSource,publicSource,postSource:async()=>{throw new Error('user has control');}}),'user_control');
  assert.equal(await capture(base(),{ownerSource:async()=>'user_control',publicSource,postSource:()=>assert.fail('사용자 제어 뒤에 다시 열었다')}),'user_control');
});

test('판정 도구가 더우인 영상 주소를 서버 postRoute와 같은 모양으로 읽는다',()=>{
  assert.deepEqual(판정.postIdOf('https://www.douyin.com/video/7709014174097100041'),{platform:'douyin',externalId:'7709014174097100041',key:'douyin:7709014174097100041'});
  assert.equal(판정.postIdOf('https://www.douyin.com/user/MS4wLjABAAAA'),null);
  assert.equal(판정.formatOf({platform:'douyin',url:'https://www.douyin.com/video/7709014174097100041'}),'douyin-video');
  assert.equal(require('../tools/lib/게시성과읽기.cjs').PLATFORMS.includes('douyin'),true);
});

// ── 링크드인 개인 프로필 게시물 분석(11-19, ego Profile 18) ──
const LI={accountId:'yuhobuilds-linkedin',handle:'yuhobuilds'},ACT='7528790069269278720';
const summaryLines=(n={views:'3',reach:'2',likes:'0',comments:'0',saves:'0',shares:'0'})=>['검색',n.views,'노출수','인맥 내(팔로워 및 1촌)','100퍼센트','인맥 외','0퍼센트',n.reach,'회원 도달','글 올리기','동영상 실적','3','동영상 조회','참여','0','소셜 참여','반응',n.likes,'댓글',n.comments,'퍼감','5','저장수',n.saves,'LinkedIn에서 보내기',n.shares];
const liPost=(extra={})=>({activityId:ACT,observedAt:'2026-11-19T00:00:00.000Z',sourceUrl:`https://www.linkedin.com/analytics/post-summary/urn:li:activity:${ACT}/`,lines:summaryLines(),...extra});
test('링크드인: 게시물마다 분석 화면 주소를 출처로 한 봉투를 만들고, 퍼감은 공유에 넣지 않는다',()=>{
  const {batches}=parseLinkedInPosts({handle:'yuhobuilds',posts:[liPost({lines:summaryLines({views:'1,204',reach:'830',likes:'7',comments:'1',saves:'2',shares:'3'})})]},LI);
  assert.equal(batches.length,1);
  const {envelope}=batches[0];
  assert.equal(envelope.sourceUrl,`https://www.linkedin.com/analytics/post-summary/urn:li:activity:${ACT}/`);
  assert.deepEqual(envelope.observations[0].post,{externalId:`urn:li:activity:${ACT}`,url:`https://www.linkedin.com/feed/update/urn:li:activity:${ACT}/`,publishedAt:new Date(Number(BigInt(ACT)>>22n)).toISOString()});
  // 조회 칸은 동영상 조회(3)다. 노출수(1,204)는 조회가 아니라서 넣지 않는다(11-19 GPT 검수 P1).
  assert.deepEqual(envelope.observations[0].metrics,{views:3,reach:830,likes:7,comments:1,saves:2,shares:3});
  assert.equal(envelope.observations[0].labels.metricLabels.views,'동영상 조회');
  // 회원 도달 칸이 없는 게시물(11-19 실측)은 도달을 빼고 나머지를 넣는다.
  const noReach=summaryLines().filter((l,i,a)=>l!=='회원 도달'&&a[i+1]!=='회원 도달');
  const one=parseLinkedInPosts({handle:'yuhobuilds',posts:[liPost({lines:noReach})]},LI).batches[0].envelope.observations[0];
  assert.deepEqual(one.metrics,{views:3,likes:0,comments:0,saves:0,shares:0});assert.equal('reach' in one.labels.metricLabels,false);
  // 동영상이 없는 글은 조회 칸이 없다.
  const text=summaryLines().filter((l,i,a)=>!['동영상 실적','동영상 조회'].includes(l)&&a[i+1]!=='동영상 조회');
  assert.deepEqual(parseLinkedInPosts({handle:'yuhobuilds',posts:[liPost({lines:text})]},LI).batches[0].envelope.observations[0].metrics,{reach:2,likes:0,comments:0,saves:0,shares:0});
});
test('링크드인: 다른 계정 · 다른 화면 · 빠진 칸 · 줄인 수 · 관측보다 뒤인 활동 번호는 거절한다',()=>{
  const ok={handle:'yuhobuilds',posts:[liPost()]};
  assert.throws(()=>parseLinkedInPosts({...ok,handle:'someone'},LI),code('IDENTITY'));
  assert.throws(()=>parseLinkedInPosts({handle:'yuhobuilds',posts:[liPost({sourceUrl:'https://www.linkedin.com/analytics/creator/content/'})]},LI),code('SOURCE'));
  assert.throws(()=>parseLinkedInPosts({handle:'yuhobuilds',posts:[liPost({lines:summaryLines().filter(l=>l!=='저장수')})]},LI),code('ROW'));
  assert.throws(()=>parseLinkedInPosts({handle:'yuhobuilds',posts:[liPost({lines:summaryLines({views:'3',reach:'2',likes:'1.2천',comments:'0',saves:'0',shares:'0'})})]},LI),code('COUNT'));
  assert.throws(()=>parseLinkedInPosts({handle:'yuhobuilds',posts:[liPost({observedAt:'2026-11-01T00:00:00.000Z'})]},LI),code('TIME'));
  assert.throws(()=>parseLinkedInPosts({handle:'yuhobuilds',posts:[]},LI),code('NO_ROWS'));
});
test('링크드인 페이지 함수: 소개 편집 링크로 주인을 확인하고 분석 보기 링크의 활동 번호마다 분석 화면 줄을 남긴다',async()=>{
  const link=pathname=>({pathname,getAttribute:()=>'https://www.linkedin.com'+pathname});
  const profile={links:[link('/in/yuhobuilds/edit/intro/')],querySelectorAll:()=>[]};
  const activity={links:[],documentElement:{clientHeight:800},querySelector:()=>({}),querySelectorAll:()=>[link(`/analytics/post-summary/urn:li:activity:${ACT}/`)]};
  const summary={links:[],querySelector:sel=>sel==='main'?{innerText:['작성자 이름','본문 글',...summaryLines()].join('\n')}:null,querySelectorAll:()=>[]};
  const realm={location:new URL('https://www.linkedin.com/in/yuhobuilds/'),document:profile,decodeURI,String,Math,window:{scrollBy(){}},
    pages:{'https://www.linkedin.com/in/yuhobuilds/recent-activity/all/':activity,[`https://www.linkedin.com/analytics/post-summary/urn:li:activity:${ACT}/`]:summary}};
  const data=await linkedinPostsPage(fakePage(realm),{entry:'https://www.linkedin.com/in/yuhobuilds/',handle:'yuhobuilds',limit:10});
  assert.equal(data.posts.length,1);assert.equal(data.posts[0].lines.includes('본문 글'),false);
  assert.deepEqual(parseLinkedInPosts(data,LI).batches[0].envelope.observations[0].metrics,{views:3,reach:2,likes:0,comments:0,saves:0,shares:0});
  realm.location=new URL('https://www.linkedin.com/in/yuhobuilds/');realm.document={links:[link('/in/someone/edit/intro/')]};
  assert.deepEqual(await linkedinPostsPage(fakePage(realm),{entry:'https://www.linkedin.com/in/yuhobuilds/',handle:'yuhobuilds',limit:10}),{reason:'need_owner'});
});
test('postLifetime: 링크드인은 개인 프로필만 읽고 게시물마다 따로 올린다',async()=>{
  const saved=[];
  const helpers={pageJob:async()=>({handle:'yuhobuilds',posts:[liPost(),liPost({activityId:'7528711928051847168',sourceUrl:'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7528711928051847168/'})]}),
    storeBatch:async(c,name,raw,envelope)=>{saved.push(name);}};
  const ctx=publicUrl=>({account:{id:LI.accountId,platform:'linkedin',handle:'yuhobuilds',publicUrl},profile:{browser:'ego',profileId:'Profile 18'},setStage:async()=>{}});
  assert.equal(await postLifetime(ctx('https://www.linkedin.com/in/yuhobuilds/'),helpers),'limited');
  assert.deepEqual(saved,['linkedin-post-'+ACT,'linkedin-post-7528711928051847168']);
  assert.equal(await postLifetime(ctx('https://www.linkedin.com/company/synk-im/'),helpers),null);
  assert.deepEqual(판정.postIdOf(`https://www.linkedin.com/feed/update/urn:li:activity:${ACT}/`),{platform:'linkedin',externalId:`urn:li:activity:${ACT}`,key:`linkedin:urn:li:activity:${ACT}`});
});

// ── 티스토리: 글별 누적이 없어 일간 인기글 조회수를 게시일부터 더한다(11-19 유호님 「기간 값이라도 넣어」) ──
const TI={accountId:'shift-tistory',handle:'yuhobuilds.tistory.com'};
const tDays=(from,n,map={})=>Array.from({length:n},(_,i)=>{const date=new Date(Date.parse(from+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);const entries=(map[date]||[]).map(([entryId,count])=>({entryId,count}));return {date,length:entries.length,entries};});
const tPost=(id,published,extra={})=>({id,published,visibility:'PUBLIC',scheduled:false,permalink:`https://yuhobuilds.tistory.com/${id}`,comments:'0',...extra});
const tistory=(posts,days,extra={})=>({observedAt:'2026-11-19T10:30:00.000Z',sourceUrl:'https://yuhobuilds.tistory.com/manage/statistics/blog',host:'yuhobuilds.tistory.com',posts,days,...extra});
test('티스토리: 게시한 날부터 관측한 날까지 일간 인기글 조회수를 더하고, 이름표에 「합」으로 적는다',()=>{
  const days=tDays('2026-11-05',15,{'2026-11-16':[[27,1]],'2026-11-17':[[27,2],[28,1]],'2026-11-19':[[28,1]],'2026-11-10':[[27,9]]});
  const {envelope,summary}=parseTistoryDaily(tistory([tPost('27','2026-11-16 21:30'),tPost('28','2026-11-17 21:30',{comments:'1'}),tPost('31','2026-11-22 21:30',{visibility:'RESERVED_PUBLIC',scheduled:true}),tPost('3','2026-10-21 21:30')],days),TI);
  assert.deepEqual(summary,{posts:2,older:1,hidden:1,days:15});
  assert.deepEqual(envelope.observations.map(o=>[o.post.url,o.post.publishedAt,o.metrics]),[
    ['https://yuhobuilds.tistory.com/27','2026-11-16T21:30:00+09:00',{views:3,comments:0}],
    ['https://yuhobuilds.tistory.com/28','2026-11-17T21:30:00+09:00',{views:2,comments:1}]]);
  assert.match(envelope.observations[0].labels.periodLabel,/2026-11-16부터 2026-11-19까지 일간 인기글 조회수 합/);
  assert.equal(envelope.observations[0].labels.metricLabels.views,'인기글 일간 조회수 합(게시일부터)');
});
test('티스토리: 잘렸을 수 있는 날 · 빠진 날 · 오늘까지 안 읽은 목록 · 다른 블로그는 거절한다',()=>{
  const ok=tDays('2026-11-10',10);
  assert.throws(()=>parseTistoryDaily(tistory([tPost('27','2026-11-16 21:30')],tDays('2026-11-10',10,{'2026-11-17':Array.from({length:16},(_,i)=>[i+1,1])})),TI),code('INCOMPLETE'));
  assert.doesNotThrow(()=>parseTistoryDaily(tistory([tPost('27','2026-11-16 21:30')],tDays('2026-11-10',10,{'2026-11-15':Array.from({length:15},(_,i)=>[i+1,1])})),TI));
  assert.throws(()=>parseTistoryDaily(tistory([tPost('27','2026-11-16 21:30')],ok.filter(d=>d.date!=='2026-11-15')),TI),code('INCOMPLETE'));
  assert.throws(()=>parseTistoryDaily(tistory([tPost('27','2026-11-16 21:30')],ok.slice(0,-1)),TI),code('INCOMPLETE'));
  assert.throws(()=>parseTistoryDaily(tistory([tPost('27','2026-11-16 21:30')],ok,{host:'other.tistory.com'}),TI),code('SOURCE'));
  assert.throws(()=>parseTistoryDaily(tistory([tPost('27','2026-11-16 21:30',{permalink:'https://other.tistory.com/27'})],ok),TI),code('ROW'));
});
test('티스토리 봉투도 서버 기록 규칙을 메모리 미리 보기에서 통과한다',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-post-lifetime-ti-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const now=new Date(Date.now()-60000),today=new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
  const from=new Date(Date.parse(today+'T00:00:00Z')-5*86400000).toISOString().slice(0,10);
  const published=new Date(Date.parse(today+'T00:00:00Z')-2*86400000).toISOString().slice(0,10)+' 21:30';
  const evidence=tistory([tPost('29',published)],tDays(from,6),{observedAt:now.toISOString()});
  const raw=Buffer.from(JSON.stringify(evidence));fs.writeFileSync(path.join(dir,'t.json'),raw);
  const {envelope}=parseTistoryDaily(evidence,TI);
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({version:1,batches:[{accountId:'shift-tistory',evidenceFile:'t.json',envelope:{...envelope,evidenceSha256:crypto.createHash('sha256').update(raw).digest('hex')}}]}));
  const report=await 수집.run({manifestPath:path.join(dir,'manifest.json'),env:{},logDir:dir,connect:()=>{throw new Error('미리 보기에서 로그인하면 안 된다');}});
  assert.deepEqual(report.results.map(r=>[r.status,r.code]),[['ready',null]]);
});
test('postLifetime: 티스토리는 Aside 계정으로만 읽고, 판정 도구는 블로그 주소를 열쇠에 넣는다',async()=>{
  let asked=null;const saved=[];
  const helpers={pageJob:async(c,name,fn,args)=>{asked=args;return tistory([tPost('27','2026-11-16 21:30')],tDays('2026-11-05',15));},storeBatch:async(c,name)=>{saved.push(name);}};
  const ctx=profile=>({account:{id:'shift-tistory',platform:'tistory',handle:'yuhobuilds.tistory.com'},profile,setStage:async()=>{}});
  assert.equal(await postLifetime(ctx({browser:'aside',account:'u0'}),helpers),'limited');
  assert.equal(asked.entry,'https://yuhobuilds.tistory.com/manage/statistics/blog');assert.equal(asked.days,45);assert.deepEqual(saved,['tistory-daily-posts']);
  assert.equal(await postLifetime(ctx({browser:'ego',profileId:'Profile 7'}),helpers),null);
  assert.equal(await postLifetime(ctx({browser:'aside'}),helpers),null);
  assert.equal(판정.postIdOf('https://yuhobuilds.tistory.com/27').key,'tistory:yuhobuilds.tistory.com/27');
  assert.equal(판정.postIdOf('https://yuhobuilds.tistory.com/manage/posts'),null);
});

// VK 클립(공개 클립 목록 · 클립 화면)과 네이버 블로그 글 목록(주인 세션 · RSS 게시 시각) — 11-19. 서버 회사 판이 오르기 전에는 길이 꺼져 있다.
const {parseVkClips,parseNaverBlogPosts}=require('../tools/lib/외부통계파싱.cjs');
const {vkClipsPage,naverBlogPostsPage,ROUTES}=require('../tools/계정통계예약/post-lifetime.cjs');
const VK={accountId:'lab-ru-vk',handle:'synklab_ru',communityId:'243082040'},NB={accountId:'shift-naverblog',handle:'synkshift'};
const link=id=>({z:'clip-243082040_'+id,owner:'-243082040',feed:'ownerFeed'});
const clip=(id,at,engagement={views:21,likes:0,comments:0,shares:0},extra={})=>({clipId:id,ownerId:-243082040,publishTimestamp:at,isAuthor:true,viewPrivacy:'all',engagement,...extra});
const vk=(ids,rows,extra={})=>({observedAt:OBSERVED,sourceUrl:'https://vk.ru/clips/synklab_ru',communityId:'243082040',links:ids.map(link),rows,...extra});
const blog=(no,readCount,title='사흘 전에 지운 앱이 7만 5천 원을 가져갔다')=>({logNo:no,readCount,addDate:'9시간 전',title});
const naver=(rows,times,extra={})=>({observedAt:OBSERVED,sourceUrl:'https://blog.naver.com/synkshift',total:rows.length,rows,times,...extra});

test('VK: 공개 클립 목록의 클립을 clip-<소유자>_<번호>로 남기고, 예약 · 비공개 클립은 건너뛴다',()=>{
  const {envelope,summary}=parseVkClips(vk(['456239018','456239019','456239020'],[
    clip('456239018',sec('2026-11-17T10:00:56Z')),
    clip('456239019',sec('2026-11-19T10:00:00Z'),{views:0,likes:0,comments:0,shares:0}),
    clip('456239020',sec('2026-11-16T10:00:00Z'),{views:3,likes:0,comments:0,shares:0},{viewPrivacy:'friends'})]),VK);
  assert.deepEqual(summary,{listed:3,published:1,scheduled:1,hidden:1});
  assert.equal(envelope.sourceType,'public-page');assert.equal(envelope.sourceUrl,'https://vk.ru/clips/synklab_ru');
  assert.deepEqual(envelope.identity,{accountId:'lab-ru-vk',handle:'synklab_ru'});
  assert.deepEqual(envelope.observations,[{kind:'post-lifetime',post:{externalId:'clip-243082040_456239018',url:'https://vk.ru/clip-243082040_456239018',publishedAt:'2026-11-17T10:00:56.000Z'},
    metrics:{views:21,likes:0,comments:0,shares:0}}]);
});
test('VK: 다른 커뮤니티 칸 · 작성자 아님 · 덜 읽은 목록 · 줄인 수 · 다른 화면은 묶음 전체를 거절한다',()=>{
  const at=sec('2026-11-17T10:00:56Z');
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at)],{links:[{z:'clip-1_456239018',owner:'-1',feed:'ownerFeed'}]}),VK),code('IDENTITY'));
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at)],{links:[{...link('456239018'),feed:'forYou'}]}),VK),code('IDENTITY'));
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at,undefined,{isAuthor:false})]),VK),code('IDENTITY'));
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at,undefined,{ownerId:-1})]),VK),code('IDENTITY'));
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at)],{communityId:'1'}),VK),code('IDENTITY'));
  assert.throws(()=>parseVkClips(vk(['456239018','456239019'],[clip('456239018',at)]),VK),code('INCOMPLETE'));
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at,{views:'1.2K',likes:0,comments:0,shares:0})]),VK),code('COUNT'));
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at,{views:21,likes:null,comments:0,shares:0})]),VK),code('COUNT'));
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at)],{sourceUrl:'https://vk.ru/synklab_ru'}),VK),code('SOURCE'));
  assert.throws(()=>parseVkClips(vk(['456239018'],[clip('456239018',at)]),{...VK,communityId:''}),code('IDENTITY'));
  assert.throws(()=>parseVkClips(vk(['456239019'],[clip('456239019',sec('2026-11-19T10:00:00Z'))]),VK),code('NO_ROWS'));
});

test('네이버 블로그: 주인 세션의 누적 조회수와 RSS 게시 시각으로 글 주소를 만들고, RSS에 없는 글은 건너뛴다',()=>{
  const {envelope,summary}=parseNaverBlogPosts(naver([blog('224478068429','1'),blog('224478065618','2'),blog('224400000001','12')],
    {'224478068429':'2026-11-18T12:10:00.000Z','224478065618':'2026-11-17T12:10:00.000Z'}),NB);
  assert.deepEqual(summary,{rows:3,posts:2,untimed:1});
  assert.equal(envelope.sourceType,'creator-screen');assert.equal(envelope.sourceUrl,'https://blog.naver.com/synkshift');
  assert.deepEqual(envelope.observations[0],{kind:'post-lifetime',post:{externalId:'224478068429',url:'https://blog.naver.com/synkshift/224478068429',publishedAt:'2026-11-18T12:10:00.000Z',
    title:'사흘 전에 지운 앱이 7만 5천 원을 가져갔다'},metrics:{views:1}});
});
test('네이버 블로그: 빈 조회수(주인 세션 아님) · 덜 읽은 목록 · 줄인 수 · 다른 화면은 묶음 전체를 거절한다',()=>{
  const t={'224478068429':'2026-11-18T12:10:00.000Z'};
  assert.throws(()=>parseNaverBlogPosts(naver([blog('224478068429','')],t),NB),code('IDENTITY'));
  // 앞쪽만 읽은 목록은 RSS 글이 모두 그 안에 있을 때만 받는다(GPT GA4). 전체 수가 읽은 수보다 작으면 거절한다.
  assert.throws(()=>parseNaverBlogPosts(naver([blog('224478068429','1')],{...t,'224478065618':'2026-11-17T12:10:00.000Z'},{total:19}),NB),code('INCOMPLETE'));
  assert.throws(()=>parseNaverBlogPosts(naver([blog('224478068429','1'),blog('224478065618','2')],t,{total:1}),NB),code('INCOMPLETE'));
  assert.equal(parseNaverBlogPosts(naver([blog('224478068429','1')],t,{total:1200}),NB).summary.posts,1);
  assert.throws(()=>parseNaverBlogPosts(naver([blog('224478068429','1.2만')],t),NB),code('COUNT'));
  assert.throws(()=>parseNaverBlogPosts(naver([blog('224478068429','1')],t,{sourceUrl:'https://admin.blog.naver.com/synkshift/stat/today'}),NB),code('SOURCE'));
  assert.throws(()=>parseNaverBlogPosts(naver([blog('224478068429','1')],{'224478068429':'2026-11-20T12:10:00.000Z'}),NB),code('ROW'));
  assert.throws(()=>parseNaverBlogPosts(naver([blog('224478068429','1'),blog('224478068429','1')],t),NB),code('DUPLICATE'));
  assert.throws(()=>parseNaverBlogPosts(naver([blog('224400000001','3')],t),NB),code('NO_ROWS'));
});

test('VK 봉투는 바뀐 서버 기록 규칙(external-observations.mjs)을 메모리 미리 보기에서 통과하고, 네이버 글 목록 봉투는 서버 규칙이 실리기 전이라 출처에서 걸린다',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-post-lifetime-vk-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const recent=new Date(Date.now()-60000).toISOString(),day=new Date(Date.now()-2*86400000);
  const batches=[];
  for(const [name,accountId,evidence,parse,identity] of [
    ['vk.json','lab-ru-vk',vk(['456239018'],[clip('456239018',Math.floor(day/1000))],{observedAt:recent}),parseVkClips,VK],
    ['naver.json','shift-naverblog',naver([blog('224478068429','1')],{'224478068429':day.toISOString()},{observedAt:recent}),parseNaverBlogPosts,NB]]){
    const raw=Buffer.from(JSON.stringify(evidence));fs.writeFileSync(path.join(dir,name),raw);
    const {envelope}=parse(evidence,identity);
    batches.push({accountId,evidenceFile:name,envelope:{...envelope,evidenceSha256:crypto.createHash('sha256').update(raw).digest('hex')}});
  }
  const manifestPath=path.join(dir,'manifest.json');fs.writeFileSync(manifestPath,JSON.stringify({version:1,batches}));
  const report=await 수집.run({manifestPath,env:{},logDir:dir,connect:()=>{throw new Error('미리 보기에서 로그인하면 안 된다');}});
  // 네이버 블로그 주인 글 목록(blog.naver.com/<아이디>)을 받는 서버 규칙은 운영 데이터 확인 뒤 따로 싣는다(11-19). 그 전에는 수집기의 네이버 길도 꺼 둔다.
  assert.deepEqual(report.results.map(r=>[r.accountId,r.status,r.code]),[['lab-ru-vk','ready',null],['shift-naverblog','invalid','SYNK_EXTERNAL_SOURCE']]);
});

test('VK 페이지 함수: 목록의 이 커뮤니티 클립만 골라 클립 화면 응답에 박힌 수치와 게시 시각을 읽는다',async()=>{
  const item=(id,views)=>({owner_id:-243082040,id:Number(id),description:'«не делай» {괄호} \\"따옴표\\"',engagement:{view_count:views,comment_count:0,like_count:1,repost_count:2,is_subscribed:true},
    publish_timestamp:1794909656,privacy:{view:{category:'all'}},is_author:true});
  // 실제 화면처럼 같은 열쇠가 다른 객체(수치 없는 짧은 꼴)에 먼저 나와도 수치가 있는 객체를 고른다.
  const html=id=>'<script>var x={"short_video_raw_ids":"-243082040_'+id+'","stub":{"owner_id":-243082040,"id":'+id+',"title":"}"},"response":{"feed":{"items":[{"type":"short_video_full","item":'+JSON.stringify(item(id,21))+'}]}}};</script>';
  const anchors=['?z=clip-243082040_456239018&feedType=ownerFeed&owner=-243082040','?z=clip-999_1&feedType=forYou&owner=-999'];
  const asked=[];
  const realm={location:new URL('https://vk.ru/clips/synklab_ru'),URL,JSON,String,Number,
    document:{querySelector:()=>({}),querySelectorAll:()=>anchors.map(h=>({getAttribute:()=>h})),documentElement:{scrollHeight:1}},window:{scrollTo(){return 0;}},
    fetch:async route=>{asked.push(route);return {ok:true,text:async()=>html(route.split('_')[1])};}};
  const data=await vkClipsPage(fakePage(realm),{entry:'https://vk.ru/clips/synklab_ru',handle:'synklab_ru',communityId:'243082040'});
  assert.deepEqual(asked,['/clip-243082040_456239018']);
  assert.deepEqual(data.rows,[{clipId:'456239018',ownerId:-243082040,publishTimestamp:1794909656,isAuthor:true,viewPrivacy:'all',engagement:{views:21,likes:1,comments:0,shares:2}}]);
  // 다른 커뮤니티 칸이 섞인 목록은 파서가 거절한다(페이지 함수는 그 칸을 읽지 않고 그대로 남긴다).
  assert.throws(()=>parseVkClips({...data,observedAt:OBSERVED},VK),code('IDENTITY'));
  assert.equal(parseVkClips({...data,links:data.links.slice(0,1),observedAt:OBSERVED},VK).envelope.observations[0].metrics.shares,2);
  // 내릴 때마다 칸이 늘어 끝을 확인하지 못하면 덜 읽은 목록이라 올리지 않는다(GPT GA3).
  let grow=0;realm.document={...realm.document,querySelectorAll:()=>Array.from({length:++grow},(_,i)=>({getAttribute:()=>'?z=clip-243082040_'+(456239000+i)+'&feedType=ownerFeed&owner=-243082040'}))};
  assert.deepEqual(await vkClipsPage(fakePage(realm),{entry:'https://vk.ru/clips/synklab_ru',handle:'synklab_ru',communityId:'243082040'}),{reason:'retry',at:'list'});
  realm.location=new URL('https://vk.ru/synklab_ru');
  assert.deepEqual(await vkClipsPage(fakePage(realm),{entry:'https://vk.ru/clips/synklab_ru',handle:'synklab_ru',communityId:'243082040'}),{reason:'need_owner'});
});
test('네이버 페이지 함수: 쪽을 넘겨 끝까지 읽고 \\\' 이스케이프와 HTML 기호를 풀며, RSS에서 이 블로그 글의 게시 시각만 모은다',async()=>{
  const BS='\\',page=(rows,total)=>'{"resultCode":"S","resultMessage":"","postList":'+JSON.stringify(rows)+',"countPerPage":"30","totalCount":"'+total+'","pagingHtml":"<div class='+BS+"'blog2_paginate"+BS+"'></div>\"}";
  const row=(no,read,title)=>({logNo:no,title:encodeURIComponent(title).replace(/%20/g,'+'),readCount:read,addDate:'2026. 11. 17.',commentCount:''});
  const asked=[];
  const rss={querySelectorAll:()=>[['https://blog.naver.com/synkshift/224478068429','Wed, 18 Nov 2026 21:10:00 +0900'],['https://blog.naver.com/other/224000000000','Wed, 18 Nov 2026 21:10:00 +0900']]
    .map(([guid,pub])=>({querySelector:sel=>({textContent:sel==='guid'?guid:pub})}))};
  const realm={location:new URL('https://blog.naver.com/synkshift'),JSON,String,Number,Date,encodeURIComponent,decodeURIComponent,
    document:{createElement:()=>{const box={};Object.defineProperty(box,'innerHTML',{set(v){box.value=v.replace(/&quot;/g,'"');}});return box;}},
    pages:{'https://rss.blog.naver.com/synkshift.xml':rss},
    fetch:async route=>{asked.push(route);const n=Number(/currentPage=(\d+)/.exec(route)[1]);
      return {ok:true,text:async()=>n===1?page([row('224478068429','1','ChatGPT에 &quot;보고서 써&quot;')],2):page([row('224478065618','2','둘째 글')],2)};}};
  const p=fakePage(realm);p.waitForLoadState=async()=>{};
  const data=await naverBlogPostsPage(p,{entry:'https://blog.naver.com/synkshift',handle:'synkshift'});
  assert.equal(asked.length,2);assert.match(asked[0],/blogId=synkshift&.*currentPage=1&.*countPerPage=30/);
  assert.deepEqual(data.rows.map(r=>[r.logNo,r.readCount,r.title]),[['224478068429','1','ChatGPT에 "보고서 써"'],['224478065618','2','둘째 글']]);
  assert.deepEqual(data.times,{'224478068429':'2026-11-18T12:10:00.000Z'});
  assert.deepEqual(parseNaverBlogPosts({...data,observedAt:OBSERVED},NB).summary,{rows:2,posts:1,untimed:1});
  realm.location=new URL('https://section.blog.naver.com/BlogHome.naver');
  assert.deepEqual(await naverBlogPostsPage(p,{entry:'https://blog.naver.com/synkshift',handle:'synkshift'}),{reason:'need_owner'});
});

test('postLifetime: VK 길은 회사 판 76부터 켜져 ego와 커뮤니티 번호에서 돌고, 네이버 길은 서버 규칙 전이라 꺼져 있다(켜면 Aside 계정에서만 돈다)',async()=>{
  assert.deepEqual([ROUTES.vk.live,ROUTES['naver-blog'].live,ROUTES.douyin.live,ROUTES.threads.live],[true,false,true,true]);
  const stages=[];
  const ctx=(id,platform,handle,profile,publicUrl)=>({account:{id,platform,handle,publicUrl},profile,setStage:async s=>{stages.push(s);}});
  const vkCtx=(profile={browser:'ego',profileId:'Profile 5',communityId:'243082040'},url='https://vk.ru/synklab_ru')=>ctx('lab-ru-vk','vk','synklab_ru',profile,url);
  const nbCtx=(profile={browser:'aside',account:'u0'})=>ctx('shift-naverblog','naver-blog','synkshift',profile,'https://blog.naver.com/synkshift');
  const at=sec('2026-11-17T10:00:56Z');let saved=null;const args=[];
  const helpers={pageJob:async(c,name,fn,a)=>{args.push([name,a]);return name==='vk-clips'?vk(['456239018'],[clip('456239018',at)]):naver([blog('224478068429','1')],{'224478068429':'2026-11-18T12:10:00.000Z'});},
    storeBatch:async(c,name,raw,envelope)=>{saved={name,envelope};}};
  assert.equal(await postLifetime(nbCtx(),helpers),null);assert.equal(saved,null);
  assert.equal(await postLifetime(vkCtx(),helpers),'limited');assert.equal(saved.name,'vk-clips-posts');saved=null;
  const on=Object.fromEntries(Object.entries(ROUTES).map(([k,r])=>[k,{...r,live:true}]));
  assert.equal(await postLifetime(vkCtx(),helpers,on),'limited');
  assert.equal(saved.name,'vk-clips-posts');assert.equal(saved.envelope.sourceType,'public-page');
  assert.deepEqual(args.at(-1),['vk-clips',{entry:'https://vk.ru/clips/synklab_ru',handle:'synklab_ru',limit:0,days:0,communityId:'243082040'}]);
  assert.equal(await postLifetime(nbCtx(),helpers,on),'limited');
  assert.equal(saved.name,'naver-blog-list-posts');assert.equal(saved.envelope.sourceType,'creator-screen');
  assert.deepEqual(stages,['public-page','public-page','creator-screen']);
  saved=null;
  assert.equal(await postLifetime(vkCtx({browser:'ego',profileId:'Profile 5'}),helpers,on),'need_owner');
  assert.equal(await postLifetime(vkCtx(undefined,'https://vk.ru/other'),helpers,on),'need_owner');
  assert.equal(await postLifetime(vkCtx({browser:'aside',account:'u0',communityId:'243082040'}),helpers,on),null);
  assert.equal(await postLifetime(nbCtx({browser:'ego',profileId:'Profile 5'}),helpers,on),null);
  assert.equal(await postLifetime(nbCtx({browser:'aside'}),helpers,on),null);
  assert.equal(saved,null);
});

test('판정 도구가 VK 클립 · 벽 글과 네이버 블로그 글 주소를 서버 postRoute와 같은 번호로 읽는다',()=>{
  assert.deepEqual(판정.postIdOf('https://vk.ru/clip-243082040_456239018'),{platform:'vk',externalId:'clip-243082040_456239018',key:'vk:clip-243082040_456239018'});
  assert.equal(판정.postIdOf('https://vk.com/CLIP-243082040_456239018').key,'vk:clip-243082040_456239018');
  assert.equal(판정.postIdOf('https://vk.ru/wall-243082040_456239018').key,'vk:wall-243082040_456239018');
  for(const url of ['https://vk.ru/clips/synklab_ru','https://vk.ru/synklab_ru','https://blog.naver.com/synkshift','https://blog.naver.com/PostList.naver'])assert.equal(판정.postIdOf(url),null,url);
  assert.deepEqual(판정.postIdOf('https://blog.naver.com/synkshift/224478068429'),{platform:'naver-blog',externalId:'224478068429',key:'naver-blog:synkshift/224478068429'});
  assert.equal(판정.postIdOf('https://m.blog.naver.com/SynkShift/224478068429').key,'naver-blog:synkshift/224478068429');
  assert.equal(판정.formatOf({platform:'vk',url:'https://vk.ru/clip-243082040_456239018'}),'vk-clip');
  assert.equal(판정.formatOf({platform:'vk',url:'https://vk.ru/wall-243082040_1'}),'vk-post');
  assert.equal(판정.formatOf({platform:'naver-blog',url:'https://blog.naver.com/synkshift/224478068429'}),'naver-blog-post');
  assert.deepEqual([판정.PLATFORM_LABEL.vk,판정.PLATFORM_LABEL['naver-blog']],['VK','네이버 블로그']);
  const {PLATFORMS}=require('../tools/lib/게시성과읽기.cjs');
  assert.deepEqual(['vk','naver-blog'].map(p=>PLATFORMS.includes(p)),[true,true]);
});
