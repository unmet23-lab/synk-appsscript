// Browser-side static export of the approved v20 Town environment.
// Reference only: world-space triangles, normals, UVs and vertex colours, plus
// a flat glTF material per source material (colour/roughness/metalness and the
// source material key). No textures, no lights. The district file is the cafe
// pavilion plus every ground triangle whose centroid lies inside the box; the
// surroundings file is everything else that Town builds (bake occluders).
globalThis.__exportTown = async function exportTown(box) {
  const { THREE, world, m } = globalThis.__townDebug;
  const materialKeys = new Map(Object.entries(m).map(([k, v]) => [v, k]));
  const inBox = (x, z) => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
  const out = { district: new Map(), surroundings: new Map() }, report = { district: { meshes: 0, triangles: 0, sources: {} }, surroundings: { meshes: 0, triangles: 0 } };
  const v = new THREE.Vector3(), n = new THREE.Vector3(), normalMatrix = new THREE.Matrix3(), instance = new THREE.Matrix4(), full = new THREE.Matrix4(), color = new THREE.Color();
  function materialName(mat) {
    const key = materialKeys.get(mat) || (mat.name ? mat.name : null);
    const hex = mat.color ? mat.color.getHexString() : 'ffffff';
    return `${key || 'env'}_${hex}_r${Math.round((mat.roughness ?? 1) * 100)}_m${Math.round((mat.metalness ?? 0) * 100)}${mat.transparent ? '_t' + Math.round(mat.opacity * 100) : ''}`;
  }
  function bucket(target, mat) {
    const name = materialName(mat);
    if (!target.has(name)) target.set(name, { mat, positions: [], normals: [], uvs: [], colors: [], hasUv: false });
    return target.get(name);
  }
  function pushTriangles(target, geo, matrix, tint, filter, label) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, col = geo.attributes.color, idx = geo.index;
    normalMatrix.getNormalMatrix(matrix);
    const count = idx ? idx.count : pos.count, triangles = [];
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map(k => idx ? idx.getX(i + k) : i + k);
      const world = ids.map(id => v.fromBufferAttribute(pos, id).applyMatrix4(matrix).clone());
      const cx = (world[0].x + world[1].x + world[2].x) / 3, cz = (world[0].z + world[1].z + world[2].z) / 3;
      if (filter && !filter(cx, cz)) continue;
      triangles.push([ids, world]);
    }
    if (!triangles.length) return 0;
    const b = bucket(target, label.mat);
    for (const [ids, worldPoints] of triangles) for (let k = 0; k < 3; k++) {
      const id = ids[k], p = worldPoints[k]; b.positions.push(p.x, p.y, p.z);
      if (nor) { n.fromBufferAttribute(nor, id).applyMatrix3(normalMatrix).normalize(); b.normals.push(n.x, n.y, n.z); } else b.normals.push(0, 1, 0);
      if (uv) { b.uvs.push(uv.getX(id), 1 - uv.getY(id)); b.hasUv = true; } else b.uvs.push(0, 0);
      color.setRGB(1, 1, 1); if (col) color.fromBufferAttribute(col, id); if (tint) color.multiply(tint); b.colors.push(color.r, color.g, color.b);
    }
    return triangles.length;
  }
  world.updateMatrixWorld(true);
  for (const root of world.children) {
    if (!root.name.startsWith('town-')) continue;
    const isCafe = root.name === 'town-cafe';
    root.traverse(object => {
      if (!object.isMesh || object.isSprite || !object.geometry?.attributes?.position) return;
      if (object.material?.isSpriteMaterial || object.material?.isShaderMaterial) return;
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      if (mats.length !== 1) return;
      const mat = mats[0];
      const add = (matrix, tint, centre) => {
        if (isCafe) { const t = pushTriangles(out.district, object.geometry, matrix, tint, null, { mat }); report.district.triangles += t; report.district.sources[root.name] = (report.district.sources[root.name] || 0) + t; return; }
        // Large ground meshes are split by triangle centroid. Small objects go whole.
        object.geometry.computeBoundingSphere();
        const radius = object.geometry.boundingSphere.radius * matrix.getMaxScaleOnAxis();
        if (radius > 1.2) {
          const a = pushTriangles(out.district, object.geometry, matrix, tint, inBox, { mat }); report.district.triangles += a; if (a) report.district.sources[root.name + ':' + materialName(mat)] = (report.district.sources[root.name + ':' + materialName(mat)] || 0) + a;
          report.surroundings.triangles += pushTriangles(out.surroundings, object.geometry, matrix, tint, (x, z) => !inBox(x, z), { mat });
        } else if (inBox(centre.x, centre.z)) {
          const a = pushTriangles(out.district, object.geometry, matrix, tint, null, { mat }); report.district.triangles += a; report.district.sources[root.name + ':' + materialName(mat)] = (report.district.sources[root.name + ':' + materialName(mat)] || 0) + a;
        } else report.surroundings.triangles += pushTriangles(out.surroundings, object.geometry, matrix, tint, null, { mat });
      };
      if (object.isInstancedMesh) {
        const centre = new THREE.Vector3();
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, instance); full.multiplyMatrices(object.matrixWorld, instance);
          const tint = object.instanceColor ? new THREE.Color().fromBufferAttribute(object.instanceColor, i) : null;
          centre.setFromMatrixPosition(full); add(full.clone(), tint, centre.clone());
        }
      } else add(object.matrixWorld.clone(), null, new THREE.Vector3().setFromMatrixPosition(object.matrixWorld));
    });
  }
  function glb(buckets) {
    const gltf = { asset: { version: '2.0', generator: 'SYNK Town v20 reference export 2026-10-17' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] };
    const chunks = []; let offset = 0;
    const view = (array, target) => { const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), pad = (4 - bytes.length % 4) % 4; gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target }); chunks.push(bytes, new Uint8Array(pad)); offset += bytes.length + pad; return gltf.bufferViews.length - 1; };
    const accessor = (array, type, bounds) => { const size = { VEC2: 2, VEC3: 3 }[type], a = { bufferView: view(array, 34962), componentType: 5126, count: array.length / size, type }; if (bounds) { a.min = [Infinity, Infinity, Infinity]; a.max = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < array.length; i += 3) for (let k = 0; k < 3; k++) { a.min[k] = Math.min(a.min[k], array[i + k]); a.max[k] = Math.max(a.max[k], array[i + k]); } } gltf.accessors.push(a); return gltf.accessors.length - 1; };
    let meshes = 0;
    for (const [name, b] of buckets) {
      if (!b.positions.length) continue;
      const c = b.mat.color || new THREE.Color(1, 1, 1);
      gltf.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [c.r, c.g, c.b, b.mat.transparent ? b.mat.opacity : 1], roughnessFactor: b.mat.roughness ?? 1, metallicFactor: b.mat.metalness ?? 0 }, doubleSided: b.mat.side === THREE.DoubleSide, ...(b.mat.transparent ? { alphaMode: 'BLEND' } : {}), extras: { sourceKey: materialKeys.get(b.mat) || null, hasMap: !!b.mat.map, vertexColors: !!b.mat.vertexColors } });
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
  const district = glb(out.district), surroundings = glb(out.surroundings);
  report.district.meshes = district.meshes; report.surroundings.meshes = surroundings.meshes;
  return { district: district.base64, surroundings: surroundings.base64, report };
};
