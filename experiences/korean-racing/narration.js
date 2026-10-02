export class Narrator {
  constructor({getContext,onActive,onUnavailable,onDelivery=()=>{}}){this.getContext=getContext;this.onActive=onActive;this.onUnavailable=onUnavailable;this.onDelivery=onDelivery;this.cache=new Map();this.queue=[];this.token=0;this.playing=false;this.activeKind=null;this.history=[];}
  async prepare(ids){await Promise.all([...new Set(ids)].map(id=>this.load(id).catch(()=>null)));}
  async load(id){
    if(!this.cache.has(id)){
      if(this.cache.size>=48)this.cache.delete(this.cache.keys().next().value);
      this.cache.set(id,fetch(`./assets/narration/${id}.mp3`).then(r=>{if(!r.ok)throw Error('Narration missing: '+id);return r.arrayBuffer();}).catch(error=>{this.cache.delete(id);throw error;}));
    }
    return this.cache.get(id);
  }
  speak(ids,text,kind='comment',{interrupt=false,presentationId=null}={}){
    if(interrupt)this.cancel();
    this.queue.push({ids,text,kind,presentationId});if(!this.playing)this.drain();
  }
  async drain(){
    const ticket=++this.token;this.playing=true;this.onActive(true);
    while(this.queue.length&&ticket===this.token){
      const item=this.queue.shift();this.activeKind=item.kind;
      let delivered=true;
      try {
        for(const id of item.ids){
          const context=this.getContext();if(!context)throw Error('Audio context unavailable');
          const bytes=await this.load(id);const buffer=await context.decodeAudioData(bytes.slice(0));
          if(ticket!==this.token)return;
          await new Promise((resolve,reject)=>{
            const source=context.createBufferSource(),gain=context.createGain(),entry={id,kind:item.kind,at:Date.now(),completed:false};
            let settled=false,timer;
            const finish=error=>{
              if(settled)return;settled=true;clearTimeout(timer);source.onended=null;
              try{source.disconnect();}catch{}try{gain.disconnect();}catch{}
              if(this.current===source){this.current=null;this.cancelCurrent=null;}
              if(error)reject(error);else resolve();
            };
            const stop=()=>{try{source.stop();}catch{}};
            this.current=source;this.cancelCurrent=()=>{entry.cancelledAt=Date.now();finish();stop();};
            source.onended=()=>{if(settled)return;entry.completed=ticket===this.token;entry.endedAt=Date.now();finish();};
            // A stalled audio host can report "running" without ever dispatching
            // onended. Release the race's listening wait as a failed delivery;
            // elapsed wall time alone must never count as hearing the clip.
            const duration=Number.isFinite(buffer.duration)&&buffer.duration>0?buffer.duration:0;
            timer=setTimeout(()=>{
              if(ticket!==this.token){finish();stop();return;}
              entry.failure='ended-timeout';entry.failedAt=Date.now();
              const error=Error('Narration playback did not end: '+id);error.code='NARRATION_ENDED_TIMEOUT';
              finish(error);stop();
            },Math.max(8,duration+5)*1000);
            try{
              source.buffer=buffer;gain.gain.value=.95;source.connect(gain);gain.connect(context.destination);source.start();
              this.history.push(entry);if(this.history.length>80)this.history.shift();
            }catch(error){finish(error);stop();}
          });
          if(ticket!==this.token)return;
        }
      } catch(error) {
        if(ticket!==this.token)return;
        if(error?.code==='NARRATION_ENDED_TIMEOUT'){delivered=false;this.onUnavailable();}
        else delivered=await this.fallback(item.text,ticket);
      }
      if(ticket===this.token)this.onDelivery({kind:item.kind,presentationId:item.presentationId,audio:delivered?'completed':'failed'});
    }
    if(ticket===this.token){this.playing=false;this.activeKind=null;this.onActive(false);}
  }
  fallback(text,ticket){
    const candidates=window.speechSynthesis?.getVoices().filter(v=>v.lang.toLowerCase().startsWith('ko'))||[];
    const voice=candidates.find(v=>/natural|enhanced|premium/i.test(v.name))||candidates[0];
    if(!voice){this.onUnavailable();return Promise.resolve(false);}
    return new Promise(resolve=>{if(ticket!==this.token){resolve(false);return;}const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.voice=voice;u.rate=.9;u.onend=()=>resolve(ticket===this.token);u.onerror=()=>{if(ticket===this.token)this.onUnavailable();resolve(false);};speechSynthesis.speak(u);});
  }
  cancel(){this.token++;this.queue=[];if(this.cancelCurrent)this.cancelCurrent();else try{this.current?.stop();}catch{}this.current=null;this.cancelCurrent=null;window.speechSynthesis?.cancel();this.playing=false;this.activeKind=null;this.onActive(false);}
  snapshot(){return {playing:this.playing,kind:this.activeKind,queued:this.queue.length,played:[...this.history]};}
}
