'use strict';
// Reproducible local preparation and rendering. Does not modify shared Root or approved originals.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{createRequire}=require('module'),{spawnSync}=require('child_process');
const output=__dirname,repo=path.resolve(output,'../../..'),video=path.join(repo,'영상');
const requireVideo=createRequire(path.join(video,'package.json'));
const {bundle}=requireVideo('@remotion/bundler');
const {getCompositions,renderStill,renderMedia,openBrowser}=requireVideo('@remotion/renderer');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const args=process.argv.slice(2),src=path.join(video,'src/shiftProcess20260921'),pub=path.join(video,'public/shift-process-20260921'),staging=path.join(output,'runtime-public');
const cover=path.join(repo,'docs/마케팅/프로필최신화_20260919/커버_펠트글래스_v4');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2));};
const copy=(a,b)=>{fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b);};
const run=(exe,argv)=>{const r=spawnSync(exe,argv,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});if(r.status!==0)throw Error(r.stderr||r.stdout||r.error);return r.stdout;};
async function prepare(){
  fs.mkdirSync(pub,{recursive:true});fs.mkdirSync(path.join(output,'검수'),{recursive:true});
  const originals=[['before.png',path.join(cover,'이전_Behance_공개크롭보정전/shift-behance.png')],['after.png',path.join(cover,'shift-behance.png')],['hero.png',path.join(cover,'shift-pinterest.png')],['felt-dark.webp',path.join(repo,'docs/홍보물/첫게시물_20260910/assets/felt-dark.webp')]];
  const evidence=[];
  for(const [name,file] of originals){copy(file,path.join(pub,name));evidence.push({name,source:file,sha256:sha(file),copiedSha256:sha(path.join(pub,name))});}
  // Remove only the canvas background nodes from the source SVG. All approved content paths/images remain intact.
  const xmlScript='import sys,xml.etree.ElementTree as E\nE.register_namespace("", "http://www.w3.org/2000/svg")\nr=E.parse(sys.argv[1]).getroot()\nfor c in list(r):\n if c.tag.split("}")[-1] in ("rect","image") and c.get("width")=="100%": r.remove(c)\nE.ElementTree(r).write(sys.argv[2],encoding="utf-8",xml_declaration=True)';
  const contentSvg=path.join(pub,'after-content.svg');run('python',['-c',xmlScript,path.join(cover,'shift-behance.svg'),contentSvg]);
  await sharp(contentSvg).extract({left:1050,top:30,width:1520,height:380}).png().toFile(path.join(pub,'after-content.png'));
  evidence.push({name:'after-content.png',source:path.join(cover,'shift-behance.svg'),sha256:sha(path.join(cover,'shift-behance.svg')),method:'Removed only the full-canvas background; extracted x1050 y30 w1520 h380. Content geometry preserved. Used only in explicitly labelled repositioning reconstruction.'});
  for(const entry of fs.readdirSync(pub,{withFileTypes:true})){if(entry.isFile())copy(path.join(pub,entry.name),path.join(staging,'shift-process-20260921',entry.name));}
  const fonts=require(path.join(video,'src/킷/폰트벌.json'));
  for(const f of fonts.벌){const file=path.join(repo,'docs/브랜드_폰트',f.정본);copy(file,path.join(staging,'폰트',path.basename(file)));}
  write(path.join(output,'제작근거.json'),{createdAt:new Date().toISOString(),evidence,record:'docs/마케팅/프로필최신화_20260919/커버_펠트글래스_v4/제작기록.md:61-65',labels:{originals:'수정 전/후 원본 또는 부분 확대',reconstruction:'Scene 05 only: 위치 이동 설명 · 배치 변화 재구성'},failureScreenshotAvailable:false,publicUpload:false});
  const externalIndex=args.indexOf('--timing');const timing=JSON.parse(fs.readFileSync(externalIndex>=0?path.resolve(args[externalIndex+1]):path.join(src,'timing.json')));
  if(timing.audioFile&&!fs.existsSync(path.join(staging,timing.audioFile)))throw Error('Audio not found: '+timing.audioFile);
  let expected=0;for(const scene of timing.scenes){if(scene.start!==expected)throw Error('Timeline gap at '+scene.id);expected+=scene.duration;}if(expected!==timing.durationInFrames)throw Error('Timeline duration mismatch');
  write(path.join(output,'장면타이밍.json'),timing);return timing;
}
async function contactSheet(timing){
  const w=300,h=533,label=44,cols=4,rows=2,canvas=sharp({create:{width:w*cols,height:(h+label)*rows,channels:3,background:'white'}});
  const pieces=[];for(let i=0;i<timing.scenes.length;i++){const s=timing.scenes[i],file=path.join(output,'검수',`scene-${s.id}.png`);pieces.push({input:await sharp(file).resize(w,h).png().toBuffer(),left:(i%cols)*w,top:Math.floor(i/cols)*(h+label)+label});const svg=`<svg width="${w}" height="${label}"><rect width="100%" height="100%" fill="white"/><text x="14" y="29" font-family="Arial" font-size="19" fill="black">${s.id} / ${(s.start/30).toFixed(1)}-${((s.start+s.duration)/30).toFixed(1)}s</text></svg>`;pieces.push({input:Buffer.from(svg),left:(i%cols)*w,top:Math.floor(i/cols)*(h+label)});}await canvas.composite(pieces).png().toFile(path.join(output,'contact-sheet.png'));
}
async function main(){
  const timing=await prepare();if(args.includes('--prepare'))return console.log('Prepared approved assets and timeline');
  const served=await bundle({entryPoint:path.join(src,'entry.tsx'),rootDir:video,publicDir:staging});
  const browser=await openBrowser('chrome');const errors=[];const log=x=>{if(/Failed to load|Failed to fetch|net::ERR_|Error loading|Could not load font/.test(x.text||''))errors.push(x.text);};
  try{
    const comps=await getCompositions(served,{inputProps:{timing},puppeteerInstance:browser,onBrowserLog:log,logLevel:'error'});const composition=comps.find(x=>x.id==='ShiftProcess01');
    if(!args.includes('--video-only')){
      for(const s of timing.scenes){const frame=s.start+Math.min(s.duration-10,Math.round(s.duration*.72));await renderStill({serveUrl:served,composition,inputProps:{timing},frame,output:path.join(output,'검수',`scene-${s.id}.png`),imageFormat:'png',puppeteerInstance:browser,onBrowserLog:log,overwrite:true,logLevel:'error'});console.log('Still '+s.id);}
      await renderStill({serveUrl:served,composition:comps.find(x=>x.id==='ShiftProcessCover'),frame:0,output:path.join(output,'poster.png'),imageFormat:'png',puppeteerInstance:browser,onBrowserLog:log,overwrite:true,logLevel:'error'});await contactSheet(timing);
    }
    if(args.includes('--stills')){if(errors.length)throw Error(errors.join('\n'));return;}
    const outputFile=path.join(output,timing.audioFile?'SHIFT_과정1편_내레이션.mp4':'SHIFT_과정1편_검토용_무음.mp4');let prev=-1;
    await renderMedia({serveUrl:served,composition,inputProps:{timing},outputLocation:outputFile,codec:'h264',pixelFormat:'yuv420p',imageFormat:'jpeg',jpegQuality:100,videoBitrate:'12M',encodingMaxRate:'16M',encodingBufferSize:'24M',audioBitrate:'256k',colorSpace:'bt709',concurrency:2,puppeteerInstance:browser,onBrowserLog:log,overwrite:true,enforceAudioTrack:!!timing.audioFile,logLevel:'error',onProgress:p=>{const percent=Math.floor(p.progress*20)*5;if(percent!==prev){prev=percent;console.log(`Render ${percent}%`);}}});
    if(errors.length)throw Error(errors.join('\n'));
    const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',outputFile]));const v=probe.streams.find(x=>x.codec_type==='video'),a=probe.streams.find(x=>x.codec_type==='audio');
    if(v.width!==1080||v.height!==1920||v.r_frame_rate!=='30/1'||Math.abs(Number(probe.format.duration)-timing.durationInFrames/30)>.15)throw Error('Output spec mismatch');if(!!a!==!!timing.audioFile)throw Error('Audio state mismatch');
    write(path.join(output,'검수/영상규격.json'),{createdAt:new Date().toISOString(),path:outputFile,sha256:sha(outputFile),durationSeconds:probe.format.duration,video:v,audio:a??null,bytes:probe.format.size,browserErrors:errors,state:timing.audioFile?'narrated-video':'silent-review-preview'});console.log(outputFile);
  }finally{await browser.close({silent:true});}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
