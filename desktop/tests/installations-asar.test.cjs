'use strict';
const path=require('node:path'),crypto=require('node:crypto');
const digest=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

async function electronProbe(){
  const {app,BrowserWindow}=require('electron'),fs=require('original-fs').promises,root=process.argv[2];
  app.setPath('appData',path.join(root,'Roaming'));app.setPath('userData',path.join(root,'Roaming','Probe'));app.setPath('sessionData',path.join(root,'Roaming','Probe','Session'));app.setPath('temp',path.join(root,'Temp'));app.disableHardwareAcceleration();
  try{
    const assert=require('node:assert/strict'),{createInstallations,installationPaths}=require('../src/installations.cjs');
    const releases=JSON.parse(await fs.readFile(path.join(root,'releases.json'),'utf8'));
    const spawnAttempts=[];
    const options={clientId:'platform',mode:'development',platform:'win32',arch:'x64',programRoot:path.join(root,'Programs'),releases,spawn(file){spawnAttempts.push(file);throw Error('NO_PROCESS_ALLOWED');}};
    const service=createInstallations(options),world=installationPaths('world',options),archive=await fs.readFile(world.asar),executable=await fs.readFile(world.executable),metadata=await fs.readFile(world.metadata);
    let patchedReadCode;try{await require('node:fs/promises').readFile(world.asar);}catch(error){patchedReadCode=error.code;}
    assert.equal(patchedReadCode,'ENOENT','the regression must exercise Electron ASAR virtualization');
    const before=await service.getClients();
    for(const id of ['world','messenger']){const row=before.find(item=>item.id===id);assert.equal(row.status,'installed');assert.equal(row.canLaunch,true);}
    // A previous good list result must never authorize launch from cached hashes,
    // even for a replacement with identical size and restored modification time.
    const executableStat=await fs.stat(world.executable),replacement=Buffer.from(executable);replacement[0]^=1;
    await fs.writeFile(world.executable,replacement);await fs.utimes(world.executable,executableStat.atime,executableStat.mtime);
    const [replacedList,replacedLaunch]=await Promise.all([service.getClients(),service.launch('world')]);
    assert.equal(replacedList.find(item=>item.id==='world').reason,'INVALID_INSTALLATION');
    assert.equal(replacedLaunch.code,'INVALID_INSTALLATION');assert.equal(spawnAttempts.length,0);await fs.writeFile(world.executable,executable);
    const archiveStat=await fs.stat(world.asar),replacedArchive=Buffer.from(archive);replacedArchive[replacedArchive.length-1]^=1;
    await fs.writeFile(world.asar,replacedArchive);await fs.utimes(world.asar,archiveStat.atime,archiveStat.mtime);
    assert.equal((await service.launch('world')).code,'INVALID_INSTALLATION');assert.equal(spawnAttempts.length,0);await fs.writeFile(world.asar,archive);
    const verifyInvalid=async()=>{const row=(await service.getClients()).find(item=>item.id==='world');assert.equal(row.reason,'INVALID_INSTALLATION');assert.equal(row.canLaunch,false);};
    await fs.writeFile(world.executable,'tampered synthetic executable');await verifyInvalid();await fs.writeFile(world.executable,executable);
    await fs.writeFile(world.asar,Buffer.concat([archive,Buffer.from('tampered')]));await verifyInvalid();await fs.writeFile(world.asar,archive);
    await fs.writeFile(world.metadata,JSON.stringify({...JSON.parse(metadata),clientId:'messenger'}));await verifyInvalid();await fs.writeFile(world.metadata,metadata);
    const outside=path.join(root,'outside.asar');await fs.writeFile(outside,archive);
    const escaped=createInstallations({...options,realpath:async file=>file===world.asar?outside:fs.realpath(file)});
    assert.equal((await escaped.getClients()).find(item=>item.id==='world').reason,'INVALID_INSTALLATION');
    const messenger=installationPaths('messenger',options);await fs.unlink(messenger.asar);assert.equal((await service.getClients()).find(item=>item.id==='messenger').reason,'NOT_INSTALLED');
    assert.equal((await service.launch('messenger')).code,'NOT_INSTALLED');assert.equal(spawnAttempts.length,0);
    assert.equal(BrowserWindow.getAllWindows().length,0);assert.notEqual(process.noAsar,true);
    await fs.writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,electron:process.versions.electron,windowCount:0,patchedReadCode,installedIds:before.filter(item=>item.canLaunch).map(item=>item.id),tamperedExecutableRejected:true,tamperedArchiveRejected:true,wrongMetadataRejected:true,outsideRealpathRejected:true,missingArchiveRejected:true,freshLaunchVerification:true,sameSizeReplacementRejected:true,concurrentInspectionSafe:true,globalAsarSupportUnchanged:true}));app.exit(0);
  }catch(error){await fs.writeFile(path.join(root,'result.json'),JSON.stringify({ok:false,message:error.message,stack:error.stack}));app.exit(1);}
}
if(process.versions.electron){void electronProbe();}
else {
  const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),{spawn}=require('node:child_process');
  test('Electron inspects physical ASAR bytes while preserving pins and path boundaries',{skip:process.platform!=='win32'},async t=>{
    const tempRoot=path.resolve(os.tmpdir()),root=await fs.mkdtemp(path.join(tempRoot,'synk-install-asar-'));
    t.after(async()=>{const relative=path.relative(tempRoot,path.resolve(root));assert.ok(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));await fs.rm(root,{recursive:true,force:true});});
    const source=path.join(root,'archive-source');
    for(const dir of [source,path.join(root,'Roaming'),path.join(root,'Local'),path.join(root,'Temp')])await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(source,'synthetic.txt'),'ASAR installation regression fixture');
    const packed=path.join(root,'fixture.asar');await require('@electron/asar').createPackage(source,packed);const archive=await fs.readFile(packed),releases=[];
    for(const [id,name]of [['world','SYNKWorldPreview'],['messenger','SYNKMessengerPreview']]){
      const install=path.join(root,'Programs',name),resources=path.join(install,'resources'),executable=Buffer.from('Synthetic non-executable '+id);await fs.mkdir(resources,{recursive:true});
      await fs.writeFile(path.join(install,name+'.exe'),executable);await fs.writeFile(path.join(resources,'app.asar'),archive);
      await fs.writeFile(path.join(resources,'synk-install.json'),JSON.stringify({clientId:id,appId:'im.synk.'+id+'.preview',version:'0.4.0',mode:'development',arch:'x64',platform:'win32'}));
      releases.push({id,version:'0.4.0',mode:'development',platform:'win32',arch:'x64',executableSHA256:digest(executable),asarSHA256:digest(archive)});
    }
    await fs.writeFile(path.join(root,'releases.json'),JSON.stringify(releases));
    const env={...process.env,APPDATA:path.join(root,'Roaming'),LOCALAPPDATA:path.join(root,'Local'),TEMP:path.join(root,'Temp'),TMP:path.join(root,'Temp')};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_NO_ASAR;
    const child=spawn(require('electron'),[__filename,root],{env,windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:15000});let output='';
    child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
    const result=JSON.parse(await fs.readFile(path.join(root,'result.json'),'utf8'));assert.equal(code,0,result.stack||output);assert.equal(result.ok,true);assert.deepEqual(result.installedIds,['world','messenger']);assert.equal(result.windowCount,0);
  });
}
