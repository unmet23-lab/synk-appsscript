'use strict';
// Isolated Remotion entry/public assets. Never invokes prepare.cjs or generates voices.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),video=path.join(root,'영상'),qa=path.join(__dirname,'_검토/video');
const shared=path.join(video,'public/firstposts20260910'),ownPublic=path.join(qa,'public'),ownMedia=path.join(ownPublic,'firstposts20260910');
const {bundle}=require(path.join(video,'node_modules/@remotion/bundler'));
const {selectComposition,renderStill,renderMedia,openBrowser}=require(path.join(video,'node_modules/@remotion/renderer'));
const renderChunked=require('./render-chunked.cjs');
const sharp=require('sharp'),browserExecutable='C:/Program Files/Google/Chrome/Application/chrome.exe';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const temp=p+'.pending',fd=fs.openSync(temp,'w');try{fs.writeFileSync(fd,v);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,p);};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});if(r.error||r.status!==0)throw Error(`${cmd}: ${r.stderr||r.error}`);return r.stdout};
const probe=p=>JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',p]));
const fps=30,frameCount=s=>Math.round(s.duration*fps);let puppeteerInstance;
const clock=(ms,sep=',')=>{const n=Math.max(0,Math.round(ms));return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}${sep}${String(n%1000).padStart(3,'0')}`};
const cue=(text,startMs,endMs)=>({text:text.trim(),startMs,endMs,timestampMs:null,confidence:null});
const wrap=(text,max)=>{const lines=[];let line='';for(const word of text.trim().split(/\s+/)){if(line&&(line+' '+word).length>max){lines.push(line);line=word}else line+=(line?' ':'')+word}if(line)lines.push(line);return lines.join('\n')};
// Edited source determines public spelling; ASR only contributes measured boundaries.
function alignWords(text,words,duration){
 const expected=text.trim().split(/\s+/),clean=s=>s.replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 const distance=(a,b)=>{a=clean(a);b=clean(b);const r=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i?j?0:i:j));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)r[i][j]=Math.min(r[i-1][j]+1,r[i][j-1]+1,r[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return r[a.length][b.length]/Math.max(1,a.length,b.length)};
 const dp=Array.from({length:expected.length+1},()=>Array(words.length+1).fill(0));for(let i=0;i<=expected.length;i++)dp[i][0]=i;for(let j=0;j<=words.length;j++)dp[0][j]=j;
 for(let i=1;i<=expected.length;i++)for(let j=1;j<=words.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+distance(expected[i-1],words[j-1].word));
 const mapped=expected.map(word=>({word}));let i=expected.length,j=words.length;
 while(i||j){if(i&&j&&Math.abs(dp[i][j]-dp[i-1][j-1]-distance(expected[i-1],words[j-1].word))<.00001){Object.assign(mapped[i-1],{start:words[j-1].start,end:words[j-1].end});i--;j--;}else if(i&&Math.abs(dp[i][j]-dp[i-1][j]-1)<.00001)i--;else j--;}
 for(let k=0;k<mapped.length;k++)if(mapped[k].start===undefined){const before=mapped.slice(0,k).reverse().find(x=>x.end!==undefined),after=mapped.slice(k+1).find(x=>x.start!==undefined);mapped[k].start=before?.end??0;mapped[k].end=Math.max(mapped[k].start+.04,after?.start??duration);}
 return mapped;
}
function makeCues(s,item){
 const record=read(path.join(__dirname,'audio',s.audio.replace(/\.wav$/,'.json'))),asrPath=path.join(__dirname,'_검토/음성대조',s.audio.replace(/\.wav$/,'.json'));
 const transcript=fs.existsSync(asrPath)&&fs.statSync(asrPath).size?read(asrPath):null;
 const actualWords=transcript?.segments?.flatMap(x=>x.words||[])||[];
 const words=actualWords.length?alignWords(s.narration,actualWords,record.duration):[],max=item.orientation==='landscape'?64:40,line=item.orientation==='landscape'?54:27,out=[];
 if(words.length&&transcript.sha256===sha(path.join(shared,s.audio))){
  let group=[];const emit=()=>{if(group.length){out.push(cue(wrap(group.map(x=>x.word.trim()).join(' '),line),(group[0].start+.3)*1000,(group.at(-1).end+.3)*1000));group=[]}};
  for(const w of words){if(group.length&&group.map(x=>x.word.trim()).join(' ').length+w.word.length>max)emit();group.push(w);if(/[.!?]$/.test(w.word.trim()))emit()}emit();s.captionTiming='ASR time boundaries aligned to edited source tokens, grouped into readable phrases';
 }else{
  const parts=s.narration.match(/[^.!?]+[.!?]?/g)||[s.narration],total=parts.join('').length;let at=.3;
  for(const p of parts){const duration=record.duration*p.length/total;out.push(cue(wrap(p.trim(),line),at*1000,(at+duration)*1000));at+=duration}s.captionTiming='actual audio duration, proportional sentence timing; ASR unavailable';
 }
 for(const c of out)c.endMs=Math.min(c.endMs,(.3+record.duration)*1000,(s.duration-.25)*1000);
 for(let i=0;i<out.length;i++){
  const c=out[i];if(c.endMs-c.startMs>=1000)continue;
  const limit=i+1<out.length?out[i+1].startMs-25:(s.duration-.18)*1000;
  if(c.startMs+1100<=limit)c.endMs=c.startMs+1100;
  else if(i>0&&wrap((out[i-1].text+' '+c.text).replaceAll('\n',' '),line).split('\n').length<=2){out[i-1].text=wrap((out[i-1].text+' '+c.text).replaceAll('\n',' '),line);out[i-1].endMs=Math.max(c.endMs,Math.min(limit,out[i-1].startMs+1100));out.splice(i,1);i--;}
  else if(i+1<out.length&&wrap((c.text+' '+out[i+1].text).replaceAll('\n',' '),line).split('\n').length<=2){c.text=wrap((c.text+' '+out[i+1].text).replaceAll('\n',' '),line);c.endMs=out[i+1].endMs;out.splice(i+1,1);i--;}
  else throw Error('Caption too short to read: '+item.id+' '+c.text);
 }
 s.captions=out;s.audioDuration=record.duration;s.audioSha256=record.sha256;return out;
}
const mnMeaning={'같이 갈까요?':'Хамт явах уу?','좋아요. 같이 가요.':'Тэгье. Хамт явъя.','내일은 어때요?':'Маргааш ямар вэ?','토요일은 어때요?':'Бямба гарагт явбал ямар вэ?','제 생각은 조금 달라요.':'Миний бодол арай өөр байна.','저는 도서관이 좋아요.':'Надад номын сан таалагдаж байна.','저도 카페가 좋아요.':'Надад ч бас кафе таалагдаж байна.'};
Object.assign(mnMeaning,{'같이 들을까요?':'Хамт сонсох уу?','이 노래는 어때요?':'Энэ дуу ямар байна?','좋아요. 같이 들어요.':'Тэгье. Хамт сонсъё.'});
function subtitles(item,dir){
 let at=0;const ko=[],mn=[],chapters=[];
 const musicCue=(start,end)=>{for(const [cues,text] of [[ko,'[음악: 오늘 밤 제일 환한 사람 · 노래가 재생됩니다]'],[mn,'[Хөгжим: 오늘 밤 제일 환한 사람]']]){const last=cues.at(-1);if(last?.text===text&&Math.abs(last.endMs-start)<1)last.endMs=end;else cues.push(cue(text,start,end));}};
 for(const s of item.scenes){const len=frameCount(s)/fps,offset=at*1000;chapters.push({startSeconds:at,durationSeconds:len,title:s.title||s.musicTitle||'음악',layout:s.layout});
  if(s.layout==='music-bridge'){const musicStart=offset+(len-Math.round(s.musicLeadSeconds*fps)/fps)*1000;if(item.brand==='LAB')mn.push(cue([s.title,s.body].filter(Boolean).join('\n'),offset+300,musicStart-100));musicCue(musicStart,offset+len*1000);}
  else if(s.layout==='music')musicCue(offset,offset+len*1000);
  else if(s.layout==='ending'){/* Quiet logo ending is already visible; no premature subtitle overlay. */}
  else if(s.narration){for(const c of s.captions||[])ko.push({...c,startMs:c.startMs+offset,endMs:c.endMs+offset});if(item.brand==='LAB')mn.push(cue(mnMeaning[s.narration]||s.secondary||s.title,offset+300,offset+Math.min(s.duration-.25,s.audioDuration+.3)*1000));}
  else if(item.brand==='LAB')mn.push(cue([s.title,s.body].filter(Boolean).join('\n'),offset+300,offset+(len-.25)*1000));
  at+=len;
 }
 const write=(name,cues)=>{put(path.join(dir,name+'.json'),JSON.stringify(cues,null,2));put(path.join(dir,name+'.srt'),cues.map((c,i)=>`${i+1}\n${clock(c.startMs)} --> ${clock(c.endMs)}\n${c.text}\n`).join('\n'));put(path.join(dir,name+'.vtt'),'WEBVTT\n\n'+cues.map(c=>`${clock(c.startMs,'.')} --> ${clock(c.endMs,'.')}\n${c.text}\n`).join('\n'));};
 write('subtitles-ko',ko);if(item.brand==='LAB')write('subtitles-mn',mn);write('자막',item.brand==='LAB'?mn:ko);
 put(path.join(dir,'챕터.json'),JSON.stringify(chapters,null,2));put(path.join(dir,'챕터.txt'),chapters.map(c=>`${clock(c.startSeconds*1000,'.').slice(0,8)} ${c.title.replaceAll('\n',' ')}`).join('\n')+'\n');return chapters;
}
async function publicAssets(items){
 fs.mkdirSync(ownMedia,{recursive:true});const amap=read(path.join(shared,'assets.json')),needed=new Set(['assets.json']);
 for(const item of items){needed.add(item.brand==='LAB'?'bed-lab.wav':'bed-shift.wav');needed.add(amap['logo-'+item.brand.toLowerCase()]);for(const s of item.scenes){for(const key of [s.asset,s.logoAsset,s.transitionFromAsset].filter(Boolean))needed.add(amap[key]);if(s.mascotAnimation){for(const key of [s.mascotAnimation.baseAsset,s.mascotAnimation.closedAsset,s.mascotAnimation.smileAsset,s.mascotAnimation.eyeMaskAsset||'mong-eye-union'])needed.add(amap[key]);}if(s.audio)needed.add(s.audio);if(s.mascotAudio)needed.add(s.mascotAudio);if(s.layout==='music'||s.layout==='music-bridge')needed.add('pulse-full.mp4');}}
 const copied=[];for(const file of needed){if(!file)throw Error('Missing asset key');const src=path.join(shared,file),dest=path.join(ownMedia,file);if(!fs.existsSync(src))throw Error('Missing asset '+src);fs.copyFileSync(src,dest);copied.push({file,sha256:sha(src),exactCopy:sha(src)===sha(dest)});}
 const fonts=read(path.join(video,'src/킷/폰트벌.json'));for(const f of fonts.벌){const name=path.basename(f.정본),src=path.join(root,'docs/브랜드_폰트',f.정본),dest=path.join(ownPublic,'폰트',name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);copied.push({file:'폰트/'+name,sha256:sha(src),exactCopy:sha(src)===sha(dest)});}
 put(path.join(qa,'render-assets.json'),JSON.stringify(copied,null,2));
}
async function sheets(records,id,label,destination){
 const wide=records[0].width>records[0].height,w=wide?640:360,h=wide?360:640,cols=wide?2:3;
 const tiles=await Promise.all(records.map(async(r,i)=>({input:await sharp(r.file).resize(w,h).png().toBuffer(),left:i%cols*w,top:Math.floor(i/cols)*h})));
 const out=path.join(destination||path.join(qa,id),label+'.png');await sharp({create:{width:w*cols,height:h*Math.ceil(records.length/cols),channels:3,background:require(path.join(root,'tools/lib/loom')).정본().색.Paper}}).composite(tiles).png().toFile(out);return out;
}
function assertReady(item){for(const s of item.scenes){if(!s.narration||s.layout==='music')continue;if(!s.audio)throw Error(item.id+' missing actual audio');const p=path.join(shared,s.audio),recordPath=path.join(__dirname,'audio',s.audio.replace(/\.wav$/,'.json'));if(!fs.existsSync(p)||!fs.existsSync(recordPath))throw Error('Missing completed voice '+s.audio);const r=read(recordPath);if(r.status!=='completed'||r.narration!==s.narration||r.sha256!==sha(p))throw Error('Voice does not match final narration '+s.audio);if(s.duration<r.duration+.3)throw Error('Voice truncated by scene '+s.audio);}}
function assertMusicBridge(item){
 const index=item.scenes.findIndex(s=>s.layout==='music-bridge');if(index<0)return;
 const bridge=item.scenes[index],music=item.scenes[index+1],lead=Math.round(bridge.musicLeadSeconds*fps);
 const following=item.scenes.slice(index+2);
 if(item.id!=='01-lab-youtube'||item.orientation!=='landscape'||following.some(s=>s.layout!=='ending')||following.length>1||music?.layout!=='music'||bridge.duration<2.8||lead<=0||lead>=frameCount(bridge)||lead!==Math.round(music.sourceStartSeconds*fps))throw Error('Music bridge must join adjacent source frames exactly, followed only by the optional quiet ending');
 for(const s of following)if(s.narration||s.audio||s.mascotAudio||frameCount(s)!==210||!s.logoAsset||!s.transitionFromAsset)throw Error('01 ending must preserve the completed song and remain a quiet 7-second scene');
 const facts=probe(path.join(shared,'pulse-full.mp4')),source=facts.streams.find(s=>s.codec_type==='video'),sourceFrames=Number(source?.nb_frames);
 if(source?.r_frame_rate!==`${fps}/1`||!Number.isInteger(sourceFrames)||lead+frameCount(music)!==sourceFrames)throw Error('Music bridge must preserve the full original song');
 for(const gain of Object.values(item.audioMix||{}))if(typeof gain!=='number'||!Number.isFinite(gain)||gain<0||gain>1)throw Error('Invalid 01 audio mix');
}
const scenePositions=s=>s.mascotAnimation?[.5,1,1.8,2.8,4.8,5.2]:s.layout==='ending'?[0,.45,.95,2.2,4.2,s.duration-1/fps]:s.layout==='music-bridge'?[1.8,s.duration-2.8,s.duration-s.musicLeadSeconds,s.duration-s.musicLeadSeconds+.6,s.duration-1/fps]:s.layout==='music'?[.1,15,30,Math.min(60,s.duration-1/fps),s.duration-1/fps]:[Math.min(1.8,s.duration/2)];
const hashValue=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const videoStreamHash=file=>run('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','pipe:1']).trim().replace(/^SHA256=/,'');
const audioMetadataNames=['render-input.json','verification.json','subtitles-ko.json','subtitles-ko.srt','subtitles-ko.vtt','subtitles-mn.json','subtitles-mn.srt','subtitles-mn.vtt','자막.json','자막.srt','자막.vtt','챕터.json','챕터.txt'];
function publishAudioCommit(commit,{job,output,dir,inspect}){
 const metadata=path.join(job,'metadata'),pending=path.join(job,'video.pending.mp4');
 if(commit.files.length!==audioMetadataNames.length||new Set(commit.files.map(x=>x.name)).size!==audioMetadataNames.length)throw Error('Incomplete replacement metadata manifest');
 for(const file of commit.files)if(!audioMetadataNames.includes(file.name)||sha(path.join(metadata,file.name))!==file.sha256)throw Error('Replacement metadata candidate changed');
 const input=path.join(metadata,'render-input.json'),proof=read(path.join(metadata,'verification.json'));
 if(proof.sha256!==commit.outputSha256||proof.renderInputSha256!==sha(input))throw Error('Replacement metadata and video do not match');
 const activeHash=sha(output);
 if(activeHash!==commit.outputSha256){if(activeHash!==commit.sourceSha256||!fs.existsSync(pending)||sha(pending)!==commit.outputSha256)throw Error('Active video or validated replacement candidate changed');fs.renameSync(pending,output);}
 // If publishing a small file fails, this immutable manifest permits metadata-only replay.
 for(const file of commit.files){const destination=path.join(['render-input.json','verification.json'].includes(file.name)?inspect:dir,file.name);if(!fs.existsSync(destination)||sha(destination)!==file.sha256)put(destination,fs.readFileSync(path.join(metadata,file.name)));}
 put(path.join(job,'replacement-commit.json'),JSON.stringify({...commit,status:'committed'},null,2));
}
async function replaceAudio(item,common){
 const dir=path.join(__dirname,item.id),inspect=path.join(qa,item.id),preserved=path.join(__dirname,'_검토/01-음성수정/화면검수중간본');
 const sourceVideo=path.join(preserved,'video.mp4'),sourceInput=path.join(preserved,'render-input.json'),sourceReport=read(path.join(preserved,'verification.json')),old=read(sourceInput).item,output=path.join(dir,'video.mp4');
 if(item.id!=='01-lab-youtube'||!sourceReport.fullDecode||sha(sourceVideo)!==sourceReport.sha256||sha(sourceInput)!==sourceReport.renderInputSha256)throw Error('Audio replacement requires the exact preserved visual intermediate');
 const visual=value=>({id:value.id,brand:value.brand,account:value.account,displayAccount:value.displayAccount,orientation:value.orientation,scenes:value.scenes.map(s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['audio','audioRecord','audioDuration','audioSha256','captions','captionTiming'].includes(key))))});
 if(hashValue(visual(item))!==hashValue(visual(old)))throw Error('Audio-only replacement cannot change scenes, text or timing');
 const originalState=read(sourceReport.renderMethod.statePath),voiceNames=new Set(old.scenes.map(s=>s.audio).filter(Boolean));
 for(const asset of originalState.assets)if(!voiceNames.has(asset.file)&&sha(path.join(shared,asset.file))!==asset.sha256)throw Error('Preserved visual asset changed: '+asset.file);
 for(const source of originalState.sourceHashes){const file=source.file.startsWith('킷/')?path.join(video,'src',source.file):path.join(video,'src/firstposts20260910',source.file);if(sha(file)!==source.sha256)throw Error('Visual renderer changed since preserved intermediate: '+source.file);}
 const total=item.scenes.reduce((n,s)=>n+frameCount(s),0),expected=total/fps,sourceScriptSha256=sha(path.join(__dirname,'원고/video.json'));
 const jobKey=hashValue({item,sourceVideoSha256:sourceReport.sha256,rendererSha256:sha(__filename)}),job=path.join(inspect,'audio-replacement',jobKey.slice(0,16)),wav=path.join(job,'audio-full.wav'),stateFile=path.join(job,'audio-state.json');fs.mkdirSync(job,{recursive:true});
 const commitFile=path.join(job,'replacement-commit.json');if(fs.existsSync(commitFile)){const commit=read(commitFile);if(commit.jobKey!==jobKey||commit.sourceSha256!==sourceReport.sha256||commit.sourceScriptSha256!==sourceScriptSha256)throw Error('Replacement recovery source mismatch');publishAudioCommit(commit,{job,output,dir,inspect});console.log(item.id+' audio replacement metadata committed without rendering');return;}
 if(sha(output)!==sourceReport.sha256)throw Error('Active video differs from preserved intermediate; it remains unchanged');
 let state=fs.existsSync(stateFile)?read(stateFile):null;
 if(!(state?.jobKey===jobKey&&state.fullDecode&&fs.existsSync(wav)&&state.wavSha256===sha(wav))){
  const pending=path.join(job,'audio-full.pending.wav');if(fs.existsSync(wav)||fs.existsSync(pending))throw Error('Existing unverified audio replacement is preserved');let last=-1;const started=Date.now();
  await renderMedia({...common,outputLocation:pending,codec:'wav',sampleRate:48000,muted:false,overwrite:false,onProgress:p=>{const step=Math.floor(p.progress*10);if(step!==last){last=step;console.log(`${item.id} audio-only ${step*10}% frames=${p.renderedFrames}/${total} elapsed=${((Date.now()-started)/1000).toFixed(1)}s`);}}});
  const info=probe(pending),a=info.streams.find(s=>s.codec_type==='audio');if(!a||Number(a.sample_rate)!==48000||Math.abs(Number(info.format.duration)-expected)>.001)throw Error('Replacement WAV length/rate mismatch');
  run('ffmpeg',['-v','error','-xerror','-i',pending,'-f','null','NUL']);fs.renameSync(pending,wav);state={jobKey,wavSha256:sha(wav),duration:Number(info.format.duration),sampleRate:48000,fullDecode:true};put(stateFile,JSON.stringify(state,null,2));
 }
 const pendingVideo=path.join(job,'video.pending.mp4');if(fs.existsSync(pendingVideo))throw Error('Existing unverified replacement video is preserved');
 const sourceStreamSha256=videoStreamHash(sourceVideo);
 run('ffmpeg',['-v','error','-xerror','-i',sourceVideo,'-i',wav,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-t',expected.toFixed(9),'-movflags','+faststart',pendingVideo]);
 const facts=probe(pendingVideo),v=facts.streams.find(s=>s.codec_type==='video'),a=facts.streams.find(s=>s.codec_type==='audio'),targetStreamSha256=videoStreamHash(pendingVideo);
 if(!v||!a||v.width!==sourceReport.width||v.height!==sourceReport.height||Number(v.nb_frames)!==total||v.r_frame_rate!=='30/1'||a.codec_name!=='aac'||Number(a.sample_rate)!==48000||Math.abs(Number(facts.format.duration)-expected)>.001||sourceStreamSha256!==targetStreamSha256)throw Error('Audio replacement changed encoded video or stream contract');
 run('ffmpeg',['-v','error','-xerror','-i',pendingVideo,'-f','null','NUL']);
 if(sha(output)!==sourceReport.sha256||sha(path.join(__dirname,'원고/video.json'))!==sourceScriptSha256)throw Error('Active video or source changed during audio replacement; candidate preserved');
 // Stage every small output before publishing the already validated video.
 const metadata=path.join(job,'metadata');put(path.join(metadata,'render-input.json'),JSON.stringify({item},null,2));const chapters=subtitles(item,metadata);
 const replacement={mode:'audio only; encoded video copied without re-rendering',sourceVideoSha256:sourceReport.sha256,sourceVideoStreamSha256:sourceStreamSha256,outputVideoStreamSha256:targetStreamSha256,streamCopyVerified:true,sourceScriptSha256,wav:path.relative(__dirname,wav).replaceAll('\\','/'),wavSha256:state.wavSha256,outputCodec:'aac',requestedAudioBitrate:320000,sampleRate:48000,rendererSha256:sha(__filename),sources:item.scenes.filter(s=>s.audio).map(s=>({file:s.audio,sha256:s.audioSha256,narration:s.narration})),humanListening:false,refinedAudioUserApproved:false};
 const report={...sourceReport,sha256:sha(pendingVideo),duration:Number(facts.format.duration),expectedDuration:expected,renderMode:'audio-only replacement',sourceScriptSha256,visualSourceRenderInputSha256:sourceReport.renderInputSha256,renderInputSha256:sha(path.join(metadata,'render-input.json')),audioReplacement:replacement,audioStatus:'native 48kHz regenerated synthetic voice, preserving user-selected B as style reference; final user listening approval not recorded',fullDecode:true,chapters,captionTiming:item.scenes.filter(s=>s.audio).map(s=>s.captionTiming),humanListening:false};
 put(path.join(metadata,'verification.json'),JSON.stringify(report,null,2));const commit={jobKey,sourceSha256:sourceReport.sha256,outputSha256:report.sha256,sourceScriptSha256,status:'prepared',files:audioMetadataNames.map(name=>({name,sha256:sha(path.join(metadata,name))}))};put(commitFile,JSON.stringify(commit,null,2));publishAudioCommit(commit,{job,output,dir,inspect});console.log(item.id+' audio replacement verified '+expected.toFixed(3)+'s; encoded video identical');
}
async function main(){
 const selected=(process.argv.find(x=>x.startsWith('--id='))||'').slice(5),transitionCheck=process.argv.includes('--transition-check'),mascotDebug=process.argv.includes('--mascot-debug')||transitionCheck,coverReview=process.argv.includes('--cover-review'),candidate=process.argv.includes('--candidate'),preview=process.argv.includes('--preview')||mascotDebug||coverReview,checkOnly=process.argv.includes('--check-only'),audioOnly=process.argv.includes('--audio-only');
 if(mascotDebug&&selected!=='01-lab-youtube')throw Error('--mascot-debug requires only 01');
 if(coverReview&&(selected!=='01-lab-youtube'||checkOnly||audioOnly))throw Error('01 cover review requires only 01');
 if(candidate&&(!selected||checkOnly||audioOnly))throw Error('Candidate render needs explicit IDs and cannot verify an old video');
 if(audioOnly&&(selected!=='01-lab-youtube'||preview||checkOnly))throw Error('--audio-only requires only --id=01-lab-youtube');
 // A local space check prevents another incomplete write; no background watcher is created.
 const disk=fs.statfsSync(__dirname),minimum=preview?1.5*1024**3:768*1024**2;if(!checkOnly&&disk.bavail*disk.bsize<minimum)throw Error('Insufficient free space before rendering; need '+minimum+' bytes. Existing outputs remain untouched.');
 const sourceScriptAtStart=sha(path.join(__dirname,'원고/video.json'));
 const originals=read(path.join(__dirname,'원고/video.json')).items,films=read(path.join(shared,'films.json')),items=films.filter(x=>!selected||selected.split(',').includes(x.id));if(!items.length)throw Error('No matching films');
 for(const item of items){const original=originals.find(x=>x.id===item.id);if(JSON.stringify(item.scenes.map(s=>s.narration))!==JSON.stringify(original.scenes.map(s=>s.narration)))throw Error('films narration stale '+item.id);const scenes=item.scenes.map((s,i)=>({...original.scenes[i],audio:s.audio,duration:s.duration}));Object.assign(item,original,{scenes});assertReady(item);assertMusicBridge(item);for(const s of item.scenes)if(s.audio)makeCues(s,item);}
 if(!checkOnly)await publicAssets(items);
 const serveUrl=checkOnly?null:await bundle({entryPoint:path.join(video,'src/firstposts20260910/index.tsx'),rootDir:video,publicDir:ownPublic,outDir:path.join(qa,'bundle'),enableCaching:false,webpackOverride:config=>({...config,cache:false})});
 if(!checkOnly)puppeteerInstance=await openBrowser('chrome',{browserExecutable});
 if(mascotDebug){const inputProps={scene:items[0].scenes[0]},composition=await selectComposition({serveUrl,id:'LabMascotDebug',inputProps,browserExecutable,puppeteerInstance}),dir=path.join(__dirname,'_검토/01-표정편집엔딩/몽글합성');fs.mkdirSync(dir,{recursive:true});const positions=transitionCheck?[28,50,52,108,110].map(f=>['transition-'+f,f]):[['base',15],['closed',30],['smile',84]];for(const [name,frame] of positions){await renderStill({serveUrl,composition,inputProps,browserExecutable,puppeteerInstance,frame,scale:transitionCheck?635/4096:1,output:path.join(dir,'render-'+name+'.png'),overwrite:true,imageFormat:'png',omitBackground:true});console.log('Mascot transparent actual component '+name);}return;}
 if(coverReview){const item=items[0],inputProps={item},composition=await selectComposition({serveUrl,id:'FirstPost',inputProps,browserExecutable,puppeteerInstance}),dir=path.join(__dirname,'_검토/01-표정편집엔딩/몽글합성');for(const frame of [15,30,84])await renderStill({serveUrl,composition,inputProps,browserExecutable,puppeteerInstance,frame,output:path.join(dir,'cover-'+frame+'.png'),overwrite:true,imageFormat:'png'});await renderMedia({serveUrl,composition,inputProps,browserExecutable,puppeteerInstance,concurrency:2,outputLocation:path.join(dir,'cover-motion.mp4'),frameRange:[0,179],codec:'h264',scale:.5,videoBitrate:'3M',audioBitrate:'320k',imageFormat:'jpeg',jpegQuality:100,overwrite:true,onProgress:p=>{if(p.renderedFrames%30===0)console.log('Cover motion frames '+p.renderedFrames+'/180');}});run('ffmpeg',['-v','error','-xerror','-i',path.join(dir,'cover-motion.mp4'),'-f','null','NUL']);return;}
 if(audioOnly){const item=items[0],inputProps={item},composition=await selectComposition({serveUrl,id:'FirstPost',inputProps,browserExecutable,puppeteerInstance});await replaceAudio(item,{serveUrl,composition,inputProps,browserExecutable,puppeteerInstance,concurrency:2});return;}
 for(const item of items){
  const dir=candidate?(item.id==='01-lab-youtube'?path.join(__dirname,'_검토/01-표정편집엔딩/최종후보'):path.join(__dirname,'_검토/02-나머지일관화/최종후보',item.id)):path.join(__dirname,item.id),inspect=candidate?path.join(dir,'검증'):path.join(qa,item.id);fs.mkdirSync(inspect,{recursive:true});fs.mkdirSync(dir,{recursive:true});
  const priorOutput=path.join(dir,'video.mp4'),priorReport=path.join(inspect,'verification.json');
  if(!preview&&!checkOnly&&fs.existsSync(priorOutput)){if(!fs.existsSync(priorReport))throw Error('Existing unverified final preserved: '+priorOutput);const prior=read(priorReport);if(prior.fullDecode&&prior.sha256===sha(priorOutput)&&prior.sourceItemSha256===hashValue(item)){console.log(item.id+' already verified; preserving final and review records');continue;}throw Error('Existing final does not match verification/source; preserved: '+priorOutput);}
  put(path.join(inspect,'render-input.json'),JSON.stringify({item},null,2));const chapters=subtitles(item,dir),inputProps={item};
  const composition=checkOnly?{width:item.orientation==='landscape'?1920:1080,height:item.orientation==='landscape'?1080:1920,durationInFrames:item.scenes.reduce((n,s)=>n+frameCount(s),0)}:await selectComposition({serveUrl,id:'FirstPost',inputProps,browserExecutable,puppeteerInstance});
  const extracted=[];let at=0;
  if(preview){for(let i=0;i<item.scenes.length;i++){const s=item.scenes[i],positions=['music-bridge','ending'].includes(s.layout)?scenePositions(s):[Math.min(1.8,s.duration-2/fps)];for(const pos of positions){const frame=at+Math.round(pos*fps),file=path.join(inspect,`preview-${String(i+1).padStart(2,'0')}${positions.length>1?'-'+Math.round(pos*fps):''}.png`);await renderStill({serveUrl,composition,inputProps,browserExecutable,puppeteerInstance,frame,output:file,overwrite:true,imageFormat:'png'});extracted.push({file,frame,width:composition.width,height:composition.height});}at+=frameCount(s);console.log(item.id+' preview '+(i+1));}console.log(await sheets(extracted,item.id,'preview-all',inspect));continue;}
  const output=path.join(dir,'video.mp4');
  const audioComposition=checkOnly?null:await selectComposition({serveUrl,id:'FirstPostAudio',inputProps,browserExecutable,puppeteerInstance});
  let chunkProof=null;if(!checkOnly)chunkProof=await renderChunked({renderMedia,audioCommon:{serveUrl,composition:audioComposition,inputProps,browserExecutable,puppeteerInstance,concurrency:2,overwrite:true},common:{serveUrl,composition,inputProps,browserExecutable,puppeteerInstance,concurrency:2,overwrite:true},output,inspect,item,root,shared,probe,run,sha});
  const facts=probe(output),v=facts.streams.find(s=>s.codec_type==='video'),a=facts.streams.find(s=>s.codec_type==='audio');if(!v||!a||v.width!==composition.width||v.height!==composition.height)throw Error('Stream contract failed '+item.id);const expected=composition.durationInFrames/fps;if(Math.abs(Number(facts.format.duration)-expected)>.1)throw Error('Duration mismatch '+item.id);
  run('ffmpeg',['-v','error','-xerror','-i',output,'-f','null','NUL']);
  for(let i=0;i<item.scenes.length;i++){const s=item.scenes[i],n=String(i+1).padStart(2,'0');for(const pos of scenePositions(s)){const file=path.join(inspect,`scene-${n}-${pos}.png`);run('ffmpeg',['-y','-v','error','-ss',String(at/fps+pos),'-i',output,'-frames:v','1',file]);extracted.push({file,scene:i+1,timeSeconds:at/fps+pos,width:v.width,height:v.height});}at+=frameCount(s);}
  await sheets(extracted,item.id,'final-all',inspect);const report={account:item.id,video:path.relative(__dirname,output).replaceAll('\\','/'),sha256:sha(output),width:v.width,height:v.height,duration:Number(facts.format.duration),expectedDuration:expected,renderMethod:chunkProof,fps:v.r_frame_rate,pixelFormat:v.pix_fmt,colorSpace:v.color_space,videoCodec:v.codec_name,audioCodec:a.codec_name,fullDecode:true,scenes:item.scenes.length,extracted,chapters,sourceScriptSha256:sourceScriptAtStart,sourceItemSha256:hashValue(item),renderInputSha256:sha(path.join(inspect,'render-input.json')),captionTiming:item.scenes.filter(s=>s.audio).map(s=>s.captionTiming),visualReview:'pending actual image inspection',humanListening:false};put(path.join(inspect,'verification.json'),JSON.stringify(report,null,2));console.log(item.id+' verified '+expected.toFixed(3)+'s');
 }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(puppeteerInstance)await puppeteerInstance.close({silent:true});});
