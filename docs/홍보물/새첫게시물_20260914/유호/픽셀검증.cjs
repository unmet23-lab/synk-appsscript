'use strict';
// Independently decodes the two exported PNGs, not the renderer's audit object.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
  const a=fs.readFileSync(path.join(__dirname,'실물/몽글-공통바탕.png')),b=fs.readFileSync(path.join(__dirname,'실물/몽글-눈영역합성.png'));
  const scene=JSON.parse(fs.readFileSync(path.join(ROOT,'experiences/loom-living/scene.json'),'utf8'));
  const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
  const result=await page.evaluate(async({a,b,masks})=>{
    const decode=async data=>{const im=new Image();im.src=data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);return {width:c.width,height:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};};
    const A=await decode(a),B=await decode(b);if(A.width!==B.width||A.height!==B.height)throw new Error('Dimensions differ');
    const ratio=A.width/1024;let changedPixels=0,alphaChanges=0,outsideStrictEllipse=0,outsideWithBoundaryAllowance=0;let minX=A.width,minY=A.height,maxX=-1,maxY=-1;
    for(let y=0;y<A.height;y++)for(let x=0;x<A.width;x++){const i=(y*A.width+x)*4;const changed=[0,1,2,3].some(k=>A.data[i+k]!==B.data[i+k]);if(A.data[i+3]!==B.data[i+3])alphaChanges++;if(!changed)continue;changedPixels++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      const within=allowance=>masks.some(({target:[ex,ey,ew,eh]})=>((x/ratio-ex-ew/2)/(ew/2+allowance))**2+((y/ratio-ey-eh/2)/(eh/2+allowance))**2<=1);
      if(!within(0))outsideStrictEllipse++;if(!within(2))outsideWithBoundaryAllowance++;
    }
    return {width:A.width,height:A.height,changedPixels,alphaChanges,outsideStrictEllipse,outsideWithBoundaryAllowance,changedBoundingBox:{minX,minY,maxX,maxY},boundaryAllowance:{referenceCoordinateSpace:1024,referenceRadiusAllowance:2,exportPixelRadiusAllowance:2*ratio}};
  },{a:`data:image/png;base64,${a.toString('base64')}`,b:`data:image/png;base64,${b.toString('base64')}`,masks:scene.character.masks});
  await browser.close();
  const report={observedAt:new Date().toISOString(),method:'Independent browser PNG decode and RGBA comparison of current exported common body and exact in-memory eye composite',notEvidenceOf:'Final rendered scene identity, full 4K source identity, visual perfection, comfort or user outcome',sources:[{path:'실물/몽글-공통바탕.png',sha256:hash(a)},{path:'실물/몽글-눈영역합성.png',sha256:hash(b)},{path:'experiences/loom-living/scene.json',sha256:hash(fs.readFileSync(path.join(ROOT,'experiences/loom-living/scene.json')))}],...result};
  report.passed=result.alphaChanges===0&&result.outsideWithBoundaryAllowance===0&&result.changedPixels>0;
  fs.writeFileSync(path.join(__dirname,'실물/픽셀대조.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
