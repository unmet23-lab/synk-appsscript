'use strict';
// Current complete photographic lockups. Historical basic/cover filenames remain compatible.
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const kit=path.resolve(__dirname,'../마케팅실행_20260909/브랜드킷'),dir=path.join(__dirname,'로고디테일'),exportDir=path.join(dir,'로고_투명');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{fs.mkdirSync(exportDir,{recursive:true});const source=JSON.parse(fs.readFileSync(path.join(kit,'배치명세.json'),'utf8')),strips=[],report=[];
for(const [i,brand] of ['LAB','SHIFT','PULSE'].entries()){
 const item=source.items.find(x=>x.brand===brand&&x.variant==='Ink'),input=fs.readFileSync(path.join(kit,item.file));if(sha(input)!==item.sha256)throw Error('Approved source hash mismatch');
 const output=await sharp(input).resize({width:3840}).png().toBuffer();for(const variant of ['기본형','표지형']){const file='SYNK-'+brand+'-'+variant+'-4K.png';fs.writeFileSync(path.join(exportDir,file),output);report.push({file,source:item.file,sourceSha256:item.sha256,sha256:sha(output),transform:'Proportional resize of complete approved lockup; no reassembly'});}
 const strip=await sharp(input).resize({width:750,height:220,fit:'contain',background:'#FBF7F0'}).flatten({background:'#FBF7F0'}).png().toBuffer();fs.writeFileSync(path.join(dir,brand.toLowerCase()+'-완성.png'),strip);strips.push({input:strip,left:0,top:i*236});
}
await sharp({create:{width:750,height:692,channels:3,background:'#FBF7F0'}}).composite(strips).png().toFile(path.join(dir,'완성로고.png'));fs.writeFileSync(path.join(dir,'로고검사.json'),JSON.stringify(report,null,2));console.log('Approved no-stitch SYNK lockups exported to six compatible filenames');})().catch(e=>{console.error(e);process.exitCode=1});
