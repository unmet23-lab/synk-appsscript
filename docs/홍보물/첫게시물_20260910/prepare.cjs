'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),base=path.join(root,'docs/홍보물/마케팅실행_20260909');
const sharp=require('sharp'),mascot=require(path.join(root,'tools/lib/마스코트자산'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.tmp';fs.writeFileSync(tmp,v);fs.renameSync(tmp,p)};
async function main(){
 const assets={};
 for(const b of ['SYNK','LAB','SHIFT','PULSE'])assets['logo-'+b.toLowerCase()]=path.join(base,'브랜드킷/배치용',b==='SYNK'?'SYNK-Ink.png':`SYNK-${b}-Ink.png`);
 for(const b of ['SYNK','LAB','SHIFT','PULSE'])assets['logo-'+b.toLowerCase()+'-paper']=path.join(base,'브랜드킷/배치용',b==='SYNK'?'SYNK-Paper.png':`SYNK-${b}-Paper.png`);
 for(const n of ['book','scissors','notebook','letter','compass','classroom','cafe','night'])assets[n]=path.join(base,'assets',n+'.webp');
 assets.mong=mascot.절대경로('본체');assets.smile=mascot.절대경로('눈웃음');assets.curious=mascot.절대경로('궁금함');
 const publicDir=path.join(root,'영상/public/firstposts20260910');
 const previousPath=path.join(__dirname,'_검토/자산과원본.json');
 const previous=fs.existsSync(previousPath)?JSON.parse(fs.readFileSync(previousPath,'utf8')).assets:[];
 const log=[];
 for(const [key,source] of Object.entries(assets)){
  const ext=path.extname(source),file=key+ext;const dest=path.join(__dirname,'assets',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);
  fs.mkdirSync(publicDir,{recursive:true});fs.copyFileSync(source,path.join(publicDir,file));
  const meta=await sharp(source).metadata();log.push({key,file,source:path.relative(root,source).replaceAll('\\','/'),sha256:sha(source),width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha});
 }
 // Preserve this edition's actual proof screenshots and registered work examples.
 for(const prior of previous){
  if(log.some(x=>x.key===prior.key))continue;
  const file=path.join(__dirname,'assets',prior.file);
  if(!fs.existsSync(file))throw Error('Registered edition asset missing: '+prior.file);
  fs.copyFileSync(file,path.join(publicDir,prior.file));
  log.push({...prior,sha256:sha(file)});
 }
 const sources=['docs/AI_운영원칙.md','docs/마케팅_정본.md','docs/SYNK_철학.md','docs/사업발전_정본.md','docs/명품_기준_v1.md','docs/디자인_토큰.json','docs/홍보물/마케팅실행_20260909/원고/콘텐츠원고.json','docs/홍보물/마케팅실행_20260909/브랜드킷/배치명세.json'];
 put(path.join(__dirname,'_검토/자산과원본.json'),JSON.stringify({preparedAt:new Date().toISOString(),assets:log,sources:sources.map(p=>({path:p,sha256:sha(path.join(root,p))}))},null,2));
 put(path.join(publicDir,'assets.json'),JSON.stringify(Object.fromEntries(log.map(x=>[x.key,x.file]))));
 const imageAssets=log.filter(a=>/\.(png|jpe?g|webp)$/i.test(a.file));
 const tiles=await Promise.all(imageAssets.map(async(a,i)=>({input:await sharp(path.join(__dirname,'assets',a.file)).resize(300,260,{fit:'contain',background:require(path.join(root,'tools/lib/loom')).정본().색.Paper}).png().toBuffer(),left:i%4*310,top:Math.floor(i/4)*270})));
 await sharp({create:{width:1240,height:Math.ceil(imageAssets.length/4)*270,channels:3,background:require(path.join(root,'tools/lib/loom')).정본().색.Oat}}).composite(tiles).png().toFile(path.join(__dirname,'_검토/자산실물.png'));
 console.log(JSON.stringify({assets:log.length,sources:sources.length,publicDir}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
