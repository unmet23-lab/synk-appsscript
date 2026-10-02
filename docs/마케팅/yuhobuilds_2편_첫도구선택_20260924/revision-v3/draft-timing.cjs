'use strict';
// Temporary timing for visual layout review only. Never use for a final narration render.
const fs=require('node:fs'),path=require('node:path');
const script=require('./narration-script.json');let frame=0;const scenes=[],words=[],captions=[];
for(const s of script.segments){
 const cache=path.join(__dirname,'audio','narration-'+s.id+'.json');let data;
 if(fs.existsSync(cache))data=JSON.parse(fs.readFileSync(cache,'utf8'));
 else{let t=.07;const ww=s.text.split(/\s+/).map(text=>{const start=t;t+=Math.max(.1,text.length*.073);return{text,start,end:t};});data={words:ww,audio_duration:t+.1};}
 const start=frame/30,lead=.1,durationFrames=Math.ceil((lead+data.audio_duration+.13)*30);
 scenes.push({id:s.id,startSeconds:start,durationSeconds:durationFrames/30,startFrame:frame,durationFrames,text:s.text});
 const ws=data.words.map(w=>({...w,start:w.start+start+lead,end:w.end+start+lead,segment:s.id}));words.push(...ws);
 let group=[];for(const w of ws){if(group.length&&[...group,w].map(x=>x.text).join(' ').length>19){captions.push({start:group[0].start,end:group.at(-1).end,text:group.map(x=>x.text).join(' ')});group=[];}group.push(w);}if(group.length)captions.push({start:group[0].start,end:group.at(-1).end,text:group.map(x=>x.text).join(' ')});
 frame+=durationFrames;
}
fs.writeFileSync(path.join(__dirname,'timeline-draft.json'),JSON.stringify({draft:true,durationSeconds:frame/30,fps:30,scenes,words,captions},null,2));
const fmt=t=>new Date(Math.round(t*1000)).toISOString().slice(11,23).replace('.',',');
fs.writeFileSync(path.join(__dirname,'captions-draft.srt'),captions.map((c,i)=>`${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n'));
