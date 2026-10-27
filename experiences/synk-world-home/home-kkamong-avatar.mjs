import * as THREE from './scene-assets/three.module.js';

// Body-only reconstruction from the approved front master. The crown and
// belly anchors exclude ears, wings, tail and all decorative fibres.
const TAU=Math.PI*2;
const BODY_HEIGHT_SCALE=.95;
// The felt master's widths are measured directly into the profile; this stays 1 for the ears, eyes and sleeves.
const BODY_WIDTH_SCALE=1;
const homeHeight=y=>.280+(y-.280)*BODY_HEIGHT_SCALE;
const BODY={crownY:homeHeight(1.980),groundY:.280,height:1.700*BODY_HEIGHT_SCALE,centerX:0};
// The felt master's bead eyes: centres .26 of the height apart, 27% down from the crown, .104 of the height wide.
const EYES={x:.2096,y:1.457,r:.084,pupilRatio:.72};
const EYE_COAT_SCALE=EYES.r/.092;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// [height, half width, front depth, back depth, horizontal centre, depth centre]
// 10-27: rows measured from the felt master (정본_4K/까몽_본체.png): half width over the crown-to-floor height,
// widths ×.95 like the heights — a broad head with a nearly flat crown between the ears, a slightly pinched
// waist and a round belly. Arms and tail excluded; the head under the raised arms is interpolated.
const BODY_PROFILE=[
 [0.280000,0.000000,0,0,0,0],
 [0.322500,0.201875,0,0,0,0],
 [0.365000,0.285855,0,0,0,0],
 [0.407500,0.348840,0,0,0,0],
 [0.450000,0.398259,0,0,0,0],
 [0.492500,0.428944,0,0,0,0],
 [0.535000,0.455430,0,0,0,0],
 [0.577500,0.473195,0,0,0,0],
 [0.620000,0.489345,0,0,0,0],
 [0.662500,0.499035,0,0,0,0],
 [0.705000,0.506302,0,0,0,0],
 [0.747500,0.507110,0,0,0,0],
 [0.790000,0.504687,0,0,0,0],
 [0.832500,0.506302,0,0,0,0],
 [0.875000,0.505495,0,0,0,0],
 [0.917500,0.495805,0,0,0,0],
 [0.960000,0.484500,0,0,0,0],
 [1.002500,0.471580,0,0,0,0],
 [1.045000,0.469965,0,0,0,0],
 [1.087500,0.479655,0,0,0,0],
 [1.130000,0.492575,0,0,0,0],
 [1.215000,0.520030,0,0,0,0],
 [1.300000,0.545870,0,0,0,0],
 [1.385000,0.568480,0,0,0,0],
 [1.453000,0.574940,0,0,0,0],
 [1.512500,0.566865,0,0,0,0],
 [1.555000,0.558790,0,0,0,0],
 [1.597500,0.550715,0,0,0,0],
 [1.640000,0.541025,0,0,0,0],
 [1.682500,0.516800,0,0,0,0],
 [1.725000,0.484500,0,0,0,0],
 [1.810000,0.444125,0,0,0,0],
 [1.878000,0.427975,0,0,0,0],
 [1.929000,0.395675,0,0,0,0],
 [1.954500,0.339150,0,0,0,0],
 [1.971500,0.242250,0,0,0,0],
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
 const profile=[
  [1.840,.020,.030,.030,side*.300,-.010],
  [1.900,.150,.120,.085,side*.296,-.020],
  [1.980,.158,.112,.080,side*.292,-.030],
  [2.014,.134,.094,.068,side*.296,-.040],
  [2.055,.104,.070,.052,side*.300,-.050],
  [2.075,.082,.058,.044,side*.310,-.055],
  // A cat's ear narrows to a rounded point, the outer edge nearly upright and the inner edge sloping in.
  [2.098,.040,.032,.026,side*.334,-.060],
  [2.118,0,0,0,side*.350,-.062]
 ].map(row=>[homeHeight(row[0]),row[1],row[2],row[3],row[4]*BODY_WIDTH_SCALE,row[5]]);
 return verticalLoft(profile,{radial:low?28:48,rows:low?28:44});
}
// 10-27: the felt master's small dragon wings, which replaced the raised arms. A brown felt bone runs from the
// shoulder up to a rounded elbow and out to the tip, one rib hangs from the elbow to the middle scallop, and a
// coral felt membrane fills below with a softly scalloped lower edge. Points are the master's front view [x, y];
// the wing plane is swept back from its root so the three-quarter view sees it at an angle.
const WING={root:[.540,1.322],knob:[.669,1.452],tip:[.895,1.262],rib:[.730,1.110],low:[.568,1.055],attach:[.470,1.077],sweep:.14,z:-.06,bone:.040,elbow:.054,ribRadius:.021};
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
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.020,bevelEnabled:true,bevelThickness:.010,bevelSize:.010,bevelSegments:low?1:3,curveSegments:low?6:14});
 const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*7,uv.getY(i)*7);
 geometry.translate(0,0,-.010);geometry.applyMatrix4(matrix);geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
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
// gentle S to a soft rounded point. The coral felt spikes on its ridge are separate meshes (tailSpikes).
const TAIL_CURVE=[[.30,.80,-.20],[.55,.745,-.25],[.78,.655,-.235],[.95,.630,-.175],[1.06,.700,-.110],[1.105,.775,-.075]];
const tailRadius=t=>Math.max(.006,.190*Math.pow(1-t,.5)*(1-.3*t));
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

function earShade(x,y,normalZ){
 return 1-.48*Math.exp(-(((Math.abs(x)-.272)/.080)**2+((y-homeHeight(2.025))/(.075*BODY_HEIGHT_SCALE))**2))*clamp(normalZ*2.2,0,1);
}

// Felt coat (10-27): the felt master (정본_4K/까몽_본체.png) is firm needle felt with loose wool-roving wisps.
// One instanced mesh per body part draws its core again in N offset layers. The lower layers keep a fine,
// dense nap (the felt); above it only sparse, coarser strands survive and lean as they rise — the roving
// wisps that soften the outline. Darker at the roots, warm at the tips, with a soft rim glow.
const FUR={length:.088,nap:.58,wisp:.22,gravity:.012,curl:.035,density:118,clump:3.6,root:'#1c1517',tip:'#5e4a45',glow:'#a08476',shells:{low:12,balanced:22,high:28,detail:28}};
// The wing membranes' coral felt gets the same coat, short, in its own colours (the small spikes keep the bare felt).
const CORAL_FELT={root:'#7a2e2a',tip:'#de7566',glow:'#f7b09e'};
function shellCoat(base,{eyes=[],eyeRadius=0,floorY=null,length=FUR.length,density=FUR.density,seed=0,low=false,colors=FUR}={}){
 const max=FUR.shells.high,material=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.96,metalness:0,alphaToCoverage:true});
 const uniforms={uFurLength:{value:length},uFurGravity:{value:FUR.gravity},uFurCurl:{value:FUR.curl},uFurDensity:{value:density},uFurClump:{value:FUR.clump},uFurNap:{value:FUR.nap},uFurWisp:{value:FUR.wisp},uFurShells:{value:low?FUR.shells.low:FUR.shells.balanced},uFurSeed:{value:seed},
  uFurFloor:{value:floorY===null?-1e4:floorY},uFurRoot:{value:new THREE.Color(colors.root)},uFurTip:{value:new THREE.Color(colors.tip)},uFurGlow:{value:new THREE.Color(colors.glow)},
  uFurEyes:{value:[0,1].map(i=>eyes[i]?.clone()||new THREE.Vector3(1e4,1e4,1e4))},uFurEyeR:{value:eyeRadius}};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='attribute float furScale;\nuniform float uFurLength,uFurGravity,uFurCurl,uFurShells,uFurFloor;\nvarying float vFurH;\nvarying vec3 vFurObj;\nvarying vec3 vFurN;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float furH=float(gl_InstanceID+1)/max(1.,uFurShells);vFurH=furH;vFurObj=position;vFurN=normalize(objectNormal);
   // Strands lean and curl a little with height, so the wisps read as soft roving rather than radial spikes.
   vec3 curl=vec3(sin(position.y*11.+position.x*6.3),cos(position.x*9.1+position.z*7.7),sin(position.z*10.3-position.y*5.9));curl-=dot(curl,vFurN)*vFurN;
   transformed+=(vFurN*(furH*uFurLength)+curl*(furH*furH*uFurCurl))*furScale;transformed.y-=furH*furH*uFurGravity;transformed.y=max(transformed.y,uFurFloor+furH*.004);`);
  shader.fragmentShader='uniform float uFurDensity,uFurClump,uFurNap,uFurWisp,uFurSeed,uFurEyeR;\nuniform vec3 uFurRoot,uFurTip,uFurGlow;\nuniform vec3 uFurEyes[2];\nvarying float vFurH;\nvarying vec3 vFurObj;\nvarying vec3 vFurN;\n'
   +'float furHash(vec3 p){p=fract(p*.3183099+vec3(.71,.113,.419)+uFurSeed);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\n'
   +'float furNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(furHash(i),furHash(i+vec3(1,0,0)),f.x),mix(furHash(i+vec3(0,1,0)),furHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(furHash(i+vec3(0,0,1)),furHash(i+vec3(1,0,1)),f.x),mix(furHash(i+vec3(0,1,1)),furHash(i+vec3(1,1,1)),f.x),f.y),f.z);}\n'
   +shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   {
    float clump=furNoise(vFurObj*uFurClump),h=vFurH;
    vec3 p=vFurObj*uFurDensity,cell=floor(p),f=fract(p)-.5,off=vec3(furHash(cell+11.),furHash(cell+23.),furHash(cell+37.))-.5;
    vec3 d=f-off*.55;d-=dot(d,vFurN)*vFurN;
    // The felt: a fine, dense nap that tapers to fuzz; a slow noise varies its depth so the surface is not a carpet.
    float strand=furHash(cell),len=uFurNap*(.62+.42*clump+.3*strand),tipT=smoothstep(.05,1.,h/max(.2,len));
    bool kept=h<=.001||(h<=len&&length(d)<=mix(.82,.3,h/len));
    if(!kept){
     // Roving wisps: sparse, coarser cells whose strands reach the full length and lean as they rise. More of
     // them where the clump noise is high, so they gather in soft tufts instead of an even halo.
     vec3 q=vFurObj*uFurDensity*.38+vec3(3.1,7.7,1.3),wc=floor(q),wf=fract(q)-.5;
     vec3 lean=vec3(furHash(wc+61.),furHash(wc+67.),furHash(wc+71.))-.5,wd=wf-(vec3(furHash(wc+13.),furHash(wc+29.),furHash(wc+41.))-.5)*.5-lean*h*.9;
     wd-=dot(wd,vFurN)*vFurN;
     float wlen=.6+.4*furHash(wc+53.);
     kept=furHash(wc+5.)<uFurWisp*(.5+clump)&&h<=wlen&&length(wd)<=mix(.2,.05,h/wlen);
     strand=furHash(wc+83.);tipT=smoothstep(0.,1.,h/wlen);
    }
    if(!kept)discard;
    if(h>.001&&uFurEyeR>0.&&(distance(vFurObj,uFurEyes[0])<uFurEyeR||distance(vFurObj,uFurEyes[1])<uFurEyeR))discard;
    vec3 coat=mix(uFurRoot,uFurTip,tipT)*(.70+.6*strand)*(.76+.48*clump);
    // The master is lit from above: the crown's tips catch light, the belly stays in its own shade.
    float up=clamp(vFurN.y*.5+.5,0.,1.);coat*=mix(.62,1.28,up)*mix(1.,1.08,tipT);
    diffuseColor.rgb*=coat*mix(.56,1.,smoothstep(0.,.6,h));
   }`).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   {float rim=1.-abs(dot(normalize(normal),normalize(vViewPosition)));totalEmissiveRadiance+=uFurGlow*pow(rim,2.)*smoothstep(.25,1.,vFurH)*.42;}`);
 };
 material.customProgramCacheKey=()=>'kkamong-felt-coat-v1';
 const mesh=new THREE.InstancedMesh(base,material,max);mesh.count=low?FUR.shells.low:FUR.shells.balanced;
 const identity=new THREE.Matrix4();for(let i=0;i<max;i++)mesh.setMatrixAt(i,identity);mesh.instanceMatrix.needsUpdate=true;
 mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.decorativeFur=true;mesh.raycast=()=>{};
 mesh.userData.setShells=n=>{mesh.count=n;uniforms.uFurShells.value=n;};mesh.userData.shells=()=>mesh.count;
 return mesh;
}

function insetCoatCore(envelope,{inset=.036,floorY=null,ear=false,body=false,tail=false}={}){
 const geometry=envelope.clone(),position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),colors=new Float32Array(position.count*3),furScale=new Float32Array(position.count).fill(1);
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i),n=coatNoise(x*7.5,y*7.5,z*7.5),amount=(inset+.006*(n-.5))*(floorY===null?1:clamp((y-floorY)/.12,0,1));
  position.setXYZ(i,x-normal.getX(i)*amount,Math.max(floorY??-Infinity,y-normal.getY(i)*amount),z-normal.getZ(i)*amount);
  // The master's waist sits in the shade of the head and the raised arms.
  const lower=clamp((.88-y)/.58,0,1),waist=body?1-.36*Math.exp(-(((y-homeHeight(1.10))/.12)**2)):1,shade=(.88+n*.24+lower*.15)*waist*(ear?earShade(x,y,normal.getZ(i)):1);colors[i*3]=shade;colors[i*3+1]=shade;colors[i*3+2]=shade;
  // The coat shortens towards the tail's point, so its layers do not fan open around a dark core.
  if(tail&&uv)furScale[i]=clamp((1-uv.getX(i))/.32,.18,1);
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('furScale',new THREE.BufferAttribute(furScale,1));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function createKkamongHomeAvatar({kit,low=false,grounded=false,onInvalidate=()=>{},surface='fur'}={}){
 if(!kit?.feltBrown)throw new TypeError('Kkamong requires the shared home material kit');
 const group=new THREE.Group();group.name='living-home-kkamong';group.userData.characterContract='kkamong-profile-shape-review-v1';
 const ownedGeometry=new Set(),ownedMaterials=new Set(),meshes=[],eyes=[],coats=[],wings=[],lineGeometries=new Set();
 let disposed=false,quality=low?'low':'balanced',currentSurface='clay';
 function material(base,color,changes={}){const value=base.clone();if(color)value.color.set(color);Object.assign(value,changes);ownedMaterials.add(value);return value;}
 const bodyMaterial=material(kit.feltBrown,'#3a2b28',{roughness:1,sheen:.25,sheenRoughness:1,map:null,normalMap:null,roughnessMap:null,aoMap:null,vertexColors:true});
 bodyMaterial.emissive.set('#3e302c');bodyMaterial.emissiveIntensity=.18;
 const clay=new THREE.MeshStandardMaterial({color:'#aaa398',roughness:.88,metalness:0});
 const silhouette=new THREE.MeshBasicMaterial({color:'#131313'});ownedMaterials.add(clay);ownedMaterials.add(silhouette);
 const coral=material(kit.tailCoral||kit.feltBrown,'#e48276',{roughness:.98});
 function attach(geometry,mat,parent=group,{name='',eye=false}={}){ownedGeometry.add(geometry);const object=new THREE.Mesh(geometry,mat);object.name=name;object.castShadow=object.receiveShadow=true;parent.add(object);meshes.push({object,original:mat,eye});return object;}
 function ellipsoidMesh(radii,mat,position,parent=group,segments=32,eye=false){const object=attach(new THREE.SphereGeometry(1,segments,Math.max(12,Math.floor(segments*.68))),mat,parent,{eye});object.scale.set(...radii);object.position.set(...position);return object;}
 const body=verticalLoft(BODY_PROFILE,{radial:low?48:80,rows:low?64:104});attach(body,bodyMaterial,group,{name:'kkamong-anatomical-body'});
 for(const side of [-1,1]){
  const name=side<0?'left':'right';attach(earGeometry(side,low),bodyMaterial,group,{name:`kkamong-${name}-rounded-ear`});
  const wing=new THREE.Group();wing.name=`kkamong-${name}-wing`;group.add(wing);wings.push(wing);
  attach(wingMembraneGeometry(side,low),coral,wing,{name:`kkamong-${name}-wing-membrane`});
  attach(wingBoneGeometry(side,low),bodyMaterial,wing,{name:`kkamong-${name}-wing-bone`});attach(wingRibGeometry(side,low),bodyMaterial,wing,{name:`kkamong-${name}-wing-rib`});
 }
 const tailRoot=new THREE.Group();tailRoot.name='kkamong-soft-tail';group.add(tailRoot);
 attach(tailGeometry(low),bodyMaterial,tailRoot,{name:'kkamong-fabric-tail'});
 const spikeShape=spikeGeometry(low);ownedGeometry.add(spikeShape);
 let spikeIndex=0;placeSpikes(tailRoot,parent=>{const spike=new THREE.Mesh(spikeShape,coral);spike.name=`kkamong-tail-spike-${++spikeIndex}`;spike.castShadow=spike.receiveShadow=true;parent.add(spike);meshes.push({object:spike,original:coral,eye:false});return spike;});
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
 for(const record of meshes.filter(record=>record.original===bodyMaterial||record.object.name.includes('wing-membrane'))){
  const {object}=record,isBody=object.name==='kkamong-anatomical-body',isTail=object.name==='kkamong-fabric-tail',isEar=object.name.includes('rounded-ear'),isWing=object.name.includes('-wing-'),isCoral=object.name.includes('wing-membrane'),floorY=grounded?BODY.groundY:null,inset=isCoral?.004:isBody?.036:isWing?.006:.027;
  record.envelope=object.geometry;record.core=insetCoatCore(record.envelope,{inset:isBody?.055:inset,floorY,ear:isEar,body:isBody,tail:isTail||isWing&&!isCoral});ownedGeometry.add(record.core);
  // Ears and the wing bones carry a shorter coat; the tail a little less than the body.
  const coat=shellCoat(record.core,{eyes:isBody?eyeCentres:[],eyeRadius:isBody?EYES.r*1.25:0,floorY,length:isCoral?.016:isBody?FUR.length:isTail?FUR.length*.6:isEar?FUR.length*.5:FUR.length*.35,density:isCoral?FUR.density*1.3:FUR.density,seed:coats.length*.173,low,colors:isCoral?CORAL_FELT:FUR});
  coat.name=`${object.name}-shell-coat`;ownedMaterials.add(coat.material);object.parent.add(coat);coats.push(coat);
 }
 function setSurface(mode){
  if(disposed)return currentSurface;currentSurface=['fur','clay','silhouette'].includes(mode)?mode:'clay';
  for(const {object,original,eye,envelope,core} of meshes){object.material=currentSurface==='silhouette'?silhouette:currentSurface==='clay'&&!eye?clay:original;if(envelope)object.geometry=currentSurface==='fur'?core:envelope;object.castShadow=currentSurface!=='silhouette';object.receiveShadow=currentSurface!=='silhouette';}
  for(const coat of coats)coat.visible=currentSurface==='fur';
  onInvalidate();return currentSurface;
 }
 function setQuality(level){if(disposed)return quality;quality=['low','balanced','high','detail'].includes(level)?level:'balanced';const shells=low?Math.min(FUR.shells[quality],FUR.shells.low+4):FUR.shells[quality];for(const coat of coats)coat.userData.setShells(shells);onInvalidate();return quality;
 }
 function update(seconds,{reducedMotion=false,greeting=-1}={}){
  if(disposed)return;const active=!reducedMotion&&greeting>=0&&greeting<1.25;
  group.scale.set(1,reducedMotion?1:1+Math.sin(seconds*1.28+.5)*.0022,1);group.rotation.x=active?Math.sin(greeting/1.25*Math.PI)*.045:0;group.rotation.z=active?Math.sin(greeting/1.25*TAU)*.021:0;
  const blink=(seconds+2.6)%6.7,open=!reducedMotion&&blink<.15?Math.max(.075,Math.abs(blink/.075-1)):1;for(const eye of eyes)eye.scale.y=open;
 }
 function metrics(){
  let geometryBytes=0,furBytes=0;for(const geometry of ownedGeometry){let bytes=geometry.index?.array.byteLength||0;for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;geometryBytes+=bytes;if(lineGeometries.has(geometry))furBytes+=bytes;}
  const triangles=meshes.reduce((sum,{object})=>sum+Math.floor((object.geometry.index?.count||object.geometry.getAttribute('position').count)/3),0),fineFibres=0,activeFibres=0,coatShells=coats.reduce((sum,coat)=>sum+coat.userData.shells(),0);
  return {id:'kkamong',actual3D:true,productionAsset:false,contract:'kkamong-profile-shape-review-v1',revision:'felt-coat-r18',improvementPass:18,quality,surface:currentSurface,pose:grounded?'floor-rest':'reference',shapeMethod:'body-only-vertical-cross-section-loft',continuousBody:true,separateHands:false,anatomicalBounds:{...BODY,basis:'reference coat envelope with 5% shorter home body; fur core is inset'},bodyBounds:{min:body.boundingBox.min.toArray(),max:body.boundingBox.max.toArray(),groundY:BODY.groundY},proportionAdjustment:{bodyHeightScale:BODY_HEIGHT_SCALE,eyeScale:EYE_COAT_SCALE,eyeDrop:.010,roundedLowerBelly:true},eyes:{centerY:EYES.y,diameter:EYES.r*2,verticalDiameter:EYES.r*2.20,centerDistance:EYES.x*2,pupilRatio:EYES.pupilRatio,crownFraction:(BODY.crownY-EYES.y)/BODY.height,rotation:'gentle inward',centerZ:eyeZ},fur:{stage:'distributed roots with overlapping coherent front locks',textureStatus:'not-used',textureLoaded:false,fineFibres,activeFibres,segmentsPerFibre:5,geometryBytes:furBytes,lowAllocation:low,coatShells,packedAttributes:'snorm16 normals; unorm16 RGBA'},geometryBytes,triangles,lineSegments:0,disposed};
 }
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();ownedGeometry.forEach(value=>value.dispose());ownedMaterials.forEach(value=>value.dispose());group.clear();}
 // Initialise without requesting a frame from an owner that is still building.
 currentSurface=['fur','clay','silhouette'].includes(surface)?surface:'clay';for(const {object,original,eye,envelope,core} of meshes){object.material=currentSurface==='silhouette'?silhouette:currentSurface==='clay'&&!eye?clay:original;if(envelope)object.geometry=currentSurface==='fur'?core:envelope;object.castShadow=currentSurface!=='silhouette';object.receiveShadow=currentSurface!=='silhouette';}for(const fibres of coats)fibres.visible=currentSurface==='fur';setQuality(quality);
 return {group,update,setQuality,setSurface,metrics,dispose};
}
