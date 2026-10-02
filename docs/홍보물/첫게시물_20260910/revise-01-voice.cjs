'use strict';
// 2026-09-10: 01 음성 수정. 기존 Kevin 캐시와 분리하며 목소리/모델/원고를 모두 지문에 포함한다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const base=path.join(__dirname,'_검토/01-음성수정');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function put(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.'+process.pid+'.tmp',fd=fs.openSync(tmp,'wx');try{fs.writeFileSync(fd,v);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(tmp,p)}
function run(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code?reject(Error(cmd+' failed: '+err.slice(-1600))):resolve(out))})}
function urls(v){if(typeof v==='string')return /^https:\/\//.test(v)&&/\.(wav|mp3)(\?|$)/i.test(v)?[v]:[];if(!v||typeof v!=='object')return [];return Object.values(v).flatMap(urls)}
async function generate(voice,text,label,profile={}){
 const spec={provider:'Higgsfield',model:profile.model||'inworld_text_to_speech',voice,text,synthetic:true,...profile};
 const key=hash(JSON.stringify(spec)).slice(0,16),recordFile=path.join(base,label+'-'+key+'.json');
 const previous=fs.existsSync(recordFile)?JSON.parse(fs.readFileSync(recordFile)):null;
 if(previous?.status==='completed'&&previous.outputField==='result_url'&&fs.existsSync(path.join(base,previous.file))&&hash(fs.readFileSync(path.join(base,previous.file)))===previous.sha256)return previous;
 if(previous&&!previous.jobId)throw Error('Inspect existing incomplete job before retrying '+recordFile);
 const params=spec.model==='qwen_audio_tts'?['--voice-id',spec.voiceId,'--voice-type','preset','--language','ko','--format','wav','--sample-rate',String(spec.sampleRate||24000),'--instruction',spec.instruction,'--speech-rate','1.03','--prompt',text]:spec.model==='seed_audio'?['--format','wav','--sample-rate',String(spec.sampleRate||24000),...(spec.referenceFile?['--audio-references',path.join(base,spec.referenceFile)]:[]),'--prompt',spec.instruction+'\n\nSpeak only this exact Korean dialogue, with a short breath between sentences:\n'+text]:['--voice',voice,'--prompt',text];
 const result=JSON.parse(await run('higgsfield',previous?['generate','get',previous.jobId,'--json']:['generate','create',spec.model,...params,'--wait','--wait-timeout','10m','--json']));
 const job=Array.isArray(result)?result[0]:result;
 put(recordFile,JSON.stringify({...spec,status:job.status,jobId:job.id||job.job_id},null,2));
 const media=job.result_url;if(typeof media!=='string'||!/^https:\/\//.test(media))throw Error('No generated result_url returned; job recorded');
 const response=await fetch(media);if(!response.ok)throw Error('Audio download failed '+response.status);
 const raw=label+'-'+key+'.source',file=label+'-'+key+'.wav';put(path.join(base,raw),Buffer.from(await response.arrayBuffer()));
 await run('ffmpeg',['-y','-v','error','-i',path.join(base,raw),'-ar','48000','-ac','1','-c:a','pcm_s16le',path.join(base,file)]);
 await run('ffmpeg',['-v','error','-xerror','-i',path.join(base,file),'-f','null','NUL']);
 const probe=JSON.parse(await run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',path.join(base,file)]));
 const record={...spec,status:'completed',jobId:job.id||job.job_id,outputField:'result_url',file,duration:Number(probe.format.duration),sha256:hash(fs.readFileSync(path.join(base,file))),humanListening:false,fullDecode:true};
 put(recordFile,JSON.stringify(record,null,2));console.log(JSON.stringify({label,file,duration:record.duration}));return record;
}
async function main(){
 const arg=process.argv[2];if(!['Minji','Yoona','Bright','Fresh','FreshFinal','FreshPolish'].includes(arg))throw Error('Use Minji, Yoona, Bright, Fresh, FreshFinal or FreshPolish');
 const voice=arg==='Bright'?'Hana':arg==='Fresh'?'Designed original cheerful female':arg+' (ko)',label=arg.toLowerCase();
 const profile=arg==='FreshPolish'?{model:'seed_audio',referenceFile:'fresh-sample-ef72fbe587ace1c2.wav',referenceSha256:hash(fs.readFileSync(path.join(base,'fresh-sample-ef72fbe587ace1c2.wav'))),instruction:'같은 여성 목소리와 상큼한 음색을 유지해 다시 말하세요. 친구에게 좋아하는 노래를 권하듯 자연스럽고 밝은 한국어 대화입니다. 요에서 축 처지지 않고 끝까지 미소와 가벼운 생기를 유지합니다. 첫 두 질문은 살짝 올라가고, 마지막 응답은 따뜻하고 경쾌하게 이어집니다. 좋아요, 같이 들어요는 중간에 긴 정적 없이 한 호흡으로 말합니다. 전체 약 6초, 문장 사이 짧은 쉼. 사람다운 자연스러운 억양, 과장과 노래하는 억양 없이. 반주·효과음·추가 발화 없음.'}:arg==='FreshFinal'?{model:'seed_audio',referenceFile:'fresh-sample-ef72fbe587ace1c2.wav',referenceSha256:hash(fs.readFileSync(path.join(base,'fresh-sample-ef72fbe587ace1c2.wav'))),instruction:'Use the reference audio as the same original female speaker and fresh cheerful voice color. Refine only her delivery for the most natural Korean conversation. She is a Korean-native young adult woman smiling softly as she invites a friend to listen to a favorite song. Maintain light, fresh energy all the way through each final 요 syllable. Do not let the pitch, breath or vocal energy sag, fade or become creaky at sentence endings. Questions have a gentle inviting upward contour; the affirmative response remains buoyant and warm, ending in a soft light continuation, not a heavy downstep. Do not force every ending into a high question or sing-song pattern. Connect words fluently with easy conversational rhythm and natural short pauses, including a brief easy pause after 좋아요. Preserve the friendly reference timbre and comfortable natural pace. Clean dry voice only. No music, sound effects, laughter, announcer exaggeration, baby voice, shouting, whispering or added words. 한국어의 요를 끝까지 가볍고 상큼하게 유지하세요. 친구에게 다정하게 권하는 자연스러운 말투입니다.'}:arg==='Bright'?{model:'qwen_audio_tts',voiceId:'c25f78a0-714e-42af-8da3-a399cef94968',instruction:'한국어 원어민 성인 여성. 친구에게 노래를 권하듯 밝고 명랑하고 상큼하게, 미소 띤 자연스러운 대화체. 가벼운 질문 억양, 부드러운 응답. 음절을 끊지 말고 고음 과장·아나운서·아이 말투·음악·추가 발화 금지.'}:arg==='Fresh'?{model:'seed_audio',instruction:'A clean dry studio voice recording, one original Korean-native young adult female speaker. Fresh, sunny, lightly smiling and cheerful, like a friend warmly offering a favorite song. Clear naturally connected Korean, conversational rhythm and lively but gentle question inflections. Light and bright vocal color with natural warmth. Normal comfortable pace. No announcer cadence, no exaggerated high pitch, no child voice, no whisper, no shouting, no laughter, no other voices, no ambience, no sound effects, no music. Keep each sentence complete and accurate.'}:{};
 if(process.argv.includes('--lines')){
  const texts=['같이 들을까요?','이 노래는 어때요?','좋아요. 같이 들어요.'];
  const records=[];for(let i=0;i<texts.length;i++)records.push(await generate(voice,texts[i],label+'-line-'+(i+1),profile));
  put(path.join(base,label+'-lines.json'),JSON.stringify(records,null,2));
 }else{
  const r=await generate(voice,profile.model?'같이 들을까요? 이 노래는 어때요? 좋아요. 같이 들어요.':'같이 갈까요? 좋아요. 같이 가요. 내일은 어때요? 토요일은 어때요?',label+'-sample',profile);
  // 비교본은 같은 음량 목표로 처리한다. 이 수치는 자연스러움의 판정이 아니다.
  const mp3=path.join(base,label+'-sample.mp3');
  await run('ffmpeg',['-y','-v','error','-i',path.join(base,r.file),'-af','loudnorm=I=-23:TP=-6:LRA=7','-c:a','libmp3lame','-b:a','192k',mp3]);
  console.log(JSON.stringify({sample:mp3}));
 }
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={base,hash,put,run,generate};
