const fs=require('node:fs');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
for(const size of [{width:1280,height:900},{width:390,height:844}]){
const page=await browser.newPage({viewport:size});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5197/video-v11/preview.html?revision=14');await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('video').currentTime>.7);const playback=await page.locator('video').evaluate(v=>({time:v.currentTime,paused:v.paused,muted:v.muted,duration:v.duration,width:v.videoWidth,height:v.videoHeight}));await page.locator('#play').click();
await page.locator('#sound').click();const muted=await page.locator('video').evaluate(v=>v.muted);await page.locator('#sound').click();
await page.getByRole('button',{name:/요청문 입력/}).click();const chapter=await page.locator('video').evaluate(v=>v.currentTime);
await page.waitForFunction(()=>Math.abs(Number(document.querySelector('.video-stage').dataset.frameTime)-29.15)<.1);
const visibleFrame=await page.locator('canvas').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let dark=0;for(let i=0;i<p.length;i+=4)if(p[i]<180&&p[i+1]<180&&p[i+2]<180)dark++;return{darkPixels:dark,totalPixels:c.width*c.height};});
if(visibleFrame.darkPixels<1000)throw Error('Canvas frame is blank');
await page.screenshot({path:`verification/preview-${size.width}.png`,fullPage:true});
const downloads=[];for(const link of await page.locator('a[download]').all()){const href=await link.getAttribute('href');const res=await page.request.get(new URL(href,page.url()).href);downloads.push({href,status:res.status(),bytes:(await res.body()).length});}
results.push({size,errors,playback,muteToggle:muted,chapter,visibleFrame,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),downloads});await page.close();}
await browser.close();fs.writeFileSync('verification/preview-qa.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));})();
