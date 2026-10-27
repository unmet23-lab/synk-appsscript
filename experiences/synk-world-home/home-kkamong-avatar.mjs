import * as THREE from './scene-assets/three.module.js';

// Body-only reconstruction from the approved front master. The crown and
// belly anchors exclude ears, wings, tail and all decorative fibres.
const TAU=Math.PI*2;
const BODY_HEIGHT_SCALE=.95;
// The felt master's widths are measured directly into the profile; this stays 1 for the ears, eyes and sleeves.
const BODY_WIDTH_SCALE=1;
const homeHeight=y=>.280+(y-.280)*BODY_HEIGHT_SCALE;
const BODY={crownY:homeHeight(1.980),groundY:.280,height:1.700*BODY_HEIGHT_SCALE,centerX:0};
// The felt master's bead eyes: centres .26 of the height apart, 27% down from the crown, a little over .1 of the height wide (the fuzz halo eats into the edge).
const EYES={x:.2096,y:1.457,r:.091,pupilRatio:.72};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// [height, half width, front depth, back depth, horizontal centre, depth centre]
// 10-27: rows measured from the felt master (정본_4K/까몽_본체.png): half width over the crown-to-floor height,
// widths ×.95 like the heights — a round head (an ellipse to the eye line: its ears only cover the crown's
// corners), a clearly pinched neck and a round belly, like a snowman. Wings and tail excluded.
const BODY_PROFILE=[
 [0.280000,0.000000,0,0,0,0],
 [0.297000,0.129200,0,0,0,0],
 [0.322500,0.206720,0,0,0,0],
 [0.365000,0.290700,0,0,0,0],
 [0.407500,0.350455,0,0,0,0],
 [0.450000,0.411825,0,0,0,0],
 [0.492500,0.447355,0,0,0,0],
 [0.535000,0.474810,0,0,0,0],
 [0.620000,0.510340,0,0,0,0],
 [0.705000,0.524875,0,0,0,0],
 [0.790000,0.524875,0,0,0,0],
 [0.875000,0.513570,0,0,0,0],
 [0.960000,0.476425,0,0,0,0],
 [1.028000,0.458660,0,0,0,0],
 [1.079000,0.461890,0,0,0,0],
 [1.130000,0.478040,0,0,0,0],
 [1.215000,0.513570,0,0,0,0],
 [1.300000,0.545870,0,0,0,0],
 [1.385000,0.565250,0,0,0,0],
 [1.470000,0.573325,0,0,0,0],
 [1.555000,0.565306,0,0,0,0],
 [1.640000,0.540536,0,0,0,0],
 [1.708000,0.507068,0,0,0,0],
 [1.759000,0.472389,0,0,0,0],
 [1.810000,0.427331,0,0,0,0],
 [1.844000,0.389786,0,0,0,0],
 [1.878000,0.343995,0,0,0,0],
 [1.912000,0.286025,0,0,0,0],
 [1.946000,0.205830,0,0,0,0],
 [1.963000,0.146793,0,0,0,0],
 [1.980000,0.000000,0,0,0,0]
].map(row=>[homeHeight(row[0]),...row.slice(1)]);
function bodySectionAt(y){
 const value=profileAt(BODY_PROFILE,y),t=clamp((y-BODY.groundY)/BODY.height,0,1),ease=t*t*(3-2*t);
 // The felt toy is round in section: its depth follows the width, so the head, the waist under the arms
 // and the belly read from the side and three-quarter views as well as from the front.
 value[2]=.84*value[1]+.018*Math.exp(-(((t-.33)/.20)**2))*Math.sin(t*Math.PI);value[3]=.74*value[1];value[4]=.015*(1-ease);value[5]=-.100+.106*ease;
 value[1]*=BODY_WIDTH_SCALE;value[4]*=BODY_WIDTH_SCALE;
 return value;
}

const splineProfiles=new WeakMap();
function profileAt(profile,y){
 let state=splineProfiles.get(profile);
 if(!state){
  // Uniform cubic B-spline stays inside its neighbouring control hull. It
  // smooths uncertain fur-edge measurements without Catmull overshoot or
  // an abrupt second derivative at every measured row.
  const controls=[profile[0],profile[0],...profile,profile.at(-1),profile.at(-1)],spans=controls.length-3;
  const at=u=>{
   const scaled=clamp(u,0,1)*spans,index=Math.min(spans-1,Math.floor(scaled)),t=scaled-index;
   const weights=[(1-t)**3/6,(3*t**3-6*t*t+4)/6,(-3*t**3+3*t*t+3*t+1)/6,t**3/6],value=[];
   for(let c=0;c<6;c++)value.push(weights.reduce((sum,w,i)=>sum+w*controls[index+i][c],0));
   return value;
  };
  const raw=target=>{let lo=0,hi=1;for(let i=0;i<25;i++){const mid=(lo+hi)/2;if(at(mid)[0]<target)lo=mid;else hi=mid;}const result=at((lo+hi)/2);result[0]=target;return result;};
  const start=profile[0][0],end=profile.at(-1)[0],capLength=Math.min(.045,(end-start)*.09),caps=[];
  for(const direction of [1,-1]){
   const endpoint=direction===1?profile[0]:profile.at(-1),join=(direction===1?start:end)+direction*capLength,point=raw(join),before=raw(join-.0001),after=raw(join+.0001),entries=[];
   for(let c=1;c<=3;c++){
    if(endpoint[c]!==0){entries[c]=null;continue;}
    const r=point[c],slope=(after[c]-before[c])/.0002*direction;
    let a=(2*r*r-2*r*slope*capLength)/capLength,b=(2*r*slope*capLength-r*r)/(capLength*capLength);
    if(a<=0){a=r*r/capLength;b=0;}
    entries[c]={a,b};
   }
   caps.push({direction,endpoint:endpoint[0],length:capLength,entries});
  }
  state={raw,caps};splineProfiles.set(profile,state);
 }
 const value=state.raw(y);
 // sqrt caps have a horizontal tangent at the pole instead of a finite-slope
 // cone. Their value and slope match the loft where the cap joins it.
 for(const cap of state.caps){const t=(y-cap.endpoint)*cap.direction;if(t<0||t>cap.length)continue;for(let c=1;c<=3;c++){const entry=cap.entries[c];if(entry)value[c]=Math.sqrt(Math.max(0,entry.a*t+entry.b*t*t));}}
 return value;
}

function verticalLoft(profile,{radial=72,rows=96}={}){
 // A single, explicit cross-section outline. Features are separate meshes and
 // cannot change the body profile, eye spacing or the crown/belly anchors.
 const positions=[],uvs=[],indices=[],bottom=profile===BODY_PROFILE?bodySectionAt(profile[0][0]):profile[0],top=profile===BODY_PROFILE?bodySectionAt(profile.at(-1)[0]):profile.at(-1),rings=[];
 const add=(x,y,z,u,v)=>{const i=positions.length/3;positions.push(x,y,z);uvs.push(u,v);return i;};
 const bottomPole=add(bottom[4],bottom[0],bottom[5],.5,0);
 for(let row=1;row<=rows;row++){
  const t=row/rows,y=bottom[0]+(top[0]-bottom[0])*(.5-.5*Math.cos(Math.PI*t)),p=profile===BODY_PROFILE?bodySectionAt(y):profileAt(profile,y),ring=[];
  if(p[1]<1e-7)continue;
  for(let j=0;j<=radial;j++){
   const angle=-Math.PI+j/radial*TAU,s=Math.sin(angle),c=Math.cos(angle);
   ring.push(add(p[4]+p[1]*s,y,p[5]+(c>=0?p[2]:p[3])*c,j/radial,(y-bottom[0])/(top[0]-bottom[0])));
  }
  rings.push(ring);
 }
 for(let j=0;j<radial;j++)indices.push(bottomPole,rings[0][j+1],rings[0][j]);
 for(let row=0;row<rings.length-1;row++)for(let j=0;j<radial;j++){
  const a=rings[row][j],b=rings[row][j+1],c=rings[row+1][j],d=rings[row+1][j+1];indices.push(a,b,c,b,d,c);
 }
 const last=rings.at(-1),topPole=add(top[4],top[0],top[5],.5,1);
 for(let j=0;j<radial;j++)indices.push(topPole,last[j],last[j+1]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 // Duplicated UV seam vertices share one smooth normal; the seam is at the back.
 const normals=geometry.getAttribute('normal');for(const ring of rings){const a=ring[0],b=ring.at(-1),normal=new THREE.Vector3().fromBufferAttribute(normals,a).add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,normal.x,normal.y,normal.z);normals.setXYZ(b,normal.x,normal.y,normal.z);}
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function earGeometry(side,low){
 // A cat's ear on the round crown: the outer edge nearly upright and continuing down into the side of the head,
 // the inner edge sloping in, the tip a soft point (the felt master's front view, raw heights).
 const profile=[
  [1.708,0.040,0.028,0.022,side*0.400,-0.020],
  [1.776,0.085,0.059,0.047,side*0.375,-0.026],
  [1.861,0.135,0.095,0.074,side*0.335,-0.031],
  [1.946,0.158,0.111,0.087,side*0.305,-0.037],
  [1.997,0.150,0.105,0.083,side*0.298,-0.042],
  [2.039,0.118,0.083,0.065,side*0.300,-0.048],
  [2.074,0.084,0.059,0.046,side*0.312,-0.054],
  [2.099,0.046,0.032,0.025,side*0.332,-0.059],
  [2.119,0.000,0.000,0.000,side*0.348,-0.065]
 ].map(row=>[homeHeight(row[0]),row[1],row[2],row[3],row[4]*BODY_WIDTH_SCALE,row[5]]);
 return verticalLoft(profile,{radial:low?28:48,rows:low?28:44});
}
// 10-27: the felt master's small dragon wings, which replaced the raised arms. A brown felt bone runs from the
// shoulder up to a rounded elbow and out to the tip, one rib hangs from the elbow to the middle scallop, and a
// olive felt membrane fills below with a softly scalloped lower edge. Points are the master's front view [x, y];
// the wing plane is swept back from its root so the three-quarter view sees it at an angle.
const WING={root:[.540,1.322],knob:[.669,1.452],tip:[.895,1.262],rib:[.730,1.110],low:[.568,1.055],attach:[.470,1.077],sweep:.14,z:-.06,bone:.046,elbow:.060,ribRadius:.024};
function wingFrame(side){
 // Front-view points to world space: the outward distance is stretched by 1/cos(sweep), then the plane turns back.
 const c=Math.cos(WING.sweep),matrix=new THREE.Matrix4().makeRotationY(side*WING.sweep).premultiply(new THREE.Matrix4().makeTranslation(side*WING.root[0],0,WING.z));
 const local=([x,y],z=0)=>new THREE.Vector3(side*(x-WING.root[0])/c,y,z);
 return {matrix,local,world:(point,z=0)=>local(point,z).applyMatrix4(matrix)};
}
function wingMembraneGeometry(side,low){
 const {local,matrix}=wingFrame(side),at=point=>{const v=local(point);return new THREE.Vector2(v.x,v.y);},mid=(a,b,t,lift)=>{const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;return [x+lift[0],y+lift[1]];};
 const shape=new THREE.Shape();shape.moveTo(...at(WING.attach).toArray());
 shape.lineTo(...at(WING.root).toArray());
 shape.quadraticCurveTo(...at([.600,1.430]).toArray(),...at(WING.knob).toArray());
 shape.quadraticCurveTo(...at([.790,1.400]).toArray(),...at(WING.tip).toArray());
 // Each scallop bows up and inwards between two points of the lower edge.
 shape.quadraticCurveTo(...at(mid(WING.tip,WING.rib,.5,[-.065,.105])).toArray(),...at(WING.rib).toArray());
 shape.quadraticCurveTo(...at(mid(WING.rib,WING.low,.5,[-.018,.085])).toArray(),...at(WING.low).toArray());
 shape.quadraticCurveTo(...at(mid(WING.low,WING.attach,.5,[.010,.030])).toArray(),...at(WING.attach).toArray());
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.026,bevelEnabled:true,bevelThickness:.014,bevelSize:.012,bevelSegments:low?2:4,curveSegments:low?6:14});
 const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*7,uv.getY(i)*7);
 geometry.translate(0,0,-.013);geometry.applyMatrix4(matrix);geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}
function wingTube(side,points,radius,low){
 // A felt bone or rib: a round tube whose closed end is rounded; the root end stays buried in the body.
 const {world}=wingFrame(side),curve=new THREE.CatmullRomCurve3(points.map(point=>world(point))),segments=low?16:30,radial=low?10:14;
 const geometry=new THREE.TubeGeometry(curve,segments,1,radial,false),position=geometry.getAttribute('position');
 for(let segment=0;segment<=segments;segment++){
  const t=segment/segments,center=curve.getPointAt(t),scale=Math.max(.002,radius(t)*Math.sqrt(clamp((1-t)/.10,0,1)));
  for(let ring=0;ring<=radial;ring++){const i=segment*(radial+1)+ring;position.setXYZ(i,center.x+(position.getX(i)-center.x)*scale,center.y+(position.getY(i)-center.y)*scale,center.z+(position.getZ(i)-center.z)*scale);}
 }
 geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}
function wingBoneGeometry(side,low){
 // Thicker at the rounded elbow, a little thinner out to the tip.
 const elbowT=.42;
 const past=[WING.tip[0]+.022,WING.tip[1]-.010];
 return wingTube(side,[[WING.root[0]-.070,WING.root[1]-.040],WING.root,[.610,1.410],WING.knob,[.775,1.392],WING.tip,past],t=>WING.bone+(WING.elbow-WING.bone)*Math.exp(-(((t-elbowT)/.11)**2))-.006*t,low);
}
function wingRibGeometry(side,low){
 return wingTube(side,[[WING.knob[0]-.010,WING.knob[1]-.030],[.700,1.300],[.712,1.200],WING.rib],t=>WING.ribRadius*(1-.25*t),low);
}

// 10-27: the felt master's dragon tail — out of the lower right side, a thick round root that tapers in a
// gentle S to a soft rounded point. The olive felt spikes on its ridge are separate meshes (placeSpikes).
const TAIL_CURVE=[[.30,.80,-.20],[.55,.745,-.25],[.78,.655,-.235],[.95,.630,-.175],[1.06,.700,-.110],[1.105,.775,-.075]];
const tailRadius=t=>Math.max(.006,.200*Math.pow(1-t,.45)*(1-.25*t));
function tailCurve(){return new THREE.CatmullRomCurve3(TAIL_CURVE.map(p=>new THREE.Vector3(...p)));}
function tailGeometry(low=false){
 const curve=tailCurve(),segments=low?28:44,radial=low?12:18,geometry=new THREE.TubeGeometry(curve,segments,1,radial,false),position=geometry.getAttribute('position');
 for(let segment=0;segment<=segments;segment++){
  const t=segment/segments,center=curve.getPointAt(t),scale=tailRadius(t);
  for(let ring=0;ring<=radial;ring++){const i=segment*(radial+1)+ring;position.setXYZ(i,center.x+(position.getX(i)-center.x)*scale,center.y+(position.getY(i)-center.y)*scale,center.z+(position.getZ(i)-center.z)*scale);}
 }
 geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}
// Five soft felt spikes, largest near the root: rounded triangles lathed round and pressed thin across the tail.
const TAIL_SPIKES=[[.20,.138,.130],[.34,.118,.114],[.48,.098,.098],[.61,.080,.083],[.73,.062,.068]];
function spikeGeometry(low){
 const outline=[[1,0],[.97,.14],[.80,.38],[.52,.66],[.24,.89],[.08,.98],[0,1]].map(([r,y])=>new THREE.Vector2(r*.5,y));
 const geometry=new THREE.LatheGeometry(outline,low?10:16);geometry.scale(1,1,.42);geometry.computeVertexNormals();return geometry;
}
function placeSpikes(parent,attachSpike){
 const curve=tailCurve(),up=new THREE.Vector3(),tangent=new THREE.Vector3(),side=new THREE.Vector3(),basis=new THREE.Matrix4();
 for(const [t,height,length] of TAIL_SPIKES){
  const center=curve.getPointAt(t);tangent.copy(curve.getTangentAt(t));
  up.set(0,1,0).addScaledVector(tangent,-tangent.y).normalize();side.crossVectors(tangent,up).normalize();
  const spike=attachSpike(parent);basis.makeBasis(tangent,up,side);spike.quaternion.setFromRotationMatrix(basis);
  spike.scale.set(length,height,length);spike.position.copy(center).addScaledVector(up,tailRadius(t)*.86);
 }
}

function coatNoise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz;
 const smooth=t=>t*t*(3-2*t),u=smooth(fx),v=smooth(fy),w=smooth(fz);
 const hash=(a,b,c)=>{let n=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,2147483647);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 let value=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)value+=hash(ix+a,iy+b,iz+c)*(a?u:1-u)*(b?v:1-v)*(c?w:1-w);return value;
}
function seeded(seed){let state=seed>>>0;return()=>{state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

function earShade(x,y,normalZ){
 return 1-.42*Math.exp(-(((Math.abs(x)-.300)/.075)**2+((y-homeHeight(2.000))/(.085*BODY_HEIGHT_SCALE))**2))*clamp(normalZ*2.2,0,1);
}

// Felt (10-27, after the family's diorama Mongle): the felt master is matted needle felt with loose wool-roving
// wisps, not a standing pile. The surface takes the shared photographed felt (felt-coral.webp) by luminance only,
// remapped to the master's cocoa fibres, over the wool normal map; a thin halo of short translucent fibres
// softens the outline. Vertex colours carry a soft cloudy mottle, the ears' darker inside and the neck's shade.
const FELT={dark:'#221715',light:'#76594c',wingDark:'#4a6127',wingLight:'#b9d07c',range:[.20,.42],fuzz:{body:[7200,3800],ear:[460,240],tail:[1200,640],bone:[300,160],rib:[90,50],membrane:[280,150]},length:[.012,.042],opacity:.34};
const FUZZ_BROWN=['#3a2925','#4d3a34','#5f4a42','#7a5d50','#8f7061','#6c605d','#7a4c3c'],FUZZ_OLIVE=['#5d7a32','#88a64a','#bdd388'];
function feltShade(geometry,{body=false,ear=false}={}){
 const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),colors=new Float32Array(position.count*3);
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i),mottle=.93+.14*coatNoise(x*6.5+3,y*6.5,z*6.5-2);
  // The master's neck sits in the shade of the head and the wings; its belly is a little darker than the crown.
  const neck=body?1-.30*Math.exp(-(((y-homeHeight(1.075))/.10)**2)):1,height=body?.84+.20*clamp((y-.5)/1.3,0,1):1;
  const shade=mottle*neck*height*(ear?earShade(x,y,normal.getZ(i)):1);colors[i*3]=colors[i*3+1]=colors[i*3+2]=shade;
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}
function feltFuzz(geometry,{count,seed=1,palette=FUZZ_BROWN,length=FELT.length,skip=()=>false}){
 // Fibre roots spread over the surface by area; each fibre leans along the felt in two short bent segments.
 const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),index=geometry.index,faces=Math.floor((index?index.count:position.count)/3),areas=new Float64Array(faces),vertex=i=>index?index.getX(i):i;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();let total=0;
 for(let face=0;face<faces;face++){a.fromBufferAttribute(position,vertex(face*3));b.fromBufferAttribute(position,vertex(face*3+1));c.fromBufferAttribute(position,vertex(face*3+2));total+=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;areas[face]=total;}
 const random=seeded(seed),positions=[],colors=[],point=new THREE.Vector3(),n=new THREE.Vector3(),nb=new THREE.Vector3(),nc=new THREE.Vector3(),side=new THREE.Vector3(),start=new THREE.Vector3(),middle=new THREE.Vector3(),end=new THREE.Vector3(),colour=new THREE.Color();
 for(let k=0;k<count&&total>0;k++){
  const target=random()*total;let lo=0,hi=faces-1;while(lo<hi){const mid=(lo+hi)>>1;if(areas[mid]<target)lo=mid+1;else hi=mid;}
  let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}const w=1-u-v,ia=vertex(lo*3),ib=vertex(lo*3+1),ic=vertex(lo*3+2);
  point.fromBufferAttribute(position,ia).multiplyScalar(w).addScaledVector(b.fromBufferAttribute(position,ib),u).addScaledVector(c.fromBufferAttribute(position,ic),v);
  n.fromBufferAttribute(normal,ia).multiplyScalar(w).addScaledVector(nb.fromBufferAttribute(normal,ib),u).addScaledVector(nc.fromBufferAttribute(normal,ic),v).normalize();
  if(skip(point,n))continue;
  side.set(random()-.5,random()-.5,random()-.5).cross(n).normalize();
  const len=length[0]+random()*(length[1]-length[0]),bend=(random()-.5)*.9;
  start.copy(point).addScaledVector(n,.002);middle.copy(start).addScaledVector(n,len*.5).addScaledVector(side,len*(.30+bend*.5));end.copy(start).addScaledVector(n,len*.85).addScaledVector(side,len*(.60+bend));
  positions.push(start.x,start.y,start.z,middle.x,middle.y,middle.z,middle.x,middle.y,middle.z,end.x,end.y,end.z);
  colour.set(palette[Math.floor(random()*palette.length)]);for(let q=0;q<4;q++)colors.push(colour.r,colour.g,colour.b);
 }
 const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));lines.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));lines.computeBoundingSphere();return lines;
}

export function createKkamongHomeAvatar({kit,low=false,grounded=false,onInvalidate=()=>{},surface='fur'}={}){
 if(!kit?.feltBrown)throw new TypeError('Kkamong requires the shared home material kit');
 const group=new THREE.Group();group.name='living-home-kkamong';group.userData.characterContract='kkamong-profile-shape-review-v1';
 const ownedGeometry=new Set(),ownedMaterials=new Set(),ownedTextures=new Set(),meshes=[],eyes=[],fuzz=[],wings=[],lineGeometries=new Set();
 let disposed=false,quality=low?'low':'balanced',currentSurface='clay';
 function material(base,color,changes={}){const value=base.clone();if(color)value.color.set(color);Object.assign(value,changes);ownedMaterials.add(value);return value;}
 // The shared photographed felt, loaded once; every part's felt material keeps its own repeat of it.
 const feltReady={value:0},feltMaps=[],feltSource=typeof document==='undefined'?null:new THREE.TextureLoader().load(new URL('./assets/felt-coral.webp',import.meta.url).href,()=>{if(disposed)return;for(const map of feltMaps)map.needsUpdate=true;feltReady.value=1;onInvalidate();},undefined,()=>{});
 if(feltSource)ownedTextures.add(feltSource);
 function feltMap(repeatU,repeatV){if(!feltSource)return null;const map=feltSource.clone();map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeatU,repeatV);map.anisotropy=4;feltMaps.push(map);ownedTextures.add(map);return map;}
 function cocoaFelt(repeatU,repeatV,key,{base=kit.feltBrown,dark=FELT.dark,light=FELT.light,sheen='#8c7062',vertexColors=true}={}){
  const value=material(base,'#ffffff',{roughness:1,sheen:.45,sheenRoughness:.86,vertexColors,map:feltMap(repeatU,repeatV)});value.sheenColor.set(sheen);
  value.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{uFeltReady:feltReady,uFeltDark:{value:new THREE.Color(dark)},uFeltLight:{value:new THREE.Color(light)},uFeltRange:{value:new THREE.Vector2(...FELT.range)}});
   shader.fragmentShader='uniform float uFeltReady;\nuniform vec3 uFeltDark,uFeltLight;\nuniform vec2 uFeltRange;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    // The felt photo's fibres by luminance only, remapped to the master's dark cocoa and its warm light fibres.
    float feltL=mix(.5*(uFeltRange.x+uFeltRange.y),dot(texture2D(map,vMapUv).rgb,vec3(.299,.587,.114)),uFeltReady);
    diffuseColor.rgb*=mix(uFeltDark,uFeltLight,smoothstep(uFeltRange.x,uFeltRange.y,feltL));
   #else
    diffuseColor.rgb*=mix(uFeltDark,uFeltLight,.5);
   #endif`);
  };
  value.customProgramCacheKey=()=>`kkamong-cocoa-felt-${key}`;return value;
 }
 const bodyMaterial=cocoaFelt(6,3,'body'),earMaterial=cocoaFelt(2,1,'ear'),tailMaterial=cocoaFelt(3,2,'tail'),boneMaterial=cocoaFelt(1.5,1,'bone');
 const brownFelt=new Set([bodyMaterial,earMaterial,tailMaterial,boneMaterial]);
 const clay=new THREE.MeshStandardMaterial({color:'#aaa398',roughness:.88,metalness:0});
 const silhouette=new THREE.MeshBasicMaterial({color:'#131313'});ownedMaterials.add(clay);ownedMaterials.add(silhouette);
 // The wing membranes and tail spikes: the same felt photo remapped to the olive of the master's eyes (10-27,
 // so Kkamong keeps its own colour next to coral Mongle and navy Marin).
 const wingFelt=cocoaFelt(.6,.6,'olive',{base:kit.feltBrown,dark:FELT.wingDark,light:FELT.wingLight,sheen:'#d6e2b0',vertexColors:false});
 function attach(geometry,mat,parent=group,{name='',eye=false}={}){ownedGeometry.add(geometry);const object=new THREE.Mesh(geometry,mat);object.name=name;object.castShadow=object.receiveShadow=true;parent.add(object);meshes.push({object,original:mat,eye});return object;}
 function ellipsoidMesh(radii,mat,position,parent=group,segments=32,eye=false){const object=attach(new THREE.SphereGeometry(1,segments,Math.max(12,Math.floor(segments*.68))),mat,parent,{eye});object.scale.set(...radii);object.position.set(...position);return object;}
 const body=feltShade(verticalLoft(BODY_PROFILE,{radial:low?48:80,rows:low?64:104}),{body:true});attach(body,bodyMaterial,group,{name:'kkamong-anatomical-body'});
 for(const side of [-1,1]){
  const name=side<0?'left':'right';attach(feltShade(earGeometry(side,low),{ear:true}),earMaterial,group,{name:`kkamong-${name}-rounded-ear`});
  const wing=new THREE.Group();wing.name=`kkamong-${name}-wing`;group.add(wing);wings.push(wing);
  attach(wingMembraneGeometry(side,low),wingFelt,wing,{name:`kkamong-${name}-wing-membrane`});
  attach(feltShade(wingBoneGeometry(side,low)),boneMaterial,wing,{name:`kkamong-${name}-wing-bone`});attach(feltShade(wingRibGeometry(side,low)),boneMaterial,wing,{name:`kkamong-${name}-wing-rib`});
 }
 const tailRoot=new THREE.Group();tailRoot.name='kkamong-soft-tail';group.add(tailRoot);
 attach(feltShade(tailGeometry(low)),tailMaterial,tailRoot,{name:'kkamong-fabric-tail'});
 const spikeShape=spikeGeometry(low);ownedGeometry.add(spikeShape);
 let spikeIndex=0;placeSpikes(tailRoot,parent=>{const spike=new THREE.Mesh(spikeShape,wingFelt);spike.name=`kkamong-tail-spike-${++spikeIndex}`;spike.castShadow=spike.receiveShadow=true;parent.add(spike);meshes.push({object:spike,original:wingFelt,eye:false});return spike;});
 const iris=new THREE.MeshPhysicalMaterial({color:'#86a446',emissive:'#86a446',emissiveIntensity:.06,roughness:.23,clearcoat:1,clearcoatRoughness:.12,ior:1.48,metalness:0});
 const pupil=new THREE.MeshPhysicalMaterial({color:'#09080a',roughness:.10,clearcoat:1,clearcoatRoughness:.06,ior:1.5,metalness:0});
 const glint=new THREE.MeshBasicMaterial({color:'#fff9ee'});ownedMaterials.add(iris);ownedMaterials.add(pupil);ownedMaterials.add(glint);
 const eyeProfile=bodySectionAt(EYES.y),eyeZ=eyeProfile[5]+eyeProfile[2]*Math.sqrt(1-(EYES.x/eyeProfile[1])**2)-.029;
 for(const side of [-1,1]){
  const eye=new THREE.Group();eye.name=`kkamong-${side<0?'left':'right'}-olive-eye`;eye.position.set(side*EYES.x,EYES.y-side*.00155,eyeZ);eye.rotation.y=-side*.14;group.add(eye);eyes.push(eye);
  ellipsoidMesh([EYES.r,EYES.r*1.10,.079],iris,[0,0,0],eye,40,true);
  const pr=EYES.r*EYES.pupilRatio;ellipsoidMesh([pr,pr*1.10,.018],pupil,[0,0,.067],eye,36,true);
  const g=EYES.r/.095;ellipsoidMesh([.0205*g,.022*g,.006],glint,[-.027*g,.032*g,.086],eye,16,true);
 }
 const eyeCentres=eyes.map(eye=>eye.position.clone());
 // The fuzz halo: brown on the felt parts, olive on the wing membranes; none over the eyes or under the floor line.
 const fuzzMaterial=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:FELT.opacity,depthWrite:false});ownedMaterials.add(fuzzMaterial);
 let fuzzFibres=0;
 for(const record of meshes.filter(record=>brownFelt.has(record.original)||record.object.name.includes('wing-membrane'))){
  const {object}=record,name=object.name,kind=name==='kkamong-anatomical-body'?'body':name.includes('rounded-ear')?'ear':name==='kkamong-fabric-tail'?'tail':name.includes('wing-membrane')?'membrane':name.includes('wing-rib')?'rib':'bone';
  const floorY=grounded?BODY.groundY+.03:-Infinity,eyeR=EYES.r*1.2;
  const geometry=feltFuzz(object.geometry,{count:FELT.fuzz[kind][low?1:0],seed:17+fuzz.length*31,palette:kind==='membrane'?FUZZ_OLIVE:FUZZ_BROWN,length:kind==='body'||kind==='tail'?FELT.length:[.008,.024],skip:(point,normal)=>point.y<floorY||kind==='body'&&normal.z>.3&&eyeCentres.some(centre=>Math.hypot(point.x-centre.x,point.y-centre.y)<eyeR)});
  ownedGeometry.add(geometry);lineGeometries.add(geometry);fuzzFibres+=geometry.getAttribute('position').count/4;
  const lines=new THREE.LineSegments(geometry,fuzzMaterial);lines.name=`${name}-felt-fuzz`;lines.userData.decorativeFur=true;lines.raycast=()=>{};lines.frustumCulled=false;object.parent.add(lines);fuzz.push(lines);
 }
 function setSurface(mode){
  if(disposed)return currentSurface;currentSurface=['fur','clay','silhouette'].includes(mode)?mode:'clay';
  applySurface();
  onInvalidate();return currentSurface;
 }
 function applySurface(){
  for(const {object,original,eye} of meshes){object.material=currentSurface==='silhouette'?silhouette:currentSurface==='clay'&&!eye?clay:original;object.castShadow=currentSurface!=='silhouette';object.receiveShadow=currentSurface!=='silhouette';}
  for(const lines of fuzz)lines.visible=currentSurface==='fur';
 }
 // The felt has no per-quality layers; the fibre count is set once by the low allocation.
 function setQuality(level){if(disposed)return quality;quality=['low','balanced','high','detail'].includes(level)?level:'balanced';onInvalidate();return quality;
 }
 function update(seconds,{reducedMotion=false,greeting=-1}={}){
  if(disposed)return;const active=!reducedMotion&&greeting>=0&&greeting<1.25;
  group.scale.set(1,reducedMotion?1:1+Math.sin(seconds*1.28+.5)*.0022,1);group.rotation.x=active?Math.sin(greeting/1.25*Math.PI)*.045:0;group.rotation.z=active?Math.sin(greeting/1.25*TAU)*.021:0;
  const blink=(seconds+2.6)%6.7,open=!reducedMotion&&blink<.15?Math.max(.075,Math.abs(blink/.075-1)):1;for(const eye of eyes)eye.scale.y=open;
 }
 function metrics(){
  let geometryBytes=0,furBytes=0;for(const geometry of ownedGeometry){let bytes=geometry.index?.array.byteLength||0;for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;geometryBytes+=bytes;if(lineGeometries.has(geometry))furBytes+=bytes;}
  const triangles=meshes.reduce((sum,{object})=>sum+Math.floor((object.geometry.index?.count||object.geometry.getAttribute('position').count)/3),0);
  return {id:'kkamong',actual3D:true,productionAsset:false,contract:'kkamong-profile-shape-review-v1',revision:'olive-wings-r20',improvementPass:20,quality,surface:currentSurface,pose:grounded?'floor-rest':'reference',shapeMethod:'body-only-vertical-cross-section-loft',continuousBody:true,separateHands:false,anatomicalBounds:{...BODY,basis:'felt master silhouette with 5% shorter home body'},bodyBounds:{min:body.boundingBox.min.toArray(),max:body.boundingBox.max.toArray(),groundY:BODY.groundY},proportionAdjustment:{bodyHeightScale:BODY_HEIGHT_SCALE,roundHead:true,neckShade:true},eyes:{centerY:EYES.y,diameter:EYES.r*2,verticalDiameter:EYES.r*2.20,centerDistance:EYES.x*2,pupilRatio:EYES.pupilRatio,crownFraction:(BODY.crownY-EYES.y)/BODY.height,rotation:'gentle inward',centerZ:eyeZ},fur:{stage:'matted felt with a translucent fuzz halo',textureStatus:feltSource?'felt-coral luminance remapped to cocoa':'flat cocoa',textureLoaded:feltReady.value===1,fuzzFibres,segmentsPerFibre:2,geometryBytes:furBytes,lowAllocation:low},geometryBytes,triangles,lineSegments:fuzzFibres*2,disposed};
 }
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();ownedGeometry.forEach(value=>value.dispose());ownedMaterials.forEach(value=>value.dispose());ownedTextures.forEach(value=>value.dispose());group.clear();}
 // Initialise without requesting a frame from an owner that is still building.
 currentSurface=['fur','clay','silhouette'].includes(surface)?surface:'clay';applySurface();
 return {group,update,setQuality,setSurface,metrics,dispose};
}
