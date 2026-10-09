'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os'),crypto=require('node:crypto');
const {resolveProgramRoot}=require('../src/program-root.cjs');
const {createInstallations,installationPaths}=require('../src/installations.cjs');
const resolve=(env,getHome)=>resolveProgramRoot({platform:'win32',env,getHome});
test('explicit LocalAppData wins, including redirected drive and UNC paths',()=>{
  for(const local of ['D:\\Redirected Local','\\\\fileserver\\user-local\\member','C:/Users/회원/AppData/Local/']) {
    assert.equal(resolve({LOCALAPPDATA:local,USERPROFILE:'C:\\Users\\different'},()=>{throw Error('must not consult home');}),path.win32.join(local,'Programs'));
  }
});
test('missing and blank LocalAppData use per-user Local, never Roaming or cwd',()=>{
  for(const missing of [undefined,null,'','  '])assert.equal(resolve({LOCALAPPDATA:missing,USERPROFILE:'C:\\Users\\fixture',APPDATA:'Z:\\Redirected Roaming'}),'C:\\Users\\fixture\\AppData\\Local\\Programs');
  assert.equal(resolve({APPDATA:'C:\\Users\\fixture\\AppData\\Roaming'},()=>'D:/User Profiles/fixture'),'D:\\User Profiles\\fixture\\AppData\\Local\\Programs');
  assert.equal(resolve({USERPROFILE:'\\\\profiles\\users\\fixture'}),'\\\\profiles\\users\\fixture\\AppData\\Local\\Programs');
});
test('malformed explicit LocalAppData fails instead of silently changing its location',()=>{
  for(const value of ['relative','C:relative','\\root-relative','/root-relative','\\\\?\\C:\\Local','\\\\.\\Local','C:\\Local\u0000',42])assert.throws(()=>resolve({LOCALAPPDATA:value,USERPROFILE:'C:\\Users\\fixture'}),{code:'INVALID_LOCAL_APP_DATA'});
});
test('an unavailable home fails clearly without probing Roaming or a process directory',()=>{
  for(const value of [undefined,'','relative','C:relative','\\root-relative'])assert.throws(()=>resolve({USERPROFILE:value,APPDATA:'C:\\Roaming'},()=>value),{code:'INSTALLATION_ROOT_UNAVAILABLE'});
  assert.throws(()=>resolve({},()=>{throw Error('home unavailable');}),{code:'INSTALLATION_ROOT_UNAVAILABLE'});
  assert.equal(resolve({USERPROFILE:'relative'},()=>'C:\\Users\\fixture'),'C:\\Users\\fixture\\AppData\\Local\\Programs');
});
test('macOS keeps its existing application directory',()=>{
  assert.equal(resolveProgramRoot({platform:'darwin',env:{LOCALAPPDATA:'bad'},getHome:()=>{throw Error('unused');}}),'/Applications');
});
test('missing LocalAppData finds a real pinned fixture and still rejects changed bytes',{skip:process.platform!=='win32'},async t=>{
  const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'synk-program-root-'));
  t.after(()=>fs.rm(fixture,{recursive:true,force:true}));
  const root=resolve({USERPROFILE:fixture,APPDATA:path.join(fixture,'AppData','Roaming')}),locations=installationPaths('world',{platform:'win32',mode:'development',programRoot:root});
  await fs.mkdir(path.dirname(locations.asar),{recursive:true});
  const exe=Buffer.from('fixture executable'),asar=Buffer.from('fixture archive'),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  await fs.writeFile(locations.executable,exe);await fs.writeFile(locations.asar,asar);
  await fs.writeFile(locations.metadata,JSON.stringify({clientId:'world',appId:'im.synk.world.preview',version:'0.4.0',mode:'development',arch:'x64',platform:'win32'}));
  const service=createInstallations({clientId:'platform',mode:'development',platform:'win32',arch:'x64',programRoot:root,releases:[{id:'world',mode:'development',platform:'win32',arch:'x64',version:'0.4.0',executableSHA256:hash(exe),asarSHA256:hash(asar)}],spawn(){throw Error('NO_PROCESS_ALLOWED');}});
  const found=(await service.getClients()).find(row=>row.id==='world');assert.equal(found.status,'installed');assert.equal(found.canLaunch,true);
  await fs.writeFile(locations.asar,'changed fixture');
  const changed=(await service.getClients()).find(row=>row.id==='world');assert.equal(changed.reason,'INVALID_INSTALLATION');assert.equal(changed.canLaunch,false);
});
