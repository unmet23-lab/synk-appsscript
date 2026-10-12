const videos=[...document.querySelectorAll('video')];
for(const video of videos){
  const status=document.getElementById(video.id+'-status');
  const button=document.querySelector(`[data-play="${video.id}"]`);
  const showMetadata=()=>{status.textContent=`원본 ${video.videoWidth} × ${video.videoHeight} · ${video.duration.toFixed(2)}초 · AI 생성`;button.disabled=false;};
  video.addEventListener('loadedmetadata',showMetadata);
  if(video.readyState>=1)showMetadata();
  video.addEventListener('error',()=>{status.textContent='영상을 불러오지 못했습니다. 생성 완료와 파일 연결을 확인해 주세요.';button.disabled=true;});
  video.addEventListener('play',()=>{for(const other of videos)if(other!==video)other.pause();});
  button.addEventListener('click',async()=>{try{video.currentTime=0;await video.play();}catch{status.textContent='재생을 시작하지 못했습니다. 영상의 재생 버튼으로 다시 시도해 주세요.';}});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const video of videos)video.pause();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const video of videos)video.pause();});
