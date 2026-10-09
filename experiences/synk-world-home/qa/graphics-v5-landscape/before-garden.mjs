import * as THREE from './scene-assets/three.module.js';

// Original geometry for the WORLD home courtyard. Repeated small parts are
// instanced so a richer garden does not imply a draw call for every leaf/tile.
const TAU = Math.PI * 2;
function rng(seed) { return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); }
function softenedBox(w,h,d,r=.018){
 const s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/5,h/5,d/5);s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2,curveSegments:2});g.translate(0,0,-(d-2*r)/2);return g;
}
function box(parent, material, p, size, shadow = true) {
  const m = new THREE.Mesh(softenedBox(...size), material);
  m.position.set(...p); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
function pavingGeometry() {
  const w = .896, d = .678, r = .017, shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -d / 2); shape.lineTo(w / 2 - r, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); shape.lineTo(-w / 2 + r, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); shape.lineTo(-w / 2, -d / 2 + r); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: .036, bevelEnabled: true, bevelSize: .007, bevelThickness: .007, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -.018); g.rotateX(-Math.PI / 2); return g;
}
function batch(parent, geometry, material, transforms, shadows = true) {
  const result = new THREE.InstancedMesh(geometry, material, transforms.length), dummy = new THREE.Object3D();
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i]; dummy.position.set(...t.p); dummy.rotation.set(...(t.r || [0, 0, 0])); dummy.scale.set(...(t.s || [1, 1, 1])); dummy.updateMatrix();
    result.setMatrixAt(i, dummy.matrix); if (t.c) result.setColorAt(i, new THREE.Color(t.c));
  }
  result.castShadow = shadows; result.receiveShadow = true; result.computeBoundingSphere(); parent.add(result); return result;
}
function tube(parent, points, radius, material) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, 16, radius, 6, false), material);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function leafGeometry(mobile = false) {
  const positions = [], uv = [], indices = [], rows = mobile ? 8 : 10, cols = 4;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const v = j / rows, u = i / cols * 2 - 1, w = Math.sin(v * Math.PI) ** .58;
    positions.push(u * .19 * w * (1 + Math.sin(v * 21 + u) * .04), v, Math.sin(v * Math.PI) * .095 - u * u * w * .045 + Math.sin(v * 10) * .013 * Math.abs(u));
    uv.push(i / cols, v); const k = j * (cols + 1) + i;
    if (j < rows && i < cols) indices.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function cylinder(parent, material, p, top, bottom, height, sides = 24) {
  let geometry;
  if(material.userData.handThrown){const points=[new THREE.Vector2(0,-height/2),new THREE.Vector2(bottom*.92,-height/2),new THREE.Vector2(bottom,-height/2+.024)];for(let i=1;i<=12;i++){const t=i/12;points.push(new THREE.Vector2(bottom+(top-bottom)*t+Math.sin(t*Math.PI)*.020,-height/2+.024+(height-.024)*t));}geometry=new THREE.LatheGeometry(points,sides);}else geometry=new THREE.CylinderGeometry(top,bottom,height,sides);
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function fernLeaves(entries, random, origin, scale, count = 32) {
  for (let n = 0; n < count; n++) {
    const angle = random() * TAU, radius = random() * .12 * scale;
    entries.push({ p: [origin[0] + Math.sin(angle) * radius, origin[1], origin[2] + Math.cos(angle) * radius],
      r: [(.33 + random() * .95), angle, (random() - .5) * .15], s: [scale * (.65 + random() * .6), scale * (.48 + random() * .65), scale],
      c: new THREE.Color('#456b39').lerp(new THREE.Color('#a1af56'), random() * .8).getHex() });
  }
}
function planter(parent, m, p, width, depth, height) {
  const g = new THREE.Group(); g.position.set(...p); parent.add(g);
  box(g, m.stone, [0, height / 2, 0], [width, height, depth]);
  // Separate stone coping pieces expose the soil well and its contact shadows.
  for (const sign of [-1, 1]) {
    box(g, m.stoneLight, [0, height + .025, sign * (depth / 2 - .065)], [width + .04, .07, .17]);
    box(g, m.stoneLight, [sign * (width / 2 - .05), height + .025, 0], [.14, .07, depth + .045]);
  }
  box(g, m.soil, [0, height - .035, 0], [width - .12, .025, depth - .12]); return height + p[1] - .018;
}

export function makeCourtyard(parent, m, { mobile = false } = {}) {
  const random = rng(5146), foliage = [], flowers = [], stalks = [], cube = softenedBox(1,1,1,.012);
  const herb = (origin, scale, count = 18) => {
    for (let n = 0; n < count; n++) {
      const angle = random() * TAU, radius = random() * .22 * scale, h = (.18 + random() * .25) * scale;
      const x = origin[0] + Math.sin(angle) * radius, z = origin[2] + Math.cos(angle) * radius;
      stalks.push({ p: [x, origin[1] + h * .5, z], s: [.007 * scale, h, .007 * scale] });
      for (let j = 0; j < 3; j++) {
        foliage.push({ p: [x, origin[1] + h * (.42 + j * .24), z], r: [.9 + random() * .6, angle + j * 2.1, 0], s: [.25 * scale, .18 * scale, .25 * scale], c: new THREE.Color('#577246').lerp(new THREE.Color('#b2b978'), random() * .8).getHex() });
      }
    }
  };
  // A continuous architectural floor replaces the floating display plinth.
  box(parent, m.stone, [0, -.065, -.45], [10, .5, 7.5]);
  const tiles = [];
  for (let z = -3; z <= 2.5; z += .69) for (let x = -4.2; x <= 4.3; x += .91) {
    tiles.push({ p: [x + (Math.round((z + 3) / .69) % 2) * .08, .204 + random() * .002, z], c: new THREE.Color('#e4ddca').lerp(new THREE.Color('#aab2a8'), random() * .30).getHex() });
  }
  batch(parent, pavingGeometry(), m.paving, tiles);
  // Inset honey-toned deck is reserved for the furnished reading corner.
  const boards = Array.from({ length: 18 }, (_, i) => ({ p: [-2.95, .25, -2.24 + i * .19], s: [2.38, .08, .179], c: new THREE.Color('#ad7844').lerp(new THREE.Color('#d5aa73'), random() * .7).getHex() }));
  batch(parent, cube, m.wood, boards);
  box(parent, m.darkWood, [-2.95, .233, -.61], [2.43, .12, 3.44]);
  // Back parapet: thick coping, visible blocks and slim metal rail.
  box(parent, m.plaster, [0, .57, -2.85], [9.3, .7, .34]);
  box(parent, m.stoneLight, [0, .955, -2.83], [9.44, .13, .48]);
  const posts = [];
  for (let i = 0; i < 17; i++) posts.push({ p: [-4.4 + i * .55, 1.12, -2.91], s: [.026, .43, .028] });
  batch(parent, cube, m.metal, posts);
  box(parent, m.metal, [0, 1.325, -2.91], [8.9, .034, .042]);
  // Plaster and oak house front, with recessed glazing and roof joinery.
  const house = new THREE.Group(); house.position.set(-3.05, .24, -2.32); parent.add(house);
  box(house, m.plaster, [0, 1.1, -.11], [2.64, 2.2, .3]);
  box(house, m.metal, [0, 1.04, .07], [1.64, 1.72, .075]);
  box(house, m.glass, [0, 1.08, .118], [1.49, 1.58, .026]);
  const frames = [
    { p: [-.79, 1.08, .16], s: [.065, 1.7, .07] }, { p: [.79, 1.08, .16], s: [.065, 1.7, .07] },
    { p: [0, 1.08, .16], s: [.055, 1.7, .07] }, { p: [0, .24, .16], s: [1.64, .07, .09] }, { p: [0, 1.92, .16], s: [1.64, .07, .09] },
    { p: [0, 1.32, .16], s: [1.64, .035, .07] }, { p: [0, .82, .16], s: [1.64, .035, .07] },
  ]; batch(house, cube, m.wood, frames);
  box(house, m.stoneLight, [0, .11, .18], [1.92, .16, .51]);
  box(house, m.darkWood, [0, 2.17, .02], [2.98, .13, .91]);
  box(house, m.roof, [0, 2.28, -.19], [3.14, .13, 1.45]).rotation.x = -.065;
  // Recessed plaster reveals, oak mullions and continuous joinery read at close range.
  for(const x of [-1.14,1.14])box(house,m.plaster,[x,1.07,.06],[.28,1.94,.16]);
  const siding=[];for(let n=0;n<9;n++)siding.push({p:[-1.02, .35+n*.184,.155],s:[.10,.157,.055]});
  batch(house,cube,m.wood,siding);
  box(house,m.metal,[.105,1.02,.224],[.018,.14,.025]);
  const eaves=[];for(let n=0;n<19;n++)eaves.push({p:[-1.48+n*.163,2.17,.24],s:[.040,.065,.86]});batch(house,cube,m.wood,eaves);
  // A restrained coursed base and inset panel prevent featureless plaster slabs.
  const stoneCourses=[];for(let n=0;n<17;n++)stoneCourses.push({p:[-4.35+n*.545,.59,-2.641],s:[.525,.22,.027],c:n%3===0?'#c8c9bb':'#e1ded2'});batch(parent,cube,m.stoneLight,stoneCourses);
  const roofSeams=[];for(let i=0;i<13;i++)roofSeams.push({p:[-1.48+i*.247,2.355,-.19],s:[.018,.024,1.42],r:[-.065,0,0]});batch(house,cube,m.roof,roofSeams);
  // A light pergola creates recognisable directional shadows on the floor.
  const timber = [];
  for (const x of [-4.21, -1.88]) {
    timber.push({ p: [x, 1.54, -.03], s: [.115, 2.58, .115] });
    timber.push({ p: [x, 2.82, -1.28], s: [.15, .14, 2.83] });
  }
  timber.push({ p: [-3.045, 2.81, -.04], s: [2.7, .19, .15] });
  for (let i = 0; i < 9; i++) timber.push({ p: [-4.34 + i * .322, 2.945, -1.29], s: [.075, .105, 2.82] });
  batch(parent, cube, m.darkWood, timber);
  // Long low bench, woven seat and neatly placed cushions.
  const seating = [];
  for (let i = 0; i < 5; i++) seating.push({ p: [-3.06, .77, -1.73 + i * .115], s: [1.72, .075, .106] });
  for (const x of [-3.72, -2.4]) seating.push({ p: [x, .52, -1.51], s: [.095, .48, .54] });
  for (let i = 0; i < 4; i++) seating.push({ p: [-3.06, 1.0 + i * .13, -1.88], s: [1.72, .10, .065] });
  batch(parent, cube, m.wood, seating);
  for (const [x, color] of [[-3.48, m.linen], [-2.65, m.sage]]) {
    const cushionGeometry=new THREE.SphereGeometry(1,24,14),cp=cushionGeometry.attributes.position;for(let i=0;i<cp.count;i++){const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i);cp.setXYZ(i,Math.sign(x)*Math.abs(x)**.62,y*(.88+.12*Math.cos(x*4)),Math.sign(z)*Math.abs(z)**.62);}cushionGeometry.computeVertexNormals();const cushion = new THREE.Mesh(cushionGeometry, color); cushion.position.set(x, .86, -1.50); cushion.scale.set(.36, .095, .245); cushion.castShadow = cushion.receiveShadow = true; parent.add(cushion);
  }
  // Recessed stone beds keep the abundance intentional and navigable.
  const bedY = planter(parent, m, [2.83, .24, -2.15], 2.16, 1.02, .52);
  for (let i = 0; i < 9; i++) herb([1.94 + i * .22, bedY, -2.17 + (random() - .5) * .45], .9, 14);
  const herbY = planter(parent, m, [-.5, .24, -2.23], 1.68, .70, .28);
  for (let i = 0; i < 8; i++) herb([-1.2 + i * .2, herbY, -2.22], .65, 10);
  // Small tree: continuous branches and airy, individual 3D leaves.
  const tree = new THREE.Group(); tree.position.set(2.95, bedY, -2.14); parent.add(tree);
  tube(tree, [[0, 0, 0], [-.035, .65, .02], [.08, 1.28, 0], [-.05, 1.99, -.04]], .064, m.bark);
  const crown = [];
  for (let branch = 0; branch < 15; branch++) {
    const angle = branch * 2.399, y = .72 + (branch % 4) * .25;
    const end = [Math.sin(angle) * (.62 + random() * .25), y + .45, Math.cos(angle) * .56];
    tube(tree, [[0, y * .6, 0], [end[0] * .48, y, end[2] * .48], end], .019 + (branch % 2) * .004, m.bark);
    for (let j = 0; j < (mobile ? 22 : 33); j++) {
      crown.push({ p: [end[0] + (random() - .5) * .68, end[1] + (random() - .5) * .48, end[2] + (random() - .5) * .65],
        r: [random() * 2.9 - .8, random() * TAU, random() * 1.3 - .65], s: [.31, .18 + random() * .12, .31],
        c: new THREE.Color('#385c38').lerp(new THREE.Color('#a4b573'), random()).getHex() });
    }
  }
  batch(tree, leafGeometry(mobile), m.foliage, crown);
  // One hand-thrown pot, one broad-leaf plant beside the arm-free mascot.
  cylinder(parent, m.terra, [1.98, .485, .35], .34, .245, .49, 36);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(.331, .024, 8, 36), m.terra); lip.position.set(1.98, .734, .35); lip.rotation.x = Math.PI / 2; lip.castShadow = true; parent.add(lip);
  cylinder(parent, m.soil, [1.98, .71, .35], .302, .302, .02, 28);
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.399, radius = .13 + random() * .20, end = [1.98 + Math.sin(angle) * radius, 1.0 + random() * .33, .35 + Math.cos(angle) * radius];
    tube(parent, [[1.98, .74, .35], [(1.98 + end[0]) / 2, end[1] - .15, (.35 + end[2]) / 2], end], .009, m.stem);
    foliage.push({ p: end, r: [1.05 + random() * .5, angle, .1], s: [.62, .37 + random() * .13, .62], c: new THREE.Color('#40632c').lerp(new THREE.Color('#809451'), random()).getHex() });
  }
  // Ground-level clusters frame the image without hiding the avatar.
  cylinder(parent, m.terra, [-3.9, .39, 1.47], .31, .24, .29, 24);
  cylinder(parent, m.soil, [-3.9, .54, 1.47], .28, .28, .015, 24);
  cylinder(parent, m.stone, [3.80, .43, 1.55], .34, .31, .38, 24);
  cylinder(parent, m.soil, [3.80, .626, 1.55], .31, .31, .015, 24);
  herb([-3.9, .55, 1.47], 1.4, 43);
  herb([3.80, .64, 1.55], 1.6, 46);
  for (let i = 0; i < 32; i++) {
    const x = 1.95 + random() * 1.71, z = -2.45 + random() * .67, y = bedY + .17 + random() * .38;
    flowers.push({ p: [x, y, z], s: [.029, .043, .029], c: i % 3 === 0 ? '#e7d5a1' : '#aa9cba' });
  }
  batch(parent, new THREE.SphereGeometry(1, 7, 5), m.flower, flowers, false);
  batch(parent, new THREE.CylinderGeometry(1, 1, 1, 4), m.stem, stalks, true);
  batch(parent, leafGeometry(mobile), m.foliage, foliage);
  // Vines rest on the pergola beams, never a random cloud of balls.
  const vines = [];
  for (let i = 0; i < (mobile ? 66 : 110); i++) {
    const x = -4.25 + random() * 2.55, z = -2.5 + random() * 2.65;
    vines.push({ p: [x, 2.98 + random() * .09, z], r: [1.48 + random() * .3, random() * TAU, (random() - .5) * .3], s: [.55, .31 + random() * .17, .5], c: new THREE.Color('#426b3d').lerp(new THREE.Color('#aab972'), random()).getHex() });
  }
  batch(parent, leafGeometry(mobile), m.foliage, vines);
  return { foliageCount: foliage.length + vines.length + crown.length };
}

export function makeLandscape(scene,m){
 const group=new THREE.Group();group.name='han-river-terraced-city';scene.add(group);const ridgeMaterials=[],buildingMaterials=[];
 for(const[depth,height,color,phase]of[[-92,8.7,'#cad5d8',3],[-79,7.0,'#a6bebd',8],[-64,5.0,'#759582',12]]){
  const geo=new THREE.PlaneGeometry(110,24,100,26),p=geo.attributes.position,colors=[],base=new THREE.Color(color);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),t=(p.getY(i)+12)/24;
   const ridge=height+Math.sin(x*.16+phase)*1.8+Math.sin(x*.39-phase)*.85+Math.sin(x*.77+phase)*.33;
   const spine=Math.sin(t*Math.PI)**1.36;
   const valley=Math.sin(x*.45+t*9+phase)*.72+Math.sin(x*.91-t*15)*.24+Math.sin(x*1.9+t*25)*.08;
   const ravine=Math.pow(Math.abs(Math.sin(x*.25+t*3.2+phase)),10)*1.35;
   const y=-1.8+spine*(ridge+valley-ravine);
   p.setXYZ(i,x,y,depth+(1-t)*20);
   const patch=(Math.sin(x*.78+t*18+phase)+Math.sin(x*1.41-t*24))*.5;const c=base.clone().lerp(new THREE.Color('#476b5b'),Math.max(0,patch)*.22).lerp(new THREE.Color('#bec0a0'),Math.max(0,Math.sin(x*.54+t*11+phase))*.12+Math.max(0,y-3)*.028);colors.push(c.r,c.g,c.b);
  }
  geo.computeVertexNormals();geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const mat=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.98,side:THREE.DoubleSide,map:m.landscapeMap,normalMap:m.landscapeNormal,normalScale:new THREE.Vector2(.13,.13)});mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','vec3 mountainBase=diffuseColor.rgb;\n#include <map_fragment>\ndiffuseColor.rgb=mix(mountainBase,diffuseColor.rgb,.34);');};ridgeMaterials.push(mat);group.add(new THREE.Mesh(geo,mat));
 }
 const cityMat=new THREE.MeshStandardMaterial({color:'#aebcb9',roughness:.8}),glassMat=new THREE.MeshPhysicalMaterial({color:'#80999b',roughness:.35,metalness:.2,clearcoat:.5}),roofMat=new THREE.MeshStandardMaterial({color:'#83958f',roughness:.83});buildingMaterials.push(cityMat,glassMat,roofMat);
 const random=rng(935),buildings=[],tops=[],windows=[],balconies=[];
 for(let i=0;i<43;i++){
  const cluster=i%6,centers=[-17,-11,-5,3,9,16],x=centers[cluster]+(random()-.5)*4.3,z=-27-(cluster%3)*4.6-random()*6.2,w=.46+random()*.7,d=.62+random()*.54,h=i%5===0?.48+random()*.55:.6+random()*2.15;
  buildings.push({p:[x,-1.00+h/2,z],s:[w,h,d],c:new THREE.Color('#a6b7b4').lerp(new THREE.Color('#d3d1c5'),random()).getHex()});
  tops.push({p:[x,h-.96,z],s:[w+.055,.07,d+.07]});
  for(let level=0;level<Math.floor(h/.21);level++)for(let col=0;col<3;col++)windows.push({p:[x+(col-1)*w*.28,-.83+level*.21,z+d/2+.006],s:[w*.15,.084,.012],c:level%4===0?'#a1b2b1':'#819b9e'});
  if(i%3===0)for(let level=1;level<Math.floor(h/.37);level++)balconies.push({p:[x,-.8+level*.37,z+d/2+.06],s:[w+.035,.031,.17]});
 }
 batch(group,new THREE.BoxGeometry(1,1,1),cityMat,buildings,false);batch(group,new THREE.BoxGeometry(1,1,1),roofMat,tops,false);batch(group,new THREE.BoxGeometry(1,1,1),glassMat,windows,false);batch(group,new THREE.BoxGeometry(1,1,1),cityMat,balconies,false);
 const tower=new THREE.Group();tower.position.set(-3.3,-1.0,-35);group.add(tower);cylinder(tower,cityMat,[0,1.5,0],.04,.11,3.0);cylinder(tower,glassMat,[0,2.72,0],.24,.22,.30);cylinder(tower,cityMat,[0,3.11,0],.025,.035,.72);cylinder(tower,cityMat,[0,2.58,0],.33,.26,.07);
 const riverbank=new THREE.Mesh(new THREE.PlaneGeometry(110,42),new THREE.MeshStandardMaterial({color:'#839b89',roughness:1,normalMap:m.landscapeNormal,normalScale:new THREE.Vector2(.15,.15)}));riverbank.rotation.x=-Math.PI/2;riverbank.position.set(0,-1.05,-47);group.add(riverbank);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(110,40),m.water);water.rotation.x=-Math.PI/2;water.position.set(0,-1.16,-6);group.add(water);
 const quay=[];for(let i=0;i<38;i++)quay.push({p:[-28+i*1.55,-.91,-26.0],s:[1.53,.25,.52]});batch(group,new THREE.BoxGeometry(1,1,1),roofMat,quay,false);
 // A distant bridge puts the river and future Korean city on a readable scale.
 const bridge=[];bridge.push({p:[9,-.2,-12],s:[19,.10,.39]});for(let i=0;i<8;i++)bridge.push({p:[.8+i*2.6,-.65,-12],s:[.13,.9,.28]});batch(group,new THREE.BoxGeometry(1,1,1),cityMat,bridge,false);
 return{group,ridgeMaterials,buildingMaterials};
}
