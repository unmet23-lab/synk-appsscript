'use strict';
/** 2026-09-09 10편 한정 제작. 옛45편 원본·생성 규약과 섞지 않는다.
 * node 영상/릴10편굽기.cjs --그림만 | --영상만 | (전체)
 * --편 gift-01 로 낱개를 고를 수 있다. --재개 는 동일 씨앗의 검증된 영상만 재사용한다.
 */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {spawnSync}=require('child_process');
const {bundle}=require('@remotion/bundler');
const {getCompositions,renderStill,renderMedia,openBrowser}=require('@remotion/renderer');
const base=path.resolve(__dirname,'..'), output=path.join(base,'docs/홍보물/릴10편_20260909');
const source=path.join(output,'대본.json'), args=process.argv.slice(2);
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const run=(exe,argv)=>{
  const result=spawnSync(exe,argv,{cwd:base,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
  if(result.status!==0)throw new Error(`${path.basename(exe)} 종료 ${result.status}: ${(result.stderr||result.stdout||'').slice(-4000)}`);
  return result.stdout;
};
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2));};
const checkData=data=>{
  assert.equal(data.reels.length,10,'이번 대상은 정확히10편');
  assert.equal(new Set(data.reels.map(r=>r.id)).size,10,'편id 중복');
  for(const r of data.reels){
    assert.match(r.id,/^gift-\d{2}$/);assert.equal(r.beats.length,5);
    let end=0;for(const b of r.beats){assert.equal(b.start,end,`${r.id} 장면 간 빈칸`);assert.ok(b.seconds>=3);assert.ok(b.ko&&b.mn);end+=b.seconds;}
    assert.ok(end>=25&&end<=42,`${r.id} 읽힘 길이`);
    assert.ok(r.gift.items.length>=3&&r.gift.items.length<=5);
    assert.ok(r.captionMn.length<=2200,`${r.id} 인스타 설명글2200자 초과`);
    assert.ok(r.keywordMn&&r.ctaMn&&r.replyMn&&r.gift.titleMn);
    for(const item of r.gift.items)assert.ok(item.labelMn&&item.ko&&item.mn);
  }
};
const probe=f=>JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,width,height,r_frame_rate,sample_rate:format=duration,size','-of','json',f]));
function prepareSubset(){
  const assets=JSON.parse(fs.readFileSync(path.join(__dirname,'public/공방/목록.json'))).벌;
  const names=['찻잔','가방','내 방 낮','교실','지도','편지봉투','사진','탁상시계','공책과 연필'];
  const files=['몽글/본체.png','까몽/본체.png','릴10편/로고.png','소리/받은BGM/시티팝_147.wav','소리/synk-sound-notify.wav'];
  files.push(...fs.readdirSync(path.join(__dirname,'public/폰트')).map(f=>'폰트/'+f));
  for(const n of names){const a=assets.find(a=>a.이름===n);assert.ok(a,`공방자산 ${n}`);files.push(a.파일);}
  const pub=path.join(__dirname,'out/릴10편_사용자산');
  for(const f of files){const target=path.join(pub,f);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(__dirname,'public',f),target);}
  return {pub,files};
}
async function main(){
  const data=JSON.parse(fs.readFileSync(source));checkData(data);
  if(args.includes('--검사만')){console.log('10편 데이터 검사 통과');return;}
  console.log('정본 자산 준비');console.log(run(process.execPath,[path.join(__dirname,'자산모으기.js')]).trim().split('\n').slice(-2).join('\n'));
  const {pub,files}=prepareSubset();
  const sourceFiles=['src/릴10편/index.tsx','src/릴10편/릴.tsx','src/릴10편/타입.ts','src/킷/폰트.ts','src/킷/색.ts','src/킷/공방.ts','src/킷/폰트벌.json','릴10편굽기.cjs'];
  const seed=crypto.createHash('sha256').update(sourceFiles.map(f=>f+sha(path.join(__dirname,f))).join('')+sha(path.join(base,'docs/디자인_토큰.json'))+files.map(f=>f+sha(path.join(pub,f))).join('')).digest('hex');
  const served=await bundle({entryPoint:path.join(__dirname,'src/릴10편/index.tsx'),rootDir:__dirname,publicDir:pub});
  const browser=await openBrowser('chrome');
  const errors=[],layout=[],results=[];
  const log=entry=>{const t=entry.text||'';if(t.startsWith('REEL_LAYOUT ')){try{layout.push(JSON.parse(t.slice(12)))}catch{}}else if(/Failed to load|Failed to fetch|net::ERR_|Could not load font|Error loading/.test(t)){errors.push(t);}};
  try{
    const compositions=await getCompositions(served,{puppeteerInstance:browser,onBrowserLog:log,logLevel:'error'});
    const get=id=>{const c=compositions.find(c=>c.id===id);assert.ok(c,`등록 누락 ${id}`);return c;};
    const selected=args.includes('--편')?data.reels.filter(r=>r.id===args[args.indexOf('--편')+1]):data.reels;
    assert.ok(selected.length,'선택한편 없음');
    for(const r of selected){
      const reelSeed=crypto.createHash('sha256').update(seed+JSON.stringify(r)).digest('hex');
      const metadata=path.join(output,'검사',r.id+'.json');
      const previous=fs.existsSync(metadata)?JSON.parse(fs.readFileSync(metadata)):null;
      if(!args.includes('--영상만')){
        const stills=compositions.filter(c=>c.id.startsWith(r.id+'-'));
        for(const c of stills){
          const dir=c.id.endsWith('-cover')?'표지':'제공자료';const f=path.join(output,dir,c.id+'.png');fs.mkdirSync(path.dirname(f),{recursive:true});
          await renderStill({serveUrl:served,composition:c,output:f,imageFormat:'png',puppeteerInstance:browser,onBrowserLog:log,overwrite:true,logLevel:'error'});
        }
        for(const [i,b] of r.beats.entries()){
          const f=path.join(output,'검사',`${r.id}-scene-${i+1}.png`);fs.mkdirSync(path.dirname(f),{recursive:true});
          await renderStill({serveUrl:served,composition:get(r.id),frame:Math.round(b.start*30)+20,output:f,imageFormat:'png',puppeteerInstance:browser,onBrowserLog:log,overwrite:true,logLevel:'error'});
        }
        console.log(`${r.id} 표지·자료·장면5장 완료`);
      }
      if(!args.includes('--그림만')){
        const final=path.join(output,'영상',r.id+'.mp4');fs.mkdirSync(path.dirname(final),{recursive:true});
        if(args.includes('--재개')&&previous?.seed===reelSeed&&previous.videoHash&&fs.existsSync(final)&&sha(final)===previous.videoHash){console.log(`${r.id} 검증한 동일판 재사용`);results.push(previous);continue;}
        const raw=path.join(__dirname,'out',r.id+'.mp4');const started=Date.now();let last=-1;
        await renderMedia({serveUrl:served,composition:get(r.id),outputLocation:raw,codec:'h264',pixelFormat:'yuv420p',imageFormat:'jpeg',jpegQuality:100,videoBitrate:'12M',encodingMaxRate:'16M',encodingBufferSize:'24M',audioBitrate:'256k',colorSpace:'bt709',concurrency:2,puppeteerInstance:browser,onBrowserLog:log,overwrite:true,enforceAudioTrack:true,logLevel:'error',onProgress:p=>{const tenth=Math.floor(p.progress*10);if(tenth!==last){last=tenth;console.log(`${r.id} ${tenth*10}%`);}}});
        assert.ok(fs.statSync(raw).mtimeMs>=started-1000,'옛파일을 성공으로 세지 않는다');
        console.log(run(process.execPath,[path.join(__dirname,'마스터.js'),r.id+'.mp4']));
        fs.copyFileSync(raw,final);
        const info=probe(final),video=info.streams.find(s=>s.codec_type==='video'),audio=info.streams.find(s=>s.codec_type==='audio');
        assert.equal(video.width,1080);assert.equal(video.height,1920);assert.equal(video.r_frame_rate,'30/1');assert.ok(audio);
        assert.ok(Math.abs(Number(info.format.duration)-get(r.id).durationInFrames/30)<.2);
        const item={id:r.id,seed:reelSeed,videoHash:sha(final),renderedAt:new Date().toISOString(),info};write(metadata,item);results.push(item);
        console.log(`${r.id} 영상·소리·길이 확인`);
      }
    }
    write(path.join(output,'검사','화면경계.json'),layout);
    write(path.join(output,'검사','이번실행.json'),{at:new Date().toISOString(),mode:args,errors,results});
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('요청한10편 제작 단계 완료. 눈검수·문안검수는 별도 기록을 확인한다.');
  }finally{await browser.close({silent:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
