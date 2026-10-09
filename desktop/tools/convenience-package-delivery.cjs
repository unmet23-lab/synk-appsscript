'use strict';
// Platform-only personal Preview delivery. No installation, profile access or publication.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const desktop=path.resolve(__dirname,'..'),asar=require('@electron/asar');
const {sourceFiles,sourceHash}=require('./source-hash.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),fileHash=file=>hash(fs.readFileSync(file));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const resources=path.join(process.env.LOCALAPPDATA,'Programs','SYNKPlatformPreview','resources');
function checkedCandidate(value){const root=path.resolve(value||'');if(path.dirname(root)!==path.join(desktop,'artifacts')||!path.basename(root).startsWith('platform-convenience-candidate-'))throw Error('Fixed convenience candidate required');return root;}
function snapshot(){
  const root=checkedCandidate(path.join(desktop,'artifacts','platform-convenience-candidate-'+new Date().toISOString().replace(/[:.]/g,'-')));
  const before=sourceHash(desktop),runtime=JSON.parse(asar.extractFile(path.join(resources,'app.asar'),'runtime.json'));
  if(runtime.clientId!=='platform'||runtime.mode!=='development')throw Error('Installed Preview identity required');
  const authPath=require('../src/auth-config-path.cjs').resolveAuthConfigPath([],{root:desktop});
  const publicAuth=JSON.parse(fs.readFileSync(authPath,'utf8'));
  const {configuration}=require('../src/auth-config.cjs');
  if(JSON.stringify(publicAuth)!==JSON.stringify(runtime.auth)||configuration(publicAuth,'platform','development').fingerprint!==configuration(runtime.auth,'platform','development').fingerprint)throw Error('Installed and source public authentication configuration differ');
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
  for(const directory of ['src','renderer','assets','tools','tests'])fs.cpSync(path.join(desktop,directory),path.join(root,directory),{recursive:true});
  for(const file of ['package.json','package-lock.json'])fs.copyFileSync(path.join(desktop,file),path.join(root,file));
  fs.copyFileSync(authPath,path.join(root,'auth-config.snapshot.json'));
  write(path.join(root,'runtime-preserved.json'),runtime);
  const {validRelease,installerPath}=require('../src/release-catalog.cjs');
  const childInstallers=[];
  for(const release of runtime.releases){
    if(!['world','messenger'].includes(release.id)||!validRelease(release,{mode:'development',platform:'win32',arch:'x64'}))throw Error('Invalid existing child release');
    if(!release.installer)continue;
    const source=installerPath(release,path.join(resources,'clients'));
    if(!source||fileHash(source)!==release.installer.sha256||fs.statSync(source).size!==release.installer.bytes)throw Error('Existing child installer does not match its pinned release');
    const target=path.join(root,'preserved-clients',release.installer.relativePath);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
    childInstallers.push({id:release.id,source,path:target,sha256:fileHash(target),bytes:fs.statSync(target).size});
  }
  const frozen=sourceHash(root),after=sourceHash(desktop);
  if(before!==frozen||before!==after)throw Error('Shared source changed during snapshot; do not build this candidate');
  const validation=JSON.parse(fs.readFileSync(path.join(desktop,'artifacts','desktop-preferences-native-smoke.json')));
  const previousValidationComparison=Object.entries(validation.hashes).map(([file,expected])=>({file,expected,current:fileHash(path.join(root,file)),matches:expected===fileHash(path.join(root,file))}));
  const manifest={createdAt:new Date().toISOString(),sourceHash:frozen,version:require('../package.json').version,runtimeFiles:sourceFiles(root).map(file=>({file,sha256:fileHash(path.join(root,file)),bytes:fs.statSync(path.join(root,file)).size})),sharedSourceStableDuringSnapshot:true,auth:{source:authPath,sha256:fileHash(path.join(root,'auth-config.snapshot.json')),matchesInstalled:true,platformFingerprintMatchesInstalled:true,clientKeys:Object.keys(publicAuth.clients)},preservedInstalledMetadata:JSON.parse(fs.readFileSync(path.join(resources,'synk-install.json'))),childInstallers,previousValidationComparison,installerExecuted:false,normalProfileRead:false,publish:'never'};
  write(path.join(root,'snapshot-manifest.json'),manifest);console.log(JSON.stringify({candidate:root,sourceHash:frozen,runtimeFiles:manifest.runtimeFiles.length,previousNativeHashesMatch:previousValidationComparison.every(row=>row.matches),preservedChildren:childInstallers.map(row=>row.id)}));
}
async function buildCandidate(root){
  root=checkedCandidate(root);const manifest=JSON.parse(fs.readFileSync(path.join(root,'snapshot-manifest.json')));
  if(sourceHash(root)!==manifest.sourceHash)throw Error('Candidate has changed');
  const {build,Platform,Arch}=require('electron-builder');
  const config=require(path.join(root,'tools/package.cjs')).prepare('platform',{mode:'development',platform:'win32',arch:'x64',authConfig:path.join(root,'auth-config.snapshot.json')});
  const runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-preserved.json')));
  write(path.join(config.directories.app,'runtime.json'),runtime);
  for(const child of manifest.childInstallers)config.extraResources.push({from:child.path,to:'clients/'+runtime.releases.find(row=>row.id===child.id).installer.relativePath});
  await build({targets:Platform.WINDOWS.createTarget(null,Arch.x64),config:{...config,electronVersion:require(path.join(root,'package.json')).devDependencies.electron},publish:'never'});
  verifyCandidate(root);
}
function verifyCandidate(root){
  root=checkedCandidate(root);const manifest=JSON.parse(fs.readFileSync(path.join(root,'snapshot-manifest.json'))),runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-preserved.json')));
  const out=path.join(root,'dist/preview/win32/x64/platform'),unpacked=path.join(out,'win-unpacked'),archive=path.join(unpacked,'resources/app.asar');
  const metadata=JSON.parse(fs.readFileSync(path.join(unpacked,'resources/synk-install.json')));
  if(metadata.sourceHash!==manifest.sourceHash||sourceHash(root)!==manifest.sourceHash)throw Error('Packaged source metadata differs');
  for(const row of manifest.runtimeFiles)if(hash(asar.extractFile(archive,path.normalize(row.file)))!==row.sha256)throw Error('ASAR source differs: '+row.file);
  const packedRuntime=JSON.parse(asar.extractFile(archive,'runtime.json'));
  if(JSON.stringify(packedRuntime)!==JSON.stringify(runtime))throw Error('Runtime configuration changed');
  for(const child of manifest.childInstallers){const target=path.join(unpacked,'resources/clients',runtime.releases.find(row=>row.id===child.id).installer.relativePath);if(fileHash(target)!==child.sha256)throw Error('Packaged child installer differs');}
  const installer=path.join(out,'SYNK Platform Preview-'+manifest.version+'-win-x64.exe'),executable=path.join(unpacked,'SYNKPlatformPreview.exe');
  const report={checkedAt:new Date().toISOString(),ok:true,candidate:root,sourceHash:manifest.sourceHash,sourceFilesCompared:manifest.runtimeFiles.length,sharedSourceCurrent:sourceHash(desktop),sourceStableAfterBuild:sourceHash(desktop)===manifest.sourceHash,authPreserved:true,releasesPreserved:true,childInstallersPreserved:true,platformOnly:true,mode:'development',version:manifest.version,arch:'x64',installer:{path:installer,sha256:fileHash(installer),bytes:fs.statSync(installer).size,executed:false},executable:{path:executable,sha256:fileHash(executable)},asar:{path:archive,sha256:fileHash(archive)},normalProfileRead:false,liveAuthenticationPerformed:false,publish:'never'};
  write(path.join(root,'artifacts/package-verification.json'),report);write(path.join(root,'candidate-summary.json'),report);console.log(JSON.stringify(report));
}
const [operation,candidate]=process.argv.slice(2);
if(operation==='snapshot')snapshot();else if(operation==='build')buildCandidate(candidate).catch(error=>{console.error(error.message);process.exitCode=1;});else if(operation==='verify')verifyCandidate(candidate);else throw Error('Use snapshot, build <fixed candidate> or verify <fixed candidate>');
