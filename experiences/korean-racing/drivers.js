// Game adaptations of the approved 4K mascots and measured proportions in
// docs/캐릭터/마스코트_치수_정본_v1.md. The unseen backs are a new game model,
// not a claim that an approved original 3D character already exists.
// Geometry faces local +Z. The origin is the seated pelvis, not the feet.
export const DRIVER_FELT_URL = './assets/felt/driver-felt.webp';
export const DRIVER_SPECS = Object.freeze({
  marin: Object.freeze({label:'마린',forward:[0,0,1],helmet:0x283158,eyes:0xf5cd58,body:0xcbb7a8,eyeMaterial:'matte-felt'}),
  kkamong: Object.freeze({label:'까몽',forward:[0,0,1],body:0x302326,iris:0x799459,eyeMaterial:'glass'})
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
function softFold(T,parent,material,name,position,scale,rotation) {
  // Tiny ambiguous felt folds preserve Kkamong's silhouette. These are not
  // new limbs, horns or a bat wing skeleton (guide anatomy-actions).
  const geometry=new T.SphereGeometry(1,24,12),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),x=p.getX(i),z=p.getZ(i),t=.78+.22*(1-y)*.5;
    p.setXYZ(i,x*t,y,z*t);
  }
  geometry.computeVertexNormals();return part(T,parent,geometry,material,name,position,scale,rotation);
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
  const dark=wool(T,0x302326,texture,{sheen:.88}),warm=wool(T,0x594137,texture),fold=wool(T,0x39282a,texture);
  const body=profile(T,[[0,-.045],[.14,-.040],[.235,.033],[.279,.170],[.293,.356],[.269,.527],[.218,.666],[.132,.724],[0,.737]],48,32);
  feltSurface(T,part(T,rig,body.geometry,dark,'kkamong-soft-body',[0,0,0],[1,1,.95]),(x,y,z)=>.96+.05*y+Math.sin(x*8+z*5)*.025);
  const head=new T.Group();head.name='driver-kkamong-face';rig.add(head);
  for(const side of [-1,1]){
    softFold(T,rig,dark,`kkamong-top-fold-${side}`,[side*.207,.672,-.024],[.080,.135,.075],[0,0,side*-.22]);
    softFold(T,rig,fold,`kkamong-side-fold-${side}`,[side*.309,.339,-.082],[.114,.166,.076],[.12,0,side*-.86]);
  }
  // In the original Kkamong image the little tail is beside the body. Keep
  // it behind the seat and short, without introducing claws or long limbs.
  curveTube(T,rig,dark,'kkamong-tail',[[.184,.053,-.105],[.282,.055,-.205],[.338,.031,-.27],[.359,.04,-.326]],.054,20,8);
  ellipsoid(T,rig,dark,'kkamong-tail-tip',[.365,.047,-.337],[.088,.079,.097],20,12);
  const irisMaterial=new T.MeshPhysicalMaterial({color:0x799459,metalness:0,roughness:.25,clearcoat:.88,clearcoatRoughness:.09,envMapIntensity:1});
  const glass=new T.MeshPhysicalMaterial({color:0x050c08,metalness:0,roughness:.10,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.3});
  const eyes=[];
  for(const side of [-1,1]){
    const eye=new T.Group();eye.name=`driver-kkamong-eye-${side}`;eye.position.set(side*.098,.493,.246);eye.rotation.y=side*.21;head.add(eye);
    ellipsoid(T,eye,warm,'kkamong-eye-socket',[0,0,-.008],[.052,.057,.025],20,12);
    ellipsoid(T,eye,irisMaterial,'kkamong-iris',[0,0,0],[.041,.046,.017],28,16);
    const pupil=ellipsoid(T,eye,glass,'kkamong-glass-pupil',[0,0,.010],[.0303,.034,.018],28,16);pupil.userData.baseScaleY=pupil.scale.y;eyes.push(pupil);
  }
  fibres(T,rig,dark,'kkamong-fibres',random=>profilePoint(T,body.ring,.0+random()*.705,random()*TAU,.95),1400,913,.023);
  rig.scale.setScalar(1.09);
  return {head,eyes,arms:[],torso:rig.children[0]};
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
