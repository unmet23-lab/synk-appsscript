import {esc,safeUrl} from './api.mjs';

export function animaticTimeline(scenes=[]){let cursor=0;return scenes.map((scene,index)=>{const duration=Number.isFinite(scene.duration)&&scene.duration>0?scene.duration:1;const start=cursor;cursor+=duration;return {...scene,index,start,end:cursor,duration};});}
export function sceneAtTime(timeline,time){if(!timeline.length)return null;return timeline.find(scene=>time<scene.end)||timeline.at(-1);}
const timeLabel=value=>`${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value)%60)).padStart(2,'0')}.${Math.floor(Math.max(0,value)%1*10)}`;

// No generated media, external player or autoplay. Saved native media and the
// already published storyboard are enough to review a timed sequence.
export function mountAnimatic(container,{scenes=[],audioUrl='',testClipStart=0,testClipDuration=7}={}){
  if(!container)return ()=>{};
  const timeline=animaticTimeline(scenes),total=timeline.at(-1)?.end||0;
  if(!timeline.length){container.innerHTML='<p class="empty-note">고객에게 공개한 장면이 아직 없어요.</p>';return ()=>{};}
  const url=safeUrl(audioUrl,{media:true});
  container.innerHTML=`<div class="preview-player-screen"><img data-preview-image alt="" hidden><div class="preview-player-placeholder" data-preview-placeholder></div><div class="preview-player-caption" data-preview-caption hidden></div></div><p class="preview-player-scene" data-preview-scene></p><p class="preview-player-narration" data-preview-narration></p><label class="sr-only" for="preview-scrubber">전체 흐름의 재생 위치</label><input id="preview-scrubber" class="preview-player-range" type="range" min="0" max="${total}" step="0.1" value="0" data-preview-seek aria-valuetext="0초"><div class="preview-player-controls"><button type="button" class="button primary" data-action="preview-play">재생</button><button type="button" class="button" data-action="preview-restart">처음부터</button><button type="button" class="button" data-action="preview-mute" ${url?'':'disabled'} aria-pressed="false">소리 끄기</button><output data-preview-time>0:00.0 / ${timeLabel(total)}</output></div><div class="preview-player-timeline" aria-label="장면으로 이동">${timeline.map(scene=>`<button type="button" data-action="preview-scene" data-scene-index="${scene.index}" aria-label="${esc(scene.title)} 장면으로 이동">${scene.index+1} · ${scene.duration}초</button>`).join('')}</div><p class="preview-player-status" data-preview-status role="status"></p>${url?`<audio data-preview-audio src="${esc(url)}" preload="metadata"></audio>`:''}`;
  const query=name=>container.querySelector(`[data-preview-${name}]`),img=query('image'),placeholder=query('placeholder'),caption=query('caption'),title=query('scene'),narration=query('narration'),seek=query('seek'),output=query('time'),status=query('status'),audio=query('audio');
  const playButton=container.querySelector('[data-action=preview-play]'),muteButton=container.querySelector('[data-action=preview-mute]');
  const listeners=[],listen=(node,event,fn,opts)=>{if(!node)return;node.addEventListener(event,fn,opts);listeners.push(()=>node.removeEventListener(event,fn,opts));};
  let position=0,playing=false,frameId=0,anchor=0,anchorPosition=0,activeScene=-1,disposed=false,audioFailed=false,audioFinished=false,pausing=false,attempt=0;
  function paint(){
    const scene=sceneAtTime(timeline,position);
    if(scene.index!==activeScene){
      activeScene=scene.index;const imageUrl=scene.media?.mimeType?.startsWith('image/')?safeUrl(scene.media.url,{media:true}):safeUrl(scene.imageUrl);
      if(imageUrl){img.src=imageUrl;img.alt=scene.title||`장면 ${scene.index+1}`;img.hidden=false;placeholder.hidden=true;}else{img.removeAttribute('src');img.hidden=true;placeholder.hidden=false;}
      placeholder.textContent=scene.description||scene.title||'장면 이미지 준비 중';caption.textContent=scene.screenText||'';caption.hidden=!scene.screenText;
      title.textContent=`장면 ${scene.index+1} / ${timeline.length} · ${scene.title||''}`;narration.textContent=scene.narration?`전달할 말 · ${scene.narration}`:'전달할 말 없음';
      for(const button of container.querySelectorAll('[data-scene-index]'))button.setAttribute('aria-current',String(Number(button.dataset.sceneIndex)===scene.index));
    }
    seek.value=String(position);seek.setAttribute('aria-valuetext',`${position.toFixed(1)}초 / ${total.toFixed(1)}초`);output.textContent=`${timeLabel(position)} / ${timeLabel(total)}`;
  }
  function signalPlayback(){container.dataset.previewPlaying=String(playing);container.dispatchEvent(new CustomEvent('pulse-preview-playback',{bubbles:true,detail:{playing}}));}
  function pause(){const wasPlaying=playing;playing=false;attempt++;cancelAnimationFrame(frameId);pausing=true;audio?.pause();pausing=false;playButton.textContent=position>=total?'다시 재생':'재생';playButton.setAttribute('aria-pressed','false');if(wasPlaying)signalPlayback();}
  function setPosition(value){position=Math.min(total,Math.max(0,Number(value)||0));anchorPosition=position;anchor=performance.now();if(audio&&!audioFailed){audioFinished=Number.isFinite(audio.duration)&&position>=audio.duration;try{audio.currentTime=audioFinished?audio.duration:position;if(playing&&!audioFinished&&audio.paused)void audio.play().catch(()=>{audioFailed=true;pause();status.textContent='음성을 재생하지 못했어요. 다시 재생하면 무음으로 확인할 수 있어요.';});}catch{}}paint();}
  function tick(now){
    if(disposed||!playing)return;
    if(audio&&!audioFailed&&!audioFinished&&!audio.ended){position=Math.min(total,Math.max(0,audio.currentTime));anchorPosition=position;anchor=now;}
    else position=Math.min(total,anchorPosition+(now-anchor)/1000);
    paint();if(position>=total){pause();return;}frameId=requestAnimationFrame(tick);
  }
  async function play(){
    if(playing){pause();return;}
    if(position>=total)setPosition(0);
    // Pause native sample/test playback even for a silent storyboard.
    for(const other of document.querySelectorAll('audio,video'))if(other!==audio)other.pause();
    playing=true;signalPlayback();const current=++attempt;anchorPosition=position;anchor=performance.now();playButton.textContent='일시정지';playButton.setAttribute('aria-pressed','true');frameId=requestAnimationFrame(tick);
    audioFinished=!!audio&&Number.isFinite(audio.duration)&&position>=audio.duration;
    if(audio&&!audioFailed&&!audioFinished){
      try{audio.currentTime=position;await audio.play();if(current!==attempt||disposed){if(disposed)audio.pause();return;}}
      catch(error){if(current!==attempt||disposed)return;pause();status.textContent=error.name==='NotAllowedError'?'브라우저가 소리 재생을 막았어요. 재생 버튼을 다시 눌러 주세요.':'임시 음성을 재생하지 못했어요. 다시 재생하면 무음으로 흐름을 확인할 수 있어요.';if(error.name!=='NotAllowedError'){audioFailed=true;muteButton.disabled=true;}}
    }
  }
  listen(container,'click',event=>{const button=event.target.closest('[data-action]');if(!button||!container.contains(button))return;event.stopPropagation();if(button.dataset.action==='preview-play')void play();else if(button.dataset.action==='preview-restart'){pause();setPosition(0);}else if(button.dataset.action==='preview-mute'&&audio){audio.muted=!audio.muted;button.textContent=audio.muted?'소리 켜기':'소리 끄기';button.setAttribute('aria-pressed',String(audio.muted));}else if(button.dataset.action==='preview-scene'){setPosition(timeline[Number(button.dataset.sceneIndex)]?.start||0);}});
  listen(seek,'input',()=>setPosition(seek.value));
  listen(img,'error',()=>{img.hidden=true;placeholder.hidden=false;});
  listen(audio,'pause',()=>{if(playing&&!pausing&&!audio.ended)pause();});
  listen(audio,'ended',()=>{audioFinished=true;anchorPosition=position;anchor=performance.now();});
  listen(audio,'error',()=>{audioFailed=true;muteButton.disabled=true;pause();status.textContent='임시 음성을 불러오지 못했어요. 다시 재생하면 무음으로 흐름을 확인할 수 있어요.';});
  listen(document,'play',event=>{if(event.target!==audio&&playing)pause();},true);
  listen(document,'visibilitychange',()=>{if(document.hidden)pause();});
  const panel=container.closest('[data-preview-section]'),test=panel?.querySelector('[data-preview-test]'),testButton=panel?.querySelector('[data-action=preview-test-play]'),testStatus=panel?.querySelector('[data-preview-test-status]');
  let testing=false;
  listen(testButton,'click',async event=>{
    event.stopPropagation();pause();
    if(!Number.isFinite(test.duration)||test.duration<testClipStart+testClipDuration-.1){testStatus.textContent='영상 길이를 불러오는 중이거나 지정한 5~10초 구간이 파일보다 깁니다. 담당자가 구간을 확인해 주세요.';return;}
    testing=true;test.currentTime=testClipStart;testStatus.textContent=`${testClipDuration}초 시험 구간을 재생해요.`;
    try{await test.play();}catch{testing=false;testStatus.textContent='시험 영상을 재생하지 못했어요. 영상의 재생 버튼으로 다시 확인해 주세요.';}
  });
  listen(test,'timeupdate',()=>{if(testing&&(test.currentTime>=testClipStart+testClipDuration||test.currentTime<testClipStart-.1)){testing=false;test.pause();testStatus.textContent='시험 구간 재생을 마쳤어요.';}});
  listen(test,'error',()=>{testing=false;testStatus.textContent='시험 영상을 불러오지 못했어요. 담당자에게 파일을 확인해 달라고 알려 주세요.';});
  paint();
  return ()=>{disposed=true;pause();test?.pause();listeners.forEach(remove=>remove());if(audio){audio.removeAttribute('src');audio.load();}};
}
