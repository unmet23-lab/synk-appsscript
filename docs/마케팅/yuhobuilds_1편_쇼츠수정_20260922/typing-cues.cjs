'use strict';
const fs=require('fs'),path=require('path');
exports.cues=function(words,lead,fps){
 const target=['학원','출석','앱을','만들고','싶어.'];
 const start=words.findIndex(w=>w.text===target[0]);
 const selected=words.slice(start,start+target.length);
 if(start<0||selected.some((w,i)=>w.text!==target[i]))throw Error('Missing spoken typing example');
 let count=0;const keys=[];
 for(const [i,w] of selected.entries()){
  if(i)count++;
  for(let j=0;j<w.text.length;j++){
   const time=lead+w.start+(w.end-w.start)*j/Math.max(1,w.text.length-1);
   keys.push({frame:Math.round(time*fps),count:++count,char:w.text[j]});
  }
 }
 return {text:target.join(' '),startFrame:keys[0].frame,endFrame:keys.at(-1).frame,keys};
};
exports.audio=function(scenes,total,fps,dir){
 const rate=48000,pcm=new Float32Array(Math.ceil(total*rate));let seed=922;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 const prompt=scenes.find(s=>s.visual==='prompt');const events=[];
 for(const [index,key] of prompt.typing.keys.entries()){
  const time=(prompt.start+key.frame)/fps,begin=Math.round(time*rate),duration=.044;
  const pitch=170+(index%5)*21,weight=index===prompt.typing.keys.length-1?.9:1+(index%3-1)*.09;
  let previous=0;
  for(let n=0;n<duration*rate;n++){
   const t=n/rate,noise=random(),high=noise-previous*.82;previous=noise;
   const attack=Math.min(1,t/.0007),clack=high*Math.exp(-t*430)*.075;
   const body=Math.sin(2*Math.PI*pitch*t)*Math.exp(-t*115)*.042;
   const release=t>.016?high*Math.exp(-(t-.016)*520)*.027:0;
   if(begin+n<pcm.length)pcm[begin+n]+=(clack+body+release)*attack*weight;
  }
  events.push({timeSeconds:time,frame:prompt.start+key.frame,char:key.char});
 }
 const wav=Buffer.alloc(44+pcm.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length*2,40);
 let peak=0;for(let i=0;i<pcm.length;i++){peak=Math.max(peak,Math.abs(pcm[i]));wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),44+i*2);}
 const file=path.join(dir,'keyboard-sfx.wav');fs.writeFileSync(file,wav);
 return {file,events,peakDbfs:20*Math.log10(peak),source:'Original procedural key press and release sounds; no external sample',voiceAligned:true};
};
