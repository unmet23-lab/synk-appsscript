import * as THREE from '../vendor/three.module.js';
const SPEAKERS=['lead','specialist','observer'];
export function createInterviewAudio(camera,scene,seats){
  const listener=new THREE.AudioListener();camera.add(listener);
  const voices=seats.map(s=>{const a=new THREE.PositionalAudio(listener);a.position.set(s.x,1.28,s.z+.08);a.setRefDistance(2.4);a.setRolloffFactor(.45);scene.add(a);return a;});
  const analysers=voices.map(v=>new THREE.AudioAnalyser(v,256));
  let manifest=null,loading=null,current=null,disposed=false,muted=false,ambience=null,generation=0;
  const buffers=new Map();
  async function prepare(){
    if(manifest)return manifest;if(loading)return loading;
    loading=(async()=>{const response=await fetch('../assets/interview/audio/manifest.json');if(!response.ok)throw Error('면접관 음성 파일을 불러오지 못했습니다.');const value=await response.json();if(!Array.isArray(value.clips))throw Error('음성 목록 형식이 올바르지 않습니다.');
      for(const clip of value.clips){if(!/^[a-z0-9-]+$/.test(clip.id))throw Error('잘못된 음성 ID');const url=`../assets/interview/audio/${clip.id}.mp3`;const r=await fetch(url);if(!r.ok)throw Error('면접관 음성을 준비하지 못했습니다.');const buffer=await listener.context.decodeAudioData(await r.arrayBuffer());if(disposed)throw Error('disposed');buffers.set(clip.id,buffer);}
      manifest=value;return value;})();try{return await loading;}finally{loading=null;}
  }
  async function unlock(){await listener.context.resume();}
  function roomTone(){if(ambience||disposed)return;const context=listener.context,buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=buffer.getChannelData(0);let previous=0;for(let i=0;i<data.length;i++){previous=(previous+(Math.random()*2-1)*.03)/1.02;data[i]=previous;}const source=context.createBufferSource();source.buffer=buffer;source.loop=true;const gain=context.createGain();gain.gain.value=muted?0:.024;source.connect(gain).connect(listener.getInput());source.start();ambience={source,gain};}
  function stop(){generation++;const c=current;current=null;if(c){clearTimeout(c.timer);if(c.voice.isPlaying)c.voice.stop();c.resolve(false);}}
  async function speak(prompt){stop();if(disposed)return false;const token=generation,buffer=buffers.get(prompt.id);if(!buffer)throw Error('이 질문의 음성을 찾지 못했습니다.');await unlock();if(disposed||token!==generation)return false;roomTone();const i=Math.max(0,SPEAKERS.indexOf(prompt.speakerId)),voice=voices[i];voice.setBuffer(buffer);voice.setVolume(muted?0:.95);
    return new Promise(resolve=>{const c={voice,resolve,id:prompt.id,index:i,timer:null};current=c;voice.play();voice.source.onended=()=>{voice.onEnded();if(current!==c)return;clearTimeout(c.timer);current=null;resolve(true);};c.timer=setTimeout(()=>{if(current===c){current=null;if(voice.isPlaying)voice.stop();resolve(true);}},(buffer.duration+.5)*1000);});
  }
  function setMuted(value){muted=!!value;voices.forEach(v=>v.setVolume(muted?0:.95));if(ambience)ambience.gain.gain.value=muted?0:.024;}
  function suspend(){stop();if(ambience)ambience.gain.gain.value=0;}
  return {prepare,unlock,speak,stop,suspend,setMuted,resume(){if(ambience)ambience.gain.gain.value=muted?0:.024;},get muted(){return muted;},get ready(){return !!manifest;},get amplitude(){return current?Math.min(1,analysers[current.index].getAverageFrequency()/55):0;},get manifest(){return manifest;},dispose(){disposed=true;stop();if(ambience){ambience.source.stop();ambience.source.disconnect();ambience.gain.disconnect();}voices.forEach(v=>{v.disconnect();scene.remove(v);});camera.remove(listener);buffers.clear();}};
}
