// 문제 게이트(3D) — 세 차선 위의 글자판과 그림(사과·바나나·포도는 입체, 나머지는 그림 글자·낱말 글자판). app.js에서 옮김.
// 판정·흐름은 app.js가 맡고, 여기서는 메시를 만들고 치운다.
import { canvasTexture } from './world-build.js';

function fruit(THREE, type) {
  const g = new THREE.Group();
  if (type === 'apple') {
    const geometry = new THREE.SphereGeometry(.58, 24, 18), p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i), z = p.getZ(i), theta = Math.atan2(z, x), r = 1 + .045 * Math.cos(theta * 5);
      p.setXYZ(i, x * r, y * .88 - .11 * Math.exp(-(x * x + z * z) * 28) * (y > 0 ? 1 : -.3), z * r);
    }
    geometry.computeVertexNormals();
    const apple = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ color: 0xbe2b23, roughness: .34, clearcoat: .65, clearcoatRoughness: .24 }));
    apple.castShadow = true; g.add(apple);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, .29, 7), new THREE.MeshStandardMaterial({ color: 0x685231, roughness: 1 }));
    stem.position.set(.04, .53, 0); stem.rotation.z = -.2; g.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 6), new THREE.MeshStandardMaterial({ color: 0x4c7331, roughness: .8 }));
    leaf.scale.set(1, .09, .43); leaf.position.set(.21, .57, 0); leaf.rotation.z = .3; g.add(leaf);
  } else if (type === 'banana') {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xe2c557, roughness: .48, clearcoat: .23 });
    for (let i = 0; i < 3; i++) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.49, -.29, i * .09), new THREE.Vector3(-.27, -.44, i * .09), new THREE.Vector3(.13, -.40, i * .09), new THREE.Vector3(.43, -.10, i * .09), new THREE.Vector3(.47, .27, i * .09)]);
      const b = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, .105, 7, false), mat); b.rotation.z = (i - 1) * .24; b.position.set(0, .15, 0); g.add(b);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(.10, 8, 6), new THREE.MeshStandardMaterial({ color: 0x6d5530, roughness: 1 })); tip.position.set(.45, .41, i * .09); g.add(tip);
    }
    g.rotation.z = -.2;
  } else {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x6261a0, roughness: .38, clearcoat: .5 }), geo = new THREE.SphereGeometry(.20, 12, 8);
    for (let y = 0; y < 4; y++) for (let j = 0; j < 4 - y; j++) { const b = new THREE.Mesh(geo, mat); b.position.set((j - (3 - y) / 2) * .29, .47 - y * .27, Math.sin(j * 2 + y) * .13); g.add(b); }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .3, 6), new THREE.MeshStandardMaterial({ color: 0x6b7c3a, roughness: 1 }));
    stem.position.y = .79; stem.rotation.z = .3; g.add(stem);
  }
  g.scale.setScalar(1.34);
  return g;
}

function answerVisual(THREE, renderer, word, mode) {
  const model = { '사과': 'apple', '바나나': 'banana', '포도': 'grape' }[word.word];
  if (mode === 'picture' && model) return fruit(THREE, model);
  const texture = canvasTexture(THREE, renderer, 512, (ctx, n) => {
    ctx.clearRect(0, 0, n, n); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f6fff1';
    if (mode === 'picture') { ctx.font = '270px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; ctx.fillText(word.icon, n / 2, n / 2); return; }
    let size = word.word.length > 8 ? 60 : 115;
    ctx.font = `800 ${size}px SUIT, sans-serif`;
    while (ctx.measureText(word.word).width > 470 && size > 55) { size -= 3; ctx.font = `800 ${size}px SUIT, sans-serif`; }
    const lines = []; let line = '';
    for (const char of word.word) { if (ctx.measureText(line + char).width > 440) { lines.push(line.trim()); line = char; } else line += char; }
    if (line) lines.push(line.trim());
    lines.forEach((text, i) => ctx.fillText(text, n / 2, n / 2 + (i - (lines.length - 1) / 2) * (size * 1.3)));
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.y = Math.PI; m.userData.spinBase = Math.PI;
  return m;
}

/** 세 차선(lanes: 월드 좌표의 가로 위치)에 게이트를 세운다. types는 월드 순서의 보기 아이디. */
export function buildGate(THREE, renderer, { q, types, lanes, words }) {
  const group = new THREE.Group(), fruitObjects = [];
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xe1ece5, metalness: .3, roughness: .46 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x204249, metalness: .18, roughness: .58 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x739598, transparent: true, opacity: .18, roughness: .3, metalness: .3, depthWrite: false });
  for (let i = 0; i < 3; i++) {
    const lane = new THREE.Group(); lane.position.x = lanes[i];
    for (const x of [-1.55, 1.55]) { const pole = new THREE.Mesh(new THREE.BoxGeometry(.075, 3.7, .075), frameMat); pole.position.set(x, 1.85, 0); pole.castShadow = true; lane.add(pole); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.18, .10, .10), frameMat); top.position.y = 3.7; lane.add(top);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.55, .11), darkMat); panel.position.set(0, 2.84, 0); panel.castShadow = true; lane.add(panel);
    const border = new THREE.Mesh(new THREE.BoxGeometry(2.73, 1.46, .12), glassMat); border.position.set(0, 2.84, -.085); lane.add(border);
    const f = answerVisual(THREE, renderer, words[types[i]], q.mode); f.position.set(0, 2.85, -.22); lane.add(f); fruitObjects.push(f);
    panel.userData.board = true;   // 답이 적힌 판(화면 위 꼬리표가 이 판을 가리지 않는지 확인용 표시)
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.97, .026, 1.4), new THREE.MeshStandardMaterial({ color: 0x95b4aa, metalness: .12, roughness: .72 }));
    base.position.set(0, .023, -.1); lane.add(base);
    group.add(lane);
  }
  return { group, fruitObjects };
}

/** 게이트가 쓴 기하·재질·텍스처를 모두 치운다. */
export function disposeGateMeshes(group) {
  const gs = new Set(), ms = new Set(), ts = new Set();
  group.traverse((o) => {
    if (o.geometry) gs.add(o.geometry);
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) ms.add(m);
  });
  for (const g of gs) g.dispose();
  for (const m of ms) { if (m.map) ts.add(m.map); m.dispose(); }
  for (const t of ts) t.dispose();
}
