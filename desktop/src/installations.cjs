'use strict';
// Installed archives are physical files. Electron's patched fs treats .asar as
// a virtual directory and returns ENOENT when hashing the archive itself.
const physicalFs=process.versions.electron?require('original-fs'):require('node:fs'),fs=physicalFs.promises;
const path=require('node:path'),crypto=require('node:crypto');
const {CLIENTS,identity}=require('./catalog.cjs');
const {inside}=require('./security.cjs');
const {releasesFor,compareVersions,installerPath}=require('./release-catalog.cjs');
// Executables can exceed 200 MiB. Bounded chunks keep integrity checks from
// retaining both clients in memory or hashing a whole executable in one turn.
// Every inspection still reads fresh physical bytes, including before launch.
const digest=async file=>{const hash=crypto.createHash('sha256');for await(const chunk of physicalFs.createReadStream(file))hash.update(chunk);return hash.digest('hex');};
function installationPaths(id,{platform,mode,programRoot}) {
  const c=identity(id,mode),p=platform==='win32'?path.win32:path.posix;
  const root=platform==='win32'?p.join(programRoot,c.executableName):p.join(programRoot,c.executableName+'.app');
  return {root,executable:platform==='win32'?p.join(root,c.executableName+'.exe'):p.join(root,'Contents','MacOS',c.executableName),asar:platform==='win32'?p.join(root,'resources','app.asar'):p.join(root,'Contents','Resources','app.asar'),metadata:platform==='win32'?p.join(root,'resources','synk-install.json'):p.join(root,'Contents','Resources','synk-install.json')};
}
function createInstallations({clientId,mode,platform,arch,programRoot,releases=[],spawn,readFile=fs.readFile,realpath=fs.realpath,hash=digest}) {
  async function inspect(id) {
    if(!Object.hasOwn(CLIENTS,id))return {id,status:'unavailable',canLaunch:false,reason:'UNKNOWN_CLIENT'};
    const c=identity(id,mode),base={id,name:c.name,canLaunch:false};
    if(id===clientId)return {...base,status:'current',reason:'CURRENT_CLIENT'};
    const candidates=releasesFor(releases,{platform,arch,mode}).filter(r=>r.id===id),latest=candidates.find(r=>installerPath(r,programRoot))||candidates[0];
    if(!latest)return {...base,status:'unavailable',reason:'RELEASE_UNAVAILABLE'};
    if(!['win32','darwin'].includes(platform))return {...base,status:'unavailable',reason:'UNSUPPORTED_PLATFORM'};
    const locations=installationPaths(id,{platform,mode,programRoot});
    try {
      const root=await realpath(programRoot),install=await realpath(locations.root),executable=await realpath(locations.executable),asar=await realpath(locations.asar),metadataPath=await realpath(locations.metadata);
      if(!inside(root,install)||!inside(install,executable)||!inside(install,asar)||!inside(install,metadataPath))throw Error('INVALID_INSTALLATION');
      const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
      const trusted=candidates.find(r=>r.version===metadata.version);
      if(!trusted||metadata.clientId!==id||metadata.appId!==c.appId||metadata.mode!==mode||metadata.arch!==arch||metadata.platform!==platform)throw Error('INVALID_INSTALLATION');
      if(await hash(executable)!==trusted.executableSHA256||await hash(asar)!==trusted.asarSHA256)throw Error('INVALID_INSTALLATION');
      return {...base,status:'installed',canLaunch:clientId==='platform',reason:clientId==='platform'?null:'LAUNCHER_ONLY',version:trusted.version,latestVersion:latest.version,updateAvailable:compareVersions(latest.version,trusted.version)>0,_executable:executable};
    } catch(error){return {...base,status:error.code==='ENOENT'?'not-installed':'unavailable',reason:error.code==='ENOENT'?'NOT_INSTALLED':'INVALID_INSTALLATION',latestVersion:latest.version,updateAvailable:false};}
  }
  return {
    async getClients(){return Promise.all(Object.keys(CLIENTS).map(async id=>{const {_executable,...safe}=await inspect(id);return safe;}));},
    async launch(id) {
      if(typeof id!=='string'||!Object.hasOwn(CLIENTS,id))return {ok:false,code:'UNKNOWN_CLIENT'};
      if(clientId!=='platform')return {ok:false,code:'LAUNCHER_ONLY'};
      const found=await inspect(id);if(!found.canLaunch)return {ok:false,code:found.reason};
      try {await new Promise((resolve,reject)=>{const child=spawn(found._executable,[],{shell:false,detached:true,stdio:'ignore',windowsHide:false});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});return {ok:true};}catch{return {ok:false,code:'LAUNCH_FAILED'};}
    }
  };
}
module.exports={createInstallations,installationPaths};
