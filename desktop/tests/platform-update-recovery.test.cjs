'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createUpdateRecovery}=require('../src/platform-update-recovery.cjs');
async function fixture(t){
  const root=await fsp.mkdtemp(path.join(os.tmpdir(),'synk-update-recovery-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
  const cacheRoot=path.join(root,'cache'),localAppData=path.join(root,'local'),executablePath=path.join(root,'app.exe'),asarPath=path.join(root,'app.asar'),time=Date.parse('2026-10-14T12:00:00.000Z');
  await fsp.writeFile(executablePath,'synthetic old exe');await fsp.writeFile(asarPath,'synthetic old asar');
  const recovery=createUpdateRecovery({cacheRoot,localAppData,executablePath,asarPath,currentVersion:'0.4.4',now:()=>time});
  const nonce=await recovery.prepare({targetVersion:'0.4.5',installerSHA256:'a'.repeat(64)}),pendingPath=path.join(cacheRoot,'pending-auto-update.json'),markerPath=path.join(localAppData,'SYNK','Installer','Recovery','im.synk.platform.preview.json');
  const pending=JSON.parse(await fsp.readFile(pendingPath,'utf8'));
  const marker={schemaVersion:1,appId:'im.synk.platform.preview',nonce,fromVersion:'0.4.4',toVersion:'0.4.5',executablePath,executableSHA256:pending.oldexeSHA,asarSHA256:pending.oldasarSHA,installerSHA256:'a'.repeat(64),createdAt:new Date(time-1000).toISOString(),expiresAt:new Date(time+599000).toISOString(),status:'rolled-back'};
  const write=async value=>{await fsp.mkdir(path.dirname(markerPath),{recursive:true});await fsp.writeFile(markerPath,JSON.stringify(value));};await write(marker);
  return {root,recovery,marker,write,nonce,pendingPath,markerPath,executablePath,asarPath,argv:['--synk-update-recovery='+nonce],pending};
}
test('valid rollback proof checks actual executable/asar then consumes both records exactly once',async t=>{
  const f=await fixture(t);assert.equal(f.nonce.length,64);assert.equal((await f.recovery.consume(f.argv)).code,'UPDATE_RECOVERED');await assert.rejects(fsp.stat(f.pendingPath),{code:'ENOENT'});await assert.rejects(fsp.stat(f.markerPath),{code:'ENOENT'});assert.equal((await f.recovery.consume(f.argv)).code,'UPDATE_RECOVERY_INVALID');
});
test('normal launch does not read or consume pending recovery state',async t=>{
  const f=await fixture(t);assert.deepEqual(await f.recovery.consume([]),{requested:false,recovered:false,code:null});assert.ok(await fsp.stat(f.pendingPath));assert.ok(await fsp.stat(f.markerPath));
});
test('a rejected update before changes supports unchanged proof with the same strict identity checks',async t=>{
  const f=await fixture(t);await f.write({...f.marker,status:'unchanged'});assert.equal((await f.recovery.consume(f.argv)).recovered,true);
});
test('wrong nonce, version, installer, executable path or hashes never grant recovery bypass or consume records',async t=>{
  for(const patch of [{nonce:'b'.repeat(64)},{appId:'im.synk.other'},{fromVersion:'0.4.3'},{toVersion:'0.4.6'},{installerSHA256:'b'.repeat(64)},{executablePath:'C:\\unrelated.exe'},{executableSHA256:'b'.repeat(64)},{asarSHA256:'b'.repeat(64)},{status:'installed'}]){
    const f=await fixture(t);await f.write({...f.marker,...patch});assert.equal((await f.recovery.consume(f.argv)).code,'UPDATE_RECOVERY_INVALID');assert.ok(await fsp.stat(f.pendingPath));assert.ok(await fsp.stat(f.markerPath));
  }
});
test('expired, future and overlong proof lifetimes are rejected',async t=>{
  for(const patch of [{expiresAt:'2026-10-14T11:59:00.000Z'},{createdAt:'2026-10-14T12:01:00.000Z'},{createdAt:'2026-10-14T11:40:00.000Z'},{expiresAt:'2026-10-14T13:00:00.000Z'}]){
    const f=await fixture(t);await f.write({...f.marker,...patch});assert.equal((await f.recovery.consume(f.argv)).recovered,false);
  }
});
test('actual executable or asar replacement invalidates an otherwise matching recovery proof',async t=>{
  for(const target of ['executablePath','asarPath']){const f=await fixture(t);await fsp.writeFile(f[target],'tampered');assert.equal((await f.recovery.consume(f.argv)).recovered,false);}
});
test('duplicate or malformed CLI nonce and oversized JSON are rejected without destructive cleanup',async t=>{
  const f=await fixture(t);for(const argv of [[...f.argv,...f.argv],['--synk-update-recovery=../path'],['--synk-update-recovery=']])assert.equal((await f.recovery.consume(argv)).recovered,false);
  await fsp.writeFile(f.markerPath,' '.repeat(8193));assert.equal((await f.recovery.consume(f.argv)).recovered,false);assert.ok(await fsp.stat(f.pendingPath));
});
test('subsequent explicit install retry issues a fresh nonce so prior proof cannot be replayed',async t=>{
  const f=await fixture(t);const fresh=await f.recovery.prepare({targetVersion:'0.4.5',installerSHA256:'a'.repeat(64)});assert.notEqual(fresh,f.nonce);assert.equal((await f.recovery.consume(f.argv)).recovered,false);
});
