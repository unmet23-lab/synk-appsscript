import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runCreativeResearchReport,reportOrigin,creativeResearchReceiptDirectory} from '../creative-research-report.mjs';

const at='2026-10-09T04:00:00.000Z';
const session='private_session_fixture_1234567890',csrf='private_csrf_fixture_1234567890';
const auth={SYNK_CREATIVE_RESEARCH_SESSION:session,SYNK_CREATIVE_RESEARCH_CSRF:csrf};
const privateText='PRIVATE_REPORT_TEXT_NEVER_PRINT';
const sample=()=>({schemaVersion:1,reportId:'2026-10-09-fixture',date:'2026-10-09',provider:'gemini-spark',entries:[{source:'instagram',kind:'best-practice',title:privateText,sourceUrl:'https://creators.instagram.com/blog/fixture',checkedAt:'2026-10-09T03:00:00.000Z',adaptation:privateText}],visibility:'private'});
const guideSample=()=>({schemaVersion:1,reportId:'2026-10-09-ready-guide-fixture',date:'2026-10-09',provider:'gemini-spark',entries:[{source:'youtube-trends',kind:'recent-video',title:privateText,sourceUrl:'https://www.youtube.com/watch?v=abcdefghijk',region:'KR',checkedAt:'2026-10-09T03:00:00.000Z',research:{summary:'실제 결과 화면을 먼저 보여 주고 입력 조건을 바꿔 비교하는 제작 구조',whyNow:'이번 가상 시험의 개별 원문 확인 범위',viewerReason:'자기 상황의 결과가 어떻게 달라지는지 직접 보고 선택한다.',brands:['LAB'],priority:'medium',observedFacts:[{text:'이 가상 원문에서 결과→조건 선택→결과 비교의 순서를 관찰했다.',sourceUrl:'https://www.youtube.com/watch?v=abcdefghijk'}],evidenceLevel:'video-watched',limitations:'합성 CLI 시험 자료이며 실제 콘텐츠·성과의 증거가 아니다.',publishedAt:null,applications:[{brand:'LAB',idea:'학습자의 상황에 맞춘 짧은 결과 비교',zeroSecondHook:'두 상황의 한국어 결과 화면을 먼저 보여준다.',action:'자신의 상황 한 가지를 고른다.',reward:'고른 상황의 표현을 바로 확인한다.',personalizationTool:'준비 제안: 선택한 상황으로 달라지는 문장 틀',validation72h:'씨앗 계정에 실제 게시한 뒤 저장·댓글·도구 진입을 비교한다.'}],productionGuide:{formatName:'결과 먼저 조건 비교',productionSteps:[{order:1,title:'우리 실제 화면 준비',instruction:'제작자가 사용할 실제 연습 화면의 두 조건을 준비하고 개인 정보를 가린다.'},{order:2,title:'조건 변화 녹화',instruction:'결과 화면→조건 선택→다른 결과를 같은 화면 크기로 녹화하여 무엇이 달라지는지 연결한다.'},{order:3,title:'선택과 보상 점검',instruction:'코랄 표지와 큰 한글로 조건을 표시하고 실제 재생·발음·문장 결과·다음 선택을 확인한다.'}],requiredAssets:['직원이 준비한 두 조건의 실제 연습 화면','승인 LAB 코랄 키트와 한글 서체'],brandAdaptation:'원문의 비교 구조를 학습자의 실제 상황 선택으로 바꾸고 LAB 코랄·큰 한글·실제 표현 확인을 연결한다.',appeal:'학습자는 자신의 상황을 직접 고르고 달라진 표현을 확인하는 재미와 정보를 얻는다.',estimatedMinutes:45}}}],visibility:'private'});
const success=report=>({report:{id:'server-report-id',reportId:report.reportId,date:report.date,provider:report.provider,status:report.entries.length?'imported':'empty',checkedAt:at,importedAt:at,createdCount:report.entries.length,updatedCount:0,retainedCount:0,itemCount:report.entries.length,...Object.fromEntries(['asOfAt','researchStartedAt','researchCompletedAt'].filter(key=>report[key]!==undefined).map(key=>[key,report[key]]))},existing:false,entries:[{title:privateText,note:session,token:csrf}]});
const timedSample=()=>({...guideSample(),asOfAt:'2026-10-09T02:00:00.000Z',researchStartedAt:'2026-10-09T02:00:00.000Z',researchCompletedAt:'2026-10-09T03:30:00.000Z'});

async function fixture(t,input=sample()){
  const directory=await mkdtemp(join(tmpdir(),'synk-research-cli-')),report=join(directory,'report.json'),receipts=join(directory,'receipts'),original=JSON.stringify(input,null,2);
  await writeFile(report,original);t.after(async()=>{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  async function run(argv,extra={}){
    const output=[],errors=[];const result=await runCreativeResearchReport({argv,env:{},clock:()=>at,stdout:s=>output.push(s),stderr:s=>errors.push(s),...extra});
    return {...result,output,errors};
  }
  return {directory,report,receipts,original,input,run};
}

async function httpFixture(t,handler){
  const requests=[];const server=createServer(async(req,res)=>{const parts=[];for await(const part of req)parts.push(part);requests.push({url:req.url,headers:req.headers,body:Buffer.concat(parts).toString('utf8')});await handler(req,res,requests.at(-1));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  return {origin:`http://127.0.0.1:${server.address().port}`,requests};
}

function noPrivate(value){const output=typeof value==='string'?value:JSON.stringify(value);for(const secret of [privateText,session,csrf])assert.equal(output.includes(secret),false);}

test('local validation uses the shared schema and prints only report metadata without writing or sending',async t=>{
  const f=await fixture(t);let calls=0;
  const result=await f.run(['--report',f.report,'--validate'],{fetchImpl:async()=>{calls++;throw Error('must not send');}});
  assert.equal(result.exitCode,0);assert.deepEqual(JSON.parse(result.output[0]),{valid:true,schemaVersion:1,date:'2026-10-09',provider:'gemini-spark',entryCount:1});assert.equal(calls,0);noPrivate(result.output);assert.deepEqual(await readdir(f.directory),['report.json']);assert.equal(await readFile(f.report,'utf8'),f.original);
});

test('an invalid schema or stale report fails before any HTTP request and preserves the input',async t=>{
  for(const change of [{generatedAt:at},{date:'2026-10-01'},{entries:[{...sample().entries[0],sourceUrl:'https://private.example/report'}]}]){
    const f=await fixture(t,{...sample(),...change});let calls=0;
    const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im'],{env:auth,fetchImpl:async()=>{calls++;throw Error('must not send');}});
    assert.equal(result.exitCode,1);assert.equal(result.result.code,'REPORT_INVALID');assert.equal(calls,0);noPrivate(result.errors);assert.equal(await readFile(f.report,'utf8'),f.original);
  }
});

test('a concrete production guide uses the shared validator and stays private in metadata output',async t=>{
  const f=await fixture(t,guideSample());let calls=0;
  const result=await f.run(['--report',f.report,'--validate'],{fetchImpl:async()=>{calls++;}});
  assert.equal(result.exitCode,0);assert.equal(result.result.entryCount,1);assert.equal(calls,0);noPrivate(result.output);assert.equal(result.output[0].includes('productionSteps'),false);assert.equal(await readFile(f.report,'utf8'),f.original);
});

test('guide uploads preserve all detailed production fields without logging the source, guide or authentication',async t=>{
  const f=await fixture(t,guideSample());let sent;
  const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify(success(sent)),{status:201,headers:{'Content-Type':'application/json'}});}});
  assert.equal(result.exitCode,0);assert.deepEqual(sent.entries[0].research.productionGuide,f.input.entries[0].research.productionGuide);assert.deepEqual(sent.entries[0].research.applications,f.input.entries[0].research.applications);noPrivate(result.output);assert.equal(result.output[0].includes('brandAdaptation'),false);assert.equal(await readFile(f.report,'utf8'),f.original);
});

test('actual run timestamps validate locally without changing the metadata-only output contract',async t=>{
  const f=await fixture(t,timedSample());let calls=0;const result=await f.run(['--report',f.report,'--validate'],{fetchImpl:async()=>{calls++;}});assert.equal(result.exitCode,0);assert.deepEqual(result.result,{valid:true,schemaVersion:1,date:'2026-10-09',provider:'gemini-spark',entryCount:1});assert.equal(calls,0);noPrivate(result.output);assert.equal(result.output[0].includes('researchStartedAt'),false);assert.equal(await readFile(f.report,'utf8'),f.original);
});

test('timestamped uploads preserve original publication and observation dates and save only safe run metadata',async t=>{
  const input=timedSample();input.entries[0].research.publishedAt='2026-10-01T01:00:00.000Z';const f=await fixture(t,input);let sent;const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify(success(sent)),{status:201,headers:{'Content-Type':'application/json'}});}});assert.equal(result.exitCode,0);for(const key of ['asOfAt','researchStartedAt','researchCompletedAt'])assert.equal(result.result[key],input[key]);assert.equal(sent.entries[0].checkedAt,input.entries[0].checkedAt);assert.equal(sent.entries[0].research.publishedAt,input.entries[0].research.publishedAt);const file=(await readdir(f.receipts))[0],receipt=await readFile(join(f.receipts,file),'utf8');noPrivate(receipt);assert.equal(receipt.includes('publishedAt'),false);assert.equal(receipt.includes('productionGuide'),false);assert.equal(await readFile(f.report,'utf8'),f.original);
});

test('a run crossing Korean midnight keeps the previous-day observation instead of relabeling the source',async t=>{
  const input=timedSample();Object.assign(input,{researchStartedAt:'2026-10-08T14:50:00.000Z',asOfAt:'2026-10-08T14:50:00.000Z',researchCompletedAt:'2026-10-08T15:05:00.000Z'});input.entries[0].checkedAt='2026-10-08T14:55:00.000Z';const f=await fixture(t,input);let sent;const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify(success(sent)),{status:201,headers:{'Content-Type':'application/json'}});}});assert.equal(result.exitCode,0);assert.equal(sent.date,'2026-10-09');assert.equal(sent.entries[0].checkedAt,'2026-10-08T14:55:00.000Z');assert.equal(sent.researchCompletedAt,'2026-10-08T15:05:00.000Z');noPrivate(result.output);
});

test('partial, future, misordered and out-of-window run times fail before authenticated upload',async t=>{
  for(const change of [report=>{delete report.researchCompletedAt;},report=>{report.asOfAt='not-a-time';},report=>{report.researchStartedAt='2026-10-09T02:30:00.000Z';},report=>{report.researchCompletedAt='2026-10-09T04:00:01.000Z';},report=>{report.entries[0].checkedAt='2026-10-09T01:59:59.000Z';},report=>{report.entries[0].checkedAt='2026-10-09T03:30:01.000Z';},report=>{report.date='2026-10-08';}]){const input=timedSample();change(input);const f=await fixture(t,input);let calls=0;const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async()=>{calls++;}});assert.equal(result.exitCode,1);assert.equal(result.result.code,'REPORT_INVALID');assert.equal(calls,0);noPrivate(result.errors);assert.equal(await readFile(f.report,'utf8'),f.original);}
});

test('HTTP run metadata must match the exact validated report before an upload receipt is confirmed',async t=>{
  const f=await fixture(t,timedSample());for(const change of [{asOfAt:undefined},{researchCompletedAt:'2026-10-09T03:29:00.000Z'}]){const payload=success(f.input);Object.assign(payload.report,change);const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async()=>new Response(JSON.stringify(payload),{status:201,headers:{'Content-Type':'application/json'}})});assert.equal(result.exitCode,1);assert.equal(result.result.code,'HTTP_RESPONSE_INVALID');noPrivate(result.errors);}assert.equal((await readdir(f.directory)).includes('receipts'),false);
});

test('the Spark producer template uses live time lookup and distinct placeholders rather than fixed runtime timestamps',async()=>{
  const prompt=await readFile(new URL('../creative-research-spark-prompt.txt',import.meta.url),'utf8');assert.ok(prompt.includes('https://workspace.synk.im/api/creative-research/time'));assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(prompt),false);for(const placeholder of ['"asOfAt":"실제기준ISO"','"researchStartedAt":"실제시작ISO"','"researchCompletedAt":"실제완료ISO"'])assert.ok(prompt.includes(placeholder));assert.ok(prompt.includes('기본05시 Doc를 대신 덮어쓰지'));assert.ok(prompt.includes('전체 계정과 회차를 합친 하루 신규 약10개'));
});

test('native fallback times require seconds and bounded precision before upload',async t=>{
  for(const timestamp of ['2026-10-09T11:00:00.123456+09:00','2026-10-09T11:00+09:00','2026-10-09T11:00:00.123+0900']){
    const input=timedSample();input.asOfAt=timestamp;const f=await fixture(t,input);let calls=0;
    const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im'],{env:auth,fetchImpl:async()=>{calls++;throw Error('unformatted native clock must not send');}});
    assert.equal(result.exitCode,1);assert.equal(result.result.code,'REPORT_INVALID');assert.equal(calls,0);noPrivate(result.errors);
  }
});

test('documented fallback normalization uploads the same UTC instant and preserves original evidence dates',async t=>{
  const input=timedSample(),rawStart='2026-10-09T11:00:00.123456+09:00',rawComplete='2026-10-09T12:30:00.987654+09:00';
  input.researchStartedAt=new Date(rawStart).toISOString();input.asOfAt=input.researchStartedAt;input.researchCompletedAt=new Date(rawComplete).toISOString();input.entries[0].research.publishedAt='2026-10-01T01:00:00.000Z';
  assert.equal(input.researchStartedAt,'2026-10-09T02:00:00.123Z');assert.equal(input.researchCompletedAt,'2026-10-09T03:30:00.987Z');
  const f=await fixture(t,input);let sent;const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify(success(sent)),{status:201,headers:{'Content-Type':'application/json'}});}});
  assert.equal(result.exitCode,0);for(const key of ['researchStartedAt','asOfAt','researchCompletedAt'])assert.equal(sent[key],input[key]);assert.equal(sent.entries[0].checkedAt,input.entries[0].checkedAt);assert.equal(sent.entries[0].research.publishedAt,input.entries[0].research.publishedAt);noPrivate(result.output);assert.equal(await readFile(f.report,'utf8'),f.original);
  const prompt=await readFile(new URL('../creative-research-spark-prompt.txt',import.meta.url),'utf8'),producer=await readFile(new URL('../../../docs/마케팅/온라인마케팅지도/engagement/company/CREATIVE-RESEARCH-PRODUCER.md',import.meta.url),'utf8');
  for(const text of [prompt,producer]){assert.ok(text.includes('YYYY-MM-DDTHH:mm:ss.sssZ'));assert.ok(text.includes('반올림하지'));assert.ok(text.includes('초가'));assert.ok(text.includes('±HH:MM'));}
});

test('daily guide admission receipts preserve optional accepted, deferred and added counts without changing legacy v1',async t=>{
  const input=guideSample();input.entries.push({...structuredClone(input.entries[0]),sourceUrl:'https://www.youtube.com/watch?v=lmnopqrstuv'});
  const f=await fixture(t,input),payload=success(f.input);Object.assign(payload.report,{createdCount:1,acceptedCount:1,deferredCount:1,addedGuideCount:1});
  const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async()=>new Response(JSON.stringify(payload),{status:201,headers:{'Content-Type':'application/json'}})});
  assert.equal(result.exitCode,0);assert.equal(result.result.itemCount,2);assert.equal(result.result.acceptedCount,1);assert.equal(result.result.deferredCount,1);assert.equal(result.result.addedGuideCount,1);noPrivate(result.output);const file=(await readdir(f.receipts))[0],receipt=JSON.parse(await readFile(join(f.receipts,file),'utf8'));assert.equal(receipt.deferredCount,1);assert.equal(receipt.addedGuideCount,1);
  for(const change of [{deferredCount:'1'},{acceptedCount:2,deferredCount:1},{addedGuideCount:11}]){
    const invalid={...payload,report:{...payload.report,...change}},r=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async()=>new Response(JSON.stringify(invalid),{status:201,headers:{'Content-Type':'application/json'}})});assert.equal(r.result.code,'HTTP_RESPONSE_INVALID');noPrivate(r.errors);
  }
});

test('incomplete guides and reference-only observations fail before any authenticated upload',async t=>{
  for(const change of [report=>{report.entries[0].research.productionGuide.productionSteps[1].order=3;},report=>{report.entries[0].research.applications=[];},report=>{report.entries[0].research.evidenceLevel='metadata-only';},report=>{report.entries[0].source='instagram';report.entries[0].kind='best-practice';report.entries[0].sourceUrl='https://creators.instagram.com/blog/fixture';report.entries[0].research.observedFacts[0].sourceUrl=report.entries[0].sourceUrl;}]){
    const input=guideSample();change(input);const f=await fixture(t,input);let calls=0;
    const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async()=>{calls++;}});
    assert.equal(result.exitCode,1);assert.equal(result.result.code,'REPORT_INVALID');assert.equal(calls,0);noPrivate(result.errors);assert.equal(await readFile(f.report,'utf8'),f.original);
  }
});

test('missing authentication only reads the report and sends nothing',async t=>{
  const f=await fixture(t);let calls=0;
  const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im'],{fetchImpl:async()=>{calls++;}});
  assert.equal(result.exitCode,1);assert.equal(result.result.code,'HTTP_AUTH_REQUIRED');assert.equal(calls,0);assert.deepEqual(await readdir(f.directory),['report.json']);
});

test('authentication values stay in environment and header injection is rejected before HTTP',async t=>{
  const f=await fixture(t);let calls=0;
  const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im'],{env:{...auth,SYNK_CREATIVE_RESEARCH_SESSION:session+'; another=cookie'},fetchImpl:async()=>{calls++;}});
  assert.equal(result.result.code,'HTTP_AUTH_INVALID');assert.equal(calls,0);noPrivate(result.errors);
  const illegal=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--session',session]);assert.equal(illegal.result.code,'USAGE');noPrivate(illegal.errors);
});

test('destinations require HTTPS or exact loopback and forbid URL credentials, paths and queries',()=>{
  assert.equal(reportOrigin('https://workspace.synk.im/'),'https://workspace.synk.im');assert.equal(reportOrigin('http://localhost:4191'),'http://localhost:4191');assert.equal(reportOrigin('http://[::1]:4191'),'http://[::1]:4191');
  for(const value of ['http://workspace.synk.im','http://127.0.0.1.evil.test','http://0.0.0.0:4191','https://user:password@workspace.synk.im','https://workspace.synk.im/api','https://workspace.synk.im?token=private','https://workspace.synk.im#private'])assert.throws(()=>reportOrigin(value),{code:'ORIGIN_INVALID'});
});

test('upload posts the original validated report with session and CSRF, then saves only a sanitized receipt',async t=>{
  const f=await fixture(t),h=await httpFixture(t,(_req,res,request)=>{res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify(success(JSON.parse(request.body))));});
  const result=await f.run(['--report',f.report,'--origin',h.origin,'--receipt-dir',f.receipts],{env:auth});
  assert.equal(result.exitCode,0);assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'/api/creative-research/import-report');assert.equal(h.requests[0].headers.cookie,'synk_company_session='+session);assert.equal(h.requests[0].headers['x-csrf-token'],csrf);assert.equal(h.requests[0].headers.origin,h.origin);assert.deepEqual(JSON.parse(h.requests[0].body),f.input);
  assert.equal(result.result.createdCount,1);assert.equal(result.result.receiptSaved,true);noPrivate(result.output);noPrivate(result.errors);const files=await readdir(f.receipts);assert.equal(files.length,1);assert.match(files[0],/^2026-10-09-[a-f0-9]{16}\.json$/);noPrivate(await readFile(join(f.receipts,files[0]),'utf8'));assert.equal(await readFile(f.report,'utf8'),f.original);
});

test('HTTP rejection does not print raw server errors or create a receipt',async t=>{
  const f=await fixture(t),h=await httpFixture(t,(_req,res)=>{res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:privateText,session,csrf}));});
  const result=await f.run(['--report',f.report,'--origin',h.origin,'--receipt-dir',f.receipts],{env:auth});
  assert.equal(result.exitCode,1);assert.equal(result.result.code,'HTTP_REJECTED');assert.equal(h.requests.length,1);noPrivate(result.errors);assert.deepEqual(await readdir(f.directory),['report.json']);
});

test('credentialed redirects are never followed and an ambiguous request is never retried',async t=>{
  const f=await fixture(t),target=await httpFixture(t,(_req,res)=>res.end('never')),h=await httpFixture(t,(_req,res)=>{res.writeHead(302,{Location:target.origin+'/stolen'});res.end();});
  const result=await f.run(['--report',f.report,'--origin',h.origin,'--receipt-dir',f.receipts],{env:auth});
  assert.equal(result.exitCode,1);assert.equal(result.result.code,'HTTP_REQUEST_FAILED');assert.equal(h.requests.length,1);assert.equal(target.requests.length,0);noPrivate(result.errors);
  let calls=0,options;
  const timed=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async(_url,input)=>{calls++;options=input;throw Error(session);}});
  assert.equal(timed.result.code,'HTTP_REQUEST_FAILED');assert.equal(calls,1);assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);noPrivate(timed.errors);
});

test('a success response for another report is rejected without emitting its entries',async t=>{
  const f=await fixture(t);const payload=success(f.input);payload.report.reportId='wrong-report';
  const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',f.receipts],{env:auth,fetchImpl:async()=>new Response(JSON.stringify(payload),{status:201,headers:{'Content-Type':'application/json'}})});
  assert.equal(result.result.code,'HTTP_RESPONSE_INVALID');noPrivate(result.errors);assert.deepEqual(await readdir(f.directory),['report.json']);
});

test('receipt failure reports confirmed upload separately and performs no extra HTTP call',async t=>{
  const f=await fixture(t),blocked=join(f.directory,'not-a-directory');await writeFile(blocked,'unchanged');let calls=0;
  const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im','--receipt-dir',blocked],{env:auth,fetchImpl:async()=>{calls++;return new Response(JSON.stringify(success(f.input)),{status:201,headers:{'Content-Type':'application/json'}});}});
  assert.equal(result.exitCode,1);assert.equal(result.result.code,'RECEIPT_WRITE_FAILED');assert.equal(result.result.uploadConfirmed,true);assert.equal(calls,1);assert.equal(await readFile(blocked,'utf8'),'unchanged');noPrivate(result.errors);
});

test('relative paths, duplicate modes and oversized inputs fail safely',async t=>{
  const f=await fixture(t);
  for(const args of [['--report','report.json','--validate'],['--report',f.report,'--validate','--validate'],['--report',f.report,'--validate','--origin','https://workspace.synk.im']])assert.equal((await f.run(args)).result.code,'USAGE');
  const oversized=join(f.directory,'oversized.json');await writeFile(oversized,'x'.repeat(1024*1024+1));const result=await f.run(['--report',oversized,'--validate']);assert.equal(result.result.code,'REPORT_TOO_LARGE');assert.equal((await readFile(oversized)).length,1024*1024+1);
});

test('default receipts use persistent per-user application state and never depend on a dated repository temp directory',async t=>{
  const f=await fixture(t),stateRoot=join(f.directory,'application-state'),fallbackHome=join(f.directory,'user-home');
  assert.equal(creativeResearchReceiptDirectory({LOCALAPPDATA:stateRoot},{platform:'win32',homeDirectory:fallbackHome}),join(stateRoot,'SYNK','creative-research','receipts'));
  assert.equal(creativeResearchReceiptDirectory({XDG_STATE_HOME:stateRoot},{platform:'linux',homeDirectory:fallbackHome}),join(stateRoot,'SYNK','creative-research','receipts'));
  assert.equal(creativeResearchReceiptDirectory({XDG_STATE_HOME:'relative-state'},{platform:'linux',homeDirectory:fallbackHome}),join(fallbackHome,'.local','state','SYNK','creative-research','receipts'));
  const env={...auth,LOCALAPPDATA:stateRoot,XDG_STATE_HOME:stateRoot};
  const result=await f.run(['--report',f.report,'--origin','https://workspace.synk.im'],{env,fetchImpl:async()=>new Response(JSON.stringify(success(f.input)),{status:201,headers:{'Content-Type':'application/json'}})});
  assert.equal(result.exitCode,0);const directory=creativeResearchReceiptDirectory(env),files=await readdir(directory);assert.equal(files.length,1);noPrivate(await readFile(join(directory,files[0]),'utf8'));assert.equal(directory.includes('trend-automation-20261009'),false);assert.equal(await readFile(f.report,'utf8'),f.original);
});

test('the executable CLI returns failure with a fixed safe error for an invalid JSON file',async t=>{
  const f=await fixture(t);await writeFile(f.report,'{'+privateText);
  const script=fileURLToPath(new URL('../creative-research-report.mjs',import.meta.url)),result=spawnSync(process.execPath,[script,'--report',f.report,'--validate'],{encoding:'utf8',env:{...process.env,...auth}});
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(JSON.parse(result.stderr).code,'REPORT_INVALID');noPrivate(result.stderr);
});
