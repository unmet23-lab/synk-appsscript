'use strict';
// EP01 upload cut: preserve the approved master, omit the obsolete EP02 setup promise.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process'),{createRequire}=require('node:module');
const base=__dirname,repo=path.resolve(base,'../../..'),video=path.join(repo,'영상');
const output=path.join(base,'업로드_최종_20260926'),audit=path.join(base,'검수','업로드_20260926');
const staging=path.join(base,'runtime-public'),name='yuhobuilds_EP01_FINAL_1080x1920.mp4';
for(const p of [output,audit])fs.mkdirSync(p,{recursive:true});
const write=(file,data)=>fs.writeFileSync(file,typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr||r.error);return r;}
function loudness(file){const s=run('ffmpeg',['-v','info','-i',file,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']).stderr;return JSON.parse(s.slice(s.lastIndexOf('{'),s.lastIndexOf('}')+1));}
function prepare(){
 const original=require('./장면타이밍.json'),cut=original.scenes.find(s=>s.id==='15a'),cutEnd=cut.start+cut.duration;
 if(cut.start!==1993||cut.duration!==94)throw Error('Source timeline changed; review edit first.');
 const timing={...original,durationInFrames:original.durationInFrames-cut.duration,audioFile:'yuho-journey-01/narration-upload-20260926.wav',scenes:original.scenes.filter(s=>s.id!==cut.id).map(s=>({...s,start:s.start>=cutEnd?s.start-cut.duration:s.start,voiceStartFrame:s.voiceStartFrame>=cutEnd?s.voiceStartFrame-cut.duration:s.voiceStartFrame}))};
 const shiftMs=cut.duration/30*1000;
 const captions=require('./captions.json').filter(c=>c.startMs<cut.start/30*1000||c.startMs>=cutEnd/30*1000).map(c=>c.startMs>=cutEnd/30*1000?{...c,startMs:Math.round(c.startMs-shiftMs),endMs:Math.round(c.endMs-shiftMs)}:c);
 // The retained preceding caption has a reading tail across the old cut.
 // End it at the new scene boundary so it cannot cover the next sentence.
 const boundary=cut.start/30*1000;
 for(let i=0;i<captions.length;i++){
  if(captions[i].startMs<boundary&&captions[i].endMs>boundary)captions[i].endMs=Math.floor(boundary);
  if(i+1<captions.length)captions[i].endMs=Math.min(captions[i].endMs,captions[i+1].startMs);
 }
 const words=require('./words.json').filter(w=>w.segment!==cut.id).map(w=>w.start>=cutEnd/30?{...w,start:w.start-cut.duration/30,end:w.end-cut.duration/30}:w);
 const script={...require('./narration-script.json'),segments:require('./narration-script.json').segments.filter(s=>s.id!==cut.id)};
 const fmt=ms=>new Date(ms).toISOString().slice(11,23).replace('.',',');
 write(path.join(output,'yuhobuilds_EP01_자막.srt'),captions.map((c,i)=>`${i+1}\n${fmt(c.startMs)} --> ${fmt(c.endMs)}\n${c.text}\n`).join('\n'));
 write(path.join(audit,'final-timing.json'),timing);write(path.join(audit,'final-captions.json'),captions);write(path.join(audit,'final-words.json'),words);write(path.join(audit,'final-script.json'),script);
 const total=timing.durationInFrames/30,narration=path.join(audit,'narration-only.wav'),bed=path.join(audit,'music-bed.wav'),premix=path.join(audit,'premix.wav');
 write(path.join(audit,'blocks.txt'),timing.scenes.map(s=>`file '${path.join(base,'audio',`block-${s.id}.wav`).replaceAll('\\','/')}'`).join('\n')+'\n');
 run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',path.join(audit,'blocks.txt'),'-c:a','pcm_s16le',narration]);
 const joke=timing.scenes.find(s=>s.visual==='joke');
 run('ffmpeg',['-y','-v','error','-i',path.join(repo,'docs/홍보물/BGM/시티팝_147.wav'),'-af',`atrim=start=25:duration=${total},asetpts=PTS-STARTPTS,afade=t=in:d=0.15,afade=t=out:st=${total-.65}:d=0.65,volume=0.25,volume=enable='between(t,${joke.start/30-.12},${(joke.start+joke.duration)/30})':volume=0.08`,'-ar','48000','-ac','2','-c:a','pcm_s16le',bed]);
 run('ffmpeg',['-y','-v','error','-i',narration,'-i',bed,'-i',path.join(base,'audio/keyboard-sfx.wav'),'-filter_complex','[0:a]asplit=2[voice][key];[1:a][key]sidechaincompress=threshold=0.02:ratio=3:attack=8:release=110[ducked];[voice][ducked][2:a]amix=inputs=3:duration=first:normalize=0[mix]','-map','[mix]','-c:a','pcm_s16le',premix]);
 const measured=loudness(premix),gainDb=Math.min(-16-Number(measured.input_i),-1.5-Number(measured.input_tp));
 run('ffmpeg',['-y','-v','error','-i',premix,'-af',`volume=${gainDb}dB`,'-ar','48000','-ac','2','-c:a','pcm_s16le',path.join(staging,timing.audioFile)]);
 fs.copyFileSync(path.join(base,'poster.png'),path.join(output,'yuhobuilds_EP01_COVER.png'));
 write(path.join(audit,'edit-decision.json'),{createdAt:new Date().toISOString(),sourceMaster:'../../yuhobuilds_EP01.mp4',sourceSha256:sha(path.join(base,'yuhobuilds_EP01.mp4')),removedScene:{id:cut.id,startFrame:cut.start,frames:cut.duration,text:cut.text},reason:'Completed EP02 is about comparing AI recommendations; the former setup tutorial promise no longer matches the next episode.',picture:'Original Remotion scene designs retained; timeline, captions, progress bar rerendered to the new duration.',audio:'Retained narration blocks without the removed scene; continuous original BGM with ducking, keyboard SFX, and 0.65 s fade rebuilt to the new end.',newNarrationGenerated:false,totalFrames:timing.durationInFrames,durationSeconds:total,gainDb,premixLoudness:measured,publicUpload:false});
 return {timing,captions,words};
}
async function main(){
 const props=prepare();console.log(`Prepared ${props.timing.durationInFrames} frames / ${props.captions.length} captions`);
 const requireVideo=createRequire(path.join(video,'package.json')),{bundle}=requireVideo('@remotion/bundler'),{getCompositions,renderMedia,openBrowser}=requireVideo('@remotion/renderer');
 const serveUrl=await bundle({entryPoint:path.join(video,'src/yuhoShorts01/entry.tsx'),rootDir:video,publicDir:staging});
 const browser=await openBrowser('chrome',{chromiumOptions:{gl:'swangle'}}),errors=[];
 const logger=x=>{if(/Failed to load|Failed to fetch|net::ERR_|Error loading|Could not load font/.test(x.text||''))errors.push(x.text);};
 try{
  const comps=await getCompositions(serveUrl,{inputProps:props,puppeteerInstance:browser,onBrowserLog:logger,logLevel:'error'});
  const c=comps.find(c=>c.id==='YuhoJourney01');if(!c)throw Error('Composition missing');
  const composition={...c,durationInFrames:props.timing.durationInFrames,fps:30,width:1080,height:1920};let prev=-1;
  await renderMedia({serveUrl,composition,inputProps:props,outputLocation:path.join(output,name),codec:'h264',pixelFormat:'yuv420p',imageFormat:'jpeg',jpegQuality:95,videoBitrate:'9M',encodingMaxRate:'14M',encodingBufferSize:'20M',audioBitrate:'256k',colorSpace:'bt709',concurrency:3,puppeteerInstance:browser,onBrowserLog:logger,enforceAudioTrack:true,overwrite:true,logLevel:'error',onProgress:p=>{const pct=Math.floor(p.progress*20)*5;if(pct!==prev){prev=pct;console.log(`Render ${pct}%`);}}});
  if(errors.length)throw Error(errors.join('\n'));
  write(path.join(audit,'render.json'),{createdAt:new Date().toISOString(),output:path.join(output,name),sha256:sha(path.join(output,name)),browserErrors:errors,frames:composition.durationInFrames});
  console.log('Upload cut rendered.');
 }finally{await browser.close({silent:true});}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
