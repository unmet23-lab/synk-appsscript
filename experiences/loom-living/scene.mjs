import {createScene,stepScene,getScenePose} from '/engine/loom-scene.mjs';
import {LoomSceneRenderer} from '/engine/loom-scene-webgl.mjs';

const $=id=>document.getElementById(id),canvas=$('world'),garden=$('garden');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const input={pointer:{x:0,y:0,active:false,pressed:false},gust:false,paused:false,reducedMotion:reduced.matches,hidden:document.hidden,reading:false};
let state,renderer,last=0,raf=0,dialogueTimer,gestureTimer,pointerExpiry=0,manual=false;
const intervals=[];const errors=[];
window.addEventListener('error',e=>errors.push(e.message));
window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));

function speak(text){
  clearTimeout(dialogueTimer);$('dialogue').textContent=text;$('dialogue').classList.add('show');
  dialogueTimer=setTimeout(()=>$('dialogue').classList.remove('show'),3600);
}
function greet(){
  if(!state)return;input.pointer={x:-.22,y:-.2,active:true,pressed:true};pointerExpiry=performance.now()+2300;
  clearTimeout(gestureTimer);gestureTimer=setTimeout(()=>{input.pointer.pressed=false;},240);
  speak('왔구나! 여기 같이 있을까?');
}
function gust(){input.gust=true;speak('저기, 바람이 지나가!');$('weather').textContent='바람이 지나가는 중';setTimeout(()=>{$('weather').textContent=input.paused?'잠깐 쉬는 중':'잔잔한 바람';},4000);}

let audio;
async function toggleSound(){
  try{
    if(!audio){
      const context=new AudioContext(),gain=context.createGain(),filter=context.createBiquadFilter();
      const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate);const data=buffer.getChannelData(0);let seed=913;
      for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296)*2-1;}
      const source=context.createBufferSource();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=650;gain.gain.value=0;
      source.connect(filter).connect(gain).connect(context.destination);source.start();audio={context,gain,enabled:false};
    }
    await audio.context.resume();audio.enabled=!audio.enabled;
    $('sound').setAttribute('aria-pressed',String(audio.enabled));$('sound').querySelector('span').textContent=audio.enabled?'소리 끄기':'소리 켜기';updateAudio();
  }catch(e){speak('소리를 켜지 못했어요. 장면은 계속 볼 수 있어요.');}
}
function updateAudio(pose){if(!audio)return;const silent=!audio.enabled||input.paused||input.hidden;const volume=silent?0:.018+Math.abs(pose?.wind||0)*.014;audio.gain.gain.setTargetAtTime(volume,audio.context.currentTime,.16);}

function eventPoint(e){const r=canvas.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;return{x,y,nx:(x/r.width-.5)*2,ny:(y/r.height-.5)*2};}
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'&&e.buttons===0)return;const p=eventPoint(e);
  input.pointer={...input.pointer,x:p.nx,y:p.ny,active:true};pointerExpiry=performance.now()+2600;
  canvas.style.cursor=renderer?.hitTest(p.x,p.y)?'pointer':'default';
});
canvas.addEventListener('pointerdown',e=>{
  const p=eventPoint(e);input.pointer={x:p.nx,y:p.ny,active:true,pressed:!!renderer?.hitTest(p.x,p.y)};pointerExpiry=performance.now()+2800;
  if(input.pointer.pressed){speak('앗, 간지러워! 너도 바람 느꼈어?');if(e.pointerType==='mouse')canvas.setPointerCapture(e.pointerId);}
});
window.addEventListener('pointerup',()=>{input.pointer.pressed=false;});
canvas.addEventListener('pointercancel',()=>{input.pointer.pressed=false;input.pointer.active=false;});
canvas.addEventListener('pointerleave',()=>{if(!input.pointer.pressed)input.pointer.active=false;});
$('greet').addEventListener('click',greet);$('wind').addEventListener('click',gust);$('sound').addEventListener('click',toggleSound);
$('rest').addEventListener('click',()=>{
  input.paused=!input.paused;$('rest').setAttribute('aria-pressed',String(input.paused));$('rest').querySelector('span').textContent=input.paused?'다시 움직이기':'잠깐 멈추기';$('weather').textContent=input.paused?'잠깐 쉬는 중':'잔잔한 바람';
  input.pointer.pressed=false;updateAudio();
});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('experience').requestFullscreen();}catch{speak('이 브라우저에서는 전체 화면을 열 수 없어요.');}});
document.addEventListener('fullscreenchange',()=>{renderer?.resize();$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'전체 화면 닫기':'전체 화면으로 보기');});
document.addEventListener('visibilitychange',()=>{input.hidden=document.hidden;last=0;input.pointer.pressed=false;updateAudio();});
reduced.addEventListener('change',e=>{input.reducedMotion=e.matches;last=0;$('weather').textContent=e.matches?'움직임 줄이기 적용 중':'잔잔한 바람';});
const observer=new ResizeObserver(()=>{renderer?.resize();if(renderer&&state)renderer.render(getScenePose(state));});observer.observe(garden);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);canvas.hidden=true;$('error').hidden=false;if(window.loomScene)window.loomScene.ready=false;input.hidden=true;updateAudio();});
canvas.addEventListener('webglcontextrestored',()=>location.reload());

function frame(now){
  if(manual)return;
  const rawDt=last?(now-last)/1000:0;const dt=Math.min(rawDt,.1);last=now;
  if(pointerExpiry&&now>pointerExpiry){input.pointer.active=false;input.pointer.pressed=false;pointerExpiry=0;}
  const pose=stepScene(state,dt,input);input.gust=false;
  // Frozen scenes incur no repeated draws after one final frame.
  const signature=[pose.time,pose.mode,pose.blink,renderer.width,renderer.height].join(':');
  if(signature!==renderer.signature){renderer.render(pose);renderer.signature=signature;}
  if(rawDt>0&&!input.hidden&&!input.paused){intervals.push(rawDt*1000);if(intervals.length>600)intervals.shift();}
  updateAudio(pose);raf=requestAnimationFrame(frame);
}

try{
  const manifest=await fetch('./scene.json').then(r=>{if(!r.ok)throw new Error('Scene manifest missing');return r.json();});
  state=createScene({seed:manifest.seed});renderer=await LoomSceneRenderer.create(canvas,manifest);renderer.render(getScenePose(state));
  $('loading').classList.add('done');setTimeout(()=>{$('loading').hidden=true;},600);
  if(input.reducedMotion)$('weather').textContent='움직임 줄이기 적용 중';
  raf=requestAnimationFrame(frame);
  window.loomScene={
    ready:true,renderer,state,input,greet,gust,
    snapshot:()=>({pose:getScenePose(state),eyeAudit:renderer.eyeAudit,environment:renderer.environmentState,renderer:renderer.stats,errors:[...errors],performance:{samples:intervals.length,medianMs:percentile(.5),p95Ms:percentile(.95),maxMs:Math.max(0,...intervals)},size:{width:renderer.width,height:renderer.height}}),
    // Deterministic capture interface; hidden from the experience UI.
    capture(time=0,overrides={}){manual=true;cancelAnimationFrame(raf);state=createScene({seed:manifest.seed});this.state=state;
      const controls={pointer:{x:0,y:0,active:false,pressed:false},...overrides};
      for(let t=0;t<time;t+=1/120)stepScene(state,Math.min(1/120,time-t),controls);
      renderer.render(getScenePose(state));return this.snapshot();},
    resume(){manual=false;last=0;raf=requestAnimationFrame(frame);},
    async record(seconds=16){
      if(input.reducedMotion)throw new Error('Motion-reduction preference is active; recording does not override it.');
      const stream=canvas.captureStream(30);const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8'].find(m=>MediaRecorder.isTypeSupported(m));
      if(!mime)throw new Error('No WebM recording codec');
      const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:9000000});const chunks=[];
      const done=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=reject;recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());try{const b=new Blob(chunks,{type:mime});const r=await fetch('/__qa/preview.webm',{method:'PUT',headers:{'X-Loom-Capture':'1','Content-Type':mime},body:b});if(!r.ok)throw new Error(`Capture save ${r.status}`);resolve({bytes:b.size,mime,seconds});}catch(e){reject(e);}};});
      recorder.start();setTimeout(()=>recorder.stop(),Math.min(30,Math.max(2,seconds))*1000);return done;
    },
  };
}catch(e){errors.push(e.message);$('loading').hidden=true;$('error').hidden=false;canvas.hidden=true;for(const id of ['wind','greet','rest'])$(id).disabled=true;console.error(e);}
function percentile(p){if(!intervals.length)return null;const a=[...intervals].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(a.length*p))];}
window.addEventListener('pagehide',e=>{cancelAnimationFrame(raf);clearTimeout(dialogueTimer);clearTimeout(gestureTimer);input.hidden=true;input.pointer.pressed=false;updateAudio();if(!e.persisted){observer.disconnect();renderer?.dispose();audio?.context.close();}});
window.addEventListener('pageshow',e=>{if(e.persisted){input.hidden=document.hidden;last=0;if(!manual)raf=requestAnimationFrame(frame);updateAudio();}});
