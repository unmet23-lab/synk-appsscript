'use strict';
// Scoped input integration for six films. Approved 01 and public copy stay fixed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,root=path.resolve(base,'../../..'),pub=path.join(root,'영상/public/firstposts20260910'),qa=path.join(base,'_검토/02-나머지일관화');
const ids=['03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok'];
const approved='5c2701a46c7a405ba9c7ffa31d933db922bd29b735b8dc47f77eec76b2200f31';
const hash=v=>crypto.createHash('sha256').update(v).digest('hex'),sha=p=>hash(fs.readFileSync(p));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.'+process.pid+'.pending';fs.writeFileSync(tmp,v);if(p.endsWith('.json'))read(tmp);fs.renameSync(tmp,p)};
const save=(p,v)=>put(p,JSON.stringify(v,null,2));
const rawPath=path.join(base,'원고/video.json'),filmsPath=path.join(pub,'films.json');
const before=path.join(qa,'입력-이전'),rawBytes=fs.readFileSync(rawPath),filmsBytes=fs.readFileSync(filmsPath),raw=read(rawPath),films=read(filmsPath);
if(sha(path.join(base,'01-lab-youtube/video.mp4'))!==approved)throw Error('Approved 01 movie changed; inspect before integration');
for(const [name,p] of [['video.json',rawPath],['films.json',filmsPath],['assets.json',path.join(pub,'assets.json')],['자산과원본.json',path.join(base,'_검토/자산과원본.json')],['전체영상검증.json',path.join(base,'_검토/video/전체영상검증.json')]])if(!fs.existsSync(path.join(before,name)))put(path.join(before,name),fs.readFileSync(p));
if(!fs.existsSync(path.join(before,'보존명세.json'))){
 const items=read(path.join(base,'콘텐츠원고.json')).items,records=[];
 for(const item of items)for(const f of fs.readdirSync(path.join(base,item.id),{withFileTypes:true}))if(f.isFile()&&(!ids.includes(item.id)||/\.(jpg|png|txt|md|html)$/.test(f.name))){const rel=item.id+'/'+f.name;records.push({file:rel,sha256:sha(path.join(base,rel))})}
 save(path.join(before,'보존명세.json'),{createdAt:new Date().toISOString(),scope:'01 account and other twelve accounts fixed; selected covers/public copy recorded for comparison',records});
}
const originalRaw=read(path.join(before,'video.json')),originalFilms=read(path.join(before,'films.json'));
const logoSource=path.join(root,'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-SHIFT-Paper.png'),logoFile='logo-shift-paper.png',amapPath=path.join(pub,'assets.json'),amap=read(amapPath);
for(const folder of [pub,path.join(base,'assets')]){const dest=path.join(folder,logoFile);if(fs.existsSync(dest)&&sha(dest)!==sha(logoSource))throw Error('Existing SHIFT Paper copy differs');if(!fs.existsSync(dest))put(dest,fs.readFileSync(logoSource));}
amap['logo-shift-paper']=logoFile;save(amapPath,amap);
const assetReportPath=path.join(base,'_검토/자산과원본.json'),assetReport=read(assetReportPath);
if(!assetReport.assets.some(a=>a.key==='logo-shift-paper')){assetReport.assets.push({key:'logo-shift-paper',file:logoFile,source:path.relative(root,logoSource).replaceAll('\\','/'),sha256:sha(logoSource),purpose:'Current SHIFT Paper logo for quiet six-film ending'});save(assetReportPath,assetReport);}
const voiceMode=process.argv.includes('--voices'),manifestPath=path.join(qa,'음성-manifest.json'),manifest=voiceMode?read(manifestPath):null;
if(voiceMode&&(manifest.completedUnique!==32||manifest.items.length!==32||manifest.errors.length))throw Error('All 32 stable final voices required');
const approvedItem=originalRaw.items.find(x=>x.id==='01-lab-youtube'),changes=[];
const speechEnd=(file,fallback)=>{const p=path.join(base,'_검토/음성대조',file.replace(/\.wav$/,'.json'));if(!fs.existsSync(p))return fallback;const r=read(p),wav=path.join(base,'audio',file);if(r.sha256!==sha(wav))return fallback;const words=(r.segments||[]).flatMap(s=>s.words||[]);return words.length?Math.max(...words.map(w=>w.end)):fallback;};
for(const id of ids){
 const original=originalRaw.items.find(x=>x.id===id),oldFilm=originalFilms.find(x=>x.id===id),item=structuredClone(original),old=films.find(x=>x.id===id);
 item.revision='2026-09-10-approved01-continuity-v1';item.audioMix={narration:.7,bedSpeech:.055,bedSilent:.11,music:.56,mascot:.2};
 item.scenes=item.scenes.map((s,i)=>({...s,duration:oldFilm.scenes[i].duration,audio:oldFilm.scenes[i].audio}));
 if(id==='03-lab-tiktok'){const s=item.scenes[0];s.asset='mong';s.mascotAnimation=structuredClone(approvedItem.scenes[0].mascotAnimation);s.mascotAudio='mong-joy.wav';s.mascotAtSeconds=1.85;}
 const timing=[];
 if(voiceMode)for(let i=0;i<item.scenes.length;i++){
  const s=item.scenes[i];if(!s.narration)continue;
  const r=manifest.items.find(x=>x.account===id&&x.scene===i);
  if(!r||r.narration!==s.narration||r.status!=='completed'||r.nativeGenerationSampleRate!==48000||r.gainAppliedForVideo!==false||r.asrReview==='pending')throw Error('Voice not ready at '+id+'/'+i);
  const wav=path.join(base,'audio',r.file);if(sha(wav)!==r.sha256)throw Error('Stable voice hash changed');
  const oldScene=oldFilm.scenes[i],oldRecord=read(path.join(base,'audio',oldScene.audio.replace(/\.wav$/,'.json'))),oldEnd=speechEnd(oldScene.audio,oldRecord.duration),newEnd=speechEnd(r.file,r.duration),priorWait=Math.max(0,oldScene.duration-.3-oldEnd);
  const hold=Math.max(item.brand==='LAB'?2.1:.9,priorWait*.7),duration=Math.ceil((.3+Math.max(r.duration,newEnd+hold))*30)/30;
  Object.assign(s,{audio:r.file,audioRecord:r.audioRecord,duration,audioDuration:r.duration,audioSha256:r.sha256});
  put(path.join(pub,r.file),fs.readFileSync(wav));
  timing.push({scene:i,narration:s.narration,oldSceneDuration:oldScene.duration,oldSpeechEnd:oldEnd,oldWait:priorWait,newSpeechEnd:newEnd,newFileDuration:r.duration,newSceneDuration:duration,actualPostSpeechHold:duration-.3-newEnd,speechPlaybackRate:1});
 }
 item.scenes.push({layout:'ending',duration:7,title:item.brand==='LAB'?'Солонгос хэл':id.includes('yuhobuilds')?'AI와 회사를 짓는 실제 이야기':'회사를 짓는 과정에서 건진 방법',body:item.displayAccount||item.account,asset:'felt-dark',logoAsset:item.brand==='LAB'?'logo-lab-paper':'logo-shift-paper',narration:'',reference:'01-lab-youtube/video.mp4; 영상/out/홍보_4K_v2/SYNK_홍보_4K.mp4'});
 const narration=x=>x.scenes.map(s=>s.narration||'').filter(Boolean);
 if(JSON.stringify(narration(item))!==JSON.stringify(narration(original)))throw Error('Narration copy changed');
 raw.items[raw.items.findIndex(x=>x.id===id)]=item;films[films.findIndex(x=>x.id===id)]=structuredClone(item);
 changes.push({account:id,stage:voiceMode?'stable-new-voices':'visual-preview-with-existing-voices',frames:item.scenes.reduce((n,s)=>n+Math.round(s.duration*30),0),scenes:item.scenes.length,timing,ending:item.scenes.at(-1),previousInputSha256:hash(JSON.stringify(old)),newInputSha256:hash(JSON.stringify(item))});
}
if(JSON.stringify(raw.items.find(x=>x.id==='01-lab-youtube'))!==JSON.stringify(originalRaw.items.find(x=>x.id==='01-lab-youtube'))||JSON.stringify(films.find(x=>x.id==='01-lab-youtube'))!==JSON.stringify(originalFilms.find(x=>x.id==='01-lab-youtube')))throw Error('Approved 01 input changed');
if(!fs.readFileSync(rawPath).equals(rawBytes)||!fs.readFileSync(filmsPath).equals(filmsBytes))throw Error('Concurrent input edit; current files preserved');
save(rawPath,raw);save(filmsPath,films);
save(path.join(qa,voiceMode?'입력변경.json':'화면입력.json'),{updatedAt:new Date().toISOString(),stage:voiceMode?'stable-new-voices':'preview-only',approved01Sha256:approved,approved01Unchanged:true,narrationPreserved:true,newVoiceCount:voiceMode?32:0,mix:{narration:.7,bedSpeech:.055,bedSilent:.11,music:.56,mascot:.2},rawSha256:sha(rawPath),filmsSha256:sha(filmsPath),voicesManifestSha256:voiceMode?sha(manifestPath):null,changes});
console.log(JSON.stringify({stage:voiceMode?'voices-ready':'visual-preview-ready',accounts:changes.map(x=>({id:x.account,seconds:x.frames/30})),approved01Unchanged:true}));
