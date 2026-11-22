'use strict';
// 두 번째 실행 재현기(시험 전용). 실제 main.cjs를 실제 모듈과 함께 싣고 electron과 타이머만 바꾼다.
// 단일 실행 잠금(app.requestSingleInstanceLock)은 거짓이고, app.quit()은 창이 없을 때의 Electron처럼 before-quit과 will-quit을 그 자리에서 부른다.
// 쓰는 법: node second-launch-probe.cjs <main.cjs 경로>  — 표준 입력에 글이 오면 그 글을 그 경로의 모듈로 싣는다(파일을 쓰지 않는다).
// 결과는 표준 출력 한 줄의 JSON이다: {quitCalled, handlers, errors, top}
const Module=require('node:module'),path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const main=path.resolve(process.argv[2]);
const replacement=process.argv.includes('--stdin')?fs.readFileSync(0,'utf8'):null;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'synk-second-launch-'));
const stub=()=>{const fn=function(){};return new Proxy(fn,{get:(t,k)=>k===Symbol.toPrimitive?()=>'':k==='then'?(()=>stub()):stub(),apply:()=>stub(),construct:()=>stub()});};
const handlers={},errors=[];let quitCalled=false;
const emit=name=>{for(const h of handlers[name]||[]){try{h({preventDefault(){}});}catch(e){errors.push(name+': '+(e&&e.message));}}};
const app=new Proxy({},{get:(t,k)=>{
  if(k==='on'||k==='once'||k==='prependListener')return (name,h)=>{(handlers[name]||(handlers[name]=[])).push(h);return app;};
  if(k==='requestSingleInstanceLock')return ()=>false;
  if(k==='quit')return ()=>{quitCalled=true;emit('before-quit');emit('will-quit');};
  if(k==='exit')return ()=>{};
  if(k==='isPackaged')return false;
  if(k==='getPath')return ()=>temp;
  if(k==='getAppPath')return ()=>path.resolve(path.dirname(main),'..');
  if(k==='getVersion')return ()=>'0.0.0';
  if(k==='getName')return ()=>'second-launch-probe';
  return stub();
}});
const electron=new Proxy({},{get:(t,k)=>k==='app'?app:stub()});
const fakeTimer={unref(){return fakeTimer;},ref(){return fakeTimer;},hasRef(){return false;},refresh(){return fakeTimer;}};
const timers={setInterval:()=>fakeTimer,setTimeout:()=>fakeTimer,setImmediate:()=>fakeTimer,clearInterval(){},clearTimeout(){},clearImmediate(){}};
const load=Module._load;
Module._load=function(request){if(request==='electron')return electron;if(request==='node:timers'||request==='timers')return timers;return load.apply(this,arguments);};
for(const k of ['setInterval','setTimeout','setImmediate'])globalThis[k]=()=>fakeTimer;
process.argv=[process.argv[0],main,'--synk-dev'];
let top=null;
try{
  if(replacement===null)require(main);
  else{const m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));m._compile(replacement,main);}
}catch(e){top=e&&e.message;}
try{fs.rmSync(temp,{recursive:true,force:true});}catch{}
process.stdout.write(JSON.stringify({quitCalled,handlers:Object.fromEntries(Object.entries(handlers).map(([k,v])=>[k,v.length])),errors,top})+'\n',()=>process.exit(0));
