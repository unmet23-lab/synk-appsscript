'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const here = __dirname;
const audio = path.join(here, 'audio');
const repo = path.resolve(here, '../../../..');
const script = JSON.parse(fs.readFileSync(path.join(here, 'narration-script.json'), 'utf8'));
const captionGroups = require('./caption-groups.json');
const fps = 30;
const run = (exe, args) => {
  const p = spawnSync(exe, args, {encoding:'utf8', windowsHide:true, maxBuffer:8*1024*1024});
  if (p.status !== 0) throw Error(`${exe}: ${p.stderr || p.error}`);
  return p.stdout || p.stderr;
};
const probe = f => JSON.parse(run('ffprobe', ['-v','error','-show_entries','format=duration','-of','json',f])).format.duration;
let frame = 0;
const scenes = [], captions = [], words = [], blocks = [];
for (const [i,s] of script.segments.entries()) {
  const source = path.join(audio, `narration-${s.id}.wav`);
  const alignment = JSON.parse(fs.readFileSync(path.join(audio, `narration-${s.id}.json`),'utf8'));
  if (alignment.request.text !== s.text || !alignment.words?.length) throw Error(`Voice alignment mismatch: ${s.id}`);
  const voiceDur = Number(probe(source));
  if (Math.abs(voiceDur-alignment.audio_duration) > .14) throw Error(`Voice duration mismatch: ${s.id}`);
  const lead = i === 0 ? .12 : .065;
  const tail = i === script.segments.length-1 ? .55 : (['05','08'].includes(s.id) ? .12 : .045);
  const frames = Math.ceil((lead+voiceDur+tail)*fps);
  const localDur = frames/fps;
  const block = path.join(audio,`block-${s.id}.wav`);
  run('ffmpeg',['-y','-v','error','-i',source,'-af',`aresample=48000,adelay=${Math.round(lead*1000)}:all=1,apad,atrim=duration=${localDur}`,'-ar','48000','-ac','2','-c:a','pcm_s16le',block]);
  blocks.push(`file 'block-${s.id}.wav'`);
  const start = frame/fps;
  const wc = alignment.words.map(w=>({text:w.text,start:start+lead+w.start,end:start+lead+w.end,segment:s.id}));
  words.push(...wc);
  scenes.push({id:s.id,visual:s.visual,startFrame:frame,durationFrames:frames,startSeconds:start,durationSeconds:localDur,voiceStartSeconds:start+lead,voiceDurationSeconds:voiceDur,text:s.text});
  let group=[];
  const flush=()=>{
    if (!group.length) return;
    const c={text:group.map(w=>w.text).join(' '),start:group[0].start,end:group.at(-1).end+.11,segment:s.id};
    const prev=captions.at(-1);
    if(!captionGroups[s.id] && prev && prev.segment===s.id && (c.end-c.start<.72 || c.text.length<5) && prev.text.length+c.text.length<27) {prev.text+=' '+c.text;prev.end=c.end;}
    else captions.push(c);
    group=[];
  };
  if(captionGroups[s.id]) {
    if(captionGroups[s.id].reduce((a,b)=>a+b,0)!==wc.length) throw Error('Caption group mismatch: '+s.id);
    let cursor=0;
    for(const count of captionGroups[s.id]) {group=wc.slice(cursor,cursor+count);flush();cursor+=count;}
  } else for (const w of wc) {
    const test=[...group,w].map(x=>x.text).join(' ');
    if(group.length && (test.length>19 || w.end-group[0].start>2.1)) flush();
    group.push(w);
    if(/[.!?]$/.test(w.text)) flush();
  }
  flush();
  frame+=frames;
}
for(let i=0;i<captions.length-1;i++)captions[i].end=Math.min(captions[i].end,captions[i+1].start);
fs.writeFileSync(path.join(here,'timeline.json'),JSON.stringify({fps,durationFrames:frame,durationSeconds:frame/fps,scenes,captions,words},null,2));
const fmt=t=>new Date(Math.round(t*1000)).toISOString().slice(11,23).replace('.',',');
fs.writeFileSync(path.join(here,'captions.srt'),captions.map((c,i)=>`${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n'));
fs.writeFileSync(path.join(audio,'blocks.txt'),blocks.join('\n')+'\n');
const voice=path.join(audio,'narration-only.wav');
run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',path.join(audio,'blocks.txt'),'-c:a','pcm_s16le',voice]);
const total=frame/fps;
const music=path.join(repo,'docs/홍보물/BGM/시티팝_147.wav');
const bed=path.join(audio,'music-bed.wav');
run('ffmpeg',['-y','-v','error','-ss','20','-i',music,'-t',String(total),'-af',`afade=t=in:d=0.15,afade=t=out:st=${total-0.75}:d=0.75,volume=0.26`,'-ar','48000','-ac','2','-c:a','pcm_s16le',bed]);
const mix=path.join(audio,'narration-master.wav');
run('ffmpeg',['-y','-v','error','-i',voice,'-i',bed,'-filter_complex','[0:a]asplit=2[v][side];[1:a][side]sidechaincompress=threshold=0.018:ratio=3:attack=8:release=130[duck];[v][duck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.84,volume=-1.4dB[out]','-map','[out]','-ar','48000','-ac','2','-c:a','pcm_s16le',mix]);
const measure=run('ffmpeg',['-v','info','-i',mix,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']);
const stats=JSON.parse(measure.slice(measure.lastIndexOf('{'),measure.lastIndexOf('}')+1));
fs.writeFileSync(path.join(here,'audio-check.json'),JSON.stringify({durationSeconds:total,integratedLufs:stats.input_i,truePeakDb:stats.input_tp,voice:'Typecast 정의로, 임시',listeningApproval:false},null,2));
console.log(JSON.stringify({durationSeconds:total,scenes:scenes.length,captions:captions.length,lufs:stats.input_i,truePeak:stats.input_tp}));
