// 옷장 옷이 몸에 잘 맞는지: v3 몽글과 펠트 판 몽글에 옷을 하나씩 입혀, 옷 꼭짓점이 몸 겉 안으로 들어간 몫(뚫림)과
// 몸에서 뜬 거리를 재고, 앞 · 뒤 그림을 찍는다. 몸 겉은 축에서 바깥으로 쏜 빛살이 처음 닿는 거리로 잰다.
import * as THREE from '../../../../../experiences/synk-world-home/scene-assets/three.module.js';
import { createMongleAvatar } from '../../../../../experiences/synk-world-home/avatar-v3.mjs';
import { WARDROBE_ITEMS } from '../../../../../experiences/synk-world-home/wardrobe-catalog.mjs';

const W = 300, H = 340, TAU = Math.PI * 2;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .96;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9dfd0');
scene.add(new THREE.HemisphereLight('#e6f0fa', '#a08a6c', .8)); const key = new THREE.DirectionalLight('#fff1dc', 2.6); key.position.set(-.6, .8, .7); scene.add(key);
const fill = new THREE.DirectionalLight('#d6e6f5', .45); fill.position.set(.8, .3, -.6); scene.add(fill);
const camera = new THREE.PerspectiveCamera(30, W / H, .1, 50);
const ANGLES = 144, ROWS = 120;

function surfaceTable(body) {
  // Radius of the body surface for each angle and height, from a ray cast outward from the axis.
  body.updateWorldMatrix(true, false);
  const proxy = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); proxy.matrixWorld.copy(body.matrixWorld); proxy.matrixAutoUpdate = false;
  const box = new THREE.Box3().setFromObject(body), ray = new THREE.Raycaster(), table = new Float32Array(ANGLES * ROWS).fill(NaN);
  for (let j = 0; j < ROWS; j++) {
    const y = box.min.y + (box.max.y - box.min.y) * (j + .5) / ROWS;
    for (let i = 0; i < ANGLES; i++) {
      const a = i / ANGLES * TAU; ray.set(new THREE.Vector3(0, y, 0), new THREE.Vector3(Math.sin(a), 0, Math.cos(a))); ray.far = 3;
      const hits = ray.intersectObject(proxy, false); if (hits.length) table[j * ANGLES + i] = hits[hits.length - 1].distance;
    }
  }
  return { table, y0: box.min.y, y1: box.max.y };
}
function bodyRadius({ table, y0, y1 }, a, y) {
  const fj = (y - y0) / (y1 - y0) * ROWS - .5, fi = ((a / TAU) % 1 + 1) % 1 * ANGLES;
  const j = Math.floor(fj), i = Math.floor(fi); if (j < 0 || j >= ROWS - 1) return NaN;
  const tj = fj - j, ti = fi - i, at = (jj, ii) => table[jj * ANGLES + (ii % ANGLES)];
  const v = [at(j, i), at(j, i + 1), at(j + 1, i), at(j + 1, i + 1)]; if (v.some(Number.isNaN)) return NaN;
  return (v[0] * (1 - ti) + v[1] * ti) * (1 - tj) + (v[2] * (1 - ti) + v[3] * ti) * tj;
}
function measure(avatar, surface) {
  const root = avatar.group.getObjectByName('mongle-wardrobe-v8'), out = { vertices: 0, inside: 0, deep: 0, gapSum: 0, maxIn: 0 };
  if (!root) return out; root.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  root.traverse(o => {
    if (!o.visible || !(o.isMesh || o.isInstancedMesh) || !o.geometry?.attributes.position) return;
    let hidden = false; for (let p = o.parent; p; p = p.parent) if (!p.visible) hidden = true; if (hidden) return;
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 3000));
    const mats = o.isInstancedMesh ? Array.from({ length: Math.min(o.count, 400) }, (_, k) => { const m = new THREE.Matrix4(); o.getMatrixAt(Math.floor(k * o.count / Math.min(o.count, 400)), m); return m; }) : [null];
    for (const im of mats) for (let k = 0; k < pos.count; k += o.isInstancedMesh ? Math.max(1, Math.floor(pos.count / 6)) : step) {
      v.fromBufferAttribute(pos, k); if (im) v.applyMatrix4(im); v.applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x, v.z), a = Math.atan2(v.x, v.z), br = bodyRadius(surface, a, v.y); if (Number.isNaN(br)) continue;
      out.vertices++; const gap = r - br; out.gapSum += gap;
      if (gap < -.003) { out.inside++; out.maxIn = Math.max(out.maxIn, -gap); if (gap < -.012) out.deep++; }
    }
  });
  return out;
}
function shot(group, yaw) {
  const pivot = new THREE.Group(); pivot.add(group); pivot.rotation.y = yaw; scene.add(pivot);
  camera.position.set(0, 1.5, 6.2); camera.lookAt(0, .92, 0); renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/jpeg', .86); scene.remove(pivot); pivot.remove(group); return url;
}
const results = { items: [], shots: {} };
const outfits = [{ id: 'none', body: '', neck: '' }, ...WARDROBE_ITEMS.map(it => ({ id: it.id, body: it.slot === 'body' ? it.id : '', neck: it.slot === 'neck' ? it.id : '' })),
  { id: 'combo-knit-scarf', body: 'mongle-knit-butter', neck: 'mongle-scarf-first-steps' }, { id: 'combo-cape-muffler', body: 'mongle-rain-cape', neck: 'mongle-wool-muffler' },
  { id: 'combo-overall-bandana', body: 'mongle-corduroy-overall', neck: 'mongle-bandana-meadow' }, { id: 'combo-hanbok-silk', body: 'mongle-hanbok-vest', neck: 'mongle-silk-neckerchief' }];
for (const felt of [undefined, 'diorama']) {
  const avatar = await createMongleAvatar({ anisotropy: 4, wardrobeDetail: true, ...(felt ? { felt } : {}) });
  avatar.update(0, { reducedMotion: true });
  const surface = surfaceTable(avatar.group.getObjectByName('mongle-bell-scalloped-body'));
  for (const o of outfits) {
    avatar.setOutfit({ body: o.body, neck: o.neck }); avatar.update(0, { reducedMotion: true });
    await new Promise(r => setTimeout(r, 30));
    const m = measure(avatar, surface), tag = felt ? 'felt' : 'v3';
    results.items.push({ outfit: o.id, version: tag, vertices: m.vertices, insidePct: m.vertices ? +(100 * m.inside / m.vertices).toFixed(2) : 0, deepPct: m.vertices ? +(100 * m.deep / m.vertices).toFixed(2) : 0, maxInMm: +(m.maxIn * 1000).toFixed(1), meanGapMm: m.vertices ? +(1000 * m.gapSum / m.vertices).toFixed(1) : 0 });
    results.shots[`${o.id}|${tag}|front`] = shot(avatar.group, .4); results.shots[`${o.id}|${tag}|back`] = shot(avatar.group, Math.PI + .5);
  }
  avatar.dispose();
}
globalThis.__fit = results; document.documentElement.dataset.ready = '1';
