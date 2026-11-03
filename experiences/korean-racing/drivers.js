// Game adaptations of the approved 4K mascots and measured proportions in
// docs/캐릭터/마스코트_치수_정본_v1.md. The unseen backs are a new game model,
// not a claim that an approved original 3D character already exists.
// Geometry faces local +Z. The origin is the seated pelvis, not the feet.
export const DRIVER_FELT_URL = './assets/felt/driver-felt.webp';
export const DRIVER_SPECS = Object.freeze({
  marin: Object.freeze({label:'마린',forward:[0,0,1],helmet:0x283158,eyes:0xf5cd58,body:0xcbb7a8,eyeMaterial:'matte-felt'}),
  kkamong: Object.freeze({label:'까몽',forward:[0,0,1],body:0x45322b,iris:0x799459,eyeMaterial:'glass'})
});

const TAU = Math.PI * 2;
function seeded(seed) {
  let n=seed>>>0;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}
function part(T,parent,geometry,material,name,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]) {
  const mesh=new T.Mesh(geometry,material);mesh.name=`driver-${name}`;
  mesh.position.set(...position);mesh.scale.set(...scale);mesh.rotation.set(...rotation);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function wool(T,color,texture,extra={}) {
  // The supplied approved felt photograph is a height map only: its pink
  // colour never replaces the canonical indigo, stone or chestnut colours.
  return new T.MeshPhysicalMaterial({color,metalness:0,roughness:.97,
    sheen:.72,sheenColor:new T.Color(color).multiplyScalar(1.1),sheenRoughness:1,
    bumpMap:texture||null,bumpScale:.0045,envMapIntensity:.46,...extra});
}
function feltSurface(T,mesh,shade) {
  // Small colour differences belong to the fibres, not a replacement colour
  // texture. They keep the cloth readable after the fine bump is minified.
  const p=mesh.geometry.attributes.position,colours=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const grain=Math.sin(x*137+y*93+z*117)*Math.sin(x*71-y*109+z*53)*.018;
    const value=Math.max(.72,Math.min(1.09,shade(x,y,z)+grain));colours.push(value,value,value);
  }
  mesh.geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));
  mesh.material=mesh.material.clone();mesh.material.vertexColors=true;return mesh;
}
function combineParts(T,parent,parts,name) {
  // Static stitches/petals share one material and draw call. Moving eyes and
  // limbs remain separate; each retains its own pose and canonical material.
  const positions=[],normals=[],uv=[],indices=[];let offset=0;
  for(const mesh of parts){
    mesh.updateMatrix();const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);
    positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);
    if(g.index)for(const index of g.index.array)indices.push(offset+index);
    else for(let i=0;i<g.attributes.position.count;i++)indices.push(offset+i);
    offset+=g.attributes.position.count;g.dispose();mesh.geometry.dispose();mesh.removeFromParent();
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return part(T,parent,geometry,parts[0].material,name);
}
function ellipsoid(T,parent,material,name,position,scale,segments=24,rings=14) {
  return part(T,parent,new T.SphereGeometry(1,segments,rings),material,name,position,scale);
}
function curveTube(T,parent,material,name,points,radius,segments=20,sides=7) {
  const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  return part(T,parent,new T.TubeGeometry(path,segments,radius,sides,false),material,name);
}
function profile(T,points,segments=48,samples=32) {
  const spline=new T.SplineCurve(points.map(p=>new T.Vector2(...p)));
  // Smooth the curve before revolving it: a tiny number of cylinder rings
  // leaves visible horizontal bands in the close-up garage view.
  const ring=spline.getPoints(samples).map(v=>new T.Vector2(Math.max(0,v.x),v.y));
  return {geometry:new T.LatheGeometry(ring,segments),ring};
}
function profilePoint(T,ring,y,theta,depth=1) {
  let a=ring[0],b=ring[1];
  for(let i=0;i<ring.length-1;i++)if(y>=ring[i].y&&y<=ring[i+1].y){a=ring[i];b=ring[i+1];break;}
  const dy=Math.max(.0001,b.y-a.y),f=Math.max(0,Math.min(1,(y-a.y)/dy)),r=a.x+(b.x-a.x)*f;
  const slope=(b.x-a.x)/dy;
  return {point:new T.Vector3(Math.cos(theta)*r,y,Math.sin(theta)*r*depth),normal:new T.Vector3(Math.cos(theta),-slope,Math.sin(theta)/depth).normalize()};
}
function fibres(T,parent,material,name,surface,count,seed,length=.016) {
  // Actual bent strands add a soft silhouette. All strands share one draw
  // call, unlike hundreds of independent hair meshes. No face billboard or
  // unlit mascot material is used.
  const geometry=new T.BufferGeometry(),vertices=[],uv=[],indices=[],steps=3;
  for(let i=0;i<=steps;i++){
    const t=i/steps,width=.0007*(1-t*.88),bend=Math.sin(t*Math.PI)*length*.18;
    vertices.push(-width+t*length*.19,t*length,bend,width+t*length*.19,t*length,bend);
    uv.push(0,t,1,t);
    if(i<steps){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const hairMaterial=material.clone();hairMaterial.side=T.DoubleSide;hairMaterial.bumpMap=null;
  const strands=new T.InstancedMesh(geometry,hairMaterial,count),random=seeded(seed),transform=new T.Object3D(),up=new T.Vector3(0,1,0);
  strands.name=`driver-${name}`;strands.castShadow=false;strands.receiveShadow=true;
  for(let i=0;i<count;i++){
    const {point,normal}=surface(random,i);
    transform.position.copy(point);transform.quaternion.setFromUnitVectors(up,normal);
    transform.rotateY(random()*TAU);transform.scale.setScalar(.55+random()*.60);transform.updateMatrix();
    strands.setMatrixAt(i,transform.matrix);strands.setColorAt(i,new T.Color().setScalar(.88+random()*.22));
  }
  strands.instanceMatrix.needsUpdate=true;strands.computeBoundingBox();strands.computeBoundingSphere();parent.add(strands);return strands;
}
function feltEar(T,parent,material,name,position,scale,rotation) {
  // Kkamong's pointed cat ears: a felt blob narrowing to a soft point. They sit
  // on the crown's corners, as in the 4K master (docs/캐릭터/정본_4K/까몽_본체.png).
  const geometry=new T.SphereGeometry(1,24,12),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),x=p.getX(i),z=p.getZ(i),t=.78+.22*(1-y)*.5;
    p.setXYZ(i,x*t,y,z*t);
  }
  geometry.computeVertexNormals();return part(T,parent,geometry,material,name,position,scale,rotation);
}
// 2026-10-27 revision (docs/캐릭터/가이드_정본.md 「까몽 개정」): in place of arms
// Kkamong has two small dragon wings — a brown felt bone up to a rounded elbow
// knob and out to the tip, one rib down to the middle scallop, and an olive felt
// membrane with a scalloped lower edge — and a thick dragon tail that tapers and
// curls up, with five olive felt spikes on its ridge. No hands. The shapes are
// those of the WORLD home avatar (experiences/synk-world-home/home-kkamong-avatar.mjs,
// WING · wingMembraneGeometry · wingBoneGeometry · wingRibGeometry · tailGeometry ·
// TAIL_SPIKES · placeSpikes), re-measured into this seated rig. The body and
// the eyes follow the same avatar (BODY_PROFILE · bodySectionAt · EYES): a round
// head on a rounder belly with a softly pinched neck, like a snowman, and round
// glass eyes whose olive iris shows wide around the black pupil.
// Home coordinates map to the rig by one scale: the home floor (.28) is the
// rig's lowest point and the home crown (1.895) its top (.737).
const KKAMONG_HOME_SCALE=.484,KKAMONG_HOME_FLOOR=.28,KKAMONG_RIG_FLOOR=-.045;
const kkamongRigY=y=>KKAMONG_RIG_FLOOR+(y-KKAMONG_HOME_FLOOR)*KKAMONG_HOME_SCALE;
// The home avatar's measured rows [height, half width] from the felt master
// (heights before its .95 squash): belly, pinched neck, round head, crown.
const KKAMONG_HOME_ROWS=[[.280,0],[.297,.1292],[.3225,.20672],[.365,.2907],[.4075,.350455],[.45,.411825],[.4925,.447355],[.535,.47481],[.62,.51034],[.705,.524875],[.79,.524875],[.875,.51357],[.96,.476425],[1.028,.45866],[1.079,.46189],[1.13,.47804],[1.215,.51357],[1.3,.54587],[1.385,.56525],[1.47,.573325],[1.555,.565306],[1.64,.540536],[1.708,.507068],[1.759,.472389],[1.81,.427331],[1.844,.389786],[1.878,.343995],[1.912,.286025],[1.946,.20583],[1.963,.146793],[1.98,0]];
const KKAMONG_BODY_ROWS=KKAMONG_HOME_ROWS.map(([y,w])=>[w*KKAMONG_HOME_SCALE,kkamongRigY(KKAMONG_HOME_FLOOR+(y-KKAMONG_HOME_FLOOR)*.95)]);
const KKAMONG_TOP=KKAMONG_BODY_ROWS.at(-1)[1];
// bodySectionAt: the section is round, its front .84 and its back .74 of the
// half width, and the belly sits a little further back than the head.
const KKAMONG_FRONT=.84,KKAMONG_BACK=.74;
function kkamongDepthCentre(y) {
  const t=Math.max(0,Math.min(1,(y-KKAMONG_RIG_FLOOR)/(KKAMONG_TOP-KKAMONG_RIG_FLOOR))),ease=t*t*(3-2*t);
  return (-.100+.106*ease)*KKAMONG_HOME_SCALE;
}
function kkamongBodyGeometry(T) {
  // One smooth outline revolved, then pressed to the home section.
  const body=profile(T,KKAMONG_BODY_ROWS,56,48),p=body.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const y=p.getY(i),z=p.getZ(i);p.setZ(i,z*(z>=0?KKAMONG_FRONT:KKAMONG_BACK)+kkamongDepthCentre(y));}
  body.geometry.computeVertexNormals();return body;
}
function kkamongBodyPoint(T,ring,y,theta) {
  const front=Math.sin(theta)>=0,surface=profilePoint(T,ring,y,theta,front?KKAMONG_FRONT:KKAMONG_BACK);
  surface.point.z+=kkamongDepthCentre(y);return surface;
}
// EYES: centres .2096 from the middle and radius .091, as at home. Their
// height is measured on the 4K front master (정본_4K/까몽_본체.png): the iris
// centres sit 19.8% of the body height below the crown (home units 1.575; the
// home avatar uses 1.457), and the pupil is about .68 of the iris.
const KKAMONG_EYES={x:.2096*KKAMONG_HOME_SCALE,y:kkamongRigY(1.575),r:.091*KKAMONG_HOME_SCALE,pupil:.68};
// Olive felt of the wing membranes and tail spikes: the home avatar remaps its
// felt photograph between FELT.wingDark #4a6127 and FELT.wingLight #b9d07c; its
// olive fuzz middle tone #88a64a is that felt's average colour.
const KKAMONG_OLIVE=0x88a64a;
// Front-view points of the home master [x, y]. The driving pose keeps the home
// "ta-da" lift (.62) — the elbow knob stands above the shoulder and the
// membrane fans out. The wings sweep further back than at home (.14), clear of
// the wheel, which also turns the membrane towards a side camera instead of
// edge on. `size` grows the wing about its root a little for driving distance
// and `out` (rig units) moves its root outwards. The rib is a little thicker
// than the home rib so it stands proud of the thinner membrane.
const KKAMONG_WING={root:[.540,1.322],knob:[.669,1.452],tip:[.895,1.262],rib:[.730,1.110],low:[.568,1.055],attach:[.470,1.077],size:1.12,out:0,sweep:.45,raise:.62,z:-.06,bone:.046,elbow:.060,ribRadius:.034};
function kkamongHomeMatrix(T) {
  const s=KKAMONG_HOME_SCALE;
  return new T.Matrix4().makeTranslation(0,KKAMONG_RIG_FLOOR-KKAMONG_HOME_FLOOR*s,0).multiply(new T.Matrix4().makeScale(s,s,s));
}
function kkamongWingFrame(T,side) {
  const W=KKAMONG_WING,c=Math.cos(W.sweep);
  const matrix=new T.Matrix4().makeTranslation(side*W.out,0,0).multiply(kkamongHomeMatrix(T)).multiply(new T.Matrix4().makeTranslation(side*W.root[0],W.root[1],W.z))
    .multiply(new T.Matrix4().makeScale(W.size,W.size,W.size)).multiply(new T.Matrix4().makeRotationZ(side*W.raise)).multiply(new T.Matrix4().makeRotationY(side*W.sweep));
  const local=([x,y],z=0)=>new T.Vector3(side*(x-W.root[0])/c,y-W.root[1],z);
  return {matrix,local,world:(point,z=0)=>local(point,z).applyMatrix4(matrix)};
}
function kkamongWingMembrane(T,side) {
  const W=KKAMONG_WING,{local,matrix}=kkamongWingFrame(T,side),at=point=>{const v=local(point);return [v.x,v.y];};
  const mid=(a,b,t,lift)=>[a[0]+(b[0]-a[0])*t+lift[0],a[1]+(b[1]-a[1])*t+lift[1]];
  const shape=new T.Shape();shape.moveTo(...at(W.attach));
  shape.lineTo(...at(W.root));
  shape.quadraticCurveTo(...at([.600,1.430]),...at(W.knob));
  shape.quadraticCurveTo(...at([.790,1.400]),...at(W.tip));
  // Each scallop bows up and inwards between two points of the lower edge.
  shape.quadraticCurveTo(...at(mid(W.tip,W.rib,.5,[-.065,.105])),...at(W.rib));
  shape.quadraticCurveTo(...at(mid(W.rib,W.low,.5,[-.018,.085])),...at(W.low));
  shape.quadraticCurveTo(...at(mid(W.low,W.attach,.5,[.010,.030])),...at(W.attach));
  const geometry=new T.ExtrudeGeometry(shape,{depth:.016,bevelEnabled:true,bevelThickness:.009,bevelSize:.010,bevelSegments:2,curveSegments:8});
  geometry.translate(0,0,-.008);geometry.applyMatrix4(matrix);geometry.computeVertexNormals();return geometry;
}
function kkamongTaperedTube(T,curve,radius,segments,radial,closeTip=true) {
  // A felt bone, rib or tail: a round tube whose radius follows radius(t). The
  // open root end stays buried in the body; the far end closes to a soft point.
  const geometry=new T.TubeGeometry(curve,segments,1,radial,false),position=geometry.getAttribute('position');
  for(let segment=0;segment<=segments;segment++){
    const t=segment/segments,center=curve.getPointAt(t),scale=Math.max(.002,radius(t)*(closeTip?Math.sqrt(Math.min(1,Math.max(0,(1-t)/.10))):1));
    for(let ring=0;ring<=radial;ring++){
      const i=segment*(radial+1)+ring;
      position.setXYZ(i,center.x+(position.getX(i)-center.x)*scale,center.y+(position.getY(i)-center.y)*scale,center.z+(position.getZ(i)-center.z)*scale);
    }
  }
  geometry.computeVertexNormals();return geometry;
}
function kkamongWingBones(T,side) {
  const W=KKAMONG_WING,{world}=kkamongWingFrame(T,side),s=KKAMONG_HOME_SCALE*W.size,elbowT=.42;
  const curve=points=>new T.CatmullRomCurve3(points.map(point=>world(point)));
  // Thicker at the rounded elbow knob, a little thinner out to the tip.
  const bone=kkamongTaperedTube(T,curve([[W.root[0]-.070,W.root[1]-.040],W.root,[.610,1.410],W.knob,[.775,1.392],W.tip,[W.tip[0]+.022,W.tip[1]-.010]]),
    t=>s*(W.bone+(W.elbow-W.bone)*Math.exp(-(((t-elbowT)/.11)**2))-.006*t),18,9);
  const rib=kkamongTaperedTube(T,curve([[W.knob[0]-.010,W.knob[1]-.030],[.700,1.300],[.712,1.200],W.rib]),t=>s*W.ribRadius*(1-.25*t),10,7);
  return [bone,rib];
}
// The seated dragon tail, in rig units. The home tail leaves the lower side and
// curls up beside the body; behind a driver's seat that path would run through
// the door. Here the same thick root, taper and proud upward curl leave the
// lower back on the right and run diagonally out behind the seat back, rising
// above the rear deck inside the cockpit sides. Seen from the chase camera the
// curl stands clear of the body at an angle, so its spikes show.
const KKAMONG_TAIL=[[.10,.24,-.10],[.22,.29,-.22],[.31,.34,-.33],[.36,.43,-.41],[.36,.54,-.42],[.32,.61,-.38]];
const kkamongTailRadius=t=>Math.max(.004,.108*Math.pow(1-t,.45)*(1-.25*t));
// Five soft felt spikes along the ridge, largest near the root: [t, height, length].
const KKAMONG_SPIKE_ROLL=-.7;
const KKAMONG_TAIL_SPIKES=[[.30,.064,.061],[.43,.056,.054],[.56,.046,.046],[.68,.038,.039],[.79,.030,.032]];
function kkamongSpikeGeometry(T) {
  const outline=[[1,0],[.97,.14],[.80,.38],[.52,.66],[.24,.89],[.08,.98],[0,1]].map(([r,y])=>new T.Vector2(r*.5,y));
  // LatheGeometry's own profile normals stay defined at the pointed tip, where
  // recomputed face normals vanish; scale() carries them through the press.
  const geometry=new T.LatheGeometry(outline,10);geometry.scale(1,1,.42);return geometry;
}
function addMarin(T,rig,texture) {
  const indigo=wool(T,0x283158,texture),seam=wool(T,0x222948,texture),stone=wool(T,0xcbb7a8,texture),cream=wool(T,0xe4d7c6,texture),yellow=wool(T,0xf5cd58,texture,{sheen:.25,envMapIntensity:.16});
  const torso=feltSurface(T,ellipsoid(T,rig,stone,'marin-torso',[0,.175,0],[.192,.215,.146]),(x,y)=>.97+.055*y);
  for(const side of [-1,1]){
    ellipsoid(T,rig,stone,`marin-foot-${side}`, [side*.088,-.008,.142],[.076,.063,.135],20,12);
    const arm=new T.Group();arm.name=`driver-marin-arm-${side}`;rig.add(arm);
    curveTube(T,arm,stone,`marin-sleeve-${side}`,[[side*.153,.29,-.008],[side*.221,.22,.078],[side*.207,.183,.204],[side*.171,.255,.301]],.045,18,9);
    ellipsoid(T,arm,stone,`marin-mitten-${side}`,[side*.169,.265,.300],[.058,.052,.060],20,12);
  }
  // The large rounded bell helmet is the canonical widest point. It is one
  // continuous lit surface, with a felt hem rather than plated robot pieces.
  const head=new T.Group();head.name='driver-marin-head';rig.add(head);
  // The photographed helmet is about as tall as it is wide. An elongated
  // sphere makes Marin read as an egg; keep the broad cheeks and shallow dome.
  const helmet=profile(T,[[0,.337],[.22,.337],[.321,.355],[.348,.397],[.352,.644],[.343,.788],[.307,.907],[.230,.988],[.121,1.02],[0,1.022]],88,46);
  const shellPosition=helmet.geometry.attributes.position;
  for(let i=0;i<shellPosition.count;i++){
    const x=shellPosition.getX(i),y=shellPosition.getY(i),z=shellPosition.getZ(i);
    // The rear is a game adaptation: a softly sewn wool cap, never a hard
    // cylinder. Broad shallow panel channels catch the same scene lighting
    // as the car, while the front sockets keep their measured proportions.
    if(z<0){
      const theta=Math.atan2(z,x),rear=Math.exp(-Math.pow((theta+Math.PI/2)/1.1,6));
      const panels=Math.exp(-Math.pow((theta+Math.PI/2-.54)/.047,2))+Math.exp(-Math.pow((theta+Math.PI/2+.54)/.047,2));
      const hem=Math.exp(-Math.pow((y-.397)/.014,2));
      const cloth=(Math.sin(theta*9+y*5.8)+Math.sin(theta*17-y*8.3)*.35)*.0016;
      const amount=(cloth-.0038*panels-.003*hem)*rear;
      const radius=Math.hypot(x,z);if(radius>.0001){shellPosition.setX(i,x+amount*x/radius);shellPosition.setZ(i,z+amount*z/radius);}
    }
    if(z<.18)continue;
    for(const side of [-1,1]){
      const r=Math.hypot((x-side*.166)/.100,(y-.594)/.117);
      const socket=1-T.MathUtils.smoothstep(r,.67,1.16);
      // A soft recess makes room for the full eye disc instead of sinking
      // its inner edge into the curved blue shell.
      if(socket>0)shellPosition.setZ(i,z-.040*socket);
    }
  }
  helmet.geometry.computeVertexNormals();
  feltSurface(T,part(T,head,helmet.geometry,indigo,'marin-helmet',[0,0,0],[1,1,1.045]),(x,y,z)=>{
    const theta=Math.atan2(z,x),rear=z<0?1:0;
    const panel=rear*(Math.exp(-Math.pow((theta+Math.PI/2-.54)/.065,2))+Math.exp(-Math.pow((theta+Math.PI/2+.54)/.065,2)));
    return .98+.035*(y-.65)-panel*.09-Math.exp(-Math.pow((y-.397)/.017,2))*.06;
  });
  feltSurface(T,part(T,head,new T.TorusGeometry(.326,.024,10,64),indigo,'marin-hem',[0,.367,0],[1,1.045,1],[Math.PI/2,0,0]),(x,y,z)=>.97+.075*z/.024);
  const seams=[curveTube(T,head,seam,'marin-crown-seam',[[0,.390,-.360],[0,.680,-.363],[0,.916,-.298],[0,1.003,-.16],[0,1.024,0],[0,1.003,.16],[0,.916,.298]],.0034,38,6)];
  for(const side of [-1,1]){
    const points=[];
    for(let i=0;i<=15;i++){
      const y=.407+i/15*.59,theta=-Math.PI/2+side*.54;
      const surface=profilePoint(T,helmet.ring,y,theta,1.045);
      surface.point.addScaledVector(surface.normal,.0009);points.push(surface.point.toArray());
    }
    seams.push(curveTube(T,head,seam,`marin-rear-panel-${side}`,points,.0034,28,6));
  }
  combineParts(T,head,seams,'marin-panel-seams');
  // Short indigo thread stitches articulate the rolled wool edge at actual
  // driving size. A single mesh avoids one draw call for each stitch.
  const thread=wool(T,0x3a456e,texture,{bumpScale:.0025,sheen:.45}),stitches=[];
  for(let i=0;i<40;i++){
    const angle=i*TAU/40,points=[];
    for(const delta of [-.013,0,.013]){
      const theta=angle+delta,r=.349+(delta===0?.001:0);
      points.push([Math.cos(theta)*r,.370+delta*.22,Math.sin(theta)*r*1.045]);
    }
    stitches.push(curveTube(T,head,thread,`marin-hem-stitch-${i}`,points,.0019,3,5));
  }
  combineParts(T,head,stitches,'marin-hem-stitches');
  const eyes=[];
  for(const side of [-1,1]){
    // The 0.95-eye-width gap and the matte highlight-free material are kept
    // separate from the glass eyes of Kkamong.
    const eye=new T.Group();eye.name=`driver-marin-eye-${side}`;
    eye.position.set(side*.166,.594,.330);eye.rotation.y=side*.23;head.add(eye);
    part(T,eye,new T.TorusGeometry(.096,.018,8,36),indigo,'marin-eye-rim',[0,0,0],[1,1.16,1]);
    const disc=ellipsoid(T,eye,yellow,'marin-eye-felt',[0,0,.007],[.085,.0986,.016],28,16);
    disc.userData.baseScaleY=disc.scale.y;eyes.push(disc);
  }
  fibres(T,head,indigo,'marin-helmet-fibres',(random)=>{
    const y=.367+random()*.643,theta=random()*TAU,surface=profilePoint(T,helmet.ring,y,theta,1.045);
    // The blue fibres follow the same eye recess; front strands must not
    // float over the yellow discs after the surface has been pressed inward.
    if(surface.point.z>.18)for(const side of [-1,1]){
      const r=Math.hypot((surface.point.x-side*.166)/.100,(y-.594)/.117);
      surface.point.z-=.040*(1-T.MathUtils.smoothstep(r,.67,1.16))*1.045;
    }
    return surface;
  },1000,43,.014);
  fibres(T,rig,stone,'marin-body-fibres',(random)=>{
    const y=2*random()-1,theta=random()*TAU,r=Math.sqrt(Math.max(0,1-y*y));
    const point=new T.Vector3(Math.cos(theta)*r*.192,.175+y*.215,Math.sin(theta)*r*.146);
    return {point,normal:new T.Vector3(point.x/(.192*.192),(point.y-.175)/(.215*.215),point.z/(.146*.146)).normalize()};
  },320,109,.017);
  // A pocket and a small daisy are recognisable details already present in
  // the approved 3/4 reference, rather than new racing-character accessories.
  const pocket=ellipsoid(T,rig,cream,'marin-pocket',[-.077,.134,.132],[.107,.081,.024],20,12);
  pocket.rotation.z=-.12;
  const flower=new T.Group();flower.name='driver-marin-flower';flower.position.set(-.106,.277,.164);flower.rotation.z=.13;rig.add(flower);
  const green=wool(T,0x719050,texture),petal=wool(T,0xe6e5d6,texture);
  curveTube(T,flower,green,'marin-flower-stem',[[0,-.067,0],[.005,-.019,.003],[0,.016,.004]],.007,8,5);
  ellipsoid(T,flower,green,'marin-flower-leaf',[-.022,-.040,.002],[.025,.012,.007],12,8).rotation.z=.52;
  const petals=[];
  for(let i=0;i<5;i++){
    const theta=i*TAU/5,p=ellipsoid(T,flower,petal,`marin-flower-petal-${i}`,[Math.sin(theta)*.021,.027+Math.cos(theta)*.021,.012],[.016,.022,.006],12,8);p.rotation.z=-theta;
    petals.push(p);
  }
  combineParts(T,flower,petals,'marin-flower-petals');
  ellipsoid(T,flower,yellow,'marin-flower-centre',[0,.027,.020],[.015,.015,.008],16,10);
  rig.scale.setScalar(.86);
  return {head,eyes,arms:rig.children.filter(p=>p.name.startsWith('driver-marin-arm-')),torso};
}
function addKkamong(T,rig,texture) {
  const dark=wool(T,DRIVER_SPECS.kkamong.body,texture,{sheen:.88});
  const olive=wool(T,KKAMONG_OLIVE,texture,{sheen:.2});
  const body=kkamongBodyGeometry(T);
  // As at home: the neck sits in the shade of the head and the wings, and the
  // belly is a little darker than the crown.
  const neckY=kkamongRigY(KKAMONG_HOME_FLOOR+(1.075-KKAMONG_HOME_FLOOR)*.95),homeY=y=>(y-KKAMONG_RIG_FLOOR)/KKAMONG_HOME_SCALE+KKAMONG_HOME_FLOOR;
  feltSurface(T,part(T,rig,body.geometry,dark,'kkamong-soft-body'),(x,y,z)=>(1-.12*Math.exp(-(((y-neckY)/.048)**2)))*(.90+.16*Math.max(0,Math.min(1,(homeY(y)-.5)/1.3)))+Math.sin(x*8+z*5)*.02);
  const head=new T.Group();head.name='driver-kkamong-face';rig.add(head);
  const wings=[];
  for(const side of [-1,1]){
    feltEar(T,rig,dark,`kkamong-ear-${side}`,[side*.170,.664,-.020],[.090,.114,.064],[0,0,side*-.34]);
    // Each wing is its own group so a later flap can turn it about the shoulder.
    const wing=new T.Group();wing.name=`driver-kkamong-wing-${side}`;rig.add(wing);wings.push(wing);
    feltSurface(T,part(T,wing,kkamongWingMembrane(T,side),olive,`kkamong-wing-membrane-${side}`),(x,y,z)=>.74+Math.sin(x*41+y*37+z*29)*.02);
    const [bone,rib]=kkamongWingBones(T,side);
    combineParts(T,wing,[part(T,wing,bone,dark,`kkamong-wing-bone-${side}`),part(T,wing,rib,dark,`kkamong-wing-rib-${side}`)],`kkamong-wing-bones-${side}`);
  }
  const tailCurve=new T.CatmullRomCurve3(KKAMONG_TAIL.map(p=>new T.Vector3(...p)));
  feltSurface(T,part(T,rig,kkamongTaperedTube(T,tailCurve,kkamongTailRadius,30,12),dark,'kkamong-dragon-tail'),(x,y,z)=>.95+.06*y);
  // The ridge follows the curl: the top of the tail turns towards the body as
  // the tail rises, as on the master, where the spikes sit inside the curl.
  // The tail's plane is upright through its diagonal run; `across` is its normal.
  const run=new T.Vector3(...KKAMONG_TAIL[3]).sub(new T.Vector3(...KKAMONG_TAIL[0])).setY(0).normalize();
  const spikeShape=kkamongSpikeGeometry(T),spikes=[],across=new T.Vector3(-run.z,0,run.x),tangent=new T.Vector3(),up=new T.Vector3(),sideways=new T.Vector3(),basis=new T.Matrix4();
  KKAMONG_TAIL_SPIKES.forEach(([t,height,length],i)=>{
    const spike=part(T,rig,i?spikeShape.clone():spikeShape,olive,`kkamong-tail-spike-${i+1}`);
    tangent.copy(tailCurve.getTangentAt(t));up.crossVectors(across,tangent).normalize();sideways.crossVectors(tangent,up).normalize();
    // Rolled a little towards the outside of the run, so the row shows from the
    // chase camera behind and above as well as from the front.
    up.multiplyScalar(Math.cos(KKAMONG_SPIKE_ROLL)).addScaledVector(sideways,Math.sin(KKAMONG_SPIKE_ROLL)).normalize();sideways.crossVectors(tangent,up).normalize();
    basis.makeBasis(tangent,up,sideways);spike.quaternion.setFromRotationMatrix(basis);
    spike.scale.set(length,height,length);spike.position.copy(tailCurve.getPointAt(t)).addScaledVector(up,kkamongTailRadius(t)*.86);
    spikes.push(spike);
  });
  combineParts(T,rig,spikes,'kkamong-tail-spikes');
  // Round glass eyes without a brown rim: a domed olive iris, a black glass
  // pupil and one bright catch-light, set into the face as at home.
  const irisMaterial=new T.MeshPhysicalMaterial({color:DRIVER_SPECS.kkamong.iris,emissive:DRIVER_SPECS.kkamong.iris,emissiveIntensity:.22,metalness:0,roughness:.23,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1});
  const glass=new T.MeshPhysicalMaterial({color:0x09080a,metalness:0,roughness:.10,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.3});
  const glint=new T.MeshStandardMaterial({color:0xfff9ee,emissive:0xfff9ee,emissiveIntensity:.9,roughness:.3,metalness:0});
  const E=KKAMONG_EYES,s=KKAMONG_HOME_SCALE,eyes=[];
  const centre=kkamongDepthCentre(E.y),front=kkamongBodyPoint(T,body.ring,E.y,Math.PI/2).point.z-centre,halfWidth=profilePoint(T,body.ring,E.y,0).point.x;
  // Set a little deeper than at home and turned with the face, so the domed
  // glass sits flush in the felt from the 3/4 views instead of standing out.
  const eyeZ=centre+front*Math.sqrt(1-(E.x/halfWidth)**2)-.022*s;
  for(const side of [-1,1]){
    const eye=new T.Group();eye.name=`driver-kkamong-eye-${side}`;eye.position.set(side*E.x,E.y,eyeZ);eye.rotation.y=side*.30;head.add(eye);
    ellipsoid(T,eye,irisMaterial,'kkamong-iris',[0,0,0],[E.r,E.r*1.10,.056*s],28,18);
    const pr=E.r*E.pupil;ellipsoid(T,eye,glass,'kkamong-glass-pupil',[0,0,.044*s],[pr,pr*1.10,.016*s],28,16);
    const g=E.r/.095;ellipsoid(T,eye,glint,'kkamong-eye-glint',[-.027*g,.032*g,.060*s],[.0205*g,.022*g,.006*s],12,8);
    eye.userData.baseScaleY=1;eyes.push(eye);
  }
  // Felt fibres follow the new surface; none over the eyes.
  const eyeCentres=[-1,1].map(side=>[side*E.x,E.y]);
  fibres(T,rig,dark,'kkamong-fibres',random=>{
    for(;;){
      const surface=kkamongBodyPoint(T,body.ring,KKAMONG_RIG_FLOOR+.01+random()*(KKAMONG_TOP-KKAMONG_RIG_FLOOR-.03),random()*TAU);
      if(!(surface.point.z>0&&eyeCentres.some(([x,y])=>Math.hypot(surface.point.x-x,surface.point.y-y)<E.r*1.2)))return surface;
    }
  },1400,913,.023);
  rig.scale.setScalar(1.09);
  return {head,eyes,arms:[],wings,torso:rig.children[0]};
}

/** Build a driver with genuinely three-dimensional, shadow-casting surfaces.
 *  feltTexture is caller-owned; load DRIVER_FELT_URL once as a repeatable
 *  non-colour texture and pass it to every driver. No network fetch occurs here.
 */
export function buildDriver(THREE,id='marin',{feltTexture=null}={}) {
  if(!DRIVER_SPECS[id])throw new RangeError(`Unknown driver: ${id}`);
  const driver=new THREE.Group();driver.name=`driver-${id}`;
  const rig=new THREE.Group();rig.name='driver-seated-rig';driver.add(rig);
  const pose=id==='marin'?addMarin(THREE,rig,feltTexture):addKkamong(THREE,rig,feltTexture);
  driver.userData.driverId=id;driver.userData.forward=[0,0,1];driver.userData.seatOrigin='pelvis';driver.userData.pose={rig,...pose};
  driver.userData.feltTextureUrl=DRIVER_FELT_URL;driver.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(driver),size=bounds.getSize(new THREE.Vector3());
  let triangles=0,drawCalls=0;
  driver.traverse(p=>{if(p.isMesh){triangles+=(p.geometry.index?p.geometry.index.count:p.geometry.attributes.position.count)/3*(p.isInstancedMesh?p.count:1);drawCalls++;}});
  driver.userData.modelStats={triangles,drawCalls,width:size.x,height:size.y,depth:size.z};
  return driver;
}

/** Steering lean stays forward. There is no camera-facing lookAt or billboard.
 *  Idle drivers are still, and reduced motion keeps the resting pose intact.
 */
export function updateDriverPose(driver,{steer=0,mood='base',time=0,speed=0,motion=true}={}) {
  const pose=driver?.userData?.pose;if(!pose)return;
  const turn=Math.max(-1,Math.min(1,Number.isFinite(steer)?steer:0));
  const moving=speed>1,cheer=mood==='cheer';
  pose.rig.rotation.z=motion&&moving?-turn*.055:0;
  pose.head.rotation.y=motion&&moving?turn*.045:0;
  pose.head.rotation.x=motion&&moving?(cheer?-.025:.013)*Math.sin((Number.isFinite(time)?time:0)*3):0;
  for(const arm of pose.arms)arm.rotation.z=motion&&moving?-turn*.02:0;
  for(const eye of pose.eyes)eye.scale.y=eye.userData.baseScaleY*(mood==='focus'?.94:cheer?1.035:1);
}
