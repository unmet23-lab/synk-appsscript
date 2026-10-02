'use strict';
// Rebuild aligned narration, captions and the music mix from retained Typecast outputs.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const here=__dirname,repo=path.resolve(here,'../../..'),audio=path.join(here,'audio'),review=path.join(here,'검수');
fs.mkdirSync(review,{recursive:true});
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr||r.error||exe);return {stdout:r.stdout,stderr:r.stderr};};
const probe=file=>JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]).stdout);
const write=(name,value)=>fs.writeFileSync(path.join(here,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
const fps=30,script=JSON.parse(fs.readFileSync(path.join(here,'narration-script.json'),'utf8'));
const editNarration=require('./edit-narration.cjs');
const typing=require('./typing-cues.cjs');
const scenes=[],captions=[],words=[],concat=[];let frame=0;
const display=s=>s.replaceAll('에이아이','AI').replaceAll('백 시간','100시간').replaceAll('일인 기업가','1인 기업가').replaceAll('이천이십육년 유월 이일','2026년 6월 2일');
for(const [index,segment] of script.segments.entries()){
  const base='narration-'+segment.id;
  let source=path.join(audio,base+'.wav');
  let data=JSON.parse(fs.readFileSync(path.join(audio,base+'.json'),'utf8'));
  if(data.request.text!==segment.text)throw Error('Narration text mismatch '+segment.id);
  if(!data.words?.length)throw Error('Missing word timings '+segment.id);
  ({source,data}=editNarration(segment.id,source,data));
  const duration=Number(probe(source).format.duration);if(Math.abs(duration-data.audio_duration)>.12)throw Error('Audio duration mismatch '+segment.id);
  const lead=index===0?.1:segment.visual==='signoff'?.22:.04,tail=index===script.segments.length-1?.7:segment.visual==='joke'?.23:.05;
  const blockFrames=Math.ceil((lead+duration+tail)*fps),blockSeconds=blockFrames/fps,startSeconds=frame/fps;
  const localFile=path.join(audio,'block-'+segment.id+'.wav');
  run('ffmpeg',['-y','-v','error','-i',source,'-af',`aresample=48000,adelay=${Math.round(lead*1000)}:all=1,apad,atrim=duration=${blockSeconds}`,'-ar','48000','-ac','2','-c:a','pcm_s16le',localFile]);
  concat.push(`file 'block-${segment.id}.wav'`);
  scenes.push({id:segment.id,start:frame,duration:blockFrames,visual:segment.visual,text:display(segment.text),voiceStartFrame:frame+Math.round(lead*fps),voiceDurationSeconds:duration});
  if(segment.visual==='prompt')scenes.at(-1).typing=typing.cues(data.words,lead,fps);
  const adjusted=data.words.map(w=>({text:display(w.text),start:w.start+startSeconds+lead,end:w.end+startSeconds+lead,segment:segment.id}));
  for(const w of adjusted){if(!Number.isFinite(w.start)||w.end<=w.start||w.end>startSeconds+blockSeconds+.05)throw Error('Invalid alignment '+segment.id);words.push(w);}
  let group=[];const segmentCaptionStart=captions.length;
  const flush=()=>{
    if(!group.length)return;
    const current={text:display(group.map(w=>w.text).join(' ')),startMs:Math.round(group[0].start*1000),endMs:Math.round((group.at(-1).end+.1)*1000),timestampMs:null,confidence:null};
    const previous=captions.at(-1);
    // Keep a brief sentence ending with its clause instead of flashing one isolated verb.
    if(captions.length>segmentCaptionStart&&(current.endMs-current.startMs<850||current.text.length<8)&&previous.text.length+current.text.length+1<=25&&current.endMs-previous.startMs<=3000){previous.text+=' '+current.text;previous.endMs=current.endMs;}
    else captions.push(current);
    group=[];
  };
  for(let i=0;i<adjusted.length;i++){
    const w=adjusted[i];const proposed=[...group,w].map(x=>x.text).join(' ');
    if(group.length&&(proposed.length>18||w.end-group[0].start>2.2))flush();
    group.push(w);if(/[.!?]$/.test(w.text)||(/[,，]$/.test(w.text)&&group.map(x=>x.text).join(' ').length>=17))flush();
  }
  flush();frame+=blockFrames;
}
for(let i=0;i<captions.length-1;i++)captions[i].endMs=Math.min(captions[i].endMs,captions[i+1].startMs);
// Spoken date is normalized in the display captions without changing the voice.
for(let i=0;i<captions.length;i++)captions[i].text=display(captions[i].text).replaceAll('이천이십육년','2026년').replaceAll('유월','6월').replace(/이일(?=[,. ]|$)/g,'2일');
write('장면타이밍.json',{fps,durationInFrames:frame,audioFile:'yuho-journey-01/narration.wav',audioStartFrame:0,scenes});
write('captions.json',captions);write('words.json',words);
const fmt=ms=>new Date(ms).toISOString().slice(11,23).replace('.',',');
write('captions.srt',captions.map((c,i)=>`${i+1}\n${fmt(c.startMs)} --> ${fmt(c.endMs)}\n${c.text}\n`).join('\n'));
fs.writeFileSync(path.join(audio,'blocks.txt'),concat.join('\n')+'\n');
const narration=path.join(audio,'narration-only.wav');
run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',path.join(audio,'blocks.txt'),'-c:a','pcm_s16le',narration]);
const total=frame/fps,bed=path.join(audio,'music-bed.wav');
const bgm=path.join(repo,'docs/홍보물/BGM/시티팝_147.wav');
const joke=scenes.find(s=>s.visual==='joke');
const bedFilter=`[0:a]atrim=start=25:duration=${total},asetpts=PTS-STARTPTS,afade=t=in:d=0.15,afade=t=out:st=${total-.65}:d=0.65,volume=0.25,volume=enable='between(t,${joke.start/fps-.12},${(joke.start+joke.duration)/fps})':volume=0.08[bed]`;
run('ffmpeg',['-y','-v','error','-i',bgm,'-filter_complex',bedFilter,'-map','[bed]','-ar','48000','-ac','2','-c:a','pcm_s16le',bed]);
const premix=path.join(audio,'premix.wav');
const keyboard=typing.audio(scenes,total,fps,audio);write('검수/타이핑동기화.json',keyboard);
run('ffmpeg',['-y','-v','error','-i',narration,'-i',bed,'-i',keyboard.file,'-filter_complex','[0:a]asplit=2[voice][key];[1:a][key]sidechaincompress=threshold=0.02:ratio=3:attack=8:release=110[ducked];[voice][ducked][2:a]amix=inputs=3:duration=first:normalize=0[mix]','-map','[mix]','-c:a','pcm_s16le',premix]);
const analysis=run('ffmpeg',['-v','info','-i',premix,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']).stderr;
const measure=JSON.parse(analysis.slice(analysis.lastIndexOf('{'),analysis.lastIndexOf('}')+1));
// A constant gain preserves the timestamped voice exactly; allow a small loudness margin for true peaks.
const gainDb=Math.min(-16-Number(measure.input_i),-1.5-Number(measure.input_tp));
const master=path.join(audio,'narration-master.wav');
run('ffmpeg',['-y','-v','error','-i',premix,'-af',`volume=${gainDb}dB`,'-ar','48000','-ac','2','-c:a','pcm_s16le',master]);
const finalMeasure=run('ffmpeg',['-v','info','-i',master,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']).stderr;
const finalStats=JSON.parse(finalMeasure.slice(finalMeasure.lastIndexOf('{'),finalMeasure.lastIndexOf('}')+1));
write('검수/음량.json',{createdAt:new Date().toISOString(),premix:measure,master:finalStats,constantGainDb:gainDb,bgm:{source:'docs/홍보물/BGM/시티팝_147.wav',sectionStart:25,sectionDuration:total,looped:false,gain:.25,punchlineGainFactor:.08,sidechainCompression:true},durationSeconds:total,voice:'Typecast '+script.voice.name+' / ssfm-v30 / preset by segment',directListeningVerified:false});
if(Math.abs(Number(probe(master).format.duration)-total)>.05)throw Error('Master duration mismatch');
console.log(JSON.stringify({durationSeconds:total,scenes:scenes.length,captions:captions.length,words:words.length,lufs:finalStats.input_i,truePeak:finalStats.input_tp}));

