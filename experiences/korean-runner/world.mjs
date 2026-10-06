// 바람길 — 3D 펠트 길과 마을(Three.js r180).
// 크림 펠트 땅 위로 모래빛 펠트 길(세 칸)과 코랄 펠트 연석이 뒤로 이어지고, 길가에는 펠트 덤불·나무·집이 선다. 먼 곳은 판 뒤의 크림 펠트 벽
// (kit .arena) 색의 안개로 녹아든다. 모든 면은 kit/felt의 실제 펠트 사진(tex-cream·tex-coral)을 곱해 그린다 — 납작한 색을 그대로 내지 않는다.
// 움직임은 course-motion.mjs 한 기준을 따른다: 몽글은 -Z(길 앞)를 보고, 길·풍경·표시선은 달린 만큼 +Z로 지나간다.
// 카메라는 화면 크기가 바뀔 때만 자리를 잡고 그 뒤로 움직이지 않는다(흔들기·따라가기·기울이기 없음 — 멀미).
// 몽글은 게임에 필요한 움직임만 한다: 옆 길로 옮기기(그쪽으로 잠깐 돌아봄)·뛰기·숙이기. 출렁임·찌그러짐·흔들림을 더하지 않는다.
import * as T from './vendor/three.module.js';
import { LANES } from './core.mjs';
import { loopedWorldZ, eventWorldZ, runnerYaw, forwardForYaw, groundOffset, texelWorldZ, SCENERY_RECYCLE_Z } from './course-motion.mjs';
import { sceneryLayout, TILE, TILES, LOOP, VIEW, PALETTE, SIGNS } from './scenery.mjs';

const FELT = 'kit/felt/';
// 판 뒤 크림 펠트 벽(kit .arena)의 지평선 언저리 색. 먼 길과 마을이 이 색으로 녹아 벽과 이어진다.
export const FOG_COLOR = 0xf1e8de;
const GROUND = Object.freeze({ width: 150, length: 190, centerZ: -78, meters: 2.6 });   // 크림 땅: Z +17 ~ −173
const PATH = Object.freeze({ half: 3.7, meters: 7.4 });                                 // 모래빛 길(폭 7.4m), 펠트 한 장이 7.4m를 덮는다
const CURB = Object.freeze({ width: 0.36, height: 0.13, meters: 2.2 });
const GRAIN_METERS = 1.6;   // 마을 물건에 깔리는 펠트 결 한 장의 크기
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const color = (hex) => new T.Color(hex);

/** 여러 기하를 하나로(정점 색 + 펠트 결 상자 투영 UV). 칸 하나·장애물 하나가 그리기 한 번이 된다. */
function mergeParts(parts) {
  let nv = 0, ni = 0;
  for (const { geo } of parts) { nv += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
  const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
  let vo = 0, io = 0;
  for (const { geo, tint, uvMode } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal, own = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i), k = vo + i;
      pos.set([x, y, z], k * 3); nor.set([nx, ny, nz], k * 3); col.set([tint.r, tint.g, tint.b], k * 3);
      if (uvMode === 'own' && own) uv.set([own.getX(i), own.getY(i)], k * 2);
      else {
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
        uv.set([u / GRAIN_METERS, v / GRAIN_METERS], k * 2);
      }
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) idx[io + i] = geo.index.getX(i) + vo;
    else for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
    io += geo.index ? geo.index.count : p.count; vo += p.count;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3));
  g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.setIndex(new T.BufferAttribute(idx, 1)); g.computeBoundingSphere();
  return g;
}

export async function createWorld(canvas, { reduced = () => false } = {}) {
  await document.fonts?.load?.('800 64px SUIT').catch(() => {});
  const [creamImg, coralImg, badgeImg] = await Promise.all(['tex-cream', 'tex-coral', 'badge-cream'].map((n) => loadImg(`${FELT}${n}.webp`)));

  // WebGL을 만들 수 없으면 여기서 오류가 난다. 부른 쪽(app.mjs)이 안내하고 입구로 돌아간다
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new T.Scene();
  scene.fog = new T.Fog(FOG_COLOR, VIEW.fogNear, VIEW.fogFar);
  const camera = new T.PerspectiveCamera(50, 1, 0.1, 400);

  // 빛: 부드러운 하늘빛 + 왼쪽 위 뒤에서 오는 햇빛 하나(그림자는 몽글 앞쪽으로 길게 눕는다). 반들거림 없음(거칠기 1)
  scene.add(new T.HemisphereLight(0xfffaf3, 0xe4d2bc, 1.75));
  const sun = new T.DirectionalLight(0xfff4e4, 2.55);
  sun.position.set(-13, 15, 5); sun.target.position.set(0, 0, -6);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 26, bottom: -20, near: 1, far: 70 });
  sun.shadow.radius = 4; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const feltTex = (img, rx = 1, ry = 1) => {
    const t = new T.Texture(img || undefined); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx, ry); t.anisotropy = aniso; t.needsUpdate = !!img; return t;
  };
  const canvasTex = (w, h, paint) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = aniso; return t;
  };
  const tile = (g, img, w, h, size) => { if (!img) return; for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) g.drawImage(img, x, y, size, size); };
  // 코랄 펠트 결: 키트의 코랄 머리 면처럼 사진 위에 같은 코랄을 옅게 덮는다(사진 그대로는 3D 빛에서 너무 붉게 보였다)
  const coralFelt = (rx, ry) => { const t = canvasTex(256, 256, (g, w, h) => { if (coralImg) g.drawImage(coralImg, 0, 0, w, h); else { g.fillStyle = '#f96859'; g.fillRect(0, 0, w, h); } g.fillStyle = 'rgba(252,132,116,.42)'; g.fillRect(0, 0, w, h); });
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); return t; };

  // ── 바닥: 크림 펠트 땅 · 모래빛 펠트 길(가운데 두 줄은 크림 펠트 점선) · 코랄 펠트 연석. 결을 옮겨 흐르게 한다 ──
  const groundTex = feltTex(creamImg, GROUND.width / GROUND.meters, GROUND.length / GROUND.meters);
  const ground = new T.Mesh(new T.PlaneGeometry(GROUND.width, GROUND.length), new T.MeshStandardMaterial({ map: groundTex, color: 0xfffdf8, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.03, GROUND.centerZ); ground.receiveShadow = true; scene.add(ground);

  const pathTex = canvasTex(512, 512, (g, w, h) => {
    tile(g, creamImg, w, h, w / 3);                                     // 펠트 한 장 ≈ 2.5m
    g.globalCompositeOperation = 'multiply'; g.fillStyle = '#f0dcbb'; g.fillRect(0, 0, w, h);   // 모래빛
    g.globalCompositeOperation = 'source-over';
    const px = w / (PATH.half * 2);
    for (const lx of [-1.175, 1.175]) {                                 // 칸 사이 크림 점선(2.2m 줄 + 1.5m 틈)
      const x = w / 2 + lx * px;
      for (let k = 0; k < 2; k++) {
        const y0 = k * h / 2, y1 = y0 + h / 2 * (2.2 / 3.7);
        g.save(); g.beginPath(); g.roundRect(x - 4.5, y0, 9, y1 - y0, 4.5); g.clip();
        tile(g, creamImg, w, h, w / 3); g.fillStyle = 'rgba(255,251,242,.55)'; g.fillRect(0, 0, w, h); g.restore();
      }
    }
    const edge = g.createLinearGradient(0, 0, w, 0);                     // 연석 쪽 가장자리를 살짝 어둡게(길이 깊어 보이게)
    edge.addColorStop(0, 'rgba(150,110,70,.18)'); edge.addColorStop(0.06, 'rgba(150,110,70,0)'); edge.addColorStop(0.94, 'rgba(150,110,70,0)'); edge.addColorStop(1, 'rgba(150,110,70,.18)');
    g.fillStyle = edge; g.fillRect(0, 0, w, h);
  });
  pathTex.wrapS = pathTex.wrapT = T.RepeatWrapping; pathTex.repeat.set(1, GROUND.length / PATH.meters);
  const path = new T.Mesh(new T.PlaneGeometry(PATH.half * 2, GROUND.length), new T.MeshStandardMaterial({ map: pathTex, roughness: 1 }));
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0, GROUND.centerZ); path.receiveShadow = true; scene.add(path);

  // 연석: 윗면과 길 쪽 옆면(둘 다 v가 -Z로 커지게 눕혀 같은 결 흐름을 쓴다)
  const curbTex = coralFelt(1, GROUND.length / CURB.meters);
  const curbMat = new T.MeshStandardMaterial({ map: curbTex, roughness: 1 });
  for (const side of [-1, 1]) {
    const top = new T.PlaneGeometry(CURB.width, GROUND.length); top.rotateX(-Math.PI / 2); top.translate(side * (PATH.half + CURB.width / 2), CURB.height, 0);
    const face = new T.PlaneGeometry(CURB.height, GROUND.length); face.rotateX(-Math.PI / 2); face.rotateZ(side > 0 ? Math.PI / 2 : -Math.PI / 2);   // 길 가운데를 본다
    face.translate(side * PATH.half, CURB.height / 2, 0);
    for (const g of [top, face]) { const m = new T.Mesh(g, curbMat); m.position.z = GROUND.centerZ; m.receiveShadow = true; m.castShadow = false; scene.add(m); }
  }

  // ── 마을: 칸마다 한 덩어리(크림 펠트 결 × 정점 색) + 간판 한 덩어리 ──
  const grain = feltTex(creamImg);
  const feltMat = new T.MeshStandardMaterial({ map: grain, vertexColors: true, roughness: 1, metalness: 0 });
  const unit = (() => {
    const tri = new T.Shape([new T.Vector2(-0.5, 0), new T.Vector2(0.5, 0), new T.Vector2(0, 1)]);
    const prism = new T.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false }); prism.translate(0, 0, -0.5);
    return { ball: new T.SphereGeometry(1, 16, 11), bead: new T.SphereGeometry(1, 8, 6), box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(1, 1, 1, 12), prism, sign: new T.PlaneGeometry(1, 1) };
  })();
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v3 = new T.Vector3(), s3 = new T.Vector3();
  const placed = (kind, p, s, ry = 0, rz = 0) => {
    const g = unit[kind === 'ball' && Math.max(...s) < 0.25 ? 'bead' : kind].clone();   // 작은 꽃·손잡이는 낮은 면 수
    g.applyMatrix4(m4.compose(v3.set(...p), q.setFromEuler(e.set(0, ry, rz)), s3.set(...s))); return g;
  };
  const signTex = canvasTex(512, 512, (g, w, h) => {
    tile(g, creamImg, w, h, 128);
    g.fillStyle = 'rgba(255,250,240,.35)'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5b3a2c'; g.font = '800 82px SUIT, "Apple SD Gothic Neo", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    SIGNS.forEach((word, i) => g.fillText(word, w / 2, i * 128 + 66, w - 40));
  });
  const signMat = new T.MeshStandardMaterial({ map: signTex, roughness: 1 });
  const layout = sceneryLayout();
  const tiles = [];
  for (let t = 0; t < TILES; t++) {
    const group = new T.Group(); group.name = `scenery-tile-${t}`; group.userData.base = t * TILE; scene.add(group);
    const parts = [], signs = [];
    for (const item of layout.filter((x) => x.tile === t)) {
      if (item.kind === 'sign') {
        const g = placed('sign', item.p, [item.s[0], item.s[1], 1], item.ry), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (item.sign + 1 - uv.getY(i)) / SIGNS.length);   // 간판 줄(위에서 sign번째)
        signs.push({ geo: g, tint: color(0xffffff), uvMode: 'own' });
      } else parts.push({ geo: placed(item.kind, item.p, item.s, item.ry), tint: color(item.color) });
    }
    const body = new T.Mesh(mergeParts(parts), feltMat); body.castShadow = true; body.receiveShadow = true; group.add(body);
    if (signs.length) { const board = new T.Mesh(mergeParts(signs), signMat); board.receiveShadow = true; group.add(board); }
    parts.forEach((x) => x.geo.dispose()); signs.forEach((x) => x.geo.dispose());
    tiles.push(group);
  }
  // 먼 언덕: 마을 뒤로 낮게 겹친 펠트 언덕(움직이지 않는 배경, 안개가 벽 색으로 녹인다)
  {
    const parts = [];
    const hills = [[-62, -92, 30, 9, 0], [-22, -118, 34, 11, 1], [26, -104, 36, 10, 2], [70, -96, 32, 12, 0], [-104, -112, 36, 13, 2], [110, -118, 40, 12, 1], [0, -140, 46, 14, 0]];
    const tints = [0xb9d79c, 0xf7cfc3, 0xd9e8c6];
    for (const [x, z, r, h, c] of hills) parts.push({ geo: placed('ball', [x, -1, z], [r, h, r * 0.55]), tint: color(tints[c]) });
    const far = new T.Mesh(mergeParts(parts), feltMat); far.name = 'far-hills'; scene.add(far);
  }

  // ── 몽글: 팔 없는 종 모양·물결 밑단(이전 바람길 몽글 형상), 코랄 펠트 + 크림 밑단 + 검은 구슬 눈 ──
  const player = new T.Group(), body = new T.Group(); player.add(body); scene.add(player); player.position.z = VIEW.playerZ;
  const mongleMat = new T.MeshStandardMaterial({ map: coralFelt(2, 1.4), roughness: 1, transparent: true });
  {
    const p = [], uv = [], idx = [], rings = 28, segments = 56, height = 1.38;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, y = height * (1 - t), radius = 0.697 * Math.pow(Math.sin(t * Math.PI / 2), 0.45) * (1 - 0.035 * Math.pow(t, 8));
      for (let i = 0; i <= segments; i++) {
        const a = i / segments * Math.PI * 2, lobe = Math.cos(a * 7), rim = Math.pow(t, 8), r = radius * (1 + rim * lobe * 0.07);   // 물결 밑단(브랜드 몽글처럼 뒤에서도 보이게)
        p.push(Math.cos(a) * r, y + rim * (0.06 + 0.05 * lobe), Math.sin(a) * r * 0.88); uv.push(i / segments, t);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) { const a = j * (segments + 1) + i, b = a + segments + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const shell = new T.Mesh(geo, mongleMat); shell.castShadow = true; body.add(shell);
    const eye = new T.MeshStandardMaterial({ color: 0x241c1f, roughness: 0.35 }), shine = new T.MeshBasicMaterial({ color: 0xffffff });
    for (const side of [-1, 1]) {
      const ball = new T.Mesh(unit.ball, eye); ball.position.set(side * 0.231, 0.911, 0.409); ball.scale.set(0.069, 0.073, 0.048); body.add(ball);
      const dot = new T.Mesh(unit.ball, shine); dot.position.set(side * 0.231 - 0.018, 0.931, 0.452); dot.scale.set(0.0125, 0.0125, 0.008); body.add(dot);
    }
    const hem = []; for (let i = 0; i <= 112; i++) { const a = i / 112 * Math.PI * 2, lobe = Math.cos(a * 7), r = 0.68 * (1 + lobe * 0.07); hem.push(new T.Vector3(Math.cos(a) * r, 0.085 + 0.05 * lobe, Math.sin(a) * r * 0.88)); }
    body.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hem, true), 112, 0.02, 6, true), new T.MeshStandardMaterial({ color: 0xfff3dd, roughness: 1 })));
  }
  const shadowTex = canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, 62); r.addColorStop(0, 'rgba(92,60,40,.36)'); r.addColorStop(0.55, 'rgba(92,60,40,.16)'); r.addColorStop(1, 'rgba(92,60,40,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const contact = new T.Mesh(new T.PlaneGeometry(2.0, 1.6), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, fog: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.set(0, 0.012, VIEW.playerZ); scene.add(contact);
  const shield = new T.Mesh(new T.SphereGeometry(1, 32, 20), new T.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.85, transparent: true, opacity: 0.24, depthWrite: false }));
  shield.scale.set(1.02, 1.04, 1.02); shield.position.y = 0.68; shield.visible = false; player.add(shield);

  // ── 지나가는 것: 울타리·표지판·전차·표시선(문 모양 등불 줄). 모양은 한 번 만들어 같이 쓴다 ──
  const P = PALETTE;
  const kit = (list) => mergeParts(list.map(([kind, c, p, s, ry = 0, rz = 0]) => ({ geo: placed(kind, p, s, ry, rz), tint: color(c) })));
  const shapes = {
    barrier: kit([['box', P.wood, [-0.74, 0.52, 0], [0.15, 1.04, 0.18]], ['box', P.wood, [0.74, 0.52, 0], [0.15, 1.04, 0.18]],
      ['box', 0xeab23c, [0, 0.84, 0], [1.64, 0.16, 0.16]], ['box', 0xeab23c, [0, 0.42, 0], [1.64, 0.14, 0.16]],
      ...[-0.52, -0.26, 0, 0.26, 0.52].map((x) => ['box', P.butter, [x, 0.6, 0.06], [0.17, 0.92, 0.08]]),
      ...[-0.52, -0.26, 0, 0.26, 0.52].map((x) => ['ball', P.butter, [x, 1.06, 0.06], [0.085, 0.07, 0.04]])]),
    arch: kit([['box', P.wood, [-0.82, 1.17, 0], [0.14, 2.34, 0.2]], ['box', P.wood, [0.82, 1.17, 0], [0.14, 2.34, 0.2]],
      ['box', P.lapis, [0, 1.63, 0], [1.92, 0.62, 0.26]], ['ball', P.butter, [-0.82, 2.4, 0], [0.13, 0.11, 0.13]], ['ball', P.butter, [0.82, 2.4, 0], [0.13, 0.11, 0.13]]]),
    tram: kit([['box', 0x8fc07a, [0, 1.12, 0], [1.66, 1.9, 2.8]], ['box', P.coral, [0, 2.17, 0], [1.78, 0.2, 2.95]],
      ['box', P.cream, [0, 1.5, 1.41], [1.32, 0.62, 0.04]], ['box', P.cream, [0.84, 1.5, 0], [0.04, 0.6, 2.2]], ['box', P.cream, [-0.84, 1.5, 0], [0.04, 0.6, 2.2]],
      ['box', 0xe9dcc6, [0, 0.66, 1.42], [1.6, 0.14, 0.05]], ['ball', P.butter, [-0.52, 0.86, 1.43], [0.11, 0.09, 0.05]], ['ball', P.butter, [0.52, 0.86, 1.43], [0.11, 0.09, 0.05]],
      ...[-0.86, 0.86].flatMap((x) => [-0.9, 0.9].map((z) => ['cyl', P.woodDark, [x, 0.24, z], [0.24, 0.12, 0.24], 0, Math.PI / 2]))]),
    gate: kit([['box', P.cream, [0, 0.025, 0], [PATH.half * 2, 0.04, 0.42]],
      ['cyl', P.wood, [-4.32, 3.2, 0], [0.1, 6.4, 0.1]], ['cyl', P.wood, [4.32, 3.2, 0], [0.1, 6.4, 0.1]],
      ['ball', P.coral, [-4.32, 6.44, 0], [0.16, 0.14, 0.16]], ['ball', P.coral, [4.32, 6.44, 0], [0.16, 0.14, 0.16]],
      ['box', P.woodDark, [0, 6.22, 0], [8.64, 0.07, 0.07]],
      ...LANES.flatMap((x) => [['box', P.woodDark, [x, 6.06, 0], [0.025, 0.3, 0.025]], ['cyl', P.coral, [x, 5.92, 0], [0.17, 0.12, 0.17]], ['cyl', P.coral, [x, 5.28, 0], [0.12, 0.08, 0.12]]])]),
    lanterns: mergeParts(LANES.map((x) => ({ geo: placed('ball', [x, 5.6, 0], [0.3, 0.33, 0.3]), tint: color(0xffffff) }))),
  };
  const badgeMats = Object.fromEntries(['↑', '↓'].map((glyph) => [glyph, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(128, 128, (g, w, h) => {
    if (badgeImg) g.drawImage(badgeImg, 4, 4, w - 8, h - 8); else { g.fillStyle = '#fbf3e6'; g.beginPath(); g.arc(w / 2, h / 2, 58, 0, 7); g.fill(); }
    g.fillStyle = '#7a3a26'; g.font = '900 78px SUIT, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, w / 2 - 2, h / 2 - 2);
  }) })]));
  const badgeGeo = new T.PlaneGeometry(0.48, 0.48);
  const lanternBase = new T.MeshStandardMaterial({ map: grain, color: 0xffe6a0, roughness: 1, emissive: 0xffb54a, emissiveIntensity: 0 });

  function makeEvent(e) {
    const g = new T.Group();
    if (e.kind === 'mark') {
      const gate = new T.Mesh(shapes.gate, feltMat); gate.castShadow = true; gate.receiveShadow = true; g.add(gate);
      const lamps = new T.Mesh(shapes.lanterns, lanternBase.clone()); lamps.castShadow = true; g.add(lamps);
      g.userData.lamps = lamps.material;
    } else {
      const m = new T.Mesh(shapes[e.type] || shapes.tram, feltMat); m.castShadow = true; m.receiveShadow = true; g.add(m);
      if (!e.mission && (e.type === 'barrier' || e.type === 'arch')) {   // 부탁이 아닌 장애물에만 할 일 배지(부탁은 귀로 듣는다)
        const b = new T.Mesh(badgeGeo, badgeMats[e.type === 'barrier' ? '↑' : '↓']); b.position.set(0, e.type === 'barrier' ? 0.62 : 1.64, e.type === 'barrier' ? 0.13 : 0.15); g.add(b);
      }
    }
    return g;
  }
  const objects = new Map();   // 사건 → 그룹
  function dropEvent(e, g) { scene.remove(g); if (g.userData.lamps) g.userData.lamps.dispose(); objects.delete(e); }
  function syncEvents(model, dt) {
    const keep = new Set();
    for (const e of model?.events || []) {
      if (e.kind === 'coin') continue;   // 별 줍기는 없다(보상은 공통 코인 하나)
      const ahead = e.d - model.distance;
      if (ahead > 175 || ahead < -14) continue;
      keep.add(e);
      let g = objects.get(e);
      if (!g) { g = makeEvent(e); scene.add(g); objects.set(e, g); }
      g.position.set(e.kind === 'mark' ? 0 : LANES[e.lane], 0, eventWorldZ(e.d, model.distance, VIEW.playerZ));
      if (g.userData.knock != null) {   // 부딪힌 장애물은 0.3초 동안 작아지며 비켜 준다(카메라는 흔들지 않는다)
        g.userData.knock = Math.min(1, g.userData.knock + dt / 0.3);
        g.scale.setScalar(Math.max(0.001, 1 - g.userData.knock));
      }
      if (g.userData.lamps) g.userData.lamps.emissiveIntensity = g.userData.lit ? 0.95 : 0;
    }
    for (const [e, g] of objects) if (!keep.has(e)) dropEvent(e, g);
  }

  // ── 카메라: 화면 비율에 맞춰 한 번 자리를 잡는다. 세로 화면은 길 세 칸이 폭에 들도록 뒤로 물러난다 ──
  let W = 1, H = 1;
  const focus = new T.Vector3(0, 0.85, VIEW.playerZ);
  function frame() {
    const aspect = W / H, portrait = aspect < 1;
    const vfov = portrait ? 58 : 44, tanV = Math.tan(vfov * Math.PI / 360), tanH = tanV * aspect;
    const pitch = (portrait ? 27.5 : 26) * Math.PI / 180;
    const depth = portrait ? Math.min(11.4, Math.max(8.8, 4.0 / tanH)) : 10.6;
    camera.fov = vfov; camera.aspect = aspect;
    camera.position.set(0, focus.y + depth * Math.sin(pitch), focus.z + depth * Math.cos(pitch));
    camera.lookAt(focus);
    // 몽글을 화면 아래쪽에 둔다: 카메라를 기울이지 않고 화면 창만 옮긴다(렌즈 옮기기)
    const want = portrait ? 0.79 : 0.74;
    camera.setViewOffset(W, H, 0, -(want - 0.5) * H, W, H);
    camera.updateProjectionMatrix();
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    sun.shadow.mapSize.set(W * dpr > 1400 ? 2048 : 1024, W * dpr > 1400 ? 2048 : 1024);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    frame();
  }
  const project = (x, y, z) => { const p = new T.Vector3(x, y, z).project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; };

  let distance = 0, frames = 0, lastYaw = Math.PI;
  function place(d) {
    distance = d;
    groundTex.offset.y = groundOffset(d, GROUND.meters);
    pathTex.offset.y = groundOffset(d, PATH.meters);
    curbTex.offset.y = groundOffset(d, CURB.meters);
    for (const g of tiles) g.position.z = loopedWorldZ(g.userData.base, d, LOOP, SCENERY_RECYCLE_Z);
  }
  place(0);

  function render(dt, model) {
    frames += 1;
    place(model ? model.distance : distance);
    syncEvents(model, dt);
    const x = model ? model.x : 0, y = model ? model.y : 0, slide = model ? model.slide > 0 && model.y < 0.15 : false;
    player.position.set(x, y + 0.004, VIEW.playerZ);
    lastYaw = runnerYaw(model ? LANES[model.lane] - model.x : 0);
    body.rotation.set(0, lastYaw, 0);
    body.scale.set(slide ? 1.16 : 1, slide ? 0.5 : 1, slide ? 1.16 : 1);   // 숙이기: 몸을 낮춘다(표지판 아래로 지나가는 동작 그 자체)
    mongleMat.opacity = model && model.invincible > 0 ? 0.5 : 1;          // 부딪힌 뒤 잠깐: 깜빡이지 않고 옅게만
    shield.visible = !!model && model.shield > 0;
    contact.position.x = x; contact.material.opacity = 1 - Math.min(0.7, y * 0.32); contact.scale.setScalar(1 + y * 0.12);
    renderer.render(scene, camera);
  }

  const ro = new ResizeObserver(resize); ro.observe(canvas);
  resize();
  // 셰이더를 미리 데운다(첫 장면에서 화면이 굳지 않게)
  renderer.compile(scene, camera);

  return {
    render, resize, project,
    /** 몽글 머리 위(점수 글자 자리)의 화면 좌표 */
    runnerScreen: (model) => project(model ? model.x : 0, (model ? model.y : 0) + 1.75, VIEW.playerZ),
    /** 표시선 하나를 지나며 해낸 동작: 그 문의 등불을 켠다 */
    light(step) { for (const [e, g] of objects) if (e.kind === 'mark' && e.step === step) g.userData.lit = true; },
    /** 부딪힌 장애물: 몽글 칸에서 막 지난 것 */
    knock(model) {
      let best = null, gap = Infinity;
      for (const [e, g] of objects) if (e.kind === 'obstacle' && Math.abs(LANES[e.lane] - model.x) < 0.9 && Math.abs(e.d - model.distance) < gap) { gap = Math.abs(e.d - model.distance); best = g; }
      if (best && gap < 3) best.userData.knock = 0;
    },
    clear() { for (const [e, g] of objects) dropEvent(e, g); place(0); },
    /** 확인용(?qa): 흐름 표본 — 길 결·풍경 칸·사건이 같은 거리만큼 +Z로 왔는지, 몽글이 어디를 보는지 */
    motion(model) {
      const sample = 0.37, road = { repeat: pathTex.repeat.y, length: GROUND.length, centerZ: GROUND.centerZ };
      const ev = model?.events.find((x) => x.kind !== 'coin' && objects.has(x));
      return { distance, roadOffset: pathTex.offset.y, roadTexelZ: texelWorldZ(sample, pathTex.offset.y, road), roadMeters: PATH.meters,
        sceneryZ: tiles.map((g) => g.position.z), loop: LOOP, event: ev ? { d: ev.d, z: objects.get(ev).position.z } : null,
        yaw: lastYaw, forward: forwardForYaw(lastYaw), camera: camera.position.toArray(), playerZ: VIEW.playerZ };
    },
    /** 확인용(?qa): 지금 장면을 그려 격자 픽셀을 읽는다(그림이 실제로 나오는지) */
    sample(model) {
      render(0, model);
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4), colors = new Set();
      let drawn = 0, n = 0;
      for (let j = 1; j < 12; j++) for (let i = 1; i < 12; i++) {
        gl.readPixels(Math.floor(w * i / 12), Math.floor(h * j / 12), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); n += 1;
        if (px[3] > 0) drawn += 1; colors.add(`${px[0] >> 3},${px[1] >> 3},${px[2] >> 3}`);
      }
      return { drawn, n, colors: colors.size, width: w, height: h };
    },
    get info() { return { renderer: `Three.js ${T.REVISION}`, frames, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, events: objects.size, width: W, height: H }; },
    destroy() { ro.disconnect(); renderer.dispose(); },
  };
}
