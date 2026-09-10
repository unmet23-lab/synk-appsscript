'use strict';
// Export only: preserve generated RGBA inside a generously padded optical crop.
// This never keys out a color, thresholds alpha, redraws stitches or recolors letters.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const out=path.join(__dirname,'배치용');
const root=path.resolve(__dirname,'../../../..');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function bounds(file){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=info.width,y0=info.height,x1=-1,y1=-1,count=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);count++;}
 if(x1<0)throw Error('Empty alpha: '+file);
 return{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1,visibleAlphaPixels:count,thresholdForBoundsOnly:8};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const entries=[];
 for(const n of ['LAB','SHIFT','PULSE']){
  const file=path.join(__dirname,n+'-2.5.png'),b=await bounds(file),target=path.join(out,'brand-'+n.toLowerCase()+'.webp');
  const crop={left:b.left-24,top:b.top-24,width:b.width+48,height:b.height+48};
  await sharp(file).extract(crop).webp({lossless:true,effort:6}).toFile(target);
  const job=JSON.parse(fs.readFileSync(path.join(__dirname,n+'-응답.json'),'utf8'))[0];
  const meta=await sharp(target).metadata();
  entries.push({name:n,source:path.relative(root,file).replaceAll('\\','/'),sourceSha256:sha(file),jobId:job.id,model:job.job_type,variant:job.params.model,quality:job.params.quality,sourceWidth:job.params.width,sourceHeight:job.params.height,alphaBounds:b,crop,export:path.relative(root,target).replaceAll('\\','/'),width:meta.width,height:meta.height,sha256:sha(target),operation:'Lossless WebP; optical bounds alpha>=8 plus 24px padding cropped from original. Alpha values inside crop unchanged; no recoloring or color-key removal. Original PNG retained. Generated material interpretation, not a geometrically exact new corporate master.'});
 }
 const official=path.join(root,'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink.png'),synkOut=path.join(out,'brand-synk.webp');
 await sharp(official).trim({threshold:12}).resize({width:2820}).webp({lossless:true,effort:6}).toFile(synkOut);
 entries.push({name:'SYNK',source:path.relative(root,official).replaceAll('\\','/'),sourceSha256:sha(official),export:path.relative(root,synkOut).replaceAll('\\','/'),sha256:sha(synkOut),operation:'Approved no-stitch SYNK Ink felt master; trim and aspect-preserving resize to existing 2820px use. Division sources unchanged.'});
 for(const [name,n]of [['envelope','봉투'],['book','책'],['scissors','가위']]){
  const file=path.join(__dirname,n+'-2.5.png'),job=JSON.parse(fs.readFileSync(path.join(__dirname,n+'-응답.json'),'utf8'))[0];
  entries.push({name,source:path.relative(root,file).replaceAll('\\','/'),sourceSha256:sha(file),jobId:job.id,model:job.job_type,variant:job.params.model,quality:job.params.quality,width:job.params.width,height:job.params.height,operation:'Original generated RGBA preserved; no additional background removal.'});
 }
 fs.writeFileSync(path.join(__dirname,'자산_생성명세.json'),JSON.stringify({createdAt:new Date().toISOString(),authorization:'Existing Higgsfield credits only, explicitly approved GPT Image 2.5. No purchases or autocharge.',officialBrandMasterOverwritten:false,entries},null,2));
 console.log(JSON.stringify(entries.map(e=>({name:e.name,width:e.width,height:e.height,alphaBounds:e.alphaBounds})),null,2));
})();
