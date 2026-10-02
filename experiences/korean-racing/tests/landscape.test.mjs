import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createLandscapeHeight, buildDistantCoast} from '../landscape.js';

const pathX = s => Math.sin(s / 235) * 25 + Math.sin(s / 580) * 31;
const pathY = s => 23 + Math.sin(s / 280) * 2.8 + Math.sin(s / 100) * 1.2;
const pathAngle = s => Math.atan(Math.cos(s / 235) * 25 / 235 + Math.cos(s / 580) * 31 / 580);
const roadPoint = (s, offset = 0, y = 0) => new THREE.Vector3(pathX(s) + Math.cos(pathAngle(s)) * offset, pathY(s) + y, s - Math.sin(pathAngle(s)) * offset);
const groundHeight = createLandscapeHeight(pathX, pathY);
const coast = extra => buildDistantCoast(THREE, {roadPoint, pathX, groundHeight, ROAD_END: 2250, ...extra});

test('the full road and shoulder strip keeps its existing height on every bend and climb', () => {
  for (let s = -150; s <= 2800; s += 2.7) {
    for (const offset of [-7.1, -6.2, -3.45, 0, 3.45, 6.2, 7.1]) {
      assert.equal(groundHeight(pathX(s) + offset, s), pathY(s));
      const point = roadPoint(s, offset);
      assert(Math.abs(groundHeight(point.x, point.z) - point.y) < .04, `the road is displaced at s=${s}, offset=${offset}`);
    }
    for (const offset of [-13, -9, 9, 13]) {
      const x = pathX(s) + offset, difference = Math.abs(groundHeight(x + .01, s) - groundHeight(x - .01, s));
      assert(difference < .04, 'the immediate roadside must not have an abrupt ledge');
    }
  }
});

test('the coast is finite and continuous, and its shared shoreline exactly intersects the water', () => {
  let shortest = Infinity, longest = -Infinity;
  for (let s = -150; s <= 3500; s += 7.3) {
    const shore = groundHeight.shoreOffset(s), cliff = groundHeight.cliffOffset(s);
    shortest = Math.min(shortest, shore); longest = Math.max(longest, shore);
    assert(shore > 16 && shore < 28);
    assert(Math.abs(groundHeight(pathX(s) + shore, s) + 2.2) < .0004, 'water and terrain must meet at the shared foam line');
    for (const offset of [-350, -100, -26, -7.1, 0, 7.1, cliff - 8, cliff + 6, 170]) {
      const x = pathX(s) + offset, y = groundHeight(x, s);
      assert(Number.isFinite(y));
      assert(Math.abs(groundHeight(x - .0001, s) - groundHeight(x + .0001, s)) < .003, 'transition seams must remain continuous');
      const surface = groundHeight.surfaceAt(x, s, y);
      assert(surface >= 0 && surface <= 2);
    }
  }
  assert(longest - shortest > 4, 'the narrow coast must still vary through coves and headlands');
  assert(longest < 28, 'the shore must not return to a broad flat grass apron');
});

test('low roadside ground opens the horizon before the distant ridges and exposed rock begins', () => {
  let distantRidges = 0, rock = 0;
  for (let s = -150; s <= 2800; s += 8.1) {
    for (const offset of [-20, -40, -60, -80, -100]) {
      assert(groundHeight(pathX(s) + offset, s) - pathY(s) < 14, `near-road inland wall at s=${s}, offset=${offset}`);
    }
    if (groundHeight(pathX(s) - 300, s) - pathY(s) > 35) distantRidges++;
    for (const offset of [-180, -220, -270, -320]) if (groundHeight.surfaceAt(pathX(s) + offset, s) > .65) rock++;
    const cliff = groundHeight.cliffOffset(s), lip = groundHeight(pathX(s) + cliff - 5, s);
    assert(pathY(s) - lip >= 4.4, 'the sea ledge must descend enough to expose the cliff');
    assert(groundHeight.surfaceAt(pathX(s) + cliff, s) > .9, 'the sea cliff must expose stone rather than grass');
  }
  assert(distantRidges > 200, 'the distant ridge layer is missing');
  assert(rock > 100, 'rock and woodland must alternate on the background ridges');
});

test('low headlands and sparse tidal rocks stay outside the road within a reduced merged geometry budget', () => {
  for (const ROAD_END of [2250, 4500]) {
    const group = coast({ROAD_END}), meshes = [];
    group.traverse(part => {if (part.isMesh) meshes.push(part);});
    assert.equal(meshes.length, 4);
    const mesh = meshes[0], geometry = mesh.geometry;
    const triangles = meshes.reduce((total, part) => total + part.geometry.index.count / 3 * (part.isInstancedMesh ? part.count : 1), 0);
    assert.equal(triangles, group.userData.stats.triangles);
    assert(triangles < 27000, 'the open coast must leave geometry budget for nearby scanned rocks and boats');
    assert.equal(group.userData.stats.drawCalls, meshes.length);
    assert.equal(geometry.groups.length, 0);
    for (const name of ['position', 'normal', 'color', 'uv', 'surface']) {
      assert(geometry.attributes[name].array.every(Number.isFinite), `${name} contains a non-finite value`);
    }
    let minimum = Infinity;
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const clearance = positions.getX(i) - pathX(positions.getZ(i));
      minimum = Math.min(minimum, clearance);
      assert(clearance > 13, 'an island or sea stack enters the road/view clearance');
    }
    assert(minimum > 13);
    assert.equal(group.userData.features.filter(f => f.type === 'ridge-island' && !f.distant).length, 4);
    assert.equal(group.userData.features.filter(f => f.distant).length, 1);
    assert.equal(group.userData.features.filter(f => f.type === 'cliff-toe').length, 14);
    assert.equal(group.userData.features.filter(f => f.type === 'sea-stack').length, 4);
    assert(group.userData.features.filter(f => f.type === 'ridge-island').every(f => f.height > 14 && f.height < 52));
    assert(geometry.attributes.surface.array.some(s => s > .95), 'exposed sea-cliff surfaces are required');
    assert(geometry.attributes.surface.array.some(s => s < .1), 'wooded ridges are required');
    let steep = 0, steepRock = 0;
    const normals = geometry.attributes.normal, surface = geometry.attributes.surface;
    // Actual mesh normals check the visible island sides independently of the
    // height function. Remote islands use smaller grids, so inspect their ranges.
    for (const feature of group.userData.features.filter(f => f.type === 'ridge-island')) {
      for (let i = feature.vertexStart; i < feature.vertexStart + feature.vertexCount; i++) {
        if (positions.getY(i) > 2 && normals.getY(i) < .74) {
          steep++;
          if (surface.getX(i) > .8) steepRock++;
        }
      }
    }
    assert(steep > 10, 'low islands must still retain a few exposed ledges');
    assert(steepRock / steep > .90, 'the steep island faces must be rock rather than green clay');
  }
});

test('long asymmetric headlands leave open water and broad wooded crowns rather than a wall of high peaks', () => {
  const group = coast(), geometry = group.children[0].geometry, positions = geometry.attributes.position, surfaces = geometry.attributes.surface;
  const islands = group.userData.features.filter(f => f.type === 'ridge-island');
  assert(islands.at(-1).vertexCount < islands[0].vertexCount * .55, 'remote landforms should use fewer vertices');
  let woodedShoulders = 0;
  for (const island of islands) {
    const [nx, nz] = island.grid, silhouette = [];
    assert(island.rz > island.rx * 2, 'headlands must extend along the horizon rather than rise as cones');
    assert(island.height / (island.rz * 2) < .08, 'the silhouette must remain low against the open sky');
    assert(island.minimumClearance > 190, 'large islands must leave water beside the driving view');
    for (let row = 0; row <= nz; row++) {
      let crest = -Infinity;
      for (let col = 0; col <= nx; col++) {
        const index = island.vertexStart + row * (nx + 1) + col, y = positions.getY(index);
        crest = Math.max(crest, y);
        if (y > island.height * .18 && y < island.height * .62 && surfaces.getX(index) < .30) woodedShoulders++;
      }
      silhouette.push(crest);
    }
    assert(silhouette.filter(y => y > island.height * .65).length >= nz * .22, 'the visible crown must occupy a broad span rather than a narrow spike');
    if (!island.distant) {
      const next = islands[islands.indexOf(island) + 1];
      assert(next.s - next.rz - (island.s + island.rz) > 160, 'each large silhouette needs a real open-water gap');
    }
  }
  assert(woodedShoulders > 200, 'the coast needs visible low wooded terraces instead of bare rock cones');
});

test('island underwater skirts and the exported shoreline meet the actual rendered water level', () => {
  const group = coast(), mesh = group.children[0], positions = mesh.geometry.attributes.position;
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  group.updateMatrixWorld(true);
  for (const island of group.userData.features.filter(f => f.type === 'ridge-island')) {
    const [nx, nz] = island.grid;
    for (let row = 0; row <= nz; row++) for (let col = 0; col <= nx; col++) {
      if (row !== 0 && row !== nz && col !== 0 && col !== nx) continue;
      assert(positions.getY(island.vertexStart + row * (nx + 1) + col) < -2.2, 'the mesh boundary must stay hidden below water');
    }
    const shore = group.userData.islandShorelines.find(f => f.id === island.id);
    assert.equal(shore.points.length, 24);
    for (const point of shore.points) {
      assert.equal(point.y, -2.2);
      ray.set(new THREE.Vector3(point.x, 5, point.z), down);
      const [hit] = ray.intersectObject(mesh, false);
      assert(hit, 'the water edge must be over a real island triangle');
      assert(Math.abs(hit.point.y + 2.2) < .0001, 'water effects must follow the rendered shoreline instead of a circular halo');
    }
  }
});

test('tidal light is one low-contrast merged wash with transparent edges and no shadow or texture pass', () => {
  const group = coast(), wash = group.getObjectByName('coastal-island-tidal-light');
  assert(wash && wash.isMesh);
  assert.equal(wash.material.transparent, true);
  assert.equal(wash.material.depthWrite, false);
  assert.equal(wash.castShadow, false);
  assert.equal(wash.receiveShadow, false);
  assert.equal(wash.material.map, null);
  const positions = wash.geometry.attributes.position, colors = wash.geometry.attributes.color;
  assert.equal(colors.itemSize, 4);
  assert(wash.geometry.index.count / 3 <= 400, 'shore contact must cost only a few hundred triangles');
  assert.equal(wash.geometry.index.count / 3, group.userData.stats.tidalTriangles);
  for (let i = 0; i < positions.count; i++) {
    assert(Math.abs(positions.getY(i) + 2.17) < .000001);
    assert(colors.getW(i) >= 0 && colors.getW(i) <= .096);
    if (i % 3 !== 1) assert.equal(colors.getW(i), 0, 'both sides must dissolve into the water');
  }
  assert(Array.from({length: colors.count}, (_, i) => colors.getW(i)).some(alpha => alpha > .06), 'some broken stretches must remain visible');
});

test('landforms keep the supplied surface material contract and construction is deterministic', () => {
  const material = new THREE.MeshStandardMaterial({vertexColors: true}), first = coast({material}), second = coast({material});
  assert.equal(first.children[0].material, material);
  assert.deepEqual(first.userData.features, second.userData.features);
  assert.deepEqual(first.userData.stats, second.userData.stats);
  assert.deepEqual(first.userData.islandTrees, second.userData.islandTrees);
  for (const name of ['position', 'normal', 'color', 'uv', 'surface']) {
    assert.deepEqual(first.children[0].geometry.attributes[name].array, second.children[0].geometry.attributes[name].array);
  }
  assert.deepEqual(first.children[0].geometry.index.array, second.children[0].geometry.index.array);
  for (const name of ['coastal-island-pine-trunks', 'coastal-island-pine-crowns']) {
    const a = first.getObjectByName(name), b = second.getObjectByName(name);
    assert.deepEqual(a.instanceMatrix.array, b.instanceMatrix.array);
  }
  // Opposite sides differ in both height and coastline; no mirrored mound.
  const geometry = first.children[0].geometry, positions = geometry.attributes.position, surfaces = geometry.attributes.surface;
  let differences = 0;
  const [nx, nz] = first.userData.features[0].grid;
  for (let j = 3; j < nz - 2; j++) for (let i = 3; i < nx / 2; i++) {
    const left = j * (nx + 1) + i, right = j * (nx + 1) + nx - i;
    if (Math.abs(positions.getY(left) - positions.getY(right)) > 2 || Math.abs(surfaces.getX(left) - surfaces.getX(right)) > .2) differences++;
  }
  assert(differences > 150);
});

test('small island pine groves root into actual green mesh faces and preserve the caller-owned canopy texture', () => {
  const texture = new THREE.Texture();
  texture.repeat.set(2, 3); texture.offset.set(.2, .3); texture.rotation = .3; texture.wrapS = THREE.RepeatWrapping;
  const original = {repeat: texture.repeat.clone(), offset: texture.offset.clone(), rotation: texture.rotation, wrapS: texture.wrapS, colorSpace: texture.colorSpace, version: texture.version, sourceVersion: texture.source.version};
  const group = coast({textures: {pineCanopy: texture}}), trees = group.userData.islandTrees;
  assert(trees.length >= 100 && trees.length <= 150, 'small groves must retain vegetation without filling distant silhouettes with geometry');
  assert.equal(trees.length, group.userData.stats.trees);
  const crowns = group.getObjectByName('coastal-island-pine-crowns'), trunks = group.getObjectByName('coastal-island-pine-trunks');
  assert.equal(crowns.count, trees.length); assert.equal(trunks.count, trees.length);
  assert.equal(crowns.castShadow, false); assert.equal(trunks.castShadow, false);
  assert(crowns.material.alphaTest > .3 && crowns.material.side === THREE.DoubleSide && crowns.material.isMeshStandardMaterial);
  assert.notEqual(crowns.material.map, texture);
  assert.deepEqual(texture.repeat, original.repeat); assert.deepEqual(texture.offset, original.offset);
  assert.equal(texture.rotation, original.rotation); assert.equal(texture.wrapS, original.wrapS); assert.equal(texture.colorSpace, original.colorSpace);
  assert.equal(texture.version, original.version); assert.equal(texture.source.version, original.sourceVersion);
  assert.notEqual(crowns.material.map.source, texture.source);
  crowns.geometry.computeBoundingBox();
  const size = crowns.geometry.boundingBox.getSize(new THREE.Vector3());
  assert(size.x > 3 && size.y > 1.5 && size.z > 2, 'small leaves must occupy multiple heights and directions');
  for (const mesh of [crowns, trunks]) {
    assert(mesh.instanceMatrix.array.every(Number.isFinite));
    for (const name of ['position', 'normal', 'uv', 'color']) assert(mesh.geometry.attributes[name].array.every(Number.isFinite));
  }
  const terrain = group.children[0], ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, -1, 0);
  const positions = terrain.geometry.attributes.position, surfaces = terrain.geometry.attributes.surface;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), barycentric = new THREE.Vector3();
  group.updateMatrixWorld(true);
  for (const tree of trees) {
    ray.set(new THREE.Vector3(tree.x, tree.terrainY + 1, tree.z), direction);
    const [hit] = ray.intersectObject(terrain, false);
    assert(hit, 'every trunk must have a real island face beneath it');
    assert(Math.abs(hit.point.y - tree.y - .045) < .00004, 'the trunk must sink slightly into the rendered surface without floating');
    assert(hit.face.normal.y > .91, 'trees must not grow out of a steep rock wall');
    a.fromBufferAttribute(positions, hit.face.a); b.fromBufferAttribute(positions, hit.face.b); c.fromBufferAttribute(positions, hit.face.c);
    THREE.Triangle.getBarycoord(hit.point, a, b, c, barycentric);
    const surface = surfaces.getX(hit.face.a) * barycentric.x + surfaces.getX(hit.face.b) * barycentric.y + surfaces.getX(hit.face.c) * barycentric.z;
    assert(surface < .351, 'trees must grow on wooded ledges rather than exposed rock faces');
  }
  assert(group.userData.features[0].height > 14 && group.userData.features[0].height < 26, 'the nearest island crown must remain below the road eye line');
});
