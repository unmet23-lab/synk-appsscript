'use strict';
// Private inherited stdio, not a listening socket. Boot arrives only after the
// native parent has assigned this process to its Windows kill-on-close job.
const {StringDecoder}=require('node:string_decoder');
const contract=require('../contract/methods.json');
const MAX_IN=131072,MAX_OUT=2*1024*1024;
const pending=new Map();let nextCall=0,buffer=Buffer.alloc(0),application=null,runner=null,ran=false,booting=false,stopping=false,terminating=false;
function send(value){const text=JSON.stringify({v:1,...value});if(Buffer.byteLength(text)+1>MAX_OUT)fatal('PAYLOAD_TOO_LARGE');else process.stdout.write(text+'\n');}
function fatal(code){if(terminating)return;terminating=true;stopping=true;process.stdout.write(JSON.stringify({v:1,fatal:code})+'\n',()=>process.exit(1));setTimeout(()=>process.exit(1),1000).unref();}
function host(method,args){
  // A graceful stop still lets the current backup persist its final encrypted
  // state. Reject new app operations, not its outstanding native callbacks.
  if(terminating||pending.size>=8)return Promise.reject(new Error('HOST_BUSY'));
  const call=++nextCall;
  return new Promise((resolve,reject)=>{
    const timeout=method.startsWith('dialog.')?0:method.startsWith('secret.')?30000:10000;
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
    runner=await createRunner({host,root:process.env.SWB_ROOT,resticPath:process.env.SWB_RESTIC,publish:state=>send({event:'state',value:state})});
    send({id:value.id,ok:true,value:{mode:'run'}});return;
  }
  if(value.method==='$run'){
    if(!runner||ran)throw Error('NOT_READY');ran=true;
    const result=await runner.runOnce(value.args[0]);send({id:value.id,ok:true,value:result});return;
  }
  if(value.method==='$shutdown'&&runner){stopping=true;await runner.stop();send({id:value.id,ok:true,value:null});process.stdin.pause();process.stdout.end(()=>process.exit(0));return;}
  if(value.method==='$boot'){
    if(booting||application)throw Error('DUPLICATE_BOOT');booting=true;
    const {createApplication}=require('./handlers.cjs');
    application=await createApplication({host,root:process.env.SWB_ROOT,resticPath:process.env.SWB_RESTIC,clientPath:process.env.SWB_CLIENT||null,testMode:process.env.SWB_TEST==='1',publish:state=>send({event:'state',value:state})});
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
