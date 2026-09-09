'use strict';
// Existing high-resolution felt glyphs, web-size derivatives only. No recolouring.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
async function main(){
 const out=path.join(__dirname,'assets'),qa=path.join(__dirname,'_검토/편집-v4');
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(qa,{recursive:true});
 const entries=[];
 for(const number of [1,2,3]){
  const source=path.join(root,`docs/Loom_자산/구움/공방_숫자${number}.avif`),bytes=fs.readFileSync(source),meta=await sharp(bytes).metadata();
  const target=path.join(out,`felt-number-${number}.webp`);
  await sharp(bytes).resize({height:480,withoutEnlargement:true}).webp({quality:92,alphaQuality:100}).toFile(target);
  await sharp(bytes).resize({height:480,withoutEnlargement:true}).png().toFile(path.join(qa,`number-${number}.png`));
  entries.push({number,source:path.relative(root,source),sourceWidth:meta.width,sourceHeight:meta.height,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),output:path.relative(__dirname,target),...(await sharp(target).metadata())});
 }
 fs.writeFileSync(path.join(qa,'글자자산.json'),JSON.stringify(entries,null,2)+'\n');
 console.log(entries.map(x=>({number:x.number,source:[x.sourceWidth,x.sourceHeight],web:[x.width,x.height],bytes:x.size})));
}
main().catch(e=>{console.error(e);process.exitCode=1});
