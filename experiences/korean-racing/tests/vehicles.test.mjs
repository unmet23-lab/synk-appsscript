import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildAlternativeCar,customizeCar,createGarageStage,refineOriginalCar,setVehicleQuality} from '../vehicles.js';
import {loadVehicleModel} from '../qa/load-vehicle-model.mjs';

function drivingBounds(car){
  car.updateMatrixWorld(true);const box=new THREE.Box3();
  car.traverse(part=>{if(part.isMesh&&part.visible){
    if(part.isInstancedMesh){part.computeBoundingBox();box.union(part.boundingBox.clone().applyMatrix4(part.matrixWorld));}
    else{part.geometry.computeBoundingBox();box.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));}
  }});
  return box;
}

test('alternative silhouettes retain the road footprint and rolling axle contract',()=>{
  for(const kind of ['roadster','rally','finale']){
    const car=buildAlternativeCar(kind),bounds=drivingBounds(car),size=bounds.getSize(new THREE.Vector3());
    assert.equal(car.userData.wheels.length,4);assert.equal(car.userData.jets.length,2);
    assert(size.x<=2.32,`${kind} must fit the original collision width`);assert(size.z<=4.53,`${kind} must fit the coupe length`);
    assert(bounds.min.y>=0,`${kind} tires must contact the road rather than clip below it`);
    const front=car.userData.wheels.filter(w=>w.name.startsWith('wheel_f'));
    assert(front.every(w=>w.position.z>0));assert(car.userData.wheels.every(w=>Math.abs(w.position.x)===.94));
    assert(car.userData.body.every(b=>b.material.isMeshPhysicalMaterial));
    assert(car.userData.seatPosition.length===3);assert(car.userData.jets.every(j=>!j.visible));
    const body=car.userData.body[0];
    // These rays verify visible exterior winding and genuine openings. A solid
    // roof over the cabin or an opaque side through the wheel would regress the
    // geometry even if the car retained exactly the same collision box.
    body.updateMatrixWorld(true);
    const ray=new THREE.Raycaster();
    ray.set(new THREE.Vector3(0,2,1.6),new THREE.Vector3(0,-1,0));
    assert(ray.intersectObject(body).length>0,'hood must face the light / camera');
    ray.set(new THREE.Vector3(.38,2,-.23),new THREE.Vector3(0,-1,0));
    assert.equal(ray.intersectObject(body).length,0,'cabin must remain open above the seated driver');
    for(const side of [-1,1]){
      ray.set(new THREE.Vector3(side*2,.385,1.34),new THREE.Vector3(-side,0,0));
      assert.equal(ray.intersectObject(body).length,0,'body panel must end at the wheel arch');
      ray.set(new THREE.Vector3(side*2,.6,0),new THREE.Vector3(-side,0,0));
      assert(ray.intersectObject(body).length>0,'both door panels must face outwards');
    }
  }
  const open=buildAlternativeCar('roadster'),rally=buildAlternativeCar('rally');
  assert(drivingBounds(rally).max.y>drivingBounds(open).max.y+.2);
  assert(rally.getObjectByName('roll-cage'));assert(!open.getObjectByName('roll-cage'));
});

test('paint, rims, jets and a shared badge customize one car without tinting another',()=>{
  const first=buildAlternativeCar('roadster'),second=buildAlternativeCar('roadster');
  customizeCar(first,{paint:'#ed845f',wheelColor:'#cdb67a',trailColor:'#c68eef',badge:true});
  assert.equal(first.userData.body[0].material.color.getHexString(),'ed845f');
  assert(first.userData.rimMeshes.every(m=>m.material.color.getHexString()==='cdb67a'));
  assert(first.userData.jets.every(m=>m.material.color.getHexString()==='c68eef'));
  assert(first.userData.badge.visible);assert(!second.userData.badge.visible);
  assert.notEqual(second.userData.body[0].material.color.getHexString(),'ed845f');
  const glb=new THREE.Group(),shared=new THREE.MeshStandardMaterial({color:0xffffff});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),shared);body.name='body';glb.add(body);
  customizeCar(glb,{paint:'#678abc'});assert.equal(shared.color.getHexString(),'ffffff');assert.equal(body.material.color.getHexString(),'678abc');
});

test('studio preview replaces vehicles without disposing caller-owned geometry',()=>{
  const scene=new THREE.Scene(),studio=createGarageStage(scene),first=buildAlternativeCar('roadster'),second=buildAlternativeCar('rally');
  let disposed=false;second.userData.body[0].geometry.addEventListener('dispose',()=>{disposed=true;});
  assert(!studio.group.visible);studio.place(first);assert(first.parent);studio.place(second);assert.equal(first.parent,null);
  assert.equal(studio.clear(),second);assert.equal(second.parent,null);studio.place(second);studio.dispose();
  assert.equal(studio.group.parent,null);assert.equal(second.parent,null);assert.equal(disposed,false);
});

test('detailed wheels keep stationary calipers, independent rim colour and a bounded mobile mesh budget',()=>{
  for(const kind of ['roadster','rally','finale']){
    const car=buildAlternativeCar(kind);car.updateMatrixWorld(true);
    const caliperColour=kind==='rally'?'cf7954':'b65549',calipers=[];
    car.traverse(p=>{if(p.isMesh&&p.material.color?.getHexString()===caliperColour)calipers.push(p);});
    assert(calipers.length>0);assert(calipers.every(p=>p.parent===car),'calipers must stay on the fixed upright rather than spin with the rim');
    const fixed=car.children.filter(p=>p.isMesh&&!car.userData.jets.includes(p));
    const before=fixed.map(p=>p.matrixWorld.toArray());
    for(const wheel of car.userData.wheels)wheel.rotation.x=.9;
    car.updateMatrixWorld(true);
    assert.deepEqual(fixed.map(p=>p.matrixWorld.toArray()),before);
    assert(car.userData.wheels.every(w=>w.children.length<=5));
    assert(car.userData.wheels.every(w=>w.children.some(p=>!p.castShadow&&!p.receiveShadow)),'non-shadow-casting bolts must not inherit the neighbouring brake disc flags');
    assert.equal(car.userData.rimMeshes.length,4);
    customizeCar(car,{paint:'#678abc',wheelColor:'#dca565'});
    assert(car.userData.rimMeshes.every(p=>p.material.color.getHexString()==='dca565'));
    assert(car.userData.body.every(p=>p.material.color.getHexString()==='678abc'));
    assert(car.userData.modelStats.triangles<35000);
    assert(car.userData.modelStats.drawCalls<=40);
    assert.equal(car.userData.body[0].material.roughnessMap.colorSpace,THREE.NoColorSpace);
  }
});

test('GT interior and small fixtures stop casting while shared-material batches preserve every shadow partition and silhouette',()=>{
  const car=new THREE.Group(),model=new THREE.Group(),main=new THREE.Group();
  main.name='main';model.rotation.y=Math.PI;model.add(main);car.add(model);car.userData.model=model;
  const paint=new THREE.MeshPhysicalMaterial(),trim=new THREE.MeshStandardMaterial(),metal=new THREE.MeshStandardMaterial();
  const add=(parent,name,geometry,material,position,castShadow=true,receiveShadow=true)=>{
    const part=new THREE.Mesh(geometry,material);part.name=name;part.position.set(...position);part.castShadow=castShadow;part.receiveShadow=receiveShadow;parent.add(part);return part;
  };
  add(main,'body',new THREE.BoxGeometry(2,1,4),paint,[0,.5,0]);
  for(const x of [-.7,.7])add(main,'trim',new THREE.BoxGeometry(.2,.1,.9),trim,[x,.4,0]);
  const dense=new THREE.SphereGeometry(.25,48,32);
  for(const [name,z] of [['interior_dark',-.4],['interior_light',.1],['leather',-.1],['carpet',-.2]])add(main,name,dense,trim,[0,.45,z]);
  add(main,'lights',new THREE.BoxGeometry(.1,.1,.1),trim,[.5,.7,1.8],true,false);
  add(main,'leds',new THREE.BoxGeometry(.1,.1,.1),trim,[-.5,.7,1.8],true,false);
  add(main,'exterior-nonreceiving',new THREE.BoxGeometry(.1,.1,.1),trim,[0,.1,1.7],true,false);
  add(main,'already-disabled',new THREE.BoxGeometry(.1,.1,.1),trim,[0,.1,-1.7],false,false);
  const arrayInterior=add(main,'interior_light',new THREE.BoxGeometry(.1,.1,.1),[trim,metal],[0,.6,0]);
  const wheels=[];
  for(const [name,x,z] of [['wheel_fl',-.8,.8],['wheel_fr',.8,.8],['wheel_rl',-.8,-.8],['wheel_rr',.8,-.8]]){
    const wheel=new THREE.Group();wheel.name=name;wheel.position.set(x,.2,z);model.add(wheel);wheels.push(wheel);
    add(wheel,`rim_${name}`,new THREE.BoxGeometry(.1,.12,.12),metal,[0,0,0],true,false);
    add(wheel,`rim_${name}_detail`,new THREE.BoxGeometry(.02,.02,.02),metal,[0,.03,0],true,false);
    add(wheel,'tire',new THREE.BoxGeometry(.16,.3,.3),metal,[0,0,0],true,true);
    add(wheel,'brake',dense,metal,[0,0,0],true,true);
  }
  car.userData.wheels=wheels;
  const steering=new THREE.Group();steering.name='steering_wheel';steering.position.set(.3,.7,.3);model.add(steering);
  for(const name of ['steering_carbon','steering_trim','steering_red_lights'])add(steering,name,dense,trim,[0,0,0]);
  const triangles=part=>(part.geometry.index?.count||part.geometry.attributes.position.count)/3*(part.isInstancedMesh?part.count:1);
  const geometryBudget=root=>{let total=0,shadow=0;root.traverseVisible(part=>{if(part.isMesh){total+=triangles(part);if(part.castShadow)shadow+=triangles(part);}});return{total,shadow};};
  const expected=new Map();
  for(const part of main.children.filter(p=>p.isMesh&&p.material===trim)){
    const disabled=['interior_dark','interior_light','leather','carpet','lights','leds'].includes(part.name),key=`${disabled?0:part.castShadow?1:0}${part.receiveShadow?1:0}`;
    expected.set(key,(expected.get(key)||0)+triangles(part));
  }
  const before=geometryBudget(car),bounds=drivingBounds(car),axes=wheels.map(w=>w.position.toArray());
  refineOriginalCar(car);
  const after=geometryBudget(car),newBounds=drivingBounds(car),actual=new Map();
  for(const part of main.children.filter(p=>p.isMesh&&p.material===trim)){
    const key=`${part.castShadow?1:0}${part.receiveShadow?1:0}`;actual.set(key,(actual.get(key)||0)+triangles(part));
  }
  assert.deepEqual(actual,expected,'interior/exterior parts sharing trim must remain in separate cast/receive batches');
  assert.equal(after.total,before.total,'all original visible geometry must remain');
  assert(after.shadow<before.shadow*.05,'the dense cockpit and brake geometry must no longer enter the shadow pass');
  for(const key of ['min','max'])bounds[key].toArray().forEach((n,i)=>assert(Math.abs(n-newBounds[key].toArray()[i])<.000001,'world silhouette bounds must stay unchanged'));
  assert.deepEqual(wheels.map(w=>w.position.toArray()),axes);
  assert.equal(arrayInterior.castShadow,false,'material-array interiors must also stop casting');assert.equal(arrayInterior.receiveShadow,true);
  assert.equal(main.getObjectByName('body').castShadow,true);
  assert(wheels.every(w=>w.children.some(p=>p.name.startsWith('rim_')&&p.castShadow&&!p.receiveShadow)));
  assert(wheels.every(w=>w.children.some(p=>!p.castShadow&&p.receiveShadow)),'brakes sharing metal with rims must remain non-casters');
  assert(steering.children.every(p=>!p.castShadow&&p.receiveShadow));
  assert.equal(car.userData.modelStats.shadowTriangles,after.shadow);
});

test('original GT refinement preserves world bounds and rolling groups while batching only fixed siblings',()=>{
  const car=new THREE.Group(),model=new THREE.Group(),main=new THREE.Group();
  model.rotation.y=Math.PI;main.name='main';model.add(main);car.add(model);
  const paint=new THREE.MeshPhysicalMaterial({color:0x99c8bc}),trim=new THREE.MeshStandardMaterial({color:0x243138}),rim=new THREE.MeshStandardMaterial({color:0xd5dadc});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.2,.4,2),paint);body.name='body';body.position.y=.6;main.add(body);
  for(const x of [-.5,.5]){const fixture=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,1),trim);fixture.position.set(x,.4,0);main.add(fixture);}
  const wheels=[];
  for(const [name,x,z] of [['wheel_fl',-.7,.7],['wheel_fr',.7,.7],['wheel_rl',-.7,-.7],['wheel_rr',.7,-.7]]){
    const wheel=new THREE.Group();wheel.name=name;wheel.position.set(x,.3,z);model.add(wheel);wheels.push(wheel);
    for(const y of [-.02,.02]){const p=new THREE.Mesh(new THREE.BoxGeometry(.04,.05,.05),rim);p.name=`rim_${name}`;p.position.y=y;wheel.add(p);}
  }
  car.userData.model=model;car.userData.wheels=wheels;
  const beforeBounds=drivingBounds(car),before=[...beforeBounds.min.toArray(),...beforeBounds.max.toArray()],axes=wheels.map(w=>w.position.toArray()),mainCount=main.children.length;
  refineOriginalCar(car);
  const afterBounds=drivingBounds(car),after=[...afterBounds.min.toArray(),...afterBounds.max.toArray()];
  before.forEach((v,i)=>assert(Math.abs(v-after[i])<.000001,'baking must preserve each transformed exterior bound'));
  assert.deepEqual(wheels.map(w=>w.position.toArray()),axes);
  assert(wheels.every(w=>w.parent===model&&w.children.length===1));
  assert(main.children.length<mainCount);assert.equal(main.getObjectByName('body'),body);
  assert(body.material.roughnessMap.isDataTexture);
  customizeCar(car,{paint:'#4d9489',wheelColor:'#d0aa67'});
  assert.equal(body.material.color.getHexString(),'4d9489');
  assert(car.userData.rimMeshes.every(p=>p.material.color.getHexString()==='d0aa67'));
  const stats={...car.userData.modelStats};refineOriginalCar(car);assert.deepEqual(car.userData.modelStats,stats,'repeat refinement must be harmless');
});

function wrapOriginalModel(model){
  const car=new THREE.Group();model.rotation.y=Math.PI;car.add(model);
  car.userData.model=model;
  car.userData.wheels=['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].map(name=>model.getObjectByName(name)).filter(Boolean);
  model.traverse(part=>{if(part.isMesh){part.castShadow=part.name!=='glass';part.receiveShadow=true;}});
  return car;
}

test('shipped GT low detail reduces geometry while preserving exterior bounds, axles and original high/garage geometry',async()=>{
  const template=await loadVehicleModel(),car=wrapOriginalModel(template.clone(true));
  const bounds=drivingBounds(car),axes=car.userData.wheels.map(w=>w.position.toArray()),body=car.userData.model.getObjectByName('body'),bodyGeometry=body.geometry;
  const sourceBuffers=new Map(),sourceBarrels=[];
  template.traverse(part=>{if(part.isMesh){sourceBuffers.set(part.geometry,{positions:part.geometry.attributes.position.array.slice(),indices:part.geometry.index.array.slice()});if((part.userData.name||part.name)==='wheel')sourceBarrels.push(part);}});
  const barrelTriangles=sourceBarrels.reduce((sum,p)=>sum+p.geometry.index.count/3,0);
  assert.equal(barrelTriangles,36480);
  assert.equal(new Set(sourceBarrels.map(part=>part.name)).size,4,'QA must exercise actual GLTFLoader unique node names');
  assert(sourceBarrels.some(part=>part.name!==part.userData.name),'the original authored name must survive loader renaming');
  refineOriginalCar(car);
  const high={...car.userData.modelStats},originals=new Map();
  car.traverse(part=>{if(part.isMesh)originals.set(part,part.geometry);});
  assert.equal(high.triangles,358788);
  assert.equal(high.shadowTriangles,156504,'wheel barrels, cockpit and brake fixtures must not enter the shadow pass');
  setVehicleQuality(car,'low');
  const low={...car.userData.modelStats},reduced=new Map();
  car.traverse(part=>{if(part.isMesh)reduced.set(part,part.geometry);});
  assert.equal(low.triangles,327929);assert(low.triangles<high.triangles*.92);
  assert.equal(low.shadowTriangles,high.shadowTriangles);assert.equal(low.drawCalls,high.drawCalls);
  assert.equal(body.geometry,bodyGeometry,'the full exterior body is never simplified');
  assert.deepEqual(drivingBounds(car),bounds,'the collision/exterior envelope must stay exact');
  assert.deepEqual(car.userData.wheels.map(w=>w.position.toArray()),axes);
  for(const [part,geometry] of reduced){
    const position=geometry.attributes.position,normal=geometry.attributes.normal;
    assert(geometry.index.array.every(i=>i<position.count),'all triangle vertices must exist');
    assert(position.array.every(Number.isFinite));assert(normal.array.every(Number.isFinite));
    if(geometry.userData.mobileReduction)assert(geometry.userData.mobileReduction.maxDeviation<=Math.sqrt(3)*.006+1e-7,'6mm grid displacement must remain below its 10.4mm diagonal');
    if(part.castShadow)assert.equal(geometry,originals.get(part),'the complete exterior shadow silhouette stays exact');
  }
  // Restoring quality or opening the garage swaps back to the same buffers,
  // and a second low transition uses the already-created geometry.
  for(const [quality,options] of [['balanced',{}],['high',{}],['low',{preview:true}]]){
    setVehicleQuality(car,quality,options);assert.equal(car.userData.modelStats.geometryLevel,'high');
    for(const [part,geometry] of originals)assert.equal(part.geometry,geometry);
    setVehicleQuality(car,'low');for(const [part,geometry] of reduced)assert.equal(part.geometry,geometry);
  }
  for(const [geometry,buffers] of sourceBuffers){assert.deepEqual(geometry.attributes.position.array,buffers.positions);assert.deepEqual(geometry.index.array,buffers.indices);}
});

test('low geometry is lazy, shared across original clones and never disposes another car or preview buffers',()=>{
  const geometry=new THREE.SphereGeometry(.12,96,64),material=new THREE.MeshStandardMaterial();
  const make=()=>{
    const model=new THREE.Group(),part=new THREE.Mesh(geometry,material);part.name='interior_dark';model.add(part);
    const car=wrapOriginalModel(model);refineOriginalCar(car);return{car,part};
  };
  const first=make(),second=make();let disposals=0;
  geometry.addEventListener('dispose',()=>disposals++);
  assert.equal(first.part.userData.vehicleGeometryLevels.low,null);
  setVehicleQuality(first.car,'balanced');assert.equal(first.part.userData.vehicleGeometryLevels.low,null);
  setVehicleQuality(first.car,'low');const low=first.part.geometry;low.addEventListener('dispose',()=>disposals++);
  assert.notEqual(low,geometry);assert(low.index.count<geometry.index.count);
  assert.equal(second.part.geometry,geometry);
  setVehicleQuality(second.car,'low');assert.equal(second.part.geometry,low,'the same source only needs one reduction');
  const scene=new THREE.Scene(),studio=createGarageStage(scene);studio.place(first.car);
  setVehicleQuality(first.car,'low',{preview:true});assert.equal(first.part.geometry,geometry);assert.equal(second.part.geometry,low);
  studio.dispose();assert.equal(disposals,0);
  for(let i=0;i<6;i++){setVehicleQuality(first.car,'low');assert.equal(first.part.geometry,low);setVehicleQuality(first.car,'high');assert.equal(first.part.geometry,geometry);}
  assert.equal(disposals,0);
});
