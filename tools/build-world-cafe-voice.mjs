// Prepare or install through the existing voice tool. This file makes no AI call.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {CAFE_VISITS} from '../experiences/synk-world-app/cafe-activity.mjs';
const require=createRequire(import.meta.url),V=require('./lib/미니게임목소리.cjs'),G=require('./lib/미니게임목소리_게임.cjs');
const root=G.REPO,out=path.join(root,'experiences/brand-opening/assets/cafe-voice'),qa=path.join(root,'experiences/synk-world-app/qa/cafe-complete-20261010');
const name='world-cafe-staff-20261010',audition=path.join(V.VENDOR,'audition',name),casting=V.loadCasting();
const lines=CAFE_VISITS.flatMap(v=>v.steps.map((s,i)=>({id:`${v.id}-${i+1}`,text:s.staff})));
const basis=await V.allJobs({games:['korean-rhythm']});
const voice=casting.roles.narrator.voice;
const request={mode:'audition',name,voices:[{id:voice.id,name:voice.name}],emotions:['normal'],lines:lines.map((l,i)=>({game:'korean-rhythm',id:basis[i].id,text:l.text}))};
fs.mkdirSync(qa,{recursive:true});
if(process.argv.includes('--prepare')){
 const jobs=lines.map((l,i)=>{const v={...basis[i].voice,voice:{id:voice.id,name:voice.name},emotion:'normal'};return {text:l.text,key:V.cacheKey(v,l.text),voice:v};});
 const pending=V.unique(jobs).filter(j=>!fs.existsSync(V.rawPath(j.voice,j.key))),meter=JSON.parse(fs.readFileSync(path.join(V.VENDOR,'meter.json'),'utf8'));
 const plan={lines:lines.length,chars:V.chars(jobs),newCharacters:V.chars(pending),cached:jobs.length-pending.length,estimatedMonthlyCredits:Math.ceil(V.chars(pending)*(meter.perChar||1)),maximumMonthlyCredits:V.chars(pending),voice:voice.name,additionalPayment:0,request};
 fs.writeFileSync(path.join(qa,'voice-plan.json'),JSON.stringify(plan,null,2)+'\n');
 console.log(JSON.stringify({...plan,request:undefined}));
}else{
 const index=JSON.parse(fs.readFileSync(path.join(audition,'index.json'),'utf8')),clips={},sources=[];
 fs.mkdirSync(out,{recursive:true});
 for(const [i,line]of lines.entries()){
  const record=index.find(r=>r.game==='korean-rhythm'&&r.id===basis[i].id&&r.text===line.text&&r.voice.id===voice.id&&r.emotion==='normal');
  if(!record||record.problems.length)throw Error('Missing or rejected staff question: '+line.id);
  const source=path.resolve(audition,record.file),relative=path.relative(audition,source);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Audio source outside audition');
  const file=line.id+'.mp3',target=path.join(out,file);
  execFileSync(G.tool('ffmpeg'),['-hide_banner','-loglevel','error','-nostdin','-y','-i',source,'-map_metadata','-1','-af',G.edgesFilter({lead:.08,tail:.22})+',loudnorm=I=-17:TP=-2:LRA=7','-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','96k',target],{windowsHide:true});
  const metrics=await G.inspect(target),probe=await G.probe(target);if(metrics.durationSeconds>15||probe.channels!==1||probe.sampleRate!==24000)throw Error('Question audio failed validation: '+line.id);
  execFileSync(G.tool('ffmpeg'),['-v','error','-xerror','-nostdin','-i',target,'-f','null','NUL'],{windowsHide:true});
  clips[line.id]={text:line.text,file,durationSeconds:metrics.durationSeconds,bytes:fs.statSync(target).size,sha256:G.sha256(fs.readFileSync(target))};
  sources.push({id:line.id,source,sourceSha256:G.sha256(fs.readFileSync(source)),...record,metrics,completeDecode:true});
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:1,approved:true,clips},null,2)+'\n');
 fs.writeFileSync(path.join(qa,'staff-voice-sources.json'),JSON.stringify({generatedAt:new Date().toISOString(),provider:'Typecast',voice:voice.name,request,clips:sources},null,2)+'\n');
 console.log(JSON.stringify({ok:true,clips:Object.keys(clips).length,bytes:Object.values(clips).reduce((n,c)=>n+c.bytes,0),out}));
}
