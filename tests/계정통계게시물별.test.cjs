'use strict';
// 게시물별 누적값 보완 수집(2026-11-19): 더우인 작품 목록 · 스레드 인사이트 목록 → 외부 관측 post-lifetime, 계정 합계 수집 뒤에 돈다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {parseDouyinWorks,parseThreadsInsights}=require('../tools/lib/외부통계파싱.cjs');
const {postLifetime,douyinWorksPage,threadsInsightsPage}=require('../tools/계정통계예약/post-lifetime.cjs');
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
    async evaluate(f,arg){return JSON.parse(JSON.stringify(await run(f,arg)));}};
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
