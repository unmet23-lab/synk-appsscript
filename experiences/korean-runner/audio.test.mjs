import test from 'node:test';
import assert from 'node:assert/strict';
import {InstructionAudio} from './audio.mjs';
function fixture(fetchClip=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})) {
  const sources=[];
  const context={state:'running',currentTime:0,decodeAudioData:async()=>({duration:4}),
    async suspend(){this.state='suspended';},async resume(){this.state='running';},
    createBufferSource(){const s={connect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(s);return s;}};
  return {context,sources,voice:new InstructionAudio(context,{}, {gain:{value:.13}},fetchClip)};
}
test('all clips must load; missing files are retried without replacing loaded clips',async()=>{
  let failed=true,requests=[];
  const {voice}=fixture(async path=>{requests.push(path);return{ok:!path.includes('right')||!failed,arrayBuffer:async()=>new ArrayBuffer(1)};});
  const items=[{id:'left'},{id:'right'}];
  assert.equal(await voice.prepare(items),false);assert.equal(voice.play(items[1]),false);
  failed=false;assert.equal(await voice.prepare(items),true);
  assert.equal(requests.filter(p=>p.includes('left')).length,1);
  assert.equal(requests.filter(p=>p.includes('right')).length,2);
});
test('pause and resume keep the current source and its playback position',async()=>{
  const {voice,context,sources}=fixture();await voice.prepare([{id:'left'}]);
  assert.equal(voice.play({id:'left'}),true);context.currentTime=1.75;
  await voice.pause();assert.equal(voice.info.offset,1.75);assert.equal(sources[0].stopped,undefined);
  assert.equal(voice.play({id:'left'}),false);assert.equal(sources.length,1);
  await voice.resume();assert.equal(voice.info.id,'left');assert.equal(voice.info.offset,1.75);assert.equal(sources.length,1);
});
test('next instruction stops the previous clip; completed clips restore music gain',async()=>{
  const {voice,sources}=fixture();await voice.prepare([{id:'left'},{id:'right'}]);
  voice.play({id:'left'});voice.play({id:'right'});
  assert.equal(sources[0].stopped,true);assert.equal(voice.info.id,'right');
  sources[1].onended();assert.equal(voice.info.id,null);assert.equal(voice.musicGain.gain.value,.13);
});

test('delivery marks a clip completed only on its actual ended event',async()=>{
  const {voice,sources}=fixture(),states=[];voice.onState=(state,item)=>states.push([state,item.id]);
  assert.equal(voice.play({id:'left'}),false);assert.deepEqual(states,[['failed','left']]);
  await voice.prepare([{id:'left'}]);voice.play({id:'left'});assert.equal(states.at(-1)[0],'pending');
  sources.at(-1).onended();assert.equal(states.at(-1)[0],'completed');
});
