'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function load(tauri){const context={window:{__TAURI__:tauri},setTimeout};vm.runInNewContext(fs.readFileSync(path.join(root,'bridge/bridge.js'),'utf8'),context);return context.window.backup;}
test('bridge preserves argument values and both result envelopes',async()=>{
  const received=[];const api=load({core:{invoke:async(name,args)=>{received.push({name,...args});return {ok:true,value:7};}}});
  assert.equal(Object.isFrozen(api),true);
  assert.deepEqual(await api.setAutomatic(false),{ok:true,value:7});
  assert.equal(received[0].name,'backup_call');assert.equal(received[0].method,'setAutomatic');assert.deepEqual(Array.from(received[0].args),[false]);
  assert.equal(api.encrypt,undefined);assert.equal(api.spawn,undefined);assert.equal(api.boot,undefined);
  const error={ok:false,error:'fixture error',code:'CATALOG_EXPIRED'};
  assert.equal(await load({core:{invoke:async()=>error}}).getState(),error);
});
test('bridge never reveals raw transport exception or malformed responses',async()=>{
  for(const response of [null,{}, {ok:'true'}]){const out=await load({core:{invoke:async()=>response}}).getState();assert.equal(out.ok,false);}
  const out=await load({core:{invoke:async()=>{throw Error('SECRET_DO_NOT_SHOW');}}}).getState();
  assert.equal(out.ok,false);assert.ok(!JSON.stringify(out).includes('SECRET_DO_NOT_SHOW'));
});
test('awaited subscription cleanup releases once and stops late events',async()=>{
  let resolve,handler,released=0,events=0;
  const api=load({event:{listen:(_name,fn)=>{handler=fn;return new Promise(r=>{resolve=r;});}}});
  const subscribed=api.onState(()=>events++);handler({payload:1});assert.equal(events,1);
  resolve(()=>{released++;});const unsubscribe=await subscribed;
  unsubscribe();unsubscribe();handler({payload:2});await new Promise(setImmediate);
  assert.equal(events,1);assert.equal(released,1);
});
test('failed status subscription rejects so existing app activates polling fallback',async()=>{
  for(const tauri of [{},{event:{listen:()=>{throw Error('SECRET');}}},{event:{listen:async()=>{throw Error('SECRET');}}}]){
    let polling=false;
    try{await load(tauri).onState(()=>{});}catch(e){polling=true;assert.ok(!e.message.includes('SECRET'));}
    assert.equal(polling,true);
  }
});
test('bridge, worker and native method contract preserves all existing app actions',()=>{
  const contract=require('../contract/methods.json');const api=load({});
  const original=[...fs.readFileSync(path.resolve(root,'../solo-backup/src/preload.cjs'),'utf8').matchAll(/call\('([^']+)'\)/g)].map(m=>m[1]).sort();
  // The account's requests (STAGE1_DESIGN.md 2.1 · 4.5): 「Google로 시작」 · 「보호 시작」 and the provisioning server's.
  const account=['signInGoogle','startProtection','continueBackup','openAccountBackup','devicesList','takeWriteSeat','revokeDevice','reportLost','rotateReadKey','restorePlan','restoreRun','restoreJob','restoreChoose','restoreSeen','cancelGoogle','openGoogleAccount'];
  // 「새 PC로 옮겨 오기」 (4.6 · 4.6b): done on a PC that does not write, so every one is allowed restore-only.
  const move=['moveDevices','movePreview','moveStart','moveResult','moveReinstallList','moveReinstall','moveRestoreSettings','moveChecklist','moveCheck','moveRelease'];
  const expected=[...original,'previewRecommended','startRecommended','backupRecommended','restoreRecommended','addSources','removeSource',...account,...move].sort();
  assert.deepEqual(Object.keys(contract).sort(),expected);
  assert.deepEqual(Object.keys(api).filter(x=>x!=='onState').sort(),expected);
  for(const name of ['backupNow','protectNow','startAutomatic','setupCloud','updateCloudCredentials','addSources','removeSource'])assert.equal(contract[name].allowedReadOnly,false);
  for(const name of ['restoreLatest','restoreSelected','openFileCatalog'])assert.equal(contract[name].allowedReadOnly,true);
  // A Google sign-in opens the browser (dialog) and waits for the person, so it has no time limit.
  for(const name of ['signInGoogle','takeWriteSeat','revokeDevice','reportLost','rotateReadKey','restoreRun','restoreChoose'])assert.deepEqual([contract[name].dialog,contract[name].timeoutMs],[true,0],name);
  for(const name of ['devicesList','restorePlan','restoreJob','restoreSeen','cancelGoogle','openGoogleAccount'])assert.equal(contract[name].mutating,false,name);
  // 「그만두기」 must reach the worker while a sign-in waits: no dialog, a short limit.
  assert.deepEqual([contract.cancelGoogle.dialog,contract.cancelGoogle.timeoutMs],[false,10000]);
  // A restore-only connection to the account's backup chooses the folders it will back up (the action decides).
  assert.equal(contract.chooseSources.allowedReadOnly,true);
  // The account code decides what a restore-only PC may do (it takes the write seat from there).
  for(const name of account)assert.equal(contract[name].allowedReadOnly,true,name);
  for(const name of move)assert.deepEqual([contract[name].allowedReadOnly,contract[name].dialog],[true,false],name);
  for(const name of ['moveStart','moveReinstall'])assert.equal(contract[name].timeoutMs,0,name);
});
