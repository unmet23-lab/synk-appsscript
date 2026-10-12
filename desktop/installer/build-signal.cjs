'use strict';
// Repackage the pinned public app byte-for-byte. Only the native installer changes.
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
const pin = {url:'https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.3-20261012/SYNK-Platform-Preview-0.4.3-win-x64.exe',bytes:397415047,sha256:'7bdd0b7d88f64b239b4b4eab51839313745835f7411ddfe2285ef67eb7b840c3',asarSHA256:'f0d912f1db50af31f0b8b8cb4d0ff0aeab4a328ee5f8296709aca0935ce74103'};
async function inventory(directory,relative='') { const list=[]; for(const item of fs.readdirSync(path.join(directory,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) { const member=path.posix.join(relative,item.name); if(item.isDirectory()) list.push(...await inventory(directory,member)); else { assert(item.isFile(),'Only regular payload files allowed'); const file=path.join(directory,member); list.push({path:member,bytes:fs.statSync(file).size,sha256:await sha(file)}); } } return list; }
async function main() {
  assert(process.platform==='win32'&&process.arch==='x64','Windows x64 build required');
  const output=path.resolve(get('out')||path.join(ROOT,'dist'));
  const dependencies=createRequire(path.join(path.resolve(get('builder')||path.join(ROOT,'..')),'package.json'));
  assert(dependencies('electron-builder/package.json').version==='26.15.3','Pinned electron-builder 26.15.3 required');
  fs.mkdirSync(output,{recursive:true});
  const baseline=path.resolve(get('baseline')||path.join(output,'baseline.exe'));
  if(!fs.existsSync(baseline)) { const response=await fetch(pin.url); assert(response.ok,'Baseline download failed'); await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(baseline,{flags:'wx'})); }
  assert(fs.statSync(baseline).size===pin.bytes&&await sha(baseline)===pin.sha256,'Public baseline checksum mismatch');
  const seven=await dependencies('app-builder-lib/out/toolsets/7zip').getPath7za();
  const payload=path.resolve(get('payload')||path.join(output,'payload'));
  if(!fs.existsSync(payload)) { fs.mkdirSync(payload); command(seven,['x',baseline,'-o'+payload,'-y']); }
  assert(await sha(path.join(payload,'resources/app.asar'))===pin.asarSHA256,'Public app archive changed');
  const files=await inventory(payload);
  // A checked public payload manifest allows reuse without duplicating 674 MB.
  const baselineInventory=JSON.parse(fs.readFileSync(path.join(ROOT,'baseline-files.json'),'utf8'));
  assert(JSON.stringify(files)===JSON.stringify(baselineInventory),'Public payload differs from pinned 0.4.3 bytes');
  const project=path.join(output,'project'); fs.mkdirSync(project,{recursive:true});
  json(path.join(project,'package.json'),{name:'synk-platform-preview',version:'0.4.3',description:'SYNK Platform desktop client',author:'SYNK',main:'src/main.cjs'});
  const icon=path.resolve(get('icon')||path.join(ROOT,'platform.ico'));
  const fonts=path.resolve(get('fonts')||path.join(ROOT,'fonts'));
  const {UUID}=dependencies('builder-util-runtime');
  const guid=UUID.v5('im.synk.platform.preview',UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3'));
  const config={appId:'im.synk.platform.preview',productName:'SYNK Platform Preview',executableName:'SYNKPlatformPreview',electronVersion:'44.5.1',npmRebuild:false,forceCodeSigning:false,
    directories:{app:project,output:path.join(output,'backend')},artifactName:'signal-backend.exe',
    win:{target:[{target:'nsis',arch:['x64']}],signExecutable:false,icon},
    nsis:{guid,include:path.join(ROOT,'signal-safety.nsh'),oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:false,runAfterFinish:false,deleteAppDataOnUninstall:false,createDesktopShortcut:true,createStartMenuShortcut:true},publish:null};
  let backend=path.resolve(get('backend')||path.join(output,'backend/signal-backend.exe'));
  if(!process.argv.includes('--reuse-backend')) { const {build,Platform,Arch}=dependencies('electron-builder'); const artifacts=await build({projectDir:project,prepackaged:payload,targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config,publish:'never'}); backend=artifacts.find(file=>file.endsWith('.exe')); }
  assert(backend&&fs.existsSync(backend),'Missing NSIS engine');
  command(seven,['t',backend]);
  const spec={appId:config.appId,version:'0.4.3',guid,installDirectory:'%LOCALAPPDATA%\\Programs\\SYNKPlatformPreview',executableName:'SYNKPlatformPreview.exe',shortcutName:'SYNK Platform Preview',backendSHA256:await sha(backend),backendBytes:fs.statSync(backend).size,minFreeBytes:3*1024**3,files};
  json(path.join(output,'install.json'),spec); json(path.join(output,'backend-config.json'),config);
  const target=path.join(output,'SYNK-Platform-Preview-0.4.3-Signal-win-x64.exe');
  const framework=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319');
  const resources=['SUIT-Medium.otf','SUIT-ExtraBold.otf','InterTight-Medium.ttf','InterTight-Bold.ttf','DMMono-Medium.ttf'].map(file=>'/resource:'+path.join(fonts,file)+',font.'+file);
  const assembly=path.join(output,'AssemblyInfo.cs');
  fs.writeFileSync(assembly,'using System.Reflection;\n[assembly: AssemblyTitle("SYNK Platform Preview 설치")]\n[assembly: AssemblyCompany("SYNK")]\n[assembly: AssemblyProduct("SYNK Platform Preview")]\n[assembly: AssemblyVersion("0.4.3.1")]\n[assembly: AssemblyFileVersion("0.4.3.1")]\n');
  const licenses=['SUIT-LICENSE.txt','InterTight-LICENSE.txt','DMMono-LICENSE.txt'].map(file=>'/resource:'+path.join(fonts,file)+',license.'+file);
  command(path.join(framework,'csc.exe'),['/nologo','/target:winexe','/platform:x64','/optimize+','/out:'+target,'/win32manifest:'+path.join(ROOT,'app.manifest'),'/win32icon:'+icon,
    '/r:System.Core.dll','/r:System.Runtime.Serialization.dll','/r:System.Xaml.dll',...['PresentationFramework.dll','PresentationCore.dll','WindowsBase.dll'].map(file=>'/r:'+path.join(framework,'WPF',file)),
    '/resource:'+path.join(output,'install.json')+',install.json','/resource:'+backend+',backend.exe',...resources,...licenses,...['Program.cs','InstallerEngine.cs','SignalWindow.cs'].map(file=>path.join(ROOT,file)),assembly]);
  assert(JSON.stringify(await inventory(payload))===JSON.stringify(files),'Builder modified public app payload');
  const report={ok:true,builtAt:new Date().toISOString(),appVersion:spec.version,installerRevision:'signal.1',baseline:pin,installer:{file:path.basename(target),bytes:fs.statSync(target).size,sha256:await sha(target)},backend:{bytes:spec.backendBytes,sha256:spec.backendSHA256},appPayloadUnchanged:true,payloadFiles:files.length,nsisGUID:guid,unsignedPreview:true,requiresDotNetFramework:'4.8',sources:await inventory(ROOT).then(list=>list.filter(item=>!item.path.startsWith('dist/')))};
  json(path.join(output,'windows-signal-package.json'),report);
  fs.writeFileSync(path.join(output,'SHA256SUMS-signal-win-x64.txt'),report.installer.sha256+'  '+path.basename(target)+'\n');
  console.log(JSON.stringify(report));
}
if(require.main===module) main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={inventory,sha,pin};
