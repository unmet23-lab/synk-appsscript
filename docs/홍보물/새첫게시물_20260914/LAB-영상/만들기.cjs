'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),vm=require('node:vm');
const {spawn,spawnSync}=require('node:child_process'),{once}=require('node:events'),{stripTypeScriptTypes}=require('node:module');
const OUT=__dirname,ROOT=path.resolve(OUT,'../../../..'),S=require('./원고.cjs');
const MODULES='C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(MODULES,'playwright')),sharp=require(path.join(MODULES,'sharp'));
const FF='C:/Users/q1212/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const FP=path.join(path.dirname(FF),'ffprobe.exe'),CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const sources=new Map(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function read(rel,mime){const b=fs.readFileSync(path.join(ROOT,rel));sources.set(rel,{path:rel,sha256:sha(b),bytes:b.length});return mime?`data:${mime};base64,${b.toString('base64')}`:b.toString('utf8');}
function dest(rel){const p=path.resolve(OUT,rel);if(!p.startsWith(OUT+path.sep))throw Error('Output escaped ownership');return p;}
function write(rel,b){const p=dest(rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);}
function run(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024});if(r.status!==0)throw Error(r.stderr||String(r.error));return r.stdout;}
const json=(rel,x)=>write(rel,JSON.stringify(x,null,2)+'\n');
const norm=s=>s.replace(/\s+/g,' ').trim();
const stamp=sec=>{const n=Math.round(sec*1000);return '00:'+String(Math.floor(n/60000)).padStart(2,'0')+':'+String(Math.floor(n/1000)%60).padStart(2,'0')+','+String(n%1000).padStart(3,'0');};
async function design(){
  for(const rel of ['AGENTS.md','docs/AI_운영원칙.md','DESIGN.md','docs/마케팅/LAB.md','docs/마케팅/제작_인수기준.md','docs/브랜드_폰트_정본.md','docs/비전_정본.md','docs/Loom_실시간장면_표현기준.md','영상/src/킷/폰트.ts','영상/src/킷/폰트벌.json','docs/홍보물/새첫게시물_20260914/LAB/build.cjs','docs/홍보물/새첫게시물_20260914/LAB/manifest.json','docs/홍보물/새첫게시물_20260914/LAB/assets/provenance.json','docs/홍보물/새첫게시물_20260914/LAB/caption-student-mn.txt','docs/홍보물/새첫게시물_20260914/LAB/caption-student-ko.txt'])read(rel);
  for(const f of ['원고.cjs','장면.js','만들기.cjs','검증.cjs'])read(path.relative(ROOT,path.join(OUT,f)).replace(/\\/g,'/'));
  const tokens=read('docs/디자인_토큰.json'),code=read('영상/src/킷/색.ts').replace(/import 토큰 from [^;]+;/,`const 토큰=${tokens};`);
  const kit=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code,{mode:'transform'})).toString('base64'));
  const fontList=[['SUIT Variable','100 900','SUIT/SUIT-Variable.woff2','font/woff2'],['Inter Tight','500','InterTight/InterTight-Medium.ttf','font/ttf'],['Inter Tight','700','InterTight/InterTight-Bold.ttf','font/ttf'],['DM Mono','500','DM_Mono/DMMono-Medium.ttf','font/ttf']];
  const fonts=fontList.map(([family,weight,f,mime])=>({family,weight,path:'docs/브랜드_폰트/'+f,uri:read('docs/브랜드_폰트/'+f,mime)}));
  const logoPath='docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-LAB-Ink.png';
  const placements=JSON.parse(read('docs/홍보물/마케팅실행_20260909/브랜드킷/배치명세.json'));const lp=placements.items.find(x=>x.brand==='LAB'&&x.variant==='Ink');
  const logo=read(logoPath,'image/png');if(sources.get(logoPath).sha256!==lp.sha256)throw Error('Approved LAB logo drift');
  const vision=require(path.join(ROOT,'tools/lib/비전정본.js')).loadVisions().lab.headline;
  const build=read('docs/홍보물/새첫게시물_20260914/LAB/build.cjs');const chunks=[];
  for(const match of build.matchAll(/lines\([^\[]*?(\[[^\]]*\])/g)){try{chunks.push(norm(vm.runInNewContext(match[1]).join(' ')));}catch{}}
  const original=chunks.concat(read('docs/홍보물/새첫게시물_20260914/LAB/caption-student-mn.txt')).map(norm).join(' ');
  const mnChecks=Object.entries(S.mn).map(([key,value])=>({key,value,exactExisting:original.includes(norm(value))}));
  if(mnChecks.some(x=>!x.exactExisting))throw Error('Non-source MN '+JSON.stringify(mnChecks.filter(x=>!x.exactExisting)));
  return {vision,fonts,logo,mnChecks,colors:{paper:kit.색('Paper'),ink:kit.색('Ink'),oat:kit.색('Oat'),stone:kit.색('Stone'),muted:kit.색('Deep Wool'),coral:kit.색('Coral 3')},paper:read('docs/Loom_자산/구움/펠트_종이바탕.webp','image/webp'),book:read('docs/홍보물/새첫게시물_20260914/LAB/assets/notebook.png','image/png')};
}
async function main(){
  const preview=process.argv.includes('--preview'),D=await design(),errors=[],external=[];
  const sourceJs=fs.readFileSync(path.join(OUT,'장면.js'),'utf8');
  const html=`<!doctype html><html lang="mn"><meta charset="utf-8"><title>LAB 편집 지면</title><style>body{margin:0;background:${D.colors.paper}}canvas{display:block;width:min(100vw,540px);height:auto}</style><canvas></canvas><script>${sourceJs}</script><script>window.ready=makeLabStage(${JSON.stringify(D)},${JSON.stringify(S)}).then(s=>{window.stage=s;s.draw(0);return true});</script></html>`;
  write('편집.html',html);
  const browser=await chromium.launch({executablePath:CHROME,headless:true});
  const page=await browser.newPage({viewport:{width:540,height:960}});page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(['file:','data:','blob:'].includes(u.protocol)||['127.0.0.1','localhost'].includes(u.hostname))return r.continue();external.push(u.origin);return r.abort();});
  const m={createdAt:new Date().toISOString(),status:'preview',...S,officialVision:D.vision,method:'Independent deterministic local Canvas using current video-kit colors and local fonts → PNG stream → FFmpeg H.264. Not Remotion rendering; no installation.',audioTracks:0,color:{range:'tv',matrix:'bt709',primaries:'bt709',transfer:'bt709',format:'yuv420p'},nativeReviewed:false,published:false,publicUrl:null,newTranslation:false,newPaidCalls:0,externalTransferBytes:0,sources:[],keyframes:[],mnChecks:D.mnChecks};
  try{
    await page.goto('file:///'+path.join(OUT,'편집.html').replace(/\\/g,'/'));await page.evaluate(()=>window.ready);
    for(const t of [1,8,17,25,28.5,32,38,46,50,55,61,64.9]){const f=Math.min(Math.round(t*S.fps),S.duration*S.fps-1),r=await page.evaluate(f=>window.stage.draw(f),f);const stem='qa/'+String(f).padStart(4,'0');const b=Buffer.from(r.data,'base64');write(stem+'.png',b);await sharp(b).resize({width:390}).png().toFile(dest(stem+'-390.png'));m.keyframes.push({frame:f,time:f/S.fps,scene:r.scene,file:stem+'.png',mobile:stem+'-390.png',checks:r.checks});}
    const session=await page.context().newCDPSession(page);await session.send('DOM.enable');await session.send('CSS.enable');const doc=await session.send('DOM.getDocument');m.actualFonts=[];
    for(const id of ['mn','ko']){const n=await session.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#probe-'+id});m.actualFonts.push({lang:id,...await session.send('CSS.getPlatformFontsForNode',{nodeId:n.nodeId})});}
    m.fonts=await page.evaluate(()=>window.stage.fonts);
    if(!preview){
      const args=['-y','-hide_banner','-loglevel','warning','-f','image2pipe','-framerate',String(S.fps),'-vcodec','png','-i','pipe:0','-an','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p','-c:v','libx264','-preset','fast','-crf','17','-r',String(S.fps),'-fps_mode','cfr','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-bsf:v','h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1','-movflags','+faststart',dest(S.file+'.mp4')];
      const proc=spawn(FF,args,{windowsHide:true,stdio:['pipe','ignore','pipe']});let stderr='';proc.stderr.on('data',x=>stderr+=x);const done=once(proc,'close');const cache=new Map();let unique=0;
      for(let f=0;f<S.duration*S.fps;f++){
        const key=await page.evaluate(f=>window.stage.cacheKey(f),f);let b=cache.get(key);
        if(!b){const r=await page.evaluate(f=>window.stage.draw(f),f);b=Buffer.from(r.data,'base64');cache.set(key,b);unique++;}
        if(!proc.stdin.write(b))await once(proc.stdin,'drain');if(f%300===0)console.log(`LAB ${f}/${S.duration*S.fps}, ${unique} unique frames`);
      }
      proc.stdin.end();const [code]=await done;if(code!==0)throw Error(stderr);write('qa/encode.txt',stderr||'No encoder warnings.\n');m.uniqueRenderedFrames=unique;
      for(const k of m.keyframes){k.encoded=k.file.replace('.png','-encoded.png');run(FF,['-y','-hide_banner','-loglevel','error','-ss',String(k.time),'-i',dest(S.file+'.mp4'),'-frames:v','1',dest(k.encoded)]);await sharp(dest(k.encoded)).resize({width:390}).png().toFile(dest(k.encoded.replace('.png','-390.png')));}
      m.probe=JSON.parse(run(FP,['-v','error','-show_streams','-show_format','-of','json',dest(S.file+'.mp4')]));m.mp4Sha256=sha(fs.readFileSync(dest(S.file+'.mp4')));m.status='encoded-local-unpublished';
    }
  }finally{await browser.close();}
  const fontCss=D.fonts.map(f=>`@font-face{font-family:'${f.family}';src:url('${f.uri}');font-weight:${f.weight}}`).join('');
  write('index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${S.title}</title><style>${fontCss}body{margin:0;background:${D.colors.paper};color:${D.colors.ink};font-family:'Inter Tight','SUIT Variable',sans-serif;font-weight:500}main{max-width:920px;margin:auto;padding:28px}h1{font-size:30px;font-weight:800;word-break:keep-all}p{line-height:1.65;word-break:keep-all}video{width:100%;max-height:78vh;display:block;background:${D.colors.ink}}a{color:inherit}small{display:block;line-height:1.7}</style><main><h1>${S.title}</h1><p>65초 · 한글을 읽을 수 있는 학습자의 무음 독해·문장 응용.<br>발음·듣기형 숏폼을 대신하지 않습니다. 몽골어 원어민 감수 미확인 · 미발행.</p><video controls playsinline preload="metadata" poster="qa/0030-encoded.png"><source src="${S.file}.mp4" type="video/mp4"></video><p><a href="게시문.md">게시문·사용 범위</a> · <a href="${S.file}.srt">읽기용 SRT</a> · <a href="대체설명.md">대체 설명</a> · <a href="편집.html">편집 지면</a> · <a href="README.md">제작 안내</a> · <a href="검증결과.md">검증 결과</a> · <a href="manifest.json">명세</a></p><small>음성·BGM·발음 모델 없음. 화면은 선택을 감지하거나 평가하지 않습니다.</small></main></html>`);
  const captions=[];for(const [a,b,txt] of [[0,6,D.vision+'\n'+S.mn.purpose],[6,14,'어떤 전공을 배우고 싶어요?\n'+S.mn.question],[14,24,'아직 정하지 않았어요. 먼저 게임을 만들어 보고 싶어요.\n'+S.mn.undecided+'\n'+S.mn.game],[24,27,S.mn.change+'\n아직 정하지 않았어요. 먼저 게임을 만들어 보고 싶어요.\n'+S.mn.game],[27,30.5,S.mn.change+'\n아직 정하지 않았어요. 먼저 영상을 만들어 보고 싶어요.\n'+S.mn.video],[30.5,34,S.mn.change+'\n아직 정하지 않았어요. 먼저 그림을 그려 보고 싶어요.\n'+S.mn.drawing],[34,48,S.mn.yours+'\n아직 정하지 않았어요. 먼저 ______ 보고 싶어요.\n'+S.phrases.join(' · ')+'\n'+S.mn.insert+'\n'+S.mn.solo],[48,52.5,'아직 정하지 않았어요. 먼저 영상을 만들어 보고 싶어요.\n'+S.mn.undecided+'\n'+S.mn.video],[52.5,57,'아직 정하지 않았어요. 먼저 그림을 그려 보고 싶어요.\n'+S.mn.undecided+'\n'+S.mn.drawing],[57,65,S.mn.next+'\n게임 장면 하나 그리기 / '+S.mn.gameAction+'\n짧은 영상 한 장면 찍기 / '+S.mn.videoAction+'\n좋아하는 물건 그리기 / '+S.mn.drawAction+'\n'+S.mn.private]])captions.push({text:txt,startMs:a*1000,endMs:b*1000,timestampMs:null,confidence:null});
  json(S.file+'.captions.json',captions);write(S.file+'.srt',captions.map((x,i)=>`${i+1}\n${stamp(x.startMs/1000)} --> ${stamp(x.endMs/1000)}\n${x.text}\n`).join('\n'));
  write('게시문.md','# 게시용 몽골어 본문\n\n'+read('docs/홍보물/새첫게시물_20260914/LAB/caption-student-mn.txt')+'\n## 한국어 대응 원문\n\n'+read('docs/홍보물/새첫게시물_20260914/LAB/caption-student-ko.txt')+'\n## 인수 메타 — 게시 본문에 복사하지 않음\n\n한글 읽기 가능 학습자의 무음 읽기·문장 응용용 로컬 대안. 기존 발음·청취형 숏폼 레시피의 소리 요구를 충족한 것으로 표시하지 않습니다. 원어민 감수·학생 독해·학습 효과·공개 게시 미확인. 기존 MN 캡션을 그대로 재사용했으며 새 번역·음성·BGM은 없습니다. 화면은 선택을 받거나 평가하지 않습니다.\n');
  write('대체설명.md','# '+S.title+' — 대체 설명\n\n무음 세로 영상입니다. SYNK LAB 로고, 몽골어 학습 목적과 한국어 공식 비전, 코랄 공책이 나옵니다. 전공을 묻는 한국어 질문과 몽골어 뜻에 이어, 아직 정하지 않았지만 먼저 게임을 만들어 보고 싶다는 완성 예시를 보여줍니다. ‘게임을 만들어’ 전체가 한 덩어리로 표시되고 ‘영상을 만들어’, ‘그림을 그려’로 바뀝니다. 글자별 타이핑이나 학습자의 클릭 재현은 없습니다. 14초 동안 빈 문장 틀과 세 구절을 유지해 혼자 문장 전체를 말해볼 시간을 줍니다. 뒤의 두 문장은 가능한 완성 예시이며 정답 판정이 아닙니다. 마지막에는 게임 장면 그리기·영상 한 장면 찍기·좋아하는 물건 그리기 중 직접 해볼 일을 고르게 합니다. 소리·발음 본보기는 없습니다.\n\n## 시간별 읽기\n\n'+captions.map(x=>`### ${stamp(x.startMs/1000)} — ${stamp(x.endMs/1000)}\n\n${x.text}\n`).join('\n'));
  m.errors=errors;m.blockedExternalRequests=external;m.sources=[...sources.values()];m.sourceChanges=m.sources.filter(s=>sha(fs.readFileSync(path.join(ROOT,s.path)))!==s.sha256);if(errors.length||external.length||m.sourceChanges.length)throw Error('Runtime/source check failed');json('manifest.json',m);
  console.log(JSON.stringify({status:m.status,sources:m.sources.length,frames:S.duration*S.fps,keyframes:m.keyframes.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
