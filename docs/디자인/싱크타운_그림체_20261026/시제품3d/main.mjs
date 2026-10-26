// 펠트 낮판 위에 진짜 3D 몽글을 얹는 시험 (2026-10-26).
// 몽글 · 옷 · 염색은 WORLD 옷장과 같은 코드(experiences/synk-world-home)를 그대로 쓴다. 사진은 고정 카메라라
// 3D는 사진 좌표(1536 × 1024 픽셀)를 그대로 쓰는 직교 카메라 한 대로 그리고, 사진을 찍은 높이만큼(약 22도)
// 몽글을 앞으로 기울여 위에서 내려다본 모습을 맞춘다. 빛은 사진처럼 왼쪽 위 앞에서 오는 부드러운 낮빛이다.
import * as THREE from '../../../../experiences/synk-world-home/scene-assets/three.module.js';
import { createMongleAvatar } from '../../../../experiences/synk-world-home/avatar-v3.mjs';
import { WARDROBE_ITEMS, outfitLabel } from '../../../../experiences/synk-world-home/wardrobe-catalog.mjs';
import { wardrobeDyeDefaults } from '../../../../experiences/synk-world-home/avatar-wardrobe.mjs';

// ── the photo's places (pixels of the 1536 × 1024 day photo) ──
const WALK = [
  [[352, 652], [420, 606], [588, 606], [590, 600], [985, 600], [1000, 640], [1004, 668], [940, 680], [820, 690], [790, 698], [565, 700], [420, 698], [355, 690]],
  [[990, 650], [1100, 688], [1112, 702], [1080, 714], [992, 700]],
  [[1088, 614], [1338, 612], [1348, 655], [1205, 676], [1112, 702], [1092, 662]],
  [[1125, 690], [1200, 682], [1245, 750], [1250, 815], [1200, 822], [1180, 745]],
];
const POND = { x: 950, y: 748, rx: 128, ry: 48 };
const SEAT = { x: 684, y: 579 }, SEAT_STEP = { x: 664, y: 646 };
const PEOPLE = {
  owner: { name: '찻집 주인', hot: [680, 478, 62, 110], head: [688, 388], near: { x: 628, y: 650 },
    lines: ['어서 와요, 몽글! 오늘은 보리차가 잘 우러났어요.', '옷이 잘 어울려요. 오늘 산책 가요?', '온실 토마토가 익으면 차랑 같이 내 볼게요.'],
    seated: ['따뜻한 보리차 한 잔 나왔어요. 천천히 마셔요.', '한 잔 더 드릴까요? 오늘은 손님이 적어서 여유가 있어요.'] },
  prof: { name: '교수님', hot: [872, 505, 56, 86], head: [878, 418], near: { x: 932, y: 652 },
    lines: ['오늘은 바람이 서쪽에서 불어요. 저녁엔 선선하겠네요.', '그 색 고른 이유가 궁금하네요. 잘 골랐어요.', '연못 연잎이 어제보다 하나 늘었어요.'],
    seated: ['같이 앉으니 차 맛이 더 좋네요.', '몽글은 오늘 어디부터 둘러볼 거예요?'] },
};
const BASE_Y = 697, SPEED = 210, CELL = 6, ELEV = 22 * Math.PI / 180, VISIBLE_WIDTH = 124;
const SWATCHES = ['#ee7f6b', '#f5c445', '#4a6fc4', '#859b87', '#975b70', '#ede4d1', '#5b6b7f', '#c38c6f'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = innerWidth < 640 || matchMedia('(pointer: coarse)').matches;
const $ = id => document.getElementById(id);
const world = $('world'), stage = $('stage'), wrap = $('wrap'), shadow = $('shadow'), canvas = $('gl');

// ── walk grid and paths (as in the 2D prototype) ──
const inPoly = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const GW = Math.ceil(1536 / CELL), GH = Math.ceil(1024 / CELL), grid = new Uint8Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2; if (WALK.some(p => inPoly(p, x, y))) grid[j * GW + i] = 1; }
const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))];
const open = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && grid[j * GW + i] === 1;
function nearest(x, y) {
  const [ci, cj] = cellOf(x, y); if (open(ci, cj)) return { x, y };
  let best = null, bd = Infinity;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (grid[j * GW + i]) { const d = (i - ci) ** 2 + (j - cj) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
  return { x: best[0] * CELL + CELL / 2, y: best[1] * CELL + CELL / 2 };
}
function sight(a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3);
  for (let k = 0; k <= n; k++) { const t = k / Math.max(1, n), [i, j] = cellOf(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); if (!open(i, j)) return false; }
  return true;
}
function route(from, to) {
  if (sight(from, to)) return [to];
  const [si, sj] = cellOf(from.x, from.y), [ti, tj] = cellOf(to.x, to.y), N = GW * GH;
  const g = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
  const h = (i, j) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return Math.max(dx, dy) + .414 * Math.min(dx, dy); };
  const push = (k, f) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const s = sj * GW + si, t = tj * GW + ti; g[s] = 0; push(s, h(si, sj));
  while (heap.length) {
    const [, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === t) break;
    const i = k % GW, j = (k / GW) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!open(ni, nj)) continue;
      if (di && dj && (!open(i + di, j) || !open(i, j + dj))) continue;
      const nk = nj * GW + ni, ng = g[k] + (di && dj ? 1.414 : 1); if (ng < g[nk]) { g[nk] = ng; prev[nk] = k; push(nk, ng + h(ni, nj)); }
    }
  }
  if (prev[t] < 0) return [to];
  const cells = []; for (let k = t; k !== s && k >= 0; k = prev[k]) cells.push({ x: (k % GW) * CELL + CELL / 2, y: ((k / GW) | 0) * CELL + CELL / 2 });
  cells.reverse(); cells[cells.length - 1] = to;
  const out = []; let at = from, idx = 0;
  while (idx < cells.length) { let far = idx; for (let k = cells.length - 1; k > idx; k--) if (sight(at, cells[k])) { far = k; break; } out.push(cells[far]); at = cells[far]; idx = far + 1; }
  return out;
}

// ── 3D: one orthographic camera in photo pixels (x right, y down → three y up) ──
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'default' });
renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .96;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1536, 0, -1024, -4000, 4000); camera.position.set(0, 0, 2000);
// A soft studio sky for reflections and sheen: cool above, warm paper below, a bright window at the upper left.
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#eef5fc'); g.addColorStop(.48, '#fbf5ec'); g.addColorStop(.55, '#d9ccb6'); g.addColorStop(1, '#b8a88f'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const w = x.createRadialGradient(70, 30, 2, 70, 30, 34); w.addColorStop(0, 'rgba(255,255,255,.95)'); w.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = w; x.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentIntensity = .5; t.dispose(); pmrem.dispose();
}
scene.add(new THREE.HemisphereLight('#e6f0fa', '#a08a6c', .72));
const keyDir = new THREE.Vector3(-.55, .78, .62).normalize();
const key = new THREE.DirectionalLight('#fff1dc', 3.1); key.castShadow = true; key.shadow.mapSize.set(phone ? 512 : 1024, phone ? 512 : 1024);
Object.assign(key.shadow.camera, { left: -150, right: 150, top: 170, bottom: -170, near: 1, far: 2400 }); key.shadow.bias = -.0004; key.shadow.radius = 3;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight('#d6e6f5', .38); fill.position.set(.8, .3, .6); scene.add(fill);
const rim = new THREE.DirectionalLight('#ffffff', .55); rim.position.set(.3, .8, -.8); scene.add(rim);

// place (photo position, pixels) → tilt (the camera's height) → yaw (facing) → squash (hop) → Mongle (foot origin)
const place = new THREE.Group(), tilt = new THREE.Group(), yawGroup = new THREE.Group(), squash = new THREE.Group();
tilt.rotation.x = ELEV; place.add(tilt); tilt.add(yawGroup); yawGroup.add(squash); scene.add(place);
let avatar = null, body = null, unitScale = 70, footDrop = 0;
// At diorama size (about 60 px per metre of Mongle) the WORLD fitting-room felt reads as smooth clay: this test makes the
// fibres larger, adds a visible fuzz halo and keeps the hem stitches readable. Only this page changes; WORLD is untouched.
function feltForDiorama(group) {
  const bodyMesh = group.getObjectByName('mongle-bell-scalloped-body'); if (!bodyMesh) return null;
  const mat = bodyMesh.material;
  for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap']) if (mat[key]) { mat[key] = mat[key].clone(); mat[key].repeat.set(3.6, 1.45); mat[key].needsUpdate = true; }
  mat.normalScale.set(1.15, 1.15); mat.color.set('#f9bfae'); mat.sheen = .95; mat.sheenColor.set('#ffc2ad'); mat.sheenRoughness = .7; mat.needsUpdate = true;
  // Fuzz: short curly fibres standing off the body surface, denser towards the silhouette.
  const g = bodyMesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, pts = [], cols = [], c = new THREE.Color(), n = new THREE.Vector3(), p = new THREE.Vector3(), t = new THREE.Vector3();
  let seed = 7; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const count = phone ? 3800 : 6500;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rnd() * pos.count); p.fromBufferAttribute(pos, k); n.fromBufferAttribute(nor, k).normalize();
    if (p.y < .3 || n.y < -.4) continue;
    t.set(rnd() - .5, rnd() - .5, rnd() - .5).cross(n).normalize();
    const len = .012 + rnd() * .026, bend = (rnd() - .5) * .9;
    const a = p.clone().addScaledVector(n, .002), mid = a.clone().addScaledVector(n, len * .55).addScaledVector(t, len * bend * .5), b = a.clone().addScaledVector(n, len).addScaledVector(t, len * bend);
    pts.push(a.x, a.y, a.z, mid.x, mid.y, mid.z, mid.x, mid.y, mid.z, b.x, b.y, b.z);
    c.set(rnd() < .5 ? '#e8806b' : '#c9584a').lerp(new THREE.Color('#f7b3a0'), rnd() * .3);
    for (let j = 0; j < 4; j++) cols.push(c.r, c.g, c.b);
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const fuzz = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .3, depthWrite: false }));
  fuzz.position.copy(bodyMesh.position); fuzz.name = 'diorama-felt-fuzz'; bodyMesh.parent.add(fuzz);
  // Hem stitches: thicker so the cream running stitch survives at this size.
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), at = new THREE.Vector3();
  group.traverse(o => { if (!o.isInstancedMesh || o.count < 100) return; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mm); mm.decompose(at, q, sc); sc.x *= 2; sc.z *= 2; mm.compose(at, q, sc); o.setMatrixAt(i, mm); } o.instanceMatrix.needsUpdate = true; });
  return bodyMesh;
}

const m = { x: 597, y: BASE_Y, path: [], seated: false, yaw: .5, wantYaw: .5, travelled: 0, hop: null, then: null, tapHop: 0 };
const depth = y => 1 + (y - BASE_Y) * .001;
const turnTo = (x, y) => { const dx = x - m.x, dy = (y - m.y) / Math.sin(ELEV); if (Math.hypot(dx, dy) > 1) m.wantYaw = Math.atan2(dx, dy); };
function calibrate() {
  // Fit the projected height to the felted Mongle in the photo, and lift the origin so the lowest hem touches the ground point.
  place.scale.setScalar(1); place.position.set(0, 0, 0); yawGroup.rotation.y = .5; squash.scale.set(1, 1, 1); place.updateMatrixWorld(true);
  // Vertex-precise: a rotated bounding box of bounding boxes overstates the size by a quarter.
  const box = new THREE.Box3().setFromObject(body || tilt, true); unitScale = VISIBLE_WIDTH / (box.max.x - box.min.x); footDrop = -box.min.y;
}
function draw(now) {
  let lift = 0, sx = 1, sy = 1;
  if (m.hop) {
    const t = Math.min(1, (now - m.hop.start) / m.hop.ms), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    m.x = m.hop.a.x + (m.hop.b.x - m.hop.a.x) * e; m.y = m.hop.a.y + (m.hop.b.y - m.hop.a.y) * e; lift = Math.sin(Math.PI * t) * 46;
    sy = 1 + .08 * Math.sin(Math.PI * t); sx = 1 - .05 * Math.sin(Math.PI * t);
    if (t >= 1) { const done = m.hop.done; m.hop = null; done?.(); }
  } else if (m.path.length) {
    const phase = (m.travelled / 34) % 1, bounce = Math.sin(Math.PI * phase);
    if (!reduced) { lift = bounce * 13; sy = 1 + .05 * bounce - .06 * Math.max(0, .25 - bounce) * 4; sx = 2 - sy; }
  } else if (!reduced && m.tapHop) {
    const t = Math.min(1, (now - m.tapHop) / 420); lift = Math.sin(Math.PI * t) * 26; sy = 1 + .06 * Math.sin(Math.PI * t); sx = 2 - sy; if (t >= 1) m.tapHop = 0;
  }
  let d = m.wantYaw - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.yaw += d * Math.min(1, .16);
  const k = unitScale * depth(m.y) * (m.seated ? .92 : 1);
  place.scale.setScalar(k); place.position.set(m.x, -m.y + footDrop * k + lift, 0);
  yawGroup.rotation.y = m.yaw; squash.scale.set(sx, sy, sx);
  key.target.position.copy(place.position); key.position.copy(place.position).addScaledVector(keyDir, 1000);
  const ks = depth(m.y) * (m.seated ? .92 : 1);
  shadow.style.transform = `translate(${m.x}px, ${m.y - 2}px) scale(${ks * (1 - lift / 160)})`;
  shadow.style.opacity = String(Math.max(.25, 1 - lift / 70) * (m.seated ? .5 : 1));
  if (avatar) { avatar.update(now / 1000, { reducedMotion: reduced }); renderer.render(scene, camera); }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!m.hop && m.path.length) {
    let step = SPEED * dt * depth(m.y);
    while (step > 0 && m.path.length) {
      const p = m.path[0], dx = p.x - m.x, dy = p.y - m.y, dd = Math.hypot(dx, dy);
      turnTo(p.x, p.y);
      if (dd <= step) { m.x = p.x; m.y = p.y; m.path.shift(); step -= dd; m.travelled += dd; }
      else { m.x += dx / dd * step; m.y += dy / dd * step; m.travelled += step; step = 0; }
    }
    if (!m.path.length) { const then = m.then; m.then = null; then?.(); }
    follow();
  }
  draw(now); requestAnimationFrame(frame);
}

function walkTo(target, then) {
  const go = () => { m.path = route({ x: m.x, y: m.y }, nearest(target.x, target.y)); m.then = then || null; if (!m.path.length) then?.(); };
  hideBubble();
  if (m.seated) { m.seated = false; setSeat(false); m.hop = { a: { x: m.x, y: m.y }, b: SEAT_STEP, start: performance.now(), ms: 380, done: go }; }
  else go();
}
function sit() {
  if (m.seated) return say('owner', true);
  walkTo(SEAT_STEP, () => {
    m.wantYaw = 1.0;
    m.hop = { a: { x: m.x, y: m.y }, b: SEAT, start: performance.now(), ms: 440, done: () => { m.seated = true; setSeat(true); setTimeout(() => say('owner', true), 260); } };
  });
}
const defaultHint = '땅을 누르면 몽글이 걸어가요. 옷장에서 옷을 바꿔 보세요.';
function setSeat(on) {
  ['steam-a', 'steam-b', 'steam-c'].forEach(id => $(id).classList.toggle('on', on));
  $('hint').textContent = on ? '탁자에 앉았어요. 주민을 누르면 앉은 채로 이야기해요. 땅을 누르면 일어나요.' : defaultHint;
}

// ── speech ──
let bubble = null, bubbleTimer = 0; const turns = { owner: 0, prof: 0 };
function hideBubble() { if (bubble) { bubble.remove(); bubble = null; } clearTimeout(bubbleTimer); }
function say(id, seated = m.seated) {
  const p = PEOPLE[id], list = seated ? p.seated : p.lines, line = list[turns[id]++ % list.length];
  hideBubble(); bubble = document.createElement('div'); bubble.className = 'bubble';
  bubble.innerHTML = '<span class="who"></span><span class="say"></span>'; bubble.querySelector('.who').textContent = p.name; bubble.querySelector('.say').textContent = line;
  bubble.style.left = p.head[0] + 'px'; bubble.style.top = p.head[1] + 'px'; world.appendChild(bubble);
  bubbleTimer = setTimeout(hideBubble, 4600);
}
function talk(id) {
  const p = PEOPLE[id];
  if (m.seated) return say(id, true);
  const face = () => turnTo(p.head[0], p.near.y - 40);
  if (Math.hypot(p.near.x - m.x, p.near.y - m.y) < 40) { face(); return say(id); }
  walkTo(p.near, () => { face(); say(id); });
}

// ── input ──
const toWorld = e => { const r = world.getBoundingClientRect(), s = r.width / 1536; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; };
function ring(p, water) { const el = document.createElement('span'); el.className = 'ring' + (water ? ' water' : ''); el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; world.appendChild(el); setTimeout(() => el.remove(), 1200); }
world.addEventListener('click', e => {
  if (e.target.closest('.hot')) return;
  const p = toWorld(e), k = depth(m.y);
  if (!m.seated && Math.abs(p.x - m.x) < 58 * k && p.y < m.y + 4 && p.y > m.y - 130 * k) { m.tapHop = performance.now(); return; }
  const inPond = ((p.x - POND.x) / POND.rx) ** 2 + ((p.y - POND.y) / POND.ry) ** 2 < 1;
  ring(p, inPond); if (inPond) setTimeout(() => ring({ x: p.x + 10, y: p.y + 4 }, true), 260);
  walkTo(p);
});
const box = (id, [x, y, rx, ry]) => Object.assign($(id).style, { left: x - rx + 'px', top: y - ry + 'px', width: rx * 2 + 'px', height: ry * 2 + 'px' });
box('hot-owner', PEOPLE.owner.hot); box('hot-prof', PEOPLE.prof.hot); box('hot-table', [768, 568, 86, 52]);
$('hot-owner').addEventListener('click', () => talk('owner'));
$('hot-prof').addEventListener('click', () => talk('prof'));
$('hot-table').addEventListener('click', e => { ring(toWorld(e)); sit(); });
[['steam-a', 798, 512], ['steam-b', 806, 508], ['steam-c', 792, 516]].forEach(([id, x, y]) => Object.assign($(id).style, { left: x + 'px', top: y + 'px' }));

// ── fit: the whole photo on wide screens; on a tall phone the photo fills the height and scrolls sideways ──
let scale = 1;
function fit() {
  const r = wrap.getBoundingClientRect(), tall = r.width / Math.max(1, r.height) < 1.1;
  scale = tall ? Math.min(r.height * .96 / 1024, r.width * 2.4 / 1536) : Math.min(r.width / 1536, r.height / 1024);
  stage.style.width = 1536 * scale + 'px'; stage.style.height = 1024 * scale + 'px'; world.style.transform = `scale(${scale})`;
  wrap.style.placeItems = 1536 * scale > r.width ? 'center start' : 'center';
  const px = Math.min(2, devicePixelRatio || 1); renderer.setPixelRatio(1); renderer.setSize(Math.round(1536 * scale * px), Math.round(1024 * scale * px), false);
  follow(true);
}
function follow(jump) {
  if (wrap.scrollWidth <= wrap.clientWidth) return;
  const want = m.x * scale - wrap.clientWidth / 2, cur = wrap.scrollLeft;
  wrap.scrollLeft = jump ? want : cur + (want - cur) * .08;
}

// ── wardrobe: the same 14 garments and two-colour dyes as WORLD's 옷장 ──
let slots = { body: '', neck: 'mongle-scarf-first-steps' }, dyes = {}, tab = 'body';
function labelState() { $('state').textContent = $('closet-label').textContent = outfitLabel(slots); }
function applyOutfit(changed) {
  if (!avatar) return;
  avatar.setOutfit(slots);
  const defaults = wardrobeDyeDefaults(slots); const next = {};
  for (const slot of ['body', 'neck']) if (slots[slot]) next[slot] = slot === changed || !dyes[slot] ? defaults[slot] : dyes[slot];
  dyes = avatar.setDyes(next); syncDyes(); labelState();
  if (!m.path.length && !m.hop && !m.seated) m.tapHop = performance.now();
}
function renderItems() {
  const list = WARDROBE_ITEMS.filter(i => i.slot === tab), el = $('items');
  el.innerHTML = '';
  const add = (id, name, img) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'item'; b.id = `item-${id || 'none-' + tab}`; b.setAttribute('aria-pressed', String((slots[tab] || '') === id));
    if (img) { const i = document.createElement('img'); i.src = img; i.alt = ''; i.loading = 'lazy'; b.appendChild(i); } else { const n = document.createElement('span'); n.className = 'none'; n.textContent = '–'; b.appendChild(n); }
    const t = document.createElement('span'); t.textContent = name; b.appendChild(t);
    b.addEventListener('click', () => { slots = { ...slots, [tab]: id }; applyOutfit(tab); renderItems(); });
    el.appendChild(b);
  };
  add('', tab === 'body' ? '몸 비우기' : '목 비우기');
  for (const item of list) add(item.id, item.name, `assets/wardrobe-thumbnails-v8/${item.id}.png`);
}
function syncDyes() {
  const pair = dyes[tab], on = !!slots[tab] && !!pair;
  for (const [i, id] of [[0, 'dye-a'], [1, 'dye-b']]) { $(id).disabled = !on; if (on) $(id).value = pair[i]; }
  $('dye-reset').disabled = !on; $('swatches').querySelectorAll('button').forEach(b => { b.disabled = !on; });
}
function setDye(pair) { if (!avatar || !slots[tab]) return; dyes = avatar.setDyes({ ...dyes, [tab]: pair }); syncDyes(); }
$('dye-a').addEventListener('input', e => setDye([e.target.value, dyes[tab]?.[1] || e.target.value]));
$('dye-b').addEventListener('input', e => setDye([dyes[tab]?.[0] || e.target.value, e.target.value]));
$('dye-reset').addEventListener('click', () => setDye(wardrobeDyeDefaults(slots)[tab]));
for (const hex of SWATCHES) { const b = document.createElement('button'); b.type = 'button'; b.style.background = hex; b.setAttribute('aria-label', `원단 색 ${hex}`); b.addEventListener('click', () => setDye([hex, dyes[tab]?.[1] || hex])); $('swatches').appendChild(b); }
for (const t of ['body', 'neck']) $(`tab-${t}`).addEventListener('click', () => { tab = t; ['body', 'neck'].forEach(s => $(`tab-${s}`).setAttribute('aria-pressed', String(s === tab))); renderItems(); syncDyes(); });
const closet = $('closet'), opener = $('open-closet');
const showCloset = on => { closet.hidden = !on; opener.setAttribute('aria-expanded', String(on)); document.querySelector('.app').classList.toggle('dressing', on); if (on) { renderItems(); syncDyes(); requestAnimationFrame(() => follow(true)); } };
opener.addEventListener('click', () => showCloset(closet.hidden));
$('close-closet').addEventListener('click', () => showCloset(false));

addEventListener('resize', fit); fit(); requestAnimationFrame(frame);
createMongleAvatar({ mobile: phone, anisotropy: 4 }).then(a => {
  avatar = a; avatar.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  squash.add(avatar.group); body = feltForDiorama(avatar.group); avatar.setOutfit(slots); dyes = avatar.setDyes(wardrobeDyeDefaults(slots));
  calibrate(); labelState(); document.documentElement.dataset.mongle = 'ready';
  globalThis.__mongle3d = { avatar, metrics: () => ({ ...avatar.metrics(), unitScale, footDrop, info: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs?.length } }), slots: () => ({ ...slots }), dyes: () => ({ ...dyes }) };
}).catch(error => { $('state').textContent = '3D 몽글을 불러오지 못했어요'; $('hint').textContent = String(error?.message || error); document.documentElement.dataset.mongle = 'failed'; });
