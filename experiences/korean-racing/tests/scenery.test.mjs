import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildSceneryDetails} from '../scenery.js';

const pathX = s => Math.sin(s / 235) * 25 + Math.sin(s / 580) * 31;
const pathY = s => 23 + Math.sin(s / 280) * 2.8 + Math.sin(s / 100) * 1.2;
const pathAngle = s => Math.atan(Math.cos(s / 235) * 25 / 235 + Math.cos(s / 580) * 31 / 580);
const roadPoint = (s, offset = 0, y = 0) => new THREE.Vector3(pathX(s) + Math.cos(pathAngle(s)) * offset, pathY(s) + y, s - Math.sin(pathAngle(s)) * offset);
// A curved uphill/downhill terrain tests grounding instead of a flat fixture.
const groundHeight = (x, z) => {
  const offset = x - pathX(z), edge = Math.max(0, Math.abs(offset) - 7.1);
  if (offset > 0) return Math.max(-12, pathY(z) - edge * .78 + Math.sin(x * .075) * Math.sin(z * .065) * Math.min(2, edge * .03));
  return pathY(z) - .1 + Math.pow(edge, 1.15) * .105 + (.5 + .5 * Math.sin(x * .065) * Math.sin(z * .065)) * Math.min(8, edge * .13);
};
const options = {roadPoint, pathX, groundHeight, ROAD_END: 2250};
function meshes(group) {const parts = []; group.traverse(part => {if (part.isMesh) parts.push(part);}); return parts;}
function scenery(extra = {}) {return buildSceneryDetails(THREE, {...options, ...extra});}

test('occupied city sites keep tree canopies outside their footprint', () => {
  const site = (x, z, margin = 0) => x < pathX(z) - 9 && z + margin > 650 && z - margin < 1450;
  const original = scenery(), model = scenery({excludeAt: site});
  const trees = model.group.userData.trees;
  assert(trees.length < original.stats.trees);
  assert(trees.length > 40, 'preserve the forest outside the developed blocks');
  assert(trees.every(tree => !site(tree.x, tree.z, 4 * tree.scale)), 'crowns cannot grow through city facades');
  assert.equal(model.stats.pineTrees + model.stats.cherryTrees, model.stats.trees);
});

test('three organic tree silhouettes use lit alpha foliage within the all-course mobile geometry/call budget', () => {
  for (const ROAD_END of [2250, 4500]) {
    const model = scenery({ROAD_END}), parts = meshes(model.group);
    const triangles = parts.reduce((n, part) => n + (part.geometry.index?.count || part.geometry.attributes.position.count) / 3 * (part.isInstancedMesh ? part.count : 1), 0);
    assert.equal(triangles, model.stats.triangles);
    assert(triangles < 250000, `${triangles} triangles exceed the all-course budget`);
    assert(parts.length < 45, `${parts.length} base calls exceed the all-course budget`);
    assert.equal(parts.length, model.stats.drawCalls);
    assert.equal(model.stats.trees, 165);
    const trees = parts.filter(p => p.name === 'scenery-tree-wood' || p.name.includes('-crowns'));
    assert(trees.every(p => p.material.isMeshStandardMaterial && !p.material.transparent));
    assert(trees.every(p => p.geometry.type !== 'PlaneGeometry' && p.geometry.groups.length === 0));
    assert(trees.filter(p => p.name.includes('-crowns')).every(p => !p.isInstancedMesh && p.castShadow && p.receiveShadow));
    for (const species of ['pine', 'cherry']) {
      assert.equal(new Set(model.group.userData.trees.filter(t => t.species === species).map(t => t.variant)).size, 3,
        'each species must use three geometric silhouettes');
    }
    for (const crown of trees.filter(p => p.name.includes('-crowns'))) {
      assert(crown.material.alphaTest > .3 && crown.material.side === THREE.DoubleSide);
      assert.equal(crown.material.alphaMap, null, 'preserve real needle/petal alpha without a round cutout mask');
      const uv = crown.geometry.attributes.uv.array;
      assert(uv.every(value => value >= 0 && value <= 1));
      assert(uv.includes(0) && uv.includes(1), 'foliage must use the full dedicated cluster image, never a whole-tree crop');
      crown.geometry.computeBoundingBox();
      const size = crown.geometry.boundingBox.getSize(new THREE.Vector3());
      assert(size.x > 5 && size.z > 5, 'a crown must have real depth rather than a whole-tree billboard');
    }
    for (const mesh of parts) {
      assert(mesh.geometry.attributes.position.array.every(Number.isFinite));
      assert(mesh.geometry.attributes.normal.array.every(Number.isFinite));
      if (mesh.isInstancedMesh) assert(mesh.instanceMatrix.array.every(Number.isFinite));
    }
  }
});

test('every scenic vertex stays beyond the road and answer-gate shoulder on the curved course', () => {
  const model = scenery(), point = new THREE.Vector3(), matrix = new THREE.Matrix4();
  model.group.updateMatrixWorld(true);
  let minimum = Infinity;
  for (const mesh of meshes(model.group)) {
    const positions = mesh.geometry.attributes.position;
    for (let instance = 0; instance < (mesh.isInstancedMesh ? mesh.count : 1); instance++) {
      if (mesh.isInstancedMesh) {mesh.getMatrixAt(instance, matrix); matrix.premultiply(mesh.matrixWorld);}
      else matrix.copy(mesh.matrixWorld);
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
        const clearance = Math.abs(point.x - pathX(point.z));
        minimum = Math.min(minimum, clearance);
        assert(clearance > 7.6, `${mesh.name} intrudes into the road at z=${point.z}`);
      }
    }
  }
  assert(minimum > 8);
  const first = model.group.userData.trees;
  assert(first.some(tree => tree.species === 'pine' && tree.s === 116));
  assert(first.some(tree => tree.species === 'cherry' && tree.s === 128));
  assert(model.group.userData.placements.every(p => p.side === 'sea' && p.offset > 9));
});

test('tree crowns form uneven close groves with near, middle and far forest layers', () => {
  const model = scenery(), trees = model.group.userData.trees, groves = new Map();
  for (const tree of trees) {
    if (!tree.grove) continue;
    const members = groves.get(tree.grove) || []; members.push(tree); groves.set(tree.grove, members);
  }
  const populations = [...groves.values()].map(members => members.length);
  assert(populations.every(count => count >= 3 && count <= 7), 'forest stands contain 3~7 trees');
  assert(new Set(populations).size >= 4, 'forest silhouettes must not repeat a uniform planted group');
  for (const members of groves.values()) {
    for (const tree of members) {
      const nearest = Math.min(...members.filter(other => other !== tree).map(other => Math.hypot(tree.x - other.x, tree.z - other.z)));
      assert(nearest < 12, 'a forest member needs a nearby crown, rather than an independent random lateral offset');
    }
    assert(Math.max(...members.map(tree => tree.scale)) - Math.min(...members.map(tree => tree.scale)) > .1,
      'an interior/edge height difference creates a varied forest profile');
  }
  const pine = trees.filter(tree => tree.species === 'pine' && tree.offset < 0);
  assert(pine.some(tree => Math.abs(tree.offset) < 23));
  assert(pine.some(tree => Math.abs(tree.offset) > 27 && Math.abs(tree.offset) < 39));
  assert(pine.some(tree => Math.abs(tree.offset) > 44));
});

test('contact shade has a soft alpha edge and samples the real slope without a browser canvas', () => {
  const model = scenery(), shadow = model.group.getObjectByName('scenery-tree-contact-shade');
  assert(shadow.material.transparent); assert.equal(shadow.material.depthWrite, false);
  assert(shadow.material.map.isDataTexture);
  const image = shadow.material.map.image, size = image.width;
  assert.equal(image.data[3], 0, 'the decal corners must be transparent');
  assert(image.data[((size / 2) * size + size / 2) * 4 + 3] > 230);
  const positions = shadow.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const height = groundHeight(positions.getX(i), positions.getZ(i)) + .045;
    assert(Math.abs(positions.getY(i) - height) < .00006, 'shade must lie on the sampled terrain');
  }
});

test('tree roots, branches, foliage and contact shade follow a replacement soil height', () => {
  const soilRise = 43.25, first = scenery();
  const raised = scenery({groundHeight: (x, z) => groundHeight(x, z) + soilRise});
  const vegetation = model => meshes(model.group).filter(part => part.name === 'scenery-tree-wood'
    || part.name.includes('-crowns') || part.name === 'scenery-tree-contact-shade');
  const originals = vegetation(first), shifted = vegetation(raised);
  assert.equal(originals.length, shifted.length);
  for (let mesh = 0; mesh < originals.length; mesh++) {
    const before = originals[mesh].geometry.attributes.position, after = shifted[mesh].geometry.attributes.position;
    assert.equal(before.count, after.count);
    for (let i = 0; i < before.count; i++) {
      assert.equal(after.getX(i), before.getX(i)); assert.equal(after.getZ(i), before.getZ(i));
      assert(Math.abs(after.getY(i) - before.getY(i) - soilRise) < .0001,
        'vegetation must move with the actual soil, rather than retain the road elevation');
    }
  }
  for (const tree of raised.group.userData.trees) {
    assert(Math.abs(tree.y - groundHeight(tree.x, tree.z) - soilRise + .09) < .000001);
    assert(Math.abs(tree.offset) >= 16 && Math.abs(tree.offset) <= 55,
      'near/middle-distance groves must leave the road view open');
  }
});

test('themes reuse geometry and dedicated caller-owned foliage while fixed chunks follow the requested detail distance', () => {
  const texture = new THREE.Texture(), wrapS = texture.wrapS, space = texture.colorSpace;
  const pineCanopy = new THREE.Texture(), blossomCanopy = new THREE.Texture();
  const model = scenery({textures: {cliff: texture, terrain: texture, terrainNormal: texture,
    pine: texture, blossom: texture, pineCanopy, blossomCanopy}});
  const parts = meshes(model.group), geometryIds = parts.map(p => p.geometry.uuid);
  const matrices = parts.filter(p => p.isInstancedMesh).map(p => p.instanceMatrix.array.slice());
  const crown = model.group.getObjectByName('scenery-cherry-crowns');
  model.setTheme('bloom'); assert.equal(crown.material.color.getHexString(), 'fff6ed');
  assert.equal(crown.material.map, blossomCanopy);
  model.setTheme('sunset'); assert.equal(crown.material.color.getHexString(), 'd4c58c');
  assert.equal(crown.material.map, pineCanopy);
  model.setTheme('unknown'); assert.equal(model.stats.theme, 'coast');
  assert.equal(texture.wrapS, wrapS); assert.equal(texture.colorSpace, space);
  for (const foliage of [pineCanopy, blossomCanopy]) {
    assert.equal(foliage.wrapS, THREE.ClampToEdgeWrapping);
    assert.equal(foliage.channel, 0); assert.equal(foliage.repeat.x, 1); assert.equal(foliage.offset.y, 0);
    assert.equal(foliage.colorSpace, THREE.NoColorSpace, 'construction must not change caller texture settings');
  }
  assert.deepEqual(meshes(model.group).map(p => p.geometry.uuid), geometryIds);
  model.update({time: 10, playerS: 1125, detailDistance: 460, motion: true});
  const middleCalls = model.stats.visibleDrawCalls;
  assert(model.stats.visibleDrawCalls + model.stats.visibleShadowDrawCalls < 35);
  assert(model.stats.visibleTriangles < 150000, 'the detailed middle-course view stays inside its geometry budget');
  model.update({time: 10.3, playerS: 2200, detailDistance: 260, motion: false});
  assert(model.stats.visibleDrawCalls < middleCalls);
  assert.equal(model.stats.detailDistance, 260);
  assert.equal(model.group.userData.motion, false);
  assert.deepEqual(parts.filter(p => p.isInstancedMesh).map(p => p.instanceMatrix.array), matrices);
});

test('mobile quality reduces drawn tree triangles, foliage overlap and shadow calls without replacing high-detail data', () => {
  const model = scenery(), parts = meshes(model.group);
  const original = parts.map(part => ({geometry: part.geometry, position: part.geometry.attributes.position.array,
    normal: part.geometry.attributes.normal.array, uv: part.geometry.attributes.uv.array, material: part.material}));
  model.update({time: 10, playerS: 1125, detailDistance: 460, quality: 'high'});
  const high = {...model.stats};
  model.update({time: 10, playerS: 1125, detailDistance: 340, quality: 'balanced'});
  const balanced = {...model.stats};
  model.update({time: 10, playerS: 1125, detailDistance: 260, quality: 'low'});
  const low = {...model.stats};
  assert(balanced.visibleTriangles < high.visibleTriangles * .6);
  assert(low.visibleTriangles < high.visibleTriangles * .5);
  assert(balanced.visibleFoliageCards < high.visibleFoliageCards * .5);
  assert(low.visibleFoliageCards < high.visibleFoliageCards * .35);
  assert(balanced.visibleDrawCalls < high.visibleDrawCalls);
  assert(low.visibleDrawCalls < high.visibleDrawCalls);
  assert(balanced.visibleShadowDrawCalls < high.visibleShadowDrawCalls);
  assert.equal(low.shadowDrawCalls, 0);
  for (const part of parts.filter(part => part.name === 'scenery-tree-wood' || part.name.includes('-crowns'))) {
    assert(part.geometry.index.array.every(index => index >= 0 && index < part.geometry.attributes.position.count));
    assert.equal(part.geometry.index.count % 3, 0);
  }
  model.update({time: 10, playerS: 1125, detailDistance: 460, quality: 'high'});
  assert.deepEqual(model.stats, high, 'returning to high must restore the original complete tree/forest draw budget');
  for (let i = 0; i < parts.length; i++) {
    assert.equal(parts[i].geometry, original[i].geometry);
    assert.equal(parts[i].geometry.attributes.position.array, original[i].position);
    assert.equal(parts[i].geometry.attributes.normal.array, original[i].normal);
    assert.equal(parts[i].geometry.attributes.uv.array, original[i].uv);
    assert.equal(parts[i].material, original[i].material);
    assert.equal(parts[i].geometry.index, null, 'the original high draw uses every curved patch/branch');
  }
});

test('quality changes apply immediately while index buffers are cached and balanced shadows stay near the player', () => {
  const model = scenery();
  model.update({time: 5, playerS: 1125, detailDistance: 340, quality: 'balanced'});
  const crowns = meshes(model.group).filter(part => part.name.includes('-crowns'));
  const near = crowns.filter(part => part.castShadow), far = crowns.filter(part => !part.castShadow && part.parent.visible);
  assert(near.length > 0 && far.length > 0);
  assert(near.every(part => part.userData.detail === 'balanced'));
  assert(far.every(part => part.userData.detail === 'low'));
  model.update({time: 5.01, playerS: 1125, detailDistance: 340, quality: 'low'});
  const firstLowIndices = crowns.map(part => part.geometry.index);
  assert.equal(model.stats.quality, 'low'); assert(crowns.every(part => !part.castShadow));
  model.update({time: 5.02, playerS: 1125, detailDistance: 340, quality: 'high'});
  assert.equal(model.stats.quality, 'high'); assert(crowns.every(part => part.castShadow));
  model.update({time: 5.03, playerS: 1125, detailDistance: 340, quality: 'low', motion: false});
  assert.equal(model.group.userData.motion, false);
  crowns.forEach((part, i) => assert.equal(part.geometry.index, firstLowIndices[i], 'reuse cached element buffers'));
  model.update({time: 5.04, playerS: 1125, detailDistance: 340, quality: 'unknown'});
  assert.equal(model.stats.quality, 'high');
});

test('construction is deterministic for the same terrain and seeded placement source', () => {
  const first = scenery(), second = scenery();
  assert.deepEqual(first.group.userData.trees, second.group.userData.trees);
  assert.deepEqual(first.stats, second.stats);
  const firstParts = meshes(first.group), secondParts = meshes(second.group);
  for (let i = 0; i < firstParts.length; i++) {
    assert.deepEqual(firstParts[i].geometry.attributes.position.array, secondParts[i].geometry.attributes.position.array);
    if (firstParts[i].isInstancedMesh) assert.deepEqual(firstParts[i].instanceMatrix.array, secondParts[i].instanceMatrix.array);
  }
});
