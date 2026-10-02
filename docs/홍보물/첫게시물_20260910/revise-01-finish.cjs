'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),shared=path.join(root,'영상/public/firstposts20260910'),qa=path.join(__dirname,'_검토/01-표정편집엔딩');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=data=>crypto.createHash('sha256').update(data).digest('hex'),sha=p=>hash(fs.readFileSync(p));
const put=(p,data)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+'.pending',fd=fs.openSync(t,'w');try{fs.writeFileSync(fd,data);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(t,p)};
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024});if(r.status!==0||r.error)throw Error(r.stderr||String(r.error));return r.stdout};
async function main(){
 const rawPath=path.join(__dirname,'원고/video.json'),filmsPath=path.join(shared,'films.json'),mapPath=path.join(shared,'assets.json'),raw=read(rawPath),films=read(filmsPath),map=read(mapPath),item=raw.items.find(x=>x.id==='01-lab-youtube');
 if(item.revision==='2026-09-10-expression-pacing-ending-v3')throw Error('Revision already applied; preserve current work');
 for(const [name,file] of [['before-video.json',rawPath],['before-films.json',filmsPath],['before-assets.json',mapPath],['before-voice-studio.wav',path.join(__dirname,'01-lab-youtube/voice-studio.wav')],['before-aggregate.json',path.join(__dirname,'_검토/video/전체영상검증.json')],['before-verification.md',path.join(__dirname,'검증결과.md')]]){const dest=path.join(qa,name);if(fs.existsSync(dest))throw Error('Existing baseline preserved: '+name);put(dest,fs.readFileSync(file));}
 const othersBefore=hash(JSON.stringify(films.filter(x=>x.id!==item.id))),fps=30,pacing=[];
 for(const s of item.scenes.filter(s=>s.audio)){
  const record=read(path.join(__dirname,s.audioRecord)),asr=read(path.join(__dirname,'_검토/음성대조',s.audio.replace(/wav$/,'json')));
  if(asr.sha256!==sha(path.join(shared,s.audio)))throw Error('ASR/audio source mismatch');
  const words=asr.segments.flatMap(s=>s.words||[]),spokenEnd=.3+Math.max(...words.map(w=>w.end)),oldGap=s.duration-spokenEnd,targetGap=oldGap*.7;
  const newFrames=Math.round((spokenEnd+targetGap)*fps),newDuration=newFrames/fps;
  if(newDuration<.3+record.duration+.25)throw Error('Narration tail could be clipped');
  pacing.push({narration:s.narration,previousSceneSeconds:s.duration,spokenEndSeconds:spokenEnd,previousPostSpeechGapSeconds:oldGap,targetPostSpeechGapSeconds:targetGap,newSceneFrames:newFrames,newSceneSeconds:newDuration,newPostSpeechGapSeconds:newDuration-spokenEnd,actualGapRatio:(newDuration-spokenEnd)/oldGap,voicePlaybackRate:1,measurement:'Existing ASR word end; frame-rounded gap reduction, generated voice unchanged'});
  s.duration=newDuration;
 }
 item.audioMix.narration=.7;item.audioMix.mascot=.2;
 item.scenes[0].asset='smile';item.scenes[0].mascotAudio='mong-joy.wav';item.scenes[0].mascotAtSeconds=.45;
 item.slides[0].asset='smile';item.thumbnail.asset='smile';
 item.scenes.push({layout:'ending',duration:7,title:'Солонгос хэл · K-LOFI24',body:'@synkkorean',asset:'felt-dark',logoAsset:'logo-lab-paper',transitionFromAsset:'pulse-last',narration:'',reference:'영상/out/홍보_4K_v2/SYNK_홍보_4K.mp4'});
 item.revision='2026-09-10-expression-pacing-ending-v3';
 const sources=[];
 for(const [key,name,relative] of [['logo-lab-paper','logo-lab-paper.png','docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-LAB-Paper.png'],['felt-dark','felt-dark.webp','docs/Loom_자산/구움/펠트_어두운판.webp'],['mong-joy','mong-joy.wav','docs/브랜드_사운드킷/synk-voice-myang.wav']]){
  const src=path.join(root,relative);put(path.join(shared,name),fs.readFileSync(src));if(!name.endsWith('.wav'))put(path.join(__dirname,'assets',name),fs.readFileSync(src));map[key]=name;sources.push({key,file:name,source:relative,sourceSha256:sha(src),copiedSha256:sha(path.join(shared,name)),unchangedSource:true});
 }
 const last=path.join(shared,'pulse-last.png');if(!fs.existsSync(last))run('ffmpeg',['-v','error','-i',path.join(shared,'pulse-full.mp4'),'-vf','select=eq(n\\,1847)','-frames:v','1',last]);map['pulse-last']='pulse-last.png';
 sources.push({key:'pulse-last',file:'pulse-last.png',source:'영상/public/firstposts20260910/pulse-full.mp4',sourceSha256:sha(path.join(shared,'pulse-full.mp4')),frame:1847,sha256:sha(last)});
 const out=path.join(__dirname,'01-lab-youtube/voice-studio.wav'),pending=out+'.pending.wav';run('ffmpeg',['-v','error','-y','-i',path.join(__dirname,'_검토/01-음성수정/studio-reference.wav'),'-af','volume=0.7','-ar','48000','-c:a','pcm_s24le',pending]);fs.renameSync(pending,out);
 put(rawPath,JSON.stringify(raw,null,2));put(filmsPath,JSON.stringify(films.map(f=>f.id===item.id?item:f),null,2));put(mapPath,JSON.stringify(map,null,2));
 const otherNow=hash(JSON.stringify(read(filmsPath).filter(x=>x.id!==item.id)));if(othersBefore!==otherNow)throw Error('Another film changed');
 let at=0;const timeline=item.scenes.map(s=>{const entry={layout:s.layout,fromFrames:at,frames:Math.round(s.duration*fps),duration:s.duration};at+=entry.frames;return entry});
 const record={createdAt:new Date().toISOString(),account:item.id,sourceScriptSha256:sha(rawPath),revision:item.revision,narration:{oldGain:1,newGain:.7,ratio:.7,changeDb:20*Math.log10(.7),voicePlaybackRate:1,sourceFilesUnchanged:true,standaloneWavSha256:sha(out)},pacing,timeline,totalFrames:at,totalSeconds:at/fps,mascot:{image:'smile.png',approvedSource:'docs/캐릭터/정본_4K/몽글_눈웃음.png',imageSha256:sha(path.join(shared,'smile.png')),existingApprovedStaticExpression:true,notClaimingIdenticalAlphaAnimationSet:true,audio:'mong-joy.wav',voiceType:'Existing approved nonverbal joy syllable myang',gain:.2,atSeconds:.45},sources,reference:{file:'영상/out/홍보_4K_v2/SYNK_홍보_4K.mp4',sha256:sha(path.join(root,'영상/out/홍보_4K_v2/SYNK_홍보_4K.mp4')),application:'Dark real felt, restrained logo, staggered quiet descriptor and fade; current approved logo and wording'},otherSixFilmsContentUnchanged:otherNow===othersBefore,humanListening:false,finalRenderPending:true};
 put(path.join(qa,'입력변경.json'),JSON.stringify(record,null,2));console.log(JSON.stringify({totalSeconds:record.totalSeconds,totalFrames:at,narrationGain:.7,pacing,otherSixUnchanged:true},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
