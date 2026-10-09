import * as THREE from './scene-assets/three.module.js';

// Small authored botanical shapes, shared by the terrace tree, herbs and pots.
// UV.y remains zero at the stem and one at the tip for garden-breeze-v5.
export function createLeafGeometry(mobile = false) {
  const rows = mobile ? 6 : 8, cols = 4, positions = [], uvs = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    // The lower shoulder is fuller; the upper third tapers into a fine tip.
    const profile = Math.pow(Math.sin(v * Math.PI), .74) * (1.15 - .31 * v);
    for (let col = 0; col <= cols; col++) {
      const u = col / cols * 2 - 1;
      const width = .218 * profile + (row === 0 ? .006 : row === rows ? .0006 : 0);
      const x = u * width * (1 + u * .075 + Math.sin(v * 12) * .035)
        + Math.sin(v * Math.PI) * .018;
      const y = v + Math.abs(u) * Math.sin(v * Math.PI) * .025;
      // A lifted midrib and softly curled margins catch a different highlight.
      const z = Math.sin(v * Math.PI) * (.10 - .075 * u * u)
        + v * v * .065 + Math.sin(v * 9 + u * 1.3) * .012 * u * u * profile;
      positions.push(x, y, z); uvs.push(col / cols, v);
      const k = row * (cols + 1) + col;
      if (row < rows && col < cols) indices.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox();
  geometry.userData = { botanicalRevision: 6, triangles: indices.length / 3, stemAxis: '+Y', mobile };
  return geometry;
}

function seeded(seed) { return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); }
const UP = new THREE.Vector3(0, 1, 0), AXIS_X = new THREE.Vector3(1, 0, 0);

// All tapered branch sections are written into one geometry. Their radius
// changes along a curved centreline; there are no uniform cylinder spokes.
function addBranch(data, points, startRadius, endRadius, segments, sides) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const offset = data.positions.length / 3;
  const side = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let row = 0; row <= segments; row++) {
    const t = row / segments, point = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
    side.crossVectors(tangent, Math.abs(tangent.y) > .95 ? AXIS_X : UP).normalize();
    normal.crossVectors(side, tangent).normalize();
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, Math.pow(t, .82));
    for (let col = 0; col <= sides; col++) {
      const angle = col / sides * Math.PI * 2;
      // Very quiet longitudinal ridges break perfectly machined circular bark.
      const r = radius * (1 + Math.sin(angle * 3 + t * .8) * .047);
      const vertex = point.clone().addScaledVector(side, Math.cos(angle) * r).addScaledVector(normal, Math.sin(angle) * r);
      data.positions.push(vertex.x, vertex.y, vertex.z); data.uvs.push(col / sides, t * curve.getLength() * 2);
      const k = offset + row * (sides + 1) + col;
      if (row < segments && col < sides) data.indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2);
    }
  }
  // Hide the open ring at each fine twig tip with a small end cap.
  for (let col = 1; col < sides - 1; col++) data.indices.push(offset + segments * (sides + 1), offset + segments * (sides + 1) + col + 1, offset + segments * (sides + 1) + col);
  return curve;
}

/** Add a single tree at the parent's local origin (normally the raised bed).
 * Caller owns the materials and disposes the attached geometries with its scene.
 * Returns counts for the existing courtyard metrics; no animation loop is added.
 */
export function buildTerraceTree(parent, materials, { mobile = false } = {}) {
  const random = seeded(60117), branches = { positions: [], uvs: [], indices: [] }, leaves = [];
  const root = new THREE.Group(); root.name = 'terrace-tree-v6'; parent.add(root);
  const trunk = addBranch(branches, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.035, .40, .025), new THREE.Vector3(.025, .91, -.015), new THREE.Vector3(.14, 1.42, -.025), new THREE.Vector3(.075, 1.76, -.075)], .061, .005, mobile ? 12 : 14, mobile ? 6 : 8);
  const branchCount = 8, twigCount = mobile ? 3 : 4, pairs = mobile ? 4 : 5;
  for (let branch = 0; branch < branchCount; branch++) {
    const angle = branch * 2.399963 + .28;
    const y = branch === branchCount - 1 ? 1.76 : .64 + branch * .125;
    const reach = (.57 + random() * .24) * (branch === 1 ? 1.10 : branch === 6 ? .81 : 1);
    const start = trunk.getPoint(y / 1.76);
    const end = new THREE.Vector3(Math.sin(angle) * reach + .08, y + (branch === branchCount - 1 ? .20 : .49) + random() * .14, Math.cos(angle) * reach * .78 - .025);
    const middle = start.clone().lerp(end, .56); middle.y -= .08;
    const bcurve = addBranch(branches, [start, middle, end], .024 - branch * .0009, .0038, mobile ? 7 : 9, mobile ? 5 : 6);
    for (let twig = 0; twig < twigCount; twig++) {
      const t = .41 + twig / Math.max(1, twigCount - 1) * .56;
      const origin = bcurve.getPoint(t), sign = twig % 2 ? 1 : -1;
      const heading = angle + sign * (.65 + random() * .30);
      const length = .29 + random() * .17;
      const tip = origin.clone().add(new THREE.Vector3(Math.sin(heading) * length, .18 + random() * .12, Math.cos(heading) * length * .80));
      const elbow = origin.clone().lerp(tip, .57); elbow.y += .018;
      const twigCurve = addBranch(branches, [origin, elbow, tip], .007, .0012, mobile ? 4 : 5, mobile ? 4 : 5);
      const twigTangent = tip.clone().sub(origin).normalize();
      for (let pair = 0; pair < pairs; pair++) for (const leafSide of [-1, 1]) {
        const leafT = .12 + (pair + (leafSide === 1 ? .28 : 0)) / pairs * .79 + (random() - .5) * .045;
        const anchor = twigCurve.getPoint(leafT);
        const leafAngle = heading + leafSide * (.63 + random() * 1.07);
        const direction = new THREE.Vector3(Math.sin(leafAngle), -.15 + random() * .95, Math.cos(leafAngle) * .86).normalize();
        const size = (.175 + random() * .10) * (1 - leafT * .15);
        leaves.push({ anchor, direction, size, width: .88 + random() * .31, roll: (random() - .5) * 2.20, tint: random(), young: leafT > .82 });
      }
      leaves.push({ anchor: tip, direction: twigTangent, size: .165 + random() * .035, width: .9, roll: (random() - .5) * .45, tint: .75, young: true });
    }
  }
  const branchGeometry = new THREE.BufferGeometry();
  branchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(branches.positions, 3));
  branchGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(branches.uvs, 2));
  branchGeometry.setIndex(branches.indices); branchGeometry.computeVertexNormals();
  // Geometry remains independent of the caller's bark material or texture scale.
  branchGeometry.computeBoundingSphere();
  const wood = new THREE.Mesh(branchGeometry, materials.bark); wood.name = 'tapered-tree-branches-v6';
  wood.castShadow = wood.receiveShadow = true; root.add(wood);
  const leafGeometry = createLeafGeometry(mobile);
  const crown = new THREE.InstancedMesh(leafGeometry, materials.foliage, leaves.length);
  crown.name = 'connected-tree-leaves-v6';
  const dummy = new THREE.Object3D(), turn = new THREE.Quaternion(), roll = new THREE.Quaternion();
  const dark = new THREE.Color('#506b3f'), light = new THREE.Color('#92a265'), young = new THREE.Color('#a6ae76');
  leaves.forEach((leaf, index) => {
    dummy.position.copy(leaf.anchor);
    turn.setFromUnitVectors(UP, leaf.direction); roll.setFromAxisAngle(UP, leaf.roll);
    dummy.quaternion.copy(turn).multiply(roll); dummy.scale.set(leaf.size * leaf.width, leaf.size, leaf.size); dummy.updateMatrix();
    crown.setMatrixAt(index, dummy.matrix);
    crown.setColorAt(index, dark.clone().lerp(light, leaf.tint * .73).lerp(young, leaf.young ? .18 : 0));
  });
  crown.castShadow = crown.receiveShadow = true; crown.computeBoundingSphere(); root.add(crown);
  const metrics = { revision: 6, leafCount: leaves.length, branchCount: 1 + branchCount + branchCount * twigCount, drawCalls: 2, leafTriangles: leaves.length * leafGeometry.index.count / 3, branchTriangles: branches.indices.length / 3 };
  root.userData = { ...metrics, botanicalTree: true };
  return { group: root, foliageCount: leaves.length, metrics };
}
