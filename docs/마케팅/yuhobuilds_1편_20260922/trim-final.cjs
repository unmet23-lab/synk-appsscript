'use strict';
// One-time finish of the initial render: retain every spoken word, shorten only the end hold.
// Future render.cjs runs use the revised 5397-frame timeline directly.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const dir=__dirname,master=path.join(dir,'yuhobuilds_EP01.mp4'),review=path.join(dir,'검수');
const source=path.join(review,'before-tail-trim.mp4'),temporary=path.join(dir,'tail-trim.partial.mp4');
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr||r.error||exe);return r;};
const probe=file=>JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]).stdout);
const timing=JSON.parse(fs.readFileSync(path.join(dir,'장면타이밍.json'),'utf8'));
const duration=timing.durationInFrames/timing.fps;
if(timing.durationInFrames!==5397||duration!==179.9)throw Error('Unexpected final timeline');
const words=JSON.parse(fs.readFileSync(path.join(dir,'words.json'),'utf8'));
if(words.at(-1).end>duration-.4)throw Error('Insufficient end hold');
if(!fs.existsSync(source)){
  const original=probe(master);if(Math.abs(Number(original.format.duration)-181.233333)>.12)throw Error('Unexpected initial master duration');
  fs.copyFileSync(master,source);
}
run('ffmpeg',['-y','-v','error','-i',source,'-i',path.join(dir,'audio/narration-master.wav'),'-map','0:v:0','-map','1:a:0','-t',String(duration),'-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart',temporary]);
const checked=probe(temporary),video=checked.streams.find(s=>s.codec_type==='video'),audio=checked.streams.find(s=>s.codec_type==='audio');
if(Number(checked.format.duration)>180||Math.abs(Number(checked.format.duration)-duration)>.1||video.width!==1080||video.height!==1920||!audio)throw Error('Trimmed master specification mismatch');
run('ffmpeg',['-v','error','-i',temporary,'-f','null','-']);
fs.renameSync(temporary,master);
const measure=run('ffmpeg',['-v','info','-i',master,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']).stderr;
const stats=JSON.parse(measure.slice(measure.lastIndexOf('{'),measure.lastIndexOf('}')+1));
const sha=crypto.createHash('sha256').update(fs.readFileSync(master)).digest('hex');
fs.writeFileSync(path.join(review,'영상규격.json'),JSON.stringify({createdAt:new Date().toISOString(),path:master,sha256:sha,bytes:Number(checked.format.size),durationSeconds:Number(checked.format.duration),video,audio,browserErrors:[],fullDecodePassed:true,finalAacLoudness:stats,endTrim:{source:'검수/before-tail-trim.mp4',lastWordEndSeconds:words.at(-1).end,spokenContentRemoved:false},directListeningVerified:false},null,2)+'\n');
console.log(JSON.stringify({duration:Number(checked.format.duration),frames:video.nb_frames,lufs:stats.input_i,truePeak:stats.input_tp,lastWordEnd:words.at(-1).end,fullDecodePassed:true}));
