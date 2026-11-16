'use strict';
// 시작 창 화면(renderer/startup-update.mjs) 시험. 1-가 구현 설계 8절 「시작 창 화면 시험」.
// 가짜 DOM과 가짜 구로 돌린다. 시간은 가짜 시계로 움직인다(실제로 기다리지 않는다).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const loaded=import('../renderer/startup-update.mjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const IDS=['startup-update','startup-orb','startup-orb-stage','startup-say','startup-then','startup-version','startup-percent','startup-actions','startup-retry','startup-install','startup-open-current','startup-minimize','startup-maximize','startup-close','startup-title'];

function fakeClock(start=1_000_000){
  let t=start,seq=0;const timers=new Map();
  return {
    now:()=>t,
    setTimeout(fn,ms){const id=++seq;timers.set(id,{at:t+Math.max(0,ms||0),fn});return id;},
    clearTimeout(id){timers.delete(id);},
    async advance(ms){const end=t+ms;for(;;){let next=null;for(const [id,v] of timers)if(v.at<=end&&(!next||v.at<next[1].at))next=[id,v];if(!next)break;timers.delete(next[0]);t=next[1].at;next[1].fn();await settle();}t=end;await settle();},
    pending:()=>timers.size,
  };
}
function fakeOrb(){
  const calls=[];let pose='void',moving=false;
  const rec=(name,...args)=>{calls.push([name,...args]);};
  return {calls,named:name=>calls.filter(c=>c[0]===name),
    api:{
      snap(name){rec('snap',name);pose=name;},
      tween(name,ms,_ease,_lit,opts){rec('tween',name,ms,opts?.elapsed||0);pose=name;return Promise.resolve();},
      setCut(v){rec('setCut',+v.toFixed(3));},setCutOn(on){rec('setCutOn',on);},forgeAt(p){rec('forgeAt',+p.toFixed(3));},setLit(v){rec('setLit',v);},
      setMood(m){rec('setMood',m);return Promise.resolve();},eyesAsleep(){rec('eyesAsleep');},eyesWake(){rec('eyesWake');return Promise.resolve();},
      setGlint(on){rec('setGlint',on);},setAz(v){rec('setAz',+v.toFixed(3));},eyesCalm(){rec('eyesCalm');},state(){return {az:0.5};},
      setPointer(){},dispose(){rec('dispose');},get pose(){return pose;},get moving(){return moving;},
    }};
}
function fakeDom({reduced=false}={}){
  const nodes=new Map(),focused=[],docListeners={};
  const node=id=>({id,hidden:false,disabled:false,textContent:'',dataset:{},attributes:{},handlers:{},
    setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k]??null;},
    addEventListener(type,fn){(this.handlers[type]=this.handlers[type]||[]).push(fn);},removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(f=>f!==fn);},
    fire(type,event={}){for(const fn of this.handlers[type]||[])fn(event);},focus(){focused.push(id);for(const fn of nodes.get('startup-actions').handlers.focusin||[])fn({});}});
  for(const id of IDS)nodes.set(id,node(id));
  const document={getElementById:id=>nodes.get(id)||null,documentElement:{dataset:reduced?{motion:'reduced'}:{}},
    addEventListener(type,fn){(docListeners[type]=docListeners[type]||[]).push(fn);},removeEventListener(type,fn){docListeners[type]=(docListeners[type]||[]).filter(f=>f!==fn);},
    fire(type,e={}){for(const fn of docListeners[type]||[])fn(e);},docListeners};
  return {document,nodes,focused,el:id=>nodes.get(id)};
}
async function fixture({snapshot={state:'checking',currentVersion:'0.4.95',platform:'win32'},bridge:override={},reduced=false,status=null}={}){
  const {mountStartupUpdate}=await loaded;
  const clock=fakeClock(),dom=fakeDom({reduced}),orb=fakeOrb(),calls=[];let push=null,pushWindow=null;
  const bridge={
    getStatus:async()=>{calls.push('getStatus');return status||snapshot;},
    retry:async()=>{calls.push('retry');return {...snapshot,state:'checking'};},
    openCurrent:async()=>{calls.push('openCurrent');return {...snapshot,canOpenCurrent:false};},
    install:async()=>{calls.push('install');return {...snapshot,state:'ready',code:'UPDATE_MANUAL_INSTALL'};},
    minimize:async()=>{calls.push('minimize');},toggleMaximize:async()=>{calls.push('toggleMaximize');},close:async()=>{calls.push('close');},
    onChanged:fn=>{push=fn;return ()=>{push=null;};},onWindowState:fn=>{pushWindow=fn;return ()=>{pushWindow=null;};},
    ...override,
  };
  const win={setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,innerWidth:1440,innerHeight:940,matchMedia:()=>({matches:reduced}),addEventListener(){},removeEventListener(){}};
  const view=mountStartupUpdate({bridge,document:dom.document,window:win,createOrb:()=>orb.api,now:clock.now});
  await view.ready;await settle();
  return {view,dom,orb,calls,clock,bridge,send:value=>{push?.(value);},sendWindow:value=>pushWindow?.(value)};
}
const visibleActions=f=>['startup-retry','startup-install','startup-open-current'].filter(id=>!f.dom.el(id).hidden);

test('checking shows only the orb: no visible actions, screen-reader status and busy state',async()=>{
  const f=await fixture({snapshot:{state:'checking',platform:'win32',boot:{startedAt:1_000_000-200,kind:'back'}}});
  assert.equal(f.dom.el('startup-update').dataset.ui,undefined);
  assert.equal(f.dom.el('startup-update').getAttribute('aria-busy'),'true');
  assert.equal(f.dom.el('startup-say').textContent,'새 판을 확인하고 있습니다.');
  assert.deepEqual(visibleActions(f),[]);assert.equal(f.dom.el('startup-actions').hidden,true);
  assert.equal(f.dom.el('startup-version').textContent,'');
});

test('the reveal follows the main process start time and kind, so a late window continues the same path',async()=>{
  // 날마다 켤 때(back): 300ms 기다린 뒤 1150ms 동안 드러난다. 창이 500ms 늦게 떴으면 길의 200ms 지점에서 이어 그린다
  const f=await fixture({snapshot:{state:'checking',platform:'win32',boot:{startedAt:1_000_000-500,kind:'back'}}});
  assert.deepEqual(f.orb.named('tween')[0],['tween','rest',1150,200]);
  await f.clock.advance(1000);
  assert.ok(f.orb.named('eyesAsleep').length>=1&&f.orb.named('eyesWake').length>=1,'eyes fall asleep and wake during the reveal');
  // 처음 켤 때(first)는 520ms 기다린 뒤 2400ms다. 이미 다 지났으면 드러난 채로 선다
  const g=await fixture({snapshot:{state:'checking',platform:'win32',boot:{startedAt:1_000_000-9000,kind:'first'}}});
  assert.equal(g.orb.named('tween').length,0);assert.ok(g.orb.named('snap').some(c=>c[1]==='rest'));
});

test('downloading enters the grand forge scene, shows the version and never moves the cut backwards',async()=>{
  const f=await fixture();
  f.send({state:'downloading',platform:'win32',progress:0,latestVersion:'0.4.96',currentVersion:'0.4.95'});await settle();
  assert.equal(f.dom.el('startup-update').dataset.ui,'forge');
  assert.ok(f.orb.named('setCutOn').some(c=>c[1]===true));assert.ok(f.orb.named('tween').some(c=>c[1]==='forge'&&c[2]===2300));
  assert.equal(f.dom.el('startup-say').textContent,'새 판을 받고 있습니다.');assert.equal(f.dom.el('startup-version').textContent,'0.4.96');
  f.send({state:'downloading',platform:'win32',progress:60,latestVersion:'0.4.96'});await f.clock.advance(5000);
  const cuts=f.orb.named('forgeAt').map(c=>c[1]);assert.ok(cuts.length>0);assert.ok(Math.max(...cuts)<=0.3+1e-9,'download fills only the first half');
  for(let i=1;i<cuts.length;i++)assert.ok(cuts[i]>=cuts[i-1],'never backwards');
  // 받은 값이 줄어도 깎인 만큼은 뒤로 가지 않는다
  const before=cuts.at(-1);f.send({state:'downloading',platform:'win32',progress:10,latestVersion:'0.4.96'});await f.clock.advance(500);
  assert.ok(f.orb.named('forgeAt').every(c=>c[1]>=0)&&f.orb.named('forgeAt').at(-1)[1]>=before);
  assert.match(f.dom.el('startup-percent').textContent,/^ · \d+%$/);assert.deepEqual(visibleActions(f),[]);
});

test('the cut follows the received value no faster than the set speed',async()=>{
  const {FORGE_FOLLOW_PER_SECOND}=await loaded;
  const f=await fixture();
  f.send({state:'downloading',platform:'win32',progress:100,latestVersion:'0.4.96'});await settle();
  await f.clock.advance(1000);
  const p=f.orb.named('forgeAt').at(-1)?.[1]||0;assert.ok(p<=FORGE_FOLLOW_PER_SECOND*1.2+1e-6,'one second moves at most the set speed: '+p);
});

test('Windows handoff says the new version is being swapped in and offers no action',async()=>{
  const f=await fixture();
  f.send({state:'installing',platform:'win32',latestVersion:'0.4.96'});await settle();
  assert.equal(f.dom.el('startup-say').textContent,'새 판으로 바꾸고 있습니다.');assert.equal(f.dom.el('startup-then').textContent,'끝나면 저절로 열립니다.');
  assert.deepEqual(visibleActions(f),[]);
});

test('failure scenes use safe sentences chosen by code, never raw messages or paths',async()=>{
  const {copy}=await loaded;
  const cases={
    UPDATE_STORAGE_FAILED:'PC 저장 공간이 모자라 새 판을 받지 못했습니다.',
    UPDATE_INTEGRITY_FAILED:'받은 새 판이 온전하지 않아 쓰지 않았습니다.',UPDATE_INVALID_ARTIFACT:'받은 새 판이 온전하지 않아 쓰지 않았습니다.',
    UPDATE_HANDOFF_TIMEOUT:'새 판으로 바꾸지 못했습니다.',UPDATE_OPEN_FAILED:'새 판으로 바꾸지 못했습니다.',UPDATE_RECOVERED:'새 판으로 바꾸지 못했습니다.',
    UPDATE_BUILD_MISMATCH:'이 앱은 저절로 새 판으로 바뀌지 않습니다.',UPDATE_SIGNATURE_INVALID:'새 판을 확인하지 못했습니다.',UPDATE_HTTP_FAILED:'새 판을 확인하지 못했습니다.',
  };
  for(const [code,say] of Object.entries(cases))assert.equal(copy({state:'error',code}).say,say,code);
  assert.equal(copy({state:'error',code:'UPDATE_NETWORK_FAILED',stage:'download'}).say,'새 판을 받지 못했습니다.');
  const f=await fixture();
  f.send({state:'error',code:'UPDATE_FAILED',message:'C:\\Users\\secret\\x.exe failed',email:'a@b.c',platform:'win32',canRetry:true,canOpenCurrent:true,currentVersion:'0.4.95'});await settle();
  const text=f.dom.el('startup-say').textContent+f.dom.el('startup-then').textContent;
  assert.doesNotMatch(text,/secret|a@b\.c|\\/);assert.deepEqual(visibleActions(f),['startup-retry','startup-open-current']);
  assert.equal(f.dom.el('startup-open-current').textContent,'지금 판 열기');assert.equal(f.dom.el('startup-version').textContent,'0.4.95');
  // 판이 맞지 않는 앱은 다시 시도하지 않고 지금 판만 연다
  f.send({state:'error',code:'UPDATE_BUILD_MISMATCH',platform:'win32',canRetry:true,canOpenCurrent:true});await settle();
  assert.deepEqual(visibleActions(f),['startup-open-current']);
});

test('a failure opens the current version by itself after a while unless a hand or focus reached the buttons',async()=>{
  const {AUTO_OPEN_MS}=await loaded;
  const f=await fixture();
  f.send({state:'error',code:'UPDATE_HANDOFF_FAILED',platform:'win32',canRetry:true,canOpenCurrent:true});await settle();
  assert.ok(f.dom.focused.length>0,'first action receives focus for screen readers');
  await f.clock.advance(AUTO_OPEN_MS-50);assert.equal(f.calls.filter(c=>c==='openCurrent').length,0);
  await f.clock.advance(100);assert.equal(f.calls.filter(c=>c==='openCurrent').length,1);
  const g=await fixture();
  g.send({state:'error',code:'UPDATE_HANDOFF_FAILED',platform:'win32',canRetry:true,canOpenCurrent:true});await settle();
  g.dom.el('startup-actions').fire('pointerenter');await g.clock.advance(AUTO_OPEN_MS*2);assert.equal(g.calls.filter(c=>c==='openCurrent').length,0);
  const h=await fixture();
  h.send({state:'error',code:'UPDATE_HANDOFF_FAILED',platform:'win32',canRetry:true,canOpenCurrent:true});await settle();
  h.dom.document.fire('keydown',{key:'Tab'});await h.clock.advance(AUTO_OPEN_MS*2);assert.equal(h.calls.filter(c=>c==='openCurrent').length,0);
});

test('Mac ready waits for the person: install file or current version, no automatic opening',async()=>{
  const {AUTO_OPEN_MS}=await loaded;
  const f=await fixture();
  f.send({state:'ready',platform:'darwin',canInstall:true,canOpenCurrent:true,latestVersion:'0.4.96'});await settle();
  assert.equal(f.dom.el('startup-say').textContent,'새 판을 받았습니다.');assert.deepEqual(visibleActions(f),['startup-install','startup-open-current']);
  assert.ok(f.orb.named('forgeAt').some(c=>c[1]===0.5),'the orb stops half cut');
  await f.clock.advance(AUTO_OPEN_MS*2);assert.equal(f.calls.filter(c=>c==='openCurrent').length,0);
  f.dom.el('startup-install').fire('click');await settle();await settle();assert.equal(f.calls.filter(c=>c==='install').length,1);
});

test('action reentry is blocked while a request is pending',async()=>{
  let release;const f=await fixture({bridge:{retry:()=>new Promise(resolve=>{release=resolve;})}});
  f.send({state:'error',code:'UPDATE_HTTP_FAILED',platform:'win32',canRetry:true,canOpenCurrent:true});await settle();
  f.dom.el('startup-retry').fire('click');f.dom.el('startup-retry').fire('click');f.dom.el('startup-open-current').fire('click');await settle();
  assert.equal(f.dom.el('startup-retry').disabled,true);release({state:'checking',platform:'win32'});await settle();await settle();
  assert.equal(f.dom.el('startup-update').dataset.state,'checking');
});

test('a missing or failing bridge gives a safe failure scene and the orb still appears',async()=>{
  const f=await fixture({bridge:{getStatus:undefined}});
  assert.equal(f.dom.el('startup-update').dataset.state,'error');assert.equal(f.dom.el('startup-say').textContent,'화면을 불러오지 못했습니다.');
  assert.ok(f.orb.named('snap').length>0);
  const g=await fixture({bridge:{getStatus:async()=>{throw Error('x');}}});
  assert.equal(g.dom.el('startup-update').dataset.state,'error');
});

test('window buttons call fixed operations without arguments and follow the maximized state',async()=>{
  const f=await fixture({snapshot:{state:'checking',platform:'win32',window:{maximized:true}}});
  assert.equal(f.dom.el('startup-maximize').dataset.maximized,'true');
  f.dom.el('startup-minimize').fire('click');f.dom.el('startup-maximize').fire('click');f.dom.el('startup-close').fire('click');await settle();
  assert.deepEqual(f.calls.filter(c=>['minimize','toggleMaximize','close'].includes(c)),['minimize','toggleMaximize','close']);
  f.sendWindow({maximized:false});assert.equal(f.dom.el('startup-maximize').dataset.maximized,'false');
});

test('dispose stops the timers, listeners and the orb',async()=>{
  const f=await fixture();
  f.send({state:'error',code:'UPDATE_HANDOFF_FAILED',platform:'win32',canRetry:true,canOpenCurrent:true});await settle();
  f.view.dispose();assert.ok(f.orb.named('dispose').length===1);
  const {AUTO_OPEN_MS}=await loaded;await f.clock.advance(AUTO_OPEN_MS*2);assert.equal(f.calls.filter(c=>c==='openCurrent').length,0);
});

test('markup and styles: black window, decorative orb canvas, grand lower-left text and same window buttons as the app',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../renderer/startup-update.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../renderer/startup-update.css'),'utf8');
  for(const id of IDS)assert.match(html,new RegExp('id="'+id+'"'),id);
  assert.match(html,/id="startup-orb-stage"[^>]*aria-hidden="true"/);assert.doesNotMatch(html,/<progress/);
  assert.match(css,/--void: #000000/);assert.match(css,/\.forge-in \{[^}]*left: clamp\(20px, 9\.5vw, 168px\);[^}]*bottom: clamp\(84px, 13vh, 128px\)/s);
  assert.match(css,/\.startup-window-actions button \{[^}]*width: 44px;[^}]*height: 32px/s);assert.match(css,/-webkit-app-region: drag/);
});

test('startup preload has nine fixed operations without auth, raw IPC or renderer arguments',async()=>{
  const vm=require('node:vm');const invokes=[],events=new Map();let exposed;
  const electron={contextBridge:{exposeInMainWorld(name,value){assert.equal(name,'synkStartupUpdate');exposed=value;}},ipcRenderer:{invoke:async(...args)=>{invokes.push(args);},on:(name,listener)=>events.set(name,listener),removeListener:(name,listener)=>{assert.equal(events.get(name),listener);events.delete(name);}}};
  const context={require:name=>{assert.equal(name,'electron');return electron;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/startup-update-preload.cjs'),'utf8'),context);
  assert.deepEqual(Object.keys(exposed),['getStatus','retry','openCurrent','install','minimize','toggleMaximize','close','onChanged','onWindowState']);assert.equal(Object.isFrozen(exposed),true);
  for(const name of ['getStatus','retry','openCurrent','install','minimize','toggleMaximize','close'])await exposed[name]('untrusted-url','private-token');
  assert.deepEqual(invokes,[['startup-update:status'],['startup-update:retry'],['startup-update:open-current'],['startup-update:install'],['startup-update:minimize'],['startup-update:toggle-maximize'],['startup-update:close']]);
  let received;const unsubscribe=exposed.onChanged(value=>received=value);events.get('startup-update:changed')({private:'event'},{state:'checking'});assert.deepEqual(received,{state:'checking'});unsubscribe();
  let windowState;const off=exposed.onWindowState(value=>windowState=value);events.get('startup-update:window-state')({},{maximized:true});assert.deepEqual(windowState,{maximized:true});off();
  assert.equal(events.size,0);assert.throws(()=>exposed.onChanged(null),/callback/);
});

test('the startup window and the app window reveal the orb on one timeline, eyes included',async()=>{
  // 시작 창이 그리던 드러남을 앱 창이 잇는다. 두 창의 시간값이 다르면 넘기는 순간 구가 튄다(1-가 구현 설계 2절)
  const {ORB_BOOT}=await loaded,{ORB_TIMING,ORB_LOOK}=await import('../renderer/orb-face.mjs');
  for(const kind of ['first','back']){
    assert.equal(ORB_BOOT[kind].delay,ORB_TIMING.introDelay[kind],kind+' delay');assert.equal(ORB_BOOT[kind].ms,ORB_TIMING.intro[kind],kind+' ms');
    assert.equal(ORB_BOOT[kind].asleepAt,ORB_TIMING.eyesAsleep[kind],kind+' asleep');assert.equal(ORB_BOOT[kind].wakeAt,ORB_TIMING.eyesWake[kind],kind+' wake');
  }
  assert.equal(ORB_LOOK.eyes,true);
});

// 앱 창 위에 덮어 띄운 넘김 장면(1-가 구현 설계 2절 「보이는 업데이트」): 받기가 끝난 절반 깎인 구와 글이 바로 놓이고, 옛 결을 지우는 움직임이 없다
test('the handoff cover starts at the half-carved orb with its text already in place',async()=>{
  const f=await fixture({snapshot:{state:'installing',platform:'win32',currentVersion:'0.4.96',latestVersion:'0.4.97',boot:{kind:'handoff',startedAt:1_000_000}}});
  assert.deepEqual(f.orb.calls.slice(0,4),[['forgeAt',0.5],['setCutOn',true],['snap','forge'],['eyesAsleep']]);
  assert.equal(f.orb.named('setCut').length,0,'no erase from a fresh orb');assert.equal(f.orb.named('tween').length,0);
  assert.equal(f.dom.el('startup-update').dataset.ui,'forge');assert.equal(f.dom.el('startup-update').dataset.instant,'true');
  assert.equal(f.dom.el('startup-say').textContent,'새 판으로 바꾸고 있습니다.');assert.equal(f.dom.el('startup-percent').textContent,' · 50%');
  assert.equal(f.dom.el('startup-version').textContent,'0.4.97');
  f.view.dispose();
});
// 업데이트 뒤 새 앱의 첫 장면(6절, 시안 forgeDone): 설치기 창의 마지막 장에서 이어 빛이 오르며 한 바퀴 돌고, 눈을 뜨고, 잠깐 웃은 뒤 쉬는 자리로 간다
test('after an update the start window continues from the last carved frame and turns once in light',async()=>{
  const {ARRIVE,ARRIVE_SCENE_MS}=await loaded;
  assert.equal(ARRIVE_SCENE_MS,4130,'main.cjs ARRIVE_SCENE_MS must match');
  const f=await fixture({snapshot:{state:'checking',platform:'win32',currentVersion:'0.4.97',boot:{kind:'arrive',startedAt:1_000_000,cut:1,lit:0.58}}});
  assert.deepEqual(f.orb.calls.slice(0,8),[['forgeAt',1],['setCutOn',true],['snap','forge'],['setLit',0.58],['eyesAsleep'],['setCut',1],['setCutOn',false],['setGlint',true]]);
  assert.equal(f.orb.named('snap').some(c=>c[1]==='void'),false,'the orb never drops back to black');
  await f.clock.advance(ARRIVE.eyesWakeAt);assert.equal(f.orb.named('eyesWake').length,1);
  await f.clock.advance(ARRIVE.smileAt-ARRIVE.eyesWakeAt);assert.deepEqual(f.orb.named('setMood').map(c=>c[1]),['smile']);
  await f.clock.advance(ARRIVE.turn-ARRIVE.smileAt+20);
  const az=f.orb.named('setAz');assert.ok(az.length>50,'turns frame by frame');assert.equal(az.at(-1)[1],0.5,'ends where it began');
  assert.deepEqual(f.orb.named('setGlint').at(-1),['setGlint',false]);assert.deepEqual(f.orb.named('setLit').at(-1),['setLit',1]);
  assert.ok(Math.max(...f.orb.named('setLit').map(c=>c[1]))>1.05,'the light rises above full before settling');
  await f.clock.advance(ARRIVE.hold);assert.deepEqual(f.orb.named('tween').at(-1),['tween','rest',ARRIVE.settle,0]);
  f.view.dispose();
});
test('an arrival that is already over just rests',async()=>{
  const f=await fixture({snapshot:{state:'checking',platform:'win32',currentVersion:'0.4.97',boot:{kind:'arrive',startedAt:1_000_000-10_000,cut:1,lit:0.58}}});
  assert.deepEqual(f.orb.calls,[['setCutOn',false],['setLit',1],['snap','rest'],['eyesCalm']]);
  f.view.dispose();
});
