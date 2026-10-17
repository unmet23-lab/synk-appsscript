export const WORDS=Object.freeze({red:'빨간색',blue:'파란색',up:'위',down:'아래',one:'한 번',two:'두 번',three:'세 번'});
export class VoiceBank {
  constructor(){this.context=null;this.buffers=new Map();this.source=null;this.ready=false;this.manifest=null;this.playbackVersion=0;}
  async prepare(){
    this.context ||= new AudioContext();await this.context.resume();
    const response=await fetch(new URL('./assets/audio/manifest.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('한국어 음성을 불러오지 못했어요. / Voice files are unavailable.');
    const manifest=await response.json();
    if(manifest.version!==1||manifest.provider!=='typecast'||manifest.approved!==true)throw new Error('한국어 음성을 준비하고 있어요. 준비가 끝나면 탐험을 시작할 수 있어요. / Korean voices are being prepared.');
    const entries=await Promise.all(Object.entries(WORDS).map(async([key,text])=>{
      const clip=manifest.clips?.[key];
      if(clip?.text!==text||!/^[-a-zA-Z0-9_]+\.(mp3|wav)$/.test(clip.src))throw new Error('음성 목록을 확인해 주세요. / Voice manifest mismatch.');
      if(!/^[a-f0-9]{64}$/.test(clip.sha256||''))throw new Error('음성의 확인 기록이 없어요. / Voice verification is missing.');
      const integrity='sha256-'+btoa(String.fromCharCode(...clip.sha256.match(/../g).map(x=>parseInt(x,16))));
      const r=await fetch(new URL(`./assets/audio/${clip.src}`,import.meta.url),{signal:AbortSignal.timeout(15000),integrity});
      if(!r.ok)throw new Error('필수 음성이 빠져 있어요. / A required voice is missing.');
      const bytes=await r.arrayBuffer();
      const decoded=await this.context.decodeAudioData(bytes);
      if(decoded.duration<.12||decoded.duration>12)throw new Error('음성 파일의 길이를 확인해 주세요. / Invalid voice duration.');
      let peak=0;for(let ch=0;ch<decoded.numberOfChannels;ch++){const data=decoded.getChannelData(ch);for(let n=0;n<data.length;n++)peak=Math.max(peak,Math.abs(data[n]));}
      if(peak<.005)throw new Error('한국어 음성이 들리지 않는 파일이에요. / The voice file is silent.');
      return[key,decoded];
    }));
    this.buffers=new Map(entries);this.ready=true;this.manifest=manifest;return this;
  }
  stop(){this.playbackVersion++;if(this.source){this.source.cancelled=true;this.source.stop();this.source=null;}}
  async play(key){
    if(!this.ready||!this.buffers.has(key))throw new Error('먼저 소리를 준비해 주세요. / Enable audio first.');
    this.stop();const version=this.playbackVersion;await this.context.resume();if(version!==this.playbackVersion)return false;
    if(this.context.state!=='running')throw new Error('다시 듣기를 눌러 소리를 켜 주세요. / Tap Listen again to enable audio.');
    const source=this.context.createBufferSource();source.buffer=this.buffers.get(key);source.connect(this.context.destination);this.source=source;
    return new Promise(resolve=>{source.onended=()=>{if(this.source===source)this.source=null;resolve(!source.cancelled);};source.start();});
  }
  effect(kind){
    if(this.context?.state!=='running')return;
    const t=this.context.currentTime;const tones=kind==='repair'?[523.25,659.25,783.99]:kind==='launch'?[392,523.25,659.25,783.99]:[220,330];
    tones.forEach((frequency,i)=>{const osc=this.context.createOscillator(),gain=this.context.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency,t+i*.11);gain.gain.setValueAtTime(0,t+i*.11);gain.gain.linearRampToValueAtTime(.045,t+i*.11+.018);gain.gain.exponentialRampToValueAtTime(.001,t+i*.11+.25);osc.connect(gain).connect(this.context.destination);osc.start(t+i*.11);osc.stop(t+i*.11+.27);});
  }
}
