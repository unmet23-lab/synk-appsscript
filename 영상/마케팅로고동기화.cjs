'use strict';
// Logo-only migration of the existing six shorts and two lessons. Never prepares
// plans, captions or audio. Originals and their reports remain the provenance.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const video=__dirname,root=path.dirname(video),collection=path.join(root,'docs/홍보물/마케팅실행_20260909');
const base=path.join(root,'tmp/marketing-logo-rollout-20260910');
const {bundle}=require(path.join(video,'node_modules/@remotion/bundler'));
const {selectComposition,renderMedia,openBrowser}=require(path.join(video,'node_modules/@remotion/renderer'));
// The installed FFmpeg has loop/setpts/overlay filters; Remotion's small binary does not.
const ffmpeg='ffmpeg',ffprobe='ffprobe';
const ids=['03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok','shift-public-class-01','shift-public-clinic-demo-01'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr||String(r.error));return r.stdout;};
const audio=p=>run(ffmpeg,['-v','error','-i',p,'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).trim();
const probe=p=>JSON.parse(run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',p]));
const movie=id=>path.join(collection,id.startsWith('shift-')?`공개수업/${id.includes('clinic')?'클리닉':'수업'}.mp4`:`${id}/video.mp4`);
const rect=wide=>wide?{x:100,y:64,w:232,h:136}:{x:92,y:246,w:268,h:146};
async function main(){
 fs.mkdirSync(base,{recursive:true});
 const requested=process.argv.includes('--id')?process.argv[process.argv.indexOf('--id')+1]:null;
 const selected=requested?requested.split(','):ids;
 if(selected.some(id=>!ids.includes(id)))throw Error('Unsupported ID');
 const synk=path.join(collection,'assets/brand-synk.webp'),publicSynk=path.join(video,'public/마케팅실행20260909/brand-synk.webp');
 if(sha(synk)!==sha(publicSynk))throw Error('Public SYNK differs from approved collection source');
 const platePublic=path.join(base,'public'),plateAssets=path.join(platePublic,'마케팅실행20260909');
 fs.mkdirSync(plateAssets,{recursive:true});fs.copyFileSync(publicSynk,path.join(plateAssets,'brand-synk.webp'));
 fs.cpSync(path.join(video,'public/폰트'),path.join(platePublic,'폰트'),{recursive:true});
 const serveUrl=await bundle({entryPoint:path.join(video,'src/마케팅실행20260909/LogoPlate.tsx'),rootDir:video,publicDir:platePublic,outDir:path.join(base,'bundle-current'),enableCaching:false,webpackOverride:c=>({...c,cache:false})});
 const browserExecutable='C:/Program Files/Google/Chrome/Application/chrome.exe',puppeteerInstance=await openBrowser('chrome',{browserExecutable});
 try{
  const prototypes={};
  for(const wide of [...new Set(selected.map(id=>id.startsWith('shift-'))) ]){
   const inputProps={wide},composition=await selectComposition({serveUrl,id:'MarketingLogoPlate',inputProps,browserExecutable,puppeteerInstance});
   const outputLocation=path.join(base,wide?'prototype-wide.mp4':'prototype-short.mp4');
   await renderMedia({serveUrl,composition,inputProps,browserExecutable,puppeteerInstance,concurrency:2,outputLocation,muted:true,codec:'h264',crf:10,pixelFormat:'yuv420p',colorSpace:'bt709',imageFormat:'png',overwrite:true});
   prototypes[String(wide)]=outputLocation;
  }
  for(const id of selected){
   const dir=path.join(base,id);fs.mkdirSync(dir,{recursive:true});
   const prior=movie(id),priorHash=sha(prior),proof=read(path.join(collection,`_검토/영상_${id}_검증.json`));
   if(priorHash!==proof.videoSha256)throw Error('Existing movie does not match original verified output: '+id);
   const planPath=path.join(video,`public/마케팅실행20260909/plans/${id}.json`),item=read(planPath),wide=item.width>1080;
   const beforeProbe=probe(prior),beforeVideo=beforeProbe.streams.find(s=>s.codec_type==='video');
   const frames=item.scenes.reduce((n,s)=>n+Math.round(s.durationSec*30),0);
   if(Number(beforeVideo.nb_frames)!==frames||beforeVideo.r_frame_rate!=='30/1')throw Error('Plan/frame timeline mismatch: '+id);
   const backup=path.join(dir,'original.mp4');if(fs.existsSync(backup)&&sha(backup)!==priorHash)throw Error('Existing backup differs');if(!fs.existsSync(backup))fs.copyFileSync(prior,backup);
   fs.copyFileSync(planPath,path.join(dir,'original-plan.json'));save(path.join(dir,'original-verification.json'),proof);
   const parts=item.scenes.map((s,i)=>{const n=Math.round(s.durationSec*30);if(n<30)throw Error('Scene too short');return `[s${i}]loop=loop=${n-30}:size=1:start=12,setpts=N/(30*TB)[c${i}]`;});
   const graph=`[0:v]split=${parts.length}${parts.map((_,i)=>`[s${i}]`).join('')};${parts.join(';')};${parts.map((_,i)=>`[c${i}]`).join('')}concat=n=${parts.length}:v=1:a=0[v]`;
   const plate=path.join(dir,'logo-plate.mp4'),candidate=path.join(dir,'video.mp4'),r=rect(wide);
   run(ffmpeg,['-y','-v','error','-i',prototypes[String(wide)],'-filter_complex',graph,'-map','[v]','-c:v','libx264','-threads','2','-crf','10','-preset','fast','-pix_fmt','yuv420p',plate]);
   run(ffmpeg,['-y','-v','error','-i',prior,'-i',plate,'-filter_complex',`[0:v][1:v]overlay=${r.x}:${r.y}:format=auto:eof_action=pass[v]`,'-map','[v]','-map','0:a:0','-c:v','libx264','-threads','2','-crf','17','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',candidate]);
   const originalAudio=audio(prior),candidateAudio=audio(candidate);if(originalAudio!==candidateAudio)throw Error('AAC changed '+id);
   run(ffmpeg,['-v','error','-xerror','-i',candidate,'-f','null','NUL']);
   const afterProbe=probe(candidate),afterVideo=afterProbe.streams.find(s=>s.codec_type==='video');
   if(Number(afterVideo.nb_frames)!==frames||afterVideo.width!==beforeVideo.width||afterVideo.height!==beforeVideo.height)throw Error('Frame or size changed');
   const samples=[0,.1,1.8,item.scenes[0].durationSec-.1,item.scenes[0].durationSec+.1,(frames-2)/30];
   for(const sec of samples)run(ffmpeg,['-y','-v','error','-ss',String(sec),'-i',candidate,'-frames:v','1',path.join(dir,`frame-${sec.toFixed(2)}.png`)]);
   run(ffmpeg,['-y','-v','error','-ss','1.8','-i',prior,'-frames:v','1',path.join(dir,'original-frame.png')]);
   if(sha(prior)!==priorHash||sha(planPath)!==sha(path.join(dir,'original-plan.json')))throw Error('Input changed during rendering');
   save(path.join(dir,'verification.json'),{at:new Date().toISOString(),id,sourceSha256:priorHash,sha256:sha(candidate),sourcePlanSha256:sha(planPath),synkAssetSha256:sha(synk),audioStreamIdentical:true,audioStreamHash:candidateAudio,logoRect:r,frames,width:afterVideo.width,height:afterVideo.height,durationSeconds:Number(afterProbe.format.duration),fullDecode:true,capturedSeconds:samples,visualInspection:'pending',scope:'Only original SYNK area replaced; original business-name stitches, voices, captions, content and timing preserved. H264 re-encoding causes ordinary quantization differences outside logo crop.',externalPosting:false});
   console.log(id+' candidate verified');
  }
 }finally{await puppeteerInstance.close({silent:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1});
