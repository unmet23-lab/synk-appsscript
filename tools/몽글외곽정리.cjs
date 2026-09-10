#!/usr/bin/env node
'use strict';
// Restore pale extraction spill in a narrow exterior band; never redraw the mascot.
// A sibling to 마스코트가장자리수리.py for the coral mascot's opaque pink/grey fringe.
// Usage: node tools/몽글외곽정리.cjs INPUT.png OUTPUT.png
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let sharp;
try { sharp = require('sharp'); } catch {
  sharp = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
async function repair(input, output) {
  if (path.resolve(input) === path.resolve(output)) throw new Error('Write a candidate first; do not overwrite the source.');
  const source = fs.readFileSync(input);
  const {data, info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w, height:h} = info, n = w*h, band = Math.round(w*24/4096);
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
  for(let p=0;p<n;p++) {
    const j=p*4, r=data[j],g=data[j+1],b=data[j+2];
    if(!data[j+3]||depth[p]>=band||distance[p]>band*3||nearest[p]<0)continue;
    // Preserve cream/yellow stitches and naturally saturated coral fibres.
    if(r<128 || g/r<.66 || Math.abs(g-b)>29)continue;
    const k=nearest[p]*3, sr=guide[k],sg=guide[k+1],sb=guide[k+2];
    if(sr<128||sg/sr>.72||sg-sb>50)continue;
    const strength=Math.min(1,(band-depth[p])/Math.max(1,band*.32));
    // Remove an estimated white matte, preserving each edge pixel's own fibre
    // variation instead of extending one interior RGB pixel into stripes.
    const matte=Math.max(0,Math.min(.66,1-(r-g)/Math.max(1,sr-sg)))*strength;
    for(let c=0;c<3;c++)out[j+c]=Math.round(Math.max(0,Math.min(255,(data[j+c]-255*matte)/(1-matte))));
    if(out[j]!==r||out[j+1]!==g||out[j+2]!==b)changed++;
  }
  for(let p=0;p<n;p++){const j=p*4;if(out[j+3]!==data[j+3])alphaChanges++;if(depth[p]>=band&&out.subarray(j,j+4).compare(data.subarray(j,j+4)))interiorChanges++;}
  if(alphaChanges||interiorChanges)throw new Error('Preservation contract failed');
  await sharp(out,{raw:{width:w,height:h,channels:4}}).png().toFile(output);
  return {input,output,width:w,height:h,band,changedPixels:changed,alphaChanges,interiorChanges,sourceSha256:sha(source),outputSha256:sha(fs.readFileSync(output))};
}
if(require.main===module){const [, ,input,output]=process.argv;if(!input||!output)throw new Error('INPUT.png OUTPUT.png required');repair(input,output).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={repair};
