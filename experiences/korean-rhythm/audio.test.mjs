import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicPlayer,loadRecording,loadNarration} from './audio.mjs';
test('a missing recording fails instead of falling back to generated music',async()=>{
 await assert.rejects(loadRecording({duration:60},{sampleRate:44100}),/음원 파일/);
});
test('missing narration blocks listening play instead of silently becoming reading',async()=>{
 await assert.rejects(loadNarration(null,{sampleRate:44100}),/나레이션/);
});
test('narration and music are scheduled on one clock with music ducking',()=>{
 const player=new MusicPlayer(),starts=[],ramps=[];
 const context={currentTime:4,createBufferSource:()=>({connect(){},start:t=>starts.push(t)})};
 player.context=context;player.musicGain={gain:{setValueAtTime:(v,t)=>ramps.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>ramps.push(['ramp',v,t])}};player.voiceGain={};player.note=()=>{};
 player.voices=[{q:{id:'q0',showTime:10,voice:{url:'voice.mp3'}},buffer:{duration:7}}];
 player.start({duration:60},.5);
 assert.equal(starts[0],player.origin);assert.equal(starts[1],player.origin+10);
 assert.deepEqual(player.scheduledVoices,[{id:'q0',url:'voice.mp3',start:10,end:17}]);
 assert.ok(ramps.some(r=>r[0]==='ramp'&&r[1]===.06&&r[2]===player.origin+10));
 assert.ok(ramps.some(r=>r[0]==='ramp'&&r[1]===1&&r[2]>player.origin+17));
});
test('pause suspends the common context instead of discarding spoken content',async()=>{
 const player=new MusicPlayer();let suspended=0,resumed=0;player.context={state:'running',suspend:async()=>{suspended++;player.context.state='suspended';},resume:async()=>{resumed++;player.context.state='running';}};
 player.voiceSources=[{id:'active'}];await player.pause();assert.equal(suspended,1);assert.equal(player.voiceSources.length,1);await player.resume();assert.equal(resumed,1);assert.equal(player.voiceSources.length,1);
});
test('sound preference can change before a song and after its audio context is gone',()=>{
  const player=new MusicPlayer();assert.doesNotThrow(()=>player.setSound(false));assert.equal(player.enabled,false);
  // The old round had a gain node, but its context is already released.
  player.master={gain:{setTargetAtTime:()=>assert.fail('a released context must not be used')}};
  assert.doesNotThrow(()=>player.setSound(true));assert.equal(player.enabled,true);
});
test('stopping releases the source, context and old gain while retaining the mute preference',()=>{
  const player=new MusicPlayer();let stopped=false,disconnected=false,closed=false;
  player.source={stop:()=>{stopped=true},disconnect:()=>{disconnected=true}};
  player.context={state:'running',close:()=>{closed=true;return Promise.resolve()}};player.master={};player.enabled=false;player.stop();
  assert.ok(stopped&&disconnected&&closed);assert.equal(player.context,null);assert.equal(player.master,null);assert.equal(player.source,null);assert.equal(player.enabled,false);assert.doesNotThrow(()=>player.setSound(true));assert.doesNotThrow(()=>player.stop());
});
