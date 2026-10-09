import {VOICE_LINES, VOICE_TEXT_VERSION} from './voice-lines.mjs';

/** One recorded Korean voice at a time. Scene changes invalidate pending fetches. */
export class StoryVoice {
 constructor({audio,onStatus=()=>{},onStarted=()=>{},fetcher=(...args)=>globalThis.fetch(...args),hash=globalThis.crypto?.subtle}={}){
  this.audio=audio;this.onStatus=onStatus;this.onStarted=onStarted;this.fetcher=fetcher;this.hash=hash;
  this.automatic=true;this.readingOnly=false;this.generation=0;this.source=null;this.buffers=new Map();this.manifest=null;this.loading=null;this.currentId=null;this.state='idle';
  this.visibility=()=>{if(globalThis.document?.hidden)this.stop('잠시 멈췄어요. 돌아오면 다시 듣기를 눌러 주세요.');};
  globalThis.document?.addEventListener('visibilitychange',this.visibility);
 }
 status(state,message,id=null){this.state=state;this.currentId=id;this.onStatus({state,message,id});}
 async prepare(){
  if(this.manifest)return this.manifest;
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   const response=await this.fetcher(new URL('./assets/voice/manifest.json',import.meta.url));
   if(!response.ok)throw new Error('음성 목록을 불러오지 못했어요. 다시 듣기로 재시도해 주세요.');
   const manifest=await response.json();
   if(manifest.textVersion!==VOICE_TEXT_VERSION||!Array.isArray(manifest.lines)||manifest.lines.length!==VOICE_LINES.length)throw new Error('이야기와 음성의 판본이 달라요. 새로고침해 주세요.');
   const entries=new Map(manifest.lines.map(line=>[line.id,line]));
   for(const line of VOICE_LINES){const item=entries.get(line.id);if(!item||item.text!==line.text||item.speaker!==line.speaker||!/^assets\/voice\/[a-z0-9-]+\.mp3$/.test(item.file)||!/^[a-f0-9]{64}$/.test(item.sha256))throw new Error('이야기와 음성의 문장이 달라요. 새로고침해 주세요.');}
   this.manifest=entries;return entries;
  })();
  try{return await this.loading;}finally{this.loading=null;}
 }
 stop(message=''){
  ++this.generation;if(this.source){this.source.onended=null;try{this.source.stop();}catch{}try{this.source.disconnect();this.gain?.disconnect();}catch{}this.source=null;}
  this._resolve?.();this._resolve=null;
  this.audio?.duckVoice?.(false);this.status('idle',message||'다시 듣기로 현재 글을 들을 수 있어요.');
 }
 async speak(lines,{manual=false}={}){
  this.stop();const generation=this.generation;
  const queue=lines.filter(Boolean);
  if(this.readingOnly){this.status('reading','소리 없이 글만 읽는 중이에요.');return false;}
  if(!this.audio?.enabled){this.status('muted','소리가 꺼져 있어요.');return false;}
  if(!manual&&!this.automatic)return false;
  if(!queue.length)return false;
  try{
   // Context resume runs before awaiting fetch so a replay click can unlock it.
   if(!this.audio.context||this.audio.context.state!=='running')await this.audio.start();
   if(generation!==this.generation||!this.audio.enabled||this.readingOnly)return false;
   if(!this.audio.context||this.audio.context.state!=='running')throw new Error('음성을 시작하려면 다시 듣기를 눌러 주세요.');
   this.status('loading','한국어 음성을 준비하고 있어요.');const manifest=await this.prepare();
   for(const line of queue){
    if(generation!==this.generation||!this.audio.enabled||this.readingOnly)return false;
    const item=manifest.get(line.id);if(!item||item.text!==line.text)throw new Error('이 글의 음성을 확인하지 못했어요.');
    let buffer=this.buffers.get(line.id);
    if(!buffer){
     const response=await this.fetcher(new URL('./'+item.file,import.meta.url));if(!response.ok)throw new Error('음성을 불러오지 못했어요. 다시 듣기로 재시도해 주세요.');
     const bytes=await response.arrayBuffer();
     if(this.hash){const digest=await this.hash.digest('SHA-256',bytes);const hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(hex!==item.sha256)throw new Error('음성 파일을 확인하지 못했어요. 새로고침해 주세요.');}
     buffer=await this.audio.context.decodeAudioData(bytes.slice(0));this.buffers.set(line.id,buffer);
    }
    if(generation!==this.generation||!this.audio.enabled||this.readingOnly)return false;
    await new Promise(resolve=>{
     const source=this.audio.context.createBufferSource(),gain=this.audio.context.createGain();
     source.buffer=buffer;gain.gain.value=.82;source.connect(gain);gain.connect(this.audio.context.destination);
     this.source=source;this.gain=gain;this._resolve=resolve;
     source.onended=()=>{gain.disconnect();source.disconnect();if(this.source===source){this.source=null;this._resolve=null;}resolve();};
     this.audio.duckVoice?.(true);source.start();
     this.status('playing','한국어 음성을 듣고 있어요.',line.id);this.onStarted(line);
    });
   }
   if(generation!==this.generation||!this.audio.enabled||this.readingOnly)return false;
   this.audio.duckVoice?.(false);this.status('ready','다시 듣기로 현재 글을 한 번 더 들을 수 있어요.');return true;
  }catch(error){if(generation===this.generation){this.audio.duckVoice?.(false);this.status('error',/^[가-힣]/.test(error.message)?error.message:'음성을 불러오지 못했어요. 다시 듣기로 재시도해 주세요.');}return false;}
 }
 destroy(){this.stop();globalThis.document?.removeEventListener('visibilitychange',this.visibility);this.buffers.clear();}
}
