const fs=require('fs'),path=require('path'),cp=require('child_process');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const font=require('../../../tools/lib/브랜드폰트.js');
const dir=__dirname;
const fragment='C:/Users/q1212/.codex/visualizations/2026/09/27/01a0e247-e6df-7b72-af5d-20238b73ce68/synk-academy-restroom-plan.html';
const preview=path.join(path.dirname(fragment),'synk-academy-restroom-preview.html');
const data=JSON.parse(fs.readFileSync(path.join(dir,'공간과_편의시설_좌표_6안.json'),'utf8'));
let source=fs.readFileSync(fragment,'utf8');
source=source.replace(/(<script type="application\/json" id="sr-plan-data">)[\s\S]*?(<\/script>)/,'$1'+JSON.stringify(data).replaceAll('<','\\u003c')+'$2');
if(!source.includes('data-synk-폰트'))source=font.블록()+'\n'+source;
fs.writeFileSync(fragment,source);
if(Buffer.byteLength(source)>=1000000)throw new Error('Visualization exceeds 1MB');
if(/<(?:!doctype|html|head|body)\b/i.test(source))throw new Error('Expected fragment');
cp.execFileSync('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['C:/Users/q1212/.codex/plugins/cache/openai-bundled/visualize/1.0.45/skills/visualize/scripts/render.py',fragment,preview,'--force'],{stdio:'pipe'});
const eps=1e-7;
const intersects=(a,b)=>a.x<b.x+b.w-eps&&a.x+a.w>b.x+eps&&a.y<b.y+b.h-eps&&a.y+a.h>b.y+eps;
const floorItems=(p,m)=>[...p.furniture,...p.appliances,...p.consultation.modes[m].furniture,...p.photoConvenience.fixtures,...p.restrooms.fixtures,...p.operations.fixtures];
const circleHits=(z,f)=>{const x=Math.max(f.x,Math.min(z.cx,f.x+f.w)),y=Math.max(f.y,Math.min(z.cy,f.y+f.h));return (x-z.cx)**2+(y-z.cy)**2<(z.diameter/2)**2-eps;};
function checkGeometry(p){
 const result={};
 if(p.revision!==6||p.rooms.length!==9||p.rooms.some(r=>['lobby','lounge'].includes(r.id)))throw new Error('Revision or rooms mismatch');
 if(p.rooms.filter(r=>r.type==='restroom').length!==2)throw new Error('Missing separate restrooms');
 const total=p.outline.w*p.outline.h,area=p.rooms.reduce((a,r)=>a+r.w*r.h,0),corridor=p.corridor.w*p.corridor.h+p.secondaryCorridors.reduce((a,r)=>a+r.w*r.h,0);
 if(Math.abs(total-267.9)>eps)throw new Error('Changed total area');
 result.areas={rooms:area,corridors:corridor,wallAndDoorJunctionResidual:total-area-corridor,total,pyeong:total/3.305785};
 result.studentDesks={};
 for(const r of p.rooms.filter(r=>r.type==='classroom')){const desks=p.furniture.filter(f=>f.room===r.id&&f.kind==='desk');if(desks.length!==16||desks.some(d=>Math.abs(d.w*d.h-.27)>eps))throw new Error('Classroom desk mismatch');result.studentDesks[r.id]=desks.length;}
 result.officeDesks=p.furniture.filter(f=>f.room==='office'&&f.kind==='desk').length;
 if(result.officeDesks!==8)throw new Error('Office desk count');
 if(p.appliances.length!==14)throw new Error('Need 14 appliances');
 for(const r of p.rooms.filter(r=>r.type!=='restroom'))for(const k of ['AP','H'])if(p.appliances.filter(a=>a.room===r.id&&a.kind===k).length!==1)throw new Error('Room appliance missing '+r.id+k);
 if(p.appliances.some(a=>a.room.startsWith('WC-'))||p.cameras.some(c=>c.room.startsWith('WC-')))throw new Error('WC must have no camera or humidifier');
 result.appliances={AP:7,H:7,status:'Footprints only; manufacturer service clearance untested'};
 for(const mode of ['vr','consult']){
  const items=floorItems(p,mode);
  for(const f of items){const r=p.rooms.find(r=>r.id===f.room);if(f.x<r.x-eps||f.y<r.y-eps||f.x+f.w>r.x+r.w+eps||f.y+f.h>r.y+r.h+eps)throw new Error('Outside room '+JSON.stringify(f));}
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(items[i].room===items[j].room&&intersects(items[i],items[j]))throw new Error('Footprint overlap '+mode+' '+JSON.stringify([items[i],items[j]]));
  for(const d of p.doors.filter(d=>d.swing!=='slide'))for(const f of items.filter(f=>f.room===d.room)){
   const y0=d.swing==='north'?d.y-d.w:d.y,y1=d.swing==='north'?d.y:d.y+d.w,loX=Math.max(f.x,d.x),hiX=Math.min(f.x+f.w,d.x+d.w),loY=Math.max(f.y,y0),hiY=Math.min(f.y+f.h,y1);
   if(loX<hiX&&loY<hiY){const nx=Math.max(loX,Math.min(d.x,hiX)),ny=Math.max(loY,Math.min(d.y,hiY));if((nx-d.x)**2+(ny-d.y)**2<d.w*d.w-eps)throw new Error('Door overlap '+mode+' '+JSON.stringify(f));}
  }
  if(mode==='vr')for(const f of items.filter(f=>f.room==='consult'))if(intersects(f,p.consultation.vrClearZone))throw new Error('VR clear zone occupied '+f.kind);
  result[mode+'Footprints']='Inside rooms; no pair overlap; no normal-door swing sector overlap';
 }
 if(p.consultation.modes.vr.furniture.find(f=>f.kind==='chair-rack').storedCount!==4)throw new Error('Chair storage count');
 result.vrClearZone=p.consultation.vrClearZone;
 result.overheadShelf='Above folded table; vertical clearance and installation untested';
 result.operations=p.operations.validation;
 if(p.operations.fixtures.length!==14||p.operations.supplement.newFloorFixtures!==0)throw new Error('Supplement must preserve floor fixtures');
 const internal=[...p.operations.containedItems,...p.operations.deskAccessories.staffCompartments],parents=[...p.operations.fixtures,...p.photoConvenience.fixtures,...p.furniture];
 for(const f of internal){const parent=parents.find(q=>q.id===f.containedIn||q.kind===f.containedIn);if(!parent||f.floorOccupancy||f.x<parent.x-eps||f.y<parent.y-eps||f.x+f.w>parent.x+parent.w+eps||f.y+f.h>parent.y+parent.h+eps||f.z<0||f.z+f.height>parent.height+eps)throw new Error('Internal containment '+f.id);}
 const volumes=[...internal,...p.operations.countertopItems];for(let i=0;i<volumes.length;i++)for(let j=i+1;j<volumes.length;j++){const a=volumes[i],b=volumes[j];if(a.room===b.room&&Math.min(a.z+a.height,b.z+b.height)>Math.max(a.z,b.z)+eps&&intersects(a,b))throw new Error('Internal volume collision '+a.id+'/'+b.id);}
 for(const u of p.operations.deskAccessories.staffUnits)for(const f of internal.filter(f=>f.containedIn===u.deskId))if(intersects(f,u.kneeClearZone))throw new Error('Staff knee reserve blocked '+f.id);
 if(internal.filter(f=>f.kind==='loan-pen-tray').reduce((s,f)=>s+f.quantity,0)!==8||p.operations.deskAccessories.staffUnits.length!==8)throw new Error('Supplement count mismatch');
 result.supplement={revision:p.operations.supplement.revision,inventory:p.operations.supplement.inventory.map(f=>({id:f.id,quantity:f.quantity,unit:f.unit})),containedItems:p.operations.containedItems.length,staffCompartments:p.operations.deskAccessories.staffCompartments.length,volumeCheck:'Inside parent XY and height; no volume collisions; staff knee reserve unoccupied. Schematic only.'};
 for(const c of p.cameras)for(const f of floorItems(p,'vr').filter(f=>f.room===c.room))for(let i=0;i<=100;i++){const x=c.x+(c.aim.x-c.x)*i/100,y=c.y+(c.aim.y-c.y)*i/100;if(x>f.x&&x<f.x+f.w&&y>f.y&&y<f.y+f.h)throw new Error('Camera centre line crosses floor footprint '+f.room+f.kind);}
 result.cameraLines='Classroom centre lines clear of schematic footprints; no optical or 3D occlusion test';
 const ph=p.photoConvenience,pc=ph.photoCamera,pr=p.rooms.find(r=>r.id==='photo');
 if(Math.abs(Math.hypot(pc.x-pc.aim.x,pc.y-pc.aim.y)-pc.planDistance)>eps)throw new Error('Photo distance');
 if(Math.abs(ph.frontZone.w*ph.frontZone.h+ph.rearZone.w*ph.rearZone.h-pr.w*pr.h)>eps)throw new Error('Photo zones do not cover room');
 const routeX=pr.x+.6;
 for(let y=pr.y+.1;y<=ph.rearZone.y+.7;y+=.02)for(const f of floorItems(p,'vr').filter(f=>f.room==='photo'))if(routeX>f.x&&routeX<f.x+f.w&&y>f.y&&y<f.y+f.h)throw new Error('Photo entrance path blocked');
 result.photo={frontArea:ph.frontZone.w*ph.frontZone.h,rearArea:ph.rearZone.w*ph.rearZone.h,nominalPassage:ph.separatorPassage.w,planCameraDistance:pc.planDistance,status:'Real equipment and group framing untested'};
 result.restrooms=[];
 for(const r of p.rooms.filter(r=>r.type==='restroom')){
  const fixtures=p.restrooms.fixtures.filter(f=>f.room===r.id),z=p.restrooms.turningZones.find(z=>z.room===r.id),d=p.doors.find(d=>d.room===r.id);
  if(fixtures.filter(f=>f.kind==='toilet').length!==1||fixtures.filter(f=>f.kind==='washbasin').length!==1)throw new Error('Restroom fixture count');
  if(d.swing!=='slide'||d.orientation!=='vertical'||d.clearOpening<.95)throw new Error('WC door metadata');
  if(z.cx-z.diameter/2<r.x-eps||z.cy-z.diameter/2<r.y-eps||z.cx+z.diameter/2>r.x+r.w+eps||z.cy+z.diameter/2>r.y+r.h+eps)throw new Error('Turning circle outside room');
  if(fixtures.some(f=>circleHits(z,f)))throw new Error('Turning circle intersects WC fixture '+r.id);
  const start=d.slideDirection==='south'?d.y+d.w:d.y-d.w,end=d.slideDirection==='south'?d.y+2*d.w:d.y;
  if(start<r.y-eps||end>r.y+r.h+eps)throw new Error('Sliding door travel leaves room wall');
  result.restrooms.push({id:r.id,area:r.w*r.h,fixtures:fixtures.map(f=>f.kind),turningCircle:z.diameter,doorClearOpening:d.clearOpening,slidingTravel:[start,end],status:'Schematic clearance only; accessibility compliance and site conditions unverified'});
 }
 return result;
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:780,height:1200},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('file:///'+preview.replaceAll('\\','/'));await page.waitForTimeout(350);
 const frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForSelector('.sr-plan');await frame.evaluate(()=>document.fonts.ready);
 const plan=await frame.evaluate(()=>document.getElementById('synk-restroom-plan').floorPlanData),report={fragmentBytes:Buffer.byteLength(source),geometry:checkGeometry(plan),screens:[],interactions:[],errors};
 for(const width of [780,640,390,320]){
  await page.setViewportSize({width,height:1400});
  for(const room of ['all','A','B','C','D','office','consult','photo','corridor','restrooms']){
   await frame.locator('#sr-room').selectOption(room);
   for(const mode of room==='consult'?['vr','consult']:['vr']){
    await frame.locator('#sr-mode').selectOption(mode,{force:true});await page.waitForTimeout(100);
    const info=await frame.evaluate(()=>{const svg=document.querySelector('.sr-plan'),s=svg.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,rooms:document.querySelectorAll('.sr-room').length,svg:{width:s.width,height:s.height},minSvgFont:Math.min(...[...svg.querySelectorAll('text')].map(n=>parseFloat(getComputedStyle(n).fontSize))),minBodyFont:Math.min(...[...document.querySelectorAll('#synk-restroom-plan span,#synk-restroom-plan select,.sr-detail,.sr-note')].map(n=>parseFloat(getComputedStyle(n).fontSize)))}});
    if(info.scrollWidth>info.width+1)throw new Error('Overflow '+width+' '+room);if(info.rooms!==9||info.minSvgFont<11||info.minBodyFont<11)throw new Error('Room/font issue');
    if(room==='all'&&(await frame.locator('[data-appliance="AP"]').count()!==7||await frame.locator('[data-appliance="H"]').count()!==7||await frame.locator('[data-camera]').count()!==4))throw new Error('Appliance/camera mark count');
    if(room==='consult'){
     const counts=await frame.evaluate(()=>({vr:document.querySelectorAll('[data-vr-zone]').length,chairs:document.querySelectorAll('[data-kind="folding-chair"]').length,rack:document.querySelectorAll('[data-kind="chair-rack"]').length}));
     if(mode==='vr'&&(counts.vr!==1||counts.chairs!==0||counts.rack!==1))throw new Error('VR mode failed');if(mode==='consult'&&(counts.vr!==0||counts.chairs!==4||counts.rack!==0))throw new Error('Consult mode failed');report.interactions.push({room,mode,counts});
    }
    if(room==='restrooms'){
     const counts={toilets:await frame.locator('[data-wc-fixture="toilet"]').count(),basins:await frame.locator('[data-wc-fixture="washbasin"]').count(),doors:await frame.locator('[data-sliding-door]').count(),circles:await frame.locator('[data-turning-zone]').count()};if(Object.values(counts).some(n=>n!==2))throw new Error('WC view incomplete');report.interactions.push({room,counts});
    }
    await frame.locator('#synk-restroom-plan').screenshot({path:path.join(dir,`v6-preview-${width}-${room}-${mode}.png`)});report.screens.push({viewport:width,room,mode,...info});
   }
  }
 }
 for(const width of [640,320])for(const room of ['A','office','consult','photo','all','corridor']){
  await page.setViewportSize({width,height:1600});await frame.locator('#sr-room').selectOption(room);await frame.locator('.sr-storage').evaluate(e=>e.open=true);await page.waitForTimeout(80);
  const check=await frame.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,items:document.querySelectorAll('[data-storage-item]').length,minFont:Math.min(...[...document.querySelectorAll('.sr-storage-diagram text,.sr-storage-list div')].map(n=>parseFloat(getComputedStyle(n).fontSize)))}));
  if(check.scrollWidth>check.width+1||check.minFont<11)throw new Error('Storage detail overflow/font '+room+' '+width);if(['A','office','consult','photo'].includes(room)&&check.items===0)throw new Error('Storage details missing '+room);
  await frame.locator('#synk-restroom-plan').screenshot({path:path.join(dir,`v6-storage-${width}-${room}.png`)});report.interactions.push({type:'storage-detail',room,width,...check});await frame.locator('.sr-storage').evaluate(e=>e.open=false);
 }
 async function exportImage(room,mode,base,storageParent=null){
  await page.setViewportSize({width:room==='all'?1040:640,height:1400});await frame.locator('#sr-room').selectOption(room);await frame.locator('#sr-mode').selectOption(mode,{force:true});await page.waitForTimeout(120);
  await frame.locator('.sr-storage').evaluate((e,open)=>e.open=open,!!storageParent);
  const svg=await frame.evaluate(storageParent=>{const src=storageParent?document.querySelector(`[data-storage-parent="${storageParent}"]`):document.querySelector('.sr-plan'),out=src.cloneNode(true),a=[src,...src.querySelectorAll('*')],b=[out,...out.querySelectorAll('*')];a.forEach((n,i)=>{const s=getComputedStyle(n);for(const key of ['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','opacity','font-family','font-size','font-weight','text-anchor','dominant-baseline'])b[i].style.setProperty(key,s.getPropertyValue(key));});out.setAttribute('xmlns','http://www.w3.org/2000/svg');return out.outerHTML;},storageParent);
  fs.writeFileSync(path.join(dir,base+'.svg'),svg.replace(/(<svg\b[^>]*>)/,'$1<style>'+font.면()+'</style>'));await frame.locator('.viz-controls').evaluate(e=>e.style.display='none');await frame.locator('#synk-restroom-plan').screenshot({path:path.join(dir,base+'.png')});await frame.locator('.viz-controls').evaluate(e=>e.style.display='');
 }
 await exportImage('all','vr','SYNK_공간편의배치_6안');await exportImage('consult','vr','SYNK_상담실_VR모드_6안');await exportImage('consult','consult','SYNK_상담실_상담모드_6안');await exportImage('photo','vr','SYNK_사진편의실_6안');await exportImage('restrooms','vr','SYNK_남녀화장실_6안');
 await exportImage('B','vr','SYNK_교실수납_B_6안');await exportImage('D','vr','SYNK_교실수납_D_6안');await exportImage('office','vr','SYNK_사무실_운영수납_6안');await exportImage('corridor','vr','SYNK_입구와기록벽_6안');await exportImage('A','vr','SYNK_메인룸_수업모드_6안');
 await exportImage('office','vr','SYNK_사무실_공용장내부_6안','PRINT-O');await exportImage('office','vr','SYNK_직원책상_내부구획_6안','OFFICE-DESK-01');await exportImage('photo','vr','SYNK_잔음료컵수거_내부구획_6안','coffee-counter');await exportImage('consult','vr','SYNK_관리장_내부구획_6안','CARE-LOCK');
 await frame.locator('#sr-main-mode').selectOption('dance',{force:true});await exportImage('A','vr','SYNK_메인룸_댄스모드_6안');const danceCounts=await frame.evaluate(()=>({AStudentDesks:document.querySelectorAll('[data-furniture-room="A"][data-kind="desk"]').length,tableCarts:document.querySelectorAll('[data-furniture-room="A"][data-kind="table-cart"]').length,chairStacks:document.querySelectorAll('[data-furniture-room="A"][data-kind="chair-stack"]').length}));if(danceCounts.AStudentDesks!==0||danceCounts.tableCarts!==2||danceCounts.chairStacks!==4)throw new Error('A dance transition');report.interactions.push({room:'A',mode:'dance',counts:danceCounts});await frame.locator('#sr-main-mode').selectOption('lecture',{force:true});
 await page.setViewportSize({width:780,height:1400});await page.emulateMedia({colorScheme:'dark'});
 for(const room of ['all','restrooms']){await frame.locator('#sr-room').selectOption(room);await page.waitForTimeout(100);await frame.locator('#synk-restroom-plan').screenshot({path:path.join(dir,`v6-preview-dark-${room}.png`)});}
 if(errors.length)throw new Error(errors.join('\n'));
 fs.writeFileSync(path.join(dir,'verification-v6.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({fragmentBytes:report.fragmentBytes,geometry:report.geometry,screenChecks:report.screens.length,interactionChecks:report.interactions.length,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
