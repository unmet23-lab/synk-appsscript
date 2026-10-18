// Browser-side static export of the approved v20 Town for the core-town bake.
// Same flat reference format as ../blender-district-20261017/export-browser.js
// (world-space triangles, normals, v20 UVs, vertex colours, one flat material
// per source material named <key>_<hex>_r<rough>_m<metal>[_t<opacity>]), split
// into parts:
//   home / cafe / workshop / greenhouse — every mesh of town-<place>
//   ground — the walkable flat surfaces of town-landscape inside CORE (large
//            meshes split by triangle centroid, instanced stones by position)
//   faded  — roots Town fades out with their shadows when they come between the
//            camera and the player (street benches, planters, trees: occlusionRoots
//            in day-environment.mjs). Never bake occluders: a baked shadow would
//            stay on the ground while v20 hides the object (10-18).
//   live   — everything else Town builds: grass, flowers, shrubs, the outer ring,
//            the far underlay (bake occluders only)
// Material keys come from Town's shared `m` or from the capture-time
// userData.synkKey patch in export-town.cjs.
globalThis.__exportCoreTown = async function exportCoreTown(core) {
  const { THREE, world, m } = globalThis.__townDebug;
  const shared = new Map(Object.entries(m).map(([k, v]) => [v, k]));
  const keyOf = mat => shared.get(mat) || mat.userData?.synkKey || mat.name || 'env';
  const PLACES = ['home', 'cafe', 'workshop', 'greenhouse'];
  // Ground materials: walkable surfaces that the bake replaces. Everything with
  // another key in town-landscape stays live (grass, foliage, flowers, bark...).
  const GROUND_KEYS = new Set(['terrainMaterial', 'paving', 'stone', 'mortar', 'gravel', 'gardenSoil', 'cliffMaterial']);
  const inCore = (x, z) => x >= core.minX && x <= core.maxX && z >= core.minZ && z <= core.maxZ;
  const PARTS_OUT = [...PLACES, 'ground', 'live', 'faded'];
  const out = Object.fromEntries(PARTS_OUT.map(k => [k, new Map()]));
  const report = Object.fromEntries(PARTS_OUT.map(k => [k, { meshes: 0, triangles: 0, sources: {} }]));
  const groundInstances = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), normalMatrix = new THREE.Matrix3(), instance = new THREE.Matrix4(), full = new THREE.Matrix4(), color = new THREE.Color();
  // v20 colour maps (wood grain, plaster, stone, terrain fibres) go out as PNG
  // files map_<n>.png; the material name ends in _x<n> and the exported UVs
  // already include the map's offset/repeat/rotation, flipped to glTF's top-left.
  const maps = new Map(), mapFiles = {};
  function mapIndex(mat) {
    const tex = mat.map;
    if (!tex || !tex.image) return null;
    if (!maps.has(tex.uuid)) {
      const img = tex.image, w = img.width || img.videoWidth, h = img.height || img.videoHeight;
      if (!w || !h) return null;
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (img.data) { const data = new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, w * h * 4), w, h); ctx.putImageData(data, 0, 0); }
      else ctx.drawImage(img, 0, 0, w, h);
      const index = maps.size; tex.updateMatrix();
      maps.set(tex.uuid, { index, matrix: tex.matrix.elements.slice(), flipY: tex.flipY !== false });
      mapFiles[`map_${index}.png`] = canvas.toDataURL('image/png').split(',')[1];
    }
    return maps.get(tex.uuid);
  }
  function materialName(mat) {
    const hex = mat.color ? mat.color.getHexString() : 'ffffff', map = mapIndex(mat);
    return `${keyOf(mat)}_${hex}_r${Math.round((mat.roughness ?? 1) * 100)}_m${Math.round((mat.metalness ?? 0) * 100)}${mat.transparent ? '_t' + Math.round(mat.opacity * 100) : ''}${map ? '_x' + map.index : ''}`;
  }
  function bucket(target, mat) {
    const name = materialName(mat);
    if (!target.has(name)) target.set(name, { mat, positions: [], normals: [], uvs: [], colors: [], hasUv: false });
    return target.get(name);
  }
  function push(part, geo, matrix, tint, filter, mat) {
    const target = out[part], pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, col = geo.attributes.color, idx = geo.index;
    normalMatrix.getNormalMatrix(matrix);
    const count = idx ? idx.count : pos.count, triangles = [];
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map(k => idx ? idx.getX(i + k) : i + k);
      const pts = ids.map(id => v.fromBufferAttribute(pos, id).applyMatrix4(matrix).clone());
      const cx = (pts[0].x + pts[1].x + pts[2].x) / 3, cy = (pts[0].y + pts[1].y + pts[2].y) / 3, cz = (pts[0].z + pts[1].z + pts[2].z) / 3;
      if (filter && !filter(cx, cy, cz, pts)) continue;
      triangles.push([ids, pts]);
    }
    if (!triangles.length) return 0;
    const b = bucket(target, mat), map = mapIndex(mat), e = map?.matrix;
    for (const [ids, pts] of triangles) for (let k = 0; k < 3; k++) {
      const id = ids[k], p = pts[k]; b.positions.push(p.x, p.y, p.z);
      if (nor) { n.fromBufferAttribute(nor, id).applyMatrix3(normalMatrix).normalize(); b.normals.push(n.x, n.y, n.z); } else b.normals.push(0, 1, 0);
      if (uv) {
        let u = uv.getX(id), w = uv.getY(id);
        if (e) { const tu = e[0] * u + e[3] * w + e[6], tw = e[1] * u + e[4] * w + e[7]; u = tu; w = tw; }
        b.uvs.push(u, map && !map.flipY ? w : 1 - w); b.hasUv = true;
      } else b.uvs.push(0, 0);
      // Geometry colours count only when the material draws them (planted beds
      // carry a soil→lawn colour attribute that v20's material ignores; baked,
      // it showed as a yellow wedge band, 10-18). Instance tints always count.
      color.setRGB(1, 1, 1); if (col && mat.vertexColors) color.fromBufferAttribute(col, id); if (tint) color.multiply(tint); b.colors.push(color.r, color.g, color.b);
    }
    report[part].triangles += triangles.length;
    const source = materialName(mat); report[part].sources[source] = (report[part].sources[source] || 0) + triangles.length;
    return triangles.length;
  }
  world.updateMatrixWorld(true);
  for (const root of world.children) {
    if (!root.name.startsWith('town-')) continue;
    const place = PLACES.find(p => root.name === 'town-' + p);
    const landscape = root.name === 'town-landscape';
    const faded = /^town-(street-bench|street-planter|tree)-/.test(root.name);
    root.traverse(object => {
      if (!object.isMesh || object.isSprite || !object.geometry?.attributes?.position) return;
      if (object.material?.isSpriteMaterial || object.material?.isShaderMaterial) return;
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      if (mats.length !== 1) return;
      const mat = mats[0], key = keyOf(mat), groundKey = landscape && GROUND_KEYS.has(key);
      const add = (matrix, tint, centre, instanceIndex) => {
        if (place) return push(place, object.geometry, matrix, tint, null, mat);
        if (faded) return push('faded', object.geometry, matrix, tint, null, mat);
        if (!groundKey) return push('live', object.geometry, matrix, tint, null, mat);
        object.geometry.computeBoundingSphere();
        const radius = object.geometry.boundingSphere.radius * matrix.getMaxScaleOnAxis();
        // The far underlay sits a metre under the meadow (y ≈ −1): never baked.
        const above = y => y > -.5;
        if (radius > 1.2) {
          // Every triangle that touches the core goes to the ground (Blender cuts
          // it at the rectangle); by centroid alone, big lawn triangles across the
          // edge were lost and Town showed holes along the border (10-18).
          const touches = pts => !(Math.max(...pts.map(p => p.x)) <= core.minX || Math.min(...pts.map(p => p.x)) >= core.maxX || Math.max(...pts.map(p => p.z)) <= core.minZ || Math.min(...pts.map(p => p.z)) >= core.maxZ);
          push('ground', object.geometry, matrix, tint, (x, y, z, pts) => touches(pts) && above(y), mat);
          push('live', object.geometry, matrix, tint, (x, y, z) => !inCore(x, z) || !above(y), mat);
        } else if (inCore(centre.x, centre.z) && above(centre.y)) {
          push('ground', object.geometry, matrix, tint, null, mat);
          if (instanceIndex != null) groundInstances.push({ mesh: object.name || object.uuid, key, index: instanceIndex });
        } else push('live', object.geometry, matrix, tint, null, mat);
      };
      if (object.isInstancedMesh) {
        const centre = new THREE.Vector3();
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, instance); full.multiplyMatrices(object.matrixWorld, instance);
          const tint = object.instanceColor ? new THREE.Color().fromBufferAttribute(object.instanceColor, i) : null;
          centre.setFromMatrixPosition(full); add(full.clone(), tint, centre.clone(), i);
        }
      } else add(object.matrixWorld.clone(), null, new THREE.Vector3().setFromMatrixPosition(object.matrixWorld), null);
    });
  }
  function glb(buckets) {
    const gltf = { asset: { version: '2.0', generator: 'SYNK Town v20 core-town reference export 2026-10-18' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] };
    const chunks = []; let offset = 0;
    const view = (array, target) => { const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), pad = (4 - bytes.length % 4) % 4; gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target }); chunks.push(bytes, new Uint8Array(pad)); offset += bytes.length + pad; return gltf.bufferViews.length - 1; };
    const accessor = (array, type, bounds) => { const size = { VEC2: 2, VEC3: 3 }[type], a = { bufferView: view(array, 34962), componentType: 5126, count: array.length / size, type }; if (bounds) { a.min = [Infinity, Infinity, Infinity]; a.max = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < array.length; i += 3) for (let k = 0; k < 3; k++) { a.min[k] = Math.min(a.min[k], array[i + k]); a.max[k] = Math.max(a.max[k], array[i + k]); } } gltf.accessors.push(a); return gltf.accessors.length - 1; };
    let meshes = 0;
    for (const [name, b] of buckets) {
      if (!b.positions.length) continue;
      const c = b.mat.color || new THREE.Color(1, 1, 1);
      gltf.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [c.r, c.g, c.b, b.mat.transparent ? b.mat.opacity : 1], roughnessFactor: b.mat.roughness ?? 1, metallicFactor: b.mat.metalness ?? 0 }, doubleSided: b.mat.side === THREE.DoubleSide, ...(b.mat.transparent ? { alphaMode: 'BLEND' } : {}), extras: { sourceKey: keyOf(b.mat), hasMap: !!b.mat.map, vertexColors: !!b.mat.vertexColors } });
      const attributes = { POSITION: accessor(new Float32Array(b.positions), 'VEC3', true), NORMAL: accessor(new Float32Array(b.normals), 'VEC3'), COLOR_0: accessor(new Float32Array(b.colors), 'VEC3') };
      if (b.hasUv) attributes.TEXCOORD_0 = accessor(new Float32Array(b.uvs), 'VEC2');
      gltf.meshes.push({ name, primitives: [{ attributes, material: gltf.materials.length - 1 }] });
      gltf.nodes.push({ name, mesh: gltf.meshes.length - 1 }); gltf.scenes[0].nodes.push(gltf.nodes.length - 1); meshes++;
    }
    gltf.buffers[0].byteLength = offset;
    const json = new TextEncoder().encode(JSON.stringify(gltf)), jsonPad = (4 - json.length % 4) % 4;
    const total = 12 + 8 + json.length + jsonPad + 8 + offset, bytes = new Uint8Array(total), dv = new DataView(bytes.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, json.length + jsonPad, true); dv.setUint32(16, 0x4E4F534A, true); bytes.set(json, 20); bytes.fill(0x20, 20 + json.length, 20 + json.length + jsonPad);
    let at = 20 + json.length + jsonPad; dv.setUint32(at, offset, true); dv.setUint32(at + 4, 0x004E4942, true); at += 8;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { base64: btoa(binary), meshes };
  }
  const files = {};
  for (const part of Object.keys(out)) { const r = glb(out[part]); files[part] = r.base64; report[part].meshes = r.meshes; }
  return { files, mapFiles, report, groundInstances: groundInstances.length };
};
