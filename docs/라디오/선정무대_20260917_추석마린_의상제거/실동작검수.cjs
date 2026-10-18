'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const dir=__dirname;
const code=String.raw`
const assert=require('assert/strict');
(async()=>{
 const pages=await new Promise((resolve,reject)=>{require('http').get('http://127.0.0.1:9222/json/list',r=>{let s='';r.on('data',d=>s+=d);r.on('end',()=>{try{resolve(JSON.parse(s))}catch(e){reject(e)}})}).on('error',reject)});
 const page=pages.find(x=>x.type==='page'&&decodeURIComponent(x.url).includes('방송층.html'));assert.ok(page,'radio-live Chromium page');
 const ws=new WebSocket(page.webSocketDebuggerUrl),contexts=[],pending=new Map(),errors=[];let id=0;
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method==='Runtime.executionContextCreated')contexts.push(r.params.context);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails?.text||'exception');if(r.method==='Runtime.consoleAPICalled'&&r.params.type==='error')errors.push((r.params.args||[]).map(a=>a.value||a.description||'').join(' '));if(r.id&&pending.has(r.id)){const w=pending.get(r.id);pending.delete(r.id);w(r);}});
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
 const call=(method,params={})=>new Promise((r,j)=>{const key=++id,t=setTimeout(()=>{pending.delete(key);j(new Error('CDP timeout '+method))},8000);pending.set(key,x=>{clearTimeout(t);x.error?j(new Error(x.error.message)):r(x.result)});ws.send(JSON.stringify({id:key,method,params}))});
 await call('Runtime.enable');const tree=await call('Page.getFrameTree'),frames=[];(function walk(t){frames.push(t.frame);for(const c of t.childFrames||[])walk(c)})(tree.frameTree);
 const frame=frames.find(x=>decodeURIComponent(x.url).includes('/마스코트.html'));assert.ok(frame,'mascot frame');let context;for(let i=0;i<80&&!context;i++){context=contexts.find(x=>x.auxData?.frameId===frame.id&&x.auxData.isDefault);if(!context)await new Promise(r=>setTimeout(r,100))}assert.ok(context,'mascot default execution context');
 const expression="(()=>{const booth=document.querySelector('#부스'),clothes=[...document.querySelectorAll('#마스코트틀 img.옷')];return{ready:준비,DJ:현재DJ,scene:현재차림,expression:현재표정,visible:[...document.querySelectorAll('#마스코트틀 img')].filter(x=>!x.hidden&&getComputedStyle(x).display!=='none').map(x=>({file:decodeURIComponent(x.src).split('/').at(-1),width:x.naturalWidth})),clothes:clothes.map(x=>({name:x.dataset.이름||null,hidden:x.hidden,src:x.getAttribute('src'),width:x.naturalWidth})),boothHidden:booth.hidden,boothRect:booth.getBoundingClientRect().toJSON(),mascotRect:document.querySelector('#마스코트틀').getBoundingClientRect().toJSON(),viewport:{width:innerWidth,height:innerHeight}}})()";
 const samples=[],start=Date.now();while(Date.now()-start<18000){const r=await call('Runtime.evaluate',{contextId:context.id,returnByValue:true,expression});assert.ok(!r.exceptionDetails);samples.push(r.result.value);await new Promise(r=>setTimeout(r,120))}ws.close();
 const result={passed:true,at:new Date().toISOString(),sampleCount:samples.length,expressions:[...new Set(samples.map(x=>x.expression))],first:samples[0],last:samples.at(-1),errors,scope:'실제 radio-live Chromium 오버레이의 18초 읽기 전용 확인 — 추석 마린 의상 없음·부스 숨김'};
 assert.ok(samples.every(x=>x.ready&&x.DJ==='마린'&&x.scene==='추석보름달마당'&&x.boothHidden&&x.clothes.every(c=>c.hidden&&!c.src)),'마린/추석/의상 없음/부스 숨김 상태');assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
const result=JSON.parse(execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh','synk_radio'),'-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=20','synk-radio','node'],{input:code,encoding:'utf8',timeout:50000,maxBuffer:2*1024*1024,windowsHide:true}));
if(!result.passed)throw new Error('실동작 검증 실패');fs.writeFileSync(path.join(dir,'서버실동작검증.json'),JSON.stringify(result,null,2)+'\n','utf8');console.log(JSON.stringify(result,null,2));
