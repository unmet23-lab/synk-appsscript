'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {sanitizePerformance,performanceSummary,readCachedPerformance}=require('../tools/operations-home/performance-summary.cjs');
const NOW=Date.parse('2026-10-20T09:00:00Z'),STAMP='2026-10-20T08:30:00Z';
function payload(){return {schemaVersion:1,checkedAt:STAMP,appRunning:true,channels:[{id:'channel-1',platform:'youtube',label:'SYNK',url:'https://www.youtube.com/@synk',
  snapshot:{checkedAt:STAMP,date:'2026-10-20',followers:0,views:9000,postCount:12,source:'api:youtube'}}],
  entries:[{id:'entry-1',channelId:'channel-1',title:'실험 편',url:'https://www.youtube.com/watch?v=fixture',publishedAt:'2026-10-15T08:30:00Z',
    checkpoints:[{hours:72,status:'recorded',observedAt:'2026-10-18T08:30:00Z',source:'api:youtube',metrics:{views:100,likes:0,averageViewPct:130,averageWatchSeconds:12},metricProvenance:{
      averageWatchSeconds:{source:'api:youtube',kind:'window',timeZone:'America/Los_Angeles',startDate:'2026-10-15',endDate:'2026-10-17',observedAt:STAMP,timing:'window'}}}]}]};}
test('계정 누적값·게시 관측·태평양시 기간값을 합치지 않고 실제 0과 미확인을 구분한다',()=>{
  const result=performanceSummary(payload(),{now:NOW});
  assert.equal(result.channels[0].snapshot.followers,0);assert.equal(result.channels[0].snapshot.views,9000);
  const metrics=result.observations[0].metrics;
  assert.equal(metrics.find(m=>m.key==='views').value,100);assert.equal(metrics.find(m=>m.key==='likes').value,0);
  assert.equal(metrics.find(m=>m.key==='comments').value,null);
  assert.equal(metrics.find(m=>m.key==='averageViewPct').value,130,'평균 조회율은 100%를 넘을 수 있다');
  assert.equal(metrics.find(m=>m.key==='averageWatchSeconds').kind,'window');
  assert.match(metrics.find(m=>m.key==='averageWatchSeconds').period,/2026-10-15~2026-10-17.*America\/Los_Angeles/);
  assert.equal(metrics.find(m=>m.key==='views').observedAt,'2026-10-18T08:30:00.000Z');
  assert.equal(result.stale,false);
});
test('기간 정보가 깨진 값은 시점 관측으로 둔갑시키지 않고 추정 표식도 보존한다',()=>{
  const p=payload(),point=p.entries[0].checkpoints[0];
  point.metricProvenance.averageWatchSeconds.timeZone='UTC';
  point.metrics.earlyRetention3sPct=72;point.metricProvenance.earlyRetention3sPct={source:'api:instagram',estimated:true,derivedFrom:'reels_skip_rate'};
  const r=performanceSummary(p,{now:NOW}),metrics=r.observations[0].metrics;
  assert.equal(metrics.find(m=>m.key==='averageWatchSeconds').value,null);
  assert.equal(metrics.find(m=>m.key==='earlyRetention3sPct').estimated,true);
});

test('늦게 입력한 수동값의 실제 측정 시각과 관측 기한 누락을 보존한다',()=>{
  const p=payload(),point=p.entries[0].checkpoints[0];
  point.source='manual';point.timing='late';point.measurementWindowMissed=true;
  const views=performanceSummary(p,{now:NOW}).observations[0].metrics.find(m=>m.key==='views');
  assert.equal(views.source,'manual');assert.equal(views.timing,'late');assert.equal(views.measurementWindowMissed,true);
  assert.equal(views.observedAt,'2026-10-18T08:30:00.000Z');
});
test('허용 지표 외 본문·토큰·개인정보는 사본에 남기지 않고 URL의 비밀 쿼리도 버린다',()=>{
  const p=payload();p.secret='PRIVATE_SECRET';p.channels[0].ownerEmail='PRIVATE_EMAIL';
  p.entries[0].note='PRIVATE_NOTE';p.entries[0].url+='&token=PRIVATE_QUERY';
  p.entries[0].checkpoints[0].metricProvenance.averageWatchSeconds.refreshToken='PRIVATE_TOKEN';
  const r=sanitizePerformance(p);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_/);
  assert.equal(r.entries[0].url,'https://www.youtube.com/watch?v=fixture');
});
test('오래된 사본·만료된 숫자·잘못된 수치를 구분한다',()=>{
  const p=payload();p.channels[0].snapshot.expiresAt='2026-10-19T00:00:00Z';p.entries[0].expiresAt='2026-10-19T00:00:00Z';
  const expired=performanceSummary(p,{now:NOW+7*3600000});
  assert.equal(expired.stale,true);assert.equal(expired.channels[0].snapshot,null);
  assert.ok(expired.observations[0].metrics.every(m=>m.value===null));
  p.entries[0].expiresAt=null;p.entries[0].checkpoints[0].metrics.views=-1;p.entries[0].checkpoints[0].metrics.completionRatePct=120;
  const invalid=performanceSummary(p,{now:NOW});
  assert.equal(invalid.observations[0].metrics.find(m=>m.key==='views').value,null);
  assert.equal(invalid.observations[0].metrics.find(m=>m.key==='completionRatePct').value,null);
});
test('같은 채널·관측 중복과 다른 서비스 URL은 숫자 표에 섞이지 않는다',()=>{
  const p=payload();p.channels.push({...p.channels[0]});assert.equal(performanceSummary(p,{now:NOW}).available,false);
  const q=payload();q.entries[0].checkpoints.push({...q.entries[0].checkpoints[0]});assert.equal(performanceSummary(q,{now:NOW}).available,false);
  const r=payload();r.entries[0].url='https://evil.example/watch?v=fixture';assert.equal(performanceSummary(r,{now:NOW}).observations.length,0);
});
test('캐시 조회와 기존 채널성과 --현재 명령은 장부나 사본을 쓰지 않는다',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-performance-test-')),file=path.join(root,'sns-cache.json');
  t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
  const bytes=JSON.stringify({version:1,performance:payload()});fs.writeFileSync(file,bytes);
  assert.equal(readCachedPerformance(file,{now:NOW}).observations.length,1);
  const {spawnSync}=require('node:child_process'),command=spawnSync(process.execPath,[path.resolve(__dirname,'../tools/채널성과.js'),'--현재','--사본',file],{encoding:'utf8',windowsHide:true});
  assert.equal(command.status,0,command.stderr);assert.equal(JSON.parse(command.stdout).observations.length,1);
  assert.equal(fs.readFileSync(file,'utf8'),bytes);assert.deepEqual(fs.readdirSync(root),['sns-cache.json']);
});
module.exports={payload};
