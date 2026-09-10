'use strict';
// Keep existing six movies and AAC streams; replace only their original logo area.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../../..'),video=path.join(root,'영상'),base=path.join(__dirname,'_검토/로고반영/기존6편');
const {bundle}=require(path.join(video,'node_modules/@remotion/bundler')),{selectComposition,renderMedia,renderStill,openBrowser}=require(path.join(video,'node_modules/@remotion/renderer'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(args)=>{const r=spawnSync('ffmpeg',args,{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr||String(r.error));return r.stdout;};
const audio=p=>run(['-v','error','-i',p,'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).trim();
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
async function main(){
 fs.mkdirSync(base,{recursive:true});const ids=['03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok'];
 const serveUrl=await bundle({entryPoint:path.join(video,'src/firstposts20260910/LogoPlate.tsx'),rootDir:video,publicDir:path.join(__dirname,'_검토/video/public'),outDir:path.join(base,'bundle'),enableCaching:false,webpackOverride:c=>({...c,cache:false})});
 const browserExecutable='C:/Program Files/Google/Chrome/Application/chrome.exe',puppeteerInstance=await openBrowser('chrome',{browserExecutable});
 try{for(const id of ids){
  const input=read(path.join(__dirname,'_검토/video',id,'render-input.json')),prior=path.join(__dirname,id,'video.mp4'),priorHash=sha(prior),proof=read(path.join(__dirname,'_검토/video',id,'verification.json'));
  if(priorHash!==proof.sha256)throw Error('Existing movie changed '+id);if(input.item.scenes.some(s=>['ending','music','music-bridge'].includes(s.layout)))throw Error('Unreviewed scene layout '+id);
  const dir=path.join(base,id);fs.mkdirSync(dir,{recursive:true});save(path.join(dir,'render-input.json'),input);
  const wide=input.item.orientation==='landscape',r=wide?{x:95,y:35,w:360,h:160}:{x:75,y:166,w:370,h:174},plate=path.join(dir,'logo-plate.mp4'),final=path.join(dir,'video.mp4');
  // This crop has only a static background and logo entry/exit. The moving
  // background ornament begins at x=460/1300, entirely outside this crop.
  // Render those 30 prototype frames once, then repeat the exact static frame
  // to match each existing scene length. No footage or speech is retimed.
  const prototypeInput={item:{...input.item,scenes:[{duration:1}]}},prototype=path.join(dir,'prototype.mp4');
  const composition=await selectComposition({serveUrl,id:'FirstPostLogoPlate',inputProps:prototypeInput,browserExecutable,puppeteerInstance});
  await renderMedia({serveUrl,composition,inputProps:prototypeInput,browserExecutable,puppeteerInstance,concurrency:2,outputLocation:prototype,muted:true,codec:'h264',crf:12,pixelFormat:'yuv420p',colorSpace:'bt709',imageFormat:'jpeg',jpegQuality:100,overwrite:true});
  const scenes=input.item.scenes,parts=scenes.map((s,i)=>{const frames=Math.round(s.duration*30);if(frames<30)throw Error('Prototype scene too short');return `[s${i}]loop=loop=${frames-30}:size=1:start=12,setpts=N/(30*TB)[c${i}]`;});
  const graph=`[0:v]split=${scenes.length}${scenes.map((_,i)=>`[s${i}]`).join('')};`+parts.join(';')+';'+scenes.map((_,i)=>`[c${i}]`).join('')+`concat=n=${scenes.length}:v=1:a=0[v]`;
  run(['-y','-v','error','-i',prototype,'-filter_complex',graph,'-map','[v]','-c:v','libx264','-crf','12','-preset','fast','-pix_fmt','yuv420p',plate]);
  run(['-y','-v','error','-i',prior,'-i',plate,'-filter_complex',`[0:v][1:v]overlay=${r.x}:${r.y}:format=auto:eof_action=pass[v]`,'-map','[v]','-map','0:a:0','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',final]);
  if(audio(prior)!==audio(final))throw Error('AAC changed '+id);run(['-v','error','-xerror','-i',final,'-f','null','NUL']);
  for(const sec of [.1,1.8,input.item.scenes[0].duration-.1,input.item.scenes[0].duration+.1])run(['-y','-v','error','-ss',String(sec),'-i',final,'-frames:v','1',path.join(dir,'frame-'+sec.toFixed(2)+'.png')]);
  if(sha(prior)!==priorHash)throw Error('Movie changed during render '+id);
  save(path.join(dir,'verification.json'),{at:new Date().toISOString(),id,sourceSha256:priorHash,sha256:sha(final),audioStreamIdentical:true,audioStreamHash:audio(final),logoRect:r,frames:scenes.reduce((n,s)=>n+Math.round(s.duration*30),0),scope:'Existing six movies with original content, voices, endings and timing. Only the existing FirstScene logo area was composed from approved current logo.',fullDecode:true,visualInspection:'pending',externalPosting:false});
  console.log(id+' candidate verified');
 }}finally{await puppeteerInstance.close({silent:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1});
