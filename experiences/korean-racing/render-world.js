// The road and the shore use the same height function as the original terrain.
// Only the number of triangles submitted beyond the driving view changes.
const CHUNK_LENGTH = 125;
const ROAD_EDGE = 7.1;
const SURFACE_OFFSET = -.055;
const LEVELS = ['near', 'mid', 'far'];
const SETTINGS = Object.freeze({
  high: Object.freeze({near: 250, nearBehind: 70, mid: 650, ahead: 1500, behind: 150, triangleBudget: 46000}),
  balanced: Object.freeze({near: 150, nearBehind: 35, mid: 450, ahead: 1300, behind: 110, triangleBudget: 35000}),
  low: Object.freeze({near: 75, nearBehind: 25, mid: 300, ahead: 1100, behind: 75, triangleBudget: 26000}),
});
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const unique = values => values.sort((a, b) => a - b).filter((n, i, all) => i === 0 || n - all[i - 1] > .00001);

function originalOffsets() {
  const offsets = [];
  for (let x = -350; x < -100; x += 10) offsets.push(x);
  for (let x = -100; x < -40; x += 4) offsets.push(x);
  for (let x = -40; x < -8; x += 2) offsets.push(x);
  for (let x = -8; x < 8; x++) offsets.push(x);
  for (let x = 8; x < 90; x += 1.5) offsets.push(x);
  for (let x = 90; x < 170; x += 8) offsets.push(x);
  offsets.push(170);
  return offsets;
}

const DENSE_OFFSETS = originalOffsets();
const CROSS_SECTIONS = {
  near: unique([...DENSE_OFFSETS, -ROAD_EDGE, ROAD_EDGE]),
  mid: unique([
    ...DENSE_OFFSETS.filter(x => x < -100 ? x % 20 === -10 || x === -350 : x < -40 ? x % 8 === 0 : x < -8 ? x % 4 === 0 : x < 8 ? x % 2 === 0 : x < 90 ? (x - 8) % 3 === 0 : x % 16 === 10),
    -350, -ROAD_EDGE, 0, ROAD_EDGE, 170,
  ]),
  far: [-350, -320, -290, -260, -230, -200, -170, -140, -110, -85, -65, -48, -36, -26, -18, -12, -8, -ROAD_EDGE, 0, ROAD_EDGE, 8, 12, 70, 90, 130, 170],
};
const STEPS = {near: 5, mid: 12.5, far: 25};

/**
 * Geometry remains in world coordinates for the existing terrain shader.
 * colorAt(x,z,height,surface) may return linear RGB, a THREE.Color or a hex color.
 * Material ownership stays with the caller; dispose() releases only this geometry.
 * update accepts optional camera/time for frustum statistics and deterministic QA.
 */
export function buildCourseTerrain(THREE, {pathX, groundHeight, ROAD_END = 2250, material, colorAt} = {}) {
  if (!THREE || typeof pathX !== 'function' || typeof groundHeight !== 'function' || !material?.isMaterial) {
    throw new TypeError('Course terrain needs THREE, the current path/height functions and a material.');
  }
  if (!Number.isFinite(ROAD_END) || ROAD_END < 100) throw new RangeError('ROAD_END must be at least 100m.');
  if (colorAt !== undefined && typeof colorAt !== 'function') throw new TypeError('colorAt must be a function.');

  const start = -150, end = ROAD_END + 350;
  const group = new THREE.Group(); group.name = 'course-terrain';
  const chunks = [], colour = new THREE.Color(), cachedRows = new Map();
  const frustum = new THREE.Frustum(), projectionView = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const stats = {
    chunkCount: 0, chunkLength: CHUNK_LENGTH, sourceTriangles: 550 * (DENSE_OFFSETS.length - 1) * 2,
    storedTriangles: 0, storedVertices: 0, activeTriangles: 0, activeDrawCalls: 0,
    submittedTriangles: 0, submittedDrawCalls: 0, visibleTriangles: 0, visibleDrawCalls: 0,
    quality: 'high', triangleBudget: SETTINGS.high.triangleBudget, forwardDistance: SETTINGS.high.ahead,
    levels: {near: 0, mid: 0, far: 0}, updates: 0, frustumChecked: false, activeRange: null,
  };

  function section(s, level) {
    // Exact cliff transitions and the foam/water intersection survive every LOD.
    const extra = [];
    if (typeof groundHeight.cliffOffset === 'function') {
      const cliff = groundHeight.cliffOffset(s);
      extra.push(cliff - 5, cliff - 2, cliff, cliff + 3.5, cliff + 13.5, cliff + 58.5);
    }
    if (typeof groundHeight.shoreOffset === 'function') extra.push(groundHeight.shoreOffset(s));
    return unique([...CROSS_SECTIONS[level], ...extra.filter(x => Number.isFinite(x) && x > ROAD_EDGE && x < 170)]);
  }

  function sample(s, offset) {
    let row = cachedRows.get(s);
    if (!row) {row = new Map(); cachedRows.set(s, row);}
    if (row.has(offset)) return row.get(offset);
    const x = pathX(s) + offset, h = groundHeight(x, s);
    if (!Number.isFinite(x) || !Number.isFinite(h)) throw new RangeError(`Invalid terrain sample at ${s}m.`);
    // A shared world-space derivative avoids lighting seams at independent
    // chunk borders, including a border between different detail levels.
    const dx = groundHeight(x + .5, s) - groundHeight(x - .5, s);
    const dz = groundHeight(x, s + .5) - groundHeight(x, s - .5);
    const length = Math.hypot(dx, 1, dz);
    const surface = typeof groundHeight.surfaceAt === 'function' ? groundHeight.surfaceAt(x, s, h) : 0;
    let rgb = [1, 1, 1];
    if (colorAt) {
      const value = colorAt(x, s, h, surface);
      if (Array.isArray(value) || ArrayBuffer.isView(value)) rgb = [value[0], value[1], value[2]];
      else if (value?.isColor) rgb = [value.r, value.g, value.b];
      else if (value !== undefined) {colour.set(value); rgb = [colour.r, colour.g, colour.b];}
    }
    const value = {position: [x, h + SURFACE_OFFSET, s], normal: [-dx / length, 1 / length, -dz / length], colour: rgb, surface};
    if (![...value.position, ...value.normal, ...rgb, surface].every(Number.isFinite)) throw new RangeError(`Invalid terrain attributes at ${s}m.`);
    row.set(offset, value); return value;
  }

  function geometryFor(a, b, level) {
    const positions = [], normals = [], colours = [], uv = [], surfaces = [], indices = [];
    const rowStarts = [], rowCounts = [], rowOffsets = [], rows = [];
    const divisions = Math.ceil((b - a) / STEPS[level]);
    for (let j = 0; j <= divisions; j++) {
      const s = j === divisions ? b : a + (b - a) * j / divisions;
      // All LODs keep the exact same dense boundary row. The strip between
      // sparse and dense rows is triangulated, so there are no T-junction gaps.
      const offsets = section(s, j === 0 || j === divisions ? 'near' : level);
      rows.push(s); rowStarts.push(positions.length / 3); rowCounts.push(offsets.length); rowOffsets.push(offsets);
      for (const offset of offsets) {
        const point = sample(s, offset);
        positions.push(...point.position); normals.push(...point.normal); colours.push(...point.colour);
        uv.push(point.position[0] / 3.4, s / 3.4); surfaces.push(point.surface);
      }
    }
    // Both rows are monotonic across the road, even as the coast meanders.
    // Advancing the next transverse sample gives a complete upward-facing strip.
    for (let j = 0; j < divisions; j++) {
      const top = rowOffsets[j], bottom = rowOffsets[j + 1];
      let i = 0, k = 0;
      while (i < top.length - 1 || k < bottom.length - 1) {
        const p = rowStarts[j] + i, q = rowStarts[j + 1] + k;
        if (k === bottom.length - 1 || (i < top.length - 1 && top[i + 1] <= bottom[k + 1])) {
          indices.push(p, q, p + 1); i++;
        } else {indices.push(p, q, q + 1); k++;}
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('surface', new THREE.Float32BufferAttribute(surfaces, 1));
    geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.terrain = {start: a, end: b, level, rows, rowStarts, rowCounts};
    return geometry;
  }

  for (let a = start; a < end; a += CHUNK_LENGTH) {
    const b = Math.min(a + CHUNK_LENGTH, end), chunk = {start: a, end: b, meshes: {}};
    for (const level of LEVELS) {
      const geometry = geometryFor(a, b, level), mesh = new THREE.Mesh(geometry, material);
      mesh.name = `terrain-${chunks.length}-${level}`; mesh.receiveShadow = true; mesh.castShadow = false;
      mesh.frustumCulled = true; mesh.visible = false; mesh.userData.terrainLOD = level;
      chunk.meshes[level] = mesh; group.add(mesh);
      stats.storedTriangles += geometry.index.count / 3; stats.storedVertices += geometry.attributes.position.count;
    }
    chunks.push(chunk);
    // Retain only the shared last row while building the next chunk. Keeping
    // every temporary sample until the whole course is built wastes phone RAM.
    const boundary = cachedRows.get(b); cachedRows.clear();
    if (boundary) cachedRows.set(b, boundary);
  }
  cachedRows.clear(); stats.chunkCount = chunks.length;
  group.userData.chunks = chunks; group.userData.stats = stats;
  let lastS = Infinity, lastTime = -Infinity, lastQuality = '', disposed = false;

  function update({playerS = 0, quality = 'high', camera, time} = {}) {
    if (disposed) return stats;
    const s = clamp(Number.isFinite(playerS) ? playerS : 0, start, end);
    const mode = Object.hasOwn(SETTINGS, quality) ? quality : 'high';
    const now = Number.isFinite(time) ? time : (globalThis.performance?.now?.() ?? Date.now()) / 1000;
    const settings = SETTINGS[mode];
    const changed = mode !== lastQuality || Math.abs(s - lastS) >= 12 || now - lastTime >= .2 || now < lastTime;
    if (changed) {
      stats.quality = mode; stats.triangleBudget = settings.triangleBudget; stats.forwardDistance = settings.ahead;
      stats.activeTriangles = 0; stats.activeDrawCalls = 0; stats.levels = {near: 0, mid: 0, far: 0}; stats.activeRange = null;
      for (const chunk of chunks) {
        let level;
        if (chunk.end >= s - settings.behind && chunk.start <= s + settings.ahead) {
          const forward = Math.max(0, chunk.start - s), backward = Math.max(0, s - chunk.end);
          level = forward <= settings.near && backward <= settings.nearBehind ? 'near' : forward <= settings.mid ? 'mid' : 'far';
        }
        for (const name of LEVELS) chunk.meshes[name].visible = level === name;
        if (level) {
          const mesh = chunk.meshes[level]; stats.activeTriangles += mesh.geometry.index.count / 3;
          stats.activeDrawCalls++; stats.levels[level]++;
          stats.activeRange = stats.activeRange ? [stats.activeRange[0], chunk.end] : [chunk.start, chunk.end];
        }
      }
      lastS = s; lastTime = now; lastQuality = mode; stats.updates++;
    }
    // THREE performs live frustum culling at render time. Updating the budget
    // independently of the slower LOD selection also follows steering/camera
    // motion without incorrectly hiding a chunk until the next 0.2s tick.
    stats.frustumChecked = Boolean(camera?.isCamera);
    if (stats.frustumChecked) {
      camera.updateWorldMatrix(true, false); group.updateWorldMatrix(true, true);
      projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projectionView, camera.coordinateSystem);
    }
    stats.submittedTriangles = 0; stats.submittedDrawCalls = 0;
    for (const chunk of chunks) for (const level of LEVELS) {
      const mesh = chunk.meshes[level];
      if (group.visible && mesh.visible && (!stats.frustumChecked || frustum.intersectsSphere(sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld)))) {
        stats.submittedTriangles += mesh.geometry.index.count / 3; stats.submittedDrawCalls++;
      }
    }
    stats.visibleTriangles = stats.submittedTriangles; stats.visibleDrawCalls = stats.submittedDrawCalls;
    return stats;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const chunk of chunks) for (const level of LEVELS) chunk.meshes[level].geometry.dispose();
    group.clear();
    stats.activeTriangles = stats.submittedTriangles = stats.visibleTriangles = 0;
    stats.activeDrawCalls = stats.submittedDrawCalls = stats.visibleDrawCalls = 0;
    stats.levels = {near: 0, mid: 0, far: 0}; stats.activeRange = null;
  }

  update({playerS: 0, quality: 'high'});
  return {group, update, stats, dispose};
}
