'use strict';
// macOS: rebuild Platform Preview 0.4.3 with the Signal WORLD and Workspace DMGs inside, then give the Platform DMG the Signal window.
// 1. The pinned public 0.4.1 WORLD and Workspace DMGs are repackaged with their Signal windows (apps byte for byte, repackage.cjs).
// 2. The Platform is built exactly like build-platform-performance.cjs (frozen 0.4.1 sources, the 0.4.3 performance overlay,
//    build.cjs buildClient, Intel graphics loader on x64); only the bundled child DMGs and their runtime.json pins differ.
// 3. dist/<arch>/deliverables/mac-package-<arch>.json has the same shape as the public 0.4.3 build, so qa/run-macos-qa.cjs checks it.
// 4. The freshly built Platform DMG is repackaged with the Signal window (the app inside stays byte for byte).
// Run from .github/desktop-preview on a native macOS host: node mac-dmg-signal/build-platform-children-mac.cjs --arch=arm64|x64 [--shots]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {repackage,hash}=require('./repackage.cjs');
const ROOT=path.resolve(__dirname,'..'),base=require(path.join(ROOT,'build.cjs'));
const MANIFEST=JSON.parse(fs.readFileSync(path.join(ROOT,'platform-performance/manifest.json'))),VERSION=MANIFEST.applicationVersion;
const REVISION='signal.3',CHILD_REVISION='signal.1';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const json=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const relative=file=>path.relative(ROOT,file).split(path.sep).join('/');
// Same as build-platform-performance.cjs: the reviewed 0.4.3 performance overlay on the frozen platform sources.
function applySourceOverlay(stage){const files=MANIFEST.files.map(change=>{const source=path.join(ROOT,'platform-performance',path.basename(change.file)),target=path.join(stage,change.file);assert(hash(target)===change.baselineSHA256,'Baseline source differs: '+change.file);assert(hash(source)===change.afterSHA256,'Unreviewed source overlay: '+change.file);fs.copyFileSync(source,target);return change;});return {manifestSHA256:hash(path.join(ROOT,'platform-performance/manifest.json')),files};}
async function main(){
  const arch=(process.argv.find(a=>/^--arch=(?:arm64|x64)$/.test(a))||'').slice(7),shots=process.argv.includes('--shots');
  assert(arch,'Use --arch=arm64|x64 [--shots]');
  assert(process.platform==='darwin'&&process.arch===arch,'Matching native macOS required');
  const frozen=base.validateFrozen();
  for(const change of MANIFEST.files){assert(hash(path.join(ROOT,'frozen/platform',change.file))===change.baselineSHA256,'Frozen baseline differs');assert(hash(path.join(ROOT,'platform-performance',path.basename(change.file)))===change.afterSHA256,'Performance overlay differs');}
  // 1. Signal child DMGs
  const packages=structuredClone(MANIFEST.mac[arch].packages),releases=[],children={};
  for(const item of packages){
    const child=await repackage({product:item.client,arch,revision:CHILD_REVISION,shots});
    assert(child.app.executableSHA256===item.executable.sha256&&child.app.asarSHA256===item.asar.sha256,'Child app differs from the 0.4.3 pins '+item.client);
    assert(child.source.sha256===item.installer.sha256&&child.source.bytes===item.installer.bytes,'Child source DMG differs from the 0.4.3 pin '+item.client);
    item.installer={path:relative(child.outputPath),sha256:child.output.sha256,bytes:child.output.bytes};
    children[item.client]={file:child.output.file,sha256:child.output.sha256,bytes:child.output.bytes,replaces:{file:child.source.file,sha256:child.source.sha256,bytes:child.source.bytes},app:child.app,screenshots:child.screenshots.length};
    releases.push({id:item.client,version:item.version,executableSHA256:item.executable.sha256,asarSHA256:item.asar.sha256,installer:item.installer});
  }
  // 2. Platform with those DMGs
  const platform=await base.buildClient('platform',arch,releases,{version:VERSION,applySourceOverlay});packages.push(platform);
  // 3. Deliverables in the public 0.4.3 shape (qa/run-macos-qa.cjs reads them)
  const directory=path.join(ROOT,'dist',arch,'deliverables');
  json(path.join(directory,'mac-package-'+arch+'.json'),{ok:true,builtAt:new Date().toISOString(),version:VERSION,platform:'darwin',arch,electronVersion:'44.5.1',packages,platformOnly:true,
    childInstallersUnchanged:false,childInstallerWindows:CHILD_REVISION,childAppsUnchanged:true,developerIDSigned:false,adHocSigned:true,notarized:false,requiresInternet:true,requiresDevelopmentServer:false,installed:false,published:false});
  fs.writeFileSync(path.join(directory,'SHA256SUMS-platform-'+arch+'.txt'),platform.installer.sha256+'  '+path.basename(platform.installer.path)+'\n');
  // 4. Signal Platform DMG from the Platform DMG just built
  const signal=await repackage({product:'platform',arch,source:path.resolve(ROOT,platform.installer.path),revision:REVISION,shots});
  const report={ok:true,revision:REVISION,builtAt:new Date().toISOString(),version:VERSION,arch,frozenSourceManifestSHA256:frozen.sourceManifestSHA256,
    platform:{plainDMG:{file:path.basename(platform.installer.path),sha256:platform.installer.sha256,bytes:platform.installer.bytes},signalDMG:signal.output,
      executableSHA256:platform.executable.sha256,asarSHA256:platform.asar.sha256,appTreeSHA256:signal.app.treeSHA256,appFiles:signal.app.files,volumeName:signal.volumeName},
    children,ci:signal.ci,runner:signal.runner,tools:signal.tools,signature:'ad-hoc',notarized:false,minimumSystemVersion:signal.app.minimumSystemVersion};
  json(path.join(signal.outDir,'platform-children-'+REVISION+'-'+arch+'.json'),report);
  if(signal.shotsDir)json(path.join(signal.shotsDir,'platform-children-'+REVISION+'-'+arch+'.json'),report);
  console.log(JSON.stringify({ok:true,arch,platform:report.platform.signalDMG,children:Object.fromEntries(Object.entries(children).map(([k,v])=>[k,{file:v.file,sha256:v.sha256}]))}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
