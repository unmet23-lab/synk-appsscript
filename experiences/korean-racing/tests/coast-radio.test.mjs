import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoastRadio,COAST_RADIO_TRACK} from '../coast-radio.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(){
  const requests=[],listeners=new Map(),targets=[],errors=[];
  let created=0,connected=0;
  const media={paused:true,currentTime:0,loads:0,plays:0,pauses:0,src:'',
    load(){this.loads++;},play(){this.plays++;this.paused=false;const next=requests.shift();return next?.promise||Promise.resolve();},
    pause(){this.pauses++;this.paused=true;},addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k),removeAttribute(k){this[k]='';}};
  const gain={gain:{value:0,cancelAndHoldAtTime(){},setValueAtTime(v){this.value=v;targets.push(v);},setTargetAtTime(v){this.value=v;targets.push(v);}},connect(){},disconnect(){this.disconnected=true;}};
  const source={connect(){},disconnect(){this.disconnected=true;}};
  const context={state:'running',currentTime:1,destination:{},createGain:()=>gain,createMediaElementSource(){connected++;return source;},resume(){this.state='running';return Promise.resolve();}};
  const radio=createCoastRadio({getContext:()=>context,createAudio:()=>{created++;return media;},onUnavailable:e=>errors.push(e)});
  return {radio,media,requests,listeners,targets,errors,gain,source,context,counts:()=>({created,connected})};
}

test('startup and gesture activation never request the song; preparing streams it once',async()=>{
  const x=setup();assert.equal(x.counts().created,0);assert.equal(x.media.loads,0);
  await x.radio.unlock();assert.match(x.media.src,/^data:audio/);assert.equal(x.media.loads,0);assert.equal(x.media.paused,true);
  assert.equal(x.radio.snapshot().prepared,false);x.radio.prepare();x.radio.prepare();
  assert.equal(x.media.src,COAST_RADIO_TRACK.src);assert.equal(x.media.loads,1);assert.equal(x.media.preload,'auto');assert.equal(x.media.loop,true);
  assert.equal(x.counts().created,1);assert.equal(x.counts().connected,1);
});

test('music waits for active drive, fades in and ducks without another play request',async()=>{
  const x=setup();x.radio.prepare();assert.equal(x.media.plays,0);
  x.radio.setState({active:true});await flush();assert.equal(x.radio.snapshot().playing,true);assert.equal(x.radio.snapshot().targetGain,.38);
  for(let i=0;i<60;i++)x.radio.setState({active:true});assert.equal(x.media.plays,1);
  x.radio.setState({duck:true});assert.equal(x.radio.snapshot().targetGain,.09);
  x.radio.setState({duck:false});assert.equal(x.radio.snapshot().targetGain,.38);assert.equal(x.media.plays,1);
});

test('mute and tab/pause stop immediately while preserving position; result/home rewinds',async()=>{
  const x=setup();x.radio.setState({active:true});await flush();x.media.currentTime=26;
  x.radio.setState({enabled:false});assert.equal(x.media.paused,true);assert.equal(x.radio.snapshot().targetGain,0);assert.equal(x.media.currentTime,26);
  x.radio.setState({enabled:true});await flush();assert.equal(x.radio.snapshot().playing,true);assert.equal(x.media.currentTime,26);
  x.radio.setState({paused:true});assert.equal(x.media.paused,true);assert.equal(x.media.currentTime,26);
  x.radio.setState({paused:false});await flush();assert.equal(x.radio.snapshot().playing,true);
  x.radio.stop();assert.equal(x.media.paused,true);assert.equal(x.media.currentTime,0);assert.equal(x.radio.snapshot().active,false);
});

test('late play resolution after home cannot bring music back',async()=>{
  const x=setup(),old=deferred();x.requests.push(old);x.radio.setState({active:true});
  assert.equal(x.radio.snapshot().pending,true);x.radio.stop();x.media.paused=false;old.resolve();await flush();
  assert.equal(x.media.paused,true);assert.equal(x.radio.snapshot().playing,false);assert.equal(x.radio.snapshot().pending,false);assert.equal(x.media.plays,1);
});

test('rapid pause/resume serializes pending requests and ignores old AbortError',async()=>{
  const x=setup(),old=deferred(),latest=deferred();x.requests.push(old,latest);x.radio.setState({active:true});
  x.radio.setState({paused:true});x.radio.setState({paused:false});assert.equal(x.media.plays,1);
  old.reject(new Error('AbortError'));await flush();assert.equal(x.media.plays,2);assert.deepEqual(x.errors,[]);
  latest.resolve();await flush();assert.equal(x.radio.snapshot().playing,true);assert.equal(x.radio.snapshot().pending,false);
});

test('current play rejection is handled once until another explicit user gesture',async()=>{
  const x=setup(),attempt=deferred();x.requests.push(attempt);x.radio.setState({active:true});attempt.reject(new Error('NotAllowedError'));await flush();
  assert.equal(x.radio.snapshot().blocked,true);assert.equal(x.media.paused,true);assert.equal(x.errors.length,1);
  for(let i=0;i<100;i++)x.radio.setState({duck:false});assert.equal(x.media.plays,1);
  await x.radio.unlock();await flush();assert.equal(x.radio.snapshot().playing,true);assert.equal(x.media.plays,2);
});

test('disposal cancels late pending starts, releases nodes and never closes the shared context',async()=>{
  const x=setup(),attempt=deferred();x.requests.push(attempt);x.radio.setState({active:true});x.radio.dispose();x.radio.dispose();
  x.media.paused=false;attempt.resolve();await flush();x.radio.setState({active:true});await x.radio.unlock();
  assert.equal(x.media.paused,true);assert.equal(x.media.src,'');assert.equal(x.media.plays,1);assert.equal(x.listeners.size,0);
  assert(x.gain.disconnected&&x.source.disconnected);assert.equal(x.context.state,'running');assert.equal(x.radio.snapshot().disposed,true);
});

test('media load errors remain non-fatal to driving and cannot auto-retry every frame',async()=>{
  const x=setup();x.radio.prepare();x.media.error={message:'404'};x.listeners.get('error')();
  assert.equal(x.radio.snapshot().blocked,true);assert.deepEqual(x.errors,['404']);
  x.radio.setState({active:true});await flush();assert.equal(x.radio.snapshot().playing,true);
  x.listeners.get('error')();for(let i=0;i<30;i++)x.radio.setState({active:true});
  assert.equal(x.radio.snapshot().playing,false);assert.equal(x.media.plays,1);
});

test('a late play resolution cannot override a current media error',async()=>{
  const x=setup(),attempt=deferred();x.requests.push(attempt);x.radio.setState({active:true});
  x.media.error={message:'decode error'};x.listeners.get('error')();attempt.resolve();await flush();
  assert.equal(x.media.paused,true);assert.equal(x.radio.snapshot().playing,false);assert.equal(x.radio.snapshot().blocked,true);
});
