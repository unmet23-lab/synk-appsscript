import * as THREE from '/scene-assets/three.module.js';
import { createMongleAvatar, AVATAR_OUTFITS } from '/avatar-v3.mjs';
import {normalizeWardrobeDyes} from '/avatar-wardrobe.mjs';
import {slotsForOutfit} from '/wardrobe-catalog.mjs';
import { makeTownCharacter } from './day-character.mjs';
import { makeTownResident } from './day-residents.mjs';
import { buildTownEnvironment } from './day-environment.mjs';
import { applyTownMaterials, TOWN_BRAND } from './day-materials.mjs';
import { createTownRendering } from './day-rendering.mjs';
import { WALK_BOUNDS } from './walk.mjs';

// Local art/interaction study derived from synk-world-home/scene.mjs.
// The player retains the approved Mongle silhouette; residents have their own casts.
const TAU = Math.PI * 2;
const LOCATIONS = Object.freeze({ home: [-6, 0], cafe: [0, 0], workshop: [6, 0], greenhouse: [0, -6] });
const LABELS = { home: '우리 집', cafe: '찻집', workshop: '공방', greenhouse: '온실' };
const ROLE_LABELS = { player: '나', 'cafe-owner': '찻집 주인', 'workshop-owner': '공방 주인', researcher: '연구원', 'visitor-tea-reader': '손님', 'book-guest': '책 읽는 손님', companion: '동행 손님' };
const VISITORS = new Set(['visitor-tea-reader', 'book-guest', 'companion']);
const clamp = THREE.MathUtils.clamp;
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
function random(seed) { let n = seed; return () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296); }
function texture(size, draw, repeat = [1, 1], color = false) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  if (color) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function knitTexture() {
  const rng = random(42);
  return texture(256, (ctx, s) => {
    ctx.fillStyle = '#d6c4a6'; ctx.fillRect(0, 0, s, s);
    for (let j = -1; j < 17; j++) for (let i = -1; i < 13; i++) {
      const x = i * 22, y = j * 17;
      ctx.strokeStyle = '#a99474'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 2, y + 1); ctx.quadraticCurveTo(x + 3, y + 10, x + 11, y + 15); ctx.quadraticCurveTo(x + 19, y + 10, x + 20, y + 1); ctx.stroke();
      ctx.strokeStyle = '#f0e2c9'; ctx.lineWidth = 3.0;
      ctx.beginPath(); ctx.moveTo(x + 3, y + 1); ctx.quadraticCurveTo(x + 5, y + 9, x + 11, y + 14); ctx.moveTo(x + 19, y + 1); ctx.quadraticCurveTo(x + 17, y + 9, x + 12, y + 14); ctx.stroke();
    }
    for (let i = 0; i < 3700; i++) { const v = Math.round(110 + rng() * 130); ctx.strokeStyle = `rgba(${v},${v},${v},.13)`; ctx.lineWidth = .4; const x = rng() * s, y = rng() * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y + 4); ctx.stroke(); }
  }, [6, 1], true);
}

function surfaces() {
  const felt = texture(256, (c, s) => {
    const r = random(182); c.fillStyle = '#898989'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 11000; i++) { const x = r() * s, y = r() * s, n = Math.round(65 + r() * 135); c.strokeStyle = `rgba(${n},${n},${n},.5)`; c.lineWidth = .4 + r() * .6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + r() * 5 - 2.5, y + 2, x + r() * 5 - 2.5, y + 2 + r() * 3); c.stroke(); }
  }, [4, 3]);
  const wood = texture(256, (c, s) => {
    const r = random(188); c.fillStyle = '#c7ac86'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 340; i++) { const y = r() * s; c.strokeStyle = r() > .4 ? `rgba(83,51,30,${.02 + r() * .14})` : `rgba(255,245,218,${.1 + r() * .16})`; c.lineWidth = .4 + r(); c.beginPath(); for (let x = 0; x <= s; x += 8) { const yy = y + Math.sin(x / 35 + y * .07) * (1 + r()); if (!x) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke(); }
  }, [1, 1], true);
  const noise = texture(128, (c, s) => { const r = random(233), image = c.createImageData(s, s); for (let i = 0; i < image.data.length; i += 4) { const n = 80 + r() * 95; image.data[i] = image.data[i + 1] = image.data[i + 2] = n; image.data[i + 3] = 255; } c.putImageData(image, 0, 0); }, [3, 3]);
  return { felt, wood, noise, knit: knitTexture() };
}
function roundedBox(w, h, d, radius = .07) {
  const x = -w / 2, y = -h / 2, r = Math.min(radius, w / 2, h / 2), shape = new THREE.Shape();
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r); shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h); shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r); shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.01, d - radius), bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: radius / 2, bevelThickness: radius / 2, curveSegments: 3 }); g.translate(0, 0, -(d - radius) / 2); return g;
}
function mesh(parent, geometry, material, position = [0, 0, 0], scale) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...position); if (scale) m.scale.set(...scale); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function box(parent, material, size, position, radius = .06) { return mesh(parent, roundedBox(...size, radius), material, position); }
function textLabel(parent, text, position, width = 1.7, color = '#ffffff') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 112;
  const c = canvas.getContext('2d');
  c.shadowColor = 'rgba(17,35,30,.48)'; c.shadowBlur = 5; c.shadowOffsetY = 2;
  c.fillStyle = color; c.font = '700 54px "SUIT", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.strokeStyle = 'rgba(24,43,38,.46)'; c.lineWidth = 3; c.lineJoin = 'round'; c.strokeText(text, 256, 58); c.fillText(text, 256, 58);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false, toneMapped: false }));
  sprite.position.set(...position); sprite.scale.set(width, width * 112 / 512, 1);
  sprite.userData.labelWidth = width; sprite.userData.labelAspect = 112 / 512; sprite.userData.minPixelWidth = text === '나' ? 48 : 128; sprite.userData.maxPixelWidth = text === '나' ? 96 : 170;
  sprite.renderOrder = 10; parent.add(sprite); return sprite;
}
function tube(parent, points, radius, material, closed = false, segments = 24) { return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal'), segments, radius, 5, closed), material); }
function actor(parent, id, m, shared) {
  const group = new THREE.Group(); parent.add(group);
  const resident = id === 'player' ? null : makeTownResident(group, m, { id, mobile: innerWidth < 600 });
  const body = resident?.body || makeTownCharacter(group, { ...m, coral: m.felt }, { mobile: innerWidth < 600 }).mascot;
  const height = resident?.height || 1.10, headHeight = resident?.headHeight || .83;
  body.scale.setScalar(.56);
  const label = textLabel(group, ROLE_LABELS[id], [0, height + .26, 0], id === 'player' ? .85 : 1.42);
  // Front-row guests' overhead labels would cover the actual cups behind them.
  if (id === 'book-guest' || id === 'companion') { label.position.set(0, .10, .67); label.userData.labelWidth = 1.20; }
  const shadow = mesh(group, shared.shadow, m.shadow, [0, .012, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = shadow.receiveShadow = false;
  return { group, body, resident, height, headHeight, label, shadow, floorY: .12, surfaceOffset: 0, gaitBob: 0, groundX: NaN, groundZ: NaN, target: new THREE.Vector3(), from: new THREE.Vector3(), changedAt: 0, pose: 'resting', facing: 0,
    visualFacing: null, stepPosition: new THREE.Vector3(), stepPlaced: false, walkPhase: 0, gaitBlend: 0 };
}
function mug(parent, m, p, scale = 1) {
  const g = new THREE.Group(); g.position.set(...p); g.scale.setScalar(scale); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(.14, .12, .21, 20, 1, true), m.ceramic, [0, .11, 0]); mesh(g, new THREE.TorusGeometry(.135, .016, 6, 24), m.ceramic, [0, .213, 0]).rotation.x = Math.PI / 2;
  mesh(g, new THREE.CylinderGeometry(.117, .117, .008, 18), m.tea, [0, .19, 0]); mesh(g, new THREE.TorusGeometry(.08, .023, 6, 18), m.ceramic, [.14, .12, 0]); return g;
}
function waterGlass(parent, m, p, scale = 1) {
  const g = new THREE.Group(); g.position.set(...p); g.scale.setScalar(scale); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(.13, .105, .29, 18, 1, true), m.glass, [0, .15, 0]);
  mesh(g, new THREE.CylinderGeometry(.10, .10, .025, 18), m.glass, [0, .02, 0]);
  mesh(g, new THREE.TorusGeometry(.128, .012, 5, 20), m.glass, [0, .295, 0]).rotation.x = Math.PI / 2;
  mesh(g, new THREE.CylinderGeometry(.112, .098, .21, 18), m.water, [0, .125, 0]); return g;
}
function drinkIcon(parent, m, drink, position, scale = 1) {
  const g = drink === 'water' ? waterGlass(parent, m, position, scale) : mug(parent, m, position, scale);
  // The same cup silhouette is used on the menu and on the delivered tray.
  g.rotation.x = -.12; return g;
}
function wordPanel(parent, text, position, width = .36) {
  const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 80;
  const c = canvas.getContext('2d'); c.fillStyle = '#365247'; c.font = '600 58px "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 96, 42);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }); material.userData.ownsMap = true;
  const label = mesh(parent, new THREE.PlaneGeometry(width, width * 80 / 192), material, position); label.castShadow = false; return label;
}
function requestCard(parent, m, p) {
  const g = new THREE.Group(); parent.add(g);
  const y = p.onTable ? 1.0 : .86;
  box(g, m.wood, [.48, .38, .045], [0, y, 0], .028); box(g, m.paper, [.41, .31, .018], [0, y, .034], .018);
  box(g, m.lapis, [.36, .035, .012], [0, y + .117, .049], .008);
  if (p.onTable) { box(g, m.darkWood, [.04, .21, .06], [0, .755, -.03], .012); box(g, m.wood, [.31, .035, .17], [0, .655, 0], .02); }
  else { box(g, m.darkWood, [.055, .69, .07], [0, .35, -.03], .015); box(g, m.wood, [.38, .06, .26], [0, .035, 0], .02); }
  const drink = p.drink || p.choice || p.icon;
  if (['tea', 'water'].includes(drink)) drinkIcon(g, m, drink, [0, y - .11, .055], .74);
  else for (let i = 0; i < 3; i++) box(g, m.lapis, [.25 - i * .04, .025, .018], [0, y + .06 - i * .07, .052], .008);
  return g;
}
function pictureMenu(parent, m, p) {
  const g = new THREE.Group(); parent.add(g);
  box(g, m.wood, [1.16, .72, .08], [0, 1.12, 0], .045); box(g, m.paper, [1.03, .59, .018], [0, 1.12, .055], .02);
  box(g, m.lapis, [.93, .045, .014], [0, 1.365, .073], .012);
  for (const sign of [-1, 1]) { const leg = box(g, m.darkWood, [.065, .93, .08], [sign * .34, .45, -.05], .018); leg.rotation.z = sign * -.08; }
  const selected = p.drink || p.choice || p.icon;
  const wordsFirst = p.order === 'wordsFirst';
  for (const [drink, x] of [['tea', -.27], ['water', .27]]) {
    box(g, selected === drink ? m.sage : m.linen, [.40, .44, .025], [x, 1.13, .08], .028);
    drinkIcon(g, m, drink, [x, wordsFirst ? .92 : 1.07, .13], .80);
    wordPanel(g, drink === 'tea' ? '차' : '물', [x, wordsFirst ? 1.30 : 1.0, .115], .31);
  }
  return g;
}
function bench(parent, m, p, width = 1.6) {
  const g = new THREE.Group(); parent.add(g); g.position.set(...p);
  for (let i = 0; i < 3; i++) { const seat = box(g, m.wood, [width, .08, .19], [0, .46, -.18 + i * .20], .025); seat.userData.townSupportSurface = true; }
  for (let i = 0; i < 2; i++) box(g, m.wood, [width, .16, .075], [0, .71 + i * .20, -.32], .025);
  for (const x of [-width * .38, width * .38]) { box(g, m.darkWood, [.09, .43, .09], [x, .22, .17], .018); box(g, m.darkWood, [.09, .9, .09], [x, .46, -.32], .018); } return g;
}
function plant(parent, m, p, scale = 1) {
  const g = new THREE.Group(); parent.add(g); g.position.set(...p); g.scale.setScalar(scale);
  mesh(g, new THREE.CylinderGeometry(.25, .19, .35, 16), m.terra, [0, .18, 0]); mesh(g, new THREE.CylinderGeometry(.23, .23, .012, 16), m.soil, [0, .36, 0]);
  const leafGeo = new THREE.SphereGeometry(1, 10, 6);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, height = .62 + (i % 3) * .13; const leaf = mesh(g, leafGeo, i % 2 ? m.leaf : m.leafLight, [Math.sin(a) * .14, height, Math.cos(a) * .14], [.12, .29, .046]); leaf.rotation.set(Math.cos(a) * .7, a, Math.sin(a) * .7); } return g;
}
function townOcclusionVolume(root, structure) {
  const bounds = new THREE.Box3().setFromObject(root).expandByScalar(.025), entries = [];
  if (structure) root.traverse(object => {
    if (!object.isMesh || !object.visible) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every(material => material.transparent && material.opacity < .99)) return;
    const bounds = new THREE.Box3().setFromObject(object);
    // Walking floors have their own low batches. Glazing and open gaps do not
    // hide an entire room, garden, or the floor under the player's feet.
    if (bounds.max.y > .25) entries.push({ mesh: object, bounds });
  });
  return { root, bounds, structure, entries };
}
function townFadeMesh(object, faded, mode, fadedMaterials) {
  let entry = fadedMaterials.get(object);
  if (!entry && !faded) return;
  if (!entry) {
    const original = object.material, list = Array.isArray(original) ? original : [original];
    const roof = list.some(material => material.userData.townSurface === 'roof');
    // Material.clone() drops shader hooks; the baked district's sun-share hook
    // (day-district.mjs bakedMaterial) has to stay on the faded copy too.
    const variants = roof ? [] : list.map(material => { const copy = material.clone(); copy.onBeforeCompile = material.onBeforeCompile; copy.customProgramCacheKey = material.customProgramCacheKey; copy.transparent = true; copy.opacity = material.opacity * .14; copy.depthWrite = false; return copy; });
    entry = { original, roof, variants, fadedMaterial: Array.isArray(original) ? variants : variants[0], castShadow: object.castShadow, receiveShadow: object.receiveShadow, visible: object.visible };
    fadedMaterials.set(object, entry);
  }
  if (entry.active === faded && entry.mode === mode) return;
  const hidden = faded && (mode === 'close' || entry.roof);
  object.material = faded && !hidden ? entry.fadedMaterial : entry.original;
  object.castShadow = faded ? false : entry.castShadow; object.receiveShadow = faded ? false : entry.receiveShadow;
  object.visible = hidden ? false : entry.visible; entry.active = faded; entry.mode = mode;
}
function shadowFocus(x, z, extent, mapSize) {
  const length = Math.sqrt(251), horizontal = Math.sqrt(130), rx = 7 / horizontal, rz = 9 / horizontal,
    ux = 99 / (horizontal * length), uz = -77 / (horizontal * length), step = 2 * extent / mapSize;
  const r = Math.round((x * rx + z * rz) / step) * step, u = Math.round((x * ux + z * uz) / step) * step, determinant = rx * uz - rz * ux;
  return { x: (r * uz - rz * u) / determinant, z: (rx * u - r * ux) / determinant, step };
}
function quantile(list, fraction) { if (!list.length) return null; const sorted = [...list].sort((a, b) => a - b); return +sorted[Math.floor((sorted.length - 1) * fraction)].toFixed(2); }

/** Scene state is presentation input only. No reward, clock, or fact is committed here. */
export function createDayScene(canvas, { onDestination = () => {}, onError = () => {}, getInterfaceBounds = () => null, deferInitialRender = false } = {}) {
  if (!canvas || canvas.tagName !== 'CANVAS') throw new TypeError('A canvas is required.');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#bcddec'); scene.fog = new THREE.Fog('#c6dadd', 30, 100);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100), world = new THREE.Group(); scene.add(world);
  // These two containers never move. Keep descendant world updates enabled:
  // actors, lights and sprites still update their own changing transforms.
  scene.updateMatrix(); scene.matrixAutoUpdate = false;
  world.updateMatrix(); world.matrixAutoUpdate = false;
  const maps = surfaces(), felt = color => new THREE.MeshPhysicalMaterial({ color, roughness: .96, sheen: .78, sheenRoughness: 1, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff1dc'), .35), bumpMap: maps.felt, bumpScale: .019 });
  const m = {
    felt: felt('#de7564'), sage: felt('#718567'), linen: felt('#e3d8be'), denim: felt('#647e90'), thread: felt('#c6927d'), scarf: new THREE.MeshPhysicalMaterial({color:'#fff8e6',map:maps.knit,bumpMap:maps.knit,bumpScale:.009,roughness:.98,sheen:.6,side:THREE.DoubleSide}),
    eye: new THREE.MeshPhysicalMaterial({ color: '#17130f', roughness: .12, clearcoat: 1 }), glint: new THREE.MeshBasicMaterial({ color: '#fff9e9' }),
    wood: new THREE.MeshStandardMaterial({ color: '#c6a57c', map: maps.wood, bumpMap: maps.wood, bumpScale: .018, roughness: .76 }), darkWood: new THREE.MeshStandardMaterial({ color: '#685843', map: maps.wood, roughness: .86 }),
    stone: new THREE.MeshStandardMaterial({ color: '#d1d4c7', roughness: .94, bumpMap: maps.noise, bumpScale: .024 }), plaster: new THREE.MeshStandardMaterial({ color: '#e5d7bc', roughness: .92, bumpMap: maps.noise, bumpScale: .012 }), plasterWarm: new THREE.MeshStandardMaterial({ color: '#eddac8', roughness: .92, bumpMap: maps.noise, bumpScale: .012 }),
    roofTerra: new THREE.MeshStandardMaterial({ color: '#b68268', roughness: .8, bumpMap: maps.noise, bumpScale: .025 }), roofSlate: new THREE.MeshStandardMaterial({ color: '#506864', roughness: .84, bumpMap: maps.noise, bumpScale: .022 }), roofSage: new THREE.MeshStandardMaterial({ color: '#8c9d84', roughness: .86, bumpMap: maps.noise, bumpScale: .024 }),
    terra: new THREE.MeshStandardMaterial({ color: '#c38c6f', roughness: .91, bumpMap: maps.noise, bumpScale: .016 }), ceramic: new THREE.MeshPhysicalMaterial({ color: '#f3e8ce', roughness: .22, clearcoat: .65 }), glass: new THREE.MeshPhysicalMaterial({ color: '#bedbd5', metalness: .04, roughness: .1, transparent: true, opacity: .29, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: '#bc9b5d', metalness: .68, roughness: .31 }), frame: new THREE.MeshStandardMaterial({ color: '#829283', metalness: .28, roughness: .48 }),
    soil: new THREE.MeshStandardMaterial({ color: '#66553e', roughness: 1, bumpMap: maps.noise, bumpScale: .02 }), leaf: new THREE.MeshStandardMaterial({ color: '#587653', roughness: .73 }), leafLight: new THREE.MeshStandardMaterial({ color: '#97a870', roughness: .75 }), tea: new THREE.MeshStandardMaterial({ color: '#875e35', roughness: .22 }), awning: felt('#eadac0'), paper: new THREE.MeshStandardMaterial({ color: '#fff9df', roughness: .94 }),
    water: new THREE.MeshPhysicalMaterial({ color: '#a4c9be', roughness: .21, metalness: .08, clearcoat: .8 }),
    shadow: new THREE.MeshBasicMaterial({ map: texture(64, (c, s) => { const grad = c.createRadialGradient(s / 2, s / 2, 3, s / 2, s / 2, s / 2); grad.addColorStop(0, 'rgba(36,35,28,.36)'); grad.addColorStop(1, 'rgba(36,35,28,0)'); c.fillStyle = grad; c.fillRect(0, 0, s, s); }), transparent: true, depthWrite: false }),
  };
  const environment = texture(128, (c, s) => { const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#e7f1ff'); g.addColorStop(.5, '#f6f8fa'); g.addColorStop(.6, '#a4b39f'); g.addColorStop(1, '#aab6ad'); c.fillStyle = g; c.fillRect(0, 0, s, s); c.fillStyle = '#ffffff'; c.fillRect(25, 10, 18, 50); }, [1, 1], true);
  environment.mapping = THREE.EquirectangularReflectionMapping; const pmrem = new THREE.PMREMGenerator(renderer), envTarget = pmrem.fromEquirectangular(environment); scene.environment = envTarget.texture; scene.environmentIntensity = .45;
  // One broad sun and restrained sky fill let curved eaves, woven cloth and
  // timber edges carry volume. Extra ambient light previously flattened them.
  const light = new THREE.DirectionalLight('#fff3de', 3.15); light.position.set(-9, 11, 7); light.castShadow = true; light.shadow.mapSize.set(2048, 2048); Object.assign(light.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: .5, far: 45 }); light.shadow.normalBias = .018; light.shadow.bias = -.0002; light.shadow.radius = 4.5; light.shadow.blurSamples = 8; scene.add(light); scene.add(light.target);
  scene.add(new THREE.HemisphereLight('#d8eaff', '#71815e', .58)); const fill = new THREE.DirectionalLight('#cddfff', .18); fill.position.set(8, 4, -10); scene.add(fill);
  const surfaceArt = applyTownMaterials(m, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const rendering = createTownRendering(renderer, scene, camera);
  const environmentArt = buildTownEnvironment(THREE, world, m, { mesh, box, tube, textLabel });
  const { buildings, hitTargets } = environmentArt;
  world.updateMatrixWorld(true);
  const fixedSupports = []; for (const building of buildings) building.traverse(object => { if (object.isMesh && object.userData.townSupportSurface) fixedSupports.push(object); });
  const occlusionVolumes = (environmentArt.occlusionRoots || buildings).map(root => townOcclusionVolume(root, buildings.includes(root) || root.userData.neighbourhoodHouse === true));
  // Comparison only (?district=<name>): one district is drawn from a baked GLB.
  // The module is fetched only then; the approved v20 path loads nothing extra.
  let bakedDistrict = null;
  const bakedDistrictReady = /[?&]district=/.test(location.search) ? import('./day-district.mjs').then(({ swapDistrict }) => {
    bakedDistrict = swapDistrict({ THREE, world, buildings, liveGlass: m.glass, renderer, phone: canvas.clientWidth < 600, replaceVolume: root => {
      const index = occlusionVolumes.findIndex(volume => volume.root === root); if (index >= 0) occlusionVolumes[index] = townOcclusionVolume(root, true);
    } });
    return bakedDistrict?.ready;
  }).catch(() => null) : null;
  for (const building of buildings) {
    const id = building.userData.placeId;
    const label = textLabel(building, LABELS[id], [0, 3.35, -1.05], 1.65); label.userData.placeId = id;
  }
  const floors = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const shared = { shadow: new THREE.PlaneGeometry(1.45, 1.15) };
  const actors = new Map(Object.keys(ROLE_LABELS).map(id => [id, actor(world, id, m, shared)])); for (const id of VISITORS) actors.get(id).group.visible = false;
  const labelSprites = [...actors.values()].map(a => a.label);
  for (const building of buildings) for (const child of building.children) if (child.isSprite && child.userData.labelWidth) labelSprites.push(child);
  const labelPosition = new THREE.Vector3();
  const propRoot = new THREE.Group(); world.add(propRoot); let propSignature = '', propCount = 0;
  let propSupports = [], propContacts = [], lifeContact = null, legacyContact = null;
  const supportRay = new THREE.Raycaster(), supportOrigin = new THREE.Vector3(), supportDown = new THREE.Vector3(0, -1, 0), supportHits = [];
  const memoryRoot = new THREE.Group(); memoryRoot.name = 'town-lived-memories'; world.add(memoryRoot);
  let memorySignature = '', memoryMarkers = [];
  const legacy = new THREE.Group(); world.add(legacy); legacy.visible = false;
  const legacyChair = bench(legacy, m, [0, 0, 0], .9), legacyCup = mug(legacy, m, [0, .7, 0]);
  const lifeCup = mug(world, m, [0, .7, 0]); lifeCup.visible = false;
  const legacyCanopy = new THREE.Group(), canopyMaterial = m.sage.clone(); legacy.add(legacyCanopy); box(legacyCanopy, canopyMaterial, [1.8, .08, 1.7], [0, 1.73, -.1]); for (const xx of [-.79, .79]) box(legacyCanopy, m.darkWood, [.055, 1.75, .055], [xx, .85, -.76], .015);
  const legacySign = new THREE.Group(); legacy.add(legacySign); box(legacySign, m.wood, [.73, .46, .06], [0, .69, 0]); box(legacySign, m.darkWood, [.065, .63, .065], [0, .3, 0]);
  const signChairIcon = bench(legacySign, m, [0, .52, .09], .7); signChairIcon.scale.setScalar(.31);
  const signTeaIcon = mug(legacySign, m, [0, .60, .065], .95);
  let disposed = false, ready = false, contextLost = false, visible = true, raf = 0, dirty = true, previousFrame = 0, frameCount = 0, requestedSerial = 0, renderedSerial = 0, currentLocation = 'home', quality = 'balanced', cameraMode = 'wide', reducedMotion = false, bazaarActive = false;
  let freeWalk = false, playerControlled = false, playerMoving = false, framingActorIds = [];
  let skyTexture = null, skyTarget = null, assetsReady = false, playerOutfit = 'scarf', playerDyes = {}, appearanceVerified = false;
  const assetFailures = [], assetTextures = new Set();
  let pointerStart = null, lastQuality = '', cpuTimes = [], intervals = [], lastMetricsAt = 0;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), target = new THREE.Vector3(), cameraTarget = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
  const walkingCameraOffset = new THREE.Vector3(0, 10.8, 15);
  const walkingCameraNormal = walkingCameraOffset.clone().normalize();
  const walkingCameraUp = new THREE.Vector3(0, walkingCameraNormal.z, -walkingCameraNormal.y);
  const occlusionRay = new THREE.Raycaster(), sight = new THREE.Vector3(), occlusionHitPoint = new THREE.Vector3(), occlusionHits = [], obscuredBuildings = new Set(), fadedMaterials = new Map(), fadedMeshes = new Set();
  let occlusionQueries = 0, occlusionReused = 0, previousOcclusion = null, shadowDiagnostics = null;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  function updateOcclusion() {
    const player = actors.get('player'), p = player.group.position, floorY = p.y + player.surfaceOffset;
    const old = previousOcclusion;
    if (old && old.walk === freeWalk && old.mode === cameraMode && old.x === p.x && old.y === floorY && old.z === p.z
      && old.cx === camera.position.x && old.cy === camera.position.y && old.cz === camera.position.z) { occlusionReused++; return; }
    previousOcclusion = { walk: freeWalk, mode: cameraMode, x: p.x, y: floorY, z: p.z, cx: camera.position.x, cy: camera.position.y, cz: camera.position.z }; occlusionQueries++;
    const next = new Set(), nextMeshes = new Set();
    if (freeWalk && cameraMode !== 'wide') {
      for (const x of [-.44, 0, .44]) for (const y of [.12, .38, .68, .98]) {
        sight.set(p.x + x, floorY + y, p.z + .12);
        const distance = camera.position.distanceTo(sight);
        occlusionRay.set(camera.position, sight.sub(camera.position).normalize()); occlusionRay.far = distance - .12;
        for (const volume of occlusionVolumes) {
          if (!occlusionRay.ray.intersectBox(volume.bounds, occlusionHitPoint) || camera.position.distanceTo(occlusionHitPoint) >= distance - .12) continue;
          if (!volume.structure) { next.add(volume.root); continue; }
          // The box is only a cheap rejection. Actual architecture must cross
          // the silhouette before it fades; windows and open aisles stay clear.
          for (const entry of volume.entries) {
            if (!occlusionRay.ray.intersectBox(entry.bounds, occlusionHitPoint) || camera.position.distanceTo(occlusionHitPoint) >= distance - .12) continue;
            occlusionHits.length = 0; occlusionRay.intersectObject(entry.mesh, false, occlusionHits);
            for (const hit of occlusionHits) {
              const original = fadedMaterials.get(hit.object)?.original || hit.object.material;
              const material = Array.isArray(original) ? original[hit.face?.materialIndex || 0] : original;
              if (!material || material.transparent && material.opacity < .99) continue;
              next.add(volume.root); nextMeshes.add(hit.object);
            }
          }
        }
      }
    }
    for (const volume of occlusionVolumes) if (!volume.structure && next.has(volume.root)) volume.root.traverse(object => { if (object.isMesh) nextMeshes.add(object); });
    for (const object of fadedMeshes) if (!nextMeshes.has(object)) townFadeMesh(object, false, cameraMode, fadedMaterials);
    for (const object of nextMeshes) townFadeMesh(object, true, cameraMode, fadedMaterials);
    for (const group of obscuredBuildings) if (!next.has(group)) { group.userData.faded = false; group.userData.fadedMode = cameraMode; }
    for (const group of next) { group.userData.faded = true; group.userData.fadedMode = cameraMode; }
    fadedMeshes.clear(); for (const object of nextMeshes) fadedMeshes.add(object);
    obscuredBuildings.clear(); for (const group of next) obscuredBuildings.add(group);
  }
  function focusShadow() {
    const close = freeWalk && cameraMode === 'close', overview = freeWalk && cameraMode === 'wide', p = actors.get('player').target;
    const extent = close ? 5.2 : overview ? Math.max(WALK_BOUNDS.maxX - WALK_BOUNDS.minX, WALK_BOUNDS.maxZ - WALK_BOUNDS.minZ) / 2 + 6 : 14,
      x = overview ? (WALK_BOUNDS.minX + WALK_BOUNDS.maxX) / 2 : freeWalk ? p.x : 0,
      z = overview ? (WALK_BOUNDS.minZ + WALK_BOUNDS.maxZ) / 2 : freeWalk ? p.z : -2,
      snapped = shadowFocus(x, z, extent, light.shadow.mapSize.x), scale = overview ? 3 : 1, far = overview ? 95 : 45;
    light.position.set(snapped.x - 9 * scale, 11 * scale, snapped.z + 7 * scale); light.target.position.set(snapped.x, 0, snapped.z);
    light.shadow.bias = -.0089 / (far - .5);
    if (light.shadow.camera.right !== extent || light.shadow.camera.far !== far) {
      Object.assign(light.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, far });
      light.shadow.camera.updateProjectionMatrix(); light.shadow.needsUpdate = true;
    }
    shadowDiagnostics = { x: snapped.x, z: snapped.z, texelStep: snapped.step, extent, far, mapSize: light.shadow.mapSize.x, direction: 'unchanged-sun-axis', tracking: freeWalk && !overview ? 'player' : overview ? 'whole-world' : 'classic' };
  }
  function followTarget() {
    const p = actors.get('player').target;
    if (cameraMode === 'close') {
      // Fixed compass axes preserve WASD orientation while a low lens reveals fabric and faces.
      const z = canvas.clientWidth < 600 ? 3.65 : 3.85, y = 1.42;
      const panel = getInterfaceBounds(); framingActorIds = [];
      if (panel && panel.width > canvas.clientWidth * .65) {
        // Fit the speaker as well as the player into the actual gap below the dialogue.
        // The measured panel width covers the CSS tablet breakpoint too.
        const participants = [...actors.entries()].filter(([id, a]) => id === 'player' || a.group.visible && a.target.distanceTo(p) < 3.6).slice(0, 4);
        framingActorIds = participants.map(([id]) => id);
        const points = [], bounds = new THREE.Box3();
        for (const [, a] of participants) for (const dx of [-.50, .50]) for (const dy of [.02, a.height + .08]) for (const dz of [-.43, .43]) {
          const point = a.target.clone().add(new THREE.Vector3(dx, dy, dz)); points.push(point); bounds.expandByPoint(point);
        }
        const centre = bounds.getCenter(new THREE.Vector3()), normal = new THREE.Vector3(.28, y, z).normalize();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), normal).normalize(), up = new THREE.Vector3().crossVectors(normal, right);
        const h = canvas.clientHeight, top = panel.bottom + 14, bottom = Math.max(top + 110, h - 155), middle = (top + bottom) / 2;
        const lens = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), kTop = (.5 - top / h) * lens, kBottom = (.5 - bottom / h) * lens, kMiddle = (.5 - middle / h) * lens;
        let distance = Math.hypot(z,y);
        for (const point of points) {
          const delta = point.clone().sub(centre), vertical = delta.dot(up), depth = delta.dot(normal), horizontal = Math.abs(delta.dot(right));
          distance = Math.max(distance, (vertical + kTop * depth) / (kTop - kMiddle), (-vertical - kBottom * depth) / (kMiddle - kBottom), horizontal / (lens * camera.aspect * .44) + depth);
        }
        target.copy(centre).addScaledVector(up, -kMiddle * distance);
        cameraPosition.copy(target).addScaledVector(normal, distance);
      } else {
        target.set(p.x, .69, p.z - .18);
        cameraPosition.copy(target).add(new THREE.Vector3(.28, y, z));
      }
    } else {
      // Keep the whole walking view distant and compass-aligned. Dialogue never
      // changes this framing, so opening a panel cannot make the world zoom or pan.
      framingActorIds = getInterfaceBounds() ? [...actors.entries()].filter(([id, a]) => id === 'player' || a.group.visible && a.target.distanceTo(p) < 3.6).slice(0, 4).map(([id]) => id) : [];
      target.set(p.x, .65, p.z - .7);
      // Reserve portrait dialogue space from the start. On a large screen the
      // smaller fixed bias shows the village ahead instead of an empty foreground.
      const portrait = canvas.clientWidth <= 760 && (canvas.clientWidth < 600 || canvas.clientHeight > 600);
      const lens = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      target.addScaledVector(walkingCameraUp, (portrait ? .13 : .075) * lens * walkingCameraOffset.length());
      cameraPosition.copy(target).add(walkingCameraOffset);
    }
  }
  function layoutCamera(immediate = false) {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight), aspect = w / h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'experience' ? (w < 600 ? 1.6 : 2) : (w < 600 ? 1.25 : 1.5))); renderer.setSize(w, h, false); camera.aspect = aspect;
    const follow = cameraMode === 'follow', walkingClose = freeWalk && cameraMode === 'close'; camera.fov = walkingClose ? (aspect < .8 ? 46 : 42) : follow ? (aspect < .8 ? 48 : 44) : 36;
    const close = cameraMode === 'close', wideWalking = freeWalk && cameraMode === 'wide', [x, z] = LOCATIONS[currentLocation] || LOCATIONS.home;
    target.set(close ? x : 0, close ? .8 : .25, close ? z + (bazaarActive ? .6 : -.6) : wideWalking ? (WALK_BOUNDS.minZ + WALK_BOUNDS.maxZ) / 2 : -2.25);
    // Fit width as well as height so the four destinations stay in the wide view on phones.
    const width = close ? bazaarActive ? 7.8 : 7.2 : wideWalking ? WALK_BOUNDS.maxX - WALK_BOUNDS.minX + 3 : 22.8,
      height = close ? bazaarActive ? 6.4 : 5.6 : wideWalking ? WALK_BOUNDS.maxZ - WALK_BOUNDS.minZ + 5 : 15.5,
      distance = Math.max(height, width / aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * (wideWalking ? 1.18 : 1);
    // Perspective enlarges the near corners. The map overview reserves room
    // for them and keeps the enlarged world clear at its farther lens distance.
    scene.fog.near = wideWalking ? Math.max(30, distance - 5) : 30;
    scene.fog.far = wideWalking ? Math.max(100, distance + 95) : 100;
    cameraPosition.copy(target).add(new THREE.Vector3(close ? .23 : .17, close ? .70 : .85, 1).normalize().multiplyScalar(distance));
    if (follow || walkingClose) followTarget();
    if (immediate || reducedMotion || motionQuery.matches) { camera.position.copy(cameraPosition); cameraTarget.copy(target); camera.lookAt(cameraTarget); }
    camera.far = Math.max(100, distance + 65); camera.updateProjectionMatrix(); rendering.resize(w, h, quality); dirty = true; schedule();
  }
  function resize() { if (!disposed) layoutCamera(true); }
  function setPlayerPose(value = {}) {
    if (disposed || !Number.isFinite(value.x) || !Number.isFinite(value.z)) return;
    const a = actors.get('player'), now = performance.now();
    if (playerControlled && a.target.x === value.x && a.target.z === value.z && playerMoving === (value.moving === true)
      && (!Number.isFinite(value.heading) || a.facing === value.heading)) return;
    playerControlled = true; playerMoving = value.moving === true;
    setActor('player', { x: value.x, z: value.z, pose: playerMoving ? 'walking' : 'standing' }, now, true);
    if (Number.isFinite(value.heading)) a.facing = value.heading;
    if (cameraMode === 'follow' || freeWalk && cameraMode === 'close') followTarget();
    dirty = true; schedule();
  }
  function setActor(id, value, now, immediate = false) {
    const a = actors.get(id); if (!a || !value) return; const walkingPlayer = id === 'player' && freeWalk;
    const x = clamp(finite(value.x), walkingPlayer ? WALK_BOUNDS.minX : -10, walkingPlayer ? WALK_BOUNDS.maxX : 10),
      z = clamp(finite(value.z), walkingPlayer ? WALK_BOUNDS.minZ : -10, walkingPlayer ? WALK_BOUNDS.maxZ : 6);
    if (a.target.x !== x || a.target.z !== z || !a.group.userData.placed) { a.from.copy(a.group.position); a.target.set(x, .12, z); a.changedAt = now; const dx = x - a.from.x, dz = z - a.from.z; if (Math.hypot(dx, dz) > .04) a.facing = Math.atan2(dx, dz); }
    if (immediate || !a.group.userData.placed || reducedMotion || motionQuery.matches) { a.group.position.copy(a.target); a.from.copy(a.target); a.changedAt = now - 260; }
    a.group.userData.placed = true; a.pose = value.pose || 'resting'; a.group.visible = true;
  }
  function supportHeight(x, z) {
    const floorY = environmentArt.floorHeight?.(x, z); let height = Number.isFinite(floorY) ? floorY : .12;
    const surfaces = [...fixedSupports, ...propSupports];
    if (legacy.visible && legacyChair.visible) legacyChair.traverse(object => { if (object.isMesh && object.userData.townSupportSurface) surfaces.push(object); });
    supportOrigin.set(x, 4, z); supportRay.set(supportOrigin, supportDown); supportRay.far = 8; supportHits.length = 0;
    for (const object of surfaces) { object.updateWorldMatrix(true, false); supportRay.intersectObject(object, false, supportHits); }
    for (const hit of supportHits) height = Math.max(height, hit.point.y);
    return height;
  }
  function restOn(object, supportY) {
    object.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(object);
    if (Number.isFinite(bounds.min.y)) object.position.y += supportY - bounds.min.y;
    object.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(object);
  }
  function releaseObjects(root) { const geometries = new Set(), materials = new Set(); root.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const material of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (!Object.values(m).includes(material)) materials.add(material); }); geometries.forEach(g => g.dispose()); materials.forEach(material => { if (material.userData.ownsMap) material.map?.dispose(); material.dispose(); }); root.clear(); }
  function updateProps(props) {
    const signature = JSON.stringify(props || []); if (signature === propSignature) return; propSignature = signature; releaseObjects(propRoot); propCount = 0;
    propSupports = []; propContacts = [];
    const rows = (props || []).slice(0, 30), arranged = [...rows.filter(p => p.kind === 'bazaar-table'), ...rows.filter(p => p.kind !== 'bazaar-table')];
    for (const p of arranged) {
      const g = new THREE.Group(); propRoot.add(g); g.position.set(clamp(finite(p.x), -10, 10), .13, clamp(finite(p.z), -10, 6));
      const material = p.preview ? m.linen : m.wood, pendingSupports = [];
      let plate = null, drink = null;
      if (p.kind === 'cushion') {
        mesh(g, new THREE.SphereGeometry(1, 20, 12), m.cotton, [0, .15, 0], [.38, .12, .3]);
        const rim = Array.from({ length: 20 }, (_, i) => { const a = i / 20 * TAU; return [Math.sin(a) * .355, .15, Math.cos(a) * .28]; });
        tube(g, rim, .008, m.lapis, true, 40);
        mesh(g, new THREE.SphereGeometry(1, 10, 6), m.lapis, [0, .265, 0], [.027, .010, .027]);
      }
      else if (p.kind === 'tray') { plate = box(g, material, [.71, .06, .47], [0, .15, 0], .05); drink = mug(g, m, [.09, .2, -.02], .9); }
      else if (p.kind === 'tea-cup') {
        const supportY = supportHeight(g.position.x, g.position.z);
        plate = mesh(g, new THREE.CylinderGeometry(.26, .23, .025, 24), m.ceramic, [0, .66, 0]); drink = mug(g, m, [0, .68, 0], 1.3);
        const top = restOn(plate, supportY).max.y; restOn(drink, top);
        if (p.sweetener === 'sweet') { restOn(box(g, m.paper, [.08, .075, .08], [-.21, .714, .11], .012), top); restOn(box(g, m.paper, [.075, .075, .075], [-.22, .714, .02], .012), top); }
      }
      else if (p.kind === 'water-glass') {
        const supportY = supportHeight(g.position.x, g.position.z);
        plate = mesh(g, new THREE.CylinderGeometry(.20, .20, .018, 22), m.wood, [0, .66, 0]); drink = waterGlass(g, m, [0, .68, 0], 1.3);
        restOn(drink, restOn(plate, supportY).max.y);
      }
      else if (p.kind === 'request-card') requestCard(g, m, p);
      else if (p.kind === 'picture-menu') pictureMenu(g, m, p);
      else if (p.kind === 'bazaar-table') {
        pendingSupports.push(box(g, m.wood, [2.65, .10, 1.20], [0, .60, 0], .045));
        for (const xx of [-1.11, 1.11]) for (const zz of [-.43, .43]) box(g, m.darkWood, [.09, .57, .09], [xx, .29, zz], .02);
        pendingSupports.push(box(g, m.cotton, [1.24, .0015, 1.17], [0, .6735, 0], .0005));
        box(g, m.cotton, [1.24, .23, .002], [0, .55925, .586], .0005);
        for (let i = 0; i < 14; i++) tube(g, [[-.53 + i * .081, .476, .615], [-.51 + i * .081, .480, .618]], .003, m.lapis, false, 3);
      }
      else if (p.kind === 'board') {
        box(g, material, [.82, .68, .055], [0, 1.80, 0], .035); box(g, m.paper, [.72, .58, .016], [0, 1.80, .042], .014);
        for (const sign of [-1, 1]) { const leg = box(g, m.darkWood, [.06, 1.57, .07], [sign * .22, .775, -.035]); leg.rotation.z = sign * -.10; }
        box(g, m.wood, [.90, .06, .15], [0, 1.48, .03], .02);
        const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.bezierCurveTo(-.33, .16, -.20, .35, .16, .43); leaf.bezierCurveTo(.25, .18, .16, .04, 0, 0);
        mesh(g, new THREE.ShapeGeometry(leaf, 14), m.leaf, [-.05, 1.58, .06]); tube(g, [[-.04, 1.60, .065], [.01, 1.75, .065], [.10, 1.97, .065]], .008, m.leafLight, false, 12);
      }
      else if (p.kind === 'chair') bench(g, m, [0, 0, 0], .83);
      else { box(g, material, [.84, .13, .43], [0, .23, 0]); for (const sign of [-1, 1]) box(g, m.darkWood, [.1, .2, .38], [sign * .28, .1, 0]); }
      if (['garden', 'outward', 'clear'].includes(p.orientation)) g.rotation.y = Math.PI / 2;
      const floorY = environmentArt.floorHeight?.(g.position.x, g.position.z), supportY = p.kind === 'bazaar-table' ? (Number.isFinite(floorY) ? floorY : .12) : supportHeight(g.position.x, g.position.z);
      const bounds = ['tea-cup', 'water-glass'].includes(p.kind) ? (g.updateWorldMatrix(true, true), new THREE.Box3().setFromObject(g)) : restOn(g, supportY);
      // Each row retains its original X/Z and meaning. Only visual Y follows
      // the actual supporting floor/table/seat, including bevelled geometry.
      const contact = { id: p.id || null, kind: p.kind, x: g.position.x, z: g.position.z, bottomY: bounds.min.y, supportY, gap: bounds.min.y - supportY };
      if (plate && drink) {
        if (p.kind === 'tray') restOn(drink, new THREE.Box3().setFromObject(plate).max.y);
        const plateBounds = new THREE.Box3().setFromObject(plate), drinkBounds = new THREE.Box3().setFromObject(drink);
        contact.plateTopY = plateBounds.max.y; contact.drinkBottomY = drinkBounds.min.y; contact.drinkGap = drinkBounds.min.y - plateBounds.max.y;
      }
      propContacts.push(contact); for (const object of pendingSupports) { object.userData.townSupportSurface = true; propSupports.push(object); }
      if (p.preview) g.traverse(object => { if (!object.isMesh) return; object.material = object.material.clone(); object.material.transparent = true; object.material.opacity = .40; object.material.depthWrite = false; object.castShadow = false; });
      propCount++;
    }
  }
  function updateMemories(records) {
    // Visual records of completed participation, never preview rewards or
    // fabricated gifts. The authoritative history and inventory stay untouched.
    const byPlace = new Map();
    for (const h of Array.isArray(records) ? records : []) {
      if (!h?.resultId || !['help', 'tea', 'coordination'].includes(h.kind)
        || !['planner', 'delegated'].includes(h.role) || !Object.hasOwn(LOCATIONS, h.location)
        || h.kind === 'help' && h.choice === 'alone') continue;
      byPlace.set(h.location, { resultId: h.resultId, kind: h.kind, location: h.location, choice: h.choice });
    }
    const markers = [...byPlace.values()].slice(-4), signature = JSON.stringify(markers);
    if (signature === memorySignature) return;
    memorySignature = signature; memoryMarkers = markers; releaseObjects(memoryRoot);
    const anchors = { home: [-7.72, .94, -.4], cafe: [1.73, 1.02, -.52], workshop: [7.62, 1.04, -.48], greenhouse: [1.66, 1.10, -6.52] };
    for (const h of markers) {
      const g = new THREE.Group(); g.name = `memory-${h.location}`; g.userData.resultId = h.resultId; memoryRoot.add(g);
      g.position.set(...anchors[h.location]);
      box(g, m.cotton, [.34, .45, .024], [0, 0, 0], .025);
      for (const x of [-.13, .13]) tube(g, [[x, .20, .025], [x, .27, .013], [x, .29, -.04]], .007, m.lapis, false, 8);
      const thread = h.kind === 'help' ? m.coral : h.kind === 'tea' ? m.butter : m.lapis;
      const stitches = h.kind === 'help' ? [[[-.08, -.03, .021], [0, .07, .022], [.08, -.03, .021]], [[-.08, .07, .021], [0, -.03, .022], [.08, .07, .021]]]
        : h.kind === 'tea' ? [[[-.085, -.03, .022], [-.085, .07, .022], [.06, .07, .022], [.06, -.03, .022], [-.085, -.03, .022]], [[.06, .04, .022], [.105, .04, .022], [.105, -.01, .022], [.06, -.01, .022]]]
        : [[[-.09, .06, .022], [-.03, -.025, .022], [.09, .075, .022]]];
      for (const points of stitches) tube(g, points, .009, thread, false, 14);
      for (let i = 0; i < 5; i++) tube(g, [[-.11 + i * .048, -.17, .021], [-.09 + i * .048, -.17, .023]], .004, m.lapis, false, 3);
    }
  }
  let cafeAnchor = { sourceX: 50, sourceY: 55, x: 0, z: 0 };
  function cafePoint(point) { return { x: cafeAnchor.x + (finite(point?.x, 50) - cafeAnchor.sourceX) * .045, z: cafeAnchor.z + (finite(point?.y, 55) - cafeAnchor.sourceY) * .045, pose: point?.pose }; }
  function updateLegacy(data, now) {
    const active = !!data.legacy?.active; legacy.visible = active; actors.get('visitor-tea-reader').group.visible = active && (!!data.legacy?.guestSeated || !!data.legacyActors?.guest);
    actors.get('cafe-owner').label.position.y = active && (data.legacy?.guestSeated || data.legacyActors?.guest) ? 1.84 : actors.get('cafe-owner').height + .26;
    if (!active) return;
    const slots = { garden: [65, 64, -.7, 2], 'garden-right': [78, 68, 1.2, 2], 'eaves-left': [25, 54, -1.2, .4], 'eaves-right': [39, 54, .8, .4] }, slot = slots[data.legacy.placement] || [50, 55, 0, 0];
    cafeAnchor = { sourceX: slot[0], sourceY: slot[1], x: slot[2], z: slot[3] }; const pos = cafePoint({ x: slot[0], y: slot[1] });
    legacyChair.position.set(pos.x, .14, pos.z); legacyChair.visible = !!data.legacy.placement; legacyCanopy.position.set(pos.x, .12, pos.z); legacyCanopy.visible = !!data.legacy.canopyPlaced; canopyMaterial.color.set(data.legacy.color === 'yellow' ? '#dcbd76' : '#7d9b84');
    const sign = data.legacy.signPreview || data.legacy.sign, signPoint = cafePoint(sign?.slot === 'entrance-right' ? { x: 42, y: 82 } : { x: 15, y: 72 });
    legacySign.visible = !!sign?.slot; legacySign.position.set(signPoint.x, .12, signPoint.z); signChairIcon.visible = sign?.picture === 'chair'; signTeaIcon.visible = sign?.picture === 'tea';
    const source = data.legacyActors || {}, fallbackGuest = { x: slot[0], y: slot[1], pose: data.legacy.guestSeated ? 'sit' : 'stand' };
    if (data.legacy.guestSeated || source.guest) setActor('visitor-tea-reader', cafePoint(source.guest || fallbackGuest), now, true);
    if (source.owner) setActor('cafe-owner', cafePoint(source.owner), now, true);
    else if (!data.npcs?.some(n => n.id === 'cafe-owner') && !data.lifeRoutine?.owner) setActor('cafe-owner', cafePoint({ x: 42, y: 60, pose: 'standing' }), now, true);
    legacyCup.visible = !!data.legacy.teaPlaced || (!!source.tea && source.tea.pose !== 'hidden');
    const cup = source.tea ? cafePoint(source.tea) : pos; legacyCup.position.set(cup.x + .4, .62, cup.z + .18);
    if (legacyCup.visible) { const supportY = supportHeight(legacyCup.position.x, legacyCup.position.z), bounds = restOn(legacyCup, supportY); legacyContact = { id: 'legacy-cup', kind: 'legacy-cup', bottomY: bounds.min.y, supportY, gap: bounds.min.y - supportY }; }
  }
  function render(data = {}, options = {}) {
    if (disposed) return; requestedSerial++; const now = performance.now();
    const nextQuality = options.quality === 'experience' ? 'experience' : 'balanced', nextCamera = ['follow', 'close'].includes(options.camera) ? options.camera : 'wide';
    const nextFreeWalk = data.freeWalk === true, cameraChanged = nextCamera !== cameraMode || nextFreeWalk !== freeWalk;
    const nextBazaar = data.location === 'cafe' && !!data.props?.some(p => p.id?.startsWith('bazaar-'));
    const layoutChanged = nextQuality !== quality || nextCamera !== cameraMode || currentLocation !== data.location || reducedMotion !== !!options.reducedMotion || nextBazaar !== bazaarActive || nextFreeWalk !== freeWalk;
    if (!nextFreeWalk) { playerControlled = false; playerMoving = false; }
    freeWalk = nextFreeWalk;
    bazaarActive = nextBazaar;
    quality = nextQuality; cameraMode = nextCamera; reducedMotion = !!options.reducedMotion; currentLocation = LOCATIONS[data.location] ? data.location : 'home';
    if (lastQuality !== quality) { lastQuality = quality; const size = canvas.clientWidth < 600 && quality !== 'experience' ? 1024 : 2048; light.shadow.mapSize.set(size, size); light.shadow.map?.dispose(); light.shadow.map = null; light.shadow.needsUpdate = true; cpuTimes = []; intervals = []; lastMetricsAt = 0; }
    if (!freeWalk || !playerControlled) setActor('player', data.player || { x: -6, z: 1.1 }, now);
    const npcIds = new Set(); for (const npc of data.npcs || []) { if (npc.id === 'player' || npc.id === 'visitor-tea-reader') continue; npcIds.add(npc.id); setActor(npc.id, npc, now); }
    for (const id of ['cafe-owner', 'workshop-owner', 'researcher', 'book-guest', 'companion']) if (!npcIds.has(id)) actors.get(id).group.visible = false;
    actors.get('workshop-owner').label.position.set(bazaarActive ? 1.1 : 0, bazaarActive ? .8 : actors.get('workshop-owner').height + .26, 0);
    updateProps(data.legacy?.active ? data.props?.filter(p => p.id !== 'ft-seat') : data.props); updateMemories(data.memories); updateLegacy(data, now);
    lifeCup.visible = !!data.lifeRoutine?.prop && data.lifeRoutine.prop.pose !== 'hidden';
    if (data.lifeRoutine?.owner) setActor('cafe-owner', cafePoint(data.lifeRoutine.owner), now, true);
    if (lifeCup.visible) { const p = cafePoint(data.lifeRoutine.prop); lifeCup.position.set(p.x, .53, p.z); const supportY = supportHeight(p.x, p.z), bounds = restOn(lifeCup, supportY); lifeContact = { id: 'life-cup', kind: 'life-cup', x: p.x, z: p.z, bottomY: bounds.min.y, supportY, gap: bounds.min.y - supportY }; }
    // A deliberate view change uses a cut rather than flying through buildings.
    if (layoutChanged) layoutCamera(cameraChanged); dirty = true; schedule(); return requestedSerial;
  }
  function frame(now) {
    raf = 0; if (disposed || !visible || document.hidden || contextLost) return;
    // Resolution/contact light define the quality tiers. Both keep responsive
    // 60 Hz presentation; lowering the default to 30 made walking visibly step.
    const motion = !reducedMotion && !motionQuery.matches, interval = 1000 / 60;
    if (frameCount && now - previousFrame < interval - 1) { schedule(); return; }
    const dt = Math.min(.08, Math.max(0, now - previousFrame) / 1000); previousFrame = now; const start = performance.now();
    if (cameraMode === 'follow' || freeWalk && cameraMode === 'close') followTarget();
    // Direct walking input and the camera share the same displacement. There is
    // no follow spring, turn banking, head bob or residual drift after release.
    const cameraBlend = !motion || freeWalk && cameraMode !== 'wide' ? 1 : Math.min(1, dt * 8); camera.position.lerp(cameraPosition, cameraBlend); cameraTarget.lerp(target, cameraBlend); camera.lookAt(cameraTarget);
    for (const [id, a] of actors) {
      if (!a.group.visible) continue; const progress = motion ? clamp((now - a.changedAt) / 260, 0, 1) : 1; a.group.position.lerpVectors(a.from, a.target, progress * progress * (3 - 2 * progress));
      const walking = progress < 1 || ['walking', 'walk', 'walk-to-seat', 'walk-to-sign', 'carrying'].includes(a.pose), working = ['working', 'drawing', 'tidying', 'serve', 'serving', 'read', 'reading'].includes(a.pose), showing = a.pose === 'showing', holding = a.pose === 'holding', talking = ['talking', 'inviting'].includes(a.pose), resting = ['sit', 'sitting', 'seated', 'resting'].includes(a.pose);
      const travelled = a.stepPlaced ? a.group.position.distanceTo(a.stepPosition) : 0;
      a.stepPosition.copy(a.group.position); a.stepPlaced = true;
      // Advance the gait through actual travel, never through an idle clock.
      // Large authoritative relocations do not become a burst of footsteps.
      if (motion && travelled < .7) a.walkPhase = (a.walkPhase + travelled / (a.resident ? 1.4 : 1.6) * TAU) % TAU;
      const gaitTarget = motion && walking && travelled > .00001 ? 1 : 0;
      a.gaitBlend += (gaitTarget - a.gaitBlend) * (1 - Math.exp(-dt * (gaitTarget ? 22 : 28)));
      if (!motion || a.gaitBlend < .001) a.gaitBlend = 0;
      const gait = a.gaitBlend, sway = Math.sin(a.walkPhase), idle = 1 - gait;
      if (a.groundX !== a.group.position.x || a.groundZ !== a.group.position.z) {
        const floorY = environmentArt.floorHeight?.(a.group.position.x, a.group.position.z);
        a.floorY = Number.isFinite(floorY) ? floorY : .12; a.groundX = a.group.position.x; a.groundZ = a.group.position.z;
      }
      a.gaitBob = motion ? Math.abs(sway) * gait * (a.resident ? .008 : .020) + idle * (holding ? 0 : working || talking ? Math.sin(now * .0032) * .012 : Math.sin(now * .0018) * .003) : 0;
      // The visual feet follow the surface. The input anchor, gait travel and
      // direct camera remain level; a seated resident keeps its chair pose.
      a.surfaceOffset = ['sit', 'sitting', 'seated'].includes(a.pose) ? 0 : a.floorY - a.group.position.y;
      a.body.position.y = a.surfaceOffset + a.gaitBob;
      a.shadow.position.y = a.floorY - a.group.position.y + .004;
      // High steps/porches use the real sun shadow, avoiding a floating contact
      // disc spilling outside a narrow elevated platform.
      a.shadow.visible = a.floorY < .2;
      a.body.rotation.z = motion ? sway * gait * (a.resident ? .007 : .023) + idle * (showing ? .045 + Math.sin(now * .0026) * .025 : working ? Math.sin(now * .0032) * .020 : 0) : 0;
      a.body.rotation.x = a.resident ? 0 : working ? .10 : showing ? -.05 : 0;
      const squash = a.resident ? 0 : Math.cos(a.walkPhase * 2) * gait * .008;
      a.body.scale.set(.56 * (1 + squash * .5), .56 * (1 - squash), .56 * (1 + squash * .5));
      const heading = id === 'player' && freeWalk && playerControlled ? a.facing : walking ? a.facing : resting && id !== 'player' ? -.18 : holding ? .3 : .10;
      if (a.visualFacing === null || !motion) a.visualFacing = heading;
      else a.visualFacing += Math.atan2(Math.sin(heading - a.visualFacing), Math.cos(heading - a.visualFacing)) * (1 - Math.exp(-dt * 18));
      a.body.rotation.y = a.visualFacing;
      a.resident?.update({ now, deltaSeconds: dt, walkPhase: a.walkPhase, gaitBlend: gait, motion, walking, working, showing, holding, talking, seated: ['sit', 'sitting', 'seated'].includes(a.pose) });
      a.label.visible = !freeWalk || cameraMode !== 'wide' && id !== 'player' && a.group.position.distanceTo(actors.get('player').group.position) < (cameraMode === 'close' ? 2.0 : 3.0);
      const fibers = a.body.getObjectByName('close-view-felt-fibers'); if (fibers) fibers.visible = cameraMode === 'close';
    }
    for (const o of labelSprites) { o.getWorldPosition(labelPosition); if (o.userData.placeId) { const p = actors.get('player').target, [x, z] = LOCATIONS[o.userData.placeId]; o.visible = !(cameraMode === 'close' && o.parent.userData.faded) && (!freeWalk || cameraMode !== 'wide' && Math.hypot(p.x - x, p.z - z) < 4.8); } const worldPerPixel = 2 * camera.position.distanceTo(labelPosition) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(1, canvas.clientHeight); const width = Math.min(Math.max(o.userData.labelWidth, o.userData.minPixelWidth * worldPerPixel), (o.userData.maxPixelWidth || 170) * worldPerPixel); o.scale.set(width, width * (o.userData.labelAspect || 100 / 384), 1); }
    updateOcclusion(); focusShadow();
    rendering.render(cameraMode === 'wide'); frameCount++; renderedSerial = requestedSerial; ready = true; dirty = false;
    const cpu = performance.now() - start; cpuTimes.push(cpu); if (lastMetricsAt && now - lastMetricsAt < 250) intervals.push(now - lastMetricsAt); lastMetricsAt = now; if (cpuTimes.length > 360) cpuTimes.shift(); if (intervals.length > 360) intervals.shift();
    if (motion || freeWalk && playerMoving) schedule();
  }
  // An account iframe waits for its first authoritative scene input. Rendering
  // the unused placeholder here can block the account response during shader
  // compilation, then immediately repeat that work for the actual town view.
  function schedule() { if ((!deferInitialRender || requestedSerial > 0) && !raf && !disposed && visible && !document.hidden && !contextLost) raf = requestAnimationFrame(frame); }
  function pointerDown(e) { if (e.button && e.pointerType === 'mouse') return; pointerStart = { id: e.pointerId, x: e.clientX, y: e.clientY }; }
  function pointerUp(e) {
    const start = pointerStart; pointerStart = null; if (!start || start.id !== e.pointerId || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9 || contextLost) return;
    if (freeWalk) return;
    const rect = canvas.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hitTargets, false)[0]; if (hit) return onDestination(hit.object.userData.destination);
    const p = new THREE.Vector3(); if (!raycaster.ray.intersectPlane(floors, p)) return;
    if (p.x < -10 || p.x > 10 || p.z < -9 || p.z > 5) return;
    const nearest = Object.entries(LOCATIONS).map(([id, [x, z]]) => ({ id, d: Math.hypot(p.x - x, p.z - z) })).sort((a, b) => a.d - b.d)[0]; if (nearest?.d < 4.5) onDestination(nearest.id);
  }
  function pointerCancel() { pointerStart = null; }
  function visibilityChange() { cancelAnimationFrame(raf); raf = 0; previousFrame = lastMetricsAt = 0; if (!document.hidden) { dirty = true; schedule(); } }
  function motionChange() { dirty = true; schedule(); }
  function lost(e) { e.preventDefault(); contextLost = true; ready = false; cancelAnimationFrame(raf); raf = 0; onError(new Error('입체 장면을 표시할 수 없어요. 아래 생활 현황과 행동은 계속 사용할 수 있어요.')); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; cancelAnimationFrame(raf); raf = 0; previousFrame = lastMetricsAt = 0; if (visible) { dirty = true; schedule(); } }, { threshold: .01 }); intersection.observe(canvas);
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerCancel); canvas.addEventListener('webglcontextlost', lost); document.addEventListener('visibilitychange', visibilityChange); motionQuery.addEventListener?.('change', motionChange);
  function setAppearance(value) {
    if (disposed) return;
    appearanceVerified = value?.verified === true;
    playerOutfit = appearanceVerified && AVATAR_OUTFITS.includes(value.outfit) ? value.outfit : 'none';
    playerDyes=appearanceVerified?normalizeWardrobeDyes(value?.dyes,slotsForOutfit(playerOutfit)):{};
    const avatar=actors.get('player').avatar;avatar?.setOutfit(playerOutfit);avatar?.setDyes(playerDyes);dirty = true; schedule();
  }
  function cameraDiagnostics() {
    const player = actors.get('player'), feet = player.group.position.clone().add(new THREE.Vector3(0, player.surfaceOffset, 0)).project(camera), top = player.group.position.clone().add(new THREE.Vector3(0, player.height + player.surfaceOffset, 0)).project(camera);
    return {
      cameraRevision: 4,
      cameraFov: camera.fov,
      cameraDirection: camera.getWorldDirection(new THREE.Vector3()).toArray(),
      playerScreenHeight: Math.abs(top.y - feet.y) * canvas.clientHeight / 2,
      cameraMotion: {
        walkingTracking: freeWalk && cameraMode !== 'wide' ? 'direct' : 'fixed',
        followDistance: walkingCameraOffset.length(),
        viewTransition: 'cut',
        dialogueReframes: cameraMode === 'close' && !!getInterfaceBounds(),
        followResidual: cameraMode === 'follow' ? camera.position.distanceTo(cameraPosition) : null
      }
    };
  }
  function stats() { const player = actors.get('player'); const projected = player.group.position.clone().add(new THREE.Vector3(0, .55 + player.surfaceOffset, 0)).project(camera); const head = player.group.position.clone().add(new THREE.Vector3(0, .83 + player.surfaceOffset, 0)).project(camera); return { ready, ...cameraDiagnostics(), playerHeadScreen: {x:(head.x+1)*canvas.clientWidth/2,y:(1-head.y)*canvas.clientHeight/2,inFrustum:Math.abs(head.x)<1&&Math.abs(head.y)<1&&Math.abs(head.z)<1}, graphicsVersion: 20, ...(bakedDistrict ? { bakedDistrict: bakedDistrict.stats() } : {}), brandArt: { revision: 13, palette: TOWN_BRAND, materialVersion: surfaceArt.version, memoryMarkers: memoryMarkers.map(h => ({ ...h })) }, rendering: rendering.stats(), conversationHeads: framingActorIds.map(id=>{const a=actors.get(id), point=(a.resident?.head ? a.resident.head.getWorldPosition(new THREE.Vector3()) : a.group.position.clone().add(new THREE.Vector3(0,a.headHeight,0))).project(camera);return {id,x:(point.x+1)*canvas.clientWidth/2,y:(1-point.y)*canvas.clientHeight/2};}), residents: [...actors.entries()].filter(([,a])=>a.resident).map(([id,a])=>({id,visible:a.group.visible,identity:a.resident.identity,height:a.height,headHeight:a.headHeight,pose:a.pose})), assetsReady, assetFailures: [...assetFailures], environment: environmentArt.stats, surfaceAlignment: { revision: 20, floorY: player.floorY, surfaceOffset: player.surfaceOffset, footWorldY: player.group.position.y + player.body.position.y, nominalFootWorldY: player.group.position.y + player.surfaceOffset, bob: player.gaitBob, shadowWorldY: player.group.position.y + player.shadow.position.y, contactShadowVisible: player.shadow.visible, anchorY: player.group.position.y, gameplayYChanged: false }, propContacts: [...propContacts, ...(lifeCup.visible && lifeContact ? [lifeContact] : []), ...(legacy.visible && legacyCup.visible && legacyContact ? [legacyContact] : [])], occlusionReuse: { queries: occlusionQueries, reusedFrames: occlusionReused, fadedMeshCount: fadedMeshes.size, roofCutaways: [...fadedMeshes].filter(object => fadedMaterials.get(object)?.roof && !object.visible).length }, shadowFocus: shadowDiagnostics, playerAvatar: player.avatar?.metrics() || {avatarVersion:'town-role-v2',outfit:playerOutfit}, appearanceVerified, playerScreen: { x: (projected.x + 1) * canvas.clientWidth / 2, y: (1 - projected.y) * canvas.clientHeight / 2, inFrustum: Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && Math.abs(projected.z) < 1 }, cameraNear: camera.near, cameraDistance: camera.position.distanceTo(player.group.position), requestedSerial, renderedSerial, renderer: `Three.js r${THREE.REVISION}`, webgl: renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL', contextLost, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, dpr: renderer.getPixelRatio(), drawingBuffer: { width: canvas.width, height: canvas.height }, frameCount, samples: cpuTimes.length, cpuRenderMs: { p50: quantile(cpuTimes, .5), p95: quantile(cpuTimes, .95) }, frameIntervalMs: { p50: quantile(intervals, .5), p95: quantile(intervals, .95) }, frameCap: 60, quality, camera: cameraMode, location: currentLocation, freeWalk, locomotion: { revision: 6, requestedHeading: player.facing, displayedHeading: player.visualFacing, gaitBlend: player.gaitBlend, phase: player.walkPhase, bob: player.gaitBob, roll: player.body.rotation.z, positionResidual: player.group.position.distanceTo(player.target), headingResponse: 'shortest-angle-body-only', gaitClock: 'travel-distance' }, playerPose: { x: player.group.position.x, y: player.group.position.y, z: player.group.position.z, heading: player.body.rotation.y, moving: playerMoving }, cameraPosition: camera.position.toArray(), cameraTarget: cameraTarget.toArray(), obscuredBuildingCount: [...obscuredBuildings].filter(g => buildings.includes(g)).length, obscuredPropCount: [...obscuredBuildings].filter(g => !buildings.includes(g)).length, paused: disposed || !visible || document.hidden || contextLost, reducedMotion: reducedMotion || motionQuery.matches, actorCount: [...actors.values()].filter(a => a.group.visible).length, propCount, productionAsset: false, physicalDeviceVerified: false }; }
  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(raf); resizeObserver.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', visibilityChange); motionQuery.removeEventListener?.('change', motionChange);
    for (const [type, fn] of [['pointerdown', pointerDown], ['pointerup', pointerUp], ['pointercancel', pointerCancel], ['webglcontextlost', lost]]) canvas.removeEventListener(type, fn);
    for (const actor of actors.values()) actor.avatar?.dispose();
    for (const actor of actors.values()) if (actor.resident) actor.body.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    const geometries = new Set(), materials = new Set(Object.values(m)), textures = new Set([environment, ...Object.values(maps), ...assetTextures, ...surfaceArt.textures]); scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const mat of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { materials.add(mat); for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value); } });
    for (const entry of fadedMaterials.values()) { for (const material of entry.variants) materials.add(material); for (const material of Array.isArray(entry.original) ? entry.original : [entry.original]) materials.add(material); }
    environmentArt.dispose?.();
    geometries.forEach(g => g.dispose()); materials.forEach(mat => mat.dispose()); textures.forEach(t => t.dispose()); envTarget.dispose(); skyTarget?.dispose(); light.shadow.dispose(); rendering.dispose(); renderer.dispose(); renderer.forceContextLoss();
    fadedMeshes.clear(); fadedMaterials.clear(); obscuredBuildings.clear(); occlusionVolumes.length = 0; occlusionHits.length = 0;
    fixedSupports.length = 0; propSupports = []; propContacts = []; supportHits.length = 0; lifeContact = legacyContact = previousOcclusion = null;
  }
  const loader = new THREE.TextureLoader();
  async function loadSurface(name, apply) {
    try {
      const map = await loader.loadAsync(new URL(`./day-assets/${name}`, import.meta.url).href);
      if (disposed) { map.dispose(); return; }
      assetTextures.add(map); map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); apply(map); dirty = true; schedule();
    } catch { assetFailures.push(name); }
  }
  async function loadPlayerAvatar() {
    try {
      const avatar = await createMongleAvatar({ mobile: canvas.clientWidth < 600, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
      if (disposed) { avatar.dispose(); return; }
      avatar.setOutfit(playerOutfit);
      avatar.setDyes(playerDyes);
      const player = actors.get('player'), previous = player.body, body = new THREE.Group(); body.scale.setScalar(.56); body.add(avatar.group);
      player.group.remove(previous); previous.traverse(o => { o.geometry?.dispose(); if (o.isLineSegments) o.material?.dispose(); });
      player.group.add(body); player.body = body; player.avatar = avatar; dirty = true; schedule();
    } catch { assetFailures.push('avatar-v3'); }
  }
  const initialAssets = Promise.all([
    loadPlayerAvatar(),
    bakedDistrictReady,
    loadSurface(`azure-sky-v3${canvas.clientWidth < 600 ? '-mobile' : ''}.jpg`, map => {
      skyTexture = map; map.colorSpace = THREE.SRGBColorSpace; map.mapping = THREE.EquirectangularReflectionMapping;
      skyTarget = pmrem.fromEquirectangular(map); scene.background = map; scene.environment = skyTarget.texture;
      scene.backgroundRotation.y = scene.environmentRotation.y = .65; scene.backgroundIntensity = .95;
    }),
    loadSurface('felt-coral.webp', map => {
      map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(2.1, 1.4);
      m.felt.map = m.felt.bumpMap = map; m.felt.bumpScale = .016; m.felt.color.set('#ffe3d9'); m.felt.needsUpdate = true;
    }),
    loadSurface('terrain-normal.jpg', map => {
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(3, 3);
      environmentArt.setTerrainNormal?.(map);
    }),
    loadSurface('cliff-normal.jpg', map => {
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(2, 2);
      environmentArt.setCliffNormal?.(map);
    }),
  ]).finally(() => { pmrem.dispose(); assetsReady = true; if (!disposed) { dirty = true; schedule(); } });
  async function prepareInitialAssets() {
    if (disposed || assetsReady) return;
    let timer;
    // Start the account handshake after initial material variants settle so a
    // late map cannot trigger another shader compilation during that request.
    // A stalled image still permits the existing procedural fallback to draw.
    try { await Promise.race([initialAssets.catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, 5000); })]); }
    finally { clearTimeout(timer); }
  }
  resize(); if (!deferInitialRender) render({ location: 'home' , player: { x: -6, z: 1.1 }, npcs: [] }); return { render, setPlayerPose, setAppearance, prepareInitialAssets, resize, stats, dispose };
}
