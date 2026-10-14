import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createSocialAiCopy} from './social-ai-copy.mjs';

function fixture(t,options={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-ai-')),store=new Store(directory);let calls=0,at='2026-10-13T00:00:00.000Z',payload;
  const admin=store.createUser({email:'admin@ai.test',name:'합성 관리자',role:'admin'}),viewer=store.createUser({email:'viewer@ai.test',name:'열람자',role:'viewer'});
  store.put('channels','ig',{id:'ig',platform:'instagram',ownerIds:[admin.id],active:true});
  const success=()=>new Response(JSON.stringify({status:'completed',usage:{input_tokens:200,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({variants:[{channelId:'ig',title:'제목 후보',text:'근거가 있는 문구',hashtags:['#한국어']}],warnings:['게시 전 검토']})}]}]}),{status:200,headers:{'Content-Type':'application/json'}});
  const service=createSocialAiCopy({store,clock:()=>at,config:{enabled:true,apiKey:'synthetic',model:'test-model',inputRate:1,outputRate:4,dailyBudget:1,perCallBudget:0.1,...options.config},fetchImpl:async(url,input)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');payload=JSON.parse(input.body);return options.fetchImpl?options.fetchImpl({store,admin,payload}):success();}});
  t.after(async()=>{await service.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  return {store,admin,viewer,service,success,input:{channelIds:['ig'],body:'확정된 원고',language:'ko'},get calls(){return calls;},get payload(){return payload;},advance(ms){at=new Date(Date.parse(at)+ms).toISOString();}};
}
test('disabled copy and cost preview make no paid calls; confirmation is mandatory',async t=>{
  const off=fixture(t,{config:{enabled:false}});assert.equal(off.service.state(off.admin).canUse,false);assert.throws(()=>off.service.quote(off.admin,off.input));assert.equal(off.calls,0);
  const f=fixture(t),q=f.service.quote(f.admin,f.input).quote;assert.ok(q.estimatedMaxUsd>0);assert.equal(f.calls,0);await assert.rejects(()=>f.service.generate(f.admin,{quoteId:q.id}),/예상 비용/);assert.equal(f.calls,0);assert.throws(()=>f.service.quote(f.viewer,f.input),/열람/);
});
test('schema response is an editable draft, cached idempotently, encrypted and never published',async t=>{
  const f=fixture(t),q=f.service.quote(f.admin,f.input).quote,result=await f.service.generate(f.admin,{quoteId:q.id,confirmCost:true});assert.equal(result.publishes,false);assert.equal(result.source,'ai-draft');assert.equal(result.variants[0].text,'근거가 있는 문구');assert.equal(f.payload.store,false);assert.equal(f.payload.text.format.type,'json_schema');assert.equal(f.payload.tools,undefined);assert.equal(f.store.all('socialPublishJobs').length,0);assert.doesNotMatch(JSON.stringify(f.store.all('socialAiQuotes')),/확정된 원고/);assert.doesNotMatch(JSON.stringify(f.store.all('socialAiCalls')),/근거가 있는 문구/);assert.equal((await f.service.generate(f.admin,{quoteId:q.id,confirmCost:true})).replayed,true);assert.equal(f.calls,1);
});
test('daily reservations and duplicate in-flight requests cannot cause extra calls',async t=>{
  let release;const waiting=new Promise(r=>release=r);const f=fixture(t,{config:{dailyBudget:0.03,perCallBudget:0.03},fetchImpl:async()=>{await waiting;return f.success();}}),q=f.service.quote(f.admin,f.input).quote,first=f.service.generate(f.admin,{quoteId:q.id,confirmCost:true});await assert.rejects(()=>f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}),/이미/);release();await first;assert.equal(f.calls,1);assert.ok(f.service.state(f.admin).remainingUsd<0.03);
});
test('uncertain provider outcome keeps reservation and never silently retries',async t=>{
  const f=fixture(t,{fetchImpl:async()=>{throw new Error('synthetic network interruption');}}),q=f.service.quote(f.admin,f.input).quote;await assert.rejects(()=>f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}),/자동 재요청/);await assert.rejects(()=>f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}),/이미/);assert.equal(f.calls,1);assert.equal(f.store.all('socialAiCalls')[0].reservedUsd,q.estimatedMaxUsd);
});
test('expired quote and permission changes prevent requests and disclosure',async t=>{
  const f=fixture(t),q=f.service.quote(f.admin,f.input).quote;f.advance(600001);await assert.rejects(()=>f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}),/시간/);assert.equal(f.calls,0);
  const g=fixture(t,{fetchImpl:async({store,admin})=>{store.put('users',admin.id,{...admin,active:false});return g.success();}}),q2=g.service.quote(g.admin,g.input).quote;await assert.rejects(()=>g.service.generate(g.admin,{quoteId:q2.id,confirmCost:true}),/로그인/);assert.equal(g.store.all('socialAiCalls')[0].status,'unconfirmed');
});
test('incomplete, refused and mismatched target responses cannot become drafts',async t=>{
  for(const output of [{status:'incomplete'}, {status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'synthetic'}]}]}, {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({variants:[{channelId:'other',title:'x',text:'x',hashtags:[]}],warnings:[]})}]}]}]){
    const f=fixture(t,{fetchImpl:async()=>new Response(JSON.stringify(output),{status:200})}),q=f.service.quote(f.admin,f.input).quote;await assert.rejects(()=>f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}));assert.equal(f.store.all('socialAiCalls')[0].status,'unconfirmed');
  }
});


test('expired quotes remove encrypted source while dispatched requests retain only replay metadata',async t=>{
  const f=fixture(t),unused=f.service.quote(f.admin,f.input).quote;
  assert.ok(f.store.get('socialAiQuotes',unused.id).input);f.advance(600001);f.service.prune();assert.equal(f.store.get('socialAiQuotes',unused.id),null);assert.equal(f.calls,0);
  const used=f.service.quote(f.admin,f.input).quote;await f.service.generate(f.admin,{quoteId:used.id,confirmCost:true});
  assert.equal(f.store.get('socialAiQuotes',used.id).input,undefined);
  assert.equal((await f.service.generate(f.admin,{quoteId:used.id,confirmCost:true})).replayed,true);assert.equal(f.calls,1);
});

test('expired result content is purged but limited usage records preserve cost and deduplication',async t=>{
  const f=fixture(t),q=f.service.quote(f.admin,f.input).quote;await f.service.generate(f.admin,{quoteId:q.id,confirmCost:true});
  f.advance(86400001);const cleaned=f.service.prune(),call=f.store.get('socialAiCalls',q.id);
  assert.equal(cleaned.resultsRemoved,1);assert.equal(f.store.get('socialAiQuotes',q.id),null);assert.equal(call.result,undefined);assert.equal(call.status,'expired');assert.equal(call.reservedUsd,q.estimatedMaxUsd);
  await assert.rejects(f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}),{status:404});assert.equal(f.calls,1);
  f.advance(30*86400000);f.service.prune();assert.equal(f.store.get('socialAiCalls',q.id),null);
  assert.deepEqual(f.service.state(f.admin).retention,{quoteMinutes:10,resultHours:24,usageDays:30});
});

test('source is removed after ambiguous dispatch without releasing its conservative budget reservation',async t=>{
  const f=fixture(t,{fetchImpl:async()=>{throw new Error('synthetic lost response');}}),q=f.service.quote(f.admin,f.input).quote;
  await assert.rejects(f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}),{status:502});
  assert.equal(f.store.get('socialAiQuotes',q.id).input,undefined);assert.equal(f.store.get('socialAiCalls',q.id).reservedUsd,q.estimatedMaxUsd);assert.equal(f.store.get('socialAiCalls',q.id).status,'unconfirmed');
});

test('empty body, absent schema fields and extra output fields cannot become accepted drafts',async t=>{
  for(const variant of [{channelId:'ig',title:'제목',text:' ',hashtags:[]},{channelId:'ig',text:'본문',hashtags:[]},{channelId:'ig',title:'제목',text:'본문',hashtags:[],private:'unexpected'},null]){
    const f=fixture(t,{fetchImpl:async()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({variants:[variant],warnings:[]})}]}]}),{status:200})}),q=f.service.quote(f.admin,f.input).quote;
    await assert.rejects(f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}),{status:502});assert.equal(f.store.get('socialAiCalls',q.id).status,'unconfirmed');assert.equal(f.store.get('socialAiCalls',q.id).result,undefined);
  }
});

test('cached generation is not disclosed after channel write access is revoked',async t=>{
  const f=fixture(t),q=f.service.quote(f.admin,f.input).quote;await f.service.generate(f.admin,{quoteId:q.id,confirmCost:true});
  f.store.put('users',f.admin.id,{...f.admin,role:'member'});f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[]});
  await assert.rejects(f.service.generate(f.admin,{quoteId:q.id,confirmCost:true}),{status:403});assert.equal(f.calls,1);
});

test('malformed quote or confirmation inputs fail before reserving money or making a request',async t=>{
  const f=fixture(t);for(const input of [null,[],false]){assert.throws(()=>f.service.quote(f.admin,input),{status:400});await assert.rejects(f.service.generate(f.admin,input),{status:400});}
  assert.equal(f.calls,0);assert.equal(f.store.all('socialAiCalls').length,0);
});
