'use strict';
// Run with the exact legacy Electron runtime. No window or production profile.
const {app,safeStorage}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=process.env.SWB_FIXTURE_OUTPUT;
if(!root||!path.isAbsolute(root)||fs.existsSync(root))throw Error('A new absolute fixture directory is required');
fs.mkdirSync(root,{recursive:true});const state=path.join(root,'state');app.setPath('userData',state);
app.whenReady().then(()=>{
  const sample='Rust migration fixture 한글 123';
  fs.writeFileSync(path.join(root,'fixture.json'),JSON.stringify({sample,cipher:safeStorage.encryptString(sample).toString('base64'),electron:process.versions.electron,state}),{flag:'wx'});
  for(const name of ['cloud-vault','account-recovery'])fs.mkdirSync(path.join(state,name),{recursive:true});
  const repositoryId='a'.repeat(64);
  const config={schema:1,mode:'backup',automatic:true,provider:{type:'b2'},repositoryId,sources:['C:\\fixture-source']};
  const credential={version:2,password:'A'.repeat(43),keyId:'write-key-fixture',applicationKey:'write-credential-fixture'};
  const recovery={verified:{repositoryId},readKey:{credentials:{keyId:'read-key-fixture',applicationKey:'read-credential-fixture'}}};
  fs.writeFileSync(path.join(state,'cloud-vault/settings.json'),JSON.stringify(config),{flag:'wx'});
  fs.writeFileSync(path.join(state,'cloud-vault/credential.bin'),safeStorage.encryptString(JSON.stringify(credential)),{flag:'wx'});
  fs.writeFileSync(path.join(state,'account-recovery/recovery.bin'),safeStorage.encryptString(JSON.stringify(recovery)),{flag:'wx'});
  app.quit();
}).catch(()=>app.exit(1));
