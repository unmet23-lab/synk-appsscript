// Surface information makes the small weave; these meshes carry the actual
// thickness, large folds, sewn edges and pocket volume.
export function clothShellGeometry(THREE, at, { rows = 24, cols = 24, thickness = 0.022 } = {}) {
  const positions = [], uv = [], indices = [];
  const normals = [], front = [], back = [];
  const vec = p => new THREE.Vector3(...p);
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const u = x / cols, v = y / rows, du = 0.001, dv = 0.001;
    const tangentU = vec(at(Math.min(1, u + du), v)).sub(vec(at(Math.max(0, u - du), v)));
    const tangentV = vec(at(u, Math.min(1, v + dv))).sub(vec(at(u, Math.max(0, v - dv))));
    const normal = tangentV.cross(tangentU).normalize();
    if (normal.z < 0) normal.negate();
    const p = vec(at(u, v)); front.push(p); back.push(p.clone().addScaledVector(normal, -thickness)); normals.push(normal);
  }
  for (const face of [front, back]) for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const p = face[y * (cols + 1) + x]; positions.push(p.x, p.y, p.z); uv.push(x / cols, y / rows);
  }
  const faceCount = front.length;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const n = y * (cols + 1) + x, d = n + cols + 1;
    indices.push(n, d, n + 1, n + 1, d, d + 1);
    indices.push(n + faceCount, n + 1 + faceCount, d + faceCount, n + 1 + faceCount, d + 1 + faceCount, d + faceCount);
  }
  const faceIndexCount = indices.length, boundary = [];
  for (let x = 0; x <= cols; x++) boundary.push(x);
  for (let y = 1; y <= rows; y++) boundary.push(y * (cols + 1) + cols);
  for (let x = cols - 1; x >= 0; x--) boundary.push(rows * (cols + 1) + x);
  for (let y = rows - 1; y > 0; y--) boundary.push(y * (cols + 1));
  // Separate edge vertices give the sewn cut edge its own normal and UV.
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length], start = positions.length / 3;
    for (const p of [front[a], back[a], front[b], back[b]]) positions.push(p.x, p.y, p.z);
    uv.push(i / boundary.length, 0, i / boundary.length, 1, (i + 1) / boundary.length, 0, (i + 1) / boundary.length, 1);
    indices.push(start, start + 2, start + 1, start + 2, start + 3, start + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  geometry.addGroup(0, faceIndexCount, 0); geometry.addGroup(faceIndexCount, indices.length - faceIndexCount, 1);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  geometry.userData = { kind: 'closed-cloth-shell', thickness, rows, cols, hasFrontBackAndEdges: true };
  return geometry;
}

export function addSeamStitches(THREE, parent, paths, material, { radius = 0.003, dashRatio = 0.52, lift = 0.006 } = {}) {
  const pieces = [];
  for (const points of paths) for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]);
    const delta = b.clone().sub(a); if (delta.length() < 0.0001) continue;
    const center = a.add(b).multiplyScalar(0.5); center.z += lift;
    pieces.push({ center, length: delta.length() * dashRatio, direction: delta.normalize() });
  }
  const mesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(radius, 1, 3, 6), material, pieces.length);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  pieces.forEach((p, index) => {
    rotation.setFromUnitVectors(up, p.direction); matrix.compose(p.center, rotation, new THREE.Vector3(1, p.length, 1)); mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'sewn-thread-stitches'; parent.add(mesh); return mesh;
}

export function pocketGussetGeometry(THREE, frontAt, backAt, count = 20) {
  const edges = [t => [0, t], t => [t, 1], t => [1, 1 - t]];
  const positions = [], uv = [], indices = [];
  for (const edge of edges) for (let i = 0; i < count; i++) {
    const a = edge(i / count), b = edge((i + 1) / count), n = positions.length / 3;
    positions.push(...frontAt(...a), ...backAt(...a), ...frontAt(...b), ...backAt(...b));
    uv.push(i / count, 0, i / count, 1, (i + 1) / count, 0, (i + 1) / count, 1);
    indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData = { kind: 'pocket-side-bottom-gussets', openTop: true }; return geometry;
}
