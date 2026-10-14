'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const loaded=import('../renderer/startup-update.mjs');
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {resolve,reject,promise};};
async function fixture({snapshot={state:'checking',currentVersion:'0.4.5',platform:'win32'},overrides={},native=true}={}){
  const nodes=new Map(),calls=[];let callback;
  const element=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,textContent:'',value:0,dataset:{},attributes:{},handlers:{},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},addEventListener(type,handler){this.handlers[type]=handler;}});return nodes.get(id);};
  const document={getElementById:element,documentElement:{dataset:{}}};
  const bridge={getStatus:async()=>snapshot,retry:async()=>{calls.push('retry');return snapshot;},openCurrent:async()=>{calls.push('current');return snapshot;},install:async()=>{calls.push('install');return snapshot;},onChanged:listener=>{callback=listener;return ()=>callback=null;},...overrides};
  const {mountStartupUpdate}=await loaded,controller=mountStartupUpdate({bridge:native?bridge:null,document});
  return {element,document,calls,controller,click:action=>element('startup-'+({current:'open-current'}[action]||action)).handlers.click?.(),emit:value=>{snapshot=value;callback?.(value);}};
}
test('checking, real download progress and installation never expose a skip or retry action',async()=>{
  const f=await fixture();await f.controller.ready;
  assert.match(f.element('startup-title').textContent,/최신 버전을 확인/);assert.equal(f.document.documentElement.dataset.startupReady,'true');
  for(const state of ['checking','downloading','installing']){
    f.emit({state,platform:'win32',currentVersion:'0.4.5',latestVersion:'0.4.6',progress:42.8,canRetry:true,canOpenCurrent:true,canInstall:true});
    assert.equal(f.element('startup-actions').hidden,true);await f.click('retry');await f.click('current');await f.click('install');
    if(state==='downloading'){assert.equal(f.element('startup-progress').value,42.8);assert.equal(f.element('startup-percent').textContent,'42%');assert.equal(f.element('startup-progress-wrap').hidden,false);}
    else assert.equal(f.element('startup-progress-wrap').hidden,true);
  }
  assert.match(f.element('startup-description').textContent,/완료되면 자동으로 열립니다/);assert.deepEqual(f.calls,[]);
});
test('download progress is bounded and only validated versions are presented',async()=>{
  const f=await fixture();await f.controller.ready;
  for(const [progress,expected] of [[-10,0],[200,100],[Infinity,0],[NaN,0]]){f.emit({state:'downloading',progress,currentVersion:'<img onerror=private>',latestVersion:'<secret>'});assert.equal(f.element('startup-progress').value,expected);assert.doesNotMatch(f.element('startup-version').textContent,/private|img/);assert.doesNotMatch(f.element('startup-description').textContent,/secret/);}
});
test('error actions require each explicit main-process permission',async()=>{
  const f=await fixture();await f.controller.ready;
  f.emit({state:'error',canRetry:true,canOpenCurrent:false});assert.equal(f.element('startup-retry').hidden,false);assert.equal(f.element('startup-open-current').hidden,true);await f.click('current');await f.click('retry');assert.deepEqual(f.calls,['retry']);
  f.emit({state:'error',canRetry:false,canOpenCurrent:true});await f.click('retry');await f.click('current');assert.deepEqual(f.calls,['retry','current']);
  f.emit({state:'error',canRetry:'true',canOpenCurrent:1});assert.equal(f.element('startup-actions').hidden,true);
});
test('action reentry is blocked and a later event wins over stale responses',async()=>{
  const pending=deferred();let retries=0;
  const f=await fixture({snapshot:{state:'error',canRetry:true,canOpenCurrent:true},overrides:{retry:()=>{retries++;return pending.promise;}}});await f.controller.ready;
  const action=f.click('retry');await f.click('retry');await f.click('current');assert.equal(retries,1);assert.deepEqual(f.calls,[]);
  f.emit({state:'downloading',progress:65});pending.resolve({state:'error',canRetry:true});await action;
  assert.equal(f.element('startup-update').dataset.state,'downloading');assert.equal(f.element('startup-percent').textContent,'65%');
});
test('subscription precedes initial request, ignores stale initial data and stops after disposal',async()=>{
  const initial=deferred(),f=await fixture({overrides:{getStatus:()=>initial.promise}});
  f.emit({state:'installing',platform:'win32'});initial.resolve({state:'checking'});await f.controller.ready;assert.equal(f.element('startup-update').dataset.state,'installing');
  f.controller.dispose();f.emit({state:'error'});assert.equal(f.element('startup-update').dataset.state,'installing');
});
test('safe errors never show raw messages, paths or account fields',async()=>{
  const f=await fixture();await f.controller.ready;
  for(const [code,expected] of [['UPDATE_NETWORK_FAILED',/인터넷 연결/],['UPDATE_STORAGE_FAILED',/저장 공간과 파일 권한/],['UPDATE_INTEGRITY_FAILED',/파일을 확인하지/],['UPDATE_INSTALL_FAILED',/설치를 마치지/],['UPDATE_HANDOFF_TIMEOUT',/설치를 마치지/],['UPDATE_RECOVERED',/이전 버전으로 돌아왔/],['UPDATE_RECOVERY_INVALID',/복구 정보를 확인하지/],['UPDATE_BUILD_MISMATCH',/구성이 달라/]]){
    f.emit({state:'error',code,canRetry:true,canOpenCurrent:true,message:'private-auth-token',path:'C:/private',account:{display_name:'private-person'}});
    assert.match(f.element('startup-description').textContent,expected);assert.doesNotMatch(f.element('startup-description').textContent,/private/);
  }
});
test('Mac ready opens only the installer bridge and clearly explains manual replacement',async()=>{
  const f=await fixture({snapshot:{state:'ready',platform:'darwin',canInstall:true,canOpenCurrent:true}});await f.controller.ready;
  assert.match(f.element('startup-description').textContent,/Applications/);assert.equal(f.element('startup-install').hidden,false);assert.equal(f.element('startup-retry').hidden,true);await f.click('install');assert.deepEqual(f.calls,['install']);
  f.emit({state:'ready',platform:'darwin',code:'UPDATE_MANUAL_INSTALL',canInstall:true,canOpenCurrent:true});assert.match(f.element('startup-title').textContent,/파일을 열었/);
  f.emit({state:'installing',platform:'darwin'});assert.doesNotMatch(f.element('startup-description').textContent,/자동으로/);
  f.emit({state:'ready',platform:'win32',canInstall:true});await f.click('install');assert.deepEqual(f.calls,['install']);
});
test('missing or failing startup capability gives a safe closed fallback',async()=>{
  const f=await fixture({native:false});await f.controller.ready;assert.equal(f.element('startup-actions').hidden,true);assert.match(f.element('startup-description').textContent,/앱을 종료한 뒤/);
  const g=await fixture({overrides:{getStatus:async()=>{throw Error('private failure');}}});await g.controller.ready;assert.equal(g.element('startup-update').dataset.state,'error');assert.doesNotMatch(g.element('startup-description').textContent,/private/);assert.deepEqual(g.calls,[]);
});
test('startup preload has five fixed operations without auth, raw IPC or renderer arguments',async()=>{
  const invokes=[],events=new Map();let exposed;
  const electron={contextBridge:{exposeInMainWorld(name,value){assert.equal(name,'synkStartupUpdate');exposed=value;}},ipcRenderer:{invoke:async(...args)=>{invokes.push(args);},on:(name,listener)=>events.set(name,listener),removeListener:(name,listener)=>{assert.equal(events.get(name),listener);events.delete(name);}}};
  const context={require:name=>{assert.equal(name,'electron');return electron;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/startup-update-preload.cjs'),'utf8'),context);
  assert.deepEqual(Object.keys(exposed),['getStatus','retry','openCurrent','install','onChanged']);assert.equal(Object.isFrozen(exposed),true);
  for(const name of ['getStatus','retry','openCurrent','install'])await exposed[name]('untrusted-url','private-token');
  assert.deepEqual(invokes,[['startup-update:status'],['startup-update:retry'],['startup-update:open-current'],['startup-update:install']]);
  let received;const unsubscribe=exposed.onChanged(value=>received=value);events.get('startup-update:changed')({private:'event'},{state:'checking'});assert.deepEqual(received,{state:'checking'});unsubscribe();assert.equal(events.size,0);assert.throws(()=>exposed.onChanged(null),/callback/);
});
