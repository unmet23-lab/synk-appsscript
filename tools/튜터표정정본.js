// Reuse approved expression details on one unchanged body. No image-generation calls.
// node tools/튜터표정정본.js [--apply]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/캐릭터/마린몽글표정교정_20261011'),canon=path.join(root,'docs/캐릭터/정본_4K');
const size=4096,apply=process.argv.includes('--apply'),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function writeVerified(target,bytes){
 const expected=crypto.createHash('sha256').update(bytes).digest('hex');
 if(fs.existsSync(target)&&sha(target)===expected)return;
 const staged=`${target}.stage-${process.pid}`;
 fs.writeFileSync(staged,bytes);
 try{fs.renameSync(staged,target);}catch(error){
  // Windows can report UNKNOWN after replacing bytes; accept only a verified match.
  if(error.code!=='UNKNOWN'||!fs.existsSync(target)||sha(target)!==expected)throw error;
 }
 if(sha(target)!==expected)throw Error(`Written asset differs: ${target}`);
 if(fs.existsSync(staged))fs.unlinkSync(staged);
}
const defs=[
 {name:'마린',cuts:['눈감음','눈웃음','놀람','집중','몰래기쁨','민망','졸림'],regions:[{left:1120,top:1510,width:800,height:1050},{left:2170,top:1510,width:800,height:1050}]},
 {name:'몽글',cuts:['눈감음','눈웃음','놀람','윙크','으쓱','졸림','민망'],regions:[{left:1220,top:1130,width:660,height:700},{left:2280,top:1130,width:680,height:700}]},
];
const raw=source=>sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
function keyPixel(name,r,g,b){return name==='마린'?r>90&&g>65&&r>b*1.45&&g>b*1.35&&r>g*1.03:r<130&&g<105&&b<100;}
// Within each eye's small search window, keep its largest connected feature,
// including enclosed highlights. A contour dilation below covers its soft edge.
function feature(image,name,region){
 const {left,top,width,height}=region,n=width*height,seed=new Uint8Array(n),seen=new Uint8Array(n);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=((top+y)*image.info.width+left+x)*4;seed[y*width+x]=image.data[p+3]>128&&keyPixel(name,image.data[p],image.data[p+1],image.data[p+2])?1:0;}
 let best=[];const queue=new Int32Array(n);
 for(let s=0;s<n;s++){if(!seed[s]||seen[s])continue;let start=0,end=1;queue[0]=s;seen[s]=1;const points=[];
  while(start<end){const i=queue[start++],x=i%width,y=Math.floor(i/width);points.push(i);for(const j of [x?i-1:-1,x<width-1?i+1:-1,y?i-width:-1,y<height-1?i+width:-1])if(j>=0&&seed[j]&&!seen[j]){seen[j]=1;queue[end++]=j;}}
  if(points.length>best.length)best=points;
 }
 const filled=new Uint8Array(n);for(const i of best)filled[i]=1;
 // Flood the background from every boundary; unreached cavities are highlights.
 const outside=new Uint8Array(n);let start=0,end=0;const push=i=>{if(!filled[i]&&!outside[i]){outside[i]=1;queue[end++]=i;}};
 for(let x=0;x<width;x++){push(x);push((height-1)*width+x);}for(let y=0;y<height;y++){push(y*width);push(y*width+width-1);}
 while(start<end){const i=queue[start++],x=i%width,y=Math.floor(i/width);if(x)push(i-1);if(x<width-1)push(i+1);if(y)push(i-width);if(y<height-1)push(i+width);}
 const bbox={left:size,top:size,right:-1,bottom:-1};let count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(!outside[i])filled[i]=1;if(filled[i]){count++;bbox.left=Math.min(bbox.left,left+x);bbox.top=Math.min(bbox.top,top+y);bbox.right=Math.max(bbox.right,left+x);bbox.bottom=Math.max(bbox.bottom,top+y);}}
 return{region,pixels:filled,count,bbox:count?{left:bbox.left,top:bbox.top,width:bbox.right-bbox.left+1,height:bbox.bottom-bbox.top+1}:null};
}
function distance(seed,width,height,inside=false){
 const d=new Float32Array(seed.length),inf=width+height;
 for(let i=0;i<d.length;i++)d[i]=(inside?!seed[i]:seed[i])?0:inf;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;let v=d[i];if(x)v=Math.min(v,d[i-1]+1);if(y)v=Math.min(v,d[i-width]+1);if(x&&y)v=Math.min(v,d[i-width-1]+Math.SQRT2);if(x<width-1&&y)v=Math.min(v,d[i-width+1]+Math.SQRT2);d[i]=v;}
 for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;let v=d[i];if(x<width-1)v=Math.min(v,d[i+1]+1);if(y<height-1)v=Math.min(v,d[i+width]+1);if(x<width-1&&y<height-1)v=Math.min(v,d[i+width+1]+Math.SQRT2);if(x&&y<height-1)v=Math.min(v,d[i+width-1]+Math.SQRT2);d[i]=v;}
 return d;
}
function fillBeadContour(feature){
 // Bright bead reflections can meet the surrounding fur, so they are not
 // always enclosed holes in a dark-pixel mask. Fill only the bead's convex
 // outer contour; do not fill the surrounding eye search rectangle.
 const {width,height}=feature.region,points=[];
 for(let y=0;y<height;y++){let lo=width,hi=-1;for(let x=0;x<width;x++)if(feature.pixels[y*width+x]){lo=Math.min(lo,x);hi=Math.max(hi,x);}if(hi>=0){points.push([lo,y]);if(hi!==lo)points.push([hi,y]);}}
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(points.length<3)return feature;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lower=[],upper=[];
 for(const p of points){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of [...points].reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 const hull=lower.slice(0,-1).concat(upper.slice(0,-1)),pixels=feature.pixels.slice();
 for(let y=0;y<height;y++){const xs=[];for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];if(a[1]===b[1]){if(y===a[1])xs.push(a[0],b[0]);}else if(y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1]))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}if(xs.length)for(let x=Math.floor(Math.min(...xs));x<=Math.ceil(Math.max(...xs));x++)if(x>=0&&x<width)pixels[y*width+x]=1;}
 return{...feature,pixels,count:pixels.reduce((s,v)=>s+v,0),convexBeadContour:true};
}
function legacyMask(baseFeature,nextFeature){
 const seed=baseFeature.pixels.map((v,i)=>v||nextFeature.pixels[i]?1:0),{width,height}=baseFeature.region,d=distance(seed,width,height);
 // 10px original feature edge plus a 12px feather, never the whole face rectangle.
 return d.map(v=>Math.round(255*Math.max(0,Math.min(1,(22-v)/12))));
}
function lensMask(baseFeature){const {width,height}=baseFeature.region,d=distance(baseFeature.pixels,width,height,true);return d.map((v,i)=>baseFeature.pixels[i]?Math.round(255*Math.min(1,v/6)):0);}
function check(base,out,mask,width,height,allowed=mask){let changes=0,outside=0,alpha=0;for(let i=0;i<width*height;i++){const p=i*4,diff=[0,1,2,3].some(c=>base[p+c]!==out[p+c]);if(diff){changes++;if(!allowed[i])outside++;}if(base[p+3]!==out[p+3])alpha++;}if(outside||alpha)throw Error(`Pixel invariant failed: outside=${outside}, alpha=${alpha}`);return{changedPixels:changes,outsideMaskRGBAChanges:outside,alphaChanges:alpha};}
function resizedAllowance(mask,crop,width=480,height=480){
 const result=new Uint8Array(width*height),scale=Math.min(width/crop.width,height/crop.height),ox=(width-crop.width*scale)/2,oy=(height-crop.height*scale)/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(mask[y*size+x]){const sx=Math.floor((x/4-crop.left)*scale+ox),sy=Math.floor((y/4-crop.top)*scale+oy);if(sx>=0&&sx<width&&sy>=0&&sy<height)result[sy*width+sx]=1;}
 const d=distance(result,width,height);return d.map(v=>v<=5?1:0);
}
async function worldCrop(base){const buf=await sharp(base,{raw:{width:size,height:size,channels:4}}).resize(1024,1024).raw().toBuffer();let l=1024,t=1024,r=0,b=0;for(let y=0;y<1024;y++){let n=0,lo=1024,hi=0;for(let x=0;x<1024;x++)if(buf[(y*1024+x)*4+3]>160){n++;lo=Math.min(lo,x);hi=Math.max(hi,x);}if(n>12){l=Math.min(l,lo);r=Math.max(r,hi);t=Math.min(t,y);b=Math.max(b,y);}}l=Math.max(0,l-24);t=Math.max(0,t-24);r=Math.min(1023,r+24);b=Math.min(1023,b+24);return{left:l,top:t,width:r-l+1,height:b-t+1};}
async function world480(buffer,crop){const scaled=await sharp(buffer,{raw:{width:size,height:size,channels:4}}).resize(1024,1024).png().toBuffer();return sharp(scaled).extract(crop).resize(480,480,{fit:'contain',background:'#00000000'}).ensureAlpha().raw().toBuffer();}
const saveRaw=(data,width,height,file,channels=4)=>sharp(data,{raw:{width,height,channels}}).png().toFile(file);
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 // Capture immutable previous originals before producing any candidates.
 for(const def of defs)for(const cut of ['본체',...def.cuts]){const backup=path.join(dir,`이전_${def.name}_${cut}.png`);if(!fs.existsSync(backup))fs.copyFileSync(path.join(canon,`${def.name}_${cut}.png`),backup);}
 // A later canonical body revision needs a new correction set, not old-body
 // expression assets silently written over the newly approved body family.
 for(const def of defs)if(sha(path.join(canon,`${def.name}_본체.png`))!==sha(path.join(dir,`이전_${def.name}_본체.png`)))throw Error(`${def.name}: canonical body differs from the preserved correction base`);
 const report={date:'2026-10-11',scope:'Only WORLD tutor expression sources; unused canonical emotions are unchanged',method:'Original body and alpha retained; former approved eye/flower/stitch contours reused; new ImageGen focus/sleep light restricted to original yellow Marine lens pixels',files:[],applied:false};
 for(const def of defs){
  const baseFile=path.join(dir,`이전_${def.name}_본체.png`),base=await raw(baseFile),features=def.regions.map(r=>{const f=feature(base,def.name,r);return def.name==='몽글'?fillBeadContour(f):f;}),crop=await worldCrop(base.data),smallBase=await world480(base.data,crop);
  if(base.info.width!==size||base.info.height!==size||features.some(f=>!f.count))throw Error('Canonical geometry invalid');
  for(const cut of def.cuts){
   const generated=def.name==='마린'&&['집중','졸림'].includes(cut),source=path.join(dir,generated?`${def.name}_${cut}_생성원본.png`:`이전_${def.name}_${cut}.png`),next=await raw(source),out=Buffer.from(base.data),mask=Buffer.alloc(size*size),eyeDetails=[];
   for(let j=0;j<features.length;j++){
    const bf=features[j],r=bf.region;
    let nf,localMask,patch;
    if(generated){
     const ratio=next.info.width/size,search={left:Math.floor(r.left*ratio),top:Math.floor(r.top*ratio),width:Math.ceil(r.width*ratio),height:Math.ceil(r.height*ratio)};
     nf=feature(next,def.name,search);if(!nf.count)throw Error('Generated lens missing');
     patch=await sharp(source).extract(nf.bbox).resize(bf.bbox.width,bf.bbox.height).ensureAlpha().raw().toBuffer();localMask=lensMask(bf);
    }else{nf=feature(next,def.name,r);if(def.name==='몽글'&&nf.bbox&&nf.count/(nf.bbox.width*nf.bbox.height)>.4)nf=fillBeadContour(nf);localMask=legacyMask(bf,nf);}
    for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
     const local=y*r.width+x,a=localMask[local]/255;if(!a)continue;const gx=r.left+x,gy=r.top+y,p=(gy*size+gx)*4;let q;
     if(generated){const px=gx-bf.bbox.left,py=gy-bf.bbox.top;if(px<0||py<0||px>=bf.bbox.width||py>=bf.bbox.height)continue;q=(py*bf.bbox.width+px)*4;}else q=p;
     const src=generated?patch:next.data;mask[gy*size+gx]=localMask[local];for(let c=0;c<3;c++)out[p+c]=Math.round(base.data[p+c]*(1-a)+src[q+c]*a);
    }
    eyeDetails.push({baseBounds:bf.bbox,baseFeaturePixels:bf.count,sourceBounds:nf.bbox,sourceFeaturePixels:nf.count,baseBeadContourFilled:!!bf.convexBeadContour,sourceBeadContourFilled:!!nf.convexBeadContour,mask:generated?'original yellow feature; 6px inward feather':'union of original eye and expression contour; 10px edge + 12px feather'});
   }
   const proof=check(base.data,out,mask,size,size),stem=`${def.name}_${cut}`,output=path.join(dir,`${stem}_4K.png`),maskFile=path.join(dir,`${stem}_마스크.png`),small=await world480(out,crop),allowed=resizedAllowance(mask,crop),smallProof=check(smallBase,small,allowed,480,480);
   await saveRaw(out,size,size,output);await saveRaw(mask,size,size,maskFile,1);await saveRaw(small,480,480,path.join(dir,`${stem}_480.png`));
   const entry={character:def.name,expression:cut,source:path.relative(root,source),sourceSha256:sha(source),base:path.relative(root,baseFile),baseSha256:sha(baseFile),output:path.relative(root,output),sha256:sha(output),mask:path.relative(root,maskFile),eyes:eyeDetails,...proof,lossless480:{...smallProof,crop,resizeBoundaryPixels:5}};
   report.files.push(entry);console.log(`${stem}: ${proof.changedPixels} eye pixels; outside=${proof.outsideMaskRGBAChanges}; 480 outside=${smallProof.outsideMaskRGBAChanges}`);
  }
 }
 if(apply){
  const screenDir=path.join(root,'docs/캐릭터/화면_1024'),indexFile=path.join(screenDir,'판.json'),index=JSON.parse(fs.readFileSync(indexFile,'utf8'));
  const targetNames=new Set(report.files.map(entry=>`${entry.character}_${entry.expression}`)),protectedFiles=[];
  for(const folder of [canon,screenDir])for(const file of fs.readdirSync(folder)){const stem=path.parse(file).name;if(/\.(png|webp)$/.test(file)&&!targetNames.has(stem))protectedFiles.push({path:path.join(folder,file),sha256:sha(path.join(folder,file))});}
  const protectedIndex=Object.fromEntries(Object.entries(index.컷).filter(([stem])=>!targetNames.has(stem)).map(([stem,value])=>[stem,JSON.stringify(value)]));
  for(const entry of report.files){const stem=`${entry.character}_${entry.expression}`,candidate=path.join(root,entry.output),target=path.join(canon,`${stem}.png`),screen=path.join(screenDir,`${stem}.webp`);writeVerified(target,fs.readFileSync(candidate));writeVerified(screen,await sharp(candidate).resize(1024,1024).webp({quality:92,effort:6}).toBuffer());index.컷[stem]={원본:`${stem}.png`,크기:1024,머리맞춤:{배:1,dx:0,dy:0},몸겹침되밈:null,눈만얹음_칸:entry.changedPixels,원본SHA256:entry.sha256,파생SHA256:sha(screen),생성기:'tools/튜터표정정본.js'};}
  index.언제=new Date().toISOString();writeVerified(indexFile,Buffer.from(JSON.stringify(index,null,2)+'\n'));
  for(const file of protectedFiles)if(sha(file.path)!==file.sha256)throw Error(`Unrelated asset changed: ${file.path}`);
  for(const [stem,value] of Object.entries(protectedIndex))if(JSON.stringify(index.컷[stem])!==value)throw Error(`Unrelated screen index entry changed: ${stem}`);
  for(const def of defs)if(sha(path.join(canon,`${def.name}_본체.png`))!==sha(path.join(dir,`이전_${def.name}_본체.png`)))throw Error('Original body changed');
  report.protected={canonicalAnd1024Files:protectedFiles.length,unchanged:true,indexEntries:Object.keys(protectedIndex).length,indexEntriesUnchanged:true,originalBodiesUnchanged:true,kkamongUnchanged:true};report.applied=true;
 }
 fs.writeFileSync(path.join(dir,'정본.json'),JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
