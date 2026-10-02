'use strict';
/** New local-only video production. Never writes outside this directory.
 * No Remotion/npx/install: locally installed browser + existing Loom modules + FFmpeg.
 * Editorial Canvas overlay. No Ken Burns, duplicated motion code or old QA video.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const {once}=require('node:events');
const {stripTypeScriptTypes}=require('node:module');
const ROOT=path.resolve(__dirname,'../../../..'),OUT=__dirname;
const MODULES='C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(MODULES,'playwright'));
const sharp=require(path.join(MODULES,'sharp'));
const FFMPEG='C:/Users/q1212/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const FFPROBE=path.join(path.dirname(FFMPEG),'ffprobe.exe');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const fps=30,width=1080,height=1920,LOOM='http://127.0.0.1:4319/';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=new Map();
function read(rel,mime){const b=fs.readFileSync(path.join(ROOT,rel));sources.set(rel,{path:rel,sha256:digest(b),bytes:b.length});return mime?`data:${mime};base64,${b.toString('base64')}`:b.toString('utf8');}
function target(rel){const p=path.resolve(OUT,rel);if(!p.startsWith(OUT+path.sep))throw new Error('Outside video ownership');return p;}
function write(rel,body){const p=target(rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);}
function run(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(r.stderr||r.error||'command failed');return r.stdout;}
function stamp(ms){const n=Math.round(ms),h=Math.floor(n/3600000),m=Math.floor(n/60000)%60,s=Math.floor(n/1000)%60;return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+','+String(n%1000).padStart(3,'0');}
async function kit(){
  // Invoke the current kit's actual color guard, with TypeScript stripped in memory.
  const t=read('docs/디자인_토큰.json');
  const code=read('영상/src/킷/색.ts').replace(/import 토큰 from [^;]+;/,`const 토큰 = ${t};`);
  const k=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code,{mode:'transform'})).toString('base64'));
  read('영상/src/킷/폰트.ts');const f=JSON.parse(read('영상/src/킷/폰트벌.json'));
  const fontDefs=f.벌.filter(x=>(x.family===f.가족.한글체&&['400','500','600','800'].includes(x.weight))||(x.family===f.가족.라틴체&&['400','500','600','700'].includes(x.weight))).map(x=>({...x,uri:read('docs/브랜드_폰트/'+x.정본,x.정본.endsWith('.otf')?'font/otf':'font/ttf')}));
  // Mono roles are authorized by the current font canon, outside the older video font table.
  read('docs/브랜드_폰트_정본.md');
  for(const [weight,file] of [['500','DMMono-Medium.ttf'],['300','DMMono-Light.ttf']])fontDefs.push({family:'DM Mono',weight,정본:'DM_Mono/'+file,uri:read('docs/브랜드_폰트/DM_Mono/'+file,'font/ttf')});
  if(fontDefs.length!==10)throw new Error('Current font table does not match required weights');
  const placement=JSON.parse(read('docs/홍보물/마케팅실행_20260909/브랜드킷/배치명세.json'));
  const logos={};for(const variant of ['Ink','Paper']){const p=placement.items.find(x=>x.brand==='SHIFT'&&x.variant===variant);const rel='docs/홍보물/마케팅실행_20260909/브랜드킷/'+p.file;logos[variant]={...p,uri:read(rel,'image/png')};if(sources.get(rel).sha256!==p.sha256)throw new Error('Approved logo drift');}
  return {colors:{paper:k.색('Paper'),ink:k.색('Ink'),oat:k.색('Oat'),deep:k.색('Ink Deep'),muted:k.색('Deep Wool'),stone:k.색('Stone'),blue:k.색('Lapis Deep')},fontDefs,fontFamily:f.가족.한글체,logos,paperTexture:read('docs/Loom_자산/구움/펠트_종이바탕.webp','image/webp'),darkTexture:read('docs/Loom_자산/구움/펠트_어두운판.webp','image/webp')};
}
function audio(video){
  // New non-speech accompaniment, not a mascot voice or UI event sound.
  const rate=48000,count=Math.round(rate*video.duration),pcm=Buffer.alloc(count*4);
  const notes=video.id==='yuho'?[130.8128,195.9977,220,164.8138]:[146.8324,220,246.9417,195.9977];
  let peak=0,sum=0;
  for(let i=0;i<count;i++){
    const t=i/rate,bar=Math.floor(t/7.5),phase=t%7.5;
    const freq=notes[bar%notes.length];
    const fade=Math.min(1,t/2.5,(video.duration-t)/3.5);
    const env=Math.pow(Math.sin(Math.PI*phase/7.5),2)*Math.max(0,fade);
    // Two soft partials and a quiet fifth; no rhythmic clicks or voice formants.
    const v=.095*env*(Math.sin(2*Math.PI*freq*t)+.26*Math.sin(2*Math.PI*freq*2*t)+.12*Math.sin(2*Math.PI*freq*1.5*t))/1.38;
    const l=v*.97,r=v*.97;peak=Math.max(peak,Math.abs(v));sum+=v*v;
    pcm.writeInt16LE(Math.round(l*32767),i*4);pcm.writeInt16LE(Math.round(r*32767),i*4+2);
  }
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  write(video.file+'.wav',Buffer.concat([header,pcm]));return {sampleRate:rate,channels:2,peakDbfs:20*Math.log10(peak),rmsDbfs:20*Math.log10(Math.sqrt(sum/count)),synthesis:'New local sine accompaniment; no voice, no reused sample; fade in 2.5s / out 3.5s',listeningVerified:false};
}
async function preparePage(browser,design,videos){
  const page=await browser.newPage({viewport:{width:1080,height:760},deviceScaleFactor:1});
  const network=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))return route.continue();network.push(u.origin);return route.abort();});
  await page.goto(LOOM,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.loomScene?.ready);
  // Display-only changes in this isolated renderer; source files stay untouched.
  await page.addStyleTag({content:'html,body{width:1080px!important;height:760px!important;overflow:hidden!important}#experience{padding:0!important;max-width:none!important}.masthead,.below,footer,.scene-top,.scene-bottom,.dialogue,.loading,.fallback,.fallback-mongle{display:none!important}#garden{position:absolute!important;inset:0!important;width:1080px!important;height:760px!important;min-height:0!important;max-height:none!important;border-radius:0!important}'});
  await page.evaluate(async({design,videos})=>{
    const core=await import('/engine/loom-scene.mjs');
    const loom=window.loomScene,source=document.querySelector('#world');loom.capture(0);loom.renderer.resize();
    const fonts=[];for(const f of design.fontDefs){const face=new FontFace(f.family,`url(${f.uri})`,{weight:f.weight});await face.load();document.fonts.add(face);fonts.push({family:f.family,weight:f.weight,status:face.status});}
    const img=async(uri)=>{const x=new Image();x.src=uri;await x.decode();return x;};
    const paper=await img(design.paperTexture),dark=await img(design.darkTexture),logos={Ink:await img(design.logos.Ink.uri),Paper:await img(design.logos.Paper.uri)};
    const c=document.createElement('canvas');c.width=1080;c.height=1920;const ctx=c.getContext('2d',{alpha:false});
    const C=design.colors,F=design.fontFamily,checks=[],poses=[];let current=null,elapsed=0,state=null;
    function runs(s,size,weight,mono=false){
      return [...s].reduce((a,ch)=>{const isKo=/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(ch);const family=isKo?F:(mono?'DM Mono':'Inter Tight');const w=isKo?weight:(mono?(ch==='/'?300:500):Math.min(700,weight));const last=a.at(-1);if(last&&last.family===family&&last.weight===w)last.text+=ch;else a.push({text:ch,family,weight:w});return a;},[]).map(r=>{ctx.font=`${r.weight} ${size}px "${r.family}"`;ctx.letterSpacing=(mono?size*.02:size*(weight>=800?-.04:-.02))+'px';return {...r,width:ctx.measureText(r.text).width};});
    }
    function text(lines,x,y,size,weight,color,leading=1.28,maxWidth=928,mono=false){ctx.fillStyle=color;ctx.textBaseline='alphabetic';lines.forEach((s,i)=>{const parts=runs(s,size,weight,mono),width=parts.reduce((n,r)=>n+r.width,0);if(width>maxWidth)throw new Error('Text overflow '+s+': '+width);let dx=x;for(const r of parts){ctx.font=`${r.weight} ${size}px "${r.family}"`;ctx.letterSpacing=(mono?size*.02:size*(weight>=800?-.04:-.02))+'px';ctx.fillText(r.text,dx,y+i*size*leading);dx+=r.width;}checks.push({text:s,x,y:y+i*size*leading,fontSize:size,fontWeight:weight,width,runs:parts});});}
    function texture(img,opacity){ctx.globalAlpha=opacity;ctx.drawImage(img,0,0,1080,1920);ctx.globalAlpha=1;}
    function reset(id){const v=videos.find(x=>x.id===id);loom.capture(v.clockOffset);state=loom.state;current=id;elapsed=0;return v;}
    function draw(id,frame,format='image/jpeg'){
      const v=videos.find(x=>x.id===id),t=frame/30;if(current!==id||t<elapsed)reset(id);
      while(elapsed<t-1e-8){const dt=Math.min(1/120,t-elapsed);core.stepScene(state,dt,{pointer:{x:0,y:0,active:false,pressed:false}});elapsed+=dt;}
      const pose=core.getScenePose(state);loom.renderer.render(pose);
      const s=v.scenes.find(x=>t>=x.start&&t<x.end)||v.scenes.at(-1);checks.length=0;
      ctx.fillStyle=s.ending?C.deep:C.paper;ctx.fillRect(0,0,1080,1920);texture(s.ending?dark:paper,s.ending?.70:.34);
      if(s.ending){
        const logo=logos.Paper;ctx.drawImage(logo,76,306,472,472*logo.height/logo.width);
        text(['개인과 조직의 성장이','서로의 기회가 되는','미래를 만듭니다.'],76,955,67,600,C.paper,1.43);
        text([v.handle],76,1638,35,400,C.stone);
      } else {
        text([v.channel],76,178,34,600,C.muted);text(s.head,76,303,80,800,C.ink,1.22);
        // Fixed full garden viewport. No simulated camera move or global exposure edit.
        ctx.drawImage(source,0,454,1080,760);
        ctx.fillStyle=C.oat;ctx.fillRect(0,1214,1080,104);
        text(['실제 로컬 장면 · 현재 Loom에서 새로 캡처'],76,1279,29,400,C.muted);
        if(s.detail){
          // A fixed explanatory magnifier from THIS rendered frame, not a fabricated UI.
          ctx.fillStyle=C.paper;ctx.fillRect(60,880,454,290);
          ctx.drawImage(source,515,352,300,152,76,945,422,214);
          text(['같은 프레임 · 눈 주변 확대'],76,922,26,600,C.muted,1.2,422);
        }
        text([s.tag],76,1390,33,600,C.blue);
        text(s.lines,76,1488,43,500,C.ink,1.55);
        ctx.fillStyle=C.stone;ctx.fillRect(76,1620,928,1);
        text([v.handle],76,1670,32,400,C.muted);
        const count=String(v.scenes.indexOf(s)+1).padStart(2,'0')+' / 07';text([count],850,1670,28,500,C.muted,1.2,154,true);
      }
      if(frame%30===0||pose.blink>.47)poses.push({id,frame,time:t,detail:!!s.detail,sceneTime:pose.time,wind:pose.wind,gust:pose.gustEnvelope,blink:pose.blink,lookX:pose.lookX,lookY:pose.lookY,camera:loom.renderer.stats.camera});
      return {data:c.toDataURL(format,1).split(',')[1],pose:{time:pose.time,wind:pose.wind,blink:pose.blink},texts:[...checks]};
    }
    window.videoStage={canvas:c,draw,reset,fonts,poses,snapshot:()=>loom.snapshot()};
  },{design,videos});
  return {page,network,errors};
}
async function main(){
  const previewOnly=process.argv.includes('--preview'),select=process.argv.find(x=>x.startsWith('--only='))?.split('=')[1];
  for(const rel of ['AGENTS.md','docs/AI_운영원칙.md','DESIGN.md','docs/Loom_실시간장면_표현기준.md','docs/비전_정본.md','docs/브랜드_사운드킷/_사운드킷.md','experiences/loom-living/scene.mjs','experiences/loom-living/scene.json','experiences/loom-living/environment.json','experiences/loom-living/provenance.json','tools/lib/loom-scene.mjs','tools/lib/loom-scene-webgl.mjs','영상/package.json','영상/package-lock.json','docs/홍보물/새첫게시물_20260914/유호/게시문.md','docs/홍보물/새첫게시물_20260914/유호/실물/픽셀대조.json','docs/홍보물/새첫게시물_20260914/브리핑/게시문.md'])read(rel);
  for(const rel of ['experiences/loom-living/assets/garden.webp','experiences/loom-living/assets/mongle.webp','experiences/loom-living/assets/mongle-closed.webp'])read(rel,'image/webp');
  for(const name of ['원고.cjs','만들기.cjs','검증.cjs'])read(path.relative(ROOT,path.join(OUT,name)).replace(/\\/g,'/'));
  const design=await kit();const {loadVisions,sourceDigest}=require(path.join(ROOT,'tools/lib/비전정본.js'));const vision=loadVisions().shift.headline;
  if(['개인과 조직의 성장이','서로의 기회가 되는','미래를 만듭니다.'].join(' ')!==vision)throw new Error('Vision linebreak mapping stale');
  const videos=require('./원고.cjs')(vision).filter(x=>!select||x.id===select);
  write('story.json',JSON.stringify({vision,videos},null,2)+'\n');
  const manifest={createdAt:new Date().toISOString(),status:previewOnly?'preview-only':'rendering',width,height,fps,officialVision:vision,visionDigest:sourceDigest(),externalTransferBytes:0,newPaidCalls:0,newCharges:0,installedPackages:0,publicPosted:false,oldVideoReused:false,method:'Current Loom core+WebGL in isolated local Chrome -> new deterministic 30fps frames -> FFmpeg libx264 / AAC. Current Remotion packages declared but absent; no npx/download invoked.',fonts:design.fontDefs.map(({uri,...x})=>x),sources:[],videos:[]};
  const browser=await chromium.launch({executablePath:CHROME,headless:true});
  try {
    const {page,network,errors}=await preparePage(browser,design,videos);
    for(const v of videos){
      const captions=v.scenes.map(s=>({text:[...s.head,...s.lines].join('\n'),startMs:s.start*1000,endMs:s.end*1000,timestampMs:null,confidence:null}));
      write(v.file+'.captions.json',JSON.stringify(captions,null,2)+'\n');write(v.file+'.srt',captions.map((c,i)=>`${i+1}\n${stamp(c.startMs)} --> ${stamp(c.endMs)}\n${c.text}\n`).join('\n'));
      write(v.file+'-게시문.md','# '+v.title+'\n\n'+v.post+'\n');write(v.file+'-대체설명.md','# '+v.title+' · 대체 설명\n\n'+v.alt+'\n\n## 읽기용 자막\n\n'+captions.map(c=>`${stamp(c.startMs)} — ${stamp(c.endMs)}\n\n${c.text}\n`).join('\n'));
      const audioInfo=audio(v),keys=[];
      const times=[.5,2,8,14,20,27,33,v.duration-3];
      for(const t of times){const fr=Math.round(t*fps);const r=await page.evaluate(({id,fr})=>window.videoStage.draw(id,fr,'image/png'),{id:v.id,fr});const b=Buffer.from(r.data,'base64');const stem=`qa/${v.id}-${String(fr).padStart(4,'0')}`;write(stem+'.png',b);await sharp(b).resize({width:390}).png().toFile(target(stem+'-390.png'));keys.push({frame:fr,time:t,file:stem+'.png',mobile:stem+'-390.png',texts:r.texts,pose:r.pose});}
      console.log(v.id+': preview keyframes done');
      if(!previewOnly){
        const args=['-y','-hide_banner','-loglevel','warning','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-i',target(v.file+'.wav'),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-r',String(fps),'-fps_mode','cfr','-c:a','aac','-b:a','192k','-ar','48000','-t',String(v.duration),'-movflags','+faststart',target(v.file+'.mp4')];
        const proc=spawn(FFMPEG,args,{windowsHide:true,stdio:['pipe','ignore','pipe']});let stderr='';proc.stderr.on('data',b=>stderr+=b);proc.stdin.on('error',e=>console.error('encoder stdin',String(e)));const done=once(proc,'close');
        await page.evaluate(id=>window.videoStage.reset(id),v.id);
        const start=Date.now();
        for(let fr=0;fr<v.duration*fps;fr++){
          const r=await page.evaluate(({id,fr})=>window.videoStage.draw(id,fr),{id:v.id,fr});const b=Buffer.from(r.data,'base64');
          if(!proc.stdin.write(b))await once(proc.stdin,'drain');
          if(fr%150===0)console.log(`${v.id}: ${fr}/${v.duration*fps} frames; ${Math.round((Date.now()-start)/1000)}s wall`);
        }
        proc.stdin.end();const [code]=await done;if(code!==0)throw new Error('FFmpeg '+code+' '+stderr);write(`qa/${v.id}-ffmpeg.txt`,stderr||'Encoder completed without warning.\n');
        // Include an actual closed-eye frame, especially during the fixed magnifier.
        const blinks=await page.evaluate(id=>window.videoStage.poses.filter(p=>p.id===id&&p.blink>.47),v.id);
        const detailBlink=blinks.filter(p=>p.detail).sort((a,b)=>b.blink-a.blink)[0]||blinks.sort((a,b)=>b.blink-a.blink)[0];
        if(!detailBlink)throw new Error('No actual closed-eye frame captured');
        const blinkImage=await page.evaluate(({id,fr})=>window.videoStage.draw(id,fr,'image/png'),{id:v.id,fr:detailBlink.frame});
        write(`qa/${v.id}-blink.png`,Buffer.from(blinkImage.data,'base64'));
        await sharp(Buffer.from(blinkImage.data,'base64')).resize({width:390}).png().toFile(target(`qa/${v.id}-blink-390.png`));
        keys.push({frame:detailBlink.frame,time:detailBlink.frame/fps,file:`qa/${v.id}-blink.png`,pose:detailBlink});
        // Extract from the encoded delivery, not just the pre-encode canvas.
        for(const key of keys){const p=key.file.replace('.png','-encoded.png');run(FFMPEG,['-y','-hide_banner','-loglevel','error','-ss',String(key.time),'-i',target(v.file+'.mp4'),'-frames:v','1',target(p)]);await sharp(target(p)).resize({width:390}).png().toFile(target(p.replace('.png','-390.png')));key.encoded=p;}
      }
      const stat=previewOnly?null:JSON.parse(run(FFPROBE,['-v','error','-show_streams','-show_format','-of','json',target(v.file+'.mp4')]));
      manifest.videos.push({id:v.id,title:v.title,file:v.file+'.mp4',duration:v.duration,frames:v.duration*fps,clockOffset:v.clockOffset,audio:audioInfo,keys,probe:stat,mp4Sha256:previewOnly?null:digest(fs.readFileSync(target(v.file+'.mp4'))),captions:v.file+'.srt',description:v.file+'-대체설명.md',post:v.file+'-게시문.md'});
    }
    write('qa/새프레임-동작기록.json',JSON.stringify({poses:await page.evaluate(()=>window.videoStage.poses),snapshot:await page.evaluate(()=>window.videoStage.snapshot()),fonts:await page.evaluate(()=>window.videoStage.fonts),errors,blockedExternalRequests:network},null,2)+'\n');
    if(errors.length||network.length)throw new Error('Unexpected browser error/network '+JSON.stringify({errors,network}));
    manifest.status=previewOnly?'preview-only':'encoded-local-unpublished';
  } finally {await browser.close();}
  manifest.sources=[...sources.values()];manifest.sourceChanges=manifest.sources.filter(s=>digest(fs.readFileSync(path.join(ROOT,s.path)))!==s.sha256);
  if(manifest.sourceChanges.length)throw new Error('Read-only source changed during capture');
  write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  const c=design.colors;
  const fontCss=design.fontDefs.map(f=>`@font-face{font-family:'${f.family}';src:url('${f.uri}');font-weight:${f.weight};font-display:block}`).join('')+'body{word-break:keep-all;overflow-wrap:anywhere}';
  write('index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>새 첫 숏폼 · 유호와 SYNK Brief</title><style>${fontCss}body{background:${c.paper};color:${c.ink};margin:0;padding:32px;font-family:'Inter Tight','SUIT',sans-serif;font-synthesis:none;font-weight:500}main{max-width:1140px;margin:auto}h1{font-size:30px}h1,h2{font-weight:600}p{line-height:1.6}.videos{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px}video{display:block;width:100%;max-height:80vh;background:${c.deep}}a{color:inherit}article{min-width:0}small{color:${c.muted}}</style><main><h1>두 가지 시선으로 기록한, 하나의 실제 작업</h1><p>현재 Loom에서 새로 렌더한 국소 움직임. 1080×1920 · 30fps · 로컬 제작 / 미게시.<br>말소리·캐릭터 음성 없음. 배경음은 이번 영상용으로 로컬 합성했습니다. 청취 검증은 별도 기록을 확인하세요.</p><div class="videos">${manifest.videos.map(v=>`<article><h2>${v.title}</h2><video controls playsinline preload="metadata" poster="${v.keys[0].encoded||v.keys[0].file}"><source src="${v.file}" type="video/mp4"></video><p>${v.duration}초 · <a href="${v.post}">게시문</a> · <a href="${v.captions}" download>자막 SRT</a> · <a href="${v.description}">읽기용 대체 설명</a></p></article>`).join('')}</div><p><a href="README.md">제작 범위와 재현</a> · <a href="검증결과.md">검증 결과</a> · <a href="manifest.json">원천·출력 기록</a></p></main></html>`);
  // Show the verified poster without a transient loading spinner on the mascot.
  write('index.html',fs.readFileSync(target('index.html'),'utf8').replaceAll('preload="metadata"','preload="none"'));
  console.log('DONE '+manifest.status+'; '+manifest.sources.length+' unchanged source files');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
