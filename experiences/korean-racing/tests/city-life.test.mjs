import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildCityLife} from '../city-life.js';
import {buildCoastalCity} from '../cityscape.js';
import {createLandscapeHeight} from '../landscape.js';

const flat=()=>0,straight=()=>0;
const anchors=[
  {id:'terrace',kind:'table',blockId:'first',x:-17,y:0,z:100,guests:[{x:-17,y:0,z:99,yaw:0,seatHeight:.57},{x:-17,y:0,z:101,yaw:Math.PI,seatHeight:.57}],tableTop:{x:-17,y:.86,z:100}},
  {id:'party',kind:'party',blockId:'first',x:-18,y:0,z:108,positions:[{x:-18,y:0,z:108,yaw:0},{x:-20,y:0,z:108,yaw:1}]},
  {id:'cheer',kind:'cheer',blockId:'first',x:-12,y:0,z:118,positions:[{x:-12,y:0,z:118,yaw:1.5},{x:-13,y:0,z:122,yaw:1.5}]},
  {id:'walker',kind:'walk',blockId:'first',start:{x:-10.6,y:.045,z:88},end:{x:-10.6,y:.045,z:131},roadRelativeOffset:-10.6,duration:18},
];
const build=()=>buildCityLife(THREE,{anchors,groundHeight:flat,pathX:straight});
function vertices(life,visit) {
  const matrix=new THREE.Matrix4(),p=new THREE.Vector3();
  life.group.traverse(mesh=>{if(!mesh.isInstancedMesh||!mesh.visible)return;
    for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);for(let j=0;j<mesh.geometry.attributes.position.count;j++)visit(p.fromBufferAttribute(mesh.geometry.attributes.position,j).applyMatrix4(matrix),mesh);}
  });
}
function poses(life){return structuredClone(life.group.userData.poseSnapshots).map(({animated,...pose})=>pose);}

test('adult proportions and seated hip/feet correspond to actual seat height rather than floating puppets',()=>{
  const life=build();life.update({time:0,playerS:90});
  assert.equal(life.stats.actors,7);assert.equal(life.stats.visibleActors,7);
  for(const actor of life.group.userData.actors)assert(actor.height>=1.66&&actor.height<=1.88);
  const body=life.group.children.find(m=>m.name==='city-life-torso').geometry;
  for(let i=8;i<24;i++)assert(body.attributes.position.getX(i)*body.attributes.normal.getX(i)+body.attributes.position.getZ(i)*body.attributes.normal.getZ(i)>0,'clothed torso normals must face outward');
  const guests=life.group.userData.poseSnapshots.filter(p=>p.seated);
  assert.equal(guests.length,2);
  for(const p of guests){
    assert(Math.abs(p.joints.hipLeft[1]-(p.position.y+p.seatHeight+.10))<1e-9);
    assert(Math.abs(p.joints.ankleLeft[1]-(p.position.y+.08))<1e-9);
    assert(p.joints.head[1]-p.joints.hipLeft[1]>.65&&p.joints.head[1]-p.joints.hipLeft[1]<.75);
    assert(Math.hypot(p.joints.kneeLeft[0]-p.joints.hipLeft[0],p.joints.kneeLeft[2]-p.joints.hipLeft[2])>.35,'seated thighs extend forward in proportion to adult height');
  }
  let floor=Infinity;vertices(life,(p,mesh)=>{if(mesh.name==='city-life-shoe')floor=Math.min(floor,p.y);});
  assert(floor>-.007&&floor<.007,'shoe soles meet the flat paving');
  life.dispose();
});

test('terrace conversation, drinks, pedestrian gait and near-car cheers change independently with time',()=>{
  const life=build();life.update({time:0,playerS:105});const before=poses(life);
  for(let i=1;i<=90;i++)life.update({time:i/30,playerS:105});const after=poses(life);
  for(const kind of ['table','party','cheer','walk'])assert(after.filter(p=>p.kind===kind).some(p=>JSON.stringify(p.joints)!==JSON.stringify(before.find(b=>b.id===p.id).joints)),kind+' remains static');
  const walkerBefore=before.find(p=>p.kind==='walk'),walkerAfter=after.find(p=>p.kind==='walk');
  assert.notEqual(walkerAfter.position.z,walkerBefore.position.z);
  const a=after.filter(p=>p.kind==='table');assert.notDeepEqual(a[0].joints.handRight,a[1].joints.handRight);
  const cup=life.group.children.find(m=>m.name==='city-life-cup'),liquid=life.group.children.find(m=>m.name==='city-life-liquid');
  const cupMatrix=new THREE.Matrix4(),liquidMatrix=new THREE.Matrix4();
  for(let frame=91;frame<500;frame+=3){
    life.update({time:frame/30,playerS:105});assert.equal(cup.count,liquid.count);
    for(let i=0;i<cup.count;i++){
      cup.getMatrixAt(i,cupMatrix);liquid.getMatrixAt(i,liquidMatrix);
      const rim=new THREE.Vector3(0,.0525,0).applyMatrix4(cupMatrix),surface=new THREE.Vector3().applyMatrix4(liquidMatrix);
      assert(rim.distanceTo(surface)<.0006,'liquid stays on tilted cup rim for every actor yaw');
      const cupAxis=new THREE.Vector3(0,1,0).transformDirection(cupMatrix),liquidNormal=new THREE.Vector3(0,0,1).transformDirection(liquidMatrix);
      assert(cupAxis.dot(liquidNormal)>.99999,'drink surface shares the cup local rotation');
    }
  }
  life.dispose();
});

test('pause and reduced motion freeze poses while quality/visibility still respond; resume never catches up lost time',()=>{
  const life=build();life.update({time:0,playerS:90});life.update({time:.1,playerS:90});
  const frozen=poses(life);
  life.update({time:60,playerS:90,paused:true});assert.deepEqual(poses(life),frozen);
  life.update({time:80,playerS:90,motion:false,celebrating:true});assert.deepEqual(poses(life),frozen);
  life.update({time:80.02,playerS:90,motion:true});
  const after=poses(life);assert.notDeepEqual(after,frozen);
  for(const p of after){const previous=frozen.find(a=>a.id===p.id);assert(Math.abs(previous.joints.handRight[1]-p.joints.handRight[1])<.03);}
  life.update({time:81,playerS:-500,paused:true});assert.equal(life.stats.drawCalls,0);
  life.dispose();
});

test('each quality level and theme is reversible with nine constant shared geometry pools, and far actors hold poses',()=>{
  const life=build(),geometry=life.group.children.map(m=>m.geometry),capacity=life.group.children.map(m=>m.instanceMatrix.array.length);
  life.update({time:0,playerS:-60,quality:'high'});const first=life.stats.visibleActors;
  life.update({time:.1,playerS:-60,quality:'low'});assert(life.stats.visibleActors<first);
  life.update({time:.2,playerS:-60,quality:'high'});assert.equal(life.stats.visibleActors,first);
  const distant=poses(life);for(let i=3;i<60;i++)life.update({time:i/10,playerS:-60,quality:'high'});assert.deepEqual(poses(life),distant);
  life.setTheme('bloom');assert.equal(life.group.visible,false);assert.equal(life.stats.visibleActors,0);assert.equal(life.stats.drawCalls,0);
  life.setTheme('sunset');assert(life.group.visible);assert(life.stats.drawCalls>0&&life.stats.drawCalls<=9);assert.equal(life.stats.shadowDrawCalls,0);
  assert.deepEqual(life.group.children.map(m=>m.geometry),geometry);assert.deepEqual(life.group.children.map(m=>m.instanceMatrix.array.length),capacity);
  for(const mesh of life.group.children)assert(mesh.count*16<=mesh.instanceMatrix.array.length);
  life.dispose();
});

test('real city actors stay outside the road throughout gait and arm movement, including curved-pavement pedestrians',()=>{
  const pathX=s=>Math.sin(s/235)*25+Math.sin(s/580)*31,pathY=s=>23+Math.sin(s/280)*2.8+Math.sin(s/100)*1.2;
  const groundHeight=createLandscapeHeight(pathX,pathY),city=buildCoastalCity(THREE,{pathX,groundHeight});
  const life=buildCityLife(THREE,{anchors:city.group.userData.activityAnchors,groundHeight,pathX,surfaceHeightAt:city.surfaceHeightAt});
  assert.equal(life.stats.actors,44);
  let minimum=Infinity,maxTriangles=0,maxCalls=0;
  for(const playerS of [315,680,1080,1500])for(let step=0;step<25;step++){
    life.update({time:playerS+step*.1,playerS,quality:'high',celebrating:step%2===0});
    maxTriangles=Math.max(maxTriangles,life.stats.visibleTriangles);maxCalls=Math.max(maxCalls,life.stats.drawCalls);
    vertices(life,p=>{assert([p.x,p.y,p.z].every(Number.isFinite));const clearance=pathX(p.z)-p.x;minimum=Math.min(minimum,clearance);assert(clearance>9.29,'body/hand enters protected road');});
    for(const p of life.group.userData.poseSnapshots.filter(p=>p.kind==='walk')){
      assert(Math.abs(p.position.x-pathX(p.position.z)+10.6)<1e-6);
      const pavement=city.surfaceHeightAt?.(p.position.x,p.position.z)??groundHeight(p.position.x,p.position.z)+.045;
      assert(Math.abs(p.position.y-pavement)<1e-6);
    }
  }
  assert(minimum>9.29);assert(maxTriangles<40000);assert(maxCalls<=9);
  life.dispose();city.dispose();
});

test('camera frustum culling returns without rebuilding and owned resources dispose once',()=>{
  const life=build(),camera=new THREE.PerspectiveCamera(55,16/9,.1,600);
  camera.position.set(0,3,80);camera.lookAt(0,2,-300);camera.updateMatrixWorld();
  life.update({time:0,playerS:80,camera});assert.equal(life.stats.drawCalls,0);
  camera.lookAt(-15,1,108);camera.updateMatrixWorld();life.update({time:.1,playerS:80,camera});assert(life.stats.visibleActors>0);
  let geometryDisposed=0,materialDisposed=0;const materials=new Set();
  for(const mesh of life.group.children){mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);materials.add(mesh.material);}
  for(const material of materials)material.addEventListener('dispose',()=>materialDisposed++);
  life.dispose();life.dispose();assert.equal(geometryDisposed,9);assert.equal(materialDisposed,3);assert.equal(life.group.children.length,0);assert.equal(life.stats.drawCalls,0);
});

test('a single walker is culled at its current position rather than its distant starting anchor, with walking-speed motion',()=>{
  const life=buildCityLife(THREE,{anchors:[anchors.find(a=>a.kind==='walk')],groundHeight:flat,pathX:straight});
  life.update({time:0,playerS:90});let previous=poses(life)[0],maxSpeed=0,maxTurn=0,current=previous;
  for(let i=1;i<=950;i++) {
    life.update({time:i*.1,playerS:previous.position.z});current=poses(life)[0];
    maxSpeed=Math.max(maxSpeed,Math.hypot(current.position.x-previous.position.x,current.position.z-previous.position.z)/.1);
    maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(current.yaw-previous.yaw),Math.cos(current.yaw-previous.yaw))));previous=current;
  }
  assert(maxSpeed>1.3&&maxSpeed<1.451,'43m path must stay at adult walking speed');
  assert(maxTurn>.1&&maxTurn<.265,'turnaround lasts 1.8 seconds instead of snapping 180 degrees in a frame');
  for(let i=951;Math.abs(current.position.z-anchors.at(-1).start.z)<9&&i<1200;i++) {
    life.update({time:i*.1,playerS:current.position.z});current=poses(life)[0];
  }
  assert(Math.abs(current.position.z-anchors.at(-1).start.z)>8);
  const camera=new THREE.PerspectiveCamera(16,1,.1,100),time=120;
  camera.position.set(0,2,current.position.z);camera.lookAt(-10.6,1,current.position.z);camera.updateMatrixWorld();
  const f=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  assert(!f.intersectsSphere(new THREE.Sphere(new THREE.Vector3(-10.6,1,anchors.at(-1).start.z),1.8)),'old starting anchor is outside this narrow camera');
  life.update({time,playerS:current.position.z,camera,paused:true});assert.equal(life.stats.visibleActors,1);
  camera.position.z+=70;camera.lookAt(-10.6,1,current.position.z+70);camera.updateMatrixWorld();
  life.update({time,playerS:current.position.z,camera,paused:true});assert.equal(life.stats.drawCalls,0);
  life.dispose();
});

test('invalid foot anchors are rejected before any render allocation',()=>{
  assert.throws(()=>buildCityLife(THREE,{anchors:[{id:'unsafe',kind:'cheer',positions:[{x:-4,y:0,z:30}]}],groundHeight:flat,pathX:straight}),/road shoulder/);
});

test('stance feet remain planted in world space while fixed-length limbs articulate, and lifted cups touch the mouth',()=>{
  const life=build(),distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));let previous=new Map(),plantPairs=0,mouthContacts=0,maxHandSpeed=0;
  for(let frame=0;frame<=1050;frame++){
    life.update({time:frame/30,playerS:105});
    for(const p of life.group.userData.poseSnapshots){
      const scale=p.height/1.78,j=p.joints,old=previous.get(p.id);
      for(const side of ['Left','Right']){
        assert(Math.abs(distance(j['shoulder'+side],j['elbow'+side])-.28*scale)<.001,'upper arms keep their length');
        assert(Math.abs(distance(j['elbow'+side],j['hand'+side])-.265*scale)<.002,'forearms keep their length');
        assert(Math.abs(distance(j['hip'+side],j['knee'+side])-(p.seated?.43:p.kind==='walk'?.46:.425)*scale)<.001,'thighs keep their length');
        assert(Math.abs(distance(j['knee'+side],j['ankle'+side])-(p.seated||p.kind==='walk'?.46:.425)*scale)<.001,'shins keep their length');
      }
      if(old)maxHandSpeed=Math.max(maxHandSpeed,distance(j.handRight,old.joints.handRight)*30);
      if(p.kind==='walk'&&old)for(let i=0;i<2;i++){
        const foot=p.motion.feet[i],prior=old.motion.feet[i];
        if(foot.stance&&prior.stance&&foot.phase>prior.phase){assert(distance(foot.position,prior.position)<1e-8,'support foot slides across paving');plantPairs++;}
      }
      if(p.motion.drinkLift>.9999){assert(distance(p.motion.cupRim,p.motion.mouth)<.0001,'raised drink rim must reach lips');mouthContacts++;}
      previous.set(p.id,structuredClone(p));
    }
  }
  assert(plantPairs>400);assert(mouthContacts>30);assert(maxHandSpeed<2.8,'gestures transition without one-frame hand jumps');life.dispose();
});
