'use strict';
// Immutable input preparation. This never installs or opens the clients.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),work=__dirname;
const asar=require(path.join(root,'desktop/node_modules/@electron/asar'));
const z=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe');
const source=path.join(root,'.tmp/platform-download-20261011/package/platform/payload');
const installer=path.join(root,'.tmp/platform-download-20261011/SYNK-Platform-Preview-0.4.0-win-x64.exe');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const assert=(v,m)=>{if(!v)throw Error(m);};
const walk=(dir,rel='')=>fs.readdirSync(path.join(dir,rel),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir,path.join(rel,e.name)):[path.join(rel,e.name).replaceAll('\\','/')]).sort();
const manifest=dir=>walk(dir).map(p=>({path:p,sha256:hash(path.join(dir,p)),bytes:fs.statSync(path.join(dir,p)).size}));
const save=(name,data)=>fs.writeFileSync(path.join(work,name),JSON.stringify(data,null,2)+'\n');
assert(!fs.existsSync(path.join(work,'preparation.json')),'Preserve prepared inputs');
assert(hash(installer)==='2eac837a7f0aecc63ed4796c8ee3bcc67b96ef26ecc57055b1b4577276ee0323','Public baseline installer mismatch');
assert(hash(path.join(source,'resources/app.asar'))==='b76a5a96f325052b7717109652724c1bb57cf064ae2137ebfa97bb003b4cc3ea','Public baseline Platform archive mismatch');
assert(hash(path.join(source,'resources/clients/world.exe'))==='537578727fe799eecb0923b1b4b8dfa4778e188103a2113a2c9e8860b0b66ac4','WORLD input mismatch');
assert(hash(path.join(source,'resources/clients/messenger.exe'))==='ec84d50e4c48b8834434a60f941fa703ad96d63c85922d3f82fcb06d758b2cff','Workspace input mismatch');
const worldPayload=path.join(work,'world/payload');assert(!fs.existsSync(worldPayload),'Preserve prior WORLD extraction');fs.mkdirSync(worldPayload,{recursive:true});
const r=spawnSync(z,['x',path.join(source,'resources/clients/world.exe'),'-o'+worldPayload,'-y'],{windowsHide:true,encoding:'utf8',maxBuffer:4000000,timeout:180000});fs.writeFileSync(path.join(work,'world-source-extract.log'),(r.stdout||'')+(r.stderr||''));assert(r.status===0,'WORLD extraction failed');
assert(hash(path.join(worldPayload,'resources/app.asar'))==='0840f2e6f7f698b887b6ad0eb39b4bad11dc40db9d6854168e15590df770f170','WORLD archive mismatch');
const platformPayload=path.join(work,'platform/payload');assert(!fs.existsSync(platformPayload),'Preserve prior Platform copy');fs.cpSync(source,platformPayload,{recursive:true});
const clients=[];
for(const client of ['world','platform']){
  const payload=path.join(work,client,'payload'),stage=path.join(work,client,'stage'),archive=path.join(payload,'resources/app.asar');
  assert(!fs.existsSync(stage),'Preserve stage '+client);asar.extractAll(archive,stage);
  const payloadFiles=manifest(payload),asarFiles=manifest(stage);save(client+'-baseline-payload.json',{files:payloadFiles});save(client+'-baseline-asar.json',{files:asarFiles});
  clients.push({client,payload,stage,archiveSHA256:hash(archive),payloadFileCount:payloadFiles.length,asarFileCount:asarFiles.length});
}
save('preparation.json',{ok:true,preparedAt:new Date().toISOString(),sourcePayload:source,sourceInstaller:{path:installer,sha256:hash(installer)},clients,installedStateTouched:false,installerExecuted:false});
console.log(JSON.stringify({ok:true,clients,installedStateTouched:false}));
