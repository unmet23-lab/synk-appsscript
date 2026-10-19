import {SPELLS} from './content.mjs';
/** MP3 only. No speechSynthesis, fallback voice, or claimed completion without ended. */
export class VoiceBank{
 constructor(){this.context=null;this.buffers=new Map();this.ready=false;this.source=null;this.pending=null;this.revision=0;}
 async prepare(){
  // Resume in the initiating click's synchronous section. Do not spend its user activation
  // on manifest/image fetches before asking mobile browsers to unlock the AudioContext.
  const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw Error('unsupported');
  this.context ||=new C();const resumed=this.context.resume();resumed.catch(()=>{});
  if(this.ready){await resumed;return;}
  const r=await fetch(new URL('./audio/manifest.json',import.meta.url),{cache:'no-cache'});if(!r.ok)throw Error('manifest');
  const m=await r.json();if(m.approved!==true)throw Error('unapproved');
  await resumed;
  const rows=await Promise.all(Object.keys(SPELLS).map(async id=>{
   const clip=m.clips?.[id];if(!clip||clip.text!==SPELLS[id].ko||!/^[-\w]+\.mp3$/.test(clip.file))throw Error('manifest');
   const res=await fetch(new URL(`./audio/${clip.file}`,import.meta.url));if(!res.ok)throw Error(`missing:${id}`);
   const buffer=await this.context.decodeAudioData(await res.arrayBuffer());if(buffer.duration<.12||buffer.duration>12)throw Error(`duration:${id}`);return [id,buffer];
  }));this.buffers=new Map(rows);this.ready=true;
 }
 async play(id){
  this.stop();if(!this.ready||!this.buffers.has(id))return false;
  const rev=++this.revision;await this.context.resume();if(rev!==this.revision)return false;
  return new Promise(resolve=>{
   const source=this.context.createBufferSource();source.buffer=this.buffers.get(id);source.connect(this.context.destination);this.source=source;this.pending=resolve;
   const timer=setTimeout(()=>{if(rev===this.revision)this.stop();},(source.buffer.duration+2)*1000);
   source.onended=()=>{clearTimeout(timer);if(rev!==this.revision)return;this.source=null;this.pending=null;resolve(true);};
   try{source.start();}catch{clearTimeout(timer);this.source=null;this.pending=null;resolve(false);}
  });
 }
 stop(){this.revision++;if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source=null;}this.pending?.(false);this.pending=null;}
 tone(done=false){if(!this.context||this.context.state!=='running')return;const now=this.context.currentTime;[523.25,...(done?[659.25,783.99]:[])].forEach((f,i)=>{const o=this.context.createOscillator(),g=this.context.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,now+i*.075);g.gain.linearRampToValueAtTime(.028,now+i*.075+.01);g.gain.exponentialRampToValueAtTime(.001,now+i*.075+.15);o.connect(g);g.connect(this.context.destination);o.start(now+i*.075);o.stop(now+i*.075+.17);});}
}
