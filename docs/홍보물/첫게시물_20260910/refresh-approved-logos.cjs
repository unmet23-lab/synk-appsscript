'use strict';
// Logo-only sync. Never regenerates narration, scenes, mascots, or historical proofs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),kit=path.join(root,'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용');
const shared=path.join(root,'영상/public/firstposts20260910'),sharp=require('sharp');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
async function main(){
 const report=read(path.join(__dirname,'_검토/자산과원본.json')),map=read(path.join(shared,'assets.json')),copies=[];
 function copy(source,target){fs.mkdirSync(path.dirname(target),{recursive:true});const before=fs.existsSync(target)?sha(target):null;fs.copyFileSync(source,target);if(sha(source)!==sha(target))throw Error('Copy mismatch '+target);copies.push({file:path.relative(root,target).replaceAll('\\','/'),beforeSha256:before,sha256:sha(target)});}
 for(const brand of ['SYNK','LAB','SHIFT','PULSE'])for(const color of ['Ink','Paper']){
  const key='logo-'+brand.toLowerCase()+(color==='Paper'?'-paper':''),file=key+'.png',source=path.join(kit,'SYNK'+(brand==='SYNK'?'':'-'+brand)+'-'+color+'.png');
  for(const folder of [path.join(__dirname,'assets'),shared])copy(source,path.join(folder,file));
  const media=await sharp(source).metadata(),record={key,file,source:path.relative(root,source).replaceAll('\\','/'),sha256:sha(source),width:media.width,height:media.height,hasAlpha:media.hasAlpha};
  const index=report.assets.findIndex(a=>a.key===key);if(index<0)report.assets.push(record);else report.assets[index]={...report.assets[index],...record};map[key]=file;
 }
 for(const name of ['계정별20260909','마케팅실행20260909'])for(const suffix of ['', '-paper']){
  const file='brand-synk'+suffix+'.webp',target=path.join(root,'영상/public',name,file);
  if(fs.existsSync(target))copy(path.join(root,'docs/홍보물/마케팅실행_20260909/assets',file),target);
 }
 for(const target of ['영상/public/klofi20260909/synk-paper.webp','영상/public/릴10편/로고.png','영상/out/릴10편_사용자산/릴10편/로고.png'])if(fs.existsSync(path.join(root,target)))copy(target.includes('klofi')?path.join(root,'docs/홍보물/마케팅실행_20260909/assets/brand-synk-paper.webp'):path.join(kit,'SYNK-LAB-Ink.png'),path.join(root,target));
 report.logoRefreshedAt=new Date().toISOString();report.logoPolicy='SYNK: no stitches, felt preserved. Division lettering: existing color and stitches preserved.';
 json(path.join(__dirname,'_검토/자산과원본.json'),report);json(path.join(shared,'assets.json'),map);
 // Current isolated renderer cache only; prior/rejected snapshots remain historical evidence.
 const cache=path.join(__dirname,'_검토/video/public/firstposts20260910');
 if(fs.existsSync(cache)){for(const [key,file] of Object.entries(map))if(key.startsWith('logo-'))copy(path.join(shared,file),path.join(cache,file));json(path.join(cache,'assets.json'),map);}
 json(path.join(__dirname,'_검토/로고반영/자산동기화.json'),{at:new Date().toISOString(),policy:report.logoPolicy,copies});
 console.log(JSON.stringify({copies:copies.length,logoVariants:8,nonLogoContentChanged:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
