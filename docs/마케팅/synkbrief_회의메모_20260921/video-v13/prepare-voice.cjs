'use strict';
// Retain generated speech and give each scene enough time without speeding up the voice.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=__dirname,script=JSON.parse(fs.readFileSync(path.join(root,'narration-script.json'),'utf8'));
const original=JSON.parse(fs.readFileSync(path.join(root,'../video-v11/content.json'),'utf8'));
const run=args=>{const r=spawnSync('ffmpeg',args,{encoding:'utf8',windowsHide:true,maxBuffer:4e6});if(r.status)throw Error(r.stderr);};
const markers=JSON.parse(fs.readFileSync(path.join(root,'action-markers.json'),'utf8'));
const fmt=t=>new Date(Math.round(t*1000)).toISOString().slice(11,23).replace('.',',');
let start=0;const clips=[],captions=[],concat=[];
for(const s of original){
 if(s.camera)Object.assign(s.camera,markers[s.id]);
 const line=script.segments.find(x=>x.id===s.id),file=path.join(root,'audio',s.id+'.wav');
 const data=JSON.parse(fs.readFileSync(file.replace('.wav','.json'),'utf8'));
 if(data.request.text!==line.text||data.request.voice_id!==script.voice.id)throw Error('Voice source mismatch '+s.id);
 if(!data.words?.length||data.audio_duration<=0)throw Error('Missing alignment '+s.id);
 const lead=.22,tail=.3;s.duration=Math.ceil(Math.max(s.duration,lead+data.audio_duration+tail)*30)/30;
 const target=path.join(root,'audio','block-'+s.id+'.wav');
 run(['-y','-v','error','-i',file,'-af',`aresample=48000,adelay=220:all=1,apad,atrim=duration=${s.duration}`,'-ar','48000','-ac','2','-c:a','pcm_s16le',target]);
 concat.push(`file 'block-${s.id}.wav'`);clips.push({id:s.id,start,duration:s.duration,voiceStart:start+lead,voiceDuration:data.audio_duration});
 let group=[];const flush=()=>{if(!group.length)return;captions.push({text:group.map(w=>w.text).join(' ').replaceAll('에이아이','AI').replaceAll('챗지피티','ChatGPT').replaceAll('피디에프','PDF').replaceAll('싱크','synk'),start:start+lead+group[0].start,end:Math.min(start+s.duration-.12,start+lead+group.at(-1).end+.12)});group=[];};
 for(const w of data.words){if(group.length&&([...group,w].map(x=>x.text).join(' ').length>32||w.end-group[0].start>4))flush();group.push(w);if(/[.!?]$/.test(w.text))flush();}flush();start+=s.duration;
}
fs.writeFileSync(path.join(root,'audio/blocks.txt'),concat.join('\n')+'\n');
run(['-y','-v','error','-f','concat','-safe','0','-i',path.join(root,'audio/blocks.txt'),'-c:a','pcm_s16le',path.join(root,'audio/narration.wav')]);
fs.writeFileSync(path.join(root,'content.json'),JSON.stringify(original,null,2)+'\n');
fs.writeFileSync(path.join(root,'voice-timing.json'),JSON.stringify({duration:start,voice:script.voice,clips,captions},null,2));
fs.writeFileSync(path.join(root,'narration.srt'),captions.map((c,i)=>`${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n'));
console.log(JSON.stringify({duration:start,segments:clips.length,captions:captions.length,voice:script.voice.name}));
