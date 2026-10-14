import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const at='2026-10-02T01:00:00.000Z',id='7522423151142551568',url=`https://ads.tiktok.com/business/creativecenter/topads/${id}/pc/en?countryCode=US&period=30`;
const adResponse=()=>new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{data:{baseDetail:{id,adTitle:'공개 광고',countryCode:['KR'],like:20,comment:0,share:2,ctr:.08,cost:1}}}}})+'</script>',{headers:{'Content-Type':'text/html'}});
const fb={source:'facebook',kind:'reel',title:'실제 사례',sourceUrl:'https://www.facebook.com/reel/1234567890/',region:'KR'};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function createTestApp(options,{backgroundOff=false}={}){
  const previous=process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
  try{if(backgroundOff)process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='0';return createCompanyApp(options);}
  finally{if(previous===undefined)delete process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;else process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=previous;}
}
async function fixture(t,fetchImpl=async()=>adResponse(),extraOptions={}){
  const {testBackgroundDisabled=false,...appOptions}=extraOptions;
  const directory=await mkdtemp(join(tmpdir(),'synk-api-creative-')),app=createTestApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>at,creativeResearchFetch:fetchImpl,...appOptions},{backgroundOff:testBackgroundDisabled}),address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-api-creative-'));await rm(directory,{recursive:true,force:true});});
  app.store.put('teams','a',{id:'a',name:'a',active:true});
  const admin=app.store.createUser({name:'Admin',email:'admin@example.test',role:'admin'}),owner=app.store.createUser({name:'Owner',email:'owner@example.test',role:'member',teamId:'a'}),other=app.store.createUser({name:'Other',email:'other@example.test',role:'member'}),viewer=app.store.createUser({name:'Viewer',email:'viewer@example.test',role:'viewer',teamId:'a'}),sessions=new Map([admin,owner,other,viewer].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'creative-csrf'},10)]));
  async function call(path,input,user=owner,headers={}){const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions.get(user.id)}:{}),...(input===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'creative-csrf'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json(),headers:response.headers};}
  return {app,admin,owner,other,viewer,call};
}

test('creative APIs authenticate, isolate private data and enforce CSRF Origin and viewer permissions',async t=>{
  const f=await fixture(t);assert.equal((await f.call('/api/creative-research',undefined,null)).status,401);assert.equal((await f.call('/api/creative-research',fb,f.owner,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await f.call('/api/creative-research',fb,f.owner,{Origin:'https://evil.example'})).status,403);assert.equal((await f.call('/api/creative-research',fb,f.viewer)).status,403);
  const saved=await f.call('/api/creative-research',fb);assert.equal(saved.status,201);assert.equal(saved.data.entry.visibility,'private');const mine=await f.call('/api/creative-research');assert.equal(mine.data.sources.length,4);assert.equal(mine.data.entries.length,1);assert.equal(mine.data.canCreate,true);assert.equal((await f.call('/api/creative-research',undefined,f.other)).data.entries.length,0);assert.equal((await f.call('/api/creative-research/'+saved.data.entry.id,{hook:'other'},f.other)).status,404);
  assert.equal((await f.call('/api/creative-research/'+saved.data.entry.id,{visibility:'company'})).status,400);assert.equal((await f.call('/api/creative-research/'+saved.data.entry.id,{visibility:'company',shareConfirmed:true})).status,200);assert.equal((await f.call('/api/creative-research',undefined,f.viewer)).data.entries[0].canEdit,false);
});

test('the public time endpoint ignores account cookies and uses the current server clock with no cache or source details',async t=>{
  let clock='2026-10-09T14:59:59.999Z';const f=await fixture(t,undefined,{clock:()=>clock});const before=await f.call('/api/creative-research/time',undefined,null);assert.equal(before.status,200);assert.equal(before.headers.get('cache-control'),'no-store');assert.equal(before.data.dateKst,'2026-10-09');clock='2026-10-09T15:00:00.000Z';const after=await f.call('/api/creative-research/time',undefined,f.admin);assert.equal(after.data.dateKst,'2026-10-10');assert.equal(after.data.now,clock);assert.deepEqual(Object.keys(after.data).sort(),['dateKst','now','nowKst','timeZone','windows']);assert.equal(after.data.nowKst,'2026-10-10T00:00:00.000+09:00');assert.equal((await f.call('/api/creative-research/time?account=private',undefined,null)).status,400);
});

test('the report API persists a real midnight run and rejects source-pool spoofing in public report fields',async t=>{
  const clock='2026-10-09T15:10:00.000Z',f=await fixture(t,undefined,{clock:()=>clock}),input={schemaVersion:1,reportId:'api-midnight',date:'2026-10-10',provider:'gemini-spark',asOfAt:'2026-10-09T14:55:00Z',researchStartedAt:'2026-10-09T14:55:00Z',researchCompletedAt:'2026-10-09T15:05:00Z',visibility:'company',shareConfirmed:true,entries:[{...fb,checkedAt:'2026-10-09T14:59:30Z'}]};
  const saved=await f.call('/api/creative-research/import-report',input,f.admin);assert.equal(saved.status,201);assert.equal(saved.data.report.researchCompletedAt,'2026-10-09T15:05:00.000Z');const workspace=(await f.call('/api/creative-research',undefined,f.other)).data;assert.equal(workspace.entries[0].checkedAt,'2026-10-09T14:59:30.000Z');assert.equal(workspace.entries[0].provenanceDetails.asOfAt,'2026-10-09T14:55:00.000Z');assert.equal(workspace.automation.lastReport.researchStartedAt,'2026-10-09T14:55:00.000Z');assert.equal(typeof workspace.revision,'string');
  for(const patch of [{automaticSourcePoolIds:['google_doc_fixture_1234567890']},{automaticSourceId:'google_doc_fixture_1234567890'},{asOfAt:undefined}])assert.equal((await f.call('/api/creative-research/import-report',{...input,reportId:'bad-midnight',...patch},f.admin)).status,400);
  assert.equal(f.app.store.all('creativeResearchEntries').length,1);
});

test('admin API registers two sources and retains the second source through a legacy form update',async t=>{
  const docs=['google_doc_fixture_1234567890','second_doc_fixture_1234567890'],inputs=[],f=await fixture(t,undefined,{creativeResearchReader:async input=>{inputs.push(input);return {text:JSON.stringify({schemaVersion:1,reportId:'api-source-'+input.documentId,date:'2026-10-02',provider:'gemini-spark',entries:[{...fb,checkedAt:at,metrics:{likes:input.documentId===docs[0]?10:20}}]})+'\nSYNK_CREATIVE_RESEARCH_COMPLETE',modifiedTime:at};}});
  assert.equal((await f.call('/api/creative-research/sync-settings',{enabled:true,sources:docs.map((documentId,i)=>({id:'writer-'+i,documentId,connectionId:null}))},f.admin)).status,200);assert.equal((await f.call('/api/creative-research/sync-settings',{connectionId:'changed-account'},f.admin)).data.sources.length,2);const check=await f.call('/api/creative-research/sync-check',{},f.admin);assert.equal(check.data.sources.length,2);assert.equal(check.data.sources.every(source=>source.status==='imported'),true);assert.equal(inputs.length,2);assert.equal(inputs[0].connectionId,'changed-account');assert.equal(inputs[1].connectionId,null);assert.equal(f.app.store.all('creativeResearchEntries').length,1);const member=(await f.call('/api/creative-research',undefined,f.other)).data;assert.equal(member.automation.sync.sources,undefined);assert.equal(member.automation.sync.connectionId,undefined);
});

test('switching the active Drive account during an implicit source read prevents both full and conditional imports',async t=>{
  for(const notModified of [false,true]){let activeId='original-account';const documentId='google_doc_fixture_1234567890',f=await fixture(t,undefined,{creativeResearchDrive:{active:async()=>({id:activeId}),readCreativeResearchDocument:async()=>{activeId='changed-account';return notModified?{notModified:true,modifiedTime:at}:{text:JSON.stringify({schemaVersion:1,reportId:'account-race',date:'2026-10-02',provider:'gemini-spark',entries:[{...fb,checkedAt:at}]})+'\nSYNK_CREATIVE_RESEARCH_COMPLETE',modifiedTime:at};}}});await f.call('/api/creative-research/sync-settings',{enabled:true,documentId},f.admin);const result=await f.call('/api/creative-research/sync-check',{},f.admin);assert.equal(result.data.status,'error');assert.equal(result.data.lastErrorCode,'SYNC_AUTHORITY_CHANGED');assert.equal(f.app.store.all('creativeResearchEntries').length,0);assert.equal(f.app.store.all('creativeResearchReports').length,0);}
});

test('official Top Ads import endpoint preserves metric semantics and supports archive history and restore',async t=>{
  const f=await fixture(t),saved=await f.call('/api/creative-research/import-top-ad',{url});assert.equal(saved.status,201);assert.equal(saved.data.entry.ctrTopPercent,8);assert.equal(saved.data.entry.metrics.views,null);assert.equal(saved.data.entry.metrics.comments,0);assert.equal(saved.data.entry.provenance,'official-page');assert.equal(saved.data.entry.filterRegion,'US');assert.deepEqual(saved.data.entry.actualRegions,['KR']);const entryId=saved.data.entry.id;
  assert.equal((await f.call('/api/creative-research/'+entryId+'/archive',{})).status,200);assert.equal((await f.call('/api/creative-research')).data.entries.length,0);assert.equal((await f.call('/api/creative-research?includeArchived=1')).data.entries[0].archived,true);assert.equal((await f.call('/api/creative-research?includeArchived=1',undefined,f.other)).data.entries.length,0);assert.equal((await f.call('/api/creative-research?includeArchived=bad')).status,400);assert.equal((await f.call('/api/creative-research/'+entryId,{archived:false})).status,200);assert.equal((await f.call('/api/creative-research')).data.entries.length,1);assert.equal((await f.call('/api/creative-research/import-top-ad',{url:url.replace('US','CN')})).data.existing,true);
});

test('revoked sessions cannot persist an in-flight imported record even when account remains active',async t=>{
  const entered=gate(),release=gate(),f=await fixture(t,async()=>{entered.resolve();await release.promise;return adResponse();}),pending=f.call('/api/creative-research/import-top-ad',{url});await entered.promise;f.app.store.revokeUser(f.owner.id);release.resolve();const result=await pending;assert.equal(result.status,401);assert.equal(f.app.store.all('creativeResearchEntries').length,0);assert.equal(f.app.store.all('audit').filter(row=>row.action==='creative-research-imported').length,0);
});

test('current channel permissions are reapplied to reads after ownership or archive changes',async t=>{
  const f=await fixture(t),channel={id:'youtube-context',platform:'youtube',displayName:'관찰 계정',canonicalUrl:'https://www.youtube.com/@example',ownerIds:[f.owner.id],teamId:'a',active:true};f.app.store.put('channels',channel.id,channel);const saved=await f.call('/api/creative-research',{source:'youtube-trends',kind:'top-search',title:'시청자 검색',sourceUrl:'https://studio.youtube.com/channel/UCabcdefghijklmnopqrstuv/analytics/tab-trends/period-default',channelId:channel.id,periodDays:28,interest:'high'});assert.equal(saved.status,201);assert.equal(saved.data.entry.channelName,'관찰 계정');assert.equal((await f.call('/api/creative-research')).data.channels[0].canEdit,true);f.app.store.put('channels',channel.id,{...channel,active:false});assert.equal((await f.call('/api/creative-research')).data.entries.length,0);assert.equal((await f.call('/api/creative-research/'+saved.data.entry.id,{hook:'이전 접근'})).status,404);
});

test('daily research report API shares validated results, rejects cross-origin writes and preserves idempotency',async t=>{
  const f=await fixture(t),report={schemaVersion:1,reportId:'daily-api-2026-10-02',date:'2026-10-02',provider:'gemini-spark',visibility:'company',shareConfirmed:true,entries:[{...fb,checkedAt:at,adaptation:'관찰한 사례의 순서를 우리 설명에 적용해 봅니다.'}]};
  assert.equal((await f.call('/api/creative-research/import-report',report,null)).status,403);
  assert.equal((await f.call('/api/creative-research/import-report',report,f.owner,{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.call('/api/creative-research/import-report',report,f.owner,{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await f.call('/api/creative-research/import-report',report,f.viewer)).status,403);
  const saved=await f.call('/api/creative-research/import-report',report);assert.equal(saved.status,201);assert.equal(saved.data.report.createdCount,1);assert.equal(saved.data.entries,undefined);assert.equal((await f.call('/api/creative-research')).data.entries[0].visibility,'company');
  const repeated=await f.call('/api/creative-research/import-report',report);assert.equal(repeated.status,200);assert.equal(repeated.data.existing,true);
  assert.equal(f.app.store.all('creativeResearchEntries').length,1);assert.equal(f.app.store.all('audit').filter(row=>row.action==='creative-research-report-imported').length,1);
  const workspace=await f.call('/api/creative-research',undefined,f.other);assert.equal(workspace.data.entries.length,1);assert.equal(workspace.data.entries[0].provenance,'research-report');
  const invalid={...report,reportId:'invalid-api-report',entries:[report.entries[0],{...report.entries[0],sourceUrl:'https://evil.example/reel/1234567890/'}]};
  assert.equal((await f.call('/api/creative-research/import-report',invalid)).status,400);assert.equal(f.app.store.all('creativeResearchEntries').length,1);
});

test('daily report uploads accept a valid 30-entry report within the shared 1 MiB file limit',async t=>{
  const f=await fixture(t),report={schemaVersion:1,reportId:'daily-api-large',date:'2026-10-02',provider:'gemini-spark',entries:Array.from({length:30},(_,i)=>({...fb,title:'공개 사례 '+i,sourceUrl:'https://www.facebook.com/reel/'+(1234567890+i)+'/',checkedAt:at,hook:'가'.repeat(2000),structure:'나'.repeat(4000),adaptation:'다'.repeat(4000)}))};
  assert.ok(JSON.stringify(report).length>256000);assert.ok(Buffer.byteLength(JSON.stringify(report))<1048576);
  const saved=await f.call('/api/creative-research/import-report',report);assert.equal(saved.status,201);assert.equal(saved.data.report.createdCount,30);assert.equal(f.app.store.all('creativeResearchEntries').length,30);assert.ok(Buffer.byteLength(JSON.stringify(saved.data))<4096);
});

test('document sync settings require an administrator and import only a completed public report',async t=>{
  let documentText='',reads=0;const documentId='abcdefghijklmnopqrstuvwxy1234567890';
  const f=await fixture(t,undefined,{testBackgroundDisabled:true,creativeResearchDrive:{active:async()=>({id:'existing-drive-connection'}),readCreativeResearchDocument:async input=>{assert.equal(input.connectionId,'existing-drive-connection');assert.equal(input.documentId,documentId);reads++;return {text:documentText,modifiedTime:at};}}});
  assert.equal((await f.call('/api/creative-research/sync-settings',{enabled:true,documentId})).status,403);
  assert.equal((await f.call('/api/creative-research/sync-settings',{enabled:true,documentId:'https://evil.example/document/d/'+documentId},f.admin)).status,400);
  const configured=await f.call('/api/creative-research/sync-settings',{enabled:true,documentId:'https://docs.google.com/document/d/'+documentId+'/edit'},f.admin);assert.equal(configured.status,200);assert.equal(configured.data.documentId,documentId);
  const publicState=(await f.call('/api/creative-research')).data.automation.sync;assert.equal(publicState.enabled,true);assert.equal(publicState.documentId,undefined);assert.equal(publicState.ownerId,undefined);
  assert.equal((await f.call('/api/creative-research/sync-check',{},f.admin)).data.status,'waiting');assert.equal(f.app.store.all('creativeResearchEntries').length,0);
  documentText=JSON.stringify({schemaVersion:1,reportId:'completed-doc-report',date:'2026-10-02',provider:'gemini-spark',entries:[{...fb,checkedAt:at}]})+'\nSYNK_CREATIVE_RESEARCH_COMPLETE';
  const first=await f.call('/api/creative-research/sync-check',{},f.admin);assert.equal(first.status,200);assert.equal(first.data.status,'imported');assert.equal(f.app.store.all('creativeResearchEntries').length,1);assert.equal(f.app.store.all('creativeResearchEntries')[0].visibility,'company');
  assert.equal((await f.call('/api/creative-research/sync-check',{},f.admin)).status,200);assert.equal(f.app.store.all('creativeResearchEntries').length,1);assert.equal(f.app.store.all('creativeResearchReports').length,1);assert.equal(reads,3);
  assert.equal((await f.call('/api/creative-research/sync-check',{force:true},f.admin)).status,400);
});

test('a slow document read does not delay readiness and runs while broad background collection is disabled',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-api-doc-start-')),entered=gate(),release=gate();
  let ordinaryCollectionCalls=0;
  const app=createTestApp({dataDir:directory,port:0,allowTestHost:true,schedule:true,clock:()=>at,dailyTrendsCollector:async()=>{ordinaryCollectionCalls++;return {items:[],sources:[]};},creativeResearchReader:async()=>{entered.resolve();await release.promise;return {text:'',modifiedTime:at};}},{backgroundOff:true});
  t.after(async()=>{release.resolve();await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Admin',email:'doc-admin@example.test',role:'admin'});app.creativeResearchSync.configure(admin,{enabled:true,documentId:'abcdefghijklmnopqrstuvwxy1234567890'});
  const address=await app.start();await entered.promise;assert.equal((await (await fetch('http://127.0.0.1:'+address.port+'/api/health')).json()).ready,true);assert.equal(ordinaryCollectionCalls,0);release.resolve();await app.waitForIdle();assert.equal(app.creativeResearchSync.state(admin).status,'waiting');assert.equal(ordinaryCollectionCalls,0);
});

const productionResearch=()=>({summary:'격리 시험 제작 사례',whyNow:'다음 편 제작 전에 확인합니다.',brands:['LAB'],priority:'high',observedFacts:[{text:'원문에서 실제 행동을 안내하는 순서를 조사에 기록했습니다.'}],evidenceLevel:'page-read',limitations:'시험용 관찰이며 광고 성과와 학생 효과를 검증하지 않았습니다.',applications:[{brand:'LAB',idea:'실제 학습 화면으로 질문을 해결합니다.',zeroSecondHook:'첫 질문에 답해 보세요.',action:'조건을 한 가지 고릅니다.',reward:'맞는 연습을 받습니다.',personalizationTool:'선택 조건에 맞는 학습 도구로 이어집니다.',validation72h:'72시간의 시작·완료 수를 확인합니다.'}],productionGuide:{formatName:'질문을 실제 화면에서 해결하기',productionSteps:[{order:1,title:'준비',instruction:'실제 화면과 질문을 준비합니다.'},{order:2,title:'제작',instruction:'질문과 행동을 세 단계로 보여 줍니다.'},{order:3,title:'게시',instruction:'씨앗 계정에 게시하고 72시간의 시작·완료 수를 확인합니다.'}],requiredAssets:['직접 촬영한 실제 화면'],brandAdaptation:'LAB의 실제 학습 화면과 맞춤 연습을 연결합니다.',appeal:'한 가지 답으로 자신에게 맞는 첫 행동을 받습니다.'}});

test('public guide refill admits ten and two concurrent HTTP claimants produce one reservation with safe release',async t=>{
  const f=await fixture(t),input={schemaVersion:1,reportId:'http-production-guides',date:'2026-10-02',provider:'codex',visibility:'company',shareConfirmed:true,entries:Array.from({length:11},(_,index)=>({...fb,title:'격리 시험 가이드 '+index,sourceUrl:'https://www.facebook.com/reel/'+(123456789012345+index)+'/',checkedAt:at,research:productionResearch()}))};
  const imported=await f.call('/api/creative-research/import-report',input,f.admin);assert.equal(imported.status,201);assert.equal(imported.data.report.addedGuideCount,10);assert.equal(imported.data.report.deferredCount,1);assert.equal(imported.data.report.itemCount,11);
  const list=await f.call('/api/creative-research',undefined,f.owner);assert.equal(list.data.entries.filter(row=>row.productionReady).length,10);assert.equal(list.data.automation.pool.addedCount,10);const id=list.data.entries[0].id;
  assert.equal((await f.call('/api/creative-research/'+id+'/claim',{},f.viewer)).status,403);assert.equal((await f.call('/api/creative-research/'+id+'/claim',{},f.owner,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await f.call('/api/creative-research/'+id+'/claim',{},f.owner,{Origin:'https://evil.example'})).status,403);assert.equal((await f.call('/api/creative-research/'+id+'/claim',{userId:f.other.id},f.owner)).status,400);
  const outcomes=await Promise.all([f.call('/api/creative-research/'+id+'/claim',{},f.owner),f.call('/api/creative-research/'+id+'/claim',{},f.other)]);assert.deepEqual(outcomes.map(value=>value.status).sort(),[200,409]);const winner=outcomes[0].status===200?f.owner:f.other,loser=winner.id===f.owner.id?f.other:f.owner;
  const held=await f.call('/api/creative-research',undefined,loser);assert.equal(held.data.entries.find(row=>row.id===id).usage.status,'in-use');assert.equal(held.data.entries.find(row=>row.id===id).usage.canClaim,false);assert.equal(held.data.entries.find(row=>row.id===id).usage.userName,undefined);assert.equal(held.data.entries.find(row=>row.id===id).usage.reservationEntryId,undefined);
  assert.equal((await f.call('/api/creative-research/'+id+'/release',{},loser)).status,403);const released=await f.call('/api/creative-research/'+id+'/release',{},winner);assert.equal(released.status,200);assert.equal(released.data.entry.usage.status,'available');assert.equal((await f.call('/api/creative-research/'+id+'/claim',{},loser)).status,200);
});

test('a holder can release a no-longer-visible guide over HTTP without exposing its changed private body',async t=>{
  const f=await fixture(t),input={schemaVersion:1,reportId:'blind-release-http',date:'2026-10-02',provider:'codex',visibility:'company',shareConfirmed:true,entries:[{...fb,checkedAt:at,research:productionResearch()}]};await f.call('/api/creative-research/import-report',input,f.admin);const id=(await f.call('/api/creative-research',undefined,f.owner)).data.entries[0].id;assert.equal((await f.call('/api/creative-research/'+id+'/claim',{},f.owner)).status,200);
  assert.equal((await f.call('/api/creative-research/'+id,{visibility:'private',title:'PRIVATE_NEW_TITLE'},f.admin)).status,200);assert.equal((await f.call('/api/creative-research/'+id+'/claim',{},f.owner)).status,404);assert.equal((await f.call('/api/creative-research/'+id+'/release',{},f.other)).status,404);
  const release=await f.call('/api/creative-research/'+id+'/release',{},f.owner);assert.equal(release.status,200);assert.deepEqual(release.data,{entry:{id,productionReady:false,usage:{status:'available',canClaim:false,canRelease:false,isMine:false}}});assert.equal(JSON.stringify(release.data).includes('PRIVATE_NEW_TITLE'),false);
});

test('app shutdown waits for import settlement before closing database or writing audits',async t=>{
  const entered=gate(),release=gate(),f=await fixture(t,async()=>{entered.resolve();await release.promise;return adResponse();}),pending=f.call('/api/creative-research/import-top-ad',{url});await entered.promise;let stopped=false;const stop=f.app.stop().then(()=>stopped=true);await Promise.resolve();assert.equal(stopped,false);release.resolve();assert.equal((await pending).status,503);await stop;assert.equal(stopped,true);
});

test('explicit corrections pass through the authenticated report API and completed Doc polling without losing employee claims',async t=>{
  let clock=at,body='';const documentId='correction_http_doc_1234567890',f=await fixture(t,undefined,{clock:()=>clock,creativeResearchReader:async()=>({text:body,modifiedTime:clock})}),run={asOfAt:'2026-10-02T00:40:00Z',researchStartedAt:'2026-10-02T00:40:00Z',researchCompletedAt:'2026-10-02T00:50:00Z'},strong=productionResearch();strong.evidenceLevel='video-watched';strong.productionGuide.appeal='철회할 30초 완벽 이해 주장';
  const base={schemaVersion:1,reportId:'http-original-observation',date:'2026-10-02',provider:'gemini-spark',...run,entries:[{...fb,checkedAt:'2026-10-02T00:45:00Z',research:strong}]},corrected={...base,reportId:'http-explicit-correction',supersedesReportId:base.reportId,entries:[{...base.entries[0],research:productionResearch()}]};
  assert.equal((await f.call('/api/creative-research/import-report',base,f.owner)).status,201);assert.equal((await f.call('/api/creative-research/import-report',corrected,f.other)).status,409);assert.equal((await f.call('/api/creative-research/import-report',corrected,f.viewer)).status,403);
  const manual=await f.call('/api/creative-research/import-report',corrected,f.owner);assert.equal(manual.status,201);assert.equal(manual.data.report.supersedesReportId,base.reportId);assert.equal((await f.call('/api/creative-research',undefined,f.other)).data.entries.length,0);
  f.app.creativeResearchSync.configure(f.admin,{enabled:true,documentId});body=JSON.stringify(base)+'\nSYNK_CREATIVE_RESEARCH_COMPLETE';await f.app.creativeResearchSync.tick();const before=(await f.call('/api/creative-research',undefined,f.owner)).data,shared=before.entries.find(row=>row.visibility==='company');assert.ok(shared);assert.equal((await f.call('/api/creative-research/'+shared.id+'/claim',{},f.owner)).status,200);
  clock='2026-10-02T01:00:30.000Z';body=JSON.stringify(corrected)+'\nSYNK_CREATIVE_RESEARCH_COMPLETE';await f.app.creativeResearchSync.tick();const state=f.app.creativeResearchSync.state(f.admin),after=(await f.call('/api/creative-research',undefined,f.owner)).data,row=after.entries.find(row=>row.id===shared.id);
  assert.equal(state.status,'imported');assert.equal(state.lastReport.supersedesReportId,base.reportId);assert.equal(state.lastReport.updatedCount,1);assert.equal(state.lastReport.addedGuideCount,0);assert.notEqual(after.revision,before.revision);assert.equal(row.research.productionGuide.appeal,productionResearch().productionGuide.appeal);assert.equal(row.productionGuideEvidenceLevel,'page-read');assert.equal(row.checkedAt,shared.checkedAt);assert.equal(row.usage.isMine,true);assert.equal(row.usage.status,'in-use');assert.equal(after.automation.pool.addedCount,1);
  clock='2026-10-02T01:01:00.000Z';await f.app.creativeResearchSync.tick();assert.equal(f.app.store.all('creativeResearchReports').length,4);assert.equal(f.app.store.all('creativeResearchEntries').length,2);
});
