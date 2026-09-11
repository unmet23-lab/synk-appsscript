#!/usr/bin/env node
'use strict';
// Restore pale extraction spill in a narrow exterior band; never redraw the mascot.
// Coral Mongle and chestnut Kkamong share the same exterior-only matte repair path.
// Usage: node tools/몽글외곽정리.cjs INPUT.png OUTPUT.png [몽글|까몽]
//        node tools/몽글외곽정리.cjs --세트 INPUT_DIR OUTPUT_DIR 몽글|까몽
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let sharp;
try { sharp = require('sharp'); } catch {
  sharp = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// Locate the actual coral tail piece. A dark brown donor can have the same G/R
// ratio as coral; using that ratio to skip whole scanlines leaves white stripes.
// The largest opaque coral component in the lower body defines a local hull,
// including the cream stitches inside it. Feather its protection at the edge.
async function coralProtection(data,w,h,queue) {
  const n=w*h, seen=new Uint8Array(n);let best=[];
  const coral=p=>{const j=p*4,r=data[j],g=data[j+1],b=data[j+2];return p>=w*Math.floor(h*.45)&&data[j+3]>=220&&r>=150&&r-g>=45&&r-b>=55&&g-b>=0&&g-b<=35;};
  for(let start=Math.floor(h*.45)*w;start<n;start++) {
    if(seen[start]||!coral(start))continue;
    let head=0,tail=0;seen[start]=1;queue[tail++]=start;
    const visit=p=>{if(!seen[p]&&coral(p)){seen[p]=1;queue[tail++]=p;}};
    while(head<tail){const p=queue[head++],x=p%w;if(x)visit(p-1);if(x<w-1)visit(p+1);if(p>=w)visit(p-w);if(p<n-w)visit(p+w);}
    if(tail>best.length)best=Array.from(queue.subarray(0,tail));
  }
  if(best.length<n*.0005)throw new Error('Cannot locate Kkamong coral tail piece; inspect this source before repair.');
  const left=new Int32Array(h).fill(w),right=new Int32Array(h).fill(-1);
  for(const p of best){const y=Math.floor(p/w),x=p%w;left[y]=Math.min(left[y],x);right[y]=Math.max(right[y],x);}
  const points=[];for(let y=0;y<h;y++)if(right[y]>=0){points.push([left[y],y],[right[y],y]);}
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=pts=>{const hull=[];for(const p of pts){while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],p)<=0)hull.pop();hull.push(p);}hull.pop();return hull;};
  const hull=[...half(points),...half([...points].reverse())],mask=Buffer.alloc(n);
  const bounds=[Math.min(...hull.map(p=>p[0])),Math.min(...hull.map(p=>p[1])),Math.max(...hull.map(p=>p[0])),Math.max(...hull.map(p=>p[1]))];
  for(let y=bounds[1];y<=bounds[3];y++){
    const cuts=[];for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
    if(cuts.length>1)mask.fill(255,y*w+Math.max(0,Math.floor(Math.min(...cuts))),y*w+Math.min(w,Math.ceil(Math.max(...cuts))+1));
  }
  const feather=Math.max(1,w*8/4096);
  const protection=await sharp(mask,{raw:{width:w,height:h,channels:1}}).blur(feather).threshold(8).blur(feather).toColourspace('b-w').raw().toBuffer();
  return {protection,metadata:{method:'largest lower-body coral component; filled convex hull; feathered local protection',seedPixels:best.length,bounds,feather}};
}
async function repair(input, output, character = '몽글') {
  if (path.resolve(input) === path.resolve(output)) throw new Error('Write a candidate first; do not overwrite the source.');
  if (!['몽글','까몽'].includes(character)) throw new Error('몽글 or 까몽 required');
  const source = fs.readFileSync(input);
  const {data, info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w, height:h} = info, n = w*h, band = Math.round(w*(character === '까몽' ? 56 : 32)/4096);
  const depth = new Uint16Array(n), distance = new Uint16Array(n), nearest = new Int32Array(n);
  // Only the canvas-connected exterior is a boundary. Interior fibre/stitch holes
  // must never become correction seeds or change the surrounding approved texture.
  const exterior=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
  const visit=p=>{if(!exterior[p]&&data[p*4+3]<250){exterior[p]=1;queue[tail++]=p;}};
  for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}
  for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
  while(head<tail){const p=queue[head++],x=p%w;if(x)visit(p-1);if(x<w-1)visit(p+1);if(p>=w)visit(p-w);if(p<n-w)visit(p+w);}
  for (let p=0;p<n;p++) depth[p] = exterior[p] ? 0 : 32000;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const p=y*w+x; if (x) depth[p]=Math.min(depth[p],depth[p-1]+1); if(y) depth[p]=Math.min(depth[p],depth[p-w]+1);
  }
  for (let y=h-1;y>=0;y--) for(let x=w-1;x>=0;x--) {
    const p=y*w+x; if(x<w-1) depth[p]=Math.min(depth[p],depth[p+1]+1); if(y<h-1) depth[p]=Math.min(depth[p],depth[p+w]+1);
  }
  for(let p=0;p<n;p++) {const core=depth[p]>=band;distance[p]=core?0:32000;nearest[p]=core?p:-1;}
  const relax=(p,q)=>{if(distance[q]+1<distance[p]){distance[p]=distance[q]+1;nearest[p]=nearest[q];}};
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){const p=y*w+x;if(x)relax(p,p-1);if(y)relax(p,p-w);}
  for(let y=h-1;y>=0;y--) for(let x=w-1;x>=0;x--){const p=y*w+x;if(x<w-1)relax(p,p+1);if(y<h-1)relax(p,p+w);}
  const out=Buffer.from(data); let changed=0,alphaChanges=0,interiorChanges=0;
  const guide=await sharp(data,{raw:{width:w,height:h,channels:4}}).removeAlpha().blur(4).raw().toBuffer();
  // Manhattan nearest donors form rectangular regions at concave folds. Blend
  // only the borrowed colour estimate, keeping original fibre pixels untouched.
  // This avoids hard bright rectangles where two valid interior donors meet.
  let donorGuide=guide;
  if(character==='까몽'){
    const donors=Buffer.alloc(n*3);
    for(let p=0;p<n;p++){const k=Math.max(0,nearest[p])*3,j=p*3;donors[j]=guide[k];donors[j+1]=guide[k+1];donors[j+2]=guide[k+2];}
    donorGuide=await sharp(donors,{raw:{width:w,height:h,channels:3}}).blur(Math.max(1,band*.35)).raw().toBuffer();
  }
  const protectedPart=character==='까몽'?await coralProtection(data,w,h,queue):null;
  for(let p=0;p<n;p++) {
    const j=p*4, r=data[j],g=data[j+1],b=data[j+2];
    if(!data[j+3]||depth[p]>=band||distance[p]>band*3||nearest[p]<0)continue;
    // Preserve cream/yellow stitches and naturally saturated coral fibres.
    if(r<(character === '까몽'?80:128) || g/r<.66 || Math.abs(g-b)>29)continue;
    const k=(character==='까몽'?p:nearest[p])*3, sr=donorGuide[k],sg=donorGuide[k+1],sb=donorGuide[k+2];
    if(character === '몽글' && (sr<128||sg/sr>.72||sg-sb>50))continue;
    const strength=Math.min(1,(band-depth[p])/Math.max(1,band*.32));
    // Remove an estimated white matte, preserving each edge pixel's own fibre
    // variation instead of extending one interior RGB pixel into stripes.
    const qg=sg/Math.max(1,sr), qb=sb/Math.max(1,sr);
    const mg=(g-qg*r)/Math.max(1,255*(1-qg));
    const mb=(b-qb*r)/Math.max(1,255*(1-qb));
    const neutralFur = character === '까몽' && (qg>.9 || sr-sb<12);
    const luminanceMatte=(r+g+b-sr-sg-sb)/Math.max(1,765-sr-sg-sb);
    const matte=Math.max(0,Math.min(character === '까몽'?.88:.76,neutralFur?luminanceMatte:Math.min(mg,mb)))*strength*(1-(protectedPart?.protection[p]||0)/255);
    for(let c=0;c<3;c++)out[j+c]=Math.round(Math.max(0,Math.min(255,(data[j+c]-255*matte)/(1-matte))));
    // The old white extraction had retained matte as opaque fur. Reconstruct its
    // coverage with the same white fraction; recoloring alone leaves a cut-paper edge.
    out[j+3]=Math.round(data[j+3]*(1-matte));
    if(out[j]!==r||out[j+1]!==g||out[j+2]!==b)changed++;
  }
  for(let p=0;p<n;p++){const j=p*4;if(out[j+3]!==data[j+3])alphaChanges++;if(depth[p]>=band&&out.subarray(j,j+4).compare(data.subarray(j,j+4)))interiorChanges++;}
  if(interiorChanges)throw new Error('Interior preservation contract failed');
  await sharp(out,{raw:{width:w,height:h,channels:4}}).png().toFile(output);
  return {input,output,character,width:w,height:h,band,changedPixels:changed,alphaChanges,interiorChanges,...(protectedPart?{protectedPart:protectedPart.metadata}:{}),sourceSha256:sha(source),outputSha256:sha(fs.readFileSync(output))};
}
async function repairSet(inputDir, outputDir, character) {
  if(path.resolve(inputDir)===path.resolve(outputDir))throw new Error('세트도 원본을 바로 덮지 않고 후보 폴더에 쓴다.');
  if(!['몽글','까몽'].includes(character))throw new Error('몽글 or 까몽 required');
  fs.mkdirSync(outputDir,{recursive:true});
  const bodyName=`${character}_본체.png`;
  const bodyInput=path.join(inputDir,bodyName),bodyOutput=path.join(outputDir,bodyName);
  const bodyResult=await repair(bodyInput,bodyOutput,character);
  const original=await sharp(bodyInput).ensureAlpha().raw().toBuffer();
  const fixed=await sharp(bodyOutput).ensureAlpha().raw().toBuffer();
  const pixels=[];
  for(let i=0;i<original.length;i+=4)if(original[i]!==fixed[i]||original[i+1]!==fixed[i+1]||original[i+2]!==fixed[i+2]||original[i+3]!==fixed[i+3])pixels.push(i);
  const results=[bodyResult];
  for(const file of fs.readdirSync(inputDir).filter(f=>f.startsWith(character+'_')&&f.endsWith('.png')&&f!==bodyName)) {
    const input=path.join(inputDir,file),output=path.join(outputDir,file);
    // Turned heads have a different silhouette; their own edge uses the same repair profile.
    if(/_(좌34|우34)\.png$/.test(file)){results.push(await repair(input,output,character));continue;}
    const source=fs.readFileSync(input);
    const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    if(info.width!==bodyResult.width||info.height!==bodyResult.height)throw new Error(`${file}: 본체와 프레임이 다르다.`);
    const patched=Buffer.from(data);let changedPixels=0;
    for(const i of pixels){if(patched[i]!==fixed[i]||patched[i+1]!==fixed[i+1]||patched[i+2]!==fixed[i+2]||patched[i+3]!==fixed[i+3])changedPixels++;fixed.copy(patched,i,i,i+4);}
    await sharp(patched,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(output);
    results.push({input,output,character,width:info.width,height:info.height,commonBodyEdge:bodyName,changedPixels,sourceSha256:sha(source),outputSha256:sha(fs.readFileSync(output)),outsideSharedEdgeChanges:0});
  }
  return results;
}
if(require.main===module){const args=process.argv.slice(2);let task;if(args[0]==='--세트'){if(args.length!==4)throw new Error('--세트 INPUT_DIR OUTPUT_DIR 몽글|까몽 required');task=repairSet(args[1],args[2],args[3]);}else{const [input,output,character='몽글']=args;if(!input||!output)throw new Error('INPUT.png OUTPUT.png [몽글|까몽] required');task=repair(input,output,character);}task.then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={repair,repairSet};
