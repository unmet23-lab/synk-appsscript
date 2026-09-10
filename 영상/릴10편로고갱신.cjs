'use strict';
// Update the fixed header only in the current ten encoded reels; source cards are rendered again.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process'),sharp=require('sharp');
const {bundle}=require('@remotion/bundler'),{getCompositions,renderStill,openBrowser}=require('@remotion/renderer');
const root=path.resolve(__dirname,'..'),base=path.join(root,'docs/홍보물/릴10편_20260909'),qa=path.join(base,'검사/로고반영');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(args)=>{const r=spawnSync('ffmpeg',args,{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr||String(r.error));return r.stdout;};
const audio=p=>run(['-v','error','-i',p,'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).trim();
const probe=p=>JSON.parse(spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p],{encoding:'utf8',windowsHide:true}).stdout);
async function main(){
 fs.mkdirSync(qa,{recursive:true});const tokens=read(path.join(root,'docs/디자인_토큰.json')),paper=tokens.색.킷.find(c=>c.이름===tokens.색.시맨틱.라이트.바탕).hex;
 const logo=path.join(root,'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-LAB-Ink.png'),panel=path.join(qa,'logo-panel.png');
 await sharp(logo).resize(242,90,{fit:'contain',position:'left',background:paper}).flatten({background:paper}).png().toFile(panel);
 const reels=read(path.join(base,'대본.json')).reels,records=[];
 for(const r of reels){
  const target=path.join(base,'영상',r.id+'.mp4'),before=sha(target),prior=read(path.join(base,'검사',r.id+'.json'));if(prior.videoHash!==before)throw Error('Existing reel differs from verification '+r.id);
  const final=path.join(qa,r.id+'.mp4'),facts=probe(target),old=facts.streams.find(s=>s.codec_type==='video'),oldAudio=audio(target);
  run(['-y','-v','error','-i',target,'-i',panel,'-filter_complex','[0:v][1:v]overlay=72:110:format=auto[v]','-map','[v]','-map','0:a:0','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',final]);
  const current=probe(final).streams.find(s=>s.codec_type==='video');if(current.nb_frames!==old.nb_frames||current.duration!==old.duration||audio(final)!==oldAudio)throw Error('Timeline/audio changed '+r.id);run(['-v','error','-xerror','-i',final,'-f','null','NUL']);
  run(['-y','-v','error','-ss','1.8','-i',final,'-frames:v','1',path.join(qa,r.id+'-frame.png')]);
  records.push({id:r.id,beforeSha256:before,sha256:sha(final),frames:Number(current.nb_frames),duration:Number(current.duration),audioStreamIdentical:true,audioStreamHash:oldAudio,fullDecode:true});console.log(r.id+' logo candidate verified');
 }
 const served=await bundle({entryPoint:path.join(__dirname,'src/릴10편/index.tsx'),rootDir:__dirname,publicDir:path.join(__dirname,'out/릴10편_사용자산'),outDir:path.join(qa,'bundle'),enableCaching:false});
 const browserExecutable='C:/Program Files/Google/Chrome/Application/chrome.exe',puppeteerInstance=await openBrowser('chrome',{browserExecutable});let stills=0;
 try{const compositions=await getCompositions(served,{browserExecutable,puppeteerInstance});for(const c of compositions.filter(c=>c.id.includes('-cover')||c.id.includes('-resource-'))){
  const dir=c.id.includes('-cover')?'표지':'제공자료';await renderStill({serveUrl:served,composition:c,browserExecutable,puppeteerInstance,output:path.join(base,dir,c.id+'.png'),imageFormat:'png',overwrite:true});stills++;
 }}finally{await puppeteerInstance.close({silent:true});}
 fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify({at:new Date().toISOString(),logoSha256:sha(logo),crop:{left:72,top:110,width:242,height:90},records,stills,scope:'Existing ten movies, audio and scene timing; fixed logo header only. Covers and gift pages re-rendered from unchanged source.',visualInspection:'pending',externalPosting:false},null,2));
 console.log(JSON.stringify({videos:records.length,stills}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
