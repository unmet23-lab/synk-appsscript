import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {buildSocialSimple,validateDigest,postKey,DIGEST_KIND} from './social-simple.mjs';
import {socialChangeNotifies} from './social-routes.mjs';
import {createCompanyApp} from './server.mjs';

const NOW='2026-10-24T08:16:00.000Z'; // 한국 시각 10-24 17:16
const channels=[
  {id:'c-ig',platform:'instagram',handle:'yuhobuilds',displayName:'유호 · AI와 회사 만들기',status:'success'},
  {id:'c-yt',platform:'youtube',handle:'synkkorean',displayName:'SYNK LAB | Learn Korean',status:'success'},
  {id:'c-fb',platform:'facebook',handle:'synkworld',displayName:'SYNK',status:'success'},
  {id:'c-tt',platform:'tiktok',handle:'synklab.mm',displayName:'유호',status:'success'},
];
const accounts=[
  {key:'yuhobuilds-instagram',platform:'instagram',handle:'@yuhobuilds',brand:'유호',country:false},
  {key:'lab-youtube',platform:'youtube',handle:'@synkkorean',brand:'LAB',country:false},
  {key:'lab-facebook',platform:'facebook',handle:'synkworld',brand:'LAB',country:false},
  {key:'lab-mm-tiktok',platform:'tiktok',handle:'@synklab.mm',brand:'LAB',country:false},
];
const plate=(account,at,state,method,extra={})=>{const a=accounts.find(x=>x.key===account);return {account,platform:a.platform,handle:a.handle,at,state,method,url:null,jobId:null,postId:null,...extra};};
const YT='https://www.youtube.com/shorts/AAAA1111',FB='https://www.facebook.com/reel/999/';
function digest(extra={}){
  return {v:1,generatedAt:'2026-10-24T08:00:00.000Z',today:'2026-10-24',source:{tool:'편요약',commit:'abc1234',commitAt:'2026-10-24T07:50:00.000Z'},accounts,
    episodes:[
      {key:'LAB_처음쓰는ㄹ_20261024',title:'처음 쓰는 ㄹ',titleFrom:'prep',brand:'LAB',slot:'2026-10-26',prepState:'올릴 준비',planned:[],plates:[plate('lab-youtube','2026-10-26T12:00:00.000Z','승인 대기','작업실',{jobId:'j1',postId:'p1'})]},
      {key:'LAB_반소식_20261023',title:'반 소식',titleFrom:'prep',brand:'LAB',slot:'2026-10-24',prepState:'예약됨',planned:[],plates:[plate('lab-facebook','2026-10-24T12:00:00.000Z','예약됨','Meta 예약')]},
      {key:'LAB_관용구5_20261021',title:'관용구 퀴즈 #5',titleFrom:'readme',brand:'LAB',slot:'2026-10-23',prepState:'올릴 준비',planned:[],plates:[plate('lab-youtube','2026-10-23T12:00:00.000Z','예약됨','작업실',{jobId:'j4',postId:'p4'}),plate('lab-facebook','2026-10-23T12:00:00.000Z','예약됨','Meta 예약')]},
      {key:'yuhobuilds_멈춘시간_20261021',title:'멈춘 시간',titleFrom:'prep',brand:'유호',slot:'2026-10-24',prepState:'올릴 준비',planned:[],plates:[plate('yuhobuilds-instagram','2026-10-24T12:00:00.000Z','보류',null)]},
      {key:'LAB_빈칸_20261023',title:'빈칸 규칙',titleFrom:'prep',brand:'LAB',slot:'2026-10-27',prepState:'올릴 준비',planned:[{account:'lab-facebook',platform:'facebook',handle:'synkworld'}],plates:[]},
      {key:'LAB_저녁_20261023',title:'저녁 편',titleFrom:'prep',brand:'LAB',slot:'2026-10-23',prepState:'예약됨',planned:[],plates:[plate('lab-facebook','2026-10-23T09:00:00.000Z','예약됨','Meta 예약')]},
    ],
    judgments:[{url:YT,point:'24h',platform:'youtube',account:'lab-youtube',publishedAt:'2026-10-23T12:00:05.000Z',multiple:{value:2.5,median:240,n:5},verdict:'자료 부족',observedAt:'2026-10-24T12:00:00.000Z'},
      {url:YT,point:'72h',platform:'youtube',account:'lab-youtube',publishedAt:'2026-10-23T12:00:05.000Z',multiple:{value:3.1,median:240,n:3},verdict:null,observedAt:null}],
    excluded:{운영시험:6,작품:3},dropped:0,...extra};
}
const jobs=[
  {id:'j1',postId:'p1',channelId:'c-yt',status:'scheduled',reviewWaiting:1,scheduledAt:'2026-10-26T12:00:00.000Z'},
  {id:'j2',postId:'p2',channelId:'c-ig',status:'scheduled',reviewWaiting:1,scheduledAt:'2026-10-26T12:00:00.000Z'},
  {id:'j3',postId:'p3',channelId:'c-ig',status:'manual',scheduledAt:'2026-10-23T13:30:00.000Z',message:'앱에서 마무리해 주세요'},
  {id:'j4',postId:'p4',channelId:'c-yt',status:'published',scheduledAt:'2026-10-23T12:00:00.000Z',publishedAt:'2026-10-23T12:00:05.000Z',publicationUrl:YT},
  {id:'j5',postId:'p5',channelId:'c-ig',status:'expired',scheduledAt:'2026-10-20T12:00:00.000Z'},
  // 날짜를 다시 잡은 작업실 판 — 작업 ID로 짝을 맞추므로 두 줄이 되지 않는다
  {id:'j6',postId:'p6',channelId:'c-yt',status:'scheduled',reviewWaiting:0,scheduledAt:'2026-10-25T13:00:00.000Z'},
];
const recent=[
  {id:'r1',channelId:'c-yt',url:YT,title:'관용구 퀴즈 #5 「동물」 #shorts',publishedAt:'2026-10-23T12:00:05.000Z',thumbnailUrl:'https://i.ytimg.com/vi/AAAA1111/hq.jpg',lastSeenAt:'2026-10-24T08:15:00.000Z',views:1214},
  {id:'r2',channelId:'c-fb',url:FB,title:'관용구 퀴즈 #5',publishedAt:'2026-10-23T12:02:00.000Z',thumbnailUrl:null,lastSeenAt:'2026-10-24T08:00:00.000Z',views:253},
  {id:'r3',channelId:'c-ig',url:'https://www.instagram.com/reel/OLD1/',title:'옛 편',publishedAt:'2026-10-01T12:00:00.000Z',thumbnailUrl:null,lastSeenAt:'2026-10-24T08:00:00.000Z',views:40},
];
const performance=[{channelId:'c-yt',platform:'youtube',url:YT,publishedAt:'2026-10-23T12:00:05.000Z',checkpoints:[{hours:24,status:'recorded',dueAt:'2026-10-24T12:00:05.000Z',metrics:{views:600,likes:30,earlyRetention3sPct:20.5,averageWatchSeconds:3.3}},{hours:72,status:'pending',dueAt:'2026-10-26T12:00:05.000Z',metrics:{}}]},
  {channelId:'c-fb',platform:'facebook',url:FB,publishedAt:'2026-10-23T12:02:00.000Z',checkpoints:[{hours:24,status:'retry',dueAt:'2026-10-24T12:02:00.000Z',metrics:{}}]}];
const base=(extra={})=>buildSocialSimple({now:NOW,isAdmin:true,channels,collection:{total:4,successToday:4,failed:0,needsReconnect:0,overdue:0,lastSuccessAt:'2026-10-24T00:00:52.000Z',items:channels.map(c=>({channelId:c.id,status:'success',action:'none'}))},
  jobs,postTitles:{p1:'원고 1',p2:'AI한테 보고서',p3:'틱톡 마무리',p4:'원고 4',p6:'원고 6'},thumbs:{},recent,performance,inbox:[],commentPosts:{},
  providerRows:[{channelId:'c-yt',supported:true,enabled:true,connected:true,connectUrl:'/api/oauth/youtube/start?channelId=c-yt&publishing=1'}],healthRows:[{channelId:'c-yt',state:'connected'},{channelId:'c-tt',state:'unsupported'}],digest:digest(),...extra});

test('post keys meet across repo records, collected posts and performance entries',()=>{
  assert.equal(postKey('youtube','https://www.youtube.com/watch?v=AAAA1111'),postKey('youtube',YT));
  assert.equal(postKey('instagram','https://www.instagram.com/reel/Det19VyHDxo/'),'instagram:Det19VyHDxo');
  assert.equal(postKey('facebook',FB),'facebook:999');
  assert.equal(postKey('youtube','not a url'),null);
});

test('today counts review-link waiting jobs, needs-hand jobs without expired, and keeps one row per job id',()=>{
  const D=base();
  assert.equal(D.today,'2026-10-24');
  assert.deepEqual(D.review.map(r=>[r.title,r.at,r.plates.length]),[['처음 쓰는 ㄹ','2026-10-26 21:00',1],['AI한테 보고서','2026-10-26 21:00',1]]);
  assert.deepEqual(D.review.map(r=>r.plates.map(p=>p.at)),[['2026-10-26 21:00'],['2026-10-26 21:00']],'판마다 시각을 싣는다(화면이 판 단위로 지남을 가름)');
  assert.deepEqual(D.problems.map(p=>[p.id,p.state]),[['j3','앱에서 마무리']]);
  const upcoming=D.upcoming.map(g=>[g.date,g.title,g.state]);
  assert.deepEqual(upcoming,[['2026-10-25','원고 6','예약됨'],['2026-10-26','처음 쓰는 ㄹ','검토 대기'],['2026-10-26','AI한테 보고서','검토 대기'],['2026-10-27','빈칸 규칙','예약 전']]);
  assert.equal(D.upcoming.filter(g=>g.plates.some(p=>p.platform==='youtube')).length,2,'j1은 편 요약 판과 한 줄');
  assert.deepEqual(D.tonight.map(g=>[g.title,g.time,g.method,g.state]),[['반 소식','21:00','Meta 예약','예약됨']]);
  assert.deepEqual(D.held.map(g=>g.title),['멈춘 시간']);
});

test('Meta plates without an address pair with a collected post within 60 minutes, otherwise ask to confirm after two hours',()=>{
  const D=base(),y=Object.fromEntries(D.yesterday.map(g=>[g.title,g]));
  assert.deepEqual(y['관용구 퀴즈 #5'].plates.map(p=>[p.platform,p.state,p.views]),[['youtube','게시됨',1214],['facebook','게시됨',253]]);
  assert.equal(y['관용구 퀴즈 #5'].plates.find(p=>p.platform==='facebook').url,FB);
  assert.equal(y['저녁 편'].state,'확인 필요');
  assert.equal(y['관용구 퀴즈 #5'].plates[0].due24,null,'24시간 숫자를 이미 받은 판');
  assert.equal(y['관용구 퀴즈 #5'].plates[1].due24,'2026-10-24 21:02');
});

test('results show ledger multiples only from four comparable posts and keep pending checkpoints',()=>{
  const D=base(),g=D.results.list.find(x=>x.key==='LAB_관용구5_20261021'),yt=g.plates.find(p=>p.platform==='youtube');
  assert.equal(D.results.since,'2026-10-17');
  assert.equal(g.title,'관용구 퀴즈 #5 「동물」','README 제목은 유튜브 게시 제목으로(해시태그 뺌)');
  assert.deepEqual(yt.points['24h'].multiple,{value:2.5,median:240,n:5});
  assert.equal(yt.points['24h'].views,600);assert.equal(yt.points['24h'].retention3s,20.5);
  assert.equal(yt.points['72h'],undefined,'72시간 숫자가 아직 없으면 점을 만들지 않는다(장부 줄만 있어도)');
  assert.deepEqual(yt.pending,[{hours:72,dueAt:'2026-10-26 21:00'}]);
  assert.equal(g.thumb.src,'https://i.ytimg.com/vi/AAAA1111/hq.jpg');
  assert.deepEqual(D.results.excluded,{운영시험:6,작품:3});
});

test('accounts read brand and country from the digest and blank a channel name that belongs to another brand',()=>{
  const D=base(),tt=D.accounts.find(a=>a.channelId==='c-tt'),yt=D.accounts.find(a=>a.channelId==='c-yt'),ig=D.accounts.find(a=>a.channelId==='c-ig');
  assert.deepEqual([tt.brand,tt.country,tt.name,tt.publish],['LAB',false,'','앱에서 직접'],'이름이 「유호」인 미얀마 틱톡은 나라별 아님(시안 규칙) · 이름은 비움');
  const mx=buildSocialSimple({now:NOW,channels:[{id:'mx',platform:'youtube',handle:'synklabmexico',displayName:'SYNK LAB México | Coreano divertido',status:'success'},{id:'mn',platform:'youtube',handle:'synkkorean',displayName:'SYNK LAB | Learn Korean',status:'success'}]}).accounts;
  assert.deepEqual(mx.map(a=>a.country),[true,false]);
  assert.deepEqual([yt.publish,yt.posts30,yt.views30,yt.lastPost],['자동 게시',1,1214,'2026-10-23']);
  assert.deepEqual([ig.brand,ig.posts30,ig.views30],['유호',1,40]);
});

test('after midnight the daily collection is waiting, not stopped; only failures, reconnects and stale successes stop (10-26 ops)',()=>{
  // 10-26 01:50 KST — 하루 수집은 09:00이라 계정마다 「수집 시각 전」(scheduled)이고 오늘 성공은 0이다.
  const at='2026-10-25T16:50:00.000Z',yesterday='2026-10-25T00:01:00.000Z',old='2026-10-22T00:01:00.000Z';
  const items=[{channelId:'c-ig',status:'scheduled',lastCollectedAt:yesterday},{channelId:'c-yt',status:'overdue',lastCollectedAt:yesterday},{channelId:'c-fb',status:'scheduled',lastCollectedAt:old},{channelId:'c-tt',status:'failed',lastCollectedAt:yesterday}];
  const D=buildSocialSimple({now:at,channels,collection:{total:4,successToday:0,failed:1,needsReconnect:0,overdue:1,lastSuccessAt:yesterday,items},collectHourKst:9});
  assert.deepEqual(D.accounts.map(a=>[a.channelId,a.collect]),[['c-ig','수집 중'],['c-yt','수집 중'],['c-fb','수집 멈춤'],['c-tt','수집 멈춤']]);
  assert.equal(D.health.collectedAt,'2026-10-25 09:01');assert.equal(D.health.nextAt,'2026-10-26 09:00');
  assert.equal(buildSocialSimple({now:'2026-10-26T01:30:00.000Z',channels,collection:{items},collectHourKst:9}).health.nextAt,'2026-10-27 09:00','오늘 시각이 지났으면 내일');
  assert.equal(buildSocialSimple({now:at,channels,collection:{items}}).health.nextAt,null,'자동 수집이 꺼졌거나 시각을 모르면 비움');
});

test('empty and partial data never throw: no digest, no comparable posts, comments without a known post',()=>{
  const D=buildSocialSimple({now:NOW,channels,jobs:[],digest:null,inbox:[{channelId:'c-ig',open:true,remoteCreatedAt:'2026-10-24T00:00:00.000Z',collectorPostId:'missing'}]});
  assert.equal(D.digest,null);assert.equal(D.comments.total,1);assert.equal(D.comments.top,null);assert.equal(D.results.list.length,0);assert.equal(D.tonight.length,0);
  assert.deepEqual(D.health.offPlatforms,[]);
});

test('plates of accounts without a server channel are shown to admins only',()=>{
  const extra=digest();extra.accounts=[...accounts,{key:'lab-mx-youtube',platform:'youtube',handle:'@synklabmexico',brand:'LAB',country:true}];
  extra.episodes=[{key:'LAB_멕시코_20261024',title:'멕시코',titleFrom:'prep',brand:'LAB',slot:'2026-10-24',prepState:'예약됨',planned:[],plates:[{account:'lab-mx-youtube',platform:'youtube',handle:'@synklabmexico',at:'2026-10-24T12:00:00.000Z',state:'예약됨',method:'API 예약',url:null,jobId:null,postId:null}]}];
  assert.equal(base({digest:extra}).tonight.length,1);
  assert.equal(base({digest:extra,isAdmin:false}).tonight.length,0);
});

test('results keep repo episodes only, drop test posts and merge a plate seen twice; a scheduled plate with a collected address counts as published',()=>{
  const extra=digest({excluded:{운영시험:1,작품:0,urls:['https://www.youtube.com/shorts/TEST0001']}});
  extra.episodes.push({key:'yuhobuilds_트렌디_20261021',title:'트렌디',titleFrom:'prep',brand:'유호',slot:'2026-10-22',prepState:'올릴 준비',planned:[],plates:[
    {account:'yuhobuilds-instagram',platform:'instagram',handle:'@yuhobuilds',at:'2026-10-22T12:00:00.000Z',state:'예약됨',method:'직접 예약',url:'https://www.instagram.com/p/TREND1/',jobId:null,postId:null}]});
  const moreJobs=[...jobs,{id:'jt',postId:'pt',channelId:'c-yt',status:'published',scheduledAt:'2026-10-22T06:00:00.000Z',publishedAt:'2026-10-22T06:00:00.000Z',publicationUrl:'https://www.youtube.com/shorts/TEST0001'},
    {id:'jx',postId:'px',channelId:'c-ig',status:'published',scheduledAt:'2026-10-23T03:00:00.000Z',publishedAt:'2026-10-23T03:00:00.000Z',publicationUrl:'https://www.instagram.com/reel/OUTSIDE1/'}];
  const moreRecent=[...recent,{id:'r4',channelId:'c-ig',url:'https://www.instagram.com/p/TREND1/',title:'트렌디',publishedAt:'2026-10-22T12:00:30.000Z',thumbnailUrl:null,lastSeenAt:NOW,views:161},
    {id:'r5',channelId:'c-fb',url:'https://www.facebook.com/reel/999/',title:'dup',publishedAt:'2026-10-23T12:02:00.000Z',thumbnailUrl:null,lastSeenAt:NOW,views:253}];
  const D=base({digest:extra,jobs:moreJobs,recent:moreRecent,postTitles:{p1:'원고 1',p2:'AI한테 보고서',pt:'[장기 예약 시험] 7일',px:'편 밖 원고'}});
  assert.ok(!D.results.list.some(g=>/시험|편 밖/.test(g.title)),'편 기록에 없는 서버 예약은 성과에 넣지 않는다');
  assert.ok(!D.yesterday.some(g=>/시험/.test(g.title)),'시험으로 가른 주소는 어제 목록에서도 뺀다');
  assert.ok(D.yesterday.some(g=>g.title==='편 밖 원고'),'편 밖 서버 예약은 어제 목록에는 보인다');
  const trend=D.results.list.find(g=>g.key==='yuhobuilds_트렌디_20261021');assert.equal(trend.plates[0].now.views,161);
  const quiz=D.results.list.find(g=>g.key==='LAB_관용구5_20261021');assert.equal(quiz.plates.filter(p=>p.platform==='facebook').length,1);
  assert.deepEqual(Object.keys(D.results.excluded).sort(),['운영시험','작품'],'뺀 주소 목록은 화면에 보내지 않는다');
});

test('GPT 10-24: server jobs are never guessed, a paired post is not reused, today\'s not-yet-scheduled episode shows, planned plates filter one by one, query post ids stay distinct',()=>{
  // GA1 — 시각이 지난 서버 예약 작업(주소 없음)은 수집 게시물과 짝 짓지도 「확인 필요」로 바꾸지도 않는다
  const late=[{id:'jl',postId:'pl',channelId:'c-yt',status:'scheduled',reviewWaiting:0,scheduledAt:'2026-10-23T12:00:00.000Z'}];
  const D1=buildSocialSimple({now:NOW,isAdmin:true,channels,jobs:late,recent,digest:digest({episodes:[]})});
  const row=D1.yesterday.find(g=>g.title.includes('pl')||g.key==='post:pl');assert.equal(row,undefined,'예약됨 서버 작업은 어제 「게시됨·확인 필요」 목록에 들지 않는다');
  // GA2 — A편이 주소로 가진 게시물을 30분 뒤 B편의 주소 없는 판이 빌리지 못한다
  const two=digest({episodes:[
    {key:'A',title:'A',titleFrom:'prep',brand:'LAB',slot:null,prepState:null,planned:[],plates:[plate('lab-facebook','2026-10-23T12:00:00.000Z','게시됨','Meta 예약',{url:FB})]},
    {key:'B',title:'B',titleFrom:'prep',brand:'LAB',slot:null,prepState:null,planned:[],plates:[plate('lab-facebook','2026-10-23T12:30:00.000Z','예약됨','Meta 예약')]}]});
  const D2=buildSocialSimple({now:NOW,isAdmin:true,channels,recent,digest:two});
  assert.equal(D2.yesterday.find(g=>g.key==='B').state,'확인 필요');assert.equal(D2.results.list.filter(g=>g.plates.some(p=>p.url===FB)).length,1);
  // GA5·GA6 — 슬롯이 오늘인 예약 전 편은 오늘 목록에, 서버 채널이 없는 계획 판만 뺀다
  const ready=digest({accounts:[...accounts,{key:'lab-mx-youtube',platform:'youtube',handle:'@synklabmexico',brand:'LAB',country:false}],episodes:[{key:'오늘편',title:'오늘편',titleFrom:'prep',brand:'LAB',slot:'2026-10-24',prepState:'올릴 준비',planned:[{account:'lab-facebook',platform:'facebook',handle:'synkworld'},{account:'lab-mx-youtube',platform:'youtube',handle:'@synklabmexico'}],plates:[]}]});
  const D3=buildSocialSimple({now:NOW,isAdmin:false,channels,digest:ready});
  const t=D3.tonight.find(g=>g.key==='오늘편');assert.equal(t.state,'예약 전');assert.deepEqual(t.plates.map(p=>p.platform),['facebook']);
  // GA7 — 페이스북 permalink 주소는 story_fbid가 열쇠다
  assert.notEqual(postKey('facebook','https://www.facebook.com/permalink.php?story_fbid=111111&id=9'),postKey('facebook','https://www.facebook.com/permalink.php?story_fbid=222222&id=9'));
  assert.equal(postKey('facebook','https://www.facebook.com/photo.php?fbid=333333'),'facebook:333333');
  assert.equal(postKey('facebook','https://www.facebook.com/permalink.php?id=9'),null,'게시물 번호가 없는 주소는 열쇠를 만들지 않는다');
  assert.equal(postKey('instagram','https://www.instagram.com/reel/'),null);
  // GA4 — 계정이 하나도 없는 요약(저장소 읽기 실패)은 받지 않는다
  assert.throws(()=>validateDigest({...digest(),accounts:[]},{now:NOW}),{status:400});
});

test('digest validation rejects other shapes, sizes and old times and drops broken rows',()=>{
  assert.throws(()=>validateDigest({v:2},{now:NOW}),{status:400});
  assert.throws(()=>validateDigest({...digest(),generatedAt:'2026-10-20T00:00:00.000Z'},{now:NOW}),{status:400});
  assert.throws(()=>validateDigest({...digest(),episodes:Array.from({length:201},(_,i)=>({key:'e'+i}))},{now:NOW}),{status:413});
  assert.throws(()=>validateDigest({...digest(),padding:'x'.repeat(270000)},{now:NOW}),{status:413});
  const d=validateDigest({...digest(),judgments:[{url:'http://insecure.example/x',point:'24h'},{url:YT,point:'7d'},...digest().judgments]},{now:NOW});
  assert.equal(d.judgments.length,2);assert.equal(d.dropped,2);assert.equal(d.episodes.length,6);
  assert.equal(validateDigest({...digest(),episodes:[{key:'../x',plates:[]}]},{now:NOW}).episodes.length,0);
});

async function serverFixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-simple-'));let at=NOW;
  const provider={settings:()=>({configured:true,integrations:[]}),capability:()=>({mode:'automatic',canPublish:true,formats:['text'],maxTextLength:5000})};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'http://127.0.0.1:4191',schedule:false,socialProvider:provider,clock:()=>at,synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'admin@simple.test',name:'합성 관리자',role:'admin'}),viewer=app.store.createUser({email:'viewer@simple.test',name:'열람',role:'viewer'});
  for(const c of channels)app.store.put('channels',c.id,{...c,ownerIds:[admin.id],active:true});
  const tokens=new Map([admin,viewer].map(u=>[u.id,app.store.mint('session',u.id,{csrfToken:'test-csrf'},60)]));await app.start();const url='http://127.0.0.1:'+app.server.address().port;
  async function api(user,path,input){const r=await fetch(url+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'test-csrf',...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:r.status,data:await r.json()};}
  return {app,admin,viewer,api,advance(ms){at=new Date(Date.parse(at)+ms).toISOString();}};
}

test('HTTP: admins store the repo digest quietly, viewers cannot, and an older digest cannot replace a newer one',async t=>{
  const f=await serverFixture(t);
  assert.equal(socialChangeNotifies('/api/social/repo-digest'),false);
  assert.equal((await f.api(f.viewer,'/api/social/repo-digest',digest())).status,403);
  let r=await f.api(f.admin,'/api/social/repo-digest',digest());assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.episodes,6);
  assert.equal(f.app.store.get(DIGEST_KIND,'current').byUserId,f.admin.id);
  r=await f.api(f.admin,'/api/social/repo-digest',{...digest(),generatedAt:'2026-10-24T07:50:00.000Z'});assert.equal(r.status,409);
  r=await f.api(f.admin,'/api/social/simple');assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data.digest.ageMinutes,16);assert.deepEqual(r.data.held.map(g=>g.title),['멈춘 시간']);
  assert.equal(r.data.accounts.length,4);
  const viewerView=await f.api(f.viewer,'/api/social/simple');assert.equal(viewerView.status,200);
});
