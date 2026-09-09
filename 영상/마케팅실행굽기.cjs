#!/usr/bin/env node
'use strict';
// Scoped renderer: no legacy Root.tsx, shared kit, or unrelated marketing outputs are changed.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const videoRoot=__dirname,repo=path.dirname(videoRoot),collection=path.join(repo,'docs','홍보물','마케팅실행_20260909');
const review=path.join(collection,'_검토'),publicDir=path.join(videoRoot,'public','마케팅실행20260909'),sourceDir=path.join(videoRoot,'src','마케팅실행20260909');
const scriptPath=path.join(collection,'원고','콘텐츠원고.json'),assetDir=path.join(collection,'assets');
const cli=path.join(videoRoot,'node_modules','@remotion','cli','remotion-cli.js'),bin=path.join(videoRoot,'node_modules','@remotion','compositor-win32-x64-msvc');
const ffmpeg=path.join(bin,'ffmpeg.exe'),ffprobe=path.join(bin,'ffprobe.exe');
const shortIds=['01-lab-youtube','03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok'];
const allIds=[...shortIds,'shift-public-class-01','shift-public-clinic-demo-01'];
const args=process.argv.slice(2),idIndex=args.indexOf('--id'),selected=idIndex<0?shortIds:[args[idIndex+1]];
if(selected.some(x=>!allIds.includes(x)))throw new Error('Unknown scoped video id');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const norm=s=>s.replace(/\r\n?/g,'\n').split('\n').map(l=>l.replace(/[ \t]+$/,'')).join('\n');
function writeJson(p,d){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');}
function run(exe,argv,name){
 const r=spawnSync(exe,argv,{cwd:videoRoot,encoding:'utf8',shell:false,maxBuffer:64*1024*1024,windowsHide:true});
 const out=norm((r.stdout||'')+'\n'+(r.stderr||''));
 if(r.status!==0)throw new Error(name+' failed '+r.status+'\n'+out.slice(-14000));
 return out;
}
function outputPath(id){return id==='shift-public-class-01'?path.join(collection,'공개수업','수업.mp4'):id==='shift-public-clinic-demo-01'?path.join(collection,'공개수업','클리닉.mp4'):path.join(collection,id,'video.mp4');}
function srtPath(id){return id==='shift-public-class-01'?path.join(collection,'공개수업','수업.srt'):id==='shift-public-clinic-demo-01'?path.join(collection,'공개수업','클리닉.srt'):path.join(collection,id,'자막.srt');}
function probe(p){return JSON.parse(run(ffprobe,['-v','error','-show_format','-show_streams','-of','json',p],'ffprobe'));}
function validateLog(log){for(const p of ['Failed to load resource','Browser failed to load','Failed to fetch','net::ERR_','Could not load font','Font failed','Critical text overflow'])if(log.includes(p))throw new Error('Render resource failure: '+p);}
function time(ms){const n=Math.round(ms);return [Math.floor(n/3600000),Math.floor(n/60000)%60,Math.floor(n/1000)%60].map(x=>String(x).padStart(2,'0')).join(':')+','+String(n%1000).padStart(3,'0');}
function splitText(text,max=64){
 const sentences=text.split(/(?<=[.!?。])\s+/).filter(Boolean),chunks=[];
 for(const sentence of sentences){
  const pieces=[];let current='';
  for(const word of sentence.split(/\s+/)){
   if(current&&(current+' '+word).length>max){pieces.push(current);current=word;}
   else current+=(current?' ':'')+word;
  }
  if(current)pieces.push(current);
  // A final one-verb flash is not a readable subtitle. Rebalance within the same sentence.
  if(pieces.length>1&&pieces.at(-1).length<18){
   const words=pieces[pieces.length-2].split(' ');let tail=pieces.at(-1);
   while(tail.length<18&&words.length>1)tail=words.pop()+' '+tail;
   pieces[pieces.length-2]=words.join(' ');pieces[pieces.length-1]=tail;
  }
  chunks.push(...pieces);
 }
 return chunks;
}
function proportionalCues(text,duration){
 const chunks=splitText(text),weights=chunks.map(t=>t.length+3),total=weights.reduce((s,n)=>s+n,0);
 let start=0;return chunks.map((text,i)=>{const end=start+duration*1000*weights[i]/total;const c={text,startMs:Math.round(start),endMs:Math.round(end),timestampMs:null,confidence:null};start=end;return c;});
}
function alignedCues(text,transcript,duration){
 const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const chunks=splitText(text),expected=normalize(chunks.join(' ')),heard=[];
 for(const segment of transcript.segments||[])for(const word of segment.words||[]){
  const chars=[...normalize(word.word||'')];
  chars.forEach((char,i)=>heard.push({char,start:word.start+(word.end-word.start)*i/chars.length,end:word.start+(word.end-word.start)*(i+1)/chars.length}));
 }
 if(!expected.length||!heard.length)throw new Error('ASR alignment has no words');
 const n=expected.length,m=heard.length,dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=0;i<=n;i++)dp[i][0]=i;for(let j=0;j<=m;j++)dp[0][j]=j;
 for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(expected[i-1]===heard[j-1].char?0:1));
 const differenceRatio=dp[n][m]/Math.max(n,m);
 if(differenceRatio>.22)throw new Error('ASR content mismatch requires review: '+differenceRatio.toFixed(3));
 const map=Array(n).fill(null);let i=n,j=m;
 while(i>0||j>0){
  if(i>0&&j>0&&dp[i][j]===dp[i-1][j-1]+(expected[i-1]===heard[j-1].char?0:1)){map[i-1]=j-1;i--;j--;}
  else if(i>0&&dp[i][j]===dp[i-1][j]+1){i--;}
  else j--;
 }
 let nearest=0;for(let k=0;k<n;k++){if(map[k]!==null)nearest=map[k];else map[k]=nearest;}
 let offset=0;const cues=chunks.map(chunk=>{
  const count=normalize(chunk).length,start=heard[map[offset]].start,end=heard[map[Math.min(n-1,offset+count-1)]].end;offset+=count;
  return {text:chunk,startMs:Math.round(Math.max(0,start)*1000),endMs:Math.round(Math.min(duration,Math.max(start+.15,end)) *1000),timestampMs:null,confidence:null};
 });
 for(let k=0;k<cues.length-1;k++)cues[k].endMs=Math.min(cues[k].endMs,cues[k+1].startMs);
 return {cues,differenceRatio};
}
function audioManifestFor(id){
 const folder=path.join(collection,'공개수업','음성');
 const candidates=id==='shift-public-class-01'?['음성명세.json','manifest.json']:['클리닉_음성명세.json','clinic-manifest.json'];
 for(const f of candidates){const p=path.join(folder,f);if(fs.existsSync(p))return {path:p,data:json(p)};}
 return null;
}
function buildPlans(){
 const source=fs.readFileSync(scriptPath),data=JSON.parse(source),scriptSha256=sha(source);
 const result=[];
 for(const id of allIds){
  const raw=data.items.find(x=>x.id===id)||data.lectures.find(x=>x.id===id)||data.extras.find(x=>x.id===id);
  if(!raw)throw new Error('Missing source '+id);
  const long=id.startsWith('shift-public-'),scenes=(raw.scenes||raw.chapters).map(s=>({...s,durationSec:s.durationSec||s.duration,asset:s.asset==='shiftpage'?'book':s.asset}));
  const audio=long?audioManifestFor(id):null;
  let audioReady=!long;
  if(audio){
   audioReady=true;
   for(let i=0;i<scenes.length;i++){
    const s=scenes[i],record=(audio.data.chapters||[]).find(c=>c.id===(s.id||String(i+1).padStart(2,'0')));
    if(!record){audioReady=false;continue;}
    if(record.narrationSha256!==sha(s.narration||''))throw new Error('Narration hash mismatch '+id+' '+(i+1));
    const rawFile=record.wavFile||record.file||record.wav;
    if(!rawFile)throw new Error('Audio file not supplied '+id);
    const possible=[path.resolve(path.dirname(audio.path),rawFile),path.resolve(repo,rawFile)];
    const input=possible.find(p=>fs.existsSync(p));if(!input)throw new Error('Audio path absent '+rawFile);
    const media=probe(input),actual=Number(media.format.duration);
    const prepared='voice-'+id+'-'+String(i+1).padStart(2,'0')+path.extname(input);
    fs.copyFileSync(input,path.join(publicDir,prepared));
    s.audioFile=prepared;s.audioDurationSec=actual;
    // Preserve complete speech + practice time; never accelerate to fit a planned slot.
    s.durationSec=Math.ceil((actual+(s.pauseForPracticeSec||0)+.8)*30)/30;
    const transcriptNames=record.transcriptionFile?[record.transcriptionFile]:(id==='shift-public-class-01'?['전사-'+String(i+1).padStart(2,'0')+'.json']:['전사-clinic-'+String(i+1).padStart(2,'0')+'.json','전사-클리닉'+String(i+1).padStart(2,'0')+'.json']);
    const transcriptPath=transcriptNames.map(f=>path.resolve(path.dirname(audio.path),f)).find(p=>fs.existsSync(p));
    if(record.captions){
     const cuesPath=path.resolve(path.dirname(audio.path),record.captions);
     s.cues=json(cuesPath);s.captionTimingBasis='provider transcription timestamps';
    }else if(transcriptPath){
     const transcript=json(transcriptPath);
     if(transcript.audioSha256&&transcript.audioSha256!==sha(fs.readFileSync(input)))throw new Error('ASR audio hash mismatch '+id+' '+(i+1));
     const aligned=alignedCues(s.narration||'',transcript,actual);
     s.cues=aligned.cues;s.captionAlignmentDifferenceRatio=aligned.differenceRatio;
     s.captionTimingBasis='local ASR word timestamps aligned to canonical narration text; automatic estimate, not human-aligned';
     s.transcriptionSha256=sha(fs.readFileSync(transcriptPath));
    }else{
     s.cues=proportionalCues(s.narration||'',actual);s.captionTimingBasis='sentence-length proportional estimate; not word-aligned transcription';
    }
   }
  }
  const plan={id,brand:raw.brand||'SHIFT',title:raw.title,format:raw.format,width:long?1920:1080,height:long?1080:1920,sourceScriptSha256:scriptSha256,audioReady,scenes};
  fs.mkdirSync(path.join(publicDir,'plans'),{recursive:true});writeJson(path.join(publicDir,'plans',id+'.json'),plan);result.push(plan);
 }
 return result;
}
function prepare(){
 fs.mkdirSync(publicDir,{recursive:true});fs.mkdirSync(review,{recursive:true});
 const keys=['night','notebook','letter','book','scissors','classroom','cafe','compass','brand-synk','brand-synk-paper','brand-lab','brand-shift','brand-pulse'];
 const assets=[];
 for(const key of keys){const input=path.join(assetDir,key+'.webp'),dest=path.join(publicDir,key+'.webp');if(!fs.existsSync(input))throw new Error('Missing approved asset '+input);fs.copyFileSync(input,dest);assets.push({key,source:path.relative(repo,input).replace(/\\/g,'/'),sha256:sha(fs.readFileSync(input))});}
 const fonts=json(path.join(videoRoot,'src','킷','폰트벌.json'));
 for(const f of fonts.벌){const a=path.join(repo,'docs','브랜드_폰트',f.정본),b=path.join(videoRoot,'public','폰트',path.basename(f.정본));if(!fs.existsSync(b)||sha(fs.readFileSync(a))!==sha(fs.readFileSync(b)))throw new Error('Shared font absent/stale. Scoped task will not overwrite shared fonts: '+f.정본);}
 for(const[sec,file]of [[30,'BGM_30.wav'],[60,'BGM_60.wav']]){
  const original=path.join(videoRoot,'public','계정별20260909',sec===30?'BGM_산뜻.wav':'BGM_60초.wav');
  if(!fs.existsSync(original))throw new Error('Previously generated original music absent: '+original);
  fs.copyFileSync(original,path.join(publicDir,file));
 }
 const plans=buildPlans();
 writeJson(path.join(review,'영상_원천명세.json'),{at:new Date().toISOString(),assets,fontsVerified:fonts.벌.length,music:{source:'영상/BGM만들기.js',generatorSha256:sha(fs.readFileSync(path.join(videoRoot,'BGM만들기.js'))),reusedFrom:'영상/public/계정별20260909',externalSong:false,humanListening:false},plans:plans.map(x=>({id:x.id,audioReady:x.audioReady,duration:x.scenes.reduce((n,s)=>n+s.durationSec,0)}))});
 console.log('Prepared '+assets.length+' approved assets and '+plans.length+' independent plans.');
}
function plan(id){return json(path.join(publicDir,'plans',id+'.json'));}
function fingerprint(item){
 const files=fs.readdirSync(sourceDir).filter(x=>/\.tsx?$/.test(x)).sort();
 const keys=new Set(item.scenes.map(s=>s.asset).filter(Boolean));
 if(item.id!=='01-lab-youtube'){keys.add('brand-synk');keys.add('brand-'+item.brand.toLowerCase());}
 const assets=[...keys].sort().map(key=>{
  const a=sha(fs.readFileSync(path.join(assetDir,key+'.webp'))),b=sha(fs.readFileSync(path.join(publicDir,key+'.webp')));
  if(a!==b)throw new Error('Stale prepared asset '+key+'; run --prepare');return[key,a,b];
 });
 const audioNames=[item.id==='01-lab-youtube'?'BGM_30.wav':'BGM_60.wav',...item.scenes.map(s=>s.audioFile).filter(Boolean)];
 const {sourceScriptSha256,...renderPlan}=item;
 return sha(JSON.stringify({renderPlan,assets,audio:audioNames.map(f=>[f,sha(fs.readFileSync(path.join(publicDir,f)))]),code:files.map(f=>[f,sha(fs.readFileSync(path.join(sourceDir,f)))]),renderer:sha(fs.readFileSync(__filename)),kit:['색.ts','폰트.ts','폰트벌.json'].map(f=>[f,sha(fs.readFileSync(path.join(videoRoot,'src','킷',f)))]),tokens:sha(fs.readFileSync(path.join(repo,'docs','디자인_토큰.json')))}));
}
function writeCaptions(item){
 let start=0;const cues=[];
 for(const scene of item.scenes){
  if(scene.cues?.length){for(const c of scene.cues)cues.push({...c,startMs:c.startMs+start,endMs:c.endMs+start});}
  else{const text=[scene.title,scene.kr,scene.mn,scene.body,...(scene.lines||[]),scene.tip].filter(Boolean).join('\n')||'[Instrumental music]';cues.push({text,startMs:start,endMs:start+scene.durationSec*1000,timestampMs:null,confidence:null});}
  start+=scene.durationSec*1000;
 }
 const p=srtPath(item.id);fs.mkdirSync(path.dirname(p),{recursive:true});
 fs.writeFileSync(p,cues.map((c,i)=>(i+1)+'\n'+time(c.startMs)+' --> '+time(c.endMs)+'\n'+c.text+'\n').join('\n'),'utf8');
 writeJson(path.join(review,'영상_'+item.id+'_captions.json'),{basis:item.id.startsWith('shift-public-')?'per-scene captionTimingBasis, or screen text if no voice':'approved screen text, not speech transcription',captions:cues});
}
async function capture(item,target){
 const dir=path.join(review,'영상프레임-'+item.id);fs.mkdirSync(dir,{recursive:true});
 let offset=0;const seconds=[];
 for(const s of item.scenes){seconds.push(offset+Math.min(1,s.durationSec/3),offset+s.durationSec*.65);offset+=s.durationSec;}
 if(item.id==='01-lab-youtube')seconds.push(offset-1);
 for(const[i,sec]of seconds.entries())run(ffmpeg,['-y','-v','error','-ss',sec.toFixed(3),'-i',target,'-frames:v','1',path.join(dir,'frame-'+String(i).padStart(2,'0')+'.png')],'extract encoded frame');
 const sharp=require('sharp'),long=item.width===1920,w=long?480:270,h=long?270:480;
 const thumbs=await Promise.all(seconds.map((_,i)=>sharp(path.join(dir,'frame-'+String(i).padStart(2,'0')+'.png')).resize(w,h).png().toBuffer()));
 await sharp({create:{width:w*4,height:h*Math.ceil(seconds.length/4),channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(thumbs.map((input,i)=>({input,left:i%4*w,top:Math.floor(i/4)*h}))).png().toFile(path.join(review,'영상_'+item.id+'_contact.png'));
 return seconds;
}
async function render(item){
 if(item.id==='01-lab-youtube'&&json(scriptPath).items.find(x=>x.id===item.id)?.music){
  run(process.execPath,[path.join(videoRoot,'klofi신작굽기.cjs'),'--prepare'],'prepare current K-LOFI');
  console.log(run(process.execPath,[path.join(videoRoot,'klofi신작굽기.cjs'),'--render'],'current K-LOFI'));return;
 }
 const target=outputPath(item.id),reportPath=path.join(review,'영상_'+item.id+'_검증.json'),fp=fingerprint(item);
 if(args.includes('--resume')&&fs.existsSync(reportPath)&&fs.existsSync(target)){const r=json(reportPath);if(r.renderSourceSha256===fp&&r.videoSha256===sha(fs.readFileSync(target))){console.log('Verified unchanged output retained: '+item.id);return;}}
 if(item.id==='shift-public-class-01'&&!item.audioReady)throw new Error('Public class narration incomplete; short renders can proceed.');
 writeCaptions(item);fs.mkdirSync(path.dirname(target),{recursive:true});
 const start=Date.now();console.log('Rendering '+item.id);
 const log=run(process.execPath,[cli,'render','src/마케팅실행20260909/index.tsx','marketing-'+item.id,target,'--concurrency=2','--codec=h264','--video-bitrate=12M','--audio-bitrate=256k','--color-space=bt709','--overwrite'],item.id);
 fs.writeFileSync(path.join(review,'영상_'+item.id+'_render.log'),log);validateLog(log);
 const stat=fs.statSync(target),media=probe(target),v=media.streams.find(s=>s.codec_type==='video'),a=media.streams.find(s=>s.codec_type==='audio'),duration=item.scenes.reduce((n,s)=>n+s.durationSec,0);
 if(stat.mtimeMs<start-1000||stat.size<100000||v?.width!==item.width||v?.height!==item.height||!a||Math.abs(Number(media.format.duration)-duration)>.15)throw new Error('Invalid/stale media '+item.id);
 const capturedSeconds=await capture(item,target);
 const loudness=run(ffmpeg,['-hide_banner','-i',target,'-vn','-af','loudnorm=I=-16:TP=-1:LRA=11:print_format=json','-c:a','pcm_s16le','-f','null','-'],'measure audio');
 fs.writeFileSync(path.join(review,'영상_'+item.id+'_audio.log'),loudness);
 writeJson(reportPath,{id:item.id,renderedAt:new Date().toISOString(),width:v.width,height:v.height,durationSeconds:Number(media.format.duration),videoCodec:v.codec_name,audioCodec:a.codec_name,bytes:stat.size,scriptSha256:sha(fs.readFileSync(scriptPath)),renderSourceSha256:fp,videoSha256:sha(fs.readFileSync(target)),capturedSeconds,visualInspection:'pending direct encoded-frame inspection',audioMeasurement:'technical measurement; no claim of human listening',captionTiming:item.scenes.map(s=>s.captionTimingBasis||'screen text'),externalPosting:false});
 console.log('Finished '+item.id+': '+duration.toFixed(2)+'s; '+(stat.size/1048576).toFixed(1)+'MiB; '+capturedSeconds.length+' encoded frames.');
}
(async()=>{try{
 if(args.includes('--prepare')){prepare();return;}
 const items=selected.map(plan);
 if(args.includes('--check')){for(const item of items){fingerprint(item);writeCaptions(item);console.log(item.id+': '+item.scenes.length+' scenes, '+item.scenes.reduce((n,s)=>n+s.durationSec,0)+'s, audioReady='+item.audioReady);}return;}
 if(args.includes('--still')){
  const si=args.indexOf('--scene'),sceneIndex=si<0?0:Number(args[si+1]),ti=args.indexOf('--second'),second=ti<0?1:Number(args[ti+1]);
  for(const item of items){if(!item.scenes[sceneIndex]||second<0||second>=item.scenes[sceneIndex].durationSec)throw new Error('Bad preview scene/time');
   const frame=Math.round((item.scenes.slice(0,sceneIndex).reduce((n,s)=>n+s.durationSec,0)+second)*30),target=path.join(review,'영상_'+item.id+'_scene'+(sceneIndex+1)+'_'+second+'s_preview.png');
   const log=run(process.execPath,[cli,'still','src/마케팅실행20260909/index.tsx','marketing-'+item.id,target,'--frame='+frame,'--overwrite'],'still');validateLog(log);console.log(target);
  }return;
 }
 if(!args.includes('--render'))throw new Error('Use --prepare, --check, --still [--scene N], or --render [--resume], optionally --id <id>.');
 for(const item of items)await render(item);
}catch(e){console.error(e.stack||e);process.exitCode=1;}})();
