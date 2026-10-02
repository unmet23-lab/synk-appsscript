// Real SYNK Suno recordings. Oscillators are only countdown and key feedback.
const cache=new Map();
const voiceCache=new Map();
const frequency=m=>440*2**((m-69)/12);
export async function loadRecording(track,context,signal){
 if(!track.audioUrl)throw new Error('이 곡의 음원 파일을 찾지 못했어요.');
 const key=track.audioUrl+'@'+context.sampleRate;
 if(cache.has(key))return cache.get(key);
 const response=await fetch(track.audioUrl,{signal});
 if(!response.ok)throw new Error('곡을 불러오지 못했어요. 연결을 확인하고 다시 시작해 주세요.');
 const bytes=await response.arrayBuffer();if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const buffer=await context.decodeAudioData(bytes);
 if(!Number.isFinite(buffer.duration)||Math.abs(buffer.duration-track.duration)>.15)throw new Error('음원과 노트의 길이가 달라요. 새로고침한 뒤 다시 시작해 주세요.');
 cache.clear();cache.set(key,buffer);return buffer;
}
export async function loadNarration(voice,context,signal){
 if(!voice?.url||!(voice.duration>0))throw new Error('이 문항의 나레이션을 찾지 못했어요.');
 const key=voice.url+'@'+context.sampleRate;
 if(voiceCache.has(key))return voiceCache.get(key);
 const response=await fetch(voice.url,{signal});
 if(!response.ok)throw new Error('나레이션을 불러오지 못했어요. 다시 시작해 주세요.');
 const buffer=await context.decodeAudioData(await response.arrayBuffer());
 if(Math.abs(buffer.duration-voice.duration)>.15)throw new Error('나레이션의 길이가 달라요. 새로고침해 주세요.');
 voiceCache.set(key,buffer);return buffer;
}
export class MusicPlayer{
 constructor({onDelivery=()=>{}}={}){this.onDelivery=onDelivery;this.context=null;this.source=null;this.origin=0;this.master=null;this.musicGain=null;this.voiceGain=null;this.voiceSources=[];this.voices=[];this.scheduledVoices=[];this.enabled=true;this.analyser=null;this.voiceAnalyser=null;this.recording=null;this.abort=null;}
 async prepare(track,questions=[]){
  this.stop();const context=new AudioContext({latencyHint:'interactive'});this.context=context;this.abort=new AbortController();await context.resume();
  this.master=context.createGain();this.master.gain.value=.7;this.musicGain=context.createGain();this.musicGain.gain.value=this.enabled?1:0;this.musicGain.connect(this.master);
  this.voiceGain=context.createGain();this.voiceGain.gain.value=1.25;this.voiceAnalyser=context.createAnalyser();this.voiceAnalyser.fftSize=2048;this.voiceGain.connect(this.voiceAnalyser);this.voiceAnalyser.connect(this.master);this.analyser=context.createAnalyser();this.analyser.fftSize=2048;
  this.master.connect(this.analyser);this.analyser.connect(context.destination);
  const buffer=await loadRecording(track,context,this.abort.signal);
  this.voices=await Promise.all(questions.map(async q=>({q,buffer:await loadNarration(q.voice,context,this.abort.signal)})));
  if(this.context!==context||context.state==='closed')throw new DOMException('Cancelled','AbortError');
  this.recording={title:track.title,sourceId:track.sourceId,url:track.audioUrl,duration:buffer.duration,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels};return buffer;
 }
 start(buffer,beat){
  this.origin=this.context.currentTime+4*beat+.12;this.source=this.context.createBufferSource();this.source.buffer=buffer;this.source.loop=false;this.source.connect(this.musicGain);this.source.start(this.origin);
  for(const {q,buffer:voiceBuffer} of this.voices){
   const start=this.origin+q.showTime,end=start+voiceBuffer.duration,source=this.context.createBufferSource();
   const context=this.context;source.onended=()=>{if(this.context===context&&context.state!=='closed'&&context.currentTime>=end-.03)this.onDelivery(q,{audio:'completed'});};
   source.buffer=voiceBuffer;source.connect(this.voiceGain);source.start(start);this.voiceSources.push(source);
   this.scheduledVoices.push({id:q.id,url:q.voice.url,start:q.showTime,end:q.showTime+voiceBuffer.duration});
   const gain=this.musicGain.gain,level=this.enabled?1:0;
   gain.setValueAtTime(level,start-.12);gain.linearRampToValueAtTime(level*.06,start);gain.setValueAtTime(level*.06,end+.15);gain.linearRampToValueAtTime(level,end+.7);
  }
  for(let i=0;i<4;i++)this.note(76,this.origin-(4-i)*beat,.13,.045);
 }
 get time(){return this.context?this.context.currentTime-this.origin:0;}
 get state(){return this.context?.state||'closed';}
 get signalLevel(){if(!this.analyser)return 0;const data=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length);}
 get voiceLevel(){if(!this.voiceAnalyser)return 0;const data=new Float32Array(this.voiceAnalyser.fftSize);this.voiceAnalyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length);}
 get activeVoice(){return this.scheduledVoices.find(v=>this.time>=v.start&&this.time<v.end)||null;}
 async pause(){if(this.context?.state==='running')await this.context.suspend();}
 async resume(){if(this.context?.state==='suspended')await this.context.resume();}
 setSound(enabled){this.enabled=enabled;if(this.musicGain&&this.context&&this.context.state!=='closed'){this.musicGain.gain.cancelScheduledValues(this.context.currentTime);const level=enabled?(this.activeVoice?.06:1):0;this.musicGain.gain.setTargetAtTime(level,this.context.currentTime,.02);
  for(const v of this.scheduledVoices){const start=this.origin+v.start,end=this.origin+v.end;if(end<=this.context.currentTime)continue;const gain=this.musicGain.gain;if(start>this.context.currentTime){gain.setValueAtTime(enabled?1:0,start-.12);gain.linearRampToValueAtTime(enabled?.06:0,start);}gain.setValueAtTime(enabled?.06:0,end+.15);gain.linearRampToValueAtTime(enabled?1:0,end+.7);}
 }}
 note(midi,time=this.context?.currentTime,len=.16,gain=.035){if(!this.context||this.context.state==='closed')return;const o=this.context.createOscillator(),g=this.context.createGain();o.type='sine';o.frequency.value=frequency(midi);g.gain.setValueAtTime(gain,time);g.gain.exponentialRampToValueAtTime(.0001,time+len);o.connect(g);g.connect(this.musicGain);o.start(time);o.stop(time+len+.01);}
 hit(lane){this.note([72,76,79,81][lane]);}
 async review(voice){this.stop();const context=new AudioContext();this.context=context;await context.resume();const buffer=await loadNarration(voice,context);if(this.context!==context)throw new DOMException('Cancelled','AbortError');this.source=context.createBufferSource();this.source.buffer=buffer;this.source.connect(context.destination);this.source.start();return new Promise(resolve=>{this.source.onended=resolve;});}
 stop(){this.abort?.abort();this.abort=null;for(const source of this.voiceSources){try{source.stop();}catch{}source.disconnect();}this.voiceSources=[];this.voices=[];this.scheduledVoices=[];if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}if(this.context&&this.context.state!=='closed')this.context.close().catch(()=>{});this.context=null;this.master=null;this.musicGain=null;this.voiceGain=null;this.voiceAnalyser=null;this.analyser=null;this.recording=null;}
}
