import * as THREE from '/scene-assets/three.module.js';
// Geometry and clothing adapted from the approved WORLD home v2 art study.
// Keep the armless bell silhouette, two eyes and original scalloped hem.
const TAU = Math.PI * 2;
function random(seed = 9123) { let n = seed; return () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296); }

function roundedBox(w, h, d, radius = .08) {
  const x = -w / 2, y = -h / 2, r = Math.min(radius, w / 2, h / 2), shape = new THREE.Shape();
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.01, d - radius), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: radius / 2, bevelThickness: radius / 2, curveSegments: 5 });
  g.translate(0, 0, -(d - radius) / 2); return g;
}
function mesh(parent, geo, material, p = [0, 0, 0], scale) {
  const m = new THREE.Mesh(geo, material); m.position.set(...p); if (scale) m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function tube(parent, points, radius, material, closed = false, segments = 60) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', .4);
  return mesh(parent, new THREE.TubeGeometry(curve, segments, radius, 5, closed), material);
}

const profileCurve = new THREE.CatmullRomCurve3([
  [.0, .09], [.83, .1], [.82, .23], [.765, .46], [.755, .8], [.735, 1.15], [.665, 1.45], [.51, 1.67], [.28, 1.81], [0, 1.855],
].map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
function bodyPoint(t, a, offset = 0) {
  const p = profileCurve.getPoint(t), influence = Math.exp(-p.y * 7), wave = Math.cos(a * 8 + Math.PI);
  const r = p.x + influence * wave * .07 + offset;
  return new THREE.Vector3(Math.sin(a) * r, p.y + influence * wave * .19, Math.cos(a) * r * .82);
}
function mongleGeometry() {
  const profile = Array.from({ length: 57 }, (_, i) => { const p = profileCurve.getPoint(i / 56); return new THREE.Vector2(p.x, p.y); });
  const g = new THREE.LatheGeometry(profile, 80), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), influence = Math.exp(-y * 7), wave = Math.cos(a * 8 + Math.PI);
    const r = Math.hypot(x, z), nr = r + influence * wave * .07;
    p.setXYZ(i, r > .001 ? x * nr / r : 0, y + influence * wave * .19, r > .001 ? z * nr / r * .82 : 0);
  }
  g.computeVertexNormals(); return g;
}
function bodyFibers(count = 7800) {
  const rng = random(17), positions = [], colors = [], aColor = new THREE.Color('#ee9279'), bColor = new THREE.Color('#fac1a1');
  for (let i = 0; i < count; i++) {
    const t = .10 + rng() * .88, a = rng() * TAU, p = bodyPoint(t, a, .004);
    if (p.z > .4 && Math.abs(p.y - 1.36) < .145 && Math.min(Math.abs(p.x - .29), Math.abs(p.x + .29)) < .14) continue;
    const n = new THREE.Vector3(Math.sin(a), Math.max(0, (p.y - 1.25) * 1.9), Math.cos(a) / .82).normalize(), length = .009 + rng() * .018;
    const q = p.clone().addScaledVector(n, length); q.y += (rng() - .5) * .018;
    positions.push(...p.toArray(), ...q.toArray()); const c = aColor.clone().lerp(bColor, rng()); colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .15, depthWrite: false }));
}
function apronGeometry() {
  const p = [], uv = [], indices = [], rows = 18, cols = 22;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const v = j / rows, u = i / cols, width = .285 + .21 * Math.sin(v * 1.8), x = (u * 2 - 1) * width, y = .93 - v * .61;
    const z = .83 * Math.sqrt(Math.max(.015, .78 ** 2 - x * x)) + .029 + Math.sin(v * 9) * .012;
    p.push(x, y, z); uv.push(u, v); const n = j * (cols + 1) + i;
    if (j < rows && i < cols) indices.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
export function makeTownCharacter(parent, materials, { mobile = false, apron: wearApron = false } = {}) {
  const mascot = new THREE.Group(); parent.add(mascot); mascot.scale.setScalar(.56);
  const body = mesh(mascot, mongleGeometry(), materials.coral); body.name = 'mongle-bell-scallop-body';
  const fibers = bodyFibers(mobile ? 2200 : 4400); fibers.name = "close-view-felt-fibers"; mascot.add(fibers);
  for (const sign of [-1, 1]) {
    const eye = mesh(mascot, new THREE.SphereGeometry(.099, 28, 22), materials.eye, [sign * .29, 1.36, .545], [1, 1.16, .57]);
    eye.rotation.y = sign * .15;
    mesh(mascot, new THREE.SphereGeometry(.019, 12, 8), materials.glint, [sign * .29 - .023, 1.397, .596]);
  }
  const seam = [];
  for (let i = 0; i < 96; i++) { const a = i / 96 * TAU, wave = Math.cos(a * 8 + Math.PI), r = .84 + wave * .027; seam.push([Math.sin(a) * r, .17 + wave * .088, Math.cos(a) * r * .827]); }
  tube(mascot, seam, .012, materials.thread, true, 144);
  const scarf = new THREE.Group(); mascot.add(scarf);
  // A folded band with real width and thickness, rather than a white tube.
  const cloth = (fn, rows = 12, cols = 64) => {
    const p = [], uv = [], indices = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const u = i / cols, v = j / rows; p.push(...fn(u, v)); uv.push(u, v);
      const n = j * (cols + 1) + i;
      if (j < rows && i < cols) indices.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
  };
  const band = (u, v) => { const a = u * TAU, r = .768 + Math.sin(v * Math.PI) * .028 + Math.sin(a * 7 + v * 3) * .010; return [Math.sin(a) * r, 1.07 - v * .174 - Math.cos(a) * .051 + Math.sin(a * 2 + .5) * .025 + Math.sin(a * 7) * .005, Math.cos(a) * r * .843]; };
  mesh(scarf, cloth(band), materials.scarf);
  for (const v of [.02, .98]) tube(scarf, Array.from({ length: 72 }, (_, i) => band(i / 72, v)), .013, materials.scarf, true, 100);
  const tailPoint = (u, v, second = false) => {
    const x = (second ? .32 : .48) + (u - .5) * .21 + v * (second ? -.10 : .06), y = .99 - v * (second ? .36 : .50);
    return [x, y, .659 + (second ? .031 : .018) + Math.sin(v * 4) * .026 + Math.sin(u * Math.PI * 3 + v) * .010];
  };
  for (const second of [false, true]) {
    mesh(scarf, cloth((u, v) => tailPoint(u, v, second), 16, 10), materials.scarf);
    for (const u of [0, 1]) tube(scarf, Array.from({ length: 16 }, (_, i) => tailPoint(u, i / 15, second)), .008, materials.scarf, false, 24);
    for (let i = 0; i < 9; i++) {
      const p = tailPoint((i + .5) / 9, 1, second);
      tube(scarf, [p, [p[0] + .007, p[1] - .045, p[2] + .006]], .006, materials.scarf, false, 3);
    }
  }
  // A small raised coral note echoes the approved first-voice scarf item.
  tube(scarf, [[.53, .58, .697], [.53, .68, .697], [.575, .695, .697]], .009, materials.coral, false, 10);
  mesh(scarf, new THREE.SphereGeometry(.018, 12, 8), materials.coral, [.518, .574, .697], [1.3, .75, .4]);
  const apron = new THREE.Group(); mascot.add(apron); mesh(apron, apronGeometry(), materials.sage);
  tube(apron, [[-.28, .90, .65], [-.4, 1.015, .58], [-.43, 1.055, .24], [0, 1.03, -.63], [.43, 1.055, .24], [.4, 1.015, .58], [.28, .9, .65]], .025, materials.sage, false, 60);
  const pocket = mesh(apron, roundedBox(.245, .19, .018, .027), materials.sage, [0, .55, .686]); pocket.rotation.x = -.06;
  tube(apron, [[-.115, .63, .706], [0, .63, .709], [.115, .63, .706]], .004, materials.thread, false, 14);
  const apronEdge = [];
  for (let i = 0; i <= 22; i++) { const u = i / 22, v = .985, width = .285 + .21 * Math.sin(v * 1.8), x = (u * 2 - 1) * width; apronEdge.push([x, .93 - v * .61, .83 * Math.sqrt(Math.max(.015, .78 ** 2 - x * x)) + .035 + Math.sin(v * 9) * .012]); }
  tube(apron, apronEdge, .010, materials.sage, false, 35);
  scarf.visible = !wearApron; apron.visible = wearApron;
  return { mascot, scarf, apron };
}
