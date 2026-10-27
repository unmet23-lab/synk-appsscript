// 까몽 하나를 집 장면과 같은 빛으로 크게 찍는다: ?yaw=…&pose=floor-rest|canon&low=1&src=<모듈>
import * as THREE from '../../../../../experiences/synk-world-home/scene-assets/three.module.js';

const q = new URLSearchParams(location.search), W = 700, H = 700, yaw = +(q.get('yaw') ?? 0);
const { createKkamongHomeAvatar } = await import(q.get('src') || '/synk-world-home/home-kkamong-avatar.mjs');
const { createHomeMaterials } = await import('/synk-world-home/home-scene-materials.mjs');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(q.get('bg') || '#ffffff');
scene.add(new THREE.HemisphereLight('#fff7ee', '#c7b39a', 1.1));
const key = new THREE.DirectionalLight('#fff1dc', 2.4); key.position.set(-1.2, 2.2, 2.4); scene.add(key);
const rim = new THREE.DirectionalLight('#ffe2c4', 1.4); rim.position.set(1.6, 1.4, -2); scene.add(rim);
const fill = new THREE.DirectionalLight('#dfe8f5', .5); fill.position.set(1.4, .6, 1.6); scene.add(fill);
const avatar = createKkamongHomeAvatar({ kit: createHomeMaterials(), low: q.get('low') === '1', grounded: q.get('pose') !== 'canon', surface: 'fur' });
if (q.get('quality')) avatar.setQuality(q.get('quality'));
const model = avatar.group || avatar.model || avatar;
const pivot = new THREE.Group(); pivot.add(model); pivot.rotation.y = yaw; scene.add(pivot);
avatar.update?.(0, { reducedMotion: true });
pivot.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(model, true), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
const camera = new THREE.PerspectiveCamera(28, W / H, .05, 50), dist = Math.max(size.x, size.y) * 2.05;
camera.position.set(c.x, c.y + size.y * .05, c.z + dist); camera.lookAt(c.x, c.y, c.z);
for (let i = 0; i < 20; i++) { renderer.render(scene, camera); await new Promise(r => requestAnimationFrame(r)); }
globalThis.__shot = { size: size.toArray(), metrics: avatar.metrics?.() };
document.documentElement.dataset.ready = '1';
