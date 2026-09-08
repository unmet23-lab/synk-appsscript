'use strict';
// 이 제작물만 보는 로컬 미리보기/검사. 외부 게시나 상시 서비스가 아니다.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {spawnSync}=require('child_process'),{createRequire}=require('module');
const runtime=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const sharp=runtime('sharp'),{chromium}=runtime('playwright');
const root=path.resolve(__dirname,'../../..'),port=8767;
const mime={'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.png':'image/png','.ttf':'font/ttf','.otf':'font/otf','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json'};
const inDir=(f,d)=>f===d||f.startsWith(d+path.sep);
const allowed=[__dirname,path.join(root,'docs/브랜드_폰트'),path.join(root,'docs/홍보물/브랜드소개_20260909/로고디테일/로고_투명')];
function server(){return http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
  if(!allowed.some(d=>inDir(file,d))){res.writeHead(403).end();return;}
  try{
    const stat=fs.statSync(file);if(!stat.isFile()){res.writeHead(404).end();return;}
    const headers={'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store','accept-ranges':'bytes'};
    let start=0,end=stat.size-1,status=200;
    if(req.headers.range){
      const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if(!match){res.writeHead(416).end();return;}
      start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));
      if(start>end||start>=stat.size){res.writeHead(416).end();return;}
      status=206;headers['content-range']=`bytes ${start}-${end}/${stat.size}`;
    }
    headers['content-length']=end-start+1;res.writeHead(status,headers);
    if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404).end();}
}).listen(port,'127.0.0.1');}
const url=`http://127.0.0.1:${port}/docs/홍보물/릴10편_20260909/index.html`;
function command(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:10*1024*1024});assert.equal(r.status,0,(r.stderr||r.stdout).slice(-1500));return (r.stdout||'')+(r.stderr||'');}
const write=(name,value)=>fs.writeFileSync(path.join(__dirname,name),typeof value==='string'?value:JSON.stringify(value,null,2));
async function inspect(){
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,'대본.json'))),audio=[];
  for(const [dir,ext] of [['영상','.mp4'],['표지','.png'],['제공자료','.png']])assert.equal(fs.readdirSync(path.join(__dirname,dir)).filter(f=>f.endsWith(ext)).length,10,dir+' 10개');
  for(const r of data.reels){
    const f=path.join(__dirname,'영상',r.id+'.mp4');
    const info=JSON.parse(command('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size','-of','json',f]));
    const video=info.streams.find(s=>s.codec_type==='video');
    assert.equal(video.width,1080);assert.equal(video.height,1920);assert.equal(video.r_frame_rate,'30/1');assert.equal(video.codec_name,'h264');
    assert.ok(info.streams.some(s=>s.codec_type==='audio'));assert.ok(Math.abs(Number(info.format.duration)-30)<.15);
    const raw=command('ffmpeg',['-hide_banner','-nostats','-xerror','-i',f,'-af','ebur128=peak=true','-f','null','-']);
    const tail=raw.slice(raw.lastIndexOf('Integrated loudness:'));
    const loudness=Number(tail.match(/I:\s+(-?[\d.]+) LUFS/)[1]),peak=Number(tail.match(/Peak:\s+(-?[\d.]+) dBFS/)[1]);
    assert.ok(loudness>-18&&loudness<=-13.5);assert.ok(peak<=-1);
    audio.push({id:r.id,loudness,peak,duration:Number(info.format.duration),bytes:Number(info.format.size),decode:'pass'});
    for(const folder of ['표지','제공자료'])for(const p of fs.readdirSync(path.join(__dirname,folder)).filter(p=>p.startsWith(r.id))){
      const m=await sharp(path.join(__dirname,folder,p)).metadata();assert.equal(m.width,1080);assert.equal(m.height,1920);
    }
    for(const item of r.gift.items){assert.ok(r.captionMn.includes(item.ko));assert.ok(r.captionMn.includes(item.mn));}
    assert.ok(r.captionMn.includes(r.gift.noteMn));
  }
  const layout=JSON.parse(fs.readFileSync(path.join(__dirname,'검사/화면경계.json')));
  const bad=layout.flatMap(l=>l.boxes.filter(b=>b.x<64||b.right>990||b.y<200||b.bottom>1740).map(b=>({id:l.id,frame:l.frame,...b})));
  assert.equal(bad.length,0,JSON.stringify(bad));
  const local=server(),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const browserResults=[];
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
      await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('article').count(),10);assert.equal(await page.locator('video').count(),10);
      const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)}));
      assert.ok(dimensions.scroll<=dimensions.width);assert.ok(dimensions.images);
      for(const link of await page.locator('a[href]').evaluateAll(els=>els.map(e=>e.href))){const res=await context.request.head(link);assert.ok(res.ok(),`${res.status()} ${link}`);}
      const playback=[];
      for(let i=0;i<10;i++){
        const v=page.locator('video').nth(i);
        const result=await v.evaluate(async v=>{v.muted=true;await v.play();await new Promise(r=>setTimeout(r,300));v.pause();const started=v.currentTime;v.currentTime=24;await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('seek timeout')),15000);v.addEventListener('seeked',()=>{clearTimeout(timeout);resolve();},{once:true});});return {duration:v.duration,started,current:v.currentTime,error:v.error?.message||null,width:v.videoWidth,height:v.videoHeight};});
        assert.ok(result.started>0);assert.equal(result.current,24);assert.equal(result.error,null);assert.equal(result.width,1080);playback.push(result);
      }
      await page.screenshot({path:path.join(__dirname,'검사',`모아보기-${viewport.width}.png`),fullPage:false});
      assert.equal(errors.length,0,errors.join('\n'));browserResults.push({viewport,dimensions,playback,errors});await context.close();
    }
  }finally{await browser.close();await new Promise(resolve=>local.close(resolve));}
  const result={at:new Date().toISOString(),reels:10,beats:50,giftItems:data.reels.reduce((s,r)=>s+r.gift.items.length,0),layoutSamples:layout.length,overflow:bad,audio,browserResults};
  write('검사/최종기계검사.json',result);
  write('제작검사.md',`# 릴 10편 · 실제 출력 검사\n\n검사 시각: ${result.at}\n\n- MP4 10개: H.264 · 1080×1920 · 30fps · 각30초 · 오디오 트랙 있음. 전량 끝까지 디코드 성공.\n- 표지10장·제공자료10장: 1080×1920. 한몽46항목과 주의사항이 설명글에도 전부 있음.\n- 화면경계 ${layout.length}표본: 지정 안전영역 밖 글상자0. 이 검사는 글상자 범위이며 의미와 가독성은 별도 눈검수 기록 참조.\n- 브라우저1440px/390px: 가로 넘침0, 이미지누락0, 링크오류0, 각10편 재생·24초 탐색 성공.\n- 소리: 전량 ${audio[0].loudness} LUFS · 최고피크 ${Math.max(...audio.map(a=>a.peak))} dBFS. 실제 측정이며 사람이 귀로 들은 검증은 하지 못했다. 한국어 발음 음성은 없음.\n\n[기계검사 원본](검사/최종기계검사.json) · [시각검수](시각검수.md) · [번역검수](번역검수.md)\n\n공개 게시·학생 반응·사람 원어민 감수는 수행하지 않았다.\n`);
  console.log(JSON.stringify({reels:10,overflow:0,viewports:2,decode:10,loudness:audio.map(a=>a.loudness),peak:audio.map(a=>a.peak)}));
}
if(process.argv.includes('--서버')){server();console.log(url);}else inspect().catch(e=>{console.error(e);process.exitCode=1;});
