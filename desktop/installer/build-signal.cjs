'use strict';
// Repackage a pinned public app byte-for-byte. Only the native installer changes.
// --product=platform (default) | world | messenger chooses the app, its poster and copy.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const {createRequire} = require('node:module');
const {pipeline} = require('node:stream/promises');
const {Readable} = require('node:stream');
const ROOT = __dirname;
const get = name => process.argv.find(arg => arg.startsWith('--'+name+'='))?.slice(name.length+3);
const assert = (ok,msg) => { if (!ok) throw Error(msg); };
const json = (file,data) => fs.writeFileSync(file, JSON.stringify(data,null,2)+'\n');
async function sha(file) { const hash=crypto.createHash('sha256'); for await (const chunk of fs.createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
function command(exe,args) { const result=cp.spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6}); assert(result.status===0, String(result.error||result.stdout||result.stderr)); return result.stdout; }
const RELEASES='https://github.com/unmet23-lab/synk-policy/releases/download/';
// The child pins are the ones the Platform checks (frozen platform/runtime.json): installer, executable and app.asar.
const PRODUCTS = {
  platform:{appId:'im.synk.platform.preview',productName:'SYNK Platform Preview',executableName:'SYNKPlatformPreview',shortName:'SYNK',packageName:'synk-platform-preview',
    description:'SYNK Platform desktop client',version:'0.4.3',icon:'platform.ico',poster:'poster-platform.png',inventory:'baseline-files.json',minFreeBytes:3*1024**3,
    output:'SYNK-Platform-Preview-0.4.3-Signal-win-x64.exe',report:'windows-signal-package.json',sums:'SHA256SUMS-signal-win-x64.txt',fileVersion:'0.4.3.2',revision:'signal.2',
    pin:{url:RELEASES+'platform-preview-0.4.3-20261012/SYNK-Platform-Preview-0.4.3-win-x64.exe',bytes:397415047,sha256:'7bdd0b7d88f64b239b4b4eab51839313745835f7411ddfe2285ef67eb7b840c3',asarSHA256:'f0d912f1db50af31f0b8b8cb4d0ff0aeab4a328ee5f8296709aca0935ce74103'}},
  world:{appId:'im.synk.world.preview',productName:'SYNK WORLD Preview',executableName:'SYNKWorldPreview',shortName:'WORLD',packageName:'synk-world-preview',
    description:'SYNK WORLD desktop client',version:'0.4.1',icon:'world.ico',poster:'poster-world.png',inventory:'baseline-files-world.json',minFreeBytes:1024**3,
    output:'SYNK-WORLD-Preview-0.4.1-Signal-win-x64.exe',report:'windows-signal-world.json',sums:'SHA256SUMS-signal-world-win-x64.txt',fileVersion:'0.4.1.1',revision:'signal.1',
    pin:{url:RELEASES+'platform-preview-0.4.1-20261012/SYNK-WORLD-Preview-0.4.1-win-x64.exe',bytes:132342850,sha256:'e0363ee835484b5f5a75be05a7a787df71983738cf98a140b9f5eaeb12283e86',
      asarSHA256:'1cce12377fb2ec81de0f57ac86063894e9ab220ae56d38deab37d84143769208',executableSHA256:'121d567ba96e50c4feb20cf3fb3958c52635be67585774ddd392ebf159226e5f'}},
  messenger:{appId:'im.synk.messenger.preview',productName:'SYNK Workspace Preview',executableName:'SYNKMessengerPreview',shortName:'워크스페이스',packageName:'synk-messenger-preview',
    description:'SYNK Workspace desktop client',version:'0.4.0',icon:'messenger.ico',poster:'poster-messenger.png',inventory:'baseline-files-messenger.json',minFreeBytes:1024**3,
    output:'SYNK-Workspace-Preview-0.4.0-Signal-win-x64.exe',report:'windows-signal-messenger.json',sums:'SHA256SUMS-signal-messenger-win-x64.txt',fileVersion:'0.4.0.1',revision:'signal.1',
    // Not published on its own: resources/clients/messenger.exe inside the pinned Platform 0.4.3 installer (pass --baseline=<that file>).
    pin:{url:null,source:'resources/clients/messenger.exe in SYNK-Platform-Preview-0.4.3-win-x64.exe',bytes:132289127,sha256:'ec84d50e4c48b8834434a60f941fa703ad96d63c85922d3f82fcb06d758b2cff',
      asarSHA256:'dfb167708db8cbe60ccfc532fc4192e14c0c3ad8c13c3c12b0c98718245b1d1a',executableSHA256:'f78fbae7d2457c0994207d18a8e6c037d0120edd3f368ad29ff9fed84cb10481'}},
};
async function inventory(directory,relative='') { const list=[]; for(const item of fs.readdirSync(path.join(directory,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) { const member=path.posix.join(relative,item.name); if(item.isDirectory()) list.push(...await inventory(directory,member)); else { assert(item.isFile(),'Only regular payload files allowed'); const file=path.join(directory,member); list.push({path:member,bytes:fs.statSync(file).size,sha256:await sha(file)}); } } return list; }
async function main() {
  assert(process.platform==='win32'&&process.arch==='x64','Windows x64 build required');
  const id=get('product')||'platform';
  assert(Object.hasOwn(PRODUCTS,id),'Unknown --product '+id);
  const product={...PRODUCTS[id]};
  if(get('version')) {
    assert(/^\d+\.\d+\.\d+$/.test(get('version')) && get('pin') && get('inventory'), 'New versions require a reviewed pin and payload inventory');
    product.version=get('version');product.output=product.output.replace(PRODUCTS[id].version,product.version);
    product.fileVersion=product.version+'.1';product.revision='unified.1';
  }
  // A rebuilt Platform (for example with Signal child installers) is pinned by a reviewed JSON file instead of the public 0.4.3 file.
  if(get('pin')) { product.pin=JSON.parse(fs.readFileSync(path.resolve(get('pin')),'utf8')); assert(product.pin.bytes&&product.pin.sha256&&product.pin.asarSHA256,'Incomplete --pin'); }
  if(get('inventory')) product.inventory=path.resolve(get('inventory'));
  if(get('revision')) product.revision=get('revision');
  if(get('file-version')) product.fileVersion=get('file-version');
  const pin=product.pin;
  const output=path.resolve(get('out')||path.join(ROOT,'dist',id));
  const dependencies=createRequire(path.join(path.resolve(get('builder')||path.join(ROOT,'..')),'package.json'));
  assert(dependencies('electron-builder/package.json').version==='26.15.3','Pinned electron-builder 26.15.3 required');
  fs.mkdirSync(output,{recursive:true});
  const directPayload=process.argv.includes('--from-payload');
  assert(!directPayload || get('payload') && get('pin') && get('inventory') && get('version') && pin.source==='unified-reviewed-payload', 'Direct payload requires the unified build contract');
  const baseline=path.resolve(get('baseline')||path.join(output,'baseline.exe'));
  if(!directPayload) {
    if(!fs.existsSync(baseline)) { assert(pin.url,'Pass --baseline=<file>: '+(pin.source||'no public download for this pin')); const response=await fetch(pin.url); assert(response.ok,'Baseline download failed'); await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(baseline,{flags:'wx'})); }
    assert(fs.statSync(baseline).size===pin.bytes&&await sha(baseline)===pin.sha256,'Public baseline checksum mismatch');
  }
  const seven=await dependencies('app-builder-lib/out/toolsets/7zip').getPath7za();
  const payload=path.resolve(get('payload')||path.join(output,'payload'));
  if(!fs.existsSync(payload)) { assert(!directPayload,'Direct payload does not exist');fs.mkdirSync(payload); command(seven,['x',baseline,'-o'+payload,'-y']); }
  assert(await sha(path.join(payload,'resources/app.asar'))===pin.asarSHA256,'Public app archive changed');
  if(pin.executableSHA256) assert(await sha(path.join(payload,product.executableName+'.exe'))===pin.executableSHA256,'Public app executable changed');
  const files=await inventory(payload);
  // A checked public payload manifest allows reuse without duplicating the extracted app.
  const inventoryFile=path.isAbsolute(product.inventory)?product.inventory:path.join(ROOT,product.inventory);
  if(process.argv.includes('--write-inventory')) { assert(!fs.existsSync(inventoryFile),'Preserve existing inventory '+inventoryFile); json(inventoryFile,files); }
  const baselineInventory=JSON.parse(fs.readFileSync(inventoryFile,'utf8'));
  assert(JSON.stringify(files)===JSON.stringify(baselineInventory),'Public payload differs from pinned '+product.version+' bytes');
  const project=path.join(output,'project'); fs.mkdirSync(project,{recursive:true});
  json(path.join(project,'package.json'),{name:product.packageName,version:product.version,description:product.description,author:'SYNK',main:'src/main.cjs'});
  const icon=path.resolve(get('icon')||path.join(ROOT,product.icon));
  const fonts=path.resolve(get('fonts')||path.join(ROOT,'fonts'));
  const {UUID}=dependencies('builder-util-runtime');
  const guid=UUID.v5(product.appId,UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3'));
  const config={appId:product.appId,productName:product.productName,executableName:product.executableName,electronVersion:'44.5.1',npmRebuild:false,forceCodeSigning:false,
    directories:{app:project,output:path.join(output,'backend')},artifactName:'signal-backend.exe',
    win:{target:[{target:'nsis',arch:['x64']}],signExecutable:false,icon},
    nsis:{guid,include:path.join(ROOT,'signal-safety.nsh'),oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:false,runAfterFinish:false,deleteAppDataOnUninstall:false,createDesktopShortcut:true,createStartMenuShortcut:true},publish:null};
  let backend=path.resolve(get('backend')||path.join(output,'backend/signal-backend.exe'));
  if(!process.argv.includes('--reuse-backend')) { const {build,Platform,Arch}=dependencies('electron-builder'); const artifacts=await build({projectDir:project,prepackaged:payload,targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config,publish:'never'}); backend=artifacts.find(file=>file.endsWith('.exe')); }
  assert(backend&&fs.existsSync(backend),'Missing NSIS engine');
  command(seven,['t',backend]);
  const spec={appId:config.appId,version:product.version,guid,installDirectory:'%LOCALAPPDATA%\\Programs\\'+product.executableName,executableName:product.executableName+'.exe',shortcutName:product.productName,
    backendSHA256:await sha(backend),backendBytes:fs.statSync(backend).size,minFreeBytes:product.minFreeBytes,files,product:id,shortName:product.shortName};
  json(path.join(output,'install.json'),spec); json(path.join(output,'backend-config.json'),config);
  const target=path.join(output,product.output);
  const framework=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319');
  const resources=['SUIT-Medium.otf','SUIT-ExtraBold.otf','SUIT-Heavy.otf','InterTight-Medium.ttf','InterTight-Bold.ttf','DMMono-Medium.ttf'].map(file=>'/resource:'+path.join(fonts,file)+',font.'+file);
  // 왼쪽 포스터 바탕(art/make-poster.mjs로 만든 그림). 창이 자기 어셈블리에서 읽는다.
  resources.push('/resource:'+path.join(ROOT,'art',product.poster)+',art.'+product.poster);
  const assembly=path.join(output,'AssemblyInfo.cs');
  fs.writeFileSync(assembly,'using System.Reflection;\n[assembly: AssemblyTitle("'+product.productName+' 설치")]\n[assembly: AssemblyCompany("SYNK")]\n[assembly: AssemblyProduct("'+product.productName+'")]\n[assembly: AssemblyVersion("'+product.fileVersion+'")]\n[assembly: AssemblyFileVersion("'+product.fileVersion+'")]\n');
  const licenses=['SUIT-LICENSE.txt','InterTight-LICENSE.txt','DMMono-LICENSE.txt'].map(file=>'/resource:'+path.join(fonts,file)+',license.'+file);
  command(path.join(framework,'csc.exe'),['/nologo','/target:winexe','/platform:x64','/optimize+','/out:'+target,'/win32manifest:'+path.join(ROOT,'app.manifest'),'/win32icon:'+icon,
    '/r:System.Core.dll','/r:System.Runtime.Serialization.dll','/r:System.Xaml.dll',...['PresentationFramework.dll','PresentationCore.dll','WindowsBase.dll'].map(file=>'/r:'+path.join(framework,'WPF',file)),
    '/resource:'+path.join(output,'install.json')+',install.json','/resource:'+backend+',backend.exe',...resources,...licenses,...['Program.cs','InstallerEngine.cs','SignalWindow.cs'].map(file=>path.join(ROOT,file)),assembly]);
  assert(JSON.stringify(await inventory(payload))===JSON.stringify(files),'Builder modified public app payload');
  const report={ok:true,builtAt:new Date().toISOString(),product:id,appVersion:spec.version,installerRevision:product.revision,baseline:pin,installer:{file:path.basename(target),bytes:fs.statSync(target).size,sha256:await sha(target)},backend:{bytes:spec.backendBytes,sha256:spec.backendSHA256},appPayloadUnchanged:true,payloadFiles:files.length,nsisGUID:guid,unsignedPreview:true,requiresDotNetFramework:'4.8',sources:await inventory(ROOT).then(list=>list.filter(item=>!item.path.startsWith('dist/')))};
  json(path.join(output,product.report),report);
  fs.writeFileSync(path.join(output,product.sums),report.installer.sha256+'  '+path.basename(target)+'\n');
  console.log(JSON.stringify({...report,sources:report.sources.length}));
}
if(require.main===module) main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={inventory,sha,PRODUCTS,pin:PRODUCTS.platform.pin};
