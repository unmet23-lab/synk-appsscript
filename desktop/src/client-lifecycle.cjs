'use strict';
const fs=require('node:fs/promises'),streams=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
const {CLIENTS}=require('./catalog.cjs');
const {inside}=require('./security.cjs');
const {createInstallations}=require('./installations.cjs');
const {installerPath,releasesFor}=require('./release-catalog.cjs');
async function fileHash(file) {const hash=crypto.createHash('sha256');for await(const chunk of streams.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
function createClientLifecycle(options) {
  const {clientId,mode,platform,arch,packageRoot,cacheRoot,openPath,onChange=()=>{}}=options;
  const releases=JSON.parse(JSON.stringify(releasesFor(options.releases,{mode,platform,arch})));
  const installations=createInstallations({...options,releases}),jobs=new Map();
  let disposed=false,installCache=null,installCacheAt=0,inspectPending=null;
  const notify=()=>{if(!disposed){try{onChange();}catch{}}};
  function denied(id) {if(typeof id!=='string'||!Object.hasOwn(CLIENTS,id))return 'UNKNOWN_CLIENT';if(clientId!=='platform')return 'LAUNCHER_ONLY';if(id==='platform')return 'CURRENT_CLIENT';return null;}
  function latest(id) {return releases.find(r=>r.id===id);}
  function availability(id) {const r=latest(id);return !denied(id)&&!disposed&&mode==='development'&&!!installerPath(r,packageRoot);}
  function state(id) {
    const r=latest(id),available=availability(id),j=jobs.get(id),status=j?.status||(available?'idle':'unavailable');
    return {status,available,source:available?'local-development':null,version:r?.version||null,progress:j?.progress||0,transferredBytes:j?.bytes||0,totalBytes:r?.installer?.bytes||0,canPrepare:available&&!['preparing','ready','opening','installer-opened'].includes(status),canOpen:available&&['ready','installer-opened'].includes(status),error:j?.error||null};
  }
  async function getClients() {
    if(!installCache||Date.now()-installCacheAt>2000) {
      if(!inspectPending)inspectPending=installations.getClients().then(value=>{installCache=value;installCacheAt=Date.now();return value;}).finally(()=>{inspectPending=null;});
      await inspectPending;
    }
    return installCache.map(item=>({...item,latestVersion:latest(item.id)?.version||item.latestVersion||null,updateAvailable:!!item.updateAvailable,installer:state(item.id)}));
  }
  async function trustedFile(file,root,expected) {
    const [canonicalRoot,canonicalFile]=await Promise.all([fs.realpath(root),fs.realpath(file)]);
    if(!inside(canonicalRoot,canonicalFile))throw Error('INVALID_PACKAGE_PATH');
    const stat=await fs.stat(canonicalFile);if(!stat.isFile()||stat.size!==expected.bytes)throw Error('PACKAGE_SIZE_MISMATCH');
    return canonicalFile;
  }
  async function prepare(id) {
    const forbidden=denied(id);if(forbidden)return {ok:false,code:forbidden};
    if(disposed)return {ok:false,code:'DISPOSED'};
    const r=latest(id);if(!availability(id))return {ok:false,code:'RELEASE_UNAVAILABLE'};
    const previous=jobs.get(id);if(previous&&['preparing','ready','opening','installer-opened'].includes(previous.status))return {ok:true,job:state(id)};
    const job={status:'preparing',progress:0,bytes:0,error:null,controller:new AbortController(),file:null,directory:null};
    jobs.set(id,job);notify();
    // A job copies real local installer bytes; it never simulates a network download or starts an installer.
    job.work=(async()=>{
      try {
        const source=await trustedFile(installerPath(r,packageRoot),packageRoot,r.installer);
        await fs.mkdir(cacheRoot,{recursive:true});
        const canonicalCache=await fs.realpath(cacheRoot);
        job.directory=await fs.mkdtemp(path.join(canonicalCache,id+'-'));
        if(job.controller.signal.aborted)throw Error('CANCELLED');
        job.file=path.join(job.directory,path.basename(source));
        const digest=crypto.createHash('sha256');let lastNotice=0;
        const meter=new Transform({transform(chunk,_encoding,callback){
          digest.update(chunk);job.bytes+=chunk.length;job.progress=Math.min(99,Math.floor(job.bytes/r.installer.bytes*100));
          if(job.bytes>r.installer.bytes)return callback(Error('PACKAGE_SIZE_MISMATCH'));
          if(Date.now()-lastNotice>75){lastNotice=Date.now();notify();}callback(null,chunk);
        }});
        await pipeline(streams.createReadStream(source),meter,streams.createWriteStream(job.file,{flags:'wx',mode:0o600}),{signal:job.controller.signal});
        if(job.controller.signal.aborted)throw Error('CANCELLED');
        if(job.bytes!==r.installer.bytes||digest.digest('hex')!==r.installer.sha256)throw Error('PACKAGE_HASH_MISMATCH');
        job.status='ready';job.progress=100;notify();
      } catch(error) {
        if(job.file)await fs.unlink(job.file).catch(()=>{});
        if(job.directory)await fs.rmdir(job.directory).catch(()=>{});
        job.file=null;job.status=job.controller.signal.aborted?'cancelled':'error';
        job.error=job.status==='cancelled'?null:['PACKAGE_HASH_MISMATCH','PACKAGE_SIZE_MISMATCH','INVALID_PACKAGE_PATH'].includes(error.message)?error.message:error.code==='ENOENT'?'PACKAGE_NOT_FOUND':'PREPARATION_FAILED';notify();
      }
    })();
    return {ok:true,job:state(id)};
  }
  return {
    getClients,
    async launch(id){if(disposed)return {ok:false,code:'DISPOSED'};const result=await installations.launch(id);installCacheAt=0;notify();return result;},
    prepareClient:prepare,
    async cancelPreparation(id){const forbidden=denied(id);if(forbidden)return {ok:false,code:forbidden};const job=jobs.get(id);if(!job||job.status!=='preparing')return {ok:false,code:'NOT_PREPARING'};job.controller.abort();await job.work;return {ok:true,job:state(id)};},
    async openInstaller(id){
      const forbidden=denied(id);if(forbidden)return {ok:false,code:forbidden};
      if(disposed)return {ok:false,code:'DISPOSED'};
      const job=jobs.get(id),r=latest(id);if(!job?.file||!['ready','installer-opened'].includes(job.status))return {ok:false,code:'PACKAGE_NOT_READY'};
      job.status='opening';notify();
      try {
        const file=await trustedFile(job.file,cacheRoot,r.installer);
        if(await fileHash(file)!==r.installer.sha256)throw Error('PACKAGE_HASH_MISMATCH');
        if(disposed)throw Error('DISPOSED');
        const error=await openPath(file);if(error)throw Error('INSTALLER_OPEN_FAILED');
        job.status='installer-opened';notify();return {ok:true,installationConfirmed:false};
      } catch(error){job.status='error';job.error=['PACKAGE_HASH_MISMATCH','PACKAGE_SIZE_MISMATCH','INVALID_PACKAGE_PATH'].includes(error.message)?error.message:'INSTALLER_OPEN_FAILED';notify();return {ok:false,code:job.error};}
    },
    dispose(){disposed=true;for(const job of jobs.values())if(job.status==='preparing')job.controller.abort();},
  };
}
module.exports={createClientLifecycle,fileHash};
