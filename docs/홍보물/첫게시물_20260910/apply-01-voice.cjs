'use strict';
const fs=require('node:fs'),path=require('node:path');
const {base,put,hash,run}=require('./revise-01-voice.cjs');
const repo=path.resolve(__dirname,'../../..'),pub=path.join(repo,'영상/public/firstposts20260910');
async function main(){
 const studio=process.argv.includes('--studio');
 const file=studio?'studio-reference-332d03b4930f8c73.wav':'freshpolish-sample-9fc9b026c31d75f0.wav',source=JSON.parse(fs.readFileSync(path.join(base,file.replace('.wav','.json')))),asr=JSON.parse(fs.readFileSync(path.join(base,file.replace('.wav','-asr.json'))));
 if(source.sha256!==hash(fs.readFileSync(path.join(base,file)))||asr.sha256!==source.sha256)throw Error('Voice source or transcript stale');
 const normalized=path.join(base,studio?'studio-normalized.wav':'freshpolish-normalized.wav');
 await run('ffmpeg',['-y','-v','error','-i',path.join(base,file),'-af','loudnorm=I=-23:TP=-6:LRA=7','-ar','48000','-ac','1','-c:a','pcm_s16le',normalized]);
 const ranges=studio?[[0,1.18],[1.18,3.28],[3.45,6.0]]:[[0,1.10],[1.10,3.17],[3.30,6.0]],texts=['같이 들을까요?','이 노래는 어때요?','좋아요. 같이 들어요.'];
 const records=[];
 for(let i=0;i<texts.length;i++){
  const range=ranges[i],key=hash(JSON.stringify({sha256:source.sha256,range,filter:'loudnorm=I=-23:TP=-6:LRA=7'})).slice(0,16),name=(studio?'voice-01-studio-':'voice-01-fresh-')+key,output=path.join(__dirname,'audio',name+'.wav');
  await run('ffmpeg',['-y','-v','error','-i',normalized,'-af',`atrim=start=${range[0]}:end=${range[1]},asetpts=PTS-STARTPTS`,'-ar','48000','-ac','1','-c:a','pcm_s16le',output]);
  await run('ffmpeg',['-v','error','-xerror','-i',output,'-f','null','NUL']);
  const record={status:'completed',file:name+'.wav',narration:texts[i],duration:range[1]-range[0],sha256:hash(fs.readFileSync(output)),voice:{provider:'Higgsfield',model:'seed_audio',preset:'original female based on user-selected B',synthetic:true,imitatesUser:false},jobId:source.jobId,sourceFile:file,sourceSha256:source.sha256,sourceRangeSeconds:range,nativeGenerationSampleRate:studio?48000:24000,loudnessTargetLUFS:-23,truePeakLimitDb:-6,styleReferenceUserSelected:true,refinedAudioUserApproved:false,humanListening:false,fullDecode:true};
  put(path.join(__dirname,'audio',name+'.json'),JSON.stringify(record,null,2));put(path.join(pub,name+'.wav'),fs.readFileSync(output));records.push(record);
  const words=asr.segments.flatMap(s=>s.words).filter(w=>w.end>range[0]&&w.start<range[1]).map(w=>({...w,start:Math.max(0,w.start-range[0]),end:Math.min(record.duration,w.end-range[0])}));
  const actual=words.map(w=>w.word).join('').trim();
  put(path.join(__dirname,'_검토/음성대조',name+'.json'),JSON.stringify({file:record.file,sha256:record.sha256,actual,duration:record.duration,segments:[{start:0,end:record.duration,text:actual,words}],sourceASRFile:file.replace('.wav','-asr.json'),sourceASRSha256:asr.sha256,sourceRangeSeconds:range,offline:true,expectedUsedAsPrompt:false,humanListening:false},null,2));
 }
 const rawPath=path.join(__dirname,'원고/video.json'),rawBytes=fs.readFileSync(rawPath),raw=JSON.parse(rawBytes),item=raw.items.find(x=>x.id==='01-lab-youtube');
 let n=0;for(const scene of item.scenes){if(!scene.narration)continue;const r=records[n++];if(r.narration!==scene.narration)throw Error('Narration order mismatch');scene.audio=r.file;scene.audioRecord='audio/'+r.file.replace('.wav','.json');}
 const filmsPath=path.join(pub,'films.json'),filmsBytes=fs.readFileSync(filmsPath),films=JSON.parse(filmsBytes),backup=path.join(base,'before-films.json');if(!fs.existsSync(backup))put(backup,filmsBytes);
 const beforeOther=hash(JSON.stringify(films.filter(x=>x.id!==item.id))),next=films.map(x=>x.id===item.id?item:x);
 if(beforeOther!==hash(JSON.stringify(next.filter(x=>x.id!==item.id))))throw Error('Untouched films changed');
 if(!fs.readFileSync(rawPath).equals(rawBytes)||!fs.readFileSync(filmsPath).equals(filmsBytes))throw Error('Concurrent source modification');
 put(rawPath,JSON.stringify(raw,null,2));put(filmsPath,JSON.stringify(next,null,2));
 const applied=path.join(base,'applied-voice.json');if(studio&&fs.existsSync(applied)&&!fs.existsSync(path.join(base,'before-studio-applied-voice.json')))put(path.join(base,'before-studio-applied-voice.json'),fs.readFileSync(applied));
 put(applied,JSON.stringify({createdAt:new Date().toISOString(),account:item.id,source,records,otherFilmsContentSha256:beforeOther,otherFilmsUnchanged:true,rawScriptSha256:hash(fs.readFileSync(rawPath)),humanContinuousListening:false,userFeedback:studio?'B 계열 밝은 톤은 마음에 듦. 목소리 자체를 풍부하고 선명한 스튜디오 같은 음질로 요청':'B가 훨씬 좋은데 어미에서 상큼한 에너지가 떨어지지 않도록 요청'},null,2));
 console.log(JSON.stringify({applied:item.id,voices:records.length,otherFilmsUnchanged:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
