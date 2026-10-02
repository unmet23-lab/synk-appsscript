'use strict';
// Public Remotion APIs only. Never removes existing or rejected directories.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const atomic=(p,data)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const temp=p+'.pending';const fd=fs.openSync(temp,'w');try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,p);};
const save=(p,data)=>atomic(p,JSON.stringify(data,null,2));
const free=p=>{const d=fs.statfsSync(p);return d.bavail*d.bsize;};
const reserve=128*1024**2;
function needSpace(dir,bytes,phase){const available=free(dir);if(available<bytes)throw Error(`${phase}: need ${bytes} bytes; available ${available}. Completed files remain preserved.`);}
function validateVideo(file,composition,frames,probe){
 const data=probe(file),v=data.streams.find(s=>s.codec_type==='video');
 if(!v||v.codec_name!=='h264'||v.width!==composition.width||v.height!==composition.height||Number(v.nb_frames)!==frames||v.r_frame_rate!==`${composition.fps}/1`||v.pix_fmt!=='yuv420p'||Math.abs(Number(v.duration)-frames/composition.fps)>1/composition.fps)throw Error('Chunk frame/stream contract failed: '+file);
 return data;
}
module.exports=async function renderChunked({renderMedia,common,audioCommon,output,inspect,item,root,shared,probe,run,sha}){
 const {composition}=common,fps=composition.fps,total=composition.durationInFrames,maxFrames=Math.floor(20*fps),expected=total/fps;
 if(fps!==30||maxFrames!==600)throw Error('Unexpected first-post frame contract');
 const amap=read(path.join(shared,'assets.json')),assetNames=new Set([amap['logo-'+item.brand.toLowerCase()],item.brand==='LAB'?'bed-lab.wav':'bed-shift.wav']);
 for(const s of item.scenes){for(const key of [s.asset,s.logoAsset,s.transitionFromAsset].filter(Boolean))assetNames.add(amap[key]);if(s.mascotAnimation){for(const key of [s.mascotAnimation.baseAsset,s.mascotAnimation.closedAsset,s.mascotAnimation.smileAsset,s.mascotAnimation.eyeMaskAsset||'mong-eye-union'])assetNames.add(amap[key]);}if(s.audio)assetNames.add(s.audio);if(s.mascotAudio)assetNames.add(s.mascotAudio);if(s.layout==='music')assetNames.add('pulse-full.mp4');}
 const assets=[...assetNames].sort().map(file=>({file,sha256:sha(path.join(shared,file))}));
 const sourceNames=['theme.ts','FirstScene.tsx','Captions.tsx','Film.tsx','FilmAudio.tsx','index.tsx'];
 if(item.id==='01-lab-youtube')sourceNames.push('LabScene.tsx','LabMascot.tsx');
 else {sourceNames.push('QuietEnding.tsx');if(item.id==='03-lab-tiktok')sourceNames.push('LabPortraitScene.tsx','LabMascot.tsx');}
 const sourceHashes=sourceNames.map(file=>({file,sha256:sha(path.join(root,'영상/src/firstposts20260910',file))}));
 for(const file of ['색.ts','폰트.ts','폰트벌.json'])sourceHashes.push({file:'킷/'+file,sha256:sha(path.join(root,'영상/src/킷',file))});
 const fontRecord=read(path.join(root,'영상/src/킷/폰트벌.json'));
 const fonts=fontRecord.벌.map(f=>({file:f.정본,sha256:sha(path.join(root,'docs/브랜드_폰트',f.정본))}));
 const audioBitrate='320k';
 const encoding={fps,width:composition.width,height:composition.height,jpegQuality:100,videoBitrate:'12M',encodingMaxRate:'16M',encodingBufferSize:'24M',pixelFormat:'yuv420p',colorSpace:'bt709',maxFrames,audio:'shared FilmAudio graph, audio-only composition, one full-timeline WAV and one AAC encode',audioBitrate};
 const jobKey=crypto.createHash('sha256').update(JSON.stringify({item,assets,fonts,sourceHashes,encoding,helperSha256:sha(__filename)})).digest('hex');
 const dir=path.join(inspect,'chunked',jobKey.slice(0,16)),statePath=path.join(dir,'render-state.json');
 fs.mkdirSync(dir,{recursive:true});
 const state=fs.existsSync(statePath)?read(statePath):{jobKey,account:item.id,status:'prepared',encoding,assets,fonts,sourceHashes,parts:[],humanListening:false};
 if(state.jobKey!==jobKey)throw Error('Chunk job key mismatch');
 save(statePath,state);
 const started=Date.now();let renderedThisRun=0;
 function progress(label,offset=0){let last=-1;return p=>{const step=Math.floor(p.progress*10);if(step===last)return;last=step;const elapsed=(Date.now()-started)/1000;console.log(`${item.id} ${label} ${step*10}% timelineFrames=${offset+p.renderedFrames}/${total} encodedFrames=${p.encodedFrames} elapsed=${elapsed.toFixed(1)}s averageFps=${((renderedThisRun+p.renderedFrames)/Math.max(1,elapsed)).toFixed(2)}`);};}
 // Inclusive ranges preserve the original global timeline. Video parts are
 // silent; AAC is encoded once after the complete full-timeline mix exists.
 for(let from=0,n=0;from<total;from+=maxFrames,n++){
  const to=Math.min(total-1,from+maxFrames-1),frames=to-from+1,file=path.join(dir,`part-${String(n+1).padStart(3,'0')}.mp4`);
  const prior=state.parts.find(p=>p.from===from&&p.to===to);
  if(prior&&fs.existsSync(file)&&prior.sha256===sha(file)){validateVideo(file,composition,frames,probe);console.log(`${item.id} reuse part ${n+1} frames=${from}-${to}`);continue;}
  if(fs.existsSync(file))throw Error('Existing unverified chunk preserved: '+file);
  // Observed JPEG maximum: 682704 bytes. Budget 1 MiB/frame, encoded
  // output and 128 MiB reserve, including non-streaming fallback.
  const required=Math.max(768*1024**2,frames*1024**2+Math.ceil(frames/fps*16000000/8)+reserve);
  needSpace(dir,required,`${item.id} part ${n+1}`);
  const temp=file.replace(/\.mp4$/,'.pending.mp4'),partStarted=Date.now();
  await renderMedia({...common,outputLocation:temp,frameRange:[from,to],muted:true,codec:'h264',pixelFormat:'yuv420p',videoBitrate:'12M',encodingMaxRate:'16M',encodingBufferSize:'24M',imageFormat:'jpeg',jpegQuality:100,colorSpace:'bt709',overwrite:true,onProgress:progress(`part ${n+1}`,from)});
  renderedThisRun+=frames;
  const result=validateVideo(temp,composition,frames,probe);
  if(result.streams.some(s=>s.codec_type==='audio'))throw Error('Silent chunk unexpectedly contains audio');
  run('ffmpeg',['-v','error','-xerror','-i',temp,'-f','null','NUL']);
  fs.renameSync(temp,file);
  state.parts=state.parts.filter(p=>p.from!==from);state.parts.push({from,to,frames,file:path.basename(file),sha256:sha(file),bytes:fs.statSync(file).size,elapsedSeconds:(Date.now()-partStarted)/1000,fullDecode:true});
  state.status='video parts';save(statePath,state);
 }
 state.parts.sort((a,b)=>a.from-b.from);
 let cursor=0;for(const part of state.parts){if(part.from!==cursor||part.frames!==part.to-part.from+1)throw Error('Gap or overlap in rendered ranges');cursor=part.to+1;}
 if(cursor!==total)throw Error('Rendered frame total does not match original composition');
 const audio=path.join(dir,'audio-full.wav');
 if(!(state.audio&&fs.existsSync(audio)&&state.audio.sha256===sha(audio))){
  if(fs.existsSync(audio))throw Error('Existing unverified audio preserved: '+audio);
  needSpace(dir,Math.ceil(expected*48000*2*4)+reserve,`${item.id} full audio`);
  const temp=path.join(dir,'audio-full.pending.wav');
  if(!audioCommon||audioCommon.composition.durationInFrames!==total||audioCommon.composition.fps!==fps)throw Error('Audio composition timeline mismatch');
  await renderMedia({...audioCommon,outputLocation:temp,codec:'wav',sampleRate:48000,muted:false,overwrite:true,onProgress:progress('full audio')});
  const info=probe(temp),a=info.streams.find(s=>s.codec_type==='audio');
  if(!a||Math.abs(Number(info.format.duration)-expected)>.1)throw Error('Full-timeline WAV length mismatch');
  run('ffmpeg',['-v','error','-xerror','-i',temp,'-f','null','NUL']);
  fs.renameSync(temp,audio);state.audio={composition:'FirstPostAudio',file:path.basename(audio),sha256:sha(audio),duration:Number(info.format.duration),sampleRate:a.sample_rate,fullDecode:true};state.status='audio ready';save(statePath,state);
 }
 const list=path.join(dir,'concat.txt');
 atomic(list,state.parts.map(p=>"file '"+path.join(dir,p.file).replaceAll('\\','/').replaceAll("'","'\\''")+"'\nduration "+(p.frames/fps).toFixed(9)+'\n').join(''));
 const finalBytes=state.parts.reduce((n,p)=>n+p.bytes,0)+Math.ceil(expected*parseInt(audioBitrate)*1000/8);
 needSpace(dir,finalBytes+reserve,`${item.id} final mux`);
 const tempOutput=path.join(path.dirname(output),'video.pending.mp4');
 run('ffmpeg',['-y','-v','error','-xerror','-f','concat','-safe','0','-i',list,'-i',audio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a',audioBitrate,'-ar','48000','-t',expected.toFixed(9),'-movflags','+faststart',tempOutput]);
 const final=validateVideo(tempOutput,composition,total,probe);
 if(!final.streams.some(s=>s.codec_type==='audio'))throw Error('Final mux lacks audio');
 if(fs.existsSync(output))throw Error('Existing final output preserved: '+output);
 fs.renameSync(tempOutput,output);
 state.status='muxed; awaiting full decode and visual inspection';state.outputSha256=sha(output);state.elapsedSeconds=(Date.now()-started)/1000;state.videoFrames=total;state.videoDuration=expected;state.containerDuration=Number(final.format.duration);save(statePath,state);
 return {statePath,jobKey,parts:state.parts.length,frames:total,videoDuration:expected,fullTimelineAudio:true,videoJoin:'stream copy',intermediateJpegQuality:100};
};
