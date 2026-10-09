'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {createWindowPlacement}=require('../src/window-placement.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(t,{bounds={x:50,y:60,width:1100,height:800},maximized=false}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-window-resume-test-'));
  t.after(()=>{const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('synk-window-resume-test-'));fs.rmSync(resolved,{recursive:true,force:true});});
  fs.writeFileSync(path.join(directory,'window-placement.json'),JSON.stringify({...bounds,maximized}));
  const screen=new EventEmitter(),window=new EventEmitter(),calls=[];let areas=[{id:1,workArea:{x:0,y:0,width:1920,height:1040}}],normal={...bounds},minimum=[960,680],isMax=false,isMin=false,destroyed=false;
  screen.getAllDisplays=()=>areas;screen.getPrimaryDisplay=()=>areas[0];
  window.isDestroyed=()=>destroyed;window.isMinimized=()=>isMin;window.isMaximized=()=>isMax;window.getNormalBounds=()=>({...normal});window.getMinimumSize=()=>[...minimum];
  window.setMinimumSize=(width,height)=>{calls.push(['minimum',width,height]);minimum=[width,height];};
  window.setBounds=value=>{calls.push(['bounds',value]);normal={...value};window.emit('resize');};
  window.maximize=()=>{calls.push(['maximize']);isMax=true;window.emit('maximize');};
  const placement=createWindowPlacement({directory,screen}),dispose=placement.attach(window,{maximized});t.after(dispose);
  return {window,screen,calls,dispose,placement,read:()=>JSON.parse(fs.readFileSync(path.join(directory,'window-placement.json'),'utf8')),bounds:()=>normal,minimum:()=>minimum,setDisplays:value=>areas=value,setState(value){if('maximized'in value)isMax=value.maximized;if('minimized'in value)isMin=value.minimized;},destroy(){destroyed=true;window.emit('closed');}};
}
test('pending hidden-start maximization survives resize persistence before first show',async t=>{
  const f=fixture(t,{maximized:true});f.window.emit('resize');await delay(220);
  assert.equal(f.read().maximized,true);assert.deepEqual(f.calls,[]);
  f.window.emit('show');f.window.emit('show');assert.equal(f.calls.filter(value=>value[0]==='maximize').length,1);
  f.setState({maximized:false});f.window.emit('unmaximize');f.window.emit('close');assert.equal(f.read().maximized,false);
});
test('smaller live work area lowers minimum before fitting a hidden window',async t=>{
  const f=fixture(t);const display={id:1,workArea:{x:0,y:0,width:800,height:560}};f.setDisplays([display]);
  f.screen.emit('display-metrics-changed',{},display,['workArea','scaleFactor']);await delay(160);
  assert.deepEqual(f.minimum(),[800,560]);assert.deepEqual(f.bounds(),{x:0,y:0,width:800,height:560});
  assert.deepEqual(f.calls.map(value=>value[0]),['minimum','bounds']);
});
test('ordinary move events and unchanged display or show do not reposition a fitting window',async t=>{
  const f=fixture(t);f.window.emit('move');f.window.emit('show');f.screen.emit('display-metrics-changed',{},f.screen.getPrimaryDisplay(),['scaleFactor']);await delay(160);
  assert.deepEqual(f.calls,[]);assert.deepEqual(f.bounds(),{x:50,y:60,width:1100,height:800});
});
test('one DIP of native rounding does not repeatedly resize a fitted window',t=>{
  const f=fixture(t,{bounds:{x:0,y:0,width:800,height:561}});f.setDisplays([{id:1,workArea:{x:0,y:0,width:800,height:560}}]);f.window.emit('show');f.window.emit('show');
  assert.deepEqual(f.calls,[['minimum',800,560]]);assert.equal(f.bounds().height,561);
});
test('show revalidates latest normal bounds after a monitor disappears while hidden',t=>{
  const f=fixture(t,{bounds:{x:-1250,y:50,width:1100,height:800}});f.window.emit('show');
  assert.deepEqual(f.bounds(),{x:410,y:120,width:1100,height:800});assert.equal(f.calls.length,1);
});
test('display removal preserves maximization and fits the normal window only after unmaximize',async t=>{
  const f=fixture(t);f.setState({maximized:true});f.window.emit('maximize');const display={id:1,workArea:{x:0,y:0,width:800,height:560}};f.setDisplays([display]);f.screen.emit('display-removed',{},{});await delay(160);
  assert.deepEqual(f.calls,[['minimum',800,560]]);
  f.window.emit('close');assert.equal(f.read().maximized,true);
  f.setState({maximized:false});f.window.emit('unmaximize');assert.deepEqual(f.bounds(),{x:0,y:0,width:800,height:560});
});
test('minimized window retains prior maximization without being restored by a display event',async t=>{
  const f=fixture(t);f.setState({maximized:true});f.window.emit('maximize');f.setState({maximized:false,minimized:true});f.window.emit('minimize');
  const display={id:1,workArea:{x:0,y:0,width:800,height:560}};f.setDisplays([display]);f.screen.emit('display-metrics-changed',{},display,['bounds']);await delay(160);f.window.emit('close');
  assert.equal(f.read().maximized,true);assert.deepEqual(f.calls,[['minimum',800,560]]);
  f.setState({minimized:false});f.window.emit('restore');assert.deepEqual(f.bounds(),{x:0,y:0,width:800,height:560});
});
test('destroyed window removes screen listeners and cancels a queued display adjustment',async t=>{
  const f=fixture(t);f.setDisplays([{id:1,workArea:{x:0,y:0,width:800,height:560}}]);f.screen.emit('display-added',{},{});f.destroy();f.dispose();await delay(160);
  for(const event of ['display-added','display-removed','display-metrics-changed'])assert.equal(f.screen.listenerCount(event),0);
  for(const event of ['move','resize','show','restore','maximize','unmaximize','close'])assert.equal(f.window.listenerCount(event),0);
  assert.deepEqual(f.calls,[]);
});
