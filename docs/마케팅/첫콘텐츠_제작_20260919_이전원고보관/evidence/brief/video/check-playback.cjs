const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:540,height:960},deviceScaleFactor:1});
 const html=path.join(__dirname,'playback-check.html');
 fs.writeFileSync(html,'<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:white}video{display:block;width:540px;height:960px}</style><video id="v" src="preview-silent.mp4" muted playsinline></video>');
 await page.goto(pathToFileURL(html).href);
 const result=await page.evaluate(async()=>{
  const v=document.querySelector('video');let presented=0;
  function count(){presented++;if(!v.ended)v.requestVideoFrameCallback(count)}
  v.requestVideoFrameCallback(count);
  const started=performance.now();
  await v.play();
  await new Promise((resolve,reject)=>{v.onended=resolve;v.onerror=()=>reject(new Error(String(v.error?.code)));setTimeout(()=>reject(new Error('playback timeout')),55000)});
  return {ended:v.ended,currentTime:v.currentTime,duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.code||null,playbackRate:v.playbackRate,elapsedSeconds:(performance.now()-started)/1000,presentedFrames:presented,quality:v.getVideoPlaybackQuality().toJSON?.()||{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames}};
 });
 await page.screenshot({path:path.join(__dirname,'playback-last-frame.png')});
 fs.writeFileSync(path.join(__dirname,'playback-qa.json'),JSON.stringify(result,null,2));
 await browser.close();console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
