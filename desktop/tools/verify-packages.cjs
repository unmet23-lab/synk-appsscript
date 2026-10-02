'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const asar=require('@electron/asar'),{NtExecutable,NtExecutableResource}=require('resedit');
const {identity,DEV_URLS}=require('../src/catalog.cjs');
const root=path.resolve(__dirname,'..');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const fileHash=file=>sha(fs.readFileSync(file));
const assert=(value,message)=>{if(!value)throw Error(message);};
function verifyIcon(executable,id){
  const ico=fs.readFileSync(path.join(root,'assets',id+'.ico')),expected=[];
  for(let i=0;i<ico.readUInt16LE(4);i++){const at=6+i*16,size=ico.readUInt32LE(at+8),offset=ico.readUInt32LE(at+12);expected.push(sha(ico.subarray(offset,offset+size)));}
  const resource=NtExecutableResource.from(NtExecutable.from(executable));
  const actual=resource.entries.filter(e=>e.type===3).map(e=>sha(Buffer.from(e.bin)));
  assert(expected.every(hash=>actual.includes(hash)),id+': packaged executable icon mismatch');
  return {matchesApprovedDerivedIcon:true,imageCount:expected.length};
}
function verify(){
  const sourceFiles=require('./source-hash.cjs').sourceFiles(root);
  const sourceHash=require('./source-hash.cjs').sourceHash(root);
  const packages=[];
  for(const arch of ['x64','arm64'])for(const id of ['world','messenger','platform']){
    const c=identity(id,'development'),output=path.join(root,'dist','preview','win32',arch,id);
    const unpacked=path.join(output,arch==='arm64'?'win-arm64-unpacked':'win-unpacked');
    const executable=path.join(unpacked,c.executableName+'.exe'),archive=path.join(unpacked,'resources','app.asar');
    const metadata=JSON.parse(fs.readFileSync(path.join(unpacked,'resources','synk-install.json'),'utf8'));
    const runtime=JSON.parse(asar.extractFile(archive,'runtime.json').toString('utf8'));
    const packagedMetadata=JSON.parse(asar.extractFile(archive,'package.json').toString('utf8'));
    assert(metadata.version===require('../package.json').version&&packagedMetadata.version===metadata.version,id+': application version mismatch');
    assert(metadata.sourceHash===sourceHash,id+': stale packaged source');
    assert(metadata.arch===arch&&metadata.platform==='win32'&&metadata.mode==='development'&&metadata.clientId===id&&metadata.appId===c.appId,id+': metadata mismatch');
    assert(runtime.clientId===id&&runtime.mode==='development'&&runtime.entry===DEV_URLS[id],id+': runtime mismatch');
    for(const file of sourceFiles)assert(asar.extractFile(archive,path.normalize(file)).equals(fs.readFileSync(path.join(root,file))),id+': source differs: '+file);
    const binary=fs.readFileSync(executable),machine=binary.readUInt16LE(binary.readUInt32LE(0x3c)+4);
    assert(machine===(arch==='x64'?0x8664:0xaa64),id+': PE architecture mismatch');
    const icon=verifyIcon(binary,id);
    const installer=path.join(output,c.productName+'-'+metadata.version+'-win-'+arch+'.exe');
    const entry={clientId:id,platform:'win32',arch,mode:'development',version:metadata.version,appId:c.appId,sourceHash,authConfigured:!!runtime.auth,installer:{path:installer,bytes:fs.statSync(installer).size,sha256:fileHash(installer),modifiedAt:fs.statSync(installer).mtime.toISOString(),executed:false},executable:{path:executable,sha256:sha(binary),machine:'0x'+machine.toString(16),icon},asar:{path:archive,sha256:fileHash(archive),sourceMatches:true,version:packagedMetadata.version,authBridgeIncluded:asar.extractFile(archive,'src/preload.cjs').toString().includes('authSignIn')},trustedClients:[]};
    if(id==='platform'){
      assert(runtime.releases.filter(r=>r.installer).length===2,'Platform must include exactly two current client installers');
      for(const target of ['world','messenger']){
        const child=packages.find(p=>p.arch===arch&&p.clientId===target),pin=runtime.releases.find(r=>r.id===target&&r.version===child.version);
        assert(pin&&pin.arch===arch&&pin.mode==='development'&&pin.platform==='win32'&&pin.version===child.version&&pin.executableSHA256===child.executable.sha256&&pin.asarSHA256===child.asar.sha256,'Platform release pin mismatch: '+target);
        assert(pin.installer&&pin.installer.relativePath===target+'.exe'&&pin.installer.sha256===child.installer.sha256&&pin.installer.bytes===child.installer.bytes,'Platform installer pin mismatch: '+target);
        const included=path.join(unpacked,'resources','clients',pin.installer.relativePath);assert(fileHash(included)===pin.installer.sha256,'Platform bundled installer mismatch: '+target);
        entry.trustedClients.push({id:target,hashesMatch:true,installerIncluded:true});
      }
    }
    packages.push(entry);
  }
  const report={checkedAt:new Date().toISOString(),ok:true,host:{platform:process.platform,arch:process.arch,node:process.version},electronVersion:require('../package.json').devDependencies.electron,installerExecuted:false,arm64Executed:false,macArtifactsCreated:false,packages};
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
  fs.writeFileSync(path.join(root,'artifacts','package-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:true,packages:packages.length,sourceHash,report:'artifacts/package-verification.json'}));
}
try{verify();}catch(error){console.error(error.message);process.exitCode=1;}
