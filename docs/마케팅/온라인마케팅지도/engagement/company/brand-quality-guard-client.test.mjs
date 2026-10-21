import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
// 브랜드 제작실 · 품질·운영 확인의 상태 보호 시험 — 운영 판에만 있던 옛 brand-quality-client.test.mjs의 시험 일곱(13판 화면에서도 그대로 통과)을 2026-10-21 master로 옮겼다. 저장된 XSS 값 시험은 13판 함수 이름으로 brand-quality-client.test.mjs에 있다.
const source=readFileSync(new URL('./public/brand-quality.js',import.meta.url),'utf8');
const fixture=(api=async()=>({recipes:[],operations:[],sources:[],checks:[],canWrite:true}))=>{const context=vm.createContext({state:{user:{id:'one',role:'member'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'brand'},document:{addEventListener(){}},window:{addEventListener(){}},api,render(){},notify(){},URL,structuredClone,confirm:()=>true,escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')});vm.runInContext(source,context);return {context,run:code=>vm.runInContext(code,context)};};
test('stale load after logout cannot restore private records',async()=>{let resolve;const {run}=fixture(()=>new Promise(done=>{resolve=done;}));run('brandQualityEnsure()');run('state.user=null; brandQualityReset()');resolve({recipes:[{title:'private'}]});await new Promise(done=>setImmediate(done));assert.equal(run('bq.data'),null);assert.equal(run('bq.userId'),null);});
test('failed load does not loop on subsequent render or ensure calls',async()=>{let count=0;const {run}=fixture(async()=>{count++;throw new Error('unavailable');});run('brandQualityEnsure()');await new Promise(done=>setImmediate(done));run('brandQualityEnsure()');assert.equal(count,1);assert.equal(run('bq.error'),'unavailable');});
test('save failure preserves editable draft and dirty state',async()=>{const {run}=fixture(async()=>{throw new Error('다른 창에서 변경된 기록');});run('bq.userId="one"; bq.data={canWrite:true,recipes:[],operations:[]}; bq.drafts.brand={id:"record",revision:1,title:"keep me",version:{label:"",body:"",url:""}}; bq.dirty.brand=true');await run('bqSave("brand")');assert.equal(run('bq.drafts.brand.title'),'keep me');assert.equal(run('bq.dirty.brand'),true);assert.equal(run('bq.saving'),false);assert.match(run('bq.error'),/다른 창/);});
test('old-account draft is never submitted by a newly signed-in user',async()=>{let calls=0;const {run}=fixture(async()=>{calls++;return {};});run('bq.userId="one"; bq.data={canWrite:true}; bq.drafts.brand={title:"private draft"}; state.user={id:"two"}');await run('bqSave("brand")');assert.equal(calls,0);});

const qualityRecord=()=>({id:'record',revision:1,title:'확인한 서비스',targetUrl:'https://synk.im/',checks:{mobile:{status:'pass',evidence:'실제 버튼과 이동 확인',environment:'iPhone Safari',checkedAt:'2026-10-08T00:00:00.000Z'}}});
function qualityFixture(api){const fixtureResult=fixture(api);fixtureResult.context.original=qualityRecord();fixtureResult.run('bq.userId="one"; bq.data={canWrite:true,recipes:[],operations:[original]}; bqSetDraft("quality",original); bq.dirty.quality=true');return fixtureResult;}
test('equivalent URL spellings preserve verified checks when saving',async()=>{
  for(const targetUrl of ['https://synk.im','https://SYNK.IM:443/',' https://synk.im/ ']){
    let submitted;const {run,context}=qualityFixture(async(_url,body)=>{submitted=body;return {operation:{...body,revision:2}};});
    context.targetUrl=targetUrl;run('bq.drafts.quality.targetUrl=targetUrl');await run('bqSave("quality")');
    assert.deepEqual(submitted.checks,qualityRecord().checks,targetUrl);
    assert.equal(run('bq.drafts.quality.checks.mobile.status'),'pass');
  }
});
test('failed target URL save preserves all evidence in the editable draft',async()=>{
  let submitted;const {run}=qualityFixture(async(_url,body)=>{submitted=body;throw new Error('다른 창에서 변경된 기록');});
  run('bq.drafts.quality.targetUrl="https://synk.im/new/"');const before=run('JSON.stringify(bq.drafts.quality)');
  await run('bqSave("quality")');assert.equal(submitted.checks.mobile.status,'unverified');
  assert.equal(run('JSON.stringify(bq.drafts.quality)'),before);assert.equal(run('bq.dirty.quality'),true);
  assert.equal(run('bq.saving'),false);assert.match(run('bq.error'),/다른 창/);
});
test('successful target change resets checks only after the saved result arrives',async()=>{
  let resolve;const {run}=qualityFixture((_url,body)=>new Promise(done=>{resolve=()=>done({operation:{...body,revision:2}});}));
  run('bq.drafts.quality.targetUrl="https://synk.im/new/"');const pending=run('bqSave("quality")');
  assert.equal(run('bq.drafts.quality.checks.mobile.status'),'pass');resolve();await pending;
  assert.equal(run('bq.drafts.quality.checks.mobile.status'),'unverified');assert.equal(run('bq.drafts.quality.checks.mobile.evidence'),'');
  assert.equal(run('bq.dirty.quality'),false);
});
