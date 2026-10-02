// Local clips are required for a run. Context suspension preserves clip position.
export class InstructionAudio {
  constructor(context, voiceGain, musicGain, fetchClip=url=>fetch(url), onState=()=>{}) {
    this.context=context;this.voiceGain=voiceGain;this.musicGain=musicGain;
    this.onState=onState;
    this.fetchClip=fetchClip;this.buffers=new Map();this.loading=null;this.source=null;this.id=null;this.started=0;
  }
  async prepare(items) {
    if(!this.loading)this.loading=Promise.all(items.filter(item=>!this.buffers.has(item.id)).map(async item=>{
      try {
        const response=await this.fetchClip(`./assets/voice/${item.id}.mp3`);
        if(!response.ok)throw Error('Missing instruction audio');
        const buffer=await this.context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(item.id,buffer);
      } catch { /* A missing clip prevents play; a later attempt retries it. */ }
    }));
    await this.loading;this.loading=null;
    return items.every(item=>this.buffers.has(item.id));
  }
  play(item) {
    if(this.context.state!=='running'||!this.buffers.has(item.id)){this.onState('failed',item);return false;}
    this.stop();const source=this.context.createBufferSource();source.buffer=this.buffers.get(item.id);
    source.connect(this.voiceGain);this.source=source;this.id=item.id;this.started=this.context.currentTime;
    this.musicGain.gain.value=.028;
    source.onended=()=>{if(this.source===source){this.source=null;this.id=null;this.musicGain.gain.value=.13;this.onState('completed',item);}};
    source.start();this.onState('pending',item);return true;
  }
  stop() {
    if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source=null;}
    this.id=null;this.musicGain.gain.value=.13;
  }
  pause(){return this.context.state==='running'?this.context.suspend():Promise.resolve();}
  async resume(){if(this.context.state==='suspended')await this.context.resume();return this.context.state==='running';}
  get info(){return {state:this.context.state,clips:this.buffers.size,id:this.id,offset:this.source?this.context.currentTime-this.started:0,duration:this.source?.buffer.duration||0};}
}
