'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../../..'),base=path.dirname(__dirname);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'자산_생성명세.json'),'utf8'));
 const checks=[];
 for(const e of manifest.entries){
  const original=path.join(root,e.source),m=await sharp(original).metadata();
  if(hash(original)!==e.sourceSha256)throw Error('Source changed: '+e.name);
  const c={name:e.name,width:m.width,height:m.height,hasAlpha:m.hasAlpha,sourceSha256:e.sourceSha256};
  if(!m.hasAlpha)throw Error('No true alpha: '+e.name);
  if(e.export){
   const target=path.join(root,e.export),exp=await sharp(target).ensureAlpha().raw().toBuffer();
   const s=sharp(original);if(e.crop)s.extract(e.crop);
   const source=await s.ensureAlpha().raw().toBuffer();
   if(source.length!==exp.length)throw Error('Unexpected resize: '+e.name);
   let mismatch=0;
   for(let i=0;i<source.length;i+=4)if(source[i+3]!==exp[i+3]||(source[i+3]>0&&(source[i]!==exp[i]||source[i+1]!==exp[i+1]||source[i+2]!==exp[i+2])))mismatch++;
   c.visibleRgbaMismatch=mismatch;c.exportSha256=hash(target);
   if(mismatch)throw Error('Visible original pixel changed: '+e.name+' '+mismatch);
  }
  checks.push(c);
 }
 const scriptHash=hash(path.join(base,'콘텐츠원고.json'));
 if(scriptHash!=='416403fba084500d2d0fa806a343f80ad223dd021318c4c910f40043afcbfcd3')throw Error('Original copy changed');
 const report={checkedAt:new Date().toISOString(),sourceTextUnchanged:true,scriptSha256:scriptHash,checks,note:'This confirms file identity, real alpha and pixel-preserving export only. Visual silhouette, stitching and actual-size readability are reviewed separately.'};
 fs.writeFileSync(path.join(base,'_검토/스티치_자산검증.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
})();
