// Recheck the same eye ellipses against immutable before/after screenshot evidence.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),results=[];
  for(const [label,folder,prefix,legacy]of [
   ['old-surprise','before/marin','648-touch-surprise',true],
   ['svg-success','mask-only/marin','648x980-success',false]
  ]){
   const result=await page.evaluate(async({compare,portrait,legacy})=>{
    const load=async b64=>{const i=new Image();i.src='data:image/png;base64,'+b64;await i.decode();return i;};
    const image=await load(compare),p=await load(portrait),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const size=Math.min(p.width,p.height),padX=(p.width-size)/2,padY=(p.height-size)/2;
    const crop=legacy?{x:Math.floor(.204*p.width),y:Math.floor(.28*p.height),w:Math.ceil(.592*p.width),h:Math.ceil(.38*p.height)}:{x:Math.floor(padX+.204*size),y:Math.floor(padY+.28*size),w:Math.ceil(.592*size),h:Math.ceil(.38*size)};
    let inside={max:0},outside={max:0};
    for(let y=35;y<165;y++)for(let x=0;x<290;x++){
     const sx=crop.x+(x+.5)/290*crop.w,sy=crop.y+(y-35+.5)/130*crop.h;
     const inEllipse=[.334,.666].some(cx=>((sx-(padX+cx*size))/(.13*size))**2+((sy-(padY+.47*size))/(.19*size))**2<=1);
     const inRectangle=[.334,.666].some(cx=>Math.floor(sx)>=Math.floor(padX+(cx-.13)*size)&&Math.floor(sx)<Math.floor(padX+(cx-.13)*size)+Math.ceil(.26*size)&&Math.floor(sy)>=Math.floor(padY+.28*size)&&Math.floor(sy)<Math.floor(padY+.28*size)+Math.ceil(.38*size));
     if(!inEllipse&&!inRectangle)continue;
     const bucket=inEllipse?inside:outside,actual=[],reference=[];let max=0;
     for(let c=0;c<3;c++){actual.push(pixels[(y*600+x)*4+c]);reference.push(pixels[(y*600+x+310)*4+c]);max=Math.max(max,Math.abs(actual[c]-reference[c]));}
     if(max>bucket.max)Object.assign(bucket,{max,portraitPoint:[Number(sx.toFixed(2)),Number(sy.toFixed(2))],spritePoint:[Number(((sx-padX)/size*480).toFixed(2)),Number(((sy-padY)/size*480).toFixed(2))],actualRGB:actual,referenceRGB:reference,comparePoint:[x,y]});
    }
    const marked=outside.max?outside:inside;if(marked.comparePoint){ctx.strokeStyle='#00ffff';ctx.lineWidth=2;for(const offset of [0,310]){const [x,y]=marked.comparePoint;ctx.strokeRect(x+offset-6,y-6,13,13);}}
    return {portraitSize:[p.width,p.height],eyeEllipse:{centers:[.334,.666],y:.47,radiusX:.13,radiusY:.19},inside,outside,marked:canvas.toDataURL('image/png').split(',')[1]};
   },{compare:fs.readFileSync(path.join(__dirname,folder,prefix+'-eyes-compare.png')).toString('base64'),portrait:fs.readFileSync(path.join(__dirname,folder,prefix+'-portrait.png')).toString('base64'),legacy});
   fs.writeFileSync(path.join(__dirname,'mask-only',label+'-difference-location.png'),Buffer.from(result.marked,'base64'));delete result.marked;results.push({label,...result});
  }
  const proof={oldClippedLensStillDetected:results[0].inside.max>100,currentEyePixelsExact:results[1].inside.max===0,results};
  fs.writeFileSync(path.join(__dirname,'mask-only/eye-roi-regression.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
  if(!proof.oldClippedLensStillDetected||!proof.currentEyePixelsExact)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
