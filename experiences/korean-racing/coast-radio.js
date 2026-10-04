// Stream one existing SYNK recording. Never decode the whole song into Web Audio.
export const COAST_RADIO_TRACK=Object.freeze({
  title:'해안선',artist:'SYNK',src:'./assets/music/coastline.mp3',duration:231.6,
  sourceId:'c2835bc7-6963-4503-95bd-781b55e20b88',
});

// A local silent WAV primes the same media element inside the first gesture,
// without requesting the song during startup. The shared context is owned by app.
const SILENT_WAV='data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
const LEVEL=.38,DUCK_LEVEL=.09;

export function createCoastRadio({getContext,createAudio=()=>new Audio(),onUnavailable=()=>{}}){
  let media=null,context=null,source=null,gain=null,prepared=false,disposed=false;
  let pending=null,epoch=0,playing=false,blocked=false,lastError=null,primed=false;
  let state={active:false,enabled:true,paused:false,duck:false},target=0;
  const wanted=()=>!disposed&&state.active&&state.enabled&&!state.paused;
  function ensureMedia(){
    if(!media){media=createAudio();media.preload='none';media.loop=true;media.playsInline=true;media.addEventListener('error',failedMedia);}
    return media;
  }
  function failedMedia(){if(prepared&&!disposed){fail(media.error?.message||'Music unavailable');halt();}}
  function fail(error){blocked=true;playing=false;lastError=String(error?.message||error);onUnavailable(lastError);}
  function connect(){
    if(source)return true;
    context=getContext();if(!context||context.state==='closed')return false;
    try{
      const audio=ensureMedia();source=context.createMediaElementSource(audio);gain=context.createGain();
      gain.gain.value=0;source.connect(gain);gain.connect(context.destination);return true;
    }catch(error){fail(error);return false;}
  }
  function level(value,immediate=false){
    if(target===value&&!immediate)return;target=value;if(!gain)return;
    const t=context.currentTime,p=gain.gain;
    if(p.cancelAndHoldAtTime)p.cancelAndHoldAtTime(t);
    else {p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);}
    if(immediate)p.setValueAtTime(value,t);
    else p.setTargetAtTime(value,t,value<LEVEL?.08:.22);
  }
  function rewind(){if(media)try{media.currentTime=0;}catch{}}
  function halt(){
    level(0,true);if(media&&!media.paused)media.pause();playing=false;
    if(!state.active)rewind();
  }
  function prepare(){
    if(disposed)return false;if(prepared)return true;
    const audio=ensureMedia();audio.preload='auto';audio.src=COAST_RADIO_TRACK.src;
    prepared=true;audio.load();return true;
  }
  function sync(){
    if(!wanted()){halt();return;}
    if(blocked)return;
    if(playing){level(state.duck?DUCK_LEVEL:LEVEL);return;}
    if(pending)return;
    prepare();if(!connect())return;
    const ticket=epoch;level(0,true);
    // Only one unresolved play() request exists. A later result from an old
    // round must not restart music after mute, pause, home, result or disposal.
    let attempt;
    try{attempt=media.play();}catch(error){fail(error);halt();return;}
    const task=Promise.resolve(attempt).then(()=>{
      if(ticket!==epoch||!wanted()||blocked){halt();return;}
      playing=true;lastError=null;level(state.duck?DUCK_LEVEL:LEVEL);
    }).catch(error=>{
      if(ticket!==epoch||!wanted()){halt();return;}
      fail(error);halt();
    }).finally(()=>{
      if(pending===task)pending=null;
      if(ticket!==epoch&&wanted()&&!blocked)sync();
    });
    pending=task;
  }
  function unlock(){
    if(disposed)return Promise.resolve(false);
    const ticket=epoch;
    blocked=false;lastError=null;
    const audio=ensureMedia();connect();
    let resumed=Promise.resolve();
    try{if(context?.state==='suspended')resumed=Promise.resolve(context.resume());}
    catch(error){resumed=Promise.reject(error);}
    if(!primed&&!prepared){
      primed=true;audio.src=SILENT_WAV;audio.loop=false;
      try{Promise.resolve(audio.play()).catch(()=>{});}catch{}
      audio.pause();audio.loop=true;
    }
    // Invoke play synchronously if this gesture happens during free drive.
    sync();
    return resumed.then(()=>!disposed).catch(error=>{if(ticket===epoch&&wanted()){fail(error);halt();}return false;});
  }
  function setState(next){
    if(disposed)return;
    const previous=state;state={...state,...next};
    if(previous.active!==state.active||previous.enabled!==state.enabled||previous.paused!==state.paused){
      epoch++;blocked=false;
    }
    sync();
  }
  function stop(){setState({active:false});}
  function dispose(){
    if(disposed)return;disposed=true;epoch++;state.active=false;halt();
    if(media){media.removeEventListener('error',failedMedia);media.removeAttribute('src');media.load();}
    try{source?.disconnect();}catch{}try{gain?.disconnect();}catch{}
  }
  function snapshot(){return {title:COAST_RADIO_TRACK.title,prepared,playing,pending:!!pending,blocked,disposed,
    ...state,time:media?.currentTime||0,targetGain:target,error:lastError,streaming:true};}
  return {prepare,unlock,setState,stop,dispose,snapshot};
}
