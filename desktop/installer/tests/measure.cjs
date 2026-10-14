'use strict';
// Real payload + production NSIS/engine, with a disposable GUID, executable
// name, installation directory and shortcuts. Never launches the app.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {createRequire}=require('node:module');
const repo=path.resolve(__dirname,'../../..'),source=path.resolve(__dirname,'..');
const get=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
function run(file,args,timeout=120000){const result=cp.spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:8e6});assert(!result.error&&result.status===0,String(result.error||result.stdout||result.stderr));return result.stdout;}
function files(root,relative=''){return fs.readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(e=>{const member=path.posix.join(relative,e.name);assert(!e.isSymbolicLink(),'Symlinks prohibited');return e.isDirectory()?files(root,member):[{path:member,bytes:fs.statSync(path.join(root,member)).size,sha256:sha(path.join(root,member))}];});}
async function main(){
  assert(process.platform==='win32'&&get('payload'),'Windows and --payload required');
  const original=path.resolve(get('payload')),originalFiles=files(original),token=crypto.randomUUID().replaceAll('-','').slice(0,12),name='SYNKSignalMeasure'+token;
  const directory=path.join(repo,'.tmp','signal-installer-measure-'+token),payload=path.join(directory,'payload'),project=path.join(directory,'project'),guid=crypto.randomUUID();
  assert(!fs.existsSync(directory),'Preserve previous evidence');fs.mkdirSync(payload,{recursive:true});fs.mkdirSync(project);
  for(const file of originalFiles){const target=path.join(payload,file.path==='SYNKPlatformPreview.exe'?name+'.exe':file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.linkSync(path.join(original,file.path),target);}
  json(path.join(project,'package.json'),{name:name.toLowerCase(),version:'0.0.1',author:'SYNK',main:'index.js',description:'Isolated real-payload install timing fixture'});fs.writeFileSync(path.join(project,'index.js'),'// never executed\n');
  const dependencies=createRequire(path.join(path.resolve(get('builder')||path.join(repo,'.tmp/platform-performance-20261012/policy/.github/desktop-preview')),'package.json'));
  const {build,Platform,Arch}=dependencies('electron-builder');
  const config={appId:'im.synk.signal.measure.'+token,productName:name,executableName:name,electronVersion:'44.5.1',npmRebuild:false,forceCodeSigning:false,directories:{app:project,output:path.join(directory,'backend')},artifactName:'measure-backend.exe',win:{target:[{target:'nsis',arch:['x64']}],signExecutable:false},nsis:{guid,include:path.join(source,'signal-safety.nsh'),oneClick:false,perMachine:false,allowElevation:false,packElevateHelper:false,allowToChangeInstallationDirectory:false,runAfterFinish:false,deleteAppDataOnUninstall:false,createDesktopShortcut:true,createStartMenuShortcut:true,shortcutName:name},publish:null};
  const artifacts=await build({projectDir:project,prepackaged:payload,targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config,publish:'never'}),backend=artifacts.find(f=>f.endsWith('.exe'));
  assert(JSON.stringify(files(original))===JSON.stringify(originalFiles),'Original payload changed');
  const spec={appId:config.appId,version:'0.0.1',guid,installDirectory:path.join(directory,'installed'),executableName:name+'.exe',shortcutName:name,backendSHA256:sha(backend),backendBytes:fs.statSync(backend).size,minFreeBytes:128*1024*1024,shortName:'SYNK 측정',files:files(payload)};
  json(path.join(directory,'install.json'),spec);
  const framework=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319'),executable=path.join(directory,'Measure.exe');
  run(path.join(framework,'csc.exe'),['/nologo','/target:exe','/platform:x64','/out:'+executable,'/r:System.Core.dll','/r:System.Runtime.Serialization.dll','/r:System.Web.Extensions.dll',...['InstallerEngine.cs','AutoUpdateEngine.cs','BackendProcess.cs','InstallTransaction.cs'].map(f=>path.join(source,f)),path.join(__dirname,'Measure.cs')]);
  const output=run(executable,[path.join(directory,'install.json'),backend],1500000);fs.writeFileSync(path.join(directory,'output.txt'),output);
  const evidence=JSON.parse(fs.readFileSync(path.join(directory,'measurement.json'),'utf8'));
  evidence.sourcePayloadFiles=originalFiles.length;evidence.sourcePayloadBytes=originalFiles.reduce((n,f)=>n+f.bytes,0);evidence.originalPayloadUnchanged=JSON.stringify(files(original))===JSON.stringify(originalFiles);evidence.appLaunched=false;evidence.productionInstallTouched=false;evidence.realProfileTouched=false;
  json(path.join(directory,'measurement.json'),evidence);
  // Only generated children of our exact disposable root; no production target.
  for(const child of ['payload','backend']){const target=path.resolve(directory,child);assert(target.startsWith(path.resolve(repo,'.tmp')+path.sep)&&path.dirname(target)===directory&&!fs.lstatSync(target).isSymbolicLink(),'Unsafe cleanup target');fs.rmSync(target,{recursive:true,force:false});}
  console.log(JSON.stringify({ok:evidence.ok,report:path.join(directory,'measurement.json'),runs:evidence.runs}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
