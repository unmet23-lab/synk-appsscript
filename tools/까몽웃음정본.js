// Assemble ImageGen eye edits on the unchanged canonical body; no model/API calls.
// The filename is retained for existing callers; smile, retry and surprise share this pipeline.
// node tools/까몽웃음정본.js [--apply]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/캐릭터/표정교정_20261011'),canon=path.join(root,'docs/캐릭터/정본_4K');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const eyes=[{cx:1470,cy:1474,sx:450,sy:456},{cx:2184,cy:1478,sx:661,sy:456}];
const radius={x:153,y:158},edge=10,patchSize=328;
const expressions=[
 {name:'으쓱',source:'스티치눈웃음',samples:eyes.map(({sx,sy})=>({sx,sy})),sampleSize:124},
 {name:'눈웃음',source:'스티치눈웃음',samples:eyes.map(({sx,sy})=>({sx,sy})),sampleSize:124},
 {name:'민망',source:'스티치민망',samples:[{sx:452,sy:456},{sx:662,sy:457}],sampleSize:124},
 {name:'놀람',source:'차분한놀람',samples:[{sx:450,sy:450},{sx:666,sy:452}],sampleSize:108},
];
(async()=>{
 const baseFile=path.join(canon,'까몽_본체.png'),{data:base,info}=await sharp(baseFile).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==4096||info.height!==4096)throw Error('Canonical body must be 4096 square');
 const mask=Buffer.alloc(info.width*info.height),report={date:'2026-10-11',method:'Built-in ImageGen eye artwork: stitched smile/retry and subdued round surprise; aligned eye sockets on original body; no other facial features copied',base:path.relative(root,baseFile),baseSha256:sha(baseFile),eyes,radius,edge,files:[]};
 const smallBase=await sharp(base,{raw:{width:4096,height:4096,channels:4}}).resize(480,480).raw().toBuffer();
 for(const eye of eyes)for(let y=eye.cy-radius.y;y<=eye.cy+radius.y;y++)for(let x=eye.cx-radius.x;x<=eye.cx+radius.x;x++){
  const d=Math.hypot((x-eye.cx)/radius.x,(y-eye.cy)/radius.y);if(d>=1)continue;
  mask[y*info.width+x]=Math.round(255*Math.min(1,(1-d)*Math.min(radius.x,radius.y)/edge));
 }
 await sharp(mask,{raw:{width:4096,height:4096,channels:1}}).png().toFile(path.join(dir,'눈윤곽_마스크.png'));
 for(const {name,source:sourceName,samples,sampleSize} of expressions){
  const source=path.join(dir,`까몽_${sourceName}_생성원본.png`),out=Buffer.from(base);
  for(const [eyeIndex,eye] of eyes.entries()){
   const {sx,sy}=samples[eyeIndex];
   const patch=await sharp(source).extract({left:sx-sampleSize/2,top:sy-sampleSize/2,width:sampleSize,height:sampleSize}).resize(patchSize,patchSize).ensureAlpha().raw().toBuffer();
   for(let y=eye.cy-radius.y;y<=eye.cy+radius.y;y++)for(let x=eye.cx-radius.x;x<=eye.cx+radius.x;x++){
    const a=mask[y*4096+x]/255;if(!a)continue;const index=(y*4096+x)*4,pi=((y-eye.cy+patchSize/2)*patchSize+x-eye.cx+patchSize/2)*4;
    for(let c=0;c<3;c++)out[index+c]=Math.round(base[index+c]*(1-a)+patch[pi+c]*a);
   }
  }
  let changed=0,outside=0,alphaChanged=0;
  for(let i=0;i<mask.length;i++){const p=i*4,diff=out[p]!==base[p]||out[p+1]!==base[p+1]||out[p+2]!==base[p+2]||out[p+3]!==base[p+3];if(diff){changed++;if(!mask[i])outside++;}if(out[p+3]!==base[p+3])alphaChanged++;}
  if(outside||alphaChanged)throw Error('Body/alpha invariant failed');
  const candidate=path.join(dir,`까몽_${name}_4K.png`);await sharp(out,{raw:{width:4096,height:4096,channels:4}}).png().toFile(candidate);
  // Lossless 480px QA distinguishes resampling from lossy runtime WebP.
  await sharp(out,{raw:{width:4096,height:4096,channels:4}}).resize(480,480).png().toFile(path.join(dir,`까몽_${name}_480.png`));
  const small=await sharp(out,{raw:{width:4096,height:4096,channels:4}}).resize(480,480).raw().toBuffer();let smallOutside=0,smallAlpha=0;
  for(let y=0;y<480;y++)for(let x=0;x<480;x++){const p=(y*480+x)*4,allowed=eyes.some(e=>Math.hypot((x-e.cx*480/4096)/(radius.x*480/4096+3),(y-e.cy*480/4096)/(radius.y*480/4096+3))<=1);if(!allowed&&[0,1,2,3].some(c=>small[p+c]!==smallBase[p+c]))smallOutside++;if(small[p+3]!==smallBase[p+3])smallAlpha++;}
  if(smallOutside||smallAlpha)throw Error('480px body/alpha invariant failed');
  report.files.push({expression:name,source:path.relative(root,source),sourceSha256:sha(source),samples,sampleSize,output:path.relative(root,candidate),sha256:sha(candidate),changedPixels:changed,outsideMaskRGBAChanges:outside,alphaChanges:alphaChanged,lossless480:{outsideMaskRGBAChanges:smallOutside,alphaChanges:smallAlpha,resizeBoundaryPixels:3}});
  if(process.argv.includes('--apply')){
   const target=path.join(canon,`까몽_${name}.png`),backup=path.join(dir,`이전_까몽_${name}.png`);if(!fs.existsSync(backup))fs.copyFileSync(target,backup);fs.copyFileSync(candidate,target);
   const screenDir=path.join(root,'docs/캐릭터/화면_1024'),screen=path.join(screenDir,`까몽_${name}.webp`);await sharp(candidate).resize(1024,1024).webp({quality:92,effort:6}).toFile(screen);
   const indexFile=path.join(screenDir,'판.json'),index=JSON.parse(fs.readFileSync(indexFile,'utf8'));index.언제=new Date().toISOString();index.컷[`까몽_${name}`]={원본:`까몽_${name}.png`,크기:1024,머리맞춤:{배:1,dx:0,dy:0},몸겹침되밈:null,눈만얹음_칸:changed,원본SHA256:sha(candidate),파생SHA256:sha(screen),생성기:'tools/까몽웃음정본.js'};fs.writeFileSync(indexFile,JSON.stringify(index,null,2)+'\n');
  }
 }
 report.applied=process.argv.includes('--apply');fs.writeFileSync(path.join(dir,'정본.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
