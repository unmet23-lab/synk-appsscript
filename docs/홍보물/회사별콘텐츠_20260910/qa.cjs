'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL,fileURLToPath}=require('node:url');
const {chromium}=require('playwright'),sharp=require('sharp');
const dir=__dirname,out=path.join(dir,'_검토');
const all=fs.readdirSync(dir,{recursive:true}).filter(f=>/\.html$/.test(f)&&!f.startsWith('_검토'));
(async()=>{
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const issues=[],screens=[];page.on('pageerror',e=>issues.push({type:'pageerror',message:e.message}));
let refs=0;
for(const f of all){await page.goto(pathToFileURL(path.join(dir,f)).href);await page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll("img").forEach(i=>i.loading="eager");await Promise.all([...document.images].map(i=>i.decode()))});const links=await page.locator('[href],[src]').evaluateAll(es=>es.flatMap(e=>[e.getAttribute('href'),e.getAttribute('src')]).filter(Boolean));
for(const href of links){if(/^(?:https?:|data:|blob:|#|mailto:)/.test(href))continue;const file=fileURLToPath(new URL(href,pathToFileURL(path.join(dir,f))));refs++;if(!fs.existsSync(file)&&!file.endsWith('업로드_전체.zip'))issues.push({file:f,missing:href})}
if(!f.endsWith('cards.html'))for(const width of [1440,390]){await page.setViewportSize({width,height:1000});const r=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,missing:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src'))}));if(r.scroll>width+1||r.missing.length)issues.push({file:f,...r});if(f==='index.html'){const name=`웹-${width}.png`;await page.screenshot({path:path.join(out,name),fullPage:true});screens.push(name)}}
await page.setViewportSize({width:1440,height:1000});}
const downloads=[];
for(const folder of ['01-lab','02-shift','04-synk']){await page.goto(pathToFileURL(path.join(dir,folder,'직접작성.html')).href);const original=await page.locator('#work').inputValue();if(original.length<30)issues.push({file:folder,emptyTemplate:false});const text='Туршилт / 검증용 예시\n금요일 오후 두 시\n사용처: 현장 안내';await page.locator('#work').fill(text);await page.locator('#work').press('Tab');const dlPromise=page.waitForEvent('download');await page.locator('#save').click();const dl=await dlPromise;const actual=fs.readFileSync(await dl.path(),'utf8');downloads.push({folder,exact:actual===text,templateChars:original.length});if(actual!==text)issues.push({file:folder,downloadMismatch:true});}
await page.goto(pathToFileURL(path.join(dir,'03-pulse/index.html')).href);await page.locator('video').evaluate(v=>new Promise(resolve=>{if(v.readyState>=1)return resolve();v.addEventListener('loadedmetadata',resolve,{once:true})}));const video=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,controls:v.controls,autoplay:v.autoplay}));if(Math.abs(video.duration-61.6)>.1||!video.controls||video.autoplay)issues.push({video});
const cards=[];for(const folder of ['01-lab','02-shift','03-pulse','04-synk'])for(const f of fs.readdirSync(path.join(dir,folder)).filter(f=>/^upload-\d+\.jpg$/.test(f))){const m=await sharp(path.join(dir,folder,f)).metadata();cards.push({file:folder+'/'+f,width:m.width,height:m.height});if(m.width!==1080||m.height!==1350)issues.push({image:f,...m})}
const result={at:new Date().toISOString(),html:all.length,localReferences:refs,downloads,video,cards:cards.length,issues,screens};fs.writeFileSync(path.join(out,'웹파일검증.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(issues.length)process.exitCode=1;
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
