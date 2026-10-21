import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {waitForShaderPrograms, yieldForShaderPreparation, runShaderPreparationTasks} from '../../synk-world-home/shader-preparation.mjs';

// Three r180 compileAsync cannot cancel its material-property polling. These
// tests exercise our ownership boundary with fake WebGL handles and a virtual
// clock; shader output and cold-start timing require the separate browser QA.
function fixture({ready=false, extension=true, lost=false}={}) {
  const handle={}, wrapper={program:handle}, domElement=new EventTarget();
  let queries=0;
  const gl={
    isContextLost:()=>lost,
    getProgramParameter(program, parameter) {
      assert.equal(program, handle); assert.equal(parameter, 0x91b1);
      assert.equal(lost, false); assert.equal(wrapper.program, handle);
      queries++; return ready;
    },
  };
  return {
    domElement, info:{programs:[wrapper]},
    extensions:{get:name=>{assert.equal(name, 'KHR_parallel_shader_compile');return extension?{COMPLETION_STATUS_KHR:0x91b1}:null;}},
    getContext:()=>gl,
    setReady:()=>{ready=true;}, setLost:()=>{lost=true;}, destroyProgram:()=>{wrapper.program=undefined;},
    queries:()=>queries,
  };
}

function clock(t) { t.mock.timers.enable({apis:['setTimeout']}); return t.mock.timers; }
function noListeners(renderer, signal) {
  assert.equal(getEventListeners(renderer.domElement, 'webglcontextlost').length, 0);
  if(signal) assert.equal(getEventListeners(signal, 'abort').length, 0);
}

test('completed shader programs resolve and remove the completion deadline', async t=>{
  const time=clock(t), renderer=fixture({ready:true}), owner=new AbortController();
  assert.deepEqual(await waitForShaderPrograms(renderer,{signal:owner.signal}), {parallel:true,programs:1});
  const queries=renderer.queries(); time.tick(30000);
  assert.equal(renderer.queries(),queries); noListeners(renderer,owner.signal);
});

test('unfinished compilation yields between readiness checks', async t=>{
  const time=clock(t), renderer=fixture();
  const pending=waitForShaderPrograms(renderer,{pollMs:16});
  time.tick(15); assert.equal(renderer.queries(),1);
  renderer.setReady(); time.tick(1);
  assert.deepEqual(await pending,{parallel:true,programs:1}); noListeners(renderer);
});

test('an already closed owner never queries a shader program', async t=>{
  clock(t); const renderer=fixture(), owner=new AbortController(); owner.abort();
  await assert.rejects(waitForShaderPrograms(renderer,{signal:owner.signal}),{name:'AbortError'});
  assert.equal(renderer.queries(),0); noListeners(renderer,owner.signal);
});

test('closing during preparation stops polling before program disposal', async t=>{
  const time=clock(t), renderer=fixture(), owner=new AbortController();
  const pending=waitForShaderPrograms(renderer,{signal:owner.signal});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  owner.abort(); renderer.destroyProgram(); await rejected;
  const queries=renderer.queries(); time.tick(30000);
  assert.equal(renderer.queries(),queries); noListeners(renderer,owner.signal);
});

test('polling detects context loss without querying the lost context', async t=>{
  const time=clock(t), renderer=fixture();
  const pending=waitForShaderPrograms(renderer);
  const rejected=assert.rejects(pending,/SHADER_CONTEXT_LOST/);
  const queries=renderer.queries(); renderer.setLost(); time.tick(16); await rejected;
  time.tick(30000); assert.equal(renderer.queries(),queries); noListeners(renderer);
});

test('a context loss event ends preparation immediately and removes listeners', async t=>{
  const time=clock(t), renderer=fixture(), owner=new AbortController();
  const pending=waitForShaderPrograms(renderer,{signal:owner.signal});
  const rejected=assert.rejects(pending,/SHADER_CONTEXT_LOST/);
  renderer.domElement.dispatchEvent(new Event('webglcontextlost')); await rejected;
  const queries=renderer.queries(); time.tick(30000);
  assert.equal(renderer.queries(),queries); noListeners(renderer,owner.signal);
});

test('a stalled driver times out and leaves no polling work', async t=>{
  const time=clock(t), renderer=fixture();
  const pending=waitForShaderPrograms(renderer,{timeoutMs:50,pollMs:16});
  const rejected=assert.rejects(pending,/SHADER_PREPARATION_TIMEOUT/);
  time.tick(50); await rejected;
  const queries=renderer.queries(); time.tick(30000);
  assert.equal(renderer.queries(),queries); noListeners(renderer);
});

test('a destroyed program is rejected before querying its old handle', async t=>{
  const time=clock(t), renderer=fixture();
  const pending=waitForShaderPrograms(renderer);
  const rejected=assert.rejects(pending,/SHADER_PROGRAM_DISPOSED/);
  const queries=renderer.queries(); renderer.destroyProgram(); time.tick(16); await rejected;
  assert.equal(renderer.queries(),queries); noListeners(renderer);
});

test('without parallel compilation the fallback yields and reports its limit', async t=>{
  const time=clock(t), renderer=fixture({extension:false});
  let finished=false;
  const pending=waitForShaderPrograms(renderer).then(result=>{finished=true;return result;});
  await Promise.resolve(); assert.equal(finished,false);
  time.tick(0);
  assert.deepEqual(await pending,{parallel:false,programs:1});
  assert.equal(renderer.queries(),0); noListeners(renderer);
});

test('the nonparallel fallback is still cancelled when the owner closes', async t=>{
  const time=clock(t), renderer=fixture({extension:false}), owner=new AbortController();
  const pending=waitForShaderPrograms(renderer,{signal:owner.signal});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  owner.abort(); await rejected; time.tick(30000);
  assert.equal(renderer.queries(),0); noListeners(renderer,owner.signal);
});

test('yield cancellation preserves the reason and removes its owner listener', async t=>{
  const time=clock(t), owner=new AbortController(), reason=new Error('stage unmounted');
  const pending=yieldForShaderPreparation({signal:owner.signal,delayMs:100});
  const rejected=assert.rejects(pending,error=>error===reason);
  owner.abort(reason); await rejected; time.tick(1000);
  assert.equal(getEventListeners(owner.signal,'abort').length,0);
});

test('shader preparation yields between bounded batches while preserving task order', async t=>{
  const time=clock(t), seen=[]; let workTime=0;
  const tasks=Array.from({length:5},(_,i)=>()=>{seen.push(i);workTime+=5;});
  const pending=runShaderPreparationTasks(tasks,{budgetMs:8,now:()=>workTime});
  assert.deepEqual(seen,[0,1]);
  time.tick(0); await Promise.resolve(); assert.deepEqual(seen,[0,1,2,3]);
  time.tick(0); await pending; assert.deepEqual(seen,[0,1,2,3,4]);
});

test('closing during a preparation batch prevents all later GPU tasks', async t=>{
  const time=clock(t), owner=new AbortController(), seen=[]; let workTime=0;
  const tasks=Array.from({length:5},(_,i)=>()=>{seen.push(i);workTime+=5;});
  const pending=runShaderPreparationTasks(tasks,{signal:owner.signal,budgetMs:8,now:()=>workTime});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  assert.deepEqual(seen,[0,1]); owner.abort(); await rejected;
  time.tick(30000); assert.deepEqual(seen,[0,1]);
  assert.equal(getEventListeners(owner.signal,'abort').length,0);
});
