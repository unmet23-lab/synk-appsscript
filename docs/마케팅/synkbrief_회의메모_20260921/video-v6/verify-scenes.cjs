const fs=require('node:fs');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5197/video-v6/index.html');await page.evaluate(()=>document.fonts.ready);
const scenes=JSON.parse(fs.readFileSync('scenes.json','utf8')),issues=[];
for(const scene of scenes){
 const at=scene.start+scene.duration-1;
 const result=await page.evaluate(({id,at})=>{
 document.querySelectorAll('.clip').forEach(e=>e.style.display=e.id===id?'block':'none');window.__timelines.main.seek(at);
 const sel='#'+id;
 return [...document.querySelectorAll(sel+' h1,'+sel+' .caption,'+sel+' .label,'+sel+' .setup-request,'+sel+' .note,'+sel+' .end-cta')].flatMap(e=>{const r=e.getBoundingClientRect();return r.right>1015||r.bottom>1785||r.left<60?[{text:e.textContent.slice(0,65),x:r.x,y:r.y,right:r.right,bottom:r.bottom}]:[]});
 },{id:scene.id,at});
 issues.push(...result.map(e=>({scene:scene.id,...e})));
 await page.screenshot({path:'verification/scene-'+scene.id+'.png'});
}
fs.writeFileSync('verification/scene-qa.json',JSON.stringify({errors,issues},null,2));await browser.close();console.log(JSON.stringify({errors,issues}));
})();

