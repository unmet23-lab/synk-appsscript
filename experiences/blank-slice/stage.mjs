// 빈칸 베기 — 3D 무대(Three.js). 펠트 낱말 조각을 던지고, 그은 선으로 베고, 두 쪽으로 가른다.
// 카메라는 움직이지 않는다(흔들기·기울이기·확대 없음 — 멀미). 타격감은 멈칫(히트스톱), 베인 선 번쩍임, 충격파,
// 펠트 부스러기, 반짝이, 느린 화면으로 낸다. 소리와 진동은 app.mjs가 같은 순간에 낸다.
import * as THREE from './vendor/three.module.js';
import { tossLayout, segmentEntry } from './core.mjs';

// 펠트 색. 글자는 큰 굵은 글씨라 3:1 이상 대비를 지킨다.
const FELT = [
  { base: '#f5c445', ink: '#2b2320', side: '#d9a52a', inner: '#b98316' },   // 버터
  { base: '#3d6bc9', ink: '#ffffff', side: '#2f55a6', inner: '#1f3c7c' },   // 라피스
  { base: '#fbf3e4', ink: '#2b2320', side: '#e6d8c2', inner: '#cdbb9f' },   // 크림
  { base: '#e2533f', ink: '#ffffff', side: '#c2402f', inner: '#9d2f22' },   // 코랄(진하게)
  { base: '#fbd3c6', ink: '#2b2320', side: '#efb7a6', inner: '#d9917c' },   // 연코랄
  { base: '#7db45a', ink: '#17280c', side: '#5f9440', inner: '#45732c' },   // 초록
];
const BUTTER = FELT[0];
const CAM_Z = 12, FOV = 40;

/** 손맛 수치. 시간은 ms, 손 빠르기는 px/ms다(최근 50ms 자취로 재서 화면 주사율과 상관없다). */
export const FEEL = {
  stop: { ok: 85, wrong: 55, none: 40 },   // 히트스톱: 베인 순간 세상이 멈칫하는 시간
  slowMs: 520, slowMin: 0.25,              // 맞힌 뒤 느린 화면: 0.25배에서 제 속도로 돌아온다
  sliceSpeed: 0.14,                        // 이보다 느리게 끌면 베기가 아니다
  sliceMinPx: 8,                           // 최근 50ms에 이만큼은 움직여야 벤다(조각 위에 얹은 손가락의 떨림은 베기가 아니다)
  swingSpeed: 0.9,                         // 이보다 빠르면 ‘휙’ 소리가 난다
  window: 50, trailMs: 130,
};

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** 펠트 판 모양(두께·둥근 모서리). 앞뒷면 UV를 0~1로 펴서 글자 그림이 판 전체에 맞게 한다. */
function feltGeometry(w, h) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, h, Math.min(w, h) * 0.3), {
    depth: 0.26, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 4, curveSegments: 10,
  });
  g.center();
  const pos = g.attributes.position, uv = g.attributes.uv, cap = g.groups[0];
  const W = w + 0.18, H = h + 0.18;
  for (let i = cap.start; i < cap.start + cap.count; i++) {
    const vi = g.index ? g.index.getX(i) : i;
    uv.setXY(vi, (pos.getX(vi) + W / 2) / W, (pos.getY(vi) + H / 2) / H);
  }
  uv.needsUpdate = true;
  return g;
}

const easeOut = (k) => 1 - Math.pow(1 - k, 3);
function lens(g, L, w) {   // 가운데가 두껍고 양끝이 뾰족한 칼빛
  g.beginPath(); g.moveTo(-L, 0); g.quadraticCurveTo(0, -w, L, 0); g.quadraticCurveTo(0, w, -L, 0); g.closePath(); g.fill();
}
function star4(g, x, y, r, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.34 : r, a = (i / 8) * Math.PI * 2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.restore();
}

export async function createStage({ host, overlay, onSlice, onLanded, onLaunch, onSwing, reducedMotion = () => false }) {
  await document.fonts?.load?.('800 80px SUIT').catch(() => {});
  const feltImg = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'assets/kit/tex-cream.webp'; });

  // WebGL을 만들 수 없으면 여기서 오류가 난다. 부른 쪽(app.mjs)이 안내하고 입구로 돌아간다
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  host.prepend(renderer.domElement);
  renderer.domElement.className = 'stage-gl';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  scene.add(new THREE.HemisphereLight(0xfff6ee, 0xcdb8a6, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-2, 4, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 30 });
  sun.shadow.radius = 6;
  scene.add(sun);
  // 뒤쪽 펠트 벽(화면의 CSS 펠트 위)에 그림자만 떨어뜨린다 → 조각이 벽 앞에 떠 있는 깊이감
  // 그림자는 조각 바로 아래 가깝고 옅게(무거워 보이지 않게)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShadowMaterial({ opacity: 0.1 }));
  wall.position.z = -0.9; wall.receiveShadow = true; scene.add(wall);

  const ctx2d = overlay.getContext('2d');
  let W = 1, H = 1, dpr = 1, hw = 0, hh = 1, topPx = 0, active = true;
  const view = { showNumbers: false };

  const pieces = [];   // 던진 조각 { group, mesh, geo, word, n, index, color, w, h, x, y, vx, vy, g, t, alive, gone, sliced, glow, launched }
  const halves = [];   // 베인 두 쪽 { group, local, mats, life, owner, flash, vel, push, spin }
  const fluffs = [];   // 털 부스러기(점) { points, vel[], life }
  const flakes = [];   // 펠트 부스러기(작은 판) { mesh, items[], life }
  const fx = [];       // 2D 덧그림: 베인 선·충격파·반짝이·먼지·번쩍임 { kind, born, dur, ... }
  const trail = [];    // 손가락 자취 { x, y, t }
  let tossToken = 0, resolved = true, paused = false, pausedDrawn = false;
  let freezeUntil = 0, slow = null, hot = { until: 0, ok: false };

  function resize() {
    const r = host.getBoundingClientRect(), oldHw = hw;
    W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = `${W}px`; renderer.domElement.style.height = `${H}px`;
    overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr);
    overlay.style.width = `${W}px`; overlay.style.height = `${H}px`;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    hh = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_Z; hw = hh * camera.aspect;
    // 날아가는 중에 화면 폭이 바뀌면 조각을 새 폭에 맞춰 옮긴다(화면 밖으로 나가 벨 수 없게 되지 않게)
    if (oldHw > 0 && Math.abs(hw - oldHw) > 1e-6) {
      for (const p of pieces) {
        p.x = THREE.MathUtils.clamp(p.x * (hw / oldHw), -hw + p.w / 2 + 0.08, hw - p.w / 2 - 0.08);
        p.group.position.x = p.x;
      }
    }
    pausedDrawn = false;
  }
  const pxToWorldY = (py) => hh - (py / H) * 2 * hh;
  const unitPx = () => H / (2 * hh);
  const screenX = (x) => (x / hw + 1) / 2 * W;

  // ── 조각 ──
  function faceTexture(word, n, color, pw, ph) {
    const c = document.createElement('canvas');
    const scale = 220 / ph;   // 높이 220px 기준
    c.width = Math.max(64, Math.round(pw * scale)); c.height = Math.round(ph * scale);
    const g = c.getContext('2d');
    g.fillStyle = color.base; g.fillRect(0, 0, c.width, c.height);
    if (feltImg) {   // 실제 펠트 사진 결을 곱해 털 느낌
      g.globalAlpha = 0.5; g.globalCompositeOperation = 'multiply';
      const pat = g.createPattern(feltImg, 'repeat'); g.fillStyle = pat; g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    const lit = g.createRadialGradient(c.width * 0.3, c.height * 0.2, 4, c.width * 0.4, c.height * 0.4, c.width * 0.9);
    lit.addColorStop(0, 'rgba(255,255,255,.22)'); lit.addColorStop(1, 'rgba(0,0,0,.06)');
    g.fillStyle = lit; g.fillRect(0, 0, c.width, c.height);
    const fs = Math.round(c.height * 0.42);
    g.font = `800 ${fs}px SUIT, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color.ink;
    g.shadowColor = color.ink === '#ffffff' ? 'rgba(40,20,10,.35)' : 'rgba(255,255,255,.35)'; g.shadowBlur = 0; g.shadowOffsetY = 3;
    g.fillText(word, c.width / 2, c.height * 0.54);
    if (view.showNumbers) {   // 키보드 번호(넓은 화면)
      g.shadowColor = 'transparent';
      const r = c.height * 0.15, cx = r * 1.35, cy = r * 1.35;
      g.fillStyle = 'rgba(255,253,248,.92)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b2320'; g.font = `700 ${Math.round(r * 1.25)}px "DM Mono", SUIT, monospace`; g.fillText(String(n), cx, cy + 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }

  function measure(word, ph) {
    const g = ctx2d; g.save(); g.font = `800 100px SUIT, "Malgun Gothic", sans-serif`;
    const w = g.measureText(word).width / 100; g.restore();
    return Math.max(ph * 1.35, w * ph * 0.42 * 1.08 + ph * 0.75);
  }

  function makePiece(word, n, color, pw, ph) {
    const geo = feltGeometry(pw, ph);
    const front = new THREE.MeshStandardMaterial({ map: faceTexture(word, n, color, pw, ph), roughness: 0.96, metalness: 0 });
    const side = new THREE.MeshStandardMaterial({ color: color.side, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geo, [front, side]);
    mesh.castShadow = true;
    const group = new THREE.Group(); group.add(mesh); scene.add(group);
    return { group, mesh, geo };
  }

  /** 정답을 알려 주는 빛: 노랗게 빛나는 테두리가 천천히 숨 쉬듯 밝아졌다 어두워진다(버터색 조각과 헷갈리지 않게). */
  function addGlow(p) {
    if (p.glow) return;
    const glow = new THREE.Mesh(p.geo, new THREE.MeshBasicMaterial({ color: 0xffe07a, side: THREE.BackSide, transparent: true, opacity: 0.95 }));
    glow.scale.set(1 + 0.22 / p.w, 1 + 0.22 / p.h, 1.15);
    p.group.add(glow); p.glow = glow;
  }

  /** 낱말 넷을 던진다. words: [{word, n}] (n = 키보드 번호). 반환: 던지기 번호. */
  function toss(words, { hang = 3.5, highlight = null } = {}) {
    clearPieces();
    resolved = false; tossToken += 1;
    const layout = tossLayout(W / H);
    const narrow = W / H < 0.95;
    const upx = unitPx();
    const ph = (narrow ? 56 : 72) / upx;                          // 조각 높이(세계 단위)
    const colW = narrow ? hw * 0.92 : (2 * hw) / 4.4;             // 한 열의 폭(좁은 화면 2열·넓은 화면 4열이 서로 닿지 않게)
    const bottom = -hh + 0.4, top = pxToWorldY(topPx) - 0.25;     // 던지는 띠
    // 정답을 빛으로 알려 주는 던지기(연습)에는 버터색을 빼서 ‘노란 조각’과 ‘빛나는 조각’이 헷갈리지 않게 한다
    const pool = highlight == null ? FELT : FELT.filter((c) => c !== BUTTER);
    const colors = [...pool].sort(() => Math.random() - 0.5);
    words.forEach((wd, i) => {
      const L = layout[i % layout.length];
      let pw = measure(wd.word, ph), h = ph;
      if (pw > colW) { h = ph * (colW / pw); pw = colW; }             // 긴 말은 조금 작게
      const color = colors[i % colors.length];
      const { group, mesh, geo } = makePiece(wd.word, wd.n, color, pw, h);
      const x0 = THREE.MathUtils.clamp(L.x * hw, -hw + pw / 2 + 0.08, hw - pw / 2 - 0.08);
      const y0 = -hh - h * 0.9;
      const apexY = bottom + h / 2 + L.apex * Math.max(1, top - bottom - h);
      const H0 = apexY - y0, T = hang;
      const g = (8 * H0) / (T * T), vy = (g * T) / 2;   // 같은 체공 시간 T: 같은 열의 두 조각은 늘 위아래로 떨어져 있다
      const p = { group, mesh, geo, word: wd.word, n: wd.n, index: i, color, w: pw, h, x: x0, y: y0, y0, vx: Math.sign(L.x) * 0.04, vy, g, T,
        t: -L.delay, tilt: (Math.random() - 0.5) * 0.16, wz: 0.9 + Math.random() * 0.6, wy: 0.7 + Math.random() * 0.5, ph: Math.random() * 6.28,
        alive: true, gone: false, glow: null, fade: 1, sliced: false, launched: false };
      group.position.set(x0, y0, 0); group.visible = false;
      pieces.push(p);
      if (highlight === i) addGlow(p);
    });
    return tossToken;
  }

  function releasePiece(p) {
    p.geo.dispose(); p.mesh.material.forEach((m) => { m.map?.dispose(); m.dispose(); }); p.glow?.material.dispose();
  }
  function clearPieces() {
    for (const p of pieces) { scene.remove(p.group); if (!p.sliced) releasePiece(p); }   // 벤 판은 반쪽이 다 사라질 때 지운다
    pieces.length = 0;
  }

  // ── 베기와 손맛 ──
  /**
   * 베인 순간: 판이 두 쪽으로 갈라진다(클리핑 면). 세상이 잠깐 멈칫하는 동안 두 쪽이 하얗게 번쩍이고,
   * 베인 선이 칼빛처럼 지나간 뒤 두 쪽이 벌어진다. 맞히면 느린 화면·반짝이·화면 번쩍임이 더해진다.
   */
  function sliceVisual(p, dir, verdict, c) {
    const ok = verdict === 'ok', kind = ok ? 'ok' : verdict === 'wrong' ? 'wrong' : 'none', calm = reducedMotion();
    p.group.visible = false; p.sliced = true;
    const n = new THREE.Vector3(-dir.y, dir.x, 0).normalize();   // 자르는 면의 법선(그은 방향에 수직)
    const along = new THREE.Vector3(dir.x, dir.y, 0).normalize();
    const base = new THREE.Vector3(p.vx, p.vy, 0).multiplyScalar(0.35).addScaledVector(along, 0.7).add(new THREE.Vector3(0, 1, 0));
    const flash = ok ? 0.9 : kind === 'wrong' ? 0.55 : 0.4;
    const white = new THREE.Color(0xfff6dc);
    for (const sgn of [1, -1]) {
      const group = new THREE.Group();
      group.position.copy(p.group.position); group.rotation.copy(p.group.rotation);
      const local = new THREE.Plane(n.clone().multiplyScalar(sgn).applyQuaternion(p.group.quaternion.clone().invert()), 0);
      const mats = p.mesh.material.map((m) => {
        const c2 = m.clone(); c2.clippingPlanes = [new THREE.Plane()]; c2.clipShadows = true; c2.transparent = true;
        c2.emissive = white.clone(); c2.emissiveIntensity = flash; return c2;
      });
      const inner = new THREE.MeshStandardMaterial({ color: p.color.inner, side: THREE.BackSide, roughness: 1, clippingPlanes: [new THREE.Plane()],
        clipShadows: true, transparent: true, emissive: white.clone(), emissiveIntensity: flash });
      const m1 = new THREE.Mesh(p.geo, mats); m1.castShadow = true;
      const m2 = new THREE.Mesh(p.geo, inner);
      group.add(m1, m2); scene.add(group);
      halves.push({ group, local, mats: [...mats, inner], life: 1.1, owner: p, flash, vel: base.clone(),
        push: n.clone().multiplyScalar(sgn * (ok ? 3.6 : 2.6)),   // 두 쪽을 벌리는 힘(빨리 잦아든다)
        spin: new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, sgn * (2.2 + Math.random() * 1.6)) });
    }
    const now = performance.now();
    freezeUntil = now + FEEL.stop[kind];
    slow = ok && !calm ? { from: freezeUntil, dur: FEEL.slowMs, min: FEEL.slowMin } : null;
    hot = { until: now + 200, ok };
    const size = Math.hypot(p.w, p.h) * unitPx();
    fx.push({ kind: 'slash', x: c.x, y: c.y, ang: Math.atan2(-dir.y, dir.x), len: size * 0.62 + 30, born: now, dur: ok ? 240 : 200, ok });
    if (calm) return;
    if (ok) fx.push({ kind: 'flash', born: now, dur: 110 });
    fx.push({ kind: 'ring', x: c.x, y: c.y, r0: size * 0.2, r1: size * (ok ? 0.85 : 0.6), born: now, dur: ok ? 380 : 300, ok });
    if (ok) {
      const reach = Math.min(1.2, size / 140);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + Math.random() * 0.5, s = (0.22 + Math.random() * 0.3) * reach;
        fx.push({ kind: 'spark', x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: Math.random() * 6, size: 6 + Math.random() * 7,
          born: now + FEEL.stop.ok * 0.6, dur: 520 + Math.random() * 220 });
      }
    }
    crumbs(p, ok ? 16 : kind === 'wrong' ? 10 : 8);
    burst(p.group.position, p.color);
  }

  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); return t; })();
  /** 털 부스러기: 부드러운 점이 흩날린다. */
  function burst(at, color) {
    if (reducedMotion()) return;
    const count = 16, pos = new Float32Array(count * 3), vel = [];
    for (let i = 0; i < count; i++) {
      pos.set([at.x, at.y, at.z + 0.2], i * 3);
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3;
      vel.push(new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s + 1, (Math.random() - 0.3) * 2));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(color.base), size: 0.16, map: dotTex, transparent: true, depthWrite: false });
    const points = new THREE.Points(geo, mat); scene.add(points);
    fluffs.push({ points, vel, life: 0.8 });
  }

  // 펠트 부스러기: 겉색·속색의 작은 판이 돌며 튄다(한 번에 그리는 InstancedMesh)
  const flakeGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
  const dummy = new THREE.Object3D();
  function placeFlakes(f, sdt) {
    f.items.forEach((it, k) => {
      it.v.y -= 11 * sdt; it.v.multiplyScalar(Math.max(0, 1 - 1.1 * sdt));
      it.p.addScaledVector(it.v, sdt);
      it.r.x += it.w.x * sdt; it.r.y += it.w.y * sdt; it.r.z += it.w.z * sdt;
      dummy.position.copy(it.p); dummy.rotation.copy(it.r); dummy.scale.setScalar(it.s * Math.min(1, f.life / 0.3));
      dummy.updateMatrix(); f.mesh.setMatrixAt(k, dummy.matrix);
    });
    f.mesh.instanceMatrix.needsUpdate = true;
  }
  function crumbs(p, n) {
    const mesh = new THREE.InstancedMesh(flakeGeo, new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), n);
    const at = p.group.position, outer = new THREE.Color(p.color.base), inner = new THREE.Color(p.color.inner);
    const items = [];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = 2.2 + Math.random() * 4.2;
      items.push({ p: new THREE.Vector3(at.x + (Math.random() - 0.5) * p.w * 0.6, at.y + (Math.random() - 0.5) * p.h * 0.5, at.z + 0.1),
        v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + 1.6, (Math.random() - 0.2) * 2.5),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14), s: 0.55 + Math.random() * 0.9 });
      mesh.setColorAt(k, k % 3 === 0 ? inner : outer);
    }
    mesh.instanceColor.needsUpdate = true;
    const f = { mesh, items, life: 0.95 };
    placeFlakes(f, 0);   // 첫 장면부터 제자리(원점에 한 번 보이지 않게)
    scene.add(mesh); flakes.push(f);
  }

  /** 조각을 베었다(손가락·마우스·키보드 공통). 한 번 던지기에 하나만. at이 없으면 키보드로 벤 것이다. */
  function sliceIndex(i, dir = { x: 0.85, y: -0.5 }, at = null) {
    if (resolved) return false;
    const p = pieces.find((x) => x.index === i && x.alive && x.t >= 0);   // 아직 던지지 않은 조각은 벨 수 없다
    if (!p) return false;
    resolved = true; p.alive = false;
    const c = screenOf(p), nx = (c.x / W) * 2 - 1;
    if (!at) { fakeStroke(c, dir); onSwing?.({ speed: 2, x: nx - 0.3, to: nx + 0.3 }); }   // 키보드도 칼자국과 ‘휙’
    const verdict = onSlice?.({ index: i, word: p.word, x: c.x, y: c.y, nx, token: tossToken }) ?? null;
    sliceVisual(p, dir, verdict, c);
    return true;
  }

  /** 맞힌 뒤·틀린 뒤 정리: 남은 조각은 빨리 떨어지고 흐려진다. reveal이면 정답 조각을 빛으로 알려 준다. */
  function settle({ reveal = null } = {}) {
    for (const p of pieces) {
      if (!p.alive) continue;
      if (reveal === p.index) { addGlow(p); p.g *= 0.5; continue; }
      p.g *= 2.4; p.fading = true;
    }
  }

  // ── 그어 베기(포인터) ──
  // 첫 손가락 하나만 따라간다. 두 번째 손가락이 닿아도 두 손가락 사이를 그은 선으로 보지 않는다
  let pid = null, last = null, lastSwing = -1e9;
  function screenOf(p) {
    const v = p.group.position.clone().project(camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  }
  function rectOf(p) {
    const c = screenOf(p), u = unitPx() * (CAM_Z / (CAM_Z - p.group.position.z));
    const cos = Math.abs(Math.cos(p.group.rotation.z)), sin = Math.abs(Math.sin(p.group.rotation.z));
    const ex = ((p.w + 0.2) * cos + (p.h + 0.2) * sin) / 2 * u + 6, ey = ((p.w + 0.2) * sin + (p.h + 0.2) * cos) / 2 * u + 6;
    return { l: c.x - ex, r: c.x + ex, t: c.y - ey, b: c.y + ey };
  }
  const pointOf = (ev, rect) => ({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, t: ev.timeStamp || performance.now() });
  /** 최근 50ms 자취의 빠르기(px/ms)·움직인 거리(px)·방향. */
  function motion() {
    const n = trail.length; if (n < 2) return { speed: 0, dist: 0, dx: 0, dy: 0 };
    const end = trail[n - 1]; let j = n - 1, dist = 0;
    while (j > 0 && end.t - trail[j - 1].t <= FEEL.window) { dist += Math.hypot(trail[j].x - trail[j - 1].x, trail[j].y - trail[j - 1].y); j--; }
    if (j === n - 1) { const a = trail[n - 2], d = Math.hypot(end.x - a.x, end.y - a.y); return { speed: d / Math.max(1, end.t - a.t), dist: d, dx: end.x - a.x, dy: end.y - a.y }; }
    const a = trail[j];
    return { speed: dist / Math.max(8, end.t - a.t), dist, dx: end.x - a.x, dy: end.y - a.y };
  }
  function step(cur) {
    if (cur.t < last.t) cur.t = last.t;
    trail.push(cur);
    const m = motion();
    if (m.speed > FEEL.swingSpeed && cur.t - lastSwing > 240) {
      lastSwing = cur.t;
      const x = (cur.x / W) * 2 - 1;
      onSwing?.({ speed: m.speed, x, to: x + (m.dx / (Math.hypot(m.dx, m.dy) || 1)) * 0.5 });
    }
    if (!resolved && m.speed > FEEL.sliceSpeed && m.dist >= FEEL.sliceMinPx && (cur.x !== last.x || cur.y !== last.y)) {   // 천천히 끄는 것·떨림은 베기가 아니다
      let best = null;
      for (const p of pieces) {
        if (!p.alive || p.t < 0) continue;
        const t = segmentEntry(last, cur, rectOf(p));
        if (t !== null && (!best || t < best.t)) best = { p, t };
      }
      if (best) sliceIndex(best.p.index, { x: m.dx, y: -m.dy }, cur);
    }
    last = cur;
  }
  function onDown(e) {
    if (paused || pid !== null) return;
    pid = e.pointerId; lastSwing = -1e9;
    last = pointOf(e, overlay.getBoundingClientRect()); trail.length = 0; trail.push(last);
    try { overlay.setPointerCapture(e.pointerId); } catch { /* 이미 뗀 손가락 */ }
  }
  function onMove(e) {
    if (e.pointerId !== pid || paused || !last) return;
    const rect = overlay.getBoundingClientRect(), list = e.getCoalescedEvents?.();
    for (const ev of list && list.length ? list : [e]) step(pointOf(ev, rect));   // 프레임 사이의 손 움직임까지 빠짐없이
  }
  function onUp(e) { if (e.pointerId !== pid) return; pid = null; last = null; }
  overlay.addEventListener('pointerdown', onDown);
  overlay.addEventListener('pointermove', onMove);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) overlay.addEventListener(type, onUp);
  // 판 밖에서 손을 떼도 끝을 놓치지 않게(놓치면 다음 손가락이 계속 무시된다)
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, onUp);

  /** 키보드로 벨 때도 조각을 가로지르는 칼자국을 그린다. */
  function fakeStroke(c, dir) {
    const len = Math.hypot(dir.x, dir.y) || 1, ux = dir.x / len, uy = -dir.y / len, now = performance.now(), L = 90;
    trail.length = 0;
    for (let k = 0; k <= 8; k++) trail.push({ x: c.x - ux * L + (ux * 2 * L * k) / 8, y: c.y - uy * L + (uy * 2 * L * k) / 8, t: now - 64 + 8 * k });
  }

  // ── 2D 덧그림 ──
  const DRAW = {
    /** 맞힌 순간 화면 전체가 아주 옅게 한 번 번쩍인다. */
    flash(g, e, k) { g.fillStyle = `rgba(255,250,232,${0.18 * (1 - k)})`; g.fillRect(0, 0, W, H); },
    /** 조각이 튀어 오를 때 바닥 펠트에서 이는 먼지. */
    puff(g, e, k) {
      const r = 6 + 16 * easeOut(k);
      g.fillStyle = `rgba(255,251,244,${0.42 * (1 - k)})`;
      for (const [dx, s] of [[-1, 0.8], [0, 1.1], [1, 0.8]]) { g.beginPath(); g.arc(e.x + dx * (8 + 18 * k), e.y - 4 - 14 * k * s, r * s, 0, Math.PI * 2); g.fill(); }
    },
    /** 둥근 충격파. */
    ring(g, e, k) {
      const r = e.r0 + (e.r1 - e.r0) * easeOut(k);
      g.lineWidth = Math.max(0.5, (e.ok ? 9 : 6) * (1 - k));
      g.strokeStyle = e.ok ? `rgba(245,196,69,${0.95 * (1 - k)})` : `rgba(255,255,255,${0.85 * (1 - k)})`;
      g.beginPath(); g.arc(e.x, e.y, r, 0, Math.PI * 2); g.stroke();
    },
    /** 맞힘의 반짝이: 빨리 튀어 나갔다가 멈추며 작아진다. */
    spark(g, e, k) {
      const travel = 1 - (1 - k) * (1 - k);
      const x = e.x + e.vx * e.dur * 0.5 * travel, y = e.y + e.vy * e.dur * 0.5 * travel + 26 * k * k;
      const r = e.size * (k < 0.15 ? k / 0.15 : 1 - (0.85 * (k - 0.15)) / 0.85);
      g.fillStyle = `rgba(255,214,90,${0.35 * (1 - k)})`; g.beginPath(); g.arc(x, y, r * 1.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(255,250,225,${1 - k * 0.6})`; star4(g, x, y, r, e.rot + k * 2.4);
    },
    /** 베인 선: 칼빛이 순간 길게 뻗었다가 가늘어지며 사라진다. 맞히면 금빛, 아니면 칼날 자취와 같은 코랄빛. */
    slash(g, e, k) {
      const L = e.len * (0.6 + 0.4 * easeOut(Math.min(1, k / 0.16)));
      const w = (e.ok ? 15 : 11) * (k < 0.1 ? k / 0.1 : Math.pow(1 - (k - 0.1) / 0.9, 1.5));
      g.save(); g.translate(e.x, e.y); g.rotate(e.ang);
      g.fillStyle = e.ok ? `rgba(245,196,69,${0.6 * Math.min(1, w / 8)})` : `rgba(249,104,89,${0.35 * Math.min(1, w / 8)})`;
      lens(g, L * 1.06, w * 2.2);
      g.fillStyle = '#fff'; lens(g, L, w);
      g.restore();
    },
  };
  const LAYERS = ['flash', 'puff', 'ring', 'spark', 'slash'];

  /** 칼날 자취: 손끝은 굵고 꼬리는 뾰족한 띠(바깥 빛·가운데·흰 심 세 겹). 막 벤 뒤에는 잠깐 더 굵고 밝다. */
  function ribbon(g, pts, s, style) {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let nx = a.y - b.y, ny = b.x - a.x; const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      const w = pts[i].w * s; L.push(pts[i].x + nx * w, pts[i].y + ny * w); R.push(pts[i].x - nx * w, pts[i].y - ny * w);
    }
    g.fillStyle = style; g.beginPath(); g.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) g.lineTo(L[i], L[i + 1]);
    for (let i = R.length - 2; i >= 0; i -= 2) g.lineTo(R[i], R[i + 1]);
    g.closePath(); g.fill();
  }
  function drawTrail(g, now) {
    while (trail.length && now - trail[0].t > FEEL.trailMs) trail.shift();
    const n = trail.length; if (n < 2) return;
    const heat = hot.until > now, speed = Math.min(1, motion().speed / 2.2);
    const base = (5 + 11 * speed) * (heat ? 1.3 : 1);
    const pts = trail.map((p, i) => ({ x: p.x, y: p.y, w: base * Math.max(0, 1 - (now - p.t) / FEEL.trailMs) * (0.25 + 0.75 * (i / (n - 1))) }));
    const glow = heat ? (hot.ok ? '245,196,69' : '255,255,255') : '249,104,89';
    ribbon(g, pts, 1, `rgba(${glow},.34)`);
    ribbon(g, pts, 0.55, 'rgba(255,236,214,.85)');
    ribbon(g, pts, 0.26, '#fff');
    const h = pts[n - 1]; g.fillStyle = '#fff'; g.beginPath(); g.arc(h.x, h.y, Math.max(1.5, h.w * 0.3), 0, Math.PI * 2); g.fill();
  }
  function drawOverlay(now) {
    const g = ctx2d;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    for (const kind of LAYERS) for (const e of fx) { if (e.kind !== kind) continue; const k = (now - e.born) / e.dur; if (k >= 0 && k < 1) DRAW[kind](g, e, k); }
    for (let i = fx.length - 1; i >= 0; i--) if (now - fx[i].born >= fx[i].dur) fx.splice(i, 1);
    drawTrail(g, now);
  }

  // ── 움직임 ──
  let lastT = performance.now(), raf = 0;
  const tmpPlane = new THREE.Plane();
  /** 세상의 시간 배율: 히트스톱 동안 0, 맞힌 뒤 0.25배에서 제 속도로. */
  function worldScale(now) {
    if (now < freezeUntil) return 0;
    if (!slow) return 1;
    const k = (now - slow.from) / slow.dur;
    if (k >= 1) { slow = null; return 1; }
    return slow.min + (1 - slow.min) * k * k;
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const realDt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (!active) return;   // 게임 화면이 아니면 그리지 않는다(배터리·발열)
    if (paused) { if (!pausedDrawn) { renderer.render(scene, camera); drawOverlay(now); pausedDrawn = true; } return; }
    pausedDrawn = false;
    const sdt = realDt * worldScale(now);
    let allDown = pieces.length > 0;
    const launched = [];
    for (const p of pieces) {
      const before = p.t; p.t += sdt;
      if (!p.alive) continue;
      if (p.t < 0) { allDown = false; continue; }
      if (!p.launched) { p.launched = true; launched.push(p); }
      const step = before < 0 ? p.t : sdt;   // 던진 순간부터만 움직인다
      p.group.visible = true;
      p.vy -= p.g * step; p.y += p.vy * step; p.x += p.vx * step;
      const t = p.t;
      p.group.position.set(p.x, p.y, 0);
      p.group.rotation.set(Math.sin(t * 1.3 + p.ph) * 0.05, Math.sin(t * p.wy + p.ph) * 0.18, p.tilt + Math.sin(t * p.wz + p.ph) * 0.1);
      const s = Math.max(0, 1 - t / 0.2);   // 튀어 오를 때 잠깐 길쭉하게(눌렸다 펴지는 펠트)
      p.group.scale.set(1 - 0.08 * s, 1 + 0.14 * s, 1);
      if (p.glow) p.glow.material.opacity = 0.62 + 0.36 * (0.5 + 0.5 * Math.sin(now * 0.0088));   // 1.4번/초로 숨 쉬듯
      if (p.fading) { p.fade = Math.max(0, p.fade - sdt * 1.6); p.mesh.material.forEach((m) => { m.transparent = true; m.opacity = p.fade; }); }
      const goneNow = p.t > 0.3 && p.vy < 0 && p.y < p.y0 - 0.2;
      if (goneNow && !p.gone) { p.gone = true; p.group.visible = false; }
      if (!p.gone) allDown = false;
    }
    if (launched.length) {
      const xs = launched.map((p) => screenX(p.x));
      onLaunch?.({ n: launched.length, x: (xs.reduce((a, b) => a + b, 0) / xs.length / W) * 2 - 1 });
      if (!reducedMotion()) for (const x of xs) fx.push({ kind: 'puff', x, y: H - 12, born: now, dur: 420 });
    }
    if (allDown && !resolved) { resolved = true; onLanded?.({ token: tossToken }); }
    for (let i = halves.length - 1; i >= 0; i--) {
      const h = halves[i];
      h.life -= sdt; h.vel.y -= 9 * sdt;
      h.push.multiplyScalar(Math.max(0, 1 - 3.2 * sdt));
      h.group.position.addScaledVector(h.vel, sdt).addScaledVector(h.push, sdt);
      h.group.rotation.x += h.spin.x * sdt; h.group.rotation.y += h.spin.y * sdt; h.group.rotation.z += h.spin.z * sdt;
      if (now >= freezeUntil) h.flash = Math.max(0, h.flash - realDt * 5);   // 멈칫이 끝나면 하얀 번쩍임이 빠진다
      h.group.updateMatrixWorld(true);
      tmpPlane.copy(h.local).applyMatrix4(h.group.matrixWorld);
      const op = Math.max(0, Math.min(1, h.life / 0.5));
      for (const m of h.mats) { m.clippingPlanes[0].copy(tmpPlane); m.opacity = op; m.emissiveIntensity = h.flash; }
      if (h.life <= 0) {
        scene.remove(h.group); h.mats.forEach((m) => m.dispose()); halves.splice(i, 1);
        if (!halves.some((o) => o.owner === h.owner)) releasePiece(h.owner);   // 두 쪽 다 사라지면 판 자원도
      }
    }
    for (let i = fluffs.length - 1; i >= 0; i--) {
      const f = fluffs[i]; f.life -= sdt;
      const pos = f.points.geometry.attributes.position;
      f.vel.forEach((v, k) => { v.y -= 5 * sdt; pos.setXYZ(k, pos.getX(k) + v.x * sdt, pos.getY(k) + v.y * sdt, pos.getZ(k) + v.z * sdt); });
      pos.needsUpdate = true; f.points.material.opacity = Math.max(0, f.life / 0.8);
      if (f.life <= 0) { scene.remove(f.points); f.points.geometry.dispose(); f.points.material.dispose(); fluffs.splice(i, 1); }
    }
    for (let i = flakes.length - 1; i >= 0; i--) {
      const f = flakes[i]; f.life -= sdt;
      if (f.life <= 0) { scene.remove(f.mesh); f.mesh.material.dispose(); f.mesh.dispose(); flakes.splice(i, 1); continue; }
      placeFlakes(f, sdt);
    }
    renderer.render(scene, camera);
    drawOverlay(now);
  }

  /**
   * 미리 데우기: 베기에 쓰는 재질 모양(잘린 앞·옆면, 속살, 빛 테두리, 부스러기, 털, 그림자)을 화면 밖에서 한 번 그려 셰이더를 만들어 두고,
   * 그 재질은 버리지 않는다. 재질을 다 버리면 셰이더도 함께 버려져 다음 베기 때 다시 컴파일하느라 화면이 멈춘다
   * (실측 2026-10-02: 베기마다 프로그램 4→11, 벤 다음 프레임 50~600ms. 히트스톱이 아니라 진짜 버벅임).
   */
  function warmUp() {
    // 진짜 낱말 조각 하나(돌출 도형·글꼴로 그린 앞면 그림)도 함께 그려, 첫 던지기에서 글꼴·도형·그림 올리기가 처음 일어나며 멈추지 않게 한다
    const color = FELT[2], piece = makePiece('가나', 1, color, measure('가나', 0.8), 0.8), geo = piece.geo;
    const [front, side] = piece.mesh.material;
    const plane = () => [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
    const cut = (m) => { const c = m.clone(); c.clippingPlanes = plane(); c.clipShadows = true; c.transparent = true; c.emissive = new THREE.Color(0xfff6dc); c.emissiveIntensity = 0; return c; };
    const keep = new THREE.Group();
    const whole = piece.mesh; keep.add(piece.group);
    const half = new THREE.Mesh(geo, [cut(front), cut(side)]); half.castShadow = true;
    const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color.inner, side: THREE.BackSide, roughness: 1, clippingPlanes: plane(),
      clipShadows: true, transparent: true, emissive: new THREE.Color(0xfff6dc), emissiveIntensity: 0 }));
    const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe07a, side: THREE.BackSide, transparent: true, opacity: 0.9 }));
    const bits = new THREE.InstancedMesh(flakeGeo, new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), 1);
    bits.setColorAt(0, new THREE.Color(0xffffff)); bits.setMatrixAt(0, new THREE.Matrix4());
    const fuzz = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, map: dotTex, transparent: true, depthWrite: false }));
    keep.add(half, inner, glow, bits, fuzz);
    scene.add(keep);   // 화면 가운데(그림자 카메라 안). 잘림 면은 실제로 그릴 때만 셰이더에 들어가서 화면 밖에 두면 안 된다
    // 1픽셀 영역에만 두 번 그린다(사용자에게는 보이지 않는다). 그림자용 재질은 처음 그려질 때 셰이더가 정해지는데,
    // 첫 그리기에서는 빛 정보가 그림자 다음에 채워져 빛 0개짜리가 된다. 그래서 첫 그리기는 그림자 없이(빛 정보만 채우고),
    // 두 번째 그리기에서 그림자를 켜 실제와 같은 그림자 셰이더를 만든다(실측: 그러지 않으면 벨 때마다 두 개를 새로 만든다)
    renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
    whole.castShadow = half.castShadow = false;
    renderer.render(scene, camera);
    whole.castShadow = half.castShadow = true;
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    keep.visible = false;   // 더는 그리지 않지만 재질을 버리지 않아 셰이더가 남는다
  }

  resize();
  warmUp();
  raf = requestAnimationFrame(frame);
  window.addEventListener('resize', resize);

  return {
    toss, settle, sliceIndex, resize,
    clear: () => { clearPieces(); resolved = true; },
    setTopPx(px) { topPx = px; }, setShowNumbers(v) { view.showNumbers = !!v; },
    /** 게임 화면이 보일 때만 그린다. */
    setActive(v) { active = !!v; lastT = performance.now(); pausedDrawn = false; },
    pause(v) { paused = !!v; pausedDrawn = false; if (v) { pid = null; last = null; trail.length = 0; } },
    get resolved() { return resolved; },
    pieceScreen(i) { const p = pieces.find((x) => x.index === i); return p ? screenOf(p) : null; },
    pieceWords() { return pieces.map((p) => ({ index: p.index, word: p.word, n: p.n, alive: p.alive, gone: p.gone })); },
    /** 확인용: GPU 자원 수(셰이더 프로그램·도형·그림). 베기마다 프로그램이 늘면 그 순간 컴파일로 화면이 멈춘다. */
    gpuInfo(detail = false) { const m = renderer.info.memory, ps = renderer.info.programs || []; return { programs: ps.length, geometries: m.geometries, textures: m.textures, ...(detail ? { keys: ps.map((x) => `${x.name}|${x.cacheKey}`) } : {}) }; },
    dispose() { cancelAnimationFrame(raf); clearPieces(); renderer.dispose(); },
  };
}
