'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../../..'),old=path.join(root,'docs/홍보물/계정별콘텐츠_20260909'),out=path.dirname(__dirname);
const logo=require(path.join(root,'tools/lib/로고정본.js')),c=logo.색;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async()=>{
 fs.mkdirSync(path.join(out,'assets'),{recursive:true});fs.mkdirSync(path.join(__dirname,'배치용'),{recursive:true});
 for(const file of fs.readdirSync(path.join(old,'assets')).filter(x=>/\.(webp|png)$/.test(x)))fs.copyFileSync(path.join(old,'assets',file),path.join(out,'assets',file));
 const manifest=[];
 for(const variant of ['Ink','Paper']){
  const src=path.join(__dirname,`SYNK-${variant}.png`),meta=await sharp(src).metadata();
  if(!meta.hasAlpha||meta.width<3000)throw new Error('Expected full-resolution transparent logo');
  const word=await sharp(src).trim({threshold:12}).resize({width:2820}).png().toBuffer();
  const wm=await sharp(word).metadata();
  await sharp(word).webp({lossless:true}).toFile(path.join(out,'assets',variant==='Ink'?'brand-synk.webp':'brand-synk-paper.webp'));
  fs.writeFileSync(path.join(__dirname,`SYNK-${variant}-정밀.svg`),logo.워드마크({판:variant==='Ink'?'라이트':'다크'}).replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"'));
  for(const [brand,cap] of [['SYNK',0],['LAB',775],['SHIFT',552],['PULSE',529]]){
   const mainWidth=2000,mainHeight=Math.round(mainWidth*wm.height/wm.width),pad=100,gap=150;
   const layers=[{input:await sharp(word).resize(mainWidth).png().toBuffer(),left:pad,top:pad}];let width=mainWidth+pad*2;
   if(cap){const f=path.join(old,'_개선/배치용',`brand-${brand.toLowerCase()}.webp`),m=await sharp(f).metadata(),ratio=(mainWidth*.222)/cap,w=Math.round(m.width*ratio),h=Math.round(m.height*ratio);layers.push({input:await sharp(f).resize(w,h).png().toBuffer(),left:pad+mainWidth+gap,top:pad+Math.round((mainHeight-h)/2)-20});width+=gap+w;}
   const file=`${brand==='SYNK'?'SYNK':'SYNK-'+brand}-${variant}.png`,p=path.join(__dirname,'배치용',file);
   await sharp({create:{width,height:mainHeight+pad*2,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(p);
   await sharp(p).flatten({background:variant==='Ink'?c.Paper:c.Ink}).resize(1600).png().toFile(path.join(__dirname,'배치용',file.replace('.png','-배경확인.png')));
   manifest.push({brand,variant,file:'배치용/'+file,width,height:mainHeight+pad*2,sha256:hash(p),sourceSha256:hash(src)});
  }
 }
 fs.writeFileSync(path.join(__dirname,'배치명세.json'),JSON.stringify({version:1,policy:'Neutral SYNK, unchanged colored divisions. Source geometry remains authoritative SVG; photographic generated material variants preserve recognizable shape, not pixel identity.',items:manifest},null,2));
 console.log(JSON.stringify({logos:manifest.length,assets:fs.readdirSync(path.join(out,'assets')).length}));
})();
