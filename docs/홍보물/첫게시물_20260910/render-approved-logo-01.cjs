'use strict';
// Re-render the accepted 01 visual timeline and copy its existing AAC stream exactly.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const id=(process.argv.find(x=>x.startsWith('--id='))||'--id=01-lab-youtube').slice(5);
if(!['01-lab-youtube','05-yuhobuilds-instagram'].includes(id))throw Error('This renderer is scoped to the accepted 01 film and the 05 embedded document');
const root=path.resolve(__dirname,'../../..'),video=path.join(root,'영상'),out=path.join(__dirname,'_검토/로고반영',id);
const {bundle}=require(path.join(video,'node_modules/@remotion/bundler'));
const {selectComposition,renderMedia,renderStill,openBrowser}=require(path.join(video,'node_modules/@remotion/renderer'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const run=(exe,args)=>{const r=spawnSync(exe,args,{windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr||String(r.error));return r.stdout;};
const probe=p=>JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',p]));
async function main(){
 fs.mkdirSync(out,{recursive:true});const input=read(path.join(__dirname,'_검토/video',id,'render-input.json')),prior=path.join(__dirname,id,'video.mp4'),priorHash=sha(prior),proof=read(path.join(__dirname,'_검토/video',id,'verification.json'));
 if(priorHash!==proof.sha256)throw Error('Accepted film changed before logo render');
 const assets=read(path.join(video,'public/firstposts20260910/assets.json')),cache=path.join(__dirname,'_검토/video/public/firstposts20260910');
 for(const [key,file]of Object.entries(assets))if(key.startsWith('logo-')||['pulse-full','pulse-frame','pulse-last','synk-intro','proof-start','proof-ready'].includes(key))if(fs.existsSync(path.join(video,'public/firstposts20260910',file)))fs.copyFileSync(path.join(video,'public/firstposts20260910',file),path.join(cache,file));
 fs.copyFileSync(path.join(video,'public/firstposts20260910/assets.json'),path.join(cache,'assets.json'));
 save(path.join(out,'render-input.json'),input);
 const serveUrl=await bundle({entryPoint:path.join(video,'src/firstposts20260910/index.tsx'),rootDir:video,publicDir:path.join(__dirname,'_검토/video/public'),outDir:path.join(out,'bundle'),enableCaching:false,webpackOverride:c=>({...c,cache:false})});
 const browserExecutable='C:/Program Files/Google/Chrome/Application/chrome.exe',puppeteerInstance=await openBrowser('chrome',{browserExecutable});
 try{
  // Browser decoding is the local fallback for compositor "No frame found" on this media.
  const renderProps={...input,decodeInBrowser:true};
  const composition=await selectComposition({serveUrl,id:'FirstPost',inputProps:renderProps,browserExecutable,puppeteerInstance}),common={serveUrl,composition,inputProps:renderProps,browserExecutable,puppeteerInstance,concurrency:2};
  const silent=path.join(out,'video-silent.mp4'),final=path.join(out,'video.mp4');let last=-1;
  await renderMedia({...common,outputLocation:silent,muted:true,codec:'h264',pixelFormat:'yuv420p',videoBitrate:'12M',colorSpace:'bt709',imageFormat:'jpeg',jpegQuality:100,overwrite:true,onProgress:p=>{const step=Math.floor(p.progress*20);if(step!==last){last=step;console.log('01 logo visuals '+step*5+'% frames='+p.renderedFrames);}}});
  run('ffmpeg',['-y','-v','error','-i',silent,'-i',prior,'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',final]);
  const audioHash=p=>run('ffmpeg',['-v','error','-i',p,'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).trim();
  const beforeAudio=audioHash(prior),afterAudio=audioHash(final);if(beforeAudio!==afterAudio)throw Error('Audio bytes changed');
  const info=probe(final),v=info.streams.find(s=>s.codec_type==='video');if(v.width!==composition.width||v.height!==composition.height||Number(v.nb_frames)!==composition.durationInFrames||Math.abs(Number(v.duration)-proof.expectedDuration)>.04)throw Error('Timeline contract changed');
  run('ffmpeg',['-v','error','-xerror','-i',final,'-f','null','NUL']);
  let offset=0;const times=id==='01-lab-youtube'?[1,7,17.5,25.5,40,87.8,89.5,92.5]:input.item.scenes.map(s=>{const t=offset+1.8;offset+=s.duration;return t;});
  for(const sec of times)run('ffmpeg',['-y','-v','error','-ss',String(sec),'-i',final,'-frames:v','1',path.join(out,'frame-'+sec+'.png')]);
  if(sha(prior)!==priorHash)throw Error('Accepted film changed during rendering');
  save(path.join(out,'verification.json'),{at:new Date().toISOString(),sourceSha256:priorHash,sha256:sha(final),audioStreamIdentical:true,audioStreamHash:afterAudio,width:v.width,height:v.height,frames:Number(v.nb_frames),duration:Number(v.duration),fullDecode:true,inputSha256:sha(path.join(out,'render-input.json')),visualInspection:'pending',scope:'Same existing timeline and original AAC; current approved logos in header and embedded artifact.',externalPosting:false});
  console.log('01 logo candidate verified; visual inspection remains');
 }finally{await puppeteerInstance.close({silent:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
