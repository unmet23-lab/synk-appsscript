// Positive road offset is the sea side. The road and its shoulders are a
// protected height strip; the coast beyond it has coves, shelves and cliff toes.
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t);};
const hash = (x, z) => {const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123; return n - Math.floor(n);};
function noise(x, z) {
  const a = Math.floor(x), b = Math.floor(z), u = smooth(0, 1, x - a), v = smooth(0, 1, z - b);
  return mix(mix(hash(a, b), hash(a + 1, b), u), mix(hash(a, b + 1), hash(a + 1, b + 1), u), v);
}
const fbm = (x, z) => noise(x, z) * .55 + noise(x * 2, z * 2) * .28 + noise(x * 4, z * 4) * .12 + noise(x * 8, z * 8) * .05;
const ridgeNoise = (x, z) => 1 - Math.abs(fbm(x, z) * 2 - 1);
const cliffOffset = z => clamp(27 + Math.sin(z / 170 + .7) * 4.5 + Math.sin(z / 390 + .4) * 6 + (noise(z * .008, 23.1) - .5) * 5, 20, 42);

export function createLandscapeHeight(pathX, pathY) {
  if (typeof pathX !== 'function' || typeof pathY !== 'function') throw new TypeError('Landscape needs the current road height and horizontal path.');
  const height = (x, z) => {
    const offset = x - pathX(z), edge = Math.max(0, Math.abs(offset) - 7.1), road = pathY(z);
    if (edge === 0) return road;
    if (offset > 0) {
      const cliff = cliffOffset(z), lip = cliff - 5, toe = cliff + 3.5;
      // A narrow downward-sloping ledge reveals the sea and cliff face from
      // the road, instead of forming a broad flat green apron to the water.
      // The smooth ramps also keep props and vegetation anchored at transitions.
      const ledge = road - smooth(7.1, lip, offset) * (4.5 + noise(z * .018, 8.7) * 1.8);
      const cliffDrop = smooth(lip, toe, offset);
      const shelf = -7.5 + Math.sin(z * .032) * 1.1 + noise(x * .11, z * .045) * 1.8;
      const seaFloor = shelf - smooth(toe + 10, toe + 55, offset) * 5;
      return mix(ledge, seaFloor, cliffDrop);
    }
    // Low wooded ground stays open beside the road. Two broken ridges sit
    // well behind it, so a high near slope no longer fills the driving view.
    const gate = smooth(0, 15, edge), ridgeLine = Math.sin(z / 270) * 17 + Math.sin(z / 95 + .8) * 7;
    const foreground = smooth(0, 58, edge) * (3.4 + fbm(x * .027, z * .013) * 5.4);
    const nearRidge = Math.exp(-Math.pow((edge - 222 - ridgeLine) / 65, 2)) * (16 + 19 * ridgeNoise(x * .017, z * .008));
    const backRidge = Math.exp(-Math.pow((edge - 342 + ridgeLine * .6) / 91, 2)) * (31 + 35 * ridgeNoise(x * .013, z * .008));
    const folds = (fbm(x * .055, z * .019) - .48) * Math.min(14, Math.max(0, edge - 115) * .11);
    const rolls = Math.sin(z * .018 + edge * .032) * Math.min(1.4, edge * .045);
    return road + gate * (foreground + nearRidge + backRidge + folds + rolls);
  };
  // These helpers let the terrain shader and the water shader follow the same
  // shoreline instead of drawing surf against the previous straight slope.
  height.cliffOffset = cliffOffset;
  height.shoreOffset = z => {
    let near = cliffOffset(z) - 5, far = cliffOffset(z) + 3.5;
    for (let i = 0; i < 18; i++) {
      const middle = (near + far) / 2;
      if (height(pathX(z) + middle, z) > -2.2) near = middle;
      else far = middle;
    }
    return (near + far) / 2;
  };
  height.surfaceAt = (x, z, y = height(x, z)) => {
    const offset = x - pathX(z);
    if (Math.abs(offset) <= 7.1) return 0;
    const slope = Math.hypot((height(x + .5, z) - height(x - .5, z)), (height(x, z + .5) - height(x, z - .5)));
    if (offset < -7.1) {
      const outcrop = smooth(36, 105, -offset) * smooth(.74, .91, ridgeNoise(x * .044, z * .023)) * .76;
      return Math.max(smooth(.45, .80, slope), outcrop);
    }
    if (y < -.6 && offset > cliffOffset(z) + 2) return 1.5;
    return Math.max(smooth(cliffOffset(z) - 8, cliffOffset(z) - 1, offset), smooth(.48, .86, slope));
  };
  return height;
}

export function buildDistantCoast(THREE, {material, roadPoint, pathX, groundHeight, ROAD_END = 2250, random, textures = {}} = {}) {
  if (!THREE || typeof roadPoint !== 'function' || typeof pathX !== 'function' || typeof groundHeight !== 'function') throw new TypeError('Distant coast needs THREE and the current road/terrain functions.');
  if (!Number.isFinite(ROAD_END) || ROAD_END < 100) throw new RangeError('ROAD_END must be at least 100m.');
  const group = new THREE.Group(); group.name = 'coastal-landscape';
  const rng = typeof random === 'function' ? random : seeded(89217);
  const rand = () => {const n = rng(); return Number.isFinite(n) ? clamp(n, 0, .999999) : .5;};
  const positions = [], colors = [], uv = [], surfaces = [], indices = [];
  const features = [], islandFields = [], colour = new THREE.Color();
  const append = (x, y, z, surface, shade, tint = 0xffffff) => {
    positions.push(x, y, z); uv.push(x / 18, z / 18); surfaces.push(surface);
    colour.set(tint).multiplyScalar(shade); colors.push(colour.r, colour.g, colour.b);
  };
  function island({s, offset, rx, rz, h, yaw, phase}, id) {
    // The closest islands keep the detailed grid. Remote silhouettes need
    // fewer vertices; their shape comes from separate ridges and cut coves.
    const grids = [[48, 38], [44, 34], [40, 32], [44, 34], [36, 30], [32, 26], [32, 26]];
    const [nx, nz] = grids[id], center = roadPoint(s, offset), c = Math.cos(yaw), sn = Math.sin(yaw), start = positions.length / 3;
    const width = .205 + (id % 4) * .018;
    const peaks = [
      {v: -.56 + Math.sin(phase * 1.7) * .07, width: .20 + (id % 3) * .035, height: .60 + Math.cos(phase) * .10},
      {v: -.035 + Math.cos(phase * .8) * .13, width: .25 + ((id + 1) % 3) * .028, height: .98 - (id % 3) * .045},
      {v: .59 + Math.sin(phase * .7) * .11, width: .19 + ((id + 2) % 3) * .03, height: .61 + Math.sin(phase * 1.3) * .13},
    ];
    function sample(u, v) {
      const theta = Math.atan2(v, u), radial = Math.hypot(u, v);
      const rim = clamp(1 + Math.sin(theta * 3 + phase) * .13 + Math.cos(theta * 5 - phase) * .075 + Math.sin(theta * 7 + phase * 2) * .037, .81, 1.12);
      const inlet = Math.exp(-Math.pow((u + .48 + Math.sin(phase) * .09) / .23, 2) - Math.pow((v + .56 - Math.cos(phase) * .13) / .31, 2)) * .36;
      const r = radial / rim + inlet, x = center.x + c * u * rx + sn * v * rz, z = center.z - sn * u * rx + c * v * rz;
      // Broken spines fork into a lower shoulder, unlike repeated smooth
      // cones. The sheltered side has a wooded ledge above a short sea cliff.
      const bend = Math.sin(v * (3.8 + id * .18) + phase) * .12 + Math.cos(v * 7 + phase) * .052;
      const alongRidge = Math.exp(-Math.pow(Math.abs((u - bend) / width), 1.55 + (id % 3) * .12));
      const peakProfile = peaks.reduce((sum, peak) => sum + Math.exp(-Math.pow(Math.abs((v - peak.v) / peak.width), 1.50)) * peak.height, 0);
      const rockFold = ridgeNoise(x * .040, z * .029), ridge = peakProfile * alongRidge * (.74 + rockFold * .26);
      const branch = Math.exp(-Math.pow(Math.abs((u + .31 + v * (.24 + id % 2 * .18) - bend * .35) / .16), 1.6)) * Math.exp(-Math.pow((v - .19) / .52, 2)) * .20;
      const shoulder = Math.exp(-Math.pow((u - bend + .39) / .37, 4)) * (.105 + noise(z * .014, phase * 5) * .025);
      const ledge = .097 + fbm(x * .017, z * .012) * .052;
      const crown = ledge + ridge * .69 + shoulder + branch;
      const fracture = (ridgeNoise(x * .085 + 15, z * .063) - .71) * h * .12 * smooth(.19, .65, ridge);
      const y = mix(h * crown + fracture + Math.sin(z * .037 + phase) * .85, -6.5, smooth(.86, 1.01, r));
      return {x, y, z, r, ridge, rockFold, shoulder};
    }
    const classify = (u, v) => {
      const point = sample(u, v);
      const slopeU = (sample(u + .008, v).y - sample(u - .008, v).y) / (.016 * rx);
      const slopeV = (sample(u, v + .008).y - sample(u, v - .008).y) / (.016 * rz);
      const slope = Math.hypot(slopeU, slopeV);
      const exposed = Math.max(smooth(.84, .94, point.r), smooth(.38, .68, slope), smooth(.76, 1.06, point.ridge) * .69, smooth(.93, .99, point.rockFold) * .36);
      return {...point, slope, surface: point.y < -1 ? 1.7 : exposed};
    };
    const candidates = [];
    let crest = -Infinity, minimum = Infinity;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const u = -1.18 + i / nx * 2.36, v = -1.18 + j / nz * 2.36;
      const {x, y, z, r, surface, slope} = classify(u, v);
      const woodland = noise(x * .048 + 31, z * .041), shade = .84 + woodland * .20;
      append(x, y, z, surface, shade, surface < .3 ? (woodland > .57 ? 0xaabd99 : 0xcbd3b8) : 0xfffbf1);
      crest = Math.max(crest, y); minimum = Math.min(minimum, x - pathX(z));
      if (y > 4 && r < .82 && slope < .29 && surface < .30) candidates.push({u, v, x, y, z});
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = start + j * (nx + 1) + i, b = a + nx + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    features.push({type: 'ridge-island', id, s, offset, rx, rz, height: crest, minimumClearance: minimum, vertexStart: start, vertexCount: (nx + 1) * (nz + 1), grid: [nx, nz]});
    const terrainAt = (u, v) => {
      const gx = clamp((u + 1.18) / 2.36 * nx, 0, nx - .00001), gz = clamp((v + 1.18) / 2.36 * nz, 0, nz - .00001);
      const i = Math.floor(gx), j = Math.floor(gz), a = gx - i, b = gz - j;
      const read = (ix, iz) => {const index = start + iz * (nx + 1) + ix; return {height: positions[index * 3 + 1], surface: surfaces[index]};};
      const tl = read(i, j), tr = read(i + 1, j), bl = read(i, j + 1), br = read(i + 1, j + 1), dx = 2.36 / nx * rx, dz = 2.36 / nz * rz;
      const corners = a + b <= 1 ? [tl, tr, bl] : [tr, bl, br], weights = a + b <= 1 ? [1 - a - b, a, b] : [1 - b, 1 - a, a + b - 1];
      const result = {height: 0, surface: 0, slope: a + b <= 1 ? Math.hypot((tr.height - tl.height) / dx, (bl.height - tl.height) / dz) : Math.hypot((br.height - bl.height) / dx, (br.height - tr.height) / dz)};
      corners.forEach((corner, k) => {result.height += corner.height * weights[k]; result.surface += corner.surface * weights[k];});
      return result;
    };
    islandFields.push({id, rx, rz, sample, classify, candidates, terrainAt});
  }
  const scale = ROAD_END / 2250;
  const islands = [
    {s: 440 * scale, offset: 191, rx: 64, rz: 108, h: 54.4, yaw: -.23},
    {s: 860 * scale, offset: 360, rx: 127, rz: 189, h: 116, yaw: .31},
    {s: 1230 * scale, offset: 656, rx: 193, rz: 283, h: 148, yaw: -.16},
    {s: 1660 * scale, offset: 257, rx: 99, rz: 173, h: 92, yaw: .34},
    {s: 2250 * scale, offset: 560, rx: 217, rz: 297, h: 163, yaw: -.41},
    {s: 2860 * scale, offset: 1010, rx: 293, rz: 358, h: 177, yaw: .27},
    {s: 3550 * scale, offset: 540, rx: 270, rz: 465, h: 215, yaw: -.31},
  ];
  islands.forEach((spec, id) => island({...spec, phase: id * 1.63 + .4}, id));

  function rock(s, offset, sx, sy, sz, yaw, id, type) {
    const center = roadPoint(s, offset), base = type === 'sea-stack' ? -5.3 : Math.min(-3.5, groundHeight(center.x, center.z));
    const geometry = new THREE.IcosahedronGeometry(1, 2), attribute = geometry.attributes.position;
    const start = positions.length / 3, c = Math.cos(yaw), sn = Math.sin(yaw);
    let minimum = Infinity;
    for (let i = 0; i < attribute.count; i++) {
      const x = attribute.getX(i), y = attribute.getY(i), z = attribute.getZ(i);
      const fissure = .87 + noise(x * 3.7 + id * 2, z * 4.3 + y * 2) * .19;
      const taper = 1 - smooth(.15, 1, y) * .28;
      const xx = x * sx * fissure * taper + y * sx * .12, zz = z * sz * fissure * taper;
      const worldX = center.x + xx * c + zz * sn, worldZ = center.z - xx * sn + zz * c;
      const worldY = base + (y + 1) * sy / 2;
      append(worldX, worldY, worldZ, worldY < -1.2 ? 1.35 : 1, .90 + noise(x * 7, y * 5 + id) * .14, 0xf0e9d9);
      minimum = Math.min(minimum, worldX - pathX(worldZ));
    }
    for (let i = 0; i < attribute.count; i++) indices.push(start + i);
    geometry.dispose();
    features.push({type, id, s, offset, height: sy, minimumClearance: minimum});
  }
  // Small connected rock shelves break the uniform waterline. A few eroded
  // stacks occur in clusters, rather than a repeating row of identical pillars.
  for (let i = 0; i < 36; i++) {
    const s = 40 + (i + rand() * .8) / 36 * (ROAD_END - 80), coast = groundHeight.shoreOffset?.(s) ?? cliffOffset(s);
    rock(s, coast + 7 + rand() * 7, 3.5 + rand() * 6.5, 4.5 + rand() * 6, 6 + rand() * 8, rand() * TAU, i, 'cliff-toe');
  }
  for (let i = 0; i < 10; i++) {
    const bay = [410, 1020, 1730][i % 3] * scale, s = bay + (rand() - .5) * 93;
    const coast = groundHeight.shoreOffset?.(s) ?? cliffOffset(s);
    rock(s, coast + 20 + rand() * 18, 2.5 + rand() * 3.5, 8 + rand() * 12, 3 + rand() * 5, rand() * TAU, 36 + i, 'sea-stack');
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('surface', new THREE.Float32BufferAttribute(surfaces, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const coastMaterial = material || new THREE.MeshStandardMaterial({vertexColors: true, color: 0xb5bea4, roughness: 1});
  const mesh = new THREE.Mesh(geometry, coastMaterial); mesh.name = 'coastal-ridge-islands-and-sea-stacks'; mesh.receiveShadow = true; group.add(mesh);
  const trees = [];
  for (const field of islandFields) {
    if (!field.candidates.length) continue;
    const centers = [0, 1, 2].map(() => field.candidates[Math.floor(rand() * field.candidates.length)]);
    const ownTrees = [];
    for (let attempts = 0; attempts < 1600 && ownTrees.length < 40; attempts++) {
      const grove = centers[ownTrees.length % centers.length];
      const u = grove.u + (rand() - .5) * .36, v = grove.v + (rand() - .5) * .44;
      const point = field.classify(u, v), size = 1.32 + rand() * .83;
      if (point.y < 4 || point.r > .86 || point.slope > .35 || point.surface > .35) continue;
      if (ownTrees.some(tree => Math.hypot(tree.x - point.x, tree.z - point.z) < 2.1 * size)) continue;
      const across = size * .62 / field.rx, along = size * .62 / field.rz;
      const foot = [field.classify(u - across, v), field.classify(u + across, v), field.classify(u, v - along), field.classify(u, v + along)];
      if (foot.some(p => p.slope > .48 || p.surface > .55 || p.y < 3)) continue;
      const actualTerrain = field.terrainAt(u, v), terrainY = actualTerrain.height;
      if (actualTerrain.slope > .42 || actualTerrain.surface > .35 || Math.abs(terrainY - point.y) > .55) continue;
      const tree = {island: field.id, x: point.x, y: terrainY - .045, z: point.z, terrainY, sampleY: point.y, meshSlope: actualTerrain.slope, terrainSurface: actualTerrain.surface, slope: point.slope, surface: point.surface, yaw: rand() * TAU, size, grove: ownTrees.length % centers.length};
      trees.push(tree); ownTrees.push(tree);
    }
  }
  const treeBudget = buildIslandForest(THREE, group, trees, textures.pineCanopy);
  group.userData.features = features;
  group.userData.islandTrees = trees;
  group.userData.stats = {triangles: indices.length / 3 + treeBudget.triangles, drawCalls: 1 + treeBudget.drawCalls, islands: islands.length, rocks: 46, trees: trees.length};
  return group;
}

function seeded(initial) {
  let seed = initial >>> 0;
  return () => {seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296;};
}

function buildIslandForest(THREE, group, trees, pineCanopy) {
  if (!trees.length) return {triangles: 0, drawCalls: 0};
  const wood = {positions: [], colors: [], uv: [], indices: []};
  function tube(points, radii, sides) {
    const start = wood.positions.length / 3;
    const axis = new THREE.Vector3().subVectors(points.at(-1), points[0]).normalize();
    const tangent = new THREE.Vector3(0, 0, 1).cross(axis).normalize(), binormal = new THREE.Vector3().crossVectors(axis, tangent).normalize();
    for (let j = 0; j < points.length; j++) for (let i = 0; i < sides; i++) {
      const theta = i / sides * TAU;
      const point = points[j].clone().addScaledVector(tangent, Math.cos(theta) * radii[j]).addScaledVector(binormal, Math.sin(theta) * radii[j]);
      wood.positions.push(point.x, point.y, point.z); wood.uv.push(i / sides, j / (points.length - 1));
      const shade = .82 + (i % 3) * .07; wood.colors.push(shade, shade, shade * .96);
    }
    for (let j = 0; j < points.length - 1; j++) for (let i = 0; i < sides; i++) {
      const a = start + j * sides + i, b = start + j * sides + (i + 1) % sides, c = a + sides, d = b + sides;
      wood.indices.push(a, b, c, b, d, c);
    }
  }
  const vector = (x, y, z) => new THREE.Vector3(x, y, z);
  tube([vector(0, 0, 0), vector(.15, .85, .04), vector(.40, 1.72, .09)], [.115, .08, .047], 4);
  tube([vector(.15, .85, .04), vector(1.04, 1.48, .16)], [.052, .021], 3);
  tube([vector(.18, 1.05, .04), vector(-.72, 1.34, -.27)], [.044, .018], 3);
  tube([vector(.40, 1.72, .09), vector(.13, 2.48, -.28)], [.034, .014], 3);
  const woodGeo = geometryFrom(THREE, wood);
  const leaves = {positions: [], colors: [], uv: [], indices: []};
  for (const [cx, cy, cz, width, tall] of [[.40, 1.86, .09, 1.45, .65], [1.05, 1.49, .16, 1.20, .62], [-.73, 1.37, -.27, 1.15, .59], [.13, 2.50, -.28, 1.11, .64]]) {
    for (let facing = 0; facing < 3; facing++) {
      const yaw = facing * TAU / 3 + cy * .45, tilt = .24 + facing * .17, start = leaves.positions.length / 3;
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
        const u = col / 2, v = row, x = (u - .5) * width * 2, y = (v - .5) * tall * 1.8;
        const bend = Math.sin(u * Math.PI) * .23, zz = Math.sin(tilt) * y + bend;
        leaves.positions.push(cx + Math.cos(yaw) * x + Math.sin(yaw) * zz, cy + Math.cos(tilt) * y - bend * .25, cz - Math.sin(yaw) * x + Math.cos(yaw) * zz);
        leaves.uv.push(u, v); const tone = .90 + row * .08; leaves.colors.push(tone * .97, tone, tone * .89);
      }
      leaves.indices.push(start, start + 3, start + 1, start + 1, start + 3, start + 4, start + 1, start + 4, start + 2, start + 2, start + 4, start + 5);
    }
  }
  // A private Texture/Source wrapper reuses the read-only pixels. Texture.clone
  // shares Source and bumps its version, so it would dirty the caller's texture.
  const leafGeo = geometryFrom(THREE, leaves), photo = pineCanopy?.isDataTexture ? new THREE.DataTexture(pineCanopy.image.data, pineCanopy.image.width, pineCanopy.image.height, pineCanopy.format, pineCanopy.type) : pineCanopy?.isTexture ? new THREE.Texture(pineCanopy.image) : islandPineTexture(THREE);
  photo.colorSpace = THREE.SRGBColorSpace; photo.wrapS = photo.wrapT = THREE.ClampToEdgeWrapping; photo.repeat.set(1, 1); photo.offset.set(0, 0); photo.rotation = 0; photo.channel = 0; photo.needsUpdate = true;
  const woodMat = new THREE.MeshStandardMaterial({color: 0x817257, vertexColors: true, roughness: .98});
  const leafMat = new THREE.MeshStandardMaterial({map: photo, color: 0xc4d0ac, vertexColors: true, alphaTest: .35, side: THREE.DoubleSide, alphaToCoverage: true, roughness: .96, emissiveMap: photo, emissive: 0xffffff, emissiveIntensity: .08});
  const trunks = new THREE.InstancedMesh(woodGeo, woodMat, trees.length), crowns = new THREE.InstancedMesh(leafGeo, leafMat, trees.length);
  trunks.name = 'coastal-island-pine-trunks'; crowns.name = 'coastal-island-pine-crowns';
  const transform = new THREE.Object3D(), shade = new THREE.Color();
  trees.forEach((tree, i) => {
    transform.position.set(tree.x, tree.y, tree.z); transform.rotation.set(0, tree.yaw, 0); transform.scale.set(tree.size * .98, tree.size, tree.size); transform.updateMatrix();
    trunks.setMatrixAt(i, transform.matrix); crowns.setMatrixAt(i, transform.matrix);
    shade.setRGB(.77 + (i % 5) * .028, .86 + (i % 4) * .025, .69 + (i % 3) * .045); crowns.setColorAt(i, shade);
  });
  trunks.receiveShadow = crowns.receiveShadow = true;
  // The distant small groves do not create two additional shadow-map passes.
  trunks.castShadow = crowns.castShadow = false;
  trunks.computeBoundingSphere(); crowns.computeBoundingSphere(); group.add(trunks, crowns);
  return {triangles: (wood.indices.length + leaves.indices.length) / 3 * trees.length, drawCalls: 2};
}

function geometryFrom(THREE, {positions, colors, uv, indices}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function islandPineTexture(THREE) {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size * 2 - 1, v = (y + .5) / size * 2 - 1, r = Math.hypot(u, v * 1.45), grain = noise(x * .85, y * .7);
    const alpha = (1 - smooth(.72, .97, r)) * smooth(.18, .42, grain + Math.sin(x * 2.4 + y * 1.1) * .13), i = (y * size + x) * 4;
    data[i] = 43 + grain * 42; data[i + 1] = 64 + grain * 60; data[i + 2] = 32 + grain * 31; data[i + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true; return texture;
}
