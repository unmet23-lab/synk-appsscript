// 빈칸 베기 — WORLD 캠퍼스 판의 낱말 카드(2026-11-04, 이야기 자리: 중간고사 전날 밤 도서관).
// stage.mjs가 skin으로 받는다. LAB 화면은 이 파일을 읽지 않는다(펠트 조각 그대로).
// 겉 세 안(형광펜 · 찢어 붙이기 · 종이 베기)을 영상으로 견준 뒤(qa/world-campus-20261104), 11-04 유호님 「드래그하면 찢어지는 효과음 · 타격감,
// 천천히 내려오게, 과일 자르는 게임 느낌」으로 찢어서 가르기를 정했다: 단어 카드 · 포스트잇이 그은 선을 따라 들쭉날쭉 찢겨(찢긴 가장자리에 흰 섬유)
// 두 쪽이 벌어지고, 과일 닌자의 즙 대신 그 카드 색 종이 조각이 터져 팔랑인다. 낱말 쪽지는 빈칸에 테이프로 붙는다(world-skin.css).
// 규칙 · 판정 · 손 빠르기 · 멈칫 수치(stage.mjs FEEL)는 LAB과 같다. 바뀌는 것은 재질 · 가르는 모양 · 던지기 곡선(rise · fall)뿐이다.
import * as THREE from './vendor/three.module.js';

/** 종이 색. 잉크는 늘 진한 먹색이라 색이 답을 알려 주지 않고 글자 대비도 같다(모두 7:1 넘음). */
const PAPER = [
  { name: 'card', base: '#fbf8f1', ink: '#23201c', side: '#e9e2d4', inner: '#ffffff', rule: true },    // 흰 단어 카드(위 붉은 줄 · 파란 괘선)
  { name: 'butter', base: '#ffe27a', ink: '#23201c', side: '#ecc95a', inner: '#fff7d6', sticky: true }, // 노란 포스트잇
  { name: 'mint', base: '#bfead6', ink: '#1d2a24', side: '#a4d8c0', inner: '#f1fbf6', sticky: true },
  { name: 'pink', base: '#ffcad1', ink: '#2b1f22', side: '#efafb9', inner: '#fff2f4', sticky: true },
  { name: 'grid', base: '#f4f6ef', ink: '#1f2420', side: '#dfe3d8', inner: '#ffffff', grid: true },  // 모눈 카드(하늘색 포스트잇은 스탠드 불빛 아래 회색으로 죽어 뺐다)
  { name: 'kraft', base: '#dbc29c', ink: '#2a2118', side: '#c6a87c', inner: '#f5ead6' },               // 갈색 크라프트 카드
];

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** 종이 결: 잔 얼룩 + 섬유 몇 가닥을 한 번 그려 두고 무늬로 곱한다. */
const grain = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), img = g.createImageData(160, 160);
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < img.data.length; i += 4) { const v = 214 + r() * 41; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.lineWidth = 0.7;
  for (let k = 0; k < 46; k++) {
    const x = r() * 160, y = r() * 160, a = r() * 6.28, l = 5 + r() * 12;
    g.strokeStyle = `rgba(120,105,85,${0.08 + r() * 0.12})`;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return c;
})();

/** 찢김 셰이더: 판의 제 좌표(vTearP)에서 찢김 선까지 거리를 재고, 선 따라 겹친 잡음으로 들쭉날쭉하게 민다.
 *  두 쪽은 같은 잡음(seed)을 쓰고 sign만 반대라 찢긴 두 가장자리가 서로 들어맞는다. 가장자리 띠는 흰 섬유색. */
function tearify(mat, u, { fiber = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTearP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTearP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vTearP; uniform vec4 uTear; uniform vec3 uTearT; uniform float uTearSeed; uniform vec3 uFiber;
float tearH(float x) { return fract(sin(x * 127.1 + uTearSeed * 31.7) * 43758.5453); }
float tearN(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(tearH(i), tearH(i + 1.0), f); }
float tearSd() {
  float s = dot(vTearP, uTearT);
  float j = (tearN(s * 3.0) - 0.5) * 0.09 + (tearN(s * 9.0 + 7.0) - 0.5) * 0.08 + (tearN(s * 34.0 + 3.0) - 0.5) * 0.028;
  return (dot(uTear.xyz, vTearP) + j) * uTear.w;
}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat tearD = tearSd();\nif (tearD < 0.0) discard;')
      .replace('#include <map_fragment>', fiber
        ? '#include <map_fragment>\ndiffuseColor.rgb = mix(uFiber, diffuseColor.rgb, smoothstep(0.012, 0.05, tearD + (tearN(dot(vTearP, uTearT) * 70.0) - 0.5) * 0.03));'
        : '#include <map_fragment>');
  };
  mat.customProgramCacheKey = () => (fiber ? 'blank-slice-tear' : 'blank-slice-tear-depth');
  return mat;
}
function tearUniforms(n, t, sgn, seed, fiberColor) {
  return { uTear: { value: new THREE.Vector4(n.x, n.y, n.z, sgn) }, uTearT: { value: new THREE.Vector3(t.x, t.y, t.z).normalize() },
    uTearSeed: { value: seed }, uFiber: { value: new THREE.Color(fiberColor) } };
}

/** stage.mjs가 부르는 갈래만 담는다. */
export function createSkin() {
  const white = new THREE.Color(0xfff6dc);
  return {
    palette: PAPER,
    avoid: PAPER[1],   // 연습에서 빛나는 정답 조각과 헷갈리지 않게 노란 포스트잇은 뺀다
    // 던지기 곡선(11-04 유호님 「너무 빨리 올라왔다가 바로 내려간다 — 천천히 내려오게, 과일 자르는 게임 느낌」):
    // 체공 시간 T의 0.4에 꼭대기까지 빨리 솟고, 1/4 중력으로 내려와(내림이 오름의 두 배) 꼭대기 근처에 오래 머문다. 화면에 떠 있는 시간은 T × air(1.2배).
    rise: 0.4, fall: 0.25,
    get air() { return this.rise * (1 + 1 / Math.sqrt(this.fall)); },
    push: 1.1,                      // 찢긴 두 쪽이 벌어지며 돈다
    halfG: 7,                       // 반쪽도 조금 천천히 떨어진다(조각 곡선과 같은 결)
    crumbs: 2.2,                    // 과일 닌자의 즙 대신 종이 조각이 터져 나와 팔랑인다
    noFluff: true,                  // 펠트 털 대신 종이 부스러기만
    trailGlow: '255,214,150',       // 스탠드 불빛 색(코랄 대신)
    flake: { g: 4.2, drag: 2.4, sway: 1.6, burst: 1.45 },
    flakeGeo: new THREE.PlaneGeometry(0.17, 0.12),

    /** 밤 도서관: 왼쪽 스탠드의 따뜻한 빛, 나머지는 서늘한 그늘. */
    lights({ hemi, sun, wall }) {
      hemi.color.set(0xfff4e4); hemi.groundColor.set(0xb39478); hemi.intensity = 1.3;   // 종이가 회보라로 죽지 않게 바닥 반사도 따뜻하게
      sun.color.set(0xffe6c4); sun.intensity = 1.85; sun.position.set(-7, 6, 13);
      wall.material.opacity = 0.2;
    },

    geometry(w, h) {
      const g = new THREE.ExtrudeGeometry(roundedRect(w, h, Math.min(w, h) * 0.08), {
        depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 4,
      });
      g.center();
      const pos = g.attributes.position, uv = g.attributes.uv, cap = g.groups[0];
      const W = w + 0.02, H = h + 0.02;
      for (let i = cap.start; i < cap.start + cap.count; i++) {
        const vi = g.index ? g.index.getX(i) : i;
        uv.setXY(vi, (pos.getX(vi) + W / 2) / W, (pos.getY(vi) + H / 2) / H);
      }
      uv.needsUpdate = true;
      return g;
    },

    materials(tex, color) {
      return [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0 }),
        new THREE.MeshStandardMaterial({ color: color.side, roughness: 0.95, metalness: 0 })];
    },

    /** 카드 앞면. */
    paint(g, c, { word, n, color, numbers }) {
      const W = c.width, H = c.height;
      g.fillStyle = color.base; g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.3; g.globalCompositeOperation = 'multiply';
      g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      if (color.sticky) {   // 포스트잇: 위쪽 접착 띠가 살짝 진하다
        const top = g.createLinearGradient(0, 0, 0, H * 0.24);
        top.addColorStop(0, 'rgba(60,40,10,.10)'); top.addColorStop(1, 'rgba(60,40,10,0)');
        g.fillStyle = top; g.fillRect(0, 0, W, H * 0.24);
      }
      if (color.rule) {   // 단어 카드: 위 붉은 줄 + 옅은 파란 괘선
        g.fillStyle = 'rgba(214,96,88,.5)'; g.fillRect(0, H * 0.19, W, Math.max(2, H * 0.012));
        g.fillStyle = 'rgba(110,150,210,.22)'; for (const y of [0.42, 0.64, 0.86]) g.fillRect(0, H * y, W, Math.max(1.5, H * 0.008));
      }
      if (color.grid) {   // 모눈: 옅은 초록 칸
        const step = H / 7; g.fillStyle = 'rgba(70,140,110,.16)';
        for (let x = step / 2; x < W; x += step) g.fillRect(x, 0, Math.max(1, H * 0.006), H);
        for (let y = step / 2; y < H; y += step) g.fillRect(0, y, W, Math.max(1, H * 0.006));
      }
      const lit = g.createLinearGradient(0, 0, W, H);   // 왼쪽 위 스탠드 쪽이 밝다
      lit.addColorStop(0, 'rgba(255,244,220,.16)'); lit.addColorStop(1, 'rgba(30,18,6,.10)');
      g.fillStyle = lit; g.fillRect(0, 0, W, H);
      if (word) {
        const fs = Math.round(H * 0.42);
        g.font = `800 ${fs}px SUIT, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color.ink;
        g.fillText(word, W / 2, H * 0.55);
      }
      if (numbers) {   // 키보드 번호(넓은 화면)
        const r = H * 0.14, cx = r * 1.3, cy = r * 1.3;
        g.fillStyle = 'rgba(35,32,28,.82)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fbf8f1'; g.font = `700 ${Math.round(r * 1.2)}px "DM Mono", SUIT, monospace`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), cx, cy + 1);
      }
    },

    /** 찢긴 한쪽(sgn ±1)의 재질 — 앞면 · 옆면 · 속 · 그림자. n · t는 판의 제 좌표계의 찢김 선 법선 · 방향. */
    tearHalf(p, sgn, n, t, flash) {
      const u = tearUniforms(n, t, sgn, p.seed, p.color.inner);
      const mats = p.mesh.material.map((m) => {
        const c2 = m.clone(); c2.transparent = true; c2.emissive = white.clone(); c2.emissiveIntensity = flash;
        return tearify(c2, u);
      });
      const inner = tearify(new THREE.MeshStandardMaterial({ color: p.color.inner, side: THREE.BackSide, roughness: 1, transparent: true,
        emissive: white.clone(), emissiveIntensity: flash }), u);
      const depth = tearify(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), u, { fiber: false });
      return { mats, inner, depth };
    },

    /** 미리 굽기: 찢김 셰이더(앞 · 옆 · 속 · 그림자)를 화면 밖 1픽셀에 한 번 그려 둔다(첫 베기에서 컴파일로 멈추지 않게). */
    warm(keep, piece) {
      const p = { mesh: piece.mesh, seed: 1, color: PAPER[2] };
      const { mats, inner, depth } = this.tearHalf(p, 1, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), 0);
      const a = new THREE.Mesh(piece.geo, mats); a.customDepthMaterial = depth;   // 그림자 켜기는 stage.mjs warmUp이 두 번째 그리기에서(첫 그리기는 빛 정보가 없어 다른 셰이더가 된다)
      keep.add(a, new THREE.Mesh(piece.geo, inner));
      return a;
    },
  };
}
