import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicPlayer,loadRecording,loadNarration} from './audio.mjs';
test('a missing recording fails instead of falling back to generated music',async()=>{
 await assert.rejects(loadRecording({duration:60},{sampleRate:44100}),/음원 파일/);
});
test('missing narration blocks listening play instead of silently becoming reading',async()=>{
 await assert.rejects(loadNarration(null,{sampleRate:44100}),/소리 파일/);
});
const fakeContext=(state='suspended')=>{
 const c={state,sampleRate:44100,currentTime:0,destination:{},calls:[],
  suspend:async()=>{c.calls.push('suspend');c.state='suspended'},resume:async()=>{c.calls.push('resume');c.state='running'},close:async()=>{c.calls.push('close');c.state='closed'},
  createGain:()=>({gain:{value:1},connect(){},disconnect(){c.calls.push('gain-out')}}),createAnalyser:()=>({connect(){},disconnect(){c.calls.push('analyser-out')}}),
  createBufferSource:()=>({connect(){},disconnect(){},start(){},stop(){}})};
 return c;
};
const withContexts=async(fn)=>{
 const made=[],had=globalThis.AudioContext;
 globalThis.AudioContext=class{constructor(options){const c=fakeContext();c.options=options;made.push(c);return c}};
 try{await fn(made)}finally{globalThis.AudioContext=had}
};
const song={title:'곡',sourceId:'s',audioUrl:'song.mp3',duration:60};
test('by default every song opens and closes its own context',async()=>withContexts(async(made)=>{
 const player=new MusicPlayer();player.recordingSource=async()=>({duration:60,sampleRate:44100,numberOfChannels:2});
 await player.prepare(song);player.stop();await player.prepare(song);
 assert.equal(made.length,2);assert.ok(made[0].calls.includes('close'));assert.equal(player.spare,null);
}));
test('keepContext suspends instead of closing and reuses the context, cutting its sound paths',async()=>withContexts(async(made)=>{
 const player=new MusicPlayer();let parked=0;player.keepContext=true;player.onPark=()=>{parked++};
 player.recordingSource=async()=>({duration:60,sampleRate:44100,numberOfChannels:2});
 await player.prepare(song);const first=player.context;player.stop();
 assert.equal(player.context,null);assert.equal(player.state,'closed');assert.equal(player.spare,first);assert.equal(parked,1);
 assert.ok(first.calls.includes('suspend'));assert.ok(!first.calls.includes('close'));assert.ok(first.calls.includes('analyser-out'));
 await player.prepare(song);
 assert.equal(made.length,1);assert.equal(player.context,first);assert.equal(player.state,'running');assert.equal(player.spare,null);
 assert.ok(player.time<-0.15,'a reused clock must not point into the previous song while the next one loads');
}));
test('a context interrupted by the phone or dropped while hidden is not reused',async()=>withContexts(async(made)=>{
 const player=new MusicPlayer();player.keepContext=true;player.recordingSource=async()=>({duration:60,sampleRate:44100,numberOfChannels:2});
 await player.prepare(song);const first=player.context;player.stop();first.state='interrupted';
 await player.prepare(song);assert.equal(made.length,2);assert.notEqual(player.context,first);assert.ok(first.calls.includes('close'));
 const second=player.context;player.stop();player.dropSpare();assert.equal(player.spare,null);assert.ok(second.calls.includes('close'));
}));
test('a cancelled request stays cancelled even though the next one reuses the same context',async()=>withContexts(async(made)=>{
 const player=new MusicPlayer();player.keepContext=true;let release;
 player.recordingSource=()=>new Promise((resolve)=>{release=()=>resolve({duration:60,sampleRate:44100,numberOfChannels:2})});
 const older=player.prepare(song);await new Promise((r)=>setTimeout(r));
 const holdOlder=release;player.recordingSource=async()=>({duration:60,sampleRate:44100,numberOfChannels:2});
 const newer=player.prepare(song);await newer;
 holdOlder();await assert.rejects(older,{name:'AbortError'});
 assert.equal(made.length,1);assert.equal(player.state,'running');
}));
test('stopping a replay on a parked context settles it as cut off, not as heard to the end',async()=>withContexts(async()=>{
 const player=new MusicPlayer(),had=globalThis.fetch;player.keepContext=true;
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
 try{
  const AC=globalThis.AudioContext;
  globalThis.AudioContext=class extends AC{constructor(o){const c=super(o);c.decodeAudioData=async()=>({duration:2});return c}};
  const heard=player.review({url:'stop-replay.mp3',duration:2});await new Promise((r)=>setTimeout(r,5));
  player.stop();await assert.rejects(heard,{name:'AbortError'});
 }finally{globalThis.fetch=had}
}));
test('a finished replay settles as heard and parks the context for the next song',async()=>withContexts(async(made)=>{
 const player=new MusicPlayer(),had=globalThis.fetch;player.keepContext=true;
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
 try{
  const AC=globalThis.AudioContext;let source;
  globalThis.AudioContext=class extends AC{constructor(o){const c=super(o);c.decodeAudioData=async()=>({duration:2});const make=c.createBufferSource;c.createBufferSource=()=>{source=make();return source};return c}};
  const heard=player.review({url:'finish-replay.mp3',duration:2});await new Promise((r)=>setTimeout(r,5));
  source.onended();await heard;
  assert.equal(player.context,null);assert.equal(player.spare,made[0]);assert.ok(made[0].calls.includes('suspend'));
 }finally{globalThis.fetch=had}
}));
test('a reused context that refuses to wake is dropped so the next press recovers',async()=>withContexts(async(made)=>{
 const player=new MusicPlayer();player.keepContext=true;player.recordingSource=async()=>({duration:60,sampleRate:44100,numberOfChannels:2});
 await player.prepare(song);const first=player.context;player.stop();
 first.resume=async()=>{throw new Error('no')};
 await assert.rejects(player.prepare(song),/no/);
 assert.equal(player.context,null);assert.equal(player.spare,null);assert.ok(first.calls.includes('close'));
 player.stop();await player.prepare(song);
 assert.equal(made.length,2);assert.notEqual(player.context,first);assert.equal(player.state,'running');
}));
test('a wake that never settles fails in time and is not parked for reuse, even if the player stops meanwhile',async()=>withContexts(async(made)=>{
 const player=new MusicPlayer();player.keepContext=true;player.wakeLimit=5;player.recordingSource=async()=>({duration:60,sampleRate:44100,numberOfChannels:2});
 await player.prepare(song);const first=player.context;player.stop();
 first.resume=()=>new Promise(()=>{});
 const hung=player.prepare(song);player.stop();
 await assert.rejects(hung);
 assert.equal(player.spare,null);assert.ok(first.calls.includes('close'));
 await player.prepare(song);assert.equal(made.length,2);assert.equal(player.state,'running');
}));
test('a brand-new context may take as long as the sound device needs',async()=>withContexts(async(made)=>{
 const player=new MusicPlayer(),AC=globalThis.AudioContext;player.keepContext=true;player.wakeLimit=5;player.recordingSource=async()=>({duration:60,sampleRate:44100,numberOfChannels:2});
 globalThis.AudioContext=class extends AC{constructor(o){const c=super(o),wake=c.resume;c.resume=()=>new Promise((done)=>setTimeout(()=>wake().then(done),30));return c}};
 await player.prepare(song);
 assert.equal(made.length,1);assert.equal(player.state,'running');
}));
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
