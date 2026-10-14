'use strict';
// Refresh the two bundled clients from their verified public packages. Only the
// reviewed location gate, Mac icons and release identity are overlaid.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inventory,audit}=require('./freeze-platform-release.cjs');
const {sourceHash}=require('./source-hash.cjs');
const assert=(value,message)=>{if(!value)throw Error(message);};
const json=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const PRODUCTS={world:{name:'SYNK WORLD Preview',executable:'SYNKWorldPreview',stem:'SYNK-WORLD',category:'public.app-category.education'},messenger:{name:'SYNK Workspace Preview',executable:'SYNKMessengerPreview',stem:'SYNK-Workspace',category:'public.app-category.productivity'}};
async function buildChild({child,baseline,root,out,builder,platform,arch,version,buildId,releaseId,deps,sha,command,signal,powershell,electronDownload,backgroundDirectory}){
  assert(Object.hasOwn(PRODUCTS,child.id)&&/^\d+\.\d+\.\d+$/.test(version),'Invalid child release');
  assert(!fs.existsSync(out),'Preserve existing child build');fs.mkdirSync(out,{recursive:true});
  assert(sha(baseline)===child.installer.sha256&&fs.statSync(baseline).size===child.installer.bytes,'Child baseline differs');
  const product=PRODUCTS[child.id],asar=deps('@electron/asar'),unpack=path.join(out,'baseline'),stage=path.join(out,'stage');fs.mkdirSync(unpack);
  let resources,mounted=false;
  if(platform==='win32'){
    const backend=path.join(out,'baseline-backend.exe'),script=path.join(out,'extract.ps1');
    fs.writeFileSync(script,"param([string]$Source,[string]$Output)\n$ErrorActionPreference='Stop'\n$a=[Reflection.Assembly]::LoadFile([IO.Path]::GetFullPath($Source))\n$s=$a.GetManifestResourceStream('backend.exe')\nif($null -eq $s){throw 'Missing backend'}\n$t=[IO.File]::Open($Output,[IO.FileMode]::CreateNew)\ntry{$s.CopyTo($t)}finally{$s.Dispose();$t.Dispose()}\n");
    command(powershell,['-NoProfile','-NonInteractive','-File',script,'-Source',baseline,'-Output',backend]);
    command(await deps('app-builder-lib/out/toolsets/7zip').getPath7za(),['x',backend,'-o'+unpack,'-y','resources/app.asar']);resources=path.join(unpack,'resources');
  }else{command('hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-mountpoint',unpack,baseline]);mounted=true;resources=path.join(unpack,product.executable+'.app/Contents/Resources');}
  try{const archive=path.join(resources,'app.asar');assert(sha(archive)===child.asarSHA256,'Child baseline archive differs');asar.extractAll(archive,stage);}finally{if(mounted)command('hdiutil',['detach',unpack]);}
  const before=inventory(stage),runtime=JSON.parse(fs.readFileSync(path.join(stage,'runtime.json')));
  assert(runtime.clientId===child.id&&runtime.mode==='development','Unexpected child runtime');
  const overlay=require('./apply-child-location-overlay.cjs').applyChildLocationOverlay(stage,path.join(root,'source'));
  for(const id of Object.keys({...PRODUCTS,platform:{}}))fs.copyFileSync(path.join(root,'source/assets',id+'.icns'),path.join(stage,'assets',id+'.icns'));
  fs.copyFileSync(path.join(root,'source/assets/sources.json'),path.join(stage,'assets/sources.json'));
  const pkg=JSON.parse(fs.readFileSync(path.join(stage,'package.json')));pkg.version=version;json(path.join(stage,'package.json'),pkg);
  const metadata={clientId:child.id,mode:'development',appId:'im.synk.'+child.id+'.preview',version,arch,platform,sourceHash:sourceHash(stage),releaseId,buildId,channel:'preview'};
  json(path.join(stage,'synk-install.json'),metadata);
  const after=inventory(stage),allowed=new Set(['package.json','synk-install.json','src/main.cjs','src/mac-application-location.cjs','assets/platform.icns','assets/world.icns','assets/messenger.icns','assets/sources.json']);
  for(const item of before)if(!allowed.has(item.path)){const next=after.find(row=>row.path===item.path);assert(next&&next.sha256===item.sha256,'Unrelated child source changed: '+item.path);}
  for(const item of after)assert(before.some(row=>row.path===item.path)||allowed.has(item.path),'Unexpected child source added');
  audit(stage,after);const dist=path.join(out,'dist');
  const config={appId:metadata.appId,productName:product.name,executableName:product.executable,electronVersion:'44.5.1',asar:true,npmRebuild:false,forceCodeSigning:false,directories:{app:stage,output:dist,buildResources:path.join(stage,'assets')},files:['package.json','runtime.json','src/**','renderer/**','assets/**'],extraResources:[{from:path.join(stage,'synk-install.json'),to:'synk-install.json'}],artifactName:product.stem+'-Preview-'+version+'-Signal-'+(platform==='win32'?'win':'mac')+'-'+arch+'.${ext}',publish:null};
  if(platform==='win32'){config.win={target:[{target:'dir',arch:['x64']}],signExecutable:false,icon:path.join(stage,'assets',child.id+'.ico')};if(electronDownload)config.electronDownload=electronDownload;}
  else{
    const background=path.join(backgroundDirectory,'background-'+child.id+'.png');assert(fs.existsSync(background),'Child DMG background missing');
    config.mac={target:[{target:'dmg',arch:[arch]}],icon:path.join(stage,'assets',child.id+'.icns'),category:product.category,minimumSystemVersion:'13.0',identity:'-',hardenedRuntime:false,preAutoEntitlements:false,gatekeeperAssess:false,strictVerify:true,notarize:false};
    config.dmg={format:'UDZO',sign:false,writeUpdateInfo:false,title:product.name+' '+version+' '+arch,background,icon:path.join(stage,'assets',child.id+'.icns'),window:{width:660,height:448},iconSize:112,iconTextSize:13,contents:[{x:180,y:200,type:'file'},{x:480,y:200,type:'link',path:'/Applications'}]};
    if(arch==='x64')config.afterPack=context=>{const source=path.join(builder,'native-libs/x64'),provenance=JSON.parse(fs.readFileSync(path.join(source,'provenance.json'))),library=path.join(source,'libvulkan.dylib');assert(sha(library)===provenance.sha256,'Intel library differs');const app=path.join(context.appOutDir,product.executable+'.app');fs.copyFileSync(library,path.join(app,'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libvulkan.dylib'));const notices=path.join(app,'Contents/Resources/Vulkan-Loader');fs.mkdirSync(notices,{recursive:true});for(const name of ['provenance.json','Vulkan-Loader-LICENSE.txt','LICENSES'])fs.cpSync(path.join(source,name),path.join(notices,name),{recursive:true});};
  }
  const {build,Platform,Arch}=deps('electron-builder');const built=await build({projectDir:builder,targets:(platform==='win32'?Platform.WINDOWS:Platform.MAC).createTarget(platform==='win32'?'dir':'dmg',arch==='arm64'?Arch.arm64:Arch.x64),config,publish:'never'});
  const app=platform==='win32'?path.join(dist,'win-unpacked'):path.join(dist,arch==='arm64'?'mac-arm64':'mac',product.executable+'.app'),res=platform==='win32'?path.join(app,'resources'):path.join(app,'Contents/Resources'),archive=path.join(res,'app.asar'),executable=platform==='win32'?path.join(app,product.executable+'.exe'):path.join(app,'Contents/MacOS',product.executable);
  require('./build-platform-release.cjs').verifyArchive(asar,stage,archive);
  assert(JSON.stringify(JSON.parse(fs.readFileSync(path.join(res,'synk-install.json'))))===JSON.stringify(metadata),'Child metadata differs');
  let artifact;
  if(platform==='win32'){
    const files=inventory(app),pin={source:'unified-reviewed-payload',bytes:files.reduce((n,row)=>n+row.bytes,0),sha256:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),asarSHA256:sha(archive),executableSHA256:sha(executable)};
    json(path.join(out,'payload-files.json'),files);json(path.join(out,'payload-pin.json'),pin);
    const signalOut=path.join(out,'signal');command(process.execPath,[path.join(signal,'build-signal.cjs'),'--from-payload','--product='+child.id,'--version='+version,'--pin='+path.join(out,'payload-pin.json'),'--inventory='+path.join(out,'payload-files.json'),'--payload='+app,'--builder='+builder,'--out='+signalOut]);
    const report=JSON.parse(fs.readFileSync(path.join(signalOut,'windows-signal-'+child.id+'.json'))),spec=JSON.parse(fs.readFileSync(path.join(signalOut,'install.json')));
    artifact=path.join(signalOut,report.installer.file);assert(report.ok&&report.appVersion===version&&report.appPayloadUnchanged&&report.payloadFiles===files.length&&sha(artifact)===report.installer.sha256&&fs.statSync(artifact).size===report.installer.bytes,'Child Signal output differs');
    assert(JSON.stringify(spec.files)===JSON.stringify(files)&&JSON.stringify(inventory(app))===JSON.stringify(files),'Child Signal payload differs');
    const backend=path.join(signalOut,'backend/signal-backend.exe');assert(spec.product===child.id&&spec.version===version&&spec.appId===metadata.appId&&spec.executableName===product.executable+'.exe'&&sha(backend)===spec.backendSHA256&&report.backend.sha256===spec.backendSHA256&&fs.statSync(backend).size===spec.backendBytes&&report.backend.bytes===spec.backendBytes,'Child Signal backend or identity differs');
  }else{command('codesign',['--verify','--deep','--strict',app]);artifact=built.find(file=>file.endsWith('.dmg'));assert(artifact,'Missing child DMG');command('hdiutil',['verify',artifact]);}
  const release={id:child.id,mode:'development',platform,arch,version,executableSHA256:sha(executable),asarSHA256:sha(archive),installer:{relativePath:child.id+(platform==='win32'?'.exe':'.dmg'),bytes:fs.statSync(artifact).size,sha256:sha(artifact)}};
  const report={ok:true,client:child.id,version,metadata,baseline:child,overlay,sourceFiles:after,changed:after.filter(row=>before.find(old=>old.path===row.path)?.sha256!==row.sha256).map(row=>row.path),release,artifactFile:artifact,appPath:app,executable:{sha256:release.executableSHA256},asar:{sha256:release.asarSHA256},installer:{path:path.relative(builder,artifact).split(path.sep).join('/'),bytes:release.installer.bytes,sha256:release.installer.sha256},installedStateTouched:false};
  json(path.join(out,'build-report.json'),report);return report;
}
module.exports={buildChild,PRODUCTS};
