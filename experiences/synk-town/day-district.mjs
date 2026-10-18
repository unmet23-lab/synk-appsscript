// Baked district swap for side-by-side comparison (2026-10-17/18 Blender tests).
// ?district=<name> replaces only what is drawn with baked GLBs:
//   cafe-<variant>  one district: assets/district/<name>.glb (10-17)
//   town-<variant>  the core town: assets/district/<name>.json lists one GLB per
//                   part (shared ground + buildings), phone-sized files below 600 px
// Walking bounds, solids, floor heights, the open fronts, click targets, support
// surfaces and the name labels all stay the approved v20 ones: the v20 meshes
// are hidden, not removed. Textures may be WebP or KTX2 (KHR_texture_basisu).

export const BAKED_DISTRICTS = Object.freeze({
  cafe: Object.freeze({ placeId: 'cafe', bounds: Object.freeze({ minX: -3.0, maxX: 3.0, minZ: -3.4, maxZ: 5.35 }), groundTop: .25 }),
});
export const BAKED_SETS = Object.freeze({
  town: Object.freeze({ bounds: Object.freeze({ minX: -13.6, maxX: 13.6, minZ: -12.2, maxZ: 8.7 }), groundTop: .25, places: Object.freeze(['home', 'cafe', 'workshop', 'greenhouse']) }),
});

export function districtRequest(search) {
  const name = new URLSearchParams(search).get('district');
  if (!name || !/^[a-z0-9-]{1,40}$/.test(name)) return null;
  const kind = name.split('-')[0];
  if (BAKED_SETS[kind]) return { name, set: true, ...BAKED_SETS[kind], manifest: `./assets/district/${name}.json` };
  const district = BAKED_DISTRICTS[kind];
  return district ? { name, set: false, ...district, url: `./assets/district/${name}.glb` } : null;
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

// GPU bytes of one texture as uploaded: compressed levels as transcoded, or
// RGBA8 with a full mip chain for decoded images.
function textureBytes(texture) {
  if (texture.isCompressedTexture) return (texture.mipmaps || []).reduce((n, level) => n + (level.data?.byteLength || 0), 0);
  const w = texture.image?.width || 0, h = texture.image?.height || 0;
  return Math.round(w * h * 4 * 4 / 3);
}

// The v20 ground is cut along the district rectangle once, on the CPU, and
// small ground instances inside it are parked. The v20 shaders stay untouched:
// a per-fragment discard in the ground shaders cost about 3.5 fps at 1.5x on an
// integrated GPU (no early depth test).
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

// onlyGround: the core-town set replaces walkable flat surfaces only (materials
// day-environment tags userData.townGround); grass, flowers, shrubs, the pond
// and the far underlay stay live. The 10-17 cafe district parks every instance.
function hideDistrictGround(THREE, landscape, b, groundTop, onlyGround = false) {
  const restore = [], m = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const inside = point => point.x > b.minX && point.x < b.maxX && point.z > b.minZ && point.z < b.maxZ;
  const isGround = object => !onlyGround || [object.material].flat().some(material => material?.userData?.townGround);
  let cutMeshes = 0, droppedPieces = 0, parkedInstances = 0;
  landscape.updateMatrixWorld(true);
  landscape.traverse(object => {
    if (!object.isMesh || !isGround(object)) return;
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
    if (onlyGround && box.max.y < -.5) return; // the far underlay a metre under the meadow
    const original = object.geometry, { geometry, dropped } = cutOutRect(THREE, original, object.matrixWorld, b);
    if (!dropped) { geometry.dispose(); return; }
    object.geometry = geometry; cutMeshes++; droppedPieces += dropped;
    restore.push(() => { object.geometry = original; geometry.dispose(); });
  });
  return { restore: () => restore.forEach(fn => fn()), cutMeshes, droppedPieces, parkedInstances };
}

// Converts one loaded GLB scene in place and records its cost.
function adoptBaked(THREE, root, liveGlass, state, drop = []) {
  const textures = new Set(), removed = [];
  // The greenhouse's panes are thinner than window glass in v20 (opacity .16,
  // no depth write); GLBs mark them live_glass_thin.
  let thinGlass = null;
  const glassFor = name => name !== 'live_glass_thin' ? liveGlass
    : thinGlass ||= Object.assign(liveGlass.clone(), { opacity: .16, depthWrite: false });
  root.traverse(object => {
    if (!object.isMesh) return;
    if (drop.some(prefix => object.name.startsWith(prefix))) { removed.push(object); return; }
    const source = object.material;
    if (/^live_glass/.test(source.name)) { object.material = glassFor(source.name); object.castShadow = false; object.receiveShadow = false; source.dispose(); }
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
  for (const object of removed) { object.parent.remove(object); object.geometry.dispose(); [object.material].flat().forEach(m => { m.map?.dispose(); m.dispose(); }); }
  for (const texture of textures) {
    // Atlases never tile: clamping keeps islands at the atlas border from
    // sampling the opposite edge (glTF's default sampler repeats).
    texture.anisotropy = 8; texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    const bytes = textureBytes(texture);
    state.textures.push({ width: texture.image?.width, height: texture.image?.height, compressed: !!texture.isCompressedTexture, format: texture.format, bytes });
    state.textureBytes += bytes;
  }
}

export function swapDistrict({ THREE, world, buildings, liveGlass, replaceVolume, renderer, phone = false }) {
  const request = districtRequest(location.search);
  if (!request) return null;
  const started = performance.now(), hidden = [];
  const hideBuilding = building => building.traverse(object => { if (object.isMesh && !object.isSprite) { object.visible = false; hidden.push(object); } });
  const landscape = world.children.find(child => child.name === 'town-landscape');
  const noGround = { restore() {}, cutMeshes: 0, droppedPieces: 0, parkedInstances: 0 };
  const state = { name: request.name, url: request.set ? request.manifest : request.url, tier: phone ? 'phone' : 'pc', loaded: false, failed: null, parts: [], meshes: 0, triangles: 0, textures: [], textureBytes: 0,
    downloadBytes: 0, loadMs: null, hiddenV20Meshes: 0, cutGroundMeshes: 0, droppedGroundPieces: 0, parkedGroundInstances: 0, prepareMs: null };
  let ground = noGround, attached = [];
  const fail = error => {
    // A missing or broken file restores the approved v20 town untouched.
    state.failed = String(error?.message || error); ground.restore();
    for (const root of attached) root.parent?.remove(root);
    for (const object of hidden) object.visible = true; state.loaded = false; return state;
  };
  // Hide before the first frame so occlusion fading remembers hidden meshes.
  const places = request.set ? request.places : [request.placeId], targets = places.map(id => buildings.find(b => b.userData.placeId === id));
  if (targets.some(b => !b)) return null;
  targets.forEach(hideBuilding);
  ground = landscape ? hideDistrictGround(THREE, landscape, request.bounds, request.groundTop, request.set) : noGround;
  const record = () => Object.assign(state, { hiddenV20Meshes: hidden.length, cutGroundMeshes: ground.cutMeshes, droppedGroundPieces: ground.droppedPieces, parkedGroundInstances: ground.parkedInstances });
  record(); state.prepareMs = Math.round(performance.now() - started);
  const sized = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`${url} responded with ${response.status}`); const buffer = await response.arrayBuffer(); state.downloadBytes += buffer.byteLength; return buffer; };
  // The loaders are fetched only when a baked district is requested; v20 never downloads them.
  const ready = Promise.all([import('./rendering/GLTFLoader.js'), import('./rendering/KTX2Loader.js'), import('./rendering/meshopt_decoder.module.js'), request.set ? fetch(request.manifest).then(r => { if (!r.ok) throw new Error(`${request.manifest} responded with ${r.status}`); return r.json(); }) : null])
    .then(async ([{ GLTFLoader }, { KTX2Loader }, { MeshoptDecoder }, manifest]) => {
      const ktx2 = new KTX2Loader().setTranscoderPath('./rendering/basis/'); if (renderer) ktx2.detectSupport(renderer);
      const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
      const base = new URL('./assets/district/', location.href);
      const parts = request.set ? manifest.parts.map(part => ({ ...part, url: new URL((phone && part.phone) || part.url, base).href }))
        : [{ id: request.placeId, placeId: request.placeId, url: new URL(request.url, location.href).href }];
      // A set must bring every part it hid: the shared ground and each building.
      if (request.set) for (const id of ['ground', ...request.places]) if (!parts.some(part => part.id === id)) throw new Error('manifest lacks ' + id);
      const loaded = await Promise.all(parts.map(async part => ({ part, gltf: await loader.parseAsync(await sized(part.url), part.url.replace(/[^/]*$/, '')) })));
      ktx2.dispose();
      for (const { part, gltf } of loaded) {
        const root = gltf.scene; root.name = `town-${part.id}-baked`;
        const before = { meshes: state.meshes, triangles: state.triangles, textureBytes: state.textureBytes };
        adoptBaked(THREE, root, liveGlass, state, part.drop || []);
        // GLB vertices are in Town world space; parents carry their own transform.
        const building = part.placeId && buildings.find(b => b.userData.placeId === part.placeId);
        const parent = building || world;
        parent.updateMatrixWorld(true); root.applyMatrix4(parent.matrixWorld.clone().invert());
        parent.add(root); root.updateMatrixWorld(true); attached.push(root);
        if (building) replaceVolume?.(building);
        state.parts.push({ id: part.id, meshes: state.meshes - before.meshes, triangles: state.triangles - before.triangles, textureBytes: state.textureBytes - before.textureBytes });
      }
      state.loaded = true; state.loadMs = Math.round(performance.now() - started);
      return state;
    }).catch(fail);
  return { ready, stats: () => ({ ...state, parts: state.parts.map(p => ({ ...p })), textures: state.textures.map(t => ({ ...t })) }) };
}
