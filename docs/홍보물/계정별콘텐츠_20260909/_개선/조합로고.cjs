'use strict';
// Reusable exports consume the approved complete composition without recomposing division lettering.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto');
const kit=path.resolve(__dirname,'../../마케팅실행_20260909/브랜드킷'),out=path.join(__dirname,'조합로고'),qa=path.join(__dirname,'../_검토/조합로고_QA');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(qa,{recursive:true});
 const source=JSON.parse(fs.readFileSync(path.join(kit,'배치명세.json'),'utf8')),items=[];
 if(source.version<2)throw Error('Current approved logo manifest required');
 for(const item of source.items.filter(x=>x.variant==='Ink')){
  const bytes=fs.readFileSync(path.join(kit,item.file));if(sha(bytes)!==item.sha256)throw Error('Source hash mismatch');
  const name=item.brand==='SYNK'?'SYNK':'SYNK-'+item.brand,target=path.join(out,name+'.png');fs.writeFileSync(target,bytes);
  for(const [label,background] of [['Paper','#FBF7F0'],['Ink','#221E1C']])await sharp(bytes).flatten({background}).resize({width:1600}).png().toFile(path.join(qa,name+'-'+label+'.png'));
  items.push({file:path.basename(target),source:item.file,sha256:sha(bytes),width:item.width,height:item.height,method:'Approved complete Ink composition copied exactly. SYNK has no stitches; division stitches retained.'});
 }
 fs.writeFileSync(path.join(out,'명세.json'),JSON.stringify(items,null,2));console.log(JSON.stringify({logos:items.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
