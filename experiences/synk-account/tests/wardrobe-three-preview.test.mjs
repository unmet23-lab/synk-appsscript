import test from 'node:test';
import assert from 'node:assert/strict';
import { createWardrobeThreePreview } from '../src/wardrobe-three-preview.mjs';

// Real adapter and character-ID contract, synthetic DOM/renderer only.
// No browser credentials, account writes, downloads or GPU benchmark.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.parentNode = null;
    this.attributes = new Map(); this.listeners = new Map(); this.dataset = {};
    this.textContent = ''; this.hidden = false; this.disabled = false; this.className = '';
    this.classList = { add: value => { this.className += ` ${value}`; } };
  }
  append(...children) {
    for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); }
  }
  replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...children); }
  remove() { if (this.parentNode) { const parent = this.parentNode; this.parentNode = null; parent.children = parent.children.filter(child => child !== this); } }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); if (!this.listeners.get(name)?.size) this.listeners.delete(name); }
  emit(name, event = {}) { for (const listener of [...(this.listeners.get(name) || [])]) listener(event); }
  click() { if (!this.disabled) this.onclick?.(); }
}
const descendants = root => [root, ...root.children.flatMap(descendants)];
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const outfit = (costumeId = 'kkamong-scarf', extra = {}) => ({ costumeId, backgroundId: 'paper', name: '합성 차림', owned: true, ...extra });

function fixture(t, { loader, initialMode, onPhoto } = {}) {
  const document = new Element('document'); document.hidden = false; document.createElement = tag => new Element(tag);
  const observers = [], engines = [], photos = [];
  let loads = 0, reducedMotion = false;
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; this.disconnected = 0; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected++; }
    intersect(value) { this.callback([{ target: this.target, isIntersecting: value }]); }
  }
  const globals = { document, window: { matchMedia: () => ({ matches: reducedMotion }) }, IntersectionObserver: Observer };
  const originals = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const module = { createThreeLab(host) {
    const canvas = new Element('canvas'); host.append(canvas);
    const engine = { canvas, host, state: {}, calls: [], disposed: 0, snapshots: 0, snapshotFailure: false,
      dispose() { this.disposed++; canvas.remove(); },
      snapshot() { this.snapshots++; if (this.snapshotFailure) throw new Error('synthetic lost context'); return 'data:image/png;base64,synthetic'; },
    };
    for (const name of ['setQuality', 'setView', 'setAngle', 'setMotion', 'setCostume', 'setBackground', 'setPaused']) engine[name] = value => {
      assert.equal(engine.disposed, 0, `Disposed renderer received ${name}.`);
      engine.state[name] = value; engine.calls.push([name, value]);
    };
    engines.push(engine); return engine;
  } };
  const view = createWardrobeThreePreview({ initialMode, load: () => { loads++; return loader ? loader({ module, engines, loads }) : module; }, onPhoto: photo => { photos.push(photo); return onPhoto?.(photo); } });
  const root = new Element('main'); root.append(view.element);
  const button = label => { const match = descendants(view.element).find(el => el.tagName === 'button' && el.textContent === label); assert.ok(match, `Missing button: ${label}`); return match; };
  const status = () => descendants(view.element).find(el => el.getAttribute('role') === 'status');
  const update = value => { const image = new Element('img'); view.update(value, image); return image; };
  t.after(() => { view.dispose(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { view, root, document, observers, engines, photos, module, button, status, update, get loads() { return loads; }, setReducedMotion: value => { reducedMotion = value; } };
}

test('opening the wardrobe does not load Three; unsupported costumes never become another character', async t => {
  const f = fixture(t); f.update(outfit()); await settle(); assert.equal(f.loads, 0);
  for (const costumeId of ['mongle-basic', 'marin-basic', 'kkamong-headphones', 'kkamong-deel-winter', 'unknown']) {
    f.update(outfit(costumeId)); f.button('3D 시험 보기').click(); await settle();
    assert.equal(f.loads, 0); assert.equal(f.view.element.dataset.renderMode, 'image');
    assert.match(f.status().textContent, /아직 3D 모델이 없어/);
  }
  f.update(outfit()); await settle(); assert.equal(f.loads, 1); assert.equal(f.engines[0].state.setCostume, 'scarf');
});

test('rerenders retain one canvas, fit changed outfit/background, and keep preview controls independent', async t => {
  const f = fixture(t); f.update(outfit()); f.button('3D 시험 보기').click(); await settle();
  const engine = f.engines[0], canvas = engine.canvas, parent = new Element('section');
  const initialFits = engine.calls.filter(([name]) => name === 'setCostume').length;
  for (let i = 0; i < 5; i++) { f.update(outfit()); parent.append(f.view.element); f.root.replaceChildren(parent); }
  assert.equal(f.engines.length, 1); assert.equal(engine.calls.filter(([name]) => name === 'setCostume').length, initialFits);
  assert.ok(descendants(f.view.element).includes(canvas));
  f.button('옆').click(); f.button('앞발 인사').click(); f.button('품질 · 균형').click();
  f.update(outfit('kkamong-apron', { backgroundId: 'night' }));
  assert.equal(f.engines.length, 1); assert.equal(engine.state.setCostume, 'apron'); assert.equal(engine.state.setBackground, 'night');
  assert.equal(engine.state.setAngle, 90); assert.equal(engine.state.setMotion, 'wave'); assert.equal(engine.state.setQuality, 'high');
  assert.equal(engine.host.dataset.costumeId, 'kkamong-apron'); assert.equal(engine.host.dataset.backgroundId, 'night');
  f.update(outfit('kkamong-basic', { backgroundId: 'lapis' })); assert.equal(engine.state.setCostume, 'none'); assert.equal(engine.state.setBackground, 'lapis');
});

test('unsupported and original-image transitions release the old canvas once', async t => {
  const f = fixture(t, { initialMode: 'three' }); f.update(outfit()); await settle();
  const first = f.engines[0]; const fallback = f.update(outfit('mongle-basic'));
  assert.equal(first.disposed, 1); assert.equal(first.canvas.parentNode, null);
  assert.equal(f.view.element.dataset.renderMode, 'image'); assert.ok(descendants(f.view.element).includes(fallback));
  f.update(outfit()); await settle(); const second = f.engines[1]; assert.ok(second);
  f.button('원본 그림').click(); f.button('원본 그림').click();
  assert.equal(first.disposed, 1); assert.equal(second.disposed, 1); assert.equal(second.canvas.parentNode, null);
  f.view.dispose(); assert.equal(second.disposed, 1);
});

test('a stopped preview ignores a renderer module that arrives later', async t => {
  const pending = deferred(), f = fixture(t, { loader: () => pending.promise, initialMode: 'three' });
  f.update(outfit()); await settle(); assert.equal(f.loads, 1);
  f.view.dispose(); pending.resolve(f.module); await settle();
  assert.equal(f.engines.length, 0); assert.equal(f.view.element.parentNode, null);
  assert.equal(f.observers[0].disconnected, 1); assert.equal(f.document.listeners.size, 0);
  f.update(outfit('kkamong-apron')); await settle(); assert.equal(f.loads, 1);
});

test('an obsolete loading attempt cannot overwrite a later 3D attempt or its outfit', async t => {
  const attempts = [deferred(), deferred()], f = fixture(t, { loader: ({ loads }) => attempts[loads - 1].promise, initialMode: 'three' });
  f.update(outfit()); await settle(); f.button('원본 그림').click();
  f.update(outfit('kkamong-apron', { backgroundId: 'lapis' })); f.button('3D 시험 보기').click(); await settle();
  attempts[1].resolve(f.module); await settle(); assert.equal(f.engines.length, 1);
  const current = f.engines[0]; assert.equal(current.state.setCostume, 'apron');
  attempts[0].resolve(f.module); await settle(); assert.equal(f.engines.length, 1); assert.equal(current.disposed, 0);
  assert.equal(current.state.setBackground, 'lapis'); assert.equal(f.view.element.dataset.renderMode, 'three');
});

test('switching to an unsupported item while loading ignores the successful old result', async t => {
  const pending = deferred(), f = fixture(t, { loader: () => pending.promise, initialMode: 'three' });
  f.update(outfit()); await settle(); f.update(outfit('kkamong-headphones'));
  pending.resolve(f.module); await settle(); assert.equal(f.engines.length, 0);
  assert.equal(f.view.element.dataset.renderMode, 'image'); assert.match(f.status().textContent, /아직 3D 모델이 없어/);
});

test('load failure preserves the original image and retry creates a fresh renderer', async t => {
  const f = fixture(t, { initialMode: 'three', loader: ({ module, loads }) => loads === 1 ? Promise.reject(new Error('synthetic import failure')) : module });
  const fallback = f.update(outfit()); await settle();
  assert.equal(f.view.element.dataset.renderMode, 'image'); assert.match(f.status().textContent, /불러오지 못해/);
  assert.ok(descendants(f.view.element).includes(fallback));
  f.update(outfit()); await settle(); assert.equal(f.loads, 1, 'rerender must not cause an endless retry loop');
  f.button('원본 그림').click(); f.button('3D 시험 보기').click(); await settle();
  assert.equal(f.loads, 2); assert.equal(f.engines.length, 1); assert.equal(f.view.element.dataset.renderMode, 'three');
});

test('failure during renderer setup disposes its partially configured instance', async t => {
  const f = fixture(t, { initialMode: 'three', loader: ({ module }) => ({ createThreeLab(host) {
    const engine = module.createThreeLab(host); engine.setQuality = () => { throw new Error('synthetic setup failure'); }; return engine;
  } }) });
  f.update(outfit()); await settle(); assert.equal(f.engines[0].disposed, 1);
  assert.equal(f.engines[0].canvas.parentNode, null); assert.equal(f.view.element.dataset.renderMode, 'image');
  assert.match(f.status().textContent, /불러오지 못해/); f.view.dispose(); assert.equal(f.engines[0].disposed, 1);
});

test('photo permission is checked at click time and renderer errors do not claim success', async t => {
  const f = fixture(t, { initialMode: 'three' }); f.update(outfit('kkamong-apron', { owned: false })); await settle();
  const engine = f.engines[0], photo = f.button('3D 사진 내려받기');
  assert.equal(photo.disabled, true); photo.onclick(); assert.equal(engine.snapshots, 0); assert.equal(f.photos.length, 0);
  f.update(outfit('kkamong-apron', { backgroundId: 'night' })); assert.equal(photo.disabled, false); photo.click();
  assert.equal(f.photos.length, 1); assert.equal(f.photos[0].costumeId, 'kkamong-apron'); assert.equal(f.photos[0].backgroundId, 'night');
  assert.equal(f.photos[0].image, 'data:image/png;base64,synthetic');
  f.update(outfit('kkamong-apron', { owned: false })); photo.onclick(); assert.equal(engine.snapshots, 1);
  f.update(outfit()); engine.snapshotFailure = true; photo.click(); assert.equal(f.photos.length, 1); assert.match(f.status().textContent, /사진을 만들지 못했어요/);
});

test('context loss shows the fallback, blocks photos, and restoration reuses the canvas', async t => {
  const f = fixture(t, { initialMode: 'three' }); f.update(outfit()); await settle(); const engine = f.engines[0];
  engine.canvas.emit('webglcontextlost'); assert.equal(f.view.element.dataset.renderMode, 'image');
  assert.match(f.status().textContent, /3D 화면이 멈춰/); f.button('3D 사진 내려받기').onclick(); assert.equal(engine.snapshots, 0);
  engine.canvas.emit('webglcontextrestored'); assert.equal(f.view.element.dataset.renderMode, 'three'); assert.equal(f.engines.length, 1);
  f.button('원본 그림').click(); engine.canvas.emit('webglcontextrestored'); engine.canvas.emit('webglcontextlost');
  assert.equal(f.view.element.dataset.renderMode, 'image'); assert.equal(f.status().textContent, ''); assert.equal(engine.disposed, 1);
});

test('visibility/intersection pause rendering and dispose removes global observers/listeners once', async t => {
  const f = fixture(t, { initialMode: 'three' }); f.update(outfit()); await settle(); const engine = f.engines[0];
  assert.equal(engine.state.setPaused, false);
  f.observers[0].intersect(false); assert.equal(engine.state.setPaused, true);
  f.document.hidden = true; f.document.emit('visibilitychange'); f.observers[0].intersect(true); assert.equal(engine.state.setPaused, true);
  f.document.hidden = false; f.document.emit('visibilitychange'); assert.equal(engine.state.setPaused, false);
  f.setReducedMotion(true); f.view.react(); assert.equal(engine.state.setMotion, 'still');
  f.setReducedMotion(false); f.view.react(); assert.equal(engine.state.setMotion, 'wave');
  const before = engine.calls.length; f.view.dispose(); f.view.dispose();
  assert.equal(engine.disposed, 1); assert.equal(f.observers[0].disconnected, 1); assert.equal(f.document.listeners.size, 0);
  f.document.emit('visibilitychange'); f.observers[0].intersect(false); engine.canvas.emit('webglcontextlost');
  assert.equal(engine.calls.length, before); assert.equal(f.view.element.parentNode, null);
});

test('captured PNG thumbnail/link survive rerenders, and recapture releases the previous URL once', async t => {
  const captures = [];
  const f = fixture(t, { initialMode: 'three', onPhoto: photo => {
    const result = { url: `blob:synthetic-${captures.length}`, filename: `${photo.costumeId}.png`, releases: 0, dispose() { this.releases++; } };
    captures.push(result); return result;
  } });
  f.update(outfit()); await settle(); f.button('3D 사진 내려받기').click();
  const box = descendants(f.view.element).find(el => el.className === 'wardrobe-three-capture');
  assert.equal(box.hidden, false); assert.equal(box.children.length, 2);
  assert.equal(box.children[0].tagName, 'img'); assert.equal(box.children[0].src, captures[0].url);
  assert.equal(box.children[1].tagName, 'a'); assert.equal(box.children[1].href, captures[0].url);
  assert.equal(box.children[1].download, 'kkamong-scarf.png'); assert.equal(box.children[1].textContent, 'PNG 파일 저장');
  f.update(outfit()); assert.equal(captures[0].releases, 0); assert.equal(box.hidden, false);
  f.button('옆').click(); assert.equal(captures[0].releases, 0, 'moving the live camera must not invalidate the already captured PNG');
  f.button('3D 사진 내려받기').click(); assert.equal(captures[0].releases, 1);
  assert.equal(box.children[0].src, captures[1].url); assert.equal(box.children[1].href, captures[1].url);
  f.engines[0].snapshotFailure = true; f.button('3D 사진 내려받기').click();
  assert.equal(captures[1].releases, 1); assert.equal(box.hidden, true); assert.equal(box.children.length, 0);
  assert.match(f.status().textContent, /사진을 만들지 못했어요/); assert.equal(captures.length, 2);
  f.view.dispose(); assert.deepEqual(captures.map(photo => photo.releases), [1, 1]);
});

test('changing costume/background or disposing the preview clears captured URLs and download links', async t => {
  const captures = [];
  const f = fixture(t, { initialMode: 'three', onPhoto: () => {
    const result = { url: `blob:synthetic-${captures.length}`, filename: 'synthetic.png', releases: 0, dispose() { this.releases++; } };
    captures.push(result); return result;
  } });
  f.update(outfit()); await settle();
  const box = descendants(f.view.element).find(el => el.className === 'wardrobe-three-capture');
  f.button('3D 사진 내려받기').click(); f.update(outfit('kkamong-apron'));
  assert.equal(captures[0].releases, 1); assert.equal(box.hidden, true); assert.equal(box.children.length, 0);
  f.button('3D 사진 내려받기').click(); f.update(outfit('kkamong-apron', { backgroundId: 'night' }));
  assert.equal(captures[1].releases, 1); assert.equal(box.hidden, true); assert.equal(box.children.length, 0);
  f.button('3D 사진 내려받기').click(); f.update(outfit('mongle-basic'));
  assert.equal(captures[2].releases, 1); assert.equal(box.children.length, 0);
  f.update(outfit()); await settle(); f.button('3D 사진 내려받기').click();
  f.view.dispose(); f.view.dispose();
  assert.deepEqual(captures.map(photo => photo.releases), [1, 1, 1, 1]);
  assert.equal(box.hidden, true); assert.equal(box.children.length, 0); assert.equal(f.view.element.parentNode, null);
});
