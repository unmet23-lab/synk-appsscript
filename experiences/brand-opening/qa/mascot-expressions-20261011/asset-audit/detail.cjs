const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../../../../..'),assets=path.join(root,'experiences/brand-opening/assets/tutors');
const records=JSON.parse(fs.readFileSync(path.join(assets,'sources.json'),'utf8')).files;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rois={marin:{left:1900,top:1800,width:240,height:450},mongle:{left:1900,top:1230,width:300,height:420}};
function stats(base,next,region){
 const {width,height}=base.info,roi=region||{left:0,top:0,width,height};let pixels=0,alphaPixels=0,max=0,total=0,alphaBounds=[width,height,-1,-1];
 for(let y=roi.top;y<roi.top+roi.height;y++)for(let x=roi.left;x<roi.left+roi.width;x++){
  const i=(y*width+x)*4;let changed=false;
  for(let c=0;c<4;c++){const d=Math.abs(base.data[i+c]-next.data[i+c]);if(d)changed=true;max=Math.max(max,d);total+=d;}
  if(changed)pixels++;
  if(base.data[i+3]!==next.data[i+3]){alphaPixels++;alphaBounds[0]=Math.min(alphaBounds[0],x);alphaBounds[1]=Math.min(alphaBounds[1],y);alphaBounds[2]=Math.max(alphaBounds[2],x);alphaBounds[3]=Math.max(alphaBounds[3],y);}
 }
 return {roi,pixels,percentage:Number((100*pixels/(roi.width*roi.height)).toFixed(3)),maxChannelDelta:max,meanAbsChannelDelta:Number((total/(roi.width*roi.height*4)).toFixed(3)),alphaPixels,alphaBounds:alphaPixels?alphaBounds:null};
}
async function raw(source){return sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
async function cropFor(source){const d=await sharp(source).resize(1024,1024).ensureAlpha().raw().toBuffer();let l=1024,t=1024,r=0,b=0;
 for(let y=0;y<1024;y++){let count=0,lo=1024,hi=0;for(let x=0;x<1024;x++)if(d[(y*1024+x)*4+3]>160){count++;lo=Math.min(lo,x);hi=Math.max(hi,x);}if(count>12){l=Math.min(l,lo);r=Math.max(r,hi);t=Math.min(t,y);b=Math.max(b,y);}}
 l=Math.max(0,l-24);t=Math.max(0,t-24);r=Math.min(1023,r+24);b=Math.min(1023,b+24);return{left:l,top:t,width:r-l+1,height:b-t+1};
}
async function derived(source,crop){const scaled=await sharp(source).resize(1024,1024).png().toBuffer();return sharp(scaled).extract(crop).resize(480,480,{fit:'contain',background:'#00000000'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
function scaleRegion(roi,crop){const scale=Math.min(480/crop.width,480/crop.height);return{left:Math.round((roi.left/4-crop.left)*scale+(480-crop.width*scale)/2),top:Math.round((roi.top/4-crop.top)*scale+(480-crop.height*scale)/2),width:Math.floor(roi.width/4*scale),height:Math.floor(roi.height/4*scale)};}
(async()=>{const report=[];
 for(const id of ['marin','mongle']){
  const rows=records.filter(r=>r.file.startsWith(id+'-')&&r.file.endsWith('.webp')),baseRec=rows.find(r=>r.file===id+'-기본.webp');
  const baseSource=path.join(root,baseRec.source),canonical=await raw(baseSource),runtime=await raw(path.join(assets,baseRec.file)),crop=await cropFor(baseSource),lossless=await derived(baseSource,crop),roi=rois[id],scaledRoi=scaleRegion(roi,crop);
  for(const rec of rows){const source=path.join(root,rec.source),nextCanonical=await raw(source),nextRuntime=await raw(path.join(assets,rec.file)),nextLossless=await derived(source,crop);
   report.push({file:rec.file,source:rec.source,sourceShaMatches:sha(source)===rec.sourceSha256,outputShaMatches:sha(path.join(assets,rec.file))===rec.sha256,crop,canonicalForeheadBridge:stats(canonical,nextCanonical,roi),canonicalWhole:stats(canonical,nextCanonical),lossless480Bridge:stats(lossless,nextLossless,scaledRoi),lossless480Whole:stats(lossless,nextLossless),actualWebp480Bridge:stats(runtime,nextRuntime,scaledRoi),actualWebp480Whole:stats(runtime,nextRuntime)});
  }
 }
 fs.writeFileSync(path.join(__dirname,'detail-report.json'),JSON.stringify(report,null,2)+'\n');console.log('Detailed runtime/canonical comparison saved');
})().catch(e=>{console.error(e);process.exitCode=1;});
