'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createPlatformTray}=require('../src/platform-tray.cjs');
const {installDraftExitGuard}=require('../src/draft-exit.cjs');

function cancellable(){return {defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};}
function fixture({enabled=true,failure=null,draft='작성 중인 메모'}={}){
  const app=new EventEmitter(),trays=[],dialogs=[];
  let window,created=0,choice=0,quitCalls=0;
  class Window extends EventEmitter{
    constructor(){super();this.webContents=new EventEmitter();this.destroyed=false;this.visible=true;this.minimized=false;this.draft=draft;this.calls={hide:0,show:0,focus:0,restore:0,unload:0};}
    isDestroyed(){return this.destroyed;}isVisible(){return this.visible;}isMinimized(){return this.minimized;}
    hide(){this.calls.hide++;this.visible=false;}show(){this.calls.show++;this.visible=true;}focus(){this.calls.focus++;}
    restore(){this.calls.restore++;this.minimized=false;}
    close(){
      const close=cancellable();this.emit('close',close);if(close.defaultPrevented)return false;
      if(this.draft){this.calls.unload++;const unload=cancellable();this.webContents.emit('will-prevent-unload',unload);if(!unload.defaultPrevented)return false;}
      this.destroyed=true;this.draft=null;this.emit('closed');return true;
    }
  }
  class Tray extends EventEmitter{
    constructor(icon){super();if(failure==='constructor')throw Error('No tray available');this.icon=icon;this.destroyed=false;trays.push(this);}
    isDestroyed(){return this.destroyed;}
    setToolTip(value){if(failure==='tooltip')throw Error('No tooltip available');this.tooltip=value;}
    setContextMenu(value){if(failure==='menu')throw Error('No menu available');this.menu=value;}
    destroy(){this.destroyed=true;}
  }
  app.quit=()=>{quitCalls++;app.emit('before-quit',cancellable());if(!window||window.isDestroyed()||window.close())app.emit('will-quit',cancellable());};
  const makeWindow=()=>{
    created++;window=new Window();
    // This matches main.cjs: the native draft guard handles the user's choice
    // before the tray controller sees will-prevent-unload.
    installDraftExitGuard({contents:window.webContents,window,dialog:{showMessageBoxSync(_window,options){dialogs.push(options);return choice;}}});
    return window;
  };
  makeWindow();
  const controller=createPlatformTray({app,Tray,Menu:{buildFromTemplate:template=>template},icon:'platform.ico',productName:'SYNK 플랫폼',getWindow:()=>window,createWindow:()=>{makeWindow();controller.attachWindow(window);},enabled});
  controller.attachWindow(window);
  return {app,controller,trays,dialogs,get window(){return window;},get created(){return created;},get quitCalls(){return quitCalls;},choose:value=>{choice=value;},forgetWindow:()=>{window=null;}};
}

test('X hides the same page without unloading or asking to discard its draft',()=>{
  const f=fixture(),window=f.window;
  assert.equal(f.controller.isActive(),true);assert.equal(f.trays[0].tooltip,'SYNK 플랫폼');
  assert.equal(window.close(),false);assert.equal(window.visible,false);assert.equal(window.destroyed,false);
  assert.equal(window.calls.hide,1);assert.equal(window.calls.unload,0);assert.equal(window.draft,'작성 중인 메모');assert.equal(f.dialogs.length,0);assert.equal(f.quitCalls,0);
  f.controller.show();assert.equal(f.window,window);assert.equal(window.draft,'작성 중인 메모');assert.equal(window.visible,true);assert.equal(window.calls.focus,1);
  f.controller.dispose();
});

for(const action of ['click','double-click','menu'])test(action+' restores and focuses a minimized tray window',()=>{
  const f=fixture(),window=f.window;window.close();window.minimized=true;
  if(action==='menu')f.trays[0].menu.find(item=>item.label==='SYNK 플랫폼 열기').click();else f.trays[0].emit(action);
  assert.equal(window.visible,true);assert.equal(window.minimized,false);assert.equal(window.calls.restore,1);assert.equal(window.calls.focus,1);assert.equal(f.created,1);assert.equal(window.draft,'작성 중인 메모');
  f.controller.dispose();
});

test('tray reopen creates and attaches a replacement when the previous window is gone',()=>{
  const f=fixture(),old=f.window;old.destroyed=true;old.emit('closed');f.controller.show();
  assert.equal(f.created,2);assert.notEqual(f.window,old);assert.equal(f.window.listenerCount('close'),1);assert.equal(f.window.close(),false);assert.equal(f.window.visible,false);
  f.forgetWindow();f.controller.show();assert.equal(f.created,3);assert.equal(f.window.listenerCount('close'),1);
  f.controller.dispose();
});

test('complete exit bypasses tray hiding and destroys the tray when no draft blocks it',()=>{
  const f=fixture({draft:null}),window=f.window;window.close();
  f.trays[0].menu.find(item=>item.label==='완전히 종료').click();
  assert.equal(f.quitCalls,1);assert.equal(window.destroyed,true);assert.equal(window.calls.hide,1);assert.equal(window.calls.show,1);assert.equal(f.controller.isQuitting(),true);assert.equal(f.controller.isActive(),false);assert.equal(f.trays[0].destroyed,true);
});

test('keeping a draft during complete exit cancels quitting and restores the same page',()=>{
  const f=fixture(),window=f.window;window.close();f.choose(0);f.app.quit();
  assert.equal(f.dialogs.length,1);assert.equal(f.dialogs[0].defaultId,0);assert.equal(window.destroyed,false);assert.equal(window.visible,true);assert.equal(window.draft,'작성 중인 메모');assert.equal(f.controller.isQuitting(),false);assert.equal(f.controller.isActive(),true);
  assert.equal(window.close(),false);assert.equal(window.visible,false);assert.equal(window.calls.unload,1);assert.equal(f.dialogs.length,1);
  f.controller.dispose();
});

test('explicit discard during complete exit proceeds through the draft guard',()=>{
  const f=fixture(),window=f.window;window.close();f.choose(1);f.app.quit();
  assert.equal(f.dialogs.length,1);assert.equal(window.calls.unload,1);assert.equal(window.destroyed,true);assert.equal(f.controller.isQuitting(),true);assert.equal(f.controller.isActive(),false);
});

test('Windows session end allows the window to close instead of returning to the tray',()=>{
  const f=fixture({draft:null});f.window.emit('session-end');assert.equal(f.controller.isQuitting(),true);assert.equal(f.window.close(),true);assert.equal(f.window.calls.hide,0);f.controller.dispose();
});

for(const failure of ['constructor','tooltip','menu'])test('tray '+failure+' failure keeps normal close and draft protection available',()=>{
  const f=fixture({failure}),window=f.window;
  assert.equal(f.controller.isActive(),false);assert.equal(window.listenerCount('close'),0);assert.equal(f.app.listenerCount('before-quit'),0);
  assert.equal(window.close(),false);assert.equal(window.visible,true);assert.equal(f.dialogs.length,1);assert.equal(window.draft,'작성 중인 메모');
  f.choose(1);assert.equal(window.close(),true);for(const tray of f.trays)assert.equal(tray.destroyed,true);
});

test('a tray lost after startup cannot hide an unreachable window',()=>{
  const f=fixture({draft:null});f.trays[0].destroy();assert.equal(f.controller.isActive(),false);assert.equal(f.window.close(),true);assert.equal(f.window.calls.hide,0);f.controller.dispose();
});

test('disabled tray registers no close override, app listeners, or native tray',()=>{
  const f=fixture({enabled:false,draft:null});assert.equal(f.trays.length,0);assert.equal(f.controller.isActive(),false);assert.equal(f.app.listenerCount('before-quit'),0);assert.equal(f.app.listenerCount('will-quit'),0);assert.equal(f.window.listenerCount('close'),0);assert.equal(f.window.close(),true);assert.equal(f.window.calls.hide,0);f.controller.dispose();
});

test('dispose removes every tray-owned window and app listener and can run twice',()=>{
  const f=fixture(),window=f.window;f.controller.attachWindow(window);
  assert.equal(window.listenerCount('close'),1);assert.equal(window.listenerCount('closed'),1);assert.equal(window.webContents.listenerCount('will-prevent-unload'),2);
  f.controller.dispose();f.controller.dispose();
  assert.equal(window.listenerCount('close'),0);assert.equal(window.listenerCount('closed'),0);assert.equal(window.listenerCount('session-end'),0);assert.equal(window.webContents.listenerCount('will-prevent-unload'),1);
  assert.equal(f.app.listenerCount('before-quit'),0);assert.equal(f.app.listenerCount('will-quit'),0);assert.equal(f.controller.isActive(),false);assert.equal(f.trays[0].destroyed,true);
});

// Execute the shipped renderer handler, keeping its surrounding services as
// doubles so an unsaved draft cannot mask whether X invokes a native close.
function rendererFixture(closeToTray){
  const source=fs.readFileSync(path.join(__dirname,'../renderer/launcher.mjs'),'utf8'),handler=source.match(/^async function windowAction\(action\)\{[^\n]+$/m)?.[0];
  assert.ok(handler,'renderer window handler is available');
  const calls=[],prompts=[];let allow=false;
  const context={environment:{closeToTray},ownerEpoch:1,bridge:{windowAction:async action=>calls.push(action)},confirmDraftExit:async message=>{prompts.push(message);return allow;},toast:()=>assert.fail('native window operation failed')};
  vm.createContext(context);vm.runInContext(handler,context);
  return {calls,prompts,action:action=>context.windowAction(action),allow:()=>{allow=true;}};
}

test('renderer X invokes native close without discarding or prompting when closeToTray is true',async()=>{
  const f=rendererFixture(true);await f.action('close');assert.deepEqual(f.calls,['close']);assert.equal(f.prompts.length,0);
});

for(const value of [false,undefined,'true'])test('renderer X keeps its draft confirmation when closeToTray is '+String(value),async()=>{
  const f=rendererFixture(value);await f.action('close');assert.equal(f.prompts.length,1);assert.deepEqual(f.calls,[]);
  f.allow();await f.action('close');assert.deepEqual(f.calls,['close']);
});

test('renderer minimize keeps its native action regardless of an unsaved draft',async()=>{
  const f=rendererFixture(false);await f.action('minimize');assert.deepEqual(f.calls,['minimize']);assert.equal(f.prompts.length,0);
});
