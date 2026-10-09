import * as THREE from './scene-assets/three.module.js';
import { makeCourtyard, makeLandscape } from './scene-v2-garden.mjs';

// This home-screen art study is not the approved production mascot mesh.
// Its bell silhouette, scalloped hem, two black eyes and absence of arms/mouth
// follow docs/캐릭터/화면_1024/몽글_본체.webp. No mascot billboard is used.
const clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
function random(seed = 9123) { let n = seed; return () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296); }
function canvasTexture(size, draw, repeat = [1, 1], color = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function fiberTexture() {
  const rng = random(182);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#898989'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 11500; i++) {
      const x = rng() * s, y = rng() * s, n = Math.round(65 + rng() * 135);
      ctx.strokeStyle = `rgba(${n},${n},${n},.5)`; ctx.lineWidth = .4 + rng() * .6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + rng() * 5 - 2.5, y + 2, x + rng() * 5 - 2.5, y + 2 + rng() * 3); ctx.stroke();
    }
  }, [4, 3]);
}
function woodTexture() {
  const rng = random(188);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#c5aa85'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 560; i++) {
      const y = rng() * s, dark = rng() > .42;
      ctx.strokeStyle = dark ? `rgba(85,53,31,${.02 + rng() * .1})` : `rgba(255,242,208,${.1 + rng() * .14})`;
      ctx.lineWidth = .4 + rng() * 1.1; ctx.beginPath();
      for (let x = 0; x <= s; x += 8) { const yy = y + Math.sin(x / 60 + y * .07) * (1 + rng() * 2); if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
    }
  }, [1, 1], true);
}
function noiseTexture() {
  const rng = random(233);
  return canvasTexture(128, (ctx, s) => {
    const data = ctx.createImageData(s, s);
    for (let i = 0; i < data.data.length; i += 4) { const n = 80 + rng() * 95; data.data[i] = data.data[i + 1] = data.data[i + 2] = n; data.data[i + 3] = 255; }
    ctx.putImageData(data, 0, 0);
  }, [3, 3]);
}
function leafTexture() {
  return canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, 0); g.addColorStop(0, '#9fbb86'); g.addColorStop(.48, '#e1edd0'); g.addColorStop(.52, '#c3d6aa'); g.addColorStop(1, '#a4bd8b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); ctx.lineWidth = 1.25; ctx.strokeStyle = 'rgba(243,249,208,.34)';
    for (let y = 10; y < s; y += 25) for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s / 2, y); ctx.quadraticCurveTo(s / 2 + side * 45, y + 7, s / 2 + side * 126, y + 61); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(235,244,202,.58)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.stroke();
  }, [1, 1], true);
}
function knitTexture() {
  const rng = random(42);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#d6c4a6'; ctx.fillRect(0, 0, s, s);
    for (let j = -1; j < 17; j++) for (let i = -1; i < 13; i++) {
      const x = i * 22, y = j * 17;
      ctx.strokeStyle = '#a99474'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 2, y + 1); ctx.quadraticCurveTo(x + 3, y + 10, x + 11, y + 15); ctx.quadraticCurveTo(x + 19, y + 10, x + 20, y + 1); ctx.stroke();
      ctx.strokeStyle = '#f0e2c9'; ctx.lineWidth = 3.0;
      ctx.beginPath(); ctx.moveTo(x + 3, y + 1); ctx.quadraticCurveTo(x + 5, y + 9, x + 11, y + 14); ctx.moveTo(x + 19, y + 1); ctx.quadraticCurveTo(x + 17, y + 9, x + 12, y + 14); ctx.stroke();
    }
    for (let i = 0; i < 3700; i++) { const v = Math.round(110 + rng() * 130); ctx.strokeStyle = `rgba(${v},${v},${v},.13)`; ctx.lineWidth = .4; const x = rng() * s, y = rng() * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y + 4); ctx.stroke(); }
  }, [6, 1], true);
}
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
function contactShadow(parent, p, size, opacity = .25) {
  const texture = canvasTexture(128, (ctx, s) => { const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(42,37,32,.9)'); g.addColorStop(.4, 'rgba(42,37,32,.48)'); g.addColorStop(1, 'rgba(42,37,32,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); });
  const m = mesh(parent, new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false }), p);
  m.rotation.x = -Math.PI / 2; m.castShadow = m.receiveShadow = false; return m;
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
function makeMascot(parent, materials, mobile) {
  const mascot = new THREE.Group(); parent.add(mascot); mascot.position.set(0, .27, .45);
  const body = mesh(mascot, mongleGeometry(), materials.coral); body.name = 'mongle-bell-scallop-body';
  mascot.add(bodyFibers(mobile ? 5300 : 8800));
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
  scarf.visible = false; apron.visible = true;
  return { mascot, scarf, apron };
}
function makePlant(parent, materials, p, scale = 1, seed = 7, potMaterial = materials.terra) {
  const group = new THREE.Group(); group.position.set(...p); group.scale.setScalar(scale); parent.add(group);
  const pot = mesh(group, new THREE.CylinderGeometry(.29, .21, .43, 40, 1, true), potMaterial, [0, .215, 0]);
  mesh(group, new THREE.TorusGeometry(.285, .031, 8, 44), potMaterial, [0, .43, 0]).rotation.x = Math.PI / 2;
  mesh(group, new THREE.CylinderGeometry(.267, .267, .018, 28), materials.soil, [0, .403, 0]);
  const rng = random(seed), leafMaterial = [materials.leaf, materials.leafLight];
  for (let i = 0; i < 11; i++) {
    const angle = rng() * TAU, radius = .14 + rng() * .23, height = .69 + rng() * .7;
    const end = [Math.sin(angle) * radius, height, Math.cos(angle) * radius];
    tube(group, [[0, .39, 0], [end[0] * .6, height * .78, end[2] * .6], end], .011, materials.stem, false, 12);
    // A gridded lenticular leaf bends along both axes, unlike a flat outline.
    const points = [], leafUV = [], indices = [], rows = 12, cols = 6;
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
      const t = row / rows, across = col / cols * 2 - 1, width = Math.pow(Math.sin(t * Math.PI), .8) * .126;
      points.push(across * width, t * .43, Math.sin(t * Math.PI) * .105 - Math.abs(across) * width * .34 + t * t * .026); leafUV.push(col / cols, t);
      const n = row * (cols + 1) + col; if (row < rows && col < cols) indices.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(leafUV, 2)); g.setIndex(indices); g.computeVertexNormals();
    const leafGroup = new THREE.Group(); leafGroup.position.set(...end); group.add(leafGroup); mesh(leafGroup, g, leafMaterial[i % 2]);
    const vein = Array.from({ length: 9 }, (_, n) => { const t = n / 8; return [0, t * .43, Math.sin(t * Math.PI) * .105 + t * t * .026 + .003]; });
    tube(leafGroup, vein, .003, materials.leafVein, false, 12);
    leafGroup.rotation.set(-.3 - rng() * .7, angle, .6 - rng() * 1.2); leafGroup.scale.setScalar(i > 7 ? .46 + rng() * .35 : .82 + rng() * .55);
  }
  contactShadow(group, [0, .004, 0], [.82, .82], .34); return group;
}
function makeBench(parent, materials) {
  const group = new THREE.Group(); parent.add(group); group.position.set(-2.0, .27, -.30); group.rotation.y = .13;
  for (let i = 0; i < 4; i++) mesh(group, roundedBox(1.55, .085, .145, .03), materials.wood, [0, .54, -.20 + i * .16]);
  for (let i = 0; i < 3; i++) mesh(group, roundedBox(1.55, .135, .075, .025), materials.wood, [0, .77 + i * .155, -.25]);
  for (const x of [-.60, .60]) {
    mesh(group, roundedBox(.09, .95, .08, .016), materials.darkWood, [x, .52, -.27]);
    mesh(group, roundedBox(.09, .48, .08, .016), materials.darkWood, [x, .245, .24]);
    mesh(group, roundedBox(.13, .08, .65, .025), materials.darkWood, [x, .47, -.015]);
  }
  contactShadow(group, [0, .004, 0], [2.3, 1.2], .21);
  const cushion = mesh(group, new THREE.SphereGeometry(1, 28, 20), materials.linen, [.28, .64, .1], [.43, .1, .29]); cushion.rotation.y = .12;
}
function makeMug(parent, materials, p) {
  const g = new THREE.Group(); parent.add(g); g.position.set(...p);
  mesh(g, new THREE.CylinderGeometry(.11, .095, .17, 28, 1, true), materials.ceramic, [0, .087, 0]);
  mesh(g, new THREE.TorusGeometry(.106, .011, 8, 28), materials.ceramic, [0, .172, 0]).rotation.x = Math.PI / 2;
  mesh(g, new THREE.CylinderGeometry(.095, .095, .006, 24), materials.tea, [0, .154, 0]);
  const handle = mesh(g, new THREE.TorusGeometry(.065, .018, 9, 22), materials.ceramic, [.11, .092, 0]); handle.scale.x = .9;
  return g;
}
function makeBackdrop(scene, materials) {
  const landscape = new THREE.Group(); scene.add(landscape);
  const mountainMat = new THREE.MeshStandardMaterial({ color: '#c6d8cd', roughness: 1 });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#cbdeda', roughness: 1 });
  for (const [x, y, z, sx, sy, sz] of [[-7, -.15, -10, 4.2, 2.4, 2], [-2, -.4, -12, 4.6, 3, 2.4], [4.8, -.3, -13, 4.4, 3.6, 2.5], [10, -.1, -15, 3.8, 2.4, 2]]) {
    const g = new THREE.SphereGeometry(1, 24, 18); const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) { const xx = a.getX(i), yy = a.getY(i), zz = a.getZ(i); a.setXYZ(i, xx, yy * (1 + .1 * Math.sin(xx * 9 + zz * 4)), zz); } g.computeVertexNormals();
    const m = mesh(landscape, g, x < 0 ? ridgeMat : mountainMat, [x, y, z], [sx, sy, sz]); m.castShadow = false;
  }
  const building = new THREE.MeshStandardMaterial({ color: '#dbe7dd', roughness: .8 });
  for (let i = 0; i < 9; i++) { const x = 3.4 + i * .57, h = .65 + ((i * 7) % 5) * .22;
    const b = mesh(landscape, roundedBox(.32, h, .36, .1), building, [x, h / 2 - .3, -7.3 - (i % 3) * .6]); b.castShadow = false;
  }
  const tower = new THREE.Group(); landscape.add(tower); tower.position.set(-3.3, .2, -7.0);
  mesh(tower, new THREE.CylinderGeometry(.04, .095, 1.5, 16), building, [0, .75, 0]);
  mesh(tower, new THREE.CylinderGeometry(.22, .18, .17, 28), building, [0, 1.3, 0]);
  mesh(tower, new THREE.CylinderGeometry(.015, .025, .5, 10), building, [0, 1.65, 0]);
  return landscape;
}

export async function mountHomeScene(container, { onReady = () => {}, onError = () => {}, reducedMotion = false } = {}) {
  if (!container?.appendChild) throw new TypeError('A scene container is required.');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default', preserveDrawingBuffer: true }); }
  catch (error) { onError(error); throw error; }
  const isMobile = () => container.clientWidth < 600;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  scene.background = new THREE.Color('#b7d4df'); scene.fog = new THREE.Fog('#bad0ce', 13, 55); renderer.setClearColor('#b7d4df', 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const canvas = renderer.domElement; canvas.className = 'world-scene-canvas'; canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;outline-offset:-5px';
  canvas.setAttribute('aria-label', '입체 테라스의 몽글. 좌우로 드래그하거나 방향키로 둘러보고, Enter 키로 인사할 수 있어요.'); canvas.tabIndex = 0;
  container.appendChild(canvas);
  const world = new THREE.Group(); scene.add(world);
  const bump = fiberTexture(), grain = woodTexture(), noise = noiseTexture(), leafMap = leafTexture(), knit = knitTexture();
  const felt = color => new THREE.MeshPhysicalMaterial({ color, roughness: .96, sheen: .78, sheenRoughness: .88, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff1dc'), .40), bumpMap: bump, bumpScale: .019, side: THREE.DoubleSide });
  const materials = {
    coral: felt('#de6654'), sage: felt('#617550'), linen: felt('#d8c7a6'), scarf: felt('#e1d5b8'), thread: felt('#bf8b74'),
    eye: new THREE.MeshPhysicalMaterial({ color: '#100e0d', roughness: .17, clearcoat: .75, clearcoatRoughness: .12 }),
    glint: new THREE.MeshBasicMaterial({ color: '#fff3df' }),
    wood: new THREE.MeshStandardMaterial({ color: '#c6a57c', map: grain, bumpMap: grain, bumpScale: .016, roughness: .72 }),
    darkWood: new THREE.MeshStandardMaterial({ color: '#907958', roughness: .84, map: grain, bumpMap: grain, bumpScale: .018 }),
    terra: new THREE.MeshStandardMaterial({ color: '#bb795e', roughness: .94, bumpMap: noise, bumpScale: .018 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#eae0c5', roughness: .24, clearcoat: .6 }),
    soil: new THREE.MeshStandardMaterial({ color: '#4b4836', roughness: 1, bumpMap: noise, bumpScale: .02 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#567b48', roughness: .75, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: '#8b9a58', roughness: .7, side: THREE.DoubleSide }),
    leafVein: new THREE.MeshStandardMaterial({ color: '#9cab72', roughness: .88 }),
    stem: new THREE.MeshStandardMaterial({ color: '#6c7650', roughness: .9 }),
    stone: new THREE.MeshStandardMaterial({ color: '#d5d5c5', roughness: .92, bumpMap: noise, bumpScale: .022 }),
    tea: new THREE.MeshStandardMaterial({ color: '#795536', roughness: .28 }),
    stoneLight: new THREE.MeshStandardMaterial({ color: '#d6cbb4', roughness: .86, bumpMap: noise, bumpScale: .018 }),
    paving: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .92, bumpMap: noise, bumpScale: .012 }),
    plaster: new THREE.MeshStandardMaterial({ color: '#e5d7bc', roughness: .93, bumpMap: noise, bumpScale: .014 }),
    metal: new THREE.MeshStandardMaterial({ color: '#494e45', roughness: .57, metalness: .45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#42717a', roughness: .12, metalness: .48, clearcoat: .6 }),
    roof: new THREE.MeshStandardMaterial({ color: '#506864', roughness: .72, metalness: .08 }),
    foliage: new THREE.MeshStandardMaterial({ color: '#ffffff', map: leafMap, bumpMap: leafMap, bumpScale: .008, roughness: .74, side: THREE.DoubleSide, emissive: '#78944f', emissiveIntensity: .035 }),
    bark: new THREE.MeshStandardMaterial({ color: '#74644c', roughness: .95, bumpMap: noise, bumpScale: .015 }),
    flower: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .86 }),
    water: new THREE.MeshPhysicalMaterial({ color: '#77a8aa', roughness: .24, metalness: .2, clearcoat: .7 }),
  };
  materials.scarf.map = knit; materials.scarf.bumpMap = knit; materials.scarf.bumpScale = .009; materials.scarf.color.set('#fff8e6');
  // Use the already approved real felt surface as a PBR surface map. The body
  // remains a full 3D mesh; this is not a character image projected on a plane.
  try {
    const feltSurface = await new THREE.TextureLoader().loadAsync(new URL('./assets/felt-coral.webp', import.meta.url).href);
    feltSurface.colorSpace = THREE.SRGBColorSpace; feltSurface.wrapS = feltSurface.wrapT = THREE.RepeatWrapping; feltSurface.repeat.set(2.1, 1.4);
    feltSurface.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    materials.coral.map = feltSurface; materials.coral.bumpMap = feltSurface; materials.coral.bumpScale = .016; materials.coral.color.set('#ffe3d9'); materials.coral.needsUpdate = true;
    const softCoral = new THREE.Color('#e4786b');
    materials.coral.onBeforeCompile = shader => { shader.uniforms.softCoral = { value: softCoral }; shader.fragmentShader = `uniform vec3 softCoral;\n${shader.fragmentShader}`.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, softCoral, 0.17);'); };
  } catch { /* The procedural felt remains available if the optional map fails. */ }
  const ambient = new THREE.HemisphereLight('#d6e9f5', '#8e8066', .92); scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff0d1', 2.75); key.position.set(-3.5, 6, 4.5); key.castShadow = true; key.shadow.mapSize.set(isMobile() ? 1024 : 2048, isMobile() ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -5.6, right: 5.6, top: 5.6, bottom: -5.6, near: .5, far: 22 }); key.shadow.normalBias = .018; key.shadow.bias = -.0003; key.shadow.radius = 5; key.shadow.blurSamples = 8; scene.add(key);
  const fill = new THREE.DirectionalLight('#b9dce4', .36); fill.position.set(3, 4, -4); scene.add(fill);
  const bounce = new THREE.DirectionalLight('#ead6ba', .28); bounce.position.set(0, 1, 5); scene.add(bounce);
  // A deliberately broad lit environment creates coherent reflections in the
  // eyes and glaze without shipping a photographic HDR background.
  const environment = canvasTexture(256, (ctx, s) => { const g = ctx.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#e7f0e9'); g.addColorStop(.45, '#e9e8d9'); g.addColorStop(.5, '#f5eddc'); g.addColorStop(.6, '#9fa598'); g.addColorStop(1, '#afb6a3'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#fff9e9'; ctx.fillRect(45, 30, 24, 60); }, [1, 1], true);
  environment.mapping = THREE.EquirectangularReflectionMapping; const pmrem = new THREE.PMREMGenerator(renderer), envTarget = pmrem.fromEquirectangular(environment); scene.environment = envTarget.texture; scene.environmentIntensity = .30;
  const skyTextures = {}, skyTargets = {}, assetLoads = [];
  const loader = new THREE.TextureLoader();
  const skySuffix = isMobile() ? '-mobile' : '';
  for (const [name, filename] of [['day', `azure-sky-v3${skySuffix}.jpg`], ['sunset', `golden-sky-v3${skySuffix}.jpg`]]) {
    assetLoads.push(loader.loadAsync(new URL(`./scene-assets/graphics-v2/${filename}`, import.meta.url).href).then(texture => {
      texture.colorSpace = THREE.SRGBColorSpace; texture.mapping = THREE.EquirectangularReflectionMapping;
      skyTextures[name] = texture; skyTargets[name] = pmrem.fromEquirectangular(texture);
    }).catch(() => {}));
  }
  assetLoads.push(loader.loadAsync(new URL('./scene-assets/graphics-v2/terrain-normal.jpg', import.meta.url).href).then(texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3);
    materials.paving.normalMap = texture; materials.paving.normalScale.set(.12, .12); materials.paving.needsUpdate = true;
  }).catch(() => {}));
  assetLoads.push(loader.loadAsync(new URL('./scene-assets/graphics-v2/cliff-normal.jpg', import.meta.url).href).then(texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2);
    materials.stone.normalMap = texture; materials.stone.normalScale.set(.14, .14); materials.stone.needsUpdate = true;
  }).catch(() => {}));
  await Promise.all(assetLoads); pmrem.dispose();
  scene.background = skyTextures.day || scene.background; scene.environment = skyTargets.day?.texture || envTarget.texture;
  scene.backgroundRotation.y = .65; scene.environmentRotation.y = .65; scene.backgroundIntensity = .95;
  const garden = makeCourtyard(world, materials, { mobile: isMobile() });
  contactShadow(world, [0, .240, .5], [2.15, 1.50], .52);
  const table = new THREE.Group(); table.position.set(-1.68, .27, .57); world.add(table);
  mesh(table, new THREE.CylinderGeometry(.38, .395, .075, 48), materials.stoneLight, [0, .48, 0]);
  mesh(table, new THREE.CylinderGeometry(.10, .18, .44, 32), materials.stoneLight, [0, .235, 0]);
  contactShadow(table, [0, -.025, 0], [.90, .90], .30); makeMug(table, materials, [-.085, .522, .04]);
  const book = mesh(table, roundedBox(.24, .036, .20, .014), materials.sage, [.13, .531, -.07]); book.rotation.y = -.2;
  const { mascot, scarf, apron } = makeMascot(world, materials, isMobile());
  const backdrop = makeLandscape(scene, materials);
  let disposed = false, visible = true, raf = 0, frameCount = 0, previousTime = 0, outfit = 'apron', time = 'day', yaw = 0, targetYaw = 0, greetingAt = -10000;
  let dragging = false, pointerX = 0, startYaw = 0, dirty = true, lastFrameAt = 0;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)'); let minimizeMotion = reducedMotion || motionQuery.matches;
  const target = new THREE.Vector3(0, 1.08, 0);
  function resize() {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight), aspect = width / height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 600 ? 1.5 : 2)); renderer.setSize(width, height, false); camera.aspect = aspect;
    camera.fov = 37; const distance = aspect < 1.0 ? 6.05 : aspect < 1.6 ? 6.55 : 6.4;
    const lookX = aspect >= 1.6 ? -1.05 : 0;
    target.set(lookX, 1.10, -.1); camera.position.set(lookX + .30, 2.56, distance); camera.lookAt(target); camera.updateProjectionMatrix(); dirty = true; schedule();
  }
  function renderFrame(now) {
    raf = 0; if (disposed || !visible || document.hidden) return;
    // A calm home uses a capped 30 Hz loop. Gestures and export force a frame.
    if (!minimizeMotion && now - lastFrameAt < 31 && !dirty) { schedule(); return; }
    lastFrameAt = now; const dt = Math.min(.1, (now - (previousTime || now)) / 1000); previousTime = now;
    yaw += (targetYaw - yaw) * Math.min(1, dt * 9); world.rotation.y = yaw;
    const greeting = (now - greetingAt) / 1000;
    if (!minimizeMotion) {
      const active = greeting >= 0 && greeting < 1.2;
      mascot.position.y = .27 + (active ? Math.sin(greeting * Math.PI / 1.2) * .12 : Math.sin(now * .0017) * .011);
      mascot.rotation.z = active ? Math.sin(greeting * TAU / 1.2) * .105 : Math.sin(now * .0008) * .009;
      mascot.scale.set(1, 1 + Math.sin(now * .0017) * .005, 1);
    } else { mascot.position.y = .27; mascot.rotation.z = 0; mascot.scale.setScalar(1); }
    renderer.render(scene, camera); frameCount++; dirty = false;
    if (!minimizeMotion || Math.abs(targetYaw - yaw) > .001) schedule();
  }
  function schedule() { if (!raf && !disposed && visible && !document.hidden) raf = requestAnimationFrame(renderFrame); }
  function forceFrame() { dirty = true; schedule(); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) { previousTime = 0; forceFrame(); } else { cancelAnimationFrame(raf); raf = 0; } }, { threshold: 0.01 }); intersection.observe(container);
  function visibilityChange() { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else { previousTime = 0; forceFrame(); } }
  function motionChange() { minimizeMotion = reducedMotion || motionQuery.matches; forceFrame(); }
  function pointerDown(e) { if (e.button !== 0 && e.pointerType === 'mouse') return; dragging = true; pointerX = e.clientX; startYaw = targetYaw; canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = 'grabbing'; }
  function pointerMove(e) { if (!dragging) return; targetYaw = clamp(startYaw + (e.clientX - pointerX) * .0035, -.35, .35); forceFrame(); }
  function pointerUp() { dragging = false; canvas.style.cursor = 'grab'; }
  function keyDown(e) { if (['ArrowLeft', 'ArrowRight', 'Home', 'Enter', ' '].includes(e.key)) e.preventDefault(); if (e.key === 'ArrowLeft') targetYaw = clamp(targetYaw - .09, -.35, .35); if (e.key === 'ArrowRight') targetYaw = clamp(targetYaw + .09, -.35, .35); if (e.key === 'Home') targetYaw = 0; if (e.key === 'Enter' || e.key === ' ') greet(); forceFrame(); }
  function greet() { greetingAt = performance.now(); forceFrame(); }
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp); canvas.addEventListener('keydown', keyDown);
  document.addEventListener('visibilitychange', visibilityChange); motionQuery.addEventListener?.('change', motionChange);
  function contextLost(event) { event.preventDefault(); cancelAnimationFrame(raf); raf = 0; onError(new Error('3D 그래픽 연결이 잠시 끊겼어요. 새로고침하면 다시 볼 수 있어요.')); }
  canvas.addEventListener('webglcontextlost', contextLost);
  function setOutfit(value) { outfit = ['none', 'scarf', 'apron', 'scarf-apron'].includes(value) ? value : 'none'; scarf.visible = outfit === 'scarf' || outfit === 'scarf-apron'; apron.visible = outfit === 'apron' || outfit === 'scarf-apron'; forceFrame(); return outfit; }
  function setTime(value) {
    time = value === 'sunset' ? 'sunset' : 'day'; const sunset = time === 'sunset';
    scene.fog.color.set(sunset ? '#d6b8a5' : '#bad0ce');
    key.color.set(sunset ? '#ffc18b' : '#fff0d1'); key.intensity = sunset ? 3.0 : 2.75; key.position.set(sunset ? -6 : -3.5, sunset ? 3.2 : 6, sunset ? 3 : 4.5);
    ambient.color.set(sunset ? '#c6c9e5' : '#d6e9f5'); ambient.groundColor.set(sunset ? '#907561' : '#8e8066'); ambient.intensity = sunset ? .76 : .92;
    fill.color.set(sunset ? '#aab8e1' : '#b9dce4'); fill.intensity = sunset ? .39 : .36;
    scene.background = skyTextures[time] || new THREE.Color(sunset ? '#d6b8a5' : '#b7d4df');
    scene.environment = skyTargets[time]?.texture || envTarget.texture; scene.backgroundIntensity = sunset ? .80 : .95;
    renderer.toneMappingExposure = sunset ? 1.03 : 1.05;
    forceFrame(); return time;
  }
  function metrics() { return { renderer: `Three.js r${THREE.REVISION}`, graphicsVersion: 2, drawingBuffer: { width: canvas.width, height: canvas.height }, dpr: renderer.getPixelRatio(), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lines: renderer.info.render.lines, instancedFoliage: garden.foliageCount, frameCount, outfit, time, paused: !visible || document.hidden, reducedMotion: minimizeMotion, productionAsset: false }; }
  function capture() { renderer.render(scene, camera); const data = canvas.toDataURL('image/png'); forceFrame(); return data; }
  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(raf); resizeObserver.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', visibilityChange); motionQuery.removeEventListener?.('change', motionChange);
    for (const [type, fn] of [['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerUp], ['pointercancel', pointerUp], ['keydown', keyDown], ['webglcontextlost', contextLost]]) canvas.removeEventListener(type, fn);
    const geometries = new Set(), materialSet = new Set(Object.values(materials)), textures = new Set([bump, grain, noise, leafMap, knit, environment, ...Object.values(skyTextures)]);
    scene.traverse(object => {
      // Instance transforms/colors have their own GPU buffers, separate from
      // the shared geometry; geometry.dispose() does not release those.
      if (object.isInstancedMesh) object.dispose();
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      list.forEach(m => { materialSet.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); });
    });
    key.shadow.dispose();
    geometries.forEach(g => g.dispose()); materialSet.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); envTarget.dispose(); Object.values(skyTargets).forEach(t => t.dispose());
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  }
  const api = { setOutfit, setTime, greet, capture, dispose, metrics };
  resize(); renderer.render(scene, camera); onReady(api); schedule(); return api;
}
