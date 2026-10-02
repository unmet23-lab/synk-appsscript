import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createCoastalBoats} from '../seascape-boats.js';
import {createLandscapeHeight,buildDistantCoast} from '../landscape.js';
import {buildSceneryDetails} from '../scenery.js';

const pathX=s=>Math.sin(s/235)*25+Math.sin(s/580)*31;
const pathY=s=>23+Math.sin(s/280)*2.8+Math.sin(s/100)*1.2;
const groundHeight=createLandscapeHeight(pathX,pathY);
const build=()=>createCoastalBoats(THREE,{pathX,groundHeight});
const poses=b=>structuredClone(b.group.userData.poseSnapshots).map(({visible,animated,...pose})=>pose);

test('the four boats have finite closed hulls, curved sails and world geometry safely clear of the road',()=>{
  const b=build();b.group.updateMatrixWorld(true);
  assert.equal(b.stats.sailboats,2);assert.equal(b.stats.cruisers,2);
  const point=new THREE.Vector3();let hullSides=0;
  b.group.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isInstancedMesh)return;
    assert.equal(mesh.geometry.groups.length,0);
    for(const name of ['position','normal','color'])assert(mesh.geometry.attributes[name].array.every(Number.isFinite));
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
      assert(point.x-pathX(point.z)>85,'a boat part crosses the protected coast strip');
      assert(groundHeight(point.x,point.z)<-3.2,'the complete boat stays above deep submerged terrain');
      if(mesh.name.endsWith('-hull')&&i<480&&Math.abs(p.getX(i))>.60&&p.getY(i)<.05){
        assert(p.getX(i)*n.getX(i)>0,'the curved hull side faces inward');hullSides++;
      }
    }
    if(mesh.name==='sail-boat-hull'){
      let curved=0;for(let i=0;i<p.count;i++)if(p.getY(i)>2&&p.getY(i)<7&&p.getX(i)>.06)curved++;
      assert(curved>100,'the sails need a cloth belly rather than a flat plane');
    }
  });
  assert(hullSides>80);b.dispose();
});

test('boats travel along complete continuous loops, follow their heading and keep calm heave and roll',()=>{
  const b=build();b.update({time:0,playerS:240});const first=poses(b);
  let previous=first,travel=0;
  const period=b.group.userData.boats[0].route.period,steps=Math.ceil(period/.1),dt=period/steps;
  for(let i=1;i<=steps+1;i++){
    b.update({time:i*dt,dt,playerS:240});
    for(const p of b.group.userData.poseSnapshots){
      const spec=b.group.userData.boats[p.id];
      assert(Math.abs(p.position[1]+2.2)<=.10001);
      assert(Math.abs(p.rotation[2])<=.015001);
      const dx=p.position[0]-previous[p.id].position[0],dz=p.position[2]-previous[p.id].position[2],distance=Math.hypot(dx,dz);
      assert(distance>0&&distance<=spec.route.speed*dt*1.001,'sailing speed stays smooth through both turns and the loop seam');
      assert(Math.abs(p.rotation[1]-previous[p.id].rotation[1])<.012,'heading must not snap at PI or the end of a loop');
      assert((dx*Math.sin(p.rotation[1])+dz*Math.cos(p.rotation[1]))/distance>.9999,'the bow follows actual travel');
      if(p.id===0)travel+=distance;
    }
    if(i===steps){const p=poses(b)[0];assert(Math.hypot(p.position[0]-first[0].position[0],p.position[2]-first[0].position[2])<1e-8,'closed route returns exactly to its initial XZ');}
    previous=poses(b);
  }
  assert(travel>250,'the yacht really sails around the bay instead of rocking in place');
  assert.notDeepEqual(poses(b)[0],first[0]);
  assert.notDeepEqual(poses(b)[3],first[3],'offscreen routes keep advancing so boats can return to view');b.dispose();
});

test('pause, reduced motion and a hidden group freeze boats and wake time without catch-up on resume',()=>{
  const b=build();b.update({time:1,dt:.1,playerS:240});const frozen=poses(b);
  const wake=b.group.getObjectByName('coastal-boat-wakes'),wakeTimes=wake.geometry.attributes.wakeTime.array.slice();
  b.update({time:60,playerS:240,paused:true});assert.deepEqual(poses(b),frozen);assert.deepEqual(wake.geometry.attributes.wakeTime.array,wakeTimes);
  b.update({time:120,playerS:240,motion:false});assert.deepEqual(poses(b),frozen);
  b.group.visible=false;b.update({time:180,playerS:240});assert.deepEqual(poses(b),frozen);assert.equal(b.stats.drawCalls,0);
  b.group.visible=true;b.update({time:180.02,playerS:240});
  const after=poses(b);assert.notDeepEqual(after,frozen);
  for(const p of after){const previous=frozen[p.id];assert(Math.hypot(...p.position.map((n,i)=>n-previous.position[i]))<.05,'resume should move only by its 20ms frame, without hidden-time catch-up');}
  b.dispose();
});

test('all quality tiers keep geometry allocations and a bounded one-draw wake batch',()=>{
  const b=build(),geometry=[],snapshots=b.group.userData.poseSnapshots.map(p=>({pose:p,position:p.position,rotation:p.rotation}));b.group.traverse(m=>{if(m.isMesh)geometry.push(m.geometry);});
  assert(b.stats.storedTriangles<9000);let peak=0;
  for(const quality of ['high','balanced','low','high'])for(let s=0;s<2250;s+=10){
    b.update({time:s/20,playerS:s,quality,motion:false});
    peak=Math.max(peak,b.stats.visibleTriangles);
    assert(b.stats.visibleTriangles<9000);assert.equal(b.stats.shadowDrawCalls,0);
    assert(b.stats.wakeDrawCalls<=1);
    if(quality==='low')assert.equal(b.stats.wakeDrawCalls,0);
    snapshots.forEach((p,i)=>{assert.equal(b.group.userData.poseSnapshots[i],p.pose);assert.equal(p.pose.position,p.position);assert.equal(p.pose.rotation,p.rotation);});
    let i=0;b.group.traverse(m=>{if(m.isMesh){assert.equal(m.geometry,geometry[i++]);assert.equal(m.castShadow,false);}});
  }
  assert(peak>2500);b.update({playerS:5000,motion:false});assert.equal(b.stats.drawCalls,0);b.dispose();
});

test('distance and frustum culling use the sailing position and do not strand an offscreen boat',()=>{
  const b=build();b.update({dt:0,playerS:810});assert.equal(b.group.userData.poseSnapshots[0].visible,false);
  for(let i=0;i<200;i++)b.update({dt:.1,playerS:810});
  assert.equal(b.group.userData.poseSnapshots[0].visible,true,'the approaching yacht should cross the near visibility boundary');
  const camera=new THREE.PerspectiveCamera(40,1,.1,1500);
  camera.position.set(pathX(350),30,350);camera.lookAt(-1000,30,-400);
  const start=poses(b)[0];for(let i=0;i<100;i++)b.update({dt:.1,playerS:350,camera});
  assert.equal(b.group.userData.poseSnapshots[0].visible,false);
  assert(Math.hypot(poses(b)[0].position[0]-start.position[0],poses(b)[0].position[2]-start.position[2])>10);
  camera.lookAt(...b.group.userData.poseSnapshots[0].position);b.update({dt:0,playerS:350,camera});
  assert.equal(b.group.userData.poseSnapshots[0].visible,true);b.dispose();
});

test('one wake batch stays behind each moving stern, aligned with its current heading',()=>{
  const b=build(),matrix=new THREE.Matrix4(),tail=new THREE.Vector3(),forward=new THREE.Vector3();
  for(let i=0;i<1100;i++)b.update({dt:.1,playerS:650});
  const wake=b.group.getObjectByName('coastal-boat-wakes');let instance=0;
  for(const p of b.group.userData.poseSnapshots){
    if(!p.visible)continue;
    wake.getMatrixAt(instance++,matrix);tail.set(0,0,-.5).applyMatrix4(matrix);
    const dx=tail.x-p.position[0],dz=tail.z-p.position[2],heading=p.rotation[1];
    assert(dx*Math.sin(heading)+dz*Math.cos(heading)<-b.group.userData.boats[p.id].length*.5);
    assert(Math.abs(dx*Math.cos(heading)-dz*Math.sin(heading))<.0001,'wake must not slide sideways while the boat turns');
    forward.set(0,0,1).transformDirection(matrix);assert(forward.x*Math.sin(heading)+forward.z*Math.cos(heading)>.99999);
  }
  assert(instance>0);assert.equal(instance,wake.count);b.dispose();
});

test('every sailing loop and complete hull envelope clear the real seabed, island and overlook meshes',()=>{
  const b=build();
  const angle=s=>Math.atan(Math.cos(s/235)*25/235+Math.cos(s/580)*31/580);
  const roadPoint=(s,offset=0,y=0)=>new THREE.Vector3(pathX(s)+Math.cos(angle(s))*offset,pathY(s)+y,s-Math.sin(angle(s))*offset);
  const coast=buildDistantCoast(THREE,{roadPoint,pathX,groundHeight}),details=buildSceneryDetails(THREE,{roadPoint,pathX,groundHeight});
  coast.updateMatrixWorld(true);details.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,204);
  for(const spec of b.group.userData.boats)for(let step=0;step<96;step++){
    const theta=step/96*Math.PI*2,r=spec.route,cx=spec.x+r.rx*(1-Math.cos(theta)),cz=spec.z+r.direction*r.rz*Math.sin(theta),radius=Math.hypot(spec.length*.57,spec.width*1.04);
    for(let corner=0;corner<8;corner++){
      const a=corner/8*Math.PI*2,x=cx+Math.sin(a)*radius,z=cz+Math.cos(a)*radius;
      assert(x-pathX(z)>85,'a moving hull enters the protected near coast strip');
      assert(groundHeight(x,z)<-3.2,'a route turn crosses emerged terrain');
      ray.ray.origin.set(x,200,z);
      assert.equal(ray.intersectObjects([coast,details.group],true).filter(hit=>hit.point.y>-3.2).length,0,'an actual island or overlook crosses the sailing route');
    }
  }
  assert.throws(()=>createCoastalBoats(THREE,{pathX,groundHeight:()=>0}),/sailing route/,'new terrain must not silently strand existing boats');
  b.dispose();
});

test('frustum culling and disposal release render work without mutating the coast',()=>{
  const b=build(),camera=new THREE.PerspectiveCamera(40,1,.1,1500);
  camera.position.set(pathX(75),30,75);camera.lookAt(-1000,30,-400);
  b.update({time:0,playerS:75,camera});assert.equal(b.stats.visibleBoats,0);
  const resources=new Set();b.group.traverse(m=>{if(m.isMesh){resources.add(m.geometry);resources.add(m.material);}});
  let disposed=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);
  b.dispose();assert.equal(disposed,resources.size);assert.equal(b.group.children.length,0);
  b.dispose();assert.equal(disposed,resources.size);assert.equal(b.update().drawCalls,0);
});

test('the opening yacht and passing cruiser remain readable through the first bay without cliff or overlook occlusion',()=>{
  const b=build();
  const angle=s=>Math.atan(Math.cos(s/235)*25/235+Math.cos(s/580)*31/580);
  const roadPoint=(s,offset,y)=>new THREE.Vector3(pathX(s)+Math.cos(angle(s))*offset,pathY(s)+y,s-Math.sin(angle(s))*offset);
  const sceneryPoint=(s,offset=0,y=0)=>roadPoint(s,offset,y);
  const coast=buildDistantCoast(THREE,{roadPoint:sceneryPoint,pathX,groundHeight});
  const details=buildSceneryDetails(THREE,{roadPoint:sceneryPoint,pathX,groundHeight});
  coast.updateMatrixWorld(true);details.group.updateMatrixWorld(true);b.group.updateMatrixWorld(true);
  const yacht=b.group.getObjectByName('coastal-sail-1');
  for(const laneOffset of [-3.45,0,3.45]){
    const camera=new THREE.PerspectiveCamera(55,1920/1080,.12,4900);
    camera.position.copy(roadPoint(341,laneOffset*.62,3.6));camera.lookAt(roadPoint(374,laneOffset*.34,1.55));camera.updateMatrixWorld();
    b.update({playerS:350,motion:false,camera});assert(b.group.userData.poseSnapshots[0].visible);
    const hull=yacht.localToWorld(new THREE.Vector3(0,.5,0));
    const mast=yacht.localToWorld(new THREE.Vector3(0,8.15,.48));
    const hullScreen=hull.clone().project(camera),mastScreen=mast.clone().project(camera);
    assert(hullScreen.x>-.65&&hullScreen.x<-.25,'yacht must fit comfortably in the open bay');
    assert((mastScreen.y-hullScreen.y)*1080>60,'mast should occupy readable pixels in the 4K capture');
    for(const target of [hull,hull.clone().lerp(mast,.5),mast]){
      for(let t=.01;t<.99;t+=.003){
        const point=camera.position.clone().lerp(target,t);
        assert(point.y-groundHeight(point.x,point.z)>.85,'near terrain hides the vessel from the normal driving camera');
      }
      const direction=target.clone().sub(camera.position),ray=new THREE.Raycaster(camera.position,direction.clone().normalize(),.01,direction.length());
      assert.equal(ray.intersectObjects([coast,details.group],true).length,0,'a real island or overlook mesh hides the yacht');
    }
  }
  for(const s of [350,450,550]){
    for(let step=0;step<100;step++)b.update({dt:.1,playerS:s});
    const camera=new THREE.PerspectiveCamera(55,1920/1080,.12,4900);
    camera.position.copy(roadPoint(s-9,0,3.6));camera.lookAt(roadPoint(s+24,0,1.55));camera.updateMatrixWorld();
    b.update({dt:0,playerS:s,camera});b.group.updateMatrixWorld(true);
    let readable=0;
    for(const spec of b.group.userData.boats.slice(0,2)){
      const boat=b.group.getObjectByName(`coastal-${spec.kind}-${spec.id+1}`),hull=boat.localToWorld(new THREE.Vector3(0,.5,0)),screen=hull.clone().project(camera);
      if(screen.x<-.9||screen.x>-.2||!boat.visible)continue;
      const top=boat.localToWorld(new THREE.Vector3(0,spec.kind==='sail'?8.15:3.62,0)),topScreen=top.clone().project(camera);
      if((topScreen.y-screen.y)*1080<=20)continue;
      for(let t=.01;t<.99;t+=.004){const point=camera.position.clone().lerp(hull,t);assert(point.y-groundHeight(point.x,point.z)>.5);}
      const direction=hull.clone().sub(camera.position),ray=new THREE.Raycaster(camera.position,direction.clone().normalize(),.01,direction.length());
      assert.equal(ray.intersectObjects([coast,details.group],true).length,0,`a real scene object hides the passing boat at ${s}m`);readable++;
    }
    assert(readable>0,`at least one passing vessel should remain comfortably visible at ${s}m`);
  }
  b.dispose();
});
