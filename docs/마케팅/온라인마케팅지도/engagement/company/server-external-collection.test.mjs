// 원장 계정 등록(POST /api/channels/from-catalog)과 로그인 통계 화면·공식 내보내기 관측(/api/channels/:id/external-observations) 시험.
// 합성 저장소와 서버만 쓴다. 운영 데이터·외부 주소는 열지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';

import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {accountCatalog,matchAccount,facebookLegacyPublicId,MANAGED_ACCOUNT_STATUSES} from './account-catalog.mjs';
import {EXTERNAL_OBSERVATION_KIND,EXTERNAL_LIMITS,createExternalObservations} from './external-observations.mjs';
import {planCatalogRegistration} from './catalog-registration.mjs';
import {measuredApiMetrics} from './collection-progress.mjs';

const MANAGED=accountCatalog.accounts.filter(account=>MANAGED_ACCOUNT_STATUSES.includes(account.accountStatus)).map(account=>account.id);
const DAY_MS=86400000;
const kstDay=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
const shift=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*DAY_MS).toISOString().slice(0,10);
const sha=text=>createHash('sha256').update(text).digest('hex');

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-external-collection-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,...options});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  app.store.put('teams','team-synthetic',{id:'team-synthetic',name:'Synthetic team',active:true,createdAt:new Date().toISOString()});
  const users={},cookies={};
  for(const [key,role,teamId] of [['admin','admin','team-synthetic'],['member','member',null],['other','member',null],['viewer','viewer',null]]){
    users[key]=app.store.createUser({name:'Synthetic '+key,email:key+'@example.test',role,teamId});
    cookies[key]=`synk_company_session=${app.store.mint('session',users[key].id,{csrfToken:'fixture'},30)}`;
  }
  const request=async(who,path,body,{csrf='fixture',raw}={})=>{
    const write=body!==undefined||raw!==undefined;
    const response=await fetch(base+path,{method:write?'POST':'GET',headers:{...(who?{Cookie:cookies[who]}:{}),Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf},...(write?{body:raw??JSON.stringify(body)}:{})});
    return {status:response.status,body:await response.json()};
  };
  const register=async accountIds=>{
    const result=await request('admin','/api/channels/from-catalog',{accountIds});
    assert.ok([200,201].includes(result.status),JSON.stringify(result.body));
    return Object.fromEntries([...result.body.added,...result.body.existing].map(row=>[row.accountId,row.channel.id]));
  };
  return {app,users,request,register};
}

test('one click records current API metrics, leased PC observations and the same progress after refresh',async t=>{
  let calls=0;
  const f=await fixture(t,{collector:async()=>{calls++;
    return {channel:{externalId:'synthetic-provider-canonical-id',views:0},posts:[],coverage:{status:'complete'}};}});
  const ids=await f.register(['lab-youtube','shift-tistory','yuhobuilds-telegram']);
  const connected=ids['lab-youtube'];
  f.app.store.setSecret('channel:'+connected,{apiKey:'fixture-reader'});
  const route='/api/collection-progress';
  const capability={workerId:'fixture-worker',accountIds:Object.keys(ids)};
  const start=await f.request('admin','/api/collect',{});
  assert.equal(start.status,202);
  assert.equal(start.body.progress.items.length,3);
  const again=await f.request('admin','/api/collect',{});
  assert.equal(again.status,202);assert.equal(calls,1);
  assert.equal((await f.request('member',route+'/claim',{})).status,403);
  assert.equal((await f.request('admin',route+'/claim',{})).status,400);
  assert.equal((await f.request('admin',route+'/claim',{...capability,accountIds:['shift-brunch']})).body.job,null);
  const seen=new Set();
  for(let n=0;n<2;n++){
    const claim=await f.request('admin',route+'/claim',capability);
    assert.equal(claim.status,200);const job=claim.body.job;assert.ok(job);seen.add(job.accountId);
    assert.equal((await f.request('admin',route+'/update',{...job,token:'expired',reason:'done'})).status,409);
    if(job.accountId==='shift-tistory'){
      const observedAt=new Date().toISOString(),envelope={sourceType:'creator-screen',sourceUrl:'https://yuhobuilds.tistory.com/manage/statistics',observedAt,
        evidenceSha256:sha('one click fixture'),identity:{accountId:'shift-tistory',handle:'yuhobuilds.tistory.com'},
        observations:[{kind:'account-lifetime',metrics:{views:0,visitors:0}}]};
      assert.equal((await f.request('admin',route+'/observations',{...job,envelope:{...envelope,observedAt:'2020-01-01T00:00:00Z'}})).status,400);
      for(const expected of ['created','existing']){
        const saved=await f.request('admin',route+'/observations',{...job,envelope});
        assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body[expected],1);
      }
    }else{assert.equal(job.accountId,'lab-youtube');assert.deepEqual(job.missing,['likes','shares']);}
    assert.equal((await f.request('admin',route+'/update',{...job,reason:'limited'})).body.item.status,'partial');
  }
  assert.deepEqual([...seen].sort(),['lab-youtube','shift-tistory']);
  assert.equal((await f.request('admin',route+'/claim',capability)).body.job,null);
  const read=await f.request('admin',route);
  assert.equal(read.body.worker.online,true);
  const byId=Object.fromEntries(read.body.items.map(row=>[row.accountId,row]));
  assert.equal(byId['lab-youtube'].sources.views,'api');
  assert.equal(byId['yuhobuilds-telegram'].reason,'contact');
  assert.equal(byId['shift-tistory'].otherSources.visitors,'creator-screen');
  assert.equal(byId['shift-tistory'].sources.views,'creator-screen');
  assert.equal((await f.request('admin','/api/state')).body.channels.find(c=>c.id===ids['shift-tistory']).collectionProgress.status,'partial');
  assert.equal((await f.request('member',route)).body.items.length,0);
});

test('a PC lease cannot import after ownership changes, and a new worker retries an expired lease',async t=>{
  let at=Date.now();const f=await fixture(t,{clock:()=>new Date(at).toISOString()});
  const ids=await f.register(['shift-tistory']);const base='/api/collection-progress';
  await f.request('admin','/api/collect',{});
  const claim=async()=>(await f.request('admin',base+'/claim',{workerId:'fixture-worker',accountIds:['shift-tistory']})).body.job;
  const first=await claim();assert.ok(first);assert.equal(await claim(),null);
  at+=5*60_000;const second=await claim();assert.ok(second);assert.equal(second.requestId,first.requestId);assert.notEqual(second.token,first.token);
  assert.equal((await f.request('admin',base+'/update',{...first,reason:'done'})).status,409);
  const id=ids['shift-tistory'],ch=f.app.store.get('channels',id);
  f.app.store.put('channels',id,{...ch,ownerIds:[f.users.member.id]});
  await f.request('admin',base);
  f.app.store.put('channels',id,ch);
  assert.equal((await f.request('admin',base+'/update',{...second,reason:'done'})).status,409);
});

test('a repeated official file needs a download for this lease, and preserves its original observation date',async t=>{
  const f=await fixture(t);const ids=await f.register(['shift-tistory']);const id=ids['shift-tistory'];
  const path='/api/channels/'+id+'/external-observations',route='/api/collection-progress';
  const original={sourceType:'official-export',sourceUrl:'https://yuhobuilds.tistory.com/manage/statistics',exportFormat:'csv',
    observedAt:new Date(Date.now()-60000).toISOString(),evidenceSha256:sha('same downloaded report'),
    identity:{accountId:'shift-tistory',handle:'yuhobuilds.tistory.com'},observations:[{kind:'account-lifetime',metrics:{views:0}}]};
  assert.equal((await f.request('admin',path,original)).status,201);
  await f.request('admin','/api/collect',{});
  const job=(await f.request('admin',route+'/claim',{accountIds:['shift-tistory'],workerId:'fixture-worker'})).body.job;
  const envelope={...original,observedAt:new Date().toISOString()};
  const send=capture=>f.request('admin',route+'/observations',{...job,envelope,capture});
  assert.equal((await send(null)).status,400);
  const capture={requestId:job.requestId,token:job.token,evidenceSha256:original.evidenceSha256,downloadedAt:envelope.observedAt};
  assert.equal((await send({...capture,token:'other-lease'})).status,400);
  const repeated=await send(capture);assert.equal(repeated.status,200);assert.equal(repeated.body.existing,1);
  assert.equal((await f.request('admin',path)).body.observations[0].observedAt,original.observedAt);
  assert.deepEqual(measuredApiMetrics({channel:{followers:0},posts:[{metrics:{comments:0,likes:null}}]}),['followers','comments']);
});

function tistoryObservation(overrides={}){
  const observedMs=Date.now()-60*60000,day=kstDay(observedMs);
  return {sourceType:'creator-screen',sourceUrl:'https://yuhobuilds.tistory.com/manage/statistics?session=synthetic-secret#top',observedAt:new Date(observedMs).toISOString(),evidenceSha256:sha('synthetic tistory capture'),
    identity:{accountId:'shift-tistory',handle:'yuhobuilds.tistory.com'},labels:{screenTitle:'방문 통계'},
    observations:[
      {kind:'account-period',period:{start:shift(day,-27),end:day},metrics:{views:5000,visitors:900,likes:null},labels:{periodLabel:'최근 28일',selectedRange:`${shift(day,-27)} ~ ${day}`,unit:'회'}},
      {kind:'account-lifetime',metrics:{followers:340,posts:58},labels:{unit:'명'}},
      {kind:'post-lifetime',post:{externalId:'15',url:'https://yuhobuilds.tistory.com/15',publishedAt:new Date(observedMs-3*DAY_MS).toISOString(),title:'Synthetic post'},metrics:{views:120,likes:3}},
    ],...overrides};
}
function pinterestObservation(){
  const observedMs=Date.now()-2*3600000,day=kstDay(observedMs);
  return {sourceType:'creator-screen',sourceUrl:'https://www.pinterest.com/business/hub/',observedAt:new Date(observedMs).toISOString(),evidenceSha256:sha('synthetic pinterest capture'),
    identity:{accountId:'shift-pinterest',handle:'@synkshift'},observations:[{kind:'account-period',period:{start:shift(day,-29),end:day},metrics:{impressions:4000,views:null},labels:{periodLabel:'Last 30 days'}}]};
}

test('analytics shows external values by their real dates: a 30-day period ending yesterday recorded today stays visible and repeats keep only the newest source',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-tistory']),tistory=ids['shift-tistory'],path=`/api/channels/${tistory}/external-observations`;
  const firstMs=Date.now()-10*60000,secondMs=Date.now()-2*60000,yesterday=shift(kstDay(firstMs),-1),start=shift(yesterday,-29);
  const capture=(observedMs,evidence,views,followers)=>({sourceType:'official-export',exportFormat:'csv',sourceUrl:'https://yuhobuilds.tistory.com/manage/statistics',observedAt:new Date(observedMs).toISOString(),evidenceSha256:sha(evidence),
    identity:{accountId:'shift-tistory',handle:'yuhobuilds.tistory.com'},
    observations:[{kind:'account-period',period:{start,end:yesterday},metrics:{views},labels:{periodLabel:'지난 30일',selectedRange:`${start} ~ ${yesterday}`}},
      {kind:'account-lifetime',metrics:{followers}},
      {kind:'post-lifetime',post:{externalId:'15',url:'https://yuhobuilds.tistory.com/15',publishedAt:new Date(Date.parse(yesterday+'T12:00:00+09:00')).toISOString()},metrics:{views:views/10}}]});
  assert.equal((await f.request('admin',path,capture(firstMs,'synthetic tistory export A',3000,300))).status,201);
  assert.equal((await f.request('admin',path,capture(secondMs,'synthetic tistory export B',3100,301))).status,201);
  const report=await f.request('admin',`/api/analytics?channel=${tistory}&start=${start}&end=${yesterday}`);
  assert.equal(report.status,200,JSON.stringify(report.body).slice(0,300));
  const external=report.body.externalObservations,rows=external.channels[0].observations;
  assert.equal(external.includedInTotals,false);
  assert.deepEqual(rows.map(row=>row.kind).sort(),['account-lifetime','account-period','post-lifetime'],'one newest source per kind, period and post');
  const period=rows.find(row=>row.kind==='account-period');
  assert.deepEqual([period.metrics.views,period.period.start,period.period.end,period.periodMatchesSelection,period.labels.periodLabel,period.observedAt],[3100,start,yesterday,true,'지난 30일',new Date(secondMs).toISOString()]);
  assert.equal(rows.find(row=>row.kind==='account-lifetime').metrics.followers,301);
  assert.equal(rows.find(row=>row.kind==='post-lifetime').metrics.views,310);
  assert.equal(external.omittedOlder,3);
  assert.equal((await f.request('admin',path)).body.total,6,'the detail read keeps every source');
  const earlier=await f.request('admin',`/api/analytics?channel=${tistory}&start=${shift(start,-40)}&end=${shift(start,-31)}`);
  assert.deepEqual(earlier.body.externalObservations.channels[0].observations.map(row=>row.kind),['account-lifetime'],'without overlap only the latest account total is shown');
});

// 11-15 보완 관측 유실 고침: 같은 30일을 따로 받은 조회수 내보내기, 프로필 방문 내보내기, 댓글과 공유 화면은 서로 가리지 않는다.
// 같은 정의로 다시 본 조회수는 가장 최근 관측 하나만 남는다. 앞 관측에만 있던 null 칸은 그 관측을 다시 보이게 하지 않는다.
// 더 최근 관측이 같은 정의의 조회수를 null로 보였으면, 앞 관측이 다른 수치 때문에 남아도 응답에서 그 조회수는 빠진다. 더 최근 값이 숫자일 때도 같다. 저장된 관측과 상세 조회는 그대로다.
// 시간대, 수치 이름표, 출처 종류가 다른 조회수는 정의가 다른 값이라 서로 가리지 않는다. 어느 줄도 다른 관측의 값과 합치거나 더하지 않는다.
test('analytics keeps separately recorded same-period exports and screens, keeps only the newest repeat of one definition, and never hides another time zone, metric label or source type',async t=>{
  const f=await fixture(t),ids=await f.register(['pulse-facebook']),fb=ids['pulse-facebook'],path=`/api/channels/${fb}/external-observations`;
  const now=Date.now(),at=minutes=>new Date(now-minutes*60000).toISOString(),yesterday=shift(kstDay(now-50*60000),-1),start=shift(yesterday,-29);
  const seoul={timeZone:'Asia/Seoul',metricLabels:{views:'조회'}},counted={timeZone:'Asia/Seoul',unit:'회'};
  const inputs={
    views:['official-export',at(40),{views:1200},seoul],
    olderRepeat:['official-export',at(50),{views:1000,reach:null},seoul],
    profileVisits:['official-export',at(30),{profileVisits:40},{timeZone:'Asia/Seoul'}],
    commentsShares:['creator-screen',at(30),{comments:7,shares:3},{timeZone:'Asia/Seoul'}],
    pacificViews:['official-export',at(20),{views:1300},{...seoul,timeZone:'America/Los_Angeles'}],
    videoViews:['official-export',at(20),{views:500},{...seoul,metricLabels:{views:'3초 이상 동영상 조회'}}],
    screenViews:['creator-screen',at(20),{views:1250},seoul],
    newerNullViews:['official-export',at(25),{views:null,shares:3},counted],
    olderCountedViews:['official-export',at(45),{views:120,likes:7},counted,{likes:7}],
  };
  const recorded={};
  for(const [name,[sourceType,observedAt,metrics,labels]] of Object.entries(inputs)){
    const exported=sourceType==='official-export';
    const result=await f.request('admin',path,{sourceType,...(exported?{exportFormat:'csv'}:{}),sourceUrl:`https://business.facebook.com/latest/insights/${exported?'results':'content'}?asset_id=1376159468922910`,observedAt,evidenceSha256:sha('synthetic facebook '+name),
      identity:{accountId:'pulse-facebook',handle:'@synkpulse'},observations:[{kind:'account-period',period:{start,end:yesterday},metrics,labels:{periodLabel:'지난 30일',...labels}}]});
    assert.equal(result.status,201,`${name} ${JSON.stringify(result.body)}`);
    recorded[name]=result.body.records[0].id;
  }
  const report=await f.request('admin',`/api/analytics?channel=${fb}&start=${start}&end=${yesterday}`);
  assert.equal(report.status,200,JSON.stringify(report.body).slice(0,300));
  const external=report.body.externalObservations,rows=external.channels[0].observations,byId=Object.fromEntries(rows.map(row=>[row.id,row]));
  const shown=Object.keys(inputs).filter(name=>name!=='olderRepeat');
  assert.deepEqual(rows.map(row=>row.id).sort(),shown.map(name=>recorded[name]).sort(),'only the older repeat of the same definition is left out');
  for(const name of shown){
    const [sourceType,observedAt,metrics,,expected=metrics]=inputs[name],row=byId[recorded[name]];
    assert.deepEqual([row.sourceType,row.observedAt,row.metrics],[sourceType,observedAt,expected],`${name} keeps its own source and time, and only values no newer row of the same definition replaced`);
  }
  assert.equal(external.omittedOlder,1);
  assert.equal(rows.some(row=>row.metrics.views===120),false,'a newer null of the same definition keeps the older 120 from coming back');
  const stored=f.app.store.all(EXTERNAL_OBSERVATION_KIND),again=list=>createExternalObservations({store:{all:kind=>kind===EXTERNAL_OBSERVATION_KIND?list:[]}}).forAnalytics([f.app.store.get('channels',fb)],{start,end:yesterday}).channels[0].observations;
  assert.deepEqual(again([...stored].reverse()),rows,'the order the store returns rows in does not change the result');
  const numbered=again(stored.map(row=>row.id===recorded.newerNullViews?{...row,metrics:{views:150,shares:3}}:row)),valuesOf=name=>numbered.find(row=>row.id===recorded[name]).metrics;
  assert.deepEqual([valuesOf('olderCountedViews'),valuesOf('newerNullViews')],[{likes:7},{views:150,shares:3}],'a newer number replaces the older one too, while the older row stays for its own field');
  const detail=(await f.request('admin',path)).body,original=Object.fromEntries(detail.observations.map(row=>[row.id,row.metrics]));
  assert.equal(detail.total,9,'the detail read keeps every source');
  assert.deepEqual([original[recorded.olderCountedViews],original[recorded.newerNullViews]],[{views:120,likes:7},{views:null,shares:3}],'stored rows keep every value they were recorded with');
});

// 11-15 분석 응답 상한 고침: 계정마다 90일 동안의 하루 값과 7일, 30일, 60일, 90일 합계를 남기면 계정 여섯 개만으로도 예전 상한 500을 넘는다.
// 상한(EXTERNAL_LIMITS.analyticsMax) 안에서는 모든 계정의 모든 줄이 그대로 나온다. 상한을 넘을 때만 가장 오래된 줄부터 빠지고 truncated가 true가 된다.
// 상한 경계는 실제로 기록한 줄을 메모리 저장소에 복제해서 확인한다. 그래서 저장소에 수천 번 쓰지 않는다.
test('analytics keeps every daily and period row of every account up to the bounded cap, and only rows beyond the cap are cut and flagged',async t=>{
  assert.deepEqual([EXTERNAL_LIMITS.rows,EXTERNAL_LIMITS.listMax,EXTERNAL_LIMITS.analyticsMax],[200,500,10000],'the write batch and detail list limits stay; only the analytics bound moved');
  const accounts=[
    ['shift-tistory','https://yuhobuilds.tistory.com/manage/statistics',{handle:'yuhobuilds.tistory.com'}],
    ['shift-pinterest','https://www.pinterest.com/business/hub/',{handle:'@synkshift'}],
    ['pulse-facebook','https://business.facebook.com/latest/insights/results?asset_id=1376159468922910',{handle:'@synkpulse'}],
    ['synk-linkedin-company','https://www.linkedin.com/company/synk-im/admin/analytics/updates',{handle:'synk-im'}],
    ['shift-kakao','https://business.kakao.com/space/10671395/channel/_kvlrX/statistics/post',{handle:'synkshift'}],
    ['lab-cn-douyin','https://creator.douyin.com/creator-micro/data/overview',{handle:'39504393074'}],
  ];
  const f=await fixture(t),ids=await f.register(accounts.map(([accountId])=>accountId)),service=createExternalObservations({store:f.app.store});
  const now=Date.now(),observedAtFor=index=>new Date(now-(20+index)*60000).toISOString(),yesterday=shift(kstDay(now-(20+accounts.length)*60000),-1),start=shift(yesterday,-89);
  const daily=Array.from({length:90},(_,i)=>({kind:'account-period',period:{start:shift(yesterday,-i),end:shift(yesterday,-i)},metrics:{views:i}}));
  const totals=[7,30,60,90].map(days=>({kind:'account-period',period:{start:shift(yesterday,1-days),end:yesterday},metrics:days===90?{views:days*100}:{views:days*100,visitors:days*10},labels:{periodLabel:`지난 ${days}일`}}));
  for(const [index,[accountId,sourceUrl,identity]] of accounts.entries()){
    const base={sourceUrl,observedAt:observedAtFor(index),identity:{accountId,...identity}};
    assert.equal(service.record(f.users.admin,{id:ids[accountId]},{...base,sourceType:'official-export',exportFormat:'csv',evidenceSha256:sha('cap daily export '+accountId),observations:daily}).created.length,90,accountId);
    assert.equal(service.record(f.users.admin,{id:ids[accountId]},{...base,sourceType:'creator-screen',evidenceSha256:sha('cap period screen '+accountId),observations:totals}).created.length,4,accountId);
  }
  const perAccount=daily.length+totals.length,count=report=>report.channels.reduce((sum,group)=>sum+group.observations.length,0),channels=f.app.store.all('channels');
  const full=service.forAnalytics(channels,{start,end:yesterday});
  assert.deepEqual([count(full),full.truncated,full.omittedOlder],[accounts.length*perAccount,false,0],'more than the old 500 rows all come back');
  assert.deepEqual(full.channels.map(group=>[group.accountId,group.observations.length]).sort(),accounts.map(([accountId])=>[accountId,perAccount]).sort(),'no account is cut off');
  const first=full.channels.find(group=>group.accountId===accounts[0][0]).observations;
  assert.ok(first.every(row=>row.sourceType===(row.period.days===1?'official-export':'creator-screen')),'each row keeps its own source');
  assert.deepEqual(first.find(row=>row.period.days===1&&row.period.start===yesterday).metrics,{views:0},'a zero stays a zero');
  assert.deepEqual(first.find(row=>row.period.days===90).metrics,{views:9000},'a metric the screen did not show stays absent');
  const handed=service.forAnalytics(channels.filter(channel=>channel.id!==ids[accounts[0][0]]),{start,end:yesterday});
  assert.deepEqual([handed.channels.length,count(handed),handed.truncated],[accounts.length-1,(accounts.length-1)*perAccount,false],'only the channels handed in are read');
  const served=await f.request('admin',`/api/analytics?start=${start}&end=${yesterday}`);
  assert.equal(served.status,200,JSON.stringify(served.body).slice(0,300));
  assert.deepEqual([count(served.body.externalObservations),served.body.externalObservations.truncated],[accounts.length*perAccount,false],'the 90-day analytics response carries every row');
  const cap=EXTERNAL_LIMITS.analyticsMax,legit=f.app.store.all(EXTERNAL_OBSERVATION_KIND),memory=rows=>({all:kind=>kind===EXTERNAL_OBSERVATION_KIND?rows:[]});
  const analyze=rows=>createExternalObservations({store:memory(rows)}).forAnalytics([...new Set(rows.map(row=>row.channelId))].map(id=>({id,platform:'synthetic',displayName:id})),{start,end:yesterday});
  const clones=Array.from({length:Math.ceil(cap/legit.length)},(_,copy)=>legit.map(row=>({...row,id:`${row.id}~${copy}`,channelId:`${row.channelId}~${copy}`}))).flat().slice(0,cap);
  const atCap=analyze(clones);
  assert.deepEqual([count(atCap),atCap.truncated],[cap,false],'exactly the cap is still complete');
  const olderAt=new Date(Date.parse(legit[0].observedAt)-DAY_MS).toISOString(),oldest={...legit[0],id:'xmo_oldest_beyond_cap',channelId:`${legit[0].channelId}~oldest`,observedAt:olderAt,observedDate:kstDay(Date.parse(olderAt))};
  const beyond=analyze([...clones,oldest]);
  assert.deepEqual([count(beyond),beyond.truncated,beyond.omittedOlder],[cap,true,0],'one row over the cap is cut and flagged, not hidden as a repeat');
  assert.equal(beyond.channels.some(group=>group.channelId===oldest.channelId),false,'the row cut is the oldest one');
});

test('creator.rednote.com is an accepted creator host; Telegram t.me public pages are recorded as public-page and never as a connection',async t=>{
  const f=await fixture(t),ids=await f.register(['lab-cn-xiaohongshu','lab-uz-telegram']);
  const observedMs=Date.now()-20*60000,observedAt=new Date(observedMs).toISOString(),publishedAt=new Date(observedMs-2*DAY_MS).toISOString();
  const rednotePath=`/api/channels/${ids['lab-cn-xiaohongshu']}/external-observations`;
  const rednote=(sourceUrl,evidence)=>({sourceType:'creator-screen',sourceUrl,observedAt,evidenceSha256:sha(evidence),identity:{accountId:'lab-cn-xiaohongshu',externalId:'6ab10807000000000301d12f'},labels:{screenTitle:'笔记管理'},
    observations:[{kind:'post-lifetime',post:{externalId:'6731a2b3000000001b012345',url:'https://www.rednote.com/explore/6731a2b3000000001b012345',publishedAt},metrics:{views:420,likes:31,shares:4}}]});
  const lookalike=await f.request('admin',rednotePath,rednote('https://creator.rednote.com.evil.test/new/note-manager','synthetic rednote lookalike'));
  assert.equal(lookalike.status,400);assert.equal(lookalike.body.code,'SYNK_EXTERNAL_SOURCE');
  const accepted=await f.request('admin',rednotePath,rednote('https://creator.rednote.com/new/note-manager','synthetic rednote note manager'));
  assert.equal(accepted.status,201,JSON.stringify(accepted.body));
  assert.equal(accepted.body.records[0].sourceUrl,'https://creator.rednote.com/new/note-manager');
  assert.equal(accepted.body.records[0].projection.state,'projected');
  const telegram=ids['lab-uz-telegram'],telegramPath=`/api/channels/${telegram}/external-observations`;
  const page=(overrides={})=>({sourceType:'public-page',sourceUrl:'https://t.me/s/synklab_uz',observedAt,evidenceSha256:sha('synthetic telegram public page'),identity:{accountId:'lab-uz-telegram',handle:'@synklab_uz'},
    observations:[{kind:'account-lifetime',metrics:{followers:128}},{kind:'post-lifetime',post:{externalId:'12',url:'https://t.me/synklab_uz/12',publishedAt},metrics:{views:345}}],...overrides});
  for(const [overrides,code] of [
    [{sourceUrl:'https://web.telegram.org/k/'},'SYNK_EXTERNAL_SOURCE'],
    [{sourceUrl:'https://t.me/s/another_channel'},'SYNK_EXTERNAL_SOURCE'],
    [{sourceUrl:'https://t.me.evil.test/s/synklab_uz'},'SYNK_EXTERNAL_SOURCE'],
    [{exportFormat:'csv'},'SYNK_EXTERNAL_SOURCE'],
    [{sourceType:'creator-screen'},'SYNK_EXTERNAL_SOURCE'],
    [{evidenceSha256:undefined},'SYNK_EXTERNAL_EVIDENCE'],
    [{identity:{accountId:'lab-uz-telegram',handle:'@another_channel'}},'SYNK_EXTERNAL_IDENTITY'],
    [{observations:[{kind:'account-lifetime',metrics:{followersGained:3}}]},'SYNK_EXTERNAL_METRIC_GRAIN'],
  ]){
    const result=await f.request('admin',telegramPath,page(overrides));
    assert.equal(result.status,400,`${code} ${JSON.stringify(overrides)} ${JSON.stringify(result.body)}`);
    assert.equal(result.body.code,code);
  }
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).filter(row=>row.channelId===telegram).length,0);
  const recorded=await f.request('admin',telegramPath,page());
  assert.equal(recorded.status,201,JSON.stringify(recorded.body));
  assert.ok(recorded.body.records.every(row=>row.sourceType==='public-page'&&row.source==='external:public-page'&&row.sourceUrl==='https://t.me/s/synklab_uz'));
  assert.equal(f.app.store.get('posts',`${telegram}:12`).source,'external:public-page');
  const state=await f.request('admin','/api/state'),card=state.body.channels.find(row=>row.id===telegram);
  assert.equal(card.connected,false,'a public page is not an API connection');
  assert.equal(card.externalCollection.sourceType,'public-page');assert.equal(card.externalCollection.countsAsApiCollection,false);
  assert.ok(card.externalCollection.sourceBasis.includes('공개 화면'));
  assert.equal(f.app.store.secret('channel:'+telegram),null);
});

test('admin registers all 74 managed ledger accounts once; retry and the pre-registered API channel stay untouched',async t=>{
  const f=await fixture(t);
  assert.equal(MANAGED.length,74,'원장 관리 계정 수(2026-11-19 원장 기준 — yuhobuilds-linkedin이 운영으로 돌아왔고, 티스토리 PULSE · 솔리오 블로그 둘을 더했다)');
  const made=await f.request('member','/api/channels',{urls:['https://www.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg']});
  assert.equal(made.status,201);
  const existingId=made.body.added[0].id;
  f.app.store.setSecret('channel:'+existingId,{apiKey:'synthetic-key',connectedBy:f.users.member.id});
  const before={channel:f.app.store.get('channels',existingId),history:f.app.store.all('ownershipEvents').filter(event=>event.channelId===existingId)};
  const first=await f.request('admin','/api/channels/from-catalog',{accountIds:MANAGED});
  assert.equal(first.status,201,JSON.stringify(first.body).slice(0,500));
  assert.deepEqual(first.body.summary,{requested:74,added:73,existing:1});
  assert.deepEqual(first.body.existing.map(row=>[row.accountId,row.channel.id]),[['lab-youtube',existingId]]);
  assert.equal(first.body.existing[0].channel.connected,true);
  assert.deepEqual(f.app.store.get('channels',existingId),before.channel,'the existing channel document is not rewritten');
  assert.deepEqual(f.app.store.all('ownershipEvents').filter(event=>event.channelId===existingId),before.history,'existing ownership history is untouched');
  assert.deepEqual(f.app.store.secret('channel:'+existingId),{apiKey:'synthetic-key',connectedBy:f.users.member.id});
  for(const row of first.body.added){
    const stored=f.app.store.get('channels',row.channel.id);
    assert.equal(matchAccount(stored)?.id,row.accountId,row.accountId);
    assert.equal(stored.catalogAccountId,row.accountId);assert.equal(stored.legacyId,row.accountId);
    assert.equal(stored.active,true);assert.equal(stored.status,'not-connected');
    assert.deepEqual(stored.ownerIds,[f.users.admin.id]);assert.equal(stored.teamId,'team-synthetic');
    assert.equal(row.channel.connected,false);assert.equal(row.channel.externalCollection,null);
    assert.equal(f.app.store.secret('channel:'+stored.id),null,'no credentials are created');
    assert.ok(f.app.store.get('ownershipEvents','ownership-baseline:'+stored.id));
  }
  assert.equal(f.app.store.all('audit').filter(row=>row.action==='channel-from-catalog').length,73);
  const again=await f.request('admin','/api/channels/from-catalog',{accountIds:MANAGED});
  assert.equal(again.status,200);
  assert.deepEqual(again.body.summary,{requested:74,added:0,existing:74});
  assert.equal(f.app.store.all('channels').length,74);
  const simple=await f.request('admin','/api/social/simple');
  assert.equal(simple.status,200);
  const coverage=simple.body.accountMap.coverage;
  assert.equal(coverage.managed,74);assert.equal(coverage.registered,74);assert.equal(coverage.unregistered,0);
  assert.equal(coverage.connected,1,'registration does not count as an API connection');
  assert.equal(coverage.externallyObserved,0);
});

test('catalog registration rejects non-admins, bad CSRF, unmanaged, unknown and duplicate ids and ambiguous matches without writing',async t=>{
  const f=await fixture(t),send=(who,body,options)=>f.request(who,'/api/channels/from-catalog',body,options);
  assert.equal((await send('member',{accountIds:['shift-tistory']})).status,403);
  assert.equal((await send('viewer',{accountIds:['shift-tistory']})).status,403);
  assert.equal((await send('admin',{accountIds:['shift-tistory']},{csrf:'wrong'})).status,403);
  assert.equal((await send(null,{accountIds:['shift-tistory']})).status,403);
  const rejected=[
    [{accountIds:[]},'SYNK_CATALOG_INPUT'],
    [{accountIds:'shift-tistory'},'SYNK_CATALOG_INPUT'],
    [{accountIds:Array.from({length:101},(_,index)=>'id-'+index)},'SYNK_CATALOG_INPUT'],
    [{accountIds:['shift-tistory','shift-tistory']},'SYNK_CATALOG_DUPLICATE_ID'],
    [{accountIds:['shift-tistory'],cookie:'SID=synthetic'},'SYNK_CATALOG_INPUT'],
    [{accountIds:['no-such-account']},'SYNK_CATALOG_UNKNOWN_ACCOUNT'],
    [{accountIds:['lab-tw-instagram']},'SYNK_CATALOG_NOT_MANAGED'],
    [{accountIds:['synk-instagram']},'SYNK_CATALOG_NOT_MANAGED'],
    [{accountIds:['synkbrief-threads']},'SYNK_CATALOG_NOT_MANAGED'],
    [{accountIds:['yuhobuilds-tiktok']},'SYNK_CATALOG_NOT_MANAGED'],
    [{accountIds:['shift-tistory','lab-tw-instagram']},'SYNK_CATALOG_NOT_MANAGED'],
  ];
  for(const [body,code] of rejected){
    const result=await send('admin',body);
    assert.equal(result.status,400,JSON.stringify(body).slice(0,80));
    assert.equal(result.body.code,code);
  }
  const planRow=await send('admin',{accountIds:['other-plan-2']});
  assert.equal(planRow.status,400);
  assert.ok(['SYNK_CATALOG_UNKNOWN_ACCOUNT','SYNK_CATALOG_NOT_MANAGED'].includes(planRow.body.code));
  assert.equal(f.app.store.all('channels').length,0,'rejected requests write nothing');
  const at=new Date().toISOString(),base={platform:'youtube',ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected',createdAt:at};
  f.app.store.put('channels','yt-by-id',{...base,id:'yt-by-id',externalId:'UCmZplYKuNHLPng4iL2AbLLg',canonicalUrl:'https://www.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg'});
  f.app.store.put('channels','yt-by-url',{...base,id:'yt-by-url',handle:'synkkorean',canonicalUrl:'https://www.youtube.com/@synkkorean'});
  const ambiguous=await send('admin',{accountIds:['shift-tistory','lab-youtube']});
  assert.equal(ambiguous.status,409);
  assert.equal(ambiguous.body.code,'SYNK_CATALOG_AMBIGUOUS');
  assert.deepEqual(ambiguous.body.details.conflicts.map(row=>row.accountId),['lab-youtube']);
  assert.deepEqual([...ambiguous.body.details.conflicts[0].channelIds].sort(),['yt-by-id','yt-by-url']);
  assert.equal(f.app.store.all('channels').length,2,'the unambiguous account in the same request was not created either');
});

test('platform aliases and address-less ledger accounts register without invented or cross-site URLs',async t=>{
  const f=await fixture(t);
  const ids=['shift-naverblog','shift-class-naverblog','pulse-naverblog','lab-cn-douyin','lab-cn-xiaohongshu','lab-uz-telegram','yuho-linkedin-primary','lab-ru-rutube'];
  const result=await f.request('admin','/api/channels/from-catalog',{accountIds:ids});
  assert.equal(result.status,201,JSON.stringify(result.body).slice(0,500));
  assert.equal(result.body.added.length,ids.length);
  const byAccount=Object.fromEntries(result.body.added.map(row=>[row.accountId,f.app.store.get('channels',row.channel.id)]));
  for(const id of ['shift-naverblog','shift-class-naverblog','pulse-naverblog']){
    assert.equal(byAccount[id].platform,'naver-blog');
    assert.equal(matchAccount(byAccount[id])?.id,id);
  }
  const douyin=byAccount['lab-cn-douyin'];
  assert.equal(douyin.canonicalUrl,null);assert.equal(douyin.publicUrl,null);assert.equal(douyin.handle,'39504393074');assert.equal(douyin.externalId,null);
  const rednote=byAccount['lab-cn-xiaohongshu'];
  assert.equal(rednote.platform,'xiaohongshu');assert.equal(rednote.canonicalUrl,null,'rednote.com is not rewritten to xiaohongshu.com');
  assert.equal(rednote.publicUrl,'https://www.rednote.com/user/profile/6ab10807000000000301d12f');assert.equal(rednote.externalId,'6ab10807000000000301d12f');
  assert.equal(byAccount['lab-uz-telegram'].publicUrl,'https://t.me/synklab_uz');assert.equal(byAccount['lab-uz-telegram'].canonicalUrl,null);
  assert.equal(byAccount['yuho-linkedin-primary'].publicUrl,'https://www.linkedin.com/in/유호-양-5800b8433/');assert.equal(byAccount['yuho-linkedin-primary'].canonicalUrl,null);
  assert.equal(byAccount['lab-ru-rutube'].externalId,'81398864');assert.equal(byAccount['lab-ru-rutube'].handle,null);
  for(const channel of Object.values(byAccount)){assert.equal(channel.active,true);assert.equal(f.app.store.secret('channel:'+channel.id),null);}
  const state=await f.request('admin','/api/state');
  assert.equal(state.status,200);
  assert.ok(state.body.channels.every(channel=>channel.connected===false));
});

test('external observations need evidence, an official source, exact identity and clean values; retries never duplicate',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-tistory','shift-pinterest']);
  const send=(body,options,id=ids['shift-tistory'])=>f.request('admin',`/api/channels/${id}/external-observations`,body,options);
  const valid=tistoryObservation(),day=kstDay(Date.parse(valid.observedAt)),post=valid.observations[2].post;
  const cases=[
    [{evidenceSha256:undefined},'SYNK_EXTERNAL_EVIDENCE'],
    [{evidenceSha256:sha('')},'SYNK_EXTERNAL_EVIDENCE'],
    [{evidenceSha256:'a'.repeat(64)},'SYNK_EXTERNAL_EVIDENCE'],
    [{evidenceSha256:'not-a-hash'},'SYNK_EXTERNAL_EVIDENCE'],
    [{observedAt:new Date(Date.now()+DAY_MS).toISOString()},'SYNK_EXTERNAL_OBSERVED_AT'],
    [{observedAt:new Date(Date.now()-500*DAY_MS).toISOString()},'SYNK_EXTERNAL_OBSERVED_AT'],
    [{observedAt:'2026-11-13 10:00'},'SYNK_EXTERNAL_OBSERVED_AT'],
    [{sourceType:'api'},'SYNK_EXTERNAL_SOURCE'],
    [{sourceUrl:'https://evil.example/manage/statistics'},'SYNK_EXTERNAL_SOURCE'],
    [{sourceUrl:'https://yuhobuilds.tistory.com.evil.test/manage'},'SYNK_EXTERNAL_SOURCE'],
    [{sourceUrl:'http://yuhobuilds.tistory.com/manage/statistics'},'SYNK_EXTERNAL_SOURCE'],
    [{sourceUrl:'https://user:pass@yuhobuilds.tistory.com/manage'},'SYNK_EXTERNAL_SOURCE'],
    [{exportFormat:'csv'},'SYNK_EXTERNAL_SOURCE'],
    [{identity:{accountId:'shift-pinterest',handle:'yuhobuilds.tistory.com'}},'SYNK_EXTERNAL_IDENTITY'],
    [{identity:{accountId:'shift-tistory',handle:'someone.tistory.com'}},'SYNK_EXTERNAL_IDENTITY'],
    [{identity:{accountId:'shift-tistory'}},'SYNK_EXTERNAL_IDENTITY'],
    [{cookie:'SID=synthetic'},'SYNK_EXTERNAL_INPUT'],
    [{observations:[]},'SYNK_EXTERNAL_INPUT'],
    [{observations:[{kind:'post-lifetime',post,metrics:{followers:10}}]},'SYNK_EXTERNAL_METRIC_GRAIN'],
    [{observations:[{kind:'account-lifetime',period:{start:day,end:day},metrics:{followers:1}}]},'SYNK_EXTERNAL_METRIC_GRAIN'],
    [{observations:[{kind:'account-period',period:{start:day,end:shift(day,-1)},metrics:{views:1}}]},'SYNK_EXTERNAL_PERIOD'],
    [{observations:[{kind:'account-period',period:{start:day,end:shift(day,1)},metrics:{views:1}}]},'SYNK_EXTERNAL_PERIOD'],
    [{observations:[{kind:'account-lifetime',metrics:{followers:-1}}]},'SYNK_EXTERNAL_METRIC_VALUE'],
    [{observations:[{kind:'account-lifetime',metrics:{followers:'NaN'}}]},'SYNK_EXTERNAL_METRIC_VALUE'],
    [{observations:[{kind:'account-lifetime',metrics:{followers:1.5}}]},'SYNK_EXTERNAL_METRIC_VALUE'],
    [{observations:[{kind:'account-lifetime',metrics:{followers:'12'}}]},'SYNK_EXTERNAL_METRIC_VALUE'],
    [{observations:[{kind:'account-lifetime',metrics:{followers:null}}]},'SYNK_EXTERNAL_METRIC_VALUE'],
    [{observations:[{kind:'account-lifetime',metrics:{}}]},'SYNK_EXTERNAL_METRIC_VALUE'],
    [{observations:[{kind:'post-lifetime',post:{...post,externalId:'16'},metrics:{views:1}}]},'SYNK_EXTERNAL_POST'],
    [{observations:[{kind:'post-lifetime',post:{...post,url:'https://other.tistory.com/15'},metrics:{views:1}}]},'SYNK_EXTERNAL_POST'],
    [{observations:[{kind:'post-lifetime',post:{...post,publishedAt:new Date(Date.now()+DAY_MS).toISOString()},metrics:{views:1}}]},'SYNK_EXTERNAL_POST'],
    [{observations:[{kind:'account-lifetime',metrics:{followers:1}},{kind:'account-lifetime',metrics:{followers:2}}]},'SYNK_EXTERNAL_DUPLICATE_ROW'],
  ];
  for(const [overrides,code] of cases){
    const result=await send(tistoryObservation(overrides));
    assert.equal(result.status,400,`${code} ${JSON.stringify(overrides).slice(0,120)} ${JSON.stringify(result.body)}`);
    assert.equal(result.body.code,code);
  }
  const infinite=await send(undefined,{raw:JSON.stringify(valid).replace('"followers":340','"followers":1e999')});
  assert.equal(infinite.status,400);assert.equal(infinite.body.code,'SYNK_EXTERNAL_METRIC_VALUE');
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).length,0);assert.equal(f.app.store.all('posts').length,0);
  const first=await send(valid);
  assert.equal(first.status,201,JSON.stringify(first.body));
  assert.deepEqual([first.body.created.length,first.body.existing.length],[3,0]);
  const stored=f.app.store.all(EXTERNAL_OBSERVATION_KIND);
  assert.equal(stored.length,3);
  for(const row of stored){
    assert.equal(row.sourceUrl,'https://yuhobuilds.tistory.com/manage/statistics','query and fragment are dropped');
    assert.equal(row.source,'external:creator-screen');assert.equal(row.countsAsApiCollection,false);assert.equal(row.identityVerified,true);
    assert.equal(JSON.stringify(row).includes('synthetic-secret'),false);
  }
  const period=stored.find(row=>row.kind==='account-period');
  assert.deepEqual(period.metrics,{views:5000,visitors:900,likes:null});
  assert.equal(Object.hasOwn(period.metrics,'comments'),false,'a metric the screen did not show stays absent, never 0');
  assert.equal(period.labels.periodLabel,'최근 28일');assert.equal(period.sourceLabels.screenTitle,'방문 통계');
  const again=await send(valid);
  assert.equal(again.status,200);assert.deepEqual([again.body.created.length,again.body.existing.length],[0,3]);
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).length,3);assert.equal(f.app.store.all('snapshots').length,1);
  const changed=structuredClone(valid);changed.observations[1].metrics.followers=341;
  const conflict=await send(changed);
  assert.equal(conflict.status,409);assert.equal(conflict.body.code,'SYNK_EXTERNAL_DUPLICATE_CONFLICT');
  const moved=await send({...valid,observedAt:new Date(Date.parse(valid.observedAt)-60000).toISOString()});
  assert.equal(moved.status,409);assert.equal(moved.body.code,'SYNK_EXTERNAL_EVIDENCE_CONFLICT');
  const reused=await send({...pinterestObservation(),evidenceSha256:valid.evidenceSha256},undefined,ids['shift-pinterest']);
  assert.equal(reused.status,409);assert.equal(reused.body.code,'SYNK_EXTERNAL_EVIDENCE_OTHER_CHANNEL');
  const extended=structuredClone(valid);
  extended.observations.push({kind:'post-lifetime',post:{externalId:'16',url:'https://yuhobuilds.tistory.com/16',publishedAt:post.publishedAt},metrics:{views:7}});
  const more=await send(extended);
  assert.equal(more.status,201);assert.deepEqual([more.body.created.length,more.body.existing.length],[1,3]);
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).length,4);
  assert.deepEqual(f.app.store.get(EXTERNAL_OBSERVATION_KIND,period.id),period,'existing records are never rewritten');
});

test('account-period and account-lifetime never enter post totals; post-lifetime projects only where no API owns the post',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-tistory']),tistory=ids['shift-tistory'];
  const channelBefore=f.app.store.get('channels',tistory);
  assert.equal((await f.request('admin',`/api/channels/${tistory}/external-observations`,tistoryObservation())).status,201);
  assert.deepEqual(f.app.store.get('channels',tistory),channelBefore,'observations never mark a channel as collected');
  const end=kstDay(Date.now()),start=shift(end,-6);
  const report=await f.request('admin',`/api/analytics?channel=${tistory}&start=${start}&end=${end}`);
  assert.equal(report.status,200,JSON.stringify(report.body).slice(0,300));
  assert.equal(report.body.metrics.views.latest,120,'the 28-day account total (5000) is not added to post views');
  assert.equal(report.body.metrics.followers.latest,null,'account-lifetime followers stay out of channel snapshots');
  assert.equal(f.app.store.all('channelSnapshots').length,0);
  const projected=f.app.store.get('posts',`${tistory}:15`);
  assert.equal(projected.source,'external:creator-screen');assert.equal(projected.url,'https://yuhobuilds.tistory.com/15');
  const snapshots=f.app.store.all('snapshots');
  assert.equal(snapshots.length,1);
  assert.deepEqual([snapshots[0].views,snapshots[0].likes,snapshots[0].comments,snapshots[0].source],[120,3,null,'external:creator-screen']);
  const external=report.body.externalObservations;
  assert.equal(external.includedInTotals,false);
  assert.deepEqual(external.channels.map(row=>row.channelId),[tistory]);
  assert.deepEqual(external.channels[0].observations.map(row=>row.kind).sort(),['account-lifetime','account-period','post-lifetime']);
  assert.equal(external.channels[0].observations.find(row=>row.kind==='account-period').metrics.views,5000);
  const at=new Date().toISOString(),today=kstDay(Date.now()),yesterday=shift(today,-1);
  const api={id:'api-youtube',platform:'youtube',canonicalUrl:'https://www.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg',externalId:'UCmZplYKuNHLPng4iL2AbLLg',handle:'synkkorean',displayName:'API channel',ownerIds:[f.users.admin.id],teamId:null,active:true,status:'success',lastCollectedAt:at,createdAt:at,connectionVersion:1};
  f.app.store.put('channels',api.id,api);
  f.app.store.setSecret('channel:'+api.id,{apiKey:'synthetic-key',connectedBy:f.users.admin.id});
  const apiPost={id:'api-youtube:abcdefghijk',channelId:api.id,externalId:'abcdefghijk',title:'API post',url:'https://www.youtube.com/watch?v=abcdefghijk',publishedDate:shift(today,-2),publishedAt:new Date(Date.now()-2*DAY_MS).toISOString(),source:'api:youtube',unavailableAt:null,lastSeenAt:at};
  const apiSnapshot={id:`${apiPost.id}:${yesterday}`,postId:apiPost.id,date:yesterday,checkedAt:at,source:'api:youtube',views:1000,likes:10,comments:1,shares:null,saves:null,reach:null};
  f.app.store.put('posts',apiPost.id,apiPost);f.app.store.put('snapshots',apiSnapshot.id,apiSnapshot);
  const observedMs=Date.now()-30*60000,observedDay=kstDay(observedMs);
  const exportInput={sourceType:'official-export',exportFormat:'csv',sourceUrl:'https://studio.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg/analytics/tab-overview/period-default',observedAt:new Date(observedMs).toISOString(),evidenceSha256:sha('synthetic youtube export'),
    identity:{accountId:'lab-youtube',externalId:'UCmZplYKuNHLPng4iL2AbLLg'},
    observations:[{kind:'post-lifetime',post:{externalId:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk&si=tracking',publishedAt:apiPost.publishedAt},metrics:{views:999,saves:4}},
      {kind:'account-period',period:{start:shift(observedDay,-27),end:observedDay},metrics:{views:777777},labels:{periodLabel:'지난 28일',timeZone:'America/Los_Angeles'}}]};
  const recorded=await f.request('admin','/api/channels/api-youtube/external-observations',exportInput);
  assert.equal(recorded.status,201,JSON.stringify(recorded.body));
  const kept=recorded.body.records.find(row=>row.kind==='post-lifetime');
  assert.deepEqual(kept.projection,{state:'kept-separate',reason:'api-platform'});
  assert.equal(kept.post.url,'https://www.youtube.com/watch?v=abcdefghijk');
  assert.deepEqual(f.app.store.get('posts',apiPost.id),apiPost);
  assert.deepEqual(f.app.store.get('snapshots',apiSnapshot.id),apiSnapshot);
  assert.equal(f.app.store.all('snapshots').length,2,'no snapshot is written over or beside the API series');
  assert.deepEqual(f.app.store.get('channels',api.id),api);
  assert.ok(f.app.store.all(EXTERNAL_OBSERVATION_KIND).every(row=>row.source.startsWith('external:')));
  const apiReport=await f.request('admin',`/api/analytics?channel=api-youtube&start=${start}&end=${end}`);
  assert.equal(apiReport.body.metrics.views.latest,1000,'API post totals are unchanged by screen or export values');
  assert.equal(apiReport.body.externalObservations.channels[0].observations.length,2);
  const state=await f.request('admin','/api/state'),card=state.body.channels.find(row=>row.id==='api-youtube');
  assert.equal(card.connected,true);
  assert.equal(card.externalCollection.sourceType,'official-export');assert.equal(card.externalCollection.kind,'account-period');
  assert.equal(card.externalCollection.countsAsApiCollection,false);assert.equal(card.externalCollection.identityVerified,true);
  assert.deepEqual(card.externalCollection.period,{start:shift(observedDay,-27),end:observedDay,days:28});
  assert.equal(card.lastCollectedAt,at,'the API collection time is not replaced by the export time');
});

test('post numbers come from each platform post route, never from an account segment',async t=>{
  const f=await fixture(t),ids=await f.register(['lab-uz-telegram']),telegram=ids['lab-uz-telegram'],path=`/api/channels/${telegram}/external-observations`;
  const observedAt=new Date(Date.now()-20*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString();
  const body=(rows,evidence)=>({sourceType:'public-page',sourceUrl:'https://t.me/s/synklab_uz',observedAt,evidenceSha256:sha(evidence),identity:{accountId:'lab-uz-telegram',handle:'@synklab_uz'},observations:rows.map(([externalId,url])=>({kind:'post-lifetime',post:{externalId,url,publishedAt},metrics:{views:5}}))});
  for(const rows of [[['12','https://t.me/synklab_uz/12'],['synklab_uz','https://t.me/synklab_uz/12']],[['synklab_uz','https://t.me/s/synklab_uz']],[['12','https://t.me/synklab_uz/12/extra']]]){
    const result=await f.request('admin',path,body(rows,'route '+rows.length+rows[0][0]));
    assert.equal(result.status,400,JSON.stringify(rows));assert.equal(result.body.code,'SYNK_EXTERNAL_POST');
  }
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).length,0);assert.equal(f.app.store.all('posts').length,0);
  assert.equal((await f.request('admin',path,body([['12','https://t.me/synklab_uz/12']],'route ok'))).status,201);
  assert.deepEqual(f.app.store.all('posts').map(row=>row.id),[`${telegram}:12`]);
});

test('screen and export sources must be a creator route of the same account, while verified real routes still pass',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-kakao','synk-linkedin-company','lab-ru-vk','lab-cn-douyin']);
  f.app.store.put('channels','yt',{id:'yt',platform:'youtube',externalId:'UCmZplYKuNHLPng4iL2AbLLg',canonicalUrl:'https://www.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg',handle:'synkkorean',ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected',createdAt:new Date().toISOString()});
  const observedAt=new Date(Date.now()-30*60000).toISOString();let count=0;
  const send=(channelId,accountId,identity,sourceUrl,sourceType='creator-screen')=>f.request('admin',`/api/channels/${channelId}/external-observations`,{sourceType,sourceUrl,observedAt,evidenceSha256:sha('route check '+(count++)),identity:{accountId,...identity},observations:[{kind:'account-lifetime',metrics:{followers:1}}]});
  const yt=['yt','lab-youtube',{externalId:'UCmZplYKuNHLPng4iL2AbLLg'}],kakao=[ids['shift-kakao'],'shift-kakao',{handle:'synkshift'}],vk=[ids['lab-ru-vk'],'lab-ru-vk',{handle:'synklab_ru'}],douyin=[ids['lab-cn-douyin'],'lab-cn-douyin',{handle:'39504393074'}];
  for(const [args,url] of [[yt,'https://www.youtube.com/watch?v=abcdefghijk'],[yt,`https://studio.youtube.com/channel/UC${'B'.repeat(22)}/analytics`],[kakao,'https://business.kakao.com/space/10671395/channel/_other/statistics/post'],[vk,'https://vk.ru/groups/dashboard/@someone_else'],[douyin,'https://www.douyin.com/user/self']])assert.equal((await send(...args,url)).body.code,'SYNK_EXTERNAL_SOURCE',url);
  assert.equal((await send(...yt,'https://studio.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg/analytics','official-export')).status,201);
  for(const [args,url] of [[kakao,'https://business.kakao.com/space/10671395/channel/_kvlrX/statistics/post'],[[ids['synk-linkedin-company'],'synk-linkedin-company',{handle:'synk-im'}],'https://www.linkedin.com/company/143833958/admin/analytics/updates'],[vk,'https://vk.ru/groups/dashboard/@synklab_ru'],[douyin,'https://creator.douyin.com/creator-micro/data/overview']])assert.equal((await send(...args,url)).status,201,url);
});

test('Tistory entry slugs and VK wall ids keep one strict post identity, and alias forms never add a second post',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-tistory','lab-ru-vk']),tistory=ids['shift-tistory'],vk=ids['lab-ru-vk'];
  const observedAt=new Date(Date.now()-20*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString();
  const send=(channelId,body)=>f.request('admin',`/api/channels/${channelId}/external-observations`,body);
  const tistoryBody=(externalId,url,evidence)=>({sourceType:'creator-screen',sourceUrl:'https://yuhobuilds.tistory.com/manage/statistics',observedAt,evidenceSha256:sha(evidence),identity:{accountId:'shift-tistory',handle:'yuhobuilds.tistory.com'},observations:[{kind:'post-lifetime',post:{externalId,url,publishedAt},metrics:{views:9}}]});
  for(const [externalId,url] of [['entry','https://yuhobuilds.tistory.com/entry/synklab_uz'],['synklab_uz','https://yuhobuilds.tistory.com/synklab_uz'],['synklab_uz','https://other.tistory.com/entry/synklab_uz']])assert.equal((await send(tistory,tistoryBody(externalId,url,'tistory '+externalId+url))).body.code,'SYNK_EXTERNAL_POST',url);
  assert.equal((await send(tistory,tistoryBody('synklab_uz','https://yuhobuilds.tistory.com/entry/synklab_uz','tistory entry'))).status,201);
  assert.ok(f.app.store.get('posts',`${tistory}:synklab_uz`));
  const vkBody=externalId=>({sourceType:'public-page',sourceUrl:'https://vk.ru/synklab_ru',observedAt,evidenceSha256:sha('vk wall capture'),identity:{accountId:'lab-ru-vk',handle:'synklab_ru'},observations:[{kind:'post-lifetime',post:{externalId,url:'https://vk.ru/wall-243082040_45',publishedAt},metrics:{views:12}}]});
  for(const externalId of ['-243082040','wall-243082040','synklab_ru','45'])assert.equal((await send(vk,vkBody(externalId))).body.code,'SYNK_EXTERNAL_POST',externalId);
  const alias=await send(vk,vkBody('-243082040_45'));
  assert.equal(alias.status,201);assert.equal(alias.body.records[0].post.externalId,'wall-243082040_45');
  const canonical=await send(vk,vkBody('wall-243082040_45'));
  assert.equal(canonical.status,200);assert.deepEqual([canonical.body.created.length,canonical.body.existing.length],[0,1]);
  assert.deepEqual(f.app.store.all('posts').filter(row=>row.channelId===vk).map(row=>row.id),[`${vk}:wall-243082040_45`]);
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).filter(row=>row.channelId===vk).length,1);
});

test('source identifiers must match known values: Studio analytics only, LinkedIn by registered slug or a proven company number',async t=>{
  const f=await fixture(t),ids=await f.register(['synk-linkedin-company','yuho-linkedin-primary']);
  f.app.store.put('channels','yt',{id:'yt',platform:'youtube',externalId:'UCmZplYKuNHLPng4iL2AbLLg',canonicalUrl:'https://www.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg',handle:'synkkorean',ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected',createdAt:new Date().toISOString()});
  const observedAt=new Date(Date.now()-30*60000).toISOString();let count=0;
  const input=(accountId,identity,sourceUrl)=>({sourceType:'creator-screen',sourceUrl,observedAt,evidenceSha256:sha('identifier check '+(count++)),identity:{accountId,...identity},observations:[{kind:'account-lifetime',metrics:{followers:1}}]});
  const send=(channelId,accountId,identity,url)=>f.request('admin',`/api/channels/${channelId}/external-observations`,input(accountId,identity,url));
  const yt=['yt','lab-youtube',{externalId:'UCmZplYKuNHLPng4iL2AbLLg'}],company=[ids['synk-linkedin-company'],'synk-linkedin-company',{handle:'synk-im'}];
  for(const [args,url] of [[yt,'https://studio.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg/editing/details'],[company,'https://www.linkedin.com/company/wrong-slug/admin/analytics/updates'],[company,'https://www.linkedin.com/company/999999999/admin/analytics/updates']])assert.equal((await send(...args,url)).body.code,'SYNK_EXTERNAL_SOURCE',url);
  for(const [args,url] of [[yt,'https://studio.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg/analytics/tab-overview/period-default'],[company,'https://www.linkedin.com/company/synk-im/admin/analytics/updates'],[company,'https://www.linkedin.com/company/143833958/admin/analytics/visitors'],[[ids['yuho-linkedin-primary'],'yuho-linkedin-primary',{handle:'양유호'}],'https://www.linkedin.com/analytics/creator/content']])assert.equal((await send(...args,url)).status,201,url);
  const unproven=createExternalObservations({store:f.app.store,catalog:{...accountCatalog,accounts:accountCatalog.accounts.map(row=>row.id==='synk-linkedin-company'?{...row,externalId:null}:row)}});
  f.app.store.put('channels','li-unproven',{id:'li-unproven',platform:'linkedin',canonicalUrl:'https://www.linkedin.com/company/synk-im/',handle:'synk-im',catalogAccountId:'synk-linkedin-company',ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected'});
  for(const url of ['https://www.linkedin.com/company/143833958/admin/analytics/updates','https://www.linkedin.com/company/wrong-slug/admin/analytics/updates'])assert.throws(()=>unproven.record(f.users.admin,{id:'li-unproven'},input('synk-linkedin-company',{handle:'synk-im'},url)),{code:'SYNK_EXTERNAL_SOURCE'},url);
  assert.equal(unproven.record(f.users.admin,{id:'li-unproven'},input('synk-linkedin-company',{handle:'synk-im'},'https://www.linkedin.com/company/synk-im/admin/analytics/updates')).created.length,1);
});

test('a legacy Facebook channel whose stored number came from its own public profile address stays registered, and only the Graph number is a Business Suite asset',async t=>{
  const f=await fixture(t),at=new Date().toISOString(),profile='https://www.facebook.com/profile.php?id=61596244437180',publicId='61596244437180',graphId='1439595579236894';
  const catalogRow=accountCatalog.accounts.find(row=>row.id==='yuhokorean-facebook');
  assert.deepEqual([catalogRow.publicUrl,catalogRow.externalId],[profile,graphId],'current catalog shape');
  const variant=(id,fields={})=>({id,platform:'facebook',handle:null,canonicalUrl:profile,externalId:publicId,catalogAccountId:null,legacyId:null,displayName:id,ownerIds:[f.users.admin.id],teamId:null,active:true,status:null,createdAt:at,...fields});
  const legacy=variant('legacy-facebook-profile');
  f.app.store.put('channels',legacy.id,legacy);
  const stored=JSON.stringify(f.app.store.get('channels',legacy.id));
  assert.equal(matchAccount(legacy)?.id,'yuhokorean-facebook');
  const again=await f.request('admin','/api/channels/from-catalog',{accountIds:['yuhokorean-facebook']});
  assert.equal(again.status,200,JSON.stringify(again.body));
  assert.deepEqual(again.body.existing.map(row=>[row.accountId,row.channel.id]),[['yuhokorean-facebook',legacy.id]]);
  assert.equal(f.app.store.all('channels').length,1,'the existing registration is reused, not added');
  const mapped=(await f.request('admin','/api/social/simple')).body.accountMap.accounts.find(row=>row.id==='yuhokorean-facebook');
  assert.deepEqual([mapped.channelId,mapped.operations.collection.connected],[legacy.id,false]);
  const observedAt=new Date(Date.now()-30*60000).toISOString();let count=0;
  const send=(sourceType,sourceUrl,extra={})=>f.request('admin',`/api/channels/${legacy.id}/external-observations`,{sourceType,sourceUrl,observedAt,evidenceSha256:sha('legacy facebook '+(count++)),identity:{accountId:'yuhokorean-facebook',externalId:graphId},observations:[{kind:'account-lifetime',metrics:{followers:3}}],...extra});
  assert.equal((await send('official-export',`https://business.facebook.com/latest/insights/results?asset_id=${graphId}`,{exportFormat:'csv'})).status,201);
  assert.equal((await send('official-export',`https://business.facebook.com/latest/insights/results?asset_id=${publicId}`,{exportFormat:'csv'})).body.code,'SYNK_EXTERNAL_SOURCE','the public profile number is not a Business Suite asset');
  assert.equal((await send('public-page',`${profile}&ref=bookmarks`)).status,201,'the public profile page still works');
  assert.equal(JSON.stringify(f.app.store.get('channels',legacy.id)),stored,'stored fields, including the old public number, stay untouched');
  assert.equal(matchAccount(variant('other-url',{canonicalUrl:'https://www.facebook.com/profile.php?id=61596244437181',externalId:'61596244437181'})),null,'another public profile number is another account');
  assert.equal(matchAccount(variant('other-id',{externalId:'99999999999999'})),null,'a stored number that is not this public profile number must still equal the Graph number');
  assert.throws(()=>planCatalogRegistration({accountIds:['yuhokorean-facebook'],channels:[variant('bound',{catalogAccountId:'pulse-facebook'})]}),error=>error.code==='SYNK_CATALOG_AMBIGUOUS'&&error.details.conflicts[0].reason==='channel-matches-other-account');
  assert.throws(()=>planCatalogRegistration({accountIds:['yuhokorean-facebook'],channels:[variant('twin-a'),variant('twin-b')]}),error=>error.code==='SYNK_CATALOG_AMBIGUOUS'&&error.details.conflicts[0].reason==='multiple-channels');
  assert.equal(matchAccount({platform:'facebook',canonicalUrl:'https://www.facebook.com/profile.php?id=61594726675164',externalId:'1311331138729740'})?.id,'lab-kh-facebook','connected Graph numbers match as before');
  assert.equal(matchAccount({platform:'youtube',canonicalUrl:'https://www.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg',externalId:'UC'+'Z'.repeat(22)}),null,'other platforms still reject a conflicting stored number');
  assert.equal(matchAccount({platform:'youtube',canonicalUrl:'https://www.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg',externalId:'UCmZplYKuNHLPng4iL2AbLLg'})?.id,'lab-youtube');
});

test('the Facebook public number exception needs the same exact public profile on the channel and on that ledger row; a forged legacy id, an equal Graph number and an unknown ledger asset keep the ordinary number rules',async t=>{
  const f=await fixture(t),real=accountCatalog.accounts.find(row=>row.id==='yuhokorean-facebook'),publicId=new URL(real.publicUrl).searchParams.get('id');
  const channel=(id,fields)=>({id,platform:'facebook',handle:null,catalogAccountId:null,legacyId:null,displayName:id,ownerIds:[f.users.admin.id],teamId:null,active:true,status:null,createdAt:new Date().toISOString(),...fields});
  // 원래 경우: 같은 공개 프로필을 가리키는 이 원장 행과의 번호 차이만 넘긴다. 다른 Facebook 원장 행과의 차이는 넘기지 않는다.
  const legacy=channel('legacy-profile',{canonicalUrl:real.publicUrl,externalId:publicId});
  assert.equal(facebookLegacyPublicId(legacy,real),publicId);
  assert.equal(matchAccount(legacy)?.id,'yuhokorean-facebook');
  for(const row of accountCatalog.accounts.filter(row=>row.platform==='facebook'&&row.id!=='yuhokorean-facebook'))assert.equal(facebookLegacyPublicId(legacy,row),null,row.id);
  // 남의 공개 프로필과 그 번호에 이 원장 계정의 legacyId를 붙여도 짝이 생기지 않는다. 등록 주소가 맞아도 저장 번호가 그 주소의 번호가 아니면 마찬가지다.
  const forged=channel('forged',{canonicalUrl:'https://www.facebook.com/profile.php?id=999999999999999',externalId:'999999999999999',legacyId:'yuhokorean-facebook'});
  assert.equal(facebookLegacyPublicId(forged,real),null);
  assert.equal(matchAccount(forged),null,'a legacy id never excuses another public profile and its number');
  assert.equal(matchAccount({...forged,canonicalUrl:real.publicUrl}),null,'nor a stored number that is not the registered profile number');
  // 원장 번호와 같은 번호는 공개 프로필 번호 모양이어도 보통의 번호 일치다. 원장에 Business Suite 번호가 없으면 예외를 쓰지 않고, 채널 저장 번호가 그대로 외부 번호다.
  const same={id:'synthetic-same-number',platform:'facebook',accountStatus:'operating',publicUrl:'https://www.facebook.com/synthetic.same.page',handle:null,externalId:'555000000000001'};
  const unknown={id:'synthetic-unknown-asset',platform:'facebook',accountStatus:'operating',publicUrl:'https://www.facebook.com/profile.php?id=555000000000002',handle:null,externalId:null};
  const catalog={...accountCatalog,accounts:[...accountCatalog.accounts,same,unknown]};
  const sameChannel=channel('same-number',{canonicalUrl:'https://www.facebook.com/profile.php?id=555000000000001',externalId:same.externalId});
  const unknownChannel=channel('unknown-asset',{canonicalUrl:unknown.publicUrl,externalId:'555000000000002'});
  assert.deepEqual([facebookLegacyPublicId(sameChannel,same),facebookLegacyPublicId(unknownChannel,unknown)],[null,null]);
  assert.equal(matchAccount(sameChannel,catalog)?.id,same.id,'an equal Graph number matches even when it is also the public profile number');
  assert.equal(matchAccount(unknownChannel,catalog)?.id,unknown.id,'a ledger row without a Graph number still matches by its address');
  for(const row of [sameChannel,unknownChannel])f.app.store.put('channels',row.id,row);
  const external=createExternalObservations({store:f.app.store,catalog}),observedAt=new Date(Date.now()-30*60000).toISOString();let count=0;
  const record=(row,accountId,assetId)=>external.record(f.users.admin,{id:row.id},{sourceType:'official-export',exportFormat:'csv',sourceUrl:`https://business.facebook.com/latest/insights/results?asset_id=${assetId}`,observedAt,evidenceSha256:sha('facebook number rule '+(count++)),identity:{accountId,externalId:row.externalId},observations:[{kind:'account-lifetime',metrics:{followers:2}}]});
  assert.equal(record(sameChannel,same.id,same.externalId).created.length,1,'the equal number stays a Business Suite asset');
  assert.equal(record(unknownChannel,unknown.id,unknownChannel.externalId).created.length,1,'without a known ledger asset the stored number stays the channel external number');
  for(const [row,accountId] of [[sameChannel,same.id],[unknownChannel,unknown.id]])assert.throws(()=>record(row,accountId,'555000000000009'),{code:'SYNK_EXTERNAL_SOURCE'},row.id);
});

test('Graph page and company numbers reach the catalog without replacing public profile numbers, and API-connected Facebook channels keep their accounts',async t=>{
  // 서버 시험은 함께 배포되는 account-catalog.json만 읽는다. 원장(sns-계정.json)과 생성 규칙의 대조는 저장소 시험 verify-map.test.mjs가 맡는다.
  const entry=id=>accountCatalog.accounts.find(row=>row.id===id);
  const graph={'lab-np-facebook':'1311065102093068','lab-kh-facebook':'1311331138729740','lab-lk-facebook':'1322127544319220','pulse-facebook':'1376159468922910'};
  for(const [id,graphId] of Object.entries(graph))assert.equal(entry(id).externalId,graphId,id);
  assert.deepEqual(['lab-np-facebook','lab-kh-facebook','lab-lk-facebook','pulse-facebook'].map(id=>[entry(id).publicUrl,entry(id).handle]),[['https://www.facebook.com/synklab.np/','@synklab.np'],['https://www.facebook.com/profile.php?id=61594726675164',null],['https://www.facebook.com/profile.php?id=61594274084966',null],['https://www.facebook.com/synkpulse','@synkpulse']],'the shipped catalog keeps the public profile addresses and handles next to the Graph numbers');
  for(const id of ['lab-kh-facebook','lab-lk-facebook'])assert.notEqual(entry(id).externalId,new URL(entry(id).publicUrl).searchParams.get('id'),'a public profile number is not used as the Graph number');
  const f=await fixture(t),at=new Date().toISOString();
  const live=[['live-np','lab-np-facebook','https://www.facebook.com/synklab.np','synklab.np'],['live-kh','lab-kh-facebook','https://www.facebook.com/profile.php?id=61594726675164',null],['live-lk','lab-lk-facebook','https://www.facebook.com/profile.php?id=61594274084966',null]];
  for(const [id,accountId,canonicalUrl,handle] of live){
    f.app.store.put('channels',id,{id,platform:'facebook',canonicalUrl,handle,externalId:graph[accountId],displayName:id,ownerIds:[f.users.admin.id],teamId:null,active:true,status:'success',createdAt:at});
    f.app.store.setSecret('channel:'+id,{accessToken:'synthetic-page-token',connectedBy:f.users.admin.id});
    assert.equal(matchAccount(f.app.store.get('channels',id))?.id,accountId,id);
  }
  const again=await f.request('admin','/api/channels/from-catalog',{accountIds:live.map(row=>row[1])});
  assert.equal(again.status,200,JSON.stringify(again.body));
  assert.deepEqual(again.body.existing.map(row=>[row.accountId,row.channel.id,row.channel.connected]),live.map(([id,accountId])=>[accountId,id,true]));
  assert.equal(f.app.store.all('channels').length,3,'no second channel for an API-connected page');
  const map=(await f.request('admin','/api/social/simple')).body.accountMap;
  for(const [id,accountId] of live){const row=map.accounts.find(item=>item.id===accountId);assert.equal(row.channelId,id,accountId);assert.equal(row.operations.collection.connected,true,accountId);}
  const ids=await f.register(['pulse-facebook']),pulse=ids['pulse-facebook'],observedAt=new Date(Date.now()-30*60000).toISOString();
  const send=(assetId,evidence)=>f.request('admin',`/api/channels/${pulse}/external-observations`,{sourceType:'official-export',exportFormat:'csv',sourceUrl:`https://business.facebook.com/latest/insights/results?asset_id=${assetId}`,observedAt,evidenceSha256:sha(evidence),identity:{accountId:'pulse-facebook',handle:'@synkpulse'},observations:[{kind:'account-lifetime',metrics:{followers:1}}]});
  for(const assetId of ['61596231157441','999999999999999'])assert.equal((await send(assetId,'pulse asset '+assetId)).body.code,'SYNK_EXTERNAL_SOURCE',assetId);
  const right=await send('1376159468922910','pulse verified asset');
  assert.equal(right.status,201,JSON.stringify(right.body));
  assert.equal(right.body.records[0].sourceUrl,'https://business.facebook.com/latest/insights/results','the asset number is checked but not stored');
});

// 11-15 재검수 P1: 새로 등록한 Facebook 행은 원장 externalId(Graph 번호이자 Business Suite 번호)를 저장한다. 공개 프로필 번호는 원장 공개 주소(profile.php?id=)에만 있다.
// 공개 화면에 보이는 그 공개 프로필 번호도 이 계정 값으로 받는다. 다른 번호와 남의 출처 주소는 받지 않는다. 채널 문서에 저장된 다른 주소의 번호와 이름도 계정 값이 되지 않는다. Business Suite 번호는 여전히 Graph 번호만이다.
test('a newly registered Facebook row with a Graph number also accepts its ledger public profile number, and nothing else becomes its identity',async t=>{
  const f=await fixture(t),ids=await f.register(['yuhokorean-facebook']),fb=ids['yuhokorean-facebook'];
  const profile='https://www.facebook.com/profile.php?id=61596244437180',publicId='61596244437180',graphId='1439595579236894',otherId='61596244437181';
  const stored=f.app.store.get('channels',fb);
  assert.deepEqual([stored.externalId,stored.catalogAccountId],[graphId,'yuhokorean-facebook'],'the new row stores the Graph number, not the public profile number');
  const observedAt=new Date(Date.now()-30*60000).toISOString();let count=0;
  const send=(sourceType,sourceUrl,identity,extra={})=>f.request('admin',`/api/channels/${fb}/external-observations`,{sourceType,sourceUrl,observedAt,evidenceSha256:sha('new facebook row '+(count++)),identity:{accountId:'yuhokorean-facebook',...identity},observations:[{kind:'account-lifetime',metrics:{followers:4}}],...extra});
  const accepted=await send('public-page',profile,{externalId:publicId});
  assert.equal(accepted.status,201,JSON.stringify(accepted.body));
  assert.deepEqual([accepted.body.records[0].identity.externalId,accepted.body.records[0].identity.matchedBy],[publicId,['externalId']]);
  for(const identity of [{externalId:graphId},{handle:'Yuhokorean',externalId:publicId}])assert.equal((await send('public-page',profile,identity)).status,201,JSON.stringify(identity));
  for(const identity of [{externalId:otherId},{externalId:'99999999999999'},{handle:'someone.else',externalId:publicId},{handle:'Yuhokorean',externalId:otherId}])assert.equal((await send('public-page',profile,identity)).body.code,'SYNK_EXTERNAL_IDENTITY',JSON.stringify(identity));
  assert.equal((await send('public-page',`https://www.facebook.com/profile.php?id=${otherId}`,{externalId:publicId})).body.code,'SYNK_EXTERNAL_SOURCE','another public profile is another account');
  const suite=assetId=>send('official-export',`https://business.facebook.com/latest/insights/results?asset_id=${assetId}`,{externalId:publicId},{exportFormat:'csv'});
  assert.equal((await suite(publicId)).body.code,'SYNK_EXTERNAL_SOURCE','the public profile number is not a Business Suite asset');
  assert.equal((await suite(graphId)).status,201,'the verified Graph number stays the Business Suite asset');
  assert.deepEqual(f.app.store.get('channels',fb),stored,'recording never rewrites the channel');
  // 같은 원장 행에 묶였지만 채널 문서의 주소가 다른 공개 프로필과 다른 페이지 이름으로 바뀌어 있는 합성 채널이다. 그 주소의 번호와 이름은 화면 속 계정 값으로 받지 않는다.
  const foreignId='61500000000000009',foreignPage='synthetic.other.page';
  f.app.store.put('channels','fb-conflicting-url',{...stored,id:'fb-conflicting-url',canonicalUrl:`https://www.facebook.com/profile.php?id=${foreignId}`,publicUrl:`https://www.facebook.com/${foreignPage}`,handle:null});
  const service=createExternalObservations({store:f.app.store});
  const direct=(sourceUrl,identity)=>service.record(f.users.admin,{id:'fb-conflicting-url'},{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:sha('conflicting live url '+(count++)),identity:{accountId:'yuhokorean-facebook',...identity},observations:[{kind:'account-lifetime',metrics:{followers:5}}]});
  for(const identity of [{externalId:foreignId},{handle:foreignPage}])assert.throws(()=>direct(profile,identity),{code:'SYNK_EXTERNAL_IDENTITY'},JSON.stringify(identity));
  for(const [url,identity] of [[`https://www.facebook.com/profile.php?id=${foreignId}`,{externalId:foreignId}],[`https://www.facebook.com/${foreignPage}`,{handle:foreignPage}]])assert.throws(()=>direct(url,identity),error=>['SYNK_EXTERNAL_SOURCE','SYNK_EXTERNAL_IDENTITY'].includes(error.code),url);
  assert.equal(direct(profile,{externalId:publicId}).created.length,1,'the ledger public profile number still binds this account');
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).filter(row=>row.channelId==='fb-conflicting-url').length,1,'rejected inputs wrote nothing');
});

// 예약 회차의 보관 정리(11-15 검수 P1 두 건). 이 시험 파일은 일반 원천 서버와 배포 후보 서버에서 함께 돈다.
// 배경 작업(BG)을 끄고 작업실 예약만 켠 서버는 예약 회차에서 아무것도 지우지 않는다. BG를 켜도 대기 중이거나 수집 중인 기록, 최근 기록, 시작 시각이 없거나 날짜로 읽히지 않는 기록은 남는다.
// 오래된 끝난 수집 기록을 지우는 확인은 그 정리가 있는 후보 서버에서만 candidate-safety의 후보 전용 확인으로 한다. 기록은 모두 합성이고 원장 파일은 읽지 않는다.
async function scheduledApp(t,background){
  const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED'],before=keys.map(key=>process.env[key]);
  const directory=await mkdtemp(join(tmpdir(),'synk-scheduled-maintenance-'));let app=null;
  t.after(async()=>{await app?.stop();await rm(directory,{recursive:true,force:true});});
  try{process.env[keys[0]]=background;process.env[keys[1]]='1';app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});}
  finally{keys.forEach((key,index)=>{if(before[index]===undefined)delete process.env[key];else process.env[key]=before[index];});}
  return app;
}

test('a scheduler tick with background jobs off deletes nothing, and with them on keeps queued, running, recent and undated runs',async t=>{
  const now=Date.now(),at=new Date(now).toISOString(),ago=days=>new Date(now-days*DAY_MS).toISOString();
  const kept={'queued-old':{status:'queued',startedAt:ago(30)},'running-old':{status:'running',startedAt:ago(30)},'success-recent':{status:'success',startedAt:ago(1),finishedAt:ago(1)},
    'error-null-start':{status:'error',startedAt:null,finishedAt:at},'error-missing-start':{status:'error',finishedAt:at},
    'success-unreadable-start':{status:'success',startedAt:'not-a-date',finishedAt:ago(30)},'success-number-start':{status:'success',startedAt:now-30*DAY_MS,finishedAt:ago(30)}};
  const seed=(app,runs)=>{for(const [id,body] of Object.entries(runs))app.store.put('runs',id,{id,channelId:'synthetic-channel',...body});app.store.put('snapshots','synthetic-expired',{id:'synthetic-expired',postId:'synthetic-post',channelId:'synthetic-channel',views:1,expiresAt:ago(1)});};
  const ids=app=>app.store.all('runs').map(row=>row.id).sort();
  const off=await scheduledApp(t,'0'),offRuns={...kept,'success-old':{status:'success',startedAt:ago(30),finishedAt:ago(30)}};
  seed(off,offRuns);await off.scheduledTick(at);
  assert.deepEqual(ids(off),Object.keys(offRuns).sort(),'workroom scheduling alone never starts deleting runs');
  assert.ok(off.store.get('snapshots','synthetic-expired'),'nor expired records');
  const on=await scheduledApp(t,'1');seed(on,kept);await on.scheduledTick(at);
  assert.equal(on.store.get('snapshots','synthetic-expired'),null,'the background tick did run its expiry cleanup');
  assert.deepEqual(ids(on),Object.keys(kept).sort(),'queued, running, recent and undated runs stay');
});

// 11-15 재검수 P1: SQLite julianday()는 평년 2월 29일, 4월 31일, 24시를 다음 날로 넘겨 읽는다. 이런 시작 시각과 서버가 쓰는 Date.toISOString() 모양이 아닌 시작 시각은 오래된 끝난 기록이어도 남아야 한다.
// 일반 원천 서버는 수집 기록을 지우지 않는다. 그래서 서버 모양 그대로인 오래된 끝난 기록은 모두 남거나 모두 지워지는지까지만 본다. 실제로 지우는 확인은 candidate-safety의 후보 전용 확인이 맡는다.
test('a background tick keeps old finished runs whose start is an impossible or non-canonical time, and may remove only the canonical old ones',async t=>{
  const now=Date.now(),at=new Date(now).toISOString();
  const kept={'success-feb29-nonleap':{status:'success',startedAt:'2025-02-29T00:00:00.000Z'},'error-apr31':{status:'error',startedAt:'2025-04-31T12:00:00.000Z'},'interrupted-hour24':{status:'interrupted',startedAt:'2025-03-10T24:00:00.000Z'},
    'success-month13':{status:'success',startedAt:'2025-13-01T00:00:00.000Z'},'success-second60':{status:'success',startedAt:'2025-03-10T23:59:60.000Z'},
    'success-no-millis':{status:'success',startedAt:'2025-03-10T00:00:00Z'},'success-offset':{status:'success',startedAt:'2025-03-10T09:00:00.000+09:00'},'success-space':{status:'success',startedAt:'2025-03-10 00:00:00.000Z'},'success-lower-z':{status:'success',startedAt:'2025-03-10T00:00:00.000z'}};
  const canonicalOld={'success-leap-day-old':{status:'success',startedAt:'2024-02-29T00:00:00.000Z'},'error-millis-old':{status:'error',startedAt:'2025-06-15T12:34:56.001Z'},'interrupted-old':{status:'interrupted',startedAt:new Date(now-20*DAY_MS).toISOString()}};
  const runs={...kept,...canonicalOld},all=Object.keys(runs).sort();
  const tick=async background=>{const app=await scheduledApp(t,background);for(const [id,body] of Object.entries(runs))app.store.put('runs',id,{id,channelId:'synthetic-channel',...body});await app.scheduledTick(at);return app.store.all('runs').map(row=>row.id).sort();};
  assert.deepEqual(await tick('0'),all,'background off: nothing is deleted');
  const remaining=await tick('1'),removed=all.filter(id=>!remaining.includes(id));
  assert.deepEqual(remaining.filter(id=>Object.hasOwn(kept,id)),Object.keys(kept).sort(),'every impossible or non-canonical start stays');
  assert.ok(removed.length===0||removed.join()===Object.keys(canonicalOld).sort().join(),`only the whole set of canonical old finished runs may go: ${removed.join(', ')}`);
});

test('older external observations never roll back post metadata; an older day only adds its own snapshot',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-tistory']),tistory=ids['shift-tistory'],path=`/api/channels/${tistory}/external-observations`;
  const day=shift(kstDay(Date.now()),-1),publishedAt=`${shift(day,-3)}T09:00:00+09:00`;
  const send=(observedAt,sourceType,title,views,evidence)=>f.request('admin',path,{sourceType,sourceUrl:'https://yuhobuilds.tistory.com/manage/statistics',observedAt,evidenceSha256:sha(evidence),identity:{accountId:'shift-tistory',handle:'yuhobuilds.tistory.com'},observations:[{kind:'post-lifetime',post:{externalId:'15',url:'https://yuhobuilds.tistory.com/15',publishedAt,title},metrics:{views}}]});
  assert.equal((await send(`${day}T14:00:00+09:00`,'creator-screen','Afternoon title',140,'late capture')).status,201);
  const latest=f.app.store.get('posts',`${tistory}:15`);
  const early=await send(`${day}T10:00:00+09:00`,'official-export','Morning title',100,'early export');
  assert.equal(early.status,201);assert.equal(early.body.records[0].projection.state,'not-projected');
  assert.deepEqual(f.app.store.get('posts',`${tistory}:15`),latest,'an older same-day observation changes no post metadata');
  assert.equal(f.app.store.get('snapshots',`${tistory}:15:${day}`).views,140);
  assert.equal((await send(`${shift(day,-1)}T12:00:00+09:00`,'creator-screen','Old title',90,'prior day capture')).status,201);
  assert.equal(f.app.store.get('snapshots',`${tistory}:15:${shift(day,-1)}`).views,90,'an older day keeps its own snapshot');
  assert.deepEqual(f.app.store.get('posts',`${tistory}:15`),latest,'and still leaves the latest metadata alone');
});

test('a legacy binding to another ledger account is a conflict even when matchAccount would pick this account',async t=>{
  const f=await fixture(t);
  f.app.store.put('channels','legacy-x',{id:'legacy-x',platform:'youtube',externalId:'UCmZplYKuNHLPng4iL2AbLLg',canonicalUrl:'https://www.youtube.com/channel/UCmZplYKuNHLPng4iL2AbLLg',legacyId:'pulse-youtube',ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected',createdAt:new Date().toISOString()});
  for(const accountId of ['lab-youtube','pulse-youtube']){
    const result=await f.request('admin','/api/channels/from-catalog',{accountIds:[accountId,'shift-tistory']});
    assert.equal(result.status,409);assert.equal(result.body.code,'SYNK_CATALOG_AMBIGUOUS');
    assert.deepEqual(result.body.details.conflicts.map(row=>[row.accountId,row.channelIds.join()]),[[accountId,'legacy-x']]);
  }
  assert.deepEqual(f.app.store.all('channels').map(row=>row.id),['legacy-x'],'nothing was added');
});

test('non-API channels never overwrite posts or snapshots that came from another source',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-tistory']),tistory=ids['shift-tistory'];
  const observedMs=Date.now()-60*60000,day=kstDay(observedMs),publishedAt=new Date(observedMs-3*DAY_MS).toISOString();
  const post={id:`${tistory}:15`,channelId:tistory,externalId:'15',title:'Imported',url:'https://yuhobuilds.tistory.com/15',publishedDate:kstDay(Date.parse(publishedAt)),publishedAt,source:'legacy-import'};
  const snapshot={id:`${tistory}:16:${day}`,postId:`${tistory}:16`,date:day,checkedAt:new Date(observedMs-60000).toISOString(),source:'legacy-import',views:50};
  f.app.store.put('posts',post.id,post);f.app.store.put('snapshots',snapshot.id,snapshot);
  const row=externalId=>({kind:'post-lifetime',post:{externalId,url:`https://yuhobuilds.tistory.com/${externalId}`,publishedAt},metrics:{views:999}});
  const result=await f.request('admin',`/api/channels/${tistory}/external-observations`,{sourceType:'creator-screen',sourceUrl:'https://yuhobuilds.tistory.com/manage/statistics',observedAt:new Date(observedMs).toISOString(),evidenceSha256:sha('other source guard'),identity:{accountId:'shift-tistory',handle:'yuhobuilds.tistory.com'},observations:[row('15'),row('16')]});
  assert.equal(result.status,201,JSON.stringify(result.body));
  assert.deepEqual(result.body.records.map(record=>record.projection.reason),['existing-post-other-source','existing-snapshot-other-source']);
  assert.deepEqual(f.app.store.get('posts',post.id),post);assert.deepEqual(f.app.store.get('snapshots',snapshot.id),snapshot);
  assert.equal(f.app.store.get('posts',`${tistory}:16`),null);assert.equal(f.app.store.all('snapshots').length,1);
});

test('registered Telegram /s/ previews and Facebook /people/ pages keep their real owner without trusting handles or display names',async t=>{
  const f=await fixture(t),observedAt=new Date(Date.now()-30*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString(),pageId='61500000000000001';let count=0;
  const changes={'lab-telegram':{publicUrl:'https://t.me/s/synkmn',handle:'@synkmn'},'lab-uz-telegram':{publicUrl:'https://t.me/s/synklab_uz',handle:'@other_alias'},'lab-np-facebook':{publicUrl:`https://www.facebook.com/people/Synthetic-Page-Name/${pageId}/`,handle:null,externalId:'1999999999999999'}};
  const service=createExternalObservations({store:f.app.store,catalog:{...accountCatalog,accounts:accountCatalog.accounts.map(row=>changes[row.id]?{...row,...changes[row.id]}:row)}});
  const seeded={tg:['lab-telegram','telegram',{handle:'@synkmn'}],alias:['lab-uz-telegram','telegram',{handle:'@other_alias'}],fb:['lab-np-facebook','facebook',{externalId:'1999999999999999'}]};
  for(const [id,[accountId,platform]] of Object.entries(seeded))f.app.store.put('channels',id,{id,platform,publicUrl:changes[accountId].publicUrl,canonicalUrl:null,handle:null,catalogAccountId:accountId,ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected'});
  const record=(id,sourceUrl,observations=[{kind:'account-lifetime',metrics:{followers:7}}])=>service.record(f.users.admin,{id},{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:sha('owner shape '+(count++)),identity:{accountId:seeded[id][0],...seeded[id][2]},observations});
  const post=(externalId,url)=>[{kind:'post-lifetime',post:{externalId,url,publishedAt},metrics:{views:4}}];
  const own={tg:'https://t.me/s/synkmn',alias:'https://t.me/s/synklab_uz',fb:`https://www.facebook.com/people/Synthetic-Page-Name/${pageId}/`};
  for(const [id,url,rows] of [['tg','https://t.me/s/synkmn'],['tg','https://t.me/synkmn'],['tg',own.tg,post('557','https://t.me/synkmn/557')],['alias',own.alias],['fb',own.fb],['fb',`https://www.facebook.com/people/Renamed-Page/${pageId}`],['fb',own.fb,post('5',`https://www.facebook.com/${pageId}/posts/5`)]])assert.equal(record(id,url,rows).created.length,1,url);
  for(const [id,url] of [['tg','https://t.me/s/othertips'],['tg','https://t.me/s/synkmn/557'],['tg','https://t.me/s'],['alias','https://t.me/other_alias'],['alias','https://t.me/s/other_alias'],['fb','https://www.facebook.com/people/Synthetic-Page-Name/61500000000000002/'],['fb',`https://www.facebook.com/people/Synthetic-Page-Name/${pageId}/about`],['fb',`https://www.facebook.com/people/Synthetic-Page-Name/${pageId}/insights`],['fb','https://www.facebook.com/people/Synthetic-Page-Name/abc/']])assert.throws(()=>record(id,url),{code:'SYNK_EXTERNAL_SOURCE'},url);
  for(const [id,url,externalId] of [['tg','https://t.me/othertips/557','557'],['alias','https://t.me/other_alias/5','5'],['fb','https://www.facebook.com/61500000000000002/posts/5','5']])assert.throws(()=>record(id,own[id],post(externalId,url)),{code:'SYNK_EXTERNAL_POST'},url);
});

test('Kakao uses the exact registered encoded channel key on profile, screen and post addresses, never the display handle, and Naver PostView keeps only its identity query',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-kakao','shift-naverblog']),observedAt=new Date(Date.now()-30*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString();let count=0;
  const send=(accountId,sourceType,sourceUrl,observations=[{kind:'account-lifetime',metrics:{followers:2}}])=>f.request('admin',`/api/channels/${ids[accountId]}/external-observations`,{sourceType,sourceUrl,observedAt,evidenceSha256:sha('owner key '+(count++)),identity:{accountId,handle:'synkshift'},observations});
  const post=url=>[{kind:'post-lifetime',post:{externalId:'12',url,publishedAt},metrics:{views:3}}];
  for(const [sourceType,url,rows] of [['public-page','https://pf.kakao.com/_kvlrX'],['creator-screen','https://business.kakao.com/space/10671395/channel/_kvlrX/statistics/post'],['public-page','https://pf.kakao.com/_kvlrX',post('https://pf.kakao.com/_kvlrX/12')]])assert.equal((await send('shift-kakao',sourceType,url,rows)).status,201,url);
  for(const [sourceType,url] of [['public-page','https://pf.kakao.com/_kvlrx'],['public-page','https://pf.kakao.com/synkshift'],['creator-screen','https://business.kakao.com/space/10671395/channel/_kvlrx/statistics/post'],['creator-screen','https://business.kakao.com/space/10671395/channel/synkshift/statistics/post']])assert.equal((await send('shift-kakao',sourceType,url)).body.code,'SYNK_EXTERNAL_SOURCE',url);
  for(const url of ['https://pf.kakao.com/_kvlrx/12','https://pf.kakao.com/synkshift/12'])assert.equal((await send('shift-kakao','public-page','https://pf.kakao.com/_kvlrX',post(url))).body.code,'SYNK_EXTERNAL_POST',url);
  const postView=await send('shift-naverblog','public-page','https://blog.naver.com/PostView.naver?blogId=synkshift&logNo=224000000001&trackingCode=rss');
  assert.equal(postView.status,201,JSON.stringify(postView.body));
  assert.equal(postView.body.records[0].sourceUrl,'https://blog.naver.com/PostView.naver?blogId=synkshift&logNo=224000000001');
  assert.equal((await send('shift-naverblog','public-page','https://blog.naver.com/PostView.naver?blogId=someone&logNo=224000000001')).body.code,'SYNK_EXTERNAL_SOURCE');
});

test('ID-less registered channels share one identity for public pages, creator screens and post addresses',async t=>{
  const f=await fixture(t),observedAt=new Date(Date.now()-30*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString(),xhsId='6ab10807000000000301d12f',note='6731a2b3000000001b012345';let count=0;
  const strip={'lab-cn-xiaohongshu':{externalId:null},'politics-youtube':{externalId:null},'synk-linkedin-company':{externalId:null,handle:'SYNK'}};
  const service=createExternalObservations({store:f.app.store,catalog:{...accountCatalog,accounts:accountCatalog.accounts.map(row=>strip[row.id]?{...row,...strip[row.id]}:row)}});
  const seeded={xhs:['lab-cn-xiaohongshu','xiaohongshu',`https://www.rednote.com/user/profile/${xhsId}`,'rednote ID 94512834104'],yt:['politics-youtube','youtube','https://www.youtube.com/channel/UCyzxe5mPrqvAzseYzyyKeoQ','@몽글몽글정치'],company:['synk-linkedin-company','linkedin','https://www.linkedin.com/company/synk-im/','SYNK']};
  for(const [id,[accountId,platform,publicUrl]] of Object.entries(seeded))f.app.store.put('channels',id,{id,platform,publicUrl,canonicalUrl:null,handle:null,catalogAccountId:accountId,ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected'});
  const record=(id,sourceType,sourceUrl,observations=[{kind:'account-lifetime',metrics:{followers:6}}])=>service.record(f.users.admin,{id},{sourceType,sourceUrl,observedAt,evidenceSha256:sha('shared identity '+(count++)),identity:{accountId:seeded[id][0],handle:seeded[id][3]},observations});
  const xhsPost=profile=>[{kind:'post-lifetime',post:{externalId:note,url:`https://www.rednote.com/user/profile/${profile}/${note}`,publishedAt},metrics:{views:8}}];
  assert.equal(record('xhs','creator-screen','https://creator.rednote.com/new/note-manager',xhsPost(xhsId)).created.length,1);
  for(const profile of ['7aa00000000000000000000a','6aB10807000000000301d12f'])assert.throws(()=>record('xhs','creator-screen','https://creator.rednote.com/new/note-manager',xhsPost(profile)),{code:'SYNK_EXTERNAL_POST'},profile);
  for(const [id,url] of [['yt','https://studio.youtube.com/channel/UCyzxe5mPrqvAzseYzyyKeoQ/analytics/tab-overview'],['company','https://www.linkedin.com/company/synk-im/admin/analytics/updates']])assert.equal(record(id,'creator-screen',url).created.length,1,url);
  for(const [id,url] of [['yt','https://studio.youtube.com/channel/UCYzxe5mPrqvAzseYzyyKeoQ/analytics'],['company','https://www.linkedin.com/company/143833958/admin/analytics/updates'],['company','https://www.linkedin.com/company/other-company/admin/analytics/updates']])assert.throws(()=>record(id,'creator-screen',url),{code:'SYNK_EXTERNAL_SOURCE'},url);
  assert.equal(record('yt','public-page','https://m.youtube.com/channel/UCyzxe5mPrqvAzseYzyyKeoQ').created.length,1,'official mobile host alias');
  assert.throws(()=>record('yt','public-page','https://youtu.be/@몽글몽글정치'),{code:'SYNK_EXTERNAL_SOURCE'},'short video host is not a profile');
});

test('Behance and Brunch screen addresses must be a statistics route of this account, not another owner or a gallery page',async t=>{
  const f=await fixture(t),ids=await f.register(['yuhobuilds-behance','shift-brunch']),observedAt=new Date(Date.now()-30*60000).toISOString();let count=0;
  const send=(accountId,handle,sourceUrl)=>f.request('admin',`/api/channels/${ids[accountId]}/external-observations`,{sourceType:'creator-screen',sourceUrl,observedAt,evidenceSha256:sha('screen owner '+(count++)),identity:{accountId,handle},observations:[{kind:'account-lifetime',metrics:{followers:1}}]});
  for(const [accountId,handle,url] of [['yuhobuilds-behance','yuhobuilds','https://www.behance.net/yuhobuilds/insights'],['yuhobuilds-behance','yuhobuilds','https://www.behance.net/insights'],['shift-brunch','양유호','https://brunch.co.kr/@@j0BM/statistics'],['shift-brunch','양유호','https://brunch.co.kr/stats']])assert.equal((await send(accountId,handle,url)).status,201,url);
  for(const [accountId,handle,url] of [['yuhobuilds-behance','yuhobuilds','https://www.behance.net/someone_else/insights'],['yuhobuilds-behance','yuhobuilds','https://www.behance.net/gallery/12345678/insights'],['shift-brunch','양유호','https://brunch.co.kr/@someone_else/stats'],['shift-brunch','양유호','https://brunch.co.kr/@@j0bm/statistics']])assert.equal((await send(accountId,handle,url)).body.code,'SYNK_EXTERNAL_SOURCE',url);
});

test('Facebook keeps the profile number in the saved public address and checks post owners by page name, registered profile number or page number',async t=>{
  const f=await fixture(t),ids=await f.register(['lab-kh-facebook','pulse-facebook']),observedAt=new Date(Date.now()-30*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString();let count=0;
  const who={kh:{accountId:'lab-kh-facebook',externalId:'1311331138729740'},pulse:{accountId:'pulse-facebook',handle:'@synkpulse'}},own={kh:'https://www.facebook.com/profile.php?id=61594726675164',pulse:'https://www.facebook.com/synkpulse'};
  const send=(key,sourceUrl,observations=[{kind:'account-lifetime',metrics:{followers:9}}])=>f.request('admin',`/api/channels/${ids[who[key].accountId]}/external-observations`,{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:sha('facebook '+(count++)),identity:who[key],observations});
  const post=(key,url,externalId)=>send(key,own[key],[{kind:'post-lifetime',post:{externalId,url,publishedAt},metrics:{views:2}}]);
  const saved=await send('kh','https://www.facebook.com/profile.php?id=61594726675164&__tn__=kC-R&ref=bookmarks');
  assert.equal(saved.status,201,JSON.stringify(saved.body));
  assert.equal(saved.body.records[0].sourceUrl,'https://www.facebook.com/profile.php?id=61594726675164','the profile number stays and other query values are dropped');
  assert.equal((await send('pulse',own.pulse)).status,201);
  assert.equal((await send('kh','https://www.facebook.com/profile.php?id=61594726675165')).body.code,'SYNK_EXTERNAL_SOURCE');
  for(const [key,url,externalId] of [['pulse','https://www.facebook.com/synkpulse/posts/pfbid02abc','pfbid02abc'],['pulse','https://www.facebook.com/1376159468922910/posts/123','123'],['kh','https://www.facebook.com/61594726675164/posts/124','124'],['kh','https://www.facebook.com/1311331138729740/videos/456','456']])assert.equal((await post(key,url,externalId)).status,201,url);
  for(const [key,url,externalId] of [['pulse','https://www.facebook.com/other.account/posts/12345','12345'],['pulse','https://www.facebook.com/999999999/posts/123','123'],['kh','https://www.facebook.com/permalink.php?story_fbid=789&id=123','789']])assert.equal((await post(key,url,externalId)).body.code,'SYNK_EXTERNAL_POST',url);
});

test('registered profile keys keep identifier case, and RedNote profile pages accept only the note-number shape below the owned profile',async t=>{
  const f=await fixture(t),observedAt=new Date(Date.now()-30*60000).toISOString(),ytId='UCyzxe5mPrqvAzseYzyyKeoQ',xhsId='6ab10807000000000301d12f',note='6731a2b3000000001b012345';let count=0;
  const service=createExternalObservations({store:f.app.store,catalog:{...accountCatalog,accounts:accountCatalog.accounts.map(row=>['politics-youtube','lab-cn-xiaohongshu'].includes(row.id)?{...row,externalId:null}:row)}});
  const channel=(id,platform,accountId,publicUrl,externalId)=>f.app.store.put('channels',id,{id,platform,publicUrl,canonicalUrl:null,handle:null,...(externalId?{externalId}:{}),catalogAccountId:accountId,ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected'});
  channel('yt-registered','youtube','politics-youtube',`https://www.youtube.com/channel/${ytId}`);
  channel('yt-known','youtube','politics-youtube',`https://www.youtube.com/channel/${ytId}`,ytId);
  channel('xhs-registered','xiaohongshu','lab-cn-xiaohongshu',`https://www.rednote.com/user/profile/${xhsId}`);
  channel('xhs-known','xiaohongshu','lab-cn-xiaohongshu',`https://www.rednote.com/user/profile/${xhsId}`,xhsId);
  const identity={youtube:{accountId:'politics-youtube',handle:'@몽글몽글정치'},xiaohongshu:{accountId:'lab-cn-xiaohongshu',handle:'rednote ID 94512834104'}};
  const record=(id,platform,sourceUrl)=>service.record(f.users.admin,{id},{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:sha('case check '+(count++)),identity:identity[platform],observations:[{kind:'account-lifetime',metrics:{followers:5}}]});
  for(const id of ['yt-registered','yt-known']){
    assert.equal(record(id,'youtube',`https://www.youtube.com/channel/${ytId}`).created.length,1,id);
    assert.throws(()=>record(id,'youtube','https://www.youtube.com/channel/UCYzxe5mPrqvAzseYzyyKeoQ'),{code:'SYNK_EXTERNAL_SOURCE'},id+' one-letter case change');
  }
  for(const id of ['xhs-registered','xhs-known']){
    for(const url of [`https://www.rednote.com/user/profile/${xhsId}`,`https://www.rednote.com/user/profile/${xhsId}/${note}`])assert.equal(record(id,'xiaohongshu',url).created.length,1,id+' '+url);
    for(const url of [`https://www.rednote.com/user/profile/${xhsId}/invalid-tab`,`https://www.rednote.com/user/profile/${xhsId}/${note}/extra`,'https://www.rednote.com/user/profile/6aB10807000000000301d12f',`https://www.rednote.com/user/profile/${xhsId}/${note.toUpperCase()}`])assert.throws(()=>record(id,'xiaohongshu',url),{code:'SYNK_EXTERNAL_SOURCE'},id+' '+url);
  }
});

test('public-page accepts registered legacy YouTube addresses, the shared public tabs and the LinkedIn company posts tab, and nothing looser',async t=>{
  const f=await fixture(t),observedAt=new Date(Date.now()-30*60000).toISOString(),channelId='UC'+'A'.repeat(22);let count=0;
  const service=createExternalObservations({store:f.app.store,catalog:{...accountCatalog,accounts:accountCatalog.accounts.map(row=>row.id==='yuhobuilds-youtube'?{...row,publicUrl:'https://www.youtube.com/c/SynkLegacyName',handle:'@synklegacy',externalId:channelId}:row)}});
  f.app.store.put('channels','legacy-yt',{id:'legacy-yt',platform:'youtube',publicUrl:'https://www.youtube.com/c/SynkLegacyName',canonicalUrl:null,handle:null,catalogAccountId:'yuhobuilds-youtube',ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected'});
  f.app.store.put('channels','company',{id:'company',platform:'linkedin',publicUrl:'https://www.linkedin.com/company/synk-im/',canonicalUrl:null,handle:null,catalogAccountId:'synk-linkedin-company',ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected'});
  const identity={'legacy-yt':{accountId:'yuhobuilds-youtube',externalId:channelId},company:{accountId:'synk-linkedin-company',handle:'synk-im'}};
  const record=(id,sourceUrl)=>service.record(f.users.admin,{id},{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:sha('public tab '+(count++)),identity:identity[id],observations:[{kind:'account-lifetime',metrics:{followers:4}}]});
  for(const [id,url] of [['legacy-yt','https://www.youtube.com/c/SynkLegacyName'],['legacy-yt','https://www.youtube.com/c/SynkLegacyName/playlists'],['legacy-yt','https://www.youtube.com/@synklegacy/playlists'],['legacy-yt',`https://www.youtube.com/channel/${channelId}/playlists`],['company','https://www.linkedin.com/company/synk-im/posts/?feedView=all'],['company','https://www.linkedin.com/company/143833958/posts/']])assert.equal(record(id,url).created.length,1,url);
  for(const [id,url] of [['legacy-yt','https://www.youtube.com/c/OtherLegacyName'],['legacy-yt','https://www.youtube.com/user/SynkLegacyName'],['legacy-yt','https://www.youtube.com/c/synklegacy'],['legacy-yt','https://www.youtube.com/c/SynkLegacyName/analytics'],['legacy-yt','https://www.youtube.com/@synklegacy/editing'],['legacy-yt',`https://www.youtube.com/channel/${channelId}/playlists/extra`],['company','https://www.linkedin.com/company/synk-im/admin/'],['company','https://www.linkedin.com/company/synk-im/posts/extra'],['company','https://www.linkedin.com/company/other-company/posts/'],['company','https://www.linkedin.com/company/synk-im/jobs/']])assert.throws(()=>record(id,url),{code:'SYNK_EXTERNAL_SOURCE'},url);
});

test('public-page accepts the exact registered multi-part profile without an API number, and rejects other accounts and private tabs',async t=>{
  const f=await fixture(t),observedAt=new Date(Date.now()-30*60000).toISOString();let count=0;
  const strip={'lab-ru-rutube':{externalId:null},'lab-cn-xiaohongshu':{externalId:null},'politics-youtube':{externalId:null},'synk-linkedin-company':{externalId:null,handle:'SYNK'}};
  const service=createExternalObservations({store:f.app.store,catalog:{...accountCatalog,accounts:accountCatalog.accounts.map(row=>strip[row.id]?{...row,...strip[row.id]}:row)}});
  const seeded={rutube:['lab-ru-rutube','rutube','https://rutube.ru/channel/81398864/','synthetic-rutube'],rednote:['lab-cn-xiaohongshu','xiaohongshu','https://www.rednote.com/user/profile/6ab10807000000000301d12f','rednote ID 94512834104'],politics:['politics-youtube','youtube','https://www.youtube.com/channel/UCyzxe5mPrqvAzseYzyyKeoQ','@몽글몽글정치'],company:['synk-linkedin-company','linkedin','https://www.linkedin.com/company/synk-im/','SYNK']};
  for(const [id,[accountId,platform,publicUrl,handle]] of Object.entries(seeded))f.app.store.put('channels',id,{id,platform,publicUrl,canonicalUrl:null,handle:id==='rutube'?handle:null,catalogAccountId:accountId,ownerIds:[f.users.admin.id],teamId:null,active:true,status:'not-connected'});
  const record=(id,sourceUrl)=>service.record(f.users.admin,{id},{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:sha('registered profile '+(count++)),identity:{accountId:seeded[id][0],handle:seeded[id][3]},observations:[{kind:'account-lifetime',metrics:{followers:3}}]});
  for(const [id,url] of [['rutube','https://rutube.ru/channel/81398864/'],['rednote','https://www.rednote.com/user/profile/6ab10807000000000301d12f'],['politics','https://www.youtube.com/channel/UCyzxe5mPrqvAzseYzyyKeoQ'],['politics','https://www.youtube.com/channel/UCyzxe5mPrqvAzseYzyyKeoQ/videos'],['company','https://www.linkedin.com/company/synk-im/']])assert.equal(record(id,url).created.length,1,url);
  for(const [id,url] of [['rutube','https://rutube.ru/channel/99999999/'],['rednote','https://www.rednote.com/user/profile/7aa00000000000000000000a'],['politics','https://www.youtube.com/channel/UCyzxe5mPrqvAzseYzyyKeoQ/analytics'],['politics','https://www.youtube.com/channel/UCyzxe5mPrqvAzseYzyyKeoQ/editing'],['politics',`https://www.youtube.com/channel/UC${'B'.repeat(22)}`],['company','https://www.linkedin.com/company/other-company/'],['company','https://www.linkedin.com/company/synk-im/admin/analytics/updates']])assert.throws(()=>record(id,url),{code:'SYNK_EXTERNAL_SOURCE'},url);
});

test('the external summary takes source, kind, numbers and time from one observation and keeps the newest time of any kind separately',async t=>{
  const f=await fixture(t),ids=await f.register(['lab-uz-telegram']),telegram=ids['lab-uz-telegram'],path=`/api/channels/${telegram}/external-observations`;
  const olderAt=new Date(Date.now()-3*3600000).toISOString(),newerAt=new Date(Date.now()-20*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString(),identity={accountId:'lab-uz-telegram',handle:'@synklab_uz'};
  const older=await f.request('admin',path,{sourceType:'public-page',sourceUrl:'https://t.me/s/synklab_uz',observedAt:olderAt,evidenceSha256:sha('older public followers'),identity,observations:[{kind:'account-lifetime',metrics:{followers:128}}]});
  assert.equal(older.status,201);
  const newer=await f.request('admin',path,{sourceType:'creator-screen',sourceUrl:'https://web.telegram.org/k/',observedAt:newerAt,evidenceSha256:sha('newer creator post'),identity,observations:[{kind:'post-lifetime',post:{externalId:'12',url:'https://t.me/synklab_uz/12',publishedAt},metrics:{views:345}}]});
  assert.equal(newer.status,201);
  const check=(ext,where)=>{
    assert.deepEqual([ext.kind,ext.sourceType,ext.metrics.followers,ext.lastObservedAt,ext.observedAt,ext.lastObservedAtAnyKind],['account-lifetime','public-page',128,olderAt,olderAt,newerAt],where);
    assert.equal(ext.recordId,older.body.records[0].id,where);assert.notEqual(ext.recordId,newer.body.records[0].id,where);
    assert.deepEqual([ext.byKind['post-lifetime'].sourceType,ext.byKind['post-lifetime'].observedAt,ext.byKind['account-lifetime'].observedAt],['creator-screen',newerAt,olderAt],where);
  };
  check((await f.request('admin','/api/state')).body.channels.find(row=>row.id===telegram).externalCollection,'state');
  const simple=(await f.request('admin','/api/social/simple')).body;
  check(simple.accounts.find(row=>row.channelId===telegram).externalCollection,'social account');
  check(simple.accountMap.accounts.find(row=>row.id==='lab-uz-telegram').operations.externalCollection,'account map');
  check((await f.request('admin',path)).body.externalCollection,'detail read');
});

test('public-page accepts only this account public profile or its own post, and Naver Clip keeps account totals without post URLs',async t=>{
  const f=await fixture(t),ids=await f.register(['lab-telegram','lab-uz-telegram','yuhobuilds-behance','yuhobuilds-x','lab-jp-instagram','lab-uz-instagram','yuhobuilds-naver-clip']);
  const observedAt=new Date(Date.now()-30*60000).toISOString();let count=0;
  const send=(accountId,handle,sourceUrl,observations=[{kind:'account-lifetime',metrics:{followers:0,posts:0}}])=>f.request('admin',`/api/channels/${ids[accountId]}/external-observations`,{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:sha('public page '+(count++)),identity:{accountId,handle},observations});
  const verified=[['lab-telegram','@synkmn','https://t.me/s/synkmn'],['lab-uz-telegram','@synklab_uz','https://t.me/s/synklab_uz'],['yuhobuilds-behance','yuhobuilds','https://www.behance.net/yuhobuilds/info'],['yuhobuilds-x','@synk_pulse','https://x.com/synk_pulse'],['lab-jp-instagram','synk.jp','https://www.instagram.com/synk.jp/'],['lab-uz-instagram','synklab.uz','https://www.instagram.com/synklab.uz/'],['yuhobuilds-naver-clip','@yuhobuilds','https://clip.naver.com/@yuhobuilds?tab=all&filter=all']];
  for(const [accountId,handle,url] of verified)assert.equal((await send(accountId,handle,url)).status,201,url);
  assert.equal((await send('yuhobuilds-x','@synk_pulse','https://x.com/synk_pulse/status/1888000000000000001')).status,201,'own post under the registered handle');
  const rejected=[['lab-jp-instagram','synk.jp','https://www.instagram.com/synklab.uz/'],['lab-jp-instagram','synk.jp','https://www.instagram.com/accounts/insights/'],['yuhobuilds-behance','yuhobuilds','https://www.behance.net/someone/info'],['yuhobuilds-behance','yuhobuilds','https://www.behance.net/yuhobuilds/insights'],['yuhobuilds-x','@synk_pulse','https://x.com/someone'],['yuhobuilds-x','@synk_pulse','https://x.com/someone/status/1888000000000000001'],['yuhobuilds-x','@synk_pulse','https://x.com/i/account_analytics'],['yuhobuilds-naver-clip','@yuhobuilds','https://clip.naver.com/@someone'],['lab-telegram','@synkmn','https://t.me/s/synklab_uz']];
  for(const [accountId,handle,url] of rejected)assert.equal((await send(accountId,handle,url)).body.code,'SYNK_EXTERNAL_SOURCE',url);
  const clip=ids['yuhobuilds-naver-clip'],stored=f.app.store.all(EXTERNAL_OBSERVATION_KIND).find(row=>row.channelId===clip);
  assert.deepEqual([stored.kind,stored.metrics,stored.sourceUrl],['account-lifetime',{followers:0,posts:0},'https://clip.naver.com/@yuhobuilds'],'explicit zeros stay zeros and the query is dropped');
  for(const url of ['https://clip.naver.com/@yuhobuilds/clip/123456','https://clip.naver.com/@yuhobuilds?tab=all&filter=all'])assert.equal((await send('yuhobuilds-naver-clip','@yuhobuilds','https://clip.naver.com/@yuhobuilds',[{kind:'post-lifetime',post:{externalId:'123456',url,publishedAt:new Date(Date.now()-DAY_MS).toISOString()},metrics:{views:1}}])).body.code,'SYNK_EXTERNAL_POST',url);
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).filter(row=>row.channelId===clip).length,1);
});

test('external writes are admin-only with CSRF; reads and analytics show only channels the reader can see',async t=>{
  const f=await fixture(t),ids=await f.register(['shift-tistory','shift-pinterest']);
  const tistory=ids['shift-tistory'],pinterest=ids['shift-pinterest'],path=id=>`/api/channels/${id}/external-observations`;
  assert.equal((await f.request('member',path(tistory),tistoryObservation())).status,403,'only admins record external values');
  assert.equal((await f.request('viewer',path(tistory),tistoryObservation())).status,403);
  assert.equal((await f.request('admin',path(tistory),tistoryObservation(),{csrf:'wrong'})).status,403);
  assert.equal((await f.request(null,path(tistory),tistoryObservation())).status,403);
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).length,0);
  assert.equal((await f.request('admin',`/api/channels/${tistory}/owners`,{userIds:[f.users.member.id]})).status,200);
  assert.equal((await f.request('member',path(tistory),tistoryObservation())).status,403,'an owner who is not an admin cannot record either');
  assert.equal(f.app.store.all(EXTERNAL_OBSERVATION_KIND).length,0);assert.equal(f.app.store.all('posts').length,0);assert.equal(f.app.store.get('externalCollectionStates',tistory),null);
  assert.throws(()=>createExternalObservations({store:f.app.store}).record(f.users.member,{id:tistory},tistoryObservation()),{code:'SYNK_EXTERNAL_FORBIDDEN'});
  assert.equal((await f.request('admin',path(tistory),tistoryObservation())).status,201);
  assert.equal((await f.request('admin',path(pinterest),pinterestObservation())).status,201);
  assert.equal((await f.request('other',path(tistory),tistoryObservation({evidenceSha256:sha('other crew capture')}))).status,403);
  assert.equal((await f.request('other',path(tistory))).status,404);
  assert.equal((await f.request('member',path(pinterest))).status,404);
  const own=await f.request('member',path(tistory)+'?kind=account-period');
  assert.equal(own.status,200);
  assert.deepEqual(own.body.observations.map(row=>row.kind),['account-period']);assert.equal(own.body.total,1);
  assert.equal(own.body.observations[0].fingerprint,undefined);
  assert.equal((await f.request('member',path(tistory)+'?kind=bogus')).status,400);
  assert.equal((await f.request('member',path(tistory)+'?limit=0')).status,400);
  const end=kstDay(Date.now()),start=shift(end,-6),query=`/api/analytics?start=${start}&end=${end}`;
  assert.deepEqual((await f.request('member',query)).body.externalObservations.channels.map(row=>row.channelId),[tistory]);
  assert.deepEqual((await f.request('admin',query)).body.externalObservations.channels.map(row=>row.channelId).sort(),[tistory,pinterest].sort());
  const viewer=await f.request('viewer',query);
  if(viewer.status===200)assert.equal(viewer.body.externalObservations.channels.length,0);else assert.equal(viewer.status,403);
  const simple=await f.request('admin','/api/social/simple');
  assert.equal(simple.status,200);
  const account=simple.body.accountMap.accounts.find(row=>row.id==='shift-tistory');
  assert.equal(account.operations.collection.connected,false);
  assert.equal(account.operations.externalCollection.kind,'account-lifetime');
  assert.equal(simple.body.accountMap.coverage.externallyObserved,2);
  assert.equal(simple.body.accountMap.coverage.connected,0,'recent screen/export observations are not API connections');
  assert.equal(simple.body.accounts.find(row=>row.channelId===tistory).externalCollection.sourceType,'creator-screen');
});
