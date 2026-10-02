'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const base=__dirname,plan=JSON.parse(fs.readFileSync(path.join(base,'voice-plan.json'),'utf8'));
const speech=plan.segments.map(segment=>{
 const file=path.join(base,'audio',segment.id+'.wav'),data=JSON.parse(fs.readFileSync(file.replace(/\.wav$/,'.json'),'utf8'));
 const voice=plan.voices[segment.role];
 if(data.request.voice_id!==voice.id||data.request.text!==segment.text)throw Error('Voice source mismatch: '+segment.id);
 const probe=cp.spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file],{encoding:'utf8',windowsHide:true});
 if(probe.status!==0)throw Error(probe.stderr);
 const duration=Number(probe.stdout.trim()),words=data.words;
 if(!Number.isFinite(duration)||duration<=0||!words?.length)throw Error('Missing audio/timing: '+segment.id);
 const normalize=text=>text.replace(/[^\p{L}\p{N}]/gu,'');
 if(normalize(words.map(w=>w.text).join(' '))!==normalize(segment.text))throw Error('Word alignment text differs: '+segment.id);
 if(words.some((word,i)=>word.start<0||word.end<word.start||word.end>duration+.05||(i>0&&word.start<words[i-1].start)))throw Error('Invalid word boundaries: '+segment.id);
 return {id:segment.id,role:segment.role,text:segment.text,provider:'Typecast',voiceName:voice.name,settings:{model:data.request.model,voice_id:voice.id,output:data.request.output,prompt:data.request.prompt},direction:segment.direction,path:file,duration,words};
});
fs.writeFileSync(path.join(base,'audio/speech.json'),JSON.stringify(speech,null,2));
console.log(JSON.stringify({voices:plan.voices,lines:speech.length,speechSeconds:speech.reduce((sum,line)=>sum+line.duration,0)},null,2));
