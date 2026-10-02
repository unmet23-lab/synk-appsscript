const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const font = require('../../../tools/lib/브랜드폰트.js');
const dir = __dirname;
const fragment = 'C:/Users/q1212/.codex/visualizations/2026/09/27/01a0e247-e6df-7b72-af5d-20238b73ce68/synk-academy-compact-plan.html';
const preview = path.join(path.dirname(fragment), 'synk-academy-compact-preview.html');
let source = fs.readFileSync(fragment, 'utf8');
if (!source.includes('data-synk-폰트')) {
 source = font.블록() + '\n' + source;
 fs.writeFileSync(fragment, source);
}
if (Buffer.byteLength(source) >= 1000000) throw new Error('Visualization exceeds size budget');
if (/<(?:!doctype|html|head|body)\b/i.test(source)) throw new Error('Expected an HTML fragment');
cp.execFileSync('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',[
 'C:/Users/q1212/.codex/plugins/cache/openai-bundled/visualize/1.0.41/skills/visualize/scripts/render.py',fragment,preview,'--force'
],{stdio:'pipe'});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:780,height:1000},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+preview.replaceAll('\\','/'));
 await page.waitForTimeout(700);
 const frame=page.frames().find(f=>f!==page.mainFrame());
 await frame.waitForSelector('.sf-plan');await frame.evaluate(()=>document.fonts.ready);
 const report={fragmentBytes:Buffer.byteLength(source),screens:[],interaction:null,errors};
 for(const width of [780,390,320]){
  await page.setViewportSize({width,height:1100});await page.waitForTimeout(200);
  const info=await frame.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,rooms:document.querySelectorAll('.sf-room').length,labels:[...document.querySelectorAll('.sf-plan text')].map(n=>({text:n.textContent,fontSize:parseFloat(getComputedStyle(n).fontSize)}))}));
  if(info.scrollWidth>info.width+1)throw new Error('Horizontal overflow at '+width);
  if(info.rooms!==7)throw new Error('Missing rooms or removed lobby still present');
  if(info.labels.some(n=>n.fontSize<11))throw new Error('Tiny labels');
  await frame.locator('#synk-compact-plan').screenshot({path:path.join(dir,`v2-preview-${width}.png`)});
  report.screens.push(info);
 }
 await frame.locator('#sf-room-v2').selectOption('office');
 const detail=await frame.locator('.sf-detail').textContent();
 if(!detail.includes('6~8명')||!detail.includes('8자리'))throw new Error('Office selection failed');
 if(await frame.locator('.sf-room.is-selected').getAttribute('data-room')!=='office')throw new Error('Selected room not highlighted');
 report.interaction={selected:'office',detail};
 await frame.locator('#sf-room-v2').selectOption('all');
 await page.setViewportSize({width:1040,height:1100});await page.waitForTimeout(200);
 const exported=await frame.evaluate(()=>{
  const root=document.getElementById('synk-compact-plan'),source=root.querySelector('.sf-plan'),svg=source.cloneNode(true);
  const originals=[source,...source.querySelectorAll('*')],clones=[svg,...svg.querySelectorAll('*')];
  originals.forEach((n,i)=>{
   const s=getComputedStyle(n);
   for(const key of ['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','opacity','font-family','font-size','font-weight','text-anchor','dominant-baseline'])clones[i].style.setProperty(key,s.getPropertyValue(key));
  });
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  return {svg:svg.outerHTML,data:root.floorPlanData};
 });
 const fontStyle='<style>'+font.면()+'</style>';
 exported.svg=exported.svg.replace(/(<svg\b[^>]*>)/,'$1'+fontStyle);
 fs.writeFileSync(path.join(dir,'SYNK_평면배치_2안.svg'),exported.svg);
 fs.writeFileSync(path.join(dir,'평면_좌표_2안.json'),JSON.stringify(exported.data,null,2)+'\n');
 const total=exported.data.rooms.reduce((v,r)=>v+r.w*r.h,0);
 report.areas={rooms:total,corridor:29.76,wall:247-total-29.76,outline:247};
 if(Math.abs(total-195.195)>1e-6)throw new Error('Unexpected room areas');
 const plan=exported.data;
 report.studentDesks={};
 for(const room of plan.rooms){
  const desks=plan.furniture.filter(f=>f.room===room.id&&f.kind==='desk');
  if(room.type==='classroom'){
   if(desks.length!==16||desks.some(d=>Math.abs(d.w*d.h-.27)>1e-8))throw new Error('Not sixteen individual desks: '+room.id);
   report.studentDesks[room.id]=desks.length;
  }
  for(const f of plan.furniture.filter(f=>f.room===room.id)){
   if(f.x<room.x||f.y<room.y||f.x+f.w>room.x+room.w+1e-8||f.y+f.h>room.y+room.h+1e-8)throw new Error('Furniture outside room '+room.id);
  }
 }
 // Check that drawn door-swing sectors do not contain desk/chair rectangles.
 for(const door of plan.doors)for(const f of plan.furniture.filter(f=>f.room===door.room)){
  const y0=door.swing==='north'?door.y-door.w:door.y,y1=door.swing==='north'?door.y:door.y+door.w;
  const loX=Math.max(f.x,door.x),hiX=Math.min(f.x+f.w,door.x+door.w),loY=Math.max(f.y,y0),hiY=Math.min(f.y+f.h,y1);
  if(loX<hiX&&loY<hiY){
   const nearX=Math.max(loX,Math.min(door.x,hiX)),nearY=Math.max(loY,Math.min(door.y,hiY));
   if((nearX-door.x)**2+(nearY-door.y)**2<door.w**2-1e-8)throw new Error('Door swing touches furniture in '+door.room);
  }
 }
 report.doorFurnitureCheck='No intersections in the schematic coordinates';
 // A high-resolution overview includes assumptions so the image cannot be mistaken for a measured plan.
 await frame.locator('#synk-compact-plan').evaluate(el=>el.querySelector('.viz-controls').style.display='none');
 await frame.locator('#synk-compact-plan').screenshot({path:path.join(dir,'SYNK_평면배치_2안.png')});
 await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(200);
 await frame.locator('#synk-compact-plan').screenshot({path:path.join(dir,'v2-preview-dark.png')});
 if(errors.length)throw new Error(errors.join('\n'));
 fs.writeFileSync(path.join(dir,'verification-v2.json'),JSON.stringify(report,null,2)+'\n');
 await browser.close();console.log(JSON.stringify({fragmentBytes:report.fragmentBytes,areas:report.areas,studentDesks:report.studentDesks,doorFurnitureCheck:report.doorFurnitureCheck,interaction:report.interaction,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
