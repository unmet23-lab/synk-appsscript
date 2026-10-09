'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {fitPlacement,createWindowPlacement}=require('../src/window-placement.cjs');
const {createDesktopPreferences}=require('../src/desktop-preferences.cjs');
const {createPlatformTray}=require('../src/platform-tray.cjs');
const primary={workArea:{x:0,y:0,width:1920,height:1040}};
test('restores bounds on a negative-origin monitor, clamps a moved window, and recovers a removed monitor',()=>{
  const left={workArea:{x:-1280,y:0,width:1280,height:984}};
  assert.deepEqual(fitPlacement({x:-1200,y:20,width:1100,height:800,maximized:true},[left,primary],primary),{x:-1200,y:20,width:1100,height:800,minWidth:960,minHeight:680,maximized:true});
  const removed=fitPlacement({x:-1200,y:20,width:1100,height:800},[primary],primary);assert.ok(removed.x>=0&&removed.x+removed.width<=1920);
  const moved=fitPlacement({x:1600,y:900,width:1100,height:800},[primary],primary);assert.equal(moved.x,820);assert.equal(moved.y,240);
});
test('small work area and corrupt bounds cannot put the close control off-screen',()=>{
  const small={workArea:{x:40,y:20,width:800,height:560}},value=fitPlacement({x:NaN,y:4,width:0,height:5},[small],small);
  assert.deepEqual(value,{x:40,y:20,width:800,height:560,minWidth:800,minHeight:560,maximized:false});
});
test('window close saves normal bounds when maximized and next launch reads them',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-placement-test-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const screen={getAllDisplays:()=>[primary],getPrimaryDisplay:()=>primary},placement=createWindowPlacement({directory,screen}),window=new EventEmitter();window.isDestroyed=()=>false;window.getNormalBounds=()=>({x:20,y:30,width:1000,height:800});window.isMaximized=()=>true;
  placement.attach(window);window.emit('close');window.emit('closed');
  assert.equal(window.listenerCount('move'),0);const restored=createWindowPlacement({directory,screen}).restore();assert.equal(restored.maximized,true);assert.equal(restored.x,20);assert.equal(restored.width,1000);
});
test('restoring a maximized session never shows a hidden-start window until explicit open',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-placement-test-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const screen={getAllDisplays:()=>[primary],getPrimaryDisplay:()=>primary},placement=createWindowPlacement({directory,screen}),window=new EventEmitter();let maximizations=0;window.isDestroyed=()=>false;window.maximize=()=>maximizations++;
  const dispose=placement.attach(window,{maximized:true});assert.equal(maximizations,0);window.emit('show');assert.equal(maximizations,1);window.emit('show');assert.equal(maximizations,1);dispose();
});
function fixture(t,{enabled=true,platform='win32'}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-preferences-test-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const registrations=new Map(),busy=new Set(),startup=[],actions=[],changes=[],calls=[];let login=false;
  const app={setLoginItemSettings:value=>{startup.push(value);login=value.openAtLogin;},getLoginItemSettings:()=>({openAtLogin:login})};
  const globalShortcut={register:(key,fn)=>{if(busy.has(key)||registrations.has(key))return false;registrations.set(key,fn);return true;},unregister:key=>registrations.delete(key)};
  const window={isDestroyed:()=>false,isMinimized:()=>true,restore:()=>calls.push('restore'),show:()=>calls.push('show'),focus:()=>calls.push('focus'),webContents:{setZoomFactor:value=>calls.push(['zoom',value])}};
  const args={directory,app,globalShortcut,getWindow:()=>window,onAction:action=>actions.push(action),onChange:value=>changes.push(value),enabled,platform,executable:'C:\\SYNK\\electron.exe',appRoot:'C:\\SYNK\\desktop',name:'im.synk.platform.preview'};
  const preferences=createDesktopPreferences(args);preferences.initialize();t.after(()=>preferences.dispose());return {directory,preferences,registrations,busy,startup,actions,changes,calls,args};
}
test('startup is opt-in, no OS writes or shortcuts on first launch, changed settings persist',t=>{
  const f=fixture(t);assert.deepEqual(f.startup,[]);assert.equal(f.registrations.size,0);
  assert.equal(f.preferences.update({launchAtLogin:true,startHidden:true,closeToTray:false,zoomFactor:1.2}).ok,true);
  assert.equal(f.startup.length,1);assert.deepEqual(f.startup[0].args,['C:\\SYNK\\desktop','--synk-dev','--client=platform','--synk-autostart']);assert.equal(f.startup[0].name,'im.synk.platform.preview');
  const reloaded=createDesktopPreferences(f.args);assert.equal(reloaded.snapshot().preferences.closeToTray,false);assert.equal(reloaded.snapshot().preferences.zoomFactor,1.2);assert.equal(f.changes.length,1);
});
test('hotkey collision preserves the old shortcut and never writes partial preferences',t=>{
  const f=fixture(t);assert.equal(f.preferences.update({globalShortcut:'Ctrl+Alt+S'}).ok,true);f.busy.add('Ctrl+Alt+K');
  assert.equal(f.preferences.update({globalShortcut:'Ctrl+Alt+K',zoomFactor:1.5}).code,'SHORTCUT_UNAVAILABLE');assert.equal(f.preferences.snapshot().preferences.zoomFactor,1);assert.equal(f.preferences.snapshot().preferences.globalShortcut,'Ctrl+Alt+S');assert.deepEqual([...f.registrations.keys()],['Ctrl+Alt+S']);
  f.registrations.get('Ctrl+Alt+S')();assert.deepEqual(f.actions,[{type:'command-menu'}]);assert.deepEqual(f.calls.slice(-3),['restore','show','focus']);
  f.preferences.update({globalShortcut:''});assert.equal(f.registrations.size,0);
});
test('failed disk write rolls back newly registered hotkey and startup OS value',t=>{
  const f=fixture(t);f.preferences.update({globalShortcut:'Ctrl+Alt+S'});fs.mkdirSync(path.join(f.directory,'desktop-preferences.json.tmp'));
  assert.equal(f.preferences.update({globalShortcut:'Ctrl+Alt+K',launchAtLogin:true}).code,'PREFERENCES_SAVE_FAILED');
  assert.deepEqual([...f.registrations.keys()],['Ctrl+Alt+S']);assert.equal(f.startup.at(-1).openAtLogin,false);assert.equal(f.preferences.snapshot().preferences.launchAtLogin,false);
});
test('a saved shortcut occupied by another app does not block unrelated preferences',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.directory,'desktop-preferences.json'),JSON.stringify({globalShortcut:'Ctrl+Alt+K'}));f.busy.add('Ctrl+Alt+K');
  const reloaded=createDesktopPreferences(f.args);reloaded.initialize();assert.equal(reloaded.snapshot().warning,'SHORTCUT_UNAVAILABLE');assert.equal(reloaded.update({zoomFactor:1.2,closeToTray:false}).ok,true);assert.equal(reloaded.snapshot().warning,'SHORTCUT_UNAVAILABLE');assert.equal(reloaded.snapshot().preferences.closeToTray,false);assert.equal(reloaded.update({globalShortcut:''}).ok,true);assert.equal(reloaded.snapshot().warning,undefined);reloaded.dispose();
});
test('invalid zoom, unmodified hotkey, arbitrary preference, and wrong types are rejected before effects',t=>{
  const f=fixture(t);for(const patch of [{zoomFactor:5},{zoomFactor:NaN},{globalShortcut:'S'},{globalShortcut:'Shift+S'},{closeToTray:'true'},{command:'cmd.exe'},null])assert.equal(f.preferences.update(patch).code,'INVALID_DESKTOP_PREFERENCES');assert.equal(f.startup.length,0);assert.equal(f.registrations.size,0);
});
test('smoke mode never loads or mutates native preferences and does not register an OS shortcut',t=>{
  const f=fixture(t,{enabled:false});assert.equal(f.preferences.update({launchAtLogin:true}).code,'DESKTOP_UNAVAILABLE');assert.equal(f.startup.length,0);assert.equal(f.preferences.snapshot().capabilities.globalShortcut,false);
});
test('dynamic tray entries use fixed catalog names and ordinary close responds immediately to its setting',()=>{
  const app=new EventEmitter(),window=new EventEmitter();window.webContents=new EventEmitter();window.isDestroyed=()=>false;window.isMinimized=()=>false;window.show=()=>{};window.focus=()=>{};let hides=0,hide=true,menu,actions=[];window.hide=()=>hides++;
  class Tray extends EventEmitter{isDestroyed(){return false;}setToolTip(){}setContextMenu(value){menu=value;}destroy(){}}
  const tray=createPlatformTray({app,Tray,Menu:{buildFromTemplate:value=>value},getWindow:()=>window,createWindow:()=>{},shouldHide:()=>hide,onAction:value=>actions.push(value)});tray.attachWindow(window);
  assert.equal(tray.setShortcuts([{id:'world',label:'UNTRUSTED'},{id:'world'}]).ok,true);assert.equal(menu.filter(item=>item.label==='SYNK WORLD').length,1);menu.find(item=>item.label==='SYNK WORLD').click();assert.deepEqual(actions,[{type:'open-app',id:'world'}]);
  assert.equal(tray.setShortcuts([{id:'../cmd'}]).code,'INVALID_TRAY_SHORTCUTS');assert.equal(tray.setShortcuts(Array(6).fill({id:'world'})).code,'INVALID_TRAY_SHORTCUTS');
  const event={preventDefault:()=>{}};window.emit('close',event);assert.equal(hides,1);hide=false;window.emit('close',event);assert.equal(hides,1);tray.dispose();
});
