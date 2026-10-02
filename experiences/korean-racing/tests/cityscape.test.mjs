import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildCoastalCity} from '../cityscape.js';
import {createLandscapeHeight} from '../landscape.js';
import {architecturalFaceUv} from '../city-materials.js';

const pathX=s=>Math.sin(s/235)*25+Math.sin(s/580)*31;
const pathY=s=>23+Math.sin(s/280)*2.8+Math.sin(s/100)*1.2;
const groundHeight=createLandscapeHeight(pathX,pathY);
const city=()=>buildCoastalCity(THREE,{pathX,groundHeight,roadEnd:2250});

test('coastal city keeps every actual vertex on the inland side outside the full road and shoulder',()=>{
  const c=city();
  let triangles=0,clearance=Infinity;
  c.group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    assert.equal(mesh.geometry.groups.length,0,'each batch must cost one draw call');
    triangles+=mesh.geometry.attributes.position.count/3;
    for(const name of ['position','normal','uv','color','cityUv','cityCell','citySeed']) {
      assert(mesh.geometry.attributes[name].array.every(Number.isFinite));
      assert.equal(mesh.geometry.attributes[name].count,mesh.geometry.attributes.position.count);
    }
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const distance=pathX(p.getZ(i))-p.getX(i);clearance=Math.min(clearance,distance);
      assert(distance>9.29,`road encroachment at ${p.getZ(i)}: ${distance}`);
    }
  });
  assert.equal(c.stats.storedTriangles,triangles);
  assert.equal(c.stats.roadMinimumClearance,clearance);
  assert(c.stats.storedTriangles<31000);
  assert.equal(c.stats.shops,22);assert.equal(c.stats.towers,12);assert.equal(c.stats.homes,3);
  c.dispose();
});

test('architectural metre UVs retain the true width of each face instead of stretching a thin glass box',()=>{
  const options={u:.5,v:.5,w:.14,h:3.3,d:18,floorPitch:3.7};
  const front=architecturalFaceUv({...options,nx:1,ny:0,nz:0});
  const end=architecturalFaceUv({...options,nx:0,ny:0,nz:-1});
  const top=architecturalFaceUv({...options,nx:0,ny:1,nz:0});
  assert.deepEqual(front.uv,[9,1.65]);
  assert.deepEqual(end.uv,[.07,1.65]);
  assert.deepEqual(top.uv,[.07,9]);
  assert.equal(front.cell[1],3.3);
  const c=city();let checkedEdges=0;
  c.group.traverse(mesh=>{
    // Shop glazing is made only from actual rectangular faces. Check its
    // assembled buffers, including both gables, side faces and narrow caps.
    if(!mesh.isMesh||!mesh.name.includes('promenade-')||!mesh.name.endsWith('-glass'))return;
    const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.cityUv;
    for(let triangle=0;triangle<p.count;triangle+=3)for(const [a,b] of [[0,1],[1,2],[2,0]]) {
      const i=triangle+a,j=triangle+b;
      const world=Math.hypot(p.getX(i)-p.getX(j),p.getY(i)-p.getY(j),p.getZ(i)-p.getZ(j));
      const metric=Math.hypot(uv.getX(i)-uv.getX(j),uv.getY(i)-uv.getY(j));
      assert(Math.abs(world-metric)<.0015,'a window has stretched surface metres');checkedEdges++;
    }
  });
  assert(checkedEdges>2000);c.dispose();
});

test('mobile material simplification reuses one shader and the same geometry without adding lights or render passes',()=>{
  const c=city(),shaders=[],keys=[];
  const unique=new Set();
  c.group.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.material.userData.finish||unique.has(mesh.material))return;
    unique.add(mesh.material);
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    mesh.material.onBeforeCompile(shader);
    assert(shader.vertexShader.includes('vCityMetric=cityUv'));
    shaders.push(shader);keys.push([mesh.material,mesh.material.customProgramCacheKey()]);
  });
  assert.equal(unique.size,6);
  const vertices=c.stats.storedTriangles;
  c.update({playerS:380,quality:'low'});
  for(const shader of shaders)assert.equal(shader.uniforms.cityMaterialDetail.value,0);
  c.update({playerS:380,quality:'balanced'});
  for(const shader of shaders)assert.equal(shader.uniforms.cityMaterialDetail.value,.62);
  c.update({playerS:380,quality:'high'});
  for(const shader of shaders)assert.equal(shader.uniforms.cityMaterialDetail.value,1);
  for(const [material,key] of keys)assert.equal(material.customProgramCacheKey(),key);
  assert.equal(c.stats.storedTriangles,vertices);
  assert.equal(c.stats.materials.extraTriangles,0);assert.equal(c.stats.materials.extraDrawCalls,0);
  assert.equal(c.stats.materials.downloadedTextures,0);c.dispose();
});

test('terrace foundations use the real current ground and glazing never floats below its support',()=>{
  const c=city();
  for(const pad of c.group.userData.footprints){
    assert(pad.maxGround>=pad.minGround);
    assert(Math.abs(pad.baseY-pad.maxGround-.035)<1e-7);
    const center=groundHeight(pad.x,pad.z);
    assert(center>=pad.minGround-1e-7&&center<=pad.maxGround+1e-7);
    assert(c.containsFootprint(pad.x,pad.z));
  }
  c.group.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.name.includes('Glass')&&!mesh.name.endsWith('-glass'))return;
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++) assert(p.getY(i)>groundHeight(p.getX(i),p.getZ(i))-.10,'glass facade is buried in the existing ground');
  });
  assert(!c.containsFootprint(pathX(380),380));
  assert(c.containsFootprint(pathX(380)-12,380),'terrain-following pedestrian paving must exclude vegetation');
  c.dispose();
});

test('the authored skyline has asymmetric crowns, terraces and independent masses rather than one identical box',()=>{
  const c=city(),features=c.group.userData.features;
  const towers=features.filter(f=>f.kind==='tower'),shops=features.filter(f=>f.kind==='shop');
  assert.equal(new Set(towers.map(f=>f.style)).size,4);
  assert.equal(new Set(shops.map(f=>f.floors)).size,3);
  assert(Math.max(...towers.map(t=>t.height))-Math.min(...towers.map(t=>t.height))>50);
  assert(towers.every(t=>t.x-pathX(t.z)<-70));
  assert(shops.every(t=>t.x-pathX(t.z)>-40));
  assert(c.group.userData.walks.every(w=>w.end-w.start<165),'the boulevard needs open landscape breaks');
  assert(shops.some(f=>f.s<335),'the first run must show the district before its first listening gate');
  c.dispose();
});

test('every course position observes a smaller mobile budget and quality is reversible without rebuilding',()=>{
  const c=city(),identities=[];c.group.traverse(mesh=>{if(mesh.isMesh)identities.push(mesh.geometry);});
  const maxima={high:{triangles:0,calls:0},balanced:{triangles:0,calls:0},low:{triangles:0,calls:0}};
  for(let s=0;s<=2250;s+=5){
    for(const quality of ['high','balanced','low']){
      const stats=c.update({playerS:s,quality});
      maxima[quality].triangles=Math.max(maxima[quality].triangles,stats.visibleTriangles);
      maxima[quality].calls=Math.max(maxima[quality].calls,stats.drawCalls);
      if(quality==='low')assert.equal(stats.shadowDrawCalls,0);
    }
    const low=c.update({playerS:s,quality:'low'}).visibleTriangles;
    assert(c.update({playerS:s,quality:'high'}).visibleTriangles>=low);
  }
  assert(maxima.high.triangles<21800);assert(maxima.high.calls<=61);
  assert(maxima.balanced.triangles<15800);assert(maxima.balanced.calls<=44);
  assert(maxima.low.triangles<10400);assert(maxima.low.calls<=33);
  let index=0;c.group.traverse(mesh=>{if(mesh.isMesh)assert.equal(mesh.geometry,identities[index++]);});
  c.dispose();
});

test('the city vanishes in the flower theme and sunset uses shared emissive windows without any dynamic light',()=>{
  const c=city(); let lamp,glass;
  c.group.traverse(mesh=>{assert(!mesh.isLight);if(mesh.name.endsWith('-lamp'))lamp=mesh.material;if(mesh.name.endsWith('-glass'))glass=mesh.material;});
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <emissivemap_fragment>'};
  glass.onBeforeCompile(shader);
  const windowUniform=shader.uniforms.cityTwilight;
  c.setTheme('sunset');assert.equal(windowUniform.value,1);assert(lamp.emissiveIntensity>1);
  c.setTheme('bloom');assert.equal(c.group.visible,false);assert.equal(c.stats.drawCalls,0);assert.equal(c.stats.visibleTriangles,0);
  c.setTheme('coast');assert(c.group.visible);assert(windowUniform.value>0&&windowUniform.value<1);assert(c.stats.drawCalls>0);
  c.dispose();
});

test('the residential pocket fits real terrain between shops and keeps every balcony inside its vegetation exclusion',()=>{
  const c=city(),features=c.group.userData.features,homes=features.filter(f=>f.kind==='home');
  const pads=c.group.userData.footprints.filter(p=>p.kind==='home');
  assert.equal(homes.length,3);assert.equal(pads.length,3);
  for(const home of homes) {
    const pad=pads.find(p=>p.z===home.s);
    assert(home.s>460&&home.s<650,'homes must form the initial open residential pocket');
    assert(home.height<9,'homes must stay clearly below the commercial skyline');
    assert(pad.maxGround-pad.minGround<2.25,'a large bright retaining podium would overwhelm the homes');
    for(const other of c.group.userData.footprints.filter(p=>p!==pad)) {
      const distance=Math.hypot(pad.x-other.x,pad.z-other.z);
      assert(distance>Math.hypot(pad.halfW,pad.halfD)+Math.hypot(other.halfW,other.halfD),'a home overlaps another authored building footprint');
    }
    const meshes=c.group.getObjectByName('coastal-city-harbour-homes').children;
    c.group.updateMatrixWorld(true);
    const stairs=[];
    for(const run of [.25,.80,1.60]) {
      const v=-home.depth*.5-run,x=pad.x+Math.sin(pad.yaw)*v,z=pad.z+Math.cos(pad.yaw)*v;
      const ray=new THREE.Raycaster(new THREE.Vector3(x,pad.baseY+.60,z),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObjects(meshes,false)[0];
      assert(hit,'the front door approach needs actual supporting steps');
      assert(hit.point.y>groundHeight(x,z)-.025,'the approach step is buried in the slope');
      stairs.push(hit.point.y);
    }
    assert(stairs[0]>=stairs[1]&&stairs[1]>=stairs[2],'entry steps must descend toward the terrain');
  }
  let vertices=0;
  c.group.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.name.includes('harbour-homes'))return;
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++) {
      assert(c.containsFootprint(p.getX(i),p.getZ(i),.002),'a balcony or roof lies outside the vegetation exclusion');
      vertices++;
    }
  });
  assert(vertices>1000);
  c.update({playerS:550,quality:'high'});
  assert(c.group.getObjectByName('coastal-city-harbour-homes').visible);
  c.update({playerS:550,quality:'low'});
  assert(c.group.getObjectByName('coastal-city-harbour-homes').children.filter(m=>m.userData.cityTier==='detail').every(m=>!m.visible));
  const geometries=new Set(),materials=new Set(),disposedGeometry=new Set(),disposedMaterial=new Set();
  c.group.traverse(mesh=>{
    if(!mesh.isMesh)return;geometries.add(mesh.geometry);materials.add(mesh.material);
  });
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposedGeometry.add(geometry));
  for(const material of materials)material.addEventListener('dispose',()=>disposedMaterial.add(material));
  c.dispose();
  assert.equal(disposedGeometry.size,geometries.size);assert.equal(disposedMaterial.size,materials.size);assert.equal(c.group.children.length,0);
});

test('camera frustum culling removes the district when looking away while retaining geometry for returning',()=>{
  const c=city(),camera=new THREE.PerspectiveCamera(48,16/9,.1,2500);
  camera.position.set(pathX(730),30,730);camera.lookAt(pathX(730)+500,30,730);camera.updateMatrixWorld();
  assert.equal(c.update({playerS:730,quality:'high',camera}).drawCalls,0);
  camera.lookAt(pathX(730)-80,62,780);camera.updateMatrixWorld();
  assert(c.update({playerS:730,quality:'high',camera}).drawCalls>0);
  c.dispose();
});

test('activity anchors match the actual platform, table top and chair seat, and never enter the driving strip',()=>{
  const c=city(),anchors=c.group.userData.activityAnchors,counts={table:0,party:0,cheer:0,walk:0};
  const surfaces=[],seats=[];
  c.group.updateMatrixWorld(true);
  c.group.traverse(mesh=>{if(mesh.isMesh){surfaces.push(mesh);if(mesh.name.endsWith('-activity-timber'))seats.push(mesh.geometry.attributes.position);}});
  const raycaster=new THREE.Raycaster();
  const onFloor=p=>{
    assert(pathX(p.z)-p.x>10.25,'a person is inside the safe road/view strip');
    raycaster.set(new THREE.Vector3(p.x,p.y+.018,p.z),new THREE.Vector3(0,-1,0));
    const hit=raycaster.intersectObjects(surfaces,false)[0];
    assert(hit&&Math.abs(hit.point.y-p.y)<.009,'the provided foot position has no actual supporting surface');
  };
  for(const a of anchors){
    assert(Number.isFinite(a.blockS));assert(a.blockId.startsWith('promenade-'));counts[a.kind]++;
    if(a.kind==='table'){
      assert.equal(a.guests.length,2);
      for(const p of a.guests){
        onFloor(p);assert.equal(p.seatHeight,.57);
        assert(Math.abs(a.tableTop.y-p.y-.86)<1e-7);
        let supportingVertices=0;
        for(const position of seats)for(let i=0;i<position.count;i++)if(Math.abs(position.getY(i)-p.y-p.seatHeight)<.00001&&Math.hypot(position.getX(i)-p.x,position.getZ(i)-p.z)<.35)supportingVertices++;
        assert(supportingVertices>=6,'an NPC chair anchor does not match its actual seat surface');
      }
    }else if(a.kind==='party'||a.kind==='cheer'){
      for(const p of a.positions)onFloor(p);
      for(let i=0;i<a.positions.length;i++)for(let j=i+1;j<a.positions.length;j++)assert(Math.hypot(a.positions[i].x-a.positions[j].x,a.positions[i].z-a.positions[j].z)>1.3,'people overlap each other');
      if(a.kind==='party'){
        for(const p of a.positions){const direction=new THREE.Vector2(Math.sin(p.yaw),Math.cos(p.yaw)),toward=new THREE.Vector2(a.x-p.x,a.z-p.z).normalize();assert(direction.dot(toward)>.98,'the conversation group is facing away from its partners');}
      }
    }else {
      assert.equal(a.path.length,9);
      for(const p of a.path){onFloor(p);assert(Math.abs(p.y-c.surfaceHeightAt(p.x,p.z))<1e-7);}
    }
  }
  assert.deepEqual(counts,{table:8,party:4,cheer:4,walk:8});
  c.dispose();
});
