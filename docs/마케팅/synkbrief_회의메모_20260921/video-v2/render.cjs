/* Local subtitle review renderer. Reads real browser captures; no TTS or publishing. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {execFileSync} = require('node:child_process');
const runtime = 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium} = require(runtime + 'playwright');
const sharp = require(runtime + 'sharp');
const dir = __dirname;
const base = path.dirname(dir);
const assets = path.join(base, 'assets');
const repo = path.resolve(base, '../../..');
const palette = require(path.join(repo, 'docs/디자인_토큰.json')).색.킷;
const accent = palette.find(c=>c.이름==='Lapis Deep').hex;
const url = p => pathToFileURL(p).href;
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text = (s, cls, style='') => `<div data-text class="${cls}" style="${style}">${escape(s).replaceAll('\n','<br>')}</div>`;
const reveal = (html, start) => html.replace('data-text',`data-text data-reveal="${start}"`);
const at = (top, left=78, width=882) => `position:absolute;top:${top}px;left:${left}px;width:${width}px;`;
const run = (exe, argv) => execFileSync(exe, argv, {windowsHide:true, stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024,encoding:'utf8'});

async function prepare() {
  fs.mkdirSync(dir, {recursive:true});
  fs.mkdirSync(path.join(assets, 'fonts'), {recursive:true});
  const copies = [
    ['docs/브랜드_폰트/SUIT/SUIT-Variable.woff2','fonts/SUIT-Variable.woff2'],
    ['docs/브랜드_폰트/InterTight/InterTight-Medium.ttf','fonts/InterTight-Medium.ttf'],
    ['docs/브랜드_폰트/InterTight/InterTight-Bold.ttf','fonts/InterTight-Bold.ttf'],
  ];
  const provenance = [];
  for (const [source, target] of copies) {
    fs.copyFileSync(path.join(repo,source), path.join(assets,target));
    provenance.push({source,target,sha256:hash(path.join(assets,target))});
  }
  const source = 'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-SHIFT-Ink.png';
  const target = 'synk-shift-ink.png';
  await sharp(path.join(repo,source)).resize({width:1000,withoutEnlargement:true}).png().toFile(path.join(assets,target));
  provenance.push({source,target,sourceSha256:hash(path.join(repo,source)),sha256:hash(path.join(assets,target)),transform:'Proportional resize only, original transparent canvas retained'});
  fs.writeFileSync(path.join(assets,'production-assets.json'),JSON.stringify({preparedAt:new Date().toISOString(),provenance},null,2)+'\n');
  console.log('Prepared local brand fonts and approved SHIFT logo.');
}

function css() {
  return `
  @font-face{font-family:SUIT;src:url('${url(path.join(assets,'fonts/SUIT-Variable.woff2'))}');font-weight:100 900;font-display:block}
  @font-face{font-family:Inter;src:url('${url(path.join(assets,'fonts/InterTight-Medium.ttf'))}');font-weight:400 600;font-display:block}
  @font-face{font-family:Inter;src:url('${url(path.join(assets,'fonts/InterTight-Bold.ttf'))}');font-weight:700 900;font-display:block}
  *{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;background:#fff}article{position:relative;width:1080px;height:1920px;overflow:hidden;background:#fff;color:#000;font-family:Inter,SUIT,sans-serif}
  img{display:block}.headline{font-size:90px;font-weight:800;line-height:1.16;letter-spacing:-3.4px;word-break:keep-all}.body{font-size:43px;font-weight:500;line-height:1.5;letter-spacing:-.8px;word-break:keep-all}.label{font-size:28px;font-weight:600;letter-spacing:.3px}.caption{font-size:41px;font-weight:600;line-height:1.42;letter-spacing:-.6px;word-break:keep-all}.foot{font-size:25px;line-height:1.35;font-weight:500;color:#666}.muted{color:#656565}.prompt{font-size:49px;line-height:1.54;font-weight:600;letter-spacing:-1.1px;word-break:keep-all}.giant{font-size:111px;font-weight:800;line-height:1.22;letter-spacing:-4px}.demo{position:absolute;left:68px;top:680px;width:892px;height:820px;display:flex;align-items:center;justify-content:center;overflow:hidden}.demo img{width:100%;height:100%;object-fit:contain;object-position:center}.pullquote{font-size:74px;line-height:1.26;font-weight:800;letter-spacing:-2.5px;word-break:keep-all}.chip{font-size:35px;line-height:1.4;font-weight:700;color:#264cba}.prompt-block{border-left:6px solid #2e4faf;padding-left:34px}.step-row{display:flex;align-items:baseline;gap:30px;margin-bottom:28px}.step-num{font-size:31px;color:#707070;min-width:44px}.step-word{font-size:92px;font-weight:800;letter-spacing:-3px}
  `;
}

function shell(content, index, total, {cover=false}={}) {
  const header = `<img src="${url(path.join(assets,'synk-shift-ink.png'))}" style="position:absolute;left:76px;top:112px;width:275px;height:76px;object-fit:contain">` + text('synkbrief','label',at(137,740,220)+'text-align:right;');
  const footer = cover ? '' : text(`${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}`,'foot',at(1665,78,120));
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><style>${css()}.chip{color:${accent}}.prompt-block{border:0;padding-left:0}</style><article>${header}${content}${footer}</article></html>`;
}

function picture(scene) {
  const source = path.join(assets,scene.asset || 'demo-result.png');
  if (!fs.existsSync(source)) throw new Error('Actual demonstration screenshot is missing: '+source);
  const t=scene.imageTop??650,h=scene.imageHeight??850;
  return `<div class="demo" style="top:${t}px;height:${h}px"><img src="${url(source)}" style="${scene.imageStyle||''}"></div>`;
}

function shot(asset,top,height,width=882,left=78) {
  return `<img src="${url(path.join(assets,asset))}" style="${at(top,left,width)}height:${height}px;object-fit:contain;object-position:left top;border-radius:16px">`;
}
function body(scene) {
  let html=text(scene.label,'label muted',at(265));
  html+=text(scene.title,'headline',at(330)+'font-size:76px;line-height:1.24;');
  const note=(s,top,delay=0,size=48)=>reveal(text(s,'body',at(top)+`font-size:${size}px;line-height:1.48;`),delay);
  const real=(top)=>text('실제 ChatGPT 화면 · 가상 회의 메모','foot',at(top));
  if(scene.kind==='hook') {
    html+=text('“문구는 제가 수정할게요.”\n“설문 마감은 아직 안 정했어요.”','body muted',at(845)+'font-size:45px;line-height:1.9;');
    html+=note('이 메모를 다시 찾는 시간을 줄여봐요.',1140,3.2,43);
  } else if(scene.kind==='benefit') {
    html+=shot(scene.asset,720,340)+real(1085);
    html+=note('정해진 일은 표로,\n정하지 않은 정보는 확인 질문으로.',1170,.7,47);
  } else if(scene.kind==='prepare') {
    html+=text('① 회의 메모를 복사해 두세요.','body',at(615)+'font-size:44px;');
    html+=shot(scene.asset,710,330,645);
    html+=note('② chatgpt.com의 입력창을 누르세요.',1095,2,43);
    html+=shot('v2/blank-input.png',1200,120,405)+real(1340);
  } else if(scene.kind==='paste') {
    html+=shot(scene.asset,635,550)+real(1210);
    html+=note('입력문은 외우지 않아도 됩니다.',1290,3,44);
  } else if(scene.kind==='replace') {
    html+=text('① 이 안내 문장을 지우고','body',at(620)+'font-size:44px;');
    html+=shot('v2/placeholder.png',710,125,800);
    html+=note('② 같은 자리에 내 메모를 붙여넣어요.',885,2,44);
    html+=shot(scene.asset,985,325,638)+real(1325);
  } else if(scene.kind==='columns') {
    html+=shot(scene.asset,630,100);
    html+=note('할 일    무엇을 하기로 했는지',805,.5,50);
    html+=note('담당자   누가 맡았는지',920,1.5,50);
    html+=note('기한      언제까지인지',1035,2.5,50);
    html+=note('근거      메모의 어떤 말에서 찾았는지',1150,3.5,44);
  } else if(scene.kind==='send') {
    html+=shot(scene.asset,665,135);
    html+=note('요청문 + 회의 메모를\n같은 입력창에서 한 번에 보냅니다.',920,2,49);
    html+=shot('v2/send.png',1195,110)+real(1330);
    html+=`<div style="position:absolute;left:875px;top:1215px;width:70px;height:70px;border:5px solid ${accent};border-radius:50%"></div>`;
  } else if(scene.kind==='compare') {
    html+=shot(scene.asset,625,340)+real(980);
    html+=note('지수: “9월 23일까지” → 9월 23일',1060,.5,43);
    html+=note('민호: “마감은 아직…” → 확인 필요',1190,4.5,43);
  } else if(scene.kind==='date') {
    html+=text('회의 메모','label muted',at(730));
    html+=text('“다음 회의는\n9월 25일 오후 2시예요.”','pullquote',at(800)+'font-size:66px;line-height:1.45;');
    html+=note('회의 일정만 정해진 상태입니다.',1140,2,49);
    html+=note('민호의 마감 → 여전히 확인 필요',1250,3.5,44);
  } else if(scene.kind==='proposal') {
    html+=text('메모: “해보자는 의견만 나왔고,\n진행 여부와 담당자는 미정이에요.”','body',at(640)+'font-size:45px;');
    html+=shot(scene.asset,915,210)+real(1150);
    html+=note('먼저, 인터뷰를 할지 결정해야 해요.',1240,3,47);
  } else if(scene.kind==='finish') {
    html+=text('근거 문장 · 실제 응답','label muted',at(625));
    html+=shot('v2/result-evidence.png',690,390,405);
    html+=text('← 메모에 적힌 말과\n    같은지 확인','body',at(795,520,440)+'font-size:39px;');
    html+=note('그다음 민호에게 물어볼 말',1140,4,40);
    html+=note('“설문 초안, 언제까지 가능할까요?”',1225,5.5,48);
  }
  html+=text(scene.caption,'caption',at(1400)+'font-size:41px;line-height:1.5;');
  return html;
}

function contextBody(scene) {
  let html=text(scene.kind==='paste'?'1 · ChatGPT 화면에서 위치 찾기':'2 · 교체가 끝난 입력창','label muted',at(265));
  html+=text(scene.kind==='paste'?'이 입력창에\n붙여넣으면 됩니다':'요청문과 내 메모가\n함께 들어갔나요?','headline',at(330)+'font-size:70px;line-height:1.24;');
  html+=shot(scene.kind==='paste'?'v2/01-blank.png':'v2/03-filled.png',530,820,480);
  if(scene.kind==='paste') {
    html+=text('← 여기에\n    입력해요','body',at(1220,585,370)+'font-size:45px;');
    html+=`<div style="position:absolute;left:89px;top:1236px;width:438px;height:92px;border:5px solid ${accent};border-radius:28px"></div>`;
  } else {
    html+=text('← 요청문은\n    그대로','body',at(730,585,365)+'font-size:43px;');
    html+=text('← 이 자리만\n    내 메모로','body',at(990,585,365)+'font-size:43px;');
  }
  html+=text(scene.kind==='paste'?'화면을 확대해서 보여드릴게요.':'이제 같은 입력창에서 한 번에 보내면 돼요.','caption',at(1410)+'font-size:40px;');
  return html;
}

async function inspect(page) {
  return page.evaluate(() => ({
    fonts: document.fonts.status,
    fontFaces: [...document.fonts].map(f=>({family:f.family,status:f.status})),
    brokenImages: [...document.images].filter(i=>!i.complete || !i.naturalWidth).map(i=>i.src),
    reveals: [...document.querySelectorAll('[data-reveal]')].map(e=>{const r=e.getBoundingClientRect();return {start:Number(e.dataset.reveal),x:Math.floor(r.x)-3,y:Math.floor(r.y)-3,w:Math.ceil(r.width)+6,h:Math.ceil(r.height)+6};}),
    overflow: [...document.querySelectorAll('[data-text]')].filter(e=>{const r=e.getBoundingClientRect();return r.x<60||r.right>975||r.y<100||r.bottom>(e.classList.contains('foot')?1715:1540)}).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON()})),
  }));
}

async function render() {
  const planPath=path.join(dir,'scenes.json');
  if(!fs.existsSync(planPath)) throw new Error('Create video/scenes.json from the approved scene script first.');
  const plan=JSON.parse(fs.readFileSync(planPath,'utf8').replace(/^\uFEFF/,''));
  const scenes=plan.scenes;
  if(!Array.isArray(scenes)||!scenes.length)throw new Error('No scenes in plan.');
  const duration=scenes.reduce((n,s)=>n+s.duration,0);
  if(duration<85 || duration>120)throw new Error('Expected an 85–120 second detailed tutorial edit.');
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  const qa=[];
  try {
    for(let i=0;i<scenes.length;i++) {
      const s=scenes[i];const name=`scene-${String(i+1).padStart(2,'0')}`;
      const htmlPath=path.join(dir,name+'.html');
      fs.writeFileSync(htmlPath,shell(body(s),i+1,scenes.length));
      await page.goto(url(htmlPath));await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:path.join(dir,name+'.png')});
      const report=await inspect(page);qa.push({scene:i+1,...report});
      if(report.fonts!=='loaded'||report.brokenImages.length||report.overflow.length)throw new Error('Scene QA failed: '+JSON.stringify(qa.at(-1)));
      if(['paste','replace'].includes(s.kind)) {
        const contextPath=path.join(dir,name+'-context.html');
        fs.writeFileSync(contextPath,shell(contextBody(s),i+1,scenes.length));
        await page.goto(url(contextPath));await page.evaluate(()=>document.fonts.ready);
        await page.screenshot({path:path.join(dir,name+'-context.png')});
        const contextQA=await inspect(page);
        if(contextQA.overflow.length||contextQA.brokenImages.length)throw new Error('Context QA failed: '+JSON.stringify(contextQA));
        qa[i].context=contextQA;
      }
    }
    const coverContent=text('회의 후 담당자와 기한이 헷갈린다면','label muted',at(435))+text(plan.coverTitle,'giant',at(545)+'font-size:88px;')+
      text('ChatGPT로 할 일 표 만드는 순서','body',at(995))+text('입력부터 결과 확인까지 따라 해보세요.','chip',at(1105));
    const coverHtml=path.join(dir,'cover.html');fs.writeFileSync(coverHtml,shell(coverContent,0,0,{cover:true}));
    await page.goto(url(coverHtml));await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(dir,'cover.png')});
    const coverQA=await inspect(page);if(coverQA.overflow.length||coverQA.brokenImages.length)throw new Error('Cover QA failed.');
    fs.writeFileSync(path.join(dir,'frame-qa.json'),JSON.stringify({scenes:qa,cover:coverQA},null,2)+'\n');
  } finally {await browser.close();}
  const contact=await Promise.all(scenes.map(async(_,i)=>({input:await sharp(path.join(dir,`scene-${String(i+1).padStart(2,'0')}.png`)).resize(270,480).png().toBuffer(),left:(i%3)*270,top:Math.floor(i/3)*480})));
  await sharp({create:{width:810,height:Math.ceil(scenes.length/3)*480,channels:3,background:'#ddd'}}).composite(contact).png().toFile(path.join(dir,'contact-sheet.png'));
  if(process.argv.includes('--stills')) {console.log('Rendered scene PNGs and cover; video encoding skipped.');return;}
  const clips=[];
  for(let i=0;i<scenes.length;i++) {
    const name=`scene-${String(i+1).padStart(2,'0')}`;const frames=Math.round(scenes[i].duration*30);
    const output=path.join(dir,name+'.mp4');
    // Fade in only the annotated text blocks. The real screenshot pixels stay unchanged.
    const fadeIn=i===0?0.1:0.14;
    const rects=qa[i].reveals;
    const filters=[];
    let previous='0:v';
    if(rects.length){
      filters.push(`[0:v]split=${rects.length+1}[base]${rects.map((_,j)=>`[part${j}]`).join('')}`);
      filters.push(`[base]${rects.map(r=>`drawbox=x=${r.x}:y=${r.y}:w=${r.w}:h=${r.h}:color=white:t=fill`).join(',')}[masked]`);
      previous='masked';
      rects.forEach((r,j)=>{
        filters.push(`[part${j}]crop=${r.w}:${r.h}:${r.x}:${r.y},format=yuva420p,fade=t=in:st=${r.start}:d=0.35:alpha=1[reveal${j}]`);
        filters.push(`[${previous}][reveal${j}]overlay=x=${r.x}:y=${r.y}:shortest=1[mix${j}]`);
        previous=`mix${j}`;
      });
    }
    const finish=[];
    finish.push(`fade=t=in:st=0:d=${fadeIn}:color=white`);
    if(i===scenes.length-1)finish.push(`fade=t=out:st=${scenes[i].duration-1}:d=1:color=white`);
    finish.push('format=yuv420p');
    const contextInput=[];
    if(qa[i].context){
      contextInput.push('-loop','1','-framerate','30','-i',path.join(dir,name+'-context.png'));
      const timing=scenes[i].kind==='paste'?'lt(t,3)':'gte(t,7)';
      filters.push(`[${previous}][1:v]overlay=0:0:enable='${timing}':shortest=1[contextmix]`);previous='contextmix';
    }
    filters.push(`[${previous}]${finish.join(',')}[out]`);
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-filter_complex_threads','2','-loop','1','-framerate','30','-i',path.join(dir,name+'.png'),...contextInput,'-filter_complex',filters.join(';'),'-map','[out]','-frames:v',String(frames),'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','17','-maxrate','16M','-bufsize','24M','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',output]);
    clips.push(output);
  }
  fs.writeFileSync(path.join(dir,'concat.txt'),clips.map(p=>`file '${p.replaceAll('\\','/').replaceAll("'","'\\''")}'`).join('\n')+'\n');
  const final=path.join(dir,'synkbrief-01-meeting-tasks.mp4');
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(dir,'concat.txt'),'-c','copy','-movflags','+faststart',final]);
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',final,'-vf','scale=720:1280','-an','-c:v','libvpx-vp9','-row-mt','1','-threads','2','-deadline','realtime','-cpu-used','6','-crf','28','-b:v','0',path.join(dir,'preview.webm')]);
  const media=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',final]));
  const stream=media.streams.find(x=>x.codec_type==='video');
  if(stream.width!==1080||stream.height!==1920||stream.avg_frame_rate!=='30/1'||Math.abs(Number(media.format.duration)-duration)>.12||media.streams.some(x=>x.codec_type==='audio'))throw new Error('Encoded video metadata failed.');
  let start=0;const captured=[];
  for(let i=0;i<scenes.length;i++) {const sec=start+Math.min(2,scenes[i].duration/2);start+=scenes[i].duration;captured.push(sec);run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(sec),'-i',final,'-frames:v','1',path.join(dir,`encoded-frame-${i+1}.png`)]);}
  const motionTimes=[.7,20,24,31,37,41,51,64,90];
  for(const sec of motionTimes)run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(sec),'-i',final,'-frames:v','1',path.join(dir,`motion-${sec}.png`)]);
  const motionFrames=await Promise.all(motionTimes.map(async(sec,i)=>({input:await sharp(path.join(dir,`motion-${sec}.png`)).resize(270,480).png().toBuffer(),left:(i%3)*270,top:Math.floor(i/3)*480})));
  await sharp({create:{width:810,height:1440,channels:3,background:'#ddd'}}).composite(motionFrames).png().toFile(path.join(dir,'motion-contact-sheet.png'));
  fs.writeFileSync(path.join(dir,'video-metadata.json'),JSON.stringify({status:'subtitle_review_edit_without_voice',createdAt:new Date().toISOString(),width:1080,height:1920,fps:30,duration,bytes:fs.statSync(final).size,sha256:hash(final),sourcePlanSha256:hash(planPath),screenshots:[...new Set(scenes.map(s=>s.asset).filter(Boolean))].map(p=>({path:'../assets/'+p,sha256:hash(path.join(assets,p))})),audioStreams:0,ttsGenerated:false,bgmGenerated:false,externalPosting:false,capturedSeconds:captured,visualInspection:'Pending encoded-frame inspection',qa},null,2)+'\n');
  console.log(JSON.stringify({output:final,duration,bytes:fs.statSync(final).size}));
}

(async()=>{await prepare();if(process.argv.includes('--render')||process.argv.includes('--stills'))await render();})().catch(e=>{console.error(e.stack||e);process.exit(1);});
