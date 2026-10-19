import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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

test('the shipped voice manifest opens the voice gate and any other provider value keeps it closed',async()=>{
  const manifest=JSON.parse(await readFile(new URL('./assets/audio/manifest.json',import.meta.url),'utf8'));
  const saved=['AudioContext','fetch'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]);
  globalThis.AudioContext=class{state='running';resume(){return Promise.resolve();}decodeAudioData(){return Promise.resolve({duration:1,numberOfChannels:1,getChannelData:()=>Float32Array.of(0,.3,-.3)});}};
  try{
    for(const[provider,opens]of[[manifest.provider,true],['os-tts',false]]){
      globalThis.fetch=async url=>String(url).endsWith('/manifest.json')?{ok:true,json:async()=>({...manifest,provider})}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};
      if(opens)assert.equal((await new VoiceBank().prepare()).ready,true);
      else await assert.rejects(new VoiceBank().prepare(),/Korean voices are being prepared/);
    }
  }finally{for(const[name,descriptor]of saved)descriptor?Object.defineProperty(globalThis,name,descriptor):delete globalThis[name];}
});
