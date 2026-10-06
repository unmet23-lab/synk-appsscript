// 말 랠리 — 3D 탁구대(Three.js). 몽글이 친 공이 내 쪽으로 오고, 고른 대답 칸(1·2·3) 쪽으로 받아친다.
// 공은 고를 때까지 기다려 준다(10-03): 아직 고르지 않았으면 라켓 바로 앞에서 부드럽게 느려져 멈추고, 고르면(release) 남은 길을 단숨에 와서 받아친다.
// 카메라는 움직이지 않는다(흔들기·기울이기·확대 없음 — 멀미). 몽글 그림도 움직이지 않고 표정 그림만 바뀐다.
// 타격감은 멈칫(히트스톱), 맞는 순간 번쩍임, 반짝이, 대답 칸 빛, 스매시의 느린 화면으로 낸다. 소리·진동은 app.mjs가 같은 순간에 낸다.
// 2026-10-07: 몽글 뒤 펠트 벽(WALL — 화면 비율마다 맞추고 움직이지 않음), 꾸미기 색의 펠트 라켓 판·공·공 꼬리(setGear).
import * as THREE from './vendor/three.module.js';

/** 손맛 수치(ms). */
export const FEEL = {
  stop: { ok: 80, smash: 120, wrong: 50 },   // 히트스톱: 라켓에 공이 맞는 순간 세상이 멈칫하는 시간
  slowMs: 480, slowMin: 0.3,                  // 스매시 뒤 느린 화면: 0.3배에서 제 속도로 돌아온다
  returnSec: 0.62, smashSec: 0.42,            // 받아친 공이 대답 칸에 닿기까지
  holdFrom: 0.6, holdAt: 0.9,                 // 고르기 전이면 내 쪽 마지막 토막의 60%부터 느려져 90%(라켓 바로 앞)에서 멈춰 기다린다
  snapSec: 0.16,                              // 기다리던 공을 고르면 남은 길을 이 시간 안에 와서 받아친다
};

// 탁구대(가로 1.525 × 세로 2.74, 높이 0)와 자리. 내 쪽이 +z, 몽글 쪽이 -z다.
const TABLE = { w: 1.525, l: 2.74 };
export const LANES = [-0.46, 0, 0.46];           // 대답 칸 1·2·3의 x
const PAD_Z = -0.82, HIT = { y: 0.24, z: 1.46 }, OPP = { y: 0.3, z: -1.52 };
const PAD_COLORS = [   // 대답 칸·카드의 펠트 색(자리마다 같다 — 색으로 정답이 드러나지 않게 보기를 섞는다)
  { base: '#f0cbbc', ink: '#7a2e20', glow: 0xffc6b5 },   // 1 분홍 펠트(대답 카드의 쿠션 판과 같은 색)
  { base: '#f2be3e', ink: '#3a2a08', glow: 0xffe08a },   // 2 버터 펠트
  { base: '#2d5ab8', ink: '#fffaf2', glow: 0x9db8ff },   // 3 라피스 펠트
];
const FACES = { idle: 'mongle-curious', talk: 'mongle-focus', happy: 'mongle-cheer', calm: 'mongle-smile' };
/**
 * 배경 벽(2026-10-07): 바닥이 끝나는 곳(몽글 바로 뒤)에 선 펠트 벽. 그림(assets/scene/rally-wall.webp, 3:2)은 위에서부터
 * 가랜드(~16%), 창문 둘이 있는 크림 벽, 버터 띠(73.4~76.2%), 라피스 징두리(아래 ~24%)다. 화면 비율마다 resize에서 맞춘다(fitWall):
 * 그림 아래 끝을 바닥 선에 세우고, 그림 높이는 보이는 벽 높이(바닥 선 ~ 화면 위)에 맞추되 가랜드가 몽글 머리 위로 비키게 키운다.
 * 버터 띠는 몽글의 파란 라켓보다 14px 아래에 둔다(라피스 징두리 뒤에서 라켓이 묻히지 않게 — 넘치는 비율에서만 그림 전체를 내린다).
 * 넓은 화면에서 그림 양옆은 그림 가운데의 빈 벽 띠(창문·가랜드 없는 512px)를 거울로 이어 붙인 민 벽으로 채운다. 움직이지 않는다.
 */
export const WALL_SRC = 'assets/scene/rally-wall.webp';
const WALL = { src: WALL_SRC, z: -2.3, aspect: 1536 / 1024, trimTop: 0.734, buntingBottom: 0.16, floorY: -0.76,
  strip: { x: 512, w: 512, cleanFrom: 185 }, tint: 0xf1ece5, racketGap: 14, mongleGap: 8 };
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
function star4(g, x, y, r, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.34 : r, a = (i / 8) * Math.PI * 2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.restore();
}

/** 포물선 한 토막: a에서 b로, 가운데가 apex만큼 높다. */
function arc(a, b, apex, k) {
  return new THREE.Vector3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + 4 * apex * k * (1 - k), a.z + (b.z - a.z) * k);
}

export async function createStage({ host, overlay, onBounce, onOpponentHit, onHold, onArrive, onPadLanded, onCaught, onMissed, reducedMotion = () => false }) {
  await document.fonts?.load?.('900 80px SUIT').catch(() => {});
  // 벽 그림도 같이 받는다 — 무대의 첫 장면부터 벽이 있게(받지 못하면 벽 없이 원래 모습)
  const [coralImg, creamImg, wallImg, ...faceImgs] = await Promise.all([loadImg('kit/felt/tex-coral.webp'), loadImg('kit/felt/tex-cream.webp'), loadImg(WALL.src),
    ...Object.values(FACES).map((f) => loadImg(`kit/brand/${f}.webp`))]);

  // WebGL을 만들 수 없으면 여기서 오류가 난다. 부른 쪽(app.mjs)이 안내하고 입구로 돌아간다
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  host.prepend(renderer.domElement);
  renderer.domElement.className = 'stage-gl';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xfff6ee, 0xcdb8a6, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1.2, 4.2, 1.6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.6, bottom: -2.6, near: 0.5, far: 10 });
  sun.shadow.radius = 4; sun.shadow.bias = -0.0004;
  scene.add(sun);

  // 바닥: 크림 펠트
  const tex = (img, rep) => { const t = new THREE.Texture(img || undefined); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.needsUpdate = !!img; return t; };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: tex(creamImg, 7), color: 0xf3e6d2, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.76; floor.receiveShadow = true; scene.add(floor);

  // 배경 벽(WALL): 그림 판 하나 + 양옆 민 벽 둘. 빛을 받지 않고 그림 그대로 그리되 조금 차분하게(WALL.tint) — 탁구대·몽글이 앞에 서 보이게
  let wall = null;
  if (wallImg) {
    // 민 벽 띠: 그림 가운데의 빈 크림 벽·버터 띠·라피스 징두리(창문 없음). 맨 위 가랜드 줄은 바로 아래 크림 벽을 위아래로 뒤집어 덮는다
    const W0 = wallImg.naturalWidth, H0 = wallImg.naturalHeight, c = WALL.strip.cleanFrom, strip = document.createElement('canvas');
    strip.width = WALL.strip.w; strip.height = H0;
    { const g = strip.getContext('2d');
      g.drawImage(wallImg, WALL.strip.x, 0, WALL.strip.w, H0, 0, 0, WALL.strip.w, H0);
      g.save(); g.translate(0, c); g.scale(1, -1); g.drawImage(wallImg, WALL.strip.x, c, WALL.strip.w, c, 0, 0, WALL.strip.w, c); g.restore(); }
    // 그림 판: 양쪽 가장자리(폭의 4.5%)의 버터 띠 위만 옆 민 벽과 같은 결로 부드럽게 넘긴다 — 그림 가장자리가 가운데보다 조금 밝아 이음매 줄이 보였다.
    // 띠·징두리(화분·바구니가 있는 아래)는 그대로 둔다
    const pc = document.createElement('canvas'); pc.width = W0; pc.height = H0;
    const pg = pc.getContext('2d', { willReadFrequently: true }); pg.drawImage(wallImg, 0, 0);
    try {   // 픽셀을 읽지 못하는 환경이면(다른 출처 그림 등) 넘기기 없이 그림 그대로 쓴다 — 무대는 멈추지 않는다
      const g = pg, F = Math.round(W0 * 0.045), rows = Math.round(H0 * WALL.trimTop) - 2;
      const sg = strip.getContext('2d', { willReadFrequently: true }), sd = sg.getImageData(0, 0, F, rows).data;
      for (const right of [false, true]) {
        const x0 = right ? W0 - F : 0, d = g.getImageData(x0, 0, F, rows), px = d.data;
        for (let y = 0; y < rows; y++) for (let i = 0; i < F; i++) {
          const fromEdge = right ? F - 1 - i : i, k = fromEdge / F, a = k * k * (3 - 2 * k);   // 가장자리 0 → 안쪽 1(부드럽게)
          const p = (y * F + i) * 4, q = (y * F + fromEdge) * 4;   // 민 벽은 이음매에서 거울로 이어지므로 가장자리에서 같은 거리의 띠 칸
          for (let ch = 0; ch < 3; ch++) px[p + ch] = Math.round(sd[q + ch] + (px[p + ch] - sd[q + ch]) * a);
        }
        g.putImageData(d, x0, 0);
      }
    } catch { pg.drawImage(wallImg, 0, 0); }
    const map = new THREE.CanvasTexture(pc); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, color: WALL.tint }));
    const side = () => { const t = new THREE.CanvasTexture(strip); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.anisotropy = 4; return t; };
    const extL = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: side(), color: WALL.tint }));
    const extR = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: side(), color: WALL.tint }));
    scene.add(panel, extL, extR);
    wall = { panel, extL, extR, info: null };
  }

  // 탁구대 윗면: 코랄 펠트 + 흰 테두리·가운데 줄(캔버스로 그린다)
  const topCanvas = document.createElement('canvas'); topCanvas.width = 512; topCanvas.height = 920;
  { const g = topCanvas.getContext('2d');
    if (coralImg) { for (let y = 0; y < 920; y += 256) for (let x = 0; x < 512; x += 256) g.drawImage(coralImg, x, y, 256, 256); } else { g.fillStyle = '#e2533f'; g.fillRect(0, 0, 512, 920); }
    g.fillStyle = 'rgba(160,40,25,.18)'; g.fillRect(0, 0, 512, 920);
    g.strokeStyle = '#fffaf2'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 906);
    g.lineWidth = 5; g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 920); g.stroke(); }
  const topTex = new THREE.CanvasTexture(topCanvas); topTex.colorSpace = THREE.SRGBColorSpace; topTex.anisotropy = 4;
  const table = new THREE.Group(); scene.add(table);
  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 0.05, TABLE.l), [
    new THREE.MeshStandardMaterial({ color: 0xb8402f, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: 0xb8402f, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.97 }), new THREE.MeshStandardMaterial({ color: 0x9d2f22 }),
    new THREE.MeshStandardMaterial({ color: 0xc2402f, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: 0xc2402f, roughness: 0.95 })]);
  top.position.y = -0.025; top.receiveShadow = true; top.castShadow = true; table.add(top);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x5b3a30, roughness: 0.9 });
  for (const [x, z] of [[-0.62, -1.15], [0.62, -1.15], [-0.62, 1.15], [0.62, 1.15]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.71, 0.06), legMat); leg.position.set(x, -0.405, z); leg.castShadow = true; table.add(leg);
  }
  // 네트: 크림 실 무늬(반투명) + 기둥
  const netCanvas = document.createElement('canvas'); netCanvas.width = 512; netCanvas.height = 64;
  { const g = netCanvas.getContext('2d'); g.strokeStyle = 'rgba(255,250,242,.85)'; g.lineWidth = 2;
    for (let x = 0; x <= 512; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
    for (let y = 0; y <= 64; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.fillStyle = '#fffaf2'; g.fillRect(0, 0, 512, 7); }
  const netTex = new THREE.CanvasTexture(netCanvas); netTex.colorSpace = THREE.SRGBColorSpace;
  const net = new THREE.Mesh(new THREE.PlaneGeometry(TABLE.w + 0.2, 0.152), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  net.position.set(0, 0.076, 0); table.add(net);
  for (const x of [-(TABLE.w / 2 + 0.1), TABLE.w / 2 + 0.1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 10), legMat); post.position.set(x, 0.085, 0); table.add(post);
  }

  // 대답 칸 1·2·3: 몽글 쪽 탁구대 위의 펠트 판(번호 큼직하게)
  const pads = PAD_COLORS.map((c, i) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 300;
    const g = cv.getContext('2d');
    g.fillStyle = c.base; g.fillRect(0, 0, 256, 300);
    if (creamImg) { g.globalAlpha = 0.28; g.globalCompositeOperation = 'multiply'; g.drawImage(creamImg, 0, 0, 256, 300); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    g.fillStyle = c.ink; g.font = '900 170px SUIT, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 128, 160);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 1, emissive: new THREE.Color(c.glow), emissiveIntensity: 0, transparent: true, opacity: 0.94 });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(0.36, 0.42, 0.07)), mat);
    // ShapeGeometry의 UV를 판 전체 0~1로 편다
    const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) + 0.18) / 0.36, (pos.getY(k) + 0.21) / 0.42);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(LANES[i], 0.004, PAD_Z); mesh.receiveShadow = true;
    table.add(mesh);
    return { mesh, mat, glow: 0 };
  });

  // 몽글: 맞은편에 선 펠트 그림(움직이지 않는다 — 표정만 바뀐다)
  const faceTex = faceImgs.map((im) => { const t = new THREE.Texture(im || undefined); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = !!im; return t; });
  const faceAspect = faceImgs[0] ? faceImgs[0].naturalWidth / faceImgs[0].naturalHeight : 1;
  const mongle = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * faceAspect, 0.7), new THREE.MeshBasicMaterial({ map: faceTex[0], transparent: true, depthWrite: false }));
  mongle.position.set(-0.14, 0.22, -2.12); scene.add(mongle);
  const faceKeys = Object.keys(FACES);
  const setFace = (k) => { const i = Math.max(0, faceKeys.indexOf(k)); if (faceTex[i].image) mongle.material.map = faceTex[i]; };

  // 꾸미기(2026-10-07)의 펠트 결: 바닥과 같은 크림 펠트 사진(tex-cream)에서 색을 빼고 결의 밝기만 남겨(평균 0.93, 결은 3.5배 또렷하게),
  // 장착한 색과 곱한다 — 작은 라켓·공에서도 펠트로 보이고, 색은 팔레트 그대로 남는다.
  const feltDetail = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#eeeeee'; g.fillRect(0, 0, 256, 256);   // 펠트 사진을 못 읽으면 고른 밝기(색만 입힌다)
    if (creamImg) {
      try {
        g.drawImage(creamImg, 0, 0, 256, 256);
        const d = g.getImageData(0, 0, 256, 256), px = d.data; let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        const mean = sum / (px.length / 4);
        for (let i = 0; i < px.length; i += 4) {
          const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2], v = Math.round(255 * Math.min(1, Math.max(0, 0.93 + 3.5 * (l - mean) / mean)));
          px[i] = px[i + 1] = px[i + 2] = v;
        }
        g.putImageData(d, 0, 0);
      } catch { g.fillStyle = '#eeeeee'; g.fillRect(0, 0, 256, 256); }
    }
    return cv;
  })();
  const feltMap = (rx, ry) => { const t = new THREE.CanvasTexture(feltDetail); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };

  // 라켓: 판 + 나무 손잡이. 내 라켓 판은 꾸미기 색의 펠트(setGear), 몽글 라켓은 원래 파랑 그대로
  function paddle(color, map = null) {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.018, 28), new THREE.MeshStandardMaterial({ color, map, roughness: map ? 1 : 0.85 }));
    face.rotation.x = Math.PI / 2; face.castShadow = true; g.add(face);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.022), new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.8 }));
    handle.position.y = -0.12; handle.castShadow = true; g.add(handle);
    g.userData.face = face;
    return g;
  }
  const myPaddle = paddle(0xd63c2a, feltMap(1, 1)); scene.add(myPaddle);
  const oppPaddle = paddle(0x3d6bc9); scene.add(oppPaddle);
  oppPaddle.position.set(0.36, OPP.y, OPP.z - 0.05); oppPaddle.rotation.y = Math.PI;

  // 공: 펠트 공(실제보다 크게 — 잘 보이게, 기본은 원래의 크림색). 꾸미기 색으로 바뀌고 같은 색을 옅게 스스로 밝혀 그늘에서도 보이게 한다
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, map: feltMap(2, 1), roughness: 0.9, emissive: 0xfff1c9, emissiveIntensity: 0.12 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.042, 24, 16), ballMat);
  ball.castShadow = true; ball.visible = false; scene.add(ball);
  let tailColor = '#fff6d6';   // 공 꼬리: 공 색을 흰색 쪽으로 30% 옅게
  const gearNow = { racket: '#d63c2a', ball: '#fff1c9' };
  function setGear({ racket, ball: ballColor } = {}) {
    if (/^#[0-9a-f]{6}$/i.test(racket || '')) { myPaddle.userData.face.material.color.set(racket); gearNow.racket = racket; }
    if (/^#[0-9a-f]{6}$/i.test(ballColor || '')) {
      ballMat.color.set(ballColor); ballMat.emissive.set(ballColor); gearNow.ball = ballColor;
      const n = parseInt(ballColor.slice(1), 16), mix = (c) => Math.round(c + (255 - c) * 0.3);
      tailColor = `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
    }
  }

  const ctx2d = overlay.getContext('2d');
  const edge = new THREE.Vector3();   // 기다리는 공의 화면 크기를 잴 때 쓰는 점
  let W = 1, H = 1, dpr = 1, paused = false, active = true;
  let path = null;        // 공이 따라가는 토막들 { segs:[{a,b,apex,dur,end}], i, t, token, done }
  let tw = 0, last = performance.now(), freezeUntil = 0, slow = null, swing = null, lean = { from: 0, to: 0, t: 0 };
  let token = 0, lane = null;
  const view = {};   // 확인용(?qa)으로만 바꾸는 카메라 값
  const fx = [];          // 2D 덧그림 { kind, born, dur, x, y, ... }
  const tail = [];        // 공 꼬리: 최근 0.11초의 화면 좌표 { x, y, t }
  let stroke = null;      // 긋는 손가락 자국 { pts:[{x,y,t}], ended, ok, endAt }

  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';   // 배율 2배 기기에서 캔버스가 화면의 두 배로 커지지 않게
    overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr);
    overlay.style.width = W + 'px'; overlay.style.height = H + 'px';
    camera.aspect = W / H;
    // 세로 화면은 탁구대 폭이 다 들어오게 뒤로·위로 물러난다(가로 시야를 맞춘다). 카메라는 그 뒤로 움직이지 않는다.
    const portrait = W / H < 0.9, back = portrait ? 1 + (0.9 - W / H) * 1.25 : 1;
    camera.fov = view.fov ?? (portrait ? 52 : 44);
    const pos = view.pos || [0, 1.32 * back + 0.06, 2.3 * back + 0.62], look = view.look || [0, -0.32, -0.1];
    camera.position.set(...pos);
    camera.lookAt(...look);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    fitWall();
    draw();
  }

  /** 3D 점 → 화면 좌표(px). */
  function project(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, z: p.z }; }

  /** 화면 점(px)을 지나는 시선이 벽면(z = WALL.z)과 만나는 높이 y. */
  const ray = new THREE.Vector3(), fwd = new THREE.Vector3();
  function wallYAt(sx, sy) {
    ray.set(sx / W * 2 - 1, 1 - sy / H * 2, 0.5).unproject(camera).sub(camera.position);
    return camera.position.y + ray.y * (WALL.z - camera.position.z) / ray.z;
  }
  /**
   * 벽을 이 화면 비율에 맞춘다(카메라를 정한 뒤 한 번 — 움직이지 않는다).
   * 그림 높이 h = max(보이는 벽 높이, 가랜드가 몽글 머리 위로 비키는 높이). 버터 띠가 몽글 라켓 아래 racketGap(px)보다 높아지면
   * 그림 전체를 그만큼 바닥 아래로 내린다(sink — 지금 다섯 화면에서는 0). 양옆이 비면 민 벽으로 화면 끝까지 채운다.
   */
  function fitWall() {
    if (!wall) return;
    const top = wallYAt(W / 2, 0), floorY = WALL.floorY;
    camera.getWorldDirection(fwd);
    const depth = (y) => new THREE.Vector3(0, y, WALL.z).sub(camera.position).dot(fwd);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const halfW = Math.max(depth(floorY), depth(top)) * tanH * 1.03;   // 보이는 벽에서 가장 넓은 곳(바닥 선) + 여유
    const racket = project(new THREE.Vector3(0.36, OPP.y - 0.085, OPP.z - 0.05)), trimMax = wallYAt(racket.x, racket.y + WALL.racketGap);
    const head = project(new THREE.Vector3(-0.14, 0.57, -2.12)), buntingMin = wallYAt(head.x, head.y - WALL.mongleGap);
    let h = Math.max(top - floorY, (buntingMin - floorY) / (1 - WALL.buntingBottom)) * 1.001, y0 = floorY;
    if (floorY + (1 - WALL.trimTop) * h > trimMax) {   // 버터 띠가 라켓에 닿는다: 띠를 trimMax에 두고, 그림 위 끝이 화면 위를 덮게 키운다
      h = Math.max(h, (top - trimMax) / WALL.trimTop * 1.001);
      y0 = trimMax - (1 - WALL.trimTop) * h;
    }
    const sink = floorY - y0, w = h * WALL.aspect, side = Math.max(0, halfW - w / 2), stripW = w * WALL.strip.w / 1536;
    wall.panel.scale.set(w, h, 1); wall.panel.position.set(0, y0 + h / 2, WALL.z);
    for (const [m, sign] of [[wall.extL, -1], [wall.extR, 1]]) {
      m.visible = side > 0.001;
      const sw = side + 0.004;   // 그림 판 뒤로 살짝 겹쳐 이음매에 틈이 없게
      m.scale.set(sw, h, 1); m.position.set(sign * (w / 2 + side / 2 - 0.002), y0 + h / 2, WALL.z - 0.001);
      const t = m.material.map; t.repeat.set(sw / stripW, 1); t.offset.set(sign < 0 ? -sw / stripW : 0, 0);   // 그림과 닿는 쪽이 띠의 첫 줄
    }
    // 확인용(?qa): 화면에서의 자리(px)
    const at = (x, y) => project(new THREE.Vector3(x, y, WALL.z));
    wall.info = { h, w, sink, side, halfW, top, W, H,
      trimY: at(0.36, y0 + (1 - WALL.trimTop) * h).y, racketBottomY: racket.y,
      buntingY: at(-0.14, y0 + (1 - WALL.buntingBottom) * h).y, mongleTopY: head.y,
      floorLineY: at(0, floorY).y, wallTopY: at(0, y0 + h).y, leftX: at(-(w / 2 + side), floorY).x, rightX: at(w / 2 + side, floorY).x,
      panelLeftX: at(-w / 2, floorY).x, panelRightX: at(w / 2, floorY).x };
  }

  function setLane(next) {
    const to = next == null ? 0 : (next - 1) * 0.42;
    lean = { from: myPaddle.rotation.z, to: -to, t: 0 }; lane = next;
  }
  function placePaddle() {
    myPaddle.position.set(0, HIT.y, HIT.z + 0.06);
    myPaddle.rotation.set(-0.2, 0, myPaddle.rotation.z);
  }
  placePaddle();

  /** 몽글이 친다: 몽글 라켓 → 내 쪽 탁구대(튀기) → 내 라켓. flight초 걸린다(고르기 전이면 라켓 앞에서 기다린다). 끝나면 onArrive(token)에 묻는다. */
  function serve({ flight = 2.4, fromX = 0.3 + Math.random() * 0.16 } = {}) {   // 몽글 오른손 쪽에서 친다(몽글 얼굴을 가리지 않게)
    token += 1; const my = token;
    const a = new THREE.Vector3(fromX, OPP.y, OPP.z), bounce = new THREE.Vector3(fromX * 0.4, 0.042, 0.82), hit = new THREE.Vector3(0, HIT.y, HIT.z);
    oppPaddle.position.x = fromX;
    ball.position.copy(a); ball.visible = true;
    path = { token: my, i: 0, t: 0, serve: true, released: false, waiting: false, boost: 1, segs: [
      { a, b: bounce, apex: 0.42, dur: flight * 0.62, end: () => onBounce?.({ near: 1, x: bounce.x }) },
      { a: bounce, b: hit, apex: 0.3, dur: flight * 0.38, end: () => arrive(my), hold: true },
    ] };
    onOpponentHit?.({ x: fromX });
    flash(project(a), 0.5, 'soft');
    return my;
  }

  /** 대답을 골랐다: 공이 기다리는 중이면 남은 길을 snapSec 안에 와서 받아치고, 아직 오는 중이면 제 속도로 와서 받아친다. */
  function release(tok) {
    if (!path?.serve || path.token !== tok || path.released) return;
    path.released = true;
    const seg = path.segs[path.i];
    if (seg?.hold && path.waiting) path.boost = Math.max(1, (seg.dur - path.t) / FEEL.snapSec);
  }
  /** 기다리는 토막에서 이번 프레임에 나아갈 시간: 고르기 전이면 holdFrom부터 남은 거리에 맞춰 부드럽게 줄여 holdAt에서 멈춘다. */
  function holdStep(seg, dt) {
    if (path.released) return dt * path.boost;
    const k = path.t / seg.dur, from = FEEL.holdFrom, at = FEEL.holdAt;
    if (k < from) return Math.min(dt, at * seg.dur - path.t);
    if (!path.waiting) { path.waiting = true; onHold?.(path.token); }
    const left = at - k;
    if (left <= 0.002) { path.t = at * seg.dur; return 0; }
    return Math.min(left * seg.dur, dt * Math.max(0.05, Math.sqrt(left / (at - from))));   // 남은 거리의 제곱근에 비례한 속도 = 일정하게 줄어드는 감속
  }

  /** 공이 내 라켓에 닿는 순간: app이 고른 대답(lane)과 판정을 돌려주면 받아치고, 아니면 놓친다(고르기 전에는 닿지 않으므로 놓침은 만일의 길). */
  function arrive(my) {
    if (my !== token) return;
    const res = onArrive?.(my);
    const hit = new THREE.Vector3(0, HIT.y, HIT.z), at = project(hit);
    if (!res) {   // 놓침: 공이 라켓 옆을 지나 떨어진다
      path = { token: my, i: 0, t: 0, segs: [{ a: hit, b: new THREE.Vector3(0.25, -0.55, HIT.z + 0.9), apex: 0.05, dur: 0.45, end: () => { ball.visible = false; onMissed?.(my); } }] };
      return;
    }
    const { lane: k, verdict, smash } = res;
    setLane(k);
    swing = { t: 0 };
    const stop = verdict === 'ok' ? (smash ? FEEL.stop.smash : FEEL.stop.ok) : FEEL.stop.wrong;
    if (!reducedMotion()) freezeUntil = performance.now() + stop;
    flash(at, smash ? 1.6 : verdict === 'ok' ? 1.1 : 0.7, verdict === 'ok' ? 'gold' : 'soft');
    if (verdict === 'ok' && !reducedMotion()) burst(at, smash ? 16 : 9);
    if (smash && !reducedMotion()) slow = { t0: performance.now() + stop, dur: FEEL.slowMs };
    const dur = smash ? FEEL.smashSec : FEEL.returnSec, padAt = new THREE.Vector3(LANES[k], 0.042, PAD_Z);
    const segs = [{ a: hit, b: padAt, apex: smash ? 0.12 : 0.26, dur, end: () => { onPadLanded?.({ lane: k, verdict, smash }); padGlow(k, verdict === 'ok'); } }];
    if (verdict === 'ok') {
      const catchAt = new THREE.Vector3(0.3 + LANES[k] * 0.25, OPP.y, OPP.z);
      segs.push({ a: padAt, b: catchAt, apex: 0.22, dur: 0.42, end: () => { oppPaddle.position.x = catchAt.x; ball.visible = false; onCaught?.(my); } });
    } else {
      // 틀린 칸: 공이 칸에 닿은 뒤 탁구대 밖으로 굴러 나간다(실패음·흔들림 없이)
      const out = new THREE.Vector3(LANES[k] * 2.2 + (k === 1 ? 0.5 : 0), -0.6, -1.9);
      segs.push({ a: padAt, b: out, apex: 0.2, dur: 0.6, end: () => { ball.visible = false; } });
    }
    path = { token: my, i: 0, t: 0, segs };
    return at;
  }

  function padGlow(k, ok) { pads[k].glow = ok ? 1 : 0.35; }

  function flash(at, size, tone) { fx.push({ kind: 'flash', born: performance.now(), dur: 260, x: at.x, y: at.y, size, tone }); }
  function burst(at, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, v = 120 + Math.random() * 160;
      fx.push({ kind: 'spark', born: performance.now(), dur: 520, x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 5 + Math.random() * 5, rot: Math.random() * 3 });
    }
  }

  function step(now) {
    const dtReal = Math.min(0.05, (now - last) / 1000); last = now;
    let scale = 1;
    if (paused) scale = 0;
    else if (now < freezeUntil) scale = 0;
    else if (slow) {
      const k = (now - slow.t0) / slow.dur;
      if (k >= 1) slow = null; else if (k > 0) scale = FEEL.slowMin + (1 - FEEL.slowMin) * easeOut(k); else scale = FEEL.slowMin;
    }
    const dt = dtReal * scale; tw += dt;
    if (path && !paused) {
      let seg = path.segs[path.i];
      path.t += seg?.hold ? holdStep(seg, dt) : dt;
      while (seg && path.t >= seg.dur) {
        path.t -= seg.dur; const end = seg.end; path.i += 1; seg = path.segs[path.i];
        const before = path; end?.();
        if (path !== before) { seg = null; break; }   // end가 새 길을 놓았다(받아치기 등)
      }
      if (path && path.segs[path.i]) {
        const s = path.segs[path.i]; ball.position.copy(arc(s.a, s.b, s.apex, Math.min(1, path.t / s.dur)));
      } else if (path && path.i >= path.segs.length) path = null;
    }
    // 라켓 기울기(고른 쪽을 미리 보여 준다)와 휘두르기
    if (lean.t < 1) { lean.t = Math.min(1, lean.t + dtReal * 7); myPaddle.rotation.z = lean.from + (lean.to - lean.from) * easeOut(lean.t); }
    if (swing && !paused && now >= freezeUntil) {
      swing.t += dtReal / 0.24;
      const k = Math.min(1, swing.t), s = Math.sin(k * Math.PI);
      myPaddle.rotation.x = -0.2 - 0.9 * s; myPaddle.position.z = HIT.z + 0.06 - 0.12 * s;
      if (k >= 1) { swing = null; placePaddle(); }
    }
    for (const p of pads) if (p.glow > 0) { p.glow = Math.max(0, p.glow - dtReal * 1.4); p.mat.emissiveIntensity = p.glow * 0.9; }
  }

  function draw() {
    renderer.render(scene, camera);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, W, H);
    const now = performance.now();
    const holding = path?.serve && path.waiting && !path.released;
    // 공 꼬리: 날아가는 공 뒤에 옅은 크림색 자취(속도감·공 따라가기). 기다리는 동안·움직임 줄이기에서는 없다
    if (ball.visible && !holding && !reducedMotion()) { const p = project(ball.position); tail.push({ x: p.x, y: p.y, t: now }); } else tail.length = 0;
    while (tail.length && now - tail[0].t > 110) tail.shift();
    if (tail.length > 1) {
      const p0 = project(ball.position), q0 = project(edge.copy(ball.position).setX(ball.position.x + 0.042)), rb = Math.max(4, Math.hypot(q0.x - p0.x, q0.y - p0.y));
      ctx2d.fillStyle = tailColor;
      for (let i = 0; i < tail.length - 1; i++) {
        const a = tail[i], k = 1 - (now - a.t) / 110;
        ctx2d.globalAlpha = 0.3 * k; ctx2d.beginPath(); ctx2d.arc(a.x, a.y, rb * (0.35 + 0.55 * k), 0, Math.PI * 2); ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
    }
    // 긋는 손가락 자국: 손끝은 굵고 꼬리는 가늘게. 대답을 골랐으면 금빛, 아니면 크림색으로 0.26초 동안 사라진다
    if (stroke) {
      const fade = stroke.ended ? 1 - (now - stroke.endAt) / 260 : 1;
      if (fade <= 0) stroke = null;
      else {
        const pts = stroke.ended ? stroke.pts : stroke.pts.filter((q) => now - q.t < 160);
        ctx2d.strokeStyle = stroke.ok ? '#ffd45c' : '#fffaf2'; ctx2d.lineCap = 'round';
        for (let i = 1; i < pts.length; i++) {
          const k = i / (pts.length - 1);
          ctx2d.globalAlpha = fade * (0.25 + 0.6 * k); ctx2d.lineWidth = 2 + 9 * k;
          ctx2d.beginPath(); ctx2d.moveTo(pts[i - 1].x, pts[i - 1].y); ctx2d.lineTo(pts[i].x, pts[i].y); ctx2d.stroke();
        }
        ctx2d.globalAlpha = 1;
      }
    }
    if (holding && ball.visible) {
      // 화면에 비친 공 크기에 맞춰 공 바깥에 옅은 빛과 금빛 고리(공에 붙어 테두리처럼 보이지 않게)
      const p = project(ball.position), q = project(edge.copy(ball.position).setX(ball.position.x + 0.042)), r = Math.max(6, Math.hypot(q.x - p.x, q.y - p.y));
      const glow = reducedMotion() ? 0.6 : 0.45 + 0.25 * Math.sin(now / 260);
      ctx2d.globalAlpha = glow * 0.4; ctx2d.fillStyle = '#fff6d6';
      ctx2d.beginPath(); ctx2d.arc(p.x, p.y, r + 9, 0, Math.PI * 2); ctx2d.fill();
      ctx2d.globalAlpha = glow; ctx2d.strokeStyle = '#ffd45c'; ctx2d.lineWidth = 3;
      ctx2d.beginPath(); ctx2d.arc(p.x, p.y, r + 13, 0, Math.PI * 2); ctx2d.stroke();
      ctx2d.globalAlpha = 1;
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], k = (now - f.born) / f.dur;
      if (k >= 1) { fx.splice(i, 1); continue; }
      if (f.kind === 'flash') {
        const r = (18 + 70 * easeOut(k)) * f.size;
        ctx2d.globalAlpha = (1 - k) * (f.tone === 'gold' ? 0.9 : 0.55);
        ctx2d.strokeStyle = f.tone === 'gold' ? '#ffd45c' : '#fffaf2'; ctx2d.lineWidth = 5 * (1 - k) + 1.5;
        ctx2d.beginPath(); ctx2d.arc(f.x, f.y, r, 0, Math.PI * 2); ctx2d.stroke();
        if (k < 0.35) { ctx2d.globalAlpha = (0.35 - k) * 1.6; ctx2d.fillStyle = '#fffaf2'; ctx2d.beginPath(); ctx2d.arc(f.x, f.y, 14 * f.size, 0, Math.PI * 2); ctx2d.fill(); }
      } else if (f.kind === 'spark') {
        const t = (now - f.born) / 1000;
        ctx2d.globalAlpha = 1 - k; ctx2d.fillStyle = '#ffd45c';
        star4(ctx2d, f.x + f.vx * t, f.y + f.vy * t + 160 * t * t, f.r * (1 - k * 0.5), f.rot + t * 4);
      }
    }
    ctx2d.globalAlpha = 1;
  }

  let raf = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!active) return;
    step(now);
    draw();
  }
  raf = requestAnimationFrame(loop);
  const ro = new ResizeObserver(resize); ro.observe(host);
  resize();

  /** 셰이더를 미리 데운다(첫 공에서 화면이 굳지 않게). 공·빛·판을 보이게 한 채 1px로 두 번 그린다. */
  function warmUp() {
    const vis = ball.visible; ball.visible = true; ball.position.set(0, 0.2, 0.5);
    renderer.compile(scene, camera);
    renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
    renderer.render(scene, camera); renderer.render(scene, camera);
    renderer.setScissorTest(false);
    ball.visible = vis;
  }
  warmUp();

  return {
    serve, release, setLane, setFace, resize, warmUp, setGear,
    gear: () => ({ ...gearNow, tail: tailColor }),
    wallInfo: () => (wall?.info ? { ...wall.info } : null),
    holding: () => !!(path?.serve && path.waiting && !path.released),
    lanes: LANES.length,
    padColors: PAD_COLORS.map((c) => c.base),
    project: (x, y, z) => project(new THREE.Vector3(x, y, z)),
    hitPoint: () => project(new THREE.Vector3(0, HIT.y, HIT.z)),
    mongleTop: () => project(new THREE.Vector3(-0.14, 0.6, -2.12)),
    debugView(o) { Object.assign(view, o); resize(); },
    pause(on) { paused = !!on; last = performance.now(); },
    setActive(on) { active = !!on; last = performance.now(); },
    clear() { token += 1; path = null; ball.visible = false; swing = null; slow = null; freezeUntil = 0; fx.length = 0; tail.length = 0; stroke = null; setLane(null); for (const p of pads) { p.glow = 0; p.mat.emissiveIntensity = 0; } setFace('idle'); draw(); },
    ballScreen: () => (ball.visible ? project(ball.position) : null),
    /** 긋는 손가락 자국(탁구대 기준 화면 좌표). 끝낼 때 대답을 골랐으면 ok. */
    strokeStart(x, y) { stroke = { pts: [{ x, y, t: performance.now() }], ended: false, ok: false, endAt: 0 }; },
    strokeMove(x, y) { if (!stroke || stroke.ended) return; stroke.pts.push({ x, y, t: performance.now() }); if (stroke.pts.length > 48) stroke.pts.shift(); },
    strokeEnd(ok) { if (!stroke || stroke.ended) return; stroke.ended = true; stroke.ok = !!ok; stroke.endAt = performance.now(); },
    strokeInfo: () => stroke && { n: stroke.pts.length, ok: stroke.ok, ended: stroke.ended },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
  };
}
