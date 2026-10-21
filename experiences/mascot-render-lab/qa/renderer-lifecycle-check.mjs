// Run: node experiences/mascot-render-lab/qa/renderer-lifecycle-check.mjs
// Uses the real Three geometry/materials and real renderer module. Only WebGL,
// DOM and scheduling are synthetic: this is not a GPU or phone benchmark.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as Three from '../../korean-racing/vendor/three.module.js';
import { createWardrobeMaterials } from '../three/materials.mjs';
import { clothShellGeometry, addSeamStitches, pocketGussetGeometry } from '../three/cloth-geometry.mjs';
import { KKAMONG_PROTOTYPE_V1 } from '../three/character-contract.mjs';

const path = new URL('../three/renderer.mjs', import.meta.url);
const original = fs.readFileSync(path, 'utf8');
assert.deepEqual(original.match(/^import .*;$/gm), [
  "import * as THREE from '../../korean-racing/vendor/three.module.js';",
  "import { createWardrobeMaterials } from './materials.mjs';",
  "import { clothShellGeometry, addSeamStitches, pocketGussetGeometry } from './cloth-geometry.mjs';",
  "import { KKAMONG_PROTOTYPE_V1 } from './character-contract.mjs';",
], 'Every renderer dependency must be supplied to the test with its real implementation.');
const source = original.replace(/^import .*;\r?\n/gm, '')
  .replace('export function createThreeLab', 'function createThreeLab')
  .replace('export default createThreeLab;', 'return createThreeLab;');

const resources = new Map();
const track = resource => {
  if (!resource || resources.has(resource)) return;
  resources.set(resource, 0);
  resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
};
const materials = new Set(), textures = new Set(), geometries = new Set(), instances = new Set();
function materialResources(material) {
  if (materials.has(material)) return;
  materials.add(material); track(material);
  for (const value of Object.values(material)) if (value?.isTexture) { textures.add(value); track(value); }
}
let scene, camera, kit, rendererDisposed = 0, observerDisconnected = 0, canvasRemoved = 0, now = 0;
const canvasEvents = new Map(), mediaEvents = new Map(), frames = new Map();
let frameId = 0, resize;
const canvas = {
  style: {}, width: 0, height: 0, setAttribute() {},
  addEventListener: (name, listener) => canvasEvents.set(name, listener),
  removeEventListener: (name, listener) => { if (canvasEvents.get(name) === listener) canvasEvents.delete(name); },
  remove: () => { canvasRemoved++; },
  toDataURL: () => 'data:image/png;base64,synthetic',
};
class FakeRenderer {
  constructor() {
    this.domElement = canvas; this.shadowMap = {};
    this.info = { render: { calls: 0, triangles: 0, lines: 0 }, memory: { geometries: 0, textures: 0 } };
  }
  setPixelRatio(value) { this.pixelRatio = value; }
  getPixelRatio() { return this.pixelRatio; }
  setSize(width, height) { canvas.width = Math.floor(width * this.pixelRatio); canvas.height = Math.floor(height * this.pixelRatio); }
  render(value, lens) {
    scene = value; camera = lens;
    scene.traverse(object => {
      if (object.geometry) { geometries.add(object.geometry); track(object.geometry); }
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materialResources(material);
      if (object.isInstancedMesh) { instances.add(object); track(object); }
    });
  }
  dispose() { rendererDisposed++; }
}
class FakeResizeObserver {
  constructor(callback) { resize = callback; }
  observe() {}
  disconnect() { observerDisconnected++; }
}
const window = {
  devicePixelRatio: 3,
  matchMedia: () => ({
    matches: false,
    addEventListener: (name, listener) => mediaEvents.set(name, listener),
    removeEventListener: (name, listener) => { if (mediaEvents.get(name) === listener) mediaEvents.delete(name); },
  }),
};
const document = { hidden: false };
const build = new Function('THREE', 'createWardrobeMaterials', 'clothShellGeometry', 'addSeamStitches', 'pocketGussetGeometry', 'KKAMONG_PROTOTYPE_V1', 'window', 'document', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', source);
const createLab = build(
  { ...Three, WebGLRenderer: FakeRenderer },
  three => {
    kit = createWardrobeMaterials(three);
    Object.values(kit).filter(value => value?.isMaterial).forEach(materialResources);
    return kit;
  },
  clothShellGeometry, addSeamStitches, pocketGussetGeometry, KKAMONG_PROTOTYPE_V1, window, document,
  { now: () => now },
  callback => { frames.set(++frameId, callback); return frameId; },
  id => frames.delete(id), FakeResizeObserver,
);
const container = { appendChild() {}, clientWidth: 390, clientHeight: 360 };
const engine = createLab(container);
function tick() {
  const entry = frames.entries().next().value;
  assert.ok(entry, 'A live renderer must have one scheduled frame.');
  frames.delete(entry[0]); now += 1000 / 60; entry[1](now);
}
tick();

// Check shared texture ownership/colour channels instead of depending on a
// particular material count or garment tessellation.
const kitMaterials = Object.values(kit).filter(value => value?.isMaterial);
const kitTextures = new Set();
for (const material of kitMaterials) {
  assert.equal(material.map.colorSpace, Three.SRGBColorSpace);
  for (const name of ['normalMap', 'roughnessMap']) assert.equal(material[name].colorSpace, Three.NoColorSpace);
  for (const name of ['map', 'normalMap', 'roughnessMap']) {
    const map = material[name]; kitTextures.add(map);
    assert.equal(map.generateMipmaps, true);
    assert.equal(map.minFilter, Three.LinearMipmapLinearFilter);
    assert.equal(map.magFilter, Three.LinearFilter);
    assert.equal(map.wrapS, Three.RepeatWrapping); assert.equal(map.wrapT, Three.RepeatWrapping);
  }
  const normal = material.normalMap.image.data, roughness = material.roughnessMap.image.data;
  for (let i = 0; i < normal.length; i += 4) assert.ok(normal[i + 2] >= 128, `${material.name}: normal must face outwards.`);
  for (let i = 0; i < roughness.length; i += 4) assert.equal(roughness[i + 1], roughness[i], `${material.name}: roughness must fill the green channel.`);
}
console.log('PASS: material map colour spaces, mipmaps, channels and shared ownership');

engine.setCostume('apron'); engine.setMotion('wave'); engine.setView('detail'); engine.setQuality('low');
tick();
assert.deepEqual(['costume', 'motion', 'view', 'quality'].map(key => engine.getStats()[key]), ['apron', 'wave', 'detail', 'low']);
assert.equal(camera.fov, 30);
engine.setQuality('high');
assert.deepEqual(['costume', 'motion', 'view', 'quality'].map(key => engine.getStats()[key]), ['apron', 'wave', 'detail', 'high']);
engine.setView('full');
assert.equal(engine.getStats().quality, 'high'); assert.equal(camera.fov, 34);
assert.equal(scene.getObjectByName('costume-apron').visible, true);
assert.equal(scene.getObjectByName('costume-scarf').visible, false);
console.log('PASS: quality/view/costume/motion controls preserve independent state');

container.clientWidth = 430; container.clientHeight = 300; resize();
assert.equal(camera.aspect, 430 / 300);
assert.equal(engine.getStats().pixelRatio, 1.75);
assert.deepEqual(engine.getStats().canvas, [Math.floor(430 * 1.75), 525]);
engine.setQuality('low'); assert.deepEqual(engine.getStats().canvas, [430, 300]);
console.log('PASS: container resize updates camera and mode-specific DPR cap');

engine.setPaused(true); assert.equal(engine.getStats().paused, true); tick();
engine.setPaused(false); assert.equal(engine.getStats().paused, false);
canvasEvents.get('webglcontextlost')({ preventDefault() {} });
assert.equal(engine.getStats().contextLost, true); assert.throws(() => engine.snapshot());
canvasEvents.get('webglcontextrestored')(); assert.equal(engine.getStats().contextLost, false);
assert.equal(engine.snapshot(), 'data:image/png;base64,synthetic');
console.log('PASS: pause/context loss state and snapshot recovery');

const usedKitMaterials = new Set();
scene.traverse(object => {
  for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
    if (kitMaterials.includes(material)) usedKitMaterials.add(material.name);
  }
});
assert.ok(instances.size > 0, 'This regression must exercise real InstancedMesh seam stitches.');
engine.dispose(); engine.dispose();
for (const [resource, calls] of resources) assert.equal(calls, 1, `${resource.type || 'Texture'} ${resource.name || resource.uuid}: must dispose exactly once.`);
assert.equal(rendererDisposed, 1); assert.equal(observerDisconnected, 1); assert.equal(canvasRemoved, 1);
assert.equal(frames.size, 0); assert.equal(canvasEvents.size, 0); assert.equal(mediaEvents.size, 0);
assert.throws(() => engine.snapshot());
console.log('PASS: all geometry, materials, textures and InstancedMesh buffers dispose once; listeners/frames stop');
console.log(JSON.stringify({
  evidence: 'synthetic lifecycle and API assertions; no WebGL/GPU/device performance claim',
  createdKitMaterials: kitMaterials.length, attachedKitMaterials: [...usedKitMaterials],
  kitTextures: kitTextures.size, trackedMaterials: materials.size,
  trackedTextures: textures.size, trackedGeometries: geometries.size, instancedMeshes: instances.size,
}, null, 2));
