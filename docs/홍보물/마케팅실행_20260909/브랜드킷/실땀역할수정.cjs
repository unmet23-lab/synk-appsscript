'use strict';
// ImageGen edits provide the new felt surface. The approved source alpha remains
// the production silhouette; RGB checkerboard previews are never shipped.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const sharp=require('sharp');
const root=path.resolve(__dirname,'../../../..');
const rel=path.relative(root,__dirname).replaceAll('\\','/');
const baseline='6b3dffab88dc0a868e1b4794b76d50da0ceb8beb';
const sourceAt=p=>cp.execFileSync('git',['show',`${baseline}:${rel}/${p}`],{cwd:root,maxBuffer:40*1024*1024});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const directory=path.join(__dirname,'실땀수정');
const inputs={
 Ink:'C:/Users/q1212/.codex/generated_images/01a08a5b-7899-73f3-9c5c-f904823afa36/exec-35c1900a-cd8f-4e50-b8df-8be1747928b4.png',
 Paper:'C:/Users/q1212/.codex/generated_images/01a08a5b-7899-73f3-9c5c-f904823afa36/exec-c34f30d9-7b2e-4e9f-be75-9ddaebfdc02c.png'
};
(async()=>{
 fs.mkdirSync(directory,{recursive:true});
 const items=[];
 for(const variant of ['Ink','Paper']){
  const reference=sourceAt(`SYNK-${variant}.png`),single=sourceAt(`배치용/SYNK-${variant}.png`);
  const rawPath=path.join(directory,`SYNK-${variant}-imagegen.png`);
  if(!fs.existsSync(rawPath))fs.copyFileSync(inputs[variant],rawPath);
  const generated=fs.readFileSync(rawPath),gm=await sharp(generated).metadata(),sm=await sharp(single).metadata();
  const {info:trim}=await sharp(reference).trim({threshold:12}).png().toBuffer({resolveWithObject:true});
  const left=-trim.trimOffsetLeft,top=-trim.trimOffsetTop;
  const scaled=await sharp(generated).resize(sm.width,sm.height,{fit:'fill'}).png().toBuffer();
  const surface=await sharp(scaled).extract({left:100,top:100,width:2000,height:sm.height-200}).resize(trim.width,trim.height,{fit:'fill'}).removeAlpha().raw().toBuffer();
  const {data:original,info}=await sharp(reference).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const output=Buffer.from(original);
  const valid=(x,y)=>{const i=(y*trim.width+x)*3;return surface[i]-surface[i+2]>(variant==='Ink'?6:10)&&surface[i]>surface[i+1]+1;};
  const rgb=(x,y)=>(y*trim.width+x)*3;
  let restored=0,alphaChanged=0,visible=0,preservedFuzz=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const i=(y*info.width+x)*4,a=original[i+3];
   if(!a){output[i]=output[i+1]=output[i+2]=0;continue;}
   if(a<32){preservedFuzz++;continue;}
   visible++;
   let sx=Math.max(0,Math.min(trim.width-1,x-left)),sy=Math.max(0,Math.min(trim.height-1,y-top));
   if(!valid(sx,sy)){
    let found=false;
    for(let r=1;r<=80&&!found;r++){
     for(let dy=-r;dy<=r&&!found;dy++)for(const dx of [-r,r]){
      const nx=sx+dx,ny=sy+dy;
      if(nx>=0&&nx<trim.width&&ny>=0&&ny<trim.height&&valid(nx,ny)){sx=nx;sy=ny;found=true;break;}
     }
     if(!found)for(let dx=-r+1;dx<r&&!found;dx++)for(const dy of [-r,r]){
      const nx=sx+dx,ny=sy+dy;
      if(nx>=0&&nx<trim.width&&ny>=0&&ny<trim.height&&valid(nx,ny)){sx=nx;sy=ny;found=true;break;}
     }
    }
    if(!found)throw Error(`No felt surface at ${variant} ${x},${y}`);
    restored++;
   }
   const s=rgb(sx,sy);output[i]=surface[s];output[i+1]=surface[s+1];output[i+2]=surface[s+2];
   if(output[i+3]!==a)alphaChanged++;
  }
  if(alphaChanged)throw Error('Approved alpha changed');
  const file=path.join(__dirname,`SYNK-${variant}.png`);
  const finished=await sharp(output,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  fs.writeFileSync(file,finished);
  items.push({variant,baseline,originalSha256:sha(reference),generatedFile:`실땀수정/SYNK-${variant}-imagegen.png`,generatedSha256:sha(generated),generatedWidth:gm.width,generatedHeight:gm.height,generatedHadAlpha:!!gm.hasAlpha,output:`SYNK-${variant}.png`,width:info.width,height:info.height,sha256:sha(finished),alphaChangedPixels:alphaChanged,preservedFuzzPixels:preservedFuzz,registeredEdgePixels:restored,registeredEdgeFraction:restored/visible});
 }
 fs.writeFileSync(path.join(directory,'제작명세.json'),JSON.stringify({date:'2026-09-10',method:'Built-in ImageGen removed the stitches. Its RGB previews were registered to the approved source alpha without changing silhouette, canvas, or counters. Checkerboard edge samples were replaced with adjacent generated felt RGB before alpha export. This preserves the original alpha, not the original surface pixels; the generated texture is a material interpretation.',items},null,2)+'\n');
 console.log(JSON.stringify(items.map(({variant,width,height,alphaChangedPixels,registeredEdgeFraction})=>({variant,width,height,alphaChangedPixels,registeredEdgeFraction}))));
})().catch(e=>{console.error(e.message);process.exitCode=1});
