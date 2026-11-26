'use strict';
// Private inherited stdio, not a listening socket. Boot arrives only after the
// native parent has assigned this process to its Windows kill-on-close job.
const {StringDecoder}=require('node:string_decoder');
const contract=require('../contract/methods.json');
const MAX_IN=131072,MAX_OUT=2*1024*1024;
const pending=new Map();let nextCall=0,buffer=Buffer.alloc(0),application=null,runner=null,mcp=null,ran=false,filled=false,runWork=Promise.resolve(),shutdownIds=null,booting=false,stopping=false,terminating=false;
function send(value){const text=JSON.stringify({v:1,...value});if(Buffer.byteLength(text)+1>MAX_OUT)fatal('PAYLOAD_TOO_LARGE');else process.stdout.write(text+'\n');}
function fatal(code){if(terminating)return;terminating=true;stopping=true;process.stdout.write(JSON.stringify({v:1,fatal:code})+'\n',()=>process.exit(1));setTimeout(()=>process.exit(1),1000).unref();}
// How long a host call is waited for (0: no limit). 「새 PC로 옮겨 오기」's host calls take longer (4.6 · 4.6b): placing a
// large file compares it by SHA-256, the elevated reinstall waits for each machine-wide program (20 min each, 2 h in all,
// plus its own margin). An open (openExternal · openPath) waits longer than the windowless host's `ask` to SYNK 솔리오
// (host.rs ASK_WAIT, 30 s, SOLIO_ONE_CLIENT.md 2.6), so the worker always gets the host's own yes or OPEN_FAILED and a
// Google sign-in whose browser opened late is not dropped (GPT workbackup-solio-one-be-20261127 C4). The window opens
// at once, so the longer wait changes nothing there. tests/host-ask-wait.test.cjs holds the two together.
const hostWait=method=>method.startsWith('dialog.')?0:method.startsWith('secret.')?30000:method.startsWith('files.')?1800000:method.startsWith('folders.')?60000:method.startsWith('reinstall.')?10800000:(method==='openExternal'||method==='openPath')?40000:10000;
function host(method,args){
  // A graceful stop still lets the current backup persist its final encrypted
  // state. Reject new app operations, not its outstanding native callbacks.
  if(terminating||pending.size>=8)return Promise.reject(new Error('HOST_BUSY'));
  const call=++nextCall;
  return new Promise((resolve,reject)=>{
    const timeout=hostWait(method);
    const timer=timeout?setTimeout(()=>{pending.delete(call);reject(new Error('HOST_TIMEOUT'));},timeout):null;
    pending.set(call,{resolve,reject,timer});send({call,method,args});
  });
}
async function message(value){
  if(!value||value.v!==1||typeof value!=='object')throw Error('INVALID_FRAME');
  if(Object.hasOwn(value,'callResult')){
    const entry=pending.get(value.callResult);if(!entry)return;pending.delete(value.callResult);clearTimeout(entry.timer);
    if(value.ok===true)entry.resolve(value.value);else entry.reject(new Error(typeof value.code==='string'?value.code:'HOST_FAILED'));return;
  }
  if(!Number.isSafeInteger(value.id)||value.id<1||!Array.isArray(value.args)||value.args.length>2||typeof value.method!=='string')throw Error('INVALID_REQUEST');
  if(value.method==='$boot'&&process.env.SWB_MODE==='run'){
    // Scheduled-run mode: profile engines only, one `$run` per boot (runner.cjs).
    if(booting||runner)throw Error('DUPLICATE_BOOT');booting=true;
    const {createRunner}=require('./runner.cjs');
    runner=await createRunner({host,root:process.env.SWB_ROOT,workRoot:process.env.SWB_CACHE_ROOT||null,resticPath:process.env.SWB_RESTIC,publish:state=>send({event:'state',value:state})});
    send({id:value.id,ok:true,value:{mode:'run'}});return;
  }
  if(value.method==='$boot'&&process.env.SWB_MODE==='mcp'){
    // MCP 보기 도구 모드(STAGE1_DESIGN.md 4.16): 읽기 전용 엔진 하나와 짧은 허용 목록(mcp.cjs METHODS)뿐이다.
    if(booting||mcp)throw Error('DUPLICATE_BOOT');booting=true;
    const {createMcp}=require('./mcp.cjs');
    mcp=await createMcp({host,root:process.env.SWB_ROOT,workRoot:process.env.SWB_CACHE_ROOT||null,resticPath:process.env.SWB_RESTIC});
    send({id:value.id,ok:true,value:{mode:'mcp'}});return;
  }
  if(mcp){
    if(value.method==='$shutdown'){stopping=true;await mcp.stop();send({id:value.id,ok:true,value:null});process.stdin.pause();process.stdout.end(()=>process.exit(0));return;}
    if(stopping||!mcp.METHODS.includes(value.method))throw Error('INVALID_METHOD');
    // 실패는 낱말 부호로만 돌려준다(경로가 든 엔진 글은 나가지 않는다).
    let result;try{result={ok:true,value:await mcp[value.method](value.args[0])};}catch(e){result={ok:false,code:typeof e?.code==='string'&&/^[A-Z][A-Z_]{1,31}$/.test(e.code)?e.code:'FAILED'};}
    send({id:value.id,ok:true,value:result});return;
  }
  if(value.method==='$run'){
    if(!runner||ran)throw Error('NOT_READY');ran=true;
    // A $shutdown that arrives meanwhile waits for this answer, then stops (review E1).
    const work=runner.runOnce(value.args[0]);runWork=work.catch(()=>{});
    const result=await work;send({id:value.id,ok:true,value:result});return;
  }
  if(value.method==='$fill'){
    // After the run, at most once: what the helper's shadow copy links let the partial snapshots fill (4.2 「도우미」).
    if(!runner||!ran||filled)throw Error('NOT_READY');filled=true;
    const work=runner.fillOnce(value.args[0]);runWork=work.catch(()=>{});
    const result=await work;send({id:value.id,ok:true,value:result});return;
  }
  if(value.method==='$shutdown'&&runner){
    // One stop for every $shutdown: later ones join it and all are answered before the exit (review E1).
    if(shutdownIds){shutdownIds.push(value.id);return;}
    shutdownIds=[value.id];stopping=true;await runWork;await runner.stop();
    for(const id of shutdownIds)send({id,ok:true,value:null});
    process.stdin.pause();process.stdout.end(()=>process.exit(0));return;
  }
  if(value.method==='$boot'){
    if(booting||application)throw Error('DUPLICATE_BOOT');booting=true;
    const {createApplication}=require('./handlers.cjs');
    application=await createApplication({host,root:process.env.SWB_ROOT,workRoot:process.env.SWB_CACHE_ROOT||null,resticPath:process.env.SWB_RESTIC,clientPath:process.env.SWB_CLIENT||null,testMode:process.env.SWB_TEST==='1',publish:state=>send({event:'state',value:state})});
    send({id:value.id,ok:true,value:application.state()});return;
  }
  if(!application)throw Error('NOT_READY');
  if(value.method==='$shutdown'){stopping=true;await application.stop();send({id:value.id,ok:true,value:null});process.stdin.pause();process.stdout.end(()=>process.exit(0));return;}
  if(value.method==='$activity'){send({id:value.id,ok:true,value:{active:application.active(),busy:application.busy()}});return;}
  if(stopping||!Object.hasOwn(contract,value.method))throw Error('INVALID_METHOD');
  const result=await application.call(value.method,value.args);send({id:value.id,ok:true,value:result});
}
process.stdin.on('data',chunk=>{
  buffer=Buffer.concat([buffer,chunk]);
  let end;
  while((end=buffer.indexOf(10))!==-1){
    if(end+1>MAX_IN){fatal('PAYLOAD_TOO_LARGE');return;}
    const line=buffer.subarray(0,end);buffer=buffer.subarray(end+1);
    let value;try{value=JSON.parse(new StringDecoder('utf8').end(line));}catch{fatal('INVALID_FRAME');return;}
    void message(value).catch(()=>fatal('WORKER_FAILED'));
  }
  if(buffer.length>MAX_IN)fatal('PAYLOAD_TOO_LARGE');
});
process.stdin.on('end',()=>{if(!stopping)fatal('PARENT_CLOSED');});
process.stdin.on('error',()=>fatal('PIPE_FAILED'));
process.stdout.on('error',()=>process.exit(1));
process.on('uncaughtException',()=>fatal('WORKER_FAILED'));
process.on('unhandledRejection',()=>fatal('WORKER_FAILED'));
