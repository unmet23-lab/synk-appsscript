import * as THREE from './scene-assets/three.module.js';

// Deterministic surface descriptions, not colour photos reused as displacement.
// Height, reflectance and colour are separate so tiny fibres never become orange-peel relief.
const size=512,random=seed=>()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function canvas(){const image=document.createElement('canvas');image.width=image.height=size;return image;}
function map(image,name,color=false){const texture=new THREE.CanvasTexture(image);texture.name=name;texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;}
function grain(x,y){return Math.sin(x*.193+Math.sin(y*.151))*Math.sin(y*.167+x*.097);}
function make(kind){
  const relief=canvas(),ctx=relief.getContext('2d'),rand=random(kind==='wool'?1807:kind==='knit'?2901:811);
  ctx.fillStyle='#808080';ctx.fillRect(0,0,size,size);
  if(kind==='wool'){
    // Many very short, crossing fibres; no hard spots or broad clumped bumps.
    ctx.lineCap='round';
    for(let i=0;i<23500;i++){
      const x=rand()*size,y=rand()*size,a=rand()*Math.PI*2,len=2.5+rand()*10;
      ctx.strokeStyle=rand()>.35?'rgba(176,176,176,.27)':'rgba(86,86,86,.20)';ctx.lineWidth=.42+rand()*.65;
      for(const ox of [-size,0,size])for(const oy of [-size,0,size]){
        const dx=Math.cos(a)*len,dy=Math.sin(a)*len;
        if(x+ox+Math.abs(dx)<0||x+ox-Math.abs(dx)>size||y+oy+Math.abs(dy)<0||y+oy-Math.abs(dy)>size)continue;
        ctx.beginPath();ctx.moveTo(x+ox,y+oy);ctx.quadraticCurveTo(x+ox+dx*.5-dy*.13,y+oy+dy*.5+dx*.13,x+ox+dx,y+oy+dy);ctx.stroke();
      }
    }
  }else if(kind==='knit'){
    // 12 x 16 stockinette loops. Yarn is rounded, with soft valleys and a fine twist.
    const w=size/12,h=size/16;ctx.fillStyle='#636363';ctx.fillRect(0,0,size,size);ctx.lineCap='round';
    for(let row=-1;row<=16;row++)for(let col=-1;col<=12;col++){
      const x=col*w,y=row*h;
      for(const [line,color] of [[10,'#747474'],[7.5,'#a1a1a1'],[4.5,'#b4b4b4'],[1.5,'#bcbcbc']]){
        ctx.lineWidth=line;ctx.strokeStyle=color;
        for(const side of [-1,1]){
          ctx.beginPath();ctx.moveTo(x+w*.5+side*w*.34,y-h*.05);
          ctx.bezierCurveTo(x+w*.5+side*w*.39,y+h*.24,x+w*.5+side*w*.17,y+h*.72,x+w*.5+side*1.4,y+h*.96);ctx.stroke();
        }
      }
    }
  }else{
    // Plain cotton weave: alternating warp/weft crossings, deliberately finer than the knit.
    const pixels=ctx.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const ix=Math.floor(x/8),iy=Math.floor(y/8),over=(ix+iy)%2===0;
      const warp=Math.pow(Math.max(0,Math.cos((x%8-3.5)/8*Math.PI)),2),weft=Math.pow(Math.max(0,Math.cos((y%8-3.5)/8*Math.PI)),2);
      const h=112+29*(over?warp:weft)+8*(over?weft:warp)+grain(x,y)*2;
      const p=(y*size+x)*4;pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=h;pixels.data[p+3]=255;
    }
    ctx.putImageData(pixels,0,0);
  }
  const source=ctx.getImageData(0,0,size,size).data,height=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)height[y*size+x]=source[(y*size+x)*4]/255;
  const albedo=canvas(),normal=canvas(),packed=canvas();
  const ac=albedo.getContext('2d'),nc=normal.getContext('2d'),pc=packed.getContext('2d');
  const a=ac.createImageData(size,size),n=nc.createImageData(size,size),pbr=pc.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const at=y*size+x,p=at*4,h=height[at];
    const dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size];
    const dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
    const strength=kind==='wool'?1.7:kind==='knit'?3.0:2.1;
    // Canvas rows point down while the uploaded texture's V coordinate points up.
    const nx=-dx*strength,ny=dy*strength,inv=1/Math.hypot(nx,ny,1);
    n.data[p]=(nx*inv*.5+.5)*255;n.data[p+1]=(ny*inv*.5+.5)*255;n.data[p+2]=(inv*.5+.5)*255;n.data[p+3]=255;
    // Micro-reflectance variation is weak in colour; the normal map carries the fibre shape.
    const tone=kind==='wool'?235+(h-.5)*85+grain(x/7,y/7)*3:kind==='knit'?237+(h-.5)*40+grain(x,y)*1.5:239+(h-.5)*22;
    a.data[p]=a.data[p+1]=a.data[p+2]=clamp(tone,224,253);a.data[p+3]=255;
    const rough=kind==='wool'?247-(h-.5)*7:kind==='knit'?241-(h-.5)*12:248-(h-.5)*6;
    const shadow=kind==='knit'?clamp(218+h*48,228,255):kind==='cotton'?clamp(243+h*12,244,255):255;
    pbr.data[p]=shadow;pbr.data[p+1]=rough;pbr.data[p+2]=0;pbr.data[p+3]=255;
  }
  ac.putImageData(a,0,0);nc.putImageData(n,0,0);pc.putImageData(pbr,0,0);
  const properties=map(packed,`${kind}-occlusion-R-roughness-G`);
  return {map:map(albedo,`${kind}-low-contrast-colour`,true),normalMap:map(normal,`${kind}-micro-normal`),roughnessMap:properties,aoMap:properties};
}

export function createAvatarTextiles({anisotropy=4}={}){
  const textures=[],sets={};
  for(const kind of ['wool','knit','cotton']){sets[kind]=make(kind);for(const texture of new Set(Object.values(sets[kind]))){texture.anisotropy=anisotropy;textures.push(texture);}}
  function fabric(kind,repeat){
    const result={},clones=new Map();
    for(const [key,texture] of Object.entries(sets[kind])){if(!clones.has(texture)){const clone=texture.clone();clone.repeat.set(...repeat);clone.needsUpdate=true;textures.push(clone);clones.set(texture,clone);}result[key]=clones.get(texture);}
    return result;
  }
  return {fabric,textures};
}
