'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'정수리수정'),old=path.join(__dirname,'라이브13');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const report=JSON.parse(fs.readFileSync(path.join(out,'복원검증.json'),'utf8')),leaf=report.results.find(x=>x.name==='라디오');
 const oldManifest=require('./라이브13/manifest.json');
 assert.equal(sha(fs.readFileSync(path.join(out,leaf.filename))),leaf.sha256,'Corrected leaf changed');
 assert.equal(sha(fs.readFileSync(path.join(root,'영상/src/radioDreams20260910/pixels.cjs'))),oldManifest.pixelKernelSha,'Expression kernel changed');
 const oldHtml=fs.readFileSync(path.join(old,'after-마스코트.html'),'utf8');
 assert.equal(sha(oldHtml),'ff2fa6fd46b7d5dc2bcb92a8854e04891f9a0520d37cf5dff1fabf0569294450');
 const oldHelper=fs.readFileSync(path.join(old,oldManifest.helperName),'utf8');
 assert.equal(sha(oldHelper),oldManifest.helperSha);
 const oldUrl='../../docs/라디오/선정무대_20260910/라이브13/'+oldManifest.leafName;
 const newUrl='../../docs/라디오/선정무대_20260910/정수리수정/'+leaf.filename;
 assert.equal(oldHelper.split(oldUrl).length,2);
 const helper=oldHelper.replace(oldUrl,newUrl);new vm.Script(helper);
 const helperName='radio13-'+sha(helper).slice(0,12)+'.js';
 assert.equal(oldHtml.split(oldManifest.helperName).length,2,'Unique helper reference required');
 const html=oldHtml.replace(oldManifest.helperName,helperName);
 assert.equal(html.replace(helperName,oldManifest.helperName),oldHtml);
 for(const [,code]of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(code);
 const folder=path.join(root,'docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b');
 const donors=await Promise.all(['본체','눈감음','눈웃음'].map(n=>sharp(path.join(folder,'여름델+전설의팻말_'+n+'.webp')).ensureAlpha().raw().toBuffer()));
 const raw=await sharp(path.join(out,leaf.filename)).ensureAlpha().raw().toBuffer();
 const oldRaw=await sharp(path.join(old,oldManifest.leafName)).ensureAlpha().raw().toBuffer();
 const {build}=require(path.join(root,'영상/src/radioDreams20260910/pixels.cjs'));
 const before=build(donors,oldRaw),after=build(donors,raw);let changed=[],outside=[],alpha=[];
 for(let f=0;f<3;f++){
  let n=0,o=0,a=0;for(let p=0;p<1024*1024;p++){
   const i=p*4,x=p%1024,y=Math.floor(p/1024);
   if(before.field[f][i+3]!==after.field[f][i+3])a++;
   if([0,1,2,3].some(c=>before.field[f][i+c]!==after.field[f][i+c])){n++;if(Math.hypot((x-leaf.cx)/leaf.rx,(y-leaf.cy)/leaf.ry)>=1)o++;}
  }
  changed.push(n);outside.push(o);alpha.push(a);assert.equal(o,0);assert.equal(a,0);
 }
 // Validate every input and all expression deltas before replacing prepared artifacts.
 fs.writeFileSync(path.join(out,helperName),helper);fs.writeFileSync(path.join(out,'after-마스코트.html'),html);
 // Full cutout proof, no background image regeneration.
 await sharp(Buffer.from(after.field[0]),{raw:{width:1024,height:1024,channels:4}}).resize(720,720).png().toFile(path.join(out,'수정캐릭터.png'));
 const manifest={at:new Date().toISOString(),oldHtmlSha:sha(oldHtml),oldHelperName:oldManifest.helperName,oldHelperSha:sha(oldHelper),htmlSha:sha(html),helperName,helperSha:sha(helper),leafName:leaf.filename,leafSha:leaf.sha256,source:leaf.file,pixelKernelUnchanged:true,geometryUnchanged:true,expressions:after.stats,changedPerExpression:changed,outsidePatchChangedPerExpression:outside,alphaChangedPerExpression:alpha,scope:'Only leaf URL and script URL changed; all scene geometry, background, music and expression kernel unchanged.'};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
