'use strict';
// 기존 서버표정검수.cjs의 읽기 전용 CDP 통로. 방송 페이지에 쓰기 없음.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const code=String.raw`
const assert=require('assert/strict');
(async()=>{
const pages=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const page=pages.find(x=>x.type==='page'&&decodeURIComponent(x.url).includes('방송층.html'));assert.ok(page);
const ws=new WebSocket(page.webSocketDebuggerUrl),contexts=[],pending=new Map();let id=0;
ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method==='Runtime.executionContextCreated')contexts.push(r.params.context);if(r.id&&pending.has(r.id)){pending.get(r.id)(r);pending.delete(r.id);}});
await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
const call=(method,params={})=>new Promise((r,j)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);j(new Error('CDP timeout '+method));},5000);pending.set(key,x=>{clearTimeout(timer);x.error?j(new Error(x.error.message)):r(x.result);});ws.send(JSON.stringify({id:key,method,params}));});
await call('Runtime.enable');const tree=await call('Page.getFrameTree');
const frames=[];function walk(t){frames.push(t.frame);for(const c of t.childFrames||[])walk(c);}walk(tree.frameTree);
const target=frames.find(x=>decodeURIComponent(x.url).includes('/마스코트.html'));assert.ok(target);
const context=contexts.find(x=>x.auxData&&x.auxData.frameId===target.id&&x.auxData.isDefault);assert.ok(context);
const samples=[],start=Date.now();
while(Date.now()-start<36000){
 const r=await call('Runtime.evaluate',{contextId:context.id,returnByValue:true,expression:"(()=>{const r=틀.getBoundingClientRect();return {ready:준비,DJ:현재DJ,scene:document.body.dataset.radioScene,outfit:현재차림,expression:현재표정,checks:window.라디오13?.검사||null,geometry:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight},keys:Object.entries(이미지.까몽).map(([key,im])=>({key,loaded:im.complete&&im.naturalWidth===1024&&im.naturalHeight===1024,alias:im.dataset.radio13||null}))};})()"});
 assert.ok(!r.exceptionDetails,'런타임 예외');samples.push(r.result.value);
 await new Promise(r=>setTimeout(r,70));
}
ws.close();const expressions=[...new Set(samples.map(x=>x.expression))];
assert.ok(samples.every(x=>x.ready&&x.DJ==='까몽'&&x.scene==='13'&&x.outfit==='반딧불노을들판'));
assert.ok(samples.every(x=>x.keys.length===9&&x.keys.every(k=>k.loaded&&k.alias)));
assert.ok(samples.every(x=>x.checks.outsideEyeDifference===0&&x.checks.expressionAlphaEqual));
// 유휴 표정은 무작위 선택이다. 36초 안에 특정 키의 추첨을 강제하지 않는다.
// 3개 실제 그림과 모든 별칭 로드는 별도 검사하고, 실동작에서는 열린 눈/깜빡임을 확인한다.
assert.ok(expressions.includes('깜빡')&&expressions.includes('기본'),'실제 깜빡임 미관찰: '+expressions.join(','));
const visualExpressions=[...new Set(expressions.map(x=>x==='깜빡'?'눈감음':['눈웃음','안도','응원','기쁨'].includes(x)?'눈웃음':'기본'))];
console.log(JSON.stringify({passed:true,at:new Date().toISOString(),expressions,visualExpressions,sampleCount:samples.length,first:samples[0],scope:'Read-only actual radio-live Chromium runtime, not public playback'}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
`;
const result=JSON.parse(execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh/synk_radio'),'synk@34.71.111.97','node'],{input:code,encoding:'utf8',timeout:45000}));
fs.writeFileSync(path.join(__dirname,'라이브13/서버실동작검증.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
