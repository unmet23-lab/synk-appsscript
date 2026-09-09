'use strict';
// Display compositing only. Source artwork is immutable; expression pixels stay in actual eye support.
const edge=require('../../../bots/오버레이/라디오가장자리.js');
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
module.exports={build,W,H};
