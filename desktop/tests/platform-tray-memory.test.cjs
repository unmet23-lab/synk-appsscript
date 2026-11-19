'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {createTrayMemoryReclaimer} = require('../src/platform-tray-memory.cjs');

function fixture() {
  const jobs = new Map(), calls = [], errors = [];
  const state = {busy:false, visible:false, loading:false, playing:false, capture:false, debugging:false};
  const contents = Object.assign(new EventEmitter(), {
    isDestroyed:()=>false, isLoading:()=>state.loading, isCurrentlyAudible:()=>state.playing,
    isBeingCaptured:()=>state.capture, isDevToolsOpened:()=>state.debugging,
  });
  const window = Object.assign(new EventEmitter(), {webContents:contents, isDestroyed:()=>false, isVisible:()=>state.visible});
  const windows=[window];
  const metrics=[{pid:42,creationTime:100.75},{pid:86,creationTime:103.5}];
  const controller=createTrayMemoryReclaimer({
    getWindows:()=>windows, getMetrics:()=>metrics, busy:()=>state.busy, reportError:code=>errors.push(code),
    run(file,args,opts){calls.push({file,args,opts}); if(state.failure)throw state.failure;},
    timers:{
      setTimeout(action,ms){assert.equal(ms,30_000);const handle={};jobs.set(handle,action);return handle;},
      clearTimeout(handle){jobs.delete(handle);},
    },
  });
  function tick(){assert.equal(jobs.size,1);const next=[...jobs.values()][0];next();return next;}
  return {window,contents,windows,metrics,state,jobs,calls,errors,controller,tick};
}

test('only one bounded, hidden, synchronous request runs after 30 seconds and never calls the renderer',()=>{
  const f=fixture();f.controller.schedule(f.window);assert.equal(f.calls.length,0);f.tick();
  assert.equal(f.jobs.size,0);assert.equal(f.calls.length,1);
  const [{file,args,opts}]=f.calls;
  assert.match(file,/[\\/]native[\\/]tray-memory-win-x64\.exe$/);
  assert.deepEqual(args,['42:100','86:103']);
  assert.deepEqual(opts,{windowsHide:true,timeout:500,stdio:'ignore'});
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

test('OS, identity and launch failures are reported while a native visibility guard is a normal skip',()=>{
  for(const [failure,code] of [[{status:2},null],[{status:3},'TRAY_MEMORY_HELPER_FAILED'],[{code:'ENOENT'},'TRAY_MEMORY_HELPER_FAILED'],[{code:'ETIMEDOUT'},'TRAY_MEMORY_HELPER_TIMEOUT']]){
    const f=fixture();f.state.failure=failure;f.controller.schedule(f.window);f.tick();
    assert.deepEqual(f.errors,code?[code]:[]);
  }
});
