/* Silent review edit only. Six evidence-led scenes; no API calls or publication. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const runtime='C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(runtime+'playwright'),sharp=require(runtime+'sharp');
const dir=__dirname,repo=path.resolve(dir,'../../../../../..');
const fontRoot=path.join(repo,'docs/브랜드_폰트');
const url=p=>pathToFileURL(p).href;
const sourceLogo=path.join(repo,'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Ink.png');
const sourceFont=path.join(fontRoot,'SUIT/SUIT-Variable.woff2');
const src=name=>url(path.resolve(dir,'..',name));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const txt=(s,cls,style='')=>`<div data-text class="${cls}" style="${style}">${esc(s).replaceAll('\n','<br>')}</div>`;
const asset=(name,style='',cls='')=>`<img class="${cls}" src="${src(name)}" style="${style}">`;
const pos=(y,x=80,w=900)=>`position:absolute;left:${x}px;top:${y}px;width:${w}px;`;
const css=`
@font-face{font-family:SUIT;src:url('${url(sourceFont)}');font-weight:100 900}
@font-face{font-family:Inter;src:url('${url(path.join(fontRoot,'InterTight/InterTight-Medium.ttf'))}');font-weight:400 600}
@font-face{font-family:Inter;src:url('${url(path.join(fontRoot,'InterTight/InterTight-Bold.ttf'))}');font-weight:700 900}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}article{position:relative;width:1080px;height:1920px;overflow:hidden;background:#fff;color:#000;font-family:Inter,SUIT,sans-serif}img{display:block;object-fit:contain}.title{font-size:90px;line-height:1.13;font-weight:800;letter-spacing:-3px;word-break:keep-all}.body{font-size:43px;line-height:1.5;font-weight:500;letter-spacing:-.7px;word-break:keep-all}.small{font-size:28px;line-height:1.45;color:#555;font-weight:500}.tag{font-size:28px;font-weight:600;color:#555;letter-spacing:.3px}.number{font-size:27px;color:#555}.caption{font-size:41px;line-height:1.48;font-weight:600;word-break:keep-all}.paper{box-shadow:0 10px 42px #00000016}.source{font-size:27px;line-height:1.4;color:#444}.quote{font-size:80px;line-height:1.34;font-weight:800;letter-spacing:-2.3px;word-break:keep-all}.label{font-size:31px;font-weight:700;line-height:1.3}.step{font-size:65px;font-weight:800;line-height:1.25;letter-spacing:-1.7px}.muted{color:#606060}.arrow{font-size:68px;font-weight:500;color:#777}.rule{height:2px;background:#e5e5e5}
`;
const header=i=>`<img src="${url(sourceLogo)}" style="${pos(90,75,195)}height:100px;object-position:left center">`+txt('synkbrief','tag',pos(126,730,250)+'text-align:right;')+txt(`0${i} / 06`,'number',pos(1710,80,170))+txt('무음 검토본 · 음성 합성 전','small',pos(1710,500,480)+'text-align:right;');
const scenes=[
 {id:'01',duration:5,html:txt('AI가 만든 PDF,\n바로 보내도 될까요?','title',pos(265))+asset('demo-before.png',pos(595,240,600)+'height:850px;','paper')+txt('파일이 생긴 다음,\n실제 화면도 확인해요.','caption',pos(1515))},
 {id:'02',duration:7,html:txt('문장 끝이\n잘렸어요.','title',pos(270))+txt('긴 문장이 있는 표를 확대해 보면','body muted',pos(525))+asset('table-before.png',pos(650)+'height:518px;')+txt('문장 끝부분 확대','label',pos(1215))+asset('end-before.png',pos(1285,180,740)+'height:210px;')+txt('설명을 위해 일부러 만든 배치 오류입니다.','small',pos(1550))},
 {id:'03',duration:8,html:txt('이번에 사용한 도구','tag',pos(275))+txt('Playwright','title',pos(350)+'font-size:108px;')+txt('GitHub에 공개된\n브라우저 자동화 도구','body',pos(525))+txt('HTML','step',pos(830,92,335))+txt('→','arrow',pos(838,469,100))+txt('PDF','step',pos(830,650,260))+txt('문서를 브라우저로 열고\nPDF로 저장합니다.','caption',pos(1080))+txt('저장만으로 배치 검수가 끝나는 것은 아니에요.','small',pos(1345))+txt('github.com/microsoft/playwright','source',pos(1530))},
 {id:'04',duration:8,html:txt('저장한 PDF를\n다시 펼쳐 봐요.','title',pos(265))+asset('demo-before.png',pos(635,95,490)+'height:700px;','paper')+txt('글자 잘림','label',pos(745,650,315))+txt('표의 줄바꿈','label',pos(885,650,315))+txt('페이지 끝','label',pos(1025,650,315))+txt('페이지별 이미지로 확인','caption',pos(1415))+txt('이번 시연: PDF → PNG는 Poppler 사용','small',pos(1530))},
 {id:'05',duration:8,html:txt('줄바꿈을 고치고,\n다시 저장했어요.','title',pos(265)+'font-size:83px;')+txt('수정 전 · 문장 끝부분','label',pos(555))+asset('end-before.png',pos(650,130,800)+'height:227px;')+txt('수정 후 · 다음 줄까지 표시','label',pos(975))+asset('end-after.png',pos(1060,130,800)+'height:160px;')+txt('이제 문장 끝까지 읽힙니다.','caption',pos(1355))+txt('원본 수정 → PDF 저장 → 화면 재확인','small',pos(1510))},
 {id:'06',duration:11,html:txt('다음 요청에는','tag',pos(275))+txt('“PDF로 저장한 뒤,\n모든 페이지를\n열어 보고\n잘린 부분까지\n고쳐 줘.”','quote',pos(375))+asset('table-after.png',pos(1035)+'height:518px;')+txt('AI 결과를 실제로 쓸 수 있게.','small',pos(1620))},
];
async function render(){
 fs.mkdirSync(dir,{recursive:true});
 // Crops preserve the actual PDF pixels; they are not recreated text.
 for(const name of ['before','after']) await sharp(path.resolve(dir,'..',`demo-${name}.png`)).extract({left:90,top:850,width:1060,height:name==='before'?170:205}).png().toFile(path.join(dir,`row-${name}.png`));
 for(const name of ['before','after'])execFileSync('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe',['-r','300','-png','-singlefile',path.resolve(dir,'..',`demo-${name}.pdf`),path.join(dir,`hires-${name}`)]);
 await sharp(path.join(dir,'hires-before.png')).extract({left:1490,top:1780,width:560,height:170}).png().toFile(path.join(dir,'end-before.png'));
 await sharp(path.join(dir,'hires-after.png')).extract({left:540,top:1890,width:800,height:160}).png().toFile(path.join(dir,'end-after.png'));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
 const qa=[];
 for(const s of scenes){
  let body=s.html;for(const name of ['row-before.png','row-after.png','end-before.png','end-after.png'])body=body.replaceAll(src(name),url(path.join(dir,name)));
  fs.writeFileSync(path.join(dir,`scene-${s.id}.html`),`<!doctype html><html lang="ko"><meta charset="utf-8"><style>${css}</style><article>${header(Number(s.id))}${body}</article></html>`);
  await page.goto(url(path.join(dir,`scene-${s.id}.html`)));await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(dir,`scene-${s.id}.png`)});
  qa.push({scene:s.id,...await page.evaluate(()=>({fontStatus:document.fonts.status,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),outsideText:[...document.querySelectorAll('[data-text]')].filter(e=>{const r=e.getBoundingClientRect();return r.x<70||r.right>985||r.y<85||r.bottom>1770}).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON()}))}))});
 }
 await browser.close();
 const thumbs=await Promise.all(scenes.map(async(s,i)=>({input:await sharp(path.join(dir,`scene-${s.id}.png`)).resize(360,640).toBuffer(),left:(i%3)*360,top:Math.floor(i/3)*640})));
 await sharp({create:{width:1080,height:1280,channels:3,background:'#ddd'}}).composite(thumbs).png().toFile(path.join(dir,'contact-sheet.png'));
 fs.writeFileSync(path.join(dir,'frame-qa.json'),JSON.stringify(qa,null,2));
 const inputs=scenes.flatMap(s=>['-loop','1','-framerate','24','-t',String(s.duration),'-i',path.join(dir,`scene-${s.id}.png`)]);
 const transition=0.3;
 let elapsed=scenes[0].duration,filters=scenes.map((s,i)=>`[${i}:v]format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[v${i}]`),prev='v0';
 for(let i=1;i<scenes.length;i++){const offset=Number((elapsed-transition*i).toFixed(3));const out=`x${i}`;filters.push(`[${prev}][v${i}]xfade=transition=fade:duration=${transition}:offset=${offset}[${out}]`);prev=out;elapsed+=scenes[i].duration;}
 const duration=elapsed-transition*(scenes.length-1);
 const output=path.join(dir,'preview-silent.mp4');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...inputs,'-filter_complex',filters.join(';'),'-map',`[${prev}]`,'-an','-t',String(duration),'-r','24','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:'inherit'});
 const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',output],{encoding:'utf8'}));
 const qaTimes=[1,8,15,23,31,40];
 for(let i=0;i<qaTimes.length;i++)execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(qaTimes[i]),'-i',output,'-frames:v','1',path.join(dir,`encoded-frame-${i+1}.png`)]);
 fs.writeFileSync(path.join(dir,'video-metadata.json'),JSON.stringify({status:'silent_review_edit_not_final_audio',createdAt:new Date().toISOString(),width:1080,height:1920,fps:24,duration,scenes:scenes.map(({html,...s})=>s),transitionSeconds:transition,finalPromptVisibleSeconds:scenes[5].duration-transition,logoSource:path.relative(repo,sourceLogo).replaceAll('\\','/'),logoSha256:crypto.createHash('sha256').update(fs.readFileSync(sourceLogo)).digest('hex'),fonts:['SUIT Variable','Inter Tight'],audioStreams:probe.streams.filter(s=>s.codec_type==='audio').length,videoProbe:probe.streams.filter(s=>s.codec_type==='video').map(s=>({width:s.width,height:s.height,duration:s.duration,avg_frame_rate:s.avg_frame_rate,nb_frames:s.nb_frames,codec_name:s.codec_name})),bytes:fs.statSync(output).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex'),encodedFrameTimes:qaTimes,qa},null,2));
 console.log(JSON.stringify({output,duration,bytes:fs.statSync(output).size,qa},null,2));
}
render().catch(e=>{console.error(e);process.exit(1)});
