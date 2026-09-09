'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const folder=__dirname,root=path.resolve(folder,'../../..'),pub=path.join(root,'영상/public/radioDreams20260910');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(exe,args)=>cp.execFileSync(exe,args,{encoding:'utf8',maxBuffer:12*1024*1024,windowsHide:true});
async function main(){
 const id=process.argv[2];if(!['11','13'].includes(id))throw Error('Use 11 or 13');
 const record=JSON.parse(fs.readFileSync(path.join(folder,`${id}_생성기록.json`),'utf8')),job=record.result?.[0];
 if(job?.status!=='completed'||!job.result_url)throw Error('No completed generated video');
 const original=path.join(folder,`${id}_생성원본.mp4`);
 if(!fs.existsSync(original))run('curl.exe',['--fail','--location','--silent','--show-error','--connect-timeout','10','--max-time','180','--output',original,job.result_url]);
 const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_entries','format=duration:stream=codec_type,width,height,r_frame_rate,nb_read_frames','-of','json',original]));
 const video=probe.streams.find(s=>s.codec_type==='video');if(!video||video.width<1920||video.height<1080)throw Error('Generated video below requested 1080p');
 const fps=video.r_frame_rate.split('/').map(Number).reduce((a,b)=>a/b),duration=Number(video.nb_read_frames)/fps;
 const target=path.join(pub,id==='11'?'water-loop.mp4':'field-loop.mp4');
 // A cyclic overlap, not a fade-to-black: play 2..15, then blend 15..17 with 0..2.
 // The next cycle continues at source 2s. Cosine weights have zero slope at both ends.
 const filter=`[0:v]scale=1920:1080:flags=lanczos,setpts=${17/duration}*(PTS-STARTPTS),fps=30,split=3[b][t][h];[b]trim=start=2:end=15,setpts=PTS-STARTPTS[body];[t]trim=start=15:end=17,setpts=PTS-STARTPTS[tail];[h]trim=start=0:end=2,setpts=PTS-STARTPTS[head];[tail][head]blend=all_expr='A*(0.5+0.5*cos(PI*T/2))+B*(0.5-0.5*cos(PI*T/2))+0.5'[join];[body][join]concat=n=2:v=1:a=0[out]`;
 run('ffmpeg',['-v','error','-y','-filter_complex_threads','1','-i',original,'-filter_complex',filter,'-map','[out]','-an','-frames:v','450','-c:v','libx264','-threads','2','-preset','medium','-crf','17','-pix_fmt','yuv420p','-g','30','-movflags','+faststart',target]);
 const frames=path.join(folder,`검수${id}`);fs.mkdirSync(frames,{recursive:true});
 for(const sec of [0,3,6,9,12,14.966])run('ffmpeg',['-v','error','-y','-ss',String(sec),'-i',target,'-frames:v','1',path.join(frames,`배경-${sec}.png`)]);
 const report={at:new Date().toISOString(),original:path.relative(root,original),originalSha256:hash(original),probe,output:path.relative(root,target),outputSha256:hash(target),playbackSpeed:duration/17,cycleSeconds:15,frames:450,method:'Whole generated scene retimed to 17s, 2s cosine-weight cyclic overlap, yielding 15s continuous loop. No camera transform, optical flow, region warp or generated mascot.',visualQA:'pending'};
 fs.writeFileSync(path.join(folder,`${id}_영상검사.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
