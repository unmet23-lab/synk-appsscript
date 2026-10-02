const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname;
const floor=JSON.parse(fs.readFileSync(path.resolve(dir,'../평면도_20260929/공간과_편의시설_좌표_6안.json'),'utf8'));
const allowPending=process.argv.includes('--allow-pending');
const aOnly=process.argv.includes('--a-only');
const dayOnly=process.argv.includes('--day-only');
const report={widths:[],interactions:[],errors:[],pendingImages:[],localLinks:[]};
let testBrowser;
async function verifyDailyOperations(page){
 const result={checkedAt:new Date().toISOString(),scope:'Day-operation chapter, flow controls, blank cards, source sections 21-23, topbar and local links. Design-document checks only; no site or operating-system verification.',views:[],cards:[],links:[]};
 const source=fs.readFileSync(path.resolve(dir,'../방별_인테리어_디자인_20260929.md'),'utf8');
 for(const n of [21,22,23])if(!new RegExp('^## '+n+'\\. ','m').test(source))throw Error('Missing daily-operation source section '+n);
 result.sourceSHA256=require('node:crypto').createHash('sha256').update(source).digest('hex');
 if(await page.locator('[data-daily-flow]').count()!==2)throw Error('Expected student and staff day flows');
 if(await page.locator('.day-checks .empty-check').count()!==12)throw Error('Opening/closing cards must contain 12 blank visual checkboxes');
 if(await page.locator('#daily input[type=checkbox],#daily input:checked').count())throw Error('Design cards must not present completed or persistent operational checkboxes');
 if(await page.locator('#first-visit-notice .daily-fields>div').count()!==6)throw Error('Expected six unfilled first-visit fields');
 if((await page.locator('#daily').textContent()).includes('원문 갱신 후 연결합니다.'))throw Error('Daily source not rebuilt');
 if(await page.locator('#daily .daily-details').count()!==2)throw Error('Expected two source details in daily chapter');
 if(await page.locator('#daily-prep .spec-list').first().locator(':scope>div').count()!==5)throw Error('Expected five source-backed preparation bundles');
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:1000});
  for(const flow of ['student','staff']){
   await page.locator('[data-daily-flow="'+flow+'"]').click();
   if(await page.locator('[data-daily-flow][aria-pressed="true"]').count()!==1||!await page.locator('#daily-'+flow).isVisible())throw Error('Day flow selection failed');
   if(await page.locator('.daily-flow-panel:visible').count()!==1)throw Error('Two daily flows visible at once');
   const layout=await page.locator('#daily').evaluate(el=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...el.querySelectorAll('*'),...document.querySelectorAll('.topbar *')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect()).filter(r=>r.left<-.5||r.right>innerWidth+.5).length}));
   if(layout.scrollWidth>width+1||layout.overflow)throw Error('Daily chapter overflow '+JSON.stringify(layout));
   await page.locator('#daily-'+flow).screenshot({path:path.join(dir,`하루운영-${width}-${flow}.png`),style:'.topbar{visibility:hidden}'});
   result.views.push({width,flow,...layout});
  }
  for(const id of ['first-visit-notice','shift-handover-card','opening-card','closing-card','daily-prep']){
   const target=page.locator('#'+id);
   const count=await target.evaluate(el=>[...el.querySelectorAll('*')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect()).filter(r=>r.left<-.5||r.right>innerWidth+.5).length);
   if(count)throw Error('Day card overflow '+id+' '+width);
   if(width!==320)await target.screenshot({path:path.join(dir,`하루운영-${width}-${id}.png`),style:'.topbar{visibility:hidden}'});
   result.cards.push({width,id,overflow:count});
  }
  const details=page.locator('#daily .daily-details');
  for(let i=0;i<2;i++){
   await details.nth(i).locator('summary').click();
   if(!await details.nth(i).evaluate(el=>el.open)||await details.nth(i).locator('.chapter-content').evaluate(el=>el.textContent.length)<100)throw Error('Daily source detail does not open');
   if(await page.evaluate(()=>document.documentElement.scrollWidth)>width+1)throw Error('Open daily source overflows '+width);
   await details.nth(i).locator('summary').click();
  }
 }
 await page.locator('[data-daily-flow="student"]').click();
 const broken=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(h=>h!=='#'&&!document.getElementById(h.slice(1))));
 if(broken.length)throw Error('Broken daily document anchors '+broken.join(','));
 const local=await page.locator('a[href]').evaluateAll(links=>[...new Set(links.map(a=>a.getAttribute('href')).filter(h=>h&&!h.startsWith('#')&&!/^https?:/.test(h)))]);
 for(const href of local){const exists=fs.existsSync(path.resolve(dir,decodeURIComponent(href.split('#')[0])));result.links.push({href,exists});if(!exists)throw Error('Missing local link '+href);}
 result.blankCards={opening:6,closing:6,firstVisitFields:6,preparationBundles:5,complete:false};
 return result;
}
async function verifyMainRoom(page){
 const checks=[];
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:1100});
  for(const mode of ['dance','comparison']){
   const button=page.locator('[data-a-mode="'+mode+'"]');
   await button.click();
   const target=await button.getAttribute('data-a-image'),caption=await button.getAttribute('data-a-caption');
   const img=page.locator('#room-A .a-mode-figure img');await img.evaluate(image=>image.decode());
   if(await img.getAttribute('src')!==target||await page.locator('[data-a-mode][aria-pressed="true"]').count()!==1)throw Error('A mode selection failed');
   if(await page.locator('#room-A .a-mode-figure figcaption span').first().textContent()!==caption)throw Error('A caption failed');
   const layout=await page.locator('#room-A').evaluate(section=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...section.querySelectorAll('*')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect()).filter(r=>r.left<-.5||r.right>innerWidth+.5).length}));
   if(layout.scrollWidth>width+1||layout.overflow)throw Error('A layout overflow '+width);
   await page.locator('#room-A').evaluate(el=>scrollTo({top:el.offsetTop-85,behavior:'instant'}));
   await page.screenshot({path:path.join(dir,`디자인북-${width}-A-${mode==='dance'?'댄스':'수업촬영'}.png`)});
   if(mode==='dance'&&width!==320)await page.screenshot({path:path.join(dir,`디자인북-${width}-A.png`)});
   await page.locator('#room-A .a-mode-figure .image-open').click();await page.locator('#dialog-image').evaluate(image=>image.decode());
   if(!await page.locator('#image-dialog').evaluate(el=>el.open)||await page.locator('#dialog-image').getAttribute('src')!==target||await page.locator('#image-dialog-title').textContent()!==caption)throw Error('A mode dialog uses wrong image');
   const original=await page.locator('#dialog-original').getAttribute('href');if(original!==target)throw Error('A original image link stale');
   if(mode==='dance')await page.keyboard.press('Escape');else await page.locator('#image-close').click();
   if(await page.locator('#image-dialog').evaluate(el=>el.open))throw Error('A dialog close failed');
   checks.push({width,mode,image:decodeURIComponent(target),layout,dialog:'correct image, caption and original link; closes'});
  }
 }
 await page.locator('[data-a-mode="dance"]').click();
 return {checks,verifiedAt:new Date().toISOString(),scope:'A main image and two-mode interaction only'};
}
(async()=>{
 const browser=testBrowser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('file:///'+path.join(dir,'디자인북.html').replaceAll('\\','/'));
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('img[loading="lazy"]').evaluateAll(images=>images.forEach(image=>image.loading='eager'));
 await page.locator('img').evaluateAll(images=>Promise.all(images.filter(image=>image.id!=='dialog-image').map(image=>image.decode().catch(()=>{}))));
 if(dayOnly){
  const dailyOperations=await verifyDailyOperations(page);
  if(report.errors.length)throw Error(report.errors.join('\n'));
  const old=JSON.parse(fs.readFileSync(path.join(dir,'디자인북-검증.json'),'utf8'));
  const updated={...old,fullCheckDocumentBytes:old.fullCheckDocumentBytes||old.documentBytes,documentBytes:fs.statSync(path.join(dir,'디자인북.html')).size,latestVerificationScope:dailyOperations.scope,dailyOperations};
  fs.writeFileSync(path.join(dir,'디자인북-검증.json'),JSON.stringify(updated,null,2)+'\n');await browser.close();console.log(JSON.stringify({status:'passed',scope:dailyOperations.scope,views:dailyOperations.views.length,cards:dailyOperations.cards.length,errors:report.errors},null,2));return;
 }
 if(await page.locator('[data-a-mode="dance"]').getAttribute('aria-pressed')!=='true')throw Error('Dance mode should be the default');
 const mainRoomUpdate=await verifyMainRoom(page);
 if(aOnly){
  const old=JSON.parse(fs.readFileSync(path.join(dir,'디자인북-검증.json'),'utf8'));
  const updated={...old,fullCheckDocumentBytes:old.fullCheckDocumentBytes||old.documentBytes,documentBytes:fs.statSync(path.join(dir,'디자인북.html')).size,latestVerificationScope:'A main-room image and interaction update; prior full-book checks retained',mainRoomUpdate};
  if(report.errors.length)throw Error(report.errors.join('\n'));
  fs.writeFileSync(path.join(dir,'디자인북-검증.json'),JSON.stringify(updated,null,2)+'\n');await browser.close();console.log(JSON.stringify({status:'passed',scope:updated.latestVerificationScope,checks:mainRoomUpdate.checks.length,errors:report.errors},null,2));return;
 }
 report.mainRoomUpdate=mainRoomUpdate;
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:1000});
  await page.waitForTimeout(150);
  const result=await page.evaluate(()=>({
   width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   rooms:[...document.querySelectorAll('[data-room]')].map(n=>n.dataset.room),
   roomDimensions:[...document.querySelectorAll('[data-room]')].map(n=>({id:n.dataset.room,area:n.querySelector('.room-dimensions strong').textContent,size:n.querySelector('.room-dimensions span').textContent,body:n.querySelector('.chapter-content').textContent.length})),
   fonts:['SUIT Variable','Inter Tight','DM Mono'].map(name=>({name,loaded:document.fonts.check('16px "'+name+'"')})),
   overflow:[...document.querySelectorAll('main *')].filter(el=>el.getClientRects().length).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,65),rect:el.getBoundingClientRect()})).filter(x=>x.rect.left<-.5||x.rect.right>innerWidth+.5).map(x=>({tag:x.tag,cls:x.cls,text:x.text,left:x.rect.left,right:x.rect.right})),
   brokenImages:[...document.images].filter(image=>image.id!=='dialog-image'&&(!image.complete||!image.naturalWidth)).map(image=>decodeURIComponent(image.getAttribute('src'))),
   textBroken:document.body.textContent.includes('\uFFFD')||/<\/?(?:dl|dt|dd|div|p)\b/.test(document.querySelector('main').textContent),
   anchors:[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href')).filter(h=>h!=='#'&&!document.getElementById(h.slice(1)))
  }));
  if(result.scrollWidth>width+1||result.overflow.length)throw Error('Overflow at '+width+': '+JSON.stringify(result.overflow));
  if(result.fonts.some(f=>!f.loaded))throw Error('Font missing');
  if(result.rooms.length!==10||!result.rooms.includes('WC-M')||!result.rooms.includes('WC-F'))throw Error('Missing room');
  for(const r of result.roomDimensions){
   const g=r.id==='corridor'?floor.corridor:floor.rooms.find(g=>g.id===r.id),expected=(g.w*g.h/3.305785).toFixed(1)+'평';
   if(r.area!==expected||r.body<150)throw Error('Room area/body mismatch: '+JSON.stringify(r));
   const dims=r.size.match(/[0-9.]+/g).map(Number);if(dims[0]!==g.w||dims[1]!==g.h)throw Error('Dimensions mismatch: '+r.id);
  }
  if(result.textBroken||result.anchors.length)throw Error('Broken text or links');
  report.pendingImages=[...new Set([...report.pendingImages,...result.brokenImages])];
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:path.join(dir,`디자인북-${width}-표지.png`)});
  for (const room of result.rooms) {
   await page.locator('#room-'+room).evaluate(el=>scrollTo({top:el.offsetTop-85,behavior:'instant'}));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(dir,`디자인북-${width}-${room==='consult'?'VR':room}.png`)});
  }
  await page.locator('#finish').evaluate(el=>scrollTo({top:el.offsetTop-85,behavior:'instant'}));
  await page.screenshot({path:path.join(dir,`디자인북-${width}-마감.png`)});
  report.widths.push(result);
 }
 report.studentExperience={checkedAt:new Date().toISOString(),chapters:[],frameStates:[],assetFiles:[]};
 const experienceSections=page.locator('[data-experience]');
 if(await experienceSections.count()!==5)throw Error('Expected five student experience chapters');
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:1000});
  for(const id of ['arrival','signs','first','photo','memory']){
   const section=page.locator('#experience-'+id);
   await section.screenshot({path:path.join(dir,`학생경험-${width}-${id}.png`),style:'.topbar{visibility:hidden}'});
   const result=await section.evaluate(el=>({id:el.dataset.experience,width:innerWidth,text:el.textContent.length,overflow:[...el.querySelectorAll('*')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect()).filter(r=>r.left<-.5||r.right>innerWidth+.5).length}));
   if(result.overflow||result.text<100)throw Error('Experience chapter layout failed: '+JSON.stringify(result));
   report.studentExperience.chapters.push(result);
  }
  const frameButtons=page.locator('[data-photo-month]');
  if(await frameButtons.count()!==2)throw Error('Expected base and one monthly photo frame');
  for(const mode of ['10','base']){
   const button=page.locator('[data-photo-month="'+mode+'"]');await button.click();
   const stamp=await button.getAttribute('data-photo-stamp'),name=await button.getAttribute('data-photo-name');
   if(await page.locator('#strip-month').textContent()!==stamp||await page.locator('#strip-title').textContent()!==name||await page.locator('[data-photo-month][aria-pressed="true"]').count()!==1)throw Error('Photo frame switch failed');
   if(await page.locator('#photo-strip .photo-sample').count()!==4)throw Error('Photo placeholders changed');
   report.studentExperience.frameStates.push({width,mode,stamp,name});
  }
 }
 const crypto=require('node:crypto');
 const kit=path.resolve(dir,'../../홍보물/마케팅실행_20260909/브랜드킷');
 const manifest=JSON.parse(fs.readFileSync(path.join(kit,'배치명세.json'),'utf8'));
 for(const name of ['배치용/SYNK-Ink.png','배치용/SYNK-LAB-Ink.png']){
  const expected=manifest.items.find(i=>i.file===name),hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(kit,name))).digest('hex');
  if(!expected||hash!==expected.sha256)throw Error('Brand logo differs from approved placement manifest: '+name);
  report.studentExperience.assetFiles.push({file:name,sha256:hash,manifestMatch:true});
 }
 report.interactions.push('5 student experience chapters at 320/390/1280; basic/monthly frame states; approved logo hashes');
 report.dailyOperations=await verifyDailyOperations(page);
 report.interactions.push('Daily student/staff flows, source-backed preparation bundles and blank first-visit/opening/closing/handover cards at 320/390/1280');
 const operationDetails=page.locator('.operation-details');
 if(await operationDetails.count()!==2)throw Error('Expected two operational specification details');
 await operationDetails.nth(1).locator('summary').click();
 if(!await operationDetails.nth(1).evaluate(el=>el.open))throw Error('Operational checklist does not open');
 await page.setViewportSize({width:320,height:1000});
 if(await page.evaluate(()=>document.documentElement.scrollWidth)>321)throw Error('Open operations checklist overflows mobile');
 await operationDetails.nth(1).locator('summary').click();
 report.interactions.push('Operations specification and handover checklist expand/collapse; mobile width');
 const localLinks=await page.locator('a[href]').evaluateAll(links=>[...new Set(links.map(a=>a.getAttribute('href')).filter(h=>h&&!h.startsWith('#')&&!/^https?:/.test(h)))]);
 for(const href of localLinks){
  const localPath=path.resolve(dir,decodeURIComponent(href.split('#')[0]));
  report.localLinks.push({href,exists:fs.existsSync(localPath)});
 }
 if(report.localLinks.some(link=>!link.exists))throw Error('Missing local links: '+JSON.stringify(report.localLinks.filter(link=>!link.exists)));
 const links=page.locator('.nav-rooms a');
 for(let i=0;i<10;i++){
  const link=links.nth(i),hash=await link.getAttribute('href');
  await link.click();await page.waitForTimeout(50);
  if(new URL(page.url()).hash!==hash)throw Error('Room anchor failed: '+hash);
 }
 report.interactions.push('10 room anchor links');
 const planButtons=page.locator('[data-plan]');
 if(await planButtons.count()!==5)throw Error('Expected 5 v6 plans');
 for(let i=0;i<5;i++){
  await planButtons.nth(i).click();
  const title=await planButtons.nth(i).getAttribute('data-title');
  if(await page.locator('#plan-caption').textContent()!==title)throw Error('Plan title not updated');
  if(await page.locator('[data-plan][aria-pressed="true"]').count()!==1)throw Error('Plan selected state invalid');
  await page.locator('#plan-open').click();
  if(!await page.locator('#image-dialog').evaluate(el=>el.open))throw Error('Dialog failed');
  if(await page.locator('#image-dialog-title').textContent()!==title)throw Error('Dialog title not updated');
  await page.keyboard.press('Escape');
  if(await page.locator('#image-dialog').evaluate(el=>el.open))throw Error('Escape failed');
 }
 report.interactions.push('5 plan switches and image dialogs; Esc close');
 for(const id of ['WC-M','WC-F']){
  await page.locator('#room-'+id+' .image-open').first().click();
  await page.locator('#dialog-image').evaluate(image=>image.decode());
  if(!await page.locator('#image-dialog').evaluate(el=>el.open))throw Error('WC image dialog failed');
  await page.keyboard.press('Escape');
 }
 report.interactions.push('Both restroom concept images load and enlarge');
 await page.locator('#room-A .image-open').first().click();
 await page.locator('#image-close').click();
 if(await page.locator('#image-dialog').evaluate(el=>el.open))throw Error('Close button failed');
 report.interactions.push('Concept image dialog close button');
 await page.emulateMedia({reducedMotion:'reduce'});
 const behavior=await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior);
 if(behavior!=='auto')throw Error('Reduced motion ignored');
 report.interactions.push('Reduced motion');
 report.documentBytes=fs.statSync(path.join(dir,'디자인북.html')).size;
 report.status=report.pendingImages.length?'pending-generated-images':'passed';
 fs.writeFileSync(path.join(dir,'디자인북-검증.json'),JSON.stringify(report,null,2)+'\n');
 await browser.close();
 if(report.errors.length)throw Error(report.errors.join('\n'));
 if(report.pendingImages.length&&!allowPending)throw Error('Pending image paths: '+report.pendingImages.join(', '));
 console.log(JSON.stringify({status:report.status,widths:report.widths.map(r=>r.width),bytes:report.documentBytes,pendingImages:report.pendingImages,interactions:report.interactions,errors:report.errors},null,2));
})().catch(async e=>{console.error(e);await testBrowser?.close();process.exitCode=1;});
