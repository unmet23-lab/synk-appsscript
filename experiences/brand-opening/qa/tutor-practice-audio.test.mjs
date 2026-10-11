import test from 'node:test';
import assert from 'node:assert/strict';
async function fixture(t){
 const clips=[];
 t.mock.method(globalThis,'fetch',async url=>({ok:true,json:async()=>String(url).endsWith('voices.json')?{approved:true,clips:{아:'a.mp3'}}:null}));
 const previous=Object.getOwnPropertyDescriptor(globalThis,'Audio');
 Object.defineProperty(globalThis,'Audio',{configurable:true,value:class{constructor(url){this.url=url;this.paused=true;this.plays=0;clips.push(this);}play(){this.paused=false;this.plays++;return Promise.resolve();}pause(){this.paused=true;}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'Audio',previous);else delete globalThis.Audio;});
 const audio=await import('../../hangul-stage/audio.mjs?practice='+Math.random());
 audio.initAudio();await new Promise(resolve=>setImmediate(resolve));
 return {audio,clips};
}
test('the selected tutor pauses and resumes the same real clip without claiming completion or restarting ended audio',async t=>{
 const {audio,clips}=await fixture(t);
 let settled=false;const heard=audio.say('아').then(ok=>{settled=true;return ok;});
 audio.pauseForTutor();assert.equal(clips[0].paused,true);await Promise.resolve();assert.equal(settled,false);
 audio.resumeFromTutor();assert.equal(clips.length,1);assert.equal(clips[0].plays,2);assert.equal(clips[0].paused,false);
 clips[0].onended();assert.equal(await heard,true);
 audio.pauseForTutor();audio.resumeFromTutor();assert.equal(clips[0].plays,2,'an ended clip cannot start again when the guide closes');
});
test('voices requested behind the practice wait, and a cancelled clip resolves as unheard even if an old ended event arrives',async t=>{
 const {audio,clips}=await fixture(t);
 audio.pauseForTutor();const delayed=audio.say('아');assert.equal(clips.length,0);
 audio.resumeFromTutor();await Promise.resolve();assert.equal(clips.length,1);
 audio.stop();assert.equal(await delayed,false);clips[0].onended();
 const second=audio.say('아');clips[1].onended();assert.equal(await second,true);
});
