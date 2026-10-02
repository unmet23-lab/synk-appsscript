'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const dir = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

const code = String.raw`
const assert=require('assert/strict');
(async()=>{
 const pages=await new Promise((resolve,reject)=>{require('http').get('http://127.0.0.1:9222/json/list',r=>{let s='';r.on('data',d=>s+=d);r.on('end',()=>{try{resolve(JSON.parse(s))}catch(e){reject(e)}})}).on('error',reject)});
 const page=pages.find(x=>x.type==='page'&&decodeURIComponent(x.url).includes('방송층.html'));
 assert.ok(page,'radio-live Chromium page');
 const ws=new WebSocket(page.webSocketDebuggerUrl),contexts=[],pending=new Map(),errors=[];let id=0;
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method==='Runtime.executionContextCreated')contexts.push(r.params.context);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails?.text||'exception');if(r.method==='Runtime.consoleAPICalled'&&r.params.type==='error')errors.push((r.params.args||[]).map(a=>a.value||a.description||'').join(' '));if(r.id&&pending.has(r.id)){const w=pending.get(r.id);pending.delete(r.id);w(r);}});
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 const call=(method,params={})=>new Promise((r,j)=>{const key=++id,t=setTimeout(()=>{pending.delete(key);j(new Error('CDP timeout '+method));},8000);pending.set(key,x=>{clearTimeout(t);x.error?j(new Error(x.error.message)):r(x.result);});ws.send(JSON.stringify({id:key,method,params}));});
 await call('Runtime.enable');
 const tree=await call('Page.getFrameTree'),frames=[];(function walk(t){frames.push(t.frame);for(const c of t.childFrames||[])walk(c);})(tree.frameTree);
 const frame=frames.find(x=>decodeURIComponent(x.url).includes('/마스코트.html'));assert.ok(frame,'mascot frame');
 let context;for(let i=0;i<80&&!context;i++){context=contexts.find(x=>x.auxData?.frameId===frame.id&&x.auxData.isDefault);if(!context)await new Promise(r=>setTimeout(r,100));}
 assert.ok(context,'mascot default execution context');
 const expression="(()=>{const booth=document.querySelector('#부스'),hanbok=document.querySelector('#마스코트틀 img.옷[data-이름=\"한복\"]'),head=document.querySelector('#마스코트틀 img.옷[data-이름=\"펠트헤드폰\"]');return{ready:준비,DJ:현재DJ,scene:현재차림,expression:현재표정,visible:[...document.querySelectorAll('#마스코트틀 img')].filter(x=>!x.hidden&&getComputedStyle(x).display!=='none').map(x=>({file:decodeURIComponent(x.src).split('/').at(-1),width:x.naturalWidth})),hanbok:{loaded:!!hanbok&&!hanbok.hidden&&hanbok.naturalWidth>0,width:hanbok?.naturalWidth},headset:{loaded:!!head&&!head.hidden&&head.naturalWidth>0,width:head?.naturalWidth},boothHidden:booth.hidden,boothRect:booth.getBoundingClientRect().toJSON(),mascotRect:document.querySelector('#마스코트틀').getBoundingClientRect().toJSON(),discs:[...booth.querySelectorAll('.디스크')].map(x=>({loaded:x.naturalWidth>0,transform:getComputedStyle(x).transform})),viewport:{width:innerWidth,height:innerHeight}}})()";
 const samples=[],start=Date.now();while(Date.now()-start<18000){const r=await call('Runtime.evaluate',{contextId:context.id,returnByValue:true,expression});assert.ok(!r.exceptionDetails);samples.push(r.result.value);await new Promise(r=>setTimeout(r,120));}
 ws.close();
 const transforms=new Set(samples.flatMap(x=>x.discs.map(d=>d.transform)));
 const result={passed:true,at:new Date().toISOString(),sampleCount:samples.length,distinctDiscTransforms:transforms.size,expressions:[...new Set(samples.map(x=>x.expression))],first:samples[0],last:samples.at(-1),errors,scope:'실제 radio-live Chromium 오버레이의 18초 읽기 전용 확인 — 추석 마린 한복·부스 숨김'};
 assert.ok(samples.every(x=>x.ready&&x.DJ==='마린'&&x.scene==='추석보름달마당'&&x.boothHidden&&x.hanbok.loaded&&!x.headset.loaded),'마린/추석/한복/부스 숨김 상태');
 assert.ok(samples.every(x=>x.discs.length===2&&x.discs.every(d=>d.loaded)),'양쪽 회전판 그림');
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});`;

const result = JSON.parse(execFileSync('ssh', ['-i', path.join(os.homedir(), '.ssh', 'synk_radio'), '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=20', 'synk@34.71.111.97', 'node'], {
  input: code, encoding: 'utf8', timeout: 50000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
}));
assert.equal(result.passed, true);
fs.writeFileSync(path.join(dir, '서버실동작검증.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));


