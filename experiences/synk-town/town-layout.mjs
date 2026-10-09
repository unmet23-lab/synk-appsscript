// Shared declarative Town geometry for rendering and authoritative ground movement.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

const houses = [
  { id: 'neighbour-0', x: -16.6, z: -16.3, width: 4.032, depth: 2.275, height: 1.9844, yaw: .16, style: 0, paint: '#e8ece6', yardFrontMargin: 2 },
  { id: 'neighbour-1', x: -10, z: -16, width: 2.688, depth: 2.997, height: 2.5984, yaw: -.06, style: 1, paint: '#f1f2ec', yardFrontMargin: 2 },
  { id: 'neighbour-2', x: -4.7, z: -16.7, width: 3, depth: 2.568, height: 1.9364, yaw: -.17, style: 2, paint: '#e7ede6', yardFrontMargin: 2 },
  { id: 'neighbour-3', x: 5.4, z: -16.6, width: 3.808, depth: 2.366, height: 2.0828, yaw: .12, style: 0, paint: '#ecefe9', yardFrontMargin: 2 },
  { id: 'neighbour-4', x: 12.2, z: -16.4, width: 3.192, depth: 3.108, height: 2.6432, yaw: -.11, style: 1, paint: '#eef1eb', yardFrontMargin: 2 },
  { id: 'neighbour-5', x: 17.4, z: -17.6, width: 3.2, depth: 2.889, height: 2.0116, yaw: -.26, style: 2, paint: '#e5ebe4', yardFrontMargin: 2 },
  { id: 'neighbour-6', x: -12.9, z: -21.1, width: 3.808, depth: 2.548, height: 1.7876, yaw: .04, style: 0, paint: '#f0f1eb', yardFrontMargin: 1.24 },
  { id: 'neighbour-7', x: 8.9, z: -21.1, width: 2.688, depth: 2.886, height: 2.3968, yaw: -.07, style: 1, paint: '#ebeee7', yardFrontMargin: 1.24 },
].map(house => {
  // width/depth/height are resolved dimensions. Rendering must not apply variant scaling again.
  const gateClearWidth = 1.8, frontWidth = house.width + .78, segmentWidth = (frontWidth - gateClearWidth) / 2;
  const frontZ = house.depth / 2 + house.yardFrontMargin;
  const sideDepth = house.depth + house.yardFrontMargin + .30, sideZ = (house.yardFrontMargin - .30) / 2;
  const parts = [{ id: house.id + '-body', kind: 'house-wall', localX: 0, localZ: 0, width: house.width, depth: house.depth,
    height: house.height, localY: house.height / 2, clearance: .42, materialKey: 'plaster' }];
  for (const sign of [-1, 1]) {
    parts.push({ id: house.id + '-garden-front-' + sign, kind: 'garden-fence', localX: sign * (gateClearWidth + segmentWidth) / 2,
      localZ: frontZ, width: segmentWidth, depth: .22, height: .50, localY: .25, clearance: .34, materialKey: house.style === 1 ? 'wood' : 'plaster' });
    parts.push({ id: house.id + '-garden-side-' + sign, kind: 'garden-fence', localX: sign * (house.width / 2 + .39),
      localZ: sideZ, width: .22, depth: sideDepth, height: .50, localY: .25, clearance: .34, materialKey: 'plaster' });
  }
  if (house.style === 2) parts.push({ id: house.id + '-pantry', kind: 'house-wall', localX: house.width / 2 - .23,
    localZ: -house.depth * .14, width: 1.22, depth: house.depth * .74, height: 1.30, localY: .65, clearance: .42, materialKey: 'plaster' });
  return { ...house, gateClearWidth, frontWidth, frontZ, roofMaterialKey: 'roofSlate', groundParts: parts };
});

const trees = [
  { id: 'tree-41', x: -13.8, z: -2.2, scale: 1.36, seed: 41 },
  { id: 'tree-52', x: 13.8, z: -.8, scale: 1.40, seed: 52 },
  { id: 'tree-65', x: -8, z: -12.5, scale: 1.58, seed: 65 },
  { id: 'tree-75', x: 7.9, z: -12.5, scale: 1.70, seed: 75 },
  { id: 'tree-83', x: -3.8, z: -13.5, scale: 1.64, seed: 83 },
  { id: 'tree-94', x: 3.4, z: -13.4, scale: 1.70, seed: 94 },
].map(tree => ({ ...tree, trunkRadius: .12 * tree.scale, clearance: .34, lowerBranchWorldY: 1.95 }));

const paths = [
  { id: 'neighbour-main-street', width: 2.3, materialKey: 'gravel', surfaceLift: .024,
    points: [[-20, -11.5], [-17, -10.95], [-12.6, -10.3], [-8.5, -10.25], [-3, -10.6], [1, -10.65], [5.5, -11], [10, -10.6], [15.6, -11.6], [20.7, -12.8]] },
  { id: 'back-gate-lane-left', width: 1.4, materialKey: 'gravel', surfaceLift: .024,
    points: [[-12.8, -11], [-12.85, -16.5], [-12.8, -18.59]] },
  { id: 'back-gate-lane-right', width: 1.4, materialKey: 'gravel', surfaceLift: .024,
    points: [[8.9, -11.3], [8.9, -16.4], [8.71, -18.42]] },
  { id: 'neighbour-perimeter-loop', width: 1.5, materialKey: 'paving', surfaceLift: .024,
    points: [[-20.8, -12.5], [-20.5, -18], [-18, -22.9], [-13, -23.9], [0, -23.9], [13.5, -23.9], [19.5, -21], [21.15, -17.5], [21.2, -13.8]] },
];

export const TOWN_LAYOUT = freeze({ status: 'shared-town-layout-v1',
  bounds: { minX: -22, maxX: 22, minZ: -24.8, maxZ: 9 },
  protectedBounds: { minX: -12.2, maxX: 12.2, minZ: -10.8, maxZ: 7 },
  ground: { flatBounds: { minX: -22.6, maxX: 22.6, minZ: -25.4, maxZ: 9.6 }, localY: -.125, rootY: .20 },
  houses, trees, paths });

export function layoutWorldPoint(house, localX, localZ) {
  const cos = Math.cos(house.yaw), sin = Math.sin(house.yaw);
  return { x: house.x + localX * cos + localZ * sin, z: house.z - localX * sin + localZ * cos };
}

export function layoutBox(house, part) {
  const center = layoutWorldPoint(house, part.localX, part.localZ), cos = Math.cos(house.yaw), sin = Math.sin(house.yaw);
  const halfWidth = part.width / 2, halfDepth = part.depth / 2, ex = Math.abs(cos) * halfWidth + Math.abs(sin) * halfDepth + part.clearance;
  const ez = Math.abs(sin) * halfWidth + Math.abs(cos) * halfDepth + part.clearance;
  return Object.freeze({ id: part.id, type: 'obb', ...center, yaw: house.yaw, cos, sin, halfWidth, halfDepth, radius: part.clearance,
    minX: center.x - ex, maxX: center.x + ex, minZ: center.z - ez, maxZ: center.z + ez });
}

export function layoutSolids() {
  return Object.freeze([...TOWN_LAYOUT.houses.flatMap(house => house.groundParts.map(part => layoutBox(house, part))),
    ...TOWN_LAYOUT.trees.map(tree => Object.freeze({ id: tree.id, type: 'ellipse', x: tree.x, z: tree.z,
      rx: tree.trunkRadius + tree.clearance, rz: tree.trunkRadius + tree.clearance,
      minX: tree.x - tree.trunkRadius - tree.clearance, maxX: tree.x + tree.trunkRadius + tree.clearance,
      minZ: tree.z - tree.trunkRadius - tree.clearance, maxZ: tree.z + tree.trunkRadius + tree.clearance }))]);
}
