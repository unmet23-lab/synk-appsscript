import { BAR_SECONDS, createSoundGraph, createAcousticPalette, createHarborAmbience, scheduleScoreBar, smoothParam } from './audio-score.js';

const DEFAULTS = Object.freeze({ muted: false, music: .68, effects: .74 });
const STORAGE_KEY = 'synk.pulse.audio.mix.v1';
const OWNER_KEY = 'synk.pulse.audio.owner.v1';
let singleton = null;
const clamp = value => Math.max(0, Math.min(1, value));

/** Call start() from a real click/tap. Construction never starts playback. */
export function createPulseAudio({ onState = () => {}, storageKey = STORAGE_KEY } = {}) {
  if (singleton) { singleton.subscribe(onState); return singleton; }
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  const callbacks = new Set([onState]), listeners = [], cleanupTimers = new Set();
  let mix = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') {
      if (typeof saved.muted === 'boolean') mix.muted = saved.muted;
      for (const key of ['music','effects']) if (Number.isFinite(saved[key])) mix[key] = clamp(saved[key]);
    }
  } catch { /* Playback does not require browser storage. */ }
  let context, graph, effectsPalette, ambience, layer, tickTimer, suspendTimer, starting, destroyed = false;
  let started = false, reason = null, blockedByOther = false, lastStep = -1, lastEvents = new Map(), stepSide = -1;
  let scene = { zone: 'square', phase: 'lobby', ending: null, moving: false };
  let nextBar = 0, barIndex = 0;
  const identity = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  let ownerClaim = { id: identity, at: 0 }, channel;
  const getState = () => ({ available: !!AudioContextClass, started, ...mix, suspended: !!context && context.state !== 'running', reason, zone: scene.zone, phase: scene.phase, contextState: context?.state || 'not-created' });
  const emit = () => { const state = getState(); for (const callback of callbacks) try { callback(state); } catch {} return state; };
  const listen = (target, name, fn) => { target?.addEventListener(name,fn); listeners.push(()=>target?.removeEventListener(name,fn)); };
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(mix)); } catch {} };
  const later = (fn, ms) => { const timer=setTimeout(()=>{cleanupTimers.delete(timer);fn();},ms);cleanupTimers.add(timer);return timer; };
  function clearSuspend() { if (suspendTimer) { clearTimeout(suspendTimer); cleanupTimers.delete(suspendTimer); suspendTimer = null; } }
  function volume() { if (graph && context) smoothParam(graph.masterBus.gain, mix.muted || blockedByOther || document.hidden ? 0 : .82, context.currentTime, .16); }
  function pause(message) {
    clearSuspend(); reason = message;
    if (context && context.state === 'running') {
      smoothParam(graph.masterBus.gain,0,context.currentTime,.12);
      suspendTimer=later(()=>{suspendTimer=null;if(!destroyed)context.suspend().catch(()=>{});},170);
    }
    emit();
  }
  function receiveClaim(claim) {
    if (!claim || claim.id === identity || !Number.isFinite(claim.at) || typeof claim.id !== 'string') return;
    if (claim.at < ownerClaim.at || (claim.at === ownerClaim.at && claim.id < ownerClaim.id)) return;
    ownerClaim=claim;
    if(started){blockedByOther=true;pause('다른 PULSE 탭에서 소리가 재생 중입니다. 이 탭의 소리를 켜면 여기서 이어집니다.');}
  }
  try { channel = new BroadcastChannel('synk.pulse.audio'); channel.addEventListener('message', event=>receiveClaim(event.data)); } catch {}
  listen(globalThis,'storage',event=>{
    if(event.key===OWNER_KEY){try{receiveClaim(JSON.parse(event.newValue));}catch{}}
    if(event.key===storageKey&&event.newValue){try{const next=JSON.parse(event.newValue);if(typeof next.muted==='boolean')mix.muted=next.muted;for(const key of ['music','effects'])if(Number.isFinite(next[key]))mix[key]=clamp(next[key]);applyMix();emit();}catch{}}
  });
  function claim() {
    ownerClaim={id:identity,at:Math.max(Date.now(),ownerClaim.at+1)};blockedByOther=false;
    try{channel?.postMessage(ownerClaim);}catch{}try{localStorage.setItem(OWNER_KEY,JSON.stringify(ownerClaim));}catch{}
  }
  function applyMix() {
    if(!context||!graph)return;
    smoothParam(graph.musicBus.gain,mix.music,context.currentTime,.12);
    smoothParam(graph.effectsBus.gain,mix.effects,context.currentTime,.12); volume();
  }
  function replaceMusicLayer() {
    if(!context||!graph)return;
    if(layer){const old=layer;smoothParam(old.bus.gain,0,context.currentTime,.7);later(()=>{old.palette.destroy();old.bus.disconnect();},3100);}
    const bus=context.createGain();bus.gain.value=0;bus.connect(graph.musicBus);
    layer={bus,palette:createAcousticPalette(context,bus,{wet:.27,seed:81931})};
    smoothParam(bus.gain,1,context.currentTime,.8);nextBar=context.currentTime+.08;barIndex=0;
  }
  function tick() {
    if(!context||context.state!=='running'||destroyed||document.hidden||blockedByOther)return;
    const now=context.currentTime;
    // Recover gracefully after a busy frame; never burst-play missed bars.
    if(nextBar<now-.2)nextBar=now+.06;
    while(layer&&nextBar<now+.65){scheduleScoreBar(layer.palette,barIndex++,nextBar,scene);nextBar+=BAR_SECONDS;}
    ambience.tick(now);
    if(scene.moving&&now-lastStep>.57){lastStep=now;stepSide*=-1;effectsPalette.effect('step',now+.01,{pan:stepSide*.18,intensity:.7});}
  }
  async function resume() {
    if(!context||destroyed||document.hidden)return emit();
    clearSuspend();claim();reason=null;
    try{await context.resume();volume();tick();}
    catch{reason='소리를 시작하지 못했습니다. 소리 켜기를 다시 눌러 주세요.';}
    return emit();
  }
  function start() {
    if(destroyed)return Promise.resolve(getState());
    if(starting)return starting;
    if(!AudioContextClass){reason='이 브라우저는 게임 소리를 지원하지 않습니다. 글과 화면으로 모든 내용을 확인할 수 있습니다.';return Promise.resolve(emit());}
    // Context creation and resume are initiated synchronously within the user's gesture.
    if(!context){
      try{
        context=new AudioContextClass({latencyHint:'interactive'});
        graph=createSoundGraph(context,{...mix,master:0});
        effectsPalette=createAcousticPalette(context,graph.effectsBus,{wet:.16,seed:100910});
        ambience=createHarborAmbience(context,effectsPalette,graph.effectsBus);ambience.update(scene.zone);replaceMusicLayer();
        context.addEventListener('statechange',emit);
        tickTimer=setInterval(tick,180);started=true;
      }catch{reason='소리를 준비하지 못했습니다. 글과 화면으로 계속할 수 있습니다.';return Promise.resolve(emit());}
    }
    starting=resume().finally(()=>{starting=null;});return starting;
  }
  listen(document,'visibilitychange',()=>{
    if(!started||destroyed)return;
    if(document.hidden)pause('탭을 벗어나 소리를 잠시 멈췄습니다.');
    else if(!blockedByOther)resume();
  });
  listen(globalThis,'pagehide',()=>pause('페이지를 벗어나 소리를 멈췄습니다.'));
  const api = {
    start,
    mute(value=true){mix.muted=!!value;save();volume();if(!mix.muted&&started&&context?.state==='suspended'&&!document.hidden)void resume();return emit();},
    setMix(values={}){for(const key of ['music','effects'])if(Number.isFinite(values[key]))mix[key]=clamp(values[key]);save();applyMix();return emit();},
    play(name,options={}){
      if(!started||!context||context.state!=='running'||document.hidden||blockedByOther||mix.muted)return false;
      const now=context.currentTime,threshold=name==='step'?.18:.065;
      if(now-(lastEvents.get(name)??-10)<threshold)return false;lastEvents.set(name,now);
      return effectsPalette.effect(name,now+.008,options);
    },
    updateScene(next={}){
      const oldPhase=scene.phase,oldEnding=scene.ending;
      const zones={buoy:'harbor',street:'square',signal:'tram',archive:'radio',coast:'harbor',courier:'postbox'};
      if(typeof next.zone==='string')scene.zone=zones[next.zone]||next.zone;
      if(typeof next.phase==='string')scene.phase=next.phase;
      if('ending' in next)scene.ending=typeof next.ending==='string'?next.ending:null;
      if(typeof next.moving==='boolean')scene.moving=next.moving;
      ambience?.update(scene.zone);
      if(scene.phase!==oldPhase||scene.ending!==oldEnding)replaceMusicLayer();
      return getState();
    },
    getState,
    subscribe(callback){if(typeof callback==='function'){callbacks.add(callback);callback(getState());}return()=>callbacks.delete(callback);},
    destroy(){
      if(destroyed)return;destroyed=true;clearInterval(tickTimer);clearSuspend();for(const timer of cleanupTimers)clearTimeout(timer);cleanupTimers.clear();
      for(const cleanup of listeners)cleanup();channel?.close();layer?.palette.destroy();layer?.bus.disconnect();ambience?.destroy();effectsPalette?.destroy();graph?.destroy();context?.close().catch(()=>{});callbacks.clear();singleton=null;
    },
  };
  singleton=api;emit();return api;
}
