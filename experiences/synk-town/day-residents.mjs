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
// Diorama felt is opt-in. A photographed needle-felt set shows a resident at
// roughly 150-200 px, where the fitting-room micro-weave vanishes and the cloth
// reads as vinyl: this mode swaps the weave for coarser matted wool, deepens the
// nap, felts the hard trims, thickens the running stitch and adds a short fibre halo. Without
// it every material, mesh and draw call stays exactly as before.
const DIORAMA = Object.freeze({ nap: 2.4, napMax: 1.5, stitch: 1.8, thread: .0105, groundShade: .34, fibres: 7000, phoneFibres: 3600, minFibres: 12 });
// Doll proportions for the diorama humans (rig units; the professor is already a felt doll).
const DOLL = Object.freeze({ legLength: .76, legGirth: 1.42, hipSpread: 1.06, armLength: .84, armGirth: 1.16, body: [1.1, 1.08], shoulderSpread: .95, shoulderY: .46, mitten: [.1, .106, .095],
  torso: [[0, -.025], [.29, -.022], [.335, .02], [.352, .15], [.348, .32], [.33, .45], [.282, .55], [.2, .6], [0, .615]], armOut: .17, elbowRest: -.22 });
const napFor = (c, value) => c.felt === 'diorama' ? Math.min(DIORAMA.napMax, value * DIORAMA.nap) : value;
const textileCache = new WeakMap(), dioramaTextileCache = new WeakMap();
function residentTextiles(shared, diorama = false) {
  const cache = diorama ? dioramaTextileCache : textileCache;
  if (cache.has(shared)) return cache.get(shared);
  const kit = createAvatarTextiles({ anisotropy: 4 });
  // Needle felt has no weave: in the diorama the woven cotton becomes the same
  // matted wool at a coarser scale, and only knitwear stays knitted.
  const sets = diorama ? {
    wool: kit.fabric('wool', [1.15, .9]),
    skin: kit.fabric('wool', [1.5, 1.1]),
    cotton: kit.fabric('wool', [.8, .8]),
    knit: kit.fabric('knit', [1.1, .72]),
  } : {
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
  cache.set(shared, sets); return sets;
}
function materialsFor(shared, c) {
  const diorama = c.felt === 'diorama', textiles = residentTextiles(shared, diorama);
  const nap = value => napFor(c, value);
  const cloth = (color, kind = 'cotton') => new THREE.MeshPhysicalMaterial({
    color, ...textiles[kind], normalScale: new THREE.Vector2(nap(kind === 'knit' ? .55 : .40), nap(kind === 'knit' ? .55 : .40)),
    roughness: .97, aoMapIntensity: diorama ? .6 : .35, sheen: diorama ? (kind === 'wool' ? .92 : .82) : kind === 'wool' ? .72 : .52, sheenRoughness: diorama ? .7 : .94,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff2df'), .35),
  });
  const hard = (color, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness });
  // A felted doll's shoes, lips, soles and bag are wool too; only the bead
  // eyes, their glint, glasses and metal keep a hard surface.
  const plain = diorama ? color => cloth(color, 'wool') : hard;
  const knitted = ['knit', 'cardigan'].includes(c.costume);
  const coat = cloth(c.coat || '#b7b3d5', knitted ? 'knit' : 'cotton');
  if (c.kind === 'human') { coat.normalScale.setScalar(nap(knitted ? .48 : .32)); coat.sheen = diorama ? .82 : knitted ? .62 : .40; coat.roughness = .94; }
  const m = {
    skin: new THREE.MeshPhysicalMaterial({ color: c.skin || '#b8b2df', ...textiles.skin, normalScale: new THREE.Vector2(diorama ? .5 : .19, diorama ? .5 : .19), roughness: .94, sheen: diorama ? .6 : .33, sheenRoughness: diorama ? .8 : .92, sheenColor: '#ffe6d0' }),
    hair: cloth(c.hair || '#bbb6dd', 'wool'), hairLight: cloth(new THREE.Color(c.hair || '#bbb6dd').lerp(new THREE.Color('#eee1c9'), .09), 'wool'),
    coat, shirt: cloth(c.shirt || '#f3e5cf'), trousers: cloth(c.trousers || '#716283'),
    rib: cloth(c.coat || '#b7b3d5', 'knit'), wool: cloth('#b8b5da', 'wool'), moustache: cloth('#eddfc9', 'wool'),
    shoe: plain(c.shoes || '#6c4d3e', .72), sole: plain('#352e2b'), thread: cloth('#d6c2a4'),
    eye: new THREE.MeshPhysicalMaterial({color:'#171516', roughness:.12, clearcoat:1, clearcoatRoughness:.08}), glint: shared.glint || hard('#fff9e8', .3),
    socket: cloth(new THREE.Color(c.skin || '#b8b5da').multiplyScalar(.86)),
    lip: plain('#956354'), blush: cloth('#c99282'), metal: new THREE.MeshStandardMaterial({ color: '#a78b51', roughness: .35, metalness: .7 }),
    glassFrame: new THREE.MeshPhysicalMaterial({ color: '#292728', roughness: .26, metalness: .35, clearcoat: .5 }), paper: shared.paper || hard('#f3e4c9'), book: cloth(c.book || '#46625d'), leather: plain(c.bag || '#996f4d', .69),
    trim: cloth(c.trim || TOWN_BRAND.butter), patch: cloth(TOWN_BRAND.lapis),
  };
  if (diorama) {
    // Halo density per material: hair and the professor's wool fuzz most, a
    // felted face only lightly, and thread and the small facial felt not at all.
    for (const key of ['hair', 'hairLight', 'wool', 'moustache']) m[key].userData.feltHalo = 1.25;
    m.skin.userData.feltHalo = .25;
    for (const key of ['thread', 'socket', 'blush', 'lip', 'trim']) m[key].userData.feltHalo = 0;
  }
  return m;
}

function paddedShell(profile, depth = 1, folds = 0, phase = 0, segments = 32, bend = null) {
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
    position.setXYZ(i, x * f, y, z * f + (bend ? bend(y) : 0));
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
  // A diorama resident is a needle-felt doll, not a mannequin: shorter, thicker
  // legs, a rounder body, short thick arms with mitten hands and round felt feet
  // without a hard sole. Without the option every factor is 1 and nothing moves.
  const doll = c.felt === 'diorama', legLength = doll ? DOLL.legLength : 1, legGirth = doll ? DOLL.legGirth : 1;
  const armLength = doll ? DOLL.armLength : 1, armGirth = doll ? DOLL.armGirth : 1, [bodyX, bodyZ] = doll ? DOLL.body : [1, 1];
  const shaped = (profile, girth, length) => profile.map(([r, y]) => [r * girth, y * length]);
  const pelvisY = .72 * legLength, lower = .72 - pelvisY, torso = group(rig, [0, .75 - lower, 0]);
  if (doll) torso.scale.set(bodyX, 1, bodyZ);
  // The doll body is one soft bean with sloped shoulders, not a jacket with a shoulder ledge.
  const jacket = [[0, -.025], [.27, -.022], [.32, .01], [.335, .13], [.32, .35], [.375, .48], [.30, .57], [.215, .615], [0, .615]];
  const torsoProfile = doll ? DOLL.torso : jacket;
  // Costume details are placed for the jacket body; on the doll's bean they move
  // with its surface so a lapel or pocket never floats off or sinks in.
  const radiusAt = (profile, y) => { for (let i = 1; i < profile.length; i++) if (profile[i][1] >= y) { const [r0, y0] = profile[i - 1], [r1, y1] = profile[i]; return r0 + (r1 - r0) * (y - y0) / Math.max(1e-6, y1 - y0); } return profile.at(-1)[0]; };
  const widthAt = doll ? y => { const k = Math.min(.57, Math.max(.02, y)); return radiusAt(torsoProfile, k) / radiusAt(jacket, k); } : () => 1;
  // A flat patch moves as one: its stitches and buttons take the patch's anchor height.
  const onBody = doll ? ([x, y, z], anchor = y) => { const k = widthAt(anchor); return [x * k, y, z * k]; } : point => point;
  const onPaths = (paths, anchors) => paths.map((points, i) => points.map(point => onBody(point, Array.isArray(anchors) ? anchors[i] : anchors)));
  const coat = put(torso, paddedShell(torsoProfile, .72, .027, c.seed, mobile?28:36), m.coat); coat.scale.x = c.shoulders; coat.name = `${c.costume}-body`;
  put(rig, sphere, m.skin, [0, 1.415 - lower, 0], [.125, .145, .11]);
  const head = group(rig, [0, 1.80 - lower, 0]); const eyes = makeFace(head, c, m, sphere); const tail = makeHair(head, c, m, sphere);
  const legs = [], arms = [];
  const thighGeometry=paddedShell(shaped([[0,-.365],[.099,-.35],[.115,-.29],[.123,-.15],[.131,-.015],[.102,.06],[0,.08]],legGirth,legLength),.94,.027,c.seed,24);
  const calfGeometry=paddedShell(shaped([[0,-.321],[.086,-.31],[.105,-.27],[.111,-.16],[.109,-.025],[.110,.050],[0,.068]],legGirth,legLength),.96,.030,c.seed+1,24);
  const upperSleeve=paddedShell(shaped([[0,-.349],[.089,-.338],[.105,-.286],[.125,-.14],[.137,-.035],[.103,.066],[0,.105]],armGirth,armLength),1.04,.023,c.seed,24);
  const lowerSleeve=paddedShell(shaped([[0,-.218],[.087,-.210],[.098,-.17],[.100,-.050],[.098,.015],[.071,.055],[0,.074]],armGirth,armLength),1.02,.025,c.seed+2,24);
  for (const s of [-1, 1]) {
    const hip = group(rig, [s * .16 * (doll ? DOLL.hipSpread : 1), pelvisY, 0]);
    put(hip, thighGeometry, m.trousers);
    const knee = group(hip, [0, -.31 * legLength, 0]);
    put(knee, calfGeometry, m.trousers);
    const trouserHem=put(knee,new THREE.TorusGeometry(.098 * legGirth,.008,6,20),m.trousers,[0,-.278 * legLength,0]);trouserHem.rotation.x=Math.PI/2;
    const foot = group(knee, [0, -.393 * legLength, .059]);
    if (doll) {
      // One round felt nub per foot, flat enough underneath to stand.
      put(foot, roundBox(.27, .18, .37, .085), m.shoe, [0, .08, .035]);
      tube(foot, [[-.07, .165, .075], [0, .172, .095], [.07, .165, .075]], .009, m.thread, 10);
    } else {
      put(foot, roundBox(.225, .16, .345, .065), m.shoe, [0, .07, .025]);
      put(foot, roundBox(.23, .04, .35, .017), m.sole, [0, .003, .023]);
      tube(foot, [[-.064, .15, .06], [0, .153, .08], [.064, .15, .06]], .009, m.thread, 10);
    }
    legs.push({ hip, knee, foot, side: s });
    const shoulder = group(torso, [s * (.36 * c.shoulders) * (doll ? DOLL.shoulderSpread : 1), doll ? DOLL.shoulderY : .49, 0]);
    put(shoulder, upperSleeve, m.coat, [s*.017,0,0]);
    const elbow = group(shoulder, [s * .04, -.30 * armLength, 0]);
    put(elbow, lowerSleeve, m.coat, [0,0,.01]);
    const hand = put(elbow, sphere, m.skin, [0, -.248 * armLength, .025], doll ? DOLL.mitten : [.077, .098, .077]);
    const cuff = put(elbow, shell(shaped([[0,-.024],[.089,-.024],[.094,-.013],[.094,.018],[.088,.025],[0,.025]],armGirth,1),1,24), m.shirt, [0, -.191 * armLength, .016]);
    arms.push({ shoulder, elbow, hand, side: s });
  }
  let heldBook;
  const buttonGeo = new THREE.SphereGeometry(.018, 10, 8);
  if (c.costume === 'apron') {
    const apronProfile = [[.04, -.055], [.32, -.05], [.345, .08], [.305, .26], [.22, .30], [.205, .52], [0, .52]];
    const apron = put(torso, paddedShell(apronProfile, .76,.035,c.seed), m.coat, [0, -.03, .027]); apron.name = 'wrap-apron'; apron.scale.set(widthAt(.12), 1, widthAt(.12));
    // Ivory blouse sleeves and a distinct hanging apron skirt separate the silhouette.
    coat.material = m.shirt; for (const a of arms) { a.shoulder.children[0].material = m.shirt; a.elbow.children[0].material=m.shirt; }
    put(torso, roundBox(.37, .395, .044, .019), m.coat, onBody([0, .365, .265])).name = 'apron-front-bib';
    for (const s of [-1, 1]) tube(torso, [[s * .17, .54, .259], [s * .20, .59, .12], [s * .19, .60, -.07], [s * .21, .41, -.20]].map(onBody), .030, m.coat, 20);
    put(torso, roundBox(.24, .18, .045, .017), m.coat, onBody([0, .14, .285])).name = 'apron-padded-pocket';
    sewnPaths(torso, onPaths([
      [[-.105, .214, .313], [0, .208, .317], [.105, .214, .313]],
      [[-.085, .358, .294], [-.048, .398, .294], [.004, .432, .294]],
      [[-.049, .397, .294], [-.080, .425, .294], [-.075, .443, .294]],
      [[-.033, .410, .294], [-.006, .391, .294], [.013, .397, .294]],
    ], [.14, .365, .365, .365]), m.trim, 'cafe-butter-sprig-and-pocket-stitches');
    put(torso, buttonGeo, m.metal, onBody([-.151, .51, .292], .365)); put(torso, buttonGeo, m.metal, onBody([.151, .51, .292], .365));
  } else if (c.costume === 'knit') {
    const collar = put(torso, new THREE.TorusGeometry(.154, .041, 10, 32), m.rib, [0, .605, 0]); collar.rotation.x = Math.PI / 2;
    const hem = put(torso, shell([[.29,.008],[.318,.016],[.327,.03],[.329,.079],[.312,.092]],.72,36), m.rib); hem.scale.set(c.shoulders * widthAt(.05), 1, widthAt(.05));
    sewnPaths(torso, onPaths([[[.13, .047, .226], [.19, .050, .205], [.24, .055, .170]]], .05), m.trim, 'reader-lapis-hem-signature', .004, .021);
    heldBook = book(rig, m, [.27, 1.07 - lower, .30], .9); heldBook.rotation.set(-.10, -.12, -.10);
  } else {
    const front = put(torso, roundBox(.18, .50, .035, .014), m.shirt, onBody([0, .31, .229])); front.rotation.x = -.045;
    for (const s of [-1, 1]) {
      const lapel = put(torso, roundBox(.105, .265, .038, .013), c.costume==='cardigan'?m.rib:m.coat, onBody([s * .122, .435, .249])); lapel.rotation.z = s * -.21;
      if (c.costume !== 'cardigan') { put(torso, roundBox(.145, .105, .024, .009), m.coat, onBody([s * .205, .30, .225])); put(torso, buttonGeo, m.metal, onBody([s * .205, .322, .244], .30)); }
    }
    for (const y of [.39, .23, .07]) put(torso, buttonGeo, c.costume === 'cardigan' ? m.thread : m.metal, onBody([.035, y, .256], .31));
    if (c.costume === 'cardigan') {
      for (const s of [-1, 1]) put(torso, roundBox(.15, .135, .032, .012), m.coat, onBody([s * .21, .12, .216]));
      sewnPaths(torso, onPaths([[[-.265, .174, .240], [-.21, .171, .244], [-.155, .174, .240]]], .12), m.trim, 'visitor-berry-pocket-stitches', .004, .022);
    }
    if (c.costume === 'travel-jacket') {
      const bag = group(rig, [-.39 * bodyX, .77 - lower, .07 * bodyZ]); bag.rotation.z = -.10;
      put(bag, roundBox(.27, .34, .17, .045), m.leather);
      put(bag, roundBox(.28, .14, .03, .013), m.leather, [0, .10, .093]);
      put(bag, roundBox(.043, .058, .019, .008), m.metal, [0, .065, .117]);
      put(bag, roundBox(.033, .073, .014, .007), m.trim, [.105, .022, .109]).name = 'companion-butter-woven-tab';
      sewnPaths(bag, [[[-.105, .151, .115], [0, .159, .117], [.105, .151, .115]]], m.trim, 'companion-satchel-seam', .0035, .022);
      tube(rig, [[-.40, .89, .11], [-.16, 1.10, .245], [.24, 1.39, .13], [.27, 1.33, -.16], [-.26, .83, -.17]].map(([x, y, z]) => [x * bodyX, y - lower, z * bodyZ]), .026, m.leather, 28);
    }
    if (c.costume === 'work-jacket') {
      const pencil = put(torso, new THREE.CylinderGeometry(.014, .014, .125, 8), m.thread, onBody([-.213, .375, .239])); pencil.rotation.z = -.07;
      sewnPaths(torso, onPaths([[[-.264, .268, .244], [-.264, .297, .247], [-.226, .302, .247]]], .30), m.trim, 'workshop-coral-pocket-corner', .005, .021);
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
      // A doll's arms rest a little out and forward, never hanging straight down.
      arm.shoulder.rotation.set(stride * .32 * gait, 0, -arm.side * (doll ? DOLL.armOut : .075));
      arm.elbow.rotation.x = (doll ? DOLL.elbowRest : -.055) - gait * .08;
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
  return { body, update, head, headHeight: (1.80 - lower) * c.stature * WORLD_SCALE, height: standingHeight(body), identity: body.userData.residentIdentity };
}

function makeProfessor(parent, shared, c, mobile) {
  const body = group(parent); body.scale.setScalar(WORLD_SCALE); body.name = 'resident-researcher-professor';
  const rig = group(body), m = materialsFor(shared, c), sphere = new THREE.SphereGeometry(1, mobile ? 22 : 32, mobile ? 16 : 24);
  const controls = [[0, .025], [.49, .026], [.61, .105], [.67, .35], [.685, .69], [.655, 1.08], [.58, 1.50], [.43, 1.83], [.22, 2.025], [0, 2.10]];
  const profileCurve = new THREE.CatmullRomCurve3(controls.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
  const profile = profileCurve.getPoints(mobile ? 64 : 104).map(p => [Math.max(0, p.x), Math.max(.025, p.y)]);
  const material = m.wool; material.normalScale.setScalar(napFor(c, .74)); material.sheen=c.felt === 'diorama' ? .92 : .84; material.sheenColor.set('#efdded');
  put(rig, shell(profile, .79, mobile ? 36 : 56), material).name = 'professor-oval-felt-body';
  const face = group(rig, [0, 0, .085]), head = group(rig, [0, 1.37, .510]); const eyes = [];
  for (const side of [-1, 1]) {
    const eye = group(face, [side * .245, 1.37, .425]);
    const socket=put(eye,new THREE.TorusGeometry(.092,.0055,8,32),m.socket,[0,0,.006]);socket.scale.y=1.06;
    put(eye, sphere, m.eye, [0, 0, .007], [.088, .096, .079]); put(eye, sphere, m.glint, [-.022, .033, .076], [.016, .020, .007]); eyes.push(eye);
  }
  glasses(face, .245, 1.38, .479, .207, m.glassFrame,.019);
  // Two cream moustache lobes. Deliberately no nose, mouth or eyebrows.
  const moustacheMaterial = m.moustache;moustacheMaterial.normalScale.setScalar(napFor(c, .63));
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

// The diorama cast is a family of needle-felt creatures, not people (10-26 decision): one big felt
// body each, bead eyes, one cream running stitch and one signature object. Their stories stay
// human. Only `felt: 'diorama'` builds them; the live Town keeps CAST above.
const FELT_CAST = Object.freeze({
  'cafe-owner': { kind: 'felt-creature', form: 'bun', seed: 31, body: '#efe1c2', coat: '#8fab8b', trousers: '#6c9070', shoes: '#e7d6b3', bag: '#b78a5a', description: '주름 잡힌 찐빵 몸, 초록 앞치마, 초록 찻주전자' },
  'workshop-owner': { kind: 'felt-creature', form: 'bean', seed: 53, body: '#7186a6', coat: '#394766', shoes: '#56698a', bag: '#a97c50', description: '키 큰 콩 몸, 남색 연장 띠와 연필, 나무망치' },
  grandmother: { kind: 'felt-creature', form: 'ricecake', seed: 79, body: '#f0e9dd', coat: '#d48e9a', hair: '#8c8077', shoes: '#e6ddd0', bag: '#b98b5b', description: '쪽진 꼭지와 나무 비녀의 찹쌀떡 몸, 장밋빛 뜨개 숄, 뜨개질' },
});
// Turned profiles ([radius, height], rig units), eyes [x, height, size], arm height, hem-stitch height and a forward lean.
const FELT_FORMS = Object.freeze({
  // 10-26: the bun and the rice cake are about as tall as they are wide and the bean bends like a kidney bean —
  // the shapes and poses the Blender pass got closer to the concept, carried into this code cast.
  bun: { profile: [[0, .03], [.56, .035], [.7, .14], [.74, .4], [.71, .7], [.6, .98], [.42, 1.2], [.2, 1.38], [0, 1.45]], depth: .92, folds: .014, eye: [.24, .8, .075], arm: .58, seam: .12, lean: 0 },
  bean: { profile: [[0, .05], [.38, .06], [.5, .2], [.54, .55], [.47, .98], [.5, 1.42], [.5, 1.82], [.4, 2.1], [.2, 2.3], [0, 2.35]], depth: .86, folds: .012, eye: [.2, 1.84, .065], arm: 1.2, seam: .14, lean: .14, bend: .1, feet: [.9, 1.15] },
  ricecake: { profile: [[0, .02], [.5, .025], [.6, .14], [.62, .36], [.58, .62], [.48, .86], [.3, 1.06], [.14, 1.16], [0, 1.2]], depth: .9, folds: .016, eye: [.2, .8, .065], arm: .34, seam: .1, lean: .04 },
});
function makeFeltCreature(parent, shared, c, mobile) {
  const form = FELT_FORMS[c.form], body = group(parent); body.scale.setScalar(WORLD_SCALE); body.name = `resident-${c.id}-felt-${c.form}`;
  const rig = group(body), m = materialsFor(shared, c), sphere = new THREE.SphereGeometry(1, mobile ? 20 : 28, mobile ? 14 : 20);
  const felt = m.wool; felt.color.set(c.body); felt.sheenColor.copy(new THREE.Color(c.body).lerp(new THREE.Color('#fff2df'), .35)); felt.normalScale.setScalar(napFor(c, .74));
  const top = form.profile.at(-1)[1], bendAt = form.bend ? y => -form.bend * Math.sin(Math.PI * THREE.MathUtils.clamp(y / top, 0, 1)) : () => 0;
  put(rig, paddedShell(form.profile, form.depth, form.folds, c.seed, mobile ? 36 : 56, form.bend ? bendAt : null), felt).name = `felt-${c.form}-body`;
  // Accessories sit on the same turned (and bent) surface the body was made from.
  const samples = new THREE.CatmullRomCurve3(form.profile.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal').getPoints(120);
  const radiusAt = y => { for (let i = 1; i < samples.length; i++) if (samples[i].y >= y) { const a = samples[i - 1], b = samples[i]; return Math.max(0, a.x + (b.x - a.x) * (y - a.y) / Math.max(1e-6, b.y - a.y)); } return 0; };
  const onSurface = (a, y, out = 0) => { const r = radiusAt(y) + out; return [Math.sin(a) * r, y, Math.cos(a) * r * form.depth + bendAt(y)]; };
  const around = (y, out, from = 0, to = TAU, n = 48) => Array.from({ length: n + 1 }, (_, i) => onSurface(from + (to - from) * i / n, y, out));
  const angleOf = (x, y) => Math.asin(THREE.MathUtils.clamp(x / Math.max(.05, radiusAt(y)), -.95, .95));
  const [ex, ey, er] = form.eye, [footOut, footSize] = form.feet || [.62, 1], eyes = [], arms = [], feet = [];
  for (const side of [-1, 1]) {
    const a = angleOf(side * ex, ey), eye = group(rig, onSurface(a, ey, -er * .25)); eye.rotation.y = a;
    put(eye, sphere, m.eye, [0, 0, 0], [er, er * 1.08, er * .9]); put(eye, sphere, m.glint, [-er * .3, er * .38, er * .78], [er * .22, er * .26, er * .1]); eyes.push(eye);
    const blushY = ey - er * 2.2, b = angleOf(side * (ex + .11), blushY), blush = put(rig, sphere, m.blush, onSurface(b, blushY, -.012), [.075, .045, .025]); blush.rotation.y = b;
    const shoulder = group(rig, [side * radiusAt(form.arm) * .92, form.arm, bendAt(form.arm)]);
    put(shoulder, sphere, felt, [side * .05, -.1, .02], [.13, .19, .13]); arms.push({ shoulder, side });
    const footR = radiusAt(.06); feet.push({ foot: put(rig, sphere, m.shoe, [side * footR * .42, .045, footR * form.depth * footOut], [.15 * footSize, .075 * footSize, .17 * footSize]), side });
  }
  const mouthY = ey - er * 2.7;
  tube(rig, [[-.06, 0], [-.03, -.011], [0, -.015], [.03, -.011], [.06, 0]].map(([x, dy]) => onSurface(angleOf(x, mouthY + dy), mouthY + dy, .004)), .008, m.lip, 10);
  sewnPaths(rig, [around(form.seam, .006)], m.thread, `felt-${c.form}-hem-stitch`, .0075, .045);
  let teapot = null;
  if (c.form === 'bun') {
    // Steamed-bun pleats gathered into a small knot on top.
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + .2; taperedTube(rig, [0, .08, .16, .25].map(d => onSurface(a, top - d - .004, .012)), [.012, .032, .028, .006], felt, 10, 7); }
    put(rig, sphere, felt, [0, top + .012, 0], [.07, .05, .07]);
    const y0 = .1, y1 = .52, apron = new THREE.LatheGeometry(Array.from({ length: 17 }, (_, i) => { const y = y0 + (y1 - y0) * i / 16; return new THREE.Vector2(radiusAt(y) + .022, y); }), 24, -.85, 1.7);
    apron.scale(1, 1, form.depth); m.coat.side = THREE.DoubleSide; put(rig, apron, m.coat).name = 'cafe-sage-apron';
    tube(rig, around(y1 + .004, .03), .02, m.coat, 48);
    for (const tilt of [-.5, .5]) { const bow = put(rig, sphere, m.coat, onSurface(1.45, y1 + .01 + tilt * .05, .05), [.065, .04, .03]); bow.rotation.set(0, 1.45, tilt); }
    sewnPaths(rig, [around(y0 + .025, .028, -.78, .78, 18)], m.thread, 'cafe-apron-hem-stitch', .0075, .04);
    // Held in both hands at the right of the belly, below the face, spout forward (as in the concept).
    teapot = group(rig, onSurface(.5, .4, .2)); teapot.name = 'cafe-green-teapot';
    const pot = group(teapot); pot.rotation.y = -Math.PI / 2; pot.scale.setScalar(1.35);
    put(pot, sphere, m.trousers, [0, 0, 0], [.13, .11, .13]); put(pot, sphere, m.trousers, [0, .1, 0], [.05, .025, .05]);
    tube(pot, [[.1, -.02, 0], [.17, .03, 0], [.21, .08, 0]], .018, m.trousers, 8);
    tube(pot, [[-.11, .05, 0], [-.18, .02, 0], [-.17, -.05, 0], [-.11, -.06, 0]], .014, m.trousers, 8);
  } else if (c.form === 'bean') {
    const waist = .98;
    tube(rig, around(waist, .03), .042, m.coat, 48);
    const pocket = put(rig, roundBox(.2, .17, .05, .02), m.coat, onSurface(.55, waist - .1, .035)); pocket.rotation.y = .55;
    const pencil = put(rig, new THREE.CylinderGeometry(.016, .016, .2, 8), m.trim, onSurface(.6, waist + .02, .065)); pencil.rotation.set(0, .55, -.12);
    sewnPaths(rig, [Array.from({ length: 13 }, (_, i) => onSurface(1.35, .22 + i * .14, .006))], m.thread, 'workshop-side-seam', .0075, .045);
    const hammer = group(arms[0].shoulder, [-.03, -.3, .16]); hammer.rotation.x = -.5; hammer.name = 'workshop-wooden-mallet';
    put(hammer, new THREE.CylinderGeometry(.018, .02, .34, 8), m.leather, [0, .06, 0]); put(hammer, roundBox(.16, .08, .08, .03), m.shoe, [0, .24, 0]);
  } else if (c.form === 'ricecake') {
    // A knitted rose shawl over the shoulders just under the face; its two sides cross in front and hang down.
    const shawl = new THREE.LatheGeometry(Array.from({ length: 13 }, (_, i) => { const y = .32 + .26 * i / 12; return new THREE.Vector2(radiusAt(y) + .03 + .02 * Math.sin(Math.PI * i / 12), y); }), 40);
    shawl.scale(1, 1, form.depth); m.rib.side = THREE.DoubleSide; put(rig, shawl, m.rib).name = 'grandmother-rose-knit-shawl';
    for (const side of [-1, 1]) {
      const wrap = put(rig, roundBox(.17, .34, .045, .022), m.rib, onSurface(side * .22, .42, .065)); wrap.rotation.set(-.2, side * .24, side * .62);
      const end = put(rig, roundBox(.11, .2, .04, .02), m.rib, onSurface(side * .14, .29, .07)); end.rotation.set(-.12, side * .15, side * .1);
    }
    // A small bun on top held by a wooden hairpin.
    put(rig, sphere, m.hair, [0, top - .01, -.15], [.14, .11, .13]);
    const pin = put(rig, new THREE.CylinderGeometry(.012, .012, .38, 8), m.leather, [0, top, -.15]); pin.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) tube(rig, [-.045, 0, .045].map((dx, i) => { const y = ey + er * (1.9 + (i === 1 ? .35 : 0)); return onSurface(angleOf(side * ex + dx, y), y, .004); }), .008, m.hair, 6);
    const knitting = group(rig, onSurface(0, .24, .16)); knitting.name = 'grandmother-knitting';
    put(knitting, sphere, m.rib, [0, 0, 0], [.1, .09, .09]);
    for (const tilt of [-.5, .5]) { const needle = put(knitting, new THREE.CylinderGeometry(.008, .008, .32, 6), m.leather, [tilt * .06, .1, .02]); needle.rotation.z = tilt; }
  }
  body.userData.residentIdentity = { id: c.id, kind: c.kind, description: c.description, silhouette: c.form };
  function update({ now = 0, walkPhase, gaitBlend, walking = false, motion = true, talking = false, working = false, holding = false, showing = false, seated = false } = {}) {
    const t = motion ? now * .001 : 0, gait = motion ? (Number.isFinite(gaitBlend) ? gaitBlend : walking ? 1 : 0) : 0;
    const phase = Number.isFinite(walkPhase) ? walkPhase : t * 7, breath = motion ? Math.sin(t * 1.7 + c.seed) * .012 : 0;
    // A felt creature waddles: a small hop and a rock from foot to foot.
    rig.position.y = Math.abs(Math.sin(phase)) * .045 * gait;
    rig.rotation.z = Math.sin(phase) * .075 * gait + Math.sin(t * 1.1 + c.seed) * .01 * (1 - gait);
    rig.rotation.x = form.lean + (working ? .05 : 0) + (talking ? Math.sin(t * 3.4) * .02 : 0);
    rig.scale.set(1 - breath * .5, 1 + breath - (seated ? .03 : 0), 1 - breath * .5);
    for (const { foot, side } of feet) foot.position.y = .045 + Math.max(0, Math.sin(phase + (side < 0 ? 0 : Math.PI))) * .05 * gait;
    for (const arm of arms) {
      let x = Math.sin(phase + (arm.side < 0 ? Math.PI : 0)) * .45 * gait, z = arm.side * .28;
      if (teapot && !holding && !showing) { x = -1.05 + x * .3; z = -arm.side * .42; }
      if (holding) { x = -1.15; z = arm.side * .1; }
      else if (working) {
        if (c.form === 'bean') x = arm.side < 0 ? -1.25 + Math.sin(t * 7) * .45 : -.35;
        else if (c.form === 'ricecake') { x = -.95 + Math.sin(t * 5 + arm.side) * .06; z = arm.side * .05; }
        else x = -.95 + Math.sin(t * 2.2) * .08;
      } else if (showing && arm.side < 0) { x = -1; z = arm.side * .5; }
      else if (talking && arm.side < 0 && !teapot) x = -.4 - Math.sin(t * 2.6) * .15;
      arm.shoulder.rotation.set(x, 0, z);
    }
    if (teapot) { teapot.visible = !holding; teapot.rotation.x = working ? .3 + Math.sin(t * 2.2) * .15 : 0; }
    const blink = (t + c.seed * .07) % 4.9, openness = blink > 4.74 ? Math.max(.1, Math.abs((blink - 4.82) / .08)) : 1;
    for (const eye of eyes) eye.scale.y = openness;
  }
  update();
  return { body, update, head: rig, headHeight: ey * WORLD_SCALE, height: standingHeight(body), identity: body.userData.residentIdentity };
}

// A baked model keeps its colour in a texture: read it once, small, so a fibre takes the colour under it.
function texelReader(texture) {
  const image = texture?.image; if (!image || typeof document === 'undefined') return null;
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data, flip = texture.flipY;
  return (u, v, out) => {
    const x = Math.min(size - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * size))), y = Math.min(size - 1, Math.max(0, Math.floor((flip ? 1 - v : v) % 1 * size))), i = (y * size + x) * 4;
    return out.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace);
  };
}
function dioramaFelt(body, mobile, seed, unit = 1, ownMesh = false) {
  // Runs after the height is measured, so the fibres never change the contract.
  // Fibres are batched per cloth mesh and parented to it, so a halo bends with
  // its own limb; their colour stays below the cloth value, never white confetti.
  body.updateWorldMatrix(true, true);
  const inverse = body.matrixWorld.clone().invert(), toBody = new THREE.Matrix4(), linear = new THREE.Matrix3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), cloths = [], mottled = new Set();
  // Needle felt is never one flat dye: a soft, cloudy unevenness of a few per
  // cent, sized in body units so a scaled sphere hand and a long sleeve match.
  // Every mesh of a felt material gets the colours (a stitch too), else it would draw black.
  body.traverse(o => {
    if (!o.isMesh || !o.material?.isMeshPhysicalMaterial || !o.material.normalMap) return;
    o.material.vertexColors = true; if (mottled.has(o.geometry)) return; mottled.add(o.geometry);
    toBody.multiplyMatrices(inverse, o.matrixWorld);
    const position = o.geometry.attributes.position, colours = new Float32Array(position.count * 3), k = 14 * Math.cbrt(Math.abs(toBody.determinant())) / unit;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) * k, y = position.getY(i) * k, z = position.getZ(i) * k;
      const v = Math.sin(x * 1.3 + Math.sin(y * 1.7 + z * .6) + seed) * Math.sin(y * 1.1 - z * 1.5 + 1.7) + .5 * Math.sin(z * 2.3 + x * 2.9 - y * .8);
      // Felt standing on felt gathers shade toward the floor; without it a doll
      // lit evenly to its soles reads as pasted above the photograph.
      const ground = THREE.MathUtils.smoothstep(a.fromBufferAttribute(position, i).applyMatrix4(toBody).y, 0, DIORAMA.groundShade * unit);
      colours.fill((.95 + .065 * v) * (.66 + .34 * ground), i * 3, i * 3 + 3);
    }
    o.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  });
  body.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.material?.isMeshPhysicalMaterial || !o.material.normalMap) return;
    const weight = o.material.userData.feltHalo ?? 1; if (!weight) return;
    toBody.multiplyMatrices(inverse, o.matrixWorld);
    const position = o.geometry.attributes.position, index = o.geometry.index, triangles = index ? index.count / 3 : position.count / 3, areas = new Float32Array(triangles);
    let area = 0;
    for (let t = 0; t < triangles; t++) {
      const [i, j, k] = [0, 1, 2].map(n => index ? index.getX(t * 3 + n) : t * 3 + n);
      a.fromBufferAttribute(position, j).applyMatrix4(toBody).sub(d.fromBufferAttribute(position, i).applyMatrix4(toBody));
      b.fromBufferAttribute(position, k).applyMatrix4(toBody).sub(d);
      area += a.cross(b).length() / 2; areas[t] = area;
    }
    cloths.push({ o, weight, areas, area, linear: linear.clone().setFromMatrix4(toBody) });
  });
  const budget = mobile ? DIORAMA.phoneFibres : DIORAMA.fibres, total = cloths.reduce((sum, x) => sum + x.area * x.weight, 0);
  const random = rng(seed), material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .32, depthWrite: false });
  const n = new THREE.Vector3(), p = new THREE.Vector3(), tangent = new THREE.Vector3(), colour = new THREE.Color(), halos = new Map();
  for (const { o, weight, areas, area, linear: m3 } of cloths) {
    const count = Math.round(budget * area * weight / Math.max(1e-6, total)); if (count < DIORAMA.minFibres) continue;
    const position = o.geometry.attributes.position, normal = o.geometry.attributes.normal, index = o.geometry.index;
    const texel = o.material.userData.haloFromMap ? texelReader(o.material.map) : null, uvs = o.geometry.attributes.uv;
    // Every animated part here is a group, and a mesh keeps its build-time place
    // in it, so the halos of one group share a single line batch in its space.
    // A model whose meshes themselves move (a GLB) keeps each halo on its own mesh.
    const owner = ownMesh ? o : o.parent;
    if (!halos.has(owner)) halos.set(owner, { vertices: [], colours: [] });
    const { vertices, colours } = halos.get(owner), base = o.material.color;
    for (let f = 0; f < count; f++) {
      const target = random() * area; let lo = 0, hi = areas.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < target) lo = mid + 1; else hi = mid; }
      const [i, j, k] = [0, 1, 2].map(q => index ? index.getX(lo * 3 + q) : lo * 3 + q);
      let u = random(), v = random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      p.fromBufferAttribute(position, i).multiplyScalar(1 - u - v).addScaledVector(a.fromBufferAttribute(position, j), u).addScaledVector(b.fromBufferAttribute(position, k), v);
      n.fromBufferAttribute(normal, i).multiplyScalar(1 - u - v).addScaledVector(a.fromBufferAttribute(normal, j), u).addScaledVector(b.fromBufferAttribute(normal, k), v).normalize();
      // Lengths are body units (a resident is about two tall); divide by the
      // mesh's own stretch along the normal so a scaled sphere hand gets the same fibre.
      const stretch = Math.max(1e-4, d.copy(n).applyMatrix3(m3).length()), length = (.007 + random() * .015) * unit / stretch, bend = (random() - .5) * .9;
      tangent.set(random() - .5, random() - .5, random() - .5).cross(n).normalize();
      const start = p.clone().addScaledVector(n, .002 * unit / stretch), middle = start.clone().addScaledVector(n, length * .55).addScaledVector(tangent, length * bend * .5), end = start.clone().addScaledVector(n, length).addScaledVector(tangent, length * bend);
      if (!ownMesh) for (const v of [start, middle, end]) v.applyMatrix4(o.matrix);
      vertices.push(...start.toArray(), ...middle.toArray(), ...middle.toArray(), ...end.toArray());
      // Unlit ends read brighter than the shaded cloth, so they sit at its shaded
      // value; only hair and wool get a few loose fibres catching the light.
      if (texel && uvs) texel(uvs.getX(i) * (1 - u - v) + uvs.getX(j) * u + uvs.getX(k) * v, uvs.getY(i) * (1 - u - v) + uvs.getY(j) * u + uvs.getY(k) * v, colour).multiply(base); else colour.copy(base);
      colour.multiplyScalar(.56 + random() * .2); if (weight > 1 && random() < .3) colour.lerp(o.material.sheenColor, .12 + random() * .12);
      for (let q = 0; q < 4; q++) colours.push(colour.r, colour.g, colour.b);
    }
  }
  for (const [parent, { vertices, colours }] of halos) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    const halo = new THREE.LineSegments(geometry, material); halo.name = 'resident-diorama-felt-halo'; halo.raycast = () => {}; parent.add(halo);
  }
  // A fine running stitch must survive at diorama size: widen each sewn
  // instance in place, up to one common thread width (the professor's is already there).
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), at = new THREE.Vector3();
  body.traverse(o => {
    if (!o.isInstancedMesh) return;
    const widen = Math.max(1, Math.min(DIORAMA.stitch, DIORAMA.thread / (o.geometry.parameters?.radiusTop || DIORAMA.thread)));
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, matrix); matrix.decompose(at, rotation, scale); scale.x *= widen; scale.z *= widen; o.setMatrixAt(i, matrix.compose(at, rotation, scale)); }
    o.instanceMatrix.needsUpdate = true;
  });
}

// The same felt finish for a resident modelled elsewhere (a Blender GLB): `unit` is how many of its
// units match one rig unit of the code cast, so mottling, floor shade and fibres keep their size;
// `ownMesh` hangs each halo on its own mesh when the meshes themselves are what moves.
export function feltFinish(root, { mobile = false, seed = 211, unit = 1, ownMesh = false } = {}) { dioramaFelt(root, mobile, seed, unit, ownMesh); }

export function makeTownResident(parent, materials, { id, mobile = false, felt } = {}) {
  if (felt !== undefined && felt !== 'diorama') throw new Error(`Unknown resident felt: ${String(felt)}`);
  const source = (felt && FELT_CAST[id]) || CAST[id];
  if (!source) throw new Error(`Unknown town resident: ${String(id)}`);
  const c = felt ? { ...source, id, felt } : { ...source, id };
  const resident = c.kind === 'felt-creature' ? makeFeltCreature(parent, materials, c, mobile) : c.kind === 'professor' ? makeProfessor(parent, materials, c, mobile) : makeHuman(parent, materials, c, mobile);
  if (felt) dioramaFelt(resident.body, mobile, c.seed || 211);
  return resident;
}

export const TOWN_RESIDENT_CAST = Object.freeze(Object.fromEntries(Object.entries(CAST).map(([id, c]) => [id, Object.freeze({ id, kind: c.kind, description: c.description })])));
