// 링크드인 개인 프로필 게시물 분석 화면의 게시물 누적값(post-lifetime) 기록 시험(2026-11-26). 합성 저장소와 서버만 쓴다. 운영 데이터와 외부 주소는 열지 않는다.
// 분석 화면 주소(/analytics/post-summary/urn:li:activity:<번호>/) 하나가 게시물 하나다. 관측은 그 게시물의 누적값이어야 하고, 조회 칸에는 「동영상 조회」만 받는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {accountCatalog} from './account-catalog.mjs';
import {planCatalogRegistration} from './catalog-registration.mjs';

const DAY_MS=86400000;
const sha=text=>createHash('sha256').update(text).digest('hex');
const ACT='urn:li:activity:7396015580145528832',SCREEN=`https://www.linkedin.com/analytics/post-summary/${ACT}/`,FEED=`https://www.linkedin.com/feed/update/${ACT}/`;
const LABELS={views:'동영상 조회',reach:'회원 도달',likes:'반응',comments:'댓글',saves:'저장수',shares:'LinkedIn에서 보내기'};

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-external-linkedin-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Synthetic admin',email:'admin@example.test',role:'admin',teamId:null});
  const cookie=`synk_company_session=${app.store.mint('session',admin.id,{csrfToken:'fixture'},30)}`;
  const request=async(path,body)=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'fixture'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json()};
  };
  const result=await request('/api/channels/from-catalog',{accountIds:['yuhobuilds-linkedin']});
  assert.equal(result.status,201,JSON.stringify(result.body));
  const li=result.body.added[0].channel.id;
  // 게시 시각은 한 번만 정한다. 보낼 때마다 다시 재면 한국 자정을 걸칠 때 같은 게시물의 게시일이 바뀌어 409가 난다(GPT GA6). 수집기도 활동 번호에서 고정 시각을 꺼낸다.
  const publishedAt=new Date(Date.now()-2*DAY_MS).toISOString();
  // 관측 시각은 어제 한국 정오부터 1초씩 늘린다. 모든 요청이 같은 한국 날짜에 들고, 뒤 요청이 늘 더 늦은 관측이다(GPT 3차 GA2 — 지금 시각에서 빼면 자정을 걸칠 수 있다).
  const KST=9*3600000,noon=Math.floor((Date.now()+KST)/DAY_MS)*DAY_MS-KST-DAY_MS+12*3600000;
  let count=0;
  // 수집기(tools/lib/외부통계파싱.cjs parseLinkedInPosts)가 보내는 봉투와 같은 꼴이다.
  const send=({sourceUrl=SCREEN,sourceType='creator-screen',externalId=ACT,url=FEED,metrics={views:12,reach:30,likes:2,comments:1,saves:0,shares:0},metricLabels=LABELS,handle='yuhobuilds',rows}={})=>
    request(`/api/channels/${li}/external-observations`,{sourceType,sourceUrl,observedAt:new Date(noon+count*1000).toISOString(),evidenceSha256:sha('linkedin post summary '+(count++)),
      identity:{accountId:'yuhobuilds-linkedin',handle},labels:{screenTitle:'LinkedIn 게시물 분석'},
      observations:rows||[{kind:'post-lifetime',post:{externalId,url,publishedAt},metrics,labels:{metricLabels:Object.fromEntries(Object.entries(metricLabels).filter(([key])=>key in metrics))}}]});
  return {app,request,li,send,result,publishedAt};
}

test('the yuhobuilds LinkedIn profile is registered from the ledger only while the ledger operates it',async t=>{
  const f=await fixture(t);
  // 원장이 운영(operating)이라 /in/yuhobuilds 채널이 생긴다. 주소를 지어내지 않고 원장 주소 그대로 둔다.
  assert.equal(f.result.body.added[0].accountId,'yuhobuilds-linkedin');
  const channel=f.app.store.get('channels',f.li);
  assert.equal(channel.catalogAccountId,'yuhobuilds-linkedin');assert.equal(channel.publicUrl,'https://www.linkedin.com/in/yuhobuilds/');assert.equal(channel.handle,'yuhobuilds');assert.equal(channel.status,'not-connected');
  const again=await f.request('/api/channels/from-catalog',{accountIds:['yuhobuilds-linkedin']});
  assert.deepEqual(again.body.summary,{requested:1,added:0,existing:1});
  // 원장이 운영 제외(excluded-existing)로 되돌아가면 등록하지 않는다(GPT 지적 — 원장이 운영이어야 채널이 생긴다).
  const excluded={...accountCatalog,accounts:accountCatalog.accounts.map(row=>row.id==='yuhobuilds-linkedin'?{...row,accountStatus:'excluded-existing'}:row)};
  assert.throws(()=>planCatalogRegistration({accountIds:['yuhobuilds-linkedin'],channels:[],catalog:excluded}),error=>error.code==='SYNK_CATALOG_NOT_MANAGED');
});

test('a LinkedIn post analytics screen is a creator screen for exactly the one activity in its address',async t=>{
  const f=await fixture(t);
  for(const source of ['https://www.linkedin.com/analytics/post-summary/','https://www.linkedin.com/analytics/post-summary/urn:li:activity:123/','https://www.linkedin.com/analytics/post-summary/urn:li:share:7396015580145528832/',SCREEN+'extra/','https://www.linkedin.com/analytics/post-summary/URN:LI:ACTIVITY:7396015580145528832/'])
    assert.equal((await f.send({sourceUrl:source})).body.code,'SYNK_EXTERNAL_SOURCE',source);
  // 로그인한 주인 화면이라 공개 화면이나 내보내기 파일로 적지 못한다.
  assert.equal((await f.send({sourceType:'official-export'})).body.code,'SYNK_EXTERNAL_SOURCE');
  assert.equal((await f.send({sourceType:'public-page'})).body.code,'SYNK_EXTERNAL_SOURCE');
  // 다른 게시물의 분석 화면 주소로 이 게시물 값을 적지 못한다(관측 게시물 번호 = 출처 주소의 urn).
  const other='urn:li:activity:7396015580145528833';
  assert.equal((await f.send({externalId:other,url:`https://www.linkedin.com/feed/update/${other}/`})).body.code,'SYNK_EXTERNAL_POST');
  // 게시물 하나의 화면이라 계정 합계로 적지 못한다.
  assert.equal((await f.send({rows:[{kind:'account-lifetime',metrics:{followers:1}}]})).body.code,'SYNK_EXTERNAL_METRIC_GRAIN');
  assert.equal((await f.send({rows:[{kind:'account-period',period:{start:'2026-11-01',end:'2026-11-02'},metrics:{impressions:9}}]})).body.code,'SYNK_EXTERNAL_METRIC_GRAIN');
  // 화면 속 프로필 이름이 이 채널과 다르면 받지 않는다.
  assert.equal((await f.send({handle:'someone-else'})).body.code,'SYNK_EXTERNAL_IDENTITY');
  const saved=await f.send({sourceUrl:SCREEN+'?trk=analytics'});
  assert.equal(saved.status,201,JSON.stringify(saved.body));
  assert.equal(saved.body.records[0].sourceUrl,SCREEN);
  assert.equal(saved.body.records[0].projection.state,'projected');
  const post=f.app.store.get('posts',`${f.li}:${ACT}`);
  assert.equal(post.externalId,ACT);assert.equal(post.url,FEED);
  const snapshot=f.app.store.all('snapshots').find(row=>row.postId===`${f.li}:${ACT}`);
  assert.equal(snapshot.views,12);assert.equal(snapshot.reach,30);assert.equal(snapshot.likes,2);
});

test('the analytics screen views column takes video views only, never impressions',async t=>{
  const f=await fixture(t);
  // 노출수를 조회로 적거나, 무엇을 조회로 적었는지 이름표가 없으면 받지 않는다(GPT 지적 — 노출수가 게시물 조회수로 집계되던 문제).
  for(const views of ['노출수','Impressions',undefined])
    assert.equal((await f.send({metricLabels:{...LABELS,views}})).body.code,'SYNK_EXTERNAL_METRIC_GRAIN',String(views));
  assert.equal((await f.send({metricLabels:{likes:'반응'}})).body.code,'SYNK_EXTERNAL_METRIC_GRAIN');
  assert.equal(f.app.store.all('snapshots').length,0);
  // 동영상이 아닌 글은 화면에 동영상 조회가 없다. 그때는 조회 칸을 비우고 나머지를 받는다.
  const textPost=await f.send({metrics:{likes:3,comments:0,saves:0,shares:1}});
  assert.equal(textPost.status,201,JSON.stringify(textPost.body));
  assert.equal(f.app.store.all('snapshots')[0].views,null);
  const video=await f.send({metricLabels:{...LABELS,views:'Video views'}});
  assert.equal(video.status,201);
  // 같은 날 더 늦은 관측에 조회가 없거나 null이면 받기는 받되 그날 스냅숏은 앞 관측 그대로다. 값 · 시각 · 근거가 한 관측에서 온다(GPT 2~4차).
  const kept=f.app.store.all('snapshots')[0];
  for(const metrics of [{likes:4,comments:0,saves:0,shares:1},{views:null,likes:5,comments:0,saves:0,shares:1},{views:13,likes:5,comments:0,saves:0,shares:1}]){
    const later=await f.send({metrics});
    assert.equal(later.status,201,JSON.stringify(later.body));
    assert.equal(later.body.records[0].projection.state,'not-projected');assert.equal(later.body.records[0].projection.reason,'missing-metric-same-day');
    assert.deepEqual(f.app.store.all('snapshots'),[kept]);
  }
  assert.equal(kept.views,12);assert.equal(kept.reach,30);assert.equal(kept.externalObservationId,video.body.records[0].id);
  // 앞 관측의 수치를 모두 가진 늦은 관측은 그날 스냅숏을 새 값으로 바꾼다.
  const full=await f.send({metrics:{views:14,reach:31,likes:6,comments:0,saves:0,shares:1}});
  assert.equal(full.body.records[0].projection.state,'projected');
  assert.equal(f.app.store.all('snapshots')[0].views,14);assert.equal(f.app.store.all('snapshots')[0].externalObservationId,full.body.records[0].id);
  // ugcPost 공유 주소처럼 활동 번호가 없는 주소는 분석 화면의 게시물과 같음을 보일 수 없어 받지 않는다(GPT 2차 GA5).
  const ugc='yuhobuilds_ai-company-notes-ugcPost-7396015580145528832-Ab_9';
  for(const externalId of [ugc,ACT])assert.equal((await f.send({externalId,url:`https://www.linkedin.com/posts/${ugc}`})).body.code,'SYNK_EXTERNAL_POST',externalId);
});

test('a LinkedIn share address with an activity number is the same post as the analytics screen and the feed address',async t=>{
  const f=await fixture(t);
  const slug='yuhobuilds_ai-company-notes-activity-7396015580145528832-Ab_9',share=`https://www.linkedin.com/posts/${slug}`;
  // 공유 주소의 옛 표기(주소 칸 전체)와 활동 번호 표기 모두 같은 게시물(urn:li:activity:<번호>)로 저장된다.
  const bySlug=await f.send({externalId:slug,url:share});
  assert.equal(bySlug.status,201,JSON.stringify(bySlug.body));
  assert.equal(bySlug.body.records[0].post.externalId,ACT);
  assert.equal((await f.send({externalId:ACT,url:share})).status,201);
  assert.equal((await f.send()).status,201);
  assert.deepEqual(f.app.store.all('posts').map(row=>row.id),[`${f.li}:${ACT}`]);
  // 활동 번호가 다른 공유 주소는 이 분석 화면의 게시물이 아니다.
  const otherSlug='yuhobuilds_ai-company-notes-activity-7396015580145528833-Ab_9';
  assert.equal((await f.send({externalId:otherSlug,url:`https://www.linkedin.com/posts/${otherSlug}`})).body.code,'SYNK_EXTERNAL_POST');
  // 활동 번호가 같아도 공유 주소의 작성자 칸이 다른 프로필이면 이 채널의 게시물이 아니다(GPT GA2).
  for(const author of ['someone-else','yuhobuilds2','synk-im'])
    assert.equal((await f.send({externalId:ACT,url:`https://www.linkedin.com/posts/${author}_ai-company-notes-activity-7396015580145528832-Ab_9`})).body.code,'SYNK_EXTERNAL_POST',author);
  assert.equal((await f.send({externalId:ACT,url:'https://www.linkedin.com/posts/YuhoBuilds_ai-company-notes-activity-7396015580145528832-Ab_9'})).status,201);
});

test('LinkedIn post values come only from the post analytics screen, so a later public read cannot blank the video views',async t=>{
  const f=await fixture(t);
  assert.equal((await f.send()).status,201);
  const row={kind:'post-lifetime',post:{externalId:ACT,url:FEED,publishedAt:f.publishedAt},metrics:{likes:3,comments:1}};
  // 같은 날 공개 프로필이나 다른 통계 화면에서 반응만 적은 게시물 값은 받지 않는다(GPT GA3).
  for(const [sourceType,sourceUrl] of [['public-page','https://www.linkedin.com/in/yuhobuilds/'],['creator-screen','https://www.linkedin.com/analytics/creator/content/']])
    assert.equal((await f.send({sourceType,sourceUrl,rows:[row]})).body.code,'SYNK_EXTERNAL_SOURCE',sourceUrl);
  const snapshots=f.app.store.all('snapshots');
  assert.equal(snapshots.length,1);assert.equal(snapshots[0].views,12);
  // 공개 프로필의 계정 값은 그대로 받는다.
  assert.equal((await f.send({sourceType:'public-page',sourceUrl:'https://www.linkedin.com/in/yuhobuilds/',rows:[{kind:'account-lifetime',metrics:{followers:40}}]})).status,201);
});
