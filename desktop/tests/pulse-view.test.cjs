'use strict';
// 검정 구 3단계 구현 설계 2.2 · 3절: PULSE 화면을 플랫폼 창 안의 뷰로 붙이는 자리와 창을 닫기 전에 PULSE에 묻는 문.
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createPulseViewHost,pulseViewPlacement}=require('../src/pulse-view.cjs');

function fakeContents(){
  const c=new EventEmitter();
  Object.assign(c,{destroyed:false,focused:false,zoom:1,audible:false,captured:false,loads:[],closes:[],
    isDestroyed(){return this.destroyed;},isFocused(){return this.focused;},focus(){this.focused=true;c.focusCount=(c.focusCount||0)+1;},
    getZoomFactor(){return this.zoom;},isCurrentlyAudible(){return this.audible;},isBeingCaptured(){return this.captured;},
    loadURL(url){this.loads.push(url);return Promise.resolve();},
    // beforeunload: 쓰던 글이 없으면 바로 닫히고, 있으면 will-prevent-unload를 낸다. 귀가 막으면(나가기) 닫힌다
    close(options){this.closes.push(options||null);if(this.destroyed)return;
      if(options?.waitForBeforeUnload&&this.dirty){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};this.emit('will-prevent-unload',event);if(!event.defaultPrevented)return;}
      this.destroyed=true;this.emit('destroyed');}});
  return c;
}
function harness({zoom=1}={}){
  const views=[],changes=[],bands=[],hidden=[];
  class View{constructor(options){this.options=options;this.visible=true;this.bounds=null;this.background=null;this.webContents=fakeContents();views.push(this);}
    setBackgroundColor(v){this.background=v;}setVisible(v){this.visible=v;}getVisible(){return this.visible;}setBounds(b){this.bounds=b;}}
  const win=new EventEmitter();
  Object.assign(win,{destroyed:false,minimized:false,visible:true,focused:true,size:[1440,940],children:[],shows:0,focuses:0,restores:0,closes:0,
    webContents:Object.assign(fakeContents(),{zoom}),
    contentView:{addChildView(v){win.children.push(v);},removeChildView(v){win.children=win.children.filter(x=>x!==v);}},
    isDestroyed(){return this.destroyed;},isMinimized(){return this.minimized;},isVisible(){return this.visible;},isFocused(){return this.focused;},
    restore(){this.minimized=false;this.restores++;},show(){this.visible=true;this.shows++;},focus(){this.focuses++;},getContentSize(){return this.size;},
    close(){this.closes++;const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};this.emit('close',event);if(!event.defaultPrevented){this.destroyed=true;this.emit('closed');}}});
  let window=win;
  const host=createPulseViewHost({WebContentsView:View,getWindow:()=>window,onChange:value=>changes.push(value),onFocusBand:()=>bands.push(1),onHidden:()=>hidden.push(1),exitAnswerMs:50});
  return {host,views,win,changes,bands,hidden,setWindow(value){window=value;}};
}
const surfaceOptions={backgroundColor:'#000000',webPreferences:{sandbox:true,contextIsolation:true}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('placement takes exactly {visible, top} with a band of 0 to 160 CSS px',()=>{
  assert.deepEqual(pulseViewPlacement({visible:true,top:56}),{visible:true,top:56});
  assert.deepEqual(pulseViewPlacement({visible:false,top:0}),{visible:false,top:0});
  for(const bad of [null,[],'x',{visible:true},{top:56},{visible:'true',top:56},{visible:true,top:-1},{visible:true,top:161},{visible:true,top:NaN},{visible:true,top:56,extra:1},Object.create({visible:true,top:56}),{get visible(){return true;},top:56}])
    assert.equal(pulseViewPlacement(bad),null,JSON.stringify(bad));
});

test('a surface is added hidden, black, with the given preferences; show() and focus() only bring the platform window forward',()=>{
  const h=harness();const s=h.host.createSurface(surfaceOptions);const v=h.views[0];
  assert.equal(v.visible,false);assert.equal(v.background,'#000000');assert.deepEqual(v.options,{webPreferences:surfaceOptions.webPreferences});
  assert.deepEqual(h.win.children,[v]);assert.equal(s.webContents,v.webContents);assert.equal(s.dialogParent(),h.win);
  assert.deepEqual(h.changes,[{open:true}]);
  h.win.minimized=true;h.win.visible=false;s.show();s.focus();
  assert.equal(v.visible,false,'show never shows the view');assert.equal(h.win.restores,1);assert.equal(h.win.shows,1);assert.equal(h.win.focuses,1);
  assert.throws(()=>h.host.createSurface(surfaceOptions),/PULSE_VIEW_BUSY/);
});

test('without a platform window no surface is made',()=>{
  const h=harness();h.setWindow(null);assert.throws(()=>h.host.createSurface(surfaceOptions),/PULSE_VIEW_NO_WINDOW/);
  h.setWindow({isDestroyed:()=>true});assert.throws(()=>h.host.createSurface(surfaceOptions),/PULSE_VIEW_NO_WINDOW/);
});

test('the screen places the view under the band times the zoom, and a resize or a zoom change places it again',()=>{
  const h=harness({zoom:1.25});h.host.createSurface(surfaceOptions);const v=h.views[0];
  assert.deepEqual(h.host.place({visible:true,top:56}),{ok:true,open:true});
  assert.deepEqual(v.bounds,{x:0,y:70,width:1440,height:870});assert.equal(v.visible,true);
  assert.equal(v.webContents.focusCount,undefined,'showing never moves the focus; the screen asks with focusView (설계 검토 R3)');
  h.win.size=[960,680];h.win.emit('resize');assert.deepEqual(v.bounds,{x:0,y:70,width:960,height:610});
  h.win.webContents.zoom=1;h.host.relayout();assert.deepEqual(v.bounds,{x:0,y:56,width:960,height:624});
  assert.deepEqual(h.host.place({visible:true,top:200}),{ok:false,code:'INVALID_INPUT'});assert.equal(v.visible,true);
  // 숨길 때 뷰에 있던 초점은 플랫폼 화면에 돌려준다
  v.webContents.focused=true;h.host.place({visible:false,top:56});assert.equal(v.visible,false);assert.equal(h.win.webContents.focusCount,1);
  h.host.place({visible:true,top:56});assert.equal(v.visible,true);assert.equal(v.webContents.focusCount,undefined);
});

test('a new platform document or a lost platform renderer hides the view; the view stays alive',()=>{
  const h=harness();h.host.createSurface(surfaceOptions);const v=h.views[0];h.host.place({visible:true,top:56});
  h.win.webContents.emit('did-start-navigation',{isMainFrame:true,isSameDocument:true});assert.equal(v.visible,true,'a move inside the same document keeps it');
  h.win.webContents.emit('did-start-navigation',{isMainFrame:false,isSameDocument:false});assert.equal(v.visible,true,'a subframe keeps it');
  h.win.webContents.emit('did-start-navigation',{isMainFrame:true,isSameDocument:false});assert.equal(v.visible,false);
  assert.equal(h.hidden.length,1,'main tells the screen it hid the view, so the screen sends its placement again (설계 검토 R13)');
  h.host.place({visible:true,top:56});h.win.webContents.emit('render-process-gone',{},{reason:'crashed'});assert.equal(v.visible,false);assert.equal(h.hidden.length,2);
  h.win.webContents.emit('render-process-gone',{},{reason:'crashed'});assert.equal(h.hidden.length,2,'an already hidden view is not reported again');
  assert.equal(h.host.hasSurface(),true);assert.equal(v.webContents.closes.length,0);
});

test('a closed or lost view ends the surface once; destroy() closes without asking; a closed window closes the view',()=>{
  const h=harness();let s=h.host.createSurface(surfaceOptions),closed=0;s.once('closed',()=>closed++);
  h.views[0].webContents.emit('render-process-gone',{},{reason:'crashed'});
  assert.equal(closed,1);assert.equal(s.isDestroyed(),true);assert.deepEqual(h.win.children,[]);assert.deepEqual(h.changes.at(-1),{open:false});assert.deepEqual(h.views[0].webContents.closes,[null]);
  s=h.host.createSurface(surfaceOptions);const c=h.views[1].webContents;c.dirty=true;let n=0;s.on('closed',()=>n++);s.destroy();s.destroy();
  assert.equal(n,1);assert.deepEqual(c.closes,[null],'no beforeunload question on destroy');assert.equal(c.destroyed,true);
  s=h.host.createSurface(surfaceOptions);const d=h.views[2].webContents;d.dirty=true;h.win.destroyed=true;h.win.emit('closed');
  assert.equal(s.isDestroyed(),true);assert.deepEqual(d.closes,[null]);assert.equal(h.host.hasSurface(),false);
});

test('F6 inside PULSE goes to the band; F6 with a modifier or a repeat stays in PULSE',()=>{
  const h=harness();h.host.createSurface(surfaceOptions);const c=h.views[0].webContents;
  const press=input=>{const event={prevented:false,preventDefault(){this.prevented=true;}};c.emit('before-input-event',event,{type:'keyDown',key:'F6',...input});return event.prevented;};
  assert.equal(press({}),true);assert.equal(h.bands.length,1);assert.equal(h.win.webContents.focusCount,1);
  for(const extra of [{shift:true},{control:true},{alt:true},{meta:true},{isAutoRepeat:true},{type:'keyUp'},{key:'F5'}])assert.equal(press(extra),false,JSON.stringify(extra));
  assert.equal(h.bands.length,1);
  assert.deepEqual(h.host.focusView(),{ok:false,code:'PULSE_VIEW_HIDDEN'});h.host.place({visible:true,top:56});c.focusCount=0;assert.deepEqual(h.host.focusView(),{ok:true});assert.equal(c.focusCount,1);
});

test('busy while the view plays sound or is captured, for the tray memory trim',()=>{
  const h=harness();assert.equal(h.host.busy(),false);h.host.createSurface(surfaceOptions);const c=h.views[0].webContents;
  assert.equal(h.host.busy(),false);c.audible=true;assert.equal(h.host.busy(),true);c.audible=false;c.captured=true;assert.equal(h.host.busy(),true);
});

// 3절: 창이 정말 닫히기 전에 PULSE를 먼저 닫으며 묻는다
function gated({dirty=false,answer=null,quitting=false}={}){
  const h=harness();const s=h.host.createSurface(surfaceOptions),c=h.views[0].webContents;c.dirty=dirty;
  // PULSE 관리자의 쓰던 글 확인이 먼저 달린 귀다. answer 'leave'면 막는다(나가기), 'stay'면 두고, null이면 묻지 않는다
  const asked=[];c.on('will-prevent-unload',event=>{asked.push(1);if(answer==='leave')event.preventDefault();});
  const calls={quit:0,kept:0};let isQuitting=quitting;
  h.host.installCloseGate(h.win,{quitting:()=>isQuitting,quit:()=>{calls.quit++;},onKept:()=>{calls.kept++;}});
  return {...h,s,c,asked,calls,setQuitting(v){isQuitting=v;}};
}
test('a tray hide or a Windows session end passes the gate untouched',()=>{
  const g=gated({dirty:true});
  // 트레이가 먼저 달려 막았다
  const event={defaultPrevented:true,preventDefault(){}};g.win.emit('close',event);assert.deepEqual(g.c.closes,[]);
  // 세션이 끝나면 묻지 않는다. 창이 닫히며 남은 PULSE를 묻지 않고 닫는다
  g.win.emit('session-end');g.win.close();assert.deepEqual(g.c.closes,[null],'the session end never asks');assert.equal(g.win.destroyed,true);assert.equal(g.asked.length,0);
});
test('closing with no draft closes PULSE first, then closes the window again; while quitting it quits again',async()=>{
  const g=gated();g.win.close();assert.equal(g.win.destroyed,false,'the first close waits for PULSE');
  assert.deepEqual(g.c.closes,[{waitForBeforeUnload:true}]);await tick();
  assert.equal(g.win.closes,2);assert.equal(g.win.destroyed,true);assert.equal(g.calls.quit,0);
  const q=gated({quitting:true});q.win.close();await tick();assert.equal(q.calls.quit,1);assert.equal(q.win.closes,1);assert.equal(q.calls.kept,0);
});
test('a draft and 「저장 없이 나가기」 closes PULSE and goes on; 「돌아가서 저장」 keeps both and calls onKept',async()=>{
  const leave=gated({dirty:true,answer:'leave',quitting:true});leave.win.close();await tick();
  assert.equal(leave.asked.length,1);assert.equal(leave.c.destroyed,true);assert.equal(leave.calls.quit,1);assert.equal(leave.calls.kept,0);
  const stay=gated({dirty:true,answer:'stay',quitting:true});stay.win.close();await tick();
  assert.equal(stay.asked.length,1);assert.equal(stay.c.destroyed,false);assert.equal(stay.win.destroyed,false);assert.equal(stay.calls.quit,0);assert.equal(stay.calls.kept,1);
  assert.equal(stay.host.hasSurface(),true);
});
test('a second close while PULSE is being asked asks once',async()=>{
  const g=gated({dirty:true});let release;g.c.close=function(options){this.closes.push(options);release=()=>{this.destroyed=true;this.emit('destroyed');};};
  g.win.close();g.win.close();assert.equal(g.c.closes.length,1);release();await tick();await tick();assert.equal(g.win.destroyed,true);
});
test('no answer from PULSE within the bound keeps the window: a draft is never dropped by a silent page',async()=>{
  const g=gated({dirty:true,quitting:true});g.c.close=function(options){this.closes.push(options);};
  g.win.close();await new Promise(resolve=>setTimeout(resolve,80));assert.equal(g.calls.kept,1);assert.equal(g.calls.quit,0);assert.equal(g.win.destroyed,false);
});
test('without a surface the gate does nothing',()=>{
  const h=harness();h.host.installCloseGate(h.win,{quitting:()=>false,quit:()=>{}});h.win.close();assert.equal(h.win.destroyed,true);
});
test('preload passes only {visible, top} to main and listens on the two PULSE view channels; main keeps the three channels in its checked handler table',async()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  let bridge;const calls=[],listened=[];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};},on:channel=>listened.push(channel),removeListener(){}}})});
  const plain=value=>JSON.parse(JSON.stringify(value));
  const v=bridge.pulseView;assert.deepEqual(plain(Object.keys(v)),['place','state','focus','close','open','onChanged','onEvent']);
  await v.place({visible:true,top:56,extra:'x'});assert.deepEqual(plain(calls.at(-1)),['synk:pulse-view-place',{visible:true,top:56}]);
  for(const bad of [null,{visible:1,top:56},{visible:true,top:'56'},{visible:true,top:999}]){const n=calls.length;assert.deepEqual(plain(await v.place(bad)),{ok:false,code:'INVALID_INPUT'});assert.equal(calls.length,n);}
  await v.state();await v.focus();assert.deepEqual(calls.slice(-2).map(c=>c[0]),['synk:pulse-view-state','synk:pulse-view-focus']);
  v.onChanged(()=>{});v.onEvent(()=>{});assert.deepEqual(listened,['synk:pulse-view-changed','synk:pulse-view-event']);
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
  for(const channel of ['synk:pulse-view-place','synk:pulse-view-state','synk:pulse-view-focus'])assert.match(main,new RegExp(`'${channel}':`),channel);
  // 처리기 표는 assertSender를 지나야만 부른다(플랫폼 창의 주 프레임만)
  assert.match(main,/for\(const \[channel,handler\]of Object\.entries\(handlers\)\)\{ipcMain\.removeHandler\(channel\);ipcMain\.handle\(channel,async\(event,\.\.\.args\)=>\{assertSender\(event,window,entry,runtime\.clientId\);/);
  assert.match(main,/pulseView\.installCloseGate\(window,\{quitting:\(\)=>quittingRequested,quit:\(\)=>setImmediate\(\(\)=>app\.quit\(\)\),onKept:\(\)=>\{if\(quittingRequested\)\{quittingRequested=false;platformTray\?\.cancelQuit\(\);startupWindow\?\.cancelQuit\(\);platformUpdate\?\.cancelInstall\(\);startupGate\?\.cancelInstall\(\);\}/,'keeping PULSE cancels the quit and the update install, also when PULSE never answered');
  assert.match(main,/'synk:pulse-view-close':\(\)=>isPlatform&&pulseView\?pulseView\.closeByPerson\(\):/);
  assert.ok(main.indexOf('platformTray?.attachWindow(window);')<main.indexOf('pulseView.installCloseGate(window'),'the gate listens after the tray');
});

test('a view that held the focus gives it back to the platform screen when it closes (설계 검토 R9)',()=>{
  const h=harness();const s=h.host.createSurface(surfaceOptions);const c=h.views[0].webContents;c.emit('focus');
  s.destroy();assert.equal(h.win.webContents.focusCount,1);
  const t=harness();t.host.createSurface(surfaceOptions);t.views[0].webContents.emit('focus');t.views[0].webContents.emit('blur');t.views[0].webContents.emit('render-process-gone',{},{reason:'crashed'});
  assert.equal(t.win.webContents.focusCount,undefined,'a view without the focus takes nothing back');
});
test('a person who answers after the bound still leaves: the answer stops the clock (설계 검토 R4)',async()=>{
  const g=gated({dirty:true,quitting:true});
  // 대화상자가 오래 떠 있다가 「저장 없이 나가기」로 답한다. 동기 대화상자 동안 시계는 돌지 못하므로, 답이 온 뒤 시계보다 닫힘이 늦게 와도 나간다
  g.c.close=function(options){this.closes.push(options);const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
    const wait=Date.now()+70;while(Date.now()<wait){}event.preventDefault();this.emit('will-prevent-unload',event);setTimeout(()=>{this.destroyed=true;this.emit('destroyed');},80);};
  g.win.close();await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(g.calls.kept,0);assert.equal(g.calls.quit,1);
});
test('the band 「PULSE 닫기」 asks like an exit and reports how it ended (설계 검토 R6)',async()=>{
  const h=harness();assert.deepEqual(await h.host.closeByPerson(),{ok:true,outcome:'none'});
  let s=h.host.createSurface(surfaceOptions);assert.deepEqual(await h.host.closeByPerson(),{ok:true,outcome:'closed'});assert.equal(s.isDestroyed(),true);assert.deepEqual(h.views[0].webContents.closes,[{waitForBeforeUnload:true}]);
  s=h.host.createSurface(surfaceOptions);const c=h.views[1].webContents;c.dirty=true;
  assert.deepEqual(await h.host.closeByPerson(),{ok:true,outcome:'kept'});assert.equal(s.isDestroyed(),false);
  c.on('will-prevent-unload',event=>event.preventDefault());assert.deepEqual(await h.host.closeByPerson(),{ok:true,outcome:'closed'});assert.equal(s.isDestroyed(),true);
});
