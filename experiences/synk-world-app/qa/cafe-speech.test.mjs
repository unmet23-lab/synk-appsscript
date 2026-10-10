import test from 'node:test';
import assert from 'node:assert/strict';
import {createCafeSpeech} from '../cafe-ui.mjs';
import {CAFE_VISITS} from '../cafe-activity.mjs';
const listeners=new Map();globalThis.document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
const bank=()=>({version:1,approved:true,clips:Object.fromEntries(CAFE_VISITS.flatMap(v=>v.steps.map((s,i)=>{const id=v.id+'-'+(i+1);return [id,{text:s.staff,file:id+'.mp3',durationSeconds:2}];})))});
class Sound{constructor(url){this.url=url;this.paused=true;this.ended=false;this.currentTime=0;}async play(){this.paused=false;}pause(){this.paused=true;}}
const setup=(data=bank())=>{const sounds=[];const player=createCafeSpeech({asset:p=>'http://127.0.0.1/'+p,fetcher:async()=>({ok:true,json:async()=>data}),audioFactory:url=>{const sound=new Sound(url);sounds.push(sound);return sound;}});return {player,sounds};};
test('incomplete, substituted or untrusted question banks cannot enable listening',async()=>{
 for(const data of [Object.assign(bank(),{approved:false}),(()=>{const b=bank();delete b.clips['cafe-compose-3'];return b;})(),(()=>{const b=bank();b.clips['cafe-compose-1'].text='different question';return b;})(),(()=>{const b=bank();b.clips['cafe-compose-1'].file='../outside.mp3';return b;})()]){const {player,sounds}=setup(data);assert.equal(await player.prepare(),false);assert.equal(sounds.length,0);await assert.rejects(player.play('cafe-apply-1'));player.dispose();}
});
test('pause, visibility and resume keep the exact real media cursor, while a new question replaces it',async()=>{
 const {player,sounds}=setup();assert.equal(await player.prepare(),true);let heard=0;await player.play('cafe-apply-1',()=>heard++);sounds[0].currentTime=.7;
 document.hidden=true;listeners.get('visibilitychange')();assert.equal(player.metrics().phase,'paused');assert.equal(player.metrics().currentTime,.7);
 document.hidden=false;await player.play('cafe-apply-1',()=>heard++);assert.equal(sounds.length,1);assert.equal(player.metrics().currentTime,.7);sounds[0].onended();assert.equal(heard,1);
 await player.play('cafe-compose-1',()=>heard++);assert.equal(sounds.length,2);assert.equal(sounds[0].paused,true);assert.equal(player.metrics().currentTime,0);player.dispose();
});
test('a disposed or replaced sound cannot mark a later question or account as heard',async()=>{
 const {player,sounds}=setup();await player.prepare();let old=0,newer=0;await player.play('cafe-apply-1',()=>old++);const stale=sounds[0].onended;await player.play('cafe-compose-1',()=>newer++);stale();assert.equal(old,0);const late=sounds[1].onended;player.dispose();late();assert.equal(newer,0);assert.equal(listeners.size,0);
});
test('media failure keeps the question uncompleted and allows an explicit retry',async()=>{
 const {player,sounds}=setup();await player.prepare();let heard=false;await player.play('cafe-apply-1',()=>heard=true);sounds[0].onerror();assert.equal(player.metrics().phase,'error');assert.equal(heard,false);await player.play('cafe-apply-1',()=>heard=true);assert.equal(sounds.length,2);sounds[1].onended();assert.equal(heard,true);player.dispose();
});
