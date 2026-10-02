import * as THREE from './vendor/three.module.js';

// Original, texture-free convertible / rally silhouettes. The car is assembled
// from curved exterior panels with an open cockpit and real wheel apertures;
// paint, rubber, satin metal, glass and upholstery retain separate light response.
// Every silhouette shares the supplied coupe's road footprint and rolling axle
// contract, so the collection has no collision or speed advantage.
const TAU = Math.PI * 2;
const vector = p => new THREE.Vector3(...p);
let finishTexture;
function microFinish() {
  // A very small deterministic roughness variation breaks a perfectly plastic
  // reflection. It is shared by all finishes, uses no image/network request,
  // and stays a non-colour data texture rather than tinting the player's paint.
  if(finishTexture)return finishTexture;
  const size=64,data=new Uint8Array(size*size*4);let seed=71;
  for(let i=0;i<size*size;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const v=226+(seed>>>27);data.set([v,v,v,255],i*4);
  }
  finishTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  finishTexture.wrapS=finishTexture.wrapT=THREE.RepeatWrapping;
  finishTexture.repeat.set(26,26);finishTexture.magFilter=THREE.LinearFilter;
  finishTexture.minFilter=THREE.LinearMipmapLinearFilter;finishTexture.generateMipmaps=true;finishTexture.needsUpdate=true;
  return finishTexture;
}
const physical = color => new THREE.MeshPhysicalMaterial({color,metalness:.32,roughness:.265,roughnessMap:microFinish(),clearcoat:1,clearcoatRoughness:.11,envMapIntensity:1.08});

function mesh(parent, geometry, material, position=[0,0,0], rotation=[0,0,0], name='') {
  const part = new THREE.Mesh(geometry,material);
  part.position.set(...position);part.rotation.set(...rotation);part.name=name;
  part.castShadow=true;part.receiveShadow=true;parent.add(part);return part;
}

function roundedBox(width,height,depth,radius=.04) {
  const x=width/2-radius,y=height/2-radius,r=Math.min(radius,x,y),s=new THREE.Shape();
  s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);
  s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);
  s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
  const closeSurface=width>.2&&height>.11&&depth>.12;
  const geometry=new THREE.ExtrudeGeometry(s,{depth:Math.max(.01,depth-radius*2),bevelEnabled:true,bevelSegments:closeSurface?3:2,steps:1,bevelSize:radius,bevelThickness:radius,curveSegments:closeSurface?4:3});
  geometry.translate(0,0,-(depth-radius*2)/2);return geometry;
}

function tube(parent,points,radius,material,segments=16,name='') {
  const curve=new THREE.CatmullRomCurve3(points.map(vector));
  return mesh(parent,new THREE.TubeGeometry(curve,segments,radius,6,false),material,[0,0,0],[0,0,0],name);
}

function addWheels(car,rally,rimMaterial) {
  const rubber=new THREE.MeshStandardMaterial({color:0x171b1e,roughness:.91,metalness:.015});
  const brake=new THREE.MeshStandardMaterial({color:0x818b8e,roughness:.45,metalness:.88});
  const caliper=new THREE.MeshStandardMaterial({color:rally?0xcf7954:0xb65549,roughness:.43,metalness:.18});
  const cavity=new THREE.MeshStandardMaterial({color:0x0e1519,roughness:.75,metalness:.12});
  const radius=rally?.405:.355,width=rally?.34:.28,y=radius+.03;
  // A closed revolved tire has a rounded shoulder and recessed sidewall. The
  // axis is local X, matching the supplied model and the driving animation.
  const tireProfile=[
    [radius*.66,-width*.47],[radius*.88,-width*.50],[radius*.96,-width*.39],
    [radius,-width*.23],[radius,width*.23],[radius*.96,width*.39],
    [radius*.88,width*.50],[radius*.66,width*.47],[radius*.66,-width*.47]
  ].map(p=>new THREE.Vector2(...p));
  const tireGeometry=new THREE.LatheGeometry(tireProfile,32);
  const discGeometry=new THREE.CylinderGeometry(radius*.60,radius*.60,.02,28);
  const spokeShape=new THREE.Shape();
  spokeShape.moveTo(-.018,.045);spokeShape.lineTo(-.025,radius*.69);
  spokeShape.lineTo(.009,radius*.75);spokeShape.lineTo(.023,.048);spokeShape.closePath();
  const spokeGeometry=new THREE.ExtrudeGeometry(spokeShape,{depth:.024,bevelEnabled:true,bevelSize:.005,bevelThickness:.004,bevelSegments:1,curveSegments:1});
  spokeGeometry.translate(0,0,-.012);spokeGeometry.rotateY(Math.PI/2);
  const treadGeometry=rally?new THREE.BoxGeometry(width*.72,.020,.075):null;
  car.userData.wheels=[];car.userData.rimMeshes=[];
  for(const [name,x,z] of [['wheel_fl',-.94,1.34],['wheel_fr',.94,1.34],['wheel_rl',-.94,-1.3],['wheel_rr',.94,-1.3]]){
    const wheel=new THREE.Group();wheel.name=name;wheel.position.set(x,y,z);car.add(wheel);
    mesh(wheel,tireGeometry,rubber,[0,0,0],[0,0,Math.PI/2],'tire');
    const side=Math.sign(x),face=side*(width/2+.005);
    const ring=mesh(wheel,new THREE.TorusGeometry(radius*.725,radius*.035,7,32),rimMaterial,[face,0,0],[0,Math.PI/2,0],`rim_${name}`);
    car.userData.rimMeshes.push(ring);
    mesh(wheel,new THREE.CylinderGeometry(radius*.70,radius*.70,.05,24),cavity,[face-side*.04,0,0],[0,0,Math.PI/2],'rim-cavity');
    mesh(wheel,discGeometry,brake,[face-side*.018,0,0],[0,0,Math.PI/2],`disc_${name}`);
    // Brake calipers are attached to the upright, not the spinning rim.
    mesh(car,roundedBox(.04,.12,.09,.018),caliper,[x+face-side*.008,y+radius*.41,z+radius*.33],[0,0,0],`brake-caliper-${name}`);
    // Five pairs of sculpted spokes use one draw call per wheel.
    const spokes=new THREE.InstancedMesh(spokeGeometry,rimMaterial,10),transform=new THREE.Object3D();
    for(let i=0;i<10;i++){
      const angle=Math.floor(i/2)*TAU/5+(i%2? .11:-.11);
      transform.position.set(face,0,0);transform.rotation.set(angle,0,0);transform.updateMatrix();spokes.setMatrixAt(i,transform.matrix);
    }
    spokes.castShadow=true;spokes.receiveShadow=true;wheel.add(spokes);car.userData.rimMeshes.push(spokes);
    const hub=mesh(wheel,new THREE.CylinderGeometry(radius*.16,radius*.16,.04,16),rimMaterial,[face+side*.01,0,0],[0,0,Math.PI/2],`rim_hub_${name}`);
    car.userData.rimMeshes.push(hub);
    const bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.009,.009,.012,6),brake,5);
    for(let i=0;i<5;i++){
      const theta=i*TAU/5;transform.position.set(face+side*.035,Math.cos(theta)*radius*.105,Math.sin(theta)*radius*.105);
      transform.rotation.set(0,0,Math.PI/2);transform.updateMatrix();bolts.setMatrixAt(i,transform.matrix);
    }
    wheel.add(bolts);
    // A fine sidewall bead reads as tire construction, rather than a flat disc.
    mesh(wheel,new THREE.TorusGeometry(radius*.87,.005,4,32),rubber,[side*width*.47,0,0],[0,Math.PI/2,0],'sidewall-bead');
    if(rally){
      const tread=new THREE.InstancedMesh(treadGeometry,rubber,24);
      for(let j=0;j<24;j++){
        const theta=j*TAU/24;
        transform.position.set(0,Math.cos(theta)*(radius-.01),Math.sin(theta)*(radius-.01));transform.rotation.set(theta,0,(j%2?1:-1)*.14);transform.updateMatrix();tread.setMatrixAt(j,transform.matrix);
      }
      tread.castShadow=true;tread.receiveShadow=true;wheel.add(tread);
    }
    batchWheel(wheel,car.userData.rimMeshes);
    car.userData.wheels.push(wheel);
  }
}

function combinedGeometry(parts) {
  const positions=[],normals=[],uvs=[],indices=[];let offset=0;
  const transform=new THREE.Matrix4(),instance=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),p=new THREE.Vector3(),n=new THREE.Vector3();
  for(const part of parts){
    part.updateMatrix();const geometry=part.geometry,position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    const count=part.isInstancedMesh?part.count:1;
    for(let j=0;j<count;j++){
      transform.copy(part.matrix);
      if(part.isInstancedMesh){part.getMatrixAt(j,instance);transform.multiply(instance);}
      normalMatrix.getNormalMatrix(transform);
      for(let i=0;i<position.count;i++){
        p.fromBufferAttribute(position,i).applyMatrix4(transform);positions.push(p.x,p.y,p.z);
        if(normal)n.fromBufferAttribute(normal,i).applyNormalMatrix(normalMatrix);else n.set(0,1,0);
        normals.push(n.x,n.y,n.z);uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);
      }
      if(geometry.index)for(let i=0;i<geometry.index.count;i++)indices.push(offset+geometry.index.getX(i));
      else for(let i=0;i<position.count;i++)indices.push(offset+i);
      offset+=position.count;
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}

function batchWheel(wheel,rimMeshes) {
  const groups=shadowBatches(wheel.children.filter(part=>part.isMesh&&!Array.isArray(part.material))),oldRims=new Set(rimMeshes);
  for(const {material,parts,castShadow,receiveShadow} of groups){
    const rim=parts.some(p=>oldRims.has(p)||p.name.startsWith('rim_'));
    if(parts.length===1&&!parts[0].isInstancedMesh){if(rim&&!rimMeshes.includes(parts[0]))rimMeshes.push(parts[0]);continue;}
    const combined=mesh(wheel,combinedGeometry(parts),material,[0,0,0],[0,0,0],rim?`rim_${wheel.name}`:`wheel-detail-${groups.length}-${wheel.children.length}`);
    combined.castShadow=castShadow;combined.receiveShadow=receiveShadow;
    for(const part of parts){wheel.remove(part);const i=rimMeshes.indexOf(part);if(i>=0)rimMeshes.splice(i,1);}
    if(rim)rimMeshes.push(combined);
  }
}

function shadowBatches(parts) {
  // A shared trim material can be used both inside and outside the chassis.
  // Material-only batching would make the hidden interior cast again.
  const byMaterial=new Map(),groups=[];
  for(const part of parts){
    let partitions=byMaterial.get(part.material);
    if(!partitions){partitions=new Map();byMaterial.set(part.material,partitions);}
    const key=`${part.castShadow?1:0}${part.receiveShadow?1:0}`;
    let group=partitions.get(key);
    if(!group){group={material:part.material,castShadow:part.castShadow,receiveShadow:part.receiveShadow,parts:[]};partitions.set(key,group);groups.push(group);}
    group.parts.push(part);
  }
  return groups;
}

function addJets(car,color=0xb3f5ff) {
  const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false});
  car.userData.jets=[];
  for(const x of [-.3,.3]){
    const jet=mesh(car,new THREE.ConeGeometry(.07,.58,8),material,[x,.30,-2.12],[-Math.PI/2,0,0]);
    jet.castShadow=false;jet.receiveShadow=false;jet.visible=false;car.userData.jets.push(jet);
  }
}

function addContactShadow(car) {
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv; void main(){vec2 p=(vUv-.5)*2.0;float alpha=.42*exp(-dot(p,p)*3.2)*(1.0-smoothstep(.78,1.0,max(abs(p.x),abs(p.y))));gl_FragColor=vec4(.02,.035,.04,alpha);}'
  });
  const shadow=mesh(car,new THREE.PlaneGeometry(2.30,4.5),material,[0,.014,0],[-Math.PI/2,0,0],'contact-shadow');
  shadow.castShadow=false;shadow.receiveShadow=false;
}

function addBadge(car) {
  const group=new THREE.Group();group.name='shared-badge';group.position.set(0,.82,-1.96);
  mesh(group,new THREE.CylinderGeometry(.095,.095,.02,6),physical(0xd7b97a),[0,0,0],[Math.PI/2,0,0]);
  mesh(group,new THREE.TorusGeometry(.062,.012,5,12),new THREE.MeshBasicMaterial({color:0xc9eeec}),[0,0,-.018]);
  group.visible=false;car.add(group);car.userData.badge=group;
}

function addLighting(car,rally) {
  const rear=new THREE.MeshPhysicalMaterial({color:0x9f2b27,emissive:0xd9402b,emissiveIntensity:.48,roughness:.17,clearcoat:1});
  const front=new THREE.MeshPhysicalMaterial({color:0xddecef,emissive:0xc7e2eb,emissiveIntensity:.24,roughness:.13,metalness:.10,clearcoat:1});
  const trim=new THREE.MeshStandardMaterial({color:0x18272d,metalness:.48,roughness:.36});
  const reflector=new THREE.MeshStandardMaterial({color:0x98abb2,metalness:.86,roughness:.27});
  for(const sign of [-1,1]){
    const rearX=sign*(rally?.46:.48),rearY=rally?.68:.615,rearZ=rally?-1.94:-2.065;
    mesh(car,roundedBox(.37,.077,.032,.021),trim,[rearX,rearY,rearZ]);
    mesh(car,roundedBox(.31,.038,.014,.008),rear,[rearX,rearY,rearZ-.019]);
    // Separate inlaid light guides and a tiny reflector sit flush in the fascia,
    // rather than oversized white blocks protruding out of the hood.
    for(const strip of [-1,1])mesh(car,roundedBox(.27,.009,.008,.003),rear,[rearX,rearY+strip*.011,rearZ-.028]);
    const frontX=sign*.55,frontY=rally?.665:.607,frontZ=rally?1.875:1.972;
    mesh(car,roundedBox(.35,.068,.046,.020),trim,[frontX,frontY,frontZ],[0,sign*-.10,0]);
    mesh(car,roundedBox(.292,.033,.014,.010),front,[frontX,frontY,frontZ+.027],[0,sign*-.10,0]);
    for(const x of [-.085,.015,.085])mesh(car,new THREE.SphereGeometry(.020,10,6),reflector,[frontX+x,frontY+.002,frontZ+.029],[0,0,0],'lamp-projector');
  }
  mesh(car,roundedBox(rally?1.38:1.16,.095,.065,.025),trim,[0,rally?.59:.405,rally?1.91:2.08]);
  if(rally){
    for(const x of [-.21,.21]){
      mesh(car,new THREE.CylinderGeometry(.115,.115,.075,20),trim,[x,.70,1.99],[Math.PI/2,0,0]);
      mesh(car,new THREE.CylinderGeometry(.092,.092,.016,20),front,[x,.70,2.036],[Math.PI/2,0,0]);
    }
    tube(car,[[-.9,.47,1.94],[-.84,.61,2.03],[.84,.61,2.03],[.9,.47,1.94]],.028,trim,16,'front-bumper');
  }
}

// Exterior surface patches meet at the belt line. Side panels end on each
// actual wheel arch; the top is split around the cabin instead of covering the
// seats with an opaque blob. All patches share one paint mesh / draw call.
function sculptedBody(rally=false) {
  const end=rally?1.96:2.10,start=rally?-1.97:-2.10;
  const stations=rally?
    [[start,.73,.65],[-1.75,.94,.81],[-1.3,1.035,.90],[-.75,.94,.88],[.3,.91,.86],[1.3,1.035,.895],[1.78,.88,.69],[end,.66,.56]]:
    [[start,.70,.59],[-1.9,.90,.71],[-1.3,1.035,.79],[-.76,.96,.76],[.30,.94,.74],[1.3,1.035,.77],[1.85,.87,.65],[end,.63,.52]];
  const curve=new THREE.CatmullRomCurve3(stations.map(([z,w,y])=>new THREE.Vector3(w,y,z)),false,'catmullrom',.35);
  const lookup=Array.from({length:97},(_,i)=>curve.getPoint(i/96));
  const at=t=>{
    const f=Math.max(0,Math.min(96,t*96)),i=Math.min(95,Math.floor(f));
    return lookup[i].clone().lerp(lookup[i+1],f-i);
  };
  const positions=[],uvs=[],indices=[];
  function patch(nu,nv,point,flip=false){
    const offset=positions.length/3;
    for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){
      const p=point(u/nu,v/nv);positions.push(...p);uvs.push(p[0]*.7+p[1]*.5,p[2]*.45);
    }
    for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){
      const a=offset+v*(nu+1)+u,b=a+1,c=a+nu+1,d=c+1;
      indices.push(...(flip?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
    }
  }
  const archRadius=rally?.48:.425,wheelY=(rally?.405:.355)+.03;
  const top=(station,u)=>{
    const a=Math.abs(u),hood=Math.max(0,1-Math.abs(station.z-1.18)/.96);
    // Broad fender crowns and two quiet bonnet ridges carry continuous HDR
    // reflections. The centre drops slightly, avoiding a flat toy-like slab.
    return station.y+.10*a*a-.07*Math.pow(a,8)+hood*.023*Math.exp(-Math.pow((a-.52)/.16,2));
  };
  // Hood and rear deck have broad, continuous reflections. The remaining
  // shoulder patches frame a genuinely open cabin.
  const rearEnd=rally?.235:.25,frontStart=rally?.64:.64,cabinWidth=.66;
  for(const [from,to] of [[0,rearEnd],[frontStart,1]])patch(24,24,(u,v)=>{
    const p=at(from+(to-from)*v),x=u*2-1;return[p.x*x,top(p,x),p.z];
  });
  for(const sign of [-1,1])patch(8,28,(u,v)=>{
    const p=at(rearEnd+(frontStart-rearEnd)*v),x=sign*(cabinWidth+(1-cabinWidth)*u);
    return[p.x*x,top(p,x),p.z];
  },sign<0);
  for(const sign of [-1,1])patch(96,7,(u,v)=>{
    const p=at(u);let lower=rally?.34:.25;
    for(const wheelZ of [-1.3,1.34]){
      const dz=p.z-wheelZ;if(Math.abs(dz)<archRadius)lower=Math.max(lower,wheelY+Math.sqrt(archRadius*archRadius-dz*dz));
    }
    const upper=top(p,1),y=lower+(Math.max(lower+.006,upper)-lower)*v;
    return[sign*p.x*(.93+.07*Math.sin(v*Math.PI/2)),y,p.z];
  },sign<0);
  // Curved nose and tail finish the shell below the lamps.
  for(const [t,reverse] of [[0,false],[1,true]])patch(24,5,(u,v)=>{
    const p=at(t),x=u*2-1;return[p.x*x,(rally?.34:.25)+(top(p,x)-(rally?.34:.25))*v,p.z+(t===1?-.02:.02)*Math.sin(u*Math.PI)];
  },reverse);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function addInterior(car,trim,rally=false) {
  const saddle=new THREE.MeshPhysicalMaterial({color:rally?0x3b4c50:0x89725f,roughness:.92,roughnessMap:microFinish(),metalness:0,sheen:.20,sheenRoughness:1});
  const insert=new THREE.MeshStandardMaterial({color:rally?0x263a40:0x393733,roughness:.87,roughnessMap:microFinish(),metalness:.02});
  const satin=new THREE.MeshStandardMaterial({color:0x8c989b,roughness:.42,metalness:.78});
  const base=rally?.91:.72,back=rally?-.54:-.64;
  mesh(car,roundedBox(1.38,.09,1.44,.08),trim,[0,base-.13,-.2],[0,0,0],'cockpit-floor');
  for(const x of [-.38,.38]){
    mesh(car,roundedBox(.45,.42,.16,.07),saddle,[x,base+.24,back],[-.17,0,0],'seat-back');
    mesh(car,roundedBox(.34,.30,.026,.045),insert,[x,base+.25,back+.12],[-.17,0,0],'seat-insert');
    mesh(car,roundedBox(.45,.11,.52,.06),saddle,[x,base,-.30],[0,0,0],'seat-cushion');
    mesh(car,roundedBox(.235,.125,.13,.045),saddle,[x,base+.49,back-.035],[-.12,0,0],'head-rest');
    for(const side of [-1,1])tube(car,[[x+side*.18,base+.05,back+.07],[x+side*.19,base+.25,back+.065],[x+side*.16,base+.38,back+.04]],.033,saddle,9,'seat-bolster');
    // Two small seams catch light at the edge without competing with the body.
    for(const side of [-1,1])tube(car,[[x+side*.12,base-.005,-.12],[x+side*.12,base-.005,-.42]],.004,satin,3,'seat-seam');
  }
  mesh(car,roundedBox(1.25,.13,.28,.06),trim,[0,base+.14,.41],[0,0,0],'dashboard');
  tube(car,[[-.56,base+.12,.257],[0,base+.12,.249],[.56,base+.12,.257]],.008,satin,14,'dash-inlay');
  const display=new THREE.MeshStandardMaterial({color:0x101d23,emissive:0x237780,emissiveIntensity:.17,roughness:.24,metalness:.1});
  mesh(car,roundedBox(.14,.069,.008,.012),display,[-.08,base+.18,.263],[.05,0,0],'dash-display');
  for(const x of [-.48,.18,.52]){
    mesh(car,roundedBox(.085,.051,.011,.014),insert,[x,base+.17,.263],[.05,0,0],'air-vent');
    for(let i=0;i<3;i++)mesh(car,roundedBox(.069,.004,.007,.001),satin,[x,base+.155+i*.012,.251]);
  }
  mesh(car,roundedBox(.17,.10,.90,.035),trim,[0,base+.05,-.09],[0,0,0],'console');
  mesh(car,new THREE.SphereGeometry(.027,10,6),satin,[0,base+.16,-.04],[0,0,0],'gear-knob');
  mesh(car,new THREE.CylinderGeometry(.009,.009,.11,6),satin,[0,base+.105,-.04]);
  // The driver occupies the right seat in this camera convention. The wheel
  // remains in front of the hands and faces back into the cabin.
  const steering=new THREE.Group();steering.name='steering-wheel';steering.position.set(.38,base+.26,.14);steering.rotation.x=-.24;
  mesh(steering,new THREE.TorusGeometry(.125,.014,7,24),trim);
  mesh(steering,new THREE.CylinderGeometry(.034,.034,.036,12),satin,[0,0,0],[Math.PI/2,0,0]);
  for(let i=0;i<3;i++)mesh(steering,roundedBox(.018,.095,.014,.004),satin,[Math.sin(i*TAU/3)*.06,Math.cos(i*TAU/3)*.06,0],[0,0,-i*TAU/3]);
  batchWheel(steering,[]);
  car.add(steering);
  // A recessed instrument pack and small flush screen read as an interior,
  // avoiding oversized decorative boxes visible from the chase camera.
  for(const x of [.30,.45])mesh(car,new THREE.CylinderGeometry(.046,.046,.012,16),insert,[x,base+.24,.28],[Math.PI/2-.1,0,0],'gauge');
  for(const side of [-1,1])mesh(car,roundedBox(.045,.17,1.00,.025),insert,[side*.70,base+.065,-.18]);
}

function addExteriorDetails(car,paint,trim,glass,rally=false,edition=false) {
  const chrome=new THREE.MeshStandardMaterial({color:0xc4d0d3,metalness:.90,roughness:.23});
  const black=new THREE.MeshStandardMaterial({color:0x101c23,metalness:.22,roughness:.56});
  const frontZ=rally?1.97:2.1,rearZ=rally?-1.98:-2.11;
  for(const side of [-1,1]){
    // Slim door cut, sill and a flush pull handle follow the sculpted shoulder.
    tube(car,[[side*.93,.74,-.88],[side*.95,.43,-.83],[side*.94,.38,.44],[side*.92,.70,.63]],.007,black,18,'door-seam');
    mesh(car,roundedBox(.02,.025,.14,.009),chrome,[side*.98,rally?.86:.74,-.51]);
    tube(car,[[side*.89,rally?1.06:.94,.39],[side*1.02,rally?1.075:.965,.42]],.018,trim,4,'mirror-arm');
    const mirror=mesh(car,new THREE.SphereGeometry(1,14,8),paint,[side*1.035,rally?1.10:1.0,.42]);mirror.scale.set(.095,.058,.14);car.userData.body.push(mirror);
    const face=mesh(car,new THREE.SphereGeometry(1,12,6),chrome,[side*1.035,rally?1.10:1.0,.323]);face.scale.set(.073,.044,.020);
    mesh(car,roundedBox(.038,.07,1.42,.017),trim,[side*.935,rally?.39:.285,-.02],[0,0,0],'sill');
  }
  // Recessed rear diffuser with thin vanes, twin stainless exhaust outlets and
  // side intake pockets remain visible in the actual racing camera.
  mesh(car,roundedBox(1.05,.15,.065,.035),black,[0,rally?.47:.35,rearZ],[0,0,0],'rear-diffuser');
  for(const x of [-.36,-.18,0,.18,.36])mesh(car,roundedBox(.022,.16,.22,.01),trim,[x,rally?.41:.285,rearZ+.09],[0,0,0],'diffuser-vane');
  for(const x of [-.57,.57]){
    mesh(car,new THREE.CylinderGeometry(.067,.067,.09,16,1,true),chrome,[x,rally?.47:.35,rearZ-.005],[Math.PI/2,0,0],'exhaust');
    mesh(car,new THREE.CircleGeometry(.055,16),black,[x,rally?.47:.35,rearZ-.055],[0,Math.PI,0]);
    mesh(car,roundedBox(.26,.075,.026,.020),black,[x,rally?.71:.61,frontZ+.008],[0,0,0],'intake-pocket');
  }
  mesh(car,roundedBox(.66,.11,.025,.025),black,[0,rally?.56:.405,frontZ+.035],[0,0,0],'front-intake');
  const slats=new THREE.InstancedMesh(new THREE.BoxGeometry(.52,.008,.015),chrome,4),transform=new THREE.Object3D();
  for(let i=0;i<4;i++){transform.position.set(0,(rally?.53:.375)+i*.020,frontZ+.051);transform.updateMatrix();slats.setMatrixAt(i,transform.matrix);}car.add(slats);
  // A shaped front lip extends under the nose rather than covering the grille.
  tube(car,[[-.64,rally?.35:.255,frontZ-.07],[-.35,rally?.32:.23,frontZ+.045],[.35,rally?.32:.23,frontZ+.045],[.64,rally?.35:.255,frontZ-.07]],.022,trim,18,'front-lip');
  // A thin rear deck edge provides an intentional highlight across the car.
  tube(car,[[-.64,rally?.83:.68,rearZ+.18],[0,rally?.85:.70,rearZ+.1],[.64,rally?.83:.68,rearZ+.18]],.012,edition?chrome:paint,20,'deck-edge');
  if(edition){
    // The chapter reward has a distinct aero silhouette, but identical handling.
    for(const x of [-.56,.56])mesh(car,roundedBox(.038,.16,.07,.012),trim,[x,.88,-1.72]);
    const wing=mesh(car,roundedBox(1.62,.055,.23,.023),paint,[0,.99,-1.76],[-.04,0,0],'edition-wing');car.userData.body.push(wing);
    for(const x of [-.79,.79])mesh(car,roundedBox(.022,.12,.27,.01),trim,[x,1.02,-1.76]);
  }
}

function roadster(car,paint,trim,glass) {
  car.userData.body=[mesh(car,sculptedBody(),paint,[0,0,0],[0,0,0],'body')];
  addInterior(car,trim);addExteriorDetails(car,paint,trim,glass,false,car.userData.vehicleKind==='finale');
  // Open cabin and a slim curved screen keep the seated character visible.
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.72,.80,.69),new THREE.Vector3(-.58,1.21,.52),new THREE.Vector3(0,1.30,.49),new THREE.Vector3(.58,1.21,.52),new THREE.Vector3(.72,.80,.69)]);
  const screenPositions=[],screenIndices=[];
  for(let i=0;i<=24;i++){
    const p=curve.getPoint(i/24);screenPositions.push(p.x,.79,.72-Math.abs(p.x)*.035,p.x,p.y,p.z);
    if(i<24){const a=i*2;screenIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const screen=new THREE.BufferGeometry();screen.setAttribute('position',new THREE.Float32BufferAttribute(screenPositions,3));screen.setIndex(screenIndices);screen.computeVertexNormals();
  const windshield=mesh(car,screen,glass,[0,0,0],[0,0,0],'windscreen');windshield.castShadow=false;
  tube(car,[[-.72,.80,.69],[-.58,1.21,.52],[0,1.30,.49],[.58,1.21,.52],[.72,.80,.69]],.020,trim,28,'windscreen-frame');
  tube(car,[[-.69,.79,.69],[0,.79,.72],[.69,.79,.69]],.024,trim,16,'windscreen-base');
  for(const x of [-.38,.38])tube(car,[[x-.15,.87,-.78],[x-.15,1.18,-.84],[x+.15,1.18,-.84],[x+.15,.87,-.78]],.025,trim,16,'roll-hoop');
  // Twin shoulder seams follow the sculpted rear deck, rather than a flat box.
  for(const x of [-.52,.52])tube(car,[[x,.72,-1.85],[x,.83,-1.4],[x,.78,-1.03]],.007,trim,16);
  car.userData.seatPosition=[.38,.69,-.23];car.userData.seatHeight=.69;
}

function rally(car,paint,trim,glass) {
  car.userData.body=[mesh(car,sculptedBody(true),paint,[0,0,0],[0,0,0],'body')];
  addInterior(car,trim,true);addExteriorDetails(car,paint,trim,glass,true);
  // Distinct raised rally cage, removable-looking aero panel and wheel guards.
  for(const z of [-.60,.48])tube(car,[[-.76,.95,z],[-.73,1.55,z],[0,1.68,z],[.73,1.55,z],[.76,.95,z]],.036,trim,18,'roll-cage');
  for(const x of [-.62,.62])tube(car,[[x,1.60,-.60],[x,1.60,.48]],.035,trim,4,'roof-rail');
  const windshield=mesh(car,roundedBox(1.22,.38,.018,.012),glass,[0,1.29,.46],[-.11,0,0],'windscreen');
  windshield.castShadow=false;
  for(const x of [-.97,.97])for(const z of [-1.3,1.34]){
    const arch=[];for(let i=0;i<=12;i++){const t=i*Math.PI/12;arch.push([x,.435+Math.sin(t)*.45,z+Math.cos(t)*.47]);}
    tube(car,arch,.059,trim,18,'wheel-guard');
  }
  car.userData.body.push(mesh(car,roundedBox(1.28,.07,.41,.025),paint,[0,1.04,-1.60]));
  mesh(car,roundedBox(1.38,.06,.20,.022),trim,[0,1.11,-1.69]);
  for(const x of [-.58,.58])mesh(car,roundedBox(.045,.22,.05,.014),trim,[x,.98,-1.68]);
  // Small side-panel accents preserve the body shape while separating materials.
  for(const side of [-1,1]){
    mesh(car,roundedBox(.045,.11,.80,.019),trim,[side*.87,.85,-.04]);
    car.userData.body.push(mesh(car,roundedBox(.12,.085,.24,.023),paint,[side*.96,1.18,.44]));
  }
  car.userData.seatPosition=[.36,.86,-.17];car.userData.seatHeight=.86;
}

function batchStaticPanels(car) {
  // Small seams, upholstery and exterior fixtures are fixed relative to the
  // chassis. Bake them per material, retaining independent wheels, steering,
  // exhaust feedback, glazing, badge and named cage for animation / inspection.
  const excluded=new Set([...(car.userData.jets||[]),car.getObjectByName('windscreen')]);
  const bodyParts=new Set(car.userData.body||[]),eligible=[];
  for(const part of [...car.children]){
    if(!part.isMesh||part.isInstancedMesh||excluded.has(part)||part.name==='roll-cage'||Array.isArray(part.material)||part.material.isShaderMaterial)continue;
    eligible.push(part);
  }
  const groups=shadowBatches(eligible);
  const newBody=[];
  for(const {material,parts,castShadow,receiveShadow} of groups){
    const isBody=parts.some(p=>bodyParts.has(p));
    if(parts.length===1){if(isBody)newBody.push(parts[0]);continue;}
    const geometry=combinedGeometry(parts);for(const part of parts)car.remove(part);
    const combined=mesh(car,geometry,material,[0,0,0],[0,0,0],isBody?'body':`chassis-details-${groups.length}-${car.children.length}`);
    combined.castShadow=castShadow;combined.receiveShadow=receiveShadow;
    if(isBody)newBody.push(combined);
  }
  car.userData.body=newBody;
}

export function buildAlternativeCar(kind,{color=0x99c8bc,wheelColor=0xd5dadc,trailColor=0xb3f5ff}={}) {
  if(!['roadster','open','rally','finale'].includes(kind))throw new RangeError(`Unknown vehicle silhouette: ${kind}`);
  const car=new THREE.Group();car.name=`vehicle-${kind}`;car.userData.vehicleKind=kind;
  const paint=physical(color),trim=new THREE.MeshStandardMaterial({color:0x243138,metalness:.18,roughness:.57});
  const glass=new THREE.MeshPhysicalMaterial({color:0xa5c7cf,metalness:.04,roughness:.065,transparent:true,opacity:.25,side:THREE.DoubleSide,depthWrite:false,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.35});
  const rim=new THREE.MeshStandardMaterial({color:wheelColor,metalness:.95,roughness:.25});
  const isRally=kind==='rally';if(isRally)rally(car,paint,trim,glass);else roadster(car,paint,trim,glass);
  addWheels(car,isRally,rim);addLighting(car,isRally);addJets(car,trailColor);addBadge(car);addContactShadow(car);batchStaticPanels(car);
  car.userData.modelStats=vehicleStats(car);
  return car;
}

function vehicleStats(car) {
  let triangles=0,drawCalls=0,shadowTriangles=0,shadowDrawCalls=0;
  car.traverse(p=>{if(p.isMesh)triangles+=(p.geometry.index?p.geometry.index.count:p.geometry.attributes.position.count)/3*(p.isInstancedMesh?p.count:1);});
  car.traverseVisible(p=>{if(p.isMesh){drawCalls++;if(p.castShadow){shadowDrawCalls++;shadowTriangles+=(p.geometry.index?p.geometry.index.count:p.geometry.attributes.position.count)/3*(p.isInstancedMesh?p.count:1);}}});
  return {triangles,drawCalls,shadowTriangles,shadowDrawCalls};
}

/** Apply the collection's finish to the supplied original GT. Its authored
 *  shape / UVs, rolling axles and open seat remain caller-owned. Call after
 *  assigning the original materials and userData.model / userData.wheels. */
export function refineOriginalCar(car) {
  if(car.userData.graphicsRefined)return car;
  const model=car.userData.model;
  if(!model)throw new TypeError('Original vehicle requires userData.model');
  model.traverse(part=>{
    if(!part.isMesh)return;
    // Dense seats, dashboard, steering and tiny inset lights/brakes do not
    // affect the exterior silhouette. Keep their receiving/visible geometry,
    // but stop submitting them to the directional-light shadow pass.
    if(['interior_dark','interior_light','leather','carpet','brakes','brake','lights','leds','lights_red'].includes(part.name)||part.name.startsWith('steering_'))part.castShadow=false;
    if(Array.isArray(part.material))return;
    const material=part.material;
    if(part.name==='body'&&material.isMeshPhysicalMaterial){
      material.roughness=.265;material.roughnessMap=microFinish();material.metalness=.32;
      material.clearcoatRoughness=.11;material.envMapIntensity=1.08;material.needsUpdate=true;
    }else if(['leather','carpet','steering_leather','tire'].includes(part.name)&&material.isMeshStandardMaterial){
      material.roughnessMap=microFinish();material.needsUpdate=true;
    }
  });
  car.userData.rimMeshes=[];
  for(const wheel of car.userData.wheels||[])batchWheel(wheel,car.userData.rimMeshes);
  // Bake only sibling fixtures under the fixed chassis. Dynamic axle and
  // steering groups keep their hierarchy and individual rotation transforms.
  const main=model.getObjectByName('main');
  if(main){main.userData.body=main.children.filter(p=>p.name==='body');batchStaticPanels(main);}
  const steering=model.getObjectByName('steering_wheel');if(steering)batchWheel(steering,[]);
  car.userData.graphicsRefined=true;car.userData.modelStats=vehicleStats(car);return car;
}

function colorValue(value,fallback) {
  if(value===undefined||value===null)return fallback;
  if(typeof value==='object'&&'color' in value)return value.color;
  return value;
}

export function customizeCar(car,{paint,wheelColor,trailColor,badge}={}) {
  // Clone per-car materials once: customization of a GLB must not tint rivals.
  if(!car.userData.customizable){
    const materials=new Map();car.traverse(part=>{
      if(!part.isMesh)return;
      const clone=m=>{if(!materials.has(m))materials.set(m,m.clone());return materials.get(m);};
      part.material=Array.isArray(part.material)?part.material.map(clone):clone(part.material);
    });car.userData.customizable=true;
  }
  const body=new Set(car.userData.body||[]),rims=new Set(car.userData.rimMeshes||[]),jets=new Set(car.userData.jets||[]);
  car.traverse(part=>{
    if(!part.isMesh)return;
    const materials=Array.isArray(part.material)?part.material:[part.material];
    for(const material of materials){
      if(paint!==undefined&&(body.has(part)||part.name==='body'))material.color?.set(colorValue(paint));
      if(wheelColor!==undefined&&(rims.has(part)||part.name.startsWith('rim_')))material.color?.set(colorValue(wheelColor));
      if(trailColor!==undefined&&jets.has(part))material.color?.set(colorValue(trailColor));
    }
  });
  if(badge!==undefined){if(!car.userData.badge)addBadge(car);car.userData.badge.visible=Boolean(badge);}
}

export function createGarageStage(scene) {
  const group=new THREE.Group();group.name='garage-stage';group.visible=false;
  const platform=new THREE.MeshStandardMaterial({color:0x27383d,roughness:.42,metalness:.28});
  mesh(group,new THREE.CylinderGeometry(3.95,4.18,.16,64),platform,[0,-.095,0]).castShadow=false;
  mesh(group,new THREE.TorusGeometry(3.89,.026,6,64),new THREE.MeshBasicMaterial({color:0x97d4c9}),[0,-.01,0],[Math.PI/2,0,0]);
  // The world already supplies sun, ambient and HDR reflections. Gentle studio
  // accents preserve paint / felt detail rather than stacking a second full sun.
  const key=new THREE.DirectionalLight(0xfff1dc,.80);key.position.set(-3,7,4);key.target.position.set(0,.7,0);group.add(key,key.target);
  const fill=new THREE.DirectionalLight(0xb3ddff,.45);fill.position.set(4,3,-4);group.add(fill);
  group.add(new THREE.HemisphereLight(0xc4e9ee,0x31443d,.20));
  // The car can be viewed through a full orbit. Keep the lights above the
  // studio without a physical arch that crosses the vehicle at rear angles.
  const vehicleRoot=new THREE.Group();group.add(vehicleRoot);scene?.add(group);
  let preview=null;
  return {
    group,
    place(car){
      if(preview&&preview!==car)vehicleRoot.remove(preview);
      preview=car;vehicleRoot.add(car);car.position.set(0,0,0);car.rotation.set(0,0,0);return car;
    },
    clear(){if(preview)vehicleRoot.remove(preview);const old=preview;preview=null;return old;},
    dispose(){
      // Preview ownership stays with the caller; only the studio is disposed.
      this.clear();const geometries=new Set(),materials=new Set();
      group.traverse(part=>{if(part.isMesh){geometries.add(part.geometry);for(const material of Array.isArray(part.material)?part.material:[part.material])materials.add(material);}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent();
    }
  };
}
