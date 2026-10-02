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

function body(scene) {
  let html = text(scene.label || '', 'label muted', at(290));
  html += text(scene.title, 'headline', at(353)+(scene.titleSize?`font-size:${scene.titleSize}px;`:''));
  if(scene.kind==='opening') {
    html += text('메모 → 할 일 표','pullquote',at(950));
    html += text('담당자와 기한까지 정리해 봅니다.','body muted',at(1090));
  } else if(scene.kind==='memo') {
    html += reveal(text('지수 → 문구 수정','pullquote',at(680)),.35);
    html += reveal(text('9월 23일까지','body muted',at(795)),.65);
    html += reveal(text('민호 → 설문 초안','pullquote',at(965)),2.5);
    html += reveal(text('마감 미정','body muted',at(1080)),2.8);
    html += picture(scene);
  } else if(scene.kind==='columns') {
    html += `<div style="${at(675)}">${['할 일','담당자','기한','근거 문장'].map((s,i)=>`<div data-reveal="${.4+i*.85}" class="step-row" style="margin-bottom:18px"><span class="step-num">0${i+1}</span><span class="step-word" style="font-size:76px">${s}</span></div>`).join('')}</div>`;
    html += picture(scene);
  } else if(scene.kind==='rules') {
    html += text('추측하지 말기','pullquote',at(730));
    html += picture(scene);
    html += text('제안은 따로 분리','pullquote',at(1110)+'font-size:66px;');
    html += text('다음 회의일을\n작업 기한으로 쓰지 않기','body muted',at(1275));
  } else if(scene.kind==='result') {
    html += picture(scene);
    html += text('결과 요약','label muted',at(1120));
    html += reveal(text('지수 · 9월 23일','pullquote',at(1190)+'line-height:1.6;font-size:69px;'),.8);
    html += reveal(text('민호 · 확인 필요','pullquote',at(1300)+'line-height:1.6;font-size:69px;'),3.5);
  } else if(scene.kind==='questions') {
    html += text('민호의 마감은 언제?\n인터뷰를 진행할지?','pullquote',at(715)+'font-size:67px;line-height:1.65;');
    html += picture(scene);
    html += text('공유 전, 근거 문장을\n원문과 대조하세요.','body muted',at(1370)+'font-size:37px;');
  } else if(scene.kind==='prompt') {
    html += text(scene.prompt,'prompt prompt-block',at(scene.promptTop||735,78,842));
  } else if(scene.kind==='closing') {
    html += text(scene.prompt,'prompt prompt-block',at(scene.promptTop||705,78,842));
    if(scene.note) html += text(scene.note,'chip',at(scene.noteTop||1330));
  } else {
    html += picture(scene);
    if(scene.note) html += text(scene.note,'chip',at(scene.noteTop||1445));
  }
  if(scene.caption) html += text(scene.caption,'caption',at(scene.captionTop||1470)+(scene.captionSize?`font-size:${scene.captionSize}px;`:''));
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
  if(duration<40 || duration>60)throw new Error('Expected a 40–60 second subtitle edit.');
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
    }
    const coverContent=text('AI 활용 01','label muted',at(435))+text(plan.coverTitle||'회의 메모를\n할 일 표로','giant',at(545)+'font-size:107px;')+
      text('ChatGPT로 담당자·기한 정리','body',at(995))+text('없는 정보는 추측하지 않기','chip',at(1105));
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
    if(scenes[i].kind==='result') finish.push("drawbox=x=718:y=941:w=145:h=60:color=white@0.85:t=3:enable='gte(t,3.5)'");
    finish.push(`fade=t=in:st=0:d=${fadeIn}:color=white`);
    if(i===scenes.length-1)finish.push(`fade=t=out:st=${scenes[i].duration-1}:d=1:color=white`);
    finish.push('format=yuv420p');
    filters.push(`[${previous}]${finish.join(',')}[out]`);
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-filter_complex_threads','2','-loop','1','-framerate','30','-i',path.join(dir,name+'.png'),'-filter_complex',filters.join(';'),'-map','[out]','-frames:v',String(frames),'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','17','-maxrate','16M','-bufsize','24M','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',output]);
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
  const motionTimes=[4.2,5.2,7.4,10.2,11.6,13.6,26.5,30,47.5];
  for(const sec of motionTimes)run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(sec),'-i',final,'-frames:v','1',path.join(dir,`motion-${sec}.png`)]);
  const motionFrames=await Promise.all(motionTimes.map(async(sec,i)=>({input:await sharp(path.join(dir,`motion-${sec}.png`)).resize(270,480).png().toBuffer(),left:(i%3)*270,top:Math.floor(i/3)*480})));
  await sharp({create:{width:810,height:1440,channels:3,background:'#ddd'}}).composite(motionFrames).png().toFile(path.join(dir,'motion-contact-sheet.png'));
  fs.writeFileSync(path.join(dir,'video-metadata.json'),JSON.stringify({status:'subtitle_review_edit_without_voice',createdAt:new Date().toISOString(),width:1080,height:1920,fps:30,duration,bytes:fs.statSync(final).size,sha256:hash(final),sourcePlanSha256:hash(planPath),screenshots:[...new Set(scenes.map(s=>s.asset).filter(Boolean))].map(p=>({path:'../assets/'+p,sha256:hash(path.join(assets,p))})),audioStreams:0,ttsGenerated:false,bgmGenerated:false,externalPosting:false,capturedSeconds:captured,visualInspection:'Pending encoded-frame inspection',qa},null,2)+'\n');
  console.log(JSON.stringify({output:final,duration,bytes:fs.statSync(final).size}));
}

(async()=>{await prepare();if(process.argv.includes('--render')||process.argv.includes('--stills'))await render();})().catch(e=>{console.error(e.stack||e);process.exit(1);});
