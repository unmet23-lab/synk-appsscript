import * as THREE from '/scene-assets/three.module.js';
import { createAvatarTextiles } from '/avatar-textiles.mjs';
import { TOWN_BRAND } from './day-materials.mjs';

// Town residents are their own cast, not recolours of the player's Mongle.
// The researcher follows docs/캐릭터/교수연구실/research.png. This is a local
// procedural interpretation, not a replacement for that approved 2D artwork.
const TAU = Math.PI * 2;
const WORLD_SCALE = .56;
// The large clothing colours stay individual and muted; brand colours appear
// at the apron, workwear and small sewn details rather than repainting faces.
const dyed = (color, ground, amount) => new THREE.Color(color).lerp(new THREE.Color(ground), amount);
const CAST = Object.freeze({
  'cafe-owner': { kind: 'human', face: [.435, .455, .365], skin: '#d4a182', hair: '#352821', hairStyle: 'bun', shoulders: 1.03, stature: .98, coat: dyed(TOWN_BRAND.lapis, '#4b5966', .20), shirt: TOWN_BRAND.paper, trousers: '#49554a', shoes: '#6b4836', trim: TOWN_BRAND.butter, costume: 'apron', seed: 11, description: '넓고 둥근 얼굴, 밤색 묶은 머리, 버터색 자수를 놓은 청금석 앞치마' },
  'workshop-owner': { kind: 'human', face: [.412, .485, .37], skin: '#ba8260', hair: '#282b2b', hairStyle: 'short', shoulders: 1.2, stature: 1.055, coat: dyed(TOWN_BRAND.lapisDeep, '#384149', .24), shirt: '#d9dedb', trousers: '#4b555d', shoes: '#4a3730', trim: TOWN_BRAND.coral, costume: 'work-jacket', seed: 29, description: '짧은 머리, 넓은 어깨, 작은 코랄 실땀의 짙은 남색 작업복' },
  'visitor-tea-reader': { kind: 'human', face: [.395, .44, .355], skin: '#d4b49c', hair: '#c8c6b9', hairStyle: 'silver-bob', shoulders: .98, stature: .925, coat: dyed(TOWN_BRAND.pop, '#63555d', .58), shirt: '#eee9e4', trousers: '#544657', shoes: '#554241', trim: dyed(TOWN_BRAND.pop, '#ecdce6', .36), costume: 'cardigan', glasses: true, seed: 43, description: '은발 단발, 둥근 안경, 베리색 니트 카디건' },
  'book-guest': { kind: 'human', face: [.365, .48, .34], skin: '#c99170', hair: '#654330', hairStyle: 'wave-bob', shoulders: .91, stature: 1.015, coat: dyed(TOWN_BRAND.butter, '#947341', .50), shirt: '#e8d4b7', trousers: '#63736b', shoes: '#805b44', trim: TOWN_BRAND.lapis, book: TOWN_BRAND.lapisDeep, costume: 'knit', seed: 61, description: '웨이브 단발, 긴 얼굴, 버터빛 니트와 남색 책' },
  companion: { kind: 'human', face: [.365, .45, .35], skin: '#e1b397', hair: '#352d31', hairStyle: 'ponytail', shoulders: .92, stature: 1.045, coat: dyed(TOWN_BRAND.meadow, '#43544d', .42), shirt: '#e9eae0', trousers: '#455b6a', shoes: '#dfcfb2', trim: TOWN_BRAND.butter, bag: dyed(TOWN_BRAND.lapisDeep, '#555057', .36), costume: 'travel-jacket', seed: 83, description: '긴 묶은 머리, 메도우 재킷, 남색 어깨 가방' },
  researcher: { kind: 'professor', seed: 107, description: '연보라 타원몸, 둥근 검은 안경, 아이보리 두갈래 콧수염' },
});

function rng(seed) { let n = seed; return () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296); }
function put(parent, geometry, material, position = [0, 0, 0], scale) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...position); if (scale) m.scale.set(...scale);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function group(parent, position = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g; }
function tube(parent, positions, radius, material, segments = 20) {
  return put(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(positions.map(p => new THREE.Vector3(...p))), segments, radius, 6, false), material);
}
function sewnPaths(parent, paths, material, name, radius = .0045, spacing = .023) {
  // One lit instanced mesh per detail: real round thread and tiny gaps, with
  // no screen overlay, alpha fringe or per-stitch scene objects.
  const pairs = [];
  for (const points of paths) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const count = Math.max(2, Math.ceil(curve.getLength() / spacing));
    for (let i = 0; i < count; i++) pairs.push([curve.getPoint(i / count), curve.getPoint((i + .69) / count)]);
  }
  const stitches = new THREE.InstancedMesh(new THREE.CylinderGeometry(radius, radius, 1, 5), material, pairs.length);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  pairs.forEach(([a, b], i) => {
    const direction = b.clone().sub(a); rotation.setFromUnitVectors(up, direction.clone().normalize());
    matrix.compose(a.clone().add(b).multiplyScalar(.5), rotation, new THREE.Vector3(1, direction.length(), 1)); stitches.setMatrixAt(i, matrix);
  });
  stitches.name = name; stitches.castShadow = stitches.receiveShadow = true; parent.add(stitches); return stitches;
}
function taperedTube(parent, positions, radii, material, segments = 20, sides = 9) {
  const curve = new THREE.CatmullRomCurve3(positions.map(p => new THREE.Vector3(...p))), frames = curve.computeFrenetFrames(segments, false);
  const vertices = [], normals = [], uv = [], indices = [];
  for (let j = 0; j <= segments; j++) {
    const t = j / segments, p = curve.getPointAt(t), f = t * (radii.length - 1), n = Math.min(radii.length - 2, Math.floor(f));
    const radius = THREE.MathUtils.lerp(radii[n], radii[n + 1], f - n);
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU, normal = frames.normals[j].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[j], Math.sin(a));
      vertices.push(...p.clone().addScaledVector(normal, radius).toArray()); normals.push(...normal.toArray()); uv.push(i / sides, t);
      const k = j * (sides + 1) + i; if (j < segments && i < sides) indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  return put(parent, geometry, material);
}
function roundBox(w, h, d, r = .025) {
  const shape = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 3, h / 3, d * .45);
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r); shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - r, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: r / 2, bevelThickness: r / 2, curveSegments: 4 }); g.translate(0, 0, -(d - r) / 2); return g;
}
function shell(profile, depth = .7, segments = 36) {
  // LatheGeometry already averages the duplicated UV-seam normals. Rebuilding
  // them after scaling would put a visible vertical lighting seam on the face.
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments); g.scale(1, 1, depth); return g;
}
function standingHeight(body) {
  // Measure all actual geometry, including the bun and hair tips, in model
  // coordinates so the caller's parent placement cannot alter the contract.
  body.updateWorldMatrix(true, true);
  const inverse = body.matrixWorld.clone().invert(), matrix = new THREE.Matrix4(), bounds = new THREE.Box3();
  body.traverse(o => {
    if (!o.geometry || o.isInstancedMesh) return;
    o.geometry.computeBoundingBox(); matrix.multiplyMatrices(inverse, o.matrixWorld);
    bounds.union(o.geometry.boundingBox.clone().applyMatrix4(matrix));
  });
  return Math.max(0, bounds.max.y) * WORLD_SCALE;
}
const textileCache = new WeakMap();
function residentTextiles(shared) {
  if (textileCache.has(shared)) return textileCache.get(shared);
  const kit = createAvatarTextiles({ anisotropy: 4 });
  const sets = {
    wool: kit.fabric('wool', [2.3, 1.8]),
    skin: kit.fabric('cotton', [2.4, 1.6]),
    cotton: kit.fabric('cotton', [1.4, 1.4]),
    knit: kit.fabric('knit', [2.2, 1.45]),
  };
  // Only the cloned, material-bound maps outlive construction. In particular,
  // the kit's nine source maps must not become orphan GPU resources. Maps are
  // shared within one scene and the scene's material traversal owns disposal.
  const used = new Set(Object.values(sets).flatMap(set => Object.values(set)));
  for (const texture of kit.textures) if (!used.has(texture)) texture.dispose();
  textileCache.set(shared, sets); return sets;
}
function materialsFor(shared, c) {
  const textiles = residentTextiles(shared);
  const cloth = (color, kind = 'cotton') => new THREE.MeshPhysicalMaterial({
    color, ...textiles[kind], normalScale: new THREE.Vector2(kind === 'knit' ? .55 : .40, kind === 'knit' ? .55 : .40),
    roughness: .97, aoMapIntensity: .35, sheen: kind === 'wool' ? .72 : .52, sheenRoughness: .94,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff2df'), .35),
  });
  const plain = (color, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness });
  const knitted = ['knit', 'cardigan'].includes(c.costume);
  const coat = cloth(c.coat || '#b7b3d5', knitted ? 'knit' : 'cotton');
  if (c.kind === 'human') { coat.normalScale.setScalar(knitted ? .48 : .32); coat.sheen = knitted ? .62 : .40; coat.roughness = .94; }
  return {
    skin: new THREE.MeshPhysicalMaterial({ color: c.skin || '#b8b2df', ...textiles.skin, normalScale: new THREE.Vector2(.19,.19), roughness: .94, sheen: .33, sheenRoughness: .92, sheenColor: '#ffe6d0' }),
    hair: cloth(c.hair || '#bbb6dd', 'wool'), hairLight: cloth(new THREE.Color(c.hair || '#bbb6dd').lerp(new THREE.Color('#eee1c9'), .09), 'wool'),
    coat, shirt: cloth(c.shirt || '#f3e5cf'), trousers: cloth(c.trousers || '#716283'),
    rib: cloth(c.coat || '#b7b3d5', 'knit'), wool: cloth('#b8b5da', 'wool'), moustache: cloth('#eddfc9', 'wool'),
    shoe: plain(c.shoes || '#6c4d3e', .72), sole: plain('#352e2b'), thread: cloth('#d6c2a4'),
    eye: new THREE.MeshPhysicalMaterial({color:'#171516', roughness:.12, clearcoat:1, clearcoatRoughness:.08}), glint: shared.glint || plain('#fff9e8', .3),
    socket: cloth(new THREE.Color(c.skin || '#b8b5da').multiplyScalar(.86)),
    lip: plain('#956354'), blush: cloth('#c99282'), metal: new THREE.MeshStandardMaterial({ color: '#a78b51', roughness: .35, metalness: .7 }),
    glassFrame: new THREE.MeshPhysicalMaterial({ color: '#292728', roughness: .26, metalness: .35, clearcoat: .5 }), paper: shared.paper || plain('#f3e4c9'), book: cloth(c.book || '#46625d'), leather: plain(c.bag || '#996f4d', .69),
    trim: cloth(c.trim || TOWN_BRAND.butter), patch: cloth(TOWN_BRAND.lapis),
  };
}

function paddedShell(profile, depth = 1, folds = 0, phase = 0, segments = 32) {
  const curve = new THREE.CatmullRomCurve3(profile.map(([r,y]) => new THREE.Vector3(r,y,0)), false, 'centripetal');
  profile = curve.getPoints(44).map(p => [Math.max(0,p.x),p.y]);
  const geometry = shell(profile, depth, segments), position = geometry.attributes.position;
  // Broad, restrained sewn folds change the silhouette. Fine fibres remain in
  // the independent normal map, never a coarse displacement of the whole limb.
  const low = Math.min(...profile.map(p => p[1])), high = Math.max(...profile.map(p => p[1]));
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i), a = Math.atan2(x, z / depth);
    const t = (y - low) / Math.max(.001, high - low), envelope = Math.sin(Math.PI * t);
    const f = 1 + folds * envelope * (Math.sin(a * 5 + phase + t * 1.4) + .32 * Math.sin(a * 9 - t * 3));
    position.setXYZ(i, x * f, y, z * f);
  }
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  for (let row = 0; row < profile.length; row++) {
    const first = row, last = segments * profile.length + row;
    const n = new THREE.Vector3().fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first,n.x,n.y,n.z); normals.setXYZ(last,n.x,n.y,n.z);
  }
  return geometry;
}

// Each hairstyle has a continuous cap, not a pile of intersecting hair balls.
function hairCap(parent, c, material) {
  const [rx, ry, rz] = c.face, rows = 15, cols = 40, p = [], uv = [], index = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const a = i / cols * TAU, back = (1 - Math.cos(a)) / 2;
    const bob = c.hairStyle.includes('bob'), edge = 1.19 + back * (bob ? 1.32 : .88) + Math.sin(a) * .07;
    const theta = j / rows * edge, asymmetry = 1 + .015 * Math.sin(a * 3 + theta);
    p.push(Math.sin(theta) * Math.sin(a) * (rx + .027) * asymmetry, Math.cos(theta) * (ry + .027), Math.sin(theta) * Math.cos(a) * (rz + .027)); uv.push(i / cols, j / rows);
    const n = j * (cols + 1) + i; if (j < rows && i < cols) index.push(n, n + cols + 1, n + 1, n + 1, n + cols + 1, n + cols + 2);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index); geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  for (let row = 0; row <= rows; row++) {
    const first = row * (cols + 1), last = first + cols;
    const averaged = new THREE.Vector3().fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, averaged.x, averaged.y, averaged.z); normals.setXYZ(last, averaged.x, averaged.y, averaged.z);
  }
  return put(parent, geometry, material);
}
function glasses(parent, eyeX, eyeY, z, radius, material, thickness = .014) {
  const ring = new THREE.TorusGeometry(radius, thickness, 10, 40);
  for (const side of [-1, 1]) put(parent, ring, material, [side * eyeX, eyeY, z]);
  tube(parent, [[-eyeX + radius, eyeY + .012, z], [0, eyeY + .028, z + .006], [eyeX - radius, eyeY + .012, z]], .012, material, 10);
  for (const side of [-1, 1]) tube(parent, [[side * (eyeX + radius), eyeY + .006, z], [side * (eyeX + radius + .07), eyeY + .025, z - .075], [side * (eyeX + radius + .08), eyeY - .005, z - .21]], .011, material, 12);
}
function makeFace(head, c, m, sphere) {
  const faceGeometry = sphere.clone(), vertices = faceGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
    const cheek=Math.exp(-Math.pow((y+.26)/.30,2))*Math.exp(-Math.pow((Math.abs(x)-.45)/.32,2))*Math.max(0,z);
    vertices.setXYZ(i,x*(1+.032*cheek),y,z+.025*cheek);
  }
  faceGeometry.computeVertexNormals();
  const faceNormals=faceGeometry.attributes.normal,columns=faceGeometry.parameters.widthSegments,rows=faceGeometry.parameters.heightSegments;
  for(let row=1;row<rows;row++){
    const first=row*(columns+1),last=first+columns,n=new THREE.Vector3().fromBufferAttribute(faceNormals,first).add(new THREE.Vector3().fromBufferAttribute(faceNormals,last)).normalize();
    faceNormals.setXYZ(first,n.x,n.y,n.z);faceNormals.setXYZ(last,n.x,n.y,n.z);
  }
  put(head, faceGeometry, m.skin, [0, 0, 0], c.face).name = 'human-face';
  for (const s of [-1, 1]) {
    put(head, sphere, m.skin, [s * c.face[0] * .98, -.025, -.018], [.077, .104, .058]);
    const inner=put(head,sphere,m.blush,[s*c.face[0]*1.045,-.023,.021],[.026,.049,.017]);inner.rotation.y=s*.35;
  }
  const eyes = [], eyeY = .02, eyeX = c.face[0] * .375;
  const eyeZ = c.face[2] * .935;
  for (const side of [-1, 1]) {
    const g = group(head, [side * eyeX, eyeY, eyeZ]);
    const socket=put(g,new THREE.TorusGeometry(.042,.0055,6,24),m.socket,[0,0,-.003]);socket.scale.y=1.15;
    put(g, sphere, m.eye, [0, 0, .002], [.042, .051, .029]); put(g, sphere, m.glint, [-.010, .017, .027], [.007, .009, .004]); eyes.push(g);
    const cheek = put(head, sphere, m.blush, [side * (eyeX + .095), -.095, c.face[2] * .847], [.055, .024, .008]); cheek.rotation.y = side * .2;
    tube(head, [[side * (eyeX - .035), .13, c.face[2] * .902], [side * eyeX, .143, c.face[2] * .917], [side * (eyeX + .032), .13, c.face[2] * .892]], .009, m.hair, 8);
  }
  put(head, sphere, m.skin, [0, -.077, c.face[2] * .972], [.049, .057, .057]);
  tube(head, [[-.052, -.162, c.face[2] * .94], [0, -.179, c.face[2] * .96], [.052, -.161, c.face[2] * .94]], .008, m.lip, 10);
  if (c.glasses) glasses(head, eyeX, eyeY + .011, eyeZ + .046, .105, m.glassFrame);
  return eyes;
}
function makeHair(head, c, m, sphere) {
  const rx = c.face[0], ry = c.face[1], rz = c.face[2]; hairCap(head, c, m.hair);
  let tail;
  if (c.hairStyle === 'bun') {
    put(head, sphere, m.hair, [.10, .26, -.32], [.24, .22, .19]);
    const ring = put(head, new THREE.TorusGeometry(.115, .027, 6, 22), m.coat, [.09, .265, -.432]); ring.rotation.x = .5;
    taperedTube(head, [[-.36, .23, .11], [-.29, .34, .25], [-.02, .32, .35], [.23, .14, .31]], [.02, .068, .045, .007], m.hair, 25);
    taperedTube(head, [[-.37, .14, .17], [-.385, -.03, .14], [-.34, -.16, .07]], [.03, .035, .005], m.hairLight, 14);
  } else if (c.hairStyle === 'short') {
    taperedTube(head, [[-.32, .28, .12], [-.18, .40, .26], [.11, .32, .34], [.31, .17, .26]], [.08, .12, .10, .015], m.hair, 22);
    for (const s of [-1, 1]) put(head, sphere, m.hair, [s * rx * .91, -.048, .009], [.058, .17, .089]);
  } else if (c.hairStyle === 'silver-bob') {
    for (const s of [-1, 1]) taperedTube(head, [[s * .28, .3, .1], [s * .40, .0, .08], [s * .345, -.33, -.01], [s * .265, -.35, .0]], [.068, .11, .115, .035], m.hair, 24);
    taperedTube(head, [[.23, .31, .1], [.10, .34, .27], [-.20, .20, .32], [-.33, -.015, .20]], [.05, .085, .058, .007], m.hairLight, 22);
  } else if (c.hairStyle === 'wave-bob') {
    for (const s of [-1, 1]) {
      taperedTube(head, [[s * .26, .29, .07], [s * .365, .06, .13], [s * .32, -.11, .17], [s * .385, -.29, .08], [s * .27, -.39, .04]], [.055, .105, .080, .12, .025], m.hair, 30);
      taperedTube(head, [[s * .25, .16, -.24], [s * .375, -.07, -.16], [s * .32, -.28, -.16]], [.09, .13, .07], m.hair, 18);
    }
    taperedTube(head, [[-.26, .3, .12], [-.09, .385, .24], [.17, .28, .33], [.30, .09, .27]], [.024, .084, .064, .012], m.hairLight, 24);
  } else {
    tail = group(head, [0, .20, -.30]);
    taperedTube(tail, [[0, 0, 0], [.06, -.19, -.10], [.08, -.50, -.05], [.17, -.80, .0]], [.15, .16, .115, .027], m.hair, 26);
    const tie = put(tail, new THREE.TorusGeometry(.122, .024, 6, 22), m.shirt, [0, -.03, -.018]); tie.rotation.x = Math.PI / 2;
    taperedTube(head, [[.22, .33, .10], [.0, .355, .29], [-.25, .20, .32], [-.34, -.10, .11]], [.04, .075, .041, .009], m.hair, 24);
  }
  // Subtle combed ridges remain attached to the cap at every viewing angle.
  for (const a of [-.70, .48]) {
    const points = Array.from({ length: 11 }, (_, i) => { const t = .20 + i / 10 * .88; return [Math.sin(t) * Math.sin(a) * (rx + .031), Math.cos(t) * (ry + .031), Math.sin(t) * Math.cos(a) * (rz + .031)]; });
    tube(head, points, .006, m.hairLight, 15);
  }
  // Fine wool ends soften the continuous hair silhouette. This is one batched
  // buffer, with no per-strand objects or opaque fuzz in front of the face.
  const random=rng(c.seed+600),fibres=[];
  for(let i=0;i<650;i++){
    const a=random()*TAU,back=(1-Math.cos(a))/2,bob=c.hairStyle.includes('bob');
    const edge=1.19+back*(bob?1.32:.88)+Math.sin(a)*.07,t=.08+random()*(edge-.19);
    const asymmetry=1+.015*Math.sin(a*3+t),p=new THREE.Vector3(Math.sin(t)*Math.sin(a)*(rx+.027)*asymmetry,Math.cos(t)*(ry+.027),Math.sin(t)*Math.cos(a)*(rz+.027));
    const n=new THREE.Vector3(p.x/(rx*rx),p.y/(ry*ry),p.z/(rz*rz)).normalize(),end=p.clone().addScaledVector(n,.007+random()*.009);
    fibres.push(...p.toArray(),...end.toArray());
  }
  const fibreGeometry=new THREE.BufferGeometry();fibreGeometry.setAttribute('position',new THREE.Float32BufferAttribute(fibres,3));
  const fibreMaterial=new THREE.LineBasicMaterial({color:new THREE.Color(c.hair).lerp(new THREE.Color('#e6d5bf'),.13),transparent:true,opacity:.32,depthWrite:false});
  const fibreMesh=new THREE.LineSegments(fibreGeometry,fibreMaterial);fibreMesh.name='resident-hair-wool-ends';head.add(fibreMesh);
  return tail;
}
function book(parent, m, position, scale = 1) {
  const g = group(parent, position); g.scale.setScalar(scale);
  put(g, roundBox(.32, .40, .062, .018), m.book);
  put(g, roundBox(.275, .347, .049, .010), m.paper, [.009, 0, .015]);
  put(g, roundBox(.32, .40, .018, .008), m.book, [0, 0, .048]);
  tube(g, [[-.097, .13, .059], [.094, .13, .059]], .004, m.thread, 4);
  put(g, roundBox(.04, .12, .008, .003), m.coat, [.07, -.195, .025]); return g;
}
function makeHuman(parent, shared, c, mobile) {
  const body = group(parent); body.scale.setScalar(WORLD_SCALE); body.name = `resident-${c.id}-human`;
  const rig = group(body); rig.scale.setScalar(c.stature); const m = materialsFor(shared, c);
  const sphere = new THREE.SphereGeometry(1, mobile ? 20 : 28, mobile ? 14 : 20);
  const pelvisY = .72, torso = group(rig, [0, .75, 0]);
  const torsoProfile = [[0, -.025], [.27, -.022], [.32, .01], [.335, .13], [.32, .35], [.375, .48], [.30, .57], [.215, .615], [0, .615]];
  const coat = put(torso, paddedShell(torsoProfile, .72, .027, c.seed, mobile?28:36), m.coat); coat.scale.x = c.shoulders; coat.name = `${c.costume}-body`;
  put(rig, sphere, m.skin, [0, 1.415, 0], [.125, .145, .11]);
  const head = group(rig, [0, 1.80, 0]); const eyes = makeFace(head, c, m, sphere); const tail = makeHair(head, c, m, sphere);
  const legs = [], arms = [];
  const thighGeometry=paddedShell([[0,-.365],[.099,-.35],[.115,-.29],[.123,-.15],[.131,-.015],[.102,.06],[0,.08]],.94,.027,c.seed,24);
  const calfGeometry=paddedShell([[0,-.321],[.086,-.31],[.105,-.27],[.111,-.16],[.109,-.025],[.110,.050],[0,.068]],.96,.030,c.seed+1,24);
  const upperSleeve=paddedShell([[0,-.349],[.089,-.338],[.105,-.286],[.125,-.14],[.137,-.035],[.103,.066],[0,.105]],1.04,.023,c.seed,24);
  const lowerSleeve=paddedShell([[0,-.218],[.087,-.210],[.098,-.17],[.100,-.050],[.098,.015],[.071,.055],[0,.074]],1.02,.025,c.seed+2,24);
  for (const s of [-1, 1]) {
    const hip = group(rig, [s * .16, pelvisY, 0]);
    put(hip, thighGeometry, m.trousers);
    const knee = group(hip, [0, -.31, 0]);
    put(knee, calfGeometry, m.trousers);
    const trouserHem=put(knee,new THREE.TorusGeometry(.098,.008,6,20),m.trousers,[0,-.278,0]);trouserHem.rotation.x=Math.PI/2;
    const foot = group(knee, [0, -.393, .059]);
    put(foot, roundBox(.225, .16, .345, .065), m.shoe, [0, .07, .025]);
    put(foot, roundBox(.23, .04, .35, .017), m.sole, [0, .003, .023]);
    tube(foot, [[-.064, .15, .06], [0, .153, .08], [.064, .15, .06]], .009, m.thread, 10);
    legs.push({ hip, knee, foot, side: s });
    const shoulder = group(torso, [s * (.36 * c.shoulders), .49, 0]);
    put(shoulder, upperSleeve, m.coat, [s*.017,0,0]);
    const elbow = group(shoulder, [s * .04, -.30, 0]);
    put(elbow, lowerSleeve, m.coat, [0,0,.01]);
    const hand = put(elbow, sphere, m.skin, [0, -.248, .025], [.077, .098, .077]);
    const cuff = put(elbow, shell([[0,-.024],[.089,-.024],[.094,-.013],[.094,.018],[.088,.025],[0,.025]],1,24), m.shirt, [0, -.191, .016]);
    arms.push({ shoulder, elbow, hand, side: s });
  }
  let heldBook;
  const buttonGeo = new THREE.SphereGeometry(.018, 10, 8);
  if (c.costume === 'apron') {
    const apronProfile = [[.04, -.055], [.32, -.05], [.345, .08], [.305, .26], [.22, .30], [.205, .52], [0, .52]];
    const apron = put(torso, paddedShell(apronProfile, .76,.035,c.seed), m.coat, [0, -.03, .027]); apron.name = 'wrap-apron';
    // Ivory blouse sleeves and a distinct hanging apron skirt separate the silhouette.
    coat.material = m.shirt; for (const a of arms) { a.shoulder.children[0].material = m.shirt; a.elbow.children[0].material=m.shirt; }
    put(torso, roundBox(.37, .395, .044, .019), m.coat, [0, .365, .265]).name = 'apron-front-bib';
    for (const s of [-1, 1]) tube(torso, [[s * .17, .54, .259], [s * .20, .59, .12], [s * .19, .60, -.07], [s * .21, .41, -.20]], .030, m.coat, 20);
    put(torso, roundBox(.24, .18, .045, .017), m.coat, [0, .14, .285]).name = 'apron-padded-pocket';
    sewnPaths(torso, [
      [[-.105, .214, .313], [0, .208, .317], [.105, .214, .313]],
      [[-.085, .358, .294], [-.048, .398, .294], [.004, .432, .294]],
      [[-.049, .397, .294], [-.080, .425, .294], [-.075, .443, .294]],
      [[-.033, .410, .294], [-.006, .391, .294], [.013, .397, .294]],
    ], m.trim, 'cafe-butter-sprig-and-pocket-stitches');
    put(torso, buttonGeo, m.metal, [-.151, .51, .292]); put(torso, buttonGeo, m.metal, [.151, .51, .292]);
  } else if (c.costume === 'knit') {
    const collar = put(torso, new THREE.TorusGeometry(.154, .041, 10, 32), m.rib, [0, .605, 0]); collar.rotation.x = Math.PI / 2;
    const hem = put(torso, shell([[.29,.008],[.318,.016],[.327,.03],[.329,.079],[.312,.092]],.72,36), m.rib); hem.scale.x=c.shoulders;
    sewnPaths(torso, [[[.13, .047, .226], [.19, .050, .205], [.24, .055, .170]]], m.trim, 'reader-lapis-hem-signature', .004, .021);
    heldBook = book(rig, m, [.27, 1.07, .30], .9); heldBook.rotation.set(-.10, -.12, -.10);
  } else {
    const front = put(torso, roundBox(.18, .50, .035, .014), m.shirt, [0, .31, .229]); front.rotation.x = -.045;
    for (const s of [-1, 1]) {
      const lapel = put(torso, roundBox(.105, .265, .038, .013), c.costume==='cardigan'?m.rib:m.coat, [s * .122, .435, .249]); lapel.rotation.z = s * -.21;
      if (c.costume !== 'cardigan') { put(torso, roundBox(.145, .105, .024, .009), m.coat, [s * .205, .30, .225]); put(torso, buttonGeo, m.metal, [s * .205, .322, .244]); }
    }
    for (const y of [.39, .23, .07]) put(torso, buttonGeo, c.costume === 'cardigan' ? m.thread : m.metal, [.035, y, .256]);
    if (c.costume === 'cardigan') {
      for (const s of [-1, 1]) put(torso, roundBox(.15, .135, .032, .012), m.coat, [s * .21, .12, .216]);
      sewnPaths(torso, [[[-.265, .174, .240], [-.21, .171, .244], [-.155, .174, .240]]], m.trim, 'visitor-berry-pocket-stitches', .004, .022);
    }
    if (c.costume === 'travel-jacket') {
      const bag = group(rig, [-.39, .77, .07]); bag.rotation.z = -.10;
      put(bag, roundBox(.27, .34, .17, .045), m.leather);
      put(bag, roundBox(.28, .14, .03, .013), m.leather, [0, .10, .093]);
      put(bag, roundBox(.043, .058, .019, .008), m.metal, [0, .065, .117]);
      put(bag, roundBox(.033, .073, .014, .007), m.trim, [.105, .022, .109]).name = 'companion-butter-woven-tab';
      sewnPaths(bag, [[[-.105, .151, .115], [0, .159, .117], [.105, .151, .115]]], m.trim, 'companion-satchel-seam', .0035, .022);
      tube(rig, [[-.40, .89, .11], [-.16, 1.10, .245], [.24, 1.39, .13], [.27, 1.33, -.16], [-.26, .83, -.17]], .026, m.leather, 28);
    }
    if (c.costume === 'work-jacket') {
      const pencil = put(torso, new THREE.CylinderGeometry(.014, .014, .125, 8), m.thread, [-.213, .375, .239]); pencil.rotation.z = -.07;
      sewnPaths(torso, [[[-.264, .268, .244], [-.264, .297, .247], [-.226, .302, .247]]], m.trim, 'workshop-coral-pocket-corner', .005, .021);
    }
  }
  body.userData.residentIdentity = { id: c.id, kind: c.kind, description: c.description, silhouette: `${c.hairStyle}/${c.costume}/${c.stature}/${c.shoulders}` };
  let seatedBlend = 0;
  function update({ now = 0, deltaSeconds = 1 / 60, walkPhase, gaitBlend, motion = true, walking = false, working = false, showing = false, holding = false, talking = false, seated = false } = {}) {
    const time = motion ? now * .001 : 0;
    const gait = motion ? (Number.isFinite(gaitBlend) ? gaitBlend : walking ? 1 : 0) : 0;
    const phase = gait > 0 && Number.isFinite(walkPhase) ? walkPhase + c.seed : time * (walking ? 8 : 1.7) + c.seed;
    if (motion) seatedBlend += ((seated ? 1 : 0) - seatedBlend) * (1 - Math.exp(-Math.min(.08, deltaSeconds) * 12)); else seatedBlend = seated ? 1 : 0;
    // The shared café chair seat is at world y .60. This is a small doll with
    // dangling lower legs: position its pelvis on the seat, not below it.
    rig.position.y = seatedBlend * (.60 / (c.stature * WORLD_SCALE) - pelvisY) + Math.abs(Math.sin(phase)) * .024 * gait;
    torso.rotation.z = Math.sin(phase) * .028 * gait;
    head.rotation.set((talking ? Math.sin(time * 3.5 + c.seed) * .035 : Math.sin(time * 1.2 + c.seed) * .012) + seatedBlend * .03, Math.sin(time * .63 + c.seed) * (talking ? .08 : .03), Math.sin(time * .9 + c.seed) * .014);
    const blink = ((time + c.seed * .07) % 4.7); const openness = blink > 4.53 ? Math.max(.10, Math.abs((blink - 4.615) / .085)) : 1;
    for (const eye of eyes) eye.scale.y = openness;
    for (const leg of legs) {
      const stride = Math.sin(phase + (leg.side < 0 ? Math.PI : 0));
      leg.hip.rotation.x = stride * .43 * gait * (1 - seatedBlend) - seatedBlend * 1.36;
      leg.knee.rotation.x = Math.max(0, -stride) * .43 * gait * (1 - seatedBlend) + seatedBlend * 1.38;
      leg.foot.rotation.x = -.08 * gait * stride;
    }
    for (const arm of arms) {
      const stride = Math.sin(phase + (arm.side < 0 ? 0 : Math.PI));
      arm.shoulder.rotation.set(stride * .32 * gait, 0, -arm.side * .075);
      arm.elbow.rotation.x = -.055 - gait * .08;
      if (heldBook && arm.side > 0) { arm.shoulder.rotation.x = -.50; arm.shoulder.rotation.z = .09; arm.elbow.rotation.x = -.45; }
      else if (showing && arm.side < 0) { arm.shoulder.rotation.x = -.63; arm.shoulder.rotation.z = -.24; arm.elbow.rotation.x = -.42; }
      else if (holding || (working && arm.side > 0)) { arm.shoulder.rotation.x = -.47; arm.elbow.rotation.x = -.36 + Math.sin(time * 4) * (working ? .10 : .025); }
      else if (talking && arm.side < 0) { arm.shoulder.rotation.x = -.18 - Math.sin(time * 2.7) * .08; arm.elbow.rotation.x = -.19; }
      if (seatedBlend > .01) { arm.shoulder.rotation.x -= seatedBlend * .30; arm.elbow.rotation.x -= seatedBlend * .40; }
    }
    if (tail) tail.rotation.z = Math.sin(time * 1.7 + c.seed + .6) * .035 * (1 - gait) + Math.sin(phase + .6) * .165 * gait;
    if (heldBook) {
      // Follow the palm after the arm pose is applied. A static chest prop left
      // the reader's hand visibly separated from their book during walking.
      rig.updateWorldMatrix(true, true);
      const handPoint = rig.worldToLocal(arms.find(a => a.side > 0).hand.getWorldPosition(new THREE.Vector3()));
      heldBook.position.copy(handPoint).add(new THREE.Vector3(-.078, .165, .020));
      heldBook.rotation.x = -.10 - seatedBlend * .15;
    }
  }
  update();
  return { body, update, head, headHeight: 1.80 * c.stature * WORLD_SCALE, height: standingHeight(body), identity: body.userData.residentIdentity };
}

function makeProfessor(parent, shared, c, mobile) {
  const body = group(parent); body.scale.setScalar(WORLD_SCALE); body.name = 'resident-researcher-professor';
  const rig = group(body), m = materialsFor(shared, c), sphere = new THREE.SphereGeometry(1, mobile ? 22 : 32, mobile ? 16 : 24);
  const controls = [[0, .025], [.49, .026], [.61, .105], [.67, .35], [.685, .69], [.655, 1.08], [.58, 1.50], [.43, 1.83], [.22, 2.025], [0, 2.10]];
  const profileCurve = new THREE.CatmullRomCurve3(controls.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
  const profile = profileCurve.getPoints(mobile ? 64 : 104).map(p => [Math.max(0, p.x), Math.max(.025, p.y)]);
  const material = m.wool; material.normalScale.set(.74,.74); material.sheen=.84; material.sheenColor.set('#efdded');
  put(rig, shell(profile, .79, mobile ? 36 : 56), material).name = 'professor-oval-felt-body';
  const face = group(rig, [0, 0, .085]), head = group(rig, [0, 1.37, .510]); const eyes = [];
  for (const side of [-1, 1]) {
    const eye = group(face, [side * .245, 1.37, .425]);
    const socket=put(eye,new THREE.TorusGeometry(.092,.0055,8,32),m.socket,[0,0,.006]);socket.scale.y=1.06;
    put(eye, sphere, m.eye, [0, 0, .007], [.088, .096, .079]); put(eye, sphere, m.glint, [-.022, .033, .076], [.016, .020, .007]); eyes.push(eye);
  }
  glasses(face, .245, 1.38, .479, .207, m.glassFrame,.019);
  // Two cream moustache lobes. Deliberately no nose, mouth or eyebrows.
  const moustacheMaterial = m.moustache;moustacheMaterial.normalScale.set(.63,.63);
  for (const side of [-1, 1]) {
    taperedTube(face, [[side * .024, 1.10, .458], [side * .17, 1.00, .496], [side * .32, 1.03, .441], [side * .43, 1.13, .383]], [.035, .105, .065, .002], moustacheMaterial, 28, 12);
  }
  // A single batched mesh contains the visible cream stitching around the edge.
  const radiusAt = y => {
    const i = profile.findIndex(p => p[1] >= y);
    if (i <= 0) return profile[0][0];
    const before = profile[i - 1], after = profile[i];
    return THREE.MathUtils.lerp(before[0], after[0], (y - before[1]) / Math.max(.0001, after[1] - before[1]));
  };
  const seamPoint = a => {
    const x = Math.sin(a) * .572, y = 1.08 + Math.cos(a) * .86, r = radiusAt(y);
    return new THREE.Vector3(x, y, Math.sqrt(Math.max(.001, r * r - x * x)) * .79 + .024);
  };
  const stitchPoints = [];
  for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; stitchPoints.push(seamPoint(a), seamPoint(a + .053)); }
  const stitchGeometry = new THREE.CylinderGeometry(.010, .010, 1, 5), stitches = new THREE.InstancedMesh(stitchGeometry, m.thread, stitchPoints.length / 2);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < stitchPoints.length; i += 2) { const a = stitchPoints[i], b = stitchPoints[i + 1], d = b.clone().sub(a); rotation.setFromUnitVectors(yAxis, d.clone().normalize()); matrix.compose(a.clone().add(b).multiplyScalar(.5), rotation, new THREE.Vector3(1, d.length(), 1)); stitches.setMatrixAt(i / 2, matrix); }
  stitches.castShadow = true; rig.add(stitches);
  // Fine fibers follow the oval, batched as one line mesh instead of thousands of objects.
  const random = rng(103), vertices = [], count = mobile ? 750 : 1650;
  for (let i = 0; i < count; i++) {
    const t = .1 + random() * .87, p = profileCurve.getPoint(t), a = random() * TAU;
    const x = Math.sin(a) * p.x, y = p.y, z = Math.cos(a) * p.x * .79;
    if (z > .28 && y > .91 && y < 1.65 && Math.abs(x) < .50) continue;
    const n = new THREE.Vector3(Math.sin(a), (y - 1) * .5, Math.cos(a)).normalize(), l = .003 + random() * .006;
    const start=new THREE.Vector3(x,y,z),tangent=new THREE.Vector3(Math.cos(a),.3,-Math.sin(a)).normalize(),curl=(random()-.5)*.006;
    const mid=start.clone().addScaledVector(n,l*.7).addScaledVector(tangent,curl*.4);
    const end=start.clone().addScaledVector(n,l).addScaledVector(tangent,curl);
    vertices.push(...start.toArray(),...mid.toArray(),...mid.toArray(),...end.toArray());
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  // These unlit line ends must stay close to the shaded body's value: bright
  // multi-pixel curls looked like white confetti under the actual town light.
  // Surface wool detail comes from the lit normal map, not from these ends.
  const fibers = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#a69dbd', transparent: true, opacity: .14, depthWrite: false })); fibers.name = 'resident-felt-fibers'; rig.add(fibers);
  // A small fabric field-note badge belongs to the costume. The professor's
  // approved lilac body, cream moustache, glasses and front seam remain intact.
  const badge = group(rig, [-.37, .66, .466]); badge.rotation.y = -.38;
  put(badge, roundBox(.155, .125, .022, .022), m.patch).name = 'professor-lapis-field-note-badge';
  sewnPaths(badge, [[[-.038, -.028, .017], [0, .006, .017], [.038, .030, .017]], [[0, .006, .017], [-.023, .028, .017], [-.025, .040, .017]]], m.trim, 'professor-butter-badge-embroidery', .0038, .019);
  body.userData.residentIdentity = { id: c.id, kind: c.kind, description: c.description, silhouette: 'oval/glasses/two-lobe-moustache' };
  function update({ now = 0, walkPhase, gaitBlend, walking = false, motion = true, talking = false, working = false, seated = false } = {}) {
    const t = motion ? now * .001 : 0, speed = motion ? (Number.isFinite(gaitBlend) ? gaitBlend : walking ? 1 : 0) : 0;
    const phase = Number.isFinite(walkPhase) ? walkPhase : t * 6.5;
    rig.position.y = Math.abs(Math.sin(phase)) * .030 * speed - (seated ? .05 : 0);
    rig.rotation.z = Math.sin(phase) * speed * .030 + Math.sin(t * 1.3) * (1 - speed) * .010;
    rig.rotation.x = (working ? .045 : 0) + (talking ? Math.sin(t * 3.2) * .018 : 0);
    const blink = (t + 1.7) % 5.2, openness = blink > 5.04 ? Math.max(.12, Math.abs((blink - 5.12) / .08)) : 1;
    for (const eye of eyes) eye.scale.y = openness;
  }
  return { body, update, head, headHeight: 1.37 * WORLD_SCALE, height: standingHeight(body), identity: body.userData.residentIdentity };
}

export function makeTownResident(parent, materials, { id, mobile = false } = {}) {
  const source = CAST[id];
  if (!source) throw new Error(`Unknown town resident: ${String(id)}`);
  const c = { ...source, id };
  return c.kind === 'professor' ? makeProfessor(parent, materials, c, mobile) : makeHuman(parent, materials, c, mobile);
}

export const TOWN_RESIDENT_CAST = Object.freeze(Object.fromEntries(Object.entries(CAST).map(([id, c]) => [id, Object.freeze({ id, kind: c.kind, description: c.description })])));
