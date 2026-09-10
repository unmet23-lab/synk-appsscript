'use strict';
// Existing public pages keep their copy/layout; only the approved complete logo changes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Pure markup/verification imports do not require the image-rendering runtime.
const sharp=(...args)=>require('sharp')(...args);
const kit=path.join(__dirname,'마케팅실행_20260909/브랜드킷');
const manifest=()=>JSON.parse(fs.readFileSync(path.join(kit,'배치명세.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Windows image previews can retain a mapped read handle. Replace the finished file without truncating that handle.
function replaceFile(target,bytes){const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);if(fs.existsSync(target)&&sha(fs.readFileSync(target))===sha(data))return;const tmp=target+'.logo-tmp';fs.writeFileSync(tmp,data);fs.renameSync(tmp,target);}
const excluded=new Set(['_검토','미리보기','소개서_4K','캐러셀_업로드','캐러셀_고해상도','로고디테일','브랜드킷','_개선','packages','음성','공개수업','첫게시물_20260910']);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(excluded.has(e.name)?[]:files(path.join(dir,e.name))):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);}
function rewrite(html,file,base=path.dirname(file)){
 const relative=path.relative(path.dirname(file),path.join(base,'assets')).replaceAll('\\','/')||'.';
 return html.replace(/<div class="(brand-lock|brand(?:\s[^\"]*)?)"([^>]*)>([\s\S]*?)<\/div>/g,(whole,cls,attrs,inside)=>{
  if(!/(?:brand-synk|data-division|<svg|data-approved-logo)/.test(whole))return whole;
  const brand=(whole.match(/(?:data-division|data-approved-logo)="(LAB|SHIFT|PULSE|SYNK)"/)||whole.match(/(?:aria-label|data-lockup)="SYNK\s+(LAB|SHIFT|PULSE)"/)||[])[1]||'SYNK';
  const height=cls==='brand-lock'?'height:100%;max-height:116px;':'height:100%;max-height:100%;';
  return `<div class="${cls}"${attrs.replace(/\sdata-approved-logo="[^"]*"/g,'')} data-approved-logo="${brand}"><img src="${relative}/brand-full-${brand.toLowerCase()}-ink.webp" alt="${brand==='SYNK'?'SYNK':'SYNK '+brand}" style="display:block;${height}width:auto;max-width:100%;object-fit:contain;object-position:left center;flex:none" decoding="sync"></div>`;
 });
}
async function refreshFolder(base){
 const source=manifest();if(source.version<2)throw Error('Current no-stitch source manifest required');
 fs.mkdirSync(path.join(base,'assets'),{recursive:true});const report={at:new Date().toISOString(),source:'마케팅실행_20260909/브랜드킷/배치명세.json',assets:[],pages:[]};
 for(const item of source.items){
  const input=fs.readFileSync(path.join(kit,item.file));if(sha(input)!==item.sha256)throw Error('Source hash mismatch '+item.file);
  const output=await sharp(input).resize({width:2200,withoutEnlargement:true}).webp({lossless:true}).toBuffer();
  const target=path.join(base,'assets',`brand-full-${item.brand.toLowerCase()}-${item.variant.toLowerCase()}.webp`);
  if(!fs.existsSync(target)||sha(fs.readFileSync(target))!==sha(output))replaceFile(target,output);
  report.assets.push({file:path.relative(base,target).replaceAll('\\','/'),source:item.file,sourceSha256:item.sha256,sha256:sha(output)});
 }
 // Existing standalone image consumers (including embedded introduction covers) keep their role.
 for(const name of ['brand-synk.webp','woolLogo.webp']){const target=path.join(base,'assets',name);if(fs.existsSync(target)){const src=path.join(kit,'SYNK-Ink.png');const output=await sharp(src).trim({threshold:12}).resize({width:2820}).webp({lossless:true}).toBuffer();if(sha(fs.readFileSync(target))!==sha(output))replaceFile(target,output);report.assets.push({file:'assets/'+name,source:'SYNK-Ink.png',sha256:sha(output)});}}
 // Refresh embedded document thumbnails from the already rendered, current introduction pages.
 const intro=path.join(__dirname,'브랜드소개_20260909/소개서_4K');
 for(const [name,page] of Object.entries({'labpage.webp':'lab-1','labpage-neutral.webp':'lab-1','shiftpage.webp':'shift-1','pulsepage.webp':'pulse-1','pulsepage-r2.webp':'pulse-1','synkpage.webp':'synk-1'})){
  const target=path.join(base,'assets',name),input=path.join(intro,page+'.png');
  if(!fs.existsSync(target)||!fs.existsSync(input))continue;
  const meta=await sharp(fs.readFileSync(target)).metadata(),output=await sharp(input).resize(meta.width,meta.height,{fit:'fill'}).webp({lossless:true}).toBuffer();
  if(sha(fs.readFileSync(target))!==sha(output))replaceFile(target,output);
  report.assets.push({file:'assets/'+name,source:path.relative(__dirname,input).replaceAll('\\','/'),sha256:sha(output)});
 }
 const reusable=path.join(base,'_개선/배치용/brand-synk.webp');
 if(fs.existsSync(reusable)){
  const current=fs.readFileSync(path.join(base,'assets/brand-synk.webp'));if(sha(fs.readFileSync(reusable))!==sha(current))replaceFile(reusable,current);
  const record=path.join(base,'_개선/자산_생성명세.json');
  if(fs.existsSync(record)){const data=JSON.parse(fs.readFileSync(record,'utf8')),entry=data.entries.find(x=>x.name==='SYNK');if(entry)Object.assign(entry,{source:'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink.png',sourceSha256:sha(fs.readFileSync(path.join(kit,'SYNK-Ink.png'))),sha256:sha(current),operation:'2026-09-10 approved no-stitch SYNK Ink master. Aspect-preserving 2820px lossless WebP; division entries retained.'});replaceFile(record,JSON.stringify(data,null,2));}
 }
 // Keep existing asset inventories truthful while preserving their original schema and unrelated entries.
 for(const name of ['사용자산.json','자산명세.json']){
  const target=path.join(base,name);if(!fs.existsSync(target))continue;const inventory=JSON.parse(fs.readFileSync(target,'utf8'));if(!Array.isArray(inventory)||!inventory.some(x=>x&&typeof x==='object'))continue;
  for(const row of inventory){const item=report.assets.find(x=>x.file===(row.output||row.path));if(!item)continue;const bytes=fs.readFileSync(path.join(base,item.file)),meta=await sharp(bytes).metadata(),origin=path.join(item.source.startsWith('브랜드소개_')?__dirname:kit,item.source);
   if('sha256'in row)row.sha256=item.sha256;if('outputSha256'in row)row.outputSha256=item.sha256;
   if('width'in row)row.width=meta.width;if('height'in row)row.height=meta.height;
   if('source'in row){row.source=path.relative(path.resolve(__dirname,'../..'),origin).replaceAll('\\','/');if('sourceSha256'in row)row.sourceSha256=sha(fs.readFileSync(origin));if('sourceWidth'in row){const m=await sharp(origin).metadata();row.sourceWidth=m.width;row.sourceHeight=m.height;}row.transform='Approved complete logo or current introduction snapshot; existing display dimensions retained.';}
  }
  replaceFile(target,JSON.stringify(inventory,null,2));
 }
 for(const file of files(base)){const before=fs.readFileSync(file,'utf8'),after=rewrite(before,file,base);if(before!==after)replaceFile(file,after);if(after.includes('data-approved-logo='))report.pages.push({file:path.relative(base,file).replaceAll('\\','/'),changed:before!==after,before:sha(Buffer.from(before)),after:sha(Buffer.from(after))});}
 fs.mkdirSync(path.join(base,'_검토'),{recursive:true});replaceFile(path.join(base,'_검토/로고갱신_20260910.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({folder:path.basename(base),logos:report.assets.length,pages:report.pages.length}));return report;
}
module.exports={rewrite,refreshFolder,replaceFile};
if(require.main===module)(async()=>{for(const folder of process.argv.slice(2))await refreshFolder(path.resolve(folder));})().catch(e=>{console.error(e);process.exitCode=1});
