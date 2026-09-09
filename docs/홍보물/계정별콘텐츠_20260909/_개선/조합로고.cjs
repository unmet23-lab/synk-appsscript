'use strict';
// Deterministic layout export of the inspected raster assets. No redrawing or recoloring.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto');
const out=path.join(__dirname,'조합로고');
const qa=path.join(__dirname,'..','_검토','조합로고_QA');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 fs.mkdirSync(qa,{recursive:true});
 const synopsis=[];
 const source=path.join(__dirname,'배치용','brand-synk.webp');
 for(const [brand,cap] of [['SYNK',0],['LAB',775],['SHIFT',552],['PULSE',529]]){
  const mainWidth=2000,mainHeight=Math.round(2000*1301/2820),gap=167,pad=80,mainTop=80;
  const layers=[{input:await sharp(source).resize({width:mainWidth}).png().toBuffer(),left:pad,top:mainTop}];
  let width=mainWidth+2*pad;
  if(cap){
   const file=path.join(__dirname,'배치용','brand-'+brand.toLowerCase()+'.webp');
   const meta=await sharp(file).metadata(),ratio=(56/240*mainWidth)/cap;
   const w=Math.round(meta.width*ratio),h=Math.round(meta.height*ratio);
   layers.push({input:await sharp(file).resize(w,h).png().toBuffer(),left:pad+mainWidth+gap,top:mainTop+Math.round((mainHeight-h)/2)-25});
   width+=gap+w;
  }
  const target=path.join(out,brand==='SYNK'?'SYNK.png':'SYNK-'+brand+'.png');
  await sharp({create:{width,height:mainHeight+2*pad,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(target);
  for(const [label,background] of [['Paper','#F7F3EE'],['Ink','#201E1C']]){
   await sharp(target).flatten({background}).resize({width:1600}).png().toFile(path.join(qa,path.basename(target,'.png')+'-'+label+'.png'));
  }
  synopsis.push({file:path.basename(target),width,height:mainHeight+2*pad,sha256:sha(target),method:'Exact inspected source assets, aspect-preserving downscale and optical composition only; no generative redrawing or color replacement.'});
 }
 fs.writeFileSync(path.join(out,'명세.json'),JSON.stringify(synopsis,null,2));
 console.log(JSON.stringify(synopsis,null,2));
})();
