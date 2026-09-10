'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const {bundle}=require('@remotion/bundler'),{selectComposition,renderMedia,openBrowser}=require('@remotion/renderer');
const root=path.resolve(__dirname,'..'),base=path.join(root,'docs/홍보물/계정별콘텐츠_20260909'),qa=path.join(base,'_검토/로고반영');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(args)=>{const r=spawnSync('ffmpeg',args,{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr||String(r.error));return r.stdout;};
const audio=p=>run(['-v','error','-i',p,'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).trim();
const probe=p=>JSON.parse(spawnSync('ffprobe',['-v','error','-show_streams','-of','json',p],{windowsHide:true,encoding:'utf8'}).stdout);
async function main(){
 fs.mkdirSync(qa,{recursive:true});const items=read(path.join(base,'콘텐츠원고.json')).items.filter(i=>['03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok'].includes(i.id));
 const serveUrl=await bundle({entryPoint:path.join(__dirname,'src/계정별20260909/LogoPlate.tsx'),rootDir:__dirname,publicDir:path.join(__dirname,'public'),outDir:path.join(qa,'bundle'),enableCaching:false});
 const browserExecutable='C:/Program Files/Google/Chrome/Application/chrome.exe',puppeteerInstance=await openBrowser('chrome',{browserExecutable});
 try{
  const composition=await selectComposition({serveUrl,id:'AccountLogoPlate',browserExecutable,puppeteerInstance}),prototype=path.join(qa,'prototype.mp4');
  await renderMedia({serveUrl,composition,browserExecutable,puppeteerInstance,concurrency:2,outputLocation:prototype,muted:true,codec:'h264',crf:12,pixelFormat:'yuv420p',colorSpace:'bt709',imageFormat:'jpeg',jpegQuality:100,overwrite:true});
  const results=[];
  for(const item of items){
   const id=item.id,prior=path.join(base,id,'video.mp4'),before=sha(prior),dir=path.join(qa,id);fs.mkdirSync(dir,{recursive:true});
   const facts=probe(prior),old=facts.streams.find(s=>s.codec_type==='video'),frames=item.scenes.reduce((n,s)=>n+Math.round(s.duration*30),0);if(Number(old.nb_frames)!==frames)throw Error('Current input duration differs from movie '+id);
   const scenes=item.scenes,plate=path.join(dir,'plate.mp4'),final=path.join(dir,'video.mp4');
   const parts=scenes.map((s,i)=>`[s${i}]loop=loop=${Math.round(s.duration*30)-30}:size=1:start=12,setpts=N/(30*TB)[c${i}]`);
   const graph=`[0:v]split=${scenes.length}${scenes.map((_,i)=>`[s${i}]`).join('')};`+parts.join(';')+';'+scenes.map((_,i)=>`[c${i}]`).join('')+`concat=n=${scenes.length}:v=1:a=0[v]`;
   run(['-y','-v','error','-i',prototype,'-filter_complex',graph,'-map','[v]','-c:v','libx264','-crf','12','-preset','fast','-pix_fmt','yuv420p',plate]);
   run(['-y','-v','error','-i',prior,'-i',plate,'-filter_complex','[0:v][1:v]overlay=95:245:format=auto:eof_action=pass[v]','-map','[v]','-map','0:a:0','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',final]);
   if(audio(final)!==audio(prior))throw Error('AAC changed '+id);if(Number(probe(final).streams.find(s=>s.codec_type==='video').nb_frames)!==frames)throw Error('Frames changed');run(['-v','error','-xerror','-i',final,'-f','null','NUL']);
   for(const sec of [.1,1.8,item.scenes[0].duration-.1,item.scenes[0].duration+.1])run(['-y','-v','error','-ss',String(sec),'-i',final,'-frames:v','1',path.join(dir,'frame-'+sec.toFixed(2)+'.png')]);
   const report={id,beforeSha256:before,sha256:sha(final),frames,audioStreamIdentical:true,audioStreamHash:audio(final),fullDecode:true,crop:{left:95,top:245,width:264,height:152},scope:'Original scene timing, content and division lettering retained. Common SYNK wordmark crop only.',visualInspection:'pending'};
   fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(report,null,2));results.push(report);console.log(id+' candidate ready');
  }
  fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));
 }finally{await puppeteerInstance.close({silent:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1});
