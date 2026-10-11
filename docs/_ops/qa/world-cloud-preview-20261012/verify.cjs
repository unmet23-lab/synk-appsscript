'use strict';
// Verify the actual NSIS deliveries, not merely the packaging input directories.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),work=__dirname,asar=require(path.join(root,'desktop/node_modules/@electron/asar'));
const {sourceHash}=require(path.join(root,'desktop/tools/source-hash.cjs'));
const z=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const assert=(v,m)=>{if(!v)throw Error(m);};
const read=name=>JSON.parse(fs.readFileSync(path.join(work,name),'utf8'));
const save=(name,data)=>fs.writeFileSync(path.join(work,name),JSON.stringify(data,null,2)+'\n');
const walk=(dir,rel='')=>fs.readdirSync(path.join(dir,rel),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir,path.join(rel,e.name)):[path.join(rel,e.name).replaceAll('\\','/')]).sort();
function run(args,name){const r=spawnSync(z,args,{encoding:'utf8',windowsHide:true,maxBuffer:6000000,timeout:180000});fs.writeFileSync(path.join(work,name+'.log'),(r.stdout||'')+(r.stderr||''));assert(r.status===0,name+' failed');return r.stdout;}
function keys(o){const out=[];function visit(v,p=''){if(v&&typeof v==='object')for(const[k,value]of Object.entries(v)){out.push(p+k);visit(value,p+k+'.');}}visit(o);return out;}
function auditArchive(archive,client){
  const files=asar.listPackage(archive).map(f=>f.replaceAll('\\','/').replace(/^\//,'')).filter(f=>!asar.statFile(archive,path.normalize(f)).files).sort();const findings=[];
  const patterns={privateKey:/-----BEGIN .*PRIVATE KEY-----/,awsKey:/AKIA[0-9A-Z]{16}/,githubToken:/gh[pousr]_[A-Za-z0-9_]{20,}/,googleApi:/AIza[0-9A-Za-z_-]{35}/,secretKey:/sk_(?:live|test)_[A-Za-z0-9]{16,}/,supabaseSecret:/sb_secret_[A-Za-z0-9_-]+/,privateLocalUser:/C:\\Users\\q1212/i};
  for(const file of files.filter(f=>/\.(json|js|cjs|mjs|html|txt)$/.test(f))){const text=asar.extractFile(archive,path.normalize(file)).toString();for(const[rule,re]of Object.entries(patterns))if(re.test(text))findings.push({file,rule});}
  const suspiciousNames=files.filter(f=>/(\.env$|\.log$|\.pem$|\.pfx$|\.p12$|\.key$|\.sqlite|\.db$|auth\.json$|cookies|vault|credential|backup)/i.test(f));
  const runtime=JSON.parse(asar.extractFile(archive,'runtime.json')),pkg=JSON.parse(asar.extractFile(archive,'package.json')),authSchemaKeys=keys(runtime.auth),secretAuthKeys=authSchemaKeys.filter(k=>/secret|password|private|token|service.?role/i.test(k));
  assert(!findings.length&&!suspiciousNames.length&&!secretAuthKeys.length,client+' archive privacy scan');
  return {client,sha256:hash(archive),fileCount:files.length,version:pkg.version,entry:runtime.entry,worldCloudPreview:runtime.worldCloudPreview===true,findings,suspiciousNames,authSchemaKeys,secretAuthKeys};
}
(async()=>{
  const out=path.join(work,'verified-delivery');assert(!fs.existsSync(out),'Preserve previous verification');fs.mkdirSync(out,{recursive:true});
  const report=read('public-package.json'),packages=[],archives=[];
  for(const client of ['world','platform']){
    const item=read(client+'-package.json'),candidate=read(client+'-candidate.json'),manifest=read(client+'-final-payload.json').files;
    assert(hash(item.installer.path)===item.installer.sha256&&fs.statSync(item.installer.path).size===item.installer.bytes,'Installer integrity '+client);
    const payload=path.join(out,client,'payload');fs.mkdirSync(payload,{recursive:true});run(['x',item.installer.path,'-o'+payload,'-y'],'verify-'+client+'-extract');
    const actual=walk(payload);assert(actual.join('\n')===manifest.map(f=>f.path).join('\n'),'Actual installer member list differs '+client);
    for(const file of manifest)assert(hash(path.join(payload,file.path))===file.sha256,'Actual delivered payload bytes differ '+client+' '+file.path);
    assert(!actual.some(f=>/\.log$|\.env$|\.db$|\.sqlite|\.pem$|\.pfx$|\.key$/i.test(f)),'Private/diagnostic payload files '+client);
    const archive=path.join(payload,'resources/app.asar'),metadata=JSON.parse(fs.readFileSync(path.join(payload,'resources/synk-install.json'))),stage=path.join(out,client,'stage');asar.extractAll(archive,stage);
    assert(metadata.version==='0.4.1'&&metadata.clientId===client&&metadata.mode==='development'&&metadata.arch==='x64','Delivered metadata mismatch '+client);
    assert(metadata.sourceHash===sourceHash(stage)&&metadata.sourceHash===candidate.sourceHash,'Delivered sourceHash mismatch '+client);
    const audit=auditArchive(archive,client);assert(audit.version==='0.4.1'&&audit.sha256===candidate.asar.sha256,'Delivered ASAR version/hash mismatch '+client);archives.push(audit);
    packages.push({client,installer:item.installer,payloadFiles:manifest.length,allPayloadBytesMatch:true,metadataVersion:metadata.version,sourceHash:metadata.sourceHash,diagnosticLogCount:0});
  }
  const worldDir=path.join(out,'world/payload'),platformDir=path.join(out,'platform/payload'),worldRuntime=JSON.parse(asar.extractFile(path.join(worldDir,'resources/app.asar'),'runtime.json'));
  assert(worldRuntime.entry==='https://synk.im/account/client.html?product=world'&&worldRuntime.worldCloudPreview===true,'WORLD cloud runtime missing');
  const runtime=JSON.parse(asar.extractFile(path.join(platformDir,'resources/app.asar'),'runtime.json')),worldPin=runtime.releases.find(r=>r.id==='world'&&r.version==='0.4.1');
  assert(worldPin&&worldPin.executableSHA256===hash(path.join(worldDir,'SYNKWorldPreview.exe'))&&worldPin.asarSHA256===hash(path.join(worldDir,'resources/app.asar')),'WORLD executable/archive release pins mismatch');
  const includedWorld=path.join(platformDir,'resources/clients/world.exe');assert(hash(includedWorld)===report.world.sha256&&hash(includedWorld)===worldPin.installer.sha256&&fs.statSync(includedWorld).size===worldPin.installer.bytes,'Embedded WORLD installer mismatch');
  const oldWorld=runtime.releases.find(r=>r.id==='world'&&r.version==='0.4.0');assert(oldWorld&&!oldWorld.installer&&oldWorld.asarSHA256==='0840f2e6f7f698b887b6ad0eb39b4bad11dc40db9d6854168e15590df770f170'&&oldWorld.executableSHA256==='64eb5f2bfcb0da4e714c065c9c7715b49e27554be1c553f45736a7a546ac1d78','Historic WORLD execution pin changed');
  const messenger=path.join(platformDir,'resources/clients/messenger.exe'),messengerPin=runtime.releases.find(r=>r.id==='messenger');assert(hash(messenger)==='ec84d50e4c48b8834434a60f941fa703ad96d63c85922d3f82fcb06d758b2cff'&&messengerPin.installer.sha256===hash(messenger)&&messengerPin.installer.bytes===fs.statSync(messenger).size,'Workspace installer changed');
  const messengerOut=path.join(out,'messenger');fs.mkdirSync(messengerOut,{recursive:true});run(['x',messenger,'resources\\app.asar','-o'+messengerOut,'-y'],'verify-messenger-extract');archives.push(auditArchive(path.join(messengerOut,'resources/app.asar'),'messenger'));
  const prior=path.join(root,'.tmp/platform-download-20261011/package/platform/stage'),current=path.join(out,'platform/stage');for(const file of read('platform-baseline-asar.json').files.filter(f=>!['package.json','runtime.json'].includes(f.path)))assert(hash(path.join(current,file.path))===file.sha256,'Unrelated Platform ASAR changed '+file.path);
  const result={ok:true,checkedAt:new Date().toISOString(),version:'0.4.1',packages,archives,allArchiveFiles:archives.reduce((sum,a)=>sum+a.fileCount,0),worldEntry:worldRuntime.entry,requiresDevelopmentServer:false,requiresInternet:true,historicWorldPinPreserved:true,workspaceInstallerUnchanged:true,platformUIAndPULSEUnchanged:true,actualInstallerReextracted:true,installerExecuted:false,userProfileRead:false,installedStateTouched:false,publicUpload:false};save('public-verification.json',result);console.log(JSON.stringify(result));
})().catch(e=>{save('verification-failure.json',{at:new Date().toISOString(),error:e.stack||e.message});console.error(e.stack||e.message);process.exitCode=1;});
