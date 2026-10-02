import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildDriver,updateDriverPose} from '../drivers.js';
import {buildAlternativeCar,customizeCar} from '../vehicles.js';

function named(driver,name){const part=driver.getObjectByName(`driver-${name}`);assert(part,`${name} should exist`);return part;}
function meshes(driver){const list=[];driver.traverse(p=>{if(p.isMesh)list.push(p);});return list;}

test('drivers are lit 3D silhouettes with canonical matte Marin and glass Kkamong eyes',()=>{
  const marin=buildDriver(THREE,'marin'),kkamong=buildDriver(THREE,'kkamong');
  const helmet=named(marin,'marin-helmet'),feltEye=named(marin,'marin-eye-felt');
  assert.equal(helmet.material.color.getHexString(),'283158');
  assert.equal(named(marin,'marin-torso').material.color.getHexString(),'cbb7a8');
  assert.equal(feltEye.material.color.getHexString(),'f5cd58');
  assert.equal(feltEye.material.metalness,0);assert(feltEye.material.roughness>=.95);
  assert.equal(feltEye.material.emissive.getHex(),0);assert.equal(feltEye.material.clearcoat,0);
  const pupil=named(kkamong,'kkamong-glass-pupil');
  assert(pupil.material.roughness<.2);assert(pupil.material.clearcoat>.9);
  assert.equal(named(kkamong,'kkamong-iris').material.color.getHexString(),'799459');
  for(const driver of [marin,kkamong]){
    assert(meshes(driver).every(p=>p.material.isMeshStandardMaterial));
    assert(meshes(driver).every(p=>p.geometry.type!=='PlaneGeometry'));
    assert(meshes(driver).every(p=>!p.name.startsWith('rim_')&&p.name!=='body'));
    assert(meshes(driver).filter(p=>!p.isInstancedMesh).every(p=>p.castShadow&&p.receiveShadow));
    assert(driver.userData.modelStats.depth>.6,'the driver needs a genuine back and sides');
  }
});

test('Marin eye proportions preserve the measured reference rather than robot visor eyes',()=>{
  const driver=buildDriver(THREE,'marin'),head=driver.userData.pose.head;
  const left=head.getObjectByName('driver-marin-eye--1'),right=head.getObjectByName('driver-marin-eye-1');
  const disc=named(driver,'marin-eye-felt'),width=disc.scale.x*2,centreGap=right.position.x-left.position.x;
  assert(Math.abs((centreGap-width)/width-.95)<.02);
  assert(Math.abs(disc.scale.y/disc.scale.x-1.16)<.01);
  assert(driver.userData.modelStats.width>=.60&&driver.userData.modelStats.width<=.67);
  assert(driver.userData.modelStats.height>=.90&&driver.userData.modelStats.height<=1.04);
  assert(named(driver,'marin-mitten--1'));assert(named(driver,'marin-flower'));
  assert(!meshes(driver).some(p=>p.name.includes('horn')||p.name.includes('claw')));
});

test('the complete eye discs stay visible through the helmet sockets from front and 3/4 views',()=>{
  const driver=buildDriver(THREE,'marin');driver.updateMatrixWorld(true);
  const face=meshes(driver).filter(p=>!p.isInstancedMesh);
  for(const side of [-1,1]){
    const eye=driver.getObjectByName(`driver-marin-eye-${side}`).getObjectByName('driver-marin-eye-felt');
    for(const yaw of [-.65,-.38,0,.38,.65])for(const elevation of [0,.2,.4]){
      const direction=new THREE.Vector3(-Math.sin(yaw),-elevation,-Math.cos(yaw)).normalize();
      for(const [u,v] of [[0,0],[-.7,0],[.7,0],[0,-.7],[0,.7],[-.5,-.5],[.5,.5]]){
        // Aim through the interior of the disc rather than an exact sphere
        // vertex: round-off at a triangle edge can otherwise miss the eye.
        const point=eye.localToWorld(new THREE.Vector3(u+.0001,v+.0001,0));
        const ray=new THREE.Raycaster(point.clone().addScaledVector(direction,-2),direction);
        const first=ray.intersectObjects(face,false)[0]?.object;
        assert(first===eye,
          `eye ${side}, yaw ${yaw}, elevation ${elevation}, sample ${u}/${v}: ${first?.name} covers yellow`);
      }
    }
  }
  const helmet=named(driver,'marin-helmet');helmet.geometry.computeBoundingBox();
  const size=helmet.geometry.boundingBox.getSize(new THREE.Vector3());
  assert(size.y/size.x>=.92&&size.y/size.x<=1.04,'canonical helmet should be a broad bell rather than a tall egg');
});

test('geometry fits a mobile driver budget and batches fine felt strands',()=>{
  for(const id of ['marin','kkamong']){
    const driver=buildDriver(THREE,id),list=meshes(driver);
    const triangles=list.reduce((n,p)=>n+(p.geometry.index?.count||p.geometry.attributes.position.count)/3*(p.isInstancedMesh?p.count:1),0);
    assert(triangles<30000,`${id} should stay below 30k triangles`);
    assert(list.length<=24,`${id} should batch static felt details and strands`);
    assert(list.some(p=>p.isInstancedMesh&&p.count>300));
    for(const mesh of list){
      for(const [name,attribute] of Object.entries(mesh.geometry.attributes)){
        assert(attribute.array.every(Number.isFinite),`invalid ${name} breaks rendering or lighting`);
      }
      if(mesh.geometry.type==='BufferGeometry'){
        const normals=mesh.geometry.attributes.normal;
        for(let i=0;i<normals.count;i++){
          const length=Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i));
          assert(length>.98&&length<1.02,'batched details must retain normalized surface lighting');
        }
      }
      if(mesh.isInstancedMesh)assert(mesh.instanceMatrix.array.every(Number.isFinite));
    }
  }
});

test('steering remains forward and does not move the seated root or look toward the rear camera',()=>{
  for(const id of ['marin','kkamong']){
    const driver=buildDriver(THREE,id);driver.position.set(.4,.68,-.18);
    const seat=driver.position.clone();
    for(const steer of [-100,-1,0,1,100,NaN]){
      updateDriverPose(driver,{steer,mood:'cheer',time:123,speed:70});
      driver.updateMatrixWorld(true);
      const forward=new THREE.Vector3(0,0,1).transformDirection(driver.userData.pose.head.matrixWorld);
      assert(forward.z>.98,'driver must continue looking at the road');
      assert.deepEqual(driver.position.toArray(),seat.toArray());
    }
    updateDriverPose(driver,{steer:1,time:14,speed:70,motion:false});
    assert.equal(driver.userData.pose.rig.rotation.z,0);assert.equal(driver.userData.pose.head.rotation.y,0);
    updateDriverPose(driver,{steer:1,time:17,speed:0});
    assert.equal(driver.userData.pose.head.rotation.x,0,'parked drivers should not bob');
  }
});

test('car paint never recolours driver identity and height textures remain caller-owned',()=>{
  const texture=new THREE.Texture(),originalWrap=texture.wrapS,originalSpace=texture.colorSpace;
  const car=buildAlternativeCar('roadster'),driver=buildDriver(THREE,'marin',{feltTexture:texture});car.add(driver);
  assert.equal(named(driver,'marin-helmet').material.bumpMap,texture);
  assert.equal(named(driver,'marin-helmet').material.map,null,'pink felt must not tint the mascot');
  customizeCar(car,{paint:'#ff0000',wheelColor:'#ff0000'});
  assert.equal(named(driver,'marin-helmet').material.color.getHexString(),'283158');
  assert.equal(named(driver,'marin-torso').material.color.getHexString(),'cbb7a8');
  assert.equal(texture.wrapS,originalWrap);assert.equal(texture.colorSpace,originalSpace);
  assert.throws(()=>buildDriver(THREE,'unknown'),RangeError);
});
