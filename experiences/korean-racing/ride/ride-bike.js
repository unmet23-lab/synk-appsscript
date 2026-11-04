// MT 바닷가 자전거 레이스(WORLD 판) — 자전거 한 대를 코드로 짠다(2026-11-04, 설계 qa/world-mt-20261104/설계.md 4-1 · 4-3).
// 같은 틀로 내 자전거(1인칭 뷰모델, 앞쪽만 자세히)와 상대 자전거를 만든다. 크레딧 0, 그림 파일 없음.
// 자전거 공간: +Z 앞, +Y 위, 땅 = y 0, 크랭크 축(BB) = z 0. 단위 m. LAB 화면은 이 파일을 불러오지 않는다.
//
// 결 두 가지(시안 A/B): city = 바닷가 대여용 크루저(낮은 스텝스루 · 뒤로 휜 손잡이 · 넓은 흙받이 · 굵은 타이어 · 큰 둥근 앞등 · 크롬 벨 · 짐받이)
//   — 정확히 뒤에서 보면 바퀴는 세로줄 하나이고 스템이 가린다. 넓은 흙받이 · 굵은 타이어라야 1인칭에서 스템 양쪽으로 앞바퀴가 보인다,
//                       hybrid = 일자 손잡이 하이브리드(다이아몬드 틀 · 얇은 타이어 · 스템 위 작은 속도계).

export const BIKE = Object.freeze({
  city: Object.freeze({ wheelR: .345, tire: .033, rearZ: -.43, frontZ: .66, bbY: .29, crank: .17,
    saddle: [0, .985, -.2], headTop: [0, .88, .47], headBottom: [0, .72, .52], barCenter: [0, .955, .47], grip: [.295, .935, .28] }),
  hybrid: Object.freeze({ wheelR: .35, tire: .017, rearZ: -.43, frontZ: .63, bbY: .285, crank: .172,
    saddle: [0, 1.0, -.22], headTop: [0, .93, .45], headBottom: [0, .78, .5], barCenter: [0, .99, .52], grip: [.31, .99, .52] }),
});
export const BIKE_STYLES = Object.freeze(Object.keys(BIKE));

const V = (THREE, a) => new THREE.Vector3(a[0], a[1], a[2]);
// 상대 자전거(멀리서 보는 것)는 관 단면 · 굽힘 칸을 줄인다. buildBike가 만드는 동안만 바꾼다.
let LOD = 1;
const lod = (n, min = 3) => Math.max(min, Math.round(n * LOD));

/** 두 점 사이 원기둥(자전거 관). 지름은 r, 단면 seg. */
function rod(THREE, a, b, r, seg = 10) {
  const A = V(THREE, a), B = V(THREE, b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, lod(seg), 1, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
/** 점 여럿을 지나는 굽은 관(스텝스루 틀 · 손잡이). */
function bend(THREE, points, r, seg = 10, steps = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V(THREE, p)), false, 'centripetal');
  return new THREE.TubeGeometry(curve, lod(steps, 4), r, lod(seg), false);
}
/** 바퀴 축(X)을 둘러싼 고리: 바퀴 · 흙받이용. from~to 각(라디안, 0 = 앞 +Z, π/2 = 위)만 둘러싼다. */
function ringYZ(THREE, radius, tube, from, to, seg = 10, steps = 64) {
  const g = new THREE.TorusGeometry(radius, tube, lod(seg), lod(steps, 8), to - from);
  // TorusGeometry는 XY 평면에서 +X부터 돈다 → Y축으로 −90° 돌려 YZ 평면(+Z부터)으로.
  g.rotateZ(from); g.rotateY(-Math.PI / 2);
  return g;
}

/** 같은 재질의 조각을 한 메시로(그리기 호출을 줄인다). 위치 · 법선 · UV만 굽는다. */
export function merge(THREE, parts) {
  let vertices = 0, indices = 0;
  const list = parts.filter(Boolean).map((g) => (g.index ? g : g.toNonIndexed()));
  for (const g of list) { vertices += g.attributes.position.count; indices += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vertices * 3), nor = new Float32Array(vertices * 3), uv = new Float32Array(vertices * 2);
  const index = new (vertices > 65535 ? Uint32Array : Uint16Array)(indices);
  let v = 0, i = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    pos.set(p.array, v * 3); if (n) nor.set(n.array, v * 3); if (t) uv.set(t.array, v * 2);
    if (g.index) for (let k = 0; k < g.index.count; k++) index[i++] = g.index.getX(k) + v;
    else for (let k = 0; k < p.count; k++) index[i++] = k + v;
    v += p.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1)); out.computeBoundingSphere();
  return out;
}

/** 재질 한 벌. 차체색 · 덧색만 자전거마다 다르고 나머지는 같은 결(차와 같은 하늘 PMREM을 받는다). */
export function bikeMaterials(THREE, { color = 0xefe6d4, accent = 0x2f4a6b } = {}) {
  return {
    paint: new THREE.MeshPhysicalMaterial({ color, metalness: .25, roughness: .32, clearcoat: .9, clearcoatRoughness: .18, envMapIntensity: 1.05 }),
    accent: new THREE.MeshPhysicalMaterial({ color: accent, metalness: .2, roughness: .4, clearcoat: .6, clearcoatRoughness: .25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdedbd4, metalness: .78, roughness: .34, envMapIntensity: .95 }),
    alloy: new THREE.MeshStandardMaterial({ color: 0xaeb4b8, metalness: .85, roughness: .32 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1d20, metalness: 0, roughness: .86 }),
    tread: new THREE.MeshStandardMaterial({ color: 0x303236, metalness: 0, roughness: .86 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x4a3426, metalness: 0, roughness: .74 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x23272b, metalness: .05, roughness: .55 }),
    saddle: new THREE.MeshPhysicalMaterial({ color: 0x5a3b28, metalness: 0, roughness: .58, clearcoat: .25, clearcoatRoughness: .5 }),
    spoke: new THREE.MeshStandardMaterial({ color: 0xc3c8cb, metalness: .9, roughness: .3 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xf6f3e8, emissive: 0xfff2cf, emissiveIntensity: .5, metalness: 0, roughness: .08, clearcoat: 1 }),
    reflector: new THREE.MeshStandardMaterial({ color: 0x8e1f1a, emissive: 0xd23a22, emissiveIntensity: .35, roughness: .3 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x0d1114, emissive: 0x9fe2c8, emissiveIntensity: .32, roughness: .25 }),
  };
}

/** 바퀴 하나(축 = 로컬 X). 살은 detail에 따라 36 · 24개. 자기 원점에서 X축으로 돌리면 구른다. */
function wheel(THREE, m, spec, detail) {
  const g = new THREE.Group(), R = spec.wheelR, t = spec.tire, ring = detail === 'view' ? 18 : 10, steps = detail === 'view' ? 96 : 48;
  g.add(new THREE.Mesh(ringYZ(THREE, R - t, t, 0, Math.PI * 2, ring, steps), m.rubber));
  if (detail === 'view') {
    // 타이어 트레드: 밝은 돌기 줄이 돌아가며 바퀴 회전이 눈에 보인다.
    const lugs = [];
    for (let k = 0; k < 28; k++) for (const x of [-.012, .012]) { const a = k / 28 * Math.PI * 2 + (x > 0 ? .11 : 0), lug = new THREE.BoxGeometry(.015, .005, .03); lug.rotateX(-a + Math.PI / 2); lug.translate(x, Math.sin(a) * R, Math.cos(a) * R); lugs.push(lug); }
    g.add(new THREE.Mesh(merge(THREE, lugs), m.tread));
  }
  const rim = merge(THREE, [ringYZ(THREE, R - t * 2.05, .0105, 0, Math.PI * 2, 8, steps), detail === 'view' ? ringYZ(THREE, R - t * 2.6, .006, 0, Math.PI * 2, 6, steps) : null]);
  g.add(new THREE.Mesh(rim, m.alloy));
  const count = detail === 'view' ? 36 : 24, spokes = [], hub = [];
  hub.push(rod(THREE, [-.05, 0, 0], [.05, 0, 0], .019, 12), rod(THREE, [-.034, 0, 0], [-.03, 0, 0], .028, 14), rod(THREE, [.03, 0, 0], [.034, 0, 0], .028, 14));
  for (let k = 0; k < count; k++) {
    const side = k % 2 ? 1 : -1, a = (k / count) * Math.PI * 2, lead = side * .32;   // 한 칸씩 엇갈리게(교차 살)
    const hubPt = [side * .032, Math.sin(a) * .026, Math.cos(a) * .026], rimR = R - t * 2.3;
    spokes.push(rod(THREE, hubPt, [0, Math.sin(a + lead) * rimR, Math.cos(a + lead) * rimR], .0011, 3));
  }
  g.add(new THREE.Mesh(merge(THREE, spokes), m.spoke), new THREE.Mesh(merge(THREE, hub), m.chrome));
  return g;
}

/** 크랭크(체인링 · 크랭크 팔 · 페달). 원점 = BB, X축으로 돈다. 페달은 userData.pedals에, 돌면서도 수평이 되게 앱이 되돌린다. */
function crankset(THREE, m, spec, detail) {
  const g = new THREE.Group(), L = spec.crank, seg = detail === 'view' ? 24 : 14;
  const ring = new THREE.Mesh(merge(THREE, [ringYZ(THREE, .088, .006, 0, Math.PI * 2, 6, seg * 2), rod(THREE, [-.072, 0, 0], [-.066, 0, 0], .06, seg)]), m.alloy);
  g.add(ring); g.add(new THREE.Mesh(rod(THREE, [-.09, 0, 0], [.09, 0, 0], .012, 10), m.chrome));
  const pedals = [];
  for (const side of [1, -1]) {
    const arm = new THREE.Mesh(rod(THREE, [side * .09, 0, 0], [side * .1, side > 0 ? L : -L, 0], .011, 8), m.alloy); g.add(arm);
    const pivot = new THREE.Group(); pivot.position.set(side * .1, side > 0 ? L : -L, 0); g.add(pivot);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(.085, .022, .07), m.plastic); pedal.position.x = side * .05; pivot.add(pedal);
    const refl = new THREE.Mesh(new THREE.BoxGeometry(.05, .012, .004), m.reflector); refl.position.set(side * .05, 0, -.037); pivot.add(refl);
    pedals.push(pivot);
  }
  g.userData.pedals = pedals;
  return g;
}

/** 손잡이 · 포크 · 앞바퀴 · 앞등 · 벨 · 흙받이: 머리관 축을 따라 도는 무리. 돌림 원점 = 머리관 위. */
function steering(THREE, m, spec, style, detail) {
  const ht = V(THREE, spec.headTop), hb = V(THREE, spec.headBottom), axis = hb.clone().sub(ht).normalize();
  const pivot = new THREE.Group(); pivot.position.copy(ht);
  // 머리관 기울기만큼 눕힌 축에서 Y로 돌리면 조향이다.
  pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis);
  const yaw = new THREE.Group(); pivot.add(yaw);
  const toLocal = new THREE.Matrix4().compose(ht, pivot.quaternion, new THREE.Vector3(1, 1, 1)).invert();
  const local = (g) => g.applyMatrix4(toLocal);
  const fz = spec.frontZ, R = spec.wheelR, crown = [0, hb.y - .1, hb.z + .035];
  const paint = [], chrome = [], rubber = [], plastic = [], grip = [];
  // 포크: 크라운에서 두 다리가 살짝 앞으로 휘어 바퀴 축에 닿는다.
  paint.push(rod(THREE, spec.headBottom, crown, .021, 12));
  for (const x of [-.055, .055]) paint.push(bend(THREE, [[x * .6, crown[1], crown[2]], [x, (crown[1] + R) / 2 + .03, (crown[2] + fz) / 2 - .01], [x, R, fz]], .012, 8, 12));
  paint.push(rod(THREE, [-.062, crown[1], crown[2]], [.062, crown[1], crown[2]], .018, 10));
  const bc = spec.barCenter, gx = spec.grip[0];
  if (style === 'city') {
    // 퀼 스템이 머리관 위로 올라오고, 손잡이는 뒤로 휘어 손목이 편하다.
    chrome.push(rod(THREE, spec.headTop, [0, bc[1] - .01, spec.headTop[2] - .02], .0125, 12), rod(THREE, [0, bc[1] - .012, spec.headTop[2] - .02], bc, .012, 12));
    for (const s of [1, -1]) chrome.push(bend(THREE, [[0, bc[1], bc[2]], [s * .12, bc[1] + .008, bc[2] + .005], [s * .23, bc[1] - .002, bc[2] - .05], [s * (gx - .015), spec.grip[1] + .01, spec.grip[2] + .055]], .0112, 12, 28));
    chrome.push(rod(THREE, [-.03, bc[1], bc[2]], [.03, bc[1], bc[2]], .0145, 12));
    for (const s of [1, -1]) grip.push(rod(THREE, [s * (gx - .015), spec.grip[1] + .01, spec.grip[2] + .055], [s * (gx + .01), spec.grip[1] - .002, spec.grip[2] - .065], .0175, 14));
  } else {
    chrome.push(rod(THREE, spec.headTop, [0, spec.headTop[1] + .045, spec.headTop[2] - .012], .016, 12));
    plastic.push(rod(THREE, [0, spec.headTop[1] + .03, spec.headTop[2] - .01], [0, bc[1], bc[2]], .017, 12));
    plastic.push(rod(THREE, [-(gx - .1), bc[1] + .004, bc[2]], [gx - .1, bc[1] + .004, bc[2]], .0118, 12));
    for (const s of [1, -1]) grip.push(rod(THREE, [s * (gx - .11), bc[1] + .004, bc[2]], [s * (gx + .01), bc[1] + .004, bc[2]], .0156, 14));
    // 스템 위 작은 속도계(화면 글자는 없다 — 빛나는 면만).
    const head = new THREE.Mesh(new THREE.BoxGeometry(.062, .016, .044), m.plastic); head.position.set(0, bc[1] + .02, bc[2] - .02);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(.05, .032), m.screen); glass.rotation.x = -Math.PI / 2 + .45; glass.position.set(0, bc[1] + .029, bc[2] - .02);
    head.applyMatrix4(toLocal); glass.applyMatrix4(toLocal); yaw.add(head, glass);
  }
  // 브레이크 레버: 손잡이 안쪽 끝의 죔쇠에서 앞으로 나와 손잡이와 나란히, 손가락 두 마디 앞 · 아래에 걸린다.
  for (const s of [1, -1]) {
    const g0 = style === 'city' ? [s * (gx - .015), spec.grip[1] + .01, spec.grip[2] + .055] : [s * (gx - .11), bc[1] + .004, bc[2]];
    const g1 = style === 'city' ? [s * (gx + .01), spec.grip[1] - .002, spec.grip[2] - .065] : [s * (gx + .01), bc[1] + .004, bc[2]];
    const along = (t, dy, dz) => [g0[0] + (g1[0] - g0[0]) * t, g0[1] + (g1[1] - g0[1]) * t + dy, g0[2] + (g1[2] - g0[2]) * t + dz];
    const base = g0;
    plastic.push(rod(THREE, along(-.02, 0, 0), along(.02, -.004, .03), .011, 10));
    chrome.push(bend(THREE, [along(.02, -.004, .03), along(.25, -.016, .05), along(.55, -.024, .052), along(.82, -.03, .045)], .0048, 6, 14));
    // 케이블: 레버에서 머리관 앞으로 늘어진다.
    plastic.push(bend(THREE, [[base[0], base[1] - .004, base[2] + .012], [base[0] * .55, base[1] - .08, base[2] + .1], [s * .04, hb.y - .02, hb.z + .07]], .0028, 5, 14));
  }
  // 앞등(포크 크라운 앞) · 벨(왼손 엄지 자리) · 앞 흙받이.
  const lampAt = [0, crown[1] + .015, crown[2] + .07];
  plastic.push(rod(THREE, [0, crown[1], crown[2] + .02], lampAt, .006, 6));
  const lampR = style === 'city' ? .046 : .028;
  chrome.push(rod(THREE, [0, lampAt[1], lampAt[2] - .03], [0, lampAt[1], lampAt[2] + .03], lampR, 22));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(lampR * .86, 24), m.lens); lens.position.set(0, lampAt[1], lampAt[2] + .0305); lens.applyMatrix4(toLocal); yaw.add(lens);
  const bellAt = style === 'city' ? [.12, bc[1] + .012, bc[2] + .004] : [.075, bc[1] + .016, bc[2]];
  chrome.push(rod(THREE, [bellAt[0], bellAt[1] - .012, bellAt[2]], [bellAt[0], bellAt[1] - .002, bellAt[2]], .009, 10));
  const dome = new THREE.SphereGeometry(.026, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(bellAt[0], bellAt[1], bellAt[2]); chrome.push(dome);
  chrome.push(rod(THREE, [bellAt[0] - .004, bellAt[1] + .002, bellAt[2] + .012], [bellAt[0] - .018, bellAt[1] + .004, bellAt[2] + .034], .0035, 6));
  if (style === 'city') {
    // 앞 흙받이는 상대만: 내 1인칭은 타이어가 드러나 돌아야 앞바퀴가 보이고 속도가 느껴진다(위에서 보면 흙받이가 타이어를 통째로 가렸다).
    if (detail !== 'view') { const fender = ringYZ(THREE, R + .026, .016, -.2, 2.3, 8, 48); fender.scale(3.2, 1, 1); fender.translate(0, R, fz); paint.push(fender); }
  }
  const pieces = [[paint, m.paint], [chrome, m.chrome], [plastic, m.plastic], [grip, m.grip], [rubber, m.rubber]];
  for (const [list, material] of pieces) if (list.length) { const mesh = new THREE.Mesh(local(merge(THREE, list)), material); mesh.castShadow = detail !== 'view'; yaw.add(mesh); }
  const front = wheel(THREE, m, spec, detail); front.position.copy(V(THREE, [0, R, fz]).applyMatrix4(toLocal));
  front.quaternion.copy(pivot.quaternion).invert(); yaw.add(front);
  return { pivot, yaw, front, lamp: lens };
}

/**
 * 자전거 한 대. detail: 'view'(내 1인칭 — 앞쪽 세부 · 살 36) · 'rival'(상대 — 살 24, 그림자).
 * 돌려주는 Group의 userData: bikeWheels[앞, 뒤] · crank · pedals · steer(조향 Y) · spec · style · vehicleKind 'bike'.
 * 컨트롤러가 돌리는 wheels · jets는 빈 배열이다 — 바퀴는 rig가 길 위 이동 거리로 poseBike한다(컨트롤러의 회전 상수는 자동차 값).
 */
export function buildBike(THREE, { style = 'city', color, accent, detail = 'rival' } = {}) {
  if (!BIKE[style]) throw new RangeError(`Unknown bike style: ${style}`);
  LOD = detail === 'view' ? 1 : .6;
  try { return build(THREE, style, color, accent, detail); } finally { LOD = 1; }
}
function build(THREE, style, color, accent, detail) {
  const spec = BIKE[style], m = bikeMaterials(THREE, { color: color ?? (style === 'city' ? 0xefe6d4 : 0xf2735f), accent });
  const bike = new THREE.Group(); bike.name = `bike-${style}`;
  const R = spec.wheelR, rz = spec.rearZ, bb = [0, spec.bbY, 0], seat = [0, spec.saddle[1] - .17, spec.saddle[2] + .05];
  const paint = [], chrome = [], plastic = [], accentParts = [], rubber = [];
  const ht = spec.headTop, hb = spec.headBottom;
  paint.push(rod(THREE, ht, hb, .022, 14));
  if (style === 'city') {
    // 낮은 스텝스루: 머리관 아래에서 크게 휘어 BB로, 가는 둘째 관이 머리관 위에서 앉는 관 가운데로.
    paint.push(bend(THREE, [hb, [0, .5, .36], [0, .35, .14], [0, bb[1] + .02, .03], bb], .02, 12, 30));
    paint.push(bend(THREE, [[0, ht[1] - .05, ht[2] - .01], [0, .66, .24], [0, .56, .02], [0, seat[1] - .2, seat[2] + .07]], .0135, 10, 24));
  } else {
    paint.push(rod(THREE, [0, ht[1] - .02, ht[2] - .01], [0, seat[1] + .01, seat[2] + .02], .017, 12));
    paint.push(rod(THREE, [0, hb[1] + .02, hb[2] - .01], bb, .022, 12));
  }
  paint.push(rod(THREE, bb, seat, .017, 12));
  for (const x of [-.065, .065]) {
    paint.push(rod(THREE, [x * .45, bb[1], bb[2]], [x, R, rz], .0095, 8));
    paint.push(rod(THREE, [x * .3, seat[1] - .01, seat[2] - .01], [x, R + .005, rz + .01], .008, 8));
  }
  chrome.push(rod(THREE, [-.03, bb[1], bb[2]], [.03, bb[1], bb[2]], .03, 14));
  // 안장대와 안장(스프링 안장 · 일자형 안장).
  chrome.push(rod(THREE, seat, [0, spec.saddle[1] - .04, spec.saddle[2] + .015], .0135, 10));
  const saddle = new THREE.SphereGeometry(1, 24, 12); saddle.scale(style === 'city' ? .115 : .075, .035, .14); saddle.translate(0, spec.saddle[1] - .01, spec.saddle[2] + .02);
  const nose = new THREE.SphereGeometry(1, 16, 8); nose.scale(.05, .028, .09); nose.translate(0, spec.saddle[1] - .012, spec.saddle[2] + .11);
  const saddleMesh = new THREE.Mesh(merge(THREE, [saddle, nose]), m.saddle); saddleMesh.castShadow = detail !== 'view'; bike.add(saddleMesh);
  if (style === 'city') {
    if (detail === 'view') for (const x of [-.04, .04]) for (let k = 0; k < 5; k++) chrome.push(ringYZ(THREE, .014, .0028, 0, Math.PI * 2, 4, 10).rotateZ(Math.PI / 2).translate(x, spec.saddle[1] - .06 + k * .009, spec.saddle[2] - .07));
    // 뒤 짐받이 · 뒤 흙받이 · 체인 덮개 · 뒤 반사판.
    const rackY = R + .42, rack = [];
    for (const x of [-.075, .075]) { rack.push(rod(THREE, [x, rackY, rz + .2], [x, rackY, rz - .18], .006, 6), rod(THREE, [x, rackY, rz - .1], [x * 1.05, R, rz], .0055, 6), rod(THREE, [x, rackY, rz + .2], [x * .5, seat[1] - .02, seat[2] - .02], .005, 6)); }
    for (let k = 0; k < 4; k++) rack.push(rod(THREE, [-.075, rackY, rz + .16 - k * .11], [.075, rackY, rz + .16 - k * .11], .005, 6));
    paint.push(...rack);
    const rear = ringYZ(THREE, R + .026, .016, .55, 3.2, 8, 40); rear.scale(3.6, 1, 1); rear.translate(0, R, rz); paint.push(rear);
    // 체인(위 · 아래 줄)과 체인링 위를 덮는 가는 덮개.
    plastic.push(rod(THREE, [-.072, bb[1] + .082, 0], [-.072, R + .04, rz], .004, 5), rod(THREE, [-.072, bb[1] - .082, 0], [-.072, R - .04, rz], .004, 5));
    const guard = ringYZ(THREE, .1, .006, .15, 2.9, 4, 18); guard.scale(4.2, 1, 1); guard.translate(-.072, bb[1], 0); accentParts.push(guard);
    accentParts.push(rod(THREE, [-.072, bb[1] + .1, -.03], [-.072, R + .062, rz + .1], .007, 5));
    const refl = new THREE.Mesh(new THREE.BoxGeometry(.05, .03, .008), m.reflector); refl.position.set(0, rackY - .01, rz - .21); bike.add(refl);
  }
  // 받침대(접힌 채).
  plastic.push(rod(THREE, [.05, bb[1] - .01, bb[2] - .06], [.07, R * .55, rz + .12], .0075, 6));
  for (const [list, material] of [[paint, m.paint], [chrome, m.chrome], [plastic, m.plastic], [accentParts, m.accent], [rubber, m.rubber]]) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(merge(THREE, list), material); mesh.castShadow = detail !== 'view'; mesh.receiveShadow = true; bike.add(mesh);
  }
  const rearWheel = wheel(THREE, m, spec, detail); rearWheel.position.set(0, R, rz); bike.add(rearWheel);
  const crank = crankset(THREE, m, spec, detail); crank.position.set(...bb); bike.add(crank);
  const steer = steering(THREE, m, spec, style, detail); bike.add(steer.pivot);
  Object.assign(bike.userData, { vehicleKind: 'bike', style, spec, materials: m, bikeWheels: [steer.front, rearWheel], wheels: [], crank, pedals: crank.userData.pedals,
    steer: steer.yaw, lamp: steer.lamp, jets: [], spin: 0 });
  return bike;
}

/**
 * 한 프레임 자세: 굴러간 거리로 바퀴, 페달 박자로 크랭크(페달은 수평 유지), 조향 각.
 * distance(m) — 바퀴가 구른 길이. cadence(rad) — 크랭크 각. steer(라디안, +면 왼쪽).
 */
export function poseBike(bike, { distance = 0, cadence = 0, steer = 0 } = {}) {
  const { bikeWheels, crank, pedals, steer: yaw, spec } = bike.userData;
  const spin = distance / spec.wheelR;
  for (const w of bikeWheels) w.rotation.x = spin;
  crank.rotation.x = cadence; for (const p of pedals) p.rotation.x = -cadence;
  yaw.rotation.y = steer;
}

/** 크랭크 축 기준 페달 자리(자전거 공간). side +1 = 왼발(+X), −1 = 오른발. 다리 IK가 이 점을 딛는다. */
export function pedalPoint(spec, cadence, side) {
  // 크랭크는 X축으로 돈다(바퀴와 같은 쪽): 위(+Y)에 있던 팔 끝이 각 a만큼 돌면 (0, L cos a, L sin a) — 위에서 앞으로 밟아 내린다.
  const a = cadence + (side > 0 ? 0 : Math.PI);
  return [side * .155, spec.bbY + Math.cos(a) * spec.crank, Math.sin(a) * spec.crank];
}

/** 삼각형 · 그리기 호출 세기(예산 시험). */
export function bikeStats(object) {
  let triangles = 0, drawCalls = 0;
  object.traverse((o) => { if (!o.isMesh) return; drawCalls++; triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { triangles: Math.round(triangles), drawCalls };
}
