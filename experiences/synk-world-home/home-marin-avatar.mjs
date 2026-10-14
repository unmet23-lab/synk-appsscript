import * as THREE from './scene-assets/three.module.js';

// Form source: docs/캐릭터/정본_4K/마린_본체.png and 마린_좌34.png.
// Eye ratios: docs/캐릭터/마스코트_치수_정본_v1.md §§2, 4.
// 2026-10-12 silhouette audit: the old all-alpha bounding box included detached
// pixels below the feet. The actual largest component is 2011 x 2781, not 2028
// x 3233. Use the intact body and the pictured ~70% helmet, not that old .63 box.
// This is an actual closed 3D form. No portrait planes or image cutouts are used.
const TAU=Math.PI*2;
const HEIGHT=2.25, WIDTH=HEIGHT*(2011/2781), HEAD_HEIGHT=HEIGHT*.702985;
const HEAD_BOTTOM=HEIGHT-HEAD_HEIGHT, EYE_WIDTH=WIDTH*.254102;
const HEAD_DEPTH=.86;
const EYE_HEIGHT=EYE_WIDTH*1.148728, EYE_SPACING=EYE_WIDTH*1.91282;
const EYE_Y=HEIGHT*(1-.468062);
const randomFrom=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const signedPower=(value,power)=>Math.sign(value)*Math.abs(value)**power;

// A broad crown, nearly upright cheeks, and a softly rolled lower edge.
// Unlike a lathed bell, a rounded-square horizontal section keeps the face wide.
const HEAD_PROFILE=[
  [0,.735],[.035,.785],[.09,.866],[.16,.906],[.24,.934],[.36,.981],[.48,1],
  [.62,.970],[.75,.887],[.85,.731],[.925,.548],[.972,.357],[1,0]
];
function profile(v){
  v=THREE.MathUtils.clamp(v,0,1);
  for(let i=1;i<HEAD_PROFILE.length;i++)if(v<=HEAD_PROFILE[i][0]){
    const [a,ra]=HEAD_PROFILE[i-1],[b,rb]=HEAD_PROFILE[i];
    // Catmull-Rom scalar interpolation keeps panel rings invisible.
    const p=HEAD_PROFILE[Math.max(0,i-2)][1],q=HEAD_PROFILE[Math.min(HEAD_PROFILE.length-1,i+1)][1],t=(v-a)/(b-a);
    return Math.max(0,((2*ra)+(-p+rb)*t+(2*p-5*ra+4*rb-q)*t*t+(-p+3*ra-3*rb+q)*t*t*t)*.5);
  }
  return 0;
}
function panelRelief(angle,v){
  const a=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle))),progress=THREE.MathUtils.clamp((v-.51)/.478,0,1);
  const centre=.66+.025*Math.sin(progress*Math.PI),distance=(a-centre)/.039;
  const envelope=THREE.MathUtils.smoothstep(v,.50,.55)*(1-THREE.MathUtils.smoothstep(v,.967,.996));
  // The two cloth edges rise beside a pressed join. A broad recess replaces
  // the old dark thread laid on top of a completely smooth helmet.
  const valley=Math.exp(-distance*distance*1.8),shoulder=Math.exp(-Math.pow((Math.abs(distance)-1.12)/.66,2));
  return {lift:envelope*(-.010*valley+.009*shoulder),shade:1-envelope*.50*valley};
}
function headPoint(angle,v){
  const r=profile(v),radius=WIDTH*.5*r;
  const x=radius*signedPower(Math.sin(angle),.77);
  const z=radius*HEAD_DEPTH*signedPower(Math.cos(angle),.77);
  // The photographed hem lifts at the cheeks and rounds down at the centre.
  // A flat base ring made the otherwise measured helmet read as a tall cap.
  const lowerLift=.065*Math.sin(angle)**2*(1-THREE.MathUtils.smoothstep(v,0,.20));
  const p=new THREE.Vector3(x,HEAD_BOTTOM+HEAD_HEIGHT*v+lowerLift,z),lift=panelRelief(angle,v).lift;
  return p.addScaledVector(new THREE.Vector3(x,0,z).normalize(),lift);
}
function faceDepth(x,y){
  const r=WIDTH*.5*profile((y-HEAD_BOTTOM)/HEAD_HEIGHT),p=2/.77;
  return r*HEAD_DEPTH*Math.max(.001,1-(Math.abs(x)/Math.max(.001,r))**p)**(1/p);
}
function parametric(surface,nu,nv){
  const positions=[],uv=[],indices=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
    const p=surface(i/nu,j/nv);positions.push(p.x,p.y,p.z);uv.push(i/nu,j/nv);
  }
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;
    indices.push(a,b,d,a,d,c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function squashedSphere(rx,ry,rz,exponent=.9){
  return parametric((u,v)=>{
    const lat=(v-.5)*Math.PI,lon=u*TAU;
    return new THREE.Vector3(rx*signedPower(Math.cos(lat),exponent)*signedPower(Math.sin(lon),exponent),ry*signedPower(Math.sin(lat),exponent),rz*signedPower(Math.cos(lat),exponent)*signedPower(Math.cos(lon),exponent));
  },48,32);
}

/** Owns only resources created here; kit is borrowed and never disposed. */
export function createMarinHomeAvatar({kit,low=false}={}){
  const group=new THREE.Group();group.name='living-home-marin-canonical-v2';
  const geometrySet=new Set(),materialSet=new Set(),textureSet=new Set(),fiberLayers=[];
  let disposed=false,quality=low?'low':'balanced';
  function ownMaterial(material){materialSet.add(material);return material;}
  function add(parent,geometry,material,position=[0,0,0]){
    geometrySet.add(geometry);const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.castShadow=object.receiveShadow=true;parent.add(object);return object;
  }
  function yarn(parent,points,radius,material,segments=40){
    return add(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,radius,6,false),material);
  }

  // A deterministic, directionless felt nap, not the wardrobe's woven grid.
  // Maps are generated in memory and are owned by this model.
  function feltMaps(){
    const size=512,heights=new Float32Array(size*size),random=randomFrom(98183);
    for(let i=0;i<heights.length;i++)heights[i]=random()*.003;
    function dab(x,y,value){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;for(let dx=0;dx<=1;dx++)for(let dy=0;dy<=1;dy++)heights[((iy+dy+size)%size)*size+(ix+dx+size)%size]+=value*(dx?fx:1-fx)*(dy?fy:1-fy);}
    for(let i=0;i<6200;i++){
      let x=random()*size,y=random()*size,angle=random()*TAU;
      const bend=(random()-.5)*.12,length=15+random()*37,strength=.065+random()*.060;
      for(let j=0;j<length;j++){angle+=bend+Math.sin(j*.24)*.025;x+=Math.cos(angle)*.62;y+=Math.sin(angle)*.62;dab(x,y,strength);}
    }
    const albedo=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const index=y*size+x,i=index*4,h=heights[index],grain=219+Math.min(36,h*132);
      albedo[i]=albedo[i+1]=albedo[i+2]=grain;albedo[i+3]=255;
      const dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size];
      const dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
      const n=new THREE.Vector3(-dx*3,-dy*3,1).normalize();normal[i]=(n.x*.5+.5)*255;normal[i+1]=(n.y*.5+.5)*255;normal[i+2]=(n.z*.5+.5)*255;normal[i+3]=255;
    }
    function texture(bytes,color=false){const t=new THREE.DataTexture(bytes,size,size);if(color)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,2.6);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;t.needsUpdate=true;textureSet.add(t);return t;}
    return {map:texture(albedo,true),normalMap:texture(normal)};
  }
  const felt= feltMaps();
  function cloth(color,{sheen=.55,normal=.34}={}){
    return ownMaterial(new THREE.MeshPhysicalMaterial({color,...felt,roughness:1,metalness:0,normalScale:new THREE.Vector2(normal,normal),sheen,sheenColor:new THREE.Color(color).lerp(new THREE.Color('#ddd9d0'),.38),sheenRoughness:1,clearcoat:0,specularIntensity:0}));
  }
  const navy=cloth('#283158'),navyRaised=cloth('#2b365d'),navySeam=cloth('#273150',{sheen:.3,normal:.25});
  const cream=cloth('#cbb7a8',{sheen:.36}),creamHem=cloth('#c6b29f'),yellow=cloth('#f5cd58',{sheen:0,normal:.65});
  // The small cream pieces need their own physical texture scale. Sharing the
  // helmet repeats made their fibres smaller than a screen pixel.
  for(const material of [cream,creamHem])for(const key of ['map','normalMap']){const t=material[key].clone();t.repeat.set(1.7,1.15);if(key==='map'){const data=new Uint8Array(t.image.data);for(let i=0;i<data.length;i+=4){const value=236+(data[i]-219)*.52;data[i]=data[i+1]=data[i+2]=value;}t.source=new THREE.Source({data,width:t.image.width,height:t.image.height});t.needsUpdate=true;}textureSet.add(t);material[key]=t;}
  cream.normalScale.set(.10,.10);creamHem.normalScale.set(.10,.10);
  const socketCloth=ownMaterial(navy.clone());socketCloth.vertexColors=true;
  const lensCloth=ownMaterial(yellow.clone());lensCloth.vertexColors=true;
  lensCloth.color.set('#f2bd2e');
  // A lens spans only a fraction of the helmet: keep its felt fibers visible
  // at that physical scale instead of repeating the helmet weave three times.
  for(const key of ['map','normalMap']){const t=lensCloth[key].clone();t.repeat.set(.85,.85);textureSet.add(t);lensCloth[key]=t;}
  lensCloth.normalScale.set(.95,.95);
  // Soft, material-space contact shading survives low-resolution room shadows.
  // It follows the actual padded surface and remains stable when the head turns.
  function clothOcclusion(geometry,shade){const uv=geometry.getAttribute('uv'),colors=[];for(let i=0;i<uv.count;i++){const value=shade(uv.getX(i),uv.getY(i));colors.push(value,value,value);}geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry;}
  yellow.specularIntensity=0;
  const green=cloth('#52792f'),petal=cloth('#e9e4d7',{sheen:.15});

  // Tangled fine strands break the outline and catch light like felt. They stay
  // attached to the 3D shell instead of overlaying an image or moving in screen space.
  function fibers(parent,sampler,count,color,seed,length=.012,direction=null,opacity=.22){
    const random=randomFrom(seed),positions=[],colors=[],base=new THREE.Color(color),light=base.clone().lerp(new THREE.Color('#d8d4cf'),.15);
    for(let i=0;i<count;i++){
      const sample=sampler(random(),random()),p=sample.p,n=sample.n;
      const tangent=new THREE.Vector3(random()-.5,random()-.5,random()-.5);if(direction)tangent.lerp(direction,.66);tangent.addScaledVector(n,-tangent.dot(n)).normalize();
      const l=length*(.5+random()*.8),curl=(random()-.5)*1.3,across=n.clone().cross(tangent).normalize();
      const p1=p.clone().addScaledVector(tangent,l*.24).addScaledVector(across,l*curl*.18).addScaledVector(n,l*.18),p2=p.clone().addScaledVector(tangent,l*.53).addScaledVector(across,l*curl*.34).addScaledVector(n,l*.24),tip=p.clone().addScaledVector(tangent,l*.81).addScaledVector(across,l*curl*.12).addScaledVector(n,l*.08);
      positions.push(...p.toArray(),...p1.toArray(),...p1.toArray(),...p2.toArray(),...p2.toArray(),...tip.toArray());
      const c=base.clone().lerp(light,random()*.7).multiplyScalar(sample.shade??1);for(let j=0;j<6;j++)colors.push(c.r,c.g,c.b);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometrySet.add(geometry);
    const material=ownMaterial(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity,depthWrite:false,toneMapped:true}));
    const lines=new THREE.LineSegments(geometry,material);lines.frustumCulled=false;parent.add(lines);fiberLayers.push({geometry,material,opacity,count:count*6});return lines;
  }
  function ellipsoid(parent,radii,position,material,{rotation=0,hair=0,seed=4,color='#cbb7a8',power=.9,deform=null}={}){
    const root=new THREE.Group();root.position.set(...position);root.rotation.z=rotation;parent.add(root);
    const geometry=squashedSphere(...radii,power);if(deform){const attribute=geometry.getAttribute('position');for(let i=0;i<attribute.count;i++){const p=deform(new THREE.Vector3().fromBufferAttribute(attribute,i));attribute.setXYZ(i,p.x,p.y,p.z);}geometry.computeVertexNormals();}add(root,geometry,material);
    if(hair){
      const sample=(u,v)=>{const theta=u*TAU,cy=v*2-1,r=Math.sqrt(1-cy*cy),s=new THREE.Vector3(Math.sin(theta)*r,cy,Math.cos(theta)*r),p=new THREE.Vector3(signedPower(s.x,power)*radii[0],signedPower(s.y,power)*radii[1],signedPower(s.z,power)*radii[2]),n=new THREE.Vector3(signedPower(s.x,2-power)/radii[0],signedPower(s.y,2-power)/radii[1],signedPower(s.z,2-power)/radii[2]).normalize();return {p:deform?deform(p):p,n};};
      fibers(root,sample,hair,color,seed,.034,null,.17);
      // Fine pale wool crosses the subdued base nap. Longer continuous curves
      // remain readable on the shaded belly instead of looking like dark dots.
      fibers(root,sample,Math.round(hair*.46),'#ead9c7',seed+701,.062,null,.28);
    }
    return root;
  }

  // The body sits toward the front of the deep helmet, as the 3/4 master shows.
  // Keeping it at the helmet's centre hid the belly and pocket behind the brim.
  const body=new THREE.Group();body.name='marin-stuffed-body';body.position.z=.22;group.add(body);
  // The master has a wide stuffed lower belly, not a spherical torso tapering
  // away above two separate feet. Keep height while filling the lower corners.
  ellipsoid(body,[.460,.315,.318],[0,.437,0],cream,{hair:16000,seed:9,power:.72});
  const arms=[];
  for(const side of [-1,1]){
    arms.push(ellipsoid(body,[.130,.223,.14],[side*.530,.506,.005],cream,{rotation:side*.49,hair:3100,seed:side+12}));
    const foot=ellipsoid(body,[.125,.147,.143],[side*.167,.147,.035],cream,{hair:2600,seed:side+17,power:.86});
    // A shallow stitched fold joins the foot to the stuffed belly. It follows
    // the existing foot surface and adds no separate cuff or character part.
    const footJoin=Array.from({length:25},(_,i)=>{const a=-1.08+i/24*2.16;return new THREE.Vector3(Math.sin(a)*.112,.101+Math.cos(a)*.012,Math.cos(a)*.100);});
    yarn(foot,footJoin,.0045,creamHem,32);
    const footJoinCurve=new THREE.CatmullRomCurve3(footJoin);fibers(foot,(u,v)=>{const p=footJoinCurve.getPoint(u),n=new THREE.Vector3(p.x,.5,p.z).normalize();return {p:p.addScaledVector(n,.004),n};},500,'#e6d4c1',side+211,.042,null,.27);
  }

  const helmet=new THREE.Group();helmet.name='wide-panelled-felt-helmet';group.add(helmet);
  const panelCloth=ownMaterial(navy.clone());panelCloth.vertexColors=true;
  const shell=clothOcclusion(parametric((u,v)=>headPoint(u*TAU,v),192,100),(u,v)=>panelRelief(u*TAU,v).shade);add(helmet,shell,panelCloth);
  // Close the base of the shell. The rolled edge is its only lower trim.
  add(helmet,parametric((u,v)=>{const edge=headPoint(u*TAU,0);return new THREE.Vector3(edge.x*v,HEAD_BOTTOM+.002+(edge.y-HEAD_BOTTOM)*v*v,edge.z*v);},112,12),navy);
  fibers(helmet,(u,v)=>{
    const a=u*TAU,w=.025+v*.965,p=headPoint(a,w),du=headPoint(a+.001,w).sub(headPoint(a-.001,w)),dv=headPoint(a,Math.min(.999,w+.001)).sub(headPoint(a,Math.max(.001,w-.001))),n=du.cross(dv).normalize();
    return {p:p.addScaledVector(n,.001),n,shade:panelRelief(a,w).shade};
  },48000,'#4c5b85',173,.050,null,.16);

  // An oval felt roll, shaped to the head instead of a shiny circular torus.
  function rolledEdge(angle){const p=headPoint(angle,.061);p.y+=.025-.055*Math.cos(angle)**2;return p;}
  function rollPoint(a,t,upper=false){const p=rolledEdge(a),radius=upper?.036:.047;p.x+=Math.sin(a)*Math.cos(t)*radius;p.z+=Math.cos(a)*Math.cos(t)*radius;p.y+=(upper?.056:-.018)+Math.sin(t)*(upper?.034:.067);return p;}
  const rollCloth=ownMaterial(navyRaised.clone());rollCloth.vertexColors=true;
  const upperRollCloth=ownMaterial(navy.clone());upperRollCloth.vertexColors=true;
  function foldShade(t,upper){const facing=Math.max(0,Math.cos(t)),height=Math.sin(t),fold=upper?-.62:.73;return 1-.40*facing*Math.exp(-Math.pow((height-fold)/.38,2));}
  add(helmet,clothOcclusion(parametric((u,v)=>rollPoint(u*TAU,v*TAU),112,28),(u,v)=>foldShade(v*TAU,false)),rollCloth);
  add(helmet,clothOcclusion(parametric((u,v)=>rollPoint(u*TAU,v*TAU,true),112,24),(u,v)=>foldShade(v*TAU,true)),upperRollCloth);
  fibers(helmet,(u,v)=>{const a=u*TAU,t=(v% .5)*2*TAU,p=rollPoint(a,t,v>.5),n=new THREE.Vector3(Math.sin(a)*Math.cos(t),Math.sin(t)*.65,Math.cos(a)*Math.cos(t)).normalize();return {p,n};},11500,'#465783',178,.033,null,.22);

  // Vertical panel joins converge over the crown and stop above the eye patches.
  for(const side of [-1,1]){
    const path=Array.from({length:49},(_,i)=>{const v=.51+i/48*.478,a=side*(.66+.025*Math.sin(i/48*Math.PI)),p=headPoint(a,v);return p.addScaledVector(new THREE.Vector3(p.x,0,p.z).normalize(),.004);});
    for(let i=2;i<path.length-2;i+=3){const p=path[i],across=new THREE.Vector3(side*.013,.003,-.003);yarn(helmet,[p.clone().sub(across),p.clone().add(across)],.0018,navyRaised,2);}
  }
  // A restrained side seam is visible at a three-quarter view.
  for(const side of [-1,1]){
    const path=Array.from({length:49},(_,i)=>{const v=.10+i/48*.876,p=headPoint(side*1.45,v);return p.addScaledVector(new THREE.Vector3(p.x,0,p.z).normalize(),.003);});
    yarn(helmet,path,.0035,navySeam,56);
  }

  const eyes=[];
  for(const side of [-1,1]){
    const cx=side*EYE_SPACING/2,rx=EYE_WIDTH/2,ry=EYE_HEIGHT/2;
    const patch=new THREE.Group();patch.name=side<0?'left-matte-yellow-lens':'right-matte-yellow-lens';helmet.add(patch);eyes.push(patch);
    const point=(a,r,lift=0)=>{const irregular=1+.014*Math.sin(a*3+side*.3)+.013*Math.cos(a*2),x=cx+Math.cos(a)*rx*r*irregular,y=EYE_Y+Math.sin(a)*ry*r*(1+.012*Math.sin(a*3));return new THREE.Vector3(x,y,faceDepth(x,y)+lift);};
    // Padded annular cloth surrounds the lens. The yellow visible area retains
    // the measured .2541 width, and has neither pupils nor highlights.
    const cushionLift=v=>.052*(1-v)+Math.sin(v*Math.PI)*.058;
    const socketShade=v=>.19+.81*v**1.3;
    add(patch,clothOcclusion(parametric((u,v)=>point(-u*TAU,1.02+v*.43,cushionLift(v)),72,14),(u,v)=>socketShade(v)),socketCloth);
    add(patch,parametric((u,v)=>point(-u*TAU,1+v*.023,.019+v*.034),72,4),navySeam);
    fibers(patch,(u,v)=>{const r=1.02+v*.43,p=point(u*TAU,r,cushionLift(v));return {p,n:new THREE.Vector3(p.x*.3,(p.y-EYE_Y)*.3,1).normalize(),shade:socketShade(v)};},6100,'#4b5b89',side+39,.020);
    // A softly stuffed lens rises inside the measured oval boundary. Its
    // perimeter and eye coordinates stay fixed; only the plush centre swells.
    const lensPoint=(a,r)=>point(a,r,.024+Math.cos(r*Math.PI/2)*.056);
    const lensGeometry=clothOcclusion(parametric((u,v)=>lensPoint(-u*TAU,v),72,24),(u,v)=>1-.18*v**5);
    // Planar felt coordinates avoid the previous radial pinching, which turned
    // curved fibres into a smooth circular sticker at normal viewing distance.
    const positions=lensGeometry.getAttribute('position'),uv=lensGeometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,(positions.getX(i)-cx)/(rx*2)+.5,(positions.getY(i)-EYE_Y)/(ry*2)+.5);
    add(patch,lensGeometry,lensCloth);
    fibers(patch,(u,v)=>{const a=u*TAU,r=Math.sqrt(v),p=lensPoint(a,r),dr=lensPoint(a,Math.min(1,r+.001)).sub(lensPoint(a,Math.max(.0001,r-.001))),da=lensPoint(a+.001,r).sub(lensPoint(a-.001,r)),n=dr.cross(da).normalize();return {p:p.addScaledVector(n,.003),n};},6500,'#f3c64c',side+57,.043,new THREE.Vector3(.20,1,0),.23);
  }

  // Diagonal woven cord and the soft square flower pocket from the master.
  const strapPoints=[[-.25,.713,.254],[-.20,.631,.309],[-.04,.518,.338],[.15,.408,.338],[.294,.337,.334]].map(p=>new THREE.Vector3(...p));
  for(const offset of [-.008,0,.008])yarn(body,strapPoints.map(p=>p.clone().add(new THREE.Vector3(offset,-offset,0))),.0075,cream,40);
  const strapCurve=new THREE.CatmullRomCurve3(strapPoints);fibers(body,(u,v)=>{const p=strapCurve.getPoint(u),n=new THREE.Vector3(Math.cos(v*TAU)*.7,Math.sin(v*TAU)*.7,.7).normalize();p.addScaledVector(n,.013);return {p,n};},1900,'#e8dccb',144,.023,null,.30);
  function pocketWrinkles(p){if(p.z>0){const front=p.z/.057,envelope=Math.max(0,1-(p.y/.15)**2);p.z+=front*envelope*(Math.sin(p.x*39+p.y*8)*.0045-.007*Math.exp(-Math.pow((p.x+.035+p.y*.26)/.023,2)));}return p;}
  const pocket=ellipsoid(body,[.148,.150,.057],[.283,.288,.325],cream,{power:.72,hair:4200,seed:91,deform:pocketWrinkles});
  const pocketRim=[[-.124,.156,.032],[-.063,.143,.057],[0,.133,.063],[.064,.143,.057],[.124,.156,.032]].map(p=>new THREE.Vector3(...p));yarn(pocket,pocketRim,.015,creamHem,36);
  const lining=cloth('#a99684',{sheen:.1,normal:.10}),mouthCurve=new THREE.CatmullRomCurve3(pocketRim);
  add(pocket,parametric((u,v)=>{const p=mouthCurve.getPoint(u);p.y+=.006+v*.019;p.z-=.012+v*.020;return p;},36,5),lining).material.side=THREE.DoubleSide;
  const backLip=pocketRim.map(p=>p.clone().add(new THREE.Vector3(0,.024,-.026)));yarn(pocket,backLip,.010,creamHem,36);
  fibers(pocket,(u,v)=>{const p=mouthCurve.getPoint(u),n=new THREE.Vector3(0,Math.sin(v*TAU),Math.cos(v*TAU));p.addScaledVector(n,.015);return {p,n};},1200,'#cbb9a5',94,.024,null,.23);
  const pocketSeam=Array.from({length:41},(_,i)=>{const a=Math.PI+i/40*Math.PI;return new THREE.Vector3(Math.cos(a)*.122,Math.sin(a)*.147+.006,.055);});yarn(pocket,pocketSeam,.003,creamHem,48);
  const stem=[new THREE.Vector3(.307,.405,.356),new THREE.Vector3(.300,.484,.360),new THREE.Vector3(.312,.557,.344)];yarn(body,stem,.014,green,24);
  ellipsoid(body,[.027,.060,.011],[.328,.457,.366],green,{rotation:-.36,power:.86});
  const flower=new THREE.Group();flower.position.set(.312,.548,.369);flower.rotation.z=.16;body.add(flower);
  const flowerShape=new THREE.Shape();for(let i=0;i<=100;i++){const angle=i/100*TAU,r=.068+.022*Math.cos(angle*5),x=Math.sin(angle)*r,y=Math.cos(angle)*r;if(i===0)flowerShape.moveTo(x,y);else flowerShape.lineTo(x,y);}flowerShape.closePath();
  add(flower,new THREE.ExtrudeGeometry(flowerShape,{depth:.010,steps:1,bevelEnabled:true,bevelThickness:.004,bevelSize:.003,bevelSegments:2,curveSegments:12}),petal);
  fibers(flower,(u,v)=>{const a=u*TAU,r=(.068+.022*Math.cos(a*5))*Math.sqrt(v);return {p:new THREE.Vector3(Math.sin(a)*r,Math.cos(a)*r,.015),n:new THREE.Vector3(0,0,1)};},500,'#d9d1c1',148,.012,null,.22);
  ellipsoid(flower,[.024,.028,.012],[0,0,.017],yellow,{power:.9});

  function setQuality(value){
    quality=value==='low'?'low':value==='high'?'high':'balanced';
    // Every level uses the same distributed strand prefix and full felt maps.
    // Modest alpha compensation preserves the material when strands are culled,
    // without turning the low mode into opaque, wiry individual hairs.
    const density=quality==='low'?.42:quality==='high'?1:.75;
    for(const layer of fiberLayers){layer.geometry.setDrawRange(0,Math.floor(layer.count*density/6)*6);layer.material.opacity=layer.opacity*(1+(1-density)*.65);}
    return quality;
  }
  function update(seconds=0,{reducedMotion=false,greeting=-1}={}){
    if(disposed)return;const hello=!reducedMotion&&greeting>=0&&greeting<1.2;
    // The eyes remain whole felt ovals. Breathing never reshapes the helmet.
    group.scale.set(1,reducedMotion?1:1+Math.sin(seconds*1.22+2)*.0018,1);
    group.rotation.x=hello?Math.sin(greeting/1.2*Math.PI)*.035:0;
    group.rotation.z=hello?Math.sin(greeting/1.2*TAU)*.013:0;
    arms.forEach((arm,i)=>{const side=i===0?-1:1;arm.rotation.z=side*.49+(hello&&i===1?Math.sin(greeting/1.2*Math.PI)*-.12:0);});
  }
  function metrics(){return {id:'marin',revision:8,improvementPass:5,proportionRevision:1,actual3D:true,productionAsset:false,contract:'marin-4k-connected-body-ratios-v2',quality,dimensions:{height:HEIGHT,width:WIDTH,widthToHeight:WIDTH/HEIGHT,helmetHeight:HEAD_HEIGHT,helmetHeightRatio:HEAD_HEIGHT/HEIGHT,helmetDepthRatio:HEAD_DEPTH,eyeWidth:EYE_WIDTH,eyeWidthRatio:EYE_WIDTH/WIDTH,eyeHeightRatio:EYE_HEIGHT/EYE_WIDTH,eyeCenterSpacing:EYE_SPACING,eyeSpacingRatio:EYE_SPACING/EYE_WIDTH,eyeHeightFromTop:.468062,bodyForwardOffset:body.position.z,torsoWidth:.920,armCenterSpacing:1.060},eyeMaterial:'matte-yellow-felt-without-pupil-or-highlight',ownedResources:{geometries:geometrySet.size,materials:materialSet.size,textures:textureSet.size},disposed};}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometrySet.forEach(g=>g.dispose());materialSet.forEach(m=>m.dispose());textureSet.forEach(t=>t.dispose());}
  setQuality(quality);return {group,update,setQuality,metrics,dispose};
}

export default createMarinHomeAvatar;
