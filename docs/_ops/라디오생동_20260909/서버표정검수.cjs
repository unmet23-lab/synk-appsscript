'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const code=String.raw`
const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict');
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
while(Date.now()-start<22000){
 const r=await call('Runtime.evaluate',{contextId:context.id,returnByValue:true,expression:"({ready:준비,ms:performance.now(),DJ:현재DJ,expression:현재표정,outfit:현재차림,transform:틀.style.transform,asset:decodeURIComponent(이미지[현재DJ][현재표정].src).split('/').pop(),rhythmLoaded:typeof 라디오표정리듬==='object'})"});
 assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));samples.push(r.result.value);
 await new Promise(r=>setTimeout(r,200));
}
ws.close();
const main=cp.execFileSync('systemctl',['show','radio-live','--property=MainPID','--value'],{encoding:'utf8'}).trim();
const children=cp.execFileSync('pgrep',['-P',main],{encoding:'utf8'}).trim().split(/\s+/);
const mediaFiles=[];for(const pid of children){try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd')){try{const p=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(p.includes('/무대차례/')||p.includes('/소리/'))mediaFiles.push(p);}catch{}}}catch{}}
const journal=cp.execFileSync('journalctl',['-u','radio-live','-n','180','--no-pager','-o','cat'],{encoding:'utf8'}).split('\n').filter(x=>/층 \d+장 떴다|첫 장이 떴다|장면 \d+\//.test(x)).slice(-5);
const expressions=[...new Set(samples.map(x=>x.expression))];
assert.ok(samples.every(x=>x.ready&&x.rhythmLoaded&&x.DJ==='까몽'));assert.ok(expressions.includes('깜빡')&&expressions.length>=3);
assert.ok(mediaFiles.includes('/opt/synk-radio/무대차례/chuseok-natural-20260909.mp4'));
assert.ok(mediaFiles.includes('/opt/synk-radio/소리/synk-radio-blok11-20260909-air.aac'));
console.log(JSON.stringify({passed:true,at:new Date().toISOString(),mainPid:main,expressions,sampleCount:samples.length,mediaFiles,journal,samples},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
`;
const command=`node -e 'eval(Buffer.from("${Buffer.from(code).toString('base64')}","base64").toString())'`;
const result=JSON.parse(execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh/synk_radio'),'synk@34.71.111.97',command],{encoding:'utf8',timeout:45000}));
fs.writeFileSync(path.join(__dirname,'서버실동작검증.json'),JSON.stringify(result,null,2));
const {samples,...summary}=result;console.log(JSON.stringify(summary,null,2));
