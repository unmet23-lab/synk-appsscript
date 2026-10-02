'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const output=__dirname,repo=path.resolve(output,'../../..'),video=path.join(repo,'영상'),src=path.join(video,'src/yuhoJourney01'),staging=path.join(output,'runtime-public'),assetDir=path.join(staging,'yuho-journey-01'),review=path.join(output,'검수');
const requireVideo=createRequire(path.join(video,'package.json'));
const {bundle}=requireVideo('@remotion/bundler');
const {getCompositions,renderStill,renderMedia,openBrowser}=requireVideo('@remotion/renderer');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const args=new Set(process.argv.slice(2));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const copy=(a,b)=>{fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b);};
const write=(p,v)=>fs.writeFileSync(path.join(output,p),JSON.stringify(v,null,2)+'\n');
const run=(exe,argv)=>{const r=spawnSync(exe,argv,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr||r.error||exe);return r.stdout;};
async function prepare(){
  fs.mkdirSync(assetDir,{recursive:true});fs.mkdirSync(review,{recursive:true});
  const assets=[['receipt.png','docs/마케팅/yuhobuilds_제작여정_202607-20260922/근거/결제내역/claude-first-payment-20260602.png'],['felt-dark.webp','docs/홍보물/첫게시물_20260910/assets/felt-dark.webp'],['narration.wav','docs/마케팅/yuhobuilds_1편_20260922/audio/narration-master.wav']];
  const evidence=[];for(const [name,relative] of assets){const source=path.join(repo,relative),target=path.join(assetDir,name);copy(source,target);evidence.push({name,source:relative,sha256:sha(source),copiedSha256:sha(target)});}
  for(const font of require(path.join(video,'src/킷/폰트벌.json')).벌){const file=path.join(repo,'docs/브랜드_폰트',font.정본);copy(file,path.join(staging,'폰트',path.basename(file)));}
  const timing=JSON.parse(fs.readFileSync(path.join(output,'장면타이밍.json'),'utf8'));
  const captions=JSON.parse(fs.readFileSync(path.join(output,'captions.json'),'utf8'));
  let end=0;for(const scene of timing.scenes){if(scene.start!==end||scene.duration<1)throw Error('Timeline gap or invalid duration '+scene.id);end+=scene.duration;}
  if(end!==timing.durationInFrames)throw Error('Timeline mismatch');
  for(let i=0;i<captions.length;i++){const c=captions[i];if(c.endMs<=c.startMs||c.startMs<0||c.endMs>end/timing.fps*1000||(i&&c.startMs<captions[i-1].endMs))throw Error('Caption timing mismatch at '+i);}
  write('제작근거.json',{createdAt:new Date().toISOString(),sources:evidence,story:'../yuhobuilds_제작여정_202607-20260922/시작_사용자회고_20260922.md',narration:'원고.md',disclosure:'유호의 실제 경험을 바탕으로 일부 대사와 장면을 재구성했습니다.',recreatedScreens:'Conceptual visual explanations, not original June application or chat screenshots.',publicUpload:false});
  return {timing,captions};
}
async function contactSheet(scenes){
  for(let page=0;page<Math.ceil(scenes.length/10);page++){
    const chunk=scenes.slice(page*10,page*10+10),w=216,h=384,label=36,cols=5,rows=Math.ceil(chunk.length/cols),pieces=[];
    for(let i=0;i<chunk.length;i++){const s=chunk[i],x=i%cols*w,y=Math.floor(i/cols)*(h+label);pieces.push({input:await sharp(path.join(review,'scene-'+s.id+'.png')).resize(w,h).png().toBuffer(),left:x,top:y+label});pieces.push({input:Buffer.from(`<svg width="${w}" height="${label}"><rect width="100%" height="100%" fill="white"/><text x="8" y="24" font-size="17" font-family="Arial">${s.id} / ${(s.start/30).toFixed(1)}s</text></svg>`),left:x,top:y});}
    await sharp({create:{width:w*cols,height:(h+label)*rows,channels:3,background:'white'}}).composite(pieces).png().toFile(path.join(output,'contact-sheet-'+(page+1)+'.png'));
  }
}
async function main(){
  const inputProps=await prepare();if(args.has('--prepare')){console.log('Assets and narration timeline ready.');return;}
  const serveUrl=await bundle({entryPoint:path.join(src,'entry.tsx'),rootDir:video,publicDir:staging});
  const browser=await openBrowser('chrome');const errors=[];
  const logger=x=>{if(/Failed to load|Failed to fetch|net::ERR_|Error loading|Could not load font/.test(x.text||''))errors.push(x.text);};
  try{
    const comps=await getCompositions(serveUrl,{inputProps,puppeteerInstance:browser,onBrowserLog:logger,logLevel:'error'});
    const found=comps.find(c=>c.id==='YuhoJourney01');if(!found)throw Error('Missing composition YuhoJourney01');
    const composition={...found,durationInFrames:inputProps.timing.durationInFrames,fps:30,width:1080,height:1920};
    if(!args.has('--video-only')){
      let selected=inputProps.timing.scenes;
      if(args.has('--quick-stills'))selected=selected.filter(s=>['01','02','06','11','14','16','19'].includes(s.id));
      for(const scene of selected){await renderStill({serveUrl,composition,inputProps,frame:scene.start+Math.min(scene.duration-2,Math.round(scene.duration*.6)),output:path.join(review,'scene-'+scene.id+'.png'),imageFormat:'png',puppeteerInstance:browser,onBrowserLog:logger,overwrite:true,logLevel:'error'});console.log('Still '+scene.id);}
      const cover=comps.find(c=>c.id==='YuhoJourney01Cover');if(cover)await renderStill({serveUrl,composition:cover,inputProps,frame:0,output:path.join(output,'poster.png'),imageFormat:'png',puppeteerInstance:browser,onBrowserLog:logger,overwrite:true,logLevel:'error'});
      await renderStill({serveUrl,composition,inputProps,frame:composition.durationInFrames-3,output:path.join(review,'ending.png'),imageFormat:'png',puppeteerInstance:browser,onBrowserLog:logger,overwrite:true,logLevel:'error'});
      if(!args.has('--quick-stills'))await contactSheet(inputProps.timing.scenes);
    }
    if(args.has('--stills')||args.has('--quick-stills')){if(errors.length)throw Error(errors.join('\n'));return;}
    const filename=path.join(output,'yuhobuilds_EP01.mp4');let prev=-1;
    await renderMedia({serveUrl,composition,inputProps,outputLocation:filename,codec:'h264',pixelFormat:'yuv420p',imageFormat:'jpeg',jpegQuality:95,videoBitrate:'9M',encodingMaxRate:'14M',encodingBufferSize:'20M',audioBitrate:'256k',colorSpace:'bt709',concurrency:3,puppeteerInstance:browser,onBrowserLog:logger,enforceAudioTrack:true,overwrite:true,logLevel:'error',onProgress:p=>{const pct=Math.floor(p.progress*20)*5;if(pct!==prev){prev=pct;console.log('Render '+pct+'%');}}});
    if(errors.length)throw Error(errors.join('\n'));
    const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',filename]));
    const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
    if(v?.width!==1080||v?.height!==1920||v?.r_frame_rate!=='30/1'||!a||Math.abs(Number(probe.format.duration)-composition.durationInFrames/30)>.12)throw Error('Export specification mismatch');
    run('ffmpeg',['-v','error','-i',filename,'-f','null','-']);
    write('검수/영상규격.json',{createdAt:new Date().toISOString(),path:filename,sha256:sha(filename),bytes:Number(probe.format.size),durationSeconds:Number(probe.format.duration),video:v,audio:a,browserErrors:errors,fullDecodePassed:true});
    console.log('Master ready: '+filename);
  }finally{await browser.close({silent:true});}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
