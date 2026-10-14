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

const wardrobeProfiles={
  'cotton-detail':{roughness:.96,normalScale:.34,sheen:.36,sheenRoughness:.86,anisotropy:.12,aoMapIntensity:.52,clearcoat:0,clearcoatRoughness:.9},
  'denim-detail':{roughness:.94,normalScale:.39,sheen:.28,sheenRoughness:.8,anisotropy:.32,aoMapIntensity:.57,clearcoat:0,clearcoatRoughness:.9},
  'knit-detail':{roughness:.98,normalScale:.32,sheen:.78,sheenRoughness:.94,anisotropy:0,aoMapIntensity:.66,clearcoat:0,clearcoatRoughness:.9},
  'linen-detail':{roughness:.98,normalScale:.42,sheen:.44,sheenRoughness:.9,anisotropy:.2,aoMapIntensity:.59,clearcoat:0,clearcoatRoughness:.9},
  'corduroy-detail':{roughness:.96,normalScale:.48,sheen:.72,sheenRoughness:.82,anisotropy:.38,aoMapIntensity:.68,clearcoat:0,clearcoatRoughness:.9},
  'quilted-detail':{roughness:.92,normalScale:.46,sheen:.26,sheenRoughness:.84,anisotropy:0,aoMapIntensity:.75,clearcoat:0,clearcoatRoughness:.9},
  'velvet-detail':{roughness:.86,normalScale:.16,sheen:1,sheenRoughness:.62,anisotropy:.48,aoMapIntensity:.32,clearcoat:0,clearcoatRoughness:.9},
  'silk-detail':{roughness:.5,normalScale:.17,sheen:.3,sheenRoughness:.46,anisotropy:.76,aoMapIntensity:.22,clearcoat:0,clearcoatRoughness:.9},
  'wool-felt-detail':{roughness:.99,normalScale:.27,sheen:.82,sheenRoughness:.96,anisotropy:0,aoMapIntensity:.44,clearcoat:0,clearcoatRoughness:.9},
  'wax-detail':{roughness:.68,normalScale:.22,sheen:.16,sheenRoughness:.78,anisotropy:.08,aoMapIntensity:.35,clearcoat:.36,clearcoatRoughness:.23},
};
const wardrobeAliases=Object.fromEntries(['linen','corduroy','quilted','velvet','silk','wool-felt'].map(kind=>[kind,`${kind}-detail`]));
const wardrobeKind=kind=>wardrobeAliases[kind]||kind;
/** Detached numerical defaults. The caller converts normalScale to its own Vector2. */
export function wardrobeFabricProfile(kind){return {...(wardrobeProfiles[wardrobeKind(kind)]||wardrobeProfiles[`${kind}-detail`]||wardrobeProfiles['cotton-detail'])};}
const TAU=Math.PI*2,fract=value=>value-Math.floor(value);
function weaveHeight(kind,u,v){
  if(kind==='corduroy-detail'){
    const ridge=Math.pow(.5+.5*Math.cos(TAU*u*18),.7);
    return 91+91*ridge+2.5*Math.sin(TAU*v*128)*ridge;
  }
  if(kind==='quilted-detail'){
    // The garment owns its padded panels and seam grooves; this is only the fine shell weave.
    const x=u*96,y=v*96,warp=Math.pow(Math.sin(Math.PI*fract(x)),1.6),weft=Math.pow(Math.sin(Math.PI*fract(y)),1.6),over=(Math.floor(x)+Math.floor(y))%2===0;
    return 126+18*(over?warp:weft)+4*(over?weft:warp)+Math.sin(TAU*u*192)*Math.sin(TAU*v*192)*.55;
  }
  if(kind==='velvet-detail')return 129+5*Math.sin(TAU*u*64)*Math.sin(TAU*v*96)+3*Math.sin(TAU*v*4);
  if(kind==='wool-felt-detail')return 132+6*Math.sin(TAU*(u*31+v*17))*Math.sin(TAU*(u*13-v*29));
  const columns=kind==='linen-detail'?32:kind==='silk-detail'?80:kind==='denim-detail'?72:64,rows=kind==='linen-detail'?40:kind==='silk-detail'?100:columns;
  const x=u*columns,y=v*rows,ix=Math.floor(x),iy=Math.floor(y),warp=Math.pow(Math.sin(Math.PI*fract(x)),1.25),weft=Math.pow(Math.sin(Math.PI*fract(y)),1.25);
  const over=kind==='silk-detail'?(ix+iy*3)%5<4:kind==='denim-detail'?(ix+iy)%4<3:(ix+iy)%2===0;
  const slub=kind==='linen-detail'?8*Math.sin(TAU*v*7+Math.sin(TAU*u*4))*Math.pow(warp,4)+6*Math.sin(TAU*u*5+Math.sin(TAU*v*3))*Math.pow(weft,4):0;
  const amplitude=kind==='silk-detail'?23:kind==='wax-detail'?26:kind==='linen-detail'?43:37;
  return 109+amplitude*(over?warp:weft)+6*(over?weft:warp)+slub+Math.sin(TAU*(u*128+v*128))*.8;
}

function reflectance(kind,h,u,v){
  const valleys=clamp((h-.32)/.35,0,1),micro=Math.sin(TAU*u*96)*Math.sin(TAU*v*128);
  if(kind==='silk-detail')return {tone:246+(h-.5)*12,rough:128+micro*13+(h-.5)*24,ao:250+valleys*4,strength:1.35};
  if(kind==='velvet-detail')return {tone:242+(h-.5)*15,rough:211+Math.sin(TAU*v*4)*7+micro*3,ao:248+valleys*6,strength:1.05};
  if(kind==='wool-felt-detail')return {tone:237+(h-.5)*38,rough:249+(h-.5)*7,ao:243+valleys*11,strength:2.05};
  if(kind==='corduroy-detail')return {tone:240+(h-.5)*25,rough:231-(h-.5)*12,ao:203+valleys*50,strength:3.3};
  if(kind==='quilted-detail')return {tone:244+(h-.5)*12,rough:229+(h-.5)*10,ao:246+valleys*8,strength:1.9};
  if(kind==='linen-detail')return {tone:238+(h-.5)*30,rough:242+(h-.5)*14,ao:226+valleys*28,strength:2.8};
  if(kind==='denim-detail')return {tone:232+(h-.5)*35,rough:217+(h-.5)*22,ao:225+valleys*29,strength:2.7};
  if(kind==='knit-detail')return {tone:239+(h-.5)*21,rough:246+(h-.5)*9,ao:201+valleys*52,strength:3};
  if(kind==='wax-detail')return {tone:246+(h-.5)*12,rough:200+(h-.5)*17,ao:246+valleys*8,strength:1.8};
  return {tone:242+(h-.5)*20,rough:237+(h-.5)*14,ao:233+valleys*21,strength:2.3};
}

function makeWardrobeTextile(kind,size=512){
  const canvas=wardCanvas,texture=wardTexture,seeded=wardSeed;
  kind=wardrobeKind(kind);size=size>=1024?1024:512;
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
    const pixels=ctx.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const shade=weaveHeight(kind,(x+.5)/size,(y+.5)/size),p=(y*size+x)*4;
      pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=shade;pixels.data[p+3]=255;
    }ctx.putImageData(pixels,0,0);
  }
  // Sparse short fibres carry direction, rather than the photograph's lighting.
  ctx.lineWidth=.4*scale;ctx.lineCap='round';
  const fibres=kind==='silk-detail'?1800:kind==='wax-detail'?2200:kind==='wool-felt-detail'?14500:kind==='velvet-detail'?9800:6200;
  for(let i=0;i<fibres;i++){
    const x=random()*size,y=random()*size,len=(1+random()*(kind==='wool-felt-detail'?6:kind==='velvet-detail'?1.6:4))*scale,a=kind==='denim-detail'?-.75:kind==='knit-detail'?1.15:kind==='corduroy-detail'||kind==='velvet-detail'?Math.PI/2:kind==='silk-detail'?0:random()*Math.PI;
    ctx.strokeStyle=random()>.5?'rgba(170,170,170,.14)':'rgba(85,85,85,.12)';const dx=Math.cos(a)*len,dy=Math.sin(a)*len;
    for(const ox of [-size,0,size])for(const oy of [-size,0,size]){if(x+ox+Math.abs(dx)<0||x+ox-Math.abs(dx)>size||y+oy+Math.abs(dy)<0||y+oy-Math.abs(dy)>size)continue;ctx.beginPath();ctx.moveTo(x+ox,y+oy);ctx.lineTo(x+ox+dx,y+oy+dy);ctx.stroke();}
  }
  const source=ctx.getImageData(0,0,size,size).data,albedo=canvas(size),normal=canvas(size),packed=canvas(size),ac=albedo.getContext('2d'),nc=normal.getContext('2d'),pc=packed.getContext('2d'),a=ac.createImageData(size,size),n=nc.createImageData(size,size),p=pc.createImageData(size,size);
  const profile=wardrobeFabricProfile(kind),directional=profile.anisotropy>0?canvas(size):null,dc=directional?.getContext('2d'),d=dc?.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,h=source[i]/255,dx=(source[(y*size+(x+1)%size)*4]-source[(y*size+(x+size-1)%size)*4])/255,dy=(source[(((y+1)%size)*size+x)*4]-source[(((y+size-1)%size)*size+x)*4])/255;
    const surface=reflectance(kind,h,(x+.5)/size,(y+.5)/size),strength=surface.strength*scale,nx=-dx*strength,ny=dy*strength,l=1/Math.hypot(nx,ny,1),tone=surface.tone;
    a.data[i]=a.data[i+1]=a.data[i+2]=clamp(tone,221,251);a.data[i+3]=255;n.data[i]=(nx*l*.5+.5)*255;n.data[i+1]=(ny*l*.5+.5)*255;n.data[i+2]=(l*.5+.5)*255;n.data[i+3]=255;
    p.data[i]=clamp(surface.ao,180,255);p.data[i+1]=clamp(surface.rough,80,254);p.data[i+2]=0;p.data[i+3]=255;
    if(d){const angle=kind==='denim-detail'?-.75:kind==='corduroy-detail'||kind==='velvet-detail'?Math.PI/2:kind==='linen-detail'?Math.sin(TAU*y/size*3)*.07:0;d.data[i]=(Math.cos(angle)*.5+.5)*255;d.data[i+1]=(Math.sin(angle)*.5+.5)*255;d.data[i+2]=kind==='velvet-detail'?225+Math.sin(TAU*x/size*4)*20:255;d.data[i+3]=255;}
  }
  ac.putImageData(a,0,0);nc.putImageData(n,0,0);pc.putImageData(p,0,0);if(d)dc.putImageData(d,0,0);const properties=texture(packed,`${kind}-AO-R-roughness-G`);
  return {map:texture(albedo,`${kind}-yarn-colour`,true),normalMap:texture(normal,`${kind}-yarn-normal`),roughnessMap:properties,aoMap:properties,...(directional?{anisotropyMap:texture(directional,`${kind}-fibre-direction-RG-strength-B`)}:{})};
}

const baseKinds=['wool','knit','cotton'],sourceImages=new Map();
function loadTextileImage(kind,role,detailSize){
  return new Promise((resolve,reject)=>{
    const image=new Image();image.decoding='async';let settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=image.onerror=null;error?reject(error):resolve(image);};
    const timer=setTimeout(()=>finish(Error('base-textile-timeout')),5000);
    image.onload=async()=>{
      const expected=detailSize||size;
      if(image.naturalWidth!==expected||image.naturalHeight!==expected){finish(Error('base-textile-size'));return;}
      try{await image.decode?.();finish();}catch{finish(Error('base-textile-decode'));}
    };
    image.onerror=()=>finish(Error('base-textile-unavailable'));
    image.src=new URL(`./assets/avatar-textiles-v1/${detailSize?detailSize+'/':''}${kind}-${role}.png`,import.meta.url).href;
  });
}
function loadTextileImages(kind,detailSize){
  const key=detailSize?`${detailSize}/${kind}`:kind;
  if(!sourceImages.has(key)){
    // Decoded images are shared; live Three textures still belong to each avatar.
    const roles=['colour','normal','properties'];if(detailSize&&wardrobeFabricProfile(kind).anisotropy>0)roles.push('direction');
    const pending=Promise.all(roles.map(role=>loadTextileImage(kind,role,detailSize)));
    sourceImages.set(key,pending);pending.catch(()=>{if(sourceImages.get(key)===pending)sourceImages.delete(key);});
  }
  const pending=sourceImages.get(key);sourceImages.delete(key);sourceImages.set(key,pending);
  // Two slots need at most three detailed fabrics. Keep one spare, instead of
  // retaining every decoded 1024px cloth after many fitting-room visits.
  const detailKeys=[...sourceImages.keys()].filter(value=>value.includes('/'));
  while(detailKeys.length>4)sourceImages.delete(detailKeys.shift());
  return pending;
}
function awaitBaseImages(pending,signal){
  if(!signal)return pending;
  if(signal.aborted)return Promise.reject(new DOMException('Avatar closed','AbortError'));
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(new DOMException('Avatar closed','AbortError'));};
    signal.addEventListener('abort',abort,{once:true});
    pending.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}
function mapsFromImages(kind,[albedo,normal,packed,directional]){
  if(kind.endsWith('-detail')){
    const properties=wardTexture(packed,`${kind}-AO-R-roughness-G`);
    return {map:wardTexture(albedo,`${kind}-yarn-colour`,true),normalMap:wardTexture(normal,`${kind}-yarn-normal`),roughnessMap:properties,aoMap:properties,...(directional?{anisotropyMap:wardTexture(directional,`${kind}-fibre-direction-RG-strength-B`)}:{})};
  }
  const properties=map(packed,`${kind}-occlusion-R-roughness-G`);
  return {map:map(albedo,`${kind}-low-contrast-colour`,true),normalMap:map(normal,`${kind}-micro-normal`),roughnessMap:properties,aoMap:properties};
}
function assembleTextiles({anisotropy=4,detailSize=512}={},sets={}){
  const textures=[],baseSources={},detailSources={};
  for(const kind of baseKinds){baseSources[kind]=sets[kind]?'baked':'procedural';sets[kind]??=make(kind);for(const texture of new Set(Object.values(sets[kind]))){texture.anisotropy=anisotropy;textures.push(texture);}}
  for(const [kind,set]of Object.entries(sets))if(!baseKinds.includes(kind)){detailSources[kind]='baked';for(const texture of new Set(Object.values(set))){texture.anisotropy=anisotropy;textures.push(texture);}}
  function fabric(kind,repeat){
    kind=wardrobeKind(kind);
    if(!sets[kind]){sets[kind]=kind.endsWith('-detail')?makeWardrobeTextile(kind,detailSize):make(kind);if(kind.endsWith('-detail'))detailSources[kind]='procedural';for(const texture of new Set(Object.values(sets[kind]))){texture.anisotropy=anisotropy;textures.push(texture);}}
    const result={},clones=new Map();
    for(const [key,texture] of Object.entries(sets[kind])){if(!clones.has(texture)){const clone=texture.clone();clone.repeat.set(...repeat);clone.needsUpdate=true;textures.push(clone);clones.set(texture,clone);}result[key]=clones.get(texture);}
    return result;
  }
  return {fabric,textures,baseSources,detailSources};
}

// Retain the deterministic builder for authoring, rebaking and offline fallback.
export function createAvatarTextiles(options={}){return assembleTextiles(options);}
/** Load the exact authored base maps without Canvas2D fibre generation. */
export async function loadAvatarTextiles(options={}){
  if(options.signal?.aborted)throw new DOMException('Avatar closed','AbortError');
  const detailKinds=[...new Set((options.detailKinds||[]).map(wardrobeKind).filter(kind=>Object.hasOwn(wardrobeProfiles,kind)))],detailSize=options.detailSize>=1024?1024:512;
  const pending=Promise.all([...baseKinds,...detailKinds].map(async kind=>{try{return [kind,await loadTextileImages(kind,detailKinds.includes(kind)?detailSize:undefined)];}catch{return [kind,null];}}));
  const sources=await awaitBaseImages(pending,options.signal);
  if(options.signal?.aborted)throw new DOMException('Avatar closed','AbortError');
  const sets={};for(const [kind,images]of sources)if(images)sets[kind]=mapsFromImages(kind,images);
  return assembleTextiles(options,sets);
}
