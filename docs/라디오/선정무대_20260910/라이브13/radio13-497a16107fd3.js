(function(){
'use strict';
// Display compositing only. Source artwork is immutable; expression pixels stay in actual eye support.
const edge=window.라디오가장자리;
const W=1024,H=1024,N=W*H;
const differs=(a,b,p)=>{const i=p*4;return a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3];};
function build(donors,leaf){
 const base=donors[0];
 if(donors.length!==3||[...donors,leaf].some(a=>a.length!==N*4))throw Error('Expected three approved expressions and one leaf base, 1024 RGBA');
 const support=new Uint8Array(N);
 for(let p=0;p<N;p++)for(const f of donors){
  if(f[p*4+3]!==base[p*4+3])throw Error('Donor alpha mismatch');
  if(differs(base,f,p)){const x=p%W,y=Math.floor(p/W);if(y<310||y>425||!((x>=310&&x<=420)||(x>=490&&x<=600)))throw Error('Donor expression changes outside eyes');support[p]=1;}
 }
 // Only a 2px sampling fringe around the exact, non-rectangular eye delta.
 const mask=new Uint8Array(N);
 for(let p=0;p<N;p++)if(support[p])for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  const d=Math.hypot(dx,dy);if(d>2.3)continue;const q=p+dy*W+dx;
  mask[q]=Math.max(mask[q],d<=1?255:d<2?224:128);
 }
 const leaves=donors.map(d=>{const out=new Uint8ClampedArray(leaf);for(let p=0;p<N;p++)if(mask[p]){
  if(leaf[p*4+3]!==255)throw Error('Eye transfer reaches transparent leaf pixel');
  const a=mask[p]/255;for(let c=0;c<3;c++)out[p*4+c]=Math.round(d[p*4+c]*a+leaf[p*4+c]*(1-a));
 }return out;});
 const waterRecipe=edge.만들기(base,W,H,12,{opaqueRim:true,softAlpha:true,protect:[[180,430,280,665],[620,445,716,577],[281,431,620,750]]});
 // Leaf-specific display profile: the opaque white extraction rim needs removal too.
 // Protect the cream bow; never reuse the blue outfit's broader clothing protection map.
 const leafRecipe=edge.만들기(leaves[0],W,H,12,{opaqueRim:true,softAlpha:true,protect:[[355,455,555,625]]});
 const water=donors.map(d=>edge.적용(d,waterRecipe)),field=leaves.map(d=>edge.적용(d,leafRecipe));
 for(const frames of [water,field])for(const f of frames)for(let p=0;p<N;p++){
  if(f[p*4+3]!==frames[0][p*4+3])throw Error('Output common alpha mismatch');
  if(!mask[p]&&differs(f,frames[0],p))throw Error('Expression modified fur outside eye support');
 }
 return {water,field,mask,stats:{maskPixels:mask.reduce((s,a)=>s+(a>0),0),waterEdgePixels:waterRecipe.indices.length,leafEdgePixels:leafRecipe.indices.length,expressionAlphaEqual:true,outsideEyeDifference:0}};
}


const load=async(url)=>{const im=new Image();im.src=url;await im.decode();const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(im,0,0);return context.getImageData(0,0,1024,1024).data;};
const donor="../../docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b/",leafUrl="../../docs/라디오/선정무대_20260910/라이브13/leaf-base-48823c235151.webp";
let cache;
const indices={기본:0,깜빡:1,눈웃음:2,궁금함:0,집중:0,안도:2,응원:2,기쁨:2,놀람:0};
window.라디오13={읽기:async(name)=>{
 if(!Object.hasOwn(indices,name))throw Error('Unreviewed leaf expression '+name);
 if(!cache)cache=Promise.all([...['본체','눈감음','눈웃음'].map(n=>load(donor+'여름델+전설의팻말_'+n+'.webp')),load(leafUrl)]).then(all=>{
  const result=build(all.slice(0,3),all[3]);window.라디오13.검사=result.stats;
  return result.field.map(data=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),1024,1024),0,0);return canvas.toDataURL('image/png');});
 });
 const urls=await cache,im=new Image();im.src=urls[indices[name]];await im.decode();im.dataset.originalSrc=leafUrl;im.dataset.radio13=name;return im;
}};
})();
