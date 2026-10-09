const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path');
const html=`<!doctype html><style>html,body{margin:0}#scene{height:100dvh;width:100%}</style><main id="scene"></main><script type="module">
import * as THREE from '/scene-assets/three.module.js';
import {mountHomeScene} from '/scene-v3.mjs';
const add=THREE.Scene.prototype.add;THREE.Scene.prototype.add=function(...items){if(items.some(item=>item.name==='han-river-passing-launch-v8'))window.worldScene=this;return add.apply(this,items)};
window.study=await mountHomeScene(document.querySelector('#scene'),{reducedMotion:true});study.setOutfit('scarf-apron');
</script>`;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];try{
for(const [name,width,height]of[['desktop',1400,720],['mobile',390,465]]){
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.route('**/__river-life-v8-visibility',route=>route.fulfill({contentType:'text/html',body:html}));
await page.goto('http://127.0.0.1:4296/__river-life-v8-visibility');await page.waitForFunction(()=>window.study?.metrics().frameCount>0);await page.waitForTimeout(350);
const on=await page.screenshot({path:path.join(__dirname,`${name}-with-boat.png`)});
await page.evaluate(()=>{worldScene.getObjectByName('cream-and-navy-river-launch').visible=false;study.setTime('day')});await page.waitForTimeout(200);
const off=await page.screenshot({path:path.join(__dirname,`${name}-without-boat.png`)});
const diff=await page.evaluate(async([a,b])=>{const decode=async str=>{const image=new Image();image.src='data:image/png;base64,'+str;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return{data:ctx.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height}};const first=await decode(a),second=await decode(b);let count=0,left=first.width,top=first.height,right=0,bottom=0;for(let p=0;p<first.data.length;p+=4){if(Math.max(...[0,1,2].map(n=>Math.abs(first.data[p+n]-second.data[p+n])))>8){count++;const x=p/4%first.width,y=Math.floor(p/4/first.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}}return{pixels:count,bounds:[left,top,right,bottom]};},[on.toString('base64'),off.toString('base64')]);
results.push({name,diff,errors,metrics:await page.evaluate(()=>study.metrics().riverLife)});await page.close();
}}finally{await browser.close()}fs.writeFileSync(path.join(__dirname,'visibility.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.some(r=>r.errors.length||r.diff.pixels<(r.name==='desktop'?500:250)))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
