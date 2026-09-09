'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const base=__dirname;
const source=path.join(base,'콘텐츠원고.json');
const data=JSON.parse(fs.readFileSync(source,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(p,v)=>fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2),'utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const report={sourceSha256:hash(source),checkedAt:new Date().toISOString(),viewports:[],videoMetadata:[],brokenLinks:[],pageErrors:[],captions:[],deliverables:[]};
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(pathToFileURL(path.join(base,'index.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  const filtered={};
  for(const name of ['all','LAB','SHIFT','PULSE','SYNK','preparation']){
   await page.locator(`[data-filter="${name}"]`).click();
   filtered[name]=await page.locator('.entry:not([hidden])').count();
   const expected=name==='all'?16:name==='preparation'?3:data.items.filter(p=>p.brand===name).length;
   if(filtered[name]!==expected)throw new Error('필터 분모: '+name);
  }
  await page.locator('[data-filter="all"]').click();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  const targets=await page.evaluate(()=>Array.from(document.querySelectorAll('button,.download,summary')).map(e=>({label:e.textContent,height:e.getBoundingClientRect().height})).filter(x=>x.height<40));
  await page.locator('details').first().locator('summary').click();
  const player=page.locator('video').first();
  await player.evaluate(v=>{v.muted=true;v.load();});
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=1||v.error;});
  const media=await player.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,error:v.error?.code||null}));
  if(media.error)throw new Error('갤러리 영상 열기 오류: '+media.error);
  await player.evaluate(v=>v.play());
  await page.waitForFunction(()=>document.querySelector('video').currentTime>0.25);
  media.playbackAdvanced=await player.evaluate(v=>{v.pause();return v.currentTime>0.25;});
  if(width===1440){
   for(const video of await page.locator('video').all()){
    const metadata=await video.evaluate(v=>new Promise((resolve,reject)=>{
     const finish=()=>resolve({src:v.getAttribute('src'),width:v.videoWidth,height:v.videoHeight,duration:v.duration,error:v.error?.code||null});
     if(v.readyState>=1)return finish();
     v.addEventListener('loadedmetadata',finish,{once:true});v.addEventListener('error',()=>reject(new Error('Video metadata failed')),{once:true});v.load();
    }));
    if(metadata.error||metadata.width!==1080||metadata.height!==1920)throw new Error('영상 메타데이터 불일치: '+metadata.src);
    report.videoMetadata.push(metadata);
   }
   if(report.videoMetadata.length!==7)throw new Error('갤러리 영상 분모 오류');
  }
  const firstCaption=page.locator('details').nth(1);await firstCaption.locator('summary').click();
  if(!(await firstCaption.innerText()).includes(data.items[0].caption.slice(0,20)))throw new Error('접힌 캡션 누락');
  await page.keyboard.press('Tab');
  const focused=await page.evaluate(()=>({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle}));
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(base,'미리보기',`모아보기-${width}.png`),fullPage:false});
  report.viewports.push({width,overflow,filtered,smallTargets:targets,media,keyboardFocus:focused});
  if(width===1440){const links=await page.locator('a[href]').evaluateAll(es=>es.map(e=>e.getAttribute('href')));for(const href of links){if(!/^(https?:|#|mailto:)/.test(href)&&!fs.existsSync(path.resolve(base,decodeURIComponent(href))))report.brokenLinks.push(href);}}
  await context.close();
 }
 await browser.close();
 for(const p of data.items){
  const caption=fs.readFileSync(path.join(base,p.id,'게시문안.txt'),'utf8').trim();
  const count=Array.from(caption).length;
  if(caption!==p.caption.trim())throw new Error('게시 문안 불일치: '+p.id);
  if(p.platform==='Threads'&&count>500)throw new Error('Threads 500자 초과');
  report.captions.push({id:p.id,characters:count,matches:true});
  for(let i=1;i<=p.cards.length;i++)for(const name of [`upload-${String(i).padStart(2,'0')}.jpg`,`master-${String(i).padStart(2,'0')}.png`]){const f=path.join(base,p.id,name);report.deliverables.push({path:p.id+'/'+name,bytes:fs.statSync(f).size,sha256:hash(f)});}
  if(p.format==='video'){const f=path.join(base,p.id,'video.mp4');report.deliverables.push({path:p.id+'/video.mp4',bytes:fs.statSync(f).size,sha256:hash(f)});}
 }
 write(path.join(base,'_검토/납품_QA.json'),report);
 const failed=report.brokenLinks.length||report.pageErrors.length||report.viewports.some(x=>x.overflow||x.smallTargets.length);
 console.log(JSON.stringify({viewports:report.viewports,brokenLinks:report.brokenLinks,errors:report.pageErrors,deliverables:report.deliverables.length},null,2));
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
