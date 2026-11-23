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
  const move=['moveDevices','movePreview','moveStart','moveResult','moveState','moveOpen','setNextSources','moveReinstallList','moveReinstall','moveRestoreSettings','moveChecklist','moveCheck','moveOpenProgramPage','moveRelease'];
  // 「옛 PC 백업에서 꺼내기」 (4.6 · 화면 세션 E26): the folders right inside a part of an old device's backup.
  const oldBackup=['browseBackupFolder'];
  // 화면 세션 요청 16: 「그만두기」 on a running restore.
  const stop=['cancelRestore'];
  // 화면 세션 E27: a part of a backup, whole, into a new folder.
  const scope=['restoreScope'];
  // 대량 삭제 · 변경 멈춤 (4.4): 「지워지기 전으로 되살리기」 and 「확인을 마침」 — the writing PC's, as the hold is its clean-up's.
  const mass=['restoreMassBefore','massConfirm'];
  // 쉬는 회선(4.14): 손님이 고른 Wi-Fi 이름. 백업 상태를 바꾸지 않아 복구 전용 연결에서도 고른다(찾기 · 되살리기 내려받기에도 든다).
  // 「AI 도구」(4.16): MCP 보기 도구의 동의와 가리는 낱말, 연결이 알려 온 도구 목록.
  // 화면 세션 E30: the Wi-Fi this PC is on, read for the 「쉬는 Wi-Fi」 screen.
  // 공간 비우기 2판(SPACE_DESIGN.md 12.4): 엔진 창에서만 켜는 「누를 때 비우기」와 정한 선. 쓰는 기기에서만 바꾼다.
  const solio=['setRestNetworks','setAiTools','aiToolsState','wifiName','spaceFreeState','setPressFree','setStartLine'];
  const expected=[...original,'previewRecommended','startRecommended','backupRecommended','restoreRecommended','addSources','removeSource',...account,...move,...oldBackup,...stop,...solio,...scope,...mass].sort();
  assert.deepEqual(Object.keys(contract).sort(),expected);
  assert.deepEqual(Object.keys(api).filter(x=>x!=='onState').sort(),expected);
  for(const name of ['backupNow','protectNow','startAutomatic','setupCloud','updateCloudCredentials','addSources','removeSource'])assert.equal(contract[name].allowedReadOnly,false);
  for(const name of ['restoreLatest','restoreSelected','openFileCatalog','browseBackupFolder','restoreScope'])assert.equal(contract[name].allowedReadOnly,true);
  // It asks where to put the folder (a dialog) and runs as long as the restore does, like 「지금 상태」 restore.
  assert.deepEqual([contract.restoreScope.dialog,contract.restoreScope.timeoutMs],[contract.restoreLatest.dialog,contract.restoreLatest.timeoutMs]);
  assert.deepEqual([contract.restoreMassBefore.dialog,contract.restoreMassBefore.timeoutMs,contract.restoreMassBefore.allowedReadOnly],[true,0,false]);
  assert.deepEqual([contract.massConfirm.mutating,contract.massConfirm.dialog,contract.massConfirm.allowedReadOnly],[true,false,false]);
  // A Google sign-in opens the browser (dialog) and waits for the person, so it has no time limit.
  for(const name of ['signInGoogle','takeWriteSeat','revokeDevice','reportLost','rotateReadKey','restoreRun','restoreChoose'])assert.deepEqual([contract[name].dialog,contract[name].timeoutMs],[true,0],name);
  for(const name of ['devicesList','restorePlan','restoreJob','restoreSeen','cancelGoogle','openGoogleAccount'])assert.equal(contract[name].mutating,false,name);
  // 「그만두기」 must reach the worker while a sign-in waits: no dialog, a short limit.
  assert.deepEqual([contract.cancelGoogle.dialog,contract.cancelGoogle.timeoutMs],[false,10000]);
  // 「그만두기」 on a restore reaches the worker while the restore runs, on a restore-only connection too.
  assert.deepEqual([contract.cancelRestore.dialog,contract.cancelRestore.timeoutMs,contract.cancelRestore.allowedReadOnly],[false,10000,true]);
  // A restore-only connection to the account's backup chooses the folders it will back up (the action decides).
  assert.equal(contract.chooseSources.allowedReadOnly,true);
  // The account code decides what a restore-only PC may do (it takes the write seat from there).
  for(const name of account)assert.equal(contract[name].allowedReadOnly,true,name);
  for(const name of move)assert.deepEqual([contract[name].allowedReadOnly,contract[name].dialog],[true,false],name);
  for(const name of ['moveStart','moveReinstall'])assert.equal(contract[name].timeoutMs,0,name);
  assert.deepEqual([contract.setRestNetworks.mutating,contract.setRestNetworks.dialog,contract.setRestNetworks.allowedReadOnly],[true,false,true]);
  assert.deepEqual([contract.setAiTools.mutating,contract.aiToolsState.mutating,contract.aiToolsState.allowedReadOnly],[true,false,true]);
  assert.deepEqual([contract.wifiName.mutating,contract.wifiName.dialog,contract.wifiName.allowedReadOnly],[false,false,true]);
  assert.deepEqual([contract.spaceFreeState.mutating,contract.setPressFree.allowedReadOnly,contract.setStartLine.allowedReadOnly],[false,false,false]);
});
