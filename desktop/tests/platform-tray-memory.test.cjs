'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const {createTrayMemoryReclaimer} = require('../src/platform-tray-memory.cjs');

function fixture(create = createTrayMemoryReclaimer, useInstalledLoader = false) {
  const jobs = new Map(), turns = new Map(), calls = [], errors = [];
  const state = {busy:false, visible:false, loading:false, playing:false, capture:false, debugging:false};
  const contents = Object.assign(new EventEmitter(), {
    isDestroyed:()=>false, isLoading:()=>state.loading, isCurrentlyAudible:()=>state.playing,
    isBeingCaptured:()=>state.capture, isDevToolsOpened:()=>state.debugging,
  });
  const window = Object.assign(new EventEmitter(), {webContents:contents, isDestroyed:()=>false, isVisible:()=>state.visible});
  const windows=[window];
  const metrics=[{pid:42,creationTime:100.75},{pid:86,creationTime:103.5}];
  const controller=create({
    getWindows:()=>windows, getMetrics:()=>metrics, busy:()=>state.busy, reportError:code=>errors.push(code),
    load:useInstalledLoader ? undefined : () => {
      if(state.loadError)throw Error('Native module is unavailable');
      return command=>{
        calls.push(command);
        if(state.exception===command)throw Error('Native error');
        if(command==='cancel')return 0;
        if(command==='next')return state.nextStatus??0;
        return state.initialStatus??1;
      };
    },
    timers:{
      setTimeout(action,ms){assert.equal(ms,30_000);const handle={};jobs.set(handle,action);return handle;},
      clearTimeout(handle){jobs.delete(handle);},
      setImmediate(action){const handle={unref(){state.unreferenced=true;}};turns.set(handle,action);return handle;},
      clearImmediate(handle){turns.delete(handle);},
    },
  });
  function tick(){assert.equal(jobs.size,1);const [handle,next]=[...jobs][0];jobs.delete(handle);next();return next;}
  function turn(){assert.equal(turns.size,1);const [handle,next]=[...turns][0];turns.delete(handle);next();}
  return {window,contents,windows,metrics,state,jobs,turns,calls,errors,controller,tick,turn};
}

test('pins only the registered process identities after 30 seconds and releases one per event-loop turn',()=>{
  const f=fixture();f.controller.schedule(f.window);assert.equal(f.calls.length,0);f.tick();
  assert.equal(f.jobs.size,0);assert.equal(f.calls.length,1);
  assert.deepEqual(f.calls,['42:100,86:103']);
  f.state.nextStatus=1;f.turn();
  f.state.nextStatus=0;f.turn();
  assert.deepEqual(f.calls,['42:100,86:103','next','next']);
  assert.ok(!f.state.unreferenced,'An idle tray must keep each remaining process scheduled');
  assert.equal(f.window.listenerCount('show'),0);assert.deepEqual(f.errors,[]);
});

for(const event of ['show','closed','media-started-playing','devtools-opened','did-start-loading']){
  test(event+' invalidates a pending timer, even after another close',()=>{
    const f=fixture();f.controller.schedule(f.window);const [stale]=f.jobs.values();
    (['show','closed'].includes(event)?f.window:f.contents).emit(event);
    assert.equal(f.jobs.size,0);f.controller.schedule(f.window);stale();
    assert.equal(f.calls.length,0);f.tick();assert.equal(f.calls.length,1);
  });
}

for(const condition of ['busy','visible','loading','playing','capture','debugging']){
  test('a current '+condition+' condition preserves the working set',()=>{
    const f=fixture();f.controller.schedule(f.window);f.state[condition]=true;
    f.tick();assert.equal(f.calls.length,0);assert.equal(f.jobs.size,0);
  });
}

test('a visible secondary window prevents the entire request',()=>{
  const f=fixture();f.windows.push({isDestroyed:()=>false,isVisible:()=>true,webContents:{}});
  f.controller.schedule(f.window);f.tick();assert.equal(f.calls.length,0);
});

test('an update or quit cancels the timer before the native call',()=>{
  const f=fixture();f.controller.schedule(f.window);const [stale]=f.jobs.values();
  f.controller.cancel();stale();assert.equal(f.calls.length,0);
});

test('oversized process lists are refused with a diagnostic',()=>{
  const f=fixture();while(f.metrics.length<257)f.metrics.push({pid:f.metrics.length+100,creationTime:99});
  f.controller.schedule(f.window);f.tick();assert.equal(f.calls.length,0);
  assert.deepEqual(f.errors,['TRAY_MEMORY_PROCESS_LIST']);
});

test('native load, identity and execution failures are reported while a visibility guard is a normal skip',()=>{
  for(const [state,code] of [[{initialStatus:2},null],[{initialStatus:3},'TRAY_MEMORY_NATIVE_FAILED'],[{loadError:true},'TRAY_MEMORY_NATIVE_FAILED'],[{exception:'42:100,86:103'},'TRAY_MEMORY_NATIVE_FAILED']]){
    const f=fixture();Object.assign(f.state,state);f.controller.schedule(f.window);f.tick();
    assert.deepEqual(f.errors,code?[code]:[]);
  }
});

test('show, quit and media can cancel after preparation and before a pending process is touched',()=>{
  for(const stop of [f=>f.window.emit('show'),f=>f.controller.cancel(),f=>f.contents.emit('media-started-playing')]){
    const f=fixture();f.controller.schedule(f.window);f.tick();const [stale]=f.turns.values();
    stop(f);stale();assert.deepEqual(f.calls,['42:100,86:103','cancel']);
    assert.equal(f.turns.size,0);assert.deepEqual(f.errors,[]);
  }
});

test('a newly visible secondary window or an update between native calls drops remaining handles',()=>{
  for(const interrupt of [f=>f.windows.push({isDestroyed:()=>false,isVisible:()=>true,webContents:{}}),f=>{f.state.busy=true;},f=>{f.state.capture=true;}]){
    const f=fixture();f.controller.schedule(f.window);f.tick();f.state.nextStatus=1;f.turn();
    interrupt(f);f.turn();assert.deepEqual(f.calls,['42:100,86:103','next','cancel']);assert.equal(f.turns.size,0);
  }
});

test('the real loader checks the module bytes before resolving exports',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-tray-integrity-'));
  const directory=path.join(root,'native');
  const script=path.join(root,'platform-tray-memory.cjs');
  const file=path.join(directory,'tray-memory-win-x64.node');
  const pin=path.join(directory,'tray-memory-win-x64.sha256');
  fs.mkdirSync(directory);
  fs.copyFileSync(require.resolve('../src/platform-tray-memory.cjs'),script);
  const content=Buffer.from('test module');
  fs.writeFileSync(file,content);
  const stub=new Module(file);
  stub.loaded=true;
  let reads=0;
  Object.defineProperty(stub,'exports',{get(){reads++;return ()=>2;}});
  require.cache[file]=stub;
  t.after(()=>{
    delete require.cache[file];delete require.cache[script];
    for(const temp of [pin,file,script])if(fs.existsSync(temp))fs.unlinkSync(temp);
    fs.rmdirSync(directory);fs.rmdirSync(root);
  });
  const {createTrayMemoryReclaimer:create}=require(script);
  function attempt(){
    const f=fixture(create,true);
    f.controller.schedule(f.window);f.tick();
    return f.errors;
  }
  assert.deepEqual(attempt(),['TRAY_MEMORY_NATIVE_FAILED']);
  fs.writeFileSync(pin,'0'.repeat(64));
  assert.deepEqual(attempt(),['TRAY_MEMORY_NATIVE_FAILED']);
  assert.equal(reads,0);
  fs.writeFileSync(pin,createHash('sha256').update(content).digest('hex')+'\n');
  assert.deepEqual(attempt(),[]);
  assert.ok(reads>0);
  const readsBeforeRemoval=reads;
  fs.unlinkSync(file);
  assert.deepEqual(attempt(),['TRAY_MEMORY_NATIVE_FAILED']);
  assert.equal(reads,readsBeforeRemoval);
});

test('the shipped Windows module rejects invalid requests and can cancel an empty batch',{
  skip:process.platform!=='win32'||process.arch!=='x64',
},()=>{
  const run=require('../src/native/tray-memory-win-x64.node');
  assert.equal(typeof run,'function');
  // The Rust parser test rejects duplicate PIDs independently of the host guard.
  for(const input of ['',{},'x'.repeat(8193)])assert.equal(run(input),3);
  assert.equal(run('cancel'),0);assert.equal(run('next'),2);assert.equal(run('cancel'),0);
});
