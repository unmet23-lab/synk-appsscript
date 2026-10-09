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

export function makeLandscape(scene, m) {
  const group = new THREE.Group(); group.name = 'han-river-terraced-city'; scene.add(group);
  group.userData.visualRevision = 'riverfront-v5';
  const ridgeMaterials = [], buildingMaterials = [], random = rng(935);
  // Irregular rounded spines, side ravines and tree-colour patches are evaluated
  // once in vertex data. The distant hills do not run a per-pixel noise shader.
  for (const [depth, height, color, phase] of [[-92, 9.5, '#b7c9d3', 3], [-79, 7.4, '#8faeab', 8], [-64, 5.7, '#62846c', 12]]) {
    const geo = new THREE.PlaneGeometry(110, 24, 96, 16), p = geo.attributes.position, colors = [], base = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = (p.getY(i) + 12) / 24;
      const ridge = height + Math.sin(x * .13 + phase) * 1.75 + Math.sin(x * .31 - phase) * 1.07 + Math.sin(x * .73 + phase) * .32;
      const shoulder = Math.sin(t * Math.PI) ** (1.23 + Math.sin(x * .19 + phase) * .25);
      const ravine = Math.abs(Math.sin(x * .24 + t * 2.9 + phase)) ** 9 * (1.25 + Math.sin(t * Math.PI));
      const ripples = Math.sin(x * .53 + t * 7 + phase) * .48 + Math.sin(x * 1.1 - t * 13) * .18;
      const y = -1.7 + shoulder * (ridge + ripples - ravine);
      p.setXYZ(i, x, y, depth + (1 - t) * 20);
      const patch = Math.sin(x * .49 + t * 17 + phase) * .5 + Math.sin(x * 1.17 - t * 25) * .22;
      const colorAtVertex = base.clone().lerp(new THREE.Color('#294f43'), Math.max(0, patch) * .31)
        .lerp(new THREE.Color('#c3b997'), Math.max(0, -patch) * .23 + Math.max(0, y - height * .6) * .012);
      colors.push(colorAtVertex.r, colorAtVertex.g, colorAtVertex.b);
    }
    geo.computeVertexNormals(); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .98, side: THREE.DoubleSide, map: m.landscapeMap, normalMap: m.landscapeNormal, normalScale: new THREE.Vector2(.11, .11) });
    mat.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', 'vec3 mountainBase=diffuseColor.rgb;\n#include <map_fragment>\ndiffuseColor.rgb=mix(mountainBase,diffuseColor.rgb,.28);'); };
    ridgeMaterials.push(mat); const mountain = new THREE.Mesh(geo, mat); mountain.name = 'layered-mountain'; group.add(mountain);
  }
  const cityMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .78 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .31, metalness: .24, clearcoat: .35 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .88 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .96 });
  buildingMaterials.push(cityMat, glassMat, roofMat, canopyMat);
  const structures = [], trim = [], windows = [], trees = [], cube = new THREE.BoxGeometry(1, 1, 1);
  let buildingCount = 0;
  const body = (p, s, c = '#c7c5b7') => structures.push({ p, s, c });
  const edge = (p, s, c = '#74877b', r) => trim.push({ p, s, c, r });
  const canopy = (x, y, z, scale = 1, color = '#69865c') => {
    trees.push({ p: [x, y + scale * .06, z], s: [scale * .33, scale * (.33 + random() * .12), scale * .31], r: [0, random() * TAU, (random() - .5) * .25],
      c: new THREE.Color(color).lerp(new THREE.Color('#a0ad75'), random() * .35).getHex() });
  };
  function building(x, z, w, d, h, kind, palette) {
    buildingCount++;
    const y = -.94, color = new THREE.Color(palette).lerp(new THREE.Color('#efe0c7'), random() * .25).getHex();
    body([x, y + h / 2, z], [w, h, d], color);
    edge([x, y + h + .02, z], [w + .06, .065, d + .05], '#a1aa94');
    const floors = Math.max(2, Math.floor(h / .26)), cols = kind === 'glass' ? 4 : 3;
    // Window panes are two-triangle surfaces, not twelve-triangle miniature boxes.
    // Their side faces turn with the actual buildings rather than the camera.
    for (let floor = 0; floor < floors; floor++) {
      const yy = y + .14 + floor * (h - .18) / floors;
      const paneColor = new THREE.Color('#4e7080').lerp(new THREE.Color('#91aaa9'), random() * .48).getHex();
      for (let col = 0; col < cols; col++) {
        const xx = (col - (cols - 1) / 2) * w / (cols + .7);
        windows.push({ p: [x + xx, yy, z + d / 2 + .004], s: [w / (cols + .7) * (kind === 'glass' ? .87 : .60), kind === 'glass' ? .18 : .105, 1], c: paneColor });
      }
      for (const sign of [-1, 1]) windows.push({ p: [x + sign * (w / 2 + .004), yy, z], r: [0, sign * Math.PI / 2, 0], s: [d * .64, .10, 1], c: '#678b92' });
      if (kind === 'terrace' && floor % 2 === 1) edge([x, yy - .086, z + d / 2 + .05], [w + .035, .031, .16], '#b8bfad');
    }
    if (kind === 'terrace') {
      const upperH = h * .22;
      body([x - w * .12, y + h + upperH / 2 + .07, z - d * .15], [w * .58, upperH, d * .57], color);
      edge([x - w * .12, y + h + upperH + .10, z - d * .15], [w * .63, .07, d * .62], '#758b70');
      canopy(x + w * .32, y + h + .21, z + d * .16, .70);
    } else if (kind === 'glass') {
      // Slim set-back crown and a quiet vertical mullion give the future towers
      // a composed silhouette without a dense field of competing landmarks.
      edge([x, y + h + .12, z], [w * .72, .2, d * .66], '#96ada8');
      edge([x, y + h * .51, z + d / 2 + .018], [.022, h, .022], '#dbd7bf');
    }
  }
  // Three depth bands, with open park corridors between neighbourhoods.
  // Low waterfront blocks and taller set-back towers avoid a flat wall of boxes.
  for (let i = 0; i < 25; i++) {
    const x = -30 + i * 2.45 + (random() - .5) * .72, z = -46 - random() * 7;
    building(x, z, .64 + random() * .65, .85 + random() * .55, 1.0 + random() * 2.8, i % 5 === 0 ? 'glass' : 'residential', '#a8b7b6');
  }
  for (const [center, z, peak] of [[-19, -36, 4.0], [-7.7, -37, 4.4], [4.5, -37, 5.1], [15.5, -38, 4.6], [26, -39, 3.6]]) {
    for (let j = 0; j < 5; j++) {
      const x = center + (j - 2) * 1.43 + (random() - .5) * .3, h = peak * (j === 2 ? 1 : .42 + random() * .35);
      building(x, z + random() * 2.6, .67 + random() * .42, .86 + random() * .43, h, j === 2 ? 'glass' : 'terrace', '#bbc3b4');
    }
  }
  for (let i = 0; i < 24; i++) {
    const x = -29 + i * 2.5, z = -29.2 - random() * 2.2;
    if (i % 6 === 2) continue;
    building(x, z, 1.0 + random() * .58, .86 + random() * .48, .50 + random() * .49, 'terrace', '#cec8b2');
  }
  // Tower-like cultural landmark sits on a wooded rise, behind the homes.
  const tower = new THREE.Group(); tower.name = 'hill-observatory'; tower.position.set(-2.2, -.50, -45); group.add(tower);
  cylinder(tower, cityMat, [0, 2.25, 0], .045, .16, 4.5, 12);
  cylinder(tower, glassMat, [0, 4.17, 0], .26, .22, .35, 16);
  cylinder(tower, cityMat, [0, 4.75, 0], .018, .042, 1.03, 8);
  cylinder(tower, cityMat, [0, 3.98, 0], .34, .28, .075, 16);
  // An irregular planted bank meets the promenade instead of an empty straight
  // green strip. Both forest patches and individual avenue trees share one draw.
  for (let i = 0; i < 100; i++) {
    const x = -39 + random() * 78, z = -29 - random() * 24, scale = .72 + random() * 1.1;
    canopy(x, -.64 + scale * .22, z, scale, '#547856');
  }
  for (let i = 0; i < 45; i++) {
    const x = -33 + i * 1.5, scale = .76 + random() * .3;
    edge([x, -.54, -26.4], [.048, .75, .048], '#6a7560'); canopy(x, -.08, -26.4, scale);
  }
  const riverbank = new THREE.Mesh(new THREE.PlaneGeometry(110, 42), new THREE.MeshStandardMaterial({ color: '#6d8c75', roughness: 1, normalMap: m.landscapeNormal, normalScale: new THREE.Vector2(.11, .11) }));
  riverbank.rotation.x = -Math.PI / 2; riverbank.position.set(0, -1.05, -47); group.add(riverbank);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(110, 40), m.water); water.name = 'han-river-water'; water.rotation.x = -Math.PI / 2; water.position.set(0, -1.16, -6); group.add(water);
  body([0, -.89, -26], [80, .27, .7], '#b6b8a3');
  edge([0, -.723, -26], [80, .065, 1.55], '#bfc4ad');
  edge([0, -.76, -25.60], [80, .10, .08], '#889b88');
  // Small river steps break the engineered edge with places to sit by the water.
  for (const x of [-14, 3, 19]) for (let step = 0; step < 4; step++) body([x, -.79 - step * .07, -25.28 + step * .15], [1.4, .06, .18], '#cad0bb');
  // Tapered piers, a slim deck and a restrained arch read as an inhabited bridge.
  // Repeated structural parts join the city batches; there is no per-part draw.
  body([9, -.20, -12], [19, .115, .53], '#b2c1bd');
  for (let i = 0; i < 8; i++) {
    const x = .8 + i * 2.6;
    body([x, -.69, -12], [.12, .85, .29], '#9eafa9');
    body([x, -.32, -12], [.35, .12, .41], '#b4c0b5');
  }
  for (const z of [-12.27, -11.73]) {
    edge([9, -.053, z], [19, .025, .022], '#697f7e');
    for (let i = 0; i < 25; i++) edge([-.43 + i * .784, -.116, z], [.013, .135, .017], '#92a69c');
    // A continuous three-span shallow arch, expressed with short straight beams.
    for (let span = 0; span < 3; span++) for (let j = 0; j < 14; j++) {
      const x1 = -.5 + span * 6.333 + j * 6.333 / 14, x2 = x1 + 6.333 / 14;
      const y1 = -.20 + Math.sin(j / 14 * Math.PI) * .46, y2 = -.20 + Math.sin((j + 1) / 14 * Math.PI) * .46;
      edge([(x1 + x2) / 2, (y1 + y2) / 2, z], [Math.hypot(x2 - x1, y2 - y1), .043, .033], '#afbeb4', [0, 0, Math.atan2(y2 - y1, x2 - x1)]);
    }
  }
  const structureMesh = batch(group, cube, cityMat, structures, false); structureMesh.name = 'riverfront-architecture';
  const trimMesh = batch(group, cube, roofMat, trim, false); trimMesh.name = 'terraces-promenade-bridge';
  const windowMesh = batch(group, new THREE.PlaneGeometry(1, 1), glassMat, windows, false); windowMesh.name = 'riverfront-window-panes';
  // Smooth, asymmetrical crowns read as foliage rather than faceted boulders.
  const crownGeometry = new THREE.SphereGeometry(1, 8, 5), crownPositions = crownGeometry.attributes.position, crownColors = [];
  for (let i = 0; i < crownPositions.count; i++) {
    const x = crownPositions.getX(i), y = crownPositions.getY(i), z = crownPositions.getZ(i);
    const azimuth = Math.atan2(z, x), swell = 1 + Math.sin(azimuth * 3 + y * 4) * .16 + Math.cos(azimuth * 5 - y * 3) * .09;
    crownPositions.setXYZ(i, x * swell + y * .08, y + Math.sin(azimuth * 3) * (1 - y * y) * .075, z * swell);
    const shade = .76 + (y + 1) * .12; crownColors.push(shade, shade, shade);
  }
  crownGeometry.computeVertexNormals(); crownGeometry.setAttribute('color', new THREE.Float32BufferAttribute(crownColors, 3));
  const treeMesh = batch(group, crownGeometry, canopyMat, trees, false); treeMesh.name = 'riverfront-tree-canopies';
  group.userData.landscapeStats = { buildings: buildingCount, windowPanes: windows.length, treeCanopies: trees.length, structureParts: structures.length, trimParts: trim.length };
  return { group, ridgeMaterials, buildingMaterials };
}
