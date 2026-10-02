import test from 'node:test';
import assert from 'node:assert/strict';
import { Narrator } from '../narration.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup({duration=1,endedOnStop=true}={}){
  const sources=[],gains=[],active=[],deliveries=[];
  globalThis.window={speechSynthesis:{getVoices:()=>[],cancel:()=>{}}};
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  const context={state:'running',currentTime:0,destination:{},decodeAudioData:async()=>({duration}),createGain:()=>{
    const gain={gain:{},connect(){},disconnect(){this.disconnected=true;}};gains.push(gain);return gain;
  },createBufferSource:()=>{
    const source={connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopCalls=(this.stopCalls||0)+1;if(endedOnStop)this.onended?.();}};sources.push(source);return source;
  }};
  return {sources,gains,context,active,deliveries,narrator:new Narrator({getContext:()=>context,onActive:value=>active.push(value),onDelivery:value=>deliveries.push(value),onUnavailable:()=>{throw Error('Unexpected fallback');}})};
}
test('a question plays every clip in order; feedback waits without cutting off the word',async()=>{
  const {narrator,sources,active}=setup();narrator.speak(['cue','word'],'question','question');narrator.speak(['correct'],'feedback','feedback');await flush();
  assert.deepEqual(narrator.snapshot().played.map(c=>c.id),['cue']);
  sources[0].onended();await flush();assert.deepEqual(narrator.snapshot().played.map(c=>c.id),['cue','word']);
  sources[1].onended();await flush();assert.deepEqual(narrator.snapshot().played.map(c=>c.id),['cue','word','correct']);
  sources[2].onended();await flush();assert(narrator.snapshot().played.every(c=>c.completed));assert.equal(narrator.playing,false);assert.deepEqual(active,[true,false]);
});
test('learning delivery waits for every clip and never credits an interrupted presentation',async()=>{
  const {narrator,sources,deliveries}=setup();
  narrator.speak(['a','b'],'first','question',{presentationId:'first'});await flush();
  sources[0].onended();await flush();assert.deepEqual(deliveries,[]);
  narrator.speak(['c'],'second','question',{interrupt:true,presentationId:'second'});await flush();
  sources[2].onended();await flush();
  assert.deepEqual(deliveries,[{kind:'question',presentationId:'second',audio:'completed'}]);
});
test('missing recorded audio and missing fallback voice report failed delivery',async()=>{
  const {narrator,deliveries}=setup();narrator.onUnavailable=()=>{};
  globalThis.fetch=async()=>({ok:false});
  narrator.speak(['missing'],'no audio','question',{presentationId:'failed'});await flush();
  assert.deepEqual(deliveries,[{kind:'question',presentationId:'failed',audio:'failed'}]);
});
test('repeat interrupts old speech and clears old queued feedback without replaying stale words',async()=>{
  const {narrator,sources}=setup();narrator.speak(['old-cue','old-word'],'old question','question');narrator.speak(['old-feedback'],'old feedback','feedback');await flush();
  narrator.speak(['new-cue','new-word'],'repeat','question',{interrupt:true});await flush();
  assert.deepEqual(narrator.snapshot().played.map(c=>c.id),['old-cue','new-cue']);assert.equal(narrator.snapshot().played[0].completed,false);
  sources[1].onended();await flush();sources[2].onended();await flush();
  assert.deepEqual(narrator.snapshot().played.map(c=>c.id),['old-cue','new-cue','new-word']);assert.equal(narrator.playing,false);
});

test('a running audio host with no ended event fails after the buffer duration plus grace and exposes text instead of crediting listening',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {narrator,sources,gains,context,deliveries}=setup({duration:3.75,endedOnStop:false});
  let unavailable=0;narrator.onUnavailable=()=>unavailable++;
  // A Korean TTS voice must not turn a stalled MP3 into another event-only wait.
  window.speechSynthesis.getVoices=()=>[{lang:'ko-KR',name:'Korean'}];
  narrator.speak(['question','option'],'question','question',{presentationId:'stalled'});await flush();
  const lateEnded=sources[0].onended;
  assert.equal(context.state,'running');assert(sources[0].started);
  t.mock.timers.tick(8749);await flush();
  assert.equal(narrator.playing,true);assert.equal(unavailable,0);assert.deepEqual(deliveries,[]);
  t.mock.timers.tick(1);await flush();
  assert.equal(unavailable,1);assert.equal(narrator.playing,false);assert.equal(narrator.activeKind,null);
  assert.equal(sources.length,1,'remaining clips must not start after failed delivery');
  assert.equal(sources[0].stopCalls,1);assert(sources[0].disconnected&&gains[0].disconnected);
  assert.equal(narrator.snapshot().played[0].completed,false);
  assert.equal(narrator.snapshot().played[0].failure,'ended-timeout');
  assert.deepEqual(deliveries,[{kind:'question',presentationId:'stalled',audio:'failed'}]);
  lateEnded();t.mock.timers.tick(60000);await flush();
  assert.equal(narrator.snapshot().played[0].completed,false,'a late host callback cannot credit an already failed clip');
  assert.equal(unavailable,1);assert.equal(deliveries.length,1);
});

test('a short stalled clip gets at least eight seconds and repeat can start a new presentation after failure',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {narrator,sources,deliveries}=setup({duration:.5,endedOnStop:false});
  let unavailable=0;narrator.onUnavailable=()=>unavailable++;
  narrator.speak(['short'],'short','question',{presentationId:'short'});await flush();
  t.mock.timers.tick(7999);await flush();assert.equal(unavailable,0);assert.equal(narrator.playing,true);
  t.mock.timers.tick(1);await flush();assert.equal(unavailable,1);assert.equal(narrator.playing,false);
  narrator.speak(['retry'],'retry','question',{interrupt:true,presentationId:'retry'});await flush();
  assert(sources[1].started);sources[1].onended();await flush();
  assert.equal(narrator.playing,false);
  assert.deepEqual(deliveries,[{kind:'question',presentationId:'short',audio:'failed'},{kind:'question',presentationId:'retry',audio:'completed'}]);
});

test('normal completion clears its deadline and cannot later stop or mark a completed clip as failed',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {narrator,sources,gains,deliveries}=setup();
  let unavailable=0;narrator.onUnavailable=()=>unavailable++;
  narrator.speak(['normal'],'normal','question',{presentationId:'normal'});await flush();
  sources[0].onended();await flush();
  assert.equal(narrator.current,null);assert(sources[0].disconnected&&gains[0].disconnected);
  t.mock.timers.tick(60000);await flush();
  assert.equal(unavailable,0);assert.equal(sources[0].stopCalls,undefined);
  assert.equal(narrator.snapshot().played[0].completed,true);assert.equal(narrator.snapshot().played[0].failure,undefined);
  assert.deepEqual(deliveries,[{kind:'question',presentationId:'normal',audio:'completed'}]);
});

test('pause-style cancellation clears the deadline and releases nodes even when the host also omits stop ended events',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {narrator,sources,gains,deliveries}=setup({endedOnStop:false});
  let unavailable=0;narrator.onUnavailable=()=>unavailable++;
  narrator.speak(['cancelled','never-start'],'cancelled','question',{presentationId:'cancelled'});await flush();
  narrator.cancel();await flush();
  assert.equal(narrator.current,null);assert.equal(narrator.playing,false);assert.equal(narrator.activeKind,null);
  assert(sources[0].disconnected&&gains[0].disconnected);assert.equal(sources[0].stopCalls,1);
  t.mock.timers.tick(60000);await flush();
  assert.equal(unavailable,0);assert.equal(sources[0].stopCalls,1);assert.equal(sources.length,1);assert.deepEqual(deliveries,[]);
  assert.equal(narrator.snapshot().played[0].completed,false);assert.equal(narrator.snapshot().played[0].failure,undefined);
  narrator.speak(['resumed'],'resumed','question',{presentationId:'resumed'});await flush();
  sources[1].onended();await flush();
  assert.deepEqual(deliveries,[{kind:'question',presentationId:'resumed',audio:'completed'}]);
});
