'use strict';
// Run inside a synthetic app.asar with Electron to exercise its real fs patch.
const {app}=require('electron'),fs=require('node:fs'),raw=require('original-fs'),path=require('node:path'),{createHash}=require('node:crypto'),assert=require('node:assert/strict');
const {createUpdateRecovery}=require('../src/platform-update-recovery.cjs');
const output=path.resolve(process.argv.find(value=>value.startsWith('--output=')).slice(9));
app.setPath('userData',path.join(output,'synthetic-profile'));
app.whenReady().then(async()=>{
  const archive=app.getAppPath(),expected=createHash('sha256').update(raw.readFileSync(archive)).digest('hex');
  assert.equal(fs.lstatSync(archive).isDirectory(),true);assert.equal(raw.lstatSync(archive).isFile(),true);
  const executable=path.join(output,'synthetic.exe');raw.writeFileSync(executable,'synthetic recovery executable');
  const cacheRoot=path.join(output,'cache');const store=createUpdateRecovery({cacheRoot,localAppData:path.join(output,'local'),executablePath:executable,asarPath:archive,currentVersion:'0.4.4'});
  const nonce=await store.prepare({targetVersion:'0.4.5',installerSHA256:'a'.repeat(64)}),pending=JSON.parse(raw.readFileSync(path.join(cacheRoot,'pending-auto-update.json'),'utf8'));
  assert.equal(pending.oldasarSHA,expected);assert.equal(nonce.length,64);
  raw.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,virtualFsIsDirectory:true,originalFsIsFile:true,archiveSHA256:expected,pendingArchiveSHA256:pending.oldasarSHA},null,2));app.quit();
}).catch(error=>{raw.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:false,error:error.stack}));app.exit(1);});
