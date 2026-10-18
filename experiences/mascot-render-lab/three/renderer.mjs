import * as THREE from '../../korean-racing/vendor/three.module.js';
import { createWardrobeMaterials } from './materials.mjs';
import { clothShellGeometry, addSeamStitches, pocketGussetGeometry } from './cloth-geometry.mjs';
import { KKAMONG_PROTOTYPE_V1 } from './character-contract.mjs';

// Geometry study, not an approved replacement for the 4K mascot.
// Eye proportions and the stitched two-part tail refer to tools/몽글친구굽기.py.
// No mascot image is projected onto a plane or used as a billboard.
const clamp = THREE.MathUtils.clamp;
const BODY = KKAMONG_PROTOTYPE_V1.body;
const { standardPose: REST_POSE, attachments: ATTACHMENTS, face: FACE } = KKAMONG_PROTOTYPE_V1;

function seeded(seed = 61009) {
  let n = seed >>> 0;
  return () => { n = (1664525 * n + 1013904223) >>> 0; return n / 4294967296; };
}

function ellipsoidGeometry(scale, segments = 48) {
  const geometry = new THREE.SphereGeometry(1, segments, Math.floor(segments / 2));
  const a = geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    const irregular = 1 + 0.012 * Math.sin(x * 19 + y * 13) * Math.cos(z * 17 - y * 5);
    a.setXYZ(i, x * scale.x * irregular, y * scale.y * irregular, z * scale.z * irregular);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function furShell(scale, count, length, seed, exclude = () => false) {
  const rand = seeded(seed), positions = [], colors = [];
  const root = new THREE.Color('#3a2e2c'), tip = new THREE.Color('#817067');
  const normal = new THREE.Vector3(), tangent = new THREE.Vector3(), color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const y = 2 * rand() - 1, phi = rand() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    const x = Math.cos(phi) * r, z = Math.sin(phi) * r;
    const p = new THREE.Vector3(x * scale.x, y * scale.y, z * scale.z);
    if (exclude(p)) continue;
    normal.set(x / scale.x, y / scale.y, z / scale.z).normalize();
    tangent.set(rand() - 0.5, -0.45 - rand() * 0.5, rand() - 0.5).addScaledVector(normal, -0.2).normalize();
    const len = length * (0.45 + rand() * 0.8);
    const middle = p.clone().addScaledVector(normal, len * 0.56).addScaledVector(tangent, len * 0.17);
    const end = p.clone().addScaledVector(normal, len * 0.75).addScaledVector(tangent, len * 0.55);
    const values = [p, middle, middle, end];
    const shade = rand() * 0.4;
    values.forEach((v, j) => {
      positions.push(v.x, v.y, v.z);
      color.copy(root).lerp(tip, shade + j * 0.045); colors.push(color.r, color.g, color.b);
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.66, depthWrite: false }));
  mesh.userData.fullVertexCount = positions.length / 3;
  return mesh;
}

function addMesh(parent, geometry, material, position = [0, 0, 0], scale = null) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function tube(parent, points, radius, material, closed = false, fitBody = false) {
  const original = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', 0.3);
  let curve = original;
  if (fitBody) {
    // Project the entire spline, not just its control points, onto the body's
    // ellipsoid; this prevents an interpolated shoulder strap dipping inside it.
    curve = new class extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        original.getPoint(t, target); target.y -= BODY.centerY;
        const factor = Math.sqrt((target.x / BODY.x) ** 2 + (target.y / BODY.y) ** 2 + (target.z / BODY.z) ** 2);
        target.divideScalar(Math.max(0.001, factor));
        const normal = new THREE.Vector3(target.x / BODY.x ** 2, target.y / BODY.y ** 2, target.z / BODY.z ** 2).normalize();
        target.addScaledVector(normal, radius + 0.010); target.y += BODY.centerY; return target;
      }
    }();
  }
  const mesh = addMesh(parent, new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 8, closed), material);
  mesh.userData.coverageCurve = curve; mesh.userData.coverageRadius = radius; return mesh;
}

function clothPanel(parent, material, edgeMaterial, { width = 0.52, top = 0.98, bottom = 0.30, offset = 0.061, topWidth = 0.56, thickness = 0.022, folds = 0.014 } = {}) {
  const at = (u, v) => {
    const y = top + (bottom - top) * v;
    const half = width * (topWidth + (1 - topWidth) * Math.sin(v * Math.PI * 0.72));
    const x = (2 * u - 1) * half;
    // Large folds change the silhouette and lighting; the material supplies only the fine weave.
    const drape = folds * Math.sin(u * Math.PI * 4 + v * 1.35) * Math.sin(v * Math.PI) * Math.sin(u * Math.PI);
    const z = BODY.z * Math.sqrt(Math.max(0.03, 1 - (x / BODY.x) ** 2 - ((y - BODY.centerY) / BODY.y) ** 2)) + offset + drape;
    return [x, y, z];
  };
  const geometry = clothShellGeometry(THREE, at, { thickness });
  const panel = addMesh(parent, geometry, [material, edgeMaterial || material]); panel.name = 'cotton-apron-closed-shell';
  if (edgeMaterial) {
    const edge = [];
    for (let i = 0; i <= 12; i++) edge.push(at(0, i / 12));
    for (let i = 1; i <= 16; i++) edge.push(at(i / 16, 1));
    for (let i = 1; i <= 12; i++) edge.push(at(1, 1 - i / 12));
    tube(parent, edge, 0.014, edgeMaterial);
  }
  return { panel, at };
}

function contactTexture() {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
    const n = (y * size + x) * 4;
    pixels[n] = 48; pixels[n + 1] = 35; pixels[n + 2] = 27; pixels[n + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 75);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat); texture.needsUpdate = true;
  texture.magFilter = texture.minFilter = THREE.LinearFilter; return texture;
}

function furWithoutApronCoverage(geometry, panelAt, coverageTubes = []) {
  const input = geometry.attributes.position, inputColor = geometry.attributes.color;
  const positions = [], colors = [], top = panelAt(0.5, 0)[1], bottom = panelAt(0.5, 1)[1];
  const margin = 0.055;
  const worldPoint = new THREE.Vector3();
  const fittedTubes = coverageTubes.map(mesh => {
    const points = mesh.userData.coverageCurve.getPoints(112), radius = mesh.userData.coverageRadius + 0.024;
    return { points, radiusSquared: radius ** 2, bounds: new THREE.Box3().setFromPoints(points).expandByScalar(radius) };
  });
  // A fiber is two connected 3D line segments (four vertices). Keep or remove it
  // as a whole; partially drawing a hidden root could leave floating fur tips.
  for (let i = 0; i < input.count; i += 4) {
    let covered = false;
    for (let j = 0; j < 4; j++) {
      const n = i + j, worldY = input.getY(n) + BODY.centerY;
      if (input.getZ(n) > 0 && worldY >= bottom - margin && worldY <= top + margin) {
        const v = clamp((top - worldY) / (top - bottom), 0, 1);
        const halfWidth = Math.abs(panelAt(1, v)[0]);
        if (Math.abs(input.getX(n)) < halfWidth + margin) { covered = true; break; }
      }
      worldPoint.set(input.getX(n), worldY, input.getZ(n));
      if (fittedTubes.some(coveredTube => coveredTube.bounds.containsPoint(worldPoint) && coveredTube.points.some(p => p.distanceToSquared(worldPoint) < coveredTube.radiusSquared))) { covered = true; break; }
    }
    if (covered) continue;
    for (let j = 0; j < 4; j++) {
      const n = i + j;
      positions.push(input.getX(n), input.getY(n), input.getZ(n));
      colors.push(inputColor.getX(n), inputColor.getY(n), inputColor.getZ(n));
    }
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  result.computeBoundingSphere();
  return result;
}

export function createThreeLab(container, { onStats = () => {} } = {}) {
  if (!container?.appendChild) throw new TypeError('A visible container element is required.');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement; canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px';
  canvas.tabIndex = 0; canvas.setAttribute('aria-label', '실제 3D 메시 시험. 드래그 또는 방향키로 카메라를 돌리고, 휠 또는 더하기 빼기로 확대합니다.');
  container.appendChild(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(KKAMONG_PROTOTYPE_V1.backgrounds.paper);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  const target = new THREE.Vector3(0.21, 1.1, 0), rig = new THREE.Group(); scene.add(rig);
  rig.position.set(...REST_POSE.position); rig.rotation.set(...REST_POSE.rotation); rig.scale.set(...REST_POSE.scale);
  rig.userData.characterContract = KKAMONG_PROTOTYPE_V1.id; rig.userData.standardPose = REST_POSE.id;
  scene.add(new THREE.HemisphereLight('#f4f6ff', '#b8a49a', 1.75));
  const key = new THREE.DirectionalLight('#fff1df', 3.1); key.position.set(-3.5, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2.25; key.shadow.camera.right = 2.25; key.shadow.camera.top = 2.4; key.shadow.camera.bottom = -1.3; key.shadow.camera.near = 0.1; key.shadow.camera.far = 15; key.shadow.normalBias = 0.006; key.shadow.bias = -0.00004; key.shadow.radius = 2; key.target.position.set(0.1, 1.0, 0); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#dce8ff', 2.4); rim.position.set(4, 3.5, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffffff', 0.45); fill.position.set(0, 1, 6); scene.add(fill);
  const floor = addMesh(scene, new THREE.CircleGeometry(6, 80), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), [0, -0.02, 0]); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const materialKit = createWardrobeMaterials(THREE);
  const { feltBrown: brown, innerEar, tailCoral: coral, tailDark: blackFin, knitCream, knitCoral, cottonCream, cottonTrim, cottonStitch } = materialKit;
  const managedMaterials = new Set(Object.values(materialKit).filter(value => value?.isMaterial));
  const woodProfile = [[0, -0.04], [1.01, -0.04], [1.07, -0.025], [1.09, 0.005], [1.09, 0.035], [1.07, 0.06], [1.01, 0.075]].map(([r, y]) => new THREE.Vector2(r, y));
  const stand = addMesh(scene, new THREE.LatheGeometry(woodProfile, 80), materialKit.wood, [0.035, 0.04, 0]); stand.name = 'small-solid-wood-stand';
  // Lathe UVs collapse at the pole and turn a linear grain into a starburst.
  // The separate cap uses CircleGeometry's planar XY UV, then lies in XZ.
  const standTop = addMesh(scene, new THREE.CircleGeometry(1.012, 80), materialKit.wood, [0.035, 0.11505, 0]); standTop.rotation.x = -Math.PI / 2; standTop.name = 'wood-stand-planar-grain-cap';
  const contactMap = contactTexture();
  const contact = addMesh(scene, new THREE.PlaneGeometry(0.92, 0.70), new THREE.MeshBasicMaterial({ map: contactMap, transparent: true, depthWrite: false, toneMapped: false }), [0, 0.116, 0]); contact.rotation.x = -Math.PI / 2; contact.castShadow = contact.receiveShadow = false; contact.name = 'soft-contact-occlusion';
  const fibers = [];
  const fuzzy = (parent, scale, position, count, length, seed, exclude) => {
    const g = new THREE.Group(); g.position.set(...position); parent.add(g);
    addMesh(g, ellipsoidGeometry(scale), brown);
    const hair = furShell(scale, count, length, seed, exclude); g.add(hair); fibers.push(hair); return g;
  };
  const body = fuzzy(rig, BODY, [0, BODY.centerY, 0], 18000, 0.060, 41, p => p.z > 0.4 && [-FACE.eyeOffsetX, FACE.eyeOffsetX].some(x => Math.hypot(p.x - x, p.y - (FACE.eyeY - BODY.centerY)) < 0.14));
  body.name = 'rounded-body';
  const bodyFur = body.children.find(object => object.isLineSegments);
  const baseBodyFur = bodyFur.geometry;
  for (const side of [-1, 1]) {
    const { position, earOffsetX, earRotationZ } = ATTACHMENTS.head;
    const ear = fuzzy(rig, { x: 0.168, y: 0.31, z: 0.165 }, [position[0] + side * earOffsetX, position[1], position[2]], 1800, 0.041, 53 + side);
    ear.rotation.z = side * -earRotationZ;
    addMesh(ear, ellipsoidGeometry({ x: 0.095, y: 0.175, z: 0.029 }, 28), innerEar, [0, 0.045, 0.15]);
  }
  const arms = [];
  for (const { side, position } of Object.values(ATTACHMENTS.frontPaws)) {
    const pivot = new THREE.Group(); pivot.position.set(...position); pivot.rotation.z = REST_POSE.frontPawRotationZ; rig.add(pivot);
    fuzzy(pivot, { x: 0.14, y: 0.28, z: 0.145 }, [side * 0.135, 0.13, 0], 1600, 0.040, 67 + side).rotation.z = side * -0.6;
    arms.push({ side, pivot });
  }
  const eyeRoots = [];
  const irisMat = new THREE.MeshPhysicalMaterial({ color: '#79a950', roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: '#090b07', roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.04 });
  const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const side of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(side * FACE.eyeOffsetX, FACE.eyeY, FACE.eyeZ); eye.scale.y = REST_POSE.eyeOpenScaleY; rig.add(eye);
    addMesh(eye, new THREE.SphereGeometry(FACE.irisRadius, 40, 24), irisMat, [0, 0, 0], [1, 1, 0.57]);
    addMesh(eye, new THREE.SphereGeometry(FACE.pupilRadius, 32, 20), pupilMat, [0, 0, 0.056], [1, 1, 0.68]);
    addMesh(eye, new THREE.SphereGeometry(0.021, 16, 10), glintMat, [-0.029, 0.035, 0.102], [0.87, 1.1, 0.45]);
    eyeRoots.push(eye);
  }
  const tail = new THREE.Group(); tail.rotation.y = REST_POSE.tailRotationY; rig.add(tail);
  tube(tail, [[0.48, 0.56, -0.22], [0.88, 0.39, -0.22], [1.18, 0.25, -0.02], [1.33, 0.34, 0.14]], 0.091, brown);
  const finRoot = new THREE.Group(); finRoot.position.set(1.33, 0.39, 0.14); tail.add(finRoot);
  const fin = addMesh(finRoot, ellipsoidGeometry({ x: 0.16, y: 0.27, z: 0.038 }, 40), coral, [0.05, 0.17, 0.02]); fin.rotation.z = -0.35;
  const dark = addMesh(finRoot, ellipsoidGeometry({ x: 0.135, y: 0.21, z: 0.035 }, 32), blackFin, [0.10, -0.13, 0]); dark.rotation.z = 0.6;
  for (let i = 0; i < 4; i++) {
    const y = -0.015 + i * 0.112, x = -0.072 + Math.sin(i / 3 * Math.PI) * 0.018;
    const stitch = addMesh(finRoot, new THREE.CapsuleGeometry(0.010, 0.030, 4, 8), cottonStitch, [x + y * 0.32, y + 0.02, 0.065]); stitch.rotation.z = -0.42;
  }

  const costumeContract = KKAMONG_PROTOTYPE_V1.costumeCompatibility;
  const costumeRoots = Object.fromEntries(Object.keys(costumeContract.costumes).map(name => [name, new THREE.Group()]));
  Object.entries(costumeRoots).forEach(([name, group]) => { group.name = `costume-${name}`; group.visible = name === 'none'; group.userData.bodyContract = costumeContract.bodyContract; group.userData.anchors = costumeContract.costumes[name].anchors; rig.add(group); });
  const scarf = costumeRoots.scarf;
  // Separate knitted collar: real volume and a material with V-shaped yarn loops.
  for (let i = 0; i < 16; i++) {
    const points = [];
    for (let j = 0; j <= 6; j++) { const t = (i + j / 6) / 16 * Math.PI * 2, neck = ATTACHMENTS.neck; points.push([neck.position[0] + Math.cos(t) * neck.radii[0], neck.position[1] + neck.collarWaveY * Math.sin(t), neck.position[2] + Math.sin(t) * neck.radii[1]]); }
    tube(scarf, points, 0.091, i % 2 ? knitCoral : knitCream);
  }
  for (const side of [-1, 1]) {
    const end = new THREE.Group(); end.position.set(side * 0.115, 0.89, 0.65); end.rotation.z = side * 0.23; scarf.add(end);
    const endAt = (u, v) => [(u - 0.5) * (0.19 - v * 0.012), 0.044 - v * 0.36, 0.035 + Math.sin(v * Math.PI) * 0.021 + Math.sin(u * Math.PI * 2) * 0.003];
    for (let i = 0; i < 4; i++) {
      const knit = i % 2 ? knitCream : knitCoral;
      const endGeometry = clothShellGeometry(THREE, (u, v) => endAt(u, (i + v) / 4), { rows: 6, cols: 12, thickness: 0.054 });
      // A continuous UV spans all four color bands, so each band does not
      // restart a complete knitted tile and make the end four times denser.
      const uv = endGeometry.attributes.uv;
      for (let n = 0; n < 2 * 7 * 13; n++) uv.setXY(n, uv.getX(n) * 0.75, (i + uv.getY(n)) / 4);
      addMesh(end, endGeometry, [knit, knit]);
    }
    for (let i = 0; i < 5; i++) tube(end, [[(i - 2) * 0.033, -0.30, 0.015], [(i - 2) * 0.033 + 0.008, -0.395, 0.025]], 0.008, i % 2 ? knitCream : knitCoral);
  }
  const apron = costumeRoots.apron;
  const apronPanel = clothPanel(apron, cottonCream, cottonTrim);
  const apronCoverageTubes = [];
  const waist = [];
  for (let i = 0; i < 32; i++) { const t = i / 32 * Math.PI * 2, anchor = ATTACHMENTS.waist; waist.push([anchor.position[0] + Math.cos(t) * anchor.radii[0], anchor.position[1], anchor.position[2] + Math.sin(t) * anchor.radii[1]]); }
  apronCoverageTubes.push(tube(apron, waist, 0.024, cottonCream, true, true));
  for (const side of [-1, 1]) apronCoverageTubes.push(tube(apron, [[side * 0.285, 0.98, 0.58], [side * 0.49, 1.20, 0.48], [side * 0.52, 1.47, 0.18], [side * 0.47, 1.23, -0.42], [side * 0.39, 0.95, -0.49]], 0.021, cottonCream, false, true));
  const apronBodyFur = furWithoutApronCoverage(baseBodyFur, apronPanel.at, apronCoverageTubes);
  const seamPaths = [[], [], [], []];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    seamPaths[0].push(apronPanel.at(0.045, 0.04 + t * 0.91)); seamPaths[1].push(apronPanel.at(0.955, 0.04 + t * 0.91));
    seamPaths[2].push(apronPanel.at(0.06 + t * 0.88, 0.945)); seamPaths[3].push(apronPanel.at(0.06 + t * 0.88, 0.05));
  }
  addSeamStitches(THREE, apron, seamPaths, cottonStitch);
  const pocketBackAt = (u, v) => {
    const y = 0.73 - v * 0.25, x = (u - 0.5) * 0.43, apronV = (0.98 - y) / 0.68;
    const apronHalfWidth = apronPanel.at(1, apronV)[0];
    const p = apronPanel.at((x / apronHalfWidth + 1) / 2, apronV); p[2] += 0.006; return p;
  };
  const pocketAt = (u, v) => { const p = pocketBackAt(u, v); p[2] += 0.019 + 0.075 * Math.sin(u * Math.PI) * (1 - v * 0.78); p[1] -= 0.014 * Math.sin(u * Math.PI) * (1 - v); return p; };
  const pocket = { at: pocketAt };
  const pocketMesh = addMesh(apron, clothShellGeometry(THREE, pocketAt, { rows: 16, cols: 24, thickness: 0.015 }), [cottonCream, cottonTrim]); pocketMesh.name = 'open-pocket-thick-front';
  const pocketGussets = addMesh(apron, pocketGussetGeometry(THREE, pocketAt, pocketBackAt), cottonCream); pocketGussets.name = 'open-pocket-side-bottom-volume';
  const pocketEdge = [];
  for (let i = 0; i <= 12; i++) pocketEdge.push(pocket.at(i / 12, 0));
  tube(apron, pocketEdge, 0.010, cottonTrim);
  const pocketSeams = [[], [], []];
  for (let i = 0; i <= 18; i++) { const t = i / 18; pocketSeams[0].push(pocketAt(0.06, 0.08 + t * 0.86)); pocketSeams[1].push(pocketAt(0.94, 0.08 + t * 0.86)); pocketSeams[2].push(pocketAt(0.06 + t * 0.88, 0.94)); }
  addSeamStitches(THREE, apron, pocketSeams, cottonStitch, { radius: 0.0025, lift: 0.005 });

  let disposed = false, contextLost = false, quality = 'high', costume = 'none', motion = 'idle', view = 'full', background = 'paper', yaw = 0, pitch = 0.12, distance = 5.6, frame = 0;
  let lastFrame = performance.now(), lastReport = lastFrame, frameCount = 0, fps = 0, elapsed = 0, motionStart = 0, pause = false;
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = !!media?.matches;
  const updateFurQuality = () => {
    for (const fiber of fibers) {
      const count = fiber.geometry.attributes.position.count;
      fiber.geometry.setDrawRange(0, Math.floor(count * (quality === 'low' ? 0.3 : 1) / 4) * 4);
    }
  };
  const onReduced = e => { reduced = e.matches; }; media?.addEventListener?.('change', onReduced);
  let dragging = null;
  const updateCamera = () => {
    const fittedDistance = distance * (view === 'full' ? Math.max(1, 0.92 / camera.aspect) : 1);
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * fittedDistance, target.y + Math.sin(pitch) * fittedDistance, target.z + Math.cos(yaw) * Math.cos(pitch) * fittedDistance); camera.lookAt(target);
  };
  const resize = () => {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight || width);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1)); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); updateCamera();
  };
  const stats = () => {
    let meshCount = 0; rig.traverse(o => { if (o.isMesh) meshCount++; });
    return { renderer: 'three', actual3D: true, approvedBrandModel: false, characterContract: KKAMONG_PROTOTYPE_V1.id, contextLost, paused: pause, reducedMotion: reduced, quality, costume, motion, view, background, fps: Math.round(fps), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lineSegments: renderer.info.render.lines, meshCount, billboardCount: 0, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), yaw: Math.round(THREE.MathUtils.radToDeg(yaw)), pitch: Math.round(THREE.MathUtils.radToDeg(pitch)), canvas: [canvas.width, canvas.height], shadowMapSize: key.shadow.mapSize.x, shadowsEnabled: renderer.shadowMap.enabled, materials: materialKit.descriptors, geometryFeatures: { apronThickness: 0.022, sewnThreadMeshes: true, openPocket: true, coveredBodyFurHidden: costume === 'apron', woodStand: true, contactOcclusion: 'soft ground approximation plus real shadow map' }, fidelityNote: '승인 4K 얼굴과 털을 완전히 재현한 최종 모델이 아닌 시제품' };
  };
  const pointerDown = e => { dragging = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture?.(e.pointerId); canvas.focus({ preventScroll: true }); };
  const pointerMove = e => { if (!dragging || e.pointerId !== dragging.id) return; yaw -= (e.clientX - dragging.x) * 0.009; pitch = clamp(pitch + (e.clientY - dragging.y) * 0.007, -0.12, 0.80); dragging.x = e.clientX; dragging.y = e.clientY; updateCamera(); };
  const pointerUp = e => { if (dragging?.id === e.pointerId) { if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId); dragging = null; } };
  const zoom = amount => { distance = clamp(distance + amount, view === 'detail' ? 2.5 : 3.6, view === 'detail' ? 4.3 : 8); updateCamera(); };
  const wheel = e => { e.preventDefault(); zoom(e.deltaY * 0.003); };
  const keyboard = e => { let handled = true; if (e.key === 'ArrowLeft') yaw -= 0.15; else if (e.key === 'ArrowRight') yaw += 0.15; else if (e.key === 'ArrowUp') pitch = clamp(pitch + 0.08, -0.12, 0.8); else if (e.key === 'ArrowDown') pitch = clamp(pitch - 0.08, -0.12, 0.8); else if (e.key === '+' || e.key === '=') zoom(-0.3); else if (e.key === '-') zoom(0.3); else handled = false; if (handled) { e.preventDefault(); updateCamera(); } };
  const lost = e => { e.preventDefault(); contextLost = true; fps = 0; onStats(stats()); };
  const restored = () => { if (disposed) return; contextLost = false; lastFrame = performance.now(); frameCount = 0; lastReport = lastFrame; resize(); onStats(stats()); };
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp); canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('keydown', keyboard); canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
  const observer = new ResizeObserver(resize); observer.observe(container); resize(); updateCamera();
  const tick = now => {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
    if (pause || contextLost || document.hidden) return;
    elapsed += dt; const t = elapsed - motionStart;
    // Explicit test actions may run with reduce-motion; ambient movement stays off.
    rig.scale.y = !reduced && motion !== 'still' ? REST_POSE.scale[1] + Math.sin(elapsed * 1.8) * 0.007 : REST_POSE.scale[1];
    const blinkPhase = motion === 'blink' ? t % 1.6 : elapsed % 4.6;
    const blink = (!reduced || motion === 'blink') && motion !== 'still' && blinkPhase > 0.12 && blinkPhase < 0.36 ? Math.sin((blinkPhase - 0.12) / 0.24 * Math.PI) : 0;
    for (const eye of eyeRoots) eye.scale.y = REST_POSE.eyeOpenScaleY - blink * 0.94;
    for (const arm of arms) arm.pivot.rotation.z = REST_POSE.frontPawRotationZ + (motion === 'wave' && arm.side === 1 ? -0.32 + Math.sin(t * 8) * 0.32 : 0);
    tail.rotation.y = REST_POSE.tailRotationY + (!reduced && motion !== 'still' ? Math.sin(elapsed * 1.7) * 0.035 : 0);
    if (motion === 'turn' && !dragging) { yaw += dt * 0.4; updateCamera(); }
    renderer.render(scene, camera); frameCount++;
    if (now - lastReport >= 650) { fps = frameCount * 1000 / (now - lastReport); frameCount = 0; lastReport = now; onStats(stats()); }
  };
  frame = requestAnimationFrame(tick);
  return {
    canvas,
    setCostume(value) { const next = value === 'basic' ? 'none' : value; if (!Object.hasOwn(costumeRoots, next)) throw new RangeError('Costume must be none, scarf, or apron.'); costume = next; for (const [name, group] of Object.entries(costumeRoots)) group.visible = name === next; bodyFur.geometry = next === 'apron' ? apronBodyFur : baseBodyFur; updateFurQuality(); onStats(stats()); },
    setMotion(value) { const next = ({ greet: 'wave', rotate: 'turn', none: 'still' })[value] || value; if (!['idle', 'wave', 'blink', 'turn', 'still'].includes(next)) throw new RangeError('Unsupported motion.'); motion = next; motionStart = elapsed; onStats(stats()); },
    setAngle(value) { if (typeof value === 'number') yaw = THREE.MathUtils.degToRad(value); else { if (Number.isFinite(value?.yaw)) yaw = THREE.MathUtils.degToRad(value.yaw); if (Number.isFinite(value?.pitch)) pitch = clamp(THREE.MathUtils.degToRad(value.pitch), -0.12, 0.8); } updateCamera(); },
    setView(value) { if (!['full', 'detail'].includes(value)) throw new RangeError('View must be full or detail.'); view = value; if (view === 'detail') { target.set(0, 0.88, 0.27); distance = 3.05; camera.fov = 30; } else { target.set(0.21, 1.1, 0); distance = 5.6; camera.fov = 34; } camera.updateProjectionMatrix(); updateCamera(); onStats(stats()); },
    setQuality(value) { quality = value === 'low' || value === 'mobile' ? 'low' : 'high'; updateFurQuality(); renderer.shadowMap.enabled = true; const size = quality === 'high' ? 1024 : 512; if (key.shadow.mapSize.x !== size) { key.shadow.mapSize.set(size, size); key.shadow.map?.dispose(); key.shadow.map = null; key.shadow.needsUpdate = true; } resize(); onStats(stats()); },
    setBackground(value) { if (disposed) return; const known = typeof value === 'string' && Object.hasOwn(KKAMONG_PROTOTYPE_V1.backgrounds, value); const hex = known ? KKAMONG_PROTOTYPE_V1.backgrounds[value] : value; if (typeof hex !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) throw new RangeError('Background must be paper, night, lapis, or a CSS hex colour.'); background = known ? value : hex.toUpperCase(); scene.background.set(hex); floor.material.color.set(hex); onStats(stats()); },
    setPaused(value) { pause = !!value; },
    snapshot() { if (disposed || contextLost) throw new Error('3D 화면을 사용할 수 없는 동안에는 사진을 만들 수 없습니다.'); renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
    getStats: stats,
    dispose() {
      if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect(); media?.removeEventListener?.('change', onReduced);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('keydown', keyboard); canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      const geometries = new Set([baseBodyFur, apronBodyFur]), materials = new Set(); scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!managedMaterials.has(m)) materials.add(m); }); }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); materialKit.dispose(); contactMap.dispose(); key.shadow.map?.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}

export default createThreeLab;
