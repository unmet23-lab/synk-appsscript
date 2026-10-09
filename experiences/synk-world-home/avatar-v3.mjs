import * as THREE from './scene-assets/three.module.js';
import {createAvatarTextiles} from './avatar-textiles.mjs';
import {createAvatarWardrobe} from './avatar-wardrobe.mjs';
import {WARDROBE_OUTFITS,slotsForOutfit,outfitForSlots} from './wardrobe-catalog.mjs';

// Shared runtime asset: +Z front, +Y up, foot origin; bounds are exposed by metrics().
// This remains an authored procedural study, not an approved production master.
export const AVATAR_VERSION = 'mongle-v3';
export const AVATAR_OUTFITS = WARDROBE_OUTFITS;
const TAU = Math.PI * 2;
const profile = new THREE.CatmullRomCurve3([
  [0,.11],[.86,.12],[.89,.25],[.84,.49],[.815,.83],[.775,1.12],[.68,1.43],[.48,1.69],[.24,1.81],[0,1.845]
].map(([x,y])=>new THREE.Vector3(x,y,0)),false,'centripetal');
const seeded=seed=>()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
function boundedTexture(loader,url,timeoutMs=12000){
 return new Promise((resolve,reject)=>{let settled=false;const timeout=setTimeout(()=>{settled=true;reject(Error('texture-timeout'));},timeoutMs);
  Promise.resolve().then(()=>loader.loadAsync(url)).then(texture=>{if(settled){texture.dispose();return;}settled=true;clearTimeout(timeout);resolve(texture);},error=>{if(settled)return;settled=true;clearTimeout(timeout);reject(error);});
 });
}
function mesh(parent,geometry,material){
 if(material.vertexColors&&!geometry.getAttribute('color'))geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
 const m=new THREE.Mesh(geometry,material);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
function tube(parent,points,radius,material,closed=false,segments=32){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'catmullrom',.32),segments,radius,5,closed),material);}
function surface(fn,rows,cols,thickness=.012,shade=()=>1){
 const pos=[],uv=[],idx=[],colors=[];
 // Two offset skins and a closed rim give garments real thickness from every angle.
 for(let side=0;side<2;side++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const u=i/cols,v=j/rows,p=new THREE.Vector3(...fn(u,v));
  const a=new THREE.Vector3(...fn(Math.min(1,u+.001),v)).sub(new THREE.Vector3(...fn(Math.max(0,u-.001),v)));
  const b=new THREE.Vector3(...fn(u,Math.min(1,v+.001))).sub(new THREE.Vector3(...fn(u,Math.max(0,v-.001))));
  p.addScaledVector(a.cross(b).normalize(),(side?-.5:.5)*thickness);pos.push(...p.toArray());uv.push(u,v);const tone=shade(u,v,side);colors.push(tone,tone,tone);
 }
 const n=(rows+1)*(cols+1);
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*(cols+1)+i;idx.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1,k+n,k+cols+1+n,k+1+n,k+1+n,k+cols+1+n,k+cols+2+n);}
 const rim=[];for(let i=0;i<=cols;i++)rim.push(i);for(let j=1;j<=rows;j++)rim.push(j*(cols+1)+cols);for(let i=cols-1;i>=0;i--)rim.push(rows*(cols+1)+i);for(let j=rows-1;j>0;j--)rim.push(j*(cols+1));
 for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length];idx.push(a,a+n,b,b,a+n,b+n);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function bodyGeometry(){
 const g=new THREE.LatheGeometry(Array.from({length:73},(_,i)=>{const p=profile.getPoint(i/72);return new THREE.Vector2(p.x,p.y);}),112),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(x,z),r=Math.hypot(x,z),f=Math.exp(-y*8.5),wave=Math.cos(a*10+Math.PI),organic=Math.sin(a*3+y*4)*.004*Math.sin(y*1.6);const nr=r+f*wave*.049+organic;p.setXYZ(i,r>.001?x*nr/r:0,y+f*wave*.145,r>.001?z*nr/r*.91:0);}
 const uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setY(i,p.getY(i)/1.845);
 g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(p.count*3).fill(1),3));g.computeVertexNormals();return g;
}
function shortNap(mobile){
 const random=seeded(81),pos=[],color=[];
 for(let i=0;i<(mobile?5500:8500);i++){const t=.12+random()*.86,a=random()*TAU,p=profile.getPoint(t),r=p.x+.002,w=Math.cos(a*10+Math.PI),f=Math.exp(-p.y*8.5),x=Math.sin(a)*(r+f*w*.049),y=p.y+f*w*.145,z=Math.cos(a)*(r+f*w*.049)*.91;
  if(z>.5&&Math.abs(y-1.28)<.16&&Math.min(Math.abs(x-.31),Math.abs(x+.31))<.12)continue;
  const tangent=profile.getTangent(t),n=new THREE.Vector3(Math.sin(a)*tangent.y,-tangent.x,Math.cos(a)*tangent.y/.91).normalize(),len=.0018+random()*.0032;pos.push(x,y,z,x+n.x*len,y+n.y*len,z+n.z*len);const c=new THREE.Color('#efb7a0').lerp(new THREE.Color('#df947e'),random());color.push(c.r,c.g,c.b,c.r,c.g,c.b);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));return new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.085,depthWrite:false}));
}

export async function createMongleAvatar({mobile=false,textureLoader=new THREE.TextureLoader(),anisotropy=4,wardrobeDetail=false}={}){
 const group=new THREE.Group();group.name=AVATAR_VERSION;const textile=createAvatarTextiles({anisotropy,detailSize:mobile?512:1024}),textures=textile.textures;
 const bodyMaterial=new THREE.MeshPhysicalMaterial({color:'#ee8b76',...textile.fabric('wool',[8.8,3.3]),normalScale:new THREE.Vector2(.46,.46),roughness:1,sheen:.72,sheenRoughness:.92,sheenColor:new THREE.Color('#f4baa7'),vertexColors:true});
 const assetFailures=[];try{
  const felt=await boundedTexture(textureLoader,new URL('./assets/felt-coral.webp',import.meta.url).href);
  felt.colorSpace=THREE.SRGBColorSpace;felt.wrapS=felt.wrapT=THREE.RepeatWrapping;felt.repeat.set(8.8,3.3);felt.anisotropy=anisotropy;textures.push(felt);
  bodyMaterial.map=felt;bodyMaterial.color.set('#fff0e9');
 }catch(error){assetFailures.push({asset:'felt-coral.webp',reason:error.message==='texture-timeout'?'timeout':'load-failed',fallback:'procedural-wool'});}
 const thread=new THREE.MeshStandardMaterial({color:'#e9b29a',roughness:.97});
 const eye=new THREE.MeshPhysicalMaterial({color:'#030303',roughness:.22,clearcoat:.28,clearcoatRoughness:.22,envMapIntensity:.16,specularIntensity:.4});
 const glint=new THREE.MeshBasicMaterial({color:'#fff9ef'});
 const scarfMat=new THREE.MeshPhysicalMaterial({color:'#ede4d1',...textile.fabric('knit',[.38,1.0]),normalScale:new THREE.Vector2(.24,.24),roughness:1,sheen:.7,sheenRoughness:.94,sheenColor:new THREE.Color('#fff0d7'),vertexColors:true,aoMapIntensity:.28});
 const bandMat=scarfMat.clone();Object.assign(bandMat,textile.fabric('knit',[8.2,.29]));
 const cotton=new THREE.MeshPhysicalMaterial({color:'#859b87',...textile.fabric('cotton',[1.8,1.3]),normalScale:new THREE.Vector2(.58,.58),roughness:1,sheen:.5,sheenRoughness:.96,sheenColor:new THREE.Color('#b4bda4'),vertexColors:true,aoMapIntensity:.35});
 const pocketMat=cotton.clone();Object.assign(pocketMat,textile.fabric('cotton',[.62,.47]));
 const strapMat=cotton.clone();Object.assign(strapMat,textile.fabric('cotton',[.09,4.7]));
 const cottonEdge=new THREE.MeshStandardMaterial({color:'#a2af98',roughness:.97});
 const lining=new THREE.MeshStandardMaterial({color:'#465b46',roughness:1});
 const materials=[bodyMaterial,thread,eye,glint,scarfMat,bandMat,cotton,pocketMat,strapMat,cottonEdge,lining];
 const body=mesh(group,bodyGeometry(),bodyMaterial);body.name='mongle-bell-scalloped-body';body.geometry.computeBoundingBox();group.add(shortNap(mobile));
 for(const sign of [-1,1]){const e=mesh(group,new THREE.SphereGeometry(.091,32,24),eye);e.position.set(sign*.31,1.282,.632);e.scale.set(1,1.03,.68);e.rotation.y=sign*.19;const g=mesh(group,new THREE.SphereGeometry(.014,12,8),glint);g.position.set(sign*.31-.025,1.313,.689);}
 // Individual short stitches follow five visible hem scallops, not a thick pipe.
 const stitchPos=[];for(let i=0;i<112;i++){const a=i/112*TAU;for(const da of [-.010,.010]){const aa=a+da,r=.884+Math.cos(aa*10+Math.PI)*.011;stitchPos.push([Math.sin(aa)*r,.178+Math.cos(aa*10+Math.PI)*.053,Math.cos(aa)*r*.915]);}}
 const stitchGeo=new THREE.CylinderGeometry(.0034,.0034,1,5),stitches=new THREE.InstancedMesh(stitchGeo,thread,stitchPos.length/2),dummy=new THREE.Object3D();for(let i=0;i<stitchPos.length;i+=2){const a=new THREE.Vector3(...stitchPos[i]),b=new THREE.Vector3(...stitchPos[i+1]),d=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.scale.set(1,d.length(),1);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());dummy.updateMatrix();stitches.setMatrixAt(i/2,dummy.matrix);}group.add(stitches);
 const scarf=new THREE.Group();scarf.name='mongle-scarf-first-steps';group.add(scarf);
 const band=(u,v)=>{const a=u*TAU+Math.PI,r=.83+Math.sin(v*Math.PI)*.046+Math.sin(a*5+v*1.9)*.013;return[Math.sin(a)*r,1.078-v*(.16+.035*Math.sin(a+.7))-Math.cos(a)*.025+Math.sin(a*2+.9)*.040+Math.sin(a*3-v*2)*.009,Math.cos(a)*r*.91];};
 mesh(scarf,surface(band,12,96,.031,(u,v,side)=>side?1-.055*Math.exp(-v*14):.88),bandMat);
 for(const v of [.04,.95])tube(scarf,Array.from({length:97},(_,i)=>band(i/96,v)),.006,scarfMat,true,96);
 // Unstiffened tails curve around the volume, with changing width and fold depth.
 const tail=(u,v,back=false)=>{const width=.211*(1-.07*v),x=(back?.41:.565)+(u-.5)*width+Math.sin(v*3.1)*(back?-.040:.012)-v*.051,y=.999-v*(back?.40:.56),r=.815+(1-y)*.068;return[x,y,.91*Math.sqrt(Math.max(.01,r*r-x*x))+(back?.047:.070)+Math.sin(v*3.9)*.024+Math.sin(u*Math.PI*2.3+v*2.0)*(.009+v*.016)+v*v*.015];};
 for(const back of [true,false]){mesh(scarf,surface((u,v)=>tail(u,v,back),24,14,.024,(u,v,side)=>(side?1:.85)-(back?.07:0)-.08*Math.exp(-v*12)),scarfMat);for(const u of [.02,.98])tube(scarf,Array.from({length:25},(_,i)=>tail(u,i/24,back)),.0034,scarfMat,false,32);for(let i=0;i<11;i++){const p=tail((i+.5)/11,1,back),fringe=tube(scarf,[p,[p[0]+Math.sin(i)*.005,p[1]-.025,p[2]+.005],[p[0]+.004,p[1]-.042,p[2]+.013]],.0027,scarfMat,false,5);fringe.receiveShadow=false;fringe.castShadow=false;}}
 const apron=new THREE.Group();apron.name='mongle-apron-starter';group.add(apron);
 const cloth=(u,v)=>{const width=.26+.25*Math.sin(v*1.5),x=(u*2-1)*width,y=.91-v*.59,z=.91*Math.sqrt(Math.max(.01,(.822+v*.025)**2-x*x))+.030+Math.sin(u*20+v*2)*(.004+.021*v)*Math.sin(v*2.8)+Math.sin(v*7)*.013;return[x,y,z];};
 mesh(apron,surface(cloth,28,36,.021,(u,v,side)=>{
  const pocketShade=Math.exp(-Math.pow((u-.5)/.17,8))*Math.exp(-Math.pow((v-.53)/.22,8))*.045;
  return (side?1:.84)-pocketShade-.045*Math.exp(-v*18)-.035*Math.exp(-(1-v)*23);
 }),cotton);
 for(const u of [.013,.987])tube(apron,Array.from({length:29},(_,i)=>cloth(u,i/28)),.003,cottonEdge,false,32);
 for(const v of [.964,.989])tube(apron,Array.from({length:37},(_,i)=>cloth(i/36,v)),.0025,cottonEdge,false,40);
 const strap=(side,u,v)=>{const a=side*(.32+v*(Math.PI-.64)),y=.971+Math.sin(v*Math.PI)*.064+(u-.5)*.034,r=.831;return[Math.sin(a)*r,y,Math.cos(a)*r*.91];};
 for(const side of [-1,1])mesh(apron,surface((u,v)=>strap(side,u,v),32,5,.016),strapMat);
 const pocket=(u,v)=>{const x=(u-.5)*(.295-.025*v*v),y=.664-v*.214+Math.pow(Math.abs(u-.5)*2,5)*v*v*.014,cv=(.91-y)/.59,w=.26+.25*Math.sin(cv*1.5),base=cloth((x/w+1)/2,cv);return[x,y,base[2]+.014+Math.sin(u*Math.PI)*(.018+.014*Math.sin(v*Math.PI))-.008*v*v];};
 mesh(apron,surface(pocket,16,22,.015,(u,v,side)=>(side?1:.78)-.04*Math.exp(-(1-v)*15)),pocketMat);
 mesh(apron,surface((u,v)=>{const p=pocket(u,v*.055);return[p[0],p[1]-.002,p[2]-.012];},3,22,.002),lining);
 mesh(apron,surface((u,v)=>{const p=pocket(u,.02+v*.10);p[2]+=.003;return p;},3,22,.007),pocketMat);
 for(const u of [.014,.986])tube(apron,Array.from({length:10},(_,i)=>pocket(u,i/9)),.003,cottonEdge,false,12);
 tube(apron,Array.from({length:18},(_,i)=>pocket(i/17,.06)),.002,cottonEdge,false,20);
 const pocketStitches=[];for(let i=0;i<15;i++){const u=(i+.5)/15;pocketStitches.push([pocket(u-.012,.13),pocket(u+.012,.13)]);}for(let i=0;i<17;i++){const u=(i+.5)/17;pocketStitches.push([pocket(u-.01,.96),pocket(u+.01,.96)]);}
 const pocketThread=new THREE.InstancedMesh(new THREE.CylinderGeometry(.0015,.0015,1,5),cottonEdge,pocketStitches.length);const stitchDummy=new THREE.Object3D();for(let i=0;i<pocketStitches.length;i++){const[a,b]=pocketStitches[i].map(p=>new THREE.Vector3(...p)),d=b.clone().sub(a);stitchDummy.position.copy(a).add(b).multiplyScalar(.5);stitchDummy.scale.set(1,d.length(),1);stitchDummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());stitchDummy.updateMatrix();pocketThread.setMatrixAt(i,stitchDummy.matrix);}apron.add(pocketThread);
 // Tiny embroidered music note shares the item identity in both viewpoints.
 const notePoint=(u,v)=>{const p=tail(u,v);p[2]+=.017;return p;};
 tube(scarf,[notePoint(.45,.88),notePoint(.45,.77),notePoint(.60,.75)],.0055,bodyMaterial,false,12);const note=mesh(scarf,new THREE.SphereGeometry(.011,12,8),bodyMaterial);note.position.set(...notePoint(.41,.885));note.scale.set(1.3,.75,.4);
 const footOffset=body.geometry.boundingBox.min.y;for(const child of group.children)child.position.y-=footOffset;const bodyBounds={width:body.geometry.boundingBox.max.x-body.geometry.boundingBox.min.x,height:body.geometry.boundingBox.max.y-footOffset,depth:body.geometry.boundingBox.max.z-body.geometry.boundingBox.min.z};
 const fitProfile=Array.from({length:161},(_,i)=>{const p=profile.getPoint(i/160);return[p.y,p.x];}).sort((a,b)=>a[0]-b[0]);
 const wardrobe=createAvatarWardrobe({parent:group,textile,footOffset,bodyProfile:fitProfile,mobile,detail:wardrobeDetail});
 let outfit='none',equipment={body:'',neck:''},disposed=false,pose='neutral';
 function setOutfit(value){equipment=slotsForOutfit(value);outfit=outfitForSlots(equipment);scarf.visible=false;apron.visible=false;wardrobe.set(equipment);
  const p=body.geometry.attributes.position,c=body.geometry.attributes.color;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=Math.max(0,z/.75);
   const eyeContact=front*.13*Math.exp(-Math.pow((y-1.282)/.095,2))*(Math.exp(-Math.pow((x-.31)/.098,2))+Math.exp(-Math.pow((x+.31)/.098,2)));
   const scarfContact=equipment.neck?.07*Math.exp(-Math.pow((y-.98)/.048,2)):0;
   const apronContact=equipment.body==='mongle-apron-starter'?front*.045*Math.exp(-Math.pow((y-.60)/.34,8))*Math.exp(-Math.pow((Math.abs(x)-.40)/.10,2)):0;
   const garmentContact=equipment.body?.030*Math.exp(-Math.pow((y-1.04)/.035,2)):0;
   const tone=1-eyeContact-scarfContact-apronContact-garmentContact;c.setXYZ(i,tone,tone,tone);
  }c.needsUpdate=true;return outfit;}setOutfit('none');
 // Mongle has no arms: greeting is a gentle whole-body bow, with the original
 // geometry and eye placement moving together rather than replacing the face.
 function applyPose(){group.rotation.x=pose==='wave'?.12:0;group.rotation.z=pose==='tilt'?-.11:pose==='wave'?.035:0;}
 function setPose(value){pose=['neutral','wave','tilt'].includes(value)?value:'neutral';group.scale.setScalar(1);applyPose();return pose;}
 function update(seconds,{reducedMotion=false,greeting=-1}={}){applyPose();if(reducedMotion){group.scale.setScalar(1);return;}const active=greeting>=0&&greeting<1.2;group.rotation.z+=active?Math.sin(greeting*TAU/1.2)*.08:Math.sin(seconds*.8)*.004;group.scale.set(1,1+Math.sin(seconds*1.7)*.003,1);}
 function dispose(){if(disposed)return;disposed=true;const geos=new Set(),allMaterials=new Set(materials);group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geos.add(o.geometry);if(o.material)allMaterials.add(o.material);});geos.forEach(g=>g.dispose());allMaterials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.removeFromParent();}
 return{group,setOutfit,setEquipment:setOutfit,setDyes:value=>wardrobe.setDyes(value),getDyes:()=>wardrobe.getDyes(),setPose,getPose:()=>pose,update,getOutfit:()=>outfit,metrics:()=>({avatarVersion:AVATAR_VERSION,materialRevision:4,wardrobeRevision:6,dyeRevision:1,pose,equipment:{...equipment},dyes:wardrobe.getDyes(),wardrobe:wardrobe.metrics(),outfit,bodyBounds,assetFailures:[...assetFailures],productionAsset:false}),dispose};
}
