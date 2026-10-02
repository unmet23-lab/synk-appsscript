'use strict';
// B-series voice continuity for the remaining six films. Never edits scripts,
// films.json, existing audio, subtitles or delivered videos.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const pkg=__dirname,base=path.join(pkg,'audio'),qa=path.join(pkg,'_검토/02-나머지일관화');
const script=path.join(pkg,'원고/video.json');
const reference=path.join(pkg,'_검토/01-음성수정/studio-reference.wav');
const selected=new Set(['03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok']);
const hash=v=>crypto.createHash('sha256').update(v).digest('hex'),fileHash=p=>hash(fs.readFileSync(p));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
function put(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.'+process.pid+'.tmp';const fd=fs.openSync(tmp,'wx');try{fs.writeFileSync(fd,v);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}if(p.endsWith('.json'))JSON.parse(fs.readFileSync(tmp,'utf8'));fs.renameSync(tmp,p)}
function run(cmd,args){return new Promise((resolve,reject)=>{const child=spawn(cmd,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('close',code=>code?reject(Error(cmd+' failed: '+stderr.slice(-1500))):resolve({stdout,stderr}));})}
async function probe(p){return JSON.parse((await run('ffprobe',['-v','error','-show_entries','stream=codec_name,sample_rate,channels,bits_per_sample:format=duration','-of','json',p])).stdout)}
const direction='Use the reference only for the same original synthetic female voice identity, fresh cheerful character and clean studio quality. This is a Korean-native young adult woman with friendly conversational warmth, a lightly smiling bright voice and a rounded rich midrange. Keep gentle energy alive through sentence endings, including final 요 and 다. Questions are softly inviting; statements are confident and buoyant without a heavy falling or fading ending. Use natural connected Korean and short easy breaths. No forced high pitch, sing-song, baby voice, announcer cadence, theatrical acting, shouting or whispering. Adapt the comfortable pace to the complete supplied text; never rush or truncate it. Read Korean numerals and English brand words naturally in Korean. Record a pristine full-band dry studio voice, with full-bodied low-mid warmth, detailed smooth consonants and clean airy highs. No telephone bandwidth, metallic ringing, warble, distortion, harsh sibilance, background hiss, room echo, music, effects or extra words. Do not repeat the reference dialogue. Speak ONLY the supplied Korean text, once, exactly and completely.';
const profile={provider:'Higgsfield',model:'seed_audio',sampleRate:48000,format:'wav',synthetic:true,imitatesUser:false,reference:path.relative(pkg,reference).replaceAll('\\','/'),referenceSha256:fileHash(reference),referenceApproval:'User accepted 01 final MP4 5c2701a46c7a405ba9c7ffa31d933db922bd29b735b8dc47f77eec76b2200f31; its B-series studio voice is the continuity reference.',instruction:direction,delivery:{sampleRate:48000,channels:1,codec:'pcm_s24le',loudnessTargetLUFS:-23,truePeakLimitDb:-6,gainAppliedForVideo:false}};

async function generate(narration){
 const spec={...profile,narration},key=hash(JSON.stringify(spec)).slice(0,16),name='voice-consistent-'+key,recordPath=path.join(base,name+'.json');
 let previous=fs.existsSync(recordPath)?read(recordPath):null;
 if(previous?.status==='completed'){
  if(previous.narration!==narration||!fs.existsSync(path.join(base,previous.file))||fileHash(path.join(base,previous.file))!==previous.sha256)throw Error('Existing cached delivery is stale: '+name);
  return {...previous,cacheReused:true};
 }
 if(previous&&(!previous.jobId||previous.status==='submitting'))throw Error('Uncertain submission needs inspection before retry: '+name);
 let job;
 if(previous?.jobId){job=JSON.parse((await run('higgsfield',['generate','get',previous.jobId,'--json'])).stdout)}
 else{
  put(recordPath,JSON.stringify({...spec,status:'submitting',startedAt:new Date().toISOString()},null,2));
  console.log('Submitting '+name+' ('+narration.length+' chars)');
  const response=await run('higgsfield',['generate','create','seed_audio','--format','wav','--sample-rate','48000','--audio-references',reference,'--speech-rate','0','--pitch-rate','0','--loudness-rate','0','--prompt',direction+'\n\nKorean text to speak:\n'+narration,'--wait','--wait-timeout','10m','--json']);
  job=JSON.parse(response.stdout);
 }
 job=Array.isArray(job)?job[0]:job;
 const jobId=job.id||job.job_id;
 put(recordPath,JSON.stringify({...spec,status:'generated-awaiting-download',providerStatus:job.status,jobId,outputField:'result_url'},null,2));
 if(typeof job.result_url!=='string'||!/^https:\/\//.test(job.result_url))throw Error('No generated result_url; recorded '+name);
 const response=await fetch(job.result_url);if(!response.ok)throw Error('Generated asset download '+response.status);
 const sourceFile=name+'.source.wav',source=path.join(base,sourceFile);put(source,Buffer.from(await response.arrayBuffer()));
 const nativeProbe=await probe(source),native=nativeProbe.streams[0];
 if(Number(native.sample_rate)!==48000)throw Error('Generator did not return native-request 48kHz: '+name);
 const file=name+'.wav',wav=path.join(base,file),tmp=wav+'.'+process.pid+'.tmp';
 const normalized=await run('ffmpeg',['-y','-v','info','-i',source,'-af','loudnorm=I=-23:TP=-6:LRA=7:print_format=json','-ar','48000','-ac','1','-c:a','pcm_s24le','-f','wav',tmp]);
 await run('ffmpeg',['-v','error','-xerror','-i',tmp,'-f','null','NUL']);
 const deliveryProbe=await probe(tmp),stream=deliveryProbe.streams[0],duration=Number(deliveryProbe.format.duration);
 if(Number(stream.sample_rate)!==48000||stream.codec_name!=='pcm_s24le'||!(duration>0&&duration<90))throw Error('Unexpected delivery format/duration '+name);
 fs.renameSync(tmp,wav);
 const matches=normalized.stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/g),loudness=matches?.length?JSON.parse(matches.at(-1)):null;
 const record={status:'completed',file,narration,narrationSha256:hash(narration),duration,sha256:fileHash(wav),voice:{provider:profile.provider,model:profile.model,preset:'approved 01 B-series original female',synthetic:true,imitatesUser:false},jobId,outputField:'result_url',sourceFile,sourceSha256:fileHash(source),nativeProbe,nativeGenerationSampleRate:48000,deliveryProbe,reference:profile.reference,referenceSha256:profile.referenceSha256,referenceApproval:profile.referenceApproval,instruction:direction,loudness,loudnessTargetLUFS:-23,truePeakLimitDb:-6,gainAppliedForVideo:false,processing:'Native-request 48kHz generated download preserved; loudness normalization and 24-bit mono WAV delivery. 24-bit storage does not claim additional generated detail.',humanListening:false,fullDecode:true,asrReview:'pending',completedAt:new Date().toISOString()};
 put(recordPath,JSON.stringify(record,null,2));console.log('Ready '+name+' '+duration.toFixed(3)+'s');return record;
}

async function main(){
 const sourceSha256=fileHash(script),items=read(script).items.filter(x=>selected.has(x.id)),rows=[];
 for(const item of items)for(let scene=0;scene<item.scenes.length;scene++){const s=item.scenes[scene];if(s.narration&&s.layout!=='music')rows.push({account:item.id,scene,narration:s.narration,previousSceneDuration:s.duration})}
 if(items.length!==6)throw Error('Expected all six source accounts');
 const unique=[...new Set(rows.map(x=>x.narration))];
 const only=(process.argv.find(x=>x.startsWith('--indices='))||'').slice(10),indices=only?only.split(',').map(Number):unique.map((_,i)=>i);
 const records=new Map(),errors=[];
 const manifest=()=>({createdAt:new Date().toISOString(),sourceScript:'원고/video.json',sourceScriptSha256:sourceSha256,currentScriptSha256:fileHash(script),narrationPreserved:true,profile,requestedAccounts:items.length,requestedOccurrences:rows.length,requestedUnique:unique.length,completedUnique:records.size,errors,items:rows.filter(r=>records.has(r.narration)).map(r=>({...r,...records.get(r.narration),audioRecord:'audio/'+records.get(r.narration).file.replace('.wav','.json')}))});
 // Warm completed cache for the manifest, while generating only selected indices.
 for(const text of unique){const key=hash(JSON.stringify({...profile,narration:text})).slice(0,16),p=path.join(base,'voice-consistent-'+key+'.json');if(fs.existsSync(p)){const r=read(p);if(r.status==='completed'&&fs.existsSync(path.join(base,r.file))&&fileHash(path.join(base,r.file))===r.sha256)records.set(text,r)}}
 const save=()=>put(path.join(qa,'음성-manifest.json'),JSON.stringify(manifest(),null,2));
 let cursor=0;
 async function worker(){while(cursor<indices.length){const index=indices[cursor++],text=unique[index];if(!text)throw Error('Invalid index '+index);try{const r=await generate(text);records.set(text,r);save()}catch(e){errors.push({index,narration:text,error:e.message});save();console.error('Stopped item '+index+': '+e.message);break}}}
 await Promise.all([worker(),worker()]);save();
 console.log(JSON.stringify({manifest:path.join(qa,'음성-manifest.json'),completedUnique:records.size,requestedUnique:unique.length,errors:errors.length}));
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
