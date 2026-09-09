'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const base=path.dirname(__dirname),report=JSON.parse(fs.readFileSync(path.join(__dirname,'영상_종합기계검증.json'),'utf8'));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']}),page=await browser.newPage(),results=[];
 try{
  await page.goto(pathToFileURL(path.join(base,'공개수업/index.html')).href);
  for(const entry of report.videos){
   const result=await page.evaluate(async url=>{
    const v=document.createElement('video');v.muted=true;v.src=url;document.body.append(v);
    try{return await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('Video decode timed out')),12000);
     v.onerror=()=>{clearTimeout(timer);reject(Error('Video error '+v.error?.code))};
     v.onloadeddata=async()=>{try{await v.play();v.requestVideoFrameCallback(()=>{clearTimeout(timer);resolve({width:v.videoWidth,height:v.videoHeight,duration:v.duration,readyState:v.readyState,frameDecoded:true,muted:true})})}catch(e){clearTimeout(timer);reject(e)}};
    })}finally{v.pause();v.remove()}
   },pathToFileURL(path.join(base,entry.file)).href);
   if(result.width!==entry.width||result.height!==entry.height||!result.frameDecoded)throw Error('Unexpected video '+entry.id);
   results.push({id:entry.id,file:entry.file,sha256:entry.videoSha256,...result});console.log('Decoded '+entry.id);
  }
  fs.writeFileSync(path.join(__dirname,'브라우저영상검증.json'),JSON.stringify({passed:true,count:results.length,scope:'Actual local Chrome video decoding and muted playback; not human listening',results},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
