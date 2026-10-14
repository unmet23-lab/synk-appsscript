'use strict';

// Electron's ordinary fs virtualizes app.asar as a directory. Recovery pins the
// actual archive bytes, matching the native installer, via original-fs.
let fs;try{fs=require('original-fs');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;fs=require('node:fs');}
const fsp=fs.promises,path=require('node:path');
const {createHash,randomBytes}=require('node:crypto');
const HASH=/^[a-f0-9]{64}$/;
const fail=()=>{throw Object.assign(new Error('UPDATE_RECOVERY_INVALID'),{updateCode:'UPDATE_RECOVERY_INVALID'});};
async function noLinks(filename){for(let next=path.resolve(filename);;){try{if((await fsp.lstat(next)).isSymbolicLink())fail();}catch(error){if(error.code!=='ENOENT')throw error;}const parent=path.dirname(next);if(parent===next)return;next=parent;}}
async function digest(filename){await noLinks(filename);const stat=await fsp.lstat(filename);if(!stat.isFile())fail();const hash=createHash('sha256');for await(const chunk of fs.createReadStream(filename))hash.update(chunk);return hash.digest('hex');}
async function readRecord(filename){await noLinks(filename);const stat=await fsp.lstat(filename);if(!stat.isFile()||stat.size>8192)fail();return JSON.parse(await fsp.readFile(filename,'utf8'));}
function createUpdateRecovery({cacheRoot,localAppData,executablePath,asarPath,currentVersion,appId='im.synk.platform.preview',now=Date.now}={}){
  if(appId!=='im.synk.platform.preview'||![cacheRoot,localAppData,executablePath,asarPath].every(value=>typeof value==='string'&&path.isAbsolute(value)))fail();
  const pendingPath=path.join(cacheRoot,'pending-auto-update.json'),markerPath=path.join(localAppData,'SYNK','Installer','Recovery',appId+'.json');
  const same=(a,b)=>typeof a==='string'&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
  async function prepare({targetVersion,installerSHA256}={}){
    if(typeof targetVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(targetVersion)||!HASH.test(installerSHA256||''))fail();
    await noLinks(cacheRoot);await fsp.mkdir(cacheRoot,{recursive:true,mode:0o700});await noLinks(pendingPath);
    const nonce=randomBytes(32).toString('hex');
    const record={schemaVersion:1,appId,nonce,targetVersion,installerSHA256,oldVersion:currentVersion,oldexeSHA:await digest(executablePath),oldasarSHA:await digest(asarPath),expectedexePath:path.resolve(executablePath),createdAt:new Date(now()).toISOString()};
    const temporary=pendingPath+'.'+nonce+'.partial';
    try{await fsp.writeFile(temporary,JSON.stringify(record),{flag:'wx',mode:0o600});await fsp.rename(temporary,pendingPath);}finally{await fsp.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
    return nonce;
  }
  async function consume(argv=[]){
    const flags=argv.filter(value=>typeof value==='string'&&value.startsWith('--synk-update-recovery='));
    if(!flags.length)return {requested:false,recovered:false,code:null};
    try{
      if(flags.length!==1)fail();const nonce=flags[0].slice('--synk-update-recovery='.length);if(!HASH.test(nonce))fail();
      const pending=await readRecord(pendingPath),marker=await readRecord(markerPath),time=now(),created=Date.parse(marker.createdAt),expires=Date.parse(marker.expiresAt);
      if(pending.schemaVersion!==1||marker.schemaVersion!==1||pending.appId!==appId||marker.appId!==appId||pending.nonce!==nonce||marker.nonce!==nonce||!['rolled-back','unchanged'].includes(marker.status)||!same(pending.expectedexePath,executablePath)||!same(marker.executablePath,executablePath)||pending.oldVersion!==currentVersion||marker.fromVersion!==currentVersion||pending.targetVersion!==marker.toVersion||pending.installerSHA256!==marker.installerSHA256||!HASH.test(marker.installerSHA256||'')||!Number.isFinite(created)||!Number.isFinite(expires)||created>time+30000||created<time-600000||expires<=time||expires>created+600000)fail();
      if(!HASH.test(pending.oldexeSHA||'')||!HASH.test(pending.oldasarSHA||'')||pending.oldexeSHA!==marker.executableSHA256||pending.oldasarSHA!==marker.asarSHA256||await digest(executablePath)!==pending.oldexeSHA||await digest(asarPath)!==pending.oldasarSHA)fail();
      await fsp.unlink(markerPath);await fsp.unlink(pendingPath);
      return {requested:true,recovered:true,code:'UPDATE_RECOVERED',releaseId:'platform-preview-'+pending.targetVersion};
    }catch{return {requested:true,recovered:false,code:'UPDATE_RECOVERY_INVALID'};}
  }
  return {prepare,consume};
}
module.exports={createUpdateRecovery};
