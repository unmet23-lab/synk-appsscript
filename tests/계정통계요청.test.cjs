'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {capture,marker}=require('../tools/계정통계예약/capture-routes.cjs');
const {drain,processJob,workerIdentity,downloadCapture,configured}=require('../tools/계정통계예약/collect-requests.cjs');
const {metaRows,kakaoRows,sameRoute,getNaverDownload}=require('../tools/계정통계예약/owner-metrics.cjs');
const {rutubeRows,otherOwner}=require('../tools/계정통계예약/platform-exports.cjs');
function base(platform='instagram'){return {account:{platform},profile:{},covered:()=>false,signal:new AbortController().signal};}

test('일시적 읽기 실패만 같은 요청에서 한 번 다시 확인하고 첫 자료를 보존한다',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-worker-retry-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const job={accountId:'example',channelId:'channel',requestId:'request',token:'lease',requestedAt:new Date().toISOString(),missing:['views']};
  const baseOptions={requestDir:root,catalog:{accounts:[{id:job.accountId,platform:'vk',accountStatus:'operating'}]},profiles:{},policies:{}};
  for(const [first,second] of [['retry','limited'],['retry','retry'],['user_control'],['need_owner'],['format']]){
    const dirs=[],events=[];
    await processJob({post:async(_url,body)=>{events.push(body);return {}; }},job,{...baseOptions,capture:async({dir})=>{
      dirs.push(dir);fs.writeFileSync(path.join(dir,'example.csv'),'original',{flag:'wx'});
      return dirs.length===1?first:second;
    }});
    assert.equal(events.at(-1).reason,second||first);
    assert.equal(dirs.length,second?2:1);
    if(second){
      assert.notEqual(dirs[0],dirs[1]);
      const receipt=JSON.parse(fs.readFileSync(path.join(dirs[0],'retry.json'),'utf8'));
      assert.equal(receipt.next,path.basename(dirs[1]));
      assert.equal(fs.readFileSync(path.join(dirs[0],'example.csv'),'utf8'),'original');
    }
  }
});

test('관리 화면 부분 수집과 오류 뒤에도 지원되는 공개 경로에서 누락값을 계속 확인한다',async()=>{
  for(const get of [async()=> 'limited',async()=>{throw Error('expired platform request');}]){
    let tried=0,ctx=base();
    const result=await capture(ctx,{ownerSource:get,publicSource:async c=>{tried++;c.covered=()=>true;return {reason:'done'};}});
    assert.equal(tried,1);assert.equal(result,'done');
  }
});
test('사용자에게 제어가 넘어간 브라우저는 다시 열지 않는다',async()=>{
  for(const get of [async()=> 'user_control',async()=>{throw Error('user has control');}]){
    const result=await capture(base(),{ownerSource:get,publicSource:()=>assert.fail('브라우저를 다시 열었습니다')});
    assert.equal(result,'user_control');
  }
});
test('별도 프로필이 없는 공개 계정도 확인하되 지원하지 않는 추가 계정 URL은 호출하지 않는다',async()=>{
  let count=0;
  const publicSource=async c=>{assert.deepEqual(c.profile,{});count++;return {reason:'limited'};};
  assert.equal(await capture(base('instagram'),{ownerSource:async()=>null,publicSource}),'limited');
  assert.equal(await capture(base('naver-blog'),{ownerSource:async()=>'limited',publicSource}),'limited');
  assert.equal(count,1);
});
test('공식 표는 올바른 기간·소유자·숫자만 통과시키며 원본마다 별도 수치를 유지한다',()=>{
  assert.equal(sameRoute('https://business.facebook.com/latest/insights/results?asset_id=2','https://business.facebook.com/latest/insights/results?asset_id=1'),false);
  const dates=['2026-11-08T08:00:00.000Z','2026-11-09T08:00:00.000Z'].map(x=>Date.parse(x)/1000);
  const text=['Facebook','최근 2일: 2026. 11. 8.~2026. 11. 9.','조회수','설명','내보내기','9',dates.join('\t'),'Primary\t0\t9'].join('\n');
  assert.deepEqual(metaRows({text},'Facebook').map(x=>x.metrics.views),[0,9]);assert.equal(metaRows({text},'Instagram').length,0);
  assert.equal(metaRows({text:text.replace('\n9\n','\n99\n')},'Facebook').length,0);
  const tbl={at:'2026-11-15T10:00:00Z',tables:[[['날짜','방문자수','조회수'],['2026.11.14','2','9'],['2026.11.15','1','3']]]};
  assert.equal(kakaoRows(tbl).length,1);assert.equal(kakaoRows(tbl)[0].metrics.views,9);
  assert.deepEqual(rutubeRows({periodText:'8 − 14 нояб. 2026',metric:{label:'Просмотры',value:'0'}})[0].metrics,{views:0});
  assert.deepEqual(rutubeRows({periodText:'8 − 14 нояб. 2026',metric:{label:'Просмотры',value:'몇 회'}}),[]);
  assert.deepEqual(marker([{text:'출력\nSYNK_METRICS {"ok":true}\n'}]),{ok:true});
});
test('독립 프로필은 동시에 진행하고 같은 프로필은 순서대로 한 번씩 처리한다',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-on-demand-'));
 const ids=['a','b','c'],work=ids.map(id=>({accountId:id,channelId:id,requestId:id,requestedAt:new Date().toISOString(),missing:['views'],token:'fixture'})),seen=new Set(),ended=[];
 const api={post:async(url,data)=>{if(url.endsWith('/claim'))return {job:work.shift()};if(data.reason)ended.push([data.channelId,data.reason]);return {};}};
 const profile=id=>({browser:'ego',profileId:id}),profiles={a:profile('one'),b:profile('one'),c:profile('two')};
 let max=0;
 try{
  const done=await drain(api,{idleMs:0,requestDir:root,catalog:{accounts:ids.map(id=>({id,platform:'x',accountStatus:'operating'}))},profiles,policies:{},
    capture:async({profile})=>{assert.ok(!seen.has(profile.profileId));seen.add(profile.profileId);max=Math.max(max,seen.size);await new Promise(resolve=>setTimeout(resolve,30));seen.delete(profile.profileId);return 'no_metrics';}});
  assert.equal(done,3);assert.equal(max,2);assert.equal(ended.length,3);assert(ended.every(x=>x[1]==='no_metrics'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('서로 다른 Aside 계정의 동시 요청도 공용 브라우저에서는 직렬로 읽으며 Ego는 함께 처리한다',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-worker-aside-'));
 try{
  const ids=['one','two','three'],jobs=ids.map(id=>({channelId:id,accountId:id,requestId:id,requestedAt:new Date().toISOString(),token:'lease',missing:['views']}));
  const profiles={one:{browser:'aside',account:'first'},two:{browser:'aside',account:'second'},three:{browser:'ego',profileId:'public'}};
  let aside=0,total=0,max=0;const attempted=[];
  const count=await drain({post:async url=>url.endsWith('/claim')?{job:jobs.shift()}:{}},{requestDir:dir,idleMs:0,profiles,policies:{},
   catalog:{accounts:ids.map(id=>({id,platform:'x',accountStatus:'operating'}))},capture:async({profile,account})=>{
    attempted.push(account.id);const isAside=profile.browser==='aside';if(isAside)assert.equal(++aside,1);
    max=Math.max(max,++total);await new Promise(resolve=>setTimeout(resolve,20));total--;if(isAside)aside--;return 'limited';
   }});
  assert.equal(count,3);assert.equal(max,2);assert.deepEqual(attempted,['one','three','two']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('느린 Aside 요청이 앞에 세 개여도 Ego와 Telegram이 먼저 완료되고 동시에 세 계정까지만 읽는다',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-worker-claims-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ids=['aside1','aside2','aside3','ego1','telegram','ego2'];
  const accounts=ids.map(id=>({id,platform:id==='telegram'?'telegram':'x',accountStatus:'operating'}));
  const profiles=Object.fromEntries(ids.map(id=>[id,id.startsWith('aside')?{browser:'aside',account:id}:{browser:'ego',profileId:id}]));
  const jobs=ids.map(id=>({channelId:id,accountId:id,requestId:id,token:'lease',requestedAt:new Date().toISOString(),missing:['views']}));
  const claims=[],finished=[],active=new Set();let max=0,releaseEgo,releaseTelegram;
  const telegramStarted=new Promise(resolve=>{releaseEgo=resolve;});
  const egoStarted=new Promise(resolve=>{releaseTelegram=resolve;});
  const api={post:async (url,body)=>{
    if(url.endsWith('/claim')){
      claims.push(body);
      const index=jobs.findIndex(job=>body.accountIds.includes(job.accountId));
      return {job:index===-1?null:jobs.splice(index,1)[0]};
    }
    if(body.reason)finished.push(body.channelId);
    return {};
  }};
  async function read(id){
    active.add(id);max=Math.max(max,active.size);
    assert(active.size<=3);
    assert([...active].filter(k=>k.startsWith('aside')).length<=1);
    if(id==='aside1')await new Promise(resolve=>setImmediate(resolve));
    if(id==='ego1'){releaseTelegram();await telegramStarted;}
    if(id==='telegram'){releaseEgo();await egoStarted;}
    active.delete(id);
  }
  const count=await drain(api,{requestDir:dir,idleMs:0,profiles,policies:{},catalog:{accounts},workerId:'test_claim_worker',
    capture:async({account})=>{await read(account.id);return 'limited';},
    telegram:async(account)=>{await read(account.id);return {batches:[]};}});
  assert.equal(count,ids.length);assert.equal(max,3);
  assert.deepEqual(claims[1].accountIds,['ego1','telegram','ego2']);
  assert(claims.every(c=>c.workerId==='test_claim_worker'));
  assert(finished.indexOf('ego1')<finished.indexOf('aside1'));
  assert(finished.indexOf('telegram')<finished.indexOf('aside1'));
  assert.deepEqual(finished.filter(id=>id.startsWith('aside')),['aside1','aside2','aside3']);
});
test('설치별 담당 계정만 요청하며 작업자가 누구인지 드러내지 않는 안정된 번호를 보낸다',()=>{
 for(const config of [{},null,{configured:true},{accountIds:[]},{accountIds:'one'},{allManaged:true,configured:false}])assert.equal(configured(config),false);
 assert.equal(configured({configured:true,allManaged:true}),true);
 assert.equal(configured({accountIds:['one']}),true);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-worker-config-'));
 try{
  fs.writeFileSync(path.join(root,'worker-config.json'),JSON.stringify({accountIds:['one','two','three'],excludedAccountIds:['two']}));
  const options={stateDir:root,catalog:{accounts:[{id:'one',accountStatus:'operating'},{id:'two',accountStatus:'operating'},{id:'three',accountStatus:'historical'}]}};
  const result=workerIdentity(options);
  assert.match(result.workerId,/^pc_[a-f0-9]{28}$/);assert.deepEqual(result,workerIdentity(options));assert.deepEqual(result.accountIds,['one']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('공식 파일은 현재 요청 폴더의 실제 신규 다운로드일 때만 요청 증빙을 붙인다',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-worker-download-'));
 try{
  const file=path.join(dir,'export.csv'),at=new Date().toISOString(),sha='a'.repeat(64);
  fs.writeFileSync(file,'날짜,조회수');const job={requestId:'request',token:'lease',requestedAt:new Date(Date.now()-1000).toISOString()};
  const batch={evidenceFile:'export.csv'},envelope={sourceType:'official-export',observedAt:at,evidenceSha256:sha};
  assert.deepEqual(downloadCapture(batch,{dir},job,envelope),{requestId:'request',token:'lease',evidenceSha256:sha,downloadedAt:at});
  assert.throws(()=>downloadCapture(batch,{dir},{...job,requestedAt:new Date(Date.now()+10000).toISOString()},envelope));
  assert.equal(downloadCapture(batch,{dir},job,{...envelope,sourceType:'creator-screen'}),undefined);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('RUTUBE 공개 API를 먼저 읽으며 빈 목록이나 API 장애에서도 Studio의 독립된 기간 조회수를 수집한다',async()=>{
 for(const failApi of [false,true]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-rutube-request-')),order=[],saved=[];
  try{
   const ctx={dir,account:{id:'lab-ru-rutube',externalId:'81398864',platform:'rutube'},profile:{profileId:'test',expectedName:'Fixture'},setStage:async s=>order.push(s)};
   const helpers={
    collectPublic:async(id,{directory})=>{assert.equal(id,ctx.account.id);assert.equal(directory,path.join(dir,'official-api'));order.push('api');if(failApi)throw Error('503');return {listedVideos:0};},
    pageJob:async(c,n,fn,args)=>{order.push('studio');assert.equal(args.channelId,'81398864');return {source:'https://studio.rutube.ru/analytics',at:'2026-11-15T12:00:00Z',periodText:'8 − 14 нояб. 2026',metric:{label:'Просмотры',value:'7'}};},
    storeBatch:async(c,n,raw,envelope)=>saved.push(envelope)
   };
   assert.equal(await otherOwner(ctx,helpers),'limited');
   assert.deepEqual(order,['api','creator-screen','studio']);assert.equal(saved.length,1);assert.equal(saved[0].sourceType,'creator-screen');
   assert.deepEqual(saved[0].observations[0].metrics,{views:7});assert.deepEqual(saved[0].observations[0].period,{start:'2026-11-08',end:'2026-11-14'});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
});
test('네이버는 일시적인 브라우저 오류만 한 번 더 시도하고 계정 불일치와 인계는 바로 종료한다',async()=>{
 for(const failure of ['ASIDE_TIMEOUT','SYNK_OWNER','user control']){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-navercapture-'));
  try{
   const url='https://admin.blog.naver.com/example/stat/download',target=path.join(dir,'read.xlsx'),source=path.join(dir,'download.xlsx');
   fs.writeFileSync(source,'official fixture');let attempts=0;
   const go=()=>getNaverDownload({dir,signal:new AbortController().signal},async()=>{
    if(!attempts++)throw Object.assign(Error(failure),{code:failure});return {sourceUrl:url,downloadedFile:source};
   },'fixture',url,target);
   if(failure==='ASIDE_TIMEOUT'){await go();assert.equal(attempts,2);assert.equal(fs.readFileSync(target,'utf8'),'official fixture');}
   else{await assert.rejects(go,new RegExp(failure));assert.equal(attempts,1);assert(!fs.existsSync(target));}
   const diagnostic=JSON.parse(fs.readFileSync(path.join(dir,'naver-attempt-1.json')));
   assert.deepEqual(Object.keys(diagnostic).sort(),['at','attempt','code','timing']);assert(Number.isSafeInteger(diagnostic.timing.elapsedMs));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
});


test('정기 회차는 끝나지 않은 요청이 있거나 세 시간 안에 요청이 있었으면 넣지 않고, 아니면 모두 수집 요청 하나만 넣는다',async()=>{
  const {startScheduled,RECENT_MS}=require('../tools/계정통계예약/collect-requests.cjs');
  const now=Date.parse('2026-11-16T00:40:00Z');
  const fake=items=>{const calls=[];return {calls,get:async url=>{calls.push(['get',url]);return {items};},
    post:async(url,body)=>{calls.push(['post',url,body]);return {runs:[{id:'r1'},{id:'r2'}],progress:{items:[{status:'queued'},{status:'queued'},{status:'complete'}],worker:{online:true}}};}};};
  const busy=fake([{status:'running',requestedAt:'2026-11-15T12:00:00Z'},{status:'partial',requestedAt:'2026-11-15T12:00:00Z'}]);
  assert.deepEqual(await startScheduled(busy,{now}),{started:false,reason:'active',active:1});
  assert.deepEqual(busy.calls,[['get','/api/collection-progress?scope=all']]);
  const recent=fake([{status:'partial',requestedAt:new Date(now-RECENT_MS+60_000).toISOString()}]);
  assert.deepEqual(await startScheduled(recent,{now}),{started:false,reason:'recent',minutesAgo:179});
  assert.equal(recent.calls.length,1);
  for(const items of [[],[{status:'partial',requestedAt:new Date(now-RECENT_MS).toISOString()},{status:'complete',requestedAt:'not a date'}]]){
    const due=fake(items);
    assert.deepEqual(await startScheduled(due,{now}),{started:true,channels:3,apiRuns:2,byStatus:{queued:2,complete:1},workerOnline:true});
    assert.deepEqual(due.calls.at(-1),['post','/api/collect',{scope:'all'}]);
  }
});
