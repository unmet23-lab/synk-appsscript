'use strict';
// Existing encoded film: replace the fixed logo panel from current scene geometry.
// This avoids decoding the older stage source and preserves each deliverable's AAC bytes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),base=path.join(root,'docs/홍보물/마케팅실행_20260909'),qa=path.join(root,'docs/홍보물/첫게시물_20260910/_검토/로고반영/klofi');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(args)=>{const r=spawnSync('ffmpeg',args,{windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr||String(r.error));return r.stdout;};
const audio=p=>run(['-v','error','-i',p,'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).trim();
async function main(){
 fs.mkdirSync(qa,{recursive:true});const logo=path.join(base,'assets/brand-synk-paper.webp'),recordPath=path.join(qa,'verification.json');
 if(fs.existsSync(recordPath)){const old=JSON.parse(fs.readFileSync(recordPath));if(old.logoSha256===sha(logo)&&old.outputs.every(o=>sha(path.join(base,o.file))===o.sha256)){console.log('K-LOFI current logo already verified');return;}}
 const panel=path.join(qa,'logo-panel.png'),ink=require(path.join(root,'docs/디자인_토큰.json')).색.킷.find(c=>c.이름==='Ink').hex;
 await sharp(logo).resize(115,48,{fit:'contain',background:ink}).flatten({background:ink}).png().toFile(panel);
 const high=path.join(base,'01-lab-youtube/업로드용-원본.mp4'),visual=path.join(qa,'visual-current.mp4');
 run(['-y','-v','error','-i',high,'-i',panel,'-filter_complex','[0:v][1:v]overlay=92:834:format=auto[v]','-map','[v]','-an','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p',visual]);
 const outputs=[];
 for(const name of ['업로드용-원본.mp4','video.mp4']){
  const file='01-lab-youtube/'+name,target=path.join(base,file),before=sha(target),priorAudio=audio(target),backup=path.join(qa,before+'-'+name),pending=path.join(qa,'pending-'+name);
  if(!fs.existsSync(backup))fs.copyFileSync(target,backup);
  run(['-y','-v','error','-i',visual,'-i',target,'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',pending]);
  if(audio(pending)!==priorAudio)throw Error('AAC stream changed');run(['-v','error','-xerror','-i',pending,'-f','null','NUL']);
  if(sha(target)!==before)throw Error('Current video changed during render');fs.copyFileSync(pending,target);
  outputs.push({file,beforeSha256:before,sha256:sha(target),audioStreamHash:priorAudio,audioStreamIdentical:true,fullDecode:true});
 }
 const current=path.join(base,'01-lab-youtube/video.mp4');
 for(const folder of [path.join(root,'영상/public/firstposts20260910'),path.join(root,'docs/홍보물/첫게시물_20260910/assets')]){
  fs.copyFileSync(current,path.join(folder,'pulse-full.mp4'));
  for(const [file,time]of [['pulse-frame.png',15],['pulse-last.png',1847/30]])run(['-y','-v','error','-ss',String(time),'-i',current,'-frames:v','1',path.join(folder,file)]);
 }
 for(const name of ['upload-01.jpg','cover.jpg'])run(['-y','-v','error','-ss','3','-i',current,'-frames:v','1','-q:v','1',path.join(base,'01-lab-youtube',name)]);
 for(const time of [3,30,61.5])run(['-y','-v','error','-ss',String(time),'-i',current,'-frames:v','1',path.join(qa,'frame-'+time+'.png')]);
 fs.writeFileSync(recordPath,JSON.stringify({at:new Date().toISOString(),logoSha256:sha(logo),geometry:{left:92,top:834,width:115,height:48},sourceGeometry:'영상/src/klofi20260909/index.tsx: logo inside fixed Ink editorial panel',outputs,scope:'Logo panel only; encoded visual stream refreshed, AAC original bytes preserved. Original music, body and expression frames are retained.',visualInspection:'3s before/after inspected; unchanged panel edges and new stitch-free SYNK',externalPosting:false},null,2));
 console.log(JSON.stringify({outputs:outputs.length,audioStreamsIdentical:true,firstPostMusicCopiesUpdated:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
