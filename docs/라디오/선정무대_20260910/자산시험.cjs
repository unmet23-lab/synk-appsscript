'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),pub=path.join(root,'영상/public/radioDreams20260910');
const pixels=require(path.join(root,'영상/src/radioDreams20260910/pixels.cjs'));
async function main(){
 const plan=JSON.parse(fs.readFileSync(path.join(pub,'plan.json'),'utf8'));
 for(const input of plan.files){
  for(const file of [path.join(root,input.path),path.join(pub,input.copy)])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),input.sha256,'Immutable reference changed: '+file);
 }
 const raw=await Promise.all(['water-0.webp','water-1.webp','water-2.webp','leaf-base.webp'].map(n=>sharp(path.join(pub,n)).ensureAlpha().raw().toBuffer()));
 const copies=raw.map(a=>Buffer.from(a)),result=pixels.build(raw.slice(0,3),raw[3]);
 raw.forEach((a,i)=>assert.deepEqual(a,copies[i],'Source memory changed'));
 let alphaMismatch=0,outsideEyeDifference=0,clothingDifference=0;
 for(const frames of [result.water,result.field])for(const frame of frames)for(let p=0;p<1024*1024;p++){
  if(frame[p*4+3]!==frames[0][p*4+3])alphaMismatch++;
  for(let c=0;c<4;c++)if(frame[p*4+c]!==frames[0][p*4+c]){
   if(!result.mask[p])outsideEyeDifference++;
   if(Math.floor(p/1024)>425)clothingDifference++;
  }
 }
 assert.equal(alphaMismatch,0);assert.equal(outsideEyeDifference,0);assert.equal(clothingDifference,0);
 assert.equal(plan.faces.length,1848);assert.equal(plan.faces[0],plan.faces[1799]);
 assert.deepEqual([...new Set(plan.faces)].sort(),[0,1,2]);
 const bad=raw.slice(0,3).map(a=>Buffer.from(a));bad[1][100*1024*4+100*4]^=1;
 assert.throws(()=>pixels.build(bad,raw[3]),/outside eyes/,'Must reject facial-fur drift outside eye support');
 const report={at:new Date().toISOString(),sourceFiles:plan.files.length,sourceHashes:'pass',sourceMutation:0,alphaMismatch,outsideEyeDifference,clothingDifference,eyeMaskPixels:result.stats.maskPixels,expressionScheduleFrames:plan.faces.length,corruptDonorRejected:true};
 fs.writeFileSync(path.join(__dirname,'자산시험.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
