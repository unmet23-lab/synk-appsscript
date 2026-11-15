'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const loaded=import('../renderer/startup-update.mjs');
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {resolve,reject,promise};};
function create2dContext(stats={draws:0}){
  const gradient=()=>({addColorStop(){}});
  return {
    fillStyle:'#000000',
    strokeStyle:'#ffffff',
    lineWidth:1,
    globalCompositeOperation:'source-over',
    setTransform(){},
    fillRect(){stats.draws++;},
    save(){},
    restore(){},
    beginPath(){},
    arc(){},
    clip(){},
    fill(){},
    stroke(){},
    createRadialGradient:gradient,
  };
}
async function fixture({snapshot={state:'checking',currentVersion:'0.4.5',platform:'win32'},overrides={},native=true,reducedMotion=false,canvasContext=()=>null,viewport={width:560,height:440}}={}){
  const nodes=new Map(),calls=[],rafQueue=new Map(),focused=[];let callback,rafSeq=0,motionReduced=reducedMotion;
  const mediaListeners=new Set();
  const makeNode=(id='',tagName='DIV')=>({
    id,
    tagName,
    className:'',
    hidden:false,
    disabled:false,
    textContent:'',
    value:0,
    width:0,
    height:0,
    children:[],
    parentNode:null,
    dataset:{},
    attributes:{},
    handlers:{},
    setAttribute(key,value){this.attributes[key]=String(value);},
    getAttribute(key){return Object.hasOwn(this.attributes,key)?this.attributes[key]:null;},
    removeAttribute(key){delete this.attributes[key];},
    addEventListener(type,handler){this.handlers[type]=handler;},
    removeEventListener(type,handler){if(this.handlers[type]===handler)delete this.handlers[type];},
    append(...items){for(const item of items){item.parentNode=this;this.children.push(item);}},
    remove(){if(!this.parentNode)return;const idx=this.parentNode.children.indexOf(this);if(idx!==-1)this.parentNode.children.splice(idx,1);this.parentNode=null;},
    getBoundingClientRect(){return {width:viewport.width,height:viewport.height};},
    getContext(kind,attrs){return canvasContext(kind,attrs,this);},
    focus(){focused.push(this.id);},
  });
  const element=id=>{if(!nodes.has(id))nodes.set(id,makeNode(id));return nodes.get(id);};
  const win={
    innerWidth:viewport.width,
    innerHeight:viewport.height,
    devicePixelRatio:1,
    performance:{now:()=>1200},
    addEventListener(){},
    removeEventListener(){},
    requestAnimationFrame(fn){const id=++rafSeq;rafQueue.set(id,fn);return id;},
    cancelAnimationFrame(id){rafQueue.delete(id);},
    matchMedia(){return {get matches(){return motionReduced;},addEventListener(_t,fn){mediaListeners.add(fn);},removeEventListener(_t,fn){mediaListeners.delete(fn);}};},
  };
  const document={
    defaultView:win,
    hidden:false,
    getElementById:element,
    createElement:tag=>makeNode('',String(tag||'div').toUpperCase()),
    addEventListener(){},
    removeEventListener(){},
    documentElement:{dataset:{}},
  };
  const bridge={getStatus:async()=>snapshot,retry:async()=>{calls.push('retry');return snapshot;},openCurrent:async()=>{calls.push('current');return snapshot;},install:async()=>{calls.push('install');return snapshot;},onChanged:listener=>{callback=listener;return ()=>callback=null;},...overrides};
  const {mountStartupUpdate}=await loaded,controller=mountStartupUpdate({bridge:native?bridge:null,document,window:win});
  return {
    element,
    document,
    calls,
    focused,
    controller,
    pendingFrames:()=>rafQueue.size,
    setReducedMotion(next){motionReduced=next;for(const fn of mediaListeners)fn();},
    click:action=>element('startup-'+({current:'open-current'}[action]||action)).handlers.click?.(),
    emit:value=>{snapshot=value;callback?.(value);},
  };
}
test('checking, real download progress and installation never expose a skip or retry action',async()=>{
  const f=await fixture();await f.controller.ready;
  assert.match(f.element('startup-title').textContent,/최신 버전을 확인/);assert.equal(f.document.documentElement.dataset.startupReady,'true');
  assert.equal(f.element('startup-surface').dataset.visible,'false');
  for(const state of ['checking','downloading','installing']){
    f.emit({state,platform:'win32',currentVersion:'0.4.5',latestVersion:'0.4.6',progress:42.8,canRetry:true,canOpenCurrent:true,canInstall:true});
    assert.equal(f.element('startup-actions').hidden,true);await f.click('retry');await f.click('current');await f.click('install');
    assert.equal(f.element('startup-surface').dataset.visible,String(state!=='checking'));
    if(state==='downloading'){assert.equal(f.element('startup-progress').value,42.8);assert.equal(f.element('startup-percent').textContent,'42%');assert.equal(f.element('startup-progress-wrap').hidden,false);}
    else assert.equal(f.element('startup-progress-wrap').hidden,true);
  }
  assert.match(f.element('startup-description').textContent,/끝나면 저절로 열려요/);assert.deepEqual(f.calls,[]);
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
  for(const [code,expected] of [['UPDATE_NETWORK_FAILED',/인터넷 연결/],['UPDATE_STORAGE_FAILED',/PC 저장 공간을 비운 뒤/],['UPDATE_INTEGRITY_FAILED',/온전하지 않아요/],['UPDATE_INSTALL_FAILED',/설치를 마치지/],['UPDATE_HANDOFF_TIMEOUT',/설치를 마치지/],['UPDATE_RECOVERED',/이전 버전으로 돌아왔/],['UPDATE_RECOVERY_INVALID',/되돌린 기록을 읽지 못했어요/],['UPDATE_BUILD_MISMATCH',/버전이 맞지 않아요/]]){
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
  const f=await fixture({native:false});await f.controller.ready;assert.equal(f.element('startup-actions').hidden,true);assert.match(f.element('startup-description').textContent,/앱을 끈 뒤/);
  const g=await fixture({overrides:{getStatus:async()=>{throw Error('private failure');}}});await g.controller.ready;assert.equal(g.element('startup-update').dataset.state,'error');assert.doesNotMatch(g.element('startup-description').textContent,/private/);assert.deepEqual(g.calls,[]);
});
test('startup orb reuses portal-orb with non-WebGL fallback, reduced motion and clean disposal',async()=>{
  const staticView=await fixture();await staticView.controller.ready;
  assert.equal(staticView.element('startup-orb-stage').dataset.orbMode,'static');
  assert.equal(staticView.pendingFrames(),0);
  staticView.controller.dispose();

  const stats={draws:0};
  const liveOrb=await fixture({canvasContext:kind=>kind==='2d'?create2dContext(stats):null});await liveOrb.controller.ready;
  const stage=liveOrb.element('startup-orb-stage');
  assert.equal(stage.dataset.orbMode,'2d');
  assert.equal(stage.children.length,1);
  assert.equal(stage.children[0].attributes['aria-hidden'],'true');
  assert.ok(stats.draws>0);
  assert.equal(liveOrb.pendingFrames(),1);

  liveOrb.setReducedMotion(true);
  assert.equal(liveOrb.pendingFrames(),0);
  liveOrb.emit({state:'error',canRetry:true,canOpenCurrent:true});
  assert.equal(liveOrb.focused.at(-1),'startup-retry');

  liveOrb.controller.dispose();
  assert.equal(liveOrb.pendingFrames(),0);
  assert.equal(stage.children.length,0);
  assert.equal(stage.dataset.orbMode,undefined);

  const reducedFromStart=await fixture({reducedMotion:true,canvasContext:kind=>kind==='2d'?create2dContext():null,viewport:{width:360,height:400}});
  await reducedFromStart.controller.ready;
  assert.equal(reducedFromStart.element('startup-orb-stage').dataset.orbMode,'2d');
  assert.equal(reducedFromStart.pendingFrames(),0);
  reducedFromStart.controller.dispose();
});
test('startup markup and styles keep a decorative black-screen orb in checking while preserving screen-reader status',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../renderer/startup-update.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../renderer/startup-update.css'),'utf8');
  assert.match(html,/id="startup-orb-stage"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html,/<button[^>]*orb|startup-steps|class="brand"/);
  assert.match(html,/id="startup-update"[^>]*data-state="checking"[^>]*aria-labelledby="startup-title"/);
  assert.match(html,/class="message"[^>]*aria-live="polite"/);
  assert.match(html,/id="startup-progress-wrap"[^>]*hidden/);
  assert.match(html,/id="startup-actions"[^>]*hidden/);
  assert.match(css,/--bg:\s*#000000/);
  assert.match(css,/#startup-update\[data-state="checking"\]\s+\.startup-surface\s*\{[^}]*opacity:\s*0/);
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
  assert.match(css,/max-width:\s*420px/);
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
