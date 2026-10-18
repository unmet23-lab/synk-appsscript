// Baked district swap for side-by-side comparison (2026-10-17 Blender test).
// ?district=<name> replaces only what is drawn for one district with
// assets/district/<name>.glb. Walking bounds, solids, floor heights, the open
// tea-room front, click targets, support surfaces and the name label all stay
// the approved v20 ones: the v20 meshes are hidden, not removed.

export const BAKED_DISTRICTS = Object.freeze({
  cafe: Object.freeze({ placeId: 'cafe', bounds: Object.freeze({ minX: -3.0, maxX: 3.0, minZ: -3.4, maxZ: 5.35 }), groundTop: .25 }),
});

export function districtRequest(search) {
  const name = new URLSearchParams(search).get('district');
  if (!name || !/^[a-z0-9-]{1,40}$/.test(name)) return null;
  const district = BAKED_DISTRICTS[name.split('-')[0]];
  return district ? { name, ...district, url: `./assets/district/${name}.glb` } : null;
}

// Lambert with a black diffuse colour draws nothing from real-time light; the
// baked radiance is the emissive term. The map's alpha is the share of direct
// sun in the bake, so live shadows (characters) darken only lit texels and the
// shade already baked is never darkened twice.
function bakedMaterial(THREE, source) {
  const scale = Number(source.userData?.synk_bake_scale) || 1, sunAlpha = Number(source.userData?.synk_sun_alpha) === 1;
  const material = new THREE.MeshLambertMaterial({ name: source.name, color: 0x000000, emissive: 0xffffff, emissiveIntensity: scale, emissiveMap: source.map || null, side: source.side });
  if (sunAlpha && source.map) {
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_EMISSIVEMAP\n\ttotalEmissiveRadiance *= 1.0 - emissiveColor.a * ( 1.0 - getShadowMask() );\n#endif');
    };
    material.customProgramCacheKey = () => 'synk-baked-sun-share-v1';
  }
  material.userData.townBaked = true;
  return material;
}

// The v20 ground is cut along the district rectangle once, on the CPU, and
// small ground instances (grass, flowers, pebbles) inside it are parked.
// The v20 shaders stay untouched: a per-fragment discard in the ground
// shaders cost about 3.5 fps at 1.5x on an integrated GPU (no early depth test).
function cutOutRect(THREE, geometry, matrixWorld, b) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const names = Object.keys(g.attributes), sizes = names.map(n => g.attributes[n].itemSize), position = g.attributes.position;
  const out = names.map(() => []), v = new THREE.Vector3();
  const vertex = i => { v.fromBufferAttribute(position, i).applyMatrix4(matrixWorld); return { x: v.x, z: v.z, a: names.map((n, k) => { const at = g.attributes[n], row = []; for (let c = 0; c < sizes[k]; c++) row.push(at.getComponent(i, c)); return row; }) }; };
  const mix = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t, a: p.a.map((row, k) => row.map((c, j) => c + (q.a[k][j] - c) * t)) });
  const split = (poly, axis, value) => {
    const lo = [], hi = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], dp = p[axis] - value, dq = q[axis] - value;
      if (dp <= 0) lo.push(p);
      if (dp >= 0) hi.push(p);
      if (dp * dq < 0) { const m = mix(p, q, dp / (dp - dq)); lo.push(m); hi.push(m); }
    }
    return [lo, hi].filter(piece => piece.length >= 3);
  };
  const emit = poly => { for (let i = 1; i + 1 < poly.length; i++) for (const p of [poly[0], poly[i], poly[i + 1]]) p.a.forEach((row, k) => out[k].push(...row)); };
  let dropped = 0;
  for (let t = 0; t < position.count; t += 3) {
    const tri = [vertex(t), vertex(t + 1), vertex(t + 2)];
    const xs = tri.map(p => p.x), zs = tri.map(p => p.z);
    if (Math.max(...xs) <= b.minX || Math.min(...xs) >= b.maxX || Math.max(...zs) <= b.minZ || Math.min(...zs) >= b.maxZ) { emit(tri); continue; }
    let pieces = [tri];
    for (const [axis, value] of [['x', b.minX], ['x', b.maxX], ['z', b.minZ], ['z', b.maxZ]]) pieces = pieces.flatMap(piece => split(piece, axis, value));
    for (const piece of pieces) {
      const cx = piece.reduce((n, p) => n + p.x, 0) / piece.length, cz = piece.reduce((n, p) => n + p.z, 0) / piece.length;
      if (cx > b.minX && cx < b.maxX && cz > b.minZ && cz < b.maxZ) { dropped++; continue; }
      emit(piece);
    }
  }
  const cut = new THREE.BufferGeometry();
  names.forEach((n, k) => cut.setAttribute(n, new THREE.Float32BufferAttribute(out[k], sizes[k], g.attributes[n].normalized)));
  if (g !== geometry) g.dispose();
  return { geometry: cut, dropped };
}

function hideDistrictGround(THREE, landscape, b, groundTop) {
  const restore = [], m = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // Instances (grass, flowers, pebbles) are parked by footprint at any height,
  // matching the reference export; meshes are cut only at ground level.
  const inside = point => point.x > b.minX && point.x < b.maxX && point.z > b.minZ && point.z < b.maxZ;
  let cutMeshes = 0, droppedPieces = 0, parkedInstances = 0;
  landscape.updateMatrixWorld(true);
  landscape.traverse(object => {
    if (!object.isMesh) return;
    if (object.isInstancedMesh) {
      const parked = [];
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, m); p.setFromMatrixPosition(m).applyMatrix4(object.matrixWorld);
        if (inside(p)) { parked.push([i, m.clone()]); object.setMatrixAt(i, zero); }
      }
      if (parked.length) {
        object.instanceMatrix.needsUpdate = true; object.computeBoundingSphere(); parkedInstances += parked.length;
        restore.push(() => { for (const [i, original] of parked) object.setMatrixAt(i, original); object.instanceMatrix.needsUpdate = true; object.computeBoundingSphere(); });
      }
      return;
    }
    object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
    if (box.max.x <= b.minX || box.min.x >= b.maxX || box.max.z <= b.minZ || box.min.z >= b.maxZ || box.min.y >= groundTop) return;
    const original = object.geometry, { geometry, dropped } = cutOutRect(THREE, original, object.matrixWorld, b);
    if (!dropped) { geometry.dispose(); return; }
    object.geometry = geometry; cutMeshes++; droppedPieces += dropped;
    restore.push(() => { object.geometry = original; geometry.dispose(); });
  });
  return { restore: () => restore.forEach(fn => fn()), cutMeshes, droppedPieces, parkedInstances };
}

export function swapDistrict({ THREE, world, buildings, liveGlass, replaceVolume }) {
  const request = districtRequest(location.search), building = request && buildings.find(b => b.userData.placeId === request.placeId);
  if (!request || !building) return null;
  const started = performance.now(), hidden = [];
  // Hide before the first frame so occlusion fading remembers hidden meshes.
  building.traverse(object => { if (object.isMesh && !object.isSprite) { object.visible = false; hidden.push(object); } });
  const landscape = world.children.find(child => child.name === 'town-landscape');
  const ground = landscape ? hideDistrictGround(THREE, landscape, request.bounds, request.groundTop) : { restore() {}, cutMeshes: 0, droppedPieces: 0, parkedInstances: 0 };
  const state = { name: request.name, url: request.url, loaded: false, failed: null, meshes: 0, triangles: 0, textures: [], loadMs: null, hiddenV20Meshes: hidden.length,
    cutGroundMeshes: ground.cutMeshes, droppedGroundPieces: ground.droppedPieces, parkedGroundInstances: ground.parkedInstances, prepareMs: Math.round(performance.now() - started) };
  // The loader is fetched only when a baked district is requested; v20 never downloads it.
  const ready = import('./rendering/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(request.url)).then(gltf => {
    const root = gltf.scene; root.name = 'town-' + request.placeId + '-baked';
    const textures = new Set();
    root.traverse(object => {
      if (!object.isMesh) return;
      const source = object.material;
      if (source.name === 'live_glass') { object.material = liveGlass; object.castShadow = false; object.receiveShadow = false; source.dispose(); }
      else {
        object.material = bakedMaterial(THREE, source); if (source.map) textures.add(source.map);
        if (/roof/.test(object.name)) object.material.userData.townSurface = 'roof';
        // Ground does not need to cast; structure keeps shading characters and
        // the v20 lawn just outside the district.
        object.castShadow = !/ground/.test(object.name); object.receiveShadow = true;
        source.dispose();
      }
      state.meshes++; state.triangles += (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) / 3;
    });
    for (const texture of textures) { texture.anisotropy = 8; state.textures.push({ width: texture.image?.width, height: texture.image?.height }); }
    building.add(root); root.updateMatrixWorld(true);
    replaceVolume?.(building);
    state.loaded = true; state.loadMs = Math.round(performance.now() - started);
    return state;
  }).catch(error => {
    // A missing or broken file restores the approved v20 district untouched.
    state.failed = String(error?.message || error); ground.restore();
    for (const object of hidden) object.visible = true; return state;
  });
  return { ready, stats: () => ({ ...state }) };
}
