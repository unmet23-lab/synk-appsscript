// The road and the shore use the same height function as the original terrain.
// Only the number of triangles submitted beyond the driving view changes.
import {buildCourseTerrainData, CHUNK_LENGTH, LEVELS, SOURCE_TRIANGLES} from './terrain-data.js';
const SETTINGS = Object.freeze({
  high: Object.freeze({near: 250, nearBehind: 70, mid: 650, ahead: 1500, behind: 150, triangleBudget: 46000}),
  balanced: Object.freeze({near: 150, nearBehind: 35, mid: 450, ahead: 1300, behind: 110, triangleBudget: 35000}),
  low: Object.freeze({near: 75, nearBehind: 25, mid: 300, ahead: 1100, behind: 75, triangleBudget: 26000}),
});
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
/**
 * Geometry remains in world coordinates for the existing terrain shader.
 * colorAt(x,z,height,surface) may return linear RGB, a THREE.Color or a hex color.
 * Material ownership stays with the caller; dispose() releases only this geometry.
 * update accepts optional camera/time for frustum statistics and deterministic QA.
 */
export function buildCourseTerrain(THREE, {pathX, groundHeight, ROAD_END = 2250, material, colorAt, prepared} = {}) {
  if (!THREE || typeof pathX !== 'function' || typeof groundHeight !== 'function' || !material?.isMaterial) {
    throw new TypeError('Course terrain needs THREE, the current path/height functions and a material.');
  }
  if (!Number.isFinite(ROAD_END) || ROAD_END < 100) throw new RangeError('ROAD_END must be at least 100m.');
  if (colorAt !== undefined && typeof colorAt !== 'function') throw new TypeError('colorAt must be a function.');
  // Validate before allocating scene objects. A failed worker payload can safely
  // fall back to the same generator without leaving a partial terrain behind.
  if (prepared !== undefined) validateTerrainData(prepared, ROAD_END);

  const start = -150, end = ROAD_END + 350;
  const group = new THREE.Group(); group.name = 'course-terrain';
  const chunks = [], colour = new THREE.Color();
  const terrainData = prepared ?? buildCourseTerrainData({pathX, groundHeight, ROAD_END, colorAt: colorAt && ((...args) => {
    const value = colorAt(...args);
    if (Array.isArray(value) || ArrayBuffer.isView(value)) return value;
    if (value?.isColor) return [value.r, value.g, value.b];
    if (value === undefined) return [1, 1, 1];
    colour.set(value); return [colour.r, colour.g, colour.b];
  })});
  const frustum = new THREE.Frustum(), projectionView = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const stats = {
    chunkCount: 0, chunkLength: CHUNK_LENGTH, sourceTriangles: SOURCE_TRIANGLES,
    storedTriangles: 0, storedVertices: 0, activeTriangles: 0, activeDrawCalls: 0,
    submittedTriangles: 0, submittedDrawCalls: 0, visibleTriangles: 0, visibleDrawCalls: 0,
    quality: 'high', triangleBudget: SETTINGS.high.triangleBudget, forwardDistance: SETTINGS.high.ahead,
    levels: {near: 0, mid: 0, far: 0}, updates: 0, frustumChecked: false, activeRange: null,
  };

  function geometryFor(level) {
    const data = terrainData.geometries[chunks.length * LEVELS.length + LEVELS.indexOf(level)];
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(data.attributes)) geometry.setAttribute(name, new THREE.BufferAttribute(attribute.array, attribute.itemSize));
    geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(data.box[0]), new THREE.Vector3().fromArray(data.box[1]));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(data.sphere[0]), data.sphere[1]);
    geometry.userData.terrain = data.terrain;
    return geometry;
  }

  for (let a = start; a < end; a += CHUNK_LENGTH) {
    const b = Math.min(a + CHUNK_LENGTH, end), chunk = {start: a, end: b, meshes: {}};
    for (const level of LEVELS) {
      const geometry = geometryFor(level), mesh = new THREE.Mesh(geometry, material);
      mesh.name = `terrain-${chunks.length}-${level}`; mesh.receiveShadow = true; mesh.castShadow = false;
      mesh.frustumCulled = true; mesh.visible = false; mesh.userData.terrainLOD = level;
      chunk.meshes[level] = mesh; group.add(mesh);
      stats.storedTriangles += geometry.index.count / 3; stats.storedVertices += geometry.attributes.position.count;
    }
    chunks.push(chunk);
  }
  stats.chunkCount = chunks.length;
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

// Only typed geometry arrays cross the worker boundary. Materials, textures,
// LOD visibility, random scene state and renderer ownership stay on the main thread.
export function serializeCourseTerrain(world, ROAD_END) {
  return {version: 1, roadEnd: ROAD_END, geometries: world.group.children.map(({geometry}) => ({
    attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, {array: attribute.array, itemSize: attribute.itemSize}])),
    index: geometry.index.array, terrain: geometry.userData.terrain,
    box: [geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray()],
    sphere: [geometry.boundingSphere.center.toArray(), geometry.boundingSphere.radius],
  }))};
}

function validateTerrainData(data, roadEnd) {
  const fail = () => {throw new TypeError('Invalid prepared course terrain.');};
  const count = Math.ceil((roadEnd + 500) / CHUNK_LENGTH) * LEVELS.length;
  if (data?.version !== 1 || data.roadEnd !== roadEnd || !Array.isArray(data.geometries) || data.geometries.length !== count) fail();
  data.geometries.forEach((geometry, i) => {
    const start = -150 + Math.floor(i / LEVELS.length) * CHUNK_LENGTH;
    if (geometry?.terrain?.start !== start || geometry.terrain.end !== Math.min(start + CHUNK_LENGTH, roadEnd + 350) || geometry.terrain.level !== LEVELS[i % LEVELS.length]) fail();
    const vertices = geometry.attributes?.position?.array?.length / 3;
    if (!Number.isInteger(vertices) || vertices <= 0) fail();
    for (const [name, itemSize] of Object.entries({position: 3, normal: 3, color: 3, uv: 2, surface: 1})) {
      const attribute = geometry.attributes[name];
      if (!(attribute?.array instanceof Float32Array) || attribute.itemSize !== itemSize || attribute.array.length !== vertices * itemSize) fail();
    }
    if (!(geometry.index instanceof Uint16Array || geometry.index instanceof Uint32Array) || !geometry.index.length || geometry.index.length % 3) fail();
    if (geometry.box?.length !== 2 || geometry.sphere?.length !== 2 || !(geometry.sphere[1] > 0) || !Number.isFinite(geometry.sphere[1])) fail();
    for (const point of [...geometry.box, geometry.sphere[0]]) if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) fail();
  });
}
