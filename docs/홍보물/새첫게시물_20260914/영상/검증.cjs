'use strict';
// Read delivery videos and sources; write only QA outputs in this video directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {spawnSync}=require('node:child_process');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const OUT=__dirname,ROOT=path.resolve(OUT,'../../../..');
const ffmpeg='C:/Users/q1212/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(OUT,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(OUT,f),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
async function main(){
  const m=read('manifest.json');if(m.status!=='encoded-local-unpublished')throw new Error('Videos are not encoded');
  const qa={at:new Date().toISOString(),sourceChanges:m.sources.filter(s=>hash(fs.readFileSync(path.join(ROOT,s.path)))!==s.sha256),videos:[],playback:[],audioListeningVerified:false,publicUploadVerified:false};
  for(const v of m.videos){
    const stream=v.probe.streams.find(x=>x.codec_type==='video'),a=v.probe.streams.find(x=>x.codec_type==='audio');
    const fullDecode=spawnSync(ffmpeg,['-v','error','-i',path.join(OUT,v.file),'-f','null','-'],{encoding:'utf8',windowsHide:true});
    const frames=Number(stream.nb_frames),checks={width:stream.width===1080,height:stream.height===1920,framerate:stream.r_frame_rate==='30/1',frames:frames===v.frames,duration:Math.abs(Number(v.probe.format.duration)-v.duration)<.1,videoCodec:stream.codec_name==='h264',pixelFormat:stream.pix_fmt==='yuv420p',audio:a?.codec_name==='aac'&&Number(a.sample_rate)===48000,fullDecode:fullDecode.status===0&&!fullDecode.stderr.trim(),hash:hash(fs.readFileSync(path.join(OUT,v.file)))===v.mp4Sha256};
    const captions=read(v.file.replace('.mp4','.captions.json'));
    checks.captionStart=captions[0].startMs===0;checks.captionEnd=captions.at(-1).endMs===v.duration*1000;checks.captionContiguous=captions.every((x,i)=>!i||x.startMs===captions[i-1].endMs);checks.officialEnding=captions.at(-1).text===m.officialVision;
    qa.videos.push({file:v.file,checks,passed:Object.values(checks).every(Boolean),decodeErrors:fullDecode.stderr,bytes:fs.statSync(path.join(OUT,v.file)).size});
  }
  const motion=read('qa/새프레임-동작기록.json');qa.motion={poseSamples:motion.poses.length,maxBlink:Math.max(...motion.poses.map(x=>x.blink)),maxWind:Math.max(...motion.poses.map(x=>x.wind)),restPresent:motion.poses.some(x=>x.wind===0),cameraValues:[...new Set(motion.poses.map(x=>x.camera))],runtimeErrors:motion.errors,externalRequests:motion.blockedExternalRequests,fonts:motion.fonts};
  // New local server restricted to this output directory; no account browser/session.
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html',file=path.resolve(OUT,rel);
    if(!file.startsWith(OUT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    const ext=path.extname(file),type={'.mp4':'video/mp4','.html':'text/html; charset=utf-8','.png':'image/png','.wav':'audio/wav','.json':'application/json'}[ext]||'text/plain; charset=utf-8';
    const size=fs.statSync(file).size,range=req.headers.range;
    if(range){const [s,e]=range.replace('bytes=','').split('-');const start=Number(s),end=e?Number(e):size-1;res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${start}-${end}/${size}`,'Accept-Ranges':'bytes','Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res);}
    else{res.writeHead(200,{'Content-Type':type,'Content-Length':size,'Accept-Ranges':'bytes'});fs.createReadStream(file).pipe(res);}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    // Each film plays continuously from 0 to ended at real 1x speed, in parallel tabs.
    const jobs=m.videos.map(async(v)=>{
      const page=await browser.newPage({viewport:{width:390,height:780}});await page.goto(origin+'/index.html');
      await page.evaluate(file=>{
        document.body.innerHTML='';const video=document.createElement('video');video.src=file;video.muted=true;video.playsInline=true;video.controls=true;video.style='display:block;width:390px;height:auto';document.body.style='margin:0;padding:0';document.body.append(video);
        const info={started:false,ended:false,seeking:0,waiting:0,errors:[],samples:[]};video.addEventListener('seeking',()=>info.seeking++);video.addEventListener('waiting',()=>info.waiting++);video.addEventListener('error',()=>info.errors.push(video.error?.message));video.addEventListener('ended',()=>{info.ended=true;info.finalTime=video.currentTime;info.quality=video.getVideoPlaybackQuality();});window.playbackInfo=info;window.film=video;
      },v.file);
      await page.waitForFunction(()=>window.film.readyState>=3);await page.evaluate(async()=>{await window.film.play();window.playbackInfo.started=true;});
      const started=Date.now(),samples=[];
      for(const second of [0,2,8,14,20,27,33,v.duration-1]){
        const pause=second*1000-(Date.now()-started);if(pause>0)await new Promise(r=>setTimeout(r,pause));
        const status=await page.evaluate(()=>({currentTime:window.film.currentTime,paused:window.film.paused,ended:window.film.ended,readyState:window.film.readyState}));
        const png=await page.locator('video').screenshot();const file=`qa/${v.id}-play-${String(second).padStart(2,'0')}.png`;fs.writeFileSync(path.join(OUT,file),png);samples.push({...status,file});
        console.log(v.id+' playback '+status.currentTime.toFixed(2)+' / '+v.duration);
      }
      await page.waitForFunction(()=>window.film.ended,{timeout:15000});const playback=await page.evaluate(()=>({...window.playbackInfo,quality:{totalVideoFrames:window.film.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:window.film.getVideoPlaybackQuality().droppedVideoFrames}}));
      qa.playback.push({file:v.file,...playback,samples,mutedDuringMachinePlayback:true,method:'Continuous real-time 1x HTML video, zero seek, screenshot sampling; not a human audio listening test.'});await page.close();
    });await Promise.all(jobs);
    const page=await browser.newPage({viewport:{width:1440,height:1080}});await page.goto(origin+'/index.html');await page.screenshot({path:path.join(OUT,'qa/index-1440.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(OUT,'qa/index-390.png'),fullPage:true});
  }finally{await browser.close();await new Promise(r=>server.close(r));}
  qa.passed=qa.sourceChanges.length===0&&qa.videos.every(x=>x.passed)&&qa.motion.maxBlink>.47&&qa.motion.maxWind>.3&&qa.motion.restPresent&&qa.motion.cameraValues.join()==='fixed'&&qa.playback.every(x=>x.started&&x.ended&&x.seeking===0&&x.errors.length===0);
  write('qa/검증.json',qa);console.log('VERIFY '+qa.passed);if(!qa.passed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
