// 주민 여섯 줄 세우기: 같은 사진 조각 위에 Town 옷감(기본) 또는 디오라마 펠트로 세우고, 기본 길 지문도 낸다.
import * as THREE from '../../../../../experiences/synk-world-home/scene-assets/three.module.js';
import { makeTownResident } from 'town-residents';

const q = new URLSearchParams(location.search), felt = q.get('felt') === 'diorama' ? 'diorama' : undefined;
const zoom = +q.get('zoom') || 1, W = +q.get('w') || 1380, H = +q.get('h') || 330, yaw = +(q.get('yaw') ?? .45);
const ids = (q.get('ids') || 'cafe-owner,workshop-owner,visitor-tea-reader,book-guest,companion,researcher').split(',');
const ELEV = 22 * Math.PI / 180, mobile = q.get('mobile') === '1';
const canvas = document.getElementById('gl');
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

const shared = {}, residents = [];
const UNIT = 88 * zoom; // px per body unit: the café owner then stands about 190 px, as in the prototype
ids.forEach((id, i) => {
  const place = new THREE.Group(), tilt = new THREE.Group(), turn = new THREE.Group(), content = new THREE.Group();
  tilt.rotation.x = ELEV; turn.rotation.y = yaw; place.add(tilt); tilt.add(turn); turn.add(content);
  const r = makeTownResident(content, shared, felt ? { id, felt, mobile } : mobile ? { id, mobile } : { id });
  r.update({ now: 0, motion: false });
  place.scale.setScalar(UNIT / .56); place.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(tilt, true);
  place.position.set(W * (i + .5) / ids.length, -(H - 26) - box.min.y, 0); scene.add(place); residents.push({ id, r, content });
});

// Fingerprint of everything the default path builds (geometry, transforms, materials); the halo is reported apart.
function fingerprint() {
  const rows = [];
  const n = v => Number.isFinite(v) ? Math.round(v * 1e5) / 1e5 : v;
  for (const { id, content } of residents) content.traverse(o => {
    if (o.name === 'resident-diorama-felt-halo') return;
    const row = [id, o.type, o.name, ...o.position.toArray().map(n), ...o.quaternion.toArray().map(n), ...o.scale.toArray().map(n)];
    if (o.geometry) for (const [k, a] of Object.entries(o.geometry.attributes)) { let s = 0; for (let j = 0; j < a.array.length; j++) s += a.array[j] * ((j % 7) + 1); row.push(k, a.count, n(s)); }
    if (o.isInstancedMesh) { let s = 0; for (const v of o.instanceMatrix.array) s += v; row.push('inst', o.count, n(s)); }
    for (const m of [o.material].flat().filter(Boolean)) {
      row.push(m.type, m.color?.getHexString(), n(m.roughness), n(m.metalness), n(m.sheen), n(m.sheenRoughness), m.sheenColor?.getHexString(), n(m.aoMapIntensity), m.normalScale ? m.normalScale.toArray().map(n).join('/') : '', n(m.clearcoat), n(m.opacity));
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) if (m[k]) row.push(k, m[k].repeat.toArray().map(n).join('/'));
    }
    rows.push(row.join('|'));
  });
  return rows;
}
async function hash(text) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }

THREE.DefaultLoadingManager.onLoad = () => {};
const wait = () => new Promise(res => { let n = 0; const tick = () => { renderer.render(scene, camera); if (++n > 40) res(); else requestAnimationFrame(tick); }; tick(); });
(async () => {
  await new Promise(r => setTimeout(r, 1200)); await wait();
  const rows = fingerprint();
  let halos = 0, fibres = 0, calls = 0; scene.traverse(o => { if (o.name === 'resident-diorama-felt-halo') { halos++; fibres += o.geometry.attributes.position.count / 4; } if (o.isMesh || o.isLine) calls++; });
  const px = new Uint8Array(4 * W * H); const gl = renderer.getContext(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let ps = 0; for (let i = 0; i < px.length; i += 97) ps = (ps * 31 + px[i]) >>> 0;
  globalThis.__lineup = { felt: felt || 'base', rows: rows.length, structure: await hash(rows.join('\n')), pixels: ps, halos, fibres, objects: calls, heights: residents.map(x => +x.r.height.toFixed(4)) };
  document.documentElement.dataset.ready = '1';
})();
