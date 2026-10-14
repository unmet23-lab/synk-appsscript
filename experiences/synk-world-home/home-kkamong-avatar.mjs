import * as THREE from './scene-assets/three.module.js';

// Body-only reconstruction from the approved front master. The crown and
// belly anchors exclude ears, side folds, tail and all decorative fibres.
const TAU=Math.PI*2;
const BODY_HEIGHT_SCALE=.95;
const homeHeight=y=>.280+(y-.280)*BODY_HEIGHT_SCALE;
const BODY={crownY:homeHeight(1.980),groundY:.280,height:1.700*BODY_HEIGHT_SCALE,centerX:0};
const EYES={x:.2495,y:homeHeight(1.524)-.010,r:.095,pupilRatio:.74};
const EYE_COAT_SCALE=EYES.r/.092;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// [height, half width, front depth, back depth, horizontal centre, depth centre]
// Measured front rows: y1100/1200/1300/1400/1500/2200/2900/3000/3100.
// Rows obscured by folds and the rear depth are explicitly modelled estimates.
const BODY_PROFILE=[
 [0.280000,0.000000,0.000000,0.000000,0.015000,-0.100000],
 [0.291815,0.094869,0.000000,0.000000,0.019808,0.000000],
 [0.326566,0.215801,0.000000,0.000000,0.005908,0.000000],
 [0.396067,0.310670,0.000000,0.000000,0.020850,0.000000],
 [0.465568,0.419092,0.000000,0.000000,0.009730,0.000000],
 [0.535070,0.473303,0.000000,0.000000,0.016680,0.000000],
 [0.604571,0.516394,0.000000,0.000000,0.025715,0.000000],
 [0.674072,0.547322,0.000000,0.000000,0.015638,0.000000],
 [0.743573,0.561570,0.000000,0.000000,0.018765,0.000000],
 [0.813074,0.570953,0.000000,0.000000,0.019808,0.000000],
 [0.882576,0.574775,0.000000,0.000000,0.022935,0.000000],
 [0.952077,0.579640,0.000000,0.000000,0.025020,0.000000],
 [0.986828,0.580683,0.000000,0.000000,0.027453,0.000000],
 [1.021578,0.582768,0.000000,0.000000,0.021893,0.000000],
 [1.056329,0.589718,0.000000,0.000000,0.012858,0.000000],
 [1.160581,0.611958,0.000000,0.000000,0.013553,0.000000],
 [1.230082,0.632809,0.000000,0.000000,0.013553,0.000000],
 [1.299583,0.653659,0.000000,0.000000,0.013553,0.000000],
 [1.369084,0.671034,0.000000,0.000000,0.010078,0.000000],
 [1.438586,0.677984,0.000000,0.000000,0.003128,0.000000],
 [1.508087,0.668254,0.000000,0.000000,-0.003128,0.000000],
 [1.542837,0.658524,0.000000,0.000000,-0.005908,0.000000],
 [1.577588,0.639759,0.000000,0.000000,0.010078,0.000000],
 [1.647089,0.617866,0.000000,0.000000,0.005560,0.000000],
 [1.716590,0.581725,0.000000,0.000000,0.006950,0.000000],
 [1.786092,0.529947,0.000000,0.000000,0.007993,0.000000],
 [1.865000,0.448000,0.000000,0.000000,0.008000,0.000000],
 [1.935000,0.317000,0.000000,0.000000,0.004000,0.000000],
 [1.970000,0.209000,0.000000,0.000000,0.000000,0.000000],
 [1.980000,0.139000,0.000000,0.000000,0.000000,0.000000]
].map(row=>[homeHeight(row[0]),...row.slice(1)]);
function bodySectionAt(y){
 const value=profileAt(BODY_PROFILE,y),t=clamp((y-BODY.groundY)/BODY.height,0,1),ease=t*t*(3-2*t);
 // Alpha-edge asymmetry is mostly the coat, not a zigzagging body axis. One
 // smooth depth envelope also avoids stacking horizontal curvature ridges.
 const depth=Math.sqrt(Math.max(0,1-((y-homeHeight(1.135))/(.855*BODY_HEIGHT_SCALE))**2));
 // Fill the lower belly towards one rounded cross-section without widening
 // the crown/chest maximum or moving the existing crown and floor anchors.
 const belly=Math.sqrt(Math.max(0,1-((t-.56)/.56)**2))*.675,bellyBlend=.60*Math.exp(-(((t-.30)/.40)**4));
 value[1]+=(belly-value[1])*bellyBlend;
 value[2]=.520*depth+.018*Math.exp(-(((t-.33)/.20)**2))*Math.sin(t*Math.PI);value[3]=.360*depth;value[4]=.015*(1-ease);value[5]=-.100+.106*ease;
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
  [1.620,.020,.040,.040,side*.342,-.010],
  [1.720,.154,.180,.120,side*.344,-.016],
  [1.820,.182,.190,.130,side*.357,-.025],
  [1.920,.155,.150,.110,side*.380,-.045],
  [2.014,.115,.100,.080,side*.392,-.060],
  [2.045,.084,.067,.054,side*.391,-.065],
  [2.080,0,0,0,side*.386,-.065]
 ].map(row=>[homeHeight(row[0]),...row.slice(1)]);
 return verticalLoft(profile,{radial:low?28:48,rows:low?28:44});
}
function foldGeometry(side,low){
 // A broad folded sleeve grows out of an embedded root and curls toward the
 // front at the rounded tip. Its depth is much smaller than its broad face.
 const profile=[
  [0,0,0,0,0,0],[.085,.097,.046,.038,side*-.020,.012],
  [.230,.135,.050,.040,side*-.025,.025],[.402,.132,.050,.038,side*.005,.038],
  [.562,.102,.043,.035,side*.005,.058],[.668,.053,.035,.029,side*-.020,.078],
  [.710,0,0,0,side*-.040,.088]
 ];
 const geometry=verticalLoft(profile,{radial:low?28:48,rows:low?26:40});
 geometry.rotateZ(-side*.83);geometry.translate(side*.460,.970,-.180);geometry.scale(1,BODY_HEIGHT_SCALE,1);geometry.translate(0,BODY.groundY*(1-BODY_HEIGHT_SCALE),0);geometry.computeBoundingBox();return geometry;
}

function tailGeometry(lift=0,low=false){
 const curve=new THREE.CatmullRomCurve3([[.370,.64,-.255],[.70,.635,-.18],[.95,.515,.035],[1.13,.295,.275],[1.18,.27,.36]].map((p,i)=>new THREE.Vector3(p[0],p[1]+.20-.12*i/4+lift*i/4,p[2])));
 const segments=low?28:42,radial=low?12:16,geometry=new THREE.TubeGeometry(curve,segments,.115,radial,false),position=geometry.getAttribute('position');
 for(let segment=0;segment<=segments;segment++){
  const t=segment/segments,center=curve.getPointAt(t),scale=1.19-t*.37;
  for(let ring=0;ring<=radial;ring++){const i=segment*(radial+1)+ring;position.setXYZ(i,center.x+(position.getX(i)-center.x)*scale,center.y+(position.getY(i)-center.y)*scale,center.z+(position.getZ(i)-center.z)*scale);}
 }
 geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}

function coatNoise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz;
 const smooth=t=>t*t*(3-2*t),u=smooth(fx),v=smooth(fy),w=smooth(fz);
 const hash=(a,b,c)=>{let n=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,2147483647);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 let value=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)value+=hash(ix+a,iy+b,iz+c)*(a?u:1-u)*(b?v:1-v)*(c?w:1-w);return value;
}

function earShade(x,y,normalZ){
 return 1-.48*Math.exp(-(((Math.abs(x)-.390)/.102)**2+((y-homeHeight(1.991))/(.108*BODY_HEIGHT_SCALE))**2))*clamp(normalZ*2.2,0,1);
}

function createCoatGeometry(envelope,{count=32000,seed=7,inset=.036,floorY=null,eyeClearance=false,ear=false,fold=false}={}){
 // Roots cover the whole skin. Only the middle/ends converge towards softly
 // scattered shared guides; an unclustered undercoat keeps valleys covered.
 const source=envelope.getAttribute('position'),sourceNormal=envelope.getAttribute('normal'),sourceIndex=envelope.index;
 const faceCount=(sourceIndex?.count||source.count)/3,areas=new Float64Array(faceCount),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cross=new THREE.Vector3();let area=0;
 const vertex=i=>sourceIndex?sourceIndex.getX(i):i;
 for(let face=0;face<faceCount;face++){a.fromBufferAttribute(source,vertex(face*3));b.fromBufferAttribute(source,vertex(face*3+1));c.fromBufferAttribute(source,vertex(face*3+2));area+=cross.crossVectors(b.sub(a),c.sub(a)).length()*.5;areas[face]=area;}
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const sample=(position,normal)=>{
  const target=random()*area;let lo=0,hi=faceCount-1;while(lo<hi){const mid=(lo+hi)>>>1;if(areas[mid]<target)lo=mid+1;else hi=mid;}
  const ids=[vertex(lo*3),vertex(lo*3+1),vertex(lo*3+2)],r=Math.sqrt(random()),v=random(),weights=[1-r,r*(1-v),r*v];position.set(0,0,0);normal.set(0,0,0);
  for(let j=0;j<3;j++){a.fromBufferAttribute(source,ids[j]);position.addScaledVector(a,weights[j]);a.fromBufferAttribute(sourceNormal,ids[j]);normal.addScaledVector(a,weights[j]);}normal.normalize();
 };
 const clusters=[],grid=new Map(),neighbourCache=new Map(),cell=.20,key=(x,y,z)=>`${x},${y},${z}`,guideCount=Math.max(16,Math.ceil(area*62));
 for(let i=0;i<guideCount;i++){
  const position=new THREE.Vector3(),normal=new THREE.Vector3();sample(position,normal);
  const frontGuide=eyeClearance?clamp((normal.z-.20)/.60,0,1):0,flow=new THREE.Vector3(random()-.5,random()-.5,random()-.5);flow.y-=frontGuide*.55;flow.addScaledVector(normal,-flow.dot(normal)).normalize();
  const radius=.080+random()*.090,lift=(fold?.027:ear?.045:.066)+random()*(fold?.013:ear?.025:.050),edgeBudget=eyeClearance?(1-.40*Math.max(Math.abs(normal.x),Math.abs(normal.y)))*.80:1,tip=position.clone().addScaledVector(normal,lift*edgeBudget-inset*.40).addScaledVector(flow,.018+random()*.026+frontGuide*.060);
  const cluster={position,normal,flow,radius,lift,tip,tone:.76+random()*.35},hash=key(Math.floor(position.x/cell),Math.floor(position.y/cell),Math.floor(position.z/cell));clusters.push(cluster);if(!grid.has(hash))grid.set(hash,[]);grid.get(hash).push(cluster);
 }
 const nearestGuides=(position,normal)=>{
  const x=Math.floor(position.x/cell),y=Math.floor(position.y/cell),z=Math.floor(position.z/cell),hash=key(x,y,z);let candidates=neighbourCache.get(hash);
  if(!candidates){candidates=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)candidates.push(...grid.get(key(x+dx,y+dy,z+dz))||[]);neighbourCache.set(hash,candidates);}
  let first=null,second=null,d1=Infinity,d2=Infinity;
  for(const candidate of candidates){
   if(candidate.normal.dot(normal)<.28)continue;const score=candidate.position.distanceToSquared(position)/(candidate.radius*candidate.radius);
   if(score<d1){second=first;d2=d1;first=candidate;d1=score;}else if(score<d2){second=candidate;d2=score;}
  }
  return {first,second,blend:first&&second?clamp((.55-(d2-d1))/.55,0,1)*.5:0,distance:d1};
 };
 const segments=5,positions=new Float32Array(count*(segments+1)*3),normals=new Int16Array(positions.length),colors=new Uint16Array(count*(segments+1)*4),indices=new Uint32Array(count*segments*2);
 const root=new THREE.Vector3(),normal=new THREE.Vector3(),guide=new THREE.Vector3(),curlAxis=new THREE.Vector3(),tangent=new THREE.Vector3(),point=new THREE.Vector3(),fibreNormal=new THREE.Vector3(),sharedTip=new THREE.Vector3(),bundleNormal=new THREE.Vector3(),fibreTip=new THREE.Vector3(),sideFlow=new THREE.Vector3();
 const baseColor=new THREE.Color('#655758'),microColor=new THREE.Color('#514246');
 let written=0,attempts=0;
 while(written<count&&attempts++<count*3){
  sample(root,normal);
  if(eyeClearance&&root.z>.30&&[-1,1].some(side=>((root.x-side*EYES.x)/(.100*EYE_COAT_SCALE))**2+((root.y-EYES.y)/(.110*EYE_COAT_SCALE))**2<1))continue;
  const nearby=nearestGuides(root,normal),cluster=nearby.first,blend=nearby.blend,frontness=eyeClearance?clamp((normal.z-.20)/.60,0,1):0;
  if(cluster){sharedTip.copy(cluster.tip);bundleNormal.copy(cluster.normal);if(nearby.second){sharedTip.lerp(nearby.second.tip,blend);bundleNormal.lerp(nearby.second.normal,blend).normalize();}}else{sharedTip.copy(root).addScaledVector(normal,.065);bundleNormal.copy(normal);}
  const x=root.x*7.5,y=root.y*7.5,z=root.z*7.5,n=coatNoise(x,y,z),large=coatNoise(root.x*3.2+9,root.y*3.2,root.z*3.2-7),delta=.08;
  guide.set(coatNoise(x+delta,y,z)-coatNoise(x-delta,y,z),coatNoise(x,y+delta,z)-coatNoise(x,y-delta,z),coatNoise(x,y,z+delta)-coatNoise(x,y,z-delta));guide.addScaledVector(normal,-guide.dot(normal));
  if(guide.lengthSq()<1e-7)guide.set(1,.2,0).addScaledVector(normal,-normal.x-.2*normal.y);guide.normalize();
  const clump=clamp((n-.28)*1.65+(large-.5)*.18,0,1),flyaway=random()<(eyeClearance?.20:.15),middle=!flyaway&&random()<(eyeClearance?.65:ear?.20:fold?.28:.38),guideWeight=flyaway?.12:middle?.84:.40;
  tangent.set(random()-.5,random()-.5,random()-.5).addScaledVector(normal,-tangent.dot(normal)).normalize();guide.multiplyScalar(guideWeight).addScaledVector(tangent,1-guideWeight).normalize();curlAxis.crossVectors(normal,guide).normalize();
  if(middle&&cluster&&frontness>0){
   // A lock shares one curved flow rather than merely gathering unrelated
   // short roots into a round patch. Boundary guides overlap gently.
   sideFlow.copy(cluster.flow);if(nearby.second)sideFlow.lerp(nearby.second.flow,blend);
   sideFlow.addScaledVector(normal,-sideFlow.dot(normal)).normalize();guide.lerp(sideFlow,frontness*.86).normalize();curlAxis.crossVectors(normal,guide).normalize();
  }
  const short=!middle&&!flyaway&&random()<.77,phase=random()*TAU,clumpLength=middle?.60+clump*.72:1,lift=((middle?.090:flyaway?.064:short?.030:.048)+(middle?.050:flyaway?.028:short?.018:.030)*random())*clumpLength,sweep=((middle?.090:flyaway?.070:short?.026:.053)+(middle?.060:flyaway?.040:short?.028:.055)*random())*(middle?.76+large*.55:1),curl=(middle?.013:flyaway?.012:short?.003:.007)+random()*.009;
  if(flyaway&&eyeClearance&&root.z>.05){
   const outward=.22*clamp((Math.abs(root.x)-.28)/.30,0,1);
   sideFlow.set(Math.sign(root.x),Math.sin(phase)*.22,-.30).addScaledVector(normal,-sideFlow.dot(normal)).normalize();
   guide.lerp(sideFlow,outward).normalize();curlAxis.crossVectors(normal,guide).normalize();
  }
  // Long curls project primarily in front of the mass. The canonical outline
  // has a small fibre budget, especially at the crown and the body sides.
  const nearestEye=eyeClearance&&root.z>.25?Math.min(...[-1,1].map(side=>Math.hypot((root.x-side*EYES.x)/(.100*EYE_COAT_SCALE),(root.y-EYES.y)/(.110*EYE_COAT_SCALE)))):Infinity;
  const eyeBudget=clamp((nearestEye-1)/.8,.28,1),liftBudget=fold?.34:ear?.58:middle||flyaway?1-.56*Math.max(Math.abs(normal.x),Math.abs(normal.y)):1;
  const clusterTone=cluster?(cluster.tone*(1-blend)+(nearby.second?.tone||cluster.tone)*blend)*(eyeClearance?.64+.34*Math.exp(-nearby.distance*1.6):.30+.85*Math.exp(-nearby.distance*3.0)):1;
  const tone=(flyaway?.92+large*.12:(middle?.64+clump*.58:.78+n*.22+large*.06)*clusterTone)*(ear?earShade(root.x,root.y,normal.z):1),rootInset=inset*(floorY===null?1:clamp((root.y-floorY)/.12,0,1)),strandColor=short?microColor:baseColor,convergenceAmount=(eyeClearance?.58:.65)+random()*(eyeClearance?.10:.070);
  for(let j=0;j<=segments;j++){
   const t=j/segments,ease=t*t*(3-2*t),sine=Math.sin(t*Math.PI),grow=lift*liftBudget*Math.sin(t*Math.PI*.64)*(eyeClearance&&middle?1+.14*Math.max(0,normal.z)**2:1),wave=(Math.sin(phase+t*Math.PI*2.15)-Math.sin(phase))*curl*t;
   point.copy(root).addScaledVector(normal,-rootInset+grow).addScaledVector(guide,sweep*eyeBudget*ease*(middle?.30+frontness*.48:1)*(ear?.70:1)).addScaledVector(curlAxis,wave*eyeBudget).addScaledVector(tangent,.010*sine*eyeBudget);
   if(middle&&cluster){const convergence=Math.pow(Math.sin(t*Math.PI*.5),1.1)*convergenceAmount*eyeBudget;fibreTip.copy(sharedTip).addScaledVector(tangent,eyeClearance?.043:.025).addScaledVector(curlAxis,Math.sin(phase)*(eyeClearance?.030:.020));point.lerp(fibreTip,convergence);}
   if(eyeClearance)point.y=(BODY.crownY+BODY.groundY)*.5+(point.y-(BODY.crownY+BODY.groundY)*.5)*.98;
   if(eyeClearance&&point.z>.32)for(const side of [-1,1])for(let pass=0;pass<8&&((point.x-side*EYES.x)/(.097*EYE_COAT_SCALE))**2+((point.y-EYES.y)/(.107*EYE_COAT_SCALE))**2<1;pass++)point.lerp(root,.30);
   if(floorY!==null&&point.y<floorY+.030)point.y=floorY+.030*Math.exp((point.y-floorY-.030)/.030);
   const index=written*(segments+1)+j,p=index*3,q=index*4;positions[p]=point.x;positions[p+1]=point.y;positions[p+2]=point.z;
   const lower=eyeClearance?clamp((.90-root.y)/.55,0,1):0;
   fibreNormal.copy(normal).lerp(bundleNormal,middle?.30*sine:0).addScaledVector(tangent,flyaway?.40:0).addScaledVector(guide,(middle?-.70:-.16-lower*.38)*sine).addScaledVector(curlAxis,(middle?.20:.05+lower*.22)*Math.sin(phase+t*Math.PI*2));fibreNormal.y+=lower*(.40+.22*Math.sin(phase));
   const bellyScatter=eyeClearance?Math.exp(-(((root.y-BODY.groundY)/(BODY.height*.145))**2))*clamp(normal.z*2,0,1):0;
   fibreNormal.y+=bellyScatter*.28;fibreNormal.z+=bellyScatter*.20;fibreNormal.normalize();
   normals[p]=Math.round(fibreNormal.x*32767);normals[p+1]=Math.round(fibreNormal.y*32767);normals[p+2]=Math.round(fibreNormal.z*32767);
   const brightness=(middle?(eyeClearance?.58+.92*t:.50+t):flyaway?.78+t*.72:.72+t*.40)*tone*(1+lower*.18*t),alpha=(t<.75?.75+.25*Math.sin(t*Math.PI):flyaway?Math.max(.30,1-(t-.75)*2.8):Math.max(.10,1-(t-.75)*3.6))*(flyaway?.70:middle?1:.72);
   colors[q]=Math.round(strandColor.r*brightness*65535);colors[q+1]=Math.round(strandColor.g*brightness*65535);colors[q+2]=Math.round(strandColor.b*brightness*65535);colors[q+3]=Math.round(alpha*65535);
   if(j<segments){const k=(written*segments+j)*2;indices[k]=index;indices[k+1]=index+1;}
  }
  written++;
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3,true));geometry.setAttribute('color',new THREE.BufferAttribute(colors,4,true));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.setDrawRange(0,written*segments*2);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.fibreCount=written;geometry.userData.segmentsPerFibre=segments;geometry.userData.clusterGuides=guideCount;return geometry;
}

function insetCoatCore(envelope,{inset=.036,floorY=null,ear=false}={}){
 const geometry=envelope.clone(),position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),colors=new Float32Array(position.count*3);
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i),n=coatNoise(x*7.5,y*7.5,z*7.5),amount=(inset+.006*(n-.5))*(floorY===null?1:clamp((y-floorY)/.12,0,1));
  position.setXYZ(i,x-normal.getX(i)*amount,Math.max(floorY??-Infinity,y-normal.getY(i)*amount),z-normal.getZ(i)*amount);
  const lower=clamp((.88-y)/.58,0,1),shade=(.88+n*.24+lower*.15)*(ear?earShade(x,y,normal.getZ(i)):1);colors[i*3]=shade;colors[i*3+1]=shade;colors[i*3+2]=shade;
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function createKkamongHomeAvatar({kit,low=false,grounded=false,onInvalidate=()=>{},surface='fur'}={}){
 if(!kit?.feltBrown)throw new TypeError('Kkamong requires the shared home material kit');
 const group=new THREE.Group();group.name='living-home-kkamong';group.userData.characterContract='kkamong-profile-shape-review-v1';
 const ownedGeometry=new Set(),ownedMaterials=new Set(),meshes=[],eyes=[],coats=[],lineGeometries=new Set();
 let disposed=false,quality=low?'low':'balanced',currentSurface='clay';
 function material(base,color,changes={}){const value=base.clone();if(color)value.color.set(color);Object.assign(value,changes);ownedMaterials.add(value);return value;}
 const bodyMaterial=material(kit.feltBrown,'#3c3033',{roughness:1,sheen:.25,sheenRoughness:1,map:null,normalMap:null,roughnessMap:null,aoMap:null,vertexColors:true});
 bodyMaterial.emissive.set('#403a3b');bodyMaterial.emissiveIntensity=.18;
 const clay=new THREE.MeshStandardMaterial({color:'#aaa398',roughness:.88,metalness:0});
 const silhouette=new THREE.MeshBasicMaterial({color:'#131313'});ownedMaterials.add(clay);ownedMaterials.add(silhouette);
 const coral=material(kit.tailCoral||kit.feltBrown,'#e48276',{roughness:.98});
 const darkFelt=material(kit.tailDark||kit.feltBrown,'#4a3631',{roughness:1});
 const stitchMaterial=material(kit.cottonStitch||kit.feltBrown,'#eadbc9');
 function attach(geometry,mat,parent=group,{name='',eye=false}={}){ownedGeometry.add(geometry);const object=new THREE.Mesh(geometry,mat);object.name=name;object.castShadow=object.receiveShadow=true;parent.add(object);meshes.push({object,original:mat,eye});return object;}
 function ellipsoidMesh(radii,mat,position,parent=group,segments=32,eye=false){const object=attach(new THREE.SphereGeometry(1,segments,Math.max(12,Math.floor(segments*.68))),mat,parent,{eye});object.scale.set(...radii);object.position.set(...position);return object;}
 const body=verticalLoft(BODY_PROFILE,{radial:low?48:80,rows:low?64:104});attach(body,bodyMaterial,group,{name:'kkamong-anatomical-body'});
 for(const side of [-1,1]){attach(earGeometry(side,low),bodyMaterial,group,{name:`kkamong-${side<0?'left':'right'}-rounded-ear`});attach(foldGeometry(side,low),bodyMaterial,group,{name:`kkamong-${side<0?'left':'right'}-soft-fold`});}
 const tailRoot=new THREE.Group();tailRoot.name='kkamong-soft-tail';group.add(tailRoot);
 const tailLift=grounded?Math.max(.32,BODY.groundY+.042):0;attach(tailGeometry(tailLift,low),bodyMaterial,tailRoot,{name:'kkamong-fabric-tail'});
 const tip=new THREE.Group();tip.position.set(1.17,.35+tailLift,.375);tip.rotation.y=-.12;tailRoot.add(tip);
 const upper=ellipsoidMesh([.146,.272,.051],coral,[.018,.165,0],tip,40);upper.rotation.z=-.34;
 const lower=ellipsoidMesh([.111,.189,.028],darkFelt,[.074,-.162,-.008],tip,36);lower.rotation.z=.49;
 for(let i=0;i<4;i++){const thread=attach(new THREE.CapsuleGeometry(.011,.045,4,8),stitchMaterial,tip);thread.position.set(-.039+i*.025,-.010+i*.103,.055);thread.rotation.z=-.34;}
 for(let i=0;i<4;i++){const thread=attach(new THREE.CapsuleGeometry(.0055,.026,3,7),stitchMaterial,tailRoot);const x=.61+i*.127;thread.position.set(x,.757-i*.113-.065*(1-i/3)+.20-.12*(x-.425)/.755+tailLift*(x-.425)/.755,-.116+i*.097);thread.rotation.z=1.01;}
 const iris=new THREE.MeshPhysicalMaterial({color:'#799459',emissive:'#799459',emissiveIntensity:.06,roughness:.23,clearcoat:1,clearcoatRoughness:.12,ior:1.48,metalness:0});
 const pupil=new THREE.MeshPhysicalMaterial({color:'#09080a',roughness:.10,clearcoat:1,clearcoatRoughness:.06,ior:1.5,metalness:0});
 const glint=new THREE.MeshBasicMaterial({color:'#fff9ee'});ownedMaterials.add(iris);ownedMaterials.add(pupil);ownedMaterials.add(glint);
 const eyeProfile=bodySectionAt(EYES.y),eyeZ=eyeProfile[5]+eyeProfile[2]*Math.sqrt(1-(EYES.x/eyeProfile[1])**2)-.029;
 for(const side of [-1,1]){
  const eye=new THREE.Group();eye.name=`kkamong-${side<0?'left':'right'}-olive-eye`;eye.position.set(side*EYES.x,EYES.y-side*.00155,eyeZ);eye.rotation.y=-side*.14;group.add(eye);eyes.push(eye);
  ellipsoidMesh([EYES.r,EYES.r*1.10,.079],iris,[0,0,0],eye,40,true);
  const pr=EYES.r*EYES.pupilRatio;ellipsoidMesh([pr,pr*1.10,.018],pupil,[0,0,.067],eye,36,true);
  ellipsoidMesh([.0205,.022,.006],glint,[-.027,.032,.086],eye,16,true);
 }
 const fibreMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,metalness:0,transparent:true,opacity:.17,depthWrite:false,side:THREE.FrontSide,emissive:'#3d373a',emissiveIntensity:.12,toneMapped:true});ownedMaterials.add(fibreMaterial);
 for(const record of meshes.filter(record=>record.original===bodyMaterial)){
  const {object}=record,isBody=object.name==='kkamong-anatomical-body',isTail=object.name==='kkamong-fabric-tail',isEar=object.name.includes('rounded-ear'),isFold=object.name.includes('soft-fold');
  const count=isBody?(low?34000:112000):isTail?(low?2400:6000):isEar?(low?3500:9000):(low?4800:13000),floorY=grounded?BODY.groundY:null,inset=isBody?.036:.027;
  record.envelope=object.geometry;record.core=insetCoatCore(record.envelope,{inset:isBody?.080:inset,floorY,ear:isEar});ownedGeometry.add(record.core);
  const geometry=createCoatGeometry(record.envelope,{count,seed:71+coats.length*193,inset,floorY,eyeClearance:isBody,ear:isEar,fold:isFold});ownedGeometry.add(geometry);lineGeometries.add(geometry);
  const fibres=new THREE.LineSegments(geometry,fibreMaterial);fibres.name=`${object.name}-independent-fibres`;fibres.userData.decorativeFur=true;fibres.raycast=()=>{};fibres.castShadow=false;fibres.receiveShadow=true;object.parent.add(fibres);coats.push(fibres);
 }
 function setSurface(mode){
  if(disposed)return currentSurface;currentSurface=['fur','clay','silhouette'].includes(mode)?mode:'clay';
  for(const {object,original,eye,envelope,core} of meshes){object.material=currentSurface==='silhouette'?silhouette:currentSurface==='clay'&&!eye?clay:original;if(envelope)object.geometry=currentSurface==='fur'?core:envelope;object.castShadow=currentSurface!=='silhouette';object.receiveShadow=currentSurface!=='silhouette';}
  for(const fibres of coats)fibres.visible=currentSurface==='fur';
  onInvalidate();return currentSurface;
 }
 function setQuality(level){if(disposed)return quality;quality=['low','balanced','high','detail'].includes(level)?level:'balanced';const fraction=quality==='low'?(low?.85:.45):quality==='balanced'?(low?.93:.76):1;for(const fibres of coats){const geometry=fibres.geometry;geometry.setDrawRange(0,Math.floor(geometry.userData.fibreCount*fraction)*geometry.userData.segmentsPerFibre*2);}
  // Fewer sampled fibres still need to cover the same opaque core at each LOD.
  fibreMaterial.opacity=Math.min(.35,.17/Math.pow(fraction,.8));return quality;
 }
 function update(seconds,{reducedMotion=false,greeting=-1}={}){
  if(disposed)return;const active=!reducedMotion&&greeting>=0&&greeting<1.25;
  group.scale.set(1,reducedMotion?1:1+Math.sin(seconds*1.28+.5)*.0022,1);group.rotation.x=active?Math.sin(greeting/1.25*Math.PI)*.045:0;group.rotation.z=active?Math.sin(greeting/1.25*TAU)*.021:0;
  const blink=(seconds+2.6)%6.7,open=!reducedMotion&&blink<.15?Math.max(.075,Math.abs(blink/.075-1)):1;for(const eye of eyes)eye.scale.y=open;
 }
 function metrics(){
  let geometryBytes=0,furBytes=0;for(const geometry of ownedGeometry){let bytes=geometry.index?.array.byteLength||0;for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;geometryBytes+=bytes;if(lineGeometries.has(geometry))furBytes+=bytes;}
  const triangles=meshes.reduce((sum,{object})=>sum+Math.floor((object.geometry.index?.count||object.geometry.getAttribute('position').count)/3),0),fineFibres=coats.reduce((sum,{geometry})=>sum+geometry.userData.fibreCount,0),activeFibres=coats.reduce((sum,{geometry})=>sum+geometry.drawRange.count/(geometry.userData.segmentsPerFibre*2),0);
  return {id:'kkamong',actual3D:true,productionAsset:false,contract:'kkamong-profile-shape-review-v1',revision:'measured-loft-cluster-r16',improvementPass:16,quality,surface:currentSurface,pose:grounded?'floor-rest':'reference',shapeMethod:'body-only-vertical-cross-section-loft',continuousBody:true,separateHands:false,anatomicalBounds:{...BODY,basis:'reference coat envelope with 5% shorter home body; fur core is inset'},bodyBounds:{min:body.boundingBox.min.toArray(),max:body.boundingBox.max.toArray(),groundY:BODY.groundY},proportionAdjustment:{bodyHeightScale:BODY_HEIGHT_SCALE,eyeScale:EYE_COAT_SCALE,eyeDrop:.010,roundedLowerBelly:true},eyes:{centerY:EYES.y,diameter:EYES.r*2,verticalDiameter:EYES.r*2.20,centerDistance:EYES.x*2,pupilRatio:EYES.pupilRatio,crownFraction:(BODY.crownY-EYES.y)/BODY.height,rotation:'gentle inward',centerZ:eyeZ},fur:{stage:'distributed roots with overlapping coherent front locks',textureStatus:'not-used',textureLoaded:false,fineFibres,activeFibres,segmentsPerFibre:5,geometryBytes:furBytes,lowAllocation:low,opacity:fibreMaterial.opacity,packedAttributes:'snorm16 normals; unorm16 RGBA'},geometryBytes,triangles,lineSegments:currentSurface==='fur'?activeFibres*5:0,disposed};
 }
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();ownedGeometry.forEach(value=>value.dispose());ownedMaterials.forEach(value=>value.dispose());group.clear();}
 // Initialise without requesting a frame from an owner that is still building.
 currentSurface=['fur','clay','silhouette'].includes(surface)?surface:'clay';for(const {object,original,eye,envelope,core} of meshes){object.material=currentSurface==='silhouette'?silhouette:currentSurface==='clay'&&!eye?clay:original;if(envelope)object.geometry=currentSurface==='fur'?core:envelope;object.castShadow=currentSurface!=='silhouette';object.receiveShadow=currentSurface!=='silhouette';}for(const fibres of coats)fibres.visible=currentSurface==='fur';setQuality(quality);
 return {group,update,setQuality,setSurface,metrics,dispose};
}
