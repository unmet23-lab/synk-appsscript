// 빈 펠트 무대 위의 3D 주민 시험 (2026-10-26).
// 찻집 주인 · 공방 주인 · 연구원은 Town의 주민 코드(experiences/synk-town/day-residents.mjs), 몽글은 WORLD 옷장 코드
// 그대로다. 사진 좌표(1536 × 1024 픽셀) 직교 카메라 한 대에, 사진에서 오린 앞쪽 물건(탁자 · 걸상 · 차양 · 기둥)을
// 같은 사진 위치에 겹으로 두고, 바닥에 닿는 높이(base) 순서로 한 겹씩 그린다 — 뒤에 있는 주민은 앞 물건에 가려진다.
import * as THREE from '../../../../experiences/synk-world-home/scene-assets/three.module.js';
import { createMongleAvatar } from '../../../../experiences/synk-world-home/avatar-v3.mjs';
import { makeTownResident } from '../../../../experiences/synk-town/day-residents.mjs';
import { loadBlenderResident } from './blender-residents.mjs';
import OCCLUDERS from './occluders.json';

const ELEV = 22 * Math.PI / 180, BASE_Y = 697;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = innerWidth < 640 || matchMedia('(pointer: coarse)').matches;
const $ = id => document.getElementById(id);
const world = $('world'), stage = $('stage'), wrap = $('wrap'), canvas = $('gl'), rainCanvas = $('rain');
const depth = y => 1 + (y - BASE_Y) * .001;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── places (photo pixels) ──
// Behind the round table the owner's lower legs hide behind it; at the table's far edge their feet read as standing on it.
const COUNTER = { x: 806, y: 556 }, SERVE = { x: 742, y: 562 }, SEAT_R = { x: 862, y: 596 }, GARDEN = { x: 722, y: 694 };
const OWNER_OUT = [{ x: 760, y: 560 }, { x: 690, y: 566 }, { x: 642, y: 602 }, { x: 640, y: 648 }, { x: 684, y: 680 }];
const RESEARCHER_IN = [{ x: 1330, y: 640 }, { x: 1200, y: 672 }, { x: 1060, y: 690 }, { x: 960, y: 684 }, { x: 912, y: 648 }];
const WORKBENCH = { x: 1196, y: 597 };
// The grandmother knits on the front courtyard bench; in the rain she moves to the cushioned bench under the left house's eaves.
const BENCH = { x: 620, y: 748, lift: 40, base: 766 }, RED_BENCH = { x: 362, y: 632, lift: 38, base: 641 };
const GRANDMA_OUT = [{ x: 600, y: 684 }, { x: 520, y: 662 }, { x: 440, y: 646 }, { x: 392, y: 640 }];
// Props keep the scale they were made at, whoever lives here now (it was the human café owner's).
const PROP_UNIT = 172.68;
// Behind the round table the owner faces us and pours into the cups on it (a felt bun's face is on its front only).
const OWNER_WORK_YAW = .35;
// Mongle walks where the earlier prototypes let it walk.
const WALK = [
  [[352, 652], [420, 606], [588, 606], [590, 640], [985, 640], [1000, 650], [1004, 668], [940, 680], [820, 690], [790, 698], [565, 700], [420, 698], [355, 690]],
  [[990, 650], [1100, 688], [1112, 702], [1080, 714], [992, 700]],
  [[1088, 614], [1338, 612], [1348, 655], [1205, 676], [1112, 702], [1092, 662]],
  [[1125, 690], [1200, 682], [1245, 750], [1250, 815], [1200, 822], [1180, 745]],
];

// ── renderer: one orthographic camera in photo pixels; each drawable is drawn in base order with its own depth ──
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'default' });
renderer.setClearColor(0x000000, 0); renderer.autoClear = false; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .96;
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(0, 1536, 0, -1024, -4000, 4000); camera.position.set(0, 0, 2000);
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#eef5fc'); g.addColorStop(.48, '#fbf5ec'); g.addColorStop(.55, '#d9ccb6'); g.addColorStop(1, '#b8a88f'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentIntensity = .45; t.dispose(); pmrem.dispose();
}
const hemi = new THREE.HemisphereLight('#e6f0fa', '#a08a6c', .72), key = new THREE.DirectionalLight('#fff1dc', 3.0), fill = new THREE.DirectionalLight('#d6e6f5', .38);
key.position.set(-.55, .78, .62); fill.position.set(.8, .3, .6);
// Warm lamp light inside the tea house and the workshop: characters under the roofs catch it, more so on a grey day.
const lampCafe = new THREE.PointLight('#ffc98a', .7, 520, 0), lampShop = new THREE.PointLight('#ffc98a', .5, 360, 0);
lampCafe.position.set(800, -430, 260); lampShop.position.set(1250, -470, 220);
scene.add(hemi, key, fill, lampCafe, lampShop);
const LIGHT = {
  day: { hemi: ['#e6f0fa', '#a08a6c', .72], key: ['#fff1dc', 3.0], fill: .38, lamp: [.7, .5], exposure: .96 },
  rain: { hemi: ['#cfd9e6', '#7f7d7a', 1.0], key: ['#e3e9f0', .95], fill: .55, lamp: [1.45, 1.1], exposure: .9 },
};
function setLight(kind) { const L = LIGHT[kind]; hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; key.color.set(L.key[0]); key.intensity = L.key[1]; fill.intensity = L.fill; lampCafe.intensity = L.lamp[0]; lampShop.intensity = L.lamp[1]; renderer.toneMappingExposure = L.exposure; }

const drawables = [];   // { root, base: () => number, hidden: () => boolean }
function addDrawable(root, base, hidden = () => false) { scene.add(root); const d = { root, base, hidden }; drawables.push(d); return d; }
function removeDrawable(d) { const i = drawables.indexOf(d); if (i >= 0) drawables.splice(i, 1); scene.remove(d.root); }

// ── occluders: the photo's own pixels for the things in front ──
const loader = new THREE.TextureLoader(), occluders = [];
for (const o of OCCLUDERS) {
  const tex = { day: loader.load(`occ-${o.id}-day.png`), rain: loader.load(`occ-${o.id}-rain.png`) };
  for (const t of Object.values(tex)) { t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  const mat = new THREE.MeshBasicMaterial({ map: tex.day, transparent: true, toneMapped: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), mat); mesh.position.set(o.x + o.w / 2, -(o.y + o.h / 2), 0);
  occluders.push({ mesh, tex, o }); addDrawable(mesh, () => o.base);
}

// ── characters ──
// Two shadows ground a figure on the photo, as under the photo's own stools: a dark, tight contact patch where the
// felt meets the floor, and a soft wider pool falling a little back and right, away from the key light. A single pale
// ellipse left the residents hovering over the floor.
const shadeTexture = stops => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 63);
  for (const [t, a] of stops) g.addColorStop(t, `rgba(34,22,14,${a})`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const POOL = shadeTexture([[0, .36], [.45, .24], [.8, .07], [1, 0]]), CONTACT = shadeTexture([[0, .86], [.35, .7], [.7, .22], [1, 0]]);
function groundShadow() {
  // Sized for a figure one unit wide; the ground ellipse keeps the photo's 22° view.
  const g = new THREE.Group(), mat = map => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .5), mat(POOL)), contact = new THREE.Mesh(new THREE.PlaneGeometry(.78, .22), mat(CONTACT));
  pool.position.set(.1, .04, 0); pool.renderOrder = contact.renderOrder = -1; g.add(pool, contact); g.userData = { pool, contact }; return g;
}
function makeCharacter({ name, content, height, refY, at, yaw = 0, update = () => {}, footDrop = 0, seatBase = 0 }) {
  const place = new THREE.Group(), tilt = new THREE.Group(), turn = new THREE.Group(), squash = new THREE.Group();
  tilt.rotation.x = ELEV; place.add(tilt); tilt.add(turn); turn.add(squash); squash.add(content);
  const shadow = groundShadow(), holder = new THREE.Group(); holder.add(shadow, place);
  // Measure once, upright and unturned: pixels per unit so the figure is `height` px tall at refY.
  place.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(tilt, true);
  const c = { name, holder, place, turn, squash, content, update, x: at.x, y: at.y, yaw, wantYaw: yaw, path: [], speed: 120, gait: 0, phase: 0, pose: {}, seated: false, seatBase,
    h: box.max.y - box.min.y, unit: height / (box.max.y - box.min.y) / depth(refY), drop: -box.min.y + footDrop, width: box.max.x - box.min.x, lift: 0, then: null, bubble: null, active: true };
  c.drawable = addDrawable(holder, () => c.seated && c.seatBase ? c.seatBase : c.y, () => !c.active);
  return c;
}
const turnToward = (c, x, y) => { const dx = x - c.x, dy = (y - c.y) / Math.sin(ELEV); if (Math.hypot(dx, dy) > 1) c.wantYaw = Math.atan2(dx, dy); };
function walk(c, points) { return new Promise(res => { c.path = points.map(p => ({ ...p })); c.then = res; if (!c.path.length) res(); }); }
function stepCharacter(c, dt, now) {
  if (c.path.length) {
    let step = c.speed * dt * depth(c.y);
    while (step > 0 && c.path.length) {
      const p = c.path[0], dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
      turnToward(c, p.x, p.y);
      if (d <= step) { c.x = p.x; c.y = p.y; c.path.shift(); step -= d; c.phase += d * .09; }
      else { c.x += dx / d * step; c.y += dy / d * step; c.phase += step * .09; step = 0; }
    }
    if (!c.path.length) { const t = c.then; c.then = null; t?.(); }
  }
  c.gait += ((c.path.length ? 1 : 0) - c.gait) * Math.min(1, dt * 8);
  let d = c.wantYaw - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); c.yaw += d * Math.min(1, dt * 7);
  const k = c.unit * depth(c.y);
  c.place.scale.setScalar(k); c.place.position.set(c.x, -c.y + c.drop * k + c.lift, 0); c.turn.rotation.y = c.yaw;
  // Sitting up on a bench, the contact shadow moves onto the seat it rests on.
  const shadow = c.holder.children[0], perched = c.seated && c.lift > 0; shadow.position.set(c.x, -c.y + 1 + (perched ? c.lift : 0), -1); shadow.scale.setScalar(c.width * k);
  shadow.userData.contact.material.opacity = c.seated && !perched ? 0 : 1; shadow.userData.pool.material.opacity = c.seated ? .45 : 1;
  c.update(now, dt, c);
  if (c.bubble) { c.bubble.style.left = c.x + 'px'; c.bubble.style.top = (c.y - c.lift - c.height(k) - 14) + 'px'; }
}
function say(c, text, ms = 3600) {
  c.bubble?.remove(); const b = document.createElement('div'); b.className = 'bubble';
  b.innerHTML = '<span class="who"></span><span class="say"></span>'; b.querySelector('.who').textContent = c.label; b.querySelector('.say').textContent = text;
  world.appendChild(b); c.bubble = b; clearTimeout(c.bubbleTimer); c.bubbleTimer = setTimeout(() => { b.remove(); if (c.bubble === b) c.bubble = null; }, ms);
}

// ── props: the garden table, the tray with two cups, a served cup ──
const felt = (color, rough = .95) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, sheen: .7, sheenRoughness: .8, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff2e0'), .4) });
const M = { wood: felt('#b07c4f'), woodDark: felt('#7a5236'), ceramic: felt('#f4ecd9', .7), band: felt('#7fa58f'), tea: new THREE.MeshStandardMaterial({ color: '#9c6a3a', roughness: .3 }) };
function cup(scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.11, .085, .14, 18), M.ceramic); body.position.y = .07; g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.112, .104, .035, 18), M.band); band.position.y = .095; g.add(band);
  const tea = new THREE.Mesh(new THREE.CylinderGeometry(.095, .095, .01, 16), M.tea); tea.position.y = .13; g.add(tea);
  g.scale.setScalar(scale); return g;
}
function trayGroup() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(.62, .035, .40), M.wood); base.position.y = .018; g.add(base);
  for (const [w, d, x, z] of [[.64, .05, 0, .21], [.64, .05, 0, -.21], [.05, .40, .32, 0], [.05, .40, -.32, 0]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, .05, d), M.woodDark); r.position.set(x, .045, z); g.add(r); }
  const a = cup(.9); a.position.set(-.14, .035, .02); g.add(a); const b = cup(.9); b.position.set(.15, .035, -.03); g.add(b);
  return g;
}
function propHolder(content, at, unitPx, base, { shadow = false, feet = [] } = {}) {
  const place = new THREE.Group(), tilt = new THREE.Group(); tilt.rotation.x = ELEV; place.add(tilt); tilt.add(content);
  // The legs' centre is the place origin, on the floor; each leg also gets its own dark contact spot.
  if (shadow) { place.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(tilt, true), g = groundShadow(); g.scale.setScalar(box.max.x - box.min.x); g.userData.contact.material.opacity = .85; place.add(g); }
  for (const [x, z] of feet) { const spot = new THREE.Mesh(new THREE.PlaneGeometry(.3, .11), new THREE.MeshBasicMaterial({ map: CONTACT, transparent: true, depthWrite: false, toneMapped: false })); spot.position.set(x, -z * Math.sin(ELEV), 0); spot.renderOrder = -1; place.add(spot); }
  const p = { place, tilt, content, x: at.x, y: at.y, unit: unitPx, shown: true, set(x, y, lift = 0) { p.x = x; p.y = y; const k = unitPx * depth(y); place.scale.setScalar(k); place.position.set(x, -y + lift, 0); } };
  p.set(at.x, at.y); p.drawable = addDrawable(place, typeof base === 'function' ? base : () => base ?? p.y, () => !p.shown); return p;
}

// ── build the cast ──
let owner, shopOwner, researcher, grandma, mongle, gardenTable, tray, served = null, weather = 'day', busy = false;
// The Blender residents (modelled by 아르곤, baked by Claude) are the default; `?판=코드` shows the code-turned ones for comparison.
const CODE_CAST = new URLSearchParams(location.search).get('판') === '코드';
{ const t = document.getElementById('cast-toggle'); if (t) { t.href = CODE_CAST ? '?판=블렌더' : '?판=코드'; t.textContent = CODE_CAST ? '블렌더 판으로 보기' : '코드 판으로 보기'; } }
async function resident(shared, id, form) {
  const body = new THREE.Group();
  if (!CODE_CAST) try { const r = await loadBlenderResident(`residents-glb/${form}.json`, form, { mobile: phone }); body.add(r.body); return { body, r }; } catch (error) { console.warn('blender resident', form, error); }
  return { body, r: makeTownResident(body, shared, { id, mobile: phone, felt: 'diorama' }) };
}
async function build() {
  const shared = {};
  const { body: ownerBody, r: o } = await resident(shared, 'cafe-owner', 'bun');
  owner = makeCharacter({ name: 'owner', content: ownerBody, height: 122, refY: 600, at: COUNTER, yaw: OWNER_WORK_YAW, update: (now, dt, c) => o.update({ now, deltaSeconds: dt, walkPhase: c.phase, gaitBlend: c.gait, walking: c.gait > .05, ...c.pose }) });
  owner.label = '찻집 주인'; owner.height = k => o.height * k * 1.05; owner.carry = { at: .36, out: .6 };
  const { body: shopBody, r: s } = await resident(shared, 'workshop-owner', 'bean');
  shopOwner = makeCharacter({ name: 'shop', content: shopBody, height: 148, refY: 600, at: WORKBENCH, yaw: 2.45, update: (now, dt, c) => s.update({ now, deltaSeconds: dt, walkPhase: c.phase, gaitBlend: c.gait, walking: c.gait > .05, working: true, ...c.pose }) });
  shopOwner.label = '공방 주인'; shopOwner.height = k => s.height * k * 1.05;
  const { body: granBody, r: g } = await resident(shared, 'grandmother', 'ricecake');
  grandma = makeCharacter({ name: 'grandma', content: granBody, height: 96, refY: 600, at: BENCH, yaw: .3, seatBase: BENCH.base, update: (now, dt, c) => g.update({ now, walkPhase: c.phase, gaitBlend: c.gait, walking: c.gait > .05, seated: c.seated, working: c.seated, ...c.pose }) });
  grandma.label = '할머니'; grandma.height = k => g.height * k * 1.05; grandma.seated = true; grandma.lift = BENCH.lift; grandma.speed = 70;
  const resBody = new THREE.Group(); const r = makeTownResident(resBody, shared, { id: 'researcher', mobile: phone, felt: 'diorama' });
  researcher = makeCharacter({ name: 'researcher', content: resBody, height: 160, refY: 600, at: RESEARCHER_IN[0], yaw: -1.4, seatBase: 641, update: (now, dt, c) => r.update({ now, walkPhase: c.phase, gaitBlend: c.gait, walking: c.gait > .05, seated: c.seated, ...c.pose }) });
  researcher.label = '연구원'; researcher.height = k => r.height * k * 1.05; researcher.active = false;
  const av = await createMongleAvatar({ mobile: phone, anisotropy: 4 }); av.setOutfit({ body: '', neck: 'mongle-scarf-first-steps' });
  mongle = makeCharacter({ name: 'mongle', content: av.group, height: 128, refY: BASE_Y, at: { x: 520, y: 688 }, yaw: .5, update: now => av.update(now / 1000, { reducedMotion: reduced }) });
  mongle.label = '몽글'; mongle.height = k => 1.9 * k; mongle.speed = 200;
  const unit = PROP_UNIT;
  gardenTable = propHolder(gardenTableGroup(), GARDEN, unit, GARDEN.y, { shadow: true, feet: [0, 2.09, 4.19].map(a => [Math.cos(a) * .2, Math.sin(a) * .2]) });
  tray = propHolder(trayGroup(), { x: GARDEN.x, y: GARDEN.y }, unit, () => tray.y + 1); tray.top = .54; tray.set(GARDEN.x, GARDEN.y, tray.top * unit * depth(GARDEN.y) * Math.cos(ELEV));
}
function gardenTableGroup() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .07, 28), M.wood); top.position.y = .5; g.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.34, .025, 8, 36), M.woodDark); rim.rotation.x = Math.PI / 2; rim.position.y = .5; g.add(rim);
  for (const a of [0, 2.09, 4.19]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, .5, 8), M.woodDark); leg.position.set(Math.cos(a) * .2, .25, Math.sin(a) * .2); g.add(leg); }
  return g;
}

// ── the three scenes ──
async function pourTea() {
  owner.pose = { working: true }; owner.wantYaw = OWNER_WORK_YAW; setStatus('찻집 주인이 탁자에서 차를 따라요'); await sleep(2600);
  owner.pose = { showing: true }; owner.wantYaw = .2; say(owner, '따뜻한 보리차 나왔어요.'); await sleep(1800); owner.pose = {};
}
async function researcherComes() {
  setStatus('연구원이 걸어와 탁자에 앉아요');
  researcher.active = true; researcher.seated = false; researcher.x = RESEARCHER_IN[0].x; researcher.y = RESEARCHER_IN[0].y;
  await walk(researcher, RESEARCHER_IN.slice(1));
  // A small hop onto the stool, facing the table.
  const a = { x: researcher.x, y: researcher.y }, t0 = performance.now();
  await new Promise(res => { const tick = now => { const t = Math.min(1, (now - t0) / 480), e = t * t * (3 - 2 * t); researcher.x = a.x + (SEAT_R.x - a.x) * e; researcher.y = a.y + (SEAT_R.y - a.y) * e; researcher.lift = Math.sin(Math.PI * t) * 26; if (t < 1) requestAnimationFrame(tick); else { researcher.lift = 0; res(); } }; requestAnimationFrame(tick); });
  // Seated three-quarters to us, so the face reads (facing the table would show only the back).
  researcher.seated = true; turnToward(researcher, 740, 720); say(researcher, '흠, 오늘 차 향이 좋네요.');
  await sleep(1400);
  // The owner brings a cup to the table.
  owner.pose = { holding: true }; await walk(owner, [{ x: 780, y: 560 }, SERVE]); turnToward(owner, SEAT_R.x, SEAT_R.y);
  owner.pose = { showing: true }; await sleep(500);
  // On the photo's own table: the cup's foot sits on the table-top point, drawn after the table layer.
  if (!served) served = propHolder(cup(), { x: 812, y: 548 }, PROP_UNIT, 630);
  served.set(812, 548, 0); served.shown = true;
  say(owner, '천천히 드세요.'); await sleep(900); owner.pose = {}; await walk(owner, [{ x: 780, y: 558 }, COUNTER]); owner.wantYaw = OWNER_WORK_YAW; owner.pose = { working: true };
}
async function rainComes() {
  setWeather('rain'); setStatus('비가 와요 — 찻집 주인은 바깥 쟁반을, 할머니는 자리를 처마 밑으로 옮겨요'); await sleep(900);
  const sheltered = grandmaShelters();
  owner.pose = {}; say(owner, '어머, 비 오네요!', 1800); await sleep(600);
  await walk(owner, OWNER_OUT); turnToward(owner, GARDEN.x, GARDEN.y); owner.pose = { holding: true }; await sleep(400);
  // The tray leaves the table and rides in the owner's hands.
  removeDrawable(tray.drawable); tray.tilt.remove(tray.content); owner.turn.add(tray.content); tray.content.position.set(0, owner.h * owner.carry.at, owner.h * owner.carry.out); tray.content.scale.setScalar(PROP_UNIT / owner.unit);
  await walk(owner, [...OWNER_OUT].reverse().slice(1).concat([COUNTER]));
  owner.wantYaw = Math.PI; await sleep(450);
  // Set down on the back counter (a surface in the photo, so no lift), drawn behind the owner.
  owner.turn.remove(tray.content); tray.tilt.add(tray.content); tray.content.position.set(0, 0, 0); tray.content.scale.setScalar(1);
  tray.drawable = addDrawable(tray.place, () => 482); tray.set(770, 479, 0);
  owner.pose = {}; owner.wantYaw = .3; say(owner, '비가 오니 쟁반은 안쪽에 둘게요.'); await sleep(1600); owner.pose = { working: true }; owner.wantYaw = OWNER_WORK_YAW;
  await sheltered;
}
// A small hop from where a character is to a spot, ending at a given lift (a seat) or on the floor.
function hop(c, to, liftEnd = 0, ms = 480) {
  const a = { x: c.x, y: c.y, lift: c.lift }, t0 = performance.now();
  return new Promise(res => { const tick = now => { const t = Math.min(1, (now - t0) / ms), e = t * t * (3 - 2 * t);
    c.x = a.x + (to.x - a.x) * e; c.y = a.y + (to.y - a.y) * e; c.lift = a.lift + (liftEnd - a.lift) * e + Math.sin(Math.PI * t) * 18;
    if (t < 1) requestAnimationFrame(tick); else { c.lift = liftEnd; res(); } }; requestAnimationFrame(tick); });
}
async function grandmaShelters() {
  grandma.pose = { talking: true }; say(grandma, '아이고, 비 오네. 저기 처마 밑으로 가야겠다.', 2400); await sleep(700);
  grandma.seated = false; grandma.pose = {}; await hop(grandma, { x: 625, y: 696 }, 0);
  await walk(grandma, GRANDMA_OUT);
  grandma.seatBase = RED_BENCH.base; await hop(grandma, RED_BENCH, RED_BENCH.lift); grandma.seated = true; turnToward(grandma, 560, 720);
}

async function run(fn) { if (busy) return; busy = true; document.body.dataset.busy = '1'; try { await fn(); } finally { busy = false; delete document.body.dataset.busy; setStatus(weather === 'rain' ? '비 오는 오후' : '맑은 낮'); } }
async function wholeDay() { await pourTea(); await sleep(600); await researcherComes(); await sleep(1200); await rainComes(); }
function resetAll() {
  if (busy) return; setWeather('day');
  owner.x = COUNTER.x; owner.y = COUNTER.y; owner.path = []; owner.pose = { working: true }; owner.wantYaw = owner.yaw = OWNER_WORK_YAW;
  researcher.active = false; researcher.seated = false; researcher.path = [];
  Object.assign(grandma, { x: BENCH.x, y: BENCH.y, lift: BENCH.lift, seatBase: BENCH.base, seated: true, path: [], pose: {}, yaw: .3, wantYaw: .3 });
  if (served) served.shown = false;
  if (!drawables.includes(tray.drawable)) { tray.drawable = addDrawable(tray.place, () => tray.y + 1); }
  tray.set(GARDEN.x, GARDEN.y, tray.top * tray.unit * depth(GARDEN.y) * Math.cos(ELEV));
  for (const c of [owner, researcher, shopOwner, grandma, mongle]) if (c) { c.bubble?.remove(); c.bubble = null; }
  setStatus('맑은 낮');
}
function setStatus(t) { $('state').textContent = t; }

// ── weather: the two photos cross-fade, the cut-out layers follow, rain streaks fall on top ──
let drops = [];
function setWeather(kind) {
  weather = kind; $('bg-rain').style.opacity = kind === 'rain' ? '1' : '0'; document.body.classList.toggle('rain', kind === 'rain'); setLight(kind);
  setTimeout(() => { for (const o of occluders) { o.mesh.material.map = o.tex[kind]; o.mesh.material.needsUpdate = true; } }, 450);
  drops = kind === 'rain' ? Array.from({ length: phone ? 110 : 190 }, () => ({ x: Math.random() * 1536, y: Math.random() * 1024, v: 900 + Math.random() * 500, l: 18 + Math.random() * 16 })) : [];
}
const rctx = rainCanvas.getContext('2d');
function drawRain(dt) {
  rctx.clearRect(0, 0, rainCanvas.width, rainCanvas.height); if (!drops.length) return;
  const s = rainCanvas.width / 1536; rctx.save(); rctx.scale(s, s); rctx.strokeStyle = 'rgba(235,242,250,.55)'; rctx.lineWidth = 1.4; rctx.beginPath();
  for (const d of drops) { if (!reduced) { d.y += d.v * dt; d.x += d.v * dt * .06; } if (d.y > 1024) { d.y = -20; d.x = Math.random() * 1536; } rctx.moveTo(d.x, d.y); rctx.lineTo(d.x + d.l * .06, d.y + d.l); }
  rctx.stroke(); rctx.restore();
}

// ── Mongle: tap to walk (as in the earlier prototypes) ──
const inPoly = (p, x, y) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const walkable = (x, y) => WALK.some(p => inPoly(p, x, y));
function nearestWalk(x, y) { if (walkable(x, y)) return { x, y }; let best = null, bd = Infinity; for (let yy = 600; yy < 830; yy += 6) for (let xx = 350; xx < 1350; xx += 6) if (walkable(xx, yy)) { const d = (xx - x) ** 2 + (yy - y) ** 2; if (d < bd) { bd = d; best = { x: xx, y: yy }; } } return best; }
function mongleRoute(to) {
  // Straight when the line stays on walkable ground, else through the courtyard's middle.
  const line = (a, b) => { for (let t = 0; t <= 1; t += .02) if (!walkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; return true; };
  const from = { x: mongle.x, y: mongle.y }; if (line(from, to)) return [to];
  for (const via of [{ x: 980, y: 668 }, { x: 1100, y: 690 }, { x: 760, y: 676 }, { x: 520, y: 676 }]) if (line(from, via) && line(via, to)) return [via, to];
  return [{ x: 980, y: 668 }, { x: 1100, y: 692 }, to];
}
const toWorld = e => { const r = world.getBoundingClientRect(), s = r.width / 1536; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; };
world.addEventListener('click', e => {
  const p = toWorld(e);
  for (const c of [owner, shopOwner, researcher, grandma]) {
    if (!c || !c.active) continue; const k = c.unit * depth(c.y), h = c.height(k), w = c.width * k * .6, bottom = c.y - c.lift;
    if (Math.abs(p.x - c.x) < w && p.y < bottom + 6 && p.y > bottom - h) { say(c, LINES[c.name][(LINES[c.name].i = ((LINES[c.name].i ?? -1) + 1) % LINES[c.name].length)]); return; }
  }
  const t = nearestWalk(p.x, p.y); if (!t) return;
  const ring = document.createElement('span'); ring.className = 'ring'; ring.style.left = p.x + 'px'; ring.style.top = p.y + 'px'; world.appendChild(ring); setTimeout(() => ring.remove(), 800);
  walk(mongle, mongleRoute(t));
});
const LINES = {
  owner: ['어서 와요, 몽글!', '오늘은 보리차가 잘 우러났어요.', '비 오는 날엔 안쪽 자리가 좋아요.'],
  shop: ['쟁반 받침이 또 헐거워졌네요.', '공방은 언제든 구경해도 돼요.'],
  researcher: ['연못 연잎이 하나 늘었어요.', '관찰판은 비 오면 안쪽에 둬야겠어요.'],
  grandma: ['밥은 먹었어?', '오늘은 바람이 순하네.', '조심히 가.'],
};

// ── fit and frame ──
let scale = 1;
function fit() {
  const r = wrap.getBoundingClientRect(), tall = r.width / Math.max(1, r.height) < 1.1;
  scale = tall ? Math.min(r.height * .96 / 1024, r.width * 2.4 / 1536) : Math.min(r.width / 1536, r.height / 1024);
  stage.style.width = 1536 * scale + 'px'; stage.style.height = 1024 * scale + 'px'; world.style.transform = `scale(${scale})`;
  wrap.style.placeItems = 1536 * scale > r.width ? 'center start' : 'center';
  const px = Math.min(2, devicePixelRatio || 1); renderer.setPixelRatio(1); renderer.setSize(Math.round(1536 * scale * px), Math.round(1024 * scale * px), false);
  rainCanvas.width = Math.round(1536 * scale * px); rainCanvas.height = Math.round(1024 * scale * px);
  if (wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = 720 * scale - wrap.clientWidth / 2;
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (owner) try {
    for (const c of [owner, shopOwner, researcher, grandma, mongle]) if (c) stepCharacter(c, dt, now);
    renderer.clear();
    const order = drawables.filter(d => !d.hidden()).sort((a, b) => a.base() - b.base());
    for (const d of drawables) d.root.visible = false;
    for (const d of order) { d.root.visible = true; renderer.clearDepth(); renderer.render(scene, camera); d.root.visible = false; }
  } catch (error) { if (!frame.failed) { frame.failed = true; console.error(error); } }
  drawRain(dt); requestAnimationFrame(frame);
}
Object.defineProperty(globalThis, '__residents', { value: { get owner() { return owner; }, get researcher() { return researcher; }, get gardenTable() { return gardenTable; }, get grandma() { return grandma; }, run: name => run({ pour: pourTea, come: researcherComes, rain: rainComes, day: wholeDay }[name]), reset: resetAll, info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }) } });

$('btn-day').addEventListener('click', () => run(wholeDay));
$('btn-pour').addEventListener('click', () => run(pourTea));
$('btn-come').addEventListener('click', () => run(researcherComes));
$('btn-rain').addEventListener('click', () => run(rainComes));
$('btn-reset').addEventListener('click', resetAll);
addEventListener('resize', fit); fit(); requestAnimationFrame(frame);
build().then(() => {
  owner.pose = { working: true }; setStatus('맑은 낮'); document.documentElement.dataset.residents = 'ready';
}).catch(err => { setStatus('3D 주민을 불러오지 못했어요'); $('hint').textContent = String(err?.message || err); document.documentElement.dataset.residents = 'failed'; });
