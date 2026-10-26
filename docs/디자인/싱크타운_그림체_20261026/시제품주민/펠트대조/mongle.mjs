// 몽글 대조: 같은 사진 조각 위에 WORLD 몽글(기본)이나 펠트 판(?felt=diorama)을 세우고, 기본 길 지문도 낸다.
import * as THREE from '../../../../../experiences/synk-world-home/scene-assets/three.module.js';
import { createMongleAvatar } from 'mongle-avatar';

const q = new URLSearchParams(location.search), felt = q.get('felt') === 'diorama' ? 'diorama' : undefined;
const W = +q.get('w') || 900, H = +q.get('h') || 520, yaw = +(q.get('yaw') ?? .35), neck = q.get('neck') ?? 'mongle-scarf-first-steps', px = +q.get('px') || 150;
const ELEV = 22 * Math.PI / 180, canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .96;
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(0, W, 0, -H, -4000, 4000); camera.position.set(0, 0, 2000);
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#eef5fc'); g.addColorStop(.48, '#fbf5ec'); g.addColorStop(.55, '#d9ccb6'); g.addColorStop(1, '#b8a88f'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentIntensity = .45; t.dispose(); pmrem.dispose();
}
const hemi = new THREE.HemisphereLight('#e6f0fa', '#a08a6c', .72), key = new THREE.DirectionalLight('#fff1dc', 3.0), fill = new THREE.DirectionalLight('#d6e6f5', .38);
key.position.set(-.55, .78, .62); fill.position.set(.8, .3, .6); scene.add(hemi, key, fill);
const avatar = await createMongleAvatar({ anisotropy: 4, ...(felt ? { felt } : {}) }); avatar.setOutfit({ body: '', neck });
const place = new THREE.Group(), tilt = new THREE.Group(), turn = new THREE.Group(); tilt.rotation.x = ELEV; turn.rotation.y = yaw;
place.add(tilt); tilt.add(turn); turn.add(avatar.group); avatar.update(0, { reducedMotion: true });
place.scale.setScalar(px / 1.8); place.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(tilt, true);
place.position.set(W / 2, -(H - 30) - box.min.y, 0); scene.add(place);
function fingerprint() {
  const rows = [], n = v => Number.isFinite(v) ? Math.round(v * 1e5) / 1e5 : v;
  avatar.group.traverse(o => {
    const row = [o.type, o.name, o.visible, ...o.position.toArray().map(n), ...o.quaternion.toArray().map(n), ...o.scale.toArray().map(n)];
    if (o.geometry) for (const [k, a] of Object.entries(o.geometry.attributes)) { let s = 0; for (let j = 0; j < a.array.length; j++) s += a.array[j] * ((j % 7) + 1); row.push(k, a.count, n(s)); }
    if (o.isInstancedMesh) { let s = 0; for (const v of o.instanceMatrix.array) s += v; row.push('inst', o.count, n(s)); }
    for (const m of [o.material].flat().filter(Boolean)) {
      row.push(m.type, m.color?.getHexString(), n(m.roughness), n(m.sheen), m.sheenColor?.getHexString(), m.normalScale ? m.normalScale.toArray().map(n).join('/') : '', n(m.opacity));
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) if (m[k]) row.push(k, m[k].repeat.toArray().map(n).join('/'));
    }
    rows.push(row.join('|'));
  });
  return rows;
}
async function hash(text) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
for (let i = 0; i < 30; i++) { renderer.render(scene, camera); await new Promise(r => requestAnimationFrame(r)); }
const px8 = new Uint8Array(4 * W * H), gl = renderer.getContext(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px8);
let ps = 0; for (let i = 0; i < px8.length; i += 97) ps = (ps * 31 + px8[i]) >>> 0;
const rows = fingerprint();
globalThis.__mongle = { felt: felt || 'base', rows: rows.length, structure: await hash(rows.join('\n')), pixels: ps, bounds: avatar.metrics().bodyBounds };
document.documentElement.dataset.ready = '1';
