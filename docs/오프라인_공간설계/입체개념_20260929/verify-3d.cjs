const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,preview=path.join(dir,'synk-academy-3d-preview.html');
const source=JSON.parse(fs.readFileSync(path.join(dir,'../평면도_20260929/공간과_편의시설_좌표_6안.json'),'utf8'));
const operationItems=[...(source.operations?.fixtures||[]),...(source.operations?.countertopItems||[]),...(source.operations?.wallItems||[]),...(source.operations?.floorZones||[]),...(source.operations?.containedItems||[]),...(source.operations?.deskAccessories?.staffCompartments||[])];
const sourceParents=[...source.operations.fixtures,...source.photoConvenience.fixtures,...source.furniture];
const storageItems=[...(source.operations?.containedItems||[]),...(source.operations?.deskAccessories?.staffCompartments||[]),...source.operations.countertopItems.filter(f=>{const p=sourceParents.find(p=>(p.id||p.kind)===f.containedIn);return p&&(f.z||0)+f.height<=(p.height||.9)+.001;})];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:780,height:1000},deviceScaleFactor:1});
 const errors=[],warnings=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));
 await page.goto('file:///'+preview.replaceAll('\\','/'));
 const frame=page.frames().find(f=>f!==page.mainFrame());
 try{await frame.waitForSelector('#synk-3d-concept[data-ready="true"]',{timeout:45000});}catch(e){console.log(JSON.stringify({errors,warnings,failed,root:await frame.locator('#synk-3d-concept').getAttribute('data-error')}));throw e;}
 const initial=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic);
 if(initial.room!=='A'||initial.mainMode!=='dance'||initial.visibleDesks!==0||initial.mirror.curtain!=='open')throw new Error('Initial view does not show the dance mirror');
 if(initial.operationsAmendment!=='2026-10-01'||!operationItems.length)throw new Error('Operations amendment missing');
 const report={errors,warnings,failed,screens:[],states:[],mainModes:[],storageViews:[],initial,source:'Revision 6 coordinates with 2026-10-01 operations and arrival/departure supplement, independent WCs and A lecture/dance modes; products and installation illustrative',threeVersion:'0.180.0'};
 for(const width of [780,390,320]){
  await page.setViewportSize({width,height:1000});
  await frame.locator('#s3-room').selectOption('A');
  for(const mainMode of ['dance','lecture']){
   await frame.locator('#s3-main-mode').selectOption(mainMode);await page.waitForTimeout(90);
   const view=await frame.evaluate(()=>{const r=document.getElementById('synk-3d-concept');return{...r.conceptDiagnostic,overflow:document.documentElement.scrollWidth>innerWidth};});
   if(view.overflow||view.mainMode!==mainMode||!view.mirror.reflective||view.mirror.height!==2.4||view.visibleDesks!==(mainMode==='dance'?0:16))throw new Error('A mode geometry wrong '+JSON.stringify(view));
   if(!view.visibleLabels.includes(mainMode==='dance'?'전면 풀월 거울 · 커튼 열림':'전면 거울 · 커튼 뒤'))throw new Error('Mirror label hidden '+JSON.stringify(view));
   if(mainMode==='dance'){
    for(const kind of ['desk','chair'])if(view.mainStorage.filter(f=>f.storedKind===kind).reduce((n,f)=>n+f.count,0)!==16)throw new Error('A storage count lost '+kind);
    if(!view.visibleLabels.includes('TV 도킹 후보')){await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,`3d-${width}-A-dance-review.png`)});throw new Error('TV dock label hidden '+JSON.stringify({width,view,labels:await frame.evaluate(()=>[...document.querySelectorAll('.s3-label')].map(e=>({text:e.textContent,hidden:e.hidden,left:e.style.left,top:e.style.top})))}));}
   }else if(view.mainStorage.length)throw new Error('Full furniture storage duplicated in lecture mode');
   await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,`3d-${width}-A-${mainMode}.png`)});report.mainModes.push({width,...view});
  }
  for(const room of ['all','A','B','C','D','office','consult','photo','WC-M','WC-F','corridor']){
   await frame.locator('#s3-room').selectOption(room);await page.waitForTimeout(90);
   const result=await frame.evaluate(()=>{const r=document.getElementById('synk-3d-concept'),visible=[...r.querySelectorAll('label,span,select,.s3-detail')].filter(e=>!e.hidden&&e.getBoundingClientRect().width>0);return{...r.conceptDiagnostic,overflow:document.documentElement.scrollWidth>innerWidth,minFont:Math.min(...visible.map(e=>parseFloat(getComputedStyle(e).fontSize)))};});
   if(result.overflow||result.minFont<11||!result.webgl||result.triangles===0)throw new Error('Invalid render '+JSON.stringify(result));
   if(room==='photo'&&(!result.visibleLabels.includes('P')||!result.visibleLabels.includes('사진 영역')))throw new Error('Photo camera / area labels hidden');
   if(room==='corridor'&&!['수업 안내','지나간 말들'].every(t=>result.visibleLabels.includes(t)))throw new Error('Corridor operating panels hidden '+JSON.stringify(result));
   if(room==='office'&&!result.visibleLabels.includes('A4 복합기'))throw new Error('Office printer label hidden');
   if(['A','B','C','D'].includes(room)&&!result.visibleLabels.includes('C · 상부 후보'))throw new Error('Classroom overhead camera label hidden');
   if(result.rooms!==(room==='all'?9:room==='corridor'?0:1)||result.appliances!==(room==='all'?14:room.startsWith('WC-')||room==='corridor'?0:2)||result.desks!==(room==='all'?72:['A','B','C','D'].includes(room)?16:room==='office'?8:0))throw new Error('Wrong object counts '+JSON.stringify(result));
   const expected=operationItems.filter(f=>room==='all'||f.room===room).map(f=>f.id).sort();
   if(JSON.stringify([...result.operationRenderIds].sort())!==JSON.stringify(expected))throw new Error('Operations model missing or duplicated '+JSON.stringify({room,expected,actual:result.operationRenderIds}));
   if(result.sourceRevision!==6||result.cameras!==(room==='all'?4:['A','B','C','D'].includes(room)?1:0))throw new Error('Wrong revision or camera scope');
   if(room.startsWith('WC-')&&(result.sanitaryFixtures.join(',')!=='toilet,washbasin'||!result.secondaryCorridorVisible||!['양변기','세면대','독립 출입'].every(t=>result.visibleLabels.includes(t))))throw new Error('WC fixtures or independent access not visible '+JSON.stringify(result));
   if(room==='all'&&result.sanitaryFixtures.length!==4)throw new Error('WC total is not 2 toilets + 2 washbasins');
   const filename=`3d-${width}-${room}-vr.png`;await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,filename)});report.screens.push({width,filename,...result});
  }
  await frame.locator('#s3-room').selectOption('consult');await frame.locator('#s3-mode').selectOption('consult');
  const mode=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic);
  if(mode.consultFurniture.filter(k=>k==='folding-chair').length!==4||mode.consultFurniture.includes('folded-table'))throw new Error('Consult mode did not switch');
  await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,`3d-${width}-consult-consult.png`)});report.states.push({width,mode});
  await frame.locator('#s3-mode').selectOption('vr');
  for(const room of ['A','office','photo','consult']){
   await frame.locator('#s3-room').selectOption(room);await frame.locator('#s3-contents').check();await page.waitForTimeout(100);
   const view=await frame.evaluate(()=>{const r=document.getElementById('synk-3d-concept'),detail=document.getElementById('s3-contents-detail');return{...r.conceptDiagnostic,overflow:document.documentElement.scrollWidth>innerWidth,contentText:detail.textContent,contentHidden:detail.hidden};});
   const expected=storageItems.filter(f=>f.room===room).map(f=>f.id).sort();
   if(!view.contents||view.overflow||view.contentHidden||!view.contentText.includes('수납 확인용')||JSON.stringify([...view.visibleStoredItemIds].sort())!==JSON.stringify(expected))throw new Error('Stored contents toggle failed '+JSON.stringify({width,room,view,expected}));
   const filename=`3d-${width}-${room}-contents.png`;await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,filename)});report.storageViews.push({width,filename,...view});
   await frame.locator('#s3-contents').uncheck();
   const closed=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic);
   if(closed.contents||closed.visibleStoredItemIds.length)throw new Error('Stored contents did not close');
  }
 }
 await frame.locator('#s3-room').selectOption('A');await frame.locator('#s3-contents').check();await frame.locator('#s3-room').selectOption('WC-M');
 const unsupported=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic);if(unsupported.contents||unsupported.cutWallHeight!==.96)throw new Error('Storage view leaked into unsupported room');
 await frame.locator('#s3-room').selectOption('A');if(!await frame.locator('#s3-contents').isChecked())throw new Error('Storage selection not restored');await frame.locator('#s3-contents').uncheck();report.storageRoomSwitch=true;
 await page.setViewportSize({width:780,height:1000});await frame.locator('#s3-room').selectOption('all');
 const before=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic.camera);
 const bounds=await frame.locator('.s3-stage').boundingBox();await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.55,{steps:8});await page.mouse.up();
 const after=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic.camera);
 if(JSON.stringify(before)===JSON.stringify(after))throw new Error('Drag did not orbit');
 await page.mouse.wheel(0,-250);await page.waitForTimeout(200);
 const zoom=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic.camera);
 if(JSON.stringify(zoom)===JSON.stringify(after))throw new Error('Wheel did not zoom');report.orbit={before,after,zoom};
 await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(100);await frame.locator('#s3-room').selectOption('consult');await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,'3d-dark-consult.png')});
 await frame.locator('#s3-room').selectOption('A');await frame.locator('#s3-main-mode').selectOption('dance');await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,'3d-dark-A-dance.png')});
 const pixels=await frame.evaluate(()=>{const canvas=document.querySelector('#synk-3d-concept canvas'),gl=canvas.getContext('webgl2'),pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let visible=0;const buckets=new Set();for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>0)visible++;buckets.add(((pixels[i]>>4)<<8)|((pixels[i+1]>>4)<<4)|(pixels[i+2]>>4));}return{visible,total:canvas.width*canvas.height,colorBuckets:buckets.size};});if(pixels.visible<1000||pixels.colorBuckets<16)throw new Error('WebGL appears blank or uniform');report.pixels=pixels;
 report.errors=[...new Set(errors)];report.warnings=[...new Set(warnings)];report.failed=failed;
 fs.writeFileSync(path.join(dir,'verification-3d.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({screens:report.screens.length,modes:report.states.length,mainModes:report.mainModes.length,storageViews:report.storageViews.length,errors:report.errors,warnings:report.warnings,failed,pixels}));
 if(report.errors.length||failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
