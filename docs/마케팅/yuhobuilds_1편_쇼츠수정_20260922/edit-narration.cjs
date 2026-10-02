'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const edits=require('./audio-edits.json');
module.exports=function editNarration(id,source,data){
 const edit=edits[id];if(!edit)return {source,data};
 const cuts=edit.removeSilence;
 for(const [a,b] of cuts){if(a<0||b<=a||b>data.audio_duration||data.words.some(w=>a<w.end&&b>w.start))throw Error('Edit intersects aligned speech: '+id);}
 const map=t=>(t-cuts.reduce((sum,[a,b])=>sum+Math.max(0,Math.min(t,b)-a),0))/edit.tempo;
 const spans=[];let start=0;for(const [a,b] of cuts){spans.push([start,a]);start=b;}spans.push([start,data.audio_duration]);
 const filters=spans.map(([a,b],i)=>`[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS${i?',afade=t=in:d=0.004':''}${i<spans.length-1?`,afade=t=out:st=${b-a-.004}:d=0.004`:''}[p${i}]`);
 const duration=map(data.audio_duration);
 filters.push(spans.map((_,i)=>`[p${i}]`).join('')+`concat=n=${spans.length}:v=0:a=1,atempo=${edit.tempo},apad,atrim=duration=${duration}[edited]`);
 const target=path.join(__dirname,'audio/edited','narration-'+id+'.wav');fs.mkdirSync(path.dirname(target),{recursive:true});
 const r=spawnSync('ffmpeg',['-y','-v','error','-i',source,'-filter_complex',filters.join(';'),'-map','[edited]','-ar','44100','-ac','1','-c:a','pcm_s16le',target],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr);
 const adjusted={...data,audio_duration:duration,words:data.words.map(w=>({...w,start:map(w.start),end:map(w.end)})),postProductionEdit:{...edit,source,originalDuration:data.audio_duration}};
 fs.writeFileSync(target.replace('.wav','.json'),JSON.stringify(adjusted,null,2));
 return {source:target,data:adjusted};
};
