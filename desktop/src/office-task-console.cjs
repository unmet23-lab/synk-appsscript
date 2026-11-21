'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const net = require('node:net');
const {spawn} = require('node:child_process');
const {randomUUID,randomBytes,timingSafeEqual} = require('node:crypto');
const {createSubscriptionRuntime} = require('./subscription-runtime.cjs');

const fail = code => Object.assign(new Error(code),{code});
const stopRuntime = createSubscriptionRuntime({platform:process.platform,env:process.env,spawn,now:Date.now,home:require('node:os').homedir()});
function sameSecret(a,b) {
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
// A native node.exe owns the visible Windows console. The private ticket contains argv,
// so user text never becomes PowerShell or cmd input. The parent pipe also serves as a lease.
async function consoleHost(ticketPath) {
  const job=JSON.parse(await fs.readFile(ticketPath,'utf8'));
  await fs.unlink(ticketPath);
  const pipe=net.connect(job.pipe);
  let cli=null, received='', started=false;
  const end=()=>{ if(cli) stopRuntime.stopProcess(cli); pipe.destroy(); };
  pipe.setEncoding('utf8');
  pipe.on('connect',()=>pipe.write(job.secret+'\n'));
  pipe.on('error',end);
  pipe.on('close',()=>{ if(cli) stopRuntime.stopProcess(cli); });
  pipe.on('data',chunk=>{
    received+=chunk;
    if (received.length>100) return end();
    if (!started && received==='start\n') {
      started=true; received='';
      try { cli=spawn(job.file,job.args,{cwd:job.cwd,shell:false,stdio:'inherit',env:process.env}); }
      catch { return end(); }
      cli.on('error',end);
      cli.on('close',()=>{cli=null; pipe.end();});
    } else if (received.includes('stop\n')) end();
  });
}
async function openTaskConsole({file,args,cwd,env,base,nodeExe,signal}) {
  if (signal?.aborted) throw fail('CANCELLED');
  const dir=await fs.mkdtemp(path.join(base,'console-'));
  const ticket=path.join(dir,'start.json'), secret=randomBytes(32).toString('hex');
  const pipe='\\\\.\\pipe\\solio-office-'+randomUUID();
  let socket=null, native=null, settle, finished=false;
  const closed=new Promise(resolve=>{settle=resolve;});
  const server=net.createServer(client=>{
    if(socket || finished) return client.destroy();
    client.setEncoding('utf8'); let text='';
    client.setTimeout(4000,()=>client.destroy());
    client.on('error',()=>{});
    client.on('data',chunk=>{
      if (socket===client) return;
      text+=chunk;
      if (text.length>66 || text.includes('\n') && !sameSecret(text,secret+'\n')) return client.destroy();
      if (text!==secret+'\n') return;
      client.setTimeout(0); socket=client;
      if (signal?.aborted || finished) return client.destroy();
      client.write('start\n'); server.close();
    });
  });
  const cleanup=()=>{
    if(finished)return;
    finished=true; signal?.removeEventListener('abort',stop);
    socket?.destroy(); try{server.close();}catch{}
    void fs.rm(ticket,{force:true}).then(()=>fs.rmdir(dir)).catch(()=>{}); settle();
  };
  function stop() {
    if(finished) return;
    socket?.destroy();
    if(native) stopRuntime.stopProcess(native.child,native.pid);
  }
  try {
    await new Promise((ok,no)=>{server.once('error',no);server.listen(pipe,ok);});
    await fs.writeFile(ticket,JSON.stringify({file,args,cwd,pipe,secret}),{flag:'wx',mode:0o600});
    if(signal?.aborted) throw fail('CANCELLED');
    const runtime=createSubscriptionRuntime({platform:'win32',env,spawn,now:Date.now,home:require('node:os').homedir()});
    native=await runtime.openWindowsConsole(nodeExe,[__filename,ticket],{cwd,wait:true,extraEnv:env});
    if(!native?.ok) throw fail('NATIVE');
    signal?.addEventListener('abort',stop,{once:true});
    if(signal?.aborted) stop();
    native.child.once('close',cleanup);
    if(native.child.exitCode!==null || native.child.signalCode!==null) cleanup();
    function focus(){
      if(finished || !native || native.child.exitCode!==null) return Promise.resolve(false);
      const script='$s=New-Object -ComObject WScript.Shell; if ($s.AppActivate([int]'+native.pid+')) {exit 0}; exit 1';
      return new Promise(resolve=>{
        const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{shell:false,windowsHide:true,stdio:'ignore'});
        child.once('error',()=>resolve(false));child.once('close',code=>resolve(code===0));
      });
    }
    return {closed,focus,stop};
  } catch(e){stop();cleanup();throw e;}
}
if(require.main===module) consoleHost(process.argv[2]).catch(()=>{process.exitCode=1;});
module.exports={openTaskConsole};
