'use strict';
// Scope-limited local verification/promotion. Existing completed versions stay preserved.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const base=__dirname,root=path.resolve(base,'../../..'),qa=path.join(base,'_검토/02-나머지일관화'),shared=path.join(root,'영상/public/firstposts20260910');
const allowed=['03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.pending',fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,Buffer.isBuffer(v)||typeof v==='string'?v:JSON.stringify(v,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,p);};
const run=(cmd,args,binary=false)=>{const r=spawnSync(cmd,args,{encoding:binary?null:'utf8',windowsHide:true,maxBuffer:96*1024**2});if(r.error||r.status)throw Error(String(r.stderr||r.error));return r.stdout;};
const probe=f=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',f]));
function context(id){const candidate=path.join(qa,'최종후보',id),inspect=path.join(candidate,'검증');return {candidate,inspect,local:path.join(qa,id),movie:path.join(candidate,'video.mp4'),proof:read(path.join(inspect,'verification.json')),input:read(path.join(inspect,'render-input.json')).item};}
function verify(id){
 const c=context(id),{proof,input,movie,inspect}=c,raw=read(path.join(base,'원고/video.json')).items.find(i=>i.id===id);
 if(!proof.fullDecode||sha(movie)!==proof.sha256||sha(path.join(inspect,'render-input.json'))!==proof.renderInputSha256)throw Error('Candidate video/input/full decode evidence mismatch');
 // Another account may finish voice assignment while this one renders. Compare
 // this account's current source rather than falsely requiring a global JSON hash.
 for(const [key,value] of Object.entries(raw)){if(key==='scenes')continue;if(JSON.stringify(input[key])!==JSON.stringify(value))throw Error('Current item changed: '+key);}
 if(input.scenes.length!==raw.scenes.length)throw Error('Current scene count differs');
 for(let i=0;i<raw.scenes.length;i++)for(const [key,value] of Object.entries(raw.scenes[i]))if(JSON.stringify(input.scenes[i][key])!==JSON.stringify(value))throw Error(`Current scene ${i+1} changed: ${key}`);
 const facts=probe(movie),v=facts.streams.find(s=>s.codec_type==='video'),a=facts.streams.find(s=>s.codec_type==='audio'),frames=input.scenes.reduce((n,s)=>n+Math.round(s.duration*30),0);
 if(v.r_frame_rate!=='30/1'||Number(v.nb_frames)!==frames||v.width!==(input.orientation==='landscape'?1920:1080)||v.height!==(input.orientation==='landscape'?1080:1920)||a.sample_rate!=='48000'||a.codec_name!=='aac')throw Error('Candidate stream contract mismatch');
 const timestamps=JSON.parse(run('ffprobe',['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',movie])).frames.map(f=>Number(f.best_effort_timestamp_time)),gridError=Math.max(...timestamps.map((n,i)=>Math.abs(n-i/30)));
 if(timestamps.length!==frames||gridError>.000002)throw Error('Frame timestamp gap or overlap');
 const state=read(proof.renderMethod.statePath),wav=path.join(path.dirname(proof.renderMethod.statePath),state.audio.file);
 if(sha(wav)!==state.audio.sha256||state.audio.composition!=='FirstPostAudio'||state.encoding.audioBitrate!=='320k')throw Error('Full-timeline audio evidence mismatch');
 for(const asset of state.assets)if(sha(path.join(shared,asset.file))!==asset.sha256)throw Error('Source asset changed '+asset.file);
 for(const source of state.sourceHashes){const p=source.file.startsWith('킷/')?path.join(root,'영상/src',source.file):path.join(root,'영상/src/firstposts20260910',source.file);if(sha(p)!==source.sha256)throw Error('Render code changed '+source.file);}
 let at=0;const timeline=input.scenes.map((s,i)=>{const f=Math.round(s.duration*30),r={scene:i+1,layout:s.layout,fromFrame:at,frames:f,title:s.title};at+=f;return r;});
 const ending=timeline.at(-1);if(ending.layout!=='ending'||ending.frames!==210||input.scenes.at(-1).audio||input.scenes.at(-1).narration)throw Error('Quiet seven-second ending missing');
 const quiet=run('ffmpeg',['-v','error','-ss',String(ending.fromFrame/30+.05),'-i',wav,'-map','0:a:0','-ar','48000','-ac','1','-c:a','pcm_f32le','-f','f32le','pipe:1'],true);let peak=0;for(let i=0;i<quiet.length;i+=4)peak=Math.max(peak,Math.abs(quiet.readFloatLE(i)));if(peak>1e-6)throw Error('Quiet ending contains unexpected audio');
 const subtitles=[];for(const language of input.brand==='LAB'?['ko','mn']:['ko']){const p=path.join(c.candidate,'subtitles-'+language+'.json'),cues=read(p);let last=0;for(const cue of cues){if(cue.startMs<last-1||cue.endMs<=cue.startMs||cue.endMs>ending.fromFrame/30*1000+1)throw Error('Subtitle overlap or spill into ending');last=cue.endMs;}subtitles.push({language,cues:cues.length,sha256:sha(p)});}
 const voices=input.scenes.filter(s=>s.audio).map(s=>{const r=read(path.join(base,'audio',s.audio.replace(/\.wav$/,'.json')));if(r.sha256!==sha(path.join(shared,s.audio))||r.narration!==s.narration||r.status!=='completed')throw Error('Voice record mismatch');return {file:s.audio,sha256:r.sha256,narration:s.narration,duration:r.duration};});
 const approved01=sha(path.join(base,'01-lab-youtube/video.mp4'));if(approved01!==read(path.join(qa,'원본보존.json')).approved01.sha256)throw Error('Approved 01 changed');
 const result={checkedAt:new Date().toISOString(),id,sha256:proof.sha256,fullDecode:true,fullDecodeEvidence:path.join(inspect,'verification.json'),renderInputSha256:proof.renderInputSha256,sourceScriptSha256AtRender:proof.sourceScriptSha256,currentItemMatches:true,frames,durationSeconds:frames/30,probe:facts,frameContinuity:{frames:timestamps.length,maximumGridErrorSeconds:gridError,continuous:true},timeline,renderCode:state.sourceHashes,audio:{composition:state.audio.composition,wavSha256:state.audio.sha256,sampleRate:48000,requestedAACBitrate:320000,playbackRate:1,mix:input.audioMix,endingPeak:peak,voices},subtitles,approved01Sha256:approved01,humanListening:false,userFinalApproval:false};
 put(path.join(c.local,'기술검증.json'),result);return result;
}
function promote(id){
 const c=context(id),technical=read(path.join(c.local,'기술검증.json')),visual=read(path.join(c.local,'시각검증.json')),backup=path.join(qa,'이전완성본',id,'video.mp4'),output=path.join(base,id,'video.mp4');
 if(!technical.fullDecode||technical.sha256!==sha(c.movie)||technical.sha256!==c.proof.sha256||!visual.completed||visual.sha256!==technical.sha256||!visual.images?.length)throw Error('Technical and actual visual evidence required');
 for(const image of visual.images)if(!image.file.startsWith(c.inspect+path.sep)||sha(image.file)!==image.sha256)throw Error('Viewed final frame changed');
 if(sha(output)!==sha(backup)&&sha(output)!==technical.sha256)throw Error('Active output differs from preserved or new candidate');
 const stage=path.join(c.local,'납품메타데이터'),files=[],add=(name,data,dest)=>{const p=path.join(stage,name);put(p,data);files.push({file:p,dest,sha256:sha(p)});};
 for(const name of fs.readdirSync(c.candidate).filter(n=>/^(subtitles-|자막|챕터)/.test(n)))add(name,fs.readFileSync(path.join(c.candidate,name)),path.join(base,id,name));
 const productionQa=path.join(base,'_검토/video',id),proof={...c.proof,video:id+'/video.mp4',visualReview:visual.summary,visualReviewEvidence:path.relative(base,path.join(c.local,'시각검증.json')).replaceAll('\\','/'),audioStatus:'native 48kHz synthesized voice using the approved B style reference, gain 0.7 and original playback speed; final user listening approval not recorded',humanListening:false};
 add('render-input.json',fs.readFileSync(path.join(c.inspect,'render-input.json')),path.join(productionQa,'render-input.json'));add('verification.json',proof,path.join(productionQa,'verification.json'));add('final-all.png',fs.readFileSync(path.join(c.inspect,'final-all.png')),path.join(productionQa,'final-all.png'));
 add('최종검증.json',{...technical,status:'completed local revision',visualReview:visual,previousSha256:sha(backup),backup,candidatePreserved:true},path.join(c.local,'최종검증.json'));
 const manifest={id,sourceSha256:technical.sha256,previousSha256:sha(backup),files,status:'prepared'};put(path.join(c.local,'납품교체.json'),manifest);
 if(sha(output)!==technical.sha256){const temp=output+'.candidate-pending';fs.copyFileSync(c.movie,temp);if(sha(temp)!==technical.sha256)throw Error('Candidate copy differs');fs.renameSync(temp,output);}
 // On a later metadata error, re-run accepts the same verified new video and
 // resumes the prepared small-file copies. The old video and candidate survive.
 for(const file of files){if(sha(file.file)!==file.sha256)throw Error('Prepared metadata changed');put(file.dest,fs.readFileSync(file.file));}
 put(path.join(c.local,'납품교체.json'),{...manifest,status:'committed',completedAt:new Date().toISOString()});return {id,sha256:sha(output),video:output,verification:path.join(c.local,'최종검증.json')};
}
const selected=(process.argv.find(a=>a.startsWith('--id='))||'').slice(5).split(',');
if(selected.some(id=>!allowed.includes(id)))throw Error('Use only explicit remaining-six IDs');
for(const id of selected)console.log(JSON.stringify(process.argv.includes('--promote')?promote(id):verify(id),null,2));
