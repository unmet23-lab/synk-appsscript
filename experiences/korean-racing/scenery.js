// Local +Z follows the road; positive road offset is the sea/cliff side.
// All themes share the same 3D trunks/boughs and terrain. Dedicated, transparent
// needle/flower clusters occupy asymmetric branch volumes; no complete tree
// photograph is stretched around a trunk or turned into a leaf.
export function buildSceneryDetails(THREE, {
  roadPoint, pathX, groundHeight, ROAD_END = 2250, textures = {}, random, excludeAt = null,
} = {}) {
  if (!THREE || typeof roadPoint !== 'function' || typeof pathX !== 'function' || typeof groundHeight !== 'function') {
    throw new TypeError('Scenery needs THREE and the current road/terrain functions.');
  }
  if (!Number.isFinite(ROAD_END) || ROAD_END < 100) throw new RangeError('ROAD_END must be at least 100m.');
  const group = new THREE.Group();
  group.name = 'coastal-scenery-details';
  const rng = typeof random === 'function' ? random : seeded(58413);
  const rand = () => {
    const n = rng();
    return Number.isFinite(n) ? Math.max(0, Math.min(.999999, n)) : .5;
  };
  const chunks = [], trees = [], featureParts = new Map(), landmarkMeshes = [];
  const placements = [];
  const object = new THREE.Object3D();
  const pinePhoto = textures.pineCanopy || foliageTexture(THREE, 'pine');
  const cherryPhoto = textures.blossomCanopy || foliageTexture(THREE, 'cherry');
  const wood = new THREE.MeshStandardMaterial({
    color: 0x786c56, map: textures.cliff || null, normalMap: textures.cliffNormal || null,
    normalScale: new THREE.Vector2(.22, .22), roughness: .98, vertexColors: true,
  });
  const pine = new THREE.MeshStandardMaterial({
    color: 0xc9dd94, map: pinePhoto, alphaTest: .34, side: THREE.DoubleSide,
    emissiveMap: pinePhoto, emissive: 0xd8bd7d, emissiveIntensity: .025,
    roughness: .95, vertexColors: true, alphaToCoverage: true,
  });
  const cherry = new THREE.MeshStandardMaterial({
    color: 0xfff6ed, map: cherryPhoto, alphaTest: .32, side: THREE.DoubleSide,
    emissiveMap: cherryPhoto, emissive: 0xffe2b2, emissiveIntensity: .025,
    roughness: .97, vertexColors: true, alphaToCoverage: true,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: 0xe1d7be, map: textures.cliff || null, normalMap: textures.cliffNormal || null,
    normalScale: new THREE.Vector2(.48, .48), roughness: .96, vertexColors: true,
  });
  const paleStone = new THREE.MeshStandardMaterial({
    color: 0xcac5ac, map: textures.beach || null, normalMap: textures.cliffNormal || null,
    normalScale: new THREE.Vector2(.23, .23), roughness: .9, vertexColors: true,
  });
  const timber = new THREE.MeshStandardMaterial({
    color: 0x8a7860, map: textures.cliff || null, roughness: .9, vertexColors: true,
  });
  const plaster = new THREE.MeshStandardMaterial({
    color: 0xeee8d5, normalMap: textures.terrainNormal || null,
    normalScale: new THREE.Vector2(.1, .1), roughness: .9, vertexColors: true,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x475a55, metalness: .5, roughness: .55, vertexColors: true,
  });
  const glazing = new THREE.MeshStandardMaterial({
    color: 0x77969b, metalness: .32, roughness: .18, vertexColors: true,
  });
  const lamp = new THREE.MeshStandardMaterial({
    color: 0xffe0a2, emissive: 0xe9b477, emissiveIntensity: .32,
    metalness: .1, roughness: .3, vertexColors: true,
  });
  const materials = {stone, paleStone, timber, plaster, metal, glazing, lamp};
  for (const [key, material] of Object.entries(materials)) featureParts.set(key, {material, parts: []});

  // Three actual silhouettes per species. Baked species/chunk batches keep
  // variety without multiplying material/shadow calls for every tree variant.
  const pineTemplates = [7921, 14073, 27631].map((seed, variant) => treeTemplate(THREE, 'pine', seed, variant));
  const cherryTemplates = [41033, 27591, 13807].map((seed, variant) => treeTemplate(THREE, 'cherry', seed, variant));
  const chunkCount = Math.min(8, Math.ceil(ROAD_END / 340)), chunkLength = ROAD_END / chunkCount;
  for (let i = 0; i < chunkCount; i++) {
    const root = new THREE.Group();
    root.name = `scenery-road-chunk-${i}`;
    root.userData.range = [i * chunkLength, (i + 1) * chunkLength];
    chunks.push({root, woodParts: [], pine: [], cherry: [], meshes: []});
    group.add(root);
  }
  const treeCount = Math.min(120, Math.max(12, Math.round(ROAD_END / 18.75)));
  const cherryCount = Math.min(45, Math.max(5, Math.round(ROAD_END / 50)));
  function placeTree(species, s, offset, scale, yaw, grove = null) {
    s = Math.max(0, Math.min(ROAD_END - 1, s));
    const point = roadPoint(s, offset);
    if (excludeAt?.(point.x, point.z, 4 * scale)) return;
    point.y = groundHeight(point.x, point.z) - .09;
    object.position.copy(point); object.rotation.set(0, yaw, 0);
    object.scale.set(scale * (.94 + rand() * .1), scale, scale * (.92 + rand() * .13));
    object.updateMatrix();
    const transform = object.matrix.clone();
    const index = Math.min(chunkCount - 1, Math.floor(s / chunkLength));
    const variant = Math.floor(rand() * 3), chunk = chunks[index];
    const template = (species === 'pine' ? pineTemplates : cherryTemplates)[variant];
    chunk.woodParts.push(transformed(THREE, template.wood, transform));
    chunk[species].push(transformed(THREE, template.crown, transform, .93 + rand() * .09));
    trees.push({species, variant, grove, s, offset, x: point.x, y: point.y, z: point.z, scale});
  }
  // These first two silhouettes are visible from the landing/tutorial drive.
  placeTree('pine', Math.min(116, ROAD_END * .22), -16.2, 1.06, .18);
  placeTree('cherry', Math.min(128, ROAD_END * .25), -17.3, 1.02, -.25);
  function groveSizes(count, average = 5) {
    const groups = Math.max(1, Math.round(count / average)), sizes = Array(groups).fill(Math.floor(count / groups));
    for (let i = 0; i < count % groups; i++) sizes[i]++;
    // Preserve the exact count, while changing both population and silhouette
    // of neighbouring groves instead of repeating one five-tree arrangement.
    for (let i = 0; i < groups * 2; i++) {
      const from = Math.floor(rand() * groups), to = Math.floor(rand() * groups);
      if (from !== to && sizes[from] > 3 && sizes[to] < 7) {sizes[from]--; sizes[to]++;}
    }
    return sizes;
  }
  const pineGroves = [], pineSizes = groveSizes(treeCount - 1);
  for (let g = 0; g < pineSizes.length; g++) {
    const s = Math.min(ROAD_END - 18, 104 + g / Math.max(1, pineSizes.length - 1) * (ROAD_END - 130) + (rand() - .5) * 24);
    // Near, middle and far stands share their centre/soil, with overlapping
    // crowns. The old per-tree 16~55m random offsets scattered every grove.
    const seaSide = g % 9 === 6, layer = g % 3;
    const centre = seaSide ? 21.6 + rand() * 2.4 : -(layer === 0 ? 23 + rand() * 3 : layer === 1 ? 32 + rand() * 4 : 45 + rand() * 4);
    const radius = seaSide ? 4 : 4.9 + rand() * 2.1, baseScale = layer === 2 ? 1.08 : .97;
    const grove = {s, centre, radius, seaSide}; pineGroves.push(grove);
    for (let member = 0; member < pineSizes[g]; member++) {
      const angle = member * 2.399 + g * .78 + (rand() - .5) * .46;
      const distance = member === 0 ? .35 : Math.sqrt(.25 + rand() * .75) * radius;
      const station = s + Math.sin(angle) * distance * 1.42;
      const offset = Math.max(16.2, Math.min(54.7, Math.abs(centre) + Math.cos(angle) * distance)) * (seaSide ? 1 : -1);
      // A taller interior tree and a shorter windward edge make a continuous
      // forest profile, with no added polygons or repeated uniform tree height.
      const scale = baseScale + (member === 0 ? .29 : member === 1 ? -.22 : -.16 + rand() * .35);
      placeTree('pine', station, offset, scale, rand() * Math.PI * 2, `pine-${g}`);
    }
  }
  const cherrySizes = groveSizes(cherryCount - 1, 4);
  for (let g = 0; g < cherrySizes.length; g++) {
    const parent = pineGroves[Math.min(pineGroves.length - 1, Math.round((g + .45) / cherrySizes.length * (pineGroves.length - 1)))];
    const s = parent.s + (rand() - .5) * 15;
    const centre = -(Math.min(43, Math.abs(parent.centre)) - 2 + rand() * 3), radius = 4 + rand() * 1.2;
    for (let member = 0; member < cherrySizes[g]; member++) {
      const angle = member * 2.399 + g * 1.08, distance = member === 0 ? .45 : radius * (.55 + rand() * .4);
      const offset = -Math.max(17.1, Math.min(52, Math.abs(centre) + Math.cos(angle) * distance));
      placeTree('cherry', s + Math.sin(angle) * distance * 1.3, offset,
        member === 0 ? 1.12 : member === 1 ? .80 : .8 + rand() * .28, rand() * Math.PI * 2, `cherry-${g}`);
    }
  }
  for (const chunk of chunks) {
    if (chunk.woodParts.length) {
      const trunk = new THREE.Mesh(merge(THREE, chunk.woodParts), wood);
      trunk.name = 'scenery-tree-wood'; trunk.receiveShadow = true;
      prepareLods(trunk); chunk.meshes.push(trunk);
      chunk.root.add(trunk);
    }
    for (const [species, material] of [['pine', pine], ['cherry', cherry]]) {
      const parts = chunk[species];
      if (!parts.length) continue;
      const crown = new THREE.Mesh(merge(THREE, parts), material);
      crown.name = `scenery-${species}-crowns`; crown.castShadow = true; crown.receiveShadow = true;
      prepareLods(crown); chunk.meshes.push(crown);
      chunk.root.add(crown);
      chunk[species] = null;
    }
    chunk.woodParts = null;
  }
  function prepareLods(mesh) {
    // Reuse the original vertex/UV/normal data. Switching quality only changes
    // the cached element buffer: no duplicate tree meshes or vertex buffers.
    mesh.userData.detailIndices = {high: null};
    for (const quality of ['balanced', 'low']) {
      mesh.userData.detailIndices[quality] = new THREE.BufferAttribute(mesh.geometry.detailIndices[quality], 1);
    }
    mesh.userData.detail = 'high';
  }

  // Soft contact shade follows groundHeight at every grid vertex; it remains
  // grounded even when automatic quality disables directional shadow maps.
  // This is a ground decal only, never a foliage card or a generated image.
  const shadeTexture = radialShade(THREE);
  const shadeMaterial = new THREE.MeshBasicMaterial({
    map: shadeTexture, color: 0x172619, transparent: true, opacity: .27,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const shadeParts = trees.map(tree => footprint(THREE, tree, groundHeight));
  const shade = new THREE.Mesh(merge(THREE, shadeParts), shadeMaterial);
  shade.name = 'scenery-tree-contact-shade'; shade.renderOrder = 1;
  group.add(shade);

  // Small landmarks sit entirely outside the driveable shoulder. No scenic
  // arch, bridge or building crosses a question gate or the three answer lanes.
  function addPart(key, geometry, position, scale = [1, 1, 1], angles = [0, 0, 0], tint = 1) {
    object.position.set(...position); object.rotation.set(...angles); object.scale.set(...scale); object.updateMatrix();
    featureParts.get(key).parts.push(transformed(THREE, geometry, object.matrix, tint));
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const rock = roughLobe(THREE, 2, 8841, .19);
  function terrainStone(s, offset, size, tint = 1) {
    const p = roadPoint(s, offset); p.y = groundHeight(p.x, p.z) + size[1] * .24;
    if (excludeAt?.(p.x, p.z, Math.max(size[0], size[2]))) return;
    addPart('stone', rock, p.toArray(), size, [rand() * .3, rand() * 6.28, rand() * .2], tint);
  }
  function atStation(s, offset, y, x, z) {
    const p = roadPoint(s, offset), angle = Math.atan2(pathX(s + .5) - pathX(s - .5), 1);
    return {position: [p.x + Math.cos(angle) * x + Math.sin(angle) * z, p.y + y, p.z - Math.sin(angle) * x + Math.cos(angle) * z], angle};
  }
  function stationBox(key, s, offset, y, x, z, scale, extraYaw = 0, tint = 1) {
    const part = atStation(s, offset, y, x, z);
    addPart(key, box, part.position, scale, [0, part.angle + extraYaw, 0], tint);
  }
  function overlook(s, name) {
    const offset = 13.7, p = roadPoint(s, offset), floor = p.y - .15;
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, 4.2, 6.5, 0, Math.PI * 2, false, 0);
    const deck = new THREE.ExtrudeGeometry(shape, {depth: .66, bevelEnabled: true, bevelSize: .15, bevelThickness: .1, bevelSegments: 1, steps: 1, curveSegments: 18});
    const angle = Math.atan2(pathX(s + .5) - pathX(s - .5), 1);
    addPart('paleStone', deck, [p.x, floor - .55, p.z], [1, 1, 1], [-Math.PI / 2, 0, -angle]);
    // Grounded stone piers carry the terrace over the cliff instead of floating.
    for (const x of [-2.3, 2.3]) for (const z of [-3.6, 3.6]) {
      const base = atStation(s, offset, -.5, x, z).position;
      const bottom = groundHeight(base[0], base[2]) - .18, height = floor - .52 - bottom;
      addPart('stone', cylinder, [base[0], bottom + height / 2, base[2]], [.65, Math.max(.1, height), .65], [0, 0, 0], .92);
    }
    // Low masonry on the sea-facing arc leaves the sea and road sightlines open.
    for (let i = 0; i < 16; i++) {
      const theta = -Math.PI / 2 + (i + .5) / 16 * Math.PI;
      const x = Math.cos(theta) * 4.06, z = Math.sin(theta) * 6.24;
      stationBox('stone', s, offset, .27, x, z, [.55, .75, 1.18], -theta * .73, .88 + rand() * .12);
      stationBox('paleStone', s, offset, .69, x, z, [.65, .12, 1.2], -theta * .73);
    }
    // A quiet sea-facing bench, with separate slats and curved tubular legs.
    for (const z of [-1.05, 1.05]) {
      stationBox('metal', s, offset, .26, -.45, z, [.1, .62, .12]);
      stationBox('metal', s, offset, .26, .1, z, [.1, .62, .12]);
      stationBox('metal', s, offset, .53, -.18, z, [.74, .08, .12]);
      stationBox('metal', s, offset, .86, -.48, z, [.09, .8, .1]);
    }
    for (let i = 0; i < 4; i++) stationBox('timber', s, offset, .56, -.43 + i * .16, 0, [.12, .08, 2.55], 0, .88 + i * .035);
    for (let i = 0; i < 3; i++) stationBox('timber', s, offset, .86 + i * .17, -.49, 0, [.09, .12, 2.55], 0, .94 + i * .02);
    placements.push({name, s, offset, side: 'sea', kind: 'overlook'});
  }
  overlook(ROAD_END * .16, 'north-stone-overlook');
  overlook(ROAD_END * .68, 'south-stone-overlook');

  // Dry-stone retaining walls are short, interrupted stretches on the uphill
  // side, with irregular block depths and occasional roots/rocks at the foot.
  for (const [fraction, length] of [[.11, 29], [.36, 36], [.79, 31]]) {
    const start = ROAD_END * fraction;
    for (let i = 0; i < Math.floor(length / 1.2); i++) for (let row = 0; row < 3; row++) {
      const s = start + i * 1.2 + (row % 2 ? .56 : 0), offset = -9.2;
      const p = roadPoint(s, offset), height = groundHeight(p.x, p.z), yaw = Math.atan2(pathX(s + .5) - pathX(s - .5), 1);
      addPart('stone', box, [p.x, height + .19 + row * .4, p.z], [.55 + rand() * .14, .33 + rand() * .08, 1.08 + rand() * .08], [0, yaw + (rand() - .5) * .035, 0], .82 + rand() * .18);
    }
    terrainStone(start - 3, -11.8, [1.9, 1.2, 1.5], .92);
    terrainStone(start + length + 2, -12.3, [1.7, .9, 1.6], .85);
  }

  // A low rocky promontory and compact lighthouse make a distinct coastal
  // landmark; its tapered tower, gabled keeper cottage and terrace are batched.
  const beaconS = ROAD_END * .47, beacon = roadPoint(beaconS, 72);
  const bx = beacon.x, bz = beacon.z, base = 8.15;
  addPart('stone', rock, [bx, -.8, bz], [18, 9.3, 25], [0, .24, .02], .95);
  addPart('stone', rock, [bx + 8, -1.2, bz + 17], [12, 7.7, 15], [0, -.18, .05], .9);
  addPart('stone', rock, [bx - 8, -.8, bz - 18], [13, 6.8, 18], [0, .52, -.04], 1.04);
  addPart('paleStone', cylinder, [bx, base - .25, bz], [3.7, .55, 3.7]);
  const tower = new THREE.LatheGeometry([
    new THREE.Vector2(2.25, 0), new THREE.Vector2(2.27, .45), new THREE.Vector2(1.82, .55),
    new THREE.Vector2(1.66, 9.4), new THREE.Vector2(1.77, 9.5), new THREE.Vector2(1.77, 9.9),
  ], 18);
  addPart('plaster', tower, [bx, base, bz]);
  addPart('stone', cylinder, [bx, base + .3, bz], [2.28, .6, 2.28], [0, 0, 0], .8);
  addPart('paleStone', cylinder, [bx, base + 10, bz], [2.3, .24, 2.3]);
  addPart('glazing', new THREE.CylinderGeometry(1.35, 1.35, 1.65, 12), [bx, base + 10.98, bz]);
  addPart('lamp', new THREE.CylinderGeometry(.42, .42, .78, 10), [bx, base + 11, bz + 1.13]);
  addPart('metal', new THREE.ConeGeometry(1.83, 1.25, 18), [bx, base + 12.46, bz]);
  addPart('metal', cylinder, [bx, base + 13.23, bz], [.045, .56, .045]);
  // Thin lantern mullions and balcony posts give the light room real depth.
  for (let i = 0; i < 12; i++) {
    const theta = i / 12 * Math.PI * 2;
    addPart('metal', cylinder, [bx + Math.cos(theta) * 1.38, base + 11, bz + Math.sin(theta) * 1.38], [.045, 1.7, .045]);
    addPart('metal', cylinder, [bx + Math.cos(theta) * 2.08, base + 10.45, bz + Math.sin(theta) * 2.08], [.035, .76, .035]);
  }
  addPart('metal', new THREE.TorusGeometry(2.08, .043, 4, 28), [bx, base + 10.83, bz], [1, 1, 1], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) addPart('glazing', box, [bx + 1.77, base + 2 + i * 2.1, bz], [.035, .54, .31]);
  addPart('timber', box, [bx, base + 1.05, bz - 1.83], [.8, 1.85, .08]);
  // A gabled volume, not a box/cone house cluster. Its small keeper cottage is
  // partly hidden by the tower/rock shoulder and carries actual roof thickness.
  const houseShape = new THREE.Shape();
  houseShape.moveTo(-2.3, 0); houseShape.lineTo(2.3, 0); houseShape.lineTo(2.3, 2.8);
  houseShape.lineTo(0, 4.1); houseShape.lineTo(-2.3, 2.8); houseShape.closePath();
  const cottage = new THREE.ExtrudeGeometry(houseShape, {depth: 5.8, bevelEnabled: false, steps: 1});
  addPart('plaster', cottage, [bx - 5.9, base - .8, bz - 2.9]);
  const roofAngle = Math.atan2(1.3, 2.3), roofLength = Math.hypot(1.3, 2.3) + .35;
  for (const sign of [-1, 1]) addPart('metal', box, [bx - 5.9 + sign * 1.2, base + 2.65, bz], [roofLength, .16, 6.3], [0, 0, -sign * roofAngle]);
  for (const x of [-7.1, -4.7]) addPart('glazing', box, [bx + x, base + .72, bz - 2.96], [.7, .9, .04]);
  addPart('timber', box, [bx - 5.9, base + .17, bz - 2.98], [.79, 1.93, .05]);
  addPart('stone', box, [bx - 5.9, base - 1.1, bz], [5.2, .7, 6.2], [0, 0, 0], .88);
  placements.push({name: 'cove-beacon-and-keeper-cottage', s: beaconS, offset: 72, side: 'sea', kind: 'beacon'});

  for (const [key, batch] of featureParts) {
    if (!batch.parts.length) continue;
    const mesh = new THREE.Mesh(merge(THREE, batch.parts), batch.material);
    mesh.name = `scenery-landmark-${key}`;
    mesh.receiveShadow = true;
    // Stone foundations are already grounded; reserve directional shadow
    // draw calls for the tower/cottage and bench/rail details above them.
    mesh.castShadow = key === 'plaster' || key === 'metal' || key === 'timber';
    mesh.userData.defaultCastShadow = mesh.castShadow; landmarkMeshes.push(mesh);
    group.add(mesh);
  }
  for (const template of [...pineTemplates, ...cherryTemplates]) {
    template.wood.dispose(); template.crown.dispose();
  }
  for (const geometry of [box, cylinder, rock]) geometry.dispose();

  const stats = {
    trees: trees.length, pineTrees: trees.filter(t => t.species === 'pine').length, cherryTrees: trees.filter(t => t.species === 'cherry').length, chunks: chunkCount,
    landmarks: placements.length, triangles: 0, drawCalls: 0, shadowDrawCalls: 0,
    visibleTriangles: 0, visibleDrawCalls: 0, visibleShadowDrawCalls: 0,
    visibleFoliageTriangles: 0, visibleFoliageCards: 0, detailDistance: 340, quality: 'high', theme: 'coast',
  };
  group.userData.placements = placements;
  group.userData.trees = trees;
  group.userData.sceneryStats = stats;
  function measure() {
    let triangles = 0, calls = 0, shadowCalls = 0, visibleTriangles = 0, visibleCalls = 0, visibleShadowCalls = 0, visibleFoliageTriangles = 0;
    group.traverse(part => {
      if (!part.isMesh) return;
      const count = (part.geometry.index?.count || part.geometry.attributes.position.count) / 3 * (part.isInstancedMesh ? part.count : 1);
      triangles += count; calls++; if (part.castShadow) shadowCalls++;
      let visible = true;
      for (let parent = part; parent && parent !== group.parent; parent = parent.parent) {
        if (!parent.visible) { visible = false; break; }
      }
      if (visible) {
        visibleTriangles += count; visibleCalls++; if (part.castShadow) visibleShadowCalls++;
        if (part.name.includes('-crowns')) visibleFoliageTriangles += count;
      }
    });
    Object.assign(stats, {triangles, drawCalls: calls, shadowDrawCalls: shadowCalls, visibleTriangles,
      visibleDrawCalls: visibleCalls, visibleShadowDrawCalls: visibleShadowCalls, visibleFoliageTriangles,
      visibleFoliageCards: visibleFoliageTriangles / 8});
  }
  function setTheme(theme = 'coast') {
    theme = ['bloom', 'coast', 'sunset'].includes(theme) ? theme : 'coast';
    stats.theme = theme;
    pine.color.set(theme === 'sunset' ? 0xd4c58c : 0xc9dd94);
    // Pink petals multiplied by a green tint look dry/brown. Outside blossom
    // season use the existing green needle detail on the same branch volume.
    // Both maps stay present, so this change needs no geometry/shader rebuild.
    const seasonalPhoto = theme === 'bloom' ? cherryPhoto : pinePhoto;
    cherry.map = seasonalPhoto;
    cherry.emissiveMap = seasonalPhoto;
    cherry.color.set(theme === 'bloom' ? 0xfff6ed : theme === 'sunset' ? 0xd4c58c : 0xc9dd94);
    cherry.emissiveIntensity = theme === 'bloom' ? .035 : .025;
    plaster.color.set(theme === 'sunset' ? 0xf1d6ad : 0xeee8d5);
    lamp.emissiveIntensity = theme === 'sunset' ? .65 : .32;
  }
  let lastTime = -Infinity, lastS = NaN, lastDistance = NaN, lastQuality, lastMotion;
  function update({time = 0, playerS = 0, motion = true, detailDistance = 340, quality = 'high'} = {}) {
    const s = Number.isFinite(playerS) ? playerS : 0;
    const distance = Number.isFinite(detailDistance) ? Math.max(80, Math.min(900, detailDistance)) : 340;
    quality = ['high', 'balanced', 'low'].includes(quality) ? quality : 'high';
    const moving = motion !== false, behind = quality === 'high' ? distance : quality === 'balanced' ? 70 : 40;
    if (Number.isFinite(time) && time >= lastTime && time - lastTime < .18 && Math.abs(s - lastS) < 12
      && distance === lastDistance && quality === lastQuality && moving === lastMotion) return;
    lastTime = Number.isFinite(time) ? time : 0; lastS = s; lastDistance = distance; lastQuality = quality; lastMotion = moving;
    for (const chunk of chunks) {
      const [start, end] = chunk.root.userData.range;
      const nearest = Math.max(0, start - s, s - end);
      chunk.root.visible = end >= s - behind && start <= s + distance;
      const detail = quality === 'high' ? 'high' : quality === 'low' || nearest > 95 ? 'low' : 'balanced';
      for (const mesh of chunk.meshes) {
        if (mesh.userData.detail !== detail) {
          mesh.geometry.setIndex(mesh.userData.detailIndices[detail]); mesh.userData.detail = detail;
        }
        if (mesh.name.includes('-crowns')) mesh.castShadow = quality === 'high' || quality === 'balanced' && nearest <= 65;
      }
    }
    for (const mesh of landmarkMeshes) mesh.castShadow = quality !== 'low' && mesh.userData.defaultCastShadow;
    stats.detailDistance = distance; stats.quality = quality;
    // The scenery remains still in either motion mode. Ambient movement must
    // not become another cue the learner needs to track while hearing a task.
    group.userData.motion = moving;
    measure();
  }
  setTheme('coast'); measure(); update({playerS: 75, detailDistance: 340});
  return {group, setTheme, update, stats};
}

function seeded(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

// Bake only the attributes this scenery uses; a merged batch has one material
// and no retained geometry groups that would silently add renderer draw calls.
function transformed(THREE, source, matrix, tint = 1) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  if (source.detailIndices) geometry.detailIndices = source.detailIndices;
  geometry.applyMatrix4(matrix);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  const count = geometry.attributes.position.count;
  if (!geometry.attributes.color) {
    const colors = new Float32Array(count * 3); colors.fill(tint);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  } else if (tint !== 1) {
    const colors = geometry.attributes.color.array;
    for (let i = 0; i < colors.length; i++) colors[i] *= tint;
  }
  return geometry;
}

function merge(THREE, parts) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
    const length = parts.reduce((n, part) => n + (part.attributes[name]?.array.length || part.attributes.position.count * size), 0);
    const values = new Float32Array(length); let cursor = 0;
    for (const part of parts) {
      const attribute = part.attributes[name];
      if (attribute) { values.set(attribute.array, cursor); cursor += attribute.array.length; }
      else { const count = part.attributes.position.count * size; if (name === 'color') values.fill(1, cursor, cursor + count); cursor += count; }
    }
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
  }
  if (parts.some(part => part.detailIndices)) {
    const balanced = [], low = []; let offset = 0;
    for (const part of parts) {
      for (const [quality, target] of [['balanced', balanced], ['low', low]]) {
        const indices = part.detailIndices?.[quality];
        if (indices) {for (const index of indices) target.push(offset + index);}
        else {for (let index = 0; index < part.attributes.position.count; index++) target.push(offset + index);}
      }
      offset += part.attributes.position.count;
    }
    geometry.detailIndices = {balanced: new Uint32Array(balanced), low: new Uint32Array(low)};
  }
  geometry.computeBoundingSphere();
  for (const part of parts) part.dispose();
  return geometry;
}

function roughLobe(THREE, detail, seed, roughness = .12) {
  const geometry = new THREE.IcosahedronGeometry(1, detail), positions = geometry.attributes.position;
  // Spatial noise, not random per duplicated face vertex, keeps the lobes
  // closed/watertight rather than opening cracks at shared triangle edges.
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const variation = Math.sin(x * 7.9 + y * 2.1 + z * 5.3 + seed) * .55 + Math.sin(y * 11.1 - z * 6.7 + seed * .37) * .45;
    const radius = 1 + variation * roughness;
    positions.setXYZ(i, x * radius, y * radius, z * radius);
  }
  geometry.computeVertexNormals();
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const variation = .84 + (Math.sin(positions.getX(i) * 5 + positions.getZ(i) * 7 + seed) * .5 + .5) * .2;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = variation;
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function treeTemplate(THREE, species, seed, variant) {
  const random = seeded(seed), wood = [], crown = [], object = new THREE.Object3D();
  const woodIndices = {balanced: [], low: []}, crownIndices = {balanced: [], low: []};
  let woodVertex = 0, crownVertex = 0;
  const pine = species === 'pine', wind = [.52, -.32, .82][variant];
  const height = pine ? [6.4, 7.2, 5.9][variant] : [6.1, 6.7, 5.8][variant];
  function curve(points, radius, segments, radialSegments = 5, endRatio = .18, detail = 'main') {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const geometry = new THREE.TubeGeometry(path, segments, radius, radialSegments, false);
    const position = geometry.attributes.position, uv = geometry.attributes.uv;
    // Genuine taper avoids the previous identical pipe-like branches.
    for (let i = 0; i < position.count; i++) {
      const t = uv.getX(i), centre = path.getPointAt(t), taper = 1 - (1 - endRatio) * Math.pow(t, .82);
      position.setXYZ(i, centre.x + (position.getX(i) - centre.x) * taper,
        centre.y + (position.getY(i) - centre.y) * taper, centre.z + (position.getZ(i) - centre.z) * taper);
      uv.setXY(i, t * 2.5, uv.getY(i) * .52);
    }
    geometry.computeVertexNormals(); wood.push(geometry);
    const count = geometry.index.count;
    for (const quality of ['balanced', 'low']) {
      if (detail === 'twig' || quality === 'low' && detail === 'root') continue;
      for (let index = 0; index < count; index++) woodIndices[quality].push(woodVertex + index);
    }
    woodVertex += count;
  }
  function foliage(position, width, depth, yaw, tint = 1) {
    // Small branch sprays, not balls of repeated whole-tree crops. Bent faces
    // point in irregular directions and use the leaf asset's true alpha.
    const cards = 4 + Math.floor(random() * 2);
    for (let i = 0; i < cards; i++) {
      const geometry = leafPatch(THREE, Math.floor(random() * 10000));
      object.position.set(position[0] + (random() - .5) * width * .42,
        position[1] + (random() - .5) * depth * .30, position[2] + (random() - .5) * width * .42);
      object.rotation.set(i === cards - 1 ? 1.18 + random() * .35 : (random() - .5) * .82,
        yaw + i * 1.37 + (random() - .5) * .72, (random() - .5) * .72);
      object.scale.set(width * (.50 + random() * .12), depth * (.53 + random() * .12), width * .53);
      object.updateMatrix();
      crown.push(transformed(THREE, geometry, object.matrix, tint)); geometry.dispose();
      const count = crown[crown.length - 1].attributes.position.count;
      for (const quality of ['balanced', 'low']) {
        if (i !== 0 && i !== cards - 1 && (quality === 'low' || i !== Math.floor(cards / 2))) continue;
        for (let index = 0; index < count; index++) crownIndices[quality].push(crownVertex + index);
      }
      crownVertex += count;
    }
  }
  const trunk = [[0, -.15, 0], [wind * .12, 1.2, -.07], [wind * .28, 2.7, .16],
    [wind * .74, height * .72, -.12], [wind, height, .13]];
  curve(trunk, pine ? .34 : .30, 10, 6, .24);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + random() * .4, x = Math.cos(angle), z = Math.sin(angle);
    curve([[x * .72, -.10, z * .72], [x * .27, .19, z * .27], [wind * .05, .55, 0]], .16, 3, 3, .52, 'root');
  }
  const arms = pine ? 7 : 6;
  for (let i = 0; i < arms; i++) {
    const angle = i * 2.399 + variant * .83 + (random() - .5) * .42;
    const level = (pine ? .40 : .35) + i / arms * (pine ? .44 : .43);
    const baseY = height * level, reach = (pine ? 2.75 : 2.45) - i / arms * .82 + random() * .7;
    const start = [wind * level * .7, baseY, .05];
    const end = [start[0] + Math.cos(angle) * reach + wind * .2,
      baseY + (pine ? .36 : .9) + random() * .35, Math.sin(angle) * reach];
    const middle = [start[0] + (end[0] - start[0]) * .57, baseY + (pine ? -.18 : .45), end[2] * .58];
    curve([start, [start[0] + .18 * Math.cos(angle), baseY + .24, .15 * Math.sin(angle)], middle, end],
      (pine ? .135 : .14) - i / arms * .055, 4, 4, .15);
    // Needle/petal sprays sit along the branch as well as on the fork tips,
    // joining the crown naturally instead of perched flower pom-poms.
    const branchWidth = pine ? 1.7 + random() * .45 : 2 + random() * .55;
    foliage([middle[0], middle[1] + .31, middle[2]], branchWidth, pine ? 1.13 : 1.55, angle, .96);
    foliage([end[0], end[1] + .22, end[2]], branchWidth * .94, pine ? 1.20 : 1.74, angle + .25, 1);
    const forkAngle = angle + (i % 2 ? -.73 : .81), forkReach = .75 + random() * .60;
    const fork = [middle[0] + Math.cos(forkAngle) * forkReach,
      middle[1] + (pine ? .48 : .95), middle[2] + Math.sin(forkAngle) * forkReach];
    curve([middle, [(middle[0] + fork[0]) / 2, middle[1] + .12, (middle[2] + fork[2]) / 2], fork], .065, 2, 3, .14, 'twig');
    foliage([fork[0], fork[1] + .2, fork[2]], branchWidth * .79, pine ? .98 : 1.52, forkAngle, .93 + random() * .09);
  }
  foliage([wind, height - .15, .13], pine ? 2.35 : 2.5, pine ? 1.45 : 1.92, .5 + variant, 1);
  foliage([wind * .85 - .52, height - .60, -.35], 1.8, pine ? 1.10 : 1.65, 2.1 + variant, .98);
  const mergedWood = merge(THREE, wood.map(g => transformed(THREE, g, new THREE.Matrix4())));
  for (const geometry of wood) geometry.dispose();
  const mergedCrown = merge(THREE, crown);
  mergedWood.detailIndices = {balanced: new Uint32Array(woodIndices.balanced), low: new Uint32Array(woodIndices.low)};
  mergedCrown.detailIndices = {balanced: new Uint32Array(crownIndices.balanced), low: new Uint32Array(crownIndices.low)};
  return {wood: mergedWood, crown: mergedCrown};
}

function leafPatch(THREE, seed) {
  const geometry = new THREE.PlaneGeometry(2, 2, 2, 2), position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    position.setXYZ(i, x * (1 + y * .07), y, .27 * (1 - x * x) + .12 * y * y + Math.sin(seed + y) * .06);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// A deterministic fallback for headless tests or hosts lacking the existing
// leaf-spray asset. Whole-tree photographs are deliberately not used as leaves.
function foliageTexture(THREE, species) {
  const size = 128, pixels = new Uint8Array(size * size * 4), random = seeded(species === 'pine' ? 51823 : 94081);
  function dot(cx, cy, rx, ry, colour) {
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(size - 1, Math.ceil(cy + ry)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(size - 1, Math.ceil(cx + rx)); x++) {
        const radius = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (radius > 1) continue;
        const index = (y * size + x) * 4, tone = .82 + .18 * (1 - radius);
        pixels[index] = colour[0] * tone; pixels[index + 1] = colour[1] * tone; pixels[index + 2] = colour[2] * tone; pixels[index + 3] = 255;
      }
    }
  }
  for (let i = 0; i < 300; i++) {
    const angle = random() * 6.28, distance = Math.sqrt(random()) * size * .43;
    const x = size / 2 + Math.cos(angle) * distance, y = size / 2 + Math.sin(angle) * distance;
    if (species === 'pine') {
      const length = 3 + random() * 5;
      for (let j = 0; j < length; j++) dot(x + Math.cos(angle) * j, y + Math.sin(angle) * j, .75, .75, [95 + random() * 40, 118 + random() * 40, 54 + random() * 24]);
    } else {
      for (let petal = 0; petal < 5; petal++) {
        const a = petal / 5 * 6.28;
        dot(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.8, 1.8, [253, 222 + random() * 16, 213 + random() * 16]);
      }
      dot(x, y, .55, .55, [197, 157, 81]);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true; return texture;
}

function radialShade(THREE) {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
    const value = Math.max(0, 1 - radius), index = (y * size + x) * 4;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
    pixels[index + 3] = Math.round(Math.pow(value, 1.65) * 255);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function footprint(THREE, tree, groundHeight) {
  const positions = [], uv = [], indices = [], steps = 4, radius = (tree.species === 'pine' ? 3.4 : 3.7) * tree.scale;
  for (let z = 0; z <= steps; z++) for (let x = 0; x <= steps; x++) {
    const wx = tree.x + (x / steps * 2 - 1) * radius;
    const wz = tree.z + (z / steps * 2 - 1) * radius * .85;
    positions.push(wx, groundHeight(wx, wz) + .045, wz); uv.push(x / steps, z / steps);
  }
  for (let z = 0; z < steps; z++) for (let x = 0; x < steps; x++) {
    const a = z * (steps + 1) + x, b = a + 1, c = a + steps + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const flat = geometry.toNonIndexed(); geometry.dispose();
  return flat;
}
