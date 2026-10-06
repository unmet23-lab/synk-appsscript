// 주문 폭주 — 컵 작업대(Three.js). 크림 펠트 벽(화면 CSS) 앞 코랄 펠트 작업대 위에 컵 한두 개가 서고, 넣은 재료가 그대로 보인다.
// 따뜻한 컵은 손잡이 달린 크림 펠트 머그, 차가운 컵은 길쭉한 하늘색 펠트 텀블러. 음료는 펠트 색 면(커피 진갈색·차 호박색·라테 캐러멜·우유 흰색),
// 얼음은 옅은 하늘 펠트 조각, 설탕은 흰 펠트 각설탕. 고른 컵은 분홍 펠트 받침 위에 선다.
// 펠트 질감은 말 랠리처럼 키트의 펠트 사진(kit/felt/tex-*.webp)을 재질에 곱한다. 카메라는 움직이지 않는다(흔들기·확대 없음).
// 움직임 줄이기에서는 김·붓기·떨어지기·밀어내기를 하지 않는다. WebGL이 없으면 같은 모습을 2D로 그리는 FlatStage를 쓴다.
import * as THREE from './vendor/three.module.js';
import { liquidOf } from './cafe.mjs';

export const LIQUID = { coffee: '#5a3322', latte: '#c48c59', tea: '#c97c22', milktea: '#dcb27d', milk: '#fbf7ee' };
const COLORS = { mug: '#fffaf1', tumbler: '#c4e0fb', coaster: '#f6bba9', ice: '#b8d9f7', sugar: '#ffffff' };
// 컵 모양(높이·위 반지름·아래 반지름·벽 두께·바닥 두께·음료가 차는 높이)
const SHAPES = {
  mug: { h: 0.6, rTop: 0.34, rBot: 0.3, wall: 0.04, floor: 0.06, fill: 0.53 },
  tumbler: { h: 0.92, rTop: 0.3, rBot: 0.24, wall: 0.035, floor: 0.06, fill: 0.85 },
};
const SLOT_X = [[0], [-0.52, 0.52]];   // 컵 수별 자리
const COASTER_H = 0.035;
const ICE_AT = [[-0.09, 0.05, 0], [0.09, -0.04, 0], [0.01, 0.06, 1]];   // 얼음 셋(x, z, 층)
const SUGAR_AT = [[0.11, 0.1], [-0.12, -0.08]];
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

/** 컵 단면(돌려 깎기용): 바깥 벽 → 둥근 입술 → 안쪽 벽 → 안쪽 바닥. */
function profile(s) {
  const pts = [
    [0, 0], [s.rBot - 0.03, 0], [s.rBot, 0.025], [s.rTop, s.h - 0.02], [s.rTop - 0.012, s.h],
    [s.rTop - s.wall + 0.01, s.h], [s.rTop - s.wall, s.h - 0.02], [s.rBot - s.wall, s.floor + 0.025],
    [s.rBot - s.wall - 0.025, s.floor], [0, s.floor],
  ];
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}
/** 안쪽 벽의 반지름(높이 y에서). 음료 면의 크기에 쓴다. */
function innerR(s, y) {
  const k = (y - s.floor) / (s.h - s.floor);
  return (s.rBot - s.wall) + ((s.rTop - s.wall) - (s.rBot - s.wall)) * k - 0.006;
}

/** 크림 펠트 사진에서 밝기 결만 남긴 판. 재질 색을 곱해도 색이 탁해지지 않는다. */
function feltGrain(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  const lum = (i) => p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) sum += lum(i);
  const mean = sum / (p.length / 4);
  for (let i = 0; i < p.length; i += 4) {
    const v = Math.max(0, Math.min(255, 238 + (lum(i) - mean) * 1.5));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  return c;
}

export class CafeStage {
  /** canvas: 작업대 상자 안의 캔버스. onSelect(i): 컵을 눌렀을 때. WebGL을 만들 수 없으면 여기서 오류가 난다(app.mjs가 FlatStage로 바꾼다). */
  constructor(canvas, onSelect, { reducedMotion = () => false } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.reduced = reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
    this.scene.add(new THREE.HemisphereLight(0xfffaf2, 0xe2cdb8, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-2.2, 4.6, 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.5, far: 12 });
    sun.shadow.radius = 5;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);

    // 재질: 펠트 사진이 오기 전에는 같은 색 납작한 면, 오면 결을 곱한다
    const felt = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    this.mat = {
      top: felt('#f07e6c'), side: felt('#c9503f'),
      mug: felt(COLORS.mug), tumbler: felt(COLORS.tumbler), coaster: felt(COLORS.coaster),
      ice: felt(COLORS.ice), sugar: felt(COLORS.sugar),
    };

    // 작업대: 코랄 펠트 윗면(앞쪽은 화면 아래로 이어진다)
    const counter = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 4.4),
      [this.mat.side, this.mat.side, this.mat.top, this.mat.side, this.mat.side, this.mat.side]);
    counter.position.set(0, -0.3, 0.6);
    counter.receiveShadow = true;
    this.scene.add(counter);

    // 붓는 줄기(재료를 넣는 순간만)
    this.pourMat = new THREE.MeshStandardMaterial({ color: LIQUID.coffee, roughness: 0.9 });
    this.pour = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 1, 14), this.pourMat);
    this.pour.visible = false;
    this.scene.add(this.pour);
    this.pourT = 1;

    this.slots = [new Cup(this, 0), new Cup(this, 1)];
    this.count = 1;
    this.active = 0;
    this.time = 0;
    this.dirty = true;
    this.leaving = null;   // 서빙한 컵이 오른쪽으로 밀려 나가는 중 { t }

    this.loadFelt();
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.click = (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
      this.ray.setFromCamera(this.pointer, this.camera);
      const hit = this.ray.intersectObjects(this.slots.map((s) => s.group), true).find((h) => h.object.userData.cup !== undefined);
      if (hit) this.onSelect?.(hit.object.userData.cup);
    };
    canvas.addEventListener('pointerdown', this.click);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement);
    this.resize();
    this.warmUp();
  }

  /** 셰이더 미리 데우기: 컵 부품을 모두 잠깐 보이게 하고 컴파일만 한다(입구에서 만들어 두어 첫 손님 때 멈칫하지 않게). */
  warmUp() {
    const shown = [];
    this.scene.traverse((o) => { if (o.isMesh && !o.visible) { shown.push(o); o.visible = true; } });
    const groups = this.slots.map((s) => s.group.visible);
    for (const s of this.slots) s.group.visible = true;
    this.renderer.compile(this.scene, this.camera);
    for (const o of shown) o.visible = false;
    this.slots.forEach((s, i) => { s.group.visible = groups[i]; });
    this.dirty = true;
  }

  async loadFelt() {
    const [cream, coral] = await Promise.all([loadImg('kit/felt/tex-cream.webp'), loadImg('kit/felt/tex-coral.webp')]);
    if (coral) {
      const t = new THREE.Texture(coral);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(12, 3.8); t.anisotropy = 4; t.needsUpdate = true;
      this.mat.top.map = t; this.mat.top.color.set('#ffffff'); this.mat.top.needsUpdate = true;
      const s = t.clone(); s.needsUpdate = true;
      this.mat.side.map = s; this.mat.side.color.set('#d77a6b'); this.mat.side.needsUpdate = true;
    }
    if (cream) {
      const grain = feltGrain(cream);
      const use = (m, rx, ry) => {
        const t = new THREE.CanvasTexture(grain);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(rx, ry);
        m.map = t; m.needsUpdate = true;
      };
      use(this.mat.mug, 2.4, 1.2); use(this.mat.tumbler, 2.2, 1.6); use(this.mat.coaster, 1.2, 1.2);
      use(this.mat.ice, 0.35, 0.35); use(this.mat.sugar, 0.25, 0.25);
      this.grain = grain;
      for (const s of this.slots) s.useGrain(grain);
    }
    this.warmUp();   // 펠트 결이 붙으면 재질이 다시 컴파일된다: 미리 한 번 더
  }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const W = Math.max(1, box.width), H = Math.max(1, box.height);
    this.renderer.setSize(W, H, false);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    // 컵 둘이 다 들어오게 맞춘다(컵이 하나여도 같은 자리 — 컵을 더할 때 화면이 당겨지지 않게)
    const aspect = W / H, t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = Math.max(0.74 / t, 1.22 / (t * aspect));
    const el = THREE.MathUtils.degToRad(31), target = new THREE.Vector3(0, 0.48, 0);
    this.camera.position.set(0, target.y + Math.sin(el) * dist, Math.cos(el) * dist);
    this.camera.aspect = aspect;
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    this.render(0);
  }

  /** 컵 상태를 그대로 보인다. change: 방금 누른 재료(붓기·떨어지기 움직임에 쓴다). */
  sync(cups, active, change = null) {
    this.leaving = null;
    this.count = Math.min(2, cups.length);
    this.active = active;
    const xs = SLOT_X[this.count - 1];
    this.slots.forEach((slot, i) => slot.set(i < this.count ? cups[i] : null, { x: xs[i] ?? 0, active: i === active && this.count > 0, change: i === active ? change : null }));
    if (change && ['coffee', 'tea', 'milk'].includes(change) && !this.reduced()) {
      const kind = liquidOf(cups[active]);
      if (kind) { this.pourMat.color.set(LIQUID[kind]); this.pourT = 0; }
    }
    this.dirty = true;
  }

  /** 맞게 서빙했다: 컵이 오른쪽으로 밀려 나간다(움직임 줄이기에서는 그대로 둔다). */
  served() { if (!this.reduced()) this.leaving = { t: 0 }; }

  render(dt = 0) {
    this.time += dt;
    let moving = false;
    for (const s of this.slots) moving = s.update(dt, this.time) || moving;
    if (this.leaving) {
      this.leaving.t += dt / 0.45;
      const k = ease(this.leaving.t);
      for (const s of this.slots) s.group.position.x = s.x + 3.2 * k;
      if (this.leaving.t >= 1) { for (const s of this.slots) s.group.visible = false; this.leaving = null; }
      moving = true;
    }
    if (this.pourT < 1) {
      this.pourT += dt / 0.36;
      const slot = this.slots[this.active], top = 1.55, bottom = slot.surfaceY() + 0.02;
      this.pour.visible = this.pourT < 1;
      this.pour.scale.y = top - bottom;
      this.pour.position.set(slot.group.position.x, (top + bottom) / 2, 0);
      moving = true;
    } else this.pour.visible = false;
    if (!moving && !this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerdown', this.click);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); }
    });
    this.renderer.dispose();
  }
}

/** 작업대 위 컵 하나(자리 0·1). 머그·텀블러 몸통, 받침, 음료 면, 얼음 셋, 각설탕 둘, 김 셋. */
class Cup {
  constructor(stage, index) {
    this.stage = stage;
    this.index = index;
    this.group = new THREE.Group();
    this.group.visible = false;
    stage.scene.add(this.group);
    const tag = (mesh) => { mesh.userData.cup = index; mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };

    this.coaster = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.47, COASTER_H, 48), stage.mat.coaster));
    this.coaster.position.y = COASTER_H / 2;
    this.group.add(this.coaster);
    this.body = new THREE.Group();   // 받침 위에 올라선다
    this.group.add(this.body);
    this.shapes = {};
    for (const kind of ['mug', 'tumbler']) {
      const mesh = tag(new THREE.Mesh(new THREE.LatheGeometry(profile(SHAPES[kind]), 56), stage.mat[kind]));
      this.body.add(mesh);
      this.shapes[kind] = mesh;
    }
    const handle = tag(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 14, 32, Math.PI * 1.25), stage.mat.mug));
    handle.rotation.z = -Math.PI * 0.625;
    handle.position.set(0.3, 0.31, 0);
    this.shapes.mug.add(handle);

    this.liquidMat = new THREE.MeshStandardMaterial({ color: LIQUID.coffee, roughness: 0.95 });
    this.liquid = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.liquidMat);
    this.liquid.rotation.x = -Math.PI / 2;
    this.liquid.receiveShadow = true;
    this.liquid.userData.cup = index;
    this.body.add(this.liquid);

    this.ice = ICE_AT.map(([x, z], k) => {
      const m = tag(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.15), stage.mat.ice));
      m.rotation.set(0.18 * (k - 1), 0.5 + k * 0.7, 0.1 * k);
      m.userData.home = { x, z };
      this.body.add(m);
      return m;
    });
    this.sugar = SUGAR_AT.map(([x, z], k) => {
      const m = tag(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.085), stage.mat.sugar));
      m.rotation.set(0.1, 0.6 + k, 0.08);
      m.userData.home = { x, z };
      this.body.add(m);
      return m;
    });
    this.steamMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    this.steam = this.steamMats.map((mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), mat); m.scale.set(0.8, 1.3, 0.8); this.body.add(m); return m; });

    this.cup = null;
    this.kind = 'mug';
    this.x = 0;
    this.slide = null;     // 컵 자리 옮기기 { from, to, t }
    this.level = 0;        // 음료 높이(0~1)
    this.levelTo = 0;
    this.color = new THREE.Color(LIQUID.coffee);
    this.colorTo = new THREE.Color(LIQUID.coffee);
    this.drop = { ice: 1, sugar: 1 };   // 떨어지는 중이면 0→1
  }

  useGrain(grain) {
    const t = new THREE.CanvasTexture(grain);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1.4, 1.4);
    this.liquidMat.map = t;
    this.liquidMat.needsUpdate = true;
  }

  shape() { return SHAPES[this.kind]; }
  surfaceY() { const s = this.shape(); return this.level > 0.02 ? s.floor + (s.fill - s.floor) * this.level : s.floor; }

  set(cup, { x, active, change }) {
    const was = this.cup;
    this.cup = cup;
    if (!cup) { this.group.visible = false; this.cup = null; return; }
    const reduced = this.stage.reduced();
    const appearing = !this.group.visible || !was;
    this.group.visible = true;
    this.kind = cup.temp === 'cold' ? 'tumbler' : 'mug';
    this.shapes.mug.visible = this.kind === 'mug';
    this.shapes.tumbler.visible = this.kind === 'tumbler';
    this.coaster.visible = active;
    this.body.position.y = active ? COASTER_H : 0;
    // 자리: 컵을 더하거나 빼면 미끄러지듯 옮긴다
    if (appearing || reduced) { this.x = x; this.slide = null; this.group.position.x = x; }
    else if (Math.abs(this.x - x) > 0.001) { this.slide = { from: this.group.position.x, to: x, t: 0 }; this.x = x; }
    else this.group.position.x = x;
    // 음료
    const kind = liquidOf(cup);
    this.levelTo = kind ? 1 : 0;
    if (kind) this.colorTo.set(LIQUID[kind]);
    if (reduced || appearing) { this.level = this.levelTo; if (kind) this.color.copy(this.colorTo); }
    if (kind && this.level < 0.02) this.color.copy(this.colorTo);   // 빈 컵에 처음 부으면 색은 바로
    // 얼음·설탕이 막 들어왔으면 위에서 떨어뜨린다
    if (change === 'ice' && cup.ice && !reduced) this.drop.ice = 0;
    if (change === 'sugar' && cup.sugar && !reduced) this.drop.sugar = 0;
    this.place();
  }

  place() {
    const s = this.shape(), c = this.cup;
    const y = this.surfaceY();
    this.liquid.visible = this.level > 0.02;
    this.liquid.position.y = y;
    this.liquid.scale.setScalar(Math.max(0.01, innerR(s, y)));
    this.liquidMat.color.copy(this.color);
    const lift = (d) => (d >= 1 ? 0 : 0.7 * (1 - ease(d)));
    this.ice.forEach((m, k) => {
      m.visible = !!c?.ice;
      const [x, z, layer] = ICE_AT[k];
      const r = innerR(s, y) - 0.1;
      m.position.set(Math.max(-r, Math.min(r, x)), y + 0.045 + layer * 0.11 + lift(this.drop.ice - k * 0.12), z);
    });
    this.sugar.forEach((m, k) => {
      m.visible = !!c?.sugar;
      const [x, z] = SUGAR_AT[k];
      m.position.set(x * (s.rTop / 0.34), y + 0.035 + (c?.ice ? 0.02 : 0) + lift(this.drop.sugar - k * 0.15), z);
    });
  }

  /** 한 장면 나아가기. 움직이는 것이 있으면 true. */
  update(dt, time) {
    if (!this.group.visible || !this.cup) return false;
    let moving = false;
    if (this.slide) {
      this.slide.t += dt / 0.26;
      this.group.position.x = this.slide.from + (this.slide.to - this.slide.from) * ease(this.slide.t);
      if (this.slide.t >= 1) this.slide = null;
      moving = true;
    }
    if (Math.abs(this.level - this.levelTo) > 0.001) {
      this.level += Math.sign(this.levelTo - this.level) * Math.min(Math.abs(this.levelTo - this.level), dt / 0.4);
      moving = true;
    }
    if (!this.color.equals(this.colorTo)) {
      this.color.lerp(this.colorTo, Math.min(1, dt * 8));
      const { r, g, b } = this.colorTo;
      if (Math.abs(this.color.r - r) + Math.abs(this.color.g - g) + Math.abs(this.color.b - b) < 0.004) this.color.copy(this.colorTo);
      moving = true;
    }
    for (const k of ['ice', 'sugar']) if (this.drop[k] < 1) { this.drop[k] = Math.min(1, this.drop[k] + dt / 0.42); moving = true; }
    this.place();
    // 김: 따뜻한 음료 위로 천천히 오른다(움직임 줄이기에서는 없다)
    const hot = this.cup.temp === 'hot' && this.level > 0.6 && !this.stage.reduced();
    const s = this.shape();
    this.steam.forEach((m, k) => {
      m.visible = hot;
      if (!hot) return;
      const p = (time * 0.42 + k / 3) % 1;
      m.position.set(Math.sin(time * 0.9 + k * 2.1) * 0.06 + (k - 1) * 0.07, s.h + 0.02 + p * 0.42, (k - 1) * 0.03);
      m.scale.set(0.7 + p * 0.7, 1.1 + p * 0.9, 0.7 + p * 0.7);
      this.steamMats[k].opacity = 0.5 * Math.sin(Math.PI * p);
    });
    return moving || hot;
  }
}

/** WebGL이 없을 때: 같은 작업대를 2D로 그린다(컵 모양·음료 색·얼음·설탕·고른 컵 받침). */
export class FlatStage {
  constructor(canvas, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.cups = [];
    this.active = 0;
    loadImg('kit/felt/tex-coral.webp').then((im) => { this.coral = im; this.draw(); });
    this.click = (e) => {
      const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      if (this.cups.length === 2) this.onSelect?.(x < 0.5 ? 0 : 1);
    };
    canvas.addEventListener('pointerdown', this.click);
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(canvas.parentElement);
  }
  sync(cups, active) { this.cups = cups.map((c) => ({ ...c })); this.active = active; this.draw(); }
  served() {}
  render() {}
  draw() {
    const box = this.canvas.parentElement.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!box.width || !this.ctx) return;
    const W = box.width, H = box.height, g = this.ctx;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // 작업대: 코랄 펠트 결(사진이 오기 전에는 같은 색 면)
    const top = H * 0.4;
    g.fillStyle = '#ec6f5f';
    g.fillRect(0, top, W, H - top);
    if (this.coral) {
      g.globalAlpha = 0.85;
      g.fillStyle = g.createPattern(this.coral, 'repeat');
      g.fillRect(0, top, W, H - top);
      g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(120,40,25,.18)';
    g.fillRect(0, top, W, 3);
    const n = this.cups.length, unit = Math.min(H * 0.52, W / 4), line = 'rgba(73,45,30,.25)';
    this.cups.forEach((c, i) => {
      const cx = n === 1 ? W / 2 : W / 2 + (i === 0 ? -1 : 1) * unit * 0.9, base = H * 0.74;   // 아래 컵 이름표를 비켜 선다
      const cold = c.temp === 'cold', w = unit * (cold ? 0.62 : 0.72), h = unit * (cold ? 1.05 : 0.72);
      if (i === this.active) {   // 고른 컵의 분홍 받침
        g.fillStyle = COLORS.coaster;
        g.beginPath(); g.ellipse(cx, base, w * 0.72, w * 0.16, 0, 0, Math.PI * 2); g.fill();
      }
      if (!cold) {   // 머그 손잡이
        g.beginPath(); g.arc(cx + w / 2, base - h * 0.5, h * 0.22, -Math.PI / 2, Math.PI / 2);
        g.lineWidth = w * 0.12; g.strokeStyle = COLORS.mug; g.stroke();
      }
      g.fillStyle = cold ? COLORS.tumbler : COLORS.mug;
      g.strokeStyle = line; g.lineWidth = 1.5;
      g.beginPath(); g.roundRect(cx - w / 2, base - h, w, h, [4, 4, w * 0.18, w * 0.18]); g.fill(); g.stroke();
      const kind = liquidOf(c);
      g.fillStyle = kind ? LIQUID[kind] : 'rgba(73,45,30,.12)';
      g.beginPath(); g.ellipse(cx, base - h + 6, w * 0.42, w * 0.11, 0, 0, Math.PI * 2); g.fill();
      if (c.ice) {
        g.fillStyle = COLORS.ice;
        for (const k of [-1, 0.6]) g.fillRect(cx + k * w * 0.18 - 6, base - h - 4 + Math.abs(k) * 3, 12, 11);
      }
      if (c.sugar) {
        g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(73,45,30,.2)';
        g.fillRect(cx + w * 0.12, base - h + 1, 8, 8); g.strokeRect(cx + w * 0.12, base - h + 1, 8, 8);
      }
    });
  }
  dispose() { this.observer.disconnect(); this.canvas.removeEventListener('pointerdown', this.click); }
}
