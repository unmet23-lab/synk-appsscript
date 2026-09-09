'use strict';
// Read-only asset verification. Only the requested QA receipt is written; never re-run a repair.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'정수리수정');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const report=JSON.parse(fs.readFileSync(path.join(out,'복원검증.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 const verified=[];
 for(const s of report.results){
  const beforePath=path.join(root,s.backup||s.file),afterPath=s.promotedTo?path.join(root,s.promotedTo):path.join(out,s.filename);
  if(!fs.existsSync(beforePath)||!fs.existsSync(afterPath))throw Error('Required original absent; follow docs/대용량자산_운영.md restore procedure. No fallback or generation.');
  const before=fs.readFileSync(beforePath),after=fs.readFileSync(afterPath);assert.equal(sha(before),s.sourceSha);assert.equal(sha(after),s.sha256);
  const a=await sharp(before).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(after).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([a.info.width,a.info.height,a.info.channels],[b.info.width,b.info.height,b.info.channels]);
  let changed=0,outside=0,alpha=0,reproducedMismatch=0;
  for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){
   const i=(y*a.info.width+x)*4,r=Math.hypot((x-s.cx)/s.rx,(y-s.cy)/s.ry);
   if(a.data[i+3]!==b.data[i+3])alpha++;
   if(!a.data.subarray(i,i+4).equals(b.data.subarray(i,i+4))){changed++;if(r>=1)outside++;}
   for(let c=0;c<3;c++){
    let expected=a.data[i+c];if(r<1){const q=((y+s.dy)*a.info.width+x+s.dx)*4,w=r<.64?1:(1-Math.cos(Math.PI*(1-r)/.36))/2;expected=Math.round(expected*(1-w)+a.data[q+c]*w);}
    if(b.data[i+c]!==expected)reproducedMismatch++;
   }
  }
  assert.equal(changed,s.changedPixels);assert.equal(outside,0);assert.equal(alpha,0);assert.equal(reproducedMismatch,0);
  verified.push({name:s.name,before:beforePath,after:afterPath,sha256:s.sha256,changedPixels:changed,outsideMaskChanged:outside,alphaChanged:alpha,reproducedMismatch});
 }
 const old=path.join(__dirname,'라이브13'),oldManifest=JSON.parse(fs.readFileSync(path.join(old,'manifest.json'),'utf8'));
 const oldHtml=fs.readFileSync(path.join(old,'after-마스코트.html'),'utf8'),html=fs.readFileSync(path.join(out,'after-마스코트.html'),'utf8');
 const helper=fs.readFileSync(path.join(out,manifest.helperName),'utf8'),oldHelper=fs.readFileSync(path.join(old,manifest.oldHelperName),'utf8');
 assert.equal(sha(html),manifest.htmlSha);assert.equal(sha(oldHtml),manifest.oldHtmlSha);assert.equal(sha(helper),manifest.helperSha);assert.equal(sha(oldHelper),manifest.oldHelperSha);
 assert.equal(html.replace(manifest.helperName,manifest.oldHelperName),oldHtml);
 const beforeUrl='../../docs/라디오/선정무대_20260910/라이브13/'+oldManifest.leafName,afterUrl='../../docs/라디오/선정무대_20260910/정수리수정/'+manifest.leafName;
 assert.equal(helper.replace(afterUrl,beforeUrl),oldHelper);new vm.Script(helper);
 for(const [,code]of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(code);
 const kernelPath=path.join(root,'영상/src/radioDreams20260910/pixels.cjs');assert.equal(sha(fs.readFileSync(kernelPath)),oldManifest.pixelKernelSha);
 const dir=path.join(root,'docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b');
 const donors=await Promise.all(['본체','눈감음','눈웃음'].map(n=>sharp(path.join(dir,'여름델+전설의팻말_'+n+'.webp')).ensureAlpha().raw().toBuffer()));
 const read=f=>sharp(f).ensureAlpha().raw().toBuffer(),kernel=require(kernelPath);
 const a=kernel.build(donors,await read(path.join(old,oldManifest.leafName))),b=kernel.build(donors,await read(path.join(out,manifest.leafName))),s=report.results.find(x=>x.name==='라디오');
 const expressionChecks=[];
 for(let f=0;f<3;f++){
  let changed=0,outside=0,alpha=0;for(let p=0;p<1024*1024;p++){
   const i=p*4;if(a.field[f][i+3]!==b.field[f][i+3])alpha++;
   if([0,1,2,3].some(c=>a.field[f][i+c]!==b.field[f][i+c])){changed++;if(Math.hypot((p%1024-s.cx)/s.rx,(Math.floor(p/1024)-s.cy)/s.ry)>=1)outside++;}
  }
  assert.equal(changed,368);assert.equal(outside,0);assert.equal(alpha,0);expressionChecks.push({frame:f,changedPixels:changed,outsideMaskChanged:outside,alphaChanged:alpha});
 }
 assert.equal(b.stats.outsideEyeDifference,0);assert.equal(b.stats.expressionAlphaEqual,true);
 const result={at:new Date().toISOString(),passed:true,verified,expressionChecks,stats:b.stats,htmlOnlyHelperUrlChanged:true,helperOnlyLeafUrlChanged:true,kernelUnchanged:true,scope:'Decoded local source/backup and all three rendered expression arrays; not a new image edit or live deployment.'};
 fs.writeFileSync(path.join(out,'재개픽셀검증.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
