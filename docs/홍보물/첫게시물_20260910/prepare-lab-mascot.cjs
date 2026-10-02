'use strict';
// Deterministic utility mask only. Approved character images remain unchanged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const dir=path.join(__dirname,'_검토/01-표정편집엔딩/몽글합성'),shared=path.resolve(__dirname,'../../../영상/public/firstposts20260910');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(p,data)=>{const q=p+'.pending';fs.writeFileSync(q,data);fs.renameSync(q,p);};
const eyes=[{x:1240,y:1140,w:640,h:580,cx:1530,cy:1453,rx:185,ry:200},{x:2230,y:1130,w:650,h:600,cx:2577,cy:1454,rx:207,ry:220}];
async function main(){
 fs.mkdirSync(dir,{recursive:true});const files={base:'mong.png',closed:'mong-closed.png',smile:'smile.png'},raw={};
 for(const [key,file] of Object.entries(files)){const result=await sharp(path.join(shared,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(result.info.width!==4096||result.info.height!==4096)throw Error('Expected approved 4096px source');raw[key]=result.data;}
 const mask=Buffer.alloc(4096*4096),maskRgba=Buffer.alloc(4096*4096*4);
 for(const e of eyes){
  const seeds=[];
  for(let y=0;y<e.h;y++)for(let x=0;x<e.w;x++){const gx=e.x+x,gy=e.y+y,k=(gy*4096+gx)*4;let dark=false;for(const key of ['closed','smile']){const p=raw[key];if(p[k+3]>240&&Math.max(p[k],p[k+1],p[k+2])<105)dark=true;}
   if(dark)seeds.push([gx,gy]);
   if(((gx-e.cx)/e.rx)**2+((gy-e.cy)/e.ry)**2<=1)mask[gy*4096+gx]=255;
  }
  // Opaque core covers the original glass eyes; a narrow thread fringe includes
  // the approved closed/smile stitches without including the space between eyes.
  for(const [x,y] of seeds)for(let dy=-16;dy<=16;dy++)for(let dx=-16;dx<=16;dx++){const d=Math.hypot(dx,dy);if(d>16)continue;const gx=x+dx,gy=y+dy;if(gx<e.x||gx>=e.x+e.w||gy<e.y||gy>=e.y+e.h)continue;const a=d<=12?255:Math.round(255*(16-d)/4),k=gy*4096+gx;if(a>mask[k])mask[k]=a;}
 }
 // Retain only components connected to the two original eye centers; unrelated
 // dark felt specks within the windows must not become moving cheek patches.
 const connected=new Uint8Array(mask.length),queue=new Int32Array(1000000);let head=0,tail=0;
 for(const e of eyes){const n=e.cy*4096+e.cx;connected[n]=1;queue[tail++]=n;}
 while(head<tail){const n=queue[head++],x=n%4096,y=Math.floor(n/4096);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,k=yy*4096+xx;if(xx<0||xx>=4096||yy<0||yy>=4096||!mask[k]||connected[k])continue;if(tail>=queue.length)throw Error('Eye union unexpectedly broad');connected[k]=1;queue[tail++]=k;}}
 let removedIslandPixels=0,nonOpaqueSourcePixels=0;for(let n=0;n<mask.length;n++){if(mask[n]&&!connected[n]){mask[n]=0;removedIslandPixels++;}if(mask[n]&&raw.base[n*4+3]!==255)nonOpaqueSourcePixels++;maskRgba[n*4]=maskRgba[n*4+1]=maskRgba[n*4+2]=255;maskRgba[n*4+3]=mask[n];}
 const options={raw:{width:4096,height:4096,channels:4}};
 write(path.join(dir,'eye-union.png'),await sharp(maskRgba,options).png().toBuffer());
 const proof={sourceFiles:Object.entries(files).map(([key,file])=>({key,file,sha256:sha(path.join(shared,file))})),eyes,mask:path.join(dir,'eye-union.png'),maskSha256:sha(path.join(dir,'eye-union.png')),method:'Mask utility only: original glass eye ellipse plus approved closed/smile dark thread contours and a small fringe; retain only the two eye-center connected components; no character RGB altered.',threshold:105,opaqueFringePixels:12,outerFringePixels:16,removedIslandPixels,nonOpaqueSourcePixels,characterDerivativesGenerated:false,humanVisualReview:false};
 write(path.join(dir,'mask-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
