// 그림 길 B 「사진 결 3D 역」(설계 8절): three.js로 열차 칸 · 환승 통로를 코드로 짓고, 벽 타일 · 바닥 · 스테인리스 · 점자 블록 결만 실사 판(GPT 이미지 2.5 결 판)을 쓴다.
// 사람은 넣지 않는다(「인물은 오려 붙이지 않는다」). 카메라 흔들림 없음(멀미) — 앞으로 흐름과 옆 미끄러짐뿐. 동사 이름은 A와 같다.
import * as THREE from '/korean-runner/vendor/three.module.js';
import { drawSign } from './look-a.mjs';

export async function createLookB(canvas, { base, tween, ease }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.78; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const srcTex = {};
  await Promise.all(['tile', 'granite', 'steel', 'tactile'].map((n) => new Promise((res, rej) => loader.load(base + n + '.webp', (t) => { srcTex[n] = t; res(); }, undefined, rej))));
  const tex = (n, rx, ry) => { const t = srcTex[n].clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxAniso); t.needsUpdate = true; return t; };

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e12);
  const camera = new THREE.PerspectiveCamera(70, 0.46, 0.05, 160); camera.rotation.order = 'YXZ';

  // ── 환경광(반사용): 밝은 천장 등이 있는 흰 방 ──
  { const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene(); env.background = new THREE.Color(0x8f9499);
    const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 8.4) });
    for (let i = 0; i < 6; i++) for (const x of [-3, 3]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 5), led); m.position.set(x, 4.5, -18 + i * 7); env.add(m); }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 60), new THREE.MeshBasicMaterial({ color: 0xa8acae, side: THREE.BackSide })); env.add(wall);
    scene.environment = pm.fromScene(env, 0.05).texture; scene.environmentIntensity = 0.42; pm.dispose(); }

  const box = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); (parent || scene).add(m); return m; };
  const plane = (w, h, mat, x, y, z, rx, ry, parent) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0, 'YXZ'); (parent || scene).add(m); return m; };
  const LED = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.9, 1.8), toneMapped: true });
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#00000000'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const floorGlow = (w, l, x, z, op, parent) => plane(w, l, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xe8ecea }), x, 0.012, z, -Math.PI / 2, 0, parent);

  // ── 열차 칸 ──
  const car = new THREE.Group(); scene.add(car);
  const W = 1.45, H = 2.16, Z0 = 4, Z1 = -19;
  const white = new THREE.MeshStandardMaterial({ color: 0xe6e9e8, roughness: 0.42, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ map: tex('steel', 1, 1), metalness: 0.75, roughness: 0.36, color: 0xe6e8e8, envMapIntensity: 2.1 });
  const pole = new THREE.MeshStandardMaterial({ color: 0xd8dadb, metalness: 1, roughness: 0.2 });
  const seatM = new THREE.MeshStandardMaterial({ color: 0x5c7695, roughness: 0.62 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.25, metalness: 0.2 });
  const floorCar = new THREE.MeshStandardMaterial({ map: tex('granite', 2.2, 16), color: 0xb9bab6, roughness: 0.4, metalness: 0.02 });
  plane(W * 2, Z0 - Z1, floorCar, 0, 0, (Z0 + Z1) / 2, -Math.PI / 2, 0, car);
  plane(W * 2, Z0 - Z1, new THREE.MeshStandardMaterial({ color: 0xeef0ef, roughness: 0.55 }), 0, H, (Z0 + Z1) / 2, Math.PI / 2, 0, car);
  // 천장: 두 줄 등 + 가운데 환기 줄
  for (const x of [-0.66, 0.66]) for (let z = Z0 - 1; z > Z1; z -= 2.2) { box(0.2, 0.025, 1.92, LED, x, H - 0.02, z, car); floorGlow(0.7, 2.0, x * 0.8, z, 0.05, car); }
  const vent = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#c9cccc'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#3c4044'; for (let i = 0; i < 8; i++) x.fillRect(0, i * 8 + 1, 64, 5); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 28); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  plane(0.44, Z0 - Z1, new THREE.MeshStandardMaterial({ map: vent, roughness: 0.7 }), 0, H - 0.006, (Z0 + Z1) / 2, Math.PI / 2, 0, car);
  // 달리는 창: 터널 등 빛이 흐르는 무늬
  const streakC = document.createElement('canvas'); streakC.width = 512; streakC.height = 64;
  { const x = streakC.getContext('2d'); x.fillStyle = '#070809'; x.fillRect(0, 0, 512, 64); for (let i = 0; i < 4; i++) { const g = x.createLinearGradient(i * 128, 0, i * 128 + 60, 0); g.addColorStop(0, '#00000000'); g.addColorStop(0.5, '#ffe9c0'); g.addColorStop(1, '#00000000'); x.fillStyle = g; x.fillRect(i * 128, 24 + (i % 2) * 8, 60, 3); } }
  const streak = new THREE.CanvasTexture(streakC); streak.wrapS = THREE.RepeatWrapping; streak.colorSpace = THREE.SRGBColorSpace;
  const windowM = new THREE.MeshBasicMaterial({ map: streak });
  const platformWall = tex('tile', 5, 1.2);
  const windowStill = new THREE.MeshBasicMaterial({ map: platformWall, color: 0xb9b9b2 });
  const windows = [];
  const doorsZ = [-2.2, -10.4, -18.6];
  const leaves = { left: [], right: [] };
  function roundRectShape(w, h, r) { const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; }
  const doorWinGeo = new THREE.ShapeGeometry(roundRectShape(0.36, 0.86, 0.09));
  const uvFix = (g) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.36 + 0.5, p.getY(i) / 0.86 + 0.5); uv.needsUpdate = true; return g; };
  uvFix(doorWinGeo);
  for (const side of [-1, 1]) {
    const X = side * W, face = -side * Math.PI / 2;
    const segs = [[Z0, doorsZ[0] + 0.72], [doorsZ[0] - 0.72, doorsZ[1] + 0.72], [doorsZ[1] - 0.72, doorsZ[2] + 0.72]];
    for (const [a, b] of segs) {
      const len = a - b, mid = (a + b) / 2;
      plane(len, 0.92, white, X, 0.46, mid, 0, face, car);
      plane(len, 0.56, white, X, H - 0.28, mid, 0, face, car);
      // 창 + 창틀
      const win = plane(len - 0.16, 0.66, windowM, X - side * 0.004, 1.25, mid, 0, face, car); windows.push(win);
      for (const y of [0.91, 1.59]) box(0.02, 0.04, len - 0.1, steel, X - side * 0.008, y, mid, car);
      // 기둥 벽 · 윗 짐받이
      box(0.46, 0.022, Math.max(0.1, len - 0.24), steel, X - side * 0.27, 1.92, mid, car);
      if (len > 3 && b < -3) {
        // 긴 의자
        box(0.5, 0.38, len - 0.3, steel, X - side * 0.25, 0.19, mid, car);
        box(0.52, 0.08, len - 0.32, seatM, X - side * 0.26, 0.42, mid, car);
        box(0.08, 0.44, len - 0.32, seatM, X - side * 0.05, 0.68, mid, car);
        for (const e of [a - 0.16, b + 0.16]) box(0.52, 0.96, 0.03, steel, X - side * 0.26, 0.48, e, car);
        // 손잡이 줄 · 기둥
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len - 0.3, 10), pole); rail.rotation.x = Math.PI / 2; rail.position.set(X - side * 0.62, 1.9, mid); car.add(rail);
        for (const e of [a - 0.16, b + 0.16]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, H, 12), pole); p.position.set(X - side * 0.54, H / 2, e); car.add(p); }
        for (let z = a - 0.5; z > b + 0.4; z -= 0.42) { const strap = box(0.016, 0.16, 0.024, white, X - side * 0.62, 1.8, z, car); strap.material = white; const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 16), white); ring.position.set(X - side * 0.62, 1.67, z); ring.rotation.y = Math.PI / 2; car.add(ring); }
      }
    }
    // 문: 두 짝이 앞뒤로 열린다 · 위 빈 화면
    doorsZ.forEach((z, i) => {
      box(0.04, 0.2, 1.44, white, X - side * 0.002, 2.04, z, car);
      const lcd = plane(0.82, 0.14, dark, X - side * 0.03, 2.03, z, 0, face, car);
      for (const dir of [1, -1]) {
        const leaf = new THREE.Group(); leaf.position.set(X - side * 0.012, 0.97, z + dir * 0.33); car.add(leaf);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.94, 0.655), steel); leaf.add(body);
        const glass = new THREE.Mesh(doorWinGeo, windowM); glass.position.set(-side * 0.018, 0.25, 0); glass.rotation.y = face; leaf.add(glass); windows.push(glass);
        if (i === 0) leaves[side > 0 ? 'right' : 'left'].push({ leaf, z0: leaf.position.z, dir });
      }
    });
  }
  box(W * 2, 2.2, 0.06, white, 0, 1.08, Z1, car);
  box(0.8, 1.9, 0.08, steel, 0, 0.95, Z1 + 0.03, car);
  box(W * 2, 2.2, 0.06, white, 0, 1.08, Z0, car);
  [-3.4, -6, -8.4, -12.6, -15.6].forEach((z) => { const l = new THREE.PointLight(0xfff6ea, 1.9, 8, 1.4); l.position.set(0, 1.95, z); car.add(l); });
  car.add(new THREE.HemisphereLight(0xffffff, 0x9a9b98, 1.05));
  // 문 밖 승강장(문이 열리면 보인다)
  const out = new THREE.Group(); car.add(out);
  const outFloor = new THREE.MeshStandardMaterial({ map: tex('granite', 5, 8), color: 0xd6d6d2, roughness: 0.3 });
  plane(9, 18, outFloor, W + 4.5, 0, -2.2, -Math.PI / 2, 0, out);
  plane(18, 3.4, new THREE.MeshStandardMaterial({ map: tex('tile', 15, 2.4), roughness: 0.42 }), W + 7, 1.7, -2.2, 0, -Math.PI / 2, out);
  plane(9, 18, new THREE.MeshStandardMaterial({ color: 0xeeefee, roughness: 0.6 }), W + 4.5, 3.2, -2.2, Math.PI / 2, 0, out);
  for (let z = -10; z < 6; z += 3) for (const x of [W + 2, W + 5]) box(0.2, 0.03, 2.4, LED, x, 3.18, z, out);
  plane(0.42, 18, new THREE.MeshStandardMaterial({ map: tex('tactile', 0.5, 20), roughness: 0.6 }), W + 1, 0.008, -2.2, -Math.PI / 2, 0, out);
  const outLight = new THREE.PointLight(0xfff4e2, 0, 9, 1.4); outLight.position.set(W + 1.8, 2.2, -2.2); out.add(outLight);

  // ── 환승 통로 ──
  const fork = new THREE.Group(); scene.add(fork); fork.visible = false;
  const FW = 5.45, FH = 3.3, Fstart = 40, Fmouth = -22;
  const wallM = (rx, ry) => new THREE.MeshStandardMaterial({ map: tex('tile', rx, ry), roughness: 0.32, metalness: 0.02 });
  const floorM = (rx, ry) => new THREE.MeshStandardMaterial({ map: tex('granite', rx, ry), roughness: 0.2, metalness: 0.02, color: 0xdededa });
  const flen = Fstart - Fmouth, fmid = (Fstart + Fmouth) / 2;
  plane(FW * 2, flen, floorM(6, flen / 1.8), 0, 0, fmid, -Math.PI / 2, 0, fork);
  plane(0.46, flen, new THREE.MeshStandardMaterial({ map: tex('tactile', 0.5, flen / 0.9), roughness: 0.7, color: 0xd8d2c0 }), 0, 0.006, fmid, -Math.PI / 2, 0, fork);
  for (const s of [-1, 1]) plane(flen, FH, wallM(flen / 1.2, FH / 1.5), s * FW, FH / 2, fmid, 0, -s * Math.PI / 2, fork);
  const ceilC = document.createElement('canvas'); ceilC.width = ceilC.height = 128; { const x = ceilC.getContext('2d'); x.fillStyle = '#e7e5de'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#a9a79f'; x.lineWidth = 1.5; x.strokeRect(0, 0, 128, 128); }
  const ceilT = new THREE.CanvasTexture(ceilC); ceilT.wrapS = ceilT.wrapT = THREE.RepeatWrapping; ceilT.repeat.set(9, flen / 1.2); ceilT.colorSpace = THREE.SRGBColorSpace;
  plane(FW * 2, flen, new THREE.MeshStandardMaterial({ map: ceilT, roughness: 0.6 }), 0, FH, fmid, Math.PI / 2, 0, fork);
  for (const x of [-3.2, 0, 3.2]) for (let z = Fstart - 2; z > Fmouth; z -= 2.6) { box(0.22, 0.03, 2.2, LED, x, FH - 0.016, z, fork); floorGlow(0.8, 2.6, x, z, x === 0 ? 0.07 : 0.06, fork); }
  // 벽 기둥: 흐름이 잘 보이게 6m마다
  const pillarM = wallM(0.8, 2.2);
  for (let z = Fstart - 3; z > Fmouth + 2; z -= 6) for (const s of [-1, 1]) box(0.3, FH, 0.7, pillarM, s * (FW - 0.15), FH / 2, z, fork);
  for (let z = Fstart - 4; z > Fmouth; z -= 7) { const l = new THREE.PointLight(0xfff9ee, 3.2, 15, 1.6); l.position.set(0, FH - 0.3, z); fork.add(l); }
  fork.add(new THREE.HemisphereLight(0xffffff, 0x8a8a85, 0.5));
  // 입구 세 칸: 위 벽 · 기둥
  const openings = [[-5.05, -1.95], [-1.45, 1.45], [1.95, 5.05]];
  const header = wallM(9, 0.6);
  box(FW * 2, 0.82, 0.5, header, 0, FH - 0.41, Fmouth, fork);
  for (const [a, b] of [[-FW, -5.05], [-1.95, -1.45], [1.45, 1.95], [5.05, FW]]) box(b - a, FH, 0.7, wallM(0.8, 2.2), (a + b) / 2, FH / 2, Fmouth, fork);
  // 표지: 세 입구 위
  const signC = openings.map(() => { const c = document.createElement('canvas'); c.width = 768; c.height = 170; return c; });
  const signT = signC.map((c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxAniso); return t; });
  openings.forEach(([a, b], i) => {
    const w = b - a - 0.2;
    box(w + 0.05, 0.62, 0.08, new THREE.MeshStandardMaterial({ color: 0xc6c9cc, metalness: 0.8, roughness: 0.3 }), (a + b) / 2, 2.2, Fmouth + 0.32, fork);
    plane(w, 0.57, new THREE.MeshBasicMaterial({ map: signT[i] }), (a + b) / 2, 2.2, Fmouth + 0.37, 0, 0, fork);
    for (const x of [a + 0.3, b - 0.3]) box(0.03, 0.26, 0.03, pole, x, 2.62, Fmouth + 0.32, fork);
  });
  // 왼쪽: 오르는 계단, 가운데: 이어지는 통로, 오른쪽: 내려가는 계단
  const stone = new THREE.MeshStandardMaterial({ map: tex('granite', 2, 0.25), roughness: 0.5, color: 0xbdbdb8 });
  const passM = (rx, ry) => wallM(rx, ry);
  { const [a, b] = openings[0], w = b - a, cx = (a + b) / 2; for (let i = 0; i < 22; i++) box(w, 0.16, 0.34, stone, cx, 0.08 + i * 0.16, Fmouth - 0.5 - i * 0.34, fork);
    for (const x of [a, b]) plane(14, 9, passM(10, 6), x, 2.5, Fmouth - 6, 0, (x === a ? 1 : -1) * Math.PI / 2, fork);
    plane(w, 14, new THREE.MeshStandardMaterial({ color: 0xeae9e4, roughness: 0.6 }), cx, 6.2, Fmouth - 6, Math.PI / 2, 0, fork); box(0.2, 0.03, 8, LED, cx, 6.1, Fmouth - 7, fork);
    const l = new THREE.PointLight(0xfff5e6, 4, 14, 1.5); l.position.set(cx, 3.6, Fmouth - 5); fork.add(l); box(w, 8, 0.1, new THREE.MeshBasicMaterial({ color: 0xf2f1ec }), cx, 5, Fmouth - 12, fork); }
  { const [a, b] = openings[1], w = b - a, L = 44; plane(w, L, floorM(1.6, L / 1.8), 0, 0, Fmouth - L / 2, -Math.PI / 2, 0, fork);
    plane(0.46, L, new THREE.MeshStandardMaterial({ map: tex('tactile', 0.5, L / 0.9), roughness: 0.55 }), 0, 0.006, Fmouth - L / 2, -Math.PI / 2, 0, fork);
    for (const x of [a, b]) plane(L, 2.6, passM(L / 1.2, 1.7), x, 1.3, Fmouth - L / 2, 0, (x === a ? 1 : -1) * Math.PI / 2, fork);
    plane(w, L, new THREE.MeshStandardMaterial({ color: 0xececE6, roughness: 0.6 }), 0, 2.6, Fmouth - L / 2, Math.PI / 2, 0, fork);
    for (const x of [-0.75, 0.75]) for (let z = Fmouth - 1; z > Fmouth - L; z -= 2) { box(0.1, 0.02, 1.5, LED, x, 2.58, z, fork); floorGlow(0.5, 2, x * 0.8, z, 0.05, fork); }
    box(w, 2.6, 0.1, new THREE.MeshBasicMaterial({ color: 0xf4f3ee }), 0, 1.3, Fmouth - L, fork);
    for (let z = Fmouth - 6; z > Fmouth - L; z -= 9) { const l = new THREE.PointLight(0xfff6e8, 2.4, 12, 1.6); l.position.set(0, 2.3, z); fork.add(l); } }
  { const [a, b] = openings[2], w = b - a, cx = (a + b) / 2; box(w, 0.5, 2, stone, cx, -0.25, Fmouth - 0.4, fork); for (let i = 0; i < 18; i++) box(w, 0.16, 0.34, stone, cx, -0.08 - i * 0.16, Fmouth - 1.4 - i * 0.34, fork);
    for (const x of [a, b]) plane(14, 9, passM(10, 6), x, -0.6, Fmouth - 6, 0, (x === a ? 1 : -1) * Math.PI / 2, fork);
    plane(w, 14, new THREE.MeshStandardMaterial({ color: 0xeae9e4, roughness: 0.6 }), cx, 2.7, Fmouth - 6, Math.PI / 2, 0, fork); box(0.2, 0.03, 8, LED, cx, 2.68, Fmouth - 7, fork);
    plane(w, 14, floorM(1.6, 8), cx, -3.1, Fmouth - 10, -Math.PI / 2, 0, fork); const l = new THREE.PointLight(0xfff5e6, 3.6, 14, 1.5); l.position.set(cx, 1.4, Fmouth - 5); fork.add(l); box(w, 7, 0.1, new THREE.MeshBasicMaterial({ color: 0xf2f1ec }), cx, -0.5, Fmouth - 14, fork); }

  // ── 카메라 상태 ──
  const lookAt = new THREE.Vector3(), tmp = new THREE.Vector3();
  const cam = { x: 0, y: 1.6, z: 2.8, tx: 0, ty: 1.42, tz: -14, fovP: 68, fovL: 52, bright: 1 };
  const speedState = { speed: 1, phase: 0 };
  const lanes = [-3.5, 0, 3.5], MOUTH_STOP = Fmouth + 14;   // 세 표지가 한 화면에 들도록 입구 14m 앞에 선다

  function setSigns(signs) {
    signs.forEach((s, i) => { const c = signC[i], x = c.getContext('2d'); x.fillStyle = '#0d1b3e'; x.fillRect(0, 0, c.width, c.height); drawSign(x, [0.02, 0.06, 0.98, 0.94], c.width, c.height, s); signT[i].needsUpdate = true; });
  }
  const setFilter = () => { canvas.style.filter = cam.bright === 1 ? '' : `brightness(${cam.bright.toFixed(3)})`; };

  return {
    name: 'b', setSigns,
    enterTrain() { car.visible = true; fork.visible = false; speedState.speed = 1; windows.forEach((w) => { w.material = windowM; }); Object.assign(cam, { x: 0, y: 1.6, z: 2.8, tx: 0, ty: 1.42, tz: -14, bright: 1 }); setFilter(); },
    trainSpeed(v) { speedState.speed = v; if (v < 0.02) windows.forEach((w) => { w.material = windowStill; }); cam.z = 2.8 - (1 - v) * 0.04; },
    async openDoor(side) {
      const set = leaves[side === 'left' ? 'left' : 'right'];
      await tween(0.95, (k) => { set.forEach((l) => { l.leaf.position.z = l.z0 + l.dir * 0.63 * k; }); outLight.intensity = 7 * k; }, ease.door);
    },
    async leaveTrain(side) {
      const dir = side === 'left' ? -1 : 1, s = { ...cam };
      await tween(1.25, (k) => {
        const a = ease.inOut(Math.min(1, k * 1.4));
        cam.tx = s.tx + (dir * 7 - s.tx) * a; cam.ty = 1.3; cam.tz = s.tz + (-2.2 - s.tz) * a;
        const m = k * k; cam.x = dir * (0.1 + 3.4 * m); cam.z = s.z + (-2.2 - s.z) * Math.min(1, k * 1.25);
        cam.bright = 1 + Math.max(0, (k - 0.7) / 0.3) * 2.4; setFilter();
      }, ease.linear);
    },
    enterFork(signs) { setSigns(signs); car.visible = false; fork.visible = true; Object.assign(cam, { x: 0, y: 1.6, z: Fstart - 4, tx: 0, ty: 1.82, tz: Fmouth - 12, bright: 1 }); setFilter(); },
    runTo(p) { cam.z = (Fstart - 4) + (MOUTH_STOP - (Fstart - 4)) * p; },
    async slide(lane) { const s = { ...cam }; await tween(0.35, (k) => { cam.x = s.x + (lane * 1.1 - s.x) * k; cam.tx = s.tx + (lanes[lane + 1] - s.tx) * k; }, ease.out); },
    async dash(lane) {
      const s = { ...cam }, X = lanes[lane + 1], yEnd = lane < 0 ? 1.6 + 2.4 : lane > 0 ? 1.6 - 2.2 : 1.6;
      await tween(1.3, (k) => {
        cam.x = s.x + (X - s.x) * Math.min(1, k * 1.6); cam.tx = X; cam.z = s.z + (Fmouth - 8 - s.z) * k; cam.tz = cam.z - 12;
        cam.y = s.y + (yEnd - s.y) * Math.max(0, (k - 0.45) / 0.55); cam.ty = cam.y + (lane < 0 ? 1.2 : lane > 0 ? -1.2 : 0);
        cam.bright = 1 + Math.max(0, (k - 0.62) / 0.38) * 3.2; setFilter();
      }, ease.inOut);
    },
    async peek(lane) { const s = { ...cam }; await tween(0.5, (k) => { cam.x = s.x + (lane * 1.1 - s.x) * k; cam.tx = s.tx + (lanes[lane + 1] - s.tx) * k; cam.z = s.z - 1.6 * k; }, ease.out); },
    atMouth() { Object.assign(cam, { x: 0, y: 1.6, z: MOUTH_STOP, tx: 0, ty: 1.82, tz: Fmouth - 12, bright: 1 }); setFilter(); },
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      const size = renderer.getSize(new THREE.Vector2()); if (size.x !== w || size.y !== h) { renderer.setSize(w, h, false); camera.aspect = w / h; }
      const fov = w / h < 1 ? cam.fovP : cam.fovL; if (camera.fov !== fov) camera.fov = fov; camera.updateProjectionMatrix();
    },
    render(dt) {
      speedState.phase += dt * speedState.speed * 1.1; streak.offset.x = -speedState.phase;
      camera.position.set(cam.x, cam.y, cam.z); lookAt.set(cam.tx, cam.ty, cam.tz); camera.lookAt(lookAt);
      renderer.render(scene, camera);
    },
  };
}
