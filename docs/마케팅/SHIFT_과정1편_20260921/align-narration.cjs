'use strict';
// Align only the audio returned with these Typecast timestamps; no forced estimates.
const fs=require('node:fs'),path=require('node:path');
const here=__dirname,repo=path.resolve(here,'../../..');
const source=path.join(here,'audio/narration-hana.json');
const data=JSON.parse(fs.readFileSync(source,'utf8'));
const words=data.words, fps=30,lead=.3,tail=.8;
const sentences=[];let current=[];
for(const word of words){current.push(word);if(/[.!?]$/.test(word.text)){sentences.push(current);current=[];}}
if(current.length)sentences.push(current);
if(sentences.length!==7)throw Error('Expected seven complete sentences');
const total=Math.ceil((data.audio_duration+lead+tail)*fps);
const starts=sentences.map((s,i)=>i?Math.floor((s[0].start+lead-.08)*fps):0);
const timing={fps,durationInFrames:total,audioFile:'shift-process-20260921/narration.wav',audioStartFrame:Math.round(lead*fps),status:'typecast-narrated-review',scenes:sentences.map((s,i)=>({id:String(i+1).padStart(2,'0'),start:starts[i],duration:(starts[i+1]??total)-starts[i],text:s.map(w=>w.text).join(' ')}))};
const captions=[];
const phraseEnds=[[3,7],[4,8],[4,7],[5,7],[4,8],[5,11],[4,7,9]];
for(const [sentenceIndex,s] of sentences.entries()){
  let from=0;
  for(const to of phraseEnds[sentenceIndex]){
    const group=s.slice(from,to),next=s[to],text=group.map(w=>w.text).join(' ');
    if(!group.length)throw Error('Empty caption phrase');
    captions.push({text:text.replace(/비핸스/g,'Behance'),startMs:Math.round((group[0].start+lead)*1000),endMs:Math.round((group.at(-1).end+lead+Math.min(.12,next?Math.max(0,next.start-group.at(-1).end):.12))*1000),timestampMs:null,confidence:null});from=to;
  }
  if(from!==s.length)throw Error('Caption coverage mismatch');
}
const write=(p,v)=>fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
write(path.join(here,'장면타이밍_내레이션.json'),timing);
write(path.join(here,'captions.json'),captions);
const fmt=ms=>new Date(ms).toISOString().slice(11,23).replace('.',',');
write(path.join(here,'captions.srt'),captions.map((c,i)=>`${i+1}\n${fmt(c.startMs)} --> ${fmt(c.endMs)}\n${c.text}\n`).join('\n'));
const pub=path.join(repo,'영상/public/shift-process-20260921');fs.mkdirSync(pub,{recursive:true});
const mastered=path.join(here,'audio/narration-master.wav');
fs.copyFileSync(fs.existsSync(mastered)?mastered:path.join(here,'audio/narration-hana.wav'),path.join(pub,'narration.wav'));
write(path.join(repo,'영상/src/shiftProcess20260921/captions.json'),captions);
write(path.join(repo,'영상/src/shiftProcess20260921/timing.json'),timing);
console.log(JSON.stringify({duration:total/fps,scenes:timing.scenes.map(s=>({id:s.id,start:s.start/fps,duration:s.duration/fps})),captions:captions.length}));
