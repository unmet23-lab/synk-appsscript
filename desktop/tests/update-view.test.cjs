'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const loaded=import('../renderer/update-view.mjs');
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
async function fixture({initial={ok:true,state:'idle',currentVersion:'0.4.4'},overrides={},confirmInstall=async()=>true,platform='win32',native=true}={}){
  const nodes=new Map(),calls=[];let snapshot=initial,listener;
  const element=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,textContent:'',innerHTML:'',dataset:{},handlers:{},setAttribute(){},addEventListener(name,handler){this.handlers[name]=handler;}});return nodes.get(id);};
  const bridge={updateStatus:async()=>snapshot,onUpdateChanged:callback=>{listener=callback;return ()=>listener=null;},checkForUpdate:async()=>{calls.push('check');return snapshot;},downloadUpdate:async()=>{calls.push('download');return snapshot;},installUpdate:async()=>{calls.push('install');return snapshot;},...overrides};
  const {mountPlatformUpdates}=await loaded,controller=mountPlatformUpdates({bridge:native?bridge:null,document:{getElementById:element},getEnvironment:()=>({platform,version:'0.4.4'}),confirmInstall});
  return {element,calls,controller,async click(action,view='settings'){return element('platform-update-'+view+'-'+action).handlers.click?.();},emit(next){snapshot=next;listener?.(next);}};
}
test('no desktop updater capability hides both entry points without requests',async()=>{
  for(const options of [{native:false},{overrides:{installUpdate:null}}]){const f=await fixture(options);await f.controller.ready;for(const view of ['settings','downloads'])assert.equal(f.element('platform-update-'+view).hidden,true);assert.deepEqual(f.calls,[]);}
});
test('settings and downloads share current version, available release and bounded progress',async()=>{
  const f=await fixture();await f.controller.ready;
  for(const view of ['settings','downloads'])assert.equal(f.element('platform-update-'+view+'-version').textContent,'현재 v0.4.4 · Preview');
  f.emit({ok:true,state:'available',currentVersion:'0.4.4',latestVersion:'0.4.5'});
  assert.match(f.element('platform-update-settings-status').textContent,/v0.4.5 Preview/);assert.equal(f.element('platform-update-downloads-download').hidden,false);
  f.emit({ok:true,state:'downloading',progress:39.8});assert.equal(f.element('platform-update-settings-percent').textContent,'40%');assert.equal(f.element('platform-update-downloads-progress').value,39.8);assert.equal(f.element('platform-update-settings-check').disabled,true);
  await f.click('check');await f.click('download');assert.deepEqual(f.calls,[]);
  f.emit({ok:true,state:'downloading',progress:500});assert.equal(f.element('platform-update-settings-progress').value,100);
  f.emit({ok:true,state:'current'});assert.equal(f.element('platform-update-settings-progress-wrap').hidden,true);assert.match(f.element('platform-update-settings-status').textContent,/최신 Preview/);
});
test('subscription state wins over a stale initial status and late action replies',async()=>{
  const initial=deferred(),check=deferred(),f=await fixture({overrides:{updateStatus:()=>initial.promise,checkForUpdate:()=>check.promise}});
  f.emit({state:'available',latestVersion:'0.4.5'});initial.resolve({state:'idle'});await f.controller.ready;
  assert.equal(f.element('platform-update-settings').dataset.updateState,'available');
  const pending=f.click('check');f.emit({state:'ready',latestVersion:'0.4.5'});check.resolve({state:'checking'});await pending;
  assert.equal(f.element('platform-update-settings').dataset.updateState,'ready');assert.equal(f.element('platform-update-settings-install').hidden,false);
});
test('download cannot repeat while pending and consumes the confirmed backend snapshot',async()=>{
  const pending=deferred();let downloads=0;const f=await fixture({initial:{state:'available',latestVersion:'0.4.5'},overrides:{downloadUpdate:()=>{downloads++;return pending.promise;}}});await f.controller.ready;
  const download=f.click('download');await f.click('download','downloads');await f.click('check');assert.equal(downloads,1);assert.deepEqual(f.calls,[]);
  pending.resolve({ok:true,state:'ready',latestVersion:'0.4.5'});await download;assert.equal(f.element('platform-update-settings-install').hidden,false);assert.equal(f.element('platform-update-settings-install').disabled,false);
});
test('installation requires ready status and explicit draft-exit acceptance before the bridge',async()=>{
  let allowed=false,confirms=0;const f=await fixture({initial:{state:'available'},confirmInstall:async()=>{confirms++;return allowed;}});await f.controller.ready;
  await f.click('install');assert.equal(confirms,0);f.emit({state:'ready'});await f.click('install');assert.equal(confirms,1);assert.deepEqual(f.calls,[]);
  allowed=true;await f.click('install');assert.deepEqual(f.calls,['install']);
  const pending=deferred(),g=await fixture({initial:{state:'ready'},confirmInstall:()=>pending.promise});await g.controller.ready;
  const installing=g.click('install');g.emit({state:'error',code:'UPDATE_UNAVAILABLE'});pending.resolve(true);await installing;assert.deepEqual(g.calls,[]);
});
test('safe retry copy covers offline and package errors without rendering raw service messages',async()=>{
  const f=await fixture({overrides:{checkForUpdate:async()=>{throw Error('private network details');}}});await f.controller.ready;await f.click('check');
  assert.match(f.element('platform-update-settings-status').textContent,/인터넷 연결/);assert.match(f.element('platform-update-settings-status').textContent,/현재 앱은 계속/);assert.doesNotMatch(f.element('platform-update-settings-status').textContent,/private/);assert.equal(f.element('platform-update-settings-check').disabled,false);
  for(const [code,expected] of [['UPDATE_STORAGE_FAILED',/저장 공간과 파일 권한/],['SAME_VERSION_BUILD_MISMATCH',/다시 설치/],['PACKAGE_HASH_MISMATCH',/파일을 확인하지/],['INSTALL_OPEN_FAILED',/파일을 열지/]]){f.emit({state:'error',code,message:'private network details'});assert.match(f.element('platform-update-settings-status').textContent,expected);assert.doesNotMatch(f.element('platform-update-settings-status').textContent,/private/);}
});
test('Mac ready state explains Applications installation without claiming automatic installation',async()=>{
  const f=await fixture({initial:{state:'ready'},platform:'darwin'});await f.controller.ready;assert.match(f.element('platform-update-settings-status').textContent,/Applications 폴더/);assert.equal(f.element('platform-update-settings-install').textContent,'설치 파일 열기');
  f.emit({state:'ready',code:'UPDATE_MANUAL_INSTALL'});assert.match(f.element('platform-update-settings-status').textContent,/설치 파일을 열었어요/);
  const g=await fixture({initial:{state:'ready',code:'UPDATE_EXIT_CANCELLED'}});await g.controller.ready;assert.match(g.element('platform-update-settings-status').textContent,/앱 종료를 취소/);assert.equal(g.element('platform-update-settings-install').disabled,false);
});
test('launcher update confirmation reuses draft exit and rejects changed ownership or remaining drafts',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../renderer/launcher.mjs'),'utf8'),fn=source.match(/async function confirmUpdateInstall\(\)\{[^\n]+\}/)?.[0];assert.ok(fn);
  for(const scenario of ['keep','discard','changed-owner','still-dirty']){
    let calls=0;const context={ownerEpoch:1,hasUnsavedDrafts:()=>scenario==='still-dirty',confirmDraftExit:async message=>{calls++;assert.match(message,/저장/);if(scenario==='changed-owner')context.ownerEpoch++;return scenario!=='keep';}};
    vm.runInNewContext(fn,context);assert.equal(await context.confirmUpdateInstall(),scenario==='discard');assert.equal(calls,1);
  }
});
