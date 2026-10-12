'use strict';
// Rebuild the Windows Platform Preview 0.4.3 with the Signal WORLD and Workspace installers inside.
// The frozen 0.4.1 sources and the 0.4.3 performance overlay stay byte-for-byte the same as the public 0.4.3 build
// (build-platform-performance.cjs). Only resources/clients/world.exe, messenger.exe and their runtime.json pins change;
// the child apps they install are the pinned public bytes. The output is a plain NSIS Platform installer that
// build-signal.cjs then wraps in the Signal installation window.
// Usage (Windows x64, from a synk-policy checkout): node build-platform-children.cjs --world=<Signal WORLD installer> --messenger=<Signal Workspace installer> [--policy=<.github/desktop-preview>] [--out=<directory>]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const get=name=>process.argv.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3);
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const sha=file=>{const hash=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buffer=Buffer.allocUnsafe(8<<20);try{for(let n;(n=fs.readSync(fd,buffer,0,buffer.length,null))>0;)hash.update(buffer.subarray(0,n));}finally{fs.closeSync(fd);}return hash.digest('hex');};
const json=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const POLICY=path.resolve(get('policy')||path.join(__dirname,'..'));
const base=require(path.join(POLICY,'build.cjs')),MANIFEST=JSON.parse(fs.readFileSync(path.join(POLICY,'platform-performance/manifest.json'))),VERSION=MANIFEST.applicationVersion;
const dependency=name=>require(require.resolve(name,{paths:[POLICY]}));
function command(file,args){const result=cp.spawnSync(file,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6,timeout:300000});assert(result.status===0,'Command failed '+file+': '+(result.stderr||result.stdout));return result.stdout;}
async function unpack(installer,directory){assert(!fs.existsSync(directory)||fs.readdirSync(directory).length===0,'Preserve existing extraction');fs.mkdirSync(directory,{recursive:true});command(await dependency('app-builder-lib/out/toolsets/7zip').getPath7za(),['x',installer,'-o'+directory,'-y']);}
// Same check as the public 0.4.3 build: the delivered app.asar holds exactly the staged sources.
function verifyArchive(stage,archive){const asar=dependency('@electron/asar'),walk=(dir,rel='')=>fs.readdirSync(path.join(dir,rel),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(dir,path.posix.join(rel,entry.name)):[path.posix.join(rel,entry.name)]).sort(),expected=walk(stage).filter(file=>file!=='synk-install.json'),actual=asar.listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!asar.statFile(archive,path.normalize(file)).files).sort();assert(expected.join('\n')===actual.join('\n'),'Archive member list mismatch');for(const file of expected)assert(asar.extractFile(archive,path.normalize(file)).equals(fs.readFileSync(path.join(stage,file))),'Archive source differs '+file);return expected.length;}
function applySourceOverlay(stage){const files=MANIFEST.files.map(change=>{const source=path.join(POLICY,'platform-performance',path.basename(change.file)),target=path.join(stage,change.file);assert(sha(target)===change.baselineSHA256,'Baseline source differs: '+change.file);assert(sha(source)===change.afterSHA256,'Unreviewed source overlay: '+change.file);fs.copyFileSync(source,target);return change;});return {manifestSHA256:sha(path.join(POLICY,'platform-performance/manifest.json')),files};}
async function main(){
  assert(process.platform==='win32'&&process.arch==='x64','Native Windows x64 required');
  const frozen=base.validateFrozen();
  for(const change of MANIFEST.files){assert(sha(path.join(POLICY,'frozen/platform',change.file))===change.baselineSHA256,'Frozen baseline differs');assert(sha(path.join(POLICY,'platform-performance',path.basename(change.file)))===change.afterSHA256,'Performance overlay differs');}
  const out=path.resolve(get('out')||path.join(POLICY,'dist/win32-x64-signal-children'));assert(!fs.existsSync(out),'Preserve existing output '+out);
  const children={world:path.resolve(get('world')),messenger:path.resolve(get('messenger'))};
  for(const [id,file] of Object.entries(children))assert(fs.existsSync(file),'Missing Signal installer for '+id);
  const stage=path.join(out,'stage');fs.cpSync(path.join(POLICY,'frozen/platform'),stage,{recursive:true});
  const sourceOverlay=applySourceOverlay(stage),pkg=JSON.parse(fs.readFileSync(path.join(stage,'package.json')));pkg.version=VERSION;json(path.join(stage,'package.json'),pkg);
  const runtime=JSON.parse(fs.readFileSync(path.join(stage,'runtime.json'))),pins=[];
  for(const [id,file] of Object.entries(children)){
    const release=runtime.releases.find(r=>r.id===id&&r.installer);assert(release&&release.installer.relativePath===id+'.exe','Missing child installer pin '+id);
    const before={...release.installer};release.installer.sha256=sha(file);release.installer.bytes=fs.statSync(file).size;
    pins.push({id,version:release.version,executableSHA256:release.executableSHA256,asarSHA256:release.asarSHA256,installer:{before,after:{...release.installer}}});
  }
  for(const pin of MANIFEST.windows.additionalLegacyPins)assert(!pin.installer&&pin.platform==='win32'&&pin.arch==='x64'&&!runtime.releases.some(r=>r.id===pin.id&&r.version===pin.version),'Invalid additional legacy pin');
  runtime.releases.push(...MANIFEST.windows.additionalLegacyPins);json(path.join(stage,'runtime.json'),runtime);
  const metadata={clientId:'platform',mode:'development',appId:'im.synk.platform.preview',version:VERSION,arch:'x64',platform:'win32',sourceHash:base.sourceHash(stage)};json(path.join(stage,'synk-install.json'),metadata);
  // Node on some Windows networks cannot verify GitHub's release download certificate chain. With
  // --electron-checksums=<official SHASUMS256.txt fetched by another client>, the cached Electron zip is checked here
  // against that file instead, and electron-builder does not download the checksum file again.
  let electronDownload=null,electronZip=null;
  if(get('electron-checksums')){
    const name='electron-v44.5.1-win32-x64.zip',line=fs.readFileSync(path.resolve(get('electron-checksums')),'utf8').split(/\r?\n/).find(l=>l.endsWith(' *'+name)||l.endsWith(' '+name));
    assert(line,'Missing '+name+' in the checksum file');
    const expected=line.split(/\s+/)[0],cache=path.join(process.env.LOCALAPPDATA,'electron','Cache'),zips=fs.readdirSync(cache).map(d=>path.join(cache,d,name)).filter(f=>fs.existsSync(f));
    assert(zips.length>0&&zips.every(f=>sha(f)===expected),'Cached Electron zip differs from the official checksum');
    electronDownload={isVerifyChecksum:false};electronZip={file:name,sha256:expected,checkedAgainst:'official SHASUMS256.txt'};
  }
  const dist=path.join(out,'dist'),config={...(electronDownload?{electronDownload}:{}),appId:metadata.appId,productName:'SYNK Platform Preview',executableName:'SYNKPlatformPreview',electronVersion:'44.5.1',asar:true,npmRebuild:false,forceCodeSigning:false,
    directories:{app:stage,output:dist,buildResources:path.join(stage,'assets')},files:['package.json','runtime.json','src/**','renderer/**','assets/**'],
    extraResources:[{from:path.join(stage,'synk-install.json'),to:'synk-install.json'},...Object.entries(children).map(([id,file])=>({from:file,to:'clients/'+id+'.exe'}))],
    artifactName:'SYNK-Platform-Preview-'+VERSION+'-win-x64.${ext}',win:{target:[{target:'nsis',arch:['x64']}],signExecutable:false,icon:path.join(stage,'assets/platform.ico')},
    nsis:{oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:false,runAfterFinish:false,deleteAppDataOnUninstall:false,createDesktopShortcut:true,createStartMenuShortcut:true},publish:null};
  const {build,Platform,Arch}=dependency('electron-builder'),artifacts=await build({projectDir:POLICY,targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config,publish:'never'}),installer=artifacts.find(file=>file.endsWith('.exe'));
  assert(installer,'Missing Windows installer');command(await dependency('app-builder-lib/out/toolsets/7zip').getPath7za(),['t',installer]);
  const delivery=path.join(out,'delivered');await unpack(installer,delivery);
  const archive=path.join(delivery,'resources/app.asar'),executable=path.join(delivery,'SYNKPlatformPreview.exe'),members=verifyArchive(stage,archive);
  assert(JSON.stringify(JSON.parse(fs.readFileSync(path.join(delivery,'resources/synk-install.json'))))===JSON.stringify(metadata),'Delivered metadata differs');
  for(const [id,file] of Object.entries(children))assert(sha(path.join(delivery,'resources/clients',id+'.exe'))===sha(file),'Delivered child differs '+id);
  const report={ok:true,builtAt:new Date().toISOString(),version:VERSION,platform:'win32',arch:'x64',electronVersion:'44.5.1',
    installer:{file:path.basename(installer),path:installer,sha256:sha(installer),bytes:fs.statSync(installer).size},asar:{sha256:sha(archive),fileCount:members},executable:{sha256:sha(executable)},
    metadata,sourceOverlay,frozenSourceManifestSHA256:frozen.sourceManifestSHA256,electronZip,childInstallers:pins,childAppsUnchanged:true,additionalLegacyPins:MANIFEST.windows.additionalLegacyPins,
    unsignedPreview:true,installerExecuted:false,installedStateTouched:false,published:false};
  json(path.join(out,'windows-platform-children-package.json'),report);
  // build-signal.cjs --pin: the rebuilt Platform installer and its app archive
  json(path.join(out,'platform-pin.json'),{url:null,source:'build-platform-children.cjs '+report.builtAt,bytes:report.installer.bytes,sha256:report.installer.sha256,asarSHA256:report.asar.sha256});
  console.log(JSON.stringify({...report,childInstallers:pins.map(p=>({id:p.id,sha256:p.installer.after.sha256,bytes:p.installer.after.bytes}))}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
