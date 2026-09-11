'use strict';
// 독립 영상 진입점. 공용 Root·자동 생성 자산·엔진 로직은 변경하지 않는다.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const {bundle}=require('@remotion/bundler');
const {getCompositions,renderStill,renderMedia,openBrowser}=require('@remotion/renderer');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const repo=path.resolve(__dirname,'..'),src=path.join(__dirname,'src/특허원리20260912');
const qa=path.join(repo,'tools/patent-studio/qa-output');
const output=process.env.SYNK_ENGINE_VIDEO_OUTPUT||'C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/원리영상_20260912';
const pub=path.join(qa,'engine-video-public');
const args=process.argv.slice(2),fps=30;
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2));};
const copy=(from,to)=>{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);};
const run=(exe,argv)=>{const r=spawnSync(exe,argv,{encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024});if(r.status!==0)throw Error((r.stderr||r.stdout||'').slice(-4000));return r.stdout;};
function clock(frame){const ms=Math.round(frame/fps*1000),s=Math.floor(ms/1000);return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;}
async function prepare(){
  fs.mkdirSync(pub,{recursive:true});fs.mkdirSync(path.join(output,'검수'),{recursive:true});
  const text=JSON.parse(fs.readFileSync(path.join(src,'script.json')));
  const audioDir=path.join(qa,'engine-video-audio');
  const manifestPath=path.join(audioDir,fs.existsSync(path.join(audioDir,'manifest.current.json'))?'manifest.current.json':'manifest.json');
  const speech=JSON.parse(fs.readFileSync(manifestPath));
  const records=[];let start=0;const scenes=[],subtitles=[];
  for(const scene of text.scenes){
    let t=Math.round(.5*fps),runtimeStart;const cues=[];
    const ids=scene.lines.map((_,i)=>scene.id+String.fromCharCode(97+i));if(scene.sample)ids.unshift('sample');
    for(const id of ids){
      const a=speech.scenes.find(s=>s.id===id);if(!a)throw Error('음성 누락 '+id);
      if(scene.id==='14'&&id==='14b'){runtimeStart=t;t+=Math.round(.8*fps);}
      if(scene.id==='14'&&id==='14c')t=Math.max(t,runtimeStart+16*fps+Math.round(.15*fps));
      const file=`audio/${id}.mp3`,from=path.isAbsolute(a.file)?a.file:path.join(audioDir,a.file);copy(from,path.join(pub,file));
      const duration=Math.ceil(a.durationSeconds*fps);
      const cue={text:a.text,file,start:t,duration,sample:id==='sample'};cues.push(cue);
      records.push({kind:'narration',id,source:from,sha256:sha(from),durationSeconds:a.durationSeconds});
      subtitles.push({start:start+t,end:start+t+duration,text:(id==='sample'?'[설명용 예시 발화] ':'')+a.text});
      t+=duration+Math.round(.27*fps);
    }
    const duration=t+Math.round(1.1*fps);scenes.push({id:scene.id,start,duration,cues,...(runtimeStart!==undefined?{runtimeStart}:{})});start+=duration;
  }
  const timeline={fps,durationInFrames:start,durationSeconds:start/fps,scenes};
  write(path.join(src,'timeline.json'),timeline);write(path.join(output,'장면타이밍.json'),timeline);
  write(path.join(output,'자막.srt'),subtitles.map((v,i)=>`${i+1}\n${clock(v.start)} --> ${clock(v.end)}\n${v.text}\n`).join('\n'));
  copy(path.join(src,'script.json'),path.join(output,'제작대본.json'));
  copy(path.join(qa,'video-story.md'),path.join(output,'화면구성안.md'));
  const fonts=require('./src/킷/폰트벌.json');for(const font of fonts.벌){const from=path.join(repo,'docs/브랜드_폰트',font.정본),to=path.join(pub,'폰트',path.basename(font.정본));copy(from,to);records.push({kind:'font',source:from,sha256:sha(from),copiedSha256:sha(to)});}
  const m=require('../tools/lib/마스코트자산.js');for(const [name,mood] of [['궁금함','curious'],['집중','focus'],['안도','relief']]){
    const from=m.절대경로(name,{누끼:true}),to=path.join(pub,`mascot-${mood}.webp`);await sharp(from).resize(1000,1000,{fit:'inside'}).webp({quality:95,alphaQuality:100}).toFile(to);records.push({kind:'mascot',source:from,sourceSha256:sha(from),derivative:to,sha256:sha(to)});
  }
  const logo=path.join(repo,'tools/patent-studio/public/assets/logo.webp');copy(logo,path.join(pub,'logo.webp'));records.push({kind:'logo',source:logo,sha256:sha(logo)});
  // 고정 시드의 옅은 종이 섬유. 본문·로고·마스코트에는 재질을 덧씌우지 않는다.
  const tokens=require('../docs/디자인_토큰.json');const ink=tokens.색.킷.find(c=>c.이름==='Ink').hex;
  let seed=527;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const paths=Array.from({length:1050},()=>{const x=rand()*300,y=rand()*300;return `<path d="M${x.toFixed(2)} ${y.toFixed(2)}l${(rand()*2.5).toFixed(2)} ${(rand()*.7).toFixed(2)}"/>`;}).join('');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><g fill="none" stroke="${ink}" stroke-width=".7" opacity=".65">${paths}</g></svg>`)).png().toFile(path.join(pub,'paper-grain.png'));
  const runtimeDir=path.join(qa,'engine-video-runtime');
  const preferred=['clip-focus.mp4','clip-hq.mp4','clip.mp4'].map(f=>path.join(runtimeDir,f)).find(fs.existsSync);
  if(!preferred)throw Error('실제 UI 영상 누락');
  copy(preferred,path.join(pub,'runtime-clip.mp4'));records.push({kind:'actual local UI controlled fixture',source:preferred,sha256:sha(preferred)});
  copy(path.join(runtimeDir,'metadata-hq.json'),path.join(output,'실제시연근거.json'));
  write(path.join(output,'제작근거.json'),{created:new Date().toISOString(),engineCoreSHA256:sha(path.join(repo,'tools/patent-studio/core.cjs')),records,scope:'Local controlled examples; not student outcomes or production integration.'});
  console.log(`준비 완료: ${scenes.length}장면 · ${(start/fps).toFixed(2)}초`);return timeline;
}
async function main(){
  const t=await prepare();if(args.includes('--prepare'))return;
  const served=await bundle({entryPoint:path.join(src,'index.tsx'),rootDir:__dirname,publicDir:pub});
  const browser=await openBrowser('chrome');const errors=[];
  const log=entry=>{if(/Failed to load|Failed to fetch|net::ERR_|Error loading|Could not load font/.test(entry.text||''))errors.push(entry.text);};
  try{
    const [composition]=await getCompositions(served,{puppeteerInstance:browser,onBrowserLog:log,logLevel:'error'});
    if(!args.includes('--video-only')){
      for(const scene of t.scenes){const frame=scene.start+Math.min(scene.duration-20,Math.round(scene.duration*.62));await renderStill({serveUrl:served,composition,frame,output:path.join(output,'검수',`scene-${scene.id}.png`),imageFormat:'png',puppeteerInstance:browser,onBrowserLog:log,overwrite:true,logLevel:'error'});console.log('화면 '+scene.id);}
      await renderStill({serveUrl:served,composition,frame:80,output:path.join(output,'표지.png'),imageFormat:'png',puppeteerInstance:browser,onBrowserLog:log,overwrite:true,logLevel:'error'});
    }
    if(args.includes('--stills')){if(errors.length)throw Error(errors.join('\n'));return;}
    let last=-1;
    const out=path.join(output,'펠트 엔진_한 문장이 기록되는 과정.mp4');
    await renderMedia({serveUrl:served,composition,outputLocation:out,codec:'h264',pixelFormat:'yuv420p',imageFormat:'jpeg',jpegQuality:95,videoBitrate:'9M',encodingMaxRate:'13M',encodingBufferSize:'20M',audioBitrate:'256k',colorSpace:'bt709',concurrency:2,puppeteerInstance:browser,onBrowserLog:log,overwrite:true,enforceAudioTrack:true,logLevel:'error',onProgress:p=>{const pc=Math.floor(p.progress*20)*5;if(pc!==last){last=pc;console.log(`영상 ${pc}%`);}}});
    if(errors.length)throw Error(errors.join('\n'));
    const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',out]));
    const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
    if(v.width!==1920||v.height!==1080||v.r_frame_rate!=='30/1'||!a||Math.abs(Number(probe.format.duration)-t.durationSeconds)>.15)throw Error('최종 규격 불일치');
    write(path.join(output,'검수/영상규격.json'),{path:out,sha256:sha(out),video:v,audio:a,duration:probe.format.duration,bytes:probe.format.size,browserErrors:errors});console.log(out);
  }finally{await browser.close({silent:true});}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
