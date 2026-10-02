'use strict';
// 생성 원고만 일반 프리셋으로 읽는다. 사람의 목소리·학생 기록을 입력하지 않는다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),pub=path.join(root,'영상/public/firstposts20260910'),base=path.join(__dirname,'audio');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.tmp';fs.writeFileSync(tmp,v);fs.renameSync(tmp,p)};
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});if(r.error||r.status)throw Error(`${cmd} ${args[0]}: ${(r.stderr||r.error||'').toString().slice(-1200)}`);return r.stdout}
const voice={provider:'Higgsfield',model:'qwen_audio_tts',preset:'Kevin',voiceId:'f1373f24-3b96-433f-9a68-e595810ef608',synthetic:true,imitatesUser:false};
const instruction='자연스럽고 또렷한 한국어로 읽습니다. 따뜻하고 자신감 있는 안내이며 과장된 광고 말투는 피합니다. 문장 사이에 짧은 호흡을 둡니다. 원고에 없는 말을 추가하거나 배경음·음악을 만들지 않습니다.';
function urls(v,key=''){if(typeof v==='string')return /^https:\/\//.test(v)?[{url:v,key}]:[];if(!v||typeof v!=='object')return [];return Object.entries(v).flatMap(([k,x])=>urls(x,key+'.'+k))}
async function generate(text){
 const digest=sha(text),name='voice-'+digest.slice(0,16),recordPath=path.join(base,name+'.json'),wav=path.join(base,name+'.wav');
 if(fs.existsSync(recordPath)){const r=read(recordPath);if(r.status==='completed'&&fs.existsSync(wav)&&r.sha256===sha(fs.readFileSync(wav))){fs.copyFileSync(wav,path.join(pub,name+'.wav'));return r}}
 const previous=fs.existsSync(recordPath)?read(recordPath):null;
 const response=JSON.parse(previous?.jobId?run('higgsfield',['generate','get',previous.jobId,'--json']):run('higgsfield',['generate','create','qwen_audio_tts','--prompt',text,'--voice-id',voice.voiceId,'--voice-type','preset','--language','ko','--format','wav','--sample-rate','24000','--instruction',instruction,'--wait','--wait-timeout','10m','--json']));
 const job=Array.isArray(response)?response[0]:response;const id=job.id||job.job_id;
 put(recordPath,JSON.stringify({status:job.status,jobId:id,narration:text,narrationSha256:digest,voice},null,2));
 const candidates=urls(job).filter(x=>/\.(wav|mp3)(\?|$)/i.test(x.url));if(!candidates.length)throw Error('No generated audio in completed job '+id);
 const picked=candidates.find(x=>/\.wav(\?|$)/i.test(x.url))||candidates[0];
 const result=await fetch(picked.url);if(!result.ok)throw Error('Generated audio download '+result.status);
 const source=path.join(base,name+'.source.wav');put(source,Buffer.from(await result.arrayBuffer()));
 run('ffmpeg',['-y','-v','error','-i',source,'-c:a','pcm_s16le',wav]);
 const duration=Number(JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',wav])).format.duration);
 if(!(duration>0&&duration<150))throw Error('Unexpected narration duration '+duration);
 run('ffmpeg',['-v','error','-xerror','-i',wav,'-f','null','NUL']);fs.copyFileSync(wav,path.join(pub,name+'.wav'));
 const record={status:'completed',jobId:id,narration:text,narrationSha256:digest,voice,file:name+'.wav',duration,sha256:sha(fs.readFileSync(wav)),humanListening:false,fullDecode:true};put(recordPath,JSON.stringify(record,null,2));return record;
}
async function sceneVoice(scene){
 if(!scene.audioRecord)return generate(scene.narration);
 const record=read(path.resolve(__dirname,scene.audioRecord)),source=path.join(base,record.file);
 if(record.status!=='completed'||record.narration!==scene.narration||!fs.existsSync(source)||sha(fs.readFileSync(source))!==record.sha256)throw Error('Pinned revised voice is missing or stale: '+scene.audioRecord);
 fs.copyFileSync(source,path.join(pub,record.file));return record;
}
async function main(){
 fs.mkdirSync(pub,{recursive:true});
 const src=read(path.join(__dirname,'원고/video.json')),items=Array.isArray(src)?src:src.items;const records=[];
 const selected=process.argv.includes('--id')?process.argv[process.argv.indexOf('--id')+1]:null;
 for(const item of items){if(selected&&item.id!==selected)continue;for(let i=0;i<item.scenes.length;i++){const s=item.scenes[i];if(!s.narration||s.layout==='music')continue;const r=await sceneVoice(s);s.audio=r.file;s.duration=Math.ceil(Math.max(s.duration,r.duration+.95)*30)/30;records.push({account:item.id,scene:i,...r});console.log(item.id+' '+(i+1)+' voice ready '+r.duration.toFixed(2)+'s')}}
 // 선택 렌더는 다른 계정의 완료한 음성을 보존한다.
 const out=path.join(pub,'films.json');const previous=fs.existsSync(out)?read(out):[];
 const merged=items.map(x=>selected&&x.id!==selected?(previous.find(p=>p.id===x.id)||x):x);
 put(out,JSON.stringify(merged,null,2));
 put(path.join(__dirname,'_검토/음성명세'+(selected?'-'+selected:'')+'.json'),JSON.stringify({voice,items:records},null,2));
 console.log(JSON.stringify({accounts:merged.length,generatedOrReused:records.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
