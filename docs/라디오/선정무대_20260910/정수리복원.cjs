'use strict';
// User-approved existing-fur clone only. No generative image service or whole-image retouch.
const fs=require('fs'),path=require('path'),sharp=require('sharp'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'정수리수정');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const specs=[
 {name:'라디오',file:'docs/라디오/선정무대_20260910/라이브13/leaf-base-48823c235151.webp',cx:417,cy:215,rx:10,ry:13,dx:24,dy:0,ext:'png'},
 {name:'원본',file:'docs/Loom_자산/옷/GPT/까몽_3개월출석잎망토.png',cx:924,cy:282,rx:27,ry:35,dx:65,dy:0,ext:'png'},
];
(async()=>{
 const priorPath=path.join(out,'복원검증.json');
 if(fs.existsSync(priorPath)){
  const prior=JSON.parse(fs.readFileSync(priorPath,'utf8')),done=prior.results?.find(x=>x.promotedTo);
  if(done){
   assert.equal(prior.results.length,2,'Both original and radio receipts are required');
   for(const s of prior.results){
    const result=s.promotedTo?path.join(root,s.promotedTo):path.join(out,s.filename),source=path.join(root,s.backup||s.file);
    for(const [file,expected]of [[result,s.sha256],[source,s.sourceSha]]){
     assert.ok(fs.existsSync(file),'Required asset missing: '+file+'; restore the verified asset, do not re-edit the promoted original.');
     assert.equal(hash(fs.readFileSync(file)),expected,'Required asset changed: '+file);
    }
   }
   console.log('Already promoted; original, backup and radio input/output verified. No re-edit.');return;
  }
 }
 fs.mkdirSync(out,{recursive:true});const results=[];
 for(const s of specs){
  const input=fs.readFileSync(path.join(root,s.file));
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const next=Buffer.from(data);let changed=0,alphaChanged=0,outsideChanged=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const r=Math.hypot((x-s.cx)/s.rx,(y-s.cy)/s.ry);if(r>=1)continue;
   const a=r<.64?1:(1-Math.cos(Math.PI*(1-r)/.36))/2;
   const i=(y*info.width+x)*4,j=((y+s.dy)*info.width+x+s.dx)*4;
   assert.equal(data[i+3],255,'Repair must remain inside opaque fur');assert.equal(data[j+3],255);
   for(let c=0;c<3;c++)next[i+c]=Math.round(data[i+c]*(1-a)+data[j+c]*a);
  }
  const pipeline=sharp(next,{raw:{width:info.width,height:info.height,channels:4}});
  const encoded=await (s.name==='원본'?pipeline.removeAlpha():pipeline).png(s.name==='원본'?{compressionLevel:9,adaptiveFiltering:true}:{}).toBuffer();
  const decoded=await sharp(encoded).ensureAlpha().raw().toBuffer();
  assert.equal(Buffer.compare(next,decoded),0,'Lossless RGBA round-trip');
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const i=(y*info.width+x)*4;
   if(data[i+3]!==decoded[i+3])alphaChanged++;
   if(data.subarray(i,i+4).equals(decoded.subarray(i,i+4)))continue;
   changed++;if(Math.hypot((x-s.cx)/s.rx,(y-s.cy)/s.ry)>=1)outsideChanged++;
  }
  assert.equal(alphaChanged,0);assert.equal(outsideChanged,0);
  const filename=(s.name==='라디오'?'leaf-base-':'leaf-original-')+hash(encoded).slice(0,12)+'.'+s.ext;
  fs.writeFileSync(path.join(out,filename),encoded);
  const crop={left:Math.round(s.cx-s.rx*2.5),top:Math.round(s.cy-s.ry*2),width:Math.round(s.rx*5),height:Math.round(s.ry*4)};
  const before=await sharp(input).extract(crop).resize(300,300,{fit:'fill',kernel:'nearest'}).png().toBuffer();
  const after=await sharp(encoded).extract(crop).resize(300,300,{fit:'fill',kernel:'nearest'}).png().toBuffer();
  await sharp({create:{width:600,height:300,channels:3,background:'#202020'}}).composite([{input:before,left:0,top:0},{input:after,left:300,top:0}]).png().toFile(path.join(out,s.name+'-전후.png'));
  results.push({...s,sourceSha:hash(input),filename,sha256:hash(encoded),bytes:encoded.length,changedPixels:changed,outsideMaskChanged:outsideChanged,alphaChanged,losslessRoundTrip:true});
 }
 const report={at:new Date().toISOString(),method:'Local same-image fur clone, cosine feather; user explicitly approved. Left comparison=before; right=after.',results};
 fs.writeFileSync(path.join(out,'복원검증.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
