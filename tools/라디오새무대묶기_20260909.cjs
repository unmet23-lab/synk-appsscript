'use strict';
// 생성 영상 전체를 약 0.803배 속도로 재생. 부분 픽셀 변형/광류 프레임 합성은 하지 않는다.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/_ops/라디오생동_20260909/v3');
const source=path.join(out,'생성_A_원본.mp4'),cycle=path.join(out,'생성_A_15초.mp4');
const target=path.join(root,'docs/라디오/무대영상/추석_영상생성_20260909.mp4');
const probe=f=>JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames','-of','json',f],{encoding:'utf8'}));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const original=probe(source);if(original.streams[0].nb_read_frames!=='289'||original.streams[0].r_frame_rate!=='24/1')throw new Error('생성 원본 규격 변경');
const encode=['-hide_banner','-loglevel','warning','-i',source,'-map','0:v','-an','-vf','scale=1280:720:flags=lanczos,setpts=(360/289)*(PTS-STARTPTS),fps=30','-t','15','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-g','60','-keyint_min','60','-sc_threshold','0','-movflags','+faststart','-y',cycle];
execFileSync('ffmpeg',encode,{stdio:'inherit',timeout:180000});
const c=probe(cycle);if(c.streams[0].nb_read_frames!=='450'||Number(c.format.duration)!==15)throw new Error('15초 반복 규격 불일치');
const repeat=['-hide_banner','-loglevel','warning','-stream_loop','3','-i',cycle,'-map','0:v','-an','-t','60','-c','copy','-movflags','+faststart','-y',target];
execFileSync('ffmpeg',repeat,{stdio:'inherit',timeout:60000});
const final=probe(target);if(final.streams.length!==1||final.streams[0].nb_read_frames!=='1800'||Number(final.format.duration)!==60)throw new Error('방송판 규격 불일치');
const report={at:new Date().toISOString(),source,sourceSha256:sha(source),sourceProbe:original,cycle,cycleSha256:sha(cycle),cycleProbe:c,target,targetSha256:sha(target),finalProbe:final,playbackSpeed:289/360,method:'Entire generated clip retimed to 15s, four exact repeats. Lanczos downscale and ordinary fps conversion. No regional warp, no optical-flow interpolation, no synthetic camera movement.',encodeArgs:encode,repeatArgs:repeat};
fs.writeFileSync(path.join(out,'방송판제작.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
