import * as THREE from './scene-assets/three.module.js';

// Closed, slightly overlapping ceramic tiles. One shared mesh batch replaces
// the thirteen raised box seams; no texture, light or frame loop is added.
export function addRoofCraft(parent, material, { mobile = false } = {}) {
  const positions = [], uv = [], indices = [], columns = mobile ? 6 : 8;
  const width = .128, length = .414, thickness = .010;
  const point = (i, end, underside) => {
    const u = i / columns, x = (u - .5) * width;
    return [x, Math.sin(u * Math.PI) * .035 - underside * thickness, (end - .5) * length];
  };
  for (let underside = 0; underside < 2; underside++) for (let end = 0; end < 2; end++) for (let i = 0; i <= columns; i++) {
    positions.push(...point(i, end, underside)); uv.push(i / columns, end);
  }
  const row = columns + 1, skin = row * 2;
  for (let side = 0; side < 2; side++) for (let i = 0; i < columns; i++) {
    const a = side * skin + i, b = a + 1, c = a + row, d = c + 1;
    if (side) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d);
  }
  for (let i = 0; i < columns; i++) for (const end of [0, 1]) {
    const a = end * row + i, b = a + 1;
    if (end) indices.push(a, a + skin, b, b, a + skin, b + skin);
    else indices.push(a, b, a + skin, b, b + skin, a + skin);
  }
  for (const i of [0, columns]) {
    const a = i, b = row + i;
    if (i) indices.push(a, b, a + skin, b, b + skin, a + skin);
    else indices.push(a, a + skin, b, b, a + skin, b + skin);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const across = 24, deep = 4, tiles = new THREE.InstancedMesh(geometry, material, across * deep), dummy = new THREE.Object3D();
  for (let z = 0; z < deep; z++) for (let x = 0; x < across; x++) {
    const index = z * across + x, offsetZ = -.525 + z * .352;
    dummy.position.set(-1.472 + x * .128, 2.353 + Math.sin(.065) * offsetZ + z * .003, -.19 + offsetZ);
    dummy.rotation.set(-.065, 0, 0); dummy.updateMatrix(); tiles.setMatrixAt(index, dummy.matrix);
    tiles.setColorAt(index, new THREE.Color('#c4cdc8').lerp(new THREE.Color('#edf0de'), .25 + Math.sin(index * 12.37) * .13));
  }
  tiles.name = 'handmade-ceramic-roof-tiles'; tiles.castShadow = tiles.receiveShadow = true;
  tiles.computeBoundingSphere(); parent.add(tiles);
  return { tiles: across * deep, triangles: geometry.index.count / 3 * across * deep };
}
