#!/usr/bin/env node
'use strict';
// Re-export the separate name/diagnostic web copies from the shared source.
// This does not rebuild page copy or publish a site.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const assets=require('./lib/마스코트자산');
const sharp=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const check=process.argv.includes('--검사만'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const jobs=[
 ['본체','diag/assets/monggeul_base.webp',640,false],
 ['눈감음','diag/assets/monggeul_blink.webp',640,false],
 ['눈웃음','diag/assets/monggeul_smile.webp',640,false],
 ['눈웃음','name/assets/monggeul.webp',1000,true],
];
(async()=>{
 const rows=[];let filesWritten=0;
 for(const [expression,file,width,trim] of jobs){
  const input=fs.readFileSync(assets.절대경로(expression,{누끼:true}));let image=sharp(input);let crop=null;
  if(trim){
   const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1;
   for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>250){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
   if(r<l)throw new Error('Empty mascot');crop={left:l,top:t,width:r-l+1,height:b-t+1};image=image.extract(crop);
  }
  const {data,info}=await image.resize({width}).webp({quality:92,alphaQuality:100}).toBuffer({resolveWithObject:true});
  const target=path.resolve(root,'../synk-policy',file);
  if(!fs.existsSync(target))throw new Error('Expected existing consumer missing: '+target);
  const stale=sha(fs.readFileSync(target))!==sha(data);
  if(!check&&stale){fs.writeFileSync(target,data);filesWritten++;}
  rows.push({file,source:assets.경로(expression),sourceSha256:sha(input),sha256:sha(data),width:info.width,height:info.height,crop,stale:check?stale:false});
 }
 const manifest={recipe:'Current canonical mascot to existing 640px diagnostic and 1000px cropped name assets; WebP92/alpha100.',items:rows};
 if(!check)fs.writeFileSync(path.resolve(root,'../synk-policy/mascot-assets-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({checked:rows.length,stale:rows.filter(r=>r.stale).length,filesWritten,items:rows}));
 if(check&&rows.some(r=>r.stale))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
