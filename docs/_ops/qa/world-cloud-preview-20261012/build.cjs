'use strict';
// Frozen 0.4.0 public payload + the explicitly scoped WORLD HTTPS overlay.
// No installed app or user profile is accessed, and no artifact is uploaded.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),work=__dirname,version='0.4.1';
const asar=require(path.join(root,'desktop/node_modules/@electron/asar'));
const {build,Platform,Arch}=require(path.join(root,'desktop/node_modules/electron-builder'));
const ResEdit=require(path.join(root,'desktop/node_modules/resedit'));
const {sourceHash}=require(path.join(root,'desktop/tools/source-hash.cjs'));
const z=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe');
const SOURCE_OVERLAY=['src/catalog.cjs','src/security.cjs','src/connection-content.cjs'];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=f=>digest(fs.readFileSync(f));
const assert=(v,m)=>{if(!v)throw Error(m);};
const walk=(dir,rel='')=>fs.readdirSync(path.join(dir,rel),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir,path.join(rel,e.name)):[path.join(rel,e.name).replaceAll('\\','/')]).sort();
const save=(name,data)=>fs.writeFileSync(path.join(work,name),JSON.stringify(data,null,2)+'\n');
const read=name=>JSON.parse(fs.readFileSync(path.join(work,name),'utf8'));
const json=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
const clientPaths=client=>({payload:path.join(work,client,'payload'),stage:path.join(work,client,'stage'),archive:path.join(work,client,'payload/resources/app.asar'),executable:path.join(work,client,'payload',client==='world'?'SYNKWorldPreview.exe':'SYNKPlatformPreview.exe')});
function assertBaseline(client){const {payload,stage}=clientPaths(client);for(const f of read(client+'-baseline-payload.json').files)assert(hash(path.join(payload,f.path))===f.sha256,client+' payload baseline differs '+f.path);for(const f of read(client+'-baseline-asar.json').files)assert(hash(path.join(stage,f.path))===f.sha256,client+' stage baseline differs '+f.path);}
function updatePE(file){
  const before=fs.readFileSync(file),exe=ResEdit.NtExecutable.from(before),resources=ResEdit.NtExecutableResource.from(exe);
  const nonVersion=resources.entries.filter(e=>e.type!==16).map(e=>({type:e.type,id:e.id,lang:e.lang,sha256:digest(Buffer.from(e.bin))}));
  const sections=exe.getAllSections().filter(s=>s.info.name!=='.rsrc').map(s=>({name:s.info.name,sha256:digest(Buffer.from(s.data||[]))}));
  const versions=ResEdit.Resource.VersionInfo.fromEntries(resources.entries);assert(versions.length===1,'Expected one VERSIONINFO');
  for(const v of versions){v.setFileVersion(0,4,1,0,1033);v.setProductVersion(0,4,1,0,1033);v.outputToResourceEntries(resources.entries);}
  resources.outputResource(exe);fs.writeFileSync(file,Buffer.from(exe.generate()));
  const parsed=ResEdit.NtExecutable.from(fs.readFileSync(file)),afterRes=ResEdit.NtExecutableResource.from(parsed);
  assert(JSON.stringify(nonVersion)===JSON.stringify(afterRes.entries.filter(e=>e.type!==16).map(e=>({type:e.type,id:e.id,lang:e.lang,sha256:digest(Buffer.from(e.bin))}))), 'Non-version PE resources changed');
  assert(JSON.stringify(sections)===JSON.stringify(parsed.getAllSections().filter(s=>s.info.name!=='.rsrc').map(s=>({name:s.info.name,sha256:digest(Buffer.from(s.data||[]))}))), 'PE code/data sections changed');
  const actual=ResEdit.Resource.VersionInfo.fromEntries(afterRes.entries)[0];assert(actual.fixedInfo.fileVersionMS===4&&actual.fixedInfo.fileVersionLS===65536&&actual.fixedInfo.productVersionMS===4&&actual.fixedInfo.productVersionLS===65536,'PE version mismatch');
  return {before:digest(before),after:hash(file),fileVersion:'0.4.1.0',productVersion:'0.4.1.0',nonVersionResourceCount:nonVersion.length,unchangedCodeDataSections:sections.length};
}
async function repackStage(client,extraChanges){
  const {stage,payload,archive,executable}=clientPaths(client),oldFiles=read(client+'-baseline-asar.json').files;
  const pkgPath=path.join(stage,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgPath));assert(pkg.version==='0.4.0','Package baseline version');pkg.version=version;json(pkgPath,pkg);
  const changed=new Set([...extraChanges,'package.json']);assert(walk(stage).join('\n')===oldFiles.map(f=>f.path).join('\n'),'ASAR membership changed');
  for(const f of oldFiles)if(!changed.has(f.path))assert(hash(path.join(stage,f.path))===f.sha256,'Unrelated stage changed '+client+' '+f.path);
  await asar.createPackage(stage,archive);asar.uncache(archive);
  for(const f of walk(stage))assert(asar.extractFile(archive,path.normalize(f)).equals(fs.readFileSync(path.join(stage,f))),'ASAR write mismatch '+f);
  const metadataPath=path.join(payload,'resources/synk-install.json'),metadata=JSON.parse(fs.readFileSync(metadataPath));metadata.version=version;metadata.sourceHash=sourceHash(stage);json(metadataPath,metadata);
  const pe=updatePE(executable),allowed=new Set(['resources/app.asar','resources/synk-install.json',path.basename(executable),...(client==='platform'?['resources/clients/world.exe']:[])]);
  const baseline=read(client+'-baseline-payload.json').files;assert(walk(payload).join('\n')===baseline.map(f=>f.path).join('\n'),'Payload membership changed');
  for(const f of baseline)if(!allowed.has(f.path))assert(hash(path.join(payload,f.path))===f.sha256,'Unrelated payload changed '+client+' '+f.path);
  const changes=oldFiles.filter(f=>hash(path.join(stage,f.path))!==f.sha256).map(f=>({path:f.path,before:f.sha256,after:hash(path.join(stage,f.path))}));
  const runtime=JSON.parse(fs.readFileSync(path.join(stage,'runtime.json')));
  const result={ok:true,client,version,preparedAt:new Date().toISOString(),payload,stage,executable:{path:executable,sha256:hash(executable),...pe},asar:{path:archive,sha256:hash(archive),files:oldFiles.length},metadata,entry:runtime.entry,changedMembers:changes,sourceHash:metadata.sourceHash,installedStateTouched:false};
  save(client+'-candidate.json',result);console.log(JSON.stringify({step:client+'-candidate-ready',payload,entry:runtime.entry,asarSHA256:result.asar.sha256,changedMembers:changes.map(f=>f.path)}));return result;
}
async function stageWorld(){
  assert(!fs.existsSync(path.join(work,'world-candidate.json')),'Preserve WORLD candidate');assertBaseline('world');const {stage}=clientPaths('world');
  const frozen=SOURCE_OVERLAY.map(p=>({path:p,sha256:hash(path.join(root,'desktop',p))}));save('world-source-overlay.json',{files:frozen});
  for(const f of frozen)fs.copyFileSync(path.join(root,'desktop',f.path),path.join(stage,f.path));
  const mainPath=path.join(stage,'src/main.cjs'),before=fs.readFileSync(mainPath,'utf8'),needle='messengerCloudPreview:runtime.messengerCloudPreview,productName:';
  assert(before.split(needle).length===2,'Expected one frozen main connection-content call');fs.writeFileSync(mainPath,before.replace(needle,'messengerCloudPreview:runtime.messengerCloudPreview,worldCloudPreview:runtime.worldCloudPreview,productName:'));
  const runtimePath=path.join(stage,'runtime.json'),runtime=JSON.parse(fs.readFileSync(runtimePath));runtime.entry='https://synk.im/account/client.html?product=world';runtime.worldCloudPreview=true;json(runtimePath,runtime);
  const {safeEntry}=require(path.join(stage,'src/security.cjs'));assert(safeEntry(runtime.entry,runtime.mode,runtime),'Cloud entry rejected by staged security');
  const result=await repackStage('world',[...SOURCE_OVERLAY,'src/main.cjs','runtime.json']);
  assert(frozen.every(f=>hash(path.join(root,'desktop',f.path))===f.sha256),'WORLD source changed during staging');return result;
}
async function stagePlatform(){
  assert(!fs.existsSync(path.join(work,'platform-candidate.json')),'Preserve Platform candidate');assertBaseline('platform');
  const world=read('world-candidate.json'),worldPackage=read('world-package.json'),{stage,payload}=clientPaths('platform');
  assert(hash(worldPackage.installer.path)===worldPackage.installer.sha256,'WORLD installer differs');fs.copyFileSync(worldPackage.installer.path,path.join(payload,'resources/clients/world.exe'));
  const runtimePath=path.join(stage,'runtime.json'),runtime=JSON.parse(fs.readFileSync(runtimePath));
  const existing=runtime.releases.find(r=>r.id==='world');assert(existing.version==='0.4.0'&&existing.installer.sha256==='537578727fe799eecb0923b1b4b8dfa4778e188103a2113a2c9e8860b0b66ac4','WORLD release baseline');
  const {installer,...historic}=existing;
  runtime.releases=[{...historic,version,executableSHA256:world.executable.sha256,asarSHA256:world.asar.sha256,installer:{relativePath:'world.exe',sha256:worldPackage.installer.sha256,bytes:worldPackage.installer.bytes}},...runtime.releases.map(r=>r.id==='world'?historic:r)];json(runtimePath,runtime);
  return repackStage('platform',['runtime.json']);
}
async function pack(client){
  assert(!fs.existsSync(path.join(work,client+'-package.json')),'Preserve installer result');const candidate=read(client+'-candidate.json'),{payload,stage}=clientPaths(client);
  assert(hash(candidate.executable.path)===candidate.executable.sha256&&hash(candidate.asar.path)===candidate.asar.sha256,'Candidate changed before build');
  const original=client==='world'?'docs/_ops/qa/platform-reinstall-20261010/world-builder-config.json':'.tmp/platform-download-20261011/package/platform-builder-config.json';
  const config=JSON.parse(fs.readFileSync(path.join(root,original))),out=path.join(work,client,'dist');assert(!fs.existsSync(out),'Preserve prior installer output');
  config.directories={app:stage,output:out,buildResources:path.join(stage,'assets')};config.win.icon=path.join(stage,'assets',client+'.ico');save(client+'-builder-config.json',config);
  const before=walk(payload).map(p=>({path:p,sha256:hash(path.join(payload,p))}));save(client+'-final-payload.json',{files:before});
  const artifacts=await build({projectDir:stage,prepackaged:payload,targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config,publish:'never'});
  assert(before.every(f=>hash(path.join(payload,f.path))===f.sha256),'Builder changed payload');const built=artifacts.find(f=>f.endsWith('.exe'));assert(built,'Missing installer');
  const crc=spawnSync(z,['t',built],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:4000000});fs.writeFileSync(path.join(work,client+'-crc.log'),(crc.stdout||'')+(crc.stderr||''));assert(crc.status===0,'Installer CRC failed');
  const name=client==='world'?'SYNK-WORLD-Preview-0.4.1-win-x64.exe':'SYNK-Platform-Preview-0.4.1-win-x64.exe';const target=path.join(work,'..',name);assert(!fs.existsSync(target),'Preserve public delivery');fs.copyFileSync(built,target);
  const result={ok:true,client,version,completedAt:new Date().toISOString(),installer:{path:target,sha256:hash(target),bytes:fs.statSync(target).size},asar:candidate.asar,executable:candidate.executable,sourceHash:candidate.sourceHash,unsignedPreview:true,installerExecuted:false,publicUpload:false,installedStateTouched:false};save(client+'-package.json',result);console.log(JSON.stringify({step:client+'-installer-complete',installer:result.installer}));return result;
}
async function finish(){const world=read('world-package.json'),platform=read('platform-package.json'),prep=read('preparation.json');const original=prep.sourceInstaller;assert(hash(original.path)===original.sha256,'Original installer changed');const result={ok:true,completedAt:new Date().toISOString(),version,sourceInstaller:original,installer:platform.installer,world:world.installer,platform,worldPackage:world,worldEntry:'https://synk.im/account/client.html?product=world',workspaceUnchanged:true,platformUIUnchanged:true,originalInputsPreserved:true,installerExecuted:false,publicUpload:false,unsignedPreview:true,requiresInternet:true,requiresDevelopmentServer:false};save('public-package.json',result);console.log(JSON.stringify({ok:true,installer:result.installer,world:result.world}));}
(async()=>{const step=process.argv[2];if(step==='stage-world')await stageWorld();else if(step==='pack-world')await pack('world');else if(step==='stage-platform')await stagePlatform();else if(step==='pack-platform'){await pack('platform');await finish();}else throw Error('Use stage-world, pack-world, stage-platform, or pack-platform');})().catch(e=>{save('failure-'+process.argv[2]+'.json',{at:new Date().toISOString(),error:e.stack||e.message});console.error(e.stack||e.message);process.exitCode=1;});
