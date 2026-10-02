'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const {pathToFileURL}=require('url'),sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected=read(path.join(root,'docs/홍보물/마케팅실행_20260909/원고/콘텐츠원고.json')).items.map(i=>i.id).sort();
const items=['static','video'].flatMap(n=>read(path.join(__dirname,'원고',n+'.json')).items).sort((a,b)=>a.id.localeCompare(b.id));
const failures=[],records=[];
const assert=(v,m)=>{if(!v)failures.push(m)};
assert(JSON.stringify(items.map(i=>i.id).sort())===JSON.stringify(expected),'Authoritative 19-account scope mismatch');
function probe(file){const r=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout)}
async function main(){
 const films=read(path.join(root,'영상/public/firstposts20260910/films.json'));
 for(const item of items){
  const dir=path.join(__dirname,item.id),record={id:item.id,platform:item.platform,images:[]};
  for(const name of ['index.html','게시문안.txt','제목.txt','업로드안내.md','대체텍스트.txt'])assert(fs.existsSync(path.join(dir,name)),`${item.id}: missing ${name}`);
  const publicCopy=fs.readFileSync(path.join(dir,'게시문안.txt'),'utf8').replace(/\r\n/g,'\n');
  assert(publicCopy.includes(item.caption.replace(/\r\n/g,'\n')),`${item.id}: public copy differs from current source`);
  if(item.platform==='Threads')assert([...item.caption].length<=500,item.id+': Threads over 500 characters');
  if(item.platform==='Instagram')assert([...item.caption].length<=2200,item.id+': Instagram production caption exceeds 2200');
  if(item.platform==='Pinterest')assert(item.slides.length===1,item.id+': a single first Pin is required');
  for(let n=1;n<=item.slides.length;n++){
   const p=path.join(dir,'upload-'+String(n).padStart(2,'0')+'.jpg');
   if(!fs.existsSync(p)){failures.push(item.id+': missing image '+n);continue}
   const m=await sharp(p).metadata();
   const dims=item.platform==='Pinterest'?[1000,1500]:item.platform==='Kakao Channel'?[1080,1080]:item.platform==='Substack'?[1200,800]:item.format==='video'&&item.orientation!=='landscape'?[1080,1920]:[1080,1350];
   assert(m.width===dims[0]&&m.height===dims[1],`${item.id}: unexpected dimensions ${m.width}x${m.height}`);
   assert(fs.statSync(p).size<10*1024*1024,item.id+': image exceeds conservative upload size');
   record.images.push({file:path.relative(__dirname,p),width:m.width,height:m.height,sha256:sha(p)});
  }
  if(item.format==='video'){
   if(item.orientation==='landscape'){
    const thumbnail=path.join(dir,'thumbnail.jpg');
    assert(fs.existsSync(thumbnail),item.id+': missing landscape thumbnail');
    if(fs.existsSync(thumbnail)){const tm=await sharp(thumbnail).metadata();assert(tm.width===1920&&tm.height===1080&&fs.statSync(thumbnail).size<2*1024*1024,item.id+': landscape thumbnail dimensions or upload size');}
   }
   const p=path.join(dir,'video.mp4');
   if(!fs.existsSync(p)){failures.push(item.id+': missing video');continue}
   const pinfo=probe(p),v=pinfo.streams.find(s=>s.codec_type==='video'),a=pinfo.streams.find(s=>s.codec_type==='audio');
   const dims=item.orientation==='landscape'?[1920,1080]:[1080,1920];
   assert(v?.width===dims[0]&&v?.height===dims[1],item.id+': wrong video orientation');
   assert(v?.codec_name==='h264'&&a?.codec_name==='aac',item.id+': upload codecs or audio missing');
   const film=films.find(f=>f.id===item.id),frames=film.scenes.reduce((s,f)=>s+Math.round(f.duration*30),0);
   assert(Math.abs(Number(pinfo.format.duration)-frames/30)<0.15,item.id+': final movie duration differs from current voiced scenes');
   for(const n of ['자막.srt','자막.vtt'])assert(fs.existsSync(path.join(dir,n)),item.id+': missing '+n);
   record.video={file:item.id+'/video.mp4',sha256:sha(p),duration:Number(pinfo.format.duration),width:v.width,height:v.height,audioCodec:a?.codec_name};
  }
  if(item.article)assert(fs.existsSync(path.join(dir,'본문.md')),item.id+': long-form article missing');
  if(item.id==='13-yuhobuilds-linkedin')assert(fs.existsSync(path.join(dir,'게시할자료.pdf')),item.id+': LinkedIn document missing');
  records.push(record);
 }
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const page=await browser.newPage();const screens=[];
 const resourcePages=fs.readdirSync(path.join(__dirname,'resources')).filter(x=>x.endsWith('.html')).map(x=>'resources/'+x);
 const pages=['index.html','타겟과플랫폼.html',...items.map(i=>i.id+'/index.html'),...resourcePages,...items.filter(i=>i.article).map(i=>i.id+'/본문.html')];
 for(const width of [1440,390])for(const file of pages){
  await page.setViewportSize({width,height:900});await page.goto(pathToFileURL(path.join(__dirname,file)).href);await page.evaluate(()=>document.fonts.ready);
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')),title:document.title}));
  assert(!state.overflow,`${file} overflows at ${width}px`);assert(state.brokenImages.length===0,`${file} broken images ${state.brokenImages.join(',')}`);screens.push({file,width,...state});
 }
 // Exercise the newly supplied editable worksheet with a different final-consonant case.
 await page.goto(pathToFileURL(path.join(__dirname,'resources/first-work.html')).href);
 await page.locator('#person').fill('작은 서점');await page.locator('#work').fill('이번 주 책을 소개해');await page.locator('#result').fill('홍보 포스터');
 const sentence=await page.locator('#sentence').innerText();assert(sentence.includes('작은 서점을 위해')&&sentence.includes('홍보 포스터를 만듭니다.'),'Editable worksheet particles fail real browser counterexample');
 const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending;const downloaded=path.join(__dirname,'_검토/서점_실제다운로드.txt');await download.saveAs(downloaded);assert(fs.readFileSync(downloaded,'utf8').includes(sentence),'Actual TXT download differs from entered worksheet');
 await page.goto(pathToFileURL(path.join(__dirname,'01-lab-youtube/index.html')).href);
 const voicePending=page.waitForEvent('download');await page.locator('a[download][href="voice-studio.wav"]').click();const voiceDownload=await voicePending;const voiceDownloaded=path.join(__dirname,'_검토/01-음성수정/실제다운로드-voice-studio.wav');await voiceDownload.saveAs(voiceDownloaded);
 const voiceSource=path.join(__dirname,'01-lab-youtube/voice-studio.wav'),voiceStream=probe(voiceSource).streams.find(s=>s.codec_type==='audio'),voiceDownloadCheck={actualBrowser:true,source:'01-lab-youtube/voice-studio.wav',suggestedFilename:voiceDownload.suggestedFilename(),sha256:sha(voiceDownloaded),downloadMatchesSource:sha(voiceDownloaded)===sha(voiceSource),codec:voiceStream?.codec_name,sampleRate:Number(voiceStream?.sample_rate)};
 assert(voiceDownloadCheck.downloadMatchesSource&&voiceDownloadCheck.sampleRate===48000&&voiceDownloadCheck.codec==='pcm_s24le','Studio voice WAV download or format mismatch');
 await browser.close();
 const htmlFiles=[];function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){if(d.name.startsWith('_')||d.name==='node_modules'||d.name==='전체_업로드')continue;const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else if(d.name.endsWith('.html'))htmlFiles.push(p)}}walk(__dirname);
 let links=0;for(const p of htmlFiles){const source=fs.readFileSync(p,'utf8');for(const m of source.matchAll(/(?:src|href)="([^"]+)"/g)){const u=m[1];if(/^(https?:|data:|#|mailto:|blob:)/.test(u))continue;const target=path.resolve(path.dirname(p),decodeURIComponent(u.split('#')[0].split('?')[0]));if(target.endsWith('.zip')&&!process.argv.includes('--archives'))continue;links++;assert(fs.existsSync(target),`${path.relative(__dirname,p)} missing local destination ${u}`)}}
 const result={checkedAt:new Date().toISOString(),accounts:records.length,images:records.reduce((s,r)=>s+r.images.length,0),videos:records.filter(r=>r.video).length,records,screens,localLinksChecked:links,worksheet:{actualBrowser:true,sentence,actualDownloadMatches:true},failures,status:failures.length?'incomplete':'pass',scope:'Current delivered files, browser layout and actual download. Human language review, SNS posting and business outcomes are separate.'};
 result.voiceDownload=voiceDownloadCheck;
 fs.writeFileSync(path.join(__dirname,'_검토/납품실물검증.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({accounts:result.accounts,images:result.images,videos:result.videos,pages:screens.length,links,voiceDownload:voiceDownloadCheck,failures},null,2));if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
