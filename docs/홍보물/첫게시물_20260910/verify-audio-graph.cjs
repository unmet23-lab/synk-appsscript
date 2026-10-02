'use strict';
// Narrow equivalence check: official composition exports, decoded PCM bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),video=path.join(root,'영상'),qa=path.join(__dirname,'_검토/02-나머지일관화/오디오경로검증');
const {selectComposition,renderMedia,openBrowser}=require(path.join(video,'node_modules/@remotion/renderer'));
const browserExecutable='C:/Program Files/Google/Chrome/Application/chrome.exe';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:null,windowsHide:true,maxBuffer:32*1024**2});if(r.error||r.status)throw Error(String(r.stderr||r.error));return r.stdout;};
async function main(){
 fs.mkdirSync(qa,{recursive:true});
 const input=path.join(__dirname,'_검토/02-나머지일관화/최종후보/03-lab-tiktok/검증/render-input.json'),inputProps=read(input),serveUrl=path.join(__dirname,'_검토/video/bundle');
 const browser=await openBrowser('chrome',{browserExecutable});const results=[];
 try{for(const id of ['FirstPost','FirstPostAudio']){
  const composition=await selectComposition({serveUrl,id,inputProps,browserExecutable,puppeteerInstance:browser}),output=path.join(qa,id+'.wav'),started=Date.now();
  await renderMedia({serveUrl,composition,inputProps,browserExecutable,puppeteerInstance:browser,concurrency:2,frameRange:[0,599],outputLocation:output,codec:'wav',sampleRate:48000,overwrite:true});
  const pcm=run('ffmpeg',['-v','error','-i',output,'-map','0:a','-c:a','pcm_f32le','-f','f32le','pipe:1']);
  results.push({composition:id,seconds:(Date.now()-started)/1000,wavSha256:sha(fs.readFileSync(output)),pcmSha256:sha(pcm),pcmBytes:pcm.length});
 }}finally{await browser.close({silent:true});}
 if(results[0].pcmSha256!==results[1].pcmSha256||results[0].pcmBytes!==results[1].pcmBytes)throw Error('Shared audio graph PCM mismatch');
 const report={checkedAt:new Date().toISOString(),scope:'03 first600 frames including bed, approved mascot sound, Korean example; both public compositions use identical FilmAudio',inputSha256:sha(fs.readFileSync(input)),sourceSha256:sha(fs.readFileSync(path.join(video,'src/firstposts20260910/FilmAudio.tsx'))),results,identicalDecodedPCM:true,impliesHumanListening:false};
 fs.writeFileSync(path.join(qa,'결과.json.pending'),JSON.stringify(report,null,2));fs.renameSync(path.join(qa,'결과.json.pending'),path.join(qa,'결과.json'));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
