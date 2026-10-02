import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createLandscapeHeight} from '../landscape.js';
import {buildCourseTerrain} from '../render-world.js';

const pathX = s => Math.sin(s / 235) * 25 + Math.sin(s / 580) * 31;
const pathY = s => 23 + Math.sin(s / 280) * 2.8 + Math.sin(s / 100) * 1.2;
const groundHeight = createLandscapeHeight(pathX, pathY);
const material = new THREE.MeshStandardMaterial({color: 0xaabbcc});
const world = buildCourseTerrain(THREE, {pathX, groundHeight, ROAD_END: 2250, material, colorAt: () => [.94, .94, .94]});
const chunks = world.group.userData.chunks;
const levels = ['near', 'mid', 'far'];
let clock = 1000;
const update = (playerS, quality = 'high', camera) => world.update({playerS, quality, camera, time: clock++});
const row = (geometry, index, name = 'position') => {
  const {rowStarts, rowCounts} = geometry.userData.terrain, attribute = geometry.attributes[name];
  return [...attribute.array.slice(rowStarts[index] * attribute.itemSize, (rowStarts[index] + rowCounts[index]) * attribute.itemSize)];
};

test('every detail level is a complete upward-facing world-space terrain strip', () => {
  assert.equal(chunks.length, 22);
  let triangles = 0, vertices = 0;
  for (const chunk of chunks) {
    assert(chunk.end - chunk.start <= 125 && chunk.end > chunk.start);
    for (const level of levels) {
      const mesh = chunk.meshes[level], geometry = mesh.geometry, position = geometry.attributes.position;
      assert.equal(mesh.material, material);
      assert.equal(mesh.castShadow, false);
      assert.equal(mesh.receiveShadow, true);
      assert.equal(mesh.frustumCulled, true);
      assert.equal(geometry.groups.length, 0);
      assert(geometry.boundingSphere.radius > 0);
      for (const name of ['position', 'normal', 'uv', 'color', 'surface']) {
        assert(geometry.attributes[name].array.every(Number.isFinite), `${level} ${name} is not finite`);
      }
      // Signed projected areas independently catch holes, duplicated strips,
      // reversed triangles and crossings caused by unequal row sample counts.
      let area = 0;
      for (let i = 0; i < geometry.index.count; i += 3) {
        const a = geometry.index.getX(i), b = geometry.index.getX(i + 1), c = geometry.index.getX(i + 2);
        const signed = ((position.getZ(b) - position.getZ(a)) * (position.getX(c) - position.getX(a)) - (position.getX(b) - position.getX(a)) * (position.getZ(c) - position.getZ(a))) / 2;
        assert(signed > 0, `${mesh.name} has a folded or degenerate triangle`);
        area += signed;
      }
      assert(Math.abs(area - 520 * (chunk.end - chunk.start)) < .02, `${mesh.name} does not cover the complete strip`);
      triangles += geometry.index.count / 3; vertices += position.count;
    }
  }
  assert.equal(world.stats.storedTriangles, triangles);
  assert.equal(world.stats.storedVertices, vertices);
});

test('near terrain retains all existing samples and every level protects road edges and exact coast transitions', () => {
  const original = [];
  for (let x = -350; x < -100; x += 10) original.push(x);
  for (let x = -100; x < -40; x += 4) original.push(x);
  for (let x = -40; x < -8; x += 2) original.push(x);
  for (let x = -8; x < 8; x++) original.push(x);
  for (let x = 8; x < 90; x += 1.5) original.push(x);
  for (let x = 90; x < 170; x += 8) original.push(x);
  original.push(170);
  for (const chunk of chunks) for (const level of levels) {
    const geometry = chunk.meshes[level].geometry;
    const {rows, rowStarts, rowCounts} = geometry.userData.terrain;
    const position = geometry.attributes.position, normals = geometry.attributes.normal;
    assert(rows.every((s, i) => i === 0 || s - rows[i - 1] <= (level === 'near' ? 5 : level === 'mid' ? 12.5 : 25) + .00001));
    for (let j = 0; j < rows.length; j++) {
      const s = rows[j], first = rowStarts[j], count = rowCounts[j], cliff = groundHeight.cliffOffset(s);
      const essential = [-7.1, 0, 7.1, cliff - 5, cliff + 3.5, groundHeight.shoreOffset(s)];
      const find = offset => {
        for (let k = first; k < first + count; k++) if (Math.abs(position.getX(k) - pathX(s) - offset) < .00003) return k;
        return -1;
      };
      for (const offset of essential) {
        const index = find(offset);
        assert(index >= 0, `${chunk.start}/${level}/${s}: lost road/coast feature at ${offset}`);
        assert(Math.abs(position.getY(index) - (groundHeight(pathX(s) + offset, s) - .055)) < .00001);
        assert(normals.getY(index) > 0);
      }
      for (let k = first; k < first + count; k++) {
        const offset = position.getX(k) - pathX(s);
        if (Math.abs(offset) <= 7.10003) assert(Math.abs(position.getY(k) - pathY(s) + .055) < .00001, 'the protected road strip is displaced');
      }
      if (level === 'near') for (const offset of original) assert(find(offset) >= 0, `the existing near-detail sample ${offset} was dropped`);
    }
  }
});

test('all neighbouring LOD combinations share identical positions, normals and shader attributes at their seam', () => {
  for (let i = 1; i < chunks.length; i++) {
    assert.equal(chunks[i - 1].end, chunks[i].start);
    for (const left of levels) for (const right of levels) {
      const a = chunks[i - 1].meshes[left].geometry, b = chunks[i].meshes[right].geometry;
      const last = a.userData.terrain.rows.length - 1;
      for (const name of ['position', 'normal', 'color', 'uv', 'surface']) {
        assert.deepEqual(row(a, last, name), row(b, 0, name), `${left}/${right} ${name} seam at ${chunks[i].start}`);
      }
    }
  }
});

test('quality budgets reduce submitted terrain while keeping a continuous distant inland horizon', () => {
  const maxima = {}, drawCalls = {};
  for (const quality of levels.map((_, i) => ['high', 'balanced', 'low'][i])) {
    let max = 0, calls = 0;
    for (let s = -65; s <= 2250; s += 5) {
      const stats = update(s, quality), visible = chunks.filter(chunk => levels.some(level => chunk.meshes[level].visible));
      assert(visible.length > 0);
      assert(stats.activeTriangles <= stats.triangleBudget, `${quality} terrain exceeds ${stats.triangleBudget}`);
      assert.equal(stats.submittedTriangles, stats.activeTriangles, 'without a camera submitted geometry is the conservative active budget');
      assert.equal(stats.activeDrawCalls, visible.length);
      assert.equal(stats.levels.near + stats.levels.mid + stats.levels.far, visible.length);
      for (let i = 0; i < visible.length; i++) {
        assert.equal(levels.filter(level => visible[i].meshes[level].visible).length, 1);
        if (i) assert.equal(visible[i - 1].end, visible[i].start, 'a horizon hole opens between active chunks');
      }
      assert(visible.at(-1).end >= Math.min(2600, s + stats.forwardDistance), 'coarse terrain ends before the distant view');
      assert(stats.forwardDistance >= 1000 && stats.forwardDistance <= 1500);
      max = Math.max(max, stats.activeTriangles); calls = Math.max(calls, stats.activeDrawCalls);
    }
    maxima[quality] = max; drawCalls[quality] = calls;
  }
  assert(maxima.high < world.stats.sourceTriangles * .28, 'high quality must cut terrain submission by at least 72%');
  assert(maxima.balanced < maxima.high && maxima.low < maxima.balanced);
  assert(maxima.low < world.stats.sourceTriangles * .16);
  assert(drawCalls.high <= 15 && drawCalls.balanced <= 13 && drawCalls.low <= 11);
});

test('live camera frustum statistics remain current between throttled LOD updates', () => {
  const camera = new THREE.PerspectiveCamera(55, 1.6, .1, 2000);
  camera.position.set(pathX(500), pathY(500) + 9, 485);
  camera.lookAt(pathX(600), pathY(600), 600);
  const first = world.update({playerS: 500, quality: 'high', camera, time: 9000});
  assert(first.frustumChecked && first.submittedTriangles > 0 && first.submittedTriangles <= first.activeTriangles);
  const updates = first.updates, active = first.activeTriangles;
  camera.position.set(10000, 10000, 10000); camera.lookAt(11000, 11000, 11000);
  const second = world.update({playerS: 500, quality: 'high', camera, time: 9000.05});
  assert.equal(second.updates, updates, 'camera motion must not rebuild the LOD selection');
  assert.equal(second.activeTriangles, active);
  assert.equal(second.submittedTriangles, 0, 'camera-only motion leaves stale submitted geometry');
  assert.equal(second.submittedDrawCalls, 0);
});

test('LOD selection throttles small movement but immediately follows quality changes, rapid travel and restarts', () => {
  world.update({playerS: 500, quality: 'high', time: 10000});
  const count = world.stats.updates;
  world.update({playerS: 503, quality: 'high', time: 10000.05});
  assert.equal(world.stats.updates, count);
  world.update({playerS: 503, quality: 'low', time: 10000.06});
  assert.equal(world.stats.updates, count + 1);
  assert.equal(world.stats.quality, 'low');
  world.update({playerS: 550, quality: 'low', time: 10000.07});
  assert.equal(world.stats.updates, count + 2);
  world.update({playerS: 550, quality: 'low', time: 10000.30});
  assert.equal(world.stats.updates, count + 3);
  world.update({playerS: 0, quality: 'low', time: 0});
  assert.equal(world.stats.updates, count + 4);
  assert(world.stats.activeRange[0] <= 0 && world.stats.activeRange[1] >= 1100);
});

test('terrain owns its geometry without disposing or modifying the caller material', () => {
  let geometryDisposals = 0, materialDisposals = 0;
  const originalColor = material.color.clone();
  for (const chunk of chunks) for (const level of levels) chunk.meshes[level].geometry.addEventListener('dispose', () => geometryDisposals++);
  material.addEventListener('dispose', () => materialDisposals++);
  world.dispose(); world.dispose();
  assert.equal(geometryDisposals, 66);
  assert.equal(materialDisposals, 0);
  assert(material.color.equals(originalColor));
  assert.equal(world.group.children.length, 0);
  assert.equal(world.stats.submittedTriangles, 0);
  assert.equal(world.stats.visibleDrawCalls, 0);
  assert.throws(() => buildCourseTerrain(THREE, {pathX, groundHeight, material, ROAD_END: NaN}), RangeError);
  assert.throws(() => buildCourseTerrain(THREE, {pathX, groundHeight, material: {}}), TypeError);
});
