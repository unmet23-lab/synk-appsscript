'use strict';
// Source-run previews and development clients load a fixed 127.0.0.1 port that a
// developer's own server is expected to answer. Another account on the same PC
// could take that port first, and its page would then reach this account's
// sign-in and account requests. So every request to that port waits until the
// program listening there is confirmed to run as this OS user. Release builds
// never load such an address, so nothing here runs for them.
const {execFile}=require('node:child_process'),os=require('node:os'),path=require('node:path');

function gatedPort(entry){
  try{const url=new URL(entry);return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&/^[1-9]\d{0,4}$/.test(url.port)?Number(url.port):null;}catch{return null;}
}
function run(file,args){
  return new Promise(resolve=>{try{execFile(file,args,{windowsHide:true,timeout:8000,maxBuffer:8*1024*1024,encoding:'utf8'},(error,stdout)=>resolve(error?null:String(stdout)));}catch{resolve(null);}});
}
// netstat rows for sockets that would answer 127.0.0.1:<port>. A listening socket has no
// remote end (0.0.0.0:0 or [::]:0); the state word itself is localized, so it is not read.
function listeningPids(text,port){
  const wanted=new Set([`127.0.0.1:${port}`,`0.0.0.0:${port}`,`[::]:${port}`]),pids=new Set();
  for(const line of String(text).split(/\r?\n/)){
    const cells=line.trim().split(/\s+/);
    if(cells[0]!=='TCP'||cells.length<4||!wanted.has(cells[1])||!['0.0.0.0:0','[::]:0'].includes(cells[2]))continue;
    const pid=cells[cells.length-1];if(!/^[1-9]\d{0,9}$/.test(pid))return null;
    pids.add(pid);
  }
  return [...pids];
}
const csvCells=line=>[...String(line).matchAll(/"((?:[^"]|"")*)"/g)].map(match=>match[1].replace(/""/g,'"'));
function windowsUser(env=process.env){
  let name=env.USERNAME;if(!name){try{name=os.userInfo().username;}catch{name='';}}
  if(!name||/["\\\r\n]/.test(name))return '';
  return env.USERDOMAIN&&!/["\\\r\n]/.test(env.USERDOMAIN)?env.USERDOMAIN+'\\'+name:name;
}
// Every listener must belong to this user: a second socket bound more narrowly by
// someone else would otherwise receive the connection instead of ours.
async function windowsOwned(port,{exec=run,systemRoot=process.env.SystemRoot||process.env.windir||'C:\\Windows',user=windowsUser()}={}){
  if(!user)return false;
  const netstat=path.win32.join(systemRoot,'System32','NETSTAT.EXE'),tasklist=path.win32.join(systemRoot,'System32','tasklist.exe');
  const [v4,v6]=await Promise.all([exec(netstat,['-ano','-p','TCP']),exec(netstat,['-ano','-p','TCPv6'])]);
  if(v4===null||v6===null)return false;
  const pids=listeningPids(v4+'\n'+v6,port);if(!pids||!pids.length)return false;
  for(const pid of pids){
    const rows=await exec(tasklist,['/FI',`PID eq ${pid}`,'/FI',`USERNAME eq ${user}`,'/NH','/FO','CSV']);
    if(rows===null||!rows.split(/\r?\n/).some(line=>csvCells(line)[1]===pid))return false;
  }
  return true;
}
// macOS: our development servers bind 127.0.0.1 itself, so one of this user's
// processes must hold exactly that address and port.
async function unixOwned(port,{exec=run,uid=typeof process.getuid==='function'?process.getuid():null}={}){
  if(!Number.isInteger(uid))return false;
  for(const file of ['/usr/sbin/lsof','/usr/bin/lsof']){
    const out=await exec(file,['-nP','-a',`-iTCP@127.0.0.1:${port}`,'-sTCP:LISTEN',`-u${uid}`,'-Fp']);
    if(out!==null)return /^p[1-9]\d*$/m.test(out);
  }
  return false;
}
function verifyLocalServer(port,{platform=process.platform,...options}={}){
  return platform==='win32'?windowsOwned(port,options):['darwin','linux'].includes(platform)?unixOwned(port,options):Promise.resolve(false);
}
// Only a confirmed answer is remembered, and only for a few seconds; a refusal is
// asked again on the next request so a server started afterwards is found.
function createLocalServerGate({entry,verify=verifyLocalServer,now=Date.now,freshMs=5000}={}){
  const port=gatedPort(entry);let confirmedAt=null,pending=null;
  function covers(url){
    if(port===null)return false;
    try{const target=new URL(url);return ['http:','ws:'].includes(target.protocol)&&target.hostname==='127.0.0.1'&&Number(target.port||80)===port;}catch{return false;}
  }
  function allowed(){
    if(port===null)return Promise.resolve(true);
    if(confirmedAt!==null&&now()-confirmedAt<freshMs)return Promise.resolve(true);
    if(!pending){
      const attempt=Promise.resolve().then(()=>verify(port)).then(ok=>ok===true,()=>false).then(ok=>{if(pending===attempt)pending=null;confirmedAt=ok?now():null;return ok;});
      pending=attempt;
    }
    return pending;
  }
  // For webRequest.onBeforeRequest: requests to the gated port wait for the answer.
  function decide(url,callback){
    if(!covers(url)){callback({});return;}
    allowed().then(ok=>callback({cancel:!ok}),()=>callback({cancel:true}));
  }
  return Object.freeze({port,required:port!==null,covers,allowed,decide});
}
module.exports={gatedPort,listeningPids,windowsUser,windowsOwned,unixOwned,verifyLocalServer,createLocalServerGate};
