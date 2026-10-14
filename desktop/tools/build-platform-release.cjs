'use strict';
// Build one immutable Platform release target from a reviewed source snapshot.
// Existing signed-out/public runtime and Signal child installers come from one pinned public baseline.
// No profile, installed app, release upload, signature purchase, or automatic publication is touched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {createRequire}=require('node:module');
const {sourceHash}=require('./source-hash.cjs');
const {inventory,audit}=require('./freeze-platform-release.cjs');
const assert=(value,message)=>{if(!value)throw Error(message);};
const sha=file=>{const hash=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(8<<20),fd=fs.openSync(file,'r');try{let count;while((count=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,count));}finally{fs.closeSync(fd);}return hash.digest('hex');};
const json=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
function command(exe,args,options={}){const result=cp.spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:16<<20,timeout:600000,...options});assert(result.status===0,'Command failed: '+exe+' '+(result.error?.message||result.stderr||result.stdout));return result.stdout;}
function validateSnapshot(root){const spec=JSON.parse(fs.readFileSync(path.join(root,'release-input.json'))),source=path.join(root,'source');assert(spec.schemaVersion===1&&spec.product==='platform'&&spec.channel==='preview','Unsupported release');assert(spec.releaseId==='platform-preview-'+spec.version&&/^\d+\.\d+\.\d+$/.test(spec.version)&&/^\d{8}\.\d+$/.test(spec.buildId),'Invalid release identity');assert(JSON.stringify(inventory(source))===JSON.stringify(spec.sourceFiles),'Frozen source changed');audit(source,spec.sourceFiles);assert(sourceHash(source)===spec.sourceHash,'Frozen source hash changed');return spec;}
function verifyArchive(asar,source,archive){const expected=inventory(source).filter(row=>row.path!=='synk-install.json');asar.uncache(archive);const actual=asar.listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!asar.statFile(archive,path.normalize(file)).files).sort();assert(actual.join('\n')===expected.map(row=>row.path).sort().join('\n'),'Archive membership differs');for(const row of expected)assert(crypto.createHash('sha256').update(asar.extractFile(archive,path.normalize(row.path))).digest('hex')===row.sha256,'Archive source differs: '+row.path);return expected.length;}
async function buildTarget(options){
  const root=path.resolve(options.release),out=path.resolve(options.out),builder=path.resolve(options.builder),platform=options.platform||process.platform,arch=options.arch||process.arch;
  assert(platform===process.platform&&arch===process.arch&&(['win32','darwin'].includes(platform)),'Native matching build host required');
  assert(platform!=='win32'||arch==='x64','Windows target is x64');
  assert(!process.env.CSC_LINK&&!process.env.CSC_KEY_PASSWORD&&!process.env.APPLE_ID&&!process.env.APPLE_API_KEY,'Preview builds must not receive signing credentials');
  assert(!fs.existsSync(out),'Immutable build target already exists');const spec=validateSnapshot(root),pin=spec.baselines.find(row=>row.platform===platform&&row.arch===arch);assert(pin,'Target baseline missing');
  fs.mkdirSync(out,{recursive:true});const deps=createRequire(path.join(builder,'package.json'));assert(deps('electron-builder/package.json').version==='26.15.3','Pinned builder required');const asar=deps('@electron/asar');
  const baseline=options.baseline?path.resolve(options.baseline):path.join(out,'baseline'+(platform==='win32'?'.exe':'.dmg'));
  if(!fs.existsSync(baseline))command(platform==='win32'?'curl.exe':'curl',['--fail','--location','--retry','2','--output',baseline,pin.url]);
  assert(fs.statSync(baseline).size===pin.bytes&&sha(baseline)===pin.sha256,'Baseline download digest mismatch');
  let oldResources,mounted=false;const baselineRoot=path.join(out,'baseline-content');fs.mkdirSync(baselineRoot);
  if(platform==='win32'){
    const backend=path.join(out,'baseline-backend.exe');
    const script=path.join(out,'extract-resource.ps1');fs.writeFileSync(script,"param([string]$Source,[string]$Output)\n$ErrorActionPreference='Stop'\n$assembly=[Reflection.Assembly]::LoadFile([IO.Path]::GetFullPath($Source))\n$inputStream=$assembly.GetManifestResourceStream('backend.exe')\nif($null -eq $inputStream){throw 'Missing embedded backend'}\n$outputStream=[IO.File]::Open($Output,[IO.FileMode]::CreateNew)\ntry{$inputStream.CopyTo($outputStream)}finally{$inputStream.Dispose();$outputStream.Dispose()}\n");
    const powershell=options.powershell||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe');command(powershell,['-NoProfile','-NonInteractive','-File',script,'-Source',baseline,'-Output',backend]);assert(sha(backend)===pin.backendSHA256,'Embedded baseline backend changed');
    const seven=await deps('app-builder-lib/out/toolsets/7zip').getPath7za();command(seven,['x',backend,'-o'+baselineRoot,'-y','resources/app.asar','resources/clients/*']);oldResources=path.join(baselineRoot,'resources');
  }else{command('hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-mountpoint',baselineRoot,baseline]);mounted=true;oldResources=path.join(baselineRoot,'SYNKPlatformPreview.app/Contents/Resources');}
  let runtime,children;
  try{
    assert(sha(path.join(oldResources,'app.asar'))===pin.asarSHA256,'Baseline archive changed');runtime=JSON.parse(asar.extractFile(path.join(oldResources,'app.asar'),'runtime.json'));
    assert(runtime.clientId==='platform'&&runtime.mode==='development'&&runtime.entry==='synk-desktop://platform/index.html','Unexpected baseline runtime');
    children=runtime.releases.filter(row=>row.installer);assert(children.length===2&&children.some(row=>row.id==='world')&&children.some(row=>row.id==='messenger'),'Expected two child installers');
    fs.mkdirSync(path.join(out,'children'));
    for(const child of children){assert(child.platform===platform&&child.arch===arch&&child.installer.relativePath===child.id+(platform==='win32'?'.exe':'.dmg'),'Invalid child pin');const src=path.join(oldResources,'clients',child.installer.relativePath);assert(sha(src)===child.installer.sha256&&fs.statSync(src).size===child.installer.bytes,'Bundled child changed');fs.copyFileSync(src,path.join(out,'children',child.installer.relativePath));}
  }finally{if(mounted)command('hdiutil',['detach',baselineRoot]);}
  // Only this invocation's newly-created extraction is disposable; keep the pinned input and evidence.
  if(platform==='win32')for(const leaf of ['baseline-content','baseline-backend.exe']){const target=path.resolve(out,leaf);assert(path.dirname(target)===out&&target!==out,'Cleanup escaped the build output');fs.rmSync(target,{recursive:leaf==='baseline-content',force:false});}
  const stage=path.join(out,'stage');fs.cpSync(path.join(root,'source'),stage,{recursive:true});
  for(const legacy of spec.additionalLegacyPins||[]){
    assert(!legacy.installer&&['world','messenger'].includes(legacy.id)&&legacy.mode==='development'&&/^\d+\.\d+\.\d+$/.test(legacy.version)&&/^[a-f0-9]{64}$/.test(legacy.executableSHA256)&&/^[a-f0-9]{64}$/.test(legacy.asarSHA256),'Invalid reviewed legacy pin');
    if(legacy.platform!==platform||legacy.arch!==arch)continue;
    const same=runtime.releases.find(row=>row.id===legacy.id&&row.version===legacy.version);
    assert(!same||same.executableSHA256===legacy.executableSHA256&&same.asarSHA256===legacy.asarSHA256,'Conflicting existing approval for '+legacy.id+' '+legacy.version);
    if(!same)runtime.releases.push(legacy);
  }
  runtime.update={manifestUrl:spec.manifestUrl,channel:spec.channel,releaseId:spec.releaseId,buildId:spec.buildId};
  json(path.join(stage,'runtime.json'),runtime);json(path.join(stage,'package.json'),{name:'synk-platform-preview',version:spec.version,description:'SYNK Platform desktop client',author:'SYNK',main:'src/main.cjs'});
  const metadata={clientId:'platform',mode:'development',appId:'im.synk.platform.preview',version:spec.version,arch,platform,sourceHash:spec.sourceHash,releaseId:spec.releaseId,buildId:spec.buildId,channel:spec.channel};json(path.join(stage,'synk-install.json'),metadata);
  const dist=path.join(out,'dist'),config={appId:metadata.appId,productName:'SYNK Platform Preview',executableName:'SYNKPlatformPreview',electronVersion:spec.electronVersion,asar:true,npmRebuild:false,forceCodeSigning:false,directories:{app:stage,output:dist,buildResources:path.join(stage,'assets')},files:['package.json','runtime.json','src/**','renderer/**','assets/**'],extraResources:[{from:path.join(stage,'synk-install.json'),to:'synk-install.json'},...children.map(child=>({from:path.join(out,'children',child.installer.relativePath),to:'clients/'+child.installer.relativePath}))],artifactName:'SYNK-Platform-Preview-'+spec.version+'-Signal-'+(platform==='win32'?'win':'mac')+'-'+arch+'.${ext}',publish:null};
  if(platform==='win32'){
    config.win={target:[{target:'dir',arch:['x64']}],signExecutable:false,icon:path.join(stage,'assets/platform.ico')};
    if(options.electronChecksums){const name='electron-v'+spec.electronVersion+'-win32-x64.zip',line=fs.readFileSync(options.electronChecksums,'utf8').split(/\r?\n/).find(row=>row.endsWith(' '+name)||row.endsWith(' *'+name));assert(line,'Electron official checksum missing');const expected=line.split(/\s+/)[0],cache=path.join(process.env.LOCALAPPDATA,'electron/Cache'),zips=fs.readdirSync(cache).map(dir=>path.join(cache,dir,name)).filter(file=>fs.existsSync(file));assert(zips.length&&zips.every(file=>sha(file)===expected),'Cached Electron checksum mismatch');config.electronDownload={isVerifyChecksum:false};}
  }else{
    const background=path.resolve(options.background||path.join(builder,'mac-dmg-signal/background.png'));assert(fs.existsSync(background),'Signal background required');
    config.mac={target:[{target:'dmg',arch:[arch]}],icon:path.join(stage,'assets/platform.icns'),category:'public.app-category.productivity',minimumSystemVersion:'13.0',identity:'-',hardenedRuntime:false,preAutoEntitlements:false,gatekeeperAssess:false,strictVerify:true,notarize:false,signIgnore:['/Contents/Resources/clients/(world|messenger)\\.dmg$']};
    config.dmg={format:'UDZO',sign:false,writeUpdateInfo:false,title:'SYNK Platform Preview '+spec.version+' '+arch,background,icon:path.join(stage,'assets/platform.icns'),window:{width:660,height:448},iconSize:112,iconTextSize:13,contents:[{x:180,y:200,type:'file'},{x:480,y:200,type:'link',path:'/Applications'}]};
    if(arch==='x64')config.afterPack=context=>{const source=path.join(builder,'native-libs/x64'),provenance=JSON.parse(fs.readFileSync(path.join(source,'provenance.json'))),library=path.join(source,'libvulkan.dylib');assert(sha(library)===provenance.sha256,'Intel graphics loader mismatch');const app=path.join(context.appOutDir,'SYNKPlatformPreview.app');fs.copyFileSync(library,path.join(app,'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libvulkan.dylib'));const notices=path.join(app,'Contents/Resources/Vulkan-Loader');fs.mkdirSync(notices,{recursive:true});for(const name of ['provenance.json','Vulkan-Loader-LICENSE.txt','LICENSES'])fs.cpSync(path.join(source,name),path.join(notices,name),{recursive:true});};
  }
  const {build,Platform,Arch}=deps('electron-builder');const built=await build({projectDir:builder,targets:(platform==='win32'?Platform.WINDOWS:Platform.MAC).createTarget(platform==='win32'?'dir':'dmg',arch==='arm64'?Arch.arm64:Arch.x64),config,publish:'never'});
  const app=platform==='win32'?path.join(dist,'win-unpacked'):path.join(dist,arch==='arm64'?'mac-arm64':'mac','SYNKPlatformPreview.app'),resources=platform==='win32'?path.join(app,'resources'):path.join(app,'Contents/Resources'),archive=path.join(resources,'app.asar');const memberCount=verifyArchive(asar,stage,archive);
  assert(JSON.stringify(JSON.parse(fs.readFileSync(path.join(resources,'synk-install.json'))))===JSON.stringify(metadata),'Delivered metadata differs');for(const child of children)assert(sha(path.join(resources,'clients',child.installer.relativePath))===child.installer.sha256,'Delivered child changed');
  let artifact;
  if(platform==='win32'){
    const files=inventory(app),inventoryFile=path.join(out,'payload-files.json'),pinFile=path.join(out,'payload-pin.json');json(inventoryFile,files);json(pinFile,{source:'unified-reviewed-payload',bytes:files.reduce((sum,file)=>sum+file.bytes,0),sha256:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),asarSHA256:sha(archive),executableSHA256:sha(path.join(app,'SYNKPlatformPreview.exe'))});
    const signal=path.resolve(options.signal||path.join(__dirname,'../installer')),signalOut=path.join(out,'signal');command(process.execPath,[path.join(signal,'build-signal.cjs'),'--from-payload','--product=platform','--version='+spec.version,'--pin='+pinFile,'--inventory='+inventoryFile,'--payload='+app,'--builder='+builder,'--out='+signalOut]);artifact=path.join(signalOut,'SYNK-Platform-Preview-'+spec.version+'-Signal-win-x64.exe');
  }else{
    command('codesign',['--verify','--deep','--strict','--verbose=2',app]);assert(command('lipo',['-archs',path.join(app,'Contents/MacOS/SYNKPlatformPreview')]).trim()===arch.replace('x64','x86_64'),'CPU mismatch');artifact=built.find(file=>file.endsWith('.dmg'));assert(artifact,'Missing DMG');command('hdiutil',['verify',artifact]);const mount=path.join(out,'verify-dmg');fs.mkdirSync(mount);try{command('hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-mountpoint',mount,artifact]);const delivered=path.join(mount,'SYNKPlatformPreview.app');assert(sha(path.join(delivered,'Contents/Resources/app.asar'))===sha(archive),'Mounted DMG differs');command('codesign',['--verify','--deep','--strict',delivered]);assert(fs.readlinkSync(path.join(mount,'Applications'))==='/Applications','DMG Applications link missing');}finally{command('hdiutil',['detach',mount]);}
  }
  const descriptor={platform,arch,url:'https://github.com/unmet23-lab/synk-policy/releases/download/'+spec.releaseId+'/'+path.basename(artifact),bytes:fs.statSync(artifact).size,sha256:sha(artifact),asarSHA256:sha(archive)};
  if(platform==='darwin'){
    const relative=file=>path.relative(builder,file).split(path.sep).join('/');
    const packages=children.map(child=>({client:child.id,version:child.version,metadata:{version:child.version},executable:{sha256:child.executableSHA256},asar:{sha256:child.asarSHA256},installer:{path:relative(path.join(out,'children',child.installer.relativePath)),bytes:child.installer.bytes,sha256:child.installer.sha256}}));
    packages.push({client:'platform',version:spec.version,metadata,executable:{sha256:sha(path.join(app,'Contents/MacOS/SYNKPlatformPreview'))},asar:{sha256:descriptor.asarSHA256},installer:{path:relative(artifact),bytes:descriptor.bytes,sha256:descriptor.sha256}});
    json(path.join(out,'mac-package-'+arch+'.json'),{ok:true,platform,arch,version:spec.version,packages});
  }
  const report={ok:true,schemaVersion:1,product:'platform',channel:spec.channel,version:spec.version,releaseId:spec.releaseId,buildId:spec.buildId,builtAt:new Date().toISOString(),sourceHash:spec.sourceHash,artifact:descriptor,artifactFile:artifact,memberCount,bundled:children.map(child=>({id:child.id,version:child.version,platform:child.platform,arch:child.arch,installer:child.installer,asarSHA256:child.asarSHA256})),metadata,unsignedPreview:platform==='win32',adHocSigned:platform==='darwin',notarized:false,installedStateTouched:false,published:false};json(path.join(out,'build-report.json'),report);json(path.join(out,'artifact.json'),descriptor);fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),descriptor.sha256+'  '+path.basename(artifact)+'\n');validateSnapshot(root);return report;
}
if(require.main===module){const options={};for(const arg of process.argv.slice(2)){const match=/^--([a-z-]+)=(.+)$/.exec(arg);assert(match,'Unsupported argument');options[match[1].replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=match[2];}buildTarget(options).then(report=>console.log(JSON.stringify(report))).catch(error=>{console.error(error.stack);process.exitCode=1;});}
module.exports={buildTarget,validateSnapshot,verifyArchive,sha,command};
