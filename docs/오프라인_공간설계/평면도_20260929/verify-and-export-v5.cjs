const fs=require('fs'),path=require('path'),cp=require('child_process');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const font=require('../../../tools/lib/브랜드폰트.js');
const dir=__dirname;
const fragment='C:/Users/q1212/.codex/visualizations/2026/09/27/01a0e247-e6df-7b72-af5d-20238b73ce68/synk-academy-amenity-plan.html';
const preview=path.join(path.dirname(fragment),'synk-academy-amenity-preview.html');
let source=fs.readFileSync(fragment,'utf8');
if(!source.includes('data-synk-폰트')){source=font.블록()+'\n'+source;fs.writeFileSync(fragment,source);}
if(Buffer.byteLength(source)>=1000000)throw new Error('Visualization exceeds1MB');
if(/<(?:!doctype|html|head|body)\b/i.test(source))throw new Error('Expected fragment');
cp.execFileSync('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['C:/Users/q1212/.codex/plugins/cache/openai-bundled/visualize/1.0.41/skills/visualize/scripts/render.py',fragment,preview,'--force'],{stdio:'pipe'});
const intersects=(a,b)=>a.x<b.x+b.w-1e-7&&a.x+a.w>b.x+1e-7&&a.y<b.y+b.h-1e-7&&a.y+a.h>b.y+1e-7;
const floorItems=(p,m)=>[...p.furniture,...p.appliances,...p.consultation.modes[m].furniture,...p.photoConvenience.fixtures];
function checkGeometry(p){
 const result={};
 if(p.rooms.length!==7||p.rooms.some(r=>['lobby','lounge'].includes(r.id)))throw new Error('Room count/removed lobby');
 const area=p.rooms.reduce((a,r)=>a+r.w*r.h,0),corridor=p.corridor.w*p.corridor.h;
 if(Math.abs(area-195.195)>1e-6||p.outline.w*p.outline.h!==247)throw new Error('Changed area');
 result.areas={rooms:area,corridor,wallPlanningArea:247-area-corridor,total:247};
 result.studentDesks={};
 for(const r of p.rooms.filter(r=>r.type==='classroom')){
  const desks=p.furniture.filter(f=>f.room===r.id&&f.kind==='desk');
  if(desks.length!==16||desks.some(d=>Math.abs(d.w*d.h-.27)>1e-8))throw new Error('Classroom desk mismatch');
  result.studentDesks[r.id]=desks.length;
 }
 if(p.furniture.filter(f=>f.room==='office'&&f.kind==='desk').length!==8)throw new Error('Office desk mismatch');
 if(p.appliances.length!==14)throw new Error('Need14 appliances');
 for(const r of p.rooms)for(const k of ['AP','H'])if(p.appliances.filter(a=>a.room===r.id&&a.kind===k).length!==1)throw new Error('Room appliance missing '+r.id+k);
 result.appliances={AP:7,H:7,footprints:'AP0.38×0.38m / H0.30×0.30m assumed; service clearances untested'};
 for(const mode of ['vr','consult']){
  const items=floorItems(p,mode);
  for(const f of items){const r=p.rooms.find(r=>r.id===f.room);if(f.x<r.x-1e-7||f.y<r.y-1e-7||f.x+f.w>r.x+r.w+1e-7||f.y+f.h>r.y+r.h+1e-7)throw new Error('Outside room '+JSON.stringify(f));}
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(items[i].room===items[j].room&&intersects(items[i],items[j]))throw new Error('Footprint overlap '+mode+' '+JSON.stringify([items[i],items[j]]));
  for(const d of p.doors)for(const f of items.filter(f=>f.room===d.room)){
   const y0=d.swing==='north'?d.y-d.w:d.y,y1=d.swing==='north'?d.y:d.y+d.w;
   const loX=Math.max(f.x,d.x),hiX=Math.min(f.x+f.w,d.x+d.w),loY=Math.max(f.y,y0),hiY=Math.min(f.y+f.h,y1);
   if(loX<hiX&&loY<hiY){const nx=Math.max(loX,Math.min(d.x,hiX)),ny=Math.max(loY,Math.min(d.y,hiY));if((nx-d.x)**2+(ny-d.y)**2<d.w*d.w-1e-8)throw new Error('Door overlap '+mode+' '+JSON.stringify(f));}
  }
  if(mode==='vr')for(const f of items.filter(f=>f.room==='consult'))if(intersects(f,p.consultation.vrClearZone))throw new Error('VR clear zone occupied '+f.kind);
  result[mode+'Footprints']='Inside rooms; no pair overlap; no door-swing sector overlap in schematic';
 }
 if(p.consultation.modes.vr.furniture.find(f=>f.kind==='chair-rack').storedCount!==4)throw new Error('Chair rack does not account for4 chairs');
 result.vrClearZone=p.consultation.vrClearZone;
 result.storage=p.consultation.modes.vr.furniture;
 result.overheadShelf='Shares plan projection above folded table; vertical clearance/installation height untested';
 for(const c of p.cameras){
  for(const f of floorItems(p,'vr').filter(f=>f.room===c.room))for(let i=0;i<=100;i++){const x=c.x+(c.aim.x-c.x)*i/100,y=c.y+(c.aim.y-c.y)*i/100;if(x>f.x&&x<f.x+f.w&&y>f.y&&y<f.y+f.h)throw new Error('Camera center line crosses fixture '+f.room+f.kind);}
 }
 const ph=p.photoConvenience,pc=ph.photoCamera;
 if(Math.abs(Math.hypot(pc.x-pc.aim.x,pc.y-pc.aim.y)-1.4)>1e-7)throw new Error('Photo distance');
 if(Math.abs(ph.frontZone.w*ph.frontZone.h+ph.rearZone.w*ph.rearZone.h-8.815)>1e-7)throw new Error('Photo zone areas');
 // Points along the intended passage through the room, before the photographer target.
 for(let y=8.80;y<=10.9;y+=.02)for(const f of floorItems(p,'vr').filter(f=>f.room==='photo'))if(17.25>f.x&&17.25<f.x+f.w&&y>f.y&&y<f.y+f.h)throw new Error('Photo entrance route blocked');
 result.cameraLines='Classroom center lines clear of modelled floor items; no3D occlusion or optical test';
 result.photo={frontArea:ph.frontZone.w*ph.frontZone.h,rearArea:ph.rearZone.w*ph.rearZone.h,nominalPassage:ph.separatorPassage.w,planCameraDistance:pc.planDistance,status:'Camera, printer, clearance and group framing untested'};
 return result;
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:780,height:1000},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+preview.replaceAll('\\','/'));await page.waitForTimeout(500);
 const frame=page.frames().find(f=>f!==page.mainFrame());
 await frame.waitForSelector('.sa-plan');await frame.evaluate(()=>document.fonts.ready);
 const plan=await frame.evaluate(()=>document.getElementById('synk-amenity-plan').floorPlanData);
 const report={fragmentBytes:Buffer.byteLength(source),geometry:checkGeometry(plan),screens:[],interactions:[],errors};
 for(const width of [780,640,390,320]){
  await page.setViewportSize({width,height:1200});
  for(const room of ['all','consult','photo']){
   await frame.locator('#sa-room').selectOption(room);
   const modes=room==='consult'?['vr','consult']:['vr'];
   for(const mode of modes){
    await frame.locator('#sa-mode').selectOption(mode);await page.waitForTimeout(120);
    const info=await frame.evaluate(()=>{const svg=document.querySelector('.sa-plan'),s=svg.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,rooms:document.querySelectorAll('.sa-room').length,svg:{width:s.width,height:s.height},labels:[...svg.querySelectorAll('text')].map(n=>({text:n.textContent,fontSize:parseFloat(getComputedStyle(n).fontSize)})),minBodyFont:Math.min(...[...document.querySelectorAll('#synk-amenity-plan span,#synk-amenity-plan select,.sa-detail,.sa-note')].map(n=>parseFloat(getComputedStyle(n).fontSize)))}});
    if(info.scrollWidth>info.width+1)throw new Error('Overflow '+width+' '+room);
    if(info.rooms!==7||info.labels.some(n=>n.fontSize<11)||info.minBodyFont<11)throw new Error('Room/font issue');
    if(room==='all'){
     if(await frame.locator('[data-appliance="AP"]').count()!==7||await frame.locator('[data-appliance="H"]').count()!==7)throw new Error('Missing appliance marks');
     if(await frame.locator('[data-camera]').count()!==4)throw new Error('Missing classroom camera');
    }
    if(room==='consult'){
     const counts=await frame.evaluate(()=>({vr:document.querySelectorAll('[data-vr-zone]').length,chairs:document.querySelectorAll('[data-kind="folding-chair"]').length,rack:document.querySelectorAll('[data-kind="chair-rack"]').length}));
     if(mode==='vr'&&(counts.vr!==1||counts.chairs!==0||counts.rack!==1))throw new Error('VR mode failed');
     if(mode==='consult'&&(counts.vr!==0||counts.chairs!==4||counts.rack!==0))throw new Error('Consult mode failed');
     report.interactions.push({room,mode,counts});
    }
    const filename=`v5-preview-${width}-${room}-${mode}.png`;
    await frame.locator('#synk-amenity-plan').screenshot({path:path.join(dir,filename)});
    report.screens.push({viewport:width,room,mode,...info});
   }
  }
 }
 await page.setViewportSize({width:1040,height:1200});
 async function exportImage(room,mode,base){
  await page.setViewportSize({width:room==='all'?1040:640,height:1200});
  await frame.locator('#sa-room').selectOption(room);await frame.locator('#sa-mode').selectOption(mode);await page.waitForTimeout(150);
  const svg=await frame.evaluate(()=>{const src=document.querySelector('.sa-plan'),out=src.cloneNode(true),a=[src,...src.querySelectorAll('*')],b=[out,...out.querySelectorAll('*')];a.forEach((n,i)=>{const s=getComputedStyle(n);for(const key of ['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','opacity','font-family','font-size','font-weight','text-anchor','dominant-baseline'])b[i].style.setProperty(key,s.getPropertyValue(key));});out.setAttribute('xmlns','http://www.w3.org/2000/svg');return out.outerHTML;});
  fs.writeFileSync(path.join(dir,base+'.svg'),svg.replace(/(<svg\b[^>]*>)/,'$1<style>'+font.면()+'</style>'));
  await frame.locator('.viz-controls').evaluate(e=>e.style.display='none');
  await frame.locator('#synk-amenity-plan').screenshot({path:path.join(dir,base+'.png')});
  await frame.locator('.viz-controls').evaluate(e=>e.style.display='');
 }
 await exportImage('all','vr','SYNK_공간편의배치_5안');
 await exportImage('consult','vr','SYNK_상담실_VR모드_5안');
 await exportImage('consult','consult','SYNK_상담실_상담모드_5안');
 await exportImage('photo','vr','SYNK_사진편의실_5안');
 await frame.locator('#sa-room').selectOption('all');await frame.locator('#sa-mode').selectOption('vr');
 await page.setViewportSize({width:780,height:1200});
 await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(150);
 await frame.locator('#synk-amenity-plan').screenshot({path:path.join(dir,'v5-preview-dark.png')});
 if(errors.length)throw new Error(errors.join('\n'));
 fs.writeFileSync(path.join(dir,'verification-v5.json'),JSON.stringify(report,null,2)+'\n');
 await browser.close();
 console.log(JSON.stringify({fragmentBytes:report.fragmentBytes,geometry:report.geometry,screenChecks:report.screens.length,interactionChecks:report.interactions.length,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
