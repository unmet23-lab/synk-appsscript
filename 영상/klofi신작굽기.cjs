'use strict';
// One music film only. No stream/server/SNS mutation. Canonical approved assets stay untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),collection=path.join(root,'docs/홍보물/마케팅실행_20260909');
const publicDir=path.join(__dirname,'public/klofi20260909'),review=path.join(collection,'_검토/klofi-v5');
const ff='ffmpeg',probeExe='ffprobe'; // Installed full build: bundled Remotion binary omits audio filters.
const args=process.argv.slice(2),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const run=(exe,argv)=>{const r=spawnSync(exe,argv,{cwd:__dirname,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});if(r.status!==0)throw Error((r.stderr||r.error||'').toString().slice(-6000));return (r.stdout||'')+(r.stderr||'')};
const write=(p,value)=>fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n');
fs.mkdirSync(publicDir,{recursive:true});fs.mkdirSync(review,{recursive:true});
function prepare(){
 const stage=path.join(root,'docs/라디오/무대영상/추석_나무고정_조명_20260909.mp4');
 if(hash(stage)!=='dcc5a8fef2e5efd9c0611166f53fac32846e16fb14f2d81a68a3c6d403ff3dfa')throw Error('Approved v4 stage changed');
 const song=path.join('C:/Users/q1212/Downloads','오늘 밤 제일 환한 사람.wav');
 if(hash(song)!=='d087776d60e2b24593c081fba689cd85ddbb17ab6ca8479aea4c264b0ba3910d')throw Error('Source track changed');
 fs.copyFileSync(stage,path.join(publicDir,'stage-v4.mp4'));
 // Preserve the complete source and its -15 LUFS level. Only 40ms edge de-click fades.
 run(ff,['-v','error','-y','-i',song,'-af','afade=t=in:st=0:d=0.04,afade=t=out:st=61.56:d=0.04','-ar','48000','-c:a','pcm_s16le',path.join(publicDir,'song.wav')]);
 run(process.execPath,[path.join(__dirname,'klofi경계준비.cjs'),'--out',publicDir]);
 const manifest=json(path.join(publicDir,'경계-source.json')),files={};
 const names={본체:'기본',눈감음:'깜빡',눈웃음:'눈웃음',궁금함:'궁금함',집중:'집중',안도:'안도',응원:'응원',놀람:'놀람'};
 for(const key of Object.keys(names))files[names[key]]='dj-'+key+'.png';
 const rhythm=require(path.join(root,'bots/오버레이/라디오표정리듬.js')).만들기({seed:20260909});
 const faces=Array.from({length:1848},(_,f)=>rhythm.읽기(f*1000/30,{밤:false,가능표정:Object.keys(files)}).표정);
 const logo=path.join(collection,'assets/brand-synk-paper.webp');fs.copyFileSync(logo,path.join(publicDir,'synk-paper.webp'));
 // Exact grounding from the deployed after-마스코트.html, not the in-progress wardrobe UI.
 const groundingSource=path.join(root,'docs/_ops/라디오생동_20260909/털고정/after-마스코트.html');
 if(hash(groundingSource)!=='64e3c25efc30375e999be983da7e6295de01108f8b7de0e676f44e32412da983')throw Error('Approved grounding snapshot changed');
 const shadow={bottom:'20.6%',color:'rgba(58,38,24,0.66)'};
 write(path.join(publicDir,'plan.json'),{title:'오늘 밤 제일 환한 사람',duration:61.6,faces,files,shadow});
 write(path.join(review,'grounding.json'),{source:path.relative(root,groundingSource),sha256:hash(groundingSource),shadow,body:{left:652.8,bottom:94.5,width:614.4,height:614.4,translateY:'-4.17%'},wholeBodyOpacity:1,blur:false});
 write(path.join(review,'source.json'),{at:new Date().toISOString(),stage:{path:path.relative(root,stage),sha256:hash(stage),nativeSize:[1280,720],approved:'v4'},song:{path:song,sha256:hash(song),duration:61.6,edit:'whole source; edge-only40ms fades; no speed/pitch change/no crossfade to next song'},dj:manifest,rhythmSha256:hash(path.join(root,'bots/오버레이/라디오표정리듬.js')),faces:[...new Set(faces)],logoSha256:hash(logo),renderSize:[1920,1080],liveStreamChanged:false});
 console.log('Prepared complete 61.6s source track, approved v4 stage and 8 verified DJ sprites.');
}
if(args.includes('--prepare')){prepare();process.exit(0)}
const cli=path.join(__dirname,'node_modules/@remotion/cli/remotion-cli.js'),entry='src/klofi20260909/index.tsx';
if(args.includes('--still')){
 const second=Number(args[args.indexOf('--still')+1]||3),target=path.join(review,'preview-'+second+'.png');
 console.log(run(process.execPath,[cli,'still',entry,'klofi-full-track',target,'--frame='+Math.round(second*30),'--overwrite']));process.exit(0);
}
if(!args.includes('--render')&&!args.includes('--finish'))throw Error('Use --prepare, --still <second>, --render or --finish');
const master=path.join(review,'klofi-master.mp4');
if(!args.includes('--finish')){
const log=run(process.execPath,[cli,'render',entry,'klofi-full-track',master,'--concurrency=2','--codec=h264','--video-bitrate=12M','--audio-bitrate=256k','--color-space=bt709','--overwrite']);
fs.writeFileSync(path.join(review,'render.log'),log);if(/Failed to load|net::ERR_|Could not load font/.test(log))throw Error('Render resource error');
}
const upload=path.join(collection,'01-lab-youtube/업로드용-원본.mp4');
run(ff,['-v','error','-y','-i',master,'-i',path.join(publicDir,'song.wav'),'-map','0:v:0','-map','1:a:0','-t','61.6','-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart',upload]);
const final=path.join(collection,'01-lab-youtube/video.mp4');
// Efficient delivered H.264 derivative, same pixels/duration, full music; master is retained.
run(ff,['-v','error','-y','-i',master,'-i',path.join(publicDir,'song.wav'),'-map','0:v:0','-map','1:a:0','-t','61.6','-c:v','libx264','-crf','23','-preset','medium','-c:a','aac','-b:a','192k','-movflags','+faststart',final]);
const media=JSON.parse(run(probeExe,['-v','error','-show_format','-show_streams','-of','json',final]));
const video=media.streams.find(x=>x.codec_type==='video'),audio=media.streams.find(x=>x.codec_type==='audio');
if(video.width!==1920||video.height!==1080||!audio||Math.abs(Number(media.format.duration)-61.6)>.05)throw Error('Output spec mismatch');
run(ff,['-v','error','-i',final,'-f','null','-']);
const poster=path.join(collection,'01-lab-youtube/upload-01.jpg');
run(ff,['-v','error','-y','-i',upload,'-vf','select=eq(n\\,90)','-frames:v','1','-q:v','1',poster]);
fs.copyFileSync(poster,path.join(collection,'01-lab-youtube/cover.jpg'));
const audioLog=run(ff,['-hide_banner','-i',final,'-vn','-af','loudnorm=I=-16:TP=-1:LRA=11:print_format=json','-f','null','-']);
fs.writeFileSync(path.join(review,'audio.log'),audioLog);
const times=[0,3,7,12,16,20,29.967,30,35,38,42,50,58,59.967,60,61.5];
for(const sec of times)run(ff,['-v','error','-y','-i',final,'-vf',`select=eq(n\\,${Math.round(sec*30)})`,'-frames:v','1',path.join(review,'frame-'+sec+'.png')]);
write(path.join(review,'render.json'),{at:new Date().toISOString(),masterSha256:hash(master),uploadSha256:hash(upload),videoSha256:hash(final),bytes:fs.statSync(final).size,duration:Number(media.format.duration),width:video.width,height:video.height,audio:audio.codec_name,extractedSeconds:times,fullDecode:'pass',visualQA:'pending',humanListening:false,externalPosting:false});
console.log('Rendered '+final+' ('+fs.statSync(final).size+' bytes).');
