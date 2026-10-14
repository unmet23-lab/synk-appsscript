'use strict';

const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),https=require('node:https');
const {createHash,randomUUID}=require('node:crypto');
const MANIFEST_URL='https://synk.im/desktop/releases/preview.json';
const MAX_MANIFEST_BYTES=64*1024,MAX_INSTALLER_BYTES=2*1024*1024*1024;
const VERSION=/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
const BUILD=/^\d{8}\.[1-9]\d{0,5}$/,HASH=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{updateCode:code});};
function compareVersion(left,right){
  if(typeof left!=='string'||typeof right!=='string'||!VERSION.test(left)||!VERSION.test(right))fail('UPDATE_INVALID_VERSION');
  const a=left.split('.').map(Number),b=right.split('.').map(Number);
  for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i]?1:-1;
  return 0;
}
function cleanHttps(value){
  let url;try{url=new URL(value);}catch{fail('UPDATE_UNTRUSTED_URL');}
  if(typeof value!=='string'||url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.href!==value)fail('UPDATE_UNTRUSTED_URL');
  return url;
}
function artifactUrl(value,releaseId,platform){
  const url=cleanHttps(value),extension=platform==='win32'?'exe':'dmg';
  if(url.hostname!=='github.com'||url.search||!new RegExp('^/unmet23-lab/synk-policy/releases/download/'+releaseId.replace(/\./g,'\\.')+'/[A-Za-z0-9][A-Za-z0-9._-]*\\.'+extension+'$').test(url.pathname))fail('UPDATE_UNTRUSTED_URL');
  return url.href;
}
function validateManifest(value,{platform,arch,currentVersion,currentBuildId,now=Date.now()}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.schemaVersion!==1||value.product!=='platform'||value.channel!=='preview'||typeof value.version!=='string'||!VERSION.test(value.version)||typeof value.buildId!=='string'||!BUILD.test(value.buildId)||value.releaseId!==`platform-preview-${value.version}`)fail('UPDATE_INVALID_MANIFEST');
  const published=Date.parse(value.publishedAt);
  if(typeof value.publishedAt!=='string'||!Number.isFinite(published)||new Date(published).toISOString()!==value.publishedAt||published>now+10*60*1000)fail('UPDATE_INVALID_MANIFEST');
  if(!Array.isArray(value.artifacts)||!value.artifacts.length||value.artifacts.length>4)fail('UPDATE_INVALID_MANIFEST');
  const keys=new Set();
  const artifacts=value.artifacts.map(artifact=>{
    if(!artifact||typeof artifact!=='object'||!['win32','darwin'].includes(artifact.platform)||!['x64','arm64'].includes(artifact.arch)||!Number.isSafeInteger(artifact.bytes)||artifact.bytes<=0||artifact.bytes>MAX_INSTALLER_BYTES||typeof artifact.sha256!=='string'||!HASH.test(artifact.sha256)||typeof artifact.asarSHA256!=='string'||!HASH.test(artifact.asarSHA256))fail('UPDATE_INVALID_ARTIFACT');
    const key=`${artifact.platform}-${artifact.arch}`;if(keys.has(key))fail('UPDATE_INVALID_ARTIFACT');keys.add(key);
    return {platform:artifact.platform,arch:artifact.arch,bytes:artifact.bytes,sha256:artifact.sha256,asarSHA256:artifact.asarSHA256,url:artifactUrl(artifact.url,value.releaseId,artifact.platform)};
  });
  const compared=compareVersion(value.version,currentVersion);
  if(compared<0)fail('UPDATE_DOWNGRADE_REJECTED');
  if(compared===0&&value.buildId!==currentBuildId)fail('UPDATE_BUILD_MISMATCH');
  const artifact=artifacts.find(item=>item.platform===platform&&item.arch===arch);
  if(!artifact)fail('UPDATE_PLATFORM_UNAVAILABLE');
  return {version:value.version,buildId:value.buildId,releaseId:value.releaseId,publishedAt:value.publishedAt,artifact,current:compared===0};
}
function requestHttps(url,{signal}={}){
  return new Promise((resolve,reject)=>{
    const request=https.get(url,{signal,headers:{Accept:'application/octet-stream, application/json','Accept-Encoding':'identity','User-Agent':'SYNK-Platform-Preview-Updater'}},response=>resolve({status:response.statusCode,headers:response.headers,body:response}));
    request.setTimeout(30000,()=>request.destroy(Object.assign(new Error('Update request timed out'),{updateCode:'UPDATE_TIMEOUT'})));
    request.on('error',reject);
  });
}
const header=(response,name)=>response.headers?.get?response.headers.get(name):response.headers?.[name];
function discard(response){response?.body?.destroy?.();void response?.body?.cancel?.().catch?.(()=>{});}
async function responseFor(url,{request,signal,artifact=false}){
  const original=url;
  for(let redirects=0;redirects<=3;redirects++){
    if(signal.aborted)fail('UPDATE_CANCELLED');
    const response=await request(url,{signal});
    if(signal.aborted){discard(response);fail('UPDATE_CANCELLED');}
    if([301,302,303,307,308].includes(response.status)){
      const location=header(response,'location');discard(response);
      if(!artifact||redirects===3||typeof location!=='string')fail('UPDATE_UNTRUSTED_REDIRECT');
      let next;try{next=cleanHttps(new URL(location,url).href);}catch{fail('UPDATE_UNTRUSTED_REDIRECT');}
      if(next.href!==original&&(next.hostname!=='release-assets.githubusercontent.com'||!next.pathname.startsWith('/github-production-release-asset/')))fail('UPDATE_UNTRUSTED_REDIRECT');
      url=next.href;continue;
    }
    if(response.status!==200){discard(response);fail('UPDATE_HTTP_FAILED');}
    const encoding=header(response,'content-encoding');if(encoding&&encoding!=='identity'){discard(response);fail('UPDATE_INVALID_RESPONSE');}
    return response;
  }
  fail('UPDATE_UNTRUSTED_REDIRECT');
}
async function verifyFile(filename,artifact){
  const stat=await fsp.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==artifact.bytes)fail('UPDATE_INTEGRITY_FAILED');
  const hash=createHash('sha256');let size=0;
  for await(const chunk of fs.createReadStream(filename)){size+=chunk.length;if(size>artifact.bytes)fail('UPDATE_INTEGRITY_FAILED');hash.update(chunk);}
  if(size!==artifact.bytes||hash.digest('hex')!==artifact.sha256)fail('UPDATE_INTEGRITY_FAILED');
}
function createPlatformUpdater({enabled=false,config,currentVersion,currentBuildId=config?.buildId,platform=process.platform,arch=process.arch,cacheRoot,request=requestHttps,onChange=()=>{},requestQuit=()=>{},openInstaller=async()=>{},openDiskImage=async()=>'',setInterval:repeat=setInterval,clearInterval:clearRepeat=clearInterval,checkIntervalMs=6*60*60*1000,timeoutMs=10*60*1000,now=Date.now}={}){
  const valid=enabled&&config?.manifestUrl===MANIFEST_URL&&config?.channel==='preview'&&VERSION.test(currentVersion)&&BUILD.test(currentBuildId)&&config?.releaseId===`platform-preview-${currentVersion}`&&['win32','darwin'].includes(platform)&&['x64','arm64'].includes(arch)&&typeof cacheRoot==='string'&&path.isAbsolute(cacheRoot);
  let state=valid?'idle':'disabled',code=valid?null:'UPDATE_UNAVAILABLE',progress=0,candidate=null,readyPath=null,operation=null,controller=null,disposed=false,timer=null,started=false,handoff=false;
  function snapshot(){return {ok:state!=='error'&&state!=='disabled',state,currentVersion:typeof currentVersion==='string'?currentVersion:'',currentBuildId:typeof currentBuildId==='string'?currentBuildId:'',latestVersion:candidate?.version||null,latestBuildId:candidate?.buildId||null,progress,code};}
  function publish(next,nextCode=null){if(disposed)return;state=next;code=nextCode;try{onChange(snapshot());}catch{}}
  function errorResult(error){const nextCode=error?.updateCode||(['ENOSPC','EACCES','EPERM','EROFS','EIO'].includes(error?.code)?'UPDATE_STORAGE_FAILED':'UPDATE_NETWORK_FAILED');publish('error',nextCode);return snapshot();}
  const busy=()=>({...snapshot(),ok:false,code:'UPDATE_BUSY'});
  function run(kind,task){
    if(disposed)return Promise.resolve({...snapshot(),ok:false,code:'UPDATE_CANCELLED'});
    if(!valid)return Promise.resolve(snapshot());
    if(operation)return operation.kind===kind?operation.promise:Promise.resolve(busy());
    const record={kind,promise:null};operation=record;
    controller=new AbortController();const activeController=controller,signal=controller.signal;let timedOut=false;
    const timeout=setTimeout(()=>{timedOut=true;activeController.abort();},kind==='check'?Math.min(timeoutMs,15000):timeoutMs);timeout.unref?.();
    record.promise=Promise.resolve().then(()=>task(signal)).catch(error=>errorResult(timedOut?{updateCode:'UPDATE_TIMEOUT'}:signal.aborted?{updateCode:'UPDATE_CANCELLED'}:error)).finally(()=>{clearTimeout(timeout);if(operation===record){operation=null;controller=null;}});
    return record.promise;
  }
  async function checkTask(signal){
    if(state==='opening')return busy();
    publish('checking');
    const response=await responseFor(MANIFEST_URL,{request,signal});let size=0;const pieces=[];
    try{for await(const piece of response.body){const chunk=Buffer.from(piece);size+=chunk.length;if(size>MAX_MANIFEST_BYTES)fail('UPDATE_MANIFEST_TOO_LARGE');pieces.push(chunk);if(signal.aborted)fail('UPDATE_CANCELLED');}}
    finally{discard(response);}
    let parsed;try{parsed=JSON.parse(Buffer.concat(pieces).toString('utf8'));}catch{fail('UPDATE_INVALID_MANIFEST');}
    const latest=validateManifest(parsed,{platform,arch,currentVersion,currentBuildId,now:now()});
    if(disposed||signal.aborted)fail('UPDATE_CANCELLED');
    const same=candidate?.artifact.sha256===latest.artifact.sha256&&candidate?.buildId===latest.buildId;
    candidate=latest;if(!same)readyPath=null;progress=readyPath?100:0;
    publish(latest.current?'current':readyPath?'ready':'available');return snapshot();
  }
  function checkForUpdate(){return run('check',checkTask);}
  async function downloadTask(signal){
    if(!candidate||candidate.current||state==='opening')return {...snapshot(),ok:false,code:'UPDATE_NOT_AVAILABLE'};
    const selected=candidate,artifact=selected.artifact;
    progress=0;publish('downloading');
    await fsp.mkdir(cacheRoot,{recursive:true,mode:0o700});
    const directory=await fsp.lstat(cacheRoot);if(!directory.isDirectory()||directory.isSymbolicLink())fail('UPDATE_INVALID_CACHE');
    const target=path.join(cacheRoot,`${selected.releaseId}-${selected.buildId}-${platform}-${arch}-${artifact.sha256}.${platform==='win32'?'exe':'dmg'}`);
    try{await verifyFile(target,artifact);if(disposed||signal.aborted)fail('UPDATE_CANCELLED');readyPath=target;progress=100;publish('ready');return snapshot();}
    catch(error){if(error.updateCode==='UPDATE_CANCELLED')throw error;if(error.code!=='ENOENT')await fsp.unlink(target);}
    const temporary=target+'.'+randomUUID()+'.partial';let file,response;
    try{
      response=await responseFor(artifact.url,{request,signal,artifact:true});
      const declared=header(response,'content-length');if(declared!==undefined&&declared!==null&&(!/^\d+$/.test(String(declared))||Number(declared)!==artifact.bytes))fail('UPDATE_INTEGRITY_FAILED');
      file=await fsp.open(temporary,'wx',0o600);let received=0;const hash=createHash('sha256');
      for await(const piece of response.body){
        if(disposed||signal.aborted)fail('UPDATE_CANCELLED');
        const chunk=Buffer.from(piece);received+=chunk.length;if(received>artifact.bytes)fail('UPDATE_INTEGRITY_FAILED');
        hash.update(chunk);await file.writeFile(chunk);
        const next=Math.min(99,Math.floor(received/artifact.bytes*100));if(next!==progress){progress=next;publish('downloading');}
      }
      if(received!==artifact.bytes||hash.digest('hex')!==artifact.sha256)fail('UPDATE_INTEGRITY_FAILED');
      await file.sync();await file.close();file=null;
      if(disposed||signal.aborted)fail('UPDATE_CANCELLED');
      await fsp.rename(temporary,target);readyPath=target;progress=100;publish('ready');return snapshot();
    }finally{discard(response);await file?.close().catch(()=>{});await fsp.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  }
  function downloadUpdate(){return run('download',downloadTask);}
  function installUpdate(){return run('install',async signal=>{
    if(state==='opening')return snapshot();
    if(!candidate||candidate.current||!readyPath||state!=='ready')return {...snapshot(),ok:false,code:'UPDATE_NOT_READY'};
    try{await verifyFile(readyPath,candidate.artifact);}catch{fail('UPDATE_INTEGRITY_FAILED');}if(disposed||signal.aborted)fail('UPDATE_CANCELLED');
    publish('opening');
    if(platform==='darwin'){
      try{const error=await openDiskImage(readyPath);if(error)fail('UPDATE_OPEN_FAILED');}catch{fail('UPDATE_OPEN_FAILED');}
      publish('ready','UPDATE_MANUAL_INSTALL');
    }else{handoff=false;try{requestQuit();}catch{fail('UPDATE_OPEN_FAILED');}}
    return snapshot();
  });}
  // Called only after Electron's normal close/beforeunload guards have accepted.
  // The Windows wrapper waits for this process, then shows the usual installer.
  function completeInstall(){return run('handoff',async signal=>{
    if(state!=='opening'||platform!=='win32'||handoff||!readyPath)return {...snapshot(),ok:false,code:'UPDATE_NOT_READY'};
    try{await verifyFile(readyPath,candidate.artifact);}catch{fail('UPDATE_INTEGRITY_FAILED');}if(disposed||signal.aborted)fail('UPDATE_CANCELLED');
    try{await openInstaller(readyPath);}catch{fail('UPDATE_OPEN_FAILED');}
    handoff=true;return snapshot();
  });}
  function cancelInstall(){if(state==='opening'&&!handoff)publish('ready','UPDATE_EXIT_CANCELLED');}
  function start(){if(started||!valid||disposed)return;started=true;void checkForUpdate();if(checkIntervalMs>0){timer=repeat(()=>{if(!operation&&!['opening','ready','downloading'].includes(state))void checkForUpdate();},checkIntervalMs);timer.unref?.();}}
  function dispose(){disposed=true;controller?.abort();if(timer!==null)clearRepeat(timer);timer=null;}
  return {snapshot,checkForUpdate,downloadUpdate,installUpdate,completeInstall,cancelInstall,needsInstallHandoff:()=>state==='opening'&&platform==='win32'&&!handoff,start,dispose};
}
module.exports={MANIFEST_URL,MAX_MANIFEST_BYTES,MAX_INSTALLER_BYTES,compareVersion,validateManifest,createPlatformUpdater};
