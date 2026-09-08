'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require('playwright'),sharp=require('sharp');
const marks=require('./사업명.js'),dir=path.join(__dirname,'로고디테일');
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
 const tiles=[];
 for(const [col,version] of ['A','B'].entries()){
  for(const [row,brand] of ['lab','shift','pulse'].entries()){
   await page.goto(pathToFileURL(path.join(__dirname,brand+'.html')).href+'?export');
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()))});
   await page.locator('.sheet').first().locator('.brand').evaluate((e,html)=>e.outerHTML=html,marks.조합('SYNK '+brand.toUpperCase(),{large:true}));
   await page.addStyleTag({content:marks.css+(version==='A'?'.brand--cover{top:24px!important;height:72px!important;gap:8px!important}.brand--cover>svg{width:104px!important;height:72px!important}.brand--cover>.division{font-size:24px!important;transform:none}.division-stitch{width:32px;left:auto;right:0;top:calc(100% + 8px)}':'')});
   await page.evaluate(async()=>{await Promise.all([...document.images].map(x=>x.decode()))});
   await page.screenshot({path:path.join(dir,`${version}-${brand}-표지.png`)});
   await page.screenshot({path:path.join(dir,`${version}-${brand}-로고.png`),clip:{x:55,y:18,width:375,height:110}});
   tiles.push({input:await sharp(path.join(dir,`${version}-${brand}-표지.png`)).resize(720,450).png().toBuffer(),left:col*744,top:row*474});
  }
 }
 await sharp({create:{width:1464,height:1398,channels:3,background:'#2B2320'}}).composite(tiles).png().toFile(path.join(dir,'AB-표지비교.png'));
 const detail=[];for(const [col,version] of ['A','B'].entries())for(const [row,brand] of ['lab','shift','pulse'].entries())detail.push({input:await sharp(path.join(dir,`${version}-${brand}-로고.png`)).resize(750,220).png().toBuffer(),left:col*774,top:row*244});
 await sharp({create:{width:1524,height:708,channels:3,background:'#2B2320'}}).composite(detail).png().toFile(path.join(dir,'AB-로고비교.png'));
 await browser.close();console.log('A/B 표지 6개와 확대 비교 생성');
})().catch(e=>{console.error(e);process.exitCode=1});
