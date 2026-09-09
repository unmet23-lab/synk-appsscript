'use strict';
// Reproducible evidence only; visual and listening judgments are recorded separately.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const review=__dirname,collection=path.dirname(review),repo=path.resolve(collection,'../../..');
const plans=path.join(repo,'영상/public/마케팅실행20260909/plans');
const ffmpeg=path.join(repo,'영상/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
const ids=['01-lab-youtube','03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok','shift-public-class-01','shift-public-clinic-demo-01'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const normalize=s=>s.normalize('NFKC').replace(/\s+/g,'');
const results=[];
for(const id of ids){
 const lesson=id==='shift-public-class-01',clinic=id==='shift-public-clinic-demo-01',long=lesson||clinic;
 const media=long?path.join(collection,'공개수업',lesson?'수업.mp4':'클리닉.mp4'):path.join(collection,id,'video.mp4');
 const srt=long?path.join(collection,'공개수업',lesson?'수업.srt':'클리닉.srt'):path.join(collection,id,'자막.srt');
 const report=read(path.join(review,'영상_'+id+'_검증.json')),plan=read(path.join(plans,id+'.json'));
 const captions=read(path.join(review,'영상_'+id+'_captions.json')).captions;
 if(hash(media)!==report.videoSha256)throw new Error('MP4 hash changed: '+id);
 if(!fs.existsSync(srt))throw new Error('SRT absent: '+id);
 let offset=0,previousEnd=0;
 for(const c of captions){
  if(c.startMs<previousEnd-1||c.endMs<=c.startMs||c.endMs>report.durationSeconds*1000)throw new Error('Caption timeline invalid: '+id);
  previousEnd=c.endMs;
 }
 if(long&&normalize(captions.map(c=>c.text).join(' '))!==normalize(plan.scenes.map(s=>s.narration).join(' ')))throw new Error('Canonical narration text mismatch: '+id);
 const chapters=plan.scenes.map((scene,index)=>{
  const item={index:index+1,title:scene.title,startSeconds:offset,durationSeconds:scene.durationSec,audioDurationSeconds:scene.audioDurationSec,captionTimingBasis:scene.captionTimingBasis,captionAlignmentDifferenceRatio:scene.captionAlignmentDifferenceRatio};
  offset+=scene.durationSec;return item;
 });
 const log=fs.readFileSync(path.join(review,'영상_'+id+'_audio.log'),'utf8');
 const match=log.match(/\{\s*"input_i"[\s\S]*?\}/);
 if(!match)throw new Error('Loudness measurement missing: '+id);
 const audio=JSON.parse(match[0]);
 const frameDir=path.join(review,'영상프레임-'+id);
 const frameFiles=fs.readdirSync(frameDir).filter(f=>/^frame-\d+\.png$/.test(f)).sort();
 if(frameFiles.length!==report.capturedSeconds.length)throw new Error('Frame evidence count mismatch: '+id);
 results.push({id,file:path.relative(collection,media).replace(/\\/g,'/'),videoSha256:report.videoSha256,srtSha256:hash(srt),renderSourceSha256:report.renderSourceSha256,scriptSha256:report.scriptSha256,width:report.width,height:report.height,timelineSeconds:offset,containerSeconds:report.durationSeconds,bytes:report.bytes,captions:captions.length,captionMinSeconds:Math.min(...captions.map(c=>(c.endMs-c.startMs)/1000)),captionMaxChars:Math.max(...captions.map(c=>c.text.length)),canonicalNarrationPreserved:long?true:null,loudness:{integratedLUFS:Number(audio.input_i),truePeakDbTP:Number(audio.input_tp),loudnessRangeLU:Number(audio.input_lra)},chapters,frames:frameFiles.map((f,i)=>({file:path.relative(collection,path.join(frameDir,f)).replace(/\\/g,'/'),second:report.capturedSeconds[i],sha256:hash(path.join(frameDir,f))})),contactSheetSha256:hash(path.join(review,'영상_'+id+'_contact.png'))});
}
const details=[
 ['03-lab-tiktok',1,'lab-role-list'],['03-lab-tiktok',13,'lab-korean-mongolian'],
 ['04-yuhobuilds-youtube',25,'intro-specific-scene'],['05-yuhobuilds-instagram',20,'envelope-outline'],
 ['06-yuhobuilds-tiktok',9,'scissors-and-copy'],['07-synkbrief-youtube',27,'source-scope'],['09-synkbrief-tiktok',16,'conditions-retained'],
 ['shift-public-class-01',8,'opening-caption'],['shift-public-class-01',92,'situation-caption'],['shift-public-class-01',241,'long-two-line-caption'],
 ['shift-public-class-01',420,'six-fields-caption'],['shift-public-class-01',507,'promise-caution'],['shift-public-class-01',623,'final-followup'],
 ['shift-public-clinic-demo-01',7,'fiction-label'],['shift-public-clinic-demo-01',61,'corrected-offer'],['shift-public-clinic-demo-01',79,'complete-help']
];
const detailDir=path.join(review,'영상_상세프레임');fs.mkdirSync(detailDir,{recursive:true});
const detailedFrames=details.map(([id,second,label])=>{
 const video=results.find(r=>r.id===id),target=path.join(detailDir,id+'-'+label+'.png');
 const r=spawnSync(ffmpeg,['-y','-v','error','-ss',String(second),'-i',path.join(collection,video.file),'-frames:v','1',target],{encoding:'utf8',windowsHide:true});
 if(r.status!==0)throw new Error('Detailed extraction failed: '+r.stderr);
 return {id,second,label,file:path.relative(collection,target).replace(/\\/g,'/'),sha256:hash(target),sourceVideoSha256:video.videoSha256};
});
const posters=['shift-public-class-01','shift-public-clinic-demo-01'].map(id=>{
 const video=results.find(r=>r.id===id),scene=read(path.join(plans,id+'.json')).scenes[0];
 const second=Math.min(scene.audioDurationSec+.2,scene.durationSec-.35);
 const target=path.join(collection,'공개수업',id==='shift-public-class-01'?'표지.jpg':'클리닉-표지.jpg');
 const r=spawnSync(ffmpeg,['-y','-v','error','-ss',String(second),'-i',path.join(collection,video.file),'-frames:v','1','-q:v','2',target],{encoding:'utf8',windowsHide:true});
 if(r.status!==0)throw new Error('Poster extraction failed: '+r.stderr);
 return {id,second,file:path.relative(collection,target).replace(/\\/g,'/'),sha256:hash(target),sourceVideoSha256:video.videoSha256};
});
const result={generatedAt:new Date().toISOString(),passed:true,mediaCount:results.length,sceneCount:results.reduce((n,r)=>n+r.chapters.length,0),representativeFrameCount:results.reduce((n,r)=>n+r.frames.length,0),detailedFrameCount:detailedFrames.length,sourceScriptSha256:hash(path.join(collection,'원고/콘텐츠원고.json')),videos:results,detailedFrames,posters,visualInspection:'Not inferred by this script. See separate final visual inspection report keyed by the same video hashes.',listening:'Human listening not performed; local ASR and audio technical tests are separate.',externalPosting:false};
fs.writeFileSync(path.join(review,'영상_종합기계검증.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,mediaCount:result.mediaCount,sceneCount:result.sceneCount,representativeFrameCount:result.representativeFrameCount,detailedFrameCount:result.detailedFrameCount},null,2));
