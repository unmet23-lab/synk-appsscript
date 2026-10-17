import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceBank} from './audio.mjs';

test('leaving before an audio context resumes never starts the queued voice',async()=>{
  let resume,starts=0;
  const bank=new VoiceBank();bank.ready=true;bank.buffers.set('red',{});
  bank.context={state:'running',resume:()=>new Promise(resolve=>resume=resolve),createBufferSource(){starts++;throw Error('A cancelled voice must not be created.');}};
  const playing=bank.play('red');bank.stop();resume();
  assert.equal(await playing,false);assert.equal(starts,0);
});

test('a newer sound cancels an older pending resume without cancelling itself',async()=>{
  const pending=[];const sources=[];
  const bank=new VoiceBank();bank.ready=true;bank.buffers.set('red',{word:'red'});bank.buffers.set('blue',{word:'blue'});
  bank.context={state:'running',resume:()=>new Promise(resolve=>pending.push(resolve)),createBufferSource(){const source={connect(){},start(){sources.push(this);},stop(){this.onended();}};return source;}};
  const first=bank.play('red'),second=bank.play('blue');pending[0]();pending[1]();
  assert.equal(await first,false);await Promise.resolve();assert.equal(sources.length,1);assert.equal(sources[0].buffer.word,'blue');
  sources[0].onended();assert.equal(await second,true);
});
