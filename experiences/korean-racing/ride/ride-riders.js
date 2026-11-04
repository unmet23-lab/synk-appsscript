// MT 바닷가 자전거 레이스(WORLD 판) — 자전거 탄 사람(상대) 3D(2026-11-04, 설계 qa/world-mt-20261104/설계.md 4-3 · 4-4).
// 코드로 짠다(크레딧 0). 얼굴은 헬멧 · 선글라스로 3D에서 맡지 않고, 화면의 사진 칩이 맡는다 — 옷이 사람을 알린다(태오 = 남색 과잠 + 회색 후드).
// 뼈대는 자전거 공간(+Z 앞, +Y 위)에서 매 프레임 셈한다: 다리는 페달까지, 팔은 손잡이까지 두 관절 IK. 뼈 길이는 늘 그대로다(시험이 잰다).
// 조각은 움직이는 무리마다 정점 색 한 메시로 묶어 그리기 호출을 사람당 13번으로 둔다. LAB 화면은 이 파일을 불러오지 않는다.
import { buildBike, poseBike, pedalPoint } from './ride-bike.js';

export const RIDERS = Object.freeze({
  // 태오 선배: 승인 모습(남색 과잠 · 크림 소매 · 줄무늬 소맷단, 회색 후드, 짧고 검은 머리). 자전거는 남색 · 크림.
  taeo: Object.freeze({ id: 'taeo', name: '태오 선배', bikeStyle: 'hybrid', thigh: .45, shin: .44, upper: .3, fore: .27, torso: .54, shoulder: .2,
    colors: { jacket: 0x1d2f4d, sleeve: 0xe8e0cc, cuff: 0x1d2f4d, trim: 0xe8e0cc, hood: 0x8f9396, pants: 0x2b2f38, shoe: 0xece8df, sole: 0xb9b4a8, skin: 0xe2b692, hair: 0x14100e, helmet: 0xf3f0e8, vent: 0x24282c, lens: 0x0d1013 },
    bike: { color: 0x233a5e, accent: 0xe8e0cc } }),
  // 하린(가칭, 2화 동갑내기 친구가 정해지면 그 인물): 코랄 바람막이, 크림 바지, 헬멧 뒤로 나온 묶은 머리. 자전거는 민트.
  harin: Object.freeze({ id: 'harin', name: '하린', bikeStyle: 'city', thigh: .43, shin: .42, upper: .275, fore: .25, torso: .49, shoulder: .175, ponytail: true,
    colors: { jacket: 0xf2735f, sleeve: 0xf2735f, cuff: 0xf7efe3, trim: 0xf7efe3, hood: 0xe2604d, pants: 0xe6dfd0, shoe: 0xf4f1ea, sole: 0xc9c3b6, skin: 0xefc9a9, hair: 0x241813, helmet: 0x2f4a6b, vent: 0x121a24, lens: 0x0d1013 },
    bike: { color: 0x9ed6c6, accent: 0x2f4a6b } }),
});

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const mix = (a, b, t) => a + (b - a) * t;

/** 둥근 단면을 쌓아 몸 조각을 만든다. rings = [{ y, rx, rz, z?, x? }], 위아래는 뚜껑으로 닫는다. 정점 색은 ring.color 또는 color. */
function loft(THREE, rings, color, seg = 14) {
  const pos = [], col = [], idx = [], c = new THREE.Color();
  const push = (x, y, z, hex) => { pos.push(x, y, z); c.set(hex); col.push(c.r, c.g, c.b); };
  rings.forEach((r) => { for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2; push((r.x || 0) + Math.cos(a) * r.rx, r.y, (r.z || 0) + Math.sin(a) * r.rz, r.color ?? color); } });
  // 고리를 위로 쌓으면 그대로, 아래로 쌓으면 뒤집어야 겉이 바깥을 본다.
  const flip = rings[1].y < rings[0].y, tri = (a, b, d) => (flip ? idx.push(a, d, b) : idx.push(a, b, d));
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * seg + k, b = i * seg + (k + 1) % seg, d = (i + 1) * seg + k, e = (i + 1) * seg + (k + 1) % seg;
    tri(a, d, b); tri(b, d, e);
  }
  const first = pos.length / 3; push(rings[0].x || 0, rings[0].y, rings[0].z || 0, rings[0].color ?? color);
  const last = pos.length / 3, end = rings[rings.length - 1]; push(end.x || 0, end.y, end.z || 0, end.color ?? color);
  for (let k = 0; k < seg; k++) { tri(first, k, (k + 1) % seg); tri(last, (rings.length - 1) * seg + (k + 1) % seg, (rings.length - 1) * seg + k); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** 공(타원체) 조각. 색은 정점 함수로도 줄 수 있다. */
function ball(THREE, rx, ry, rz, center, color, w = 16, h = 10, phiStart = 0, phiLen = Math.PI * 2, thetaStart = 0, thetaLen = Math.PI) {
  const g = new THREE.SphereGeometry(1, w, h, phiStart, phiLen, thetaStart, thetaLen); g.scale(rx, ry, rz); g.translate(...center);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.set(typeof color === 'function' ? color(p.getX(i), p.getY(i), p.getZ(i)) : color); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** 정점 색 조각을 한 메시로. */
function bake(THREE, parts, material, name) {
  const list = parts.map((g) => (g.index ? g : g.toNonIndexed()));
  let v = 0, i = 0; for (const g of list) { v += g.attributes.position.count; i += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(v * 3), nor = new Float32Array(v * 3), col = new Float32Array(v * 3), index = new Uint32Array(i);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position; pos.set(p.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); col.set(g.attributes.color.array, vo * 3);
    if (g.index) for (let k = 0; k < g.index.count; k++) index[io++] = g.index.getX(k) + vo; else for (let k = 0; k < p.count; k++) index[io++] = k + vo;
    vo += p.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1)); out.computeBoundingSphere();
  const mesh = new THREE.Mesh(out, material); mesh.name = name; mesh.castShadow = true; mesh.frustumCulled = false;
  return mesh;
}
/** 팔다리 한 토막: 원점(몸쪽 관절)에서 −Y로 len만큼. 가운데가 조금 두툼하다. */
function limb(THREE, len, r0, r1, color, tail = null) {
  const ring = (t, r, c) => ({ y: -len * t, rx: r, rz: r * .92, color: c });
  const bulge = (r0 + r1) / 2 * 1.07;
  const rings = [ring(-.06, r0 * .55), ring(-.02, r0 * .9), ring(.12, r0), ring(.5, bulge), ring(.88, r1), ring(1.02, r1 * .9), ring(1.06, r1 * .5)];
  rings.forEach((r) => { r.color = color; });
  const g = [loft(THREE, rings, color, 10)];
  if (tail) g.push(...tail);
  return g;
}

/** 사람 한 명을 태운 자전거. 돌려주는 Group(원점 = 자전거 땅)의 userData: rider(뼈 길이 · 조각) · bike. */
export function buildRider(THREE, spec, { style = spec.bikeStyle } = {}) {
  const c = spec.colors, group = new THREE.Group(); group.name = `rider-${spec.id}`;
  const bike = buildBike(THREE, { style, color: spec.bike.color, accent: spec.bike.accent, detail: 'rival' }); group.add(bike);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: 0 });
  const gloss = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .28, metalness: .05, clearcoat: .7, clearcoatRoughness: .2 });
  const body = new THREE.Group(); group.add(body);
  const T = spec.torso, S = spec.shoulder;
  // 몸통: 골반 원점에서 +Y가 등뼈. 허리가 잘록하고 어깨가 넓다. 등에 후드(태오) · 소맷단처럼 밑단 띠.
  const torso = [loft(THREE, [
    { y: -.08, rx: .15, rz: .105, color: c.pants }, { y: -.02, rx: .17, rz: .12, color: c.pants }, { y: .03, rx: .167, rz: .118, color: c.pants }, { y: .036, rx: .17, rz: .122, color: c.trim }, { y: .056, rx: .165, rz: .118, color: c.trim },
    { y: .062, rx: .163, rz: .116, color: c.jacket }, { y: .082, rx: .158, rz: .113, color: c.jacket }, { y: .088, rx: .158, rz: .113, color: c.trim }, { y: .1, rx: .156, rz: .112, color: c.trim }, { y: .106, rx: .155, rz: .112, color: c.jacket }, { y: T * .42, rx: S * .8, rz: .115, color: c.jacket }, { y: T * .72, rx: S * .98, rz: .125, color: c.jacket }, { y: T * .9, rx: S * .94, rz: .11, color: c.jacket },
    { y: T * .97, rx: S * .6, rz: .085, color: c.jacket }, { y: T, rx: .075, rz: .07, color: c.trim }, { y: T + .03, rx: .058, rz: .056, color: c.trim },
  ], c.jacket, 18)];
  if (!spec.ponytail) torso.push(ball(THREE, .125, .075, .075, [0, T * .95, -.1], c.hood, 14, 8));   // 등에 내려앉은 회색 후드
  else torso.push(ball(THREE, .11, .05, .035, [0, T * .96, -.085], c.hood, 12, 6));   // 바람막이 깃
  // 머리: 얼굴 · 목 · 머리카락 · 헬멧 · 선글라스 · 귀. 원점 = 목 밑, +Z 앞.
  const headY = .152;
  const head = [
    loft(THREE, [{ y: -.04, rx: .05, rz: .05 }, { y: .05, rx: .048, rz: .05 }, { y: .1, rx: .052, rz: .054 }], c.skin, 10),
    ball(THREE, .082, .105, .095, [0, headY, .008], c.skin, 18, 12),
    ball(THREE, .012, .018, .014, [0, headY - .01, .102], c.skin, 8, 6),   // 코
    ball(THREE, .012, .028, .018, [.084, headY, 0], c.skin, 8, 6), ball(THREE, .012, .028, .018, [-.084, headY, 0], c.skin, 8, 6),
    ball(THREE, .086, .086, .092, [0, headY + .008, -.016], c.hair, 18, 8, Math.PI * .2, Math.PI * 1.6, Math.PI * .44, Math.PI * .34),   // 헬멧 아래 뒷머리
  ];
  const shine = [ball(THREE, .106, .104, .128, [0, headY + .036, -.012], c.helmet, 28, 12, 0, Math.PI * 2, 0, Math.PI * .5)];
  // 통풍구: 앞뒤로 긴 어두운 틈 다섯(정점 색 무늬는 꼭대기에서 모여 별처럼 보였다).
  for (const [x, y, len] of [[0, .137, .058], [.038, .13, .054], [-.038, .13, .054], [.072, .107, .044], [-.072, .107, .044]]) { const slit = ball(THREE, .0075, .006, len, [x, headY + y - .002, -.016], c.vent, 8, 5); slit.rotateZ(-x * 1.6); shine.push(slit); }
  const rim = loft(THREE, [{ y: .004, rx: .107, rz: .129 }, { y: -.012, rx: .1, rz: .121 }], c.vent, 28); rim.translate(0, headY + .036, -.012); shine.push(rim);
  // 선글라스: 눈높이를 두르는 어두운 띠.
  const lens = new THREE.TorusGeometry(.088, .017, 6, 26, Math.PI * .74); lens.rotateX(Math.PI / 2); lens.rotateY(-Math.PI * .13); lens.scale(1, .95, 1.06); lens.translate(0, headY + .01, .008);
  { const p = lens.attributes.position, col = new Float32Array(p.count * 3), k = new THREE.Color(c.lens); for (let i = 0; i < p.count; i++) col.set([k.r, k.g, k.b], i * 3); lens.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  shine.push(lens);
  const parts = {
    torso: bake(THREE, torso, material, 'torso'), head: bake(THREE, head, material, 'head'), helmet: bake(THREE, shine, gloss, 'helmet'),
    upperL: bake(THREE, limb(THREE, spec.upper, .049, .04, c.sleeve), material, 'upper-l'), upperR: bake(THREE, limb(THREE, spec.upper, .049, .04, c.sleeve), material, 'upper-r'),
    foreL: forearm(THREE, spec, c), foreR: forearm(THREE, spec, c),
    thighL: bake(THREE, limb(THREE, spec.thigh, .074, .052, c.pants), material, 'thigh-l'), thighR: bake(THREE, limb(THREE, spec.thigh, .074, .052, c.pants), material, 'thigh-r'),
    shinL: bake(THREE, limb(THREE, spec.shin, .05, .036, c.pants), material, 'shin-l'), shinR: bake(THREE, limb(THREE, spec.shin, .05, .036, c.pants), material, 'shin-r'),
    shoeL: shoe(THREE, c), shoeR: shoe(THREE, c),
  };
  function forearm(THREE, s, col) {
    const len = s.fore, hand = [
      ball(THREE, .036, .046, .03, [0, -len - .04, 0], col.skin, 10, 8),
      loft(THREE, [{ y: -len - .02, rx: .012, rz: .012 }, { y: -len - .05, rx: .012, rz: .012 }, { y: -len - .072, rx: .0105, rz: .0105 }], col.skin, 6),
    ];
    hand[1].translate(.028, 0, .022);   // 엄지
    const sleeve = limb(THREE, len, .041, .032, col.sleeve);
    // 줄무늬 소맷단.
    const cuff = [loft(THREE, [{ y: -len + .06, rx: .034, rz: .032 }, { y: -len + .045, rx: .036, rz: .034 }, { y: -len + .02, rx: .036, rz: .034 }], col.cuff, 10)];
    return bake(THREE, [...sleeve, ...cuff, ...hand], material, 'fore');
  }
  function shoe(THREE, col) {
    // 원점 = 발목, +Z 앞. 밑창 · 몸통.
    return bake(THREE, [
      ball(THREE, .05, .045, .135, [0, -.045, .055], col.shoe, 14, 8),
      ball(THREE, .052, .014, .14, [0, -.086, .055], col.sole, 14, 6),
    ], material, 'shoe');
  }
  for (const key of Object.keys(parts)) body.add(parts[key]);
  let tail = null;
  if (spec.ponytail) {
    // 묶은 머리: 헬멧 뒤에서 나와 달릴 때 흔들린다. 원점 = 묶는 자리.
    tail = bake(THREE, [loft(THREE, [{ y: .012, rx: .02, rz: .02 }, { y: -.02, rx: .03, rz: .028 }, { y: -.09, rx: .034, rz: .03 }, { y: -.17, rx: .024, rz: .022 }, { y: -.24, rx: .01, rz: .01 }, { y: -.25, rx: .004, rz: .004 }], c.hair, 10)], material, 'ponytail');
    tail.position.set(0, headY + .02, -.1); parts.head.add(tail);
  }
  parts.helmet.position.set(0, 0, 0); parts.head.add(parts.helmet);
  group.userData = { rider: { spec, parts, tail, body }, bike, wheels: [], jets: [], vehicleKind: 'bike' };
  poseRider(THREE, group, {});
  return group;
}

/** 두 관절 IK: 뿌리 a에서 끝 b까지, 길이 l1 · l2, 무릎 · 팔꿈치는 pole 쪽으로. 팔다리가 모자라면 곧게 뻗고 끝을 당긴다(뼈 길이는 늘지 않는다). */
export function twoBone(THREE, a, b, l1, l2, pole) {
  const d = b.clone().sub(a); let dist = d.length();
  if (dist < 1e-6) d.copy(pole);   // 목표가 뿌리와 겹치면 pole 쪽으로
  const reach = (l1 + l2) * .9995, near = Math.abs(l1 - l2) + .001;
  dist = clamp(dist, near, reach); d.normalize();
  const end = a.clone().addScaledVector(d, dist);
  const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), up = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const axis = pole.clone().sub(d.clone().multiplyScalar(pole.dot(d)));
  if (axis.lengthSq() < 1e-8) { axis.set(1, 0, 0); axis.sub(d.clone().multiplyScalar(axis.dot(d))); if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0); }   // pole이 뼈 줄기와 나란하면 아무 수직 방향으로
  axis.normalize();
  const joint = a.clone().addScaledVector(d, along).addScaledVector(axis, up);
  return { joint, end };
}
const DOWN = (THREE) => new THREE.Vector3(0, -1, 0);
function aim(THREE, mesh, from, to) {
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(DOWN(THREE), to.clone().sub(from).normalize());
}

/**
 * 한 프레임 자세(자전거 공간).
 * cadence 크랭크 각 · distance 구른 거리 · standing 0~1(일어서서 밟기) · look −1~1(+면 왼쪽 어깨 너머로 뒤돌아봄) ·
 * footDown 0~1(멈출 때 왼발을 땅에) · thumb 0~1(오른손 엄지 들기) · steer 조향 · speed(m/s, 묶은 머리 흔들림) · time(초).
 */
export function poseRider(THREE, group, { cadence = 0, distance = 0, standing = 0, look = 0, footDown = 0, thumb = 0, steer = 0, speed = 0, time = 0 } = {}) {
  const { rider, bike } = group.userData, { spec, parts, tail } = rider, spec2 = bike.userData.spec;
  // 일어서서 밟으면 자전거가 좌우로 흔들리고, 멈춰 발을 내리면 그쪽으로 기운다.
  const sway = Math.sin(cadence) * .055 * standing, roll = sway + .1 * footDown;
  bike.rotation.z = -roll;
  poseBike(bike, { distance, cadence, steer });
  const seat = spec2.saddle, lean = mix(.34, .62, standing) - .06 * footDown;
  const hip = new THREE.Vector3(Math.sin(roll) * seat[1] + sway * .4, mix(seat[1] + .082, seat[1] + .215, standing) - footDown * .012, mix(seat[2] + .01, seat[2] + .15, standing));
  // 등뼈: 골반에서 앞으로 기운다.
  const spineQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, look * .22, -roll * .6 + sway * .9, 'YXZ'));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(spineQ), side = new THREE.Vector3(1, 0, 0).applyQuaternion(spineQ);
  parts.torso.position.copy(hip); parts.torso.quaternion.copy(spineQ);
  const neck = hip.clone().addScaledVector(up, spec.torso + .025);
  // 머리: 등이 기운 만큼 들어 앞을 본다. 뒤돌아보면 어깨 쪽으로 크게 돈다.
  parts.head.position.copy(neck);
  parts.head.quaternion.setFromEuler(new THREE.Euler(lean * .12 - Math.abs(look) * .08 + Math.sin(time * 1.3) * .015, look * 1.18, -roll * .4, 'YXZ'));
  // 다리: 고관절 → 발목. 발목은 페달 위(또는 땅).
  for (const s of [1, -1]) {
    const hipJoint = hip.clone().addScaledVector(side, s * .09).addScaledVector(up, -.035);
    const p = pedalPoint(spec2, cadence, s), onPedal = new THREE.Vector3(s * .135, p[1] + .1, p[2] - .03);
    onPedal.applyAxisAngle(new THREE.Vector3(0, 0, 1), -roll);
    const ground = new THREE.Vector3(.29, .1, -.04), ankle = s > 0 ? onPedal.clone().lerp(ground, footDown) : onPedal;
    const pole = new THREE.Vector3(s * .16, .1, 1);
    const { joint, end } = twoBone(THREE, hipJoint, ankle, spec.thigh, spec.shin, pole);
    const [thigh, shin, foot] = s > 0 ? [parts.thighL, parts.shinL, parts.shoeL] : [parts.thighR, parts.shinR, parts.shoeR];
    aim(THREE, thigh, hipJoint, joint); aim(THREE, shin, joint, end);
    foot.position.copy(end); foot.quaternion.setFromEuler(new THREE.Euler(.12 + Math.sin(cadence + (s > 0 ? 0 : Math.PI)) * .14, 0, 0));
  }
  // 팔: 어깨 → 손잡이. 오른손은 엄지를 들 때 어깨 앞 · 위로.
  const gripY = spec2.grip[1] + .006, gripZ = spec2.grip[2] - .005;
  for (const s of [1, -1]) {
    const shoulder = hip.clone().addScaledVector(up, spec.torso * .9).addScaledVector(side, s * spec.shoulder * .94);
    const grip = new THREE.Vector3(s * spec2.grip[0], gripY, gripZ).applyAxisAngle(new THREE.Vector3(0, 0, 1), -roll);
    const free = shoulder.clone().add(new THREE.Vector3(s * .06, .14, .34));
    const hand = s < 0 ? grip.clone().lerp(free, thumb) : grip;
    const pole = new THREE.Vector3(s * .8, -.15 - .6 * (s < 0 ? thumb : 0), -.55);
    const { joint, end } = twoBone(THREE, shoulder, hand, spec.upper, spec.fore + .03, pole);
    const [upper, fore] = s > 0 ? [parts.upperL, parts.foreL] : [parts.upperR, parts.foreR];
    aim(THREE, upper, shoulder, joint); aim(THREE, fore, joint, end);
  }
  if (tail) {
    // 묶은 머리: 속도만큼 뒤로 뜨고 페달 박자 · 바람에 흔들린다.
    const lift = clamp(speed / 16, 0, 1);
    tail.rotation.x = -.15 - lift * .85 + Math.sin(time * 7 + cadence) * .08 * (.3 + lift);
    tail.rotation.z = Math.sin(time * 3.1) * .12 * (.3 + lift) + roll * .4;
  }
  rider.bones = { hip, neck };
}

/** 사람 + 자전거 삼각형 · 그리기 호출(예산 시험). */
export function riderStats(group) {
  let triangles = 0, drawCalls = 0;
  group.traverse((o) => { if (!o.isMesh) return; drawCalls++; triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { triangles: Math.round(triangles), drawCalls };
}
