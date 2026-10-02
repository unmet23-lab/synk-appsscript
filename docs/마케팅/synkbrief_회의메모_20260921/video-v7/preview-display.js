// Draw decoded frames into a regular canvas. The in-app browser can advance
// a video while failing to paint its accelerated video surface.
(()=>{
const video=document.getElementById('video');
const stage=document.createElement('div');stage.className='video-stage';
video.parentNode.insertBefore(stage,video);stage.appendChild(video);
const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
canvas.setAttribute('role','img');canvas.setAttribute('aria-label','회의 정리 프로젝트 영상');
stage.appendChild(canvas);
const context=canvas.getContext('2d',{alpha:false});
const poster=new Image();let hasFrame=false;
poster.onload=()=>{if(!hasFrame)context.drawImage(poster,0,0,canvas.width,canvas.height);};poster.src=video.poster;
const draw=()=>{
  if(video.paused&&video.currentTime<.1&&!hasFrame)return;
  if(video.readyState>=2&&video.videoWidth){
    context.drawImage(video,0,0,canvas.width,canvas.height);hasFrame=true;
    stage.dataset.frameTime=video.currentTime.toFixed(3);
  }
};
for(const event of ['loadeddata','seeked','pause','playing'])video.addEventListener(event,draw);
if(typeof video.requestVideoFrameCallback==='function'){
  const next=()=>{draw();video.requestVideoFrameCallback(next);};video.requestVideoFrameCallback(next);
}else{
  const next=()=>{if(!video.paused)draw();requestAnimationFrame(next);};requestAnimationFrame(next);
}
draw();
})();
