import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {normalizeBenchmarkReport,normalizeBenchmarkUrl} from './benchmarks.mjs';

const NOW='2026-09-27T06:00:00.000Z',seriesIds=['synkbrief-use'];
const sample=()=>({version:1,title:'한국어 AI 활용 조사',scope:'한국어 AI 활용 릴스 · 직접 확인한 후보',periodStart:'2026-09-01',periodEnd:'2026-09-27',researchedAt:'2026-09-27T00:00:00Z',candidateCount:12,selectionBasis:'실제 반응과 따라 하기 쉬운 정보 구조를 함께 검토',items:[{title:'회의록 검토 순서',url:'https://www.instagram.com/reel/research1/?igsh=tracking',platform:'instagram',creator:'연구 대상 작성자',publishedAt:'2026-09-25',checkedAt:'2026-09-26T08:00:00Z',metrics:{views:1200,likes:0,comments:null,shares:null,saves:null,followers:null},evidenceNote:'원문 화면에서 조회수와 좋아요를 확인함. 저장·공유는 확인 불가.',hook:'결과 두 개를 먼저 비교',structure:'원본 제시 → 판단 기준 → 결과 검토',payoff:'비교하면서 차이를 발견',brandFit:'직접 해볼 수 있는 업무 정보',adaptation:'우리 회의록 사례로 검토 순서를 보여준다.',seriesIds:['synkbrief-use']}]});
const normalize=report=>normalizeBenchmarkReport(report,{now:NOW,seriesIds});
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'synk-benchmark-'));let at=NOW,fetchCalls=0;
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,clock:()=>at,contentFetch:async()=>{fetchCalls++;throw new Error('unexpected API call');}}),address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(dir.includes('synk-benchmark-'));await rm(dir,{recursive:true,force:true});});
  const users={},sessions={};for(const role of ['admin','manager','member','viewer']){users[role]=app.store.createUser({name:role,email:role+'@example.test',role,teamId:role==='admin'?null:'team-a'});sessions[role]=app.store.mint('session',users[role].id,{csrfToken:'csrf-test'},10);}
  const call=async(path,body,user='admin',headers={})=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(user?{Cookie:`synk_company_session=${sessions[user]}`} : {}),...(body===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'csrf-test'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};};
  return {app,users,call,setAt:value=>{at=value;},get fetchCalls(){return fetchCalls;}};
}

test('benchmark report normalizes ranked scope-selected items, unknown metrics and plain text without invented counts',()=>{
  const raw=sample();raw.title='<img src=x onerror=alert(1)>한국어 조사';raw.items[0].id='forged';raw.items[0].metrics.likes=0;
  const result=normalize(JSON.stringify(raw));assert.equal(result.report.title,'한국어 조사');assert.equal(result.report.items[0].id,'item-1');assert.equal(result.report.items[0].rank,1);assert.equal(result.report.items[0].metrics.likes,0);assert.equal(result.report.items[0].metrics.shares,null);assert.equal(result.report.items[0].url,'https://www.instagram.com/reel/research1/');assert.ok(result.warnings.some(x=>x.includes('1/5')));assert.ok(result.warnings.some(x=>x.includes('전체 순위')));
  const twice=normalize(result.report);assert.deepEqual(twice.report,result.report,'preview normalized output remains valid when published');
});

test('only official HTTPS content URLs are allowed; tracking is dropped and YouTube aliases deduplicate',()=>{
  for(const [url,platform] of [['https://www.instagram.com/reel/Ab_c-1/','instagram'],['https://www.youtube.com/watch?v=abcdefghijk&feature=share','youtube'],['https://youtube.com/shorts/abcdefghijk','youtube'],['https://youtu.be/abcdefghijk?si=tracking','youtube'],['https://www.tiktok.com/@creator/video/1234567890123456789','tiktok'],['https://www.facebook.com/reel/123456789','facebook']])assert.equal(normalizeBenchmarkUrl(url).platform,platform);
  for(const url of ['javascript:alert(1)','data:text/html,<script>bad</script>','http://www.instagram.com/reel/a/','https://instagram.com.evil.test/reel/a/','https://instagram.com@evil.test/reel/a/','https://127.0.0.1/reel/a/','https://www.instagram.com:444/reel/a/','https://www.instagram.com/p/a/','https://www.youtube.com/redirect?q=https://evil.test','https://www.youtube.com/watch?v=abcdefghijk&v=aaaaaaaaaaa','https://www.facebook.com/profile.php?id=123','https://www.tiktok.com/@creator'])assert.throws(()=>normalizeBenchmarkUrl(url));
  const report=sample();report.items[0]={...report.items[0],platform:'youtube',url:'https://youtu.be/abcdefghijk'};report.items.push({...report.items[0],url:'https://www.youtube.com/shorts/abcdefghijk'});assert.throws(()=>normalize(report),/두 번/);
});

test('validation rejects unsupported schema, missing evidence, followers-only, fabricated numeric strings, ranks and series',()=>{
  for(const change of [r=>{r.version=2;},r=>{r.items=[];},r=>{r.items=Array(6).fill(r.items[0]);},r=>{r.candidateCount=0;},r=>{r.items[0].evidenceNote='';},r=>{r.items[0].metrics={followers:99999};},r=>{r.items[0].metrics={views:'1200'};},r=>{r.items[0].metrics={views:-1};},r=>{r.items[0].metrics={views:0};},r=>{r.items[0].rank=2;},r=>{r.items[0].platform='youtube';},r=>{r.items[0].seriesIds=['not-company-series'];},r=>{r.title='x'.repeat(161);},r=>{r.items[0].structure=['not string'];}]){const r=sample();change(r);assert.throws(()=>normalize(r));}
  assert.throws(()=>normalize('{not-json}'));assert.throws(()=>normalize('x'.repeat(102401)),error=>error.status===413);
});

test('periods include at most 30 KST calendar days and reject future, invalid and inconsistent observations',()=>{
  const thirty=sample();thirty.periodStart='2026-08-29';assert.doesNotThrow(()=>normalize(thirty));thirty.periodStart='2026-08-28';assert.throws(()=>normalize(thirty),/1~30/);
  for(const change of [r=>{r.periodStart='2026-02-30';},r=>{r.periodStart='2026-09-28';},r=>{r.researchedAt='2026-09-28T00:00:00Z';},r=>{r.items[0].checkedAt='2026-09-27T07:00:00Z';},r=>{r.items[0].publishedAt='2026-08-31';},r=>{r.items[0].checkedAt='2026-09-24T00:00:00Z';},r=>{r.items[0].checkedAt='2026-09-26';}]){const r=sample();change(r);assert.throws(()=>normalize(r));}
  const r=sample();r.items[0].publishedAt='2026-09-24T16:00:00Z';r.periodStart='2026-09-25';assert.doesNotThrow(()=>normalize(r),'UTC late night belongs to the next KST calendar day');
});

test('only administrators can preview or publish; preview never writes and explicit review is required',async t=>{
  const f=await fixture(t);assert.equal((await f.call('/api/content-workspace')).data.benchmark.current,null);
  for(const role of ['manager','member','viewer'])for(const path of ['/api/content-benchmarks/preview','/api/content-benchmarks'])assert.equal((await f.call(path,{report:sample(),reviewConfirmed:true},role)).status,403);
  assert.equal((await f.call('/api/content-benchmarks/preview',{report:sample()},null)).status,403);
  assert.equal((await f.call('/api/content-benchmarks/preview',{report:sample()},'admin',{'X-CSRF-Token':'wrong'})).status,403);
  const preview=await f.call('/api/content-benchmarks/preview',{report:JSON.stringify(sample())});assert.equal(preview.status,200);assert.equal(f.app.store.all('contentBenchmarkIssues').length,0);
  assert.equal((await f.call('/api/content-benchmarks',{report:preview.data.report})).status,400);
  const published=await f.call('/api/content-benchmarks',{report:preview.data.report,reviewConfirmed:true,publishedByName:'forged'});assert.equal(published.status,201);assert.equal(published.data.issue.publishedByName,'admin');assert.equal(published.data.issue.evidenceStatus,'admin-submitted');assert.equal(published.data.issue.stale,false);assert.equal(f.fetchCalls,0);
  for(const role of ['admin','manager','member','viewer']){const w=await f.call('/api/content-workspace',undefined,role);assert.equal(w.data.benchmark.current.id,published.data.issue.id);assert.equal((await f.call('/api/content-benchmarks/'+published.data.issue.id,undefined,role)).status,200);}
  assert.equal((await f.call('/api/content-benchmarks/'+published.data.issue.id,undefined,null)).status,401);
});

test('new publications preserve immutable history and age from research time, including deliberately old reports',async t=>{
  const f=await fixture(t),old=sample();old.title='8월 조사';old.periodStart='2026-08-01';old.periodEnd='2026-08-27';old.researchedAt='2026-08-27T00:00:00Z';old.items[0].publishedAt='2026-08-25';old.items[0].checkedAt='2026-08-26T00:00:00Z';
  const first=await f.call('/api/content-benchmarks',{report:old,reviewConfirmed:true});assert.equal(first.status,201);assert.equal(first.data.issue.stale,true);assert.ok(first.data.issue.ageDays>=31);
  const second=await f.call('/api/content-benchmarks',{report:sample(),reviewConfirmed:true});assert.equal(second.status,201);assert.notEqual(second.data.issue.id,first.data.issue.id);
  const workspace=(await f.call('/api/content-workspace',undefined,'member')).data.benchmark;assert.equal(workspace.current.id,second.data.issue.id);assert.equal(workspace.history.length,2);assert.ok(workspace.history.every(row=>!('items' in row)));assert.equal(workspace.history[0].itemCount,1);
  const retained=await f.call('/api/content-benchmarks/'+first.data.issue.id,undefined,'viewer');assert.equal(retained.data.issue.title,'8월 조사');assert.equal(retained.data.issue.items[0].publishedAt,'2026-08-25');
  f.setAt('2026-10-04T00:00:00.000Z');const aged=await f.call('/api/content-benchmarks/'+second.data.issue.id,undefined,'member');assert.equal(aged.data.issue.ageDays,7);assert.equal(aged.data.issue.stale,true);
});

test('staff can plan from company benchmarks with personalization while private reference permissions stay intact',async t=>{
  const f=await fixture(t),published=await f.call('/api/content-benchmarks',{report:sample(),reviewConfirmed:true}),issue=published.data.issue;
  const input={seriesId:'synkbrief-use',topic:'우리 회의록 확인',benchmarkId:issue.id,benchmarkItemId:issue.items[0].id,personalization:{situation:'회의를 처음 진행하는 사람',choice:'빠른 요약과 원문 확인 중 먼저 할 것',nextStep:'회의록 한 문장을 직접 대조한다.'}};
  const made=await f.call('/api/content-generate',input,'member');assert.equal(made.status,201);const d=made.data.draft;assert.equal(d.ownerId,f.users.member.id);assert.equal(d.referenceId,null);assert.equal(d.input.benchmarkId,issue.id);assert.deepEqual(d.input.personalization,input.personalization);assert.equal(d.plan.benchmark.id,issue.id);assert.equal(d.plan.benchmark.itemId,'item-1');assert.equal(d.plan.input.reference.hook,sample().items[0].hook);assert.equal(d.plan.input.reference.adaptation,sample().items[0].adaptation);assert.equal(f.app.store.all('contentReferences').length,0);
  assert.equal((await f.call('/api/content-generate',{...input,benchmarkItemId:undefined},'member')).status,400);
  assert.equal((await f.call('/api/content-generate',{...input,benchmarkItemId:'not-in-issue'},'member')).status,404);
  assert.equal((await f.call('/api/content-generate',{...input,benchmarkId:'missing'},'member')).status,404);
  assert.equal((await f.call('/api/content-generate',{...input,personalization:{situation:'x'.repeat(2001)}},'member')).status,400);
  assert.equal((await f.call('/api/content-generate',input,'viewer')).status,403);
  const reference=await f.call('/api/content-references',{url:'https://www.instagram.com/reel/private1/',title:'관리자 개인 자료'});
  assert.equal((await f.call('/api/content-generate',{...input,referenceId:reference.data.reference.id},'member')).status,400);
  assert.equal((await f.call('/api/content-generate',{seriesId:input.seriesId,topic:input.topic,referenceId:reference.data.reference.id},'member')).status,404);
  assert.equal((await f.call('/api/content-drafts/'+d.id,undefined,'manager')).status,404,'shared benchmark must not publish the employee draft');
  assert.equal(f.fetchCalls,0);
});

test('admin research assets are scoped and the blank template cannot be mistaken for evidence',async t=>{
  const f=await fixture(t);
  for(const path of ['/api/content-benchmarks/research-prompt','/api/content-benchmarks/template']){assert.equal((await f.call(path,undefined,null)).status,401);for(const role of ['manager','member','viewer'])assert.equal((await f.call(path,undefined,role)).status,403);}
  const prompt=await f.call('/api/content-benchmarks/research-prompt');assert.equal(prompt.status,200);assert.equal(typeof prompt.data.prompt,'string');assert.ok(prompt.data.prompt.length>100);
  const template=await f.call('/api/content-benchmarks/template');assert.equal(template.status,200);assert.equal(template.data.template.version,1);assert.equal((await f.call('/api/content-benchmarks/preview',{report:template.data.template})).status,400);assert.equal(f.app.store.all('contentBenchmarkIssues').length,0);
});

test('localOnly search never calls a configured provider and benchmark browsing makes no API requests',async t=>{
  const f=await fixture(t);await f.call('/api/content-search-settings',{apiKey:'deliberate-fixture-key'});
  const result=await f.call('/api/content-search',{query:'회의록',localOnly:true},'member');assert.equal(result.status,200);assert.equal(result.data.mode,'local');assert.equal(f.fetchCalls,0);
  assert.equal((await f.call('/api/content-search',{query:'회의록',localOnly:'true'},'member')).status,400);
  await f.call('/api/content-workspace',undefined,'member');assert.equal(f.fetchCalls,0);
});
