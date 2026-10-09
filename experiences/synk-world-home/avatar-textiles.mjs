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
      const diagonal=((ix+iy)%4)<2,twist=Math.cos((x+y)*Math.PI/8)*4;
      const h=kind==='denim'?109+34*(diagonal?warp:weft)+6*(diagonal?weft:warp)+twist+grain(x,y)*2:112+29*(over?warp:weft)+8*(over?weft:warp)+grain(x,y)*2;
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

const wardSeed=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function wardCanvas(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function wardTexture(image,name,srgb=false){const t=new THREE.CanvasTexture(image);t.name=name;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;return t;}

function makeWardrobeTextile(kind,size=512){
  const canvas=wardCanvas,texture=wardTexture,seeded=wardSeed;
  size=size>=1024?1024:512;
  const scale=size/512,heightCanvas=canvas(size),ctx=heightCanvas.getContext('2d'),random=seeded(6181);
  if(kind==='knit-detail'){
    ctx.fillStyle='#656565';ctx.fillRect(0,0,size,size);ctx.lineCap='round';const w=size/14,h=size/20;
    for(let j=-1;j<=20;j++)for(let i=-1;i<=14;i++){
      const x=i*w,y=j*h;
      for(const [width,tone]of [[9.8,'#777777'],[7.3,'#989898'],[4.9,'#b5b5b5'],[2.2,'#bdbdbd']])for(const side of [-1,1]){
        ctx.strokeStyle=tone;ctx.lineWidth=width*scale;ctx.beginPath();ctx.moveTo(x+w*.5+side*w*.35,y-h*.08);ctx.bezierCurveTo(x+w*.5+side*w*.36,y+h*.16,x+w*.5+side*w*.15,y+h*.70,x+w*.5+side*scale,y+h*.96);ctx.stroke();
      }
      // Fine twist follows each yarn leg; never broad colour noise or large pits.
      ctx.lineWidth=.65*scale;ctx.strokeStyle='rgba(155,155,155,.42)';for(let k=0;k<5;k++)for(const side of [-1,1]){const v=(k+.6)/5,xx=x+w*.5+side*w*(.32-.29*v);ctx.beginPath();ctx.moveTo(xx-2*scale,y+v*h);ctx.lineTo(xx+2*scale,y+(v+.08)*h);ctx.stroke();}
    }
  }else{
    const pixels=ctx.createImageData(size,size),cell=kind==='silk-detail'?6*scale:kind==='denim-detail'?7*scale:9*scale;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const ix=Math.floor(x/cell),iy=Math.floor(y/cell),a=(x%cell)/cell,b=(y%cell)/cell;
      const warp=Math.pow(Math.sin(Math.PI*a),1.35),weft=Math.pow(Math.sin(Math.PI*b),1.35),twill=(ix+iy)%4<3,over=kind==='denim-detail'||kind==='silk-detail'?twill:(ix+iy)%2===0;
      const twist=Math.sin((x+y)/(2.6*scale))*.8,shade=108+37*(over?warp:weft)+6*(over?weft:warp)+twist,p=(y*size+x)*4;
      pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=shade;pixels.data[p+3]=255;
    }ctx.putImageData(pixels,0,0);
  }
  // Sparse short fibres carry direction, rather than the photograph's lighting.
  ctx.lineWidth=.4*scale;ctx.lineCap='round';for(let i=0;i<(kind==='silk-detail'?2300:6200);i++){const x=random()*size,y=random()*size,len=(1+random()*4)*scale,a=kind==='denim-detail'?-.75:kind==='knit-detail'?1.15:random()*Math.PI;ctx.strokeStyle=random()>.5?'rgba(170,170,170,.14)':'rgba(85,85,85,.12)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);ctx.stroke();}
  const source=ctx.getImageData(0,0,size,size).data,albedo=canvas(size),normal=canvas(size),packed=canvas(size),ac=albedo.getContext('2d'),nc=normal.getContext('2d'),pc=packed.getContext('2d'),a=ac.createImageData(size,size),n=nc.createImageData(size,size),p=pc.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,h=source[i]/255,dx=(source[(y*size+(x+1)%size)*4]-source[(y*size+(x+size-1)%size)*4])/255,dy=(source[(((y+1)%size)*size+x)*4]-source[(((y+size-1)%size)*size+x)*4])/255;
    const strength=(kind==='knit-detail'?3.0:2.2)*scale,nx=-dx*strength,ny=dy*strength,l=1/Math.hypot(nx,ny,1),tone=kind==='denim-detail'?231+(h-.5)*35:242+(h-.5)*18;
    a.data[i]=a.data[i+1]=a.data[i+2]=clamp(tone,221,251);a.data[i+3]=255;n.data[i]=(nx*l*.5+.5)*255;n.data[i+1]=(ny*l*.5+.5)*255;n.data[i+2]=(l*.5+.5)*255;n.data[i+3]=255;
    p.data[i]=kind==='knit-detail'?clamp(201+h*67,222,253):clamp(231+h*28,240,254);p.data[i+1]=kind==='wax-detail'?210+(h-.5)*14:kind==='silk-detail'?224+(h-.5)*15:244+(h-.5)*10;p.data[i+2]=0;p.data[i+3]=255;
  }
  ac.putImageData(a,0,0);nc.putImageData(n,0,0);pc.putImageData(p,0,0);const properties=texture(packed,`${kind}-AO-R-roughness-G`);
  return {map:texture(albedo,`${kind}-yarn-colour`,true),normalMap:texture(normal,`${kind}-yarn-normal`),roughnessMap:properties,aoMap:properties};
}

export function createAvatarTextiles({anisotropy=4,detailSize=512}={}){
  const textures=[],sets={};
  for(const kind of ['wool','knit','cotton']){sets[kind]=make(kind);for(const texture of new Set(Object.values(sets[kind]))){texture.anisotropy=anisotropy;textures.push(texture);}}
  function fabric(kind,repeat){
    if(!sets[kind]){sets[kind]=kind.endsWith('-detail')?makeWardrobeTextile(kind,detailSize):make(kind);for(const texture of new Set(Object.values(sets[kind]))){texture.anisotropy=anisotropy;textures.push(texture);}}
    const result={},clones=new Map();
    for(const [key,texture] of Object.entries(sets[kind])){if(!clones.has(texture)){const clone=texture.clone();clone.repeat.set(...repeat);clone.needsUpdate=true;textures.push(clone);clones.set(texture,clone);}result[key]=clones.get(texture);}
    return result;
  }
  return {fabric,textures};
}
