'use strict';
// Run only after the real narration timeline has been rendered.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const base = __dirname;
const film = path.resolve(base, '../yuhobuilds_EP02_v3.mp4');
const timeline = JSON.parse(fs.readFileSync(path.join(base,'timeline.json'),'utf8'));
const shots = JSON.parse(fs.readFileSync(path.join(base,'video/shot-map.json'),'utf8'));
const run = (exe,args) => {
  const p=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:24*1024*1024});
  if(p.status!==0)throw Error(`${exe} failed: ${p.stderr||p.error}`);
  return {stdout:p.stdout,stderr:p.stderr};
};
const stat=fs.statSync(film);
if(stat.size<1000000)throw Error('Final MP4 is missing or too small');
const probe=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',film]).stdout);
const video=probe.streams.find(s=>s.codec_type==='video'), audio=probe.streams.find(s=>s.codec_type==='audio');
if(video?.codec_name!=='h264'||audio?.codec_name!=='aac'||video.width!==1080||video.height!==1920)throw Error('Delivery format must be 1080x1920 H.264 with AAC');
const duration=Number(probe.format.duration);
if(Math.abs(duration-timeline.durationSeconds)>0.1)throw Error('Render does not match the real voice timeline');
if(Math.abs(shots.at(-1).end-timeline.durationSeconds)>0.04)throw Error('Shot map does not match the real voice timeline');
const decode=run('ffmpeg',['-hide_banner','-v','info','-i',film,'-vf','blackdetect=d=0.15:pix_th=0.08:pic_th=0.98','-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']);
const black=[...decode.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map(m=>({start:Number(m[1]),end:Number(m[2]),duration:Number(m[3])}));
const loud=JSON.parse(decode.stderr.slice(decode.stderr.lastIndexOf('{'),decode.stderr.lastIndexOf('}')+1));
const out=path.join(base,'video/final-review');fs.mkdirSync(out,{recursive:true});
for(let i=0;i<shots.length;i++){
  const s=shots[i],at=(s.start+s.end)/2;
  run('ffmpeg',['-y','-v','error','-ss',String(at),'-i',film,'-frames:v','1','-vf','scale=270:480','-update','1',path.join(out,`shot-${String(i+1).padStart(2,'0')}.jpg`)]);
}
for(let i=0;i<shots.length;i+=9){
  const count=Math.min(9,shots.length-i);
  run('ffmpeg',['-y','-v','error','-start_number',String(i+1),'-i',path.join(out,'shot-%02d.jpg'),'-vf',`tile=3x3:nb_frames=${count}:padding=8:margin=8:color=0x20232b`,'-frames:v','1','-update','1',path.join(out,`contact-${i/9+1}.jpg`)]);
}
run('ffmpeg',['-y','-v','error','-ss',String(Math.min(0.85,shots[0].end-0.12)),'-i',film,'-frames:v','1','-update','1',path.join(out,'poster.jpg')]);
const report={checkedAt:new Date().toISOString(),file:'../../yuhobuilds_EP02_v3.mp4',width:video.width,height:video.height,fps:video.r_frame_rate,frames:Number(video.nb_frames),durationSeconds:duration,sizeBytes:stat.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(film)).digest('hex'),fullDecodeExitCode:0,blackSegmentsAtLeast0_15Seconds:black,integratedLufs:Number(loud.input_i),truePeakDbtp:Number(loud.input_tp),cuts:shots.length,averageCutSeconds:duration/shots.length,maxCutSeconds:Math.max(...shots.map(s=>s.duration)),browserPlayback:{verified:false},visibleFramesInspected:false,userFinalApproval:'pending',published:false};
fs.writeFileSync(path.join(base,'video/final-validation.json'),JSON.stringify(report,null,2));
if(black.length)throw Error('Black frames found; inspect final-validation.json before delivery');
if(report.integratedLufs<-20||report.integratedLufs>-13||report.truePeakDbtp>-1)throw Error('Audio level needs review before delivery');
const chapters=[['처음부터',0],['AI의 다른 추천',timeline.scenes.find(s=>s.id==='03').startSeconds],['처음 설정한 날',timeline.scenes.find(s=>s.id==='07').startSeconds],['비교 질문 예시',timeline.scenes.find(s=>s.id==='09a').startSeconds],['내가 판단할 기준',timeline.scenes.find(s=>s.id==='11a').startSeconds],['다음 편',timeline.scenes.find(s=>s.id==='12').startSeconds]];
const buttons=chapters.map(([label,t])=>`<button data-time="${t}">${label}</button>`).join('');
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>yuhobuilds EP.02 · AI의 추천이 다를 때</title><style>*{box-sizing:border-box}body{margin:0;background:#101218;color:#fff;font-family:system-ui,sans-serif}main{display:flex;align-items:center;justify-content:center;gap:32px;min-height:100vh;padding:24px}video{display:block;height:90vh;max-width:62vw;background:#101218;border-radius:16px;box-shadow:0 15px 60px #0008}aside{max-width:340px}.eyebrow{font-size:13px;font-weight:700;color:#8cadff}h1{font-size:28px;line-height:1.35}p{line-height:1.65;color:#c4cee0}button,a{display:inline-block;padding:11px 14px;margin:4px 3px 4px 0;border:0;border-radius:10px;background:#3d6bc9;color:#fff;font:600 14px system-ui;cursor:pointer;text-decoration:none}.secondary{background:#273047}.status{font-size:13px;color:#c4cee0;margin-top:16px}@media(max-width:800px){main{display:block;padding:14px}video{height:auto;width:100%;max-width:450px;max-height:78vh;margin:auto}aside{margin:18px auto;max-width:450px}h1{font-size:23px}}</style></head><body><main><video id="film" controls playsinline preload="metadata" poster="revision-v3/video/final-review/poster.jpg"><source src="yuhobuilds_EP02_v3.mp4" type="video/mp4"></video><aside><div class="eyebrow">YUHOBUILDS · EP.02 · V3</div><h1>AI의 추천이 다를 때,<br>선택은 내가.</h1><p>두 AI의 다른 추천에 혼란스러웠던 날.<br>다른 모델에 비교를 부탁하고,<br>내 상황에 맞게 판단하는 방법.</p><p>${duration.toFixed(1)}초 · ${shots.length}개 장면 · 정의로 내레이션</p><div>${buttons}</div><p><a href="yuhobuilds_EP02_v3.mp4" download>MP4 저장</a><a class="secondary" href="revision-v3/따라_물어볼_질문.md" download>예시 질문 저장</a></p><p class="status" id="status">재생 버튼을 눌러 확인해 주세요.</p></aside></main><script>const v=document.getElementById('film'),s=document.getElementById('status');document.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{v.currentTime=Number(b.dataset.time);v.play().catch(()=>{s.textContent='영상의 재생 버튼을 눌러 주세요.'})}));v.addEventListener('timeupdate',()=>s.textContent=v.currentTime.toFixed(1)+' / '+(v.duration||0).toFixed(1)+'초');v.addEventListener('error',()=>s.textContent='영상을 불러오지 못했어요. MP4 파일을 직접 열어 주세요.');</script></body></html>`;
fs.writeFileSync(path.resolve(base,'../preview-v3.html'),html);
console.log(JSON.stringify(report,null,2));
