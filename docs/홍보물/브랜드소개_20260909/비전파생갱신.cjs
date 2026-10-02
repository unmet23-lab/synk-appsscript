'use strict';
// 현재 HTML과 편집 원고는 보존하고, 소개서의 실제 소비 이미지와 해당 카드만 다시 출력한다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const sharp=require('sharp'),{chromium}=require('playwright');
const refresh=require('../로고갱신_20260910.cjs');
const {refreshCollectionHeader}=require('./비전지면.js');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const assetPattern=/(?:labpage(?:-neutral)?|shiftpage|pulsepage(?:-r2)?|synkpage)\.webp/;
const names=['계정별콘텐츠_20260909','마케팅실행_20260909'];
(async()=>{
 const results=[];
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 try{
  for(const name of names){
   const base=path.join(__dirname,'..',name);
   await refresh.refreshFolder(base);
   const inventory=path.join(base,'사용자산.json'),inventoryText=fs.readFileSync(inventory,'utf8');
   const updatedInventory=inventoryText.replaceAll('기존 소개서 본문은 유지하고 로고만 스티치로 교체한 파생 지면','확정 비전과 승인 로고를 담은 현재 소개서의 완성 지면');
   if(updatedInventory!==inventoryText)fs.writeFileSync(inventory,updatedInventory);
   if(name==='마케팅실행_20260909')refreshCollectionHeader(base);
   const page=await browser.newPage({viewport:{width:1080,height:1800},deviceScaleFactor:2});
   const cards=fs.readdirSync(base).filter(f=>/^\d{2}-/.test(f)).map(id=>({id,file:path.join(base,id,'cards.html')})).filter(x=>fs.existsSync(x.file)&&assetPattern.test(fs.readFileSync(x.file,'utf8')));
   for(const item of cards){
    const before=hash(item.file);
    await page.goto(pathToFileURL(item.file).href+'?export');
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
    const boards=page.locator('.artboard');
    for(let i=0;i<await boards.count();i++){
     const board=boards.nth(i);
     const uses=await board.locator('img').evaluateAll(images=>images.some(img=>/(?:labpage(?:-neutral)?|shiftpage|pulsepage(?:-r2)?|synkpage)\.webp/.test(img.getAttribute('src')||'')));
     if(!uses)continue;
     const n=String(i+1).padStart(2,'0'),folder=path.dirname(item.file),master=path.join(folder,`master-${n}.png`),upload=path.join(folder,`upload-${n}.jpg`);
     const bounds=await board.evaluate(b=>{const rect=b.getBoundingClientRect(),text=[...b.querySelectorAll('h1,p,li,.folio')];return {width:Math.round(rect.width),height:Math.round(rect.height),overflow:text.filter(e=>{const r=e.getBoundingClientRect();return r.left<rect.left-1||r.right>rect.right+1||r.top<rect.top-1||r.bottom>rect.bottom+1||e.scrollWidth>e.clientWidth+1}).map(e=>e.textContent)}});
     if(bounds.overflow.length)throw Error(item.id+'의 글자 잘림: '+JSON.stringify(bounds.overflow));
     refresh.replaceFile(master,await board.screenshot({animations:'disabled'}));
     refresh.replaceFile(upload,await sharp(master).resize(1080,bounds.height).jpeg({quality:name==='계정별콘텐츠_20260909'?96:95,chromaSubsampling:'4:4:4'}).toBuffer());
     if(i===0&&fs.existsSync(path.join(folder,'cover.jpg')))refresh.replaceFile(path.join(folder,'cover.jpg'),fs.readFileSync(upload));
     results.push({collection:name,id:item.id,page:i+1,file:path.relative(path.resolve(__dirname,'../../..'),upload).replaceAll('\\','/'),sha256:hash(upload),htmlUnchanged:hash(item.file)===before,...bounds});
    }
   }
   const copy=JSON.parse(fs.readFileSync(path.join(base,name==='계정별콘텐츠_20260909'?'콘텐츠원고.json':'원고/콘텐츠원고.json'),'utf8'));
   const published=copy.items.filter(x=>!x.music).flatMap(item=>(item.cards||item.slides).map((_,i)=>({id:item.id,file:path.join(base,item.id,'upload-'+String(i+1).padStart(2,'0')+'.jpg')})));
   const account=name==='계정별콘텐츠_20260909',stepX=account?286:258,stepY=account?366:320,width=account?270:240,height=account?338:300;
   const thumbs=await Promise.all(published.map(async(r,i)=>({input:await sharp(r.file).resize({width,height,fit:'contain',background:'#FBF7F0'}).png().toBuffer(),left:(i%6)*stepX,top:Math.floor(i/6)*stepY})));
   const preview=path.join(base,account?'미리보기/전체카드.png':'_검토/미리보기/전체카드.png');
   refresh.replaceFile(preview,await sharp({create:{width:6*stepX,height:Math.ceil(thumbs.length/6)*stepY,channels:3,background:'#EDE7DC'}}).composite(thumbs).png().toBuffer());
   if(account)for(const id of [...new Set(results.filter(r=>r.collection===name).map(r=>r.id))]){
    const entries=published.filter(x=>x.id===id),tiles=await Promise.all(entries.map(async(r,i)=>({input:await sharp(r.file).resize(324,405).png().toBuffer(),left:i*340,top:0})));
    refresh.replaceFile(path.join(base,'미리보기',id+'.png'),await sharp({create:{width:entries.length*340-16,height:405,channels:3,background:'#EDE7DC'}}).composite(tiles).png().toBuffer());
   }
   await page.close();
  }
 }finally{await browser.close();}
 fs.mkdirSync(path.join(__dirname,'_검토'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'_검토/비전파생검증_20260911.json'),JSON.stringify({at:new Date().toISOString(),results},null,2)+'\n');
 const tiles=await Promise.all(results.map(async(r,i)=>({input:await sharp(path.join(path.resolve(__dirname,'../../..'),r.file)).resize(432,540).png().toBuffer(),left:(i%3)*448,top:Math.floor(i/3)*556})));
 refresh.replaceFile(path.join(__dirname,'_검토/비전파생_모아보기.png'),await sharp({create:{width:1328,height:1096,channels:3,background:'#EDE7DC'}}).composite(tiles).png().toBuffer());
 console.log(JSON.stringify({cards:results.length,htmlPreserved:results.every(x=>x.htmlUnchanged)}));
})().catch(e=>{console.error(e);process.exitCode=1});
