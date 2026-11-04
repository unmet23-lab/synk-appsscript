// MT 바닷가 자전거 레이스(WORLD 판)의 길 위 소품(설계 qa/world-mt-20261104/설계.md 4-5): 출발 현수막 · 길가 표지판 · 도착 현수막.
// 글자는 캔버스로 그려 화면과 같은 SUIT를 쓴다(그림 굽기에 읽히는 글자를 맡기지 않는다). 실제 지명 · 상호 없음, 학교는 드라마의 지어낸 「새솔대」.

function textTexture(THREE, renderer, width, height, paint) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
const pole = (THREE, material, height, r = .055) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, height, 10), material); m.position.y = height / 2; m.castShadow = true; return m; };

/** 길을 가로지르는 현수막(양쪽 기둥 + 천). s는 길 위 거리. */
function banner(THREE, renderer, { roadPoint, pathAngle }, s, { top, sub, cloth = '#f2735f', ink = '#fff8ee', span = 13.4, height = 4.6 }) {
  const group = new THREE.Group(); group.position.copy(roadPoint(s)); group.rotation.y = pathAngle(s);
  const metal = new THREE.MeshStandardMaterial({ color: 0xdfe3e0, metalness: .55, roughness: .4 });
  for (const x of [-span / 2, span / 2]) { const p = pole(THREE, metal, height + .55); p.position.x = x; group.add(p); }
  const tex = textTexture(THREE, renderer, 1536, 240, (c, w, h) => {
    c.fillStyle = cloth; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 10, w, 4); c.fillRect(0, h - 14, w, 4);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink;
    c.font = '800 118px SUIT, sans-serif'; c.fillText(top, w / 2, sub ? h * .42 : h * .52);
    if (sub) { c.font = '600 46px SUIT, sans-serif'; c.globalAlpha = .9; c.fillText(sub, w / 2, h * .8); c.globalAlpha = 1; }
  });
  // 낮은 해를 등지고 서서 그늘지므로 자기 빛을 조금 준다(글자가 읽혀야 한다).
  const material = new THREE.MeshStandardMaterial({ map: tex, roughness: .86, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .62 });
  const cloths = new THREE.PlaneGeometry(span, span * 240 / 1536, 16, 3), p = cloths.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * .9) * .07);   // 천이 조금 처진 결
  cloths.computeVertexNormals();
  const cloth3d = new THREE.Mesh(cloths, material); cloth3d.position.y = height; cloth3d.rotation.y = Math.PI;   // 다가가는 쪽(−Z)을 본다
  cloth3d.castShadow = true; group.add(cloth3d);
  return group;
}

/** 길가 파란 표지판 하나(오른쪽 갓길, 화면 오른쪽 = −X). */
function sign(THREE, renderer, { roadPoint, pathAngle }, s, lines) {
  const offset = -7.6, group = new THREE.Group(); group.position.copy(roadPoint(s, offset)); group.rotation.y = pathAngle(s);
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9bfbf, metalness: .7, roughness: .38 });
  group.add(pole(THREE, metal, 2.9, .04));
  const tex = textTexture(THREE, renderer, 512, 256, (c, w, h) => {
    c.fillStyle = '#1d4f91'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f6f6f2'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (lines.length > 1) { c.font = '800 84px SUIT, sans-serif'; c.fillText(lines[0], w / 2, h * .36); c.font = '700 66px SUIT, sans-serif'; c.fillText(lines[1], w / 2, h * .7); }
    else { c.font = '800 80px SUIT, sans-serif'; c.fillText(lines[0], w / 2, h * .52); }
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, .75, .03), [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: 0x8f9796, metalness: .6, roughness: .5 })).concat([new THREE.MeshStandardMaterial({ color: 0x8f9796, metalness: .6, roughness: .5 }), new THREE.MeshStandardMaterial({ map: tex, roughness: .55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .55 })]));
  board.position.set(0, 2.72, -.055); board.castShadow = true; group.add(board);   // 기둥 앞(다가오는 쪽)에 붙인다
  return group;
}

/** 소품 한 벌. finish는 도착 뒤 되감기 때 숨긴다. */
export function buildRideProps(THREE, renderer, road, { startS = 92, finishS = 884 } = {}) {
  const group = new THREE.Group(); group.name = 'ride-props';
  const start = banner(THREE, renderer, road, startS, { top: '숙소까지 먼저!', sub: '새솔대 창업동아리 MT · 꼴찌는 오늘 설거지' });
  const finish = banner(THREE, renderer, road, finishS, { top: '도착 · 숙소', sub: '환영 새솔대 창업동아리', cloth: '#1d2f4d' });
  group.add(start, finish);
  for (const [s, lines] of [[265, ['숙소', '600m']], [440, ['해변 산책로', '→']], [620, ['자전거 도로']]]) group.add(sign(THREE, renderer, road, s, lines));
  return { group, start, finish, finishS };
}
