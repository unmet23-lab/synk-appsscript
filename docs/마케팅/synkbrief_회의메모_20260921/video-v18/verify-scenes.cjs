const fs=require('node:fs');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5197/video-v18/index.html');await page.evaluate(()=>document.fonts.ready);
const scenes=JSON.parse(fs.readFileSync('scenes.json','utf8')),issues=[];
for(const scene of scenes){
 const at=scene.start+scene.duration-1;
 const result=await page.evaluate(({id,at})=>{
 document.querySelectorAll('.clip').forEach(e=>e.style.display=e.id===id?'block':'none');window.__timelines.main.seek(at);
 const sel='#'+id;
 const root=document.querySelector(sel),found=[];
 const region=root.querySelector('.scene-content').getBoundingClientRect();
 for(const el of root.querySelectorAll('.scene-content > *')){
  const r=el.getBoundingClientRect();
  if(r.top<region.top-1||r.bottom>region.bottom+1)found.push({kind:'content overflow',class:el.className,top:r.top,bottom:r.bottom,region:[region.top,region.bottom]});
 }
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode,parent=node.parentElement;
  if(!node.textContent.trim()||parent.closest('.camera-world,.wipe,script'))continue;
  let visible=true;
  for(let a=parent;a&&a!==root;a=a.parentElement){const cs=getComputedStyle(a);if(Number(cs.opacity)<.02||cs.display==='none'||cs.visibility==='hidden')visible=false;}
  if(!visible)continue;
  const range=document.createRange();range.selectNodeContents(node);
  for(const r of range.getClientRects()){
   if(r.left<59||r.right>1021||r.top<66||r.bottom>1802)found.push({kind:'text outside safe area',text:node.textContent.slice(0,65),x:r.x,y:r.y,right:r.right,bottom:r.bottom});
   const caption=parent.closest('.caption');
   if(caption&&r.bottom>caption.getBoundingClientRect().bottom+1)found.push({kind:'caption overflow',text:node.textContent.slice(0,65)});
  }
 }
 return found;
 },{id:scene.id,at});
 issues.push(...result.map(e=>({scene:scene.id,...e})));
 await page.screenshot({path:'verification/scene-'+scene.id+'.png'});
}
fs.writeFileSync('verification/scene-qa.json',JSON.stringify({errors,issues},null,2));await browser.close();console.log(JSON.stringify({errors,issues}));
})();


